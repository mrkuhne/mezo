// ============================================================
// Mezo · Check-in 2.0 item look + display (mezo-ck2)
// The presentation half of the fourteen items — the prototype's `ITEMS` (icon, colour, the
// short cell label) and `ckDisp` (how an answer reads) — shared by the sheet, its summary and
// the Check-in page's mini-cells. The copy (label, question, anchors) is server config and comes
// with the plan; this is only how an item LOOKS.
// Source of truth: docs/design_2.0/prototypes/elo/nap.html (`ITEMS`, `ckDisp`, `REG_F`/`REG_B`).
// ============================================================
import type { Icon3DName } from '@/shared/ui/clay'
import { CHECKIN_ITEM_IDS, CRAVING_KIND_LABEL, PAIN_REGION_LABEL } from '@/data/today/checkinPlan'
import type { CheckinItemId, CheckinValues, PainRegionId } from '@/data/types'

export interface CheckinItemLook {
  icon: Icon3DName
  color: string
  /** The Check-in page's mini-cell label. */
  short: string
}

export const CHECKIN_LOOK: Record<CheckinItemId, CheckinItemLook> = {
  energy: { icon: 't-bolt', color: 'var(--dv-coral)', short: 'Energia' },
  mood: { icon: 't-mood', color: 'var(--dv-lav)', short: 'Hangulat' },
  stress: { icon: 't-checkin', color: 'var(--dv-amber)', short: 'Stressz' },
  body: { icon: 't-person', color: 'var(--dv-rose)', short: 'Test' },
  mental: { icon: 't-gem', color: 'var(--dv-sky)', short: 'Fej' },
  rested: { icon: 't-rested', color: 'var(--dv-lav)', short: 'Pihent' },
  soreness: { icon: 't-soreness', color: 'var(--dv-coral)', short: 'Izomláz' },
  pain: { icon: 't-pain', color: 'var(--dv-rose)', short: 'Fájdalom' },
  motivation: { icon: 't-motivation', color: 'var(--dv-amber)', short: 'Kedv' },
  hunger: { icon: 't-hunger', color: 'var(--dv-sage)', short: 'Éhség' },
  craving: { icon: 't-craving', color: 'var(--dv-rose)', short: 'Sóvárgás' },
  digestion: { icon: 't-digestion', color: 'var(--dv-sage)', short: 'Emésztés' },
  connection: { icon: 't-people', color: 'var(--dv-rose)', short: 'Kapcsolat' },
  day: { icon: 't-day', color: 'var(--dv-amber)', short: 'Nap' },
}

/** The pain figure's dots (104×196 viewBox), front then back — the prototype's `REG_F`/`REG_B`. */
export const PAIN_FRONT: [PainRegionId, number, number][] = [
  ['FEJ', 52, 16], ['NYAK', 52, 35], ['VALL', 33, 46], ['KONYOK', 22, 82], ['CSUKLO_KEZ', 19, 106],
  ['HAS', 52, 80], ['CSIPO', 42, 106], ['TERD', 45, 150], ['BOKA_LABFEJ', 47, 184],
]
export const PAIN_BACK: [PainRegionId, number, number][] = [['FELSO_HAT', 52, 56], ['DEREK', 52, 96]]
/** The chip order: the figure's regions front → back, then „Egyéb". */
export const PAIN_CHIP_ORDER: PainRegionId[] = [...PAIN_FRONT, ...PAIN_BACK].map(([id]) => id).concat('EGYEB')
/** The simple front/back silhouette (the prototype's `SIL`). */
export const PAIN_SILHOUETTE =
  'M52 4C60 4 65 10 65 18S60 32 52 32 39 26 39 18 44 4 52 4ZM44 34H60L78 44C82 46 84 50 84 54L88 108C88 112 84 114 81 112L76 60 70 62 70 110 64 190H54L52 128 50 190H40L34 110 34 62 28 60 23 112C20 114 16 112 16 108L20 54C20 50 22 46 26 44Z'

/**
 * How an item's answer reads (the prototype's `ckDisp`): `null` = not asked (key absent),
 * `'—'` = asked and skipped, otherwise the answer — `short` for the page's mini-cells.
 */
export function answerText(id: CheckinItemId, values: CheckinValues, short = false): string | null {
  if (!(id in values)) return null
  const v = values[id]
  if (v === null || v === undefined) return '—'
  if (id === 'pain') {
    const p = values.pain!
    if (p === false) return 'Nem'
    const names = p.regions.map((r) => PAIN_REGION_LABEL[r])
    if (short) return `${names[0] ?? 'Igen'}${p.intensity ? ` ${p.intensity}` : ''}`
    return `${names.length ? names.join(', ') : 'Igen'}${p.intensity ? ` · ${p.intensity}/10` : ''}`
  }
  if (id === 'craving') {
    const c = values.craving!
    const kinds = c.kinds.map((k) => CRAVING_KIND_LABEL[k])
    if (short) return `${kinds[0] ? `${kinds[0]} ` : ''}${c.value}`
    return `${c.value}${kinds.length ? ` · ${kinds.join(', ')}` : ''}`
  }
  return String(v)
}

/** The answered items of a slot, in ask order (its asked items, else the canonical order). */
export function answeredItems(values: CheckinValues, asked?: CheckinItemId[] | null): CheckinItemId[] {
  const order = asked ?? CHECKIN_ITEM_IDS
  return order.filter((id, i) => order.indexOf(id) === i && values[id] != null)
}

/** A 1–10 day rating as a band word (owner copy): 1–4 rossz · 5–6 közepes · 7–8 jó · 9–10 nagyon jó. */
export function ratingBand(rating: number): 'rossz' | 'közepes' | 'jó' | 'nagyon jó' {
  if (rating <= 4) return 'rossz'
  if (rating <= 6) return 'közepes'
  if (rating <= 8) return 'jó'
  return 'nagyon jó'
}

/** The app's 0–100 day score on the same four-word scale (score / 10 → the rating bands), so
 *  „az app szerint" and „szerinted" can be compared band to band: 64 → közepes. */
export function scoreRatingBand(score: number) {
  return ratingBand(Math.max(1, Math.round(score / 10)))
}
