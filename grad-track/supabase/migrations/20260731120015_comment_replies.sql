create table public.comment_replies (
  id uuid not null default gen_random_uuid (),
  comment_id uuid null,
  user_id uuid null,
  content text not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint comment_replies_pkey primary key (id),
  constraint comment_replies_comment_id_fkey foreign KEY (comment_id) references alumni_comments (id) on delete CASCADE,
  constraint comment_replies_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;