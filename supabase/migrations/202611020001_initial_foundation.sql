create extension if not exists pgcrypto;

create type public.user_role as enum ('administrator', 'operator');
create type public.machine_status as enum ('active', 'inactive', 'maintenance');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  location text not null default '',
  status public.machine_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'operator');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.machines enable row level security;

create policy "Users can read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Administrators can read all profiles" on public.profiles
  for select to authenticated using ((select public.current_user_role()) = 'administrator');
create policy "Administrators can manage profiles" on public.profiles
  for all to authenticated using ((select public.current_user_role()) = 'administrator')
  with check ((select public.current_user_role()) = 'administrator');
create policy "Authenticated users can read machines" on public.machines
  for select to authenticated using (true);
create policy "Administrators can manage machines" on public.machines
  for all to authenticated using ((select public.current_user_role()) = 'administrator')
  with check ((select public.current_user_role()) = 'administrator');

grant usage on schema public to authenticated;
grant select on public.machines to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.machines to authenticated;
grant execute on function public.current_user_role() to authenticated;

insert into public.machines (code, name, location)
values
  ('M1', 'Máquina 1', ''),
  ('M2', 'Máquina 2', ''),
  ('M3', 'Máquina 3', '')
on conflict (code) do nothing;
