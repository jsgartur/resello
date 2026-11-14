import { PageHeader } from "@/components/ui";
import { Studio } from "@/components/Studio";

export default function StudioPage() {
  return (
    <>
      <PageHeader title="Bildstudio" sub="KI-Produktfotos mit Google Gemini. Ergebnisse landen automatisch in der Galerie." />
      <Studio />
    </>
  );
}
