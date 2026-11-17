"use client";
import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Zeigt "App installieren", solange Resello nicht als App läuft. */
export function InstallButton() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    const onInstalled = () => { setEvt(null); setStandalone(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (standalone) return null;

  async function install() {
    if (evt) { await evt.prompt(); await evt.userChoice; setEvt(null); }
    else setHelp(true);
  }

  return (
    <>
      <button onClick={install} className="btn-ghost h-8 whitespace-nowrap px-3 text-xs"><Download size={14} /><span className="hidden sm:inline">App installieren</span><span className="sm:hidden">App</span></button>
      {help && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={() => setHelp(false)}>
          <div className="card w-full max-w-sm p-5 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><b>Resello als App installieren</b><button onClick={() => setHelp(false)}><X size={18} /></button></div>
            {ios ? (
              <ol className="list-decimal space-y-2 pl-5 text-muted">
                <li>Diese Seite in <b className="text-white">Safari</b> öffnen.</li>
                <li>Unten auf <b className="text-white">Teilen</b> <Share size={13} className="inline" /> tippen.</li>
                <li><b className="text-white">Zum Home-Bildschirm</b> wählen.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-muted">
                <li>In Chrome oben rechts auf <b className="text-white">⋮</b> klicken.</li>
                <li><b className="text-white">Streamen, speichern und teilen</b> → <b className="text-white">Seite als App installieren</b> (oder „Resello installieren“).</li>
                <li>Danach findest du Resello im Startmenü und kannst es an die Taskleiste anheften.</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
