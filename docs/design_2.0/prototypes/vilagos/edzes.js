/* vilagos/edzes.js — Edzés domain in the "Folyadék" identity (Mai · Terv · Terhelés · Gyakorlatok + eligazítás, edzés közben, ceremónia, összegzés, sport, futás, saját edzés).
   Built on window.F (see vilagos/README.md, last part). Every route has its own liquid graphic drawn from that page's data:
   the body filled muscle by muscle (bodyLiq), sets as capsules (caps), weeks/days/muscles as vessels (tubes), waterlines (wlv, cyl), and one-off vessels per page. */
(function(){
const {I,csepp,mchp,muscleColor,page,sec,card,head,hero,btn,lk,step,bar,stat,grid,facts,seg,st,note,txt,msg,chev,act,esc,register,bub,tank,level,fill,area,linked,wave,uid}=F;
const T=I,toast=(...a)=>F.toast(...a),openSheet=(...a)=>F.openSheet(...a),closeSheet=(...a)=>F.closeSheet(...a);
const $=s=>document.querySelector(s);
const P='.phone[data-v="feher"][data-d="edzes"]',Q='.phone.foly[data-s="elo"][data-d="edzes"]';
const kg=v=>v==null?'—':String(v).replace('.',',');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mmss=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const hu=n=>Math.round(n).toLocaleString('hu-HU').replace(/[  ]/g,' ');
/* ── local helpers on top of the kit ── */
const ve=(l,cmd,cls='',x='')=>`<button class="btn ${cls}" data-ve="${cmd}" ${x}>${l}</button>`;
const vl=(l,cmd,cls='',x='')=>`<button class="fh-lk ${cls}" data-ve="${cmd}" ${x}>${l}</button>`;
const acts=(...a)=>`<div class="fh-acts">${a.join('')}</div>`;
const ls=(...a)=>`<div class="vl">${a.flat().join('')}</div>`;
/* rw: a list row that may carry inner buttons (always a div) — on: kit action · ve: local command · m: muscle key */
const rw=o=>{const tap=o.ve||o.on;return `<div class="fh-row ${tap?'tap':''} ${o.cls||''}"${o.ve?` data-ve="${o.ve}"`:act(o.on)}>${o.left||''}${o.icon?`<span class="si">${I(o.icon)}</span>`:''}${o.m?mchp(o.m,'sm'):''}<span class="g"><strong>${o.title}</strong>${o.sub?`<small>${o.sub}</small>`:''}</span>${o.v!=null?`<span class="v">${o.v}</span>`:''}${o.right||''}${tap&&!o.nochev?chev():''}</div>`};
const dk=k=>`color-mix(in srgb,${muscleColor(k)} 74%,#0A2A3C)`;
const lv=(p,c,h=12)=>level(p,{c,h});
const mus=(k,l,v,pct,c)=>`<div class="fh-mus">${mchp(k,'sm')}<span class="l">${l}</span><span class="v">${v}</span>${lv(pct,c||dk(k))}</div>`;
const lab=t=>`<span class="fh-lab">${t}</span>`;
const fld=(t,ph)=>`<div class="fh-in vs-fld ${ph?'ph':''}">${t}</div>`;
const chips=(a,on,cmd='chip')=>`<div class="fh-pills">${a.map((l,i)=>`<button class="fh-pill ${i===on?'on':''}" data-ve="${typeof cmd==='function'?cmd(i):cmd}">${l}</button>`).join('')}</div>`;
const tags=a=>`<div class="fh-chips">${a.map(x=>Array.isArray(x)?`<span class="ic">${bub(x[0],{s:28})}${x[1]}</span>`:`<span class="tx">${x}</span>`).join('')}</div>`;
const stp=(l,v,sub='')=>rw({title:l,sub,right:`<span class="vs-stp"><button data-toast="−">−</button><b>${v}</b><button data-toast="+">+</button></span>`});
/* the 1–10 scale: ten rising vessels, filled up to the chosen one */
const scale=v=>`<div class="vs-scale">${Array.from({length:10},(_,i)=>`<button class="${i+1<v?'f':i+1===v?'a':''}" style="--h:${(i+1)*10}%" data-ve="scale:${i+1}"><i></i><b>${i+1}</b></button>`).join('')}</div>`;
const blk=(l,inner)=>`<div class="vs-blk"><span class="fh-lab">${l}</span>${inner}</div>`;
const box=(icon,title,body='',c='var(--dom)')=>`<div class="vs-box">${icon?bub(icon,{s:36,c}):''}<div><b>${title}</b>${body}</div></div>`;
const sh=(lbl,title='',sub='')=>`<div class="vs-sh"><span>${lbl}</span><button data-close aria-label="Bezárás">×</button></div>${title?`<h2>${title}</h2>`:''}${sub?`<p class="fh-txt vs-sub">${sub}</p>`:''}`;
const shm=(k,lbl,title,sub='')=>`<div class="vs-sh"><span>${lbl}</span><button data-close aria-label="Bezárás">×</button></div><div class="vs-mh">${typeof k==='string'&&byKey[k]?mchp(k):bub(k,{s:46})}<div><h2>${title}</h2>${sub?`<p class="fh-txt vs-sub">${sub}</p>`:''}</div></div>`;
const two=(l,cmd='save')=>acts(ve(l,cmd,'','style="flex:1"'),`<button class="fh-lk" data-close>Mégse</button>`);
const segw=a=>`<div class="vs-seg rise" style="--i:1">${seg(a)}</div>`;
const pair=a=>`<div class="fh-pair">${a.map(([ic,l,at])=>`<button ${at}>${bub(ic,{s:44})}${l}</button>`).join('')}</div>`;
const stk=keys=>`<span class="vs-stk">${keys.slice(0,3).map(k=>mchp(k,'sm')).join('')}</span>`;
const num=n=>`<span class="vs-day">${n}</span>`;

/* ═══ a folyadék-grafikák (az oldalak saját rajzai ezekből készülnek) ═══ */
const wv=(x,y,w,n=5,a=5)=>{const s=w/(2*n);let d=`M${x} ${y}`;for(let i=0;i<n;i++)d+=` q${s/2} ${-a} ${s} 0 q${s/2} ${a} ${s} 0`;return d};
const bbox=(v,s)=>(window.box?window.box(v,s):BODY[v].b[s]);
/* bodyLiq(view, [[muscleKey, done 0..1, planned 0..1]]) — the BodyMap silhouette as a vessel: every muscle shape is its own little tank.
   Light liquid = planned load, deep liquid = already done. Shapes shared by several muscles take the highest level. */
function bodyLiq(v,ent,cls=''){
  const by={};ent.forEach(([k,p=0,pl=0])=>(TOKEN_SHAPES[k]||[]).filter(([x])=>x===v).forEach(([,s])=>{const o=by[s]||(by[s]={k,p:0,pl:0});if(p>=o.p&&pl>=o.pl)o.k=k;o.p=Math.max(o.p,p);o.pl=Math.max(o.pl,pl)}));
  const id=uid('bl');
  const g=Object.entries(by).map(([s,o],i)=>{const [x,y,w,h]=bbox(v,s),c=muscleColor(o.k),Y=p=>y+h*(1-clamp(p,0,1)*.94);
    return `<clipPath id="${id}${i}">${BODY[v].p[s].map(d=>`<path d="${d}"/>`).join('')}</clipPath>
      <g style="fill:color-mix(in srgb,${c} 16%,#fff);stroke:color-mix(in srgb,${c} 70%,#0A2A3C);stroke-width:3.5;stroke-linejoin:round"><use href="#bm-${v}-${s}"/></g>
      <g clip-path="url(#${id}${i})">${o.pl>0?`<path style="fill:color-mix(in srgb,${c} 82%,#fff)" d="${wv(x-6,Y(o.pl),w+12,4,7)} V${y+h+8} H${x-6}Z"/>`:''}${o.p>0?`<path style="fill:${dk(o.k)}" d="${wv(x-6,Y(o.p),w+12,4,7)} V${y+h+8} H${x-6}Z"/>`:''}</g>`}).join('');
  return `<span class="vs-body ${cls}"><svg viewBox="${BODY[v].vb}" aria-hidden="true"><g class="sil"><use href="#bm-sil-${v}"/></g>${g}</svg></span>`}
const duo=(ent,cls='')=>`<span class="vs-duo ${cls}">${bodyLiq('front',ent)}${bodyLiq('back',ent)}</span>`;
/* caps(n, done, colour, {cur}) — a set is a capsule: n small capsules, `done` of them full, `cur` half */
const caps=(n,d,c='var(--dom)',{cur=-1,cls=''}={})=>`<span class="vs-caps ${cls}" style="--c:${c}">${Array.from({length:n},(_,j)=>`<i class="${j<d?'f':j===cur?'h':''}"></i>`).join('')}</span>`;
/* tubes([{l,v,s,p,c,mark,wl,ic,m,now,ghost,hatch,over,sel,on,ve}],{h,cls,gap}) — the kit's test tubes, plus a waterline (wl %), a muscle chip (m),
   ghost (planned, not yet poured), hatch (deload / rest), over (spilling), now (the current one) */
const tube=o=>{const c=o.c||'var(--dom)',a=o.ve?` data-ve="${o.ve}"`:act(o.on||{toast:o.t||[o.l,o.v,o.s].filter(Boolean).join(' · ')});
  return `<button class="k2-vial vs-t ${o.now?'now':''} ${o.ghost?'ghost':''} ${o.hatch?'hatch':''} ${o.sel?'sel':''} ${o.over?'over':''}"${a} style="--c:${c}"><span class="k2-tube"${o.h?` style="height:${o.h}px"`:''}><em>${o.mark??''}</em>${o.p>0?`<span class="l" style="--p:${clamp(o.p,3,100)}%">${wave(`color-mix(in srgb,${c} 70%,#fff)`)}</span>`:''}${o.wl!=null?`<i class="wl" style="bottom:${clamp(o.wl,0,97)}%"></i>`:''}${o.m?mchp(o.m,'sm'):o.ic?I(o.ic):''}</span>${o.over?'<i class="ov"></i>':''}${o.v!=null?`<b>${o.v}</b>`:''}<small>${o.l??''}${o.s?`<i>${o.s}</i>`:''}</small></button>`};
const tubes=(a,{h=112,cls='',gap}={})=>`<div class="k2-vials vs-ts ${cls}" style="grid-template-columns:repeat(${a.length},minmax(0,1fr))${gap!=null?`;gap:${gap}px`:''}">${a.map(o=>tube({...o,h:o.h||h})).join('')}</div>`;
/* wlv(pct, colour, [[x%, class, label]]) — a horizontal vessel with waterlines (MEV / MAV … marks) */
const wlv=(p,c,marks=[],h=14)=>`<span class="vs-wlv" style="--c:${c};--h:${h}px"><i style="width:${clamp(p,0,100)}%"></i>${marks.map(([x,k='',l=''])=>`<u class="${k}" style="left:${clamp(x,0,100)}%">${l?`<em>${l}</em>`:''}</u>`).join('')}</span>`;
/* split(a, b) — one vessel, two liquids: what is already in (deep) and what still comes (light) */
const split=(a,b,c='var(--dom)')=>`<span class="vs-split" style="--c:${c}"><i style="width:${a}%"></i><u style="left:${a}%;width:${b}%"></u></span>`;
/* pour([[muscleKey, sets]]) — a workout poured into one vessel: each exercise is a layer in its muscle's colour */
const pour=parts=>`<div class="vs-pour">${parts.map(([k,n])=>`<i style="flex:${n};--c:${dk(k)}"><b>${n}</b></i>`).join('')}</div>`;
/* emptyTank(text, acts) — an empty vessel for the "nothing here yet" states */
const emptyTank=(icon,t,a='')=>`<div class="vs-ev">${bub(icon,{s:52})}<p>${t}</p>${a?`<div class="fh-acts" style="justify-content:center">${a}</div>`:''}<i></i></div>`;
/* drops(n, of) — intensity as drops */
const drops=(n,of=3,c='var(--dom)')=>`<span class="vs-dr" style="--c:${c}" aria-label="${n} / ${of}">${Array.from({length:of},(_,i)=>`<i class="${i<n?'f':''}"></i>`).join('')}</span>`;
/* rcap(prev%) — a record: the liquid stands above the old waterline */
const rcap=(prev,c='var(--carb)')=>`<span class="vs-rc" style="--c:${c}"><i></i>${prev!=null?`<u style="bottom:${clamp(prev,8,92)}%"></u>`:''}</span>`;
/* areaM — the kit's liquid area plus marks on it: [index, label, kind('now'|'pr')] */
function areaM(v,o={},marks=[]){const {w=320,h=130,pad=8,labels=null,target=null,dots=null}=o;const all=[...v,...(dots||[]),...(target!=null?[target]:[])];const lo=o.min??Math.min(...all),hi=o.max??Math.max(...all),r=(hi-lo)||1;
  const X=i=>pad+i*(w-2*pad)/(v.length-1),Y=y=>pad+(1-(y-lo)/r)*(h-2*pad-(labels?14:0)),base=h-(labels?14:0);
  const m=marks.map(([i,l,k])=>{const x=X(i),y=Y(v[i]);return k==='now'?`<path d="M${x} ${y}V${base}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="2 4" opacity=".55"/><circle cx="${x}" cy="${y}" r="6" fill="var(--ink)" stroke="#fff" stroke-width="3"/><text x="${x}" y="${Math.max(11,y-12)}" text-anchor="middle" font-size="10.5" font-weight="800" fill="var(--ink)">${l}</text>`
    :`<path d="M${x} ${y-7} c-5 -7 -7 -10 -7 -14 a7 7 0 0 1 14 0 c0 4 -2 7 -7 14Z" fill="var(--carb)" stroke="#fff" stroke-width="1.5"/>${l?`<text x="${x}" y="${Math.max(9,y-31)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--ink)">${l}</text>`:''}`}).join('');
  return area(v,o).replace('</svg>',m+'</svg>')}
/* egyedi körvonalak a fill()-hez (0 0 100 100) */
const SH_KETTLE='M33 36 C22 12 78 12 67 36 C84 44 91 60 86 74 C81 89 66 95 50 95 C34 95 19 89 14 74 C9 60 16 44 33 36Z';
const SH_FLASK='M40 7 H60 V36 L87 82 C90 88 86 95 78 95 H22 C14 95 10 88 13 82 L40 36Z';
const SH_CUP='M20 9 H80 V34 C80 55 67 67 55 70 V81 H70 V93 H30 V81 H45 V70 C33 67 20 55 20 34Z';

/* ── adatok (az élő mock alapján, a mai Pull Day gyakorlataival) ── */
const MESO={name:'Hypertrophy 04',week:3,of:6,phase:'MAV',curve:['MEV','MEV','MAV','MAV','MRV','Deload'],from:'Máj 1',to:'Jún 12',split:'Pull / Push / Legs · 5×/hét'};
const PHASE={MEV:'Emelkedés',MAV:'Emelkedés',MRV:'Csúcshét',Deload:'Pihenőhét'};
const PH_H={MEV:34,MAV:66,MRV:100,Deload:26};
const WEEK_SETS=[52,61,75,75,84,38];
const EX0=[
 {n:'Húzódzkodás (súlyozott)',k:'back-wide',last:'10 × 8 · RIR 2',goal:'12,5 × 8',chg:'+2,5 kg',sets:[[12.5,8,2,'tick'],[12.5,8,1,'record'],['cur',12.5,8,2],['up',12.5,8,2]]},
 {n:'Döntött törzsű evezés',k:'back-mid',last:'70 × 10 · RIR 2',goal:'72,5 × 10',chg:'+2,5 kg',note:'Könyök a test mellett, lassú negatív',sets:[['up',72.5,10,2],['up',72.5,10,2],['up',72.5,10,2]]},
 {n:'Rear Delt Fly',k:'shoulder-rear',last:'12,5 × 12 · RIR 2',goal:'10 × 12',chg:'könnyítve · −2,5 kg',why:'A jobb vállad fáj (5/10) — ma könnyebb súllyal, vagy hagyd ki',sets:[['up',10,12,3],['up',10,12,3],['up',10,12,3]]},
 {n:'Kalapácsbicepsz',k:'biceps-brachialis',last:'16 × 12 · RIR 1',goal:'16 × 13',chg:'+1 ism.',why:'A 18 kg +12% ugrás lenne — előbb ismétlés 16 kg-mal',sets:[['up',16,13,1],['up',16,13,1],['up',16,13,1]]},
 {n:'Vállemelés',k:'traps',last:'30 × 15 · RIR 2',goal:'30 × 15',chg:'tartjuk',cue:'Fent tarts egy pillanatot, ne forgasd a vállad',sets:[['up',30,15,2],['up',30,15,2],['up',30,15,2]]}];
const EX=JSON.parse(JSON.stringify(EX0));
const isDone=x=>typeof x[0]==='number';
const TOT=()=>EX.reduce((a,e)=>a+e.sets.length,0);
const DONE=()=>EX.reduce((a,e)=>a+e.sets.filter(isDone).length,0);
const LIB=[['Seated Cable Row','back-mid','compound','70 × 12',70,12],['T-Bar Row','back-mid','compound',null,null,10],['Egykezes evezés','back-mid','compound','36 × 10',36,10],['Gépi evezés · semleges','back-mid','compound','80 × 11',80,11],['Lehúzás · semleges fogás','back-wide','compound','77 × 10',77,10],['Segített húzódzkodás','back-wide','compound',null,null,8],['Nyújtott karú lehúzás','back-wide','isolation','30 × 14',30,14],['Reverse Pec Deck','shoulder-rear','isolation','45 × 14',45,14],['Face Pull','shoulder-rear','isolation','27 × 17',27,17],['Vállemelés · kézisúlyzó','traps','isolation','28 × 14',28,14],['Bayesian Curl','biceps-long','isolation','14 × 12',14,12],['Scott-pad bicepsz','biceps-short','isolation',null,null,11],['Fekvenyomás','chest-mid','compound','92,5 × 8',92.5,8],['Ferde kézisúlyzós nyomás','chest-upper','compound','32 × 10',32,10],['Oldalemelés','shoulder-side','isolation','12 × 15',12,15],['Tricepsz nyújtás kábellel','triceps-long','isolation','25 × 12',25,12],['Román felhúzás','ham','compound','100 × 8',100,8],['Hack guggolás','quad','compound','120 × 9',120,9],['Kábeles hasprés','core','isolation','40 × 15',40,15]];
const regionOf=k=>byKey[k]?.region;
const CHAL=[
 {type:'Túlterhelés',ex:'Húzódzkodás (súlyozott)',target:'12,5 kg × 8',conf:'tanulom',why:'Múlt hét 8 × 10 kg a tartomány tetején → +2,5 kg',pre:true,acc:true},
 {type:'PR-kísérlet',ex:'Döntött törzsű evezés',target:'75 kg × 8',conf:'72%',why:'Május óta 70 a stabil ablak. Múlt heti RIR 2 és 7,2 óra alvás — ez a kombináció 4-ből 3-szor bírt el +5 kg-ot.',pre:true,acc:true},
 {type:'Mélység',ex:'Kalapácsbicepsz',target:'Az utolsó szett RIR 0-ig',conf:'81%',why:'Múlt héten RIR 1-gyel zártuk — a 3. héten (MAV) az utolsó szett RIR 0 logikus lépés.',pre:true,acc:true},
 {type:'Volumen',ex:'Rear Delt Fly',target:'+1 szett · 4 × 12',conf:'68%',why:'A hátsó váll heti 12 szettet kér nálad, ezen a héten 9-nél tartunk. Ma könnyített súllyal — csak ha nem fáj.',pre:false,acc:false}];
CHAL.forEach(c=>c.rel=false);
const QICON={'Túlterhelés':'t-up','PR-kísérlet':'t-record','Mélység':'t-hold','Volumen':'t-protocol'};
const VI={tick:'t-tick',record:'t-record',up:'t-up',down:'t-down'};
const CATS=[['ILLNESS','t-ill','Beteg vagyok',1],['STOMACH','t-digestion','Gyomorrontás',1],['INJURY','t-pain','Sérülés / fájdalom',1],['TRAVEL','t-travel','Úton vagyok',1],['TIRED','t-rested','Fáradt vagyok',0],['NO_TIME','t-clock','Nincs időm',0],['NO_MOOD','t-motivation','Nincs kedvem',0],['OTHER','t-other','Egyéb',0]];
const SKT={gym:'Pull Day',volley:'Röpi edzés · BVSC',sze:'Leg Day',run:'Sprint-intervallum'};
const CARE={ILLNESS:'Jobbulást!',STOMACH:'Jobbulást!',INJURY:'Kíméld magad.',TRAVEL:'Jó utat!'};
const KDUR=['Csak ma','2–3 nap','Kb. egy hét','Nem tudom'],KEST=['csak ma','2–3 nap','kb. egy hét',null],KOFF=[0,2,6,null];
const KWHO={ILLNESS:'Beteg vagy',STOMACH:'Gyomorrontás',INJURY:'Sérülés / fájdalom',TRAVEL:'Úton vagy'};
const TODAY='csu';
const DAYS=[
 {id:'het',d:'Hét',full:'Hétfő',t:'Push',sets:16,min:62,done:{sets:16,min:68,rec:1},mus:[['chest-mid',4],['chest-upper',3],['shoulder-front',3],['shoulder-side',3],['triceps-medial',3]],ex:[['Fekvenyomás','chest-mid',4,'6–8',1,2,80],['Ferde kézisúlyzós nyomás','chest-upper',3,'8–10',1,2,30],['Vállból nyomás','shoulder-front',3,'8–10',2,2,45,'Kímélő változat · kábeles variánssal helyettesítve'],['Oldalemelés','shoulder-side',3,'12–15',1,2,10],['Tricepsz letolás','triceps-medial',3,'10–12',1,2,27]]},
 {id:'kedd',d:'Kedd',full:'Kedd',t:'Legs A',sets:12,min:48,done:{sets:12,min:51,rec:0},mus:[['quad',6],['ham',3],['calf',3]],ex:[['Elülső guggolás','quad',3,'8–10',2,2,90],['Lábhajlítás','ham',3,'10–12',1,2,45],['Kitörés sétálva','quad',3,'12',1,2,20],['Álló vádliemelés','calf',3,'12–15',0,2,60]]},
 {id:'sze',d:'Sze',full:'Szerda',t:'Legs',sets:19,min:70,done:{sets:17,min:74,rec:2},mus:[['quad',7],['ham',6],['glute',3],['calf',3]],ex:[['Guggolás','quad',4,'6–8',1,2,120],['Román felhúzás','ham',3,'8–10',1,2,100],['Lábtolás','quad',3,'10–12',1,2,180],['Lábhajlítás','ham',3,'10–12',1,2,45],['Csípőemelés','glute',3,'8–10',1,2,110],['Álló vádliemelés','calf',3,'12–15',0,2,60]]},
 {id:'csu',d:'Csü',full:'Csütörtök',t:'Pull',sets:16,min:64,mus:[['back-wide',4],['back-mid',3],['shoulder-rear',3],['biceps-brachialis',3],['traps',3]],ex:[['Húzódzkodás (súlyozott)','back-wide',4,'6–8',2,2,12.5],['Döntött törzsű evezés','back-mid',3,'8–10',2,2,72.5],['Rear Delt Fly','shoulder-rear',3,'12–15',2,1,12.5,'Jobb váll · könnyített súly, amíg fáj'],['Kalapácsbicepsz','biceps-brachialis',3,'10–12',1,1,16],['Vállemelés','traps',3,'12–15',2,1,30]]},
 {id:'pen',d:'Pén',full:'Péntek',t:'Push · light',sets:12,min:46,mus:[['chest-upper',3],['chest-mid',3],['shoulder-side',3],['triceps-long',3]],ex:[['Ferde kézisúlyzós nyomás','chest-upper',3,'10–12',2,2,26],['Kábeles tárogatás','chest-mid',3,'12–15',1,2,14],['Oldalemelés','shoulder-side',3,'12–15',1,2,9],['Tricepsz nyújtás fej fölött','triceps-long',3,'10–12',1,2,25]]},
 {id:'szo',d:'Szo',full:'Szombat',t:'Röplabda · meccs',sport:true},
 {id:'vas',d:'Vas',full:'Vasárnap',t:'Pihenőnap',rest:true}];
const WMUS=[['Hát','back-wide',10,10,14,20],['Váll','shoulder-side',12,8,14,20],['Comb','quad',13,8,14,20],['Lábhajlító','ham',9,6,12,16],['Mell','chest-mid',13,8,12,18],['Tricepsz','triceps-medial',6,6,10,14],['Vádli','calf',6,6,10,14],['Far','glute',3,8,12,18],['Bicepsz','biceps-brachialis',3,8,12,16]];
const WTOTAL=WMUS.reduce((s,m)=>s+m[2],0),ROLL=['Hát','Váll','Comb'];
const RUNS=[{n:'Hypertrophy 04 · Tavasz',st:'fut',weeks:6,wk:3,split:'Pull / Push / Legs · 5×/hét',from:'Máj 1',to:'Jún 12'},{n:'Strength 02 · Nyár',st:'következik',weeks:7,split:'Upper / Lower · 4×/hét',from:'Jún 16',to:'Aug 4',days:4},{n:'Pre-cut maintenance · Aug',st:'következik',weeks:3,split:'Full body · 4×/hét',from:'Aug 7',to:'Aug 28',days:4}];
const CLOSED=[{n:'Recovery rebuild · Tél',weeks:8,from:'Feb 12',to:'Ápr 23',pct:86,rep:true},{n:'Hypertrophy 03 · Ősz',weeks:6,from:'Okt 2',to:'Nov 13',pct:92,rep:true},{n:'Cut prep · Nyár',weeks:6,from:'Jún 4',to:'Júl 16',pct:71,rep:false}];
const TPL=[{n:'Hypertrophy 04 · Tavasz',split:'Pull / Push / Legs · 5×/hét',weeks:6,days:5,min:58,runs:2,mus:['chest-mid','back-wide','quad','shoulder-side']},{n:'Upper / Lower · alap',split:'Upper / Lower · 4×/hét',weeks:7,days:4,min:65,runs:1,mus:['back-mid','chest-upper','quad','ham']},{n:'Full body · utazós',split:'Full body · 3×/hét',weeks:4,days:3,min:42,runs:0,mus:['quad','back-wide','chest-mid']}];
const LD_GROUPS=[['Hát','back-wide',14,20,'Kétharmadánál jársz a heti hát-adagnak.'],['Mell','chest-mid',10,13,'Majdnem megvan, egy push-nap maradt.'],['Láb','quad',16,29,'A szerdai láb még hátravan.'],['Váll','shoulder-side',9,12,'Jó úton.'],['Kar','biceps-brachialis',6,9,'Kicsit elmarad.'],['Core','core',0,0,'Ezen a héten nem volt core-munka.']];
const LD_DONE=55,LD_PLAN=83;
const GR=[['back-wide','Hát',24,22,'ez a hét itt már megvan',1],['chest-mid','Mell',12,16,'még 4 szett van hátra'],['shoulder-side','Váll',10,14,'még 4 szett van hátra'],['biceps-long','Kar',9,16,'még 7 szett van hátra'],['quad','Láb',3,18,'még 15 szett van hátra'],['core','Core',0,8,'erre a hét második fele épül']];
const GY=[['Fekvenyomás','chest-mid',140,4],['Döntött törzsű evezés','back-mid',140,5],['Húzódzkodás (súlyozott)','back-wide',98,3],['Vállból nyomás','shoulder-front',72,1],['Oldalemelés','shoulder-side',null],['Kalapácsbicepsz','biceps-brachialis',26,1],['Guggolás','quad',150,2],['Román felhúzás','ham',155,0]];
const SPORTS=[['t-volley','Röplabda'],['t-crossfit','CrossFit / HIIT'],['t-trx','TRX / funkcionális'],['t-bike','Kerékpár'],['t-swim','Úszás'],['t-football','Foci'],['t-basket','Kosárlabda'],['t-tennis','Tenisz'],['t-hike','Túra'],['t-other','Egyéb mozgás'],['t-run','Futás']];
const CER={ratio:.9,sets:14,reps:142,vol:4180,min:71,xp:185,kcal:540,rec:[['Húzódzkodás (súlyozott)','Súly-rekord',['12,5 kg','8 ism.']],['Döntött törzsű evezés','Rep-rekord',['10 ism.','72,5 kg']]],chal:[[1,'Túlterhelés','Húzódzkodás (súlyozott)',['12,5 kg','8 ism.']],[0,'Mélység','Kalapácsbicepsz',['utolsó szett','RIR 0']]],mus:[['back-wide','Hát (széles)',4,4],['back-mid','Hát (közép)',3,3],['shoulder-rear','Váll (hátsó)',3,3],['biceps-brachialis','Kar',2,3],['traps','Trapéz',2,3]]};
const KIND_IC={'Súly-rekord':'t-weight','Rep-rekord':'t-repeat','1RM-rekord':'t-ring','Volumen-rekord':'t-protocol'};
const starCls=(i,p)=>{const t=(i+1)/5;return p>=t-.001?'is-lit':p>=t-.1?'is-half':''};
const stars5=r=>`<span class="mstars" aria-hidden="true">${[0,1,2,3,4].map(i=>{const c=starCls(i,r);return T(c==='is-lit'?'t-star':c==='is-half'?'t-star-half':'t-star-empty')}).join('')}</span>`;
const SJ0=()=>({name:'Pihenőnapi felső',open:-1,ex:[{n:'Fekvenyomás',k:'chest-mid',bem:2,w:4,lo:6,hi:8,rir:1,kg:80,vol:true},{n:'Lehúzás · semleges fogás',k:'back-wide',bem:2,w:3,lo:10,hi:12,rir:2,kg:null,vol:true,warn:'Semleges fogás · csukló-kíméletes'},{n:'Oldalemelés',k:'shoulder-side',bem:0,w:3,lo:12,hi:15,rir:1,kg:10,vol:true}]});

/* ── állapot ── */
const ST={day:'plan',ready:'offer',sk:{},skord:[],km:null,cb:null,udv:0,whyk:null,tick:null,resting:false,restLeft:90,restTotal:90,restT:null,pick:{mode:'swap',g:0,f:'all',q:'',lib:0},cmp:false,cmpSel:[],sj:SJ0(),sjmode:'edit',demo:null,terv:'run'};
const catOf=k=>CATS.find(c=>c[0]===ST.sk[k]?.cat);
const serious=k=>Boolean(catOf(k)?.[3]);
const passKey=()=>ST.skord.find(k=>!serious(k));
const skLabel=k=>{const c=catOf(k);if(!c)return 'ok nélkül';if(c[0]==='OTHER'&&ST.sk[k].text)return `„${ST.sk[k].text}”`;return c[2]};
const skEffect=k=>serious(k)?`Nem számít mulasztásnak. ${CARE[ST.sk[k].cat]}`:passKey()===k?'A heti szabadjegyed fedezi — a sorozatod marad.':'Rendes kihagyásnak számít — a heti szabadjegy már elment. Semmi gond.';
const kmIc=()=>CATS.find(c=>c[0]===ST.km.cat)[1];
const kmExpired=()=>KOFF[ST.km.dur]!==null&&ST.km.day-1>KOFF[ST.km.dur];
const kmCovers=k=>{if(!ST.km||ST.km.released)return false;return k==='gym'||k==='volley'||((k==='run'||k==='sze')&&ST.km.day>=2)};
const kmTitle=()=>{const e=KEST[ST.km.dur];return `${KWHO[ST.km.cat]} · ${e?`becslés: ${e}${kmExpired()?' volt':''}`:'még nem tudod, meddig tart'}`};
const cbSets=n=>Math.max(1,n-Math.round(n/3));
const CBT=()=>EX.reduce((a,e)=>a+cbSets(e.sets.length),0);
function applyDemo(arg){const d=['kimelo','kimelo3','vissza','folyamatban','kesz','alap'].includes(arg)?arg:'alap';if(d===ST.demo)return;ST.demo=d;
  ST.cb=null;ST.km=null;ST.day='plan';delete ST.sk.gym;delete ST.sk.volley;ST.skord=ST.skord.filter(x=>x!=='gym'&&x!=='volley');
  if(d==='kimelo')ST.km={cat:'ILLNESS',dur:1,day:1,released:false,asked:false,from:null};
  if(d==='kimelo3')ST.km={cat:'STOMACH',dur:0,day:3,released:false,asked:false,from:null};
  if(d==='vissza')ST.cb={n:1,of:2,waived:false,prev:{cat:'ILLNESS',dur:1,day:4,released:false,asked:false,from:null}};
  if(d==='folyamatban')ST.day='run'; if(d==='kesz')ST.day='done';}
ST.focus=null;
function repaint(){const ph=$('#phone');const f=ROUTES[F.R]||ROUTES.mai;const t=document.createElement('div');t.innerHTML=f(F.ARG);const nsc=t.querySelector('.scroll'),osc=ph.querySelector('.scroll');
  if(osc&&nsc){const y=osc.scrollTop;osc.innerHTML=nsc.innerHTML;osc.style.cssText=nsc.style.cssText;osc.querySelectorAll('.rise').forEach(e=>e.classList.remove('rise'));osc.scrollTop=y;
    ph.querySelectorAll(':scope>.fh-foot').forEach(e=>e.remove());t.querySelectorAll(':scope>.fh-foot').forEach(e=>ph.insertBefore(e,ph.querySelector(':scope>.toast')))}
  else ph.innerHTML=t.innerHTML}
ST.wz=2;

/* ── MAI ── */
function dstrip(sel='ma'){
  const kmF=ST.km?'km':'•';
  const D=[['H',21,'tick'],['K',22,ST.km&&ST.km.day>=3?'km':'tick'],['Sze',23,kmCovers('sze')?'km':ST.sk.sze?'skip':'–','sze'],['Cs',24,ST.day==='done'?'tick':kmCovers('gym')&&ST.day==='plan'?'km':ST.sk.gym&&ST.day==='plan'?'skip':'ma','ma'],['P',25,kmF],['Szo',26,'pihenő'],['V',27,'pihenő']];
  return `<section class="ds rise">${D.map(([l,n,m,k])=>`<button class="${k&&k===sel?'on':''} ${m==='pihenő'?'rest':''}" ${k?`data-go="${k==='ma'?'mai':'mai.'+k}"`:`data-toast="${l} · szept ${n}."`}><small>${l}</small><b>${n}</b><i class="${m==='tick'?'ok':''}">${m==='tick'?I('i-check'):m==='skip'?I('i-skip'):m==='km'?I('t-kimelo'):m}</i></button>`).join('')}</section>`}
const LBL={'back-wide':'Hát','back-mid':'Hát közép','shoulder-rear':'Hátsó váll','biceps-brachialis':'Kar','traps':'Trapéz'};
const WORD=n=>n>=4?'erős':n>=3?'közepes':'enyhe';
/* a mai Pull Day izmai: [kulcs, név, tervezett szett, kész szett] — a kész a futó edzés szettjeiből számol */
function musToday(){const pl={},dn={};EX0.forEach(e=>pl[e.k]=(pl[e.k]||0)+e.sets.length);
  if(ST.day==='done')CER.mus.forEach(([k,,d])=>dn[k]=d);else if(ST.day==='run')EX.forEach(e=>dn[e.k]=(dn[e.k]||0)+e.sets.filter(isDone).length);
  return Object.keys(LBL).map(k=>[k,LBL[k],pl[k]||0,Math.min(pl[k]||0,dn[k]||0)])}
const todayBody=(cls='')=>bodyLiq('back',musToday().map(([k,,p,d])=>[k,d/4,p/4]),cls);
const mchips=()=>`<div class="fh-chips">${Object.keys(LBL).map(k=>`<span>${mchp(k,'sm')}${LBL[k]}</span>`).join('')}</div>`;
const skBlock=k=>box(catOf(k)?catOf(k)[1]:'t-skip',`Kihagyva · ${skLabel(k)}`,`<p>${skEffect(k)}</p>`);
const skActs=k=>vl(catOf(k)?'Másik ok':'Okot adok',`skwhy:${k}`)+vl('Visszavonom',`skundo:${k}`);
function thero(){
  const km=ST.day==='plan'&&kmCovers('gym'),sk=!km&&ST.day==='plan'&&ST.sk.gym,cb=!km&&!sk&&ST.day==='plan'&&ST.cb&&!ST.cb.waived,rel=ST.day==='plan'&&ST.km&&ST.km.released;
  const state=km?`Kímélő mód · ${ST.km.day}. nap`:sk?'Kihagyva':cb?`Visszatérő edzés · ${ST.cb.n}/${ST.cb.of}`:{plan:'Betervezve · húzó nap · MAV szakasz',run:`Folyamatban · ${DONE()} szett kész a ${TOT()}-ból`,done:'Kész · 14 szett a 16-ból'}[ST.day];
  const cta={plan:['Edzés indítása','indulas'],run:[`Folytassuk · ${DONE()} szett kész`,'session'],done:['Eredmény · 16 szett','review']}[ST.day];
  let body=`<div class="vs-h2"><button class="vs-hb ${km||sk?'off':''}" data-go="terkep" aria-label="A mai izmok a testeden">${todayBody()}<small>${km?'kímélő mód · ma pihen':sk?'ma kimarad':ST.day==='plan'?'ennyit kér ma a hátadtól':'sötét = már megvan'}</small></button>
    <div class="vs-hf">${[['5','gyakorlat'],[cb?`<s>16</s> ${CBT()}`:'16','szett'],[`~${cb?Math.round(78*CBT()/16/5)*5:78}`,'perc']].map(([b,s])=>`<span><b>${b}</b><small>${s}</small></span>`).join('')}</div></div>`+mchips(),a;
  if(km){const ask=kmExpired()&&!ST.km.asked;
    body+=box(kmIc(),kmTitle(),`<p>Az edzés ma magától kimarad. Nem számít mulasztásnak, a sorozatod marad.</p>${ask?'<p><b>A becsült idő letelt — hogy vagy?</b></p>':''}`);
    a=ve('Jobban vagyok','kmback')+(ask?vl('Még nem','kmnotyet'):'')+vl('Ma mégis edzek','kmrel:1')}
  else if(sk){body+=skBlock('gym');a=skActs('gym')}
  else{
    if(cb)body+=box('t-sprout','Könnyített visszatérés','<p>Harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.</p>')+`<div class="vs-cb">${EX.map(e=>`<div><span>${e.n}</span><span>${caps(e.sets.length,cbSets(e.sets.length),dk(e.k))}<s>${e.sets.length}</s> <b>${cbSets(e.sets.length)}</b> szett</span></div>`).join('')}</div><div class="vs-in" style="padding:8px 0 0">${vl('Kikapcsolom a könnyítést','cbwaive')}${vl('Mégsem vagyok jól','cbundo')}</div>`;
    if(rel)body+=box('t-kimelo','Kímélő mód közben edzel','<p>Csak ma, könnyítve: kevesebb sorozat, kb. 10%-kal kisebb súly.</p>');
    a=`<button class="btn" style="flex:1" data-go="${cta[1]}">${cta[0]}</button>`+(!rel&&ST.day==='plan'?vl('Kihagyom','skip:gym'):'')+(rel?vl('Mégse','kmrel:0'):'')}
  return hero({lbl:'Mai edzés · 07:30 · Gym',verdict:'Pull Day',big:true,sub:state,body,acts:a},1)}
function readyCard(){
  if(ST.day!=='plan'||ST.ready==='gone'||ST.sk.gym||kmCovers('gym'))return '';
  if(ST.ready==='done')return hero({lbl:'Mai állapot · könnyítve',verdict:'Ma egy fokkal lejjebb',sub:'Minden gyakorlatnál a múlt heti súly marad, nem emelünk. A Rear Delt Fly nehéz szettjei kimaradnak.',left:bub('t-tick',{s:56,c:'var(--ok)'}),acts:vl('Visszaállítom a tervet','ready:undo')},2);
  return hero({warn:true,lbl:'Mai állapot · a reggeli check-inből',verdict:'Könnyebb nap javasolt',
    body:tubes([{l:'Kipihentség',ic:'t-rested',v:'4/10',p:40,c:'var(--warn)',mark:'10',t:'Kipihentség 4/10 — a reggeli check-inből'},{l:'Izomláz',ic:'t-soreness',v:'7/10',p:70,c:'var(--bad)',mark:'10',t:'Izomláz 7/10 — a reggeli check-inből'},{l:'Kedv',ic:'t-motivation',v:'5/10',p:50,c:'var(--warn)',mark:'10',t:'Kedv 5/10 — a reggeli check-inből'}],{h:112,cls:'rd'})
      +box('t-pain','Rear Delt Fly','<p>Fáj a jobb vállad (5/10). Ma óvatosan: könnyebb súly, vagy hagyd ki.</p>','var(--warn)')+note('Csak javaslat — magától nem változtat semmit.'),
    acts:ve('Könnyítsük','ready:lighten','sm')+ve('Maradjon a terv','ready:keep','sm ghost')},2)}
function weekTubes(mode){const ti=DAYS.findIndex(x=>x.id===TODAY);
  return tubes(DAYS.map((d,i)=>{if(d.rest||d.sport)return {l:d.d,v:'–',p:0,hatch:true,ic:d.sport?'t-volley':'t-moon',on:`nap.${d.id}`,mark:''};
    const c=dk(d.mus[0][0]),done=mode!=='plan'&&d.done&&i!==ti,now=mode!=='plan'&&i===ti;
    return {l:d.d,v:done?d.done.sets:d.sets,p:done?d.done.sets/19*96:now&&ST.day==='done'?14/19*96:mode==='plan'?d.sets/19*96:0,wl:done||mode==='plan'?null:d.sets/19*96,c,now,ghost:!done&&mode!=='plan'&&!(now&&ST.day==='done'),on:`nap.${d.id}`,mark:d.t.split(' ')[0]}}),{h:96,cls:'wk',gap:6})}
function mai(arg){
  applyDemo(arg);
  if(arg==='ures')return page('edzes',{title:'Edzés',sub:'Mai nap',tab:'mai'},`
    ${hero({lbl:'Mai nap',verdict:'Még nincs edzésterved.',sub:'Itt fog élni a mai edzésed — előbb tervezz egy mesociklust.',body:emptyTank('t-peak','Üres edény: ide töltődik majd a mai edzésed.'),acts:btn('Tervezz mesociklust','ujterv')+lk('Saját edzés',{sheet:'custom'})})}`);
  if(arg==='pihen')return page('edzes',{title:'Edzés',sub:`${MESO.name} · ${MESO.week}. hét / ${MESO.of}`,tab:'mai'},`${dstrip('')}
    ${hero({lbl:'Ma pihenőnap',verdict:'Ma a pihenés dolgozik.',sub:'Nincs tervezett edzés mára — a heti rended a Terv fülön találod.',art:'t-moon',body:`<div class="vs-hg">${weekTubes()}</div>`+note('A heted eddig: a teli edények megvoltak, a szaggatott vonal a még hátralévő napok terve.'),acts:btn('A heti rendem','terv','ghost')},1)}
    ${sec(1,'Ha mégis mozognál',2)}
    ${card(ls(rw({icon:'t-dumbbell',title:'Saját edzés',sub:'gyors indítás',on:{sheet:'custom'}}),rw({icon:'c-i-retegek',title:MESO.name,sub:'MAV · 3. hét / 6',on:'run'})),{i:2})}`);
  if(arg==='sze'){const sk=ST.sk.sze,km=kmCovers('sze'),d=DAYS.find(x=>x.id==='sze');return page('edzes',{title:'Edzés',sub:'Szerda · szept 23.',tab:'mai'},`${dstrip('sze')}
    ${hero({lbl:'Szerda · 07:30 · Gym',verdict:'Leg Day',big:true,sub:km?'Kímélő mód':sk?'Kihagyva':'Elmaradt — ez volt erre a napra tervezve.',
      body:`<div class="vs-h2"><span class="vs-hb off">${bodyLiq('back',d.mus.map(([k,s])=>[k,0,s/7]))}<small>ezt kérte volna a lábadtól</small></span><div class="vs-hf">${[['6','gyakorlat'],['18','szett'],['~70','perc']].map(([b,s])=>`<span><b>${b}</b><small>${s}</small></span>`).join('')}</div></div>`+(km?box('t-kimelo','Kímélő mód','<p>Magától kimaradt, nem számít mulasztásnak.</p>'):sk?skBlock('sze'):''),
      acts:km?'':sk?skActs('sze'):`<button class="btn" style="flex:1" data-go="indulas">Kezdjük el</button>`+vl('Kihagytam','skip:sze')},1)}
    ${card(`<p class="fh-note" style="margin:0">Az elmúlt 7 nap kimaradt alkalmaihoz utólag is megadhatod, miért maradtak ki.</p>`,{i:2})}`)}
  const vKm=kmCovers('volley'),vSk=!vKm&&ST.sk.volley,rKm=kmCovers('run'),rSk=!rKm&&ST.sk.run,rCb=!rKm&&!rSk&&ST.cb&&!ST.km;
  const E=ST.day==='done'?[190,vKm||vSk?0:460]:[0,vKm||vSk?190:650],ET=E[0]+E[1];
  const kmIn=`<div class="vs-in"><span>${bub('t-kimelo',{s:24})} Kímélő mód · magától kimarad, nem számít mulasztásnak.</span></div>`;
  const rc=readyCard();let n=0;
  return page('edzes',{title:'Edzés',sub:`${MESO.name} · ${MESO.week}. hét / ${MESO.of}`,tab:'mai'},`${dstrip()}
  ${thero()}
  ${rc?sec(++n,'Mielőtt elkezded',2)+rc:''}
  ${sec(++n,'Ma még',3)}
  ${card(ls(step({time:'18:00',icon:'t-volley',title:'Röpi edzés · BVSC',sub:`90 perc · feladó · BVSC csarnok ${st(vKm?'Kímélő mód':vSk?'Kihagyva':'Tervezett')}`}),
    vKm?kmIn:vSk?`<div class="vs-in col">${skBlock('volley')}<div>${skActs('volley')}</div></div>`:`<div class="vs-in">${lk('Logold a session-t',{sheet:'sportlog'})}${vl('Kihagyom','skip:volley')}</div>`,
    rCb?step({time:'holnap',icon:'t-run',title:'Sprint-intervallum',sub:`18:00 · <s>~30</s> ~15 perc · laza tempó ${st('Tervezett')}`})+`<div class="vs-in"><span>${bub('t-sprout',{s:24})} Visszatérő futás · első futás kihagyás után: kb. fele olyan hosszú, laza tempóban.</span></div>`
      :step({time:'tegnap',icon:'t-run',title:'Sprint-intervallum',sub:`18:00 · 6 kör · RPE 9–10 ${st(rKm?'Kímélő mód':rSk?'Kihagyva':'Elmaradt',rKm||rSk?'q':'bad')}`})
        +(rKm?kmIn:rSk?`<div class="vs-in col">${skBlock('run')}<div>${skActs('run')}</div></div>`:`<div class="vs-in">${lk('Pótlom',{sheet:'runlog'})}${vl('Kihagytam','skip:run')}</div>`)),{i:3})}
  ${sec(++n,'A mai keretedhez',4)}
  ${card(head('t-flame','Amit a mozgásod hozzáad')+`<p class="fh-big">+${E[0]}<small>kcal már a keretedben</small></p>${split(ET?E[0]/ET*100:0,ET?E[1]/ET*100:0,'var(--carb)')}
    <div class="vs-lg"><span><i class="a"></i><b>${E[0]} kcal</b> már a keretedben</span>${E[1]?`<span><i class="b"></i><b>+${E[1]} kcal</b> még jön, ha megcsinálod</span>`:''}</div>`
    +note(`${ST.day==='run'?'A folyamatban lévő edzés a befejezéskor kerül a keretedbe. ':''}Ugyanez a szám áll a Fuel keretében. Becslés, nem mérés.`),{i:4})}
  ${sec(++n,'Hatás az izomzatodra',5)}
  ${card(head('t-muscle','Mit terhel a mai mozgásod','Térkép','terkep')+musToday().map(([k,l,p,d])=>`<div class="fh-mus vs-mt">${mchp(k,'sm')}<span class="l">${l}<small>${WORD(p)}</small></span><span class="v">${d} / ${p} szett</span>${split(d/4*100,(p-d)/4*100,dk(k))}</div>`).join('')
    +note('A halvány folyadék a tervezett terhelés, a sötét a már megszolgált. Becslés, nem mérés.'),{i:5})}
  ${sec(++n,'Vagy inkább',6)}
  ${card(pair([['t-dumbbell','Egyedi edzés','data-sheet="custom"'],['t-volley','Sport naplózása','data-go="sportlog"']])+`
    <div class="vl" style="margin-top:14px">${rw({icon:'c-i-retegek',title:'Mezociklus',sub:`${MESO.name} · MAV · 3. hét / 6`,on:'run'})}${rw({icon:'c-i-sport',title:'Sportjaid és szezonod',sub:'BVSC · heti ritmus, napló',on:'sport'})}</div>`,{i:6})}`)}
function whySheet(){
  const k=ST.whyk,cur=ST.sk[k]||{cat:'NONE'},c=CATS.find(x=>x[0]===cur.cat),kmHere=ST.km&&ST.km.from===k&&c&&c[3];
  const nt=kmHere?box('t-kimelo','Kímélő mód bekapcsolva','<p>Amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.</p>')
    :!c?box('t-info','Nem kötelező','<p>Ha megmondod, miért, a terv és az edző ehhez igazodik.</p>')
    :c[3]?box('t-heart','Nem számít mulasztásnak.',`<p>${CARE[c[0]]}</p>`):passKey()===k?box('t-shield','Ezt a heti szabadjegyed fedezi','<p>A sorozatod marad.</p>'):box('t-info','Ez rendes kihagyásnak számít','<p>A heti szabadjegyet már felhasználtad. Semmi gond, jövő héten új jár.</p>');
  return `${sh(`Kihagyva · ${SKT[k]}`,'Miért marad ki?','Nem kötelező — segít, hogy a terv hozzád igazodjon.')}
  <div class="vs-opts">${CATS.map(([id,ic,l])=>`<button class="${cur.cat===id?'on':''}" data-ve="why:${id}">${bub(ic,{s:36})}<span>${l}</span></button>`).join('')}</div>
  ${cur.cat==='OTHER'?lab('Mi történt? · saját szavakkal')+`<div class="fh-in vs-fld ${cur.text?'':'ph'}"><span>${cur.text||'pl. családi program jött közbe'}</span>${bub('t-mic',{s:30})}</div>`:''}
  ${c&&c[3]?lab('Meddig tarthat?')+chips(KDUR,kmHere?ST.km.dur:-1,i=>`kmdur:${i}`):''}
  ${nt}
  ${acts(ve('Kész','whydone:1','',c?'style="flex:1"':'disabled style="flex:1;opacity:.45"'),vl('Most nem mondom','whydone:0'))}`}
const UDVX=[['1–2 nap',d=>`${d>=1&&d<=2?d:2} nap kiesés`,'a program megy tovább a naptár szerint.','Az első edzés könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.'],['kb. egy hét',()=>'3 nap kiesés','onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz (okt. 18. → okt. 25.).','Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.'],['több mint egy hét',()=>'11 nap kiesés','egy hetet visszalépünk: a 2. héttel folytatod, a program vége 2 héttel később lesz (okt. 18. → nov. 1.).','Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.']];
function udvSheet(){const [,h,l1,l2]=UDVX[ST.udv],two2=ST.udv>0;
  return `${sh('Kímélő mód vége','Üdv újra!','Így folytatjuk — a terv magától igazodik.')}
  ${lab('Próbáld ki · mennyi ideig tartott?')}${chips(UDVX.map(x=>x[0]),ST.udv,i=>`udvt:${i}`)}
  <div class="vs-ramp">${tubes([{l:'1. edzés',v:'⅔',s:'kb. −10% súly',p:60,t:'Első edzés: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly'},{l:'2. edzés',v:two2?'⅔':'teljes',s:two2?'a régi súly':'a terv szerint',p:two2?66:92,t:two2?'Második edzés: harmadával kevesebb sorozat, a régi súllyal':'A második edzés már a terv szerint megy'},{l:'utána',v:'teljes',s:'a terv szerint',p:92,t:'Utána a terv szerint'}],{h:104})}</div>
  <div class="vl" style="margin-top:14px">${rw({icon:'t-calendar',title:h(ST.km?ST.km.day-1:2),sub:l1})}${rw({icon:'t-dumbbell',title:'Könnyített kezdés',sub:l2})}${rw({icon:'t-run',title:'Rövidebb első futás',sub:'Az első futás kb. fele olyan hosszú, laza tempóban.'})}</div>
  ${acts(ve('Rendben','udv:1','','style="flex:1"'),vl('Mégsem vagyok jól','udv:0'))}`}

/* ── ELIGAZÍTÁS (teljes képernyő) ── */
const confPct=c=>c==='tanulom'?50:parseInt(c,10);
function indulas(){
  if(!ST.tick)ST.tick=CHAL.map(c=>c.pre); const on=ex=>CHAL.some((c,i)=>ST.tick[i]&&c.ex===ex),n=ST.tick.filter(Boolean).length;
  return page('edzes',{title:'Eligazítás',sub:'Pull Day · 3. hét / 6 · MAV',back:'mai'},`
  ${hero({lbl:'Várható idő',verdict:'70–85 perc, a saját tempód alapján.',
    body:`<div class="vs-range" aria-hidden="true"><span class="t"><i style="width:${70/90*100}%"></i><u style="left:${70/90*100}%;width:${15/90*100}%"></u></span><span class="ax"><em style="left:0">0</em><em style="left:33.3%">30</em><em style="left:66.6%">60</em><em style="left:77.8%" class="k">70</em><em style="left:94.4%" class="k">85 perc</em></span></div>`
      +facts([['5','gyakorlat'],['16','szett'],[String(n),'küldetés']])})}
  ${hero({warn:true,lbl:'Figyelj rá',verdict:'Jobb váll aktív',sub:'Óvatosan, először warm-up. A Rear Delt Fly ma könnyítve megy.',left:bub('t-bandage',{s:58,c:'var(--warn)'})},1)}
  ${sec(1,'Küldetések · mit vállalsz ma?',2)}
  ${card(ls(CHAL.map((c,i)=>rw({left:`<span class="vs-qc ${ST.tick[i]?'on':''}" style="--p:${confPct(c.conf)}%"><i></i>${I('i-check')}</span>`,title:c.ex,sub:`<span class="vs-qt">${bub(QICON[c.type]||'t-quest',{s:22})}${c.type}</span> <b>${c.target}</b><br>${c.conf==='tanulom'?'még tanulom, mennyire biztos':c.conf+' biztos'} · alacsony kockázat`,ve:`btick:${i}`,nochev:true,right:`<button class="fh-lk" data-toast="${esc(c.why).replace(/"/g,'&quot;')}">Miért?</button>`})))
    +note('A kapszula annyira telik meg, amennyire biztos a küldetés. Az előre bepipáltakat javaslom. Passzolni ér — és edzés közben is elengedheted bármelyiket.'),{i:2})}
  ${sec(2,'Ma itt lépünk előre',3)}
  ${card(ls(rw({icon:'t-up',title:'Túlterhelés · 2× +súly · 2× +rep',sub:'Ezeken a gyakorlatokon lépünk ma előre.'})),{i:3})}
  ${sec(3,'A mai sor · 16 szett vár megtöltésre',4)}
  ${card(ls(EX.map(e=>rw({m:e.k,title:e.n,sub:`${e.sets.length} szett · cél ${e.goal} · ${e.chg}${e.why?`<span class="vs-warn">${e.why}</span>`:''}`,right:`<span class="vs-rr">${on(e.n)?bub('t-quest',{s:26,c:'var(--carb)'}):''}${caps(e.sets.length,0,dk(e.k))}</span>`}))),{i:4})}`,
  {nonav:true,foot:ve(n?`Indulás · ${n} küldetéssel`:'Indulás küldetés nélkül','bstart','','style="flex:1"')})}

/* ── EDZÉS KÖZBEN (súly · ism · RIR → pihenő) ── */
const freshSets=e=>e.sets.map((s,j)=>{const w=isDone(s)?s[0]:s[1],r=isDone(s)?s[1]:s[2],ri=isDone(s)?s[2]:s[3];return j===0&&e===EX[0]?['cur',w,r,ri]:['up',w,r,ri]});
const exChal=n=>CHAL.map((c,i)=>i).filter(i=>CHAL[i].ex===n&&(CHAL[i].acc||CHAL[i].rel));
const curIdx=fresh=>fresh?0:Math.max(0,EX.findIndex(e=>e.sets.some(s=>s[0]==='cur')));
const VW={tick:'célsávban',record:'rekord',up:'cél fölött',down:'cél alatt'},VC={tick:'var(--ok)',record:'var(--carb)',up:'var(--ok)',down:'var(--warn)'};
function setRow(s,j,i){
  if(isDone(s))return `<span class="n f">${j+1}</span><span class="v d">${kg(s[0])}</span><span class="v d">${s[1]}</span><span class="v d">${s[2]}</span><button class="vd" data-sheet="set" data-arg="${i}.${j}" aria-label="Szett szerkesztése · ${VW[s[3]]}">${bub(VI[s[3]],{s:36,c:VC[s[3]]})}</button>`;
  if(s[0]==='cur')return `<span class="n h">${j+1}</span><input class="vin" inputmode="decimal" value="${kg(s[1])}" aria-label="Súly, kg"><input class="vin" inputmode="numeric" value="${s[2]}" aria-label="Ismétlés"><input class="vin" inputmode="numeric" value="${s[3]}" aria-label="RIR"><button class="tk" data-sheet="rp" data-arg="${i}" aria-label="Szett kész">${I('i-check')}</button>`;
  return `<span class="n">${j+1}</span><span class="v u">${kg(s[1])}</span><span class="v u">${s[2]}</span><span class="v u">${s[3]}</span><span></span>`}
/* a pihenő egy edény, ami kiürül — a valódi visszaszámlálás ereszti le */
const restFoot=()=>`<span class="vs-rest"><span class="vs-rv" aria-hidden="true"><i style="height:${ST.restLeft/ST.restTotal*100}%"></i></span><span class="g"><strong>${mmss(ST.restLeft)}</strong><small>pihenő · ${ST.restTotal} mp az ajánlott</small></span></span><button class="btn sm ghost" data-ve="plus15">+15</button><button class="btn sm" data-ve="reststop">Tovább</button>`;
function session(arg){const fresh=arg==='uj',d=fresh?0:DONE(),ci=curIdx(fresh),fi=ST.focus!=null&&EX[ST.focus]?ST.focus:ci,e=EX[fi],rows=fresh?freshSets(e):e.sets,dn=x=>fresh?0:x.sets.filter(isDone).length;
  const extra=[e.origin?[e.origin==='meso'?'t-peak':e.from?'t-swap':'t-addex',`${e.origin==='meso'?'Mezociklusban':'Csak ma'} · ${e.from?`a ${e.from} helyett`:'ma hozzáadva'}`]:null,e.note?['t-note',e.note]:null,e.cue?['t-info',e.cue]:null,e.why?['t-info',e.why]:null].filter(Boolean);
  const tg=e.to?`<div class="vs-tg"><span><small>Állapot</small><b>kész · lecserélve → ${e.to}</b></span></div>`
    :e.last?`<div class="vs-tg"><span><small>Múlt hét</small><b>${e.last}</b></span><span class="t"><small>Mai cél</small><b>${e.goal}</b>${e.chg?`<i>${e.chg}</i>`:''}</span></div>`
    :`<div class="vs-tg"><span><small>Első alkalom</small><b>a súlyt te adod meg, innentől jön a javaslat</b></span></div>`;
  const body=`<div class="vs-tools top"><button data-sheet="recs" data-arg="${fi}">${bub('t-journal',{s:26})}Rekordok</button>${e.to?'':`<button data-sheet="tech" data-arg="${fi}">${bub('t-book',{s:26})}Technika</button><button data-sheet="menu" data-arg="${fi}" aria-label="Gyakorlat menü">⋮ Műveletek</button>`}</div>
    ${tg}
    ${exChal(e.n).map(q=>`<button class="vs-ql" data-sheet="qb" data-arg="${q}">${bub('t-quest',{s:28,c:'var(--carb)'})}<span>${CHAL[q].acc?`${CHAL[q].type} · ${CHAL[q].target}`:`elengedve · <s>${CHAL[q].target}</s>`}</span>${chev()}</button>`).join('')}
    ${extra.map(([ic,x])=>`<p class="vs-xl">${bub(ic,{s:22})}<span>${x}</span></p>`).join('')}
    <div class="vs-sets" style="--c:${dk(e.k)}"><span class="h">#</span><span class="h">kg</span><span class="h">ism</span><span class="h">RIR</span><span></span>${rows.map((s,j)=>setRow(s,j,fi)).join('')}</div>`;
  return page('edzes',{title:'Pull Day',sub:`${d} / ${TOT()} szett kész${fresh?'':' · 31 perc'}`,back:'mai'},`
  <div class="vs-pv rise">${EX.map((x,i)=>`<button class="${i===fi?'on':''} ${dn(x)===x.sets.length?'full':''}" data-ve="focus:${i}" style="--c:${dk(x.k)};flex:${x.sets.length}" aria-label="${x.n} · ${dn(x)} / ${x.sets.length} szett"><span><i style="--pw:${dn(x)/x.sets.length*100}%"></i></span><small>${i+1}. · ${dn(x)}/${x.sets.length}</small></button>`).join('')}</div>
  ${hero({lbl:`${fi===ci?'Most':'Megnyitva'} · ${fi+1}. gyakorlat / ${EX.length} · ${muscleLabel(e.k)}`,verdict:e.n,left:mchp(e.k),body},1)}
  ${sec(1,'A mai sor',2)}
  ${card(ls(EX.map((x,i)=>i===fi?'':rw({m:x.k,title:x.n,sub:x.to?`kész · lecserélve → ${x.to}`:`${x.sets.length} szett · cél ${x.goal}${x.chg?' · '+x.chg:''}`,ve:`focus:${i}`,right:`<span class="vs-rr cl">${i===ci?st('Most','plan'):dn(x)===x.sets.length?st('Kész','ok'):''}${caps(x.sets.length,dn(x),dk(x.k),{cur:i===ci?dn(x):-1})}</span>`})))
    +note('Koppints egy gyakorlatra, és az kerül felülre a szettjeivel. Egy kapszula egy szett: a teli megvan.'),{i:2})}
  ${sec(2,'Közben és a végén',3)}
  ${card(pair([['t-addex','Gyakorlat hozzáadása','data-ve="pick:add"'],['t-star','Edzés befejezése','data-sheet="fin"']])+`
    ${acts(lk('Kalauz az edzéshez',{toast:'Kalauz az edzéshez'}))}
    ${note('A harmadik mező beírása után a pipa jön, a pihenő magától indul. A javaslat a múlt hetedből jön; felülírhatod.')}
    <div class="vs-leg">${Object.keys(VW).map(k=>`<span>${bub(VI[k],{s:24,c:VC[k]})}${VW[k]}</span>`).join('')}</div>${note('A kész sor végén az ítélet áll — koppintva szerkeszthető.')}`,{i:3})}`,
  ST.resting?{nonav:true,foot:restFoot()}:{nonav:true,pad:'60px'})}
function startRest(){ST.resting=true;ST.restLeft=ST.restTotal=90;clearInterval(ST.restT);ST.restT=setInterval(()=>{if(F.R!=='session'||F.D!=='edzes'){stopRest(true);return}ST.restLeft--;if(ST.restLeft<=0){stopRest();toast('Pihenő vége — jöhet a következő szett');return}const r=$('#phone .vs-rest');if(r){r.querySelector('strong').textContent=mmss(ST.restLeft);r.querySelector('.vs-rv i').style.height=`${ST.restLeft/ST.restTotal*100}%`}},1000);repaint()}
function stopRest(silent){ST.resting=false;clearInterval(ST.restT);if(!silent)repaint()}
function pickBody(){const Pk=ST.pick,sw=Pk.mode==='swap',o=EX[Pk.g],inS=new Set(EX.map(e=>e.n)),q=Pk.q.trim().toLowerCase();
  const r=i=>{const [n,k,t,last]=LIB[i];return rw({m:k,title:n,sub:`${muscleLabel(k)} · ${t==='compound'?'összetett':'izolált'}${last?` · múltkor ${last}`:' · még nem csináltad'}`,ve:`lib:${i}`})};
  const free=LIB.map((_,i)=>i).filter(i=>!inS.has(LIB[i][0]));
  const sim=sw?[...free.filter(i=>LIB[i][1]===o.k),...free.filter(i=>LIB[i][1]!==o.k&&regionOf(LIB[i][1])===regionOf(o.k))].slice(0,4):[];
  const all=free.filter(i=>(Pk.f==='all'||regionOf(LIB[i][1])===Pk.f)&&(!q||LIB[i][0].toLowerCase().includes(q)));
  return `${sim.length&&!q?lab(`Hasonló gyakorlatok · ${muscleLabel(o.k)}`)+ls(sim.map(r)):''}
  ${lab(q?'Találatok':'Összes gyakorlat')}<div class="fh-pills" style="margin-bottom:12px">${[['all','Mind'],...REGIONS.map(x=>[x.key,x.label])].map(([k,l])=>`<button class="fh-pill ${Pk.f===k?'on':''}" data-ve="pf:${k}">${l}</button>`).join('')}</div>
  ${all.length?ls(all.map(r)):note('Nincs ilyen nevű gyakorlat ebben a csoportban.')}`}
function applyPick(scope){const P=ST.pick,sw=P.mode==='swap',[n,k,t,last,kgv,rp]=LIB[P.lib],fresh=F.ARG==='uj';
  if(sw){const o=EX[P.g],d=fresh?0:o.sets.filter(isDone).length,rest=o.sets.slice(d),wasCur=rest.some(x=>x[0]==='cur');const sets=rest.map((x,j)=>[j===0&&wasCur?'cur':'up',kgv,rp,1]);
    const ne={n,k,last,goal:last?`${kg(kgv)} × ${rp}`:'—',chg:last?'ugyanaz':'',sets,origin:scope,from:o.origin==='ma'?o.from:o.n};
    if(d){o.sets=o.sets.slice(0,d);o.to=n;EX.splice(P.g+1,0,ne)}else EX.splice(P.g,1,ne);toast(scope==='meso'?`Csere kész — a mezociklus hátralévő heteiben is ${n}`:`Csere kész — csak ma ${n}`)}
  else{const c=t==='compound'?4:3;EX.push({n,k,last,goal:last?`${kg(kgv)} × ${rp}`:'—',chg:'',sets:Array.from({length:c},()=>['up',kgv,rp,1]),origin:scope});toast(scope==='meso'?`${n} felvéve a mezociklusba`:`${n} hozzáadva a mai edzéshez`)}
  closeSheet();repaint()}

/* ── ÖSSZEGZÉS (review) ── */
const LANE=[['Húzódzkodás (súlyozott)','back-wide','12,5 × 8',4,4,1],['Döntött törzsű evezés','back-mid','72,5 × 10',3,3,1],['Rear Delt Fly','shoulder-rear','10 × 12',3,3,0],['Kalapácsbicepsz','biceps-brachialis','16 × 13',3,2,0],['Vállemelés','traps','30 × 15',3,2,0]];
const SHORT={'back-wide':'Hát széles','back-mid':'Hát közép','shoulder-rear':'Hátsó váll','biceps-brachialis':'Kar','traps':'Trapéz'};
function review(arg){
  if(arg==='gyak')return page('edzes',{title:'Húzódzkodás (súlyozott)',sub:'Összegzés · Hát (széles) · Pull Day',back:'review'},`
    ${hero({lbl:'Top szett',verdict:'12,5 × 8 — 2,5 kg-mal több, mint legutóbb.',sub:'4 szett · előzőleg 10 × 8 volt a legnehezebb.',left:mchp('back-wide'),
      body:`<div class="vs-hg">${tubes([['12,5×8','RIR 2',8,'tick'],['12,5×8','RIR 1',8,'record'],['12,5×7','RIR 2',7,'down'],['12,5×8','RIR 2',8,'tick']].map(([a,r,rep,vd],i)=>({l:`${i+1}. szett`,v:a,s:`${r} · ${VW[vd]}`,p:rep/8*94,wl:94,c:vd==='down'?'var(--warn)':vd==='record'?'var(--carb)':dk('back-wide'),ic:VI[vd],t:`${i+1}. szett · ${a} · ${r} · ${VW[vd]}`})),{h:96,cls:'sm'})}</div>`+note('Egy edény egy szett: a vonal a cél (8 ismétlés), a folyadék, amennyi sikerült.')})}
    ${sec(1,'A számok',1)}
    ${card(`<div class="fh-facts" style="grid-template-columns:repeat(2,1fr)"><div><b>12,5×8</b><small>top szett</small></div><div><b>820</b><small>kg volumen</small></div></div><div class="fh-facts" style="grid-template-columns:repeat(2,1fr)"><div><b>1,8</b><small>Ø RIR</small></div><div><b>10×8</b><small>előzőleg</small></div></div>`+note('előzőleg 10 × 8 — a legnehezebb szett súlya +2,5 kg'),{i:1})}
    ${sec(2,'Medál',2)}
    ${card(ls(rw({left:rcap(80),title:'Súly-rekord · Húzódzkodás',sub:'előző: 10 kg · a vonal a régi rekord',v:'12,5 kg'})),{i:2})}
    ${sec(3,'Szettek',3)}
    ${card(ls([['12,5 kg × 8','RIR 2','célsávban','100 kg','','t-tick'],['12,5 kg × 8','RIR 1','rekord','100 kg','Az utolsó ismétlés kemény volt','t-record'],['12,5 kg × 7','RIR 2','cél alatt','87,5 kg','','t-down'],['12,5 kg × 8','RIR 2','célsávban','100 kg','','t-tick']].map(([a,r,t,vol,n,ic])=>rw({icon:ic,title:`${a} · ${r}`,sub:`${t}${n?` · „${n}”`:''}`,v:vol}))),{i:3})}`);
  return page('edzes',{title:'Összegzés',sub:'Lezárva · szept 24. · Pull Day',back:'mai'},`
  ${hero({lbl:'Kész · Pull Day',verdict:'14 szett a 16-ból, 4,2 tonna összvolumen.',sub:'5/5 gyakorlat · terv ~62, tény 71 perc',
    body:`<div class="vs-hg">${tubes(LANE.map(([n,k,t,of,d])=>({m:k,l:SHORT[k],v:`${d}/${of}`,s:d<of?`−${of-d} szett`:'megvan',p:d/of*92,wl:92,c:dk(k),on:'review.gyak'})),{h:104,cls:'sm',gap:6})}</div>`+note('Izmonként a mai szettek. A szaggatott vonal a múlt heti szint (szept 17.).'),
    acts:lk('‹ Előző Pull Day',{toast:'Előző Pull Day · szept 17.'})+`<span class="fh-note" style="margin:0;color:#fff">ez a legutóbbi</span>`})}
  ${sec(1,'Mihez képest · szept 17., 1 hete',1)}
  ${card(ls(rw({icon:'t-weight',title:'Volumen',sub:`előző 3,9 t<span class="vs-rowbar">${wlv(96,'var(--dom)',[[89]],12)}</span>`,v:'4,2 t <small>+0,3</small>'}),rw({icon:'t-up',title:'Top szett',sub:`előző 10 × 8<span class="vs-rowbar">${wlv(96,'var(--dom)',[[77]],12)}</span>`,v:'12,5 × 8'}),rw({icon:'t-hold',title:'Ø RIR',sub:`előző 2,0 · kevesebb tartalék maradt<span class="vs-rowbar">${wlv(64,'var(--dom)',[[80]],12)}</span>`,v:'1,6'}))+note('A vonal a múlt heti érték, a folyadék a mai.')
    +facts([['4,2 t','volumen'],['3','rekord'],['9','célszett']])
    +note('A javulás itt a trend, nem egy nap: a legnehezebb szett súlya három hete emelkedik.'),{i:1})}
  ${sec(2,'Medálok · 3 rekord · 9 célszett',2)}
  ${card(ls([['Súly-rekord','Húzódzkodás (súlyozott)','12,5 kg','előző: 10 kg',80],['Rep-rekord','Döntött törzsű evezés','10 @ 72,5','előző: 9 @ 72,5',90],['Volumen-rekord','Döntött törzsű evezés','2 175 kg','előző: 2 070 kg',95]].map(([t,n,v,p,w])=>rw({left:rcap(w),title:n,sub:`${t} · ${p}`,v})),
    rw({left:rcap(null,'var(--ok)'),title:'9 célszett teljesítve',sub:'Húzódzkodás ×3 · Evezés ×3 · Vállemelés ×3'}))+note('A vonal a kapszulán a régi rekord: a folyadék fölötte áll.'),{i:2})}
  ${sec(3,'Küldetések · 1 megvan · 1 kimaradt',3)}
  ${card(ls(rw({icon:'t-tick',title:'Húzódzkodás: 12,5 × 8 az első szetten',sub:'megcsináltad',right:st('megvan','ok')}),rw({icon:'t-skip',title:'Kalapácsbicepsz: az utolsó szett RIR 0-ig',sub:'nem jött össze — a riport nem büntet',right:st('kimaradt','q')})),{i:3})}
  ${sec(4,'Gyakorlatonként',4)}
  ${card(ls(LANE.map(([n,k,t,of,d,rec],i)=>rw({m:k,title:n,sub:`top szett <b>${t}</b>${rec?' · rekord':''}${i===0?' · 1 jegyzet':''}`,right:`<span class="vs-rr cl">${rec?st('Rekord','warn'):''}${caps(of,d,dk(k))}</span>`,on:'review.gyak'})))
    +note('A riport sosem büntet: a kimaradt szett üres kapszula, a kihagyott küldetés halk — piros nincs.'),{i:4})}
  ${sec(5,'Amit aznap írtál',5)}
  ${card(txt('Ma a váll végig nyugton volt, a sorok tiszták. A Kalapácsbicepsznél az utolsó szett elmaradt — elfogyott az idő.')+acts(lk('Szerkesztés',{sheet:'wnote'})),{i:5})}`)}

/* ── LEZÁRÓ CEREMÓNIA (a minta marad: csillagok, számláló, egyszeri koreográfia; a szint egy kehely, ami megtelik, a rekord kicsordul) ── */
const CUP='M24 14 H176 V62 C176 100 144 122 100 122 C56 122 24 100 24 62Z';
const cstars=()=>`<div class="vs-cstars" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i data-star="${i}">${T('t-star-empty','off')}${T('t-star-half','half')}${T('t-star','on')}</i>`).join('')}</div>
  <div class="vs-cup" aria-hidden="true"><svg viewBox="0 0 200 132"><defs><clipPath id="cercup"><path d="${CUP}"/></clipPath><linearGradient id="cerg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F9D06A"/><stop offset="1" stop-color="#E9892B"/></linearGradient></defs>
    <path d="${CUP}" fill="#fff" stroke="rgba(10,42,60,.12)" stroke-width="2.5"/><g clip-path="url(#cercup)"><g class="lq"><path class="wvp" fill="url(#cerg)" d="${wv(-120,14,440,11,5)} V140 H-120Z"/></g></g>
    ${[.2,.4,.6,.8].map(p=>`<path d="M158 ${14+108*(1-p)}h12" stroke="rgba(10,42,60,.28)" stroke-width="2" stroke-linecap="round"/>`).join('')}<path d="M40 26 V58" stroke="rgba(255,255,255,.8)" stroke-width="6" stroke-linecap="round"/></svg>
    <i class="sp s1"></i><i class="sp s2"></i><i class="sp s3"></i><i class="sp s4"></i><i class="sp s5"></i></div>`;
function kcalBowl(base,add){const id=uid('bw'),B='M8 38 H92 C92 66 74 88 50 88 C26 88 8 66 8 38Z',Y=p=>88-p*.5;
  return `<svg class="fl-fill vs-bowl" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}"><path d="${B}"/></clipPath></defs><path d="${B}" fill="#fff" stroke="rgba(10,42,60,.12)" stroke-width="1.8"/><g clip-path="url(#${id})"><path d="${wv(-10,Y(base+add),120,4,2.5)} V100 H-10Z" fill="var(--carb)"/><path d="${wv(-10,Y(base),120,4,2.5)} V100 H-10Z" fill="color-mix(in srgb,#149E6E 50%,#fff)"/></g><path d="M32 95 H68" stroke="rgba(10,42,60,.16)" stroke-width="4" stroke-linecap="round"/></svg>`}
function cer(arg){
  if(arg==='reszletek')return page('edzes',{title:'Részletek',sub:'Edzés lezárva · Erős nap.',back:'cer'},`
    ${hero({lbl:'A mai mozgással',verdict:`+${hu(CER.kcal)} kcal került a mai keretedbe.`,sub:'Ennyit nyertél a mai mozgással · becslés, nem mérés.',left:kcalBowl(78,14),body:`<div class="vs-lg"><span><i class="g"></i><b>3 100 kcal</b> a napi kereted</span><span><i class="a"></i><b>+${hu(CER.kcal)} kcal</b> a mai edzés</span></div><div class="vs-ms">${stars5(CER.ratio)}<span>Erős nap.</span></div>`,acts:lk('Megnézem a Fuelben',{toast:'Fuel · Mai (a mozgás hozzáadja a keretedhez)'})})}
    ${sec(1,'A mai edzésen · izomcsoportok',1)}
    ${card(tubes(CER.mus.map(([k,l,d,p])=>({m:k,l:SHORT[k]||l,v:`${d}/${p}`,p:d/p*94,wl:94,c:dk(k),s:d<p?'részben':'tele',t:`${l} · ${d} / ${p} szett`})),{h:100,cls:'sm',gap:6})
      +CER.mus.map(([k,l,d,p])=>`<div class="fh-mus vs-mt">${mchp(k,'sm')}<span class="l">${l}</span>${stars5(d/p)}<span class="v">${d} / ${p} szett</span></div>`).join('')
      +note('A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.'),{i:1})}
    ${sec(2,'Hogy ment?',2)}
    ${card(`<div class="fh-in vs-fld ph" data-toast="Jegyzet írása"><span>Pl. rosszul aludtam, de a húzódzkodás jól ment…</span>${bub('t-mic',{s:30})}</div>`+note('Nem kötelező — később is hozzáírhatod.'),{i:2})}`,
    {nonav:true,foot:`<div class="vs-fcol">${ve('Vissza a mai napra · lezárva és elmentve','cerdone')}${lk('Vissza az értékeléshez','cer')}</div>`,pad:'200px'});
  return page('edzes',{title:'Edzés lezárva',sub:'Pull Day · szept 24.',back:'mai'},`<div id="cerroot">
  <section class="fh-card fh-hero vs-cer" id="cerstage" style="--p:0"><span class="lbl">Így sikerült · 4,5 csillag az ötből</span>${cstars()}<p class="verdict vs-cres">Erős nap.</p><p class="sub vs-cres">A kehely a tervedhez mérve telt meg — ami kicsordult, az új rekord.</p></section>
  <div class="vs-cres">${sec(1,`Ez a tiéd mostantól · ${CER.rec.length} új rekord`)}
    ${card(ls(CER.rec.map(([n,k,ch],i)=>rw({left:rcap([80,90][i]),title:n,sub:`<span class="vs-qt">${bub(KIND_IC[k],{s:22,c:'var(--carb)'})}${k}</span>`,v:`${ch[0]} <small>${ch[1]}</small>`}))),{cls:'vs-gold'})}</div>
  <div class="vs-ccard">${sec(2,'A mai számok')}
    ${card(facts([[`${CER.min}′`,'a pulton töltött idő'],[`+${CER.xp}`,'szerzett XP'],[`+${CER.kcal}`,'kcal · becslés']])+`<div class="fh-facts" style="grid-template-columns:repeat(3,1fr)"><div><b data-c="sets">0</b><small>szett</small></div><div><b data-c="reps">0</b><small>ismétlés</small></div><div><b data-c="vol">0</b><small>kg × ism</small></div></div>`)}
    ${sec(3,'Küldetések · 1 / 2')}
    ${card(ls(CER.chal.map(([ok,t,ex,ch])=>rw({left:`<span class="vs-qc ${ok?'on':''}" style="--p:100%"><i></i>${I('i-check')}</span>`,title:ex,sub:`${t} · ${ch.join(' · ')}`,right:st(ok?'teljesült':'nem jött össze',ok?'ok':'q')})))+note('2 szett kihagyott státusszal zárult.'))}</div></div>`,
  {nonav:true,foot:`<button class="btn" style="flex:1" data-go="cer.reszletek">Részletek · izmok és a nyert kalória</button>`})}
function runCer(){const root=$('#cerroot'),stage=$('#cerstage');if(!root)return;
  const D=2700,S=1700,B={b1:1750,b2:2050,b3:2350},ease=t=>1-(1-t)**3,instant=document.body.classList.contains('still')||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint=ms=>{const p=ease(Math.min(1,ms/S))*CER.ratio;stage.style.setProperty('--p',p);stage.querySelectorAll('[data-star]').forEach(st=>{const c=starCls(+st.dataset.star,p);st.classList.toggle('is-lit',c==='is-lit');st.classList.toggle('is-half',c==='is-half')});
    const t=ease(Math.max(0,Math.min(1,(ms-B.b2)/(D-B.b2))));root.querySelectorAll('[data-c]').forEach(el=>{const v={sets:CER.sets,reps:CER.reps,vol:CER.vol}[el.dataset.c]*t;el.textContent=el.dataset.c==='vol'?hu(v):Math.round(v)});
    for(const k of ['b1','b2','b3'])root.classList.toggle(k,ms>=B[k])};
  if(instant){paint(D);return}
  const t0=performance.now();const f=now=>{const ms=Math.min(D,now-t0);paint(ms);if(ms<D&&stage.isConnected)requestAnimationFrame(f)};requestAnimationFrame(f)}

/* ── TERHELÉS · GYM (a régi Gym-nézet, a Terhelés alól nyílik) ── */
function gym(){
  const hb=[['back-wide',.95],['back-mid',.9],['traps',.7],['shoulder-rear',.75],['triceps-long',.5],['ham',.25],['glute',.2],['calf',.15]],hf=[['chest-mid',.7],['chest-upper',.6],['shoulder-front',.65],['shoulder-side',.6],['biceps-long',.55],['quad',.25],['core',.12]];
  return page('edzes',{title:'Gym · heti munka',sub:'Terhelés · 3. hét · MAV',back:'terheles'},`
  ${hero({lbl:'62% megvan · 58 szett a 94-ből',verdict:'3 izomcsoport még munkára vár ezen a héten.',
    body:`<div class="vs-hg">${tubes(GR.map(([k,l,d,p,w,much],i)=>({m:k,l,v:`${d}/${p}`,p:d/p*88,wl:88,over:!!much,s:much?'sok':'',c:dk(k),on:{sheet:'grp',arg:String(i)}})),{h:104,cls:'sm',gap:6})}</div>`+note('A vonal a heti terv. A hát túlcsordult: többet kapott, mint amennyit a terv kért.'),
    acts:btn('A tested térképe','terkep','sm')+lk('Miből áll össze?',{sheet:'info'})+lk('3. hét / 6','run')+lk('14 medál','medals')})}
  ${sec(1,'A tested térképe',1)}
  ${card(`<button class="vs-mapc" data-go="terkep">${duo([...hf,...hb].map(([k,a])=>[k,a,0]),'sm')}<span class="g"><strong>Elöl és hátul, ami már dolgozott</strong><small>a hét terhelése izmonként — minél teltebb, annál több</small></span>${chev()}</button>`,{i:1})}
  ${sec(2,'Izomcsoportok · ezen a héten',2)}
  ${card(ls(GR.map(([k,l,d,p,w,much],i)=>rw({m:k,title:`${l}${much?' <b style="color:var(--warn)">· sok</b>':''}`,sub:w+`<span class="vs-rowbar">${wlv(clamp(d/p*100/1.15,d?3:0,100),dk(k),[[100/1.15,'terv']])}</span>`,v:`${d} / ${p}`,on:{sheet:'grp',arg:String(i)},nochev:true})))
    +note('A szám a heti tervből jön: a mesociklus hétre bontott szettjei. A sport és a futás külön sávon látszik, a szettekbe nem számít bele.'),{i:2})}
  ${sec(3,'Sport a héten · 4 röpi · 6,5 óra',3)}
  ${card(ls(rw({m:'shoulder-front',title:'Váll · ütések, nyitások',v:'erős',right:drops(3,3,dk('shoulder-front'))}),rw({m:'calf',title:'Vádli · ugrások',v:'közepes',right:drops(2,3,dk('calf'))}),rw({m:'core',title:'Core',v:'enyhe',right:drops(1,3,dk('core'))}))+note('Becslés — a szettszámokba nem számít bele.'),{i:3})}
  ${sec(4,'Minden mozgásod a héten',4)}
  ${card(ls(rw({icon:'t-dumbbell',title:'Gym · 3 edzés',v:'58 <small>szett</small>'}),rw({icon:'t-volley',title:'Röpi · 4 session',v:'6,5 <small>ó</small>'}),rw({icon:'t-run',title:'Futás · 1 edzés',v:'6 <small>kör</small>'}))
    +acts(lk('+ Saját edzés',{sheet:'custom'})),{i:4})}`)}

/* ── SPORT ── */
function sport(tab='terv'){
  const WK=[['H'],['K','18:00 · 90p','Röpi edzés','BVSC csarnok','',90,1],['Sze'],['Cs','18:00 · 90p','Röpi edzés','BVSC csarnok','ma',90],['P'],['Szo','10:00 · 120p','Meccs · Kőbánya','Kőbánya Sport','egyszeri',120],['V']];
  const B={terv:()=>`${sec(1,'Heti ritmus · 7,5 ó',2)}
    ${card(ls(WK.map(([d,t,n,loc,tg])=>t?rw({left:num(d),title:`${n}${tg?` ${st(tg,tg==='ma'?'plan':'q')}`:''}`,sub:`${t} · ${loc}`,right:lk('Logold',{sheet:'sportlog'})}):rw({cls:'muted',left:num(d),title:'nincs session'})))
      +acts(lk('Szerkesztés',{toast:'Heti rend szerkesztése'})),{i:2})}
    ${sec(2,'Események · tavasz · 2026',3)}
    ${card(ls(rw({icon:'t-calendar',title:'Meccs · BVSC – Kőbánya',sub:'szept 27. · 120 perc · Kőbánya Sport',right:lk('törlés',{toast:'Esemény törölve'})}),rw({icon:'t-calendar',title:'Edzőtábor · plusz edzés',sub:'okt 4. · 90 perc · BVSC csarnok',right:lk('törlés',{toast:'Esemény törölve'})}))
      +acts(lk('+ Esemény hozzáadása',{toast:'Új esemény'}))+note('A heti ritmus független a mezociklustól — a sport a saját rendjén fut.'),{i:3})}`,
    naplo:()=>`${sec(1,'Napló · utolsó 4 session · átlag 38 ugrás',2)}
    ${card([['Edzés','szept 23. · 18:00','90p',5,'6,8',72,6,'Smashek tisztábbak, a nyitás még ingadozik.'],['Meccs','szept 20. · 10:00','120p',4,'8,1',86,7,''],['Edzés','szept 18. · 18:00','90p',5,'6,5',64,5,'Könnyebb nap, sok technika.']].map(([t,d,m,s,r,int,v,q])=>`<div class="vs-log">${rw({icon:'t-volley',title:`Röpi · ${t}`,sub:`${d} · idő ${m} · ${s} szett`,v:`${r} <small>RPE</small>`})}
      <div class="vs-l2"><span>Intenzitás</span>${level(int,{c:'var(--dom)',h:16,val:String(Math.round(int/10))})}<span>Váll-terhelés</span>${level(v*10,{c:dk('shoulder-front'),h:16,val:String(v)})}</div>${q?`<p class="vs-xl q">„${q}”</p>`:''}</div>`).join('')
      +note('A heti ritmus független a mezociklustól — a sport a saját rendjén fut.'),{i:2})}`,
    cross:()=>`${sec(1,'Keresztrendszer hatások',2)}
    ${card(msg('mezo','A röpi és a gym egy héten: két dolgot igazítok, hogy ne üssék egymást.','keresztrendszer hatások')
      +`<div class="vs-hg">${linked(65,65,{a:'Röpi · váll',b:'Pull Day · plafon',s:240})}</div>`+note('Közlekedőedények: amennyit a röpi kivesz a válladból, annyival lejjebb kerül a plafon a csütörtöki Pull Day-en.')
      +`<div class="vl" style="margin-top:12px">${rw({icon:'t-shield',title:'Váll-plafon a csütörtöki Pull Day-en',sub:'A röpi előtti napon a Rear Delt Fly RIR 2 alatt nem megy.'})}${rw({icon:'t-clock',title:'Időzítés',sub:'A szombati meccs előtt a láb-nap péntekről csütörtökre csúszhat.'})}</div>`
      +note('A cross-load sosem büntet — plafont igazít és időzítést ajánl, döntést nem vesz el.'),{i:2})}`}[tab]||(()=>'');
  return page('edzes',{title:'Sport',sub:'BVSC · Felnőtt II.',back:'mai'},`
  ${hero({lbl:'Röplabda · ezen a héten',verdict:'4 session megvolt az 5-ből.',
    body:`<div class="vs-hg">${tubes(WK.map(([d,t,n,loc,tg,min,done])=>min?{l:d,v:`${min}′`,p:done?min/120*94:tg==='ma'?0:0,wl:done?null:min/120*94,ghost:!done,now:tg==='ma',ic:'t-volley',mark:t.split(' · ')[0],c:'var(--dom)',on:{sheet:'sportlog'}}:{l:d,v:'–',p:0,hatch:true,mark:'',t:`${d} · nincs session`}),{h:92,cls:'wk',gap:6})}</div>`+facts([['6,5 ó','pályán e héten'],['7,1','RPE átlag · 1–10'],['6,5','váll-terhelés']]),acts:btn('+ Log','sportlog')})}
  ${segw([['Heti terv','sport.terv',tab==='terv'],['Napló','sport.naplo',tab==='naplo'],['Cross-load','sport.cross',tab==='cross']])}${B()}`)}
function sportlog(arg){
  if(!arg)return page('edzes',{title:'Naplózás',sub:'Sport · ma',back:'mai'},`
    ${hero({lbl:'Első lépés',verdict:'Mi volt ma mozgás?',sub:'Válaszd ki, mit csináltál. A következő lapon csak azt kérdezem, ami annál a sportnál tényleg számít.'})}
    ${sec(1,'Válassz sportot',1)}
    ${card(`<div class="vs-spg">${SPORTS.map(([ic,l],i)=>`<button data-go="sportlog.${i}">${bub(ic,{s:52,c:ic==='t-run'?'#1877F2':'var(--dom)'})}<span>${l}</span></button>`).join('')}</div>`,{i:1})}`,{nonav:true,pad:'60px'});
  const [ic,l]=SPORTS[+arg]||SPORTS[0];
  return page('edzes',{title:l,sub:'Naplózás · ma',back:'sportlog'},`
  ${hero({lbl:'Második lépés',verdict:'Hogy ment?',sub:'Csak az, ami ennél a sportnál számít.',left:bub(ic,{s:64}),body:`<div style="margin-top:14px">${seg([['Edzés',{toast:'Edzés mód'},true],['Meccs',{toast:'Meccs mód'},false]])}</div>`})}
  ${sec(1,'Idő és terhelés',1)}
  ${card(ls(stp('Időtartam · perc',90))+blk('Megélt terhelés (RPE)',scale(7))+blk('Vállterhelés',chips(['kicsi','közepes','nagy'],1))+`<div class="vl" style="margin-top:14px">${stp('Játszott szettek',5)}</div>`,{i:1})}
  ${sec(2,'Kalória',2)}
  ${card(ls(rw({icon:'t-plate',title:'Kalória: becslést mentünk',sub:'~620 kcal · a súlyod és az időtartam alapján',right:lk('Saját érték',{toast:'Saját érték'})})),{i:2})}`,
  {nonav:true,foot:ve('Naplózom · 90 perc','sportsave','','style="flex:1"')})}

/* ── FUTÁS ── */
/* ivl: egy intervall-edzés mint egy cső, amiben a szint az iramot követi — [mp, szint 0..1, fajta] */
const ivl=segs=>`<span class="vs-ivl" aria-hidden="true">${segs.map(([s,h,k])=>`<i class="${k}" style="flex:${s};--h:${h*100}%"></i>`).join('')}</span>`;
const IV_SPRINT=[[60,.4,'w'],...Array.from({length:6},()=>[[15,1,'s'],[45,.18,'r']]).flat(),[60,.3,'w']];
const IV_PYR=[[60,.4,'w'],...[15,30,45,30,15].flatMap(s=>[[s,1,'s'],[s*2,.18,'r']]),[60,.3,'w']];
function futas(tab='het'){
  const B={het:()=>`${sec(1,'E heti edzés · 1 / 2 kész',2)}
    ${card([['Sprint-intervallum','kedd · 18:00',1,['5p bemelegítés','6× · 15 mp','45 mp séta','5p levezetés'],IV_SPRINT],['Piramis-intervallum','péntek · 17:30',0,['5p bemelegítés','15–30–45–30–15 mp','pihenő = szakasz × 2','5p levezetés'],IV_PYR]].map(([n,d,ok,sg,iv])=>`<div class="vs-log">${rw({icon:'t-run',title:n,sub:d,right:ok?st('Kész','ok'):lk('Naplózd',{sheet:'runlog'})})}${ivl(iv)}${tags(sg)}</div>`).join('')
      +note('A cső szintje az iram: magas a sprint, alacsony a séta, a két vége a bemelegítés és a levezetés.'),{i:2})}
    ${sec(2,'Keresztterhelés · futás és röpi egy héten',3)}
    ${card(ls(rw({icon:'t-clock',title:'A pénteki piramis',sub:'a szombati meccs előtt könnyített változatban fut.'})),{i:3})}`,
    naplo:()=>`${sec(1,'Pulzus-megnyugvás · utolsó 6 futás',2)}
    ${card(`<p class="fh-big">−16<small>mp az első óta</small></p><p class="fh-txt vs-sub">A trend lefelé tart — és itt a lefelé a jó.</p>${areaM([58,54,51,49,46,42],{h:120,labels:['szept 2.','szept 9.','szept 16.','szept 23.'],c:'#19C7C0',c2:'#1877F2',min:36,max:60},[[5,'42 mp','now']])}`+note('Mp a nyugalmi pulzusig — alacsonyabb = jobb regeneráció. A felszín a hat futásod.'),{i:2})}
    ${sec(2,'Napló · utolsó 3 futás',3)}
    ${card(ls([['szept 23.','Sprint',9,6,42],['szept 19.','Piramis',8,5,46],['szept 16.','Sprint',9,6,49]].map(([d,t,r,k,h])=>rw({icon:'t-run',title:`${t}-intervallum`,sub:`${d} · RPE ${r} · ${k} kör`,v:`${h} <small>mp pulzus</small>`,right:lv(h/60*100,'#1877F2')}))),{i:3})}`,
    tervek:()=>`${sec(1,'Aktív · 1',2)}${card(ls(rw({icon:'t-run',title:'Robbanékonyság 01',sub:`szept 8. – nov 2. · 8 hét · 2× / hét<span class="vs-rowbar">${caps(8,2,'var(--dom)',{cur:2,cls:'wide'})}</span>`,on:'futasterv'})),{i:2})}
    ${sec(2,'Tervezett · 1',3)}${card(ls(rw({icon:'t-calendar',title:'5K-alapozó',sub:`nov 9.-től · 6 hét<span class="vs-rowbar">${caps(6,0,'var(--dom)',{cls:'wide'})}</span>`,on:'futasterv'})),{i:3})}
    ${sec(3,'Archív · 1',4)}${card(ls(rw({icon:'t-history',title:'Téli base 02',sub:`jan–márc<span class="vs-rowbar">${caps(8,8,'var(--faint)',{cls:'wide'})}</span>`,on:'futasterv'}))+note('Egy kapszula egy hét.'),{i:4})}`}[tab]||(()=>'');
  return page('edzes',{title:'Futás',sub:'Robbanékonyság 01 · sprint-állóképesség röpihez',back:'terv'},`
  ${hero({lbl:'Építő fázis · 2× / hét',verdict:'A 8 hetes blokk 3. hetében jársz.',sub:'E héten 1 / 2 edzés kész.',
    body:`<div class="vs-hg">${tubes(Array.from({length:8},(_,i)=>({l:`${i+1}.`,p:i<2?94:i===2?47:0,wl:i>2?94:null,ghost:i>2,now:i===2,v:i<2?'2/2':i===2?'1/2':'',c:'var(--dom)',t:`${i+1}. hét${i<2?' · 2 / 2 edzés':i===2?' · 1 / 2 edzés':' · még hátravan'}`})),{h:70,cls:'wk',gap:5})}</div>`+facts([['1/2','e heti edzés'],['2×','/ hét'],['8 hét','blokk']]),
    acts:tab==='tervek'?btn('+ Új terv','futasterv'):btn('Naplózd a futást',{sheet:'runlog'})})}
  ${segw([['E heti edzés','futas.het',tab==='het'],['Napló','futas.naplo',tab==='naplo'],['Tervek','futas.tervek',tab==='tervek']])}${B()}`)}
function futasterv(){
  return page('edzes',{title:'Robbanékonyság 01',sub:'Futóterv · aktív · 3. hét / 8',back:'futas.tervek'},`
  ${hero({lbl:'Futóterv',verdict:'Aktív terv, a 3. hétnél tart.',sub:`Minden változás mentve.`,left:bub('t-run',{s:60}),body:`<div class="vs-hg">${ivl(IV_SPRINT)}</div>`+note('Egy hét edzése: 5 perc bemelegítés, 6 × 15 mp sprint 45 mp sétával, 5 perc levezetés.'),acts:btn('Lezárás',{toast:'Lezárás'})+lk('⋯ Több',{sheet:'blkmenu'})})}
  ${sec(1,'Alapadatok',1)}
  ${card(`<span class="fh-lab" style="margin-top:0">Terv neve</span>`+fld('Robbanékonyság 01')+lab('Cél (pl. sprint-állóképesség)')+fld('sprint-állóképesség röpihez')+`<div class="vl" style="margin-top:14px">${stp('Hetek · 1–8',8)}</div>`,{i:1})}
  ${sec(2,'Hetek',2)}
  ${card([1,2,3].map(w=>`<div class="vs-log">${rw({left:num(w+'.'),title:`${w}. hét`,sub:'6 kör · 45 mp pihenő'})}${ivl(IV_SPRINT)}<div class="fh-chips">${['5p bemelegítés','6× · 15 mp','5p levezetés'].map(s=>`<span class="tx">${s} <button data-toast="${s} — szakasz törölve" aria-label="${s} törlése">×</button></span>`).join('')}<span class="tx add"><button data-toast="Szakasz hozzáadása" aria-label="Szakasz hozzáadása">＋ szakasz</button></span></div></div>`).join(''),{i:2})}`)}

/* ── MEDÁLOK · GYAKORLATOK ── */
function medals(arg){
  if(arg==='ures')return page('edzes',{title:'Medálok',sub:'Gyakorlatok',back:'exercises'},`${hero({lbl:'Medálok',verdict:'Még nincs medálod.',sub:'Az első megdöntött rekord ide kerül.',body:emptyTank('t-record','Itt gyűlnek majd a rekordjaid, dátum szerint.')})}`);
  const G=[['Szept 24.',[['r','Húzódzkodás (súlyozott)','Súly-rekord','12,5 kg','előző: 10 kg · szept 17. óta állt',80],['r','Döntött törzsű evezés','Rep-rekord','10 @ 72,5','előző: 9 · szept 10. óta állt',90],['c','Vállemelés','Cél teljesítve','30 × 15','3 célszett']]],['Szept 17.',[['r','Döntött törzsű evezés','1RM-rekord','96,7 kg','előző: 94,0 kg · szept 3. óta állt',97],['r','Kalapácsbicepsz','Súly-rekord','16 kg','előző: 14 kg · jún 22. óta állt',87]]]];
  return page('edzes',{title:'Medálok',sub:'Gyakorlatok',back:'exercises'},`
  ${hero({lbl:'Medálok',verdict:'14 medál, ebből 5 e hónapban.',sub:'A medálok visszamenőleg, a korábban logolt szetteid alapján épültek fel — nem mindegyiket élőben szerezted.',
    body:`<div class="vs-shelf" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i class="${i>=9?'new':''}"></i>`).join('')}</div><div class="vs-lg"><span><i class="a"></i><b>5</b> e hónapban</span><span><i class="g2"></i><b>9</b> korábbról</span></div>`})}
  ${G.map(([d,rows],gi)=>sec(gi+1,d,gi+1)+card(ls(rows.map(([t,n,l,v,p,w])=>rw({left:t==='c'?rcap(null,'var(--ok)'):rcap(w),title:n,sub:`${l} · ${p}`,v,right:st(t==='c'?'cél':'rekord',t==='c'?'ok':'warn')})))+(gi?'':note('A kapszulán a vonal a régi rekord — a folyadék fölötte áll. A zöld kapszula teljesített cél.')),{i:gi+1})).join('')}`)}
const RMX=155;
function exercises(){
  return page('edzes',{title:'Gyakorlatok',sub:'A mozdulataid',tab:'exercises'},`
  ${hero({lbl:'A mozdulataid',verdict:'42 gyakorlat, 18 rekorddal.',sub:'Minden gyakorlat egy helyen — a rekordjaiddal, a technikával és a múltjával.',left:fill(SH_KETTLE,{p:43,s:84,inner:'<path d="M40 30 C40 21 60 21 60 30Z" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="1.6"/>'}),acts:btn('14 medál','medals')+lk('+ Új gyakorlat',{toast:'Új gyakorlat lap'})})}
  ${sec(1,'Keresés és szűrés',1)}
  ${card(`<div class="fh-in vs-fld ph" data-toast="Keresés">Keresés névre vagy izomra…</div><div style="margin-top:12px">${chips(['Mind','Mell','Hát','Váll','Kar','Láb','Core'],0)}</div>`,{i:1})}
  ${sec(2,'Lista · a szint a becsült 1RM',2)}
  ${card(ls(GY.map(([n,k,rm,m])=>rw({m:k,title:n,sub:`${muscleLabel(k)}${rm?(m?` · ${m} medál`:''):' · még nincs naplózva'}${rm?`<span class="vs-rowbar">${lv(rm/RMX*100,dk(k),10)}</span>`:''}`,v:rm?`${rm} kg <small>1RM</small>`:null,on:'exercise'})))+note('A kettlebell a főkártyán annyira van tele, ahány gyakorlatodnak már van rekordja: 18 a 42-ből.'),{i:2})}`)}
function exercise(){
  const sim=LIB.filter(x=>x[1]==='back-mid').slice(0,3),c=dk('back-mid');
  return page('edzes',{title:'Döntött törzsű evezés',sub:'Hát (közép) · saját',back:'exercises'},`
  ${hero({lbl:'Következő cél',verdict:'77,5 kg × 8 — a legjobb szetted, most RIR 2-vel.',sub:'24 alkalom · márc 4. óta · 12,4 t összsúly',left:mchp('back-mid'),
    body:`<div class="vs-hg ar">${areaM([80,83,86,84,89,92,94,96.7],{h:140,labels:['márc','máj','júl','szept'],target:99,min:76,max:101,c:muscleColor('back-mid'),c2:c},[[4,'89','pr'],[6,'94','pr'],[7,'96,7','now']])}</div>`+note('Az erőd íve: becsült 1RM, márc → szept. A cseppek a rekordok, a szaggatott vonal a következő cél.')})}
  ${sec(1,'Rekordjaid',1)}
  ${card(ls(rw({icon:'t-ring',title:'Becsült 1RM',sub:'becslés, nem mérés · márc 4. óta emelkedik',v:'96,7 kg',right:lv(97,c)}),rw({icon:'t-weight',title:'Legjobb szett',sub:'aug 28.',v:'77,5×8',right:lv(88,c)}),rw({icon:'t-protocol',title:'Legtöbb volumen',sub:'szept 24. a csúcs · 12,4 t összesen',v:'2 175 kg',right:lv(100,c)}))+acts(lk('Mi ez?',{toast:'A rekordok magyarázata'})),{i:1})}
  ${sec(2,'Technika és alternatívák',2)}
  ${card(ls(rw({icon:'t-book',title:'Beállás · Végrehajtás · Gyakori hibák',sub:'a mozdulat három lépésben',on:{sheet:'tech',arg:'1'}}),rw({icon:'t-camera',title:'Demó videó',on:{toast:'Demó videó'}}),
    sim.map(([n,k,t,last])=>rw({m:k,title:n,sub:`ugyanarra az izomra · ${t==='compound'?'összetett':'izolált'}${last?` · múltkor ${last}`:' · még nem csináltad'}`,on:{toast:`${n} — csere az edzés közben a ⋮ menüből`}}))),{i:2})}
  ${sec(3,'Medáljaid',3)}
  ${card(ls(rw({left:rcap(90),title:'Rep-rekord',sub:'szept 24.',v:'10 @ 72,5'}),rw({left:rcap(97),title:'1RM-rekord',sub:'szept 17.',v:'96,7 kg'})),{i:3})}
  ${sec(4,'Hol szerepel · kezelés',4)}
  ${card(ls(rw({icon:'t-peak',title:'A futó tervedben · csütörtök',on:'nap.csu'}),rw({icon:'t-stack',title:'Sablon a polcodon',on:'sablon'}),rw({icon:'t-note',title:'Szerkesztés',sub:'név, izom, típus — és a törlés',on:{toast:'Szerkesztés lap'}})),{i:4})}`)}

/* ── TERV ── */
const kgTxt=v=>v===0?'saját testsúly':kg(v)+' kg';
const repTxt=r=>r==='0'?'tartás':r;
const dayState=d=>d.d==='Csü'?'ma':d.done?'megvolt':'jön';
const BACKSIDE=['ham','glute','calf','back-mid','back-wide','back-lower','traps','shoulder-rear'];
const dayView=d=>d.mus.filter(([k])=>BACKSIDE.includes(k)).length>d.mus.length/2?'back':'front';
const shortM=k=>{const m=/^(.*?) \((.*?)\)$/.exec(muscleLabel(k));return !m?muscleLabel(k):/fej$/.test(m[2])?m[1]:`${m[1]} ${m[2]}`};
const dayBody=(d,cls='')=>bodyLiq(dayView(d),d.mus.map(([k,s])=>[k,d.done&&d.id!==TODAY?s/7:0,s/7]),cls);
const PH_S={MEV:'emelkedés',MAV:'emelkedés',MRV:'csúcs',Deload:'pihenő'};
/* a mesociklus hat hete hat edény: a múlt tele, a mostani félig, a jövő szaggatott vonal — a pihenőhéten leapad */
function mesoTubes(vals,{now=MESO.week,nowDone=null,h=104,max}={}){const mx=max||Math.max(...vals);
  return tubes(vals.map((s,i)=>{const past=i+1<now,cur=i+1===now,dl=MESO.curve[i]==='Deload';
    return {l:`${i+1}. hét`,v:cur&&nowDone!=null?`${nowDone}<u>/${s}</u>`:s,s:cur?'most':dl?'pihenő':MESO.curve[i]==='MRV'?'csúcs':'',p:past?s/mx*94:cur?(nowDone!=null?nowDone:s)/mx*94:0,wl:past?null:s/mx*94,now:cur,ghost:!past&&!cur,hatch:dl,c:'var(--dom)',mark:MESO.curve[i]==='Deload'?'↓':MESO.curve[i]==='MRV'?'▲':'',t:`${i+1}. hét · ${s} szett · ${PHASE[MESO.curve[i]]}`}}),{h,cls:'wk',gap:6})}
/* a nap kártyája: mit dolgoztat meg ez a nap (a test a fő rajz), három tény, és az izmok szettszámmal */
function dayCard(d){
  if(d.rest||d.sport)return `<div class="vs-dc quiet">${bub(d.sport?'t-volley':'t-moon',{s:34})}<span class="g"><small>${d.full}</small><strong>${d.sport?'röplabda · meccs':'pihenőnap'}</strong></span></div>`;
  if(ST.km&&!d.done&&d.id!=='pen'&&DAYS.indexOf(d)>=DAYS.findIndex(x=>x.id===TODAY)&&!(d.id===TODAY&&ST.km.released))return `<div class="vs-dc quiet">${bub('t-kimelo',{s:34})}<span class="g"><small>${d.full}${d.id===TODAY?' · ma':''}</small><strong>Kímélő mód · ${d.t} kimarad</strong></span></div>`;
  const s=dayState(d),part=d.done&&d.done.sets<d.sets,done=s==='megvolt';
  const f=done?[[part?`${d.done.sets}/${d.sets}`:d.done.sets,'szett'],[d.done.min,'perc'],[d.done.rec,'rekord']]:[[d.sets,'szett'],[s==='ma'?d.min:'~'+d.min,'perc'],[d.ex.length,'gyakorlat']];
  return `<button class="vs-dc ${s==='ma'?'now':done?'done':'next'}" data-go="nap.${d.id}" aria-label="${d.full} · ${d.t}">
    <span class="vs-hd"><span class="g"><small>${d.full}</small><strong>${d.t}</strong></span>${done?st(part?'Részben':'Megvolt',part?'warn':'ok'):s==='ma'?st('Ma','plan'):st('Jön')}${chev()}</span>
    <span class="vs-ct">${dayBody(d)}<span class="vs-cl"><span class="f3">${f.map(([v,l])=>`<i><b>${v}</b><small>${l}</small></i>`).join('')}</span><span class="chs">${d.mus.map(([k,n])=>`<span>${mchp(k,'sm')}<b>${n}</b></span>`).join('')}</span></span></span></button>`}
const dayCards=(i=1)=>`<div class="vs-dcs rise" style="--i:${i}">${DAYS.map(dayCard).join('')}</div>`;
const NDAYS=()=>DAYS.filter(x=>!x.rest&&!x.sport).length;
const demoT=()=>note(`Demó: <button class="fh-lk" data-go="terv.fut">futó terv</button> · <button class="fh-lk" data-go="terv.ures">még nincs terv</button> · <button class="fh-lk" data-go="terv.nincs">nem fut terv</button>`);
function terv(arg){
  if(arg==='ures'||arg==='nincs')ST.terv=arg;else if(arg==='fut')ST.terv='run';
  if(ST.terv!=='run'){const e=ST.terv==='ures';return page('edzes',{title:'Terv',sub:e?'Még nincs terved':'Most nem fut terv',tab:'terv'},`
    ${hero({lbl:'Terv',verdict:e?'Még nincs edzésterved.':'Most nem fut terv.',sub:e?'Itt fognak élni a terveid — egy terv megmondja, melyik nap mit edzel, és hétről hétre mennyit.':'A terveid az Edzéstervek mögött várnak, és bármikor indíthatsz egy újat.',
      body:emptyTank('t-peak',e?'Állíts össze egyet — végigkérdezem, mi fér bele a hetedbe.':'Válassz a terveid közül, vagy csinálj újat.'),acts:btn('Új terv összeállítása','ujterv')})}
    ${sec(1,'Amiből indíthatsz',1)}
    ${card(ls(rw({icon:'t-stack',title:'Edzéstervek',sub:'amiből indíthatsz',on:'konyvtar'}),rw({icon:'t-run',title:'Futás',sub:'Robbanékonyság 01 · 3. hét / 8',on:'futas'}))+note('A Terv fülön az Edzéstervek mögött van minden: ami fut, ami következik, és amit lezártál.')+demoT(),{i:1})}`)}
  const toDeload=MESO.curve.indexOf('Deload')+1-MESO.week,rest=toDeload===0?' — és ez a hét maga a pihenőhét':toDeload===1?' — a jövő hét már pihenőhét':` — ${toDeload} hét múlva jön a pihenőhét`,ph=MESO.curve[MESO.week-1];
  return page('edzes',{title:'Terv',sub:`${MESO.week}. hét a ${MESO.of}-ból`,tab:'terv'},`
  ${hero({lbl:`${MESO.name} · Tavasz · ${PHASE[ph]}`,verdict:`A ${MESO.of} hétből a ${MESO.week}. héten jársz.`,sub:`${WTOTAL} szett, ${NDAYS()} edzésnapra osztva${rest}.`,
    body:`<div class="vs-hg">${mesoTubes(WEEK_SETS,{nowDone:LD_DONE})}</div><div class="vs-ft"><span>${MESO.from}</span><span>heti szettszám</span><span>${MESO.to}</span></div>`,acts:btn('A terv oldala','run')})}
  ${sec(1,`A heted · ${NDAYS()} edzésnap`,1)}
  ${dayCards(1)}<p class="fh-note vs-dn">Egy nap kártyája a nap saját oldalára visz. A testen az izom annyira telik, amennyi szettet aznap kap; a megvolt napokon sötétebb.</p>
  ${sec(2,'Az izmaid',2)}
  ${card(ls(rw({icon:'t-muscle',title:'Melyik izmod hol tart',sub:`${ROLL.length} izom kap többet hétfőtől`,on:'het'})),{i:2})}
  ${sec(3,'Terveid',3)}
  ${card(ls(rw({icon:'t-stack',title:'Edzéstervek',sub:'amiből indíthatsz',on:'konyvtar'}),rw({icon:'t-run',title:'Futás',sub:'Robbanékonyság 01 · 3. hét / 8',on:'futas'}),rw({icon:'t-coin',title:'Edzésterv lezárása',sub:`ha ezt a ${MESO.of} hetet végigcsináltad`,on:{sheet:'close'}}))+demoT(),{i:3})}`)}
function run(){const ph=MESO.curve[MESO.week-1];
  return page('edzes',{title:`${MESO.name} · Tavasz`,sub:`Aktív · ${MESO.week} / ${MESO.of}. hét · ${PHASE[ph]} · vége ${MESO.to}`,back:'terv'},`
  ${hero({lbl:`A terv íve · ${MESO.split}`,verdict:'Az 5. hét a csúcs, a 6. a pihenőhét.',sub:'Akkor szándékosan kevesebbet kérek tőled.',
    body:`<div class="vs-hg ar">${areaM(WEEK_SETS,{h:150,labels:WEEK_SETS.map((s,i)=>i===5?'6. hét':`${i+1}.`),min:20,max:92},[[MESO.week-1,'most · 75','now'],[4,'csúcs · 84','pr']])}</div>`+tags([['t-play','Aktív'],['t-calendar',`${MESO.week} / ${MESO.of}. hét`],['t-up',PHASE[ph]],['t-clock',`vége ${MESO.to}`]])+note('A felszín a heti szettszám: emelkedik, az 5. héten tetőzik, a 6.-on leapad.'),acts:btn('Heti vizsgálat','het')})}
  ${sec(1,'Mezo jegyzete',1)}
  ${card(msg('mezo','„A hátad bírta a múlt heti emelést, ezért kapott még két szettet. A vállad marad, amíg a jobb oldali nyilallás el nem múlik.”'),{i:1})}
  ${sec(2,'Hol tartasz',2)}
  ${card(ls(rw({icon:'t-muscle',title:'Heti vizsgálat',sub:'melyik izmod hol tart',right:`<span class="vs-mini">${WMUS.slice(0,7).map(m=>`<i style="--c:${dk(m[1])}"><b style="height:${clamp(m[2]/m[5]*100,14,100)}%"></b></i>`).join('')}</span>`,on:'het'}),
    rw({icon:'t-calendar',title:'Hétfőn jön · előrejelzés',sub:'nem kell rákattintani'}))+`<div class="fh-chips">${ROLL.map(n=>{const m=WMUS.find(x=>x[0]===n);return `<span>${mchp(m[1],'sm')}${n} +2 szett</span>`}).join('')}</div>`,{i:2})}
  ${sec(3,`A heted · ${NDAYS()} edzésnap`,3)}
  ${dayCards(3)}
  ${sec(4,'Lezárás',4)}
  ${card(ls(rw({icon:'t-coin',title:'Edzésterv lezárása',sub:'lezárás után riportot kapsz róla',on:{sheet:'close'}}))+note('A terv oldala állapot-első: mit mutat a terv most. A szerkesztés egy szinttel lejjebb, a napoknál van.'),{i:4})}`)}
function nap(id){const d=DAYS.find(x=>x.id===id)||DAYS.find(x=>x.id===TODAY);
  if(d.rest||d.sport)return page('edzes',{title:d.t,sub:d.full,back:'terv'},`
    ${hero({lbl:d.full,verdict:d.sport?'Ezen a napon sportolsz, nem a terv szerint edzel.':'Ezen a napon nem kérek tőled semmit.',sub:d.sport?'A meccs a Mai fülön naplózható.':'A pihenés is a terv része.',art:d.sport?'t-volley':'t-moon',body:`<div class="vs-hg">${weekTubes('plan')}</div>`})}
    ${card(`<p class="fh-note" style="margin:0">Egy hét a pihenőnapjaival együtt egész — ezért látszanak itt is.</p>`,{i:1})}`);
  const share=Math.round(d.sets/WTOTAL*100);
  return page('edzes',{title:d.t,sub:`Terv · ${d.full}`,back:'terv'},`
  ${hero({lbl:d.full,verdict:`${d.sets} munkaszett, ${d.ex.length} gyakorlat.`,sub:`${d.min} perc · a heted ${share}%-a`,left:`<span class="vs-hb">${dayBody({...d,done:null},'')}<small>${dayView(d)==='back'?'hátulról':'elölről'}</small></span>`,
    body:`<div class="vs-hg">${tubes(d.mus.map(([k,s])=>({m:k,l:shortM(k),v:s,s:'szett',p:s/Math.max(...d.mus.map(m=>m[1]))*90,c:dk(k),on:`izom.${(WMUS.find(m=>m[1]===k)||WMUS.find(m=>byKey[m[1]].region===byKey[k].region)||WMUS[0])[1]}`})),{h:92,cls:'sm',gap:6})}</div>`,acts:btn('A nap szerkesztése','napszerk')})}
  ${sec(1,'A gyakorlatok · olvasható előírás',1)}
  ${card(d.ex.map(([n,k,ws,rep,rir,wu,w,warn],i)=>`<div class="vs-ex"><div class="eh"><span class="ix">${i+1}</span>${mchp(k,'sm')}<strong>${n}</strong>${caps(ws,0,dk(k))}</div>
      <div class="eg"><span><b class="t">${ws}×${repTxt(rep)}</b><small>szett × ism.</small></span><span><b>${rir}</b><small>RIR</small></span><span><b>${kgTxt(w)}</b><small>induló</small></span><span><b>${wu}</b><small>bemelegítő</small></span></div>${warn?`<span class="vs-warn">${warn}</span>`:''}</div>`).join('')
    +acts(lk('+ Gyakorlat hozzáadása','napszerk')),{i:1})}
  ${sec(2,'Szerkesztés',2)}
  ${card(ls(rw({icon:'t-note',title:'A nap szerkesztése',sub:'sorrend, ismétlés-sáv, RIR, súly',on:'napszerk'}))+note('Ez az oldal csak olvas. Minden szerkesztés a nap saját szerkesztőjében történik.'),{i:2})}`)}
const edRow=(n,k,ws,rep,rir,w)=>rw({left:`<span class="vs-grip">⠿</span>`,m:k,title:n,sub:`${ws} szett · ${repTxt(rep)} ism. · RIR ${rir} · ${kgTxt(w)}`,right:`<button class="vs-rb" data-toast="Sor műveletei" aria-label="Sor műveletei">⋮</button>`});
const pourLg=ex=>`<div class="vs-lg">${ex.map(([n,k,ws])=>`<span><i style="background:${dk(k)}"></i>${n.split(' ')[0]} <b>${ws}</b></span>`).join('')}</div>`;
function napszerk(){const d=DAYS.find(x=>x.id===TODAY);
  return page('edzes',{title:'A nap szerkesztése',sub:`${d.full} · ${d.t} · ${d.sets} szett`,back:'nap.'+d.id},`
  ${hero({lbl:`${d.full} · ${d.t}`,verdict:`${d.ex.length} gyakorlat, ${d.sets} szett.`,sub:'Húzd a sorokat a sorrendhez. Minden változás azonnal mentődik.',body:pour(d.ex.map(e=>[e[1],e[2]]))+pourLg(d.ex),acts:btn('+ Gyakorlat hozzáadása',{toast:'Gyakorlat-választó'})})}
  ${sec(1,'Sorrend és előírás',1)}
  ${card(ls(d.ex.map(([n,k,ws,rep,rir,wu,w])=>edRow(n,k,ws,rep,rir,w)))+note('A terv heti szett-számai automatikusan követik, amit itt átírsz — a „Melyik izmod hol tart” oldal ugyanabból olvas. Ugyanez a szerkesztő nyílik a sablonok napjainál is.'),{i:1})}`)}
function het(){const rows=[...WMUS].sort((a,b)=>(b[5]-b[2])-(a[5]-a[2])),under=WMUS.filter(m=>m[2]<m[3]).length,top=WMUS.filter(m=>m[2]>=m[5]).length,growing=WMUS.length-under-top,ent=WMUS.map(m=>[m[1],clamp(m[2]/m[5],.12,1),0]);
  return page('edzes',{title:'Heti vizsgálat',sub:'Melyik izmod hol tart',back:'terv'},`
  ${hero({lbl:`Ezen a héten · ${WTOTAL} szett`,verdict:`${growing} izmod fejlődik, ${under} még kevés munkát kap.`,sub:`${top?top+' a felső értékén jár':'Egy sincs a felső értékén'}. A múlt héthez képest 14 szettel több.`,body:duo(ent,'md')+note('Minden izom a saját felső értékéig tölthető: minél teltebb, annál közelebb jár hozzá.')})}
  ${sec(1,'Hétfőtől változik',1)}
  ${card(ls(rw({icon:'t-calendar',title:`${ROLL.join(', ')} kap még két-két szettet`,sub:'A többi marad.'})),{i:1})}
  ${sec(2,'Izmonként · ami még fér bele, elöl',2)}
  ${card(`<div class="vs-wlk"><span><u></u>ennyitől fejlődik</span><span><u class="d"></u>innen hangsúly</span><span><i></i>az edény széle a felső érték</span></div>`+ls(rows.map(m=>{const [n,k,s,mev,mav,mrv]=m,room=mrv-s,tier=s<mev?'Építés':s>=mav?'Hangsúly':'Tartás';const say=s<mev?`Még nem éri el azt a szintet, ahonnan fejlődik — ${mev-s} szett hiányzik.`:room<=0?'Elérte a felső értéket ebben a tervben.':s>=mav?`Még ${room} szett fér bele.`:`Szinten tartod — még ${room} szett fér bele.`;
    return rw({m:k,title:`${n} ${st(tier,s<mev?'warn':s>=mav?'plan':'q')}`,sub:say+`<span class="vs-rowbar">${wlv(clamp(s/mrv*100,4,100),dk(k),[[mev/mrv*100],[mav/mrv*100,'d']],16)}</span>`,v:`${s} / ${mrv}`,on:`izom.${k}`})}))
    +note('Százalékot nem írunk ki: a hely szettben van megmondva, és rajzban megmutatva.'),{i:2})}`)}
function izom(key){const m=WMUS.find(x=>x[1]===key)||WMUS[0],[n,k,s,mev,mav,mrv]=m,c=dk(k),pos=v=>clamp(v/mrv*100,0,100),days=DAYS.filter(d=>!d.rest&&!d.sport&&d.mus.some(([mk])=>mk===k)),a=[Math.round(s*.72),Math.round(s*.82),s,s,Math.round(s*1.15),Math.round(s*.5)],merged=Math.abs(mev-mrv)<2,v=TOKEN_SHAPES[k][0][0];
  return page('edzes',{title:n,sub:'Heti vizsgálat · izom',back:'het'},`
  ${hero({lbl:`${s} szett / hét`,verdict:s<mev?'Ennyiből még nem fejlődik.':s>=mrv?'A felső értéken jár.':'Fejlődő tartományban van.',sub:`${s<mev?'Kevesebb, mint amennyitől elindul.':s>=mrv?'Ebben a tervben ennél többet nem kérek tőle.':''} Hétfőtől ${ROLL.includes(n)?'+2 szettet kap.':'marad ennyi.'}`,
    body:`<div class="vs-cylw"><div class="vs-cyl" style="--c:${c}"><span class="tb"><span class="l ${pos(s)<28?'lo':''}" style="height:${clamp(pos(s)*.9,3,90)}%">${wave(`color-mix(in srgb,${c} 70%,#fff)`)}<b>${s}</b></span></span>
        <i class="wl" style="bottom:90%"><em>felső érték · ${mrv}</em></i>${merged?'':`<i class="wl d" style="bottom:${pos(mav)*.9}%"><em>hangsúly · ${mav}</em></i>`}<i class="wl" style="bottom:${pos(mev)*.9}%"><em>${merged?'ennyitől fejlődik — és itt tartod':'ennyitől fejlődik'} · ${mev}</em></i></div>
      <span class="vs-hb">${bodyLiq(v,[[k,clamp(s/mrv,.1,1),0]])}<small>${v==='back'?'hátulról':'elölről'}</small></span></div>`})}
  ${sec(1,'Hol tart',1)}
  ${card(facts([[days.length,'edzés / hét'],[a[0],'az első héten'],[Math.max(...a),'a legtöbb a tervben']])+note(`A mérőhenger három vonala: ${mev} szettől fejlődik, ${mav}-től kap hangsúlyt, ${mrv} a felső érték — most ${s} szettnél áll.`),{i:1})}
  ${sec(2,'A terv íve erre az izomra',2)}
  ${card(mesoTubes(a,{h:84,max:Math.max(...a)}),{i:2,style:`--dom:${c};--liq1:color-mix(in srgb,${c} 60%,#fff);--liq2:${c}`})}
  ${sec(3,'Hol dolgozik',3)}
  ${card(ls(days.map(d=>{const n2=d.mus.find(([mk])=>mk===k)[1];return rw({m:k,title:`${d.full} · ${d.t}`,sub:d.ex.filter(e=>e[1]===k).map(e=>e[0]).join(' · '),right:`<span class="vs-rr cl"><span class="v">${n2} <small>szett</small></span>${caps(n2,d.done?n2:0,c)}</span>`,on:`nap.${d.id}`})})),{i:3})}
  ${sec(4,'Honnan jön ez a szám',4)}
  ${card(ls([['Alap ajánlás',`RP guidelines · haladó: ${mev}–${mrv} szett hetente`],['A terv íve',`a ${MESO.week}. hét ${PHASE[MESO.curve[MESO.week-1]].toLowerCase()}-szakasza`],['A te visszajelzéseid',`a múlt heti szett-visszajelzések alapján ${ROLL.includes(n)?'emelhető':'marad'}`],['A napokra osztás',`${days.length} edzésnapra elosztva`]].map(([t,s2],i)=>rw({left:num(i+1),title:t,sub:s2}))),{i:4})}
  ${sec(5,'A mostani tervedhez képest',5)}
  ${card(`<div class="vs-vs">${tubes([{l:'Előző terv',v:Math.round(s*.85),s:'szett / hét',p:pos(Math.round(s*.85))*.94,c:'var(--faint)'},{l:'Most',v:s,s:'szett / hét',p:pos(s)*.94,c,wl:pos(Math.round(s*.85))*.94}],{h:116})}</div>`
    +note('A kevesebb nem rosszabb: ha egy izom kevesebbet kap, máshová került a hangsúly. Ugyanezt a számot olvassa a terv oldala és a heti vizsgálat is — nem tudnak eltérni egymástól.'),{i:5})}`)}
/* a tervek sora egy csővezeték: ami fut, félig tele; ami következik, üresen vár mögötte — a hossz a hetek száma */
const queue=()=>`<div class="vs-queue">${RUNS.map(r=>`<button class="${r.st==='fut'?'now':''}" style="flex:${r.weeks+2}" ${r.st==='fut'?'data-go="run"':`data-toast="${r.n} · ${r.weeks} hét · ${r.from}-tól"`}><span>${r.st==='fut'?`<i style="width:${r.wk/r.weeks*100}%"></i>`:''}<b>${r.st==='fut'?`${r.wk}/${r.weeks}`:r.weeks+' hét'}</b></span><small>${r.n.split(' · ')[0].replace(' maintenance','')}</small></button>`).join('')}</div>`;
function konyvtar(){const now=RUNS.filter(r=>r.st==='fut'),next=RUNS.filter(r=>r.st==='következik');
  return page('edzes',{title:'Edzéstervek',sub:`1 fut · ${next.length} következik · ${TPL.length} sablon · ${CLOSED.length} lezárva`,back:'terv'},`
  ${hero({lbl:'Amiből indíthatsz',verdict:'Itt él minden terved.',sub:'Ami most fut, ami utána következik, a sablonjaid és amit már lezártál.',
    body:queue()+tags([['t-play','1 fut'],['t-calendar',`${next.length} következik`],['t-template',`${TPL.length} sablon`],['t-history',`${CLOSED.length} lezárva`]]),acts:btn('Új terv összeállítása','ujterv')})}
  ${sec(1,'Most fut',1)}
  ${card(now.map(r=>ls(rw({icon:'t-peak',title:r.n,sub:`${r.split} · ${r.from} – ${r.to}`,v:`${r.wk} / ${r.weeks}. hét`,on:'run'}))+facts([[r.weeks,'hét'],['5','nap / hét'],[WTOTAL,'szett e héten']])).join(''),{i:1})}
  ${sec(2,`Következnek · ${next.length} terv`,2)}
  ${card(next.map((r,i)=>`<div class="vs-log">${rw({icon:'t-calendar',title:r.n,sub:`${r.split}${i===0?' · a futó terv után kezdődik':''}`,v:`${r.from}-tól`,on:{toast:'A terv saját oldala — onnan indítható, dátummal'}})}${facts([[r.weeks,'hét'],[r.split.match(/(\d)×/)[1],'nap / hét'],[r.to,'vége']])}</div>`).join('')
    +note('Egy következő terv nem innen indul: a saját oldalán van a dátumozott indítás, hogy a futó terved ne álljon le véletlenül.'),{i:2})}
  ${sec(3,'A polcod',3)}
  ${card(ls(rw({icon:'t-template',title:'Sablonjaid',sub:`${TPL.length} recept, amiből futam indul`,on:'sablonok'}),rw({icon:'t-history',title:'Lezárt futamaid',sub:`${CLOSED.length} befejezett terv`,on:'futamok'})),{i:3})}`)}
function futamok(){const weeks=CLOSED.reduce((s,r)=>s+r.weeks,0),cm=ST.cmp;
  return page('edzes',{title:'Lezárt futamaid',sub:`${CLOSED.length} futam · ${weeks} hét${cm?' · összevetés-mód':''}`,back:'konyvtar'},`
  ${hero({lbl:'Amit már végigcsináltál',verdict:`${CLOSED.length} lezárt terv, összesen ${weeks} hétnyi edzés.`,sub:cm?'Válassz ki kettőt — abban a sorrendben, ahogy összevetnéd őket.':'Mindegyiknek van egy befagyasztott riportja.',
    body:`<div class="vs-hg">${tubes(CLOSED.map((r,i)=>{const at=ST.cmpSel.indexOf(i);return {l:r.n.split(' · ')[0],v:`${r.pct}%`,s:cm?(at>=0?`${at+1}. kiválasztva`:'kiválaszt'):`${r.weeks} hét`,p:r.pct*.94,wl:94,sel:at>=0,mark:r.n.split(' · ')[1],c:'var(--dom)',...(cm?{ve:`cmpsel:${i}`}:{on:'riport'})}}),{h:132,cls:'n3'})}</div>`+note('Egy edény egy lezárt terv: annyira van tele, amennyi betervezett edzést megcsináltál belőle.'),
    acts:(cm&&ST.cmpSel.length===2?btn('Összevetés megnyitása','osszevetes'):'')+ve(cm?'Mégsem':'Összevetés','cmp',cm?'ghost':'')})}
  ${sec(1,'Futamok',1)}
  ${card(CLOSED.map((r,i)=>{const at=ST.cmpSel.indexOf(i),sub=`${r.from} – ${r.to} · ${r.weeks} hét`;
    return `<div class="vs-log">${cm?rw({left:`<span class="vs-tk ${at>=0?'on':''}">${at>=0?`<b>${at+1}</b>`:' '}</span>`,title:r.n,sub,ve:`cmpsel:${i}`,nochev:true})
      :rw({icon:'t-scroll',title:r.n,sub,right:st(r.rep?'riport kész':'riport nélkül',r.rep?'ok':'q'),on:'riport'})}${facts([[r.weeks,'hét'],[r.pct+'%','teljesített edzés'],[r.rep?'van':'nincs','riport']])}${cm?'':`<div class="vs-in" style="padding:10px 0 0">${lk('Újrafuttatás',{toast:'Újrafuttatás — ebből a futamból új terv indul'})}${lk('Sablonná',{toast:'Sablonná mentve'})}</div>`}</div>`}).join('')
    +note('Ami itt nincs kiírva (edzésszám, rekordok), az a riportban él — egy listáért nem kérünk le annyi adatot.'),{i:1})}`)}
function riport(){const r=CLOSED[1];
  return page('edzes',{title:r.n,sub:`Lezárt futam · ${r.from} – ${r.to} · ${r.weeks} hét`,back:'futamok'},`
  ${hero({lbl:'A teljesített edzések aránya',verdict:`A betervezett edzések ${r.pct}%-át megcsináltad.`,sub:'Ez a riport a lezáráskor készült pillanatkép — azóta nem változik.',left:fill(SH_CUP,{p:r.pct*.9,s:86,c:'#F9D06A',c2:'#E9892B'}),body:`<div class="vs-ms">${stars5(r.pct/100)}<span>${r.pct}%</span></div>`,
    acts:btn('Újrafuttatás',{toast:'Új futam indul ebből'})+lk('Újragenerálás',{toast:'Riport újragenerálása'})})}
  ${sec(1,'Ami erőben változott',1)}
  ${card(ls([['Guggolás','quad','+7,5 kg','+4,2%',80],['Döntött törzsű evezés','back-mid','+5 kg','+3,1%',85],['Fekvenyomás','chest-mid','0 kg','+2,4%',88],['Román felhúzás','ham','+10 kg','+5,0%',76]].map(x=>rw({m:x[1],title:x[0],sub:`${x[2]==='0 kg'?'ugyanannyi súly, több ismétlés':'a legnehezebb szett súlya'} · ${x[2]}`,v:x[3],right:rcap(x[4],dk(x[1]))})))
    +note('A kilogramm a legnehezebb szett súlyának változása, a százalék a becsült maximumé — ezért lehet „ugyanannyi súly” mellett is pluszban. A kapszulán a vonal a futam eleje.'),{i:1})}
  ${sec(2,'Az izmok útja',2)}
  ${card(WMUS.slice(0,6).map(m=>mus(m[1],m[0],`${m[2]} szett`,clamp(m[2]/20*100,6,100))).join(''),{i:2})}
  ${sec(3,'A mostani tervedhez képest',3)}
  ${card(tubes(WMUS.slice(0,4).map(m=>({m:m[1],l:m[0],v:m[2],s:`akkor ${m[2]-2} · +2`,p:m[2]/20*94,wl:(m[2]-2)/20*94,c:dk(m[1]),t:`${m[0]} · akkor ${m[2]-2}, most ${m[2]} szett`})),{h:96,cls:'sm'})+note('A folyadék a mostani heti szett, a szaggatott vonal az akkori.'),{i:3})}
  ${sec(4,'Lezáráskor írtad',4)}
  ${card(txt('„Az utolsó két hét nehéz volt, de a guggolás végre nem fájt. A vállat kímélni kell a következőben.”')+note('Amit a lezáráskor nem mértünk, azt itt nem találjuk ki utólag — inkább nem írjuk ki.'),{i:4})}`)}
function osszevetes(){const a=CLOSED[1],b=CLOSED[0];
  return page('edzes',{title:'Összevetés',sub:'Két lezárt futam',back:'futamok'},`
  ${hero({lbl:'Egymás mellett',verdict:'Két befejezett terv, nem ítélet.',sub:`${a.n} és ${b.n}. A gyengébb oldal nincs megjelölve.`,
    body:`<div class="vs-vs">${tubes([{l:a.n.split(' · ')[0],v:a.pct+'%',s:`${a.weeks} hét · ${a.n.split(' · ')[1]}`,p:a.pct*.94,c:'var(--dom)',on:'riport'},{l:b.n.split(' · ')[0],v:b.pct+'%',s:`${b.weeks} hét · ${b.n.split(' · ')[1]}`,p:b.pct*.94,c:'#1877F2',on:'riport'}],{h:132})}</div>`})}
  ${sec(1,'Számok',1)}
  ${card(`<div class="vs-cmp"><span></span><b class="h">${a.n.split(' · ')[0]}</b><b class="h">${b.n.split(' · ')[0]}</b>
    ${[['Teljesített edzés',a.pct+'%',b.pct+'%',a.pct,b.pct],['Hossz',a.weeks+' hét',b.weeks+' hét',a.weeks/8*100,b.weeks/8*100],['Heti szett (csúcs)','84','76',100,90],['Rekord','6 db','4 db',100,67],['Erő · guggolás','+4,2%','+2,1%',100,50]].map(r=>`<span>${r[0]}</span><b>${r[1]}${lv(r[3],'var(--dom)',8)}</b><b>${r[2]}${lv(r[4],'#1877F2',8)}</b>`).join('')}</div>`
    +note('Ahol nincs adat, „–” áll, sosem 0 — a hiányzó mérés nem nulla eredmény. Nincs külön összevetés-adat: a két befagyasztott riportot rakjuk egymás mellé.'),{i:1})}`)}
/* egy sablon = egy hét receptje: hét kapszula, az edzésnapok tele */
const weekCaps=n=>{const on=n>=5?[0,1,2,3,4]:n===4?[0,1,3,4]:[0,2,4];return `<span class="vs-caps wide wk" style="--c:var(--dom)">${['H','K','Sze','Cs','P','Szo','V'].map((d,j)=>`<i class="${on.includes(j)?'f':''}"><b>${d}</b></i>`).join('')}</span>`};
function sablonok(){const runs=TPL.reduce((s,t)=>s+t.runs,0);
  return page('edzes',{title:'Sablonjaid',sub:`${TPL.length} sablon · ${runs} futam indult belőlük`,back:'konyvtar'},`
  ${hero({lbl:'A receptjeid',verdict:'Egy sablon egy hét felépítése.',sub:'Ha tetszik, futamot indítasz belőle — a sablon közben érintetlen marad.',art:'t-template',body:tags([['t-template',`${TPL.length} sablon`],['t-play',`${runs} futam indult belőlük`]]),acts:btn('Új sablon összeállítása','ujterv')})}
  ${sec(1,'Sablonok · egy kapszula egy nap',1)}
  ${card(TPL.map(t=>`<button class="vs-tpl" data-go="sablon"><span class="vs-hd"><span class="g"><strong>${t.n}</strong><small>${t.split}</small></span>${st(t.runs?`${t.runs} futam`:'még nem futott',t.runs?'plan':'q')}${chev()}</span>
      <span class="wkc">${weekCaps(t.days)}<span class="vs-stk">${t.mus.map(k=>mchp(k,'sm')).join('')}</span></span>${facts([[t.weeks,'hét'],[t.days,'nap / hét'],['~'+t.min,'perc / edzés']])}</button>`).join('')
    +note('A listán nincs törlés: a sablon saját oldalán van, ahol látod is, mit törölnél.'),{i:1})}`)}
function sablon(){const t=TPL[0];
  return page('edzes',{title:t.n,sub:`Sablon · ${t.split}`,back:'sablonok'},`
  ${hero({lbl:'Sablon',verdict:`${t.weeks} hét × ${t.days} edzésnap.`,sub:'Ez a hét felépítése — a futam ebből készül.',body:`<div class="vs-hg">${weekTubes('plan')}</div><div class="fh-chips">${t.mus.map(k=>`<span>${mchp(k,'sm')}${muscleLabel(k)}</span>`).join('')}</div>`,acts:btn('Futam indítása ebből',{sheet:'start'})})}
  ${sec(1,`A hét felépítése · ${t.days} edzésnap`,1)}
  ${card(DAYS.map(d=>d.rest||d.sport?`<div class="vs-tday muted"><div class="dh"><b>${d.full}</b><span>${d.sport?'röplabda · meccs':'pihenőnap'}</span></div></div>`
    :`<div class="vs-tday"><div class="dh"><b>${d.full} · ${d.t}</b><span>${d.sets} szett · ~${d.min} perc</span></div>${d.ex.map(e=>`<div class="ex">${mchp(e[1],'sm')}<span class="g">${e[0]}</span><span class="v"><b>${e[2]}×${repTxt(e[3])}</b> · ${kgTxt(e[6])}</span></div>`).join('')}</div>`).join(''),{i:1})}
  ${sec(2,'Heti szettek izmonként',2)}
  ${card(WMUS.slice(0,6).map(m=>mus(m[1],m[0],`${m[2]} szett`,clamp(m[2]/13*100,6,100))).join(''),{i:2})}
  ${sec(3,'Futamok ebből a sablonból',3)}
  ${card(ls(rw({icon:'t-peak',title:'Hypertrophy 04 · Tavasz',sub:'most fut · 3 / 6. hét',right:caps(6,2,'var(--dom)',{cur:2}),on:'run'}),rw({icon:'t-scroll',title:'Hypertrophy 03 · Ősz',sub:'lezárva · Nov 13',right:caps(6,6,'var(--faint)'),on:'riport'})),{i:3})}
  ${sec(4,'A sablon kezelése',4)}
  ${card(ls(rw({icon:'t-pencil',title:'Szerkesztés',on:'sablonszerk'}),rw({icon:'t-repeat',title:'Másolat',on:{toast:'Másolat készült — a másolat szerkesztője nyílik'}}),rw({icon:'t-trash',title:'<span style="color:var(--bad)">Sablon törlése</span>',on:{sheet:'tdel'}}))
    +note('A törlés a korábbi futamokat és a riportjaikat nem bántja — azok megmaradnak.'),{i:4})}`)}
function sablonszerk(){const d=DAYS[0];
  return page('edzes',{title:'Hétfő · Push',sub:'Sablon szerkesztése · Hypertrophy 04 · Tavasz',back:'sablon'},`
  ${hero({lbl:'Sablon szerkesztése',verdict:'Ugyanaz a szerkesztő, mint a futó terv napjainál.',sub:'Minden változás azonnal mentődik.',
    body:`<div class="fh-pills" style="margin-top:12px">${DAYS.map((x,i)=>`<button class="fh-pill ${i===0?'on':''}" data-toast="${x.full} · ${x.t}">${x.d}</button>`).join('')}</div>${pour(d.ex.map(e=>[e[1],e[2]]))}${pourLg(d.ex)}`,acts:btn('+ Gyakorlat hozzáadása',{toast:'Gyakorlat-választó'})})}
  ${sec(1,'Sorrend és előírás',1)}
  ${card(ls(d.ex.map(e=>edRow(e[0],e[1],e[2],e[3],e[4],e[6])))+note('Egy feladatra egy felület: a sablon napja és a futó terv napja ugyanígy néz ki.'),{i:1})}`)}
/* az új terv előnézete: ahány hetet kérsz, annyi edény — emelkedik, tetőzik, a végén leapad */
const WZW=[4,5,6,7,8];
function wzArc(){const n=WZW[ST.wz],v=Array.from({length:n},(_,i)=>i===n-1?40:Math.round(55+45*i/(n-2)));
  return tubes(v.map((p,i)=>({l:`${i+1}.`,p:0,wl:p*.94,ghost:true,hatch:i===n-1,mark:i===n-1?'↓':i===n-2?'▲':'',c:'var(--dom)',t:`${i+1}. hét${i===n-1?' · pihenőhét':i===n-2?' · csúcshét':''}`})),{h:64,cls:'wk',gap:5})}
function ujterv(stepArg){
  if(stepArg==='gen')return page('edzes',{title:'Új terv',sub:'Összeállítás',back:'konyvtar'},`
    ${hero({lbl:'Összeállítás',verdict:'Rakom össze a heted.',sub:'Kiszámolom, melyik nap mit edzel, és hétről hétre mennyit.',left:fill(SH_FLASK,{p:58,s:84,cls:'bubl'}),acts:btn('Kész — mutasd a vázlatot','ujterv.kesz')})}
    ${card(ls(rw({icon:'t-flask',title:'Dolgozom rajta…',sub:'kb. 10 másodperc · nem kell itt maradnod'}))+`<div class="vs-rowbar" style="margin-top:12px">${level(58,{h:16,label:'napok',val:'hetek'})}</div>`,{i:1})}`);
  if(stepArg==='kesz')return page('edzes',{title:'A vázlatod',sub:'Új terv · még nincs mentve',back:'konyvtar'},`
    ${hero({lbl:'Még nincs mentve',verdict:'Nézd át, írd át.',sub:'Ami nem stimmel, azt írd át — csak utána mentsük el. A vázlat a memóriában él, amíg el nem mented — ki-be lépkedhetsz benne.',body:`<div class="vs-hg">${wzArc()}</div>`,acts:btn('Mentés',{toast:'Elmentve — a terv a Következnek listába került'})+lk('Újra kérdezz','ujterv')})}
    ${sec(1,'A hét',1)}
    ${dayCards(1)}`);
  const q=(n,t,h,opts,on,i,cmd)=>sec(n,t,i)+card(`<p class="fh-txt" style="margin-bottom:10px">${h}</p>`+(Array.isArray(on)?`<div class="vs-wd">${opts.map((o,j)=>`<button class="${on.includes(j)?'on':''}" data-ve="multi"><i></i><b>${o}</b></button>`).join('')}</div>`:chips(opts,on,cmd)),{i});
  return page('edzes',{title:'Új terv',sub:'Pár kérdés, és összerakom',back:'konyvtar'},`
  ${hero({lbl:'Új terv',verdict:'Pár kérdés, és összerakom.',sub:'Csak azt kérdezem meg, amit nem tudok kitalálni helyetted.',body:`<div class="vs-hg">${wzArc()}</div>`+note(`Ilyen íve lesz ${WZW[ST.wz]} hétre: emelkedik, az utolsó előtti héten tetőzik, a végén pihenőhét.`)})}
  ${q(1,'Mennyi időre','Hány hét legyen?',WZW.map(n=>n+' hét'),ST.wz,1,i=>`wzw:${i}`)}
  ${q(2,'Mikor érsz rá','Mely napokon edzel?',['H','K','Sze','Cs','P','Szo','V'],[0,1,2,3,4],2)}
  ${q(3,'Mi a cél','Mire menjen ki a terv?',['Izomépítés','Erő','Fogyás mellett tartás'],0,3)}
  ${q(4,'Mit kíméljünk','Van, ami most fáj?',['Semmi','Váll','Térd','Hát'],1,4)}
  ${card(`<p class="fh-note" style="margin:0">Az edzőtermi időpontjaidhoz nem nyúlok — azokat te állítod be, és nem találom ki helyetted.</p>`,{i:5})}`,
  {foot:`<button class="btn" style="flex:1" data-go="ujterv.gen">Rakd össze</button>`})}

/* ── SAJÁT EDZÉS ── */
const sjKg=v=>v==null?'auto kg':`${kg(v)} kg`;
const sjSum=e=>`${e.w} szett · ${e.lo}–${e.hi} ism. · RIR ${e.rir} · ${sjKg(e.kg)}`;
function sjStep(i,f,lbl,v,min,max){const auto=f==='kg'&&v==null;
  return `<div class="vs-sjl"><span>${lbl}</span><span class="vs-stp"><button data-ve="sjst:${i}|${f}|-1" ${f==='kg'?(auto?'disabled':''):(v<=min?'disabled':'')}>−</button><b class="${auto?'auto':''}">${auto?'auto':kg(v)}</b><button data-ve="sjst:${i}|${f}|1" ${f!=='kg'&&v>=max?'disabled':''}>+</button></span></div>`}
function sjRow(e,i){const o=ST.sj.open===i;
  return rw({left:`<span class="vs-grip">⠿</span>`,m:e.k,title:e.n,sub:`${muscleLabel(e.k)} · ${sjSum(e)}<span class="vs-rowbar">${caps(e.bem,0,'var(--faint)',{cls:'bem'})}${caps(e.w,e.w,dk(e.k))}</span>${e.warn?`<span class="vs-warn">${e.warn}</span>`:''}`,ve:`sjopen:${i}`,cls:o?'open':''})
  +(o?`<div class="vs-sjp">${lab('Szettek')}${sjStep(i,'bem','Bemelegítő',e.bem,0,10)}${sjStep(i,'w','Munka',e.w,1,10)}${lab('Ismétlés')}${sjStep(i,'lo','Tól',e.lo,1,e.hi)}${sjStep(i,'hi','Ig',e.hi,e.lo,100)}${lab('Nehézség és súly')}${sjStep(i,'rir','Tartalék (RIR)',e.rir,0,5)}${sjStep(i,'kg','Kiinduló kg',e.kg)}
    <div class="vs-sjl"><span>Számít a heti volumenbe</span><button class="vs-sw ${e.vol?'on':''}" data-ve="sjvol:${i}" role="switch" aria-checked="${e.vol}" aria-label="Számít a heti volumenbe"></button></div>
    ${acts(vl('Feljebb',`sjmv:${i}|-1`,'',i===0?'disabled':''),vl('Lejjebb',`sjmv:${i}|1`,'',i===ST.sj.ex.length-1?'disabled':''),vl('Kivesz',`sjdel:${i}`,'bad'))}</div>`:'')}
function sajat(id){
  const demo=note(`Állapotok a demóhoz: <button class="fh-lk" data-go="sajat.uj">új, üres</button> · <button class="fh-lk" data-go="sajat">szerkesztés</button> · <button class="fh-lk" data-go="sajat.betolt">betöltés</button> · <button class="fh-lk" data-go="sajat.nincs">nem található</button>`);
  if(id==='betolt')return page('edzes',{title:'Saját edzés',sub:'Betöltés',back:'mai'},card(emptyTank('t-clock','Betöltés…')+demo));
  if(id==='nincs')return page('edzes',{title:'Saját edzés',sub:'Nem található',back:'mai'},card(emptyTank('t-other','Ez a saját edzés nem található — lehet, hogy törölted.',btn('Új összeállítása','sajat.uj','sm'))+demo));
  const mode=id==='uj'?'new':'edit';if(mode!==ST.sjmode){ST.sjmode=mode;ST.sj=mode==='new'?{name:'',open:-1,ex:[]}:SJ0()}
  const sets=ST.sj.ex.reduce((a,e)=>a+e.w,0),ok=ST.sj.name.trim()&&ST.sj.ex.length,dis=ok?'':'disabled style="opacity:.45"';
  return page('edzes',{title:mode==='new'?'Új saját edzés':'Saját edzés',sub:'Összerakod, amit ma csinálni akarsz',back:'mai'},`
  ${hero({lbl:'Saját edzés',verdict:'Rakd össze, amit ma csinálni akarsz.',sub:'Elmentheted későbbre, vagy egyből elindíthatod.',
    body:`${lab('Edzés neve')}<input class="fh-in" id="sj-name" value="${ST.sj.name.replace(/"/g,'&quot;')}" placeholder="pl. Pihenőnapi felső" maxlength="120">${ST.sj.ex.length?pour(ST.sj.ex.map(e=>[e.k,e.w]))+`<div class="vs-lg">${ST.sj.ex.map(e=>`<span><i style="background:${dk(e.k)}"></i>${e.n.split(' ')[0]} <b>${e.w}</b></span>`).join('')}</div>`:`<div class="vs-pour e"><i style="flex:1"><b>üres — ide töltődnek a gyakorlatok</b></i></div>`}`,
    acts:ve('Indítás ma','sjgo','',dis)+ve('Mentés','sjsave','ghost',dis)+(ok?'':`<p class="fh-note" id="sj-hint" style="margin:0;flex-basis:100%;color:#fff">${ST.sj.name.trim()?'Adj hozzá legalább egy gyakorlatot.':'Adj nevet az edzésnek.'}</p>`)})}
  ${sec(1,`Gyakorlatok · ${ST.sj.ex.length} gyakorlat · ${sets} szett`,1)}
  ${card((ST.sj.ex.length?ls(ST.sj.ex.map(sjRow)):emptyTank('t-dumbbell','Még nincs gyakorlat. Add hozzá az elsőt — kap egy jó alapbeállítást, amit utána finomíthatsz.'))
    +acts(lk('+ Gyakorlat hozzáadása',{sheet:'sjpick'}))+demo,{i:1})}`)}
function sjStepApply(i,f,d){const e=ST.sj.ex[i];if(f==='kg'){if(e.kg==null){if(d>0)e.kg=20}else{const n=Math.round((e.kg+d*2.5)*100)/100;e.kg=n<2.5?null:Math.min(999,n)}}else{const lim={bem:[0,10],w:[1,10],lo:[1,e.hi],hi:[e.lo,100],rir:[0,5]}[f];e[f]=Math.min(lim[1],Math.max(lim[0],e[f]+d))}}

/* ── TERHELÉS ── */
function terheles(){const pct=Math.round(LD_DONE/LD_PLAN*100);
  return page('edzes',{title:'Terhelés',sub:'Eddig a héten · 3. hét / 6',tab:'terheles'},`
  ${tank({pct,num:LD_DONE,cap:`szett a ${LD_PLAN}-ból · ${pct}%`,lbl:'Eddig a héten',verdict:'Három hete emelkedik a heti szettszám.',marks:[LD_PLAN,62,41,21],cta:'Izomtérkép',ctaAct:'terkep',h:356})}
  ${sec(1,'A hat hét',1)}
  ${card(`<div class="vs-hg ar">${areaM(WEEK_SETS,{h:140,labels:WEEK_SETS.map((s,i)=>i+1===MESO.week?`${LD_DONE}/${s}`:String(s)),min:20,max:92},[[MESO.week-1,'most','now']])}</div>`
    +note('52 → 61 → 75. A felszín a heti szettszám: az 5. héten tetőzik, a 6. a pihenőhét. Két edzésnapod van még hátra.')+facts([['3','edzés kész'],['2','van hátra'],['1','medál e héten']])+acts(lk('Időpontok',{sheet:'ido'}),lk('A terv oldala','run')),{i:1})}
  ${sec(2,'Izomcsoportonként',2)}
  ${card(ls(LD_GROUPS.map((g,i)=>{const [n,k,done,plan,words]=g;return rw({m:k,cls:done?'':'muted',title:n,sub:words+(plan?`<span class="vs-rowbar">${wlv(clamp(done/plan*100,2,100),dk(k),[],16)}</span>`:''),v:`${done} / ${plan}`,on:done?{sheet:'tgrp',arg:String(i)}:{toast:`${n} — ezen a héten nem volt ilyen munka`},nochev:!done})}))
    +note('Egy edény széle a heti terv. Koppints egy sorra a részletekért.'),{i:2})}
  ${sec(3,'Ami a szetteken kívül volt',3)}
  ${card(ls(rw({icon:'t-volley',title:'Röplabda · 2 alkalom',sub:'180 perc · szombat és kedd este',v:'1 240 <small>kcal</small>'}),rw({icon:'t-steps',title:'Minden mozgásod',sub:'a terem és a sport egymás mellett — de sosem egy számba olvasztva',on:'mozgas'}))
    +note('A számok a már megcsinált edzésekből jönnek. A ma esti, még le nem naplózott edzés nem számít bele.'),{i:3})}
  ${sec(4,'Más nézetek',4)}
  ${card(ls(rw({icon:'t-muscle',title:'Izomtérkép',sub:'hol landolt a heti munka a testeden — elölről és hátulról',on:'terkep'}),rw({icon:'t-dumbbell',title:'Gym · heti munka',sub:'a heti terv szettjei izomcsoportonként, sporttal együtt',on:'gym'})),{i:4})}`)}
function terkep(mode){const planned=mode==='terv',ent=LD_GROUPS.filter(g=>g[2]||planned).map(g=>planned?[g[1],0,clamp(g[3]/29,.3,1)]:[g[1],clamp(g[2]/Math.max(g[3],1),.1,1),1]),cold=LD_GROUPS.filter(g=>!g[2]);
  let n=0;
  return page('edzes',{title:'Izomtérkép',sub:planned?'A heti terv':'Eddig megvolt',back:'terheles'},`
  ${hero({lbl:planned?'A heti terv':'Eddig megvolt',verdict:planned?'Ezt kéri tőled a heti terv.':'Itt landolt eddig a heti munka.',sub:planned?'Minél teltebb egy izom, annál több szettet kér tőle a hét.':'A halvány folyadék a heti terv, a sötét, ami már megvan. A szín az izomcsoporté, nem ítélet.',
    body:`<div style="margin-top:14px">${seg([['Eddig megvolt','terkep',!planned],['A heti terv','terkep.terv',planned]])}</div>${duo(ent,'xl')}
      <div class="vs-lg c">${LD_GROUPS.filter(g=>g[3]).map(g=>`<span><i style="background:${dk(g[1])}"></i>${g[0]} <b>${planned?g[3]:`${g[2]}/${g[3]}`}</b></span>`).join('')}</div>`})}
  ${cold.length?sec(++n,'Amihez nem nyúltál',1)+card(ls(cold.map(g=>rw({cls:'muted',m:g[1],title:g[0],sub:'ezen a héten nem volt ilyen munka'}))),{i:1}):''}
  ${sec(++n,'Mélyebben',2)}
  ${card(ls(rw({icon:'t-pattern',title:'Minden izomjel',sub:'a teljes izomlista, ahogy a rendszer ismeri',on:'jelek'}))+note('A röplabda is dolgoztat izmokat, de azt nem szettben mérjük — a térkép csak a termi munkát színezi.'),{i:2})}`)}
function jelek(){const live=new Set(['chest-mid','chest-upper','back-wide','back-mid','shoulder-side','shoulder-front','shoulder-rear','triceps-medial','biceps-brachialis','quad','ham','calf']);
  return page('edzes',{title:'Minden izomjel',sub:`${MUSCLES.length} izom, 6 régió`,back:'terkep'},`
  ${hero({lbl:'A teljes lista',verdict:`${live.size} izmot dolgoztál meg ezen a héten a ${MUSCLES.length}-ből.`,sub:'Ami színes, azt tényleg megdolgoztad. Amiről a heti napló nem tud, halvány marad — sosem találjuk ki, hogy biztosan dolgozott.',
    body:`<div class="vs-hg">${tubes(REGIONS.map(r=>{const ms=MUSCLES.filter(m=>m.region===r.key),on=ms.filter(m=>live.has(m.key)).length;return {l:r.label,v:`${on}/${ms.length}`,p:on/ms.length*94,m:ms[0].key,c:dk(ms[0].key),t:`${r.label} · ${on} izom a ${ms.length}-ből dolgozott`}}),{h:92,cls:'sm',gap:6})}</div>`})}
  ${REGIONS.map((r,ri)=>sec(ri+1,r.label,ri+1)+card(`<div class="vs-mm">${MUSCLES.filter(m=>m.region===r.key).map(m=>`<div class="${live.has(m.key)?'':'dim'}">${mchp(m.key)}<span>${m.label}</span></div>`).join('')}</div>`,{i:ri+1})).join('')}`)}
function mozgas(){
  return page('edzes',{title:'Minden mozgásod',sub:'Eddig a héten',back:'terheles'},`
  ${hero({lbl:'Eddig a héten',verdict:'A terem és a sport külön edényben.',sub:'Mert az egyik becslés, a másik mért — sosem öntjük össze egy számba.',
    body:`<div class="vs-vs">${tubes([{l:'Terem',ic:'t-dumbbell',v:'186<u> perc</u>',s:'3 edzés · ~1 480 kcal · becslés',p:186/200*94,c:'var(--dom)'},{l:'Sport',ic:'t-volley',v:'180<u> perc</u>',s:'2 alkalom · 1 240 kcal · naplózott',p:180/200*94,c:'var(--ok)'}],{h:132})}</div>`})}
  ${sec(1,'Tételesen',1)}
  ${card(ls([['t-dumbbell','Hétfő · Push','16 szett · becsült 62 perc','~510',510,0],['t-volley','Kedd este · Röplabda','edzés · 90 perc','610',610,1],['t-dumbbell','Kedd · Legs A','12 szett · becsült 48 perc','~420',420,0],['t-dumbbell','Szerda · Legs','19 szett · becsült 76 perc','~550',550,0],['t-volley','Szombat · Röplabda','meccs · 90 perc','630',630,1]].map(r=>rw({icon:r[0],title:r[1],sub:r[2]+`<span class="vs-rowbar">${lv(r[4]/650*100,r[5]?'var(--ok)':'var(--dom)',10)}</span>`,v:`${r[3]} <small>kcal</small>`})))
    +note('Ha egyetlen sport-alkalomnál hiányzik a kalória, az egész összeget elrejtjük — inkább semmit, mint kevesebbet.'),{i:1})}`)}

/* ── LAPOK (alulról) ── */
const TECH={default:[['Beállás','Rögzített lapocka, semleges gerinc, a fogás vállszélességnél kicsit szélesebb.'],['Végrehajtás','Könyök hátra és le, a súlyt lassan engedd (2–3 mp). Fent egy pillanat szünet.'],['Gyakori hibák','Lendületből húzni · a vállat a fülhöz emelni · félúton megállni a negatívban.']]};
const SHEETS={
  why:whySheet,udv:udvSheet,
  menu:(g)=>{const gi=+(g||0),e=EX[gi]||EX[0],d=e.sets.filter(isDone).length;
    return `${shm(e.k,'Gyakorlat',e.n,`${e.sets.length} szett · ${muscleLabel(e.k)}`)}<div class="vs-shg">${caps(e.sets.length,d,dk(e.k),{cur:d<e.sets.length?d:-1,cls:'big'})}<small>${d} / ${e.sets.length} szett kész</small></div>
    ${ls([['t-camera','Videó','a mozdulat bemutatója',{toast:'Demó videó'}],['t-note','Jegyzet','forma-emlékeztető, beállítás…',{sheet:'note'}],['t-weight','Szett hozzáadása',`most ${e.sets.length} szett van`,{sheet:'extra'}],['t-weight','Szett elvétele','',{toast:'Szett elvéve'}],['t-up','Előrébb','',{toast:'Előrébb'}],['t-down','Hátrébb','',{toast:'Hátrébb'}],['t-swap','Gyakorlat cseréje',d?`a ${d} kész szett itt marad, a többi az újé`:'hasonlóra vagy bármi másra',null,`pick:swap:${gi}`],['t-quest','Küldetések','vállalt és elengedett',{sheet:'qb',arg:'0'}],['t-skip','<span style="color:var(--bad)">Gyakorlat kihagyása</span>','',{toast:'Gyakorlat kihagyva'}]].map(([ic,l,h,on,v])=>rw({icon:ic,title:l,sub:h,on,ve:v})))}`},
  recs:(g)=>{const e=EX[+(g||0)]||EX[0],c=dk(e.k);return `${shm(e.k,`${muscleLabel(e.k)} · 24 alkalom`,e.n)}
    ${lab('A múltkori alkalom')}${facts((e.last||'— × — · RIR —').split(/ × | · RIR /).map((v,i)=>[v||'—',['kg','ism','RIR'][i]]))}
    ${lab('Megdönthető rekordok · a szint, hogy ma hol jársz hozzájuk')}
    ${ls(rw({icon:'t-ring',title:'Becsült 1RM',sub:`márc 4. óta áll · becslés, nem mérés<span class="vs-rowbar">${wlv(86,c,[[100,'']],14)}</span>`,v:'96,7 kg'}),rw({icon:'t-weight',title:`Legjobb szett ${st('ma megdöntve','ok')}`,sub:`<span class="vs-rowbar">${wlv(100,'var(--carb)',[[92,'']],14)}</span>`,v:e.goal}),rw({icon:'t-protocol',title:'Legtöbb volumen',sub:`egy alkalmon<span class="vs-rowbar">${wlv(66,c,[[100,'']],14)}</span>`,v:'2 175 kg'}))}
    ${lab('Rep-rekordok')}${ls([['70 kg','12','aug 12.',60],['72,5 kg','10','ma',90],['75 kg','8','aug 28.',70]].map(([k,r,d,w])=>rw({left:rcap(d==='ma'?w:null,d==='ma'?'var(--carb)':c),title:k,sub:d,v:`${r} <small>ism.</small>`})))}`},
  fin:()=>`${sh('Edzés befejezése',`Van még ${TOT()-DONE()} bepipálatlan szetted.`)}
    ${ls(EX.filter(e=>e.sets.some(x=>!isDone(x))).map(e=>{const d=e.sets.filter(isDone).length;return rw({m:e.k,title:e.n,sub:`${e.sets.length-d} szett maradna üresen`,right:caps(e.sets.length,d,dk(e.k))})}))}
    ${note('Az üres kapszulák kihagyott státusszal zárulnak — a riport nem büntet értük.')}
    ${acts(ve(`Befejezem így · ${DONE()} elvégzett · ${TOT()-DONE()} kihagyott`,'finish','','style="flex:1"'))}${acts(`<button class="fh-lk" data-close>Mégse, visszamegyek</button>`)}`,
  pick:()=>{const Pk=ST.pick,sw=Pk.mode==='swap',o=EX[Pk.g];return `${shm(sw?o.k:'t-addex',sw?`Csere · ${o.n}`:'Gyakorlat hozzáadása',sw?'Mire cseréled?':'Mit adunk hozzá?',sw?muscleLabel(o.k):'Pull Day · a lista végére kerül')}
    <input id="pk-q" class="fh-in" type="search" placeholder="Keresés név szerint…" value="${Pk.q}" autocomplete="off"><div id="pk-body">${pickBody()}</div>`},
  scope:()=>{const Pk=ST.pick,sw=Pk.mode==='swap',o=EX[Pk.g],Lb=LIB[Pk.lib],d=sw?o.sets.filter(isDone).length:0,rem=sw?o.sets.length-d:(Lb[2]==='compound'?4:3),noPlan=sw&&o.origin==='ma';
    const sub=sw?(d?`A ${d} kész szett a ${o.n}-nál marad, a hátralévő ${rem} szett az újé.`:`Ugyanott, ugyanúgy ${rem} szett.`):`${rem} szett · ${Lb[2]==='compound'?'8–10':'10–12'} ismétlés — a gyakorlat típusához szabva, utána átírhatod.`;
    return `${sh(sw?'Gyakorlat cseréje':'Gyakorlat hozzáadása',sw?`${o.n} → ${Lb[0]}`:Lb[0],sub)}
    ${ls(rw({m:Lb[1],title:Lb[0],sub:`${muscleLabel(Lb[1])} · ${Lb[3]?`múltkor ${Lb[3]} — innen jön a javaslat`:'még nem csináltad — a súlyt te adod meg'}`,right:`<span class="vs-rr">${sw&&d?caps(d,d,dk(o.k)):''}${caps(rem,0,dk(Lb[1]))}</span>`}))}
    ${lab('Meddig érvényes?')}${ls(rw({icon:'t-calendar',title:'Csak ma',sub:'a mai edzésre. Jövő héten a régi terv jön.',ve:'scope:ma'}),noPlan?'':rw({icon:'t-peak',title:'Mezociklusra is',sub:`a ${MESO.name} hátralévő ${MESO.of-MESO.week} hetében is. A mentett sablonod nem változik.`,ve:'scope:meso'}))}
    ${noPlan?note('Ez a gyakorlat ma került be, nincs a mezociklus tervében, ezért csak mára cserélhető.'):''}`},
  set:(a)=>{const [i,j]=(a||'0.0').split('.').map(Number),e=EX[i]||EX[0],s=e.sets[j]||e.sets[0];return `${shm(e.k,`Szett ${j+1} · ${e.n}`,'Szett szerkesztése')}
    ${ls(stp('Súly · kg',kg(isDone(s)?s[0]:s[1])),stp('Ismétlés',isDone(s)?s[1]:s[2]))}${blk('RIR',chips(['0','1','2','3','4+'],Math.min(4,isDone(s)?s[2]:s[3])))}
    ${lab('Megjegyzés ehhez a szetthez (opcionális)')}<div class="fh-in vs-fld ph"><span>pl. utolsó ismétlés kemény</span>${bub('t-mic',{s:30})}</div>${two('Mentés')}${acts(vl('Szett törlése','save','bad'))}`},
  rp:(g)=>{const e=EX[+(g||0)]||EX[0];return `${shm(e.k,'Szett kész · hogy ment?',e.n,'a pihenő ezután indul · 90 mp')}
    ${[['Pumpa · érzed?',['Semmi','Enyhe','Jó','Brutális'],2],['Ízületi fájdalom',['Nincs','Enyhe','Erős'],0],['Akarunk még?',['Kevés volt','Pont jó','Sok volt'],1]].map(([q,o,s])=>blk(q,chips(o,s))).join('')}
    ${acts(ve('Mentés · pihenő indul','rest','','style="flex:1"'),vl('Hagyjuk, csak a pihenő','rest'))}`},
  extra:()=>`${shm('t-weight','Extra szett hozzáadva','A tervbe is felvegyük?','Most 5 szett.')}<div class="vs-shg">${caps(5,0,'var(--dom)',{cur:4,cls:'big'})}<small>az ötödik az új</small></div>${acts(ve('Csak ma','save','','style="flex:1"'),vl('Minden hétre','save'))}`,
  note:()=>`${shm('t-note','Gyakorlat-jegyzet','Jegyzet a gyakorlathoz','Forma-emlékeztető, beállítás, fájdalom-jelzés…')}<div class="fh-in vs-fld tall"><span>A pad a harmadik fokon, a könyök végig zárva maradjon.</span>${bub('t-mic',{s:30})}</div>${two('Mentés')}`,
  wnote:()=>`${shm('t-note','Edzés-jegyzet','Hogy ment?','Nem kötelező — később is hozzáírhatod.')}<div class="fh-in vs-fld tall"><span>Ma a váll végig nyugton volt, a sorok tiszták…</span>${bub('t-mic',{s:30})}</div>${two('Mentés')}`,
  tech:(g)=>{const e=EX[+(g||0)]||EX[0];return `${shm(e.k,'Technika',e.n,muscleLabel(e.k))}${TECH.default.map(([h,t],i)=>`<div class="vs-tech"><b>${i+1}</b><div><h2>${h}</h2><p class="fh-txt">${t}</p></div></div>`).join('')}
    ${lab('Tovább')}${ls(rw({icon:'t-camera',title:'Demó videó',on:{toast:'Demó videó'}}),rw({icon:'t-chat',title:'Kérdezd a csapatot',sub:'miért pont ez a fogás?',on:{toast:'Mezo · Chat'}}))}`},
  qb:(g)=>{const i=+(g||0),c=CHAL[i];return `${shm(QICON[c.type],`Küldetés · ${c.acc?'vállalva':'elengedve'}`,c.type,c.ex)}
    <p class="fh-big" style="font-size:30px;margin-top:6px">${c.target}</p>${lab(`Biztosság · ${c.conf} · alacsony kockázat`)}${level(confPct(c.conf),{c:'var(--carb)',h:22,label:c.conf==='tanulom'?'még tanulom':c.conf+' biztos'})}<p class="fh-txt vs-sub" style="margin-top:10px">${c.why}</p>
    ${acts(ve(c.acc?'Elengedem':'Visszaveszem',`qtoggle:${i}`,'','style="flex:1"'))}${note(c.acc?'Büntetés nélkül — elengedve nem számít a zárásnál. Bármikor visszaveheted.':'Most nem számít bele a zárásba. Ha mégis nekifutsz, vedd vissza.')}`},
  info:()=>`${shm('t-info','Terhelés','Miből áll össze a szám?')}${txt('A heti terv minden izomcsoportra kiír valahány szettet. A szám azt mutatja, ezekből mennyi ment már le a héten. A sport és a futás külön látszik — becslés, a szettekbe nem számít bele.')}<div class="vs-rowbar" style="margin-top:14px">${level(62,{h:22,label:'58 szett megvan',val:'94'})}</div>`,
  grp:(g)=>{const [k,l,d,p,w]=GR[+(g||0)];return `${shm(k,'Izomcsoport · ezen a héten',l,`${d} / ${p} szett`)}<div class="vs-rowbar">${wlv(clamp(d/p*100/1.15,d?3:0,100),dk(k),[[100/1.15,'','terv']],20)}</div>
    <div class="vl" style="margin-top:22px">${rw({title:`${l} (fej 1)`,sub:'6 szett · 8–10 ismétlés · 2×/hét — a heti tervből',right:caps(6,Math.min(6,d),dk(k))})}${rw({title:`${l} (fej 2)`,sub:'4 szett · 10–12 ismétlés · 2×/hét — a heti tervből',right:caps(4,clamp(d-6,0,4),dk(k))})}${rw({icon:'t-volley',title:'Röpi',sub:'becslés — a szettekbe nem számít bele',right:drops(2)})}${rw({icon:'t-run',title:'Futás',sub:'becslés — a szettekbe nem számít bele',right:drops(1)})}</div>${box('t-coin','+~40 XP',`<p>${w}</p>`,'var(--carb)')}`},
  tgrp:(gi)=>{const [n,k,done,plan,words]=LD_GROUPS[+(gi||0)];return `${shm(k,'Izomcsoport',n,`${done} szett a ${plan}-ból, eddig a héten`)}<div class="vs-rowbar">${wlv(clamp(done/plan*100,2,100),dk(k),[],20)}</div>
    <div class="vl" style="margin-top:14px">${[['Hétfő · Push',6,'het'],['Szerda · Legs',5,'sze'],['Csütörtök · Pull',3,'csu']].map(p=>rw({icon:'t-dumbbell',title:p[0],v:`${p[1]} <small>szett</small>`,right:caps(p[1],p[1],dk(k)),on:`nap.${p[2]}`})).join('')}</div>${box('t-record',`Tapasztalat · +${done*4} XP`,`<p>${words} A heti terved ${plan} szettet kér ebből az izomcsoportból.</p>`,'var(--carb)')}`},
  tdel:()=>`${shm('t-trash','Törlés','Törlöd a sablont?','Hypertrophy 04 · Tavasz. A korábbi futamok és a riportjaik megmaradnak — csak a recept tűnik el a listádból.')}${acts(ve('Törlés','toastclose:Törölve','bad','style="flex:1"'),`<button class="fh-lk" data-close>Mégsem</button>`)}`,
  close:()=>`${shm('t-coin','Lezárás','Edzésterv lezárása','Lezárás után riportot kapsz róla: mennyit csináltál meg belőle, mi változott erőben, és hogyan mozdultak az izmaid.')}
    <div class="vs-shg">${caps(6,2,'var(--dom)',{cur:2,cls:'big'})}<small>most a 3. hétnél tartasz a 6-ból</small></div>
    ${lab('Hogy érezted magad benne?')}${chips(['Nagyon jól','Jól','Vegyesen','Nehezen'],1)}
    ${lab('Jegyzet (nem kötelező)')}<div class="fh-in vs-fld ph"><span>Mit vinnél tovább a következőbe?</span>${bub('t-mic',{s:30})}</div>${acts(`<button class="btn" style="flex:1" data-go="riport">Lezárás</button>`,`<button class="fh-lk" data-close>Mégsem</button>`)}`,
  start:()=>`${shm('t-play','Futam indítása','Hypertrophy 04 · Tavasz','6 hét · 5 edzésnap hetente. A futó terved ettől nem áll le — ez a sorba kerül mögé.')}${queue()}
    ${lab('Mikor kezdődjön?')}${chips(['Jún 16','Jún 23','Más dátum'],0)}${acts(ve('Indítás','toastclose:Elindítva — a Következnek listába került','','style="flex:1"'),`<button class="fh-lk" data-close>Mégsem</button>`)}`,
  ido:()=>`${shm('t-calendar','Edzőtermi időpontok','Mikor érsz rá?','Az állandó időpontjaidat te állítod be — ezekhez a terv nem nyúl.')}${ls([['Hétfő','18:00'],['Kedd','18:00'],['Szerda','17:30'],['Csütörtök','18:00'],['Péntek','17:00']].map(r=>rw({icon:'t-clock',title:r[0],v:r[1]})))}${acts(`<button class="btn" style="flex:1" data-close>Rendben</button>`)}`,
  sportlog:()=>`${shm('t-volley','Sport log · röpi','Hogy ment?','Az idő, a terhelés és a saját élményed.')}${ls(stp('Idő · perc',90),stp('Szettek · összesen',5))}
    ${blk('RPE · összesített nehézség',scale(7))}${blk('Váll-terhelés',scale(6))}
    ${lab('Jegyzet')}<div class="fh-in vs-fld"><span>Jól ment a nyitás, a harmadik szettben kicsit húzott a váll.</span>${bub('t-mic',{s:30})}</div>${two('Mentés')}`,
  runlog:()=>`${shm('t-run','Futás log · sprint-intervallum','Hogy ment?')}${ivl(IV_SPRINT)}${ls(stp('Teljesített körök',6))}${blk('RPE · érzékelt nehézség',scale(9))}<div class="vl" style="margin-top:14px">${stp('Pulzus-megnyugvás · mp',42)}</div>
    ${lab('Jegyzet')}<div class="fh-in vs-fld"><span>Az utolsó két kör nehéz volt, de tartottam az iramot.</span>${bub('t-mic',{s:30})}</div>${two('Mentés')}`,
  blkmenu:()=>`${shm('t-run','Futóterv','Robbanékonyság 01')}${ls(rw({icon:'t-repeat',title:'Duplikálás',ve:'toastclose:Duplikálva'}),rw({icon:'t-trash',title:'<span style="color:var(--bad)">Törlés</span>',ve:'toastclose:Törölve'}))}`,
  custom:()=>`${shm('t-dumbbell','Saját edzés','Mit nyomunk ma?')}${ls(rw({icon:'t-dumbbell',title:'Pihenőnapi felső',sub:`3 gyakorlat · 10 szett · koppintásra indul<span class="vs-rowbar">${caps(4,0,dk('chest-mid'))} ${caps(3,0,dk('back-wide'))} ${caps(3,0,dk('shoulder-side'))}</span>`,right:`<button class="fh-lk" data-go="sajat">szerkesztés</button>`,on:'session.uj'}))}${acts(btn('Új összeállítása','sajat.uj','sm'))}`,
  sjpick:()=>`${shm('t-addex','Gyakorlat hozzáadása','Mit teszünk bele?','Koppints egyre — alapbeállítással kerül be, és rögtön kinyílik.')}
    ${ls(LIB.map((Lb,i)=>[Lb,i]).filter(([Lb])=>!ST.sj.ex.some(e=>e.n===Lb[0])).slice(0,8).map(([[n,k,t,last],i])=>rw({m:k,title:n,sub:`${muscleLabel(k)} · ${t==='compound'?'összetett':'izolált'}${last?` · múltkor ${last}`:' · még nem csináltad'}`,right:bub('t-addex',{s:30}),ve:`sjadd:${i}`,nochev:true})))}`
};
const resheet=(name,arg)=>openSheet(SHEETS[name](arg));

/* ── interakciók (a shell data-go/-sheet/-toast/-close mellé) ── */
const mine=()=>F.D==='edzes'&&$('#phone')?.dataset.v==='feher';
document.addEventListener('click',e=>{
  if(!mine())return;const t=e.target,ez=t.closest('[data-ve]');if(!ez)return;
  const inner=t.closest('[data-toast],[data-go],[data-sheet],[data-close]');if(inner&&inner!==ez&&ez.contains(inner))return;
  e.preventDefault();const [cmd,...rest]=ez.dataset.ve.split(':'),a=rest.join(':');
  switch(cmd){
    case 'skip':ST.sk[a]={cat:'NONE',text:''};ST.skord.push(a);ST.whyk=a;repaint();resheet('why');toast('Kihagyva — bármikor visszavonhatod');break;
    case 'skwhy':ST.whyk=a;resheet('why');break;
    case 'skundo':delete ST.sk[a];ST.skord=ST.skord.filter(x=>x!==a);repaint();toast('Visszavonva — újra a tervben');break;
    case 'why':{const k=ST.whyk;ST.sk[k].cat=a;if(a==='OTHER')ST.sk[k].text='Családi program jött közbe';if(ST.km&&ST.km.from===k){if(serious(k))ST.km.cat=a;else ST.km=null}resheet('why');repaint();break}
    case 'whydone':closeSheet();repaint();if(a==='1')toast(`Megjegyeztem · ${skLabel(ST.whyk)}`);break;
    case 'kmdur':{const k=ST.whyk,retro=k==='sze'||k==='run';ST.km={cat:ST.sk[k].cat,dur:+a,day:retro?2:1,released:false,asked:false,from:k};ST.cb=null;resheet('why');repaint();
      setTimeout(()=>{if(!retro&&ST.km&&ST.km.from===k){delete ST.sk[k];ST.skord=ST.skord.filter(x=>x!==k)}closeSheet();if(mine()&&F.R==='mai')repaint();toast('Kímélő mód bekapcsolva')},1400);break}
    case 'kmrel':ST.km.released=a==='1';repaint();toast(ST.km.released?'Rendben — ma edzel, holnaptól újra kímélő mód':'Visszaállítva · ma pihensz');break;
    case 'kmnotyet':ST.km.asked=true;repaint();toast(`Rendben — holnap újra rákérdezek. ${CARE[ST.km.cat]}`);break;
    case 'kmback':if(ST.km.day===1){ST.km=null;repaint();toast('Kímélő mód befejezve');break}ST.udv=ST.km.day-1<=2?0:ST.km.day-1<=9?1:2;resheet('udv');break;
    case 'udvt':ST.udv=+a;resheet('udv');break;
    case 'udv':closeSheet();if(a==='1'){ST.cb={n:1,of:ST.udv===0?1:2,waived:false,prev:ST.km};ST.km=null;repaint();toast('Üdv újra! · könnyített visszatérés')}else toast('Rendben — marad a kímélő mód');break;
    case 'cbwaive':ST.cb.waived=true;repaint();toast('Könnyítés kikapcsolva · teljes edzés');break;
    case 'cbundo':ST.km=ST.cb.prev;ST.cb=null;repaint();toast('Visszaállítva · marad a kímélő mód');break;
    case 'ready':ST.ready=a==='lighten'?'done':a==='keep'?'gone':'offer';repaint();toast(a==='lighten'?'Könnyítve — ma egy fokkal lejjebb':a==='keep'?'Rendben, marad a terv':'Visszaállítva az eredeti terv');break;
    case 'btick':ST.tick[+a]=!ST.tick[+a];repaint();break;
    case 'bstart':{CHAL.forEach((c,i)=>{c.acc=ST.tick[i];c.rel=false});const n=ST.tick.filter(Boolean).length;ST.tick=null;ST.day='run';F.go('session.uj');toast(n?`Indulunk — ${n} küldetéssel`:'Indulunk — ma küldetés nélkül');break}
    case 'qtoggle':{const c=CHAL[+a];c.acc=!c.acc;c.rel=!c.acc;closeSheet();repaint();toast(c.acc?'Visszavéve — hajrá!':'Elengedve — semmi gond');break}
    case 'focus':ST.focus=+a;repaint();$('#phone .scroll')?.scrollTo(0,0);break;
    case 'rest':closeSheet();startRest();break;
    case 'reststop':stopRest();break;
    case 'plus15':ST.restLeft+=15;ST.restTotal+=15;repaint();break;
    case 'pick':{const [mode,g]=a.split(':');ST.pick={mode,g:+(g||0),f:'all',q:'',lib:0};resheet('pick');break}
    case 'pf':ST.pick.f=a;$('#pk-body').innerHTML=pickBody();break;
    case 'lib':ST.pick.lib=+a;resheet('scope');break;
    case 'scope':{const sw=ST.pick.mode==='swap',nm=LIB[ST.pick.lib][0];applyPick(a);ST.focus=sw?EX.findIndex(x=>x.n===nm):null;if(sw)repaint();break}
    case 'finish':ST.day='done';closeSheet();F.go('cer');break;
    case 'cerdone':ST.day='done';F.go('mai.kesz');break;
    case 'save':closeSheet();toast('Mentve');break;
    case 'toastclose':closeSheet();toast(a);break;
    case 'sportsave':toast('Naplózva · 90 perc');F.go('sport.naplo');break;
    case 'chip':{const p=ez.parentNode;p.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===ez));break}
    case 'multi':ez.classList.toggle('on');break;
    case 'scale':{const n=+a;ez.parentNode.querySelectorAll('button').forEach((b,i)=>{b.className=i+1<n?'f':i+1===n?'a':''});break}
    case 'cmp':ST.cmp=!ST.cmp;ST.cmpSel=[];repaint();break;
    case 'cmpsel':{const i=+a,at=ST.cmpSel.indexOf(i);if(at>=0)ST.cmpSel.splice(at,1);else if(ST.cmpSel.length<2)ST.cmpSel.push(i);else ST.cmpSel=[ST.cmpSel[1],i];repaint();break}
    case 'sjopen':ST.sj.open=ST.sj.open===+a?-1:+a;repaint();break;
    case 'sjst':{const [i,f,d]=a.split('|');sjStepApply(+i,f,+d);repaint();break}
    case 'sjvol':ST.sj.ex[+a].vol=!ST.sj.ex[+a].vol;repaint();break;
    case 'sjmv':{const [i,d]=a.split('|').map(Number),j=i+d;[ST.sj.ex[i],ST.sj.ex[j]]=[ST.sj.ex[j],ST.sj.ex[i]];ST.sj.open=j;repaint();break}
    case 'sjdel':{const n=ST.sj.ex[+a].n;ST.sj.ex.splice(+a,1);ST.sj.open=-1;repaint();toast(`${n} kivéve`);break}
    case 'sjadd':{const [n,k,tp]=LIB[+a],c=tp==='compound';ST.sj.ex.push({n,k,bem:c?2:1,w:c?4:3,lo:c?8:10,hi:c?10:15,rir:c?1:2,kg:null,vol:true});ST.sj.open=ST.sj.ex.length-1;closeSheet();repaint();toast(`${n} hozzáadva`);break}
    case 'sjsave':toast('Elmentve — megtalálod a „Saját edzés” lapon');F.go('mai');break;
    case 'sjgo':toast('Elmentve, indul az edzés');ST.day='run';F.go('session.uj');break;
    case 'wzw':ST.wz=+a;repaint();break;
  }
});
document.addEventListener('input',e=>{if(!mine())return;
  if(e.target.id==='pk-q'){ST.pick.q=e.target.value;$('#pk-body').innerHTML=pickBody()}
  if(e.target.id==='sj-name'){ST.sj.name=e.target.value;const ok=ST.sj.name.trim()&&ST.sj.ex.length;document.querySelectorAll('[data-ve="sjsave"],[data-ve="sjgo"]').forEach(b=>{b.disabled=!ok;b.style.opacity=ok?'':'.45'});const h=$('#sj-hint');if(ok)h?.remove();else if(h)h.textContent=ST.sj.name.trim()?'Adj hozzá legalább egy gyakorlatot.':'Adj nevet az edzésnek.'}});

const ROUTES={mai,indulas,session,review,gym,sport:(a)=>sport(a||'terv'),sportlog,futas:(a)=>futas(a||'het'),futasterv,medals,exercises,exercise,cer,terv,run,nap,napszerk,het,izom,konyvtar,futamok,riport,osszevetes,sablonok,sablon,sablonszerk,ujterv,sajat,terheles,terkep,jelek,mozgas};
const CSS=`
/* MuscleChip: the same colours, made readable on white (tinted disc, coloured ring, deeper shape) */
${P} .mchp{background:radial-gradient(circle at 35% 28%,#fff,color-mix(in srgb,var(--c) 40%,#fff));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c) 75%,#fff),0 5px 10px -6px color-mix(in srgb,var(--c) 75%,var(--ink))}
${P} .mchp svg>g:first-child{opacity:.55}
${P} .mchp svg>g+g{fill:color-mix(in srgb,var(--c) 70%,var(--ink));stroke:color-mix(in srgb,var(--c) 70%,var(--ink));filter:none!important}
${P} .fh-chips .mchp,${P} .vs-tday .mchp{box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c) 75%,#fff)}
${P} .ds i svg.ic.td{width:13px;height:13px}
${P} .fh-row.tap{cursor:pointer}${P} .fh-row.muted{opacity:.55}${P} .fh-row .chev{transition:transform .2s}${P} .fh-row.open>.chev{transform:rotate(90deg)}
${P} .fh-row strong .st{vertical-align:1px;margin-left:4px}${P} .fh-step small .st{margin-left:4px;vertical-align:1px}
${P} .vl>.fh-row:first-child,${P} .vl>.fh-step:first-child{border-top:0;padding-top:0}
${P} .fh-lk.bad{color:var(--bad)}${P} .fh-lk:disabled{opacity:.35;cursor:default}${P} .btn.bad{background:var(--bad);box-shadow:0 10px 20px -10px var(--bad)}${P} .btn:disabled{cursor:default}
${P} .fh-hero s,${P} .fh-step s{color:var(--faint)}
${P} .vs-in{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:0 0 12px 50px;font-size:12.5px;color:var(--sub);line-height:1.4}
${P} .vs-in.col{display:block}${P} .vs-in.col>div:last-child{display:flex;gap:16px;margin-top:8px}${P} .vs-in.col .vs-box{margin-top:0;background:var(--page);box-shadow:none}
${P} .vs-in svg.ic{width:18px;height:18px;display:inline-block;vertical-align:-4px}
${P} .vs-box{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.78);box-shadow:inset 0 0 0 1px rgba(15,30,51,.07);font-size:13.5px;line-height:1.4}
${P} .vs-box>svg.ic{width:28px;height:28px}${P} .vs-box b{font-weight:650}${P} .vs-box>div>b{display:block}${P} .vs-box p{color:var(--sub);margin-top:2px;font-size:13px}${P} .sheet .vs-box{background:var(--page);box-shadow:none}
${P} .vs-cb{margin-top:10px}${P} .vs-cb div{display:flex;justify-content:space-between;gap:10px;padding:6px 2px;font-size:13px;border-top:1px solid var(--hair)}${P} .vs-cb div:first-child{border-top:0}${P} .vs-cb span:last-child{white-space:nowrap;color:var(--sub)}${P} .vs-cb b{color:var(--ink)}
${P} .vs-sh{display:flex;align-items:center;gap:10px;margin:4px 0 8px}${P} .vs-sh span{flex:1;min-width:0;font-size:12px;font-weight:650;letter-spacing:.3px;color:color-mix(in srgb,var(--dom) 75%,var(--ink))}${P} .vs-sh button{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--page);font-size:18px;color:var(--sub);flex:0 0 auto}
${P} .vs-sub{color:var(--sub);font-size:13.5px}
${P} .vs-mh{display:flex;gap:12px;align-items:center;margin-bottom:6px}${P} .vs-mh h2{margin:0}${P} .vs-mh>svg.ic{width:40px;height:40px}${P} .vs-mh>div{min-width:0}
${P} .vs-seg{margin:14px 14px 0}${P} .vs-seg .fh-seg{margin:0;background:rgba(15,30,51,.07)}${P} .fh-seg button{min-width:0;overflow:hidden;text-overflow:ellipsis}
${P} .vs-tk{width:28px;height:28px;border-radius:50%;border:2px solid var(--faint);display:grid;place-items:center;flex:0 0 auto;color:#fff;font-size:13px}${P} .vs-tk svg{opacity:0;width:16px;height:16px;stroke-width:2.6}${P} .vs-tk.on{background:var(--dom);border-color:var(--dom)}${P} .vs-tk.on svg{opacity:1}
${P} .vs-stk{display:inline-flex;flex:0 0 auto}${P} .vs-stk .mchp+.mchp{margin-left:-13px}${P} .vs-stk .mchp{outline:2px solid #fff}
${P} .vs-ft{display:flex;justify-content:space-between;font-size:11.5px;color:var(--faint);margin-top:4px}
${P} .vs-fld{color:var(--ink);line-height:1.45;display:flex;gap:8px;justify-content:space-between;align-items:center}${P} .vs-fld.ph{color:var(--faint)}${P} .vs-fld.tall{min-height:84px;align-items:flex-start}${P} .vs-fld svg.ic{width:22px;height:22px}
${P} .vs-stp{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}${P} .vs-stp button{width:34px;height:34px;border-radius:11px;background:var(--page);display:grid;place-items:center;font-size:18px;font-weight:600}${P} .vs-stp button:disabled{opacity:.35}
${P} .vs-stp b{min-width:40px;text-align:center;font-family:var(--disp);font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}${P} .vs-stp b.auto{font-family:var(--ff);font-size:12px;color:var(--faint)}
${P} .vs-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}${P} .vs-opts button{display:flex;align-items:center;gap:8px;padding:10px;border-radius:14px;background:var(--page);font-size:13px;font-weight:600;line-height:1.2;min-width:0}${P} .vs-opts button.on{background:color-mix(in srgb,var(--dom) 12%,#fff);box-shadow:inset 0 0 0 2px var(--dom)}${P} .vs-opts svg.ic{width:28px;height:28px}
/* edzés közben: a szett-tábla (három mező + pipa), a cél és a múlt hét a tábla fölött */
${P} .vs-tg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}${P} .vs-tg span{display:block;min-width:0;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.78);box-shadow:inset 0 0 0 1px rgba(15,30,51,.07)}${P} .vs-tg span:only-child{grid-column:1/-1}
${P} .vs-tg small{display:block;font-size:11.5px;font-weight:650;color:var(--sub)}${P} .vs-tg b{display:block;font-family:var(--disp);font-size:16px;font-weight:700;letter-spacing:-.3px;margin-top:2px}${P} .vs-tg i{display:block;font-style:normal;font-size:12px;font-weight:650;color:var(--ok);margin-top:1px}
${P} .vs-tg .t{background:#fff;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dom) 45%,#fff)}
${P} .vs-ql{display:flex;align-items:center;gap:8px;width:100%;margin-top:8px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.78);box-shadow:inset 0 0 0 1px rgba(15,30,51,.07);font-size:13px;font-weight:600}${P} .vs-ql svg.ic.td{width:22px;height:22px}${P} .vs-ql span{flex:1;min-width:0}${P} .vs-ql .chev{width:16px;height:16px;color:var(--faint)}
${P} .vs-xl{font-size:12.5px;color:var(--sub);margin-top:8px;line-height:1.4}
${P} .vs-sets{display:grid;grid-template-columns:22px 1fr 1fr 1fr 44px;gap:8px;align-items:center;margin-top:14px;padding:12px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 1px rgba(15,30,51,.07);font-variant-numeric:tabular-nums}
${P} .vs-sets .h{font-size:11px;font-weight:650;color:var(--sub);text-align:center}
${P} .vs-sets .n{font-family:var(--disp);font-size:14px;font-weight:700;color:var(--faint);text-align:center}${P} .vs-sets .n.now{color:var(--dom)}
${P} .vs-sets .v{text-align:center;font-family:var(--disp);font-size:17px;font-weight:700;padding:9px 0;border-radius:11px}${P} .vs-sets .v.d{background:color-mix(in srgb,var(--ok) 10%,#fff)}${P} .vs-sets .v.u{color:var(--faint);background:var(--page)}
${P} .vs-sets .vin{width:100%;min-width:0;text-align:center;font-family:var(--disp);font-size:18px;font-weight:800;color:var(--ink);padding:7px 0;border-radius:11px;border:2px solid var(--dom);background:#fff;-moz-appearance:textfield}
${P} .vs-sets .tk{width:44px;height:42px;border-radius:13px;display:grid;place-items:center;color:#fff;background:var(--dom);box-shadow:0 10px 16px -10px var(--dom)}${P} .vs-sets .tk svg{stroke-width:2.8}
${P} .vs-sets .vd{width:44px;height:40px;display:grid;place-items:center}${P} .vs-sets .vd svg.ic.td{width:26px;height:26px}
${P} .vs-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}${P} .vs-tools.top{margin:2px 0 12px}${P} .vs-tools button{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:12px;background:#fff;box-shadow:inset 0 0 0 1px rgba(15,30,51,.08);font-size:13px;font-weight:600}${P} .vs-tools svg.ic{width:20px;height:20px}
${P} .vs-rest{display:flex;align-items:center;gap:10px;flex:1;min-width:0}${P} .vs-rest .g{min-width:0}${P} .vs-rest strong{display:block;font-family:var(--disp);font-size:24px;font-weight:800;letter-spacing:-.6px;line-height:1;font-variant-numeric:tabular-nums}${P} .vs-rest small{display:block;font-size:11.5px;color:var(--sub);margin-top:2px;line-height:1.25}
${P} .vs-fcol{display:flex;flex-direction:column;gap:10px;align-items:center;flex:1;min-width:0}${P} .vs-fcol .btn{width:100%}
/* ceremónia */
${P} .vs-cer{text-align:center}${P} .vs-cer .verdict{font-size:30px;margin-bottom:0}
${P} .vs-cstars{display:flex;justify-content:center;gap:6px;margin:14px 0 14px}${P} .vs-cstars i{position:relative;width:46px;height:46px;display:block}${P} .vs-cstars i svg.ic{position:absolute;inset:0;width:100%;height:100%}
${P} .vs-cstars i .on,${P} .vs-cstars i .half{opacity:0;transform:scale(.6);transition:.35s var(--ease)}${P} .vs-cstars i.is-lit .on,${P} .vs-cstars i.is-half .half{opacity:1;transform:none}${P} .vs-cstars i.is-lit .off,${P} .vs-cstars i.is-half .off,${P} .vs-cstars i.is-lit .half{opacity:0}
${P} #cerroot .vs-cres,${P} #cerroot .vs-ccard{opacity:0;transform:translateY(8px);transition:.5s var(--ease)}${P} #cerroot.b1 .vs-cres,${P} #cerroot.b2 .vs-ccard{opacity:1;transform:none}
body.still ${P} #cerroot .vs-cres,body.still ${P} #cerroot .vs-ccard,body.still ${P} .vs-cstars i svg{transition:none}
${P} .vs-gold{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--carb) 55%,#fff),0 14px 30px -20px var(--carb)}
${P} .vs-ms{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13.5px;font-weight:600}${P} .mstars{display:inline-flex;gap:2px}${P} .mstars svg.ic{width:18px;height:18px}
/* listák, szerkesztők, grafikák */
${P} .vs-day{width:34px;flex:0 0 auto;font-family:var(--disp);font-size:14px;font-weight:700;color:var(--sub)}
${P} .vs-log{padding:12px 0;border-top:1px solid var(--hair)}${P} .vs-log:first-child{border-top:0;padding-top:0}${P} .vs-log .fh-why{margin-top:8px}
${P} .vs-warn{display:block;margin-top:3px;color:var(--warn);font-weight:600}
${P} .vs-grip{color:var(--faint);font-size:16px;flex:0 0 auto}
${P} .vs-rb{width:34px;height:34px;border-radius:11px;background:var(--page);display:grid;place-items:center;font-size:17px;flex:0 0 auto}
${P} .vs-cmp{display:grid;grid-template-columns:minmax(0,1.3fr) 1fr 1fr}${P} .vs-cmp>*{padding:11px 4px;border-top:1px solid var(--hair);font-size:13.5px;min-width:0}${P} .vs-cmp>*:nth-child(-n+3){border-top:0;padding-top:0}
${P} .vs-cmp b{text-align:right;font-family:var(--disp);font-weight:700;font-variant-numeric:tabular-nums}${P} .vs-cmp b.h{font-family:var(--ff);font-size:12px;font-weight:650;color:var(--sub)}
${P} .vs-tday{padding:12px 0;border-top:1px solid var(--hair)}${P} .vs-tday:first-child{border-top:0;padding-top:0}${P} .vs-tday:last-child{padding-bottom:0}${P} .vs-tday.muted{opacity:.55}
${P} .vs-tday .dh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:14px}${P} .vs-tday .dh b{font-weight:650}${P} .vs-tday .dh span{font-size:12.5px;color:var(--sub);white-space:nowrap}
${P} .vs-tday .ex{display:flex;align-items:center;gap:8px;padding-top:8px;font-size:13px}${P} .vs-tday .ex .g{flex:1;min-width:0}${P} .vs-tday .ex .v{font-size:12px;color:var(--sub);white-space:nowrap}${P} .vs-tday .ex .mchp{width:24px;height:24px}
${P} .vs-sjl{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;font-size:13.5px}
${P} .vs-sjp{padding:0 0 12px 12px;margin:0 0 6px 14px;border-left:3px solid color-mix(in srgb,var(--dom) 35%,#fff)}${P} .vs-sjp .fh-lab:first-child{margin-top:0}
${P} .vs-sw{width:44px;height:26px;border-radius:13px;background:rgba(15,30,51,.16);position:relative;flex:0 0 auto}${P} .vs-sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 2px 4px rgba(15,30,51,.25)}${P} .vs-sw.on{background:var(--dom)}${P} .vs-sw.on::after{left:21px}
${P} .vs-mm{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 6px}${P} .vs-mm div{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;font-weight:550;text-align:center;line-height:1.25}${P} .vs-mm div.dim{opacity:.35}
${P} .vs-tech{display:flex;gap:12px;margin-top:14px}${P} .vs-tech>b{width:26px;height:26px;border-radius:50%;background:var(--dom);color:#fff;display:grid;place-items:center;font-size:13px;flex:0 0 auto}${P} .vs-tech h2{font-size:17px;margin-bottom:4px}
${P} .fh-hero .fh-facts{position:relative}
/* ═══ FOLYADÉK — az Edzés saját rajzai ═══ */
${Q} .mchp{background:radial-gradient(circle at 30% 24%,#fff 0 14%,color-mix(in srgb,var(--c) 22%,#fff) 60%,color-mix(in srgb,var(--c) 46%,#fff));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c) 82%,#fff),inset 0 -6px 8px -6px color-mix(in srgb,var(--c) 70%,transparent),0 8px 12px -8px color-mix(in srgb,var(--c) 80%,rgba(10,42,60,.6))}
${Q} .mchp svg>g:first-child{opacity:.5}
${Q} .mchp svg>g+g{fill:color-mix(in srgb,var(--c) 66%,#0A2A3C);stroke:color-mix(in srgb,var(--c) 66%,#0A2A3C);filter:none!important}
${Q} .mchp.sm{width:32px;height:32px}
${Q} .fh-chips .mchp{width:24px;height:24px}
${Q} .fh-chips span.tx{padding:5px 11px}${Q} .fh-chips span.ic{padding:2px 11px 2px 2px}${Q} .fh-chips span.ic .fb svg.ic{width:74%;height:74%}${Q} .fh-chips span button{color:var(--sub);font-weight:700;margin-left:2px}${Q} .fh-chips span.add{background:none;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.14)}
${Q} .fh-row .v small{color:var(--sub)}
${Q} .fh-row .fl-level{width:64px;flex:0 0 auto}
${Q} .fh-mus .fl-level,${Q} .fh-mus .vs-split{width:84px;flex:0 0 auto}${Q} .fh-mus .l small{display:block;font-size:11px;font-weight:500;color:var(--sub)}${Q} .fh-mus .mstars{flex:0 0 auto}
${Q} .fh-pair button{align-items:flex-start;border-radius:22px}
${Q} .fh-hero .fh-acts .fh-note{color:#fff}
${Q} .vs-box>.fb,${Q} .vs-mh>.fb,${Q} .vs-opts .fb,${Q} .vs-fld .fb{flex:0 0 auto}${Q} .vs-in .fb{vertical-align:middle;margin-right:4px}
${Q} .vs-box{border-radius:20px}${Q} .vs-opts button{border-radius:20px;padding:8px}
${Q} .vs-fld{border-radius:18px}${Q} .vs-fld>span{flex:1;min-width:0}
${Q} .vs-tk{border-radius:999px;height:40px;width:26px}${Q} .vs-tk.on{background:linear-gradient(180deg,var(--liq1),var(--liq2));border-color:var(--liq2)}${Q} .vs-tk b{font-size:13px}
${Q} .vs-hg{margin-top:14px}${Q} .vs-hg.ar{margin:12px -4px 0}
${Q} .fl-area{display:block;width:100%;height:auto;overflow:visible}
${Q} .k2-tank{box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),inset 0 8px 20px -8px rgba(10,42,60,.12),0 30px 50px -30px var(--liq2)}
/* a test mint edény */
${Q} .vs-body{display:block;flex:0 0 auto;width:84px}
${Q} .vs-body svg{display:block;width:100%;height:auto;overflow:visible;filter:drop-shadow(0 10px 9px rgba(10,42,60,.16))}
${Q} .vs-body .sil{fill:color-mix(in srgb,var(--ink) 13%,#fff);stroke:rgba(10,42,60,.34);stroke-width:3}
${Q} .vs-hb{display:flex;flex-direction:column;align-items:center;gap:5px;flex:0 0 auto;width:96px}${Q} .vs-hb .vs-body{width:96px}
${Q} .vs-h2{display:flex;gap:14px;align-items:center;margin-top:12px}${Q} .vs-h2 .vs-hb,${Q} .vs-h2 .vs-hb .vs-body{width:112px}
${Q} .vs-hf{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}${Q} .vs-hf span{display:flex;align-items:baseline;gap:8px;padding:10px 14px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.07)}
${Q} .vs-hf b{font-family:var(--disp);font-size:24px;font-weight:800;letter-spacing:-.6px;line-height:1}${Q} .vs-hf small{font-size:12px;color:var(--sub)}${Q} .vs-hf s{font-size:15px;color:var(--faint)}
${Q} .vs-hb small{font-size:10.5px;font-weight:650;color:var(--sub);text-align:center;line-height:1.2}${Q} .vs-hb.off .vs-body{opacity:.6}
${Q} .fh-hrow:has(.vs-hb){flex-wrap:nowrap;align-items:flex-start}${Q} .fh-hrow:has(.vs-hb)>div{min-width:0;padding-top:6px}
${Q} .vs-duo{display:flex;gap:18px;justify-content:center;margin-top:14px}${Q} .vs-duo .vs-body{width:96px}${Q} .vs-duo.md .vs-body{width:108px}${Q} .vs-duo.xl .vs-body{width:132px}${Q} .vs-duo.sm{gap:6px;margin:0;flex:0 0 auto}${Q} .vs-duo.sm .vs-body{width:46px}
${Q} .vs-mapc{display:flex;align-items:center;gap:12px;width:100%;text-align:left}${Q} .vs-mapc .g{flex:1;min-width:0}${Q} .vs-mapc strong{display:block;font-size:14.5px;font-weight:650}${Q} .vs-mapc small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px;line-height:1.35}${Q} .vs-mapc .chev{width:18px;height:18px;color:var(--faint);flex:0 0 auto}
/* egy szett = egy kapszula */
${Q} .vs-caps{display:inline-flex;gap:3px;flex:0 0 auto;vertical-align:middle}
${Q} .vs-caps i{display:block;width:9px;height:22px;border-radius:999px;background:linear-gradient(180deg,#fff,#EFF7FA);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.16)}
${Q} .vs-caps i.f{background:linear-gradient(180deg,color-mix(in srgb,var(--c) 50%,#fff),var(--c));box-shadow:0 5px 6px -4px var(--c)}
${Q} .vs-caps i.h{background:linear-gradient(180deg,#fff 0 48%,color-mix(in srgb,var(--c) 60%,#fff) 48%,var(--c));box-shadow:inset 0 0 0 1.5px var(--c)}
${Q} .vs-caps.wide{display:flex;gap:4px}${Q} .vs-caps.wide i{flex:1;width:auto;height:12px}
${Q} .vs-caps.wk i{height:34px;display:grid;place-items:end center;padding-bottom:4px}${Q} .vs-caps.wk b{font-size:9.5px;font-weight:700;color:var(--sub)}${Q} .vs-caps.wk i.f b{color:#fff}
${Q} .vs-caps.bem{margin-right:6px}${Q} .vs-caps.bem i{width:7px;height:14px}
${Q} .vs-caps.big{gap:6px}${Q} .vs-caps.big i{width:18px;height:40px}
${Q} .vs-shg{display:flex;align-items:center;gap:12px;margin:10px 0 14px}${Q} .vs-shg small{font-size:12.5px;color:var(--sub)}
${Q} .vs-rr{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto}${Q} .vs-rr.cl{flex-direction:column;align-items:flex-end;gap:5px}
/* kémcsövek: vízvonal, szellem, csíkos, túlcsorduló, mostani */
${Q} .vs-ts{gap:10px;padding:0;align-items:start}
${Q} .vs-t{position:relative;min-width:0;gap:6px}
${Q} .vs-t .k2-tube em{font-size:9.5px;top:9px;z-index:2;font-weight:600}
${Q} .vs-t .k2-tube .mchp{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);width:28px;height:28px;z-index:2;background:#fff}
${Q} .vs-t .k2-tube>svg.ic{width:28px;height:28px;bottom:9px;z-index:2}
${Q} .vs-t>b{font-size:17px;max-width:100%;white-space:nowrap}${Q} .vs-t>b u{text-decoration:none;font-size:.62em;font-weight:700;opacity:.6;letter-spacing:0}
${Q} .vs-t>small{font-size:11px;max-width:100%;overflow-wrap:anywhere}${Q} .vs-t>small i{font-size:10px}
${Q} .vs-t .wl{position:absolute;left:0;right:0;height:0;border-top:2px dashed color-mix(in srgb,var(--c) 65%,var(--ink));opacity:.75;z-index:1}
${Q} .vs-t.ghost .k2-tube{background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.07)}${Q} .vs-t.ghost>b{color:var(--sub)}
${Q} .vs-t.hatch .k2-tube{background:repeating-linear-gradient(135deg,rgba(10,42,60,.08) 0 2px,transparent 2px 7px),#fff}
${Q} .vs-t.now .k2-tube{box-shadow:inset 0 0 0 2.5px var(--c),0 16px 22px -14px var(--c)}${Q} .vs-t.now>small{color:var(--ink);font-weight:800}
${Q} .vs-t.sel .k2-tube{box-shadow:inset 0 0 0 3px var(--ink),0 16px 22px -14px var(--c)}
${Q} .vs-t .ov{position:absolute;right:-3px;top:10px;width:9px;height:12px;border-radius:50% 50% 50% 50%/38% 38% 62% 62%;background:var(--c);box-shadow:-5px 20px 0 -2px var(--c)}
${Q} .vs-ts.sm>.vs-t>b{font-size:14.5px}${Q} .vs-ts.sm>.vs-t>small{font-size:10.5px}
${Q} .vs-ts.wk>.vs-t>b{font-size:13.5px}${Q} .vs-ts.wk>.vs-t>small{font-size:10px}${Q} .vs-ts.wk .k2-tube em{font-size:9px;letter-spacing:-.2px}
${Q} .vs-ts.rd{max-width:270px;margin:14px auto 0}
${Q} .vs-ts.rd .k2-tube,${Q} .vs-ts.n3 .k2-tube,${Q} .vs-vs .k2-tube,${Q} .vs-ramp .k2-tube{max-width:60px}
${Q} .vs-vs{max-width:230px;margin:14px auto 0}${Q} .vs-ramp{max-width:230px;margin:16px auto 0}
/* vízvonalas vízszintes edény, kettős folyadék, öntet, jelmagyarázat */
${Q} .vs-wlv{position:relative;display:block;height:var(--h);border-radius:999px;background:linear-gradient(180deg,#fff,#EFF7FA);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.11)}
${Q} .vs-wlv>i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 48%,#fff),var(--c))}
${Q} .vs-wlv>u{position:absolute;top:-4px;bottom:-4px;width:0;border-left:2px solid var(--ink);text-decoration:none}${Q} .vs-wlv>u.d{border-left-style:dashed;opacity:.65}
${Q} .vs-wlv>u em{position:absolute;top:calc(100% + 1px);left:0;transform:translateX(-50%);font-style:normal;font-size:9.5px;font-weight:700;color:var(--sub)}
${Q} .vs-wlk{display:flex;flex-wrap:wrap;gap:4px 14px;margin-bottom:14px;font-size:11.5px;color:var(--sub)}${Q} .vs-wlk u{display:inline-block;height:12px;border-left:2px solid var(--ink);margin-right:6px;vertical-align:-2px}${Q} .vs-wlk u.d{border-left-style:dashed;opacity:.65}${Q} .vs-wlk i{display:inline-block;width:16px;height:9px;border-radius:999px;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.3);margin-right:6px}
${Q} .vs-split{position:relative;display:block;height:16px;border-radius:999px;overflow:hidden;background:linear-gradient(180deg,#fff,#EFF7FA);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10)}
${Q} .vs-split i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 55%,#fff),var(--c))}
${Q} .vs-split u{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--c) 42%,#fff) 0 4px,color-mix(in srgb,var(--c) 20%,#fff) 4px 8px)}
${Q} .fh-big+.vs-split{height:26px;margin-top:10px}
${Q} .vs-lg{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:12px;color:var(--sub);line-height:1.3}${Q} .vs-lg.c{justify-content:center}
${Q} .vs-lg i{display:inline-block;width:9px;height:11px;border-radius:50% 50% 50% 50%/38% 38% 62% 62%;margin-right:5px;background:var(--dom);vertical-align:-1px}${Q} .vs-lg b{color:var(--ink);font-weight:700}
${Q} .vs-lg i.a{background:var(--carb)}${Q} .vs-lg i.b{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--carb) 55%,#fff) 0 2px,color-mix(in srgb,var(--carb) 22%,#fff) 2px 4px)}${Q} .vs-lg i.g{background:color-mix(in srgb,#149E6E 50%,#fff)}${Q} .vs-lg i.g2{background:#F3C766}
${Q} .vs-pour{display:flex;height:36px;border-radius:999px;overflow:hidden;margin-top:14px;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),0 14px 18px -14px var(--dom)}
${Q} .vs-pour i{display:grid;place-items:center;min-width:0;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 52%,#fff),var(--c));border-right:2px solid rgba(255,255,255,.75)}${Q} .vs-pour i:last-child{border-right:0}
${Q} .vs-pour b{font-style:normal;font-size:12.5px;font-weight:800;color:#fff}
${Q} .vs-pour.e{box-shadow:none;border:2px dashed rgba(10,42,60,.16)}${Q} .vs-pour.e i{background:none}${Q} .vs-pour.e b{color:var(--faint);font-weight:600;font-size:12px}
${Q} .vs-ev{position:relative;overflow:hidden;margin-top:14px;padding:18px 16px 30px;border-radius:26px;border:2px dashed rgba(10,42,60,.16);display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
${Q} .vs-ev p{font-size:13.5px;color:var(--sub);line-height:1.4}${Q} .vs-ev>i{position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(180deg,var(--liq1),var(--liq2));opacity:.35}
${Q} .vs-dr{display:inline-flex;gap:3px;flex:0 0 auto}${Q} .vs-dr i{width:10px;height:13px;border-radius:50% 50% 50% 50%/38% 38% 62% 62%;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.18)}${Q} .vs-dr i.f{background:var(--c);box-shadow:none}
${Q} .vs-rc{position:relative;display:block;flex:0 0 auto;width:26px;height:44px;border-radius:999px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10),0 8px 12px -8px var(--c)}
${Q} .vs-rc i{position:absolute;left:0;right:0;bottom:0;height:94%;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 45%,#fff),var(--c))}${Q} .vs-rc u{position:absolute;left:0;right:0;border-top:2px dashed #fff}
${Q} .vs-rowbar{display:block;margin-top:7px}${Q} .vs-rowbar .fl-level{width:100%}${Q} .vs-ql .fb{flex:0 0 auto}${Q} .vs-ts.n3{max-width:290px;margin-left:auto;margin-right:auto}${Q} .vs-rowbar .vs-caps{margin-right:2px}
${Q} .vs-mini{display:inline-flex;align-items:flex-end;gap:2px;height:28px;flex:0 0 auto}${Q} .vs-mini i{position:relative;display:block;width:6px;height:100%;border-radius:999px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1px rgba(10,42,60,.16)}${Q} .vs-mini b{position:absolute;left:0;right:0;bottom:0;background:var(--c)}
${Q} .vs-l2{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;margin-top:8px;font-size:12.5px;color:var(--sub)}
${Q} .vs-xl{display:flex;gap:8px;align-items:center}${Q} .vs-xl.q{font-style:italic}
/* eligazítás: várható idő sávval, a küldetés kapszulája a biztosságig telik */
${Q} .vs-range{margin-top:14px}
${Q} .vs-range .t{position:relative;display:block;height:30px;border-radius:999px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),0 14px 18px -14px var(--liq2)}
${Q} .vs-range .t i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,var(--liq1),var(--liq2))}
${Q} .vs-range .t u{position:absolute;top:0;bottom:0;border-right:2px dashed var(--liq2);background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--liq2) 55%,#fff) 0 4px,color-mix(in srgb,var(--liq2) 25%,#fff) 4px 8px)}
${Q} .vs-range .ax{position:relative;display:block;height:16px;margin-top:5px;font-size:10.5px;color:var(--sub)}${Q} .vs-range .ax em{position:absolute;transform:translateX(-50%);font-style:normal;white-space:nowrap}${Q} .vs-range .ax em:first-child{transform:none}${Q} .vs-range .ax em.r{left:auto;right:0;transform:none}${Q} .vs-range .ax em.k{color:var(--ink);font-weight:800}
${Q} .vs-qc{position:relative;flex:0 0 auto;width:28px;height:46px;border-radius:999px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.16);display:grid;place-items:end center;padding-bottom:6px}
${Q} .vs-qc i{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(180deg,var(--liq1),var(--liq2))}${Q} .vs-qc.on{box-shadow:inset 0 0 0 2px var(--liq2)}${Q} .vs-qc.on i{height:var(--p)}
${Q} .vs-qc svg{position:relative;width:15px;height:15px;stroke-width:3.2;color:#fff;opacity:0}${Q} .vs-qc.on svg{opacity:1}
${Q} .vs-qt{display:inline-flex;align-items:center;gap:5px;font-weight:650;color:var(--ink);vertical-align:middle}
/* edzés közben: gyakorlatonként egy edény, a szett sorszáma kapszula, a pihenő kiürül */
${Q} .vs-pv{display:flex;gap:8px;margin:16px 18px 2px}
${Q} .vs-pv button{display:flex;flex-direction:column;gap:3px;min-width:0}
${Q} .vs-pv span{position:relative;display:block;height:14px;border-radius:999px;overflow:hidden;background:rgba(10,42,60,.09);box-shadow:inset 0 1px 2px rgba(10,42,60,.10)}
${Q} .vs-pv span i{position:absolute;left:0;top:0;bottom:0;height:auto!important;width:var(--pw,0%);border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 55%,#fff),var(--c))}
${Q} .vs-pv small{font-size:10.5px;font-weight:700;color:var(--sub);text-align:center}
${Q} .vs-pv button.on span{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--dom)}${Q} .vs-pv button.on small{color:var(--ink)}
${Q} .vs-sets{grid-template-columns:26px 1fr 1fr 1fr 44px;border-radius:22px}
${Q} .vs-sets .n{justify-self:center;width:24px;height:40px;border-radius:999px;display:grid;place-items:center;font-size:12.5px;color:var(--sub);background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.16)}
${Q} .vs-sets .n.f{color:#fff;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 50%,#fff),var(--c));box-shadow:0 6px 8px -6px var(--c)}
${Q} .vs-sets .n.h{color:var(--ink);background:linear-gradient(180deg,#fff 0 50%,color-mix(in srgb,var(--c) 45%,#fff) 50%);box-shadow:inset 0 0 0 2px var(--c)}
${Q} .vs-sets .vd{width:44px;height:40px}${Q} .vs-sets .tk{border-radius:999px;background:linear-gradient(135deg,var(--liq1),var(--liq2))}${Q} .vs-sets .vin{border-radius:14px}${Q} .vs-sets .v{border-radius:14px}
${Q} .vs-tools button{border-radius:999px;padding:5px 12px 5px 5px}${Q} .vs-tools button:not(:has(.fb)){padding:9px 14px}
${Q} .vs-tg span{border-radius:18px}${Q} .vs-ql{border-radius:999px;padding:5px 10px 5px 5px}
${Q} .vs-leg{display:flex;flex-wrap:wrap;gap:8px 12px;margin-top:12px;font-size:12.5px;font-weight:600}${Q} .vs-leg span{display:inline-flex;align-items:center;gap:6px}
${Q} .vs-rv{position:relative;flex:0 0 auto;width:34px;height:50px;border-radius:13px 13px 17px 17px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.12)}
${Q} .vs-rv i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#19C7C0,#1877F2);transition:height 1s linear}
/* ceremónia: a kehely megtelik, a rekord kicsordul */
${Q} .vs-cer{padding-bottom:22px}${Q} .vs-cer::before,${Q} .vs-cer::after{display:none}${Q} .vs-cer .sub{margin-top:6px}
${Q} .vs-cup{position:relative;width:200px;max-width:74%;margin:2px auto 14px}
${Q} .vs-cup svg{display:block;width:100%;height:auto;overflow:visible;filter:drop-shadow(0 18px 16px rgba(233,137,43,.38))}
${Q} .vs-cup .lq{transform:translateY(calc((1 - var(--p)) * 108px))}
${Q} .vs-cup .sp{position:absolute;width:11px;height:14px;border-radius:50% 50% 50% 50%/38% 38% 62% 62%;background:linear-gradient(180deg,#F9D06A,#E9892B);opacity:0;--fx:34px}
${Q} .vs-cup .s1{left:1%;top:26%}${Q} .vs-cup .s2{right:0;top:32%;--fx:-34px}${Q} .vs-cup .s3{left:-5%;top:58%;width:8px;height:10px;--fx:44px}${Q} .vs-cup .s4{right:-6%;top:64%;width:8px;height:10px;--fx:-44px}${Q} .vs-cup .s5{right:9%;top:-9%;width:7px;height:9px;--fx:-20px}
${Q} #cerroot.b1 .vs-cup .sp{opacity:1}
${Q} .vs-gold .vs-rc{box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10),0 8px 12px -8px var(--carb)}
${Q} .vs-bowl{width:92px;flex:0 0 auto}
/* medálok, intervall-cső, sportcsempék */
${Q} .vs-shelf{display:grid;grid-template-columns:repeat(7,1fr);gap:8px 4px;margin-top:16px;justify-items:center}
${Q} .vs-shelf i{width:24px;height:30px;border-radius:50% 50% 50% 50%/38% 38% 62% 62%;background:linear-gradient(180deg,#FBEBC0,#F3C766);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.85),0 8px 10px -8px #E9892B}${Q} .vs-shelf i.new{background:linear-gradient(180deg,#F9D06A,#E9892B)}
${Q} .vs-ivl{display:flex;align-items:flex-end;gap:2px;height:40px;margin:10px 0 2px;padding:5px 8px 0;border-radius:16px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.07)}
${Q} .vs-ivl i{display:block;height:var(--h);min-width:2px;border-radius:5px 5px 0 0;background:color-mix(in srgb,var(--dom) 24%,#fff)}${Q} .vs-ivl i.s{background:linear-gradient(180deg,var(--liq1),var(--liq2))}${Q} .vs-ivl i.w{background:color-mix(in srgb,var(--dom) 46%,#fff)}
${Q} .vs-log .fh-chips{margin-top:8px}${Q} .vs-log .fh-facts{margin:10px 0 0}
${Q} .vs-spg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 8px}${Q} .vs-spg button{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12.5px;font-weight:650;text-align:center;line-height:1.2}
/* a nap kártyái, az előírás cellái */
${Q} .vs-dcs{display:flex;flex-direction:column;gap:10px;margin:12px 14px 0}
${Q} .vs-dc{display:block;width:100%;text-align:left;padding:14px 16px;border-radius:26px;background:#fff;box-shadow:0 14px 24px -18px color-mix(in srgb,var(--dom) 50%,rgba(10,42,60,.55)),0 2px 4px -2px rgba(10,42,60,.06)}
${Q} .vs-dc.now{box-shadow:inset 0 0 0 2.5px var(--dom),0 18px 26px -18px var(--dom)}
${Q} .vs-dc.next{background:rgba(255,255,255,.6);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.09)}
${Q} .vs-dc.quiet{display:flex;align-items:center;gap:10px;padding:9px 16px;background:none;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.07)}
${Q} .vs-dc .vs-hd,${Q} .vs-tpl .vs-hd{display:flex;align-items:center;gap:8px}${Q} .vs-dc .g,${Q} .vs-tpl .g{flex:1;min-width:0}
${Q} .vs-dc .g small{display:block;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--sub)}${Q} .vs-dc .g strong{display:block;font-family:var(--disp);font-size:18px;font-weight:800;letter-spacing:-.4px}${Q} .vs-dc.quiet .g strong{font-family:var(--ff);font-size:14px;font-weight:600;letter-spacing:0;color:var(--sub)}
${Q} .vs-dc .chev,${Q} .vs-tpl .chev{width:18px;height:18px;color:var(--faint);flex:0 0 auto}
${Q} .vs-dc .vs-ct{display:flex;gap:14px;align-items:center;margin-top:10px;padding-top:12px;border-top:1px solid var(--hair)}${Q} .vs-dc .vs-ct .vs-body{width:72px}
${Q} .vs-dc .vs-cl{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
${Q} .vs-dc .f3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}${Q} .vs-dc .f3 i{font-style:normal;text-align:center;padding:6px 2px;border-radius:14px;background:var(--page);min-width:0}${Q} .vs-dc .f3 b{display:block;font-family:var(--disp);font-size:16px;font-weight:800;letter-spacing:-.3px}${Q} .vs-dc .f3 small{font-size:10.5px;color:var(--sub)}
${Q} .vs-dc .chs{display:flex;flex-wrap:wrap;gap:5px}${Q} .vs-dc .chs span{display:inline-flex;align-items:center;gap:4px;padding:2px 9px 2px 2px;border-radius:999px;background:var(--page);font-size:12px}${Q} .vs-dc .chs .mchp{width:22px;height:22px}${Q} .vs-dc .chs b{font-weight:800}
${Q} .vs-dn{margin:10px 18px 0}
${Q} .vs-ex{padding:14px 0;border-top:1px solid var(--hair)}${Q} .vs-ex:first-child{border-top:0;padding-top:0}
${Q} .vs-ex .eh{display:flex;align-items:center;gap:8px}${Q} .vs-ex .ix{font-family:var(--disp);font-weight:800;color:var(--faint);width:14px;flex:0 0 auto}${Q} .vs-ex .eh strong{flex:1;min-width:0;font-size:14.5px;font-weight:650}
${Q} .vs-ex .eg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}${Q} .vs-ex .eg span{padding:8px 3px;border-radius:14px;background:var(--page);text-align:center;min-width:0}${Q} .vs-ex .eg b{display:block;font-family:var(--disp);font-size:14.5px;font-weight:800;letter-spacing:-.3px;overflow-wrap:anywhere}${Q} .vs-ex .eg b.t{color:color-mix(in srgb,var(--dom) 80%,var(--ink))}${Q} .vs-ex .eg small{font-size:10px;color:var(--sub)}
${Q} .vs-tday .ex .v b{color:var(--ink)}
/* egy izom mérőhengere */
${Q} .vs-cylw{display:flex;align-items:center;gap:8px;margin-top:18px}
${Q} .vs-cyl{position:relative;width:76px;height:190px;flex:0 0 auto;margin-right:118px}
${Q} .vs-cyl .tb{position:absolute;inset:0;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#fff,#F3FAFC);box-shadow:inset 0 0 0 2px rgba(10,42,60,.08),inset 0 6px 14px -6px rgba(10,42,60,.14),0 18px 26px -18px var(--c)}
${Q} .vs-cyl .l{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 60%,#fff),var(--c))}${Q} .vs-cyl .l .k2-w{height:10px}
${Q} .vs-cyl .l b{position:absolute;left:0;right:0;bottom:10px;text-align:center;color:#fff;font-family:var(--disp);font-size:30px;font-weight:800;letter-spacing:-1px}
${Q} .vs-cyl .l.lo b{bottom:calc(100% + 8px);color:var(--ink)}
${Q} .vs-cyl .wl{position:absolute;left:-5px;width:calc(100% + 14px);height:0;border-top:2px solid var(--ink)}${Q} .vs-cyl .wl.d{border-top-style:dashed;opacity:.7}
${Q} .vs-cyl .wl em{position:absolute;left:calc(100% + 6px);top:-8px;width:106px;font-style:normal;font-size:11px;font-weight:700;line-height:1.15}
/* tervek sora, sablonok, varázsló, skála */
${Q} .vs-queue{display:flex;gap:10px;margin-top:16px;align-items:flex-start}
${Q} .vs-queue button{position:relative;min-width:54px;text-align:center}
${Q} .vs-queue span{position:relative;display:grid;place-items:center;height:40px;border-radius:999px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.09)}
${Q} .vs-queue button+button::before{content:'';position:absolute;left:-10px;top:17px;width:10px;height:6px;background:color-mix(in srgb,var(--dom) 40%,#fff)}
${Q} .vs-queue span i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,var(--liq1),var(--liq2))}${Q} .vs-queue b{position:relative;font-family:var(--disp);font-size:13px;font-weight:800}
${Q} .vs-queue .now span{box-shadow:inset 0 0 0 2.5px var(--liq2),0 12px 16px -12px var(--liq2)}
${Q} .vs-queue small{display:block;margin-top:5px;font-size:10.5px;font-weight:600;color:var(--sub);line-height:1.2;overflow-wrap:anywhere}
${Q} .vs-tpl{display:block;width:100%;text-align:left;padding:16px 0;border-top:1px solid var(--hair)}${Q} .vs-tpl:first-child{border-top:0;padding-top:0}
${Q} .vs-tpl strong{display:block;font-size:15px;font-weight:650}${Q} .vs-tpl .g small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px}
${Q} .vs-tpl .wkc{display:flex;align-items:center;gap:12px;margin-top:12px}${Q} .vs-tpl .wkc .vs-caps{flex:1}${Q} .vs-tpl .fh-facts{margin:12px 0 0}
${Q} .vs-wd{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
${Q} .vs-wd button{position:relative;height:58px;border-radius:999px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.10);display:grid;place-items:end center;padding-bottom:9px}
${Q} .vs-wd i{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(180deg,var(--liq1),var(--liq2));transition:height .35s var(--ease)}${Q} .vs-wd .on i{height:100%}
${Q} .vs-wd b{position:relative;font-size:12px;font-weight:800}${Q} .vs-wd .on b{color:#fff}
${Q} .vs-scale{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}
${Q} .vs-scale button{position:relative;height:54px;border-radius:999px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.11);display:grid;place-items:end center;padding-bottom:5px;font-size:11.5px;font-weight:700;color:var(--sub)}
${Q} .vs-scale button i{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 28%,#fff),color-mix(in srgb,var(--dom) 52%,#fff))}${Q} .vs-scale button b{position:relative;font-weight:700}
${Q} .vs-scale button.f i,${Q} .vs-scale button.a i{height:var(--h)}${Q} .vs-scale button.f{color:var(--ink)}
${Q} .vs-scale button.a{color:var(--ink);box-shadow:inset 0 0 0 2px var(--liq2)}${Q} .vs-scale button.a i{background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${Q} .vs-stp button{border-radius:50%}${Q} .vs-rb{border-radius:50%}${Q} .vs-day{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--page);font-size:12.5px;color:var(--ink)}
${Q} .vs-cmp b .fl-level{margin-top:5px}
${Q} .vs-ft{gap:8px}${Q} .vs-ft span:nth-child(2){text-align:center;color:var(--sub)}
@media (prefers-reduced-motion:no-preference){
  body:not(.still) ${Q} #cerroot.b1 .vs-cup .sp{animation:vsspl .95s cubic-bezier(.2,.8,.2,1) both}
  body:not(.still) ${Q} #cerroot.b1 .vs-cup .s2{animation-delay:.07s}body:not(.still) ${Q} #cerroot.b1 .vs-cup .s3{animation-delay:.14s}body:not(.still) ${Q} #cerroot.b1 .vs-cup .s4{animation-delay:.2s}body:not(.still) ${Q} #cerroot.b1 .vs-cup .s5{animation-delay:.05s}
  body:not(.still) ${Q} .vs-cup .wvp{animation:vswv 5s linear infinite}
}
@media (prefers-reduced-motion:reduce){${Q} .vs-rv i,${Q} .vs-wd i{transition:none}${Q} #cerroot .vs-cres,${Q} #cerroot .vs-ccard,${Q} .vs-cstars i svg{transition:none}}
body.still ${Q} .vs-rv i,body.still ${Q} .vs-wd i{transition:none}
@keyframes vsspl{0%{opacity:0;transform:translate(var(--fx),-18px) scale(.3)}40%{opacity:1;transform:translate(calc(var(--fx)*.45),-34px) scale(1)}100%{opacity:1;transform:none}}
@keyframes vswv{to{transform:translateX(40px)}}
@media (max-width:360px){${P} .vs-sets{grid-template-columns:24px 1fr 1fr 1fr 40px;gap:6px;padding:10px}${P} .vs-sets .tk,${P} .vs-sets .vd{width:40px}${P} .vs-stp button{width:30px;height:30px}${P} .vs-stp b{min-width:32px}${P} .vs-cstars i{width:40px;height:40px}${P} .vs-in{padding-left:0}${P} .vs-rest small{display:none}${P} .vs-tg b{font-size:14.5px}${P} .vs-opts{gap:6px}${P} .vs-opts button{font-size:12.5px;padding:7px 6px;gap:6px}${P} .vs-opts .fb{--s:30px!important}
  ${Q} .vs-hb,${Q} .vs-hb .vs-body{width:78px}${Q} .vs-h2 .vs-hb,${Q} .vs-h2 .vs-hb .vs-body{width:92px}${Q} .vs-hf b{font-size:21px}${Q} .vs-hf span{padding:9px 12px}${Q} .vs-duo.xl .vs-body{width:104px}${Q} .vs-duo.md .vs-body{width:88px}${Q} .vs-duo .vs-body{width:80px}${Q} .vs-duo.sm .vs-body{width:38px}
  ${Q} .vs-ts{gap:6px}${Q} .vs-ts.sm>.vs-t>b{font-size:13px}${Q} .vs-ts.wk>.vs-t>b{font-size:12px}${Q} .vs-ts.wk{gap:4px!important}${Q} .vs-t .k2-tube .mchp{width:24px;height:24px}
  ${Q} .fh-mus .fl-level,${Q} .fh-mus .vs-split{width:54px}${Q} .fh-row .fl-level{width:46px}
  ${Q} .vs-cyl{width:60px;margin-right:104px}${Q} .vs-cyl .wl em{width:94px;font-size:10.5px}${Q} .vs-cylw .vs-hb,${Q} .vs-cylw .vs-hb .vs-body{width:66px}
  ${Q} .vs-dc .vs-ct{gap:10px}${Q} .vs-dc .vs-ct .vs-body{width:50px}${Q} .vs-dc .f3 b{font-size:14.5px}
  ${Q} .vs-ex .eg b{font-size:13px}${Q} .vs-scale{gap:3px}${Q} .vs-wd{gap:4px}${Q} .vs-shelf i{width:20px;height:26px}${Q} .vs-caps.big i{width:15px;height:36px}}
`;
const NL=(r,l)=>`<a href="#w-edzes-${r}">${l||r}</a>`;
register('edzes',{title:'Edzés',
  tabs:[['Mai','mai'],['Terv','terv'],['Terhelés','terheles'],['Gyakorlatok','exercises']],
  routes:ROUTES,
  sheets:SHEETS,
  after:(r,a)=>{if(r==='cer'&&!a)runCer();if(r!=='indulas')ST.tick=null;if(r!=='session'){ST.focus=null;if(ST.resting)stopRest(true)}},
  css:CSS,
  notes:`<h2>Edzés · minden oldalnak saját rajza van</h2>
  <p>A felépítés maradt: cím, egy fő kártya, számozott szakaszok. Ami új: minden oldal fő kártyáján egy saját, folyadékos rajz áll, ami az oldal adataiból készül. Három visszatérő jel van: <b>a tested mint edény</b> (minden izom külön telik), <b>egy szett = egy kapszula</b>, és <b>a kémcsövek</b> a hetekhez, napokhoz, izmokhoz. A szaggatott vonal mindig a terv vagy a korábbi szint.</p>
  <h2>Mit érdemes megnézni</h2>
  <p><b>Mai</b> · ${NL('mai','a mai nap')}: a Pull Day mellett a hátad, a mai izmok annyira telnek, amennyit ma kapnak. A sárga kártyán a reggeli három érték három kémcső. Lejjebb visszajött a „mit ad a mozgásod a keretedhez” kártya. Állapotok: ${NL('mai.folyamatban','folyamatban')} (a kész szettek sötétebbek) · ${NL('mai.kesz','kész')} · ${NL('mai.sze','szerda, elmaradt')} · ${NL('mai.pihen','pihenőnap')} · ${NL('mai.ures','nincs terv')} · ${NL('mai.kimelo','kímélő mód')} · ${NL('mai.kimelo3','letelt a becslés')} · ${NL('mai.vissza','visszatérő edzés')}.</p>
  <p><b>Az edzés útja</b> · ${NL('indulas','eligazítás')}: a várható idő egy sáv 70 és 85 perc között, a küldetések kapszulái annyira telnek, amennyire biztosak. ${NL('session.uj','Edzés közben')}: a szerkezet maradt (egy gyakorlat nagyban, a többi sor, felül Rekordok · Technika · Műveletek); fent gyakorlatonként egy kis edény, a szettek sorszáma kapszula, a pihenő egy edény, ami valóban kiürül. ${NL('cer','Lezárás')}: a kehely megtelik a csillagokkal együtt, a rekord kicsordul. ${NL('cer.reszletek','Részletek')} · ${NL('review','összegzés')} (izmonként a mai szettek a múlt heti vonalhoz) · ${NL('review.gyak','egy gyakorlat')}.</p>
  <p><b>Terv</b> · ${NL('terv','a futó terv')}: a hat hét hat edény, a pihenőhéten leapad; a nap kártyáin újra ott a test, a három szám és az izmok szettszámmal. ${NL('run','A terv oldala')} (az ív mint hullám) · ${NL('nap.csu','egy nap')} · ${NL('napszerk','szerkesztő')} · ${NL('het','heti vizsgálat')} (vízvonalak: mettől fejlődik, mettől hangsúly) → ${NL('izom.back-wide','egy izom')} (mérőhenger) · ${NL('konyvtar','edzéstervek')} (csővezeték) · ${NL('futamok','lezárt futamok')} → ${NL('riport','riport')} · ${NL('osszevetes','összevetés')} · ${NL('sablonok','sablonok')} → ${NL('sablon','egy sablon')} → ${NL('sablonszerk','szerkesztő')} · ${NL('ujterv','új terv')} (a hetek számára koppintva változik az előnézet; ${NL('ujterv.gen','készül')} · ${NL('ujterv.kesz','vázlat')}) · ${NL('futas','futás')} (${NL('futas.naplo','napló')} · ${NL('futas.tervek','tervek')}) → ${NL('futasterv','futóterv')}.</p>
  <p><b>Terhelés</b> · ${NL('terheles','a hét')} (tartály: 55 a 83-ból) · ${NL('terkep','izomtérkép')} (${NL('terkep.terv','a heti terv')}) · ${NL('jelek','minden izomjel')} · ${NL('mozgas','minden mozgásod')} (két külön edény) · ${NL('gym','Gym · heti munka')} (a hát túlcsordult). <b>Gyakorlatok</b> · ${NL('exercises','lista')} · ${NL('exercise','egy gyakorlat')} (az erő íve, rajta a rekordok cseppjei) · ${NL('medals','medálok')} (${NL('medals.ures','üresen')}). <b>Egyéb</b> · ${NL('sport','sport')} (${NL('sport.naplo','napló')} · ${NL('sport.cross','cross-load: közlekedőedények')}) · ${NL('sportlog','sport naplózása')} → ${NL('sportlog.0','röplabda')} · ${NL('sajat','saját edzés')} (${NL('sajat.uj','új')} · ${NL('sajat.betolt','betöltés')} · ${NL('sajat.nincs','nem található')}).</p>
  <h2>Ami visszajött az élő appból</h2>
  <p>A mozgás kalória-kártyája a Mai oldalon · a nap kártyái testtel és számokkal · a gyakorlatok négycellás előírása a nap oldalán · a tervek és futamok három-három ténye · az izomtérkép jelmagyarázata · a Gym-nézet testtérkép-kártyája · a futás szakaszai · az ítélet-jelek magyarázata az edzés közben. Az ikonok mindenhol buborékban ülnek, gyűrű sehol nincs.</p>
  <h2>Amit csak kinézetre csinál</h2>
  <p>A lépegetők (− / +) és a jegyzetmezők a lapokon nem számolnak, a saját edzés szerkesztőjét kivéve. A szett kipipálása elindítja a pihenőt, de a sort nem írja át késznek.</p>`
});
})();
