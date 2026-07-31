create table public.alumni_shares (
  id uuid not null default gen_random_uuid (),
  post_id uuid null,
  user_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint alumni_shares_pkey primary key (id),
  constraint alumni_shares_post_id_user_id_key unique (post_id, user_id),
  constraint alumni_shares_post_id_fkey foreign KEY (post_id) references alumni_posts (id) on delete CASCADE,
  constraint alumni_shares_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;