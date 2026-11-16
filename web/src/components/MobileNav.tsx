"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Package, Inbox, Zap, Menu, X } from "lucide-react";
import { groups } from "@/components/Sidebar";

const MAIN = [
  { href: "/", label: "Übersicht", icon: LayoutDashboard },
  { href: "/angebote", label: "Angebote", icon: Package },
  { href: "/postfach", label: "Postfach", icon: Inbox },
  { href: "/automationen", label: "Automation", icon: Zap },
];

/** Untere App-Leiste + "Mehr"-Menü für das Handy */
export function MobileNav({ pendingDrafts }: { pendingDrafts: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const moreActive = !MAIN.some((m) => isActive(m.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-panel p-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">Menü</span>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {groups.flatMap((g) => g.items).filter((i) => !MAIN.some((m) => m.href === i.href)).map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs ${isActive(href) ? "border-accent/60 bg-accent/10 text-white" : "border-line text-muted"}`}>
                  <Icon size={20} />{label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MAIN.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive(href) ? "text-accent" : "text-muted"}`}>
            <Icon size={22} />
            {label}
            {href === "/postfach" && pendingDrafts > 0 && (
              <span className="absolute right-[22%] top-1.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-black">{pendingDrafts}</span>
            )}
          </Link>
        ))}
        <button onClick={() => setOpen((o) => !o)} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${open || moreActive ? "text-accent" : "text-muted"}`}>
          <Menu size={22} />Mehr
        </button>
      </nav>
    </>
  );
}
