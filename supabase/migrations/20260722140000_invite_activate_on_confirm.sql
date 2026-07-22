-- Invite acceptance: do not mark members active when inviteUserByEmail
-- creates the auth.users row. Stay "invited" until email is confirmed
-- (invite link clicked / first successful auth).

create or replace function public.claim_vacation_invites()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Link the auth user to open invites, but only activate if already confirmed
  -- (e.g. pre-existing account). Fresh inviteUserByEmail users stay "invited".
  update public.vacation_members
  set
    user_id = new.id,
    status = case
      when new.email_confirmed_at is not null then 'active'::public.member_status
      else status
    end
  where lower(email) = lower(new.email)
    and status = 'invited'
    and (user_id is null or user_id = new.id);

  return new;
end;
$function$;

create or replace function public.activate_vacation_members_on_confirm()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.vacation_members
    set
      user_id = coalesce(user_id, new.id),
      status = 'active'
    where lower(email) = lower(new.email)
      and status = 'invited';
  end if;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_confirm_activate on auth.users;
create trigger on_auth_user_confirm_activate
  after update of email_confirmed_at on auth.users
  for each row
  execute function public.activate_vacation_members_on_confirm();

-- Helper for app/auth callback: activate any pending invites for this user.
create or replace function public.activate_my_vacation_invites()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  mail text;
  updated integer := 0;
begin
  if uid is null then
    return 0;
  end if;

  select lower(email) into mail from auth.users where id = uid;
  if mail is null then
    return 0;
  end if;

  update public.vacation_members
  set
    user_id = uid,
    status = 'active'
  where lower(email) = mail
    and status = 'invited';

  get diagnostics updated = row_count;
  return updated;
end;
$function$;

revoke all on function public.activate_my_vacation_invites() from public;
grant execute on function public.activate_my_vacation_invites() to authenticated;

-- Repair: members that were auto-activated by inviteUserByEmail before confirm.
update public.vacation_members vm
set status = 'invited'
from auth.users u
where vm.user_id = u.id
  and vm.status = 'active'
  and vm.role = 'member'
  and u.email_confirmed_at is null;
