-- Shareable invite links + role-based member permissions

alter type public.member_role add value if not exists 'viewer';
alter type public.member_role rename value 'member' to 'editor';

alter table public.vacation_members
  add column if not exists invite_token uuid,
  add column if not exists invite_expires_at timestamp with time zone;

update public.vacation_members
set
  invite_token = coalesce(invite_token, gen_random_uuid()),
  invite_expires_at = coalesce(invite_expires_at, now() + interval '14 days')
where status = 'invited';

create unique index if not exists vacation_members_invite_token_key
  on public.vacation_members (invite_token)
  where invite_token is not null;

create or replace function public.is_vacation_editor(p_vacation_id uuid)
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
      and m.role in ('admin', 'editor')
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
      and public.is_vacation_editor(d.vacation_id)
  );
$$;

create or replace function public.get_vacation_invite(p_token uuid)
returns table (
  vacation_id uuid,
  vacation_title text,
  email text,
  role public.member_role,
  status public.member_status,
  invite_expires_at timestamp with time zone
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.vacation_id,
    v.title,
    m.email,
    m.role,
    m.status,
    m.invite_expires_at
  from public.vacation_members m
  join public.vacations v on v.id = m.vacation_id
  where m.invite_token = p_token
    and m.status = 'invited'
  limit 1;
$$;

create or replace function public.accept_vacation_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vacation_id uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.';
  end if;

  if v_email = '' then
    raise exception 'Keine E-Mail im Konto gefunden.';
  end if;

  update public.vacation_members m
  set
    user_id = auth.uid(),
    status = 'active',
    invite_token = null,
    invite_expires_at = null
  where m.invite_token = p_token
    and m.status = 'invited'
    and m.email = v_email
    and (m.invite_expires_at is null or m.invite_expires_at > now())
  returning m.vacation_id into v_vacation_id;

  if v_vacation_id is null then
    raise exception 'Einladung ungültig, abgelaufen oder gehört zu einer anderen E-Mail.';
  end if;

  return v_vacation_id;
end;
$$;

grant execute on function public.is_vacation_editor(uuid) to authenticated;
grant execute on function public.is_day_plan_vacation_editor(uuid) to authenticated;
grant execute on function public.get_vacation_invite(uuid) to anon, authenticated;
grant execute on function public.accept_vacation_invite(uuid) to authenticated;

drop policy if exists day_plans_delete_member on public.day_plans;
drop policy if exists day_plans_insert_member on public.day_plans;
drop policy if exists day_plans_update_member on public.day_plans;
create policy day_plans_delete_editor on public.day_plans
  for delete using (public.is_vacation_editor(vacation_id));
create policy day_plans_insert_editor on public.day_plans
  for insert with check (public.is_vacation_editor(vacation_id));
create policy day_plans_update_editor on public.day_plans
  for update using (public.is_vacation_editor(vacation_id))
  with check (public.is_vacation_editor(vacation_id));

drop policy if exists day_plan_spots_delete_member on public.day_plan_spots;
drop policy if exists day_plan_spots_insert_member on public.day_plan_spots;
drop policy if exists day_plan_spots_update_member on public.day_plan_spots;
create policy day_plan_spots_delete_editor on public.day_plan_spots
  for delete using (public.is_day_plan_vacation_editor(day_plan_id));
create policy day_plan_spots_insert_editor on public.day_plan_spots
  for insert with check (public.is_day_plan_vacation_editor(day_plan_id));
create policy day_plan_spots_update_editor on public.day_plan_spots
  for update using (public.is_day_plan_vacation_editor(day_plan_id))
  with check (public.is_day_plan_vacation_editor(day_plan_id));

drop policy if exists spots_delete_member on public.spots;
drop policy if exists spots_insert_member on public.spots;
drop policy if exists spots_update_member on public.spots;
create policy spots_delete_editor on public.spots
  for delete to authenticated using (public.is_vacation_editor(vacation_id));
create policy spots_insert_editor on public.spots
  for insert to authenticated with check (public.is_vacation_editor(vacation_id));
create policy spots_update_editor on public.spots
  for update to authenticated using (public.is_vacation_editor(vacation_id))
  with check (public.is_vacation_editor(vacation_id));
