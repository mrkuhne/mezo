// ============================================================
// Mezo · sports — the eleven-sport vocabulary (mezo-88iwa.9). Ported from
// prototype docs/design_2.0/prototypes/companion-titanium/sport-state.js:37-144
// (the SPORTS table) onto the wire's ten sport-session ids
// (`SportSessionCreateRequest.sport` pattern
// `^(volleyball|cross|trx|bike|swim|football|basketball|tennis|hike|other)$`,
// `api/feature/train/train.yml`) plus one more tile — Futás — that never
// posts a sport-session: running is its own feature/wire, so the tile only
// routes there.
//
// Art gap (documented, not invented): the clay icon set
// (frontend/src/shared/ui/clay) ships exactly two movement glyphs today —
// `i-sport` (generic) and `i-futas` (running). None of the ten per-sport
// glyphs the prototype implies (labda, kerékpár, úszás, tenisz-ütő, hegy…)
// exist in clay-icons.svg yet, so every one of the ten wire sports falls
// back to the generic `i-sport`; only the run tile gets its own `i-futas`.
// See the task-2 report for the full gap list.
// ============================================================
import type { ClayIconName } from '@/shared/ui/clay'
import type { SportKind } from '@/features/train/logic/sportKinds'

export type SportFieldKind = 'number' | 'chips' | 'range' | 'modes' | 'text'

interface SportFieldBase {
  key: string
  label: string
  /** Hidden from the form unless this mode is the chosen one (prototype `onlyMode`). */
  onlyMode?: string
}

export interface SportNumberField extends SportFieldBase {
  type: 'number'
  unit?: string
  min: number
  max: number
  step: number
  value: number
}

export interface SportChipsField extends SportFieldBase {
  type: 'chips'
  value: string
  options: string[]
}

/** The felt-effort/RPE 1..10 scale (prototype `intensityField`, its own `scale` type). */
export interface SportRangeField extends SportFieldBase {
  type: 'range'
  unit?: string
  min: number
  max: number
  value: number
}

export interface SportModeOption { id: string; label: string }
export interface SportModesField extends SportFieldBase {
  type: 'modes'
  value: string
  options: SportModeOption[]
}

export interface SportTextField extends SportFieldBase {
  type: 'text'
  value: string
  placeholder?: string
}

export type SportField = SportNumberField | SportChipsField | SportRangeField | SportModesField | SportTextField

/** One of the ten wire sports — a full loggable tile. */
export interface Sport {
  id: SportKind
  name: string
  /** Clay icon id — see the art-gap note above; every wire sport uses `i-sport` today. */
  art: ClayIconName
  color: string
  targetMinutes: number
  muscles: string[]
  fields: SportField[]
}

/** The eleventh tile: Futás. Carries no fields of its own — picking it routes
 * away to the existing run-logging flow instead of opening a sport form. */
export interface RunTile {
  id: 'run'
  name: string
  art: ClayIconName
  color: string
  targetMinutes: number
  muscles: string[]
  routesTo: string
}

/** The wire's ten sport-session ids, verbatim and in the contract's own
 * order. The single mirror of `SportSessionCreateRequest.sport`'s pattern —
 * every other "is this id valid on the wire" check reads this, not a
 * re-typed literal. */
export const SPORT_IDS = [
  'volleyball', 'cross', 'trx', 'bike', 'swim', 'football', 'basketball', 'tennis', 'hike', 'other',
] as const satisfies readonly SportKind[]

const minutesField = (value: number): SportNumberField =>
  ({ key: 'minutes', label: 'Időtartam', unit: 'perc', type: 'number', min: 1, max: 600, step: 5, value })

const intensityField = (value: number): SportRangeField =>
  ({ key: 'intensity', label: 'Megélt terhelés (RPE)', unit: '/ 10', type: 'range', min: 1, max: 10, value })

const trainingMatch = (value: 'training' | 'match' = 'training'): SportModesField => ({
  key: 'mode', label: 'Típus', type: 'modes', value,
  options: [{ id: 'training', label: 'Edzés' }, { id: 'match', label: 'Meccs' }],
})

// Per-sport HUES — the restored palette (style bible §2.1 + the clay ramps), swapped off
// the Titanium neon set in mezo-ju4j6.13 (owner decision 2026-09-20). The hue is MEANING
// here, not skin: every sport's `art` is the same clay ball (`i-sport`), so the colour is
// the only thing that tells Foci from Úszás on the picker — so each sport keeps its OWN
// hue, and only the hue itself moves onto the house family. Eleven distinct values are
// more than the six `--dv-*` accents, so the deeper/warmer clay stops fill the rest:
//   rose E27A8B · coral FF6B4A · lav 9B8FC4 · sage 7FA48A · sky 6FA7D8 ·
//   sage-deep 4E6B42 · terracotta E05535 · amber FFB347 · wood 9C5F33 ·
//   stone 8C7F72 · sky-deep 2E6E96
// Literals rather than `var(--dv-*)`: the value is handed down into markup as an inline
// `--sp-color` and is `color-mix()`-ed there, and the `--dv-*` set has no entry for the
// five deeper stops anyway.
export const SPORTS: (Sport | RunTile)[] = [
  {
    id: 'volleyball', name: 'Röplabda', art: 'i-sport', color: '#E27A8B', targetMinutes: 90,
    muscles: ['shoulder-front', 'calf', 'quad', 'core'],
    fields: [
      trainingMatch(),
      minutesField(90),
      intensityField(7),
      { key: 'shoulder', label: 'Vállterhelés', type: 'chips', value: 'közepes', options: ['enyhe', 'közepes', 'erős'] },
      { key: 'sets', label: 'Játszott szettek', unit: 'szett', type: 'number', min: 1, max: 7, step: 1, value: 3, onlyMode: 'match' },
    ],
  },
  {
    id: 'cross', name: 'CrossFit / HIIT', art: 'i-sport', color: '#FF6B4A', targetMinutes: 40,
    muscles: ['quad', 'back-mid', 'shoulder-side', 'core'],
    fields: [
      minutesField(40),
      { key: 'rounds', label: 'Körök', unit: 'kör', type: 'number', min: 1, max: 30, step: 1, value: 5 },
      intensityField(8),
    ],
  },
  {
    id: 'trx', name: 'TRX / funkcionális', art: 'i-sport', color: '#9B8FC4', targetMinutes: 45,
    muscles: ['core', 'chest-mid', 'back-mid', 'shoulder-front'],
    fields: [
      minutesField(45),
      { key: 'rounds', label: 'Körök', unit: 'kör', type: 'number', min: 1, max: 20, step: 1, value: 4 },
      intensityField(7),
    ],
  },
  {
    id: 'bike', name: 'Kerékpár', art: 'i-sport', color: '#7FA48A', targetMinutes: 60,
    muscles: ['quad', 'glute', 'calf'],
    fields: [
      { key: 'distance', label: 'Táv', unit: 'km', type: 'number', min: 1, max: 300, step: 1, value: 25 },
      minutesField(60),
      intensityField(6),
      { key: 'terrain', label: 'Terep', type: 'chips', value: 'sík', options: ['sík', 'dombos', 'hegyi'] },
    ],
  },
  {
    id: 'swim', name: 'Úszás', art: 'i-sport', color: '#6FA7D8', targetMinutes: 45,
    muscles: ['back-wide', 'shoulder-side', 'core', 'triceps-long'],
    fields: [
      { key: 'distance', label: 'Táv', unit: 'm', type: 'number', min: 50, max: 10000, step: 50, value: 1200 },
      minutesField(40),
      { key: 'stroke', label: 'Úszásnem', type: 'chips', value: 'gyors', options: ['gyors', 'mell', 'hát', 'pillangó'] },
      intensityField(6),
    ],
  },
  {
    id: 'football', name: 'Foci', art: 'i-sport', color: '#4E6B42', targetMinutes: 90,
    muscles: ['quad', 'ham', 'calf', 'core'],
    fields: [trainingMatch(), minutesField(90), intensityField(7)],
  },
  {
    id: 'basketball', name: 'Kosárlabda', art: 'i-sport', color: '#E05535', targetMinutes: 75,
    muscles: ['quad', 'calf', 'shoulder-side', 'core'],
    fields: [trainingMatch(), minutesField(75), intensityField(7)],
  },
  {
    id: 'tennis', name: 'Tenisz', art: 'i-sport', color: '#FFB347', targetMinutes: 60,
    muscles: ['shoulder-side', 'core', 'quad', 'triceps-lateral'],
    fields: [
      {
        key: 'mode', label: 'Típus', type: 'modes', value: 'singles',
        options: [{ id: 'singles', label: 'Egyes' }, { id: 'doubles', label: 'Páros' }],
      },
      minutesField(60),
      intensityField(6),
    ],
  },
  {
    id: 'hike', name: 'Túra', art: 'i-sport', color: '#9C5F33', targetMinutes: 120,
    muscles: ['quad', 'glute', 'calf'],
    fields: [
      { key: 'distance', label: 'Táv', unit: 'km', type: 'number', min: 1, max: 60, step: 0.5, value: 9 },
      minutesField(150),
      { key: 'climb', label: 'Szintemelkedés', unit: 'm', type: 'number', min: 0, max: 4000, step: 50, value: 300 },
      // The prototype's túra has no felt-effort slider (its MET came from the climb alone),
      // but OUR wire makes `rpe` REQUIRED on every sport session
      // (`SportSessionCreateRequest.rpe`, api/feature/train/train.yml). Deriving it from the
      // climb, or posting a silent default, would be a number the athlete never said — so the
      // túra form asks the same question every other sport asks (mezo-88iwa.9, T8 Task 4).
      intensityField(5),
    ],
  },
  {
    id: 'other', name: 'Egyéb mozgás', art: 'i-sport', color: '#8C7F72', targetMinutes: 60,
    muscles: ['core'],
    fields: [
      { key: 'name', label: 'Mi volt?', type: 'text', value: '', placeholder: 'Pl. fallabda, tánc, evezés' },
      minutesField(60),
      { key: 'effort', label: 'Milyen kemény volt?', type: 'chips', value: 'közepes', options: ['könnyű', 'közepes', 'kemény'] },
      intensityField(6),
    ],
  },
  {
    id: 'run', name: 'Futás', art: 'i-futas', color: '#2E6E96', targetMinutes: 40,
    muscles: ['quad', 'ham', 'calf', 'core'],
    // No dedicated "/train/futas/new" route exists — running logs through a
    // sheet inside RunningPage's own Napló segment, so that page IS the route.
    routesTo: '/train/futas',
  },
]

export const sportById = (id: string): Sport | RunTile | null => SPORTS.find((s) => s.id === id) ?? null
