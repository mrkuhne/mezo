/* node small.mjs [route...] — at 320 px, visible text under 12 px (header badges excepted); all routes when none given */
import {open,load,allRoutes} from './lib.mjs';
const {b,p}=await open(320,800,1);const list=process.argv.length>2?process.argv.slice(2):await allRoutes(p);
for(const r of list){try{await load(p,r)}catch{continue}
 const out=await p.evaluate(()=>{const res=new Set();const sc=document.querySelector('#phone .scroll');const w=document.createTreeWalker(sc,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){const el=n.parentElement;if(!n.textContent.trim()||!el.getClientRects().length||el.closest('.fh-ib'))continue;
   const fs=el.closest('svg')?el.getBoundingClientRect().height*0.8:parseFloat(getComputedStyle(el).fontSize);if(fs<11.95)res.add(n.textContent.trim().slice(0,24)+' ('+fs.toFixed(1)+')')}return [...res]});
 if(out.length)console.log(r,'::',out.slice(0,12).join(' ; '),out.length>12?`… +${out.length-12}`:'')}
await b.close();
