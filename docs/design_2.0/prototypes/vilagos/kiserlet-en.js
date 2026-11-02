/* vilagos/kiserlet-en.js — EXPERIMENT (mezo-pi0jf), the Én domain in the system the Nap, Edzés, Fuel and Mezo domains
   settled on (KISERLET.md): one tinted ground, the sentence on top with the page's own picture, plain headings, roomy cards
   of one shape per object, grey notes as Mezo's lines, no abbreviations. NOT part of the build target: loaded only by
   ../kiserlet-napom-grafika.html after the other kiserlet-*.js files, whose styles (now scoped to en too) and helpers
   (window.KXN, window.KXE) it reuses. The approved pages stay reachable as <route>-lista.
   Én's own soft re-render (en.js `soft`) renders the approved pages, so the pages here carry no data-ev hooks; their
   in-place state runs on data-w12 instead. */
(function(){
const F=window.F,en=window.FREG&&FREG.en,X=window.KXN,E=window.KXE;if(!en||!X||!E)return;
const {I,badge,page}=F,{KH,hubHead}=X,{bal,drop}=E;
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
const GO=[{t:'Súlycél',ic:'t-weight',p:33,dir:'halad',sub:'78,4 → 73 kilogramm · heti fél kilogramm · körülbelül 11 hét',go:'sulycel'},
  {t:'Side hustle',ic:'t-record',p:64,dir:'emelkedik',ar:'↗',ma:'ma 2 a 3-ból',d:['hit','hit','part','hit','miss','hit','hit'],go:'cel'},
  {t:'Kockahas',ic:'t-sprout',p:71,dir:'tartja',ar:'→',ma:'ma 3 az 5-ből',d:['hit','part','hit','hit','part','miss','hit'],go:'cel'},
  {t:'Az utolsó barátnő',ic:'t-people',p:52,dir:'emelkedik',ar:'↗',ma:'ma 1 a 2-ből',d:['hit','nd','hit','part','hit','hit','nd'],go:'cel'}];
const week=d=>`<span class="w12-wk" role="img" aria-label="A hét napjai">${d.map(x=>`<i class="${x}"></i>`).join('')}</span>`;
const goal=o=>`<button class="w12-g" data-go="${o.go}"><span class="w12-gh">${drop(o.ic)}<b>${o.t}</b><span class="w12-dir${o.ar==='→'?' fl':''}">${o.ar?`<span aria-hidden="true">${o.ar}</span>`:''}${o.dir}</span></span>
  ${lvl(o.p,o.p+'%')}<span class="w12-gs">${o.d?`${week(o.d)}<small>${o.ma}</small>`:`<small>${o.sub}</small>`}</span></button>`;
function mai12(a){if(a)return O.mai(a);
  const base=O.mai(''),ti=base.indexOf('<div class="en-tubes week"'),tubes=ti<0?'':base.slice(ti,bal(base,ti));
  const ci=base.indexOf('<div class="en-chart">');let chart=ci<0?'':base.slice(ci,bal(base,ci));
  chart=chart.replace(/data-ev="stn:(\d)"/g,'data-w12="stn:$1"').replace(/<text class="gl"[^>]*>aug\. 19\.<\/text>/,'')
    .replace('>júl. 8.<','>július 8.<').replace('>szept. 24.<','>szeptember 24.<');
  const si=base.indexOf('<div class="en-slband"'),band=si<0?'':base.slice(si,bal(base,si));
  const vials=F.vials([{l:'Súly, kilogramm',ic:'t-weight',p:80,v:'−0,4',s:'kilogramm hetente · átlag 78,6',mark:'−0,5',on:'test'},
     {l:'Alvás, óra',ic:'t-sleep',c:'var(--warn)',p:90,v:'7,3',s:'a cél alatt',mark:'7,5 óra',on:'test.alvas'},
     {l:'Edzés a 4-ből',ic:'t-dumbbell',c:'var(--info)',p:75,v:'3',s:'mint a múlt héten',mark:'4',on:{dom:'edzes'}},
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
  <section class="mx-s ln">${KH('Életvonal','',`<button class="w12-lk" data-go="test">Test ›</button>`)}
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

/* buoy taps: swap Mezo's line in place, mark the buoy (no re-render) */
document.addEventListener('click',e=>{const el=e.target.closest('[data-w12]');if(!el)return;e.preventDefault();e.stopPropagation();
  const [k,v]=el.dataset.w12.split(':');if(k!=='stn')return;const ph=el.closest('.phone'),box=ph&&ph.querySelector('#w12-stn p');if(!box)return;
  const on=el.classList.contains('on');ph.querySelectorAll('[data-w12^="stn:"]').forEach(x=>x.classList.remove('on'));
  if(on){box.innerHTML=ST0;return}el.classList.add('on');const s=ST[+v];box.innerHTML=`<b>${s[0]} · ${s[1]}</b><br>${s[2]}`},true);

Object.keys(en.routes).forEach(k=>{const f=en.routes[k];if(typeof f==='function'&&!f.__hub){const g=(...a)=>hubHead(f(...a));g.__hub=1;en.routes[k]=g}});

F.css(`${P} .w12-mz p{margin:0;font-size:15px;line-height:1.45;color:var(--ink)}${P} .w12-mz p b{font-family:var(--disp);font-size:15.5px}
${P} .w12-sc{display:flex;align-items:center;gap:12px;margin:12px 22px 0}${P} .w12-sc b{font:800 52px/1 var(--disp);letter-spacing:-.04em;color:var(--ink)}
${P} .w12-sc span{font-size:14.5px;line-height:1.35;color:var(--ink)}
${P} .w12-days{margin:4px 22px 0}${P} .w12-days .en-tubes{--h:104px!important;gap:8px}${P} .w12-days .en-tubes em{font-size:14px}${P} .w12-days .en-tubes small{font-size:13px;font-weight:600;color:var(--ink)}
${P} .w12-days .en-tubes .c{min-height:44px}
${P} .w12-wide .n9-btn{flex:1}
${P} .w12-vi{margin:4px 18px 0}${P} .w12-vi .k2-vials small,${P} .w12-vi .k2-vials .s{font-size:12.5px!important}
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
${P} .w12-gh b{flex:1;min-width:0;font-family:var(--disp);font-size:17px;line-height:1.2;color:var(--ink)}
${P} .w12-dir{display:inline-flex;align-items:center;gap:4px;flex:none;padding:5px 10px;border-radius:999px;font-size:13px;font-weight:700;color:#1E7A55;background:#E3F4EC}
${P} .w12-dir.fl{color:var(--ink);background:#EEF2F5}
${P} .w12-g .w12-lv{margin:0}${P} .w12-g .w12-lv .t{height:14px}${P} .w12-g .w12-lv b{font-size:15px;font-family:var(--disp)}
${P} .w12-gs{display:flex;align-items:center;gap:12px;flex-wrap:wrap}${P} .w12-gs small{font-size:13.5px;line-height:1.35;color:var(--ink)}
${P} .w12-wk{display:inline-flex;gap:4px}${P} .w12-wk i{width:12px;height:22px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.16)}
${P} .w12-wk i.hit{background:var(--dom);box-shadow:none}${P} .w12-wk i.part{background:linear-gradient(0deg,var(--dom) 50%,#fff 50%);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--dom) 60%,#fff)}
${P} .w12-wk i.nd{background:transparent;box-shadow:none;border:1.5px dashed rgba(10,42,60,.25)}
@container (max-width:340px){${P} .w12-sc b{font-size:44px}${P} .w12-days .en-tubes{gap:5px}}`);
})();
