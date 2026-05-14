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
-- PHASE 7: SHOPS DIRECTORY BUSINESS TABLES
-- ============================================================
create table if not exists public.market_clusters (
    id                          uuid primary key default uuid_generate_v4(),
    slug                        text unique not null,
    name                        text not null,
    country_code                text not null,
    city                        text,
    area                        text,
    notes                       text,
    source                      text not null default 'editorial',
    confidence                  int not null default 50,
    contact_completeness_score  int not null default 0,
    verified_at                 timestamptz,
    verification_method         text,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now()
);

create table if not exists public.shop_listings (
    id                          uuid primary key default uuid_generate_v4(),
    slug                        text unique not null,
    market_cluster_id           uuid references public.market_clusters(id) on delete set null,
    name                        text not null,
    name_ar                     text,
    country_code                text not null,
    city                        text,
    category                    text,
    listing_type                text not null default 'pending_unverified'
                                -- verified_shop: manually verified shop profile
                                -- market_cluster: area-level souk/market reference
                                -- sponsor: paid placement slot
                                -- pending_unverified: submitted/listed but not verified yet
                                check (listing_type in ('verified_shop', 'market_cluster', 'sponsor', 'pending_unverified')),
    status                      text not null default 'active'
                                check (status in ('active', 'paused', 'archived', 'pending')),
    phone                       text,
    whatsapp                    text,
    email                       text,
    website                     text,
    address                     text,
    specialties                 text[],
    source                      text not null default 'editorial',
    confidence                  int not null default 50,
    contact_completeness_score  int not null default 0,
    verified_at                 timestamptz,
    verification_method         text,
    sponsored                   boolean not null default false,
    sponsored_rank              int,
    notes                       text,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now()
);

create table if not exists public.shop_claims (
    id                  uuid primary key default uuid_generate_v4(),
    shop_listing_id     uuid not null references public.shop_listings(id) on delete cascade,
    claimant_name       text not null,
    claimant_email      text not null,
    claimant_phone      text,
    claim_note          text,
    status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected', 'needs_info')),
    reviewed_by         text,
    reviewed_at         timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create table if not exists public.shop_leads (
    id                  uuid primary key default uuid_generate_v4(),
    shop_listing_id     uuid not null references public.shop_listings(id) on delete cascade,
    lead_type           text not null default 'inquiry'
                        check (lead_type in ('call', 'whatsapp', 'website', 'inquiry', 'visit')),
    name                text,
    email               text,
    phone               text,
    message             text,
    source_path         text,
    status              text not null default 'new'
                        check (status in ('new', 'contacted', 'qualified', 'won', 'lost', 'ignored')),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create table if not exists public.sponsored_placements (
    id                  uuid primary key default uuid_generate_v4(),
    slot                text not null default 'shops_directory',
    shop_listing_id     uuid not null references public.shop_listings(id) on delete cascade,
    country_code        text,
    city                text,
    rank                int not null default 100,
    starts_at           timestamptz not null default now(),
    ends_at             timestamptz,
    disclosure_label    text not null default 'Sponsored',
    active              boolean not null default true,
    notes               text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create table if not exists public.shop_verification_logs (
    id                  uuid primary key default uuid_generate_v4(),
    shop_listing_id     uuid not null references public.shop_listings(id) on delete cascade,
    action              text not null
                        check (action in ('submitted', 'verified', 'unverified', 'updated', 'rejected')),
    verification_method text,
    source              text,
    confidence          int,
    actor               text,
    notes               text,
    created_at          timestamptz not null default now()
);

create table if not exists public.shop_click_events (
    id                  uuid primary key default uuid_generate_v4(),
    shop_listing_id     uuid not null references public.shop_listings(id) on delete cascade,
    event_type          text not null
                        check (event_type in ('call', 'whatsapp', 'website', 'directions', 'share', 'save')),
    source_path         text,
    user_agent          text,
    ip_hash             text,
    created_at          timestamptz not null default now()
);

create index if not exists idx_market_clusters_country_city
    on public.market_clusters(country_code, city);
create index if not exists idx_shop_listings_country_city
    on public.shop_listings(country_code, city);
create index if not exists idx_shop_listings_listing_type
    on public.shop_listings(listing_type, status);
create index if not exists idx_shop_claims_status
    on public.shop_claims(status, created_at desc);
create index if not exists idx_shop_leads_status
    on public.shop_leads(status, created_at desc);
create index if not exists idx_sponsored_placements_slot
    on public.sponsored_placements(slot, active, rank);
create index if not exists idx_shop_click_events_shop_created
    on public.shop_click_events(shop_listing_id, created_at desc);

alter table public.market_clusters enable row level security;
alter table public.shop_listings enable row level security;
alter table public.shop_claims enable row level security;
alter table public.shop_leads enable row level security;
alter table public.sponsored_placements enable row level security;
alter table public.shop_verification_logs enable row level security;
alter table public.shop_click_events enable row level security;

drop policy if exists "Public read active market clusters" on public.market_clusters;
create policy "Public read active market clusters"
    on public.market_clusters for select
    using (true);

drop policy if exists "Public read active shop listings" on public.shop_listings;
create policy "Public read active shop listings"
    on public.shop_listings for select
    using (status = 'active');

drop policy if exists "Public read active sponsored placements" on public.sponsored_placements;
create policy "Public read active sponsored placements"
    on public.sponsored_placements for select
    using (active = true and (ends_at is null or ends_at >= now()));

drop policy if exists "Public insert shop claims" on public.shop_claims;
create policy "Public insert shop claims"
    on public.shop_claims for insert
    with check (status = 'pending');

drop policy if exists "Public insert shop leads" on public.shop_leads;
create policy "Public insert shop leads"
    on public.shop_leads for insert
    with check (status = 'new');

drop policy if exists "Public insert shop click events" on public.shop_click_events;
create policy "Public insert shop click events"
    on public.shop_click_events for insert
    with check (true);

drop policy if exists "Admin full market clusters" on public.market_clusters;
create policy "Admin full market clusters"
    on public.market_clusters for all
    to authenticated
    using (true)
    with check (true);

drop policy if exists "Admin full shop listings" on public.shop_listings;
create policy "Admin full shop listings"
    on public.shop_listings for all
    to authenticated
    using (true)
    with check (true);

drop policy if exists "Admin full shop claims" on public.shop_claims;
create policy "Admin full shop claims"
    on public.shop_claims for all
    to authenticated
    using (true)
    with check (true);

drop policy if exists "Admin full shop leads" on public.shop_leads;
create policy "Admin full shop leads"
    on public.shop_leads for all
    to authenticated
    using (true)
    with check (true);

drop policy if exists "Admin full sponsored placements" on public.sponsored_placements;
create policy "Admin full sponsored placements"
    on public.sponsored_placements for all
    to authenticated
    using (true)
    with check (true);

drop policy if exists "Admin full verification logs" on public.shop_verification_logs;
create policy "Admin full verification logs"
    on public.shop_verification_logs for all
    to authenticated
    using (true)
    with check (true);

drop policy if exists "Admin read click events" on public.shop_click_events;
create policy "Admin read click events"
    on public.shop_click_events for select
    to authenticated
    using (true);

drop trigger if exists market_clusters_set_updated_at on public.market_clusters;
create trigger market_clusters_set_updated_at
    before update on public.market_clusters
    for each row execute procedure public.set_updated_at();

drop trigger if exists shop_listings_set_updated_at on public.shop_listings;
create trigger shop_listings_set_updated_at
    before update on public.shop_listings
    for each row execute procedure public.set_updated_at();

drop trigger if exists shop_claims_set_updated_at on public.shop_claims;
create trigger shop_claims_set_updated_at
    before update on public.shop_claims
    for each row execute procedure public.set_updated_at();

drop trigger if exists shop_leads_set_updated_at on public.shop_leads;
create trigger shop_leads_set_updated_at
    before update on public.shop_leads
    for each row execute procedure public.set_updated_at();

drop trigger if exists sponsored_placements_set_updated_at on public.sponsored_placements;
create trigger sponsored_placements_set_updated_at
    before update on public.sponsored_placements
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
-- PUBLIC ACCOUNTS + SAVED TOOLS (phase 5)
-- ============================================================
create table if not exists public.profiles (
    id              uuid primary key references auth.users(id) on delete cascade,
    email           text,
    display_name    text,
    avatar_url      text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    last_seen_at    timestamptz
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own public profile" on public.profiles;
create policy "Users read own public profile"
    on public.profiles for select
    to authenticated
    using (id = auth.uid());

drop policy if exists "Users upsert own public profile" on public.profiles;
create policy "Users upsert own public profile"
    on public.profiles for insert
    to authenticated
    with check (id = auth.uid());

drop policy if exists "Users update own public profile" on public.profiles;
create policy "Users update own public profile"
    on public.profiles for update
    to authenticated
    using (id = auth.uid());

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute procedure public.set_updated_at();

create table if not exists public.user_preferences (
    user_id          uuid primary key references public.profiles(id) on delete cascade,
    lang             text,
    currency         text,
    karat            text,
    unit             text,
    theme            text,
    alert_delivery   text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "Users read own preferences" on public.user_preferences;
create policy "Users read own preferences"
    on public.user_preferences for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users upsert own preferences" on public.user_preferences;
create policy "Users upsert own preferences"
    on public.user_preferences for insert
    to authenticated
    with check (user_id = auth.uid());

drop policy if exists "Users update own preferences" on public.user_preferences;
create policy "Users update own preferences"
    on public.user_preferences for update
    to authenticated
    using (user_id = auth.uid());

create trigger user_preferences_set_updated_at
    before update on public.user_preferences
    for each row execute procedure public.set_updated_at();

create table if not exists public.saved_calculations (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references public.profiles(id) on delete cascade,
    tool            text not null,
    label           text not null,
    input_data      jsonb not null default '{}'::jsonb,
    output_data     jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now()
);

create index if not exists idx_saved_calculations_user_created
    on public.saved_calculations(user_id, created_at desc);

alter table public.saved_calculations enable row level security;

drop policy if exists "Users read own saved calculations" on public.saved_calculations;
create policy "Users read own saved calculations"
    on public.saved_calculations for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users insert own saved calculations" on public.saved_calculations;
create policy "Users insert own saved calculations"
    on public.saved_calculations for insert
    to authenticated
    with check (user_id = auth.uid());

drop policy if exists "Users delete own saved calculations" on public.saved_calculations;
create policy "Users delete own saved calculations"
    on public.saved_calculations for delete
    to authenticated
    using (user_id = auth.uid());

create table if not exists public.watchlists (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references public.profiles(id) on delete cascade,
    item_type       text not null,
    item_key        text not null,
    item_label      text,
    metadata        jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now(),
    unique (user_id, item_type, item_key)
);

create index if not exists idx_watchlists_user_created
    on public.watchlists(user_id, created_at desc);

alter table public.watchlists enable row level security;

drop policy if exists "Users read own watchlist" on public.watchlists;
create policy "Users read own watchlist"
    on public.watchlists for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users insert own watchlist" on public.watchlists;
create policy "Users insert own watchlist"
    on public.watchlists for insert
    to authenticated
    with check (user_id = auth.uid());

drop policy if exists "Users update own watchlist" on public.watchlists;
create policy "Users update own watchlist"
    on public.watchlists for update
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users delete own watchlist" on public.watchlists;
create policy "Users delete own watchlist"
    on public.watchlists for delete
    to authenticated
    using (user_id = auth.uid());

create table if not exists public.saved_shops (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references public.profiles(id) on delete cascade,
    shop_id         text not null,
    shop_name       text,
    city            text,
    country_code    text,
    source_url      text,
    notes           text,
    created_at      timestamptz not null default now(),
    unique (user_id, shop_id)
);

create index if not exists idx_saved_shops_user_created
    on public.saved_shops(user_id, created_at desc);

alter table public.saved_shops enable row level security;

drop policy if exists "Users read own saved shops" on public.saved_shops;
create policy "Users read own saved shops"
    on public.saved_shops for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users insert own saved shops" on public.saved_shops;
create policy "Users insert own saved shops"
    on public.saved_shops for insert
    to authenticated
    with check (user_id = auth.uid());

drop policy if exists "Users update own saved shops" on public.saved_shops;
create policy "Users update own saved shops"
    on public.saved_shops for update
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users delete own saved shops" on public.saved_shops;
create policy "Users delete own saved shops"
    on public.saved_shops for delete
    to authenticated
    using (user_id = auth.uid());

create table if not exists public.user_sessions (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references public.profiles(id) on delete cascade,
    ip_hash         text,
    user_agent      text,
    created_at      timestamptz not null default now()
);

create index if not exists idx_user_sessions_user_created
    on public.user_sessions(user_id, created_at desc);

alter table public.user_sessions enable row level security;

drop policy if exists "Users read own sessions" on public.user_sessions;
create policy "Users read own sessions"
    on public.user_sessions for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users insert own sessions" on public.user_sessions;
create policy "Users insert own sessions"
    on public.user_sessions for insert
    to authenticated
    with check (user_id = auth.uid());

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
-- ALERTS + NOTIFICATIONS (phase 3 server-backed retention)
-- ============================================================
create table if not exists public.alert_rules (
    id                      uuid primary key default uuid_generate_v4(),
    user_id                 uuid,
    email                   text not null,
    channel                 text not null default 'email',
    symbol                  text not null default 'XAUUSD',
    currency                text not null default 'USD',
    condition               text not null check (condition in ('above', 'below')),
    threshold_value         numeric not null check (threshold_value > 0),
    karat                   text,
    country_code            text,
    is_active               boolean not null default false,
    cooldown_minutes        int not null default 60 check (cooldown_minutes > 0 and cooldown_minutes <= 10080),
    last_triggered_at       timestamptz,
    management_token_hash   text not null unique,
    verification_token_hash text,
    verified_at             timestamptz,
    unsubscribed_at         timestamptz,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

alter table public.alert_rules enable row level security;

create index if not exists idx_alert_rules_active_lookup
    on public.alert_rules(is_active, symbol, currency, condition);
create index if not exists idx_alert_rules_user_id
    on public.alert_rules(user_id);
create index if not exists idx_alert_rules_threshold_lookup
    on public.alert_rules(symbol, currency, threshold_value);
create index if not exists idx_alert_rules_last_triggered
    on public.alert_rules(last_triggered_at);
create index if not exists idx_alert_rules_email_channel
    on public.alert_rules(email, channel);

drop policy if exists "Admin read alert rules" on public.alert_rules;
create policy "Admin read alert rules"
    on public.alert_rules for select
    to authenticated
    using (
        (user_id is not null and user_id = auth.uid())
        or exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Admin insert alert rules" on public.alert_rules;
create policy "Admin insert alert rules"
    on public.alert_rules for insert
    to authenticated
    with check (
        (user_id is not null and user_id = auth.uid())
        or exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Admin update alert rules" on public.alert_rules;
create policy "Admin update alert rules"
    on public.alert_rules for update
    to authenticated
    using (
        (user_id is not null and user_id = auth.uid())
        or exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Admin delete alert rules" on public.alert_rules;
create policy "Admin delete alert rules"
    on public.alert_rules for delete
    to authenticated
    using (
        (user_id is not null and user_id = auth.uid())
        or exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create trigger alert_rules_set_updated_at
    before update on public.alert_rules
    for each row execute procedure public.set_updated_at();

create table if not exists public.alert_events (
    id                  uuid primary key default uuid_generate_v4(),
    alert_rule_id       uuid not null references public.alert_rules(id) on delete cascade,
    price_snapshot_id   uuid references public.price_snapshots(id) on delete set null,
    channel             text not null,
    status              text not null,
    payload             jsonb,
    error_message       text,
    sent_at             timestamptz,
    created_at          timestamptz not null default now()
);

alter table public.alert_events enable row level security;

create index if not exists idx_alert_events_rule_created
    on public.alert_events(alert_rule_id, created_at desc);
create index if not exists idx_alert_events_status_created
    on public.alert_events(status, created_at desc);

drop policy if exists "Admin read alert events" on public.alert_events;
create policy "Admin read alert events"
    on public.alert_events for select
    to authenticated
    using (
        exists (
            select 1
            from public.alert_rules r
            where r.id = alert_events.alert_rule_id
              and r.user_id is not null
              and r.user_id = auth.uid()
        )
        or exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Admin insert alert events" on public.alert_events;
create policy "Admin insert alert events"
    on public.alert_events for insert
    to authenticated
    with check (
        exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Admin update alert events" on public.alert_events;
create policy "Admin update alert events"
    on public.alert_events for update
    to authenticated
    using (
        exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Admin delete alert events" on public.alert_events;
create policy "Admin delete alert events"
    on public.alert_events for delete
    to authenticated
    using (
        exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create table if not exists public.notification_subscriptions (
    id                      uuid primary key default uuid_generate_v4(),
    user_id                 uuid,
    channel                 text not null,
    destination             text not null,
    destination_hash        text not null,
    unsubscribe_token_hash  text not null,
    verified_at             timestamptz,
    unsubscribed_at         timestamptz,
    metadata                jsonb default '{}'::jsonb,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

alter table public.notification_subscriptions enable row level security;

create unique index if not exists idx_notification_subscriptions_channel_destination
    on public.notification_subscriptions(channel, destination);
create unique index if not exists idx_notification_subscriptions_unsubscribe_hash
    on public.notification_subscriptions(unsubscribe_token_hash);
create index if not exists idx_notification_subscriptions_active
    on public.notification_subscriptions(channel, verified_at, unsubscribed_at);

drop policy if exists "Admin read notification subscriptions" on public.notification_subscriptions;
create policy "Admin read notification subscriptions"
    on public.notification_subscriptions for select
    to authenticated
    using (
        (user_id is not null and user_id = auth.uid())
        or exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Admin insert notification subscriptions" on public.notification_subscriptions;
create policy "Admin insert notification subscriptions"
    on public.notification_subscriptions for insert
    to authenticated
    with check (
        (user_id is not null and user_id = auth.uid())
        or exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Admin update notification subscriptions" on public.notification_subscriptions;
create policy "Admin update notification subscriptions"
    on public.notification_subscriptions for update
    to authenticated
    using (
        (user_id is not null and user_id = auth.uid())
        or exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Admin delete notification subscriptions" on public.notification_subscriptions;
create policy "Admin delete notification subscriptions"
    on public.notification_subscriptions for delete
    to authenticated
    using (
        (user_id is not null and user_id = auth.uid())
        or exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create trigger notification_subscriptions_set_updated_at
    before update on public.notification_subscriptions
    for each row execute procedure public.set_updated_at();

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

-- ============================================================
-- NEWSLETTER SUBSCRIBERS (phase 4 newsletter + lead capture)
-- ============================================================
create table if not exists public.newsletter_subscribers (
    id                      uuid primary key default uuid_generate_v4(),
    email                   text not null unique,
    status                  text not null default 'pending'
                            check (status in ('pending', 'active', 'unsubscribed', 'bounced')),
    locale                  text not null default 'en' check (locale in ('en', 'ar')),
    source                  text not null default 'footer',
    page_path               text,
    preferences             jsonb not null default '{}'::jsonb,
    consent_given           boolean not null default true,
    consent_at              timestamptz,
    confirmed_at            timestamptz,
    unsubscribed_at         timestamptz,
    resubscribed_at         timestamptz,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

create index if not exists idx_newsletter_subscribers_status
    on public.newsletter_subscribers(status, created_at desc);
create index if not exists idx_newsletter_subscribers_email
    on public.newsletter_subscribers(email);

-- Anyone may subscribe; no one may read the list without auth.
create policy "Public insert newsletter subscribers"
    on public.newsletter_subscribers for insert
    with check (
        status = 'pending'
        and char_length(email) between 5 and 320
    );

create policy "Admin read newsletter subscribers"
    on public.newsletter_subscribers for select
    to authenticated
    using (true);

create policy "Admin update newsletter subscribers"
    on public.newsletter_subscribers for update
    to authenticated
    using (true);

create policy "Admin delete newsletter subscribers"
    on public.newsletter_subscribers for delete
    to authenticated
    using (true);

create trigger newsletter_subscribers_set_updated_at
    before update on public.newsletter_subscribers
    for each row execute procedure public.set_updated_at();

-- ============================================================
-- LEAD SUBMISSIONS (phase 4)
-- ============================================================
create table if not exists public.lead_submissions (
    id              uuid primary key default uuid_generate_v4(),
    type            text not null default 'contact'
                    check (type in ('shop_interest', 'pricing_inquiry', 'contact', 'event_track')),
    status          text not null default 'new'
                    check (status in ('new', 'contacted', 'converted', 'closed', 'spam')),
    email           text,
    name            text,
    phone           text,
    message         text,
    source          text not null default 'website',
    page_path       text,
    locale          text not null default 'en' check (locale in ('en', 'ar')),
    entity_type     text,           -- 'shop' | 'country' | etc.
    entity_id       text,
    metadata        jsonb default '{}'::jsonb,
    reviewed_at     timestamptz,
    reviewed_by     text,
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.lead_submissions enable row level security;

create index if not exists idx_lead_submissions_status
    on public.lead_submissions(status, created_at desc);
create index if not exists idx_lead_submissions_type
    on public.lead_submissions(type, created_at desc);

-- Public can submit; cannot read.
create policy "Public insert lead submissions"
    on public.lead_submissions for insert
    with check (true);

create policy "Admin read lead submissions"
    on public.lead_submissions for select
    to authenticated
    using (true);

create policy "Admin update lead submissions"
    on public.lead_submissions for update
    to authenticated
    using (true);

create policy "Admin delete lead submissions"
    on public.lead_submissions for delete
    to authenticated
    using (true);

create trigger lead_submissions_set_updated_at
    before update on public.lead_submissions
    for each row execute procedure public.set_updated_at();

-- ============================================================
-- LEAD EVENTS (phase 4)
-- ============================================================
create table if not exists public.lead_events (
    id              uuid primary key default uuid_generate_v4(),
    lead_id         uuid references public.lead_submissions(id) on delete set null,
    type            text not null,          -- 'submit', 'click', 'call', 'website', 'map', 'status_*'
    entity_type     text,
    entity_id       text,
    page_path       text,
    locale          text default 'en',
    metadata        jsonb,
    created_at      timestamptz not null default now()
);

alter table public.lead_events enable row level security;

create index if not exists idx_lead_events_lead_id
    on public.lead_events(lead_id, created_at desc);
create index if not exists idx_lead_events_type
    on public.lead_events(type, created_at desc);

create policy "Admin read lead events"
    on public.lead_events for select
    to authenticated
    using (true);

create policy "Admin insert lead events"
    on public.lead_events for insert
    to authenticated
    with check (true);

-- ============================================================
-- EMAIL CAMPAIGNS (phase 4)
-- ============================================================
create table if not exists public.email_campaigns (
    id              uuid primary key default uuid_generate_v4(),
    type            text not null default 'weekly'
                    check (type in ('daily', 'weekly', 'transactional', 'custom')),
    subject         text not null,
    content_html    text,
    content_text    text,
    status          text not null default 'draft'
                    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
    scheduled_at    timestamptz,
    sent_at         timestamptz,
    total_recipients int not null default 0,
    created_by      text,
    metadata        jsonb default '{}'::jsonb,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.email_campaigns enable row level security;

create index if not exists idx_email_campaigns_status
    on public.email_campaigns(status, sent_at desc);

create policy "Admin read email campaigns"
    on public.email_campaigns for select
    to authenticated
    using (true);

create policy "Admin insert email campaigns"
    on public.email_campaigns for insert
    to authenticated
    with check (true);

create policy "Admin update email campaigns"
    on public.email_campaigns for update
    to authenticated
    using (true);

create trigger email_campaigns_set_updated_at
    before update on public.email_campaigns
    for each row execute procedure public.set_updated_at();

-- ============================================================
-- EMAIL DELIVERIES (phase 4)
-- ============================================================
create table if not exists public.email_deliveries (
    id              uuid primary key default uuid_generate_v4(),
    campaign_id     uuid references public.email_campaigns(id) on delete set null,
    subscriber_id   uuid references public.newsletter_subscribers(id) on delete set null,
    email           text not null,
    status          text not null default 'queued'
                    check (status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
    provider_id     text,           -- Resend email ID
    error_message   text,
    sent_at         timestamptz,
    opened_at       timestamptz,
    clicked_at      timestamptz,
    created_at      timestamptz not null default now()
);

alter table public.email_deliveries enable row level security;

create index if not exists idx_email_deliveries_campaign
    on public.email_deliveries(campaign_id, created_at desc);
create index if not exists idx_email_deliveries_subscriber
    on public.email_deliveries(subscriber_id, created_at desc);
create index if not exists idx_email_deliveries_status
    on public.email_deliveries(status, created_at desc);

create policy "Admin read email deliveries"
    on public.email_deliveries for select
    to authenticated
    using (true);

create policy "Admin insert email deliveries"
    on public.email_deliveries for insert
    to authenticated
    with check (true);

create policy "Admin update email deliveries"
    on public.email_deliveries for update
    to authenticated
    using (true);

-- ============================================================
-- CONSENT LOGS (phase 4 — legal/compliance)
-- ============================================================
create table if not exists public.consent_logs (
    id              uuid primary key default uuid_generate_v4(),
    entity_type     text not null,   -- 'newsletter_subscriber' | 'lead_submission' | 'alert_rule'
    entity_id       uuid not null,
    email           text,
    action          text not null    -- 'consent_given' | 'consent_withdrawn' | 'subscribed' | 'unsubscribed' | 'confirmed'
                    check (action in ('consent_given', 'consent_withdrawn', 'subscribed', 'unsubscribed', 'confirmed', 'resubscribed')),
    source          text,
    page_path       text,
    locale          text default 'en',
    ip_hash         text,           -- hashed for privacy
    user_agent_hash text,           -- hashed for privacy
    created_at      timestamptz not null default now()
);

alter table public.consent_logs enable row level security;

create index if not exists idx_consent_logs_entity
    on public.consent_logs(entity_type, entity_id, created_at desc);
create index if not exists idx_consent_logs_action
    on public.consent_logs(action, created_at desc);

create policy "Admin read consent logs"
    on public.consent_logs for select
    to authenticated
    using (true);

create policy "Admin insert consent logs"
    on public.consent_logs for insert
    to authenticated
    with check (true);

-- ============================================================
-- BILLING (phase 6 — Stripe subscriptions & entitlements)
-- ============================================================

-- ── plans ─────────────────────────────────────────────────────────────────
-- Product catalogue. Rows are inserted once and referenced by subscriptions.
create table if not exists public.plans (
    id              uuid primary key default uuid_generate_v4(),
    name            text not null unique,            -- 'free' | 'pro' | 'api'
    display_name    text not null,
    price_monthly   numeric(10,2) not null default 0,
    price_yearly    numeric(10,2) not null default 0,
    stripe_price_monthly text,                       -- Stripe price ID
    stripe_price_yearly  text,
    features        jsonb not null default '{}',
    active          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy "Public read plans"
    on public.plans for select
    using (active = true);

create policy "Admin manage plans"
    on public.plans for all
    to service_role
    using (true)
    with check (true);

create trigger plans_set_updated_at
    before update on public.plans
    for each row execute procedure public.set_updated_at();

-- Seed the three tiers
insert into public.plans (name, display_name, price_monthly, price_yearly, features) values
    ('free', 'Free',  0,     0,      '{"alertLimit":3,"historyDays":30,"savedCalcLimit":5,"apiAccess":false,"apiCallsPerDay":0,"exportFormats":["csv"],"webPush":false,"emailAlerts":false,"adsEnabled":true,"portfolioLimit":1,"webhookSupport":false,"prioritySupport":false}'),
    ('pro',  'Pro',   4.99,  49.99,  '{"alertLimit":50,"historyDays":365,"savedCalcLimit":100,"apiAccess":false,"apiCallsPerDay":0,"exportFormats":["csv","json","excel"],"webPush":true,"emailAlerts":true,"adsEnabled":false,"portfolioLimit":10,"webhookSupport":false,"prioritySupport":true}'),
    ('api',  'API',   19.99, 199.99, '{"alertLimit":100,"historyDays":0,"savedCalcLimit":500,"apiAccess":true,"apiCallsPerDay":500,"exportFormats":["csv","json","excel"],"webPush":true,"emailAlerts":true,"adsEnabled":false,"portfolioLimit":50,"webhookSupport":true,"prioritySupport":true}')
on conflict (name) do nothing;

-- ── stripe_customers ──────────────────────────────────────────────────────
create table if not exists public.stripe_customers (
    id                  uuid primary key default uuid_generate_v4(),
    user_id             text not null unique,         -- Supabase auth user ID
    stripe_customer_id  text not null unique,
    email               text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

alter table public.stripe_customers enable row level security;

create index if not exists idx_stripe_customers_user_id
    on public.stripe_customers(user_id);
create index if not exists idx_stripe_customers_stripe_id
    on public.stripe_customers(stripe_customer_id);

-- Only the owning user and admins may read; service-role writes via backend
create policy "User read own stripe customer"
    on public.stripe_customers for select
    to authenticated
    using (user_id = auth.uid()::text);

create policy "Admin manage stripe customers"
    on public.stripe_customers for all
    to service_role
    using (true)
    with check (true);

create trigger stripe_customers_set_updated_at
    before update on public.stripe_customers
    for each row execute procedure public.set_updated_at();

-- ── subscriptions ─────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
    id                      uuid primary key default uuid_generate_v4(),
    user_id                 text not null,
    tier                    text not null default 'free'
                            check (tier in ('free', 'pro', 'api')),
    stripe_customer_id      text,
    stripe_subscription_id  text unique,
    status                  text not null default 'active'
                            check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid')),
    current_period_end      timestamptz,
    cancel_at_period_end    boolean not null default false,
    canceled_at             timestamptz,
    interval                text not null default 'month'
                            check (interval in ('month', 'year')),
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create index if not exists idx_subscriptions_user_id
    on public.subscriptions(user_id, status, created_at desc);
create index if not exists idx_subscriptions_stripe_sub_id
    on public.subscriptions(stripe_subscription_id);
create index if not exists idx_subscriptions_customer_id
    on public.subscriptions(stripe_customer_id);

create policy "User read own subscriptions"
    on public.subscriptions for select
    to authenticated
    using (user_id = auth.uid()::text);

create policy "Admin manage subscriptions"
    on public.subscriptions for all
    to service_role
    using (true)
    with check (true);

create trigger subscriptions_set_updated_at
    before update on public.subscriptions
    for each row execute procedure public.set_updated_at();

-- ── entitlements ──────────────────────────────────────────────────────────
-- Manual grants / overrides. The backend derives entitlements from
-- subscriptions.tier by default; rows here take precedence.
create table if not exists public.entitlements (
    id          uuid primary key default uuid_generate_v4(),
    user_id     text not null,
    feature     text not null,
    value       jsonb not null,              -- true | false | number | string[]
    granted_by  text,
    expires_at  timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (user_id, feature)
);

alter table public.entitlements enable row level security;

create index if not exists idx_entitlements_user_id
    on public.entitlements(user_id, feature);

create policy "User read own entitlements"
    on public.entitlements for select
    to authenticated
    using (user_id = auth.uid()::text);

create policy "Admin manage entitlements"
    on public.entitlements for all
    to service_role
    using (true)
    with check (true);

create trigger entitlements_set_updated_at
    before update on public.entitlements
    for each row execute procedure public.set_updated_at();

-- ── stripe_events ─────────────────────────────────────────────────────────
-- Idempotent event log. One row per Stripe event ID.
create table if not exists public.stripe_events (
    id              uuid primary key default uuid_generate_v4(),
    stripe_event_id text not null unique,
    type            text not null,
    livemode        boolean not null default false,
    handled_at      timestamptz not null default now(),
    created_at      timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

create index if not exists idx_stripe_events_event_id
    on public.stripe_events(stripe_event_id);
create index if not exists idx_stripe_events_type
    on public.stripe_events(type, handled_at desc);

create policy "Admin read stripe events"
    on public.stripe_events for select
    to service_role
    using (true);

create policy "Admin insert stripe events"
    on public.stripe_events for insert
    to service_role
    with check (true);

-- ── api_keys ──────────────────────────────────────────────────────────────
create table if not exists public.api_keys (
    id          uuid primary key default uuid_generate_v4(),
    user_id     text not null,
    key_hash    text not null unique,        -- SHA-256 of the raw key
    key_prefix  text not null,              -- first 12 chars — safe to display
    label       text not null default 'default',
    revoked     boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

alter table public.api_keys enable row level security;

create index if not exists idx_api_keys_user_id
    on public.api_keys(user_id, revoked, created_at desc);
create index if not exists idx_api_keys_hash
    on public.api_keys(key_hash) where (revoked = false);

create policy "User read own api keys"
    on public.api_keys for select
    to authenticated
    using (user_id = auth.uid()::text);

create policy "Admin manage api keys"
    on public.api_keys for all
    to service_role
    using (true)
    with check (true);

create trigger api_keys_set_updated_at
    before update on public.api_keys
    for each row execute procedure public.set_updated_at();

-- ── api_usage ─────────────────────────────────────────────────────────────
-- One row per (api_key_id, date) window — incremented atomically.
create table if not exists public.api_usage (
    id          uuid primary key default uuid_generate_v4(),
    api_key_id  uuid not null references public.api_keys(id) on delete cascade,
    date        date not null,
    call_count  int not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (api_key_id, date)
);

alter table public.api_usage enable row level security;

create index if not exists idx_api_usage_key_date
    on public.api_usage(api_key_id, date desc);

create policy "Admin manage api usage"
    on public.api_usage for all
    to service_role
    using (true)
    with check (true);

create trigger api_usage_set_updated_at
    before update on public.api_usage
    for each row execute procedure public.set_updated_at();

-- Atomic increment helper (avoids a read-modify-write race)
create or replace function public.increment_api_usage(p_key_id uuid, p_date date)
returns int language plpgsql security definer as $$
declare
    v_count int;
begin
    insert into public.api_usage (api_key_id, date, call_count)
    values (p_key_id, p_date, 1)
    on conflict (api_key_id, date)
    do update set call_count = api_usage.call_count + 1,
                  updated_at = now()
    returning call_count into v_count;
    return v_count;
end;
$$;

-- ── billing_audit_logs ────────────────────────────────────────────────────
create table if not exists public.billing_audit_logs (
    id          uuid primary key default uuid_generate_v4(),
    user_id     text,
    action      text not null,
    tier        text,
    metadata    jsonb,
    created_at  timestamptz not null default now()
);

alter table public.billing_audit_logs enable row level security;

create index if not exists idx_billing_audit_logs_user_id
    on public.billing_audit_logs(user_id, created_at desc);
create index if not exists idx_billing_audit_logs_action
    on public.billing_audit_logs(action, created_at desc);

create policy "Admin read billing audit logs"
    on public.billing_audit_logs for select
    to service_role
    using (true);

create policy "Admin insert billing audit logs"
    on public.billing_audit_logs for insert
    to service_role
    with check (true);

-- ============================================================
-- X AUTOMATION OBSERVABILITY
-- ============================================================
-- Intentional separation:
--   automation_runs  = canonical stream of all outcomes
--   tweet_posts      = fast path for posted-only analytics
--   tweet_failures   = fast path for failure triage dashboards/alerts
-- This mirrors the runtime sync contract used by this repository's
-- scripts/python/post_gold_price.py emitter.
-- and keeps common operator queries simple without heavy status filtering.
create table if not exists public.automation_runs (
    id                      uuid primary key default uuid_generate_v4(),
    created_at              timestamptz not null default now(),
    outcome                 text not null,
    status                  text not null,
    status_bucket           text,
    post_type               text,
    template_used           text,
    run_id                  text,
    dry_run                 boolean,
    force_post              boolean,
    post_intent             text,
    market_open             boolean,
    price_source            text,
    price_freshness         text,
    duplicate_guard_result  text,
    price_usd_oz            double precision,
    tweet_length            int,
    content_hash            text,
    state_hash              text,
    tweet_id                text,
    skip_reason             text,
    error_summary           text,
    operator_action         text,
    reset_date              text,
    retry_after_seconds     text,
    trigger_source          text,
    trigger_nonce           text,
    db_sync_mode            text,
    detail                  text
);

create table if not exists public.tweet_posts (
    id                      uuid primary key default uuid_generate_v4(),
    created_at              timestamptz not null default now(),
    outcome                 text not null,
    status                  text not null,
    status_bucket           text,
    post_type               text,
    template_used           text,
    run_id                  text,
    dry_run                 boolean,
    force_post              boolean,
    post_intent             text,
    market_open             boolean,
    price_source            text,
    price_freshness         text,
    duplicate_guard_result  text,
    price_usd_oz            double precision,
    tweet_length            int,
    content_hash            text,
    state_hash              text,
    tweet_id                text,
    skip_reason             text,
    error_summary           text,
    operator_action         text,
    reset_date              text,
    retry_after_seconds     text,
    trigger_source          text,
    trigger_nonce           text,
    db_sync_mode            text,
    detail                  text
);

create table if not exists public.tweet_failures (
    id                      uuid primary key default uuid_generate_v4(),
    created_at              timestamptz not null default now(),
    outcome                 text not null,
    status                  text not null,
    status_bucket           text,
    post_type               text,
    template_used           text,
    run_id                  text,
    dry_run                 boolean,
    force_post              boolean,
    post_intent             text,
    market_open             boolean,
    price_source            text,
    price_freshness         text,
    duplicate_guard_result  text,
    price_usd_oz            double precision,
    tweet_length            int,
    content_hash            text,
    state_hash              text,
    tweet_id                text,
    skip_reason             text,
    error_summary           text,
    operator_action         text,
    reset_date              text,
    retry_after_seconds     text,
    trigger_source          text,
    trigger_nonce           text,
    db_sync_mode            text,
    detail                  text
);

create index if not exists idx_automation_runs_created_at
    on public.automation_runs(created_at desc);
create index if not exists idx_automation_runs_status_bucket
    on public.automation_runs(status_bucket, created_at desc);
create index if not exists idx_tweet_posts_created_at
    on public.tweet_posts(created_at desc);
create index if not exists idx_tweet_failures_created_at
    on public.tweet_failures(created_at desc);

alter table public.automation_runs enable row level security;
alter table public.tweet_posts enable row level security;
alter table public.tweet_failures enable row level security;

drop policy if exists "Admin read automation runs" on public.automation_runs;
create policy "Admin read automation runs"
    on public.automation_runs for select
    to service_role
    using (true);

drop policy if exists "Admin insert automation runs" on public.automation_runs;
create policy "Admin insert automation runs"
    on public.automation_runs for insert
    to service_role
    with check (true);

drop policy if exists "Admin read tweet posts" on public.tweet_posts;
create policy "Admin read tweet posts"
    on public.tweet_posts for select
    to service_role
    using (true);

drop policy if exists "Admin insert tweet posts" on public.tweet_posts;
create policy "Admin insert tweet posts"
    on public.tweet_posts for insert
    to service_role
    with check (true);

drop policy if exists "Admin read tweet failures" on public.tweet_failures;
create policy "Admin read tweet failures"
    on public.tweet_failures for select
    to service_role
    using (true);

drop policy if exists "Admin insert tweet failures" on public.tweet_failures;
create policy "Admin insert tweet failures"
    on public.tweet_failures for insert
    to service_role
    with check (true);

-- ---------------------------------------------------------------------------
-- Phase 11: AI Content Drafts
-- ---------------------------------------------------------------------------

create table if not exists public.ai_drafts (
    id                  text primary key,
    type                text not null,
    status              text not null default 'draft',
    language_pair       text not null default 'en+ar',
    title_en            text not null default '',
    title_ar            text not null default '',
    body_en             text not null default '',
    body_ar             text not null default '',
    data_snapshot       jsonb,
    data_timestamp_utc  timestamptz,
    is_spot_estimate    boolean not null default true,
    anomaly_flag        boolean not null default false,
    anomaly_detail      text,
    generated_at_utc    timestamptz not null default now(),
    reviewed_by         text,
    reviewed_at_utc     timestamptz,
    review_action       text,
    review_note         text,
    published_at_utc    timestamptz,
    export_channel      text,
    audit_trail         jsonb not null default '[]'::jsonb,
    constraint ai_drafts_type_check check (
        type in (
            'daily_summary', 'weekly_summary', 'uae_gcc_summary',
            'provider_report', 'seo_brief', 'x_post', 'newsletter_block'
        )
    ),
    constraint ai_drafts_status_check check (
        status in ('draft', 'approved', 'rejected', 'published')
    )
);

create index if not exists idx_ai_drafts_status
    on public.ai_drafts(status, generated_at_utc desc);
create index if not exists idx_ai_drafts_type
    on public.ai_drafts(type, generated_at_utc desc);
create index if not exists idx_ai_drafts_generated_at
    on public.ai_drafts(generated_at_utc desc);

alter table public.ai_drafts enable row level security;

drop policy if exists "Admin read ai drafts" on public.ai_drafts;
create policy "Admin read ai drafts"
    on public.ai_drafts for select
    to service_role
    using (true);

drop policy if exists "Admin insert ai drafts" on public.ai_drafts;
create policy "Admin insert ai drafts"
    on public.ai_drafts for insert
    to service_role
    with check (true);

drop policy if exists "Admin update ai drafts" on public.ai_drafts;
create policy "Admin update ai drafts"
    on public.ai_drafts for update
    to service_role
    using (true)
    with check (true);
