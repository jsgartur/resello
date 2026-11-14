// Brücke zwischen Hintergrund-Skript und Vinted-Seite
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const r = globalThis.__resello;
  if (!r) { sendResponse({ ok: false, error: "Resello-Kern nicht geladen" }); return; }
  const run =
    msg.cmd === "me" ? r.getMe() :
    msg.cmd === "sync" ? r.syncAll() :
    msg.cmd === "job" ? r.runJob(msg.job) :
    Promise.reject(new Error("Unbekannter Befehl"));
  run.then((data) => sendResponse({ ok: true, data }))
     .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true; // asynchrone Antwort
});
