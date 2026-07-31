create table public.announcements (
  id uuid not null default gen_random_uuid (),
  title text not null,
  content text not null,
  category text not null,
  target_type text null default 'all'::text,
  target_course text null,
  target_batch_year integer null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  published boolean null default true,
  constraint announcements_pkey primary key (id),
  constraint announcements_created_by_fkey foreign KEY (created_by) references users (id)
) TABLESPACE pg_default;

create index IF not exists idx_announcements_category on public.announcements using btree (category) TABLESPACE pg_default;

create index IF not exists idx_announcements_target on public.announcements using btree (target_type, target_course, target_batch_year) TABLESPACE pg_default;