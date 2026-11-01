"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { back, str } from "@/lib/flash";

const PATH = "/mcc/users";
const ROLES = ["mcc_admin", "workshop", "store", "mechanic"];

export async function createUser(formData: FormData) {
  await requireRole("mcc_admin");
  const email = str(formData, "email").toLowerCase();
  const full_name = str(formData, "full_name");
  const role = str(formData, "role");
  const password = String(formData.get("password") ?? "");

  if (!email || !full_name) back(PATH, "err", "Name and email are required");
  if (!ROLES.includes(role)) back(PATH, "err", "Choose a role");
  if (password.length < 8) back(PATH, "err", "Password must be at least 8 characters");

  const admin = createAdminClient();
  if (!admin) {
    back(PATH, "err", "SUPABASE_SERVICE_ROLE_KEY is not set on the server, so users cannot be created here");
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error || !data.user) back(PATH, "err", error?.message ?? "Could not create the user");

  const { error: roleError } = await admin
    .from("profiles")
    .update({ role, full_name })
    .eq("id", data.user.id);
  if (roleError) back(PATH, "err", `User created but role not set: ${roleError.message}`);

  revalidatePath(PATH);
  back(PATH, "msg", `${full_name} can now sign in as ${role.replace("_", " ")}`);
}

export async function setRole(formData: FormData) {
  const me = await requireRole("mcc_admin");
  const id = str(formData, "user_id");
  const role = str(formData, "role");
  if (!ROLES.includes(role)) back(PATH, "err", "Choose a role");
  if (id === me.id && role !== "mcc_admin") {
    back(PATH, "err", "You cannot remove your own admin role");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) back(PATH, "err", error.message);
  revalidatePath(PATH);
  back(PATH, "msg", "Role updated");
}
