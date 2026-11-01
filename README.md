# QIFEMLS

Technicians search an aircraft registration and see which **media loaders** and **software loaders** hold the latest required version, and where each loader is (store and bin).

Stack: Next.js 15 (server actions) · **Supabase** (Postgres, Auth, row level security) · deploys on **Vercel**.

## How it works

- **MCC admin** defines aircraft groups, puts each aircraft in a group, and sets the expected media and software per group and system type (IFE today). Items carry a part number, version and any properties (for example DTD keep, DTD delta). Changing a group's expected item makes every aircraft in that group outdated automatically. History is kept.
- **Workshop** registers loaders (own part number and serial number) and records what each holds. Loaders holding a superseded version show **Needs reload**.
- **Store** updates each loader's store and bin; every move is kept.
- **Mechanic** searches a registration, sees required vs installed, the loaders holding the required version with PN/SN, store and bin, then marks the aircraft loaded.

| Role | Can do |
|---|---|
| MCC Admin | Everything |
| Workshop | Register loaders, record contents, swap superseded items, move loaders |
| Store | Move loaders, see contents |
| Mechanic | Search aircraft, see loaders and locations, mark aircraft loaded |

## Deploy: Supabase + Vercel (about 20 minutes)

### 1. Supabase (database and login)

1. Create a project at supabase.com. Save the database password somewhere safe.
2. **SQL Editor** → New query → paste all of `supabase/schema.sql` → Run. (Safe to run again.)
3. Optional sample data: run **one** of `supabase/seed_sample_memo.sql` (anonymised memo data: 5 groups, 36 aircraft, 3 loaders, history) or `supabase/seed.sql` (small demo). Skip this to start empty.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
5. **Authentication → Users → Add user → Create new user**, tick **Auto Confirm User**. **The first user you create becomes MCC Admin.**
6. **Project Settings → API** (or API Keys): copy the **Project URL**, the **anon / publishable key** and the **service_role / secret key**.

### 2. Vercel (hosting)

1. Put this folder in a GitHub repository (do not commit `.env.local`; `.gitignore` already excludes it).
2. At vercel.com: **Add New → Project** → import the repository. Framework is detected as Next.js.
3. Before deploying, open **Environment Variables** and add, for Production, Preview and Development:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key (mark as **Sensitive**) |

4. **Deploy.** Open the URL, sign in with the admin user from step 1.5, then use **Users** to create the workshop, store and mechanic accounts.
5. Tip: in Vercel **Settings → Functions → Region**, pick the region closest to your Supabase project (it makes pages faster).

If the site shows "QIFEMLS is not configured", an environment variable is missing: add it in Vercel and **Redeploy**.

### Run locally (optional)

```
cp .env.example .env.local    # fill in the three values
npm install
npm run dev                   # http://localhost:3000
```

## Security

- Row level security is on for every table. Everyone signed in can read; master data is writable only by MCC admin; requirement changes, loader contents, moves and install records go through role-checked database functions and cannot be written directly. Anonymous users see nothing.
- `SUPABASE_SERVICE_ROLE_KEY` is used only on the server, only by the Users page. Never put it in a `NEXT_PUBLIC_` variable and never commit it.
- Keep public sign-up switched off. Only an admin creates accounts.
- If a key was ever pasted into a chat, email or a public repository, rotate it in Supabase (Project Settings → API) and update Vercel.

## Project layout

```
supabase/schema.sql             tables, views, RLS, role-checked functions (run once, safe to re-run)
supabase/seed*.sql              optional sample data
src/middleware.ts               session refresh + redirect to /login
src/app/(app)/                  dashboard, aircraft search/detail, mcc/*, workshop, store, loaders/[id]
src/lib/                        Supabase clients, auth guard, types
```
