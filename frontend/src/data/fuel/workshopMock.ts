// ============================================================
// Mezo · Recept-műhely scripted mock rounds (mezo-92pb)
// mockWorkshopTurn is a PURE function over the incoming request — no module-level state at
// all, so a manual edit the user made to the draft between turns always survives a tweak
// that doesn't touch that line. The free-text tweak round-robin (2 generic tweaks then an
// honest fallback) is derived from `req.history.length` rather than a module counter, so
// repeated calls with the same request always produce the same result.
// Pantry lines below use REAL mock-pantry ids (frontend/src/data/fuel/pantry.ts `ingredients`)
// so every line resolves against `buildPickables(ingredients, supplementsStash)` — a workshop
// draft must never point at a made-up refId.
// ============================================================
import type { WorkshopDraft, WorkshopGoal, WorkshopLine, WorkshopTurn } from '@/data/types'
import type { WorkshopTurnParams } from '@/data/fuel/workshopApi'

// -- Real mock-pantry refs this file leans on (frontend/src/data/fuel/pantry.ts) --
const CSIRKE = { refId: 'ing-csirkemell', name: 'Csirkemell · friss', unit: 'g' }
const RIZS = { refId: 'ing-rizs', name: 'Barna rizs · hosszú szemű', unit: 'g' }
const TURO = { refId: 'ing-turo', name: 'Túró · félzsíros', unit: 'g' }
const ZAB = { refId: 'ing-zab', name: 'Zabpehely · gluténmentes', unit: 'g' }
const WHEY = { refId: 'ing-whey', name: 'Impact Whey · csoki', unit: 'g' }

function pantryLine(ref: { refId: string; name: string; unit: string }, amount: number): WorkshopLine {
  return { source: 'pantry', refId: ref.refId, name: ref.name, amount, unit: ref.unit }
}

/** Round 1 — the base draft the workshop opens with, regardless of goal/message text. */
function baseDraft(): WorkshopDraft {
  return {
    name: 'Citromos-joghurtos csirketál',
    category: 'lunch',
    servings: 2,
    steps: [
      'A csirkemellet vékony szeletekre vágjuk, sózzuk, borsozzuk.',
      'Serpenyőben olívaolajon aranybarnára sütjük mindkét oldalát.',
      'A barna rizst puhára főzzük, a túrót citromlével és fűszerekkel simára keverjük.',
      'Tálaláskor a rizsre halmozzuk a csirkét, meglocsoljuk a citromos-túrós öntettel.',
    ],
    lines: [
      pantryLine(CSIRKE, 300),
      pantryLine(RIZS, 150),
      pantryLine(TURO, 100),
      {
        source: 'estimate',
        refId: null,
        name: 'Citrom + fűszerek',
        amount: 1,
        unit: 'adag',
        est: { kcal: 15, p: 0.5, c: 3, f: 0.1 },
      },
    ],
  }
}

const BASE_REPLY =
  'Összeraktam egy citromos-joghurtos csirketálat 2 adagra — csirkemell, barna rizs és túróval kevert citromos öntet. A citrom és a fűszerek mennyisége egyelőre becslés, mert nincs pontos pantry-tétel rájuk.'

// -- Line lookup helpers (name-substring match, case-insensitive) --
function findLineIndex(lines: WorkshopLine[], pattern: RegExp): number {
  return lines.findIndex(l => pattern.test(l.name))
}

function bumpAmount(lines: WorkshopLine[], index: number, delta: number, floor = 0): WorkshopLine[] {
  return lines.map((l, i) => (i === index ? { ...l, amount: Math.max(floor, l.amount + delta) } : l))
}

function replaceLine(lines: WorkshopLine[], index: number, next: WorkshopLine): WorkshopLine[] {
  return lines.map((l, i) => (i === index ? next : l))
}

const RICE_RE = /rizs/i
const CHICKEN_RE = /csirke/i
const OIL_RE = /olaj|zsír|vaj/i
const WHEY_RE = /whey|fehérje-?por/i
const TURO_RE = /túró/i

function applyHighProtein(draft: WorkshopDraft): { draft: WorkshopDraft; reply: string } {
  let lines = draft.lines
  const chickenIx = findLineIndex(lines, CHICKEN_RE)
  if (chickenIx >= 0) lines = bumpAmount(lines, chickenIx, 60)
  const riceIx = findLineIndex(lines, RICE_RE)
  if (riceIx >= 0) lines = bumpAmount(lines, riceIx, -50)
  return {
    draft: { ...draft, lines },
    reply: 'Feltoltam fehérjében: több csirke, kevesebb rizs — így magasabb a fehérje/szénhidrát arány.',
  }
}

function applyPreWorkout(draft: WorkshopDraft): { draft: WorkshopDraft; reply: string } {
  let lines = draft.lines
  const riceIx = findLineIndex(lines, RICE_RE)
  if (riceIx >= 0) lines = bumpAmount(lines, riceIx, 100)
  const oilIx = findLineIndex(lines, OIL_RE)
  if (oilIx >= 0) lines = bumpAmount(lines, oilIx, -5)
  return {
    draft: { ...draft, lines },
    reply: 'Edzés előtti verzió: több gyors szénhidrát a rizsből, kicsit kevesebb zsír, hogy könnyebben emészthető legyen.',
  }
}

function applyPostWorkout(draft: WorkshopDraft): { draft: WorkshopDraft; reply: string } {
  const hasWhey = draft.lines.some(l => WHEY_RE.test(l.name) || l.refId === WHEY.refId)
  if (hasWhey) {
    return {
      draft,
      reply: 'Már van fehérjepor a receptben, edzés utánra ez rendben van úgy, ahogy áll.',
    }
  }
  const lines = [...draft.lines, pantryLine(WHEY, 30)]
  return {
    draft: { ...draft, lines },
    reply: 'Edzés utánra betettem egy adag Whey-t a gyors fehérjebevitelért.',
  }
}

function applyBeforeBed(draft: WorkshopDraft): { draft: WorkshopDraft; reply: string } {
  const riceIx = findLineIndex(draft.lines, RICE_RE)
  if (riceIx < 0) {
    return { draft, reply: 'Nem találtam rizst a receptben, amit lecserélhetnék — a többi rész maradhat lefekvés előttre is.' }
  }
  // The base draft already carries a túró line (the yogurt stand-in) — swapping rice for a
  // SECOND túró line would leave two "Túró" rows with different amounts. Merge into the
  // existing one instead when it's already there; only add a new túró line when it isn't.
  const existingTuroIx = findLineIndex(draft.lines, TURO_RE)
  if (existingTuroIx >= 0) {
    const lines = draft.lines
      .map((l, i) => (i === existingTuroIx ? { ...l, amount: l.amount + 150 } : l))
      .filter((_, i) => i !== riceIx)
    return {
      draft: { ...draft, lines },
      reply: 'Lefekvés előttre elvettem a rizst, és a meglévő túró adagját megnöveltem — éjszakára ez a lassan felszívódó fehérje jobb választás.',
    }
  }
  const lines = replaceLine(draft.lines, riceIx, pantryLine(TURO, 150))
  return {
    draft: { ...draft, lines },
    reply: 'Lefekvés előttre a rizst lassan felszívódó túróra cseréltem — éjszakára jobb fehérjeforrás.',
  }
}

function applyBreakfast(draft: WorkshopDraft): { draft: WorkshopDraft; reply: string } {
  const riceIx = findLineIndex(draft.lines, RICE_RE)
  if (riceIx < 0) {
    return { draft, reply: 'Nem találtam rizst a receptben, amit reggelire cserélhetnék — a többi rész maradhat.' }
  }
  const lines = replaceLine(draft.lines, riceIx, pantryLine(ZAB, 80))
  return {
    draft: { ...draft, lines },
    reply: 'Reggelire a rizst zabpehelyre cseréltem — gyorsabb elkészítés és rostban is gazdagabb.',
  }
}

const GOAL_TWEAKS: Record<WorkshopGoal, (draft: WorkshopDraft) => { draft: WorkshopDraft; reply: string }> = {
  high_protein: applyHighProtein,
  pre_workout: applyPreWorkout,
  post_workout: applyPostWorkout,
  before_bed: applyBeforeBed,
  breakfast: applyBreakfast,
}

// -- Free-text turns: 2 generic tweaks, then an honest fallback, round-robin on history length. --

function genericTweakA(draft: WorkshopDraft): { draft: WorkshopDraft; reply: string } {
  const estIx = draft.lines.findIndex(l => l.source === 'estimate')
  if (estIx < 0) {
    return { draft, reply: 'Rendben, egyelőre nem változtattam semmin — mondd meg konkrétan mit módosítsak.' }
  }
  const line = draft.lines[estIx]
  const est = line.est ?? { kcal: 0, p: 0, c: 0, f: 0 }
  const lines = replaceLine(draft.lines, estIx, {
    ...line,
    amount: line.amount + 1,
    est: { kcal: est.kcal + 5, p: est.p, c: est.c + 1, f: est.f },
  })
  return { draft: { ...draft, lines }, reply: 'Egy kicsit erősebbre vettem a fűszerezést-citromot.' }
}

function genericTweakB(draft: WorkshopDraft): { draft: WorkshopDraft; reply: string } {
  const chickenIx = findLineIndex(draft.lines, CHICKEN_RE)
  if (chickenIx < 0) {
    return { draft, reply: 'Rendben, egyelőre nem változtattam semmin — mondd meg konkrétan mit módosítsak.' }
  }
  const lines = bumpAmount(draft.lines, chickenIx, 25)
  return { draft: { ...draft, lines }, reply: 'Kicsit nagyobb adag csirkét tettem bele, hogy jobban lakjon.' }
}

function fallbackReply(draft: WorkshopDraft): { draft: WorkshopDraft; reply: string } {
  return {
    draft,
    reply: 'Ezt a kérést nem tudom biztosan lefordítani egy konkrét recept-módosításra — a piszkozat egyelőre változatlan, pontosíthatod, mit szeretnél másképp?',
  }
}

/** Scripted mock turn — PURE over `req`, so any manual edit the user made to `req.draft`
 *  survives untouched by a tweak that doesn't target that specific line. */
export function mockWorkshopTurn(req: WorkshopTurnParams): WorkshopTurn {
  if (req.draft == null) {
    return { reply: BASE_REPLY, draft: baseDraft() }
  }
  if (req.goal) {
    const { draft, reply } = GOAL_TWEAKS[req.goal](req.draft)
    return { reply, draft }
  }
  // Derived from the incoming request (not module state) so mockWorkshopTurn stays pure —
  // repeated calls with the same req always yield the same result.
  const step = req.history.length % 3
  const { draft, reply } =
    step === 0 ? genericTweakA(req.draft) : step === 1 ? genericTweakB(req.draft) : fallbackReply(req.draft)
  return { reply, draft }
}
