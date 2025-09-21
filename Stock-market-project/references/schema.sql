-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ROLE
CREATE TABLE role (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- USER
CREATE TABLE app_user (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role_id UUID REFERENCES role(role_id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('active','suspended')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- ACCOUNT
CREATE TABLE account (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    account_type TEXT CHECK (account_type IN ('cash','margin')) NOT NULL,
    currency TEXT NOT NULL,
    cash_balance NUMERIC(18,4) DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SYMBOL
CREATE TABLE symbol (
    symbol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    exchange TEXT,
    sector TEXT,
    currency TEXT NOT NULL
);

-- POSITION
CREATE TABLE position (
    position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    symbol_id UUID NOT NULL REFERENCES symbol(symbol_id) ON DELETE CASCADE,
    quantity NUMERIC(18,4) NOT NULL,
    avg_cost NUMERIC(18,4) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER
CREATE TABLE app_order (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    symbol_id UUID NOT NULL REFERENCES symbol(symbol_id) ON DELETE CASCADE,
    side TEXT CHECK (side IN ('buy','sell')) NOT NULL,
    type TEXT CHECK (type IN ('market','limit','stop','stop_limit')) NOT NULL,
    tif TEXT CHECK (tif IN ('DAY','GTC')),
    status TEXT CHECK (status IN ('new','partially_filled','filled','canceled','rejected')) DEFAULT 'new',
    quantity NUMERIC(18,4) NOT NULL,
    limit_price NUMERIC(18,4),
    stop_price NUMERIC(18,4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ
);

-- EXECUTION
CREATE TABLE execution (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES app_order(order_id) ON DELETE CASCADE,
    symbol_id UUID NOT NULL REFERENCES symbol(symbol_id),
    quantity NUMERIC(18,4) NOT NULL,
    price NUMERIC(18,4) NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    venue TEXT
);

-- CASH_TXN
CREATE TABLE cash_txn (
    txn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('deposit','withdrawal','fee','dividend','interest')) NOT NULL,
    amount NUMERIC(18,4) NOT NULL,
    currency TEXT NOT NULL,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STATEMENT
CREATE TABLE statement (
    statement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    storage_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WATCHLIST
CREATE TABLE watchlist (
    watchlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WATCHLIST_ITEM
CREATE TABLE watchlist_item (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID NOT NULL REFERENCES watchlist(watchlist_id) ON DELETE CASCADE,
    symbol_id UUID NOT NULL REFERENCES symbol(symbol_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT_LOG
CREATE TABLE audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_user(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_email ON app_user(email);
CREATE INDEX idx_symbol_ticker ON symbol(ticker);
CREATE INDEX idx_order_status ON app_order(status);
