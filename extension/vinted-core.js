/*
 * Resello – Vinted-Kernlogik
 * Läuft IM Kontext einer eingeloggten Vinted-Seite (Chrome-Erweiterung: Content-Script, Cloud-Worker: page.evaluate).
 * Dadurch werden Vinted-Cookies automatisch mitgeschickt – kein Passwort nötig.
 *
 * WICHTIG: Vinted hat keine offizielle API. Die Endpunkte unten stammen aus der Vinted-Weboberfläche und können
 * sich ändern. Wenn etwas nicht mehr geht: Vinted öffnen → F12 → Network → Aktion manuell ausführen → Request vergleichen.
 */
(function () {
  if (globalThis.__resello) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jitter = (min = 1500, max = 4500) => sleep(min + Math.random() * (max - min));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  function cookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta?.content) return meta.content;
    const m = document.documentElement.innerHTML.match(/"CSRF_TOKEN\\?":\\?"([^"\\]+)/);
    return m ? m[1] : null;
  }

  async function api(method, path, body, { form = false } = {}) {
    const headers = { Accept: "application/json, text/plain, */*" };
    const csrf = csrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
    const anon = cookie("anon_id");
    if (anon) headers["X-Anon-Id"] = anon;
    if (body && !form) headers["Content-Type"] = "application/json";
    const res = await fetch(path, {
      method,
      headers,
      credentials: "include",
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* HTML statt JSON */ }
    if (!res.ok) {
      const fieldErrors = Array.isArray(json?.errors) ? json.errors.map((e) => `${e.field ?? "?"}: ${e.value ?? e.message ?? JSON.stringify(e)}`).join("; ") : "";
      const msg = [json?.message || json?.error || json?.message_code, fieldErrors].filter(Boolean).join(" – ") || text.slice(0, 200);
      const err = new Error(`Vinted ${res.status} bei ${method} ${path}: ${msg}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  // ---------- Konto ----------
  async function getMe() {
    try {
      const r = await api("GET", "/api/v2/users/current");
      if (r?.user?.id) return { id: r.user.id, login: r.user.login };
    } catch { /* Fallback unten */ }
    const id = cookie("v_uid");
    if (!id) throw new Error("Nicht bei Vinted eingeloggt (kein v_uid-Cookie gefunden)");
    const r = await api("GET", `/api/v2/users/${id}`);
    return { id: Number(id), login: r?.user?.login ?? null };
  }

  // ---------- Sync ----------
  async function wardrobe(userId) {
    const items = [];
    let complete = false;
    for (let page = 1; page <= 30; page++) {
      let r;
      try {
        r = await api("GET", `/api/v2/wardrobe/${userId}/items?page=${page}&per_page=96&order=relevance`);
      } catch (e) {
        if (page === 1 && e.status === 404) r = await api("GET", `/api/v2/users/${userId}/items?page=${page}&per_page=96`);
        else throw e;
      }
      const batch = r?.items ?? [];
      items.push(...batch);
      const total = r?.pagination?.total_pages ?? 1;
      if (page >= total || !batch.length) { complete = true; break; }
      await jitter(800, 2000);
    }
    return { items, complete };
  }

  async function inbox(maxConversations = 30) {
    const r = await api("GET", "/api/v2/inbox?page=1&per_page=20");
    const list = (r?.conversations ?? []).slice(0, maxConversations);
    const out = [];
    for (const c of list) {
      try {
        const d = await api("GET", `/api/v2/conversations/${c.id}`);
        out.push({ ...(d?.conversation ?? d), unread: c.unread });
      } catch (e) { if (!out.length && c === list[list.length - 1]) throw e; }
      await jitter(600, 1500);
    }
    return out;
  }

  async function soldOrders() {
    // Mehrere Varianten probieren – Vinted ändert das gelegentlich
    const variants = [
      (p) => `/api/v2/my_orders?type=sold&status=all&per_page=50&page=${p}`,
      (p) => `/api/v2/my_orders?type=sold&per_page=50&page=${p}`,
      (p) => `/api/v2/my_orders?type=sold&status=completed&per_page=50&page=${p}`,
    ];
    let lastError = null;
    for (const v of variants) {
      try {
        const all = [];
        for (let page = 1; page <= 10; page++) {
          const r = await api("GET", v(page));
          const batch = r?.my_orders ?? r?.orders ?? r?.transactions ?? [];
          all.push(...batch);
          const total = r?.pagination?.total_pages ?? 1;
          if (!batch.length || page >= total) break;
          await jitter(600, 1400);
        }
        if (all.length) return all;
      } catch (e) { lastError = e; }
    }
    if (lastError) throw lastError;
    return [];
  }

  async function notifications() {
    const r = await api("GET", "/api/v2/notifications?page=1&per_page=40");
    return r?.notifications ?? [];
  }

  async function syncAll() {
    const me = await getMe();
    const errors = [];
    const step = async (name, fn, fallback) => {
      try { return await fn(); }
      catch (e) { errors.push(`${name}: ${e.message || e}`); return fallback; }
    };
    const w = await step("Artikel", () => wardrobe(me.id), { items: [], complete: false });
    await jitter();
    const conversations = await step("Nachrichten", () => inbox(), []);
    await jitter();
    const orders = await step("Verkäufe", () => soldOrders(), []);
    const notifs = await step("Benachrichtigungen", () => notifications(), []);
    return { me, items: w.items, items_complete: w.complete, conversations, orders, notifications: notifs, errors };
  }

  // ---------- Aktionen ----------
  async function sendMessage({ vinted_conversation_id, vinted_item_id, user_id, body }) {
    let convId = vinted_conversation_id;
    if (!convId) {
      // Neuer Chat (z.B. an jemanden, der den Artikel favorisiert hat)
      const r = await api("POST", "/api/v2/conversations", { initiator: "seller_enters_notification", item_id: vinted_item_id, opposite_user_id: user_id });
      convId = r?.conversation?.id;
      if (!convId) throw new Error("Konnte keinen Chat anlegen");
    }
    await api("POST", `/api/v2/conversations/${convId}/replies`, {
      reply: { body, photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false },
    });
    return { conversation_id: convId };
  }

  async function getEditableItem(itemId) {
    const r = await api("GET", `/api/v2/item_upload/items/${itemId}`);
    if (!r?.item) throw new Error("Artikel-Daten zum Bearbeiten nicht gefunden");
    return r.item;
  }

  // Baut die Artikeldaten so auf, wie das Vinted-Upload-Formular sie sendet
  function uploadPayload(it, { id, photoIds, price }) {
    const amount = (v) => (v && typeof v === "object" ? Number(v.amount) : Number(v));
    const colors = Array.isArray(it.color_ids) && it.color_ids.length ? it.color_ids : [it.color1_id, it.color2_id].filter(Boolean);
    const photos = photoIds ?? (it.photos ?? []).map((p) => p.id);
    return {
      id: id ?? null,
      currency: it.currency || it.price?.currency_code || "EUR",
      temp_uuid: uuid(),
      title: it.title,
      description: it.description ?? "",
      brand_id: it.brand_id ?? it.brand_dto?.id ?? null,
      brand: it.brand ?? it.brand_title ?? it.brand_dto?.title ?? null,
      size_id: it.size_id ?? null,
      catalog_id: it.catalog_id,
      isbn: it.isbn ?? null,
      is_unisex: !!it.is_unisex,
      status_id: it.status_id,
      video_game_rating_id: it.video_game_rating_id ?? null,
      price: price != null ? Number(price) : amount(it.price),
      package_size_id: it.package_size_id,
      shipment_prices: { domestic: null, international: null },
      color_ids: colors,
      assigned_photos: photos.map((pid) => ({ id: pid, orientation: 0 })),
      measurement_length: it.measurement_length ?? null,
      measurement_width: it.measurement_width ?? null,
      item_attributes: it.item_attributes ?? [],
      manufacturer: it.manufacturer ?? null,
      manufacturer_labelling: it.manufacturer_labelling ?? null,
    };
  }

  async function step(name, fn) {
    try { return await fn(); } catch (e) { throw new Error(`${name}: ${e.message || e}`); }
  }

  async function changePrice({ vinted_item_id, price }) {
    const item = await step("Artikeldaten laden", () => getEditableItem(vinted_item_id));
    await jitter();
    await step("Preis speichern", () => api("PUT", `/api/v2/item_upload/items/${vinted_item_id}`, {
      item: uploadPayload(item, { id: Number(vinted_item_id), price }), feedback_id: null, parcel: null, upload_session_id: uuid(),
    }));
    return { price };
  }

  async function uploadPhotoFromUrl(url) {
    const blob = await (await fetch(url)).blob();
    const fd = new FormData();
    const tempUuid = uuid();
    fd.append("photo[type]", "item");
    fd.append("photo[file]", blob, "photo.jpg");
    fd.append("photo[temp_uuid]", tempUuid);
    const r = await api("POST", "/api/v2/photos", fd, { form: true });
    return r?.id ?? r?.photo?.id;
  }

  /** Sicheres Neueinstellen: neuer Artikel wird erst erstellt, der alte erst danach gelöscht. */
  async function relist({ vinted_item_id }) {
    const item = await step("Artikeldaten laden", () => getEditableItem(vinted_item_id));
    const photos = item.photos ?? [];
    if (!photos.length) throw new Error("Artikel hat keine Fotos");

    const photoIds = [];
    for (const [i, p] of photos.entries()) {
      const url = p.full_size_url || p.url;
      const pid = await step(`Foto ${i + 1} hochladen`, () => uploadPhotoFromUrl(url));
      if (!pid) throw new Error(`Foto ${i + 1} hochladen: keine Foto-ID erhalten`);
      photoIds.push(pid);
      await jitter(1000, 2500);
    }

    const created = await step("Neuen Artikel anlegen", () => api("POST", "/api/v2/item_upload/items", {
      item: uploadPayload(item, { id: null, photoIds }), feedback_id: null, parcel: null, upload_session_id: uuid(),
    }));
    const newId = created?.item?.id;
    if (!newId) throw new Error("Neuer Artikel wurde nicht erstellt – alter bleibt online");

    await jitter(3000, 6000);
    await step("Alten Artikel löschen (neuer ist schon online)", () => api("POST", `/api/v2/items/${vinted_item_id}/delete`));
    return { new_item_id: newId, new_url: created?.item?.url ?? null };
  }

  async function deleteItem({ vinted_item_id }) {
    await api("POST", `/api/v2/items/${vinted_item_id}/delete`);
    return {};
  }

  async function runJob(job) {
    const p = job.payload || {};
    switch (job.type) {
      case "sync": return { sync: await syncAll() };
      case "send_message": return await sendMessage(p);
      case "price_change": return await changePrice(p);
      case "relist": return await relist(p);
      case "delete_item": return await deleteItem(p);
      default: throw new Error("Unbekannter Job-Typ: " + job.type);
    }
  }

  globalThis.__resello = { api, getMe, syncAll, runJob };
})();
