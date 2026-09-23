/**
 * A karakter-szobák és A csapat oldal domain-logikája (mezo-a9bo7.9, spec 2026-09-23 §2.5).
 *
 * Tiszta függvények a MÁR LÉTEZŐ rekordok fölött: a fal poszt-folyama (`buildTeamFeed`) adja a
 * szoba ügyeit, a karakter-dosszié dimenziói az érettséget és a tudás-listát. Semmit nem
 * fogalmaz (ADR 0049) — a karakter-hang csak a statikus szoba-szövegekben él (`ROOM_COPY`).
 */
import type { CharacterClaimDto, CharacterDimensionSummary } from '@/data/character/characterApi'
import type { Pattern, PatternMonitorPair } from '@/data/types'
import { characterForPersona, type TeamCharacterId } from './team'
import { ownerForPattern, type FeedDay, type FeedPost } from './teamFeed'

/** A szobával rendelkező karakterek — a Szkeptikusnak nincs szobája (spec §2.2). */
export const ROOM_IDS = ['szunya', 'mocor', 'falat', 'deru', 'mezo'] as const
export type RoomId = (typeof ROOM_IDS)[number]

export function isRoomId(id: string | undefined): id is RoomId {
  return (ROOM_IDS as readonly string[]).includes(id ?? '')
}

/**
 * A szobák statikus karakter-szövegei (spec §2.6/§2.7 hang-szabály: 2–4 mondat, személyiség,
 * mértékletes emoji CSAK a karakter-mondatban). Nem rekordok, nem állítanak számot rólad.
 */
export const ROOM_COPY: Record<RoomId, { quote: string; ask: string }> = {
  szunya: {
    quote: '„Az éjszakáid a szakterületem. Amit itt látsz, azt mind a te naplódból tanultam.” 🌙',
    ask: 'Minden naplózott éjszaka közelebb visz ahhoz, hogy **biztosat** mondhassak — a kimaradt éjszakák csak kitolják.',
  },
  mocor: {
    quote: '„A terhelésed és az erőd — és az, hogy a napló ne maradjon el. Nem hajtalak, de észreveszem.” ⚡',
    ask: 'Ha a szettek **súlyát** is felírod, abból látom a valódi terhelést. 💪',
  },
  falat: {
    quote: '„A tányérod, a célod és az edzésed üzemanyaga — ezekre figyelek.” 🍽️',
    ask: 'Minden naplózott étkezés **egy darab** a kirakósból — a hétvégiek is. 🥦',
  },
  deru: {
    quote: '„Én arra figyelek, hogy vagy. Ehhez a te szavad kell — egy-egy rövid esti bejelentkezés.” 🌤️',
    ask: 'Egy **egyperces** esti bejelentkezés többet mond nekem bármelyik mérésnél.',
  },
  mezo: {
    quote: '„Én fogom össze a csapatot. Csak az kerül a rólad szóló képbe, amiben egyetértünk.” 📔',
    ask: 'Minden tény, esemény és döntés nálam kereshető vissza — a heti konzílium jegyzőkönyve is. ✅',
  },
}

/** A karakter dosszié-dimenziói: a dimenzió gazda-personája olvad be a karakterbe (spec §2.2). */
export function dimensionsFor(id: TeamCharacterId, dims: CharacterDimensionSummary[]): CharacterDimensionSummary[] {
  return dims.filter(d => characterForPersona(d.expertKey ?? '') === id)
}

/** A szoba érettsége: a dimenziói átlaga (0 = még ismerkedik). */
export function roomMaturity(dims: CharacterDimensionSummary[]): number {
  if (dims.length === 0) return 0
  return Math.round(dims.reduce((s, d) => s + d.maturity, 0) / dims.length)
}

/** Amit rólad tud: a dimenziói állításai, ismétlés nélkül. */
export function roomClaims(dims: CharacterDimensionSummary[]): CharacterClaimDto[] {
  const seen = new Set<string>()
  return dims.flatMap(d => d.topClaims).filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)))
}

/** A szoba ügyei: amit posztolt VAGY amibe bevonták; ami rád vár, elöl, aztán a legfrissebb. */
export function roomCases(days: FeedDay[], id: TeamCharacterId): FeedPost[] {
  return days
    .flatMap(d => [...(d.poster ? [d.poster] : []), ...d.posts])
    .filter(p => p.author === id || p.guest === id)
    .sort((a, b) => Number(b.waiting) - Number(a.waiting) || b.occurredAt.localeCompare(a.occurredAt))
}

export type CaseTone = 'coral' | 'gold' | 'sky' | 'lav' | 'sage' | 'slate'

/** Az ügy-kártya állapot-címkéje — zéró szaknyelv (spec §2.7). */
export function caseStatus(p: FeedPost): { label: string; tone: CaseTone } {
  if (p.waiting) return { label: 'Rád vár', tone: 'coral' }
  switch (p.kind) {
    case 'sejtes': return { label: p.honesty && p.honesty.n < p.honesty.minN ? 'Gyűlik' : 'Sejtés', tone: 'gold' }
    case 'kiserlet': return { label: 'Kísérlet', tone: 'lav' }
    case 'konzilium': return { label: 'Konzílium', tone: 'gold' }
    case 'elorejelzes': return { label: 'Lezárva', tone: 'slate' }
    case 'kerdes': return { label: 'Kérdés', tone: 'sky' }
    default: return { label: 'Észrevétel', tone: 'sage' }
  }
}

/** Lezárt ügyek: a karakter mintái, amiket te vagy a motor elengedett — az őszinteség része. */
export function archivedPatternCount(id: TeamCharacterId, patterns: Pattern[], pairs: PatternMonitorPair[]): number {
  return patterns.filter(p => (p.status === 'rejected' || p.status === 'refuted' || p.status === 'dormant')
    && ownerForPattern(p, pairs).author === id).length
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const WEEKS = 8

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
}

/**
 * Így gyűlik a tudása: a karakter bejegyzéseinek HALMOZOTT száma heti bontásban, 8 hét
 * (legrégebbi → ma). Nincs érettség-történet rekord — ezért a görbe azt mutatja, ami valóban
 * megtörtént (ADR 0049). A 8 hétnél régebbi bejegyzések az alapszintet adják.
 */
export function weeklyGrowth(days: FeedDay[], id: TeamCharacterId, today: string): number[] {
  const perWeek = new Array<number>(WEEKS).fill(0)
  let base = 0
  for (const day of days) {
    if (!ISO_DAY.test(day.key)) continue
    const n = [...(day.poster ? [day.poster] : []), ...day.posts].filter(p => p.author === id).length
    if (n === 0) continue
    const ago = daysBetween(day.key, today)
    if (ago < 0) continue
    const w = Math.floor(ago / 7)
    if (w >= WEEKS) base += n
    else perWeek[WEEKS - 1 - w] += n
  }
  const out: number[] = []
  let acc = base
  for (const n of perWeek) out.push((acc += n))
  return out
}

/** A prototípus normált görbe-képlete (viewBox 330×60): min–max a sáv aljára–tetejére. */
export function growthPoints(series: number[]): [number, number][] {
  const mn = Math.min(...series), mx = Math.max(...series), sp = (mx - mn) || 1
  return series.map((v, j) => [14 + j * 38.6, 46 - ((v - mn) / sp) * 30])
}

