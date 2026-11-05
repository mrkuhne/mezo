/* Lágy page probe (skill /lagy). Serve docs/design_2.0/prototypes first:
     python3 -m http.server 8757 --bind 127.0.0.1   (background, from docs/design_2.0/prototypes)
   Usage: node docs/design_2.0/prototypes/kepes/tools/probe.mjs [--page b/index.html] <route> [route…]
   e.g.   node …/probe.mjs '' kieg trendek konyha szamok meal-reggeli
   For every route at 390 and 320 wide: horizontal scroll, text under 12 px, taps under 40 px, broken
   images, page errors / HTTP errors; stitched screenshots go to $TMPDIR/lagy-probe/<w>-<route>-<n>.png.
   Exit code 1 when anything fails. Look at the screenshots — a clean run is not a design review. */
import fs from 'fs'; import os from 'os'; import path from 'path'; import {fileURLToPath} from 'url';
const here=path.dirname(fileURLToPath(import.meta.url));
const cands=[process.env.MEZO_PW,path.resolve(here,'../../../../../frontend/node_modules/@playwright/test/index.mjs'),'/Users/mrkuhne/Applications/Personal/Mezo/mezo/frontend/node_modules/@playwright/test/index.mjs'].filter(Boolean);
const pw=cands.find(p=>fs.existsSync(p));if(!pw){console.error('Playwright not found; set MEZO_PW');process.exit(2)}
const {chromium}=await import(pw);
let args=process.argv.slice(2),page='b/index.html';const pi=args.indexOf('--page');if(pi>=0){page=args[pi+1];args.splice(pi,2)}
const routes=args.length?args:[''];const out=path.join(os.tmpdir(),'lagy-probe');fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch();let bad=0;const errs=[];
for(const W of [390,320]){const p=await b.newPage({viewport:{width:1200,height:900}});
  p.on('pageerror',e=>errs.push(`${W} ${e.message}`));p.on('response',r=>{if(r.status()>=400)errs.push(`${W} HTTP ${r.status()} ${r.url().slice(-50)}`)});
  for(const route of routes){
    await p.goto(`http://127.0.0.1:8757/kepes/${page}?v=${Date.now()}#${route}`);
    await p.waitForSelector('#scroll .phead, #scroll .head, #scroll .top, #scroll .jp, #scroll .cer2, #scroll .lp, #scroll .nxbf',{timeout:15000}).catch(()=>errs.push(`${W} #${route}: no page rendered (did it throw?)`));
    await p.waitForTimeout(1600);
    const is320=()=>p.evaluate(()=>!!document.querySelector('#phone')?.classList.contains('w320'));
    if(W===320&&!(await is320())){await p.click('#t320',{timeout:3000}).catch(()=>{});await p.waitForTimeout(300)}
    /* never measure 390 and call it 320: a missing toggle once made every Edzés '320' run a silent 390 run */
    if((W===320)!==(await is320())){errs.push(`${W} #${route}: could not switch the phone to ${W} px`);bad++;continue}
    const r=await p.evaluate(()=>{const sc=document.querySelector('#scroll'),ph=document.querySelector('#phone');
      const small=new Set();const w=document.createTreeWalker(ph,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const el=n.parentElement;if(!n.textContent.trim()||!el.getClientRects().length)continue;const fs=parseFloat(getComputedStyle(el).fontSize);if(fs<11.95)small.add(n.textContent.trim().slice(0,18)+'('+fs+')')}
      const taps=[...ph.querySelectorAll('button,a,[role=button]')].filter(e=>e.getClientRects().length).map(e=>[String(e.className).slice(0,12),Math.round(e.getBoundingClientRect().width),Math.round(e.getBoundingClientRect().height)]).filter(([,w,h])=>w<40||h<40);
      const broken=[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src'));
      return {hscroll:sc.scrollWidth-sc.clientWidth,small:[...small],taps,broken}});
    const ok=!r.hscroll&&!r.small.length&&!r.taps.length&&!r.broken.length;if(!ok)bad++;
    console.log(`${ok?'ok  ':'FAIL'} ${W} #${route||'(Mai)'}`+(ok?'':' '+JSON.stringify(r)));
    const box=await (await p.$('#phone')).boundingBox();const H=await p.evaluate(()=>document.querySelector('#scroll').scrollHeight);
    for(let i=0;i<Math.min(6,Math.ceil(H/box.height));i++){await p.evaluate(y=>document.querySelector('#scroll').scrollTop=y,i*box.height);await p.waitForTimeout(150);
      fs.writeFileSync(path.join(out,`${W}-${(route||'mai').replace(/[^\w-]/g,'_')}-${i}.png`),await (await p.$('#phone')).screenshot())}
  }
  await p.close()}
await b.close();
if(errs.length){console.log('ERRORS',errs);bad++}
console.log(`screenshots: ${out}`);process.exit(bad?1:0);
