
ALTER TABLE public.arbitrages
  ADD COLUMN IF NOT EXISTS calculo_automatico BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.log_arbitrage_result_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.casa_01_resultado IS DISTINCT FROM NEW.casa_01_resultado THEN
    INSERT INTO public.arbitrage_history (arbitrage_id, user_id, casa, resultado_anterior, resultado_novo)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), NEW.casa_01_nome, OLD.casa_01_resultado, NEW.casa_01_resultado);
  END IF;
  IF OLD.casa_02_resultado IS DISTINCT FROM NEW.casa_02_resultado THEN
    INSERT INTO public.arbitrage_history (arbitrage_id, user_id, casa, resultado_anterior, resultado_novo)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), NEW.casa_02_nome, OLD.casa_02_resultado, NEW.casa_02_resultado);
  END IF;
  IF OLD.casa_03_resultado IS DISTINCT FROM NEW.casa_03_resultado AND NEW.casa_03_nome IS NOT NULL THEN
    INSERT INTO public.arbitrage_history (arbitrage_id, user_id, casa, resultado_anterior, resultado_novo)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), NEW.casa_03_nome, OLD.casa_03_resultado, NEW.casa_03_resultado);
  END IF;
  IF OLD.calculo_automatico IS DISTINCT FROM NEW.calculo_automatico THEN
    INSERT INTO public.arbitrage_history (arbitrage_id, user_id, casa, resultado_anterior, resultado_novo)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.user_id),
      'Cálculo automático',
      CASE WHEN OLD.calculo_automatico THEN 'ativado' ELSE 'desativado' END,
      CASE WHEN NEW.calculo_automatico THEN 'ativado' ELSE 'desativado' END
    );
  END IF;
  RETURN NEW;
END;
$function$;
