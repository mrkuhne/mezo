/**
 * A karakter-szobák és A csapat oldal domain-logikája (mezo-a9bo7.9, spec 2026-09-23 §2.5).
 *
 * Tiszta függvények a MÁR LÉTEZŐ rekordok fölött: a fal poszt-folyama (`buildTeamFeed`) adja a
 * szoba ügyeit, a karakter-dosszié dimenziói az érettséget és a tudás-listát. Semmit nem
 * fogalmaz (ADR 0049) — a karakter-hang csak a statikus szoba-szövegekben él (`ROOM_COPY`).
 */
import type {
  CharacterClaimDto, CharacterDimensionSummary, CharacterMaturityHistory, CharacterMaturityWeek,
} from '@/data/character/characterApi'
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

const WEEKS = 8
const WEEK_MS = 7 * 86_400_000

function roomValue(week: CharacterMaturityWeek, id: TeamCharacterId): number | null {
  const own = week.dimensions.filter(d => characterForPersona(d.expertKey ?? '') === id)
  return own.length ? Math.round(own.reduce((s, d) => s + d.maturity, 0) / own.length) : null
}

/**
 * Így érik a képe rólad: a szoba heti érettsége 8 naptári hétre (legrégebbi → e hét), a
 * dimenziói átlagaként — ugyanaz a szabály, mint a gyűrűé (`roomMaturity`). Hiányzó hét = null:
 * sosem kitöltve, sosem nulla (ADR 0049, mezo-a9bo7.11).
 */
export function roomMaturitySeries(history: CharacterMaturityHistory, id: TeamCharacterId): (number | null)[] {
  const out = new Array<number | null>(WEEKS).fill(null)
  const last = history.weeks[history.weeks.length - 1]
  if (!last) return out
  const end = Date.parse(`${last.weekStart}T12:00:00Z`)
  for (const w of history.weeks) {
    const idx = WEEKS - 1 - Math.round((end - Date.parse(`${w.weekStart}T12:00:00Z`)) / WEEK_MS)
    if (idx >= 0 && idx < WEEKS) out[idx] = roomValue(w, id)
  }
  return out
}

/**
 * A csendes felirat (mezo-a9bo7.11): ha a szoba legutóbbi heti értéke az előzőnél lejjebb van, a
 * legtöbbet eső témát nevezi meg — kevesebb állítás, vagy a meglévők bizonyossága csökkent. Nem
 * értesít, nem posztol; csak a szobában olvasható.
 */
export function maturityDropNote(history: CharacterMaturityHistory, id: TeamCharacterId): string | null {
  const own = history.weeks
    .map(w => ({ w, v: roomValue(w, id) }))
    .filter((x): x is { w: CharacterMaturityWeek; v: number } => x.v !== null)
  if (own.length < 2) return null
  const [prev, cur] = own.slice(-2)
  if (cur.v >= prev.v) return null
  let worst: { title: string; delta: number; lost: number } | null = null
  for (const d of cur.w.dimensions) {
    if (characterForPersona(d.expertKey ?? '') !== id) continue
    const before = prev.w.dimensions.find(p => p.key === d.key)
    if (!before) continue
    const delta = before.maturity - d.maturity
    if (delta > 0 && (!worst || delta > worst.delta)) worst = { title: d.title, delta, lost: before.claimCount - d.claimCount }
  }
  if (!worst) return null
  return worst.lost > 0
    ? `${worst.title}: ${worst.lost} állítás kikerült a képből, ezért halványult.`
    : `${worst.title}: a meglévő állítások bizonyossága csökkent.`
}

/** A prototípus normált görbe-képlete (viewBox 330×60): min–max a sáv aljára–tetejére; a hiányzó
 *  hét pontja null (a vonal ott megszakad). */
export function growthPoints(series: (number | null)[]): ([number, number] | null)[] {
  const vals = series.filter((v): v is number => v !== null)
  const mn = Math.min(...vals), mx = Math.max(...vals), sp = (mx - mn) || 1
  return series.map((v, j) => (v === null ? null : [14 + j * 38.6, 46 - ((v - mn) / sp) * 30]))
}

