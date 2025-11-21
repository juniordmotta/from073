--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: arbitrage_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.arbitrage_status AS ENUM (
    'aguardando',
    'green',
    'red',
    'parcial_green',
    'parcial_red',
    'perda_total',
    'devolvido'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin_master',
    'admin',
    'operador'
);


--
-- Name: calculate_lucro_real(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_lucro_real() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  total_investido DECIMAL(10, 2);
  total_retorno DECIMAL(10, 2);
  todas_devolvidas BOOLEAN;
  alguma_aguardando BOOLEAN;
  tem_casa_03 BOOLEAN;
BEGIN
  -- Verificar se tem casa 03
  tem_casa_03 := (NEW.casa_03_nome IS NOT NULL);
  
  -- Calcular total investido (incluindo casa 03 se existir)
  total_investido := NEW.casa_01_valor + NEW.casa_02_valor + COALESCE(NEW.casa_03_valor, 0);
  
  -- Verificar se alguma casa ainda está aguardando
  alguma_aguardando := (NEW.casa_01_resultado = 'aguardando' OR 
                        NEW.casa_02_resultado = 'aguardando' OR 
                        (tem_casa_03 AND NEW.casa_03_resultado = 'aguardando'));
  
  -- Se alguma ainda está aguardando, manter status aguardando e lucro NULL
  IF alguma_aguardando THEN
    NEW.status := 'aguardando';
    NEW.lucro_real := NULL;
    RETURN NEW;
  END IF;
  
  -- Calcular total de retorno (incluindo casa 03 se existir)
  total_retorno := COALESCE(NEW.casa_01_valor_resultado, 0) + 
                   COALESCE(NEW.casa_02_valor_resultado, 0) + 
                   COALESCE(NEW.casa_03_valor_resultado, 0);
  
  -- Calcular lucro real
  NEW.lucro_real := total_retorno - total_investido;
  
  -- Verificar se todas as apostas foram devolvidas
  todas_devolvidas := (NEW.casa_01_resultado = 'devolvido' AND 
                       NEW.casa_02_resultado = 'devolvido' AND 
                       (NOT tem_casa_03 OR NEW.casa_03_resultado = 'devolvido'));
  
  -- Atualizar status geral baseado nos resultados
  IF todas_devolvidas THEN
    NEW.status := 'devolvido';
  ELSIF NEW.casa_01_resultado = 'perda_total' OR NEW.casa_02_resultado = 'perda_total' OR 
        (tem_casa_03 AND NEW.casa_03_resultado = 'perda_total') THEN
    NEW.status := 'perda_total';
  ELSIF NEW.lucro_real > 0 THEN
    IF NEW.lucro_real >= NEW.lucro_projetado THEN
      NEW.status := 'green';
    ELSE
      NEW.status := 'parcial_green';
    END IF;
  ELSIF NEW.lucro_real < 0 THEN
    NEW.status := 'parcial_red';
  ELSE
    NEW.status := 'red';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: ensure_user_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_profile(user_uuid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_email text;
  user_name text;
  profile_exists boolean;
  role_exists boolean;
BEGIN
  -- Verificar se perfil já existe
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = user_uuid
  ) INTO profile_exists;
  
  -- Verificar se role já existe
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = user_uuid
  ) INTO role_exists;
  
  -- Se perfil não existe, criar
  IF NOT profile_exists THEN
    -- Buscar dados do usuário de auth.users
    SELECT email, COALESCE(raw_user_meta_data->>'name', email) 
    INTO user_email, user_name
    FROM auth.users 
    WHERE id = user_uuid;
    
    -- Inserir perfil
    INSERT INTO public.profiles (id, email, name)
    VALUES (user_uuid, user_email, user_name);
  END IF;
  
  -- Se role não existe, criar como operador
  IF NOT role_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_uuid, 'operador');
  END IF;
END;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(user_uuid uuid) RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = user_uuid;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- Verifica se é o primeiro usuário
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) INTO is_first_user;
  
  -- Insere o perfil
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  
  -- Insere a role
  IF is_first_user THEN
    -- Primeiro usuário é admin_master
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin_master');
  ELSE
    -- Demais usuários são operadores por padrão
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'operador');
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: arbitrage_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arbitrage_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    arbitrage_id uuid NOT NULL,
    user_id uuid NOT NULL,
    casa text NOT NULL,
    resultado_anterior public.arbitrage_status,
    resultado_novo public.arbitrage_status NOT NULL,
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: arbitrages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arbitrages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    data_evento timestamp with time zone DEFAULT now() NOT NULL,
    descricao text NOT NULL,
    casa_01_nome text NOT NULL,
    casa_01_odd numeric(10,2) NOT NULL,
    casa_01_valor numeric(10,2) NOT NULL,
    casa_01_resultado public.arbitrage_status DEFAULT 'aguardando'::public.arbitrage_status,
    casa_01_valor_resultado numeric(10,2),
    casa_02_nome text NOT NULL,
    casa_02_odd numeric(10,2) NOT NULL,
    casa_02_valor numeric(10,2) NOT NULL,
    casa_02_resultado public.arbitrage_status DEFAULT 'aguardando'::public.arbitrage_status,
    casa_02_valor_resultado numeric(10,2),
    porcentagem numeric(5,2) NOT NULL,
    retorno_previsto numeric(10,2) NOT NULL,
    lucro_projetado numeric(10,2) NOT NULL,
    lucro_real numeric(10,2) DEFAULT 0,
    status public.arbitrage_status DEFAULT 'aguardando'::public.arbitrage_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    casa_03_nome text,
    casa_03_odd numeric,
    casa_03_valor numeric,
    casa_03_resultado public.arbitrage_status DEFAULT 'aguardando'::public.arbitrage_status,
    casa_03_valor_resultado numeric,
    esporte_liga text,
    casa_01_mercado text,
    casa_02_mercado text,
    casa_03_mercado text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.user_role DEFAULT 'operador'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: arbitrage_history arbitrage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arbitrage_history
    ADD CONSTRAINT arbitrage_history_pkey PRIMARY KEY (id);


--
-- Name: arbitrages arbitrages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arbitrages
    ADD CONSTRAINT arbitrages_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);


--
-- Name: arbitrages calculate_arbitrage_lucro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER calculate_arbitrage_lucro BEFORE UPDATE ON public.arbitrages FOR EACH ROW WHEN (((old.casa_01_resultado IS DISTINCT FROM new.casa_01_resultado) OR (old.casa_02_resultado IS DISTINCT FROM new.casa_02_resultado) OR (old.casa_01_valor_resultado IS DISTINCT FROM new.casa_01_valor_resultado) OR (old.casa_02_valor_resultado IS DISTINCT FROM new.casa_02_valor_resultado))) EXECUTE FUNCTION public.calculate_lucro_real();


--
-- Name: arbitrages update_arbitrages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_arbitrages_updated_at BEFORE UPDATE ON public.arbitrages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: arbitrage_history arbitrage_history_arbitrage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arbitrage_history
    ADD CONSTRAINT arbitrage_history_arbitrage_id_fkey FOREIGN KEY (arbitrage_id) REFERENCES public.arbitrages(id) ON DELETE CASCADE;


--
-- Name: arbitrage_history arbitrage_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arbitrage_history
    ADD CONSTRAINT arbitrage_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: arbitrages arbitrages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arbitrages
    ADD CONSTRAINT arbitrages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles Admin Master pode criar perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin Master pode criar perfis" ON public.profiles FOR INSERT WITH CHECK ((public.get_user_role(auth.uid()) = 'admin_master'::public.user_role));


--
-- Name: user_roles Admin Master pode gerenciar roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin Master pode gerenciar roles" ON public.user_roles USING ((public.get_user_role(auth.uid()) = 'admin_master'::public.user_role));


--
-- Name: arbitrages Admins podem deletar arbitragens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins podem deletar arbitragens" ON public.arbitrages FOR DELETE USING ((public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::public.user_role, 'admin_master'::public.user_role])));


--
-- Name: user_roles Admins podem ver todas as roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins podem ver todas as roles" ON public.user_roles FOR SELECT USING ((public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::public.user_role, 'admin_master'::public.user_role])));


--
-- Name: profiles Admins podem ver todos os perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins podem ver todos os perfis" ON public.profiles FOR SELECT USING ((public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::public.user_role, 'admin_master'::public.user_role])));


--
-- Name: arbitrages Operadores veem apenas suas arbitragens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Operadores veem apenas suas arbitragens" ON public.arbitrages FOR SELECT USING (((auth.uid() = user_id) OR (public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::public.user_role, 'admin_master'::public.user_role]))));


--
-- Name: arbitrage_history Usuários autenticados podem criar histórico; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários autenticados podem criar histórico" ON public.arbitrage_history FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: profiles Usuários podem atualizar seu próprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: arbitrages Usuários podem atualizar suas próprias arbitragens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar suas próprias arbitragens" ON public.arbitrages FOR UPDATE USING (((auth.uid() = user_id) OR (public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::public.user_role, 'admin_master'::public.user_role]))));


--
-- Name: arbitrages Usuários podem criar suas próprias arbitragens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar suas próprias arbitragens" ON public.arbitrages FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: arbitrage_history Usuários podem ver histórico de suas arbitragens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver histórico de suas arbitragens" ON public.arbitrage_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.arbitrages
  WHERE ((arbitrages.id = arbitrage_history.arbitrage_id) AND ((arbitrages.user_id = auth.uid()) OR (public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::public.user_role, 'admin_master'::public.user_role])))))));


--
-- Name: profiles Usuários podem ver seu próprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Usuários podem ver sua própria role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver sua própria role" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: arbitrage_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.arbitrage_history ENABLE ROW LEVEL SECURITY;

--
-- Name: arbitrages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.arbitrages ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


