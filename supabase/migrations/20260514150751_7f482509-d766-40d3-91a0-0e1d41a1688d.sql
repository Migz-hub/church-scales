drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_self_or_same_ministry"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.ministry_members mm1
      join public.ministry_members mm2 on mm1.ministry_id = mm2.ministry_id
      where mm1.user_id = auth.uid()
        and mm2.user_id = profiles.id
    )
  );