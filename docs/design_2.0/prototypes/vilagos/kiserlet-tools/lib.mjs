/* shared helpers for the alternative-prototype probes (skill /kiserlet). Serve docs/design_2.0/prototypes first:
   python3 -m http.server 8757 --bind 127.0.0.1   (background, from docs/design_2.0/prototypes) */
import fs from 'fs'; import os from 'os'; import path from 'path'; import {fileURLToPath} from 'url';
const here=path.dirname(fileURLToPath(import.meta.url));
const cands=[process.env.MEZO_PW,path.resolve(here,'../../../../../frontend/node_modules/@playwright/test/index.mjs'),'/Users/mrkuhne/Applications/Personal/Mezo/mezo/frontend/node_modules/@playwright/test/index.mjs'].filter(Boolean);
const pw=cands.find(f=>fs.existsSync(f)); if(!pw)throw new Error('playwright not found; set MEZO_PW to .../@playwright/test/index.mjs');
const {chromium}=await import(pw);
export const PORT=+(process.env.PORT||8757);
export const OUT=process.env.OUT||path.join(os.tmpdir(),'kiserlet-tools');fs.mkdirSync(OUT,{recursive:true});
export const URL=r=>`http://127.0.0.1:${PORT}/kiserlet-napom-grafika.html?v=${Date.now()}#w-${r}`;
export async function open(w=390,h=900,dsf=2){const b=await chromium.launch();const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:dsf});const errs=[];p.on('pageerror',e=>errs.push(String(e)));return {b,p,errs}}
export async function load(p,r){await p.goto(URL(r));await p.waitForSelector('#phone .scroll',{timeout:15000});await p.waitForTimeout(+(process.env.WAIT||700));await p.evaluate(()=>document.querySelectorAll('#phone .rise').forEach(e=>e.style.animation='none'))}
/* every route of every domain, from the live registry (FREG), without the -lista originals and the meta pages */
export async function allRoutes(p){await load(p,'nap-mai');const R=await p.evaluate(()=>{const o={};for(const d of Object.keys(window.FREG||{}))o[d]=Object.keys(FREG[d].routes||{});return o});
  fs.writeFileSync(path.join(OUT,'routes.json'),JSON.stringify(R));return Object.entries(R).flatMap(([d,rs])=>rs.map(x=>d+'-'+x)).filter(r=>!/-lista$|ikonok|mindenoldal/.test(r))}
