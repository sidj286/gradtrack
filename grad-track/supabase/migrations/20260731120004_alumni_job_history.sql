create table public.alumni_job_history (
  id uuid not null default gen_random_uuid (),
  alumni_id uuid null,
  company text not null,
  job_title text not null,
  start_date date not null default CURRENT_DATE,
  end_date date null,
  is_current boolean null default false,
  industry text null,
  location text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint alumni_job_history_pkey primary key (id),
  constraint alumni_job_history_alumni_id_fkey foreign KEY (alumni_id) references alumni_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_alumni_job_history_alumni_id on public.alumni_job_history using btree (alumni_id) TABLESPACE pg_default;