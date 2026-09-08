import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURE_LABELS } from './labels'

// The gate of the "no raw slugs in the admin" rule (mezo-l096): a NEW backend LLM
// feature slug must get a Hungarian label the moment it exists. Scans backend sources
// at test time — cheap (<100ms) at repo scale and always in sync with reality.

const BACKEND_SRC = resolve(__dirname, '../../../../../backend/src/main/java')
const SLUG_RE = /new LlmCallContext\(\s*"([a-z0-9_]+)"/g
// Some call sites pass a named constant instead of an inline literal, e.g.
// `private static final String LLM_FEATURE = "meso_review";` used as
// `new LlmCallContext(LLM_FEATURE, ...)`. Collect those slugs too, in files that also
// contain a `new LlmCallContext(` call, and union them with the literal scan.
const CONST_SLUG_RE = /(?:FEATURE[A-Z_]*|LLM_FEATURE)\s*=\s*"([a-z0-9_]+)"/g

function javaFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return javaFiles(full)
    return name.endsWith('.java') ? [full] : []
  })
}

describe('label dictionary completeness', () => {
  it('covers every LlmCallContext feature slug in the backend', () => {
    const slugs = new Set<string>()
    for (const file of javaFiles(BACKEND_SRC)) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(SLUG_RE)) slugs.add(m[1])
      if (src.includes('new LlmCallContext(')) {
        for (const m of src.matchAll(CONST_SLUG_RE)) slugs.add(m[1])
      }
    }
    expect(slugs.size).toBeGreaterThan(30) // sanity: the scan actually found the call sites
    const unlabelled = [...slugs].filter((s) => !(s in FEATURE_LABELS))
    expect(unlabelled, `Add Hungarian labels to labels.ts for: ${unlabelled.join(', ')}`).toEqual([])
  })

  it('covers the admin_replay constant and the feature-map domain keys', () => {
    for (const key of ['admin_replay', 'train', 'food', 'sleep', 'journal', 'habits', 'water', 'weight']) {
      expect(key in FEATURE_LABELS, key).toBe(true)
    }
  })
})
