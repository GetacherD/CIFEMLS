import Link from "next/link";
import Flash from "@/components/Flash";
import SearchSelect from "@/components/SearchSelect";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addAircraft, assignGroup, bulkAddAircraft } from "./actions";

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; q?: string }>;
}) {
  await requireRole("mcc_admin");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const supabase = await createClient();

  let aircraftQuery = supabase
    .from("aircraft")
    .select("id, registration, group_id")
    .order("registration")
    .limit(500);
  if (q) aircraftQuery = aircraftQuery.ilike("registration", `%${q}%`);

  const [a, g] = await Promise.all([
    aircraftQuery,
    supabase.from("aircraft_groups").select("id, name").order("name"),
  ]);
  const aircraft = (a.data ?? []) as { id: string; registration: string; group_id: string | null }[];
  const groups = (g.data ?? []) as { id: string; name: string }[];

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Fleet &amp; group assignment</h1>
        <p className="muted">Add aircraft and put each one in its group.</p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <div className="grid grid-2">
        <form action={addAircraft} className="card stack">
          <h2>Add one aircraft</h2>
          <div className="row">
            <label>
              Registration
              <input name="registration" placeholder="AU-EPY" required style={{ textTransform: "uppercase" }} />
            </label>
            <label>
              Group
              <SearchSelect name="group_id" defaultValue="">
                <option value="">— none —</option>
                {groups.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </SearchSelect>
            </label>
            <button className="btn" type="submit">
              Add
            </button>
          </div>
        </form>

        <form action={bulkAddAircraft} className="card stack">
          <h2>Paste a list</h2>
          <label>
            One aircraft per line: registration, group
            <textarea name="bulk" placeholder={"AU-EPY, A350-1000\nAU-ETP, A350-1000\nAU-EPA, A350-900"} />
          </label>
          <div>
            <button className="btn" type="submit">
              Import list
            </button>
          </div>
        </form>
      </div>

      <div className="card stack">
        <form className="row" method="get">
          <label>
            Filter
            <input name="q" defaultValue={q} placeholder="registration" />
          </label>
          <button className="btn btn-secondary" type="submit">
            Search
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Registration</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              {aircraft.map((x) => (
                <tr key={x.id}>
                  <td>
                    <Link href={`/aircraft/${x.id}`}>
                      <strong>{x.registration}</strong>
                    </Link>
                  </td>
                  <td>
                    <form action={assignGroup} className="inline">
                      <input type="hidden" name="aircraft_id" value={x.id} />
                      <SearchSelect name="group_id" defaultValue={x.group_id ?? ""}>
                        <option value="">— none —</option>
                        {groups.map((gr) => (
                          <option key={gr.id} value={gr.id}>
                            {gr.name}
                          </option>
                        ))}
                      </SearchSelect>
                      <button className="btn btn-secondary btn-small" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {aircraft.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted">
                    No aircraft found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
