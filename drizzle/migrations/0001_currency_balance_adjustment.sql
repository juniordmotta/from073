CREATE OR REPLACE FUNCTION public.adjust_currency_balance(p_partnership uuid, p_currency text, p_amount numeric, p_house_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p public.partnerships; h public.partnership_houses; old_amount numeric;
BEGIN
 IF p_currency NOT IN ('BRL','USD','EUR') OR p_amount IS NULL OR p_amount < 0 OR p_amount > 1000000000 THEN RAISE EXCEPTION 'Saldo inválido'; END IF;
 SELECT * INTO p FROM public.partnerships WHERE id=p_partnership FOR UPDATE;
 IF p.id IS NULL OR p.user_id<>auth.uid() OR p.status NOT IN ('ativo','ativa') THEN RAISE EXCEPTION 'Use uma parceria ativa própria'; END IF;
 IF p_house_id IS NULL THEN
  old_amount:=CASE p_currency WHEN 'USD' THEN p.saldo_bancario_usd WHEN 'EUR' THEN p.saldo_bancario_eur ELSE p.saldo_bancario END;
  UPDATE public.partnerships SET saldo_bancario=CASE WHEN p_currency='BRL' THEN round(p_amount,2) ELSE saldo_bancario END,saldo_bancario_usd=CASE WHEN p_currency='USD' THEN round(p_amount,2) ELSE saldo_bancario_usd END,saldo_bancario_eur=CASE WHEN p_currency='EUR' THEN round(p_amount,2) ELSE saldo_bancario_eur END WHERE id=p_partnership;
 ELSE
  SELECT * INTO h FROM public.partnership_houses WHERE id=p_house_id AND partnership_id=p_partnership FOR UPDATE;
  IF h.id IS NULL THEN RAISE EXCEPTION 'Casa inválida'; END IF;
  old_amount:=CASE p_currency WHEN 'USD' THEN h.saldo_usd WHEN 'EUR' THEN h.saldo_eur ELSE h.saldo END;
  UPDATE public.partnership_houses SET saldo=CASE WHEN p_currency='BRL' THEN round(p_amount,2) ELSE saldo END,saldo_usd=CASE WHEN p_currency='USD' THEN round(p_amount,2) ELSE saldo_usd END,saldo_eur=CASE WHEN p_currency='EUR' THEN round(p_amount,2) ELSE saldo_eur END WHERE id=h.id;
 END IF;
 INSERT INTO public.balance_movements(partnership_id,user_id,tipo,valor,saldo_anterior,saldo_novo,descricao,moeda) VALUES(p.id,auth.uid(),'ajuste_manual',round(p_amount,2)-old_amount,old_amount,round(p_amount,2),CASE WHEN p_house_id IS NULL THEN 'Conta bancária' ELSE 'Casa: '||h.house_name END,p_currency);
END; $$;
REVOKE ALL ON FUNCTION public.adjust_currency_balance(uuid,text,numeric,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_currency_balance(uuid,text,numeric,uuid) TO authenticated,service_role;