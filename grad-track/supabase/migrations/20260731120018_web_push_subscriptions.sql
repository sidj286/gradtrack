create table public.web_push_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamp with time zone not null default now(),
  constraint web_push_subscriptions_pkey primary key (id),
  constraint web_push_subscriptions_endpoint_key unique (endpoint),
  constraint web_push_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;