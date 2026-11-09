/* Én domain — the Lágy look, round 1 (owner OK 2026-11-09, mezo-pi0jf): five tabs (owner: Súly and Alvás as their
   own tabs) — Hol tartok · Súly · Alvás · Célok · Napló — and everything under Célok (a goal, the new-goal wizard,
   Jelek, the weight goal and its parts, the new weight goal wizard), night mode, the sheets. Round 2 adds the deep
   pages under Hol tartok (week analysis, Fejlődés, Emberek, Értesítések); until then their links lead to the
   nearest existing page. Content is invented and real-looking; the owner's real data never goes into a page. */
(()=>{
document.head.insertAdjacentHTML('beforeend',`<style>
/* ── Én ── */
.euid{display:flex;align-items:center;gap:12px;padding:14px 16px;width:100%;border:0;text-align:left;color:var(--ink)}
.euid .mono{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--sage2),var(--deep));display:grid;place-items:center;font:800 22px var(--d);color:#fff;flex:0 0 auto}
.euid div{flex:1;min-width:0}.euid b{display:block;font:700 16px var(--d)}.euid .chips{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}.euid>.g{font-size:16px}
.euline{padding:14px 14px 10px;overflow:hidden}.eust button{max-width:100%;white-space:normal;text-align:left}
.euline>svg{width:100%;height:auto;display:block}
.euline .eubig{display:flex;align-items:baseline;gap:8px;padding:0 4px 6px}.euline .eubig b{font:800 34px/1 var(--d);letter-spacing:-.03em;color:#fff}.euline .eubig small{font:700 12.5px var(--b);color:rgba(255,255,255,.8)}
.eust{display:flex;gap:6px;flex-wrap:wrap;padding:6px 4px 0}.eust button{min-height:40px;padding:0 12px;border-radius:999px;border:0;background:rgba(255,255,255,.14);color:#fff;font:700 12.5px var(--b);display:flex;align-items:center;gap:6px}.eust button.on{background:#F4C860;color:#1E2321}.eust .g{font-size:15px}
.eucap{margin:8px 4px 0;font:600 13px/1.4 var(--b);color:rgba(255,255,255,.88);min-height:18px}
.eugl{display:grid;gap:10px}
.eugl a,.eugl button{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 14px 12px 12px;border-radius:22px;background:#fff;box-shadow:var(--sh);text-decoration:none;color:var(--ink);border:0;text-align:left;width:100%}
.eugl img{width:44px;height:44px;border-radius:50%;object-fit:cover}.eugl b{display:block;font:600 15px var(--d)}.eugl .eudots{display:flex;gap:4px;margin-top:6px}.eugl .eudots i{width:10px;height:10px;border-radius:50%;background:rgba(30,35,33,.12)}.eugl .eudots i.on{background:var(--sage)}
.eugl small{display:block;font:700 12px var(--b);color:var(--ink2)}.eugl .cnt{display:grid;justify-items:end;gap:4px;font:700 13px var(--d)}.eugl .cnt small{font:700 12px var(--b);color:var(--ink2)}
.eutiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.eutiles button{position:relative;height:130px;border-radius:24px;overflow:hidden;border:0;padding:14px;text-align:left;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;color:#fff;background:#1E2321}
.eutiles img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.eutiles button::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,20,18,.05),rgba(16,20,18,.86))}.eutiles button>:not(img){position:relative;z-index:1}.eutiles b{font:700 18px var(--d)}.eutiles small{font:700 12.5px var(--b);opacity:.9}
.euper{display:flex;gap:4px;padding:4px;border-radius:999px;background:#fff;box-shadow:var(--sh)}.euper button{flex:1;min-height:40px;border:0;border-radius:999px;background:none;font:700 13px var(--b);color:var(--ink2)}.euper button.on{background:var(--ink);color:#fff}
.euch{padding:14px}.euch>svg{width:100%;height:auto;display:block}
.eulg{display:flex;flex-wrap:wrap;gap:12px;padding:8px 2px 0}.eulg span{display:flex;align-items:center;gap:6px;font:700 12px var(--b);color:var(--ink2)}.eulg i{width:14px;height:4px;border-radius:2px;display:block}
.euwk>div{border-top:1px solid var(--line)}.euwk>div:first-child{border-top:0}
.euwk .wh{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;width:100%;min-height:56px;padding:10px 0;border:0;background:none;text-align:left;color:var(--ink)}
.euwk .wh b{display:block;font:600 14px var(--d)}.euwk .wh small{font:700 12px var(--b);color:var(--ink2)}.euwk .wh .d{font:700 14px var(--d)}.euwk .wh .d.dn{color:var(--deep)}.euwk .wh .d.up{color:#B5642E}.euwk .wh .g{font-size:14px;transition:transform .2s}.euwk .open .wh .g{transform:rotate(90deg)}
.euwk .days{display:none;padding:0 0 12px}.euwk .open .days{display:grid;gap:6px}.euwk .days span{display:flex;justify-content:space-between;font:700 13px var(--b);color:var(--ink2);padding:4px 10px;border-radius:10px;background:var(--paper)}.euwk .days b{color:var(--ink)}
.euspark{width:64px;height:24px}
.w320 .euline .eubig b{font-size:28px}
</style>`);

const ENTABS=[['Hol tartok','en'],['Súly','en-suly'],['Alvás','en-alvas'],['Célok','en-celok'],['Napló','en-naplo']];
const sec=(i,t,link,body,first)=>`<section class="sec rise ${first?'first':''}" style="--i:${i}"><div class="sh"><h3>${t}</h3>${link||''}</div>${body}</section>`;
const lnk=(h,t)=>`<a href="#${h}">${t} ${G('chev')}</a>`;
const rowsC=(L,cls='')=>`<div class="card pad ${cls}">${L.map(([ic,pal,b,s,a,v])=>`<div class="row ${a?'tap':''}" ${a?`role="button" tabindex="0" ${a}`:''}>${G(ic,pal)}<div><b>${b}</b><small>${s}</small></div>${v!=null?v:a?G('chev','ink','chev'):''}</div>`).join('')}</div>`;
const dls=L=>`<div class="dlist one">${L.map(([p,t,c,a])=>`<article class="dl ${a?'tap':''}" ${a?`role="button" tabindex="0" ${a}`:''}><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${t}</strong><div class="chips">${c}</div></div>${a?G('chev','ink','chev'):''}</article>`).join('')}</div>`;
const trio=(L,t='t-sun')=>`<div class="card trio ${t}">${L.map(([ic,pal,v,l])=>`<div>${G(ic,pal)}<b>${v}</b><small>${l}</small></div>`).join('')}</div>`;
const deepBars=(rv,unit,p,c,bars)=>`<div class="card gy g1 deep pre">${ring({d:96,sw:10,p,c,val:rv,unit})}<div class="bars">${bars.map(([l,v,w,col])=>`<div class="br"><span>${l}</span><b>${v}</b><u><i style="--w:${w}%;background:${col||'#A8D5BA'}"></i></u></div>`).join('')}</div></div>`;
const ch=(t,c='')=>`<span class="chip ${c}">${t}</span>`;

/* ── data ── */
const W12=[82.2,81.9,81.6,81.0,80.6,80.1,79.8,79.5,79.3,79.0,78.7,78.4];
const STATIONS=[[2,'Tempó átállítva','július 8.: a heti fogyás −0,5 kilóra lassítva'],[5,'80 kiló alatt','augusztus 19.: először 80 alatt a heti átlag'],[8,'Új képesség: Páncélzat','szeptember 2.: a fehérje 30 napja megvan'],[11,'Új mélypont','szeptember 24.: 78,4 kiló, a legalacsonyabb eddig']];
const GOALS=[{k:'kockahas',t:'Kockahas',dir:'tartja',d:[1,1,0,1,1,0,1],today:'3 / 5',pct:71,ph:'edz-izom',area:'Egészség',why:'Hogy nyáron ne kelljen a pólót magamon hagyni.',ift:'Ha este 21 után éhes vagyok, akkor túrót eszem, nem nasit.',pil:[['Fehérje-nap','a Fuelből',86],['Hasizom-edzés','az Edzésből',60],['Esti nasi nélkül','a naplóból',72],['Alvás 7 óra fölött','az alvásból',null]]},
  {k:'mellekprojekt',t:'Mellékprojekt',dir:'emelkedik',d:[1,0,1,1,0,1,1],today:'2 / 3',pct:64,ph:'kave',area:'Teljesítmény',why:'Hogy jövő nyárra legyen egy második lábam.',ift:'Ha szerdán sokáig dolgozom, akkor csütörtökön reggel írok egy órát.',pil:[['Fókuszóra reggel','a rutinból',68],['Heti egy kész lépés','a naplóból',55],['Képernyő este 22-ig','a rutinból',40]]},
  {k:'baratok',t:'Több idő a barátokkal',dir:'emelkedik',d:[0,0,1,0,1,1,0],today:'1 / 2',pct:48,ph:'nap-baratok',area:'Kapcsolatok',why:'Mert a jó heteim mindig emberekkel teltek.',ift:'Ha péntek este nincs edzés, akkor felhívok valakit.',pil:[['Találkozó a héten','az Emberekből',50],['Hívás a családnak','a naplóból',70],['Röpi a csapattal','az Edzésből',90]]}];
const PARKED={k:'spanyol',t:'Spanyol B2',ph:'nap-lista'};
const ES={per:'30',wkOpen:{0:1},older:false,parked:false,goalSt:{},gview:'het',st:null,dec:0,decNote:'',naplo:false,del:''};

/* ── Hol tartok ── */
function hub(st=''){
  if(st==='ures')return `${phead('Hol tartok',{ph:'en-futam.jpg',eb:'Az első heted',title:'Itt fogod látni, hol tartasz',sub:'Hétfőn jön az első heti összegzés.',btn:`${G('scale','ink')}Mérj most`,attrs:'data-sheet="enWeight"',tabs:ENTABS})}
    <section class="sec rise first" style="--i:1"><button class="card euid" data-go="nap-kuldetesek"><span class="mono">D</span><div><b>Dani</b><div class="chips">${ch('1. szint · az első napjaid')}</div></div>${G('chev','ink')}</button></section>
    ${sec(2,'Életvonal','',`<div class="card npempty"><img src="${PH('en-merleg-sq.jpg')}" alt=""><b>Még kevés a mérés</b><p>Három reggeli mérés után megrajzolom, merre tartasz.</p><button class="pill soft" data-sheet="enWeight">Mérj most</button></div>`)}
    ${sec(3,'Célok','',`<div class="eugl"><button data-go="en-celuj-1" style="border:1.5px dashed rgba(30,35,33,.2);box-shadow:none;background:transparent">${G('plus','sage')}<div><b>Első cél</b></div><span></span></button></div>`)}
    ${mzCard('Az első héten <em>csak figyelünk</em>. Mérj reggelente, és hétfőn megmutatom, mi mozdult.')}</div>`;
  const reached=st==='celelerve',W=reached?[82.2,81.4,80.6,79.7,78.8,77.9,76.9,75.8,74.9,74.1,73.4,72.9]:W12;
  return `${phead('Hol tartok',{ph:'en-futam.jpg',eb:'Szept. 21–27. · lezárt hét',title:reached?'Elérted a célod':'Az egyensúly hete',sub:reached?'72,9 kiló · −9,3 indulás óta':'78 pont · +4 az előző héthez',btn:`${G('book','ink')}A heti történet`,attrs:'data-go="mezo-emlekek"',tabs:ENTABS})}
  <h1 class="head rise" style="--i:1">${reached?'Megcsináltad: <em>a cél 73 kiló volt</em>, most 72,9. Jöhet a tartás.':'Jól ment: <em>fehérjecél öt napon</em>, stabil alvás. Figyelj a két késői vacsorára.'}</h1>
  <section class="sec rise first" style="--i:1"><button class="card euid" data-go="nap-kuldetesek"><span class="mono">D</span><div><b>Dani · A kitartó</b><div class="chips">${ch('12. szint','soft')}${ch('3 140 XP')}${ch('6 napos sorozat')}${ch(`${G('medal','sun')}240`)}</div></div>${G('chev','ink')}</button></section>
  ${sec(2,'A hét',lnk('mezo-emlekek','A heti történet'),deepBars('78','a 100-ból',.78,'#F4C860',[['Étkezés','84',84],['Alvás','7 óra 19',74],['Edzés','3 / 4',75],['Check-in','75%',75],['Hangulat','6,8',68,'#F0B48C']]))}
  ${sec(3,'Életvonal',lnk('en-suly','A súlyod'),lifeLine(W,reached))}
  ${sec(4,'Célok állása',lnk('en-celok','Mind'),`<div class="eugl"><button data-go="en-sulycel"><img src="${PH('en-merleg-sq.jpg')}" alt=""><div><b>Súlycél · 78,4 → 73 kiló</b><div class="chips" style="margin-top:6px">${ch(reached?'elérted':'33% a célig','soft')}</div></div><span class="cnt">${reached?'100%':'33%'}</span></button>${GOALS.map(goalRow).join('')}</div>`)}
  ${sec(5,'Tovább','',`<div class="eutiles"><button data-go="nap-kuldetesek"><img src="${PH('en-futam-sq.jpg')}" alt=""><b>Fejlődés</b><small>12. szint · 82% fegyelem</small></button><button data-go="mezo-tudastar"><img src="${PH('nap-baratok-sq.jpg')}" alt=""><b>Emberek</b><small>Petra 3× a héten</small></button></div>`)}
  ${mzCard(reached?'Mostantól <em>tartás</em>: a keret 2 600 kalóriára nő, az edzésterv marad. Két hétig figyelem, stabil-e.':'Ha a <em>vacsora 20 óra elé</em> kerül, a jövő héten a 80 pont is meglehet.')}</div>`}
const goalRow=g=>`<button data-go="en-cel-${g.k}"><img src="${PH(g.ph+'-sq.jpg')}" alt=""><div><b>${g.t}</b><span class="eudots">${g.d.map(x=>`<i class="${x?'on':''}"></i>`).join('')}</span></div><span class="cnt">${g.today}<small>${g.dir==='emelkedik'?'emelkedik':g.dir==='tartja'?'tartja':'figyelmet kér'}</small></span></button>`;
function lifeLine(W,reached){const w=330,h=150,mn=Math.min(...W,73)-0.6,mx=Math.max(...W)+0.4,X=i=>16+i*(w-60)/11,Y=v=>h-18-(v-mn)/(mx-mn)*(h-36),pts=W.map((v,i)=>`${X(i).toFixed(1)} ${Y(v).toFixed(1)}`),p='M'+pts.join(' L'),proj=reached?'':`M${X(11)} ${Y(W[11])} L${w-8} ${Y(73)}`;
  return `<div class="card deep euline"><div class="eubig"><b>${(W[11]-W[0]).toFixed(1).replace('.',',').replace('-','−')} kg</b><small>12 hét · heti átlagok</small></div>
  <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Életvonal: heti átlagsúly 12 hét" data-scrub='${JSON.stringify(W.map((v,i)=>[X(i)/w,`${i+1}. hét · ${String(v).replace('.',',')} kiló`]))}'>
   <rect x="0" y="${Y(mx)}" width="${w}" height="16" fill="rgba(140,195,232,.12)"/><line x1="0" x2="${w}" y1="${Y(73)}" y2="${Y(73)}" stroke="#F4C860" stroke-width="1.5" stroke-dasharray="4 5"/><text x="${w-4}" y="${Y(73)-6}" text-anchor="end" font-size="12" font-weight="700" fill="#F4C860" font-family="Manrope">cél 73,0</text>
   <path d="${p} L${X(11)} ${h} L${X(0)} ${h} Z" fill="rgba(168,213,186,.18)"/><path d="${p}" fill="none" stroke="#A8D5BA" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${proj?`<path d="${proj}" fill="none" stroke="#A8D5BA" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>`:''}
   ${STATIONS.map(([i])=>`<circle cx="${X(i)}" cy="${Y(W[i])}" r="${ES.st===i?8:6}" fill="#F4C860" stroke="#1E4A39" stroke-width="2"/>`).join('')}</svg>
  <div class="eust">${STATIONS.map(([i,t])=>`<button class="${ES.st===i?'on':''}" data-eust="${i}">${G('star',ES.st===i?'ink':'sun')}${t}</button>`).join('')}</div>
  <p class="eucap" id="eucap">${ES.st!=null?STATIONS.find(s=>s[0]===ES.st)[2]:reached?'A cél megvan. Innen a tartás a feladat.':'A következő állomás: 73,0 kiló, még 5,4 kiló.'}</p></div>`}

/* ── Súly ── */
const WK=[['Szept. 21–27.',-0.4,78.6,6,78.4,[78.9,78.7,78.8,78.5,78.6,78.4,78.4]],['Szept. 14–20.',-0.3,79.0,7,78.8,[79.3,79.2,79.0,78.9,79.1,78.8,78.9]],['Szept. 7–13.',-0.2,79.3,5,79.1,[79.5,79.4,79.3,79.2,79.1]],['Aug. 31 – szept. 6.',+0.1,79.5,6,79.3,[79.4,79.6,79.5,79.7,79.4,79.3]],['Aug. 24–30.',-0.5,79.4,7,79.0,[79.9,79.7,79.5,79.3,79.2,79.1,79.0]],['Aug. 17–23.',-0.6,79.9,6,79.5,[80.4,80.1,80.0,79.8,79.7,79.5]]];
const DN=['H','K','Sze','Cs','P','Szo','V'];
const spark=a=>{const mn=Math.min(...a),mx=Math.max(...a)||1,r=mx-mn||1;return `<svg class="euspark" viewBox="0 0 64 24" aria-hidden="true"><polyline points="${a.map((v,i)=>`${(i*(60/(a.length-1||1))+2).toFixed(1)},${(20-(v-mn)/r*16).toFixed(1)}`).join(' ')}" fill="none" stroke="#5FB08A" stroke-width="2" stroke-linecap="round"/></svg>`};
const SER={'7':[78.9,78.7,78.8,78.5,78.6,78.4,78.4],'30':Array.from({length:30},(_,i)=>+(80.2-i*0.06+Math.sin(i*1.3)*0.25).toFixed(1)),'90':Array.from({length:45},(_,i)=>+(81.6-i*0.07+Math.sin(i)*0.3).toFixed(1)),'365':Array.from({length:52},(_,i)=>+(86-i*0.15+Math.sin(i*.6)*0.4).toFixed(1))};
function wChart(k){const A=SER[k],w=330,h=170,mn=Math.min(...A)-0.6,mx=Math.max(...A)+0.6,X=i=>14+i*(w-28)/(A.length-1),Y=v=>h-18-(v-mn)/(mx-mn)*(h-34);
  const avg=A.map((_,i)=>{const s=A.slice(Math.max(0,i-6),i+1);return s.reduce((a,b)=>a+b,0)/s.length}),plan=[A[0],A[0]-(A.length-1)*(k==='365'?0.1:0.07)];
  const lab={'7':'napi mérés','30':'napi mérés','90':'két naponta','365':'heti átlag'}[k];
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Súly · ${lab}" data-scrub='${JSON.stringify(A.map((v,i)=>[X(i)/w,`${k==='365'?(i+1)+'. hét':k==='7'?DN[i]:(i+1)+'. nap'} · ${String(v).replace('.',',')} kiló`]))}'>
   <path d="M${X(0)} ${Y(plan[0]+1)} L${X(A.length-1)} ${Y(plan[1]+1)} L${X(A.length-1)} ${Y(plan[1]-1)} L${X(0)} ${Y(plan[0]-1)} Z" fill="rgba(140,195,232,.18)"/>
   <line x1="${X(0)}" y1="${Y(plan[0])}" x2="${X(A.length-1)}" y2="${Y(plan[1])}" stroke="#8CC3E8" stroke-width="2" stroke-dasharray="5 5"/>
   ${A.map((v,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${A.length>40?2:3}" fill="rgba(30,35,33,.28)"/>`).join('')}
   <path d="M${avg.map((v,i)=>`${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' L')}" fill="none" stroke="#2E6B52" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <div class="eulg"><span><i style="background:#2E6B52"></i>mozgó átlag</span><span><i style="background:rgba(30,35,33,.3);height:8px;width:8px;border-radius:50%"></i>mérés</span><span><i style="background:#8CC3E8"></i>terv · ±1 kiló</span></div>`}
function suly(st=''){const few=st==='keves';const L=ES.older?WK:WK.slice(0,3);
  return `${phead('Súly',{ph:'en-merleg.jpg',eb:'Trend · ma reggel 78,4 kiló',title:'−3,0 kiló indulás óta',sub:'81,4 → 78,4 · a cél 73',btn:`${G('plus','ink')}Súly`,attrs:'data-sheet="enWeight"',tabs:ENTABS})}
  <h1 class="head rise" style="--i:1">Egyenletes tempó: <em>heti fél kiló</em>. Ebben a ritmusban kb. 11 hét a cél.</h1>
  ${sec(2,'A célig',lnk('en-sulycel','A súlycél'),deepBars('33%','a célig',.33,'#A8D5BA',[['Jelenleg','78,4 kiló',60],['7 nap','−0,4 kiló',55],['4 hét tempó','−0,5 / hét',62],['Várható cél','11 hét',40,'#F4C860']]),1)}
  ${sec(3,'A görbe','',`<div class="euper" role="tablist">${[['7','7 nap'],['30','30 nap'],['90','90 nap'],['365','1 év']].map(([k,l])=>`<button class="${ES.per===k?'on':''}" data-euper="${k}">${l}</button>`).join('')}</div><div class="card euch" style="margin-top:10px">${few&&ES.per!=='365'?`<div class="npempty"><b>Kevés mérés ehhez az ablakhoz</b><p>Ebben az időszakban csak két mérés van. Válassz hosszabb ablakot, vagy mérj holnap reggel.</p></div>`:wChart(ES.per)}</div>`)}
  ${sec(4,'Hétről hétre',`<span class="crumb">${L.length} / 22 hét</span>`,`<div class="card pad euwk">${L.map(([t,d,a,n,m,days],i)=>`<div class="${ES.wkOpen[i]?'open':''}"><button class="wh" data-euwk="${i}" aria-expanded="${!!ES.wkOpen[i]}"><div><b>${t}</b><small>átlag ${String(a).replace('.',',')} · ${n} mérés · legkisebb ${String(m).replace('.',',')}</small></div>${spark(days)}<span class="d ${d<0?'dn':'up'}">${d<0?'−':'+'}${String(Math.abs(d)).replace('.',',')} ${G('chev','ink')}</span></button><div class="days">${days.map((v,j)=>`<span>${DN[j]}<b>${String(v).replace('.',',')} kiló</b></span>`).join('')}<button class="pill soft" style="height:40px;justify-self:start" data-go="mezo-chat">Mi történt ezen a héten?</button></div></div>`).join('')}</div>${ES.older?'':`<div class="acts" style="margin:12px 0 0"><button class="pill soft" data-euolder>Régebbi hetek</button></div>`}`)}
  ${sec(5,'Alapadatok','',rowsC([['person','sage','34 év · 180 cm · 78,4 kiló · 15% testzsír','a kalóriakeret ebből számol','data-sheet="enBio"']]))}
  ${mzCard('<em>Zsír megy, az erő marad</em>: a húzódzkodás súlya közben nőtt. A védőkorlátok rendben.',`<button class="pill soft" data-go="en-sulycel-korlatok">A védőkorlátok</button>`)}</div>`}

document.head.insertAdjacentHTML('beforeend',`<style>
.eugoal{display:flex;align-items:center;gap:12px;padding:14px 16px}.eugoal .g{font-size:30px}.eugoal div{flex:1}.eugoal b{display:block;font:700 18px var(--d)}.eugoal small{font:700 12px var(--b);color:var(--ink2)}.eugoal .pill{height:40px;padding:0 14px;font-size:13px}
.euph{display:flex;height:22px;border-radius:11px;overflow:hidden}.euph i{display:block;height:100%}
.euphl{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}.euphl span{display:grid;gap:2px;font:700 12px var(--b);color:var(--ink2)}.euphl b{font:700 15px var(--d);color:var(--ink)}.euphl u{width:12px;height:12px;border-radius:4px;display:block}
.eunight{padding:14px}.eunight svg[role]{width:100%;height:auto;display:block}
.eubars7{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;align-items:end;height:150px;padding:14px 14px 6px}
.eubars7 div{display:grid;gap:4px;justify-items:center;align-self:end}.eubars7 .st{display:flex;flex-direction:column-reverse;width:100%;max-width:26px;border-radius:8px;overflow:hidden}.eubars7 .st i{display:block;width:100%}
.eubars7 small{font:700 12px var(--b);color:var(--ink2)}.eubars7 .q{width:8px;height:8px;border-radius:50%}
.eunlog .row{grid-template-columns:36px minmax(0,1fr) auto}.eunlog .row.w b{color:#B5642E}
.euarea{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.euarea span{display:grid;gap:4px;padding:10px;border-radius:16px;background:#fff;box-shadow:var(--sh)}.euarea b{font:600 13px var(--d)}.euarea small{font:700 12px var(--b);color:var(--ink2)}.euarea u{display:block;height:6px;border-radius:3px;background:rgba(30,35,33,.08);overflow:hidden;text-decoration:none}.euarea u i{display:block;height:100%;width:var(--w);background:var(--c)}
.eudec{padding:16px;display:grid;gap:10px}.eudec h4{margin:0;font:600 17px/1.3 var(--d)}.eudec .rt{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.eudec .rt button{min-height:44px;border-radius:14px;border:0;background:var(--paper);font:700 15px var(--d);color:var(--ink)}.eudec .rt button.on{background:var(--ink);color:#fff}
.euentries .row{grid-template-columns:44px minmax(0,1fr) auto}.euentries .d{display:grid;justify-items:center;width:44px}.euentries .d b{font:700 17px var(--d)}.euentries .d small{font:700 12px var(--b);color:var(--ink2);margin:0}
.euentries .row small{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.w320 .euarea{grid-template-columns:repeat(2,1fr)}.w320 .euphl{grid-template-columns:repeat(2,1fr)}
</style>`);
/* ── Alvás ── */
const NIGHTS=[['H',6.4,[14,50,22,14],6,1],['K',7.6,[19,51,24,6],8,0],['Sze',6.9,[16,53,21,10],6,1],['Cs',7.3,[18,52,24,6],7,0],['P',7.8,[20,50,25,5],9,0],['Szo',8.1,[17,54,23,6],8,0],['V',7.5,[18,52,24,6],9,0]];
const PH4=[['Mély','#2E6B52'],['Könnyű','#A8D5BA'],['REM','#8CC3E8'],['Éber','#F0B48C']];
const ESL={span:7};
function hypno(){const w=330,h=124,L0=46,S=[[0,1],[18,0],[40,0],[75,1],[95,2],[120,1],[150,0],[175,1],[200,2],[230,1],[260,3],[268,1],[300,2],[330,1],[360,2],[400,1],[440,2],[470,3],[478,1],[501,2]],T=501,NM=['mély','könnyű','REM','éber'],ROW=[3,2,1,0],X=m=>L0+m/T*(w-L0-8),Y=l=>14+ROW[l]*30;
  let d='';S.forEach(([m,l],i)=>{const n=i+1<S.length?S[i+1][0]:T;d+=`${i?'L':'M'}${X(m).toFixed(1)} ${Y(l)} L${X(n).toFixed(1)} ${Y(l)} `});
  const tm=m=>`${String(Math.floor((42+m)/60)%24).padStart(2,'0')}:${String((42+m)%60).padStart(2,'0')}`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Az éjszaka íve, 00:42-tól 09:03-ig" data-scrub='${JSON.stringify(S.map(([m,l])=>[X(m)/w,`${tm(m)} · ${NM[l]}`]))}'>${['Éber','REM','Könnyű','Mély'].map((t,i)=>`<text x="0" y="${18+i*30}" font-size="12" font-weight="700" fill="#8E968F" font-family="Manrope">${t}</text>`).join('')}<path d="${d}" fill="none" stroke="#2E6B52" stroke-width="3" stroke-linejoin="round"/></svg>`}
function alvas(st=''){
  if(st==='ures')return `${phead('Alvás',{ph:'mezo-ejjel.jpg',eb:'Még nincs alvásadat',title:'Mesélj az éjszakáidról',sub:'Kézzel, vagy egy képernyőképről az óráról.',btn:`${G('plus','ink')}Alvás`,attrs:'data-sheet="enSleep"',tabs:ENTABS})}
    ${sec(2,'Alváscél','',`<div class="card eugoal t-sky">${G('moon','sky')}<div><b>Alapértelmezett: 7,5 óra</b><small>23:15 ↔ 06:45 · még nem állítottad be</small></div><button class="pill soft" data-sheet="enSleepGoal">Beállítom</button></div>`,1)}
    ${mzCard('Három éjszaka után <em>megmutatom a ritmusodat</em>: mikor alszol el, és mi zavarja meg.')}</div>`;
  const N=ESL.span===7?NIGHTS:[...NIGHTS,...NIGHTS.map(([d,h,p,q,w])=>[d,+(h-0.3).toFixed(1),p,q-1,w])];
  return `${phead('Alvás',{ph:'mezo-ejjel.jpg',eb:'Tegnap éjjel',title:'7 óra 16 perc',sub:'23:20 → 06:36 · minőség 7 / 10',btn:`${G('plus','ink')}Alvás`,attrs:'data-sheet="enSleep"',tabs:ENTABS})}
  <h1 class="head rise" style="--i:1">Rendszeres hét: <em>78%-ban</em> ugyanakkor fekszel. A lefekvés még 5 perccel a cél után van.</h1>
  ${sec(2,'A ritmusod',`<a href="#" data-sheet="enStats">Miért számít? ${G('chev')}</a>`,deepBars('78%','rendszeresség',.78,'#8CC3E8',[['Hatékonyság','91%',91],['Mély alvás','18%',60],['REM','24%',80],['Ébredések','1 éjjel',20,'#F0B48C']]),1)}
  ${sec(3,'Alváscél','',`<div class="card eugoal t-sky">${G('moon','sky')}<div><b>23:15 ↔ 06:45 · 7,5 óra</b><small>±15 perc a jó tartomány</small></div><button class="pill soft" data-sheet="enSleepGoal">Szerkesztem</button></div>`)}
  ${sec(4,'Az éjszaka íve',`<span class="crumb">00:42 → 09:03</span>`,`<div class="card eunight"><div class="euph">${PH4.map(([l,c],i)=>`<i style="width:${[18,52,24,6][i]}%;background:${c}"></i>`).join('')}</div><div class="euphl">${PH4.map(([l,c],i)=>`<span><u style="background:${c}"></u>${l}<b>${[18,52,24,6][i]}%</b></span>`).join('')}</div><div style="margin-top:12px">${hypno()}</div></div>`)}
  ${sec(5,'Éjszakáról éjszakára',`<span class="euper" style="box-shadow:none;background:none;padding:0">${[7,14].map(n=>`<button class="${ESL.span===n?'on':''}" data-eusp="${n}" style="min-width:64px">${n} nap</button>`).join('')}</span>`,`<div class="card eubars7" style="grid-template-columns:repeat(${N.length},minmax(0,1fr));gap:${N.length>7?3:6}px">${N.map(([d,hh,p,q])=>`<div><span class="st" style="height:${hh/9*120}px">${p.map((v,i)=>`<i style="height:${v}%;background:${PH4[i][1]}"></i>`).join('')}</span><span class="q" style="background:${q>=8?'#5FB08A':q>=7?'#F4C860':'#F0B48C'}"></span><small>${N.length>7?'':d}</small></div>`).join('')}</div>`)}
  ${sec(6,'Ha rövidebb az éjszaka','',`<div class="card trio t-sky">${[['moon','sky','−21 perc','REM a rövid éjszakákon'],['bolt','sun','−1,2','reggeli energia'],['clock','sky','6,9 óra','a határ nálad']].map(([ic,pal,v,l])=>`<div>${G(ic,pal)}<b>${v}</b><small>${l}</small></div>`).join('')}</div>`)}
  ${sec(7,'Az elmúlt hét éjszaka','',`<div class="card pad eunlog">${NIGHTS.slice().reverse().map(([d,hh,p,q,w],i)=>`<div class="row ${w?'w':''}">${G(w?'repeat':'moon',w?'peach':'sky')}<div><b>${['vasárnap','szombat','péntek','csütörtök','szerda','kedd','hétfő'][i]} · ${String(hh).replace('.',',')} óra</b><small>${w?(i===4?'késő vacsora után':'1 ébredés, 03:12'):'nyugodt éjszaka'}</small></div><span class="chip ${q>=8?'soft':q<7?'warm':''}">${q} / 10</span></div>`).join('')}</div>`)}
  ${sec(8,'Ha éjjel felébredsz','',dls([['en-hold','Éjszakai mód','légzés, visszaalvás, sötét képernyő','data-go="en-ejszaka"']]))}
  ${mzCard('Ha ma <em>23:15-kor</em> lefekszel, a hét rendszeressége 80% fölé megy.')}</div>`}
/* ── Célok ── */
const AREAS6=[['Érzelem','heart','berry',62,'#C9A8E8'],['Elmélyülés','star','sun',48,'#F4C860'],['Kapcsolatok','person','peach',55,'#F0B48C'],['Értelem','book','sage',41,'#A8D5BA'],['Teljesítmény','chart','deep',70,'#5FB08A'],['Egészség','shoe','sky',78,'#8CC3E8']];
function celok(st=''){
  if(st==='ures')return `${phead('Célok',{ph:'en-cipo.jpg',eb:'Még nincs célod',title:'Mi számít neked?',sub:'Egy súlycél és egy-két életcél elég az induláshoz.',btn:`${G('plus','ink')}Új cél`,attrs:'data-go="en-celuj-1"',tabs:ENTABS})}
    ${sec(2,'Kezdjük','',`<div class="eugl"><button data-go="en-sulyuj-1">${G('scale','sage')}<div><b>Súlycél</b><small>merre, mennyit, mikorra</small></div>${G('chev','ink')}</button><button data-go="en-celuj-1">${G('star','sun')}<div><b>Életcél</b><small>öt lépés, a naplódból számol</small></div>${G('chev','ink')}</button></div>`,1)}
    ${mzCard('Egy cél akkor él, ha <em>a meglévő naplódból</em> mérhető. Ebben segít a varázsló.')}</div>`;
  const parked=ES.parked;
  return `${phead('Célok',{ph:'en-cipo.jpg',eb:`${GOALS.length+(parked?1:0)} életcél · 1 súlycél`,title:'Kettő emelkedik, egy tartja',sub:'A pillérek a meglévő naplódból számolnak.',btn:`${G('plus','ink')}Új cél`,attrs:'data-go="en-celuj-1"',tabs:ENTABS})}
  ${sec(2,'A hat terület',`<span class="crumb">2 emelkedik · 1 tartja · 0 esik</span>`,`<div class="card gy g1 deep pre">${ring({d:96,sw:10,p:.6,c:'#A8D5BA',val:GOALS.length+(parked?1:0),unit:'életcél'})}<div class="bars">${AREAS6.map(([l,ic,pal,v,c])=>`<div class="br"><span>${l}</span><b>${v}</b><u><i style="--w:${v}%;background:${c}"></i></u></div>`).join('')}</div></div>`,1)}
  ${sec(3,'Súlycél','',`<div class="eugl"><button data-go="en-sulycel"><img src="${PH('en-merleg-sq.jpg')}" alt=""><div><b>Fogyás · 78,4 → 73 kiló</b><div class="chips" style="margin-top:6px">${ch('−0,5 kiló / hét')}${ch('kb. 11 hét')}</div></div><span class="cnt">33%</span></button></div>`)}
  ${sec(4,'Életcélok','',`<div class="eugl">${GOALS.map(goalRow).join('')}${parked?goalRow({k:'spanyol',t:'Spanyol B2',dir:'emelkedik',d:[0,0,0,0,0,0,1],today:'0 / 1',ph:'nap-lista'}):''}<button data-go="en-celuj-1" style="border:1.5px dashed rgba(30,35,33,.2);box-shadow:none;background:transparent">${G('plus','sage')}<div><b>Új cél</b></div><span></span></button></div>`)}
  ${parked?'':sec(5,'Parkol','',`<div class="eugl"><div style="display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 14px 12px 12px;border-radius:22px;background:#fff;box-shadow:var(--sh);opacity:.85"><img src="${PH('nap-lista-sq.jpg')}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover"><div><b style="font:600 15px var(--d)">Spanyol B2</b><div class="chips" style="margin-top:6px">${ch('augusztus óta parkol')}</div></div><button class="pill soft" style="height:40px;padding:0 14px;font-size:13px" data-euunpark>Vissza</button></div></div>`)}
  ${sec(6,'Lezárt','',dls([['en-futam','Félmaraton',ch('május · 1:58:40','soft')+ch('elérted'),'']]))}
  ${sec(7,'Jelek','',rowsC([['link','deep','28 forrás · 19 él · 9 alszik','ezekből számolnak a pillérek','data-go="en-jelek"']]))}
  ${mzCard('A <em>barátok</em> cél a péntekeken múlik: ha edzés nélküli, ott a lehetőség.')}</div>`}
/* ── Napló ── */
const ENT=[['24','Napló','Hosszú nap, de a Pull Day jól ment. A húzásnál új rekord.','nap-naplo'],['23','Hála','A csapat a meccs után. Anya hívása. A reggeli napfény.','nap-baratok'],['22','Napló','Szerdán megint sokáig dolgoztam. Jövő héten csütörtökre teszem a mellékprojektet.','kave'],['21','Döntés','Szeptembertől heti négy edzésre váltok háromról.','edz-tarcsa'],['20','Hála','Hosszú séta vasárnap délelőtt.','nap-seta'],['18','Napló','A röpi után fáj a váll, a fizióhoz kellene mennem.','edz-ropi-terem']];
const ENTA=[['31','Napló','Augusztus vége: a szabadság után könnyen indult a hét.','nap-seta'],['28','Hála','A balatoni hétvége.','nap-alkony']];
function naplo(st=''){const L=ES.naplo?[...ENT,...ENTA]:ENT;
  if(st==='ures')return `${phead('Napló',{ph:'nap-naplo.jpg',eb:'Még üres',title:'Az első sor a legnehezebb',sub:'Egy mondat a napodról elég.',btn:`${G('plus','ink')}Új bejegyzés`,attrs:'data-sheet="enJournal"',tabs:ENTABS})}${mzCard('Három fajta bejegyzés van: <em>napló, hála és döntés</em>. A döntéseket egy hónap múlva visszanézzük.')}</div>`;
  return `${phead('Napló',{ph:'nap-naplo.jpg',eb:'Szeptember · 12 bejegyzés',title:'5 napos hála-sorozat',sub:'A legtöbb bejegyzés este születik.',btn:`${G('plus','ink')}Új bejegyzés`,attrs:'data-sheet="enJournal"',tabs:ENTABS})}
  ${sec(2,'A hónapban','',deepBars('12','bejegyzés',.6,'#F4C860',[['Napló','6',60],['Hála','4',40,'#C9A8E8'],['Döntés','2',20,'#8CC3E8']]),1)}
  ${sec(3,'Döntések','',`<div class="card eudec t-sky"><span class="chip warm" style="justify-self:start">${ES.dec?'Visszanézve · '+ES.dec+' / 5':'Nézd vissza · egy hónapja'}</span><h4>Szeptembertől heti négy edzésre váltok háromról.</h4>${ES.dec?`<button class="pill soft" style="justify-self:start" data-sheet="enDecision">Mi lett belőle? ${G('chev','deep')}</button>`:`<small style="font:700 12px var(--b);color:var(--ink2)">Mennyire vált be?</small><div class="rt">${[1,2,3,4,5].map(v=>`<button data-eudec="${v}">${v}</button>`).join('')}</div>`}</div>`)}
  ${sec(4,ES.naplo?'Szeptember és augusztus':'2026. szeptember','',`<div class="card pad euentries">${L.map(([d,k,t,p],i)=>`<div class="row tap" role="button" tabindex="0" data-sheet="enJournal" data-arg="${i}"><span class="d"><b>${d}</b><small>${i<ENT.length?'szept.':'aug.'}</small></span><div><b>${t.split('.')[0].slice(0,46)}${t.split('.')[0].length>46?'…':''}</b><small>${t}</small></div><span class="chip ${k==='Hála'?'soft':k==='Döntés'?'warm':''}">${k}</span></div>`).join('')}</div>${ES.naplo?'':`<div class="acts" style="margin:12px 0 0"><button class="pill soft" data-eunaplo>Korábbi hónapok</button></div>`}`)}
  ${mzCard('A hála-bejegyzéseidben <em>a csapat és a család</em> jön elő a legtöbbször. Ezt a Rólad fülön is látod.')}</div>`}

document.head.insertAdjacentHTML('beforeend',`<style>
.euacts{flex-wrap:wrap}.euacts .pill{min-width:0;padding:0 12px}.eupil .row{grid-template-columns:36px minmax(0,1fr) auto}.eupil .v u{width:72px}
.euwhy{padding:16px 18px;display:grid;gap:10px}.euwhy small{font:700 12px var(--b);color:var(--deep);text-transform:uppercase;letter-spacing:.06em}.euwhy p{margin:0;font:600 16px/1.45 var(--d)}
.euwz{position:sticky;top:0;z-index:4;display:flex;gap:4px;padding:12px 16px;background:rgba(246,244,239,.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}.euwz i{flex:1;height:6px;border-radius:3px;background:rgba(30,35,33,.1)}.euwz i.on{background:var(--sage)}
.eu6{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.eu6 button{display:grid;gap:6px;justify-items:start;padding:14px;border-radius:22px;border:0;background:#fff;box-shadow:var(--sh);text-align:left;color:var(--ink);min-height:104px}.eu6 .g{font-size:28px}.eu6 b{font:600 15px var(--d)}.eu6 small{font:700 12px var(--b);color:var(--ink2)}
.eudiff{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:16px}.eudiff div{display:grid;justify-items:center;gap:2px}.eudiff b{font:800 26px/1 var(--d)}.eudiff small{font:700 12px var(--b);color:var(--ink2)}.eudiff .g{font-size:22px}
.phone.euon .nav,.phone.euon #cbar{display:none!important}.phone.euon .scroll{background:#0E1218;padding:0}
.eun{position:relative;min-height:100%;color:#E9ECF2;background:radial-gradient(120% 60% at 50% 0%,#1D2433 0%,#0E1218 60%);display:flex;flex-direction:column;padding-bottom:24px}
.eun>img{position:absolute;left:0;right:0;top:0;width:100%;height:260px;object-fit:cover;opacity:.45;-webkit-mask:linear-gradient(180deg,#000 30%,transparent);mask:linear-gradient(180deg,#000 30%,transparent)}.eun>*:not(img){position:relative}
.eun .tp{display:flex;justify-content:space-between;align-items:center;padding:18px 16px 0}.eun .tp button{width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;font:700 18px var(--b)}.eun .tp b{font:700 15px var(--d);opacity:.8}
.eun .hd{padding:110px 24px 0;text-align:center}.eun .hd small{font:700 12px var(--b);letter-spacing:.1em;text-transform:uppercase;color:#9FB4D8}.eun .hd h2{margin:8px 0;font:600 30px/1.15 var(--d)}.eun .hd p{margin:0;font:600 15px/1.45 var(--b);color:rgba(233,236,242,.75)}
.eun .orb{width:160px;height:160px;border-radius:50%;margin:30px auto 0;background:radial-gradient(circle,#8CC3E8 0 30%,rgba(140,195,232,.25) 31% 60%,rgba(140,195,232,.06) 61%);display:grid;place-items:center;font:700 34px var(--d);color:#0E1218;animation:eubr 8s ease-in-out infinite}
@keyframes eubr{0%,100%{transform:scale(.82)}40%{transform:scale(1.08)}55%{transform:scale(1.08)}}body.still .eun .orb{animation:none}@media (prefers-reduced-motion:reduce){.eun .orb{animation:none}}
.eun .tools{display:grid;gap:10px;margin:30px 16px 0}.eun .tools button{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 16px;border-radius:18px;border:0;background:rgba(255,255,255,.08);color:#fff;font:600 15px var(--d);text-align:left}.eun .tools .g{font-size:24px}
.eun .sp{flex:1;min-height:24px}.eun .ft{display:grid;gap:8px;margin:20px 16px 0}.eun .ft button{min-height:50px;border-radius:999px;border:0;font:700 15px var(--d);background:rgba(255,255,255,.12);color:#fff}.eun .ft button.go{background:#8CC3E8;color:#0E1218}
.w320 .eun .hd{padding-top:90px}.w320 .eun .orb{width:130px;height:130px}
</style>`);
/* ── a goal ── */
function cel(k){const g=GOALS.find(x=>x.k===k);if(!g)return celok();const s=ES.goalSt[k],per=ES.gview;
  return `${ihead({ph:g.ph+'.jpg',crumb:'Én › Célok › <b>'+g.t+'</b>',eb:`${g.area} · ${g.dir}`,title:`${g.t} · ${g.pct}%`,sub:s?`${s}.`:'A pillérek a naplódból számolnak.'})}
  <div class="euper rise" style="--i:1;margin:18px 16px 0;max-width:calc(100% - 32px);box-sizing:border-box">${[['het','Hét'],['ho','Hónap']].map(([k2,l])=>`<button class="${per===k2?'on':''}" data-eugv="${k2}">${l}</button>`).join('')}</div>
  ${sec(2,'A pillérek','',`<div class="card pad eupil">${g.pil.map(([t,src,v])=>`<div class="row">${G(v==null?'search':'check',v==null?'ink':'sage')}<div><b>${t}</b><small>${src}${v==null?' · még nincs adat':''}</small></div><span class="v">${v==null?'–':(per==='ho'?Math.max(10,v-8):v)+'%'}<u><i style="--p:${v||0}%"></i></u></span></div>`).join('')}</div><div class="acts" style="margin:10px 0 0"><button class="pill soft" data-sheet="enPillar">${G('plus','deep')}Pillér</button></div>`,1)}
  ${sec(3,'Miért, és ha–akkor','',`<div class="card euwhy t-sun"><small>Miért</small><p>${g.why}</p><small>Ha–akkor</small><p>${g.ift}</p></div>`)}
  ${sec(4,'Az elmúlt hét','',`<div class="card" style="padding:14px"><div class="mwwk">${g.d.map((x,i)=>`<div><i class="${x?'ok':''}"></i><small>${DN[i]}</small></div>`).join('')}</div></div>`)}
  <div class="acts rise euacts" style="--i:5">${s?`<button class="pill soft" data-eugs="${k}|">Visszaveszem</button>`:['Parkolás','Lezárás','Archiválás'].map(x=>`<button class="pill soft" data-eugs="${k}|${x==='Parkolás'?'Parkol':x==='Lezárás'?'Lezárva':'Archiválva'}">${x}</button>`).join('')}</div>
  ${mzCard(g.pil.some(p=>p[2]==null)?'Az egyik pillérhez <em>még nincs adat</em>: ha bekötöd az alvást, pontosabb lesz a kép.':'Ez a cél <em>a meglévő naplódból</em> számol: semmit nem kell külön pipálnod.')}</div>`}
/* ── new goal wizard ── */
const CW={n:1,t:'',area:'Egészség',fw:'Belső'};const CWS=['A cél','A keret','A pillérek','Ha–akkor','Összegzés'];
function celuj(n){n=Math.max(1,Math.min(5,+n||1));const step=CWS[n-1];
  const body=n===1?`<div class="card npf"><label><span>Mit szeretnél?</span><input value="${CW.t}" id="eucwt" placeholder="Például: lefutni egy félmaratont" aria-label="A cél"></label><div><span style="display:block;font:700 12px var(--b);color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Terület</span><div class="npopt">${AREAS6.map(([l])=>`<button class="${CW.area===l?'on':''}" data-eucwa="${l}">${l}</button>`).join('')}</div></div></div>`
   :n===2?`<div class="npfw">${[['Belső','nap-naplo','Azért, mert fontos nekem'],['Külső','en-futam','Azért, mert mások elvárják']].map(([k,p,d])=>`<button class="${CW.fw===k?'on':''}" data-eucwf="${k}"><img src="${PH(p+'-sq.jpg')}" alt=""><div><b>${k}</b><small>${d}</small></div><span></span></button>`).join('')}</div>${CW.fw==='Külső'?`<div class="card npobs" style="margin-top:12px"><p>Egy külső cél <em>nehezebben marad meg</em>. Meg tudod fogalmazni úgy, hogy neked miért fontos?</p><button class="pill soft" data-eucwf="Belső" style="justify-self:start">Átfogalmazom</button></div>`:''}`
   :n===3?`<div class="card pad">${[['Futás a héten','az Edzésből'],['Alvás 7 óra fölött','az alvásból'],['Esti nyújtás','a rutinból']].map(([t,s])=>`<div class="row">${G('check','sage')}<div><b>${t}</b><small>${s}</small></div></div>`).join('')}</div><div class="acts" style="margin:10px 0 0"><button class="pill soft" data-sheet="enPillar">${G('plus','deep')}Pillér a listából</button></div>`
   :n===4?`<div class="card npf"><label><span>Ha…</span><input value="Ha esik az eső" aria-label="Ha"></label><label><span>…akkor</span><input value="akkor futópadon futok 30 percet" aria-label="Akkor"></label></div>`
   :`<div class="card euwhy t-sun"><small>A cél</small><p>${CW.t||'Lefutni egy félmaratont'}</p><small>Terület · keret</small><p>${CW.area} · ${CW.fw.toLowerCase()} cél</p><small>Pillérek</small><p>futás a héten, alvás 7 óra fölött, esti nyújtás</p></div>`;
  return `${ihead({ph:'en-cipo.jpg',crumb:'Én › Célok › <b>Új cél</b>',eb:`${n}. lépés · 5-ből`,title:step,sm:1})}<div class="euwz">${CWS.map((_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</div>
  <section class="sec rise first" style="--i:1">${body}</section>
  <div class="acts rise" style="--i:2">${n>1?`<button class="pill soft" data-go="en-celuj-${n-1}">Vissza</button>`:''}<button class="pill" ${n===5?'data-nptoast="Új cél: elindult" data-npgo="en-celok"':`data-go="en-celuj-${n+1}"`}>${n===5?'Létrehozom':'Tovább'}</button></div>
  ${mzCard(n===3?'A pillérek <em>a meglévő adataidból</em> jönnek: nem kell semmit külön logolnod.':'Egy jó cél <em>kicsi és mérhető</em>. A végén megmutatom, mennyire reális.')}</div>`}
function jelek(){const ON=[['moon','sky','Alvás','az óráról'],['bowl','sage','Fehérje','a Fuelből'],['dumbbell','berry','Edzés','az Edzésből'],['link','deep','Reggeli lánc','a Rutinból'],['heart','berry','Hangulat','a check-inből'],['book','sage','Napló','a Naplóból']],OFF=[['pin','peach','Helyszín','nincs bekötve'],['phone','sky','Képernyőidő','nincs bekötve'],['heart','berry','Pulzus-változékonyság','az óra nem küldi']];
  return `${ihead({ph:'mezo-gep.jpg',crumb:'Én › Célok › <b>Jelek</b>',eb:'28 forrás',title:'19 él, 9 alszik',sub:'Ezekből számolnak a célok pillérei.'})}
  ${sec(2,'Él','',rowsC(ON.map(([ic,pal,b,s])=>[ic,pal,b,s,'',ch('él','soft')])),1)}
  ${sec(3,'Alszik','',rowsC(OFF.map(([ic,pal,b,s])=>[ic,pal,b,s,'',ch('alszik')])))}
  ${mzCard('Egy alvó jel <em>nem hiba</em>: csak azt jelenti, hogy abból most nem tudunk számolni.')}</div>`}
/* ── weight goal ── */
const SPARTS={etrend:['bowl','sage','Étrend','2 300 kalória naponta','salata'],szakasz:['chart','deep','Szakasz','fogyás · 3. hét / 14','en-merleg'],tervek:['dumbbell','berry','Tervek','2 aktív edzésterv','edz-tarcsa'],korlatok:['shield','sage','Védőkorlátok','3 / 4 rendben','mezo-nagyito'],javaslat:['spark','deep','Javaslat','1 vár rád','mezo-asztal'],beall:['scale','sage','Beállítások','cél 73 kiló','kave']};
const SJ={st:''};
function sulycel(st=''){
  if(st==='ures')return `${ihead({ph:'en-merleg.jpg',crumb:'Én › Célok › <b>Súlycél</b>',eb:'Még nincs súlycél',title:'Előbb a biometriád',sub:'Magasság, kor és aktivitás nélkül nem tudok keretet számolni.',btn:`${G('person','ink')}Kitöltöm`,attrs:'data-sheet="enBio"'})}${mzCard('Két perc az egész, és utána <em>reális célt</em> javaslok.')}</div>`;
  return `${ihead({ph:'en-merleg.jpg',crumb:'Én › Célok › <b>Súlycél</b>',eb:'Fogyás · augusztus 14. óta',title:'Jó úton',sub:'Tényleges −0,5 kiló / hét, a terv −0,5.'})}
  ${sec(2,'Az út','',deepBars('33%','megvan',.33,'#A8D5BA',[['Indulás','81,4 kiló',100],['Most','78,4 kiló',60],['Cél','73 kiló',20,'#F4C860']]),1)}
  ${sec(3,'Részek','',`<div class="eu6">${Object.entries(SPARTS).map(([k,[ic,pal,b,s]])=>`<button data-go="en-sulycel-${k}">${G(ic,pal)}<b>${b}</b><small>${k==='javaslat'&&SJ.st?SJ.st:s}</small></button>`).join('')}</div>`)}
  ${sec(4,'Új súlycél','',dls([['en-cipo','Új súlycél indítása',ch('a mostani lezárul'),'data-go="en-sulyuj-1"']]))}
  ${mzCard('A tempó <em>pont a terv szerint</em> megy. A javaslat a hétvégi kalóriát érinti, nézd meg.')}</div>`}
function sulyresz(k){const P=SPARTS[k]||SPARTS.etrend,[ic,pal,b,s,ph]=P;let body='';
  if(k==='etrend')body=sec(2,'A napi keret','',deepBars('2 300','kalória',.7,'#A8D5BA',[['fehérje','166 g',80,'#E09A6A'],['szénhidrát','240 g',60,'#E2B24A'],['zsír','75 g',50,'#8FBF9F']]),1)+sec(3,'Hogyan számolom','',rowsC([['flame','peach','Alapanyagcsere','1 780 kalória'],['shoe','peach','Mozgás','átlag +900 kalória'],['chart','deep','Hiány','−380 kalória · −0,5 kiló / hét']]));
  if(k==='szakasz')body=sec(2,'Az íve','',deepBars('3 / 14','hét',.21,'#A8D5BA',[['Fogyás','14 hét',21],['Tartás','4 hét',0],['Visszatérés','2 hét',0]]),1);
  if(k==='tervek')body=sec(2,'Ami a súlycélhoz kötve','',dls([['edz-tarcsa','Hypertrophy 04',ch('3. hét / 6','soft'),'data-go="edzes-terv"'],['edz-palya','Robbanékonyság 01',ch('futás · 3. hét / 8'),'data-go="edzes-futas"'],['edz-ropi-terem','Röplabda',ch('hetente 3'),'data-go="edzes-sport"']]),1);
  if(k==='korlatok')body=sec(2,'Négy védőkorlát','',rowsC([['shield','sage','Az erő nem csökken','húzódzkodás +2,5 kiló','',ch('rendben','soft')],['shield','sage','Fehérje legalább 160 g','öt napból öt','',ch('rendben','soft')],['shield','sage','Alvás legalább 7 óra','átlag 7 óra 19','',ch('rendben','soft')],['repeat','peach','Heti fogyás legfeljebb 0,8 kiló','múlt héten 0,9','',ch('figyel','warm')]]),1);
  if(k==='javaslat')body=sec(2,'A javaslat','',`<div class="card eudiff">${SJ.st?'':''}<div><b>1 950</b><small>hétvégi keret most</small></div>${G('chev','ink')}<div><b>1 800</b><small>javasolt</small></div></div><p class="sub" style="margin:10px 2px">A hétvégéken rendre 300 kalóriával több jön össze. A hét közben nem változik semmi.</p>${SJ.st?`<div class="npdone">${G('check','sage')}${SJ.st}</div>`:`<div class="mwdec">${[['Alkalmazom','Alkalmazva'],['Most nem','Később visszahozom'],['Elvetem','Elvetve']].map(([l,r],i)=>`<button class="pill ${i?'soft':''}" data-eusj="${r}">${l}</button>`).join('')}</div>`}`,1);
  if(k==='beall')body=sec(2,'Beállítások','',`<div class="card npf"><label><span>Célsúly</span><input value="73" inputmode="decimal" aria-label="Célsúly"></label><label><span>Heti tempó</span><input value="−0,5 kiló" aria-label="Heti tempó"></label><label><span>Céldátum</span><input value="2026. december 10." aria-label="Céldátum"></label></div><div class="acts" style="margin:12px 0 0"><button class="pill" data-nptoast="Mentve" data-npgo="en-sulycel">Mentés</button></div>`,1);
  return `${ihead({ph:ph+'.jpg',crumb:'Én › Súlycél › <b>'+b+'</b>',eb:'Súlycél',title:b,sub:k==='javaslat'&&SJ.st?SJ.st:s,sm:1})}${body}${mzCard(k==='korlatok'?'Ha egy korlát <em>két hétig</em> piros, lassítom a tempót.':'Minden szám <em>a naplódból</em> jön, és hetente frissül.')}</div>`}
const SW={dir:'Fogyás',date:'dec. 10.'};
function sulyuj(n){n=Math.max(1,Math.min(2,+n||1));const aggr=SW.date==='okt. 31.';
  const body=n===1?`<div class="npfw">${[['Fogyás','en-merleg','zsírt le, az erő marad'],['Tartás','nap-seta','stabil súly, jobb forma'],['Hízás','edz-tarcsa','izmot fel, minimális zsírral']].map(([k,p,d])=>`<button class="${SW.dir===k?'on':''}" data-eusw="${k}"><img src="${PH(p+'-sq.jpg')}" alt=""><div><b>${k}</b><small>${d}</small></div><span></span></button>`).join('')}</div><div class="sh" style="margin-top:18px"><h3>Védőkorlátok</h3></div>${rowsC([['shield','sage','Az erő nem csökken','','',ch('be','soft')],['shield','sage','Fehérje legalább 160 g','','',ch('be','soft')],['shield','sage','Alvás legalább 7 óra','','',ch('be','soft')]])}`
   :`<div class="card npf"><label><span>Neve</span><input value="Őszi fogyás" aria-label="Neve"></label><label><span>Most</span><input value="78,4 kiló" aria-label="Most"></label><label><span>Cél</span><input value="73 kiló" aria-label="Cél"></label><div><span style="display:block;font:700 12px var(--b);color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Mikorra</span><div class="npopt">${['okt. 31.','dec. 10.','jan. 15.'].map(d=>`<button class="${SW.date===d?'on':''}" data-eudt="${d}">${d}</button>`).join('')}</div></div></div>
     <div class="card npobs" style="margin-top:12px">${aggr?`<span class="chip warm st">Agresszív</span><p>Ez heti <em>1,2 kiló</em> lenne: az izom is menne vele. Reális dátum: december 10.</p><button class="pill soft" data-eudt="dec. 10." style="justify-self:start">Elfogadom</button>`:`<span class="chip soft st">Reális</span><p>Heti <em>0,5 kiló</em>: az erő marad, és bele fér a röpi is.</p>`}</div>`;
  return `${ihead({ph:'en-merleg.jpg',crumb:'Én › Célok › <b>Új súlycél</b>',eb:`${n}. lépés · 2-ből`,title:n===1?'Merre?':'Mennyit, mikorra?',sm:1})}<div class="euwz">${[1,2].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</div>
  <section class="sec rise first" style="--i:1">${body}</section>
  <div class="acts rise" style="--i:2">${n>1?`<button class="pill soft" data-go="en-sulyuj-1">Vissza</button>`:''}<button class="pill" ${n===2?'data-nptoast="Új súlycél: elindult" data-npgo="en-sulycel"':'data-go="en-sulyuj-2"'}>${n===2?'Indítom':'Tovább'}</button></div>
  ${mzCard('A keretet <em>a biometriádból és a mozgásodból</em> számolom, és hetente igazítom.')}</div>`}
/* ── night mode ── */
const NM={st:'idle',c:4};
function ejszaka(){const S=NM.st,tp=`<div class="tp"><button data-euexit aria-label="Kilépés">×</button><b>03:12</b><span style="width:44px"></span></div>`;
  const b=S==='idle'?`<div class="hd"><small>Éjszakai mód</small><h2>Felébredtél?</h2><p>Semmi baj. A képernyő sötét marad, és segítek visszaaludni.</p></div><div class="sp"></div><div class="ft"><button class="go" data-eunm="wait">Segíts visszaaludni</button><button data-euexit>Csak megnéztem</button></div>`
   :S==='wait'?`<div class="hd"><small>Lassan</small><h2>Lélegezz a körrel</h2><p>Nyolc másodperc egy kör. Ha 20 perc múlva is ébren vagy, kelj fel.</p></div><div class="orb"></div><div class="tools">${[['drop','sky','Légzés · 4-7-8','data-eunm="legzes"'],['person','sage','Testpásztázás','data-eunm="test"'],['shoe','peach','Négy perc séta a lakásban','data-eunm="getup"']].map(([ic,pal,t,a])=>`<button ${a}>${G(ic,pal)}${t}</button>`).join('')}</div><div class="sp"></div>`
   :S==='legzes'?`<div class="hd"><small>4-7-8 légzés</small><h2>Belégzés négyig</h2><p>Tartsd hétig, fújd ki nyolcig. Négy kör.</p></div><div class="orb">${NM.c}</div><div class="sp"></div><div class="ft"><button class="go" data-eunm="${NM.c>1?'kor':'getup'}">${NM.c>1?'Következő kör':'Kész'}</button></div>`
   :S==='test'?`<div class="hd"><small>Testpásztázás</small><h2>A lábfejedtől a fejedig</h2><p>Minden testrészt engedj el egy kilégzéssel. Ha elkalandozol, kezdd újra a vállnál.</p></div><div class="orb"></div><div class="sp"></div><div class="ft"><button class="go" data-eunm="getup">Kész</button></div>`
   :`<div class="hd"><small>Ha felkeltél</small><h2>Ülj le halvány fénynél</h2><p>Ne nézd a telefont. Ha álmos vagy, menj vissza az ágyba.</p></div><div class="sp"></div><div class="ft"><button class="go" data-eunmdone>Visszafeküdtem</button></div>`;
  return `<div class="eun"><img src="${PH('en-hold.jpg')}" alt="">${tp}${b}</div>`}
/* ── sheets ── */
const shE=(p,t,c,body)=>`<div class="grab"></div><div class="dsh"><div class="dshph">${p.map(x=>`<img src="${PH(x+'-sq.jpg')}" alt="">`).join('')}</div><h2>${t}</h2>${c?`<div class="chips">${c}</div>`:''}</div>${body}`;
const EW={v:78.4};
Object.assign(SHEETS,{
  enWeight:()=>shE(['en-merleg'],'Súly',ch('ma reggel')+ch('tegnap 78,6','soft'),`<div class="npck"><div class="jar"><span class="tb"><i style="--h:62%"></i></span><div><b id="euwv">${String(EW.v.toFixed(1)).replace('.',',')}</b><small>kiló</small></div></div><div class="npopt">${['−0,5','−0,1','+0,1','+0,5'].map(x=>`<button data-euw="${x}">${x}</button>`).join('')}</div><label class="fld"><span>Egy mondat, ha van mit</span><input placeholder="például: késő vacsora volt" aria-label="Megjegyzés"></label><div class="acts" style="margin:0"><button class="pill" data-toast="Rögzítve: súly" data-close>Mentés</button><button class="pill soft" data-toast="Hallgatlak…">${G('mic','sage')}Diktálom</button></div></div>`),
  enSleep:()=>shE(['mezo-ejjel','en-hold'],'Alvás',ch('tegnap éjjel'),`<div class="npopt" style="margin-bottom:12px">${['Kézzel','Képernyőképről'].map((x,i)=>`<button class="${i?'':'on'}" data-npopt>${x}</button>`).join('')}</div><div class="npsl"><label>Lefekvés<input value="23:20" aria-label="Lefekvés"></label><label>Ébredés<input value="06:36" aria-label="Ébredés"></label><label>Ágyban töltött perc<input value="10" aria-label="Ágyban töltött perc"></label><label>Ébredések<input value="1" aria-label="Ébredések"></label></div><p class="sub" style="margin-top:12px">Minőség</p><div class="npopt">${[4,6,7,8,10].map(v=>`<button class="${v===7?'on':''}" data-npopt>${v}</button>`).join('')}</div><div class="acts" style="margin:16px 0 0"><button class="pill" data-toast="Rögzítve: alvás" data-close>Mentés</button></div>`),
  enSleepGoal:()=>shE(['mezo-ejjel'],'Alváscél',ch('a ritmusod ehhez mér'),`<div class="npck"><div class="jar"><span class="tb"><i style="--h:83%"></i></span><div><b id="eusg" data-m="450">7:30</b><small>óra alvás</small></div></div><div class="npopt">${['−15 perc','+15 perc'].map(x=>`<button data-eusg="${x}">${x}</button>`).join('')}</div><p class="sub">Mihez igazítsunk?</p><div class="npopt">${['Ébredés · 06:45','Lefekvés · 23:15'].map((x,i)=>`<button class="${i?'':'on'}" data-npopt>${x}</button>`).join('')}</div><div class="acts" style="margin:0"><button class="pill" data-toast="Mentve: alváscél" data-close>Mentés</button></div></div>`),
  enJournal:i=>{const e=i!==''&&i!=null?(ENT.concat(ENTA))[+i]:null;return shE([e?e[3]:'nap-naplo'],e?'Bejegyzés szerkesztése':'Új bejegyzés',ch(e?`szeptember ${e[0]}.`:'ma, 14:10'),`<div class="npopt" style="margin-bottom:12px">${['Napló','Hála','Döntés'].map(x=>`<button class="${(e?e[1]:'Napló')===x?'on':''}" data-npopt>${x}</button>`).join('')}</div><textarea class="npta" aria-label="Bejegyzés" placeholder="Mi jár a fejedben?">${e?e[2]:''}</textarea><div class="npopt" style="margin-top:10px">${['Egészség','Kapcsolatok','Munka','Elme'].map(x=>`<button data-npopt>${x}</button>`).join('')}</div><div class="acts" style="margin:14px 0 0"><button class="pill" data-toast="Mentve a naplóba" data-close>Mentés</button>${e?(ES.del===i?`<button class="pill soft" data-toast="Törölve · visszavonás 5 másodpercig" data-close>Biztosan törlöm</button>`:`<button class="pill soft" data-eudel="${i}">Törlöm</button>`):`<button class="pill soft" data-toast="Hallgatlak…">${G('mic','sage')}Diktálom</button>`}</div>`)},
  enDecision:()=>shE(['edz-tarcsa'],'Mi lett belőle?',ch(`visszanézve · ${ES.dec||4} / 5`,'soft'),`<p class="sub">„Szeptembertől heti négy edzésre váltok háromról.”</p><textarea class="npta" aria-label="Mi lett belőle" placeholder="Egy-két mondat…">A négy edzés megy, de a röpi mellett a váll fárad. Lehet, hogy a negyedik legyen könnyebb.</textarea><div class="acts" style="margin:14px 0 0"><button class="pill" data-toast="Mentve" data-close>Mentés</button></div>`),
  enBio:()=>shE(['en-merleg','edz-izom'],'Biometria',ch('a kalóriakeret ebből számol'),`<div class="npsl"><label>Magasság<input value="180 cm" aria-label="Magasság"></label><label>Születés<input value="1992" aria-label="Születési év"></label><label>Testzsír<input value="15%" aria-label="Testzsír"></label><label>Súly<input value="78,4 kiló" aria-label="Súly"></label></div><p class="sub" style="margin-top:12px">Nem</p><div class="npopt">${['Férfi','Nő'].map((x,i)=>`<button class="${i?'':'on'}" data-npopt>${x}</button>`).join('')}</div><p class="sub" style="margin-top:12px">Aktivitás a munkában</p><div class="npopt">${['Ülő','Vegyes','Mozgalmas'].map((x,i)=>`<button class="${i?'':'on'}" data-npopt>${x}</button>`).join('')}</div><div class="acts" style="margin:16px 0 0"><button class="pill" data-toast="Mentve: biometria" data-close>Mentés</button></div>`),
  enStats:()=>shE(['mezo-ejjel','nap-ebredes'],'Miért számít?',ch('kutatási számok'),rowsC([['moon','sky','Rendszeresség','a napi egy órás eltérés is rontja a reggeli energiát'],['chart','deep','Hatékonyság','85% fölött jó: az ágyban töltött idő nagy része alvás'],['bolt','sun','Mély alvás','az izom ebben a szakaszban regenerálódik'],['star','sun','REM','a tanulás és a hangulat szakasza']])),
  enPillar:()=>shE(['nap-lista','salata','edz-tarcsa'],'Pillér a listából',ch('a meglévő adataidból'),`${[['Alvás',['7 óra fölött','lefekvés 23 előtt']],['Fuel',['fehérje-nap','zöldség délután']],['Edzés',['heti 4 edzés','futás a héten']],['Elme',['napló','hála']],['Emberek',['találkozó a héten','hívás a családnak']]].map(([g,L])=>`<p class="sub" style="margin:10px 0 6px">${g}</p><div class="npopt">${L.map(x=>`<button data-npopt>${x}</button>`).join('')}</div>`).join('')}<div class="acts" style="margin:16px 0 0"><button class="pill" data-toast="Pillér hozzáadva" data-close>Hozzáadom</button></div>`)
});

/* ── behaviour ── */
const rr=()=>{const h=location.hash.slice(1),sc=$('#scroll'),y=sc.scrollTop;sc.innerHTML=DOM.en.render(h);sc.querySelectorAll('.rise').forEach(x=>x.classList.remove('rise'));sc.querySelectorAll('.pre').forEach(x=>x.classList.remove('pre'));sc.scrollTop=y};
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;let el;const q=s=>t.closest(s);
  if(el=q('[data-eust]')){const i=+el.dataset.eust;ES.st=ES.st===i?null:i;haptic();rr();return}
  if(el=q('[data-euper]')){ES.per=el.dataset.euper;rr();return}
  if(el=q('[data-euwk]')){const i=el.dataset.euwk;ES.wkOpen[i]=!ES.wkOpen[i];el.parentElement.classList.toggle('open',!!ES.wkOpen[i]);el.setAttribute('aria-expanded',!!ES.wkOpen[i]);return}
  if(q('[data-euolder]')){ES.older=true;rr();return}
  if(el=q('[data-eusp]')){ESL.span=+el.dataset.eusp;rr();return}
  if(q('[data-euunpark]')){ES.parked=true;toast('Spanyol B2 újra aktív');rr();return}
  if(el=q('[data-eudec]')){ES.dec=+el.dataset.eudec;haptic();toast(`Visszanézve: ${ES.dec} / 5`);rr();return}
  if(q('[data-eunaplo]')){ES.naplo=true;rr();return}
  if(el=q('[data-eudel]')){e.stopPropagation();ES.del=el.dataset.eudel;openSheet(SHEETS.enJournal(ES.del));ES.del='';return}
  if(el=q('[data-eugv]')){ES.gview=el.dataset.eugv;rr();return}
  if(el=q('[data-eugs]')){const [k,v]=el.dataset.eugs.split('|');if(v)ES.goalSt[k]=v;else delete ES.goalSt[k];toast(v?v+': '+GOALS.find(g=>g.k===k).t:'Visszavéve');rr();return}
  if(el=q('[data-eucwa]')){CW.area=el.dataset.eucwa;const i=$('#eucwt');if(i)CW.t=i.value;rr();return}
  if(el=q('[data-eucwf]')){CW.fw=el.dataset.eucwf;rr();return}
  if(el=q('[data-eusj]')){SJ.st=el.dataset.eusj;haptic();toast(SJ.st);rr();return}
  if(el=q('[data-eusw]')){SW.dir=el.dataset.eusw;rr();return}
  if(el=q('[data-eudt]')){SW.date=el.dataset.eudt;rr();return}
  if(el=q('[data-eunm]')){const v=el.dataset.eunm;if(v==='legzes')NM.c=4;if(v==='kor'){NM.c--;NM.st='legzes'}else NM.st=v;haptic();rr();return}
  if(q('[data-eunmdone]')){NM.st='idle';toast('Jó éjszakát');location.hash='en-alvas';return}
  if(q('[data-euexit]')){NM.st='idle';location.hash='en-alvas';return}
  if(el=q('[data-euw]')){EW.v=Math.round((EW.v+parseFloat(el.dataset.euw.replace('−','-').replace(',','.')))*10)/10;$('#euwv').textContent=String(EW.v.toFixed(1)).replace('.',',');haptic();return}
  if(el=q('[data-eusg]')){const b=$('#eusg'),m=Math.max(300,Math.min(600,+b.dataset.m+(el.dataset.eusg.startsWith('+')?15:-15)));b.dataset.m=m;b.textContent=`${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;return}
},true);
document.addEventListener('input',e=>{if(e.target.id==='eucwt')CW.t=e.target.value});

/* ── register ── */
const ETAB=['en','en-ures','en-celelerve','en-suly','en-suly-keves','en-alvas','en-alvas-ures','en-celok','en-celok-ures','en-naplo','en-naplo-ures'];
const NBSPE=x=>x.replace(/(\d) (g|perc|óra|pont|kalória|kiló|kg|cm|hét|nap|év)(?=[\s.,:;!?<)·])/g,'$1&nbsp;$2');
const R=h=>{let m;
  if(h==='en')return hub();if(m=h.match(/^en-(ures|celelerve)$/))return hub(m[1]);
  if(h==='en-suly')return suly();if(h==='en-suly-keves')return suly('keves');if(h==='en-alvas')return alvas();if(h==='en-alvas-ures')return alvas('ures');
  if(h==='en-celok')return celok();if(h==='en-celok-ures')return celok('ures');if(h==='en-naplo')return naplo();if(h==='en-naplo-ures')return naplo('ures');
  if(m=h.match(/^en-cel-(\w+)$/))return cel(m[1]);if(m=h.match(/^en-celuj-(\d)$/))return celuj(m[1]);if(h==='en-jelek')return jelek();
  if(h==='en-sulycel')return sulycel();if(h==='en-sulycel-ures')return sulycel('ures');if(m=h.match(/^en-sulycel-(\w+)$/))return sulyresz(m[1]);if(m=h.match(/^en-sulyuj-(\d)$/))return sulyuj(m[1]);
  if(h==='en-ejszaka')return ejszaka();
  return hub()};
DOM.en={tabs:ETAB,render:h=>NBSPE(R(h)),tabName:h=>/suly(?!cel)/.test(h)&&!/sulyuj/.test(h)?'Súly':/alvas/.test(h)?'Alvás':/celok/.test(h)?'Célok':/naplo/.test(h)?'Napló':'Hol tartok',
  after:h=>{$('#phone').classList.toggle('euon',h==='en-ejszaka')}};
window.addEventListener('hashchange',()=>{if(location.hash!=='#en-ejszaka')$('#phone').classList.remove('euon')});

/* side panel */
const notes=document.querySelector('.notes');
const UNOTES=()=>`<h2>Lágy irány · Én</h2><small>Állapot: 2026-11-09 · 1. kör: az öt fül és a Célok</small><p><b>Legutóbb változott · 2026-11-09 · Én, 1. kör:</b> öt fül (a tulajdonos kérésére külön Súly és Alvás), a célok minden oldala, az éjszakai mód és a felugró ablakok. A Hol tartok mélyebb oldalai (heti elemzés, Fejlődés, Emberek, Értesítések) a 2. körben jönnek; addig a legközelebbi meglévő oldalra visznek.</p>
  <p><b>Fülek és állapotok:</b></p><ul><li><a href="#en">Hol tartok</a> · <a href="#en-ures">első hét</a> · <a href="#en-celelerve">cél elérve</a></li><li><a href="#en-suly">Súly</a> · <a href="#en-suly-keves">kevés mérés</a></li><li><a href="#en-alvas">Alvás</a> · <a href="#en-alvas-ures">nincs adat</a> · <a href="#en-ejszaka">éjszakai mód</a></li><li><a href="#en-celok">Célok</a> · <a href="#en-celok-ures">nincs cél</a></li><li><a href="#en-naplo">Napló</a> · <a href="#en-naplo-ures">üres</a></li></ul>
  <p><b>A célok mögött:</b></p><ul><li><a href="#en-cel-kockahas">egy cél</a> · <a href="#en-celuj-1">új cél</a> · <a href="#en-jelek">Jelek</a></li><li><a href="#en-sulycel">súlycél</a> (<a href="#en-sulycel-etrend">étrend</a> · <a href="#en-sulycel-korlatok">védőkorlátok</a> · <a href="#en-sulycel-javaslat">javaslat</a> · <a href="#en-sulycel-ures">biometria kell</a>) · <a href="#en-sulyuj-1">új súlycél</a></li></ul>`;
const setU=on=>{if(!notes)return;const has=document.getElementById('unotes');if(on&&!has){[...notes.children].forEach(c=>{if(!c.classList.contains('tog')){c.dataset.fh=1;c.style.display='none'}});const d=document.createElement('div');d.id='unotes';d.innerHTML=UNOTES();notes.insertBefore(d,notes.firstChild);const t=notes.querySelector('.tog');if(t)d.insertBefore(t,d.children[2]||null)}
  else if(!on&&has){const t=has.querySelector('.tog');if(t){const ref=[...notes.children].find(c=>c.dataset.fh&&c.tagName==='P'&&c.previousElementSibling&&c.previousElementSibling.tagName==='SMALL');notes.insertBefore(t,ref?ref.nextSibling:null)}has.remove();if(!['enotes','nnotes','mnotes'].some(i=>document.getElementById(i)))[...notes.children].forEach(c=>{if(c.dataset.fh){c.style.display='';delete c.dataset.fh}})}};
window.addEventListener('hashchange',()=>setU(/^#en(-|$)/.test(location.hash)));
setU(/^#en(-|$)/.test(location.hash));
['en-futam','en-merleg','mezo-ejjel','en-cipo','nap-naplo'].forEach(n=>{const im=new Image();im.src=PH(n+'.jpg');if(im.decode)im.decode().catch(()=>{});TABPH.push(im)});
})();
