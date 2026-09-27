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
// Some call sites reach a CROSS-CLASS constant instead, e.g. `TeamChatBudget.FEATURE` used as
// `new LlmCallContext(TeamChatBudget.FEATURE, ...)` inside TeamChatVoiceWriter.java, while the
// `static final String FEATURE = "team_chat";` field itself lives in TeamChatBudget.java — a
// DIFFERENT file, which never contains a `new LlmCallContext(` call of its own and so is invisible
// to the same-file CONST_SLUG_RE above. Two passes fix this without re-litigating file layout:
//   1) map every file's simple class name (the file's own basename) to its own FEATURE*/LLM_FEATURE
//      constant's slug, across ALL backend files;
//   2) in every file that DOES contain `new LlmCallContext(`, find `<ClassName>.FEATURE*`
//      references and resolve them through that map.
const CLASS_REF_RE = /\b([A-Za-z_][A-Za-z0-9_]*)\.FEATURE[A-Z_]*\b/g

function javaFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return javaFiles(full)
    return name.endsWith('.java') ? [full] : []
  })
}

function classNameOf(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1).replace(/\.java$/, '')
}

describe('label dictionary completeness', () => {
  it('covers every LlmCallContext feature slug in the backend', () => {
    const files = javaFiles(BACKEND_SRC)
    // Pass 1: className -> the slug of ITS OWN FEATURE*/LLM_FEATURE constant, if any.
    const classSlug = new Map<string, string>()
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(CONST_SLUG_RE)) classSlug.set(classNameOf(file), m[1])
    }
    const slugs = new Set<string>()
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(SLUG_RE)) slugs.add(m[1])
      if (src.includes('new LlmCallContext(')) {
        for (const m of src.matchAll(CONST_SLUG_RE)) slugs.add(m[1])
        // Pass 2: resolve cross-class `<ClassName>.FEATURE*` references via the pass-1 map.
        for (const m of src.matchAll(CLASS_REF_RE)) {
          const mapped = classSlug.get(m[1])
          if (mapped) slugs.add(mapped)
        }
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
