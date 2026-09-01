// ============================================================
// Mezo · Recept-műhely wire boundary (mezo-92pb)
// The one module that knows the WorkshopTurnRequest/Response wire shape — domain↔wire mapping
// for the AI recipe-workshop chat turn. Mirrors recipeApi.ts's toRequest/fromResponse split:
// pure mapping functions + a thin `workshopApi` object, so workshopState.ts stays network-free
// and independently testable.
// ============================================================
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { RecipeCategory, WorkshopDraft, WorkshopGoal, WorkshopLine, WorkshopTurn } from '@/data/types'

type WireDraft = components['schemas']['WorkshopDraft']
type WireDraftLine = components['schemas']['WorkshopDraftLine']
type WorkshopTurnRequest = components['schemas']['WorkshopTurnRequest']
type WorkshopTurnResponse = components['schemas']['WorkshopTurnResponse']
type WorkshopChatMessage = components['schemas']['WorkshopChatMessage']

/** Domain line → wire line. Macros are NEVER carried on the wire for a pantry line — the
 *  backend (and this FE) always resolve those live against the pantry; an estimate line's
 *  `est` totals are the line's only macro source, so they go out as its wire kcal/proteinG/etc. */
function lineToWire(l: WorkshopLine): WireDraftLine {
  if (l.source === 'pantry') {
    return {
      source: 'pantry',
      pantryItemId: l.refId,
      name: l.name,
      amount: l.amount,
      unit: l.unit,
      kcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    }
  }
  return {
    source: 'estimate',
    pantryItemId: null,
    name: l.name,
    amount: l.amount,
    unit: l.unit,
    kcal: l.est?.kcal ?? null,
    proteinG: l.est?.p ?? null,
    carbsG: l.est?.c ?? null,
    fatG: l.est?.f ?? null,
  }
}

/** Wire line → domain line — the reverse of `lineToWire`. */
function lineFromWire(l: WireDraftLine): WorkshopLine {
  if (l.source === 'pantry') {
    return { source: 'pantry', refId: l.pantryItemId ?? null, name: l.name, amount: l.amount, unit: l.unit }
  }
  return {
    source: 'estimate',
    refId: null,
    name: l.name,
    amount: l.amount,
    unit: l.unit,
    est: { kcal: l.kcal ?? 0, p: l.proteinG ?? 0, c: l.carbsG ?? 0, f: l.fatG ?? 0 },
  }
}

function draftToWire(d: WorkshopDraft): WireDraft {
  return { name: d.name, category: d.category, servings: d.servings, steps: d.steps, lines: d.lines.map(lineToWire) }
}

function draftFromWire(d: WireDraft): WorkshopDraft {
  return {
    name: d.name,
    category: d.category as RecipeCategory,
    servings: d.servings,
    steps: d.steps,
    lines: d.lines.map(lineFromWire),
  }
}

export interface WorkshopTurnParams {
  message: string
  goal: WorkshopGoal | null
  history: { role: 'user' | 'assistant'; text: string }[]
  draft: WorkshopDraft | null
}

export const workshopApi = {
  turn: (req: WorkshopTurnParams): Promise<WorkshopTurn> => {
    const body = {
      message: req.message,
      goal: req.goal,
      // `history` has a wire default but is typed non-optional (WorkshopTurnRequest) — always send it.
      history: req.history as WorkshopChatMessage[],
      draft: req.draft ? draftToWire(req.draft) : null,
    } satisfies WorkshopTurnRequest
    return apiFetch<WorkshopTurnResponse>('/api/recipe/workshop/turn', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(r => ({ reply: r.reply, draft: draftFromWire(r.draft) }))
  },
}
