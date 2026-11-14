# Resello – dein eigenes Vinted-Cockpit

Eigenes All-in-One-Tool für Vinted (ähnlich Vintz), nur für dich:

- **Übersicht**: Umsatz, Bestellungen, Länder, offene Aktionen
- **Angebote**: alle Artikel, Mindest- und Einkaufspreis, Preis ändern, neu einstellen
- **Postfach**: alle Chats, KI-Antwortentwürfe und Gegenangebote, die du freigibst
- **Automationen**: Auto-Relisting (Zeitfenster, Tageslimit), Preissenkung (nie unter Mindestpreis), Gegenangebote, KI-Antworten, Favoriten anschreiben
- **Finanzen**: Gewinn, Kosten, CSV-Export
- **Bildstudio**: Try-on (Kleidung aufs Model), Hintergrund, Flatlay, Aufbessern, eigener Prompt (Google Gemini) + Galerie
- **Vinted-Login auf zwei Wegen**: Chrome-Erweiterung (nutzt deinen eingeloggten Browser) oder Cloud-Worker (Camoufox, läuft 24/7)

```
vinted-cockpit/
├── web/        Dashboard (Next.js) – alle Daten in web/data/resello.json, Bilder in web/data/bilder/
├── extension/  Chrome-Erweiterung „Resello Connect“ + vinted-core.js (gemeinsame Vinted-Logik)
└── worker/     Python-Cloud-Worker (Camoufox), nutzt dieselbe vinted-core.js
```

## ⚠️ Vorab wichtig

- Vinted hat **keine offizielle API**. Das Tool nutzt die internen Endpunkte der Vinted-Webseite. Das verstößt gegen die Vinted-Nutzungsbedingungen und kann zur **Sperrung deines Kontos** führen – das gilt für Vintz genauso. Starte vorsichtig (wenige Aktionen pro Tag) und nutze lieber die Chrome-Erweiterung als den Cloud-Login.
- Die Endpunkte in `extension/vinted-core.js` habe ich aus der Vinted-Weboberfläche abgeleitet, **konnte sie aber nicht live gegen Vinted testen**. Wenn etwas nicht klappt: Vinted öffnen → F12 → Tab „Network“ → Aktion manuell ausführen → URL/Body vergleichen und in `vinted-core.js` anpassen. Felder, die beim Sync leer bleiben, passt du in `web/src/lib/vinted-normalize.ts` an.
- Nachrichten werden **nie ohne deine Freigabe** gesendet. Preissenkung und Gegenangebote gelten nur für Artikel mit Mindestpreis und gehen nie darunter.

## 0. Auf dem Server (empfohlen)

Wie beim LifeDashboard: Docker + Tailscale, Updates kommen automatisch alle 10 Minuten von GitHub.
Danach erreichbar unter `https://resello.<dein-tailnet>.ts.net` (PC/Handy mit Tailscale).

Einmalig auf dem Server (als root):

```bash
# 1) Deploy-Key erzeugen und anzeigen
ssh-keygen -t ed25519 -N '' -C resello-server -f /root/.ssh/resello-deploy && cat /root/.ssh/resello-deploy.pub
# → Ausgabe kopieren: GitHub → Repo resello → Settings → Deploy keys → Add deploy key → einfügen → Add

# 2) Herunterladen und einrichten
GIT_SSH_COMMAND="ssh -i /root/.ssh/resello-deploy -o StrictHostKeyChecking=accept-new" \
  git clone git@github.com:jsgartur/resello.git /opt/resello
bash /opt/resello/scripts/server/einrichten.sh
```

Das Skript fragt nach einem Tailscale-Auth-Key (Tailscale → Settings → Keys → „Generate auth key“), deinem Gemini-Key und einem Passwort. Daten liegen in `/opt/resello/data/`.

## 1. Dashboard starten (Windows)

1. **Node.js** (LTS) von https://nodejs.org installieren.
2. Im Ordner `web` doppelt auf **`start.bat`** klicken. Beim ersten Mal öffnet sich die Datei `.env`:
   - `APP_PASSWORD` = dein Login-Passwort
   - `EXTENSION_TOKEN` = beliebiger langer Text (brauchst du später für Erweiterung/Worker)
   - `GEMINI_API_KEY` = Key von https://aistudio.google.com/apikey
3. Speichern, Editor schließen, `start.bat` nochmal doppelklicken. Beim ersten Start wird alles installiert (1–2 Min.), danach öffnet sich http://localhost:3010.

Fenster offen lassen, solange du das Dashboard nutzt – Automationen laufen alle 15 Minuten, solange es läuft. Beenden: Fenster schließen.

**Daten & Backup:** Alles steht in `web/data/resello.json`, die Bilder in `web/data/bilder/`. Backup = Ordner `data` kopieren.

Ohne Windows: im Ordner `web` → `cp .env.example .env` (ausfüllen) → `npm install` → `npm run dev`.

## 3a. Vinted per Chrome-Erweiterung verbinden (empfohlen)

Im Dashboard links auf **Vinted-Konten** gehen und den drei Schritten folgen:

1. **Erweiterung installieren:** In Chrome `chrome://extensions` öffnen, oben rechts **Entwicklermodus** an, **Entpackte Erweiterung laden**, Ordner `vinted-cockpit\extension` wählen. Dashboard-Seite neu laden, dann erscheint ein grüner Haken.
2. **Bei Vinted einloggen:** www.vinted.de in einem Tab öffnen und einloggen. Den Tab offen lassen.
3. Auf **Jetzt verbinden** klicken. Fertig – deine Artikel, Chats und Verkäufe werden geladen.

Danach synchronisiert die Erweiterung alle 30 Minuten und führt Aufgaben (Antworten senden, Preise ändern, neu einstellen) nacheinander aus, solange Chrome mit einem Vinted-Tab offen ist.

## 3b. Vinted per Cloud-Worker verbinden (24/7)

Läuft auf deinem PC neben dem Dashboard (`DASHBOARD_URL=http://localhost:3010`). Nutze einen festen deutschen Proxy pro Konto.

```bash
cd worker
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m camoufox fetch                               # lädt den Browser
cp .env.example .env                                   # Konto-ID, Token, Proxy, Zugangsdaten eintragen
python worker.py
```

Beim ersten Start `HEADLESS=false` lassen: Falls der automatische Login an Captcha oder 2FA scheitert, loggst du dich im Fenster selbst ein. Das Profil wird in `worker/profile` gespeichert, danach kannst du `HEADLESS=true` setzen. Die Login-Selektoren kannst du bei Bedarf mit denen aus deinem bestehenden Camoufox-Relisting-Bot ersetzen.

Der Worker braucht den Ordner `extension` daneben (er lädt `extension/vinted-core.js`). Alternativ die Datei in den `worker`-Ordner kopieren.

## So hängt alles zusammen

```
Dashboard (Next.js + Datei resello.json)
  ├─ Automationen ──► erzeugen Jobs (relist, price_change, send_message) und KI-Entwürfe
  ├─ /api/ext/claim ◄── Erweiterung / Worker holen Jobs ab
  ├─ /api/ext/sync  ◄── rohe Vinted-Daten (Artikel, Chats, Verkäufe, Favoriten)
  └─ /api/ext/jobs/:id ◄── Ergebnis melden → Datenbank wird aktualisiert
```

## Nächste Ausbaustufen

- Anzeigen per KI aus Fotos erstellen (Titel, Beschreibung, Kategorie, Preisvorschlag)
- Bulk-Bildstudio (mehrere Artikel auf einmal)
- Vorgefertigte Model-Galerie (nur mit eigenen/lizenzierten Fotos)
- Versandetiketten-Übersicht, Kaufzeiten-Analyse
- Später als SaaS: echte Datenbank, Nutzerkonten, Stripe-Credits
