import Flash from "@/components/Flash";
import { signIn } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="login-wrap">
      <form action={signIn} className="card login-card">
        <h1>QIFEMLS</h1>
        <p className="muted">Aircraft media and software loader finder</p>
        <Flash err={sp.err} />
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required autoFocus />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
