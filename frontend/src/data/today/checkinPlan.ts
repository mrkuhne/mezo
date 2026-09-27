// ============================================================
// Mezo · Check-in 2.0 question plan (mezo-ck2, spec §2.2–2.3)
// The plan is SERVER config (`mezo.checkin.plan`, GET /api/biometrics/checkin/plan). This file
// holds the mock-mode mirror of that config — the item copy of `CheckInItem.java`, the region /
// kind labels of `PainRegion` / `CravingKind`, the per-slot plans of `application.yml` — and the
// questions of the day the owner approved on the Nap living prototype (`elo/nap.html`, `ADAPT`).
// Real mode never reads this as a fallback (useDualQuery's realEmpty is `null`).
// ============================================================
import type { CheckInAdaptiveItem, CheckInPlanItem, CheckInPlanResponse } from '@/data/me/biometricsApi'
import type { CheckinItemId, CravingKindId, PainRegionId } from '@/data/types'

export type CheckInPlan = CheckInPlanResponse

/** `PainRegion` → its Hungarian label (the server's option labels, verbatim). */
export const PAIN_REGION_LABEL: Record<PainRegionId, string> = {
  FEJ: 'Fej', NYAK: 'Nyak', VALL: 'Váll', KONYOK: 'Könyök', CSUKLO_KEZ: 'Csukló, kéz',
  FELSO_HAT: 'Felső hát', DEREK: 'Derék', CSIPO: 'Csípő', HAS: 'Has', TERD: 'Térd',
  BOKA_LABFEJ: 'Boka, lábfej', EGYEB: 'Egyéb',
}

/** `CravingKind` → its Hungarian label. */
export const CRAVING_KIND_LABEL: Record<CravingKindId, string> = {
  EDES: 'Édes', SOS: 'Sós', ZSIROS: 'Zsíros', BARMIT: 'Bármit',
}

const options = <K extends string>(labels: Record<K, string>) =>
  (Object.keys(labels) as K[]).map((id) => ({ id, label: labels[id] }))

/** The fourteen items, `CheckInItem.java` order (core five first). */
export const CHECKIN_ITEMS: Record<CheckinItemId, CheckInPlanItem> = {
  energy: { id: 'energy', label: 'Energia', question: 'Mennyi energia van benned most?', low: 'Üres', high: 'Tele', kind: 'SCALE' },
  mood: { id: 'mood', label: 'Hangulat', question: 'Milyen most a hangulatod?', low: 'Nagyon rossz', high: 'Nagyon jó', kind: 'SCALE' },
  stress: { id: 'stress', label: 'Stressz', question: 'Mennyire vagy feszült most?', low: 'Nyugodt', high: 'Túlfeszült', kind: 'SCALE' },
  body: { id: 'body', label: 'Testi érzés', question: 'Hogy érzi magát most a tested?', low: 'Lerakva', high: 'Friss', kind: 'SCALE' },
  mental: { id: 'mental', label: 'Fejtisztaság', question: 'Mennyire tiszta a fejed?', low: 'Köd', high: 'Éles', kind: 'SCALE' },
  rested: { id: 'rested', label: 'Kipihentség', question: 'Mennyire pihented ki magad éjjel?', low: 'Egyáltalán nem', high: 'Teljesen', kind: 'SCALE' },
  soreness: { id: 'soreness', label: 'Izomláz', question: 'Mennyire van izomlázad?', low: 'Nincs', high: 'Nagyon erős', kind: 'SCALE' },
  pain: { id: 'pain', label: 'Fájdalom', question: 'Fáj valami?', low: 'Alig', high: 'Nagyon', kind: 'PAIN', options: options(PAIN_REGION_LABEL) },
  motivation: { id: 'motivation', label: 'Motiváció', question: 'Mennyi kedved van a mai dolgaidhoz?', low: 'Semmi', high: 'Tele vagyok vele', kind: 'SCALE' },
  hunger: { id: 'hunger', label: 'Éhség', question: 'Mennyire vagy éhes most?', low: 'Egyáltalán nem', high: 'Nagyon', kind: 'SCALE' },
  craving: { id: 'craving', label: 'Sóvárgás', question: 'Kívánsz most valamit?', low: 'Nem', high: 'Nagyon', kind: 'CRAVING', options: options(CRAVING_KIND_LABEL) },
  digestion: { id: 'digestion', label: 'Emésztés', question: 'Hogy érzi magát most a gyomrod?', low: 'Nehéz, puffadt', high: 'Könnyű, rendben', kind: 'SCALE' },
  connection: { id: 'connection', label: 'Kapcsolódás', question: 'Mennyire érezted magad ma kapcsolódva másokhoz?', low: 'Egyedül', high: 'Nagyon', kind: 'SCALE' },
  day: { id: 'day', label: 'A nap mérlege', question: 'Milyen volt a napod összességében?', low: 'Nagyon rossz', high: 'Nagyon jó', kind: 'SCALE' },
}

/** Every item id in canonical order (core five first). */
export const CHECKIN_ITEM_IDS = Object.keys(CHECKIN_ITEMS) as CheckinItemId[]

/** The five core items every slot asks first — the „Most csak ennyi" threshold. */
export const CORE_ITEMS: CheckinItemId[] = ['energy', 'mood', 'stress', 'body', 'mental']

/** `mezo.checkin.plan.slots` (application.yml), mirrored for mock mode. */
const SLOT_PLAN: Record<string, CheckinItemId[]> = {
  '06:30': [...CORE_ITEMS, 'rested', 'soreness', 'pain', 'motivation'],
  '10:00': [...CORE_ITEMS, 'motivation', 'hunger'],
  '14:00': [...CORE_ITEMS, 'hunger', 'craving', 'digestion'],
  '20:00': [...CORE_ITEMS, 'soreness', 'pain', 'craving', 'digestion', 'connection', 'day'],
}

/** The mock questions of the day — the prototype's `ADAPT`, verbatim. */
const MOCK_ADAPTIVE: Record<string, { id: CheckinItemId; why: string; reason: 'NEED' | 'RANDOM' }> = {
  '06:30': { id: 'hunger', reason: 'NEED', why: 'Most azt figyeljük, összefügg-e a reggeli éhséged a tegnapi vacsorával.' },
  '10:00': { id: 'craving', reason: 'RANDOM', why: 'Ma ez a véletlen kérdés — így marad kiegyensúlyozott, amit rólad tanulunk.' },
  '14:00': { id: 'motivation', reason: 'NEED', why: 'Most azt figyeljük, hogyan függ a délutáni kedved az éjszakai alvásodtól.' },
  '20:00': { id: 'motivation', reason: 'NEED', why: 'Most azt figyeljük, előre jelzi-e az esti kedved a holnapi edzést.' },
}

/** The mock plan for a slot time; an unknown slot asks the core five only. */
export function mockCheckInPlan(slotTime: string): CheckInPlan {
  const ids = SLOT_PLAN[slotTime] ?? CORE_ITEMS
  const ad = MOCK_ADAPTIVE[slotTime]
  const adaptive: CheckInAdaptiveItem | undefined = ad
    ? { ...CHECKIN_ITEMS[ad.id], why: ad.why, reason: ad.reason }
    : undefined
  return { items: ids.map((id) => CHECKIN_ITEMS[id]), adaptive }
}

/** The ask order of a plan: the slot's items, then the question of the day. */
export function planSteps(plan: CheckInPlan): (CheckInPlanItem | CheckInAdaptiveItem)[] {
  return plan.adaptive ? [...plan.items, plan.adaptive] : [...plan.items]
}
