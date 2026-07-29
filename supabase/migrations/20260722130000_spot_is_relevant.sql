-- Shared trip relevance on spots (collection vs decision).
alter table public.spots
  add column if not exists is_relevant boolean not null default true;

comment on column public.spots.is_relevant is
  'Shared trip decision: include in planning/map by default when true';
