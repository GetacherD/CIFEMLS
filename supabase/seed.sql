-- =====================================================================
-- QIFEMLS demo data. Run ONCE after schema.sql (optional).
-- All part numbers / codes below are made-up demo values.
-- Story: A350-1000 IFE media was upgraded 3.1 -> 4.0, so AU-EPY (still on
-- 3.1) is outdated and loader ML-002 (holding 3.1) needs reload.
-- =====================================================================

insert into public.system_types (code, name)
values ('IFE', 'In-Flight Entertainment')
on conflict (code) do nothing;

-- Items -----------------------------------------------------------------
insert into public.items (system_type_id, kind, part_number, version, code, description, properties)
select st.id, v.kind, v.pn, v.ver, v.code, v.descr, v.props::jsonb
from public.system_types st,
(values
  ('media',    'DEMO-IFE-MED-1000', '3.1', 'DEMO-M1000-V31', 'A350-1000 IFE media (previous)', '{"Release date":"2026-06-01","Languages":"EN, AM, AR","Size":"46 GB"}'),
  ('media',    'DEMO-IFE-MED-1000', '4.0', 'DEMO-M1000-V40', 'A350-1000 IFE media (current)', '{"Release date":"2026-09-15","Languages":"EN, AM, AR, FR","Size":"48 GB"}'),
  ('software', 'DEMO-IFE-SW-1000',  '2.2', 'DEMO-S1000-V22', 'A350-1000 IFE software (current)', '{"Release date":"2026-06-01","Checksum":"9F2C-41AA"}'),
  ('media',    'DEMO-IFE-MED-900',  '2.5', 'DEMO-M900-V25',  'A350-900 IFE media (current)', '{"Release date":"2026-06-01","Languages":"EN, AM","Size":"41 GB"}'),
  ('software', 'DEMO-IFE-SW-900',   '1.8', 'DEMO-S900-V18',  'A350-900 IFE software (current)', '{"Release date":"2026-06-01","Checksum":"3B7D-0E15"}')
) as v(kind, pn, ver, code, descr, props)
where st.code = 'IFE'
on conflict (system_type_id, kind, part_number, version) do nothing;

-- Groups ----------------------------------------------------------------
insert into public.aircraft_groups (name, description) values
  ('A350-1000', 'Airbus A350-1000 fleet'),
  ('A350-900',  'Airbus A350-900 fleet')
on conflict (name) do nothing;

-- Requirements (history for A350-1000 media: 3.1 closed, 4.0 current) ---
insert into public.group_requirements (group_id, system_type_id, kind, item_id, effective_from, effective_to)
select g.id, i.system_type_id, i.kind, i.id, timestamptz '2026-06-01', timestamptz '2026-09-15'
from public.aircraft_groups g, public.items i
where g.name = 'A350-1000' and i.part_number = 'DEMO-IFE-MED-1000' and i.version = '3.1'
  and not exists (select 1 from public.group_requirements);

insert into public.group_requirements (group_id, system_type_id, kind, item_id, effective_from)
select g.id, i.system_type_id, i.kind, i.id, v.since
from (values
  ('A350-1000', 'DEMO-IFE-MED-1000', '4.0', timestamptz '2026-09-15'),
  ('A350-1000', 'DEMO-IFE-SW-1000',  '2.2', timestamptz '2026-06-01'),
  ('A350-900',  'DEMO-IFE-MED-900',  '2.5', timestamptz '2026-06-01'),
  ('A350-900',  'DEMO-IFE-SW-900',   '1.8', timestamptz '2026-06-01')
) as v(grp, pn, ver, since)
join public.aircraft_groups g on g.name = v.grp
join public.items i on i.part_number = v.pn and i.version = v.ver
where not exists (
  select 1 from public.group_requirements r
   where r.group_id = g.id and r.item_id = i.id and r.effective_to is null);

-- Aircraft --------------------------------------------------------------
insert into public.aircraft (registration, group_id)
select v.reg, g.id
from (values
  ('AU-EPY', 'A350-1000'),
  ('AU-ETP', 'A350-1000'),
  ('AU-EPA', 'A350-900'),
  ('AU-EPB', 'A350-900')
) as v(reg, grp)
join public.aircraft_groups g on g.name = v.grp
on conflict (registration) do nothing;

-- Installed on aircraft ---------------------------------------------------
insert into public.aircraft_installed (aircraft_id, system_type_id, kind, item_id)
select a.id, i.system_type_id, i.kind, i.id
from (values
  ('AU-EPY', 'DEMO-IFE-MED-1000', '3.1'),   -- outdated media
  ('AU-EPY', 'DEMO-IFE-SW-1000',  '2.2'),
  ('AU-ETP', 'DEMO-IFE-MED-1000', '4.0'),
  ('AU-ETP', 'DEMO-IFE-SW-1000',  '2.2'),
  ('AU-EPA', 'DEMO-IFE-MED-900',  '2.5'),
  ('AU-EPA', 'DEMO-IFE-SW-900',   '1.8')
  -- AU-EPB: nothing recorded yet ("not loaded")
) as v(reg, pn, ver)
join public.aircraft a on a.registration = v.reg
join public.items i on i.part_number = v.pn and i.version = v.ver
on conflict (aircraft_id, system_type_id, kind) do nothing;

-- Locations ---------------------------------------------------------------
insert into public.locations (name, description) values
  ('Workshop',   'Loader preparation shop'),
  ('Hangar Store', 'Hangar tool store'),
  ('Line Store',   'Line maintenance store'),
  ('Gate Store',   'Gate / ramp store')
on conflict (name) do nothing;

-- Loaders -------------------------------------------------------------------
insert into public.loaders (loader_no, kind, part_number, serial_number, location_id, bin)
select v.no, v.kind, v.pn, v.sn, l.id, v.bin
from (values
  ('ML-001', 'media',    'DEMO-LDR-MED', 'SN-1001', 'Hangar Store', 'A-01'),
  ('ML-002', 'media',    'DEMO-LDR-MED', 'SN-1002', 'Line Store',   'B-07'),
  ('SL-001', 'software', 'DEMO-LDR-SW',  'SN-2001', 'Hangar Store', 'A-02'),
  ('SL-002', 'software', 'DEMO-LDR-SW',  'SN-2002', 'Workshop',     'W-01')
) as v(no, kind, pn, sn, loc, bin)
join public.locations l on l.name = v.loc
on conflict (loader_no) do nothing;

-- Loader contents -----------------------------------------------------------
insert into public.loader_items (loader_id, item_id)
select l.id, i.id
from (values
  ('ML-001', 'DEMO-IFE-MED-1000', '4.0'),
  ('ML-001', 'DEMO-IFE-MED-900',  '2.5'),
  ('ML-002', 'DEMO-IFE-MED-1000', '3.1'),   -- superseded -> needs reload
  ('SL-001', 'DEMO-IFE-SW-1000',  '2.2'),
  ('SL-001', 'DEMO-IFE-SW-900',   '1.8'),
  ('SL-002', 'DEMO-IFE-SW-900',   '1.8')
) as v(no, pn, ver)
join public.loaders l on l.loader_no = v.no
join public.items i on i.part_number = v.pn and i.version = v.ver
on conflict (loader_id, item_id) do nothing;
