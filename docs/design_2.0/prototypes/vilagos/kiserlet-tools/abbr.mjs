/* node abbr.mjs — abbreviations still visible (contexts per token). Day letters, monograms, units and names are expected leftovers */
import {open,load,allRoutes} from './lib.mjs';
import fs from 'fs';


const RX="(?<![\\p{L}])(kb\\.|Kb\\.|pl\\.|Pl\\.|db\\b|ism\\.?|min\\.?|max\\.?|XP|RPE|RIR|HRV|NOVA|\\d+\\s?p(?![\\p{L}])|\\d+\\s?mp(?![\\p{L}])|\\d+\\s?ó(?![\\p{L}])|szept(?![\\p{L}.])|márc(?![\\p{L}])|(?:jan|febr|márc|ápr|máj|jún|júl|aug|szept|okt|nov|dec)\\.|Szept\\.|Okt\\.|Aug\\.|Hét|Pén|Vas|Fiz|Edz|Tápl|Alv|Lel|Fegy|Önv|Cikl|Ál|Ro|Mo|Co|Sz|Rear|Me|É|stb\\.|ill\\.|vs\\.?|min)(?![\\p{L}])";
const {b,p}=await open(390,900,1);const agg={};const list=(await allRoutes(p)).filter(r=>!/mindenoldal/.test(r));
for(const r of list){try{await load(p,r)}catch{continue}
 const hits=await p.evaluate(RX=>{const re=new RegExp(RX,'gu');const out=[];const sc=document.querySelector('#phone');const w=document.createTreeWalker(sc,NodeFilter.SHOW_TEXT);let n;
  while(n=w.nextNode()){const el=n.parentElement;if(!el||!el.getClientRects().length)continue;const t=n.textContent;for(const m of t.matchAll(re)){out.push(m[1]+' ⟨'+t.slice(Math.max(0,m.index-25),m.index+35).replace(/\s+/g,' ')+'⟩')}}return [...new Set(out)]},RX);
 hits.forEach(h=>{const k=h.split(' ')[0];(agg[k]=agg[k]||[]).push(r+': '+h.slice(k.length+1))})}
await b.close();
for(const [k,v] of Object.entries(agg)){console.log('##',k,v.length);v.slice(0,6).forEach(x=>console.log('   ',x))}
