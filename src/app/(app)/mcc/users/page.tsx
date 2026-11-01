import Flash from "@/components/Flash";
import { requireRole } from "@/lib/auth";
import SearchSelect from "@/components/SearchSelect";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, type Profile, type Role } from "@/lib/types";
import { createUser, setRole } from "./actions";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requireRole("mcc_admin");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .order("full_name");
  const users = (data ?? []) as Profile[];

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Users &amp; roles</h1>
        <p className="muted">
          MCC Admin manages groups and requirements. Workshop loads loaders. Store moves loaders.
          Mechanic searches and marks aircraft as loaded.
        </p>
      </div>
      <Flash msg={sp.msg} err={sp.err} />

      <form action={createUser} className="card stack">
        <h2>Create user</h2>
        <div className="row">
          <label>
            Full name
            <input name="full_name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Temporary password
            <input name="password" type="text" minLength={8} required autoComplete="off" />
          </label>
          <label>
            Role
            <SearchSelect name="role" defaultValue="mechanic">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </SearchSelect>
          </label>
          <button className="btn" type="submit">
            Create
          </button>
        </div>
      </form>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name ?? "—"}</td>
                  <td>{u.email}</td>
                  <td>
                    <form action={setRole} className="inline">
                      <input type="hidden" name="user_id" value={u.id} />
                      <SearchSelect name="role" defaultValue={u.role}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </SearchSelect>
                      <button className="btn btn-secondary btn-small" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
