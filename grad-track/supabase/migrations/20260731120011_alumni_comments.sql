create table public.alumni_comments (
  id uuid not null default gen_random_uuid (),
  post_id uuid null,
  user_id uuid null,
  content text not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint alumni_comments_pkey primary key (id),
  constraint alumni_comments_post_id_fkey foreign KEY (post_id) references alumni_posts (id) on delete CASCADE,
  constraint alumni_comments_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_alumni_comments_post_id on public.alumni_comments using btree (post_id) TABLESPACE pg_default;