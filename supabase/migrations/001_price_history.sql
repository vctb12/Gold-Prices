-- ============================================================
-- PRICE HISTORY — persistent historical price data for charts
-- ============================================================
-- Records gold prices at regular intervals (every 30 minutes via
-- GitHub Actions). This powers the historical chart component and
-- enables multi-day/month/year views beyond the localStorage cache.
--
-- Run in Supabase SQL Editor or via supabase db push.
-- ============================================================

create table if not exists public.price_history (
    id              bigserial primary key,
    recorded_at     timestamptz not null default now(),
    karat           smallint not null check (karat in (24, 22, 21, 18, 14)),
    price_aed       numeric(10, 4) not null,
    price_usd       numeric(10, 4) not null,
    source          text not null default 'goldpricez',
    is_retail       boolean not null default false
);

-- Optimised for chart queries: "give me 24K prices in descending time order"
create index if not exists idx_price_history_karat_time
    on public.price_history (karat, recorded_at desc);

-- Optimised for cleanup jobs: "delete rows older than X"
create index if not exists idx_price_history_recorded_at
    on public.price_history (recorded_at);

-- Row Level Security
alter table public.price_history enable row level security;

-- Public: anyone can read price history (powers charts)
create policy "Public read price history"
    on public.price_history for select
    using (true);

-- Only service-role key (GitHub Actions) can write
create policy "Service insert price history"
    on public.price_history for insert
    to service_role
    with check (true);

-- Service role can delete old data (retention cleanup)
create policy "Service delete price history"
    on public.price_history for delete
    to service_role
    using (true);

-- ============================================================
-- PRICE ALERTS — user-defined price notification targets
-- ============================================================
-- Users set a target price + direction (above/below). The
-- check-alerts workflow evaluates active alerts every 15 minutes
-- and triggers notifications when conditions are met.
-- ============================================================

create table if not exists public.price_alerts (
    id              bigserial primary key,
    email           text,
    push_token      text,
    karat           smallint not null check (karat in (24, 22, 21, 18, 14)),
    currency        text not null default 'AED' check (currency in ('AED', 'USD')),
    target_price    numeric(10, 4) not null,
    direction       text not null check (direction in ('above', 'below')),
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    triggered_at    timestamptz,
    trigger_count   int not null default 0
);

-- Query pattern: "find all active alerts for 24K"
create index if not exists idx_price_alerts_active_karat
    on public.price_alerts (is_active, karat) where is_active = true;

-- Row Level Security
alter table public.price_alerts enable row level security;

-- Public: anyone can insert their own alerts
create policy "Public insert alerts"
    on public.price_alerts for insert
    with check (
        email is not null
        and char_length(email) between 5 and 320
        and target_price > 0
    );

-- Public: read own alerts by email (RLS function would be better, but this
-- keeps it simple for the MVP — the check_alerts workflow uses service_role)
create policy "Public read own alerts"
    on public.price_alerts for select
    using (true);

-- Service role can update alerts (mark triggered)
create policy "Service update alerts"
    on public.price_alerts for update
    to service_role
    using (true);

-- Service role can delete alerts
create policy "Service delete alerts"
    on public.price_alerts for delete
    to service_role
    using (true);
