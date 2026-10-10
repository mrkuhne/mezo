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
const SKT={gym:'Pull Day',volley:'Röplabda',run:'Sprint-intervallum'};
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
/* A hét EGYETLEN számsora (Terhelés = Gym · heti munka = térkép = mozgás), a DAYS napjaiból összeadva: [színkulcs, név, kész szett, tervezett szett, a terv sok ide].
   Élő forrás: weekZoneRows → loadGroups / loadWeekTotals (logic/loadWeek.ts). Kész = hétfő + kedd + szerda (16 + 12 + 17), terv = az öt edzésnap (75). */
const GR=[['quad','Láb',29,31,1],['chest-mid','Mell',7,13],['shoulder-side','Váll',6,12],['triceps-medial','Kar',3,9],['back-wide','Hát',0,10]];
const LD_DONE=GR.reduce((s,g)=>s+g[2],0),LD_PLAN=GR.reduce((s,g)=>s+g[3],0);
/* a sport és a futás becsült plusz-terhelése izmonként: [forrás, erősség 1–3, alkalom a heti rendben] — élő forrás: sportLoadForWeek().perMuscle */
const SPL={'shoulder-front':[['Röpi',3,3]],'shoulder-side':[['Röpi',2,3]],quad:[['Röpi',2,3],['Futás',3,2]],ham:[['Futás',3,2]],calf:[['Röpi',2,3],['Futás',2,2]],core:[['Röpi',1,3]]};
/* a heti rend sport- és futás-eseményei (Minden mozgásod): [címke, név, nap, idő, [[régió-kulcs, név, erősség]]] */
const EVENTS=[['RÖPI','Röplabda','Kedd','18:00',[['shoulder-front','Váll',3],['quad','Láb',2],['core','Core',1]]],['FUTÁS','Sprint-intervallum','Szerda','18:00',[['quad','Láb',3]]],['RÖPI','Röplabda','Csütörtök','18:00',[['shoulder-front','Váll',3],['quad','Láb',2],['core','Core',1]]],['FUTÁS','Piramis-intervallum','Péntek','17:30',[['quad','Láb',2]]],['RÖPI','Röplabda','Szombat','10:00',[['shoulder-front','Váll',3],['quad','Láb',2],['core','Core',1]]]];
const GY=[['Fekvenyomás','chest-mid',140,4],['Döntött törzsű evezés','back-mid',140,5],['Húzódzkodás (súlyozott)','back-wide',98,3],['Vállból nyomás','shoulder-front',72,1],['Oldalemelés','shoulder-side',null],['Kalapácsbicepsz','biceps-brachialis',26,1],['Guggolás','quad',150,2],['Román felhúzás','ham',155,0]];
/* a tíz sport + a futás csempéje: [ikon, név, szokásos perc, mezők]. Mezők (logic/sports.ts): n = lépegető [kulcs, címke, egység, érték, lépés, csak ebben a módban],
   r = csúszka (RPE 1–10), c = pöttyök [kulcs, címke, lehetőségek, kijelölt], m = mód-váltó [[id, címke]], t = szöveg [címke, példa] */
const RPE=v=>['r','Megélt terhelés (RPE)',v],MIN=v=>['n','minutes','Időtartam','perc',v,5],TM=['m',[['training','Edzés'],['match','Meccs']]];
const SPORTS=[
 ['t-volley','Röplabda',90,[TM,MIN(90),RPE(7),['c','shoulder','Vállterhelés',['enyhe','közepes','erős'],1],['n','sets','Játszott szettek','szett',3,1,'match']]],
 ['t-crossfit','CrossFit / HIIT',40,[MIN(40),['n','rounds','Körök','kör',5,1],RPE(8)]],
 ['t-trx','TRX / funkcionális',45,[MIN(45),['n','rounds','Körök','kör',4,1],RPE(7)]],
 ['t-bike','Kerékpár',60,[['n','distance','Táv','km',25,1],MIN(60),RPE(6),['c','terrain','Terep',['sík','dombos','hegyi'],0]]],
 ['t-swim','Úszás',40,[['n','distance','Táv','m',1200,50],MIN(40),['c','stroke','Úszásnem',['gyors','mell','hát','pillangó'],0],RPE(6)]],
 ['t-football','Foci',90,[TM,MIN(90),RPE(7)]],
 ['t-basket','Kosárlabda',75,[TM,MIN(75),RPE(7)]],
 ['t-tennis','Tenisz',60,[['m',[['singles','Egyes'],['doubles','Páros']]],MIN(60),RPE(6)]],
 ['t-hike','Túra',150,[['n','distance','Táv','km',9,.5],MIN(150),['n','climb','Szintemelkedés','m',300,50],RPE(5)]],
 ['t-other','Egyéb mozgás',60,[['t','Mi volt?','Pl. fallabda, tánc, evezés'],MIN(60),['c','effort','Milyen kemény volt?',['könnyű','közepes','kemény'],1],RPE(6)]],
 ['t-run','Futás',40,null]];
const CER={ratio:.9,sets:14,reps:142,vol:4180,min:71,xp:185,kcal:540,rec:[['Húzódzkodás (súlyozott)','Súly-rekord',['12,5 kg','8 ism.']],['Döntött törzsű evezés','Rep-rekord',['10 ism.','72,5 kg']]],chal:[[1,'Túlterhelés','Húzódzkodás (súlyozott)',['12,5 kg','8 ism.']],[0,'Mélység','Kalapácsbicepsz',['utolsó szett','RIR 0']]],mus:[['back-wide','Hát (széles)',4,4],['back-mid','Hát (közép)',3,3],['shoulder-rear','Váll (hátsó)',3,3],['biceps-brachialis','Kar',2,3],['traps','Trapéz',2,3]]};
const KIND_IC={'Súly-rekord':'t-weight','Rep-rekord':'t-repeat','1RM-rekord':'t-ring','Volumen-rekord':'t-protocol'};
const starCls=(i,p)=>{const t=(i+1)/5;return p>=t-.001?'is-lit':p>=t-.1?'is-half':''};
const stars5=r=>`<span class="mstars" aria-hidden="true">${[0,1,2,3,4].map(i=>{const c=starCls(i,r);return T(c==='is-lit'?'t-star':c==='is-half'?'t-star-half':'t-star-empty')}).join('')}</span>`;
const SJ0=()=>({name:'Pihenőnapi felső',open:-1,ex:[{n:'Fekvenyomás',k:'chest-mid',bem:2,w:4,lo:6,hi:8,rir:1,kg:80,vol:true},{n:'Lehúzás · semleges fogás',k:'back-wide',bem:2,w:3,lo:10,hi:12,rir:2,kg:null,vol:true,warn:'Semleges fogás · csukló-kíméletes'},{n:'Oldalemelés',k:'shoulder-side',bem:0,w:3,lo:12,hi:15,rir:1,kg:10,vol:true}]});

/* ── állapot ── */
/* a futóterv szerkesztőjének vázlata: a két heti edzés (sprint, piramis) napja, ideje és a kijelölt hét terhelése */
const RB0=()=>({weeks:8,week:3,dirty:false,sprint:{day:2,time:'18:00',rounds:6,rest:45},pyr:{day:4,time:'17:30',work:[15,30,45,30,15]}});
const ST={day:'plan',ready:'offer',sk:{},skord:[],km:null,cb:null,udv:0,whyk:null,tick:null,resting:false,restLeft:90,restTotal:90,restT:null,pick:{mode:'swap',g:0,f:'all',q:'',lib:0},cmp:false,cmpSel:[],sj:SJ0(),sjmode:'edit',demo:null,terv:'run',
  vlog:false,rlog:false,extra:false,mtr:false,slk:0,sp:{i:-1,mode:null,kcal:null},ev:{sport:0,kind:'match'},evs:[0,1],rb:RB0(),rbT:null,rbFor:null,xlog:null};
const catOf=k=>CATS.find(c=>c[0]===ST.sk[k]?.cat);
const serious=k=>Boolean(catOf(k)?.[3]);
const passKey=()=>ST.skord.find(k=>!serious(k)&&!ST.sk[k]?.adv);
const skLabel=k=>{if(ST.sk[k]?.adv)return 'az edző javaslatára';const c=catOf(k);if(!c)return 'ok nélkül';if(c[0]==='OTHER'&&ST.sk[k].text)return `„${ST.sk[k].text}”`;return c[2]};
const skEffect=k=>ST.sk[k]?.adv?'Nem számít mulasztásnak.':serious(k)?`Nem számít mulasztásnak. ${CARE[ST.sk[k].cat]}`:passKey()===k?'A heti szabadjegyed fedezi — a sorozatod marad.':'Rendes kihagyásnak számít — a heti szabadjegy már elment. Semmi gond.';
const kmIc=()=>CATS.find(c=>c[0]===ST.km.cat)[1];
const kmExpired=()=>KOFF[ST.km.dur]!==null&&ST.km.day-1>KOFF[ST.km.dur];
/* a védett napok: ma (terem, röpi) és a pénteki futás; a szerdai futás csak akkor, ha a kímélő mód már tegnap is tartott */
const kmCovers=k=>{if(!ST.km||ST.km.released)return false;return k==='gym'||k==='volley'||k==='pyr'||(k==='run'&&ST.km.day>=2)};
const kmTitle=()=>{const e=KEST[ST.km.dur];return `${KWHO[ST.km.cat]} · ${e?`becslés: ${e}${kmExpired()?' volt':''}`:'még nem tudod, meddig tart'}`};
/* a visszatérő edzés szettjei: a szerver már a könnyített számot adja (workout.exercises[].sets) — az eredeti szám itt nem látszik */
const cbSets=n=>Math.max(1,n-Math.round(n/3));
const CBT=()=>EX.reduce((a,e)=>a+cbSets(e.sets.length),0);
/* a Mai állapotai útvonal-argumentumból (mai.kimelo …). A nap-argumentumok (mai.sze …) és a puszta „mai” nem nyúlnak az állapothoz. */
const DEMOS=['alap','folyamatban','kesz','kimelo','kimelo3','kimelo-edz','vissza','vissza2','konnyitve','kihagyva','tanacs','sajat-kesz','reggel'];
function applyDemo(arg){if(!DEMOS.includes(arg)){if(ST.demo==null)ST.demo='alap';return}
  if(arg===ST.demo)return;ST.demo=arg;
  ST.cb=null;ST.km=null;ST.day='plan';ST.ready='offer';ST.sk={};ST.skord=[];ST.vlog=ST.rlog=ST.extra=ST.mtr=false;ST.xlog=null;
  const km=(cat,dur,day)=>({cat,dur,day,released:false,full:false,asked:false,from:null});
  if(arg==='kimelo')ST.km=km('ILLNESS',1,1);
  if(arg==='kimelo3')ST.km=km('STOMACH',0,3);
  if(arg==='kimelo-edz')ST.km={...km('ILLNESS',1,2),released:true};
  if(arg==='vissza')ST.cb={n:1,of:2,waived:false,undo:true,prev:km('ILLNESS',1,4)};
  if(arg==='vissza2')ST.cb={n:2,of:2,waived:false,undo:false,prev:null};
  if(arg==='konnyitve')ST.ready='done';
  if(arg==='kihagyva'){ST.sk.gym={cat:'TIRED',text:''};ST.skord=['gym']}
  if(arg==='tanacs')ST.sk.gym={cat:'NONE',text:'',adv:true};
  if(arg==='sajat-kesz'){ST.extra=true;ST.xlog=3}
  if(arg==='reggel')ST.mtr=true;
  if(arg==='folyamatban')ST.day='run'; if(arg==='kesz')ST.day='done';}
ST.focus=null;
function repaint(){const ph=$('#phone');const f=ROUTES[F.R]||ROUTES.mai;const t=document.createElement('div');t.innerHTML=f(F.ARG);const nsc=t.querySelector('.scroll'),osc=ph.querySelector('.scroll');
  if(osc&&nsc){const y=osc.scrollTop;osc.innerHTML=nsc.innerHTML;osc.style.cssText=nsc.style.cssText;osc.querySelectorAll('.rise').forEach(e=>e.classList.remove('rise'));osc.scrollTop=y;
    ph.querySelectorAll(':scope>.fh-foot').forEach(e=>e.remove());t.querySelectorAll(':scope>.fh-foot').forEach(e=>ph.insertBefore(e,ph.querySelector(':scope>.toast')))}
  else ph.innerHTML=t.innerHTML}
ST.wz=2;

/* ── MAI ── */
/* ── MAI ── */
/* a hét hét napja (szept 21–27., ma csütörtök) és az, ami aznap van: terem (DAYS), röpi-időpont, futás. A sáv minden napja megnyitható (mai.<nap>). */
const WKD=[['het','H',21,'Hétfő'],['kedd','K',22,'Kedd'],['sze','Sze',23,'Szerda'],['csu','Cs',24,'Csütörtök'],['pen','P',25,'Péntek'],['szo','Szo',26,'Szombat'],['vas','V',27,'Vasárnap']];
const TI=3,DAYALIAS={jovo:'pen','mult-kesz':'kedd','pihen-mas':'vas'},isDay=a=>WKD.some(d=>d[0]===a);
const SLAB={now:'Most',today:'Ma',missed:'Elmaradt',planned:'Tervezett'};
let TOV=null; /* a „ma pihenőnap” változatok saját mai napja */
function dayItems(id){if(id==='csu'&&TOV)return TOV;
  const gd=DAYS.find(d=>d.id===id),di=WKD.findIndex(d=>d[0]===id),rel=di<TI?'missed':di>TI?'planned':'today',out=[];
  if(gd&&gd.ex)out.push({key:di===TI?'gym':id,kind:'gym',tone:'gym',time:'07:30',icon:'t-dumbbell',tag:'Gym',title:gd.t,d:gd,done:di===TI?ST.day==='done':di<TI,state:rel});
  if(id==='kedd')out.push({key:'volleyk',kind:'sport',tone:'sport',time:'18:00',icon:'t-volley',tag:'Röpi',title:'Röplabda',facts:['90 perc','feladó','BVSC csarnok'],done:true,sum:'RPE 7 · 90p · váll 6 · 610 kcal',det:'19:42-kor logolva',state:rel});
  if(id==='sze')out.push({key:'run',kind:'run',tone:'run',time:'18:00',icon:'t-run',tag:'Futás',title:'Sprint-intervallum',facts:['RPE 9–10','6 kör'],done:ST.rlog,sum:'RPE 9 · 6 kör',state:rel,log:{sheet:'runlog'}});
  if(id==='csu')out.push({key:'volley',kind:'sport',tone:'sport',time:'18:00',icon:'t-volley',tag:'Röpi',title:'Röplabda',facts:['90 perc','feladó','BVSC csarnok'],done:ST.vlog,sum:'RPE 7 · 90p · váll 6 · 190 kcal',det:'19:40-kor logolva',state:rel,log:{sheet:'sportlog'}});
  if(id==='pen')out.push({key:'pyr',kind:'run',tone:'run',time:'17:30',icon:'t-run',tag:'Futás',title:'Piramis-intervallum',facts:['RPE 8–9','5 kör'],state:rel});
  if(id==='szo')out.push({key:'meccs',kind:'sport',tone:'sport',time:'10:00',icon:'t-volley',tag:'Röpi',title:'Röplabda',facts:['120 perc','feladó','Kőbánya Sport'],oneOff:true,state:rel});
  return out}
function dstrip(sel='csu'){
  return `<section class="ds rise">${WKD.map(([id,l,n,full],i)=>{const its=dayItems(id),open=its.filter(x=>!x.done),km=open.some(x=>kmCovers(x.key)),dn=its.length-open.length,sk=km?0:open.filter(x=>ST.sk[x.key]).length;
    const say=!its.length?'pihenő':`${dn?`${dn}/${its.length} kész`:'nincs naplózva'}${km?' · kímélő mód':sk?` · ${sk} kihagyva`:''}`;
    return `<button class="${id===sel?'on':''} ${its.length?'':'rest'}" data-go="${i===TI?'mai':'mai.'+id}" aria-label="${full}${i===TI?' · ma':''} · ${n}. · ${say}"><small>${i===TI?'MA':l}</small><b>${n}</b><span class="vs-dots">${its.map(x=>`<u class="${x.tone}"></u>`).join('')}</span><i class="${dn?'ok':''}">${its.length?(I('i-check').repeat(dn)+I('i-skip').repeat(sk)+(km?I('t-kimelo'):''))||'&nbsp;':'pihenő'}</i></button>`}).join('')}</section>`}
const LBL={'back-wide':'Hát','back-mid':'Hát közép','shoulder-rear':'Hátsó váll','biceps-brachialis':'Kar','traps':'Trapéz'};
/* a hatás szava a tervezett szettekből — ugyanaz a küszöb, mint az élő oldalon (logic/dayImpact.ts): 3-ig enyhe, 6-ig közepes, fölötte erős */
const WORD=n=>n<=3?'enyhe':n<=6?'közepes':'erős';
const REGL=k=>REGIONS.find(r=>r.key===k)?.label||k;
/* a mai Pull Day izmai: [kulcs, név, tervezett szett, kész szett] — a kész a futó edzés szettjeiből számol */
function musToday(){const pl={},dn={};EX0.forEach(e=>pl[e.k]=(pl[e.k]||0)+e.sets.length);
  if(ST.day==='done')CER.mus.forEach(([k,,d])=>dn[k]=d);else if(ST.day==='run')EX.forEach(e=>dn[e.k]=(dn[e.k]||0)+e.sets.filter(isDone).length);
  return Object.keys(LBL).map(k=>[k,LBL[k],pl[k]||0,Math.min(pl[k]||0,dn[k]||0)])}
/* ugyanez régiónként — az élő oldal sorai régiók (dayImpact): [jel-kulcs, régió, tervezett, kész] */
function regToday(){const pl={},dn={},tok={};musToday().forEach(([k,,p,d])=>{const r=regionOf(k);pl[r]=(pl[r]||0)+p;dn[r]=(dn[r]||0)+d;if(!tok[r])tok[r]=k});
  return Object.keys(pl).map(r=>[tok[r],REGL(r),pl[r],dn[r]]).sort((a,b)=>b[2]-a[2])}
const todayBody=(cls='')=>bodyLiq('back',musToday().map(([k,,p,d])=>[k,d/4,p/4]),cls);
const mchips=()=>`<div class="fh-chips">${regToday().map(([k,l])=>`<span>${mchp(k,'sm')}${l}</span>`).join('')}</div>`;
const skBlock=k=>box(ST.sk[k]?.adv?'t-skip':catOf(k)?catOf(k)[1]:'t-skip',`Kihagyva · ${skLabel(k)}`,`<p>${skEffect(k)}</p>`);
const skActs=k=>vl(catOf(k)?'Másik ok':'Okot adok',`skwhy:${k}`)+vl('Visszavonom',`skundo:${k}`);
const cbLine=()=>ST.cb.n<=1?'Könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly':'Könnyített: harmadával kevesebb sorozat, a súly nem nő';
function thero(){
  const plan=ST.day==='plan',km=plan&&kmCovers('gym'),sk=!km&&plan&&ST.sk.gym,cb=!km&&!sk&&plan&&ST.cb&&!ST.cb.waived,rel=plan&&!sk&&ST.km&&ST.km.released,light=rel&&!ST.km.full,easy=cb||light;
  const sets=easy?CBT():16,mins=easy?Math.round(78*sets/16/5)*5:78;
  const state=km?`Kímélő mód · ${ST.km.day}. nap`:sk?'Kihagyva':cb?`Visszatérő edzés · ${ST.cb.n}/${ST.cb.of}`:{plan:'Betervezve',run:`Folyamatban · ${DONE()} szett kész a ${TOT()}-ból`,done:`Kész · ${CER.sets} szett a 16-ból`}[ST.day];
  const cta={plan:['Indítsuk','indulas'],run:[`Folytassuk · ${DONE()} szett kész`,'session'],done:[`Eredmény · ${CER.sets} szett`,'review']}[ST.day];
  let body=`<div class="vs-h2"><span class="vs-hb ${km||sk?'off':''}">${todayBody()}<small>${km?'kímélő mód · ma pihen':sk?'ma kimarad':plan?'ennyit kér ma a hátadtól':'sötét = már megvan'}</small></span>
    <div class="vs-hf">${[['5','gyakorlat'],[sets,'szett'],[`~${mins}`,'perc']].map(([b,s])=>`<span><b>${b}</b><small>${s}</small></span>`).join('')}</div></div>`+mchips(),a;
  if(km){const ask=kmExpired()&&!ST.km.asked;
    body+=box(kmIc(),kmTitle(),`<p>Az edzés ma magától kimarad. Nem számít mulasztásnak, a sorozatod marad.</p>${ask?'<p><b>A becsült idő letelt — hogy vagy?</b></p>':''}`);
    a=ve('Jobban vagyok','kmback')+(ask?vl('Még nem','kmnotyet'):'')+vl('Ma mégis edzek','kmrel:1')}
  else if(sk){body+=skBlock('gym');a=skActs('gym')}
  else{
    if(cb)body+=box('t-sprout',cbLine())+`<div class="vs-cb">${EX.map(e=>`<div><span>${e.n}</span><span>${caps(cbSets(e.sets.length),0,dk(e.k))} <b>${cbSets(e.sets.length)}</b> szett</span></div>`).join('')}</div><div class="vs-in" style="padding:8px 0 0">${vl('Kikapcsolom a könnyítést','cbwaive')}${ST.cb.undo?vl('Mégsem vagyok jól','cbundo'):''}</div>`;
    if(rel)body+=box('t-kimelo',light?'Kímélő mód közben edzel · csak ma, könnyítve':'Kímélő mód közben edzel · csak ma',light?'<p>Kevesebb sorozat, kb. 10%-kal kisebb súly.</p>':'')+`<div class="vs-in" style="padding:8px 0 0">${vl('Mégse','kmrel:0')}${light?vl('Kikapcsolom a könnyítést','kmfull'):''}</div>`;
    a=`<button class="btn" style="flex:1" data-go="${cta[1]}">${cta[0]}</button>`+(!rel&&plan?vl('Kihagyom','skip:gym'):'')}
  return hero({lbl:`Ma 07:30 · ${MESO.phase} · Gym · Pull`,verdict:'Pull Day',big:true,sub:state,body,acts:a},1)}
/* a reggeli check-in olvasata (GET /api/train/readiness/today): csak azok az okok, amiket a szerver ad (0–3), és a kímélendő gyakorlatok */
const READY={reasons:[['rested',4],['soreness',7],['motivation',5]],care:[['Rear Delt Fly','jobb vállad',5]]};
const RLAB={rested:['Kipihentség','t-rested'],soreness:['Izomláz','t-soreness'],motivation:['Kedv','t-motivation']};
const andList=a=>a.length<=1?a[0]||'':`${a.slice(0,-1).join(', ')} és ${a[a.length-1]}`;
function readyCard(){
  if(ST.day==='done'||ST.ready==='gone'||ST.sk.gym||kmCovers('gym'))return '';
  const names=READY.care.map(c=>c[0]);
  if(ST.ready==='done')return hero({lbl:'Mai állapot · könnyítve',verdict:'Ma egy fokkal lejjebb',sub:`Minden gyakorlatnál a múlt heti súly marad, nem emelünk.${names.length?` ${/^[aáeéiíoóöőuúüű]/i.test(names[0])?'Az':'A'} ${andList(names)} nehéz szettjei kimaradnak.`:''}`,left:bub('t-tick',{s:56,c:'var(--ok)'}),acts:vl('Visszaállítom a tervet','ready:undo')},2);
  return hero({warn:true,lbl:'Mai állapot · a reggeli check-inből',verdict:'Könnyebb nap javasolt',
    body:(READY.reasons.length?tubes(READY.reasons.map(([k,v])=>({l:RLAB[k][0],ic:RLAB[k][1],v:`${v}/10`,p:v*10,c:k==='soreness'?(v>=7?'var(--bad)':'var(--warn)'):(v<=4?'var(--warn)':'var(--ok)'),mark:'10',t:`${RLAB[k][0]} ${v}/10 — a reggeli check-inből`})),{h:112,cls:'rd'}):'')
      +READY.care.map(([n,r,x])=>box('t-pain',n,`<p>Fáj a ${r}${x!=null?` (${x}/10)`:''}. Ma óvatosan: könnyebb súly, vagy hagyd ki.</p>`,'var(--warn)')).join('')+note('Csak javaslat — magától nem változtat semmit.'),
    acts:ve('Könnyítsük','ready:lighten','sm')+ve('Maradjon a terv','ready:keep','sm ghost')},2)}
function weekTubes(mode){const ti=DAYS.findIndex(x=>x.id===TODAY);
  return tubes(DAYS.map((d,i)=>{if(d.rest||d.sport)return {l:d.d,v:'–',p:0,hatch:true,ic:d.sport?'t-volley':'t-moon',on:`nap.${d.id}`,mark:''};
    const c=dk(d.mus[0][0]),done=mode!=='plan'&&d.done&&i!==ti,now=mode!=='plan'&&i===ti;
    return {l:d.d,v:done?d.done.sets:d.sets,p:done?d.done.sets/19*96:now&&ST.day==='done'?14/19*96:mode==='plan'?d.sets/19*96:0,wl:done||mode==='plan'?null:d.sets/19*96,c,now,ghost:!done&&mode!=='plan'&&!(now&&ST.day==='done'),on:`nap.${d.id}`,mark:d.t.split(' ')[0]}}),{h:96,cls:'wk',gap:6})}
/* betöltés: csendes vázak az oldal saját alakjában (az élő oldalak Skeleton-komponensei) */
const skel=(o,blocks=[320,130,190])=>page('edzes',o,`<div class="vs-sk" role="status" aria-label="Betöltés…">${blocks.map(h=>`<i style="height:${h}px"></i>`).join('')}</div>`);
const kmIn=()=>`<div class="vs-in"><span>${bub('t-kimelo',{s:24})} <b>Kímélő mód</b> · Magától kimarad · nem számít mulasztásnak.</span></div>`;
const doneIn=(sum,det,go)=>`<div class="vs-in"><span>${bub('t-tick',{s:24,c:'var(--ok)'})} <b>${sum}</b>${det?` · ${det}`:''}</span>${go?lk('Megnézem',go):''}</div>`;
const rampOn=it=>it.kind==='run'&&!it.done&&ST.cb&&!ST.cb.waived&&!ST.km;
const itCta=it=>it.state==='planned'||!it.log?'':it.state==='missed'?'Pótold':it.kind==='run'?'Naplózd a futást':'Logold a session-t';
const itSkip=it=>!it.done&&!it.oneOff&&it.state!=='planned'&&!ST.sk[it.key]&&!kmCovers(it.key);
const itChip=it=>{const km=!it.done&&kmCovers(it.key),sk=!it.done&&!km&&ST.sk[it.key];return it.done?st('Megvan','ok'):km?st('Kímélő mód'):sk?st('Kihagyva'):st(SLAB[it.state],it.state==='missed'?'bad':it.state==='planned'?'q':'plan')};
/* egy alkalom sorként (az élő TodaySessionCard): címke · tények · állapot, alatta a megvolt-sáv / kímélő / kihagyva / a teendő */
function sessStep(it){const km=!it.done&&kmCovers(it.key),sk=!it.done&&!km&&ST.sk[it.key],cta=itCta(it),can=itSkip(it);
  return step({time:it.time,icon:it.icon,title:it.title,sub:`${[it.tag,...(it.facts||[])].join(' · ')}${it.oneOff?' · egyszeri':''} ${itChip(it)}`})
    +(it.done?doneIn(it.sum,it.det,it.go):km?kmIn():sk?`<div class="vs-in col">${skBlock(it.key)}<div>${skActs(it.key)}</div></div>`
      :(rampOn(it)?`<div class="vs-in"><span>${bub('t-sprout',{s:24})} <b>Visszatérő futás</b> · Első futás kihagyás után: kb. fele olyan hosszú, laza tempóban.</span></div>`:'')
        +(cta||can?`<div class="vs-in">${cta?lk(cta,it.log):''}${can?vl(it.state==='missed'?'Kihagytam':'Kihagyom',`skip:${it.key}`):''}</div>`:''))}
/* ugyanez fő kártyaként, ha a napnak nincs termi edzése */
function sessHero(it,lbl){const km=!it.done&&kmCovers(it.key),sk=!it.done&&!km&&ST.sk[it.key],cta=itCta(it),can=itSkip(it);let body='',a='';
  if(it.done)body=box('t-tick',it.sum,it.det?`<p>${it.det}</p>`:'','var(--ok)');
  else if(km)body=box('t-kimelo','Kímélő mód','<p>Magától kimarad · nem számít mulasztásnak.</p>');
  else if(sk){body=skBlock(it.key);a=skActs(it.key)}
  else{if(rampOn(it))body=box('t-sprout','Visszatérő futás','<p>Első futás kihagyás után: kb. fele olyan hosszú, laza tempóban.</p>');
    a=(cta?`<button class="btn" style="flex:1"${act(it.log)}>${cta}</button>`:'')+(can?vl(it.state==='missed'?'Kihagytam':'Kihagyom',`skip:${it.key}`):'')}
  const stt=it.done?'Megvan':km?'Kímélő mód':sk?'Kihagyva':SLAB[it.state];
  return hero({lbl:`${lbl} · ${it.time} · ${it.tag}`,verdict:it.title,big:true,sub:`${stt} · ${(it.facts||[]).join(' · ')}${it.oneOff?' · egyszeri esemény':''}`,left:bub(it.icon,{s:60}),body,acts:a},1)}
/* egy másik nap termi edzése: a /today csak a mai napról tud, a cím és a számok a mesociklus napjából jönnek */
function gymDayHero(it,lbl){const d=it.d,km=!it.done&&kmCovers(it.key);
  return hero({lbl:`${lbl} · ${it.time} · Gym`,verdict:d.t,big:true,sub:it.done?'Megvan':km?'Kímélő mód':SLAB[it.state],
    body:`<div class="vs-h2"><span class="vs-hb ${it.done?'':'off'}">${bodyLiq(dayView(d),d.mus.map(([k,s])=>[k,it.done?s/7:0,s/7]))}<small>${it.done?'ez dolgozott aznap':'ezt kéri aznap a terv'}</small></span><div class="vs-hf">${[[d.ex.length,'gyakorlat'],[d.sets,'szett'],[`~${d.min}`,'perc']].map(([b,s])=>`<span><b>${b}</b><small>${s}</small></span>`).join('')}</div></div>`
      +(km?box('t-kimelo','Kímélő mód','<p>Magától kimarad · nem számít mulasztásnak.</p>'):''),
    acts:it.done?btn('Kész · megnézem','review'):km?'':`<button class="btn" style="flex:1" data-go="indulas">Kezdjük el</button>`},1)}
/* a pihenőnap hete: a megvolt edzésnapok teli edények, a hátralévők szaggatott terv-vonalak (terv: activeMeso.days, megvolt: useWeekWorkouts) */
const restWeek=()=>tubes(DAYS.map((d,i)=>{if(i===TI||!d.ex)return {l:d.d,v:'–',p:0,hatch:true,ic:d.sport?'t-volley':'t-moon',mark:'',t:`${d.full} · ${d.sport?'sport':'pihenőnap'}`};
  const c=dk(d.mus[0][0]),done=i<TI;return {l:d.d,v:d.sets,p:done?d.sets/19*96:0,wl:done?null:d.sets/19*96,ghost:!done,c,mark:d.t.split(' ')[0],on:`mai.${d.id}`}}),{h:96,cls:'wk',gap:6});
const navRows=()=>ls(rw({icon:'c-i-retegek',title:`${MESO.name} · ${MESO.phase} · ${MESO.week}. hét / ${MESO.of}`,sub:'Mezociklus áttekintő',on:'run'}),rw({icon:'c-i-sport',title:'Sportjaid és szezonod',on:'sport'}));
/* a mozgás kalóriája: a Fuel kiszolgált energiája (useFuelDay().fuel.energy) — ami már bent van, és ami még jön */
const energyCard=(earned,pend,i)=>card(head('t-flame','Amit a mozgásod hozzáad')+`<p class="fh-big">+${earned}<small>kcal</small></p>${split(earned/(earned+pend)*100,pend/(earned+pend)*100,'var(--carb)')}
    <div class="vs-lg"><span><i class="a"></i><b>${earned} kcal</b> már a keretedben</span>${pend?`<span><i class="b"></i><b>+${pend} kcal</b> még jön, ha megcsinálod</span>`:''}</div>`
    +note(`${ST.day==='run'?'A folyamatban lévő edzés a befejezéskor kerül a keretedbe. ':''}Ugyanez a szám áll a Fuel keretében. Becslés, nem mérés.`),{i});
/* a mai mozgás hatása régiónként: [jel-kulcs, régió, tervezett, kész]; sportnál a terv az 1–3-as becsült erősség */
const impactCard=(rows,i,sportEst,plus='')=>{const mx=Math.max(1,...rows.map(r=>r[2]));
  return card(head('t-muscle','Mit terhel a mai mozgásod')+rows.map(([k,l,p,d])=>`<div class="fh-mus vs-mt">${mchp(k,'sm')}<span class="l">${l}<small>${sportEst?['enyhe','közepes','erős'][clamp(p,1,3)-1]:WORD(p)}</small></span><span class="v">${sportEst?'':`${d} / ${p} szett`}</span>${split(d/mx*100,(p-d)/mx*100,dk(k))}</div>`).join('')
    +note((sportEst?'A folyadék a sport becsült terhelése — nem mért adat. Becslés, nem mérés.':'A halvány folyadék a tervezett terhelés, a sötét a már megszolgált. Becslés, nem mérés.')+plus),{i})};
const mtrCard=i=>card(head('t-dawn','Reggeli edzés')+txt('A reggeli mozgás előrébb tolja a belső órát — este könnyebben alszol el. Az ébredésed szerint az ablakod 06:30–08:30.')
    +ls(rw({icon:'t-clock',title:'Pén 17:00 → 06:30',sub:'ezt az edzőtermi időpontot tennénk át'}))+acts(ve('Áthelyezés a reggeli ablakba','mtr:1','sm'))+acts(vl('Maradjon így','mtr:0')),{i});
function mai(arg){
  arg=DAYALIAS[arg]||arg;applyDemo(arg);TOV=null;
  const T0={title:'Edzés',sub:`${MESO.name} · ${MESO.week}. hét / ${MESO.of}`,tab:'mai'};
  if(arg==='tolt')return skel(T0,[62,340,140,200]);
  if(arg==='ures')return page('edzes',{title:'Edzés',sub:'Mai nap',tab:'mai'},`
    ${hero({lbl:'Mai nap',verdict:'Itt fog élni a mai edzésed.',sub:'Előbb tervezz egy mesociklust.',art:'t-peak',acts:btn('+ Tervezz mesociklust','ujterv')+lk('+ Saját edzés',{sheet:'custom'})})}`);
  if(arg==='pihen'){TOV=[];return page('edzes',T0,`${dstrip()}
    ${hero({lbl:'Ma pihenőnap',verdict:'Ma pihenőnap van.',sub:'Nincs tervezett edzés mára — a heti rended a Terv fülön találod.',left:bub('t-moon',{s:56}),body:`<div class="vs-hg">${restWeek()}</div>`+note('A heted: a teli edények megvoltak, a szaggatott vonal a még hátralévő napok terve.'),acts:btn('+ Saját edzés',{sheet:'custom'})},1)}
    ${sec(1,'Innen tovább',2)}
    ${card(navRows(),{i:2})}`)}
  if(arg==='pihen-sajat'){TOV=[];return page('edzes',T0,`${dstrip()}
    ${hero({lbl:'Saját edzés · folyamatban',verdict:'Pihenőnapi felső',big:true,sub:'Folyamatban · 4 szett kész',left:bub('t-dumbbell',{s:60}),acts:`<button class="btn" style="flex:1" data-go="session">Folytassuk · 4 szett kész</button>`},1)}
    ${sec(1,'Innen tovább',2)}
    ${card(navRows(),{i:2})}`)}
  if(arg==='pihen-sport'){const it={key:'volley',kind:'sport',tone:'sport',time:'18:00',icon:'t-volley',tag:'Röpi',title:'Röplabda',facts:['90 perc','feladó','BVSC csarnok'],done:ST.vlog,sum:'RPE 7 · 90p · váll 6 · 190 kcal',det:'19:40-kor logolva',state:'today',log:{sheet:'sportlog'}};TOV=[it];
    const off=kmCovers('volley')||ST.sk.volley,e=ST.vlog?190:0,p=ST.vlog||off?0:190;
    return page('edzes',T0,`${dstrip()}
    ${sessHero(it,'Ma')}
    ${e+p?sec(1,'A mai keretedhez',2)+energyCard(e,p,2):''}
    ${sec(e+p?2:1,'Hatás az izomzatodra',3)}
    ${impactCard([['shoulder-front','Váll',3,ST.vlog?3:0],['quad','Láb',2,ST.vlog?2:0],['core','Core',1,ST.vlog?1:0]],3,true)}
    ${sec(e+p?3:2,'Innen tovább',4)}
    ${card(navRows()+acts(lk('+ Saját edzés',{sheet:'custom'})),{i:4})}`)}
  if(isDay(arg)&&arg!=='csu'){const [id,,n,full]=WKD.find(d=>d[0]===arg),di=WKD.findIndex(d=>d[0]===arg),its=dayItems(id),lbl=`${full} · szept ${n}.`,first=its[0],rest=its.slice(1);let k=0;
    return page('edzes',{title:'Edzés',sub:lbl,tab:'mai'},`${dstrip(id)}
    ${!first?hero({lbl,verdict:'Ezen a napon nincs tervezett edzés.',art:'t-moon'},1):first.kind==='gym'?gymDayHero(first,full):sessHero(first,full)}
    ${rest.length?sec(++k,'Ezen a napon még',2)+card(ls(rest.map(sessStep)),{i:2}):''}
    ${di<TI&&its.length?card(`<p class="fh-note" style="margin:0">Az elmúlt 7 nap kimaradt alkalmaihoz utólag is megadhatod, miért maradtak ki.</p>`,{i:3}):''}
    ${sec(++k,'Innen tovább',4)}
    ${card(navRows(),{i:4})}`)}
  const others=dayItems('csu').filter(x=>x.kind!=='gym');
  const gOff=kmCovers('gym')||ST.sk.gym,vOff=kmCovers('volley')||ST.sk.volley;
  const earned=(ST.day==='done'?460:0)+(ST.vlog?190:0)+(ST.xlog!=null?310:0),pend=(ST.day==='done'||gOff?0:460)+(ST.vlog||vOff?0:190);
  const xs=ST.xlog!=null?SPORTS[ST.xlog]:null;
  const extra=(ST.extra?step({icon:'t-dumbbell',title:'Pihenőnapi felső',sub:`Saját · 3 gyakorlat ${st('Megvan','ok')}`})+doneIn('Kész','Megnézem az összegzést','review'):'')
    +(xs?step({time:'06:40',icon:xs[0],title:xs[1],sub:`${xs[2]} perc ${st('Megvan','ok')}`})+doneIn(`RPE 5 · ${xs[2]}p · 310 kcal`,'06:40-kor logolva'):'');
  const rc=readyCard();let n=0;
  return page('edzes',T0,`${dstrip()}
  ${thero()}
  ${rc?sec(++n,'Mielőtt elkezded',2)+rc:''}
  ${sec(++n,'Ma még',3)}
  ${card(ls(others.map(sessStep),extra),{i:3})}
  ${earned+pend?sec(++n,'A mai keretedhez',4)+energyCard(earned,pend,4):''}
  ${sec(++n,'Hatás az izomzatodra',5)}
  ${impactCard(regToday(),5,false,' A mai gym terved látod itt — a sportod terhelését külön, becsléssel számoljuk.')}
  ${sec(++n,'Vagy inkább',6)}
  ${card(pair([['t-dumbbell','<small>Gyors indítás</small>Egyedi edzés','data-sheet="custom"'],['t-volley','<small>Gyors indítás</small>Sport naplózása','data-go="sportlog"']])+`<div class="vl" style="margin-top:14px">${navRows()}</div>`,{i:6})}
  ${ST.mtr?sec(++n,'Reggeli edzés-ablak',7)+mtrCard(7):''}`)}
function whySheet(arg){
  if(arg){const [wk,wc]=arg.split(':');ST.whyk=wk;if(!ST.sk[wk]){ST.sk[wk]={cat:'NONE',text:''};ST.skord.push(wk)}if(wc){ST.sk[wk].cat=wc;if(wc==='OTHER')ST.sk[wk].text='Családi program jött közbe'}}
  const k=ST.whyk,cur=ST.sk[k]||{cat:'NONE'},c=CATS.find(x=>x[0]===cur.cat),kmHere=ST.km&&ST.km.from===k&&c&&c[3];
  const nt=kmHere?box('t-kimelo','Kímélő mód bekapcsolva','<p>Amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.</p>')
    :!c?box('t-info','Nem kötelező','<p>Ha megmondod, miért, a terv és az edző ehhez igazodik.</p>')
    :c[3]?box('t-heart','Nem számít mulasztásnak.',`<p>${CARE[c[0]]}</p>`):passKey()===k?box('t-shield','Ezt a heti szabadjegyed fedezi','<p>A sorozatod marad.</p>'):box('t-info','Ez rendes kihagyásnak számít','<p>A heti szabadjegyet már felhasználtad. Semmi gond, jövő héten új jár.</p>');
  return `${sh(`Kihagyva · ${SKT[k]}`,'Miért marad ki?','Nem kötelező — segít, hogy a terv hozzád igazodjon.')}
  <div class="vs-opts">${CATS.map(([id,ic,l])=>`<button class="${cur.cat===id?'on':''}" data-ve="why:${id}">${bub(ic,{s:36})}<span>${l}</span></button>`).join('')}</div>
  ${cur.cat==='OTHER'?lab('Mi történt? · saját szavakkal')+`<div class="fh-in vs-fld ${cur.text?'':'ph'}"><span>${cur.text||'pl. családi program jött közbe'}</span>${bub('t-mic',{s:30})}</div>`:''}
  ${c&&c[3]&&(!ST.km||kmHere)?lab('Meddig tarthat?')+chips(KDUR,kmHere?ST.km.dur:-1,i=>`kmdur:${i}`):''}
  ${nt}
  ${acts(ve('Kész','whydone:1','',c?'style="flex:1"':'disabled style="flex:1;opacity:.45"'),vl('Most nem mondom','whydone:0'))}`}
/* „Üdv újra!” — a szerver visszatérési szabálya (recovery.period.return: daysOut, rule, shiftDays, newEndDate, rampSessions) három sorban */
const UDVX=[[d=>`${d>=1&&d<=2?d:2} nap kiesés`,'a program megy tovább a naptár szerint.','Az első edzés könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.'],[()=>'3 nap kiesés','onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz (okt. 18. → okt. 25.).','Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.'],[()=>'11 nap kiesés','egy hetet visszalépünk: a 2. héttel folytatod, a program vége 2 héttel később lesz (okt. 18. → nov. 1.).','Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.']];
function udvSheet(arg){if(arg!=null&&arg!=='')ST.udv=clamp(+arg||0,0,2);const [h,l1,l2]=UDVX[ST.udv],two2=ST.udv>0;
  return `${sh('Kímélő mód vége','Üdv újra!','Így folytatjuk — a terv magától igazodik.')}
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
/* ── SPORT ── */
/* a heti sport-rend időpontjai (sport.schedule.volleyball.sessions): [nap-id, nap, idő, perc, helyszín, szerep, intenzitás, egyszeri] */
const SLOTS=[['kedd','K','18:00',90,'BVSC csarnok','feladó','közepes',0],['csu','Cs','18:00',90,'BVSC csarnok','feladó','közepes',0],['szo','Szo','10:00',120,'Kőbánya Sport','feladó','magas',1]];
/* egyszeri események (sportEvents): [dátum, idő, perc, fajta, helyszín] */
const SEV=[['szept 26., szombat','10:00',120,'meccs','Kőbánya Sport'],['okt 4., vasárnap','09:00',90,'edzés','BVSC csarnok']];
/* a napló (sport.sessions): [címke, dátum, idő, perc, [setek|körök, n], RPE, intenzitás, váll, jegyzet] */
const SLOG=[['Röpi','szept 22., kedd','19:42',90,['setek',5],7,6,6,'Jól ment a nyitás, a harmadik szettben kicsit húzott a váll.'],['Röpi','szept 19., szombat','12:10',120,['setek',4],8,7,7,''],['Cross','szept 17., csütörtök','18:50',40,['körök',5],8,null,null,'Rövid, de kemény.'],['Röpi','szept 15., kedd','19:40',90,['setek',5],6,5,null,'Könnyebb nap, sok technika.']];
/* keresztterhelés sorai (sport.crossLoad): [terület, ikon, hatás, mire, miért, figyelmeztetés] */
const XL=[['Edzés','t-dumbbell','−2 szett','Váll · heti szettszám','A röpi ütései és nyitásai a vállat is terhelik, ezért a heti váll-szettekből kettőt levonunk.',0],['Fuel','t-plate','+190 kcal','Edzésnapi keret','A 90 perces edzés többlete a napi keretedhez adódik, amint naplóztad.',0],['Alvás','t-moon','+20 perc','Elalvás röpi után','Esti edzés után később nyugszik meg a szervezet — aznap később kérünk ágyba.',0],['Súly','t-weight','±0,4 kg','Másnapi mérés','Meccs után a folyadék miatt ingadozhat a súlyod; ezt nem vesszük trendnek.',0],['Minták','t-pattern','figyeljük','Váll-terhelés 7 fölött','Két egymást követő magas váll-terhelés után a Pull Day vállgyakorlata könnyebb súlyt kap.',1]];
const d1=n=>(Math.round(n*10)/10).toFixed(1).replace('.',',');
function sport(arg='terv'){
  const T0={title:'Sport',sub:'Edzés',back:'mai'};
  if(arg==='tolt')return skel(T0,[300,60,330]);
  if(arg==='megvolt')ST.vlog=true;
  const tab=/^naplo/.test(arg)?'naplo':/^cross/.test(arg)?'cross':'terv',none=arg==='nincs';
  const logged=1+(ST.vlog?1:0),hrs=1.5*logged,slots=none?[]:SLOTS;
  const B={terv:()=>none?`${sec(1,'Heti ritmus',2)}
    ${card(emptyTank('t-calendar','A heti rended itt jelenik majd meg.',btn('+ Állítsd be a heti rended',{toast:'Beállítások · Edzés · Sport heti rend'},'sm')),{i:2})}
    ${sec(2,'Egyszeri események',3)}
    ${card(acts(lk('＋ Egyszeri esemény',{sheet:'sportev'})),{i:3})}`
    :`${sec(1,`Heti ritmus · ${d1(slots.reduce((s,x)=>s+x[3],0)/60)} ó`,2)}
    ${card(ls(WKD.map(([id,l])=>{const ss=slots.filter(s=>s[0]===id);if(!ss.length)return rw({cls:'muted',left:num(l),title:'nincs session'});
        return ss.map(([,,t,min,court,role,inten,one])=>{const today=id==='csu';return rw({left:num(l),title:`${t} · ${min}p ${st('Röpi')}${today?` ${st('Ma','plan')}`:''}${one?` ${st('Egyszeri')}`:''}`,sub:[court,role,inten].filter(Boolean).join(' · '),right:today?(ST.vlog?st('Kész','ok'):lk('Logold ›',{sheet:'sportlog'})):''})}).join('')}))
      +box('t-repeat','Heti ritmus · független','<p>A röplabda a saját heti rendjén megy, a mesociklustól függetlenül. Új mesociklus indításakor a sport terhelését beleszámoljuk a heti szettszámokba.</p>'),{i:2})}
    ${sec(2,'Egyszeri események',3)}
    ${card((ST.evs.length?ls(ST.evs.map(i=>{const [d,t,min,kind,loc]=SEV[i];return rw({icon:'t-calendar',title:`${d} · ${t} ${st('Röpi')}`,sub:[`${min}p`,kind,loc].filter(Boolean).join(' · '),right:vl('törlés',`evdel:${i}`)})})):'')
      +acts(lk('＋ Egyszeri esemény',{sheet:'sportev'})),{i:3})}`,
    naplo:()=>arg==='naplo-ures'?`${sec(1,'Napló',2)}${card(emptyTank('t-journal','Még nincs logolt session.'),{i:2})}`
    :`${sec(1,`Utolsó ${SLOG.length} session · átlag 38 ugrás`,2)}
    ${card(SLOG.map(([tag,d,t,min,[k,v],rpe,int,sh,q])=>`<div class="vs-log">${rw({icon:tag==='Cross'?'t-crossfit':'t-volley',title:`${d} · ${t}`,sub:`${tag} · idő ${min}p · ${k} ${v}`,v:`${rpe} <small>RPE</small>`})}
      ${int!=null||sh!=null?`<div class="vs-l2">${int!=null?`<span>Intenzitás</span>${level(int*10,{c:'var(--dom)',h:16,val:String(int)})}`:''}${sh!=null?`<span>Váll terhelés</span>${level(sh*10,{c:sh>=7?'var(--warn)':dk('shoulder-front'),h:16,val:String(sh)})}`:''}</div>`:''}${q?`<p class="vs-xl">„${q}”</p>`:''}</div>`).join(''),{i:2})}`,
    cross:()=>arg==='cross-ures'?`${sec(1,'Keresztrendszer hatások',2)}${card(emptyTank('t-chain','A cross-load elemzés itt jelenik majd meg.'),{i:2})}`
    :`${sec(1,'Keresztrendszer hatások',2)}
    ${card(msg('mezo','A röplabda terhelését minden területen beszámítjuk: az edzés szettszámaiban, az étkezés időzítésében, az alvásban, a testsúly ingadozásában és a mintázatoknál.','keresztrendszer hatások')
      +tags(['28 nap sportterhelése','izomterhelés-átvitel','sport-szabály','célok frissítése'])
      +`<div class="vl" style="margin-top:12px">${XL.map(([sys,ic,imp,tg,why,warn])=>rw({icon:ic,title:`${tg} ${st(sys,warn?'bad':'q')}`,sub:why,v:imp})).join('')}</div>`
      +note('A cross-load sosem büntet — plafont igazít és időzítést ajánl, döntést nem vesz el.'),{i:2})}`}[tab];
  return page('edzes',T0,`
  ${hero({lbl:'Sport · ezen a héten',verdict:none?'Még nincs heti sport-rended.':`${logged} session megvolt a ${slots.length}-ból ezen a héten.`,
    body:(none?'':`<div class="vs-hg">${tubes(WKD.map(([id,l])=>{const s=slots.find(x=>x[0]===id);if(!s)return {l,v:'–',p:0,hatch:true,mark:'',t:`${l} · nincs session`};const done=id==='kedd'||(id==='csu'&&ST.vlog);
      return {l,v:`${s[3]}′`,p:done?s[3]/120*94:0,wl:done?null:s[3]/120*94,ghost:!done,now:id==='csu',ic:'t-volley',mark:s[2],c:'var(--dom)',on:`mai${id==='csu'?'':'.'+id}`}}),{h:92,cls:'wk',gap:6})}</div>`)
      +facts([[none?'—':`${d1(hrs)} ó`,'pályán e héten'],[none?'—':ST.vlog?'7,0':'7,0','RPE átlag · 1–10'],[none?'—':'6,0','váll-terhelés']]),acts:btn('＋ Log','sportlog')})}
  ${segw([['Heti terv','sport.terv',tab==='terv'],['Napló','sport.naplo',tab==='naplo'],['Cross-load','sport.cross',tab==='cross']])}${B()}`)}
/* a sport-űrlap egy mezője a sport saját leírásából */
function spField(f,mode){const t=f[0];
  if(t==='m')return '';
  if(t==='n')return f[6]&&f[6]!==mode?'':`<div class="vl vs-fl">${stp(`${f[2]} · ${f[3]}`,String(f[4]).replace('.',','))}</div>`;
  if(t==='r')return blk(f[1],`<div class="vs-rng"><input type="range" min="1" max="10" step="1" value="${f[2]}" style="--p:${(f[2]-1)/9*100}%" aria-label="${f[1]}"><b><span>${f[2]}</span> / 10</b></div>`);
  if(t==='c')return blk(f[2],chips(f[3],f[4]));
  return blk(f[1],fld(f[2],true))}
function sportlog(arg){
  if(!arg)return page('edzes',{title:'Naplózás',sub:'Sport · ma',back:'mai'},`
    ${hero({lbl:'Naplózás',verdict:'Mi volt ma mozgás?',sub:'Válaszd ki, mit csináltál. A következő lapon csak azt kérdezem, ami annál a sportnál tényleg számít.'})}
    ${sec(1,'Válassz sportot',1)}
    ${card(`<div class="vs-spg">${SPORTS.map(([ic,l,min,f],i)=>`<button data-go="${f?`sportlog.${i}`:'futas'}">${bub(ic,{s:52,c:ic==='t-run'?'#1877F2':'var(--dom)'})}<span>${l}<small>~${min} perc</small></span></button>`).join('')}</div>`,{i:1})}`,{nonav:true,pad:'60px'});
  const err=arg==='hiba',own=arg==='sajat',i=clamp(parseInt(arg,10)||0,0,SPORTS.length-2),[ic,l,,F0]=SPORTS[i],modes=F0.find(f=>f[0]==='m');
  if(ST.sp.i!==i)ST.sp={i,mode:modes?modes[1][0][0]:null,kcal:null};
  if(own)ST.sp.kcal=520;
  const mode=ST.sp.mode,min=F0.find(f=>f[1]==='minutes')[4];
  return page('edzes',{title:l,sub:'Naplózás · ma',back:'sportlog'},`
  ${hero({lbl:'Naplózás · ma',verdict:'Hogy ment?',sub:'Csak az, ami ennél a sportnál számít.',left:bub(ic,{s:64}),body:modes?`<div class="fh-seg" style="margin-top:14px" role="group" aria-label="Típus">${modes[1].map(([id,t])=>`<button class="${id===mode?'on':''}" data-ve="spmode:${id}">${t}</button>`).join('')}</div>`:''})}
  ${sec(1,'Idő és terhelés',1)}
  ${card(F0.map(f=>spField(f,mode)).join(''),{cls:'vs-form',i:1})}
  ${sec(2,'Kalória',2)}
  ${card(ls(rw({icon:'t-plate',title:'Kalória: becslést mentünk',sub:'A pontos értéket mentés után mutatjuk — a te súlyodból és a mozgás fajtájából jön.',right:lk('Saját érték',{sheet:'kcal'})}))
    +(ST.sp.kcal!=null?note(`Saját értéket adtál meg (${ST.sp.kcal} kcal) — ezt mentjük, nem a becslést.`)+acts(vl('Töröld a saját értéket','kcalclr')):''),{i:2})}
  ${err?card(box('t-info','Nem sikerült elmenteni a mozgást.','<p>Nézd meg a kapcsolatot, és próbáld újra.</p>','var(--bad)')+acts(ve('Újra','sportsave','sm')),{i:3}):''}`,
  {nonav:true,foot:ve(`Naplózom · ${min} perc`,'sportsave','','style="flex:1"')})}

/* ── FUTÁS ── */
/* ivl: egy intervall-edzés mint egy cső, amiben a szint az iramot követi — [mp, szint 0..1, fajta]; a szakaszokból (structure.weeks[].sessions[].segments) */
const ivl=segs=>`<span class="vs-ivl" aria-hidden="true">${segs.map(([s,h,k])=>`<i class="${k}" style="flex:${s};--h:${h*100}%"></i>`).join('')}</span>`;
const ivSprint=(r=6,rest=45)=>[[60,.4,'w'],...Array.from({length:r},()=>[[15,1,'s'],[rest,.18,'r']]).flat(),[60,.3,'w']];
const ivPyr=(work=[15,30,45,30,15])=>[[60,.4,'w'],...work.flatMap(s=>[[s,1,'s'],[s*2,.18,'r']]),[60,.3,'w']];
const IV_SPRINT=ivSprint(),IV_PYR=ivPyr();
const DSH=['H','K','Sze','Cs','P','Szo','V'],DLG=['Hét','Kedd','Sze','Csü','Pén','Szo','Vas'];
/* a futótervek (runningBlocks) és a napló (runSessions): [dátum, edzés, RPE, kör, pulzus-megnyugvás mp, jegyzet] */
const RBL={a:{t:'Robbanékonyság 01',goal:'sprint-állóképesség röpihez',from:'szept 8.',to:'nov 2.',weeks:8,cur:3,phase:'Építő fázis'},p:{t:'5K-alapozó',goal:'állóképesség',from:'nov 9.',to:'dec 20.',weeks:6,start:'nov 9.'},x:{t:'Téli base 02',goal:'alapozás',from:'jan 12.',to:'márc 8.',weeks:8,sum:'16 futásból 14 megvolt; a pulzus-megnyugvás 61-ről 52 mp-re javult.'}};
const RLOG=[['szept 18., péntek','Piramis',8,5,46,''],['szept 16., szerda','Sprint',9,6,49,'Az utolsó két kör nehéz volt, de tartottam az iramot.'],['szept 11., péntek','Piramis',8,5,52,''],['szept 9., szerda','Sprint',9,5,56,'Az első hét: öt kör ment tisztán.']];
function futas(arg='het'){
  const T0={title:'Futás',sub:'Edzés',back:'terv'};
  if(arg==='tolt')return skel(T0,[300,60,300]);
  if(arg==='megvolt')ST.rlog=true;
  const tab=/^naplo/.test(arg)?'naplo':/^tervek/.test(arg)?'tervek':'het',none=arg==='nincs',A=RBL.a,R=ST.rb,dn=ST.rlog?1:0;
  /* a hét két előírt edzése: [név, nap, idő, RPE, szakasz-cső, címkék, állapot] — kész / ma / múlt (pótolható) / jövő */
  const SES=[['Sprint-intervallum',R.sprint.day,R.sprint.time,'9–10',ivSprint(R.sprint.rounds,R.sprint.rest),['5p bemelegítés',`${R.sprint.rounds}× · 15mp`,`${R.sprint.rest}mp séta`,'5p levezetés'],ST.rlog?'done':'past',''],
    ['Piramis-intervallum',R.pyr.day,R.pyr.time,'8–9',ivPyr(R.pyr.work),['5p bemelegítés',`${R.pyr.work.join('／')} mp`,'pihenő = szakasz × 2','5p levezetés'],'future','pyr']];
  const B={het:()=>none?`${sec(1,'E heti edzés',2)}${card(emptyTank('t-run','Nincs aktív futóterved — a Tervek fülön aktiválj egyet.'),{i:2})}`
    :arg==='het-nincs'?`${sec(1,'E heti edzés',2)}${card(emptyTank('t-calendar',`Az aktuális hét (${A.cur}) nincs a tervben.`),{i:2})}`
    :`${sec(1,`E hét · ${SES.length} edzés`,2)}
    ${card(SES.map(([n,d,t,rpe,iv,sg,stt,a])=>`<div class="vs-log">${rw({icon:'t-run',title:`${n}${stt==='today'?` ${st('Ma','plan')}`:''}`,sub:`${DLG[d]} · ${t} · RPE ${rpe}`,right:stt==='done'?st('Kész','ok'):stt==='future'?`<span class="vs-later">Naplózás ›</span>`:lk(stt==='today'?'Naplózd ›':'Pótold ›',{sheet:'runlog',arg:a})})}${ivl(iv)}${tags(sg)}</div>`).join('')
      +note('A cső szintje az iram: magas a sprint, alacsony a séta, a két vége a bemelegítés és a levezetés.'),{i:2})}
    ${sec(2,'Keresztterhelés · futás és láb',3)}
    ${card(ls(rw({icon:'t-chain',title:'Comb / Lábhajlító · −2 szett',sub:'A sprintek a combot és a lábhajlítót is terhelik, ezért a heti láb-szettekből kettőt levonunk — ugyanúgy, mint a röplabdánál.'})),{i:3})}`,
    naplo:()=>arg==='naplo-ures'?`${sec(1,'Napló',2)}${card(emptyTank('t-journal','Még nincs logolt futás.'),{i:2})}`
    :(()=>{const hr=RLOG.map(r=>r[4]).reverse(),dl=hr[hr.length-1]-hr[0];return `${sec(1,`Pulzus-megnyugvás · utolsó ${hr.length} futás`,2)}
    ${card(`<p class="fh-big">${dl<=0?'−':'+'}${Math.abs(dl)}<small>mp az első óta</small></p>${areaM(hr,{h:120,labels:RLOG.map(r=>r[0].split(',')[0]).reverse(),c:'#19C7C0',c2:'#1877F2',min:36,max:60},[[hr.length-1,`${hr[hr.length-1]} mp`,'now']])}`+note('mp a nyugalmi pulzusig — alacsonyabb = jobb regeneráció'),{i:2})}
    ${sec(2,`Utolsó ${RLOG.length} futás`,3)}
    ${card(ls(RLOG.map(([d,t,r,k,h,q])=>rw({icon:'t-run',title:`${t} ${st('Futás')}`,sub:`${d} · RPE ${r} · ${k} kör${q?`<span class="vs-q">${q}</span>`:''}`,v:`${h} <small>mp pulzus</small>`}))),{i:3})}`})(),
    tervek:()=>arg==='tervek-ures'?`${sec(1,'Tervek',2)}${card(emptyTank('t-calendar','Még nincs futóterved — itt fognak élni a blokkjaid.'),{i:2})}`
    :`${sec(1,`Aktív · ${none?0:1}`,2)}${none?'':card(ls(rw({icon:'t-run',title:`${A.t} ${st('aktív','ok')}`,sub:`${A.goal} · ${A.from} – ${A.to} · ${A.weeks} hét · Hét ${A.cur} / ${A.weeks}<span class="vs-rowbar">${caps(A.weeks,A.cur-1,'var(--dom)',{cur:A.cur-1,cls:'wide'})}</span>`,on:'futasterv'})),{i:2})}
    ${sec(2,'Tervezett · 1',3)}${card(ls(rw({icon:'t-calendar',title:`${RBL.p.t} ${st('tervezett')}`,sub:`${RBL.p.from} – ${RBL.p.to} · ${RBL.p.weeks} hét`,on:'futasterv.tervezett'})),{i:3})}
    ${sec(3,'Archív · 1',4)}${card(ls(rw({icon:'t-history',title:`${RBL.x.t} ${st('archív')}`,sub:`${RBL.x.from} – ${RBL.x.to} · ${RBL.x.weeks} hét<span class="vs-q">${RBL.x.sum}</span>`,on:'futasterv.archiv'})),{i:4})}`}[tab];
  const logCta=!none&&!ST.rlog?btn('Pótold · Sprint-intervallum',{sheet:'runlog'}):'';
  return page('edzes',T0,`
  ${none?hero({lbl:'Futás',verdict:'Nincs aktív futóterved.',sub:'A Tervek fülön aktiválj egyet.',left:bub('t-run',{s:60}),body:facts([['0','aktív terv'],['1','tervezett'],[String(RLOG.length),'logolt futás']]),acts:tab==='tervek'?btn('＋ Új terv','futasterv.uj'):''})
  :hero({lbl:`${A.goal} · ${A.phase}`,verdict:`A ${A.weeks} hetes blokk ${A.cur}. hetében jársz.`,sub:`${A.t} · e héten ${dn} / 2 edzés kész.`,
    body:`<div class="vs-hg">${tubes(Array.from({length:A.weeks},(_,i)=>({l:`${i+1}.`,p:i<A.cur-1?94:i===A.cur-1?dn*47:0,wl:i>A.cur-1||(i===A.cur-1&&dn<2)?94:null,ghost:i>A.cur-1,now:i===A.cur-1,v:i<A.cur-1?'2/2':i===A.cur-1?`${dn}/2`:'',c:'var(--dom)',t:`${i+1}. hét${i<A.cur-1?' · 2 / 2 edzés':i===A.cur-1?` · ${dn} / 2 edzés`:' · még hátravan'}`})),{h:70,cls:'wk',gap:5})}</div>`+facts([[`${dn}/2`,'e heti edzés'],['2×','/ hét'],[`${A.weeks} hét`,'blokk']]),
    acts:tab==='tervek'?btn('＋ Új terv','futasterv.uj'):logCta})}
  ${segw([['E heti edzés','futas.het',tab==='het'],['Napló','futas.naplo',tab==='naplo'],['Tervek','futas.tervek',tab==='tervek']])}${B()}`)}
/* lépegető, ami tényleg lép (a szerkesztő kör / pihenő mezői) */
const stv=(l,v,cmd)=>rw({title:l,right:`<span class="vs-stp"><button data-ve="${cmd}:-1" aria-label="${l} csökkentése">−</button><b>${v}</b><button data-ve="${cmd}:1" aria-label="${l} növelése">+</button></span>`});
function futasterv(arg){
  const kind=arg==='tervezett'||arg==='uj'?'p':arg==='archiv'?'x':'a',b=arg==='uj'?{...RBL.p,t:'Új futóterv',goal:'',from:'szept 24.',to:'okt 22.',weeks:4,start:'szept 24.'}:RBL[kind];
  const T0={title:arg==='nincs'?'Futóterv':b.t,sub:'Edzés · Futás',back:'futas.tervek'};
  if(arg==='tolt')return skel(T0,[250,200,200,300]);
  if(arg==='nincs')return page('edzes',T0,hero({lbl:'Futóterv',verdict:'Ez a futóterv nem található.',left:bub('t-run',{s:60}),acts:btn('Vissza a tervekhez','futas.tervek','ghost')}));
  if(ST.rbFor!==(arg||'')){ST.rbFor=arg||'';ST.rb=RB0();ST.rb.weeks=b.weeks;ST.rb.week=kind==='a'?b.cur:kind==='x'?b.weeks:1}
  const R=ST.rb,wk=clamp(R.week,1,R.weeks),stat=kind==='a'?`Aktív · Hét ${b.cur}/${b.weeks}`:kind==='p'?'Tervezett':'Archív';
  const sesCard=(key,name,s,body,iv,i)=>sec(i,name,i)+card(lab('Nap · minden héten')+chips(DSH,s.day,x=>`rbd:${key}|${x}`)+lab('Időpont · minden héten')+fld(s.time)+lab(`Terhelés · ${wk}. hét`)+body+ivl(iv),{i});
  return page('edzes',T0,`
  ${hero({lbl:`Szerkesztő · ${stat}`,verdict:kind==='a'?`Aktív terv, a ${b.cur}. hétnél tart.`:kind==='p'?'Ez a terv még nem indult el.':'Lezárt terv, az archívumban van.',
    sub:R.dirty?`${st('Nem mentve')} A változás pár pillanat múlva magától mentődik.`:`${st('Mentve','ok')} Minden változás mentve.`,left:bub('t-run',{s:60}),
    body:kind==='x'&&b.sum?note(b.sum):'',
    acts:(kind==='a'?ve('Lezárás','rbend'):kind==='p'?ve(`Aktiválás · ${b.start}`,'rbact'):'')+lk('⋯ Több',{sheet:'blkmenu'})})}
  ${sec(1,'Alapadatok',1)}
  ${card(`<span class="fh-lab" style="margin-top:0">Terv neve</span>`+fld(b.t)+lab('Cél (pl. sprint-állóképesség)')+fld(b.goal||'Cél (pl. sprint-állóképesség)',!b.goal),{i:1})}
  ${sec(2,'Hetek · 1–8',2)}
  ${card(`<div class="fh-pills vs-wks" role="group" aria-label="Hetek">${Array.from({length:R.weeks},(_,i)=>`<button class="fh-pill ${i+1===wk?'on':''}" data-ve="rbw:${i+1}" aria-pressed="${i+1===wk}">${i+1}</button>`).join('')}${R.weeks>1?`<button class="fh-pill pm" data-ve="rbwk:-1" aria-label="Utolsó hét eltávolítása">−</button>`:''}${R.weeks<8?`<button class="fh-pill pm" data-ve="rbwk:1" aria-label="Hét hozzáadása">＋</button>`:''}</div>`
    +note(`A ${wk}. hét terhelését szerkeszted. A nap és az időpont minden hétre szól.`),{i:2})}
  ${sesCard('sprint','Sprint-intervallum',R.sprint,ls(stv('kör',R.sprint.rounds,'rbr'),stv('mp pihenő',R.sprint.rest,'rbrest')),ivSprint(R.sprint.rounds,R.sprint.rest),3)}
  ${sesCard('pyr','Piramis-intervallum',R.pyr,`<div class="fh-chips">${R.pyr.work.map((v,i)=>`<span class="tx"><button data-ve="rbpc:${i}" aria-label="${v} mp szakasz váltása">${v} mp</button><button data-ve="rbpx:${i}" aria-label="${v} mp szakasz törlése">×</button></span>`).join('')}<span class="tx add"><button data-ve="rbpa">＋ szakasz</button></span></div>`+note('pihenő = szakasz × 2 · automatikus'),ivPyr(R.pyr.work),4)}`)}

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
/* ── TERHELÉS (= Gym · heti munka: az élő /train/week és /train/gym ugyanaz az oldal) ── */
/* a csoport mondata — ugyanaz a három, mint élesben (loadWeek.ts wordFor) */
const wordFor=(d,p)=>p-d<=0?'ez a hét itt már megvan':d===0?'erre a hét második fele épül':`még ${p-d} szett van hátra`;
/* a hét a GR-ből; „elotte” = még semmi nem ment le, „megvan” = minden lement (a hős mondat többi változatához) */
function weekOf(arg){const gr=GR.map(g=>{const x=[...g];if(arg==='elotte')x[2]=0;if(arg==='megvan')x[2]=x[3];return x}).sort((a,b)=>b[2]-a[2]||b[3]-a[3]);
  const done=gr.reduce((s,g)=>s+g[2],0),plan=gr.reduce((s,g)=>s+g[3],0);
  return {gr,done,plan,pct:plan?Math.round(Math.min(1,done/plan)*100):0,wait:gr.filter(g=>g[3]>0&&g[2]===0)}}
const heroSay=w=>w.plan===0?'Ezen a héten még nincs betervezett szett — azt a mesociklus adja meg.':w.done===0?'A hét még előtted van: eddig egyetlen szett sem ment le.':w.pct>=100?'A hét munkáját letudtad — innen már a pihenés dolgozik.':w.wait.length===0?'Minden izomcsoport kapott már munkát ezen a héten.':`${w.wait.length} izomcsoport még munkára vár ezen a héten.`;
/* a hét izmonként a mesociklus napjaiból (muscleWeekFromMeso): szett, ismétlés-sáv összesen, hány napon */
function weekMus(){const m={};DAYS.forEach(d=>(d.ex||[]).forEach(([,k,s,r])=>{const [a,b]=String(r).split('–').map(Number),o=m[k]||(m[k]={k,sets:0,lo:0,hi:0,days:new Set()});o.sets+=s;o.lo+=s*a;o.hi+=s*(b||a);o.days.add(d.id)}));return m}
/* a testtérkép szintjei: minden tervezett izom halványan (a terv), a csoportja kész hányadáig sötéten */
function heatEnt(w,planned){const fr=Object.fromEntries(w.gr.map(g=>[regionOf(g[0]),g[3]?Math.min(1,g[2]/g[3]):0]));
  return Object.values(weekMus()).map(o=>planned?[o.k,0,clamp(o.sets/13,.3,1)]:[o.k,fr[regionOf(o.k)]||0,1])}
const SPORT_MIN=333,REACH=[['shoulder-front','Váll',3],['quad','Láb',3],['core','Core',1]];
const noMeso=(o,msg)=>page('edzes',o,hero({lbl:o.title,verdict:msg,sub:'Előbb tervezz egy mesociklust.',art:'t-peak',acts:btn('+ Tervezz mesociklust','ujterv')}));
function terheles(arg){
  const T0={title:'Terhelés',sub:`${MESO.name} · ${MESO.week}. hét / ${MESO.of}`,tab:'terheles'};
  if(arg==='tolt')return skel(T0,[356,110,340]);
  if(arg==='ures')return noMeso({title:'Terhelés',sub:'Edzés',tab:'terheles'},'A heti terhelésed itt jelenik majd meg.');
  const w=weekOf(arg);
  return page('edzes',T0,`
  ${tank({pct:w.pct,num:w.done,cap:`szett a ${w.plan}-ből · ${w.pct}%`,lbl:`Terhelés · ${MESO.week}. hét · ${MESO.phase}`,verdict:heroSay(w),marks:[1,.75,.5,.25].map(x=>Math.round(w.plan*x)),cta:'A tested térképe',ctaAct:'terkep',h:356})}
  ${sec(1,'A tested térképe',1)}
  ${card(`<button class="vs-mapc" data-go="terkep">${duo(heatEnt(w),'sm')}<span class="g"><strong>Elöl és hátul, ami már dolgozott</strong><small>${w.wait.length?`${w.wait.length} izomcsoport még munkára vár ezen a héten.`:'Minden izomcsoportod sorra került ezen a héten.'}</small></span>${chev()}</button>`
    +acts(lk('Miből áll össze a szám?',{sheet:'info',arg:'szam'})),{i:1})}
  ${sec(2,'Izomcsoportok ezen a héten',2)}
  ${card(ls(w.gr.map(([k,l,d,p,much])=>rw({m:k,title:`${l}${much?' <b style="color:var(--warn)" title="A heti terv sok ide">· sok</b>':''}`,sub:wordFor(d,p)+`<span class="vs-rowbar">${wlv(p?clamp(d/p*100,d?3:0,100):0,dk(k),[],16)}</span>`,v:`${d} / ${p} <small>szett</small>`,on:{sheet:'grp',arg:k},nochev:true})))
    +note('Az edény széle a heti terv, a folyadék az elvégzett szett. Koppints egy csoportra a részletekért.')+acts(lk('Mit mutat a sáv?',{sheet:'info',arg:'sav'})),{i:2})}
  ${sec(3,'Sport a héten',3)}
  ${card(`<p class="fh-big">${SPORT_MIN}<small>perc sport és futás a heti rendben</small></p>`+txt(`Ezeket is dolgoztatja: ${REACH.map(r=>r[1]).join(', ')}.`)
    +`<div class="vl" style="margin-top:10px">${REACH.map(([k,l,n])=>rw({m:k,title:l,right:drops(n,3,dk(k))})).join('')}</div>`
    +note('Becslés — a szettszámokba nem számít bele.')+acts(lk('A sport és a szettek',{sheet:'info',arg:'sport'})),{i:3})}
  ${sec(4,'Mozgás és terv',4)}
  ${card(ls(rw({icon:'t-bolt',title:'Minden mozgásod a héten',sub:'Gym és sport együtt, eddig a héten — percek és a belőlük becsült kalória.',on:'mozgas'}),
      rw({icon:'c-i-retegek',title:`${MESO.name} · ${MESO.week}. hét / ${MESO.of}`,sub:'Mezociklus áttekintő',on:'run'}),
      rw({icon:'t-record',title:'1 medál e héten'}))
    +acts(lk('+ Saját edzés',{sheet:'custom'}))+note('A terem a mesociklus szerint megy, a sport a saját heti rendjén. A kettő együtt alakítja a nap ütemét, az elalvást és a vacsora idejét.'),{i:4})}`)}
const stOf=(d,p)=>d===0?'még vár':d>=p?'megvan':d/p<.5?'elkezdted':'jó úton';
function terkep(arg){const planned=arg==='terv',T0={title:'Izomtérkép',sub:'Terhelés',back:'terheles'};
  if(arg==='tolt')return skel(T0,[430,90,90]);
  if(arg==='ures')return noMeso(T0,'Az izomtérkép itt jelenik majd meg.');
  const w=weekOf(arg==='megvan'?'megvan':'');let n=0;
  return page('edzes',T0,`
  ${hero({lbl:planned?'Izomtérkép · a heti terv':'Izomtérkép · eddig megvolt',verdict:planned?`${w.plan} szettet kér tőled ez a hét.`:w.wait.length?`${w.wait.length} izomcsoport még munkára vár ezen a héten.`:'Minden izomcsoportod sorra került ezen a héten.',
    sub:planned?'Minél többet kér a hét egy izomtól, annál teltebb.':'Amit már megmozgattál, sötétebben telik — ami még vár, az halvány marad.',
    body:`<div style="margin-top:14px">${seg([['Eddig megvolt','terkep',!planned],['A heti terv','terkep.terv',planned]])}</div>${duo(heatEnt(w,planned),'xl')}
      <div class="vs-sides"><span>elölről</span><span>hátulról</span></div>
      <div class="vs-lg c">${w.gr.map(([k,l,d,p])=>`<span><i style="background:${dk(k)}"></i>${l} <b>${planned?p:`${d}/${p}`}</b>${planned?'':` ${stOf(d,p)}`}</span>`).join('')}</div>`
      +note(planned?'Minél többet kér a hét, annál teltebb az izom.':'Négy állapot: még vár · elkezdted · jó úton · megvan. A szín az izomcsoporté, nem ítélet.'),
    acts:lk('Miből rajzoljuk?',{sheet:'info',arg:'terkep'})})}
  ${sec(++n,'Még munkára vár',1)}
  ${card(w.wait.length?ls(w.wait.map(([k,l,,p])=>rw({m:k,title:l,sub:`${p} szett vár a héten`}))):txt('Minden izomcsoportod sorra került ezen a héten.'),{i:1})}
  ${sec(++n,'A sport is dolgozott',2)}
  ${card(ls(rw({icon:'t-volley',title:`A sport ezeket is dolgoztatta: ${REACH.map(r=>r[1]).join(', ')}.`,sub:'Becslés, nem mérés — a szettszámokba nem számít bele.'})),{i:2})}
  ${sec(++n,'Mélyebben',3)}
  ${card(ls(rw({icon:'t-pattern',title:'Minden izomjel',sub:`A ${MUSCLES.length} izom, saját jellel, régiónként`,on:'jelek'})),{i:3})}`)}
function jelek(arg){const T0={title:'Minden izomjel',sub:'Izomtérkép',back:'terkep'};
  if(arg==='tolt')return skel(T0,[260,150,150,150]);
  const live=new Set(arg==='ures'?[]:DAYS.filter((d,i)=>i<TI&&d.mus).flatMap(d=>d.mus.map(m=>m[0])));
  return page('edzes',T0,`
  ${hero({lbl:'Izomtérkép · minden izomcsoport, saját jellel',verdict:live.size?`${live.size} izmon dolgoztál már ezen a héten a ${MUSCLES.length}-ből.`:'Ezen a héten még egy izmod sincs naplózva.',sub:'Egy régió — egy sziluett. A kiemelt rész mondja meg, melyik fejről van szó.',
    body:`<div class="vs-hg">${tubes(REGIONS.map(r=>{const ms=MUSCLES.filter(m=>m.region===r.key),on=ms.filter(m=>live.has(m.key)).length;return {l:r.label,v:`${on}/${ms.length}`,p:on/ms.length*94,m:ms[0].key,c:dk(ms[0].key),t:`${r.label} · ${on} izom a ${ms.length}-ből dolgozott`}}),{h:92,cls:'sm',gap:6})}</div>`
      +note(live.size?'A teli jelek azok az izmok, amiken ezen a héten már dolgoztál.':'Amint egy edzés lezárul, a jele megtelik.')})}
  ${REGIONS.map((r,ri)=>{const ms=MUSCLES.filter(m=>m.region===r.key);return sec(ri+1,`${r.label} · ${ms.length} izom`,ri+1)+card(`<div class="vs-mm">${ms.map(m=>`<div class="${live.has(m.key)?'':'dim'}">${mchp(m.key)}<span>${m.label}</span></div>`).join('')}</div>`,{i:ri+1})}).join('')}`)}
function mozgas(arg){const T0={title:'Minden mozgásod',sub:'Terhelés',back:'terheles'};
  if(arg==='tolt')return skel(T0,[330,260,300]);
  if(arg==='ures')return noMeso(T0,'Minden mozgásod itt jelenik majd meg.');
  /* movementWeek(): a terem perce a lezárt edzésnapok becsült hossza (62 + 48 + 70), a sport perce és kalóriája a naplózott alkalmaké; a kalória lehet ismeretlen */
  const zero=arg==='nulla',nok=arg==='kcal-nincs',gm=zero?0:180,sm=zero?0:90,gk=zero||nok?null:1430,sk=zero||nok?null:610,w=weekOf(zero?'elotte':'');
  const gf=gm===0?'még nincs lezárt edzésnap ezen a héten':gk!==null?'becslés a szettjeidből':'nincs elég adat a kalóriához — adj meg testsúlyt';
  const sf=sm===0?'nincs naplózott sport ezen a héten':sk!==null?'naplóztad':'naplóztad — a kalóriáját még nem tudjuk becsülni';
  const sporty=new Set(Object.keys(SPL).map(regionOf)),ev=arg==='rend-nincs'?[]:EVENTS;
  return page('edzes',T0,`
  ${hero({lbl:'Minden mozgásod eddig a héten',verdict:gm+sm?`${gm+sm} perc mozgás van mögötted ezen a héten.`:'Ezen a héten még nincs lezárt mozgásod.',sub:'A terem és a sport együtt, eddig a héten — a kettő máshogy számít, ezért külön is mutatjuk.',
    body:`<div class="vs-vs">${tubes([{l:'Terem',ic:'t-dumbbell',v:`${gm}<u> perc</u>`,s:`${gk!==null?`~${hu(gk)} kcal · `:''}${gf}`,p:gm/200*94,c:'var(--dom)'},{l:'Sport',ic:'t-volley',v:`${sm}<u> perc</u>`,s:`${sk!==null?`${hu(sk)} kcal · `:''}${sf}`,p:sm/200*94,c:'var(--ok)'}],{h:132})}</div>`,
    acts:lk('Miért becslés?',{sheet:'info',arg:'becsles'})})}
  ${sec(1,'Izomcsoportok, sporttal együtt',1)}
  ${card(ls(w.gr.map(([k,l,d,p])=>rw({m:k,title:`${l}${sporty.has(regionOf(k))?` ${st('sport is','plan')}`:''}`,sub:`<span class="vs-rowbar">${wlv(p?clamp(d/p*100,d?3:0,100):0,dk(k),[],14)}</span>`,v:`${d} / ${p} <small>szett</small>`})))
    +acts(lk('Hogyan olvasd?',{sheet:'info',arg:'olvasd'})),{i:1})}
  ${sec(2,'Sport és futás a heti rendben',2)}
  ${card((ev.length?ls(ev.map(([tag,nm,day,time,regs])=>rw({icon:tag==='FUTÁS'?'t-run':'t-volley',title:`${nm} ${st(tag==='FUTÁS'?'Futás':'Röpi')}`,sub:`${day} · ${time}<span class="vs-evc">${regs.map(([k,l,x])=>`<em>${l} ${drops(x,3,dk(k))}</em>`).join('')}</span>`}))):txt('Nincs tervezett sport/futás esemény ezen a héten.'))
    +note('Becslés, nem mérés. Ha egyetlen sport-alkalomnál hiányzik a kalória, az egész összeget elrejtjük — inkább semmit, mint kevesebbet.'),{i:2})}`)}

/* ── LAPOK (alulról) ── */
const TECH={default:[['Beállás','Rögzített lapocka, semleges gerinc, a fogás vállszélességnél kicsit szélesebb.'],['Végrehajtás','Könyök hátra és le, a súlyt lassan engedd (2–3 mp). Fent egy pillanat szünet.'],['Gyakori hibák','Lendületből húzni · a vállat a fülhöz emelni · félúton megállni a negatívban.']]};
/* a kis „i” gombok szövegei (az élő oldalak InfoButton-jai): [címke, cím, szöveg] */
const INFO={szam:['Terhelés','Miből áll össze a szám?','A futó terved e heti szettjeit számoljuk: amit már elvégeztél, osztva azzal, amit a hét kér. A sport perceit külön mutatjuk — az a pihenésed része, nem a szetteké.'],
  sav:['Izomcsoportok','Mit mutat a sáv?','A színes rész az elvégzett szett, a halvány a hét teljes kérése. Egy csoportra koppintva látod, melyik része mennyit kapott.'],
  sport:['Sport a héten','A sport és a szettek','A sportod a heti mozgásod és a pihenésed része — a szettszámokba nem számít bele, mert ott a terved emelkedését követjük. A regenerációnál viszont figyelembe vesszük.'],
  terkep:['Izomtérkép','Miből rajzoljuk?','A futó terved e heti szettjeiből: minden izom annyira telik, amennyi a heti munkájából már megvan. A terv nézet azt festi fel, mit kér a hét — ott a teltebb izom többet kérő izmot jelent.'],
  becsles:['Minden mozgásod','Miért becslés?','A gym percei a szettjeidből becsültek, a röplabdát te naplóztad. A kalória mindkettőnél becslés a mozgás jellegéből — nem mérés.'],
  olvasd:['Izomcsoportok, sporttal együtt','Hogyan olvasd?','A sáv a gym szettjeidet mutatja a heti tervhez képest. A „sport is” jel azt jelzi, hogy a sport is dolgoztatta a csoportot — ez becslés, és nem adódik hozzá a szettekhez.']};
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
  info:(a)=>{const [l,t,c]=INFO[a]||INFO.szam;return `${shm('t-info',l,t)}${txt(c)}${!a||a==='szam'?`<div class="vs-rowbar" style="margin-top:14px">${level(Math.round(LD_DONE/LD_PLAN*100),{h:22,label:`${LD_DONE} szett megvan`,val:String(LD_PLAN)})}</div>`:''}`},
  grp:(a)=>{const [k,l,d,p]=GR.find(g=>g[0]===a)||GR[0],ms=Object.values(weekMus()).filter(o=>regionOf(o.k)===regionOf(k)),xp=o=>o.sets*4,gx=ms.reduce((s,o)=>s+xp(o),0),any=ms.some(o=>SPL[o.k]);
    return `${shm(k,`${l} · ezen a héten`,`${d} / ${p} szett`,wordFor(d,p))}<div class="vs-rowbar">${wlv(p?clamp(d/p*100,d?3:0,100):0,dk(k),[],20)}</div>
    ${ms.length?`<div class="vl" style="margin-top:18px">${ms.map(o=>rw({m:o.k,title:muscleLabel(o.k),sub:`${o.sets} szett · ${o.lo}–${o.hi} ismétlés · ${o.days.size}×/hét — a heti tervből${SPL[o.k]?`<span class="vs-evc">${SPL[o.k].map(([s,n,c])=>`<em>${drops(n,3,dk(o.k))} ${s}${c>1?` ×${c}`:''}</em>`).join('')}</span>`:''}`,v:`+~${xp(o)} <small>XP</small>`})).join('')}</div>`:txt('Ezen a héten nincs rá külön gyakorlat a tervben.')}
    ${note(gx>0?`A tervezett hét ~${gx} XP-t hoz ennek a csoportnak — becslés; a valós XP a logolt munkából számolódik.`:'XP-előrejelzés ehhez a csoporthoz még nincs — ahhoz súly-alap kell a tervben.')}${any?note('A cseppek a sport és a futás plusz-terhelését jelzik — becslés, a szettszámokba nem számít bele.'):''}`},
  tdel:()=>`${shm('t-trash','Törlés','Törlöd a sablont?','Hypertrophy 04 · Tavasz. A korábbi futamok és a riportjaik megmaradnak — csak a recept tűnik el a listádból.')}${acts(ve('Törlés','toastclose:Törölve','bad','style="flex:1"'),`<button class="fh-lk" data-close>Mégsem</button>`)}`,
  close:()=>`${shm('t-coin','Lezárás','Edzésterv lezárása','Lezárás után riportot kapsz róla: mennyit csináltál meg belőle, mi változott erőben, és hogyan mozdultak az izmaid.')}
    <div class="vs-shg">${caps(6,2,'var(--dom)',{cur:2,cls:'big'})}<small>most a 3. hétnél tartasz a 6-ból</small></div>
    ${lab('Hogy érezted magad benne?')}${chips(['Nagyon jól','Jól','Vegyesen','Nehezen'],1)}
    ${lab('Jegyzet (nem kötelező)')}<div class="fh-in vs-fld ph"><span>Mit vinnél tovább a következőbe?</span>${bub('t-mic',{s:30})}</div>${acts(`<button class="btn" style="flex:1" data-go="riport">Lezárás</button>`,`<button class="fh-lk" data-close>Mégsem</button>`)}`,
  start:()=>`${shm('t-play','Futam indítása','Hypertrophy 04 · Tavasz','6 hét · 5 edzésnap hetente. A futó terved ettől nem áll le — ez a sorba kerül mögé.')}${queue()}
    ${lab('Mikor kezdődjön?')}${chips(['Jún 16','Jún 23','Más dátum'],0)}${acts(ve('Indítás','toastclose:Elindítva — a Következnek listába került','','style="flex:1"'),`<button class="fh-lk" data-close>Mégsem</button>`)}`,
  sportlog:()=>{const K=['Röpi','Cross','TRX'],v=ST.slk===0;return `${shm(['t-volley','t-crossfit','t-trx'][ST.slk],`Sport log · ${K[ST.slk]}`,'Hogy ment?','Az idő, a terhelés és a saját élményed.')}
    <div class="fh-pills" role="group" aria-label="Sport típus">${K.map((l,i)=>`<button class="fh-pill ${i===ST.slk?'on':''}" data-ve="slk:${i}">${l}</button>`).join('')}</div>
    <div class="vl" style="margin-top:12px">${stp('Idő · perc',90)}${v?stp('Setek · összesen',5):stp('Körök · összesen',6)}</div>
    ${blk('RPE · összesített nehézség',scale(7))}${v?blk('Váll terhelés',scale(6)):''}
    ${lab('Jegyzet')}<div class="fh-in vs-fld ph"><span>Hogy érezted magad, mi ment jól, mi fájt…</span>${bub('t-mic',{s:30})}</div>${two('Mentés','slsave')}`},
  sportev:()=>{const K=['Röpi','Cross','TRX'],v=ST.ev.sport===0;return `${shm('t-calendar','Sport · egyszeri esemény','Új esemény')}
    <div class="fh-pills" role="group" aria-label="Esemény sportja">${K.map((l,i)=>`<button class="fh-pill ${i===ST.ev.sport?'on':''}" data-ve="evsp:${i}">${l}</button>`).join('')}</div>
    <div class="vs-two">${blk('Dátum',fld('2026. okt. 11.'))}${blk('Idő',fld('18:00'))}</div>
    ${v?blk('Típus',`<div class="fh-pills" role="group" aria-label="Esemény típusa">${[['match','meccs'],['training','edzés']].map(([id,l])=>`<button class="fh-pill ${id===ST.ev.kind?'on':''}" data-ve="evkind:${id}">${l}</button>`).join('')}</div>`):''}
    <div class="vl" style="margin-top:12px">${stp('Hossz · perc',90)}</div>
    ${lab('Helyszín')}${fld('Helyszín',true)}${two('Mentés','evsave')}`},
  kcal:(a)=>`${shm('t-plate','Kalória','Aktív kalória (ha az órád mérte)','Csak a mozgás többletét írd be — az órád »aktív« kalóriáját, ne az összeset.')}
    ${lab('Kalória')}${fld(a==='hiba'?'12 000':'520')}${a==='hiba'?box('t-info','Adj meg egy értéket 1 és 5000 kcal között.','','var(--bad)'):''}${acts(ve('Ezt mentem','kcalset','','style="flex:1"'))}`,
  runlog:(a)=>{const pyr=a==='pyr';return `${shm('t-run',`Futás log · ${pyr?'Piramis-intervallum':'Sprint-intervallum'}`,'Hogy ment?')}${ivl(pyr?ivPyr(ST.rb.pyr.work):ivSprint(ST.rb.sprint.rounds,ST.rb.sprint.rest))}
    <div class="vl" style="margin-top:12px">${stp('Teljesített körök',pyr?ST.rb.pyr.work.length:ST.rb.sprint.rounds,pyr?'piramis-szakaszok · a haladás ebből számol':'')}</div>${blk('RPE · érzékelt nehézség',scale(9))}<div class="vl" style="margin-top:14px">${stp('Pulzus-megnyugvás · mp',45)}</div>
    ${lab('Jegyzet')}<div class="fh-in vs-fld ph"><span>opcionális</span>${bub('t-mic',{s:30})}</div>${two('Mentés','runsave')}`},
  blkmenu:()=>`${shm('t-run','Futóterv','További műveletek')}${ls(rw({icon:'t-repeat',title:'Duplikálás',ve:'rbmenu:Duplikálva'}),rw({icon:'t-trash',title:'<span style="color:var(--bad)">Törlés</span>',ve:'rbmenu:Törölve'}))}`,
  custom:(a)=>`${shm('t-dumbbell','Saját edzés','Mit nyomunk ma?')}${a==='ures'?txt('Még nincs mentett saját edzésed — rakd össze az elsőt.'):ls(rw({icon:'t-dumbbell',title:'Pihenőnapi felső',sub:`3 gyakorlat · 10 szett<span class="vs-rowbar">${caps(4,0,dk('chest-mid'))} ${caps(3,0,dk('back-wide'))} ${caps(3,0,dk('shoulder-side'))}</span>`,right:`<button class="fh-lk" data-go="sajat" aria-label="Pihenőnapi felső szerkesztése">szerkesztés</button>`,on:'session.uj'}))}${acts(btn('+ Új összeállítása','sajat.uj','sm'))}`,
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
    case 'skwhy':ST.whyk=a;if(ST.sk[a])ST.sk[a].adv=false;resheet('why');break;
    case 'skundo':delete ST.sk[a];ST.skord=ST.skord.filter(x=>x!==a);repaint();toast('Visszavonva — újra a tervben');break;
    case 'why':{const k=ST.whyk;ST.sk[k].cat=a;if(a==='OTHER')ST.sk[k].text='Családi program jött közbe';if(ST.km&&ST.km.from===k){if(serious(k))ST.km.cat=a;else ST.km=null}resheet('why');repaint();break}
    case 'whydone':closeSheet();repaint();if(a==='1')toast(`Megjegyeztem · ${skLabel(ST.whyk)}`);break;
    case 'kmdur':{const k=ST.whyk,retro=k==='run';ST.km={cat:ST.sk[k].cat,dur:+a,day:retro?2:1,released:false,full:false,asked:false,from:k};ST.cb=null;resheet('why');repaint();
      setTimeout(()=>{if(!retro&&ST.km&&ST.km.from===k){delete ST.sk[k];ST.skord=ST.skord.filter(x=>x!==k)}closeSheet();if(mine()&&F.R==='mai')repaint();toast('Kímélő mód bekapcsolva')},1400);break}
    case 'kmrel':ST.km.released=a==='1';ST.km.full=false;repaint();toast(ST.km.released?'Rendben — ma edzel, holnaptól újra kímélő mód':'Visszaállítva · ma pihensz');break;
    case 'kmfull':ST.km.full=true;repaint();toast('Könnyítés kikapcsolva · teljes edzés');break;
    case 'kmnotyet':ST.km.asked=true;repaint();toast(`Rendben — holnap újra rákérdezek. ${CARE[ST.km.cat]}`);break;
    case 'kmback':if(ST.km.day===1){ST.km=null;repaint();toast('Kímélő mód befejezve');break}ST.udv=ST.km.day-1<=2?0:ST.km.day-1<=9?1:2;resheet('udv');break;
    case 'udv':closeSheet();if(a==='1'){ST.cb={n:1,of:ST.udv===0?1:2,waived:false,undo:true,prev:ST.km};ST.km=null;repaint();toast('Üdv újra! · könnyített visszatérés')}else toast('Rendben — marad a kímélő mód');break;
    case 'cbwaive':ST.cb.waived=true;repaint();toast('Könnyítés kikapcsolva · teljes edzés');break;
    case 'cbundo':ST.km=ST.cb.prev;ST.cb=null;repaint();toast('Visszaállítva · marad a kímélő mód');break;
    case 'ready':ST.ready=a==='lighten'?'done':a==='keep'?'gone':'offer';repaint();toast(a==='lighten'?'Könnyítve — ma egy fokkal lejjebb':a==='keep'?'Rendben, marad a terv':'Visszaállítva az eredeti terv');break;
    case 'mtr':ST.mtr=false;repaint();toast(a==='1'?'Áthelyezve · péntek 06:30':'Rendben, marad így');break;
    case 'slk':ST.slk=+a;resheet('sportlog');break;
    case 'slsave':if(ST.slk===0)ST.vlog=true;closeSheet();repaint();toast('Mentve');break;
    case 'runsave':ST.rlog=true;closeSheet();repaint();toast('Mentve');break;
    case 'evsp':ST.ev.sport=+a;resheet('sportev');break;
    case 'evkind':ST.ev.kind=a;resheet('sportev');break;
    case 'evsave':closeSheet();toast('Esemény mentve');break;
    case 'evdel':ST.evs=ST.evs.filter(i=>i!==+a);repaint();toast('Esemény törölve');break;
    case 'spmode':ST.sp.mode=a;repaint();break;
    case 'kcalset':ST.sp.kcal=520;closeSheet();repaint();break;
    case 'kcalclr':ST.sp.kcal=null;repaint();break;
    case 'rbw':ST.rb.week=+a;repaint();break;
    case 'rbwk':ST.rb.weeks=clamp(ST.rb.weeks+ +a,1,8);ST.rb.week=Math.min(ST.rb.week,ST.rb.weeks);rbDirty();break;
    case 'rbd':{const [s,i]=a.split('|');ST.rb[s].day=+i;rbDirty();break}
    case 'rbr':ST.rb.sprint.rounds=clamp(ST.rb.sprint.rounds+ +a,1,12);rbDirty();break;
    case 'rbrest':ST.rb.sprint.rest=clamp(ST.rb.sprint.rest+5* +a,15,120);rbDirty();break;
    case 'rbpc':{const C=[15,30,45,60],w=ST.rb.pyr.work;w[+a]=C[(C.indexOf(w[+a])+1)%C.length]??15;rbDirty();break}
    case 'rbpx':ST.rb.pyr.work.splice(+a,1);rbDirty();break;
    case 'rbpa':ST.rb.pyr.work.push(30);rbDirty();break;
    case 'rbend':toast('Lezárva — az archívumba került');F.go('futas.tervek');break;
    case 'rbact':toast('Aktiválva');F.go('futas.tervek');break;
    case 'rbmenu':closeSheet();toast(a);F.go('futas.tervek');break;
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
    case 'sportsave':{const i=ST.sp.i,m=SPORTS[i]?.[3]?.find(x=>x[1]==='minutes')?.[4]||60;if(i===0)ST.vlog=true;else ST.xlog=i;ST.sp={i:-1,mode:null,kcal:null};toast(`Naplózva · ${m} perc`);F.go('mai');break}
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
/* a futóterv szerkesztője: minden változás „Nem mentve”, majd pár pillanat múlva magától „Mentve” (az élő oldal 600 ms-os automata mentése) */
function rbDirty(){ST.rb.dirty=true;clearTimeout(ST.rbT);ST.rbT=setTimeout(()=>{ST.rb.dirty=false;if(mine()&&F.R==='futasterv')repaint()},900);repaint()}
document.addEventListener('input',e=>{if(!mine())return;const t=e.target;
  if(t.matches&&t.matches('.vs-rng input')){t.style.setProperty('--p',`${(t.value-1)/9*100}%`);const s=t.parentNode.querySelector('b span');if(s)s.textContent=t.value}});

const ROUTES={mai,indulas,session,review,gym:(a)=>terheles(a),sport:(a)=>sport(a||'terv'),sportlog,futas:(a)=>futas(a||'het'),futasterv,medals,exercises,exercise,cer,terv,run,nap,napszerk,het,izom,konyvtar,futamok,riport,osszevetes,sablonok,sablon,sablonszerk,ujterv,sajat,terheles,terkep,jelek,mozgas};
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
/* ── F3 parity kör: a Mai napsáv pöttyei, vázak, sport-űrlap, futóterv-szerkesztő ── */
${Q} .ds .vs-dots{display:flex;justify-content:center;gap:3px;height:5px;margin:3px 0 1px}${Q} .ds .vs-dots u{width:5px;height:5px;border-radius:50%;background:var(--dom);text-decoration:none}
${Q} .ds .vs-dots u.sport{background:#E06BB5}${Q} .ds .vs-dots u.run{background:#1877F2}${Q} .ds button.on .vs-dots u{background:#fff}
${Q} .ds i{display:flex;justify-content:center;align-items:center;gap:1px;min-height:14px}${Q} .ds i svg.ic{width:12px;height:12px}
${Q} .vs-sk{display:grid;gap:14px;padding:14px}${Q} .vs-sk i{display:block;border-radius:26px;background:rgba(255,255,255,.72);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.05)}
@media (prefers-reduced-motion:no-preference){body:not(.still) ${Q} .vs-sk i{animation:vs-sk 1.6s ease-in-out infinite alternate}}
@keyframes vs-sk{from{opacity:.55}to{opacity:1}}
${Q} .fh-pair button small{display:block;font-family:var(--ff);font-size:11.5px;font-weight:550;color:var(--sub);margin-bottom:2px}
${Q} .vs-in b{color:var(--ink);font-weight:650}
${Q} .vs-sides{display:flex;justify-content:center;gap:86px;margin-top:6px;font-size:11px;font-weight:600;color:var(--faint)}
${Q} .vs-evc{display:flex;flex-wrap:wrap;gap:5px 12px;margin-top:6px}${Q} .vs-evc em{display:inline-flex;align-items:center;gap:5px;font-style:normal;font-size:12px;font-weight:550;color:var(--ink)}
${Q} .vs-q{display:block;margin-top:5px;color:var(--sub)}
${Q} .vs-later{font-size:13px;font-weight:600;color:var(--faint);white-space:nowrap}
${Q} .vs-spg button span small{display:block;font-size:11px;font-weight:500;color:var(--sub);margin-top:2px}
${Q} .vs-form .vs-fl{margin-top:14px}${Q} .vs-form>.vs-fl:first-child,${Q} .vs-form>.vs-blk:first-child .fh-lab{margin-top:0}
${Q} .vs-rng{display:flex;align-items:center;gap:12px}${Q} .vs-rng b{flex:0 0 auto;min-width:58px;text-align:right;font-family:var(--disp);font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}
${Q} .vs-rng input{flex:1;min-width:0;-webkit-appearance:none;appearance:none;height:18px;border-radius:999px;background:linear-gradient(90deg,var(--liq1),var(--liq2)) 0 0/var(--p,50%) 100% no-repeat,#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.12);outline:0;cursor:pointer}
${Q} .vs-rng input::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px var(--liq2),0 6px 10px -6px rgba(10,42,60,.5)}
${Q} .vs-rng input::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:50%;background:#fff;box-shadow:0 0 0 2px var(--liq2)}
${Q} .vs-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
${Q} .vs-wks{gap:5px}${Q} .vs-wks .fh-pill{min-width:30px;padding:7px 0;justify-content:center}${Q} .vs-wks .fh-pill.pm{background:none;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.14);color:var(--sub)}
${Q} .fh-chips span.tx button+button{margin-left:6px}
${Q} .fh-hero .sub .st{margin-right:4px}
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
  <p><b>Mai</b> · ${NL('mai.alap','a mai nap')}: a Pull Day mellett a hátad, a mai izmok annyira telnek, amennyit ma kapnak. A sárga kártyán a reggeli három érték három kémcső. Lejjebb visszajött a „mit ad a mozgásod a keretedhez” kártya. A napsáv minden napja megnyitható (${NL('mai.kedd','kedd')} · ${NL('mai.sze','szerda')} · ${NL('mai.pen','péntek')} · ${NL('mai.szo','szombat')} · ${NL('mai.vas','vasárnap')}). Állapotok: ${NL('mai.folyamatban','folyamatban')} · ${NL('mai.kesz','kész')} · ${NL('mai.kihagyva','kihagyva')} · ${NL('mai.tanacs','az edző javaslatára kihagyva')} · ${NL('mai.konnyitve','könnyítve')} · ${NL('mai.kimelo','kímélő mód')} · ${NL('mai.kimelo3','letelt a becslés')} · ${NL('mai.kimelo-edz','kímélő mód közben edzel')} · ${NL('mai.vissza','visszatérő edzés')} · ${NL('mai.vissza2','második visszatérő')} · ${NL('mai.sajat-kesz','saját edzés és plusz sport megvolt')} · ${NL('mai.reggel','reggeli edzés-ablak')} · ${NL('mai.pihen','pihenőnap')} · ${NL('mai.pihen-sport','pihenőnap sporttal')} · ${NL('mai.pihen-sajat','pihenőnap, futó saját edzés')} · ${NL('mai.ures','nincs terv')} · ${NL('mai.tolt','betöltés')}.</p>
  <p><b>Az edzés útja</b> · ${NL('indulas','eligazítás')}: a várható idő egy sáv 70 és 85 perc között, a küldetések kapszulái annyira telnek, amennyire biztosak. ${NL('session.uj','Edzés közben')}: a szerkezet maradt (egy gyakorlat nagyban, a többi sor, felül Rekordok · Technika · Műveletek); fent gyakorlatonként egy kis edény, a szettek sorszáma kapszula, a pihenő egy edény, ami valóban kiürül. ${NL('cer','Lezárás')}: a kehely megtelik a csillagokkal együtt, a rekord kicsordul. ${NL('cer.reszletek','Részletek')} · ${NL('review','összegzés')} (izmonként a mai szettek a múlt heti vonalhoz) · ${NL('review.gyak','egy gyakorlat')}.</p>
  <p><b>Terv</b> · ${NL('terv','a futó terv')}: a hat hét hat edény, a pihenőhéten leapad; a nap kártyáin újra ott a test, a három szám és az izmok szettszámmal. ${NL('run','A terv oldala')} (az ív mint hullám) · ${NL('nap.csu','egy nap')} · ${NL('napszerk','szerkesztő')} · ${NL('het','heti vizsgálat')} (vízvonalak: mettől fejlődik, mettől hangsúly) → ${NL('izom.back-wide','egy izom')} (mérőhenger) · ${NL('konyvtar','edzéstervek')} (csővezeték) · ${NL('futamok','lezárt futamok')} → ${NL('riport','riport')} · ${NL('osszevetes','összevetés')} · ${NL('sablonok','sablonok')} → ${NL('sablon','egy sablon')} → ${NL('sablonszerk','szerkesztő')} · ${NL('ujterv','új terv')} (a hetek számára koppintva változik az előnézet; ${NL('ujterv.gen','készül')} · ${NL('ujterv.kesz','vázlat')}) · ${NL('futas','futás')} (${NL('futas.naplo','napló')} · ${NL('futas.tervek','tervek')} · ${NL('futas.nincs','nincs aktív terv')}) → ${NL('futasterv','futóterv')} (${NL('futasterv.tervezett','tervezett')} · ${NL('futasterv.archiv','archív')}).</p>
  <p><b>Terhelés</b> · ${NL('terheles','a hét')} (tartály: 45 a 75-ből; ${NL('terheles.elotte','még előtted')} · ${NL('terheles.megvan','letudva')} · ${NL('terheles.ures','nincs terv')} · ${NL('terheles.tolt','betöltés')}) · ${NL('terkep','izomtérkép')} (${NL('terkep.terv','a heti terv')} · ${NL('terkep.megvan','minden sorra került')}) · ${NL('jelek','minden izomjel')} (${NL('jelek.ures','üresen')}) · ${NL('mozgas','minden mozgásod')} (${NL('mozgas.nulla','még semmi')} · ${NL('mozgas.kcal-nincs','kalória nélkül')}). <b>Gyakorlatok</b> · ${NL('exercises','lista')} · ${NL('exercise','egy gyakorlat')} (az erő íve, rajta a rekordok cseppjei) · ${NL('medals','medálok')} (${NL('medals.ures','üresen')}). <b>Egyéb</b> · ${NL('sport','sport')} (${NL('sport.naplo','napló')} · ${NL('sport.cross','cross-load')} · ${NL('sport.nincs','nincs heti rend')} · ${NL('sport.naplo-ures','üres napló')}) · ${NL('sportlog','sport naplózása')} → ${NL('sportlog.0','röplabda')} · ${NL('sportlog.3','kerékpár')} · ${NL('sportlog.9','egyéb')} · ${NL('sportlog.hiba','mentési hiba')} · ${NL('sajat','saját edzés')} (${NL('sajat.uj','új')} · ${NL('sajat.betolt','betöltés')} · ${NL('sajat.nincs','nem található')}).</p>
  <h2>Ami visszajött az élő appból</h2>
  <p>A mozgás kalória-kártyája a Mai oldalon · a nap kártyái testtel és számokkal · a gyakorlatok négycellás előírása a nap oldalán · a tervek és futamok három-három ténye · az izomtérkép jelmagyarázata · a Gym-nézet testtérkép-kártyája · a futás szakaszai · az ítélet-jelek magyarázata az edzés közben. Az ikonok mindenhol buborékban ülnek, gyűrű sehol nincs.</p>
  <h2>Amit csak kinézetre csinál</h2>
  <p>A lépegetők (− / +) és a jegyzetmezők a lapokon nem számolnak, a saját edzés szerkesztőjét kivéve. A szett kipipálása elindítja a pihenőt, de a sort nem írja át késznek.</p>`
});
})();
