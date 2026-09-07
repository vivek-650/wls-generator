-- White Label Resume Generator — initial schema
-- Run against a Supabase (Postgres) project. Supabase Auth is not used;
-- authentication is hand-rolled in the Express API against the `users` table below.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create type user_role as enum ('SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_MEMBER');
create type company_status as enum ('active', 'inactive');
create type source_file_type as enum ('pdf', 'docx');

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  theme_color text not null default '#1E1B4B',
  footer_text text,
  status company_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- company_id is nullable: SUPER_ADMIN accounts are platform-level and belong to no company.
create table users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  email citext not null unique,
  password_hash text not null,
  name text not null,
  role user_role not null,
  created_at timestamptz not null default now(),
  constraint company_required_unless_super_admin
    check (role = 'SUPER_ADMIN' or company_id is not null)
);

create index idx_users_company_id on users(company_id);

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_refresh_tokens_user_id on refresh_tokens(user_id);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  created_by uuid not null references users(id) on delete restrict,
  full_name text not null,
  email text,
  phone text,
  location text,
  summary text,
  source_file_url text,
  source_file_type source_file_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_candidates_company_id on candidates(company_id);

create table work_experience (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  company_name text,
  title text,
  start_date text,
  end_date text,
  is_current boolean not null default false,
  description text[] not null default '{}',
  sort_order int not null default 0
);

create index idx_work_experience_candidate_id on work_experience(candidate_id);

create table education (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  institution text,
  degree text,
  field text,
  start_date text,
  end_date text,
  sort_order int not null default 0
);

create index idx_education_candidate_id on education(candidate_id);

create table certifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  name text not null,
  issuer text,
  date text,
  sort_order int not null default 0
);

create index idx_certifications_candidate_id on certifications(candidate_id);

create table projects (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  name text not null,
  description text[] not null default '{}',
  tech_stack text[] not null default '{}',
  sort_order int not null default 0
);

create index idx_projects_candidate_id on projects(candidate_id);

create table candidate_skills (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  skill text not null,
  category text
);

create index idx_candidate_skills_candidate_id on candidate_skills(candidate_id);
create index idx_candidate_skills_skill on candidate_skills(skill);

create table parsed_resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  raw_json jsonb not null,
  parser_version text not null,
  created_at timestamptz not null default now()
);

create index idx_parsed_resumes_candidate_id on parsed_resumes(candidate_id);

create table generated_resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  pdf_url text not null,
  created_at timestamptz not null default now()
);

create index idx_generated_resumes_candidate_id on generated_resumes(candidate_id);
create index idx_generated_resumes_company_id on generated_resumes(company_id);
