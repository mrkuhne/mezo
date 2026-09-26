import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

/**
 * Guard: every Titanium symbol shipped in the app has a source the generator reads.
 *
 * titanium-icons.svg is a build output of scripts/gen-titanium-sprite.mjs: the nap.html
 * prototype sprite (i-<name> → t-<name>) plus docs/design_2.0/assets/titanium-custom.svg.
 * Slices U5–U10 pasted their approved icons straight into the output, so re-running the
 * generator silently dropped 29 symbols (mezo-wnfdv). A new icon belongs in
 * titanium-custom.svg, then the generator is run (üveg style bible appendix).
 */
const ROOT = join(process.cwd(), '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const ids = (src: string, re: RegExp) => new Set([...src.matchAll(re)].map((m) => m[1]))

const shipped = ids(read('frontend/src/shared/ui/clay/titanium-icons.svg'), /<symbol id="(t-[^"]+)"/g)
const custom = ids(read('docs/design_2.0/assets/titanium-custom.svg'), /<symbol id="(t-[^"]+)"/g)
const proto = new Set(
  [...ids(read('docs/design_2.0/prototypes/companion-titanium/nap.html'), /<symbol id="i-([^"]+)"/g)].map(
    (n) => `t-${n}`,
  ),
)

test('every shipped Titanium symbol lives in titanium-custom.svg or the nap.html prototype', () => {
  const orphans = [...shipped].filter((id) => !custom.has(id) && !proto.has(id))
  expect(orphans).toEqual([])
})

test('the shipped sprite carries every source symbol (the generator was re-run)', () => {
  const missing = [...custom, ...proto].filter((id) => !shipped.has(id))
  expect(missing).toEqual([])
})
