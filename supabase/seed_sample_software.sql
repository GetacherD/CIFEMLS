-- =====================================================================
-- Sample SOFTWARE data to go with seed_sample_memo.sql (run after it; safe to run twice).
-- One software item per group (IFE), software loaders SL-001..003 (invented serials),
-- some aircraft up to date, some outdated, some not loaded.
-- =====================================================================

insert into public.items (system_type_id, kind, part_number, version, description, properties)
select st.id, 'software', v.pn, v.ver, v.descr, v.props::jsonb
from public.system_types st, (values
  ('OPR_A380_IFE_SW_R12', '3', 'A380 IFE software, current',  '{"Release": "R12.3"}'),
  ('OPR_A380_IFE_SW_R12', '2', 'A380 IFE software, previous', '{"Release": "R12.2"}'),
  ('OPR_B787_IFE_SW_R8',  '4', 'B787 IFE software, current',  '{"Release": "R8.4"}'),
  ('OPR_B787_IFE_SW_R8',  '3', 'B787 IFE software, previous', '{"Release": "R8.3"}')
) as v(pn, ver, descr, props)
where st.code = 'IFE'
on conflict (system_type_id, kind, part_number, version) do nothing;

-- Earlier requirement closed, current requirement open
insert into public.group_requirements (group_id, system_type_id, kind, item_id, effective_from, effective_to)
select g.id, i.system_type_id, i.kind, i.id, timestamptz '2026-09-25', timestamptz '2026-10-26'
from (values
  ('A380-800 NGG', 'OPR_A380_IFE_SW_R12', '2'),
  ('A380-800 HYBRID', 'OPR_A380_IFE_SW_R12', '2'),
  ('B787-8 POST-MOD', 'OPR_B787_IFE_SW_R8', '3')
) as v(grp, pn, ver)
join public.aircraft_groups g on g.name = v.grp
join public.items i on i.part_number = v.pn and i.version = v.ver and i.kind = 'software'
where not exists (select 1 from public.group_requirements r where r.group_id = g.id and r.item_id = i.id);

insert into public.group_requirements (group_id, system_type_id, kind, item_id, effective_from)
select g.id, i.system_type_id, i.kind, i.id, timestamptz '2026-10-26'
from (values
  ('A380-800 NGG', 'OPR_A380_IFE_SW_R12', '3'),
  ('A380-800 HYBRID', 'OPR_A380_IFE_SW_R12', '3'),
  ('B787-8 PRE-MOD', 'OPR_B787_IFE_SW_R8', '4'),
  ('B787-8 POST-MOD', 'OPR_B787_IFE_SW_R8', '4'),
  ('B787-8 EX-LEASE', 'OPR_B787_IFE_SW_R8', '4')
) as v(grp, pn, ver)
join public.aircraft_groups g on g.name = v.grp
join public.items i on i.part_number = v.pn and i.version = v.ver and i.kind = 'software'
where not exists (select 1 from public.group_requirements r where r.group_id = g.id and r.item_id = i.id and r.effective_to is null);

-- Installed software: AU-MHV outdated (R12.2), AU-MHW/MHY current, AU-MHX not loaded;
-- first ten POST-MOD aircraft current, one outdated, the rest not loaded.
insert into public.aircraft_installed (aircraft_id, system_type_id, kind, item_id)
select a.id, i.system_type_id, i.kind, i.id from (values
  ('AU-MHV', 'OPR_A380_IFE_SW_R12', '2'),
  ('AU-MHW', 'OPR_A380_IFE_SW_R12', '3'),
  ('AU-MHY', 'OPR_A380_IFE_SW_R12', '3'),
  ('AU-MUQ', 'OPR_B787_IFE_SW_R8', '4'), ('AU-MUR', 'OPR_B787_IFE_SW_R8', '4'),
  ('AU-MUS', 'OPR_B787_IFE_SW_R8', '4'), ('AU-MUT', 'OPR_B787_IFE_SW_R8', '4'),
  ('AU-MUU', 'OPR_B787_IFE_SW_R8', '4'), ('AU-MUV', 'OPR_B787_IFE_SW_R8', '4'),
  ('AU-MUW', 'OPR_B787_IFE_SW_R8', '3'),
  ('AU-MUX', 'OPR_B787_IFE_SW_R8', '4'), ('AU-MUY', 'OPR_B787_IFE_SW_R8', '4'),
  ('AU-MUZ', 'OPR_B787_IFE_SW_R8', '4'),
  ('AU-NMQ', 'OPR_B787_IFE_SW_R8', '4')
) as v(reg, pn, ver)
join public.aircraft a on a.registration = v.reg
join public.items i on i.part_number = v.pn and i.version = v.ver and i.kind = 'software'
on conflict (aircraft_id, system_type_id, kind) do nothing;

-- Software loaders
insert into public.loaders (loader_no, kind, part_number, serial_number, location_id, bin)
select v.no, 'software', '185985-103', v.sn, w.id, v.wbin
from (values
  ('SL-001', 'A2008101', 'W-11'),
  ('SL-002', 'A2008102', 'W-12'),
  ('SL-003', 'A2008103', 'W-13')
) as v(no, sn, wbin)
cross join (select id from public.locations where name = 'Workshop') w
on conflict (loader_no) do nothing;

update public.loader_location_history h set moved_at = now() - interval '9 days'
from public.loaders l where h.loader_id = l.id and h.note = 'Registered'
  and l.loader_no in ('SL-001','SL-002','SL-003');

insert into public.loader_location_history (loader_id, from_location_id, to_location_id, from_bin, to_bin, moved_at, note)
select l.id, f.id, t.id, v.fbin, v.tbin, now() - interval '1 hour' * v.hrs, v.note
from (values
  ('SL-001', 'Workshop', 'W-11', 'Main Store', 'B-15', 50, 'Distributed after loading'),
  ('SL-002', 'Workshop', 'W-12', 'Line Store', 'L-07', 44, 'Distributed after loading'),
  ('SL-003', 'Workshop', 'W-13', 'Gate Store', 'G-05', 100, 'Distributed after loading'),
  ('SL-003', 'Gate Store', 'G-05', 'Hangar Store', 'H-06', 16, 'Moved to hangar for night shift')
) as v(no, fstore, fbin, tstore, tbin, hrs, note)
join public.loaders l on l.loader_no = v.no
join public.locations f on f.name = v.fstore
join public.locations t on t.name = v.tstore
where not exists (select 1 from public.loader_location_history x where x.loader_id = l.id and x.note = v.note and x.to_location_id = t.id);

update public.loaders l set location_id = s.id, bin = v.bin
from (values
  ('SL-001', 'Main Store', 'B-15'),
  ('SL-002', 'Line Store', 'L-07'),
  ('SL-003', 'Hangar Store', 'H-06')
) as v(no, store, bin)
join public.locations s on s.name = v.store
where l.loader_no = v.no;

-- Contents: SL-002 still carries the old A380 software only (so it needs a reload)
insert into public.loader_items (loader_id, item_id, loaded_at)
select l.id, i.id, now() - interval '1 hour' * v.hrs from (values
  ('SL-001', 'OPR_A380_IFE_SW_R12', '3', 62),
  ('SL-001', 'OPR_B787_IFE_SW_R8', '4', 62),
  ('SL-002', 'OPR_A380_IFE_SW_R12', '2', 200),
  ('SL-002', 'OPR_B787_IFE_SW_R8', '4', 70),
  ('SL-003', 'OPR_A380_IFE_SW_R12', '3', 80),
  ('SL-003', 'OPR_B787_IFE_SW_R8', '4', 80)
) as v(no, pn, ver, hrs)
join public.loaders l on l.loader_no = v.no
join public.items i on i.part_number = v.pn and i.version = v.ver and i.kind = 'software'
on conflict (loader_id, item_id) do nothing;

-- Loading history for two aircraft
insert into public.aircraft_install_log (aircraft_id, item_id, loader_id, installed_at, note)
select a.id, i.id, l.id, v.at::timestamptz, v.note from (values
  ('AU-MHV', 'OPR_A380_IFE_SW_R12', '2', 'SL-002', '2026-09-29 22:50+03', 'Software loaded with the media'),
  ('AU-MHW', 'OPR_A380_IFE_SW_R12', '3', 'SL-001', '2026-10-28 09:30+03', 'Software update at the gate')
) as v(reg, pn, ver, ln, at, note)
join public.aircraft a on a.registration = v.reg
join public.items i on i.part_number = v.pn and i.version = v.ver and i.kind = 'software'
join public.loaders l on l.loader_no = v.ln
where not exists (select 1 from public.aircraft_install_log x where x.aircraft_id = a.id and x.item_id = i.id);

update public.aircraft_installed ai set installed_at = x.last_at
from (select aircraft_id, item_id, max(installed_at) as last_at from public.aircraft_install_log group by aircraft_id, item_id) x
where ai.aircraft_id = x.aircraft_id and ai.item_id = x.item_id;
