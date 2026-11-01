export type Role = "mcc_admin" | "workshop" | "store" | "mechanic";
export type Kind = "media" | "software";

export const KINDS: Kind[] = ["media", "software"];

export const ROLE_LABEL: Record<Role, string> = {
  mcc_admin: "MCC Admin",
  workshop: "Workshop",
  store: "Store",
  mechanic: "Mechanic",
};

export const KIND_LABEL: Record<Kind, string> = {
  media: "Media",
  software: "Software",
};

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
}

export interface SystemType {
  id: string;
  code: string;
  name: string;
}

export interface Item {
  id: string;
  system_type_id: string;
  kind: Kind;
  part_number: string;
  version: string;
  code: string | null;
  description: string | null;
  properties?: Record<string, string> | null;
}

export interface StatusRow {
  aircraft_id: string;
  registration: string;
  group_id: string | null;
  group_name: string | null;
  system_type_id: string;
  system_code: string;
  kind: Kind;
  required_item_id: string;
  req_part_number: string;
  req_version: string;
  req_code: string | null;
  req_properties: Record<string, string> | null;
  installed_item_id: string | null;
  inst_part_number: string | null;
  inst_version: string | null;
  inst_code: string | null;
  inst_properties: Record<string, string> | null;
  installed_at: string | null;
  status: "up_to_date" | "outdated" | "not_loaded";
}

export type Overall = "up_to_date" | "needs_loading" | "no_group" | "no_requirement";

export function overallStatus(
  groupId: string | null,
  rows: Pick<StatusRow, "status">[]
): Overall {
  if (!groupId) return "no_group";
  if (rows.length === 0) return "no_requirement";
  return rows.every((r) => r.status === "up_to_date") ? "up_to_date" : "needs_loading";
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "Store · Bin A-01"
export function fmtPlace(store?: string | null, bin?: string | null): string {
  if (!store) return "Location unknown";
  return bin ? `${store} · Bin ${bin}` : store;
}

// Textarea lines "Name: value" -> { Name: value }
export function parseProperties(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([^:=]+?)\s*[:=]\s*(.*?)\s*$/);
    if (m && m[1] && m[2]) out[m[1]] = m[2];
  }
  return out;
}

export function propertiesToText(p?: Record<string, string> | null): string {
  return Object.entries(p ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}
