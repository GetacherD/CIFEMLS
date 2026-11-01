import Link from "next/link";
import Flash from "@/components/Flash";
import ItemLabel from "@/components/ItemLabel";
import StatusBadge from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, fmtDate, type Item, type Kind } from "@/lib/types";
import { moveLoader } from "./actions";

interface LoaderRow {
  id: string;
  loader_no: string;
  kind: Kind;
  active: boolean;
  part_number: string | null;
  serial_number: string | null;
  bin: string | null;
  location_id: string | null;
  locations: { name: string } | null;
}

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; q?: string }>;
}) {
  await requireRole("store", "workshop", "mcc_admin");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const supabase = await createClient();

  let loaderQuery = supabase
    .from("loaders")
    .select("id, loader_no, kind, active, part_number, serial_number, bin, location_id, locations(name)")
    .order("loader_no");
  const safe = q.replace(/[,()%*]/g, " ").trim();
  if (safe) {
    loaderQuery = loaderQuery.or(
      `loader_no.ilike.%${safe}%,serial_number.ilike.%${safe}%,part_number.ilike.%${safe}%`
    );
  }

  const [ld, li, it, loc, hist] = await Promise.all([
    loaderQuery,
    supabase.from("loader_items").select("loader_id, item_id"),
    supabase.from("v_item_status").select("*"),
    supabase.from("locations").select("id, name").order("name"),
    supabase
      .from("loader_location_history")
      .select("loader_id, moved_at")
      .order("moved_at", { ascending: false })
      .limit(2000),
  ]);

  const loaders = (ld.data ?? []) as unknown as LoaderRow[];
  const loaderItems = (li.data ?? []) as { loader_id: string; item_id: string }[];
  const items = (it.data ?? []) as (Item & { is_superseded: boolean })[];
  const locations = (loc.data ?? []) as { id: string; name: string }[];
  const itemById = new Map(items.map((i) => [i.id, i]));

  const lastMoved = new Map<string, string>();
  for (const h of (hist.data ?? []) as { loader_id: string; moved_at: string }[]) {
    if (!lastMoved.has(h.loader_id)) lastMoved.set(h.loader_id, h.moved_at);
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Store</h1>
        <p className="muted">Update where each loader is kept after it leaves the workshop.</p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <form className="card row" method="get">
        <label>
          Find loader
          <input name="q" defaultValue={q} placeholder="loader no., part no. or serial no." />
        </label>
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Loader</th>
                <th>Holds</th>
                <th>Store / bin</th>
                <th>Last moved</th>
                <th>Move to store &amp; bin</th>
              </tr>
            </thead>
            <tbody>
              {loaders.map((l) => {
                const held = loaderItems
                  .filter((x) => x.loader_id === l.id)
                  .map((x) => itemById.get(x.item_id))
                  .filter((x): x is NonNullable<typeof x> => Boolean(x));
                return (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/loaders/${l.id}`}>
                        <strong>{l.loader_no}</strong>
                      </Link>
                      <div className="muted small">{KIND_LABEL[l.kind]} loader</div>
                      <div className="muted small">
                        PN {l.part_number ?? "—"} · SN {l.serial_number ?? "—"}
                      </div>
                      {!l.active && <StatusBadge status="inactive" />}
                    </td>
                    <td>
                      {held.length === 0 && <span className="muted">Empty</span>}
                      {held.map((h) => (
                        <div key={h.id}>
                          <ItemLabel item={h} />
                          {h.is_superseded && (
                            <>
                              {" "}
                              <StatusBadge status="superseded" />
                            </>
                          )}
                        </div>
                      ))}
                    </td>
                    <td>
                      <strong>{l.locations?.name ?? "—"}</strong>
                      {l.bin && <div className="small">Bin {l.bin}</div>}
                    </td>
                    <td className="muted small">{fmtDate(lastMoved.get(l.id))}</td>
                    <td>
                      <form action={moveLoader} className="row">
                        <input type="hidden" name="loader_id" value={l.id} />
                        <select name="location_id" defaultValue={l.location_id ?? ""} required>
                          <option value="" disabled>
                            Select…
                          </option>
                          {locations.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                        <input name="bin" placeholder="bin" defaultValue={l.bin ?? ""} style={{ width: "6rem" }} />
                        <input name="note" placeholder="note (optional)" style={{ width: "9rem" }} />
                        <button className="btn btn-small" type="submit">
                          Move
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {loaders.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No loaders found.
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
