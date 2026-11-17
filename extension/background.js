// Resello Connect – Hintergrund-Skript (Service Worker)
// Jede Minute: Vinted-Tab suchen → ggf. synchronisieren → nächsten Job abholen und ausführen.

const SYNC_EVERY_MIN = 30;
const TICK_MIN = 1;

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("tick", { periodInMinutes: TICK_MIN }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create("tick", { periodInMinutes: TICK_MIN }));
chrome.alarms.onAlarm.addListener((a) => a.name === "tick" && tick());
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.cmd === "tickNow") { tick({ forceSync: !!msg.forceSync }).then(() => sendResponse({ ok: true })); return true; }
});

let running = false;

async function settings() {
  return chrome.storage.local.get(["dashboardUrl", "token", "accountId", "domain", "lastSync", "lastHello"]);
}

async function setStatus(text, ok = true) {
  await chrome.storage.local.set({ status: text, statusOk: ok, statusAt: Date.now() });
  chrome.action.setBadgeText({ text: ok ? "" : "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
}

async function dashboard(s, path, body) {
  const res = await fetch(s.dashboardUrl.replace(/\/$/, "") + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.token}` },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Dashboard ${res.status}: ${json.error || res.statusText}`);
  return json;
}

async function findVintedTab(domain) {
  const tabs = await chrome.tabs.query({ url: `https://www.${domain}/*` });
  return tabs.find((t) => t.status === "complete") || tabs[0] || null;
}

async function toTab(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // Tab war schon offen, bevor die Erweiterung installiert wurde → Skripte nachladen
    await chrome.scripting.executeScript({ target: { tabId }, files: ["vinted-core.js", "content.js"] });
    return await chrome.tabs.sendMessage(tabId, msg);
  }
}

async function inTab(tabId, msg) {
  const r = await toTab(tabId, msg);
  if (!r?.ok) throw new Error(r?.error || "Keine Antwort vom Vinted-Tab");
  return r.data;
}

// Fotos für neue Angebote vom Dashboard holen (Base64, damit sie in den Vinted-Tab übergeben werden können)
async function loadPhotos(s, paths) {
  const out = [];
  for (const p of paths) {
    const res = await fetch(s.dashboardUrl.replace(/\/$/, "") + "/api/ext/photo?path=" + encodeURIComponent(p), { headers: { Authorization: `Bearer ${s.token}` } });
    if (!res.ok) throw new Error(`Foto vom Dashboard laden: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    out.push({ b64: btoa(bin), type: res.headers.get("content-type") || "image/jpeg" });
  }
  return out;
}

async function pushSync(s, data) {
  const { me, ...rest } = data;
  const r = await dashboard(s, "/api/ext/sync", { account_id: s.accountId, ...rest });
  await chrome.storage.local.set({ lastSync: Date.now() });
  return r.stats;
}

async function tick({ forceSync = false } = {}) {
  if (running) return;
  running = true;
  try {
    const s = await settings();
    if (!s.dashboardUrl || !s.token || !s.accountId) return setStatus("Bitte im Popup einrichten", false);
    const domain = s.domain || "vinted.de";
    const tab = await findVintedTab(domain);
    if (!tab) return setStatus(`Kein ${domain}-Tab offen – bitte Vinted öffnen und eingeloggt bleiben`, false);

    // Verbindung melden (stündlich)
    if (!s.lastHello || Date.now() - s.lastHello > 3600000) {
      const me = await inTab(tab.id, { cmd: "me" });
      await dashboard(s, "/api/ext/hello", { account_id: s.accountId, vinted_user_id: me.id, username: me.login, domain });
      await chrome.storage.local.set({ lastHello: Date.now(), username: me.login });
    }

    // Regelmäßiger Sync
    if (forceSync || !s.lastSync || Date.now() - s.lastSync > SYNC_EVERY_MIN * 60000) {
      await setStatus("Synchronisiere…");
      const data = await inTab(tab.id, { cmd: "sync" });
      const stats = await pushSync(s, data);
      if (data.errors?.length) await setStatus(`Sync teilweise: ${stats.items} Artikel, ${stats.conversations} Chats – Fehler: ${data.errors.join(" | ")}`, false);
      else await setStatus(`Sync ok: ${stats.items} Artikel, ${stats.conversations} Chats`);
    }

    // Einen Job pro Minute (schont das Konto)
    const { job } = await dashboard(s, "/api/ext/jobs/claim", { executor: "extension", account_id: s.accountId });
    if (!job) return setStatus(`Verbunden · ${new Date().toLocaleTimeString("de-DE")}`);
    try {
      await setStatus(`Führe aus: ${job.type}…`);
      if (job.type === "sync") {
        const stats = await pushSync(s, await inTab(tab.id, { cmd: "sync" }));
        await dashboard(s, `/api/ext/jobs/${job.id}`, { status: "done", result: stats });
      } else {
        if (job.type === "create_listing") job.payload.photo_data = await loadPhotos(s, job.payload.photo_paths || []);
        const result = await inTab(tab.id, { cmd: "job", job });
        await dashboard(s, `/api/ext/jobs/${job.id}`, { status: "done", result });
      }
      await setStatus(`Erledigt: ${job.type}`);
    } catch (e) {
      await dashboard(s, `/api/ext/jobs/${job.id}`, { status: "failed", error: String(e.message || e) }).catch(() => {});
      await setStatus(`Fehler bei ${job.type}: ${e.message}`, false);
    }
  } catch (e) {
    const msg = String(e.message || e);
    await setStatus(msg, false);
    // Fehler auch im Dashboard anzeigen
    const st = await settings();
    if (st.dashboardUrl && st.token && st.accountId) {
      await dashboard(st, "/api/ext/sync", { account_id: st.accountId, errors: [msg] }).catch(() => {});
    }
  } finally {
    running = false;
  }
}
