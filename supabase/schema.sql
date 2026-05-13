-- Gold Ticker Live — Supabase Schema
-- Run this in the Supabase SQL Editor (project → SQL Editor → New query).
-- Each table has Row Level Security (RLS) enabled.
-- Policies follow a pattern: public reads are open, writes require auth.
-- ----------------------------------------------------------------------------

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- SHOPS
-- ============================================================
create table if not exists public.shops (
    id              uuid primary key default uuid_generate_v4(),
    name            text not null,
    city            text,
    country         text,
    country_code    text,           -- ISO 3166-1 alpha-2 e.g. 'AE'
    market          text,           -- e.g. 'Dubai Gold Souk'
    category        text,           -- 'retailer' | 'wholesaler' | 'exchange' | ...
    specialties     text[],         -- e.g. ARRAY['24K', 'jewellery', 'coins']
    phone           text,
    website         text,
    address         text,
    latitude        double precision,
    longitude       double precision,
    hours           text,
    details_availability text default 'limited', -- 'full' | 'partial' | 'limited'
    featured        boolean not null default false,
    verified        boolean not null default false,
    confidence      int,            -- 0-100 completeness/confidence score
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    created_by      text            -- email of admin who created
);

alter table public.shops enable row level security;

-- Public: anyone can read verified shops
create policy "Public read verified shops"
    on public.shops for select
    using (verified = true);

-- Authenticated admin users can read all shops
create policy "Admin read all shops"
    on public.shops for select
    to authenticated
    using (true);

-- Only authenticated users may insert/update/delete
create policy "Admin insert shops"
    on public.shops for insert
    to authenticated
    with check (true);

create policy "Admin update shops"
    on public.shops for update
    to authenticated
    using (true);

create policy "Admin delete shops"
    on public.shops for delete
    to authenticated
    using (true);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger shops_set_updated_at
    before update on public.shops
    for each row execute procedure public.set_updated_at();

-- Extra columns added for admin form fields not in original schema
alter table public.shops add column if not exists name_ar    text;
alter table public.shops add column if not exists area       text;
alter table public.shops add column if not exists address_ar text;
alter table public.shops add column if not exists rating     numeric;

-- ============================================================
-- SHOP SUBMISSIONS
-- ============================================================
-- Public intake queue for content/submit-shop/. Rows are not
-- public directory listings until an authenticated admin reviews
-- and copies/approves the details into public.shops.
create table if not exists public.shop_submissions (
    id              uuid primary key default uuid_generate_v4(),
    shop_name       text not null,
    owner_name      text,
    contact_email   text not null,
    contact_phone   text,
    country_code    text not null,
    city            text not null,
    market          text,
    website         text,
    specialty       text,
    notes           text,
    status          text not null default 'pending'
                    check (status in ('pending', 'reviewing', 'approved', 'rejected', 'duplicate')),
    source          text not null default 'public-submit-shop',
    page_path       text,
    reviewed_by     text,
    reviewed_at     timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_shop_submissions_status
    on public.shop_submissions(status, created_at desc);
create index if not exists idx_shop_submissions_country_city
    on public.shop_submissions(country_code, city);

alter table public.shop_submissions enable row level security;

-- Anyone may submit a shop suggestion, but cannot read the queue.
create policy "Public insert shop submissions"
    on public.shop_submissions for insert
    with check (
        status = 'pending'
        and char_length(shop_name) between 2 and 120
        and char_length(contact_email) between 5 and 160
        and char_length(country_code) between 2 and 3
        and char_length(city) between 2 and 100
    );

-- Authenticated admins can review and manage the queue.
create policy "Admin read shop submissions"
    on public.shop_submissions for select
    to authenticated
    using (true);

create policy "Admin update shop submissions"
    on public.shop_submissions for update
    to authenticated
    using (true);

create policy "Admin delete shop submissions"
    on public.shop_submissions for delete
    to authenticated
    using (true);

create trigger shop_submissions_set_updated_at
    before update on public.shop_submissions
    for each row execute procedure public.set_updated_at();

-- ============================================================
-- SITE SETTINGS (single-row config, JSON value)
-- ============================================================
create table if not exists public.site_settings (
    id          text primary key default 'default',
    value       jsonb not null default '{}',
    updated_at  timestamptz not null default now(),
    updated_by  text
);

alter table public.site_settings enable row level security;

-- Anyone can read settings (public site needs feature flags, site name, etc.)
create policy "Public read settings"
    on public.site_settings for select
    using (true);

-- Only authenticated admins can write settings
create policy "Admin insert settings"
    on public.site_settings for insert
    to authenticated
    with check (true);

create policy "Admin update settings"
    on public.site_settings for update
    to authenticated
    using (true);

create trigger site_settings_set_updated_at
    before update on public.site_settings
    for each row execute procedure public.set_updated_at();

-- Seed a default row so upsert always works
insert into public.site_settings (id, value) values ('default', '{}')
on conflict (id) do nothing;

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table if not exists public.audit_logs (
    id          uuid primary key default uuid_generate_v4(),
    timestamp   timestamptz not null default now(),
    actor       text not null,      -- email of admin who performed the action
    action      text not null,      -- 'create' | 'update' | 'delete' | 'login' | ...
    entity_type text not null,      -- 'shop' | 'user' | ...
    entity_id   text,
    changes     jsonb,
    ip_address  text,
    user_agent  text
);

alter table public.audit_logs enable row level security;

-- Only authenticated admins can read audit logs
create policy "Admin read audit logs"
    on public.audit_logs for select
    to authenticated
    using (true);

-- Audit log rows are inserted by the server using the service-role key
-- (bypasses RLS) — no client-facing insert policy needed.

-- ============================================================
-- USER PROFILES (extends Supabase auth.users)
-- ============================================================
-- auth.users is managed by Supabase. We store extra role/profile data here.
create table if not exists public.user_profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text unique not null,
    name        text,
    role        text not null default 'viewer', -- 'viewer' | 'editor' | 'admin'
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Users can read their own profile
create policy "Users read own profile"
    on public.user_profiles for select
    to authenticated
    using (id = auth.uid());

-- Admins can read all profiles
-- NOTE: implement with a helper function or Supabase custom claims JWT for production
create policy "Admin read all profiles"
    on public.user_profiles for select
    to authenticated
    using (
        exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create policy "Admin update profiles"
    on public.user_profiles for update
    to authenticated
    using (
        exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create trigger user_profiles_set_updated_at
    before update on public.user_profiles
    for each row execute procedure public.set_updated_at();

-- ============================================================
-- GOLD PRICES (used by @GoldTickerLive posting system)
-- ============================================================
-- Stores every gold price fetched by the automated posting workflows.
-- The service role key bypasses RLS, so no public policies are needed for the bot.

create table if not exists public.gold_prices (
    id          uuid primary key default uuid_generate_v4(),
    spot_usd    numeric not null,
    change_pct  numeric,
    open_usd    numeric,
    high_usd    numeric,
    low_usd     numeric,
    k24_aed     numeric,
    k22_aed     numeric,
    k21_aed     numeric,
    fetched_at  timestamptz not null default now()
);

alter table public.gold_prices enable row level security;

-- ============================================================
-- FETCH LOGS (used by @GoldTickerLive posting system)
-- ============================================================
-- Logs every workflow run — successes, skips, and failures.
-- Used for duplicate detection, spike rate-limiting, and health monitoring.

create table if not exists public.fetch_logs (
    id              uuid primary key default uuid_generate_v4(),
    status          text not null,          -- 'success', 'error', 'skipped'
    mode            text not null,          -- 'hourly', 'market_event', 'spike_alert', 'health_check'
    price_usd       numeric,
    tweet_id        text,
    error_message   text,
    created_at      timestamptz not null default now()
);

alter table public.fetch_logs enable row level security;

-- ============================================================
-- PRICE SNAPSHOTS (phase 2 reliability foundation)
-- ============================================================
create table if not exists public.price_snapshots (
    id                  uuid primary key default uuid_generate_v4(),
    xau_usd_per_oz      numeric not null,
    xau_aed_per_gram    numeric,
    currency            text not null default 'USD',
    source_provider     text not null,
    provider_chain      text,
    timestamp_utc       timestamptz not null,
    fetched_at_utc      timestamptz not null,
    freshness_seconds   int,
    is_fresh            boolean not null default false,
    is_fallback         boolean not null default false,
    is_market_open      boolean,
    raw_payload_hash    text not null,
    created_at          timestamptz not null default now()
);

alter table public.price_snapshots enable row level security;

create unique index if not exists idx_price_snapshots_unique_payload
    on public.price_snapshots(timestamp_utc, source_provider, raw_payload_hash);
create index if not exists idx_price_snapshots_timestamp_desc
    on public.price_snapshots(timestamp_utc desc);
create index if not exists idx_price_snapshots_provider_timestamp
    on public.price_snapshots(source_provider, timestamp_utc desc);

drop policy if exists "Public read price snapshots" on public.price_snapshots;
create policy "Public read price snapshots"
    on public.price_snapshots for select
    using (true);

drop policy if exists "Admin insert price snapshots" on public.price_snapshots;
create policy "Admin insert price snapshots"
    on public.price_snapshots for insert
    to authenticated
    with check (true);

drop policy if exists "Admin update price snapshots" on public.price_snapshots;
create policy "Admin update price snapshots"
    on public.price_snapshots for update
    to authenticated
    using (true);

drop policy if exists "Admin delete price snapshots" on public.price_snapshots;
create policy "Admin delete price snapshots"
    on public.price_snapshots for delete
    to authenticated
    using (true);

-- ============================================================
-- PROVIDER RUNS (phase 2 provider telemetry)
-- ============================================================
create table if not exists public.provider_runs (
    id                  uuid primary key default uuid_generate_v4(),
    provider_name       text not null,
    status              text not null,
    latency_ms          int,
    http_status         int,
    error_code          text,
    error_message       text,
    freshness_seconds   int,
    circuit_state       text,
    created_at          timestamptz not null default now()
);

alter table public.provider_runs enable row level security;

create index if not exists idx_provider_runs_created_desc
    on public.provider_runs(created_at desc);
create index if not exists idx_provider_runs_provider_created
    on public.provider_runs(provider_name, created_at desc);
create index if not exists idx_provider_runs_status_created
    on public.provider_runs(status, created_at desc);

drop policy if exists "Admin read provider runs" on public.provider_runs;
create policy "Admin read provider runs"
    on public.provider_runs for select
    to authenticated
    using (true);

drop policy if exists "Admin insert provider runs" on public.provider_runs;
create policy "Admin insert provider runs"
    on public.provider_runs for insert
    to authenticated
    with check (true);

drop policy if exists "Admin update provider runs" on public.provider_runs;
create policy "Admin update provider runs"
    on public.provider_runs for update
    to authenticated
    using (true);

drop policy if exists "Admin delete provider runs" on public.provider_runs;
create policy "Admin delete provider runs"
    on public.provider_runs for delete
    to authenticated
    using (true);

-- ============================================================
-- PROVIDER HEALTH (phase 2 provider transparency)
-- ============================================================
create table if not exists public.provider_health (
    provider_name       text primary key,
    last_success_at     timestamptz,
    last_failure_at     timestamptz,
    success_rate_24h    numeric,
    avg_latency_24h     numeric,
    current_status      text,
    circuit_state       text,
    updated_at          timestamptz not null default now()
);

alter table public.provider_health enable row level security;

create index if not exists idx_provider_health_status_updated
    on public.provider_health(current_status, updated_at desc);

drop policy if exists "Public read provider health" on public.provider_health;
create policy "Public read provider health"
    on public.provider_health for select
    using (true);

drop policy if exists "Admin insert provider health" on public.provider_health;
create policy "Admin insert provider health"
    on public.provider_health for insert
    to authenticated
    with check (true);

drop policy if exists "Admin update provider health" on public.provider_health;
create policy "Admin update provider health"
    on public.provider_health for update
    to authenticated
    using (true);

drop policy if exists "Admin delete provider health" on public.provider_health;
create policy "Admin delete provider health"
    on public.provider_health for delete
    to authenticated
    using (true);

-- ============================================================
-- PRICING OVERRIDES (admin manual price adjustments)
-- ============================================================
create table if not exists public.pricing_overrides (
    id              uuid primary key default uuid_generate_v4(),
    karat           text not null,              -- '24', '22', '21', '20', '18'
    currency        text not null default 'AED',-- 'USD', 'AED', 'SAR', 'KWD', etc.
    unit            text not null default 'gram',-- 'gram', 'oz', 'kg', 'tola'
    override_price  numeric not null,
    reason          text,
    expires_at      timestamptz,
    active          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    created_by      text
);

alter table public.pricing_overrides enable row level security;

create policy "Admin read pricing overrides"
    on public.pricing_overrides for select
    to authenticated
    using (true);

create policy "Admin insert pricing overrides"
    on public.pricing_overrides for insert
    to authenticated
    with check (true);

create policy "Admin update pricing overrides"
    on public.pricing_overrides for update
    to authenticated
    using (true);

create policy "Admin delete pricing overrides"
    on public.pricing_overrides for delete
    to authenticated
    using (true);

create trigger pricing_overrides_set_updated_at
    before update on public.pricing_overrides
    for each row execute procedure public.set_updated_at();

-- ============================================================
-- ORDERS (gold purchase orders)
-- ============================================================
create table if not exists public.orders (
    id              text primary key,           -- e.g. 'ORD-20260412-001'
    items           jsonb not null default '[]',
    pricing         jsonb not null default '{}',
    gold_spot_at_order numeric,
    fx_rate_at_order   numeric,
    customer        jsonb not null default '{}',
    status          text not null default 'pending',
    status_history  jsonb not null default '[]',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    created_by      text
);

alter table public.orders enable row level security;

create policy "Admin read orders"
    on public.orders for select
    to authenticated
    using (true);

create policy "Admin insert orders"
    on public.orders for insert
    to authenticated
    with check (true);

create policy "Admin update orders"
    on public.orders for update
    to authenticated
    using (true);

create policy "Admin delete orders"
    on public.orders for delete
    to authenticated
    using (true);

create trigger orders_set_updated_at
    before update on public.orders
    for each row execute procedure public.set_updated_at();

-- ============================================================
-- CONTENT POSTS (blog / educational articles)
-- ============================================================
create table if not exists public.content_posts (
    id              uuid primary key default uuid_generate_v4(),
    title           text not null,
    title_ar        text,
    slug            text unique,
    body            text,
    body_ar         text,
    excerpt         text,
    category        text,
    tags            text[],
    status          text not null default 'draft', -- 'draft', 'published'
    publish_date    text,                          -- ISO date string YYYY-MM-DD
    read_time       int,
    author          text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.content_posts enable row level security;

-- Published posts are public
create policy "Public read published posts"
    on public.content_posts for select
    using (status = 'published');

create policy "Admin read all posts"
    on public.content_posts for select
    to authenticated
    using (true);

create policy "Admin insert posts"
    on public.content_posts for insert
    to authenticated
    with check (true);

create policy "Admin update posts"
    on public.content_posts for update
    to authenticated
    using (true);

create policy "Admin delete posts"
    on public.content_posts for delete
    to authenticated
    using (true);

create trigger content_posts_set_updated_at
    before update on public.content_posts
    for each row execute procedure public.set_updated_at();

-- ============================================================
-- SOCIAL POSTS (post generation history)
-- ============================================================
create table if not exists public.social_posts (
    id              uuid primary key default uuid_generate_v4(),
    template        text,                       -- 'daily_update', 'price_alert', 'custom', etc.
    language        text,                       -- 'en', 'ar'
    platform        text,                       -- 'twitter', 'instagram', etc.
    text            text,
    generated_at    bigint,                     -- JS timestamp (Date.now())
    created_at      timestamptz not null default now()
);

alter table public.social_posts enable row level security;

create policy "Admin read social posts"
    on public.social_posts for select
    to authenticated
    using (true);

create policy "Admin insert social posts"
    on public.social_posts for insert
    to authenticated
    with check (true);

create policy "Admin delete social posts"
    on public.social_posts for delete
    to authenticated
    using (true);

-- ============================================================
-- ANALYTICS EVENTS (client-side event tracking)
-- ============================================================
create table if not exists public.analytics_events (
    id              uuid primary key default uuid_generate_v4(),
    event           text not null,              -- 'pageview', 'click', 'search', 'error', 'order'
    page            text,
    session_id      text,
    ts              bigint,                     -- JS timestamp (Date.now())
    properties      jsonb,
    created_at      timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

create policy "Admin read analytics events"
    on public.analytics_events for select
    to authenticated
    using (true);

create policy "Admin insert analytics events"
    on public.analytics_events for insert
    to authenticated
    with check (true);

create policy "Admin delete analytics events"
    on public.analytics_events for delete
    to authenticated
    using (true);

-- ============================================================
-- API CALL LOGS (client-side API monitoring)
-- ============================================================
create table if not exists public.api_call_logs (
    id              uuid primary key default uuid_generate_v4(),
    endpoint        text,
    status          text,
    response_time   int,
    success         boolean,
    error_message   text,
    ts              bigint,                     -- JS timestamp (Date.now())
    created_at      timestamptz not null default now()
);

alter table public.api_call_logs enable row level security;

create policy "Admin read api call logs"
    on public.api_call_logs for select
    to authenticated
    using (true);

create policy "Admin insert api call logs"
    on public.api_call_logs for insert
    to authenticated
    with check (true);

create policy "Admin delete api call logs"
    on public.api_call_logs for delete
    to authenticated
    using (true);
