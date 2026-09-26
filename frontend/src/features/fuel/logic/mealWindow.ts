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
import { WINDOW_OFFSETS, WINDOW_MIN_WIDTH_MIN, BEFORE_BED_MIN, HIT_NEAR_MIN, toMin } from '@/data/fuel/fuelConfig'

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
  const m = Math.abs(Math.round(min))
  const h = Math.floor(m / 60), r = m % 60
  if (h && r) return `${h} ó ${r} p`
  return h ? `${h} ó` : `${r} p`
}

export function hitLabel(h: Hit): string {
  if (h.kind === 'in') return 'Az ablakban'
  return h.offsetMin > 0 ? `+${durHu(h.offsetMin)} később` : `−${durHu(h.offsetMin)} korábban`
}

export const az = (label: string) => (/^[AÁEÉIÍOÓÖŐUÚÜŰ]/i.test(label) ? 'az ' : 'a ') + label
export const Az = (label: string) => { const t = az(label); return t[0].toUpperCase() + t.slice(1) }

export interface ReasonCtx { wake: string; bed: string; trainingStart: string | null; trainingEnd: string | null }
export interface ReasonCopy { icon: 't-sun' | 't-protein' | 't-clock' | 't-dumbbell' | 't-moon'; title: string; body: string }

export function windowReasonCopy(code: WindowReason, c: ReasonCtx): ReasonCopy {
  const ts = c.trainingStart ? ` (${c.trainingStart})` : ''
  const te = c.trainingEnd ? ` (${c.trainingEnd})` : ''
  switch (code) {
    case 'after-wake': return { icon: 't-sun', title: `Ébredés (${c.wake}) után nem sokkal`, body: 'Az éjszakai böjt után itt töltöd fel a raktárakat.' }
    case 'protein-start': return { icon: 't-protein', title: 'A nap első fehérjeadagja', body: 'Ez indítja a napi fehérje-sort, nagyjából 3–4 órás lépésközzel.' }
    case 'protein-spacing': return { icon: 't-protein', title: 'Nagyjából 3–4 órára az előzőtől', body: 'A fehérje egyenletes elosztása segíti az izomépítést, és kordában tartja az éhséget.' }
    case 'bridge': return { icon: 't-clock', title: 'Két fő étkezés között', body: 'Áthidalja a hosszabb szünetet, így nem esel be éhesen a következő étkezésbe.' }
    case 'pre-training-main': return { icon: 't-dumbbell', title: `Néhány órával az edzés${ts} előtt`, body: 'Itt jön a nap fő szénhidrátos étkezése: tele raktárral indulsz, és addigra meg is emészted.' }
    case 'pre-training-snack': return { icon: 't-dumbbell', title: `45–90 perccel az edzés${ts} előtt`, body: 'Könnyű, gyorsan hasznosuló szénhidrát: ne üres gyomorral, de ne is tele hassal edzz.' }
    case 'post-training': return { icon: 't-dumbbell', title: `Az edzés${te} után fél–másfél órával`, body: 'Fehérje és szénhidrát segíti a regenerációt és a raktárak visszatöltését.' }
    case 'before-bed': return { icon: 't-moon', title: `Lefekvés (${c.bed}) előtt legalább 2,5 órával`, body: 'Késő este ugyanaz az étel általában nagyobb vércukor-emelkedést okoz, és ronthatja az alvást.' }
    case 'template-fixed': return { icon: 't-clock', title: 'A saját napi sablonod szerint', body: 'Ezt az időpontot a napi sablonodban rögzítetted.' }
  }
}
