-- Run in Supabase SQL Editor if admin role tables do not already exist.
-- This creates the admin role model used by /api/me and /api/admin/*.
--
-- After running this file, assign your admin account by replacing
-- 'YOUR_AUTH_USER_UUID_HERE' in the final insert statement.

create table if not exists public.admin_roles (
  role_id bigint generated always as identity primary key,
  role_name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_admin_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id bigint not null references public.admin_roles(role_id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

insert into public.admin_roles (role_name, description)
values
  ('super_admin', 'Full TourWise admin access'),
  ('support_admin', 'Support and user-management access'),
  ('content_admin', 'Trip/content moderation access'),
  ('finance_admin', 'Finance and payout access')
on conflict (role_name) do update
set description = excluded.description;

-- Replace the UUID below with the Supabase auth user ID you want to grant admin access to.
-- The default bootstrap role here is super_admin.
insert into public.user_admin_roles (user_id, role_id, assigned_by)
select
  'YOUR_AUTH_USER_UUID_HERE'::uuid,
  role_id,
  'YOUR_AUTH_USER_UUID_HERE'::uuid
from public.admin_roles
where role_name = 'super_admin'
on conflict (user_id, role_id) do nothing;
