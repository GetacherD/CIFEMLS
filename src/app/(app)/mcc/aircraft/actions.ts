"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { back, str } from "@/lib/flash";

const PATH = "/mcc/aircraft";

export async function addAircraft(formData: FormData) {
  await requireRole("mcc_admin");
  const registration = str(formData, "registration").toUpperCase();
  if (!registration) back(PATH, "err", "Registration is required");

  const supabase = await createClient();
  const { error } = await supabase.from("aircraft").insert({
    registration,
    group_id: str(formData, "group_id") || null,
  });
  if (error) {
    back(
      PATH,
      "err",
      error.code === "23505" ? `${registration} already exists` : error.message
    );
  }
  revalidatePath("/", "layout");
  back(PATH, "msg", `Aircraft ${registration} added`);
}

export async function assignGroup(formData: FormData) {
  await requireRole("mcc_admin");
  const id = str(formData, "aircraft_id");
  const group_id = str(formData, "group_id") || null;

  const supabase = await createClient();
  const { error } = await supabase.from("aircraft").update({ group_id }).eq("id", id);
  if (error) back(PATH, "err", error.message);
  revalidatePath("/", "layout");
  back(PATH, "msg", "Group updated");
}

// One aircraft per line:  AU-EPY, A350-1000   (group optional)
export async function bulkAddAircraft(formData: FormData) {
  await requireRole("mcc_admin");
  const text = String(formData.get("bulk") ?? "");
  const supabase = await createClient();

  const { data: groups } = await supabase.from("aircraft_groups").select("id, name");
  const byName = new Map(
    ((groups ?? []) as { id: string; name: string }[]).map((g) => [g.name.toLowerCase(), g.id])
  );

  const withGroup: { registration: string; group_id: string }[] = [];
  const withoutGroup: { registration: string }[] = [];
  const problems: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const [regRaw, groupRaw] = t.split(/[,;\t]/).map((s) => s.trim());
    const registration = (regRaw ?? "").toUpperCase();
    if (!registration) continue;
    if (groupRaw) {
      const gid = byName.get(groupRaw.toLowerCase());
      if (!gid) {
        problems.push(`${registration}: unknown group "${groupRaw}"`);
        continue;
      }
      withGroup.push({ registration, group_id: gid });
    } else {
      withoutGroup.push({ registration });
    }
  }

  if (withGroup.length + withoutGroup.length === 0) {
    back(PATH, "err", problems[0] ?? "Nothing to import");
  }

  if (withGroup.length) {
    const { error } = await supabase
      .from("aircraft")
      .upsert(withGroup, { onConflict: "registration" });
    if (error) back(PATH, "err", error.message);
  }
  if (withoutGroup.length) {
    const { error } = await supabase
      .from("aircraft")
      .upsert(withoutGroup, { onConflict: "registration", ignoreDuplicates: true });
    if (error) back(PATH, "err", error.message);
  }

  revalidatePath("/", "layout");
  const saved = withGroup.length + withoutGroup.length;
  const skipped = problems.length ? ` Skipped ${problems.length}: ${problems.slice(0, 3).join("; ")}` : "";
  back(PATH, "msg", `${saved} aircraft saved.${skipped}`);
}
