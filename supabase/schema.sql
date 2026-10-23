-- BYBIT P2P BOT — Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
create extension if not exists "uuid-ossp";

-- USERS (local app users — NOT Supabase Auth)
-- This table holds all app users. Single-user desktop app uses a fixed GUEST_USER_ID.
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PROFILES (extends users)
create table if not exists public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- BOT SETTINGS (per-user app configuration)
create table if not exists public.bot_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  polling_interval_ms integer not null default 60000,
  theme text not null default 'dark',
  launch_at_login boolean not null default false,
  show_notifications boolean not null default true,
  sound_alerts boolean not null default false,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_setting_per_user unique (user_id)
);
create index idx_bot_settings_user_id on public.bot_settings(user_id);
-- PRICING RULES
create table if not exists public.pricing_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  direction text not null check (direction in ('BUY', 'SELL')),
  asset text not null default 'USDT',
  fiat_currency text not null default 'USD',
  strategy text not null,
  fixed_price real,
  offset_amount real not null default 0,
  offset_type text not null default 'percentage' check (offset_type in ('percentage', 'fixed')),
  min_price real,
  max_price real,
  max_change_percent real not null default 5,
  min_interval_ms integer not null default 60000,
  max_updates_per_hour integer not null default 10,
  max_updates_per_day integer not null default 100,
  price_precision integer not null default 2,
  max_deviation_percent real not null default 10,
  manual_approval boolean not null default true,
  dry_run boolean not null default true,
  enabled boolean not null default false,
  payment_method_ids jsonb,
  target_position integer,
  price_offset real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pricing_rules_user_id on public.pricing_rules(user_id);
create index idx_pricing_rules_enabled on public.pricing_rules(user_id, enabled);
alter table public.pricing_rules enable row level security;
create policy "Pricing rules access" on public.pricing_rules for all using (true);

-- ADS (cached Bybit advertisement data)
create table if not exists public.ads (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  account_id text,
  direction text not null check (direction in ('BUY', 'SELL')),
  asset text not null,
  fiat_currency text not null,
  price text,
  available_quantity text,
  min_order_amount text,
  max_order_amount text,
  status text,
  last_update_time text,
  payment_methods jsonb,
  created_time text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_ads_user_id on public.ads(user_id);
create index idx_ads_selected on public.ads(user_id, is_selected);
alter table public.ads enable row level security;
create policy "Ads access" on public.ads for all using (true);

-- COMPETITOR RANKINGS (market data snapshots)
create table if not exists public.competitor_rankings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  market_key text not null,
  direction text not null,
  asset text not null,
  fiat_currency text not null,
  competitors jsonb not null default '[]',
  first_ranked jsonb,
  second_ranked jsonb,
  third_ranked jsonb,
  last_refresh timestamptz,
  data_stale boolean not null default true,
  refresh_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_ranking_per_market unique (user_id, market_key)
);
create index idx_rankings_user_id on public.competitor_rankings(user_id);
create index idx_rankings_market_key on public.competitor_rankings(user_id, market_key);
alter table public.competitor_rankings enable row level security;
create policy "Users access own rankings" on public.competitor_rankings for all using (auth.uid() = user_id);

-- ACTIVITY LOGS (bot event history)
create table if not exists public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('info', 'success', 'warning', 'error', 'debug')),
  category text not null,
  message text not null,
  details text,
  ad_id text,
  previous_value text,
  new_value text,
  created_at timestamptz not null default now()
);
-- ============================================================
-- AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- Apply trigger to all tables that have updated_at
create trigger bot_settings_updated_at before update on public.bot_settings for each row execute function public.handle_updated_at();
create trigger api_credentials_updated_at before update on public.api_credentials for each row execute function public.handle_updated_at();
create trigger pricing_rules_updated_at before update on public.pricing_rules for each row execute function public.handle_updated_at();
create trigger ads_updated_at before update on public.ads for each row execute function public.handle_updated_at();
create trigger competitor_rankings_updated_at before update on public.competitor_rankings for each row execute function public.handle_updated_at();
create trigger bot_state_updated_at before update on public.bot_state for each row execute function public.handle_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE + DEFAULT ROWS ON USER SIGNUP
-- ============================================================
-- competitor_rankings FK is still auth.users — fix it
alter table public.competitor_rankings drop constraint if exists competitor_rankings_user_id_fkey;
alter table public.competitor_rankings add constraint competitor_rankings_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;

-- activity_logs FK fix
alter table public.activity_logs drop constraint if exists activity_logs_user_id_fkey;
alter table public.activity_logs add constraint activity_logs_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;

-- bot_state FK fix
alter table public.bot_state drop constraint if exists bot_state_user_id_fkey;
alter table public.bot_state add constraint bot_state_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;

-- api_credentials FK fix
alter table public.api_credentials drop constraint if exists api_credentials_user_id_fkey;
alter table public.api_credentials add constraint api_credentials_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;

-- Replace ALL auth.uid() based RLS policies with permissive policies (service role bypasses RLS anyway)
-- Remove broken policies that reference auth.users / auth.uid()
drop policy if exists "Users manage own pricing rules" on public.pricing_rules;
drop policy if exists "Pricing rules access" on public.pricing_rules;
drop policy if exists "Users access own ads" on public.ads;
drop policy if exists "Ads access" on public.ads;
drop policy if exists "Competitor rankings access" on public.competitor_rankings;
drop policy if exists "Users read own competitor rankings" on public.competitor_rankings;
drop policy if exists "Users read own logs" on public.activity_logs;
drop policy if exists "Users insert own logs" on public.activity_logs;
drop policy if exists "Users manage own bot state" on public.bot_state;
drop policy if exists "Users manage own bot settings" on public.bot_settings;
drop policy if exists "Users access own credentials" on public.api_credentials;
drop policy if exists "Profiles access" on public.profiles;

-- Create permissive RLS policies (service role bypasses RLS, but anon key needs something)
create policy "Public access" on public.pricing_rules for all using (true);
create policy "Public access" on public.ads for all using (true);
create policy "Public access" on public.competitor_rankings for all using (true);
create policy "Public access" on public.activity_logs for all using (true);
create policy "Public access" on public.bot_state for all using (true);
create policy "Public access" on public.bot_settings for all using (true);
create policy "Public access" on public.api_credentials for all using (true);
create policy "Public access" on public.profiles for all using (true);

-- Replace the auth.users trigger with a public.users trigger
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name) values (new.id, new.email, new.raw_user_meta_data->>'name');
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.bot_settings (user_id) values (new.id);
  insert into public.api_credentials (user_id) values (new.id);
  insert into public.bot_state (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_public_user_created
  after insert on public.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ============================================================
-- SECURITY NOTES
-- ============================================================
-- 1. api_secret_encrypted = AES-256-GCM ciphertext (base64-encoded).
--    Decryption key lives ONLY in RENDER_SERVICE_ENCRYPTION_KEY env var on Render.
--    The key NEVER leaves the Render server and NEVER touches the browser.
-- 2. RLS policies are permissive (service role bypasses RLS in server middleware).
--    This is a single-user desktop app using SERVICE_ROLE_KEY directly.
-- 3. public.users is the user table (NOT auth.users) for this app.
-- 4. GUEST_USER_ID env var controls the single desktop app user.
-- ============================================================