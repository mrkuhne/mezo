import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

/**
 * Guard (Folyadék F1, mezo-n4wf5.1): titanium-icons.svg (file name kept for the importers) is
 * the Folyadék-jel sprite, a build output of scripts/gen-folyadek-sprite.mjs from
 * docs/design_2.0/assets/folyadek-glyphs.json. Every symbol id of the old Titanium sprite
 * survives, so the ~350 consumers switch at once.
 */
const ROOT = join(process.cwd(), '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const sprite = read('frontend/src/shared/ui/clay/titanium-icons.svg')
const ids = [...sprite.matchAll(/<symbol id="(t-[^"]+)"/g)].map((m) => m[1])

const BEFORE_IDS = ['t-addex', 't-album', 't-anchor', 't-avocado', 't-bandage', 't-basket', 't-bell', 't-bike', 't-bolt', 't-book', 't-bowl', 't-brain', 't-breath', 't-bulb', 't-calendar', 't-camera', 't-candle', 't-carb', 't-card', 't-chain', 't-chat', 't-checkin', 't-chef', 't-clock', 't-coin', 't-compare', 't-compass', 't-core', 't-council', 't-cowave', 't-craving', 't-crossfit', 't-dawn', 't-day', 't-diagnose', 't-digestion', 't-down', 't-dumbbell', 't-eraser', 't-exit', 't-eye', 't-fat', 't-fiber', 't-flag', 't-flame', 't-flask', 't-football', 't-gear', 't-gem', 't-glucose', 't-graph', 't-grid', 't-harvest', 't-heart', 't-hike', 't-history', 't-hold', 't-hunger', 't-ill', 't-info', 't-journal', 't-juggle', 't-jump', 't-kettle', 't-key', 't-kimelo', 't-layers', 't-lens', 't-link', 't-macro', 't-meat', 't-mic', 't-micro', 't-mood', 't-moon', 't-motivation', 't-muscle', 't-mute', 't-nohunger', 't-note', 't-orb', 't-other', 't-pain', 't-palette', 't-pattern', 't-peak', 't-pencil', 't-people', 't-person', 't-pin', 't-plate', 't-play', 't-portion', 't-pot', 't-processing', 't-protein', 't-protocol', 't-quest', 't-quick', 't-radar', 't-record', 't-repeat', 't-rested', 't-ring', 't-run', 't-salt', 't-scissors', 't-score', 't-scroll', 't-send', 't-shield', 't-signal', 't-skip', 't-sleep', 't-snack', 't-soreness', 't-source', 't-spark', 't-sprint', 't-sprout', 't-stack', 't-star', 't-star-empty', 't-star-half', 't-steps', 't-stretch', 't-sugar', 't-sun', 't-supps', 't-swap', 't-swim', 't-syringe', 't-target', 't-tea', 't-template', 't-tennis', 't-thumb-down', 't-thumb-up', 't-tick', 't-trash', 't-travel', 't-trend', 't-trx', 't-ultra', 't-up', 't-volley', 't-water', 't-weight', 't-whistle']

const iconNames = read('frontend/src/shared/ui/clay/index.tsx').match(/export type Icon3DName =([\s\S]*?)\n\n/)![1]
const ICON3D_NAMES = [...iconNames.matchAll(/'(t-[a-z0-9-]+)'/g)].map((m) => m[1])

test('keeps every icon id the app used before the swap', () => {
  expect(BEFORE_IDS).toHaveLength(149)
  for (const id of BEFORE_IDS) expect(ids, id).toContain(id)
})
test('draws glyphs, not Titanium art', () => {
  expect(sprite).not.toMatch(/tg-titanium|feDropShadow/)
  expect(sprite).toContain('var(--ic,var(--dom))')
})
test('every Icon3DName in clay/index.tsx has a symbol', () => {
  expect(ICON3D_NAMES.length).toBeGreaterThan(140)
  for (const n of ICON3D_NAMES) expect(ids, n).toContain(n)
})
test('the shipped sprite equals what the generator builds from the glyph table', () => {
  const gly = JSON.parse(read('docs/design_2.0/assets/folyadek-glyphs.json')) as Record<string, string>
  expect(ids).toEqual(Object.keys(gly).map((k) => `t-${k}`))
})
