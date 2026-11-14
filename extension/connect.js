// Läuft auf dem Resello-Dashboard: meldet "Erweiterung installiert" und übernimmt die Verbindungsdaten per Klick.
(function () {
  const post = (data) => window.postMessage({ source: "resello-ext", ...data }, window.location.origin);

  async function report() {
    const s = await chrome.storage.local.get(["accountId", "username", "status", "statusOk"]);
    post({ installed: true, accountId: s.accountId || null, username: s.username || null, status: s.status || null, statusOk: s.statusOk ?? null });
  }

  window.addEventListener("message", async (e) => {
    if (e.source !== window || e.data?.source !== "resello-page") return;
    if (e.data.cmd === "ping") return report();
    if (e.data.cmd === "connect") {
      const { dashboardUrl, token, accountId, domain } = e.data.config;
      await chrome.storage.local.set({ dashboardUrl, token, accountId, domain, lastHello: 0, lastSync: 0, username: null, status: "Verbinde…", statusOk: true });
      report();
      chrome.runtime.sendMessage({ cmd: "tickNow", forceSync: true });
    }
  });

  chrome.storage.onChanged.addListener(report);
  report();
})();
