"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { back, str } from "@/lib/flash";

export async function markLoaded(formData: FormData) {
  await requireRole("mechanic", "mcc_admin");
  const aircraftId = str(formData, "aircraft_id");
  const path = `/aircraft/${aircraftId}`;

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_aircraft_loaded", {
    p_aircraft: aircraftId,
    p_item: str(formData, "item_id"),
    p_loader: str(formData, "loader_id") || null,
    p_note: str(formData, "note") || null,
  });
  if (error) back(path, "err", error.message);

  revalidatePath("/", "layout");
  back(path, "msg", "Recorded. The aircraft now shows the new version.");
}
