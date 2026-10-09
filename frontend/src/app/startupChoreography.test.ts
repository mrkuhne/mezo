import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import {
  DROP_COUNT, DROP_FALL_MS, DROP_START_MS, DROP_STAGGER_MS, FADE_AT_MS, SPLASH_DURATION_MS,
} from '@/app/startupChoreography'

// The owner-approved timing (Folyadék F1, prototype vilagos/keret.js `runSplash` + `.sp*` rules).

test('the numbers are the approved ones', () => {
  expect([SPLASH_DURATION_MS, FADE_AT_MS, DROP_START_MS, DROP_STAGGER_MS, DROP_FALL_MS, DROP_COUNT])
    .toEqual([3000, 2400, 1080, 170, 560, 5])
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
  for (const literal of ['1.08s', '1080ms', '.17s', '170ms', '.56s', '560ms', '2.4s', '2400ms']) {
    expect(css).not.toContain(literal)
  }
})
