import type { Icon3DName } from '@/shared/ui/clay'
import type { PersonEffect } from '@/data/types'

// S4 (mezo-d6ivw.4): a "Hatás · együttjárás" kártya — óvatos, nem-oki mondat + KÜLÖN
// erősség/bizonyosság jelzés (Exist-minta). A stressz-metrika polaritása itt fordul meg:
// "lower" stressz = "nyugodtabb vagy" (jó irány), nem a nyers irány szó szerinti fordítása.
// S6 (mezo-d6ivw.6): kiemelve a PersonDetailPage-ből — a Tudástár Hatások szakasza is ezt
// a szótárat használja (személy- és esemény-alanyok közös mondattana).
export const METRIC_COPY: Record<PersonEffect['metric'], { higher: string; lower: string }> = {
  mental: { higher: 'jobb a hangulatod', lower: 'nyomottabb a hangulatod' },
  energy: { higher: 'több az energiád', lower: 'kevesebb az energiád' },
  stress: { higher: 'feszültebb vagy', lower: 'nyugodtabb vagy' },
}

export function personEffectSentence(name: string, e: PersonEffect): string {
  return `Úgy tűnik, azokon a napokon, amikor ${name} szóba kerül, ${METRIC_COPY[e.metric][e.direction]}.`
}

// Wire values (enyhe/kozepes/eros, gyenge/kozepes/eros) → accented display labels + dot count.
export const STRENGTH_META: Record<PersonEffect['strength'], { label: string; n: number }> = {
  enyhe: { label: 'enyhe', n: 1 },
  kozepes: { label: 'közepes', n: 2 },
  eros: { label: 'erős', n: 3 },
}
export const CONFIDENCE_META: Record<PersonEffect['confidence'], { label: string; n: number }> = {
  gyenge: { label: 'gyenge', n: 1 },
  kozepes: { label: 'közepes', n: 2 },
  eros: { label: 'erős', n: 3 },
}

export function formatMeanDiff(meanDiff: number): string {
  return Math.abs(meanDiff).toFixed(1).replace('.', ',')
}

// S6 (mezo-d6ivw.6): esemény-alanyok (edzés, munka, …) — a Tudástár Hatások szakasza a
// személyeken kívül ezeket is felsorolja, ugyanazzal az együttjárás-mondattannal.
export const EVENT_LEAD: Record<string, string> = {
  edzes: 'az edzésnapokon', munka: 'a munkás napokon', csalad: 'a családi napokon',
  kozos_program: 'a közös programok napjain', konfliktus: 'a konfliktusos napokon', pihenes: 'a pihenős napokon',
}
export const EVENT_ICON: Record<string, Icon3DName> = {
  edzes: 't-dumbbell', munka: 't-flame', csalad: 't-people', kozos_program: 't-calendar', konfliktus: 't-bolt', pihenes: 't-moon',
}
export function eventEffectSentence(key: string, e: PersonEffect): string {
  return `Úgy tűnik, ${EVENT_LEAD[key] ?? 'ezeken a napokon'} ${METRIC_COPY[e.metric][e.direction]}.`
}
export const effectEvidenceLine = (e: PersonEffect) => `${e.subjectDays} nap alapján · átlagosan ~${formatMeanDiff(e.meanDiff)} ponttal`

// S6 (mezo-d6ivw.6): the two signal labels, their dot-row a11y names and the standing non-causal
// footnote — shared by the person page and the Tudástár Hatások cards (EffectRows).
export const EFFECT_SIGNAL = { strength: 'EGYÜTTJÁRÁS', confidence: 'BIZONYOSSÁG', foot: 'Együttjárás, nem ok-okozat.' } as const
export const strengthAria = (e: PersonEffect) => `erősség: ${STRENGTH_META[e.strength].label}`
export const confidenceAria = (e: PersonEffect) => `bizonyosság: ${CONFIDENCE_META[e.confidence].label}`
