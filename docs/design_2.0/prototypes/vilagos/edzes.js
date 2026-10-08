/* vilagos/edzes.js — Edzés domain in the "Világos · élő" look (Mai · Terv · Terhelés · Gyakorlatok + eligazítás, edzés közben, ceremónia, összegzés, sport, futás, saját edzés). Built on window.F (see vilagos/README.md). Content and parity source: csepp/edzes.js. */
(function(){
const {I,csepp,mchp,muscleColor,page,sec,card,head,hero,btn,lk,step,bar,stat,grid,facts,seg,st,ring,note,txt,empty,msg,chev,act,esc,register}=F;
const T=I,toast=(...a)=>F.toast(...a),openSheet=(...a)=>F.openSheet(...a),closeSheet=(...a)=>F.closeSheet(...a);
const $=s=>document.querySelector(s);
const P='.phone[data-v="feher"][data-d="edzes"]';
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
const mus=(k,l,v,pct,c)=>`<div class="fh-mus">${mchp(k,'sm')}<span class="l">${l}</span><span class="v">${v}</span>${bar(pct,c||muscleColor(k))}</div>`;
const lab=t=>`<span class="fh-lab">${t}</span>`;
const fld=(t,ph)=>`<div class="fh-in vs-fld ${ph?'ph':''}">${t}</div>`;
const chips=(a,on,cmd='chip')=>`<div class="fh-pills">${a.map((l,i)=>`<button class="fh-pill ${i===on?'on':''}" data-ve="${typeof cmd==='function'?cmd(i):cmd}">${l}</button>`).join('')}</div>`;
const stp=(l,v,sub='')=>rw({title:l,sub,right:`<span class="vs-stp"><button data-toast="−">−</button><b>${v}</b><button data-toast="+">+</button></span>`});
const scale=v=>`<div class="vs-scale">${Array.from({length:10},(_,i)=>`<button class="${i+1<v?'f':i+1===v?'a':''}" data-ve="scale:${i+1}">${i+1}</button>`).join('')}</div>`;
const blk=(l,inner)=>`<div class="vs-blk"><span class="fh-lab">${l}</span>${inner}</div>`;
const box=(icon,title,body='')=>`<div class="vs-box">${icon?I(icon):''}<div><b>${title}</b>${body}</div></div>`;
const sh=(lbl,title='',sub='')=>`<div class="vs-sh"><span>${lbl}</span><button data-close aria-label="Bezárás">×</button></div>${title?`<h2>${title}</h2>`:''}${sub?`<p class="fh-txt vs-sub">${sub}</p>`:''}`;
const shm=(k,lbl,title,sub='')=>`<div class="vs-sh"><span>${lbl}</span><button data-close aria-label="Bezárás">×</button></div><div class="vs-mh">${typeof k==='string'&&byKey[k]?mchp(k):I(k)}<div><h2>${title}</h2>${sub?`<p class="fh-txt vs-sub">${sub}</p>`:''}</div></div>`;
const two=(l,cmd='save')=>acts(ve(l,cmd,'','style="flex:1"'),`<button class="fh-lk" data-close>Mégse</button>`);
const segw=a=>`<div class="vs-seg rise" style="--i:1">${seg(a)}</div>`;
const tk=(on,inner='')=>`<span class="vs-tk ${on?'on':''}">${inner||I('i-check')}</span>`;
const stk=keys=>`<span class="vs-stk">${keys.slice(0,3).map(k=>mchp(k,'sm')).join('')}</span>`;
const dk=k=>`color-mix(in srgb,${muscleColor(k)} 78%,#0F1E33)`;
function heat(v,entries,cls=''){return `<span class="vs-heat ${cls}"><svg viewBox="${BODY[v].vb}" aria-hidden="true">${sil(v)}${entries.flatMap(([k,a])=>(TOKEN_SHAPES[k]||[]).filter(([x])=>x===v).map(([,s])=>`<g style="fill:${dk(k)}" opacity="${a}"><use href="#bm-${v}-${s}"/></g>`)).join('')}</svg></span>`}
const duo=(ent,cls='')=>`<span class="vs-duo ${cls}">${heat('front',ent)}${heat('back',ent)}</span>`;
function trend(pts,{w=300,h=96,c='var(--dom)'}={}){const min=Math.min(...pts),max=Math.max(...pts),rg=(max-min)||1;const X=i=>8+i*(w-16)/(pts.length-1),Y=p=>h-10-(p-min)/rg*(h-20);
  const sm=pts.map((_,i)=>{const a=pts.slice(Math.max(0,i-1),i+2);return a.reduce((s,v)=>s+v,0)/a.length});
  return `<svg class="fh-chart" viewBox="0 0 ${w} ${h}" aria-hidden="true">${[.2,.5,.8].map(f=>`<line x1="0" x2="${w}" y1="${h*f}" y2="${h*f}" stroke="var(--hair)" stroke-width="1"/>`).join('')}<path d="M${sm.map((p,i)=>`${X(i)} ${Y(p)}`).join(' L')}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p,i)=>`<circle cx="${X(i)}" cy="${Y(p)}" r="${i===pts.length-1?4.5:2.5}" fill="${i===pts.length-1?c:'var(--faint)'}"/>`).join('')}</svg>`}
const arc=(cur,vals)=>`<div class="vs-arc">${MESO.curve.map((p,i)=>`<i class="${p==='Deload'?'deload':''} ${i+1===cur?'now':i+1<cur?'past':''}" style="--h:${PH_H[p]}%"></i>`).join('')}</div><div class="vs-arcl">${(vals||MESO.curve.map((_,i)=>i+1)).map((v,i)=>`<span>${i+1===cur?`<b>${v}</b>`:v}</span>`).join('')}</div>`;

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
const mini=r=>`<span class="mstars" aria-hidden="true">${[0,1,2,3,4].map(i=>{const c=starCls(i,r);return T(c==='is-lit'?'t-star':c==='is-half'?'t-star-half':'t-star-empty')}).join('')}</span>`;
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

/* ── MAI ── */
function dstrip(sel='ma'){
  const kmF=ST.km?'km':'•';
  const D=[['H',21,'tick'],['K',22,ST.km&&ST.km.day>=3?'km':'tick'],['Sze',23,kmCovers('sze')?'km':ST.sk.sze?'skip':'–','sze'],['Cs',24,ST.day==='done'?'tick':kmCovers('gym')&&ST.day==='plan'?'km':ST.sk.gym&&ST.day==='plan'?'skip':'ma','ma'],['P',25,kmF],['Szo',26,'pihenő'],['V',27,'pihenő']];
  return `<section class="ds rise">${D.map(([l,n,m,k])=>`<button class="${k&&k===sel?'on':''} ${m==='pihenő'?'rest':''}" ${k?`data-go="${k==='ma'?'mai':'mai.'+k}"`:`data-toast="${l} · szept ${n}."`}><small>${l}</small><b>${n}</b><i class="${m==='tick'?'ok':''}">${m==='tick'?I('i-check'):m==='skip'?I('i-skip'):m==='km'?I('t-kimelo'):m}</i></button>`).join('')}</section>`}
const LBL={'back-wide':'Hát','back-mid':'Hát közép','shoulder-rear':'Hátsó váll','biceps-brachialis':'Kar','traps':'Trapéz'};
const mchips=()=>`<div class="fh-chips">${Object.keys(LBL).map(k=>`<span>${mchp(k,'sm')}${LBL[k]}</span>`).join('')}</div>`;
const skBlock=k=>box('t-skip',`Kihagyva · ${skLabel(k)}`,`<p>${skEffect(k)}</p>`);
const skActs=k=>vl(catOf(k)?'Másik ok':'Okot adok',`skwhy:${k}`)+vl('Visszavonom',`skundo:${k}`);
function thero(){
  const km=ST.day==='plan'&&kmCovers('gym'),sk=!km&&ST.day==='plan'&&ST.sk.gym,cb=!km&&!sk&&ST.day==='plan'&&ST.cb&&!ST.cb.waived,rel=ST.day==='plan'&&ST.km&&ST.km.released;
  const state=km?`Kímélő mód · ${ST.km.day}. nap`:sk?'Kihagyva':cb?`Visszatérő edzés · ${ST.cb.n}/${ST.cb.of}`:{plan:'',run:`Folyamatban · ${DONE()} szett kész a ${TOT()}-ból`,done:'Kész · 14 szett a 16-ból'}[ST.day];
  const cta={plan:['Edzés indítása','indulas'],run:[`Folytassuk · ${DONE()} szett kész`,'session'],done:['Eredmény · 16 szett','review']}[ST.day];
  let body=facts([['5','gyakorlat'],[cb?`<s>16</s> ${CBT()}`:'16','szett'],[`~${cb?Math.round(78*CBT()/16/5)*5:78}`,'perc']])+mchips(),a;
  if(km){const ask=kmExpired()&&!ST.km.asked;
    body+=box(kmIc(),kmTitle(),`<p>Az edzés ma magától kimarad. Nem számít mulasztásnak, a sorozatod marad.</p>${ask?'<p><b>A becsült idő letelt — hogy vagy?</b></p>':''}`);
    a=ve('Jobban vagyok','kmback')+(ask?vl('Még nem','kmnotyet'):'')+vl('Ma mégis edzek','kmrel:1')}
  else if(sk){body+=skBlock('gym');a=skActs('gym')}
  else{
    if(cb)body+=box('t-sprout','Könnyített visszatérés','<p>Harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.</p>')+`<div class="vs-cb">${EX.map(e=>`<div><span>${e.n}</span><span><s>${e.sets.length}</s> <b>${cbSets(e.sets.length)}</b> szett</span></div>`).join('')}</div><div class="vs-in" style="padding:8px 0 0">${vl('Kikapcsolom a könnyítést','cbwaive')}${vl('Mégsem vagyok jól','cbundo')}</div>`;
    if(rel)body+=box('t-kimelo','Kímélő mód közben edzel','<p>Csak ma, könnyítve: kevesebb sorozat, kb. 10%-kal kisebb súly.</p>');
    a=`<button class="btn" style="flex:1" data-go="${cta[1]}">${cta[0]}</button>`+(!rel&&ST.day==='plan'?vl('Kihagyom','skip:gym'):'')+(rel?vl('Mégse','kmrel:0'):'')}
  return hero({lbl:'Mai edzés · 07:30 · Gym',verdict:'Pull Day',big:true,art:'t-dumbbell',sub:state,body,acts:a},1)}
function readyCard(){
  if(ST.day!=='plan'||ST.ready==='gone'||ST.sk.gym||kmCovers('gym'))return '';
  if(ST.ready==='done')return hero({lbl:'A reggeli check-inből',verdict:'Ma egy fokkal lejjebb',sub:'Minden gyakorlatnál a múlt heti súly marad, nem emelünk. A Rear Delt Fly nehéz szettjei kimaradnak.',left:csepp('ok',57,{s:60,val:72}),acts:vl('Visszaállítom a tervet','ready:undo')},2);
  return hero({warn:true,lbl:'A reggeli check-inből',verdict:'Könnyebb nap javasolt',sub:'A jobb vállad fáj (5/10). A Rear Delt Fly-t könnyebb súllyal, vagy hagyd ki.',left:csepp('warn',57,{s:60,val:48}),
    body:`<div class="fh-why"><span>Kipihentség</span><span class="v">4 / 10</span>${bar(40,'var(--warn)')}<span>Izomláz</span><span class="v">7 / 10</span>${bar(70,'var(--bad)')}<span>Kedv</span><span class="v">5 / 10</span>${bar(50,'var(--warn)')}</div>`+note('Csak javaslat — magától nem változtat semmit.'),
    acts:ve('Könnyítsük','ready:lighten','sm')+ve('Maradjon a terv','ready:keep','sm ghost')},2)}
function mai(arg){
  applyDemo(arg);
  if(arg==='ures')return page('edzes',{title:'Edzés',sub:'Mai nap',tab:'mai'},`
    ${hero({lbl:'Mai nap',verdict:'Még nincs edzésterved.',sub:'Itt fog élni a mai edzésed — előbb tervezz egy mesociklust.',art:'t-peak',acts:btn('Tervezz mesociklust','ujterv')+lk('Saját edzés',{sheet:'custom'})})}`);
  if(arg==='pihen')return page('edzes',{title:'Edzés',sub:`${MESO.name} · ${MESO.week}. hét / ${MESO.of}`,tab:'mai'},`${dstrip('')}
    ${hero({lbl:'Ma pihenőnap',verdict:'Ma a pihenés dolgozik.',sub:'Nincs tervezett edzés mára — a heti rended a Terv fülön találod.',art:'t-moon',acts:btn('A heti rendem','terv','ghost')},1)}
    ${sec(1,'Ha mégis mozognál',2)}
    ${card(ls(rw({icon:'t-dumbbell',title:'Saját edzés',sub:'gyors indítás',on:{sheet:'custom'}}),rw({icon:'c-i-retegek',title:MESO.name,sub:'MAV · 3. hét / 6',on:'run'})),{i:2})}`);
  if(arg==='sze'){const sk=ST.sk.sze,km=kmCovers('sze');return page('edzes',{title:'Edzés',sub:'Szerda · szept 23.',tab:'mai'},`${dstrip('sze')}
    ${hero({lbl:'Szerda · 07:30 · Gym',verdict:'Leg Day',big:true,art:'t-dumbbell',sub:km?'Kímélő mód':sk?'Kihagyva':'Elmaradt — ez volt erre a napra tervezve.',
      body:facts([['6','gyakorlat'],['18','szett'],['~70','perc']])+(km?box('t-kimelo','Kímélő mód','<p>Magától kimaradt, nem számít mulasztásnak.</p>'):sk?skBlock('sze'):''),
      acts:km?'':sk?skActs('sze'):`<button class="btn" style="flex:1" data-go="indulas">Kezdjük el</button>`+vl('Kihagytam','skip:sze')},1)}
    ${card(`<p class="fh-note" style="margin:0">Az elmúlt 7 nap kimaradt alkalmaihoz utólag is megadhatod, miért maradtak ki.</p>`,{i:2})}`)}
  const vKm=kmCovers('volley'),vSk=!vKm&&ST.sk.volley,rKm=kmCovers('run'),rSk=!rKm&&ST.sk.run,rCb=!rKm&&!rSk&&ST.cb&&!ST.km;
  const E=ST.day==='done'?[190,vKm||vSk?0:460]:[0,vKm||vSk?190:650];
  const MUS=[['back-wide','Hát (széles)',6,ST.day==='done'?6:0],['back-mid','Hát (közép)',4,ST.day==='plan'?0:3],['shoulder-rear','Váll (hátsó)',3,0],['biceps-brachialis','Kar',3,0]];
  const kmIn=`<div class="vs-in"><span>${I('t-kimelo')} Kímélő mód · magától kimarad, nem számít mulasztásnak.</span></div>`;
  const rc=readyCard();let n=0;
  return page('edzes',{title:'Edzés',sub:`${MESO.name} · ${MESO.week}. hét / ${MESO.of}`,tab:'mai'},`${dstrip()}
  ${thero()}
  ${rc?sec(++n,'Mielőtt elkezded',2)+rc:''}
  ${sec(++n,'Ma még',3)}
  ${card(ls(step({time:'18:00',icon:'t-volley',title:'Röpi edzés · BVSC',sub:`90 perc · feladó · BVSC csarnok ${st(vKm?'Kímélő mód':vSk?'Kihagyva':'Tervezett')}`}),
    vKm?kmIn:vSk?`<div class="vs-in col">${skBlock('volley')}<div>${skActs('volley')}</div></div>`:`<div class="vs-in">${lk('Logold a session-t',{sheet:'sportlog'})}${vl('Kihagyom','skip:volley')}</div>`,
    rCb?step({time:'holnap',icon:'t-run',title:'Sprint-intervallum',sub:`18:00 · <s>~30</s> ~15 perc · laza tempó ${st('Tervezett')}`})+`<div class="vs-in"><span>${I('t-sprout')} Visszatérő futás · első futás kihagyás után: kb. fele olyan hosszú, laza tempóban.</span></div>`
      :step({time:'tegnap',icon:'t-run',title:'Sprint-intervallum',sub:`18:00 · 6 kör · RPE 9–10 ${st(rKm?'Kímélő mód':rSk?'Kihagyva':'Elmaradt',rKm||rSk?'q':'bad')}`})
        +(rKm?kmIn:rSk?`<div class="vs-in col">${skBlock('run')}<div>${skActs('run')}</div></div>`:`<div class="vs-in">${lk('Pótlom',{sheet:'runlog'})}${vl('Kihagytam','skip:run')}</div>`)),{i:3})}
  ${sec(++n,'Mai terhelés',4)}
  ${card(head('t-muscle','Mit terhel a mai mozgásod','Térkép','terkep')+MUS.map(([k,l,p,d])=>mus(k,l,`${d} / ${p} szett`,Math.max(4,d/p*100))).join('')
    +note(`${E[0]?`<b>+${E[0]} kcal</b> már a keretedben van${E[1]?`, +${E[1]} még jön, ha megcsinálod`:''}.`:`<b>+${E[1]} kcal</b> kerül a mai kereted fölé, ha mindent megcsinálsz.`} ${ST.day==='run'?'A folyamatban lévő edzés a befejezéskor kerül a keretedbe. ':''}Becslés, nem mérés. Ugyanez a szám áll a Fuel keretében.`),{i:4})}
  ${sec(++n,'Vagy inkább',5)}
  ${card(`<div class="fh-pair"><button data-sheet="custom">${I('t-dumbbell')}Egyedi edzés</button><button data-go="sportlog">${I('t-volley')}Sport naplózása</button></div>
    <div class="vl" style="margin-top:14px">${rw({icon:'c-i-retegek',title:'Mezociklus',sub:`${MESO.name} · MAV · 3. hét / 6`,on:'run'})}${rw({icon:'c-i-sport',title:'Sportjaid és szezonod',sub:'BVSC · heti ritmus, napló',on:'sport'})}</div>`,{i:5})}`)}
function whySheet(){
  const k=ST.whyk,cur=ST.sk[k]||{cat:'NONE'},c=CATS.find(x=>x[0]===cur.cat),kmHere=ST.km&&ST.km.from===k&&c&&c[3];
  const nt=kmHere?box('t-kimelo','Kímélő mód bekapcsolva','<p>Amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.</p>')
    :!c?box('t-info','Nem kötelező','<p>Ha megmondod, miért, a terv és az edző ehhez igazodik.</p>')
    :c[3]?box('t-heart','Nem számít mulasztásnak.',`<p>${CARE[c[0]]}</p>`):passKey()===k?box('t-shield','Ezt a heti szabadjegyed fedezi','<p>A sorozatod marad.</p>'):box('t-info','Ez rendes kihagyásnak számít','<p>A heti szabadjegyet már felhasználtad. Semmi gond, jövő héten új jár.</p>');
  return `${sh(`Kihagyva · ${SKT[k]}`,'Miért marad ki?','Nem kötelező — segít, hogy a terv hozzád igazodjon.')}
  <div class="vs-opts">${CATS.map(([id,ic,l])=>`<button class="${cur.cat===id?'on':''}" data-ve="why:${id}">${I(ic)}<span>${l}</span></button>`).join('')}</div>
  ${cur.cat==='OTHER'?lab('Mi történt? · saját szavakkal')+`<div class="fh-in vs-fld ${cur.text?'':'ph'}"><span>${cur.text||'pl. családi program jött közbe'}</span>${I('t-mic')}</div>`:''}
  ${c&&c[3]?lab('Meddig tarthat?')+chips(KDUR,kmHere?ST.km.dur:-1,i=>`kmdur:${i}`):''}
  ${nt}
  ${acts(ve('Kész','whydone:1','',c?'style="flex:1"':'disabled style="flex:1;opacity:.45"'),vl('Most nem mondom','whydone:0'))}`}
const UDVX=[['1–2 nap',d=>`${d>=1&&d<=2?d:2} nap kiesés`,'a program megy tovább a naptár szerint.','Az első edzés könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.'],['kb. egy hét',()=>'3 nap kiesés','onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz (okt. 18. → okt. 25.).','Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.'],['több mint egy hét',()=>'11 nap kiesés','egy hetet visszalépünk: a 2. héttel folytatod, a program vége 2 héttel később lesz (okt. 18. → nov. 1.).','Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.']];
function udvSheet(){const [,h,l1,l2]=UDVX[ST.udv];
  return `${sh('Kímélő mód vége','Üdv újra!','Így folytatjuk — a terv magától igazodik.')}
  ${lab('Próbáld ki · mennyi ideig tartott?')}${chips(UDVX.map(x=>x[0]),ST.udv,i=>`udvt:${i}`)}
  <div class="vl" style="margin-top:14px">${rw({icon:'t-calendar',title:h(ST.km?ST.km.day-1:2),sub:l1})}${rw({icon:'t-dumbbell',title:'Könnyített kezdés',sub:l2})}${rw({icon:'t-run',title:'Rövidebb első futás',sub:'Az első futás kb. fele olyan hosszú, laza tempóban.'})}</div>
  ${acts(ve('Rendben','udv:1','','style="flex:1"'),vl('Mégsem vagyok jól','udv:0'))}`}

/* ── ELIGAZÍTÁS (teljes képernyő) ── */
function indulas(){
  if(!ST.tick)ST.tick=CHAL.map(c=>c.pre); const on=ex=>CHAL.some((c,i)=>ST.tick[i]&&c.ex===ex),n=ST.tick.filter(Boolean).length;
  return page('edzes',{title:'Eligazítás',sub:'Pull Day · 3. hét / 6 · MAV',back:'mai'},`
  ${hero({lbl:'Várható idő',verdict:'70–85 perc, a saját tempód alapján.',art:'t-clock',body:facts([['5','gyakorlat'],['16','szett'],[String(n),'küldetés']])})}
  ${hero({warn:true,lbl:'Figyelj rá',verdict:'Jobb váll aktív',sub:'Óvatosan, először warm-up. A Rear Delt Fly ma könnyítve megy.',left:`<span class="vs-ic">${I('t-bandage')}</span>`},1)}
  ${sec(1,'Küldetések · mit vállalsz ma?',2)}
  ${card(ls(CHAL.map((c,i)=>rw({left:tk(ST.tick[i]),title:c.ex,sub:`${c.type} · <b>${c.target}</b> · ${c.conf==='tanulom'?'még tanulom, mennyire biztos':c.conf+' biztos'}`,ve:`btick:${i}`,nochev:true,right:`<button class="fh-lk" data-toast="${esc(c.why).replace(/"/g,'&quot;')}">Miért?</button>`})))
    +note('Az előre bepipáltakat javaslom. Passzolni ér — és edzés közben is elengedheted bármelyiket.'),{i:2})}
  ${sec(2,'Ma itt lépünk előre',3)}
  ${card(ls(rw({icon:'t-up',title:'Túlterhelés · 2× +súly · 2× +rep',sub:'Ezeken a gyakorlatokon lépünk ma előre.'})),{i:3})}
  ${sec(3,'A mai sor',4)}
  ${card(ls(EX.map(e=>rw({m:e.k,title:e.n,sub:`${e.sets.length} szett · cél ${e.goal} · ${e.chg}${e.why?' · '+e.why:''}`,right:on(e.n)?`<span class="vs-q">${I('t-quest')}</span>`:''}))),{i:4})}`,
  {nonav:true,foot:ve(n?`Indulás · ${n} küldetéssel`:'Indulás küldetés nélkül','bstart','','style="flex:1"')})}

/* ── EDZÉS KÖZBEN (súly · ism · RIR → pihenő) ── */
const freshSets=e=>e.sets.map((s,j)=>{const w=isDone(s)?s[0]:s[1],r=isDone(s)?s[1]:s[2],ri=isDone(s)?s[2]:s[3];return j===0&&e===EX[0]?['cur',w,r,ri]:['up',w,r,ri]});
const exChal=n=>CHAL.map((c,i)=>i).filter(i=>CHAL[i].ex===n&&(CHAL[i].acc||CHAL[i].rel));
const curIdx=fresh=>fresh?0:Math.max(0,EX.findIndex(e=>e.sets.some(s=>s[0]==='cur')));
function setRow(s,j,i){
  if(isDone(s))return `<span class="n">${j+1}</span><span class="v d">${kg(s[0])}</span><span class="v d">${s[1]}</span><span class="v d">${s[2]}</span><button class="vd" data-sheet="set" data-arg="${i}.${j}" aria-label="Szett szerkesztése">${I(VI[s[3]])}</button>`;
  if(s[0]==='cur')return `<span class="n now">${j+1}</span><input class="vin" inputmode="decimal" value="${kg(s[1])}" aria-label="Súly, kg"><input class="vin" inputmode="numeric" value="${s[2]}" aria-label="Ismétlés"><input class="vin" inputmode="numeric" value="${s[3]}" aria-label="RIR"><button class="tk" data-sheet="rp" data-arg="${i}" aria-label="Szett kész">${I('i-check')}</button>`;
  return `<span class="n">${j+1}</span><span class="v u">${kg(s[1])}</span><span class="v u">${s[2]}</span><span class="v u">${s[3]}</span><span></span>`}
const restFoot=()=>`<span class="vs-rest">${ring(Math.round((1-ST.restLeft/ST.restTotal)*100),{s:48,val:''})}<span class="g"><strong>${mmss(ST.restLeft)}</strong><small>pihenő · ${ST.restTotal} mp az ajánlott</small></span></span><button class="btn sm ghost" data-ve="plus15">+15</button><button class="btn sm" data-ve="reststop">Tovább</button>`;
function session(arg){const fresh=arg==='uj',d=fresh?0:DONE(),ci=curIdx(fresh),fi=ST.focus!=null&&EX[ST.focus]?ST.focus:ci,e=EX[fi],rows=fresh?freshSets(e):e.sets,dn=x=>fresh?0:x.sets.filter(isDone).length;
  const extra=[e.origin?`${e.origin==='meso'?'Mezociklusban':'Csak ma'} · ${e.from?`a ${e.from} helyett`:'ma hozzáadva'}`:'',e.note,e.cue,e.why].filter(Boolean);
  const tg=e.to?`<div class="vs-tg"><span><small>Állapot</small><b>kész · lecserélve → ${e.to}</b></span></div>`
    :e.last?`<div class="vs-tg"><span><small>Múlt hét</small><b>${e.last}</b></span><span class="t"><small>Mai cél</small><b>${e.goal}</b>${e.chg?`<i>${e.chg}</i>`:''}</span></div>`
    :`<div class="vs-tg"><span><small>Első alkalom</small><b>a súlyt te adod meg, innentől jön a javaslat</b></span></div>`;
  const body=`<div class="vs-tools top"><button data-sheet="recs" data-arg="${fi}">${I('t-journal')}Rekordok</button>${e.to?'':`<button data-sheet="tech" data-arg="${fi}">${I('t-book')}Technika</button><button data-sheet="menu" data-arg="${fi}" aria-label="Gyakorlat menü">⋮ Műveletek</button>`}</div>
    ${tg}
    ${exChal(e.n).map(q=>`<button class="vs-ql" data-sheet="qb" data-arg="${q}">${I('t-quest')}<span>${CHAL[q].acc?`${CHAL[q].type} · ${CHAL[q].target}`:`elengedve · <s>${CHAL[q].target}</s>`}</span>${chev()}</button>`).join('')}
    ${extra.map(x=>`<p class="vs-xl">${x}</p>`).join('')}
    <div class="vs-sets"><span class="h">#</span><span class="h">kg</span><span class="h">ism</span><span class="h">RIR</span><span></span>${rows.map((s,j)=>setRow(s,j,fi)).join('')}</div>`;
  return page('edzes',{title:'Pull Day',sub:`${d} / ${TOT()} szett kész${fresh?'':' · 31 perc'}`,back:'mai'},`
  <div class="vs-pb rise">${EX.map(x=>`<i style="flex:${x.sets.length}"><b style="width:${dn(x)/x.sets.length*100}%"></b></i>`).join('')}</div>
  ${hero({lbl:`${fi===ci?'Most':'Megnyitva'} · ${fi+1}. gyakorlat / ${EX.length} · ${muscleLabel(e.k)}`,verdict:e.n,left:mchp(e.k),body},1)}
  ${sec(1,'A mai sor',2)}
  ${card(ls(EX.map((x,i)=>i===fi?'':rw({m:x.k,title:x.n,sub:x.to?`kész · lecserélve → ${x.to}`:`${x.sets.length} szett · cél ${x.goal}${x.chg?' · '+x.chg:''}`,v:`${dn(x)} / ${x.sets.length}`,ve:`focus:${i}`,right:i===ci?st('Most','plan'):dn(x)===x.sets.length?st('Kész','ok'):''})))
    +note('Koppints egy gyakorlatra, és az kerül felülre a szettjeivel.'),{i:2})}
  ${sec(2,'Közben és a végén',3)}
  ${card(`<div class="fh-pair"><button data-ve="pick:add">${I('t-addex')}Gyakorlat hozzáadása</button><button data-sheet="fin">${I('t-star')}Edzés befejezése</button></div>
    ${acts(lk('Kalauz az edzéshez',{toast:'Kalauz az edzéshez'}))}
    ${note('A harmadik mező beírása után a pipa jön, a pihenő magától indul. A javaslat a múlt hetedből jön; felülírhatod. A kész sor végén az ítélet: célsávban · rekord · cél fölött · cél alatt — koppintva szerkeszthető.')}`,{i:3})}`,
  ST.resting?{nonav:true,foot:restFoot()}:{nonav:true,pad:'60px'})}
const RC=2*Math.PI*40;
function startRest(){ST.resting=true;ST.restLeft=ST.restTotal=90;clearInterval(ST.restT);ST.restT=setInterval(()=>{if(F.R!=='session'||F.D!=='edzes'){stopRest(true);return}ST.restLeft--;if(ST.restLeft<=0){stopRest();toast('Pihenő vége — jöhet a következő szett');return}const r=$('#phone .vs-rest');if(r){r.querySelector('strong').textContent=mmss(ST.restLeft);r.querySelector('.p').setAttribute('stroke-dasharray',`${RC*(1-ST.restLeft/ST.restTotal)} ${RC}`)}},1000);repaint()}
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
function review(arg){
  if(arg==='gyak')return page('edzes',{title:'Húzódzkodás (súlyozott)',sub:'Összegzés · Hát (széles) · Pull Day',back:'review'},`
    ${hero({lbl:'Top szett',verdict:'12,5 × 8 — 2,5 kg-mal több, mint legutóbb.',sub:'4 szett · előzőleg 10 × 8 volt a legnehezebb.',left:mchp('back-wide')})}
    ${sec(1,'A számok',1)}
    ${card(facts([['12,5×8','top szett'],['820','kg volumen'],['1,8','Ø RIR']])+note('előzőleg 10 × 8 — a legnehezebb szett súlya +2,5 kg'),{i:1})}
    ${sec(2,'Medál',2)}
    ${card(ls(rw({icon:'t-record',title:'Súly-rekord · Húzódzkodás',sub:'előző: 10 kg',v:'12,5 kg'})),{i:2})}
    ${sec(3,'Szettek',3)}
    ${card(ls([['12,5 kg × 8','RIR 2','célsávban','100 kg','','t-tick'],['12,5 kg × 8','RIR 1','rekord','100 kg','Az utolsó ismétlés kemény volt','t-record'],['12,5 kg × 7','RIR 2','cél alatt','87,5 kg','','t-down'],['12,5 kg × 8','RIR 2','célsávban','100 kg','','t-tick']].map(([a,r,t,vol,n,ic])=>rw({icon:ic,title:`${a} · ${r}`,sub:`${t}${n?` · „${n}”`:''}`,v:vol}))),{i:3})}`);
  return page('edzes',{title:'Összegzés',sub:'Lezárva · szept 24. · Pull Day',back:'mai'},`
  ${hero({lbl:'Kész · Pull Day',verdict:'14 szett a 16-ból, 4,2 tonna összvolumen.',sub:'5/5 gyakorlat · terv ~62, tény 71 perc',art:'t-dumbbell',
    body:`<div class="fh-chips">${[['back-wide',7],['back-mid',3],['shoulder-rear',3],['biceps-brachialis',2],['traps',2]].map(([k,n])=>`<span>${mchp(k,'sm')}${n} szett</span>`).join('')}</div>`,
    acts:lk('‹ Előző Pull Day',{toast:'Előző Pull Day · szept 17.'})+`<span class="fh-note" style="margin:0">ez a legutóbbi</span>`})}
  ${sec(1,'Mihez képest · szept 17., 1 hete',1)}
  ${card(ls(rw({icon:'t-weight',title:'Volumen',sub:'előző 3,9 t',v:'4,2 t <small>+0,3</small>'}),rw({icon:'t-up',title:'Top szett',sub:'előző 10 × 8',v:'12,5 × 8'}),rw({icon:'t-hold',title:'Ø RIR',sub:'előző 2,0',v:'1,6'}))
    +note('A javulás itt a trend, nem egy nap: a legnehezebb szett súlya három hete emelkedik.'),{i:1})}
  ${sec(2,'Medálok · 3 rekord · 9 célszett',2)}
  ${card(ls([['Súly-rekord','Húzódzkodás (súlyozott)','12,5 kg','előző: 10 kg'],['Rep-rekord','Döntött törzsű evezés','10 @ 72,5','előző: 9 @ 72,5'],['Volumen-rekord','Döntött törzsű evezés','2 175 kg','előző: 2 070 kg']].map(([t,n,v,p])=>rw({icon:'t-record',title:n,sub:`${t} · ${p}`,v})),
    rw({icon:'t-tick',title:'9 célszett teljesítve',sub:'Húzódzkodás ×3 · Evezés ×3 · Vállemelés ×3'})),{i:2})}
  ${sec(3,'Küldetések · 1 megvan · 1 kimaradt',3)}
  ${card(ls(rw({icon:'t-tick',title:'Húzódzkodás: 12,5 × 8 az első szetten',sub:'megcsináltad'}),rw({icon:'t-skip',title:'Kalapácsbicepsz: az utolsó szett RIR 0-ig',sub:'nem jött össze — a riport nem büntet'})),{i:3})}
  ${sec(4,'Gyakorlatonként',4)}
  ${card(ls(LANE.map(([n,k,t,of,d,rec])=>rw({m:k,title:n,sub:`top szett ${t}${rec?' · rekord':''}`,v:`${d} / ${of}`,on:'review.gyak'}))),{i:4})}
  ${sec(5,'Amit aznap írtál',5)}
  ${card(txt('Ma a váll végig nyugton volt, a sorok tiszták. A Kalapácsbicepsznél az utolsó szett elmaradt — elfogyott az idő.')+acts(lk('Szerkesztés',{sheet:'wnote'})),{i:5})}`)}

/* ── LEZÁRÓ CEREMÓNIA (a minta marad: csillagok, számláló; teljes képernyő) ── */
const cstars=()=>`<div class="vs-cstars" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i data-star="${i}">${T('t-star-empty','off')}${T('t-star-half','half')}${T('t-star','on')}</i>`).join('')}</div><div class="vs-fuse"><b></b></div>`;
function cer(arg){
  if(arg==='reszletek')return page('edzes',{title:'Részletek',sub:'Edzés lezárva · Erős nap.',back:'cer'},`
    ${hero({lbl:'A mai mozgással',verdict:`+${hu(CER.kcal)} kcal került a mai keretedbe.`,sub:'Ennyit nyertél a mai mozgással · becslés, nem mérés.',art:'t-bowl',body:`<div class="vs-ms">${mini(CER.ratio)}<span>Erős nap.</span></div>`,acts:lk('Megnézem a Fuelben',{toast:'Fuel · Mai (a mozgás hozzáadja a keretedhez)'})})}
    ${sec(1,'A mai edzésen · izomcsoportok',1)}
    ${card(CER.mus.map(([k,l,d,p])=>mus(k,l,`${d} / ${p} szett`,d/p*100)).join('')+note('A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.'),{i:1})}
    ${sec(2,'Hogy ment?',2)}
    ${card(`<div class="fh-in vs-fld ph" data-toast="Jegyzet írása">Pl. rosszul aludtam, de a húzódzkodás jól ment…</div>`+note('Nem kötelező — később is hozzáírhatod.'),{i:2})}`,
    {nonav:true,foot:`<div class="vs-fcol">${ve('Vissza a mai napra · lezárva és elmentve','cerdone')}${lk('Vissza az értékeléshez','cer')}</div>`,pad:'200px'});
  return page('edzes',{title:'Edzés lezárva',sub:'Pull Day · szept 24.',back:'mai'},`<div id="cerroot">
  <section class="fh-card fh-hero vs-cer" id="cerstage" style="--p:0"><span class="lbl">Így sikerült</span>${cstars()}<p class="verdict vs-cres">Erős nap.</p></section>
  <div class="vs-cres">${sec(1,`Ez a tiéd mostantól · ${CER.rec.length} új rekord`)}
    ${card(ls(CER.rec.map(([n,k,ch])=>rw({icon:KIND_IC[k],title:n,sub:k,v:`${ch[0]} <small>${ch[1]}</small>`}))),{cls:'vs-gold'})}</div>
  <div class="vs-ccard">${sec(2,'A mai számok')}
    ${card(facts([[`${CER.min}′`,'a pulton töltött idő'],[`+${CER.xp}`,'szerzett XP'],[`+${CER.kcal}`,'kcal · becslés']])+`<div class="fh-facts" style="grid-template-columns:repeat(3,1fr)"><div><b data-c="sets">0</b><small>szett</small></div><div><b data-c="reps">0</b><small>ismétlés</small></div><div><b data-c="vol">0</b><small>kg × ism</small></div></div>`)}
    ${sec(3,'Küldetések · 1 / 2')}
    ${card(ls(CER.chal.map(([ok,t,ex,ch])=>rw({icon:ok?'t-tick':'t-skip',title:ex,sub:`${t} · ${ch.join(' · ')}`,right:st(ok?'teljesült':'nem jött össze',ok?'ok':'q')})))+note('2 szett kihagyott státusszal zárult.'))}</div></div>`,
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
  ${hero({lbl:'62% megvan · 58 szett a 94-ből',verdict:'3 izomcsoport még munkára vár ezen a héten.',left:heat('back',hb),body:`<div style="margin-top:12px">${bar(62)}</div>`,
    acts:btn('A tested térképe','terkep','sm')+lk('Miből áll össze?',{sheet:'info'})+lk('3. hét / 6','run')+lk('14 medál','medals')})}
  ${sec(1,'Izomcsoportok · ezen a héten',1)}
  ${card(ls(GR.map(([k,l,d,p,w,much],i)=>rw({m:k,title:`${l}${much?' <b style="color:var(--warn)">· sok</b>':''}`,sub:w,v:`${d} / ${p}`,right:bar(clamp(d/p*100,2,100),muscleColor(k)),on:{sheet:'grp',arg:String(i)},nochev:true})))
    +note('A szám a heti tervből jön: a mesociklus hétre bontott szettjei.'),{i:1})}
  ${sec(2,'Sport a héten · 4 röpi · 6,5 óra',2)}
  ${card(ls(rw({m:'shoulder-front',title:'Váll · ütések, nyitások',v:'erős'}),rw({m:'calf',title:'Vádli · ugrások',v:'közepes'}),rw({m:'core',title:'Core',v:'enyhe'}))+note('Becslés — a szettszámokba nem számít bele.'),{i:2})}
  ${sec(3,'Minden mozgásod a héten',3)}
  ${card(ls(rw({icon:'t-dumbbell',title:'Gym · 3 edzés',v:'58 <small>szett</small>'}),rw({icon:'t-volley',title:'Röpi · 4 session',v:'6,5 <small>ó</small>'}),rw({icon:'t-run',title:'Futás · 1 edzés',v:'6 <small>kör</small>'}))
    +acts(lk('+ Saját edzés',{sheet:'custom'})),{i:3})}`)}

/* ── SPORT ── */
function sport(tab='terv'){
  const B={terv:()=>`${sec(1,'Heti ritmus · 7,5 ó',2)}
    ${card(ls([['H','','nincs session'],['K','18:00 · 90p','Röpi edzés','BVSC csarnok'],['Sze','','nincs session'],['Cs','18:00 · 90p','Röpi edzés','BVSC csarnok','ma'],['P','','nincs session'],['Szo','10:00 · 120p','Meccs · Kőbánya','Kőbánya Sport','egyszeri'],['V','','nincs session']].map(([d,t,n,loc,tg])=>t?rw({left:`<span class="vs-day">${d}</span>`,title:`${n}${tg?` ${st(tg,tg==='ma'?'plan':'q')}`:''}`,sub:`${t} · ${loc}`,right:lk('Logold',{sheet:'sportlog'})}):rw({cls:'muted',left:`<span class="vs-day">${d}</span>`,title:'nincs session'})))
      +acts(lk('Szerkesztés',{toast:'Heti rend szerkesztése'})),{i:2})}
    ${sec(2,'Események · tavasz · 2026',3)}
    ${card(ls(rw({icon:'t-calendar',title:'Meccs · BVSC – Kőbánya',sub:'szept 27. · 120 perc · Kőbánya Sport',right:lk('törlés',{toast:'Esemény törölve'})}),rw({icon:'t-calendar',title:'Edzőtábor · plusz edzés',sub:'okt 4. · 90 perc · BVSC csarnok',right:lk('törlés',{toast:'Esemény törölve'})}))
      +acts(lk('+ Esemény hozzáadása',{toast:'Új esemény'}))+note('A heti ritmus független a mezociklustól — a sport a saját rendjén fut.'),{i:3})}`,
    naplo:()=>`${sec(1,'Napló · utolsó 4 session · átlag 38 ugrás',2)}
    ${card([['Edzés','szept 23. · 18:00','90p',5,'6,8',72,6,'Smashek tisztábbak, a nyitás még ingadozik.'],['Meccs','szept 20. · 10:00','120p',4,'8,1',86,7,''],['Edzés','szept 18. · 18:00','90p',5,'6,5',64,5,'Könnyebb nap, sok technika.']].map(([t,d,m,s,r,int,v,q])=>`<div class="vs-log">${rw({icon:'t-volley',title:`Röpi · ${t}`,sub:`${d} · ${m} · ${s} szett`,v:`${r} <small>RPE</small>`})}
      <div class="fh-why"><span>Intenzitás</span><span class="v">${Math.round(int/10)}</span>${bar(int)}<span>Váll-terhelés</span><span class="v">${v}</span>${bar(v*10,muscleColor('shoulder-front'))}</div>${q?`<p class="vs-xl">„${q}”</p>`:''}</div>`).join('')
      +note('A heti ritmus független a mezociklustól — a sport a saját rendjén fut.'),{i:2})}`,
    cross:()=>`${sec(1,'Keresztrendszer hatások',2)}
    ${card(msg('mezo','A röpi és a gym egy héten: két dolgot igazítok, hogy ne üssék egymást.','keresztrendszer hatások')
      +`<div class="vl" style="margin-top:12px">${rw({icon:'t-shield',title:'Váll-plafon a csütörtöki Pull Day-en',sub:'A röpi előtti napon a Rear Delt Fly RIR 2 alatt nem megy.'})}${rw({icon:'t-clock',title:'Időzítés',sub:'A szombati meccs előtt a láb-nap péntekről csütörtökre csúszhat.'})}</div>`
      +note('A cross-load sosem büntet — plafont igazít és időzítést ajánl, döntést nem vesz el.'),{i:2})}`}[tab]||(()=>'');
  return page('edzes',{title:'Sport',sub:'BVSC · Felnőtt II.',back:'mai'},`
  ${hero({lbl:'Röplabda · ezen a héten',verdict:'4 session megvolt az 5-ből.',art:'t-volley',body:facts([['6,5 ó','pályán e héten'],['7,1','RPE átlag'],['6,5','váll-terhelés']]),acts:btn('+ Log','sportlog')})}
  ${segw([['Heti terv','sport.terv',tab==='terv'],['Napló','sport.naplo',tab==='naplo'],['Cross-load','sport.cross',tab==='cross']])}${B()}`)}
function sportlog(arg){
  if(!arg)return page('edzes',{title:'Naplózás',sub:'Sport · ma',back:'mai'},`
    ${hero({lbl:'Első lépés',verdict:'Mi volt ma mozgás?',sub:'Válaszd ki, mit csináltál. A következő lapon csak azt kérdezem, ami annál a sportnál tényleg számít.',art:'t-volley'})}
    ${sec(1,'Válassz sportot',1)}
    ${card(ls(SPORTS.map(([ic,l],i)=>rw({icon:ic,title:l,on:`sportlog.${i}`}))),{i:1})}`,{nonav:true,pad:'60px'});
  const [ic,l]=SPORTS[+arg]||SPORTS[0];
  return page('edzes',{title:l,sub:'Naplózás · ma',back:'sportlog'},`
  ${hero({lbl:'Második lépés',verdict:'Hogy ment?',sub:'Csak az, ami ennél a sportnál számít.',art:ic,body:`<div style="margin-top:14px">${seg([['Edzés',{toast:'Edzés mód'},true],['Meccs',{toast:'Meccs mód'},false]])}</div>`})}
  ${sec(1,'Idő és terhelés',1)}
  ${card(ls(stp('Időtartam · perc',90))+blk('Megélt terhelés (RPE)',scale(7))+blk('Vállterhelés',chips(['kicsi','közepes','nagy'],1))+`<div class="vl" style="margin-top:14px">${stp('Játszott szettek',5)}</div>`,{i:1})}
  ${sec(2,'Kalória',2)}
  ${card(ls(rw({icon:'t-plate',title:'Kalória: becslést mentünk',sub:'~620 kcal · a súlyod és az időtartam alapján',right:lk('Saját érték',{toast:'Saját érték'})})),{i:2})}`,
  {nonav:true,foot:ve('Naplózom · 90 perc','sportsave','','style="flex:1"')})}

/* ── FUTÁS ── */
function futas(tab='het'){
  const B={het:()=>`${sec(1,'E heti edzés · 1 / 2 kész',2)}
    ${card(ls([['Sprint-intervallum','kedd · 18:00',1,'5p bemelegítés · 6× 15 mp · 45 mp séta · 5p levezetés'],['Piramis-intervallum','péntek · 17:30',0,'5p bemelegítés · 15–30–45–30–15 mp · pihenő = szakasz × 2 · 5p levezetés']].map(([n,d,ok,s])=>rw({icon:'t-run',title:n,sub:`${d} · ${s}`,right:ok?st('Kész','ok'):lk('Naplózd',{sheet:'runlog'})}))),{i:2})}
    ${sec(2,'Keresztterhelés · futás és röpi egy héten',3)}
    ${card(ls(rw({icon:'t-clock',title:'A pénteki piramis',sub:'a szombati meccs előtt könnyített változatban fut.'})),{i:3})}`,
    naplo:()=>`${sec(1,'Pulzus-megnyugvás · utolsó 6 futás',2)}
    ${card(`<p class="fh-big">−16<small>mp az első óta</small></p><p class="fh-txt vs-sub">A trend lefelé tart.</p>${trend([58,54,51,49,46,42])}`+note('A vonal a simított irány, a pontok az egyes futások. Mp a nyugalmi pulzusig — alacsonyabb = jobb regeneráció.'),{i:2})}
    ${sec(2,'Napló · utolsó 3 futás',3)}
    ${card(ls([['szept 23.','Sprint',9,6,42],['szept 19.','Piramis',8,5,46],['szept 16.','Sprint',9,6,49]].map(([d,t,r,k,h])=>rw({icon:'t-run',title:`${t}-intervallum`,sub:`${d} · RPE ${r} · ${k} kör`,v:`${h} <small>mp pulzus</small>`}))),{i:3})}`,
    tervek:()=>`${sec(1,'Aktív · 1',2)}${card(ls(rw({icon:'t-run',title:'Robbanékonyság 01',sub:'szept 8. – nov 2. · 8 hét · 2× / hét',on:'futasterv'})),{i:2})}
    ${sec(2,'Tervezett · 1',3)}${card(ls(rw({icon:'t-calendar',title:'5K-alapozó',sub:'nov 9.-től · 6 hét',on:'futasterv'})),{i:3})}
    ${sec(3,'Archív · 1',4)}${card(ls(rw({icon:'t-history',title:'Téli base 02',sub:'jan–márc',on:'futasterv'})),{i:4})}`}[tab]||(()=>'');
  return page('edzes',{title:'Futás',sub:'Robbanékonyság 01 · sprint-állóképesség röpihez',back:'terv'},`
  ${hero({lbl:'Építő fázis · 2× / hét',verdict:'A 8 hetes blokk 3. hetében jársz.',sub:'E héten 1 / 2 edzés kész.',art:'t-run',
    body:`<div class="vs-wkb">${Array.from({length:8},(_,i)=>`<i class="${i<2?'d':i===2?'n':''}">${i+1}</i>`).join('')}</div>`,
    acts:tab==='tervek'?btn('+ Új terv','futasterv'):btn('Naplózd a futást',{sheet:'runlog'})})}
  ${segw([['E heti edzés','futas.het',tab==='het'],['Napló','futas.naplo',tab==='naplo'],['Tervek','futas.tervek',tab==='tervek']])}${B()}`)}
function futasterv(){
  return page('edzes',{title:'Robbanékonyság 01',sub:'Futóterv · aktív · 3. hét / 8',back:'futas.tervek'},`
  ${hero({lbl:'Futóterv',verdict:'Aktív terv, a 3. hétnél tart.',sub:`${I('i-check')} Minden változás mentve.`,art:'t-run',acts:btn('Lezárás',{toast:'Lezárás'})+lk('⋯ Több',{sheet:'blkmenu'})})}
  ${sec(1,'Alapadatok',1)}
  ${card(`<span class="fh-lab" style="margin-top:0">Terv neve</span>`+fld('Robbanékonyság 01')+lab('Cél (pl. sprint-állóképesség)')+fld('sprint-állóképesség röpihez')+`<div class="vl" style="margin-top:14px">${stp('Hetek · 1–8',8)}</div>`,{i:1})}
  ${sec(2,'Hetek',2)}
  ${card(ls([1,2,3].map(w=>rw({left:`<span class="vs-day">${w}.</span>`,title:`${w}. hét`,sub:'6 kör · 45 mp pihenő · 5p bemelegítés · 6× 15 mp · 5p levezetés',right:lk('+ szakasz',{toast:'Szakasz hozzáadása'})}))),{i:2})}`)}

/* ── MEDÁLOK · GYAKORLATOK ── */
function medals(arg){
  const h=hero({lbl:'Medálok',verdict:arg==='ures'?'Még nincs medálod.':'14 medál, ebből 5 e hónapban.',sub:arg==='ures'?'Az első megdöntött rekord ide kerül.':'A medálok visszamenőleg, a korábban logolt szetteid alapján épültek fel — nem mindegyiket élőben szerezted.',art:'t-record'});
  if(arg==='ures')return page('edzes',{title:'Medálok',sub:'Gyakorlatok',back:'exercises'},`${h}${card(empty('t-record','Itt gyűlnek majd a rekordjaid, dátum szerint.'),{i:1})}`);
  const G=[['Szept 24.',[['r','Húzódzkodás (súlyozott)','Súly-rekord','12,5 kg','előző: 10 kg · szept 17. óta állt'],['r','Döntött törzsű evezés','Rep-rekord','10 @ 72,5','előző: 9 · szept 10. óta állt'],['c','Vállemelés','Cél teljesítve','30 × 15','3 célszett']]],['Szept 17.',[['r','Döntött törzsű evezés','1RM-rekord','96,7 kg','előző: 94,0 kg · szept 3. óta állt'],['r','Kalapácsbicepsz','Súly-rekord','16 kg','előző: 14 kg · jún 22. óta állt']]]];
  return page('edzes',{title:'Medálok',sub:'Gyakorlatok',back:'exercises'},`${h}
  ${G.map(([d,rows],gi)=>sec(gi+1,d,gi+1)+card(ls(rows.map(([t,n,l,v,p])=>rw({icon:t==='c'?'t-tick':'t-record',title:n,sub:`${l} · ${p}`,v}))),{i:gi+1})).join('')}`)}
function exercises(){
  return page('edzes',{title:'Gyakorlatok',sub:'A mozdulataid',tab:'exercises'},`
  ${hero({lbl:'A mozdulataid',verdict:'42 gyakorlat, 18 rekorddal.',sub:'Mindegyiknél ott a rekordod, a technika és a múltja.',art:'t-muscle',acts:btn('14 medál','medals')+lk('+ Új gyakorlat',{toast:'Új gyakorlat lap'})})}
  ${sec(1,'Keresés és szűrés',1)}
  ${card(`<div class="fh-in vs-fld ph" data-toast="Keresés">Keresés névre vagy izomra…</div><div style="margin-top:12px">${chips(['Mind','Mell','Hát','Váll','Kar','Láb','Core'],0)}</div>`,{i:1})}
  ${sec(2,'Lista',2)}
  ${card(ls(GY.map(([n,k,rm,m])=>rw({m:k,title:n,sub:`${muscleLabel(k)}${rm?(m?` · ${m} medál`:''):' · még nincs naplózva'}`,v:rm?`${rm} kg <small>1RM</small>`:null,on:'exercise'}))),{i:2})}`)}
function exercise(){
  const sim=LIB.filter(x=>x[1]==='back-mid').slice(0,3);
  return page('edzes',{title:'Döntött törzsű evezés',sub:'Hát (közép) · saját',back:'exercises'},`
  ${hero({lbl:'Következő cél',verdict:'77,5 kg × 8 — a legjobb szetted, most RIR 2-vel.',sub:'24 alkalom · márc 4. óta · 12,4 t összsúly',left:mchp('back-mid')})}
  ${sec(1,'Rekordjaid',1)}
  ${card(facts([['96,7 kg','becsült 1RM'],['77,5×8','legjobb szett · aug 28.'],['2 175 kg','legtöbb volumen · szept 24.']])+acts(lk('Mi ez?',{toast:'A rekordok magyarázata'})),{i:1})}
  ${sec(2,'Az erőd íve · becsült 1RM · márc → szept',2)}
  ${card(trend([80,83,86,84,89,92,94,96.7],{c:dk('back-mid')})+note('A vonal a simított irány, a pontok az egyes alkalmak.'),{i:2})}
  ${sec(3,'Technika és alternatívák',3)}
  ${card(ls(rw({icon:'t-book',title:'Beállás · Végrehajtás · Gyakori hibák',sub:'a mozdulat három lépésben',on:{sheet:'tech',arg:'1'}}),rw({icon:'t-camera',title:'Demó videó',on:{toast:'Demó videó'}}),
    sim.map(([n,k,t,last])=>rw({m:k,title:n,sub:`ugyanarra az izomra · ${t==='compound'?'összetett':'izolált'}${last?` · múltkor ${last}`:' · még nem csináltad'}`,on:{toast:`${n} — csere az edzés közben a ⋮ menüből`}}))),{i:3})}
  ${sec(4,'Medáljaid',4)}
  ${card(ls(rw({icon:'t-record',title:'Rep-rekord',sub:'szept 24.',v:'10 @ 72,5'}),rw({icon:'t-record',title:'1RM-rekord',sub:'szept 17.',v:'96,7 kg'})),{i:4})}
  ${sec(5,'Hol szerepel · kezelés',5)}
  ${card(ls(rw({icon:'t-peak',title:'A futó tervedben · csütörtök',on:'nap.csu'}),rw({icon:'t-stack',title:'Sablon a polcodon',on:'sablon'}),rw({icon:'t-note',title:'Szerkesztés',sub:'név, izom, típus — és a törlés',on:{toast:'Szerkesztés lap'}})),{i:5})}`)}

/* ── TERV ── */
const kgTxt=v=>v===0?'saját testsúly':kg(v)+' kg';
const dayState=d=>d.d==='Csü'?'ma':d.done?'megvolt':'jön';
function dayRow(d){
  if(d.rest||d.sport)return rw({cls:'muted',icon:d.sport?'t-volley':'t-moon',title:d.full,sub:d.sport?'röplabda · meccs':'pihenőnap'});
  if(ST.km&&!d.done&&d.id!=='pen'&&DAYS.indexOf(d)>=DAYS.findIndex(x=>x.id===TODAY)&&!(d.id===TODAY&&ST.km.released))return rw({cls:'muted',icon:'t-kimelo',title:`${d.full} · ${d.t}`,sub:'kímélő mód · kimarad'});
  const s=dayState(d),part=d.done&&d.done.sets<d.sets;
  return rw({left:stk(d.mus.map(m=>m[0])),title:`${d.full} · ${d.t}`,sub:d.done&&s==='megvolt'?`${d.done.sets} szett · ${d.done.min} perc${d.done.rec?` · ${d.done.rec} rekord`:''}`:`${d.sets} szett · ~${d.min} perc · ${d.ex.length} gyakorlat`,
    right:s==='megvolt'?st(part?`Részben · ${d.done.sets}/${d.sets}`:'Megvolt',part?'warn':'ok'):s==='ma'?st('Ma','plan'):st('Jön'),on:`nap.${d.id}`})}
const NDAYS=()=>DAYS.filter(x=>!x.rest&&!x.sport).length;
const demoT=()=>note(`Demó: <button class="fh-lk" data-go="terv.fut">futó terv</button> · <button class="fh-lk" data-go="terv.ures">még nincs terv</button> · <button class="fh-lk" data-go="terv.nincs">nem fut terv</button>`);
function terv(arg){
  if(arg==='ures'||arg==='nincs')ST.terv=arg;else if(arg==='fut')ST.terv='run';
  if(ST.terv!=='run'){const e=ST.terv==='ures';return page('edzes',{title:'Terv',sub:e?'Még nincs terved':'Most nem fut terv',tab:'terv'},`
    ${hero({lbl:'Terv',verdict:e?'Még nincs edzésterved.':'Most nem fut terv.',sub:e?'Itt fognak élni a terveid — egy terv megmondja, melyik nap mit edzel, és hétről hétre mennyit. Állíts össze egyet — végigkérdezem, mi fér bele a hetedbe.':'A terveid az Edzéstervek mögött várnak, és bármikor indíthatsz egy újat. Válassz a terveid közül, vagy csinálj újat.',art:'t-peak',acts:btn('Új terv összeállítása','ujterv')})}
    ${sec(1,'Amiből indíthatsz',1)}
    ${card(ls(rw({icon:'t-stack',title:'Edzéstervek',sub:'amiből indíthatsz',on:'konyvtar'}),rw({icon:'t-run',title:'Futás',sub:'Robbanékonyság 01 · 3. hét / 8',on:'futas'}))+demoT(),{i:1})}`)}
  const toDeload=MESO.curve.indexOf('Deload')+1-MESO.week,rest=toDeload===0?' — és ez a hét maga a pihenőhét':toDeload===1?' — a jövő hét már pihenőhét':` — ${toDeload} hét múlva jön a pihenőhét`,ph=MESO.curve[MESO.week-1];
  return page('edzes',{title:'Terv',sub:`${MESO.week}. hét a ${MESO.of}-ból`,tab:'terv'},`
  ${hero({lbl:`${MESO.name} · Tavasz · ${PHASE[ph]}`,verdict:`A ${MESO.of} hétből a ${MESO.week}. héten jársz.`,sub:`${WTOTAL} szett, ${NDAYS()} edzésnapra osztva${rest}.`,
    body:arc(MESO.week)+`<div class="vs-ft"><span>${MESO.from}</span><span>${MESO.to}</span></div>`,acts:btn('A terv oldala','run')})}
  ${sec(1,`A heted · ${NDAYS()} edzésnap`,1)}
  ${card(ls(DAYS.map(dayRow)),{i:1})}
  ${sec(2,'Az izmaid',2)}
  ${card(ls(rw({icon:'t-muscle',title:'Melyik izmod hol tart',sub:`${ROLL.length} izom kap többet hétfőtől`,on:'het'})),{i:2})}
  ${sec(3,'Terveid',3)}
  ${card(ls(rw({icon:'t-stack',title:'Edzéstervek',sub:'amiből indíthatsz',on:'konyvtar'}),rw({icon:'t-run',title:'Futás',sub:'Robbanékonyság 01 · 3. hét / 8',on:'futas'}),rw({icon:'t-coin',title:'Edzésterv lezárása',sub:`ha ezt a ${MESO.of} hetet végigcsináltad`,on:{sheet:'close'}}))+demoT(),{i:3})}`)}
function run(){const ph=MESO.curve[MESO.week-1];
  return page('edzes',{title:`${MESO.name} · Tavasz`,sub:`Aktív · ${MESO.week} / ${MESO.of}. hét · ${PHASE[ph]} · vége ${MESO.to}`,back:'terv'},`
  ${hero({lbl:`A terv íve · ${MESO.split}`,verdict:'Az 5. hét a csúcs, a 6. a pihenőhét.',sub:'Akkor szándékosan kevesebbet kérek tőled. Az oszlopok alatt a heti szettszám.',body:arc(MESO.week,WEEK_SETS),acts:btn('Heti vizsgálat','het')})}
  ${sec(1,'Mezo jegyzete',1)}
  ${card(msg('mezo','„A hátad bírta a múlt heti emelést, ezért kapott még két szettet. A vállad marad, amíg a jobb oldali nyilallás el nem múlik.”'),{i:1})}
  ${sec(2,'Hol tartasz',2)}
  ${card(ls(rw({icon:'t-muscle',title:'Heti vizsgálat',sub:'melyik izmod hol tart',right:`<span class="vs-mini">${WMUS.slice(0,7).map(m=>`<i style="--c:${dk(m[1])};--h:${clamp(m[2]/m[5]*100,14,100)}%"></i>`).join('')}</span>`,on:'het'}),
    rw({icon:'t-calendar',title:'Hétfőn jön · előrejelzés',sub:ROLL.map(n=>`${n} +2 szett`).join(' · ')})),{i:2})}
  ${sec(3,`A heted · ${NDAYS()} edzésnap`,3)}
  ${card(ls(DAYS.map(dayRow)),{i:3})}
  ${sec(4,'Lezárás',4)}
  ${card(ls(rw({icon:'t-coin',title:'Edzésterv lezárása',sub:'lezárás után riportot kapsz róla',on:{sheet:'close'}}))+note('A terv oldala állapot-első. A szerkesztés egy szinttel lejjebb, a napoknál van.'),{i:4})}`)}
const BACKSIDE=['ham','glute','calf','back-mid','back-wide','back-lower','traps','shoulder-rear'];
const dayView=d=>d.mus.filter(([k])=>BACKSIDE.includes(k)).length>d.mus.length/2?'back':'front';
function nap(id){const d=DAYS.find(x=>x.id===id)||DAYS.find(x=>x.id===TODAY);
  if(d.rest||d.sport)return page('edzes',{title:d.t,sub:d.full,back:'terv'},`
    ${hero({lbl:d.full,verdict:d.sport?'Ezen a napon sportolsz, nem a terv szerint edzel.':'Ezen a napon nem kérek tőled semmit.',sub:d.sport?'A meccs a Mai fülön naplózható.':'A pihenés is a terv része.',art:d.sport?'t-volley':'t-moon'})}
    ${card(`<p class="fh-note" style="margin:0">Egy hét a pihenőnapjaival együtt egész — ezért látszanak itt is.</p>`,{i:1})}`);
  const share=Math.round(d.sets/WTOTAL*100);
  return page('edzes',{title:d.t,sub:`Terv · ${d.full}`,back:'terv'},`
  ${hero({lbl:d.full,verdict:`${d.sets} munkaszett, ${d.ex.length} gyakorlat.`,sub:`${d.min} perc · a heted ${share}%-a`,left:heat(dayView(d),d.mus.map(([k])=>[k,.9]),'lg'),acts:btn('A nap szerkesztése','napszerk')})}
  ${sec(1,'Amit ezen a napon megdolgozol',1)}
  ${card(d.mus.map(([k,s])=>mus(k,muscleLabel(k),`${s} szett`,clamp(s/10*100,6,100))).join(''),{i:1})}
  ${sec(2,'A gyakorlatok · olvasható előírás',2)}
  ${card(ls(d.ex.map(([n,k,ws,rep,rir,wu,w,warn],i)=>rw({m:k,title:`${i+1}. ${n}`,sub:`<b>${ws}×${rep}</b> · RIR ${rir} · induló ${kgTxt(w)} · ${wu} bemelegítő${warn?`<span class="vs-warn">${warn}</span>`:''}`})))
    +acts(lk('+ Gyakorlat hozzáadása','napszerk'))+note('Ez az oldal csak olvas. Minden szerkesztés a nap saját szerkesztőjében történik.'),{i:2})}`)}
const edRow=(n,k,ws,rep,rir,w)=>rw({left:`<span class="vs-grip">⠿</span>`,m:k,title:n,sub:`${ws} szett · ${rep} ism. · RIR ${rir} · ${kgTxt(w)}`,right:`<button class="vs-rb" data-toast="Sor műveletei" aria-label="Sor műveletei">⋮</button>`});
function napszerk(){const d=DAYS.find(x=>x.id===TODAY);
  return page('edzes',{title:'A nap szerkesztése',sub:`${d.full} · ${d.t} · ${d.sets} szett`,back:'nap.'+d.id},`
  ${hero({lbl:`${d.full} · ${d.t}`,verdict:`${d.ex.length} gyakorlat, ${d.sets} szett.`,sub:'Húzd a sorokat a sorrendhez. Minden változás azonnal mentődik.',art:'t-pencil',acts:btn('+ Gyakorlat hozzáadása',{toast:'Gyakorlat-választó'})})}
  ${sec(1,'Sorrend és előírás',1)}
  ${card(ls(d.ex.map(([n,k,ws,rep,rir,wu,w])=>edRow(n,k,ws,rep,rir,w)))+note('A terv heti szett-számai automatikusan követik, amit itt átírsz — a „Melyik izmod hol tart” oldal ugyanabból olvas. Ugyanez a szerkesztő nyílik a sablonok napjainál is.'),{i:1})}`)}
function het(){const rows=[...WMUS].sort((a,b)=>(b[5]-b[2])-(a[5]-a[2])),under=WMUS.filter(m=>m[2]<m[3]).length,top=WMUS.filter(m=>m[2]>=m[5]).length,growing=WMUS.length-under-top,ent=WMUS.map(m=>[m[1],clamp(m[2]/m[5],.25,.95)]);
  return page('edzes',{title:'Heti vizsgálat',sub:'Melyik izmod hol tart',back:'terv'},`
  ${hero({lbl:`Ezen a héten · ${WTOTAL} szett`,verdict:`${growing} izmod fejlődik, ${under} még kevés munkát kap.`,sub:`${top?top+' a felső értékén jár':'Egy sincs a felső értékén'}. A múlt héthez képest 14 szettel több.`,body:duo(ent,'md')})}
  ${sec(1,'Hétfőtől változik',1)}
  ${card(ls(rw({icon:'t-calendar',title:`${ROLL.join(', ')} kap még két-két szettet`,sub:'A többi marad.'})),{i:1})}
  ${sec(2,'Izmonként · ami még fér bele, elöl',2)}
  ${card(ls(rows.map(m=>{const [n,k,s,mev,mav,mrv]=m,room=mrv-s,tier=s<mev?'Építés':s>=mav?'Hangsúly':'Tartás';const say=s<mev?`Még nem éri el azt a szintet, ahonnan fejlődik — ${mev-s} szett hiányzik.`:room<=0?'Elérte a felső értéket ebben a tervben.':s>=mav?`Még ${room} szett fér bele.`:`Szinten tartod — még ${room} szett fér bele.`;
    return rw({m:k,title:`${n} ${st(tier,s<mev?'warn':s>=mav?'plan':'q')}`,sub:say+`<span class="vs-rowbar">${bar(clamp(s/mrv*100,4,100),muscleColor(k))}</span>`,v:`${s} / ${mrv}`,on:`izom.${k}`})}))
    +note('Százalékot nem írunk ki: a hely szettben van megmondva, és rajzban megmutatva.'),{i:2})}`)}
function izom(key){const m=WMUS.find(x=>x[1]===key)||WMUS[0],[n,k,s,mev,mav,mrv]=m,c=dk(k),pos=v=>clamp(v/mrv*100,0,100),days=DAYS.filter(d=>!d.rest&&!d.sport&&d.mus.some(([mk])=>mk===k)),a=[Math.round(s*.72),Math.round(s*.82),s,s,Math.round(s*1.15),Math.round(s*.5)];
  return page('edzes',{title:n,sub:'Heti vizsgálat · izom',back:'het'},`
  ${hero({lbl:`${s} szett / hét`,verdict:s<mev?'Ennyiből még nem fejlődik.':s>=mrv?'A felső értéken jár.':'Fejlődő tartományban van.',sub:`${s<mev?'Kevesebb, mint amennyitől elindul.':s>=mrv?'Ebben a tervben ennél többet nem kérek tőle.':''} Hétfőtől ${ROLL.includes(n)?'+2 szettet kap.':'marad ennyi.'}`,left:heat(TOKEN_SHAPES[k][0][0],[[k,.95]],'lg')})}
  ${sec(1,'Hol tart',1)}
  ${card(facts([[days.length,'edzés / hét'],[a[0],'az első héten'],[Math.max(...a),'a legtöbb a tervben']])
    +`<div class="vs-gauge" style="--c:${c}"><span class="fill" style="--w:${pos(s)}%"></span><span class="mk" style="--x:${pos(mev)}%"></span><span class="pin" style="--x:${clamp(pos(s),18,82)}%">${s} szett · most</span><span class="cap" style="left:0">ennyitől fejlődik: ${mev}</span><span class="cap" style="right:0">felső érték: ${mrv}</span></div>`,{i:1})}
  ${sec(2,'A terv íve erre az izomra',2)}
  ${card(arc(MESO.week,a),{i:2})}
  ${sec(3,'Hol dolgozik',3)}
  ${card(ls(days.map(d=>rw({m:k,title:`${d.full} · ${d.t}`,sub:d.ex.filter(e=>e[1]===k).map(e=>e[0]).join(' · '),v:`${d.mus.find(([mk])=>mk===k)[1]} <small>szett</small>`,on:`nap.${d.id}`}))),{i:3})}
  ${sec(4,'Honnan jön ez a szám',4)}
  ${card(ls([['Alap ajánlás',`RP guidelines · haladó: ${mev}–${mrv} szett hetente`],['A terv íve',`a ${MESO.week}. hét ${PHASE[MESO.curve[MESO.week-1]].toLowerCase()}-szakasza`],['A te visszajelzéseid',`a múlt heti szett-visszajelzések alapján ${ROLL.includes(n)?'emelhető':'marad'}`],['A napokra osztás',`${days.length} edzésnapra elosztva`]].map(([t,s2],i)=>rw({left:`<span class="vs-day">${i+1}</span>`,title:t,sub:s2}))),{i:4})}
  ${sec(5,'A mostani tervedhez képest',5)}
  ${card(`<div class="fh-mus"><span class="l">Előző terv</span><span class="v">${Math.round(s*.85)} szett</span>${bar(pos(Math.round(s*.85)),'var(--faint)')}</div><div class="fh-mus"><span class="l">Most</span><span class="v">${s} szett</span>${bar(pos(s),muscleColor(k))}</div>`
    +note('A kevesebb nem rosszabb: ha egy izom kevesebbet kap, máshová került a hangsúly. Ugyanezt a számot olvassa a terv oldala és a heti vizsgálat is.'),{i:5})}`)}
function konyvtar(){const now=RUNS.filter(r=>r.st==='fut'),next=RUNS.filter(r=>r.st==='következik');
  return page('edzes',{title:'Edzéstervek',sub:`1 fut · ${next.length} következik · ${TPL.length} sablon · ${CLOSED.length} lezárva`,back:'terv'},`
  ${hero({lbl:'Amiből indíthatsz',verdict:'Itt él minden terved.',sub:'Ami most fut, ami utána következik, a sablonjaid és amit már lezártál.',art:'t-stack',acts:btn('Új terv összeállítása','ujterv')})}
  ${sec(1,'Most fut',1)}
  ${card(ls(now.map(r=>rw({icon:'t-peak',title:r.n,sub:`${r.split} · ${r.from} – ${r.to} · ${WTOTAL} szett e héten`,v:`${r.wk} / ${r.weeks}. hét`,on:'run'}))),{i:1})}
  ${sec(2,`Következnek · ${next.length} terv`,2)}
  ${card(ls(next.map((r,i)=>rw({icon:'t-calendar',title:r.n,sub:`${r.split}${i===0?' · a futó terv után kezdődik':''} · ${r.weeks} hét · ${r.from}-tól · vége ${r.to}`,on:{toast:'A terv saját oldala — onnan indítható, dátummal'}})))
    +note('Egy következő terv nem innen indul: a saját oldalán van a dátumozott indítás, hogy a futó terved ne álljon le véletlenül.'),{i:2})}
  ${sec(3,'A polcod',3)}
  ${card(ls(rw({icon:'t-template',title:'Sablonjaid',sub:`${TPL.length} recept, amiből futam indul`,on:'sablonok'}),rw({icon:'t-history',title:'Lezárt futamaid',sub:`${CLOSED.length} befejezett terv`,on:'futamok'})),{i:3})}`)}
function futamok(){const weeks=CLOSED.reduce((s,r)=>s+r.weeks,0),cm=ST.cmp;
  return page('edzes',{title:'Lezárt futamaid',sub:`${CLOSED.length} futam · ${weeks} hét${cm?' · összevetés-mód':''}`,back:'konyvtar'},`
  ${hero({lbl:'Amit már végigcsináltál',verdict:`${CLOSED.length} lezárt terv, összesen ${weeks} hétnyi edzés.`,sub:cm?'Válassz ki kettőt — abban a sorrendben, ahogy összevetnéd őket.':'Mindegyiknek van egy befagyasztott riportja.',art:'t-scroll',
    acts:(cm&&ST.cmpSel.length===2?btn('Összevetés megnyitása','osszevetes'):'')+ve(cm?'Mégsem':'Összevetés','cmp',cm?'ghost':'')})}
  ${sec(1,'Futamok',1)}
  ${card(ls(CLOSED.map((r,i)=>{const at=ST.cmpSel.indexOf(i),sub=`${r.from} – ${r.to} · ${r.weeks} hét · ${r.pct}% teljesített edzés · ${r.rep?'riport kész':'riport nélkül'}`;
    return cm?rw({left:tk(at>=0,at>=0?`<b>${at+1}</b>`:' '),title:r.n,sub,ve:`cmpsel:${i}`,nochev:true})
      :rw({icon:'t-scroll',title:r.n,sub,on:'riport'})+`<div class="vs-in">${lk('Újrafuttatás',{toast:'Újrafuttatás — ebből a futamból új terv indul'})}${lk('Sablonná',{toast:'Sablonná mentve'})}</div>`}))
    +note('Ami itt nincs kiírva (edzésszám, rekordok), az a riportban él — egy listáért nem kérünk le annyi adatot.'),{i:1})}`)}
function riport(){const r=CLOSED[1];
  return page('edzes',{title:r.n,sub:`Lezárt futam · ${r.from} – ${r.to} · ${r.weeks} hét`,back:'futamok'},`
  ${hero({lbl:'Teljesített edzések',verdict:`A betervezett edzések ${r.pct}%-át megcsináltad.`,sub:'Ez a riport a lezáráskor készült pillanatkép — azóta nem változik.',left:ring(r.pct,{s:84}),body:`<div class="vs-ms">${mini(r.pct/100)}</div>`,
    acts:btn('Újrafuttatás',{toast:'Új futam indul ebből'})+lk('Újragenerálás',{toast:'Riport újragenerálása'})})}
  ${sec(1,'Ami erőben változott',1)}
  ${card(ls([['Guggolás','quad','+7,5 kg','+4,2%'],['Döntött törzsű evezés','back-mid','+5 kg','+3,1%'],['Fekvenyomás','chest-mid','0 kg','+2,4%'],['Román felhúzás','ham','+10 kg','+5,0%']].map(x=>rw({m:x[1],title:x[0],sub:`${x[2]==='0 kg'?'ugyanannyi súly, több ismétlés':'a legnehezebb szett súlya'} · ${x[2]}`,v:x[3]})))
    +note('A kilogramm a legnehezebb szett súlyának változása, a százalék a becsült maximumé — ezért lehet „ugyanannyi súly” mellett is pluszban.'),{i:1})}
  ${sec(2,'Az izmok útja',2)}
  ${card(WMUS.slice(0,6).map(m=>mus(m[1],m[0],`${m[2]} szett`,clamp(m[2]/20*100,6,100))).join(''),{i:2})}
  ${sec(3,'A mostani tervedhez képest',3)}
  ${card(WMUS.slice(0,4).map(m=>mus(m[1],m[0],`akkor ${m[2]-2} · most ${m[2]} · <b>+2</b>`,clamp((m[2]-2)/20*100,6,100))).join(''),{i:3})}
  ${sec(4,'Lezáráskor írtad',4)}
  ${card(txt('„Az utolsó két hét nehéz volt, de a guggolás végre nem fájt. A vállat kímélni kell a következőben.”')+note('Amit a lezáráskor nem mértünk, azt itt nem találjuk ki utólag — inkább nem írjuk ki.'),{i:4})}`)}
function osszevetes(){const a=CLOSED[1],b=CLOSED[0];
  return page('edzes',{title:'Összevetés',sub:'Két lezárt futam',back:'futamok'},`
  ${hero({lbl:'Egymás mellett',verdict:'Két befejezett terv, nem ítélet.',sub:`${a.n} és ${b.n}. A gyengébb oldal nincs megjelölve.`,art:'t-compare'})}
  ${sec(1,'Számok',1)}
  ${card(`<div class="vs-cmp"><span></span><b class="h">${a.n.split(' · ')[0]}</b><b class="h">${b.n.split(' · ')[0]}</b>
    ${[['Teljesített edzés',a.pct+'%',b.pct+'%'],['Hossz',a.weeks+' hét',b.weeks+' hét'],['Heti szett (csúcs)','84','76'],['Rekord','6 db','4 db'],['Erő · guggolás','+4,2%','+2,1%']].map(r=>`<span>${r[0]}</span><b>${r[1]}</b><b>${r[2]}</b>`).join('')}</div>`
    +note('Ahol nincs adat, „–” áll, sosem 0 — a hiányzó mérés nem nulla eredmény. Nincs külön összevetés-adat: a két befagyasztott riportot rakjuk egymás mellé.'),{i:1})}`)}
function sablonok(){const runs=TPL.reduce((s,t)=>s+t.runs,0);
  return page('edzes',{title:'Sablonjaid',sub:`${TPL.length} sablon · ${runs} futam indult belőlük`,back:'konyvtar'},`
  ${hero({lbl:'A receptjeid',verdict:'Egy sablon egy hét felépítése.',sub:'Ha tetszik, futamot indítasz belőle — a sablon közben érintetlen marad.',art:'t-template',acts:btn('Új sablon összeállítása','ujterv')})}
  ${sec(1,'Sablonok',1)}
  ${card(ls(TPL.map(t=>rw({left:stk(t.mus),title:t.n,sub:`${t.split} · ${t.weeks} hét · ${t.days} nap / hét · ~${t.min} perc · ${t.runs?`<b>${t.runs}</b> futam`:'még nem futott'}`,on:'sablon'})))
    +note('A listán nincs törlés: a sablon saját oldalán van, ahol látod is, mit törölnél.'),{i:1})}`)}
function sablon(){const t=TPL[0];
  return page('edzes',{title:t.n,sub:`Sablon · ${t.split}`,back:'sablonok'},`
  ${hero({lbl:'Sablon',verdict:`${t.weeks} hét × ${t.days} edzésnap.`,sub:'Ez a hét felépítése — a futam ebből készül.',body:`<div class="fh-chips">${t.mus.map(k=>`<span>${mchp(k,'sm')}${muscleLabel(k)}</span>`).join('')}</div>`,acts:btn('Futam indítása ebből',{sheet:'start'})})}
  ${sec(1,`A hét felépítése · ${t.days} edzésnap`,1)}
  ${card(DAYS.map(d=>d.rest||d.sport?`<div class="vs-tday muted"><div class="dh"><b>${d.full}</b><span>${d.sport?'röplabda · meccs':'pihenőnap'}</span></div></div>`
    :`<div class="vs-tday"><div class="dh"><b>${d.full} · ${d.t}</b><span>${d.sets} szett · ~${d.min} perc</span></div>${d.ex.map(e=>`<div class="ex">${mchp(e[1],'sm')}<span class="g">${e[0]}</span><span class="v">${e[2]}×${e[3]} · ${kgTxt(e[6])}</span></div>`).join('')}</div>`).join(''),{i:1})}
  ${sec(2,'Heti szettek izmonként',2)}
  ${card(WMUS.slice(0,6).map(m=>mus(m[1],m[0],`${m[2]} szett`,clamp(m[2]/13*100,6,100))).join(''),{i:2})}
  ${sec(3,'Futamok ebből a sablonból',3)}
  ${card(ls(rw({icon:'t-peak',title:'Hypertrophy 04 · Tavasz',sub:'most fut · 3 / 6. hét',on:'run'}),rw({icon:'t-scroll',title:'Hypertrophy 03 · Ősz',sub:'lezárva · Nov 13',on:'riport'})),{i:3})}
  ${sec(4,'A sablon kezelése',4)}
  ${card(ls(rw({icon:'t-pencil',title:'Szerkesztés',on:'sablonszerk'}),rw({icon:'t-repeat',title:'Másolat',on:{toast:'Másolat készült — a másolat szerkesztője nyílik'}}),rw({icon:'t-trash',title:'<span style="color:var(--bad)">Sablon törlése</span>',on:{sheet:'tdel'}}))
    +note('A törlés a korábbi futamokat és a riportjaikat nem bántja — azok megmaradnak.'),{i:4})}`)}
function sablonszerk(){const d=DAYS[0];
  return page('edzes',{title:'Hétfő · Push',sub:'Sablon szerkesztése · Hypertrophy 04 · Tavasz',back:'sablon'},`
  ${hero({lbl:'Sablon szerkesztése',verdict:'Ugyanaz a szerkesztő, mint a futó terv napjainál.',sub:'Minden változás azonnal mentődik.',
    body:`<div class="fh-pills" style="margin-top:12px">${DAYS.map((x,i)=>`<button class="fh-pill ${i===0?'on':''}" data-toast="${x.full} · ${x.t}">${x.d}</button>`).join('')}</div>`,acts:btn('+ Gyakorlat hozzáadása',{toast:'Gyakorlat-választó'})})}
  ${sec(1,'Sorrend és előírás',1)}
  ${card(ls(d.ex.map(e=>edRow(e[0],e[1],e[2],e[3],e[4],e[6])))+note('Egy feladatra egy felület: a sablon napja és a futó terv napja ugyanígy néz ki.'),{i:1})}`)}
function ujterv(stepArg){
  if(stepArg==='gen')return page('edzes',{title:'Új terv',sub:'Összeállítás',back:'konyvtar'},`
    ${hero({lbl:'Összeállítás',verdict:'Rakom össze a heted.',sub:'Kiszámolom, melyik nap mit edzel, és hétről hétre mennyit.',art:'t-flask',acts:btn('Kész — mutasd a vázlatot','ujterv.kesz')})}
    ${card(ls(rw({icon:'t-flask',title:'Dolgozom rajta…',sub:'kb. 10 másodperc · nem kell itt maradnod'})),{i:1})}`);
  if(stepArg==='kesz')return page('edzes',{title:'A vázlatod',sub:'Új terv · még nincs mentve',back:'konyvtar'},`
    ${hero({lbl:'Még nincs mentve',verdict:'Nézd át, írd át.',sub:'Ami nem stimmel, azt írd át — csak utána mentsük el. A vázlat a memóriában él, amíg el nem mented.',art:'t-flask',acts:btn('Mentés',{toast:'Elmentve — a terv a Következnek listába került'})+lk('Újra kérdezz','ujterv')})}
    ${sec(1,'A hét',1)}
    ${card(ls(DAYS.map(dayRow)),{i:1})}`);
  const q=(n,t,h,opts,on,i)=>sec(n,t,i)+card(`<p class="fh-txt" style="margin-bottom:10px">${h}</p>`+(Array.isArray(on)?`<div class="fh-pills">${opts.map((o,j)=>`<button class="fh-pill ${on.includes(j)?'on':''}" data-ve="multi">${o}</button>`).join('')}</div>`:chips(opts,on)),{i});
  return page('edzes',{title:'Új terv',sub:'Pár kérdés, és összerakom',back:'konyvtar'},`
  ${hero({lbl:'Új terv',verdict:'Pár kérdés, és összerakom.',sub:'Csak azt kérdezem meg, amit nem tudok kitalálni helyetted.',art:'t-flask'})}
  ${q(1,'Mennyi időre','Hány hét legyen?',['4 hét','5 hét','6 hét','7 hét','8 hét'],2,1)}
  ${q(2,'Mikor érsz rá','Mely napokon edzel?',['H','K','Sze','Cs','P','Szo','V'],[0,1,2,3,4],2)}
  ${q(3,'Mi a cél','Mire menjen ki a terv?',['Izomépítés','Erő','Fogyás mellett tartás'],0,3)}
  ${q(4,'Mit kíméljünk','Van, ami most fáj?',['Semmi','Váll','Térd','Hát'],1,4)}
  ${card(`<p class="fh-note" style="margin:0">Az edzőtermi időpontjaidhoz nem nyúlok — azokat te állítod be.</p>`,{i:5})}`,
  {foot:`<button class="btn" style="flex:1" data-go="ujterv.gen">Rakd össze</button>`})}

/* ── SAJÁT EDZÉS ── */
const sjKg=v=>v==null?'auto kg':`${kg(v)} kg`;
const sjSum=e=>`${e.w} szett · ${e.lo}–${e.hi} ism. · RIR ${e.rir} · ${sjKg(e.kg)}`;
function sjStep(i,f,lbl,v,min,max){const auto=f==='kg'&&v==null;
  return `<div class="vs-sjl"><span>${lbl}</span><span class="vs-stp"><button data-ve="sjst:${i}|${f}|-1" ${f==='kg'?(auto?'disabled':''):(v<=min?'disabled':'')}>−</button><b class="${auto?'auto':''}">${auto?'auto':kg(v)}</b><button data-ve="sjst:${i}|${f}|1" ${f!=='kg'&&v>=max?'disabled':''}>+</button></span></div>`}
function sjRow(e,i){const o=ST.sj.open===i;
  return rw({left:`<span class="vs-grip">⠿</span>`,m:e.k,title:e.n,sub:`${muscleLabel(e.k)} · ${sjSum(e)}${e.warn?`<span class="vs-warn">${e.warn}</span>`:''}`,ve:`sjopen:${i}`,cls:o?'open':''})
  +(o?`<div class="vs-sjp">${lab('Szettek')}${sjStep(i,'bem','Bemelegítő',e.bem,0,10)}${sjStep(i,'w','Munka',e.w,1,10)}${lab('Ismétlés')}${sjStep(i,'lo','Tól',e.lo,1,e.hi)}${sjStep(i,'hi','Ig',e.hi,e.lo,100)}${lab('Nehézség és súly')}${sjStep(i,'rir','Tartalék (RIR)',e.rir,0,5)}${sjStep(i,'kg','Kiinduló kg',e.kg)}
    <div class="vs-sjl"><span>Számít a heti volumenbe</span><button class="vs-sw ${e.vol?'on':''}" data-ve="sjvol:${i}" role="switch" aria-checked="${e.vol}" aria-label="Számít a heti volumenbe"></button></div>
    ${acts(vl('Feljebb',`sjmv:${i}|-1`,'',i===0?'disabled':''),vl('Lejjebb',`sjmv:${i}|1`,'',i===ST.sj.ex.length-1?'disabled':''),vl('Kivesz',`sjdel:${i}`,'bad'))}</div>`:'')}
function sajat(id){
  const demo=note(`Állapotok a demóhoz: <button class="fh-lk" data-go="sajat.uj">új, üres</button> · <button class="fh-lk" data-go="sajat">szerkesztés</button> · <button class="fh-lk" data-go="sajat.betolt">betöltés</button> · <button class="fh-lk" data-go="sajat.nincs">nem található</button>`);
  if(id==='betolt')return page('edzes',{title:'Saját edzés',sub:'Betöltés',back:'mai'},card(empty('t-clock','Betöltés…')+demo));
  if(id==='nincs')return page('edzes',{title:'Saját edzés',sub:'Nem található',back:'mai'},card(empty('t-other','Ez a saját edzés nem található — lehet, hogy törölted.',btn('Új összeállítása','sajat.uj','sm'))+demo));
  const mode=id==='uj'?'new':'edit';if(mode!==ST.sjmode){ST.sjmode=mode;ST.sj=mode==='new'?{name:'',open:-1,ex:[]}:SJ0()}
  const sets=ST.sj.ex.reduce((a,e)=>a+e.w,0),ok=ST.sj.name.trim()&&ST.sj.ex.length,dis=ok?'':'disabled style="opacity:.45"';
  return page('edzes',{title:mode==='new'?'Új saját edzés':'Saját edzés',sub:'Összerakod, amit ma csinálni akarsz',back:'mai'},`
  ${hero({lbl:'Saját edzés',verdict:'Rakd össze, amit ma csinálni akarsz.',sub:'Elmentheted későbbre, vagy egyből elindíthatod.',
    body:`${lab('Edzés neve')}<input class="fh-in" id="sj-name" value="${ST.sj.name.replace(/"/g,'&quot;')}" placeholder="pl. Pihenőnapi felső" maxlength="120">`,
    acts:ve('Indítás ma','sjgo','',dis)+ve('Mentés','sjsave','ghost',dis)+(ok?'':`<p class="fh-note" id="sj-hint" style="margin:0;flex-basis:100%">${ST.sj.name.trim()?'Adj hozzá legalább egy gyakorlatot.':'Adj nevet az edzésnek.'}</p>`)})}
  ${sec(1,`Gyakorlatok · ${ST.sj.ex.length} gyakorlat · ${sets} szett`,1)}
  ${card((ST.sj.ex.length?ls(ST.sj.ex.map(sjRow)):empty('t-dumbbell','Még nincs gyakorlat. Add hozzá az elsőt — kap egy jó alapbeállítást, amit utána finomíthatsz.'))
    +acts(lk('+ Gyakorlat hozzáadása',{sheet:'sjpick'}))+demo,{i:1})}`)}
function sjStepApply(i,f,d){const e=ST.sj.ex[i];if(f==='kg'){if(e.kg==null){if(d>0)e.kg=20}else{const n=Math.round((e.kg+d*2.5)*100)/100;e.kg=n<2.5?null:Math.min(999,n)}}else{const lim={bem:[0,10],w:[1,10],lo:[1,e.hi],hi:[e.lo,100],rir:[0,5]}[f];e[f]=Math.min(lim[1],Math.max(lim[0],e[f]+d))}}

/* ── TERHELÉS ── */
function terheles(){const pct=Math.round(LD_DONE/LD_PLAN*100);
  return page('edzes',{title:'Terhelés',sub:'Eddig a héten · 3. hét / 6',tab:'terheles'},`
  ${hero({lbl:`${LD_DONE} szett a betervezett ${LD_PLAN}-ból`,verdict:'Három hete emelkedik a heti szettszám.',sub:'52 → 61 → 75. Két edzésnapod van még hátra.',left:ring(pct,{s:84,label:'megvan'}),
    body:`<div class="vs-arc lo">${WEEK_SETS.map((s,i)=>`<i class="${i+1<MESO.week?'past':i+1===MESO.week?'now':''} ${MESO.curve[i]==='Deload'?'deload':''}" style="--h:${s/84*100}%"></i>`).join('')}</div><div class="vs-arcl">${WEEK_SETS.map((s,i)=>`<span>${i+1===MESO.week?`<b>${LD_DONE}/${s}</b>`:s}</span>`).join('')}</div>
      ${note('Egy oszlop egy hét. A színes a mostani, a csíkos a pihenőhét.')}${facts([['3','edzés kész'],['2','van hátra'],['1','medál e héten']])}`,
    acts:btn('Izomtérkép','terkep')+lk('Időpontok',{sheet:'ido'})})}
  ${sec(1,'Izomcsoportonként',1)}
  ${card(ls(LD_GROUPS.map((g,i)=>{const [n,k,done,plan,words]=g;return rw({m:k,title:n,sub:words,v:`${done} / ${plan}`,right:bar(plan?clamp(done/plan*100,2,100):0,muscleColor(k)),on:done?{sheet:'tgrp',arg:String(i)}:{toast:`${n} — ezen a héten nem volt ilyen munka`},nochev:true})}))
    +note('Koppints egy sorra a részletekért.'),{i:1})}
  ${sec(2,'Ami a szetteken kívül volt',2)}
  ${card(ls(rw({icon:'t-volley',title:'Röplabda · 2 alkalom',sub:'180 perc · szombat és kedd este',v:'1 240 <small>kcal</small>'}),rw({icon:'t-steps',title:'Minden mozgásod',sub:'a terem és a sport egymás mellett — de sosem egy számba olvasztva',on:'mozgas'}))
    +note('A számok a már megcsinált edzésekből jönnek. A ma esti, még le nem naplózott edzés nem számít bele.'),{i:2})}
  ${sec(3,'Más nézetek',3)}
  ${card(ls(rw({icon:'t-muscle',title:'Izomtérkép',sub:'hol landolt a heti munka a testeden — elölről és hátulról',on:'terkep'}),rw({icon:'t-dumbbell',title:'Gym · heti munka',sub:'a heti terv szettjei izomcsoportonként, sporttal együtt',on:'gym'})),{i:3})}`)}
function terkep(mode){const planned=mode==='terv',ent=LD_GROUPS.filter(g=>g[2]||planned).map(g=>[g[1],planned?clamp(g[3]/29,.3,.95):clamp(g[2]/Math.max(g[3],1),.3,.95)]),cold=LD_GROUPS.filter(g=>!g[2]);
  let n=0;
  return page('edzes',{title:'Izomtérkép',sub:planned?'A heti terv':'Eddig megvolt',back:'terheles'},`
  ${hero({lbl:planned?'A heti terv':'Eddig megvolt',verdict:planned?'Ezt kéri tőled a heti terv.':'Itt landolt eddig a heti munka.',sub:'Halvány = elkezdted · teli = megvan. A szín az izomcsoporté, nem ítélet.',
    body:`<div style="margin-top:14px">${seg([['Eddig megvolt','terkep',!planned],['A heti terv','terkep.terv',planned]])}</div>${duo(ent,'xl')}`})}
  ${cold.length?sec(++n,'Amihez nem nyúltál',1)+card(ls(cold.map(g=>rw({cls:'muted',m:g[1],title:g[0],sub:'ezen a héten nem volt ilyen munka'}))),{i:1}):''}
  ${sec(++n,'Mélyebben',2)}
  ${card(ls(rw({icon:'t-pattern',title:'Minden izomjel',sub:'a teljes izomlista, ahogy a rendszer ismeri',on:'jelek'}))+note('A röplabda is dolgoztat izmokat, de azt nem szettben mérjük — a térkép csak a termi munkát színezi.'),{i:2})}`)}
function jelek(){const live=new Set(['chest-mid','chest-upper','back-wide','back-mid','shoulder-side','shoulder-front','shoulder-rear','triceps-medial','biceps-brachialis','quad','ham','calf']);
  return page('edzes',{title:'Minden izomjel',sub:`${MUSCLES.length} izom, 6 régió`,back:'terkep'},`
  ${hero({lbl:'A teljes lista',verdict:`${live.size} izmot dolgoztál meg ezen a héten a ${MUSCLES.length}-ből.`,sub:'Ami színes, azt tényleg megdolgoztad. Amiről a heti napló nem tud, halvány marad — sosem találjuk ki, hogy biztosan dolgozott.',art:'t-muscle'})}
  ${REGIONS.map((r,ri)=>sec(ri+1,r.label,ri+1)+card(`<div class="vs-mm">${MUSCLES.filter(m=>m.region===r.key).map(m=>`<div class="${live.has(m.key)?'':'dim'}">${mchp(m.key)}<span>${m.label}</span></div>`).join('')}</div>`,{i:ri+1})).join('')}`)}
function mozgas(){
  return page('edzes',{title:'Minden mozgásod',sub:'Eddig a héten',back:'terheles'},`
  ${hero({lbl:'Eddig a héten',verdict:'A terem és a sport külön oszlopban.',sub:'Mert az egyik becslés, a másik mért.',art:'t-steps'})}
  ${sec(1,'Terem és sport',1)}
  ${card(grid([stat({k:'Terem',icon:'t-dumbbell',n:'186',unit:'perc',s:'3 edzés · ~1 480 kcal · becslés'}),stat({k:'Sport',icon:'t-volley',n:'180',unit:'perc',s:'2 alkalom · 1 240 kcal · naplózott',c:'var(--ok)'})]),{i:1})}
  ${sec(2,'Tételesen',2)}
  ${card(ls([['t-dumbbell','Hétfő · Push','16 szett · becsült 62 perc','~510'],['t-volley','Kedd este · Röplabda','edzés · 90 perc','610'],['t-dumbbell','Kedd · Legs A','12 szett · becsült 48 perc','~420'],['t-dumbbell','Szerda · Legs','19 szett · becsült 76 perc','~550'],['t-volley','Szombat · Röplabda','meccs · 90 perc','630']].map(r=>rw({icon:r[0],title:r[1],sub:r[2],v:`${r[3]} <small>kcal</small>`})))
    +note('Ha egyetlen sport-alkalomnál hiányzik a kalória, az egész összeget elrejtjük — inkább semmit, mint kevesebbet.'),{i:2})}`)}

/* ── LAPOK (alulról) ── */
const TECH={default:[['Beállás','Rögzített lapocka, semleges gerinc, a fogás vállszélességnél kicsit szélesebb.'],['Végrehajtás','Könyök hátra és le, a súlyt lassan engedd (2–3 mp). Fent egy pillanat szünet.'],['Gyakori hibák','Lendületből húzni · a vállat a fülhöz emelni · félúton megállni a negatívban.']]};
const SHEETS={
  why:whySheet,udv:udvSheet,
  menu:(g)=>{const gi=+(g||0),e=EX[gi]||EX[0],d=e.sets.filter(isDone).length;
    return `${shm(e.k,'Gyakorlat',e.n,`${e.sets.length} szett · ${muscleLabel(e.k)}`)}
    ${ls([['t-camera','Videó','a mozdulat bemutatója',{toast:'Demó videó'}],['t-note','Jegyzet','forma-emlékeztető, beállítás…',{sheet:'note'}],['t-weight','Szett hozzáadása',`most ${e.sets.length} szett van`,{sheet:'extra'}],['t-weight','Szett elvétele','',{toast:'Szett elvéve'}],['t-up','Előrébb','',{toast:'Előrébb'}],['t-down','Hátrébb','',{toast:'Hátrébb'}],['t-swap','Gyakorlat cseréje',d?`a ${d} kész szett itt marad, a többi az újé`:'hasonlóra vagy bármi másra',null,`pick:swap:${gi}`],['t-quest','Küldetések','vállalt és elengedett',{sheet:'qb',arg:'0'}],['t-skip','<span style="color:var(--bad)">Gyakorlat kihagyása</span>','',{toast:'Gyakorlat kihagyva'}]].map(([ic,l,h,on,v])=>rw({icon:ic,title:l,sub:h,on,ve:v})))}`},
  recs:(g)=>{const e=EX[+(g||0)]||EX[0];return `${shm(e.k,`${muscleLabel(e.k)} · 24 alkalom`,e.n)}
    ${lab('A múltkori alkalom')}${facts((e.last||'— × — · RIR —').split(/ × | · RIR /).map((v,i)=>[v||'—',['kg','ism','RIR'][i]]))}
    ${lab('Megdönthető rekordok')}
    ${ls(rw({title:'Becsült 1RM',sub:'márc 4. óta áll · becslés, nem mérés',v:'96,7 kg',right:bar(86)}),rw({title:'Legjobb szett',sub:'ma megdöntve',v:e.goal,right:bar(100,'var(--ok)')}),rw({title:'Legtöbb volumen',sub:'egy alkalmon',v:'2 175 kg',right:bar(66)}))}
    ${lab('Rep-rekordok')}${ls([['70 kg','12','aug 12.'],['72,5 kg','10','ma'],['75 kg','8','aug 28.']].map(([k,r,d])=>rw({title:k,sub:d,v:`${r} <small>ism.</small>`})))}`},
  fin:()=>`${sh('Edzés befejezése',`Van még ${TOT()-DONE()} bepipálatlan szetted.`)}
    ${ls(EX.filter(e=>e.sets.some(x=>!isDone(x))).map(e=>rw({m:e.k,title:e.n,v:`${e.sets.filter(x=>!isDone(x)).length} <small>szett</small>`})))}
    ${acts(ve(`Befejezem így · ${DONE()} elvégzett · ${TOT()-DONE()} kihagyott`,'finish','','style="flex:1"'))}${acts(`<button class="fh-lk" data-close>Mégse, visszamegyek</button>`)}`,
  pick:()=>{const Pk=ST.pick,sw=Pk.mode==='swap',o=EX[Pk.g];return `${shm(sw?o.k:'t-addex',sw?`Csere · ${o.n}`:'Gyakorlat hozzáadása',sw?'Mire cseréled?':'Mit adunk hozzá?',sw?muscleLabel(o.k):'Pull Day · a lista végére kerül')}
    <input id="pk-q" class="fh-in" type="search" placeholder="Keresés név szerint…" value="${Pk.q}" autocomplete="off"><div id="pk-body">${pickBody()}</div>`},
  scope:()=>{const Pk=ST.pick,sw=Pk.mode==='swap',o=EX[Pk.g],Lb=LIB[Pk.lib],d=sw?o.sets.filter(isDone).length:0,rem=sw?o.sets.length-d:(Lb[2]==='compound'?4:3),noPlan=sw&&o.origin==='ma';
    const sub=sw?(d?`A ${d} kész szett a ${o.n}-nál marad, a hátralévő ${rem} szett az újé.`:`Ugyanott, ugyanúgy ${rem} szett.`):`${rem} szett · ${Lb[2]==='compound'?'8–10':'10–12'} ismétlés — a gyakorlat típusához szabva, utána átírhatod.`;
    return `${sh(sw?'Gyakorlat cseréje':'Gyakorlat hozzáadása',sw?`${o.n} → ${Lb[0]}`:Lb[0],sub)}
    ${ls(rw({m:Lb[1],title:Lb[0],sub:`${muscleLabel(Lb[1])} · ${Lb[3]?`múltkor ${Lb[3]} — innen jön a javaslat`:'még nem csináltad — a súlyt te adod meg'}`}))}
    ${lab('Meddig érvényes?')}${ls(rw({icon:'t-calendar',title:'Csak ma',sub:'a mai edzésre. Jövő héten a régi terv jön.',ve:'scope:ma'}),noPlan?'':rw({icon:'t-peak',title:'Mezociklusra is',sub:`a ${MESO.name} hátralévő ${MESO.of-MESO.week} hetében is. A mentett sablonod nem változik.`,ve:'scope:meso'}))}
    ${noPlan?note('Ez a gyakorlat ma került be, nincs a mezociklus tervében, ezért csak mára cserélhető.'):''}`},
  set:(a)=>{const [i,j]=(a||'0.0').split('.').map(Number),e=EX[i]||EX[0],s=e.sets[j]||e.sets[0];return `${sh(`Szett ${j+1} · ${e.n}`,'Szett szerkesztése')}
    ${ls(stp('Súly · kg',kg(isDone(s)?s[0]:s[1])),stp('Ismétlés',isDone(s)?s[1]:s[2]))}${blk('RIR',chips(['0','1','2','3','4','5'],isDone(s)?s[2]:s[3]))}
    ${lab('Megjegyzés ehhez a szetthez (opcionális)')}${fld('pl. utolsó ismétlés kemény',1)}${two('Mentés')}${acts(vl('Szett törlése','save','bad'))}`},
  rp:(g)=>{const e=EX[+(g||0)]||EX[0];return `${shm(e.k,'Szett kész · hogy ment?',e.n,'a pihenő ezután indul · 90 mp')}
    ${[['Pumpa · érzed?',['Semmi','Enyhe','Jó','Brutális'],2],['Ízületi fájdalom',['Nincs','Enyhe','Erős'],0],['Akarunk még?',['Kevés volt','Pont jó','Sok volt'],1]].map(([q,o,s])=>blk(q,chips(o,s))).join('')}
    ${acts(ve('Mentés · pihenő indul','rest','','style="flex:1"'),vl('Hagyjuk, csak a pihenő','rest'))}`},
  extra:()=>`${sh('Extra szett hozzáadva','A tervbe is felvegyük?','Most 5 szett.')}${acts(ve('Csak ma','save','','style="flex:1"'),vl('Minden hétre','save'))}`,
  note:()=>`${sh('Gyakorlat-jegyzet','Jegyzet a gyakorlathoz')}${fld('A pad a harmadik fokon, a könyök végig zárva maradjon.').replace('vs-fld','vs-fld tall')}${two('Mentés')}`,
  wnote:()=>`${sh('Edzés-jegyzet','Hogy ment?','Nem kötelező — később is hozzáírhatod.')}${fld('Ma a váll végig nyugton volt, a sorok tiszták…').replace('vs-fld','vs-fld tall')}${two('Mentés')}`,
  tech:(g)=>{const e=EX[+(g||0)]||EX[0];return `${sh(`Technika · ${e.n}`)}${TECH.default.map(([h,t],i)=>`<div class="vs-tech"><b>${i+1}</b><div><h2>${h}</h2><p class="fh-txt">${t}</p></div></div>`).join('')}
    ${lab('Tovább')}${ls(rw({icon:'t-camera',title:'Demó videó',on:{toast:'Demó videó'}}),rw({icon:'t-chat',title:'Kérdezd a csapatot',sub:'miért pont ez a fogás?',on:{toast:'Mezo · Chat'}}))}`},
  qb:(g)=>{const i=+(g||0),c=CHAL[i];return `${shm(QICON[c.type],`Küldetés · ${c.acc?'vállalva':'elengedve'}`,c.type,c.ex)}
    <p class="fh-big" style="font-size:30px;margin-top:6px">${c.target}</p>${lab(`Biztosság · ${c.conf} · alacsony kockázat`)}<p class="fh-txt vs-sub">${c.why}</p>
    ${acts(ve(c.acc?'Elengedem':'Visszaveszem',`qtoggle:${i}`,'','style="flex:1"'))}${note(c.acc?'Büntetés nélkül — elengedve nem számít a zárásnál. Bármikor visszaveheted.':'Most nem számít bele a zárásba. Ha mégis nekifutsz, vedd vissza.')}`},
  info:()=>`${sh('Terhelés','Miből áll össze a szám?')}${txt('A heti terv minden izomcsoportra kiír valahány szettet. A szám azt mutatja, ezekből mennyi ment már le a héten. A sport és a futás külön látszik — becslés, a szettekbe nem számít bele.')}`,
  grp:(g)=>{const [k,l,d,p,w]=GR[+(g||0)];return `${shm(k,'Izomcsoport · ezen a héten',l,`${d} / ${p} szett`)}
    ${ls(rw({title:`${l} (fej 1)`,sub:'6 szett · 8–10 ismétlés · 2×/hét — a heti tervből'}),rw({title:`${l} (fej 2)`,sub:'4 szett · 10–12 ismétlés · 2×/hét — a heti tervből'}),rw({icon:'t-volley',title:'Röpi · erős · Futás · enyhe',sub:'becslés — a szettekbe nem számít bele'}))}${note(`${w} · +~40 XP`)}`},
  tgrp:(gi)=>{const [n,k,done,plan,words]=LD_GROUPS[+(gi||0)];return `${shm(k,'Izomcsoport',n,`${done} szett a ${plan}-ból, eddig a héten`)}
    ${ls([['Hétfő · Push',6,'het'],['Szerda · Legs',5,'sze'],['Csütörtök · Pull',3,'csu']].map(p=>rw({icon:'t-dumbbell',title:p[0],v:`${p[1]} <small>szett</small>`,on:`nap.${p[2]}`})))}<p class="fh-txt" style="margin-top:12px">${words}</p>${note(`A heti terved ${plan} szettet kér ebből az izomcsoportból. Tapasztalat: +${done*4} XP.`)}`},
  tdel:()=>`${sh('Törlés','Törlöd a sablont?','Hypertrophy 04 · Tavasz. A korábbi futamok és a riportjaik megmaradnak — csak a recept tűnik el a listádból.')}${acts(ve('Törlés','toastclose:Törölve','bad','style="flex:1"'),`<button class="fh-lk" data-close>Mégsem</button>`)}`,
  close:()=>`${sh('Lezárás','Edzésterv lezárása','Lezárás után riportot kapsz róla: mennyit csináltál meg belőle, mi változott erőben, és hogyan mozdultak az izmaid.')}
    ${lab('Hogy érezted magad benne?')}${chips(['Nagyon jól','Jól','Vegyesen','Nehezen'],1)}
    ${lab('Jegyzet (nem kötelező)')}${fld('Mit vinnél tovább a következőbe?',1)}${acts(`<button class="btn" style="flex:1" data-go="riport">Lezárás</button>`,`<button class="fh-lk" data-close>Mégsem</button>`)}`,
  start:()=>`${sh('Futam indítása','Hypertrophy 04 · Tavasz','6 hét · 5 edzésnap hetente. A futó terved ettől nem áll le — ez a sorba kerül mögé.')}
    ${lab('Mikor kezdődjön?')}${chips(['Jún 16','Jún 23','Más dátum'],0)}${acts(ve('Indítás','toastclose:Elindítva — a Következnek listába került','','style="flex:1"'),`<button class="fh-lk" data-close>Mégsem</button>`)}`,
  ido:()=>`${sh('Edzőtermi időpontok','Mikor érsz rá?','Az állandó időpontjaidat te állítod be — ezekhez a terv nem nyúl.')}${ls([['Hétfő','18:00'],['Kedd','18:00'],['Szerda','17:30'],['Csütörtök','18:00'],['Péntek','17:00']].map(r=>rw({title:r[0],v:r[1]})))}${acts(`<button class="btn" style="flex:1" data-close>Rendben</button>`)}`,
  sportlog:()=>`${sh('Sport log · röpi','Hogy ment?','Az idő, a terhelés és a saját élményed.')}${ls(stp('Idő · perc',90),stp('Szettek · összesen',5))}
    ${blk('RPE · összesített nehézség',scale(7))}${blk('Váll-terhelés',scale(6))}
    ${lab('Jegyzet')}${fld('Jól ment a nyitás, a harmadik szettben kicsit húzott a váll.')}${two('Mentés')}`,
  runlog:()=>`${sh('Futás log · sprint-intervallum','Hogy ment?')}${ls(stp('Teljesített körök',6))}${blk('RPE · érzékelt nehézség',scale(9))}<div class="vl" style="margin-top:14px">${stp('Pulzus-megnyugvás · mp',42)}</div>
    ${lab('Jegyzet')}${fld('Az utolsó két kör nehéz volt, de tartottam az iramot.')}${two('Mentés')}`,
  blkmenu:()=>`${sh('Futóterv','Robbanékonyság 01')}${ls(rw({icon:'t-repeat',title:'Duplikálás',ve:'toastclose:Duplikálva'}),rw({icon:'t-trash',title:'<span style="color:var(--bad)">Törlés</span>',ve:'toastclose:Törölve'}))}`,
  custom:()=>`${sh('Saját edzés','Mit nyomunk ma?')}${ls(rw({icon:'t-dumbbell',title:'Pihenőnapi felső',sub:'3 gyakorlat · 10 szett · koppintásra indul',right:`<button class="fh-lk" data-go="sajat">szerkesztés</button>`,on:'session.uj'}))}${acts(btn('Új összeállítása','sajat.uj','sm'))}`,
  sjpick:()=>`${sh('Gyakorlat hozzáadása','Mit teszünk bele?','Koppints egyre — alapbeállítással kerül be, és rögtön kinyílik.')}
    ${ls(LIB.map((Lb,i)=>[Lb,i]).filter(([Lb])=>!ST.sj.ex.some(e=>e.n===Lb[0])).slice(0,8).map(([[n,k,t,last],i])=>rw({m:k,title:n,sub:`${muscleLabel(k)} · ${t==='compound'?'összetett':'izolált'}${last?` · múltkor ${last}`:' · még nem csináltad'}`,right:`<span class="vs-q">${I('t-addex')}</span>`,ve:`sjadd:${i}`,nochev:true})))}`
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
${P} .vs-heat{width:64px;flex:0 0 auto;display:inline-block}${P} .vs-heat svg{width:100%;height:auto;display:block;overflow:visible}${P} .vs-heat.lg{width:84px}
${P} .vs-duo{display:flex;gap:14px;justify-content:center;margin-top:14px}${P} .vs-duo .vs-heat{width:88px}${P} .vs-duo.xl .vs-heat{width:118px}
${P} .vs-arc{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;align-items:end;height:64px;margin-top:14px}${P} .vs-arc.lo{height:52px}
${P} .vs-arc i{display:block;height:var(--h);border-radius:6px;background:rgba(15,30,51,.10)}${P} .vs-arc i.past{background:rgba(15,30,51,.30)}${P} .vs-arc i.deload{background:repeating-linear-gradient(135deg,rgba(15,30,51,.24) 0 2px,transparent 2px 6px)}${P} .vs-arc i.now{background:var(--dom);box-shadow:0 8px 14px -8px var(--dom)}
${P} .vs-arcl{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;text-align:center;font-size:11.5px;color:var(--sub);margin-top:6px;font-variant-numeric:tabular-nums}${P} .vs-arcl b{color:var(--ink);font-weight:700}
${P} .vs-ft{display:flex;justify-content:space-between;font-size:11.5px;color:var(--faint);margin-top:4px}
${P} .vs-fld{color:var(--ink);line-height:1.45;display:flex;gap:8px;justify-content:space-between;align-items:center}${P} .vs-fld.ph{color:var(--faint)}${P} .vs-fld.tall{min-height:84px;align-items:flex-start}${P} .vs-fld svg.ic{width:22px;height:22px}
${P} .vs-stp{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}${P} .vs-stp button{width:34px;height:34px;border-radius:11px;background:var(--page);display:grid;place-items:center;font-size:18px;font-weight:600}${P} .vs-stp button:disabled{opacity:.35}
${P} .vs-stp b{min-width:40px;text-align:center;font-family:var(--disp);font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}${P} .vs-stp b.auto{font-family:var(--ff);font-size:12px;color:var(--faint)}
${P} .vs-scale{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}${P} .vs-scale button{height:36px;border-radius:9px;background:var(--page);font-size:12.5px;font-weight:650;color:var(--sub);display:grid;place-items:center}${P} .vs-scale button.f{background:color-mix(in srgb,var(--dom) 16%,#fff);color:var(--ink)}${P} .vs-scale button.a{background:var(--dom);color:#fff}
${P} .vs-opts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}${P} .vs-opts button{display:flex;align-items:center;gap:8px;padding:10px;border-radius:14px;background:var(--page);font-size:13px;font-weight:600;line-height:1.2;min-width:0}${P} .vs-opts button.on{background:color-mix(in srgb,var(--dom) 12%,#fff);box-shadow:inset 0 0 0 2px var(--dom)}${P} .vs-opts svg.ic{width:28px;height:28px}
${P} .vs-ic{width:60px;height:60px;border-radius:19px;background:rgba(255,255,255,.8);display:grid;place-items:center;flex:0 0 auto}${P} .vs-ic svg.ic{width:40px;height:40px}
${P} .vs-q{flex:0 0 auto;display:grid}${P} .vs-q svg.ic{width:24px;height:24px}
/* edzés közben: a szett-tábla (három mező + pipa), a cél és a múlt hét a tábla fölött */
${P} .vs-pb{display:flex;gap:4px;margin:14px 16px 0}${P} .vs-pb i{display:block;height:7px;border-radius:4px;background:rgba(15,30,51,.12);overflow:hidden}${P} .vs-pb b{display:block;height:100%;background:var(--dom);border-radius:4px}
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
${P} .vs-fuse{height:6px;border-radius:3px;background:rgba(15,30,51,.10);overflow:hidden;margin:0 36px 14px}${P} .vs-fuse b{display:block;height:100%;width:calc(var(--p)*100%);background:var(--carb);border-radius:3px}
${P} #cerroot .vs-cres,${P} #cerroot .vs-ccard{opacity:0;transform:translateY(8px);transition:.5s var(--ease)}${P} #cerroot.b1 .vs-cres,${P} #cerroot.b2 .vs-ccard{opacity:1;transform:none}
body.still ${P} #cerroot .vs-cres,body.still ${P} #cerroot .vs-ccard,body.still ${P} .vs-cstars i svg{transition:none}
${P} .vs-gold{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--carb) 55%,#fff),0 14px 30px -20px var(--carb)}
${P} .vs-ms{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13.5px;font-weight:600}${P} .mstars{display:inline-flex;gap:2px}${P} .mstars svg.ic{width:18px;height:18px}
/* listák, szerkesztők, grafikák */
${P} .vs-day{width:34px;flex:0 0 auto;font-family:var(--disp);font-size:14px;font-weight:700;color:var(--sub)}
${P} .vs-log{padding:12px 0;border-top:1px solid var(--hair)}${P} .vs-log:first-child{border-top:0;padding-top:0}${P} .vs-log .fh-why{margin-top:8px}
${P} .vs-wkb{display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin-top:14px}${P} .vs-wkb i{display:grid;place-items:center;height:30px;border-radius:9px;background:rgba(255,255,255,.75);font-style:normal;font-size:12px;font-weight:650;color:var(--faint)}${P} .vs-wkb i.d{color:var(--ink);background:rgba(15,30,51,.12)}${P} .vs-wkb i.n{color:#fff;background:var(--dom)}
${P} .vs-mini{display:inline-flex;align-items:flex-end;gap:2px;height:24px;flex:0 0 auto}${P} .vs-mini i{display:block;width:5px;height:var(--h);border-radius:2px;background:var(--c)}
${P} .vs-warn{display:block;margin-top:3px;color:var(--warn);font-weight:600}
${P} .vs-grip{color:var(--faint);font-size:16px;flex:0 0 auto}
${P} .vs-rb{width:34px;height:34px;border-radius:11px;background:var(--page);display:grid;place-items:center;font-size:17px;flex:0 0 auto}
${P} .vs-rowbar{display:block;margin-top:6px}${P} .vs-rowbar .bar{width:100%;height:6px;border-radius:3px}
${P} .vs-gauge{position:relative;height:10px;border-radius:5px;background:rgba(15,30,51,.08);margin:44px 0 28px}${P} .vs-gauge .fill{position:absolute;left:0;top:0;bottom:0;width:var(--w);border-radius:5px;background:var(--c)}${P} .vs-gauge .mk{position:absolute;top:-6px;bottom:-6px;left:var(--x);width:2px;background:var(--ink)}
${P} .vs-gauge .pin{position:absolute;left:var(--x);top:-28px;transform:translateX(-50%);font-size:12px;font-weight:700;white-space:nowrap}${P} .vs-gauge .cap{position:absolute;top:16px;font-size:11.5px;color:var(--sub);white-space:nowrap}
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
@media (max-width:360px){${P} .fh-row .bar{width:44px}${P} .vs-duo.xl .vs-heat{width:96px}${P} .vs-duo .vs-heat{width:76px}${P} .vs-heat.lg{width:68px}${P} .vs-sets{grid-template-columns:16px 1fr 1fr 1fr 40px;gap:6px;padding:10px}${P} .vs-sets .tk,${P} .vs-sets .vd{width:40px}${P} .vs-stp button{width:30px;height:30px}${P} .vs-stp b{min-width:32px}${P} .vs-cstars i{width:40px;height:40px}${P} .vs-in{padding-left:0}${P} .vs-rest small{display:none}${P} .vs-tg b{font-size:14.5px}${P} .vs-opts{gap:6px}${P} .vs-opts button{font-size:12.5px;padding:9px 8px;gap:6px}${P} .vs-opts svg.ic{width:24px;height:24px}}
`;
const NL=(r,l)=>`<a href="#e-edzes-${r}">${l||r}</a>`;
register('edzes',{title:'Edzés',
  tabs:[['Mai','mai'],['Terv','terv'],['Terhelés','terheles'],['Gyakorlatok','exercises']],
  routes:ROUTES,
  sheets:SHEETS,
  after:(r,a)=>{if(r==='cer'&&!a)runCer();if(r!=='indulas')ST.tick=null;if(r!=='session'){ST.focus=null;if(ST.resting)stopRest(true)}},
  css:CSS,
  notes:`<h2>Edzés · minden oldal elkészült</h2>
  <p>Ugyanaz a felépítés mindenhol: fent a cím, alatta egy színes fő kártya egy mondattal és egy gombbal, aztán számozott fehér kártyák. Ami mélyebb, az egy sor, ami új oldalt vagy alulról feljövő lapot nyit.</p>
  <h2>Mit érdemes kipróbálni</h2>
  <p><b>Mai</b> · ${NL('mai','a mai nap')}: <b>Kihagyom</b> → „Miért marad ki?” lap (8 ok; a komoly okoknál a „Meddig tarthat?” sor bekapcsolja a kímélő módot) → <b>Visszavonom</b>. A sárga kártyán <b>Könnyítsük</b> vagy <b>Maradjon a terv</b>. A röpinél és a futásnál is van Kihagyom. Más állapotok: ${NL('mai.sze','szerda, elmaradt')} · ${NL('mai.pihen','pihenőnap')} · ${NL('mai.ures','nincs terv')} · ${NL('mai.folyamatban','edzés folyamatban')} · ${NL('mai.kesz','kész')} · ${NL('mai.kimelo','kímélő mód')} · ${NL('mai.kimelo3','kímélő, letelt a becslés')} · ${NL('mai.vissza','visszatérő, könnyített edzés')}.</p>
  <p><b>Az edzés útja</b> · Edzés indítása → ${NL('indulas','eligazítás')} (pipálható küldetések) → ${NL('session.uj','edzés közben')}: felül az aktuális gyakorlat a múlt héttel és a mai céllal, alatta a szettek (súly · ismétlés · RIR), a pipa után „Hogy ment?”, majd <b>magától indul a pihenő</b>, ami alul lebeg és valóban számol. A többi gyakorlat sor: rákoppintva az kerül felülre. A Rekordok, Technika és Műveletek (csere, hozzáadás, jegyzet) gombok a gyakorlat tetején vannak. Befejezés → ${NL('cer','lezáró értékelés')} csillagokkal → ${NL('cer.reszletek','részletek')} → ${NL('review','összegzés')} (${NL('review.gyak','egy gyakorlat')}). Félbehagyott edzés: ${NL('session','session')}.</p>
  <p><b>Terv</b> · ${NL('terv','a futó terv')} (${NL('terv.ures','még nincs')} · ${NL('terv.nincs','nem fut')}), ${NL('run','a terv oldala')}, ${NL('nap.csu','egy nap')} és ${NL('napszerk','a szerkesztője')}, ${NL('het','heti vizsgálat')} → ${NL('izom.back-wide','egy izom')}, ${NL('konyvtar','edzéstervek')}, ${NL('futamok','lezárt futamok')} (Összevetés: kettőt kijelölsz) → ${NL('riport','riport')} · ${NL('osszevetes','összevetés')}, ${NL('sablonok','sablonok')} → ${NL('sablon','egy sablon')} → ${NL('sablonszerk','szerkesztő')}, ${NL('ujterv','új terv')} (${NL('ujterv.gen','készül')} · ${NL('ujterv.kesz','vázlat')}), ${NL('futas','futás')} (${NL('futas.naplo','napló')} · ${NL('futas.tervek','tervek')}) → ${NL('futasterv','futóterv')}.</p>
  <p><b>Terhelés</b> · ${NL('terheles','a hét')}, ${NL('terkep','izomtérkép')} (${NL('terkep.terv','a heti terv')}), ${NL('jelek','minden izomjel')}, ${NL('mozgas','minden mozgásod')}, ${NL('gym','Gym · heti munka')}. <b>Gyakorlatok</b> · ${NL('exercises','lista')}, ${NL('exercise','egy gyakorlat')}, ${NL('medals','medálok')} (${NL('medals.ures','üresen')}). <b>Egyéb</b> · ${NL('sport','sport')} (${NL('sport.naplo','napló')} · ${NL('sport.cross','cross-load')}), ${NL('sportlog','sport naplózása')} → ${NL('sportlog.0','röplabda')}, ${NL('sajat','saját edzés')} (${NL('sajat.uj','új')} · ${NL('sajat.betolt','betöltés')} · ${NL('sajat.nincs','nem található')}).</p>
  <h2>Mi változott a korábbi körhöz képest</h2>
  <p>Semmi nem tűnt el, csak rendet kapott. Az edzés közbeni képernyőn egyszerre egy gyakorlat van nagyban, a többi egy-egy sor. A Futás és a „Gym · heti munka” eddig sehonnan nem volt elérhető: a Futás a Terv, a Gym-nézet a Terhelés oldal aljáról nyílik. Az izom-jelek ugyanazokban a színekben vannak, csak erősebb háttérrel és kerettel, hogy fehéren is jól látsszanak.</p>
  <h2>Amit csak kinézetre csinál</h2>
  <p>A lépegetők (− / +) és a jegyzetmezők a lapokon nem számolnak, a saját edzés szerkesztőjét kivéve. A szett kipipálása elindítja a pihenőt, de a sort nem írja át késznek.</p>`
});
})();
