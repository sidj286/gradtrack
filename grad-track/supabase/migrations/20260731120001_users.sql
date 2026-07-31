create table public.users (
  id uuid not null,
  email text null,
  role text null default 'Alumni'::text,
  created_at timestamp with time zone null default now(),
  admin boolean null default false,
  full_name text null,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint users_role_check check (
    (role = any (array['Admin'::text, 'Alumni'::text]))
  )
) TABLESPACE pg_default;