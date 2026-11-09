// Turns the Lágy G() glyph table into SVG imagesets for the Boop spike's asset catalog.
import fs from 'node:fs';
const [,, partPath, napPath, outDir] = process.argv;
let src = fs.readFileSync(partPath, 'utf8');
const nap = fs.readFileSync(napPath, 'utf8');
for (const f of [napPath, ...process.argv.slice(5)]) {
  const t = fs.readFileSync(f, 'utf8');
  let i = 0;
  while ((i = t.indexOf('Object.assign(SH,{', i)) >= 0) {
    let j = i + 'Object.assign(SH,'.length, depth = 0, q = null;
    for (; j < t.length; j++) {
      const c = t[j];
      if (q) { if (c === '\\') { j++; continue } if (c === q) q = null; continue }
      if (c === '`' || c === "'" || c === '"') { q = c; continue }
      if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) break }
    }
    src += '\nObject.assign(SH,' + t.slice(i + 'Object.assign(SH,'.length, j + 1) + ');';
    i = j;
  }
}
const ctx = {};
new Function('ctx', src + '\nctx.SH=SH;ctx.PAL=PAL;')(ctx);
const { SH, PAL } = ctx;
const want = [
  ['sun','sun'],['sun','ink'],['moon','sky'],['bowl','sage'],['dumbbell','berry'],['plate','deep'],['spark','deep'],['spark','sage'],
  ['person','sage'],['drop','sky'],['check','sage'],['check','deep'],['bell','cream'],['star','sun'],['clock','sky'],['scale','sage'],
  ['bolt','sun'],['book','sage'],['heart','berry'],['shoe','peach'],['chat','sky'],['pen','sun'],['moon','ink'],['bowl','sun'],
  ['dumbbell','ink'],['scale','ink'],['chat','ink'],['check','ink'],['star','ink'],['clock','peach'],['bolt','peach'],['flame','peach'],['person','peach'],['honey','sun'],['leaf','sage'],['camera','ink'],['repeat','peach'],['heart','peach'],['clock','ink'],['back','cream'],['fish','peach'],['ball','sun'],['medal','sun'],['repeat','deep'],['flame','deep'],['chat','cream'],['search','ink'],['heart','cream'],['moon','cream'],['bowl','cream'],['spark','cream'],['shoe','cream'],['chart','deep'],['link','deep'],['bolt','ink'],['plus','ink'],
];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/Contents.json`, JSON.stringify({ info: { author: 'xcode', version: 1 } }));
let n = 0;
for (const [name, pal] of want) {
  if (!SH[name]) { console.log('missing', name); continue; }
  const [a, b] = PAL[pal];
  const u = 'g', h = 'gh';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><defs><linearGradient id="${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><linearGradient id="${h}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>${SH[name](u, h).replaceAll('currentColor', b)}</svg>`;
  const set = `${outDir}/g-${name}-${pal}.imageset`;
  fs.mkdirSync(set, { recursive: true });
  fs.writeFileSync(`${set}/g.svg`, svg);
  fs.writeFileSync(`${set}/Contents.json`, JSON.stringify({
    images: [{ filename: 'g.svg', idiom: 'universal' }],
    info: { author: 'xcode', version: 1 },
    properties: { 'preserves-vector-representation': true },
  }));
  n++;
}
console.log('wrote', n);
