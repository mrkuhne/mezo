import { describe, expect, test } from 'vitest'
import rawCss from '@/styles/prototype.css?raw'

/**
 * Guard (mezo-d20.1.5): the Mozaik section must be theme-ready at the TOKEN level —
 * components never branch on theme. Every `--mz-*` custom property the Mozaik rules
 * read must be (a) declared in the light `:root` block and (b) overridden in the
 * `:root[data-theme="dark"]` block, so the washes/cells/tones flip with the theme
 * instead of staying hardcoded light (the prototypes ship light-only hexes).
 * Locally-scoped per-element props (--mw, --md, --mz-wash, --d) are exempt: they are
 * declared on the same element that reads them.
 */
const LOCAL_PROPS = new Set(['--mw', '--md', '--mz-wash', '--d'])

function blockBody(css: string, selector: RegExp): string {
  const m = css.match(selector)
  if (!m) throw new Error(`block not found: ${selector}`)
  return m[1]
}

function declared(body: string): Set<string> {
  return new Set([...body.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map(m => m[1]))
}

const MOZAIK_MARKER = 'Mozaik 2.0 primitives (design_2.0 — mezo-d20.1.3)'

function mozaikSection(css: string): string {
  const start = css.indexOf(MOZAIK_MARKER)
  if (start === -1) throw new Error('Mozaik marker not found')
  // the Today section follows it (todayCssTokens guard keeps Today last)
  const end = css.indexOf('Today · iOS list language', start)
  return end === -1 ? css.slice(start) : css.slice(start, end)
}

describe('Mozaik washes/cells/tones are theme-ready tokens (mezo-d20.1.5)', () => {
  test('every --mz-* token the Mozaik section reads is declared in :root AND overridden for dark', () => {
    const section = mozaikSection(rawCss)
    const used = new Set(
      [...section.matchAll(/var\(\s*(--mz-[a-zA-Z0-9-]+)/g)].map(m => m[1]).filter(p => !LOCAL_PROPS.has(p)),
    )
    expect(used.size).toBeGreaterThan(10) // the section really is tokenized

    const light = declared(blockBody(rawCss, /(?:^|\n):root[ \t]*\{([^}]*)\}/))
    const dark = declared(blockBody(rawCss, /(?:^|\n):root\[data-theme="dark"\][ \t]*\{([^}]*)\}/))

    const missingLight = [...used].filter(p => !light.has(p)).sort()
    const missingDark = [...used].filter(p => !dark.has(p)).sort()
    expect(missingLight).toEqual([])
    expect(missingDark).toEqual([])
  })

  test('the Mozaik section carries no hardcoded light-surface hexes outside :root token definitions', () => {
    const section = mozaikSection(rawCss)
    // the wash/tone/cell hexes must live in tokens now — the section itself may keep
    // only neutral hairlines/shadows (rgba ink) and the coral MOST ring + dot.
    const offenders = [...section.matchAll(/#F{2}[0-9A-F]{4}|#E[0-9A-F]{5}|#D[0-9A-F]{5}/gi)]
      .map(m => m[0].toUpperCase())
      .filter(h => h !== '#FF6B4A') // the MOST ring + unread dot speak primary coral in both themes
    expect(offenders).toEqual([])
  })
})
