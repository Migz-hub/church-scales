-- Enums
create type public.app_role as enum ('owner', 'admin', 'leader', 'member');
create type public.assignment_status as enum ('pending', 'confirmed', 'declined');
create type public.notification_type as enum (
  'joined_ministry','added_to_schedule','schedule_created','schedule_updated',
  'join_request','join_request_approved','join_request_rejected'
);
create type public.announcement_priority as enum ('normal', 'important', 'urgent');
create type public.announcement_audience_kind as enum ('all', 'admins', 'team', 'function');
create type public.join_request_status as enum ('pending', 'approved', 'rejected');
create type public.schedule_history_kind as enum ('created', 'updated', 'unavailability', 'attendance');

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ministries
create table public.ministries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  invites_enabled boolean not null default true,
  owner_id uuid not null references auth.users(id) on delete restrict,
  description text,
  banner_url text,
  avatar_url text,
  default_permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ministries enable row level security;
create index ministries_owner_idx on public.ministries(owner_id);
create trigger ministries_updated_at before update on public.ministries for each row execute function public.update_updated_at_column();

-- ministry_members + user_roles
create table public.ministry_members (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (ministry_id, user_id)
);
alter table public.ministry_members enable row level security;
create index ministry_members_user_idx on public.ministry_members(user_id);
create index ministry_members_ministry_idx on public.ministry_members(ministry_id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, ministry_id, role)
);
alter table public.user_roles enable row level security;
create index user_roles_user_idx on public.user_roles(user_id);
create index user_roles_ministry_idx on public.user_roles(ministry_id);

create or replace function public.is_member_of(_user_id uuid, _ministry_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ministry_members where user_id = _user_id and ministry_id = _ministry_id);
$$;
create or replace function public.has_role(_user_id uuid, _ministry_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and ministry_id = _ministry_id and role = _role);
$$;
create or replace function public.has_any_role(_user_id uuid, _ministry_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and ministry_id = _ministry_id and role = any(_roles));
$$;
revoke execute on function public.is_member_of(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.has_role(uuid, uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.has_any_role(uuid, uuid, public.app_role[]) from public, anon, authenticated;

create policy "ministries_select_members" on public.ministries for select to authenticated using (public.is_member_of(auth.uid(), id));
create policy "ministries_insert_authenticated" on public.ministries for insert to authenticated with check (auth.uid() = owner_id);
create policy "ministries_update_admins" on public.ministries for update to authenticated
  using (public.has_any_role(auth.uid(), id, array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), id, array['owner','admin']::public.app_role[]));
create policy "ministries_delete_owner" on public.ministries for delete to authenticated using (public.has_role(auth.uid(), id, 'owner'));

create policy "members_select_same_ministry" on public.ministry_members for select to authenticated using (public.is_member_of(auth.uid(), ministry_id));
create policy "members_insert_self_or_admin" on public.ministry_members for insert to authenticated
  with check (user_id = auth.uid() or public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));
create policy "members_delete_self_or_admin" on public.ministry_members for delete to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));

create policy "roles_select_same_ministry" on public.user_roles for select to authenticated using (public.is_member_of(auth.uid(), ministry_id));
create policy "roles_insert_admins_or_self_initial" on public.user_roles for insert to authenticated
  with check (
    public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[])
    or (user_id = auth.uid() and role = 'owner' and not exists (select 1 from public.user_roles ur where ur.ministry_id = user_roles.ministry_id))
    or (user_id = auth.uid() and role = 'member')
  );
create policy "roles_update_admins" on public.user_roles for update to authenticated
  using (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));
create policy "roles_delete_admins_or_self" on public.user_roles for delete to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));

-- ministry_join_requests
create table public.ministry_join_requests (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.join_request_status not null default 'pending',
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ministry_join_requests enable row level security;
create index join_requests_ministry_idx on public.ministry_join_requests(ministry_id);
create policy "join_requests_select_self_or_admin" on public.ministry_join_requests for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));
create policy "join_requests_insert_self" on public.ministry_join_requests for insert to authenticated with check (user_id = auth.uid());
create policy "join_requests_update_admins" on public.ministry_join_requests for update to authenticated
  using (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));

-- ministry_functions, ministry_teams, ministry_team_functions
create table public.ministry_functions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  name text not null, icon text, active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.ministry_functions enable row level security;
create index ministry_functions_ministry_idx on public.ministry_functions(ministry_id);

create table public.ministry_teams (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  name text not null, created_at timestamptz not null default now()
);
alter table public.ministry_teams enable row level security;
create index ministry_teams_ministry_idx on public.ministry_teams(ministry_id);

create table public.ministry_team_functions (
  team_id uuid not null references public.ministry_teams(id) on delete cascade,
  function_id uuid not null references public.ministry_functions(id) on delete cascade,
  primary key (team_id, function_id)
);
alter table public.ministry_team_functions enable row level security;

create policy "functions_select_members" on public.ministry_functions for select to authenticated using (public.is_member_of(auth.uid(), ministry_id));
create policy "functions_write_admins" on public.ministry_functions for all to authenticated
  using (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));
create policy "teams_select_members" on public.ministry_teams for select to authenticated using (public.is_member_of(auth.uid(), ministry_id));
create policy "teams_write_admins" on public.ministry_teams for all to authenticated
  using (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));
create policy "team_functions_select_members" on public.ministry_team_functions for select to authenticated
  using (exists (select 1 from public.ministry_teams t where t.id = team_id and public.is_member_of(auth.uid(), t.ministry_id)));
create policy "team_functions_write_admins" on public.ministry_team_functions for all to authenticated
  using (exists (select 1 from public.ministry_teams t where t.id = team_id and public.has_any_role(auth.uid(), t.ministry_id, array['owner','admin']::public.app_role[])))
  with check (exists (select 1 from public.ministry_teams t where t.id = team_id and public.has_any_role(auth.uid(), t.ministry_id, array['owner','admin']::public.app_role[])));

-- member_permissions
create table public.member_permissions (
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  member_id uuid not null references public.ministry_members(id) on delete cascade,
  overrides jsonb not null default '{}'::jsonb,
  function_ids uuid[] not null default '{}',
  primary key (ministry_id, member_id)
);
alter table public.member_permissions enable row level security;
create policy "member_perms_select_members" on public.member_permissions for select to authenticated using (public.is_member_of(auth.uid(), ministry_id));
create policy "member_perms_write_admins" on public.member_permissions for all to authenticated
  using (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));

-- schedules + agenda + assignments
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  title text not null, date timestamptz not null, description text,
  published boolean not null default false, require_confirmation boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.schedules enable row level security;
create index schedules_ministry_idx on public.schedules(ministry_id);
create trigger schedules_updated_at before update on public.schedules for each row execute function public.update_updated_at_column();
create policy "schedules_select_members" on public.schedules for select to authenticated using (public.is_member_of(auth.uid(), ministry_id));
create policy "schedules_insert_leaders" on public.schedules for insert to authenticated
  with check (public.has_any_role(auth.uid(), ministry_id, array['owner','admin','leader']::public.app_role[]));
create policy "schedules_update_leaders" on public.schedules for update to authenticated
  using (public.has_any_role(auth.uid(), ministry_id, array['owner','admin','leader']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), ministry_id, array['owner','admin','leader']::public.app_role[]));
create policy "schedules_delete_admins" on public.schedules for delete to authenticated
  using (public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));

create table public.schedule_agenda_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  name text not null, description text, position int not null default 0
);
alter table public.schedule_agenda_items enable row level security;
create index agenda_schedule_idx on public.schedule_agenda_items(schedule_id);
create policy "agenda_select_members" on public.schedule_agenda_items for select to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.is_member_of(auth.uid(), s.ministry_id)));
create policy "agenda_write_leaders" on public.schedule_agenda_items for all to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.has_any_role(auth.uid(), s.ministry_id, array['owner','admin','leader']::public.app_role[])))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and public.has_any_role(auth.uid(), s.ministry_id, array['owner','admin','leader']::public.app_role[])));

create table public.schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  label text not null, user_id uuid references auth.users(id) on delete set null,
  status public.assignment_status not null default 'pending', attended boolean
);
alter table public.schedule_assignments enable row level security;
create index assignments_schedule_idx on public.schedule_assignments(schedule_id);
create index assignments_user_idx on public.schedule_assignments(user_id);
create policy "assignments_select_members" on public.schedule_assignments for select to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.is_member_of(auth.uid(), s.ministry_id)));
create policy "assignments_write_leaders" on public.schedule_assignments for insert to authenticated
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and public.has_any_role(auth.uid(), s.ministry_id, array['owner','admin','leader']::public.app_role[])));
create policy "assignments_delete_leaders" on public.schedule_assignments for delete to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.has_any_role(auth.uid(), s.ministry_id, array['owner','admin','leader']::public.app_role[])));
create policy "assignments_update_leaders" on public.schedule_assignments for update to authenticated
  using (exists (select 1 from public.schedules s where s.id = schedule_id and public.has_any_role(auth.uid(), s.ministry_id, array['owner','admin','leader']::public.app_role[])))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id and public.has_any_role(auth.uid(), s.ministry_id, array['owner','admin','leader']::public.app_role[])));
create policy "assignments_update_self" on public.schedule_assignments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- chat_messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null, created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
create index chat_ministry_idx on public.chat_messages(ministry_id, created_at);
create policy "chat_select_members" on public.chat_messages for select to authenticated using (public.is_member_of(auth.uid(), ministry_id));
create policy "chat_insert_members" on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_member_of(auth.uid(), ministry_id));
create policy "chat_delete_self_or_admin" on public.chat_messages for delete to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ministry_id uuid references public.ministries(id) on delete cascade,
  type public.notification_type not null, title text not null, body text,
  read boolean not null default false, created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create policy "notifications_select_own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_insert_member" on public.notifications for insert to authenticated
  with check (ministry_id is null or public.is_member_of(auth.uid(), ministry_id));
create policy "notifications_delete_own" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- announcements + reads
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  title text not null, message text not null,
  priority public.announcement_priority not null default 'normal',
  audience_kind public.announcement_audience_kind not null default 'all',
  audience_team_id uuid references public.ministry_teams(id) on delete set null,
  audience_function_id uuid references public.ministry_functions(id) on delete set null,
  scheduled_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create index announcements_ministry_idx on public.announcements(ministry_id, created_at desc);

-- Audience-aware SELECT policy: filter at the database, not in the client
create policy "announcements_select_audience" on public.announcements for select to authenticated
  using (
    public.is_member_of(auth.uid(), ministry_id)
    and (
      created_by = auth.uid()
      or public.has_any_role(auth.uid(), ministry_id, array['owner','admin','leader']::public.app_role[])
      or audience_kind = 'all'
      or (audience_kind = 'admins' and public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]))
      or (audience_kind = 'function' and exists (
            select 1 from public.member_permissions mp
            join public.ministry_members mm on mm.id = mp.member_id
            where mm.ministry_id = announcements.ministry_id
              and mm.user_id = auth.uid()
              and audience_function_id = any(mp.function_ids)
          ))
      or (audience_kind = 'team' and exists (
            select 1 from public.member_permissions mp
            join public.ministry_members mm on mm.id = mp.member_id
            join public.ministry_team_functions tf on tf.team_id = audience_team_id
            where mm.ministry_id = announcements.ministry_id
              and mm.user_id = auth.uid()
              and tf.function_id = any(mp.function_ids)
          ))
    )
  );
create policy "announcements_write_leaders" on public.announcements for all to authenticated
  using (public.has_any_role(auth.uid(), ministry_id, array['owner','admin','leader']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), ministry_id, array['owner','admin','leader']::public.app_role[]));

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
alter table public.announcement_reads enable row level security;
create policy "announcement_reads_select_own" on public.announcement_reads for select to authenticated using (user_id = auth.uid());
create policy "announcement_reads_insert_own" on public.announcement_reads for insert to authenticated with check (user_id = auth.uid());
create policy "announcement_reads_delete_own" on public.announcement_reads for delete to authenticated using (user_id = auth.uid());

-- unavailabilities
create table public.unavailabilities (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text, starts_at timestamptz not null, ends_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.unavailabilities enable row level security;
create index unavailabilities_ministry_idx on public.unavailabilities(ministry_id, starts_at, ends_at);
create index unavailabilities_user_idx on public.unavailabilities(user_id);
create policy "unavailabilities_select_members" on public.unavailabilities for select to authenticated using (public.is_member_of(auth.uid(), ministry_id));
create policy "unavailabilities_insert_self_or_admin" on public.unavailabilities for insert to authenticated
  with check (user_id = auth.uid() or public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));
create policy "unavailabilities_update_self_or_admin" on public.unavailabilities for update to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));
create policy "unavailabilities_delete_self_or_admin" on public.unavailabilities for delete to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), ministry_id, array['owner','admin']::public.app_role[]));

-- schedule_history
create table public.schedule_history (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  schedule_date timestamptz not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  kind public.schedule_history_kind not null,
  summary text, changes jsonb, added_members jsonb, removed_members jsonb, details jsonb,
  created_at timestamptz not null default now()
);
alter table public.schedule_history enable row level security;
create index schedule_history_ministry_idx on public.schedule_history(ministry_id, created_at desc);
create index schedule_history_schedule_idx on public.schedule_history(schedule_id);
create policy "history_select_members" on public.schedule_history for select to authenticated using (public.is_member_of(auth.uid(), ministry_id));
create policy "history_insert_members" on public.schedule_history for insert to authenticated
  with check (actor_id = auth.uid() and public.is_member_of(auth.uid(), ministry_id));