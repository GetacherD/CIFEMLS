-- =====================================================================
-- QIFEMLS sample data, anonymised from a media loading memo.
-- Use INSTEAD of seed.sql (run after schema.sql, once).
-- Anonymised: registrations (fictional AU- prefix), operator code (OPR),
-- modification/EO numbers (MOD-xx), and the original operator name.
-- Media file names keep their structure.
-- Loader ML-001 uses the real loader serial supplied (PN 185985-102,
-- SN A2007450); the other two serial numbers are invented sample values.
-- Includes loading history for two aircraft and location history for
-- every loader.
-- =====================================================================

insert into public.system_types (code, name)
values ('IFE', 'In-Flight Entertainment')
on conflict (code) do nothing;

-- Media items: part number = file base name, version = load revision.
-- Labels shown to technicians: part number, version, DTD keep, DTD delta.
insert into public.items (system_type_id, kind, part_number, version, description, properties)
select st.id, 'media', v.pn, v.ver, v.descr, v.props::jsonb
from public.system_types st, (values
  ('OPR_A380_OCT26NOV26_NGG_v3010', '1', 'A380 NGG media, current', '{"DTD keep": "keep-OPR_A380_OCT26NOV26_NGG_v3010_v1.xcil", "DTD delta": "delta-OPR_A380_OCT26NOV26_NGG_v3010_v1.xcil"}'),
  ('OPR_A380_OCT26NOV26_HYB_v3010', '1', 'A380 HYBRID media, current', '{"DTD keep": "keep-OPR_A380_OCT26NOV26_HYB_v3010_v1.xcil", "DTD delta": "delta-OPR_A380_OCT26NOV26_HYB_v3010_v1.xcil"}'),
  ('OPR_B787_OCT26NOV26_v2100_Starlink', '1', 'B787 media with Starlink, current', '{"DTD keep": "keep-OPR_B787_OCT26NOV26_v2100_Starlink_v1.xcil", "DTD delta": "delta-OPR_B787_OCT26NOV26_v2100_Starlink_v1.xcil"}'),
  ('OPR_B787_OCT26_NGG', '1', 'B787 ex-lease media, current', '{}'),
  ('OPR_A380_SEP26OCT26_NGG_v3010', '2', 'A380 NGG media, previous', '{}'),
  ('OPR_A380_SEP26OCT26_HYB_v5100', '2', 'A380 HYBRID media, previous', '{}'),
  ('OPR_A380_AUG26SEP26_NGG_v3010', '1', 'A380 NGG media, older', '{}')
) as v(pn, ver, descr, props)
where st.code = 'IFE'
on conflict (system_type_id, kind, part_number, version) do nothing;

insert into public.aircraft_groups (name, description) values
  ('A380-800 NGG', 'Group name and condition inferred: top row of the source was cut off'),
  ('A380-800 HYBRID', 'Post MOD-A1 (DSU upgrade)'),
  ('B787-8 PRE-MOD', 'Pre MOD-B1 (CML upgrade) and Post MOD-B2 (Starlink upgrade)'),
  ('B787-8 POST-MOD', 'Post MOD-B1 (CML upgrade) and Post MOD-B2 (Starlink upgrade)'),
  ('B787-8 EX-LEASE', 'Aircraft taken over from another operator')
on conflict (name) do nothing;

-- Requirement history: earlier media closed, current media from 2026-10-26
insert into public.group_requirements (group_id, system_type_id, kind, item_id, effective_from, effective_to)
select g.id, i.system_type_id, i.kind, i.id, v.f::timestamptz, v.t::timestamptz
from (values
  ('A380-800 NGG', 'OPR_A380_AUG26SEP26_NGG_v3010', '1', '2026-08-25', '2026-09-25'),
  ('A380-800 NGG', 'OPR_A380_SEP26OCT26_NGG_v3010', '2', '2026-09-25', '2026-10-26'),
  ('A380-800 HYBRID', 'OPR_A380_SEP26OCT26_HYB_v5100', '2', '2026-09-25', '2026-10-26')
) as v(grp, pn, ver, f, t)
join public.aircraft_groups g on g.name = v.grp
join public.items i on i.part_number = v.pn and i.version = v.ver
where not exists (select 1 from public.group_requirements r where r.group_id = g.id and r.item_id = i.id);

insert into public.group_requirements (group_id, system_type_id, kind, item_id, effective_from)
select g.id, i.system_type_id, i.kind, i.id, timestamptz '2026-10-26'
from (values
  ('A380-800 NGG', 'OPR_A380_OCT26NOV26_NGG_v3010', '1'),
  ('A380-800 HYBRID', 'OPR_A380_OCT26NOV26_HYB_v3010', '1'),
  ('B787-8 PRE-MOD', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('B787-8 POST-MOD', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('B787-8 EX-LEASE', 'OPR_B787_OCT26_NGG', '1')
) as v(grp, pn, ver)
join public.aircraft_groups g on g.name = v.grp
join public.items i on i.part_number = v.pn and i.version = v.ver
where not exists (select 1 from public.group_requirements r where r.group_id = g.id and r.item_id = i.id and r.effective_to is null);

insert into public.aircraft (registration, group_id)
select v.reg, g.id from (values
  ('AU-MHV', 'A380-800 NGG'),
  ('AU-MHW', 'A380-800 NGG'),
  ('AU-MHX', 'A380-800 HYBRID'),
  ('AU-MHY', 'A380-800 HYBRID'),
  ('AU-MUP', 'B787-8 PRE-MOD'),
  ('AU-MUQ', 'B787-8 POST-MOD'),
  ('AU-MUR', 'B787-8 POST-MOD'),
  ('AU-MUS', 'B787-8 POST-MOD'),
  ('AU-MUT', 'B787-8 POST-MOD'),
  ('AU-MUU', 'B787-8 POST-MOD'),
  ('AU-MUV', 'B787-8 POST-MOD'),
  ('AU-MUW', 'B787-8 POST-MOD'),
  ('AU-MUX', 'B787-8 POST-MOD'),
  ('AU-MUY', 'B787-8 POST-MOD'),
  ('AU-MUZ', 'B787-8 POST-MOD'),
  ('AU-MVA', 'B787-8 POST-MOD'),
  ('AU-MVB', 'B787-8 POST-MOD'),
  ('AU-MVC', 'B787-8 POST-MOD'),
  ('AU-MVD', 'B787-8 POST-MOD'),
  ('AU-MVE', 'B787-8 POST-MOD'),
  ('AU-MVF', 'B787-8 POST-MOD'),
  ('AU-MVG', 'B787-8 POST-MOD'),
  ('AU-MVH', 'B787-8 POST-MOD'),
  ('AU-MVI', 'B787-8 POST-MOD'),
  ('AU-MVJ', 'B787-8 POST-MOD'),
  ('AU-MVK', 'B787-8 POST-MOD'),
  ('AU-MVL', 'B787-8 POST-MOD'),
  ('AU-MVM', 'B787-8 POST-MOD'),
  ('AU-MVN', 'B787-8 POST-MOD'),
  ('AU-MVO', 'B787-8 POST-MOD'),
  ('AU-MVP', 'B787-8 POST-MOD'),
  ('AU-MVQ', 'B787-8 POST-MOD'),
  ('AU-MVR', 'B787-8 POST-MOD'),
  ('AU-MVS', 'B787-8 POST-MOD'),
  ('AU-NMP', 'B787-8 EX-LEASE'),
  ('AU-NMQ', 'B787-8 EX-LEASE')
) as v(reg, grp)
join public.aircraft_groups g on g.name = v.grp
on conflict (registration) do nothing;

insert into public.aircraft_installed (aircraft_id, system_type_id, kind, item_id)
select a.id, i.system_type_id, i.kind, i.id from (values
  ('AU-MHV', 'OPR_A380_SEP26OCT26_NGG_v3010', '2'),
  ('AU-MHW', 'OPR_A380_SEP26OCT26_NGG_v3010', '2'),
  ('AU-MHX', 'OPR_A380_SEP26OCT26_HYB_v5100', '2'),
  ('AU-MHY', 'OPR_A380_OCT26NOV26_HYB_v3010', '1'),
  ('AU-MUQ', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MUR', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MUS', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MUT', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MUU', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MUV', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MUW', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MUX', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MUY', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MUZ', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVA', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVB', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVC', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVD', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVE', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVF', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVG', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVH', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVI', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-MVJ', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1'),
  ('AU-NMQ', 'OPR_B787_OCT26_NGG', '1')
) as v(reg, pn, ver)
join public.aircraft a on a.registration = v.reg
join public.items i on i.part_number = v.pn and i.version = v.ver
on conflict (aircraft_id, system_type_id, kind) do nothing;

insert into public.locations (name, description) values
  ('Workshop',     'Loader preparation shop'),
  ('Main Store',   'Main loader store'),
  ('Hangar Store', 'Hangar store'),
  ('Line Store',   'Line maintenance store'),
  ('Gate Store',   'Gate / ramp store')
on conflict (name) do nothing;

-- Loaders start in the workshop (the trigger logs 'Registered'), then are distributed.
insert into public.loaders (loader_no, kind, part_number, serial_number, location_id, bin)
select v.no, 'media', '185985-102', v.sn, w.id, v.wbin
from (values
  ('ML-001', 'A2007450', 'W-01'),
  ('ML-002', 'A2007451', 'W-02'),
  ('ML-003', 'A2007452', 'W-03')
) as v(no, sn, wbin)
cross join (select id from public.locations where name = 'Workshop') w
on conflict (loader_no) do nothing;

-- Back-date the registration entries, then record each move
update public.loader_location_history h set moved_at = now() - interval '8 days'
from public.loaders l where h.loader_id = l.id and h.note = 'Registered'
  and l.loader_no in ('ML-001','ML-002','ML-003');

insert into public.loader_location_history (loader_id, from_location_id, to_location_id, from_bin, to_bin, moved_at, note)
select l.id, f.id, t.id, v.fbin, v.tbin, now() - interval '1 hour' * v.hrs, v.note
from (values
  ('ML-001', 'Workshop', 'W-01', 'Main Store', 'B-12', 48, 'Distributed after loading'),
  ('ML-002', 'Workshop', 'W-02', 'Line Store', 'L-04', 40, 'Distributed after loading'),
  ('ML-003', 'Workshop', 'W-03', 'Gate Store', 'G-02', 120, 'Distributed after loading'),
  ('ML-003', 'Gate Store', 'G-02', 'Hangar Store', 'H-03', 18, 'Moved to hangar for night shift')
) as v(no, fstore, fbin, tstore, tbin, hrs, note)
join public.loaders l on l.loader_no = v.no
join public.locations f on f.name = v.fstore
join public.locations t on t.name = v.tstore
where not exists (select 1 from public.loader_location_history x where x.loader_id = l.id and x.note = v.note and x.to_location_id = t.id);

-- Final position of each loader
update public.loaders l set location_id = s.id, bin = v.bin
from (values
  ('ML-001', 'Main Store', 'B-12'),
  ('ML-002', 'Line Store', 'L-04'),
  ('ML-003', 'Hangar Store', 'H-03')
) as v(no, store, bin)
join public.locations s on s.name = v.store
where l.loader_no = v.no;

-- Loader contents (loaded_at staggered)
insert into public.loader_items (loader_id, item_id, loaded_at)
select l.id, i.id, now() - interval '1 hour' * v.hrs from (values
  ('ML-001', 'OPR_A380_OCT26NOV26_NGG_v3010', '1', 60),
  ('ML-001', 'OPR_A380_OCT26NOV26_HYB_v3010', '1', 60),
  ('ML-002', 'OPR_A380_OCT26NOV26_NGG_v3010', '1', 72),
  ('ML-002', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1', 72),
  ('ML-002', 'OPR_B787_OCT26_NGG', '1', 72),
  ('ML-003', 'OPR_A380_OCT26NOV26_NGG_v3010', '1', 84),
  ('ML-003', 'OPR_A380_OCT26NOV26_HYB_v3010', '1', 84),
  ('ML-003', 'OPR_B787_OCT26NOV26_v2100_Starlink', '1', 84)
) as v(no, pn, ver, hrs)
join public.loaders l on l.loader_no = v.no
join public.items i on i.part_number = v.pn and i.version = v.ver
on conflict (loader_id, item_id) do nothing;

-- Aircraft loading history
insert into public.aircraft_install_log (aircraft_id, item_id, loader_id, installed_at, note)
select a.id, i.id, l.id, v.at::timestamptz, v.note from (values
  ('AU-MHV', 'OPR_A380_AUG26SEP26_NGG_v3010', '1', 'ML-002', '2026-08-30 10:20+03', 'Routine media update'),
  ('AU-MHV', 'OPR_A380_SEP26OCT26_NGG_v3010', '2', 'ML-003', '2026-09-29 22:45+03', 'Loaded in hangar, night shift'),
  ('AU-MHW', 'OPR_A380_SEP26OCT26_NGG_v3010', '2', 'ML-001', '2026-09-30 01:10+03', 'Loaded at the gate')
) as v(reg, pn, ver, ln, at, note)
join public.aircraft a on a.registration = v.reg
join public.items i on i.part_number = v.pn and i.version = v.ver
join public.loaders l on l.loader_no = v.ln
where not exists (select 1 from public.aircraft_install_log x where x.aircraft_id = a.id and x.item_id = i.id);

-- The installed date follows the latest loading entry
update public.aircraft_installed ai set installed_at = x.last_at
from (select aircraft_id, max(installed_at) as last_at from public.aircraft_install_log group by aircraft_id) x
where ai.aircraft_id = x.aircraft_id;
