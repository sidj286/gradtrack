create table public.alumni_activities (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  activity_type text not null,
  description text not null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  constraint alumni_activities_pkey primary key (id),
  constraint alumni_activities_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_alumni_activities_user on public.alumni_activities using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_alumni_activities_created on public.alumni_activities using btree (created_at desc) TABLESPACE pg_default;