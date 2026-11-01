import Link from "next/link";
import Flash from "@/components/Flash";
import ItemLabel from "@/components/ItemLabel";
import StatusBadge from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, fmtDate, overallStatus, type Kind } from "@/lib/types";

interface Row {
  aircraft_id: string;
  system_code: string;
  kind: Kind;
  status: "up_to_date" | "outdated" | "not_loaded";
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [a, st, sup, recent] = await Promise.all([
    supabase
      .from("aircraft")
      .select("id, registration, group_id, aircraft_groups(name)")
      .order("registration")
      .limit(5000),
    supabase.from("v_aircraft_status").select("aircraft_id, system_code, kind, status").limit(20000),
    supabase.from("v_loader_superseded").select("loader_id"),
    supabase
      .from("group_requirements")
      .select(
        "id, kind, effective_from, aircraft_groups(name), system_types(code), items(part_number, version, code, properties)"
      )
      .order("effective_from", { ascending: false })
      .limit(6),
  ]);

  const aircraft = (a.data ?? []) as unknown as {
    id: string;
    registration: string;
    group_id: string | null;
    aircraft_groups: { name: string } | null;
  }[];
  const rows = (st.data ?? []) as Row[];
  const loadersToReload = new Set(((sup.data ?? []) as { loader_id: string }[]).map((x) => x.loader_id)).size;
  const recentChanges = (recent.data ?? []) as any[];

  const rowsByAircraft = new Map<string, Row[]>();
  for (const r of rows) {
    const list = rowsByAircraft.get(r.aircraft_id) ?? [];
    list.push(r);
    rowsByAircraft.set(r.aircraft_id, list);
  }

  const enriched = aircraft.map((x) => {
    const own = rowsByAircraft.get(x.id) ?? [];
    return { ...x, own, overall: overallStatus(x.group_id, own) };
  });

  const total = enriched.length;
  const upToDate = enriched.filter((x) => x.overall === "up_to_date").length;
  const needs = enriched.filter((x) => x.overall === "needs_loading");
  const unassigned = enriched.filter((x) => x.overall === "no_group" || x.overall === "no_requirement").length;

  const byGroup = new Map<string, { total: number; ok: number; needs: number }>();
  for (const x of enriched) {
    const key = x.aircraft_groups?.name ?? "No group";
    const g = byGroup.get(key) ?? { total: 0, ok: 0, needs: 0 };
    g.total++;
    if (x.overall === "up_to_date") g.ok++;
    if (x.overall === "needs_loading") g.needs++;
    byGroup.set(key, g);
  }

  return (
    <div className="stack">
      <Flash msg={sp.msg} err={sp.err} />

      <form action="/aircraft" method="get" className="search">
        <input
          name="q"
          placeholder="Search aircraft registration, e.g. AU-EPY"
          aria-label="Aircraft registration"
          autoComplete="off"
          autoFocus
          required
        />
        <button className="btn" type="submit">
          Find loaders
        </button>
      </form>

      <div className="grid grid-4">
        <div className="card stat">
          <div className="num">{total}</div>
          <div className="lbl">Aircraft</div>
        </div>
        <div className="card stat ok">
          <div className="num">{upToDate}</div>
          <div className="lbl">Up to date</div>
        </div>
        <div className="card stat bad">
          <div className="num">{needs.length}</div>
          <div className="lbl">Need loading</div>
        </div>
        <div className="card stat">
          <div className="num">{unassigned}</div>
          <div className="lbl">No group / no requirement</div>
        </div>
        <div className="card stat">
          <div className="num">{loadersToReload}</div>
          <div className="lbl">Loaders needing reload</div>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="card stack">
          <div className="spread">
            <h2 style={{ margin: 0 }}>Aircraft needing loading</h2>
            <Link href="/aircraft?only=needs" className="small">
              See all
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                {needs.slice(0, 12).map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link href={`/aircraft/${x.id}`}>
                        <strong>{x.registration}</strong>
                      </Link>
                      <div className="muted small">{x.aircraft_groups?.name}</div>
                    </td>
                    <td>
                      {x.own
                        .filter((r) => r.status !== "up_to_date")
                        .map((r) => (
                          <div key={`${r.system_code}-${r.kind}`} className="small">
                            {r.system_code} {KIND_LABEL[r.kind].toLowerCase()}{" "}
                            <StatusBadge status={r.status} />
                          </div>
                        ))}
                    </td>
                  </tr>
                ))}
                {needs.length === 0 && (
                  <tr>
                    <td className="muted">Every aircraft with a group is up to date.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card stack">
          <h2 style={{ margin: 0 }}>By group</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Aircraft</th>
                  <th>Up to date</th>
                  <th>Need loading</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(byGroup.entries()).map(([name, g]) => (
                  <tr key={name}>
                    <td>
                      <strong>{name}</strong>
                    </td>
                    <td>{g.total}</td>
                    <td>{g.ok}</td>
                    <td>{g.needs > 0 ? <span className="badge badge-bad">{g.needs}</span> : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Latest requirement changes</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Group</th>
                <th>System</th>
                <th>Expected item</th>
              </tr>
            </thead>
            <tbody>
              {recentChanges.map((c) => (
                <tr key={c.id}>
                  <td>{fmtDate(c.effective_from)}</td>
                  <td>{c.aircraft_groups?.name}</td>
                  <td>
                    {c.system_types?.code} {c.kind}
                  </td>
                  <td>
                    <ItemLabel item={c.items} />
                  </td>
                </tr>
              ))}
              {recentChanges.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No requirements defined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
