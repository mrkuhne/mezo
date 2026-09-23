// ============================================================
// Mezo · pantryProvenance (Fuel Titanium S4, mezo-hygp)
// EGY kamra-tétel EREDETE: honnan jött és mikor.
//
// MIÉRT LÉTEZIK: a B14 owner-DROP kivette a „Legutóbbi importok" feedet — az import-rekord
// továbbra is íródik, de a per-tétel eredet a TÉTEL részletlapján él, a forrás-kártyán. Ez a
// modul fordítja a tárolt tényeket (a `source` kulcs és a `scrapedAt` pillanat) emberi
// mondattá, hogy a listacsempe és a részletlap ugyanazt mondja.
//
// ŐSZINTE-NULL: ha a tétel nem hordoz időpontot, akkor „nincs rögzítve" — nem gyártunk dátumot.
// Pure: nincs React, nincs ambient idő (a logic/ réteg szabálya).
// ============================================================
import type { PantryItem } from '@/data/types'
import { pantrySources, type PantrySourceKey } from '@/data/pantrySources'
import type { Icon3DName } from '@/shared/ui/clay'

/** A felvétel MÓDJA, a forrás-kulcsból — ezt a szót keresi az ember a kártyán. */
export type PantryCaptureKind = 'fotó' | 'link' | 'katalógus' | 'kézi'

const CAPTURE: Record<PantrySourceKey, PantryCaptureKind> = {
  photo: 'fotó',
  web: 'link',
  openfoodfacts: 'link',
  manual: 'kézi',
  'kifli.hu': 'katalógus',
  'myprotein.hu': 'katalógus',
  'tesco.hu': 'katalógus',
  'auchan.hu': 'katalógus',
  'gymbeam.hu': 'katalógus',
  lidl: 'katalógus',
  nutriversum: 'katalógus',
  herbahaz: 'katalógus',
  nutrifit: 'katalógus',
  decathlon: 'katalógus',
}

/** Üveg (mezo-me75u.2): the 3D content set — fotó = camera, link = chain, katalógus = the shelf
 *  stack, kézi = the journal (prototypes/uveg-fuel-tobbi.html). */
const ICON: Record<PantryCaptureKind, Icon3DName> = {
  'fotó': 't-camera',
  link: 't-link',
  'katalógus': 't-stack',
  'kézi': 't-journal',
}

export interface PantryProvenance {
  /** „fotó" · „link" · „katalógus" · „kézi" — a felvétel módja. */
  kind: PantryCaptureKind
  /** A konkrét forrás emberi neve („kifli.hu", „Saját bevitel", …). */
  sourceLabel: string
  /** Mikor került a polcra — `null`, ha a tétel nem hordoz időpontot (nem találgatunk). */
  when: string | null
  icon: Icon3DName
}

export function pantryProvenance(item: Pick<PantryItem, 'source' | 'scrapedAt'>): PantryProvenance {
  const kind = CAPTURE[item.source] ?? 'kézi'
  const scraped = item.scrapedAt?.trim()
  return {
    kind,
    sourceLabel: (pantrySources[item.source] ?? pantrySources.manual).label,
    when: scraped ? scraped : null,
    icon: ICON[kind],
  }
}
