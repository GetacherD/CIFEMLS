const MAP: Record<string, [string, string]> = {
  up_to_date: ["ok", "Up to date"],
  outdated: ["bad", "Outdated"],
  not_loaded: ["warn", "Not loaded"],
  needs_loading: ["bad", "Needs loading"],
  no_group: ["muted", "No group"],
  no_requirement: ["muted", "No requirement"],
  superseded: ["warn", "Superseded"],
  current: ["ok", "Current"],
  unused: ["muted", "Not required yet"],
  active: ["ok", "Active"],
  inactive: ["muted", "Out of service"],
};

export default function StatusBadge({ status }: { status: string }) {
  const [tone, label] = MAP[status] ?? ["muted", status];
  return <span className={`badge badge-${tone}`}>{label}</span>;
}
