const fields = ["dashboardUrl", "token", "accountId", "domain"];
const $ = (id) => document.getElementById(id);

async function render() {
  const s = await chrome.storage.local.get([...fields, "status", "statusOk", "statusAt", "username"]);
  fields.forEach((f) => s[f] && ($(f).value = s[f]));
  $("user").textContent = s.username ? `Verbunden als @${s.username}` : "Nicht verbunden";
  $("status").textContent = s.status ? `${s.status}${s.statusAt ? " · " + new Date(s.statusAt).toLocaleTimeString("de-DE") : ""}` : "–";
  $("status").className = s.statusOk === false ? "err" : s.statusOk ? "ok" : "";
}

$("save").onclick = async () => {
  const values = Object.fromEntries(fields.map((f) => [f, $(f).value.trim()]));
  // Zugriff auf die Dashboard-Adresse erlauben (nötig für eigene Domain/localhost)
  try {
    const origin = new URL(values.dashboardUrl).origin + "/*";
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) { $("status").textContent = "Zugriff auf Dashboard-URL wurde nicht erlaubt"; return; }
  } catch { $("status").textContent = "Ungültige Dashboard-URL"; return; }
  await chrome.storage.local.set({ ...values, lastHello: 0, lastSync: 0 });
  $("status").textContent = "Verbinde…";
  await chrome.runtime.sendMessage({ cmd: "tickNow", forceSync: true });
  render();
};

$("sync").onclick = async () => {
  $("status").textContent = "Synchronisiere…";
  await chrome.runtime.sendMessage({ cmd: "tickNow", forceSync: true });
  render();
};

chrome.storage.onChanged.addListener(render);
render();
