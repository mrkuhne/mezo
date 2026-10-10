import { describe, expect, it } from 'vitest'
import rawCss from '@/styles/folyadek-nap-rogzites.css?raw'

/**
 * Napzárás token guard (mezo-d20.8.1.1; re-pointed in Folyadék F2, mezo-n4wf5.2).
 *
 * The ritual used to darken through six `--rz-sky-N` gradients, and this test pinned that every act
 * had one in both theme roots. Owner decision 2026-10-09: the ritual is LIGHT; the evening mood is
 * the deeper „dusk" liquid, which is ONE shared recipe (the kit's `.fo-dusk`, set by
 * `<Page tone="dusk">`) — not a per-act value. The intent of the guard is the same as before: the
 * surface's colour comes from shared tokens, declared once, and no act can silently fall out of it.
 * So the subject is now the area stylesheet (`.nrz-*` Napzárás, `.nqk-*` quick log):
 *   · it carries no theme fork and no dark-only rule;
 *   · it never re-declares the liquid (`--liq1` / `--liq2`) or the domain colour — a local copy is
 *     exactly the "value copied per surface" the panel-rhythm regression (mezo-d20.11.2) warned about;
 *   · its colours are tokens: no hex literal but white, and every `var()` it reads is a Folyadék
 *     token or a shared font / inset one;
 *   · the retired dark skin (`--rz-*`, `.rz-*`, the aurora, the stars) is neither declared nor consumed.
 */
const bare = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')

describe('Napzárás + quick log — colour comes from the shared tokens', () => {
  it('has no theme fork and no dark-only rule', () => {
    expect(bare).not.toMatch(/data-theme/)
    expect(bare).not.toMatch(/prefers-color-scheme/)
    expect(bare).not.toMatch(/color-scheme\s*:/)
  })

  it('never re-declares the liquid or the domain colour — dusk is the kit\'s one recipe', () => {
    expect(bare.match(/--(?:liq1|liq2|dom|dom2)\s*:/g) ?? []).toEqual([])
    // …and it does not copy the dusk mix either
    expect(bare).not.toMatch(/\.fo-dusk\s*\{/)
  })

  it('uses no hex literal but white', () => {
    const hexes = [...bare.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase())
    expect(hexes.filter((h) => h !== '#fff')).toEqual([])
  })

  it('reads only Folyadék tokens (and the shared font / inset ones)', () => {
    const ALLOWED = /^--(?:fo-[\w-]+|dom2?|liq[12]|ff-(?:body|display|mono)|m)$/
    const read = new Set([...bare.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))
    expect([...read].filter((v) => !ALLOWED.test(v))).toEqual([])
    // non-vacuous: the stylesheet does read the liquid and the ink
    expect(read.has('--liq2')).toBe(true)
    expect(read.has('--fo-ink')).toBe(true)
  })

  it('the retired dark skin stays retired — neither declared nor consumed', () => {
    expect(bare).not.toMatch(/--rz-/)
    expect(bare).not.toMatch(/\.rz-/)
    expect(bare).not.toMatch(/aurora|\.uv-|\.glass\b/)
  })
})
