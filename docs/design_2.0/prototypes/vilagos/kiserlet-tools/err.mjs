/* node err.mjs <route>... — page errors and empty pages for the given routes (e.g. fuel-trendek) */
import {open,load} from './lib.mjs';
const {b,p}=await open(390,900,1);const errs=[];p.on('pageerror',e=>errs.push(e.message));
for(const r of process.argv.slice(2)){errs.length=0;try{await load(p,r)}catch(e){console.log('LOAD',r,e.message.split('\n')[0]);continue}
  const empty=await p.evaluate(()=>/még nincs kidolgozva/.test(document.querySelector('#phone').innerText));console.log(r,errs.length?'ERR '+errs.join(' | '):'ok',empty?'EMPTY':'')}
await b.close();
