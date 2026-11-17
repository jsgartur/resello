"""
Resello Cloud-Worker
Hält eine eingeloggte Vinted-Sitzung in Camoufox (Firefox mit Fingerprint-Schutz) offen und arbeitet
die Jobs aus dem Dashboard ab. Nutzt dieselbe Kernlogik wie die Chrome-Erweiterung (../extension/vinted-core.js).

Start:  python worker.py
"""
import asyncio
import json
import os
import random
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from camoufox.async_api import AsyncCamoufox

load_dotenv()

DASHBOARD = os.environ["DASHBOARD_URL"].rstrip("/")
TOKEN = os.environ["EXTENSION_TOKEN"]
ACCOUNT_ID = os.environ["ACCOUNT_ID"]
DOMAIN = os.getenv("VINTED_DOMAIN", "vinted.de")
EMAIL = os.getenv("VINTED_EMAIL", "")
PASSWORD = os.getenv("VINTED_PASSWORD", "")
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"
PROFILE_DIR = os.getenv("PROFILE_DIR", "./profile")
SYNC_EVERY = 30 * 60
BASE = f"https://www.{DOMAIN}"

CORE_PATH = Path(__file__).resolve().parent.parent / "extension" / "vinted-core.js"
if not CORE_PATH.exists():
    CORE_PATH = Path(__file__).resolve().parent / "vinted-core.js"
CORE_JS = CORE_PATH.read_text(encoding="utf-8")


def log(msg: str):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def dashboard(path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        DASHBOARD + path,
        data=json.dumps(body or {}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read() or b"{}")


async def core(page, expression: str, arg=None):
    """Kernlogik in die Seite laden (nach Navigation geht sie verloren) und Funktion aufrufen."""
    await page.evaluate(CORE_JS)
    return await page.evaluate(expression, arg)


async def accept_cookies(page):
    for sel in ["#onetrust-accept-btn-handler", "button:has-text('Alle zulassen')", "button:has-text('Akzeptieren')"]:
        try:
            await page.click(sel, timeout=2500)
            return
        except Exception:
            pass


async def logged_in(page) -> bool:
    try:
        await core(page, "() => globalThis.__resello.getMe()")
        return True
    except Exception:
        return False


async def login(page):
    """Versucht den automatischen Login. Klappt das nicht (Captcha, 2FA, neues Layout),
    wird bei HEADLESS=false bis zu 5 Minuten auf manuellen Login gewartet."""
    if EMAIL and PASSWORD:
        try:
            await page.goto(f"{BASE}/member/signup/select_type?ref_url=%2F", wait_until="domcontentloaded")
            await accept_cookies(page)
            for text in ["Einloggen", "Anmelden", "Log in"]:
                try:
                    await page.click(f"text={text}", timeout=3000)
                    break
                except Exception:
                    pass
            for text in ["E-Mail", "email"]:
                try:
                    await page.click(f"text={text}", timeout=3000)
                    break
                except Exception:
                    pass
            await page.fill("input[name='username'], input[type='email'], #username", EMAIL, timeout=8000)
            await asyncio.sleep(random.uniform(0.6, 1.4))
            await page.fill("input[name='password'], input[type='password'], #password", PASSWORD, timeout=8000)
            await asyncio.sleep(random.uniform(0.6, 1.4))
            await page.click("button[type='submit']", timeout=8000)
            await page.wait_for_timeout(8000)
            await page.goto(BASE, wait_until="domcontentloaded")
            if await logged_in(page):
                log("Automatischer Login erfolgreich")
                return
        except Exception as e:
            log(f"Automatischer Login fehlgeschlagen: {e}")

    if HEADLESS:
        raise RuntimeError("Nicht eingeloggt. Einmal mit HEADLESS=false starten und manuell einloggen – das Profil wird gespeichert.")
    log("Bitte im geöffneten Fenster bei Vinted einloggen (max. 5 Minuten)…")
    for _ in range(60):
        await asyncio.sleep(5)
        if await logged_in(page):
            log("Login erkannt – Profil gespeichert")
            return
    raise RuntimeError("Kein Login innerhalb von 5 Minuten")


def load_photos(paths: list) -> list:
    import base64, urllib.parse
    out = []
    for p in paths:
        req = urllib.request.Request(f"{DASHBOARD}/api/ext/photo?path={urllib.parse.quote(p)}", headers={"Authorization": f"Bearer {TOKEN}"})
        with urllib.request.urlopen(req, timeout=60) as r:
            out.append({"b64": base64.b64encode(r.read()).decode(), "type": r.headers.get("Content-Type", "image/jpeg")})
    return out


def push_sync(data: dict) -> dict:
    data = {k: v for k, v in data.items() if k != "me"}
    return dashboard("/api/ext/sync", {"account_id": ACCOUNT_ID, **data})["stats"]


async def main():
    proxy = None
    if os.getenv("PROXY_SERVER"):
        proxy = {"server": os.environ["PROXY_SERVER"]}
        if os.getenv("PROXY_USERNAME"):
            proxy.update(username=os.environ["PROXY_USERNAME"], password=os.getenv("PROXY_PASSWORD", ""))

    async with AsyncCamoufox(
        headless=HEADLESS,
        proxy=proxy,
        geoip=bool(proxy),          # Zeitzone/Sprache passend zur Proxy-IP
        persistent_context=True,    # Cookies/Login bleiben zwischen Starts erhalten
        user_data_dir=PROFILE_DIR,
        locale="de-DE",
    ) as context:
        page = context.pages[0] if context.pages else await context.new_page()
        await page.goto(BASE, wait_until="domcontentloaded")
        await accept_cookies(page)
        if not await logged_in(page):
            await login(page)

        last_sync = 0.0
        last_hello = 0.0
        while True:
            try:
                if time.time() - last_hello > 3600:
                    me = await core(page, "() => globalThis.__resello.getMe()")
                    dashboard("/api/ext/hello", {"account_id": ACCOUNT_ID, "vinted_user_id": me["id"], "username": me["login"], "domain": DOMAIN})
                    log(f"Verbunden als @{me['login']}")
                    last_hello = time.time()

                if time.time() - last_sync > SYNC_EVERY:
                    stats = push_sync(await core(page, "() => globalThis.__resello.syncAll()"))
                    log(f"Sync: {stats}")
                    last_sync = time.time()

                job = dashboard("/api/ext/jobs/claim", {"executor": "cloud", "account_id": ACCOUNT_ID}).get("job")
                if job:
                    log(f"Job {job['type']} ({job['id'][:8]})")
                    try:
                        if job["type"] == "sync":
                            result = push_sync(await core(page, "() => globalThis.__resello.syncAll()"))
                            last_sync = time.time()
                        else:
                            if job["type"] == "create_listing":
                                job["payload"]["photo_data"] = load_photos(job["payload"].get("photo_paths", []))
                            result = await core(page, "job => globalThis.__resello.runJob(job)", job)
                        dashboard(f"/api/ext/jobs/{job['id']}", {"status": "done", "result": result})
                        log("  → erledigt")
                    except Exception as e:
                        dashboard(f"/api/ext/jobs/{job['id']}", {"status": "failed", "error": str(e)[:500]})
                        log(f"  → Fehler: {e}")
                        if "401" in str(e) or "Nicht bei Vinted eingeloggt" in str(e):
                            await page.goto(BASE, wait_until="domcontentloaded")
                            if not await logged_in(page):
                                await login(page)

                # Seite gelegentlich neu laden (frisches CSRF-Token, wirkt menschlicher)
                if random.random() < 0.1:
                    await page.goto(BASE, wait_until="domcontentloaded")
            except Exception as e:
                log(f"Fehler in der Schleife: {e}")
            await asyncio.sleep(random.uniform(45, 90))


if __name__ == "__main__":
    asyncio.run(main())
