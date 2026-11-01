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
      <section className="login-hero" aria-hidden="true">
        <span className="brand-mark brand-mark-lg">Q</span>
        <p className="login-claim">Right media.<br />Right loader.<br />Right aircraft.</p>
      </section>
      <form action={signIn} className="login-card">
        <h1>Sign in to QIFEMLS</h1>
        <p className="muted">Find the loader that holds the latest media or software for an aircraft, and where it is stored.</p>
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
