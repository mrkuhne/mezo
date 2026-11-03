/* vilagos/kiserlet-en.js — EXPERIMENT (mezo-pi0jf), the Én domain in the system the Nap, Edzés, Fuel and Mezo domains
   settled on (KISERLET.md): one tinted ground, the sentence on top with the page's own picture, plain headings, roomy cards
   of one shape per object, grey notes as Mezo's lines, no abbreviations. NOT part of the build target: loaded only by
   ../kiserlet-napom-grafika.html after the other kiserlet-*.js files, whose styles (now scoped to en too) and helpers
   (window.KXN, window.KXE) it reuses. The approved pages stay reachable as <route>-lista.
   Én's own soft re-render (en.js `soft`) renders the approved pages, so the pages here carry no data-ev hooks; their
   in-place state runs on data-w12 instead. */
(function(){
const F=window.F,en=window.FREG&&FREG.en,X=window.KXN,E=window.KXE;if(!en||!X||!E)return;
const {I,badge,page}=F,{KH,hubHead}=X,{bal,drop,g}=E;
const P='.phone.foly[data-s="elo"][data-d="en"]';
const O={mai:en.routes.mai};en.routes['mai-lista']=O.mai;
const mzLine=t=>`<div class="ex-mz w12-mz">${badge('mezo',{s:30})}<p>${t}</p></div>`;
const row=(ic,t,sub,go,extra='')=>`<button class="ex-mrow w12-r" data-go="${go}">${drop(ic)}<span class="g"><b>${t}</b><i class="q">${sub}</i>${extra}</span><em>›</em></button>`;
const lvl=(p,cap)=>`<span class="w12-lv"><span class="t"><i style="width:${p}%"></i></span><b>${cap}</b></span>`;

/* ═══ HOL TARTOK (2026-11-02): the week on top (owner: "a heti összkép legyen felül") — the verdict, the score and the
   seven day tubes as the picture, one wide "A heti elemzés"; Jól ment / Nézd meg as Mezo's line. The four vials stay
   (no abbreviations under them); the lifeline keeps its surface and buoys (a buoy tap swaps Mezo's line in place), its
   labels readable; the four goals on ONE card shape (name, direction, level, the week as seven capsules); Fejlődés and
   Emberek as two rows, "12. szint" and "pont" instead of Lv / XP. ═══ */
const ST=[['Tempó átállítva','július 8.','Heti 0,4 kilogrammra lassítottad a tempót, azóta egyenletes.'],['Új mélypont · 80 kilogramm alatt','augusztus 19.','Először mértél 80 kilogramm alatti heti átlagot.'],
  ['Új képesség: Páncélzat','szeptember 2.','10 hét töretlenül: a sérülésállóság nő.'],['Új mélypont','szeptember 24.','78,4 kilogramm: a 12 hét legalacsonyabb átlaga.']];
const ST0='Koppints egy bójára a felszínen, és elmondom, mi történt ott.';
const GO=[{t:'Súlycél',ar0:'Egészség',ic:'t-weight',p:33,dir:'halad',sub:'78,4 → 73 kilogramm · heti fél kilogramm · körülbelül 11 hét',go:'sulycel'},
  {t:'Side hustle',ar0:'Teljesítmény és Elmélyülés',ic:'t-record',p:64,dir:'emelkedik',ar:'↗',ma:'ma 2 a 3-ból',d:['hit','hit','part','hit','miss','hit','hit'],go:'cel'},
  {t:'Kockahas',ar0:'Egészség és Teljesítmény',ic:'t-sprout',p:71,dir:'tartja',ar:'→',ma:'ma 3 az 5-ből',d:['hit','part','hit','hit','part','miss','hit'],go:'cel'},
  {t:'Az utolsó barátnő',ar0:'Kapcsolatok és Érzelem',ic:'t-people',p:52,dir:'emelkedik',ar:'↗',ma:'ma 1 a 2-ből',d:['hit','nd','hit','part','hit','hit','nd'],go:'cel'}];
const week=d=>`<span class="w12-wk" role="img" aria-label="A hét napjai">${d.map(x=>`<i class="${x}"></i>`).join('')}</span>`;
const goal=o=>`<button class="w12-g" data-go="${o.go}"><span class="w12-gh">${drop(o.ic)}<span class="w12-gt"><b>${o.t}</b><span class="w12-ga"><span class="w12-dir${o.ar==='→'?' fl':''}">${o.ar?`<span aria-hidden="true">${o.ar}</span>`:''}${o.dir}</span><small>${o.ar0}</small></span></span></span>
  ${lvl(o.p,o.p+'%')}<span class="w12-gs">${o.d?`${week(o.d)}<small>${o.ma}</small>`:`<small>${o.sub}</small>`}</span></button>`;
function mai12(a){if(a)return O.mai(a);
  const base=O.mai(''),ti=base.indexOf('<div class="en-tubes week"'),tubes=ti<0?'':base.slice(ti,bal(base,ti));
  const ci=base.indexOf('<div class="en-chart">');let chart=ci<0?'':base.slice(ci,bal(base,ci));
  chart=chart.replace(/data-ev="stn:(\d)"/g,'data-w12="stn:$1"').replace(/<text class="gl"[^>]*>aug\. 19\.<\/text>/,'')
    .replace('>júl. 8.<','>július 8.<').replace('>szept. 24.<','>szeptember 24.<');
  const si=base.indexOf('<div class="en-slband"'),band=si<0?'':base.slice(si,bal(base,si));
  const vials=F.vials([{l:'Súly',ic:'t-weight',p:80,v:'−0,4 kg',s:'kilogramm hetente · átlag 78,6',mark:'−0,5',on:'test'},
     {l:'Alvás',ic:'t-sleep',c:'var(--warn)',p:90,v:'7,3 óra',s:'a cél alatt',mark:'7,5 óra',on:'test.alvas'},
     {l:'Edzés',ic:'t-dumbbell',c:'var(--info)',p:75,v:'3 / 4',s:'mint a múlt héten',mark:'4',on:{dom:'edzes'}},
     {l:'Fehérje',ic:'t-meat',c:'var(--protein)',p:96,v:'212 g',s:'öt napon célon',mark:'200',on:{dom:'fuel'}}],{h:128});
  const leg=[['ln','súly, heti átlag'],['bd','alvás, heti átlag: 6,4–7,3 óra'],['st','állomás: koppints rá'],['pl','cél: 73,0 kilogramm']].map(([c,t])=>`<span><i class="${c}"></i>${t}</span>`).join('');
  return page('en',{title:'Én',sub:'Daniel · szept. 21–27.',tab:'mai'},`<div class="mx">
  <section class="mx-s ex-hero"><small class="ex-eb">Szeptember 21–27. · lezárt hét</small><h2 class="n7-h">Az egyensúly hete.</h2>
    <p class="w12-sc"><b>78</b><span>pont a 100-ból<br>4-gyel több, mint a múlt héten</span></p>
    <div class="w12-days">${tubes}</div>
    ${mzLine('Jól ment: öt napon megvolt a fehérje, és stabil volt az alvásod. Nézd meg a két késői vacsorát: utánuk felszínesebben aludtál.')}
    <div class="ex-acts w12-wide"><button class="n9-btn" data-go="het">A heti elemzés</button></div></section>
  <section class="mx-s ln">${KH('Ami a héten mozdult')}<div class="w12-vi">${vials}</div>
    ${mzLine('Az edény teteje a heti célod. Színt az kap, ami figyelmet kér: az alvás a 7,5 órás cél alatt maradt.')}</section>
  <section class="mx-s ln">${KH('Életvonal','',`<button class="w12-lk" data-go="test">Súly ›</button>`)}
    <p class="w12-ln"><b>−3,8 kilogramm</b> 12 hét alatt. A 7 napos átlag most 78,4 kilogramm, a felszín a cél vonala felé apad.</p>
    <div class="w12-ch">${chart}${band}<div class="w12-leg">${leg}</div></div>
    <div class="ex-mz w12-mz" id="w12-stn">${badge('mezo',{s:30})}<p>${ST0}</p></div>
    <div class="w12-rl">${row('t-target','A következő állomás: 73,0 kilogramm','Még 5,4 kilogramm van hátra.','sulycel')}</div></section>
  <section class="mx-s ln">${KH('Célok állása')}<div class="w12-gl">${GO.map(goal).join('')}</div>
    <div class="ex-acts"><button class="n8-b" data-go="celok">Mind a 4 cél ›</button></div></section>
  <section class="mx-s ln">${KH('Fejlődés és emberek')}<div class="w12-rl">
    ${row('t-up','Fejlődés · A kitartó · 12. szint','3 140 pont · 240 érme · 82% fegyelem · 6 hete tartod a ritmust','novekedes',lvl(12,'420 a 3 500 pontból'))}
    ${row('t-people','Emberek','Petra háromszor ezen a héten · 8 említés · Bence hangulata lejt','emberek')}</div>
    ${mzLine('A rutinod a Nap fül Rutin oldalán épül.')}</section>
  <div class="ng-tail"></div></div>`)}
en.routes.mai=mai12;en.routes.en=mai12;

/* ═══ TEST (2026-11-02, owner: the weight on top): the Súly / Alvás switch stays; each view opens with its sentence, the
   big number and its own picture (the weight surface with the period switch / the eight sleep weeks), one wide log button.
   The approved cards follow under plain headings, their grey notes as Mezo's lines, no abbreviations ("óra", full months).
   The period / week / window switches are approved data-ev hooks: en.js updates its state, then this page redraws itself
   in the same scroll position (see the listener below). ═══ */
O.test=en.routes.test;en.routes['test-lista']=O.test;
const MON={'jan.':'január','febr.':'február','márc.':'március','ápr.':'április','jún.':'június','júl.':'július','aug.':'augusztus','szept.':'szeptember','okt.':'október','nov.':'november','dec.':'december'};
const hu=h=>h.replace(/\b(jan|febr|márc|ápr|jún|júl|aug|szept|okt|nov|dec)\. /g,(m,k)=>MON[k+'.']+' ').replace(/(\d) ó(?=[\s<·])/g,'$1 óra').replace(/(\d) ó cél/g,'$1 óra a cél')
  .replace(/>09\/(\d\d)</g,'>szeptember $1.<').replace(/· min (\d)/g,'· legkisebb $1').replace(/kg \/ hét/g,'kg hetente');
const nH=(h,f)=>{const m=h.slice(f).search(/<p class="fh-n[ "]/);return m<0?-1:f+m};
const sects=(base,from)=>{const out=[];let i=nH(base,from);
  while(i>=0){const hd=base.slice(i,base.indexOf('</p>',i)).replace(/^[\s\S]*<\/b>/,''),ci=base.indexOf('<section',i),ce=bal(base,ci,'section');
    out.push({hd,html:base.slice(ci,ce)});i=nH(base,ce)}return out};
const tidy=h=>hu(h).replace(/ rise"/g,'"').replace(/<p class="fh-note"[^>]*>([\s\S]*?)<\/p>/g,(m,t)=>mzLine(t));
const sec12=(hd,body)=>`<section class="mx-s ln">${KH(hd)}<div class="w12-cw">${body}</div></section>`;
const legend=a=>`<div class="w12-leg">${a.map(([c,t])=>`<span><i class="${c}"></i>${t}</span>`).join('')}</div>`;
function suly12(base){
  const hi=base.indexOf('<section class="fh-card fh-hero'),H=base.slice(hi,bal(base,hi,'section'));
  const cutIn=(h,m,t='div')=>{const i=h.indexOf(m);return i<0?'':h.slice(i,bal(h,i,t))};
  const seg=cutIn(H,'<div class="en-hseg"'),chart=cutIn(H,'<div class="en-chart"');
  const ss=sects(base,bal(base,hi,'section')),tap=ss[0]?cutIn(ss[0].html,'<svg class="en-tap"','svg'):'';
  const obs=ss[1]?ss[1].html:'',hist=ss[2]?ss[2].html:'';
  return `<section class="mx-s ex-hero"><small class="ex-eb">A súlyod · 7 napos átlag</small><h2 class="n7-h">Egyenletesen apad: fél kilogramm hetente.</h2>
    <p class="w12-sc"><b>78,4</b><span>kilogramm<br>ma mérve 78,2 · induláskor 81,4 · a cél 73</span></p>
    <div class="w12-seg">${seg}</div><div class="w12-ch w12-wch">${hu(chart)}${legend([['ln','súly, 7 napos átlag'],['raw','napi mérés'],['pl','a terv'],['tol','tűréssáv'],['pr','vetítés a célig']])}</div>
    <div class="ex-acts w12-wide"><button class="n9-btn" data-sheet="weight">+ Súly</button><button class="n8-b" data-go="sulycel">Súlycél</button></div></section>
  <section class="mx-s ln">${KH('A tempó')}<div class="w12-tp">${tap}<p><b>−0,5 kg</b><span>hetente, 4 hete ez a tempó</span></p></div>
    <div class="w12-st"><span><b>78,4 kg</b><small>most</small></span><span><b>−0,4 kg</b><small>az utolsó 7 napban</small></span><span><b>11 hét</b><small>a célig</small></span></div>
    ${mzLine('Pont a terv szerint csordogál. A célból 33% megvan, 5,4 kilogramm van hátra.')}<div class="w12-lw">${lvl(33,'33%')}</div></section>
  <section class="mx-s ln">${KH('Megfigyelés')}<div class="w12-cw"><div class="w12-ob"><div class="w12-gh">${drop('t-eye')}<b>Zsír megy, az erő marad</b></div>
    <p>Négy hét alatt <b>2,0 kilogrammot</b> esett a trend, miközben a fő emeléseid súlya <b>1,2%-kal</b> nőtt. Ez inkább zsírvesztés, mint izom. A Védőkorlátok ugyanezt mondják.</p>
    <div class="ex-acts w12-in"><button class="n8-b" data-go="sulyresz.guards">Védőkorlátok ›</button></div></div></div></section>
  ${hist?sec12('Heti előzmény',hist12(hist)):''}`}
/* one week = one row: the dates and the change on top, the week's small surface and its line under them; open = its days */
function hist12(h){h=tidy(h);const rows=[];let i=h.indexOf('<button class="fh-row" data-ev="wk:');
  while(i>=0){const e=bal(h,i,'button'),r=h.slice(i,e),di=h.indexOf('<div class="en-days"',e),nx=h.indexOf('<button class="fh-row" data-ev="wk:',e);
    const days=di===e?h.slice(di,bal(h,di)):'';
    const ev=g(r,/data-ev="([^"]+)"/),sp=(k=>r.slice(k,bal(r,k,'svg')))(r.indexOf('<svg class="en-ls"')),t=g(r,/<strong>([^<]*)/),sm=g(r,/<small>([^<]*)/),v=g(r,/<span class="v">([^<]*)/),open=/en-car open/.test(r);
    const [avg,n,,dir]=sm.split(' · ');
    rows.push(`<div class="w12-hw${open?' on':''}"><button class="w12-hr" data-ev="${ev}" aria-expanded="${open}"><span class="h"><b>${t.replace(/–(\d+)$/,'–$1.')}</b><em>${v} kg</em><i>›</i></span>
      <span class="s">${sp}<small>${avg.replace(/^([\d,]+) kg átlag$/,'átlag $1 kg')} · ${n.replace('bejegyzés','mérés')} · ${dir.replace(/^[↓→↑] /,'')}</small></span></button>${days}</div>`);
    i=nx}
  const more=g(h,/(<button class="fh-lk" data-toast="Régebbi hetek[^>]*>[^<]*<\/button>)/).replace('class="fh-lk"','class="n8-b"');
  return `<div class="w12-hl">${rows.join('')}</div><div class="ex-acts w12-in">${more}</div>`}
function alvas12(base){
  const hi=base.indexOf('<section class="fh-card fh-hero'),H=base.slice(hi,bal(base,hi,'section'));
  const ti=H.indexOf('<div class="en-tubes w8"'),w8=ti<0?'':H.slice(ti,bal(H,ti)).replace('<small>aug. 3.</small>','<small>8 hete</small>');
  const ss=sects(base,bal(base,hi,'section'));
  return `<section class="mx-s ex-hero"><small class="ex-eb">Az alvásod · heti átlag</small><h2 class="n7-h">Közel a 7,5 órás célhoz, egyenletes héttel.</h2>
    <p class="w12-sc"><b>7,1</b><span>óra<br>tegnap 7,1 óra · 23:20-tól 6:30-ig</span></p>
    <div class="w12-ch w12-w8">${w8}${legend([['bd','heti átlag'],['rg','a legrövidebb és a leghosszabb éjszaka'],['pl','a cél: 7,5 óra']])}</div>
    <div class="ex-acts w12-wide"><button class="n9-btn" data-sheet="sleep">+ Alvás</button><button class="n8-b" data-go="ejszaka.idle">Éjszakai mód</button></div></section>
  ${ss.map(x=>/en-nl/.test(x.html)?sec12('Az utolsó 7 éjszaka',nights12(x.html)):sec12(x.hd.replace('Tegnap éjjel · az árapály','Tegnap éjjel').replace('Napló · utolsó 7 éjszaka','Az utolsó 7 éjszaka').replace('Alvás-cél','Az alvás célja'),
    tidy(x.html).replace(/>„a rendszeresség a király” · ±15 perc /,'>A rendszeresség a király: plusz-mínusz 15 perc. ').replace('cél ≥ 85%','a cél legalább 85%').replace('14 nap · ±15 perc','14 nap, plusz-mínusz 15 perc')
      .replace('00:42 → 09:03 · ébredés 1× éjjel','00:42-től 9:03-ig, egyszer ébredtél fel').replace(/<small>\/ 10 minőség<\/small>/,'<small>a 10-ből, minőség</small>')
      .replace('Átlagos összetétel · 14 éjszakából','Átlagos összetétel, 14 éjszakából').replace('8 ó · REM perc ↑','8 óra · REM-percek ↑')
      .replace('Eszközök éjszakai ébredéshez: 20 perces szabály, légzés, 4K-séta.','Ha éjjel felébredsz: a 20 perces szabály, légzés, 4K-séta.'))).join('')}`}
/* the last seven nights: one row each — the date and the hours on top, bed and wake time under it, the quality as a level */
function nights12(h){const st=[...h.matchAll(/<div class="fh-step ?"><time>09\/(\d\d)<\/time><span class="g"><strong><span[^>]*>([\d,]+) ó<\/span> · ([\d:]+) → ([\d:]+)<\/strong>(?:<small>([^<]*)<\/small>)?<\/span><span class="en-lvw sm"><b>(\d+)\/10<\/b>/g)];
  const night=st.map(([,d,hh,a,b,note,q])=>{const w=parseFloat(hh.replace(',','.'))<7||+q<=5;return `<div class="w12-n${w?' w':''}"><b>szeptember ${d}. · ${hh} óra</b>${lvl(q*10,'')}<small>${a}-tól ${b.replace(/^0/,'')}-ig · minőség ${q} a 10-ből${note?' · '+note:''}</small></div>`}).join('');
  return `<div class="w12-nl">${night}</div>${mzLine('A jobb oldali csík az éjszaka minősége. Narancs az, ami 7 óra alatt maradt, vagy 5 pont alatti.')}<div class="w12-rl" style="margin:12px 0 0">${'<button class="ex-mrow w12-r" data-go="ejszaka.idle">'+drop('t-moon')+'<span class="g"><b>Éjszakai mód</b><i class="q">Ha éjjel felébredsz: a 20 perces szabály, légzés, 4K-séta.</i></span><em>›</em></button>'}</div>`}
function test12(a){const base=O.test(a),v=a==='alvas'?'alvas':'suly';
  const sw=(i=>i<0?'':base.slice(i,bal(base,i)))(base.indexOf('<div class="en-sw'));
  const body=v==='alvas'?alvas12(base):suly12(base);
  const tdRow=`<div class="w12-rl">${'<button class="ex-mrow w12-r" data-toast="Beállítások · testadatok">'+drop('t-person')+'<span class="g"><b>Testadatok</b><i class="q">34 év · 180 cm · 78,4 kg · 15% testzsír</i></span><em>›</em></button>'}</div>`;
  const page0=base.slice(0,base.indexOf('<div class="en-sw'));
  const tail=base.slice(bal(base,base.lastIndexOf('<section class="fh-card'),'section'));
  return page0+`<div class="mx w12-t">${body}<section class="mx-s ln">${tdRow}</section><div class="ng-tail"></div></div>`+tail}
en.routes.test=test12;en.routes.suly=()=>test12('');en.routes.alvas=()=>test12('alvas');

/* approved data-ev switches on a converted page: en.js updates its state and draws the approved page; redraw ours on top */
document.addEventListener('click',e=>{const el=e.target.closest('[data-ev^="period:"],[data-ev^="wk:"],[data-ev^="swin:"],[data-ev^="drawer:"]');const ph=el&&el.closest('.phone');if(!ph||!ph.querySelector('.w12-t,.w12-g2'))return;
  setTimeout(()=>{const f=en.routes[F.R];if(typeof f!=='function')return;const sc=ph.querySelector('.scroll'),y=sc?sc.scrollTop:0;ph.innerHTML=f(F.ARG);
    ph.querySelectorAll('.rise').forEach(x=>x.classList.remove('rise'));const s2=ph.querySelector('.scroll');if(s2)s2.scrollTop=y},0)},true);

/* ═══ CÉLOK (2026-11-02, owner: the same goal cards as on Hol tartok): the sentence on top with the four goal tubes as the
   picture (the light top layer is this week's part), one wide "+ Új cél"; the active goals on the shared card, the capsule
   legend as Mezo's line; the six life areas as tubes; parked and closed goals as rows; the signals row. ═══ */
O.celok=en.routes.celok;en.routes['celok-lista']=O.celok;
function celok12(a){if(a)return O.celok(a);const base=O.celok('');
  const cutT=m=>{const i=base.indexOf(m);return i<0?'':base.slice(i,bal(base,i))};
  const gt=cutT('<div class="en-tubes wide"'),dims=cutT('<div class="en-tubes dims"');
  return page('en',{title:'Célok',sub:'Én · 4 aktív · 1 parkol',tab:'celok'},`<div class="mx">
  <section class="mx-s ex-hero"><small class="ex-eb">Ezen a héten</small><h2 class="n7-h">Két cél emelkedik, egy tartja magát.</h2>
    <div class="w12-ch w12-gtb">${gt}</div>
    ${mzLine('Minden cél egy edény. A világos felső réteg az, amit ez a hét tett hozzá.')}
    <div class="ex-acts w12-wide"><button class="n9-btn" data-go="celuj.1">+ Új cél</button></div></section>
  <section class="mx-s ln">${KH('Aktív célok','4')}<div class="w12-gl">${GO.map(goal).join('')}</div>
    ${mzLine('A kis kapszula egy nap: tele, ha teljesült; félig, ha részben; üres, ha kimaradt; szaggatott, ha nincs adat.')}</section>
  <section class="mx-s ln">${KH('Életterületek')}<div class="w12-ch w12-dm">${dims}</div>
    ${mzLine('Hat életterület, hat szint: annyira telik, ahány aktív célod épít rá.')}</section>
  <section class="mx-s ln">${KH('Parkol és lezárt')}<div class="w12-rl">
    <div class="ex-mrow w12-r">${drop('t-book')}<span class="g"><b>Spanyol B2</b><i class="q">parkol · Elmélyülés</i></span><button class="n8-b" data-toast="Újra aktív">Vissza</button></div>
    <div class="ex-mrow w12-r">${drop('t-sprout')}<span class="g"><b>Félmaraton</b><i class="q">elkészült · Egészség</i></span><span class="w12-dir">kész</span></div></div></section>
  <section class="mx-s ln">${KH('A célok mögött')}<div class="w12-rl">${row('t-signal','Jelek: mit figyel a rendszer','28 forrás · 19 él · 9 alszik','jelek')}</div>
    ${mzLine('Ami nincs naplózva, az nem nulla: az üres.')}</section>
  <div class="ng-tail"></div></div>`)}
en.routes.celok=celok12;

/* ═══ NAPLÓ (2026-11-02, owner: this week's entries on top): the sentence and this week's entries as the hero, each on
   one card shape (when · what kind, the entry itself), one wide "+ Új bejegyzés"; the decision waiting for a look-back as
   its own card with the five-step rating (a tap answers in place, data-w12); the gratitude streak as a row with the
   week's capsules. ═══ */
O.naplo=en.routes.naplo;en.routes['naplo-lista']=O.naplo;
const JN=[['ma','napló','Ma reggel nagyon nyugodt voltam a meeting előtt, a légzőgyakorlat tényleg segít.'],['tegnap','hála','Hálás vagyok Petrának, hogy végighallgatott a munkás dologgal.'],
  ['szeptember 22.','napló','Túl sokat vállaltam a héten. Jövő héten egy estét szabadon hagyok.'],['szeptember 21.','döntés','Heti négy edzés: meglátjuk, belefér-e.']];
const JI={'napló':'t-note','hála':'t-heart','döntés':'t-compass'};
const decAsk=`<p class="w12-dq">Mennyire vált be?</p><div class="w12-rate">${[1,2,3,4,5].map(n=>`<button data-w12="dec:${n}" aria-label="${n} az 5-ből"><b>${n}</b>${n===1?'<small>nem</small>':n===5?'<small>bevált</small>':''}</button>`).join('')}</div>`;
const decDone=n=>`<p class="w12-dq">Visszanézted: <b>${n} az 5-ből</b>.</p><div class="ex-acts w12-in"><button class="n8-b" data-sheet="decision">Mi lett belőle?</button></div>`;
function naplo12(a){if(a)return O.naplo(a);
  const ent=JN.map(([t,k,x],i)=>`<button class="w12-j${i?'':' now'}" data-sheet="journal"><span class="w12-jh">${drop(JI[k])}<b>${t}</b><span class="w12-dir fl">${k}</span></span><p>${x}</p></button>`).join('');
  return page('en',{title:'Napló',sub:'Én · 12 bejegyzés',tab:'naplo'},`<div class="mx">
  <section class="mx-s ex-hero"><small class="ex-eb">Szeptember · ezen a héten</small><h2 class="n7-h">Négy bejegyzés a héten, egy döntés vár rád.</h2>
    <div class="w12-jl">${ent}</div>
    <div class="ex-acts w12-wide"><button class="n9-btn" data-sheet="journal">+ Új bejegyzés</button><button class="n8-b" data-toast="Augusztus betöltése">Korábbi hónapok</button></div></section>
  <section class="mx-s ln">${KH('Visszanézésre vár')}<div class="w12-cw"><div class="w12-ob"><div class="w12-gh">${drop('t-compass')}<span class="w12-gt"><b>Egy döntésed vár</b><small>szeptember 21-én hoztad</small></span></div>
    <p class="w12-qt">„Szeptembertől heti négy edzésre váltok háromról.”</p><div id="w12-dec">${decAsk}</div></div></div>
    ${mzLine('Ha visszanézed, megtanulom, milyen döntések válnak be neked.')}</section>
  <section class="mx-s ln">${KH('Hálanapló')}<div class="w12-rl"><button class="ex-mrow w12-r" data-toast="Hála · új sor a lapon">${drop('t-heart')}<span class="g"><b>Hálanapló</b><i class="q">12 bejegyzés · 5 napja egymás után, él a sorozat</i>${week(['hit','hit','hit','hit','hit','nd','nd'])}</span><em>›</em></button></div></section>
  <div class="ng-tail"></div></div>`)}
en.routes.naplo=naplo12;

/* ═══ A HETED + HETI ELEMZÉS (2026-11-02): the closed week. A heted: the sentence, 78 with last week's 74 as the jar's
   dashed line, "Mezo elemzése" wide, the week arrows as plain buttons; the nine areas as nine filling tiles in full words
   (only sleep, under its goal, gets colour); the four views as rows, the discoveries' layers kept; the score's makeup as
   Mezo's line. Heti elemzés: the verdict with the seven day tubes as the picture, Mezo's analysis on its own card with
   what it was built on and the two answers. ("fut" = the running week stays the approved page.) ═══ */
O.het=en.routes.het;en.routes['het-lista']=O.het;O.elemzes=en.routes.elemzes;en.routes['elemzes-lista']=O.elemzes;
const NINE=[['3 004','kalória','napi átlag',97],['212 g','fehérje','napi átlag',100],['7 óra 19','alvás','a 7,5 órás cél alatt',88,1],['75%','bejelent&shy;kezés','a napokból',75],['7,0','energia','a 10-ből',70],['6,8','hangulat','a 10-ből',68],
  ['78,6 kg','súly','heti átlag',null],['−0,4 kg','súlytrend','hetente',80],['585','pont','a héten',null]];
const nine12=()=>`<div class="w12-nine">${NINE.map(([v,l,s2,p,att])=>`<div class="${att?'att':''}${p==null?' nd':''}" style="--p:${p==null?0:p}%"><b>${v}</b><span>${l}</span><small>${s2}</small></div>`).join('')}</div>`;
function het12(a){if(a)return O.het(a);const base=O.het('');
  const ji=base.indexOf('<span class="en-jar'),jar=ji<0?'':base.slice(ji,bal(base,ji,'span'));
  const si=base.indexOf('<div class="en-strata"'),str=si<0?'':base.slice(si,bal(base,si)),li=si<0?-1:base.indexOf('<div class="en-leg"',si),sl=li<0?'':base.slice(li,bal(base,li));
  return page('en',{title:'A heted',sub:'Szept. 21–27. · lezárt hét',back:'mai'},`<div class="mx">
  <section class="mx-s ex-hero"><small class="ex-eb">Szeptember 21–27. · lezárt hét</small><h2 class="n7-h">Az egyensúly hete.</h2>
    <div class="w12-hj">${jar}<p class="w12-hp"><b>+4 pont</b><span>a múlt héthez képest. A szaggatott vonal a múlt hét: 74.</span></p></div>
    <div class="ex-acts w12-wide"><button class="n9-btn" data-go="elemzes">Mezo elemzése</button></div>
    <div class="ex-acts w12-nav"><button class="n8-b" data-toast="Előző hét">‹ Előző</button><button class="n8-b" data-toast="Következő hét">Következő ›</button></div></section>
  <section class="mx-s ln">${KH('A hét kilenc területe')}${nine12()}
    ${mzLine('Minden csempe annyira telt meg, amennyire a célodhoz állsz. Színt csak az alvás kapott: a 7,5 órás célod alatt maradt. Minden más rendben.')}</section>
  <section class="mx-s ln">${KH('A hét négy nézete')}<div class="w12-rl">
    ${row('t-score','Mezo heti elemzése','hétfő 6:15 · erős hét volt: a fehérjecélt öt napon tartottad','elemzes')}
    ${row('t-gem','A hét tanulságai','ehhez a héthez nincs javaslat','tanulsagok')}
    ${row('t-sun','A hét napjai','4 nap a 7-ből naplózva · nézd meg egyenként','napok')}
    ${row('t-lens','Heti felfedezések','34 új nyom a memóriában','felfedezesek',`<span class="w12-str">${str}${sl}</span>`)}</div>
    ${mzLine('A pontszám a hat mért területből áll össze: tápanyag, minőség, edzés, alvás, naplózás és ritmus.')}</section>
  <div class="ng-tail"></div></div>`)}
function elemzes12(a){if(a)return O.elemzes(a);const base=O.elemzes('');
  const ti=base.indexOf('<div class="en-tubes week"'),tubes=ti<0?'':base.slice(ti,bal(base,ti));
  const chip=[['t-pattern','Minta'],['t-book','Tudás'],['t-pin','Életesemény'],['t-scroll','Emlék']].map(([ic,l])=>`<span class="w12-pc">${drop(ic)}${l}</span>`).join('');
  return page('en',{title:'Heti elemzés',sub:'A heted · hétfő 06:15',back:'het'},`<div class="mx">
  <section class="mx-s ex-hero"><small class="ex-eb">Mezo olvasata · hétfő 6:15</small><h2 class="n7-h">Erős hét volt: a fehérjecélt öt napon tartottad.</h2>
    <p class="w12-sc"><b>78</b><span>pont a 100-ból<br>hét nap, hét edény</span></p>
    <div class="w12-days">${tubes}</div>
    ${mzLine('Koppints egy napra, és megnyílik A napom oldala.')}
    <div class="ex-acts w12-wide"><button class="n9-btn" data-toast="Beszélgetés a hétről (Mezo)">Beszélgess a hétről</button><button class="n8-b" data-toast="Elemzés frissítve">Frissítsd</button></div></section>
  <section class="mx-s ln">${KH('Mezo heti elemzése')}<div class="w12-cw"><div class="w12-ob"><div class="w12-gh">${badge('mezo',{s:40})}<span class="w12-gt"><b>Mezo</b><small>hétfő 6:15</small></span></div>
    <p>Erős hét volt: a fehérjecélt öt napon tartottad, és az alvásod a hét második felében stabilizálódott. A csütörtöki kimaradt nap után szombaton visszajöttél. Ez a hét mintája.</p>
    <p class="w12-dq">Amire épült</p><div class="w12-pcs">${chip}</div>
    <div class="ex-acts w12-in"><button class="n8-b" data-toast="Köszönöm">Hasznos</button><button class="n8-b" data-toast="Rendben">Nem talált</button></div></div></div></section>
  <section class="mx-s ln">${KH('Tovább')}<div class="w12-rl">${row('t-gem','A hét tanulságai','még nincs javaslat','tanulsagok')}</div></section>
  <div class="ng-tail"></div></div>`)}
en.routes.het=het12;en.routes.elemzes=elemzes12;

/* ═══ SÚLYCÉL + its sub-pages (2026-11-03, owner: "a súlycél oldallal menjünk meg az aloldalaival"): one recipe for the
   goal page, its five parts (étrendi keret, szakasz, tervkapcsolatok, védőkorlátok, javaslat) and the two-step new goal.
   The approved hero becomes the sentence on top (eyebrow, verdict, the big number when there is one, the line under it),
   its picture stays the picture (the draining vessel, the flow gauge, the tubes, the vials, the linked vessels), its first
   button goes wide; the approved cards follow under plain headings, grey notes as Mezo's lines, training-plan shorthand
   and units written out. ═══ */
const hu2=h=>hu(h).replace(/kg\/hét/g,'kg hetente').replace(/(\d)[\s  ]kcal/g,'$1 kalória').replace(/<small>kcal<\/small>/g,'<small>kalória</small>').replace(/>kcal</g,'>kalória<')
  .replace(/W(\d+)–(\d+)/g,'$1–$2. hét').replace(/W(\d+)\/(\d+)/g,'$1. hét a $2-ból').replace(/W(\d+)-től/g,'a $1. héttől').replace(/\bW(\d+)\b/g,'$1. hét')
  .replace('P 163 · C 226 · F 66','fehérje 163 g · szénhidrát 226 g · zsír 66 g').replace(/≥ ?/g,'legalább ').replace(/\bkb\. /g,'körülbelül ')
  .replace('Identity frame · opcionális','Ki akarsz lenni? · nem kötelező').replace(/\bMAV\b/g,'Csúcsterhelés').replace(/>3\/4</g,'>3 a 4-ből<').replace(/kalória-ból/g,'kalóriából').replace(/kalória-lal/g,'kalóriával').replace(/^kcal$/,'kalória').replace(/(\d+)\. hét a (\d+)-ból/g,'a $2 hétből a $1.').replace('Fuel-adattal','étkezési adattal').replace('Fuel-nap','étkezési nap');
function gen12(base,topOver){const hi=base.indexOf('<section class="fh-card fh-hero');if(hi<0)return base;const he=bal(base,hi,'section'),H=base.slice(hi,he);
  const lbl=g(H,/<span class="lbl">([^<]*)/),ver=g(H,/<p class="verdict"[^>]*>([\s\S]*?)<\/p>/),sub=g(H,/<p class="sub">([\s\S]*?)<\/p>/);
  const big=H.match(/<div class="fh-big[^"]*">([^<]*)(?:<small>([^<]*)<\/small>)?<\/div>/);
  const ai=H.indexOf('<div class="fh-acts">'),acts=ai<0?'':H.slice(ai+21,bal(H,ai)-6);
  let pic=H.replace(/^<section[^>]*>/,'').replace(/<\/section>$/,'');
  const drop0=(h,m,t)=>{const i=h.indexOf(m);return i<0?h:h.slice(0,i)+h.slice(bal(h,i,t))};
  pic=drop0(pic,'<span class="fh-art"','span');pic=drop0(pic,'<div class="fh-acts">','div');pic=drop0(pic,'<div class="fh-big','div');
  pic=pic.replace(/<span class="lbl">[^<]*<\/span>/,'').replace(/<p class="verdict"[^>]*>[\s\S]*?<\/p>/,'').replace(/<p class="sub">[\s\S]*?<\/p>/,'').replace(/<div style="flex:1;min-width:0"><\/div>/,'');
  const hr=pic.indexOf('<div class="fh-hrow">');let side='';if(hr>=0){side=pic.slice(hr,bal(pic,hr)).replace(/^<div class="fh-hrow">/,'').replace(/<\/div>$/,'');pic=pic.slice(0,hr)+pic.slice(bal(pic,hr))}
  const btns=[...acts.matchAll(/<button class="(btn[^"]*|fh-lk)"([^>]*)>([\s\S]*?)<\/button>/g)].map(([,c,at,t],i)=>`<button class="${i?'n8-b':'n9-btn'}"${at}>${t}</button>`).join('');
  let top=`<section class="mx-s ex-hero"><small class="ex-eb">${hu2(lbl)}</small><h2 class="n7-h">${hu2(ver)}</h2>
    ${big?`<p class="w12-sc"><b>${hu2(big[1])}</b><span>${hu2(big[2]||'').replace(/^\/ (\d+)$/,'nap a $1-ből')}${sub?'<br>'+hu2(sub):''}</span></p>`:side?`<div class="w12-hs">${side}</div>${sub?`<p class="w12-ln">${hu2(sub)}</p>`:''}`:sub?`<p class="w12-ln">${hu2(sub)}</p>`:''}
    ${pic.trim()?`<div class="w12-ch w12-pic">${hu2(pic)}</div>`:''}${btns?`<div class="ex-acts w12-wide">${btns}</div>`:''}</section>`;
  if(topOver)top=topOver;
  const ss=sects(base,he);let last=he;for(let i=nH(base,he);i>=0;i=nH(base,last))last=bal(base,base.indexOf('<section',i),'section');
  const body=ss.map(x=>sec12(hu2(x.hd).replace(/ · \d+ hét$/,'').replace(/^(Ütem) · áramlás$/,'$1').replace(' · hét tál',''),rows12(lanes12(tidy(hu2(x.html)))))).join('');
  return hu2(base.slice(0,hi))+`${''}<div class="mx w12-g2">${top}${body}<div class="ng-tail"></div></div>`+base.slice(last)}
/* a lane's labels never fit inside its bars at 320: the bars stay, their words go under them */
const lanes12=h=>h.replace(/<div class="en-lane">([\s\S]*?)<\/div>/g,(m,it)=>{const t=[...it.matchAll(/>([^<]+)<\/i>/g)].map(x=>x[1]);
  return `<div class="en-lane">${it.replace(/>([^<]+)<\/i>/g,'></i>')}</div><p class="w12-lc">${t.join(' · ')}</p>`});
/* the approved row with a value on the right becomes the shared row: icon drop, title, the line with the value in it */
const rows12=h=>h.replace(/<button class="fh-row" ([^>]*)><span class="si"><svg[^>]*><use href="#([^"]+)"[^>]*>(?:<\/use>)?<\/svg><\/span><span class="g"><strong>([^<]*)<\/strong>(?:<small>([^<]*)<\/small>)?<\/span>(?:<span class="v">([^<]*)<\/span>)?(<span class="st [^"]*">[^<]*<\/span>)?<svg[\s\S]*?<\/svg><\/button>/g,
  (m,at,ic,t,sm,v,st)=>`<button class="ex-mrow w12-r" ${at}>${drop(ic.replace(/^tc-/,'t-'))}<span class="g"><b>${t}</b><i class="q">${v?`<b class="w12-v">${v}</b>${sm?' · ':''}`:''}${sm||''}</i>${st?`<span class="w12-stt">${st}</span>`:''}</span><em>›</em></button>`);
/* owner 2026-11-03 ("ez itt béna"): the small vessel floated in empty space next to a sentence that repeated its numbers.
   Now: the big number, one line of what is left, the way from start to goal as one wide filling pipe with three stops,
   the waiting proposal as Mezo's line, one wide button and two equal ones under it. */
const SC_TOP=`<section class="mx-s ex-hero"><small class="ex-eb">Jó pályán · 33% megvan</small><h2 class="n7-h">Jó úton: a súlyod a terv szerint apad.</h2>
  <p class="w12-sc"><b>78,4</b><span>kilogramm most<br>még 5,4 kilogramm a célig, várhatóan augusztus 14-re</span></p>
  <div class="w12-ch w12-way" role="img" aria-label="Induláskor 81,4, most 78,4, cél 73,0 kilogramm: az út 33%-a megvan">
    <div class="w12-wm" style="left:33%"><b>78,4</b> most</div><div class="w12-wp"><i style="width:33%"></i><s style="left:33%"></s></div>
    <div class="w12-ws"><span><b>81,4</b>induláskor</span><span><b>73,0</b>a cél</span></div></div>
  ${mzLine('Két hete lassabb az ütem a tervezettnél, ezért hoztam egy új javaslatot. Nézd át, mielőtt alkalmazzuk.')}
  <div class="ex-acts w12-wide"><button class="n9-btn" data-go="sulyresz.javaslat">Javaslat megnézése</button></div>
  <div class="ex-acts w12-nav"><button class="n8-b" data-sheet="gate">+ Új cél</button><button class="n8-b" data-go="test">A súlygörbe</button></div></section>`;
/* the week's sub-pages (2026-11-03): the same recipe; day shorthand and units written out */
const DAYN={H:'Hétfő',K:'Kedd',Sze:'Szerda',Cs:'Csütörtök',P:'Péntek',Szo:'Szombat',V:'Vasárnap'};
const hu3=h=>h.replace(/<b>(H|K|Sze|Cs|P|Szo|V)<\/b>/g,(m,d)=>`<b>${DAYN[d]}</b>`).replace(/>(Sze|K) (\d+)</g,(m,d,n)=>`>${DAYN[d]}: ${n}<`).replace(/(\d)ó (\d+)p\b/g,'$1 óra $2 perc').replace(/>(\d)\/4</g,'>bejelentkezés $1 a 4-ből<')
  .replace(/(\d)× edzés/g,'$1 edzés').replace(/logolás/g,'naplózás').replace(/<small>\/ 100<\/small>/g,'<small>pont</small>').replace('Napról napra · hat kis edény','Napról napra')
  .replace(/<p class="fh-note" style="margin:0 0 10px">([^<]*)<\/p>/g,(m,t)=>t==='a legfrissebb elöl'?'':`<p class="w12-lc">${t}</p>`)
  .replace(/(<svg class="fh-chart en-surf"[^>]*aria-label="([^"]*)"[\s\S]*?<\/svg>)/,(m,svg,al)=>`${svg}<div class="w12-sl">${al.split(', ').map(x=>`<span>${x.replace(/^(\d+) /,'<b>$1</b> ')}</span>`).join('')}</div>`);
for(const k of ['tanulsagok','napok','felfedezesek']){const f=en.routes[k];en.routes[k+'-lista']=f;en.routes[k]=a=>gen12(hu3(f(a)))}
for(const k of ['sulycel','sulyresz','sulyuj']){const f=en.routes[k];en.routes[k+'-lista']=f;en.routes[k]=a=>a==='ures'?f(a):gen12(f(a),k==='sulycel'&&!a?SC_TOP:null)}

/* buoy taps: swap Mezo's line in place, mark the buoy (no re-render) */
document.addEventListener('click',e=>{const el=e.target.closest('[data-w12]');if(!el)return;e.preventDefault();e.stopPropagation();
  const [k,v]=el.dataset.w12.split(':');if(k==='dec'){const d=el.closest('.phone')?.querySelector('#w12-dec');if(d)d.innerHTML=decDone(v);return}if(k!=='stn')return;const ph=el.closest('.phone'),box=ph&&ph.querySelector('#w12-stn p');if(!box)return;
  const on=el.classList.contains('on');ph.querySelectorAll('[data-w12^="stn:"]').forEach(x=>x.classList.remove('on'));
  if(on){box.innerHTML=ST0;return}el.classList.add('on');const s=ST[+v];box.innerHTML=`<b>${s[0]} · ${s[1]}</b><br>${s[2]}`},true);

/* owner 2026-11-02: no Test layer — Súly and Alvás are tabs of their own (Hol tartok · Súly · Alvás · Célok · Napló) */
const tabs5=h=>typeof h!=='string'?h:h.replace(/<button class="(on)?" data-go="test">Test<\/button>/,(m,on)=>{const sl=on&&(F.R==='alvas'||F.ARG==='alvas');
  return `<button class="${on&&!sl?'on':''}" data-go="test">Súly</button><button class="${sl?'on':''}" data-go="test.alvas">Alvás</button>`});
Object.keys(en.routes).forEach(k=>{const f=en.routes[k];if(typeof f==='function'&&!f.__hub){const g=(...a)=>tabs5(hubHead(f(...a)));g.__hub=1;en.routes[k]=g}});

F.css(`${P} .w12-mz p{margin:0;font-size:15px;line-height:1.45;color:var(--ink)}${P} .w12-mz p b{font-family:var(--disp);font-size:15.5px}
${P} .w12-sc{display:flex;align-items:center;gap:12px;margin:12px 22px 0}${P} .w12-sc b{font:800 52px/1 var(--disp);letter-spacing:-.04em;color:var(--ink)}
${P} .w12-sc span{font-size:14.5px;line-height:1.35;color:var(--ink)}
${P} .w12-days{margin:4px 22px 0}${P} .w12-days .en-tubes{--h:104px!important;gap:8px}${P} .w12-days .en-tubes em{font-size:14px}${P} .w12-days .en-tubes small{font-size:13px;font-weight:600;color:var(--ink)}
${P} .w12-days .en-tubes .c{min-height:44px}
${P} .w12-wide .n9-btn{flex:1}
${P} .w12-vi{margin:4px 18px 0}${P} .w12-vi .k2-vials b{white-space:nowrap;font-size:17px}${P} .w12-vi .k2-vials small,${P} .w12-vi .k2-vials .s{font-size:12.5px!important}
${P} .w12-lk{margin-left:auto;min-height:40px;padding:0 4px;font-size:14.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 80%,var(--ink));background:none;border:0}
${P} .mx-h:has(.w12-lk){display:flex;align-items:center}
${P} .w12-ln{margin:2px 22px 0;font-size:15px;line-height:1.45;color:var(--ink)}${P} .w12-ln b{font-family:var(--disp);font-size:16px}
${P} .w12-ch{margin:12px 18px 0;padding:14px 14px 12px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w12-ch .en-chart{margin:0}${P} .w12-ch svg .gl{font-size:14.5px;font-weight:600;fill:var(--sub)}
${P} .w12-ch [data-w12]{cursor:pointer}${P} .w12-ch g.on circle{fill:var(--liq2)!important}${P} .w12-ch g.on path{fill:var(--liq2)!important}
${P} .w12-leg{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:13px;line-height:1.3;color:var(--ink)}
${P} .w12-leg i{display:inline-block;width:14px;height:3px;border-radius:2px;background:var(--dom);vertical-align:middle;margin-right:6px}
${P} .w12-leg i.pl{background:none;border-top:1.5px dashed var(--sub);height:0;border-radius:0}${P} .w12-leg i.bd{height:8px;background:color-mix(in srgb,var(--dom) 45%,#fff)}
${P} .w12-leg i.st{width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1.4px var(--ink)}
${P} .w12-rl{display:grid;gap:10px;margin:14px 18px 0}
${P} .w12-r{min-height:68px}${P} .w12-r>svg.ng{width:46px;height:46px;flex:none;margin:0}${P} .w12-r .g{display:grid;gap:3px;min-width:0;flex:1}
${P} .w12-r .g b{font-family:var(--disp);font-size:16px;line-height:1.25;color:var(--ink)}${P} .w12-r .g .q{font-style:normal;font-size:13.5px;line-height:1.35;color:var(--ink)}
${P} .w12-r>em{font-style:normal;font-size:20px;color:var(--sub)}
${P} .w12-lv{display:flex;align-items:center;gap:10px;margin-top:4px}${P} .w12-lv .t{flex:1;height:12px;border-radius:999px;background:#EEF4F7;box-shadow:inset 0 0 0 1px rgba(10,42,60,.07);overflow:hidden}
${P} .w12-lv .t i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--dom) 55%,#fff),var(--dom))}
${P} .w12-lv b{font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap}
${P} .w12-gl{display:grid;gap:12px;margin:4px 18px 0}
${P} .w12-g{display:grid;gap:10px;width:100%;padding:16px 16px 14px;border-radius:24px;background:#fff;text-align:left;border:0;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w12-gh{display:flex;align-items:center;gap:12px}${P} .w12-gh>svg.ng{width:44px;height:44px;flex:none;margin:0}
${P} .w12-gt{flex:1;min-width:0;display:grid;gap:2px}${P} .w12-ga{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;margin-top:2px}${P} .w12-gt small{font-size:13px;color:var(--ink);opacity:.8}${P} .w12-gh b{min-width:0;font-family:var(--disp);font-size:17px;line-height:1.2;color:var(--ink)}
${P} .w12-dir{display:inline-flex;align-items:center;gap:4px;flex:none;padding:5px 10px;border-radius:999px;font-size:13px;font-weight:700;color:#1E7A55;background:#E3F4EC}
${P} .w12-dir.fl{color:var(--ink);background:#EEF2F5}
${P} .w12-g .w12-lv{margin:0}${P} .w12-g .w12-lv .t{height:14px}${P} .w12-g .w12-lv b{font-size:15px;font-family:var(--disp)}
${P} .w12-gs{display:flex;align-items:center;gap:12px;flex-wrap:wrap}${P} .w12-gs small{font-size:13.5px;line-height:1.35;color:var(--ink)}
${P} .w12-wk{display:inline-flex;gap:4px}${P} .w12-wk i{width:12px;height:22px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.16)}
${P} .w12-wk i.hit{background:var(--dom);box-shadow:none}${P} .w12-wk i.part{background:linear-gradient(0deg,var(--dom) 50%,#fff 50%);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--dom) 60%,#fff)}
${P} .w12-wk i.nd{background:transparent;box-shadow:none;border:1.5px dashed rgba(10,42,60,.25)}
${P} .w12-sw{margin:14px 18px 0}${P} .w12-sw .fh-seg button{min-height:44px;font-size:15px}${P} .w12-cw .fl-level span{font-size:13px}
${P} .w12-seg{margin:14px 18px 0}${P} .w12-seg .fh-seg button{min-height:42px;font-size:14px}
${P} .w12-wch,${P} .w12-w8{margin-top:12px}${P} .w12-wch svg .gl{font-size:15px;font-weight:600;fill:var(--sub)}
${P} .w12-w8 .en-tubes{margin-top:0}${P} .w12-w8 .en-tubes small{font-size:13px;color:var(--ink);white-space:nowrap}${P} .w12-w8 .en-tubes em{font-size:13.5px}
${P} .w12-leg i.raw{width:7px;height:7px;border-radius:50%;background:var(--sub)}${P} .w12-leg i.tol{height:9px;background:color-mix(in srgb,var(--dom) 16%,#fff)}
${P} .w12-leg i.pr{background:none;border-top:2px dotted var(--dom);height:0;border-radius:0}${P} .w12-leg i.rg{height:9px;background:color-mix(in srgb,var(--dom) 25%,#fff);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dom) 50%,#fff)}
${P} .w12-tp{display:flex;align-items:center;gap:16px;margin:4px 22px 0}${P} .w12-tp svg{width:104px;flex:none}
${P} .w12-tp p{margin:0;display:grid;gap:2px}${P} .w12-tp p b{font:800 34px/1 var(--disp);letter-spacing:-.03em;color:var(--ink)}${P} .w12-tp p span{font-size:14.5px;color:var(--ink)}
${P} .w12-st{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 18px 0}
${P} .w12-st span{display:grid;gap:3px;padding:12px 10px;border-radius:20px;background:#fff;text-align:center;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w12-st b{font:800 18px/1.1 var(--disp);color:var(--ink);white-space:nowrap}${P} .w12-st small{font-size:12.5px;line-height:1.25;color:var(--ink)}
${P} .w12-lw{margin:12px 22px 0}${P} .w12-lw .t{height:14px}${P} .w12-lw b{font:800 16px var(--disp)}
${P} .w12-cw{margin:4px 18px 0}${P} .w12-cw>.fh-card{margin:0;padding:18px 16px;border-radius:24px}
${P} .w12-cw .ex-mz{margin:14px 0 4px}${P} .w12-cw .fh-row strong{font-size:15.5px}${P} .w12-cw .fh-row small,${P} .w12-cw .fh-step small{font-size:13.5px;color:var(--ink)}
${P} .w12-cw .en-leg{font-size:13px;color:var(--ink)}${P} .w12-cw svg .gl{font-size:14px;font-weight:600;fill:var(--sub)}${P} .w12-cw .fh-lab{font-size:13px;color:var(--ink)}
${P} .w12-cw .en-chips span{font-size:13px}${P} .w12-cw .en-tubes small{font-size:13px;color:var(--ink)}${P} .w12-cw .en-tubes em{font-size:13px}
${P} .w12-cw .fh-step time{font-size:13px;color:var(--ink);white-space:normal;line-height:1.2}${P} .w12-cw .en-days span,${P} .w12-cw .en-days em{font-size:13.5px}
${P} .w12-cw .fh-seg button{min-height:42px;font-size:14px}${P} .w12-cw .en-lvw b{font-size:14px}
${P} .w12-hl{display:grid;gap:10px}${P} .w12-hw{border-radius:22px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05);overflow:hidden}
${P} .w12-hr{display:grid;gap:6px;width:100%;padding:14px 16px;background:none;border:0;text-align:left}
${P} .w12-hr .h{display:flex;align-items:baseline;gap:10px}${P} .w12-hr .h b{flex:1;font-family:var(--disp);font-size:16px;color:var(--ink)}${P} .w12-hr .h em{font:800 16px var(--disp);font-style:normal;color:var(--ink);white-space:nowrap}
${P} .w12-hr .h i{font-style:normal;font-size:20px;color:var(--sub);transition:transform .2s}${P} .w12-hw.on .w12-hr .h i{transform:rotate(90deg)}
${P} .w12-hr .s{display:flex;align-items:center;gap:12px}${P} .w12-hr .s svg{width:64px;height:26px;flex:none}${P} .w12-hr .s small{font-size:13.5px;line-height:1.35;color:var(--ink)}
${P} .w12-hw .en-days{margin:0 12px 12px}
${P} .w12-nl{display:grid;gap:8px}${P} .w12-n{display:grid;grid-template-columns:1fr auto;gap:2px 12px;align-items:center;padding:12px 14px;border-radius:20px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w12-n b{font-family:var(--disp);font-size:15.5px;color:var(--ink)}${P} .w12-n .w12-lv{grid-row:span 2;width:72px;margin:0}${P} .w12-n .w12-lv b:empty{display:none}${P} .w12-n small{font-size:13.5px;color:var(--ink)}${P} .w12-n.w b{color:#A86A0C}${P} .w12-n.w .w12-lv .t i{background:var(--warn)}
${P} .w12-wch svg text[style]{font-size:17px!important}${P} .w12-cw svg:not(.en-tide) .gl{font-size:17px}
${P} .w12-gtb .en-tubes{margin-top:0}${P} .w12-gtb .en-tubes small,${P} .w12-dm .en-tubes small{font-size:13px;line-height:1.2;color:var(--ink)}${P} .w12-gtb .en-tubes em,${P} .w12-dm .en-tubes em{font-size:14px}
${P} .w12-dm .en-tubes{margin-top:0}${P} .w12-gtb .en-tubes small{overflow-wrap:normal;word-break:normal;hyphens:manual}${P} .w12-r .n8-b{flex:none;min-height:42px}
${P} .w12-jl{display:grid;gap:10px;margin:16px 18px 0}
${P} .w12-j{display:grid;gap:8px;width:100%;padding:14px 16px;border-radius:22px;background:#fff;text-align:left;border:0;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w12-j.now{box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 2px color-mix(in srgb,var(--dom) 55%,#fff)}
${P} .w12-jh{display:flex;align-items:center;gap:10px}${P} .w12-jh>svg.ng{width:36px;height:36px;flex:none;margin:0}${P} .w12-jh b{flex:1;font-family:var(--disp);font-size:15.5px;color:var(--ink)}
${P} .w12-j p{margin:0;font-size:15px;line-height:1.45;color:var(--ink)}
${P} .w12-qt{margin:12px 0 0;font:600 16px/1.4 var(--disp);color:var(--ink)}${P} .w12-dq{margin:12px 0 0;font-size:15px;color:var(--ink)}
${P} .w12-rate{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px}
${P} .w12-rate button{display:grid;place-items:center;align-content:center;gap:1px;min-height:52px;border-radius:16px;border:0;background:color-mix(in srgb,var(--dom) 10%,#fff);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dom) 30%,#fff)}
${P} .w12-rate b{font:800 18px var(--disp);color:var(--ink)}${P} .w12-rate small{font-size:12px;color:var(--ink)}
${P} .w12-r .g .w12-wk{margin-top:4px}
${P} .w12-hj{display:flex;align-items:center;gap:14px;margin:12px 22px 0}${P} .w12-hj .w12-sc{margin:0}${P} .w12-hj .en-jar{flex:none}${P} .w12-hj .en-jar small{font-size:13px}
${P} .w12-hp{margin:0;display:grid;gap:4px}${P} .w12-hp b{font:800 26px/1 var(--disp);color:var(--ink)}${P} .w12-hp span{font-size:14.5px;line-height:1.4;color:var(--ink)}
${P} .w12-nav{margin-top:8px}${P} .w12-nav .n8-b{flex:1}
${P} .w12-nine{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 18px 0}
${P} .w12-nine>div{position:relative;display:grid;gap:1px;padding:12px 10px 10px;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w12-nine>div::before{content:'';position:absolute;left:0;right:0;bottom:0;height:var(--p);background:color-mix(in srgb,var(--dom) 16%,#fff)}
${P} .w12-nine>div.att::before{background:color-mix(in srgb,var(--warn) 28%,#fff)}${P} .w12-nine>div.nd{background:#fff}
${P} .w12-nine>div>*{position:relative}${P} .w12-nine b{font:800 17px/1.15 var(--disp);color:var(--ink);white-space:nowrap}${P} .w12-nine span{font-size:13.5px;font-weight:700;color:var(--ink)}${P} .w12-nine small{font-size:12px;line-height:1.25;color:var(--ink)}
${P} .w12-str{display:block;margin-top:6px}${P} .w12-str .en-leg{font-size:12.5px;color:var(--ink);margin-top:6px}
${P} .w12-pcs{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}${P} .w12-pc{display:inline-flex;align-items:center;gap:6px;padding:4px 12px 4px 4px;border-radius:999px;background:color-mix(in srgb,var(--dom) 8%,#fff);font-size:13.5px;font-weight:600;color:var(--ink)}${P} .w12-pc svg.ng{width:30px;height:30px;margin:0}
@container (max-width:340px){}
${P} .w12-hs{display:flex;justify-content:center;margin:10px 22px 0}${P} .w12-hs>svg{flex:none}${P} .w12-lc{margin:4px 0 8px;font-size:13px;line-height:1.35;color:var(--ink)}${P} .w12-g2 .w12-cw .fh-card:has(.w12-r){background:none;box-shadow:none;padding:0;display:grid;gap:10px}${P} .w12-v{font-weight:800}${P} .w12-stt{display:block;margin-top:4px}${P} .w12-stt .st{font-size:12.5px}${P} .w12-hsb{margin:0;font-size:15px;line-height:1.45;color:var(--ink)}
${P} .w12-pic{margin-top:14px}${P} .w12-pic .en-cells{gap:8px}${P} .w12-pic .en-cells b{font-size:18px}${P} .w12-pic .en-cells small,${P} .w12-pic .en-leg,${P} .w12-pic .en-tubes small{font-size:13px;color:var(--ink)}
${P} .w12-pic .k2-vials small,${P} .w12-cw .k2-vials small{font-size:12.5px}${P} .w12-cw .en-cells small{font-size:12.5px;color:var(--ink)}${P} .w12-cw .en-flow .ax span{font-size:12.5px}
${P} .w12-g2 .w12-cw .fh-row strong{font-size:15.5px}
${P} .w12-g2 :is(.en-leg,.en-cells small,.en-tubes small,.fh-facts small,.k2-vials small,.fh-row .st,.en-lane i){font-size:12.5px!important;color:var(--ink)}
${P} .w12-g2 .fh-facts b{font-size:17px}${P} .w12-g2 .en-cells b i{font-size:13px}${P} .w12-g2 .en-ruler{display:none}${P} .w12-g2 .en-lane i{white-space:normal;line-height:1.2;height:auto;min-height:24px;padding:3px 6px}
${P} .w12-g2 .en-drain .dl{font-size:17px}${P} .w12-g2 .en-drain .ds{font-size:15px}${P} .w12-g2 .en-lk svg text{font-size:12.5px}${P} .w12-g2 .fh-row:has(.en-ck){display:grid;grid-template-columns:36px 1fr;gap:6px 12px;align-items:start}${P} .w12-g2 .fh-row:has(.en-ck) .st{grid-column:2;justify-self:start}
${P} .w12-way{margin-top:14px;padding:14px 16px 14px}${P} .w12-wm{position:relative;display:inline-block;transform:translateX(-50%);margin-bottom:8px;padding:4px 10px;border-radius:999px;background:var(--ink);color:#fff;font-size:13px;white-space:nowrap}${P} .w12-wm b{font:800 15px var(--disp)}
${P} .w12-wp{position:relative;height:30px;border-radius:999px;background:linear-gradient(180deg,#fff,#EEF6F9);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10),inset 0 4px 8px -5px rgba(10,42,60,.18)}
${P} .w12-wp i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--dom) 45%,#fff),var(--dom))}
${P} .w12-wp s{position:absolute;top:-6px;bottom:-6px;width:4px;margin-left:-2px;border-radius:4px;background:var(--ink)}
${P} .w12-ws{position:relative;display:flex;justify-content:space-between;margin-top:10px;min-height:40px}${P} .w12-ws span{display:grid;gap:1px;font-size:13px;color:var(--ink)}
${P} .w12-ws span:last-child{text-align:right}${P} .w12-ws span[style]{position:absolute;transform:translateX(-50%);text-align:center}${P} .w12-ws b{font:800 17px var(--disp);color:var(--ink)}
${P} .w12-g2 .en-surf .gl{display:none}${P} .w12-sl{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-size:13px;color:var(--ink)}${P} .w12-sl b{font:800 15px var(--disp)}
${P} .w12-g2 .en-jar small{font-size:13px}${P} .w12-g2 .en-sixl span{font-size:12.5px;color:var(--ink)}
${P} .w12-g2 .en-dayr{display:grid!important;grid-template-columns:1fr auto;gap:8px 12px;align-items:start}${P} .w12-g2 .en-dayr .dl{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
${P} .w12-g2 .en-dayr .dl b{font-size:16px}${P} .w12-g2 .en-dayr .dl small{font-size:13px;color:var(--ink)}${P} .w12-g2 .en-dayr .g{grid-column:1/-1;grid-row:2;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
${P} .w12-g2 .en-dayr .en-q{grid-column:2;grid-row:1;font-size:16px}${P} .w12-g2 .en-dayr .en-q small{font-size:12.5px}${P} .w12-g2 .en-dayr .en-chips{margin:0}
${P} .w12-ob{padding:16px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w12-ob p{margin:10px 0 0;font-size:15px;line-height:1.45;color:var(--ink)}${P} .w12-in{margin:12px 0 0}
${P} .fh-tabs{gap:2px;justify-content:space-between}${P} .fh-tabs button{padding:8px 10px;flex:0 0 auto;min-height:40px}@media (max-width:360px){${P} .fh-tabs button{padding:7px 6px;font-size:13px}}
@container (max-width:340px){${P} .w12-sc b{font-size:44px}${P} .w12-days .en-tubes{gap:5px}}`);
})();
