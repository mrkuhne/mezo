/* node txt.mjs <route>... — visible text of the page (N=chars, default 900) */
import {open,load} from './lib.mjs';
const {b,p}=await open(390,900,1);
for(const r of process.argv.slice(2)){await load(p,r);const t=await p.evaluate(()=>document.querySelector('#phone .scroll').innerText.replace(/\n+/g,' | '));console.log('\n##',r,'\n',t.slice(0,+(process.env.N||900)))}
await b.close();
