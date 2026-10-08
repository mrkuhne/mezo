/* csepp/fuel.js — Fuel domain (Mai · Kiegészítők · Trendek · Konyha + every inner page and sheet).
   Built on window.K (see csepp/README.md). Route names = the living prototype elo/fuel.html. */
(function(){
const {I,T,page,back,wkBars,register,toast,esc}=K;
const P='.phone[data-v="ajanlott"][data-d="fuel"]';
const fmt=n=>String(n).replace('.',',');
const kc=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');

/* ── adatok (az élő mock alapján, mai nap: szerda, október 7.) ─────────── */
const DAY={eaten:2060,target:3100,p:[148,220],c:[224,380],f:[58,95],fib:[18,30],water:[1.3,2.5],now:'14:10'};
const SLOTS=[{k:'reggeli',l:'Reggeli',ic:'t-sun',from:'07:00',to:'10:00',b:640},{k:'ebed',l:'Ebéd',ic:'t-bowl',from:'12:00',to:'14:30',b:900},{k:'uzsonna',l:'Uzsonna',ic:'t-snack',from:'16:00',to:'17:30',b:420},{k:'vacsora',l:'Vacsora',ic:'t-moon',from:'19:00',to:'21:00',b:840}];
const MEALS={
  reggeli:{slot:'Reggeli',w:0,name:'Túrós zabkása · áfonyával',time:'07:20',kcal:689,score:8.4,macro:[49,74,22],fib:7,glu:0,
    ings:[['Zabpehely · gluténmentes','t-carb','zab','kamra',223,'60 g'],['Túró · félzsíros','t-meat','turo','kamra',325,'250 g'],['Áfonya · fagyasztott','t-fiber',null,'becslés',57,'100 g'],['Akácméz','t-sugar',null,'becslés',84,'25 g']],
    quality:[['Alapanyag-arány','t-processing','100 %'],['Növényféle','t-sprout','3 db']],
    note:'Lassú szénhidrát reggelre, a túró kazeinje délig kitart. Holnap mehet bele egy marék dió a zsírok miatt.',
    headline:'Fehérjében erős, tiszta tányér',lead:'A fehérje és a feldolgozottság viszi. Ezt nyugodtan ismételheted.',cert:98,dims:[8.6,7.6,8.3,8.4,9.1,8.2,8.7,8.5]},
  tizorai:{slot:'Ablakon kívül',w:-1,name:'Whey + banán + mandulavaj',time:'10:05',kcal:356,score:7.2,macro:[36,30,11],fib:3,glu:1,
    ings:[['Impact Whey · csoki','t-supps','whey','kamra',120,'30 g'],['Banán','t-carb',null,'becslés',105,'120 g'],['Mandulavaj · 100%','t-fat','mandula','kamra',131,'20 g']],
    quality:[['Alapanyag-arány','t-processing','67 %'],['Növényféle','t-sprout','2 db']],
    note:'Gyors fehérje edzés után. A banán szénhidrátja most jól jön.',
    headline:'Gyors, célzott, de feldolgozott',lead:'A whey viszi a pontot, a feldolgozottság húzza le.',cert:91,dims:[8.1,6.4,8.8,7.0,5.2,6.1,7.4,8.6]},
  ebed:{slot:'Ebéd',w:1,name:'Csirke + édesburgonya + spenót',time:'12:40',kcal:1015,score:8.1,macro:[63,120,25],fib:8,glu:1,
    ings:[['Csirkemell · friss','t-meat','csirke','kamra',330,'300 g'],['Édesburgonya','t-carb',null,'kamra',344,'400 g'],['Spenót · friss','t-fiber',null,'becslés',46,'200 g'],['Olívaolaj · extra szűz','t-avocado',null,'becslés',295,'33 ml']],
    quality:[['Alapanyag-arány','t-processing','100 %'],['Növényféle','t-sprout','3 db']],
    note:'Edzés utáni ablakba pont jó: sok fehérje, elég szénhidrát a visszatöltéshez.',
    headline:'Kiegyensúlyozott, edzés utánra ideális',lead:'Minden makró a helyén; a zsír is mértékkel.',cert:95,dims:[9.0,7.9,8.1,8.8,8.4,7.8,8.2,8.9]}
};
const DIMS=[['Makró-egyensúly','t-macro',22,'A fehérje–szénhidrát–zsír arány közel van a célarányodhoz.',[['Fehérje aránya','21% · cél 25%'],['Szénhidrát','60% · cél 50%'],['Zsír','19% · cél 25%']]],
  ['Mikrotápanyagok','t-micro',10,'Jó B-vitamin és kálium, kevés D-vitamin és vas.',[['Kálium','jó'],['B1-vitamin','kiváló'],['Vas','kevés']]],
  ['WHO-irányelvek','t-shield',14,'Hozzáadott cukor és só a határ alatt.',[['Hozzáadott cukor','4 g · határ 25 g'],['Só','0,3 g · határ 5 g']]],
  ['Zsírminőség','t-avocado',10,'Főleg telítetlen zsír; a túró adja a telítettet.',[['Telítetlen','72%'],['Telített','28%']]],
  ['Feldolgozottság','t-processing',18,'Minden hozzávaló alapanyag, semmi ultra-feldolgozott.',[['Alapanyag','4 / 4'],['Ultra-feldolgozott','0']]],
  ['Növényi változatosság','t-sprout',8,'3 különböző növény; a heti 30-as célhoz hozzátesz.',[['Ma eddig','9 növény'],['A héten','22 / 30']]],
  ['Energiasűrűség','t-bolt',6,'Laktató, mérsékelt kalóriasűrűség.',[['Energiasűrűség','1,3 kcal/g'],['Rost','7 g']]],
  ['Napi kontextus','t-clock',12,'Jó időben: a reggeli ablak közepén, edzés előtt 4 órával.',[['Ablak','07:00–10:00'],['Edzésig','4 óra']]]];
const CAT={reggeli:['Reggeli','t-sun'],ebed:['Ebéd','t-bowl'],uzsonna:['Snack','t-snack'],vacsora:['Vacsora','t-moon']};
const REC=[
  {id:'r1',n:'Túrós zabkása · áfonyával',cat:'reggeli',serv:1,kcal:689,p:49,c:74,f:22,min:8,role:'Edzés előtt',star:1,logged:12,last:'ma 07:20',score:8.4,nova:1,fits:'Pre Pull Day · T-10h',date:'ápr. 14.'},
  {id:'r2',n:'Csirke + édesburgonya + spenót',cat:'ebed',serv:2,kcal:2030,p:126,c:240,f:50,min:30,role:'',star:1,logged:18,last:'ma 12:40',score:8.1,nova:1,fits:'Edzés után · délben',date:'ápr. 20.'},
  {id:'r3',n:'Lazac + barna rizs + brokkoli',cat:'vacsora',serv:2,kcal:1636,p:98,c:148,f:74,min:23,role:'Edzés után',star:1,logged:24,last:'4 napja',score:7.9,nova:1,fits:'Edzés után · este',date:'máj. 2.'},
  {id:'r6',n:'Túró · áfonya · méz quick',cat:'uzsonna',serv:1,kcal:324,p:36,c:24,f:10,min:2,role:'',star:0,logged:14,last:'tegnap 16:10',score:null,nova:3,fits:'Kazein · esti',date:'máj. 11.'},
  {id:'r4',n:'Whey + banán + mandulavaj',cat:'uzsonna',serv:1,kcal:356,p:36,c:30,f:11,min:2,role:'',star:0,logged:22,last:'ma 10:05',score:7.2,nova:4,fits:'Edzés után · gyors',date:'máj. 15.'},
  {id:'r5',n:'Tojásrántotta · spenóttal',cat:'reggeli',serv:1,kcal:318,p:24,c:4,f:23,min:8,role:'',star:0,logged:8,last:'5 napja',score:7.6,nova:1,fits:'Alacsony szénhidrátú reggel',date:'jún. 3.'}];
const KIND={food:['t-carb','étel'],supp:['t-supps','kiegészítő'],stim:['t-bolt','stimuláns'],med:['t-syringe','gyógyszer']};
const SRC={foto:['t-camera','fotó'],link:['t-link','link'],kat:['t-stack','közös katalógus'],kezi:['t-journal','kézi']};
const KAM=[
  {id:'csirke',n:'Csirkemell · friss',b:'Bonafarm',k:'food',cat:'Fehérje',src:'link',sl:'kifli.hu',when:'máj. 20. · 09:14',kcal:110,p:23,c:0,f:1.5,sug:'0',salt:'0,1',sat:'0,4',nova:'Alapanyag',price:'3 290 Ft/kg',recs:['r2']},
  {id:'turo',n:'Túró · félzsíros',b:'Mizo',k:'food',cat:'Tejtermék',src:'foto',sl:'Fotó',when:'máj. 22. · 18:02',kcal:130,p:18,c:3.5,f:4.5,sug:'3,5',salt:'0,1',sat:'2,9',nova:'Alapanyag',price:'2 180 Ft/kg',recs:['r1','r6']},
  {id:'lazac',n:'Lazacfilé · norvég',b:'Kifli Premium',k:'food',cat:'Hal',src:'link',sl:'kifli.hu',when:'jún. 2. · 07:40',kcal:208,p:20.4,c:0,f:13.4,sug:'0',salt:'0,2',sat:'3,1',nova:'Alapanyag',price:'14 990 Ft/kg',recs:['r3']},
  {id:'zab',n:'Zabpehely · gluténmentes',b:'Naturmind',k:'food',cat:'Gabona',src:'kat',sl:'Közös katalógus · Anna',when:'ápr. 30. · 20:11',kcal:372,p:13,c:59,f:7,sug:'1,1',salt:'0',sat:'1,3',nova:'Alapanyag',price:'1 890 Ft/kg',recs:['r1']},
  {id:'mandula',n:'Mandulavaj · 100%',b:'Nutsi',k:'food',cat:'Mag / olajos',src:'kezi',sl:'Saját bevitel',when:'',kcal:614,p:21,c:7,f:53,sug:'4,4',salt:'0',sat:'4,2',nova:'Konyhai összetevő',price:'',recs:['r4']},
  {id:'whey',n:'Impact Whey · csoki',b:'MyProtein',k:'supp',cat:'Whey / protein',src:'link',sl:'myprotein.hu',when:'máj. 4. · 11:20',dose:'30 g',recs:['r4']},
  {id:'kreatin',n:'Kreatin-monohidrát',b:'MyProtein',k:'supp',cat:'Kiegészítő',src:'link',sl:'myprotein.hu',when:'máj. 4. · 11:22',dose:'5 g',recs:[]},
  {id:'aakg',n:'AAKG · L-arginin',b:'GymBeam',k:'stim',cat:'Stimuláns',src:'foto',sl:'Fotó',when:'jún. 10. · 17:45',dose:'6 g',recs:[]}];
const STACK=[
  {band:'Reggel',ic:'t-dawn',items:[['Kreatin-monohidrát','5 g','Ébredés',1,'07:02'],['Kávé · espresso','80–100 mg','Ébredés',1,'07:05'],['Tasty Dose gombakávé','8 g','Ébredés',1,'07:30'],['Impact Whey Protein','30–40 g','Reggeli',1,'08:10']]},
  {band:'Dél',ic:'t-bowl',items:[['D3 + K2','4000 IU + 100 µg','Ebéd',1,'12:45'],['Omega-3','2 g EPA+DHA','Ebéd',0]]},
  {band:'Délután',ic:'t-sun',items:[['Origin PWO','20 g','Edzés előtt',0]]},
  {band:'Este',ic:'t-moon',items:[['Magnézium-glicinát','300 mg','Este',0]]}];
const WEEK=[['H',2115,2400,'7,8',0],['K',2260,2400,'7,7',1],['Sze',1180,2400,'8,3',0],['Cs',null,2400,null,1],['P',2050,2400,'7,9',0],['Szo',2740,2200,'7,1',0],['V',null,2200,null,0]];

/* ── kis segédek ──────────────────────────────────────────── */
const chev=I('i-chev','chev');
const nav=o=>o.go?`data-go="${o.go}"`:o.sheet?`data-sheet="${o.sheet}"${o.arg!=null?` data-arg="${o.arg}"`:''}`:o.toast?`data-toast="${esc(o.toast)}"`:'';
/* egy sor: ikon · cím/alcím · érték · (sáv) · chevron */
const ln=(ic,title,sub,val,o={})=>`<div class="ln ${o.cls||''}" ${nav(o)}>${o.time?`<time>${o.time}</time>`:''}${ic?(ic.startsWith('i-')?I(ic):T(ic)):''}<span class="g">${title}${sub?`<small>${sub}</small>`:''}</span>${val?`<span class="v">${val}</span>`:''}${o.bar||''}${o.nochev?'':chev}</div>`;
/* makró-sáv: ha a cél megvan, elhallgat (szürke) — MacroFactor */
const mbar=(v,t,c)=>`<div class="bar ${v>=t?'q':''}" ${v>=t?'':`style="--c:${c}"`}><b style="--w:${Math.min(100,Math.round(v/t*100))}%"></b></div>`;
const qbar=(v,t)=>`<div class="bar q"><b style="--w:${Math.min(100,Math.round(v/t*100))}%"></b></div>`;
const macroRows=(p,c,f,fib)=>`<div class="mb">
  <span class="l">Fehérje</span>${mbar(p[0],p[1],'var(--protein)')}<span class="v"><b>${p[0]}</b> / ${p[1]} g</span>
  <span class="l">Szénhidrát</span>${mbar(c[0],c[1],'var(--carb)')}<span class="v"><b>${c[0]}</b> / ${c[1]} g</span>
  <span class="l">Zsír</span>${mbar(f[0],f[1],'var(--fat)')}<span class="v"><b>${f[0]}</b> / ${f[1]} g</span>
  ${fib?`<span class="l">Rost</span>${qbar(fib[0],fib[1])}<span class="v"><b>${fib[0]}</b> / ${fib[1]} g</span>`:''}</div>`;
const seg=(opts,on,pre)=>`<span class="tg2">${opts.map(([l,a])=>`<button class="${a===on?'on':''}" data-go="${pre}${a?'.'+a:''}">${l}</button>`).join('')}</span>`;
const tgl=(opts,on,attr='data-toast')=>`<div class="tgl">${opts.map(([l,n,v])=>`<button class="${l===on?'on':''}" ${attr}="${v||('Szűrő: '+l)}">${l}${n!=null?`<b>${n}</b>`:''}</button>`).join('')}</div>`;
const stp=(v,u,t='Mennyiség')=>`<span class="stp"><button data-toast="${t}: kevesebb">−</button><b>${v}</b><small>${u}</small><button data-toast="${t}: több">+</button></span>`;
const fld=(l,v,o={})=>`<div class="fld"><span class="eb">${l}</span>${o.raw||`<span class="in ${o.ph?'ph':''}" ${o.toast?`data-toast="${esc(o.toast)}"`:''}>${v}</span>`}</div>`;
const sw=(on,label)=>`<button class="sw ${on?'on':''}" role="switch" aria-checked="${on}" aria-label="${label}" data-sw></button>`;
const tk=(on,label)=>`<button class="tk ${on?'on':''}" data-tk aria-label="${label}">${I('i-check')}</button>`;
const sheetH=(ic,eb,title,sub)=>`<div class="shh">${ic?(ic.startsWith('i-')?I(ic):T(ic)):''}<span class="g"><span class="eb">${eb}</span><h2 class="t">${title}</h2>${sub?`<p class="txt sub">${sub}</p>`:''}</span></div>`;
const savebar=(cancelGo,saveLabel,saveToast,o={})=>`<div class="savebar"><button class="lk" data-go="${cancelGo}">Mégse</button><button class="btn" ${o.disabled?'disabled style="opacity:.45"':''} data-toast="${esc(saveToast)}">${saveLabel}</button></div>`;
const fn=t=>`<p class="fn p16">${t}</p>`;
/* a beviteli módok szalagja — minden belépési mód egy koppintásra (MacroFactor) */
const RIB=[['foto','Fotó','t-camera'],['kereses','Keresés','t-basket'],['gyors','Gyors','t-quick'],['diktalas','Diktálás','t-mic'],['recept','Recept','t-book'],['szokasos','Szokásosak','t-repeat']];
const ribbon=on=>`<div class="rib rise" style="--i:2">${RIB.map(([k,l,ic])=>`<button class="${k===on?'on':''}" data-go="log.${k}">${T(ic)}${l}</button>`).join('')}</div>`;

/* ═══ MAI ════════════════════════════════════════════════════ */
function mai(arg){
  if(arg==='tegnap'||arg==='ures') return pastDay(arg==='ures');
  const het=arg==='het', rem=DAY.target-DAY.eaten;
  const hat=het?`<p class="verdict">A hét négy napján a keret körül maradtál.</p>
      <p class="txt sub">Két nap még hátravan. Ahol a nap célja megvan, az oszlop szürke.</p>${wkBars()}
      <div class="act" style="margin-top:8px"><button class="lk" data-go="trendek">Trendek ›</button></div>`
    :`<div class="big"><span class="num">${kc(DAY.eaten)}</span><span class="v">/ ${kc(DAY.target)} kcal · ${kc(rem)} van még</span></div>
      ${macroRows(DAY.p,DAY.c,DAY.f)}
      <div class="act" style="margin-top:10px"><button class="lk" data-sheet="eq">Miből jön össze?<span class="dot"></span></button><button class="lk" data-sheet="water">Víz 1,3 / 2,5 l</button></div>`;
  const rows=[['reggeli',MEALS.reggeli],['tizorai',MEALS.tizorai],['ebed',MEALS.ebed]];
  return page(`
  <div class="sec rise" style="padding-bottom:4px"><span class="eb">Szerda · október 7.</span>${seg([['Ma',''],['Hét','het']],het?'het':'','mai')}</div>
  <section class="card hg rise" style="--i:1">${hat}</section>
  ${ribbon('')}
  <section class="open rise" style="--i:3"><span class="eb">A napod · 3 étkezés</span>
    ${SLOTS.map((s,i)=>{
      const got=rows.filter(([,m])=>m.w===i);
      const extra=i===0?rows.filter(([,m])=>m.w===-1):[];
      const open=DAY.now>=s.from&&DAY.now<=s.to, before=DAY.now<s.from;
      const head=got.length?'':`<div class="ln sm slot" data-go="log.w${i}">${T(s.ic)}<span class="g">${s.l}<small>ajánlott ${s.from}–${s.to} · ${open?'most nyitva':before?`nyílik ${s.from}-kor`:'még pótolható'}</small></span><span class="v">${s.b} kcal</span><span class="lk">Logolás ide</span></div>`;
      return head+got.concat(extra).map(([id,m])=>`<div class="ln" data-go="meal.${id}"><time>${m.time}</time>${T(s.ic)}<span class="g">${m.name}<small>${m.w===-1?'ablakon kívül':s.l} · ${kc(m.kcal)} kcal · <span class="sc">${T('t-score')}${fmt(m.score)}</span></small></span><span class="v"><b>${m.macro[0]}</b> g feh.</span>${chev}</div>`).join('')}).join('')}
    <div class="act" style="margin-top:6px"><button class="lk" data-go="log">Logolj bármit · ablakon kívül is</button><button class="lk" data-sheet="ora">Az étkezési óra</button></div>
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Víz · rost</span>
    ${ln('t-water','Víz','2 pohár maradt a célig','<b>1,3</b> / 2,5 l',{sheet:'water',bar:qbar(1.3,2.5)})}
    ${ln('t-fiber','Rost','a mai étkezésekből','<b>18</b> / 30 g',{toast:'Rost: a kamra-tételekből számolva',bar:qbar(18,30)})}
  </section>
  <section class="open rise" style="--i:5;padding-top:12px;padding-bottom:12px">${ln('i-cal','Heti egyeztetés<span class="dot"></span>','vasárnap · 1 javaslat vár · 3 lépés, kb. 2 perc','',{sheet:'weekly',cls:'first'})}</section>
  <section class="open rise" style="--i:6"><span class="eb">Ez a nap a tanulásban</span>
    <p class="txt">Ez a nap számít a tanulásban. A mai napot jövő hétfőn számolom bele; a jelölést addig is elmentem.</p>
    <div class="act"><button class="lk" data-toast="Hiányosnak jelölve · kihagyom a tanulásból">Hiányos volt</button><button class="lk" data-go="tanulas">Mit jelent ez?</button></div>
  </section>
  <section class="open rise" style="--i:7">
    ${ln('t-history','Tegnap · 2 ablak pótolható','kedd, október 6.','',{go:'mai.tegnap'})}
    ${ln('i-gear','Fuel beállítások','ritmus · makrók · célok · ablakok','',{go:'beallitas'})}
  </section>
  `,'fuel','mai');
}
function pastDay(empty){
  const title=empty?'hétfő, október 5.':'kedd, október 6.';
  const eaten=empty?0:1020, rows=empty?[]:[['Kávé és vajas kifli','09:20',330,'6,1',0],['Gulyásleves','13:10',690,'7,4',1]];
  return page(`
  <div class="dn rise"><button class="ar" ${empty?'disabled style="opacity:.35"':'data-go="mai.ures"'} aria-label="Előző nap">‹</button><span class="lbl"><span class="eb">${empty?'2 nappal ezelőtt':'Tegnap'}</span><b>${title}</b></span><button class="ar" data-go="${empty?'mai.tegnap':'mai'}" aria-label="Következő nap">›</button></div>
  ${empty?`<p class="txt sub p16 rise" style="--i:1;padding-top:12px">Erre a napra nincs adat. Amit most logolsz, erre a napra könyvelődik. A heti átlagból kimarad, nem töltöm ki becsléssel.</p>`
  :`<section class="card hg rise" style="--i:1"><div class="big"><span class="num">${kc(eaten)}</span><span class="v">/ 3 100 kcal · ezen a napon</span></div>${macroRows([70,220],[120,380],[40,95])}</section>`}
  <section class="open rise" style="--i:2"><span class="eb">Ezen a napon · ${rows.length} étkezés</span>
    ${SLOTS.map((s,i)=>{const r=rows[i];return r?`<div class="ln" data-toast="${esc(r[0])} · az étkezés részletei"><time>${r[1]}</time>${T(s.ic)}<span class="g">${r[0]}<small>${s.l} · ${r[2]} kcal · <span class="sc">${T('t-score')}${r[3]}</span></small></span>${chev}</div>`
      :`<div class="ln sm slot" data-go="log.w${i}">${T(s.ic)}<span class="g">${s.l}<small>${s.from}–${s.to} · még pótolható</small></span><span class="v">${s.b} kcal</span><span class="lk">Pótlás</span></div>`}).join('')}
  </section>
  ${empty?'':`<section class="open rise" style="--i:3"><span class="eb">Ez a nap a tanulásban</span><p class="txt">Ez a nap hiányosnak tűnt, kihagytam. Ha mégis teljes volt, mondd, és azonnal újraszámolok.</p>
    <div class="act"><button class="lk" data-toast="Teljesnek jelölve · a keret +20 kcal-lal változott">Teljes volt</button><button class="lk" data-go="tanulas">Mit jelent ez?</button></div></section>`}
  `,'fuel','mai');
}

/* ═══ ÉTKEZÉS · ÉRTÉKELÉS ═════════════════════════════════════ */
function meal(id){
  const m=MEALS[id]||MEALS.reggeli; const [p,c,f]=m.macro; const pct=Math.round(m.kcal/DAY.target*100);
  return page(`${back('Mai','mai')}
  <section class="card hg rise" style="--i:1"><span class="eb">${m.slot} · ${m.time}</span>
    <h1 class="t" style="font-size:22px;margin:4px 0 8px">${m.name}</h1>
    <div class="big"><span class="num">${kc(m.kcal)}</span><span class="v">kcal · a napod ${pct}%-a</span></div>
    <div class="act" style="margin-top:10px"><button class="lk" data-go="score.${id}">Mezo-értékelés ${fmt(m.score)} ›</button><button class="lk" data-sheet="glu" data-arg="${m.glu}">Vércukor · ${m.glu?'közepes':'alacsony'}</button></div>
  </section>
  <section class="open rise" style="--i:2"><span class="eb">Hatás a napra</span>
    <p class="txt sub">Ennyit tett hozzá a napi keretedhez. A sáv a napból ennek az étkezésnek a részét mutatja.</p>
    <div class="mb" style="margin-top:8px">
      <span class="l">Kalória</span>${qbar(m.kcal,DAY.target)}<span class="v"><b>${kc(m.kcal)}</b> / ${kc(DAY.target)}</span>
      <span class="l">Fehérje</span>${qbar(p,DAY.p[1])}<span class="v"><b>${p}</b> / ${DAY.p[1]} g</span>
      <span class="l">Szénhidrát</span>${qbar(c,DAY.c[1])}<span class="v"><b>${c}</b> / ${DAY.c[1]} g</span>
      <span class="l">Zsír</span>${qbar(f,DAY.f[1])}<span class="v"><b>${f}</b> / ${DAY.f[1]} g</span>
      <span class="l">Rost</span>${qbar(m.fib,DAY.fib[1])}<span class="v"><b>${m.fib}</b> / ${DAY.fib[1]} g</span></div>
  </section>
  <section class="open rise" style="--i:3"><span class="eb">Hozzávalók · ${m.ings.length} tétel</span>
    ${m.ings.map(([n,ic,kid,src,k,amt])=>ln(ic,n,`${amt} · ${src}`,`<b>${k}</b> kcal`,kid?{go:'kamra.'+kid}:{toast:n+' · becsült sor, nincs kamra-tétel'}))}
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Minőség</span>
    ${m.quality.map(([l,ic,v])=>ln(ic,l,'',`<b>${v}</b>`,{nochev:true,toast:l}))}
  </section>
  <section class="open rise" style="--i:5"><span class="eb">Mezo jegyzete</span><p class="txt">${m.note}</p>
    <div class="act"><button class="lk" data-toast="Szerkesztés · a naplózó nyílik ezzel az étkezéssel">Javítom ezt az étkezést</button><button class="lk" data-go="muhely.vazlat">Mentsük receptként</button></div>
  </section>
  `,'fuel','mai');
}
function score(id){
  const m=MEALS[id]||MEALS.reggeli; const low=m.dims.indexOf(Math.min(...m.dims));
  return page(`${back(m.name.split(' ·')[0],'meal.'+id)}
  <section class="card hg rise" style="--i:1"><span class="eb">Mezo-értékelés · ${m.slot} · ${m.time}</span>
    <div class="big" style="margin-top:6px"><span class="num">${fmt(m.score)}</span><span class="v">/ 10 · bizonyosság ${m.cert}%</span></div>
    <p class="verdict" style="margin-top:8px">${m.headline}</p><p class="txt sub">${m.lead}</p>
  </section>
  <section class="open rise" style="--i:2"><span class="eb">Miből áll össze? · 8 szempont</span>
    ${DIMS.map(([l,ic,w],i)=>`<div class="ln" data-sheet="dim" data-arg="${id}|${i}">${T(ic)}<span class="g">${l}<small>súly ${w}%${i===low?' · a leggyengébb láncszem':''}</small></span><span class="v"><b>${fmt(m.dims[i])}</b></span><div class="bar q"><b style="--w:${m.dims[i]*10}%"></b></div>${chev}</div>`).join('')}
  </section>
  <section class="open rise" style="--i:3"><span class="eb">Mi emelné még?</span><p class="txt">A mikrotápanyag a leggyengébb láncszem: egy marék tökmag vasat és magnéziumot hozna, és 8,6 fölé tolná az értékelést.</p></section>
  `,'fuel','mai');
}

/* ═══ LOGOLÁS ═══════════════════════════════════════════════════ */
function log(arg){
  arg=arg||'foto'; const fail=arg==='hiba';
  const win=/^w[0-3]$/.test(arg)?SLOTS[+arg[1]]:null; const mode=win?'foto':fail?'foto':arg;
  const lines=arg==='tetelek'||arg==='ido';
  const ctx=win?`${win.l} · ${win.from}–${win.to} · ablak`:'Most · 14:10 · Ebéd-ablak után';
  let body='';
  if(fail) body=`<section class="open rise first" style="--i:3"><span class="eb">Őszintén szólva</span><p class="verdict">Ezt a tányért nem ismertem fel.</p><p class="txt sub">Írd le lent, mit ettél, vagy próbáld meg új fotóval.</p><div class="act"><button class="lk" data-go="log">Új fotót készítek</button></div></section>`;
  else if(mode==='szokasos') body=`<section class="open rise first" style="--i:3"><span class="eb">Ilyenkor szoktál · 14:10 körül</span>
    ${[['Whey + banán + mandulavaj','edzés után · 22× logoltad',356],['Túró · áfonya · méz quick','délután · 14× logoltad',324],['Görög joghurt · dióval','délután · 6× logoltad',290]].map(([n,s,k])=>ln('t-plate',n,s,`<b>${k}</b> kcal`,{go:'log.tetelek'})).join('')}
    <p class="fn">Az idő szerint ajánlom, nem a hét napja szerint. Egy koppintás, aztán jóváhagyod.</p></section>`;
  else if(mode==='kereses') body=`<div class="p16 rise" style="--i:3;padding-top:10px"><div class="srch">${T('t-basket')}<span>zab</span><span style="margin-left:auto;color:var(--sub)">×</span></div></div>
    <section class="open rise" style="--i:4"><span class="eb">A kamrádból</span>
    ${ln('t-carb','Zabpehely · gluténmentes','Naturmind · 372 kcal / 100 g','<b>60</b> g',{toast:'A tányérra tettem: Zabpehely 60 g',nochev:true})}
    ${ln('t-meat','Túró · félzsíros','Mizo · 130 kcal / 100 g','<b>+</b>',{toast:'A tányérra tettem: Túró 150 g',nochev:true})}
    </section>
    <section class="open rise" style="--i:5"><span class="eb">Receptek · szokásosak</span>
    ${ln('t-book','Túrós zabkása · áfonyával','recept · 689 kcal / adag','<b>+</b>',{toast:'A tányérra tettem a receptet',nochev:true})}
    ${ln('t-repeat','Zabkása gyümölccsel','szokásos · 9× logoltad','<b>+</b>',{toast:'A tányérra tettem: Zabkása gyümölccsel',nochev:true})}
    </section>`;
  else if(mode==='gyors') body=`<section class="open rise first" style="--i:3"><span class="eb">Gyors hozzáadás · csak a számok</span>
    ${fld('Név','pl. büfés szendvics',{ph:true,toast:'Név'})}${fld('Kalória','420',{toast:'kcal'})}
    <div class="fld"><span class="eb">Makrók</span><span class="in">23 g feh.</span><span class="in">52 g szénh.</span><span class="in">12 g zsír</span></div>
    <p class="fn">Ha csak a kalóriát tudod, az is elég: a makrók üresen maradnak, nem találgatom.</p></section>`;
  else if(mode==='diktalas') body=`<section class="card hg rise" style="--i:3"><div class="hero-cs" style="gap:14px">${T('t-mic')}<span><p class="verdict" style="margin:0 0 2px">Hallgatlak…</p><p class="txt sub">„Egy csirkés wrap és egy latte volt.”</p></span></div>
    <div class="act"><button class="btn sm" data-go="log.tetelek">Elemzés</button><button class="lk" data-go="log">Mégse</button></div></section>`;
  else if(mode==='recept') body=`<section class="open rise first" style="--i:3"><span class="eb">Receptjeid</span>
    ${REC.slice(0,4).map(r=>ln(CAT[r.cat][1],r.n,`${CAT[r.cat][0]} · ${Math.round(r.kcal/r.serv)} kcal / adag${r.star?' · csillagos':''}`,'',{go:'log.tetelek'})).join('')}</section>`;
  else if(!lines) body=`<div class="p16 rise" style="--i:3;padding-top:10px"><button class="ph" data-toast="Kamera · fotózd le a tányért">${T('t-camera')}<strong>Fotózd le a tányért</strong><small>vagy írd le lent, mit ettél</small></button></div>`;
  const compose=lines?'':`<div class="p16 rise" style="--i:4;padding-top:10px"><div class="cmp"><textarea aria-label="Mit ettél?" placeholder="pl. csirkés wrap és egy latte…"></textarea><button data-toast="Diktálás" aria-label="Diktálás">${T('t-mic')}</button></div>
    <div class="act" style="margin-top:8px"><button class="btn sm" data-go="log.tetelek">Elemzés</button><span class="fn" style="margin:0">Szöveg, hang és fotó egy piszkozatban.</span></div></div>`;
  const conf=lines?`
  <section class="open rise first" style="--i:3"><span class="eb">Tételek · 3</span>
    ${[['Zabpehely','t-carb','kamra',60,'g',223,'8 · 36 · 4'],['Görög joghurt','t-meat','kamra',150,'g',146,'14 · 6 · 8'],['Erdei gyümölcs','t-fiber','becslés',80,'g',51,'1 · 10 · 0']].map(([n,ic,t,a,u,k,m])=>`<div class="ln">${T(ic)}<span class="g">${n}<small>${t} · ${m} g${t==='becslés'?' · nézd át a mennyiséget':''}</small></span>${stp(a,u,n)}<span class="v"><b>${k}</b> kcal</span></div>`).join('')}
    <div class="act" style="margin-top:6px"><button class="lk" data-go="log.kereses">+ Még egy tétel</button></div>
  </section>
  <section class="card hg rise" style="--i:4"><span class="eb">Ez az étkezés</span>
    <p class="verdict">Zabkása joghurttal és gyümölccsel</p>
    <div class="big"><span class="num">420</span><span class="v">kcal · 23 feh. · 52 szénh. · 12 zsír</span></div>
    <div class="mb" style="margin-top:10px"><span class="l">A napból</span>${qbar(DAY.eaten+420,DAY.target)}<span class="v"><b>${kc(DAY.eaten+420)}</b> / ${kc(DAY.target)}</span></div>
    <p class="fn" style="margin-top:6px">${kc(DAY.eaten)} + 420 = ${kc(DAY.eaten+420)} kcal · marad ${kc(DAY.target-DAY.eaten-420)}.</p>
  </section>
  <section class="open rise" style="--i:5">
    <div class="ln first" data-go="log.${arg==='ido'?'tetelek':'ido'}" aria-expanded="${arg==='ido'}">${T('t-clock')}<span class="g">Mikor ettél?<small>Ebéd-ablak után · ${arg==='ido'?'tényleges':'aktuális'} idő</small></span><span class="v"><b>Most · 14:10</b></span>${chev}</div>
    ${arg==='ido'?`<div class="fld"><span class="eb">Időpont</span><input class="in" type="time" value="14:10" aria-label="Evés időpontja"><button class="lk" data-go="log.tetelek">Most</button></div>
    <p class="fn">Az étkezés a megadott idő szerinti ablakba kerül. A mai napra jövőbeli időpontot nem lehet menteni.</p>`:''}
  </section>
  ${savebar('mai','Logolás','Mentve · 14:10 · ablakon kívül')}`:'';
  const plate=mode==='kereses'?`<div class="plate rise" style="--i:2">${T('t-plate')}<span class="g"><strong>Tányér · 2 tétel · 369 kcal</strong><small>23 g fehérje · 42 g szénhidrát · 12 g zsír</small></span><button class="btn sm" data-go="log.tetelek">Tovább</button></div>`:'';
  return page(`${back('Mai','mai')}
  <div class="sec rise" style="padding-top:6px;padding-bottom:0"><span class="eb">${win?'Logolás ide':'Logolás'}</span><span class="eb">${ctx}</span></div>
  ${lines?'':ribbon(mode)}
  ${body}${compose}${conf}
  ${lines||fail?'':`<p class="fn p16 rise" style="--i:5">Alapból a mostani időt írom. Mentés előtt egy sorban átállíthatod; a tétel abba az ablakba kerül, amelyikbe az idő esik.</p>`}
  `+plate,'fuel','mai',{pad:plate?'170px':''});
}

/* ═══ KONYHA ═══════════════════════════════════════════════════ */
function konyha(){
  const food=KAM.filter(k=>k.k==='food').length; const fav=REC.slice().sort((a,b)=>b.logged-a.logged)[0];
  return page(`
  <div class="sec rise" style="padding-bottom:4px"><span class="eb">Konyha</span><span class="eb">${REC.length} recept · ${KAM.length} tétel</span></div>
  <div class="qrow rise" style="--i:1"><button data-go="recept-uj">${T('t-book')}Recept mentése</button><button data-sheet="import">${T('t-camera')}Új elem a kamrába</button></div>
  <section class="card hg rise" style="--i:2" data-go="muhely"><span class="eb">Receptműhely</span>
    <p class="verdict">Főzzünk ki valamit</p><p class="txt sub">Te mondod a célt, én a hozzávalót. A számokat a kamrád adja.</p>
    <div class="act">${[['Magas fehérje','t-meat'],['Edzés előtt','t-bolt'],['Edzés után','t-dumbbell'],['Lefekvés előtt','t-moon']].map(([l,ic])=>`<button class="lk" data-go="muhely.vazlat">${l}</button>`).join('')}</div>
  </section>
  <section class="open rise" style="--i:3">
    ${ln('t-book','Receptek',`${REC.length} recept · kedvenced: ${fav.n} (${fav.logged}×)`,'',{go:'receptek'})}
    ${ln('t-stack','Kamra',`${KAM.length} tétel · ${food} étel · ${KAM.length-food} kiegészítő`,'',{go:'kamra'})}
  </section>
  `,'fuel','konyha');
}
function kamra(arg){
  if(arg&&arg!=='ures') return kamraItem(arg);
  const empty=arg==='ures';
  const F=[['Mind',KAM.length,'Szűrő: mind'],['Étel',KAM.filter(k=>k.k==='food').length],['Supp',KAM.filter(k=>k.k==='supp').length],['Stim',KAM.filter(k=>k.k==='stim').length],['Gyógyszer',0]];
  return page(`${back('Konyha','konyha')}
  <div class="sec rise" style="padding-top:4px"><h1 class="t" style="font-size:24px">Kamra</h1><span class="tg2"><button data-sheet="catalog">Közös</button><button data-sheet="import">Import</button><button class="on" data-sheet="add">+ Új tétel</button></span></div>
  ${empty?`<section class="open rise first" style="--i:1"><p class="verdict">A kamra üres.</p><p class="txt sub">Vedd fel az első tételt, vagy válassz a közös katalógusból; itt jelenik meg a polcodon.</p><div class="act"><button class="btn sm" data-sheet="add">Első tétel felvétele</button><button class="lk" data-sheet="catalog">Közös katalógus</button></div></section>`
  :`<div class="p16 rise" style="--i:1"><div class="srch" data-toast="Keresés a kamrában">${T('t-basket')}Keress tételt, márkát…</div></div>
  <div class="p16 rise" style="--i:2;padding-top:10px;display:flex;gap:14px;align-items:center">${tgl(F,'Mind')}<button class="lk" style="margin-left:auto" data-sheet="catfilter">Szűrők</button></div>
  <section class="open rise" style="--i:3">
    ${KAM.map(k=>{const [ic,kind]=KIND[k.k];return ln(ic,k.n,`${k.b} · ${kind} · ${SRC[k.src][1]}${k.k==='food'?` · ${fmt(k.p)} g feh. / 100 g`:''}`,k.k==='food'?`<b>${k.kcal}</b> kcal`:`<b>${k.dose}</b>`,{go:'kamra.'+k.id})}).join('')}
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Okosabb csere</span>
    ${ln('t-link','Görög joghurt 10% · 500 g','1 790 Ft · esti kazein, +2 recepthez illik','',{toast:'Csere-javaslat · a termék oldala'})}
  </section>`}
  `,'fuel','konyha');
}
function kamraItem(id){
  const k=KAM.find(x=>x.id===id)||KAM[0]; const [ic,kind]=KIND[k.k]; const food=k.k==='food';
  const tot=food?k.p*4+k.c*4+k.f*9:1;
  return page(`${back('Kamra','kamra')}
  <section class="card hg rise" style="--i:1"><span class="eb">${k.cat} · ${kind}</span>
    <h1 class="t" style="font-size:22px;margin:4px 0 8px">${k.n}</h1>
    <div class="big"><span class="num">${food?k.kcal:k.dose}</span><span class="v">${food?'kcal / 100 g':'egy adag'} · ${k.b}</span></div>
    <p class="fn" style="margin-top:8px">Így került a polcra: ${SRC[k.src][1]} · ${k.sl}${k.when?' · '+k.when:' · az időpont nincs rögzítve'}${k.price?' · '+k.price:''}</p>
  </section>
  ${food?`<section class="open rise" style="--i:2"><span class="eb">Makrók · 100 g</span>
    <div class="mb">${[['Fehérje',k.p,'var(--protein)',k.p*4],['Szénhidrát',k.c,'var(--carb)',k.c*4],['Zsír',k.f,'var(--fat)',k.f*9]].map(([l,g,c,kcal])=>`<span class="l">${l}</span><div class="bar" style="--c:${c}"><b style="--w:${Math.round(kcal/tot*100)}%"></b></div><span class="v"><b>${fmt(g)}</b> g · ${Math.round(kcal/tot*100)}%</span>`).join('')}</div>
  </section>
  <section class="open rise" style="--i:3"><span class="eb">Minőség · 100 g</span>
    ${ln('t-sugar','Cukor','',`<b>${k.sug}</b> g`,{nochev:true,toast:'Cukor'})}${ln('t-salt','Só','',`<b>${k.salt}</b> g`,{nochev:true,toast:'Só'})}${ln('t-fat','Telített zsír','',`<b>${k.sat}</b> g`,{nochev:true,toast:'Telített zsír'})}${ln('t-processing','Feldolgozottság','',`<b>${k.nova}</b>`,{nochev:true,toast:'NOVA'})}
  </section>`
  :`<section class="open rise" style="--i:2"><span class="eb">A napodban</span>
    ${ln('t-clock',k.id==='kreatin'?'5 g · ébredés után':'Nincs időzítve',k.id==='kreatin'?'a stackben · Ébredés 07:00':'A Kiegészítők oldalon pipálod; ott látod a protokollt is','',{go:'stack'})}
  </section>`}
  ${k.recs.length?`<section class="open rise" style="--i:4"><span class="eb">Receptekben</span>${k.recs.map(r=>{const R=REC.find(x=>x.id===r);return ln('t-plate',R.n,`${CAT[R.cat][0]} · ${R.logged}× etted`,'',{go:'recept.'+r})}).join('')}</section>`:''}
  <section class="open rise" style="--i:5"><div class="act" style="margin-top:0">${food?`<button class="btn sm" data-go="log.kereses">Logolás a mai napra</button>`:''}<button class="lk" data-sheet="add" data-arg="edit">Szerkesztés</button><button class="lk" data-toast="Biztos? Még egy érintés a törléshez">Törlés</button></div></section>
  `,'fuel','konyha');
}
function receptek(){
  const F=[['Mind',REC.length],['Reggeli',2],['Ebéd',1],['Vacsi',1],['Snack',2],['Csillagos',3]];
  return page(`${back('Konyha','konyha')}
  <div class="sec rise" style="padding-top:4px"><h1 class="t" style="font-size:24px">Receptek</h1><span class="tg2"><button class="on" data-go="recept-uj">+ Új</button></span></div>
  <div class="p16 rise" style="--i:1">${tgl(F,'Mind')}</div>
  <section class="open rise" style="--i:2">
    ${REC.map(r=>ln(CAT[r.cat][1],r.n,`${CAT[r.cat][0]} · ${r.min} perc${r.role?' · '+r.role:''}${r.serv>1?' · '+r.serv+' adag':''} · ${r.score?`<span class="sc">${T('t-score')}${fmt(r.score)}</span>`:'értékelés folyamatban'}`,`<b>${Math.round(r.kcal/r.serv)}</b> kcal / adag`,{go:'recept.'+r.id})).join('')}
  </section>
  `,'fuel','konyha');
}
function recept(arg){
  const [id,mode]=(arg||'r1').split('.'); const r=REC.find(x=>x.id===id)||REC[0]; const all=mode==='egesz'; const d=all?1:r.serv; const v=k=>Math.round(r[k]/d);
  const tot=v('p')*4+v('c')*4+v('f')*9;
  const ings=id==='r1'?MEALS.reggeli.ings:id==='r4'?MEALS.tizorai.ings:MEALS.ebed.ings;
  return page(`${back('Receptek','receptek')}
  <section class="card hg rise" style="--i:1"><span class="eb">${CAT[r.cat][0]}-recept · ${r.min} perc${r.role?' · '+r.role:''}</span>
    <h1 class="t" style="font-size:22px;margin:4px 0 8px">${r.n}</h1>
    <div class="big"><span class="num">${kc(v('kcal'))}</span><span class="v">kcal ${all?'· egész recept':'/ adag'} · ${r.logged}× etted · legutóbb ${r.last}</span></div>
    <div class="act" style="margin-top:10px">${r.serv>1?seg([['1 adag',''],[`Egész · ${r.serv} adag`,'egesz']],all?'egesz':'','recept.'+id):''}${r.score?`<button class="lk" data-toast="A recept értékelése · 9 szempont · megbízhatóság 92%">Pontszám ${fmt(r.score)} ›</button>`:'<span class="fn" style="margin:0">értékelés folyamatban</span>'}</div>
  </section>
  <section class="open rise" style="--i:2"><span class="eb">Makrók</span>
    <div class="mb">${[['Fehérje',v('p'),'var(--protein)',v('p')*4],['Szénhidrát',v('c'),'var(--carb)',v('c')*4],['Zsír',v('f'),'var(--fat)',v('f')*9]].map(([l,g,c,kcal])=>`<span class="l">${l}</span><div class="bar" style="--c:${c}"><b style="--w:${Math.round(kcal/tot*100)}%"></b></div><span class="v"><b>${g}</b> g · ${Math.round(kcal/tot*100)}%</span>`).join('')}</div>
  </section>
  <section class="open rise" style="--i:3"><span class="eb">Hozzávalók · ${ings.length} tétel</span>
    ${ings.map(([n,ic,kid,src,k,amt])=>ln(ic,n,`${amt} · ${src}`,`<b>${Math.round(k/d)}</b> kcal`,kid?{go:'kamra.'+kid}:{toast:n+' · becsült sor'})).join('')}
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Minőség · mikrotápanyagok</span>
    ${ln('t-processing','Alapanyag-arány','',`<b>100</b> %`,{nochev:true,toast:'Alapanyag-arány'})}${ln('t-sprout','Növényféle','',`<b>3</b> db`,{nochev:true,toast:'Növényféle'})}
    ${ln('t-fiber','Rost · cukor · só','telített zsír: nincs adat',`<b>7</b> g · 19 g · 0,6 g`,{nochev:true,toast:'Mikrotápanyagok'})}
    <p class="fn">NOVA ${r.nova} · létrehozva ${r.date}</p>
  </section>
  <section class="open rise" style="--i:5"><span class="eb">Mezo jegyzete</span><p class="txt">Lassú szénhidrát és sok fehérje; edzés előtt 2–3 órával ideális, a túró kazeinje sokáig kitart.</p><p class="fn">${r.fits}</p></section>
  <section class="open rise" style="--i:6">
    ${ln('t-plate','Logolás · ma ettem ilyet','a mostani időre, 1 adag','',{go:'log.tetelek'})}
    ${ln('t-chef','Iterálás a Műhelyben','a recept mint kiindulás','',{go:'muhely.vazlat'})}
    ${ln('t-journal',`Logok · ${r.logged}`,r.last.startsWith('ma')?'ma is a naplódban':'ma még nincs logolva','',{sheet:'reclogs',arg:id})}
    <div class="act"><button class="lk" data-go="recept-uj">Szerkesztés</button><button class="lk" data-toast="Csillag átállítva">${r.star?'Csillag le':'Csillag'}</button><button class="lk" data-toast="Biztos? Még egy érintés a törléshez">Törlés</button></div>
  </section>
  `,'fuel','konyha');
}
function editor(){
  return page(`${back('Receptek','receptek')}
  <div class="sec rise" style="padding-top:4px"><h1 class="t" style="font-size:24px">Új recept</h1></div>
  <section class="open rise first" style="--i:1">
    ${fld('Név','pl. Tonhalsaláta · edzés után',{ph:true,toast:'Név'})}
    ${fld('Blokk','',{raw:tgl([['Reggeli'],['Ebéd'],['Vacsora'],['Snack'],['Csillag']],'Ebéd')})}
    ${fld('Szerep','',{raw:tgl([['Általános'],['Edzés előtt'],['Edzés után']],'Általános')})}
    <p class="fn">A szerep dönti el, milyen mérce szerint pontozzuk: edzés körül a gyors szénhidrát üzemanyag, nem hiba.</p>
    ${fld('Adag','',{raw:stp(2,'adag','Adag')})}${fld('Elő + főzés','',{raw:stp(25,'perc','Idő')})}
  </section>
  <section class="card hg rise" style="--i:2"><span class="eb">Makró-összeg</span>
    <div class="act" style="margin:4px 0 6px">${seg([['1 adag',''],['Egész recept','x']],'','recept-uj')}</div>
    <div class="big"><span class="num">529</span><span class="v">kcal · 53 feh. · 54 szénh. · 11 zsír</span></div>
    <p class="fn" style="margin-top:6px">Egész recept = 1 058 kcal · P 106 · C 108 · F 22.</p>
  </section>
  <section class="open rise" style="--i:3"><span class="eb">Hozzávalók · 2</span>
    ${[['Csirkemell · friss','t-meat','Bonafarm',300],['Édesburgonya','t-carb','Tesco',400]].map(([n,ic,b,g])=>`<div class="ln">${T(ic)}<span class="g">${n}<small>${b}</small></span>${stp(g,'g',n)}<button class="lk" data-toast="Törölve a receptből">×</button></div>`).join('')}
    <div class="act"><button class="lk" data-sheet="kamrapick">+ Kamrából hozzáad</button></div>
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Címkék</span>${tgl([['pre-workout ×'],['whole-foods ×'],['+ címke']],'')}</section>
  ${savebar('receptek','Mentés','Recept mentve')}
  `,'fuel','konyha');
}
function muhely(arg){
  const dock=`<section class="open rise" style="--i:6">${tgl([['Magas fehérje'],['Edzés előtt'],['Edzés után'],['Lefekvés előtt'],['Reggeli']],'',"data-go")}
    <div class="cmp" style="margin-top:12px"><button data-sheet="kamrapick" aria-label="Kamra">${T('t-stack')}</button><textarea aria-label="Mit főzzünk?" placeholder="Mit főzzünk? Mondd el szabadon…"></textarea><button data-toast="Diktálás" aria-label="Diktálás">${T('t-mic')}</button><button class="go" data-go="muhely.vazlat" aria-label="Küldés">${T('t-send')}</button></div>
    <p class="fn">Minden kör javításként érkezik, a kézi szerkesztéseid megmaradnak.</p></section>`.replace(/data-go="(Magas[^"]*|Edzés[^"]*|Lefekvés[^"]*|Reggeli)"/g,'data-go="muhely.vazlat"');
  if(!arg) return page(`${back('Konyha','konyha')}
  <div class="p16 rise" style="--i:1;padding-top:8px"><span class="eb">Receptműhely</span><h1 class="t" style="margin-top:6px">Mit főzzünk ki?</h1>
    <p class="lead" style="margin-top:8px">Válassz egy célt alul, vagy írd le a saját szavaiddal. Én hozzávalót és mennyiséget javaslok; a számokat mindig a kamrád adja.</p></div>
  ${dock}`,'fuel','konyha');
  return page(`${back('Konyha','konyha')}
  <div class="sec rise" style="padding-top:4px;padding-bottom:0"><span class="eb">Receptműhely · vázlat</span><span class="eb">Magas fehérje</span></div>
  <section class="card hg rise" style="--i:1"><h1 class="t" style="font-size:22px;margin:0 0 8px">Csirkés bulgur · magas fehérje</h1>
    <div class="big"><span class="num">612</span><span class="v">kcal / adag · 2 adag</span></div>
    <div class="act" style="margin-top:10px">${stp(2,'adag','Adag')}${seg([['1 adag','vazlat'],['Egész','vazlat-egesz']],arg,'muhely')}</div>
  </section>
  <section class="open rise" style="--i:2"><span class="eb">Hozzávalók · 3 tétel</span>
    ${[['Csirkemell · friss','t-meat','kamra','330',300,'g'],['Bulgur','t-carb','kamra','342',100,'g'],['Paprika · kaliforniai','t-fiber','becslés','—',150,'g']].map(([n,ic,t,k,a,u])=>`<div class="ln">${T(ic)}<span class="g">${n}<small>${t}${t==='becslés'?' · <button class="lk" data-sheet="kamrapick">csere kamra-tételre</button>':''}</small></span>${stp(a,u,n)}<span class="v"><b>${k}</b>${k!=='—'?' kcal':''}</span></div>`).join('')}
    <p class="fn" style="color:var(--warn)">1 sorhoz nincs tápérték a kamrában: a számokból kimarad, nem találgatjuk. Cseréld kamra-tételre vagy töröld a mentéshez.</p>
  </section>
  <section class="open rise" style="--i:3">${ln('t-journal','Elkészítés','4 lépés','',{toast:'Elkészítés: 4 lépés'})}
    <div class="act"><button class="btn sm" disabled style="opacity:.45">Mentés a receptkönyvbe</button></div></section>
  ${dock}`,'fuel','konyha');
}

/* ═══ KIEGÉSZÍTŐK ═══════════════════════════════════════════════ */
function stack(){
  const all=STACK.flatMap(b=>b.items), taken=all.filter(x=>x[3]).length, nx=all.find(x=>!x[3]);
  return page(`
  <div class="sec rise" style="padding-bottom:4px"><span class="eb">Kiegészítők · ma</span><span class="eb">${taken} / ${all.length} bevéve</span></div>
  <section class="card hg rise" style="--i:1"><span class="eb">Következik</span>
    <p class="verdict">${nx[0]}</p><p class="txt sub">${nx[1]} · ${nx[2]} · zsíros étkezéssel szívódik fel a legjobban.</p>
    <div class="act"><button class="btn sm" data-toast="Bevéve · ${esc(nx[0])} · 14:10">Bevettem</button><button class="lk" data-sheet="item" data-arg="${esc(nx[0])}">Miért így?</button></div>
  </section>
  ${STACK.map((b,i)=>{const d=b.items.filter(x=>x[3]).length;return `<section class="open rise" style="--i:${i+2}"><span class="eb">${b.band} · ${d} / ${b.items.length}</span>
    ${b.items.map(x=>`<div class="ln">${tk(!!x[3],x[3]?'visszavonom':'bevettem')}<span class="g" data-sheet="item" data-arg="${esc(x[0])}">${x[0]}<small>${x[1]} · ${x[2]}${x[3]?' · bevéve '+x[4]:''}</small></span>${chev}</div>`).join('')}</section>`}).join('')}
  <section class="open rise" style="--i:6">
    ${ln('t-protocol','Protokoll · 8 elem','mit miért szedsz, és ki tette a helyére','',{go:'protokoll'})}
    ${ln('i-gear','Új elem beállítása','mennyit, mikor és miért','',{go:'stack-uj.1'})}
    ${ln('t-syringe','Gyógyszer','a követett gyógyszered és a ciklusa','',{go:'gyogyszer'})}
  </section>
  ${fn('Tájékoztatás, nem orvosi tanács.')}
  `,'fuel','stack');
}
function protokoll(){
  const Z=[['Ébredés','t-dawn','07:00',[['Kreatin-monohidrát','5 g','Reggel, üres gyomorra is jól szívódik; a napi összmennyiség a lényeg.','auto'],['Kávé · espresso','80–100 mg','Ébredés után 60–90 perccel a legjobb, a koffein-stop 14:00.','auto'],['Tasty Dose gombakávé','8 g','A reggeli kávé mellé, fókuszhoz.','kézi']]],
    ['Reggeli','t-sun','08:00',[['Impact Whey Protein','30–40 g','Pihenőnapon a reggelihez kerül.','auto']]],
    ['Edzés előtt','t-dumbbell','16:30',[['Origin PWO','20 g','Edzés előtt 20–30 perccel; pihenőnapon kimarad.','auto']]],
    ['Ebéd','t-bowl','12:30',[['D3 + K2','4000 IU + 100 µg','Zsíros étkezéssel szívódik fel a legjobban.','auto'],['Omega-3','2 g EPA+DHA','Az ebéd a nap legzsírosabb pontja.','auto']]],
    ['Este','t-moon','21:00',[['Magnézium-glicinát','300 mg','Este nyugtat, segíti az elalvást.','auto']]]];
  return page(`${back('Kiegészítők','stack')}
  <div class="sec rise" style="padding-top:4px"><h1 class="t" style="font-size:24px">Protokoll</h1><span class="eb">v3 · 86% bizalom</span></div>
  <div class="p16 rise" style="--i:1"><div class="big"><span class="num">8</span><span class="v">elem · 5 idősáv · 1 kézzel elhelyezve</span></div></div>
  ${Z.map(([z,ic,t,items],i)=>`<section class="open rise" style="--i:${i+2}"><span class="eb">${z} · ${t} · ${items.length}</span>
    ${items.map(([n,d,why,m])=>`<div class="ln" data-sheet="stackitem" data-arg="${m}|${esc(n)}">${T('t-supps')}<span class="g">${n}<small>${d} · ${m}</small><small>${why}</small></span>${chev}</div>`).join('')}</section>`).join('')}
  <section class="open rise" style="--i:7"><span class="eb">Étkezéshez · 2</span>
    ${ln('t-bowl','Ebéd · 12:30 · Csirke + édesburgonya + spenót','zsír 11 g · a D3 + K2 mellé elég','',{go:'recept.r2'})}
    ${ln('t-sun','Reggeli · tegnap','fehérje 49 g · a whey-jel együtt rendben','',{toast:'Tegnapi reggeli',nochev:true})}
  </section>
  <section class="open rise" style="--i:8">${ln('i-gear','Új elem beállítása','mennyit, mikor és miért','',{go:'stack-uj.1'})}</section>
  ${fn('Tájékoztatás, nem orvosi tanács. Gyógyszer mellé mindig kérdezd meg a kezelőorvosod.')}
  `,'fuel','stack');
}
function stackUj(step){
  step=+step||1; const names=['Termék','Adatok','Javaslat'];
  const top=`${back(step===1?'Kiegészítők':'Előző lépés',step===1?'stack':'stack-uj.'+(step-1))}
  <div class="sec rise" style="padding-top:4px;padding-bottom:6px"><h1 class="t" style="font-size:24px">Új elem beállítása</h1><span class="eb">${step} / 3 · ${names[step-1]}</span></div>
  <div class="pb rise">${[1,2,3].map(n=>`<i><b style="--w:${n<=step?100:0}%"></b></i>`).join('')}</div>`;
  if(step===1) return page(`${top}
  <p class="lead p16 rise" style="--i:1">Melyik terméket állítsuk be? A címkéjéről kiolvasom, mennyi van benne, és megmondom, ez mennyi az ajánlott napi mennyiségből.</p>
  <div class="p16 rise" style="--i:2;padding-top:10px"><div class="srch" data-toast="Keresés">${T('t-basket')}Név vagy márka…</div></div>
  <section class="open rise" style="--i:3">
    ${[['Kreatin-monohidrát','MyProtein · 5 g',1],['Cink-biszglicinát','— · 15 mg',0],['D3 + K2','MyProtein · 4000 IU + 100 µg',1]].map(([n,s,inn])=>ln('t-supps',n,s,inn?'a stackben':'',{go:'stack-uj.2'})).join('')}
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Vagy</span>
    ${ln('t-link','Termék linkje','bemásolod a webshop oldalát, kiolvasom a termék adatait','',{go:'stack-uj.2'})}
    ${ln('t-camera','Címkefotóról','lefotózod a hátoldalt, kiolvasom, amit a címke mond','',{go:'stack-uj.2'})}
    ${ln('t-journal','Beírom kézzel','ha nincs nálad a termék','',{go:'stack-uj.2'})}
  </section>`,'fuel','stack');
  if(step===2) return page(`${top}
  <p class="lead p16 rise" style="--i:1">Ezek a termék saját adatai; a címkén vagy a webshopban látod őket.</p>
  <section class="open rise" style="--i:2">${[['Termék neve','Cink-biszglicinát'],['Egy egységben','15'],['Mértékegység','mg'],['Kiszerelés','kapszula'],['Dobozban','90']].map(([l,v])=>fld(l,v,{toast:l})).join('')}</section>
  <div class="savebar rise" style="--i:3"><button class="lk" data-go="stack-uj.1">Másik terméket választok</button><button class="btn" data-go="stack-uj.3">Tovább a javaslathoz</button></div>`,'fuel','stack');
  return page(`${top}
  <section class="card hg rise" style="--i:1"><span class="eb">Cink-biszglicinát · javaslat</span>
    <div class="big"><span class="num">1</span><span class="v">kapszula naponta · 15 mg · az ajánlott 10–15 mg sávban</span></div>
    <p class="txt sub" style="margin-top:8px">Vacsorával szívódik fel a legjobban, és nem versenyez a reggeli vassal. A doboz kb. 90 napra elég.</p>
  </section>
  <section class="open rise" style="--i:2">
    ${fld('Napi mennyiség','',{raw:stp(1,'kapszula','Napi mennyiség')})}
    ${fld('Mikor','',{raw:tgl([['Ébredés'],['Reggeli'],['Edzés előtt'],['Edzés után'],['Ebéd'],['Vacsora'],['Este'],['Lefekvés']],'Vacsora')})}
    <p class="fn" style="color:var(--warn)">Amire figyelj: hosszan 25 mg fölött a réz felszívódását ronthatja.</p>
  </section>
  <div class="savebar rise" style="--i:3"><button class="lk" data-go="stack-uj.2">Vissza az adatokhoz</button><button class="btn" data-go="protokoll">Felveszem · Vacsora</button></div>
  ${fn('Tájékoztatás, nem orvosi tanács. Gyógyszer vagy krónikus betegség mellett kérdezd meg a kezelőorvosod.')}`,'fuel','stack');
}
function gyogyszer(arg){
  if(arg!=='aktiv') return page(`${back('Kiegészítők','stack')}
  <div class="sec rise" style="padding-top:4px"><h1 class="t" style="font-size:24px">Gyógyszer</h1></div>
  <section class="open rise first" style="--i:1"><p class="verdict">Nincs követett gyógyszer.</p><p class="txt sub">Ha szedsz valamit ciklusban, ide kerül a fázis-térkép és a beadás-napló.</p>
    <div class="act"><button class="btn sm" data-sheet="medform">Gyógyszer felvétele</button><button class="lk" data-go="gyogyszer.aktiv">Minta: ha van követett gyógyszer</button></div></section>`,'fuel','stack');
  const cyc=['C','C','S','S','S','V','V'];
  return page(`${back('Kiegészítők','stack')}
  <div class="sec rise" style="padding-top:4px"><h1 class="t" style="font-size:24px">Retatrutid</h1><span class="tg2"><button class="on" data-sheet="dose">+ Beadás</button></span></div>
  <section class="card hg rise" style="--i:1"><span class="eb">Gyógyszer · subQ injekció · heti · hétfő</span>
    <div class="big"><span class="num">6</span><span class="v">mg · 3. nap · stabil fázis · utolsó beadás 2 napja</span></div>
    <div class="cyc">${cyc.map((g,i)=>`<span class="${i===2?'now':''}">${g}<small>${i+1}</small></span>`).join('')}</div>
    <p class="fn" style="margin-top:6px">C csúcs · S stabil · V völgy; a beadás napjától számolva.</p>
  </section>
  <section class="open rise" style="--i:2"><span class="eb">Beadások · 3</span>
    ${[['hétfő, okt. 5.','hétfő reggel · subQ has'],['hétfő, szept. 28.',''],['hétfő, szept. 21.','']].map(([d,n])=>ln('t-syringe',d,n,'<b>6</b> mg',{nochev:true,toast:d})).join('')}
    <div class="act"><button class="lk" data-sheet="medform">Szerkesztés</button><button class="lk" data-toast="Leállítom? Még egy érintés">Leállítás</button></div>
  </section>
  ${fn('Tájékoztatás, nem orvosi tanács.')}`,'fuel','stack');
}

/* ═══ TRENDEK ══════════════════════════════════════════════════ */
function weekSvg(){
  const W=336,H=120,mx=2900,x=i=>12+i*46,bw=26,base=104,h=v=>v/mx*78;
  return `<svg class="tch" viewBox="0 0 ${W} ${H}" role="img" aria-label="A hét hét napja a keretéhez mérve, a nap pontja fölötte">
    ${WEEK.map(([d,k,t,s,tr],i)=>`<g data-sheet="day" data-arg="${i}" style="cursor:pointer"><rect x="${x(i)-10}" y="0" width="${bw+20}" height="${H}" fill="transparent"/>
      ${k==null?`<rect class="gap" x="${x(i)}" y="${base-h(t)}" width="${bw}" height="${h(t)}" rx="4"/>`:`<rect class="col" x="${x(i)}" y="${base-h(k)}" width="${bw}" height="${h(k)}" rx="4"/>`}
      <line class="tgt" x1="${x(i)-3}" x2="${x(i)+bw+3}" y1="${base-h(t)}" y2="${base-h(t)}"/>
      <text x="${x(i)+bw/2}" y="${(base-h(Math.max(k||0,t)))-6}" text-anchor="middle" class="${k==null?'faint':''}">${s||'·'}</text>
      <text x="${x(i)+bw/2}" y="${H-2}" text-anchor="middle" class="${i===2?'on':''}">${d}</text></g>`).join('')}
  </svg>`;
}
function longSvg(){
  const kcal=[2860,2990,3050,2940,3120,3010,3055], wt=[84.0,83.9,null,83.7,83.6,null,83.9,83.4,83.2,82.9,82.6,82.2,81.9,81.6,81.5,81.3,81.4,81.1,80.9,80.8,80.7];
  const W=336,H=140,X=i=>14+i*(308/20),Yw=v=>24+(84.2-v)/3.8*86;
  const dots=wt.map((v,i)=>v==null?'':`<circle class="raw" cx="${X(i).toFixed(1)}" cy="${Yw(v).toFixed(1)}" r="2.6"/>`).join('');
  const tr=[];for(let i=0;i<wt.length;i++){const win=wt.slice(Math.max(0,i-2),i+3).filter(v=>v!=null);tr.push(win.reduce((a,b)=>a+b,0)/win.length)}
  const path=tr.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Yw(v).toFixed(1)}`).join(' ');
  const kx=i=>14+i*(308/6), ky=v=>120-(v-2800)/400*40;
  return `<svg class="tch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Súlytrend simított vonallal, a mérések pontokként, alatta a heti átlag kcal vékony vonallal, 7 hét">
    ${[82,83,84].map(v=>`<line class="grid" x1="14" x2="${W-14}" y1="${Yw(v).toFixed(1)}" y2="${Yw(v).toFixed(1)}"/><text x="${W-12}" y="${(Yw(v)+3).toFixed(1)}">${v}</text>`).join('')}
    <path class="thin" d="${kcal.map((v,i)=>`${i?'L':'M'}${kx(i).toFixed(1)} ${ky(v).toFixed(1)}`).join(' ')}"/>
    ${dots}<path class="tr" d="${path}"/>
    <text x="14" y="${H-2}">aug. 18.</text><text x="${W-14}" y="${H-2}" text-anchor="end">okt. 7.</text></svg>`;
}
function waterfallSvg(){
  const steps=[['aug.',-0.4],['',-0.3],['',-0.5],['szept.',+0.2],['',-0.6],['',-0.4],['okt.',-0.7]]; const start=84.0,goal=78.0;
  const W=336,H=130,bw=26,x=i=>14+i*37,Y=v=>14+(84.3-v)/(84.3-goal+0.3)*98;
  let cur=start,out=`<text x="14" y="10">${fmt(start.toFixed(1))} kg</text>`;
  steps.forEach(([l,d],i)=>{const a=cur,b=cur+d;cur=b;const top=Math.min(a,b),bot=Math.max(a,b);
    out+=`<rect class="col ${d>0?'up':''}" x="${x(i)}" y="${Y(bot).toFixed(1)}" width="${bw}" height="${Math.max(2,(Y(top)-Y(bot))).toFixed(1)}" rx="3"/>${l?`<text x="${x(i)+bw/2}" y="${H-2}" text-anchor="middle">${l}</text>`:''}`;
    if(i<steps.length-1) out+=`<line class="grid" x1="${x(i)+bw}" x2="${x(i+1)}" y1="${Y(b).toFixed(1)}" y2="${Y(b).toFixed(1)}"/>`});
  out+=`<rect class="tot" x="${x(7)}" y="${Y(cur).toFixed(1)}" width="${bw}" height="${(Y(goal)-Y(cur)).toFixed(1)}" rx="3" opacity=".9"/><text x="${x(7)+bw/2}" y="${(Y(cur)-5).toFixed(1)}" text-anchor="middle" class="on">${fmt(cur.toFixed(1))}</text><text x="${x(7)+bw/2}" y="${H-2}" text-anchor="middle">cél ${fmt(goal.toFixed(1))}</text>`;
  return `<svg class="tch wf" viewBox="0 0 ${W} ${H}" role="img" aria-label="A hét hét lépése a kiindulástól a célig, vízesés-ábrán">${out}</svg>`;
}
function trendek(){
  return page(`
  <div class="dn rise"><button class="ar" data-toast="Múlt hét" aria-label="Múlt hét">‹</button><span class="lbl"><span class="eb">Ez a hét</span><b>október 1–7.</b></span><button class="ar" disabled style="opacity:.35" aria-label="Következő hét">›</button></div>
  <section class="card hg rise" style="--i:1"><span class="eb">5 / 7 naplózott nap · ebből áll a heti kép</span>
    <p class="verdict">Hétvégén 46%-kal többet ettél a keretedhez mérve, mint hétköznap.</p>
    ${weekSvg()}
    <p class="fn" style="margin-top:2px">A vonás a nap kerete, a szám a nap pontja. A szaggatott oszlop: nem naplózott nap; nem töltöm ki becsléssel. Koppints egy napra.</p>
  </section>
  <section class="open rise" style="--i:2">
    ${ln('t-plate','Napi átlag','180 kcal-lal kevesebb, mint múlt héten','<b>2 069</b> kcal',{nochev:true,toast:'Napi átlag · 5 naplózott nap'})}
    ${ln('t-score','Étkezés-minőség','0,7-del több, mint múlt héten','<b>7,8</b>',{nochev:true,toast:'Étkezés-minőség · a napi pontok átlaga'})}
    ${ln('t-weight','Heti súlyátlag','0,6 kg-mal kevesebb','<b>81,3</b> kg',{nochev:true,toast:'Heti súlyátlag · 4 mérés'})}
  </section>
  <section class="open rise" style="--i:3"><span class="eb">Hétköznap és hétvége</span>
    <div class="mb"><span class="l">Hétköznap</span>${qbar(79,130)}<span class="v"><b>79</b> %</span><span class="l">Hétvége</span>${qbar(125,130)}<span class="v"><b>125</b> %</span></div>
    <p class="fn">A keret százalékában. A különbség 46 százalékpont a hétvége javára. Így alakult, és most már látod.</p>
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Hosszabb táv · 7 hét</span>
    <p class="txt sub">A simított súlytrend a főszereplő; a pontok a napi mérések. Alatta vékonyan a heti átlag kcal. Egyik sem ok, csak együttjárás.</p>
    ${longSvg()}
  </section>
  <section class="open rise" style="--i:5"><span class="eb">A cél felé · 84,0 → 78,0 kg</span>
    ${waterfallSvg()}
    <p class="fn">Egy oszlop egy hét lépése. Ami még hátravan, az utolsó oszlop. Ahol nem volt elég mérés, ott a súlyvonal megszakad.</p>
  </section>
  <section class="open rise" style="--i:6"><span class="eb">Mintázatok · 2</span>
    ${ln('t-pattern','Késő szénhidrát (20:00 után, 60 g felett) → másnap reggeli RPE +1','figyeljük','',{toast:'Mezo · a mintázat oldala'})}
    ${ln('t-pattern','Koffein 14:00 után → elalvás +24 perc','megerősítve','',{toast:'Mezo · a mintázat oldala'})}
    <p class="fn">A mintázatok otthona a Mezo; innen odalépsz, nem másolatot látsz.</p>
  </section>
  `,'fuel','trendek');
}

/* ═══ BEÁLLÍTÁSOK · ABLAKOK · TANULÁS ══════════════════════════ */
function beallitas(){
  return page(`${back('Mai','mai')}
  <div class="sec rise" style="padding-top:4px"><h1 class="t" style="font-size:24px">Fuel beállítások</h1></div>
  <section class="open rise first" style="--i:1"><span class="eb">Ritmus</span>
    ${fld('Étkezés / nap','',{raw:stp(4,'étkezés','Étkezés/nap (3–6)')})}
    ${fld('Koffein-stop','14:00',{toast:'Koffein-stop'})}
    <p class="fn">A koffein-stop a Mai sorát, a nap-tervet és a koffein-szokást is állítja.</p>
  </section>
  <section class="open rise" style="--i:2"><span class="eb">Makrók</span>
    ${fld('Makróprofil','Kiegyensúlyozott ▾',{toast:'Makróprofil'})}
    <p class="txt sub" style="margin-top:8px">A mai cél alapján: ${kc(DAY.target)} kcal.</p>
    <div class="mb">${[['Fehérje','24 %','220 g','var(--protein)',24],['Szénhidrát','47 %','380 g','var(--carb)',47],['Zsír','29 %','95 g','var(--fat)',29]].map(([l,p,g,c,w])=>`<span class="l">${l}</span><div class="bar" style="--c:${c}"><b style="--w:${w*2}%"></b></div><span class="v"><b>${p}</b> · ${g}</span>`).join('')}</div>
  </section>
  <section class="open rise" style="--i:3"><span class="eb">Célok</span>${fld('Víz-cél','2 500 ml',{toast:'Víz-cél'})}${fld('Rost-cél','30 g',{toast:'Rost-cél'})}</section>
  <section class="open rise" style="--i:4"><span class="eb">Finomhangolás</span>
    ${fld('Fehérje-szint','',{raw:tgl([['Alacsony'],['Mérsékelt'],['Magas']],'Magas')})}
    <p class="fn">A testsúlyod és a zsírmentes tömeged szerinti számítást is állítja; a cél a kettő közül a nagyobb, egy felső korláttal.</p>
    <div class="ln" style="margin-top:6px">${T('t-history')}<span class="g">Tanulás a súlyomból és az evésemből<small>hetente megtanulom, mennyi energiát használsz valójában</small></span>${sw(true,'Tanulás a súlyomból és az evésemből')}</div>
  </section>
  <section class="open rise" style="--i:5">${ln('t-clock','Étkezési ablakok','szerkesztése · 4 ablak · 3 naptípus','',{go:'ablakok'})}</section>
  ${fn('A ritmus vezet, nem korlátoz: bármelyik ablak utólag is logolható.')}
  <div class="savebar rise" style="--i:6"><button class="btn" data-toast="Mentve">Mentés</button></div>
  `,'fuel','mai');
}
function ablakok(arg){
  const edit=arg==='szerk';
  const S=[['08:00','Reggeli','t-sun',600],['12:30','Ebéd','t-bowl',780],['16:00','Uzsonna','t-snack',300],['19:30','Vacsora','t-moon',720]];
  return page(`${back('Beállítások','beallitas')}
  <div class="sec rise" style="padding-top:4px"><h1 class="t" style="font-size:24px">Étkezési ablakok</h1></div>
  <div class="p16 rise" style="--i:1">${tgl([['Pihenőnap'],['Reggeli edzés'],['Esti edzés']],'Pihenőnap')}</div>
  ${!edit?`<section class="open rise" style="--i:2">${S.map(([t,l,ic,k])=>ln(ic,l,`${t} · horgony: fix időpont`,`<b>${k}</b> kcal · ${Math.round(k/24)} %`,{nochev:true,toast:l,time:t})).join('')}
    <p class="fn">Ajánlott felosztás: a napod valódi edzésblokkjaiból számolva. Σ 100 %.</p>
    <div class="act"><button class="btn sm" data-go="ablakok.szerk">Testreszabás</button></div></section>`
  :`<section class="open rise" style="--i:2">${S.map(([t,l,ic,k])=>`<div class="ln">${T(ic)}<span class="g"><span class="in" style="display:inline-block;padding:5px 8px">${l}</span><small style="margin-top:6px">${tgl([['Reggeli'],['Ebéd'],['Vacsora'],['Snack']],l==='Uzsonna'?'Snack':l)}</small></span><span class="v"><b>${t}</b> · ${Math.round(k/24)} %</span><button class="lk" data-toast="Ablak törölve">×</button></div>`).join('')}
    <div class="act"><button class="lk" data-toast="Új ablak">+ Új ablak</button><span class="eb" style="margin:0">Σ 100 %</span><button class="lk" data-toast="Mezo értékeli a felosztást…">Mezo értékelése</button></div></section>
  ${savebar('ablakok','Mentés','Mentve')}`}
  `,'fuel','mai');
}
const WK=[['júl. 13.',2396,2440,285,2400,1],['júl. 20.',2402,2465,265,2430,0],null,['aug. 3.',2405,2470,245,2455,0],['aug. 10.',2398,2462,235,2455,1],['aug. 17.',2400,2485,220,2475,0],['aug. 24.',2403,2460,205,2455,0],['aug. 31.',2401,2452,190,2455,1],['szept. 7.',2399,2445,178,2440,0],['szept. 14.',2400,2450,165,2420,0],['szept. 21.',2400,2470,150,2470,0],['szept. 28.',2400,2480,150,2480,0]];
function learnSvg(){
  const W=336,H=150,L=30,R=10,T0=10,B=22,n=WK.length,x=i=>L+(W-L-R)*(i+.5)/n,lo=2250,hi=2650,y=v=>T0+(H-T0-B)*(1-(v-lo)/(hi-lo));
  const segp=get=>{let d='',pen=false;WK.forEach((w,i)=>{if(!w){pen=false;return}d+=`${pen?'L':'M'}${x(i).toFixed(1)} ${y(get(w)).toFixed(1)}`;pen=true});return d};
  let band='';{let run=[];const flush=()=>{if(run.length){band+=`<path class="band" d="${run.map((r,k)=>`${k?'L':'M'}${x(r.i).toFixed(1)} ${y(r.w[2]+r.w[3]).toFixed(1)}`).join('')}${run.slice().reverse().map(r=>`L${x(r.i).toFixed(1)} ${y(r.w[2]-r.w[3]).toFixed(1)}`).join('')}Z"/>`;run=[]}};WK.forEach((w,i)=>w?run.push({w,i}):flush());flush()}
  return `<svg class="tch" viewBox="0 0 ${W} ${H}" role="img" aria-label="A keret alapja hétről hétre, 12 hét: szaggatott a képlet, folytonos a tanult alap, körülötte a bizonytalanság sávja">
    ${[2300,2400,2500,2600].map(v=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L-4}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
    ${band}${WK.map((w,i)=>w?'':`<rect class="gap" x="${(x(i)-8).toFixed(1)}" y="${T0}" width="16" height="${H-T0-B}" rx="5"/>`).join('')}
    <path class="thin dash" d="${segp(w=>w[1])}"/><path class="tr" d="${segp(w=>w[4])}"/>
    ${WK.map((w,i)=>w?`<circle class="${w[5]?'hold':'raw'}" cx="${x(i).toFixed(1)}" cy="${y(w[4]).toFixed(1)}" r="${i===n-1?4.5:3}"/>`:'').join('')}
    ${[0,4,8,11].map(i=>`<text x="${x(i).toFixed(1)}" y="${H-6}" text-anchor="middle">${WK[i]?WK[i][0]:'júl. 27.'}</text>`).join('')}</svg>`;
}
const LD=[['kedd, okt. 6.',1020,'hiányosnak tűnt',0,1],['hétfő, okt. 5.',null,'nincs felírva',0,0],['vasárnap, okt. 4.',3120,'számít',1,1],['szombat, okt. 3.',2760,'számít',1,1],['péntek, okt. 2.',1180,'hiányosnak tűnt',0,1],['csütörtök, okt. 1.',1610,'te jelölted teljesnek',1,1],['szerda, szept. 30.',2820,'számít',1,1],['kedd, szept. 29.',2980,'számít',1,1],['hétfő, szept. 28.',2150,'te jelölted hiányosnak',0,1],['vasárnap, szept. 27.',3050,'számít',1,1],['szombat, szept. 26.',null,'nincs felírva',0,0],['péntek, szept. 25.',1340,'hiányosnak tűnt',0,1],['csütörtök, szept. 24.',2890,'számít',1,1],['szerda, szept. 23.',2710,'számít',1,1]];
const HW=[['Mit néztem meg','47 teljes nap felírt evéssel · 52 mérlegelés · 8 hét előzmény. Csak azokat a napokat számoltam, amikor az evésed teljesnek tűnt. A mai napot soha nem nézem, mert még tart.'],
  ['A súlyod és az evésed együtt','Napi evés oszlopokban, súly pontokban, a trend vonalban, 8 hét. A hiányosnak tűnő napok sraffozva, a vízugrás külön sávban.'],
  ['A számítás, egyszerűen','Átlagosan ennyit ettél a 47 teljes napon: 2 930. Ebből ami súlyként megmaradt: −132 (+0,12 kg/hét valódi gyarapodás, víz nélkül). Amit mozgással égettél: −330. Ennyit égetsz mozgás nélkül: ≈ 2 470. A valódi számítás napról napra halad; ez a kerekített, egyszerű változata.'],
  ['Amit kiszűrtem','3 hiányosnak tűnő nap (jóval a szokásos evésed alatt): kihagytam őket. 1 általad hiányosnak jelölt nap. Víz, nem zsír: szept. 7. körül a súlyod ~1,2 kg-ot ugrott, ezt nem számoltam hízásnak. 9 nap felírás nélkül: ezekből nem tanultam, és nem is tippeltem helyettük.'],
  ['Mennyire vagyok biztos benne','±150 kcal. Már elég sok adatot láttam, de a keretet továbbra is csak lépésenként igazítom. Minél több teljes napot és mérlegelést látok, annál biztosabb leszek.'],
  ['Hogyan léptem','Képlet 2 400 → a korábbi igazításaiddal 2 420 → e heti lépés +60 → most 2 480. Hetente csak kis lépést teszek, és új irányba először csak félig; egy furcsa hét így nem rántja el a keretet.']];
function tanulas(arg){
  const empty=arg==='ures', off=arg==='ki';
  const hero=empty?`<section class="open rise first" style="--i:1"><p class="verdict">Még nem tanultam.</p><p class="txt sub">Ehhez legalább 10 felírt nap kell az utolsó 4 hétből és heti 2 mérlegelés.</p></section>`
    :off?`<section class="card hg rise" style="--i:1"><span class="eb">Most nem használom</span><p class="verdict">A keret a képletből jön · 2 400 kcal</p><p class="txt sub">Közben csendben tovább tanultam: 2 480 ± 150 kcal.</p><div class="act"><button class="lk" data-go="beallitas">Bekapcsolás a Fuel beállításokban</button></div></section>`
    :`<section class="card hg rise" style="--i:1"><span class="eb">Tanult alap · közepesen biztos</span><div class="big"><span class="num">2 480</span><span class="v">kcal · ±150 · a képlet 2 400-at mondana</span></div>
      <div class="act" style="margin-top:10px"><button class="lk" data-sheet="weekly">Heti egyeztetés<span class="dot"></span></button></div></section>`;
  return page(`${back('Mai','mai')}
  <div class="sec rise" style="padding-top:4px;padding-bottom:0"><h1 class="t" style="font-size:24px">Hogy tanultam?</h1>${seg([['Tanul',''],['Nincs adat','ures'],['Ki','ki']],arg||'','tanulas')}</div>
  ${hero}
  ${empty?'':`<section class="open rise" style="--i:2"><span class="eb">Hétről hétre · 12 hét</span>${learnSvg()}
    <p class="fn">Szaggatott: a képlet. Folytonos: a keret alapja. A sáv a bizonytalanság. Üres kör: azon a héten vártam. Ahol nincs sor, a vonal megszakad.</p>
    ${ln('i-cal','szept. 28 – okt. 4.','képlet 2 400 · tanult 2 480 ± 150 · lépés +60 · 4 teljes nap · 4 mérlegelés','',{nochev:true,toast:'A hét számai'})}</section>`}
  <section class="open rise" style="--i:3"><span class="eb">Az utolsó 14 nap · a mai nem számít</span>
    ${LD.map(([d,k,st,on,can])=>`<div class="ln sm">${T(on?'t-tick':'t-shield')}<span class="g">${d}<small>${k==null?'':kc(k)+' kcal · '}${st}</small></span>${can?sw(!!on,d+' számít'):'<span class="v">—</span>'}</div>`).join('')}
    <p class="fn">A kapcsolóval megmondod, hogy egy nap teljes volt-e; azonnal újraszámolom. Felírás nélküli napot nem lehet jelölni.</p>
  </section>
  ${empty?'':`<section class="open rise" style="--i:4"><span class="eb">A legutóbbi hét részletei · hat lépésben</span>
    ${HW.map(([t],i)=>ln('t-info',`${i+1}. ${t}`,'','',{sheet:'hw',arg:i})).join('')}</section>`}
  `,'fuel','mai');
}

/* ═══ LAPOK (alulról) ═════════════════════════════════════════ */
const sheets={
  eq:()=>`${sheetH('t-bowl','Miből jön össze?','1 040 kcal fér még bele ma')}
    ${[['Alap','t-flame','a súlytrendedből és az evésedből tanulva','2 480'],['Mozgás','t-dumbbell','ma logolt mozgásod · még jön +460, ha megcsinálod a röpit','+ 650'],['Célod','t-ring','a fogyási célod napi része','− 30'],['Étel','t-bowl','amit ma eddig logoltál','− 2 060'],['Marad','t-bolt','a mai kereted maradéka','1 040']].map(([l,ic,s,v],i)=>`<div class="ln ${i===4?'tot':''}" ${i===0?'data-sheet="weekly"':''}>${T(ic)}<span class="g">${l}${i===0?'<span class="dot"></span>':''}<small>${s}${i===0?' · heti egyeztetés ›':''}</small></span><span class="v"><b>${v}</b></span></div>`).join('')}
    <p class="fn">A keretet az alapigényed, a súlycélod és a mai mozgásod együtt adja; a keret akkor nő, amikor logolod az edzést.</p>
    <div class="act"><button class="lk" data-sheet="energy">Részletesen, honnan jön a keret ›</button><button class="lk" data-close>Bezárom</button></div>`,
  energy:()=>`${sheetH('t-ring','Napi cél','Honnan jön a 3 100 kcal?')}
    <p class="txt sub">A napi cél nem statikus: az alapigényedből, a ma logolt mozgásodból és a célodból áll össze.</p>
    <div class="big" style="margin:10px 0"><span class="num" style="font-size:26px">2 480 + 650 − 30</span><span class="v">= 3 100</span></div>
    ${ln('t-history','Alap · tanult','a képlet (BMR × NEAT) 2 400-at mondana · közepesen biztos · ±150','<b>2 480</b>',{go:'tanulas'})}
    ${ln('t-dumbbell','Mozgás · ma logolva','Felsőtest A · 58 perc · 190 · Röpi edzés · 95 perc · 460','<b>+650</b>',{nochev:true,toast:'A keret akkor nő, amikor rögzíted az edzést'})}
    ${ln('t-ring','Célod','0,3 kg/hét · lassú ütem, hogy az edzés ereje megmaradjon','<b>−30</b>',{nochev:true,toast:'Cél ütem'})}
    <p class="fn">A tervezett, még meg nem csinált edzés csak halványan látszik; a becslés a nyugalmi energiád feletti többletet számolja. Ha rendszeresen túl- vagy alábecsül, a heti tanulás kiigazítja az alapodat.</p>`,
  water:()=>`${sheetH('t-water','Víz','Mennyit ittál?')}
    <div class="big"><span class="num">400</span><span class="v">ml · ma eddig 1,3 / 2,5 l</span></div>
    <div class="act">${tgl([['250 ml'],['400 ml'],['500 ml']],'400 ml')}</div>
    ${fld('Kézzel','pl. 330',{ph:true,toast:'ml kézzel'})}
    <div class="act"><button class="btn sm" data-toast="Víz mentve · 400 ml">Mentés</button><button class="lk" data-close>Mégse</button></div>`,
  /* heti egyeztetés: rövid modulok, mind átugorható (MacroFactor) */
  weekly:()=>`${sheetH('i-cal','Heti egyeztetés · szept. 28 – okt. 4.','3 lépés, kb. 2 perc; bármelyiket átugorhatod')}
    <div class="mod"><div class="modh"><span class="eb">1 / 3 · Miért most</span><button class="lk" data-toast="Átugorva">Kihagyom</button></div><p class="txt">Lezárult a hét, és a súlyod lassabban nőtt, mint amit a felírt evés alapján vártam. Alap 2 480 kcal · közepesen biztos · ±150.</p></div>
    <div class="mod"><div class="modh"><span class="eb">2 / 3 · Mi történt</span><button class="lk" data-toast="Átugorva">Kihagyom</button></div><p class="txt sub">Két napot kihagytam, mert hiányosnak tűntek. Ha teljesek voltak, mondd.</p>
      ${[['szerda, szept. 30.','1 180 kcal · hiányosnak tűnt',0],['vasárnap, okt. 4.','1 020 kcal · hiányosnak tűnt',0]].map(([d,s,on])=>`<div class="ln sm">${T('t-shield')}<span class="g">${d}<small>${s}</small></span><button class="lk" data-toast="Teljesnek jelölve · a keret +20 kcal">Teljes volt</button></div>`).join('')}</div>
    <div class="mod"><div class="modh"><span class="eb">3 / 3 · Javaslat</span><button class="lk" data-toast="Később">Később</button></div><p class="txt">A napi keretedben <b>+60 kcal</b>. Hetente csak kis lépést teszek, új irányba először csak félig.</p>
      <div class="act"><button class="btn sm" data-toast="Elfogadva · a keret 3 100 kcal">Elfogadom</button><button class="lk" data-go="tanulas">Részletek</button><button class="lk" data-toast="Elrejtettem; ezt a hetet nem mutatom újra" data-close>Bezárom</button></div></div>`,
  day:i=>{const [d,k,t,s,tr]=WEEK[+i]; return k==null?`${sheetH('t-plate','okt. '+(1+ +i)+'.','Ezen a napon nem naplóztál.')}<p class="txt">Nem töltöm ki becsléssel, és a heti átlagból is kimarad.</p><div class="act"><button class="btn sm" data-go="log">Pótolom a napot</button><button class="lk" data-close>Bezárom</button></div>`
    :`${sheetH('t-calendar','okt. '+(1+ +i)+'. · a nap pontja '+s,`${kc(k)} / ${kc(t)} kcal${tr?' · edzésnap':''}`)}
    <div class="mb"><span class="l">Kalória</span>${qbar(k,t)}<span class="v"><b>${kc(k)}</b> / ${kc(t)}</span><span class="l">Fehérje</span>${qbar(148,160)}<span class="v"><b>148</b> / 160 g</span><span class="l">Szénhidrát</span>${qbar(231,250)}<span class="v"><b>231</b> / 250 g</span><span class="l">Zsír</span>${qbar(66,75)}<span class="v"><b>66</b> / 75 g</span></div>
    <p class="txt sub" style="margin-top:8px">A kereted ezen a napon ${kc(t)} kcal volt. ${k>t?`${k-t} kcal-lal fölé ment; így alakult.`:'Belefértél; így alakult.'}</p>
    <span class="eb" style="margin-top:10px">A nap étkezései</span>
    ${ln('t-plate','Zabkása gyümölccsel','08:00 · 420 kcal',`<span class="sc">${T('t-score')}8,2</span>`,{toast:'Az étkezés részletei'})}${ln('t-plate','Csirkés rizstál','12:40 · 760 kcal',`<span class="sc">${T('t-score')}8,4</span>`,{toast:'Az étkezés részletei'})}
    <div class="act"><button class="lk" data-go="mai.tegnap">Megnézem a napot</button><button class="lk" data-close>Bezárom</button></div>`},
  item:name=>{const x=STACK.flatMap(b=>b.items).find(i=>i[0]===name)||STACK[1].items[1]; return `${sheetH('t-supps',x[0]+' · naponta',x[1]+' · '+x[2]+(x[3]?' · bevéve '+x[4]:' · ma még nincs bevéve'))}
    <p class="txt">Zsíros étkezéssel szívódik fel a legjobban; az ebéd a nap legzsírosabb pontja.</p>
    ${ln('t-stack','Ebből a termékből','kapszula · 1 db · készleten 42 db · napi összmennyiség '+x[1],'',{go:'kamra.kreatin'})}
    <div class="act"><button class="btn sm" data-toast="${x[3]?'Visszavonva':'Bevéve · '+esc(x[0])}">${x[3]?'Mégsem vettem be':'Bevettem'}</button><button class="lk" data-close>Bezárom</button></div>
    <p class="fn">Tájékoztatás, nem orvosi tanács.</p>`},
  stackitem:arg=>{const [pin,name]=(arg||'auto|Tasty Dose gombakávé').split('|'); return `${sheetH('t-supps',name,pin==='kézi'?'ide raktad kézzel (Ébredés)':'automatikusan időzítve')}
    ${pin==='kézi'?`<div class="act" style="margin-top:0"><button class="lk" data-toast="Vissza automatikusra">Vissza automatikusra</button></div>`:''}
    ${fld('Zóna','',{raw:tgl([['Ébredés'],['Reggeli'],['Edzés előtt'],['Edzés után'],['Ebéd'],['Vacsora'],['Este'],['Lefekvés']],'Ébredés')})}
    ${fld('Dózis','8 g',{toast:'Dózis'})}${fld('+ Bevétel','még egy dózis',{ph:true,toast:'Még egy bevétel'})}
    <div class="act"><button class="lk" data-toast="Eltávolítva a stackből" style="color:var(--bad)">Eltávolítás a stackből</button><button class="lk" data-close>Bezárom</button></div>`},
  dim:arg=>{const [id,i]=(arg||'reggeli|0').split('|'); const m=MEALS[id]||MEALS.reggeli; const [l,ic,w,txt,rows]=DIMS[+i]; return `${sheetH(ic,l+' · súly '+w+'%',fmt(m.dims[+i])+' / 10')}<p class="txt">${txt}</p>${rows.map(([k,v])=>ln('',k,'',`<b>${v}</b>`,{nochev:true,cls:'sm'})).join('')}`},
  glu:g=>`${sheetH('t-glucose','Vércukor',g==='1'?'közepes emelkedés várható':'alacsony emelkedés várható')}<p class="txt">${g==='1'?'A rizs gyors szénhidrátja most épp jól jön edzés után, de a következő órában laposabb a figyelem.':'A zab és a túró lassan ereszti a cukrot; egyenletes energia délig.'}</p><p class="fn">Becslés a hozzávalókból, nem mérés.</p>`,
  ora:()=>`${sheetH('t-clock','Az étkezési óra','miért ekkor, mire számíts')}<p class="txt">Az ablakok a napod valódi edzésblokkjaiból jönnek. Nem korlátok: bármelyik utólag is logolható, és egy manuálisan megadott idő átviheti az étkezést másik ablakba.</p>${SLOTS.map(s=>ln(s.ic,s.l,s.from+'–'+s.to,`<b>${s.b}</b> kcal`,{nochev:true,cls:'sm'})).join('')}<div class="act"><button class="lk" data-go="ablakok">Ablakok szerkesztése</button></div>`,
  import:()=>`${sheetH('t-camera','Új tétel a kamrába','fotó a címkéről vagy egy termék linkje')}<p class="txt sub">A nevet, makrókat és tápértékeket az AI olvassa ki /100 g bázison. A fotó nem kerül tárolásra.</p>
    <div class="act">${tgl([['Fotó'],['Link']],'Fotó')}</div>
    <button class="ph" style="margin-top:12px;height:120px" data-toast="Kamera · a tápérték-táblázat">${T('t-camera')}<strong>Címkefotó</strong><small>előlap fotó opcionális, ha a név nem látszik</small></button>
    <div class="act"><button class="btn sm" data-toast="Beolvasva · Skyr · epres · Milbona · 62 kcal">Beolvasás</button><button class="lk" data-close>Mégse</button></div>`,
  add:edit=>`${sheetH('t-journal',edit?'Tétel szerkesztése':'Új kamra-tétel',edit?'':'kézi felvétel')}
    ${fld('Típus','Étel ▾',{toast:'Típus'})}${fld('Név','pl. Görög joghurt 10%',{ph:true,toast:'Név'})}${fld('Forrás','Saját bevitel ▾',{toast:'Forrás'})}
    <div class="fld"><span class="eb">Makrók /100 g</span><span class="in">119 kcal</span><span class="in">6 feh.</span><span class="in">4 szénh.</span><span class="in">9 zsír</span></div>
    <div class="fld"><span class="eb">Tápanyag /100 g</span><span class="in ph">Rost</span><span class="in ph">Cukor</span><span class="in ph">Tel. zsír</span><span class="in ph">Só</span></div>
    ${fld('Ár','750 Ft',{ph:true,toast:'Ár'})}
    <div class="act"><button class="btn sm" data-toast="${edit?'Mentve':'A polcra került'}">${edit?'Mentés':'Polcra'}</button><button class="lk" data-close>Mégse</button></div>`,
  catalog:()=>`${sheetH('t-stack','Hozzáadás a közösből','közös katalógus')}<div class="srch" style="margin:0 0 8px" data-toast="Keresés a közösben">${T('t-basket')}Keresés név vagy márka szerint</div>${tgl([['Mind'],['Étel'],['Supp'],['Stim'],['Gyógyszer']],'Mind')}
    ${[['Skyr natúr','Ehrmann · 63 kcal/100 g · Anna',0],['Bulgur','Kifli · 342 kcal/100 g · mezo',0],['Kreatin-monohidrát','— · kiegészítő · Béla',1]].map(([n,s,on])=>`<div class="ln">${T('t-carb')}<span class="g">${n}<small>${s}</small></span>${on?'<span class="v">a polcon</span>':'<button class="lk" data-toast="A polcra került">+ Polcra</button>'}</div>`).join('')}`,
  catfilter:()=>`${sheetH('','Mit mutassak?','kategória-szűrő · 0 kiválasztva')}${tgl([['Fehérje',1],['Tejtermék',1],['Hal',1],['Gabona',1],['Mag / olajos',1],['Whey / protein',1],['Kiegészítő',1],['Stimuláns',1]],'')}<div class="act"><button class="btn sm" data-close>Szűrés · 8 tétel</button></div>`,
  kamrapick:()=>`${sheetH('t-stack','Válassz a polcról','kamra · hozzáadás')}<div class="srch" style="margin:0 0 4px" data-toast="Keresés a kamrában">${T('t-basket')}Keress a kamrában…</div>
    ${KAM.filter(k=>k.k==='food').slice(0,4).map((k,i)=>`<div class="ln">${T('t-carb')}<span class="g">${k.n}<small>${k.b} · ${k.p} feh. · ${k.c} szénh. · ${k.f} zsír /100 g</small></span><span class="v"><b>${k.kcal}</b> kcal</span><button class="lk" data-toast="${i===1?'Már a listában':'Hozzáadva: '+esc(k.n)}">${i===1?'✓':'+'}</button></div>`).join('')}`,
  receptpick:()=>`${sheetH('t-book','Válassz receptet','recept · hozzáadás')}${REC.slice(0,4).map(r=>ln(CAT[r.cat][1],r.n+(r.star?' · csillagos':''),`${CAT[r.cat][0]} · ${Math.round(r.p/r.serv)} / ${Math.round(r.c/r.serv)} / ${Math.round(r.f/r.serv)} g`,`<b>${Math.round(r.kcal/r.serv)}</b> kcal / adag`,{go:'log.tetelek'})).join('')}`,
  reclogs:id=>{const r=REC.find(x=>x.id===id)||REC[0]; return `${sheetH('t-journal','Logok · '+r.logged,r.n)}${[['ma 07:20','689 kcal','8,4'],['tegnap 07:30','689 kcal','8,3'],['szept. 19. 07:10','620 kcal','8,1']].map(([d,k,s])=>ln('t-plate',d,k,`<span class="sc">${T('t-score')}${s}</span>`,{nochev:true,cls:'sm'})).join('')}`},
  dose:()=>`${sheetH('t-syringe','Új beadás','Retatrutid')}${fld('Mikor','2026. 10. 07. · 14:10',{toast:'Időpont'})}${fld('Dózis','6 mg',{toast:'Dózis'})}${fld('Jegyzet','pl. hétfő reggel · subQ has',{ph:true,toast:'Jegyzet'})}<div class="act"><button class="btn sm" data-toast="Beadás rögzítve">Beadás</button><button class="lk" data-close>Mégse</button></div>`,
  medform:()=>`${sheetH('t-syringe','Gyógyszer felvétele','')}${fld('Név','pl. Retatrutid',{ph:true,toast:'Név'})}${fld('Hatóanyag','retatrutid',{ph:true,toast:'Hatóanyag'})}
    ${fld('Beviteli út','',{raw:tgl([['subQ injekció'],['IM injekció'],['orális']],'subQ injekció')})}${fld('Kadencia','',{raw:tgl([['heti'],['napi']],'heti')})}${fld('Nap','',{raw:tgl([['H'],['K'],['Sze'],['Cs'],['P'],['Szo'],['V']],'H')})}
    <span class="eb" style="margin-top:10px">Ciklus · fázisok</span><div class="cyc">${['C','C','S','S','S','V','V'].map((g,i)=>`<span>${g}<small>${i+1}</small></span>`).join('')}</div><p class="fn">Alap-sablon: 2 nap csúcs · 3 nap stabil · 2 nap völgy; a beadás napjától számolva.</p>
    <div class="act"><button class="btn sm" data-toast="Felvéve">Felveszem</button><button class="lk" data-close>Mégse</button></div>`,
  hw:i=>{const [t,b]=HW[+i]||HW[0]; return `${sheetH('t-info',`${+i+1}. ${t}`,'a legutóbbi hét · szept. 28 – okt. 4.')}<p class="txt">${b}</p>${+i<5?`<div class="act"><button class="lk" data-sheet="hw" data-arg="${+i+1}">Következő lépés ›</button></div>`:''}`}
};

/* ═══ CSS (csak a Fuel területre) ═══════════════════════════════ */
const css=`
${P} .verdict{font-size:17px;font-weight:600;letter-spacing:-.3px;line-height:1.25;margin:2px 0 4px;text-wrap:balance}
${P} .open.first{border-top:0}
${P} .ln.first{border-top:0;padding-top:4px}
${P} .ln.sm{padding:8px 0}
${P} .ln.slot .g{color:var(--sub)}
${P} .ln .g .lk,${P} .ln .lk{white-space:nowrap}
${P} .ln .g[data-sheet]{cursor:pointer}
${P} .ln.tot .v b{font-size:15px}
${P} .ln .sc{display:inline-flex;align-items:center;gap:3px;font-family:var(--mono);font-size:11px;color:var(--sub)}
${P} .ln .sc svg.ic.td{width:12px;height:12px;opacity:.8}
${P} .ln .g small .tgl{margin-top:4px}
${P} .tg2{display:inline-flex;gap:14px;font-family:var(--mono);font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:var(--faint);align-items:center}
${P} .tg2 button{color:inherit;padding:2px 0;border-bottom:1.5px solid transparent;white-space:nowrap}
${P} .tg2 button.on{color:var(--ink);border-color:var(--acc)}
${P} .tgl{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--sub)}
${P} .tgl button{padding:3px 0;border-bottom:1.5px solid transparent;color:inherit;white-space:nowrap}
${P} .tgl button.on{color:var(--ink);border-color:var(--acc)}
${P} .tgl b{font-family:var(--mono);font-weight:500;color:var(--faint);margin-left:4px;font-size:11px}
${P} .rib{display:flex;gap:4px;padding:10px 12px 2px;overflow-x:auto;scrollbar-width:none}
${P} .rib::-webkit-scrollbar{display:none}
${P} .rib button{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:58px;padding:8px 4px 6px;border-radius:12px;font-size:10.5px;color:var(--sub);flex:0 0 auto}
${P} .rib button svg.ic.td{width:26px;height:26px}
${P} .rib button.on{color:var(--ink);background:color-mix(in srgb,var(--acc) 12%,transparent)}
${P} .mb{display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;margin-top:10px}
${P} .mb .l{font-size:12.5px;color:var(--sub)}
${P} .mb .v{font-family:var(--mono);font-size:12px;color:var(--sub);white-space:nowrap;font-variant-numeric:tabular-nums;text-align:right}
${P} .mb .v b{color:var(--ink);font-weight:500}
${P} .mb .bar{height:5px}
${P} .fld{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--hair);flex-wrap:wrap}
${P} .fld:first-of-type{border-top:0}
${P} .fld .eb{margin:0;flex:0 0 92px}
${P} .fld .tgl,${P} .fld .stp{flex:1}
${P} .in{flex:1;min-width:0;font-size:13.5px;padding:8px 10px;border-radius:8px;background:var(--card2);border:1px solid var(--hair);color:var(--ink);font-family:inherit;outline:none}
${P} .in.ph{color:var(--faint)}
${P} input.in{color-scheme:dark}
${P}[data-t="light"] input.in{color-scheme:light}
${P} .stp{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:13px;color:var(--ink);white-space:nowrap}
${P} .stp small{color:var(--sub);font-size:11px}
${P} .stp button{width:26px;height:26px;border-radius:50%;border:1px solid var(--hair);color:var(--ink);display:grid;place-items:center;font-size:15px;line-height:1}
${P} .sw{width:34px;height:20px;border-radius:10px;background:var(--hair);position:relative;flex:0 0 auto;border:1px solid var(--hair)}
${P} .sw::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--sub);transition:.2s}
${P} .sw.on{background:var(--acc);border-color:var(--acc)}
${P} .sw.on::after{left:16px;background:var(--acc-ink)}
${P} .tk{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--hair);display:grid;place-items:center;color:transparent;flex:0 0 auto}
${P} .tk.on{border-color:transparent;background:rgba(230,233,234,.14);color:var(--sub)}
${P}[data-t="light"] .tk.on{background:rgba(21,34,44,.10)}
${P} .tk svg.ic{width:13px;height:13px;stroke-width:2.4}
${P} .plate{position:absolute;left:10px;right:10px;bottom:92px;z-index:25;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;background:color-mix(in srgb,var(--card) 92%,transparent);border:1px solid var(--hair);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 16px 30px -16px rgba(0,0,0,.6)}
${P} .plate .g{flex:1;min-width:0}
${P} .plate strong{display:block;font-size:13.5px;font-weight:600}
${P} .plate small{display:block;font-size:11.5px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .plate svg.ic.td{width:28px;height:28px}
${P} .savebar{display:flex;gap:16px;align-items:center;justify-content:flex-end;padding:14px 16px 0}
${P} .savebar .btn{min-width:140px}
${P} .cmp{display:flex;gap:8px;align-items:flex-start;padding:10px;border-radius:12px;background:var(--card2);border:1px solid var(--hair)}
${P} .cmp textarea{flex:1;min-width:0;min-height:54px;background:none;border:0;color:var(--ink);font:inherit;font-size:14px;line-height:1.4;resize:none;outline:none}
${P} .cmp textarea::placeholder{color:var(--faint)}
${P} .cmp button{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--hair);color:var(--sub);flex:0 0 auto}
${P} .cmp button svg.ic.td{width:20px;height:20px}
${P} .cmp button.go{background:var(--acc);border-color:var(--acc)}
${P} .ph{width:100%;height:150px;border-radius:16px;border:1px dashed var(--hair);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--sub);font-size:12.5px;text-align:center}
${P} .ph strong{color:var(--ink);font-size:14px;font-weight:600}
${P} .ph svg.ic.td{width:36px;height:36px;margin-bottom:4px}
${P} .srch{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--card2);border:1px solid var(--hair);color:var(--faint);font-size:13.5px}
${P} .srch span{color:var(--ink)}
${P} .srch svg.ic.td{width:22px;height:22px}
${P} .dn{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 16px 2px}
${P} .dn .ar{width:32px;height:32px;border-radius:50%;border:1px solid var(--hair);color:var(--sub);font-size:18px;line-height:1;display:grid;place-items:center}
${P} .dn .lbl{text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px}
${P} .dn .lbl b{font-size:15px;font-weight:600}
${P} .cyc{display:flex;gap:4px;margin-top:10px}
${P} .cyc span{flex:1;height:34px;border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--mono);font-size:11px;color:var(--sub);background:var(--card2);border:1px solid var(--hair);line-height:1}
${P} .cyc span small{font-size:8.5px;color:var(--faint);margin-top:2px}
${P} .cyc span.now{border-color:var(--acc);color:var(--ink)}
${P} .mod{padding:12px 0;border-top:1px solid var(--hair)}
${P} .mod:first-of-type{border-top:0}
${P} .modh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
${P} .modh .eb{margin:0}
${P} .shh{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}
${P} .shh svg.ic.td{width:30px;height:30px;flex:0 0 auto;margin-top:2px}
${P} .shh .g{flex:1;min-width:0}
${P} .shh .eb{margin-bottom:4px}
${P} .shh h2.t{margin:0}
${P} .sheet .ln svg.ic.td{width:24px;height:24px}
${P} svg.tch{width:100%;height:auto;display:block;margin-top:10px;overflow:visible}
${P} .tch text{font-family:var(--mono);font-size:9px;fill:var(--faint)}
${P} .tch text.on{fill:var(--acc);font-weight:500}
${P} .tch text.faint{fill:var(--faint);opacity:.6}
${P} .tch .grid{stroke:var(--hair)}
${P} .tch .col{fill:rgba(230,233,234,.26)}
${P}[data-t="light"] .tch .col{fill:rgba(21,34,44,.18)}
${P} .tch .col.up{fill:none;stroke:var(--sub);stroke-width:1.2}
${P} .tch .tot{fill:var(--acc)}
${P} .tch .gap{fill:none;stroke:var(--hair);stroke-dasharray:3 3}
${P} .tch .tgt{stroke:var(--sub);stroke-width:1.2;stroke-dasharray:3 2}
${P} .tch .tr{fill:none;stroke:var(--acc);stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round;filter:drop-shadow(0 0 5px color-mix(in srgb,var(--acc) 60%,transparent))}
${P} .tch .raw{fill:var(--sub);opacity:.7}
${P} .tch .hold{fill:var(--page);stroke:var(--acc);stroke-width:1.6}
${P} .tch .thin{fill:none;stroke:var(--sub);stroke-width:1.2;opacity:.7}
${P} .tch .thin.dash{stroke-dasharray:4 4}
${P} .tch .band{fill:color-mix(in srgb,var(--acc) 14%,transparent)}
${P} .lead.p16{display:block;padding:0 16px}
${P} .big{flex-wrap:wrap;row-gap:2px}
${P} .big .num{letter-spacing:-1.2px;white-space:nowrap}
${P} .big .v{min-width:0}
${P} h1.t{text-wrap:balance}
`;

/* apró, újrarajzolás nélküli váltók: pipák és kapcsolók */
if(!window.__fuelTk){window.__fuelTk=true;document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tk],[data-sw]'); if(!t||!t.closest('.phone[data-d="fuel"]')) return;
  e.preventDefault(); const on=t.classList.toggle('on'); if(t.hasAttribute('data-sw')) t.setAttribute('aria-checked',String(on));
  toast(t.hasAttribute('data-sw')?(on?'Bekapcsolva':'Kikapcsolva'):(on?'Bevéve · 14:10':'Visszavonva'));
});}

register('fuel',{
  mark:'i-bowl',
  tabs:[['Mai','c-i-tanyer','mai'],['Kiegészítők','c-i-kiegeszito','stack'],['Trendek','c-i-trend','trendek'],['Konyha','c-i-fazek','konyha']],
  routes:{mai,meal,score,log,konyha,kamra,receptek,recept,'recept-uj':editor,muhely,stack,protokoll,'stack-uj':stackUj,gyogyszer,trendek,beallitas,ablakok,tanulas},
  sheets,
  css,
  notes:`<h2>Fuel</h2>
<p><b>Mi ez:</b> a Fuel terület minden képernyője az Ajánlott (csepp) nyelven, az élő prototípus útvonal-neveivel; a <i>Jelenlegi</i> fülön ugyanaz az útvonal az élő nézetet mutatja, így egymás mellé tehető a kettő.</p>
<h2>Útvonalak</h2>
<ul>
<li><b>#a-fuel-mai</b> · a nap. Fent egy üvegkártya a kalap: a mai számok (evett / keret, három makró-sáv), a <i>Ma · Hét</i> váltóval (<b>#a-fuel-mai.het</b>) a heti oszlopok. Alatta a bevitel-szalag (Fotó · Keresés · Gyors · Diktálás · Recept · Szokásosak), <i>A napod</i> idővonal az étkezésekkel és a még üres ablakokkal (az ablakok megmaradtak), Víz · rost, Heti egyeztetés, a nap jelölése a tanulásban, Tegnap és Beállítások. <b>#a-fuel-mai.tegnap</b> a tegnapi nap pótlás-nézete, <b>#a-fuel-mai.ures</b> az adat nélküli nap.</li>
<li><b>#a-fuel-meal.reggeli</b> / <b>.tizorai</b> / <b>.ebed</b> · egy étkezés: hős a kalóriával és a nap-százalékkal, <i>Hatás a napra</i> (mennyit tett a napi keretedhez; MacroFactor „impact”), hozzávalók → kamra, minőség, Mezo jegyzete, javítás / recept mentése.</li>
<li><b>#a-fuel-score.reggeli</b> · az értékelés: a pont, az ítélet-mondat, 8 szempont sorban, a leggyengébb megnevezve; egy sor → lap.</li>
<li><b>#a-fuel-log</b> · a logolás egy oldalon, a szalag minden módja egy koppintásra: <b>.foto</b>, <b>.kereses</b> (keresés közben alul a kicsinyített <i>Tányér</i>), <b>.gyors</b>, <b>.diktalas</b>, <b>.recept</b>, <b>.szokasos</b> („ilyenkor szoktál”, idő szerint), <b>.tetelek</b> (elemzés után: tételek, az étkezés összege és hatása a napra, az összecsukott <i>Mikor ettél?</i> sor, mentés), <b>.ido</b> (az időválasztó nyitva), <b>.hiba</b> (nem ismert tányér), <b>.w0–w3</b> (egy ablakból indítva).</li>
<li><b>#a-fuel-konyha</b> · két gyors művelet, a Receptműhely üvegben, Receptek és Kamra sorok. <b>#a-fuel-receptek</b>, <b>#a-fuel-recept.r1</b> (1 adag · egész váltó: <b>.r1.egesz</b>), <b>#a-fuel-recept-uj</b> (szerkesztő), <b>#a-fuel-muhely</b> és <b>.vazlat</b>.</li>
<li><b>#a-fuel-kamra</b>, <b>.ures</b>, <b>.csirke</b> (és a többi tétel): keresés, szűrők szövegként, nyitott lista, Okosabb csere; a tétel oldalán makrók, minőség, receptek, logolás.</li>
<li><b>#a-fuel-stack</b> · Következik üvegben, a napszakok nyitott listában pipákkal (a pipa koppintható), Protokoll · Új elem · Gyógyszer. <b>#a-fuel-protokoll</b>, <b>#a-fuel-stack-uj.1/2/3</b>, <b>#a-fuel-gyogyszer</b> és <b>.aktiv</b>.</li>
<li><b>#a-fuel-trendek</b> · trend-első: a heti kép üvegben (a hét napja a keretéhez mérve, a nap pontja fölötte, a nem naplózott nap szaggatott), három állapot-sor, hétköznap/hétvége, a hosszabb táv (simított súlytrend a főszereplő, a mérések pontok, a kcal vékonyan), a cél felé vízesés-ábrán, mintázatok.</li>
<li><b>#a-fuel-beallitas</b>, <b>#a-fuel-ablakok</b> és <b>.szerk</b>, <b>#a-fuel-tanulas</b> (+ <b>.ures</b>, <b>.ki</b>): a tanulás görbéje és a 14 nap kapcsolói; a hat magyarázó lépés sorokból nyílik lapként.</li>
</ul>
<h2>Lapok</h2><p>Miből jön össze? → Honnan jön a keret; Víz; Heti egyeztetés (három rövid modul, mindegyik átugorható); nap a Trendekből; stack-elem; protokoll-elem; értékelés-szempont; vércukor; étkezési óra; import; új tétel; közös katalógus; szűrő; kamra- és receptválasztó; recept-logok; beadás; gyógyszer-űrlap; a „Hogy tanultam?” hat lépése.</p>
<h2>Alkalmazott elvek</h2>
<ul><li><b>Kalap + listák:</b> egy üvegkártya fent, alatta nyitott szakaszok; egy sor egy belső oldalt nyit.</li>
<li><b>Elért cél = semleges:</b> a makró-sáv a cél elérésekor szürke lesz (a heti oszlopok is); nincs pipa, nincs dicséret.</li>
<li><b>Ragaszkodás-semleges, sorozatok nélkül:</b> a fehérje/szénhidrát/zsír szín csak azonosít; az ítélet-mondatok megfigyelők („így alakult”); a keret feletti nap sem piros.</li>
<li><b>Minden bevitel egy koppintásra, kicsinyített Tányér, idő-alapú logolás:</b> alapból a mostani idő, „ilyenkor szoktál” javaslatok; az ablakok és az összecsukott <i>Mikor ettél?</i> sor megmaradt.</li>
<li><b>Trend-első ábrák, vízesés a célhoz; heti egyeztetés modulokban; a tudomány lapként, nem bekezdésként.</b></li>
<li><b>A csepp csak a napot jelenti:</b> itt sehol nem mér ételt; a fejlécben és az alsó menü terület-jelén él.</li></ul>
<h2>Amit nem tudtam leképezni</h2>
<ul><li>Az alsó menü ikonjai a kit rögzített készletéből jönnek: a Kiegészítők a réteg-jelet (<i>stack</i>), a Trendek a mezociklus-oszlopokat viseli; a Konyha a napló-könyvet a fazék helyett. Ha a készlet bővül, cserélhető.</li>
<li>A fotó-, kamera- és hangbevitel, a stepperek és a szűrők koppintásra csak visszajelzést adnak; a pipák és kapcsolók átváltanak.</li>
<li>Az élő prototípus „PROTOTÍPUS · állapotváltó” sorai itt útvonal-argumentumok (<b>.ures</b>, <b>.ki</b>, <b>.hiba</b>).</li></ul>`
});
})();
