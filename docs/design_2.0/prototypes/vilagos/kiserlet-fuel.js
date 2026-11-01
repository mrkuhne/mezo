/* vilagos/kiserlet-fuel.js — EXPERIMENT (mezo-pi0jf), the Fuel domain in the system the Nap and Edzés domains settled on
   (KISERLET.md): one ground, thin straight dividers, the sentence on top and the page's own picture, cards with real
   buttons, no numbered headings. NOT part of the build target: loaded only by ../kiserlet-napom-grafika.html after
   kiserlet-napom.js and kiserlet-edzes.js, whose styles (scoped to nap / edzes / fuel) and helpers (window.KXN, window.KXE)
   it reuses. Every page is rebuilt from the approved page's rendered markup, keeping its buttons and their data-go /
   data-sheet actions; the approved pages stay reachable as <route>-lista. */
(function(){
const F=window.F,fu=window.FREG&&FREG.fuel,X=window.KXN,E=window.KXE;if(!fu||!X||!E)return;
const {I,badge}=F,{KH,DEFS,hubHead}=X,{cardsOf,bal,g,drop,pills}=E;
const P='.phone.foly[data-s="elo"][data-d="fuel"]';
const O={mai:fu.routes.mai};
fu.routes['mai-lista']=O.mai;
const ico=h=>g(h,/href="#([^"]+)"/)||'t-plate';

/* ═══ MAI (2026-11-01): the sentence on top, the bowl as the picture, one wide log button; the five macro tubes with the
   day's goal as a dashed waterline; the meals in time order on one card shape (the "outside a window" meal in its place,
   the next open one marked), the clock faces gone (the óra stays one tap away); the six log modes as drop tiles; the
   week and learning rows as drop rows. Owner: the meals stay one under the other. ═══ */
const hm=t=>{const m=String(t).match(/(\d{1,2}):(\d{2})/);return m?+m[1]*60+ +m[2]:9999};
function mai3(a){if(a&&a!=='kihagyva'&&a!=='kimelo')return O.mai(a);
  const base=O.mai(a),cs=cardsOf(base);const hero=cs.find(c=>/fu-bowl/.test(c.html));if(!hero)return base;
  const H=hero.html,gi=H.indexOf('<div class="fm-g"'),bowl=gi>=0?H.slice(gi,bal(H,gi)):'',verdict=g(H,/<p class="verdict"[^>]*>([^<]*)/),lbl=g(H,/<span class="lbl">([^<]*)/);
  const ai=H.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(H.slice(ai+21,bal(H,ai)-6)):'';
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${lbl}</small><h2 class="n7-h">${verdict}</h2><div class="fx-bowl">${bowl}</div><div class="ex-acts fx-wide">${acts}</div></section>`;
  /* macros: the tube's top is the goal; scale the fill so the goal sits at 85% and draw it as a dashed waterline */
  const mac=cs.find(c=>/fu-mac/.test(c.html));
  const tubes=mac?mac.html.replace(/^<section[^>]*>/,'').replace(/<\/section>$/,'').replace(/--p:([\d.]+)%/g,(m,p)=>`--p:${Math.min(98,+p*.85)}%`).replace(/<span class="k2-tube"([^>]*)><em><\/em>/g,'<span class="k2-tube"$1><em></em><i class="fx-wl" aria-hidden="true"></i>'):'';
  const macS=mac?`<section class="mx-s ln">${KH('Mai makrók')}<div class="ex-imp fx-mac">${tubes}</div><p class="ex-dates fx-leg"><i class="fx-wl s"></i>a napi cél</p></section>`:'';
  /* meals */
  const blocks=cs.filter(c=>/fm-blk/.test(c.html)).map(c=>{const h=c.html,bh=h.indexOf('<div class="fm-bh"'),be=bal(h,bh);
    const head=h.slice(bh,be),rest=h.slice(be).replace(/<\/section>$/,''),name=g(head,/<strong>([^<]*)/),win=g(head,/<small>([^<]*)/);
    const ci=head.indexOf('<span class="fu-cup'),cup=ci>=0?head.slice(ci,bal(head,ci,'span')):'';
    const open=/fm-blk[^"]*open/.test(h.slice(0,80)),t=g(rest,/<small>(\d{1,2}:\d{2})/)||win;
    return {name,win,cup,open,rest,ic:ico(head),t:hm(t)}}).sort((x,y)=>x.t-y.t);
  const nx=blocks.find(b=>b.open);
  const body=r=>pills(r.replace(/<span class="fm-chips">([\s\S]*?)<\/span><\/div>/,(m,ch)=>`<div class="fx-q">${ch.replace(/<button class="fm-chip([^"]*)" data-sheet="glu"([^>]*)><svg[\s\S]*?<\/svg>([^<]*)<\/button>/,'<button class="fx-ql g$1" data-sheet="glu"$2><b>$3</b><small>vércukor</small></button>')
      .replace(/<button class="fm-chip sc"([^>]*)>[\s\S]*?<\/span>([^<]*)<\/button>/,'<button class="fx-ql"$1><b>$2</b><small>pont</small></button>')}</div></div>`))
    .replace(/<p class="fm-when">/,'<p class="fx-when">');
  const meals=blocks.map(b=>`<article class="fx-ml ${b.open?'open':''} ${b===nx?'now':''}"><div class="fx-mh">${drop(b.ic)}<span class="g"><b>${b.name}</b><small>${b.win}${b===nx?' · ez jön':''}</small></span>${b.cup}</div>${body(b.rest)}</article>`).join('');
  const mealS=blocks.length?`<section class="mx-s ln">${KH('A mai étkezéseid')}<div class="ex-ml">${meals}</div></section>`:'';
  /* log anything */
  const lg=cs.find(c=>/fu-ip/.test(c.html)),lh=lg?lg.html:'';
  const tiles=[...lh.matchAll(/<button class="fh-pill[^"]*" data-go="([^"]+)">[\s\S]*?href="#([^"]+)"[\s\S]*?<\/span>([^<]*)<\/button>/g)].map(([,go,ic,l])=>`<button class="ex-spt" data-go="${go}">${drop(ic)}<b>${l}</b></button>`).join('');
  const oraB=g(lh,/(<button class="fh-lk" data-sheet="ora"[^>]*>[^<]*<\/button>)/);
  const logS=lg?`<section class="mx-s ln">${KH('Logolj bármit')}<div class="ex-spg fx-lg">${tiles}</div>
    <div class="ex-mz">${badge('falat',{s:30})}<p>${g(lh,/<p class="fh-note">([^<]*)/)}</p></div>${oraB?`<div class="ex-acts">${pills(oraB)}</div>`:''}</section>`:'';
  /* the week and learning */
  const wk=cs.find(c=>/data-go="beallitas"/.test(c.html)),wh=wk?wk.html:'';
  const rows=[...wh.matchAll(/<button class="fh-row" ([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^<]*)<\/small><\/span>(<span class="st [^"]*">[^<]*<\/span>)?/g)]
    .map(([,at,ic,t,sm,st])=>`<button class="ex-mrow" ${at}>${drop(ic)}<span class="g"><b>${t}</b><i class="q">${sm}</i>${st?`<span class="fx-st">${st}</span>`:''}</span><span class="v">›</span></button>`).join('');
  const miss=g(wh,/(<button class="btn sm ghost"[^>]*>[^<]*<\/button>)/);
  const wkS=wk?`<section class="mx-s ln">${KH('A hét és a tanulás')}<div class="ex-ml">${rows}</div>${miss?`<div class="ex-acts">${pills(miss)}</div>`:''}</section>`:'';
  /* prototype-only state switch */
  const pr=cs.find(c=>/data-go="mai.kimelo"/.test(c.html)),ph=pr?pr.html:'',si=ph.indexOf('<div class="fh-seg');
  const prS=pr?`<section class="mx-s ln">${KH('Prototípus · állapotváltó')}<div class="ex-seg">${ph.slice(si,bal(ph,si))}</div><p class="ex-dates">${g(ph,/<p class="fh-note">([^<]*)/)}</p></section>`:'';
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${macS}${mealS}${logS}${wkS}${prS}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.mai=mai3;

/* the tab pages' header, as on Nap and Edzés: no big title, the "?" top left */
const head=h=>typeof h==='string'?hubHead(h):h;
Object.keys(fu.routes).forEach(k=>{const f=fu.routes[k];if(typeof f==='function'&&!f.__hub){const w=(...a)=>head(f(...a));w.__hub=1;fu.routes[k]=w}});

F.css(`/* kiserlet-fuel */
${P} .fh-tabs{gap:2px;justify-content:space-between}${P} .fh-tabs button{padding:8px 12px;flex:0 0 auto}@media (max-width:360px){${P} .fh-tabs button{padding:7px 8px;font-size:13px}}
${P} .fx-bowl{margin:14px 22px 0}${P} .fx-bowl .fm-g{display:flex;align-items:center;justify-content:space-between;gap:8px}
${P} .fx-wide .n9-btn{flex:1}${P} .fx-bowl .fm-n small,${P} .fx-bowl .fu-bowl small{font-size:12.5px!important}${P} .fx-mh .fu-cup small,${P} .fx-mh .fu-cup b+small{font-size:12px!important}${P} .fx-ml .fl-mini small{font-size:12px!important}
${P} .fx-mac .k2-tube{position:relative}${P} .fx-wl{position:absolute;left:4px;right:4px;bottom:85%;height:0;border-top:2px dashed rgba(10,42,60,.45);z-index:2}
${P} .fx-leg{display:flex;align-items:center;gap:8px}${P} .fx-wl.s{position:static;display:inline-block;width:22px}
${P} .fx-ml{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .fx-ml.open{background:rgba(255,255,255,.72)}${P} .fx-ml.now{box-shadow:inset 0 0 0 2px var(--dom),0 12px 24px -16px var(--dom)}
${P} .fx-mh{display:flex;align-items:center;gap:10px}${P} .fx-mh svg.ng{width:46px;height:46px;margin:0;flex:none}${P} .fx-mh .g{flex:1;min-width:0;display:flex;flex-direction:column}
${P} .fx-mh .g b{font:800 17px/1.2 var(--disp,inherit);color:var(--ink)}${P} .fx-mh .g small{font-size:13px;color:var(--ink);opacity:.8}${P} .fx-ml.now .fx-mh .g small{opacity:1;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}
${P} .fx-mh .fu-cup{flex:none}${P} .fx-mh .ng-pipe,${P} .fx-mh .ng-flow{display:none}${P} .fx-mac .k2-vial small i{display:block!important;font-style:normal}${P} .fx-mac .fu-s{display:none}
${P} .fx-ml .fm-meal{margin:0;padding:10px 0 0;border-top:1px solid rgba(10,42,60,.08)}${P} .fx-ml .fm-mn{display:block;text-align:left}${P} .fx-ml .fm-mn strong{display:block;font-size:15.5px;font-weight:750;color:var(--ink)}${P} .fx-ml .fm-mn small{font-size:13px;color:var(--ink)}
${P} .fx-ml .fm-mb{display:flex;align-items:center;gap:12px;margin-top:8px}${P} .fx-ml .fm-cells{flex:none}${P} .fx-q{max-width:120px;margin-left:auto}
${P} .fx-q{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}${P} .fx-ql{display:flex;flex-direction:column;align-items:flex-start;min-height:44px;padding:8px 12px;border-radius:16px;background:var(--page);text-align:left}${P} .fx-ql b{font:800 15px/1.15 var(--disp,inherit);color:var(--ink)}${P} .fx-ql small{font-size:12px;font-weight:600;color:var(--ink);opacity:.75}${P} .fx-ql.g b{color:#23704A}${P} .fx-ql.g.mid b{color:#B4741F}
${P} .fx-when{margin:0;font-size:14px;color:var(--ink)}${P} .fx-ml .fh-acts{display:flex;gap:10px;margin:0;flex-wrap:wrap}
${P} .fx-lg .ex-spt{padding:14px 6px}${P} .fx-st{margin-top:4px}${P} .fx-st .st{font-size:12px!important}
`);

window.FNOTES_FOLY=`<h2>Kísérlet · Fuel</h2><p><a href="#w-fuel-mai"><b>Mai</b></a> — felül a mondat és a tál, a makrók csövei a napi cél szaggatott vonalával, az étkezések időrendben egyforma kártyán (az ablakon kívüli a helyén, a következő kiemelve), a logolás módjai csempéken. Arc: <a href="#w-fuel-mai.kihagyva">kihagyott étkezés</a>. Összevetésnek: <a href="#w-fuel-mai-lista">a mostani Mai</a>.</p>`+(window.FNOTES_FOLY||'');
})();
