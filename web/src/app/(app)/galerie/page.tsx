/* eslint-disable @next/next/no-img-element */
import { read, imageUrl } from "@/lib/store";
import { dateTime } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import { deleteStudioImage } from "@/app/actions";
import { GalleryToDraft } from "@/components/GalleryToDraft";

export const dynamic = "force-dynamic";

export default function Gallery() {
  const d = read();
  const drafts = [...d.listing_drafts].reverse().filter((x) => x.status === "draft" || x.status === "failed").slice(0, 30)
    .map((x) => ({ id: x.id, label: [x.art, x.title || "Entwurf ohne Titel"].filter(Boolean).join(" · ").slice(0, 60) }));
  const images = [...d.studio_images].reverse().slice(0, 200).map((i) => ({ ...i, url: imageUrl(i.output_path) }));

  return (
    <>
      <PageHeader title="Galerie" sub="Alle im Bildstudio erstellten Bilder – mit einem Klick zu einem Angebot hinzufügen." />
      {!images.length ? <Empty title="Noch keine Bilder">Erstelle dein erstes Bild im Bildstudio.</Empty> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.map((i) => (
            <div key={i.id} className="card relative overflow-hidden">
              {i.url && <a href={i.url} target="_blank"><img src={i.url} alt="" className="aspect-[4/5] w-full object-cover" /></a>}
              <div className="flex items-center justify-between p-2 text-xs text-muted">
                <span>{i.tool} · {dateTime(i.created_at)}</span>
                <span className="flex items-center gap-2">
                  <GalleryToDraft imageId={i.id} drafts={drafts} />
                  {i.url && <a href={i.url} download className="hover:text-white">↓</a>}
                  <form action={deleteStudioImage.bind(null, i.id)}><button className="hover:text-red-400">✕</button></form>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
