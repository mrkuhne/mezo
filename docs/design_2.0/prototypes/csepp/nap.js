/* csepp/nap.js — Nap domain (Mai · A napom · Beszélgetés · Rutin + sheets). Built on window.K (see csepp/README.md).
   Routes = the living prototype's (elo/nap.html): mai checkin hatasok napom eletjel kuldetesek rutin uzenetek gyors
   napzaras.N nap.<date>(.este) maieste rutin-epites lanc szokasok szokas szerk rutin-uj.<step>; kímélő: mai.kimelo, mai.kimelo-lejart. */
(function(){
const {I,T,csepp,page,sec,back,wkBars,register,toast,openSheet,closeSheet}=K;
const $=s=>document.querySelector(s);
const pad2=n=>String(n).padStart(2,'0');
/* re-render the current route without pushing history (the shell listens to hashchange) */
function soft(){const sc=$('#phone .scroll');const y=sc?sc.scrollTop:0;window.dispatchEvent(new HashChangeEvent('hashchange'));const s2=$('#phone .scroll');if(s2)s2.scrollTop=y}
const route=()=>K.R+(K.ARG?'.'+K.ARG:'');

/* ── a csapat: testvérformák (a feladó a forma, a szöveg a hang) ── */
const TEAM={szunya:['Szunya','alvás','#AB9FD2','pebble'],mocor:['Mocor','mozgás','#7FB2D0','bean'],falat:['Falat','étel','#8FB49A','drop'],deru:['Derű','kedv','#D9B67E','leaf'],mezo:['Mezo','összkép','#9AA3A8','crystal']};
const sender=(k,sub='',s=30)=>{const [n,r,c,f]=TEAM[k];return `<span class="snd">${csepp('ok',60,{s,form:f,color:c,alive:false})}<span class="g"><b>${n}</b>${sub?`<small>${sub}</small>`:`<small>${r}</small>`}</span></span>`};
/* fields (prototype: static text in a hairline field) */
const VF=(ph,sample,{rows=2,value}={})=>`<div class="fld ${rows>1?'ta':''} ${value?'':'ex'}" style="--rows:${rows}">${value||sample||ph}</div>`;
const field=(l,inner)=>`<div class="field"><span class="eb">${l}</span>${inner}</div>`;
const scale=(v,c='var(--acc)',attr='data-scale')=>`<div class="scale" style="--c:${c}">${Array.from({length:10},(_,i)=>`<button class="${i+1<v?'f':i+1===v?'a':''}" ${attr}="${i+1}">${i+1}</button>`).join('')}</div>`;
const segs=(items,on,attr,c='')=>`<div class="seg3 ${c}">${items.map(([k,l,d])=>`<button class="${k===on?'on':''}" ${attr}="${k}">${l}${d&&k!==on?'<i class="dot"></i>':''}</button>`).join('')}</div>`;
const sheetH=(eb,title,sub='',backTo='')=>`<div class="shh">${backTo?`<button class="lk" data-sheet="${backTo}">‹</button>`:''}<span class="g"><span class="eb">${eb}</span><h2 class="t">${title}</h2>${sub?`<p class="txt sub">${sub}</p>`:''}</span><button class="x" data-close aria-label="Bezárás">×</button></div>`;
const saveRow=(l='Mentés',attr='data-save')=>`<div class="two"><button class="btn ghost" data-close>Mégse</button><button class="btn" ${attr}>${l}</button></div>`;
/* 28 napos csendes konzisztencia-rács (MF habits widget): pipa · kimaradt · nem volt sor */
const grid28=(seed,miss=[],skip=[],n=28)=>`<div class="g28">${Array.from({length:n},(_,i)=>`<i class="${skip.includes(i)?'s':miss.includes(i)?'m':((i*7+seed)%10<8)?'p':'m'}"></i>`).join('')}</div>`;

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
const REG_F=[['Fej',52,16],['Nyak',52,35],['Váll',33,46],['Könyök',22,82],['Csukló, kéz',19,106],['Has',52,80],['Csípő',42,106],['Térd',45,150],['Boka, lábfej',47,184]];
const REG_B=[['Felső hát',52,56],['Derék',52,96]];
const KINDS=['Édes','Sós','Zsíros','Bármit'];
const SLOTS=[{n:'Reggel',t:'06:30',st:'done',a:{energy:7,mood:8,stress:3,body:6,mental:7,rested:6,soreness:5,pain:{regions:['Térd'],int:4},motivation:8,hunger:5},note:'Nyugodt ébredés · pihenve'},{n:'Délelőtt',t:'10:00',st:'done',quick:true,a:{energy:8,mood:7,stress:4,body:7,mental:8}},{n:'Délután',t:'14:00',st:'now'},{n:'Este',t:'20:00',st:'pending'}];
let ck={slot:'14:00',step:0,a:{},quick:false};
const ckSteps=(t=ck.slot)=>[...PLAN[t],ADAPT[t].id];
function ckDisp(id,a,short){
  if(!(id in a))return null; const v=a[id]; if(v===null||v===undefined)return '—';
  if(id==='pain'){if(v===false)return 'Nem';const r=v.regions.length?v.regions.join(', '):'Igen';return short?`${v.regions[0]||'Igen'}${v.int?' '+v.int:''}`:`${r}${v.int?' · '+v.int+'/10':''}`}
  if(id==='craving'){const k=(v.kinds||[]).join(', ');return short?`${v.kinds&&v.kinds[0]?v.kinds[0]+' ':''}${v.v}`:`${v.v}${k?' · '+k:''}`}
  return String(v);
}
const NEEDS=[['Étel','t-bowl',72,'meal'],['Víz','t-water',52,'water'],['Alvás','t-sleep',81,'sleep'],['Mozgás','t-dumbbell',34,'train'],['Kapcsolat','t-people',64,'checkin'],['Rend','t-chain',58,'']];
const QUESTS=[
  {ic:'t-dumbbell',t:'A mai tervezett edzés a naptárban van — csináld végig',why:'A megjelenés a legerősebb identitás-szavazat: aki ma edz, az edző ember.',xp:25,st:'offered',cta:'Edzés',foot:'folyamatban · az edzésből záródik magától'},
  {ic:'t-weight',t:'Reggeli súlymérés — logold be',xp:15,st:'done'},
  {ic:'t-journal',t:'Olvass ma legalább 10 percet',xp:20,st:'offered',foot:'folyamatban · a logjaidból záródik magától'}];
let rerolls=1;
const RUTIN={
  reggel:{title:'Reggeli rutin',stat:['6/30','tökéletes reggel'],xp:25,rows:[
    ['Ébredés időben','a lánc kezdete','t-dawn',82,1],['Reggeli napfény','ébredés után','t-sun',64,1],['50 fekvőtámasz','megvolt a reggeli napfény','t-dumbbell',48,0],['Reggeli videó','megvolt az 50 fekvőtámasz','t-camera',39,0,1],['Reggeli súlymérés','fogmosás után','t-weight',93,1],['Gombakávé','súlymérés után','t-bowl',71,0],['Reggeli edzés','kávé után','t-run',57,0],['Fehérjés reggeli','edzés után','t-protein',79,0]]},
  napkozben:{title:'Napközbeni rutin',stat:['11/30','tökéletes nap'],xp:10,rows:[
    ['Ebéd utáni séta','ebéd után','t-steps',61,1],['Víz · 2 liter','délutánig','t-water',70,0],['Képernyőszünet','minden óra végén','t-clock',44,0]]},
  este:{title:'Esti rutin',stat:['4/30','tökéletes este'],xp:0,rows:[
    ['Koffein-cutoff','14:00 után már nem','t-clock',86,0],['Konyha zárva','elpakoltam a vacsora után','t-stack',68,0],['Szándékkal éltem?','koppints, és válaszolj','t-journal',55,0,0,'reflect'],['Napzárás','a nap lezárása','t-moon',null,0,0,'ritual'],['Wind-down, képernyő le','Napzárás után','t-sleep',43,0]]}};
let face='reggel', nowRow=-1, obsState=0, macroSel=null, fbNo=false, expMsg={}, wkStep=0, wkDone=false;
const MAC=[['Fehérje','var(--protein)',148,220],['Szénhidrát','var(--carb)',224,380],['Zsír','var(--fat)',58,95]];

/* ── KÍMÉLŐ MÓD (kihagyás S2) ── */
const KMC=[['ILLNESS','t-ill','Beteg vagyok'],['STOMACH','t-digestion','Gyomorrontás'],['INJURY','t-pain','Sérülés / fájdalom'],['TRAVEL','t-travel','Úton vagyok']];
const KMD=[['TODAY','Csak ma',0,'ma'],['FEW','2–3 nap',2,'2–3 nap'],['WEEK','Kb. egy hét',6,'kb. egy hét'],['UNKNOWN','Nem tudom',null,'nincs']];
const KM={on:false,cat:null,dur:null,day:1,later:false,ask:false,pick:{cat:null,dur:null},applied:null,prev:null};
const kmCat=()=>KMC.find(c=>c[0]===KM.cat)||KMC[0], kmDur=()=>KMD.find(d=>d[0]===KM.dur)||KMD[3];
const kmExpired=()=>{const o=kmDur()[2];return o!=null&&KM.day-1>o};
function kmPreset(id){ if(id===KM.applied)return; KM.applied=id;
  if(id==='kimelo')Object.assign(KM,{on:true,cat:'ILLNESS',dur:'FEW',day:2,later:false,ask:false});
  if(id==='kimelo-lejart')Object.assign(KM,{on:true,cat:'STOMACH',dur:'FEW',day:4,later:false,ask:false}); }
function kmSlot(i){
  if(!KM.on)return `<div class="kmentry rise" style="--i:${i}"><button class="lk" data-sheet="kimelo">${T('t-heart')}Nem vagyok jól ›</button></div>`;
  const c=kmCat(),d=kmDur();
  if(KM.later)return `<section class="open rise" style="--i:${i}"><div class="ln" style="border-top:0;padding:4px 0">${T(c[1])}<span class="g">Kímélő mód · ${KM.day}. nap<small>Holnap reggel újra rákérdezek, hogy vagy.</small></span><button class="lk" data-kmbetter>Befejezem ›</button></div></section>`;
  const sub=kmExpired()?'A becsült idő letelt — hogy vagy?':`Kímélő mód · ${KM.day}. nap · becslés: ${d[3]}`;
  return `<section class="card hg rise" style="--i:${i};--c:var(--warn)"><span class="eb">Kímélő mód · ${c[2]}</span>
    <div class="hero-cs" style="gap:12px;margin-top:6px">${T(c[1],'kmart')}<span style="flex:1"><p class="verdict" style="font-size:19px;margin:0 0 2px">Hogy vagy?</p><p class="txt sub">${sub}</p></span></div>
    ${KM.ask?`<p class="txt" style="margin-top:10px">Töröljem a kímélő módot?<br><span class="txt sub">A kihagyott edzések visszaállnak, mintha be se kapcsoltad volna.</span></p><div class="act"><button class="btn sm" style="background:var(--bad);color:#fff" data-kmdel>Törlöm</button><button class="lk" data-kmask="0">Mégse</button></div>`
    :`<div class="act"><button class="btn sm" data-kmbetter>Jobban</button><button class="lk" data-kmlater>Még nem</button><button class="lk" data-kmask="1">Tévedés volt</button></div>`}
  </section>`;
}
function kmSheet(){const p=KM.pick,c=KMC.find(x=>x[0]===p.cat);
  return `${sheetH('Kímélő mód','Mi történt?','Szólj, és a napod hozzád igazodik. Nem kell magyarázkodnod.')}
  <div class="opt4">${KMC.map(([id,ic,l])=>`<button class="${p.cat===id?'on':''}" data-kmcat="${id}">${T(ic)}<span>${l}</span></button>`).join('')}</div>
  ${c?`<span class="eb" style="margin-top:14px">Meddig tarthat?</span><div class="chips2">${KMD.map(([id,l])=>`<button class="${p.dur===id?'on':''}" data-kmdur="${id}">${l}</button>`).join('')}</div>`:''}
  <p class="txt sub" style="margin-top:14px"><b>Amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.</b> Bármikor befejezheted.</p>
  <button class="btn wide" style="margin-top:14px;${c?'':'opacity:.4'}" data-kmon ${c?'':'disabled'}>Kímélő mód bekapcsolása</button>`}
function kmWelcome(){const d=Math.max(1,KM.day-1),few=d<=2;
  return `${sheetH('Kímélő mód vége','Üdv újra!','Jó, hogy jobban vagy. Így folytatjuk:')}
  <div class="ln">${T('t-calendar')}<span class="g txt">${few?`<b>${d} nap kiesés</b> · a programod nem csúszik, onnan folytatod, ahol abbahagytad.`:`<b>${d} nap kiesés</b> · onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz.`}</span></div>
  <div class="ln">${T('t-dumbbell')}<span class="g txt">${few?'<b>Az első edzés könnyített:</b> harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.':'<b>Az első 2 edzés könnyített:</b> harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly.'}</span></div>
  <button class="btn wide" style="margin-top:14px" data-kmok>Rendben</button><button class="lk" style="display:block;margin:12px auto 0" data-kmundo>Mégsem vagyok jól</button>`}

/* ── MAI ── */
function obsCard(i,hub,o){
  o=o||{eb:'Megfigyelés',who:'mezo',x:'Amikor <b>Anna</b> szerepel a hála-naplódban, másnap átlag <b>40 perccel többet</b> alszol.',q:'Négy nap adata, még kevés. Figyeljem tovább?',ev:['4 hála-bejegyzés','4 éjszaka','+1 nap eltolás'],acts:['Igen, figyeld','Nem stimmel','Mesélj erről']};
  return `<section class="open rise" style="--i:${i}"><div class="sec" style="padding:0 0 6px"><span class="eb">${o.eb}</span>${hub?`<button class="lk" data-go="uzenetek.eszrevetelek">Összes észrevétel ›</button>`:''}</div>
    ${sender(o.who,'',26)}
    <p class="txt" style="margin-top:8px">${o.x}${o.q?` ${o.q}`:''}</p>
    <details class="ev"><summary class="lk">Miből látom? ›</summary><p class="fn">${o.ev.join(' · ')}</p></details>
    ${hub&&obsState?`<div class="act"><span class="txt sub">${I('i-check')} Megjegyeztem a válaszod.</span><button class="lk" data-toast="Mezo · Chat — előtöltve">Beszéljünk róla ›</button></div>`
    :`<div class="act"><button class="btn sm" ${hub?'data-obs':'data-toast="Megjegyeztem a válaszod."'}>${o.acts[0]}</button>${o.acts.slice(1).map(a=>`<button class="lk" ${hub?'data-obs':'data-toast="Megjegyeztem a válaszod."'}>${a}</button>`).join('')}</div>`}
  </section>`;
}
function fuelSec(i){const m=macroSel!=null?MAC[macroSel]:null;
  return `<section class="open rise" style="--i:${i}"><span class="eb">Üzemanyag · a hét</span>
    <div class="big"><span class="num">${m?m[2]+' g':'2 060'}</span><span class="v">${m?`${m[0]} · ${m[3]-m[2]} g a ${m[3]} g célig`:'/ 3 100 kcal ma · 1 040 van még'}</span></div>
    ${wkBars()}
    <p class="fn" style="margin-top:4px">Egy oszlop egy nap, a három szín a három makró. Ha a nap célja megvan, az oszlop elhallgat: szürke lesz. A szaggatott vonal a napi keret.</p>
    <div style="height:6px"></div>
    ${MAC.map(([n,c,g,goal],k)=>`<div class="ln tap ${macroSel===k?'sel':''}" data-mac="${k}" role="button" aria-pressed="${macroSel===k}"><span class="g">${n}</span><span class="v"><b>${g}</b> / ${goal} g</span><div class="bar" style="--c:${c}"><b style="--w:${Math.round(g/goal*100)}%"></b></div></div>`).join('')}
    ${m?`<button class="lk" data-core style="margin-top:8px">Vissza az összképhez</button>`:''}
    <div class="ln" style="margin-top:4px"><span class="g txt sub">Fuel · ma</span><button class="lk" data-toast="Fuel · Mai">Megnyitom ›</button></div>
  </section>`;}
function ndCloseCard(i){
  if(ND.ritual)return `<section class="open rise" style="--i:${i}"><div class="ln" style="border-top:0;padding:4px 0">${T('t-moon')}<span class="g">Letetted a napot<small>Hajnalban megírom, milyen napod volt.</small></span><button class="lk" data-go="nap.2026-09-24">A napom ›</button></div></section>`;
  const d=ndTodayDims();
  return `<section class="card hg rise" style="--i:${i}"><span class="eb">Este · napzárás</span>
    <div class="hero-cs" style="gap:12px;margin-top:6px">${T('t-moon','kmart')}<span style="flex:1"><p class="verdict" style="font-size:19px;margin:0 0 2px">Tegyük le a napot.</p><p class="txt sub">Amit megőriznél, és amit elengednél. Kb. 3 perc.</p></span></div>
    <p class="fn" style="margin-top:8px">${ndHu(NDT.kcal)} kcal · ${KM.on?'edzés · kímélő mód':`edzés ${NDT.work}/${NDT.workG}`} · check-in ${NDT.ck}/${NDT.ckG} · ${ndDoneCount(d)}/6 terület kész</p>
    <div class="act"><button class="btn sm" data-ndritual data-go="napzaras.1">Napzárás indítása ›</button></div>
  </section>`;
}
function mai(arg,evening){
  kmPreset(arg);
  const ok=!KM.on;
  return page(`
  <div class="sec rise" style="padding-bottom:4px"><span class="eb">Szerda · október 7.</span><span class="eb">4 / 7 jel</span></div>
  <section class="card hg hero-n rise" style="--i:1;${ok?'':'--c:var(--warn)'}">${csepp(ok?'ok':'warn',57,{s:128,val:72,label:'MA'})}
    <div style="flex:1;min-width:0"><p class="verdict">${ok?'Ma jó nap egy közepes edzéshez.':'Ma a pihenés a dolgod.'}</p>
      <p class="txt sub">${ok?'Nyugodt ébredés, 7 ó 40 p alvás. Két check-in még hátravan.':'Kímélő mód: az edzés magától kimarad, nem számít mulasztásnak.'}</p></div>
  </section>
  ${kmSlot(1)}
  ${evening?ndCloseCard(1):''}
  <div class="qrow rise" style="--i:2"><button data-sheet="checkin">${I('i-pulse')}Check-in</button><button data-go="gyors">${I('i-plus')}Logolás</button><button data-sheet="naplopick">${I('i-pen')}Napló</button><button class="more" data-sheet="tobb">Több ›</button></div>
  ${fuelSec(3)}
  <section class="open rise" style="--i:4;padding-top:12px;padding-bottom:12px"><div class="ln tap" style="border-top:0;padding:4px 0" data-go="uzenetek">${I('i-cal')}<span class="g">Heti egyeztetés<span class="dot"></span><small>vasárnap · 1 javaslat vár · 3 lépés, kb. 2 perc</small></span>${I('i-chev','chev')}</div>
    <div class="ln tap" style="padding:8px 0 4px" data-go="eletjel">${T('t-heart')}<span class="g">Életjelek<small>hat jel · átlag 60 · a mozgás kér figyelmet</small></span><span class="v"><b>60</b></span>${I('i-chev','chev')}</div></section>
  ${obsCard(4,true)}
  <section class="open rise" style="--i:5"><span class="eb">Mai pillanatok</span>
    <div class="ln tap" data-toast="Fuel · Mai"><time>13:00</time>${I('i-bowl')}<span class="g">Csirke · édesburgonya · spenót<small>Étkezés</small></span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-go="checkin"><time>10:00</time>${I('i-pulse')}<span class="g">Most csak ennyi · az alap megvan<small>Check-in · délelőtt</small></span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-toast="Fuel · Mai"><time>09:15</time>${I('i-bowl')}<span class="g">Túrós zabkása · áfonyával<small>Étkezés</small></span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-go="checkin"><time>07:10</time>${I('i-pulse')}<span class="g">Nyugodt ébredés · pihenve<small>Check-in · reggel</small></span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-toast="Fuel · Mai"><time>23:35</time>${I('i-bowl')}<span class="g">Lazac · barna rizs · brokkoli<small>Étkezés · tegnap</small></span>${I('i-chev','chev')}</div>
  </section>
  `,'nap','mai');
}
const maieste=()=>mai('',true);

/* ── CHECK-IN (áttekintés) ── */
function checkin(){
  const done=SLOTS.filter(s=>s.st==='done').length, nQ=t=>ckSteps(t).length;
  const cells=s=>{const ids=ckSteps(s.t).filter((id,i,arr)=>arr.indexOf(id)===i&&id in s.a&&s.a[id]!==null);
    return `<div class="cells">${ids.map(id=>`<span><b>${ckDisp(id,s.a,1)}</b><small>${ITEMS[id].s}</small></span>`).join('')}</div>`};
  return page(`${back('Mai','mai')}
  <div class="p16 rise" style="--i:1"><span class="eb">Check-in</span><div class="big"><span class="num">${done}</span><span class="v">/ 4 pillanatkép a napodról</span></div><p class="verdict" style="margin-top:6px">A délutáni most esedékes. Fél perc.</p></div>
  <section class="open rise" style="--i:2">${SLOTS.map(s=>s.st==='done'
    ?`<div class="ln" style="align-items:flex-start">${I('i-check','tk')}<span class="g">${s.n} · ${s.t}${s.note?`<small>${s.note}</small>`:''}${s.quick?`<small>Most csak ennyi · az alap megvan</small>`:''}${cells(s)}</span></div>`
    :s.st==='now'||(s.st==='pending'&&!SLOTS.some(x=>x.st==='now'))
    ?`<div class="ln">${T('t-checkin')}<span class="g">${s.n} · ${s.st==='now'?'most esedékes':s.t}<small>hogy vagy most? · ${nQ(s.t)} koppintás, kb. fél perc</small></span><button class="btn sm" data-ckslot="${s.t}">Kitöltöm</button></div>`
    :`<div class="ln" style="opacity:.6"><span class="dash"></span><span class="g">${s.n} · ${s.t} körül<small>később esedékes · ${nQ(s.t)} kérdés</small></span></div>`).join('')}
  </section>
  <section class="open rise" style="--i:3">
    <div class="ln tap" data-go="hatasok">${T('t-orb')}<span class="g">Mit táplál az új check-in?<small>ahol a válaszaidat észre fogod venni</small></span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-go="napom">${T('t-day')}<span class="g">A napod · Te: 7/10<small>a te ítéleted az app pontszáma mellett</small></span>${I('i-chev','chev')}</div>
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Csak a mintában · próbáld ki bármelyik napszakot</span><div class="chips2">${Object.keys(PLAN).map(t=>`<button data-ckslot="${t}">${SLOTN[t]} · ${nQ(t)}</button>`).join('')}</div>
    <p class="fn">A kimaradt slot nem vész el — pótold bármikor.</p></section>`,'nap','mai');
}
/* a check-in lap (lépésenként) */
function ckSheet(){const S=ckSteps(),s=ck.step,slot=ck.slot,sn=SLOTN[slot],a=ck.a;
  const prog=`<div class="steps" style="grid-template-columns:repeat(${S.length+1},1fr)">${S.concat(['_']).map((id,i)=>`<i class="${i<=s?'on':''}"></i>`).join('')}</div>`;
  const head=sheetH(`Check-in · ${sn} · ${slot}`,'Hogy vagy?');
  if(s<S.length){const id=S[s],it=ITEMS[id],isAd=s===S.length-1;
    const lbl=`<span class="eb" style="margin-top:10px">${pad2(s+1)} / ${pad2(S.length)} · ${it.n}${s<5?' · alap':isAd?' · a nap kérdése':' · '+sn}</span>`;
    const adv=isAd?`<p class="txt sub" style="margin-top:6px">${ADAPT[slot].why}</p>`:'';
    let body;
    if(it.kind==='pain'){const p=a.pain;
      const SIL='M52 4C60 4 65 10 65 18S60 32 52 32 39 26 39 18 44 4 52 4ZM44 34H60L78 44C82 46 84 50 84 54L88 108C88 112 84 114 81 112L76 60 70 62 70 110 64 190H54L52 128 50 190H40L34 110 34 62 28 60 23 112C20 114 16 112 16 108L20 54C20 50 22 46 26 44Z';
      const fig=(title,R)=>`<figure><svg viewBox="0 0 104 196"><path class="sil" d="${SIL}"/>${R.map(([r,x,y])=>`<circle class="${p&&p.regions.includes(r)?'on':''}" cx="${x}" cy="${y}" r="6.5" data-ckreg="${r}"><title>${r}</title></circle>`).join('')}</svg><figcaption class="eb">${title}</figcaption></figure>`;
      body=`<div class="two" style="margin-top:12px"><button class="btn ${p===false?'':'ghost'}" data-ckpain="no">Nem</button><button class="btn ${p&&p!==false?'':'ghost'}" data-ckpain="yes">Igen</button></div>`+
        (p&&p!==false?`<span class="eb" style="margin-top:14px">Hol fáj? · többet is választhatsz</span><div class="fig">${fig('Elöl',REG_F)}${fig('Hátul',REG_B)}</div>
        <div class="chips2">${[...REG_F,...REG_B].map(r=>r[0]).concat(['Egyéb']).map(r=>`<button class="${p.regions.includes(r)?'on':''}" data-ckreg="${r}">${r}</button>`).join('')}</div>
        <span class="eb" style="margin-top:14px">Mennyire fáj · ${p.int?p.int+' / 10':'koppints'}</span>${scale(p.int||0,'var(--acc)')}<div class="sl"><span>Alig</span><span>Nagyon</span></div>
        <button class="btn wide" style="margin-top:12px;${p.regions.length&&p.int?'':'opacity:.4'}" data-ckstep="${s+1}" ${p.regions.length&&p.int?'':'disabled'}>Tovább ›</button>`:'');
    }else{const cv=it.kind==='craving'?(a.craving?a.craving.v:null):a[id];
      body=`<div class="big" style="margin-top:10px">${T(it.ic)}<span class="num">${cv||'–'}</span><span class="v">/ 10</span></div>${scale(cv||0)}<div class="sl"><span>${it.lo}</span><span>${it.hi}</span></div>`;
      if(it.kind==='craving'&&cv>=4){const k=a.craving.kinds;
        body+=`<span class="eb" style="margin-top:14px">Mit kívánsz?</span><div class="chips2">${KINDS.map(x=>`<button class="${k.includes(x)?'on':''}" data-ckkind="${x}">${x}</button>`).join('')}</div><button class="btn wide" style="margin-top:12px" data-ckstep="${s+1}">Tovább ›</button>`}}
    const coremsg=s===5?`<p class="fn">${I('i-check')} Az alap megvan. Innen bármikor kiléphetsz.</p>`:'';
    return `${head}${prog}${lbl}${adv}<p class="txt" style="font-size:17px;margin-top:6px">${it.q}</p>${body}${coremsg}
    <div class="act" style="justify-content:space-between">${s?`<button class="lk" data-ckstep="${s-1}">‹ Vissza</button>`:'<span></span>'}${s>=5?'<button class="lk" data-ckquick>Most csak ennyi</button>':''}<button class="lk" data-ckskip>Kihagyom ›</button></div>`}
  return `${head}${prog}<span class="eb" style="margin-top:10px">Megvan · összegzés</span><h2 class="t" style="margin:4px 0 10px">Bármi még, amit szeretnél?</h2>
    ${ck.quick?`<p class="txt sub">Most csak ennyi: az alap megvan. A többi kérdés üres marad — a check-in így is beszámít.</p>`:''}
    <div class="sum">${S.map((id,i)=>{const it=ITEMS[id],d=ckDisp(id,a);return `<button class="ln tap" data-ckstep="${i}">${T(it.ic)}<span class="g">${it.n}${i===S.length-1?' · a nap kérdése':''}</span><span class="v"><b>${d===null?'üres':d==='—'?'kihagyva':d}</b></span></button>`}).join('')}</div>
    ${field('Gondolatok · opcionális',VF('pl. „tegnap röpi után még izomláz”','Tegnap röpi után még izomlázam van, és délután nehéz meeting jön.',{rows:3}))}
    <button class="btn wide" style="margin-top:14px" data-cksave>Mentés · ${slot}</button>`;
}

/* ── MIT TÁPLÁL AZ ÚJ CHECK-IN ── */
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
  return page(`${back('Check-in','checkin')}
  <div class="p16 rise" style="--i:1"><span class="eb">Check-in 2.0 · minta</span><h1 class="t">Mit táplál az új check-in?</h1><p class="txt sub" style="margin-top:6px">Mind a ${C.length} terület, példákkal: itt veszed majd észre a válaszaidat.</p></div>
  ${C.map(([who,eb,sub,say,from,act,link],i)=>`<section class="open rise" style="--i:${Math.min(i+2,8)}"><span class="eb">${pad2(i+1)} · ${eb}</span>${sender(who,sub,26)}
    ${say.map(x=>`<p class="txt" style="margin-top:8px">${x}</p>`).join('')}<p class="fn">Miből: ${from.join(' · ')}</p>
    ${act?`<div class="act"><button class="btn sm" data-toast="Rendben — a mintában itt megáll.">${act}</button></div>`:''}${link?`<div class="act"><button class="lk" data-go="${link}">Megnézem ›</button></div>`:''}</section>`).join('')}
  <p class="fn p16" style="padding:0 16px 10px">Üres válasz sehol nem számít — amit kihagysz, azt semmi nem veszi „közepesnek”.</p>`,'nap','mai');
}

/* ── ÉLETJELEK ── */
function eletjel(){
  const avg=Math.round(NEEDS.reduce((a,n)=>a+n[2],0)/NEEDS.length);
  const attr=a=>a==='water'?'data-toast="+250 ml víz — rögzítve"':a==='sleep'?'data-sheet="sleep"':a==='checkin'?'data-sheet="checkin"':a==='meal'?'data-toast="Fuel · Logolás"':a==='train'?'data-toast="Edzés · Mai"':'';
  return page(`${back('Mai','mai')}
  <div class="p16 rise" style="--i:1"><span class="eb">Életjelek</span><div class="big"><span class="num">${avg}</span><span class="v">a hat jel átlaga</span></div><p class="verdict" style="margin-top:6px">Egy jel kér figyelmet: a mozgás.</p></div>
  <section class="open rise" style="--i:2">${NEEDS.map(([l,ic,p,a])=>{const warn=p<40;return `<div class="ln ${a?'tap':''}" ${attr(a)}>${T(ic)}<span class="g">${l}<small>${a==='water'?'koppintás: +250 ml':a==='sleep'?'koppintás: alvás rögzítése':a==='checkin'?'koppintás: a következő check-in':a==='meal'?'koppintás: étkezés logolása':a==='train'?'koppintás: Edzés':'magától töltődik a rutinból'}</small></span><span class="v"><b>${p}</b></span><div class="bar ${warn?'':'q'}" ${warn?'style="--c:var(--warn)"':''}><b style="--w:${p}%"></b></div></div>`}).join('')}
  <p class="fn">A sáv szürke, ha a jel rendben van; színt csak az kap, ami figyelmet kér. Koppints egy jelre a logolásához.</p></section>`,'nap','mai');
}

/* ── KÜLDETÉSEK ── */
function kuldetesek(arg){const empty=arg==='ures', done=QUESTS.filter(q=>q.st==='done').length;
  return page(`${back('Mai','mai')}
  <div class="p16 rise" style="--i:1"><span class="eb">Napi küldetések</span>${empty?`<h1 class="t">Ma nincs kisorsolt küldetés.</h1>`:`<div class="big"><span class="num">${done}</span><span class="v">/ ${QUESTS.length} ajánlat a mai napra</span></div>`}</div>
  ${empty?'':`<section class="open rise" style="--i:2">${QUESTS.map((q,i)=>`<div class="ln" style="align-items:flex-start">${T(q.ic)}<span class="g">${q.t}${q.why?`<small>${q.why}</small>`:''}<small>${q.st==='done'?`kész · +${q.xp} XP jóváírva`:q.foot}</small>
    ${q.st==='done'?'':`<span class="act" style="margin-top:8px">${q.cta?`<button class="btn sm" data-toast="Edzés · Mai">${q.cta}</button>`:''}${rerolls?`<button class="lk" data-reroll="${i}">Csere · ${rerolls} maradt</button>`:''}</span>`}</span><span class="v">+${q.xp} XP</span></div>`).join('')}</section>`}
  <p class="fn p16" style="padding:0 16px">A küldetés ajánlat: ha kimarad, csendben lejár — bukás nincs. A Csere naponta egyszer ingyenes.</p>`,'nap','mai');
}

/* ── RUTIN ── */
function rutin(arg){ if(arg&&RUTIN[arg])face=arg;
  const R=RUTIN[face], done=R.rows.filter(r=>r[4]).length, strs=R.rows.filter(r=>r[3]!=null);
  const avg=Math.round(strs.reduce((a,r)=>a+r[3],0)/strs.length);
  return page(`
  <div class="sec rise"><button class="lk" data-toast="Tegnap — csak a kézi, kimaradt elemek pipálhatók">‹ Tegnap</button><span class="eb">Ma</span><span class="lk" style="opacity:.3">Holnap ›</span></div>
  <div class="p16 rise" style="--i:1">${segs([['reggel','Reggel'],['napkozben','Napközben'],['este','Este']],face,'data-face')}</div>
  <div class="p16 rise" style="--i:2;margin-top:12px"><div class="big"><span class="num">${done}</span><span class="v">/ ${R.rows.length} · ${R.title}</span></div>
    <p class="txt sub" style="margin-top:6px">${R.stat[0]} ${R.stat[1]} · a 28 napból ${Math.round(avg/100*28)} napon ment végig · +${R.xp} XP ma</p>
    ${grid28(face==='este'?3:1)}<p class="fn" style="margin-top:4px">Az utolsó 28 nap. Egy kihagyás nem nulláz, csak egy üres kocka.</p></div>
  <section class="open rise" style="--i:3">${R.rows.map(([n,s,ic,str,dn,link,act],i)=>`<div class="ln ${dn?'done':''} ${nowRow===i&&!dn?'now':''}">
    <button class="tk ${dn?'on':''}" aria-label="${n}" ${act==='reflect'?'data-sheet="reflect"':act==='ritual'?'data-go="napzaras.1"':`data-tick="${i}"`}>${I('i-check')}</button>${T(ic)}
    <span class="g">${nowRow===i&&!dn?'<span class="eb" style="color:var(--acc)">Most jön</span>':''}${link?`<button class="lk" data-toast="Megnyitom a videót">${n}</button>`:n}<small>${s}</small></span>${str!=null?`<span class="v"><b>${str}</b>%</span>`:''}</div>`).join('')}
  </section>
  <section class="open rise" style="--i:4"><div class="ln tap" style="border-top:0" data-go="rutin-epites">${T('t-chain')}<span class="g">Rutinok szerkesztése<small>láncok, szokások, új szokás</small></span>${I('i-chev','chev')}</div></section>`,'nap','rutin');
}

/* ── BESZÉLGETÉS (Mezo · ma) ── */
function uzenetek(tab){ tab=tab||'uzenetek';
  const TABS=[['uzenetek','Üzenetek',1],['eletjelek','Életjelek',1],['eszrevetelek','Észrevételek',0]];
  const WK=[['Miért most?','Vasárnap van, és egy hét adata gyűlt össze: 5 edzés, 19 étkezés, 24 check-in.'],['Mi történt?','A fehérje átlag 162 g lett a 220 g-os célból. Az alvás 7 ó 10 p átlag, kedd és szerda rövid.'],['Javaslat','A fehérjecél 200 g-ra igazítása: reálisabb, és a testsúly-trend így is tartja az irányt.']];
  let body='';
  if(tab==='uzenetek') body=`
    <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 6px"><span class="eb">Heti egyeztetés<span class="dot"></span></span><span class="eb">${wkDone?'kész':`${Math.min(wkStep+1,3)} / 3`}</span></div>
      ${wkDone?`<p class="txt sub">Elfogadtad a javaslatot: a fehérjecél 200 g. Jövő vasárnap újra.</p>`
      :`<div class="steps" style="grid-template-columns:repeat(3,1fr)">${WK.map((_,i)=>`<i class="${i<=wkStep?'on':''}"></i>`).join('')}</div>
      <p class="txt" style="margin-top:8px"><b>${WK[wkStep][0]}</b> ${WK[wkStep][1]}</p>
      <div class="act">${wkStep<2?`<button class="btn sm" data-wk="next">Tovább</button><button class="lk" data-wk="skip">Ezt kihagyom</button>`:`<button class="btn sm" data-wk="accept">Elfogadom</button><button class="lk" data-wk="skip">Marad a 220 g</button>`}</div>`}
    </section>
    <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 8px">${sender('mezo','06:30 · reggeli briefing')}</div>
      <p class="txt">Jó reggelt — Week 3, Day 4, és érzed a tempót. Tegnap Push Day-en a Lat Pulldown 105 kg × 9 ment RIR 1-re, ma a hátad pihen.</p>
      <p class="txt" style="margin-top:8px">Az alvásod 7,4 óra volt, a reggeli check-in nyugodt. Ma délben érdemes a fehérjét előrehozni.</p>
      <p class="fn">Amire épült: Push Day · tegnap · Chest Row 105,8 · márc 4 · késő szénhidrát ↔ alvás</p>
      <p class="fn" style="margin-top:4px">Miből gondolom: 7,4 óra alvás, 2 ébredés · reggeli check-in: energia 7/10</p>
      <div class="act"><span class="txt sub">Segített?</span><button class="lk" data-toast="Köszönöm — ezt megjegyzem">Segített</button><button class="lk" data-fbno>Nem talált</button></div>
      ${fbNo?`<div class="chips2">${['pontatlan','túl sok','rossz időzítés','nem rólam szól'].map(r=>`<button data-toast="Köszönöm, finomítok">${r}</button>`).join('')}</div>`:''}
    </section>
    <section class="open rise" style="--i:4">${[['szunya','Tegnap 21:48 · esti visszanézés','Szép nap volt: 3 szokás, 2 check-in és egy erős edzés.'],['mocor','Tegnap 14:10 · délutáni jelzés','Alacsony az energiád — egy rövid séta többet ad, mint a harmadik kávé.']].map(([w,h,p],i)=>`<div class="ln tap" style="align-items:flex-start" data-exp="${i}">${sender(w,h,26)}${expMsg[i]?'':I('i-chev','chev')}</div>${expMsg[i]?`<p class="txt" style="margin:-4px 0 10px 38px">${p}</p>`:''}`).join('')}
      <div class="ln tap" data-toast="Mezo · Chat">${I('i-chat')}<span class="g">Beszélgess Mezóval</span>${I('i-chev','chev')}</div></section>`;
  if(tab==='eletjelek') body=`
    <section class="open rise" style="--i:2"><div class="ejs tap" data-go="eletjel" role="button">${NEEDS.map(([l,ic,p])=>`<span class="${p<40?'warn':''}">${T(ic)}<b>${p}</b><small>${l}</small></span>`).join('')}</div><p class="fn">Koppints a részletekért. A mozgás az egyetlen, ami figyelmet kér.</p></section>
    <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 8px">${sender('mocor','Mozgás · 34')}</div><p class="txt">Ma még alig mozdultál. Egy 10 perces séta ebéd után elég, hogy a jel megmozduljon. Nem kell edzés.</p><div class="act"><button class="btn sm" data-toast="Edzés · Mai">Megnézem</button></div></section>`;
  if(tab==='eszrevetelek') body=`${obsCard(2,false)}
    ${obsCard(3,false,{eb:'Figyelem',who:'mezo',x:'Amikor 21:00 után eszel, az alvásod minősége átlag <b>1,2 ponttal</b> alacsonyabb.',q:'',ev:['6 késői vacsora','6 éjszaka'],acts:['Így van','Kivétel volt']})}
    <p class="fn p16 rise" style="--i:4;padding:0 16px">Ma még 2 észrevétel fér a keretbe · 22:00 után csendben maradok.</p>`;
  return page(`
  <div class="p16 rise" style="padding-top:12px"><span class="eb">Beszélgetés</span><h1 class="t">Mezo · ma</h1><p class="txt sub" style="margin-top:4px">4 üzenet · a napod fonala</p></div>
  <div class="p16 rise" style="--i:1;margin-top:10px">${segs(TABS,tab,'data-tab')}</div>${body}`,'nap','uzenetek');
}

/* ── GYORS LOGOLÁS ── */
const QT=[['Étkezés','t-bowl','data-toast="Fuel · Logolás"'],['Víz','t-water','data-sheet="water"'],['Stack','t-supps','data-toast="Fuel · Kiegészítők"'],['Edzés','t-dumbbell','data-toast="Edzés · Mai"'],['Sport','t-volley','data-sheet="sport"'],['Súly','t-weight','data-sheet="weight"'],['Check-in','t-checkin','data-sheet="checkin"'],['Napló','t-journal','data-sheet="naplopick"'],['Alvás','t-sleep','data-sheet="sleep"']];
const qsurface=()=>`<div class="ln tap" data-toast="Mezo · Chat">${csepp('ok',60,{s:30,form:'crystal',color:TEAM.mezo[2],alive:false})}<span class="g">Mondd el Mezónak<small>kérdezz, mesélj — vagy logolj szóban</small></span>${I('i-chev','chev')}</div>
  <div class="qgrid">${QT.map(([l,ic,act])=>`<button ${act}>${T(ic)}<span>${l}</span></button>`).join('')}</div>`;
function gyors(){return page(`${back('Mai','mai')}<div class="p16 rise" style="--i:1"><h1 class="t">Mi érkezett?</h1><p class="txt sub" style="margin-top:4px">Egy pillanat. És a napod része.</p></div><section class="open rise" style="--i:2">${qsurface()}</section>`,'nap','mai')}

/* ── NAPZÁRÁS (6 felvonás) ── */
function napzaras(arg){const a=Math.min(6,Math.max(1,+arg||1));
  const next=(l='Tovább')=>`<button class="btn wide" style="margin-top:16px" data-go="napzaras.${a+1}">${l}</button>`;
  const acts={
    1:`<div class="p16 ctr" style="text-align:center;padding-top:40px">${T('t-moon','zart')}<h1 class="t" style="margin-top:16px">A nap véget ért.</h1><p class="txt sub" style="margin-top:6px">Zárjuk le együtt.</p>${next('Kezdjük')}</div>`,
    2:`<div class="p16"><span class="eb">A napod íve</span><h2 class="t" style="margin-top:4px">Így telt a mai nap</h2>
      <svg class="arc" viewBox="0 0 320 120"><path d="M10 110 Q160 -30 310 110" fill="none" stroke="var(--hair)" stroke-width="2"/><path d="M10 110 Q160 -30 310 110" fill="none" stroke="var(--acc)" stroke-width="2" stroke-dasharray="300 999"/>${[[38,72],[104,30],[172,22]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5" fill="var(--acc)"/>`).join('')}<circle cx="250" cy="44" r="5" fill="none" stroke="var(--faint)" stroke-dasharray="3 3"/><text x="10" y="118" fill="var(--faint)" font-size="10" font-family="var(--mono)">reggel</text><text x="282" y="118" fill="var(--faint)" font-size="10" font-family="var(--mono)">este</text></svg></div>
      <section class="open">${[['t-dumbbell','Push Day','kész'],['t-bowl','3 étkezés','112 g fehérje'],['t-sleep','Alvás','7,4 óra'],['t-checkin','Check-in','3 / 4']].map(([ic,l,m])=>`<div class="ln">${T(ic)}<span class="g">${l}</span><span class="v"><b>${m}</b></span></div>`).join('')}<div class="p16" style="padding:0">${next()}</div></section>`,
    3:`<div class="p16"><span class="eb">Ma milyen volt</span><h2 class="t" style="margin-top:4px">Milyen volt a napod valójában?</h2>
      <p class="txt sub" style="margin-top:8px">Az esti check-inben <b>7/10</b>-re értékelted a napot. Ide már csak a szavaid kellenek.</p>
      <div style="margin-top:12px">${VF('Írd le, ahogy volt — senki más nem olvassa…','Ma nyugodtabb voltam, mint tegnap, a délutáni séta sokat segített.',{rows:3})}</div>
      <span class="eb" style="margin-top:16px">Amiért hálás vagy · legfeljebb 3, opcionális</span>
      ${[['1. dolog, amiért hálás vagy…','A reggeli kávé a teraszon.'],['2. dolog…','Anyával beszéltem telefonon.'],['3. dolog…','Végre jól aludtam.']].map(([p,s])=>VF(p,s,{rows:1})).join('')}
      ${next()}<button class="lk" style="display:block;margin:12px auto 0" data-go="napzaras.4">Ma nem írok</button></div>`,
    4:`<div class="p16"><span class="eb">Nyitott hurkok</span><h2 class="t" style="margin-top:4px">Zárd le, ami még nyitva</h2><p class="txt sub" style="margin-top:4px">— aztán elengedheted.</p></div>
      <section class="open"><div class="ln">${T('t-checkin')}<span class="g">20:00 check-in kimaradt<small>3 / 4 check-in kész</small></span><button class="btn sm" data-sheet="checkin">Koppints</button></div>
      <div class="ln" style="flex-wrap:wrap">${T('t-ring')}<span class="g">Szándékkal élted a napot?<small>a mai szándékod: „nyugodt tempó”</small></span><span class="chips2" style="margin:0;flex-basis:100%;padding-left:38px">${['Igen','Részben','Nem'].map(x=>`<button data-toast="A mai szándékodra reflektáltál.">${x}</button>`).join('')}</span></div>
      <div class="ln">${T('t-journal')}<span class="g">Történt még valami ma?<small>egy apró lépés is számít</small></span><button class="lk" data-sheet="activity">Napló</button></div>${next()}</section>`,
    5:`<div class="p16 ctr" style="text-align:center;padding-top:16px">${T('t-harvest','zart')}<span class="eb" style="margin-top:8px">A mai termés</span><div class="big" style="justify-content:center"><span class="num">+185</span><span class="v">XP ma</span></div></div>
      <section class="open">${[['t-quest','Küldetések',40],['t-chain','Rutin',25],['t-journal','Napló',15],['t-dumbbell','Edzés',80],['t-volley','Sport',25],['t-coin','Érme',12]].map(([ic,l,v])=>`<div class="ln">${T(ic)}<span class="g">${l}</span><span class="v"><b>+${v}</b></span></div>`).join('')}
      <div class="ln"><span class="g">Tudatosság · Lv 4</span><span class="v"><b>68</b>%</span><div class="bar q"><b style="--w:68%"></b></div></div>
      <p class="fn">A 28 napból 24-en ment végig a rutin · 86 napja használod.</p>${next()}</section>`,
    6:`<div class="p16 ctr" style="text-align:center;padding-top:24px">${csepp('ok',100,{s:96,val:'7/7',label:'KÉSZ',alive:false})}<h1 class="t" style="margin-top:14px">A nap le van zárva.</h1><p class="txt sub" style="margin-top:6px">Elengedheted.</p></div>
      <section class="open"><div class="sec" style="padding:0 0 8px">${sender('mezo','napzárás')}</div><p class="txt">„Ma nem a súlyok voltak nehezek, hanem a délután — és mégis megcsináltad. Aludj rá egyet.”</p></section>
      <section class="open"><span class="eb">Most jön · alvás-előkészítés</span><div class="ln">${T('t-sleep')}<span class="g">Lecsendesítés — képernyők le</span><span class="v"><b>21:45</b></span></div><div class="ln">${T('t-moon')}<span class="g">Villanyoltás</span><span class="v"><b>22:30</b></span></div>
      <button class="btn wide" style="margin-top:16px" data-go="rutin.este">Esti rutin indítása ›</button></section>`};
  return page(`<div class="sec rise"><span class="steps rz">${[1,2,3,4,5,6].map(i=>`<i class="${i<=a?'on':''}"></i>`).join('')}</span><button class="lk" data-go="mai">Kilépés</button></div><div class="rise" style="--i:1">${acts[a]}</div>`,'nap','mai');
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
  if(ND.phase==='evening'&&!ND.ritual)return ['t-moon','Most érdemes · este','Tegyük le a napot','Amit megőriznél, és amit elengednél. Hajnalban megírom, milyen napod volt.','Napzárás'];
  if(!t.work)return ['t-dumbbell','Most érdemes · délután','17:30-ra be van írva az edzés','Utána egy fehérjés vacsora, és a tápanyag is kész.','Edzés'];
  if(t.ck<t.ckG)return ['t-checkin','Most érdemes · este','Egy esti check-in hiányzik','Fél perc. Utána teljes a napod képe.','Check-in'];
  return ['t-moon','Most érdemes · este','Készen állsz a napzárásra','A napzárás innen és az esti rutinból is indul.','Napzárás']}
const NDY={score:87,base:89,corr:-2,label:'A hét legjobb napja',
  dims:{nutrition:[100,'2 962 / 2 782 kcal · fehérje 162 / 166 g'],quality:[79,'nova 71% · mikro 100%'],training:[100,'2/2 edzés'],sleep:[79,'6 óra · minőség Q7'],logging:[85,'check-in 2/4 · étkezések időben'],rhythm:[64,'7/7 nap a héten']},
  weight:{nutrition:30,quality:15,training:20,sleep:15,logging:10,rhythm:10},
  chips:{nutrition:['kcal · 2962 / 2782','fehérje · 162 / 166 g','c · f · 379 g · 80 g','sáv · edzésnapi +150 kcal'],quality:['nova · 71%','mikro · 100%'],training:['edzés · 2 / 2'],sleep:['alvás · 6 h','minőség · Q7'],logging:['check-in · 2 / 4','időben · 100%'],rhythm:['ritmus · 7 / 7']},
  ctx:[['energia','5,5 / 10'],['súlytrend','+0,07 kg / hét'],['alváscél','2 napja elmarad'],['víz','jelölve']],
  prose:['A hét legjobb napja volt. Mindkét edzés megvolt, és a tányér is rendben volt: 2 962 kcal az edzésnapi kerettel együtt, a fehérje pedig csak 4 g-mal maradt el a céltól. A mikrotápanyagok teljesen megvoltak.','Egy dolog lóg ki: két napja nem jön össze az alváscél. Tegnap is csak 6 óra lett, és ez az 5,5-ös energiádon is látszott. Ma este ez a legjobb befektetés.'],
  hl:[['A nap kulcsa','Minden mikrotápanyag megvolt'],['Felismert minta','Egész héten minden nap mozogtál'],['Jó irány','Mindkét edzés megvolt']],
  adj:'Levontam 2 pontot, mert a rövid alvás már második napja ismétlődik, és ez az energiádon is látszott.',
  notes:{nutrition:'180 kcal-lal a keret fölött, de edzésnapon ez belefér. A fehérje szinte pont a célon.',quality:'Jó arány: a nagy része feldolgozatlan étel volt, és a mikrotápanyagok is mind megvoltak.',training:'Mindkét tervezett edzés megvolt.',sleep:'6 óra, jó minőségben, de már második napja rövid. Az energiádon is látszott.',logging:'Az ételeket időben írtad be. A check-inből kettő maradt ki.',rhythm:'A mai nap kiugrott a hét eddigi napjai közül.'}};
const ND_WEEK=[['2026-09-21','H',21,'th',null],['2026-09-22','K',22,'sc',82],['2026-09-23','Sze',23,'sc',87],['2026-09-24','Cs',24,'today',null],['2026-09-25','P',25,'fut'],['2026-09-26','Szo',26,'fut'],['2026-09-27','V',27,'fut']];
const ND_DAYNAME={'2026-09-21':['Hétfő','szept 21'],'2026-09-22':['Kedd','szept 22'],'2026-09-23':['Szerda','szept 23'],'2026-09-24':['Csütörtök','szept 24']};
/* trend-first (MF): a hét napjai pontszámmal, a mai kiemelve */
const ndWeek=sel=>`<div class="wk7 rise" style="--i:1">${ND_WEEK.map(([iso,n,d,st,sc])=>`<button class="${st} ${iso===sel?'on':''}" ${st==='fut'?'data-toast="Még előtted"':`data-go="nap.${iso}"`}><small>${n}</small><b>${d}</b><i>${sc!=null?sc:st==='th'?'·':st==='today'?'élő':''}</i></button>`).join('')}</div>`;
function ndDimsToday(){const d=ndTodayDims();
  return `<section class="open rise" style="--i:3"><span class="eb">Ma eddig · 6 terület</span>${ND_DIM.map(([k,l,ic])=>{const x=d[k];const fine=x.st==='kész';
    return `<div class="ln">${T(ic)}<span class="g">${l}<small>${x.v}</small></span><span class="v"><b>${x.big}</b>${x.unit==='%'?'%':''} · ${x.st}</span><div class="bar ${fine||x.st==='úton'?'q':''}" ${x.st==='nyitva'?'style="--c:var(--warn)"':''}><b style="--w:${Math.max(2,x.pct)}%"></b></div></div>`}).join('')}</section>`}
function ndDimsClosed(){return `<section class="open rise" style="--i:4"><span class="eb">Miből jött össze · koppints a részletekért</span>${ND_DIM.map(([k,l,ic])=>{const [sc,v]=NDY.dims[k],o=ND.open.has(k);
    return `<div class="ln tap" style="flex-wrap:wrap" data-nddim="${k}" role="button" aria-expanded="${o}">${T(ic)}<span class="g">${l} <span class="fn" style="display:inline;margin:0">· súly ${NDY.weight[k]}%</span><small>${v}</small></span><span class="v"><b>${sc}</b></span><div class="bar q"><b style="--w:${sc}%"></b></div>
      ${o?`<p class="txt sub" style="flex-basis:100%;padding-left:38px;margin-top:4px">${NDY.chips[k].join(' · ')}<br>${NDY.notes[k]}</p>`:''}</div>`}).join('')}</section>`}
function ndDayBody(iso){const [dn,dd]=ND_DAYNAME[iso]||['',''];
  if(iso==='2026-09-24'){const d=ndTodayDims(),[lic,leb,lt,ls,lgo]=ndLead();
    return `<section class="card hg hero-n rise" style="--i:2">${csepp('ok',57,{s:112,val:`${ndDoneCount(d)}/6`,label:'TERÜLET'})}
      <div style="flex:1;min-width:0"><span class="eb">${dn} · ${dd} · élő, frissült ${NDT.updated}-kor</span><p class="verdict">${ndReading()}</p><p class="fn" style="margin:0">Napközben nincs pontszám. Hajnali 3-kor zárom a napot, és reggelre megírom, milyen volt.</p></div></section>
    <section class="open rise" style="--i:3"><div class="ln" style="border-top:0;padding:4px 0">${T(lic)}<span class="g"><span class="eb">${leb}</span>${lt}<small>${ls}</small></span><button class="btn sm" ${lgo==='Napzárás'?'data-ndritual data-go="napzaras.1"':`data-toast="${lgo} megnyitása"`}>${lgo} ›</button></div></section>
    ${ndDimsToday()}
    <section class="open rise" style="--i:4"><span class="eb">A napod · te és az app</span><div class="duo"><div><span class="eb">Az app szerint</span><span class="num">64<small>/100</small></span><small class="txt sub">közepes nap</small></div><div><span class="eb">Szerinted</span><span class="num">7<small>/10</small></span><small class="txt sub">jó nap</small></div></div>
      <p class="txt" style="margin-top:8px">Az app szerint közepes nap, szerinted jó volt. Kevés volt a fehérje és rövid az alvás, ezért lett közepes a pontszám. A hangulatod viszont egész nap 7 fölött volt — úgy tűnik, ma a délutáni séta többet számított, mint a számok.</p>
      <p class="fn">A 7/10 az esti check-in utolsó kérdéséből jön („Milyen volt a napod összességében?”). A napod többi része nem változik.</p></section>`}
  if(iso==='2026-09-21')return `<div class="p16 rise" style="--i:2"><span class="eb">${dn} · ${dd} · lezárva, hajnali 3:02</span><h2 class="t" style="margin-top:6px">Erre a napra kevés az adat</h2><p class="txt sub" style="margin-top:6px">Csak egy területről van adat (egy alvás), ezért nem adok pontszámot: kitalálni nem fogok. A hét pontszámába ez a nap nem számít bele.</p></div>
    <section class="open rise" style="--i:3">${ND_DIM.map(([k,l,ic])=>`<div class="ln" ${k==='sleep'?'':'style="opacity:.55"'}>${T(ic)}<span class="g">${l}<small>${k==='sleep'?'7ó 02p · minőség 6/10':'nincs adat'}</small></span><span class="v"><b>${k==='sleep'?'70':'–'}</b></span></div>`).join('')}</section>`;
  const v=NDY;
  return `<div class="p16 rise" style="--i:2"><span class="eb">${dn} · ${dd} · lezárva, hajnali 3:04</span><div class="big"><span class="num">${v.score}</span><span class="v">${v.label}</span></div>
      <button class="lk" data-ndadj aria-expanded="${ND.adj}">alap ${v.base} · a Mezo szerint ${v.corr>0?'+':'−'}${Math.abs(v.corr)} ${ND.adj?'▴':'▾'}</button>${ND.adj?`<p class="txt sub" style="margin-top:6px">${v.adj}</p>`:''}</div>
    <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 8px">${sender('mezo','a napodról')}</div>${v.prose.map(p=>`<p class="txt" style="margin-bottom:8px">${p}</p>`).join('')}
      ${v.hl.map(([eb,t])=>`<div class="ln"><span class="g"><span class="eb">${eb}</span>${t}</span></div>`).join('')}
      <div class="act"><span class="txt sub">Segített?</span><button class="lk" data-toast="Köszönöm, jegyzem" aria-label="Segített">${T('t-thumb-up')}</button><button class="lk" data-toast="Mi nem talált? (itt jönnének az okok)" aria-label="Nem talált">${T('t-thumb-down')}</button><button class="lk" style="margin-left:auto" data-toast="Beszélgetés a napról (Mezo chat)">Beszélgess a napról ›</button></div></section>
    ${ndDimsClosed()}
    <section class="open rise" style="--i:5"><span class="eb">A nap körülményei · nem számít a pontba</span><p class="txt sub">${v.ctx.map(([a,b])=>`${a} · <b>${b}</b>`).join(' · ')}</p><p class="fn">Ha utólag beírsz még valamit erre a napra, a jegyzetet egyszer újraírom.</p></section>
    ${iso==='2026-09-23'?`<section class="open rise" style="--i:6"><div class="ln tap" style="border-top:0" data-go="nap.2026-09-24">${T('t-sun')}<span class="g"><span class="eb">Reggeli összefoglaló · kész</span>Tovább a mai napra</span>${I('i-chev','chev')}</div></section>`:''}`}
function napDay(arg){const [iso0,phase]=(arg||'').split('.');const iso=ND_DAYNAME[iso0]?iso0:'2026-09-24';ND.phase=phase==='este'?'evening':'day';
  return page(`<div class="sec rise"><span class="eb">A napom</span><span class="eb">szept 21 – 27</span></div>${ndWeek(iso)}${ndDayBody(iso)}`,'nap','napom')}
const napom=()=>napDay('2026-09-24');

/* ── RUTIN-ÉPÍTÉS (mezo-lhqw7) ── */
const RE={rutin:'full',lanc:'view'};
let effort=[1,0,1,2], fwPick='fogg', sklFilter=[true,true,true,false];
const RLIFE=[['Tudatosság','t-heart'],['Szemlélet','t-compass'],['Konyha','t-pot'],['Pénzügyek','t-coin'],['Produktivitás','t-record'],['Tanulás','t-book'],['Kapcsolatok','t-people'],['Regeneráció','t-sprout']];
const CHAIN=[['Ébredés időben','reggel · ébredés',92,'d'],['Reggeli napfény','ébredés után',78,'d'],['50 fekvőtámasz','megvolt a reggeli napfény',48,'now'],['Reggeli videó','fekvőtámasz után',30,''],['Gombakávé','videó után',64,'']];
const recept=(i=3)=>`<p class="txt" style="font-size:16px;line-height:1.5">Miután <b>megvolt a reggeli napfény</b>, ${i>=2?'<b>50 fekvőtámaszt</b> csinálok':'<span class="blank">…</span>'}, és ünneplésül ${i>=3?'<b>ökölrázás</b>':'<span class="blank">…</span>'}.</p>`;
function rutinEpites(){const past=RE.rutin==='past',done=RE.rutin==='done';
  const top=`<div class="sec rise"><button class="backbtn" data-go="rutin"><b>‹</b>Rutin</button><button class="lk" data-sheet="ai">${T('t-spark')} AI javaslat</button></div>
  <div class="p16 rise" style="--i:1"><span class="eb">Rutinok szerkesztése</span><div class="big"><span class="num">${past?'4':done?'7':'3'}</span><span class="v">/ 7 ma · 2 szokás már magától megy</span></div><p class="txt sub" style="margin-top:6px">9 tökéletes reggel · 12 tökéletes este a 30 napból · 7 aktív szokás</p></div>
  <div class="sec rise" style="--i:2"><button class="lk" data-rst="rutin:past">‹ Tegnap</button><span class="eb">${past?'Kedd, szept. 22':'Ma · csütörtök'}</span>${past?`<button class="lk" data-rst="rutin:full">Ma ›</button>`:'<span class="lk" style="opacity:.3">›</span>'}</div>`;
  if(past)return page(top+`<div class="p16 rise" style="--i:3"><p class="txt sub">Reggel 4/5 · Este 2/2 · +45 XP</p><p class="txt" style="margin-top:6px">A <b>Reggeli videó</b> kimaradt — a lánc másnap folytatódott, nem szakadt meg.</p></div>
    ${[['t-dawn','Reggeli lánc','4/5',CHAIN.map(c=>c[0])],['t-moon','Esti lánc','2/2',['Koffein-cutoff','Konyha zárva']]].map(([ic,n,c,rows],k)=>`<section class="open rise" style="--i:${k+4}"><div class="sec" style="padding:0 0 4px"><span class="eb">${n}</span><span class="eb">${c}</span></div>${rows.map((r,i)=>`<div class="ln" ${i===3&&n==='Reggeli lánc'?'style="opacity:.5"':''}>${i===3&&n==='Reggeli lánc'?'<span class="dash"></span>':I('i-check','tk')}<span class="g">${r}</span></div>`).join('')}</section>`).join('')}`,'nap','rutin');
  return page(top+`<section class="open rise" style="--i:3"><div class="ln tap" style="border-top:0" data-go="rutin">${I(done?'i-star':'i-check','tk')}<span class="g"><span class="eb">${done?'Mind megvan':'Következik'}</span>${done?'A mai rutin kész':'50 fekvőtámasz'}<small>${done?'holnap folytatódik':'megvolt a reggeli napfény · Reggeli lánc'}</small></span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-go="lanc">${T('t-dawn')}<span class="g"><span class="eb">Aktív lánc · reggeli</span><span class="chd">${CHAIN.map(c=>`<i class="${done?'d':c[3]}"></i>`).join('')}</span></span><span class="v"><b>${done?5:2}</b> / 5 kész</span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-go="szokasok">${T('t-harvest')}<span class="g">Szokásaid<small>7 aktív · 2 beérett</small></span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-go="rutin-uj.fw">${T('t-book')}<span class="g">Építs<small>új szokás / lánc</small></span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-sheet="chain">${T('t-chain')}<span class="g">+ Új lánc</span>${I('i-chev','chev')}</div>
    <p class="fn">Itt építed és szerkeszted a rutint — pipálni a Rutin fülön lehet.</p></section>`,'nap','rutin');
}
function lanc(){const ed=RE.lanc==='edit';
  return page(`<div class="sec rise"><button class="backbtn" data-go="rutin-epites"><b>‹</b>Rutinok</button><button class="lk" data-rst="lanc:${ed?'view':'edit'}">${ed?'Kész':'Szerkesztés'}</button></div>
  <div class="p16 rise" style="--i:1"><span class="eb">Reggeli lánc</span><div class="big"><span class="num">2</span><span class="v">/ 5 kész</span></div><p class="txt sub" style="margin-top:6px">Ébredés időben → Reggeli napfény → 50 fekvőtámasz → Reggeli videó → Gombakávé</p></div>
  ${ed?`<div class="p16 rise" style="--i:2;margin-top:10px">${field('A lánc neve',VF('','',{value:'Reggeli lánc'}))}<span class="eb" style="margin-top:12px">Napszak</span><div class="chips2"><button class="on">${T('t-dawn')}Reggel</button><button>${T('t-sun')}Nap</button><button>${T('t-moon')}Este</button></div></div>`:''}
  <section class="open rise" style="--i:3"><span class="eb">${ed?'Sorrend és horgonyok':'A lánc sorrendben'}</span>
    ${CHAIN.map((c,i)=>`<div class="ln ${ed?'':'tap'} ${i===3?'broken':''}" ${ed?'':'data-go="szokas"'}>${c[3]==='d'?I('i-check','tk'):`<span class="dash ${c[3]==='now'?'now':''}"></span>`}<span class="g">${c[0]}<small>${T(i===4?'t-note':'t-anchor','inl')} ${c[1]}</small></span>${ed?`<span class="mv"><button data-toast="Feljebb">▲</button><button data-toast="Lejjebb">▼</button></span>`:`<span class="v"><b>${c[2]}</b>%</span>`}</div>`).join('')}
    ${ed?`<p class="txt sub" style="margin-top:10px">${T('t-info','inl')} A sorrend és a horgony nem ugyanazt mondja: a <b>Gombakávé</b> horgonya „videó után”, de előrébb került.</p>`:''}
    <div class="act"><button class="lk" data-go="rutin-uj.fw">+ Új habit ebbe a láncba</button></div>
    ${ed?`<div class="act"><button class="lk" style="color:var(--warn)" data-toast="Szüneteltetve">${T('t-hold','inl')} Lánc szüneteltetése — a szokások megmaradnak</button></div><p class="fn">Az alap reggeli és esti lánc nem törölhető.</p>`:''}
    <p class="fn">A horgony mondja meg, mi után jön a szokás — a sorrend ezt követi.</p></section>`,'nap','rutin');
}
const HAB=[['Ébredés időben','magától megy',142,92,'Beérett',''],['Koffein-cutoff','kezd magától menni',66,78,'~12 ismétlés','3 hét múlva'],['Reggeli napfény','kezd magától menni',51,74,'~20 ismétlés','kb. 4 hét'],['50 fekvőtámasz','épül',24,48,'~41 ismétlés','kb. 7 hét'],['Konyha zárva','épül',18,40,'~46 ismétlés','kb. 8 hét'],['Gombakávé','még tudatos',9,26,'—','még gyűlik az adat'],['Reggeli videó','még tudatos',4,null,'—','még gyűlik az adat']];
function szokasok(){const st=['még tudatos','épül','kezd magától menni','magától megy'],vis=HAB.filter(h=>sklFilter[st.indexOf(h[1])]);
  return page(`<div class="sec rise"><button class="backbtn" data-go="rutin-epites"><b>‹</b>Rutinok</button></div>
  <div class="p16 rise" style="--i:1"><span class="eb">Szokásaid</span><div class="big"><span class="num">${vis.length}</span><span class="v">formálódás szerint rendezve</span></div></div>
  <div class="p16 rise" style="--i:2;margin-top:10px"><div class="ftiles">${st.map((s,i)=>`<button class="${sklFilter[i]?'on':''}" data-ft="${i}" aria-pressed="${sklFilter[i]}"><b>${HAB.filter(h=>h[1]===s).length}</b><small>${s}</small></button>`).join('')}</div></div>
  ${vis.length?`<section class="open rise" style="--i:3">${vis.map(h=>`<div class="ln tap" data-go="szokas"><span class="g">${h[0]}<small>${h[1]} · ${h[2]} ismétlés · ${h[4]}${h[5]?' · '+h[5]:''}</small></span><span class="v"><b>${h[3]??'—'}</b>${h[3]!=null?'%':''}</span><div class="bar q"><b style="--w:${h[3]||2}%"></b></div></div>`).join('')}</section>`
  :`<p class="txt sub p16 rise" style="--i:3;padding:16px">Ebben a szakaszban most nincs szokásod.</p>`}
  <p class="fn p16" style="padding:0 16px">Egy szokás ereje a 28 napos pipáiból jön — nem a sorozatból.</p>`,'nap','rutin');
}
function szokas(){
  return page(`<div class="sec rise"><button class="backbtn" data-go="rutin-epites"><b>‹</b>Rutinok</button><button class="lk" data-go="szerk">Szerkesztés</button></div>
  <div class="p16 rise" style="--i:1"><span class="eb">50 fekvőtámasz</span><div class="big"><span class="num">48</span><span class="v">% · 28 napos erő · 24 pipa · 5 kihagyás</span></div><p class="verdict" style="margin-top:6px">Épül. Még kb. 41 ismétlés, úgy 7 hét.</p>
    <div class="rail">${['még tudatos','épül','kezd magától menni','magától megy'].map((s,i)=>`<span class="${i<1?'done':i===1?'on':''}">${s}</span>`).join('')}</div>
    <p class="txt sub" style="margin-top:8px">A reggeli napfény után a legerősebb — ott szinte sosem marad ki.</p></div>
  <section class="open rise" style="--i:2"><span class="eb">Kontextus · a legerősebb jel</span>${[['Napszak',82,'reggel 7–8 között'],['Horgony',74,'napfény után'],['Ritmus',51,'hétköznap erősebb']].map(r=>`<div class="ln"><span class="g">${r[0]}<small>${r[2]}</small></span><span class="v"><b>${r[1]}</b>%</span><div class="bar q"><b style="--w:${r[1]}%"></b></div></div>`).join('')}</section>
  <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 4px"><span class="eb">Előzmény · az első naptól</span><span class="eb">29 nap</span></div>${grid28(2,[9,14,20,23,27],[0,1,2,3,4,5],35)}<p class="fn">Egy kocka egy nap: tele = pipa, üres = kimaradt, halvány = nem volt sor. Csendes rács, nem sorozat.</p></section>
  <section class="open rise" style="--i:4"><div class="sec" style="padding:0 0 4px"><span class="eb">A recepted</span><button class="lk" data-go="szerk">szerkesztem ›</button></div>${recept()}</section>`,'nap','rutin');
}
function effortCard(){const f=['Idő','Fizikai','Fejmunka','Beleillik'],o=[['kevés','közép','sok'],['könnyű','közép','nehéz'],['könnyű','közép','nehéz'],['simán','kicsit','nehezen']];
  return `${f.map((n,i)=>`<div class="ln"><span class="g">${n}</span><span class="seg3 sm">${o[i].map((t,k)=>`<button class="${effort[i]===k?'on':''}" data-eff="${i}:${k}">${t}</button>`).join('')}</span></div>`).join('')}<p class="fn">Közepes · +10 XP / alkalom</p>`}
function szerk(){
  return page(`<div class="sec rise"><button class="backbtn" data-go="szokas"><b>‹</b>Szokás</button><button class="lk" data-toast="Mentve">Mentés</button></div>
  <div class="p16 rise" style="--i:1"><span class="eb">Szerkesztés</span><h1 class="t">50 fekvőtámasz</h1><span class="eb" style="margin-top:12px">A recept · együtt változik</span>${recept()}</div>
  <section class="open rise" style="--i:2"><span class="eb">Keret</span>${segs([['fogg','Szokás-láncolás'],['clear','Négy törvény']],'fogg','data-toast')}<p class="fn">${T('t-info','inl')} Váltásnál elveszik: az ünneplés.</p>
    <span class="eb" style="margin-top:14px">Miután… · horgony</span><div class="ln tap" data-sheet="anchor">${T('t-anchor')}<span class="g">Reggeli napfény<small>74% erő · 28 nap</small></span>${I('i-chev','chev')}</div>
    ${field('Cím · a tett',VF('','',{value:'50 fekvőtámasz'}))}${field('Ünneplésül',VF('','',{value:'ökölrázás'}))}${field('Miért',VF('pl. hogy erősebb legyen a vállam','Hogy erősebb legyen a vállam, és ne fájjon a nyakam.'))}
    <span class="eb" style="margin-top:14px">Hogyan pipálódik?</span>${segs([['k','Kézzel pipálom'],['a','Adatból']],'k','data-toast')}
    <span class="eb" style="margin-top:14px">Lánc</span><div class="chips2"><button class="on">Reggeli lánc</button><button>Esti lánc</button><button>Egyik sem</button></div>
    <span class="eb" style="margin-top:14px">Mennyibe kerül? · újraértékelhető</span>${effortCard()}
    <div class="act" style="flex-wrap:wrap"><button class="lk" style="color:var(--warn)" data-toast="Szüneteltetve">${T('t-hold','inl')} Szüneteltetés — a haladás megmarad</button><button class="lk" style="color:var(--bad)" data-toast="Koppints újra a törléshez">${T('t-trash','inl')} Szokás törlése</button></div></section>`,'nap','rutin');
}
const WZ={fogg:['fw','anchor','act','celeb'],clear:['fw','cue','crave','act','reward']};
const WT={fw:'Milyen keretre építsük?',anchor:'Mihez horgonyzod?',cue:'Mi a jelzés?',crave:'Miért fogod akarni?',act:'Mi a tett?',celeb:'Hogyan ünnepled?',reward:'Mi teszi kielégítővé?'};
function rutinUj(step){const steps=WZ[fwPick]||WZ.fogg,i=Math.max(0,steps.indexOf(step||'fw')),s=steps[i];
  const prevT=i?WT[steps[i-1]]:'Rutinok',prevGo=i?`rutin-uj.${steps[i-1]}`:'rutin-epites',last=i===steps.length-1;
  let body='';
  if(s==='fw')body=`${[['fogg','t-anchor','Szokás-láncolás','BJ Fogg · Tiny Habits','Horgony → Pici tett → Ünneplés'],['clear','t-gem','Négy törvény','James Clear · Atomic Habits','Jelzés → Vágy → Válasz → Jutalom'],['free','t-note','Keret nélkül','csak a tett','']].map(f=>`<div class="ln tap ${fwPick===f[0]?'sel':''}" data-fw="${f[0]}" role="button" aria-pressed="${fwPick===f[0]}">${T(f[1])}<span class="g">${f[2]}<small>${f[3]}${f[4]?' · '+f[4]:''}</small></span>${fwPick===f[0]?I('i-check','tk'):''}</div>`).join('')}<p class="fn">${T('t-bulb','inl')} Kezdőknek a szokás-láncolás a legkönnyebb: egy meglévő szokásra ülteted az újat.</p>`;
  if(s==='anchor')body=`<div class="chips2">${[['Ébredés időben','szokás'],['Reggeli napfény','szokás'],['Kávé után','Mezo-pillanat'],['Edzés vége','Mezo-pillanat']].map((a,k)=>`<button class="${k===1?'on':''}">${a[0]} <small>· ${a[1]}</small></button>`).join('')}</div>${field('Vagy saját szavakkal',VF('pl. miután leteszem a telefont','Miután este leteszem a telefont.'))}<p class="fn">A jó horgony minden nap biztosan megtörténik, és pontosan tudod, mikor ért véget.</p>`;
  if(s==='act')body=`${field('Én … · a tett',VF('','',{value:'50 fekvőtámaszt csinálok'}))}<p class="txt sub" style="margin-top:8px">${T('t-scissors','inl')} Ez nagynak tűnik. Mi lenne, ha 5-tel kezdenéd? A pici tett ragad meg.</p>
    <span class="eb" style="margin-top:14px">Melyik láncba?</span><div class="chips2"><button class="on">Reggeli lánc</button><button>Esti lánc</button></div>
    <span class="eb" style="margin-top:14px">Életterület</span><div class="chips2">${RLIFE.map((l,k)=>`<button class="${k===7?'on':''}">${T(l[1])}${l[0]}</button>`).join('')}</div>
    <span class="eb" style="margin-top:14px">Mennyibe kerül?</span>${effortCard()}<span class="eb" style="margin-top:14px">Hogyan pipálódik?</span>${segs([['k','Kézzel pipálom'],['a','Adatból']],'k','data-toast')}`;
  if(s==='celeb')body=`<div class="chips2">${['ökölrázás','„Igen!”','mosoly a tükörbe','mély levegő'].map((c,k)=>`<button class="${k===0?'on':''}">${c}</button>`).join('')}</div>${field('Vagy saját',VF('pl. egy kis tánc','Egy kis tánc a konyhában.'))}<p class="fn">Az ünneplés azonnal jöjjön, a tett után — ettől ragad meg az érzés.</p><div class="act"><button class="btn sm" data-toast="Vállalva">${I('i-check')} Vállalom</button></div>`;
  if(['cue','crave','reward'].includes(s))body=`${field(s==='cue'?'Jelzés':s==='crave'?'Miért akarod? · vágy':'Jutalom',VF('…','Amikor felébredek, és még a kezemben van a telefon.'))}<p class="fn">${T('t-gem','inl')} A négy törvény egy-egy lépése.</p>`;
  return page(`<div class="sec rise"><button class="backbtn" data-go="${prevGo}"><b>‹</b>${prevT}</button><button class="lk" data-go="rutin-epites">Mégse</button></div>
  <div class="p16 rise" style="--i:1"><div class="steps" style="grid-template-columns:repeat(${steps.length},1fr)">${steps.map((x,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</div><span class="eb" style="margin-top:10px">Új szokás-recept · ${i+1}/${steps.length}</span><h1 class="t" style="font-size:24px">${WT[s]}</h1></div>
  ${i?`<div class="p16 rise" style="--i:2;margin-top:10px"><span class="eb">${fwPick==='clear'?'Négy törvény':'Szokás-láncolás'} · épül, ahogy töltöd</span>${recept(i)}</div>`:''}
  <section class="open rise" style="--i:3">${body}<div class="act" style="justify-content:space-between">${i?`<button class="lk" data-go="${prevGo}">‹ Vissza</button>`:'<span></span>'}<button class="btn sm" ${last?'data-toast="Mentve · vissza a Rutinra"':`data-go="rutin-uj.${steps[i+1]}"`}>${last?'Mentés':'Tovább ›'}</button></div></section>`,'nap','rutin');
}

/* ── LAPOK (alulról) ── */
const SHEETS={
  checkin:()=>ckSheet(),
  kimelo:()=>kmSheet(),
  kmwelcome:()=>kmWelcome(),
  tobb:()=>`${sheetH('Mai','Több')}<div class="ln tap" data-sheet="activity">${T('t-steps')}<span class="g">Aktivitás<small>amit ma tettél</small></span>${I('i-chev','chev')}</div><div class="ln tap" data-toast="Mezo · Chat">${I('i-chat')}<span class="g">Chat<small>beszéljük át</small></span>${I('i-chev','chev')}</div><div class="ln tap" data-go="eletjel">${T('t-heart')}<span class="g">Életjelek<small>a hat jel</small></span>${I('i-chev','chev')}</div><div class="ln tap" data-go="kuldetesek">${T('t-quest')}<span class="g">Napi küldetések<small>ajánlatok a mai napra</small></span>${I('i-chev','chev')}</div>`,
  naplopick:()=>`${sheetH('Napló','Mit naplózol?','','tobb')}<div class="qgrid three">${[['Aktivitás','t-steps','activity'],['Napló','t-journal','journal'],['Hála','t-sprout','journal']].map(([l,ic,k])=>`<button data-sheet="${k}">${T(ic)}<span>${l}</span></button>`).join('')}</div>`,
  water:()=>`${sheetH('Víz','Mennyit ittál?','Egy korty szünet.')}<div class="big"><span class="num">400</span><span class="v">ml · ma eddig 1,2 / 2,5 l</span></div><div class="chips2">${['250 ml','400 ml','500 ml'].map((l,i)=>`<button class="${i===1?'on':''}">${l}</button>`).join('')}</div>${field('ml kézzel',VF('pl. 330',''))}${saveRow()}`,
  weight:()=>`${sheetH('Gyors rögzítés','Mi a számunk ma?','Egy mérés a napodban.')}<div class="big"><span class="num">82,4</span><span class="v">kg · tegnap 82,6</span></div><div class="chips2">${['−0,5','−0,1','+0,1','+0,5'].map(l=>`<button>${l}</button>`).join('')}</div>${field('Egy mondat · opcionális',VF('pl. „vasárnap reggel · folyadékvesztés”','Vasárnap reggel, edzés után mértem.',{rows:1}))}${saveRow()}`,
  sleep:()=>`${sheetH('Gyors rögzítés','Hogyan aludtunk?','Az éjszakád, néhány mozdulattal.')}${segs([['k','Kézi'],['s','Screenshot']],'k','data-toast')}<div class="big" style="margin-top:10px"><span class="num">7,4</span><span class="v">óra · 23:10 → 06:35</span></div>
    <div class="two">${field('Lefekvés',VF('','',{value:'23:10'}))}${field('Ébredés',VF('','',{value:'06:35'}))}</div>${field('Minőség · 7/10',scale(7))}
    <span class="eb" style="margin-top:14px">Ébredések éjjel</span><div class="chips2">${['0','1','2','3','4+'].map((l,i)=>`<button class="${i===2?'on':''}">${l}</button>`).join('')}</div>
    <p class="fn">${T('t-moon','inl')} Az éjjel 2× jártál az éjszakai módban — előtöltöttem.</p>${field('Ágyban összesen (perc)',VF('opcionális',''))}${saveRow()}`,
  sport:()=>`${sheetH('Sport log · röpi','Hogy ment?','Az idő, a terhelés és a saját élményed.')}${segs([['r','Röpi'],['c','Cross'],['t','TRX']],'r','data-toast')}
    <div class="two" style="margin-top:10px">${field('Idő · perc',`<div class="stp"><button data-toast="−5 perc">−</button><b>90</b><button data-toast="+5 perc">+</button></div>`)}${field('Setek',`<div class="stp"><button data-toast="−1">−</button><b>5</b><button data-toast="+1">+</button></div>`)}</div>
    ${field('RPE · összesített nehézség',scale(7))}${field('Váll terhelés',scale(5))}${field('Jegyzet',VF('Hogy érezted magad, mi ment jól, mi fájt…','Jól ment a nyitás, de a harmadik szettben már húzott a vállam.'))}${saveRow()}`,
  journal:()=>`${sheetH('Gyors rögzítés','Mi jár a fejedben?','A gondolataidnak itt van helye.','naplopick')}<div class="chips2">${['Napló','Döntés','Hála'].map((l,i)=>`<button class="${i?'':'on'}">${l}</button>`).join('')}</div>
    <div style="margin-top:10px">${VF('Írd le, ami most benned van…','Kicsit feszült vagyok a holnapi megbeszélés miatt, de összeszedtem, mit akarok mondani.',{rows:4})}</div>${field('Dátum',VF('','',{value:'2026. 10. 07.'}))}${saveRow('Mentem')}`,
  activity:(st)=>st==='done'?`${sheetH('Tevékenységnapló','Megvan!')}<div class="big">${T('t-coin')}<span class="num">+15</span><span class="v">XP · Pénzügyek</span></div><p class="txt sub" style="margin-top:8px">Küldetés teljesítve: Tegyél félre ma (+20 XP)</p><button class="btn wide" style="margin-top:14px" data-close>Kész</button>`
    :`${sheetH('Tevékenységnapló','Mi történt ma?','A kis lépések is a napod részei.','naplopick')}<p class="txt sub">${T('t-quest','inl')} Mai küldetés: Tegyél félre ma · +20 XP a teljesítésért</p>
    <div style="margin-top:10px">${VF('pl. Olvastam 30 percet, átraktam 50 ezret megtakarításba…','Olvastam fél órát, és átraktam ötvenezret a megtakarításba.',{rows:3})}</div><p class="fn">Az AI besorolja, és a megfelelő LIFE skillhez írja az XP-t.</p>
    <div class="two"><button class="btn ghost" data-close>Mégse</button><button class="btn" data-sheet="activity" data-arg="done">Naplózom</button></div>`,
  reflect:()=>`${sheetH('Rutin · este','Szándékkal élted a napot?')}<div class="two three">${['Igen','Részben','Nem'].map(x=>`<button class="btn ghost" data-reflect>${x}</button>`).join('')}</div>`,
  ai:()=>`${sheetH('AI javaslat','Milyen szokás segítene?')}${field('Szándék (opcionális)',VF('pl. jobb esti lezárás','Szeretném, ha este hamarabb letenném a telefont és nyugodtabban zárnám a napot.'))}<button class="btn wide" style="margin-top:14px" data-toast="Mezo gondolkodik…">${T('t-spark')} Javasolj</button>`,
  chain:()=>`${sheetH('Rutin','Új rutin')}${field('Név',VF('pl. Ebéd utáni szünet','Ebéd utáni szünet'))}<span class="eb" style="margin-top:12px">Napszak</span><div class="chips2"><button class="on">${T('t-dawn')}Reggel</button><button>${T('t-sun')}Napközben</button><button>${T('t-moon')}Este</button></div>${saveRow('Mentés','data-toast="Mentve" data-close')}`,
  anchor:()=>`${sheetH('Horgony','Mihez kötöd?')}<span class="eb">A szokásaidból</span>${[['Ébredés időben','92% erő · 28 nap',0],['Reggeli napfény','74% erő · 28 nap',1],['Gombakávé','friss szokás',0]].map(o=>`<div class="ln tap" data-close>${o[2]?I('i-check','tk'):'<span class="dash"></span>'}<span class="g">${o[0]}<small>${o[1]}</small></span></div>`).join('')}
    <span class="eb" style="margin-top:14px">Mezo-események</span>${['Edzés vége','Első étkezés'].map(o=>`<div class="ln tap" data-close><span class="dash"></span><span class="g">${o}</span></div>`).join('')}
    <span class="eb" style="margin-top:14px">Egyéb</span><div class="ln tap" data-close>${T('t-note')}<span class="g">Saját szavakkal…</span></div><div class="ln tap" data-close>${T('t-skip')}<span class="g">Leoldom a horgonyt</span></div>`
};
const reSheet=()=>{const sh=$('#sheet');const y=sh?sh.scrollTop:0;openSheet(ckSheet());if(sh)sh.scrollTop=y};

/* ── interakciók (a shell delegál: data-go/back/sheet/close/toast; itt a Nap sajátjai) ── */
document.addEventListener('click',e=>{
  if(K.D!=='nap')return;
  const t=e.target, stop=()=>{e.stopPropagation();e.preventDefault()}, q=s=>t.closest(s);
  let x;
  /* kímélő mód */
  if(q('[data-sheet="kimelo"]')){stop();KM.pick={cat:KM.on?KM.cat:null,dur:KM.on?KM.dur:null};openSheet(kmSheet());return}
  if(x=q('[data-kmcat]')){stop();KM.pick.cat=x.dataset.kmcat;openSheet(kmSheet());return}
  if(x=q('[data-kmdur]')){stop();KM.pick.dur=KM.pick.dur===x.dataset.kmdur?null:x.dataset.kmdur;openSheet(kmSheet());return}
  if(q('[data-kmon]')){stop();if(!KM.pick.cat)return;Object.assign(KM,{on:true,cat:KM.pick.cat,dur:KM.pick.dur||'UNKNOWN',day:KM.on?KM.day:1,later:false,ask:false});closeSheet();soft();toast('Kímélő mód bekapcsolva');return}
  if(q('[data-kmlater]')){stop();KM.later=true;soft();toast('Rendben, holnap reggel újra rákérdezek');return}
  if(x=q('[data-kmask]')){stop();KM.ask=x.dataset.kmask==='1';soft();return}
  if(q('[data-kmdel]')){stop();Object.assign(KM,{on:false,ask:false,later:false});soft();toast('Kímélő mód törölve · az edzéseid visszaálltak');return}
  if(q('[data-kmbetter]')){stop();if(KM.on&&KM.day===1){Object.assign(KM,{on:false,later:false,ask:false});KM.prev=null;soft();toast('Kímélő mód befejezve');return}KM.prev=KM.on?{...KM}:null;Object.assign(KM,{on:false,later:false,ask:false});soft();openSheet(kmWelcome());return}
  if(q('[data-kmok]')){stop();KM.prev=null;closeSheet();toast('Jó, hogy jobban vagy');return}
  if(q('[data-kmundo]')){stop();if(KM.prev)Object.assign(KM,KM.prev,{on:true,later:true,ask:false,applied:KM.applied});KM.prev=null;closeSheet();soft();toast('Rendben, a kímélő mód folytatódik');return}
  /* Mai */
  if(x=q('[data-mac]')){stop();const i=+x.dataset.mac;macroSel=macroSel===i?null:i;soft();return}
  if(q('[data-core]')){stop();macroSel=null;soft();return}
  if(q('[data-obs]')){stop();obsState=1;soft();return}
  if(q('[data-fbno]')){stop();fbNo=true;soft();return}
  if(x=q('[data-exp]')){stop();expMsg[x.dataset.exp]=1;soft();return}
  if(x=q('[data-wk]')){stop();const v=x.dataset.wk;if(v==='next')wkStep=Math.min(2,wkStep+1);else if(v==='accept'){wkDone=true;toast('Elfogadva · a fehérjecél 200 g')}else{wkDone=true;toast('Rendben, ezt most kihagyjuk')}soft();return}
  if(x=q('[data-tab]')){stop();K.go('uzenetek.'+x.dataset.tab);return}
  /* Rutin */
  if(x=q('[data-face]')){stop();nowRow=-1;K.go('rutin.'+x.dataset.face);return}
  if(x=q('[data-tick]')){stop();const R=RUTIN[face].rows,i=+x.dataset.tick;R[i][4]=R[i][4]?0:1;if(R[i][4]){const d=R.filter(r=>r[4]).length;nowRow=R.findIndex((r,j)=>j>i&&!r[4]);toast(d===R.length?`${RUTIN[face].title} · mind megvan`:`Szokás · ${d} / ${R.length}`)}soft();return}
  if(q('[data-reflect]')){stop();closeSheet();toast('Megjegyeztem');return}
  if(x=q('[data-reroll]')){stop();rerolls=0;QUESTS[+x.dataset.reroll]={ic:'t-sleep',t:'Pihenőnap: aludj legalább 7,5 órát',xp:20,st:'offered',foot:'folyamatban · a logjaidból záródik magától',cta:'Alvás'};soft();toast('Újrasorsolva');return}
  if(x=q('[data-rst]')){stop();const [k,v]=x.dataset.rst.split(':');RE[k]=v;soft();return}
  if(x=q('[data-fw]')){stop();fwPick=x.dataset.fw==='free'?'fogg':x.dataset.fw;if(x.dataset.fw==='free')toast('Keret nélkül: csak a tett lépése');soft();return}
  if(x=q('[data-eff]')){stop();const [a,b]=x.dataset.eff.split(':');effort[+a]=+b;soft();return}
  if(x=q('[data-ft]')){stop();sklFilter[+x.dataset.ft]=!sklFilter[+x.dataset.ft];soft();return}
  /* A napom */
  if(x=q('[data-nddim]')){stop();const k=x.dataset.nddim;ND.open.has(k)?ND.open.delete(k):ND.open.add(k);soft();return}
  if(q('[data-ndadj]')){stop();ND.adj=!ND.adj;soft();return}
  if(x=q('[data-ndritual]')){ND.ritual=true;/* a data-go viszi tovább */}
  /* check-in lap */
  const inCk=$('#sheet.on')&&$('#sheet .steps')&&!$('#sheet .wk7');
  const cknext=()=>setTimeout(()=>{ck.step++;reSheet()},180);
  if(x=q('[data-ckslot]')){stop();ck={slot:x.dataset.ckslot,step:0,a:{},quick:false};openSheet(ckSheet());return}
  if(q('[data-sheet="checkin"]')){stop();ck={slot:(SLOTS.find(s=>s.st==='now')||SLOTS.find(s=>s.st!=='done')||SLOTS[2]).t,step:0,a:{},quick:false};openSheet(ckSheet());return}
  if(x=q('[data-ckstep]')){stop();if(x.disabled)return;ck.step=+x.dataset.ckstep;reSheet();return}
  if(q('[data-ckskip]')){stop();ck.a[ckSteps()[ck.step]]=null;ck.step++;reSheet();return}
  if(q('[data-ckquick]')){stop();ck.quick=true;ck.step=ckSteps().length;reSheet();return}
  if(x=q('[data-ckpain]')){stop();if(x.dataset.ckpain==='no'){ck.a.pain=false;reSheet();cknext()}else{if(!ck.a.pain)ck.a.pain={regions:[],int:null};reSheet()}return}
  if(x=q('[data-ckreg]')){stop();const R=ck.a.pain.regions,r=x.dataset.ckreg,i=R.indexOf(r);i<0?R.push(r):R.splice(i,1);reSheet();return}
  if(x=q('[data-ckkind]')){stop();const Kk=ck.a.craving.kinds,v=x.dataset.ckkind,i=Kk.indexOf(v);i<0?Kk.push(v):Kk.splice(i,1);reSheet();return}
  if((x=q('[data-scale]'))&&inCk&&ck.step<ckSteps().length){stop();const v=+x.dataset.scale,id=ckSteps()[ck.step];
    if(id==='pain'){ck.a.pain.int=v;reSheet();return}
    if(id==='craving'){ck.a.craving={v,kinds:ck.a.craving?ck.a.craving.kinds:[]};reSheet();if(v<4)cknext();return}
    ck.a[id]=v;reSheet();cknext();return}
  if(x=q('[data-scale]')){stop();x.parentNode.querySelectorAll('button').forEach((b,i)=>{b.className=i+1<+x.dataset.scale?'f':i+1===+x.dataset.scale?'a':''});return}
  if(q('[data-cksave]')){stop();const sl=SLOTS.find(s=>s.t===ck.slot);Object.assign(sl,{st:'done',a:{...ck.a},quick:ck.quick,note:ck.quick?'':'Mentve most'});closeSheet();toast('Mentve · '+ck.slot);soft();return}
  if(q('[data-save]')){stop();closeSheet();toast('Mentve');return}
},true);

/* ── domain CSS ── */
const P='.phone[data-v="ajanlott"][data-d="nap"]';
const CSS=`
${P} .p16 .eb{margin-bottom:4px}
${P} .p16 .verdict{font-family:var(--disp);font-weight:var(--dispw);letter-spacing:var(--dispt);font-size:19px;line-height:1.2;text-wrap:balance}
${P} .open .verdict{font-family:var(--disp);font-weight:var(--dispw);font-size:17px;line-height:1.2}
${P} .fn{margin-top:8px}
${P} .lk svg.ic.td,${P} svg.ic.td.inl{width:16px;height:16px;vertical-align:-3px;display:inline-block}
${P} .ln svg.ic.tk{width:22px;height:22px;color:var(--ok);stroke-width:2.2;flex:0 0 auto;opacity:.9}
${P} .ln .dash{width:20px;height:20px;border-radius:50%;border:1.5px dashed var(--faint);flex:0 0 auto;margin:0 1px}
${P} .ln .dash.now{border-style:solid;border-color:var(--acc)}
${P} .ln.sel .g{color:var(--acc)}
${P} .ln.done .g{color:var(--sub)}
${P} .ln.broken .g{opacity:.55}
${P} .ln .tk{width:28px;height:28px;border-radius:50%;border:1.5px solid var(--faint);display:grid;place-items:center;color:transparent;flex:0 0 auto}
${P} .ln .tk.on{background:var(--ok);border-color:var(--ok);color:#fff}
${P} .ln .tk svg.ic{width:14px;height:14px;stroke-width:2.4}
${P} .ln .mv{display:flex;gap:4px}${P} .ln .mv button{font-size:11px;color:var(--sub);padding:4px 6px;border:1px solid var(--hair);border-radius:6px}
${P} .kmentry{padding:0 16px 6px}
${P} .kmentry .lk{display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:var(--sub)}
${P} .hg .kmart,${P} .zart{width:48px;height:48px}
${P} .zart{display:inline-block;width:64px;height:64px}
${P} .snd{display:flex;align-items:center;gap:10px}
${P} .snd .g{font-size:13px;line-height:1.3}${P} .snd .g b{font-weight:600}${P} .snd .g small{display:block;font-size:11.5px;color:var(--sub)}
${P} .ln .snd{flex:1;min-width:0}
${P} .act{flex-wrap:wrap}
${P} .ev summary{list-style:none;cursor:pointer;margin-top:8px;display:inline-block}${P} .ev summary::-webkit-details-marker{display:none}
${P} .cells{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px}
${P} .cells span{display:inline-flex;flex-direction:column;font-family:var(--mono);font-size:11px;color:var(--sub);line-height:1.2}${P} .cells span b{color:var(--ink);font-weight:500;font-size:12.5px}
${P} .chips2{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
${P} .chips2 button{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border-radius:9px;border:1px solid var(--hair);font-size:12.5px;color:var(--ink)}
${P} .chips2 button.on{border-color:var(--acc);color:var(--acc);box-shadow:inset 0 0 0 1px var(--acc)}
${P} .chips2 button small{color:var(--sub);font-size:11px}${P} .chips2 button svg.ic.td{width:16px;height:16px}
${P} .seg3{display:flex;gap:2px;padding:3px;border-radius:11px;border:1px solid var(--hair)}
${P} .seg3 button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 6px;border-radius:8px;font-size:12.5px;color:var(--sub);text-align:center}
${P} .seg3 button.on{background:var(--card2);color:var(--ink);font-weight:500}
${P} .seg3 .dot{margin-left:0;width:6px;height:6px}
${P} .seg3.sm{flex:0 0 auto}${P} .seg3.sm button{padding:5px 8px;font-size:11.5px}
${P} .steps{display:grid;gap:4px;height:3px;margin-top:4px}${P} .steps i{display:block;border-radius:2px;background:var(--hair)}${P} .steps i.on{background:var(--acc)}
${P} .steps.rz{display:inline-grid;grid-template-columns:repeat(6,22px);height:4px}
${P} .scale{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px}
${P} .scale button{height:40px;border-radius:9px;border:1px solid var(--hair);font-family:var(--mono);font-size:13px;color:var(--sub);text-align:center}
${P} .scale button.f{background:color-mix(in srgb,var(--c,var(--acc)) 18%,transparent);border-color:transparent;color:var(--ink)}
${P} .scale button.a{background:var(--c,var(--acc));border-color:var(--c,var(--acc));color:var(--acc-ink);font-weight:600}
${P} .sl{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:4px}
${P} .fig{display:flex;gap:14px;justify-content:center;margin-top:8px}${P} .fig figure{text-align:center}${P} .fig svg{width:70px;height:132px}
${P} .fig .sil{fill:var(--card2);stroke:var(--hair)}${P} .fig circle{fill:var(--card);stroke:var(--faint);stroke-width:1.2;cursor:pointer}${P} .fig circle.on{fill:var(--acc);stroke:var(--acc)}
${P} .fld{min-height:40px;padding:10px 0;border-bottom:1px solid var(--hair);font-size:14px;line-height:1.45;color:var(--ink)}
${P} .fld.ex{color:var(--sub)}${P} .fld.ta{min-height:calc(var(--rows,2)*22px + 20px)}
${P} .field{margin-top:12px}${P} .field > .eb{margin-bottom:2px}
${P} .two{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}${P} .two.three{grid-template-columns:repeat(3,1fr)}${P} .two .field{margin-top:0}
${P} .shh{display:flex;align-items:flex-start;gap:10px;padding:4px 0 10px}${P} .shh .g{flex:1;min-width:0}${P} .shh .x{font-size:22px;line-height:1;color:var(--sub);padding:0 4px}${P} .shh .lk{text-decoration:none;font-size:20px;line-height:1}
${P} .sheet .ln svg.ic.td{width:22px;height:22px}
${P} .opt4{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
${P} .opt4 button{display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1px solid var(--hair);font-size:13.5px;color:var(--ink)}
${P} .opt4 button.on{border-color:var(--acc);box-shadow:inset 0 0 0 1px var(--acc)}
${P} .qgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}
${P} .qgrid button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 4px 10px;border-radius:12px;font-size:12px;color:var(--ink);text-align:center}
${P} .qgrid button svg.ic.td{width:30px;height:30px}
${P} .g28{display:grid;grid-template-columns:repeat(14,1fr);gap:3px;margin-top:10px}
${P} .g28 i{display:block;aspect-ratio:1;border-radius:3px;background:var(--hair)}${P} .g28 i.p{background:var(--sub)}${P} .g28 i.m{background:transparent;box-shadow:inset 0 0 0 1px var(--hair)}${P} .g28 i.s{opacity:.35}
${P} .ejs{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:4px 0}
${P} .ejs span{display:flex;flex-direction:column;align-items:center;gap:3px}${P} .ejs b{font-family:var(--mono);font-size:14px;font-weight:500}${P} .ejs small{font-family:var(--mono);font-size:9px;color:var(--faint);text-transform:uppercase;letter-spacing:.5px}
${P} .ejs span.warn b{color:var(--warn)}${P} .ejs svg.ic.td{width:24px;height:24px}
${P} .wk7{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:4px 16px 10px}
${P} .wk7 button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0 6px;border-radius:10px;border:1px solid transparent}
${P} .wk7 small{font-family:var(--mono);font-size:8.5px;letter-spacing:.6px;color:var(--faint);text-transform:uppercase}${P} .wk7 b{font-family:var(--mono);font-size:13px;font-weight:500}
${P} .wk7 i{font-style:normal;font-family:var(--mono);font-size:10px;color:var(--sub);height:14px}${P} .wk7 .fut{opacity:.4}${P} .wk7 .on{border-color:var(--hair);background:var(--card)}${P} .wk7 .today b{color:var(--acc)}
${P} .duo{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px}${P} .duo .num{display:block;font-size:34px;margin:2px 0}${P} .duo .num small{font-size:12px}
${P} .rail{display:flex;gap:10px;margin-top:10px;font-family:var(--mono);font-size:10px;letter-spacing:.4px;color:var(--faint);flex-wrap:wrap}${P} .rail .done{color:var(--sub)}${P} .rail .on{color:var(--acc)}
${P} .chd{display:inline-flex;gap:5px;margin-top:4px}${P} .chd i{width:9px;height:9px;border-radius:50%;background:var(--hair)}${P} .chd i.d{background:var(--sub)}${P} .chd i.now{background:var(--acc)}
${P} .ftiles{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
${P} .ftiles button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px;border-radius:10px;border:1px solid var(--hair);text-align:center;opacity:.5}
${P} .ftiles button.on{opacity:1;border-color:var(--acc)}${P} .ftiles b{font-family:var(--mono);font-size:16px;font-weight:500}${P} .ftiles small{font-size:9.5px;color:var(--sub);line-height:1.2}
${P} .blank{display:inline-block;width:48px;border-bottom:1px solid var(--faint)}
${P} .stp{display:inline-flex;align-items:center;gap:12px;margin-top:4px}${P} .stp button{width:30px;height:30px;border-radius:50%;border:1px solid var(--hair);text-align:center;color:var(--ink)}${P} .stp b{font-family:var(--mono);font-size:18px;font-weight:500}
${P} .sum .ln{width:100%}
${P} .arc{width:100%;height:auto;margin-top:8px}
${P} .backbtn{padding:0}
${P} .big{flex-wrap:wrap}${P} .big .num{white-space:nowrap}
${P} .qrow{gap:12px}${P} .qrow button{white-space:nowrap}${P} .qrow button.more{margin-left:auto}
${P} .ctr .csepp,${P} .ctr svg.zart{display:block;margin:0 auto}
${P} .ctr .eb{text-align:center}
`;

register('nap',{
  mark:'i-sun',
  tabs:[['Mai','i-sun','mai'],['A napom','i-cal','napom'],['Beszélgetés','i-chat','uzenetek'],['Rutin','i-list','rutin']],
  routes:{mai,maieste,checkin,hatasok,napom,eletjel,kuldetesek,rutin,uzenetek,gyors,napzaras,nap:napDay,'rutin-epites':rutinEpites,lanc,szokasok,szokas,szerk,'rutin-uj':rutinUj},
  sheets:SHEETS,
  css:CSS,
  notes:`<h2>Nap · Ajánlott</h2>
<p><b>Mit kattints</b> (a bal felső <i>Jelenlegi</i> gombbal ugyanaz a képernyő élőben): <b>#a-nap-mai</b> (Mai; kímélő: <b>#a-nap-mai.kimelo</b>, <b>#a-nap-mai.kimelo-lejart</b>) · <b>#a-nap-maieste</b> (este, napzárás-kártya) · <b>#a-nap-checkin</b> (+ Kitöltöm → a lap lépésről lépésre) · <b>#a-nap-hatasok</b> · <b>#a-nap-eletjel</b> · <b>#a-nap-kuldetesek</b>, <b>#a-nap-kuldetesek.ures</b> · <b>#a-nap-rutin</b> (Reggel · Napközben · Este) · <b>#a-nap-uzenetek</b> (+ .eletjelek, .eszrevetelek) · <b>#a-nap-gyors</b> · <b>#a-nap-napzaras.1</b> … .6 · <b>#a-nap-napom</b> = <b>#a-nap-nap.2026-09-24</b> (élő nap), <b>.2026-09-24.este</b>, <b>.2026-09-23</b> (lezárt, pontozott), <b>.2026-09-21</b> (kevés adat) · <b>#a-nap-rutin-epites</b> · <b>#a-nap-lanc</b> · <b>#a-nap-szokasok</b> · <b>#a-nap-szokas</b> · <b>#a-nap-szerk</b> · <b>#a-nap-rutin-uj.fw</b>.</p>
<h2>Mi változott, képernyőnként</h2>
<ul>
<li><b>Mai:</b> a csepp a hős egy ítélet-mondattal; alatta a csendes „Nem vagyok jól” link (kímélő módban a Hogy vagy? kártya a cseppet is borostyánra váltja). Három művelet + „Több” (Aktivitás, Chat, Életjelek, Küldetések). Üzemanyag heti oszlopokkal (MacroFactor: a teljesült nap szürke), a makró sorra koppintva a részlet. Heti egyeztetés sor, Életjelek sor, Megfigyelés (a feladó Mezo kristálya), Mai pillanatok.</li>
<li><b>Check-in:</b> nagy szám (2 / 4) + ítélet; a slotok nyitott lista, a kész slotok minden válasza kis mono cellában; a lap maga ugyanaz a lépéssor (10-es skála, fájdalom: Nem/Igen → sziluett + chipek → erősség, sóvárgás: fajták 4-től, „Most csak ennyi”, összegzés, Mentés).</li>
<li><b>Mit táplál:</b> 13 nyitott szakasz, mindegyik elején a felelős csapattag testvérformája (nem Boop).</li>
<li><b>Életjelek:</b> átlag nagy számmal, hat sor sávval — a rendben lévő sáv szürke, csak a mozgás kap színt. A Rend nem koppintható (ahogy élesben).</li>
<li><b>Küldetések:</b> nyitott lista, XP jobbra mono számként, Csere link; kész sor semleges (nincs pipa-ünnep).</li>
<li><b>Rutin:</b> napszak-váltó, nagy szám, és a „lánc-erő” helyett egy csendes <b>28 napos rács</b> (MF habits widget) — nincs sorozat, egy kihagyás egy üres kocka. A pipák, a „Most jön”, a videó-link, a reflektálás lapja, a Napzárás sor és a Rutinok szerkesztése sor mind megvan. A pipa visszajelzése egy halk toast, nem jutalom-kártya.</li>
<li><b>Beszélgetés:</b> három fül pontokkal; az Üzenetek tetején a <b>Heti egyeztetés</b> három, egyenként kihagyható modulban (miért most → mi történt → javaslat; MF). Minden üzenet feladója egy testvérforma (Mezo kristály, Szunya kavics, Mocor bab), a szöveg a hang. Segített / Nem talált → okok; régi üzenetek sorra nyílnak.</li>
<li><b>Gyors:</b> „Mondd el Mezónak” sor + a kilenc művelet rácsban, a lapok (víz, súly, alvás, sport, napló, aktivitás) hajszálvonalas mezőkkel.</li>
<li><b>Napzárás:</b> hat felvonás, a tetején pontsor és Kilépés; az ötödik felvonásból a „sorozat” kikerült (helyette: a 28 napból 24-en ment végig a rutin); a hatodikban a teli csepp zárja a napot.</li>
<li><b>A napom:</b> <b>trend elöl</b> — a hét napjai a pontszámukkal, a mai „élő”. Az élő nap a csepp (3/6 terület) + olvasat + „Most érdemes” sor + hat sor (szürke sáv ha rendben, borostyán ha nyitva), és itt lakik a „Te: 7/10 · App: 64” páros is. A lezárt nap: pontszám nagy számmal, a Mezo-korrekció lenyitható, Mezo jegyzete, a hat terület lenyitható részletekkel, körülmények.</li>
<li><b>Rutin-építés / Lánc / Szokásaid / Szokás / Szerkesztés / Új szokás:</b> minden vezérlő megvan (tegnap-nézet, szerkesztő mód a láncon, szűrő-csempék, erőfeszítés-választók, varázsló lépései, AI javaslat, Új lánc, Horgony lap); a szokás 28 napos előzménye ugyanaz a csendes rács.</li>
</ul>
<h2>Alkalmazott elvek</h2>
<p>Kalap + nyitott listák (egy üveg-hős, alatta dobozmentes szakaszok) · teljesült cél → szürke · sorozat helyett konzisztencia-rács · heti egyeztetés kihagyható modulokban · trend elöl az A napomon · szín = jelentés (borostyán csak ahol figyelem kell) · a csepp csak a napot jelenti (Mai, A napom, Napzárás vége); a csapat testvérformái a feladók.</p>
<h2>Amit nem tudtam átvinni</h2>
<p>A „kalauz” (?) és az értesítés-panel a shell fejlécéé (toast). Az élő prototípus lebegő + gombja (és a napi oldal „Mit írsz be?” demó-lapja) a csepp-keretben nincs — a Logolás művelet és a Gyors oldal viszi. Az „Új ikonok” (#ikonok) lap a check-in 2.0 jóváhagyó lapja volt, itt nem kell. A kímélő-kártya „Tévedés volt” törlés-kérdése a kártyán belül marad, mint élesben.</p>`
});
})();
