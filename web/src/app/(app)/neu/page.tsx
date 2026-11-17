import { read } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { ListingCreator, TemplateOption } from "@/components/ListingCreator";

export const dynamic = "force-dynamic";

export default async function NewListing({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const d = read();
  const templates: TemplateOption[] = d.listings
    .filter((l) => l.status === "active" || l.status === "sold" || l.status === "hidden")
    .sort((a, b) => (a.status === "active" ? -1 : 1) - (b.status === "active" ? -1 : 1))
    .map((l) => ({ id: l.id, title: l.title, brand: l.brand, size: l.size, condition: l.condition, photo_url: l.photo_url, status: l.status }));
  const drafts = [...d.listing_drafts].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-40);
  return (
    <>
      <PageHeader title="Neues Angebot" sub="Fotos rein, KI schreibt Titel, Beschreibung und Hashtags in deinem Stil, Resello lädt es auf Vinted hoch." />
      <ListingCreator drafts={drafts} templates={templates} initialId={id ?? drafts[drafts.length - 1]?.id} />
    </>
  );
}
