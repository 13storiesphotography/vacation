-- Cost planner: line items + trip budget/fuel settings

create type public.cost_category as enum (
  'uebernachtung',
  'anschaffung',
  'sprit',
  'maut',
  'verpflegung',
  'aktivitaet',
  'sonstiges'
);

create type public.cost_status as enum (
  'geplant',
  'gebucht',
  'bezahlt'
);

alter table public.vacations
  add column if not exists currency text not null default 'EUR',
  add column if not exists budget_total numeric(12,2),
  add column if not exists fuel_l_per_100km numeric(6,2) default 9.5,
  add column if not exists fuel_price_per_liter numeric(8,2) default 1.75;

alter table public.spots
  add column if not exists price_per_night numeric(12,2);

create table if not exists public.cost_items (
  id uuid primary key default gen_random_uuid(),
  vacation_id uuid not null references public.vacations (id) on delete cascade,
  category public.cost_category not null default 'sonstiges',
  title text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text,
  status public.cost_status not null default 'geplant',
  notes text,
  spot_id uuid references public.spots (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cost_items_vacation_id_idx
  on public.cost_items (vacation_id, created_at desc);

create index if not exists cost_items_category_idx
  on public.cost_items (vacation_id, category);

alter table public.cost_items enable row level security;

create policy cost_items_select_member
  on public.cost_items for select
  using (public.is_vacation_member(vacation_id));

create policy cost_items_insert_editor
  on public.cost_items for insert
  with check (public.is_vacation_editor(vacation_id));

create policy cost_items_update_editor
  on public.cost_items for update
  using (public.is_vacation_editor(vacation_id))
  with check (public.is_vacation_editor(vacation_id));

create policy cost_items_delete_editor
  on public.cost_items for delete
  using (public.is_vacation_editor(vacation_id));

grant select, insert, update, delete on public.cost_items to authenticated;
