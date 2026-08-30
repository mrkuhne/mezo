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

  it('never inlines the night-wash values — consumers must go through the token', () => {
    // The point is NOT that one rule may use `var(--rz-nw-wash)`: consuming a token in several
    // places is exactly what a token is for, and several ritual surfaces legitimately do. What
    // must never happen is a rule re-typing the literal gradient, because that is how the
    // panel-rhythm regression happened (mezo-d20.11.2) — a value copied per surface, until the
    // next surface quietly gets a slightly different one and nothing fails.
    const WASH_LITERAL = 'linear-gradient(150deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.05))'
    // Comments are stripped first: a `/* … */` block sitting above a rule would otherwise be
    // swallowed into the selector capture, and this file's rules are heavily commented.
    const bare = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')
    const inlined = [...bare.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, sel, body]) => body.includes(WASH_LITERAL) && !sel.trim().startsWith(':root'))
      .map(([, sel]) => sel.trim())
    expect(inlined).toEqual([])
    // …and the token itself is declared in both roots, like every other --rz-* token.
    expect(rootBlocks().filter((b) => b.includes('--rz-nw-wash:'))).toHaveLength(2)
  })
})
