// ============================================================
// Mezo · stackBands — a mai kiegészítő-lista IDŐSÁV-modellje (Fuel Titanium S2, mezo-g2vl;
// fagyasztott manifeszt D1: ma + pipa + visszavonás, a hub és a mai oldal ÖSSZEVONÁSA).
//
// Owner-döntés: a mai lista idősávok szerint csoportosul, egyérintéses pipálással — ez a
// főszereplő. A nyolc produkciós stack-zóna (`STACK_ZONE_ORDER`: ébredés → lefekvés) túl finom
// felbontás egy átlátható listához, ezért a projekció időzített sávjait a PRODUKCIÓS
// napszak-modellbe (`ZONE_KEYS` / `ZONE_LABELS`, mezo-rrtj) csoportosítjuk: reggel · dél ·
// délután · este. Se kulcsot, se feliratot nem találunk ki — párhuzamos szótár nem nyílik.
//
// A sávhatárok ugyanúgy a felkelés→lefekvés SZAKASZ törtrészei (`ZONE_FRACTIONS`), ahogy a Mai
// oldal napszakjainál (`buildDayZones`): a korán kelő és az éjszakai bagoly is értelmes sávokat
// kap. Az ankerek injektáltak — ebben a modulban nincs környezeti idő.
//
// Őszinte-null: adag nélküli tételnél nincs kitalált mennyiség, és időbélyeg nélküli bevételnél
// (a mock intake-sor üres `takenAt`-et hoz) nincs kitalált időpont.
// ============================================================
import {
  ZONE_FRACTIONS, ZONE_KEYS, ZONE_LABELS, daySpan, unwrapDayMinute, type ZoneKeyName,
} from '@/data/fuel/fuelConfig'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'
import type { Intake } from '@/data/fuel/fuelApi'

export type BandKey = ZoneKeyName

export interface BandRow {
  /** A Kamra-tétel azonosítója — a pipa/visszavonás ezzel + a zónával kulcsol. */
  itemId: string
  occurrenceId: string
  name: string
  /** Őszinte-null: a protokoll-tételnek nem biztos, hogy van adagja. */
  dose: string | null
  taken: boolean
  /** A bevétel ideje `HH:mm`-ben, ha a naplósor hordoz időbélyeget — különben null. */
  takenAtHHmm: string | null
  /** A sáv melyik zónájából jött a sor (a részletező és az ikon ezt használja). */
  zone: StackDaySlot['zone']
  zoneLabel: string
  time: string
  /** A teljes projekciós bejegyzés — a pipálás és a részletező kártya ezt kapja. */
  entry: StackDayEntry
}

export interface StackBand {
  key: BandKey
  label: string
  rows: BandRow[]
  doneCount: number
}

export interface BandAnchors {
  wake: string
  bed: string
}

/** A naplósor ideje `HH:mm`-ben — üres/érvénytelen időbélyegnél null (őszinte-null). */
function takenAtHHmm(takenAt: string | null | undefined): string | null {
  if (!takenAt) return null
  const at = new Date(takenAt)
  if (Number.isNaN(at.getTime())) return null
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/**
 * A nap időzített stack-slotjait napszak-sávokba csoportosítja. A ma KIMARADÓ (rest-day `skip`)
 * bejegyzés nem kerül sávba: ma nincs mit bevenni belőle, és egy letiltott sor csak zajt vinne a
 * listába. Üres sáv nem jelenik meg.
 */
export function groupStackByBand(
  slots: StackDaySlot[],
  intakes: Intake[],
  anchors: BandAnchors,
): StackBand[] {
  const { wakeMin, span, crossesMidnight } = daySpan(anchors.wake, anchors.bed)
  const bandOf = (time: string): BandKey => {
    const minute = unwrapDayMinute(time, wakeMin, crossesMidnight)
    const frac = Math.min(1, Math.max(0, (minute - wakeMin) / span))
    let key: BandKey = ZONE_KEYS[0]
    for (const candidate of ZONE_KEYS) if (frac >= ZONE_FRACTIONS[candidate]) key = candidate
    return key
  }

  const rowsByBand = new Map<BandKey, BandRow[]>()
  for (const slot of slots) {
    const key = bandOf(slot.time)
    for (const entry of slot.entries) {
      if (entry.skippedToday) continue
      const row: BandRow = {
        itemId: entry.pantryItemId,
        occurrenceId: entry.occurrenceId,
        name: entry.name,
        dose: entry.dose,
        taken: entry.taken,
        takenAtHHmm: entry.taken
          ? takenAtHHmm(intakes.find(i => i.pantryItemId === entry.pantryItemId
            && (i.slotKey === entry.persistedZone || i.slotKey === null))?.takenAt)
          : null,
        zone: slot.zone,
        zoneLabel: slot.label,
        time: slot.time,
        entry,
      }
      const list = rowsByBand.get(key) ?? []
      list.push(row)
      rowsByBand.set(key, list)
    }
  }

  return ZONE_KEYS.filter(key => (rowsByBand.get(key)?.length ?? 0) > 0).map(key => {
    const rows = rowsByBand.get(key) as BandRow[]
    return { key, label: ZONE_LABELS[key], rows, doneCount: rows.filter(row => row.taken).length }
  })
}

/**
 * A „most esedékes" sáv a legkorábbi BE NEM FEJEZETT sáv — nem egyszerűen az aktuális óra sávja:
 * egy elmaradt reggeli bevétel délben is az esedékes, különben a lista elhallgatná. Minden sáv
 * kész → null.
 */
export function nextDueBand(bands: StackBand[]): BandKey | null {
  return bands.find(band => band.doneCount < band.rows.length)?.key ?? null
}
