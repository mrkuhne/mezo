import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import {
  DROP_COUNT, DROP_FALL_MS, DROP_START_MS, DROP_STAGGER_MS, FADE_AT_MS, SPLASH_DURATION_MS,
} from '@/app/startupChoreography'

// The owner-requested timing (2026-10-19, mezo-rn5q7: wordmark + drops only, ~1.6 s).

test('the numbers are the approved ones', () => {
  expect([SPLASH_DURATION_MS, FADE_AT_MS, DROP_START_MS, DROP_STAGGER_MS, DROP_FALL_MS, DROP_COUNT])
    .toEqual([1600, 1150, 280, 70, 480, 5])
})

test('the last drop has landed before the fade starts', () => {
  expect(DROP_START_MS + (DROP_COUNT - 1) * DROP_STAGGER_MS + DROP_FALL_MS).toBeLessThan(FADE_AT_MS)
  expect(FADE_AT_MS).toBeLessThan(SPLASH_DURATION_MS)
})

// The stylesheet carries NO copy of these numbers: its delays are the --sp-* properties the
// component writes from the table above. Pin that, so a literal can never sneak back and drift.
test('the CSS timeline is derived from the constants (no literal copies)', () => {
  const css = readFileSync('src/app/StartupSplash.css', 'utf8')
  for (const v of ['--sp-end', '--sp-fade', '--sp-drop-start', '--sp-stagger', '--sp-fall']) {
    expect(css).toContain(`var(${v})`)
  }
  for (const literal of ['.28s', '280ms', '.07s', '70ms', '.48s', '480ms', '1.15s', '1150ms', '1.6s', '1600ms']) {
    expect(css).not.toContain(literal)
  }
})
