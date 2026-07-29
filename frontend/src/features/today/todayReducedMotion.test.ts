import { describe, expect, test } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias (no fs/path,
// cwd-independent, works identically in vitest and the browser build) — the same mechanism
// `features/ritual/reducedMotionGuard.test.ts` uses.
import rawCss from '@/styles/prototype.css?raw'

/**
 * Guard (mezo-1khu, mirroring `features/ritual/reducedMotionGuard.test.ts`): every Today
 * face-swap animation must be neutralized under `prefers-reduced-motion`, or the Playwright
 * goldens (which run `reducedMotion: 'reduce'`) flake on in-flight frames.
 *
 * The selector list below matches what actually shipped, NOT the original task-11-brief.md
 * draft: the brief's `.faceswap > *` stagger relied on a never-set `--i` custom property
 * (replaced with nth-child rules — no new selector to guard, `.faceswap > *` itself still
 * carries the animation), and its progress-bar reuse of the shared `progress-mbar-grow`
 * keyframe was dropped for a dedicated `bar-grow` transform keyframe (see prototype.css's
 * "Today face-swap motion" section for why). `bar-grow` is asserted below so a future edit
 * can't silently drop its reduced-motion guard.
 */
const REDUCED_BLOCKS = [...rawCss.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
  .map((m) => m[1])
  .join('\n')

describe('Today motion is reduced-motion safe', () => {
  test.each(['.faceswap > *', '.tdc-bar i', '.dfs-pill.now.has-open .dfs-e'])(
    '%s is disabled under prefers-reduced-motion',
    (selector) => {
      expect(REDUCED_BLOCKS).toContain(selector)
    },
  )

  test('every Today-specific keyframe animation has a matching reduce rule', () => {
    for (const name of ['face-in-fwd', 'face-in-back', 'dfs-pulse', 'bar-grow']) {
      expect(rawCss).toContain(`@keyframes ${name}`)
    }
    expect(REDUCED_BLOCKS).toMatch(/animation:\s*none/)
  })
})
