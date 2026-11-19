"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2 } from "lucide-react";
import { addStudioImageToDraft } from "@/app/actions";

export function GalleryToDraft({ imageId, drafts }: { imageId: string; drafts: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState("");
  async function go() {
    setBusy(true);
    const r = await addStudioImageToDraft(imageId, target || null, true);
    setBusy(false);
    if (r.ok && r.draftId) router.push(`/neu?id=${r.draftId}`);
  }
  if (!open) return <button onClick={() => setOpen(true)} title="Zu Entwurf hinzufügen" className="hover:text-white"><FilePlus2 size={14} /></button>;
  return (
    <div className="absolute inset-x-2 bottom-10 z-10 space-y-2 rounded-lg border border-line bg-panel p-2 shadow-xl">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="input py-1 text-xs">
        <option value="">+ Neuer Entwurf</option>
        {drafts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
      <div className="flex gap-1">
        <button onClick={go} disabled={busy} className="btn-primary flex-1 py-1 text-xs">{busy && <Loader2 size={12} className="animate-spin" />}Hinzufügen</button>
        <button onClick={() => setOpen(false)} className="btn-ghost py-1 text-xs">✕</button>
      </div>
    </div>
  );
}
