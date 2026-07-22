-- Day timing: optional day start + per-stop dwell. Arrive/depart are derived
-- from depart_at + dwell + drive minutes (Google Routes / estimate).

alter table public.day_plans
  add column if not exists depart_at time;

comment on column public.day_plans.depart_at is
  'Optional local clock time when the day starts (leave morning origin)';

alter table public.day_plan_spots
  add column if not exists dwell_minutes integer;

comment on column public.day_plan_spots.dwell_minutes is
  'Minutes spent at this stop; null uses the app default';

alter table public.day_plan_spots
  drop constraint if exists day_plan_spots_dwell_minutes_check;

alter table public.day_plan_spots
  add constraint day_plan_spots_dwell_minutes_check
  check (dwell_minutes is null or (dwell_minutes >= 0 and dwell_minutes <= 24 * 60));
