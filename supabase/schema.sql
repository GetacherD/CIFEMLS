-- =====================================================================
-- QIFEMLS - Aircraft media / software loader tracking
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
-- Roles: mcc_admin, workshop, store, mechanic
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'mechanic'
              check (role in ('mcc_admin','workshop','store','mechanic')),
  created_at  timestamptz not null default now()
);

-- A system type is a family of things that get loaded (IFE today; lighting
-- configuration, intercom software, ... later). Adding one is just a row.
create table if not exists public.system_types (
  id    uuid primary key default gen_random_uuid(),
  code  text not null unique,
  name  text not null
);

-- Media or software item with its identifying labels.
create table if not exists public.items (
  id             uuid primary key default gen_random_uuid(),
  system_type_id uuid not null references public.system_types(id),
  kind           text not null check (kind in ('media','software')),
  part_number    text not null,
  version        text not null,
  code           text,              -- serial number / label / code
  description    text,
  properties     jsonb not null default '{}'::jsonb,   -- any extra named properties
  created_at     timestamptz not null default now(),
  unique (system_type_id, kind, part_number, version)
);

create table if not exists public.aircraft_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- Expected item per group / system / kind. The row with effective_to IS NULL
-- is the current requirement; closed rows are the history.
create table if not exists public.group_requirements (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.aircraft_groups(id) on delete cascade,
  system_type_id uuid not null references public.system_types(id),
  kind           text not null check (kind in ('media','software')),
  item_id        uuid not null references public.items(id),
  effective_from timestamptz not null default now(),
  effective_to   timestamptz,
  set_by         uuid references public.profiles(id)
);
create unique index if not exists uq_group_req_current
  on public.group_requirements (group_id, system_type_id, kind)
  where effective_to is null;

create table if not exists public.aircraft (
  id           uuid primary key default gen_random_uuid(),
  registration text not null unique,
  group_id     uuid references public.aircraft_groups(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text
);

create table if not exists public.loaders (
  id          uuid primary key default gen_random_uuid(),
  loader_no   text not null unique,
  kind        text not null check (kind in ('media','software')),
  part_number   text,                 -- loader's own part number
  serial_number text,                 -- loader's own serial number
  location_id   uuid references public.locations(id),   -- the store
  bin           text,                 -- bin / shelf inside the store
  active        boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.loader_items (
  loader_id uuid not null references public.loaders(id) on delete cascade,
  item_id   uuid not null references public.items(id),
  loaded_at timestamptz not null default now(),
  loaded_by uuid references public.profiles(id),
  primary key (loader_id, item_id)
);

create table if not exists public.loader_location_history (
  id               uuid primary key default gen_random_uuid(),
  loader_id        uuid not null references public.loaders(id) on delete cascade,
  from_location_id uuid references public.locations(id),
  to_location_id   uuid references public.locations(id),
  from_bin         text,
  to_bin           text,
  moved_at         timestamptz not null default now(),
  moved_by         uuid references public.profiles(id),
  note             text
);

-- What is installed on each aircraft right now (one row per system + kind).
create table if not exists public.aircraft_installed (
  aircraft_id    uuid not null references public.aircraft(id) on delete cascade,
  system_type_id uuid not null references public.system_types(id),
  kind           text not null check (kind in ('media','software')),
  item_id        uuid not null references public.items(id),
  installed_at   timestamptz not null default now(),
  installed_by   uuid references public.profiles(id),
  primary key (aircraft_id, system_type_id, kind)
);

create table if not exists public.aircraft_install_log (
  id           uuid primary key default gen_random_uuid(),
  aircraft_id  uuid not null references public.aircraft(id) on delete cascade,
  item_id      uuid not null references public.items(id),
  loader_id    uuid references public.loaders(id) on delete set null,
  installed_at timestamptz not null default now(),
  installed_by uuid references public.profiles(id),
  note         text
);

create index if not exists idx_aircraft_group      on public.aircraft(group_id);
create index if not exists idx_loader_items_item   on public.loader_items(item_id);
create index if not exists idx_loader_loc_hist     on public.loader_location_history(loader_id, moved_at desc);
create index if not exists idx_install_log_aircraft on public.aircraft_install_log(aircraft_id, installed_at desc);

-- ---------------------------------------------------------------------
-- 1b. Columns added later (makes this script safe on older databases)
-- ---------------------------------------------------------------------
alter table public.items add column if not exists properties jsonb not null default '{}'::jsonb;
alter table public.loaders add column if not exists part_number   text;
alter table public.loaders add column if not exists serial_number text;
alter table public.loaders add column if not exists bin           text;
alter table public.loader_location_history add column if not exists from_bin text;
alter table public.loader_location_history add column if not exists to_bin   text;

-- A loader's part number + serial number pair is unique.
create unique index if not exists uq_loader_pn_sn
  on public.loaders (part_number, serial_number)
  where part_number is not null and serial_number is not null;

-- ---------------------------------------------------------------------
-- 2. Helper functions and triggers
-- ---------------------------------------------------------------------
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.require_role(variadic allowed text[])
returns void language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role into r from public.profiles where id = auth.uid();
  if r is null or not (r = any(allowed)) then
    raise exception 'Your role is not allowed to do this' using errcode = '42501';
  end if;
end $$;

-- New auth user -> profile. The very first user becomes MCC admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when not exists (select 1 from public.profiles) then 'mcc_admin' else 'mechanic' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Registration is always stored upper-case and trimmed.
create or replace function public.normalize_registration()
returns trigger language plpgsql as $$
begin
  new.registration := upper(btrim(new.registration));
  return new;
end $$;

drop trigger if exists trg_normalize_registration on public.aircraft;
create trigger trg_normalize_registration
  before insert or update on public.aircraft
  for each row execute function public.normalize_registration();

-- A media loader can only hold media, a software loader only software.
create or replace function public.check_loader_item_kind()
returns trigger language plpgsql as $$
begin
  if (select kind from public.loaders where id = new.loader_id)
     is distinct from (select kind from public.items where id = new.item_id) then
    raise exception 'Item type does not match the loader type (media vs software)';
  end if;
  return new;
end $$;

drop trigger if exists trg_check_loader_item_kind on public.loader_items;
create trigger trg_check_loader_item_kind
  before insert or update on public.loader_items
  for each row execute function public.check_loader_item_kind();

-- First location of a new loader goes into the history.
create or replace function public.log_new_loader_location()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.loader_location_history (loader_id, to_location_id, to_bin, moved_by, note)
  values (new.id, new.location_id, new.bin, auth.uid(), 'Registered');
  return new;
end $$;

drop trigger if exists trg_log_new_loader_location on public.loaders;
create trigger trg_log_new_loader_location
  after insert on public.loaders
  for each row execute function public.log_new_loader_location();

-- ---------------------------------------------------------------------
-- 3. Views (security_invoker: the caller's RLS applies)
-- ---------------------------------------------------------------------
drop view if exists public.v_loader_superseded      cascade;
drop view if exists public.v_item_replacements      cascade;
drop view if exists public.v_loader_availability    cascade;
drop view if exists public.v_aircraft_status        cascade;
drop view if exists public.v_group_requirements_current cascade;
drop view if exists public.v_item_status            cascade;

-- Item is "current" if some group requires it now; "superseded" if it was
-- required before but no group requires it any more.
create view public.v_item_status with (security_invoker = true) as
select i.id, i.system_type_id, i.kind, i.part_number, i.version, i.code, i.description, i.properties,
       exists (select 1 from public.group_requirements r
                where r.item_id = i.id and r.effective_to is null) as is_current,
       (exists (select 1 from public.group_requirements r
                 where r.item_id = i.id and r.effective_to is not null)
        and not exists (select 1 from public.group_requirements r
                         where r.item_id = i.id and r.effective_to is null)) as is_superseded
from public.items i;

create view public.v_group_requirements_current with (security_invoker = true) as
select r.id, r.group_id, g.name as group_name,
       r.system_type_id, st.code as system_code, r.kind,
       r.item_id, i.part_number, i.version, i.code, i.properties,
       r.effective_from, r.set_by
from public.group_requirements r
join public.aircraft_groups g on g.id = r.group_id
join public.system_types st   on st.id = r.system_type_id
join public.items i           on i.id = r.item_id
where r.effective_to is null;

-- Outdated is computed: installed item differs from the group's current one.
create view public.v_aircraft_status with (security_invoker = true) as
select a.id as aircraft_id, a.registration, a.group_id, g.name as group_name,
       r.system_type_id, st.code as system_code, r.kind,
       r.item_id as required_item_id,
       ri.part_number as req_part_number, ri.version as req_version, ri.code as req_code,
       ri.properties as req_properties,
       ai.item_id as installed_item_id,
       ii.part_number as inst_part_number, ii.version as inst_version, ii.code as inst_code,
       ii.properties as inst_properties,
       ai.installed_at,
       case when ai.item_id is null          then 'not_loaded'
            when ai.item_id = r.item_id      then 'up_to_date'
            else 'outdated' end as status
from public.aircraft a
join public.aircraft_groups g on g.id = a.group_id
join public.group_requirements r on r.group_id = a.group_id and r.effective_to is null
join public.system_types st on st.id = r.system_type_id
join public.items ri on ri.id = r.item_id
left join public.aircraft_installed ai
       on ai.aircraft_id = a.id and ai.system_type_id = r.system_type_id and ai.kind = r.kind
left join public.items ii on ii.id = ai.item_id;

create view public.v_loader_availability with (security_invoker = true) as
select l.id as loader_id, l.loader_no, l.kind, l.active,
       l.part_number as loader_part_number, l.serial_number as loader_serial_number,
       l.location_id, loc.name as location_name, l.bin,
       li.item_id, li.loaded_at
from public.loaders l
join public.loader_items li on li.loader_id = l.id
left join public.locations loc on loc.id = l.location_id;

-- old item -> item that replaced it (same group, system and kind)
create view public.v_item_replacements with (security_invoker = true) as
select distinct old.item_id as old_item_id, cur.item_id as new_item_id
from public.group_requirements old
join public.group_requirements cur
  on cur.group_id = old.group_id and cur.system_type_id = old.system_type_id
 and cur.kind = old.kind and cur.effective_to is null
where old.effective_to is not null
  and old.item_id <> cur.item_id
  and not exists (select 1 from public.group_requirements x
                   where x.item_id = old.item_id and x.effective_to is null);

-- Loaders that still hold a superseded item -> need reload
create view public.v_loader_superseded with (security_invoker = true) as
select l.id as loader_id, l.loader_no, l.kind, loc.name as location_name, li.item_id
from public.loader_items li
join public.loaders l on l.id = li.loader_id
left join public.locations loc on loc.id = l.location_id
join public.v_item_status s on s.id = li.item_id
where s.is_superseded;

-- ---------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.system_types            enable row level security;
alter table public.items                   enable row level security;
alter table public.aircraft_groups         enable row level security;
alter table public.group_requirements      enable row level security;
alter table public.aircraft                enable row level security;
alter table public.locations               enable row level security;
alter table public.loaders                 enable row level security;
alter table public.loader_items            enable row level security;
alter table public.loader_location_history enable row level security;
alter table public.aircraft_installed      enable row level security;
alter table public.aircraft_install_log    enable row level security;

-- Everyone signed in can read everything.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','system_types','items','aircraft_groups','group_requirements',
    'aircraft','locations','loaders','loader_items','loader_location_history',
    'aircraft_installed','aircraft_install_log']
  loop
    execute format('drop policy if exists "read all" on public.%I', t);
    execute format('create policy "read all" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Looking up an aircraft and its loaders needs no sign-in. Only the tables behind that lookup are open to
-- the public (read only). Profiles, loading history, who-did-what and location history stay private.
do $$
declare t text;
begin
  foreach t in array array[
    'system_types','items','aircraft_groups','group_requirements','aircraft',
    'locations','loaders','loader_items','aircraft_installed']
  loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon using (true)', t);
    execute format('grant select on public.%I to anon', t);
  end loop;
end $$;

-- Direct writes: only MCC admin, and only on master data.
-- group_requirements, loader_items, aircraft_installed, logs and history
-- have NO write policy: they change only through the functions below.
do $$
declare t text;
begin
  foreach t in array array['system_types','items','aircraft_groups','aircraft','locations']
  loop
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format(
      'create policy "admin write" on public.%I for all to authenticated
         using (public.app_role() = ''mcc_admin'')
         with check (public.app_role() = ''mcc_admin'')', t);
  end loop;
end $$;

drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles" on public.profiles for update to authenticated
  using (public.app_role() = 'mcc_admin') with check (public.app_role() = 'mcc_admin');

drop policy if exists "workshop add loaders" on public.loaders;
create policy "workshop add loaders" on public.loaders for insert to authenticated
  with check (public.app_role() in ('workshop','mcc_admin'));

-- ---------------------------------------------------------------------
-- 5. Actions (role-checked functions)
-- ---------------------------------------------------------------------

-- MCC: set the expected item for a group. Every aircraft in the group whose
-- installed item differs becomes "outdated" automatically (computed view).
create or replace function public.set_group_requirement(
  p_group uuid, p_system uuid, p_kind text, p_item uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it record;
  cur uuid;
  n_aircraft int;
begin
  perform public.require_role('mcc_admin');

  select * into it from public.items where id = p_item;
  if not found then raise exception 'Item not found'; end if;
  if it.system_type_id <> p_system or it.kind <> p_kind then
    raise exception 'Item does not match the selected system type / media-software kind';
  end if;

  select item_id into cur from public.group_requirements
   where group_id = p_group and system_type_id = p_system and kind = p_kind and effective_to is null;

  if cur = p_item then
    return jsonb_build_object('changed', false, 'aircraft_outdated', 0);
  end if;

  update public.group_requirements set effective_to = now()
   where group_id = p_group and system_type_id = p_system and kind = p_kind and effective_to is null;

  insert into public.group_requirements (group_id, system_type_id, kind, item_id, set_by)
  values (p_group, p_system, p_kind, p_item, auth.uid());

  select count(*) into n_aircraft
    from public.aircraft a
    left join public.aircraft_installed ai
           on ai.aircraft_id = a.id and ai.system_type_id = p_system and ai.kind = p_kind
   where a.group_id = p_group and ai.item_id is distinct from p_item;

  return jsonb_build_object('changed', true, 'aircraft_outdated', n_aircraft);
end $$;

-- Workshop: record that an item has been loaded onto a loader.
create or replace function public.load_item_on_loader(p_loader uuid, p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_role('workshop','mcc_admin');
  insert into public.loader_items (loader_id, item_id, loaded_by)
  values (p_loader, p_item, auth.uid())
  on conflict (loader_id, item_id) do update set loaded_at = now(), loaded_by = auth.uid();
end $$;

create or replace function public.remove_item_from_loader(p_loader uuid, p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_role('workshop','mcc_admin');
  delete from public.loader_items where loader_id = p_loader and item_id = p_item;
end $$;

-- Workshop: after physically reloading, swap every superseded item on the
-- loader for the item that replaced it. Returns number of items swapped.
create or replace function public.reload_loader(p_loader uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  perform public.require_role('workshop','mcc_admin');
  for r in
    select li.item_id as old_id, rep.new_item_id
      from public.loader_items li
      join public.v_item_replacements rep on rep.old_item_id = li.item_id
     where li.loader_id = p_loader
  loop
    delete from public.loader_items where loader_id = p_loader and item_id = r.old_id;
    insert into public.loader_items (loader_id, item_id, loaded_by)
    values (p_loader, r.new_item_id, auth.uid())
    on conflict (loader_id, item_id) do update set loaded_at = now(), loaded_by = auth.uid();
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.set_loader_active(p_loader uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_role('workshop','mcc_admin');
  update public.loaders set active = p_active where id = p_loader;
end $$;

-- Store / workshop: move a loader to a store + bin and keep the history.
drop function if exists public.move_loader(uuid, uuid, text);
create or replace function public.move_loader(
  p_loader uuid, p_location uuid, p_bin text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_loc uuid; old_bin text; new_bin text := nullif(btrim(p_bin), '');
begin
  perform public.require_role('store','workshop','mcc_admin');
  select location_id, bin into old_loc, old_bin from public.loaders where id = p_loader;
  if not found then raise exception 'Loader not found'; end if;
  if old_loc is not distinct from p_location and old_bin is not distinct from new_bin then
    return;
  end if;
  update public.loaders set location_id = p_location, bin = new_bin where id = p_loader;
  insert into public.loader_location_history
    (loader_id, from_location_id, to_location_id, from_bin, to_bin, moved_by, note)
  values (p_loader, old_loc, p_location, old_bin, new_bin, auth.uid(), nullif(btrim(p_note), ''));
end $$;

-- Workshop: correct a loader's own part number / serial number / notes.
create or replace function public.update_loader_details(
  p_loader uuid, p_part_number text, p_serial_number text, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_role('workshop','mcc_admin');
  update public.loaders
     set part_number   = nullif(btrim(p_part_number), ''),
         serial_number = nullif(btrim(p_serial_number), ''),
         notes         = nullif(btrim(p_notes), '')
   where id = p_loader;
  if not found then raise exception 'Loader not found'; end if;
end $$;

-- Mechanic: record that the group's current item is now on the aircraft.
create or replace function public.mark_aircraft_loaded(
  p_aircraft uuid, p_item uuid, p_loader uuid default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a record; it record; req uuid;
begin
  perform public.require_role('mechanic','mcc_admin');

  select * into a  from public.aircraft where id = p_aircraft;
  if not found then raise exception 'Aircraft not found'; end if;
  select * into it from public.items where id = p_item;
  if not found then raise exception 'Item not found'; end if;

  select item_id into req from public.group_requirements
   where group_id = a.group_id and system_type_id = it.system_type_id
     and kind = it.kind and effective_to is null;
  if req is null or req <> p_item then
    raise exception 'This item is not the current requirement for the aircraft group';
  end if;

  if p_loader is not null and not exists (
       select 1 from public.loader_items where loader_id = p_loader and item_id = p_item) then
    raise exception 'The selected loader does not hold this item';
  end if;

  insert into public.aircraft_installed (aircraft_id, system_type_id, kind, item_id, installed_by)
  values (p_aircraft, it.system_type_id, it.kind, p_item, auth.uid())
  on conflict (aircraft_id, system_type_id, kind)
  do update set item_id = excluded.item_id, installed_at = now(), installed_by = auth.uid();

  insert into public.aircraft_install_log (aircraft_id, item_id, loader_id, installed_by, note)
  values (p_aircraft, p_item, p_loader, auth.uid(), nullif(btrim(p_note), ''));
end $$;

-- ---------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------
revoke all on function public.require_role(text[])            from public, anon, authenticated;
revoke all on function public.handle_new_user()               from public, anon, authenticated;
revoke all on function public.log_new_loader_location()       from public, anon, authenticated;

revoke all on function public.app_role()                      from public, anon;
revoke all on function public.set_group_requirement(uuid,uuid,text,uuid) from public, anon;
revoke all on function public.load_item_on_loader(uuid,uuid)  from public, anon;
revoke all on function public.remove_item_from_loader(uuid,uuid) from public, anon;
revoke all on function public.reload_loader(uuid)             from public, anon;
revoke all on function public.set_loader_active(uuid,boolean) from public, anon;
revoke all on function public.move_loader(uuid,uuid,text,text) from public, anon;
revoke all on function public.update_loader_details(uuid,text,text,text) from public, anon;
revoke all on function public.mark_aircraft_loaded(uuid,uuid,uuid,text) from public, anon;

grant execute on function public.app_role()                   to authenticated;
grant execute on function public.set_group_requirement(uuid,uuid,text,uuid) to authenticated;
grant execute on function public.load_item_on_loader(uuid,uuid) to authenticated;
grant execute on function public.remove_item_from_loader(uuid,uuid) to authenticated;
grant execute on function public.reload_loader(uuid)          to authenticated;
grant execute on function public.set_loader_active(uuid,boolean) to authenticated;
grant execute on function public.move_loader(uuid,uuid,text,text) to authenticated;
grant execute on function public.update_loader_details(uuid,text,text,text) to authenticated;
grant execute on function public.mark_aircraft_loaded(uuid,uuid,uuid,text) to authenticated;

grant select on public.v_item_status, public.v_group_requirements_current,
                public.v_aircraft_status, public.v_loader_availability,
                public.v_item_replacements, public.v_loader_superseded
  to authenticated;
grant select on public.v_item_status, public.v_group_requirements_current,
                public.v_aircraft_status, public.v_loader_availability,
                public.v_item_replacements, public.v_loader_superseded
  to anon;
