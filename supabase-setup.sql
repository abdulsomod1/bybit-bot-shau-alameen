-- ============================================================
-- BYBIT P2P BOT - Supabase Database Setup Script
-- ============================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard -> Project -> SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS TABLE (custom user registry)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email      TEXT UNIQUE NOT NULL,
    name       TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id           UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. BOT SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_settings (
    user_id             UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    theme               TEXT DEFAULT 'dark',
    launch_at_login     BOOLEAN DEFAULT false,
    polling_interval_ms INTEGER DEFAULT 60000,
    show_notifications  BOOLEAN DEFAULT true,
    sound_alerts        BOOLEAN DEFAULT false,
    language            TEXT DEFAULT 'en',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. BOT STATE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_state (
    user_id                UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    status                 TEXT DEFAULT 'stopped',
    message                TEXT,
    last_update            TIMESTAMPTZ,
    last_successful_update TIMESTAMPTZ,
    current_ip            TEXT,
    last_working_ip        TEXT,
    error_count            INTEGER DEFAULT 0,
    update_count           INTEGER DEFAULT 0,
    ip_whitelist_enabled  BOOLEAN DEFAULT false,
    ip_whitelist           TEXT[] DEFAULT '{}',
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. API CREDENTIALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_credentials (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    api_key                 TEXT NOT NULL,
    api_key_masked          TEXT,
    api_secret_encrypted    TEXT,
    api_secret_iv           TEXT,
    has_credentials         BOOLEAN DEFAULT false,
    registered_ip           TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. PRICING RULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_rules (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name                   TEXT NOT NULL,
    direction              TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
    asset                  TEXT NOT NULL DEFAULT 'USDT',
    fiat_currency          TEXT NOT NULL DEFAULT 'USD',
    strategy               TEXT NOT NULL DEFAULT 'match_3rd',
    fixed_price            NUMERIC,
    offset_amount          NUMERIC DEFAULT 0,
    offset_type            TEXT DEFAULT 'percentage' CHECK (offset_type IN ('percentage', 'fixed')),
    min_price              NUMERIC,
    max_price              NUMERIC,
    max_change_percent     NUMERIC DEFAULT 5,
    min_interval_ms        INTEGER DEFAULT 60000,
    max_updates_per_hour   INTEGER DEFAULT 60,
    max_updates_per_day    INTEGER DEFAULT 500,
    price_precision        INTEGER DEFAULT 2,
    max_deviation_percent  NUMERIC DEFAULT 10,
    manual_approval        BOOLEAN DEFAULT false,
    dry_run                BOOLEAN DEFAULT false,
    enabled                BOOLEAN DEFAULT true,
    payment_method_ids     TEXT[],
    target_position        INTEGER,
    price_offset           NUMERIC,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. ADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ads (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ad_id                TEXT,
    account_id           TEXT,
    merchant_id          TEXT,
    direction            TEXT CHECK (direction IN ('BUY', 'SELL', 'Buy', 'Sell')),
    asset                TEXT,
    fiat_currency        TEXT,
    price                TEXT,
    available_quantity   TEXT,
    min_order_amount    TEXT,
    max_order_amount    TEXT,
    status               TEXT,
    last_update_time     TIMESTAMPTZ,
    payment_methods      TEXT[],
    is_selected          BOOLEAN DEFAULT false,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ads_user_ad_unique UNIQUE (user_id, ad_id)
);

-- ============================================================
-- 8. COMPETITOR RANKINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.competitor_rankings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    market_key      TEXT NOT NULL,
    direction       TEXT CHECK (direction IN ('BUY', 'SELL')),
    asset           TEXT,
    fiat_currency   TEXT,
    competitors     JSONB DEFAULT '[]',
    first_ranked    JSONB,
    second_ranked   JSONB,
    third_ranked    JSONB,
    last_refresh    TIMESTAMPTZ,
    data_stale      BOOLEAN DEFAULT false,
    refresh_error   TEXT,
    snapshot_time   TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT rankings_user_market_unique UNIQUE (user_id, market_key)
);

-- ============================================================
-- 9. ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    level          TEXT DEFAULT 'info' CHECK (level IN ('info', 'success', 'warning', 'error', 'debug')),
    category       TEXT,
    message        TEXT NOT NULL,
    details        TEXT,
    ad_id          TEXT,
    previous_value TEXT,
    new_value      TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_api_credentials_user_id ON public.api_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_user_id ON public.pricing_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_user_id ON public.ads(user_id);
CREATE INDEX IF NOT EXISTS idx_competitor_rankings_user_id ON public.competitor_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_settings_user_id ON public.bot_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_state_user_id ON public.bot_state(user_id);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY "Users can view own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- BOT SETTINGS policies
CREATE POLICY "Users can view settings" ON public.bot_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert settings" ON public.bot_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update settings" ON public.bot_settings FOR UPDATE USING (user_id = auth.uid());

-- BOT STATE policies
CREATE POLICY "Users can view bot state" ON public.bot_state FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert bot state" ON public.bot_state FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update bot state" ON public.bot_state FOR UPDATE USING (user_id = auth.uid());

-- API CREDENTIALS policies
CREATE POLICY "Users can view credentials" ON public.api_credentials FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert credentials" ON public.api_credentials FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update credentials" ON public.api_credentials FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete credentials" ON public.api_credentials FOR DELETE USING (user_id = auth.uid());

-- PRICING RULES policies
CREATE POLICY "Users can view rules" ON public.pricing_rules FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert rules" ON public.pricing_rules FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update rules" ON public.pricing_rules FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete rules" ON public.pricing_rules FOR DELETE USING (user_id = auth.uid());

-- ADS policies
CREATE POLICY "Users can view ads" ON public.ads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert ads" ON public.ads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update ads" ON public.ads FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete ads" ON public.ads FOR DELETE USING (user_id = auth.uid());

-- COMPETITOR RANKINGS policies
CREATE POLICY "Users can view rankings" ON public.competitor_rankings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert rankings" ON public.competitor_rankings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update rankings" ON public.competitor_rankings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete rankings" ON public.competitor_rankings FOR DELETE USING (user_id = auth.uid());

-- ACTIVITY LOGS policies
CREATE POLICY "Users can view logs" ON public.activity_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert logs" ON public.activity_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete logs" ON public.activity_logs FOR DELETE USING (user_id = auth.uid());



-- ============================================================
-- SERVICE ROLE BYPASS (server-side operations)
-- ============================================================
CREATE POLICY "SR all on api_credentials" ON public.api_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR all on pricing_rules" ON public.pricing_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR all on ads" ON public.ads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR all on competitor_rankings" ON public.competitor_rankings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR all on activity_logs" ON public.activity_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR all on bot_state" ON public.bot_state FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "SR all on bot_settings" ON public.bot_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS update_bot_settings_updated_at ON public.bot_settings;
CREATE TRIGGER update_bot_settings_updated_at BEFORE UPDATE ON public.bot_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS update_bot_state_updated_at ON public.bot_state;
CREATE TRIGGER update_bot_state_updated_at BEFORE UPDATE ON public.bot_state FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS update_api_credentials_updated_at ON public.api_credentials;
CREATE TRIGGER update_api_credentials_updated_at BEFORE UPDATE ON public.api_credentials FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS update_pricing_rules_updated_at ON public.pricing_rules;
CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS update_ads_updated_at ON public.ads;
CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS update_competitor_rankings_updated_at ON public.competitor_rankings;
CREATE TRIGGER update_competitor_rankings_updated_at BEFORE UPDATE ON public.competitor_rankings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE TRIGGER (for Supabase Auth users)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Uncomment below if using Supabase Auth:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.users TO anon, authenticated, service_role;
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT ALL ON public.bot_settings TO anon, authenticated, service_role;
GRANT ALL ON public.bot_state TO anon, authenticated, service_role;
GRANT ALL ON public.api_credentials TO anon, authenticated, service_role;
GRANT ALL ON public.pricing_rules TO anon, authenticated, service_role;
GRANT ALL ON public.ads TO anon, authenticated, service_role;
GRANT ALL ON public.competitor_rankings TO anon, authenticated, service_role;
GRANT ALL ON public.activity_logs TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

SELECT 'Setup complete!' as status;
