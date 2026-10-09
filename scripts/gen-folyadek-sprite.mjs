#!/usr/bin/env node
// Builds the Folyadék-jel sprite (bible §5, mezo-n4wf5.1) from docs/design_2.0/assets/folyadek-glyphs.json.
// Ids stay t-<name>, so every Icon3D / ContentIcon consumer switches at once.
import { readFileSync, writeFileSync } from 'node:fs'
const gly = JSON.parse(readFileSync('docs/design_2.0/assets/folyadek-glyphs.json', 'utf8'))
const defs = '<defs><clipPath id="tc-lv"><path d="M-2 37Q6 32 14 37T30 37T46 37T66 37V70H-2Z"/></clipPath><clipPath id="tc-hx"><path d="M0 0H32V64H0Z"/></clipPath></defs>'
const syms = Object.entries(gly).map(([k, inner]) => `<symbol id="t-${k}" viewBox="0 0 64 64">${inner}</symbol>`).join('\n')
writeFileSync('frontend/src/shared/ui/clay/titanium-icons.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">\n${defs}\n${syms}\n</svg>\n`)
console.log(Object.keys(gly).length, 'glyphs')
