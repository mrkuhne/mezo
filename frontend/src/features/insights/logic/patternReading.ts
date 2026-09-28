// ============================================================
// Mezo · patternReading — a minta-részlet oldal EGY olvasata (mezo-rstt7, prototypes/uveg-minta.html).
// {pair, pattern, days, events} → állapot + a „merre húz" mérő mostani és megerősítéskori
// helyzete. A mérő sávja 90%-os Fisher-z intervallum, a feltevés SAJÁT irányába fordítva:
// jobbra mindig az „igaz rád". Tiszta függvények: az oldal minden szava és színe innen jön.
// ============================================================
import type {
  AlignedDay, Pattern, PatternEvent, PatternMetricValueKind, PatternMonitorPair, PatternTestPlan,
} from '@/data/types'
import type { DetailTone } from '@/features/insights/components/DetailHero'
import type { Icon3DName } from '@/shared/ui/clay'
import { binaryGroupLabels } from '@/features/insights/logic/metricFormat'
import { bottleneckLabel } from '@/features/insights/logic/verdicts'

export type ReadingState =
  | 'kerdes' | 'gyulik' | 'allo' | 'nincs' | 'halvany' | 'halvanyFordit' | 'fordit' | 'eros'
  | 'elvetve' | 'elengedve' | 'pihen'

export interface Lean { r: number; n: number; support: number; lo: number; hi: number }
/** Bináris (csoportos) pár két csoportjának napszáma és a csoportonkénti minimum. */
export interface GroupCounts { zero: number; one: number; perGroup: number }
export interface Reading {
  state: ReadingState
  now: Lean | null
  then: Lean | null
  minN: number
  dayCount: number
  dir: 1 | -1
  /** Csak bináris párnál nem-null: a két csoport napszáma (a `days`-ből, üres `days` esetén a kapu számaiból). */
  groups: GroupCounts | null
  /** Gyűjtés közben az egyik csoport még a minimum alatt van (vagy a kapu `imbalanced_groups`-ot mond):
   *  ilyenkor a `minN` sehol nem hivatkozható, és nincsenek nap-pipák — a csoport-egyensúly a hír. */
  groupsShort: boolean
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

function groupCounts(pair: PatternMonitorPair, days: AlignedDay[]): GroupCounts | null {
  if (pair.metricAValueKind !== 'binary') return null
  const perGroup = pair.requiredPerGroup ?? DEFAULT_PER_GROUP
  if (days.length > 0) {
    const one = days.filter((d) => d.a >= 0.5).length
    return { zero: days.length - one, one, perGroup }
  }
  return { zero: pair.groupZeroDays ?? 0, one: pair.groupOneDays ?? 0, perGroup }
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
  const groups = groupCounts(pair, days)
  const base = { minN, dayCount, dir, then: thenLean(pair, pattern, events, dir), groups, groupsShort: false }
  const status = pattern?.status
  const gathering = (): Reading => ({
    ...base, state: 'gyulik', now: null,
    groupsShort: groups != null && (pair.verdict === 'imbalanced_groups'
      || groups.zero < groups.perGroup || groups.one < groups.perGroup),
  })

  if (status === 'rejected') return { ...base, state: 'elvetve', now: null }
  if (status === 'refuted') return { ...base, state: 'elengedve', now: null }
  if (status === 'dormant') return { ...base, state: 'pihen', now: null }

  switch (pair.verdict) {
    case 'no_data': return { ...base, state: 'kerdes', now: null }
    case 'degenerate': return { ...base, state: 'allo', now: null }
    case 'few_days':
    case 'imbalanced_groups': return dayCount === 0 ? { ...base, state: 'kerdes', now: null } : gathering()
    case 'live': {
      if (pair.r == null || pair.n == null) return gathering()
      const now = lean(pair.r, pair.n, dir)
      return { ...base, state: classify(now), now }
    }
    case 'frozen': {
      if (days.length === 0) return { ...base, state: 'kerdes', now: null }
      if (days.length < minN) return gathering()
      if (groups && (groups.zero < groups.perGroup || groups.one < groups.perGroup)) return gathering()
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

/** A megerősített, halvány minta csak akkor „gyengült", ha a mostani támogatás tényleg kisebb a döntéskorinál. */
function weakened(reading: Reading): boolean {
  return reading.then != null && reading.now != null && reading.now.support < reading.then.support
}

/** A „merre húz" mérő kiemelt oldala az olvasat állapotából (0 = fordítva, 1 = nincs hatás, 2 = igaz rád). */
export function leanSide(state: ReadingState): 0 | 1 | 2 {
  if (state === 'eros' || state === 'halvany') return 2
  if (state === 'fordit' || state === 'halvanyFordit') return 0
  return 1
}

/** Egy önálló `Lean` oldala (pl. a megerősítéskori állás) — ugyanazzal az osztályozással, mint az olvasat. */
export function leanSideOf(l: Lean): 0 | 1 | 2 {
  return leanSide(classify(l))
}

export function answerLook(reading: Reading, status: Pattern['status'] | null): AnswerLook {
  if (status === 'confirmed') {
    switch (reading.state) {
      case 'eros': return { word: 'Tartja magát', tone: 'sage', art: 't-tick' }
      case 'halvany': return { word: weakened(reading) ? 'Azóta gyengült' : 'Halvány maradt', tone: 'gold', art: 't-trend' }
      case 'nincs': return { word: 'Az adat nem igazolja', tone: 'gold', art: 't-hold' }
      case 'halvanyFordit':
      case 'fordit': return { word: 'Most ellentmond', tone: 'coral', art: 't-compare' }
      case 'gyulik':
        if (reading.groupsShort && reading.dayCount >= reading.minN) {
          return { word: 'Kevés az egyik fajta nap', tone: 'gold', art: 't-clock' }
        }
        return { word: 'Még alig mért', tone: 'gold', art: 't-clock' }
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
    let note: string
    if (against) {
      note = `**Ajánlom a visszavonást:** Mezo ezt tényként kezeli, pedig ${reading.state === 'nincs' ? 'az adat nem igazolja' : 'az adat most az ellenkezőjét mutatja'}.`
    } else if (reading.state === 'allo') {
      note = '**Várjunk:** amíg az egyik adat áll, nincs mit eldönteni.'
    } else if (reading.state === 'gyulik' && reading.groupsShort) {
      note = '**Maradhat:** szólok, ha mindkét fajta napból lesz elég, és nem igazolódik.'
    } else if (reading.state === 'gyulik' || reading.state === 'kerdes') {
      note = `**Maradhat:** ha ${reading.minN} napnál sem igazolódik, szólok.`
    } else if (weakened(reading)) {
      note = '**Maradhat:** még a jó irányba mutat, csak gyengébben. Szólok, ha megfordul.'
    } else {
      note = '**Maradhat:** a jó irányba mutat, de még halványan. Szólok, ha megfordul.'
    }
    return { buttons: [b('reject', 'Visszavonom', against)], revokeLink: false, settled: null, note }
  }
  if (status === 'rejected' || status === 'refuted' || status === 'dormant') {
    return { buttons: [b('monitor', 'Mégis figyeljük', false)], revokeLink: false, note: null, settled: null }
  }
  switch (reading.state) {
    case 'gyulik': return { buttons: [b('monitor', watch, false), b('reject', 'Elvetem', false)], revokeLink: false, settled: null,
      note: reading.groupsShort && reading.groups
        ? `**Nincs teendőd:** szólok, amikor mindkét fajta napból megvan a ${reading.groups.perGroup}.`
        : `**Nincs teendőd:** szólok, amikor megvan a ${reading.minN}. nap.` }
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

/** A két zóna. Számos A-nál a vágás mindig két KÜLÖNBÖZŐ A-érték közé esik (egyforma napok sosem
 *  kerülnek két zónába): a lehetséges vágások közül a felezőhöz legközelebbi, döntetlennél az alsó.
 *  Ha minden A egyforma, a második zóna üres. */
export function patternZones(days: AlignedDay[], binary: boolean): [AlignedDay[], AlignedDay[]] {
  if (binary) return [days.filter((d) => d.a < 0.5), days.filter((d) => d.a >= 0.5)]
  const sorted = [...days].sort((x, y) => x.a - y.a)
  const half = sorted.length / 2
  let cut = -1
  for (let k = 1; k < sorted.length; k++) {
    if (sorted[k - 1].a === sorted[k].a) continue
    if (cut < 0 || Math.abs(k - half) < Math.abs(cut - half)) cut = k
  }
  if (cut < 0) return [sorted, []]
  return [sorted.slice(0, cut), sorted.slice(cut)]
}

const CLOCK_STEPS = [0.5, 1, 2, 3, 4, 6]

export function niceTicks(lo: number, hi: number, clock: boolean, count = 3): number[] {
  let step: number
  if (clock) {
    // az óra-lépés is tartja a `count`-ot: a legkisebb lépés, amivel legfeljebb count+1 jel lesz
    const ticksFor = (s: number) => Math.floor(hi / s + 1e-9) - Math.ceil(lo / s - 1e-9) + 1
    step = CLOCK_STEPS.find((s) => ticksFor(s) <= count + 1) ?? CLOCK_STEPS[CLOCK_STEPS.length - 1]
  } else {
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
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** A minta-részlet EGYETLEN érték-formázója — a drót értékfajtája (`valueKind`) dönt, nem egy
 *  kulcslista, így a katalóguson kívüli (pl. reflexiós) óra-széria is „01:30"-at mond.
 *  `clock_hour` ⇒ ÓÓ:PP (percre kerekítve, 24-gyel visszahajtva, mint a `formatMetricValue`),
 *  `binary` ⇒ igen/nem, egyébként egy tizedes vesszővel („7,4", egész szám tizedes nélkül);
 *  `fixed` = mindig egy tizedes („6,0") — a zóna-átlagok így olvasnak átlagnak. Zóna-átlag,
 *  tengely, tooltip, pötty-címke és a napok táblája mind ezt használja. */
export function formatSeriesValue(kind: PatternMetricValueKind, value: number, fixed = false): string {
  if (kind === 'clock_hour') {
    const totalMin = Math.round(value * 60)
    const h = Math.floor(totalMin / 60) % 24
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  if (kind === 'binary') return value >= 0.5 ? 'igen' : 'nem'
  const r = Math.round(value * 10) / 10
  return (fixed ? r.toFixed(1) : String(r)).replace('.', ',')
}

/** A csoport-egyensúly mondata, a napok számából — a befagyott soron is működik (ott a kapu nem
 *  ad csoportszámot). Sosem hivatkozik a `minN`-re. */
function groupSentence(g: GroupCounts, pair: PatternMonitorPair): string {
  const labels = binaryGroupLabels(pair.metricAKey)
  const zero = { count: g.zero, day: labels.zero.day }
  const one = { count: g.one, day: labels.one.day }
  const per = g.perGroup
  let first: string
  const [more, less] = zero.count >= one.count ? [zero, one] : [one, zero]
  if (more.count >= per && less.count === 0) first = `**${more.count}** ${more.day} nap mellett még egy ${less.day} nap sincs.`
  else if (more.count >= per) first = `**${more.count}** ${more.day} nap mellett még csak **${less.count}** ${less.day} nap van.`
  else first = `Eddig **${zero.count}** ${zero.day} és **${one.count}** ${one.day} nap van.`
  return `${first} Mindkét fajta napból legalább ${per} kell, mielőtt irányt mondok.`
}

/** Melyik metrika áll? A kapu megmondja (`bottleneckMetricKey`); a befagyott sornál a napokból
 *  döntjük el: amelyik oldal szórása nulla. */
function flatLabel(pair: PatternMonitorPair, days: AlignedDay[]): string {
  if (pair.bottleneckMetricKey) return bottleneckLabel(pair)
  const flat = (vals: number[]) => vals.length > 0 && vals.every((v) => v === vals[0])
  if (flat(days.map((d) => d.a)) && !flat(days.map((d) => d.b))) return pair.metricALabel
  return pair.metricBLabel
}

/** Zóna-átlag kiírva: óra-metrikán „20:39", egyébként mindig egy tizedes vesszővel. */
export function zoneValue(pair: PatternMonitorPair, value: number): string {
  return formatSeriesValue(pair.metricBValueKind, value, true)
}

export function saySentence(reading: Reading, pair: PatternMonitorPair, days: AlignedDay[],
  status: Pattern['status'] | null): string {
  const A = pair.metricALabel
  const B = pair.metricBLabel
  switch (reading.state) {
    case 'kerdes':
      return `Még nincs egy közös nap sem. Ahogy ${az(A)} **${A}** és ${az(B)} **${B}** napjai összegyűlnek, számolni kezdem.`
    case 'gyulik':
      if (reading.groupsShort && reading.groups) {
        return `${status === 'confirmed' ? 'Megerősítetted. ' : ''}${groupSentence(reading.groups, pair)}`
      }
      if (status === 'confirmed') {
        return `Megerősítetted, de eddig csak **${reading.dayCount} közös nap** van. ${reading.minN} nap kell, hogy az adat is mondjon valamit.`
      }
      return `**${reading.dayCount} közös nap** van a ${reading.minN}-ból. Addig nem mondok irányt: ennyi napból bármi kijöhetne.`
    case 'allo': {
      const label = flatLabel(pair, days)
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
  } else if (binary) {
    const { zero, one } = binaryGroupLabels(pair.metricAKey)
    base = `${cap(az(one.day))} ${one.day} napokon ${az(B)} ${B} átlagosan **${zoneValue(pair, mean(z1))}** volt, `
      + `${az(zero.day)} ${zero.day} napokon **${zoneValue(pair, mean(z0))}**.`
  } else {
    const who = `Amikor ${az(A)} ${A} ${pair.metricAValueKind === 'clock_hour' ? 'később' : 'magasabb'} volt,`
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

/** Mikor nézzük a hatást — köznyelven, kód-eltolás nélkül. */
export function lagWord(lagDays: number): string {
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
    const one = binaryGroupLabels(pair.metricAKey).one.day
    return `${cap(az(one))} ${one} napokon ${lag} ${az(B)} **${B}** ${bWord}.`
  }
  const aWord = pair.metricAValueKind === 'clock_hour' ? 'később van' : 'magasabb'
  return `Ha **${az(A)} ${A}** ${aWord}, ${lag} **${az(B)} ${B}** ${bWord}.`
}
