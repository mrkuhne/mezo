// ============================================================
// Mezo · mealWindow — az étkezési óra ablak-logikája (mezo-6g52f)
//
// A tervező (placeWindows / compileTemplate) EGY időpontot helyez el és — mostantól — azt is
// feljegyzi, MELYIK szabály tette oda (`WindowRule`). Ez a modul az időpontot ablakká szélesíti
// (WINDOW_OFFSETS), a szabályból okokat ad (`WindowReason`), és a logolt időt az ablakhoz méri.
// Tiszta függvények: nincs ambiens idő, minden percben / "HH:mm"-ben jön be.
//
// Owner-döntések (2026-09-26, fuel-ora-ablak.html): az eltalálás SZÓ, nem pontszám; kívül
// mindig borostyán, soha piros; a szöveg „segít / általában", sosem „kell".
// ============================================================
import type { WindowReason } from '@/data/types'
import { getLang, m } from '@/shared/i18n'
import { WINDOW_OFFSETS, WINDOW_MIN_WIDTH_MIN, BEFORE_BED_MIN, HIT_NEAR_MIN, DEFAULT_BLOCK_MIN, toMin, toHHmm } from '@/data/fuel/fuelConfig'

export type WindowRule =
  | 'breakfast' | 'main' | 'snack' | 'pre-training-main' | 'pre-training-snack' | 'post-training'
  | 'template-wake' | 'template-bed' | 'template-fixed' | 'template-training-start' | 'template-training-end'

export interface WidenInput { time: number; kind: 'meal' | 'snack'; rule: WindowRule }
export interface WidenCtx { eatingStart: number; kitchenClose: number; bedMin: number }
export interface WindowRange { from: number; to: number; reasons: WindowReason[] }

function offsetsOf(w: WidenInput): readonly [number, number] {
  switch (w.rule) {
    case 'breakfast': case 'main': case 'snack':
    case 'pre-training-main': case 'pre-training-snack': case 'post-training':
      return WINDOW_OFFSETS[w.rule]
    case 'template-training-start':
      return w.kind === 'meal' ? WINDOW_OFFSETS['pre-training-main'] : WINDOW_OFFSETS['pre-training-snack']
    case 'template-training-end':
      return WINDOW_OFFSETS['post-training']
    default:
      return w.kind === 'meal' ? WINDOW_OFFSETS.templateMeal : WINDOW_OFFSETS.templateSnack
  }
}

function baseReasons(w: WidenInput): WindowReason[] {
  switch (w.rule) {
    case 'breakfast': return ['after-wake', 'protein-start']
    case 'main': return ['protein-spacing']
    case 'snack': return ['bridge']
    case 'pre-training-main': return ['pre-training-main']
    case 'pre-training-snack': return ['pre-training-snack']
    case 'post-training': return ['post-training']
    case 'template-wake': return w.kind === 'meal' ? ['after-wake', 'protein-start'] : ['bridge']
    case 'template-training-start': return [w.kind === 'meal' ? 'pre-training-main' : 'pre-training-snack']
    case 'template-training-end': return ['post-training']
    case 'template-fixed': return ['template-fixed']
    case 'template-bed': return []
  }
}

/** Ablakká szélesítés. A bemenet sorrendjében ad vissza; az átfedő szomszédokat a tervezett
 *  időpontjaik felezőjénél vágja. Éjfélen átnyúló napon (eatingStart ≥ kitchenClose) a
 *  span-clampet kihagyja — csak a minimum-szélesség és a vágás él. */
export function widenWindows(ws: WidenInput[], ctx: WidenCtx): WindowRange[] {
  const spanOk = ctx.eatingStart < ctx.kitchenClose
  const out: WindowRange[] = ws.map(w => {
    const [before, after] = offsetsOf(w)
    let from = w.time - before
    let to = w.time + after
    if (spanOk) {
      from = Math.max(ctx.eatingStart, from)
      to = Math.min(ctx.kitchenClose, to)
    }
    if (to - from < WINDOW_MIN_WIDTH_MIN) from = to - WINDOW_MIN_WIDTH_MIN
    return { from, to, reasons: baseReasons(w) }
  })
  const order = ws.map((_, i) => i).sort((a, z) => ws[a].time - ws[z].time)
  for (let k = 1; k < order.length; k++) {
    const a = out[order[k - 1]]
    const b = out[order[k]]
    if (a.to > b.from) {
      const mid = (ws[order[k - 1]].time + ws[order[k]].time) / 2
      a.to = Math.min(a.to, mid)
      b.from = Math.max(b.from, mid)
    }
  }
  for (const r of out) {
    r.from = Math.round(r.from)
    r.to = Math.round(r.to)
    // mezo-9sltu: a crowd (e.g. windows capped at kitchen close) can be cut to zero by the split —
    // never emit a window narrower than the minimum; an overlap with the neighbour is acceptable.
    if (r.to - r.from < WINDOW_MIN_WIDTH_MIN) r.from = r.to - WINDOW_MIN_WIDTH_MIN
    if (r.to >= ctx.bedMin - BEFORE_BED_MIN && !r.reasons.includes('before-bed')) r.reasons = [...r.reasons, 'before-bed']
  }
  return out
}

export type Hit = { kind: 'in' } | { kind: 'near' | 'far'; offsetMin: number }

export function hitOf(from: string, to: string, at: string): Hit {
  const a = toMin(at), lo = toMin(from), hi = toMin(to)
  if (a >= lo && a <= hi) return { kind: 'in' }
  const offsetMin = a < lo ? a - lo : a - hi
  return { kind: Math.abs(offsetMin) <= HIT_NEAR_MIN ? 'near' : 'far', offsetMin }
}

export function durHu(min: number): string {
  const total = Math.abs(Math.round(min))
  const h = Math.floor(total / 60), r = total % 60
  const M = m().fuelLogika.mealWindow
  if (h && r) return M.durHM(h, r)
  return h ? M.durH(h) : M.durM(r)
}

export function hitLabel(h: Hit): string {
  const M = m().fuelLogika.mealWindow
  if (h.kind === 'in') return M.inWindow
  return h.offsetMin > 0 ? M.later(durHu(h.offsetMin)) : M.earlier(durHu(h.offsetMin))
}

/** The Hungarian definite article before a label („az ebéd” / „a vacsora”). English has no such agreement: the bare label. */
export const az = (label: string) => (getLang() !== 'hu' ? label : (/^[AÁEÉIÍOÓÖŐUÚÜŰ]/i.test(label) ? 'az ' : 'a ') + label)
export const Az = (label: string) => { const t = az(label); return t[0].toUpperCase() + t.slice(1) }

export interface ReasonCtx {
  wake: string; bed: string; trainingStart: string | null; trainingEnd: string | null
  /** mezo-9sltu: a 'shifted' ok forrása — az előző étkezés címkéje és ideje. */
  shiftedAfter?: { label: string; at: string }
}
export interface ReasonCopy { icon: 't-sun' | 't-protein' | 't-clock' | 't-dumbbell' | 't-moon'; title: string; body: string }

/** A nap edzés-burka a napórához és a forecasthoz: legkorábbi kezdet, legkésőbbi vég; több blokknál
 *  „első címke +N". Nincs blokk → null (őszinte-null: nincs edzés-ív, nincs edzés-mondat). */
export function trainingSpan(blocks: { time: string; durationMin: number | null; label: string }[]): { start: string; end: string; label: string } | null {
  if (!blocks.length) return null
  const sorted = [...blocks].sort((a, z) => toMin(a.time) - toMin(z.time))
  const end = Math.max(...blocks.map(b => toMin(b.time) + (b.durationMin ?? DEFAULT_BLOCK_MIN)))
  const label = sorted[0].label.split('·')[0].trim() + (blocks.length > 1 ? ` +${blocks.length - 1}` : '')
  return { start: sorted[0].time, end: toHHmm(end), label }
}

export function windowReasonCopy(code: WindowReason, c: ReasonCtx): ReasonCopy {
  const R = m().fuelLogika.mealWindow.reason
  switch (code) {
    case 'after-wake': return { icon: 't-sun', title: R.afterWake.title(c.wake), body: R.afterWake.body }
    case 'protein-start': return { icon: 't-protein', title: R.proteinStart.title, body: R.proteinStart.body }
    case 'protein-spacing': return { icon: 't-protein', title: R.proteinSpacing.title, body: R.proteinSpacing.body }
    case 'bridge': return { icon: 't-clock', title: R.bridge.title, body: R.bridge.body }
    case 'pre-training-main': return { icon: 't-dumbbell', title: R.preTrainingMain.title(c.trainingStart), body: R.preTrainingMain.body }
    case 'pre-training-snack': return { icon: 't-dumbbell', title: R.preTrainingSnack.title(c.trainingStart), body: R.preTrainingSnack.body }
    case 'post-training': return { icon: 't-dumbbell', title: R.postTraining.title(c.trainingEnd), body: R.postTraining.body }
    case 'before-bed': return { icon: 't-moon', title: R.beforeBed.title(c.bed), body: R.beforeBed.body }
    case 'template-fixed': return { icon: 't-clock', title: R.templateFixed.title, body: R.templateFixed.body }
    case 'shifted': return {
      icon: 't-clock',
      title: c.shiftedAfter ? R.shifted.titleAfter(az(c.shiftedAfter.label.toLowerCase()), c.shiftedAfter.at) : R.shifted.title,
      body: R.shifted.body,
    }
  }
}
