ALTER TABLE public.arbitrages ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL','USD','EUR')), ADD COLUMN IF NOT EXISTS currency_ledger boolean NOT NULL DEFAULT false;
ALTER TABLE public.partnerships ADD COLUMN IF NOT EXISTS saldo_bancario_usd numeric NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS saldo_bancario_eur numeric NOT NULL DEFAULT 0;
ALTER TABLE public.partnership_houses ADD COLUMN IF NOT EXISTS saldo_usd numeric NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS saldo_eur numeric NOT NULL DEFAULT 0;
ALTER TABLE public.balance_movements ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL','USD','EUR'));
CREATE OR REPLACE FUNCTION public.apply_currency_house_movement(p_partnership uuid, p_house text, p_currency text, p_delta numeric, p_reference uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p public.partnerships; h public.partnership_houses; house_balance numeric; bank_balance numeric; missing numeric; new_house numeric; new_bank numeric;
BEGIN
 IF p_partnership IS NULL OR p_house IS NULL OR p_delta = 0 THEN RETURN; END IF;
 IF p_currency NOT IN ('BRL','USD','EUR') THEN RAISE EXCEPTION 'Moeda inválida'; END IF;
 SELECT * INTO p FROM public.partnerships WHERE id = p_partnership FOR UPDATE;
 IF p.id IS NULL OR p.user_id <> auth.uid() OR p.status NOT IN ('ativo','ativa') THEN RAISE EXCEPTION 'Use uma parceria ativa própria'; END IF;
 SELECT * INTO h FROM public.partnership_houses WHERE partnership_id=p_partnership AND house_name=p_house FOR UPDATE;
 IF h.id IS NULL THEN
  INSERT INTO public.partnership_houses(partnership_id,house_name,status) VALUES (p_partnership,p_house,'ativa') RETURNING * INTO h;
 END IF;
 house_balance := CASE p_currency WHEN 'USD' THEN h.saldo_usd WHEN 'EUR' THEN h.saldo_eur ELSE h.saldo END;
 bank_balance := CASE p_currency WHEN 'USD' THEN p.saldo_bancario_usd WHEN 'EUR' THEN p.saldo_bancario_eur ELSE p.saldo_bancario END;
 missing := greatest(0, -(house_balance+p_delta));
 new_house := greatest(0,house_balance+p_delta);
 new_bank := greatest(0,bank_balance-missing);
 UPDATE public.partnership_houses SET saldo=CASE WHEN p_currency='BRL' THEN new_house ELSE saldo END, saldo_usd=CASE WHEN p_currency='USD' THEN new_house ELSE saldo_usd END, saldo_eur=CASE WHEN p_currency='EUR' THEN new_house ELSE saldo_eur END WHERE id=h.id;
 IF missing > 0 THEN
  UPDATE public.partnerships SET saldo_bancario=CASE WHEN p_currency='BRL' THEN new_bank ELSE saldo_bancario END, saldo_bancario_usd=CASE WHEN p_currency='USD' THEN new_bank ELSE saldo_bancario_usd END, saldo_bancario_eur=CASE WHEN p_currency='EUR' THEN new_bank ELSE saldo_bancario_eur END WHERE id=p.id;
 END IF;
 INSERT INTO public.balance_movements(partnership_id,user_id,tipo,valor,saldo_anterior,saldo_novo,descricao,referencia_id,moeda) VALUES(p.id,auth.uid(),CASE WHEN p_delta<0 THEN 'debito' ELSE 'deposito' END,abs(p_delta),house_balance,new_house,'Casa: '||p_house||CASE WHEN missing>0 THEN ' · Uso do banco: '||least(missing,bank_balance)::text ELSE '' END,p_reference,p_currency);
END; $$;
REVOKE ALL ON FUNCTION public.apply_currency_house_movement(uuid,text,text,numeric,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_currency_house_movement(uuid,text,text,numeric,uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.guard_arbitrage_currency() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.moeda <> OLD.moeda OR NEW.currency_ledger <> OLD.currency_ledger THEN RAISE EXCEPTION 'A moeda de uma aposta salva não pode ser alterada'; END IF;
  IF OLD.currency_ledger AND OLD.saldo_descontado AND (NEW.saldo_descontado IS DISTINCT FROM OLD.saldo_descontado OR ROW(NEW.casa_01_nome,NEW.casa_01_parceria_id,NEW.casa_01_valor,NEW.casa_02_nome,NEW.casa_02_parceria_id,NEW.casa_02_valor,NEW.casa_03_nome,NEW.casa_03_parceria_id,NEW.casa_03_valor) IS DISTINCT FROM ROW(OLD.casa_01_nome,OLD.casa_01_parceria_id,OLD.casa_01_valor,OLD.casa_02_nome,OLD.casa_02_parceria_id,OLD.casa_02_valor,OLD.casa_03_nome,OLD.casa_03_parceria_id,OLD.casa_03_valor)) THEN RAISE EXCEPTION 'Valores e casas de uma aposta já debitada não podem ser alterados'; END IF;
 END IF;
 IF NEW.moeda <> 'BRL' AND NOT NEW.currency_ledger THEN RAISE EXCEPTION 'Aposta estrangeira exige controle de saldo por moeda'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_arbitrage_currency() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_arbitrage_currency() TO service_role;
CREATE TRIGGER guard_arbitrage_currency BEFORE INSERT OR UPDATE ON public.arbitrages FOR EACH ROW EXECUTE FUNCTION public.guard_arbitrage_currency();
CREATE OR REPLACE FUNCTION public.arbitrage_currency_movements() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE i integer; a jsonb; old_a jsonb; pid uuid; house text; stake numeric; returned numeric; previous_return numeric; prefix text;
BEGIN
 IF NOT NEW.currency_ledger OR NOT NEW.saldo_descontado THEN RETURN NEW; END IF;
 a:=to_jsonb(NEW); IF TG_OP='UPDATE' THEN old_a:=to_jsonb(OLD); END IF;
 FOR i IN 1..3 LOOP
  prefix:='casa_0'||i::text;
  pid:=nullif(a->>(prefix||'_parceria_id'),'')::uuid; house:=a->>(prefix||'_nome');
  stake:=coalesce((a->>(prefix||'_valor'))::numeric,0);
  IF pid IS NULL OR house IS NULL THEN CONTINUE; END IF;
  IF TG_OP='INSERT' THEN PERFORM public.apply_currency_house_movement(pid,house,NEW.moeda,-stake,NEW.id); END IF;
  returned:=CASE WHEN coalesce(a->>(prefix||'_resultado'),'aguardando')='aguardando' THEN 0 ELSE coalesce((a->>(prefix||'_valor_resultado'))::numeric,0) END;
  previous_return:=CASE WHEN TG_OP='INSERT' OR coalesce(old_a->>(prefix||'_resultado'),'aguardando')='aguardando' THEN 0 ELSE coalesce((old_a->>(prefix||'_valor_resultado'))::numeric,0) END;
  IF returned <> previous_return THEN PERFORM public.apply_currency_house_movement(pid,house,NEW.moeda,returned-previous_return,NEW.id); END IF;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.arbitrage_currency_movements() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arbitrage_currency_movements() TO service_role;
CREATE TRIGGER arbitrage_currency_movements AFTER INSERT OR UPDATE ON public.arbitrages FOR EACH ROW EXECUTE FUNCTION public.arbitrage_currency_movements();