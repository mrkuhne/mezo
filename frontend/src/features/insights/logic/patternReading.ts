// ============================================================
// Mezo · patternReading — a minta-részlet oldal EGY olvasata (mezo-rstt7, prototypes/uveg-minta.html).
// {pair, pattern, days, events} → állapot + a „merre húz" mérő mostani és megerősítéskori
// helyzete. A mérő sávja 90%-os Fisher-z intervallum, a feltevés SAJÁT irányába fordítva:
// jobbra mindig az „igaz rád". Tiszta függvények: az oldal minden szava és színe innen jön.
// ============================================================
import type { AlignedDay, Pattern, PatternEvent, PatternMonitorPair, PatternTestPlan } from '@/data/types'
import type { DetailTone } from '@/features/insights/components/DetailHero'
import type { Icon3DName } from '@/shared/ui/clay'
import { binaryGroupLabels, formatMetricValue } from '@/features/insights/logic/metricFormat'
import { bottleneckLabel, groupBalanceSentence } from '@/features/insights/logic/verdicts'

export type ReadingState =
  | 'kerdes' | 'gyulik' | 'allo' | 'nincs' | 'halvany' | 'halvanyFordit' | 'fordit' | 'eros'
  | 'elvetve' | 'elengedve' | 'pihen'

export interface Lean { r: number; n: number; support: number; lo: number; hi: number }
export interface Reading {
  state: ReadingState
  now: Lean | null
  then: Lean | null
  minN: number
  dayCount: number
  dir: 1 | -1
}

const Z90 = 1.645
const FLAT = 0.15
/** A csoportos (bináris) párnál csoportonként ennyi nap kell, ha a kapu nem mondja meg. */
const DEFAULT_PER_GROUP = 3
const LAST_RESORT_MIN_N = 8

export function pearson(days: AlignedDay[]): number | null {
  const n = days.length
  if (n < 3) return null
  const ma = days.reduce((s, d) => s + d.a, 0) / n
  const mb = days.reduce((s, d) => s + d.b, 0) / n
  let sab = 0, saa = 0, sbb = 0
  for (const d of days) {
    sab += (d.a - ma) * (d.b - mb)
    saa += (d.a - ma) ** 2
    sbb += (d.b - mb) ** 2
  }
  if (saa === 0 || sbb === 0) return null
  return sab / Math.sqrt(saa * sbb)
}

export function lean(r: number, n: number, dir: 1 | -1): Lean {
  const support = r * dir
  if (n <= 3) return { r, n, support, lo: -1, hi: 1 }
  const z = Math.atanh(Math.max(-0.999, Math.min(0.999, support)))
  const se = 1 / Math.sqrt(n - 3)
  return { r, n, support, lo: Math.tanh(z - Z90 * se), hi: Math.tanh(z + Z90 * se) }
}

function classify(l: Lean): ReadingState {
  if (l.lo > 0) return 'eros'
  if (l.hi < 0) return 'fordit'
  if (Math.abs(l.support) < FLAT) return 'nincs'
  return l.support > 0 ? 'halvany' : 'halvanyFordit'
}

function thenLean(pair: PatternMonitorPair, pattern: Pattern | null, events: PatternEvent[], dir: 1 | -1): Lean | null {
  if (pattern?.status !== 'confirmed') return null
  if (pair.verdict === 'frozen' && pair.r != null && pair.n != null) return lean(pair.r, pair.n, dir)
  const confirmedAt = [...events].reverse().find((e) => e.kind === 'confirmed')?.occurredAt
  if (!confirmedAt) return null
  const before = events.filter((e) => e.occurredAt <= confirmedAt && e.r != null && e.n != null)
  const last = before[before.length - 1]
  return last ? lean(last.r!, last.n!, dir) : null
}

export function readPattern(
  input: { pair: PatternMonitorPair; pattern: Pattern | null; days: AlignedDay[]; events: PatternEvent[] },
  catalogMinN: number | null,
): Reading {
  const { pair, pattern, days, events } = input
  const plan = pattern?.testPlan ?? null
  const dir: 1 | -1 = (plan?.expectedDirection ?? pair.expectedDirection) === 'negative' ? -1 : 1
  const minN = plan?.minN
    ?? (pair.missingDays != null ? pair.alignedDays + pair.missingDays : null)
    ?? catalogMinN ?? LAST_RESORT_MIN_N
  const dayCount = pair.verdict === 'frozen' ? days.length : Math.max(pair.alignedDays, days.length)
  const base = { minN, dayCount, dir, then: thenLean(pair, pattern, events, dir) }
  const status = pattern?.status

  if (status === 'rejected') return { ...base, state: 'elvetve', now: null }
  if (status === 'refuted') return { ...base, state: 'elengedve', now: null }
  if (status === 'dormant') return { ...base, state: 'pihen', now: null }

  switch (pair.verdict) {
    case 'no_data': return { ...base, state: 'kerdes', now: null }
    case 'degenerate': return { ...base, state: 'allo', now: null }
    case 'few_days':
    case 'imbalanced_groups': return { ...base, state: dayCount === 0 ? 'kerdes' : 'gyulik', now: null }
    case 'live': {
      if (pair.r == null || pair.n == null) return { ...base, state: 'gyulik', now: null }
      const now = lean(pair.r, pair.n, dir)
      return { ...base, state: classify(now), now }
    }
    case 'frozen': {
      if (days.length < minN) return { ...base, state: days.length === 0 ? 'kerdes' : 'gyulik', now: null }
      if (pair.metricAValueKind === 'binary') {
        const per = pair.requiredPerGroup ?? DEFAULT_PER_GROUP
        const ones = days.filter((d) => d.a >= 0.5).length
        if (ones < per || days.length - ones < per) return { ...base, state: 'gyulik', now: null }
      }
      const r = pearson(days)
      if (r == null) return { ...base, state: 'allo', now: null }
      const now = lean(r, days.length, dir)
      return { ...base, state: classify(now), now }
    }
  }
}

export interface AnswerLook { word: string; tone: DetailTone; art: Icon3DName }

const LOOK: Record<ReadingState, AnswerLook> = {
  kerdes: { word: 'Még csak egy kérdés', tone: 'lav', art: 't-quest' },
  gyulik: { word: 'Még gyűjtöm', tone: 'lav', art: 't-clock' },
  allo: { word: 'Nincs mit összevetni', tone: 'mute', art: 't-hold' },
  nincs: { word: 'Nincs összefüggés', tone: 'mute', art: 't-hold' },
  halvany: { word: 'Halvány jel', tone: 'lav', art: 't-lens' },
  halvanyFordit: { word: 'Inkább fordítva', tone: 'sky', art: 't-compare' },
  fordit: { word: 'Épp fordítva', tone: 'sky', art: 't-compare' },
  eros: { word: 'Erős jel', tone: 'gold', art: 't-sprout' },
  elvetve: { word: 'Elvetetted', tone: 'mute', art: 't-skip' },
  elengedve: { word: 'Mezo elengedte', tone: 'mute', art: 't-skip' },
  pihen: { word: 'Pihen', tone: 'mute', art: 't-clock' },
}

export function answerLook(reading: Reading, status: Pattern['status'] | null): AnswerLook {
  if (status === 'confirmed') {
    switch (reading.state) {
      case 'eros': return { word: 'Tartja magát', tone: 'sage', art: 't-tick' }
      case 'halvany': return { word: reading.then ? 'Azóta gyengült' : 'Halvány maradt', tone: 'gold', art: 't-trend' }
      case 'nincs': return { word: 'Az adat nem igazolja', tone: 'gold', art: 't-hold' }
      case 'halvanyFordit':
      case 'fordit': return { word: 'Most ellentmond', tone: 'coral', art: 't-compare' }
      case 'gyulik':
      case 'kerdes': return { word: 'Még alig mért', tone: 'gold', art: 't-clock' }
      default: break
    }
  }
  return LOOK[reading.state]
}

export type DecisionVerb = 'confirm' | 'monitor' | 'reject'
export interface DecisionPlan {
  buttons: { verb: DecisionVerb; label: string; recommended: boolean }[]
  /** A megerősített, tartó minta csak egy halk „visszavonom" linket kap. */
  revokeLink: boolean
  /** Az ajánlás egy mondatban („**Ajánlom elvetni:** …"), `**` = félkövér. */
  note: string | null
  /** A már eldőlt állapot sora (pl. „Bekerült a Tudástárba…"). */
  settled: string | null
}

export function decisionPlan(reading: Reading, status: Pattern['status'] | null): DecisionPlan {
  const b = (verb: DecisionVerb, label: string, recommended: boolean) => ({ verb, label, recommended })
  const watching = status === 'monitoring'
  const watch = watching ? 'Figyeljük tovább' : 'Figyeljük'
  if (status === 'confirmed') {
    if (reading.state === 'eros') {
      return { buttons: [], revokeLink: true, note: null, settled: 'Bekerült a Tudástárba, Mezo számol vele.' }
    }
    const against = reading.state === 'nincs' || reading.state === 'fordit' || reading.state === 'halvanyFordit'
    return {
      buttons: [b('reject', 'Visszavonom', against)], revokeLink: false, settled: null,
      note: against
        ? `**Ajánlom a visszavonást:** Mezo ezt tényként kezeli, pedig ${reading.state === 'nincs' ? 'az adat nem igazolja' : 'az adat most az ellenkezőjét mutatja'}.`
        : reading.state === 'gyulik' || reading.state === 'kerdes'
          ? `**Maradhat:** ha ${reading.minN} napnál sem igazolódik, szólok.`
          : '**Maradhat:** még a jó irányba mutat, csak gyengébben. Szólok, ha megfordul.',
    }
  }
  if (status === 'rejected' || status === 'refuted' || status === 'dormant') {
    return { buttons: [b('monitor', 'Mégis figyeljük', false)], revokeLink: false, note: null, settled: null }
  }
  switch (reading.state) {
    case 'gyulik': return { buttons: [b('monitor', watch, false), b('reject', 'Elvetem', false)], revokeLink: false, settled: null,
      note: `**Nincs teendőd:** szólok, amikor megvan a ${reading.minN}. nap.` }
    case 'kerdes': return { buttons: [b('monitor', watch, !watching), b('reject', 'Elvetem', false)], revokeLink: false, settled: null,
      note: '**Ha érdekel, figyeljük:** a napjaidból magától gyűlik.' }
    case 'allo': return { buttons: [b('monitor', watch, false), b('reject', 'Elvetem', false)], revokeLink: false, settled: null,
      note: '**Várjunk:** amíg az egyik adat áll, nincs mit eldönteni.' }
    case 'nincs': return { buttons: [b('reject', 'Elvetem', true), b('monitor', watching ? 'Figyeljük tovább' : 'Figyeljük még', false)], revokeLink: false, settled: null,
      note: `**Ajánlom elvetni:** ${reading.dayCount} nap után sem látszik semmi.` }
    case 'halvany': return { buttons: [b('monitor', watching ? 'Figyeljük tovább' : 'Figyeljük még', true), b('reject', 'Elvetem', false)], revokeLink: false, settled: null,
      note: '**Ajánlom figyelni:** jó irányba mutat, pár nap még eldöntheti.' }
    case 'halvanyFordit': return { buttons: [b('reject', 'Elvetem', true), b('monitor', watching ? 'Figyeljük tovább' : 'Figyeljük még', false)], revokeLink: false, settled: null,
      note: '**Ajánlom elvetni:** a várt irány nem jön ki, inkább az ellenkezője.' }
    case 'fordit': return { buttons: [b('reject', 'Elvetem', true), b('monitor', watching ? 'Figyeljük tovább' : 'Figyeljük még', false)], revokeLink: false, settled: null,
      note: '**Ajánlom elvetni:** sok nap után is az ellenkezője igaz.' }
    case 'eros': return { buttons: [b('confirm', 'Megerősítem', true), b('monitor', watch, false)], revokeLink: false, settled: null,
      note: '**Ajánlom megerősíteni:** bekerül a Tudástárba, és Mezo számolhat vele.' }
    default: return { buttons: [], revokeLink: false, note: null, settled: null }
  }
}

export function patternZones(days: AlignedDay[], binary: boolean): [AlignedDay[], AlignedDay[]] {
  if (binary) return [days.filter((d) => d.a < 0.5), days.filter((d) => d.a >= 0.5)]
  const sorted = [...days].sort((x, y) => x.a - y.a)
  const k = Math.ceil(sorted.length / 2)
  return [sorted.slice(0, k), sorted.slice(k)]
}

export function niceTicks(lo: number, hi: number, clock: boolean, count = 3): number[] {
  let step: number
  if (clock) step = hi - lo > 1.6 ? 1 : 0.5
  else {
    const raw = (hi - lo) / count || 1
    const p = 10 ** Math.floor(Math.log10(raw))
    const m = raw / p
    step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p
  }
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(4)))
  return out
}

export const mean = (days: AlignedDay[]) => days.reduce((s, d) => s + d.b, 0) / (days.length || 1)
export const az = (word: string): 'a' | 'az' => (/^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const hu1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',')

/** Zóna-átlag kiírva: óra-metrikán „20:39", egyébként egy tizedes vesszővel. */
export function zoneValue(pair: PatternMonitorPair, value: number): string {
  return pair.metricBValueKind === 'clock_hour' ? formatMetricValue(pair.metricBKey, value) : hu1(value)
}

export function saySentence(reading: Reading, pair: PatternMonitorPair, days: AlignedDay[],
  status: Pattern['status'] | null): string {
  const A = pair.metricALabel
  const B = pair.metricBLabel
  switch (reading.state) {
    case 'kerdes':
      return `Még nincs egy közös nap sem. Ahogy ${az(A)} **${A}** és ${az(B)} **${B}** napjai összegyűlnek, számolni kezdem.`
    case 'gyulik':
      if (status === 'confirmed') {
        return `Megerősítetted, de eddig csak **${reading.dayCount} közös nap** van. ${reading.minN} nap kell, hogy az adat is mondjon valamit.`
      }
      if (pair.verdict === 'imbalanced_groups') return groupBalanceSentence(pair)
      return `**${reading.dayCount} közös nap** van a ${reading.minN}-ból. Addig nem mondok irányt: ennyi napból bármi kijöhetne.`
    case 'allo': {
      const label = pair.bottleneckMetricKey ? bottleneckLabel(pair) : B
      return `${cap(az(label))} **${label}** a vizsgált napokon mindig ugyanannyi volt, így nincs mit összevetni. Ha mozdul, újra számolok.`
    }
    case 'elvetve': return 'Elvetetted, ezért ezt már nem számolom tovább.'
    case 'elengedve': return 'Az adat többször egymás után ellentmondott ennek, ezért Mezo elengedte.'
    case 'pihen': return 'Régóta nincs elég adat a teszteléséhez. Ha újra lesz, magától felébred.'
    default: break
  }
  const binary = pair.metricAValueKind === 'binary'
  const [z0, z1] = patternZones(days, binary)
  const n = reading.now?.n ?? days.length
  let base: string
  if (reading.state === 'nincs' || z0.length === 0 || z1.length === 0) {
    base = 'A kétféle nap átlaga között kicsi a különbség, és nem is következetes.'
  } else {
    const who = binary
      ? cap(binaryGroupLabels(pair.metricAKey).one.axis)
      : `Amikor ${az(A)} ${A} ${pair.metricAValueKind === 'clock_hour' ? 'később' : 'magasabb'} volt,`
    base = `${who} ${az(B)} ${B} átlagosan **${zoneValue(pair, mean(z1))}** volt, a többi napon **${zoneValue(pair, mean(z0))}**.`
  }
  const tail: Partial<Record<ReadingState, string>> = {
    nincs: ` ${n} nap alatt nem rajzolódik ki kapcsolat.`,
    halvany: ` Ez a várt irány, de ${n} napból még a véletlen is kihozhatja.`,
    halvanyFordit: ` Ez épp a várttal ellentétes, bár ${n} napból még lehet véletlen.`,
    fordit: ` Ez a várttal **ellentétes**, és ${n} nap után már nem valószínű, hogy véletlen.`,
    eros: ` ${n} nap után ez már nem valószínű, hogy véletlen.`,
  }
  return base + (tail[reading.state] ?? '')
}

function lagWord(lagDays: number): string {
  if (lagDays === 0) return 'aznap'
  if (lagDays === 1) return 'másnap'
  return `${lagDays} nappal később`
}

export function ruleSentence(pair: PatternMonitorPair, plan: PatternTestPlan | null): string {
  const A = plan?.seriesALabel ?? pair.metricALabel
  const B = plan?.seriesBLabel ?? pair.metricBLabel
  const up = (plan?.expectedDirection ?? pair.expectedDirection) === 'positive'
  const lag = lagWord(plan?.lagDays ?? pair.lagDays)
  const bWord = pair.metricBValueKind === 'clock_hour' ? (up ? 'később van' : 'korábban van') : (up ? 'magasabb' : 'alacsonyabb')
  if (pair.metricAValueKind === 'binary') {
    return `${cap(binaryGroupLabels(pair.metricAKey).one.axis)} ${lag} ${az(B)} **${B}** ${bWord}.`
  }
  const aWord = pair.metricAValueKind === 'clock_hour' ? 'később van' : 'magasabb'
  return `Ha **${az(A)} ${A}** ${aWord}, ${lag} **${az(B)} ${B}** ${bWord}.`
}
