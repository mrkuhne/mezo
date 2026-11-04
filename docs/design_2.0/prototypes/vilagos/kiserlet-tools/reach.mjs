import {open,load} from './lib.mjs';
import fs from 'fs';
import path from 'path';
import {OUT,allRoutes} from './lib.mjs';
const {b,p,errs}=await open(390,900,1);
await allRoutes(p);const R=JSON.parse(fs.readFileSync(path.join(OUT,'routes.json')));
process.env.WAIT=350;
const seen=new Map();const q=[];const edges={};
for(const d of Object.keys(R))q.push(d+'-mai');
const toastsBy={};
while(q.length&&seen.size<600){const node=q.shift();if(seen.has(node))continue;
 await load(p,node);
 const info=await p.evaluate(()=>{const D=K.D;const reg=(FREG||{})[D]||{};const root=document.querySelector('#phone');
  const gos=new Set(),doms=new Set(),toasts=new Set(),sheets=[];
  const scan=(el)=>{el.querySelectorAll('[data-go]').forEach(e=>gos.add(e.dataset.go));el.querySelectorAll('[data-dom]').forEach(e=>doms.add(e.dataset.dom));el.querySelectorAll('[data-toast]').forEach(e=>toasts.add(e.dataset.toast))};
  scan(root);
  root.querySelectorAll('[data-sheet]').forEach(e=>{const f=reg.sheets&&reg.sheets[e.dataset.sheet];if(!f){sheets.push('MISSING:'+e.dataset.sheet);return}try{const t=document.createElement('div');t.innerHTML=f(e.dataset.arg||'');scan(t);sheets.push(e.dataset.sheet)}catch(x){sheets.push('ERR:'+e.dataset.sheet)}});
  return {D,R:K.R,ARG:K.ARG,gos:[...gos],doms:[...doms],toasts:[...toasts],sheets:[...new Set(sheets)],empty:/még nincs kidolgozva/.test(root.innerText)}});
 seen.set(node,info);const D=info.D;edges[node]=[];
 for(const g of info.gos){if(g==='indito'||g==='mindenoldal'||g==='atmenet'||g==='ikonok'||g==='ikonok9'||/-lista/.test(g))continue;const n=D+'-'+g;edges[node].push(n);if(!seen.has(n))q.push(n)}
 for(const dm of info.doms){const n=dm+'-mai';if(!seen.has(n))q.push(n)}
 toastsBy[node]=info.toasts;
}
const reachedBase=new Set([...seen.keys()].map(k=>k.split('.')[0]));
const unreached={};for(const d of Object.keys(R)){unreached[d]=R[d].filter(r=>!/-lista$/.test(r)&&!['indito','mindenoldal','atmenet','ikonok','ikonok9'].includes(r)&&!reachedBase.has(d+'-'+r))}
const bad=[...seen].filter(([k,v])=>v.empty||v.sheets.some(s=>/^(MISSING|ERR)/.test(s))).map(([k,v])=>[k,v.empty?'EMPTY':'',v.sheets.filter(s=>/^(MISSING|ERR)/.test(s))]);
fs.writeFileSync(path.join(OUT,'reach.json'),JSON.stringify({nodes:Object.fromEntries(seen),edges},null,1));
console.log('visited',seen.size,'errs',errs.length,errs.slice(0,3));
console.log('UNREACHED',JSON.stringify(unreached,null,1));
console.log('BAD',JSON.stringify(bad));
await b.close();
