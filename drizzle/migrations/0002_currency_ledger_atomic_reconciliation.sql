CREATE OR REPLACE FUNCTION public.apply_currency_house_movement(p_partnership uuid,p_house text,p_currency text,p_delta numeric,p_reference uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p public.partnerships; h public.partnership_houses; hb numeric; bb numeric; missing numeric; nh numeric;
BEGIN
 IF p_partnership IS NULL OR p_house IS NULL OR p_delta=0 THEN RETURN; END IF;
 IF p_currency NOT IN ('BRL','USD','EUR') OR p_delta IS NULL THEN RAISE EXCEPTION 'Moeda ou valor inválido'; END IF;
 SELECT * INTO p FROM public.partnerships WHERE id=p_partnership FOR UPDATE;
 IF p.id IS NULL OR p.user_id IS DISTINCT FROM auth.uid() OR p.status NOT IN ('ativo','ativa') THEN RAISE EXCEPTION 'Use uma parceria ativa própria'; END IF;
 SELECT * INTO h FROM public.partnership_houses WHERE partnership_id=p_partnership AND house_name=p_house FOR UPDATE;
 IF h.id IS NULL THEN INSERT INTO public.partnership_houses(partnership_id,house_name,status) VALUES(p_partnership,p_house,'ativa') RETURNING * INTO h; END IF;
 hb:=CASE p_currency WHEN 'USD' THEN h.saldo_usd WHEN 'EUR' THEN h.saldo_eur ELSE h.saldo END;
 bb:=CASE p_currency WHEN 'USD' THEN p.saldo_bancario_usd WHEN 'EUR' THEN p.saldo_bancario_eur ELSE p.saldo_bancario END;
 p_delta:=round(p_delta,2); missing:=greatest(0,-(hb+p_delta));
 IF missing>bb THEN RAISE EXCEPTION 'Saldo insuficiente em % na casa e no banco. Atualize o saldo ou desmarque Descontar do saldo.',p_currency; END IF;
 nh:=greatest(0,hb+p_delta);
 UPDATE public.partnership_houses SET saldo=CASE WHEN p_currency='BRL' THEN nh ELSE saldo END,saldo_usd=CASE WHEN p_currency='USD' THEN nh ELSE saldo_usd END,saldo_eur=CASE WHEN p_currency='EUR' THEN nh ELSE saldo_eur END WHERE id=h.id;
 INSERT INTO public.balance_movements(partnership_id,user_id,tipo,valor,saldo_anterior,saldo_novo,descricao,referencia_id,moeda) VALUES(p.id,auth.uid(),CASE WHEN p_delta<0 THEN 'debito' ELSE 'deposito' END,abs(p_delta+missing),hb,nh,'Casa: '||p_house,p_reference,p_currency);
 IF missing>0 THEN
 UPDATE public.partnerships SET saldo_bancario=CASE WHEN p_currency='BRL' THEN bb-missing ELSE saldo_bancario END,saldo_bancario_usd=CASE WHEN p_currency='USD' THEN bb-missing ELSE saldo_bancario_usd END,saldo_bancario_eur=CASE WHEN p_currency='EUR' THEN bb-missing ELSE saldo_bancario_eur END WHERE id=p.id;
 INSERT INTO public.balance_movements(partnership_id,user_id,tipo,valor,saldo_anterior,saldo_novo,descricao,referencia_id,moeda) VALUES(p.id,auth.uid(),'debito',missing,bb,bb-missing,'Conta bancária · Casa: '||p_house,p_reference,p_currency);
 END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.guard_arbitrage_currency() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.moeda<>OLD.moeda OR NEW.currency_ledger<>OLD.currency_ledger) THEN RAISE EXCEPTION 'A moeda de uma aposta salva não pode ser alterada'; END IF;
 IF NEW.moeda<>'BRL' AND NOT NEW.currency_ledger THEN RAISE EXCEPTION 'Aposta estrangeira exige controle de saldo por moeda'; END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.arbitrage_currency_movements() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a jsonb; o jsonb; r record; i integer; prefix text; pid uuid; house text; stake numeric; returned numeric;
BEGIN
 IF TG_OP='DELETE' THEN a:=NULL; ELSE a:=to_jsonb(NEW); END IF;
 IF TG_OP='INSERT' THEN o:=NULL; ELSE o:=to_jsonb(OLD); END IF;
 IF NOT coalesce((a->>'currency_ledger')::boolean,false) AND NOT coalesce((o->>'currency_ledger')::boolean,false) THEN RETURN coalesce(NEW,OLD); END IF;
 FOR r IN
 WITH legs AS (
 SELECT rowdata,sign,idx FROM (VALUES(a,1),(o,-1)) s(rowdata,sign) CROSS JOIN generate_series(1,3) idx
 WHERE coalesce((rowdata->>'currency_ledger')::boolean,false) AND coalesce((rowdata->>'saldo_descontado')::boolean,false)
 ), amounts AS (
 SELECT nullif(rowdata->>('casa_0'||idx||'_parceria_id'),'')::uuid pid,rowdata->>('casa_0'||idx||'_nome') house,rowdata->>'moeda' moeda,
 sign*(-coalesce((rowdata->>('casa_0'||idx||'_valor'))::numeric,0)+CASE WHEN coalesce(rowdata->>('casa_0'||idx||'_resultado'),'aguardando')='aguardando' THEN 0 ELSE coalesce((rowdata->>('casa_0'||idx||'_valor_resultado'))::numeric,0) END) delta FROM legs
 ) SELECT amounts.pid,amounts.house,amounts.moeda,sum(delta) delta FROM amounts GROUP BY amounts.pid,amounts.house,amounts.moeda HAVING sum(delta)<>0 ORDER BY sum(delta) DESC,amounts.pid,amounts.house
 LOOP
 PERFORM public.apply_currency_house_movement(r.pid,r.house,r.moeda,r.delta,coalesce(NEW.id,OLD.id));
 END LOOP;
 RETURN coalesce(NEW,OLD);
END; $$;
DROP TRIGGER IF EXISTS arbitrage_currency_movements ON public.arbitrages;
CREATE TRIGGER arbitrage_currency_movements AFTER INSERT OR UPDATE OR DELETE ON public.arbitrages FOR EACH ROW EXECUTE FUNCTION public.arbitrage_currency_movements();
REVOKE ALL ON FUNCTION public.guard_arbitrage_currency(),public.arbitrage_currency_movements() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_arbitrage_currency(),public.arbitrage_currency_movements() TO service_role;