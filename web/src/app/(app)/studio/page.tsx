import { read } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { Studio, DraftOption } from "@/components/Studio";

export const dynamic = "force-dynamic";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft } = await searchParams;
  const drafts: DraftOption[] = [...read().listing_drafts].reverse().slice(0, 40)
    .map((d) => ({ id: d.id, label: [d.art, d.title || "Entwurf ohne Titel"].filter(Boolean).join(" · ").slice(0, 70), photos: d.photos, status: d.status }));
  return (
    <>
      <PageHeader title="Bildstudio" sub="KI-Produktfotos mit Google Gemini. Ergebnisse landen in der Galerie und lassen sich direkt einem Angebot hinzufügen." />
      <Studio drafts={drafts} initialDraft={drafts.some((d) => d.id === draft) ? draft : undefined} />
    </>
  );
}
