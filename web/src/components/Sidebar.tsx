"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Inbox, Zap, Wallet, Sparkles, Images, Users, Settings,
} from "lucide-react";

export const groups = [
  { title: "Arbeitsbereich", items: [
    { href: "/", label: "Übersicht", icon: LayoutDashboard },
    { href: "/angebote", label: "Angebote", icon: Package },
    { href: "/postfach", label: "Postfach", icon: Inbox },
    { href: "/automationen", label: "Automationen", icon: Zap },
  ]},
  { title: "Auswertung", items: [{ href: "/finanzen", label: "Finanzen", icon: Wallet }] },
  { title: "Studio", items: [
    { href: "/studio", label: "Bildstudio", icon: Sparkles },
    { href: "/galerie", label: "Galerie", icon: Images },
  ]},
  { title: "Konto", items: [
    { href: "/konten", label: "Vinted-Konten", icon: Users },
    { href: "/einstellungen", label: "Einstellungen", icon: Settings },
  ]},
];

export function Sidebar({ pendingDrafts }: { pendingDrafts: number }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel p-3 lg:flex">
      <div className="mb-6 flex items-center gap-2 px-2 pt-1">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-bold text-black">R</div>
        <div>
          <div className="text-sm font-semibold">Resello</div>
          <div className="text-[11px] text-muted">Vinted Cockpit</div>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted">{g.title}</div>
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition ${active ? "bg-panel-2 text-white" : "text-muted hover:bg-panel-2 hover:text-white"}`}>
                  <Icon size={16} />
                  <span className="flex-1">{label}</span>
                  {href === "/postfach" && pendingDrafts > 0 && (
                    <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-black">{pendingDrafts}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
