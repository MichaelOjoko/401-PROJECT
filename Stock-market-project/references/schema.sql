-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================
-- ROLES
-- ======================
CREATE TABLE role (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'customer' or 'admin'
    description TEXT
);

INSERT INTO role (name, description)
VALUES ('customer', 'Regular user who can buy/sell stocks'),
       ('admin', 'Administrator who can create stocks and manage market settings')
ON CONFLICT DO NOTHING;

-- ======================
-- USERS
-- ======================
CREATE TABLE app_user (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role_id UUID NOT NULL REFERENCES role(role_id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('active','suspended')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- ======================
-- ACCOUNTS (cash account)
-- ======================
CREATE TABLE account (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE, --if user is deleted delete their accounts
    account_type TEXT CHECK (account_type IN ('cash')) NOT NULL DEFAULT 'cash',
    currency TEXT NOT NULL DEFAULT 'USD',
    cash_balance NUMERIC(18,4) DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- SYMBOLS (stocks)
-- ======================
CREATE TABLE symbol (
    symbol_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    exchange TEXT,
    sector TEXT,
    currency TEXT NOT NULL,
    total_shares NUMERIC(18,4) NOT NULL,
    initial_price NUMERIC(18,4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- POSITIONS (portfolio holdings)
-- ======================
CREATE TABLE position (
    position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    symbol_id UUID NOT NULL REFERENCES symbol(symbol_id) ON DELETE CASCADE,
    quantity NUMERIC(18,4) NOT NULL,
    avg_cost NUMERIC(18,4) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- ORDERS
-- ======================
CREATE TABLE app_order (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    symbol_id UUID NOT NULL REFERENCES symbol(symbol_id) ON DELETE CASCADE,
    side TEXT CHECK (side IN ('buy','sell')) NOT NULL,
    status TEXT CHECK (status IN ('new','canceled','executed')) DEFAULT 'new',
    quantity NUMERIC(18,4) NOT NULL,
    price NUMERIC(18,4) NOT NULL, -- market price at order
    created_at TIMESTAMPTZ DEFAULT NOW(),
    canceled_at TIMESTAMPTZ
);

-- ======================
-- CASH TRANSACTIONS
-- ======================
CREATE TABLE cash_txn (
    txn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('deposit','withdrawal','sale','purchase')) NOT NULL,
    amount NUMERIC(18,4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================
-- MARKET SETTINGS
-- ======================
CREATE TABLE market_settings (
    market_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_open BOOLEAN DEFAULT TRUE,
    open_time TIME DEFAULT '09:30',
    close_time TIME DEFAULT '16:00',
    timezone TEXT DEFAULT 'UTC',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE market_holiday (
    holiday_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date DATE NOT NULL UNIQUE,
    description TEXT
);

-- Indexes
CREATE INDEX idx_user_email ON app_user(email);
CREATE INDEX idx_symbol_ticker ON symbol(ticker);
