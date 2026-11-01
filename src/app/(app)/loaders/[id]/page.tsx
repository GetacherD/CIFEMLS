import Link from "next/link";
import { notFound } from "next/navigation";
import ItemLabel from "@/components/ItemLabel";
import StatusBadge from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, fmtDate, fmtPlace, type Item, type Kind } from "@/lib/types";

export default async function LoaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: loader } = await supabase
    .from("loaders")
    .select("id, loader_no, kind, active, notes, part_number, serial_number, bin, locations(name)")
    .eq("id", id)
    .maybeSingle();
  if (!loader) notFound();

  const [li, hist, pr] = await Promise.all([
    supabase.from("loader_items").select("item_id, loaded_at, loaded_by").eq("loader_id", id),
    supabase
      .from("loader_location_history")
      .select("id, moved_at, moved_by, note, from_bin, to_bin, from:locations!from_location_id(name), to:locations!to_location_id(name)")
      .eq("loader_id", id)
      .order("moved_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const contents = (li.data ?? []) as { item_id: string; loaded_at: string; loaded_by: string | null }[];
  const ids = contents.map((c) => c.item_id);
  const { data: itemData } = ids.length
    ? await supabase.from("v_item_status").select("*").in("id", ids)
    : { data: [] };
  const itemById = new Map(
    ((itemData ?? []) as (Item & { is_superseded: boolean })[]).map((i) => [i.id, i])
  );
  const people = new Map(
    ((pr.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map(
      (p) => [p.id, p.full_name ?? p.email ?? "—"]
    )
  );
  const moves = (hist.data ?? []) as any[];
  const loc = loader.locations as unknown as { name: string } | null;

  return (
    <div className="stack">
      <div className="page-head">
        <p className="small">
          <Link href="/">← Dashboard</Link>
        </p>
        <h1>
          Loader {loader.loader_no}{" "}
          {!loader.active && <StatusBadge status="inactive" />}
        </h1>
        <p className="muted">
          {KIND_LABEL[loader.kind as Kind]} loader · PN {loader.part_number ?? "—"} · SN{" "}
          {loader.serial_number ?? "—"}
        </p>
        <p className="muted">
          Currently at <strong>{fmtPlace(loc?.name, loader.bin)}</strong>
        </p>
      </div>

      <section className="card stack">
        <h2>Contents</h2>
        {contents.length === 0 && <p className="muted">Nothing recorded on this loader.</p>}
        <div className="table-wrap">
          <table>
            <tbody>
              {contents.map((c) => {
                const item = itemById.get(c.item_id);
                return (
                  <tr key={c.item_id}>
                    <td>
                      <ItemLabel item={item} />
                    </td>
                    <td>{item?.is_superseded && <StatusBadge status="superseded" />}</td>
                    <td className="muted small">
                      Loaded {fmtDate(c.loaded_at)}
                      {c.loaded_by ? ` by ${people.get(c.loaded_by) ?? "—"}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h2>Location history</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>From</th>
                <th>To</th>
                <th>By</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.moved_at)}</td>
                  <td>{m.from?.name ? fmtPlace(m.from.name, m.from_bin) : "—"}</td>
                  <td>{m.to?.name ? fmtPlace(m.to.name, m.to_bin) : "—"}</td>
                  <td>{m.moved_by ? people.get(m.moved_by) ?? "—" : "—"}</td>
                  <td className="muted">{m.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
