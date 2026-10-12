// ============================================================
// Mezo · pantryProvenance (Fuel Titanium S4, mezo-hygp; Folyadék F5, mezo-n4wf5.5)
// EGY kamra-tétel EREDETE: honnan jött és mikor.
//
// MIÉRT LÉTEZIK: a B14 owner-DROP kivette a „Legutóbbi importok" feedet — az import-rekord
// továbbra is íródik, de a per-tétel eredet a TÉTEL részletlapján él, a forrás-kártyán. Ez a
// modul fordítja a tárolt tényeket (a `source` kulcs és a `scrapedAt` pillanat) emberi
// szöveggé, hogy a listacsempe és a részletlap ugyanazt mondja.
//
// NYELV: a szerver csak ADATOT ad (forrás-kulcs, ISO-időpont) — a felirat és a dátum itt készül,
// HÍVÁSKOR (`m()` + `shared/lib/format`), ezért egy eredményt sosem szabad modul-konstansba vagy
// memóba tenni. ŐSZINTE-NULL: ha a tétel nem hordoz időpontot, `when` null — nem gyártunk dátumot.
// Pure: nincs React, nincs ambient idő (a logic/ réteg szabálya).
// ============================================================
import type { PantryItem } from '@/data/types'
import { pantrySources, type PantrySourceKey } from '@/data/pantrySources'
import type { Icon3DName } from '@/shared/ui/clay'
import { m } from '@/shared/i18n'
import { fmtDate, fmtDateTime } from '@/shared/lib/format'

/** A felvétel MÓDJA, a forrás-kulcsból: fotó · link · katalógus (minden nevesített bolt) · kézi. */
export type PantryCaptureKind = 'photo' | 'link' | 'catalogue' | 'manual'

const CAPTURE: Record<PantrySourceKey, PantryCaptureKind> = {
  photo: 'photo',
  web: 'link',
  openfoodfacts: 'link',
  manual: 'manual',
  'kifli.hu': 'catalogue',
  'myprotein.hu': 'catalogue',
  'tesco.hu': 'catalogue',
  'auchan.hu': 'catalogue',
  'gymbeam.hu': 'catalogue',
  lidl: 'catalogue',
  nutriversum: 'catalogue',
  herbahaz: 'catalogue',
  nutrifit: 'catalogue',
  decathlon: 'catalogue',
}

const ICON: Record<PantryCaptureKind, Icon3DName> = {
  photo: 't-camera',
  link: 't-link',
  catalogue: 't-stack',
  manual: 't-journal',
}

export interface PantryProvenance {
  /** The capture mode as a key. */
  kind: PantryCaptureKind
  /** „fotó" · „link" · „katalógus" · „kézi" — the capture mode in the current language. */
  kindLabel: string
  /** A konkrét forrás neve („kifli.hu", „Saját bevitel", …). */
  sourceLabel: string
  /** Mikor került a polcra — `null`, ha a tétel nem hordoz időpontot (nem találgatunk). */
  when: string | null
  icon: Icon3DName
}

/** A forrás neve: a két szó („Saját bevitel", „Fotó") a katalógusból, a boltnevek tulajdonnevek. */
export function pantrySourceLabel(source: PantrySourceKey | null | undefined): string {
  const key = source != null && source in pantrySources ? source : 'manual'
  if (key === 'manual' || key === 'photo') return m().fuelKamra.source[key]
  return pantrySources[key].label
}

const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/

/** Az ISO-időpont a nyelv szerinti dátummal és az órával („máj. 20. · 09:14" / "20 May · 09:14", `format.ts`). Zóna nélküli
 *  falióra a saját számjegyeit írja ki. Ami nem ISO, az változatlanul megy ki (régi, kész szöveget hordozó sor). */
export function pantryWhen(scrapedAt: string | null | undefined): string | null {
  const raw = scrapedAt?.trim()
  if (!raw) return null
  if (!ISO_MOMENT.test(raw)) return raw
  return raw.length > 10 ? fmtDateTime(raw) : fmtDate(raw, 'short')
}

export function pantryProvenance(item: Pick<PantryItem, 'source' | 'scrapedAt'>): PantryProvenance {
  const kind = CAPTURE[item.source] ?? 'manual'
  return {
    kind,
    kindLabel: m().fuelKamra.capture[kind],
    sourceLabel: pantrySourceLabel(item.source),
    when: pantryWhen(item.scrapedAt),
    icon: ICON[kind],
  }
}
