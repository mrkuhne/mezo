import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The formatting helpers are leaf utilities with hundreds of importers. The `@/shared/i18n` barrel
// re-exports `LanguageProvider`, which pulls the auth data hooks and react-query in behind it, so
// these files take the store and the plural rule from their own modules (mezo-n4wf5.11).
const HERE = dirname(fileURLToPath(import.meta.url))
const LEAVES = ['format.ts', 'dates.ts', 'huNum.ts', 'huText.ts']
/** Every module specifier a file imports or re-exports from (static and dynamic). */
function specifiers(source: string): string[] {
  const found = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  return [...new Set(found)]
}

describe('i18n imports of the formatting leaves', () => {
  it.each(LEAVES)('%s does not import the @/shared/i18n barrel', (file) => {
    const i18n = specifiers(readFileSync(resolve(HERE, file), 'utf8')).filter((s) => s.includes('shared/i18n') || s.includes('/i18n'))
    expect(i18n.length).toBeGreaterThan(0) // the file does read the language: the check is not vacuous
    for (const spec of i18n) {
      expect(spec).toMatch(/^@\/shared\/i18n\/(lang|plural)$/)
    }
  })

  it('the specifier scan sees every import form', () => {
    expect(specifiers(`import a from 'x'\nimport 'y'\nexport { b } from "z"\nconst c = await import('w')`)).toEqual(['x', 'y', 'z', 'w'])
  })
})
