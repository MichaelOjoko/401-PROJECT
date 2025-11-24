--
-- PostgreSQL database dump
--

\restrict XDRuh8xSmtA0C1tOYQlGzxWebs7NJgH0CRuaftplDHkdKZesvLd6biFj5Ednhgb

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account (
    account_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    account_type text DEFAULT 'cash'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    cash_balance numeric(18,4) DEFAULT 0,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT account_account_type_check CHECK ((account_type = 'cash'::text))
);


ALTER TABLE public.account OWNER TO postgres;

--
-- Name: app_order; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_order (
    order_id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    symbol_id uuid NOT NULL,
    side text NOT NULL,
    status text DEFAULT 'new'::text,
    quantity numeric(18,4) NOT NULL,
    price numeric(18,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    canceled_at timestamp with time zone,
    CONSTRAINT app_order_side_check CHECK ((side = ANY (ARRAY['buy'::text, 'sell'::text]))),
    CONSTRAINT app_order_status_check CHECK ((status = ANY (ARRAY['new'::text, 'canceled'::text, 'executed'::text])))
);


ALTER TABLE public.app_order OWNER TO postgres;

--
-- Name: app_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_user (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    role_id uuid NOT NULL,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    last_login_at timestamp with time zone,
    CONSTRAINT app_user_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text])))
);


ALTER TABLE public.app_user OWNER TO postgres;

--
-- Name: cash_txn; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_txn (
    txn_id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    type text NOT NULL,
    amount numeric(18,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cash_txn_type_check CHECK ((type = ANY (ARRAY['deposit'::text, 'withdrawal'::text, 'sale'::text, 'purchase'::text])))
);


ALTER TABLE public.cash_txn OWNER TO postgres;

--
-- Name: market_holiday; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.market_holiday (
    holiday_id uuid DEFAULT gen_random_uuid() NOT NULL,
    holiday_date date NOT NULL,
    description text,
    session_type text DEFAULT 'closed'::text NOT NULL
);


ALTER TABLE public.market_holiday OWNER TO postgres;

--
-- Name: market_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.market_schedule (
    day_index integer NOT NULL,
    day_name text NOT NULL,
    regular_open time without time zone,
    regular_close time without time zone,
    pre_open time without time zone,
    after_close time without time zone,
    notes text
);


ALTER TABLE public.market_schedule OWNER TO postgres;

--
-- Name: market_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.market_settings (
    market_id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_open boolean DEFAULT true,
    open_time time without time zone DEFAULT '09:30:00'::time without time zone,
    close_time time without time zone DEFAULT '16:00:00'::time without time zone,
    timezone text DEFAULT 'UTC'::text,
    last_updated timestamp with time zone DEFAULT now()
);


ALTER TABLE public.market_settings OWNER TO postgres;

--
-- Name: market_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.market_state (
    id integer DEFAULT 1 NOT NULL,
    manual_override boolean DEFAULT false NOT NULL,
    manual_is_open boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.market_state OWNER TO postgres;

--
-- Name: position; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."position" (
    position_id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    symbol_id uuid NOT NULL,
    quantity numeric(18,4) NOT NULL,
    avg_cost numeric(18,4) NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public."position" OWNER TO postgres;

--
-- Name: role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role (
    role_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public.role OWNER TO postgres;

--
-- Name: symbol; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.symbol (
    symbol_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticker text NOT NULL,
    name text NOT NULL,
    exchange text,
    sector text,
    currency text NOT NULL,
    total_shares numeric(18,4) NOT NULL,
    initial_price numeric(18,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.symbol OWNER TO postgres;

--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (account_id);


--
-- Name: app_order app_order_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_order
    ADD CONSTRAINT app_order_pkey PRIMARY KEY (order_id);


--
-- Name: app_user app_user_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_email_key UNIQUE (email);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (user_id);


--
-- Name: cash_txn cash_txn_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_txn
    ADD CONSTRAINT cash_txn_pkey PRIMARY KEY (txn_id);


--
-- Name: market_holiday market_holiday_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_holiday
    ADD CONSTRAINT market_holiday_holiday_date_key UNIQUE (holiday_date);


--
-- Name: market_holiday market_holiday_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_holiday
    ADD CONSTRAINT market_holiday_pkey PRIMARY KEY (holiday_id);


--
-- Name: market_schedule market_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_schedule
    ADD CONSTRAINT market_schedule_pkey PRIMARY KEY (day_index);


--
-- Name: market_settings market_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_settings
    ADD CONSTRAINT market_settings_pkey PRIMARY KEY (market_id);


--
-- Name: market_state market_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_state
    ADD CONSTRAINT market_state_pkey PRIMARY KEY (id);


--
-- Name: position position_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_pkey PRIMARY KEY (position_id);


--
-- Name: role role_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_name_key UNIQUE (name);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (role_id);


--
-- Name: symbol symbol_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.symbol
    ADD CONSTRAINT symbol_pkey PRIMARY KEY (symbol_id);


--
-- Name: symbol symbol_ticker_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.symbol
    ADD CONSTRAINT symbol_ticker_key UNIQUE (ticker);


--
-- Name: idx_symbol_ticker; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_symbol_ticker ON public.symbol USING btree (ticker);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_email ON public.app_user USING btree (email);


--
-- Name: account account_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(user_id) ON DELETE CASCADE;


--
-- Name: app_order app_order_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_order
    ADD CONSTRAINT app_order_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(account_id) ON DELETE CASCADE;


--
-- Name: app_order app_order_symbol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_order
    ADD CONSTRAINT app_order_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbol(symbol_id) ON DELETE CASCADE;


--
-- Name: app_user app_user_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(role_id) ON DELETE SET NULL;


--
-- Name: cash_txn cash_txn_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_txn
    ADD CONSTRAINT cash_txn_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(account_id) ON DELETE CASCADE;


--
-- Name: position position_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(account_id) ON DELETE CASCADE;


--
-- Name: position position_symbol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbol(symbol_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict XDRuh8xSmtA0C1tOYQlGzxWebs7NJgH0CRuaftplDHkdKZesvLd6biFj5Ednhgb

