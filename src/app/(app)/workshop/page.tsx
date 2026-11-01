import Link from "next/link";
import Flash from "@/components/Flash";
import ItemLabel from "@/components/ItemLabel";
import StatusBadge from "@/components/StatusBadge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, fmtPlace, type Item, type Kind, type StatusRow } from "@/lib/types";
import {
  addItemToLoader,
  createLoader,
  reloadLoader,
  removeItemFromLoader,
  setLoaderActive,
  updateLoaderDetails,
} from "./actions";

interface LoaderRow {
  id: string;
  loader_no: string;
  kind: Kind;
  active: boolean;
  part_number: string | null;
  serial_number: string | null;
  bin: string | null;
  notes: string | null;
  location_id: string | null;
  locations: { name: string } | null;
}

export default async function WorkshopPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requireRole("workshop", "mcc_admin");
  const sp = await searchParams;
  const supabase = await createClient();

  const [ld, li, it, req, st, loc, rep, sys] = await Promise.all([
    supabase
      .from("loaders")
      .select("id, loader_no, kind, active, part_number, serial_number, bin, notes, location_id, locations(name)")
      .order("loader_no"),
    supabase.from("loader_items").select("loader_id, item_id"),
    supabase.from("v_item_status").select("*"),
    supabase.from("v_group_requirements_current").select("*"),
    supabase.from("v_aircraft_status").select("*"),
    supabase.from("locations").select("id, name").order("name"),
    supabase.from("v_item_replacements").select("old_item_id, new_item_id"),
    supabase.from("system_types").select("id, code"),
  ]);

  const loaders = (ld.data ?? []) as unknown as LoaderRow[];
  const loaderItems = (li.data ?? []) as { loader_id: string; item_id: string }[];
  const items = (it.data ?? []) as (Item & { is_current: boolean; is_superseded: boolean })[];
  const requirements = (req.data ?? []) as any[];
  const statusRows = (st.data ?? []) as StatusRow[];
  const locations = (loc.data ?? []) as { id: string; name: string }[];
  const replacements = (rep.data ?? []) as { old_item_id: string; new_item_id: string }[];
  const systemCode = new Map(((sys.data ?? []) as { id: string; code: string }[]).map((s) => [s.id, s.code]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Work to do: each currently required item, who needs it, and where it already sits.
  const requiredIds = Array.from(new Set(requirements.map((r) => r.item_id as string)));
  const workToDo = requiredIds
    .map((itemId) => {
      const item = itemById.get(itemId)!;
      const groups = Array.from(
        new Set(requirements.filter((r) => r.item_id === itemId).map((r) => r.group_name as string))
      );
      const needing = new Set(
        statusRows
          .filter((r) => r.required_item_id === itemId && r.status !== "up_to_date")
          .map((r) => r.aircraft_id)
      ).size;
      const heldBy = loaderItems.filter((x) => x.item_id === itemId).map((x) => x.loader_id);
      const activeLoaders = loaders.filter((l) => heldBy.includes(l.id) && l.active).length;
      return { item, groups, needing, activeLoaders };
    })
    .sort((a, b) => b.needing - a.needing);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Workshop</h1>
        <p className="muted">
          Load the loaders with the planned media and software, then record what each one holds.
        </p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <section className="card stack">
        <h2>Planned media &amp; software</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Groups</th>
                <th>Aircraft needing it</th>
                <th>In-service loaders holding it</th>
              </tr>
            </thead>
            <tbody>
              {workToDo.map(({ item, groups, needing, activeLoaders }) => (
                <tr key={item.id}>
                  <td>
                    <ItemLabel item={item} />
                  </td>
                  <td>
                    {systemCode.get(item.system_type_id)} {KIND_LABEL[item.kind].toLowerCase()}
                  </td>
                  <td>{groups.join(", ")}</td>
                  <td>
                    {needing > 0 ? <span className="badge badge-bad">{needing}</span> : <span className="badge badge-ok">0</span>}
                  </td>
                  <td>
                    {activeLoaders > 0 ? (
                      activeLoaders
                    ) : (
                      <span className="badge badge-warn">None, load one</span>
                    )}
                  </td>
                </tr>
              ))}
              {workToDo.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    MCC has not defined any group requirements yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <h2 style={{ marginBottom: 0 }}>Loaders</h2>
        {loaders.map((l) => {
          const held = loaderItems
            .filter((x) => x.loader_id === l.id)
            .map((x) => itemById.get(x.item_id))
            .filter((x): x is NonNullable<typeof x> => Boolean(x));
          const superseded = held.filter((h) => h.is_superseded);
          const canSwap = superseded.some((h) => replacements.some((r) => r.old_item_id === h.id));
          const options = items.filter((i) => i.kind === l.kind && !held.some((h) => h.id === i.id));
          return (
            <div key={l.id} className="card stack">
              <div className="spread">
                <div>
                  <h3 style={{ marginBottom: 0 }}>
                    <Link href={`/loaders/${l.id}`}>{l.loader_no}</Link>{" "}
                    <span className="muted small">
                      {KIND_LABEL[l.kind]} loader · {fmtPlace(l.locations?.name, l.bin)}
                    </span>
                  </h3>
                  <div className="muted small">
                    PN {l.part_number ?? "—"} · SN {l.serial_number ?? "—"}
                  </div>
                </div>
                <div className="row">
                  {!l.active && <StatusBadge status="inactive" />}
                  {superseded.length > 0 && <span className="badge badge-warn">Needs reload</span>}
                  <form action={setLoaderActive} className="inline">
                    <input type="hidden" name="loader_id" value={l.id} />
                    <input type="hidden" name="active" value={l.active ? "false" : "true"} />
                    <button className="btn btn-secondary btn-small" type="submit">
                      {l.active ? "Mark out of service" : "Back in service"}
                    </button>
                  </form>
                </div>
              </div>

              <div>
                {held.length === 0 && <span className="muted">Empty: nothing recorded on this loader.</span>}
                {held.map((h) => (
                  <span key={h.id} className={`chip ${h.is_superseded ? "superseded" : ""}`}>
                    <ItemLabel item={h} />
                    {h.is_superseded && <strong>(superseded)</strong>}
                    <form action={removeItemFromLoader} className="inline">
                      <input type="hidden" name="loader_id" value={l.id} />
                      <input type="hidden" name="item_id" value={h.id} />
                      <button className="btn btn-danger btn-small" type="submit" aria-label="Remove item">
                        ×
                      </button>
                    </form>
                  </span>
                ))}
              </div>

              <details>
                <summary>Loader details</summary>
                <form action={updateLoaderDetails} className="row" style={{ marginTop: "0.6rem" }}>
                  <input type="hidden" name="loader_id" value={l.id} />
                  <label>
                    Loader part number
                    <input name="part_number" defaultValue={l.part_number ?? ""} />
                  </label>
                  <label>
                    Loader serial number
                    <input name="serial_number" defaultValue={l.serial_number ?? ""} />
                  </label>
                  <label style={{ flex: 1, minWidth: "10rem" }}>
                    Notes
                    <input name="notes" defaultValue={l.notes ?? ""} />
                  </label>
                  <button className="btn btn-secondary" type="submit">
                    Save details
                  </button>
                </form>
              </details>

              <div className="row">
                {canSwap && (
                  <form action={reloadLoader} className="inline">
                    <input type="hidden" name="loader_id" value={l.id} />
                    <button className="btn" type="submit">
                      Replace superseded with latest
                    </button>
                  </form>
                )}
                {options.length > 0 && (
                  <form action={addItemToLoader} className="row">
                    <input type="hidden" name="loader_id" value={l.id} />
                    <label>
                      Add {l.kind} to this loader
                      <select name="item_id" defaultValue="" required>
                        <option value="" disabled>
                          Select…
                        </option>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {systemCode.get(o.system_type_id)} · {o.part_number} v{o.version}
                            {o.is_current ? " (current)" : o.is_superseded ? " (superseded)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="btn btn-secondary" type="submit">
                      Record loaded
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
        {loaders.length === 0 && <p className="muted">No loaders registered yet.</p>}
      </section>

      <form action={createLoader} className="card stack">
        <h2>Register a new loader</h2>
        <div className="row">
          <label>
            Loader number
            <input name="loader_no" placeholder="e.g. ML-003" required style={{ textTransform: "uppercase" }} />
          </label>
          <label>
            Type
            <select name="kind" required>
              <option value="media">Media loader</option>
              <option value="software">Software loader</option>
            </select>
          </label>
          <label>
            Part number
            <input name="part_number" />
          </label>
          <label>
            Serial number
            <input name="serial_number" />
          </label>
          <label>
            Store
            <select name="location_id" defaultValue="">
              <option value="">— none —</option>
              {locations.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bin
            <input name="bin" placeholder="e.g. A-01" style={{ width: "7rem" }} />
          </label>
          <button className="btn" type="submit">
            Register loader
          </button>
        </div>
      </form>
    </div>
  );
}
