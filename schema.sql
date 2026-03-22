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
  tier            text not null default 'basic'
                    check (tier in ('basic', 'pro', 'advanced')),
  open_alerts     integer not null default 0,
  last_sync       timestamptz,
  assigned_tech   text,
  primary_contact jsonb not null default '{}',
  billing_contact jsonb,
  domain          text,
  address         text,
  state           text,
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

-- ── Profiles table (auth users + roles) ──────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text,
  role       text not null default 'technician'
               check (role in ('superadmin', 'admin', 'technician', 'viewer')),
  created_at timestamptz not null default now()
);

-- Automatically create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.customers   enable row level security;
alter table public.alerts      enable row level security;
alter table public.logs        enable row level security;
alter table public.backup_jobs enable row level security;
alter table public.profiles    enable row level security;

-- Helper: returns current user's role without triggering RLS recursion
create or replace function public.current_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Data tables: require authentication (replaces the old "Allow all")
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'customers'   and policyname = 'Authenticated users') then
    create policy "Authenticated users" on public.customers   for all using (auth.uid() is not null) with check (auth.uid() is not null); end if;
  if not exists (select 1 from pg_policies where tablename = 'alerts'      and policyname = 'Authenticated users') then
    create policy "Authenticated users" on public.alerts      for all using (auth.uid() is not null) with check (auth.uid() is not null); end if;
  if not exists (select 1 from pg_policies where tablename = 'logs'        and policyname = 'Authenticated users') then
    create policy "Authenticated users" on public.logs        for all using (auth.uid() is not null) with check (auth.uid() is not null); end if;
  if not exists (select 1 from pg_policies where tablename = 'backup_jobs' and policyname = 'Authenticated users') then
    create policy "Authenticated users" on public.backup_jobs for all using (auth.uid() is not null) with check (auth.uid() is not null); end if;
end $$;

-- Profiles: users see their own row; superadmin sees and updates all
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Own profile') then
    create policy "Own profile" on public.profiles
      for select using (auth.uid() = id or public.current_user_role() = 'superadmin'); end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Superadmin manage') then
    create policy "Superadmin manage" on public.profiles
      for all using (public.current_user_role() = 'superadmin') with check (public.current_user_role() = 'superadmin'); end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Own profile insert') then
    create policy "Own profile insert" on public.profiles
      for insert with check (auth.uid() = id); end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Own profile update') then
    create policy "Own profile update" on public.profiles
      for update using (auth.uid() = id); end if;
end $$;

-- ── Migrations — run if you already have an existing schema ───────────────────
-- (Skip if running schema.sql for the first time on a fresh project.)

-- v4 → v5: UniFi integration
alter table public.customers add column if not exists unifi_site_id text;

-- v1 → v2: customers schema changes
alter table public.customers add column if not exists state text;
alter table public.customers drop constraint if exists customers_tier_check;
alter table public.customers add constraint customers_tier_check check (tier in ('basic', 'pro', 'advanced'));

-- v2 → v3: replace permissive "Allow all" policies with auth-required ones
do $$ begin
  -- Drop old open policies if they still exist
  if exists (select 1 from pg_policies where tablename = 'customers'   and policyname = 'Allow all') then
    drop policy "Allow all" on public.customers;   end if;
  if exists (select 1 from pg_policies where tablename = 'alerts'      and policyname = 'Allow all') then
    drop policy "Allow all" on public.alerts;      end if;
  if exists (select 1 from pg_policies where tablename = 'logs'        and policyname = 'Allow all') then
    drop policy "Allow all" on public.logs;        end if;
  if exists (select 1 from pg_policies where tablename = 'backup_jobs' and policyname = 'Allow all') then
    drop policy "Allow all" on public.backup_jobs; end if;
end $$;

-- ── v3 → v4: user_customers junction table + scoped RLS ──────────────────────
-- Run this block in Supabase SQL Editor if you already have the v3 schema.

-- Junction table: links portal users to specific customers
create table if not exists public.user_customers (
  user_id     uuid not null references public.profiles(id)  on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  primary key (user_id, customer_id)
);

alter table public.user_customers enable row level security;

-- RLS: superadmin manages all assignments; users see only their own
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'user_customers' and policyname = 'Superadmin manage assignments') then
    create policy "Superadmin manage assignments" on public.user_customers
      for all using  (public.current_user_role() = 'superadmin')
                with check (public.current_user_role() = 'superadmin'); end if;
  if not exists (select 1 from pg_policies where tablename = 'user_customers' and policyname = 'Own assignments') then
    create policy "Own assignments" on public.user_customers
      for select using (user_id = auth.uid()); end if;
end $$;

-- Update profiles "Own profile" policy so admin can also read all profiles
do $$ begin
  if exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Own profile') then
    drop policy "Own profile" on public.profiles; end if;
  create policy "Own profile" on public.profiles
    for select using (
      auth.uid() = id
      or public.current_user_role() in ('superadmin', 'admin')
    );
end $$;

-- Admins can update non–super-admin profiles (e.g. display names). Superadmin
-- already has "Superadmin manage"; own row still covered by "Own profile update".
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Admin update profiles') then
    create policy "Admin update profiles" on public.profiles
      for update using (
        public.current_user_role() = 'admin'
        and role <> 'superadmin'
      )
      with check (
        public.current_user_role() = 'admin'
        and role <> 'superadmin'
      );
  end if;
end $$;

-- Replace broad "Authenticated users" policies with role-scoped ones
-- Drop old policies first
do $$ begin
  if exists (select 1 from pg_policies where tablename = 'customers'   and policyname = 'Authenticated users') then drop policy "Authenticated users" on public.customers;   end if;
  if exists (select 1 from pg_policies where tablename = 'alerts'      and policyname = 'Authenticated users') then drop policy "Authenticated users" on public.alerts;      end if;
  if exists (select 1 from pg_policies where tablename = 'logs'        and policyname = 'Authenticated users') then drop policy "Authenticated users" on public.logs;        end if;
  if exists (select 1 from pg_policies where tablename = 'backup_jobs' and policyname = 'Authenticated users') then drop policy "Authenticated users" on public.backup_jobs; end if;
end $$;

-- ── CUSTOMERS ────────────────────────────────────────────────────────────────

-- SELECT: admin/superadmin see all; technician/viewer see only assigned
create policy "Customer select" on public.customers
  for select using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or exists (
        select 1 from public.user_customers uc
        where uc.user_id = auth.uid() and uc.customer_id = customers.id
      )
    )
  );

-- INSERT: superadmin/admin only (can't scope to a not-yet-existing customer)
create policy "Customer insert" on public.customers
  for insert with check (
    auth.uid() is not null
    and public.current_user_role() in ('superadmin', 'admin')
  );

-- UPDATE: superadmin/admin always; technician only for assigned customers
create policy "Customer update" on public.customers
  for update using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and exists (
          select 1 from public.user_customers uc
          where uc.user_id = auth.uid() and uc.customer_id = customers.id
        )
      )
    )
  );

-- DELETE: superadmin only
create policy "Customer delete" on public.customers
  for delete using (
    auth.uid() is not null
    and public.current_user_role() = 'superadmin'
  );

-- ── ALERTS ───────────────────────────────────────────────────────────────────

create policy "Alert select" on public.alerts
  for select using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or exists (
        select 1 from public.user_customers uc
        where uc.user_id = auth.uid() and uc.customer_id = alerts.customer_id
      )
    )
  );

create policy "Alert write" on public.alerts
  for all using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and exists (
          select 1 from public.user_customers uc
          where uc.user_id = auth.uid() and uc.customer_id = alerts.customer_id
        )
      )
    )
  ) with check (auth.uid() is not null);

-- ── LOGS ─────────────────────────────────────────────────────────────────────

create policy "Log select" on public.logs
  for select using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or exists (
        select 1 from public.user_customers uc
        where uc.user_id = auth.uid() and uc.customer_id = logs.customer_id
      )
    )
  );

create policy "Log write" on public.logs
  for all using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and exists (
          select 1 from public.user_customers uc
          where uc.user_id = auth.uid() and uc.customer_id = logs.customer_id
        )
      )
    )
  ) with check (auth.uid() is not null);

-- ── BACKUP JOBS ──────────────────────────────────────────────────────────────

create policy "Backup select" on public.backup_jobs
  for select using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or exists (
        select 1 from public.user_customers uc
        where uc.user_id = auth.uid() and uc.customer_id = backup_jobs.customer_id
      )
    )
  );

create policy "Backup write" on public.backup_jobs
  for all using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and exists (
          select 1 from public.user_customers uc
          where uc.user_id = auth.uid() and uc.customer_id = backup_jobs.customer_id
        )
      )
    )
  ) with check (auth.uid() is not null);

-- ── v5 → v6: Assets table ────────────────────────────────────────────────────

create table if not exists public.assets (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  name          text not null,
  type          text not null default 'computer'
                  check (type in ('computer','server','network','mobile','printer','license','other')),
  make          text,
  model         text,
  serial        text,
  os            text,
  assigned_to   text,
  status        text not null default 'active'
                  check (status in ('active','retired','spare')),
  purchase_date date,
  warranty_end  date,
  notes         text,
  created_at    timestamptz not null default now()
);

alter table public.assets enable row level security;

-- SELECT: admin/superadmin see all; technician/viewer see only assigned customers' assets
create policy "Asset select" on public.assets
  for select using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or exists (
        select 1 from public.user_customers uc
        where uc.user_id = auth.uid() and uc.customer_id = assets.customer_id
      )
    )
  );

-- INSERT/UPDATE: superadmin/admin always; technician for assigned customers
create policy "Asset write" on public.assets
  for all using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and exists (
          select 1 from public.user_customers uc
          where uc.user_id = auth.uid() and uc.customer_id = assets.customer_id
        )
      )
    )
  ) with check (auth.uid() is not null);

-- v6 → v7: Add IP, MAC, and location columns to assets
alter table public.assets add column if not exists ip_address  text;
alter table public.assets add column if not exists mac_address text;
alter table public.assets add column if not exists location    text;

-- ── v7 → v8: Per-customer documentation sections (technical docs) ───────────

create table if not exists public.customer_doc_sections (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  title         text not null,
  body          text not null default '',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_customer_doc_sections_customer
  on public.customer_doc_sections(customer_id);

alter table public.customer_doc_sections enable row level security;

create policy "Doc section select" on public.customer_doc_sections
  for select using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or exists (
        select 1 from public.user_customers uc
        where uc.user_id = auth.uid() and uc.customer_id = customer_doc_sections.customer_id
      )
    )
  );

create policy "Doc section write" on public.customer_doc_sections
  for all using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and exists (
          select 1 from public.user_customers uc
          where uc.user_id = auth.uid() and uc.customer_id = customer_doc_sections.customer_id
        )
      )
    )
  ) with check (auth.uid() is not null);

create or replace function public.customer_doc_sections_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_customer_doc_sections_updated_at on public.customer_doc_sections;
create trigger trg_customer_doc_sections_updated_at
  before update on public.customer_doc_sections
  for each row execute procedure public.customer_doc_sections_touch_updated_at();

-- ── v8 → v9: Storage for documentation images (public URLs, scoped uploads) ───

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-doc-media',
  'customer-doc-media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read: public bucket — objects reachable only if URL is known
create policy "customer-doc-media read"
  on storage.objects for select
  using (bucket_id = 'customer-doc-media');

create policy "customer-doc-media insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-doc-media'
    and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and (storage.foldername(name))[1] in (
          select customer_id::text from public.user_customers
          where user_id = auth.uid()
        )
      )
    )
  );

create policy "customer-doc-media delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'customer-doc-media'
    and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and (storage.foldername(name))[1] in (
          select customer_id::text from public.user_customers
          where user_id = auth.uid()
        )
      )
    )
  );

-- ── v9 → v10: Customer file library (DB + private Storage) ───────────────────

create table if not exists public.customer_files (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  parent_id     uuid references public.customer_files(id) on delete cascade,
  kind          text not null check (kind in ('folder', 'file')),
  name          text not null,
  storage_path  text,
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  constraint customer_files_storage_path_by_kind check (
    (kind = 'folder' and storage_path is null)
    or (kind = 'file' and storage_path is not null and length(trim(storage_path)) > 0)
  )
);

create index if not exists idx_customer_files_customer_parent
  on public.customer_files (customer_id, parent_id);

create unique index if not exists idx_customer_files_sibling_name
  on public.customer_files (customer_id, parent_id, lower(trim(name)))
  nulls not distinct;

alter table public.customer_files enable row level security;

drop policy if exists "Customer file select" on public.customer_files;
create policy "Customer file select" on public.customer_files
  for select using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or exists (
        select 1 from public.user_customers uc
        where uc.user_id = auth.uid() and uc.customer_id = customer_files.customer_id
      )
    )
  );

drop policy if exists "Customer file write" on public.customer_files;
create policy "Customer file write" on public.customer_files
  for all using (
    auth.uid() is not null and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and exists (
          select 1 from public.user_customers uc
          where uc.user_id = auth.uid() and uc.customer_id = customer_files.customer_id
        )
      )
    )
  ) with check (auth.uid() is not null);

-- Private bucket; use signed URLs in the app for downloads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-files',
  'customer-files',
  false,
  52428800,
  null
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "customer-files select" on storage.objects;
create policy "customer-files select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-files'
    and (
      public.current_user_role() in ('superadmin', 'admin')
      or (storage.foldername(name))[1] in (
        select customer_id::text from public.user_customers
        where user_id = auth.uid()
      )
    )
  );

drop policy if exists "customer-files insert" on storage.objects;
create policy "customer-files insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-files'
    and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and (storage.foldername(name))[1] in (
          select customer_id::text from public.user_customers
          where user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "customer-files update" on storage.objects;
create policy "customer-files update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'customer-files'
    and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and (storage.foldername(name))[1] in (
          select customer_id::text from public.user_customers
          where user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "customer-files delete" on storage.objects;
create policy "customer-files delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'customer-files'
    and (
      public.current_user_role() in ('superadmin', 'admin')
      or (
        public.current_user_role() = 'technician'
        and (storage.foldername(name))[1] in (
          select customer_id::text from public.user_customers
          where user_id = auth.uid()
        )
      )
    )
  );

-- ── No seed data ──────────────────────────────────────────────────────────────
-- Add real customers via the portal.
-- Use the portal to add customers, or insert directly via the Supabase dashboard.
