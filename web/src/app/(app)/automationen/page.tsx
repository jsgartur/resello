import Link from "next/link";
import { read, RuleType } from "@/lib/store";
import { dateTime } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { saveRule, runAutomationsNow, toggleRule } from "@/app/actions";
import { Repeat, TrendingDown, HandCoins, MessageSquareText, Heart, Play } from "lucide-react";

type Field = { key: string; label: string; def: string | number; type?: string; wide?: boolean };
type Cfg = Record<string, string | number>;
type RuleDef = { type: RuleType; title: string; icon: React.ElementType; summary: (c: Cfg) => string; schedule: (c: Cfg) => string; fields: Field[] };

const v = (c: Cfg, k: string, d: string | number) => c[k] ?? d;

const RULES: RuleDef[] = [
  {
    type: "relist", title: "Auto-Relist", icon: Repeat,
    summary: (c) => `Nach ${v(c, "after_days", 3)} Tagen online · bis zu ${v(c, "max_per_day", 20)} Angebote pro Tag · alter Artikel erst nach Erfolg gelöscht`,
    schedule: (c) => `Täglich ${v(c, "window_start", "18:00")}–${v(c, "window_end", "21:00")}`,
    fields: [
      { key: "after_days", label: "Nach Tagen online", def: 3, type: "number" },
      { key: "max_per_day", label: "Max. pro Tag", def: 20, type: "number" },
      { key: "window_start", label: "Von", def: "18:00", type: "time" },
      { key: "window_end", label: "Bis", def: "21:00", type: "time" },
    ],
  },
  {
    type: "price_drop", title: "Preissenkung", icon: TrendingDown,
    summary: (c) => `−${v(c, "percent", 10)} % pro Schritt · nur Artikel mit Mindestpreis, nie darunter`,
    schedule: (c) => `Alle ${v(c, "every_days", 7)} Tage`,
    fields: [
      { key: "percent", label: "Prozent pro Schritt", def: 10, type: "number" },
      { key: "every_days", label: "Alle X Tage", def: 7, type: "number" },
    ],
  },
  {
    type: "auto_counter", title: "Käuferangebote", icon: HandCoins,
    summary: (c) => `Nimmt gute Preisvorschläge an, sonst Gegenangebot (max. −${v(c, "max_discount_percent", 15)} %) · Entwurf zur Freigabe`,
    schedule: () => "Bei jedem neuen Angebot",
    fields: [{ key: "max_discount_percent", label: "Max. Rabatt in %", def: 15, type: "number" }],
  },
  {
    type: "ai_replies", title: "KI-Antworten", icon: MessageSquareText,
    summary: (c) => `Antwortentwürfe für Käuferfragen · Ton: ${v(c, "tone", "freundlich, locker, per du")}`,
    schedule: () => "Bei jeder neuen Nachricht",
    fields: [{ key: "tone", label: "Tonfall", def: "freundlich, locker, per du", wide: true }],
  },
  {
    type: "favourite_followup", title: "Favoriten anschreiben", icon: Heart,
    summary: (c) => `Rabatt −${v(c, "discount_percent", 10)} % an Nutzer, die einen Artikel favorisieren · Entwurf zur Freigabe`,
    schedule: () => "Bei jedem neuen Favoriten",
    fields: [
      { key: "discount_percent", label: "Rabatt in %", def: 10, type: "number" },
      { key: "template", label: "Vorlage ({rabatt}, {preis}, {alt}, {artikel})", def: "Hi! Ich hab gesehen, dass dir mein Artikel gefällt. Für dich gibt's {rabatt} % Rabatt: {preis} statt {alt}.", wide: true },
    ],
  },
];

const JOB_LABEL: Record<string, string> = { sync: "Synchronisieren", relist: "Neu einstellen", price_change: "Preis ändern", send_message: "Nachricht senden", delete_item: "Löschen" };

const nextRun = (enabled: boolean, last?: string | null) => {
  if (!enabled) return "—";
  const base = last ? new Date(last).getTime() + 15 * 60000 : Date.now();
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(Math.max(Date.now(), base)));
};

export default async function Automations({ searchParams }: { searchParams: Promise<{ tab?: string; f?: string }> }) {
  const { tab = "regeln", f = "alle" } = await searchParams;
  const d = read();
  const ruleOf = (t: RuleType) => d.rules.find((r) => r.type === t);
  const active = RULES.filter((r) => ruleOf(r.type)?.enabled).length;
  const shown = RULES.filter((r) => (f === "aktiv" ? ruleOf(r.type)?.enabled : f === "pausiert" ? !ruleOf(r.type)?.enabled : true));
  const jobs = [...d.jobs].reverse().slice(0, 50).map((j) => ({ ...j, user: d.accounts.find((a) => a.id === j.account_id)?.username }));
  const day = new Date(Date.now() - 86400000).toISOString();
  const last24 = d.jobs.filter((j) => j.created_at >= day).length;

  return (
    <>
      <PageHeader title="Automationen" sub="Läuft alle 15 Minuten automatisch. Nachrichten gehen nie ohne deine Freigabe raus.">
        <form action={runAutomationsNow}><button className="btn-primary"><Play size={15} />Jetzt ausführen</button></form>
      </PageHeader>

      <div className="mb-4 flex items-center gap-6 border-b border-line text-sm">
        <Link href="/automationen" className={`-mb-px border-b-2 pb-3 ${tab === "regeln" ? "border-accent text-white" : "border-transparent text-muted"}`}>Automationen <span className="text-muted">{RULES.length}</span></Link>
        <Link href="/automationen?tab=protokoll" className={`-mb-px border-b-2 pb-3 ${tab === "protokoll" ? "border-accent text-white" : "border-transparent text-muted"}`}>Protokoll <span className="text-muted">{d.jobs.length}</span></Link>
      </div>

      {tab === "regeln" ? (
        <>
          <div className="mb-4 flex items-center gap-2">
            {[["alle", `Alle ${RULES.length}`], ["aktiv", `Aktiv ${active}`], ["pausiert", `Pausiert ${RULES.length - active}`]].map(([k, l]) => (
              <Link key={k} href={`/automationen?f=${k}`} className={`rounded-full border px-3 py-1 text-xs ${f === k ? "border-accent/60 bg-accent/10 text-white" : "border-line text-muted hover:text-white"}`}>{l}</Link>
            ))}
            <span className="ml-auto text-xs text-muted">Aktivität · 24 h <b className="text-white">{last24}</b></span>
          </div>

          <div className="card overflow-hidden">
            <div className="hidden grid-cols-[1fr_190px_180px_110px_60px] gap-4 border-b border-line px-5 py-3 text-xs text-muted md:grid">
              <span>Automatisierung</span><span>Zeitplan</span><span>Letzter Lauf</span><span>Nächster Lauf</span><span />
            </div>
            {shown.map((r) => {
              const rule = ruleOf(r.type);
              const cfg = rule?.config ?? {};
              const on = !!rule?.enabled;
              return (
                <details key={r.type} className="border-b border-line last:border-0">
                  <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 hover:bg-panel-2/50 md:grid-cols-[1fr_190px_180px_110px_60px]">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${on ? "bg-accent" : "bg-line"}`} />
                      <r.icon size={18} className="mt-0.5 shrink-0 text-muted" />
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted">{r.summary(cfg)}</div>
                      </div>
                    </div>
                    <div className="hidden text-sm md:block">{r.schedule(cfg)}</div>
                    <div className="hidden text-sm text-muted md:block">
                      {rule?.last_run_at ? <>{dateTime(rule.last_run_at)}<div className="text-xs">{rule.last_result}</div></> : "Noch nicht gelaufen"}
                    </div>
                    <div className="hidden text-sm text-muted md:block">{nextRun(on, rule?.last_run_at)}</div>
                    <form action={toggleRule.bind(null, r.type)} className="flex justify-end">
                      <button title={on ? "Pausieren" : "Aktivieren"} className={`relative h-6 w-11 rounded-full transition ${on ? "bg-accent" : "bg-line"}`}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    </form>
                  </summary>
                  <form action={saveRule} className="grid gap-3 bg-panel-2/30 px-5 pb-5 pt-2 sm:grid-cols-2 md:grid-cols-4">
                    <input type="hidden" name="type" value={r.type} />
                    {on && <input type="hidden" name="enabled" value="on" />}
                    {r.fields.map((fl) => (
                      <div key={fl.key} className={fl.wide ? "sm:col-span-2 md:col-span-4" : ""}>
                        <label className="label">{fl.label}</label>
                        <input name={`cfg_${fl.key}`} type={fl.type ?? "text"} defaultValue={cfg[fl.key] ?? fl.def} className="input" />
                      </div>
                    ))}
                    <div className="flex items-end sm:col-span-2 md:col-span-4"><button className="btn-ghost ml-auto">Einstellungen speichern</button></div>
                  </form>
                </details>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Zeile anklicken = Einstellungen öffnen · Schalter rechts = an/aus</p>
        </>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="p-3">Aufgabe</th><th>Konto</th><th>Status</th><th>Erstellt</th><th>Fehler</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-line">
                  <td className="p-3">{JOB_LABEL[j.type] ?? j.type}</td>
                  <td>{j.user ? `@${j.user}` : "–"}</td>
                  <td><StatusBadge status={j.status} /></td>
                  <td className="text-muted">{dateTime(j.created_at)}</td>
                  <td className="max-w-xs truncate text-red-400">{j.error}</td>
                </tr>
              ))}
              {!jobs.length && <tr><td colSpan={5} className="p-6 text-center text-muted">Noch keine Aufgaben.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
