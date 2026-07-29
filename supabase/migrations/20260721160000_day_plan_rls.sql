-- Applied remotely as day_plan_rls_policies
-- day_plans + day_plan_spots already existed; this adds member RLS.

create or replace function public.is_day_plan_vacation_member(p_day_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_vacation_member(dp.vacation_id)
  from public.day_plans dp
  where dp.id = p_day_plan_id;
$$;

grant execute on function public.is_day_plan_vacation_member(uuid) to authenticated;

alter table public.day_plans enable row level security;
alter table public.day_plan_spots enable row level security;

create policy day_plans_select_member on public.day_plans
  for select using (public.is_vacation_member(vacation_id));
create policy day_plans_insert_member on public.day_plans
  for insert with check (public.is_vacation_member(vacation_id));
create policy day_plans_update_member on public.day_plans
  for update using (public.is_vacation_member(vacation_id))
  with check (public.is_vacation_member(vacation_id));
create policy day_plans_delete_member on public.day_plans
  for delete using (public.is_vacation_member(vacation_id));

create policy day_plan_spots_select_member on public.day_plan_spots
  for select using (public.is_day_plan_vacation_member(day_plan_id));
create policy day_plan_spots_insert_member on public.day_plan_spots
  for insert with check (public.is_day_plan_vacation_member(day_plan_id));
create policy day_plan_spots_update_member on public.day_plan_spots
  for update using (public.is_day_plan_vacation_member(day_plan_id))
  with check (public.is_day_plan_vacation_member(day_plan_id));
create policy day_plan_spots_delete_member on public.day_plan_spots
  for delete using (public.is_day_plan_vacation_member(day_plan_id));
