create table public.announcement_comments (
  id uuid not null default gen_random_uuid (),
  announcement_id uuid not null,
  user_id uuid not null,
  content text not null,
  parent_comment_id uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint announcement_comments_pkey primary key (id),
  constraint announcement_comments_announcement_id_fkey foreign KEY (announcement_id) references announcements (id) on delete CASCADE,
  constraint announcement_comments_parent_comment_id_fkey foreign KEY (parent_comment_id) references announcement_comments (id) on delete CASCADE,
  constraint announcement_comments_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;