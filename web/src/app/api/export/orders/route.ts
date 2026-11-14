import { read } from "@/lib/store";

export async function GET() {
  const d = read();
  const rows = [["Datum", "Artikel", "Käufer", "Land", "Preis", "Versand", "Status", "Einkaufspreis"]];
  for (const o of [...d.orders].sort((a, b) => String(a.sold_at).localeCompare(String(b.sold_at)))) {
    const purchase = d.listings.find((l) => l.id === o.listing_id)?.purchase_price;
    rows.push([o.sold_at ?? "", o.title ?? "", o.buyer ?? "", o.country ?? "", String(o.price ?? ""), String(o.shipping_fee ?? ""), o.status ?? "", String(purchase ?? "")]);
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=verkaeufe.csv" } });
}
