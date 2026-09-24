import { describe, expect, test } from 'vitest'
import { SPORT_IDS, SPORTS, sportById, type Sport } from '@/features/train/logic/sports'

// All ten wire sports carry `fields`; only the run tile doesn't — cast once here since
// every call site below reads an id from WIRE_SPORT_IDS, never 'run'.
const wireSport = (id: string): Sport => sportById(id) as Sport

// The single mirror of the wire pattern (api/feature/train/train.yml
// SportSessionCreateRequest.sport: `^(volleyball|cross|trx|bike|swim|football|basketball|tennis|hike|other)$`).
// Every other "is this a valid sport id" check in the app reads SPORT_IDS —
// this is the ONE place the literal list is typed out.
const WIRE_SPORT_IDS = [
  'volleyball', 'cross', 'trx', 'bike', 'swim', 'football', 'basketball', 'tennis', 'hike', 'other',
]

test('SPORT_IDS matches the wire pattern verbatim, in order', () => {
  expect(SPORT_IDS).toEqual(WIRE_SPORT_IDS)
})

test('every wire sport id has a SPORTS table entry', () => {
  for (const id of WIRE_SPORT_IDS) {
    expect(SPORTS.some((s) => s.id === id)).toBe(true)
  }
})

test('the run tile is present alongside the ten wire sports (eleven tiles total)', () => {
  expect(SPORTS).toHaveLength(11)
  expect(SPORTS.some((s) => s.id === 'run')).toBe(true)
})

test('the run tile routes away and carries no loggable fields', () => {
  const run = sportById('run')
  expect(run).toBeTruthy()
  expect(run).toHaveProperty('routesTo')
  // @ts-expect-error — RunTile has no `fields`; asserting the shape at runtime too.
  expect(run!.fields).toBeUndefined()
})

describe('table shape — every entry', () => {
  for (const s of SPORTS) {
    test(`${s.id} has non-empty name/art/art3d/color/target`, () => {
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.art.length).toBeGreaterThan(0)
      // its own Titanium 3D glyph (üveg U4) — never the shared generic ball
      expect(s.art3d).toMatch(/^t-/)
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(s.targetMinutes).toBeGreaterThan(0)
    })
  }
})

describe('the ten wire sports each carry fields', () => {
  for (const id of WIRE_SPORT_IDS) {
    test(`${id} has a non-empty fields array`, () => {
      const sport = sportById(id)
      expect(sport).toBeTruthy()
      expect(wireSport(id).fields.length).toBeGreaterThan(0)
    })
  }
})

test('sportById resolves every wire id and the run tile, and null for a foreign id', () => {
  for (const id of [...WIRE_SPORT_IDS, 'run']) expect(sportById(id)?.id).toBe(id)
  expect(sportById('kajak')).toBeNull()
})

// Per-sport field spot checks (task-2 brief) — one representative field kind
// each, ported from sport-state.js:37-144.
test('volleyball offers a training/match mode picker', () => {
  const fields = wireSport('volleyball').fields
  const mode = fields.find((f) => f.key === 'mode')
  expect(mode?.type).toBe('modes')
})

test('bike offers terrain as chips', () => {
  const fields = wireSport('bike').fields
  const terrain = fields.find((f) => f.key === 'terrain')
  expect(terrain?.type).toBe('chips')
  expect(terrain).toMatchObject({ options: ['sík', 'dombos', 'hegyi'] })
})

test('hike offers climb as a number field', () => {
  const fields = wireSport('hike').fields
  const climb = fields.find((f) => f.key === 'climb')
  expect(climb?.type).toBe('number')
  expect(climb).toMatchObject({ unit: 'm' })
})

test('other offers effort as chips', () => {
  const fields = wireSport('other').fields
  const effort = fields.find((f) => f.key === 'effort')
  expect(effort?.type).toBe('chips')
  expect(effort).toMatchObject({ options: ['könnyű', 'közepes', 'kemény'] })
})
