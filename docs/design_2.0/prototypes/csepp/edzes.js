/* csepp/edzes.js — Edzés domain (Mai · Terv · Terhelés · Gyakorlatok + edzés közben, eligazítás, review, ceremónia, sport, futás, saját edzés). Built on window.K (see csepp/README.md). */
(function(){
const {I,T,csepp,ring,page,sec,back,register,mchp,muscleColor,toast,openSheet,closeSheet,esc,circ}=K;
const L=(n,cls='')=>`<svg class="ic ${cls}" aria-hidden="true"><use href="#${n}"/></svg>`;
const $=s=>document.querySelector(s);
const kg=v=>v==null?'—':String(v).replace('.',',');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mmss=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const hu=n=>Math.round(n).toLocaleString('hu-HU').replace(/[  ]/g,' ');
const bare=(inner,{pad='140px'}={})=>`<div class="aurora"><i></i><i></i><i></i><i></i></div><div class="scroll" style="padding-bottom:${pad}">${K.header()}${inner}</div><div class="toast" id="toast"></div><div class="sheet" id="sheet"></div><div class="scrim" id="scrim"></div>`;
const shh=(eb)=>`<div class="shh"><span class="eb">${eb}</span><button class="x" data-close aria-label="Bezárás">×</button></div>`;
const row=(ic,title,sub,right,attrs='')=>`<div class="ln ${attrs?'tap':''}" ${attrs}>${ic}<span class="g">${title}${sub?`<small>${sub}</small>`:''}</span>${right||''}</div>`;
const chev=I('i-chev','chev');
function heat(v,entries,cls=''){return `<span class="heat ${cls}"><svg viewBox="${BODY[v].vb}" aria-hidden="true">${sil(v)}${entries.flatMap(([k,a])=>(TOKEN_SHAPES[k]||[]).filter(([x])=>x===v).map(([,s])=>`<g fill="${muscleColor(k)}" opacity="${a}" style="filter:drop-shadow(0 0 4px ${muscleColor(k)})"><use href="#bm-${v}-${s}"/></g>`)).join('')}</svg></span>`}
function trend(pts,{w=300,h=90,c='var(--acc)'}={}){const min=Math.min(...pts),max=Math.max(...pts),rg=(max-min)||1;const X=i=>8+i*(w-16)/(pts.length-1),Y=p=>h-8-(p-min)/rg*(h-16);
  const sm=pts.map((_,i)=>{const a=pts.slice(Math.max(0,i-1),i+2);return a.reduce((s,v)=>s+v,0)/a.length});
  return `<svg class="trend" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M${sm.map((p,i)=>`${X(i)} ${Y(p)}`).join(' L')}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p,i)=>`<circle cx="${X(i)}" cy="${Y(p)}" r="${i===pts.length-1?4:2.5}" fill="${i===pts.length-1?c:'var(--faint)'}"/>`).join('')}</svg>`}
const arc=(cur,vals)=>`<div class="arc">${MESO.curve.map((p,i)=>`<i class="${p==='Deload'?'deload':''} ${i+1===cur?'now':i+1<cur?'past':''}" style="--h:${PH_H[p]}%"></i>`).join('')}</div><div class="arcl">${(vals||MESO.curve.map((_,i)=>i+1)).map((v,i)=>`<span>${i+1===cur?`<b>${v}</b>`:v}</span>`).join('')}</div>`;

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
const SPORTS=[['t-volley','Röplabda'],['t-crossfit','CrossFit / HIIT'],['t-trx','TRX / funkcionális'],['t-bike','Kerékpár'],['t-swim','Úszás'],['t-football','Foci'],['t-other','Kosárlabda'],['t-tennis','Tenisz'],['t-hike','Túra'],['t-other','Egyéb mozgás'],['t-run','Futás']];
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
function repaint(){const ph=$('#phone');const f=ROUTES[K.R]||ROUTES.mai;const t=document.createElement('div');t.innerHTML=f(K.ARG);const nsc=t.querySelector('.scroll'),osc=ph.querySelector('.scroll');
  if(osc&&nsc){const y=osc.scrollTop;osc.innerHTML=nsc.innerHTML;osc.querySelectorAll('.rise').forEach(e=>e.classList.remove('rise'));osc.scrollTop=y;
    ph.querySelectorAll(':scope>.rest,:scope>.foot').forEach(e=>e.remove());t.querySelectorAll(':scope>.rest,:scope>.foot').forEach(e=>{e.classList.remove('rise');ph.appendChild(e)});}
  else ph.innerHTML=t.innerHTML;}

/* ── MAI ── */
function ds(sel='ma'){
  const kmF=ST.km?'km':'•';
  const D=[['HÉT',21,'tick'],['KEDD',22,ST.km&&ST.km.day>=3?'km':'tick'],['SZE',23,kmCovers('sze')?'km':ST.sk.sze?'skip':'–','sze'],['MA',24,ST.day==='done'?'tick':kmCovers('gym')&&ST.day==='plan'?'km':ST.sk.gym&&ST.day==='plan'?'skip':'•','ma'],['PÉN',25,kmF],['SZO',26,'pihenő'],['VAS',27,'pihenő']];
  return `<section class="ds rise">${D.map(([l,n,m,k])=>`<button class="${k&&k===sel?'on':''} ${m==='pihenő'?'rest':''}" ${k?`data-go="${k==='ma'?'mai':'mai.'+k}"`:`data-toast="${l} · szept ${n}."`}><small>${l}</small><b>${n}</b><i class="${m==='tick'?'ok':''}">${m==='tick'?L('i-check'):m==='skip'?L('i-skip'):m==='km'?T('t-shield'):m}</i></button>`).join('')}</section>`;
}
function skBlock(k){const c=catOf(k);return `<div class="skb"><p class="txt" style="margin-top:8px"><b>Kihagyva · ${skLabel(k)}</b></p><p class="txt sub">${skEffect(k)}</p>
  <div class="act" style="margin-top:8px"><button class="lk" data-ez="skwhy:${k}">${c?'Másik ok':'Okot adok'}</button><button class="lk" data-ez="skundo:${k}">Visszavonom</button></div></div>`}
function kmHero(){const ask=kmExpired()&&!ST.km.asked;
  return `<div class="hero-cs" style="gap:12px;margin-top:10px">${T(kmIc())}<span style="flex:1"><p class="txt"><b>${kmTitle()}</b></p><p class="txt sub">Az edzés ma magától kimarad. Nem számít mulasztásnak, a sorozatod marad.</p>${ask?'<p class="txt" style="margin-top:4px">A becsült idő letelt — hogy vagy?</p>':''}</span></div>
  <div class="act">${ask?`<button class="btn sm" data-ez="kmback">Jobban vagyok</button><button class="lk" data-ez="kmnotyet">Még nem</button><button class="lk" data-ez="kmrel:1">Ma mégis edzek</button>`
    :`<button class="btn sm" data-ez="kmback">Jobban vagyok</button><button class="lk" data-ez="kmrel:1">Ma mégis edzek</button>`}</div>`}
const kmInner=()=>`<div class="act" style="margin:-2px 0 8px 38px"><span class="txt sub" style="font-size:12.5px">${T('t-shield')} Kímélő mód · magától kimarad, nem számít mulasztásnak.</span></div>`;
function cbBlock(){return `<p class="txt" style="margin-top:10px">${T('t-sprout')} <b>Könnyített visszatérés</b> · harmadával kevesebb sorozat, kb. 10%-kal kisebb súly</p>
  ${EX.map(e=>`<div class="ln" style="padding:6px 0"><span class="g" style="font-size:13px">${e.n}</span><span class="v"><s>${e.sets.length}</s> <b>${cbSets(e.sets.length)}</b> szett</span></div>`).join('')}
  <div class="act" style="margin-top:4px"><button class="lk" data-ez="cbwaive">Kikapcsolom a könnyítést</button><button class="lk" data-ez="cbundo">Mégsem vagyok jól</button></div>`}
function thero(){
  const km=ST.day==='plan'&&kmCovers('gym'),sk=!km&&ST.day==='plan'&&ST.sk.gym,cb=!km&&!sk&&ST.day==='plan'&&ST.cb&&!ST.cb.waived,rel=ST.day==='plan'&&ST.km&&ST.km.released;
  const pill=km?['q',`Kímélő mód · ${ST.km.day}. nap`]:sk?['q','Kihagyva']:cb?['q',`Visszatérő edzés · ${ST.cb.n}/${ST.cb.of}`]:{plan:['q','Betervezve'],run:['plan','Folyamatban'],done:['q','Kész']}[ST.day];
  const cta={plan:['Indítsuk','indulas'],run:[`Folytassuk · ${DONE()} szett kész`,'session'],done:['Eredmény · 16 szett','review']}[ST.day];
  return `<section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Ma 07:30 · Gym · ${MESO.name} · ${MESO.week}/${MESO.of}</span><span class="st ${pill[0]}">${pill[1]}</span></div>${I('i-dumb','art')}
    <h1 class="t">Pull Day</h1>
    <div class="chips"><span class="chip">5 gyakorlat</span><span class="chip">${cb?`<s>16</s> ${CBT()} szett`:'16 szett'}</span><span class="chip">~${cb?Math.round(78*CBT()/16/5)*5:78} perc</span><span class="chip">Húzás</span></div>
    <div class="mus" style="gap:6px">${['back-wide','back-mid','shoulder-rear','biceps-brachialis','traps'].map(k=>mchp(k,'sm')).join('')}</div>
    ${km?kmHero():sk?skBlock('gym'):`${cb?cbBlock():''}<div class="cta"><button class="btn" style="flex:1" data-go="${cta[1]}">${I('i-dumb')}${cta[0]} ${I('i-chev')}</button>${!rel&&ST.day==='plan'?'<button class="lk" data-ez="skip:gym">Kihagyom</button>':''}</div>
    ${rel?`<p class="txt sub" style="margin-top:10px">${T('t-shield')} Kímélő mód közben edzel · csak ma, könnyítve: kevesebb sorozat, kb. 10%-kal kisebb súly. <button class="lk" data-ez="kmrel:0">Mégse</button></p>`:''}`}
  </section>`;
}
function readyCard(){
  if(ST.day!=='plan'||ST.ready==='gone'||ST.sk.gym||kmCovers('gym'))return '';
  if(ST.ready==='done')return `<section class="card hg rise" style="--i:2;margin-top:0;--c:var(--ok)"><div class="hero-cs" style="gap:12px">${csepp('ok',57,{s:56,val:72})}<span style="flex:1"><p class="verdict" style="font-size:17px;margin:0 0 2px">Ma egy fokkal lejjebb</p><p class="txt sub">Minden gyakorlatnál a múlt heti súly marad, nem emelünk. A Rear Delt Fly nehéz szettjei kimaradnak.</p></span></div>
    <div class="act" style="margin-top:10px"><button class="lk" data-ez="ready:undo">Visszaállítom a tervet</button></div></section>`;
  return `<section class="card hg rise" style="--i:2;margin-top:0;--c:var(--warn)"><div class="hero-cs" style="gap:12px">${csepp('warn',57,{s:56,val:48})}<span style="flex:1"><p class="verdict" style="font-size:17px;margin:0 0 2px">Könnyebb nap javasolt</p><p class="txt sub">Izomláz 7/10, kipihentség 4/10, kedv 5/10. A jobb vállad fáj (5/10): a Rear Delt Fly-t könnyebb súllyal, vagy hagyd ki.</p></span></div>
    <div class="act" style="margin-top:10px"><button class="btn sm" data-ez="ready:lighten">Könnyítsük</button><button class="lk" data-ez="ready:keep">Maradjon a terv</button></div>
    <p class="fn" style="margin-top:8px">Csak javaslat — magától nem változtat semmit.</p></section>`;
}
function mai(arg){
  applyDemo(arg);
  if(arg==='ures')return page(`${sec('Edzés','mai nap')}<div class="p16 rise"><h1 class="t">Mai nap</h1></div>
    <section class="open rise" style="--i:1;border-top:0"><p class="txt sub">Itt fog élni a mai edzésed — előbb tervezz egy mesociklust.</p>
    <div class="act"><button class="btn sm" data-go="ujterv">${I('i-plus')}Tervezz mesociklust</button><button class="lk" data-sheet="custom">Saját edzés</button></div></section>`,'edzes','mai');
  if(arg==='pihen')return page(`${ds('')}<section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Ma pihenőnap</span></div>${I('i-moon','art')}<h1 class="t">Ma a pihenés dolgozik</h1><p class="txt sub" style="margin-top:6px;max-width:240px">Nincs tervezett edzés mára — a heti rended a Terv fülön találod.</p></section>
    <section class="open rise" style="--i:2">${row(I('i-dumb'),'Saját edzés','','',`data-sheet="custom"`)}${row(I('i-layers'),MESO.name,'MAV · 3. hét / 6',chev,`data-go="run"`)}</section>`,'edzes','mai');
  if(arg==='sze'){const sk=ST.sk.sze,km=kmCovers('sze');return page(`${ds('sze')}${sec('Szept 23. · szerda','ami erre a napra volt tervezve')}
    <section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Gym · szept 23. · 07:30</span><span class="st ${km||sk?'q':'bad'}">${km?'Kímélő mód':sk?'Kihagyva':'Elmaradt'}</span></div>${I('i-dumb','art')}<h1 class="t">Leg Day</h1>
      <div class="chips"><span class="chip">6 gyakorlat</span><span class="chip">18 szett</span><span class="chip">~70 perc</span></div>
      ${km?`<p class="txt sub" style="margin-top:10px">${T('t-shield')} Kímélő mód · magától kimaradt, nem számít mulasztásnak.</p>`:sk?skBlock('sze'):`<div class="cta"><button class="btn" style="flex:1" data-go="indulas">Kezdjük el ${I('i-chev')}</button><button class="lk" data-ez="skip:sze">Kihagytam</button></div>`}</section>
    <p class="fn p16 rise" style="--i:2">Az elmúlt 7 nap kimaradt alkalmaihoz utólag is megadhatod, miért maradtak ki.</p>`,'edzes','mai')}
  const vKm=kmCovers('volley'),vSk=!vKm&&ST.sk.volley,rKm=kmCovers('run'),rSk=!rKm&&ST.sk.run,rCb=!rKm&&!rSk&&ST.cb&&!ST.km;
  const E=ST.day==='done'?[190,vKm||vSk?0:460]:[0,vKm||vSk?190:650];
  const MUS=[['back-wide','Hát (széles)',6,ST.day==='done'?6:0,'erős'],['back-mid','Hát (közép)',4,ST.day==='plan'?0:3,'közepes'],['shoulder-rear','Váll (hátsó)',3,0,'enyhe'],['biceps-brachialis','Kar',3,0,'enyhe']];
  return page(`${ds()}${thero()}${readyCard()}
  <section class="open rise" style="--i:3"><span class="eb">Ma még jön</span>
    ${row(I('i-ball'),'Röpi edzés · BVSC','18:00 · 90 perc · feladó · BVSC csarnok',`<span class="st q">${vKm?'Kímélő mód':vSk?'Kihagyva':'Tervezett'}</span>`)}
    ${vKm?kmInner():vSk?`<div style="margin:-6px 0 6px 38px">${skBlock('volley')}</div>`:`<div class="act" style="margin:-2px 0 8px 38px"><button class="lk" data-sheet="sportlog">Logold a session-t</button><button class="lk" data-ez="skip:volley">Kihagyom</button></div>`}
    ${rCb?`${row(I('i-run'),'Sprint-intervallum','holnap · 18:00 · <s>~30</s> ~15 perc · laza tempó','<span class="st q">Tervezett</span>')}<div class="act" style="margin:-2px 0 8px 38px"><span class="txt sub" style="font-size:12.5px">${T('t-sprout')} Visszatérő futás · első futás kihagyás után: kb. fele olyan hosszú, laza tempóban.</span></div>`
      :`${row(I('i-run'),'Sprint-intervallum','tegnap · 18:00 · 6 kör · RPE 9–10',`<span class="st ${rKm||rSk?'q':'bad'}">${rKm?'Kímélő mód':rSk?'Kihagyva':'Elmaradt'}</span>`)}
      ${rKm?kmInner():rSk?`<div style="margin:-6px 0 6px 38px">${skBlock('run')}</div>`:`<div class="act" style="margin:-2px 0 8px 38px"><button class="lk" data-sheet="runlog">Pótold</button><button class="lk" data-ez="skip:run">Kihagytam</button></div>`}`}
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Mai terhelés · a keretedhez</span>
    <div class="big"><span class="num">${E[0]?`+${E[0]}`:`+${E[1]}`}</span><span class="v">${E[0]?`kcal már a keretedben${E[1]?` · +${E[1]} még jön, ha megcsinálod`:''}`:'kcal jön a kereted fölé, ha megcsinálod'}</span></div>
    <div style="height:6px"></div>
    ${MUS.map(([k,l,p,d,w])=>`<div class="ln">${mchp(k,'sm')}<span class="g">${l}<small>${w}</small></span><span class="v"><b>${d}</b> / ${p}</span><div class="bar q"><b style="--w:${p/6*100}%"></b></div></div>`).join('')}
    <p class="fn">${ST.day==='run'?'A folyamatban lévő edzés a befejezéskor kerül a keretedbe. ':''}Becslés, nem mérés. Ugyanez a szám áll a Fuel keretében.</p>
  </section>
  <section class="open rise" style="--i:5"><span class="eb">Vagy inkább</span>
    ${row(I('i-dumb'),'Egyedi edzés','gyors indítás',chev,`data-sheet="custom"`)}
    ${row(I('i-ball'),'Sport naplózása','gyors indítás',chev,`data-go="sportlog"`)}
    ${row(I('i-layers'),'Mezociklus',`${MESO.name} · MAV · 3. hét / 6`,chev,`data-go="run"`)}
    ${row(I('i-ball'),'Sportjaid és szezonod','',chev,`data-go="sport"`)}
  </section>`,'edzes','mai');
}
function whySheet(){
  const k=ST.whyk,cur=ST.sk[k]||{cat:'NONE'},c=CATS.find(x=>x[0]===cur.cat),kmHere=ST.km&&ST.km.from===k&&c&&c[3];
  const note=!c?`${T('t-info')}<span>Ha megmondod, miért, a terv és az edző ehhez igazodik. Nem kötelező.</span>`:`${T(c[3]?'t-heart':passKey()===k?'t-shield':'t-info')}<span>${c[3]?`<b>Nem számít mulasztásnak.</b> ${CARE[c[0]]}`:passKey()===k?'<b>Ezt a heti szabadjegyed fedezi</b> — a sorozatod marad.':'<b>Ez rendes kihagyásnak számít</b> — a heti szabadjegyet már felhasználtad. Semmi gond, jövő héten új jár.'}</span>`;
  return `${shh(`Kihagyva · ${SKT[k]}`)}<h2 class="t">Miért marad ki?</h2><p class="txt sub">Nem kötelező — segít, hogy a terv hozzád igazodjon.</p>
  <div class="gridx2" style="margin-top:10px">${CATS.map(([id,ic,l])=>`<button class="opt ${cur.cat===id?'on':''}" data-ez="why:${id}">${T(ic)}<span>${l}</span></button>`).join('')}</div>
  ${cur.cat==='OTHER'?`<span class="eb" style="margin-top:12px">Mi történt? · saját szavakkal</span><div class="fld ${cur.text?'':'ph'}">${cur.text||'pl. családi program jött közbe'} <span style="float:right">${T('t-mic')}</span></div>`:''}
  ${c&&c[3]?`<span class="eb" style="margin-top:12px">Meddig tarthat?</span><div class="ch2">${KDUR.map((l,i)=>`<button class="${kmHere&&ST.km.dur===i?'on':''}" data-ez="kmdur:${i}">${l}</button>`).join('')}</div>`:''}
  <p class="txt sub note" style="margin-top:12px;display:flex;gap:8px;align-items:flex-start">${kmHere?`${T('t-shield')}<span><b>Kímélő mód bekapcsolva</b> · amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.</span>`:note}</p>
  <div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-ez="whydone:1" ${c?'':'disabled style="flex:1;opacity:.45"'}>Kész</button><button class="lk" data-ez="whydone:0">Most nem mondom</button></div>`;
}
const UDVX=[['1–2 nap',d=>`${d>=1&&d<=2?d:2} nap kiesés`,'a program megy tovább a naptár szerint.','Az első edzés könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.'],['kb. egy hét',()=>'3 nap kiesés','onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz (okt. 18. → okt. 25.).','Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.'],['több mint egy hét',()=>'11 nap kiesés','egy hetet visszalépünk: a 2. héttel folytatod, a program vége 2 héttel később lesz (okt. 18. → nov. 1.).','Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.']];
function udvSheet(){const [,h,l1,l2]=UDVX[ST.udv];
  return `${shh('Kímélő mód vége')}<h2 class="t">Üdv újra!</h2><p class="txt sub">Így folytatjuk — a terv magától igazodik.</p>
  <span class="eb" style="margin-top:12px">Próbáld ki · mennyi ideig tartott?</span><div class="ch2">${UDVX.map(([l],i)=>`<button class="${i===ST.udv?'on':''}" data-ez="udvt:${i}">${l}</button>`).join('')}</div>
  ${row(T('t-calendar'),`<b>${h(ST.km?ST.km.day-1:2)}</b> · ${l1}`)}${row(I('i-dumb'),l2)}${row(I('i-run'),'Az első futás kb. fele olyan hosszú, laza tempóban.')}
  <div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-ez="udv:1">Rendben</button><button class="lk" data-ez="udv:0">Mégsem vagyok jól</button></div>`}

/* ── ELIGAZÍTÁS ── */
function indulas(){
  if(!ST.tick)ST.tick=CHAL.map(c=>c.pre); const on=ex=>CHAL.some((c,i)=>ST.tick[i]&&c.ex===ex),n=ST.tick.filter(Boolean).length;
  return bare(`${back('Mai','mai')}
  <section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Eligazítás · Pull Day · 3. hét / 6 · MAV</span></div>${I('i-clock','art')}
    <div class="big" style="margin-top:4px"><span class="num">70–85</span><span class="v">perc</span></div><p class="txt sub">ennyi várható, a saját tempód alapján</p>
    <div class="chips"><span class="chip">5 gyakorlat</span><span class="chip">16 szett</span></div></section>
  <section class="open rise" style="--i:2;padding-top:4px"><div class="ln">${I('i-warn')}<span class="g"><b style="color:var(--warn)">Jobb váll aktív</b><small>óvatos, először warm-up · a Rear Delt Fly ma könnyítve</small></span></div></section>
  <section class="open rise" style="--i:3"><span class="eb">Küldetések · ma · mit vállalsz?</span>
    ${CHAL.map((c,i)=>`<div class="ln tap" data-ez="btick:${i}"><span class="tk ${ST.tick[i]?'on':''}">${L('i-check')}</span><span class="g">${c.ex}<small>${c.type} · <b>${c.target}</b> · ${c.conf==='tanulom'?'még tanulom, mennyire biztos':c.conf+' biztos'}</small></span><button class="lk" data-toast="${esc(c.why)}">Miért? ›</button></div>`).join('')}
    <p class="fn">Az előre bepipáltakat javaslom. Passzolni ér — és edzés közben is elengedheted bármelyiket.</p></section>
  <section class="open rise" style="--i:4">${row(T('t-up'),'Túlterhelés · 2× +súly · 2× +rep','Ezeken a gyakorlatokon lépünk ma előre.')}</section>
  <section class="open rise" style="--i:5"><span class="eb">A mai sor</span>${EX.map(e=>`<div class="ln">${mchp(e.k,'sm')}<span class="g">${e.n}<small>${e.sets.length} szett · cél ${e.goal} · ${e.chg}${e.why?' · '+e.why:''}</small></span>${on(e.n)?T('t-quest','q'):''}</div>`).join('')}</section>`,{pad:'120px'})
  +`<div class="foot rise"><button class="btn" data-ez="bstart">${T('t-play')}${n?`Indulás · ${n} küldetéssel`:'Indulás küldetés nélkül'}</button></div>`;
}

/* ── EDZÉS KÖZBEN (BWS: súly · ism · RIR → pihenő) ── */
const freshSets=e=>e.sets.map((s,j)=>{const w=isDone(s)?s[0]:s[1],r=isDone(s)?s[1]:s[2],ri=isDone(s)?s[2]:s[3];return j===0&&e===EX[0]?['cur',w,r,ri]:['up',w,r,ri]});
const exChal=n=>CHAL.map((c,i)=>i).filter(i=>CHAL[i].ex===n&&(CHAL[i].acc||CHAL[i].rel));
function setRow(s,j,i){const head=`<span class="n">${j+1}</span>`;
  if(isDone(s))return `${head}<span class="v done">${kg(s[0])}</span><span class="v done">${s[1]}</span><span class="v done">${s[2]}</span><button class="vd" data-sheet="set" data-arg="${i}.${j}" aria-label="Szett szerkesztése">${T(VI[s[3]])}</button>`;
  if(s[0]==='cur')return `${head}<span class="in ph">${kg(s[1])}</span><span class="in ph">${s[2]}</span><span class="in ph">${s[3]}</span><button class="tk go" data-sheet="rp" data-arg="${i}" aria-label="Szett kész">${L('i-check')}</button>`;
  return `${head}<span class="up">${kg(s[1])}</span><span class="up">${s[2]}</span><span class="up">${s[3]}</span><span></span>`;}
function exCard(e,i,fresh){
  const first=i===0,rows=fresh?freshSets(e):e.sets,head=`<span class="h">#</span><span class="h">kg</span><span class="h">ism</span><span class="h">RIR</span><span></span>`;
  const sub=e.to?`kész · lecserélve → ${e.to}`:e.last?`múlt hét ${e.last} · ma a javaslat <b>${e.goal}</b>${e.chg?' · '+e.chg:''}`:'első alkalom · a súlyt te adod meg, innentől jön a javaslat';
  const extra=[e.origin?`${e.origin==='meso'?'Mezociklusban':'Csak ma'} · ${e.from?`a ${e.from} helyett`:'ma hozzáadva'}`:'',e.note,e.cue,e.why].filter(Boolean);
  return `<section class="ex ${first?'hg':''} rise" style="--i:${i+1}"><div class="exh">${mchp(e.k,first?'':'sm')}<span class="g"><strong>${e.n}</strong><small>${sub}</small></span><span class="acts"><button class="rb" data-sheet="recs" data-arg="${i}" aria-label="Rekordok">${T('t-journal')}</button>${e.to?'':`<button class="rb" data-sheet="menu" data-arg="${i}" aria-label="Gyakorlat menü">⋮</button>`}</span></div>
    ${exChal(e.n).map(q=>`<button class="qline" data-sheet="qb" data-arg="${q}">${T('t-quest')}<span>${CHAL[q].acc?`${CHAL[q].type} · ${CHAL[q].target}`:`elengedve · <s>${CHAL[q].target}</s>`}</span></button>`).join('')}
    ${extra.map(x=>`<p class="txt sub xl">${x}</p>`).join('')}
    <div class="sets">${head}${rows.map((s,j)=>setRow(s,j,i)).join('')}</div>
    ${e.to?'':`<div class="tech tap" data-sheet="tech" data-arg="${i}">${I('i-book')}<span class="g"><b>Technika</b> · Beállás · Végrehajtás · Gyakori hibák</span>${chev}</div>`}</section>`;
}
const restDock=()=>`<div class="rest nn"><div class="ring sm" style="--c:var(--acc)"><svg viewBox="0 0 88 88"><circle class="t" cx="44" cy="44" r="38"/><circle class="p" cx="44" cy="44" r="38" style="--d:${(circ(38)*(1-ST.restLeft/ST.restTotal)).toFixed(1)}"/></svg></div><span class="g"><strong>${mmss(ST.restLeft)}</strong><small>pihenő · ${ST.restTotal} mp az ajánlott</small></span><button class="pill" data-ez="plus15">+15</button><button class="pill" data-ez="reststop">Tovább</button></div>`;
function session(arg){const fresh=arg==='uj',d=fresh?0:DONE();
  return bare(`<div class="wtop rise"><button class="backbtn" data-go="mai"><b>‹</b></button><strong>Pull Day</strong><span class="cnt"><b>${d}</b> / ${TOT()} szett${fresh?'':' · 31 perc'}</span><button class="rb" data-toast="Kalauz az edzéshez">?</button><button class="rb" data-sheet="menu" data-arg="0" aria-label="Gyakorlat műveletek">⋮</button></div>
  <div class="pb rise">${EX.map(e=>`<i style="flex:${e.sets.length}"><b style="--w:${fresh?0:e.sets.filter(isDone).length/e.sets.length*100}%"></b></i>`).join('')}</div>
  ${EX.map((e,i)=>exCard(e,i,fresh)).join('')}
  <div class="p16 rise" style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" style="flex:1" data-ez="pick:add">${I('i-plus')}Hozzáadás</button><button class="btn ghost" style="flex:1" data-sheet="fin">${T('t-star')}Befejezés</button></div>
  <p class="fn p16 rise">A harmadik mező beírásakor a pihenő magától indul. A javaslat a múlt hetedből jön; felülírhatod. A kész sor végén az ítélet: célsávban · rekord · cél fölött · cél alatt — koppintva szerkeszthető.</p>`,{pad:ST.resting?'190px':'130px'})+(ST.resting?restDock():'');
}
function startRest(){ST.resting=true;ST.restLeft=ST.restTotal=90;clearInterval(ST.restT);ST.restT=setInterval(()=>{if(K.R!=='session'||K.D!=='edzes'){stopRest(true);return}ST.restLeft--;if(ST.restLeft<=0){stopRest();toast('Pihenő vége — jöhet a következő szett');return}const r=$('#phone .rest');if(r){r.querySelector('strong').textContent=mmss(ST.restLeft);r.querySelector('.p').style.setProperty('--d',(circ(38)*(1-ST.restLeft/ST.restTotal)).toFixed(1))}},1000);repaint()}
function stopRest(silent){ST.resting=false;clearInterval(ST.restT);if(!silent)repaint()}
function pickBody(){const P=ST.pick,sw=P.mode==='swap',o=EX[P.g],inS=new Set(EX.map(e=>e.n)),q=P.q.trim().toLowerCase();
  const r=i=>{const [n,k,t,last]=LIB[i];return row(mchp(k,'sm'),n,`${muscleLabel(k)} · ${t==='compound'?'összetett':'izolált'}${last?` · múltkor ${last}`:' · még nem csináltad'}`,chev,`data-ez="lib:${i}"`)};
  const free=LIB.map((_,i)=>i).filter(i=>!inS.has(LIB[i][0]));
  const sim=sw?[...free.filter(i=>LIB[i][1]===o.k),...free.filter(i=>LIB[i][1]!==o.k&&regionOf(LIB[i][1])===regionOf(o.k))].slice(0,4):[];
  const all=free.filter(i=>(P.f==='all'||regionOf(LIB[i][1])===P.f)&&(!q||LIB[i][0].toLowerCase().includes(q)));
  return `${sim.length&&!q?`<span class="eb" style="margin-top:12px">Hasonló gyakorlatok · ${muscleLabel(o.k)}</span>${sim.map(r).join('')}`:''}
  <span class="eb" style="margin-top:12px">${q?'Találatok':'Összes gyakorlat'}</span><div class="ch2">${[['all','Mind'],...REGIONS.map(x=>[x.key,x.label])].map(([k,l])=>`<button class="${P.f===k?'on':''}" data-ez="pf:${k}">${l}</button>`).join('')}</div>
  ${all.length?all.map(r).join(''):'<p class="fn">Nincs ilyen nevű gyakorlat ebben a csoportban.</p>'}`}
function applyPick(scope){const P=ST.pick,sw=P.mode==='swap',[n,k,t,last,kgv,rp]=LIB[P.lib],fresh=K.ARG==='uj';
  if(sw){const o=EX[P.g],d=fresh?0:o.sets.filter(isDone).length,rest=o.sets.slice(d),wasCur=rest.some(x=>x[0]==='cur');const sets=rest.map((x,j)=>[j===0&&wasCur?'cur':'up',kgv,rp,1]);
    const ne={n,k,last,goal:last?`${kg(kgv)} × ${rp}`:'—',chg:last?'ugyanaz':'',sets,origin:scope,from:o.origin==='ma'?o.from:o.n};
    if(d){o.sets=o.sets.slice(0,d);o.to=n;EX.splice(P.g+1,0,ne)}else EX.splice(P.g,1,ne);toast(scope==='meso'?`Csere kész — a mezociklus hátralévő heteiben is ${n}`:`Csere kész — csak ma ${n}`)}
  else{const c=t==='compound'?4:3;EX.push({n,k,last,goal:last?`${kg(kgv)} × ${rp}`:'—',chg:'',sets:Array.from({length:c},()=>['up',kgv,rp,1]),origin:scope});toast(scope==='meso'?`${n} felvéve a mezociklusba`:`${n} hozzáadva a mai edzéshez`)}
  closeSheet();repaint()}

/* ── ÖSSZEGZÉS (review) ── */
const LANE=[['Húzódzkodás (súlyozott)','back-wide','12,5 × 8',4,4,1],['Döntött törzsű evezés','back-mid','72,5 × 10',3,3,1],['Rear Delt Fly','shoulder-rear','10 × 12',3,3,0],['Kalapácsbicepsz','biceps-brachialis','16 × 13',3,2,0],['Vállemelés','traps','30 × 15',3,2,0]];
function review(arg){
  if(arg==='gyak')return page(`${back('Összegzés','review')}
    <section class="hero hg rise" style="--i:1;--c:${muscleColor('back-wide')}"><div class="hero-cs">${mchp('back-wide')}<span><span class="eb">Hát (széles) · Pull Day</span><h1 class="t" style="font-size:24px">Húzódzkodás (súlyozott)</h1><p class="txt sub">4 szett · a top szett 12,5 × 8</p></span></div></section>
    <section class="open rise" style="--i:2"><div class="cells"><span><b>12,5×8</b><small>top szett</small></span><span><b>820</b><small>kg volumen</small></span><span><b>1,8</b><small>Ø RIR</small></span></div><p class="fn">előzőleg 10 × 8 — a legnehezebb szett súlya +2,5 kg</p></section>
    <section class="open rise" style="--i:3"><span class="eb">Medál</span>${row(T('t-record'),'Súly-rekord · Húzódzkodás','előző: 10 kg','<span class="v"><b>12,5 kg</b></span>')}</section>
    <section class="open rise" style="--i:4"><span class="eb">Szettek</span>${[['12,5 kg × 8','RIR 2','célsávban','100 kg',''],['12,5 kg × 8','RIR 1','rekord','100 kg','Az utolsó ismétlés kemény volt'],['12,5 kg × 7','RIR 2','cél alatt','87,5 kg',''],['12,5 kg × 8','RIR 2','célsávban','100 kg','']].map(([a,r,t,vol,n])=>row('',`${a} · ${r}`,`${t}${n?` · „${n}”`:''}`,`<span class="v">${vol}</span>`)).join('')}</section>`,'edzes','mai');
  return page(`${back('Mai','mai')}
  <section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Lezárva · szept 24. · Pull Day</span><span class="st q">Kész</span></div>${I('i-dumb','art')}
    <div class="big" style="margin-top:4px"><span class="num">14</span><span class="v">/ 16 szett</span></div><p class="txt sub">4,2 t összvolumen · 5/5 gyakorlat · terv ~62, tény 71 perc</p>
    <div class="mus" style="gap:6px;margin-top:10px">${[['back-wide',7],['back-mid',3],['shoulder-rear',3],['biceps-brachialis',2],['traps',2]].map(([k,n])=>`<span class="mch">${mchp(k,'sm')}<b>${n}</b></span>`).join('')}</div></section>
  <section class="open rise" style="--i:2"><span class="eb">Mihez képest · szept 17. · 1 hete</span>
    ${row('','Volumen','előző 3,9 t','<span class="v"><b>4,2 t</b> · +0,3</span>')}${row('','Top szett','előző 10 × 8','<span class="v"><b>12,5 × 8</b></span>')}${row('','Ø RIR','előző 2,0','<span class="v"><b>1,6</b></span>')}
    <p class="fn">A javulás itt a trend, nem egy nap: a legnehezebb szett súlya három hete emelkedik.</p></section>
  <section class="open rise" style="--i:3"><span class="eb">Medálok · 3 rekord · 9 célszett</span>
    ${[['Súly-rekord','Húzódzkodás (súlyozott)','12,5 kg','előző: 10 kg'],['Rep-rekord','Döntött törzsű evezés','10 @ 72,5','előző: 9 @ 72,5'],['Volumen-rekord','Döntött törzsű evezés','2 175 kg','előző: 2 070 kg']].map(([t,n,v,p])=>row(T('t-record'),n,t,`<span class="v"><b>${v}</b><br>${p}</span>`)).join('')}
    ${row(T('t-tick'),'9 célszett teljesítve','Húzódzkodás ×3 · Evezés ×3 · Vállemelés ×3')}</section>
  <section class="open rise" style="--i:4"><span class="eb">Küldetések · 1 megvan · 1 kimaradt</span>
    ${row(T('t-tick'),'Húzódzkodás: 12,5 × 8 az első szetten','megcsináltad')}${row(T('t-skip'),'Kalapácsbicepsz: az utolsó szett RIR 0-ig','nem jött össze — a riport nem büntet')}</section>
  <section class="open rise" style="--i:5"><span class="eb">Gyakorlatonként</span>
    ${LANE.map(([n,k,t,of,d,rec])=>row(mchp(k,'sm'),n,`top szett ${t}${rec?' · rekord':''}`,`<span class="v"><b>${d}</b> / ${of}</span>${chev}`,`data-go="review.gyak"`)).join('')}</section>
  <section class="open rise" style="--i:6"><span class="eb">Amit aznap írtál</span><p class="txt">Ma a váll végig nyugton volt, a sorok tiszták. A Kalapácsbicepsznél az utolsó szett elmaradt — elfogyott az idő.</p>
    <div class="act"><button class="lk" data-sheet="wnote">Szerkesztés</button></div></section>
  <div class="p16 rise" style="--i:7;display:flex;justify-content:space-between;margin-top:10px"><button class="lk" data-toast="Előző Pull Day · szept 17.">‹ Előző Pull Day</button><span class="fn" style="margin:0">ez a legutóbbi</span></div>`,'edzes','mai');
}

/* ── LEZÁRÓ CEREMÓNIA (a minta marad, az anyag csepp-üveg) ── */
function cer(arg){
  if(arg==='reszletek')return bare(`<div class="p16 rise" style="display:flex;align-items:center;gap:8px;padding-top:12px">${mini(CER.ratio)}<span class="txt">Erős nap.</span></div>
    <section class="hero hg rise" style="--i:1;--c:var(--ok)" data-toast="Fuel · Mai (a mozgás hozzáadja a keretedhez)"><div class="hero-cs" style="gap:14px">${I('i-bowl')}<span style="flex:1"><div class="big"><span class="num">+${hu(CER.kcal)}</span><span class="v">kcal</span></div><p class="txt sub">Ennyit nyertél a mai mozgással · becslés, nem mérés</p></span>${chev}</div></section>
    <section class="open rise" style="--i:2"><span class="eb">A mai edzésen · izomcsoportok</span>
      ${CER.mus.map(([k,l,d,p])=>`<div class="ln">${mchp(k,'sm')}<span class="g">${l}</span><span class="v"><b>${d}</b> / ${p} szett</span><div class="bar ${d>=p?'q':''}" style="--c:${muscleColor(k)}"><b style="--w:${d/p*100}%"></b></div></div>`).join('')}
      <p class="fn">Ami megvan, az elhallgat: szürke. A csillagok a tervezett szettből, ismétlésből és súlyból számolnak, nem AI-értékelés.</p></section>
    <section class="open rise" style="--i:3"><span class="eb">Hogy ment?</span><div class="fld ph" data-toast="Jegyzet írása">Pl. rosszul aludtam, de a húzódzkodás jól ment…</div><p class="fn">Nem kötelező — később is hozzáírhatod.</p></section>
    <div class="p16 rise" style="--i:4;display:grid;gap:10px;margin-top:8px"><button class="btn wide" data-ez="cerdone">${T('t-tick')}Vissza a mai napra · az edzés lezárva és elmentve</button><button class="lk" style="text-align:center" data-go="cer">Vissza az értékeléshez</button></div>`);
  return bare(`<div id="cerroot"><section class="cer" id="cerstage" style="--p:0"><span class="eb">Edzés lezárva</span>
    <div class="cstars" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i data-star="${i}">${T('t-star-empty','off')}${T('t-star-half','half')}${T('t-star','on')}</i>`).join('')}</div><div class="fuse"><b></b></div></section>
  <section class="cres"><p class="verdict">Erős nap.</p>
    <section class="card hg ccard" style="--c:#CFA14A"><span class="eb">Ez a tiéd mostantól · ${CER.rec.length} új rekord</span>${CER.rec.map(([n,k,ch])=>row(T(KIND_IC[k]),n,k,`<span class="v"><b>${ch[0]}</b> · ${ch[1]}</span>`)).join('')}</section>
    <section class="open ccard" style="border-top:0;padding-top:4px"><div class="cells"><span><b>${CER.min}′</b><small>a pulton töltött idő</small></span><span><b>+${CER.xp}</b><small>szerzett XP</small></span><span><b>+${CER.kcal}</b><small>kcal · becslés</small></span></div>
      <div class="cells"><span><b data-c="sets">0</b><small>szett</small></span><span><b data-c="reps">0</b><small>ismétlés</small></span><span><b data-c="vol">0</b><small>kg × ism</small></span></div>
      <span class="eb" style="margin-top:14px">Küldetések · 1 / 2</span>${CER.chal.map(([ok,t,ex,ch])=>row(T(ok?'t-tick':'t-skip'),ex,`${t} · ${ch.join(' · ')}`,`<span class="v">${ok?'teljesült':'nem jött össze'}</span>`)).join('')}
      <p class="fn">2 szett kihagyott státusszal zárult.</p></section></section>
  <div class="cfoot p16"><button class="btn wide" data-go="cer.reszletek">${T('t-journal')}Részletek · izomcsoportok és a nyert kalória</button></div></div>`,{pad:'40px'});
}
function runCer(){const root=$('#cerroot'),stage=$('#cerstage');if(!root)return;
  const D=2700,S=1700,B={b1:1750,b2:2050,b3:2350},ease=t=>1-(1-t)**3,instant=document.body.classList.contains('still')||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint=ms=>{const p=ease(Math.min(1,ms/S))*CER.ratio;stage.style.setProperty('--p',p);stage.querySelectorAll('[data-star]').forEach(st=>{const c=starCls(+st.dataset.star,p);st.classList.toggle('is-lit',c==='is-lit');st.classList.toggle('is-half',c==='is-half')});
    const t=ease(Math.max(0,Math.min(1,(ms-B.b2)/(D-B.b2))));root.querySelectorAll('[data-c]').forEach(el=>{const v={sets:CER.sets,reps:CER.reps,vol:CER.vol}[el.dataset.c]*t;el.textContent=el.dataset.c==='vol'?hu(v):Math.round(v)});
    for(const k of ['b1','b2','b3'])root.classList.toggle(k,ms>=B[k])};
  if(instant){paint(D);return}
  const t0=performance.now();const f=now=>{const ms=Math.min(D,now-t0);paint(ms);if(ms<D&&stage.isConnected)requestAnimationFrame(f)};requestAnimationFrame(f)}

/* ── TERHELÉS · GYM (a régi Gym-nézet, a Terhelés fül alatt) ── */
function gym(){
  const hb=[['back-wide',.95],['back-mid',.9],['traps',.7],['shoulder-rear',.75],['triceps-long',.5],['ham',.25],['glute',.2],['calf',.15]],hf=[['chest-mid',.7],['chest-upper',.6],['shoulder-front',.65],['shoulder-side',.6],['biceps-long',.55],['quad',.25],['core',.12]];
  return page(`<section class="hero hg rise" style="--i:1"><div class="hero-cs" style="gap:14px">${heat('back',hb)}<span style="flex:1"><span class="eb">Terhelés · 3. hét · MAV</span><div class="big"><span class="num">62</span><span class="v">%</span></div><p class="txt sub">a heti munkádból megvan — 58 szett a 94-ből</p><div class="bar q" style="margin-top:8px"><b style="--w:62%"></b></div></span></div>
    <p class="verdict" style="font-size:16px;margin-top:12px">3 izomcsoport még munkára vár ezen a héten. <button class="lk" data-sheet="info">Miből áll össze?</button></p>
    <div class="act" style="margin-top:8px"><button class="lk" data-go="run">3. hét / 6 ›</button><button class="lk" data-go="medals">14 medál ›</button></div></section>
  <section class="open rise" style="--i:2">${row(`<span class="duo sm">${heat('front',hf)}${heat('back',hb)}</span>`,'A tested térképe','elöl és hátul, ami már dolgozott · a hét terhelése izmonként',chev,`data-go="terkep"`)}</section>
  <section class="open rise" style="--i:3"><span class="eb">Izomcsoportok · ezen a héten</span>
    ${GR.map(([k,l,d,p,w,much],i)=>`<div class="ln tap" data-sheet="grp" data-arg="${i}">${mchp(k,'sm')}<span class="g">${l}${much?' <b style="color:var(--warn)">· sok</b>':''}<small>${w}</small></span><span class="v"><b>${d}</b> / ${p}</span><div class="bar ${d>=p?'q':''}" style="--c:${muscleColor(k)}"><b style="--w:${clamp(d/p*100,2,100)}%"></b></div></div>`).join('')}
    <p class="fn">A szám a heti tervből jön: a mesociklus hétre bontott szettjei. Ami megvan, szürke.</p></section>
  <section class="open rise" style="--i:4"><span class="eb">Sport a héten · 4 röpi · 6,5 óra</span>
    ${row(mchp('shoulder-front','sm'),'Váll · ütések, nyitások','','<span class="v"><b>erős</b></span>')}${row(mchp('calf','sm'),'Vádli · ugrások','','<span class="v"><b>közepes</b></span>')}${row(mchp('core','sm'),'Core','','<span class="v"><b>enyhe</b></span>')}
    <p class="fn">Becslés — a szettszámokba nem számít bele.</p></section>
  <section class="open rise" style="--i:5"><span class="eb">Mozgás · minden mozgásod a héten</span>
    ${row(I('i-dumb'),'Gym · 3 edzés','','<span class="v"><b>58</b> szett</span>')}${row(I('i-ball'),'Röpi · 4 session','','<span class="v"><b>6,5</b> ó</span>')}${row(I('i-run'),'Futás · 1 edzés','','<span class="v"><b>6</b> kör</span>')}
    <div class="act"><button class="lk" data-sheet="custom">+ Saját edzés</button></div></section>`,'edzes','terheles');
}

/* ── SPORT ── */
function sport(tab='terv'){
  const seg=`<div class="segc rise">${[['terv','Heti terv'],['naplo','Napló'],['cross','Cross-load']].map(([k,l])=>`<button class="${k===tab?'on':''}" data-go="sport.${k}">${l}</button>`).join('')}</div>`;
  const B={terv:()=>`<section class="open rise" style="--i:3"><span class="eb">Heti ritmus · 7,5 ó</span>
      ${[['HÉT','','nincs session'],['KEDD','18:00 · 90p','Röpi edzés','BVSC csarnok'],['SZE','','nincs session'],['CSÜ','18:00 · 90p','Röpi edzés','BVSC csarnok','ma'],['PÉN','','nincs session'],['SZO','10:00 · 120p','Meccs · Kőbánya','Kőbánya Sport','egyszeri'],['VAS','','nincs session']].map(([d,t,n,loc,tg])=>t?row(`<span class="eb" style="width:38px">${d}</span>`,`${n}${tg?` <span class="st q">${tg}</span>`:''}`,`${t} · ${loc}`,`<button class="lk" data-sheet="sportlog">Logold</button>`):`<div class="ln muted"><span class="eb" style="width:38px">${d}</span><span class="g">nincs session</span></div>`).join('')}
      <div class="act"><button class="lk" data-toast="Heti rend szerkesztése">Szerkesztés</button></div></section>
    <section class="open rise" style="--i:4"><span class="eb">Események · tavasz · 2026</span>
      ${row(T('t-calendar'),'Meccs · BVSC – Kőbánya','szept 27. · 120 perc · Kőbánya Sport','<button class="lk" data-toast="Esemény törölve">törlés</button>')}${row(T('t-calendar'),'Edzőtábor · plusz edzés','okt 4. · 90 perc · BVSC csarnok','<button class="lk" data-toast="Esemény törölve">törlés</button>')}
      <div class="act"><button class="lk" data-toast="Új esemény">+ Esemény hozzáadása</button></div></section>`,
    naplo:()=>`<section class="open rise" style="--i:3"><span class="eb">Napló · utolsó 4 session · átlag 38 ugrás</span>
      ${[['Edzés','szept 23. · 18:00','90p',5,'6,8',72,6,'Smashek tisztábbak, a nyitás még ingadozik.'],['Meccs','szept 20. · 10:00','120p',4,'8,1',86,7,''],['Edzés','szept 18. · 18:00','90p',5,'6,5',64,5,'Könnyebb nap, sok technika.']].map(([t,d,m,s,r,int,v,q])=>`<div class="ln" style="display:block"><div style="display:flex;align-items:center;gap:12px">${I('i-ball')}<span class="g">Röpi · ${t}<small>${d} · ${m} · ${s} szett</small></span><span class="v"><b>${r}</b> RPE</span></div>
        <div class="kv" style="margin:8px 0 0 38px"><span class="l" style="font-size:12.5px;color:var(--sub)">Intenzitás</span><span class="v">${Math.round(int/10)}</span><div class="bar q"><b style="--w:${int}%"></b></div><span class="l" style="font-size:12.5px;color:var(--sub)">Váll-terhelés</span><span class="v">${v}</span><div class="bar q"><b style="--w:${v*10}%"></b></div></div>${q?`<p class="txt sub" style="margin:4px 0 0 38px">„${q}”</p>`:''}</div>`).join('')}</section>`,
    cross:()=>`<section class="open rise" style="--i:3"><div class="hero-cs" style="gap:10px;margin-bottom:6px">${csepp('ok',64,{s:28,form:'crystal',color:'#9AA3A8',alive:false})}<span class="eb" style="margin:0">Mezo · keresztrendszer hatások · a röpi és a gym egy héten</span></div>
      ${row(T('t-shield'),'Váll-plafon a csütörtöki Pull Day-en','A röpi előtti napon a Rear Delt Fly RIR 2 alatt nem megy.')}${row(I('i-clock'),'Időzítés','A szombati meccs előtt a láb-nap péntekről csütörtökre csúszhat.')}
      <p class="fn">A cross-load sosem büntet — plafont igazít és időzítést ajánl, döntést nem vesz el.</p></section>`}[tab]||(()=>'');
  return page(`${back('Mai','mai')}
  <section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Sport · BVSC · Felnőtt II.</span><button class="lk" data-go="sportlog">+ Log</button></div>${I('i-ball','art')}<h1 class="t">Sport</h1><div class="big" style="margin-top:4px"><span class="num">4</span><span class="v">/ 5 session a héten</span></div></section>
  <section class="open rise" style="--i:2;padding-top:4px"><div class="cells"><span><b>6,5 ó</b><small>pályán e héten</small></span><span><b>7,1</b><small>RPE átlag · 1–10</small></span><span><b>6,5</b><small>váll-terhelés</small></span></div></section>
  ${seg}${B()}
  ${tab!=='cross'?'<p class="fn p16 rise">A heti ritmus független a mezociklustól — a sport a saját rendjén fut.</p>':''}`,'edzes','mai');
}
const scale=v=>`<div class="scale">${Array.from({length:10},(_,i)=>`<button class="${i+1<v?'f':i+1===v?'a':''}" data-ez="scale:${i+1}">${i+1}</button>`).join('')}</div>`;
const stp=(l,v,sub='')=>row('',l,sub,`<span class="stp"><button data-toast="−">−</button><b>${v}</b><button data-toast="+">+</button></span>`);
function sportlog(arg){
  if(!arg)return bare(`${back('Mai','mai')}<div class="p16 rise"><span class="eb">Naplózás</span><h1 class="t">Mi volt ma mozgás?</h1><p class="txt sub" style="margin-top:6px">Válaszd ki, mit csináltál. A következő lapon csak azt kérdezem, ami annál a sportnál tényleg számít.</p></div>
    <section class="open rise" style="--i:1">${SPORTS.map(([ic,l],i)=>row(T(ic),l,'',chev,`data-go="sportlog.${i}"`)).join('')}</section>`);
  const [ic,l]=SPORTS[+arg]||SPORTS[0];
  return bare(`${back('Vissza','sportlog')}<div class="p16 rise"><div class="hero-cs" style="gap:12px">${T(ic)}<span><span class="eb">Naplózás · ma</span><h1 class="t" style="font-size:24px">${l}</h1></span></div></div>
  <div class="segc rise"><button class="on">Edzés</button><button data-toast="Meccs mód">Meccs</button></div>
  <section class="open rise" style="--i:1;border-top:0">${stp('Időtartam · perc',90)}
    <div class="ln" style="display:block"><span class="g">Megélt terhelés (RPE)</span>${scale(7)}</div>
    <div class="ln" style="display:block"><span class="g">Vállterhelés</span><div class="ch2">${['kicsi','közepes','nagy'].map((x,i)=>`<button class="${i===1?'on':''}" data-ez="chip">${x}</button>`).join('')}</div></div>
    ${stp('Játszott szettek',5)}
    ${row(T('t-plate'),'Kalória: becslést mentünk','~620 kcal · a súlyod és az időtartam alapján','<button class="lk" data-toast="Saját érték">Saját érték</button>')}</section>`,{pad:'120px'})
  +`<div class="foot rise"><button class="btn" data-ez="sportsave">${T(ic)}Naplózom · 90 perc</button></div>`;
}

/* ── FUTÁS ── */
function futas(tab='het'){
  const seg=`<div class="segc rise">${[['het','E heti edzés'],['naplo','Napló'],['tervek','Tervek']].map(([k,l])=>`<button class="${k===tab?'on':''}" data-go="futas.${k}">${l}</button>`).join('')}</div>`;
  const B={het:()=>`<section class="open rise" style="--i:3"><span class="eb">Sprint-állóképesség röpihez</span><p class="txt"><b>Robbanékonyság 01</b> · építő fázis · 3. hét a 8-ból</p><div class="wkb">${Array.from({length:8},(_,i)=>`<i class="${i<2?'d':i===2?'n':''}">${i+1}</i>`).join('')}</div></section>
    <section class="open rise" style="--i:4"><span class="eb">E heti edzés · 1 / 2 kész</span>
      ${[['Sprint-intervallum','kedd · 18:00',1,'5p bemelegítés · 6× 15 mp · 45 mp séta · 5p levezetés'],['Piramis-intervallum','péntek · 17:30',0,'5p bemelegítés · 15–30–45–30–15 mp · pihenő = szakasz × 2 · 5p levezetés']].map(([n,d,ok,s])=>row(I('i-run'),n,`${d} · ${s}`,ok?'<span class="st q">Kész</span>':'<button class="lk" data-sheet="runlog">Naplózd</button>')).join('')}</section>
    <section class="open rise" style="--i:5"><span class="eb">Keresztterhelés · futás és röpi egy héten</span>${row(I('i-clock'),'A pénteki piramis','a szombati meccs előtt könnyített változatban fut.')}</section>`,
    naplo:()=>`<section class="open rise" style="--i:3"><span class="eb">Pulzus-megnyugvás · utolsó 6 futás</span><div class="big"><span class="num">−16</span><span class="v">mp az első óta · a trend lefelé tart</span></div>${trend([58,54,51,49,46,42])}<p class="fn">A vonal a simított irány, a pontok az egyes futások. Mp a nyugalmi pulzusig — alacsonyabb = jobb regeneráció.</p></section>
    <section class="open rise" style="--i:4"><span class="eb">Napló · utolsó 3 futás</span>${[['szept 23.','Sprint',9,6,42],['szept 19.','Piramis',8,5,46],['szept 16.','Sprint',9,6,49]].map(([d,t,r,k,h])=>row(I('i-run'),`${t}-intervallum`,`${d} · RPE ${r} · ${k} kör`,`<span class="v"><b>${h}</b> mp pulzus</span>`)).join('')}</section>`,
    tervek:()=>`<section class="open rise" style="--i:3"><span class="eb">Aktív · 1</span>${row(I('i-run'),'Robbanékonyság 01','szept 8. – nov 2. · 8 hét · 2× / hét',chev,`data-go="futasterv"`)}
      <span class="eb" style="margin-top:12px">Tervezett · 1</span>${row(T('t-calendar'),'5K-alapozó','nov 9.-től · 6 hét',chev,`data-go="futasterv"`)}
      <span class="eb" style="margin-top:12px">Archív · 1</span>${row(T('t-history'),'Téli base 02','jan–márc',chev,`data-go="futasterv"`)}</section>`}[tab]||(()=>'');
  return page(`${back('Mai','mai')}
  <section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Futás · Robbanékonyság 01</span>${tab==='tervek'?'<button class="lk" data-go="futasterv">+ Új terv</button>':''}</div>${I('i-run','art')}<h1 class="t">Futás</h1><div class="big" style="margin-top:4px"><span class="num">3</span><span class="v">/ 8 hét a blokkból</span></div></section>
  <section class="open rise" style="--i:2;padding-top:4px"><div class="cells"><span><b>1/2</b><small>e heti edzés</small></span><span><b>2×</b><small>/ hét</small></span><span><b>8 hét</b><small>blokk</small></span></div></section>
  ${seg}${B()}`,'edzes','terv');
}
function futasterv(){
  return page(`<div class="backrow rise" style="display:flex;justify-content:space-between;align-items:center"><button class="backbtn" data-go="futas.tervek"><b>‹</b>Futás</button><button class="rb" data-sheet="blkmenu" aria-label="Menü">⋯</button></div>
  <div class="p16 rise"><span class="eb">Edzés · futás</span><h1 class="t">Robbanékonyság 01</h1><p class="txt sub" style="margin-top:4px">Aktív · 3. hét / 8 · ${L('i-check')} mentve</p></div>
  <section class="open rise" style="--i:1"><span class="eb">Terv neve</span><div class="fld">Robbanékonyság 01</div><span class="eb" style="margin-top:12px">Cél (pl. sprint-állóképesség)</span><div class="fld">sprint-állóképesség röpihez</div>${stp('Hetek · 1–8',8)}</section>
  <section class="open rise" style="--i:2"><span class="eb">Hetek</span>${[1,2,3].map(w=>row('',`${w}. hét`,'6 kör · 45 mp pihenő · 5p bemelegítés · 6× 15 mp · 5p levezetés','<button class="lk" data-toast="Szakasz hozzáadása">+ szakasz</button>')).join('')}</section>
  <div class="p16 rise" style="--i:3;margin-top:10px"><button class="btn wide" data-toast="Lezárás">Lezárás</button></div>`,'edzes','terv');
}

/* ── MEDÁLOK · GYAKORLATOK ── */
function medals(arg){
  const head=`${back('Gyakorlatok','exercises')}<section class="hero hg rise" style="--i:1;--c:#CFA14A"><div class="top"><span class="eb">Medálok</span></div>${T('t-record','art')}<div class="big" style="margin-top:4px"><span class="num">${arg==='ures'?0:14}</span><span class="v">${arg==='ures'?'medál':'medál · ebből 5 e hónapban'}</span></div></section>`;
  if(arg==='ures')return page(`${head}<section class="open rise" style="--i:2"><p class="txt sub">Még nincs medálod — az első megdöntött rekord ide kerül.</p></section>`,'edzes','exercises');
  const G=[['Szept 24.',[['r','Húzódzkodás (súlyozott)','Súly-rekord','12,5 kg','előző: 10 kg · szept 17. óta állt'],['r','Döntött törzsű evezés','Rep-rekord','10 @ 72,5','előző: 9 · szept 10. óta állt'],['c','Vállemelés','Cél teljesítve','30 × 15','3 célszett']]],['Szept 17.',[['r','Döntött törzsű evezés','1RM-rekord','96,7 kg','előző: 94,0 kg · szept 3. óta állt'],['r','Kalapácsbicepsz','Súly-rekord','16 kg','előző: 14 kg · jún 22. óta állt']]]];
  return page(`${head}<p class="fn p16 rise" style="--i:2;margin-top:0">A medálok visszamenőleg, a korábban logolt szetteid alapján épültek fel — nem mindegyiket élőben szerezted.</p>
  ${G.map(([d,rows],gi)=>`<section class="open rise" style="--i:${gi+3}"><span class="eb">${d}</span>${rows.map(([t,n,l,v,p])=>row(T(t==='c'?'t-tick':'t-record'),n,`${l} · ${p}`,`<span class="v"><b>${v}</b></span>`)).join('')}</section>`).join('')}`,'edzes','exercises');
}
function exercises(){
  return page(`<section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Gyakorlatok</span></div>${I('i-muscle','art')}<h1 class="t">A mozdulataid</h1><p class="txt sub" style="margin-top:6px;max-width:250px">42 gyakorlat · 18 rekorddal · <button class="lk" data-go="medals">14 medál</button></p></section>
  <div class="srch rise" style="--i:2" data-toast="Keresés">${L('i-list')}Keresés névre vagy izomra…</div>
  <div class="ch2 rise p16" style="--i:2;margin-top:10px">${['Mind','Mell','Hát','Váll','Kar','Láb','Core'].map((l,i)=>`<button class="${i?'':'on'}" data-ez="chip">${l}</button>`).join('')}</div>
  <section class="open rise" style="--i:3">${GY.map(([n,k,rm,m])=>row(mchp(k,'sm'),n,muscleLabel(k),rm?`<span class="v"><b>${rm} kg</b> 1RM${m?` · ${m} medál`:''}</span>${chev}`:`<span class="v">még nincs naplózva</span>${chev}`,`data-go="exercise"`)).join('')}
    <div class="act"><button class="lk" data-toast="Új gyakorlat lap">+ Új gyakorlat</button></div></section>`,'edzes','exercises');
}
function exercise(){
  const sim=LIB.filter(x=>x[1]==='back-mid').slice(0,3);
  return page(`${back('Gyakorlatok','exercises')}
  <section class="hero hg rise" style="--i:1;--c:${muscleColor('back-mid')}"><div class="hero-cs">${mchp('back-mid')}<span><span class="eb">Hát (közép) · saját</span><h1 class="t" style="font-size:24px">Döntött törzsű evezés</h1><p class="txt sub">24 alkalom · márc 4. óta · 12,4 t összsúly</p></span></div></section>
  <section class="open rise" style="--i:2"><span class="eb">Rekordjaid <button class="lk" data-toast="A rekordok magyarázata">mi ez?</button></span><div class="cells"><span><b>96,7 kg</b><small>becsült 1RM · becslés</small></span><span><b>77,5×8</b><small>legjobb szett · aug 28.</small></span><span><b>2 175 kg</b><small>legtöbb volumen · szept 24.</small></span></div>
    <p class="verdict" style="font-size:16px;margin-top:12px">Következő cél: 77,5 kg × 8 — a legjobb szetted, most RIR 2-vel.</p></section>
  <section class="open rise" style="--i:3"><span class="eb">Az erőd íve · becsült 1RM · márc → szept</span>${trend([80,83,86,84,89,92,94,96.7],{c:muscleColor('back-mid')})}<p class="fn">A vonal a simított irány, a pontok az egyes alkalmak.</p></section>
  <section class="open rise" style="--i:4"><span class="eb">Technika</span>${row(I('i-book'),'Beállás · Végrehajtás · Gyakori hibák','a mozdulat három lépésben',chev,`data-sheet="tech" data-arg="1"`)}${row(T('t-camera'),'Demó videó','',chev,`data-toast="Demó videó"`)}</section>
  <section class="open rise" style="--i:5"><span class="eb">Alternatívák · ugyanarra az izomra</span>${sim.map(([n,k,t,last])=>row(mchp(k,'sm'),n,`${t==='compound'?'összetett':'izolált'}${last?` · múltkor ${last}`:' · még nem csináltad'}`,chev,`data-toast="${esc(n)} — csere az edzés közben a ⋮ menüből"`)).join('')}</section>
  <section class="open rise" style="--i:6"><span class="eb">Medáljaid</span>${row(T('t-record'),'Rep-rekord','szept 24.','<span class="v"><b>10 @ 72,5</b></span>')}${row(T('t-record'),'1RM-rekord','szept 17.','<span class="v"><b>96,7 kg</b></span>')}</section>
  <section class="open rise" style="--i:7"><span class="eb">Hol szerepel</span>${row(T('t-peak'),'A futó tervedben · csütörtök','',chev,`data-go="nap.csu"`)}${row(T('t-stack'),'Sablon a polcodon','',chev,`data-go="sablon"`)}</section>
  <section class="open rise" style="--i:8"><span class="eb">Gyakorlat kezelése</span>${row(T('t-note'),'Szerkesztés','név, izom, típus — és a törlés',chev,`data-toast="Szerkesztés lap"`)}</section>`,'edzes','exercises');
}

/* ── TERV ── */
const kgTxt=v=>v===0?'saját testsúly':kg(v)+' kg';
const dayState=d=>d.d==='Csü'?'ma':d.done?'megvolt':'jön';
function dayRow(d){
  if(d.rest||d.sport)return `<div class="ln muted">${I(d.sport?'i-ball':'i-moon')}<span class="g">${d.full}<small>${d.sport?'röplabda · meccs':'pihenőnap'}</small></span></div>`;
  if(ST.km&&!d.done&&d.id!=='pen'&&DAYS.indexOf(d)>=DAYS.findIndex(x=>x.id===TODAY)&&!(d.id===TODAY&&ST.km.released))return `<div class="ln muted">${T('t-shield')}<span class="g">${d.full} · ${d.t}<small>kímélő mód · kimarad</small></span></div>`;
  const s=dayState(d),part=d.done&&d.done.sets<d.sets;
  const right=s==='megvolt'?`<span class="st q">${part?`Részben · ${d.done.sets}/${d.sets}`:'Megvolt'}</span>`:s==='ma'?'<span class="st plan">Ma</span>':'<span class="st q">Jön</span>';
  return `<div class="ln tap" data-go="nap.${d.id}"><span class="mus" style="margin:0;gap:2px;flex:0 0 auto">${d.mus.slice(0,3).map(([k])=>mchp(k,'xs')).join('')}</span><span class="g">${d.full} · <b>${d.t}</b><small>${d.done&&s==='megvolt'?`${d.done.sets} szett · ${d.done.min} perc${d.done.rec?` · ${d.done.rec} rekord`:''}`:`${d.sets} szett · ~${d.min} perc · ${d.ex.length} gyakorlat`}</small></span>${right}${chev}</div>`;
}
const dests=(withMuscle)=>`<section class="open rise" style="--i:4">${withMuscle?row(I('i-muscle'),'Melyik izmod hol tart',`${ROLL.length} izom kap többet hétfőtől`,chev,`data-go="het"`):''}${row(T('t-stack'),'Edzéstervek','amiből indíthatsz',chev,`data-go="konyvtar"`)}</section>`;
function terv(arg){
  if(arg==='ures'||arg==='nincs')ST.terv=arg;else if(arg==='fut')ST.terv='run';
  if(ST.terv!=='run'){const e=ST.terv==='ures';return page(`<section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Terv</span></div>${T('t-peak','art')}<h1 class="t">${e?'Még nincs edzésterved':'Most nem fut terv'}</h1><p class="txt sub" style="margin-top:6px;max-width:250px">${e?'Itt fognak élni a terveid — egy terv megmondja, melyik nap mit edzel, és hétről hétre mennyit.':'A terveid az Edzéstervek mögött várnak, és bármikor indíthatsz egy újat.'}</p>
      <div class="cta"><button class="btn" style="flex:1" data-go="ujterv">${T('t-flask')}Új terv összeállítása</button></div></section>
    <p class="txt sub p16 rise" style="--i:2">${e?'Állíts össze egyet — végigkérdezem, mi fér bele a hetedbe.':'Válassz a terveid közül, vagy csinálj újat.'}</p>${dests(false)}
    <p class="fn p16 rise">Demó: <button class="lk" data-go="terv.fut">futó terv</button> · <button class="lk" data-go="terv.ures">még nincs</button> · <button class="lk" data-go="terv.nincs">nem fut</button></p>`,'edzes','terv')}
  const toDeload=MESO.curve.indexOf('Deload')+1-MESO.week,rest=toDeload===0?' — és ez a hét maga a pihenőhét':toDeload===1?' — a jövő hét már pihenőhét':` — ${toDeload} hét múlva jön a pihenőhét`,ph=MESO.curve[MESO.week-1];
  return page(`<section class="hero hg rise tap" style="--i:1" data-go="run"><div class="top"><span class="eb">${MESO.name} · Tavasz · ${PHASE[ph]}</span>${chev}</div>
    <div class="big"><span class="num">${MESO.week}. hét</span><span class="v">/ ${MESO.of}</span></div>
    <p class="txt sub">A ${MESO.of} hétből a ${MESO.week}. héten jársz: ${WTOTAL} szett, ${DAYS.filter(x=>!x.rest&&!x.sport).length} edzésnapra osztva${rest}.</p>
    ${arc(MESO.week)}<div class="arcl" style="grid-template-columns:1fr 1fr;text-align:left;margin-top:2px"><span>${MESO.from}</span><span style="text-align:right">${MESO.to}</span></div></section>
  <section class="open rise" style="--i:2"><span class="eb">A heted · ${DAYS.filter(x=>!x.rest&&!x.sport).length} edzésnap</span>${DAYS.map(dayRow).join('')}</section>
  ${dests(true)}
  <section class="open rise" style="--i:5">${row(T('t-coin'),'Edzésterv lezárása',`ha ezt a ${MESO.of} hetet végigcsináltad`,chev,`data-sheet="close"`)}
    <p class="fn">Demó: <button class="lk" data-go="terv.ures">még nincs terv</button> · <button class="lk" data-go="terv.nincs">nem fut terv</button></p></section>`,'edzes','terv');
}
function run(){const ph=MESO.curve[MESO.week-1];
  return page(`${back('Terv','terv')}
  <div class="p16 rise"><span class="eb">Aktív · ${MESO.week} / ${MESO.of}. hét · ${PHASE[ph]} · vége ${MESO.to}</span><h1 class="t">${MESO.name} · Tavasz</h1></div>
  <section class="card hg rise" style="--i:1;margin-top:12px"><span class="eb">A terv íve · ${MESO.split}</span>${arc(MESO.week,WEEK_SETS)}<p class="txt sub" style="margin-top:10px">Az 5. hét a csúcs, a 6. a pihenőhét — akkor szándékosan kevesebbet kérek tőled.</p></section>
  <section class="open rise" style="--i:2"><div class="hero-cs" style="gap:10px;margin-bottom:6px">${csepp('ok',64,{s:28,form:'crystal',color:'#9AA3A8',alive:false})}<span class="eb" style="margin:0">Mezo jegyzete</span></div><p class="txt">„A hátad bírta a múlt heti emelést, ezért kapott még két szettet. A vállad marad, amíg a jobb oldali nyilallás el nem múlik.”</p></section>
  <section class="open rise" style="--i:3">${row(I('i-muscle'),'Heti vizsgálat','melyik izmod hol tart',`<span class="mini">${WMUS.slice(0,7).map(m=>`<i style="--c:${muscleColor(m[1])};--h:${clamp(m[2]/m[5]*100,14,100)}%"></i>`).join('')}</span>${chev}`,`data-go="het"`)}
    ${row(T('t-calendar'),'Hétfőn jön · előrejelzés',ROLL.map(n=>`${n} +2 szett`).join(' · '))}</section>
  <section class="open rise" style="--i:4"><span class="eb">A heted · ${DAYS.filter(x=>!x.rest&&!x.sport).length} edzésnap</span>${DAYS.map(dayRow).join('')}</section>
  <section class="open rise" style="--i:5">${row(T('t-coin'),'Edzésterv lezárása','lezárás után riportot kapsz róla',chev,`data-sheet="close"`)}<p class="fn">A terv oldala állapot-első. A szerkesztés egy szinttel lejjebb, a napoknál van.</p></section>`,'edzes','terv');
}
const BACKSIDE=['ham','glute','calf','back-mid','back-wide','back-lower','traps','shoulder-rear'];
const dayView=d=>d.mus.filter(([k])=>BACKSIDE.includes(k)).length>d.mus.length/2?'back':'front';
function nap(id){const d=DAYS.find(x=>x.id===id)||DAYS.find(x=>x.id===TODAY);
  if(d.rest||d.sport)return page(`${back('Terv','terv')}<section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">${d.full}</span></div>${I(d.sport?'i-ball':'i-moon','art')}<h1 class="t">${d.t}</h1><p class="txt sub" style="margin-top:6px;max-width:250px">${d.sport?'Ezen a napon sportolsz, nem a terv szerint edzel. A meccs a Mai fülön naplózható.':'Ezen a napon nem kérek tőled semmit. A pihenés is a terv része.'}</p></section><p class="fn p16 rise">Egy hét a pihenőnapjaival együtt egész — ezért látszanak itt is.</p>`,'edzes','terv');
  const share=Math.round(d.sets/WTOTAL*100);
  return page(`<div class="backrow rise" style="display:flex;justify-content:space-between;align-items:center"><button class="backbtn" data-go="terv"><b>‹</b>Terv</button><button class="lk" data-go="napszerk">Szerkesztés</button></div>
  <section class="hero hg rise" style="--i:1;--c:${muscleColor(d.mus[0][0])}"><div class="hero-cs" style="gap:14px">${heat(dayView(d),d.mus.map(([k])=>[k,.85]),'lg')}<span style="flex:1"><span class="eb">${d.full}</span><h1 class="t" style="font-size:26px">${d.t}</h1><div class="big"><span class="num" style="font-size:30px">${d.sets}</span><span class="v">munkaszett</span></div><p class="txt sub">${d.min} perc · ${d.ex.length} gyakorlat · a heted ${share}%-a</p></span></div></section>
  <section class="open rise" style="--i:2"><span class="eb">Amit ezen a napon megdolgozol</span>${d.mus.map(([k,s])=>`<div class="ln">${mchp(k,'sm')}<span class="g">${muscleLabel(k)}</span><span class="v"><b>${s}</b> szett</span><div class="bar" style="--c:${muscleColor(k)}"><b style="--w:${clamp(s/10*100,6,100)}%"></b></div></div>`).join('')}</section>
  <section class="open rise" style="--i:3"><span class="eb">A gyakorlatok · olvasható előírás</span>${d.ex.map(([n,k,ws,rep,rir,wu,w,warn],i)=>row(mchp(k,'sm'),`${i+1}. ${n}`,`<b>${ws}×${rep}</b> · RIR ${rir} · induló ${kgTxt(w)} · ${wu} bemelegítő${warn?`<br>${T('t-info')} ${warn}`:''}`)).join('')}
    <div class="act"><button class="lk" data-go="napszerk">+ Gyakorlat hozzáadása</button><button class="lk" data-go="napszerk">A nap szerkesztése</button></div><p class="fn">Ez az oldal csak olvas. Minden szerkesztés a nap saját szerkesztőjében történik.</p></section>`,'edzes','terv');
}
function napszerk(){const d=DAYS.find(x=>x.id===TODAY);
  return page(`${back(d.full,'nap.'+d.id)}<div class="p16 rise"><span class="eb">${d.full} · ${d.t} · ${d.sets} szett</span><h1 class="t" style="font-size:24px">A nap szerkesztése</h1><p class="txt sub" style="margin-top:4px">Húzd a sorokat a sorrendhez. Minden változás azonnal mentődik.</p></div>
  <section class="open rise" style="--i:1">${d.ex.map(([n,k,ws,rep,rir,wu,w])=>`<div class="ln"><span class="grip">⠿</span>${mchp(k,'sm')}<span class="g">${n}<small>${ws} szett · ${rep} ism. · RIR ${rir} · ${kgTxt(w)}</small></span><button class="rb" data-toast="Sor műveletei">⋮</button></div>`).join('')}
    <div class="act"><button class="lk" data-toast="Gyakorlat-választó">+ Gyakorlat hozzáadása</button></div>
    <p class="fn">A terv heti szett-számai automatikusan követik, amit itt átírsz — a „Melyik izmod hol tart” oldal ugyanabból olvas. Ugyanez a szerkesztő nyílik a sablonok napjainál is.</p></section>`,'edzes','terv');
}
function het(){const rows=[...WMUS].sort((a,b)=>(b[5]-b[2])-(a[5]-a[2])),under=WMUS.filter(m=>m[2]<m[3]).length,top=WMUS.filter(m=>m[2]>=m[5]).length,growing=WMUS.length-under-top;
  return page(`${back('Terv','terv')}
  <section class="hero hg rise" style="--i:1"><div class="hero-cs" style="gap:14px"><span class="duo">${heat('front',WMUS.map(m=>[m[1],clamp(m[2]/m[5],.18,.9)]))}${heat('back',WMUS.map(m=>[m[1],clamp(m[2]/m[5],.18,.9)]))}</span><span style="flex:1"><span class="eb">Ezen a héten</span><div class="big"><span class="num">${WTOTAL}</span><span class="v">szett</span></div><p class="txt sub">${growing} izmod fejlődő tartományban van, ${under} még nem éri el azt a szintet, ahonnan fejlődik, ${top?top+' a felső értékén':'egy sincs a felső értékén'}. A múlt héthez képest 14 szettel több.</p></span></div></section>
  <section class="open rise" style="--i:2">${row(T('t-calendar'),'Hétfőtől változik',`${ROLL.join(', ')} kap még két-két szettet. A többi marad.`)}</section>
  <section class="open rise" style="--i:3"><span class="eb">Izmonként · ami még fér bele, elöl</span>${rows.map(m=>{const [n,k,s,mev,mav,mrv]=m,room=mrv-s,tier=s<mev?'Építés':s>=mav?'Hangsúly':'Tartás';const say=s<mev?`Még nem éri el azt a szintet, ahonnan fejlődik — ${mev-s} szett hiányzik.`:room<=0?'Elérte a felső értéket ebben a tervben.':s>=mav?`Még ${room} szett fér bele.`:`Szinten tartod — még ${room} szett fér bele.`;
    return `<div class="ln tap" data-go="izom.${k}">${mchp(k,'sm')}<span class="g">${n} <span class="eb" style="display:inline;margin-left:4px">${tier}</span><small>${say}</small></span><span class="v"><b>${s}</b> / ${mrv}</span><div class="bar ${room<=0?'q':''}" style="--c:${muscleColor(k)}"><b style="--w:${clamp(s/mrv*100,4,100)}%"></b></div></div>`}).join('')}
    <p class="fn">Százalékot nem írunk ki: a hely szettben van megmondva, és rajzban megmutatva.</p></section>`,'edzes','terv');
}
function izom(key){const m=WMUS.find(x=>x[1]===key)||WMUS[0],[n,k,s,mev,mav,mrv]=m,c=muscleColor(k),pos=v=>clamp(v/mrv*100,0,100),days=DAYS.filter(d=>!d.rest&&!d.sport&&d.mus.some(([mk])=>mk===k)),a=[Math.round(s*.72),Math.round(s*.82),s,s,Math.round(s*1.15),Math.round(s*.5)];
  return page(`${back('Heti vizsgálat','het')}
  <section class="hero hg rise" style="--i:1;--c:${c}"><div class="hero-cs" style="gap:14px">${heat(TOKEN_SHAPES[k][0][0],[[k,.9]],'lg')}<span style="flex:1"><span class="eb">${n}</span><div class="big"><span class="num">${s}</span><span class="v">szett / hét</span></div><p class="txt sub">${s<mev?'Ennyiből még nem fejlődik — kevesebb, mint amennyitől elindul.':s>=mrv?'A felső értéken jár: ebben a tervben ennél többet nem kérek tőle.':'Fejlődő tartományban van.'} Hétfőtől ${ROLL.includes(n)?'+2 szettet kap.':'marad ennyi.'}</p></span></div></section>
  <section class="open rise" style="--i:2;padding-top:4px"><div class="cells"><span><b>${days.length}</b><small>edzés / hét</small></span><span><b>${a[0]}</b><small>az első héten</small></span><span><b>${Math.max(...a)}</b><small>a legtöbb ebben a tervben</small></span></div></section>
  <section class="open rise" style="--i:3"><span class="eb">Hol tart</span><div class="gauge" style="--c:${c}"><span class="fill" style="--w:${pos(s)}%"></span><span class="mk" style="--x:${pos(mev)}%"></span><span class="pin" style="--x:${pos(s)}%">${s} szett · most</span><span class="cap" style="--x:${pos(mev)}%">ennyitől fejlődik</span><span class="cap" style="--x:100%;transform:translateX(-100%)">felső érték</span></div></section>
  <section class="open rise" style="--i:4"><span class="eb">A terv íve erre az izomra</span>${arc(MESO.week,a)}</section>
  <section class="open rise" style="--i:5"><span class="eb">Hol dolgozik</span>${days.map(d=>row(mchp(k,'sm'),`${d.full} · ${d.t}`,d.ex.filter(e=>e[1]===k).map(e=>e[0]).join(' · '),`<span class="v"><b>${d.mus.find(([mk])=>mk===k)[1]}</b> szett</span>${chev}`,`data-go="nap.${d.id}"`)).join('')}</section>
  <section class="open rise" style="--i:6"><span class="eb">Honnan jön ez a szám</span>${[['Alap ajánlás',`RP guidelines · haladó: ${mev}–${mrv} szett hetente`],['A terv íve',`a ${MESO.week}. hét ${PHASE[MESO.curve[MESO.week-1]].toLowerCase()}-szakasza`],['A te visszajelzéseid',`a múlt heti szett-visszajelzések alapján ${ROLL.includes(n)?'emelhető':'marad'}`],['A napokra osztás',`${days.length} edzésnapra elosztva`]].map(([t,s2],i)=>row(`<span class="eb" style="width:16px">${i+1}</span>`,t,s2)).join('')}</section>
  <section class="open rise" style="--i:7"><span class="eb">A mostani tervedhez képest</span><div class="ln"><span class="g">Előző terv</span><span class="v"><b>${Math.round(s*.85)}</b></span><div class="bar q"><b style="--w:${pos(Math.round(s*.85))}%"></b></div></div><div class="ln"><span class="g">Most</span><span class="v"><b>${s}</b></span><div class="bar" style="--c:${c}"><b style="--w:${pos(s)}%"></b></div></div>
    <p class="fn">A kevesebb nem rosszabb: ha egy izom kevesebbet kap, máshová került a hangsúly. Ugyanezt a számot olvassa a terv oldala és a heti vizsgálat is.</p></section>`,'edzes','terv');
}
function konyvtar(){const now=RUNS.filter(r=>r.st==='fut'),next=RUNS.filter(r=>r.st==='következik');
  return page(`${back('Terv','terv')}<div class="p16 rise"><span class="eb">Edzéstervek · 1 fut · ${next.length} következik · ${TPL.length} sablon · ${CLOSED.length} lezárva</span><h1 class="t">Amiből indíthatsz</h1><p class="txt sub" style="margin-top:4px">Itt él minden terved: ami most fut, ami utána következik, a sablonjaid és amit már lezártál.</p></div>
  <section class="open rise" style="--i:1"><span class="eb">Most fut</span>${now.map(r=>row(T('t-peak'),r.n,`${r.split} · ${r.from} – ${r.to} · ${WTOTAL} szett e héten`,`<span class="v"><b>${r.wk}</b> / ${r.weeks}. hét</span>${chev}`,`data-go="run"`)).join('')}</section>
  <section class="open rise" style="--i:2"><span class="eb">Következnek · ${next.length} terv</span>${next.map((r,i)=>row(T('t-calendar'),r.n,`${r.split}${i===0?' · a futó terv után kezdődik':''} · ${r.weeks} hét · vége ${r.to}`,`<span class="v">${r.from}-tól</span>${chev}`,`data-toast="A terv saját oldala — onnan indítható, dátummal"`)).join('')}
    <div class="act"><button class="btn sm" data-go="ujterv">${T('t-flask')}Új terv összeállítása</button></div></section>
  <section class="open rise" style="--i:3">${row(T('t-protocol'),'Sablonjaid',`${TPL.length} recept, amiből futam indul`,chev,`data-go="sablonok"`)}${row(T('t-history'),'Lezárt futamaid',`${CLOSED.length} befejezett terv`,chev,`data-go="futamok"`)}
    <p class="fn">Egy következő terv nem innen indul: a saját oldalán van a dátumozott indítás, hogy a futó terved ne álljon le véletlenül.</p></section>`,'edzes','terv');
}
function futamok(){const weeks=CLOSED.reduce((s,r)=>s+r.weeks,0),cm=ST.cmp;
  return page(`${back('Edzéstervek','konyvtar')}<div class="p16 rise"><span class="eb">Lezárt futamaid · ${CLOSED.length} futam · ${weeks} hét${cm?' · összevetés-mód':''}</span><h1 class="t">Amit már végigcsináltál</h1><p class="txt sub" style="margin-top:4px">${CLOSED.length} lezárt terv, összesen ${weeks} hétnyi edzés. Mindegyiknek van egy befagyasztott riportja.</p></div>
  <section class="open rise" style="--i:1"><span class="eb">Futamok <button class="lk" data-ez="cmp" style="margin-left:8px">${cm?'Mégsem':'Összevetés'}</button></span>${cm?'<p class="txt sub">Válassz ki kettőt — abban a sorrendben, ahogy összevetnéd őket.</p>':''}
    ${CLOSED.map((r,i)=>{const at=ST.cmpSel.indexOf(i);return `<div class="ln tap" ${cm?`data-ez="cmpsel:${i}"`:`data-go="riport"`}>${cm?`<span class="tk ${at>=0?'on':''}">${at>=0?`<b>${at+1}</b>`:''}</span>`:T('t-scroll')}<span class="g">${r.n}<small>${r.from} – ${r.to} · ${r.weeks} hét · ${r.pct}% teljesített edzés · ${r.rep?'riport kész':'riport nélkül'}</small></span>${cm?'':chev}</div>
      ${cm?'':`<div class="act" style="margin:-2px 0 8px 38px"><button class="lk" data-toast="Újrafuttatás — ebből a futamból új terv indul">Újrafuttatás</button><button class="lk" data-toast="Sablonná mentve">Sablonná</button></div>`}`}).join('')}
    ${cm&&ST.cmpSel.length===2?`<div class="act"><button class="btn sm" data-go="osszevetes">${T('t-trend')}Összevetés megnyitása</button></div>`:''}
    <p class="fn">Ami itt nincs kiírva (edzésszám, rekordok), az a riportban él — egy listáért nem kérünk le annyi adatot.</p></section>`,'edzes','terv');
}
function riport(){const r=CLOSED[1];
  return page(`${back('Lezárt futamaid','futamok')}
  <section class="hero hg rise" style="--i:1;--c:#CFA14A"><div class="top"><span class="eb">Lezárt futam · ${r.from} – ${r.to} · ${r.weeks} hét</span>${mini(r.pct/100)}</div><h1 class="t" style="font-size:24px">${r.n}</h1><div class="big" style="margin-top:6px"><span class="num">${r.pct}</span><span class="v">% · a teljesített edzések aránya</span></div><div class="bar q" style="margin-top:8px"><b style="--w:${r.pct}%"></b></div><p class="fn">Ez a riport a lezáráskor készült pillanatkép — azóta nem változik.</p></section>
  <section class="open rise" style="--i:2"><span class="eb">Ami erőben változott</span>${[['Guggolás','quad','+7,5 kg','+4,2%'],['Döntött törzsű evezés','back-mid','+5 kg','+3,1%'],['Fekvenyomás','chest-mid','0 kg','+2,4%'],['Román felhúzás','ham','+10 kg','+5,0%']].map(x=>row(mchp(x[1],'sm'),x[0],x[2]==='0 kg'?'ugyanannyi súly, több ismétlés':'a legnehezebb szett súlya',`<span class="v"><b>${x[3]}</b> · ${x[2]}</span>`)).join('')}
    <p class="fn">A kilogramm a legnehezebb szett súlyának változása, a százalék a becsült maximumé — ezért lehet „ugyanannyi súly” mellett is pluszban.</p></section>
  <section class="open rise" style="--i:3"><span class="eb">Az izmok útja</span>${WMUS.slice(0,6).map(m=>`<div class="ln">${mchp(m[1],'sm')}<span class="g">${m[0]}</span><span class="v"><b>${m[2]}</b></span><div class="bar" style="--c:${muscleColor(m[1])}"><b style="--w:${clamp(m[2]/20*100,6,100)}%"></b></div></div>`).join('')}</section>
  <section class="open rise" style="--i:4"><span class="eb">A mostani tervedhez képest</span>${WMUS.slice(0,4).map(m=>`<div class="ln"><span class="g">${m[0]}<small>akkor ${m[2]-2} · most ${m[2]}</small></span><span class="v"><b>+2</b></span><div class="bar q"><b style="--w:${clamp((m[2]-2)/20*100,6,100)}%"></b></div></div>`).join('')}</section>
  <section class="open rise" style="--i:5"><span class="eb">Lezáráskor írtad</span><p class="txt">„Az utolsó két hét nehéz volt, de a guggolás végre nem fájt. A vállat kímélni kell a következőben.”</p>
    <div class="act"><button class="btn sm" data-toast="Új futam indul ebből">${T('t-play')}Újrafuttatás</button><button class="lk" data-toast="Riport újragenerálása">Újragenerálás</button></div><p class="fn">Amit a lezáráskor nem mértünk, azt itt nem találjuk ki utólag — inkább nem írjuk ki.</p></section>`,'edzes','terv');
}
function osszevetes(){const a=CLOSED[1],b=CLOSED[0];
  return page(`${back('Lezárt futamaid','futamok')}<div class="p16 rise"><span class="eb">Összevetés</span><h1 class="t">Két lezárt futam</h1><p class="txt sub" style="margin-top:4px">${a.n} és ${b.n} egymás mellett. A gyengébb oldal nincs megjelölve: ez két befejezett terv, nem ítélet.</p></div>
  <section class="open rise" style="--i:1"><div class="ln"><span class="g"></span><span class="v" style="min-width:72px;text-align:right">${a.n.split(' · ')[0]}</span><span class="v" style="min-width:72px;text-align:right">${b.n.split(' · ')[0]}</span></div>
    ${[['Teljesített edzés',a.pct+'%',b.pct+'%'],['Hossz',a.weeks+' hét',b.weeks+' hét'],['Heti szett (csúcs)','84','76'],['Rekord','6 db','4 db'],['Erő · guggolás','+4,2%','+2,1%']].map(r=>`<div class="ln"><span class="g">${r[0]}</span><span class="v" style="min-width:72px;text-align:right"><b>${r[1]}</b></span><span class="v" style="min-width:72px;text-align:right"><b>${r[2]}</b></span></div>`).join('')}
    <p class="fn">Ahol nincs adat, „–” áll, sosem 0 — a hiányzó mérés nem nulla eredmény. Nincs külön összevetés-adat: a két befagyasztott riportot rakjuk egymás mellé.</p></section>`,'edzes','terv');
}
function sablonok(){const runs=TPL.reduce((s,t)=>s+t.runs,0);
  return page(`${back('Edzéstervek','konyvtar')}<div class="p16 rise"><span class="eb">Sablonjaid · ${TPL.length} sablon · ${runs} futam indult belőlük</span><h1 class="t">A receptjeid</h1><p class="txt sub" style="margin-top:4px">Egy sablon egy hét felépítése. Ha tetszik, futamot indítasz belőle — a sablon közben érintetlen marad.</p></div>
  <section class="open rise" style="--i:1">${TPL.map(t=>`<div class="ln tap" data-go="sablon"><span class="mus" style="margin:0;gap:2px;flex:0 0 auto">${t.mus.slice(0,3).map(k=>mchp(k,'xs')).join('')}</span><span class="g">${t.n}<small>${t.split} · ${t.weeks} hét · ${t.days} nap / hét · ~${t.min} perc</small></span><span class="v">${t.runs?`<b>${t.runs}</b> futam`:'még nem futott'}</span>${chev}</div>`).join('')}
    <div class="act"><button class="btn sm" data-go="ujterv">${T('t-flask')}Új sablon összeállítása</button></div><p class="fn">A listán nincs törlés: a sablon saját oldalán van, ahol látod is, mit törölnél.</p></section>`,'edzes','terv');
}
function sablon(){const t=TPL[0];
  return page(`${back('Sablonjaid','sablonok')}
  <section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">${t.split}</span></div><h1 class="t" style="font-size:24px">${t.n}</h1><p class="txt sub" style="margin-top:4px">${t.weeks} hét × ${t.days} edzésnap. Ez a hét felépítése — a futam ebből készül.</p><div class="mus" style="gap:6px;margin-top:10px">${t.mus.map(k=>mchp(k,'sm')).join('')}</div></section>
  <section class="open rise" style="--i:2"><span class="eb">A hét felépítése · ${t.days} edzésnap</span>${DAYS.map(d=>d.rest||d.sport?`<div class="ln muted">${I(d.sport?'i-ball':'i-moon')}<span class="g">${d.full}<small>${d.sport?'röplabda · meccs':'pihenőnap'}</small></span></div>`:`<div class="ln" style="display:block"><div style="display:flex;align-items:center;gap:12px"><span class="g"><b>${d.full}</b> · ${d.t}</span><span class="v">${d.sets} szett · ~${d.min} perc</span></div>${d.ex.map(e=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0 0"><span class="mus" style="margin:0">${mchp(e[1],'xs')}</span><span class="g" style="font-size:12.5px">${e[0]}</span><span class="v">${e[2]}×${e[3]} · ${kgTxt(e[6])}</span></div>`).join('')}</div>`).join('')}</section>
  <section class="open rise" style="--i:3"><span class="eb">Heti szettek izmonként</span>${WMUS.slice(0,6).map(m=>`<div class="ln">${mchp(m[1],'sm')}<span class="g">${m[0]}</span><span class="v"><b>${m[2]}</b></span><div class="bar" style="--c:${muscleColor(m[1])}"><b style="--w:${clamp(m[2]/13*100,6,100)}%"></b></div></div>`).join('')}</section>
  <section class="open rise" style="--i:4"><span class="eb">Futamok ebből a sablonból</span>${row(T('t-peak'),'Hypertrophy 04 · Tavasz','most fut · 3 / 6. hét',chev,`data-go="run"`)}${row(T('t-scroll'),'Hypertrophy 03 · Ősz','lezárva · Nov 13',chev,`data-go="riport"`)}</section>
  <section class="open rise" style="--i:5"><div class="act" style="margin-top:0"><button class="btn" style="flex:1" data-sheet="start">${T('t-play')}Futam indítása ebből</button></div>
    <div class="act"><button class="lk" data-go="sablonszerk">Szerkesztés</button><button class="lk" data-toast="Másolat készült — a másolat szerkesztője nyílik">Másolat</button><button class="lk bad" data-sheet="tdel">Sablon törlése</button></div><p class="fn">A törlés a korábbi futamokat és a riportjaikat nem bántja — azok megmaradnak.</p></section>`,'edzes','terv');
}
function sablonszerk(){const d=DAYS[0];
  return page(`${back('Sablon','sablon')}<div class="p16 rise"><span class="eb">Sablon szerkesztése · Hypertrophy 04 · Tavasz</span><h1 class="t" style="font-size:24px">Hétfő · Push</h1><p class="txt sub" style="margin-top:4px">Ugyanaz a szerkesztő, mint a futó terv napjainál. Minden változás azonnal mentődik.</p></div>
  <div class="ch2 rise p16" style="--i:1;margin-top:8px">${DAYS.map((x,i)=>`<button class="${i===0?'on':''}" data-toast="${x.full} · ${x.t}">${x.d}</button>`).join('')}</div>
  <section class="open rise" style="--i:2">${d.ex.map(e=>`<div class="ln"><span class="grip">⠿</span>${mchp(e[1],'sm')}<span class="g">${e[0]}<small>${e[2]} szett · ${e[3]} ism. · RIR ${e[4]} · ${kgTxt(e[6])}</small></span><button class="rb" data-toast="Sor műveletei">⋮</button></div>`).join('')}
    <div class="act"><button class="lk" data-toast="Gyakorlat-választó">+ Gyakorlat hozzáadása</button></div><p class="fn">Egy feladatra egy felület: a sablon napja és a futó terv napja ugyanígy néz ki.</p></section>`,'edzes','terv');
}
function ujterv(step){const head=back('Edzéstervek','konyvtar');
  if(step==='gen')return page(`${head}<section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Összeállítás</span></div>${T('t-flask','art')}<h1 class="t">Rakom össze a heted</h1><p class="txt sub" style="margin-top:6px;max-width:250px">Kiszámolom, melyik nap mit edzel, és hétről hétre mennyit.</p></section>
    <section class="open rise" style="--i:2">${row(T('t-flask'),'Dolgozom rajta…','kb. 10 másodperc · nem kell itt maradnod')}<div class="act"><button class="btn sm" data-go="ujterv.kesz">Kész — mutasd a vázlatot</button></div></section>`,'edzes','terv');
  if(step==='kesz')return page(`${head}<div class="p16 rise"><span class="eb">A vázlatod · még nincs mentve</span><h1 class="t" style="font-size:24px">Nézd át, írd át</h1><p class="txt sub" style="margin-top:4px">Ami nem stimmel, azt írd át — csak utána mentsük el. A vázlat a memóriában él, amíg el nem mented.</p></div>
    <section class="open rise" style="--i:1">${DAYS.map(dayRow).join('')}<div class="act"><button class="btn sm" data-toast="Elmentve — a terv a Következnek listába került">${T('t-tick')}Mentés</button><button class="lk" data-go="ujterv">Újra kérdezz</button></div></section>`,'edzes','terv');
  const q=(eb,h,opts,on)=>`<section class="open rise"><span class="eb">${eb}</span><p class="txt">${h}</p><div class="ch2">${opts.map((o,i)=>`<button class="${i===on?'on':''}" data-ez="chip">${o}</button>`).join('')}</div></section>`;
  return page(`${head}<div class="p16 rise"><span class="eb">Új terv</span><h1 class="t">Pár kérdés, és összerakom</h1><p class="txt sub" style="margin-top:4px">Csak azt kérdezem meg, amit nem tudok kitalálni helyetted.</p></div>
  ${q('1 · Mennyi időre','Hány hét legyen?',['4 hét','5 hét','6 hét','7 hét','8 hét'],2)}<section class="open rise"><span class="eb">2 · Mikor érsz rá</span><p class="txt">Mely napokon edzel?</p><div class="ch2">${['H','K','Sze','Cs','P','Szo','V'].map((o,i)=>`<button class="${i<5?'on':''}" data-ez="chip">${o}</button>`).join('')}</div></section>
  ${q('3 · Mi a cél','Mire menjen ki a terv?',['Izomépítés','Erő','Fogyás mellett tartás'],0)}${q('4 · Mit kíméljünk','Van, ami most fáj?',['Semmi','Váll','Térd','Hát'],1)}
  <div class="p16 rise" style="margin-top:6px"><button class="btn wide" data-go="ujterv.gen">${T('t-flask')}Rakd össze</button><p class="fn">Az edzőtermi időpontjaidhoz nem nyúlok — azokat te állítod be.</p></div>`,'edzes','terv');
}

/* ── SAJÁT EDZÉS ── */
const sjKg=v=>v==null?'auto kg':`${kg(v)} kg`;
const sjSum=e=>`${e.w} szett · ${e.lo}–${e.hi} ism. · RIR ${e.rir} · ${sjKg(e.kg)}`;
function sjStep(i,f,lbl,v,min,max){const auto=f==='kg'&&v==null;
  return `<div class="ln" style="padding:6px 0"><span class="g" style="font-size:13px">${lbl}</span><span class="stp"><button data-ez="sjst:${i}|${f}|-1" ${f==='kg'?(auto?'disabled':''):(v<=min?'disabled':'')}>−</button><b class="${auto?'auto':''}">${auto?'auto':kg(v)}</b><button data-ez="sjst:${i}|${f}|1" ${f!=='kg'&&v>=max?'disabled':''}>+</button></span></div>`}
function sjRow(e,i){const o=ST.sj.open===i;
  return `<div class="ln tap" data-ez="sjopen:${i}"><span class="grip">⠿</span>${mchp(e.k,'sm')}<span class="g"><b>${e.n}</b><small>${muscleLabel(e.k)} · ${sjSum(e)}${e.warn?`<br>${T('t-info')} ${e.warn}`:''}</small></span><span class="chev" style="transform:rotate(${o?90:0}deg)">${chev}</span></div>
  ${o?`<div class="sjp"><span class="eb">Szettek</span>${sjStep(i,'bem','Bemelegítő',e.bem,0,10)}${sjStep(i,'w','Munka',e.w,1,10)}<span class="eb" style="margin-top:8px">Ismétlés</span>${sjStep(i,'lo','Tól',e.lo,1,e.hi)}${sjStep(i,'hi','Ig',e.hi,e.lo,100)}<span class="eb" style="margin-top:8px">Nehézség és súly</span>${sjStep(i,'rir','Tartalék (RIR)',e.rir,0,5)}${sjStep(i,'kg','Kiinduló kg',e.kg)}
    <div class="ln" style="padding:8px 0"><span class="g" style="font-size:13px">Számít a heti volumenbe</span><button class="sw ${e.vol?'on':''}" data-ez="sjvol:${i}" role="switch" aria-checked="${e.vol}"></button></div>
    <div class="act" style="margin-top:4px"><button class="lk" data-ez="sjmv:${i}|-1" ${i===0?'disabled':''}>Feljebb</button><button class="lk" data-ez="sjmv:${i}|1" ${i===ST.sj.ex.length-1?'disabled':''}>Lejjebb</button><button class="lk bad" data-ez="sjdel:${i}">Kivesz</button></div></div>`:''}`}
function sajat(id){
  if(id==='betolt')return page(`${back('Mai','mai')}<p class="txt sub p16 rise" style="padding-top:40px">Betöltés…</p>`,'edzes','mai');
  if(id==='nincs')return page(`${back('Mai','mai')}<p class="txt sub p16 rise" style="padding-top:40px">Ez a saját edzés nem található — lehet, hogy törölted.</p>`,'edzes','mai');
  const mode=id==='uj'?'new':'edit';if(mode!==ST.sjmode){ST.sjmode=mode;ST.sj=mode==='new'?{name:'',open:-1,ex:[]}:SJ0()}
  const sets=ST.sj.ex.reduce((a,e)=>a+e.w,0),ok=ST.sj.name.trim()&&ST.sj.ex.length;
  return page(`${back('Mai','mai')}<div class="p16 rise"><span class="eb">Saját edzés</span><h1 class="t">${mode==='new'?'Új saját edzés':'Saját edzés'}</h1><p class="txt sub" style="margin-top:4px">Összerakod, amit ma csinálni akarsz. Elmentheted későbbre, vagy egyből elindíthatod.</p></div>
  <section class="open rise" style="--i:1"><span class="eb">Edzés neve</span><input class="fld" id="sj-name" value="${ST.sj.name.replace(/"/g,'&quot;')}" placeholder="pl. Pihenőnapi felső" maxlength="120"></section>
  <section class="open rise" style="--i:2"><span class="eb">Gyakorlatok · ${ST.sj.ex.length} gyakorlat · ${sets} szett</span>
    ${ST.sj.ex.length?ST.sj.ex.map(sjRow).join(''):'<p class="txt sub">Még nincs gyakorlat. Add hozzá az elsőt — kap egy jó alapbeállítást, amit utána finomíthatsz.</p>'}
    <div class="act"><button class="lk" data-sheet="sjpick">+ Gyakorlat hozzáadása</button></div></section>
  <div class="p16 rise" style="--i:3;display:flex;gap:10px;margin-top:8px"><button class="btn" style="flex:1" data-ez="sjgo" ${ok?'':'disabled style="flex:1;opacity:.45"'}>${T('t-play')}Indítás ma</button><button class="btn ghost" style="flex:1" data-ez="sjsave" ${ok?'':'disabled style="flex:1;opacity:.45"'}>Mentés</button></div>
  ${ok?'':`<p class="fn p16" id="sj-hint">${ST.sj.name.trim()?'Adj hozzá legalább egy gyakorlatot.':'Adj nevet az edzésnek.'}</p>`}
  <p class="fn p16">Állapotok a demóhoz: <button class="lk" data-go="sajat.uj">új, üres</button> · <button class="lk" data-go="sajat">szerkesztés</button> · <button class="lk" data-go="sajat.betolt">betöltés</button> · <button class="lk" data-go="sajat.nincs">nem található</button></p>`,'edzes','mai');
}
function sjStepApply(i,f,d){const e=ST.sj.ex[i];if(f==='kg'){if(e.kg==null){if(d>0)e.kg=20}else{const n=Math.round((e.kg+d*2.5)*100)/100;e.kg=n<2.5?null:Math.min(999,n)}}else{const lim={bem:[0,10],w:[1,10],lo:[1,e.hi],hi:[e.lo,100],rir:[0,5]}[f];e[f]=Math.min(lim[1],Math.max(lim[0],e[f]+d))}}

/* ── TERHELÉS ── */
function terheles(){const pct=Math.round(LD_DONE/LD_PLAN*100);
  return page(`<section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Eddig a héten · 3. hét / 6</span><button class="lk" data-sheet="ido">Időpontok</button></div>
    <div class="big"><span class="num">${pct}</span><span class="v">% · ${LD_DONE} szett a betervezett ${LD_PLAN}-ból</span></div><div class="bar q" style="margin-top:8px"><b style="--w:${pct}%"></b></div>
    <p class="verdict" style="font-size:16px;margin-top:12px">Három hete emelkedik a heti szettszám: 52 → 61 → 75. Két edzésnapod van még hátra.</p>
    <div class="arc" style="height:48px">${WEEK_SETS.map((s,i)=>`<i class="${i+1<MESO.week?'past':i+1===MESO.week?'now':''} ${MESO.curve[i]==='Deload'?'deload':''}" style="--h:${s/84*100}%"></i>`).join('')}</div><div class="arcl">${WEEK_SETS.map((s,i)=>`<span>${i+1===MESO.week?`<b>${LD_DONE}/${s}</b>`:s}</span>`).join('')}</div>
    <p class="fn">Egy oszlop egy hét. Ami megvolt, elhallgat: szürke. A csíkos a pihenőhét.</p>
    <div class="act" style="margin-top:6px"><span class="txt sub" style="font-size:12.5px">3 edzés kész · 2 van hátra · 1 medál e héten</span></div></section>
  <section class="open rise" style="--i:2">${row(I('i-muscle'),'Izomtérkép','hol landolt a heti munka a testeden — elölről és hátulról',chev,`data-go="terkep"`)}</section>
  <section class="open rise" style="--i:3"><span class="eb">Izomcsoportonként · koppints a részletekért</span>
    ${LD_GROUPS.map((g,i)=>{const [n,k,done,plan,words]=g;return `<div class="ln tap" ${done?`data-sheet="tgrp" data-arg="${i}"`:`data-toast="${n} — ezen a héten nem volt ilyen munka"`}>${mchp(k,'sm')}<span class="g">${n}<small>${words}</small></span><span class="v"><b>${done}</b> / ${plan}</span><div class="bar ${!plan||done>=plan?'q':''}" style="--c:${muscleColor(k)}"><b style="--w:${plan?clamp(done/plan*100,2,100):0}%"></b></div></div>`}).join('')}</section>
  <section class="open rise" style="--i:4"><span class="eb">Ami a szetteken kívül volt</span>${row(I('i-ball'),'Röplabda · 2 alkalom','180 perc · szombat és kedd este','<span class="v"><b>1 240</b> kcal</span>')}${row(I('i-steps'),'Minden mozgásod','a terem és a sport egymás mellett — de sosem egy számba olvasztva',chev,`data-go="mozgas"`)}
    <p class="fn">A számok a már megcsinált edzésekből jönnek. A ma esti, még le nem naplózott edzés nem számít bele.</p></section>`,'edzes','terheles');
}
function terkep(mode){const planned=mode==='terv',ent=LD_GROUPS.filter(g=>g[2]||planned).map(g=>[g[1],planned?clamp(g[3]/29,.2,.9):clamp(g[2]/Math.max(g[3],1),.2,.9)]),cold=LD_GROUPS.filter(g=>!g[2]);
  return page(`${back('Terhelés','terheles')}<div class="p16 rise"><span class="eb">Izomtérkép · ${planned?'a heti terv':'eddig megvolt'}</span></div>
  <div class="segc rise"><button class="${planned?'':'on'}" data-go="terkep">Eddig megvolt</button><button class="${planned?'on':''}" data-go="terkep.terv">A heti terv</button></div>
  <section class="open rise" style="--i:1;border-top:0"><span class="duo xl">${heat('front',ent)}${heat('back',ent)}</span><p class="fn" style="text-align:center">Halvány = elkezdted · teli = megvan. A szín az izomcsoporté, nem ítélet.</p></section>
  ${cold.length?`<section class="open rise" style="--i:2"><span class="eb">Amihez nem nyúltál</span>${cold.map(g=>`<div class="ln muted">${mchp(g[1],'sm')}<span class="g">${g[0]}<small>ezen a héten nem volt ilyen munka</small></span></div>`).join('')}</section>`:''}
  <section class="open rise" style="--i:3">${row(T('t-pattern'),'Minden izomjel','a teljes izomlista, ahogy a rendszer ismeri',chev,`data-go="jelek"`)}<p class="fn">A röplabda is dolgoztat izmokat, de azt nem szettben mérjük — a térkép csak a termi munkát színezi.</p></section>`,'edzes','terheles');
}
function jelek(){const live=new Set(['chest-mid','chest-upper','back-wide','back-mid','shoulder-side','shoulder-front','shoulder-rear','triceps-medial','biceps-brachialis','quad','ham','calf']);
  return page(`${back('Izomtérkép','terkep')}<div class="p16 rise"><span class="eb">Minden izomjel · ${MUSCLES.length} izom, 6 régió</span><p class="txt sub" style="margin-top:4px">Ez a teljes lista, ahogy a rendszer ismeri az izmokat. Ami világít, azt tényleg megdolgoztad ezen a héten.</p></div>
  ${REGIONS.map((r,ri)=>`<section class="open rise" style="--i:${ri+1}"><span class="eb">${r.label}</span><div class="mmgrid">${MUSCLES.filter(m=>m.region===r.key).map(m=>`<div class="${live.has(m.key)?'':'dim'}">${mchp(m.key,'sm')}<span>${m.label}</span></div>`).join('')}</div></section>`).join('')}
  <p class="fn p16">Egy izom, amiről a heti napló nem tud, sötét marad — sosem találjuk ki, hogy biztosan dolgozott.</p>`,'edzes','terheles');
}
function mozgas(){
  return page(`${back('Terhelés','terheles')}<div class="p16 rise"><span class="eb">Minden mozgásod · eddig a héten</span><p class="txt sub" style="margin-top:4px">A terem és a sport külön oszlopban — mert az egyik becslés, a másik mért.</p></div>
  <section class="open rise" style="--i:1"><div class="gridx2"><div><span class="eb">${I('i-dumb')} Terem</span><div class="big"><span class="num">186</span><span class="v">perc</span></div><p class="txt sub">3 megcsinált edzés · becsült idő és kalória</p><div class="big"><span class="num" style="font-size:22px">~1 480</span><span class="v">kcal</span></div></div>
    <div><span class="eb">${I('i-ball')} Sport</span><div class="big"><span class="num">180</span><span class="v">perc</span></div><p class="txt sub">2 alkalom · valódi, naplózott idő</p><div class="big"><span class="num" style="font-size:22px">1 240</span><span class="v">kcal</span></div></div></div></section>
  <section class="open rise" style="--i:2"><span class="eb">Tételesen</span>${[['i-dumb','Hétfő · Push','16 szett · becsült 62 perc','~510 kcal'],['i-ball','Kedd este · Röplabda','edzés · 90 perc','610 kcal'],['i-dumb','Kedd · Legs A','12 szett · becsült 48 perc','~420 kcal'],['i-dumb','Szerda · Legs','19 szett · becsült 76 perc','~550 kcal'],['i-ball','Szombat · Röplabda','meccs · 90 perc','630 kcal']].map(r=>row(I(r[0]),r[1],r[2],`<span class="v"><b>${r[3]}</b></span>`)).join('')}
    <p class="fn">Ha egyetlen sport-alkalomnál hiányzik a kalória, az egész összeget elrejtjük — inkább semmit, mint kevesebbet.</p></section>`,'edzes','terheles');
}

/* ── LAPOK (alulról) ── */
const TECH={default:[['Beállás','Rögzített lapocka, semleges gerinc, a fogás vállszélességnél kicsit szélesebb.'],['Végrehajtás','Könyök hátra és le, a súlyt lassan engedd (2–3 mp). Fent egy pillanat szünet.'],['Gyakori hibák','Lendületből húzni · a vállat a fülhöz emelni · félúton megállni a negatívban.']]};
const two=(l,ez)=>`<div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-ez="${ez||'save'}">${l}</button><button class="lk" data-close>Mégse</button></div>`;
const SHEETS={
  why:whySheet,udv:udvSheet,
  menu:(g)=>{const gi=+(g||0),e=EX[gi]||EX[0],d=e.sets.filter(isDone).length;
    return `${shh('Gyakorlat')}<div class="hero-cs" style="gap:12px">${mchp(e.k)}<span><h2 class="t">${e.n}</h2><p class="txt sub">${e.sets.length} szett · ${muscleLabel(e.k)}</p></span></div>
    ${[[T('t-camera'),'Videó','a mozdulat bemutatója',`data-toast="Demó videó"`],[T('t-note'),'Jegyzet','forma-emlékeztető, beállítás…',`data-sheet="note"`],[T('t-weight'),'Szett hozzáadása',`most ${e.sets.length} szett van`,`data-sheet="extra"`],[T('t-weight'),'Szett elvétele','',`data-toast="Szett elvéve"`],[T('t-up'),'Előrébb','',`data-toast="Előrébb"`],[T('t-down'),'Hátrébb','',`data-toast="Hátrébb"`],[T('t-repeat'),'Gyakorlat cseréje',d?`a ${d} kész szett itt marad, a többi az újé`:'hasonlóra vagy bármi másra',`data-ez="pick:swap:${gi}"`],[T('t-quest'),'Küldetések','vállalt és elengedett',`data-sheet="qb" data-arg="0"`],[T('t-skip'),'<span style="color:var(--bad)">Gyakorlat kihagyása</span>','',`data-toast="Gyakorlat kihagyva"`]].map(([ic,l,h,a])=>row(ic,l,h,chev,a)).join('')}`},
  recs:(g)=>{const e=EX[+(g||0)]||EX[0];return `${shh(`${muscleLabel(e.k)} · 24 alkalom`)}<div class="hero-cs" style="gap:12px">${mchp(e.k)}<h2 class="t">${e.n}</h2></div>
    <span class="eb" style="margin-top:12px">A múltkori alkalom</span><div class="cells">${(e.last||'— × — · RIR —').split(/ × | · RIR /).map((v,i)=>`<span><b>${v||'—'}</b><small>${['kg','ism','RIR'][i]}</small></span>`).join('')}</div>
    <span class="eb" style="margin-top:14px">Megdönthető rekordok</span>
    <div class="ln"><span class="g">Becsült 1RM<small>márc 4. óta áll · becslés, nem mérés</small></span><span class="v"><b>96,7 kg</b></span><div class="bar q"><b style="--w:86%"></b></div></div>
    <div class="ln"><span class="g">Legjobb szett<small>ma megdöntve</small></span><span class="v"><b>${e.goal}</b></span><div class="bar q"><b style="--w:100%"></b></div></div>
    <div class="ln"><span class="g">Legtöbb volumen<small>egy alkalmon</small></span><span class="v"><b>2 175 kg</b></span><div class="bar q"><b style="--w:66%"></b></div></div>
    <span class="eb" style="margin-top:14px">Rep-rekordok</span>${[['70 kg','12','aug 12.'],['72,5 kg','10','ma'],['75 kg','8','aug 28.']].map(([k,r,d])=>row('',k,d,`<span class="v"><b>${r}</b> ism.</span>`)).join('')}`},
  fin:()=>`${shh('Edzés befejezése')}<h2 class="t">Van még ${TOT()-DONE()} bepipálatlan szetted.</h2>
    ${EX.filter(e=>e.sets.some(x=>!isDone(x))).map(e=>row(mchp(e.k,'sm'),e.n,'',`<span class="v"><b>${e.sets.filter(x=>!isDone(x)).length}</b> szett</span>`)).join('')}
    <div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-ez="finish">${T('t-tick')}Befejezem így · ${DONE()} elvégzett · ${TOT()-DONE()} kihagyott</button></div><div class="act" style="margin-top:8px"><button class="lk" data-close>Mégse, visszamegyek</button></div>`,
  pick:()=>{const P=ST.pick,sw=P.mode==='swap',o=EX[P.g];return `${shh(sw?`Csere · ${o.n}`:'Gyakorlat hozzáadása')}<div class="hero-cs" style="gap:12px">${sw?mchp(o.k):I('i-plus')}<span><h2 class="t">${sw?'Mire cseréled?':'Mit adunk hozzá?'}</h2><p class="txt sub">${sw?muscleLabel(o.k):'Pull Day · a lista végére kerül'}</p></span></div>
    <input id="pk-q" class="fld" type="search" placeholder="Keresés név szerint…" value="${P.q}" autocomplete="off"><div id="pk-body">${pickBody()}</div>`},
  scope:()=>{const P=ST.pick,sw=P.mode==='swap',o=EX[P.g],Lb=LIB[P.lib],d=sw?o.sets.filter(isDone).length:0,rem=sw?o.sets.length-d:(Lb[2]==='compound'?4:3),noPlan=sw&&o.origin==='ma';
    const sub=sw?(d?`A ${d} kész szett a ${o.n}-nál marad, a hátralévő ${rem} szett az újé.`:`Ugyanott, ugyanúgy ${rem} szett.`):`${rem} szett · ${Lb[2]==='compound'?'8–10':'10–12'} ismétlés — a gyakorlat típusához szabva, utána átírhatod.`;
    return `${shh(sw?'Gyakorlat cseréje':'Gyakorlat hozzáadása')}<h2 class="t">${sw?`${o.n} → ${Lb[0]}`:Lb[0]}</h2><p class="txt sub">${sub}</p>
    ${row(mchp(Lb[1],'sm'),Lb[0],`${muscleLabel(Lb[1])} · ${Lb[3]?`múltkor ${Lb[3]} — innen jön a javaslat`:'még nem csináltad — a súlyt te adod meg'}`)}
    <span class="eb" style="margin-top:12px">Meddig érvényes?</span>${row(T('t-calendar'),'<b>Csak ma</b>','a mai edzésre. Jövő héten a régi terv jön.',chev,`data-ez="scope:ma"`)}${noPlan?'':row(T('t-peak'),'<b>Mezociklusra is</b>',`a ${MESO.name} hátralévő ${MESO.of-MESO.week} hetében is. A mentett sablonod nem változik.`,chev,`data-ez="scope:meso"`)}
    ${noPlan?'<p class="fn">Ez a gyakorlat ma került be, nincs a mezociklus tervében, ezért csak mára cserélhető.</p>':''}`},
  set:(a)=>{const [i,j]=(a||'0.0').split('.').map(Number),e=EX[i]||EX[0],s=e.sets[j]||e.sets[0];return `${shh(`Szett ${j+1} · ${e.n}`)}<h2 class="t">Szett szerkesztése</h2>
    ${stp('Súly · kg',kg(isDone(s)?s[0]:s[1]))}${stp('Ismétlés',isDone(s)?s[1]:s[2])}<div class="ln" style="display:block"><span class="g">RIR</span><div class="ch2">${['0','1','2','3','4','5'].map((x,k)=>`<button class="${k===(isDone(s)?s[2]:s[3])?'on':''}" data-ez="chip">${x}</button>`).join('')}</div></div>
    <span class="eb" style="margin-top:12px">Megjegyzés ehhez a szetthez (opcionális)</span><div class="fld ph">pl. utolsó ismétlés kemény</div>${two('Mentés')}<div class="act" style="margin-top:6px"><button class="lk bad" data-ez="save">Szett törlése</button></div>`},
  rp:(g)=>{const e=EX[+(g||0)]||EX[0];return `${shh('Szett kész · hogy ment?')}<div class="hero-cs" style="gap:12px">${mchp(e.k)}<span><h2 class="t">${e.n}</h2><p class="txt sub">a pihenő ezután indul · 90 mp</p></span></div>
    ${[['Pumpa · érzed?',['Semmi','Enyhe','Jó','Brutális'],2],['Ízületi fájdalom',['Nincs','Enyhe','Erős'],0],['Akarunk még?',['Kevés volt','Pont jó','Sok volt'],1]].map(([q,o,s])=>`<div class="ln" style="display:block"><span class="g">${q}</span><div class="ch2">${o.map((x,i)=>`<button class="${i===s?'on':''}" data-ez="chip">${x}</button>`).join('')}</div></div>`).join('')}
    <div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-ez="rest">Mentés · pihenő indul</button><button class="lk" data-ez="rest">Hagyjuk, csak a pihenő</button></div>`},
  extra:()=>`${shh('Extra szett hozzáadva')}<h2 class="t">A tervbe is felvegyük?</h2><p class="txt sub">Most 5 szett.</p><div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-ez="save">Csak ma</button><button class="lk" data-ez="save">Minden hétre</button></div>`,
  note:()=>`${shh('Gyakorlat-jegyzet')}<h2 class="t">Jegyzet a gyakorlathoz</h2><div class="fld" style="min-height:70px">A pad a harmadik fokon, a könyök végig zárva maradjon.</div>${two('Mentés')}`,
  wnote:()=>`${shh('Edzés-jegyzet')}<h2 class="t">Hogy ment?</h2><p class="txt sub">Nem kötelező — később is hozzáírhatod.</p><div class="fld" style="min-height:70px">Ma a váll végig nyugton volt, a sorok tiszták…</div>${two('Mentés')}`,
  tech:(g)=>{const e=EX[+(g||0)]||EX[0];return `${shh(`Technika · ${e.n}`)}${TECH.default.map(([h,t])=>`<h2 class="t" style="margin-top:12px">${h}</h2><p class="txt">${t}</p>`).join('')}
    <span class="eb" style="margin-top:14px">Tovább</span>${row(T('t-camera'),'Demó videó','',chev,`data-toast="Demó videó"`)}${row(I('i-chat'),'Kérdezd a csapatot','miért pont ez a fogás?',chev,`data-toast="Mezo · Chat"`)}`},
  qb:(g)=>{const i=+(g||0),c=CHAL[i];return `${shh(`Küldetés · ${c.acc?'vállalva':'elengedve'}`)}<div class="hero-cs" style="gap:12px">${T(QICON[c.type])}<span><h2 class="t">${c.type}</h2><p class="txt sub">${c.ex}</p></span></div>
    <div class="big" style="margin-top:12px"><span class="num" style="font-size:28px">${c.target}</span></div><span class="eb" style="margin-top:4px">Biztosság · ${c.conf} · alacsony kockázat</span><p class="txt sub" style="margin-top:8px">${c.why}</p>
    <div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-ez="qtoggle:${i}">${c.acc?'Elengedem':'Visszaveszem'}</button></div><p class="fn">${c.acc?'Büntetés nélkül — elengedve nem számít a zárásnál. Bármikor visszaveheted.':'Most nem számít bele a zárásba. Ha mégis nekifutsz, vedd vissza.'}</p>`},
  info:()=>`${shh('Miből áll össze a szám?')}<p class="txt">A heti terv minden izomcsoportra kiír valahány szettet. A szám azt mutatja, ezekből mennyi ment már le a héten. A sport és a futás külön látszik — becslés, a szettekbe nem számít bele.</p>`,
  grp:(g)=>{const [k,l,d,p,w]=GR[+(g||0)];return `${shh('Izomcsoport · ezen a héten')}<div class="hero-cs" style="gap:12px">${mchp(k)}<span><h2 class="t">${l}</h2><p class="txt sub">${d} / ${p} szett</p></span></div>
    ${row('',`${l} (fej 1)`,'6 szett · 8–10 ismétlés · 2×/hét — a heti tervből')}${row('',`${l} (fej 2)`,'4 szett · 10–12 ismétlés · 2×/hét — a heti tervből')}${row(I('i-ball'),'Röpi · erős · Futás · enyhe','becslés — a szettekbe nem számít bele')}<p class="txt sub" style="margin-top:10px">${w} · +~40 XP</p>`},
  tgrp:(gi)=>{const [n,k,done,plan,words]=LD_GROUPS[+(gi||0)];return `${shh('Izomcsoport')}<div class="hero-cs" style="gap:12px">${mchp(k)}<span><h2 class="t">${n}</h2><p class="txt sub">${done} szett a ${plan}-ból, eddig a héten</p></span></div>
    ${[['Hétfő · Push',6,'het'],['Szerda · Legs',5,'sze'],['Csütörtök · Pull',3,'csu']].map(p=>row(I('i-dumb'),p[0],'',`<span class="v"><b>${p[1]}</b> szett</span>${chev}`,`data-go="nap.${p[2]}"`)).join('')}<p class="txt" style="margin-top:10px">${words}</p><p class="fn">A heti terved ${plan} szettet kér ebből az izomcsoportból. Tapasztalat: +${done*4} XP.</p>`},
  tdel:()=>`${shh('Törlés')}<h2 class="t">Törlöd a sablont?</h2><p class="txt sub">Hypertrophy 04 · Tavasz. A korábbi futamok és a riportjaik megmaradnak — csak a recept tűnik el a listádból.</p><div class="act" style="margin-top:14px"><button class="btn" style="flex:1;background:var(--bad);color:#fff" data-ez="toastclose:Törölve">Törlés</button><button class="lk" data-close>Mégsem</button></div>`,
  close:()=>`${shh('Lezárás')}<h2 class="t">Edzésterv lezárása</h2><p class="txt sub">Lezárás után riportot kapsz róla: mennyit csináltál meg belőle, mi változott erőben, és hogyan mozdultak az izmaid.</p>
    <span class="eb" style="margin-top:12px">Hogy érezted magad benne?</span><div class="ch2">${['Nagyon jól','Jól','Vegyesen','Nehezen'].map((n,i)=>`<button class="${i===1?'on':''}" data-ez="chip">${n}</button>`).join('')}</div>
    <span class="eb" style="margin-top:12px">Jegyzet (nem kötelező)</span><div class="fld ph">Mit vinnél tovább a következőbe?</div><div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-go="riport">${T('t-scroll')}Lezárás</button><button class="lk" data-close>Mégsem</button></div>`,
  start:()=>`${shh('Futam indítása')}<h2 class="t">Hypertrophy 04 · Tavasz</h2><p class="txt sub">6 hét · 5 edzésnap hetente. A futó terved ettől nem áll le — ez a sorba kerül mögé.</p>
    <span class="eb" style="margin-top:12px">Mikor kezdődjön?</span><div class="ch2">${['Jún 16','Jún 23','Más dátum'].map((n,i)=>`<button class="${i===0?'on':''}" data-ez="chip">${n}</button>`).join('')}</div><div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-ez="toastclose:Elindítva — a Következnek listába került">${T('t-tick')}Indítás</button><button class="lk" data-close>Mégsem</button></div>`,
  ido:()=>`${shh('Edzőtermi időpontok')}<h2 class="t">Mikor érsz rá?</h2><p class="txt sub">Az állandó időpontjaidat te állítod be — ezekhez a terv nem nyúl.</p>${[['Hétfő','18:00'],['Kedd','18:00'],['Szerda','17:30'],['Csütörtök','18:00'],['Péntek','17:00']].map(r=>row('',r[0],'',`<span class="v"><b>${r[1]}</b></span>`)).join('')}<div class="act" style="margin-top:14px"><button class="btn" style="flex:1" data-close>Rendben</button></div>`,
  sportlog:()=>`${shh('Sport log · röpi')}<h2 class="t">Hogy ment?</h2><p class="txt sub">Az idő, a terhelés és a saját élményed.</p>${stp('Idő · perc',90)}${stp('Szettek · összesen',5)}
    <div class="ln" style="display:block"><span class="g">RPE · összesített nehézség</span>${scale(7)}</div><div class="ln" style="display:block"><span class="g">Váll-terhelés</span>${scale(6)}</div>
    <span class="eb" style="margin-top:12px">Jegyzet</span><div class="fld">Jól ment a nyitás, a harmadik szettben kicsit húzott a váll.</div>${two('Mentés')}`,
  runlog:()=>`${shh('Futás log · sprint-intervallum')}<h2 class="t">Hogy ment?</h2>${stp('Teljesített körök',6)}<div class="ln" style="display:block"><span class="g">RPE · érzékelt nehézség</span>${scale(9)}</div>${stp('Pulzus-megnyugvás · mp',42)}
    <span class="eb" style="margin-top:12px">Jegyzet</span><div class="fld">Az utolsó két kör nehéz volt, de tartottam az iramot.</div>${two('Mentés')}`,
  blkmenu:()=>`${shh('Futóterv')}<h2 class="t">Robbanékonyság 01</h2>${row(T('t-repeat'),'Duplikálás','',chev,`data-ez="toastclose:Duplikálva"`)}${row(T('t-trash'),'<span style="color:var(--bad)">Törlés</span>','',chev,`data-ez="toastclose:Törölve"`)}`,
  custom:()=>`${shh('Saját edzés')}<h2 class="t">Mit nyomunk ma?</h2>${row(I('i-dumb'),'Pihenőnapi felső','3 gyakorlat · 10 szett',`<button class="lk" data-go="sajat">szerkesztés</button>${chev}`,`data-go="session.uj"`)}<div class="act" style="margin-top:12px"><button class="btn sm" data-go="sajat.uj">${I('i-plus')}Új összeállítása</button></div>`,
  sjpick:()=>`${shh('Gyakorlat hozzáadása')}<h2 class="t">Mit teszünk bele?</h2><p class="txt sub">Koppints egyre — alapbeállítással kerül be, és rögtön kinyílik.</p>
    ${LIB.map((Lb,i)=>[Lb,i]).filter(([Lb])=>!ST.sj.ex.some(e=>e.n===Lb[0])).slice(0,8).map(([[n,k,t,last],i])=>row(mchp(k,'sm'),n,`${muscleLabel(k)} · ${t==='compound'?'összetett':'izolált'}${last?` · múltkor ${last}`:' · még nem csináltad'}`,I('i-plus'),`data-ez="sjadd:${i}"`)).join('')}`
};
const resheet=(name,arg)=>openSheet(SHEETS[name](arg));

/* ── interakciók (a shell data-go/-sheet/-toast/-close mellé) ── */
document.addEventListener('click',e=>{
  if(K.D!=='edzes')return;const t=e.target,ez=t.closest('[data-ez]');if(!ez)return;
  const inner=t.closest('[data-toast],[data-go],[data-sheet],[data-close]');if(inner&&inner!==ez&&ez.contains(inner))return;
  e.preventDefault();const [cmd,...rest]=ez.dataset.ez.split(':'),a=rest.join(':');
  switch(cmd){
    case 'skip':ST.sk[a]={cat:'NONE',text:''};ST.skord.push(a);ST.whyk=a;repaint();resheet('why');toast('Kihagyva — bármikor visszavonhatod');break;
    case 'skwhy':ST.whyk=a;resheet('why');break;
    case 'skundo':delete ST.sk[a];ST.skord=ST.skord.filter(x=>x!==a);repaint();toast('Visszavonva — újra a tervben');break;
    case 'why':{const k=ST.whyk;ST.sk[k].cat=a;if(a==='OTHER')ST.sk[k].text='Családi program jött közbe';if(ST.km&&ST.km.from===k){if(serious(k))ST.km.cat=a;else ST.km=null}resheet('why');repaint();break}
    case 'whydone':closeSheet();repaint();if(a==='1')toast(`Megjegyeztem · ${skLabel(ST.whyk)}`);break;
    case 'kmdur':{const k=ST.whyk,retro=k==='sze'||k==='run';ST.km={cat:ST.sk[k].cat,dur:+a,day:retro?2:1,released:false,asked:false,from:k};ST.cb=null;resheet('why');repaint();
      setTimeout(()=>{if(!retro&&ST.km&&ST.km.from===k){delete ST.sk[k];ST.skord=ST.skord.filter(x=>x!==k)}closeSheet();repaint();toast('Kímélő mód bekapcsolva')},1400);break}
    case 'kmrel':ST.km.released=a==='1';repaint();toast(ST.km.released?'Rendben — ma edzel, holnaptól újra kímélő mód':'Visszaállítva · ma pihensz');break;
    case 'kmnotyet':ST.km.asked=true;repaint();toast(`Rendben — holnap újra rákérdezek. ${CARE[ST.km.cat]}`);break;
    case 'kmback':if(ST.km.day===1){ST.km=null;repaint();toast('Kímélő mód befejezve');break}ST.udv=ST.km.day-1<=2?0:ST.km.day-1<=9?1:2;resheet('udv');break;
    case 'udvt':ST.udv=+a;resheet('udv');break;
    case 'udv':closeSheet();if(a==='1'){ST.cb={n:1,of:ST.udv===0?1:2,waived:false,prev:ST.km};ST.km=null;repaint();toast('Üdv újra! · könnyített visszatérés')}else toast('Rendben — marad a kímélő mód');break;
    case 'cbwaive':ST.cb.waived=true;repaint();toast('Könnyítés kikapcsolva · teljes edzés');break;
    case 'cbundo':ST.km=ST.cb.prev;ST.cb=null;repaint();toast('Visszaállítva · marad a kímélő mód');break;
    case 'ready':ST.ready=a==='lighten'?'done':a==='keep'?'gone':'offer';repaint();toast(a==='lighten'?'Könnyítve — ma egy fokkal lejjebb':a==='keep'?'Rendben, marad a terv':'Visszaállítva az eredeti terv');break;
    case 'btick':ST.tick[+a]=!ST.tick[+a];repaint();break;
    case 'bstart':{CHAL.forEach((c,i)=>{c.acc=ST.tick[i];c.rel=false});const n=ST.tick.filter(Boolean).length;ST.tick=null;ST.day='run';K.go('session.uj');toast(n?`Indulunk — ${n} küldetéssel`:'Indulunk — ma küldetés nélkül');break}
    case 'qtoggle':{const c=CHAL[+a];c.acc=!c.acc;c.rel=!c.acc;closeSheet();repaint();toast(c.acc?'Visszavéve — hajrá!':'Elengedve — semmi gond');break}
    case 'rest':closeSheet();startRest();break;
    case 'reststop':stopRest();break;
    case 'plus15':ST.restLeft+=15;ST.restTotal+=15;repaint();break;
    case 'pick':{const [mode,g]=a.split(':');ST.pick={mode,g:+(g||0),f:'all',q:'',lib:0};resheet('pick');break}
    case 'pf':ST.pick.f=a;$('#pk-body').innerHTML=pickBody();break;
    case 'lib':ST.pick.lib=+a;resheet('scope');break;
    case 'scope':applyPick(a);break;
    case 'finish':ST.day='done';closeSheet();K.go('cer');break;
    case 'cerdone':ST.day='done';K.go('mai.kesz');break;
    case 'save':closeSheet();toast('Mentve');break;
    case 'toastclose':closeSheet();toast(a);break;
    case 'sportsave':toast('Naplózva · 90 perc');K.go('sport.naplo');break;
    case 'chip':{const p=ez.parentNode;p.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===ez));break}
    case 'scale':{const n=+a;ez.parentNode.querySelectorAll('button').forEach((b,i)=>{b.className=i+1<n?'f':i+1===n?'a':''});break}
    case 'cmp':ST.cmp=!ST.cmp;ST.cmpSel=[];repaint();break;
    case 'cmpsel':{const i=+a,at=ST.cmpSel.indexOf(i);if(at>=0)ST.cmpSel.splice(at,1);else if(ST.cmpSel.length<2)ST.cmpSel.push(i);else ST.cmpSel=[ST.cmpSel[1],i];repaint();break}
    case 'sjopen':ST.sj.open=ST.sj.open===+a?-1:+a;repaint();break;
    case 'sjst':{const [i,f,d]=a.split('|');sjStepApply(+i,f,+d);repaint();break}
    case 'sjvol':ST.sj.ex[+a].vol=!ST.sj.ex[+a].vol;repaint();break;
    case 'sjmv':{const [i,d]=a.split('|').map(Number),j=i+d;[ST.sj.ex[i],ST.sj.ex[j]]=[ST.sj.ex[j],ST.sj.ex[i]];ST.sj.open=j;repaint();break}
    case 'sjdel':{const n=ST.sj.ex[+a].n;ST.sj.ex.splice(+a,1);ST.sj.open=-1;repaint();toast(`${n} kivéve`);break}
    case 'sjadd':{const [n,k,tp]=LIB[+a],c=tp==='compound';ST.sj.ex.push({n,k,bem:c?2:1,w:c?4:3,lo:c?8:10,hi:c?10:15,rir:c?1:2,kg:null,vol:true});ST.sj.open=ST.sj.ex.length-1;closeSheet();repaint();toast(`${n} hozzáadva`);break}
    case 'sjsave':toast('Elmentve — megtalálod a „Saját edzés” lapon');K.go('mai');break;
    case 'sjgo':toast('Elmentve, indul az edzés');ST.day='run';K.go('session.uj');break;
  }
});
document.addEventListener('input',e=>{if(K.D!=='edzes')return;
  if(e.target.id==='pk-q'){ST.pick.q=e.target.value;$('#pk-body').innerHTML=pickBody()}
  if(e.target.id==='sj-name'){ST.sj.name=e.target.value;const ok=ST.sj.name.trim()&&ST.sj.ex.length;document.querySelectorAll('[data-ez="sjsave"],[data-ez="sjgo"]').forEach(b=>{b.disabled=!ok;b.style.opacity=ok?'':'.45'});const h=$('#sj-hint');if(ok)h?.remove();else if(h)h.textContent=ST.sj.name.trim()?'Adj hozzá legalább egy gyakorlatot.':'Adj nevet az edzésnek.'}});

const ROUTES={mai,indulas,session,review,gym,sport:(a)=>sport(a||'terv'),sportlog,futas:(a)=>futas(a||'het'),futasterv,medals,exercises,exercise,cer,terv,run,nap,napszerk,het,izom,konyvtar,futamok,riport,osszevetes,sablonok,sablon,sablonszerk,ujterv,sajat,terheles,terkep,jelek,mozgas};
const P='.phone[data-v="ajanlott"][data-d="edzes"]';
const CSS=`
${P} .shh{display:flex;align-items:center;gap:10px;margin-bottom:10px}${P} .shh .eb{flex:1}${P} .shh .x{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:var(--sub);border:1px solid var(--hair);font-size:16px}
${P} .sheet .ln svg.ic.td{width:26px;height:26px}${P} .sheet h2.t{margin-top:4px}
${P} .segc{display:flex;gap:18px;margin:8px 16px 0;border-bottom:1px solid var(--hair)}${P} .segc button{padding:8px 0 9px;font-size:13px;color:var(--sub);border-bottom:2px solid transparent;margin-bottom:-1px}${P} .segc button.on{color:var(--ink);border-bottom-color:var(--acc)}
${P} .foot{position:absolute;left:16px;right:16px;bottom:16px;z-index:25}${P} .foot .btn{width:100%}${P} .rest.nn{bottom:16px}
${P} .heat{width:64px;flex:0 0 auto;display:inline-block}${P} .heat svg{width:100%;height:auto;display:block;overflow:visible}${P} .heat.lg{width:92px}${P} .duo{display:flex;gap:10px;justify-content:center;flex:0 0 auto}${P} .duo .heat{width:70px}${P} .duo.sm .heat{width:26px}${P} .duo.xl{gap:18px;margin:6px 0}${P} .duo.xl .heat{width:120px}
${P} .arc{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;align-items:end;height:56px;margin-top:10px}${P} .arc i{display:block;height:var(--h);border-radius:3px;background:var(--hair)}${P} .arc i.past{background:rgba(230,233,234,.22)}${P} .arc i.now{background:var(--acc)}${P} .arc i.deload{background:repeating-linear-gradient(135deg,var(--hair) 0 2px,transparent 2px 6px)}${P}[data-t="light"] .arc i.past{background:rgba(21,34,44,.18)}
${P} .arcl{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;text-align:center;font-family:var(--mono);font-size:9.5px;color:var(--faint);margin-top:4px}${P} .arcl b{color:var(--acc);font-weight:500}
${P} .stp{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:13.5px;flex:0 0 auto}${P} .stp button{width:28px;height:28px;border-radius:50%;border:1px solid var(--hair);display:grid;place-items:center;color:var(--ink);font-size:15px}${P} .stp button:disabled{opacity:.35}${P} .stp b{min-width:34px;text-align:center;font-weight:500}${P} .stp b.auto{color:var(--faint);font-size:11px}
${P} .scale{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:8px}${P} .scale button{height:30px;border-radius:6px;border:1px solid var(--hair);font-family:var(--mono);font-size:11px;color:var(--sub);display:grid;place-items:center;text-align:center}${P} .scale button.f{background:rgba(230,233,234,.10);color:var(--ink)}${P} .scale button.a{background:var(--acc);color:var(--acc-ink);border-color:var(--acc)}
${P} .fld{display:block;width:100%;margin-top:8px;padding:10px 12px;border-radius:9px;border:1px solid var(--hair);background:var(--card2);font:inherit;font-size:13.5px;color:var(--ink);line-height:1.45}${P} .fld.ph,${P} .fld::placeholder{color:var(--faint)}
${P} .ch2{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}${P} .ch2 button{padding:6px 10px;border-radius:7px;border:1px solid var(--hair);font-size:12.5px;color:var(--sub)}${P} .ch2 button.on{background:var(--acc);color:var(--acc-ink);border-color:var(--acc)}
${P} .gridx2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}${P} .opt{display:flex;align-items:center;gap:8px;padding:10px 10px;border-radius:10px;border:1px solid var(--hair);font-size:13px;color:var(--ink)}${P} .opt.on{border-color:var(--acc);box-shadow:inset 0 0 0 1px var(--acc)}${P} .opt svg.ic.td{width:24px;height:24px}
${P} .cells{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}${P} .cells span{display:block;min-width:0}${P} .cells b{display:block;font-family:var(--disp);font-weight:600;font-size:18px;letter-spacing:-.4px;font-variant-numeric:tabular-nums}${P} .cells small{display:block;font-family:var(--mono);font-size:9px;letter-spacing:.6px;text-transform:uppercase;color:var(--faint);margin-top:2px;line-height:1.3}
${P} .trend{width:100%;height:auto;display:block;margin-top:8px}
${P} .gauge{position:relative;height:6px;border-radius:3px;background:var(--hair);margin:30px 0 26px}${P} .gauge .fill{position:absolute;left:0;top:0;bottom:0;width:var(--w);border-radius:3px;background:var(--c)}${P} .gauge .mk{position:absolute;top:-5px;bottom:-5px;left:var(--x);width:1px;background:var(--sub)}${P} .gauge .pin{position:absolute;left:var(--x);top:-24px;transform:translateX(-50%);font-family:var(--mono);font-size:10px;color:var(--ink);white-space:nowrap}${P} .gauge .cap{position:absolute;left:var(--x);top:12px;transform:translateX(-50%);font-family:var(--mono);font-size:9.5px;color:var(--faint);white-space:nowrap}
${P} .wkb{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;margin-top:8px}${P} .wkb i{display:grid;place-items:center;height:26px;border-radius:6px;border:1px solid var(--hair);font-family:var(--mono);font-size:10.5px;color:var(--faint);font-style:normal}${P} .wkb i.d{color:var(--sub);background:rgba(230,233,234,.08)}${P} .wkb i.n{color:var(--acc-ink);background:var(--acc);border-color:var(--acc)}
${P} .mmgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 6px;margin:6px 0 4px}${P} .mmgrid div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:var(--sub);text-align:center;padding:6px 0;line-height:1.25}${P} .mmgrid div.dim{opacity:.35}
${P} .sets .vd{width:30px;height:30px;display:grid;place-items:center}${P} .sets .vd svg.ic.td{width:20px;height:20px}${P} .sets .tk.go svg.ic{width:16px;height:16px;stroke-width:2.2}
${P} .exh .acts{display:flex;gap:6px;flex:0 0 auto}${P} .rb{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:var(--sub);border:1px solid var(--hair);font-size:15px;flex:0 0 auto}${P} .rb svg.ic.td{width:18px;height:18px}
${P} .wtop{display:flex;align-items:center;gap:10px;padding:10px 16px 6px}${P} .wtop strong{flex:1;font-size:15px;font-weight:600}${P} .wtop .cnt{font-family:var(--mono);font-size:12px;color:var(--sub);white-space:nowrap}${P} .wtop .cnt b{color:var(--ink);font-weight:500}
${P} .qline{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink);margin:2px 0 4px}${P} .qline svg.ic.td{width:20px;height:20px}${P} .xl{font-size:12.5px;margin:2px 0 4px}${P} .tech.tap{cursor:pointer}
${P} .ln .tk{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--sub);display:grid;place-items:center;flex:0 0 auto;color:var(--acc-ink);font-family:var(--mono);font-size:11px}${P} .ln .tk svg{opacity:0;width:16px;height:16px;stroke-width:2.2}${P} .ln .tk.on{background:var(--acc);border-color:var(--acc)}${P} .ln .tk.on svg{opacity:1}
${P} .ln.muted{opacity:.55}${P} .ln .grip{color:var(--faint);font-size:14px}${P} .ln .chev{display:inline-flex;transition:.2s}${P} .mchp.xs{width:22px;height:22px}${P} .mch{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:11px;color:var(--sub)}${P} .lk.bad{color:var(--bad)}${P} .lk:disabled{opacity:.35}
${P} .sjp{padding:4px 0 10px 38px;border-top:1px solid var(--hair)}${P} .sjp .ln:first-of-type{border-top:0}
${P} .sw{width:34px;height:20px;border-radius:10px;border:1px solid var(--hair);position:relative;flex:0 0 auto}${P} .sw::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--sub);transition:.2s}${P} .sw.on{background:var(--acc);border-color:var(--acc)}${P} .sw.on::after{left:16px;background:var(--acc-ink)}
${P} .srch{display:flex;align-items:center;gap:10px;margin:10px 16px 0;padding:10px 12px;border-radius:10px;border:1px solid var(--hair);color:var(--faint);font-size:13.5px}${P} .srch svg.ic{width:18px;height:18px}
${P} .mini{display:inline-flex;align-items:flex-end;gap:2px;height:22px}${P} .mini i{display:block;width:5px;height:var(--h);border-radius:1px;background:var(--c);opacity:.8}
${P} .hero.tap{cursor:pointer}${P} .hero .top .chev{width:18px;height:18px;color:var(--faint)}
${P} .cer{position:relative;padding:34px 16px 10px;text-align:center}${P} .cstars{display:flex;justify-content:center;gap:8px;margin:14px 0 12px}${P} .cstars i{position:relative;width:40px;height:40px;display:grid;place-items:center}${P} .cstars i svg{position:absolute;width:38px;height:38px;left:1px;top:1px}${P} .cstars i .on,${P} .cstars i .half{opacity:0;transform:scale(.6);transition:.35s var(--ease)}${P} .cstars i.is-lit .on,${P} .cstars i.is-half .half{opacity:1;transform:none}${P} .cstars i.is-lit .off,${P} .cstars i.is-half .off,${P} .cstars i.is-lit .half{opacity:0}
${P} .fuse{height:3px;border-radius:2px;background:var(--hair);position:relative;overflow:hidden;margin:0 40px}${P} .fuse b{position:absolute;inset:0;width:calc(var(--p)*100%);background:#CFA14A;border-radius:2px}
${P} .cres,${P} .ccard,${P} .cfoot{opacity:0;transform:translateY(8px);transition:.5s var(--ease)}${P} .b1 .cres,${P} .b2 .ccard,${P} .b3 .cfoot{opacity:1;transform:none}body.still ${P} .cres,body.still ${P} .ccard,body.still ${P} .cfoot,body.still ${P} .cstars i svg{transition:none}
${P} .cres .verdict{text-align:center;font-size:24px;margin:8px 16px 14px;font-family:var(--disp);font-weight:var(--dispw);letter-spacing:var(--dispt)}${P} .mstars{display:inline-flex;gap:2px}${P} .mstars svg{width:14px;height:14px}
${P} .skb{margin-top:4px}${P} .act .lk{white-space:nowrap}${P} .act{flex-wrap:wrap;gap:10px 14px}
@media (max-width:360px){${P} .cells b{font-size:15px}${P} .ln .bar{width:52px}${P} .duo.xl .heat{width:96px}}
`;
register('edzes',{
  mark:'i-dumb',
  tabs:[['Mai','i-dumb','mai'],['Terv','i-layers','terv'],['Terhelés','i-bars','terheles'],['Gyakorlatok','i-book','exercises']],
  routes:ROUTES,
  sheets:SHEETS,
  after:(r,a)=>{if(r==='cer'&&!a)runCer();if(r!=='indulas')ST.tick=null;if(r!=='session'&&ST.resting)stopRest(true)},
  css:CSS,
  notes:`<h2>Edzés · minden út</h2>
  <p><b>Mai fül</b> · <a href="#a-edzes-mai">#a-edzes-mai</a> (a mai nap), <a href="#a-edzes-mai.sze">mai.sze</a> (szerda, elmaradt), <a href="#a-edzes-mai.pihen">mai.pihen</a>, <a href="#a-edzes-mai.ures">mai.ures</a>, <a href="#a-edzes-mai.folyamatban">mai.folyamatban</a>, <a href="#a-edzes-mai.kesz">mai.kesz</a>, <a href="#a-edzes-mai.kimelo">mai.kimelo</a> (kímélő mód 1. nap), <a href="#a-edzes-mai.kimelo3">mai.kimelo3</a> (letelt a becslés: „Hogy vagy?”), <a href="#a-edzes-mai.vissza">mai.vissza</a> (visszatérő, könnyített edzés). A <b>Kihagyom</b> → „Miért?” lap (8 ok, Egyéb szöveg, komoly oknál a <b>Meddig tarthat?</b> sor → kímélő mód) → <b>Visszavonom</b> végig működik; <b>Jobban vagyok</b> → „Üdv újra!” lap; <b>Ma mégis edzek</b> · Mégse.</p>
  <p><a href="#a-edzes-indulas">indulas</a> eligazítás: várható idő, váll-figyelmeztetés, pipálható küldetések, a mai sor, Indulás-gomb. <a href="#a-edzes-session">session</a> · <a href="#a-edzes-session.uj">session.uj</a> (friss indulás): <b>súly · ism · RIR</b> egy sorban, a javaslat a múlt héttel a név alatt (BWS), a pipa → „Hogy ment?” → <b>pihenő magától indul</b> (valódi visszaszámlálás). ⋮ menü (csere, hozzáadás, jegyzet, szett ±, kihagyás), <b>Hasonló gyakorlatok</b> a választóban, <b>Csak ma / Mezociklusra is</b>, rekordok lap, technika-lap (Beállás · Végrehajtás · Gyakori hibák), befejezés lap → <a href="#a-edzes-cer">cer</a> ceremónia (csillagok, számláló, a minta marad; az anyag csepp-üveg, arany csak a rekordon) → <a href="#a-edzes-cer.reszletek">cer.reszletek</a>. <a href="#a-edzes-review">review</a> · <a href="#a-edzes-review.gyak">review.gyak</a>: „Mihez képest” elöl (trend, nem egy nap), medálok, küldetések, gyakorlatonként.</p>
  <p><a href="#a-edzes-sport">sport</a> (.terv · .naplo · .cross — a Mezo-jegyzetet a kristály küldi), <a href="#a-edzes-sportlog">sportlog</a> (két lépés), <a href="#a-edzes-sajat">sajat</a> (+ .uj · .betolt · .nincs; a lépegetők, a kapcsoló, a sorrend valódiak), Saját edzés lap a „Vagy inkább” alatt.</p>
  <p><b>Terv fül</b> · <a href="#a-edzes-terv">terv</a> (+ <a href="#a-edzes-terv.ures">.ures</a> · <a href="#a-edzes-terv.nincs">.nincs</a>), <a href="#a-edzes-run">run</a>, <a href="#a-edzes-nap.csu">nap.csu</a> (nap.het … nap.vas), <a href="#a-edzes-napszerk">napszerk</a>, <a href="#a-edzes-het">het</a>, <a href="#a-edzes-izom.back-wide">izom.back-wide</a>, <a href="#a-edzes-konyvtar">konyvtar</a>, <a href="#a-edzes-futamok">futamok</a> (Összevetés-mód: kettőt kijelölsz), <a href="#a-edzes-riport">riport</a>, <a href="#a-edzes-osszevetes">osszevetes</a> (egyik oldal sincs színnel megjelölve), <a href="#a-edzes-sablonok">sablonok</a>, <a href="#a-edzes-sablon">sablon</a>, <a href="#a-edzes-sablonszerk">sablonszerk</a>, <a href="#a-edzes-ujterv">ujterv</a> (.gen · .kesz), <a href="#a-edzes-futas">futas</a> (.het · .naplo · .tervek), <a href="#a-edzes-futasterv">futasterv</a>.</p>
  <p><b>Terhelés fül</b> · <a href="#a-edzes-terheles">terheles</a>: a fejléc a <b>trend</b> (három hete emelkedik a heti szettszám, hat heti oszlop; ami megvolt, szürke), izomcsoportonként nyitott sorok (a tele sáv elhallgat), Időpontok lap. <a href="#a-edzes-terkep">terkep</a> (+ .terv), <a href="#a-edzes-jelek">jelek</a>, <a href="#a-edzes-mozgas">mozgas</a>, <a href="#a-edzes-gym">gym</a> (a régi Gym-nézet). <b>Gyakorlatok fül</b> · <a href="#a-edzes-exercises">exercises</a>, <a href="#a-edzes-exercise">exercise</a> (erő-ív trenddel, technika, alternatívák), <a href="#a-edzes-medals">medals</a> (+ .ures).</p>
  <h2>Mi változott</h2><p>Minden doboz eltűnt, csak egy-két üvegkártya maradt képernyőnként (a nap hőse, a készenlét cseppje, a terv posztere). A többi nyitott lista hajszálvonallal. Szín csak ott, ahol jelent valamit: a borostyán csepp a könnyebb napra, vörös az elmaradt futáson és a törlésen, az izomszínek állandóak, a kék csak az egy fő gombon és az aktív fülön. Ami megvan, szürke (MacroFactor). Az ítélet-mondat váltja a magyarázó címeket. A szettsor három mezője után magától indul a pihenő, a technika és a tudomány egy koppintásra, nem a munkaképernyőn (Built With Science).</p>
  <h2>Amit nem tudtam leképezni</h2><p>A szell ikonkészletében nincs külön <i>csere</i>, <i>hozzáadás</i>, <i>kímélő pajzs-levél</i>, <i>sablon</i> és <i>összevetés</i> jel — ideiglenesen a megújít-nyíl, a plusz, a pajzs, a protokoll és a trend ikon áll a helyükön; a kosárlabda ikonra sincs sprite (az „egyéb” mozgás jele áll ott). Az élő prototípus „erő” oszlopa helyett az app saját <b>RIR</b> mezője szerepel. A naplózó mezők (lépegetők, skálák) itt csak kinézetre működnek, a saját edzés szerkesztője kivételével.</p>`
});
})();
