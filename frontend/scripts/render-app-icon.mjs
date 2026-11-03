// Renders the installed app icon set (PWA, maskable, Apple touch, favicon) from the approved
// Folyadék "Csepp" mark in docs/design_2.0/assets (mezo-n4wf5.14). Run from frontend/:
//   node scripts/render-app-icon.mjs
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const assets = `${root}docs/design_2.0/assets/`;
const pub = `${root}frontend/public/`;
const regular = readFileSync(`${assets}logo-csepp.svg`, 'utf8');
const maskable = readFileSync(`${assets}logo-csepp-maskable.svg`, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  return page.screenshot({ type: 'png', omitBackground: false });
}

const out = {
  'pwa-64x64.png': [regular, 64],
  'pwa-192x192.png': [regular, 192],
  'pwa-512x512.png': [regular, 512],
  'maskable-icon-512x512.png': [maskable, 512],
  'apple-touch-icon-180x180.png': [regular, 180],
};
for (const [name, [svg, size]] of Object.entries(out)) writeFileSync(pub + name, await png(svg, size));

// favicon.ico: an ICO directory holding PNG-encoded 16/32/48 images (supported by every current browser).
const sizes = [16, 32, 48];
const imgs = [];
for (const s of sizes) imgs.push(await png(regular, s));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(imgs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += imgs[i].length;
});
writeFileSync(`${pub}favicon.ico`, Buffer.concat([header, ...imgs]));
copyFileSync(`${assets}logo-csepp.svg`, `${pub}logo-csepp.svg`);

await browser.close();
console.log('App icons rendered into frontend/public.');
