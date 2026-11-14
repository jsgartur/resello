import { PageHeader } from "@/components/ui";
import { DATA_DIR } from "@/lib/store";

const VARS = [
  ["APP_PASSWORD", "Dashboard-Passwort"], ["EXTENSION_TOKEN", "Token für Erweiterung & Worker"],
  ["GEMINI_API_KEY", "Google Gemini (Bildstudio & KI-Antworten)"],
];

export default function Settings() {
  return (
    <>
      <PageHeader title="Einstellungen" sub="Konfiguration läuft über die Datei .env im Ordner web." />
      <div className="card divide-y divide-line">
        {VARS.map(([k, label]) => (
          <div key={k} className="flex items-center justify-between p-3 text-sm">
            <div><div className="font-mono">{k}</div><div className="text-xs text-muted">{label}</div></div>
            {process.env[k] ? <span className="badge text-emerald-400">gesetzt</span> : <span className="badge text-red-400">fehlt</span>}
          </div>
        ))}
      </div>
      <div className="card mt-4 p-4 text-sm text-muted">
        <div className="mb-1 font-medium text-white">Speicherort</div>
        Alle Daten liegen in <code>{DATA_DIR}/resello.json</code>, Bilder in <code>{DATA_DIR}/bilder</code>. Für ein Backup einfach den Ordner kopieren.
        <div className="mb-1 mt-3 font-medium text-white">Automationen</div>
        Laufen automatisch alle 15 Minuten, solange das Dashboard gestartet ist. Sofort ausführen: Button „Jetzt ausführen“ unter Automationen.
      </div>
    </>
  );
}
