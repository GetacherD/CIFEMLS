"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { back, str } from "@/lib/flash";

const PATH = "/workshop";

export async function createLoader(formData: FormData) {
  await requireRole("workshop", "mcc_admin");
  const loader_no = str(formData, "loader_no").toUpperCase();
  const kind = str(formData, "kind");
  if (!loader_no || !["media", "software"].includes(kind)) {
    back(PATH, "err", "Loader number and type are required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("loaders").insert({
    loader_no,
    kind,
    part_number: str(formData, "part_number") || null,
    serial_number: str(formData, "serial_number") || null,
    location_id: str(formData, "location_id") || null,
    bin: str(formData, "bin") || null,
  });
  if (error) {
    back(
      PATH,
      "err",
      error.code === "23505"
        ? "A loader with that number, or that part number + serial number, already exists"
        : error.message
    );
  }
  revalidatePath("/", "layout");
  back(PATH, "msg", `Loader ${loader_no} registered`);
}

export async function addItemToLoader(formData: FormData) {
  await requireRole("workshop", "mcc_admin");
  const item_id = str(formData, "item_id");
  if (!item_id) back(PATH, "err", "Choose an item to load");

  const supabase = await createClient();
  const { error } = await supabase.rpc("load_item_on_loader", {
    p_loader: str(formData, "loader_id"),
    p_item: item_id,
  });
  if (error) back(PATH, "err", error.message);
  revalidatePath("/", "layout");
  back(PATH, "msg", "Loader contents updated");
}

export async function removeItemFromLoader(formData: FormData) {
  await requireRole("workshop", "mcc_admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_item_from_loader", {
    p_loader: str(formData, "loader_id"),
    p_item: str(formData, "item_id"),
  });
  if (error) back(PATH, "err", error.message);
  revalidatePath("/", "layout");
  back(PATH, "msg", "Item removed from loader");
}

export async function reloadLoader(formData: FormData) {
  await requireRole("workshop", "mcc_admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reload_loader", {
    p_loader: str(formData, "loader_id"),
  });
  if (error) back(PATH, "err", error.message);
  revalidatePath("/", "layout");
  back(PATH, "msg", `${data ?? 0} superseded item(s) replaced with the latest version`);
}

export async function setLoaderActive(formData: FormData) {
  await requireRole("workshop", "mcc_admin");
  const supabase = await createClient();
  const active = str(formData, "active") === "true";
  const { error } = await supabase.rpc("set_loader_active", {
    p_loader: str(formData, "loader_id"),
    p_active: active,
  });
  if (error) back(PATH, "err", error.message);
  revalidatePath("/", "layout");
  back(PATH, "msg", active ? "Loader back in service" : "Loader marked out of service");
}

export async function updateLoaderDetails(formData: FormData) {
  await requireRole("workshop", "mcc_admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_loader_details", {
    p_loader: str(formData, "loader_id"),
    p_part_number: str(formData, "part_number"),
    p_serial_number: str(formData, "serial_number"),
    p_notes: str(formData, "notes") || null,
  });
  if (error) {
    back(
      PATH,
      "err",
      error.code === "23505" ? "Another loader already has that part number + serial number" : error.message
    );
  }
  revalidatePath("/", "layout");
  back(PATH, "msg", "Loader details saved");
}
