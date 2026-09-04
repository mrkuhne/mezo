import type { PatternMonitorPair } from '@/data/types'

/**
 * A Motor kártya „Amit eddig látunk" mondatának determinisztikus kompozíciója (mezo-fj1g):
 * páronként kézzel írt irány-olvasatok + {erősség} behelyettesítés + p-fordítás magyarra.
 * Tisztán pure — a statisztika SOHA nem állít többet, mint amit a számok fednek.
 */

/** |r| → hétköznapi erősség-határozó (a {erősség} slot értéke). */
export function strengthWord(r: number): string {
  const abs = Math.abs(r)
  return abs < 0.3 ? 'kicsit' : abs < 0.6 ? 'érezhetően' : 'határozottan'
}

export interface FindingSentence {
  /** Explicitly separates the hypothesis from the direction visible in today's evidence. */
  prefix: 'Eddig ebbe az irányba mutatnak a napjaid:' | 'Eddig az ellenkezője látszik:'
  /** Az írott olvasat a {erősség} slot ELŐTTI része. */
  before: string
  /** A behelyettesített erősség-szó (a UI félkövérrel emeli ki). */
  strength: string
  /** Az olvasat a slot UTÁNI része. */
  after: string
}

/** Az élő/fagyasztott lelet-mondat darabjai — null, ha nincs r (nem élő pár). */
export function findingSentence(pair: PatternMonitorPair): FindingSentence | null {
  if (pair.r == null) return null
  const found = pair.r >= 0 ? 'positive' : 'negative'
  const reading = found === 'positive' ? pair.whenPositiveHu : pair.whenNegativeHu
  const [before, after = ''] = reading.split('{erősség}')
  return {
    prefix: found === pair.expectedDirection
      ? 'Eddig ebbe az irányba mutatnak a napjaid:'
      : 'Eddig az ellenkezője látszik:',
    before,
    strength: strengthWord(pair.r),
    after,
  }
}

export interface ConfidenceMeta {
  chip: 'megbízható jel' | 'ígéretes jel' | 'még bizonytalan'
  tone: 'success' | 'accent' | 'warning'
  /** „{n} közös nap — {p emberi fordítása}" */
  sentence: string
}

/** p + n → bizonyosság-chip és őszinte magyar meta-mondat. */
export function confidenceMeta(n: number, p: number): ConfidenceMeta {
  const days = `${n} közös nap`
  if (p <= 0.05) {
    return {
      chip: 'megbízható jel',
      tone: 'success',
      sentence: `${days} — erősebb bizonyíték; ez már kevésbé magyarázható véletlennel`,
    }
  }
  if (p <= 0.15) {
    return {
      chip: 'ígéretes jel',
      tone: 'accent',
      sentence: `${days} — ígéretes irány, de még gyűlik az adat`,
    }
  }
  return {
    chip: 'még bizonytalan',
    tone: 'warning',
    sentence: `${days} — bizonytalan jel; ebből még nem érdemes következtetést levonni`,
  }
}

/** A cím alatti halvány pár-sor: „esti lezárás ↔ másnapi alvásminőség". */
export function pairLine(pair: PatternMonitorPair): string {
  return `${pair.metricALabel} ↔ ${pair.lagDays > 0 ? 'másnapi ' : ''}${pair.metricBLabel}`
}
