// Resello Service Worker – macht die App installierbar.
// Bewusst kein Caching: Daten sollen immer frisch vom Server kommen.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
