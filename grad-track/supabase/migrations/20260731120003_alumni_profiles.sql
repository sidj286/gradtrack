create table public.alumni_profiles (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  full_name text null,
  course text null,
  batch_year integer null,
  company text null,
  job_title text null,
  industry text null,
  location text null,
  employment_status text null,
  linkedin_url text null,
  auto_sync_enabled boolean null default false,
  last_synced_at timestamp with time zone null,
  career_alignment_status text null,
  ai_confidence_score double precision null,
  profile_completion integer null default 0,
  avatar_url text null,
  verified_grad boolean null default false,
  verified_at timestamp with time zone null,
  email text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  registered_at timestamp with time zone null default now(),
  student_id text null,
  department text null,
  gender text null,
  last_reminder_sent_at timestamp with time zone null,
  constraint alumni_profiles_pkey primary key (id),
  constraint alumni_profiles_student_id_key unique (student_id),
  constraint alumni_profiles_user_id_key unique (user_id),
  constraint alumni_profiles_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint alumni_profiles_gender_check check (
    (
      (gender is null)
      or (
        gender = any (array['Male'::text, 'Female'::text])
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_alumni_profiles_student_id on public.alumni_profiles using btree (student_id) TABLESPACE pg_default;

create index IF not exists idx_alumni_profiles_department on public.alumni_profiles using btree (department) TABLESPACE pg_default;

create index IF not exists idx_alumni_profiles_gender on public.alumni_profiles using btree (gender) TABLESPACE pg_default;