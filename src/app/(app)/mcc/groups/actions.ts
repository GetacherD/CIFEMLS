"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { back, str } from "@/lib/flash";

const PATH = "/mcc/groups";

export async function createGroup(formData: FormData) {
  await requireRole("mcc_admin");
  const name = str(formData, "name");
  if (!name) back(PATH, "err", "Group name is required");

  const supabase = await createClient();
  const { error } = await supabase
    .from("aircraft_groups")
    .insert({ name, description: str(formData, "description") || null });
  if (error) {
    back(
      PATH,
      "err",
      error.code === "23505" ? "A group with that name already exists" : error.message
    );
  }
  revalidatePath(PATH);
  back(PATH, "msg", `Group ${name} created`);
}

export async function setRequirement(formData: FormData) {
  await requireRole("mcc_admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_group_requirement", {
    p_group: str(formData, "group_id"),
    p_system: str(formData, "system_id"),
    p_kind: str(formData, "kind"),
    p_item: str(formData, "item_id"),
  });
  if (error) back(PATH, "err", error.message);

  revalidatePath("/", "layout");
  const res = data as { changed: boolean; aircraft_outdated: number };
  if (!res.changed) {
    back(PATH, "msg", "No change: that item is already the current requirement");
  }
  back(
    PATH,
    "msg",
    `Requirement updated. ${res.aircraft_outdated} aircraft in this group now need loading.`
  );
}
