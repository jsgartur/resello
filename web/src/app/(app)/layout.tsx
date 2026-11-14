import { Sidebar } from "@/components/Sidebar";
import { read } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pending = read().drafts.filter((d) => d.status === "pending").length;
  return (
    <div className="flex min-h-screen">
      <Sidebar pendingDrafts={pending} />
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
