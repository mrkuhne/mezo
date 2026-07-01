// Reversible front-end feature flags for deferred / in-progress surfaces.
// These gate UI that exists but isn't wanted yet; flip to re-enable (no data loss —
// the backend columns/data stay intact, the flag only hides the FE surface).

/**
 * Pantry inventory / stock tracking (mezo-6nu). Deferred for now. When false, the Kamra
 * hides everything stock-related: the KamraCard 44px qty slot + "lejár"/"⚠ fogy", the
 * FuelKamraPage "Lejár"/"Fogy" stats + expiry banner, the KamraItemDetailPage "Készlet"
 * cell, and the AddPantryItemSheet stock input ("Készlet · ár" → "Ár"). Price is kept.
 * Backend `pantry_item` stock columns are untouched (mezo-dh6 partial-merge preserves
 * existing values), so flipping this back to true restores the data + UI.
 */
export const SHOW_PANTRY_STOCK = false
