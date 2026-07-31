create table public.alumni_posts (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  content text not null,
  post_type text null default 'status'::text,
  image_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint alumni_posts_pkey primary key (id),
  constraint alumni_posts_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_alumni_posts_user_id on public.alumni_posts using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_alumni_posts_created_at on public.alumni_posts using btree (created_at desc) TABLESPACE pg_default;