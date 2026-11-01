import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { notFound } from "next/navigation";
import SearchSelect from "@/components/SearchSelect";
import Flash from "@/components/Flash";
import ItemLabel from "@/components/ItemLabel";
import StatusBadge from "@/components/StatusBadge";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, fmtDate, fmtPlace, overallStatus, type StatusRow } from "@/lib/types";
import { markLoaded } from "./actions";

interface LoaderHit {
  loader_id: string;
  loader_no: string;
  loader_part_number: string | null;
  loader_serial_number: string | null;
  location_name: string | null;
  bin: string | null;
  item_id: string;
  loaded_at: string;
}

export default async function AircraftDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: ac } = await supabase
    .from("aircraft")
    .select("id, registration, group_id, aircraft_groups(name)")
    .eq("id", id)
    .maybeSingle();
  if (!ac) notFound();
  const groupName = (ac.aircraft_groups as unknown as { name: string } | null)?.name ?? null;

  const { data: statusData } = await supabase
    .from("v_aircraft_status")
    .select("*")
    .eq("aircraft_id", id)
    .order("system_code")
    .order("kind");
  const rows = (statusData ?? []) as StatusRow[];
  const overall = overallStatus(ac.group_id, rows);

  const neededIds = Array.from(
    new Set(rows.filter((r) => r.status !== "up_to_date").map((r) => r.required_item_id))
  );

  const [loaderRes, logRes, peopleRes] = await Promise.all([
    neededIds.length
      ? supabase
          .from("v_loader_availability")
          .select("loader_id, loader_no, loader_part_number, loader_serial_number, location_name, bin, item_id, loaded_at")
          .in("item_id", neededIds)
          .eq("active", true)
      : Promise.resolve({ data: [] as LoaderHit[] }),
    supabase
      .from("aircraft_install_log")
      .select("id, installed_at, installed_by, note, items(part_number, version, code, kind, properties), loaders(loader_no)")
      .eq("aircraft_id", id)
      .order("installed_at", { ascending: false })
      .limit(10),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const hits = ((loaderRes.data ?? []) as LoaderHit[]).sort(
    (a, b) =>
      (a.location_name ?? "").localeCompare(b.location_name ?? "") ||
      a.loader_no.localeCompare(b.loader_no)
  );
  const log = (logRes.data ?? []) as any[];
  const people = new Map(
    ((peopleRes.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map(
      (p) => [p.id, p.full_name ?? p.email ?? "—"]
    )
  );
  const canMark = profile.role === "mechanic" || profile.role === "mcc_admin";

  return (
    <div className="stack">
      <SearchBar defaultValue={ac.registration} />

      <div className="page-head">
        <p className="small">
          <Link href="/aircraft">← All aircraft</Link>
        </p>
        <div className="spread">
          <div>
            <h1 className="reg">{ac.registration}</h1>
            <span className="muted">{groupName ? `Group ${groupName}` : "No group assigned"}</span>
          </div>
          <StatusBadge status={overall} />
        </div>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      {overall === "no_group" && (
        <div className="card">
          This aircraft has no group yet. MCC needs to assign it to a group before loaders can be
          matched.
        </div>
      )}
      {overall === "no_requirement" && (
        <div className="card">
          The group {groupName} has no expected media or software defined yet. MCC needs to set the
          requirements.
        </div>
      )}

      <div className="stack">
        {rows.map((r) => {
          const tone = r.status === "up_to_date" ? "ok" : r.status === "outdated" ? "bad" : "warn";
          const candidates = hits.filter((h) => h.item_id === r.required_item_id);
          return (
            <section key={`${r.system_code}-${r.kind}`} className={`card req-card ${tone} stack`}>
              <div className="spread">
                <h2 style={{ margin: 0 }}>
                  {r.system_code} {KIND_LABEL[r.kind].toLowerCase()}
                </h2>
                <StatusBadge status={r.status} />
              </div>

              <dl className="kv">
                <dt>Required</dt>
                <dd>
                  <ItemLabel
                    item={{
                      part_number: r.req_part_number,
                      version: r.req_version,
                      code: r.req_code,
                      properties: r.req_properties,
                    }}
                  />
                </dd>
                <dt>Installed</dt>
                <dd>
                  {r.installed_item_id ? (
                    <>
                      <ItemLabel
                        item={{
                          part_number: r.inst_part_number!,
                          version: r.inst_version!,
                          code: r.inst_code,
                          properties: r.inst_properties,
                        }}
                      />
                      <span className="muted small">since {fmtDate(r.installed_at)}</span>
                    </>
                  ) : (
                    <span className="muted">Nothing recorded</span>
                  )}
                </dd>
              </dl>

              {r.status === "up_to_date" ? (
                <p className="muted" style={{ margin: 0 }}>
                  Nothing to load.
                </p>
              ) : (
                <>
                  <div>
                    <h3>
                      {KIND_LABEL[r.kind]} loaders holding the required version ({candidates.length})
                    </h3>
                    {candidates.length === 0 && (
                      <p className="badge badge-warn" style={{ whiteSpace: "normal" }}>
                        No in-service loader holds this yet. Contact the workshop.
                      </p>
                    )}
                    {candidates.map((h) => (
                      <div key={h.loader_id} className="loader-hit">
                        <span className="id">
                          <Link href={`/loaders/${h.loader_id}`}>
                            <strong>{h.loader_no}</strong>
                          </Link>
                          <small>
                            PN {h.loader_part_number ?? "—"} · SN {h.loader_serial_number ?? "—"}
                          </small>
                        </span>
                        <span className="where">{fmtPlace(h.location_name, h.bin)}</span>
                        <span className="muted small">loaded {fmtDate(h.loaded_at)}</span>
                      </div>
                    ))}
                  </div>

                  {canMark && (
                    <form action={markLoaded} className="row">
                      <input type="hidden" name="aircraft_id" value={ac.id} />
                      <input type="hidden" name="item_id" value={r.required_item_id} />
                      <label>
                        Loader used
                        <SearchSelect name="loader_id" defaultValue="">
                          <option value="">— not recorded —</option>
                          {candidates.map((h) => (
                            <option key={h.loader_id} value={h.loader_id}>
                              {h.loader_no} ({fmtPlace(h.location_name, h.bin)})
                            </option>
                          ))}
                        </SearchSelect>
                      </label>
                      <label style={{ flex: 1, minWidth: "10rem" }}>
                        Note
                        <input name="note" placeholder="optional" />
                      </label>
                      <button className="btn" type="submit">
                        Mark as loaded
                      </button>
                    </form>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Loading history</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th>Loader</th>
                <th>By</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.installed_at)}</td>
                  <td>
                    <ItemLabel item={l.items} />
                  </td>
                  <td>{l.loaders?.loader_no ?? "—"}</td>
                  <td>{l.installed_by ? people.get(l.installed_by) ?? "—" : "—"}</td>
                  <td className="muted">{l.note ?? ""}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Nothing recorded through this system yet.
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
