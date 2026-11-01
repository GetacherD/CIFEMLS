import Link from "next/link";
import { redirect } from "next/navigation";
import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, overallStatus, type Kind } from "@/lib/types";

interface Row {
  aircraft_id: string;
  system_code: string;
  kind: Kind;
  status: "up_to_date" | "outdated" | "not_loaded";
}

export default async function AircraftList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; only?: string; msg?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const onlyNeeds = sp.only === "needs";
  const supabase = await createClient();

  let query = supabase
    .from("aircraft")
    .select("id, registration, group_id, aircraft_groups(name)")
    .order("registration")
    .limit(500);
  if (q) query = query.ilike("registration", `%${q}%`);

  const { data } = await query;
  const aircraft = (data ?? []) as unknown as {
    id: string;
    registration: string;
    group_id: string | null;
    aircraft_groups: { name: string } | null;
  }[];

  // Typing a full registration (or a search with a single hit) goes straight to the aircraft.
  if (q) {
    const exact = aircraft.find((x) => x.registration.toLowerCase() === q.toLowerCase());
    if (exact) redirect(`/aircraft/${exact.id}`);
    if (aircraft.length === 1) redirect(`/aircraft/${aircraft[0].id}`);
  }

  const ids = aircraft.map((x) => x.id);
  const { data: st } = ids.length
    ? await supabase
        .from("v_aircraft_status")
        .select("aircraft_id, system_code, kind, status")
        .in("aircraft_id", ids)
    : { data: [] };
  const rowsByAircraft = new Map<string, Row[]>();
  for (const r of (st ?? []) as Row[]) {
    const list = rowsByAircraft.get(r.aircraft_id) ?? [];
    list.push(r);
    rowsByAircraft.set(r.aircraft_id, list);
  }

  let list = aircraft.map((x) => {
    const own = rowsByAircraft.get(x.id) ?? [];
    return { ...x, own, overall: overallStatus(x.group_id, own) };
  });
  if (onlyNeeds) list = list.filter((x) => x.overall === "needs_loading");

  return (
    <div className="stack">
      <div className="page-head">
        <h1>{onlyNeeds ? "Aircraft needing loading" : "Aircraft"}</h1>
        {q && (
          <p className="muted">
            {list.length === 0 ? `No aircraft match “${q}”.` : `${list.length} match “${q}”.`}
          </p>
        )}
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <form action="/aircraft" method="get" className="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Registration, e.g. AU-EPY"
          aria-label="Aircraft registration"
          autoComplete="off"
        />
        {onlyNeeds && <input type="hidden" name="only" value="needs" />}
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Registration</th>
                <th>Group</th>
                <th>Status</th>
                <th>What is missing</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>
                    <Link href={`/aircraft/${x.id}`}>
                      <strong>{x.registration}</strong>
                    </Link>
                  </td>
                  <td>{x.aircraft_groups?.name ?? <span className="muted">—</span>}</td>
                  <td>
                    <StatusBadge status={x.overall} />
                  </td>
                  <td className="small">
                    {x.own
                      .filter((r) => r.status !== "up_to_date")
                      .map((r) => `${r.system_code} ${KIND_LABEL[r.kind].toLowerCase()} (${r.status === "not_loaded" ? "not loaded" : "outdated"})`)
                      .join(", ") || <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Nothing to show.
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
