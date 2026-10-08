/* vilagos/nap.js — Nap domain in the "Folyadék" identity (built on "Világos · élő"). Built on window.F (see vilagos/README.md).
   Routes = the living prototype's (elo/nap.html):
   mai[.kimelo|.kimelo-lejart] maieste checkin hatasok napom nap.<date>[.este] eletjel kuldetesek[.ures]
   rutin[.reggel|.napkozben|.este] uzenetek[.eletjelek|.eszrevetelek] gyors napzaras.1–6 rutin-epites lanc szokasok szokas szerk rutin-uj.<step>.
   Plain `mai` (no arg) is replaced by the approved concept screen in foly.js; the variants here follow its tank · vials · stream anatomy.
   Every route has one signature liquid graphic drawn from its own data (see the notes at the bottom).
   Domain interactions use one attribute: data-n="cmd:arg" (see ACT at the bottom). */
(function(){
const {I,csepp,page,sec,card,head,hero,btn,lk,step,facts,bar,st,note,txt,empty,who,msg,chev,act,register,
  tank,vials,mini,level,fill,linked,bub,wave}=F;
const farea=F.area;
const $=s=>document.querySelector(s);
const pad2=n=>String(n).padStart(2,'0');
/* re-render the current route in place (the shell re-renders on hashchange); keeps the scroll, skips the entrance motion */
function soft(){const sc=$('#phone .scroll');const y=sc?sc.scrollTop:0;window.dispatchEvent(new HashChangeEvent('hashchange'));const s2=$('#phone .scroll');if(s2)s2.scrollTop=y;document.querySelectorAll('#phone .rise').forEach(e=>{e.style.animation='none'})}

/* ── small local helpers (same anatomy as the kit, plus a data-n hook) ── */
const nb=(l,n,cls='',x='')=>`<button class="btn ${cls}" data-n="${n}" ${x}>${l}</button>`;
const nl=(l,n)=>`<button class="fh-lk" data-n="${n}">${l}</button>`;
const acts=h=>`<div class="fh-acts">${h}</div>`;
const xrow=o=>{const tap=o.n||o.on,tag=tap&&!o.div?'button':'div';
  return `<${tag} class="fh-row ${o.cls||''}"${o.n?` data-n="${o.n}"`:act(o.on)}>${o.left||''}${o.icon?`<span class="si">${I(o.icon)}</span>`:''}<span class="g"><strong>${o.title}</strong>${o.sub?`<small>${o.sub}</small>`:''}${o.more||''}</span>${o.v!=null?`<span class="v">${o.v}</span>`:''}${o.right||''}${tap&&!o.right&&!o.div?chev():''}</${tag}>`};
const chip=(l,n,on,ic)=>`<button class="fh-pill ${on?'on':''}" data-n="${n}">${ic?I(ic):''}${l}</button>`;
const chips=(a,sel=0,n='pick')=>`<div class="fh-pills">${a.map((x,i)=>Array.isArray(x)?chip(x[0],n,i===sel,x[1]):chip(x,n,i===sel)).join('')}</div>`;
const xseg=(a,sel=0,n='pick')=>`<div class="fh-seg">${a.map((l,i)=>`<button class="${i===sel?'on':''}" data-n="${n}">${l}</button>`).join('')}</div>`;
const lab=t=>`<span class="fh-lab">${t}</span>`;
const inp=(ph,v='')=>`<input class="fh-in" placeholder="${ph}" value="${v}">`;
const area=(ph,v='',rows=3)=>`<textarea class="fh-in" rows="${rows}" placeholder="${ph}">${v}</textarea>`;
/* 1–10 skála = szint: tíz kémcső, a választottig töltve, lépcsőzetesen emelkedő folyadékkal */
const scale=(v,n='sc')=>`<div class="np-scale">${Array.from({length:10},(_,i)=>`<button class="${i+1<v?'f':i+1===v?'a':''}" style="--k:${i+1}" data-n="${n}:${i+1}"><span>${i+1}</span></button>`).join('')}</div>`;
const ends=(a,b)=>`<div class="np-sl"><span>${a}</span><span>${b}</span></div>`;
const dots=(n,on,core=0)=>`<div class="np-dots">${Array.from({length:n},(_,i)=>`<i class="${i<=on?'on':i<core?'core':''}"></i>`).join('')}</div>`;
const shH=(title,sub='',backTo='',ic='')=>`<div class="np-shh">${backTo?`<button class="fh-ib fh-back" data-sheet="${backTo}" aria-label="Vissza">‹</button>`:''}${ic?bub(ic,{s:44}):''}<div class="g"><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div><button class="fh-ib np-x" data-close aria-label="Bezárás">×</button></div>`;
const saveRow=(l='Mentés',n='save')=>`<div class="np-two" style="margin-top:16px"><button class="btn ghost" data-close>Mégse</button><button class="btn" data-n="${n}">${l}</button></div>`;
const tk=(on,attr,label)=>`<button class="np-tk ${on?'on':''}" aria-label="${label}" ${attr}>${I('i-check')}</button>`;
const hi=ic=>bub(ic,{s:64});
const inl=ic=>bub(ic,{s:24,cls:'np-inl'});
const chipsRow=(a,lead='')=>`<div class="np-chips">${lead?`<b>${lead}</b>`:''}${a.map(x=>`<span>${x}</span>`).join('')}</div>`;
/* 28 napos csendes rács apró szintekből: tele · üres · nem volt sor; lv = a nap töltöttsége változó */
const g28=(seed,miss=[],skip=[],n=28,lv=false)=>`<div class="np-g28">${Array.from({length:n},(_,i)=>{const k=skip.includes(i)?'s':miss.includes(i)?'m':(miss.length||(i*7+seed)%10<8)?'p':'m';
  return `<i class="${k}" style="--h:${lv?(k==='p'?64+((i*13+seed*5)%4)*12:12+((i*5+seed)%3)*12):k==='p'?100:0}%"></i>`}).join('')}</div>`;

/* ── folyadék-grafikák (a közös készlet fölött, a Nap saját formái) ── */
/* data-n a közös elemeken: N('cmd') megy az `on`/`ctaAct` helyére, nfix() cseréli valódi data-n-re */
const N=n=>({toast:'@@'+n}), nfix=h=>h.replace(/data-toast="@@([^"]*)"/g,'data-n="$1"');
const clp=v=>Math.max(0,Math.min(100,v));
/* befőttesüveg: a nap / egy küldetés / egy válasz edénye; lid = lezárva */
const JAR='M24 30Q14 34 14 47V100Q14 112 26 112H74Q86 112 86 100V47Q86 34 76 30V20H24Z';
const jar=(p,{s=92,t='',lid=false,c='',c2=''}={})=>fill(JAR,{vb:'0 0 100 120',p:p<=0?0:(8+clp(p)*.82)/1.2,s,cls:'np-jar',...(c?{c,c2:c2||c}:{}),
  inner:(lid?`<rect x="17" y="7" width="66" height="16" rx="6" fill="var(--ink)"/><rect x="24" y="11" width="30" height="3" rx="1.5" fill="rgba(255,255,255,.35)"/>`:`<path d="M22 20H78" stroke="rgba(10,42,60,.2)" stroke-width="3" stroke-linecap="round"/>`)
    +(t?`<text x="50" y="${p>=42?90:74}" text-anchor="middle" class="np-jt" fill="${p>=42?'#fff':'var(--ink)'}">${t}</text>`:'')});
/* pohár: a víz lapja */
const GLASS='M20 8H80L72 108Q71 114 64 114H36Q29 114 28 108Z';
const glass=(p,{s=78,mark=null}={})=>fill(GLASS,{vb:'0 0 100 120',p:(6+clp(p)*1.06)/1.2,s,cls:'np-jar',
  inner:mark!=null?`<path d="M27 ${114-clp(mark)*1.06}H73" stroke="#fff" stroke-width="2" stroke-dasharray="4 4" opacity=".9"/>`:''});
/* csepp-lánc: összekötött cseppek — a kész tele van, a soron következő gyűrűt kap, a kimaradt üres */
const drops=(a,cls='')=>`<div class="np-drops ${cls}">${a.map(o=>{const tag=o.attr?'button':'span';return `<${tag} class="np-dr ${o.k||''}" ${o.attr||''}${o.label?` aria-label="${o.label}"`:''}><i></i>${o.t?`<small>${o.t}</small>`:''}</${tag}>`}).join('')}</div>`;
/* folyam saját attribútumokkal (a koncepció „Most következik” sora) */
const lstream=a=>`<div class="k2-stream">${a.map(o=>`<button class="k2-drop ${o.now?'now':''}" ${o.attr||''}><time>${o.time}</time><span><strong>${o.title}</strong>${o.sub?`<small>${o.sub}</small>`:''}</span>${o.right?`<em>${o.right}</em>`:''}</button>`).join('')}</div>`;
const kh=(t,s='',attr='',i=1)=>`<div class="k2-h rise" style="--i:${i}"><b>${t}</b>${attr?`<button class="fh-lk" ${attr}>${s}</button>`:`<span>${s}</span>`}</div>`;
/* a recept edényei: annyi telik meg, amennyit már kitöltöttél */
const recG=(labels,n)=>`<div class="np-rec">${labels.map((l,i)=>`<span class="${i<n?'f':''}"><i></i><b>${l}</b></span>`).join('')}</div>`;

/* ── adatok (az élő mock alapján) ── */
const ITEMS={
  energy:{n:'Energia',s:'Energia',ic:'t-bolt',q:'Mennyi energia van benned most?',lo:'Üres',hi:'Tele'},
  mood:{n:'Hangulat',s:'Hangulat',ic:'t-mood',q:'Milyen most a hangulatod?',lo:'Nagyon rossz',hi:'Nagyon jó'},
  stress:{n:'Stressz',s:'Stressz',ic:'t-checkin',q:'Mennyire vagy feszült most?',lo:'Nyugodt',hi:'Túlfeszült'},
  body:{n:'Testi érzés',s:'Test',ic:'t-person',q:'Hogy érzi magát most a tested?',lo:'Lerakva',hi:'Friss'},
  mental:{n:'Fejtisztaság',s:'Fej',ic:'t-gem',q:'Mennyire tiszta a fejed?',lo:'Köd',hi:'Éles'},
  rested:{n:'Kipihentség',s:'Pihent',ic:'t-rested',q:'Mennyire pihented ki magad éjjel?',lo:'Egyáltalán nem',hi:'Teljesen'},
  soreness:{n:'Izomláz',s:'Izomláz',ic:'t-soreness',q:'Mennyire van izomlázad?',lo:'Nincs',hi:'Nagyon erős'},
  pain:{n:'Fájdalom',s:'Fájdalom',ic:'t-pain',q:'Fáj valami?',kind:'pain'},
  motivation:{n:'Motiváció',s:'Kedv',ic:'t-motivation',q:'Mennyi kedved van a mai dolgaidhoz?',lo:'Semmi',hi:'Tele vagyok vele'},
  hunger:{n:'Éhség',s:'Éhség',ic:'t-hunger',q:'Mennyire vagy éhes most?',lo:'Egyáltalán nem',hi:'Nagyon'},
  craving:{n:'Sóvárgás',s:'Sóvárgás',ic:'t-craving',q:'Kívánsz most valamit?',lo:'Nem',hi:'Nagyon',kind:'craving'},
  digestion:{n:'Emésztés',s:'Emésztés',ic:'t-digestion',q:'Hogy érzi magát most a gyomrod?',lo:'Nehéz, puffadt',hi:'Könnyű, rendben'},
  connection:{n:'Kapcsolódás',s:'Kapcsolat',ic:'t-people',q:'Mennyire érezted magad ma kapcsolódva másokhoz?',lo:'Egyedül',hi:'Nagyon'},
  day:{n:'A nap mérlege',s:'Nap',ic:'t-day',q:'Milyen volt a napod összességében?',lo:'Nagyon rossz',hi:'Nagyon jó'}};
const CORE=['energy','mood','stress','body','mental'];
const PLAN={'06:30':[...CORE,'rested','soreness','pain','motivation'],'10:00':[...CORE,'motivation','hunger'],'14:00':[...CORE,'hunger','craving','digestion'],'20:00':[...CORE,'soreness','pain','craving','digestion','connection','day']};
const ADAPT={'06:30':{id:'hunger',why:'Most azt figyeljük, összefügg-e a reggeli éhséged a tegnapi vacsorával.'},'10:00':{id:'craving',why:'Ma ez a véletlen kérdés — így marad kiegyensúlyozott, amit rólad tanulunk.'},'14:00':{id:'motivation',why:'Most azt figyeljük, hogyan függ a délutáni kedved az éjszakai alvásodtól.'},'20:00':{id:'motivation',why:'Most azt figyeljük, előre jelzi-e az esti kedved a holnapi edzést.'}};
const SLOTN={'06:30':'Reggel','10:00':'Délelőtt','14:00':'Délután','20:00':'Este'};
const SLOTA={'06:30':'Reggeli','10:00':'Délelőtti','14:00':'Délutáni','20:00':'Esti'};
const REG_F=[['Fej',52,16],['Nyak',52,35],['Váll',33,46],['Könyök',22,82],['Csukló, kéz',19,106],['Has',52,80],['Csípő',42,106],['Térd',45,150],['Boka, lábfej',47,184]];
const REG_B=[['Felső hát',52,56],['Derék',52,96]];
const KINDS=['Édes','Sós','Zsíros','Bármit'];
const SLOTS=[{n:'Reggel',t:'06:30',st:'done',a:{energy:7,mood:8,stress:3,body:6,mental:7,rested:6,soreness:5,pain:{regions:['Térd'],int:4},motivation:8,hunger:5},note:'Nyugodt ébredés · pihenve'},{n:'Délelőtt',t:'10:00',st:'done',quick:true,a:{energy:8,mood:7,stress:4,body:7,mental:8}},{n:'Délután',t:'14:00',st:'now'},{n:'Este',t:'20:00',st:'pending'}];
let ck={slot:'14:00',step:0,a:{},quick:false};
const ckSteps=(t=ck.slot)=>[...PLAN[t],ADAPT[t].id];
const nowSlot=()=>SLOTS.find(s=>s.st==='now')||SLOTS.find(s=>s.st==='pending');
function ckDisp(id,a,short){
  if(!(id in a))return null; const v=a[id]; if(v===null||v===undefined)return '—';
  if(id==='pain'){if(v===false)return 'Nem';const r=v.regions.length?v.regions.join(', '):'Igen';return short?`${v.regions[0]||'Igen'}${v.int?' '+v.int:''}`:`${r}${v.int?' · '+v.int+'/10':''}`}
  if(id==='craving'){const k=(v.kinds||[]).join(', ');return short?`${v.kinds&&v.kinds[0]?v.kinds[0]+' ':''}${v.v}`:`${v.v}${k?' · '+k:''}`}
  return String(v);
}
const NEEDS=[['Étel','t-bowl',72,'meal'],['Víz','t-water',52,'water'],['Alvás','t-sleep',81,'sleep'],['Mozgás','t-dumbbell',34,'train'],['Kapcsolat','t-people',64,'checkin'],['Rend','t-chain',58,'']];
const QUESTS=[
  {ic:'t-dumbbell',s:'Edzés',p:35,t:'A mai tervezett edzés a naptárban van — csináld végig',why:'A megjelenés a legerősebb identitás-szavazat: aki ma edz, az edző ember.',xp:25,st:'offered',cta:'Edzés',foot:'folyamatban · az edzésből záródik magától'},
  {ic:'t-weight',s:'Súlymérés',p:100,t:'Reggeli súlymérés — logold be',xp:15,st:'done'},
  {ic:'t-journal',s:'Olvasás',p:20,t:'Olvass ma legalább 10 percet',xp:20,st:'offered',foot:'folyamatban · a logjaidból záródik magától'}];
let rerolls=1;
const RUTIN={
  reggel:{title:'Reggeli rutin',stat:['6/30','tökéletes reggel'],xp:25,rows:[
    ['Ébredés időben','a lánc kezdete','t-dawn',82,1],['Reggeli napfény','ébredés után','t-sun',64,1],['50 fekvőtámasz','megvolt a reggeli napfény','t-dumbbell',48,0],['Reggeli videó','megvolt az 50 fekvőtámasz','t-camera',39,0,1],['Reggeli súlymérés','fogmosás után','t-weight',93,1],['Gombakávé','súlymérés után','t-bowl',71,0],['Reggeli edzés','kávé után','t-run',57,0],['Fehérjés reggeli','edzés után','t-protein',79,0]]},
  napkozben:{title:'Napközbeni rutin',stat:['11/30','tökéletes nap'],xp:10,rows:[
    ['Ebéd utáni séta','ebéd után','t-steps',61,1],['Víz · 2 liter','délutánig','t-water',70,0],['Képernyőszünet','minden óra végén','t-clock',44,0]]},
  este:{title:'Esti rutin',stat:['4/30','tökéletes este'],xp:0,rows:[
    ['Koffein-cutoff','14:00 után már nem','t-clock',86,0],['Konyha zárva','elpakoltam a vacsora után','t-stack',68,0],['Szándékkal éltem?','koppints, és válaszolj','t-journal',55,0,0,'reflect'],['Napzárás','a nap lezárása','t-moon',null,0,0,'ritual'],['Wind-down, képernyő le','Napzárás után','t-sleep',43,0]]}};
let face='reggel', nowRow=-1, macroSel=null, fbNo=false, wkStep=0, wkRes='';
const obsState={}, evOpen={}, expMsg={};
const MAC=[['Fehérje','var(--protein)',148,220],['Szénhidrát','var(--carb)',224,380],['Zsír','var(--fat)',58,95]];
const OBS=[
  {k:'anna',h:'Anna és az alvásod',lbl:'Megfigyelés',x:'Amikor <b>Anna</b> szerepel a hála-naplódban, másnap átlag <b>40 perccel többet</b> alszol. Négy nap adata, ez még kevés. Figyeljem tovább?',ev:['4 hála-bejegyzés','4 éjszaka','+1 nap eltolás'],acts:['Igen, figyeld','Nem stimmel','Mesélj erről']},
  {k:'keso',h:'Késői vacsora és az alvás',lbl:'Figyelem',x:'Amikor 21:00 után eszel, az alvásod minősége átlag <b>1,2 ponttal</b> alacsonyabb.',ev:['6 késői vacsora','6 éjszaka'],acts:['Így van','Kivétel volt']}];

/* ── KÍMÉLŐ MÓD (kihagyás S2) ── */
const KMC=[['ILLNESS','t-ill','Beteg vagyok'],['STOMACH','t-digestion','Gyomorrontás'],['INJURY','t-pain','Sérülés / fájdalom'],['TRAVEL','t-travel','Úton vagyok']];
const KMD=[['TODAY','Csak ma',0,'ma'],['FEW','2–3 nap',2,'2–3 nap'],['WEEK','Kb. egy hét',6,'kb. egy hét'],['UNKNOWN','Nem tudom',null,'nincs']];
const KM={on:false,cat:null,dur:null,day:1,later:false,ask:false,pick:{cat:null,dur:null},applied:null,prev:null};
const kmCat=()=>KMC.find(c=>c[0]===KM.cat)||KMC[0], kmDur=()=>KMD.find(d=>d[0]===KM.dur)||KMD[3];
const kmExpired=()=>{const o=kmDur()[2];return o!=null&&KM.day-1>o};
function kmPreset(id){ if(id===KM.applied)return; KM.applied=id;
  if(id==='kimelo')Object.assign(KM,{on:true,cat:'ILLNESS',dur:'FEW',day:2,later:false,ask:false});
  if(id==='kimelo-lejart')Object.assign(KM,{on:true,cat:'STOMACH',dur:'FEW',day:4,later:false,ask:false}); }
function kmCard(i){ if(!KM.on)return ''; const c=kmCat(),d=kmDur();
  if(KM.later)return card(xrow({icon:c[1],title:`Kímélő mód · ${KM.day}. nap`,sub:'Holnap reggel újra rákérdezek, hogy vagy.',right:nl('Befejezem','kmbetter')}),{i});
  return hero({warn:true,lbl:`Kímélő mód · ${c[2]}`,verdict:'Hogy vagy?',left:hi(c[1]),
    sub:kmExpired()?'A becsült idő letelt. Hogy vagy?':`${KM.day}. nap · becslés: ${d[3]}`,
    body:KM.ask?`<p class="fh-txt" style="margin-top:12px"><b>Töröljem a kímélő módot?</b><br><span style="color:var(--sub)">A kihagyott edzések visszaállnak, mintha be se kapcsoltad volna.</span></p>`:'',
    acts:KM.ask?nb('Törlöm','kmdel','sm','style="--acc:var(--bad)"')+nb('Mégse','kmask:0','sm ghost')
      :nb('Jobban','kmbetter','sm')+nb('Még nem','kmlater','sm ghost')+nl('Tévedés volt','kmask:1')},i);
}
function kmSheet(){const p=KM.pick,c=KMC.find(x=>x[0]===p.cat);
  return `${shH('Mi történt?','Kímélő mód · szólj, és a napod hozzád igazodik. Nem kell magyarázkodnod.','','t-kimelo')}
  <div class="np-opt4">${KMC.map(([id,ic,l])=>`<button class="${p.cat===id?'on':''}" data-n="kmcat:${id}">${bub(ic,{s:48})}<span>${l}</span></button>`).join('')}</div>
  ${c?`${lab('Meddig tarthat?')}<div class="fh-pills">${KMD.map(([id,l])=>chip(l,'kmdur:'+id,p.dur===id)).join('')}</div>`:''}
  <p class="fh-txt np-why">${inl('t-heart')}<span><b>Amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.</b> Bármikor befejezheted.</span></p>
  <button class="btn np-wide" style="margin-top:14px;${c?'':'opacity:.4'}" data-n="kmon" ${c?'':'disabled'}>Kímélő mód bekapcsolása</button>`}
function kmWelcome(){const d=Math.max(1,KM.day-1),few=d<=2;
  const ramp=few?[[60,'1. edzés','⅔ sorozat · −10% súly'],[100,'2. edzés','teljes'],[100,'3. edzés','teljes']]:[[60,'1. edzés','⅔ sorozat · −10% súly'],[70,'2. edzés','⅔ sorozat'],[100,'3. edzés','teljes']];
  return `${shH('Üdv újra!','Kímélő mód vége · jó, hogy jobban vagy. Így folytatjuk:','','t-sun')}
  <div class="np-ramp">${ramp.map(([p,l,s])=>mini({p,v:l,l:s,c:p<100?'var(--warn)':'var(--ok)'})).join('')}</div>
  ${xrow({icon:'t-calendar',title:`${d} nap kiesés`,sub:few?'A programod nem csúszik, onnan folytatod, ahol abbahagytad.':'Onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz.'})}
  ${xrow({icon:'t-dumbbell',title:few?'Az első edzés könnyített':'Az első 2 edzés könnyített',sub:few?'Harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.':'Harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly.'})}
  <button class="btn np-wide" style="margin-top:16px" data-n="kmok">Rendben</button><button class="fh-lk np-ctr" data-n="kmundo">Mégsem vagyok jól</button>`}

/* ── MAI — a sima `mai` a jóváhagyott koncepció (foly.js); itt a változatai: kímélő mód, lejárt kímélő, este ── */
const OBSL={anna:[58,86,'Anna a naplóban','alvás másnap'],keso:[84,40,'vacsora 21:00 után','alvásminőség']};
function obsCard(o,i,all,g){const done=obsState[o.k],L=OBSL[o.k];
  return card(head('t-pattern',o.h,all?'Összes':'',all?{go:'uzenetek.eszrevetelek'}:null)
    +(g&&L?`<div class="np-lnk">${linked(L[0],L[1],{a:L[2],b:L[3],s:236})}</div>`:'')
    +msg('mezo',o.x,o.lbl.toLowerCase())
    +(evOpen[o.k]?chipsRow(o.ev,'Miből látom:'):'')
    +(done?acts(`<span class="np-okline">${I('i-check')}Megjegyeztem a válaszod.</span>${lk('Beszéljünk róla',{toast:'Mezo · Chat — előtöltve'})}`)
      :acts(o.acts.map((a,k)=>nb(a,'obs:'+o.k,k?'sm ghost':'sm')).join('')+nl(evOpen[o.k]?'Elrejtem':'Miből látod?','ev:'+o.k))),{i});
}
function mai(arg,evening){
  kmPreset(arg);
  const ok=!KM.on, sl=nowSlot(), d=ndTodayDims();
  const dusk=evening?{c1:'color-mix(in srgb,var(--dom) 72%,var(--ink))',c2:'color-mix(in srgb,var(--dom) 26%,var(--ink))'}:{};
  const T=nfix(evening
    ?(ND.ritual?tank({...dusk,pct:62,h:420,num:72,cap:'a 100-ból · a nap le van téve',lbl:'Este · a nap lezárva',verdict:'Letetted a napot.',air:`<span class="np-airs">Hajnalban megírom, milyen napod volt.</span>`,marks:[75,50,25],cta:'A napom',ctaAct:'nap.2026-09-24'})
      :tank({...dusk,pct:62,h:420,num:72,cap:`a 100-ból · ${ndDoneCount(d)}/6 terület kész`,lbl:'Este · napzárás',verdict:'Tegyük le a napot.',air:`<span class="np-airs">Amit megőriznél, és amit elengednél. Kb. 3 perc.</span>`,marks:[75,50,25],cta:'Napzárás indítása',ctaAct:N('ritual')}))
    :tank({pct:ok?72:62,h:ok?372:420,num:72,cap:ok?'a 100-ból · 4 jel a 7-ből':`a 100-ból · kímélő mód · ${KM.day}. nap`,lbl:'Mai állapot',verdict:ok?'Ma jó nap egy közepes edzéshez.':'Ma a pihenés a dolgod.',
      air:ok?'':`<span class="np-airs">Az edzés magától kimarad, és nem számít mulasztásnak.</span>`,marks:[75,50,25],cta:sl?`${SLOTA[sl.t]} check-in`:'Gyors logolás',ctaAct:sl?N('ck:open'):'gyors'}));
  const lv=vials([{l:'Kalória',ic:'t-flame',c:'var(--dom)',p:66,v:'2 060',s:'1 040 van még',mark:'3 100',on:{dom:'fuel'}},
    {l:'Fehérje',ic:'t-meat',c:'var(--protein)',p:67,v:'148 g',s:'72 g hiányzik',mark:'220',on:{dom:'fuel'}},
    {l:'Alvás',ic:'t-sleep',c:'var(--ok)',p:92,v:'7 ó 40',s:'átlag fölött',mark:'8 ó',on:{dom:'en'}},
    {l:'Mozgás',ic:'t-dumbbell',c:'var(--warn)',p:ok?6:0,v:ok?'0 / 2':'–',s:ok?'Pull Day vár':'kímélő · kimarad',mark:ok?'2':'szünet',on:{dom:'edzes'}}]);
  const next=[];
  if(sl)next.push({time:evening?'20:00':sl.t,title:`${SLOTA[sl.t]} check-in`,sub:`${ckSteps(sl.t).length} koppintás, kb. fél perc`,right:'Kitöltöm',now:true,attr:'data-n="ck:open"'});
  if(evening)next.push({time:'21:00',title:'Napzárás',sub:ND.ritual?'Megvolt · a nap le van téve':'Hat rövid lépés, kb. 3 perc',right:ND.ritual?'Kész ✓':'Indítom',now:!sl&&!ND.ritual,attr:ND.ritual?'data-go="nap.2026-09-24"':'data-n="ritual"'},
    {time:'21:45',title:'Esti rutin',sub:'Lecsendesítés, képernyők le',right:'Megnézem',attr:'data-go="rutin.este"'});
  else next.push({time:'18:00',title:'Röpi edzés · BVSC',sub:ok?'90 perc · feladó':'kímélő mód · nem számít mulasztásnak',right:ok?'Megnézem':'Kimarad',attr:ok?'data-dom="edzes"':'data-toast="Kímélő mód: ez az edzés most kimarad"'},
    {time:'19:30',title:'Vacsora',sub:'1 040 kcal van még · 72 g fehérje hiányzik',right:'Logolom',attr:'data-dom="fuel"'});
  const log=[['13:00','Ebéd','Csirke · édesburgonya · spenót','760','data-toast="Fuel · Mai"'],['10:00','Délelőtti check-in','Most csak ennyi · az alap megvan','✓','data-go="checkin"'],['09:15','Reggeli','Túrós zabkása áfonyával','420','data-toast="Fuel · Mai"'],['07:10','Reggeli check-in','Nyugodt ébredés, pihenve','✓','data-go="checkin"'],['tegnap','Késői vacsora · 23:35','Lazac · barna rizs · brokkoli','610','data-toast="Fuel · Mai"']];
  return page('nap',{title:'Ma',sub:'Szerda, október 7.',tab:'mai'},`
  ${kmCard(0)}${T}
  ${evening&&!ND.ritual?`<div class="np-pad rise">${chipsRow([`${ndHu(NDT.kcal)} kcal`,KM.on?'edzés · kímélő mód':`edzés ${NDT.work}/${NDT.workG}`,`check-in ${NDT.ck}/${NDT.ckG}`,`${ndDoneCount(d)}/6 terület kész`])}</div>`:''}
  ${kh('Mai szintek','Miből áll össze? ›','data-go="eletjel"',1)}
  <div class="np-pad rise" style="--i:1">${lv}</div>
  ${card(xrow({icon:'t-macro',title:'A hét üzemanyaga',sub:'napi edények és a három makró',on:{sheet:'uzemanyag'}})+xrow({icon:'t-heart',title:'Életjelek',sub:'hat jel · a mozgás kér figyelmet',v:'60',on:'eletjel'}),{i:1})}
  ${kh('Most következik',`${next.length} teendő`,'',2)}
  <div class="np-pad rise" style="--i:2">${lstream(next)}</div>
  ${kh('Észrevétel','Mezo · 4 nap adata','',3)}${obsCard(OBS[0],3,true)}
  ${card(xrow({icon:'t-calendar',title:'Heti egyeztetés',sub:'vasárnap · 1 javaslat vár · 3 lépés, kb. 2 perc',right:st('Új','plan')+chev(),on:'uzenetek'}),{i:3})}
  ${kh('Mai napló','+ Új bejegyzés','data-go="gyors"',4)}
  <div class="np-pad rise" style="--i:4">${lstream(log.map(([time,title,sub,right,attr])=>({time,title,sub,right,attr})))}
    ${acts(btn('+ Új bejegyzés','gyors','sm')+btn('Napló',{sheet:'naplopick'},'sm ghost')+lk('Több',{sheet:'tobb'}))}</div>
  ${ok?kh('Ha ma más a helyzet','','',5)+card(xrow({icon:'t-kimelo',title:'Nem vagyok jól',sub:'Kímélő mód: betegség, sérülés vagy utazás idejére',n:'km:open'}),{i:5}):''}`)}
const maieste=()=>mai('',true);

/* ── CHECK-IN (áttekintés) — a nap négy edénye, a válaszok kis szintek ── */
const ckLev=(id,a)=>{const v=a[id];if(v===null||v===undefined)return 0;if(id==='pain')return v===false?0:(v.int||5)*10;if(id==='craving')return v.v*10;return v*10};
const ckTone=(id,a)=>id==='pain'&&a[id]?'var(--warn)':'var(--dom)';
function checkin(){
  const done=SLOTS.filter(s=>s.st==='done').length, nQ=t=>ckSteps(t).length, cur=nowSlot();
  const ids=s=>ckSteps(s.t).filter((id,i,arr)=>arr.indexOf(id)===i&&id in s.a&&s.a[id]!==null);
  const cells=s=>`<div class="np-cells">${ids(s).map(id=>mini({p:ckLev(id,s.a),c:ckTone(id,s.a),v:ckDisp(id,s.a,1),l:ITEMS[id].s})).join('')}</div>`;
  const four=nfix(vials(SLOTS.map(s=>{const n=nQ(s.t),k=s.st==='done'?ids(s).length:0,isCur=s===cur;
    return {l:s.n,s:s.t,ic:s.st==='done'?'t-tick':isCur?'t-checkin':'t-clock',p:s.st==='done'?Math.round(k/n*100):isCur?5:0,v:s.st==='done'?`${k}/${n}`:isCur?'most':'–',
      mark:s.st==='done'?'kész':isCur?(s.st==='now'?'esedékes':'jön'):'később',c:s.st==='done'?'var(--ok)':'var(--dom)',on:N('ckslot:'+s.t)}}),{h:118}));
  return page('nap',{title:'Check-in',sub:`Nap · ${done} / 4 pillanatkép`,back:'mai'},`
  ${hero({lbl:'A nap négy pillanata',verdict:cur?`${cur.st==='now'?`A ${SLOTA[cur.t].toLowerCase()} most esedékes.`:`A következő: ${cur.n.toLowerCase()}, ${cur.t}.`} Fél perc.`:'Mind a négy megvan mára.',
    sub:cur?`${nQ(cur.t)} koppintás. Öt alapkérdés után bármikor kiléphetsz.`:'A válaszaid beépülnek a holnapi napodba.',
    body:`<div class="np-vh">${four}</div>`,
    acts:cur?nb('Kitöltöm','ck:open'):btn('Vissza a mai napra','mai')})}
  ${sec(1,'Mai pillanatképek',1)}
  ${card(SLOTS.map(s=>{const isCur=s===cur,dn=s.st==='done';
    return `<div class="np-slot ${isCur?'now':''} ${!dn&&!isCur?'later':''}"><div class="np-slh"><time>${s.t}</time><span class="g"><strong>${s.n}${isCur?(s.st==='now'?' · most esedékes':' · következik'):''}</strong><small>${dn?[s.note,s.quick?'Most csak ennyi · az alap megvan':''].filter(Boolean).join(' · ')||'Kitöltve':isCur?`hogy vagy most? · ${nQ(s.t)} koppintás, kb. fél perc`:`később esedékes · ${nQ(s.t)} kérdés`}</small></span>${dn?st('Kész','ok'):isCur?nb('Kitöltöm','ckslot:'+s.t,'sm'):st('Később')}</div>${dn?cells(s):''}</div>`}).join('')
    +note('Egy kapszula egy válasz: a szint a 10-es skálán adott érték. A kimaradt check-in nem vész el: pótold bármikor, a társ nem büntet.'),{i:1})}
  ${sec(2,'Mire jó ez?',2)}
  ${card(xrow({icon:'t-orb',title:'Mit táplál az új check-in?',sub:'ahol a válaszaidat észre fogod venni',on:'hatasok'})
    +xrow({icon:'t-day',title:'A napod · Te: 7/10',sub:'a te ítéleted az app pontszáma mellett',on:'napom'}),{i:2})}
  ${sec(3,'Próbáld ki bármelyik napszakot',3)}
  ${card(`<div class="fh-pills">${Object.keys(PLAN).map(t=>chip(`${SLOTN[t]} · ${nQ(t)}`,'ckslot:'+t)).join('')}</div>`+note('Csak ebben a mintában: így bármelyik napszak kérdéssora megnézhető.'),{i:3})}`);
}
/* a check-in lap (lépésenként): minden válasz egy edény, amit megtöltesz */
function ckSheet(){const S=ckSteps(),s=ck.step,slot=ck.slot,sn=SLOTN[slot],a=ck.a;
  const hd=shH('Hogy vagy?',`Check-in · ${sn} · ${slot}`,'','t-checkin')+dots(S.length+1,s,5);
  if(s<S.length){const id=S[s],it=ITEMS[id],isAd=s===S.length-1;
    const lbl=lab(`${pad2(s+1)} / ${pad2(S.length)} · ${it.n}${s<5?' · alap':isAd?' · a nap kérdése':' · '+sn}`);
    const adv=isAd?`<p class="fh-txt np-why">${inl('t-orb')}<span><b>A nap kérdése.</b> ${ADAPT[slot].why}</span></p>`:'';
    let body;
    if(it.kind==='pain'){const p=a.pain, okp=p&&p!==false&&p.regions.length&&p.int;
      const SIL='M52 4C60 4 65 10 65 18S60 32 52 32 39 26 39 18 44 4 52 4ZM44 34H60L78 44C82 46 84 50 84 54L88 108C88 112 84 114 81 112L76 60 70 62 70 110 64 190H54L52 128 50 190H40L34 110 34 62 28 60 23 112C20 114 16 112 16 108L20 54C20 50 22 46 26 44Z';
      const fig=(title,R)=>`<figure><svg viewBox="0 0 104 196"><path class="sil" d="${SIL}"/>${R.map(([r,x,y])=>`<circle class="${p&&p.regions.includes(r)?'on':''}" cx="${x}" cy="${y}" r="6.5" data-n="ckreg:${r}"><title>${r}</title></circle>`).join('')}</svg><figcaption>${title}</figcaption></figure>`;
      body=`<div class="np-two" style="margin-top:12px"><button class="btn ${p===false?'':'ghost'}" data-n="ckpain:no">Nem</button><button class="btn ${p&&p!==false?'':'ghost'}" data-n="ckpain:yes">Igen</button></div>`+
        (p&&p!==false?`${lab('Hol fáj? · többet is választhatsz')}<div class="np-fig">${fig('Elöl',REG_F)}${fig('Hátul',REG_B)}</div>
        <div class="fh-pills">${[...REG_F,...REG_B].map(r=>r[0]).concat(['Egyéb']).map(r=>chip(r,'ckreg:'+r,p.regions.includes(r))).join('')}</div>
        ${lab(`Mennyire fáj · ${p.int?p.int+' / 10':'koppints'}`)}${scale(p.int||0,'cks')}${ends('Alig','Nagyon')}
        <button class="btn np-wide" style="margin-top:14px;${okp?'':'opacity:.4'}" data-n="ckstep:${s+1}" ${okp?'':'disabled'}>Tovább</button>`:'');
    }else{const cv=it.kind==='craving'?(a.craving?a.craving.v:null):a[id];
      body=`<div class="np-bigrow">${jar(cv?cv*10:0,{s:66})}<span class="fh-big">${cv||'–'}<small>/ 10</small></span><span class="np-end">${bub(it.ic,{s:52})}</span></div>${scale(cv||0,'cks')}${ends(it.lo,it.hi)}`;
      if(it.kind==='craving'&&cv>=4){const k=a.craving.kinds;
        body+=`${lab('Mit kívánsz?')}<div class="fh-pills">${KINDS.map(x=>chip(x,'ckkind:'+x,k.includes(x))).join('')}</div><button class="btn np-wide" style="margin-top:14px" data-n="ckstep:${s+1}">Tovább</button>`}}
    const coremsg=s===5?`<p class="np-okline" style="margin-top:12px">${I('i-check')}Az alap megvan. Innen bármikor kiléphetsz.</p>`:'';
    return `${hd}${lbl}${adv}<p class="np-q">${it.q}</p>${body}${coremsg}
    <div class="np-nav">${s?nl('‹ Vissza','ckstep:'+(s-1)):'<span></span>'}${s>=5?nl('Most csak ennyi','ckquick'):''}${nl('Kihagyom ›','ckskip')}</div>`}
  return `${hd}${lab('Megvan · összegzés')}<p class="np-q">Bármi még, amit szeretnél?</p>
    ${ck.quick?`<p class="fh-txt np-why">${inl('t-tick')}<span><b>Most csak ennyi.</b> Az alap megvan. A többi kérdés üres marad, a check-in így is beszámít.</span></p>`:''}
    <div class="np-sum">${S.map((id,i)=>{const it=ITEMS[id],d=ckDisp(id,a),has=d!==null&&d!=='—';return xrow({icon:it.ic,title:it.n+(i===S.length-1?' · a nap kérdése':''),v:d===null?'üres':d==='—'?'kihagyva':d,n:'ckstep:'+i,right:' ',more:level(ckLev(id,a),{c:has?ckTone(id,a):'var(--faint)',h:8})})}).join('')}</div>
    ${lab('Gondolatok · opcionális')}${area('pl. „tegnap röpi után még izomláz” · „fejes meeting előtt”','Tegnap röpi után még izomlázam van, és délután nehéz meeting jön.')}
    <button class="btn np-wide" style="margin-top:16px" data-n="cksave">Mentés · ${slot}</button>`;
}

/* ── MIT TÁPLÁL AZ ÚJ CHECK-IN — egy forrás-edény négy csoportot táplál ── */
function feed(G){const X=[40,120,200,280],id=F.uid('nf');
  return `<svg class="np-feed" viewBox="0 0 320 166" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--liq1)"/><stop offset="1" stop-color="var(--liq2)"/></linearGradient>
    <clipPath id="${id}s"><rect x="98" y="6" width="124" height="52" rx="24"/></clipPath>${X.map((x,i)=>`<clipPath id="${id}c${i}"><rect x="${x-27}" y="96" width="54" height="64" rx="22"/></clipPath>`).join('')}</defs>
    <path d="M160 54V76M40 98V84Q40 76 48 76H272Q280 76 280 84V98M120 76V98M200 76V98" fill="none" stroke="var(--liq1)" stroke-width="7" stroke-linecap="round" opacity=".7"/>
    <rect x="98" y="6" width="124" height="52" rx="24" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="2"/><g clip-path="url(#${id}s)"><rect x="98" y="18" width="124" height="44" fill="url(#${id})"/></g>
    <text x="160" y="44" text-anchor="middle" class="np-ft1">14 kérdés</text>
    ${X.map((x,i)=>{const n=G[i][1].length;return `<rect x="${x-27}" y="96" width="54" height="64" rx="22" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="2"/><g clip-path="url(#${id}c${i})"><rect x="${x-27}" y="${160-n*13}" width="54" height="70" fill="url(#${id})"/></g><text x="${x}" y="150" text-anchor="middle" class="np-ft2">${n}</text>`}).join('')}</svg>
  <div class="np-feedl">${G.map(([t])=>`<span>${t}</span>`).join('')}</div>`}
function hatasok(){
  const C=[
    ['mezo','Társ · beszélgetés','Mezo · minden választ lát, nem csak az energiát és a stresszt',['„Látom, reggel fájt a térded. Ma a guggolás helyett legyen lábtoló?”','„Délben már éhes voltál és nyűgös — ettél azóta rendesen?”'],['fájdalom','éhség','hangulat']],
    ['deru','Figyelmeztető kártyák · 4 új','Derű · a csapat orvosa',['Harmadik napja fáj a térded. Érdemes ránézni.','Két reggel egymás után nem pihented ki magad.','Sokszor kívánsz mostanában édeset, főleg délután.','Pár napja alacsony a kedved. Kisebb lépések?'],['fájdalom','kipihentség','sóvárgás','motiváció'],'Holnap könnyítsünk'],
    ['mocor','Edzés','Mocor · edző',['Mai állapot: könnyebb nap javasolt — rosszul pihented ki magad (4/10), erős az izomláz (7/10).','A fájó vállat terhelő gyakorlatnál: „ma óvatosan”.','A Pull Day után nálad kb. 2 napig tart az izomláz.'],['kipihentség','izomláz','fájdalom','motiváció'],'Megnézem az Edzés mintában'],
    ['falat','Étkezési tanácsadó','Falat · táplálkozás',['10-kor már 7/10 éhes voltál — kevés volt a reggeli. Holnap tegyél bele még kb. 20 g fehérjét.','Most sósat kívánsz: egy marék pörkölt mandula jobb választás, mint a chips.','A babos ebédek után 3-ból 3-szor nehéz volt a gyomrod délután — legközelebb kisebb adag?'],['éhség','sóvárgás','emésztés']],
    ['falat','Érzelmi evés','Falat · táplálkozás',['Nem a stresszből találgatunk: a sóvárgásos napokon 2× több feldolgozott étel került a tányérodra, és ezek jellemzően rossz hangulatú napok voltak.'],['sóvárgás','hangulat','stressz']],
    ['szunya','Alvás','Szunya · alvás',['Neked kb. 7,5 óra alvás elég: ennél többtől már nem leszel kipihentebb. Beállítsam ezt alváscélnak?'],['reggeli kipihentség','alvásnapló'],'Legyen ez a cél'],
    ['mezo','Mintakereső · új összefüggések','Mezo · 14 új párt figyel',['Rossz alvás után másnap többször sóvárogsz (5 esetből 4).','Edzéses napokon átlagosan 1,2 ponttal jobb a hangulatod.','Emberekkel töltött napokon +1,4 a hangulatod — ezt eddig a fejtisztaságból számoltuk, most a valódi hangulatodból.'],['hangulat','sóvárgás','kipihentség','éhség','motiváció']],
    ['mezo','Csapat · mindenki kap új témát','Szunya · Falat · Derű · Mocor · Mezo',['Derű: „A derekad 2 hete visszatérő, főleg az ülős napokon.”','Szunya: a kipihentségedből kiszámolja, mennyi alvás kell neked.','Falat: mi előzi meg a sóvárgást — rövid alvás, stressz vagy kevés fehérje.','Derű: amit a naplóba írsz és ahogy a hangulatod értékeled, 5 napból 4-szer egyezik.','Mocor: reggel magas kedv → az esetek 80%-ában meg is lett az edzés.','Mocor: melyik edzés után meddig tart az izomláz.','Mezo: kikkel töltött napokon jobb a hangulatod.'],['mindegyik új kérdés']],
    ['mezo','Kapcsolat jel · életjelek','Mezo · emberek',['A Kapcsolat jelet mostantól az tölti, mennyire érezted magad kapcsolódva — nem az, hogy kitöltötted-e a check-int.','„Azokon a napokon, amikor Annával beszéltél, 8/10 a kapcsolódásod.”'],['kapcsolódás','napló-említések']],
    ['mocor','Életcélok','Mocor · fegyelem',['„Ha nincs kedvem (kedv ≤ 4) → akkor csak 10 perc séta.” — a terved ma egyszer beindult.','A lelki pillér a valódi hangulatodat mutatja, nem a fejtisztaságot.'],['motiváció','hangulat','kipihentség']],
    ['mezo','Esti napzárás és napi pontszám','A napod',['Te: 7/10 · App: 64/100 — „Az app szerint közepes nap, szerinted jó volt.”','A napzárás nem kérdezi meg újra, csak jelzi, hogy 7/10-re értékelted.'],['a nap mérlege'],'','napom'],
    ['mezo','Napi összefoglaló, emlékezet','Mezo · visszatekintés',['„Kedd: rövid éjszaka, délelőtt fájt a hátad, délután nyűgös voltál és édeset kívántál — este mégis jónak érezted a napot.”','Egy hónap múlva is emlékszik: „Legutóbb a hosszú autóút után fájt így a derekad.”'],['minden válasz']],
    ['mezo','Heti nézet','Én · a heted',['Az energia mellett a hangulatod heti görbéje is megjelenik.'],['hangulat','energia']]];
  const G=[['A csapat hangja',[0,1,7]],['Edzés, étel, alvás',[2,3,4,5]],['Minták és célok',[6,8,9]],['A napod képe',[10,11,12]]];
  const one=(i,open)=>{const [w,t,sub,say,from,a,link]=C[i];
    return `<details class="np-d" ${open?'open':''}><summary>${who(w,34)}<span class="g"><strong>${t}</strong><small>${pad2(i+1)} · ${sub}</small></span>${chev()}</summary>
      <div class="np-db">${say.map(x=>`<p class="fh-txt np-say">${x}</p>`).join('')}${chipsRow(from,'Miből:')}
      ${a||link?acts((a?btn(a,{toast:'Rendben — a mintában itt megáll.'},'sm ghost'):'')+(link?lk('Megnézem',link):'')):''}</div></details>`};
  return page('nap',{title:'Mit táplál?',sub:'Check-in · 13 terület',back:'checkin'},`
  ${hero({lbl:'Check-in 2.0 · minta',verdict:`A válaszaid ${C.length} helyen jelennek meg.`,sub:'Egy forrásból négy irányba folyik tovább, amit megadsz. Mindegyik területnél példák: itt veszed majd észre.',
    body:`<div class="np-feedw">${feed(G)}</div>`,acts:nb('Kitöltöm a check-int','ck:open')})}
  ${G.map(([t,idx],g)=>sec(g+1,`${t} · ${idx.length}`,g+1)+card(idx.map((i,k)=>one(i,g===0&&k===0)).join(''),{i:g+1})).join('')}
  <p class="fh-note np-out">Üres válasz sehol nem számít: amit kihagysz, azt semmi nem veszi „közepesnek”.</p>`);
}

/* ── ÉLETJELEK — hat kémcső, az alacsony megjelölve ── */
const needAct=a=>a==='water'?{on:{toast:'+250 ml víz — rögzítve'}}:a==='sleep'?{on:{sheet:'sleep'}}:a==='checkin'?{n:'ck:open'}:a==='meal'?{on:{toast:'Fuel · Logolás'}}:a==='train'?{on:{toast:'Edzés · Mai'}}:{};
const needSub=a=>a==='water'?'koppintás: +250 ml':a==='sleep'?'koppintás: alvás rögzítése':a==='checkin'?'koppintás: a következő check-in':a==='meal'?'koppintás: étkezés logolása':a==='train'?'koppintás: Edzés':'magától töltődik a rutinból';
const needAvg=()=>Math.round(NEEDS.reduce((a,n)=>a+n[2],0)/NEEDS.length);
/* go: minden kémcső az Életjelekre visz (Beszélgetés fül); különben a jel saját logolása */
const needVials=(h,go)=>`<div class="np-vh np-six">${nfix(vials(NEEDS.map(([l,ic,p,a])=>({l,ic,p,v:p,c:p<40?'var(--warn)':'var(--dom)',mark:p<40?'figyelj':'',
  on:go?'eletjel':a==='checkin'?N('ck:open'):a?needAct(a).on:{toast:'Rend · magától töltődik a rutinból'}})),{h}))}</div>`;
function eletjel(){
  return page('nap',{title:'Életjelek',sub:'Nap · a hat jel',back:'mai'},`
  ${hero({lbl:`A hat jel · átlag ${needAvg()}`,verdict:'Egy jel kér figyelmet: a mozgás.',sub:'A többi öt rendben van. Egy rövid séta már megmozdítja.',body:needVials(132),acts:btn('Edzés megnyitása',{toast:'Edzés · Mai'})})}
  ${sec(1,'A hat jel egyenként',1)}
  ${card(NEEDS.map(([l,ic,p,a])=>xrow({icon:ic,title:l,sub:needSub(a),v:p+'<small>%</small>',more:level(p,{c:p<40?'var(--warn)':'var(--dom)',h:10}),right:a?'':' ',...needAct(a)})).join('')
    +note('Színt csak az kap, ami figyelmet kér. A szintek nem büntetnek, csak jelzik, mi kér figyelmet. Koppints egy jelre a logolásához.'),{i:1})}`);
}

/* ── KÜLDETÉSEK — edények, amik maguktól telnek ── */
function kuldetesek(arg){const none=arg==='ures', done=QUESTS.filter(q=>q.st==='done').length, open=QUESTS.find(q=>q.st!=='done'&&q.cta);
  const qv=`<div class="np-vh">${vials(none?[1,2,3].map(()=>({l:'holnap',p:0,v:'–',mark:'üres',c:'var(--faint)',on:{toast:'Holnap reggel új ajánlatok érkeznek'}}))
    :QUESTS.map(q=>({l:q.s,s:q.st==='done'?'jóváírva':'folyamatban',ic:q.ic,p:q.p,v:`+${q.xp} XP`,mark:q.st==='done'?'kész':'',c:q.st==='done'?'var(--ok)':'var(--dom)',on:{toast:q.t}})),{h:116})}</div>`;
  const foot='<p class="fh-note np-out">A küldetés ajánlat: ha kimarad, csendben lejár, bukás nincs. A Csere naponta egyszer ingyenes.</p>';
  return page('nap',{title:'Napi küldetések',sub:'Nap · ajánlatok mára',back:'mai'},none?`
  ${hero({lbl:'Mai ajánlatok',verdict:'Ma nincs kisorsolt küldetés.',sub:'Holnap reggel új ajánlatok érkeznek. Addig a napod a szokott rendben megy.',body:qv,acts:btn('Vissza a mai napra','mai')})}
  ${sec(1,'Mai ajánlatok',1)}${card(empty('t-quest','Nincs mára küldetés.'),{i:1})}${foot}`:`
  ${hero({lbl:`Mai ajánlatok · +${QUESTS.reduce((a,q)=>a+q.xp,0)} XP`,verdict:`${done} kész a ${QUESTS.length} ajánlatból.`,sub:'A többi magától telik, ahogy a napod halad.',body:qv,acts:open?btn(open.cta+' megnyitása',{toast:open.cta+' · Mai'}):''})}
  ${sec(1,'Mai ajánlatok',1)}
  ${card(QUESTS.map((q,i)=>xrow({icon:q.ic,title:q.t,sub:(q.why?q.why+'<br>':'')+(q.st==='done'?`kész · +${q.xp} XP jóváírva`:q.foot),
    more:level(q.p,{c:q.st==='done'?'var(--ok)':'var(--dom)',h:8})+(q.st==='done'||!rerolls?'':`<span class="np-inacts">${nl(`Csere · ${rerolls} maradt`,'reroll:'+i)}</span>`),right:q.st==='done'?st('Kész','ok'):st(`+${q.xp} XP`,'plan')})).join(''),{i:1})}${foot}`);
}

/* ── RUTIN — a lánc összekötött cseppek sora, pipálásra telik ── */
const rowAttr=(r,i)=>r[6]==='reflect'?'data-sheet="reflect"':r[6]==='ritual'?'data-go="napzaras.1"':`data-n="tick:${i}"`;
function rutin(arg){ if(arg&&RUTIN[arg])face=arg;
  const R=RUTIN[face], done=R.rows.filter(r=>r[4]).length, strs=R.rows.filter(r=>r[3]!=null);
  const avg=Math.round(strs.reduce((a,r)=>a+r[3],0)/strs.length);
  const nx=nowRow>=0&&R.rows[nowRow]&&!R.rows[nowRow][4]?nowRow:R.rows.findIndex(r=>!r[4]), all=nx<0;
  return page('nap',{title:'Rutin',sub:'Nap · ma, szerda',tab:'rutin'},`
  <div class="np-pre rise"><div class="fh-seg">${[['reggel','Reggel'],['napkozben','Napközben'],['este','Este']].map(([k,l])=>`<button class="${k===face?'on':''}" data-n="face:${k}">${l}</button>`).join('')}</div></div>
  ${hero({lbl:`${R.title} · <b class="np-cnt">${done}/${R.rows.length}</b> kész`,verdict:all?'Mind megvan. Szép munka.':`Most jön: ${R.rows[nx][0]}.`,sub:all?'Holnap ugyanitt folytatódik.':`${R.rows.length} elem · lánc · ${R.rows[nx][1]}`,
    body:drops(R.rows.map((r,i)=>({k:r[4]?'d':i===nx?'now':'',attr:rowAttr(r,i),label:r[0]})),'big'),
    acts:(all?'':`<button class="btn" ${rowAttr(R.rows[nx],nx)}>${R.rows[nx][6]==='reflect'?'Válaszolok':R.rows[nx][6]==='ritual'?'Napzárás indítása':'Megvan, pipálom'}</button>`)
      +lk('‹ Tegnap',{toast:'Tegnap — csak a kézi, kimaradt elemek pipálhatók'})+`<span class="fh-lk" style="opacity:.35">Holnap ›</span>`},1)}
  ${sec(1,'A lánc sorrendben',2)}
  ${card(R.rows.map((r,i)=>{const [n,s,ic,str,dn,link]=r;return xrow({cls:(dn?'done ':'')+(i===nx?'now':''),left:tk(dn,rowAttr(r,i),n),icon:ic,
    title:link?`<button class="np-tl" data-toast="Megnyitom a videót">${n}</button>`:n,sub:(i===nx?'<b class="np-now">Most jön</b> · ':'')+s,v:str!=null?str+'<small>%</small>':null,more:str!=null?level(str,{h:8}):''})}).join('')
    +note('A sor végén a szám a szokás 28 napos ereje.'),{i:2})}
  ${sec(2,'Az utolsó 28 nap',3)}
  ${card(facts([[R.stat[0],R.stat[1]],[`${avg}%`,'lánc-erő · 28 nap'],[`+${R.xp}`,'XP ma']])+g28(face==='este'?3:1,[],[],28,true)+note('Egy kémcső egy nap: annyira van tele, amennyi a láncból megvolt. A lánc-erő az elmúlt 28 nap következetessége: egy kihagyás nem nulláz, csak halványít.'),{i:3})}
  ${sec(3,'Szerkesztés',4)}
  ${card(xrow({icon:'t-chain',title:'Rutinok szerkesztése',sub:'láncok, szokások, új szokás',on:'rutin-epites'}),{i:4})}`);
}

/* ── BESZÉLGETÉS (Mezo · ma) — a heti egyeztetés három edénye ── */
const WK=[['Miért most?','Vasárnap van, és egy hét adata gyűlt össze: 5 edzés, 19 étkezés, 24 check-in.'],['Mi történt?','A fehérje átlag 162 g lett a 220 g-os célból. Az alvás 7 ó 10 p átlag, kedd és szerda rövid.'],['Javaslat','A fehérjecél 200 g-ra igazítása: reálisabb, és a testsúly-trend így is tartja az irányt.']];
function uzenetek(tab){ tab=tab||'uzenetek';
  const TABS=[['uzenetek','Üzenetek',1],['eletjelek','Életjelek',1],['eszrevetelek','Észrevételek',0]];
  const wk3=`<div class="np-vh np-wk3">${vials(WK.map((w,i)=>({l:w[0],p:wkRes||i<wkStep?100:i===wkStep?52:0,v:i+1,mark:wkRes||i<wkStep?'kész':i===wkStep?'most':'',c:wkRes==='ok'?'var(--ok)':'var(--dom)',on:{toast:w[0]+' '+w[1]}})),{h:62})}</div>`;
  let body='';
  if(tab==='uzenetek') body=`
    ${wkRes?hero({lbl:'Heti egyeztetés · kész',verdict:wkRes==='ok'?'Elfogadtad: a fehérjecél 200 g.':'Ezt most kihagytad. Marad minden.',sub:'Jövő vasárnap újra összeülünk.',left:who('mezo',64),body:wk3,acts:btn('Beszélgess Mezóval',{toast:'Mezo · Chat'})},1)
      :hero({lbl:`Heti egyeztetés · ${wkStep+1} / 3`,verdict:WK[wkStep][0],sub:WK[wkStep][1],left:who('mezo',64),body:wk3,
        acts:wkStep<2?nb('Tovább','wk:next')+nl('Ezt kihagyom','wk:skip'):nb('Elfogadom','wk:accept')+nl('Marad a 220 g','wk:skip')},1)}
    ${sec(1,'Ma reggel',2)}
    ${card(msg('mezo','Jó reggelt — Week 3, Day 4, és érzed a tempót. Tegnap Push Day-en a Lat Pulldown 105 kg × 9 ment RIR 1-re, ma a hátad pihen.<br><br>Az alvásod 7,4 óra volt, a reggeli check-in nyugodt. Ma délben érdemes a fehérjét előrehozni.','06:30 · reggeli briefing')
      +lab('Amire épült')+chipsRow(['Push Day · tegnap','Chest Row 105,8 · márc 4','késő szénhidrát ↔ alvás'])
      +lab('Miből gondolom')+`<div class="np-f2"><div>${inl('t-sleep')}7,4 óra alvás, 2 ébredés</div><div>${inl('t-checkin')}Reggeli check-in: energia 7/10</div></div>`
      +acts(`<span class="np-ask">Segített?</span>${btn('Segített',{toast:'Köszönöm — ezt megjegyzem'},'sm ghost')}${nb('Nem talált','fbno','sm ghost')}`)
      +(fbNo?`<div class="fh-pills" style="margin-top:10px">${['pontatlan','túl sok','rossz időzítés','nem rólam szól'].map(r=>`<button class="fh-pill" data-toast="Köszönöm, finomítok">${r}</button>`).join('')}</div>`:''),{i:2})}
    ${sec(2,'Korábbi üzenetek',3)}
    ${card([['szunya','Tegnap 21:48 · esti visszanézés','Szép nap volt: 3 szokás, 2 check-in és egy erős edzés.'],['mocor','Tegnap 14:10 · délutáni jelzés','Alacsony az energiád — egy rövid séta többet ad, mint a harmadik kávé.']].map(([w,h,p],i)=>
      expMsg[i]?`<div class="fh-row">${msg(w,p,h)}</div>`:xrow({left:who(w,36),title:F.TEAM[w][0],sub:h+'<br>'+p.slice(0,38)+'…',n:'exp:'+i})).join(''),{i:3})}
    ${sec(3,'Írj vissza',4)}
    ${card(xrow({left:who('mezo',36),title:'Beszélgess Mezóval',sub:'kérdezz, mesélj, vagy beszéljük át a napot',on:{toast:'Mezo · Chat'}}),{i:4})}`;
  if(tab==='eletjelek') body=`
    ${hero({lbl:`Életjelek · ma · átlag ${needAvg()}`,verdict:'A mozgás az egyetlen, ami figyelmet kér.',sub:'A többi öt jel rendben van. Koppints bármelyikre a részletekért.',body:needVials(104,true),acts:btn('Részletek','eletjel')},1)}
    ${sec(1,'Amit a csapat mond',2)}
    ${card(msg('mocor','<b>Ma még alig mozdultál.</b> Egy 10 perces séta ebéd után elég, hogy a szint megmozduljon. Nem kell edzés.','mozgás · 34%')+acts(btn('Megnézem',{toast:'Edzés · Mai'},'sm ghost')),{i:2})}`;
  if(tab==='eszrevetelek'){const left=OBS.filter(o=>!obsState[o.k]).length; body=`
    ${hero({lbl:'Észrevételek · ma',verdict:left?`${left===2?'Két':'Egy'} észrevétel vár a válaszodra.`:'Mindkettőre válaszoltál. Köszönöm.',sub:'Ma még 2 észrevétel fér a keretbe · 22:00 után csendben maradok.',left:who('mezo',64),acts:btn('Beszéljük meg',{toast:'Mezo · Chat'})},1)}
    ${OBS.map((o,i)=>sec(i+1,o.lbl,i+2)+obsCard(o,i+2,false,true)).join('')}`}
  return page('nap',{title:'Beszélgetés',sub:'Mezo · ma · 4 üzenet',tab:'uzenetek'},`
  <div class="np-pre rise"><div class="fh-seg">${TABS.map(([k,l,d])=>`<button class="${k===tab?'on':''}" data-go="uzenetek${k==='uzenetek'?'':'.'+k}">${l}${d&&k!==tab?'<i class="np-dot"></i>':''}</button>`).join('')}</div></div>${body}`);
}

/* ── GYORS LOGOLÁS — kilenc buborék egy edényben ── */
const QT=[['Étkezés','t-bowl','data-toast="Fuel · Logolás"'],['Víz','t-water','data-sheet="water"'],['Stack','t-supps','data-toast="Fuel · Kiegészítők"'],['Edzés','t-dumbbell','data-toast="Edzés · Mai"'],['Sport','t-volley','data-sheet="sport"'],['Súly','t-weight','data-sheet="weight"'],['Check-in','t-checkin','data-n="ck:open"'],['Napló','t-journal','data-sheet="naplopick"'],['Alvás','t-sleep','data-sheet="sleep"']];
function gyors(){return page('nap',{title:'Gyors logolás',sub:'Nap · új bejegyzés',back:'mai'},`
  <section class="np-qtank rise"><div class="air"><small>Mi érkezett?</small><p>Egy pillanat, és a napod része.</p>
    <button class="np-qchat" data-toast="Mezo · Chat">${who('mezo',40)}<span class="g"><strong>Mondd el Mezónak</strong><small>kérdezz, mesélj — vagy logolj szóban</small></span>${chev()}</button></div>
    <div class="liq">${wave('var(--liq1)',.55,'b')}${wave('var(--liq1)')}<span class="lb">vagy válassz</span>
      <div class="np-bubs">${QT.map(([l,ic,a])=>`<button ${a}>${bub(ic,{s:62,c:'var(--liq2)'})}<span>${l}</span></button>`).join('')}</div></div></section>
  <p class="fh-note np-out">Kilenc buborék, kilenc bejegyzés-fajta. Amit Mezónak elmondasz, azt ő írja be helyetted.</p>`)}

/* ── NAPZÁRÁS (6 lépés, teljes képernyő) — a nap edénye megtelik, aztán fedelet kap ── */
function napzaras(arg){const a=Math.min(6,Math.max(1,+arg||1));
  const NAME=['Indulás','A napod íve','A szavaid','Nyitott hurkok','A mai termés','Lezárva'];
  const foot=(l='Tovább',extra='')=>a<6?`${extra}<button class="btn" style="flex:1" data-go="napzaras.${a+1}">${l}</button>`:`<button class="btn" style="flex:1" data-go="rutin.este">Esti rutin indítása</button>`;
  const SRC=[['t-dumbbell','Edzés',80],['t-quest','Küldetések',40],['t-chain','Rutin',25],['t-volley','Sport',25],['t-journal','Napló',15]];
  const strata=`<div class="np-strata"><span class="v">${SRC.map(([,,v],i)=>`<i style="flex:${v};--m:${100-i*17}%"></i>`).join('')}</span><ol>${SRC.map(([ic,l,v])=>`<li style="flex:${v}"><b>+${v}</b>${l}</li>`).join('')}</ol></div>`;
  const A={
    1:[hero({lbl:'Napzárás',verdict:'A nap véget ért.',sub:'Zárjuk le együtt. Amit ma összegyűjtöttél, edénybe kerül, a végén fedelet kap. Kb. 3 perc.',left:jar(72,{s:88,t:'72'}),big:true})
      +sec(1,'Ez jön',1)+card(NAME.slice(1).map((n,i)=>step({time:i+2+'.',icon:['t-trend','t-journal','t-ring','t-harvest','t-sleep'][i],title:n,sub:['hogyan telt a mai nap','ami megmaradna belőle','amit még le lehet zárni','amit ma összegyűjtöttél','és jöhet az este'][i]})).join(''),{i:1}),foot('Kezdjük')],
    2:[hero({lbl:'A napod íve',verdict:'Így telt a mai nap.',sub:'Három pont megvan, az este még előtted.',
        body:`<div class="np-arcw">${farea([6.4,7,7.9,7.5,6.3,6.6,7],{h:132,min:3,max:9.4,dots:[7,8,6,null],labels:['reggel','délelőtt','délután','este']})}</div>${note('A felszín az energiád a mai check-inekből (7 · 8 · 6). Az esti pont még üres.')}`})
      +sec(1,'A nap számai',1)+card([['t-dumbbell','Push Day','kész ✓'],['t-bowl','3 étkezés','112 g fehérje'],['t-sleep','Alvás','7,4 óra'],['t-checkin','Check-in','3 / 4']].map(([ic,l,m])=>xrow({icon:ic,title:l,v:m})).join(''),{i:1}),foot()],
    3:[hero({lbl:'Ma milyen volt',verdict:'Milyen volt a napod valójában?',sub:'Az esti check-inben <b>7/10</b>-re értékelted a napot. Ide már csak a szavaid kellenek.',left:jar(70,{s:84,t:'7'})})
      +sec(1,'A szavaid',1)+card(area('Írd le, ahogy volt — senki más nem olvassa…','Ma nyugodtabb voltam, mint tegnap, a délutáni séta sokat segített.'),{i:1})
      +sec(2,'Amiért hálás vagy',2)+card([['1. dolog, amiért hálás vagy…','A reggeli kávé a teraszon.'],['2. dolog…','Anyával beszéltem telefonon.'],['3. dolog…','Végre jól aludtam.']].map(([p,s],i)=>`<div ${i?'style="margin-top:8px"':''}>${inp(p,s)}</div>`).join('')+note('Legfeljebb három sor, és teljesen opcionális.'),{i:2}),
      foot('Tovább',btn('Ma nem írok','napzaras.4','ghost'))],
    4:[hero({lbl:'Nyitott hurkok',verdict:'Zárd le, ami még nyitva.',sub:'Aztán elengedheted.',
        body:`<div class="np-vh">${nfix(vials([{l:'Check-in',s:'3 / 4 kész',ic:'t-checkin',p:75,v:'3/4',mark:'nyitva',on:N('ckslot:20:00')},{l:'Szándék',s:'nyugodt tempó',ic:'t-ring',p:0,v:'?',mark:'nyitva',on:{toast:'Lent válaszolhatsz: Igen · Részben · Nem'}},{l:'Napló',s:'egy apró lépés',ic:'t-journal',p:0,v:'+',mark:'nyitva',on:{sheet:'activity'}}],{h:92}))}</div>`})
      +sec(1,'Három apróság',1)+card(xrow({icon:'t-checkin',title:'20:00 check-in kimaradt',sub:'3 / 4 check-in kész',right:nb('Kitöltöm','ckslot:20:00','sm')})
        +xrow({icon:'t-ring',title:'Szándékkal élted a napot?',sub:'a mai szándékod: „nyugodt tempó”',more:`<span class="fh-pills np-inacts">${['Igen','Részben','Nem'].map(x=>`<button class="fh-pill" data-n="pick:A mai szándékodra reflektáltál.">${x}</button>`).join('')}</span>`})
        +xrow({icon:'t-journal',title:'Történt még valami ma?',sub:'egy apró lépés is számít',right:btn('Napló',{sheet:'activity'},'sm ghost')}),{i:1}),foot()],
    5:[hero({lbl:'A mai termés',verdict:'+185 XP',big:true,sub:'Ennyit gyűjtöttél ma, öt forrásból. Egy edényben, rétegenként:',body:strata})
      +sec(1,'Hol tartasz',1)+card(xrow({icon:'t-heart',title:'Tudatosság · Lv 4',sub:'a következő szintig',v:'68<small>%</small>',more:level(68,{h:10})})
        +xrow({icon:'t-coin',title:'Érme',sub:'a mai küldetésekből',v:'+12'})
        +xrow({icon:'t-flame',title:'12 napos sorozat él',sub:'a 28 napból 24-en ment végig a rutin'})
        +xrow({icon:'t-sprout',title:'86 napja életben',sub:'ennyi ideje vezeted a napjaidat'}),{i:1}),foot()],
    6:[hero({lbl:'Napzárás · kész',verdict:'A nap le van zárva.',sub:'Elengedheted. Az edény tele van, a fedél rajta.',left:jar(100,{s:92,t:'7/7',lid:true})})
      +sec(1,'Mezo üzeni',1)+card(msg('mezo','„Ma nem a súlyok voltak nehezek, hanem a délután — és mégis megcsináltad. Aludj rá egyet.”','napzárás'),{i:1})
      +sec(2,'Most jön · alvás-előkészítés',2)+card(step({time:'21:45',icon:'t-sleep',title:'Lecsendesítés',sub:'képernyők le'})+step({time:'22:30',icon:'t-moon',title:'Villanyoltás',sub:'jó éjszakát'}),{i:2}),foot()]};
  return page('nap',{title:'Napzárás',sub:`${a} / 6 · ${NAME[a-1]}`,back:'mai'},`<div class="np-nz"><div class="np-pre rise">${dots(6,a-1)}</div>${A[a][0]}</div>`,{foot:lk('Kilépés','mai')+A[a][1],nonav:true,pad:'120px'});
}

/* ── A NAPOM · napi nézet ── */
const ndHu=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const ND={phase:'day',open:new Set(),adj:false,ritual:false};
const NDT={kcal:2060,kcalG:2782,prot:148,protG:166,nova:68,micro:80,work:0,workG:1,sleepMin:436,sleepQ:7,ck:2,ckG:4,rhythm:74,updated:'14:20'};
const ND_DIM=[['nutrition','Tápanyag','t-bowl'],['quality','Minőség','t-sprout'],['training','Edzés','t-dumbbell'],['sleep','Alvás','t-sleep'],['logging','Logolás','t-checkin'],['rhythm','Ritmus','t-chain']];
function ndTodayDims(){const t=NDT,nut=Math.round((Math.min(1,t.kcal/t.kcalG)+Math.min(1,t.prot/t.protG))/2*100);
  return {nutrition:{pct:nut,big:ndHu(t.kcal),unit:'kcal',v:`${ndHu(t.kcal)} / ${ndHu(t.kcalG)} kcal · fehérje ${t.prot} / ${t.protG} g`,st:nut>=95?'kész':'úton'},
    quality:{pct:Math.round((t.nova+t.micro)/2),big:Math.round((t.nova+t.micro)/2),unit:'%',v:`feldolgozatlan ${t.nova}% · mikro ${t.micro}%`,st:'úton'},
    training:{pct:t.work/t.workG*100,big:`${t.work}/${t.workG}`,unit:'',v:t.work?'a mai edzés megvolt':'a mai edzés még hátravan',st:t.work>=t.workG?'kész':'nyitva'},
    sleep:{pct:86,big:`${Math.floor(t.sleepMin/60)}ó ${t.sleepMin%60}p`,unit:'',v:`minőség ${t.sleepQ}/10 · az éjszaka lezárult`,st:'kész'},
    logging:{pct:t.ck/t.ckG*100,big:`${t.ck}/${t.ckG}`,unit:'',v:'check-in · a nap négy pillanata',st:t.ck>=t.ckG?'kész':'úton'},
    rhythm:{pct:t.rhythm,big:t.rhythm,unit:'',v:'a heted eddigi üteme',st:'kész'}}}
const ndDoneCount=d=>Object.values(d).filter(x=>x.st==='kész').length;
function ndReading(){const t=NDT,need=Math.max(0,t.protG-t.prot);
  if(!t.work&&need>0)return `Fehérjéből már csak ${need} g hiányzik, az edzés még hátravan.`;
  if(!t.work)return 'A tányér rendben van, már csak az edzés maradt a mai napból.';
  if(t.ck<t.ckG)return 'Az edzés megvolt. Egy esti check-in, és kerek a nap.';
  return 'Minden a helyén. Ma este nyugodtan zárhatod a napot.'}
function ndLead(){const t=NDT;
  if(ND.phase==='evening'&&!ND.ritual)return ['t-moon','este','Tegyük le a napot','Amit megőriznél, és amit elengednél. Hajnalban megírom, milyen napod volt.','Napzárás'];
  if(!t.work)return ['t-dumbbell','délután','17:30-ra be van írva az edzés','Utána egy fehérjés vacsora, és a tápanyag is kész.','Edzés'];
  if(t.ck<t.ckG)return ['t-checkin','este','Egy esti check-in hiányzik','Fél perc. Utána teljes a napod képe.','Check-in'];
  return ['t-moon','este','Készen állsz a napzárásra','A napzárás innen és az esti rutinból is indul.','Napzárás']}
const NDY={score:87,base:89,corr:-2,label:'A hét legjobb napja',
  dims:{nutrition:[100,'2 962 / 2 782 kcal · fehérje 162 / 166 g'],quality:[79,'nova 71% · mikro 100%'],training:[100,'2/2 edzés'],sleep:[79,'6 óra · minőség Q7'],logging:[85,'check-in 2/4 · étkezések időben'],rhythm:[64,'7/7 nap a héten']},
  weight:{nutrition:30,quality:15,training:20,sleep:15,logging:10,rhythm:10},
  chips:{nutrition:['kcal · 2962 / 2782','fehérje · 162 / 166 g','c · f · 379 g · 80 g','sáv · edzésnapi +150 kcal'],quality:['nova · 71%','mikro · 100%'],training:['edzés · 2 / 2'],sleep:['alvás · 6 h','minőség · Q7'],logging:['check-in · 2 / 4','időben · 100%'],rhythm:['ritmus · 7 / 7']},
  ctx:[['energia','5,5 / 10'],['súlytrend','+0,07 kg / hét'],['alváscél','2 napja elmarad'],['víz','jelölve']],
  prose:['A hét legjobb napja volt. Mindkét edzés megvolt, és a tányér is rendben volt: 2 962 kcal az edzésnapi kerettel együtt, a fehérje pedig csak 4 g-mal maradt el a céltól. A mikrotápanyagok teljesen megvoltak.','Egy dolog lóg ki: két napja nem jön össze az alváscél. Tegnap is csak 6 óra lett, és ez az 5,5-ös energiádon is látszott. Ma este ez a legjobb befektetés.'],
  hl:[['A nap kulcsa','Minden mikrotápanyag megvolt','t-key'],['Felismert minta','Egész héten minden nap mozogtál','t-pattern'],['Jó irány','Mindkét edzés megvolt','t-up']],
  adj:'Levontam 2 pontot, mert a rövid alvás már második napja ismétlődik, és ez az energiádon is látszott.',
  notes:{nutrition:'180 kcal-lal a keret fölött, de edzésnapon ez belefér. A fehérje szinte pont a célon.',quality:'Jó arány: a nagy része feldolgozatlan étel volt, és a mikrotápanyagok is mind megvoltak.',training:'Mindkét tervezett edzés megvolt.',sleep:'6 óra, jó minőségben, de már második napja rövid. Az energiádon is látszott.',logging:'Az ételeket időben írtad be. A check-inből kettő maradt ki.',rhythm:'A mai nap kiugrott a hét eddigi napjai közül.'}};
const ND_WEEK=[['2026-09-21','H',21,'th',null],['2026-09-22','K',22,'sc',82],['2026-09-23','Sze',23,'sc',87],['2026-09-24','Cs',24,'today',null],['2026-09-25','P',25,'fut'],['2026-09-26','Szo',26,'fut'],['2026-09-27','V',27,'fut']];
const ND_DAYNAME={'2026-09-21':['Hétfő','szept 21'],'2026-09-22':['Kedd','szept 22'],'2026-09-23':['Szerda','szept 23'],'2026-09-24':['Csütörtök','szept 24']};
/* a hét hét kis edény: a lezárt nap a pontszámáig telik, a mai „élő”, a jövő üres */
const ndWeek=sel=>`<section class="np-week rise">${ND_WEEK.map(([iso,n,d,stt,sc])=>`<button class="${iso===sel?'on':''} ${stt}" ${stt==='fut'?'data-toast="Még előtted"':`data-go="nap.${iso}"`}><small>${n}</small><span class="t"><i style="height:${sc!=null?sc:stt==='today'?57:stt==='th'?7:0}%"></i><b>${sc!=null?sc:stt==='th'?'–':stt==='today'?'élő':''}</b></span><em>${d}</em></button>`).join('')}</section>`;
const stKind={'kész':'ok','úton':'q','nyitva':'warn'};
const tankX=(o,extra='')=>nfix(tank(o)).replace(/<\/section>$/,extra+'</section>');
function ndDayBody(iso){const [dn,dd]=ND_DAYNAME[iso]||['',''];
  if(iso==='2026-09-24'){const d=ndTodayDims(),[lic,lwhen,lt,ls,lgo]=ndLead(),k=ndDoneCount(d);
    return `${tankX({pct:57,h:440,num:`${k}/6`,cap:`terület kész · élő · ${NDT.updated}`,lbl:`${dn} · ${dd}`,verdict:ndReading(),
        cta:lgo==='Napzárás'?'Napzárás indítása':lgo==='Check-in'?'Check-in':lgo+' megnyitása',ctaAct:lgo==='Napzárás'?N('ritual'):lgo==='Check-in'?N('ck:open'):{toast:lgo+' megnyitása'}})}
    <p class="np-under rise">Napközben nincs pontszám. Hajnali 3-kor zárom a napot, és reggelre megírom, milyen volt.</p>
    ${sec(1,`Most érdemes · ${lwhen}`,2)}${card(step({icon:lic,title:lt,sub:ls,now:true}),{i:2})}
    ${sec(2,'Ma eddig · 6 terület',3)}
    ${card(ND_DIM.map(([key,l,ic])=>{const x=d[key];return xrow({icon:ic,title:`${l} <span class="np-stt">${st(x.st,stKind[x.st])}</span>`,sub:x.v,v:x.big+(x.unit==='%'?'<small>%</small>':''),more:level(Math.max(2,x.pct),{h:12,c:x.st==='nyitva'?'var(--warn)':x.st==='kész'?'var(--ok)':'var(--dom)'})})}).join('')
      +`<div class="np-rows">${xrow({icon:'t-pencil',title:'Próbáld ki: írj be valamit',sub:'amit beírsz, itt azonnal megjelenik',on:{sheet:'ndlog'}})}</div>`,{i:3})}
    ${sec(3,'A napod · te és az app',4)}
    ${card(F.vials([{l:'az app szerint',ic:'t-score',c:'var(--dom)',p:64,v:'64<small style="font-size:12px;font-weight:600;color:var(--sub)"> / 100</small>',s:'közepes nap',mark:'100',on:{toast:'Az app pontszáma: a hat terület súlyozott átlaga'}},{l:'szerinted',ic:'t-mood',c:'var(--ok)',p:70,v:'7<small style="font-size:12px;font-weight:600;color:var(--sub)"> / 10</small>',s:'jó nap',mark:'10',on:{toast:'A te ítéleted: az esti check-in utolsó kérdése'}}],{h:132})
      +`<div style="margin-top:14px">${msg('mezo','Az app szerint közepes nap, szerinted jó volt. Kevés volt a fehérje és rövid az alvás, ezért lett közepes a pontszám. A hangulatod viszont egész nap 7 fölött volt, és este jónak érezted a napot — úgy tűnik, ma a délutáni séta többet számított, mint a számok.','a nap értékelése')}</div>`
      +note('A 7/10 az esti check-in utolsó kérdéséből jön („Milyen volt a napod összességében?”). A napod többi része nem változik.'),{i:4})}`}
  if(iso==='2026-09-21')return `${hero({lbl:`${dn} · ${dd} · lezárva, hajnali 3:02`,verdict:'Erre a napra kevés az adat.',sub:'Csak egy területről van adat (egy alvás), ezért nem adok pontszámot: kitalálni nem fogok. A hét pontszámába ez a nap nem számít bele.',left:jar(7,{s:80,t:'–'}),acts:btn('Vissza a mai napra','nap.2026-09-24')},1)}
    ${sec(1,'Amit erről a napról tudunk',2)}
    ${card(ND_DIM.map(([key,l,ic])=>xrow({cls:key==='sleep'?'':'np-dim',icon:ic,title:l,sub:key==='sleep'?'7ó 02p · minőség 6/10':'nincs adat',v:key==='sleep'?'70':'–',more:level(key==='sleep'?70:0,{h:12})})).join(''),{i:2})}`;
  const v=NDY;
  return `${tankX({pct:66,h:430,num:v.score,cap:'a 100-ból · hat területből',lbl:`${dn} · ${dd} · lezárva, hajnali 3:04`,verdict:v.label+'.',marks:[75,50,25],cta:'Beszélgess a napról',ctaAct:{toast:'Beszélgetés a napról (Mezo chat)'}},
      `<button class="np-shift" data-n="ndadj" aria-expanded="${ND.adj}"><span>alap ${v.base}</span><span>a Mezo szerint <b>${v.corr>0?'+':'−'}${Math.abs(v.corr)}</b> ${ND.adj?'▴':'▾'}</span></button>`)}
    ${ND.adj?card(msg('mezo',v.adj,`miért ${v.corr>0?'+':'−'}${Math.abs(v.corr)}?`)+note('A szaggatott vonal az alap-pontszám szintje; a folyadék a végső pontszámig ér.'),{i:1}):''}
    ${sec(1,'Mezo a napodról',2)}
    ${card(msg('mezo',v.prose.join('<br><br>'),'a napodról')+`<div class="np-rows">${v.hl.map(([e,t,ic])=>xrow({icon:ic,title:t,sub:e})).join('')}</div>`
      +acts(`<span class="np-ask">Segített?</span><button class="np-thumb" data-toast="Köszönöm, jegyzem" aria-label="Segített">${bub('t-thumb-up',{s:40})}</button><button class="np-thumb" data-toast="Mi nem talált? (itt jönnének az okok)" aria-label="Nem talált">${bub('t-thumb-down',{s:40})}</button>`),{i:2})}
    ${sec(2,'Miből jött össze',3)}
    ${card(ND_DIM.map(([key,l,ic])=>{const [sc,val]=v.dims[key],o=ND.open.has(key);
      return xrow({icon:ic,title:`${l} <span class="np-w">súly ${v.weight[key]}%</span>`,sub:val,v:sc,n:'nddim:'+key,right:`<span class="np-tg">${o?'bezár':'Mezo ›'}</span>`,more:level(sc,{h:12,c:sc>=80?'var(--ok)':'var(--dom)'})+(o?`<span class="np-open">${chipsRow(v.chips[key])}<span>${v.notes[key]}</span></span>`:'')})}).join('')+note('Koppints egy területre a részletekért.'),{i:3})}
    ${sec(3,'A nap körülményei',4)}
    ${card(`<div class="np-ctx">${v.ctx.map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>`+note('Ezek nem számítanak a pontba. Ha utólag beírsz még valamit erre a napra, a jegyzetet egyszer újraírom.'),{i:4})}
    ${iso==='2026-09-23'?sec(4,'Reggeli összefoglaló · kész',5)+card(xrow({icon:'t-sun',title:'Tovább a mai napra',sub:'csütörtök · élő nap',on:'nap.2026-09-24'}),{i:5}):''}`}
function napDay(arg){const [iso0,phase]=(arg||'').split('.');const iso=ND_DAYNAME[iso0]?iso0:'2026-09-24';ND.phase=phase==='este'?'evening':'day';
  return page('nap',{title:'A napom',sub:'Nap · szept 21 – 27',tab:'napom'},`${ndWeek(iso)}${ndDayBody(iso)}`)}
const napom=()=>napDay('2026-09-24');
/* élő frissítés bemutató: amit beírsz, azonnal megjelenik a napi oldalon */
const ndClock=[14,20];
const ndLogSheet=()=>`${shH('Mit írsz be?','A napom · próbáld ki: a napi oldal azonnal frissül.','','t-pencil')}
  <div class="np-qg">${[['meal','t-bowl','Uzsonna','+420 kcal · +18 g',0],['work','t-dumbbell','Edzés kész','1 edzés',NDT.work],['ck','t-checkin','Check-in','+1',NDT.ck>=NDT.ckG]].map(([k,ic,l,s,off])=>`<button data-n="ndlog:${k}" ${off?'disabled style="opacity:.4"':''}>${bub(ic,{s:52})}<span>${l}<small>${s}</small></span></button>`).join('')}</div>`;

/* ── RUTIN-ÉPÍTÉS ── */
const RE={rutin:'full',lanc:'view'};
let effort=[1,0,1,2], fwPick='fogg', fwRaw='fogg', sklFilter=[true,true,true,false];
const RLIFE=[['Tudatosság','t-heart'],['Szemlélet','t-compass'],['Konyha','t-pot'],['Pénzügyek','t-coin'],['Produktivitás','t-record'],['Tanulás','t-book'],['Kapcsolatok','t-people'],['Regeneráció','t-sprout']];
const CHAIN=[['Ébredés időben','reggel · ébredés',92,'d'],['Reggeli napfény','ébredés után',78,'d'],['50 fekvőtámasz','megvolt a reggeli napfény',48,'now'],['Reggeli videó','fekvőtámasz után',30,''],['Gombakávé','videó után',64,'']];
const recept=(i=3)=>`<p class="np-recept">Miután <b>megvolt a reggeli napfény</b>, ${i>=2?'<b>50 fekvőtámaszt</b> csinálok':'<span class="np-blank"></span>'}, és ünneplésül ${i>=3?'<b>ökölrázás</b>':'<span class="np-blank"></span>'}.</p>`;
const FWL={fogg:['Horgony','Pici tett','Ünneplés'],clear:['Jelzés','Vágy','Válasz','Jutalom']};
const mark=k=>k==='d'?`<span class="np-mk d">${I('i-check')}</span>`:`<span class="np-mk ${k}"></span>`;
const CSH=['Ébredés','Napfény','Fekvő','Videó','Kávé'];
/* a két lánc két csepp-sor: a reggeli öt, az esti kettő */
const twoChains=(past,done)=>`<div class="np-ch2"><div><small>Reggeli lánc · ${past?4:done?5:2} / 5</small>${drops(CHAIN.map((c,i)=>({k:past?(i===3?'x':'d'):done?'d':c[3],t:CSH[i]})))}</div>
  <div class="two"><small>Esti lánc · ${past||done?2:0} / 2</small>${drops(['Koffein','Konyha'].map(t=>({k:past||done?'d':'',t})))}</div></div>`;
function rutinEpites(){const past=RE.rutin==='past',done=RE.rutin==='done',n=past?4:done?7:3;
  const dayNav=past?nl('Ma ›','rst:rutin:full'):nl('‹ Tegnap','rst:rutin:past');
  const strip=facts([['9','tökéletes reggel · 30 nap'],['12','tökéletes este · 30 nap'],['7','aktív szokás']]);
  if(past)return page('nap',{title:'Rutinok',sub:'Rutin · kedd, szept. 22.',back:'rutin'},`
    ${hero({lbl:'Tegnap · kedd · +45 XP',verdict:'Reggel 4 az 5-ből, este mind megvolt.',sub:'A <b>Reggeli videó</b> kimaradt — a lánc másnap folytatódott, nem szakadt meg.',body:twoChains(true),acts:nb('Vissza a mai napra','rst:rutin:full')})}
    ${[['Reggeli lánc','4/5',CHAIN.map(c=>c[0])],['Esti lánc','2/2',['Koffein-cutoff','Konyha zárva']]].map(([nm,c,rows],k)=>sec(k+1,`${nm} · ${c}`,k+1)+card(rows.map((r,i)=>{const miss=i===3&&k===0;return xrow({cls:miss?'np-dim':'',left:mark(miss?'':'d'),title:r,sub:miss?'kimaradt':''})}).join(''),{i:k+1})).join('')}`);
  return page('nap',{title:'Rutinok',sub:'Rutin · szerkesztés · ma, csütörtök',back:'rutin'},`
  ${hero({lbl:done?'Mind megvan':`Következik · ${n} / 7 ma`,verdict:done?'A mai rutin kész.':'50 fekvőtámasz a reggeli napfény után.',sub:done?'Holnap folytatódik.':'Reggeli lánc · 2 szokás már magától megy.',
    body:twoChains(false,done)+strip,acts:btn('Pipálom a Rutin fülön','rutin')+dayNav})}
  ${sec(1,'Amid most van',1)}
  ${card(xrow({icon:'t-dawn',title:'Aktív lánc · reggeli',sub:`${done?5:2} / 5 kész · öt szokás, horgonyokkal összekötve`,on:'lanc'})
    +xrow({icon:'t-harvest',title:'Szokásaid',sub:'7 aktív · 2 beérett',on:'szokasok'}),{i:1})}
  ${sec(2,'Építs újat',2)}
  ${card(xrow({icon:'t-book',title:'Új szokás',sub:'lépésről lépésre, egy meglévő szokásra ültetve',on:'rutin-uj.fw'})
    +xrow({icon:'t-chain',title:'Új lánc',sub:'egy új napszakra vagy helyzetre',on:{sheet:'chain'}})
    +xrow({icon:'t-spark',title:'AI javaslat',sub:'mondd el, mit szeretnél, Mezo ajánl szokást',on:{sheet:'ai'}})
    +note('Itt építed és szerkeszted a rutint — pipálni a Rutin fülön lehet.'),{i:2})}`);
}
function lanc(){const ed=RE.lanc==='edit';
  const pipe=`<div class="np-vh np-pipe">${vials(CHAIN.map((c,i)=>({l:CSH[i],p:c[2],v:c[2]+'%',mark:c[3]==='d'?'✓':c[3]==='now'?'most':'',c:c[3]==='d'?'var(--ok)':'var(--dom)',on:ed?{toast:c[0]+' · '+c[1]}:'szokas'})),{h:100})}</div>`;
  return page('nap',{title:'Reggeli lánc',sub:'Rutinok · aktív lánc',back:'rutin-epites'},`
  ${hero({lbl:ed?'Szerkesztés':'Ma eddig · 2 / 5 kész',verdict:ed?'Rendezd át, ahogy neked kézre áll.':'2 megvan az 5-ből. Most jön az 50 fekvőtámasz.',sub:'Öt összekötött edény: mindegyik a szokás 28 napos erejéig telik.',
    body:pipe,acts:nb(ed?'Kész':'Szerkesztés','rst:lanc:'+(ed?'view':'edit'))+(ed?'':lk('+ Új szokás ide','rutin-uj.fw'))})}
  ${ed?sec(1,'Név és napszak',1)+card(lab('A lánc neve')+inp('','Reggeli lánc')+lab('Napszak')+chips([['Reggel','t-dawn'],['Nap','t-sun'],['Este','t-moon']],0),{i:1}):''}
  ${sec(ed?2:1,ed?'Sorrend és horgonyok':'A lánc sorrendben',2)}
  ${card(CHAIN.map((c,i)=>xrow({cls:i===3?'np-dim':'',left:mark(c[3]),title:c[0],sub:`${inl(i===4?'t-note':'t-anchor')}${c[1]}`,
      ...(ed?{right:`<span class="np-mv"><button data-toast="Feljebb" aria-label="Feljebb">▲</button><button data-toast="Lejjebb" aria-label="Lejjebb">▼</button></span>`}:{v:c[2]+'<small>%</small>',more:level(c[2],{h:8,c:c[3]==='d'?'var(--ok)':'var(--dom)'}),on:'szokas'})})).join('')
    +(ed?`<p class="fh-txt np-why">${inl('t-info')}<span>A sorrend és a horgony nem ugyanazt mondja: a <b>Gombakávé</b> horgonya „videó után”, de előrébb került.</span></p>`:'')
    +note('A horgony mondja meg, mi után jön a szokás — a sorrend ezt követi.'),{i:2})}
  ${ed?sec(3,'Bővítés és szünet',3)+card(xrow({icon:'t-addex',title:'Új szokás ebbe a láncba',on:'rutin-uj.fw'})+xrow({icon:'t-hold',title:'Lánc szüneteltetése',sub:'a szokások megmaradnak',on:{toast:'Szüneteltetve'}})+note('Az alap reggeli és esti lánc nem törölhető.'),{i:3})
    :sec(2,'Bővítés',3)+card(xrow({icon:'t-addex',title:'Új szokás ebbe a láncba',sub:'a varázsló végigvezet',on:'rutin-uj.fw'}),{i:3})}`);
}
const HAB=[['Ébredés időben','magától megy',142,92,'Beérett',''],['Koffein-cutoff','kezd magától menni',66,78,'~12 ismétlés','3 hét múlva'],['Reggeli napfény','kezd magától menni',51,74,'~20 ismétlés','kb. 4 hét'],['50 fekvőtámasz','épül',24,48,'~41 ismétlés','kb. 7 hét'],['Konyha zárva','épül',18,40,'~46 ismétlés','kb. 8 hét'],['Gombakávé','még tudatos',9,26,'—','még gyűlik az adat'],['Reggeli videó','még tudatos',4,null,'—','még gyűlik az adat']];
const STAGE=['még tudatos','épül','kezd magától menni','magától megy'];
function szokasok(){const vis=HAB.filter(h=>sklFilter[STAGE.indexOf(h[1])]);
  /* a négy szakasz négy edény: minél érettebb, annál magasabb a szint; koppintásra szűr */
  const stg=`<div class="np-stg">${STAGE.map((s,i)=>`<button class="${sklFilter[i]?'on':''}" data-n="ft:${i}" aria-pressed="${sklFilter[i]}"><span class="t"><i style="height:${(i+1)*25}%"></i><b>${HAB.filter(h=>h[1]===s).length}</b></span><small>${s}</small></button>`).join('')}</div>`;
  return page('nap',{title:'Szokásaid',sub:'Rutinok · formálódás szerint',back:'rutin-epites'},`
  ${hero({lbl:'7 aktív szokás · melyik szakaszt mutassam?',verdict:'Egy már magától megy, kettő úton van oda.',sub:'Egy szokás ereje a 28 napos pipáiból jön — nem a sorozatból.',body:stg,acts:btn('+ Új szokás','rutin-uj.fw')})}
  ${sec(1,`Szokások · ${vis.length}`,2)}
  ${card(vis.length?vis.map(h=>xrow({left:mini({p:h[3]||3,c:h[3]>=70?'var(--ok)':'var(--dom)',v:h[3]!=null?h[3]+'%':'—'}),title:h[0],sub:`${h[1]}<br><b>${h[4]}</b>${h[5]?' · '+h[5]:''}`,v:`${h[2]}<small>ismétlés</small>`,on:'szokas',right:' '})).join('')
    :empty('t-harvest','Ebben a szakaszban most nincs szokásod.'),{i:2})}`);
}
function szokas(){
  /* az érés egy edény: a szint négy szakaszon megy át */
  const mat=`<div class="np-mat"><span class="t"><i style="height:48%"></i><u style="bottom:25%"></u><u style="bottom:50%"></u><u style="bottom:75%"></u><b>48%</b></span><ol>${STAGE.map((s,i)=>`<li class="${i<1?'done':i===1?'on':''}"><b>${s}</b>${i===1?'<small>itt tartasz · még ~41 ismétlés</small>':i<1?'<small>megvolt</small>':''}</li>`).reverse().join('')}</ol></div>`;
  return page('nap',{title:'50 fekvőtámasz',sub:'Szokás · Reggeli lánc',back:'rutin-epites'},`
  ${hero({lbl:'Út az automatizmus felé · 28 napos erő',verdict:'Épül. Még kb. 41 ismétlés, úgy 7 hét.',sub:'24 pipa · 5 kihagyás. A reggeli napfény után a legerősebb — ott szinte sosem marad ki.',body:mat,acts:btn('Szerkesztés','szerk')})}
  ${sec(1,'A recepted',1)}${card(recG(FWL.fogg,3)+recept()+acts(lk('Szerkesztem','szerk')),{i:1})}
  ${sec(2,'Mikor megy a legjobban',2)}
  ${card(`<div class="np-vh np-ctx3">${vials([['Napszak',82,'reggel 7–8 között','t-clock'],['Horgony',74,'napfény után','t-anchor'],['Ritmus',51,'hétköznap erősebb','t-calendar']].map(r=>({l:r[0],s:r[2],p:r[1],v:r[1]+'%',ic:r[3],on:{toast:r[0]+' · '+r[2]}})),{h:92})}</div>`+note('A legerősebb jel a kontextus: mikor, mi után és milyen napokon megy magától.'),{i:2})}
  ${sec(3,'Előzmény · az első naptól · 29 nap',3)}
  ${card(g28(2,[9,14,20,23,27],[0,1,2,3,4,5],35)+`<div class="np-leg"><span><i class="p"></i>pipa</span><span><i class="m"></i>kimaradt</span><span><i class="s"></i>nem volt sor</span></div>`+note('Egy kémcső egy nap. Csendes rács, nem sorozat.'),{i:3})}`);
}
function effortCard(){const f=['Idő','Fizikai','Fejmunka','Beleillik'],o=[['kevés','közép','sok'],['könnyű','közép','nehéz'],['könnyű','közép','nehéz'],['simán','kicsit','nehezen']];
  const sum=effort.reduce((a,b)=>a+b,0),lv=sum<=2?['Könnyű',5,34]:sum<=5?['Közepes',10,62]:['Nehéz',15,90];
  return `${f.map((n,i)=>`<div class="np-eff"><span>${n}</span><div class="fh-seg">${o[i].map((t,k)=>`<button class="${effort[i]===k?'on':''}" data-n="eff:${i}:${k}">${t}</button>`).join('')}</div></div>`).join('')}
    <div class="np-effout">${level(lv[2],{h:22,label:lv[0],val:`+${lv[1]} XP / alkalom`})}</div>${note('Bármikor újraértékelhető.')}`}
function szerk(){
  return page('nap',{title:'Szerkesztés',sub:'Szokás · 50 fekvőtámasz',back:'szokas'},`
  ${hero({lbl:'A recept · együtt változik',verdict:'50 fekvőtámasz',body:recG(FWL.fogg,3)+recept(),acts:btn('Mentés',{toast:'Mentve'})})}
  ${sec(1,'Keret és horgony',1)}
  ${card(lab('Keret')+xseg(['Szokás-láncolás','Négy törvény'])+`<p class="fh-txt np-why">${inl('t-info')}<span>Váltásnál elveszik: az ünneplés.</span></p>`
    +lab('Miután… · horgony')+xrow({icon:'t-anchor',title:'Reggeli napfény',sub:'74% erő · 28 nap',more:level(74,{h:8}),on:{sheet:'anchor'}}),{i:1})}
  ${sec(2,'A szokás',2)}
  ${card(lab('Cím · a tett')+inp('','50 fekvőtámasz')+lab('Ünneplésül')+inp('','ökölrázás')+lab('Miért')+area('pl. hogy erősebb legyen a vállam','Hogy erősebb legyen a vállam, és ne fájjon a nyakam.',2),{i:2})}
  ${sec(3,'Pipálás és lánc',3)}
  ${card(lab('Hogyan pipálódik?')+xseg(['Kézzel pipálom','Adatból'])+lab('Lánc')+chips(['Reggeli lánc','Esti lánc','Egyik sem'],0),{i:3})}
  ${sec(4,'Mennyibe kerül? · újraértékelhető',4)}${card(effortCard(),{i:4})}
  ${sec(5,'Szünet vagy törlés',5)}
  ${card(xrow({icon:'t-hold',title:'Szüneteltetés',sub:'a haladás megmarad',on:{toast:'Szüneteltetve'}})+xrow({icon:'t-trash',title:'Szokás törlése',sub:'két koppintás kell hozzá',on:{toast:'Koppints újra a törléshez'}}),{i:5})}`);
}
const WZ={fogg:['fw','anchor','act','celeb'],clear:['fw','cue','crave','act','reward']};
const WT={fw:'Milyen keretre?',anchor:'Mihez horgonyzod?',cue:'Mi a jelzés?',crave:'Miért akarod?',act:'Mi a tett?',celeb:'Hogyan ünnepled?',reward:'Mi a jutalom?'};
const WQ={fw:'Milyen keretre építsük?',anchor:'Mihez horgonyzod?',cue:'Mi a jelzés?',crave:'Miért fogod akarni?',act:'Mi a tett?',celeb:'Hogyan ünnepled?',reward:'Mi teszi kielégítővé?'};
function rutinUj(stp){const steps=WZ[fwPick]||WZ.fogg,i=Math.max(0,steps.indexOf(stp||'fw')),s=steps[i];
  const prevGo=i?`rutin-uj.${steps[i-1]}`:'rutin-epites',last=i===steps.length-1, fwName=fwPick==='clear'?'Négy törvény':'Szokás-láncolás', L=FWL[fwPick]||FWL.fogg;
  let body='';
  if(s==='fw')body=[['fogg','t-anchor','Szokás-láncolás','BJ Fogg · Tiny Habits',FWL.fogg],['clear','t-gem','Négy törvény','James Clear · Atomic Habits',FWL.clear],['free','t-note','Keret nélkül','csak a tett',[]]].map(f=>xrow({cls:fwRaw===f[0]?'now':'',icon:f[1],title:f[2],sub:f[3],more:f[4].length?`<span class="np-loop">${f[4].map(x=>`<i>${x}</i>`).join('<u>→</u>')}</span>`:'',n:'fw:'+f[0],right:fwRaw===f[0]?mark('d'):'<span class="np-mk"></span>'})).join('')
    +`<p class="fh-txt np-why">${inl('t-bulb')}<span>Kezdőknek a szokás-láncolás a legkönnyebb: egy meglévő szokásra ülteted az újat.</span></p>`;
  if(s==='anchor')body=`${lab('A szokásaidból és a Mezo-pillanatokból')}<div class="fh-pills">${[['Ébredés időben','szokás'],['Reggeli napfény','szokás'],['Kávé után','Mezo-pillanat'],['Edzés vége','Mezo-pillanat']].map((a,k)=>chip(`${a[0]} <small>· ${a[1]}</small>`,'pick',k===1)).join('')}</div>${lab('Vagy saját szavakkal')}${inp('pl. miután leteszem a telefont','Miután este leteszem a telefont.')}<p class="fh-txt np-why">${inl('t-anchor')}<span>A jó horgony minden nap biztosan megtörténik, és pontosan tudod, mikor ért véget.</span></p>`;
  if(s==='act')body=`${lab('Én … · a tett')}${inp('','50 fekvőtámaszt csinálok')}<p class="fh-txt np-why">${inl('t-scissors')}<span>Ez nagynak tűnik. Mi lenne, ha 5-tel kezdenéd? A pici tett ragad meg.</span></p>
    ${lab('Melyik láncba?')}${chips(['Reggeli lánc','Esti lánc'],0)}${lab('Életterület')}${chips(RLIFE,7)}
    ${lab('Mennyibe kerül?')}${effortCard()}${lab('Hogyan pipálódik?')}${xseg(['Kézzel pipálom','Adatból'])}`;
  if(s==='celeb')body=`${chips(['ökölrázás','„Igen!”','mosoly a tükörbe','mély levegő'],0)}${lab('Vagy saját')}${inp('pl. egy kis tánc','Egy kis tánc a konyhában.')}<p class="fh-txt np-why">${inl('t-anchor')}<span>Az ünneplés azonnal jöjjön, a tett után — ettől ragad meg az érzés.</span></p>${acts(btn(I('i-check')+'Vállalom',{toast:'Vállalva'},'sm ghost'))}`;
  if(['cue','crave','reward'].includes(s))body=`${lab(s==='cue'?'Jelzés':s==='crave'?'Miért akarod? · vágy':'Jutalom')}${area('…','Amikor felébredek, és még a kezemben van a telefon.',2)}<p class="fh-txt np-why">${inl('t-gem')}<span>A négy törvény egy-egy lépése.</span></p>`;
  return page('nap',{title:WT[s],sub:`Új szokás · ${i+1} / ${steps.length}`,back:prevGo},`
  <div class="np-pre rise">${dots(steps.length,i)}</div>
  ${i?hero({lbl:`${fwName} · épül, ahogy töltöd`,verdict:WQ[s],body:recG(L,i)+recept(i)},1)
    :hero({lbl:'Új szokás-recept · még üres',verdict:WQ[s],sub:'A recept edényei lépésről lépésre telnek meg.',body:recG(L,0)},1)}
  ${sec(1,s==='fw'?'Válassz keretet':'Töltsd ki',2)}${card(body,{i:2})}`,
  {nonav:true,pad:'120px',foot:lk('Mégse','rutin-epites')+(i?btn('Vissza',prevGo,'ghost'):'')+`<button class="btn" style="flex:1" ${last?'data-toast="Mentve · vissza a Rutinra"':`data-go="rutin-uj.${steps[i+1]}"`}>${last?'Mentés':'Tovább'}</button>`});
}

/* ── LAPOK (alulról) ── */
let wat=400;
const WKB=[['H',[.26,.52,.22],.98,1],['K',[.28,.5,.22],.9,0],['Sze',[.24,.54,.22],1.02,1],['Cs',[.27,.51,.22],.72,0],['P',[.3,.48,.22],.66,0,1],['Szo',null,0,0],['V',null,0,0]];
const qg=a=>`<div class="np-qg">${a.map(([l,ic,attr])=>`<button ${attr}>${bub(ic,{s:52})}<span>${l}</span></button>`).join('')}</div>`;
const SHEETS={
  checkin:()=>{ck={slot:(nowSlot()||SLOTS[2]).t,step:0,a:{},quick:false};return ckSheet()},
  kimelo:()=>{KM.pick={cat:KM.on?KM.cat:null,dur:KM.on?KM.dur:null};return kmSheet()},
  kmwelcome:()=>kmWelcome(),
  ndlog:()=>ndLogSheet(),
  /* a hét hét edény: a szaggatott vonal a napi keret, a rétegek a három makró */
  uzemanyag:()=>{const m=macroSel!=null?MAC[macroSel]:null;
    return `${shH('A hét üzemanyaga','Fuel · egy edény egy nap','','t-macro')}
    <div class="np-bigrow"><span class="fh-big">${m?m[2]:'2 060'}<small>${m?`g ${m[0].toLowerCase()} · ${m[3]-m[2]} g a ${m[3]} g célig · ${Math.round(m[2]/m[3]*100)}%`:'/ 3 100 kcal ma · 1 040 van még'}</small></span></div>
    <div class="np-wk">${WKB.map(([l,mm,h,met,t])=>`<div class="${t?'today':''}"><span class="t ${mm?(met?'met':''):'none'}"><span class="q" style="height:${mm?Math.round(h/1.12*100):0}%">${mm?`<i style="flex:${mm[2]};background:var(--fat)"></i><i style="flex:${mm[1]};background:var(--carb)"></i><i style="flex:${mm[0]};background:var(--protein)"></i>`:''}</span></span><small>${l}</small></div>`).join('')}</div>
    ${note('A három réteg a három makró. Ha a nap célja megvan, az edény elhalványul. A szaggatott vonal a napi keret.')}
    <div class="np-rows">${MAC.map(([n,c,g,goal],k)=>xrow({cls:macroSel===k?'now':'',title:n,v:`${g}<small>/ ${goal} g</small>`,more:level(Math.round(g/goal*100),{c,h:12}),n:'mac:'+k,right:' '})).join('')}</div>
    <p class="fh-note">${m?`${m[3]-m[2]} g a ${m[3]} g-os célig.`:'A három szint a saját napi célodhoz viszonyít. Érints meg egy makrót a részletekhez.'}</p>
    ${acts((m?nb('Vissza az összképhez','core','sm ghost'):'')+btn('Fuel megnyitása',{dom:'fuel'},'sm'))}`},
  tobb:()=>`${shH('Több','Mai · ami még ide tartozik')}${xrow({icon:'t-steps',title:'Aktivitás',sub:'amit ma tettél',on:{sheet:'activity'}})}${xrow({icon:'t-chat',title:'Chat',sub:'beszéljük át',on:{toast:'Mezo · Chat'}})}${xrow({icon:'t-heart',title:'Életjelek',sub:'a hat jel',on:'eletjel'})}${xrow({icon:'t-quest',title:'Napi küldetések',sub:'ajánlatok a mai napra',on:'kuldetesek'})}`,
  naplopick:()=>`${shH('Mit naplózol?','Napló','tobb','t-journal')}${qg([['Aktivitás','t-steps','data-sheet="activity"'],['Napló','t-journal','data-sheet="journal"'],['Hála','t-sprout','data-sheet="journal"']])}`,
  /* egy pohár, ami megtelik: a szaggatott vonal a mai eddigi szint */
  water:()=>{const tot=1200+wat;return `${shH('Mennyit ittál?','Víz · egy korty szünet.','','t-water')}
    <div class="np-bigrow">${glass(tot/25,{mark:48})}<span class="fh-big">${wat}<small>ml</small><em>ma eddig 1,2 l → ${String((tot/1000).toFixed(2)).replace(/0$/,'').replace('.',',')} l a 2,5 l-ből</em></span></div>
    <div class="fh-pills">${[250,400,500].map(v=>chip(v+' ml','wat:'+v,wat===v)).join('')}</div>${lab('ml kézzel')}${inp('pl. 330')}${saveRow()}`},
  /* a súly mint felszín: a vonal a trend, a pöttyök a napi mérések */
  weight:()=>`${shH('Mi a számunk ma?','Gyors rögzítés · egy mérés a napodban.','','t-weight')}<div class="np-bigrow"><span class="fh-big">82,4<small>kg · tegnap 82,6</small></span></div>
    <div class="np-arcw">${farea([82.95,82.85,82.8,82.7,82.62,82.55,82.5],{h:104,min:82.2,max:83.3,dots:[83.1,82.7,82.9,82.5,82.8,82.6,82.4],labels:['cs','p','szo','v','h','k','ma']})}</div>
    <p class="fh-note" style="margin-top:4px">Hét nap: a felszín a trend, a pöttyök a napi mérések. A mai 82,4 a trend alatt van.</p>
    <div class="fh-pills" style="margin-top:10px">${['−0,5','−0,1','+0,1','+0,5'].map(l=>`<button class="fh-pill" data-toast="${l} kg">${l}</button>`).join('')}</div>${lab('Egy mondat · opcionális')}${inp('pl. „vasárnap reggel · folyadékvesztés”','Vasárnap reggel, edzés után mértem.')}${saveRow()}`,
  /* az éjszaka mint dagály: mélyül, kétszer megtörik, reggelre kifut */
  sleep:()=>`${shH('Hogyan aludtunk?','Gyors rögzítés · az éjszakád, néhány mozdulattal.','','t-sleep')}${xseg(['Kézi','Screenshot'])}<div class="np-bigrow"><span class="fh-big">7,4<small>óra · 23:10 → 06:35</small></span></div>
    <div class="np-arcw np-night">${farea([.05,.6,.95,1,.38,.9,1,.42,.85,.6,.08],{h:96,min:0,max:1.1,labels:['23:10','01:00','03:00','05:00','06:35']})}</div>
    <p class="fh-note" style="margin-top:4px">Az éjszaka mint dagály: minél magasabb, annál mélyebb az alvás. A két bemélyedés a két ébredés.</p>
    <div class="np-two"><div>${lab('Lefekvés')}${inp('','23:10')}</div><div>${lab('Ébredés')}${inp('','06:35')}</div></div>${lab('Minőség · 7/10')}${scale(7)}
    ${lab('Ébredések éjjel')}${chips(['0','1','2','3','4+'],2)}
    <p class="fh-txt np-why">${inl('t-moon')}<span>Az éjjel 2× jártál az éjszakai módban — előtöltöttem.</span></p>${lab('Ágyban összesen (perc)')}${inp('opcionális')}${saveRow()}`,
  sport:()=>`${shH('Hogy ment?','Sport log · röpi · az idő, a terhelés és a saját élményed.','','t-volley')}${xseg(['Röpi','Cross','TRX'])}
    <div class="np-two"><div>${lab('Idő · perc')}<div class="np-stp"><button data-n="inc:-5" aria-label="Kevesebb">−</button><b>90</b><button data-n="inc:5" aria-label="Több">+</button></div></div><div>${lab('Setek')}<div class="np-stp"><button data-n="inc:-1" aria-label="Kevesebb">−</button><b>5</b><button data-n="inc:1" aria-label="Több">+</button></div></div></div>
    ${lab('RPE · összesített nehézség')}${scale(7)}${ends('Könnyű','Maximális')}${lab('Váll terhelés')}${scale(5)}${ends('Semmi','Nagyon megterhelte')}${lab('Jegyzet')}${area('Hogy érezted magad, mi ment jól, mi fájt…','Jól ment a nyitás, de a harmadik szettben már húzott a vállam.',2)}${saveRow()}`,
  journal:()=>`${shH('Mi jár a fejedben?','Gyors rögzítés · a gondolataidnak itt van helye.','naplopick','t-journal')}${chips(['Napló','Döntés','Hála'],0)}
    <div style="margin-top:12px">${area('Írd le, ami most benned van…','Kicsit feszült vagyok a holnapi megbeszélés miatt, de összeszedtem, mit akarok mondani.',4)}</div>${lab('Dátum')}${inp('','2026. 10. 07.')}${saveRow('Mentem')}`,
  activity:(a)=>a==='done'?`${shH('Megvan!','Tevékenységnapló','','t-steps')}<div class="np-bigrow">${jar(75,{s:74,t:'+15'})}<span class="fh-big">+15<small>XP</small><em>${chipsRow(['Pénzügyek'])}</em></span></div><p class="fh-txt np-why">${inl('t-quest')}<span>Küldetés teljesítve: <b>Tegyél félre ma</b> (+20 XP)</span></p><button class="btn np-wide" style="margin-top:16px" data-close>Kész</button>`
    :`${shH('Mi történt ma?','Tevékenységnapló · a kis lépések is a napod részei.','naplopick','t-steps')}<p class="fh-txt np-why">${inl('t-quest')}<span><b>Mai küldetés:</b> Tegyél félre ma · +20 XP a teljesítésért</span></p>
    <div style="margin-top:10px">${area('pl. Olvastam 30 percet, átraktam 50 ezret megtakarításba…','Olvastam fél órát, és átraktam ötvenezret a megtakarításba.')}</div>${note('Az AI besorolja, és a megfelelő életterülethez írja az XP-t.')}
    <div class="np-two" style="margin-top:16px"><button class="btn ghost" data-close>Mégse</button><button class="btn" data-sheet="activity" data-arg="done">Naplózom</button></div>`,
  /* három edény: tele · félig · üres */
  reflect:()=>`${shH('Szándékkal élted a napot?','Rutin · este · a mai szándékod: „nyugodt tempó”','','t-ring')}<div class="np-ref">${[['Igen',100],['Részben',50],['Nem',4]].map(([x,p])=>`<button data-n="reflect">${mini({p})}<b>${x}</b></button>`).join('')}</div>`,
  ai:()=>`${shH('Milyen szokás segítene?','AI javaslat','','t-spark')}${lab('Szándék (opcionális)')}${area('pl. jobb esti lezárás','Szeretném, ha este hamarabb letenném a telefont és nyugodtabban zárnám a napot.')}<button class="btn np-wide" style="margin-top:16px" data-toast="Mezo gondolkodik…">Javasolj</button>`,
  chain:()=>`${shH('Új rutin','Rutin · új lánc','','t-chain')}${lab('Név')}${inp('pl. Ebéd utáni szünet','Ebéd utáni szünet')}${lab('Napszak')}${chips([['Reggel','t-dawn'],['Napközben','t-sun'],['Este','t-moon']],0)}<div class="np-two" style="margin-top:16px"><button class="btn ghost" data-close>Mégse</button><button class="btn" data-n="save">Mentés</button></div>`,
  anchor:()=>`${shH('Mihez kötöd?','Horgony','','t-anchor')}${lab('A szokásaidból')}${[['Ébredés időben','92% erő · 28 nap',0,92],['Reggeli napfény','74% erő · 28 nap',1,74],['Gombakávé','friss szokás',0,26]].map(o=>`<button class="fh-row" data-close>${mark(o[2]?'d':'')}<span class="g"><strong>${o[0]}</strong><small>${o[1]}</small>${level(o[3],{h:8})}</span></button>`).join('')}
    ${lab('Mezo-események')}${['Edzés vége','Első étkezés'].map(o=>`<button class="fh-row" data-close>${mark('')}<span class="g"><strong>${o}</strong></span></button>`).join('')}
    ${lab('Egyéb')}<button class="fh-row" data-close><span class="si">${I('t-note')}</span><span class="g"><strong>Saját szavakkal…</strong></span></button><button class="fh-row" data-close><span class="si">${I('t-skip')}</span><span class="g"><strong>Leoldom a horgonyt</strong></span></button>`
};
const reSheet=()=>{const sh=$('#sheet');const y=sh?sh.scrollTop:0;F.openSheet(ckSheet());if(sh)sh.scrollTop=y};
const cknext=()=>setTimeout(()=>{ck.step++;reSheet()},180);

/* ── interakciók: data-n="cmd:arg" (a shell kezeli a data-go / data-sheet / data-close / data-toast / data-dom-ot) ── */
const ACT={
  /* check-in */
  ck:()=>F.openSheet(SHEETS.checkin()),
  ckslot:a=>{ck={slot:a,step:0,a:{},quick:false};F.openSheet(ckSheet())},
  ckstep:a=>{ck.step=+a;reSheet()},
  ckskip:()=>{ck.a[ckSteps()[ck.step]]=null;ck.step++;reSheet()},
  ckquick:()=>{ck.quick=true;ck.step=ckSteps().length;reSheet()},
  ckpain:a=>{if(a==='no'){ck.a.pain=false;reSheet();cknext()}else{if(!ck.a.pain)ck.a.pain={regions:[],int:null};reSheet()}},
  ckreg:a=>{const R=ck.a.pain.regions,i=R.indexOf(a);i<0?R.push(a):R.splice(i,1);reSheet()},
  ckkind:a=>{const k=ck.a.craving.kinds,i=k.indexOf(a);i<0?k.push(a):k.splice(i,1);reSheet()},
  cks:a=>{const v=+a,id=ckSteps()[ck.step];
    if(id==='pain'){ck.a.pain.int=v;reSheet();return}
    if(id==='craving'){ck.a.craving={v,kinds:ck.a.craving?ck.a.craving.kinds:[]};reSheet();if(v<4)cknext();return}
    ck.a[id]=v;reSheet();cknext()},
  cksave:()=>{const sl=SLOTS.find(s=>s.t===ck.slot);Object.assign(sl,{st:'done',a:{...ck.a},quick:ck.quick,note:ck.quick?'':'Mentve most'});F.closeSheet();soft();F.toast('Mentve · '+ck.slot)},
  /* kímélő mód */
  km:()=>F.openSheet(SHEETS.kimelo()),
  kmcat:a=>{KM.pick.cat=a;F.openSheet(kmSheet())},
  kmdur:a=>{KM.pick.dur=KM.pick.dur===a?null:a;F.openSheet(kmSheet())},
  kmon:()=>{if(!KM.pick.cat)return;Object.assign(KM,{on:true,cat:KM.pick.cat,dur:KM.pick.dur||'UNKNOWN',day:KM.on?KM.day:1,later:false,ask:false});F.closeSheet();soft();F.toast('Kímélő mód bekapcsolva')},
  kmlater:()=>{KM.later=true;soft();F.toast('Rendben, holnap reggel újra rákérdezek')},
  kmask:a=>{KM.ask=a==='1';soft()},
  kmdel:()=>{Object.assign(KM,{on:false,ask:false,later:false});soft();F.toast('Kímélő mód törölve · az edzéseid visszaálltak')},
  kmbetter:()=>{if(KM.on&&KM.day===1){Object.assign(KM,{on:false,later:false,ask:false});KM.prev=null;soft();F.toast('Kímélő mód befejezve');return}
    KM.prev=KM.on?{...KM}:null;Object.assign(KM,{on:false,later:false,ask:false});soft();F.openSheet(kmWelcome())},
  kmok:()=>{KM.prev=null;F.closeSheet();F.toast('Jó, hogy jobban vagy')},
  kmundo:()=>{if(KM.prev)Object.assign(KM,KM.prev,{on:true,later:true,ask:false,applied:KM.applied});KM.prev=null;F.closeSheet();soft();F.toast('Rendben, a kímélő mód folytatódik')},
  /* Mai · Beszélgetés */
  mac:a=>{macroSel=macroSel===+a?null:+a;F.openSheet(SHEETS.uzemanyag())},
  core:()=>{macroSel=null;F.openSheet(SHEETS.uzemanyag())},
  obs:a=>{obsState[a]=1;soft();F.toast('Megjegyeztem a válaszod.')},
  ev:a=>{evOpen[a]=!evOpen[a];soft()},
  fbno:()=>{fbNo=true;soft()},
  exp:a=>{expMsg[a]=1;soft()},
  wk:a=>{if(a==='next')wkStep=Math.min(2,wkStep+1);else if(a==='accept'){wkRes='ok';F.toast('Elfogadva · a fehérjecél 200 g')}else{wkRes='skip';F.toast('Rendben, ezt most kihagyjuk')}soft()},
  ritual:()=>{ND.ritual=true;F.go('napzaras.1')},
  /* Rutin */
  face:a=>{nowRow=-1;F.go('rutin.'+a)},
  tick:a=>{const R=RUTIN[face].rows,i=+a;R[i][4]=R[i][4]?0:1;let t='';if(R[i][4]){const d=R.filter(r=>r[4]).length;nowRow=R.findIndex((r,j)=>j>i&&!r[4]);t=d===R.length?`${face==='este'?'Tökéletes este':face==='reggel'?'Tökéletes reggel':'Tökéletes nap'} · ${d} / ${R.length}`:`Szokás · ${d} / ${R.length} · megvan, a lánc erősödik`}soft();if(t)F.toast(t)},
  reflect:()=>{F.closeSheet();F.toast('Megjegyeztem')},
  reroll:a=>{rerolls=0;QUESTS[+a]={ic:'t-sleep',t:'Pihenőnap: aludj legalább 7,5 órát',xp:20,st:'offered',foot:'folyamatban · a logjaidból záródik magától',cta:'Alvás'};soft();F.toast('Újrasorsolva')},
  rst:a=>{const [k,v]=a.split(':');RE[k]=v;soft()},
  fw:a=>{fwRaw=a;fwPick=a==='free'?'fogg':a;soft();if(a==='free')F.toast('Keret nélkül: csak a tett lépése')},
  eff:a=>{const [x,y]=a.split(':');effort[+x]=+y;soft()},
  ft:a=>{sklFilter[+a]=!sklFilter[+a];soft()},
  /* A napom */
  nddim:a=>{ND.open.has(a)?ND.open.delete(a):ND.open.add(a);soft()},
  ndadj:()=>{ND.adj=!ND.adj;soft()},
  /* általános űrlap-elemek */
  pick:(a,el)=>{[...el.parentNode.children].forEach(c=>c.classList.toggle('on',c===el));if(a)F.toast(a)},
  sc:(a,el)=>{[...el.parentNode.children].forEach((b,i)=>{b.className=i+1<+a?'f':i+1===+a?'a':''})},
  inc:(a,el)=>{const b=el.parentNode.querySelector('b');b.textContent=Math.max(0,+b.textContent+ +a)},
  wat:a=>{wat=+a;F.openSheet(SHEETS.water())},
  ndlog:a=>{const T=NDT;ndClock[1]+=17;if(ndClock[1]>=60){ndClock[0]++;ndClock[1]-=60}T.updated=`${ndClock[0]}:${pad2(ndClock[1])}`;
    if(a==='meal'){T.kcal+=420;T.prot+=18;T.nova=Math.min(90,T.nova+3)} if(a==='work')T.work=1; if(a==='ck')T.ck++;
    F.closeSheet();soft();F.toast('Beírva · a napod frissült')},
  save:()=>{F.closeSheet();F.toast('Mentve')}
};
document.addEventListener('click',e=>{
  const ph=$('#phone'); if(!ph||ph.dataset.v!=='feher'||ph.dataset.d!=='nap')return;
  const el=e.target.closest&&e.target.closest('[data-n]'); if(!el||!ph.contains(el))return;
  e.stopPropagation();e.preventDefault(); if(el.disabled)return;
  const s=el.dataset.n,k=s.indexOf(':'),cmd=k<0?s:s.slice(0,k),arg=k<0?'':s.slice(k+1);
  if(ACT[cmd])ACT[cmd](arg,el);
},true);

/* ── domain CSS ── */
const P='.phone[data-v="feher"][data-d="nap"]';
const CSS=`
${P} .np-pre{margin:12px 14px 0}
${P} .np-pre .fh-seg{margin:0;background:rgba(255,255,255,.75);box-shadow:inset 0 0 0 1px rgba(15,30,51,.06)}
${P} .fh-seg button{position:relative;min-width:0}
${P} .np-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--dom);margin-left:5px;vertical-align:2px}
${P} .np-dots{display:flex;gap:5px;margin:2px 0 0}
${P} .fh-hero .np-dots{margin-top:12px}
${P} .sheet .np-dots{margin-bottom:6px}
${P} .np-dots i{flex:1;height:5px;border-radius:3px;background:rgba(15,30,51,.10)}
${P} .np-dots i.on{background:var(--dom)}
${P} .np-hi{display:grid;place-items:center;width:64px;height:64px;border-radius:20px;background:rgba(255,255,255,.8);flex:0 0 auto;box-shadow:inset 0 0 0 1px rgba(15,30,51,.05)}
${P} .np-hi svg.ic{width:44px;height:44px;filter:drop-shadow(0 6px 7px rgba(15,30,51,.25))}
${P} svg.ic.np-inl{display:inline-block;width:17px;height:17px;vertical-align:-4px;margin-right:5px}
${P} .np-rows{margin-top:14px;padding-top:12px;border-top:1px solid var(--hair)}
${P} .fh-row .g .bar{display:block;width:auto;margin-top:7px}
${P} .fh-row.now{margin:0 -8px;padding:12px 8px;border-radius:16px;border-top-color:transparent;background:color-mix(in srgb,var(--dom) 9%,#fff)}
${P} .fh-row.now + .fh-row{border-top-color:transparent}
${P} .fh-row.done strong{color:var(--sub);font-weight:500}
${P} .fh-row.np-dim{opacity:.5}
${P} .fh-row .v small{font-size:11.5px;color:var(--sub)}
${P} .np-stt{margin-left:4px;vertical-align:1px}
${P} .fh-stat .n small{white-space:nowrap}
${P} .fh-hero .fh-art{width:76px;height:76px;right:12px;top:12px}
${P} .fh-hero .fh-art svg.ic{width:76px;height:76px}
${P} .fh-hero .fh-art ~ .lbl{display:block;padding-right:84px}
${P} .fh-hero .fh-art ~ .verdict,${P} .fh-hero .fh-art ~ .sub{padding-right:84px}
${P} .np-now{color:var(--dom);font-weight:700}
${P} .np-tl{font:inherit;font-weight:600;color:var(--dom);text-decoration:underline;text-underline-offset:3px;text-align:left}
${P} .np-w{font-size:11.5px;font-weight:500;color:var(--faint);margin-left:4px;white-space:nowrap}
${P} .np-open{display:block;margin-top:8px;font-size:12.5px;line-height:1.45;color:var(--sub)}
${P} .np-inacts{display:flex;margin-top:8px}
${P} .np-tk{width:30px;height:30px;border-radius:50%;border:2px solid rgba(15,30,51,.22);display:grid;place-items:center;color:transparent;flex:0 0 auto;background:#fff}
${P} .np-tk.on{background:var(--ok);border-color:var(--ok);color:#fff;box-shadow:0 6px 12px -6px var(--ok)}
${P} .np-tk svg.ic{width:15px;height:15px;stroke-width:2.6}
${P} .np-mk{width:24px;height:24px;border-radius:50%;border:2px dashed rgba(15,30,51,.22);display:grid;place-items:center;flex:0 0 auto;color:#fff}
${P} .np-mk.d{border:0;background:var(--ok)}
${P} .np-mk.now{border-style:solid;border-color:var(--dom)}
${P} .np-mk svg.ic{width:13px;height:13px;stroke-width:2.6}
${P} .np-mv{display:flex;gap:4px;flex:0 0 auto}
${P} .np-mv button{width:32px;height:32px;border-radius:10px;background:var(--page);font-size:11px;color:var(--sub)}
${P} .np-okline{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;color:var(--ok)}
${P} .np-okline svg.ic{width:16px;height:16px;stroke-width:2.4}
${P} .np-ask{font-size:13.5px;color:var(--sub)}
${P} .np-thumb{width:40px;height:40px;border-radius:12px;background:var(--page);display:grid;place-items:center}
${P} .np-thumb svg.ic{width:24px;height:24px}
${P} .np-out{margin:14px 18px 0}
${P} .np-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px}
${P} .np-scale button{height:42px;border-radius:12px;background:var(--page);font-family:var(--disp);font-size:15px;font-weight:700;color:var(--sub);text-align:center}
${P} .np-scale button.f{background:color-mix(in srgb,var(--dom) 16%,#fff);color:var(--ink)}
${P} .np-scale button.a{background:var(--dom);color:#fff;box-shadow:0 8px 14px -8px var(--dom)}
${P} .np-sl{display:flex;justify-content:space-between;font-size:11.5px;color:var(--faint);margin-top:6px}
${P} .np-q{font-family:var(--disp);font-size:19px;font-weight:700;letter-spacing:-.4px;line-height:1.25;margin:2px 0 4px}
${P} .np-bigrow{display:flex;align-items:center;gap:14px;margin:12px 0 4px}
${P} .np-bigrow .fh-big small{display:inline}
${P} .np-nav{display:flex;justify-content:space-between;gap:10px;margin-top:18px;flex-wrap:wrap}
${P} .np-sum .fh-row .v{font-size:13.5px;white-space:normal;text-align:right;max-width:48%}
${P} .np-sum .fh-row .si{width:34px;height:34px}${P} .np-sum .fh-row .si svg.ic{width:24px;height:24px}
${P} .np-shh{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}
${P} .np-shh .g{flex:1;min-width:0}
${P} .np-shh h2{margin:0}
${P} .np-shh p{font-size:13px;line-height:1.4;color:var(--sub);margin-top:3px}
${P} .np-x{font-size:22px;line-height:1;color:var(--sub)}
${P} .np-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
${P} .np-two.np-three{grid-template-columns:repeat(3,1fr)}
${P} .np-two .btn{padding-left:8px;padding-right:8px}
${P} .np-two .fh-lab:first-child{margin-top:14px}
${P} .np-wide{display:flex;width:100%}
${P} .np-ctr{display:block;margin:14px auto 0}
${P} .sheet .fh-lab:first-child{margin-top:0}
${P} .fh-card > .fh-lab:first-child{margin-top:0}
${P} textarea.fh-in{resize:none;line-height:1.45;font-family:inherit}
${P} .fh-pill small{font-weight:500;opacity:.7}
${P} .np-opt4{display:grid;grid-template-columns:1fr 1fr;gap:8px}
${P} .np-opt4 button{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:14px 12px;border-radius:16px;background:var(--page);font-size:14px;font-weight:600;text-align:left}
${P} .np-opt4 button svg.ic{width:36px;height:36px;filter:drop-shadow(0 5px 6px rgba(15,30,51,.25))}
${P} .np-opt4 button.on{background:color-mix(in srgb,var(--dom) 12%,#fff);box-shadow:inset 0 0 0 2px var(--dom)}
${P} .np-qg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
${P} .np-qg button{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 4px 12px;border-radius:16px;background:var(--page);font-size:13px;font-weight:600;text-align:center;min-width:0}
${P} .np-qg button svg.ic{width:36px;height:36px;filter:drop-shadow(0 5px 6px rgba(15,30,51,.25))}
${P} .np-ej{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
${P} .np-ej button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 4px 10px;border-radius:16px;background:var(--page);min-width:0}
${P} .np-ej button svg.ic{width:30px;height:30px;filter:drop-shadow(0 4px 5px rgba(15,30,51,.22))}
${P} .np-ej b{font-family:var(--disp);font-size:22px;font-weight:800;letter-spacing:-.6px;margin-top:4px}
${P} .np-ej small{font-size:11.5px;font-weight:600;color:var(--sub)}
${P} .np-ej button.warn{background:color-mix(in srgb,var(--warn) 14%,#fff)}${P} .np-ej button.warn b{color:var(--warn)}
${P} .np-g28{display:grid;grid-template-columns:repeat(14,1fr);gap:4px;margin-top:12px}
${P} .np-g28 i{display:block;aspect-ratio:1;border-radius:5px;background:color-mix(in srgb,var(--dom) 70%,#fff)}
${P} .np-g28 i.m{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(15,30,51,.12)}
${P} .np-g28 i.s{background:rgba(15,30,51,.06)}
${P} .np-fig{display:flex;gap:18px;justify-content:center;margin:4px 0 10px}
${P} .np-fig figure{text-align:center;margin:0}
${P} .np-fig svg{width:78px;height:147px}
${P} .np-fig figcaption{font-size:11.5px;font-weight:600;color:var(--sub)}
${P} .np-fig .sil{fill:var(--page);stroke:rgba(15,30,51,.14)}
${P} .np-fig circle{fill:#fff;stroke:var(--faint);stroke-width:1.4;cursor:pointer}
${P} .np-fig circle.on{fill:var(--dom);stroke:var(--dom)}
${P} .np-d{border-top:1px solid var(--hair)}
${P} .np-d:first-child{border-top:0}
${P} .np-d summary{display:flex;align-items:center;gap:10px;padding:12px 0;list-style:none;cursor:pointer}
${P} .np-d:first-child summary{padding-top:0}${P} .np-d:last-child:not([open]) summary{padding-bottom:0}
${P} .np-d summary::-webkit-details-marker{display:none}
${P} .np-d summary .g{flex:1;min-width:0}
${P} .np-d summary strong{display:block;font-size:14.5px;font-weight:600}
${P} .np-d summary small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px;line-height:1.35}
${P} .np-d summary .chev{width:18px;height:18px;color:var(--faint);flex:0 0 auto;transition:transform .2s}
${P} .np-d[open] summary .chev{transform:rotate(90deg)}
${P} .np-db{padding:0 0 14px}
${P} .np-say{font-size:14px;padding:10px 12px;border-radius:14px;background:var(--page);margin-top:6px}
${P} .np-arc{display:block;width:100%;height:auto;margin-top:12px}
${P} .np-ctx{display:grid;grid-template-columns:1fr 1fr;gap:8px}
${P} .np-ctx div{padding:10px 12px;border-radius:14px;background:var(--page)}
${P} .np-ctx small{display:block;font-size:12px;font-weight:600;color:var(--sub)}
${P} .np-ctx b{display:block;font-family:var(--disp);font-size:16px;font-weight:700;letter-spacing:-.3px;margin-top:2px}
${P} .np-rail{display:flex;gap:6px;margin-top:14px;flex-wrap:wrap}
${P} .np-rail span{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:600;color:var(--faint);background:rgba(255,255,255,.7)}
${P} .np-rail .done{color:var(--sub)}
${P} .np-rail .on{color:#fff;background:var(--dom)}
${P} .np-chd{display:flex;gap:6px;margin-top:8px}
${P} .np-chd i{width:11px;height:11px;border-radius:50%;background:rgba(15,30,51,.12)}
${P} .np-chd i.d{background:var(--ok)}${P} .np-chd i.now{background:var(--dom);box-shadow:0 0 0 3px color-mix(in srgb,var(--dom) 22%,#fff)}
${P} .np-ft{display:grid;grid-template-columns:1fr 1fr;gap:8px}
${P} .np-ft button{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:var(--page);text-align:left;opacity:.55;min-width:0}
${P} .np-ft button.on{opacity:1;background:color-mix(in srgb,var(--dom) 11%,#fff);box-shadow:inset 0 0 0 2px var(--dom)}
${P} .np-ft b{font-family:var(--disp);font-size:22px;font-weight:800}
${P} .np-ft small{font-size:12px;font-weight:600;line-height:1.2;color:var(--sub)}
${P} .np-recept{font-size:16px;line-height:1.5}
${P} .fh-hero .np-recept{margin-top:8px}
${P} .np-blank{display:inline-block;width:52px;height:1em;border-bottom:2px dashed var(--faint);vertical-align:-2px}
${P} .np-eff{display:flex;align-items:center;gap:10px;padding:6px 0}
${P} .np-eff > span{flex:0 0 76px;font-size:14px;font-weight:600}
${P} .np-eff .fh-seg{flex:1;margin:0;min-width:0}
${P} .np-eff .fh-seg button{padding:7px 2px;font-size:12.5px}
${P} .np-stp{display:flex;align-items:center;gap:12px}
${P} .np-stp button{width:38px;height:38px;border-radius:12px;background:var(--page);font-size:20px;font-weight:600;text-align:center}
${P} .np-stp b{font-family:var(--disp);font-size:24px;font-weight:800;min-width:34px;text-align:center}
${P} .np-wk{position:relative;display:grid;grid-template-columns:repeat(7,1fr);gap:8px;height:128px;margin-top:10px}
${P} .np-wk::before{content:'';position:absolute;left:0;right:0;top:calc((100% - 22px)*.22);border-top:1.5px dashed rgba(15,30,51,.22)}
${P} .np-wk > div{display:flex;flex-direction:column;justify-content:flex-end;align-items:stretch;gap:5px;min-width:0}
${P} .np-wk .d{display:flex;flex-direction:column;border-radius:8px;overflow:hidden}
${P} .np-wk .d i{display:block}
${P} .np-wk .d.met{opacity:.35;filter:grayscale(1)}
${P} .np-wk .d.none{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(15,30,51,.10)}
${P} .np-wk small{height:17px;font-size:11.5px;font-weight:600;color:var(--sub);text-align:center}
${P} .np-wk .today small{color:var(--dom);font-weight:800}
${P} .ds i{font-style:normal}
${P} .fh-foot{flex-wrap:nowrap}
${P} .fh-foot .btn{padding-left:12px;padding-right:12px;white-space:nowrap;min-width:0}
${P} .fh-foot .fh-lk{padding:0 6px;white-space:nowrap}
${P} .fh-step time{font-size:13px}
/* ══ Folyadék-réteg: a Nap saját grafikái ══ */
${P} .np-pad{padding:0 16px}
${P} .np-pad .fh-acts{margin:6px 0 0 34px}
${P} .k2-h .fh-lk{font-size:12.5px}
${P} .np-airs{display:block;font-size:13px;font-weight:500;line-height:1.4;color:var(--sub);margin-top:6px;max-width:250px}
${P} .np-under{margin:12px 22px 0;font-size:12.5px;line-height:1.45;color:var(--sub)}
${P} .np-shift{position:absolute;left:20px;right:20px;bottom:calc(66% + 24px);z-index:4;display:flex;justify-content:space-between;align-items:flex-end;gap:8px;padding:0 2px 4px;border-bottom:2px dashed color-mix(in srgb,var(--liq2) 60%,transparent);font-size:12px;font-weight:600;color:var(--sub)}
${P} .np-shift b{color:var(--ink);font-weight:800}
${P} .np-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;align-items:center}
${P} .np-chips span{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:600;line-height:1.2;color:var(--ink);background:color-mix(in srgb,var(--dom) 9%,#fff)}
${P} .np-chips span::before{content:'';width:6px;height:8px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:linear-gradient(160deg,var(--liq1),var(--liq2));margin-right:6px;flex:0 0 auto}
${P} .np-chips b{font-size:12px;font-weight:700;color:var(--sub)}
${P} .fb.np-inl{vertical-align:-7px;margin-right:6px}
${P} .np-why{display:flex;gap:4px;align-items:flex-start;margin-top:12px;font-size:13.5px;line-height:1.45;padding:10px 12px;border-radius:18px;background:color-mix(in srgb,var(--dom) 7%,#fff)}
${P} .np-why>span:last-child{flex:1;min-width:0}
${P} .np-jar{flex:0 0 auto}
${P} .np-jt{font-family:var(--disp);font-size:24px;font-weight:800;letter-spacing:-1px}
${P} .np-end{margin-left:auto}
${P} .np-bigrow .fh-big em{display:block;font-style:normal;font-family:var(--ff);font-size:12.5px;font-weight:500;line-height:1.35;letter-spacing:0;color:var(--sub);margin-top:6px}
${P} .np-bigrow .fh-big em .np-chips{margin-top:0}
${P} .np-dots i.core{background:color-mix(in srgb,var(--dom) 30%,#fff)}
${P} .np-lnk{margin:0 0 14px;padding:10px 0 6px;border-radius:24px;background:color-mix(in srgb,var(--dom) 6%,#fff)}
${P} .np-cnt{font-family:var(--disp);font-size:14px;font-weight:800;color:var(--ink);letter-spacing:0}
${P} .np-tg{font-size:11.5px;font-weight:700;color:var(--sub);white-space:nowrap;flex:0 0 auto;margin-left:6px}
${P} .np-open .np-chips{margin:0 0 8px}
${P} .np-open>span{display:block}
${P} .fh-row .g .fl-level{margin-top:7px}
${P} .fh-row>.fl-mini{margin-right:2px}
${P} .np-f2{display:grid;gap:6px}
${P} .np-f2 div{display:flex;align-items:center;font-size:13.5px}
${P} .np-thumb{width:auto;height:auto;background:none}
/* skála = szint */
${P} .np-scale{grid-template-columns:repeat(10,1fr);gap:4px}
${P} .np-scale button{position:relative;overflow:hidden;height:66px;padding:0;border-radius:999px;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--dom) 5%,#fff));box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10);font-size:13px;color:var(--sub)}
${P} .np-scale button::before{content:'';position:absolute;left:0;right:0;bottom:0;height:calc(24px + var(--k)*4.2px);background:linear-gradient(180deg,var(--liq1),var(--liq2));opacity:0;transition:opacity .15s}
${P} .np-scale button span{position:absolute;left:0;right:0;bottom:7px;z-index:1}
${P} .np-scale button.f{background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--dom) 5%,#fff));color:var(--ink)}
${P} .np-scale button.f::before{opacity:.42}
${P} .np-scale button.a{background:#fff;color:#fff;box-shadow:inset 0 0 0 2px var(--liq2),0 10px 14px -8px var(--liq2)}
${P} .np-scale button.a::before{opacity:1}
/* 28 nap = apró szintek */
${P} .np-g28 i{aspect-ratio:auto;position:relative;overflow:hidden;height:26px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10)}
${P} .np-g28 i::before{content:'';position:absolute;left:0;right:0;bottom:0;height:var(--h,0%);background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${P} .np-g28 i.m{background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.16)}
${P} .np-g28 i.m::before{opacity:.4}
${P} .np-g28 i.s{background:rgba(10,42,60,.05);box-shadow:none}
${P} .np-g28 i.s::before{display:none}
${P} .np-leg{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--sub)}
${P} .np-leg span{display:inline-flex;align-items:center;gap:6px}
${P} .np-leg i{width:10px;height:16px;border-radius:999px;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.16)}
${P} .np-leg i.p{background:linear-gradient(180deg,var(--liq1),var(--liq2));box-shadow:none}
${P} .np-leg i.s{background:rgba(10,42,60,.06);box-shadow:none}
/* csepp-lánc */
${P} .np-drops{display:flex;align-items:flex-start;margin-top:16px}
${P} .np-dr{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;padding:0}
${P} .np-dr::before{content:'';position:absolute;top:11px;right:50%;width:100%;height:4px;border-radius:2px;background:rgba(10,42,60,.10)}
${P} .np-dr:first-child::before{display:none}
${P} .np-dr.d::before,${P} .np-dr.now::before{background:linear-gradient(90deg,var(--liq1),var(--liq2))}
${P} .np-dr i{position:relative;z-index:1;display:block;width:20px;height:25px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.16)}
${P} .np-dr.d i{background:linear-gradient(160deg,var(--liq1),var(--liq2));box-shadow:0 8px 12px -6px var(--liq2)}
${P} .np-dr.now i{box-shadow:inset 0 0 0 3px var(--liq2),0 0 0 5px color-mix(in srgb,var(--liq1) 30%,transparent)}
${P} .np-dr.x i{box-shadow:none;border:2px dashed rgba(10,42,60,.28)}
${P} .np-dr small{font-size:9.5px;font-weight:600;letter-spacing:-.2px;color:var(--sub);text-align:center;line-height:1.15;white-space:nowrap}
${P} .np-drops.big .np-dr i{width:24px;height:30px}
${P} .np-drops.big .np-dr::before{top:13px}
${P} .fh-hero .np-drops.big{margin-bottom:8px}
${P} .np-ch2>div>small{display:block;font-size:11.5px;font-weight:700;color:var(--sub);margin-top:14px}
${P} .np-ch2 .np-drops{margin-top:8px}
${P} .np-ch2 .two .np-drops{width:40%}
${P} .np-ch2 + .fh-facts{margin-top:16px}
/* kémcsövek a fő kártyában */
${P} .np-vh{margin-top:14px}
${P} .np-vh .k2-vials{gap:8px}
${P} .np-vh .k2-vial{min-width:0;gap:6px}
${P} .np-vh .k2-vial b{font-size:16px}
${P} .np-vh .k2-vial small{font-size:11px}
${P} .np-vh .k2-tube svg.ic{width:28px;height:28px;bottom:10px}
${P} .np-vh .k2-tube em{top:11px;font-size:9.5px}
${P} .np-six .k2-vials{gap:5px}
${P} .np-six .k2-vial small{font-size:10px;letter-spacing:-.2px;white-space:nowrap}
${P} .np-six .k2-vial b{font-size:15px}
${P} .np-six .k2-tube svg.ic{width:22px;height:22px;bottom:8px}
${P} .np-six .k2-tube em{font-size:8px;top:10px;color:var(--warn);font-weight:700}
${P} .np-wk3 .k2-tube em{top:8px}
${P} .np-pipe .k2-vials{position:relative}
${P} .np-pipe .k2-vials::before{content:'';position:absolute;left:10%;right:10%;top:76px;height:8px;border-radius:4px;background:linear-gradient(90deg,var(--liq1),var(--liq2));opacity:.55}
${P} .np-pipe .k2-tube{z-index:1}
${P} .np-pipe .k2-vial b{font-size:14px}
/* check-in: a négy pillanat és a válasz-kapszulák */
${P} .np-slot{padding:14px 0;border-top:1px solid var(--hair)}
${P} .np-slot:first-child{border-top:0;padding-top:0}
${P} .np-slot.now{margin:0 -8px;padding:14px 8px;border-radius:22px;border-top-color:transparent;background:color-mix(in srgb,var(--dom) 9%,#fff)}
${P} .np-slot.now + .np-slot{border-top-color:transparent}
${P} .np-slot.later{opacity:.6}
${P} .np-slh{display:flex;align-items:center;gap:10px}
${P} .np-slh time{font-family:var(--disp);font-size:15px;font-weight:800;min-width:46px}
${P} .np-slh .g{flex:1;min-width:0}
${P} .np-slh strong{display:block;font-size:14.5px;font-weight:650}
${P} .np-slh small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px;line-height:1.35}
${P} .np-cells{display:flex;flex-wrap:wrap;gap:12px 4px;margin-top:12px}
${P} .np-cells .fl-mini{width:46px;min-width:0}
${P} .np-cells .fl-mini b{font-size:11.5px;white-space:nowrap}
${P} .np-cells .fl-mini small{font-size:9.5px;white-space:nowrap}
/* mit táplál: forrás → négy csoport */
${P} .np-feedw{margin-top:12px}
${P} .np-feed{display:block;width:100%;height:auto;overflow:visible}
${P} .np-ft1{font-family:var(--disp);font-size:15px;font-weight:800;fill:#fff}
${P} .np-ft2{font-family:var(--disp);font-size:18px;font-weight:800;fill:#fff}
${P} .np-feedl{display:grid;grid-template-columns:repeat(4,1fr);margin-top:6px}
${P} .np-feedl span{font-size:10.5px;font-weight:600;line-height:1.2;text-align:center;color:var(--sub);padding:0 2px}
/* a hét hét edény */
${P} .np-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:14px 14px 0}
${P} .np-week button{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;padding:0}
${P} .np-week small{font-size:11px;font-weight:600;color:var(--sub)}
${P} .np-week .t{position:relative;display:block;width:100%;height:62px;border-radius:999px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.09)}
${P} .np-week .t i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${P} .np-week .t b{position:absolute;left:0;right:0;bottom:8px;font-family:var(--disp);font-size:13px;font-weight:800;color:#fff;text-align:center}
${P} .np-week .th .t b{color:var(--sub)}
${P} .np-week em{font-style:normal;font-family:var(--disp);font-size:13px;font-weight:700;color:var(--sub)}
${P} .np-week .on .t{box-shadow:inset 0 0 0 2.5px var(--ink)}
${P} .np-week .on small,${P} .np-week .on em{color:var(--ink);font-weight:800}
${P} .np-week .fut{opacity:.5}
${P} .np-week .fut .t{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.14)}
/* gyors logolás: buborékok az edényben */
${P} .np-qtank{position:relative;margin:14px 14px 0;border-radius:44px;overflow:hidden;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--dom) 5%,#fff));box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),0 30px 50px -30px var(--liq2)}
${P} .np-qtank .air{padding:22px 20px 36px}
${P} .np-qtank .air>small{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--sub)}
${P} .np-qtank .air>p{font-family:var(--disp);font-size:23px;font-weight:800;letter-spacing:-.8px;line-height:1.1;margin-top:4px}
${P} .np-qchat{display:flex;align-items:center;gap:10px;width:100%;margin-top:14px;padding:10px 12px;border-radius:999px;text-align:left;background:#fff;box-shadow:0 10px 18px -12px rgba(10,42,60,.5),inset 0 0 0 1px rgba(10,42,60,.06)}
${P} .np-qchat .g{flex:1;min-width:0}
${P} .np-qchat strong{display:block;font-size:14.5px;font-weight:700}
${P} .np-qchat small{display:block;font-size:12px;color:var(--sub);line-height:1.3}
${P} .np-qchat .chev{width:18px;height:18px;color:var(--faint);flex:0 0 auto}
${P} .np-qtank .liq{position:relative;padding:14px 12px 26px;background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${P} .np-qtank .lb{display:block;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,.92);margin:0 8px 12px}
${P} .np-bubs{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 6px}
${P} .np-bubs button{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0;color:#fff;font-size:13px;font-weight:700}
${P} .np-bubs button:nth-child(3n+2){transform:translateY(10px)}
${P} .np-bubs .fb{background:radial-gradient(circle at 30% 24%,#fff 0 20%,rgba(255,255,255,.94) 62%,rgba(255,255,255,.8))}
/* napzárás: alkonyi víz, rétegzett termés */
${P} .np-nz,${P} .np-night{--liq1:color-mix(in srgb,var(--dom) 72%,var(--ink));--liq2:color-mix(in srgb,var(--dom) 26%,var(--ink))}
${P} .np-arcw{margin-top:12px}
${P} .np-strata{display:flex;gap:14px;height:214px;margin-top:14px}
${P} .np-strata .v{display:flex;flex-direction:column-reverse;flex:0 0 96px;padding-top:28px;border-radius:34px;overflow:hidden;background:#fff;box-shadow:0 0 0 2px rgba(10,42,60,.08),0 20px 26px -20px var(--liq2)}
${P} .np-strata .v i{display:block;background:color-mix(in srgb,var(--liq2) var(--m),#fff);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.5)}
${P} .np-strata ol{display:flex;flex-direction:column-reverse;flex:1;min-width:0;padding:28px 0 0;margin:0;list-style:none}
${P} .np-strata li{display:flex;align-items:center;gap:8px;min-height:0;font-size:13px;font-weight:600;border-top:1px dashed rgba(10,42,60,.16)}
${P} .np-strata li b{font-family:var(--disp);font-size:15px;font-weight:800;min-width:38px}
/* szokás: érés szakaszokon át */
${P} .np-stg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
${P} .np-stg button{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;padding:0;opacity:.45}
${P} .np-stg button.on{opacity:1}
${P} .np-stg .t{position:relative;display:block;width:100%;height:104px;border-radius:26px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.08)}
${P} .np-stg .on .t{box-shadow:inset 0 0 0 2.5px var(--liq2),0 14px 18px -14px var(--liq2)}
${P} .np-stg .t i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${P} .np-stg .t b{position:absolute;left:0;right:0;bottom:3px;font-family:var(--disp);font-size:18px;font-weight:800;color:#fff;text-align:center}
${P} .np-stg small{font-size:10.5px;font-weight:600;line-height:1.2;color:var(--sub);text-align:center}
${P} .np-mat{display:flex;gap:14px;height:204px;margin-top:14px}
${P} .np-mat .t{position:relative;flex:0 0 88px;border-radius:34px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.08),0 20px 26px -20px var(--liq2)}
${P} .np-mat .t i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${P} .np-mat .t u{position:absolute;right:0;width:18px;height:2px;background:rgba(10,42,60,.22)}
${P} .np-mat .t b{position:absolute;left:0;right:0;bottom:16px;font-family:var(--disp);font-size:24px;font-weight:800;color:#fff;text-align:center}
${P} .np-mat ol{flex:1;min-width:0;display:flex;flex-direction:column;list-style:none;margin:0;padding:0}
${P} .np-mat li{flex:1;display:flex;flex-direction:column;justify-content:center;padding-left:2px;color:var(--faint);border-top:1.5px dashed rgba(10,42,60,.16)}
${P} .np-mat li:first-child{border-top:0}
${P} .np-mat li b{font-size:13.5px;font-weight:650}
${P} .np-mat li small{font-size:11.5px;color:var(--sub);line-height:1.25}
${P} .np-mat li.done{color:var(--sub)}
${P} .np-mat li.on{color:var(--ink)}
${P} .np-mat li.on b{font-weight:800}
${P} .np-rec{display:flex;gap:10px;margin:12px 0 4px}
${P} .np-rec span{position:relative;flex:1;min-width:0;height:38px;display:grid;place-items:center;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.12)}
${P} .np-rec span + span::before{content:'';position:absolute;right:100%;top:50%;width:10px;height:5px;margin-top:-2.5px;background:rgba(10,42,60,.12)}
${P} .np-rec .f + span::before{background:var(--liq2)}
${P} .np-rec i{position:absolute;inset:0;border-radius:999px;background:linear-gradient(135deg,var(--liq1),var(--liq2));opacity:0}
${P} .np-rec .f i{opacity:1}
${P} .np-rec b{position:relative;font-size:12px;font-weight:700;color:var(--sub);white-space:nowrap}
${P} .np-rec .f b{color:#fff}
${P} .np-loop{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:6px}
${P} .np-loop i{font-style:normal;font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:999px;background:color-mix(in srgb,var(--dom) 9%,#fff)}
${P} .np-loop u{text-decoration:none;color:var(--faint);font-size:12px}
${P} .np-effout{margin-top:12px}
/* lapok */
${P} .np-ramp{display:flex;justify-content:space-around;gap:8px;margin:0 0 12px;padding:14px 8px;border-radius:22px;background:color-mix(in srgb,var(--dom) 6%,#fff)}
${P} .np-ramp .fl-mini .t{width:30px;height:60px}
${P} .np-ramp .fl-mini small{text-align:center;max-width:92px;line-height:1.2}
${P} .np-ref{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
${P} .np-ref button{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 6px 12px;border-radius:24px;background:color-mix(in srgb,var(--dom) 6%,#fff)}
${P} .np-ref .fl-mini .t{width:34px;height:64px}
${P} .np-ref b{font-family:var(--disp);font-size:15px;font-weight:800}
${P} .np-qg button{background:color-mix(in srgb,var(--dom) 6%,#fff);border-radius:24px}
${P} .np-qg button small{display:block;font-size:11px;font-weight:500;color:var(--sub);margin-top:2px}
${P} .np-opt4 button{border-radius:22px}
${P} .np-wk{height:150px}
${P} .np-wk::before{top:calc((100% - 22px)*.107);z-index:2}
${P} .np-wk .t{position:relative;flex:1;display:block;border-radius:999px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10)}
${P} .np-wk .t .q{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column}
${P} .np-wk .t.met{opacity:.4;filter:grayscale(1)}
${P} .np-wk .t.none{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10)}
${P} .np-wk .today .t{box-shadow:inset 0 0 0 2px var(--ink)}
@media (max-width:350px){
  ${P} .np-six .k2-vial small{font-size:9px}
  ${P} .np-scale{gap:3px}
  ${P} .np-airs{max-width:210px}
}
`;

/* ── a koncepció-képernyő (sima `mai`, foly.js) kiegészítése: ami a jóváhagyott képernyőről hiányzik ──
   F.napMaiExtra(n): „Továbbiak” szakasz a napló után (n megadva: számozott szakaszcím; nélküle a koncepció k2-h fejléce).
   F.napMaiState(): 'kimelo' | 'kimelo-lejart' | '' — ha nem üres, a sima `mai` helyett F.napMaiFull() rajzolandó
   (a jelenlegi kímélő-állapottal; a `mai.kimelo` útvonal a demó-előbeállítást töltené rá). */
F.napMaiExtra=(n)=>`${n?sec(n,'Továbbiak',5):kh('Továbbiak','ami még a naphoz tartozik','',5)}
  ${card(xrow({icon:'t-macro',title:'A hét üzemanyaga',sub:'napi edények és a három makró',on:{sheet:'uzemanyag'}})
    +xrow({icon:'t-heart',title:'Életjelek',sub:'hat jel · a mozgás kér figyelmet',v:String(needAvg()),on:'eletjel'})
    +xrow({icon:'t-calendar',title:'Heti egyeztetés',sub:'vasárnap · 1 javaslat vár · 3 lépés, kb. 2 perc',right:st('Új','plan')+chev(),on:'uzenetek'})
    +xrow({icon:'t-pattern',title:'Összes észrevétel',sub:`${OBS.filter(o=>!obsState[o.k]).length} vár a válaszodra`,on:'uzenetek.eszrevetelek'})
    +acts(btn('+ Új bejegyzés','gyors','sm')+btn('Napló',{sheet:'naplopick'},'sm ghost')+lk('Több',{sheet:'tobb'}))
    +(KM.on?'':`<div class="np-rows">${xrow({icon:'t-kimelo',title:'Nem vagyok jól',sub:'Kímélő mód: betegség, sérülés vagy utazás idejére',n:'km:open'})}</div>`),{i:5})}`;
F.napMaiState=()=>KM.on?(kmExpired()?'kimelo-lejart':'kimelo'):'';
F.napMaiFull=()=>mai(KM.applied||'');

register('nap',{title:'Nap',
  tabs:[['Mai','mai'],['A napom','napom'],['Beszélgetés','uzenetek'],['Rutin','rutin']],
  routes:{mai,maieste,checkin,hatasok,napom,eletjel,kuldetesek,rutin,uzenetek,gyors,napzaras,nap:napDay,'rutin-epites':rutinEpites,lanc,szokasok,szokas,szerk,'rutin-uj':rutinUj},
  sheets:SHEETS,
  css:CSS,
  notes:`<h2>Nap</h2>
<p>Minden oldal kapott egy saját rajzot, ami abból az adatból áll, amiről az oldal szól. Az oldal a rajzáról felismerhető, a többi része csendes lista.</p>
<h2>Melyik oldalon mi a rajz</h2>
<ul>
<li><b>Mai:</b> a jóváhagyott képernyő (nagy edény, négy kémcső, folyam). Ugyanez este (<b>#w-nap-maieste</b>, sötétebb, esti vízzel) és kímélő módban (<b>#w-nap-mai.kimelo</b>).</li>
<li><b>Check-in:</b> a nap négy pillanata négy edény. A válaszaid kis kapszulák: a szint az, amit a tízes skálán adtál. A kitöltő lapon a skála maga is tíz kémcső.</li>
<li><b>Mit táplál a check-in:</b> egy forrás-edényből négy csoportba folyik tovább, amit megadsz.</li>
<li><b>Életjelek:</b> hat kémcső egymás mellett, az alacsony megjelölve.</li>
<li><b>Küldetések:</b> három edény, ami magától telik.</li>
<li><b>A napom:</b> a hét hét kis edény. A lezárt nap egy nagy edény a pontszámmal; a szaggatott vonal az alap, a folyadék a végső pontszám. „Te és az app”: két összekötött edény.</li>
<li><b>Beszélgetés:</b> a heti egyeztetés három edénye lépésenként telik. Az észrevételeknél két összekötött edény mutatja, mi mivel mozog együtt.</li>
<li><b>Rutin:</b> a lánc összekötött cseppek sora, pipálásra telik. Az utolsó 28 nap 28 apró kémcső.</li>
<li><b>Rutinok szerkesztése:</b> a reggeli és az esti lánc két csepp-sor. A lánc oldalán öt összekötött edény, mindegyik a szokás erejéig tele. A szokásoknál a négy érési szakasz négy edény, egy szokásnál pedig egy magas edény, amin a szint szakaszról szakaszra emelkedik. Az új szokás receptje annyi edényből áll, ahány lépés, és úgy telik, ahogy kitöltöd.</li>
<li><b>Gyors logolás:</b> kilenc buborék egy edényben.</li>
<li><b>Napzárás:</b> a nap edénye megtelik, a végén fedelet kap. A nap íve egy vízfelszín, a mai termés rétegenként áll egy edényben.</li>
<li><b>Lapok:</b> a víznél egy pohár telik, a súlynál és az alvásnál vízfelszín mutatja a hetet és az éjszakát, a hét üzemanyaga hét edény.</li>
</ul>
<h2>Ami visszakerült</h2>
<ul>
<li>Check-in: a válaszok egyenként látszanak (nem egy sor szövegben).</li>
<li>Reggeli üzenet: „Amire épült” és „Miből gondolom”.</li>
<li>Rutin: lánc-erő százalék és soronként az erő szintje.</li>
<li>Szokások: ismétlésszám, hátralévő idő; a szokás oldalán a naptár jelmagyarázata.</li>
<li>A napom: „Próbáld ki: írj be valamit” – az oldal azonnal frissül.</li>
<li>Napzárás: a sorozat és a „86 napja életben” sor.</li>
</ul>`
});
})();
