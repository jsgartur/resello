export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

const statusColors: Record<string, string> = {
  active: "text-emerald-400 border-emerald-900", connected: "text-emerald-400 border-emerald-900", done: "text-emerald-400 border-emerald-900", sent: "text-emerald-400 border-emerald-900",
  sold: "text-sky-400 border-sky-900", reserved: "text-sky-400 border-sky-900", running: "text-sky-400 border-sky-900",
  pending: "text-amber-400 border-amber-900", queued: "text-amber-400 border-amber-900",
  error: "text-red-400 border-red-900", failed: "text-red-400 border-red-900",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusColors[status] ?? ""}`}>{status}</span>;
}
