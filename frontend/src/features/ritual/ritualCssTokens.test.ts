import { describe, expect, it } from 'vitest'
import rawCss from '@/styles/prototype.css?raw'

/**
 * Napzárás night-sky token guard (mezo-d20.8.1.1).
 *
 * The ritual's darkening arc is driven by six `--rz-sky-N` gradients selected by
 * `.rz-screen[data-act="N"]`. Like the Mozaik `--mz-*` family, each has to be declared in BOTH
 * `:root` blocks — the light one and the `[data-theme="dark"]` one. The flow forces dark, so the
 * two carry identical values today; the rule still holds, because a token declared in only one
 * block is a token that vanishes the moment anything reaches it from the other theme.
 *
 * The subject of the assertion is deliberately "every act has a sky, declared in both blocks",
 * not the specific colours: the panel-rhythm regression (mezo-d20.11.2) taught that when a value
 * is copied per-surface, the next surface simply forgets it and nothing fails. A missing act
 * would silently fall back to the previous act's sky and read as a bug in the animation, not in
 * the tokens.
 */
const ACTS = [1, 2, 3, 4, 5, 6] as const

/** The declaration bodies of the two token roots, in source order. */
function rootBlocks(): string[] {
  return [...rawCss.matchAll(/^:root(?:\[data-theme="dark"\])?\s*\{([\s\S]*?)^\}/gm)].map((m) => m[1])
}

describe('Napzárás night-sky tokens', () => {
  it('declares every act sky in two root blocks', () => {
    const blocks = rootBlocks()
    for (const act of ACTS) {
      const declaring = blocks.filter((b) => b.includes(`--rz-sky-${act}:`)).length
      expect(declaring, `--rz-sky-${act} must be declared in both :root blocks`).toBe(2)
    }
  })

  it('selects one sky per act, and no act is missing a selector', () => {
    for (const act of ACTS) {
      const rule = rawCss.match(new RegExp(`\\.rz-screen\\[data-act="${act}"\\]\\s*\\{([^}]*)\\}`))
      expect(rule, `no .rz-screen[data-act="${act}"] rule`).not.toBeNull()
      expect(rule![1]).toContain(`var(--rz-sky-${act})`)
    }
  })

  it('keeps the night-wash primitive declared once, not copied per act', () => {
    // The `.rz-nw` tile is the one carrier of the night-washed surface. A per-act copy is the
    // exact shape of the panel-rhythm bug, so the guard is single-declaration, not the value.
    const copies = [...rawCss.matchAll(/\.rz-[a-z-]*\s*\{([^}]*)\}/g)]
      .filter(([, body]) => body.includes('var(--rz-nw-wash)'))
    expect(copies).toHaveLength(1)
  })
})
