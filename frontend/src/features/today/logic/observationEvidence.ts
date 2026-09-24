// ============================================================
// Mezo · observationEvidence — az észrevétel-kártya bizonyíték-sorai (mezo-me75u.12).
// A szerver a bizonyítékot NYERS szövegként küldi (ObservationContextService: forrás-címke ·
// ÉÉÉÉ-HH-NN · `kulcs=érték; kulcs=érték…`, a végén esetleg `…` csonkolással). Ez a modul a
// felületnek bontja emberi sorokra: forrás-ikon + cím + nap, címkézett értékek, a saját
// jegyzet idézetként, és két+ egymást követő check-in egy közös „Változás” grafikonná.
// A drót változatlan; ami nem ebben a formában jön (a statisztikai sorok rövid címkéi), az
// sima címke marad. Vizuális igazság: docs/design_2.0/prototypes/uveg-eszrevetel.html.
// ============================================================
import type { Icon3DName } from '@/shared/ui/clay'
import { SPORTS } from '@/features/train/logic/sports'

export interface EvidenceValue {
  /** Előtag-címke („RPE”, „Vállterhelés”) — a mértékegységes értékeknek nincs. */
  label?: string
  value: string
  /** Utótag: mértékegység („perc”, „kcal”) vagy skála („/10”). */
  unit?: string
  /** Kiemelt (skálás, 1–10) érték — a kártya akcentusát kapja. */
  hot?: boolean
}

export const CHECKIN_DIMS = [
  { key: 'energy', label: 'Energia', color: 'var(--dv-coral)' },
  { key: 'stress', label: 'Stressz', color: 'var(--dv-amber)' },
  { key: 'body', label: 'Testi', color: 'var(--dv-rose)' },
  { key: 'mental', label: 'Mentális', color: 'var(--dv-sky)' },
] as const
export type CheckinKey = (typeof CHECKIN_DIMS)[number]['key']

export interface EvidenceRecord {
  kind: 'record'
  /** A szerver forrás-címkéje („Sportnapló”, „Check-in”). */
  source: string
  icon: Icon3DName
  /** A sor címe: sportnaplón a sportág, egyébként a forrás. */
  title: string
  /** Ha a cím a sportág, alatta a forrás. */
  subtitle?: string
  date: string
  time?: string
  values: EvidenceValue[]
  /** A check-in négy dimenziója (1–10), ha a bejegyzés hordozza. */
  checkin?: Partial<Record<CheckinKey, number>>
  /** A felhasználó saját szavai (jegyzet, napló-szöveg). */
  quote?: string
  /** A szerver levágta a szöveg végét. */
  truncated: boolean
}
export interface EvidenceTag { kind: 'tag'; text: string }
export type EvidenceItem = EvidenceRecord | EvidenceTag

export interface CheckinShift { kind: 'shift'; from: EvidenceRecord; to: EvidenceRecord }
export type EvidenceBlock = (EvidenceRecord & { hideCheckin?: boolean }) | EvidenceTag | CheckinShift

const RECORD = /^(.+?) · (\d{4}-\d{2}-\d{2}) · (.*)$/s

const SOURCE_ICON: Record<string, Icon3DName> = {
  'Sportnapló': 't-volley', 'Check-in': 't-checkin', 'Napló': 't-journal', 'Hála': 't-sprout',
  'Alvás': 't-sleep', 'Futás': 't-run', 'Edzés': 't-dumbbell', 'Gyakorlat': 't-dumbbell',
  'Saját chatüzenet': 't-chat', 'Tervezett sportesemény': 't-calendar',
  activity_log: 't-steps', ritual_day: 't-chain', habit_day: 't-chain', meal: 't-bowl', meal_item: 't-bowl',
  water_log: 't-water', weight_log: 't-weight', daily_intention: 't-ring', intention_focus: 't-ring',
}
/** A szerver a nem címkézett forrásoknál a nyers táblanevet küldi — itt kap magyar nevet. */
const SOURCE_NAME: Record<string, string> = {
  activity_log: 'Tevékenység', ritual_day: 'Rituálé', habit_day: 'Szokás', meal: 'Étkezés',
  meal_item: 'Étkezés', water_log: 'Víz', weight_log: 'Testsúly', daily_intention: 'Napi szándék',
  intention_focus: 'Szándék',
}

const PROSE = ['note', 'notes', 'text', 'content', 'closing_note', 'reflection_text', 'reflection']
/** Ami a sor fejlécében már ott van, vagy gépi mező. */
const HIDDEN = new Set(['date', 'time', 'slot_time', 'saved_at', 'state', 'kcal_is_estimate', 'sport', 'source',
  'occurred_on', 'role', 'degraded', 'skipped', 'order_index', 'catalog_id', 'counts_toward_volume', 'hypnogram',
  'status', 'origin', 'categorized_by', 'extracted', 'confidence', 'kind', 'side', 'week_number', 'session_key'])

type Fmt = (v: string) => EvidenceValue
const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? String(n).replace('.', ',') : v
}
const unit = (u: string): Fmt => (v) => ({ value: num(v), unit: u })
/** 1–10 skála; ha az érték mégsem szám (egy szöveges intenzitás-címke), sima címkézett érték. */
const scale = (label: string): Fmt => (v) =>
  Number.isFinite(Number(v)) ? { label, value: num(v), unit: '/10', hot: true } : { label, value: v }
const labelled = (label: string, u?: string): Fmt => (v) => ({ label, value: num(v), unit: u })

const FIELDS: Record<string, Fmt> = {
  duration_min: unit('perc'), sets_played: unit('szett'), rounds: unit('kör'), jump_count: unit('ugrás'),
  completed_rounds: unit('kör'), rpe: scale('RPE'), rpe_actual: scale('RPE'), intensity: scale('Intenzitás'),
  shoulder_strain: scale('Vállterhelés'), quality: scale('Minőség'), duration_h: unit('óra'),
  awakenings: labelled('Ébredés', '×'), bedtime: labelled('Lefekvés'), wakeup: labelled('Ébredés'),
  weight_kg: unit('kg'), reps: unit('ism.'), rir: labelled('RIR'), pump: scale('Pumpa'),
  joint_pain: scale('Ízületi fájdalom'), workload: scale('Terhelés'), hr_recovery_sec: labelled('Pulzus-visszatérés', 'mp'),
  name: (v) => ({ value: v }), muscle: labelled('Izom'), day_label: (v) => ({ value: v }), location: labelled('Helyszín'),
  intensity_label: labelled('Intenzitás'), life_area: labelled('Terület'), amount_ml: unit('ml'),
}

function sportOf(id: string | undefined): { name: string; icon: Icon3DName } | null {
  if (!id) return null
  const s = SPORTS.find((x) => x.id === id)
  return s ? { name: s.name, icon: s.art3d } : { name: id, icon: 't-other' }
}

/** `kulcs=érték; kulcs=érték` — a pontosvessző csak akkor határ, ha utána új `kulcs=` jön,
 *  így a jegyzetben álló pontosvessző a jegyzet része marad. */
function fields(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of body.split(/;\s(?=[a-z_]+=)/)) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1).replace(/;$/, '')
  }
  return out
}

export function parseEvidence(raw: string): EvidenceItem {
  const m = RECORD.exec(raw)
  if (!m || !/^[a-z_]+=/.test(m[3])) return { kind: 'tag', text: raw }
  const [, source, date] = m
  let body = m[3]
  const truncated = body.endsWith('…')
  if (truncated) body = body.slice(0, -1)
  // A csonkolás vághat egy KULCS közepén („…; rpe=7.0; kc”) — azt a csonkot levágjuk; ha pedig
  // egy ÉRTÉK közepén vágott, a félbemaradt utolsó értéket (hacsak nem próza) eldobjuk.
  const cutKey = truncated && /;\s[a-z_]*$/.test(body)
  if (cutKey) body = body.replace(/;\s[a-z_]*$/, '')
  const f = fields(body)
  if (truncated && !cutKey) {
    const last = Object.keys(f).at(-1)
    if (last && !PROSE.includes(last)) delete f[last]
  }

  const sport = sportOf(f.sport)
  const values: EvidenceValue[] = []
  const checkin: Partial<Record<CheckinKey, number>> = {}
  for (const [k, v] of Object.entries(f)) {
    if (PROSE.includes(k) || HIDDEN.has(k) || k.endsWith('_id') || k.endsWith('_at') || v === '') continue
    const dim = CHECKIN_DIMS.find((d) => d.key === k)
    if (dim) { const n = Number(v); if (Number.isFinite(n)) checkin[dim.key] = n; continue }
    if (k === 'kcal') { values.push({ value: `${f.kcal_is_estimate === 'true' ? '~' : ''}${num(v)}`, unit: 'kcal' }); continue }
    const fmt = FIELDS[k]
    values.push(fmt ? fmt(v) : { label: k.replace(/_/g, ' '), value: v })
  }
  const quote = PROSE.map((k) => f[k]).find((v) => v && v.trim() !== '')
  const name = SOURCE_NAME[source] ?? source

  return {
    kind: 'record',
    source: name,
    icon: sport?.icon ?? SOURCE_ICON[source] ?? 't-note',
    title: sport?.name ?? name,
    subtitle: sport ? name : undefined,
    date,
    time: f.time ?? f.slot_time,
    values,
    checkin: Object.keys(checkin).length ? checkin : undefined,
    quote,
    truncated,
  }
}

/** Két vagy több EGYMÁST KÖVETŐ check-in: a sorok csak fejlécet + jegyzetet mutatnak, alattuk
 *  egy közös változás-blokk (az első → az utolsó), hogy az összefüggés egy pillantásra látsszon. */
export function evidenceBlocks(raws: string[]): EvidenceBlock[] {
  const items = raws.map(parseEvidence)
  const out: EvidenceBlock[] = []
  const isCk = (x: EvidenceItem | undefined): x is EvidenceRecord => x?.kind === 'record' && !!x.checkin
  for (let i = 0; i < items.length;) {
    let j = i
    while (isCk(items[j])) j++
    if (j - i >= 2) {
      const run = items.slice(i, j) as EvidenceRecord[]
      run.forEach((r) => out.push({ ...r, hideCheckin: true }))
      out.push({ kind: 'shift', from: run[0], to: run[run.length - 1] })
      i = j
    } else {
      out.push(items[i])
      i++
    }
  }
  return out
}

const MONTHS = ['jan', 'febr', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec']
const WEEKDAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat']

/** „ma” / „tegnap” / „szept 17. · csütörtök” — `today` helyi ÉÉÉÉ-HH-NN. */
export function evidenceDayLabel(date: string, today: string): string {
  const d = new Date(`${date}T12:00:00`)
  const diff = Math.round((new Date(`${today}T12:00:00`).getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'ma'
  if (diff === 1) return 'tegnap'
  return `${MONTHS[d.getMonth()]}. ${d.getDate()}. · ${WEEKDAYS[d.getDay()]}`
}
