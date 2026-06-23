import { apiFetch } from './api'
import type { components } from './api.gen'
import type { Ingredient, SupplementStashItem, PantryItemInput } from '@/data/types'

type PantryResponse = components['schemas']['PantryResponse']
type PantryItemRequest = components['schemas']['PantryItemRequest']

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

export const pantryApi = {
  // The contract's IngredientResponse/SupplementStashResponse are structurally the domain
  // types except nova (number vs NovaGroup) — cast like sleepApi does.
  list: (): Promise<{ ingredients: Ingredient[]; stash: SupplementStashItem[] }> =>
    apiFetch<PantryResponse>('/api/pantry') as Promise<{ ingredients: Ingredient[]; stash: SupplementStashItem[] }>,
  create: (input: PantryItemInput): Promise<void> =>
    apiFetch('/api/pantry', { method: 'POST', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  update: (id: string, input: PantryItemInput): Promise<void> =>
    apiFetch(`/api/pantry/${id}`, { method: 'PUT', body: JSON.stringify(toRequest(input)) }).then(() => undefined),
  remove: (id: string): Promise<void> =>
    apiFetch(`/api/pantry/${id}`, { method: 'DELETE' }).then(() => undefined),
}
