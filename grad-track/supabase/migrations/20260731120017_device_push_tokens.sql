create table public.device_push_tokens (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  platform text not null,
  fcm_token text not null,
  created_at timestamp with time zone not null default now(),
  constraint device_push_tokens_pkey primary key (id),
  constraint device_push_tokens_fcm_token_key unique (fcm_token),
  constraint device_push_tokens_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint device_push_tokens_platform_check check (
    (
      platform = any (array['ios'::text, 'android'::text])
    )
  )
) TABLESPACE pg_default;