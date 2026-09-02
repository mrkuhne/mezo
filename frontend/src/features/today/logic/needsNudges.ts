// ============================================================
// Mezo · needsNudges — küszöb-nudge-ok az "Életjel-ringekből" a mezo-szálba (mezo-dhzk,
// Task 5). Pure, no I/O: a ring-állapotokból (`NeedState[]`) és a nap eddig megjelent
// nudge-jaiból (`logic/nudgeSeen.ts`) vezeti le a nap TELJES nudge-listáját — a már
// megjelentek `fresh: false`-szal áthaladnak, az újonnan piros/kritikusba fordult ringek
// `fresh: true`-val csatlakoznak. A hívó a shell `MezoThreadProvider`-je (mezo-atry) — a
// friss elemeket egyszer elmenti (`markNudgeShown`) és a szál VÉGÉRE fűzi (`mezoMessages.ts`'s
// `nudges` paramétere); `NapMezoPage` a szál `source: 'eletjel'` elemeit az Életjelek tabra
// bontja (mezo-ho9k).
// Egy ring naponta legfeljebb egyszer nudge-ol — ez a "shown" halmazból esik ki, nem
// külön szabályból. Éjszaka (alvás-ablak) és ébredés utáni első órában nincs új nudge
// (`isQuiet`), hogy a companion sose zavarjon alvás közben vagy közvetlenül ébredéskor.
// Spec: .superpowers/sdd/2026-08-17-needs-rings/task-5-brief.md
// ============================================================
import type { NeedKey, NeedState } from '@/features/today/logic/needs'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'
import type { NudgeSeenEntry } from '@/features/today/logic/nudgeSeen'

export const NUDGE_COPY: Record<NeedKey, string> = {
  energia: '🍽️ Ideje enni valamit — az utolsó étkezésed régen volt, az Energia-ringed leapadt.',
  hidratacio: '💧 Ma még alig ittál — egy pohár víz máris feltölti a Hidratáció-ringet.',
  pihenes: '😴 A tegnapi éjszaka kevés volt — ma este érdemes korábban zárni.',
  mozgas: '💪 Két napja nem mozdultál nagyot — egy edzés vagy séta újra feltölt.',
  lelek: '💗 Rég néztél magadra — egy gyors check-in feltölti a Lélek-ringet.',
  rend: '⚡ A láncaid ma még üresek — egy-két pipa visszahozza a Rendet.',
}

export interface NudgeEntry {
  key: NeedKey
  at: string
  fresh: boolean
}

// --- quiet window ------------------------------------------------------------
// Lokális újraimplementáció (nem az engine belsejéből exportálva — a brief kifejezetten
// ezt kéri): ugyanaz a wrap-aware HH:mm-összehasonlítás, mint `needs.ts`'s `isAwakeAt`-ja.

const toMinuteOfDay = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** True while `[wakeTime, bedTime)` contains `nowMin` — wrap-aware, mint `needs.ts`-ben. */
const isAwakeMin = (nowMin: number, wakeMin: number, bedMin: number): boolean =>
  wakeMin <= bedMin ? nowMin >= wakeMin && nowMin < bedMin : nowMin >= wakeMin || nowMin < bedMin

/**
 * Quiet = éjszaka (az alvás-ablakban VAN, wrap-aware) VAGY az ébredés utáni első órában
 * vagyunk. A "percek az utolsó ébredés óta" modulo-számítás (`% 1440`) helyesen kezeli az
 * éjfél körüli ébredést is, anélkül hogy naptári napot kellene számolnia.
 */
function isQuiet(now: Date, wakeTime: string, bedTime: string): boolean {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const wakeMin = toMinuteOfDay(wakeTime)
  const bedMin = toMinuteOfDay(bedTime)
  if (!isAwakeMin(nowMin, wakeMin, bedMin)) return true
  const sinceWake = (nowMin - wakeMin + 1440) % 1440
  return sinceWake < 60
}

/**
 * A nap TELJES nudge-listája: a már megjelentek (`shown`) `at` szerint növekvő sorrendben
 * áthaladnak `fresh: false`-szal, majd az újonnan kiváltott ringek (piros/kritikus, még nem
 * szerepelnek `shown`-ban, és nincs quiet ablakban) csatlakoznak `fresh: true`-val, a ringek
 * saját (`states`) sorrendjében.
 */
export function deriveNudges(
  states: NeedState[],
  now: Date,
  wakeTime: string,
  bedTime: string,
  shown: NudgeSeenEntry[],
): NudgeEntry[] {
  const shownKeys = new Set(shown.map((s) => s.key))
  const passthrough: NudgeEntry[] = [...shown]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((s) => ({ key: s.key, at: s.at, fresh: false }))

  if (isQuiet(now, wakeTime, bedTime)) return passthrough

  const nowIso = now.toISOString()
  const fresh: NudgeEntry[] = states
    .filter((s) => (s.band === 'red' || s.band === 'critical') && !shownKeys.has(s.key))
    .map((s) => ({ key: s.key, at: nowIso, fresh: true }))

  return [...passthrough, ...fresh]
}

/** Local `HH:mm` from an ISO date-time string. */
const hhmm = (iso: string): string => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Egy nudge-bejegyzés → mezo-szál elem, a szál VÉGÉN jelenik meg (mezoMessages.ts). */
export function toNudgeMessage(n: { key: NeedKey; at: string }): MezoMessageItem {
  return {
    id: `nudge-${n.key}-${n.at}`,
    eyebrow: 'Életjel',
    time: hhmm(n.at),
    paragraphs: [NUDGE_COPY[n.key]],
    refs: [],
    meta: 'Életjel-figyelő',
    source: 'eletjel',
  }
}
