-- Fine-grained vacation member permissions

alter type public.member_role add value if not exists 'custom';

alter table public.vacation_members
  add column if not exists can_manage_team boolean not null default false,
  add column if not exists can_edit_vacation boolean not null default false,
  add column if not exists can_edit_spots boolean not null default false,
  add column if not exists can_edit_plan boolean not null default false;

update public.vacation_members
set
  can_manage_team = case when role = 'admin' then true else false end,
  can_edit_vacation = case when role = 'admin' then true else false end,
  can_edit_spots = case when role in ('admin', 'editor') then true else false end,
  can_edit_plan = case when role in ('admin', 'editor') then true else false end
where true;

create or replace function public.is_vacation_team_manager(p_vacation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vacation_members m
    where m.vacation_id = p_vacation_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.can_manage_team
  );
$$;

create or replace function public.is_vacation_settings_editor(p_vacation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vacation_members m
    where m.vacation_id = p_vacation_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.can_edit_vacation
  );
$$;

create or replace function public.is_vacation_spots_editor(p_vacation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vacation_members m
    where m.vacation_id = p_vacation_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.can_edit_spots
  );
$$;

create or replace function public.is_vacation_plan_editor(p_vacation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vacation_members m
    where m.vacation_id = p_vacation_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.can_edit_plan
  );
$$;

create or replace function public.is_day_plan_vacation_editor(p_day_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.day_plans d
    where d.id = p_day_plan_id
      and public.is_vacation_plan_editor(d.vacation_id)
  );
$$;

create or replace function public.is_vacation_admin(p_vacation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_vacation_team_manager(p_vacation_id);
$$;

create or replace function public.is_vacation_editor(p_vacation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_vacation_spots_editor(p_vacation_id)
      or public.is_vacation_plan_editor(p_vacation_id)
      or public.is_vacation_settings_editor(p_vacation_id);
$$;

grant execute on function public.is_vacation_team_manager(uuid) to authenticated;
grant execute on function public.is_vacation_settings_editor(uuid) to authenticated;
grant execute on function public.is_vacation_spots_editor(uuid) to authenticated;
grant execute on function public.is_vacation_plan_editor(uuid) to authenticated;

drop policy if exists members_delete_admin on public.vacation_members;
drop policy if exists members_insert_admin on public.vacation_members;
drop policy if exists members_update_admin on public.vacation_members;
create policy members_delete_team_manager on public.vacation_members
  for delete to authenticated using (public.is_vacation_team_manager(vacation_id));
create policy members_insert_team_manager on public.vacation_members
  for insert to authenticated with check (public.is_vacation_team_manager(vacation_id));
create policy members_update_team_manager on public.vacation_members
  for update to authenticated using (public.is_vacation_team_manager(vacation_id))
  with check (public.is_vacation_team_manager(vacation_id));

drop policy if exists vacations_update_admin on public.vacations;
create policy vacations_update_settings_editor on public.vacations
  for update to authenticated using (public.is_vacation_settings_editor(id))
  with check (public.is_vacation_settings_editor(id));

drop policy if exists spots_delete_editor on public.spots;
drop policy if exists spots_insert_editor on public.spots;
drop policy if exists spots_update_editor on public.spots;
create policy spots_delete_spots_editor on public.spots
  for delete to authenticated using (public.is_vacation_spots_editor(vacation_id));
create policy spots_insert_spots_editor on public.spots
  for insert to authenticated with check (public.is_vacation_spots_editor(vacation_id));
create policy spots_update_spots_editor on public.spots
  for update to authenticated using (public.is_vacation_spots_editor(vacation_id))
  with check (public.is_vacation_spots_editor(vacation_id));

drop policy if exists day_plans_delete_editor on public.day_plans;
drop policy if exists day_plans_insert_editor on public.day_plans;
drop policy if exists day_plans_update_editor on public.day_plans;
create policy day_plans_delete_plan_editor on public.day_plans
  for delete using (public.is_vacation_plan_editor(vacation_id));
create policy day_plans_insert_plan_editor on public.day_plans
  for insert with check (public.is_vacation_plan_editor(vacation_id));
create policy day_plans_update_plan_editor on public.day_plans
  for update using (public.is_vacation_plan_editor(vacation_id))
  with check (public.is_vacation_plan_editor(vacation_id));

drop policy if exists day_plan_spots_delete_editor on public.day_plan_spots;
drop policy if exists day_plan_spots_insert_editor on public.day_plan_spots;
drop policy if exists day_plan_spots_update_editor on public.day_plan_spots;
create policy day_plan_spots_delete_plan_editor on public.day_plan_spots
  for delete using (public.is_day_plan_vacation_editor(day_plan_id));
create policy day_plan_spots_insert_plan_editor on public.day_plan_spots
  for insert with check (public.is_day_plan_vacation_editor(day_plan_id));
create policy day_plan_spots_update_plan_editor on public.day_plan_spots
  for update using (public.is_day_plan_vacation_editor(day_plan_id))
  with check (public.is_day_plan_vacation_editor(day_plan_id));
