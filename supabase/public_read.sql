-- Run once on an existing project: lets anyone (no sign-in) look up an aircraft and its loaders. Read only.
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


grant select on public.v_item_status, public.v_group_requirements_current,
                public.v_aircraft_status, public.v_loader_availability,
                public.v_item_replacements, public.v_loader_superseded
  to anon;
