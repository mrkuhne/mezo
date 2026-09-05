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
// The section that follows Mozaik in prototype.css. Its predecessor ('Today · iOS list
// language') was deleted with the Today view layer, and because the lookup silently accepted
// a missing end marker, this scan had been running to EOF unnoticed ever since (mezo-sm21).
// Both markers now fail LOUDLY: a section-scoped guard that quietly turns stylesheet-wide is
// a guard nobody can reason about.
const MOZAIK_END_MARKER = 'Cél Mozaik hub'

function mozaikSection(css: string): string {
  const start = css.indexOf(MOZAIK_MARKER)
  if (start === -1) throw new Error(`Mozaik start marker not found: ${MOZAIK_MARKER}`)
  const end = css.indexOf(MOZAIK_END_MARKER, start)
  if (end === -1) throw new Error(`Mozaik end marker not found: ${MOZAIK_END_MARKER}`)
  return css.slice(start, end)
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

  // The regex above only matches SIX-digit hexes, so a THREE-digit one slipped past it:
  // mezo-jcpt.1 shipped `background: var(--surface-card, #fff)` and the guard stayed green.
  // This closes that gap in the same light-surface families (F**/E*/D*), in their 3-digit
  // form, where they hide most easily — as a var() FALLBACK. A surface fallback is dead
  // weight anyway: every token the section reads is declared in BOTH :root blocks (the test
  // above proves exactly that), so it can never fire; it can only rot into a light-mode hex
  // nobody notices when the dark theme is next touched.
  //
  // Scope, stated honestly: this does NOT ban every 3-digit hex in the section. `color: #fff`
  // on a coral-gradient CTA is the established idiom (white ink in BOTH themes, ~40 uses), and
  // the `.lg-*` lifegoal block still carries bare `background: #fff` surfaces that predate this
  // guard. Widening to those is a real cleanup with its own blast radius — deferred, not done
  // silently here.
  test('no light-surface hex hides as a var() fallback in the Mozaik section (mezo-jcpt.1)', () => {
    const section = mozaikSection(rawCss)
    const SURFACE_FALLBACK =
      /var\(\s*--[a-zA-Z0-9-]+\s*,\s*#(?:F{2}[0-9A-F]{4}|E[0-9A-F]{5}|D[0-9A-F]{5}|F{2}[0-9A-F]|E[0-9A-F]{2}|D[0-9A-F]{2})(?![0-9A-F])/gi
    const offenders = [...section.matchAll(SURFACE_FALLBACK)].map(m => m[0])
    expect(offenders).toEqual([])
  })
})

// ── Every --mz-* token, wherever it is read (mezo-sm21) ─────────────────────
// The guard above is section-scoped on purpose (its hex rules are about the Mozaik block's own
// language). But `--mz-*` tokens are read far outside that block — feature blocks at the end of
// the stylesheet consume them freely — and an undeclared one there is exactly as broken: CSS
// drops the declaration silently and the element falls back to `inherit`. That is how
// `.rt-hrow`'s `color: var(--mz-ink)` (a token that never existed) shipped. While the end marker
// was missing this scan happened to reach those blocks by accident; now it does so on purpose.
describe('every --mz-* token read anywhere in the stylesheet is declared (mezo-sm21)', () => {
  test('light AND dark both declare every --mz-* the stylesheet consumes', () => {
    const used = new Set(
      [...rawCss.matchAll(/var\(\s*(--mz-[a-zA-Z0-9-]+)/g)].map(m => m[1]).filter(p => !LOCAL_PROPS.has(p)),
    )
    const light = declared(blockBody(rawCss, /(?:^|\n):root[ \t]*\{([^}]*)\}/))
    const dark = declared(blockBody(rawCss, /(?:^|\n):root\[data-theme="dark"\][ \t]*\{([^}]*)\}/))
    expect([...used].filter(p => !light.has(p)).sort()).toEqual([])
    expect([...used].filter(p => !dark.has(p)).sort()).toEqual([])
  })
})

// ── The panel rhythm has exactly ONE owner (mezo-d20.11.2) ──────────────────
// Four tabs had each declared their own identical `display:flex; column; gap:11px`
// panel class, and the two pages that forgot to (the Nap daypart panels and the Heti
// hub) shipped with their children touching at 0px. Daniel spotted it on the Nap tab.
// The guard is not "the gap is 11px" — it is "there is one place where that is said".
describe('the Mozaik panel rhythm is declared once (mezo-d20.11.2)', () => {
  test('.mz-panel-stack exists and carries the prototype\'s 11px column rhythm', () => {
    const rule = rawCss.match(/\.mz-panel-stack\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/display:\s*flex/)
    expect(rule).toMatch(/flex-direction:\s*column/)
    expect(rule).toMatch(/gap:\s*11px/)
  })

  test('no per-tab copy of it came back', () => {
    const copies = [...rawCss.matchAll(/\.([a-z]+)-panel\s*\{([^}]*)\}/g)]
      .filter(([, , body]) => /display:\s*flex/.test(body) && /gap:\s*11px/.test(body)
        && /flex-direction:\s*column/.test(body))
      .map(([, name]) => `.${name}-panel`)
    expect(copies).toEqual([])
  })
})

// mezo-8az6: a fejléc aurora tokenjei ugyanezt a szabályt követik.
test('minden --mzh-* fejléc-token deklarált light-ban ÉS dark-ban', () => {
  const light = declared(blockBody(rawCss, /(?:^|\n):root[ \t]*\{([^}]*)\}/))
  const dark = declared(blockBody(rawCss, /(?:^|\n):root\[data-theme="dark"\][ \t]*\{([^}]*)\}/))
  const used = new Set([...rawCss.matchAll(/var\(\s*(--mzh-[a-zA-Z0-9-]+)/g)].map(m => m[1]))
  expect(used.size).toBeGreaterThan(3)
  for (const token of used) {
    expect(light.has(token), `${token} hiányzik a light :root-ból`).toBe(true)
    expect(dark.has(token), `${token} hiányzik a dark blokkból`).toBe(true)
  }
})
