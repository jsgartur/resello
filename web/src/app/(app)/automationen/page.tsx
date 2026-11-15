import { read } from "@/lib/store";
import { dateTime } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { saveRule, runAutomationsNow } from "@/app/actions";

type Field = { key: string; label: string; def: string | number; type?: string; wide?: boolean };

const RULES: { type: string; title: string; desc: string; fields: Field[] }[] = [
  {
    type: "relist", title: "Automatisches Neueinstellen",
    desc: "Stellt Ladenhüter neu ein (neuer Artikel online, dann alter gelöscht), nur im Zeitfenster.",
    fields: [
      { key: "after_days", label: "Nach Tagen online", def: 3, type: "number" },
      { key: "window_start", label: "Von (Uhrzeit)", def: "18:00", type: "time" },
      { key: "window_end", label: "Bis (Uhrzeit)", def: "21:00", type: "time" },
      { key: "max_per_day", label: "Max. pro Tag", def: 20, type: "number" },
    ],
  },
  {
    type: "price_drop", title: "Preissenkung",
    desc: "Senkt den Preis regelmäßig – nur bei Artikeln mit Mindestpreis, nie darunter.",
    fields: [
      { key: "percent", label: "Prozent pro Schritt", def: 10, type: "number" },
      { key: "every_days", label: "Alle X Tage", def: 7, type: "number" },
    ],
  },
  {
    type: "auto_counter", title: "Gegenangebote",
    desc: "Erstellt Antwortentwürfe auf Preisangebote: annehmen oder Gegenangebot, nie unter Mindestpreis.",
    fields: [{ key: "max_discount_percent", label: "Max. Rabatt in %", def: 15, type: "number" }],
  },
  {
    type: "ai_replies", title: "KI-Antworten",
    desc: "Schreibt Entwürfe für normale Käuferfragen. Du gibst sie im Postfach frei.",
    fields: [{ key: "tone", label: "Tonfall", def: "freundlich, locker, per du", wide: true }],
  },
  {
    type: "favourite_followup", title: "Favoriten anschreiben",
    desc: "Wer deinen Artikel favorisiert, bekommt einen Rabatt-Vorschlag (Entwurf zur Freigabe).",
    fields: [
      { key: "discount_percent", label: "Rabatt in %", def: 10, type: "number" },
      { key: "template", label: "Vorlage ({rabatt}, {preis}, {alt}, {artikel})", def: "Hi! Ich hab gesehen, dass dir mein Artikel gefällt. Für dich gibt's {rabatt} % Rabatt: {preis} statt {alt}.", wide: true },
    ],
  },
];

export default function Automations() {
  const d = read();
  const rules = d.rules;
  const jobs = [...d.jobs].reverse().slice(0, 25).map((j) => ({ ...j, accountLabel: d.accounts.find((a) => a.id === j.account_id)?.label }));

  return (
    <>
      <PageHeader title="Automationen" sub="Regeln laufen nur, wenn du sie aktivierst. Nachrichten gehen nie ohne deine Freigabe raus.">
        <form action={runAutomationsNow}><button className="btn-primary">Jetzt ausführen</button></form>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        {RULES.map((r) => {
          const rule = rules.find((x) => x.type === r.type);
          const cfg = (rule?.config ?? {}) as Record<string, string | number>;
          return (
            <form key={r.type} action={saveRule} className="card p-5">
              <input type="hidden" name="type" value={r.type} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{r.title}</div>
                  <p className="mt-1 text-sm text-muted">{r.desc}</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="enabled" defaultChecked={rule?.enabled} className="h-4 w-4 accent-teal-400" />
                  Aktiv
                </label>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {r.fields.map((f) => (
                  <div key={f.key} className={f.wide ? "col-span-2" : ""}>
                    <label className="label">{f.label}</label>
                    <input name={`cfg_${f.key}`} type={f.type ?? "text"} defaultValue={cfg[f.key] ?? f.def} className="input" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end"><button className="btn-ghost">Speichern</button></div>
            </form>
          );
        })}
      </div>

      <div className="card mt-6">
        <div className="border-b border-line p-4 text-sm font-medium">Letzte Jobs</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="p-3">Typ</th><th>Konto</th><th>Status</th><th>Erstellt</th><th>Fehler</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-line">
                <td className="p-3">{j.type}</td>
                <td>{j.accountLabel}</td>
                <td><StatusBadge status={j.status} /></td>
                <td className="text-muted">{dateTime(j.created_at)}</td>
                <td className="max-w-xs truncate text-red-400">{j.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
