import Flash from "@/components/Flash";
import StatusBadge from "@/components/StatusBadge";
import SearchSelect from "@/components/SearchSelect";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, propertiesToText, type Kind } from "@/lib/types";
import { createItem, createSystemType, updateItem } from "./actions";

interface ItemRow {
  id: string;
  system_type_id: string;
  kind: Kind;
  part_number: string;
  version: string;
  code: string | null;
  description: string | null;
  properties: Record<string, string> | null;
  is_current: boolean;
  is_superseded: boolean;
}

const PLACEHOLDER = "Release date: 2026-09-15\nLanguages: EN, AM, AR\nSize: 48 GB";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requireRole("mcc_admin");
  const sp = await searchParams;
  const supabase = await createClient();

  const [s, it] = await Promise.all([
    supabase.from("system_types").select("id, code, name").order("code"),
    supabase
      .from("v_item_status")
      .select("*")
      .order("part_number")
      .order("version", { ascending: false }),
  ]);
  const systems = (s.data ?? []) as { id: string; code: string; name: string }[];
  const items = (it.data ?? []) as ItemRow[];
  const codeOf = new Map(systems.map((x) => [x.id, x.code]));

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Media &amp; software items</h1>
        <p className="muted">
          Every media or software release with its part number, version, code/serial label and any
          other properties you want technicians to see.
        </p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <form action={createItem} className="card stack">
        <h2>Add item</h2>
        <div className="row">
          <label>
            System
            <SearchSelect name="system_type_id" required>
              {systems.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} — {x.name}
                </option>
              ))}
            </SearchSelect>
          </label>
          <label>
            Type
            <SearchSelect name="kind" required>
              <option value="media">Media</option>
              <option value="software">Software</option>
            </SearchSelect>
          </label>
          <label>
            Part number
            <input name="part_number" required />
          </label>
          <label>
            Version
            <input name="version" required style={{ width: "7rem" }} />
          </label>
          <label>
            Code / serial / label
            <input name="code" />
          </label>
          <label style={{ flex: 1, minWidth: "12rem" }}>
            Description
            <input name="description" />
          </label>
        </div>
        <label>
          Other properties (one per line, as Name: value)
          <textarea name="properties" placeholder={PLACEHOLDER} />
        </label>
        <div>
          <button className="btn" type="submit">
            Add item
          </button>
        </div>
      </form>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>System</th>
                <th>Type</th>
                <th>Part number</th>
                <th>Version</th>
                <th>Code / label</th>
                <th>Properties</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const props = Object.entries(i.properties ?? {});
                return (
                  <tr key={i.id}>
                    <td>{codeOf.get(i.system_type_id)}</td>
                    <td>{KIND_LABEL[i.kind]}</td>
                    <td>
                      <strong>{i.part_number}</strong>
                      {i.description && <div className="muted small">{i.description}</div>}
                    </td>
                    <td>v{i.version}</td>
                    <td>{i.code ?? "—"}</td>
                    <td>
                      {props.map(([k, v]) => (
                        <div key={k} className="small">
                          <span className="muted">{k}:</span> {v}
                        </div>
                      ))}
                      <details>
                        <summary className="small">Edit</summary>
                        <form action={updateItem} className="stack" style={{ marginTop: "0.5rem", minWidth: "16rem" }}>
                          <input type="hidden" name="item_id" value={i.id} />
                          <label>
                            Code / label
                            <input name="code" defaultValue={i.code ?? ""} />
                          </label>
                          <label>
                            Description
                            <input name="description" defaultValue={i.description ?? ""} />
                          </label>
                          <label>
                            Properties
                            <textarea name="properties" defaultValue={propertiesToText(i.properties)} />
                          </label>
                          <div>
                            <button className="btn btn-secondary btn-small" type="submit">
                              Save
                            </button>
                          </div>
                        </form>
                      </details>
                    </td>
                    <td>
                      <StatusBadge
                        status={i.is_current ? "current" : i.is_superseded ? "superseded" : "unused"}
                      />
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form action={createSystemType} className="card row">
        <div style={{ flexBasis: "100%" }}>
          <h3 style={{ marginBottom: 0 }}>Add another system type</h3>
          <span className="muted small">
            For later: lighting configuration, intercom software, and so on. IFE is the only one
            needed today.
          </span>
        </div>
        <label>
          Code
          <input name="code" placeholder="e.g. LIGHT" required style={{ width: "9rem" }} />
        </label>
        <label style={{ flex: 1, minWidth: "12rem" }}>
          Name
          <input name="name" placeholder="e.g. Cabin lighting configuration" required />
        </label>
        <button className="btn btn-secondary" type="submit">
          Add system type
        </button>
      </form>
    </div>
  );
}
