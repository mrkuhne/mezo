/** The Walker education deck (slice C3, spec D2/D3 + §3 exact copy). The heavy clinical
 *  stats deliberately live in the escalation-sheet consts below, NEVER in the rotating deck.
 *  Provenance: docs/research/raw/transcripts/ (Walker DOAC interview + Ethier morning routine). */

export interface SleepStat {
  key: string
  title: string
  text: string
  source: string
}

export const STAT_DECK: SleepStat[] = [
  {
    key: 'regularity',
    title: 'A rendszeresség a király',
    text: 'A legrendszeresebben alvóknál −49% össz-halálozás, −57% kardiometabolikus betegség és −39% rák-halálozás — és a rendszeresség a mennyiségnél is erősebb előrejelző.',
    source: 'UK Biobank ~60 000 fő · M. Walker',
  },
  {
    key: 'muscle',
    title: 'Az izmod az alvásodon múlik',
    text: 'Alváshiány mellett fogyókúrázva a leadott súly ~70%-a izom, nem zsír.',
    source: 'Alvásmegvonásos diéta-vizsgálat · M. Walker',
  },
  {
    key: 'hunger',
    title: 'Az éhség a fáradtsággal nő',
    text: 'Kevés alvás mellett ~30–40%-kal éhesebb vagy: a jóllakottság-hormon (leptin) csökken, az éhséghormon (ghrelin) nő.',
    source: 'Leptin/ghrelin vizsgálatok · M. Walker',
  },
  {
    key: 'genes',
    title: 'Egy hét, 711 gén',
    text: 'Egyetlen rövid-alvásos hét 711 gén működését torzítja — a gyulladásosak fel, az immunvédelem le.',
    source: 'Möller-Levet 2013 · M. Walker',
  },
  {
    key: 'glymphatic',
    title: 'Éjszakai nagytakarítás',
    text: 'A mély alvás alatt az agy glymphatikus rendszere kimossa a béta-amiloidot és a taut — ez a napi karbantartás.',
    source: 'M. Walker',
  },
  {
    key: 'remlight',
    title: '+18% REM a tompított estétől',
    text: 'Meleg, 30 lux alatti esti fény mellett +18% REM-alvást mértek — ezt segíti az esti tompítás.',
    source: 'M. Walker',
  },
  {
    key: 'band',
    title: '7–9 óra: sáv, nem szabály',
    text: 'Nem mindenkinek jár 8 óra — az igény 7–9 óra között szór. A sávodon belül a rendszeresség számít igazán.',
    source: 'M. Walker',
  },
]

/** Deterministic daily pick — YYYYMMDD as a number, mod deck length. No ticks, no flicker. */
export function dailyStatIndex(dateIso: string, deckLength: number = STAT_DECK.length): number {
  return Number(dateIso.replaceAll('-', '')) % deckLength
}

/** Reason-branched escalation lead-in — shared by SleepEscalationCard and SleepStatsSheet. */
export const ESCALATION_LEAD: Record<'short' | 'quality', string> = {
  short: 'Az elmúlt két hétben tartósan kevés az alvásod.',
  quality: 'Az elmúlt két hétben tartósan rossz minőségű az alvásod.',
}

/** Escalation-sheet copy (spec §3 tail) — shown ONLY in the sheet's escalation section. */
export const ESCALATION_HEAVY_STATS =
  'Tartósan 6 óra alatti alvás mellett a kutatások 100–150%-kal magasabb öngyilkossági rizikót mértek; a gyakori, nyomasztó rémálmok önálló figyelmeztető jelek — a szervezet vészjelzései, nem jellemhibák.'
export const ESCALATION_CBT =
  'Van bizonyítottan működő, gyógyszermentes segítség: a CBT-I (kognitív viselkedésterápia inszomniára) az elsővonalbeli terápia. Beszélj háziorvossal vagy alvás-szakemberrel.'
