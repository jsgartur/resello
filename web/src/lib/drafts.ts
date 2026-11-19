import { id, now, ListingDraft } from "@/lib/store";

export function blankDraft(photos: string[], art: string | null = null): ListingDraft {
  return {
    id: id(), art, photos, title: "", description: "", hashtags: [], brand: null, size: null, condition: null, colors: [], category: null,
    price: null, price_low: null, price_high: null, unsure: [], template_listing_id: null, account_id: null,
    status: "draft", vinted_item_id: null, vinted_url: null, error: null, created_at: now(), updated_at: now(),
  };
}

