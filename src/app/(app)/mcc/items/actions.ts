"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { back, str } from "@/lib/flash";
import { parseProperties } from "@/lib/types";

const PATH = "/mcc/items";

export async function createItem(formData: FormData) {
  await requireRole("mcc_admin");
  const kind = str(formData, "kind");
  const system_type_id = str(formData, "system_type_id");
  const part_number = str(formData, "part_number");
  const version = str(formData, "version");
  if (!system_type_id || !["media", "software"].includes(kind) || !part_number || !version) {
    back(PATH, "err", "System, type, part number and version are required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("items").insert({
    system_type_id,
    kind,
    part_number,
    version,
    code: str(formData, "code") || null,
    description: str(formData, "description") || null,
    properties: parseProperties(String(formData.get("properties") ?? "")),
  });
  if (error) {
    back(
      PATH,
      "err",
      error.code === "23505" ? "That part number and version already exists" : error.message
    );
  }
  revalidatePath("/", "layout");
  back(PATH, "msg", `Added ${part_number} v${version}`);
}

// Part number and version identify an item and stay fixed; the rest can be corrected.
export async function updateItem(formData: FormData) {
  await requireRole("mcc_admin");
  const id = str(formData, "item_id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({
      code: str(formData, "code") || null,
      description: str(formData, "description") || null,
      properties: parseProperties(String(formData.get("properties") ?? "")),
    })
    .eq("id", id);
  if (error) back(PATH, "err", error.message);
  revalidatePath("/", "layout");
  back(PATH, "msg", "Item details saved");
}

export async function createSystemType(formData: FormData) {
  await requireRole("mcc_admin");
  const code = str(formData, "code").toUpperCase();
  const name = str(formData, "name");
  if (!code || !name) back(PATH, "err", "Code and name are required");

  const supabase = await createClient();
  const { error } = await supabase.from("system_types").insert({ code, name });
  if (error) {
    back(
      PATH,
      "err",
      error.code === "23505" ? "That system code already exists" : error.message
    );
  }
  revalidatePath("/", "layout");
  back(PATH, "msg", `System type ${code} added`);
}
