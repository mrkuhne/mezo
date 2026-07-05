import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type {
  Ingredient, SupplementStashItem, PantryItemInput,
  PantryImport, PantrySuggestion, PantryLookupItem, PantryImportInput,
} from '@/data/types'
import type { PantrySourceKey } from '@/data/pantrySources'
import { localDateString, huMonthDay } from '@/shared/lib/dates'

type PantryResponse = components['schemas']['PantryResponse']
type PantryItemRequest = components['schemas']['PantryItemRequest']
type PantryImportRequest = components['schemas']['PantryImportRequest']
type PantryImportEntryResponse = components['schemas']['PantryImportEntryResponse']
type PantrySuggestionResponse = components['schemas']['PantrySuggestionResponse']
type PantryLookupResponse = components['schemas']['PantryLookupResponse']
type PantryLookupResult = components['schemas']['PantryLookupResult']

export interface PantryData {
  ingredients: Ingredient[]
  stash: SupplementStashItem[]
  imports: PantryImport[]
  suggestions: PantrySuggestion[]
}

function toRequest(input: PantryItemInput): PantryItemRequest {
  return {
    kind: input.kind, name: input.name, brand: input.brand, source: input.source,
    // category is a contract enum; the input carries a trusted string (form/inputFromItem).
    category: input.category as PantryItemRequest['category'], notes: input.notes, per: input.per, unit: input.unit,
    kcal: input.kcal, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG,
    fiberG: input.fiberG, sugarG: input.sugarG, saltG: input.saltG, saturatedFatG: input.saturatedFatG,
    price: input.price, priceUnit: input.priceUnit, pkg: input.pkg, micros: input.micros,
    nova: input.nova, stockQty: input.stockQty, stockUnit: input.stockUnit,
    stockExpires: input.stockExpires, dose: input.dose, form: input.form,
    protocol: input.protocol, timing: input.timing, caffeine: input.caffeine,
  } satisfies PantryItemRequest
}

function toImportRequest(input: PantryImportInput): PantryImportRequest {
  return {
    name: input.name, brand: input.brand, barcode: input.barcode,
    category: input.category as PantryImportRequest['category'],
    per: input.per, unit: input.unit,
    kcal: input.kcal, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG,
    fiberG: input.fiberG, sugarG: input.sugarG, saltG: input.saltG, saturatedFatG: input.saturatedFatG,
    nova: input.nova,
  } satisfies PantryImportRequest
}

/** ISO date-time → the feed's display string: today → 'ma · HH:MM', else 'Máj 2'. */
function humanizeWhen(iso: string): string {
  const day = iso.slice(0, 10)
  if (day === localDateString()) return `ma · ${new Date(iso).toTimeString().slice(0, 5)}`
  return huMonthDay(day)
}

function fromImportEntry(e: PantryImportEntryResponse): PantryImport {
  return {
    id: e.id,
    source: e.source as PantrySourceKey,
    when: humanizeWhen(e.when),
    items: e.items,
    status: e.status,
    ofWhat: e.ofWhat,
  }
}

function fromSuggestion(s: PantrySuggestionResponse): PantrySuggestion {
  return { name: s.name, source: s.source as PantrySourceKey, price: s.price, reason: s.reason }
}

function fromLookupResult(r: PantryLookupResult): PantryLookupItem {
  // nova is contract-bounded 1..4 — same structural cast the list read uses.
  return r as PantryLookupItem
}

export const pantryApi = {
  // The contract's IngredientResponse/SupplementStashResponse are structurally the domain
  // types except nova (number vs NovaGroup) — cast like sleepApi does. The P6 feed +
  // suggestion arrays get real mapping (when → display string).
  list: (): Promise<PantryData> =>
    apiFetch<PantryResponse>('/api/pantry').then(r => ({
      ingredients: r.ingredients as unknown as Ingredient[],
      stash: r.stash as unknown as SupplementStashItem[],
      // Contract-required, but lenient on read: many test overrides stub only
      // ingredients/stash and the UI treats absence as honest-empty anyway.
      imports: (r.imports ?? []).map(fromImportEntry),
      suggestions: (r.suggestions ?? []).map(fromSuggestion),
    })),
  create: (input: PantryItemInput): Promise<void> =>
    apiFetch('/api/pantry', { method: 'POST', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  update: (id: string, input: PantryItemInput): Promise<void> =>
    apiFetch(`/api/pantry/${id}`, { method: 'PUT', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  remove: (id: string): Promise<void> =>
    apiFetch(`/api/pantry/${id}`, { method: 'DELETE' }).then(() => undefined),
  // P6 (mezo-bka): OpenFoodFacts proxy lookup + confirmed-draft import.
  lookup: (q: string): Promise<PantryLookupItem[]> =>
    apiFetch<PantryLookupResponse>(`/api/pantry-import/lookup?q=${encodeURIComponent(q)}`)
      .then(r => r.results.map(fromLookupResult)),
  importItem: (input: PantryImportInput): Promise<void> =>
    apiFetch('/api/pantry-import', { method: 'POST', body: JSON.stringify(toImportRequest(input)) })
      .then(() => undefined),
}
