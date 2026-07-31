create table public.reply_likes (
  id uuid not null default gen_random_uuid (),
  reply_id uuid null,
  user_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint reply_likes_pkey primary key (id),
  constraint reply_likes_reply_id_user_id_key unique (reply_id, user_id),
  constraint reply_likes_reply_id_fkey foreign KEY (reply_id) references comment_replies (id) on delete CASCADE,
  constraint reply_likes_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;