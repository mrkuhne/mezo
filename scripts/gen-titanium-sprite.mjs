#!/usr/bin/env node
// Builds the namespaced Titanium 3D icon sprite (üveg style bible §4, mezo-me75u.1).
// Source: the 62 symbols + defs of docs/design_2.0/prototypes/companion-titanium/nap.html,
// verbatim art, ids namespaced so they can live beside the clay sprite in one DOM:
//   symbol  i-<name>  →  t-<name>
//   defs    <name>    →  tg-<name>   (gradients, the #shadow filter, mg-* groups)
// Custom icons (bible §4 recipe) live in docs/design_2.0/assets/titanium-custom.svg and are
// appended as-is (already namespaced). Output: docs/design_2.0/assets/titanium-icons.svg,
// copied verbatim to frontend/src/shared/ui/clay/titanium-icons.svg.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const src = readFileSync('docs/design_2.0/prototypes/companion-titanium/nap.html', 'utf8')
const start = src.indexOf('<svg class="sprite"')
const end = src.indexOf('</svg>', start)
let body = src.slice(src.indexOf('>', start) + 1, end)
const ids = [...body.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
const rename = (id) => (id.startsWith('i-') ? `t-${id.slice(2)}` : `tg-${id}`)
for (const id of ids) {
  const to = rename(id)
  body = body
    .replaceAll(`id="${id}"`, `id="${to}"`)
    .replaceAll(`url(#${id})`, `url(#${to})`)
    .replaceAll(`href="#${id}"`, `href="#${to}"`)
}
const custom = existsSync('docs/design_2.0/assets/titanium-custom.svg')
  ? readFileSync('docs/design_2.0/assets/titanium-custom.svg', 'utf8')
      .replace(/^[\s\S]*?<!-- symbols -->/, '').replace(/<\/svg>\s*$/, '')
  : ''
const out = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">\n${body.trim()}\n${custom.trim()}\n</svg>\n`
writeFileSync('docs/design_2.0/assets/titanium-icons.svg', out)
writeFileSync('frontend/src/shared/ui/clay/titanium-icons.svg', out)
const n = [...out.matchAll(/<symbol id="(t-[^"]+)"/g)].map((m) => m[1])
console.log(`${n.length} symbols:`, n.join(' '))
