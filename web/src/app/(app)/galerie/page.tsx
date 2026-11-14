/* eslint-disable @next/next/no-img-element */
import { read, imageUrl } from "@/lib/store";
import { dateTime } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui";
import { deleteStudioImage } from "@/app/actions";

export default function Gallery() {
  const images = [...read().studio_images].reverse().slice(0, 200).map((i) => ({ ...i, url: imageUrl(i.output_path) }));

  return (
    <>
      <PageHeader title="Galerie" sub="Alle im Bildstudio erstellten Bilder." />
      {!images.length ? <Empty title="Noch keine Bilder">Erstelle dein erstes Bild im Bildstudio.</Empty> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.map((i) => (
            <div key={i.id} className="card overflow-hidden">
              {i.url && <a href={i.url} target="_blank"><img src={i.url} alt="" className="aspect-[4/5] w-full object-cover" /></a>}
              <div className="flex items-center justify-between p-2 text-xs text-muted">
                <span>{i.tool} · {dateTime(i.created_at)}</span>
                <span className="flex gap-2">
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
