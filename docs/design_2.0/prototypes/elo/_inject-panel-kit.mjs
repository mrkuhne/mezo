// Copies the shared desktop frame (_panel-kit.html: pinned phone, grouped side panel that
// follows the route, the "Legutóbb változott" block) into every living prototype, so each
// stays a single self-contained file for its Artifact. Re-run after editing the kit:
//   node docs/design_2.0/prototypes/elo/_inject-panel-kit.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const kit = readFileSync(join(dir, '_panel-kit.html'), 'utf8').trim()
const re = /<!-- panel-kit:start[\s\S]*?<!-- panel-kit:end -->/

for (const file of ['nap.html', 'edzes.html', 'fuel.html', 'mezo.html', 'en.html']) {
  const path = join(dir, file)
  let html = readFileSync(path, 'utf8')
  if (re.test(html)) html = html.replace(re, () => kit)
  else {
    // after the markup, before the voice kit and the page's own script, so panelSync()
    // exists when the page first renders
    const at = html.indexOf('<!-- hang-kit:start')
    if (at < 0) throw new Error(`${file}: no hang-kit marker to anchor on`)
    html = html.slice(0, at) + kit + '\n' + html.slice(at)
  }
  writeFileSync(path, html)
  console.log(`panel-kit → ${file}`)
}
