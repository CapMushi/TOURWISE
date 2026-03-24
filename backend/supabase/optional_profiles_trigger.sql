-- Optional: run in Supabase SQL Editor if you want every new auth user to get a profiles row
-- automatically (reduces reliance on the API "ensure profile" insert).
--
-- If a trigger on auth.users already exists in your project, skip or merge manually.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, updated_at)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), ''),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- Note: Email/password signup can pass username via options.data in the client;
-- this trigger reads raw_user_meta_data->username when present.
