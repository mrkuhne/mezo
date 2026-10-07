// Does each living prototype's fixed Artifact link show what is on disk? (mezo-ov71l rule:
// a lagging link is a debt the next publishing-capable session pays before its own work.)
//
//   node docs/design_2.0/prototypes/elo/_link-status.mjs                 status table; exit 1 if a link lags
//   node docs/design_2.0/prototypes/elo/_link-status.mjs --stamp edzes   set the page's "Állapot" date to today
//   node docs/design_2.0/prototypes/elo/_link-status.mjs --published edzes nap
//                                                                        record that these were just published
//
// Order for a change: edit → --stamp → commit → publish to the fixed URL → --published → commit.
// A session that cannot publish skips the last two steps and files a `publish-debt` bd issue.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const DOMAINS = ['nap', 'edzes', 'fuel', 'mezo', 'en']
const recPath = join(dir, '_published.json')
const rec = existsSync(recPath) ? JSON.parse(readFileSync(recPath, 'utf8')) : {}
const read = (d) => readFileSync(join(dir, `${d}.html`), 'utf8')
const sha = (s) => createHash('sha256').update(s).digest('hex')
const stampOf = (html) => html.match(/<aside class="notes" id="notes"[^>]*data-allapot="([^"]+)"/)?.[1] ?? null
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' })

const [mode, ...args] = process.argv.slice(2)
const pick = () => {
  const bad = args.filter((d) => !DOMAINS.includes(d))
  if (!args.length || bad.length) throw new Error(`name domains from: ${DOMAINS.join(', ')}${bad.length ? ` (unknown: ${bad})` : ''}`)
  return args
}

if (mode === '--stamp') {
  for (const d of pick()) {
    let html = read(d)
    if (!/<aside class="notes" id="notes"/.test(html)) throw new Error(`${d}: no panel-kit side panel`)
    html = html.replace(/(<aside class="notes" id="notes")(?: data-allapot="[^"]*")?/, `$1 data-allapot="${today()}"`)
    writeFileSync(join(dir, `${d}.html`), html)
    console.log(`állapot → ${d}.html (${today()})`)
  }
} else if (mode === '--published') {
  for (const d of pick()) {
    const html = read(d)
    rec[d] = { sha256: sha(html), allapot: stampOf(html), published: today() }
    console.log(`published → ${d} (${today()})`)
  }
  writeFileSync(recPath, JSON.stringify(rec, null, 2) + '\n')
} else {
  let lag = 0
  for (const d of DOMAINS) {
    const html = read(d), r = rec[d]
    const ok = r && r.sha256 === sha(html)
    if (!ok) lag++
    console.log(`${ok ? '✅' : '🔶'} ${d.padEnd(6)} file: ${stampOf(html) ?? '—'}   link: ${r ? `${r.allapot ?? '—'} (published ${r.published})` : 'never recorded'}${ok ? '' : '   ← LEMARADT: publish, then --published'}`)
  }
  process.exit(lag ? 1 : 0)
}
