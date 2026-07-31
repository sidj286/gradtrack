create table public.comment_likes (
  id uuid not null default gen_random_uuid (),
  comment_id uuid null,
  user_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint comment_likes_pkey primary key (id),
  constraint comment_likes_comment_id_user_id_key unique (comment_id, user_id),
  constraint comment_likes_comment_id_fkey foreign KEY (comment_id) references alumni_comments (id) on delete CASCADE,
  constraint comment_likes_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;