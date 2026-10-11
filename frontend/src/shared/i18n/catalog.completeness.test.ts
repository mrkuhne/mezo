import { describe, expect, it } from 'vitest'
import { catalogs } from './messages'

type Leaf = { kind: 'string' | 'function'; arity: number; empty: boolean }

/** Flattens a catalog into dotted key path -> leaf description. */
export function walk(node: unknown, path = '', out: Record<string, Leaf> = {}): Record<string, Leaf> {
  if (typeof node === 'string') {
    out[path] = { kind: 'string', arity: 0, empty: node.trim() === '' }
  } else if (typeof node === 'function') {
    out[path] = { kind: 'function', arity: node.length, empty: false }
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, out)
  } else {
    out[path] = { kind: 'string', arity: 0, empty: true } // unsupported leaf -> flagged as empty
  }
  return out
}

/** The problems that make `en` an incomplete or mis-shaped twin of `hu`. Empty = complete. */
export function compareCatalogs(hu: unknown, en: unknown): string[] {
  const a = walk(hu)
  const b = walk(en)
  const problems: string[] = []
  for (const p of Object.keys(a)) {
    if (!(p in b)) { problems.push(`missing in en: ${p}`); continue }
    if (a[p].kind !== b[p].kind) problems.push(`kind differs: ${p}`)
    else if (a[p].arity !== b[p].arity) problems.push(`arity differs: ${p}`)
    if (b[p].empty) problems.push(`empty in en: ${p}`)
  }
  for (const p of Object.keys(b)) if (!(p in a)) problems.push(`extra in en: ${p}`)
  return problems
}

describe('message catalogs', () => {
  it('en has the same keys, leaf kinds and arities as hu, and no empty string', () => {
    expect(compareCatalogs(catalogs.hu, catalogs.en)).toEqual([])
  })

  it('the walker can fail: a deliberately broken en is reported', () => {
    const hu = { a: 'x', b: { c: 'y', d: (n: number, u: string) => `${n}${u}` }, e: 'z', f: 'w' }
    const en = { a: 'x', b: { c: '', d: (n: number) => `${n}` }, e: () => 'z', g: 'extra' }
    expect(compareCatalogs(hu, en)).toEqual([
      'empty in en: b.c',
      'arity differs: b.d',
      'kind differs: e',
      'missing in en: f',
      'extra in en: g',
    ])
  })
})
