create table public.graduates_master (
  id uuid not null default gen_random_uuid (),
  student_id text not null,
  full_name text not null,
  email text null,
  course text null,
  batch_year integer null,
  verified boolean null default false,
  department text null,
  gender text null,
  constraint graduates_master_pkey primary key (id),
  constraint graduates_master_student_id_key unique (student_id),
  constraint graduates_master_gender_check check (
    (
      (gender is null)
      or (
        gender = any (array['Male'::text, 'Female'::text])
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_graduates_master_gender on public.graduates_master using btree (gender) TABLESPACE pg_default;
