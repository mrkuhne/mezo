import { describe, expect, test } from 'vitest'
// Vite `?raw` import — the CSS source as a string, resolved via the `@/` alias — same
// mechanism `todayTapTargets.test.ts` / `todayReducedMotion.test.ts` use to guard the same file.
import rawCss from '@/styles/prototype.css?raw'

/**
 * Guard (mezo-e26w fix): a custom property used inside the Today `.td-*` block that is NOT
 * declared in a `:root` block resolves to nothing at computed-value time — CSS does not error,
 * it just silently drops the whole declaration that referenced it. jsdom (unit tests) computes
 * no layout, so this class of bug is invisible to `pnpm test` and only shows up when someone
 * measures the real rendered page.
 *
 * This is exactly what happened: `--td-gut` was declared only on `.dayview, .daytabs,
 * .todaychip` — and `.todaychip` never existed anywhere in the codebase, a typo for `.td-chip`.
 * Elements outside `.dayview`/`.daytabs` (`.td-chip` itself, the `.td-skel-*` loading-skeleton
 * siblings of `.daytabs`) referenced `var(--td-gut)` from OUTSIDE its declaring scope, got
 * nothing, and their `padding`/`margin`/`width: calc(...)` declarations fell back to their
 * unset default. Concretely: `.td-chip`'s `width: calc(100% - 2 * var(--td-gut))` became
 * invalid, `width` fell back to `auto`, and the button — `white-space: nowrap` — shrink-wrapped
 * its preview text and rendered ~1060px wide at a 375px viewport, pushing the count badge and
 * chevron off-screen.
 *
 * The fix removes the failure mode instead of patching the one selector: `--td-gut` is gone,
 * every former call site now reads the global `--sp-4` (16px) DS token directly — a property
 * declared in `:root` is visible EVERYWHERE, so there is no subtree to fall outside of. This
 * test pins that invariant so the next feature-scoped custom property some future `.td-*` (or
 * any other) rule introduces can't repeat the same trap: it fails the moment a `var(--x)` inside
 * the Today block resolves to a property that isn't globally available.
 *
 * Lives as a sibling of `todayScope.test.ts` rather than inside it: that file guards the
 * COMPONENT boundary (no Today component reaches back into `shared/ui/ItemRow`); this one
 * guards a CSS VALIDITY invariant inside `prototype.css` itself — different failure class,
 * different fixture (raw CSS text vs. `.tsx` source files), so a dedicated file keeps each
 * guard's fixture and vocabulary in place rather than laminating two unrelated protocols.
 */

/** Every `:root { ... }` / `:root[data-theme=...] { ... }` block IS a custom-property
 *  declaration scope (global — visible from anywhere, including every `.td-*` rule). A
 *  compound selector like `:root[data-theme="dark"] .foo { ... }` is NOT: `:root` there only
 *  narrows an ordinary element selector, so `\{` must follow `:root` (plus its optional
 *  `[attr=...]`) with nothing but whitespace in between. */
const ROOT_BLOCK = /(?:^|\n):root(?:\[[^\]\n]*\])?[ \t]*\{([^}]*)\}/g

/** A custom-property DECLARATION inside a rule body: the name immediately followed by `:`.
 *  This must not also match a `var(--name)` USAGE (e.g. `--gradient-cta: linear-gradient(...,
 *  var(--cta-g1), ...)` must yield only `--gradient-cta`, not `--cta-g1`) — a `var(...)`
 *  reference is followed by `)` or `,`, never `:`. */
const PROP_DECLARATION = /(--[a-zA-Z0-9-]+)\s*:/g

function rootDeclaredCustomProperties(css: string): Set<string> {
  const declared = new Set<string>()
  for (const blockMatch of css.matchAll(ROOT_BLOCK)) {
    const body = blockMatch[1]
    for (const declMatch of body.matchAll(PROP_DECLARATION)) {
      declared.add(declMatch[1])
    }
  }
  return declared
}

/** Slices the Today section up to the next top-level `/* =====` section header. New feature
 *  sections are appended to `prototype.css`, so reading to EOF would incorrectly treat their
 *  local custom properties as Today dependencies. The `── ── ──` sub-headers remain inside. */
const TODAY_SECTION_MARKER = 'Today · maradék sheet-nyelv (mezo-e26w heritage → mezo-d20.9.1)'

function todayBlock(css: string): string {
  const start = css.indexOf(TODAY_SECTION_MARKER)
  if (start === -1) throw new Error(`Marker "${TODAY_SECTION_MARKER}" not found in prototype.css`)
  const tail = css.slice(start)
  const nextSection = tail.indexOf('/* =====')
  return nextSection === -1 ? tail : tail.slice(0, nextSection)
}

/** Every `var(--name...)` reference in a chunk of CSS, deduped — covers plain usages
 *  (`padding: var(--sp-4)`), usages with a fallback (`var(--sp-4, 16px)`), and usages nested
 *  inside another function call (`color-mix(in srgb, var(--dv-lav) 18%, transparent)`). */
function varUsages(css: string): Set<string> {
  const used = new Set<string>()
  for (const match of css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
    used.add(match[1])
  }
  return used
}

describe('every custom property the Today .td-* block reads is declared in a :root block (mezo-e26w fix)', () => {
  test('sanity: the DS spacing token this guard exists for is really 16px', () => {
    const rootBody = rawCss.match(/(?:^|\n):root[ \t]*\{([^}]*)\}/)?.[1] ?? ''
    expect(rootBody).toMatch(/--sp-4:\s*16px/)
  })

  test('sanity: the Today block slice actually contains the .td-* rules (the marker/slice did not silently miss them)', () => {
    const block = todayBlock(rawCss)
    const tdSelectorCount = (block.match(/\.td-[a-z-]+/g) ?? []).length
    // The Design 2.0 cleanup (mezo-d20.9.1) cut the block down to the two surviving sheets
    // (MezoMessagesSheet + DailyQuestsSheet/Card) — ~40 selectors instead of the old ~110, so
    // this floor is lowered to stay a real tripwire rather than a comfortable no-op.
    expect(tdSelectorCount).toBeGreaterThan(20)
  })

  test('no custom property used inside the Today block resolves outside its declaring scope', () => {
    const declaredRootWide = rootDeclaredCustomProperties(rawCss)
    const usedInTodayBlock = varUsages(todayBlock(rawCss))

    // Sanity: the block really does read custom properties (an empty set would make this
    // test vacuously pass and hide a broken slice/regex).
    expect(usedInTodayBlock.size).toBeGreaterThan(5)

    const undeclared = [...usedInTodayBlock].filter((prop) => !declaredRootWide.has(prop)).sort()
    expect(undeclared).toEqual([])
  })
})
