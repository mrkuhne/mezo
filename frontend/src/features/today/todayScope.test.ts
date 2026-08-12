import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * A mezo-e26w hatósugarának STRUKTURÁLIS őre (a `todayReducedMotion.test.ts`
 * cascade-guardjának nyelvén). A Today saját iOS listanyelvet kapott, DE a
 * `shared/ui/ItemRow`-t a Fuel „Mai" ablak-folyója és a rutin-szerkesztő is
 * rendereli — ebben a változásban egyiket sem mozdítjuk. Ha a Today lapnyelvének
 * bármelyik komponense visszanyúl az `ItemRow`-hoz, a két nyelv összecsúszik, és
 * a Fuel vizuális goldenjei kezdenek indokolatlanul mozogni.
 *
 * A Today SHEETJEI és az AnchorIsland KIVÉTELEK: azok nem a lap nyelvét beszélik.
 */
const DIR = join(process.cwd(), 'src/features/today/components')
const EXEMPT = new Set(['AnchorIsland.tsx'])

describe('a Today lapnyelve nem nyúl vissza a shared ItemRow-hoz', () => {
  test('egyetlen Today-komponens sem importálja az ItemRow-t', () => {
    const offenders = readdirSync(DIR)
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !EXEMPT.has(f))
      .filter((f) => readFileSync(join(DIR, f), 'utf8').includes("shared/ui/ItemRow"))
    expect(offenders).toEqual([])
  })

  test('a nyugdíjazott felületek tényleg eltűntek', () => {
    const files = readdirSync(DIR)
    expect(files).not.toContain('MezoMessage.tsx')
    expect(files).not.toContain('IslandFactsStrip.tsx')
    expect(files).not.toContain('CompanionNoteCard.tsx')
  })
})
