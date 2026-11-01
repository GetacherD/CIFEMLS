import Flash from "@/components/Flash";
import ItemLabel from "@/components/ItemLabel";
import SearchSelect from "@/components/SearchSelect";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KINDS, KIND_LABEL, fmtDate, type Item } from "@/lib/types";
import { createGroup, setRequirement } from "./actions";

interface Group {
  id: string;
  name: string;
  description: string | null;
}

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requireRole("mcc_admin");
  const sp = await searchParams;
  const supabase = await createClient();

  const [g, s, it, cur, hist, ac, pr] = await Promise.all([
    supabase.from("aircraft_groups").select("id, name, description").order("name"),
    supabase.from("system_types").select("id, code, name").order("code"),
    supabase.from("items").select("*").order("part_number").order("version"),
    supabase.from("v_group_requirements_current").select("*"),
    supabase
      .from("group_requirements")
      .select(
        "id, group_id, system_type_id, kind, effective_from, effective_to, set_by, items(part_number, version, code, properties), system_types(code)"
      )
      .order("effective_from", { ascending: false })
      .limit(500),
    supabase.from("aircraft").select("id, group_id"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const groups = (g.data ?? []) as Group[];
  const systems = (s.data ?? []) as { id: string; code: string; name: string }[];
  const items = (it.data ?? []) as Item[];
  const current = (cur.data ?? []) as any[];
  const history = (hist.data ?? []) as any[];
  const aircraft = (ac.data ?? []) as { id: string; group_id: string | null }[];
  const people = new Map(
    ((pr.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map(
      (p) => [p.id, p.full_name ?? p.email ?? "—"]
    )
  );

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Groups &amp; requirements</h1>
        <p className="muted">
          Define the expected media and software for each aircraft group. Changing a requirement
          makes every aircraft in the group outdated automatically.
        </p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <form action={createGroup} className="card row">
        <label>
          New group name
          <input name="name" placeholder="e.g. A350-1000" required />
        </label>
        <label style={{ flex: 1, minWidth: "14rem" }}>
          Description
          <input name="description" placeholder="optional" />
        </label>
        <button className="btn" type="submit">
          Add group
        </button>
      </form>

      {groups.length === 0 && <p className="muted">No groups yet. Add the first one above.</p>}

      {groups.map((group) => {
        const count = aircraft.filter((a) => a.group_id === group.id).length;
        const groupHistory = history.filter((h) => h.group_id === group.id);
        return (
          <section key={group.id} className="card stack">
            <div className="spread">
              <div>
                <h2 style={{ marginBottom: 0 }}>{group.name}</h2>
                <span className="muted small">
                  {count} aircraft{group.description ? ` · ${group.description}` : ""}
                </span>
              </div>
            </div>

            <div className="grid grid-2">
              {systems.flatMap((sys) =>
                KINDS.map((kind) => {
                  const row = current.find(
                    (c) =>
                      c.group_id === group.id && c.system_type_id === sys.id && c.kind === kind
                  );
                  const options = items.filter(
                    (i) => i.system_type_id === sys.id && i.kind === kind
                  );
                  return (
                    <div key={`${sys.id}-${kind}`} className="card">
                      <h3>
                        {sys.code} {KIND_LABEL[kind].toLowerCase()}
                      </h3>
                      <p>
                        Expected now:{" "}
                        {row ? (
                          <ItemLabel item={row} />
                        ) : (
                          <span className="badge badge-warn">Not defined</span>
                        )}
                      </p>
                      {options.length === 0 ? (
                        <p className="muted small">
                          No {kind} items for {sys.code} yet. Add one on the Items page.
                        </p>
                      ) : (
                        <form action={setRequirement} className="row">
                          <input type="hidden" name="group_id" value={group.id} />
                          <input type="hidden" name="system_id" value={sys.id} />
                          <input type="hidden" name="kind" value={kind} />
                          <label style={{ flex: 1, minWidth: "12rem" }}>
                            Set expected {kind}
                            <SearchSelect name="item_id" defaultValue={row?.item_id ?? ""} required>
                              {!row && (
                                <option value="" disabled>
                                  Select…
                                </option>
                              )}
                              {options.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.part_number} v{o.version}
                                  {o.code ? ` — ${o.code}` : ""}
                                </option>
                              ))}
                            </SearchSelect>
                          </label>
                          <button className="btn" type="submit">
                            Apply
                          </button>
                        </form>
                      )}
                      <p className="muted small" style={{ marginBottom: 0 }}>
                        A different item here marks all {count} aircraft in {group.name} as
                        needing loading.
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <details>
              <summary>Requirement history ({groupHistory.length})</summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>System</th>
                      <th>Item</th>
                      <th>From</th>
                      <th>Until</th>
                      <th>Set by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupHistory.map((h) => (
                      <tr key={h.id}>
                        <td>
                          {h.system_types?.code} {h.kind}
                        </td>
                        <td>
                          <ItemLabel item={h.items} />
                        </td>
                        <td>{fmtDate(h.effective_from)}</td>
                        <td>{h.effective_to ? fmtDate(h.effective_to) : "current"}</td>
                        <td>{h.set_by ? people.get(h.set_by) ?? "—" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
