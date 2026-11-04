/* node narrow.mjs — at 320 px, rows of 5+ tap targets narrower than 40 px */
import {open,load,allRoutes} from './lib.mjs';
const {b,p}=await open(320,800,1);const list=await allRoutes(p);
for(const r of list){try{await load(p,r)}catch{continue}
 const out=await p.evaluate(()=>{const res=[];const sc=document.querySelector('#phone .scroll');if(!sc)return res;
  sc.querySelectorAll('button,[data-go],[data-sheet],[data-toast]').forEach(e=>{const R=e.getBoundingClientRect();if(!R.width||R.width>=40||R.height<40)return;
   const par=e.parentElement;const sib=[...par.children].filter(x=>{const q=x.getBoundingClientRect();return Math.abs(q.top-R.top)<4&&q.width<44});
   if(sib.length>=5)res.push(String(par.className.baseVal??par.className)+' w'+R.width.toFixed(0)+' n'+sib.length)});return [...new Set(res)]});
 if(out.length)console.log(r,'::',out.join(' ; '))}
await b.close();
