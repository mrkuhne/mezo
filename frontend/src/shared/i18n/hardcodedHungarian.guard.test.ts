import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// ============================================================
// Guard: no hard-coded Hungarian in a TRANSLATED area (mezo-n4wf5.11).
//
// The app is bilingual (Hungarian source language, English second) through the typed catalog
// `shared/i18n/messages/*`. Once an area's words moved into the catalog, a literal Hungarian
// string slipping back into its source would show Hungarian to an English user. This guard reads
// the source text of every non-test file under TRANSLATED, strips comments, and fails on any
// string literal, template-literal chunk or JSX text that contains a Hungarian accented letter
// [áéíóöőúüűÁÉÍÓÖŐÚÜŰ].
//
// HOW TO EXTEND (each later slice): when a slice translates a directory or a page, add its path
// (relative to `src/`, a directory ends in `/`) to TRANSLATED in the SAME change, run the guard,
// move every hit into the catalog (never allowlist a leftover), and delete the ALLOWLIST entries
// the slice made obsolete (the guard fails on an entry that no longer matches anything, so the
// list cannot rot). An ALLOWLIST entry is `{ file, text | pattern, reason }` and is for text that
// must legitimately stay Hungarian: source ids, labels waiting for their own slice.
//
// LIMIT: this is an accent detector. Hungarian written without an accented letter ('Vissza',
// 'Mai', 'Terv', 'Fuel') is invisible to it; the catalog completeness test
// (catalog.completeness.test.ts) and review cover that. A string with no accent is never flagged.
// ============================================================

/** Source paths (relative to src/) whose texts all live in the catalog. A directory ends in `/`. */
const TRANSLATED = [
  'app/',
  'shared/ui/folyadek/',
  'features/settings/',
  'features/me/pages/BeallitasokPage.tsx',
  'features/me/pages/NotificationsPage.tsx',
]

interface AllowEntry {
  file: string
  /** Exact literal text, or a pattern tested against it. */
  match: string | RegExp
  reason: string
}

/** Hungarian that must stay. Every entry has to match at least one hit (else the guard fails). */
const ALLOWLIST: AllowEntry[] = [
  {
    file: 'app/navModel.ts',
    match: /^(Beszélgetés|Edzés|Terhelés|Kiegészítők|Üzenőfal|Rólad|Emlékek|Én|Célok|Napló)$/,
    reason:
      'DOMAINS keeps the Hungarian domain names / tab labels / titles as SOURCE IDS (tests, pageIndex and the leltár key on them); ' +
      'what the screen shows goes through domainName / tabLabel / tabTitle and the frame catalog.',
  },
  {
    file: 'app/pageIndex.ts',
    match: /./,
    reason:
      'PAGE_INDEX (labels, hints) and NOT_INDEXED (reasons) are the Hungarian page inventory, keyed by route. pageLabel() already ' +
      'swaps in the catalog for the pages that have an English name; the rest wait for their own slice. Delete this entry when the ' +
      'inventory moves into the catalog.',
  },
  {
    file: 'shared/ui/folyadek/Msg.tsx',
    match: /^(étel|táplálkozás)$/,
    reason:
      'REPEATS is dedupe logic, not display: stored or hand-written Hungarian meta words that merely repeat the field name are dropped. ' +
      'It is compared against user/stored text, so the Hungarian words must stay.',
  },
]

const ACCENT = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/
const SRC_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url)))) // …/src

export interface Hit {
  line: number
  kind: 'string' | 'template' | 'jsx-text'
  text: string
}

/**
 * Scans TS/TSX source and returns every literal / JSX-text run that contains an accented letter.
 * Not a full parser: a hand-rolled tokenizer that knows comments, '…' "…" strings, `…${…}…`
 * templates (nesting any depth), and regex literals. Any accented letter in the remaining plain
 * code is JSX text (or an accented identifier — equally unwanted). Quote strings end at a newline,
 * so an apostrophe in JSX text cannot swallow the rest of the file.
 */
export function findHungarian(src: string): Hit[] {
  const hits: Hit[] = []
  let i = 0
  let line = 1
  const n = src.length

  const note = (kind: Hit['kind'], text: string, atLine: number) => {
    if (ACCENT.test(text)) hits.push({ line: atLine, kind, text: text.trim() })
  }
  const REGEX_PREV = /[(,=:[!&|?{};+\-*%~^]$/

  /** Plain code until `stopAtBrace` closes (template `${…}`) or EOF. */
  function code(stopAtBrace: boolean): void {
    let depth = 0
    let plain = ''
    let plainLine = line
    let lastSig = '' // last significant (non-space) character, for the regex heuristic
    const flushPlain = () => {
      // report only the text run around an accent, not all the markup between two strings
      for (const run of plain.matchAll(/[^<>{}]+/g)) note('jsx-text', run[0], plainLine + (plain.slice(0, run.index).match(/\n/g)?.length ?? 0))
      plain = ''
    }
    while (i < n) {
      const c = src[i]
      const d = src[i + 1]
      if (c === '\n') line++
      if (c === '/' && d === '/') {
        while (i < n && src[i] !== '\n') i++
        continue
      }
      if (c === '/' && d === '*') {
        i += 2
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++
          i++
        }
        i += 2
        continue
      }
      if (c === '\'' || c === '"') {
        flushPlain()
        const start = line
        let text = ''
        i++
        while (i < n && src[i] !== c && src[i] !== '\n') {
          if (src[i] === '\\') {
            text += src[i + 1] ?? ''
            i += 2
          } else text += src[i++]
        }
        if (src[i] === c) i++ // an unterminated one (apostrophe in JSX text) stops at the newline
        note('string', text, start)
        lastSig = c
        plainLine = line
        continue
      }
      if (c === '`') {
        flushPlain()
        i++
        template()
        lastSig = '`'
        plainLine = line
        continue
      }
      if (c === '/' && (lastSig === '' || REGEX_PREV.test(lastSig))) {
        // a regex literal: skip to the closing slash (outside a [class]) and its flags
        let inClass = false
        i++
        while (i < n && src[i] !== '\n' && (src[i] !== '/' || inClass)) {
          if (src[i] === '\\') i++
          else if (src[i] === '[') inClass = true
          else if (src[i] === ']') inClass = false
          i++
        }
        if (src[i] === '/') i++
        while (i < n && /[a-z]/i.test(src[i])) i++
        lastSig = ')'
        continue
      }
      if (stopAtBrace) {
        if (c === '{') depth++
        if (c === '}') {
          if (depth === 0) {
            flushPlain()
            i++
            return
          }
          depth--
        }
      }
      if (!/\s/.test(c)) lastSig = c
      if (plain === '') plainLine = line
      plain += c
      i++
    }
    flushPlain()
  }

  /** After the opening backtick: chunks and `${ … }` expressions until the closing backtick. */
  function template(): void {
    let chunk = ''
    let chunkLine = line
    while (i < n) {
      const c = src[i]
      if (c === '`') {
        note('template', chunk, chunkLine)
        i++
        return
      }
      if (c === '\\') {
        chunk += src[i + 1] ?? ''
        i += 2
        continue
      }
      if (c === '$' && src[i + 1] === '{') {
        note('template', chunk, chunkLine)
        chunk = ''
        i += 2
        code(true)
        chunkLine = line
        continue
      }
      if (c === '\n') line++
      chunk += c
      i++
    }
    note('template', chunk, chunkLine)
  }

  code(false)
  return hits
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p)
    return /\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) ? [p] : []
  })
}

function translatedFiles(): string[] {
  return TRANSLATED.flatMap((entry) => {
    const abs = join(SRC_DIR, entry)
    return statSync(abs).isDirectory() ? walk(abs) : [abs]
  })
}

const rel = (abs: string) => relative(SRC_DIR, abs).split('\\').join('/')

describe('findHungarian (the tokenizer)', () => {
  it('flags a JSX text node', () => {
    expect(findHungarian('const a = <p>Mentés kész</p>').map((h) => h.kind)).toEqual(['jsx-text'])
  })
  it('flags an aria-label attribute', () => {
    const hits = findHungarian('<button aria-label="Bezárás" />')
    expect(hits).toEqual([{ line: 1, kind: 'string', text: 'Bezárás' }])
  })
  it('flags a template literal, in its chunk and in a nested expression', () => {
    expect(findHungarian('const s = `Szia, én ${name}!`').map((h) => h.kind)).toEqual(['template'])
    expect(findHungarian('const s = `${a ? "Igen, így" : ""}`').map((h) => h.kind)).toEqual(['string'])
    expect(findHungarian('const s = `${`beágyazott ${x}`}`').map((h) => h.kind)).toEqual(['template'])
  })
  it('flags a string in an object literal, with its line', () => {
    const hits = findHungarian("const o = {\n  a: 1,\n  label: 'Súly',\n}")
    expect(hits).toEqual([{ line: 3, kind: 'string', text: 'Súly' }])
  })
  it('does not flag comments', () => {
    const src = [
      '// Magyar megjegyzés',
      '/* blokk: ünnep */',
      'const a = <p>{/* JSX megjegyzés: tűz */}Save</p>',
      "const b = 'plain' // záró megjegyzés",
    ].join('\n')
    expect(findHungarian(src)).toEqual([])
  })
  it('keeps // inside a string and quotes inside the other quote', () => {
    expect(findHungarian("const u = 'https://example.com/ő'").map((h) => h.text)).toEqual(['https://example.com/ő'])
    expect(findHungarian('const q = "it\'s fine"; const r = \'say "ok"\'')).toEqual([])
    expect(findHungarian("const e = 'it\\'s ő'").map((h) => h.text)).toEqual(["it's ő"])
  })
  it('ignores accent-free text and regex literals', () => {
    expect(findHungarian("const x = 'Save'; const y = /[áé]/.test(s)")).toEqual([])
  })
  it('survives an apostrophe in JSX text', () => {
    expect(findHungarian("<p>You've got it</p>\nconst b = 'Hűha'").map((h) => h.text)).toEqual(['Hűha'])
  })
})

describe('no hard-coded Hungarian in the translated areas', () => {
  const files = translatedFiles()
  const used = new Set<AllowEntry>()
  const allowed = (file: string, hit: Hit): boolean => {
    const entry = ALLOWLIST.find(
      (e) => e.file === file && (typeof e.match === 'string' ? e.match === hit.text : e.match.test(hit.text)),
    )
    if (entry) used.add(entry)
    return Boolean(entry)
  }

  it('finds the translated files', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('has no accented literal or JSX text outside the allowlist', () => {
    const offenders = files.flatMap((abs) => {
      const file = rel(abs)
      return findHungarian(readFileSync(abs, 'utf8'))
        .filter((hit) => !allowed(file, hit))
        .map((hit) => `${file}:${hit.line} (${hit.kind}) ${JSON.stringify(hit.text.slice(0, 70))}`)
    })
    expect(offenders).toEqual([])
  })

  it('has no stale allowlist entry', () => {
    // run the scan again so this test does not depend on the one above
    for (const abs of files) {
      const file = rel(abs)
      for (const hit of findHungarian(readFileSync(abs, 'utf8'))) allowed(file, hit)
    }
    expect(ALLOWLIST.filter((e) => !used.has(e)).map((e) => `${e.file} ${String(e.match)}`)).toEqual([])
  })

  it('only allowlists files that are in a translated area', () => {
    const inArea = new Set(files.map(rel))
    expect(ALLOWLIST.filter((e) => !inArea.has(e.file)).map((e) => e.file)).toEqual([])
  })
})
