-- ============================================================
-- HireLoop v1 — Core Schema
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- 1. JobSource (reference/lookup)
create table if not exists public.job_sources (
  id          text primary key,  -- 'adzuna', 'jooble', 'linkedin_unofficial'
  display_name text not null,
  is_compliant boolean not null default true,
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Seed job sources
insert into public.job_sources (id, display_name, is_compliant) values
  ('adzuna', 'Adzuna', true),
  ('jooble', 'Jooble', true),
  ('linkedin_unofficial', 'LinkedIn', false)
on conflict (id) do nothing;

-- 2. User profiles (extends auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text,
  role        text not null default 'USER' check (role in ('USER', 'ADMIN')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup (prefix with hireloop_ to avoid conflict with CMP_APP)
create or replace function public.hireloop_handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists hireloop_on_auth_user_created on auth.users;
create trigger hireloop_on_auth_user_created
  after insert on auth.users
  for each row execute function public.hireloop_handle_new_user();

-- 3. SearchProfile
create table if not exists public.search_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  title_keywords    text[] not null default '{}',
  location          text,
  remote_preference text not null default 'any' check (remote_preference in ('remote_only', 'hybrid_ok', 'onsite_ok', 'any')),
  seniority         text,
  salary_min        integer,
  job_type          text,
  enabled_sources   text[] not null default array['adzuna', 'jooble'],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.search_profiles enable row level security;

create policy "Users can manage own search profiles"
  on public.search_profiles for all
  using (auth.uid() = user_id);

-- 4. Job
create table if not exists public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  source_id           text not null references public.job_sources(id),
  external_id         text not null,
  title               text not null,
  company             text not null,
  location            text,
  is_remote           boolean not null default false,
  description         text not null,
  salary_min          integer,
  salary_max          integer,
  currency            text not null default 'USD',
  job_type            text,
  seniority           text,
  apply_url           text not null,
  ats_platform        text,
  auto_apply_eligible boolean not null default false,
  posted_at           timestamptz,
  ingested_at         timestamptz not null default now(),
  dedupe_hash         text not null,
  match_score         integer default 0,  -- 0-100, computed at ingestion
  created_at          timestamptz not null default now(),
  unique(source_id, external_id)
);

alter table public.jobs enable row level security;

create policy "Anyone can read jobs"
  on public.jobs for select
  using (true);

create index idx_jobs_dedupe on public.jobs(dedupe_hash);
create index idx_jobs_posted on public.jobs(posted_at desc);
create index idx_jobs_source on public.jobs(source_id);

-- Full-text search index
alter table public.jobs add column if not exists fts tsvector
  generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(description, ''))) stored;

create index idx_jobs_fts on public.jobs using gin(fts);

-- 5. BaseResume
create table if not exists public.base_resumes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  file_url        text not null,
  file_type       text not null,  -- 'pdf', 'docx'
  parsed_sections jsonb,
  created_at      timestamptz not null default now()
);

alter table public.base_resumes enable row level security;

create policy "Users can manage own base resumes"
  on public.base_resumes for all
  using (auth.uid() = user_id);

-- 6. OptimizedCV
create table if not exists public.optimized_cvs (
  id                  uuid primary key default gen_random_uuid(),
  base_resume_id      uuid not null references public.base_resumes(id) on delete cascade,
  job_id              uuid not null references public.jobs(id) on delete cascade,
  version             integer not null default 1,
  generated_sections  jsonb not null,
  flagged_terms       jsonb,
  user_approved       boolean not null default false,
  export_file_url     text,
  created_at          timestamptz not null default now(),
  unique(base_resume_id, job_id, version)
);

alter table public.optimized_cvs enable row level security;

create policy "Users can manage own optimized CVs"
  on public.optimized_cvs for all
  using (
    auth.uid() = (select user_id from public.base_resumes where id = base_resume_id)
  );

-- 7. Application
create table if not exists public.applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  optimized_cv_id uuid references public.optimized_cvs(id),
  method          text not null check (method in ('manual', 'auto')),
  status          text not null check (status in ('submitted', 'failed', 'ambiguous', 'user_abandoned')),
  submitted_at    timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.applications enable row level security;

create policy "Users can manage own applications"
  on public.applications for all
  using (auth.uid() = user_id);

create index idx_applications_user on public.applications(user_id, created_at desc);

-- 8. ApplicationAuditLog
create table if not exists public.application_audit_logs (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications(id) on delete cascade,
  step            text not null,
  snapshot_url    text,
  field_values    jsonb,
  created_at      timestamptz not null default now()
);

alter table public.application_audit_logs enable row level security;

create policy "Users can read own audit logs"
  on public.application_audit_logs for select
  using (
    auth.uid() = (select user_id from public.applications where id = application_id)
  );

create index idx_audit_logs_app on public.application_audit_logs(application_id);

-- 9. SavedJob (bookmark/dismiss)
create table if not exists public.saved_jobs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  job_id     uuid not null references public.jobs(id) on delete cascade,
  state      text not null check (state in ('saved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique(user_id, job_id)
);

alter table public.saved_jobs enable row level security;

create policy "Users can manage own saved jobs"
  on public.saved_jobs for all
  using (auth.uid() = user_id);
