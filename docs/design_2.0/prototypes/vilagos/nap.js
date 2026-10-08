/* vilagos/nap.js — Nap domain in the "Világos · élő" look. Built on window.F (see vilagos/README.md).
   Routes = the living prototype's (elo/nap.html), parity source csepp/nap.js:
   mai[.kimelo|.kimelo-lejart] maieste checkin hatasok napom nap.<date>[.este] eletjel kuldetesek[.ures]
   rutin[.reggel|.napkozben|.este] uzenetek[.eletjelek|.eszrevetelek] gyors napzaras.1–6 rutin-epites lanc szokasok szokas szerk rutin-uj.<step>.
   Domain interactions use one attribute: data-n="cmd:arg" (see ACT at the bottom). */
(function(){
const {I,csepp,page,sec,card,head,hero,btn,lk,step,stat,grid,facts,bar,ring,st,note,txt,empty,who,msg,chev,act,register}=F;
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
const scale=(v,n='sc')=>`<div class="np-scale">${Array.from({length:10},(_,i)=>`<button class="${i+1<v?'f':i+1===v?'a':''}" data-n="${n}:${i+1}">${i+1}</button>`).join('')}</div>`;
const ends=(a,b)=>`<div class="np-sl"><span>${a}</span><span>${b}</span></div>`;
const dots=(n,on)=>`<div class="np-dots">${Array.from({length:n},(_,i)=>`<i class="${i<=on?'on':''}"></i>`).join('')}</div>`;
const shH=(title,sub='',backTo='')=>`<div class="np-shh">${backTo?`<button class="fh-ib fh-back" data-sheet="${backTo}" aria-label="Vissza">‹</button>`:''}<div class="g"><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div><button class="fh-ib np-x" data-close aria-label="Bezárás">×</button></div>`;
const saveRow=(l='Mentés',n='save')=>`<div class="np-two" style="margin-top:16px"><button class="btn ghost" data-close>Mégse</button><button class="btn" data-n="${n}">${l}</button></div>`;
const tk=(on,attr,label)=>`<button class="np-tk ${on?'on':''}" aria-label="${label}" ${attr}>${I('i-check')}</button>`;
const hi=ic=>`<span class="np-hi">${I(ic)}</span>`;
const inl=ic=>I(ic,'np-inl');
/* 28 napos csendes rács: pipa · kimaradt · nem volt sor */
const g28=(seed,miss=[],skip=[],n=28)=>`<div class="np-g28">${Array.from({length:n},(_,i)=>`<i class="${skip.includes(i)?'s':miss.includes(i)?'m':((i*7+seed)%10<8)?'p':'m'}"></i>`).join('')}</div>`;

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
  return `${shH('Mi történt?','Kímélő mód · szólj, és a napod hozzád igazodik. Nem kell magyarázkodnod.')}
  <div class="np-opt4">${KMC.map(([id,ic,l])=>`<button class="${p.cat===id?'on':''}" data-n="kmcat:${id}">${I(ic)}<span>${l}</span></button>`).join('')}</div>
  ${c?`${lab('Meddig tarthat?')}<div class="fh-pills">${KMD.map(([id,l])=>chip(l,'kmdur:'+id,p.dur===id)).join('')}</div>`:''}
  <p class="fh-txt" style="margin-top:14px;font-size:13.5px"><b>Amíg tart, az edzés és a sport magától kimarad, és nem számít mulasztásnak.</b> Bármikor befejezheted.</p>
  <button class="btn np-wide" style="margin-top:14px;${c?'':'opacity:.4'}" data-n="kmon" ${c?'':'disabled'}>Kímélő mód bekapcsolása</button>`}
function kmWelcome(){const d=Math.max(1,KM.day-1),few=d<=2;
  return `${shH('Üdv újra!','Kímélő mód vége · jó, hogy jobban vagy. Így folytatjuk:')}
  ${xrow({icon:'t-calendar',title:`${d} nap kiesés`,sub:few?'A programod nem csúszik, onnan folytatod, ahol abbahagytad.':'Onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz.'})}
  ${xrow({icon:'t-dumbbell',title:few?'Az első edzés könnyített':'Az első 2 edzés könnyített',sub:few?'Harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.':'Harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly.'})}
  <button class="btn np-wide" style="margin-top:16px" data-n="kmok">Rendben</button><button class="fh-lk np-ctr" data-n="kmundo">Mégsem vagyok jól</button>`}

/* ── MAI ── */
function obsCard(o,i,all){const done=obsState[o.k];
  return card(head('t-pattern',o.h,all?'Összes':'',all?{go:'uzenetek.eszrevetelek'}:null)+msg('mezo',o.x,o.lbl.toLowerCase())
    +(evOpen[o.k]?note('Miből látom: '+o.ev.join(' · ')):'')
    +(done?acts(`<span class="np-okline">${I('i-check')}Megjegyeztem a válaszod.</span>${lk('Beszéljünk róla',{toast:'Mezo · Chat — előtöltve'})}`)
      :acts(o.acts.map((a,k)=>nb(a,'obs:'+o.k,k?'sm ghost':'sm')).join('')+nl(evOpen[o.k]?'Elrejtem':'Miből látod?','ev:'+o.k))),{i});
}
function mai(arg,evening){
  kmPreset(arg);
  const ok=!KM.on, sl=nowSlot(), d=ndTodayDims(), cs=csepp(ok?'ok':'warn',57,{s:104,val:72,label:'MA'});
  const ckBtn=sl?nb(`${SLOTA[sl.t]} check-in`,'ck:open'):btn('Gyors logolás','gyors');
  const h=evening
    ?(ND.ritual?hero({lbl:'Este · a nap lezárva',verdict:'Letetted a napot.',sub:'Hajnalban megírom, milyen napod volt.',left:cs,acts:btn('A napom','nap.2026-09-24')+lk('Miből áll össze?','eletjel')})
      :hero({lbl:'Este · napzárás',verdict:'Tegyük le a napot.',sub:'Amit megőriznél, és amit elengednél. Kb. 3 perc.',left:cs,
        body:note(`${ndHu(NDT.kcal)} kcal · ${KM.on?'edzés · kímélő mód':`edzés ${NDT.work}/${NDT.workG}`} · check-in ${NDT.ck}/${NDT.ckG} · ${ndDoneCount(d)}/6 terület kész`),
        acts:nb('Napzárás indítása','ritual')+lk('Miből áll össze?','eletjel')}))
    :hero({lbl:'Mai állapot · 4 / 7 jel',verdict:ok?'Ma jó nap egy közepes edzéshez.':'Ma a pihenés a dolgod.',
      sub:ok?'Nyugodt ébredés, 7 ó 40 p alvás. A hét jeledből négy megvan.':'Kímélő mód: az edzés magától kimarad, és nem számít mulasztásnak.',left:cs,
      acts:ckBtn+lk('Miből áll össze?','eletjel')});
  const ckStep=sl?step({time:evening?'20:00':sl.t,icon:'t-checkin',title:`${SLOTA[sl.t]} check-in`,sub:`${ckSteps(sl.t).length} koppintás, kb. fél perc`,now:true,right:nb('Kitöltöm','ck:open','sm')}):'';
  const next=evening
    ?ckStep+step({time:'21:00',icon:'t-moon',title:'Napzárás',sub:ND.ritual?'Megvolt · a nap le van téve':'Hat rövid lépés, kb. 3 perc',right:ND.ritual?st('Kész','ok'):nb('Indítom','ritual','sm ghost')})
      +step({time:'21:45',icon:'t-sleep',title:'Esti rutin',sub:'Lecsendesítés, képernyők le',right:btn('Megnézem','rutin.este','sm ghost')})
    :ckStep+step({time:'18:00',icon:'t-volley',title:'Röpi edzés · BVSC',sub:'90 perc · feladó',right:ok?btn('Megnézem',{dom:'edzes'},'sm ghost'):st('Kimarad','warn')})
      +step({time:'19:30',icon:'t-bowl',title:'Vacsora',sub:'1 040 kcal van még · 72 g fehérje hiányzik',right:btn('Logolom',{dom:'fuel'},'sm ghost')});
  return page('nap',{title:'Ma',sub:'Nap · szerda, október 7.',tab:'mai'},`
  ${h}${kmCard(1)}
  ${sec(1,'Most következik',1)}${card(next,{i:1})}
  ${sec(2,'Mai számok',2)}
  ${card(grid([stat({k:'Kalória',icon:'t-flame',n:'2 060',unit:'/ 3 100',pct:66,s:'1 040 kcal van még',c:'var(--acc)',on:{dom:'fuel'}}),
    stat({k:'Fehérje',icon:'t-meat',n:'148',unit:'/ 220 g',pct:67,s:'72 g hiányzik',c:'var(--protein)',on:{dom:'fuel'}}),
    stat({k:'Alvás',icon:'t-sleep',n:'7 ó 40',unit:'perc',pct:92,s:'a heti átlagod fölött',sCls:'ok',c:'var(--ok)',on:{dom:'en'}}),
    stat({k:'Mozgás',icon:'t-dumbbell',n:'0',unit:'/ 2 alkalom',pct:4,s:ok?'Pull Day még hátravan':'kímélő mód · kimarad',sCls:'warn',c:'var(--warn)',on:{dom:'edzes'}})])
    +`<div class="np-rows">${xrow({icon:'t-macro',title:'A hét üzemanyaga',sub:'napi oszlopok és a három makró',on:{sheet:'uzemanyag'}})}${xrow({icon:'t-heart',title:'Életjelek',sub:'hat jel · a mozgás kér figyelmet',v:'60',on:'eletjel'})}</div>`,{i:2})}
  ${sec(3,'Mezo üzeni',3)}${obsCard(OBS[0],3,true)}
  ${card(xrow({icon:'t-calendar',title:'Heti egyeztetés',sub:'vasárnap · 1 javaslat vár · 3 lépés, kb. 2 perc',right:st('Új','plan')+chev(),on:'uzenetek'}),{i:3})}
  ${sec(4,'Mai napló',4)}
  ${card(step({time:'13:00',icon:'t-bowl',title:'Ebéd',sub:'Csirke · édesburgonya · spenót · 760 kcal',on:{toast:'Fuel · Mai'}})
    +step({time:'10:00',icon:'t-checkin',title:'Délelőtti check-in',sub:'Most csak ennyi · az alap megvan',on:'checkin'})
    +step({time:'09:15',icon:'t-bowl',title:'Reggeli',sub:'Túrós zabkása áfonyával · 420 kcal',on:{toast:'Fuel · Mai'}})
    +step({time:'07:10',icon:'t-checkin',title:'Reggeli check-in',sub:'Nyugodt ébredés, pihenve',on:'checkin'})
    +step({time:'tegnap',icon:'t-bowl',title:'Késői vacsora · 23:35',sub:'Lazac · barna rizs · brokkoli',on:{toast:'Fuel · Mai'}})
    +acts(btn('+ Új bejegyzés','gyors','sm')+btn('Napló',{sheet:'naplopick'},'sm ghost')+lk('Több',{sheet:'tobb'})),{i:4})}
  ${ok?sec(5,'Ha ma más a helyzet',5)+card(xrow({icon:'t-kimelo',title:'Nem vagyok jól',sub:'Kímélő mód: betegség, sérülés vagy utazás idejére',n:'km:open'}),{i:5}):''}`)}
const maieste=()=>mai('',true);

/* ── CHECK-IN (áttekintés) ── */
function checkin(){
  const done=SLOTS.filter(s=>s.st==='done').length, nQ=t=>ckSteps(t).length, cur=nowSlot();
  const ans=s=>ckSteps(s.t).filter((id,i,arr)=>arr.indexOf(id)===i&&id in s.a&&s.a[id]!==null).map(id=>`${ITEMS[id].s} <b>${ckDisp(id,s.a,1)}</b>`).join(' · ');
  return page('nap',{title:'Check-in',sub:`Nap · ${done} / 4 pillanatkép`,back:'mai'},`
  ${hero({lbl:'A nap négy pillanata',verdict:cur?`${cur.st==='now'?`A ${SLOTA[cur.t].toLowerCase()} most esedékes.`:`A következő: ${cur.n.toLowerCase()}, ${cur.t}.`} Fél perc.`:'Mind a négy megvan mára.',
    sub:cur?`${nQ(cur.t)} koppintás. Öt alapkérdés után bármikor kiléphetsz.`:'A válaszaid beépülnek a holnapi napodba.',left:ring(done/4*100,{s:88,val:`${done}/4`,label:'kész'}),
    acts:cur?nb('Kitöltöm','ck:open'):btn('Vissza a mai napra','mai')})}
  ${sec(1,'Mai pillanatképek',1)}
  ${card(SLOTS.map(s=>s.st==='done'
    ?step({time:s.t,icon:'t-tick',title:s.n,sub:[s.note,s.quick?'Most csak ennyi · az alap megvan':'',ans(s)].filter(Boolean).join('<br>'),right:st('Kész','ok')})
    :s===cur?step({time:s.t,icon:'t-checkin',title:`${s.n} · ${s.st==='now'?'most esedékes':'következik'}`,sub:`hogy vagy most? · ${nQ(s.t)} koppintás, kb. fél perc`,now:true,right:nb('Kitöltöm','ckslot:'+s.t,'sm')})
    :step({time:s.t,icon:'t-clock',title:s.n,sub:`később esedékes · ${nQ(s.t)} kérdés`,right:st('Később')})).join('')
    +note('A kimaradt check-in nem vész el: pótold bármikor.'),{i:1})}
  ${sec(2,'Mire jó ez?',2)}
  ${card(xrow({icon:'t-orb',title:'Mit táplál az új check-in?',sub:'ahol a válaszaidat észre fogod venni',on:'hatasok'})
    +xrow({icon:'t-day',title:'A napod · Te: 7/10',sub:'a te ítéleted az app pontszáma mellett',on:'napom'}),{i:2})}
  ${sec(3,'Próbáld ki bármelyik napszakot',3)}
  ${card(`<div class="fh-pills">${Object.keys(PLAN).map(t=>chip(`${SLOTN[t]} · ${nQ(t)}`,'ckslot:'+t)).join('')}</div>`+note('Csak ebben a mintában: így bármelyik napszak kérdéssora megnézhető.'),{i:3})}`);
}
/* a check-in lap (lépésenként) */
function ckSheet(){const S=ckSteps(),s=ck.step,slot=ck.slot,sn=SLOTN[slot],a=ck.a;
  const hd=shH('Hogy vagy?',`Check-in · ${sn} · ${slot}`)+dots(S.length+1,s);
  if(s<S.length){const id=S[s],it=ITEMS[id],isAd=s===S.length-1;
    const lbl=lab(`${pad2(s+1)} / ${pad2(S.length)} · ${it.n}${s<5?' · alap':isAd?' · a nap kérdése':' · '+sn}`);
    const adv=isAd?`<p class="fh-note" style="margin-top:0">${ADAPT[slot].why}</p>`:'';
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
      body=`<div class="np-bigrow">${hi(it.ic)}<span class="fh-big">${cv||'–'}<small>/ 10</small></span></div>${scale(cv||0,'cks')}${ends(it.lo,it.hi)}`;
      if(it.kind==='craving'&&cv>=4){const k=a.craving.kinds;
        body+=`${lab('Mit kívánsz?')}<div class="fh-pills">${KINDS.map(x=>chip(x,'ckkind:'+x,k.includes(x))).join('')}</div><button class="btn np-wide" style="margin-top:14px" data-n="ckstep:${s+1}">Tovább</button>`}}
    const coremsg=s===5?`<p class="np-okline" style="margin-top:12px">${I('i-check')}Az alap megvan. Innen bármikor kiléphetsz.</p>`:'';
    return `${hd}${lbl}${adv}<p class="np-q">${it.q}</p>${body}${coremsg}
    <div class="np-nav">${s?nl('‹ Vissza','ckstep:'+(s-1)):'<span></span>'}${s>=5?nl('Most csak ennyi','ckquick'):''}${nl('Kihagyom ›','ckskip')}</div>`}
  return `${hd}${lab('Megvan · összegzés')}<p class="np-q">Bármi még, amit szeretnél?</p>
    ${ck.quick?`<p class="fh-note" style="margin:0 0 10px">Most csak ennyi: az alap megvan. A többi kérdés üres marad, a check-in így is beszámít.</p>`:''}
    <div class="np-sum">${S.map((id,i)=>{const it=ITEMS[id],d=ckDisp(id,a);return xrow({icon:it.ic,title:it.n+(i===S.length-1?' · a nap kérdése':''),v:d===null?'üres':d==='—'?'kihagyva':d,n:'ckstep:'+i,right:' '})}).join('')}</div>
    ${lab('Gondolatok · opcionális')}${area('pl. „tegnap röpi után még izomláz”','Tegnap röpi után még izomlázam van, és délután nehéz meeting jön.')}
    <button class="btn np-wide" style="margin-top:16px" data-n="cksave">Mentés · ${slot}</button>`;
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
  const G=[['A csapat hangja',[0,1,7]],['Edzés, étel, alvás',[2,3,4,5]],['Minták és célok',[6,8,9]],['A napod képe',[10,11,12]]];
  const one=(i,open)=>{const [w,t,sub,say,from,a,link]=C[i];
    return `<details class="np-d" ${open?'open':''}><summary>${who(w,34)}<span class="g"><strong>${t}</strong><small>${sub}</small></span>${chev()}</summary>
      <div class="np-db">${say.map(x=>`<p class="fh-txt np-say">${x}</p>`).join('')}${note('Miből: '+from.join(' · '))}
      ${a||link?acts((a?btn(a,{toast:'Rendben — a mintában itt megáll.'},'sm ghost'):'')+(link?lk('Megnézem',link):'')):''}</div></details>`};
  return page('nap',{title:'Mit táplál?',sub:'Check-in · 13 terület',back:'checkin'},`
  ${hero({lbl:'Check-in 2.0 · minta',verdict:`A válaszaid ${C.length} helyen jelennek meg.`,sub:'Mindegyik területnél példák: itt veszed majd észre, amit a check-inben megadsz.',art:'t-orb',acts:nb('Kitöltöm a check-int','ck:open')})}
  ${G.map(([t,idx],g)=>sec(g+1,t,g+1)+card(idx.map((i,k)=>one(i,g===0&&k===0)).join(''),{i:g+1})).join('')}
  <p class="fh-note np-out">Üres válasz sehol nem számít: amit kihagysz, azt semmi nem veszi „közepesnek”.</p>`);
}

/* ── ÉLETJELEK ── */
const needAct=a=>a==='water'?{on:{toast:'+250 ml víz — rögzítve'}}:a==='sleep'?{on:{sheet:'sleep'}}:a==='checkin'?{n:'ck:open'}:a==='meal'?{on:{toast:'Fuel · Logolás'}}:a==='train'?{on:{toast:'Edzés · Mai'}}:{};
const needSub=a=>a==='water'?'koppintás: +250 ml':a==='sleep'?'koppintás: alvás rögzítése':a==='checkin'?'koppintás: a következő check-in':a==='meal'?'koppintás: étkezés logolása':a==='train'?'koppintás: Edzés':'magától töltődik a rutinból';
const needAvg=()=>Math.round(NEEDS.reduce((a,n)=>a+n[2],0)/NEEDS.length);
function eletjel(){
  return page('nap',{title:'Életjelek',sub:'Nap · a hat jel',back:'mai'},`
  ${hero({lbl:'A hat jel átlaga',verdict:'Egy jel kér figyelmet: a mozgás.',sub:'A többi öt rendben van. Egy rövid séta már megmozdítja.',left:ring(needAvg(),{s:88,val:needAvg(),label:'átlag',c:'var(--dom)'}),acts:btn('Edzés megnyitása',{toast:'Edzés · Mai'})})}
  ${sec(1,'A hat jel',1)}
  ${card(NEEDS.map(([l,ic,p,a])=>xrow({icon:ic,title:l,sub:needSub(a),v:p,more:bar(p,p<40?'var(--warn)':'var(--faint)'),right:a?'':' ',...needAct(a)})).join('')
    +note('A sáv szürke, ha a jel rendben van; színt csak az kap, ami figyelmet kér. Koppints egy jelre a logolásához.'),{i:1})}`);
}

/* ── KÜLDETÉSEK ── */
function kuldetesek(arg){const none=arg==='ures', done=QUESTS.filter(q=>q.st==='done').length, open=QUESTS.find(q=>q.st!=='done'&&q.cta);
  return page('nap',{title:'Napi küldetések',sub:'Nap · ajánlatok mára',back:'mai'},none?`
  ${hero({lbl:'Mai ajánlatok',verdict:'Ma nincs kisorsolt küldetés.',sub:'Holnap reggel új ajánlatok érkeznek. Addig a napod a szokott rendben megy.',art:'t-quest',acts:btn('Vissza a mai napra','mai')})}
  ${sec(1,'Mai ajánlatok',1)}${card(empty('t-quest','Nincs mára küldetés.'),{i:1})}
  <p class="fh-note np-out">A küldetés ajánlat: ha kimarad, csendben lejár, bukás nincs. A Csere naponta egyszer ingyenes.</p>`:`
  ${hero({lbl:'Mai ajánlatok',verdict:`${done} kész a ${QUESTS.length} ajánlatból.`,sub:'A többi magától záródik, ahogy a napod halad.',left:ring(done/QUESTS.length*100,{s:88,val:`${done}/${QUESTS.length}`,label:'kész'}),acts:open?btn(open.cta+' megnyitása',{toast:open.cta+' · Mai'}):''})}
  ${sec(1,'Mai ajánlatok',1)}
  ${card(QUESTS.map((q,i)=>xrow({icon:q.ic,title:q.t,sub:(q.why?q.why+'<br>':'')+(q.st==='done'?`kész · +${q.xp} XP jóváírva`:q.foot),
    more:q.st==='done'||!rerolls?'':`<span class="np-inacts">${nl(`Csere · ${rerolls} maradt`,'reroll:'+i)}</span>`,right:q.st==='done'?st('Kész','ok'):st(`+${q.xp} XP`,'plan')})).join(''),{i:1})}
  <p class="fh-note np-out">A küldetés ajánlat: ha kimarad, csendben lejár, bukás nincs. A Csere naponta egyszer ingyenes.</p>`);
}

/* ── RUTIN ── */
const rowAttr=(r,i)=>r[6]==='reflect'?'data-sheet="reflect"':r[6]==='ritual'?'data-go="napzaras.1"':`data-n="tick:${i}"`;
function rutin(arg){ if(arg&&RUTIN[arg])face=arg;
  const R=RUTIN[face], done=R.rows.filter(r=>r[4]).length, strs=R.rows.filter(r=>r[3]!=null);
  const avg=Math.round(strs.reduce((a,r)=>a+r[3],0)/strs.length);
  const nx=nowRow>=0&&R.rows[nowRow]&&!R.rows[nowRow][4]?nowRow:R.rows.findIndex(r=>!r[4]), all=nx<0;
  return page('nap',{title:'Rutin',sub:'Nap · ma, szerda',tab:'rutin'},`
  <div class="np-pre rise"><div class="fh-seg">${[['reggel','Reggel'],['napkozben','Napközben'],['este','Este']].map(([k,l])=>`<button class="${k===face?'on':''}" data-n="face:${k}">${l}</button>`).join('')}</div></div>
  ${hero({lbl:R.title,verdict:all?'Mind megvan. Szép munka.':`Most jön: ${R.rows[nx][0]}.`,sub:all?'Holnap ugyanitt folytatódik.':`${done} megvan a ${R.rows.length} lépésből · ${R.rows[nx][1]}`,
    left:ring(done/R.rows.length*100,{s:88,val:`${done}/${R.rows.length}`,label:'kész'}),
    acts:(all?'':`<button class="btn" ${rowAttr(R.rows[nx],nx)}>${R.rows[nx][6]==='reflect'?'Válaszolok':R.rows[nx][6]==='ritual'?'Napzárás indítása':'Megvan, pipálom'}</button>`)
      +lk('‹ Tegnap',{toast:'Tegnap — csak a kézi, kimaradt elemek pipálhatók'})+`<span class="fh-lk" style="opacity:.35">Holnap ›</span>`},1)}
  ${sec(1,'A lánc sorrendben',2)}
  ${card(R.rows.map((r,i)=>{const [n,s,ic,str,dn,link]=r;return xrow({cls:(dn?'done ':'')+(i===nx?'now':''),left:tk(dn,rowAttr(r,i),n),icon:ic,
    title:link?`<button class="np-tl" data-toast="Megnyitom a videót">${n}</button>`:n,sub:(i===nx?'<b class="np-now">Most jön</b> · ':'')+s,v:str!=null?str+'<small>%</small>':null})}).join(''),{i:2})}
  ${sec(2,'Az utolsó 28 nap',3)}
  ${card(facts([[R.stat[0],R.stat[1]],[`${Math.round(avg/100*28)}/28`,'napon végigment'],[`+${R.xp}`,'XP ma']])+g28(face==='este'?3:1)+note('Egy kocka egy nap. Egy kihagyás nem nulláz, csak egy üres kocka. A sor végén a szám a szokás 28 napos ereje.'),{i:3})}
  ${sec(3,'Szerkesztés',4)}
  ${card(xrow({icon:'t-chain',title:'Rutinok szerkesztése',sub:'láncok, szokások, új szokás',on:'rutin-epites'}),{i:4})}`);
}

/* ── BESZÉLGETÉS (Mezo · ma) ── */
const WK=[['Miért most?','Vasárnap van, és egy hét adata gyűlt össze: 5 edzés, 19 étkezés, 24 check-in.'],['Mi történt?','A fehérje átlag 162 g lett a 220 g-os célból. Az alvás 7 ó 10 p átlag, kedd és szerda rövid.'],['Javaslat','A fehérjecél 200 g-ra igazítása: reálisabb, és a testsúly-trend így is tartja az irányt.']];
function uzenetek(tab){ tab=tab||'uzenetek';
  const TABS=[['uzenetek','Üzenetek',1],['eletjelek','Életjelek',1],['eszrevetelek','Észrevételek',0]];
  let body='';
  if(tab==='uzenetek') body=`
    ${wkRes?hero({lbl:'Heti egyeztetés · kész',verdict:wkRes==='ok'?'Elfogadtad: a fehérjecél 200 g.':'Ezt most kihagytad. Marad minden.',sub:'Jövő vasárnap újra összeülünk.',left:who('mezo',64),acts:btn('Beszélgess Mezóval',{toast:'Mezo · Chat'})},1)
      :hero({lbl:`Heti egyeztetés · ${wkStep+1} / 3`,verdict:WK[wkStep][0],sub:WK[wkStep][1],left:who('mezo',64),body:dots(3,wkStep),
        acts:wkStep<2?nb('Tovább','wk:next')+nl('Ezt kihagyom','wk:skip'):nb('Elfogadom','wk:accept')+nl('Marad a 220 g','wk:skip')},1)}
    ${sec(1,'Ma reggel',2)}
    ${card(msg('mezo','Jó reggelt — Week 3, Day 4, és érzed a tempót. Tegnap Push Day-en a Lat Pulldown 105 kg × 9 ment RIR 1-re, ma a hátad pihen.<br><br>Az alvásod 7,4 óra volt, a reggeli check-in nyugodt. Ma délben érdemes a fehérjét előrehozni.','06:30 · reggeli briefing')
      +note('<b>Amire épült:</b> Push Day · tegnap · Chest Row 105,8 · márc 4 · késő szénhidrát ↔ alvás<br><b>Miből gondolom:</b> 7,4 óra alvás, 2 ébredés · reggeli check-in: energia 7/10')
      +acts(`<span class="np-ask">Segített?</span>${btn('Segített',{toast:'Köszönöm — ezt megjegyzem'},'sm ghost')}${nb('Nem talált','fbno','sm ghost')}`)
      +(fbNo?`<div class="fh-pills" style="margin-top:10px">${['pontatlan','túl sok','rossz időzítés','nem rólam szól'].map(r=>`<button class="fh-pill" data-toast="Köszönöm, finomítok">${r}</button>`).join('')}</div>`:''),{i:2})}
    ${sec(2,'Korábbi üzenetek',3)}
    ${card([['szunya','Tegnap 21:48 · esti visszanézés','Szép nap volt: 3 szokás, 2 check-in és egy erős edzés.'],['mocor','Tegnap 14:10 · délutáni jelzés','Alacsony az energiád — egy rövid séta többet ad, mint a harmadik kávé.']].map(([w,h,p],i)=>
      expMsg[i]?`<div class="fh-row">${msg(w,p,h)}</div>`:xrow({left:who(w,36),title:F.TEAM[w][0],sub:h,n:'exp:'+i})).join(''),{i:3})}
    ${sec(3,'Írj vissza',4)}
    ${card(xrow({left:who('mezo',36),title:'Beszélgess Mezóval',sub:'kérdezz, mesélj, vagy beszéljük át a napot',on:{toast:'Mezo · Chat'}}),{i:4})}`;
  if(tab==='eletjelek') body=`
    ${hero({lbl:'Életjelek · ma',verdict:'A mozgás az egyetlen, ami figyelmet kér.',sub:'A többi öt jel rendben van.',left:ring(needAvg(),{s:88,val:needAvg(),label:'átlag'}),acts:btn('Részletek','eletjel')},1)}
    ${sec(1,'A hat jel',2)}
    ${card(`<div class="np-ej">${NEEDS.map(([l,ic,p])=>`<button class="${p<40?'warn':''}" data-go="eletjel">${I(ic)}<b>${p}</b><small>${l}</small></button>`).join('')}</div>`+note('Koppints bármelyikre a részletekért.'),{i:2})}
    ${sec(2,'Amit a csapat mond',3)}
    ${card(msg('mocor','Ma még alig mozdultál. Egy 10 perces séta ebéd után elég, hogy a jel megmozduljon. Nem kell edzés.','mozgás · 34')+acts(btn('Megnézem',{toast:'Edzés · Mai'},'sm ghost')),{i:3})}`;
  if(tab==='eszrevetelek'){const left=OBS.filter(o=>!obsState[o.k]).length; body=`
    ${hero({lbl:'Észrevételek · ma',verdict:left?`${left===2?'Két':'Egy'} észrevétel vár a válaszodra.`:'Mindkettőre válaszoltál. Köszönöm.',sub:'Ma még 2 észrevétel fér a keretbe · 22:00 után csendben maradok.',left:who('mezo',64),acts:btn('Beszéljük meg',{toast:'Mezo · Chat'})},1)}
    ${OBS.map((o,i)=>sec(i+1,o.lbl,i+2)+obsCard(o,i+2,false)).join('')}`}
  return page('nap',{title:'Beszélgetés',sub:'Mezo · ma · 4 üzenet',tab:'uzenetek'},`
  <div class="np-pre rise"><div class="fh-seg">${TABS.map(([k,l,d])=>`<button class="${k===tab?'on':''}" data-go="uzenetek${k==='uzenetek'?'':'.'+k}">${l}${d&&k!==tab?'<i class="np-dot"></i>':''}</button>`).join('')}</div></div>${body}`);
}

/* ── GYORS LOGOLÁS ── */
const QT=[['Étkezés','t-bowl','data-toast="Fuel · Logolás"'],['Víz','t-water','data-sheet="water"'],['Stack','t-supps','data-toast="Fuel · Kiegészítők"'],['Edzés','t-dumbbell','data-toast="Edzés · Mai"'],['Sport','t-volley','data-sheet="sport"'],['Súly','t-weight','data-sheet="weight"'],['Check-in','t-checkin','data-n="ck:open"'],['Napló','t-journal','data-sheet="naplopick"'],['Alvás','t-sleep','data-sheet="sleep"']];
function gyors(){return page('nap',{title:'Gyors logolás',sub:'Nap · új bejegyzés',back:'mai'},`
  ${hero({lbl:'Mi érkezett?',verdict:'Egy pillanat, és a napod része.',sub:'Mondd el szóban: kérdezz, mesélj, vagy logolj. Mezo beírja helyetted.',left:who('mezo',64),acts:btn('Mondd el Mezónak',{toast:'Mezo · Chat'})})}
  ${sec(1,'Vagy válassz',1)}
  ${card(`<div class="np-qg">${QT.map(([l,ic,a])=>`<button ${a}>${I(ic)}<span>${l}</span></button>`).join('')}</div>`,{i:1})}`)}

/* ── NAPZÁRÁS (6 lépés, teljes képernyő) ── */
function napzaras(arg){const a=Math.min(6,Math.max(1,+arg||1));
  const NAME=['Indulás','A napod íve','A szavaid','Nyitott hurkok','A mai termés','Lezárva'];
  const foot=(l='Tovább',extra='')=>a<6?`${extra}<button class="btn" style="flex:1" data-go="napzaras.${a+1}">${l}</button>`:`<button class="btn" style="flex:1" data-go="rutin.este">Esti rutin indítása</button>`;
  const A={
    1:[hero({lbl:'Napzárás',verdict:'A nap véget ért.',sub:'Zárjuk le együtt. Kb. 3 perc.',art:'t-moon',big:true})
      +sec(1,'Ez jön',1)+card(NAME.slice(1).map((n,i)=>step({time:i+2+'.',icon:['t-trend','t-journal','t-ring','t-harvest','t-sleep'][i],title:n,sub:['hogyan telt a mai nap','ami megmaradna belőle','amit még le lehet zárni','amit ma összegyűjtöttél','és jöhet az este'][i]})).join(''),{i:1}),foot('Kezdjük')],
    2:[hero({lbl:'A napod íve',verdict:'Így telt a mai nap.',sub:'Három pont megvan, az este még előtted.',
        body:`<svg class="np-arc" viewBox="0 0 320 120"><path d="M10 104 Q160 -30 310 104" fill="none" stroke="var(--hair)" stroke-width="3"/><path d="M10 104 Q160 -30 310 104" fill="none" stroke="var(--dom)" stroke-width="3" stroke-linecap="round" stroke-dasharray="300 999"/>${[[38,68],[104,28],[172,20]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="6" fill="var(--dom)"/>`).join('')}<circle cx="250" cy="42" r="6" fill="#fff" stroke="var(--faint)" stroke-width="2" stroke-dasharray="3 3"/><text x="10" y="118" fill="var(--faint)" font-size="11">reggel</text><text x="286" y="118" fill="var(--faint)" font-size="11">este</text></svg>`})
      +sec(1,'A nap számai',1)+card([['t-dumbbell','Push Day','kész'],['t-bowl','3 étkezés','112 g fehérje'],['t-sleep','Alvás','7,4 óra'],['t-checkin','Check-in','3 / 4']].map(([ic,l,m])=>xrow({icon:ic,title:l,v:m})).join(''),{i:1}),foot()],
    3:[hero({lbl:'Ma milyen volt',verdict:'Milyen volt a napod valójában?',sub:'Az esti check-inben <b>7/10</b>-re értékelted a napot. Ide már csak a szavaid kellenek.',art:'t-journal'})
      +sec(1,'A szavaid',1)+card(area('Írd le, ahogy volt — senki más nem olvassa…','Ma nyugodtabb voltam, mint tegnap, a délutáni séta sokat segített.'),{i:1})
      +sec(2,'Amiért hálás vagy',2)+card([['1. dolog, amiért hálás vagy…','A reggeli kávé a teraszon.'],['2. dolog…','Anyával beszéltem telefonon.'],['3. dolog…','Végre jól aludtam.']].map(([p,s],i)=>`<div ${i?'style="margin-top:8px"':''}>${inp(p,s)}</div>`).join('')+note('Legfeljebb három, és nem kötelező.'),{i:2}),
      foot('Tovább',btn('Ma nem írok','napzaras.4','ghost'))],
    4:[hero({lbl:'Nyitott hurkok',verdict:'Zárd le, ami még nyitva.',sub:'Aztán elengedheted.',art:'t-ring'})
      +sec(1,'Három apróság',1)+card(xrow({icon:'t-checkin',title:'20:00 check-in kimaradt',sub:'3 / 4 check-in kész',right:nb('Kitöltöm','ckslot:20:00','sm')})
        +xrow({icon:'t-ring',title:'Szándékkal élted a napot?',sub:'a mai szándékod: „nyugodt tempó”',more:`<span class="fh-pills np-inacts">${['Igen','Részben','Nem'].map(x=>`<button class="fh-pill" data-n="pick:A mai szándékodra reflektáltál.">${x}</button>`).join('')}</span>`})
        +xrow({icon:'t-journal',title:'Történt még valami ma?',sub:'egy apró lépés is számít',right:btn('Napló',{sheet:'activity'},'sm ghost')}),{i:1}),foot()],
    5:[hero({lbl:'A mai termés',verdict:'+185 XP',big:true,sub:'Ennyit gyűjtöttél ma, hat forrásból.',art:'t-harvest'})
      +sec(1,'Miből jött össze',1)+card([['t-quest','Küldetések',40],['t-chain','Rutin',25],['t-journal','Napló',15],['t-dumbbell','Edzés',80],['t-volley','Sport',25],['t-coin','Érme',12]].map(([ic,l,v])=>xrow({icon:ic,title:l,v:'+'+v})).join(''),{i:1})
      +sec(2,'Hol tartasz',2)+card(xrow({icon:'t-heart',title:'Tudatosság · Lv 4',sub:'a következő szintig',v:'68<small>%</small>',more:bar(68)})+note('A 28 napból 24-en ment végig a rutin · 86 napja használod.'),{i:2}),foot()],
    6:[hero({lbl:'Napzárás · kész',verdict:'A nap le van zárva.',sub:'Elengedheted.',left:csepp('ok',100,{s:96,val:'7/7',label:'KÉSZ',alive:false})})
      +sec(1,'Mezo üzeni',1)+card(msg('mezo','„Ma nem a súlyok voltak nehezek, hanem a délután — és mégis megcsináltad. Aludj rá egyet.”','napzárás'),{i:1})
      +sec(2,'Most jön · alvás-előkészítés',2)+card(step({time:'21:45',icon:'t-sleep',title:'Lecsendesítés',sub:'képernyők le'})+step({time:'22:30',icon:'t-moon',title:'Villanyoltás',sub:'jó éjszakát'}),{i:2}),foot()]};
  return page('nap',{title:'Napzárás',sub:`${a} / 6 · ${NAME[a-1]}`,back:'mai'},`<div class="np-pre rise">${dots(6,a-1)}</div>${A[a][0]}`,{foot:lk('Kilépés','mai')+A[a][1],nonav:true,pad:'120px'});
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
/* trend elöl: a hét napjai pontszámmal, a mai „élő” */
const ndWeek=sel=>`<section class="ds rise">${ND_WEEK.map(([iso,n,d,stt,sc])=>`<button class="${iso===sel?'on':''} ${stt==='fut'?'rest':''}" ${stt==='fut'?'data-toast="Még előtted"':`data-go="nap.${iso}"`}><small>${n}</small><b>${d}</b><i>${sc!=null?sc:stt==='th'?'–':stt==='today'?'élő':'·'}</i></button>`).join('')}</section>`;
const stKind={'kész':'ok','úton':'q','nyitva':'warn'};
function ndDayBody(iso){const [dn,dd]=ND_DAYNAME[iso]||['',''];
  if(iso==='2026-09-24'){const d=ndTodayDims(),[lic,lwhen,lt,ls,lgo]=ndLead();
    return `${hero({lbl:`${dn} · ${dd} · élő, frissült ${NDT.updated}-kor`,verdict:ndReading(),sub:'Napközben nincs pontszám. Hajnali 3-kor zárom a napot, és reggelre megírom, milyen volt.',
        left:csepp('ok',57,{s:96,val:`${ndDoneCount(d)}/6`,label:'TERÜLET'}),acts:lgo==='Napzárás'?nb('Napzárás indítása','ritual'):lgo==='Check-in'?nb('Check-in','ck:open'):btn(lgo+' megnyitása',{toast:lgo+' megnyitása'})},1)}
    ${sec(1,`Most érdemes · ${lwhen}`,2)}${card(step({icon:lic,title:lt,sub:ls,now:true}),{i:2})}
    ${sec(2,'Ma eddig · 6 terület',3)}
    ${card(ND_DIM.map(([k,l,ic])=>{const x=d[k];return xrow({icon:ic,title:`${l} <span class="np-stt">${st(x.st,stKind[x.st])}</span>`,sub:x.v,v:x.big+(x.unit==='%'?'<small>%</small>':''),more:bar(Math.max(2,x.pct),x.st==='nyitva'?'var(--warn)':x.st==='kész'?'var(--ok)':'var(--faint)')})}).join(''),{i:3})}
    ${sec(3,'A napod · te és az app',4)}
    ${card(grid([stat({k:'Az app szerint',n:'64',unit:'/ 100',s:'közepes nap',c:'var(--faint)'}),stat({k:'Szerinted',n:'7',unit:'/ 10',s:'jó nap',sCls:'ok',c:'var(--ok)'})])
      +`<div style="margin-top:14px">${msg('mezo','Az app szerint közepes nap, szerinted jó volt. Kevés volt a fehérje és rövid az alvás, ezért lett közepes a pontszám. A hangulatod viszont egész nap 7 fölött volt — úgy tűnik, ma a délutáni séta többet számított, mint a számok.','összkép')}</div>`
      +note('A 7/10 az esti check-in utolsó kérdéséből jön („Milyen volt a napod összességében?”). A napod többi része nem változik.'),{i:4})}`}
  if(iso==='2026-09-21')return `${hero({lbl:`${dn} · ${dd} · lezárva, hajnali 3:02`,verdict:'Erre a napra kevés az adat.',sub:'Csak egy területről van adat (egy alvás), ezért nem adok pontszámot: kitalálni nem fogok. A hét pontszámába ez a nap nem számít bele.',art:'t-eye',acts:btn('Vissza a mai napra','nap.2026-09-24')},1)}
    ${sec(1,'Amit erről a napról tudunk',2)}
    ${card(ND_DIM.map(([k,l,ic])=>xrow({cls:k==='sleep'?'':'np-dim',icon:ic,title:l,sub:k==='sleep'?'7ó 02p · minőség 6/10':'nincs adat',v:k==='sleep'?'70':'–'})).join(''),{i:2})}`;
  const v=NDY;
  return `${hero({lbl:`${dn} · ${dd} · lezárva, hajnali 3:04`,verdict:v.label+'.',left:ring(v.score,{s:88,val:v.score,label:'pont',c:'var(--ok)'}),
      sub:`alap ${v.base} · a Mezo szerint ${v.corr>0?'+':'−'}${Math.abs(v.corr)}`,
      body:ND.adj?`<p class="fh-txt" style="margin-top:12px;font-size:13.5px">${v.adj}</p>`:'',
      acts:btn('Beszélgess a napról',{toast:'Beszélgetés a napról (Mezo chat)'})+`<button class="fh-lk" data-n="ndadj" aria-expanded="${ND.adj}">${ND.adj?'Elrejtem':'Miért −2?'}</button>`},1)}
    ${sec(1,'Mezo a napodról',2)}
    ${card(msg('mezo',v.prose.join('<br><br>'),'a napodról')+`<div class="np-rows">${v.hl.map(([e,t,ic])=>xrow({icon:ic,title:t,sub:e})).join('')}</div>`
      +acts(`<span class="np-ask">Segített?</span><button class="np-thumb" data-toast="Köszönöm, jegyzem" aria-label="Segített">${I('t-thumb-up')}</button><button class="np-thumb" data-toast="Mi nem talált? (itt jönnének az okok)" aria-label="Nem talált">${I('t-thumb-down')}</button>`),{i:2})}
    ${sec(2,'Miből jött össze',3)}
    ${card(ND_DIM.map(([k,l,ic])=>{const [sc,val]=v.dims[k],o=ND.open.has(k);
      return xrow({icon:ic,title:`${l} <span class="np-w">súly ${v.weight[k]}%</span>`,sub:val,v:sc,n:'nddim:'+k,right:' ',more:bar(sc,sc>=80?'var(--ok)':'var(--faint)')+(o?`<span class="np-open">${v.chips[k].join(' · ')}<br>${v.notes[k]}</span>`:'')})}).join('')+note('Koppints egy területre a részletekért.'),{i:3})}
    ${sec(3,'A nap körülményei',4)}
    ${card(`<div class="np-ctx">${v.ctx.map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>`+note('Ezek nem számítanak a pontba. Ha utólag beírsz még valamit erre a napra, a jegyzetet egyszer újraírom.'),{i:4})}
    ${iso==='2026-09-23'?sec(4,'Reggeli összefoglaló · kész',5)+card(xrow({icon:'t-sun',title:'Tovább a mai napra',sub:'csütörtök · élő nap',on:'nap.2026-09-24'}),{i:5}):''}`}
function napDay(arg){const [iso0,phase]=(arg||'').split('.');const iso=ND_DAYNAME[iso0]?iso0:'2026-09-24';ND.phase=phase==='este'?'evening':'day';
  return page('nap',{title:'A napom',sub:'Nap · szept 21 – 27',tab:'napom'},`${ndWeek(iso)}${ndDayBody(iso)}`)}
const napom=()=>napDay('2026-09-24');

/* ── RUTIN-ÉPÍTÉS ── */
const RE={rutin:'full',lanc:'view'};
let effort=[1,0,1,2], fwPick='fogg', fwRaw='fogg', sklFilter=[true,true,true,false];
const RLIFE=[['Tudatosság','t-heart'],['Szemlélet','t-compass'],['Konyha','t-pot'],['Pénzügyek','t-coin'],['Produktivitás','t-record'],['Tanulás','t-book'],['Kapcsolatok','t-people'],['Regeneráció','t-sprout']];
const CHAIN=[['Ébredés időben','reggel · ébredés',92,'d'],['Reggeli napfény','ébredés után',78,'d'],['50 fekvőtámasz','megvolt a reggeli napfény',48,'now'],['Reggeli videó','fekvőtámasz után',30,''],['Gombakávé','videó után',64,'']];
const recept=(i=3)=>`<p class="np-recept">Miután <b>megvolt a reggeli napfény</b>, ${i>=2?'<b>50 fekvőtámaszt</b> csinálok':'<span class="np-blank"></span>'}, és ünneplésül ${i>=3?'<b>ökölrázás</b>':'<span class="np-blank"></span>'}.</p>`;
const mark=k=>k==='d'?`<span class="np-mk d">${I('i-check')}</span>`:`<span class="np-mk ${k}"></span>`;
function rutinEpites(){const past=RE.rutin==='past',done=RE.rutin==='done',n=past?4:done?7:3;
  const dayNav=past?nl('Ma ›','rst:rutin:full'):nl('‹ Tegnap','rst:rutin:past');
  if(past)return page('nap',{title:'Rutinok',sub:'Rutin · kedd, szept. 22.',back:'rutin'},`
    ${hero({lbl:'Tegnap · kedd',verdict:'Reggel 4 az 5-ből, este mind megvolt.',sub:'A <b>Reggeli videó</b> kimaradt — a lánc másnap folytatódott, nem szakadt meg. +45 XP.',left:ring(n/7*100,{s:88,val:`${n}/7`,label:'tegnap'}),acts:nb('Vissza a mai napra','rst:rutin:full')})}
    ${[['Reggeli lánc','4/5',CHAIN.map(c=>c[0])],['Esti lánc','2/2',['Koffein-cutoff','Konyha zárva']]].map(([nm,c,rows],k)=>sec(k+1,`${nm} · ${c}`,k+1)+card(rows.map((r,i)=>{const miss=i===3&&k===0;return xrow({cls:miss?'np-dim':'',left:mark(miss?'':'d'),title:r,sub:miss?'kimaradt':''})}).join(''),{i:k+1})).join('')}`);
  return page('nap',{title:'Rutinok',sub:'Rutin · szerkesztés · ma, csütörtök',back:'rutin'},`
  ${hero({lbl:done?'Mind megvan':'Következik',verdict:done?'A mai rutin kész.':'50 fekvőtámasz a reggeli napfény után.',sub:`9 tökéletes reggel · 12 tökéletes este a 30 napból · 7 aktív szokás, 2 már magától megy.${done?' Holnap folytatódik.':''}`,
    left:ring(n/7*100,{s:88,val:`${n}/7`,label:'ma'}),acts:btn('Pipálom a Rutin fülön','rutin')+dayNav})}
  ${sec(1,'Amid most van',1)}
  ${card(xrow({icon:'t-dawn',title:'Aktív lánc · reggeli',sub:`${done?5:2} / 5 kész`,more:`<span class="np-chd">${CHAIN.map(c=>`<i class="${done?'d':c[3]}"></i>`).join('')}</span>`,on:'lanc'})
    +xrow({icon:'t-harvest',title:'Szokásaid',sub:'7 aktív · 2 beérett',on:'szokasok'}),{i:1})}
  ${sec(2,'Építs újat',2)}
  ${card(xrow({icon:'t-book',title:'Új szokás',sub:'lépésről lépésre, egy meglévő szokásra ültetve',on:'rutin-uj.fw'})
    +xrow({icon:'t-chain',title:'Új lánc',sub:'egy új napszakra vagy helyzetre',on:{sheet:'chain'}})
    +xrow({icon:'t-spark',title:'AI javaslat',sub:'mondd el, mit szeretnél, Mezo ajánl szokást',on:{sheet:'ai'}})
    +note('Itt építed és szerkeszted a rutint — pipálni a Rutin fülön lehet.'),{i:2})}`);
}
function lanc(){const ed=RE.lanc==='edit';
  return page('nap',{title:'Reggeli lánc',sub:'Rutinok · aktív lánc',back:'rutin-epites'},`
  ${hero({lbl:ed?'Szerkesztés':'Ma eddig',verdict:ed?'Rendezd át, ahogy neked kézre áll.':'2 megvan az 5-ből. Most jön az 50 fekvőtámasz.',sub:'Ébredés időben → Reggeli napfény → 50 fekvőtámasz → Reggeli videó → Gombakávé',
    left:ring(40,{s:88,val:'2/5',label:'kész'}),acts:nb(ed?'Kész':'Szerkesztés','rst:lanc:'+(ed?'view':'edit'))+(ed?'':lk('+ Új szokás ide','rutin-uj.fw'))})}
  ${ed?sec(1,'Név és napszak',1)+card(lab('A lánc neve')+inp('','Reggeli lánc')+lab('Napszak')+chips([['Reggel','t-dawn'],['Nap','t-sun'],['Este','t-moon']],0),{i:1}):''}
  ${sec(ed?2:1,ed?'Sorrend és horgonyok':'A lánc sorrendben',2)}
  ${card(CHAIN.map((c,i)=>xrow({cls:i===3?'np-dim':'',left:mark(c[3]),title:c[0],sub:`${inl(i===4?'t-note':'t-anchor')}${c[1]}`,
      ...(ed?{right:`<span class="np-mv"><button data-toast="Feljebb" aria-label="Feljebb">▲</button><button data-toast="Lejjebb" aria-label="Lejjebb">▼</button></span>`}:{v:c[2]+'<small>%</small>',on:'szokas'})})).join('')
    +(ed?`<p class="fh-note">${inl('t-info')}A sorrend és a horgony nem ugyanazt mondja: a <b>Gombakávé</b> horgonya „videó után”, de előrébb került.</p>`:'')
    +note('A horgony mondja meg, mi után jön a szokás — a sorrend ezt követi.'),{i:2})}
  ${ed?sec(3,'Bővítés és szünet',3)+card(xrow({icon:'t-addex',title:'Új szokás ebbe a láncba',on:'rutin-uj.fw'})+xrow({icon:'t-hold',title:'Lánc szüneteltetése',sub:'a szokások megmaradnak',on:{toast:'Szüneteltetve'}})+note('Az alap reggeli és esti lánc nem törölhető.'),{i:3})
    :sec(2,'Bővítés',3)+card(xrow({icon:'t-addex',title:'Új szokás ebbe a láncba',sub:'a varázsló végigvezet',on:'rutin-uj.fw'}),{i:3})}`);
}
const HAB=[['Ébredés időben','magától megy',142,92,'Beérett',''],['Koffein-cutoff','kezd magától menni',66,78,'~12 ismétlés','3 hét múlva'],['Reggeli napfény','kezd magától menni',51,74,'~20 ismétlés','kb. 4 hét'],['50 fekvőtámasz','épül',24,48,'~41 ismétlés','kb. 7 hét'],['Konyha zárva','épül',18,40,'~46 ismétlés','kb. 8 hét'],['Gombakávé','még tudatos',9,26,'—','még gyűlik az adat'],['Reggeli videó','még tudatos',4,null,'—','még gyűlik az adat']];
const STAGE=['még tudatos','épül','kezd magától menni','magától megy'];
function szokasok(){const vis=HAB.filter(h=>sklFilter[STAGE.indexOf(h[1])]);
  return page('nap',{title:'Szokásaid',sub:'Rutinok · formálódás szerint',back:'rutin-epites'},`
  ${hero({lbl:'7 aktív szokás',verdict:'Egy már magától megy, kettő úton van oda.',sub:'Egy szokás ereje a 28 napos pipáiból jön — nem a sorozatból.',art:'t-harvest',acts:btn('+ Új szokás','rutin-uj.fw')})}
  ${sec(1,'Melyik szakaszt mutassam?',1)}
  ${card(`<div class="np-ft">${STAGE.map((s,i)=>`<button class="${sklFilter[i]?'on':''}" data-n="ft:${i}" aria-pressed="${sklFilter[i]}"><b>${HAB.filter(h=>h[1]===s).length}</b><small>${s}</small></button>`).join('')}</div>`,{i:1})}
  ${sec(2,`Szokások · ${vis.length}`,2)}
  ${card(vis.length?vis.map(h=>xrow({title:h[0],sub:`${h[1]} · ${h[2]} ismétlés · ${h[4]}${h[5]?' · '+h[5]:''}`,v:h[3]!=null?h[3]+'<small>%</small>':'—',more:bar(h[3]||2,h[3]>=70?'var(--ok)':'var(--dom)'),on:'szokas',right:' '})).join('')
    :empty('t-harvest','Ebben a szakaszban most nincs szokásod.'),{i:2})}`);
}
function szokas(){
  return page('nap',{title:'50 fekvőtámasz',sub:'Szokás · Reggeli lánc',back:'rutin-epites'},`
  ${hero({lbl:'28 napos erő · 24 pipa · 5 kihagyás',verdict:'Épül. Még kb. 41 ismétlés, úgy 7 hét.',sub:'A reggeli napfény után a legerősebb — ott szinte sosem marad ki.',left:ring(48,{s:88,val:'48%',label:'erő'}),
    body:`<div class="np-rail">${STAGE.map((s,i)=>`<span class="${i<1?'done':i===1?'on':''}">${s}</span>`).join('')}</div>`,acts:btn('Szerkesztés','szerk')})}
  ${sec(1,'A recepted',1)}${card(recept()+acts(lk('Szerkesztem','szerk')),{i:1})}
  ${sec(2,'Mikor megy a legjobban',2)}
  ${card([['Napszak',82,'reggel 7–8 között','t-clock'],['Horgony',74,'napfény után','t-anchor'],['Ritmus',51,'hétköznap erősebb','t-calendar']].map(r=>xrow({icon:r[3],title:r[0],sub:r[2],v:r[1]+'<small>%</small>',more:bar(r[1])})).join(''),{i:2})}
  ${sec(3,'Előzmény · 29 nap',3)}
  ${card(g28(2,[9,14,20,23,27],[0,1,2,3,4,5],35)+note('Egy kocka egy nap: tele = pipa, üres = kimaradt, halvány = nem volt sor. Csendes rács, nem sorozat.'),{i:3})}`);
}
function effortCard(){const f=['Idő','Fizikai','Fejmunka','Beleillik'],o=[['kevés','közép','sok'],['könnyű','közép','nehéz'],['könnyű','közép','nehéz'],['simán','kicsit','nehezen']];
  return `${f.map((n,i)=>`<div class="np-eff"><span>${n}</span><div class="fh-seg">${o[i].map((t,k)=>`<button class="${effort[i]===k?'on':''}" data-n="eff:${i}:${k}">${t}</button>`).join('')}</div></div>`).join('')}${note('Közepes · +10 XP / alkalom · bármikor újraértékelhető')}`}
function szerk(){
  return page('nap',{title:'Szerkesztés',sub:'Szokás · 50 fekvőtámasz',back:'szokas'},`
  ${hero({lbl:'A recept · együtt változik',verdict:'50 fekvőtámasz',body:recept(),acts:btn('Mentés',{toast:'Mentve'})})}
  ${sec(1,'Keret és horgony',1)}
  ${card(lab('Keret')+xseg(['Szokás-láncolás','Négy törvény'])+`<p class="fh-note" style="margin-top:0">${inl('t-info')}Váltásnál elveszik: az ünneplés.</p>`
    +lab('Miután… · horgony')+xrow({icon:'t-anchor',title:'Reggeli napfény',sub:'74% erő · 28 nap',on:{sheet:'anchor'}}),{i:1})}
  ${sec(2,'A szokás',2)}
  ${card(lab('Cím · a tett')+inp('','50 fekvőtámasz')+lab('Ünneplésül')+inp('','ökölrázás')+lab('Miért')+area('pl. hogy erősebb legyen a vállam','Hogy erősebb legyen a vállam, és ne fájjon a nyakam.',2),{i:2})}
  ${sec(3,'Pipálás és lánc',3)}
  ${card(lab('Hogyan pipálódik?')+xseg(['Kézzel pipálom','Adatból'])+lab('Lánc')+chips(['Reggeli lánc','Esti lánc','Egyik sem'],0),{i:3})}
  ${sec(4,'Mennyibe kerül?',4)}${card(effortCard(),{i:4})}
  ${sec(5,'Szünet vagy törlés',5)}
  ${card(xrow({icon:'t-hold',title:'Szüneteltetés',sub:'a haladás megmarad',on:{toast:'Szüneteltetve'}})+xrow({icon:'t-trash',title:'Szokás törlése',sub:'két koppintás kell hozzá',on:{toast:'Koppints újra a törléshez'}}),{i:5})}`);
}
const WZ={fogg:['fw','anchor','act','celeb'],clear:['fw','cue','crave','act','reward']};
const WT={fw:'Milyen keretre?',anchor:'Mihez horgonyzod?',cue:'Mi a jelzés?',crave:'Miért akarod?',act:'Mi a tett?',celeb:'Hogyan ünnepled?',reward:'Mi a jutalom?'};
const WQ={fw:'Milyen keretre építsük?',anchor:'Mihez horgonyzod?',cue:'Mi a jelzés?',crave:'Miért fogod akarni?',act:'Mi a tett?',celeb:'Hogyan ünnepled?',reward:'Mi teszi kielégítővé?'};
function rutinUj(stp){const steps=WZ[fwPick]||WZ.fogg,i=Math.max(0,steps.indexOf(stp||'fw')),s=steps[i];
  const prevGo=i?`rutin-uj.${steps[i-1]}`:'rutin-epites',last=i===steps.length-1, fwName=fwPick==='clear'?'Négy törvény':'Szokás-láncolás';
  let body='';
  if(s==='fw')body=[['fogg','t-anchor','Szokás-láncolás','BJ Fogg · Tiny Habits','Horgony → Pici tett → Ünneplés'],['clear','t-gem','Négy törvény','James Clear · Atomic Habits','Jelzés → Vágy → Válasz → Jutalom'],['free','t-note','Keret nélkül','csak a tett','']].map(f=>xrow({cls:fwRaw===f[0]?'now':'',icon:f[1],title:f[2],sub:f[3]+(f[4]?'<br>'+f[4]:''),n:'fw:'+f[0],right:fwRaw===f[0]?mark('d'):'<span class="np-mk"></span>'})).join('');
  if(s==='anchor')body=`${lab('A szokásaidból és a Mezo-pillanatokból')}<div class="fh-pills">${[['Ébredés időben','szokás'],['Reggeli napfény','szokás'],['Kávé után','Mezo-pillanat'],['Edzés vége','Mezo-pillanat']].map((a,k)=>chip(`${a[0]} <small>· ${a[1]}</small>`,'pick',k===1)).join('')}</div>${lab('Vagy saját szavakkal')}${inp('pl. miután leteszem a telefont','Miután este leteszem a telefont.')}${note('A jó horgony minden nap biztosan megtörténik, és pontosan tudod, mikor ért véget.')}`;
  if(s==='act')body=`${lab('Én … · a tett')}${inp('','50 fekvőtámaszt csinálok')}<p class="fh-note">${inl('t-scissors')}Ez nagynak tűnik. Mi lenne, ha 5-tel kezdenéd? A pici tett ragad meg.</p>
    ${lab('Melyik láncba?')}${chips(['Reggeli lánc','Esti lánc'],0)}${lab('Életterület')}${chips(RLIFE,7)}
    ${lab('Mennyibe kerül?')}${effortCard()}${lab('Hogyan pipálódik?')}${xseg(['Kézzel pipálom','Adatból'])}`;
  if(s==='celeb')body=`${chips(['ökölrázás','„Igen!”','mosoly a tükörbe','mély levegő'],0)}${lab('Vagy saját')}${inp('pl. egy kis tánc','Egy kis tánc a konyhában.')}${note('Az ünneplés azonnal jöjjön, a tett után — ettől ragad meg az érzés.')}${acts(btn(I('i-check')+'Vállalom',{toast:'Vállalva'},'sm ghost'))}`;
  if(['cue','crave','reward'].includes(s))body=`${lab(s==='cue'?'Jelzés':s==='crave'?'Miért akarod? · vágy':'Jutalom')}${area('…','Amikor felébredek, és még a kezemben van a telefon.',2)}<p class="fh-note">${inl('t-gem')}A négy törvény egy-egy lépése.</p>`;
  return page('nap',{title:WT[s],sub:`Új szokás · ${i+1} / ${steps.length}`,back:prevGo},`
  <div class="np-pre rise">${dots(steps.length,i)}</div>
  ${i?hero({lbl:`${fwName} · épül, ahogy töltöd`,verdict:WQ[s],body:recept(i)},1)
    :hero({lbl:'Új szokás-recept',verdict:WQ[s],sub:'Kezdőknek a szokás-láncolás a legkönnyebb: egy meglévő szokásra ülteted az újat.',art:'t-bulb'},1)}
  ${sec(1,s==='fw'?'Válassz keretet':'Töltsd ki',2)}${card(body,{i:2})}`,
  {nonav:true,pad:'120px',foot:lk('Mégse','rutin-epites')+(i?btn('Vissza',prevGo,'ghost'):'')+`<button class="btn" style="flex:1" ${last?'data-toast="Mentve · vissza a Rutinra"':`data-go="rutin-uj.${steps[i+1]}"`}>${last?'Mentés':'Tovább'}</button>`});
}

/* ── LAPOK (alulról) ── */
const WKB=[['H',[.26,.52,.22],.98,1],['K',[.28,.5,.22],.9,0],['Sze',[.24,.54,.22],1.02,1],['Cs',[.27,.51,.22],.72,0],['P',[.3,.48,.22],.66,0,1],['Szo',null,0,0],['V',null,0,0]];
const SHEETS={
  checkin:()=>{ck={slot:(nowSlot()||SLOTS[2]).t,step:0,a:{},quick:false};return ckSheet()},
  kimelo:()=>{KM.pick={cat:KM.on?KM.cat:null,dur:KM.on?KM.dur:null};return kmSheet()},
  kmwelcome:()=>kmWelcome(),
  uzemanyag:()=>{const m=macroSel!=null?MAC[macroSel]:null;
    return `${shH('A hét üzemanyaga','Fuel · egy oszlop egy nap')}
    <div class="np-bigrow"><span class="fh-big">${m?m[2]:'2 060'}<small>${m?`g ${m[0].toLowerCase()} · ${m[3]-m[2]} g a ${m[3]} g célig`:'/ 3 100 kcal ma · 1 040 van még'}</small></span></div>
    <div class="np-wk">${WKB.map(([l,mm,h,met,t])=>`<div class="${t?'today':''}"><span class="d ${mm?(met?'met':''):'none'}" style="height:${mm?Math.round(h*78):78}%">${mm?`<i style="flex:${mm[0]};background:var(--protein)"></i><i style="flex:${mm[1]};background:var(--carb)"></i><i style="flex:${mm[2]};background:var(--fat)"></i>`:''}</span><small>${l}</small></div>`).join('')}</div>
    ${note('A három szín a három makró. Ha a nap célja megvan, az oszlop elhalványul. A szaggatott vonal a napi keret.')}
    <div class="np-rows">${MAC.map(([n,c,g,goal],k)=>xrow({cls:macroSel===k?'now':'',title:n,v:`${g}<small>/ ${goal} g</small>`,more:bar(Math.round(g/goal*100),c),n:'mac:'+k,right:' '})).join('')}</div>
    ${acts((m?nb('Vissza az összképhez','core','sm ghost'):'')+btn('Fuel megnyitása',{dom:'fuel'},'sm'))}`},
  tobb:()=>`${shH('Több','Mai · ami még ide tartozik')}${xrow({icon:'t-steps',title:'Aktivitás',sub:'amit ma tettél',on:{sheet:'activity'}})}${xrow({icon:'t-chat',title:'Chat',sub:'beszéljük át',on:{toast:'Mezo · Chat'}})}${xrow({icon:'t-heart',title:'Életjelek',sub:'a hat jel',on:'eletjel'})}${xrow({icon:'t-quest',title:'Napi küldetések',sub:'ajánlatok a mai napra',on:'kuldetesek'})}`,
  naplopick:()=>`${shH('Mit naplózol?','Napló','tobb')}<div class="np-qg">${[['Aktivitás','t-steps','activity'],['Napló','t-journal','journal'],['Hála','t-sprout','journal']].map(([l,ic,k])=>`<button data-sheet="${k}">${I(ic)}<span>${l}</span></button>`).join('')}</div>`,
  water:()=>`${shH('Mennyit ittál?','Víz · egy korty szünet.')}<div class="np-bigrow">${hi('t-water')}<span class="fh-big">400<small>ml · ma eddig 1,2 / 2,5 l</small></span></div>${chips(['250 ml','400 ml','500 ml'],1)}${lab('ml kézzel')}${inp('pl. 330')}${saveRow()}`,
  weight:()=>`${shH('Mi a számunk ma?','Gyors rögzítés · egy mérés a napodban.')}<div class="np-bigrow">${hi('t-weight')}<span class="fh-big">82,4<small>kg · tegnap 82,6</small></span></div><div class="fh-pills">${['−0,5','−0,1','+0,1','+0,5'].map(l=>`<button class="fh-pill" data-toast="${l} kg">${l}</button>`).join('')}</div>${lab('Egy mondat · opcionális')}${inp('pl. „vasárnap reggel · folyadékvesztés”','Vasárnap reggel, edzés után mértem.')}${saveRow()}`,
  sleep:()=>`${shH('Hogyan aludtunk?','Gyors rögzítés · az éjszakád, néhány mozdulattal.')}${xseg(['Kézi','Screenshot'])}<div class="np-bigrow">${hi('t-sleep')}<span class="fh-big">7,4<small>óra · 23:10 → 06:35</small></span></div>
    <div class="np-two"><div>${lab('Lefekvés')}${inp('','23:10')}</div><div>${lab('Ébredés')}${inp('','06:35')}</div></div>${lab('Minőség · 7/10')}${scale(7)}
    ${lab('Ébredések éjjel')}${chips(['0','1','2','3','4+'],2)}
    <p class="fh-note">${inl('t-moon')}Az éjjel 2× jártál az éjszakai módban — előtöltöttem.</p>${lab('Ágyban összesen (perc)')}${inp('opcionális')}${saveRow()}`,
  sport:()=>`${shH('Hogy ment?','Sport log · röpi · az idő, a terhelés és a saját élményed.')}${xseg(['Röpi','Cross','TRX'])}
    <div class="np-two"><div>${lab('Idő · perc')}<div class="np-stp"><button data-n="inc:-5" aria-label="Kevesebb">−</button><b>90</b><button data-n="inc:5" aria-label="Több">+</button></div></div><div>${lab('Setek')}<div class="np-stp"><button data-n="inc:-1" aria-label="Kevesebb">−</button><b>5</b><button data-n="inc:1" aria-label="Több">+</button></div></div></div>
    ${lab('RPE · összesített nehézség')}${scale(7)}${lab('Váll terhelés')}${scale(5)}${lab('Jegyzet')}${area('Hogy érezted magad, mi ment jól, mi fájt…','Jól ment a nyitás, de a harmadik szettben már húzott a vállam.',2)}${saveRow()}`,
  journal:()=>`${shH('Mi jár a fejedben?','Gyors rögzítés · a gondolataidnak itt van helye.','naplopick')}${chips(['Napló','Döntés','Hála'],0)}
    <div style="margin-top:12px">${area('Írd le, ami most benned van…','Kicsit feszült vagyok a holnapi megbeszélés miatt, de összeszedtem, mit akarok mondani.',4)}</div>${lab('Dátum')}${inp('','2026. 10. 07.')}${saveRow('Mentem')}`,
  activity:(a)=>a==='done'?`${shH('Megvan!','Tevékenységnapló')}<div class="np-bigrow">${hi('t-coin')}<span class="fh-big">+15<small>XP · Pénzügyek</small></span></div><p class="fh-note">Küldetés teljesítve: Tegyél félre ma (+20 XP)</p><button class="btn np-wide" style="margin-top:16px" data-close>Kész</button>`
    :`${shH('Mi történt ma?','Tevékenységnapló · a kis lépések is a napod részei.','naplopick')}<p class="fh-note" style="margin-top:0">${inl('t-quest')}Mai küldetés: Tegyél félre ma · +20 XP a teljesítésért</p>
    <div style="margin-top:10px">${area('pl. Olvastam 30 percet, átraktam 50 ezret megtakarításba…','Olvastam fél órát, és átraktam ötvenezret a megtakarításba.')}</div>${note('Az AI besorolja, és a megfelelő életterülethez írja az XP-t.')}
    <div class="np-two" style="margin-top:16px"><button class="btn ghost" data-close>Mégse</button><button class="btn" data-sheet="activity" data-arg="done">Naplózom</button></div>`,
  reflect:()=>`${shH('Szándékkal élted a napot?','Rutin · este')}<div class="np-two np-three">${['Igen','Részben','Nem'].map(x=>`<button class="btn ghost" data-n="reflect">${x}</button>`).join('')}</div>`,
  ai:()=>`${shH('Milyen szokás segítene?','AI javaslat')}${lab('Szándék (opcionális)')}${area('pl. jobb esti lezárás','Szeretném, ha este hamarabb letenném a telefont és nyugodtabban zárnám a napot.')}<button class="btn np-wide" style="margin-top:16px" data-toast="Mezo gondolkodik…">${I('t-spark')}Javasolj</button>`,
  chain:()=>`${shH('Új rutin','Rutin · új lánc')}${lab('Név')}${inp('pl. Ebéd utáni szünet','Ebéd utáni szünet')}${lab('Napszak')}${chips([['Reggel','t-dawn'],['Napközben','t-sun'],['Este','t-moon']],0)}<div class="np-two" style="margin-top:16px"><button class="btn ghost" data-close>Mégse</button><button class="btn" data-n="save">Mentés</button></div>`,
  anchor:()=>`${shH('Mihez kötöd?','Horgony')}${lab('A szokásaidból')}${[['Ébredés időben','92% erő · 28 nap',0],['Reggeli napfény','74% erő · 28 nap',1],['Gombakávé','friss szokás',0]].map(o=>`<button class="fh-row" data-close>${mark(o[2]?'d':'')}<span class="g"><strong>${o[0]}</strong><small>${o[1]}</small></span></button>`).join('')}
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
  tick:a=>{const R=RUTIN[face].rows,i=+a;R[i][4]=R[i][4]?0:1;let t='';if(R[i][4]){const d=R.filter(r=>r[4]).length;nowRow=R.findIndex((r,j)=>j>i&&!r[4]);t=d===R.length?`${RUTIN[face].title} · mind megvan`:`Szokás · ${d} / ${R.length}`}soft();if(t)F.toast(t)},
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
`;

register('nap',{title:'Nap',
  tabs:[['Mai','mai'],['A napom','napom'],['Beszélgetés','uzenetek'],['Rutin','rutin']],
  routes:{mai,maieste,checkin,hatasok,napom,eletjel,kuldetesek,rutin,uzenetek,gyors,napzaras,nap:napDay,'rutin-epites':rutinEpites,lanc,szokasok,szokas,szerk,'rutin-uj':rutinUj},
  sheets:SHEETS,
  css:CSS,
  notes:`<h2>Nap</h2>
<p>A Nap mind a négy füle és minden aloldala elkészült ebben a kinézetben. Minden képernyő ugyanúgy olvasható: fent a cím, alatta egy színes kártya egy mondattal és egy gombbal, aztán számozott szakaszok.</p>
<h2>Mit érdemes megkattintani</h2>
<ul>
<li><b>Mai:</b> a fő gomb a check-int nyitja, lépésről lépésre végig lehet menni rajta. A „Miből áll össze?” az Életjelekre visz. Lent a „Nem vagyok jól” a kímélő módot kapcsolja be; utána a tetején megjelenik a „Hogy vagy?” kártya (Jobban · Még nem · Tévedés volt).</li>
<li><b>Mai, este:</b> <b>#e-nap-maieste</b>. Ilyenkor a fő kártya a napzárást kínálja, ami hat rövid, teljes képernyős lépés.</li>
<li><b>A napom:</b> fent a hét napjai. A csütörtök az élő nap, a szerda és a kedd lezárt nap pontszámmal, a hétfő a „kevés adat” eset.</li>
<li><b>Beszélgetés:</b> három nézet (Üzenetek · Életjelek · Észrevételek). Az Üzenetek tetején a heti egyeztetés három lépése.</li>
<li><b>Rutin:</b> Reggel · Napközben · Este. A fő gomb mindig a soron következő lépést pipálja ki. Lent a „Rutinok szerkesztése” visz a láncokhoz, a szokásokhoz és az új szokás varázslójához.</li>
</ul>
<h2>Mi változott a korábbi körhöz képest</h2>
<ul>
<li>Minden oldalon egyetlen fő kártya mondja meg, mi a helyzet és mi a következő lépés.</li>
<li>A Mai oldalon a ritkábban kellő dolgok (a hét üzemanyaga, Életjelek, heti egyeztetés, kímélő mód) egy-egy sorba kerültek, ami lapot vagy aloldalt nyit.</li>
<li>A „Mit táplál a check-in?” tizenhárom területe négy csoportba került, és egyenként nyitható.</li>
<li>A csapat üzenetei mindenhol a feladó formájával jelennek meg (Mezo, Szunya, Mocor, Falat, Derű).</li>
<li>A napzárás és az új szokás varázslója teljes képernyős: alul csak a Tovább és a Kilépés van.</li>
</ul>`
});
})();
