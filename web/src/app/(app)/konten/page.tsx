import { read } from "@/lib/store";
import { dateTime } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ConnectWizard } from "@/components/ConnectWizard";
import { addAccount, deleteAccount, queueSync, setAccountStatus } from "@/app/actions";

export const dynamic = "force-dynamic";

export default function Accounts() {
  const accounts = read().accounts;

  return (
    <>
      <PageHeader title="Vinted-Konten" sub="Verbinde deinen Vinted-Shop in drei Schritten." />

      <ConnectWizard />

      {accounts.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="text-sm font-medium">Deine Konten</div>
          {accounts.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {a.username ? `@${a.username}` : a.label} <StatusBadge status={a.status} />
                  <span className="badge">{a.connection === "cloud" ? "Cloud" : "Chrome"}</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {a.domain} · zuletzt synchronisiert: {dateTime(a.last_sync_at)}
                  {a.last_error && <span className="text-red-400"> · {a.last_error}</span>}
                </div>
              </div>
              <form action={queueSync.bind(null, a.id)}><button className="btn-ghost">Jetzt synchronisieren</button></form>
              <form action={setAccountStatus.bind(null, a.id, a.status === "paused" ? "pending" : "paused")}>
                <button className="btn-ghost">{a.status === "paused" ? "Fortsetzen" : "Pausieren"}</button>
              </form>
              <form action={deleteAccount.bind(null, a.id)}><button className="btn-ghost text-red-400">Entfernen</button></form>
            </div>
          ))}
        </div>
      )}

      <details className="card mt-6 p-5">
        <summary className="cursor-pointer text-sm font-medium">Für Fortgeschrittene: Cloud-Login (läuft auch, wenn Chrome zu ist)</summary>
        <div className="mt-4 space-y-3 text-sm text-muted">
          <p>Ein Python-Programm (Ordner <code>worker</code>) meldet sich selbst bei Vinted an und arbeitet rund um die Uhr. Das Risiko einer Kontosperre ist höher als mit der Erweiterung. Anleitung: README, Abschnitt 3b.</p>
          <form action={addAccount} className="grid gap-3 md:grid-cols-4 md:items-end">
            <input type="hidden" name="connection" value="cloud" />
            <div><label className="label">Name</label><input name="label" placeholder="Cloud-Shop" className="input" required /></div>
            <div>
              <label className="label">Vinted-Seite</label>
              <select name="domain" className="input">{["vinted.de", "vinted.at", "vinted.fr", "vinted.nl"].map((d) => <option key={d}>{d}</option>)}</select>
            </div>
            <div><label className="label">Proxy</label><input name="proxy" placeholder="http://user:pass@host:port" className="input" /></div>
            <button className="btn-ghost">Cloud-Konto anlegen</button>
          </form>
          {accounts.filter((a) => a.connection === "cloud").map((a) => (
            <div key={a.id} className="rounded-lg bg-panel-2 p-3">
              <b className="text-white">{a.label}</b>: in <code>worker/.env</code> eintragen → <code>ACCOUNT_ID={a.id}</code>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
