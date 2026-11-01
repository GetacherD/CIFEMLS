import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/app/actions";
import { ROLE_LABEL, type Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  roles: Role[] | "all";
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", roles: "all" },
  { href: "/aircraft", label: "Aircraft", roles: "all" },
  { href: "/mcc/groups", label: "Groups & requirements", roles: ["mcc_admin"] },
  { href: "/mcc/items", label: "Items", roles: ["mcc_admin"] },
  { href: "/mcc/aircraft", label: "Fleet", roles: ["mcc_admin"] },
  { href: "/workshop", label: "Workshop", roles: ["workshop", "mcc_admin"] },
  { href: "/store", label: "Store", roles: ["store", "workshop", "mcc_admin"] },
  { href: "/mcc/users", label: "Users", roles: ["mcc_admin"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const links = NAV.filter((n) => n.roles === "all" || n.roles.includes(profile.role));

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            QIFEMLS
          </Link>
          <nav className="nav" aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="who">
            <span>
              {profile.full_name ?? profile.email} · <em>{ROLE_LABEL[profile.role]}</em>
            </span>
            <button className="btn btn-secondary btn-small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
