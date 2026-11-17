import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { InstallButton } from "@/components/InstallButton";
import { read } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const d = read();
  const pending = d.drafts.filter((x) => x.status === "pending").length;
  const acc = d.accounts.find((a) => a.status === "connected") ?? d.accounts[0];
  return (
    <div className="flex min-h-screen">
      <Sidebar pendingDrafts={pending} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:justify-end lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="font-semibold">Resello</span>
          </div>
          <div className="flex items-center gap-2">
          <InstallButton />
          {acc ? (
            <a href="/konten" className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-sm">
              <span className={`h-2 w-2 rounded-full ${acc.status === "connected" ? "bg-accent" : "bg-red-400"}`} />
              {acc.username ? `@${acc.username}` : acc.label}
            </a>
          ) : (
            <a href="/konten" className="btn-primary">Vinted verbinden</a>
          )}
          </div>
        </header>
        <main className="p-4 pb-28 lg:p-8">{children}</main>
      </div>
      <MobileNav pendingDrafts={pending} />
    </div>
  );
}
