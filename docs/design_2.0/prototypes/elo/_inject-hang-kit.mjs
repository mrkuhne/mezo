// Copies the shared voice kit (_hang-kit.html) into every living prototype, so each stays a
// single self-contained file for its Artifact. Re-run after editing the kit:
//   node docs/design_2.0/prototypes/elo/_inject-hang-kit.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const kit = readFileSync(join(dir, '_hang-kit.html'), 'utf8').trim()
const DOMAINS = { 'nap.html': 'nap', 'edzes.html': 'train', 'fuel.html': 'fuel', 'mezo.html': 'mezo', 'en.html': 'en' }
const block = (d) => kit.replace('<script>', () => `<script>window.HANG_DOMAIN='${d}';</script>\n<script>`)
const re = /<!-- hang-kit:start[\s\S]*?<!-- hang-kit:end -->/

for (const [file, domain] of Object.entries(DOMAINS)) {
  const path = join(dir, file)
  let html = readFileSync(path, 'utf8')
  if (re.test(html)) html = html.replace(re, () => block(domain))
  else {
    // before the page's own first <script>, so VF() exists when the page renders
    const at = html.search(/<script[\s>]/)
    html = html.slice(0, at) + block(domain) + '\n' + html.slice(at)
  }
  writeFileSync(path, html)
  console.log(`hang-kit → ${file} (${domain})`)
}
