/* node conv.mjs — which pages are in the new system (mx / ex-hero) and which still wear the old cards (fh-card / fh-hero) */
import {open,load,allRoutes} from './lib.mjs';
const {b,p}=await open(390,900,1);const list=await allRoutes(p);const res={};
for(const r of list){try{await load(p,r)}catch{continue}
 const k=await p.evaluate(()=>{const sc=document.querySelector('#phone .scroll');if(!sc)return 'x';const nw=sc.querySelectorAll('.mx,.ex-hero,.n7-h,.mx-s,.dv-s,.n8-c,.w3-rw').length;const old=sc.querySelectorAll('.fh-card,.fh-hero').length;return nw&&!old?'new':!nw&&old?'old':nw&&old?'mixed':'other'});
 (res[k]=res[k]||[]).push(r)}
await b.close();for(const k in res)console.log(k,res[k].length,'\n  ',res[k].join(' '));
