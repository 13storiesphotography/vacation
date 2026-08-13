-- Vacation-scoped spot categories (label + icon), replacing fixed enum.

create table if not exists public.vacation_spot_categories (
  id uuid primary key default gen_random_uuid(),
  vacation_id uuid not null references public.vacations (id) on delete cascade,
  key text not null,
  label text not null,
  icon text not null,
  sort_order integer not null default 0,
  supports_overnight boolean not null default false,
  created_at timestamptz not null default now(),
  constraint vacation_spot_categories_key_format
    check (key ~ '^[a-z][a-z0-9_]{0,47}$'),
  constraint vacation_spot_categories_label_len
    check (char_length(trim(label)) between 1 and 40),
  constraint vacation_spot_categories_icon_len
    check (char_length(trim(icon)) between 1 and 40),
  unique (vacation_id, key)
);

create index if not exists vacation_spot_categories_vacation_idx
  on public.vacation_spot_categories (vacation_id, sort_order);

-- Spots.category becomes free text keyed to vacation_spot_categories.key
alter table public.spots
  alter column category drop default;

alter table public.spots
  alter column category type text
  using category::text;

alter table public.spots
  alter column category set default 'ort';

alter table public.spots
  add constraint spots_category_format
  check (category ~ '^[a-z][a-z0-9_]{0,47}$');

-- Seed built-in categories for every existing vacation.
insert into public.vacation_spot_categories (
  vacation_id, key, label, icon, sort_order, supports_overnight
)
select
  v.id,
  d.key,
  d.label,
  d.icon,
  d.sort_order,
  d.supports_overnight
from public.vacations v
cross join (
  values
    ('stellplatz', 'Stellplatz', 'van', 0, true),
    ('unterkunft', 'Unterkunft', 'home', 1, true),
    ('sehenswuerdigkeit', 'Sehenswürdigkeit', 'star', 2, false),
    ('ort', 'Ort', 'city', 3, false),
    ('freizeit', 'Freizeit', 'hike', 4, false),
    ('versorgung', 'Versorgung', 'bag', 5, false)
) as d(key, label, icon, sort_order, supports_overnight)
on conflict (vacation_id, key) do nothing;

-- Auto-seed defaults when a vacation is created.
create or replace function public.seed_vacation_spot_categories(p_vacation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.vacation_spot_categories (
    vacation_id, key, label, icon, sort_order, supports_overnight
  )
  values
    (p_vacation_id, 'stellplatz', 'Stellplatz', 'van', 0, true),
    (p_vacation_id, 'unterkunft', 'Unterkunft', 'home', 1, true),
    (p_vacation_id, 'sehenswuerdigkeit', 'Sehenswürdigkeit', 'star', 2, false),
    (p_vacation_id, 'ort', 'Ort', 'city', 3, false),
    (p_vacation_id, 'freizeit', 'Freizeit', 'hike', 4, false),
    (p_vacation_id, 'versorgung', 'Versorgung', 'bag', 5, false)
  on conflict (vacation_id, key) do nothing;
end;
$$;

create or replace function public.handle_vacation_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select lower(u.email) into v_email
  from auth.users u
  where u.id = new.created_by;

  insert into public.vacation_members (vacation_id, user_id, email, role, status, invited_by)
  values (
    new.id,
    new.created_by,
    coalesce(v_email, new.created_by::text),
    'admin',
    'active',
    new.created_by
  )
  on conflict (vacation_id, email) do update
    set user_id = excluded.user_id,
        role = 'admin',
        status = 'active';

  perform public.seed_vacation_spot_categories(new.id);

  return new;
end;
$$;

alter table public.vacation_spot_categories enable row level security;

create policy vacation_spot_categories_select_member
  on public.vacation_spot_categories
  for select
  using (public.is_vacation_member(vacation_id));

create policy vacation_spot_categories_insert_editor
  on public.vacation_spot_categories
  for insert
  with check (public.is_vacation_spots_editor(vacation_id));

create policy vacation_spot_categories_update_editor
  on public.vacation_spot_categories
  for update
  using (public.is_vacation_spots_editor(vacation_id))
  with check (public.is_vacation_spots_editor(vacation_id));

create policy vacation_spot_categories_delete_editor
  on public.vacation_spot_categories
  for delete
  using (public.is_vacation_spots_editor(vacation_id));

grant select, insert, update, delete on public.vacation_spot_categories to authenticated;
grant execute on function public.seed_vacation_spot_categories(uuid) to authenticated;
