"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { back, str } from "@/lib/flash";

const PATH = "/store";

export async function moveLoader(formData: FormData) {
  await requireRole("store", "workshop", "mcc_admin");
  const location = str(formData, "location_id");
  if (!location) back(PATH, "err", "Choose the new location");

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_loader", {
    p_loader: str(formData, "loader_id"),
    p_location: location,
    p_bin: str(formData, "bin") || null,
    p_note: str(formData, "note") || null,
  });
  if (error) back(PATH, "err", error.message);
  revalidatePath("/", "layout");
  back(PATH, "msg", "Loader location updated");
}
