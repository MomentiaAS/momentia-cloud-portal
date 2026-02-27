-- ============================================================
-- Momentia Cloud Portal — Database Schema + Seed Data
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists public.customers (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  status          text not null default 'active'
                    check (status in ('active', 'potential', 'archived')),
  health          text not null default 'unknown'
                    check (health in ('healthy', 'degraded', 'critical', 'unknown')),
  tier            text not null default 'standard'
                    check (tier in ('basic', 'standard', 'premium', 'enterprise')),
  open_alerts     integer not null default 0,
  last_sync       timestamptz,
  assigned_tech   text,
  primary_contact jsonb not null default '{}',
  billing_contact jsonb,
  domain          text,
  address         text,
  notes           text,
  integrations    jsonb not null default
                    '{"veeam":false,"rmm":false,"m365":false,"azure":false,"sentinelOne":false}',
  created_at      timestamptz not null default now()
);

create table if not exists public.alerts (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.customers(id) on delete cascade,
  title       text not null,
  message     text,
  severity    text not null
                check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  timestamp   timestamptz not null default now(),
  resolved    boolean not null default false,
  source      text,
  created_at  timestamptz not null default now()
);

create table if not exists public.logs (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.customers(id) on delete set null,
  system      text not null,
  severity    text not null
                check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  message     text not null,
  details     text,
  timestamp   timestamptz not null default now()
);

create table if not exists public.backup_jobs (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  job_name        text not null,
  status          text not null
                    check (status in ('success', 'warning', 'failed', 'running', 'idle')),
  last_run        timestamptz,
  next_run        timestamptz,
  duration        integer,
  size_gb         numeric(10, 2),
  data_source     text,
  repository      text,
  retention_days  integer not null default 30,
  error_message   text,
  created_at      timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Permissive for now; tighten once authentication is added.

alter table public.customers   enable row level security;
alter table public.alerts      enable row level security;
alter table public.logs        enable row level security;
alter table public.backup_jobs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'customers'   and policyname = 'Allow all') then
    create policy "Allow all" on public.customers   for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'alerts'      and policyname = 'Allow all') then
    create policy "Allow all" on public.alerts      for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'logs'        and policyname = 'Allow all') then
    create policy "Allow all" on public.logs        for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'backup_jobs' and policyname = 'Allow all') then
    create policy "Allow all" on public.backup_jobs for all using (true) with check (true); end if;
end $$;

-- ── Seed Data (removed) ───────────────────────────────────────────────────────
-- No seed data — add real customers via the portal.
-- To restore demo data for testing, see the git history or demo.ts in the codebase.

-- Tables are empty and ready for real data.
-- Use the portal to add customers, or insert directly via the Supabase dashboard.
