export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action="/api/login" method="post" className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <div className="text-xl font-semibold">Resello</div>
          <p className="text-sm text-muted">Dein Vinted-Cockpit</p>
        </div>
        <div>
          <label className="label">Passwort</label>
          <input name="password" type="password" className="input" autoFocus required />
        </div>
        {error && <p className="text-sm text-red-400">Falsches Passwort.</p>}
        <button className="btn-primary w-full">Anmelden</button>
      </form>
    </main>
  );
}
