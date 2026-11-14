"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { prepareExtensionConnection } from "@/app/actions";

type ExtState = { installed: boolean; accountId: string | null; username: string | null; status: string | null; statusOk: boolean | null };

const DOMAINS = ["vinted.de", "vinted.at", "vinted.fr", "vinted.nl", "vinted.be", "vinted.it", "vinted.es", "vinted.pl", "vinted.cz"];

export function ConnectWizard() {
  const router = useRouter();
  const [ext, setExt] = useState<ExtState | null>(null);
  const [domain, setDomain] = useState("vinted.de");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window || e.data?.source !== "resello-ext") return;
      setExt(e.data);
      if (e.data.username) { setBusy(false); router.refresh(); }
      if (e.data.statusOk === false && busy) setBusy(false);
    };
    window.addEventListener("message", onMsg);
    const ping = () => window.postMessage({ source: "resello-page", cmd: "ping" }, window.location.origin);
    ping();
    const t = setInterval(ping, 2000);
    return () => { window.removeEventListener("message", onMsg); clearInterval(t); };
  }, [router, busy]);

  async function connect() {
    setBusy(true); setError(null);
    try {
      const cfg = await prepareExtensionConnection(domain);
      window.postMessage({ source: "resello-page", cmd: "connect", config: { ...cfg, dashboardUrl: window.location.origin } }, window.location.origin);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler"); setBusy(false);
    }
  }

  const installed = !!ext?.installed;
  const connected = !!ext?.username;

  const Step = ({ done, n, title, children }: { done: boolean; n: number; title: string; children: React.ReactNode }) => (
    <div className="flex gap-4 border-t border-line py-5 first:border-0 first:pt-0">
      {done ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={22} /> : <Circle className="mt-0.5 shrink-0 text-muted" size={22} />}
      <div className="flex-1">
        <div className="font-medium">{n}. {title}</div>
        <div className="mt-1 text-sm text-muted">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="card p-6">
      <div className="mb-5 text-lg font-semibold">Vinted verbinden</div>

      <Step done={installed} n={1} title="Erweiterung „Resello Connect“ in Chrome installieren">
        {installed ? <span className="text-emerald-400">Erweiterung erkannt ✓</span> : (
          <ol className="list-decimal space-y-1 pl-5">
            <li>In Chrome oben in die Adresszeile <code className="text-white">chrome://extensions</code> eintippen und Enter drücken.</li>
            <li>Rechts oben den Schalter <b className="text-white">Entwicklermodus</b> einschalten.</li>
            <li>Links oben auf <b className="text-white">Entpackte Erweiterung laden</b> klicken.</li>
            <li>Den Ordner <code className="text-white">vinted-cockpit\extension</code> auswählen.</li>
            <li>Diese Seite hier neu laden (F5). Dann wird hier ein grüner Haken angezeigt.</li>
          </ol>
        )}
      </Step>

      <Step done={connected} n={2} title="Bei Vinted einloggen">
        Öffne Vinted in einem neuen Tab und logg dich ganz normal ein. Lass den Tab offen, solange das Tool für dich arbeiten soll.
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={domain} onChange={(e) => setDomain(e.target.value)} className="input w-40">
            {DOMAINS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <a href={`https://www.${domain}`} target="_blank" className="btn-ghost">{domain} öffnen</a>
        </div>
      </Step>

      <Step done={connected} n={3} title="Verbinden">
        {connected ? (
          <span className="text-emerald-400">Verbunden als <b>@{ext?.username}</b> – deine Artikel und Nachrichten werden jetzt geladen.</span>
        ) : (
          <>
            <button onClick={connect} disabled={!installed || busy} className="btn-primary mt-1">
              {busy ? <><Loader2 className="animate-spin" size={16} />Verbinde…</> : "Jetzt verbinden"}
            </button>
            {!installed && <div className="mt-2">Erst Schritt 1 erledigen.</div>}
            {ext?.status && busy && <div className="mt-2">{ext.status}</div>}
            {ext?.statusOk === false && ext.status && <div className="mt-2 text-red-400">{ext.status}</div>}
            {error && <div className="mt-2 text-red-400">{error}</div>}
          </>
        )}
      </Step>
    </div>
  );
}
