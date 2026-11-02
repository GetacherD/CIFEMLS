import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export async function getProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    (data as Profile | null) ?? {
      id: user.id,
      email: user.email ?? null,
      full_name: null,
      role: "mechanic",
    }
  );
}

// Page-level guard. The database enforces the same rules (RLS + role-checked functions).
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await getProfile();
  if (!roles.includes(profile.role)) {
    redirect("/?err=" + encodeURIComponent("Your role cannot open that page"));
  }
  return profile;
}

// For pages anyone may open: the profile when signed in, otherwise null (no redirect).
export async function getProfileOptional(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfile();
}
