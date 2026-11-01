import { createClient } from "@/lib/supabase/server";
import AircraftSearch from "@/components/AircraftSearch";

export default async function SearchBar(props: {
  defaultValue?: string;
  placeholder?: string;
  hidden?: Record<string, string>;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aircraft")
    .select("id, registration, aircraft_groups(name)")
    .order("registration")
    .limit(5000);
  const aircraft = ((data ?? []) as unknown as { id: string; registration: string; aircraft_groups: { name: string } | null }[]).map(
    (x) => ({ id: x.id, registration: x.registration, group: x.aircraft_groups?.name ?? null })
  );
  return <AircraftSearch aircraft={aircraft} {...props} />;
}
