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
  const base=O.mai(a),cs=cardsOf(base);const hero=cs.find(c=>/fu-bowl|fu-gl/.test(c.html));if(!hero)return base;const kim=/fu-gl/.test(hero.html);
  const H=hero.html,gi=H.indexOf('<div class="fm-g"'),bowl=gi>=0?H.slice(gi,bal(H,gi)):'',verdict=g(H,/<p class="verdict"[^>]*>([^<]*)/),lbl=g(H,/<span class="lbl">([^<]*)/);
  const ai=H.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(H.slice(ai+21,bal(H,ai)-6)):'';
  /* kímélő mód (owner 2026-11-01): no calorie goal; the glass of water is the one level that counts; the tips as drop cards,
     the easy foods as pills, the caveat as Mezo's line; logged meals keep food and macros but no blood-sugar or score verdict */
  const gl=kim?(i=>H.slice(i,bal(H,i,'button')))(H.indexOf('<button class="fu-gl"')):'',sub1=(g(H,/<p class="sub">([^<]*)/).match(/^[^.]*\./)||[''])[0];
  const tipC=kim?cs.find(c=>/fu-tip/.test(c.html)):null,th=tipC?tipC.html:'';
  const tips=[...th.matchAll(/<div class="fu-tip">[\s\S]*?href="#([^"]+)"[\s\S]*?<b>([^<]*)<\/b><small>([^<]*)<\/small><\/span><\/div>/g)].map(([,ic,b,sm])=>`<div class="ex-mrow fx-tip">${drop(ic)}<span class="g"><b>${b}</b><i class="q">${sm}</i></span></div>`).join('');
  const foods=[...th.matchAll(/<span>([^<]*)<\/span>/g)].map(m=>`<span>${m[1]}</span>`).join('');
  const tipS=tipC?`<section class="mx-s ln">${KH(tipC.head||'Most ez segít')}<div class="ex-ml">${tips}</div>${foods?`<p class="ex-dates fx-fl">${g(th,/<span class="fh-lab">([^<]*)/)}</p><div class="ex-tg">${foods}</div>`:''}
    <div class="ex-mz">${badge('falat',{s:30})}<p>${g(th,/<p class="fh-note">([^<]*)/)}</p></div></section>`:'';
  const top=kim?`<section class="mx-s ex-hero"><small class="ex-eb fx-amb">${lbl}</small><h2 class="n7-h">${verdict}</h2><p class="ex-dates">${sub1}</p><div class="fx-glass">${gl}</div><div class="ex-acts fx-wide">${acts}</div></section>`
   :`<section class="mx-s ex-hero"><small class="ex-eb">${lbl}</small><h2 class="n7-h">${verdict}</h2><div class="fx-bowl">${bowl}</div><div class="ex-acts fx-wide">${acts}</div></section>`;
  /* macros: the tube's top is the goal; scale the fill so the goal sits at 85% and draw it as a dashed waterline */
  const mac=cs.find(c=>/fu-mac/.test(c.html));
  const tubes=mac?mac.html.replace(/^<section[^>]*>/,'').replace(/<\/section>$/,'').replace(/--p:([\d.]+)%/g,(m,p)=>`--p:${Math.min(98,+p*.85)}%`).replace(/<i>\/ ([^<]*)<\/i>/g,'<i>$1</i>').replace('<span class="fu-w">Szénhidrát</span>','<span class="fx-w">Szén&shy;hidrát</span>').replace(/<span class="k2-tube"([^>]*)><em><\/em>/g,'<span class="k2-tube"$1><em></em><i class="fx-wl" aria-hidden="true"></i>'):'';
  const macS=mac?`<section class="mx-s ln">${KH('Mai makrók')}<div class="ex-imp fx-mac">${tubes}</div></section>`:'';
  /* meals */
  const blocks=cs.filter(c=>/fm-blk/.test(c.html)).map(c=>{const h=c.html,bh=h.indexOf('<div class="fm-bh"'),be=bal(h,bh);
    const head=h.slice(bh,be),rest=h.slice(be).replace(/<\/section>$/,''),name=g(head,/<strong>([^<]*)/),win=g(head,/<small>([^<]*)/);
    const ci=head.indexOf('<span class="fu-cup'),cup=ci>=0?head.slice(ci,bal(head,ci,'span')):'';
    const open=/fm-blk[^"]*open/.test(h.slice(0,80)),t=g(rest,/<small>(\d{1,2}:\d{2})/)||win;
    return {name,win,cup,open,rest,ic:ico(head),t:hm(t)}}).sort((x,y)=>x.t-y.t);
  const nx=kim?null:blocks.find(b=>b.open);
  /* a logged meal: the four macros as full-word chips (a small filling capsule, the amount, the name in the macro's colour),
     then two verdict tiles: the blood-sugar curve and Mezo's score as a filling drop (owner: no "feh." abbreviations, no bare "8,4 pont") */
  const MN={'feh.':['fehérje','t-meat'],'szénh.':['szénhidrát','t-carb'],'zsír':['zsír','t-avocado'],'rost':['rost','t-fiber']};
  const chipsOf=h=>`<div class="fx-mg">${[...h.matchAll(/<span class="fl-mini" style="--c:([^"]+)"><span class="t"><i style="height:([\d.]+)%"><\/i><\/span><b>([^<]*)<\/b><small>([^<]*)<\/small><\/span>/g)]
    .map(([,c,hh,v,l])=>{const [n,ic]=MN[l]||[l,'t-plate'];return `<span class="fx-mc" style="--c:${c}"><span class="t"><i style="height:${hh}%"></i></span>${I(ic)}<span class="tx"><b>${v}</b><small>${n}</small></span></span>`}).join('')}</div>`;
  const cellsOut=r=>{const i=r.indexOf('<span class="fm-cells"');if(i<0)return r;const e=bal(r,i,'span');return r.slice(0,i)+chipsOf(r.slice(i,e))+r.slice(e)};
  const body=r=>pills(cellsOut(kim?r.replace(/<span class="fm-chips">[\s\S]*?<\/span><\/div>/,'</div>'):r)
      .replace(/<span class="fm-chips">([\s\S]*?)<\/span><\/div>/,(m,ch)=>`<div class="fx-q">${ch.replace(/<button class="fm-chip([^"]*)" data-sheet="glu"([^>]*)>(<svg[\s\S]*?<\/svg>)([^<]*)<\/button>/,'<button class="fx-t g$1" data-sheet="glu"$2><span class="ic">$3</span><span class="tx"><b>$4</b><small>vércukor-hatás</small></span></button>')
      .replace(/<button class="fm-chip sc"([^>]*)>[\s\S]*?<\/span>([^<]*)<\/button>/,(mm,at,v)=>`<button class="fx-t"${at}><span class="ic">${F.csepp('ok',Math.round(parseFloat(v.replace(',','.'))*10),{s:34,color:'var(--dom)',alive:false})}</span><span class="tx"><b>${v.trim()}</b><small>Mezo értékelése</small></span></button>`)}</div></div>`))
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
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${tipS}${kim?'':macS}${mealS}${logS}${wkS}${prS}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.mai=mai3;

/* the tab pages' header, as on Nap and Edzés: no big title, the "?" top left */
const head=h=>typeof h==='string'?hubHead(h):h;
Object.keys(fu.routes).forEach(k=>{const f=fu.routes[k];if(typeof f==='function'&&!f.__hub){const w=(...a)=>head(f(...a));w.__hub=1;fu.routes[k]=w}});

F.css(`/* kiserlet-fuel */
${P} .fh-tabs{gap:2px;justify-content:space-between}${P} .fh-tabs button{padding:8px 12px;flex:0 0 auto}@media (max-width:360px){${P} .fh-tabs button{padding:7px 8px;font-size:13px}}
${P} .fx-bowl{margin:14px 22px 0}${P} .fx-bowl .fm-g{display:flex;align-items:center;justify-content:space-between;gap:8px}
${P} .fx-wide .n9-btn{flex:1}${P} .fx-amb{color:#B4741F!important}${P} .fx-glass{display:flex;justify-content:center;margin:14px 0 0}${P} .fx-glass .fu-gl{transform:scale(1.35);transform-origin:top center;margin-bottom:40px}${P} .fx-glass .fu-gl small{font-size:13px!important;font-weight:750}${P} .fx-tip{background:#fff}${P} .fx-fl{margin-top:14px;font-weight:700}${P} .fx-bowl .fm-n small,${P} .fx-bowl .fu-bowl small{font-size:12.5px!important}${P} .fx-mh .fu-cup small,${P} .fx-mh .fu-cup b+small{font-size:12px!important}${P} .fx-ml .fl-mini small{font-size:12px!important}
${P} .fx-mac .k2-tube{position:relative}${P} .fx-wl{position:absolute;left:4px;right:4px;bottom:85%;height:0;border-top:2px dashed rgba(10,42,60,.45);z-index:2}
${P} .fx-leg{display:flex;align-items:center;gap:8px}${P} .fx-wl.s{position:static;display:inline-block;width:22px}
${P} .fx-ml{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .fx-ml.open{background:rgba(255,255,255,.72)}${P} .fx-ml.now{box-shadow:inset 0 0 0 2px var(--dom),0 12px 24px -16px var(--dom)}
${P} .fx-mh{display:flex;align-items:center;gap:10px}${P} .fx-mh svg.ng{width:46px;height:46px;margin:0;flex:none}${P} .fx-mh .g{flex:1;min-width:0;display:flex;flex-direction:column}
${P} .fx-mh .g b{font:800 17px/1.2 var(--disp,inherit);color:var(--ink)}${P} .fx-mh .g small{font-size:13px;color:var(--ink);opacity:.8}${P} .fx-ml.now .fx-mh .g small{opacity:1;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}
${P} .fx-mh .fu-cup{flex:none}${P} .fx-mh .ng-pipe,${P} .fx-mh .ng-flow{display:none}${P} .fx-mac .k2-vial small{font-size:13px!important;font-weight:750;color:color-mix(in srgb,var(--c) 70%,#0A2A3C)!important}${P} .fx-mac .k2-vial small i{display:block!important;width:fit-content;margin:4px auto 0;padding:2px 8px;border-radius:999px;background:#fff;font-style:normal;font-size:12px!important;font-weight:700;color:var(--ink)!important;box-shadow:0 0 0 1px rgba(10,42,60,.08)}${P} .fx-mac .k2-vial b{font-size:22px}${P} .fx-mac .fu-s{display:none!important}${P} .fx-mac .fx-w{display:none}${P} .fx-mac .k2-vial small{font-size:0!important;line-height:0}${P} .fx-mac .k2-vial small i{line-height:1.3}${P} .fx-mac .k2-vial small i{white-space:nowrap}@media (max-width:360px){${P} .fx-mac .k2-vial small i{padding:2px 6px}}
${P} .fx-ml .fm-meal{margin:0;padding:10px 0 0;border-top:1px solid rgba(10,42,60,.08)}${P} .fx-ml .fm-mn{display:block;text-align:left}${P} .fx-ml .fm-mn strong{display:block;font-size:15.5px;font-weight:750;color:var(--ink)}${P} .fx-ml .fm-mn small{font-size:13px;color:var(--ink)}
${P} .fx-ml .fm-mb{display:block;margin-top:10px}
${P} .fx-mg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
${P} .fx-mc{display:flex;align-items:center;gap:8px;min-width:0;padding:8px 10px;border-radius:16px;background:color-mix(in srgb,var(--c) 12%,#fff)}
${P} .fx-mc .t{position:relative;flex:none;width:10px;height:28px;border-radius:5px;background:#fff;overflow:hidden;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c) 40%,transparent)}${P} .fx-mc .t i{position:absolute;left:0;right:0;bottom:0;background:var(--c)}
${P} .fx-mc>svg.ic{flex:none;width:22px;height:22px;color:color-mix(in srgb,var(--c) 70%,#0A2A3C)}${P} .fx-mc .tx{display:flex;flex-direction:column;min-width:0;line-height:1.15}
${P} .fx-mc .tx b{font:800 15px/1.1 var(--disp,inherit);color:var(--ink)}${P} .fx-mc .tx small{font-size:12.5px;font-weight:700;color:color-mix(in srgb,var(--c) 65%,#0A2A3C)}
${P} .fx-q{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
${P} .fx-t{display:flex;align-items:center;gap:10px;min-height:56px;padding:8px 12px;border-radius:18px;background:#fff;text-align:left;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.08)}
${P} .fx-t .ic{flex:none;display:grid;place-items:center;width:36px;height:36px}${P} .fx-t .ic>svg{width:30px;height:30px}${P} .fx-t .tx{display:flex;flex-direction:column;min-width:0;line-height:1.15}
${P} .fx-t .tx b{font:800 15px/1.1 var(--disp,inherit);color:var(--ink)}@media (max-width:360px){${P} .fx-mc>svg.ic{display:none}${P} .fx-t{padding:8px;gap:6px}${P} .fx-t .ic{width:30px}}${P} .fx-t .tx small{font-size:12px;font-weight:650;color:var(--ink);opacity:.75}
${P} .fx-t.g b,${P} .fx-t.g .ic{color:#23704A}${P} .fx-t.g.mid b,${P} .fx-t.g.mid .ic{color:#B4741F}${P} .fx-t.g.hi b,${P} .fx-t.g.hi .ic{color:#C2483B}
${P} .fx-when{margin:0;font-size:14px;color:var(--ink)}${P} .fx-ml .fh-acts{display:flex;gap:10px;margin:0;flex-wrap:wrap}
${P} .fx-lg .ex-spt{padding:14px 6px}${P} .fx-st{margin-top:4px}${P} .fx-st .st{font-size:12px!important}
`);

window.FNOTES_FOLY=`<h2>Kísérlet · Fuel</h2><p><a href="#w-fuel-mai"><b>Mai</b></a> — felül a mondat és a tál, a makrók csövei a napi cél szaggatott vonalával, az étkezések időrendben egyforma kártyán (az ablakon kívüli a helyén, a következő kiemelve), a logolás módjai csempéken. Arcok: <a href="#w-fuel-mai.kihagyva">kihagyott étkezés</a> · <a href="#w-fuel-mai.kimelo">kímélő mód</a> (nincs kalóriacél, a pohár víz a kép, értékelés nélkül). Összevetésnek: <a href="#w-fuel-mai-lista">a mostani Mai</a>.</p>`+(window.FNOTES_FOLY||'');
})();
