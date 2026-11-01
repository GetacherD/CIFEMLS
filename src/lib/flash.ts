import { redirect } from "next/navigation";

// Redirect back to a page with a one-off message shown by <Flash />.
export function back(path: string, kind: "msg" | "err", text: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(text)}`);
}

export function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}
