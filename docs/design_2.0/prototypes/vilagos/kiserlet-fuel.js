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
const O={mai:fu.routes.mai,stack:fu.routes.stack,trendek:fu.routes.trendek,konyha:fu.routes.konyha,recept:fu.routes.recept,kamra:fu.routes.kamra,receptek:fu.routes.receptek,muhely:fu.routes.muhely,log:fu.routes.log};fu.routes['log-lista']=O.log;fu.routes['muhely-lista']=O.muhely;fu.routes['receptek-lista']=O.receptek;fu.routes['kamra-lista']=O.kamra;fu.routes['recept-lista']=O.recept;fu.routes['trendek-lista']=O.trendek;fu.routes['konyha-lista']=O.konyha;
fu.routes['mai-lista']=O.mai;fu.routes['stack-lista']=O.stack;
const ico=h=>g(h,/href="#([^"]+)"/)||'t-plate';
/* the log page's six modes (owner 2026-11-02: no Keresés tile — Recept then Kamra, both open their drawer at once); Mai's "Logolj bármit" uses the same */
const LOGMODES=[['foto','Fotó','t-camera'],['recept','Recept','t-book','receptpick'],['kamra','Kamra','t-stack','kamrapick'],['gyors','Gyors','t-quick'],['diktalas','Diktálás','t-mic'],['szokasos','Szokásosak','t-repeat']];

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
  /* the log page's six modes with the log page's targets (review fix 2026-11-03: Keresés was removed there on 2026-11-02;
     Recept and Kamra open their drawer at once, the others open the log page on that mode) */
  const tiles=LOGMODES.map(([k,l,ic,sh])=>sh?`<button class="ex-spt" data-sheet="${sh}">${drop(ic)}<b>${l}</b></button>`:`<button class="ex-spt" data-go="log.${k}">${drop(ic)}<b>${l}</b></button>`).join('');
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

/* ═══ KIEGÉSZÍTŐK (2026-11-01): the sentence names the next dose, the day's capsules by band as the picture, one wide
   "Bevettem"; each band without numbers, every item a row with a small capsule that fills when taken (the same data-ftk
   toggle); a band that is all done folds into one line (owner: "csukódjon össze"), tap opens it; protocol rows as drops. ═══ */
function stack3(a){const base=O.stack(a),cs=cardsOf(base);const hero=cs.find(c=>/fu-caps/.test(c.html));if(!hero)return base;
  const H=hero.html,ci=H.indexOf('<div class="fu-caps"'),capsP=ci>=0?H.slice(ci,bal(H,ci)):'',ai=H.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(H.slice(ai+21,bal(H,ai)-6)):'';
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="lbl">([^<]*)/)}</small><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2><p class="ex-dates">${g(H,/<p class="sub">([^<]*)/)}</p>
    <div class="fx-caps">${capsP}</div><div class="ex-acts fx-wide">${acts}</div></section>`;
  const bands=cs.filter(c=>/data-ftk/.test(c.html)).map(c=>{const hd=g(base.slice(base.lastIndexOf('<p class="fh-n',c.start),c.start),/<\/b>([^<]*)<\/p>/),[nm,dn,of]=[g(hd,/^([^·]*)/).trim(),+g(hd,/(\d+) \/ \d+/),+g(hd,/\d+ \/ (\d+)/)];
    const rows=c.html.split('<div class="fh-row">').slice(1).map(r=>{const on=/fx-tk on/.test(r),tb=g(r,/(<button class="fx-tk[^"]*"[^>]*>)/),gb=g(r,/(<button class="g fx-g"[^>]*>)/);
      return `<div class="fx-sr">${tb.replace('class="fx-tk','class="fx-tk fx-cp')}<i></i></button>${gb.replace('class="g fx-g"','class="fx-sg"')}<b>${g(r,/<strong>([^<]*)/)}</b><small>${g(r,/<small>([^<]*)/)}</small></button><span class="fx-chv">›</span></div>`}).join('');
    const box=`<div class="fx-sl">${rows}</div>`;
    return dn===of&&of?`<section class="mx-s ln"><details class="fx-band"><summary>${KH(nm,'')}<span class="fx-bs"><span class="fx-mini">${'<i></i>'.repeat(of)}</span>${of===1?'megvan':`mind a ${of} megvan`}<em>›</em></span></summary>${box}</details></section>`
      :`<section class="mx-s ln">${KH(`${nm} · ${dn} / ${of}`)}${box}</section>`}).join('');
  const pc=cs.find(c=>/data-go="protokoll"/.test(c.html)),ph=pc?pc.html:'';
  const rows=[...ph.matchAll(/<button class="fh-row" ([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^<]*)<\/small>/g)].map(([,at,ic,t,sm])=>`<button class="ex-mrow" ${at}>${drop(ic)}<span class="g"><b>${t}</b><i class="q">${sm}</i></span><span class="v">›</span></button>`).join('');
  const prS=pc?`<section class="mx-s ln">${KH('Protokoll és beállítás')}<div class="ex-ml">${rows}</div><div class="ex-mz">${badge('falat',{s:30})}<p>${g(ph,/<p class="fh-note">([^<]*)/)}</p></div></section>`:'';
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${bands}${prS}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.stack=stack3;

/* ═══ TRENDEK (2026-11-01): the week switcher stays; the sentence on top, the seven day tubes as the picture without
   the grey legend and helper text (a tap opens the day); the four stat tiles straight on the ground; the communicating
   vessels, the long-run curves (one under the other — owner) and the goal steps kept, their grey notes as Mezo's line;
   patterns as drop rows. ═══ */
const inner=h=>h.replace(/^<section[^>]*>/,'').replace(/<\/section>$/,'');
const cut=(h,start)=>{const i=h.indexOf(start);return i<0?h:h.slice(0,i)+h.slice(bal(h,i,start.match(/^<(\w+)/)[1]))};
const mz=t=>`<div class="ex-mz">${badge('mezo',{s:30})}<p>${t}</p></div>`;
function trendek3(a){const base=O.trendek(a),cs=cardsOf(base);const hero=cs.find(c=>/fu-wk/.test(c.html));if(!hero)return base;
  const H=hero.html,wi=H.indexOf('<div class="fu-wk"'),wk=wi>=0?H.slice(wi,bal(H,wi)):'',ai=H.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(H.slice(ai+21,bal(H,ai)-6)):'';
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="lbl">([^<]*)/).replace(' · ebből áll a heti kép','')}</small><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2>
    <div class="fx-wk">${wk}</div><div class="ex-acts fx-wide">${acts.replace('class="n9-btn"','class="n9-btn"')}</div></section>`;
  const head=c=>g(base.slice(base.lastIndexOf('<p class="fh-n',c.start),c.start),/<\/b>([^<]*)<\/p>/);
  const sec=(c,body)=>`<section class="mx-s ln">${KH(head(c))}${body}</section>`;
  const out=cs.filter(c=>c!==hero).map(c=>{const h=c.html,note=g(h,/<p class="fh-note">([\s\S]*?)<\/p>/);
    if(/fh-grid/.test(h))return sec(c,`<div class="fx-stats">${inner(h)}</div>`);
    if(/fu-lk/.test(h))return sec(c,`<div class="fx-lk">${cut(inner(h),'<p class="fh-note">')}</div>${mz('Amit hétközben nem eszel meg, hétvégén átfolyik. Most 46 százalékponttal a hétvége javára.')}`);
    if(/Súlytrend/.test(h))return sec(c,`<div class="fx-long">${cut(cut(inner(h),'<div class="fh-h">'),'<p class="fh-note">')}</div>${mz('Fent a súly, lent az evés. Ahol nem volt mérés, ott nincs pont. Ez együttjárás, nem ok.')}`);
    if(/fh-row/.test(h)){const rows=[...h.matchAll(/<button class="fh-row" ([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^<]*)<\/small><\/span>(<span class="st [^"]*">[^<]*<\/span>)?/g)]
        .map(([,at,ic,t,sm,st])=>`<button class="ex-mrow" ${at}>${drop(ic)}<span class="g"><b>${t}</b><i class="q">${sm}</i>${st?`<span class="fx-st">${st}</span>`:''}</span><span class="v">›</span></button>`).join('');
      return sec(c,`<div class="ex-ml">${rows}</div>${note?`<p class="ex-dates">${note}</p>`:''}`)}
    return sec(c,`<div class="fx-goal">${cut(inner(h),'<p class="fh-note">').replace(/<text x="[\d.]+" y="([\d.]+)" text-anchor="middle">cél /,'<text x="334" y="$1" text-anchor="end">cél ')}</div>${note?mz(note.replace('Ami még hátravan, az utolsó oszlop a cél vízvonaláig.','Ami még hátravan: az utolsó oszlop a cél vonaláig.')):''}`)}).join('');
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${out}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.trendek=trendek3;

/* ═══ KONYHA (2026-11-02): the sentence on top, the empty pot as the picture, the five goals as one row of drop tiles,
   the grey line as Mezo's, one wide button; quick add as two tiles without helper text; the recipes as tubes (the most
   eaten fullest) and the pantry as a shelf of jars were tried and dropped (owner): both are plain entry rows now. ═══ */
function konyha3(a){const base=O.konyha(a),cs=cardsOf(base);const hero=cs.find(c=>/fu-pot/.test(c.html));if(!hero)return base;
  const H=hero.html,pi=H.indexOf('<span class="fu-pot"'),pot=pi>=0?H.slice(pi,bal(H,pi,'span')):'',ai=H.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(H.slice(ai+21,bal(H,ai)-6)):'';
  const tile=(at,ic,l)=>`<button class="ex-spt" ${at}>${drop(ic)}<b>${l}</b></button>`;
  const goals=[...H.matchAll(/<button class="fh-pill[^"]*" data-go="([^"]+)">[\s\S]*?href="#([^"]+)"[\s\S]*?<\/span>([^<]*)<\/button>/g)].map(([,go,ic,l])=>tile(`data-go="${go}"`,ic,l.replace('Lefekvés','Lefek&shy;vés'))).join('');
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="lbl">([^<]*)/)}</small><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2>
    <div class="fx-pot">${pot}</div><div class="ex-spg fx-gl">${goals}</div>${mz(g(H,/<p class="sub">([^<]*)/))}<div class="ex-acts fx-wide">${acts}</div></section>`;
  const qc=cs.find(c=>/fu-pair/.test(c.html)),qh=qc?qc.html:'';
  const quick=[...qh.matchAll(/<button (data-[^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<\/svg>(?:<\/span>)*([^<]*)<small>/g)].map(([,at,ic,l])=>tile(at,ic,l)).join('');
  const qS=`<section class="mx-s ln">${KH('Gyors felvétel')}<div class="ex-spg fx-q2">${quick}</div></section>`;
  /* recipes and pantry: entry rows only, no preview (owner, 2026-11-02: the tubes and the jar shelf read as a dump; the
     lists belong on their own pages, one item per row) */
  const rc=cs.find(c=>/data-go="receptek"/.test(c.html)),kc=cs.find(c=>/data-go="kamra"/.test(c.html));
  const ent=(go,ic,t,sm)=>`<button class="ex-mrow" data-go="${go}">${drop(ic)}<span class="g"><b>${t}</b><i class="q">${sm}</i></span><span class="v">›</span></button>`;
  const rkS=`<section class="mx-s ln">${KH('Receptek és kamra')}<div class="ex-ml">${ent('receptek','t-book','Receptek',rc?g(rc.html,/<strong>([^<]*)<\/strong>/):'')}${ent('kamra','t-stack','Kamra',kc?g(kc.html,/<strong>([^<]*)<\/strong>/):'')}</div></section>`;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${qS}${rkS}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.konyha=konyha3;

/* ═══ RECEPT (2026-11-02): the sentence on top, the pot beside the big kcal as the picture, the serving switch and one
   wide "Ma ettem ilyet"; the macros as the Mai page's three tubes (the icon names them, the energy share on a pill, no
   split bar or legend); the ingredients as drop rows with a coloured source tag (kamrából / becsült) and the share tube;
   quality as full-word tiles with Mezo's score as a filling drop, the grey hero lines moved down here; a recipe-specific
   Mezo line (owner: one per recipe); the logging row dropped from "Tovább" (the hero has it). ═══ */
const RNOTE={'Túrós zabkása':'Edzés előtt 2–3 órával ideális: lassú szénhidrát, és a túró sokáig kitart.',
  'Csirke + édesburgonya':'Edzés utáni ebédnek jó: sok fehérje, és az édesburgonya visszatölti, amit elhasználtál.',
  'Lazac + barna rizs':'Edzés után jó: fehérje és omega-3 egy tányéron. A zsír a lazacból jön, nem kell mellé több olaj.',
  'Túró · áfonya':'Esti nassolásnak jó: a túró lassan szívódik fel, éjszaka is táplál.',
  'Whey + banán':'Gyors turmix edzés után. A banán fele is elég, a mandulavaj fékezi a cukrot.',
  'Tojásrántotta':'Alacsony szénhidrátú reggelnek jó: a tojás és a spenót sokáig laktat.'};
function recept3(a){const base=O.recept(a),cs=cardsOf(base);const hero=cs.find(c=>/fu-pot/.test(c.html));if(!hero)return base;
  const H=hero.html,pi=H.indexOf('<span class="fu-pot"'),pot=pi>=0?H.slice(pi,bal(H,pi,'span')):'',si=H.indexOf('<div class="fh-seg"'),seg=si>=0?H.slice(si,bal(H,si)):'';
  const big=g(H,/<span class="fh-big">([^<]*)/),unit=g(H,/<span class="fh-big">[^<]*<small>([^<]*)/),[l1,l2]=[...H.matchAll(/<div class="nn">[\s\S]*?<\/div>/g)].map(m=>m[0])[0]?.match(/<p>[^<]*<\/p>/g)||[];
  const go=g(H,/(<button class="btn " data-go="log\.tetelek">[^<]*<\/button>)/),sc=g(H,/Pontszám ([\d,]+) ›/),scT=g(H,/data-toast="(A recept értékelése[^"]*)"/);
  const name=g(base,/<h1 class="sm">([^<]*)/),note=Object.entries(RNOTE).find(([k])=>name.startsWith(k));
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="lbl">([^<]*)/)}</small><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2>
    <div class="fx-pk">${pot}<span class="fx-kc"><b>${big}</b><small>${unit}</small></span></div>${seg?`<div class="ex-seg fx-sg2">${seg}</div>`:''}<div class="ex-acts fx-wide">${pills(go)}</div></section>`;
  const mac=cs.find(c=>/k2-vials/.test(c.html)),mi=mac?mac.html.indexOf('<div class="k2-vials"'):-1;
  const macS=mac?`<section class="mx-s ln">${KH(/egesz/.test(a||'')?'Makrók · az egész receptben':'Makrók · egy adagban')}<div class="ex-imp fx-mac fx-rm">${mac.html.slice(mi,bal(mac.html,mi))}</div></section>`:'';
  const ingC=cs.find(c=>/fx-it/.test(c.html));
  const ings=ingC?[...ingC.html.matchAll(/<button class="fh-row fx-it" ([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^·<]*)· (\w+)[^<]*<\/small><\/span><span class="v">(\d+)<small>kcal<\/small><\/span>[\s\S]*?width:([\d.]+)%[\s\S]*?<small class="fu-shn">([^<]*)<\/small>/g)]
    .map(([,at,ic,n,amt,src,k,w,pc])=>`<button class="ex-mrow fx-ing" ${at}>${drop(ic)}<span class="g"><b>${n}</b><span class="fx-ir"><em>${amt.trim()}</em><span class="fx-src ${src==='kamra'?'k':'b'}">${src==='kamra'?'kamrából':'becsült'}</span></span><span class="fx-sh"><i style="width:${w}%"></i></span></span><span class="fx-ikv"><b>${k}</b><small>kcal · ${pc}</small></span></button>`).join(''):'';
  /* the approved page reuses the lunch's ingredients for most recipes (a salmon recipe listing chicken); here each recipe
     gets its own, summing to its kcal: [name, icon, pantry id, source, kcal for the whole recipe, amount] */
  const RING={r3:[['Lazacfilé · norvég','t-meat','lazac','kamra',832,'400 g'],['Barna rizs','t-carb',null,'becslés',576,'160 g'],['Brokkoli','t-fiber',null,'becslés',102,'300 g'],['Olívaolaj · extra szűz','t-avocado',null,'becslés',126,'14 ml']],
    r6:[['Túró · félzsíros','t-protein','turo','kamra',221,'170 g'],['Áfonya · fagyasztott','t-fiber',null,'becslés',57,'100 g'],['Akácméz','t-sugar',null,'becslés',46,'15 g']],
    r5:[['Tojás · M-es','t-protein',null,'becslés',210,'3 db'],['Spenót · friss','t-fiber',null,'becslés',35,'150 g'],['Vaj','t-fat',null,'becslés',73,'10 g']]};
  const [rid,rmode]=(a||'r1').split('.'),dv=rmode==='egesz'?1:+(g(H,/(\d+) adagos/)||1),own=RING[rid];
  const ingRow=(at,ic,n,amt,src,k,w,pc)=>`<button class="ex-mrow fx-ing" ${at}>${drop(ic)}<span class="g"><b>${n}</b><span class="fx-ir"><em>${amt.trim()}</em><span class="fx-src ${src==='kamra'?'k':'b'}">${src==='kamra'?'kamrából':'becsült'}</span></span><span class="fx-sh"><i style="width:${w}%"></i></span></span><span class="fx-ikv"><b>${k}</b><small>kcal · ${pc}</small></span></button>`;
  const tot=own?own.reduce((x,r)=>x+r[4],0):0;
  const ings2=own?own.map(([n,ic,kid,src,k,amt])=>ingRow(kid?`data-go="kamra.${kid}"`:`data-toast="${n} · becsült sor, nincs kamra-tétel"`,ic,n,dv>1?amt.replace(/^(\d+)/,m=>String(Math.round(m/dv))):amt,src,Math.round(k/dv),k/tot*100,Math.round(k/tot*100)+'%')).join(''):ings;
  const ingS=ingC?`<section class="mx-s ln">${KH(`Hozzávalók · ${own?own.length:(ingC.html.match(/fx-it/g)||[]).length} tétel`)}<div class="ex-ml">${ings2}</div></section>`:'';
  const qc=cs.find(c=>/fu-kv/.test(c.html)),qh=qc?qc.html:'';
  const rowV=t=>{const m=qh.match(new RegExp('<strong>'+t+'</strong></span><span class="v">([^<]*)<small>([^<]*)'));return m?m[1]+(m[2]==='%'?'%':' '+m[2]):''};
  const kv=[...qh.matchAll(/<div><small>([^<]*)<\/small><b>([^<]*)<\/b><\/div>/g)].map(([,k,v])=>[k.replace('Tel. zsír','Telített zsír'),v]);
  const nova=(l1||'').match(/NOVA (\d)/),born=g(l2||'',/létrehozva ([^·<]*)/).trim();
  const tiles=[['Alapanyag-arány',rowV('Alapanyag-arány')],['Növényféle',rowV('Növényféle').replace(' db',' fajta')],...kv,...(nova?[['Feldolgozottság',nova[1]==='1'?'alapanyag':nova[1]+'. fokozat']]:[])]
    .map(([k,v])=>`<span class="fx-qt ${/nincs/.test(v)?'na':''}"><small>${k}</small><b>${v}</b></span>`).join('');
  const scoreT=`<button class="fx-t fx-sct" data-toast="${scT||'A recept értékelése folyamatban'}"><span class="ic">${sc?F.csepp('ok',Math.round(parseFloat(sc.replace(',','.'))*10),{s:40,color:'var(--dom)',alive:false}):F.csepp('ok',0,{s:40,color:'var(--dom)',alive:false})}</span><span class="tx"><b>${sc||'folyamatban'}</b><small>${sc?'Mezo értékelése · 9 szempont':'Mezo még értékeli'}</small></span><span class="v">›</span></button>`;
  const qS=qc?`<section class="mx-s ln">${KH('Minőség')}<div class="fx-qual">${scoreT}<div class="fx-qg">${tiles}</div></div>${note?mz(note[1]):''}</section>`:'';
  const nc=cs[cs.length-1],nh=nc.html;
  const rows=[...nh.matchAll(/<button class="fh-row" ([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^<]*)<\/small>/g)].filter(m=>!/log\.tetelek/.test(m[1]))
    .map(([,at,ic,t,sm])=>`<button class="ex-mrow" ${at}>${drop(ic)}<span class="g"><b>${t}</b><i class="q">${sm}</i></span><span class="v">›</span></button>`).join('');
  const ai=nh.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(nh.slice(ai+21,bal(nh,ai)-6)):'';
  const nS=`<section class="mx-s ln">${KH('Tovább')}<div class="ex-ml">${rows}</div><div class="ex-acts">${acts}</div>${born?`<p class="ex-dates fx-born">Létrehozva: ${born}</p>`:''}</section>`;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${macS}${ingS}${qS}${nS}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.recept=recept3;

/* ═══ KAMRA-TÉTEL (2026-11-02): the sentence on top; the picture is the shelf's jar, big — for a food it fills in layers
   with what 100 g holds (protein at the bottom, then fat and carbohydrate, water on top; owner: layers over the bar), the
   kcal and each layer's grams beside it; a supplement's jar is blue with its dose. One wide button; the macros as the
   recipe's tubes; quality as tiles; the source as drop rows with Mezo pricing a gram of protein; the recipes it is in as
   tubes; edit / delete at the bottom. ═══ */
function kamraItem3(a){const base=O.kamra(a),cs=cardsOf(base);const hero=cs.find(c=>/fh-hero/.test(c.html.slice(0,60)));if(!hero)return base;
  const H=hero.html,big=g(H,/<span class="fh-big[^"]*">([^<]*)/),unit=g(H,/<span class="fh-big[^"]*">[^<]*<small>([^<]*)/),verdict=g(H,/<\/span>([^<]*)<\/p>/);
  const layers=[...H.matchAll(/<span style="--c:([^"]+)"><i><\/i>([^<]*)<b>([\d,]+) g<\/b><\/span>/g)].map(([,c,n,v])=>({c,n,v,x:parseFloat(v.replace(',','.'))}));
  const food=layers.length>0,ai=H.indexOf('<div class="fh-acts">'),actH=ai>=0?H.slice(ai+21,bal(H,ai)-6):'';
  const main=g(actH,/(<button class="btn "[^>]*>[^<]*<\/button>)/),rest=actH.replace(main,'');
  const order=['Fehérje','Zsír','Szénhidrát','Víz és egyéb'],lay=order.map(n=>layers.find(l=>l.n===n)).filter(l=>l&&l.x>0);
  const sum=lay.reduce((x,l)=>x+Math.max(l.x,4),0);
  const jar=food?`<span class="fx-bj"><span class="j">${lay.map(l=>`<i style="height:${Math.max(l.x,4)/sum*86}%;background:${l.c}"></i>`).join('')}</span></span>`
    :`<span class="fx-bj s"><span class="j"><i style="height:78%"></i></span></span>`;
  const side=`<span class="fx-bs2"><span class="fx-kc"><b>${big}</b><small>${unit}</small></span>${food?`<span class="fx-ly">${lay.slice().reverse().map(l=>`<span><i style="background:${l.c}"></i>${l.n.replace(' és egyéb','')}<b>${l.v} g</b></span>`).join('')}</span>`:''}</span>`;
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="fx-la">([^<]*)/)}</small><h2 class="n7-h">${verdict}</h2>
    <div class="fx-jr">${jar}${side}</div><div class="ex-acts fx-wide">${pills(main)}</div></section>`;
  const head=c=>g(base.slice(base.lastIndexOf('<p class="fh-n',c.start),c.start),/<\/b>([^<]*)<\/p>/);
  const rowsOf=h=>[...h.matchAll(/<(button|div) class="fh-row"([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong>(?:<small>([^<]*)<\/small>)?<\/span>(?:<span class="v">([^<]*)(?:<small>([^<]*)<\/small>)?<\/span>|<span class="st[^"]*">([^<]*)<\/span>)?/g)]
    .map(([,tag,at,ic,t,sm,v,u,st])=>({tag,at,ic,t,sm:sm||'',v:v?(v+(u?' '+u:'')).trim():st||''}));
  const drow=r=>`<${r.tag==='button'?'button':'div'} class="ex-mrow"${r.at}>${drop(r.ic)}<span class="g"><b>${r.t}</b>${r.sm?`<i class="q">${r.sm}</i>`:''}</span>${r.v?`<span class="fx-ikv"><b>${r.v}</b></span>`:r.tag==='button'?'<span class="v">›</span>':''}</${r.tag==='button'?'button':'div'}>`;
  const secs=cs.filter(c=>c!==hero).map(c=>{const h=c.html,t=head(c);
    if(/k2-vials/.test(h)){const i=h.indexOf('<div class="k2-vials"');return `<section class="mx-s ln">${KH('Makrók · 100 grammban')}<div class="ex-imp fx-mac fx-rm">${h.slice(i,bal(h,i))}</div></section>`}
    if(/^Minőség/.test(t))return `<section class="mx-s ln">${KH('Minőség · 100 grammban')}<div class="fx-qual"><div class="fx-qg" style="margin-top:0">${rowsOf(h).map(r=>`<span class="fx-qt"><small>${r.t}</small><b>${r.v}</b></span>`).join('')}</div></div></section>`;
    if(/^Receptekben/.test(t)){const rs=rowsOf(h),mx=24;
      return `<section class="mx-s ln">${KH('Receptekben')}<div class="fx-rec"><div class="fu-top">${rs.map(r=>{const n=+(r.sm.match(/(\d+)×/)||[0,0])[1];return `<button${r.at}><span><b>${r.t}</b><em>${n}×</em></span><div class="fl-level" style="--c:var(--dom);--h:18px"><i style="width:${n/mx*100}%"></i></div></button>`}).join('')}</div></div></section>`}
    if(/^Forrás/.test(t)){const rs=rowsOf(h),pr=rs.find(r=>r.t==='Ár'),pg=layers.find(l=>l.n==='Fehérje');
      const ft=pr&&pg&&pg.x?Math.round(parseInt(pr.v.replace(/\s/g,''))/10/pg.x):0;
      return `<section class="mx-s ln">${KH('Forrás')}<div class="ex-ml">${rs.filter(r=>r.t!=='A polcodon').map(drow).join('')}</div>${ft?mz(`Ebben 1 gramm fehérje kb. ${ft} forintba kerül.`):''}</section>`}
    return `<section class="mx-s ln">${KH(t)}<div class="ex-ml">${rowsOf(h).map(drow).join('')}</div></section>`}).join('');
  const bot=`<section class="mx-s ln"><div class="ex-acts">${pills(rest)}</div></section>`;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${secs}${bot}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.kamra=a=>a==='ures'?O.kamra(a):a?kamraItem3(a):kamraList3();

/* ═══ RECEPTEK + KAMRA lists (2026-11-02, owner): the sentence on top with one wide button, no preview picture (the top
   tubes and the four kind-vials repeated what the list and the filter already say); one item per row. A recipe row keeps
   its macros (owner: "that is how I choose") as three full-word chips with a small filling tube; a pantry row is the
   item, its brand and protein, and its kcal per 100 g (a supplement: its dose). ═══ */
const listTop=(H,acts)=>`<section class="mx-s ex-hero"><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2><div class="ex-acts fx-wide">${acts}</div></section>`;
const actsOf=H=>{const i=H.indexOf('<div class="fh-acts">');if(i<0)return '';const a=H.slice(i+21,bal(H,i)-6),m=g(a,/(<button class="btn "[^>]*>[^<]*<\/button>)/);return pills(m)+`</div><div class="ex-acts fx-sub">${pills(a.replace(m,''))}`};
const pickOf=h=>{const i=h.indexOf('<div class="fh-pills"');return i<0?'':h.slice(i,bal(h,i))};
function receptek3(){const base=O.receptek(),cs=cardsOf(base);const hero=cs.find(c=>/fu-top/.test(c.html));if(!hero)return base;
  const fc=cs.find(c=>/data-fpick/.test(c.html)),lc=cs.find(c=>/fx-it/.test(c.html));
  const MW=[['feh.','fehérje','var(--protein)'],['szénh.','szénhidrát','var(--carb)'],['zsír','zsír','var(--fat)']];
  const rows=lc?[...lc.html.matchAll(/<button class="fh-row fx-it" ([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^<]*)<\/small><\/span><span class="v">(\d+)<small>kcal<\/small><\/span>([\s\S]*?)<\/button>/g)]
    .map(([,at,ic,n,sm,k,rest])=>{const mac=[...rest.matchAll(/width:([\d.]+)%[\s\S]*?<b>(\d+)<\/b> g ([^<]*)<\/small>/g)].map(([,w,v,l])=>{const m=MW.find(x=>x[0]===l.trim())||[l,l,'var(--dom)'];return `<span class="fx-mc" style="--c:${m[2]}"><span class="t"><i style="height:${w}%"></i></span><span class="tx"><b>${v} g</b><small>${m[1]}</small></span></span>`}).join('');
      const star=/st plan/.test(rest);
      const parts=sm.split(' · '),tag=(ic2,t,cl='')=>`<span class="fx-tg ${cl}">${I(ic2)}${t}</span>`;
      const tags=parts.map((t,j)=>j===0?tag(ic,t,'m'):/perc$/.test(t)?tag('t-clock',t):/^Edzés előtt/.test(t)?tag('t-bolt',t,'w'):/^Edzés után/.test(t)?tag('t-dumbbell',t,'w'):/adag$/.test(t)?tag('t-portion',t):tag('t-tick',t)).join('');
      return `<button class="fx-rr" ${at}><span class="fx-rh">${drop(ic)}<span class="g"><b>${n}${star?`<svg class="ic fx-star" role="img" aria-label="csillagos"><use href="#t-star"/></svg>`:''}</b></span></span><span class="fx-tgs">${tags}</span><span class="fx-rg"><span class="fx-kt"><b>${k}</b><small>kcal · egy adag</small></span>${mac}</span></button>`}).join(''):'';
  const out=`${listTop(hero.html,actsOf(hero.html))}${fc?`<section class="mx-s ln">${KH('Szűrés')}<div class="fx-pk2">${pickOf(fc.html)}</div></section>`:''}<section class="mx-s ln">${KH('Receptjeid')}<div class="ex-ml fx-roomy">${rows}</div></section>`;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${out}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.receptek=receptek3;
function kamraList3(){const base=O.kamra(),cs=cardsOf(base);const hero=cs.find(c=>/k2-vials/.test(c.html));if(!hero)return base;
  const fc=cs.find(c=>/data-fpick/.test(c.html)),sc=cs.find(c=>/fh-stat/.test(c.html)),xc=cs.find(c=>/t-swap/.test(c.html));
  const srch=fc?(i=>i<0?'':fc.html.slice(i,bal(fc.html,i)))(fc.html.indexOf('<div class="fx-srch"')):'';
  const rows=sc?[...sc.html.matchAll(/<button class="fh-stat" style="--c:var\(--(\w+)\)[^"]*" (data-go="[^"]+")>[\s\S]*?href="#([^"]+)"[\s\S]*?<span class="k">([^<]*)<\/span><div class="n">([^<]*)<small>([^<]*)<\/small><\/div>[\s\S]*?<span class="s ">([^<]*)<\/span>/g)]
    .map(([,c,at,ic,n,v,u,sm])=>{const p=sm.split(' · '),food=c==='protein',id=at.match(/kamra\.(\w+)/)[1],it=O.kamra(id);
      /* each card reads its item page once: the category from the header, the grams per 100 g, a supplement's timing */
      const cat=(g(it,/<div class="fh-title"><small><i><\/i><span>([^<]*)/).split(' · ')[1])||'';
      const gr=nm=>{const m=it.match(new RegExp('<i></i>'+nm+'<b>([\\d,]+) g</b>'));return m?m[1]:'0'},num=x=>parseFloat(x.replace(',','.'));
      const SI={link:'t-link','fotó':'t-camera','közös katalógus':'t-stack','kézi':'t-journal'},src=p[2]||'';
      const tag=(ic2,t,cl='')=>`<span class="fx-tg ${cl}">${I(ic2)}${t}</span>`;
      const SW={link:'linkről','fotó':'fotóról','közös katalógus':'katalógusból','kézi':'kézzel felvéve'},cap=t=>t.replace(/^./,ch=>ch.toUpperCase());
      const tags=(food?tag(ic,cat,'m'):tag(ic,cap(p[0]),'s'))+(src?tag(SI[src]||'t-tick',SW[src]||src):'');
      let grid;
      if(food){const m=[['Fehérje','fehérje','var(--protein)'],['Szénhidrát','szénhidrát','var(--carb)'],['Zsír','zsír','var(--fat)']].map(([k,l,col])=>[gr(k),l,col]),mx=Math.max(...m.map(x=>num(x[0])))||1;
        grid=`<span class="fx-kt"><b>${v}</b><small>kcal · 100 g</small></span>`+m.map(([x,l,col])=>`<span class="fx-mc" style="--c:${col}"><span class="t"><i style="height:${num(x)/mx*100}%"></i></span><span class="tx"><b>${x} g</b><small>${l}</small></span></span>`).join('')}
      else{const when=g(it,/data-go="stack">[\s\S]*?<strong>([^<]*)<\/strong>/)||'Nincs időzítve';
        grid=`<span class="fx-kt s"><b>${v}</b><small>egy adag</small></span><span class="fx-kt w">${I('t-clock')}<b>${when.replace(/^[\d,]+ g · /,'').replace(/^./,ch=>ch.toUpperCase())}</b><small>mikor szeded</small></span>`}
      return `<button class="fx-rr fx-kc2 ${food?'':'s'}" ${at}><span class="fx-rh">${drop(ic)}<span class="g"><b>${n}</b><i class="q fx-br">${p[1]}</i></span></span><span class="fx-tgs">${tags}</span><span class="fx-rg">${grid}</span></button>`}).join(''):'';
  const xr=xc?[...xc.html.matchAll(/<button class="fh-row" ([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^<]*)<\/small>/g)].map(([,at,ic,t,sm])=>`<button class="ex-mrow" ${at}>${drop(ic)}<span class="g"><b>${t}</b><i class="q">${sm}</i></span><span class="v">›</span></button>`).join(''):'';
  const out=`${listTop(hero.html,actsOf(hero.html))}${fc?`<section class="mx-s ln">${KH('Keresés')}<div class="fx-pk2">${srch}${pickOf(fc.html)}</div></section>`:''}
    <section class="mx-s ln">${KH('A polcon')}<div class="ex-ml fx-roomy">${rows}</div></section>${xr?`<section class="mx-s ln">${KH('Okosabb csere')}<div class="ex-ml">${xr}</div></section>`:''}`;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${out}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}

/* ═══ RECEPTMŰHELY (2026-11-02): start — the sentence and the empty pot, the five goals as drop tiles, the text box, one
   wide "Küldés", the grey explanation and the "Így dolgozunk" card as one Mezo line. Draft — the sentence on top, the
   two-thirds pot beside the kcal, servings + 1 adag / Egész; the dead "Mentés" replaced by a live "Javítsuk a paprikát"
   that scrolls to the row and flashes it (owner); ingredients as cards with a source tag and their steppers, the
   unpriced row framed amber with its swap button; the warning as Mezo's line; the ask-for-changes box with the goal
   tiles. ═══ */
const goalTiles=h=>[...h.matchAll(/<button class="fh-pill ?(on)?\s*" data-go="([^"]+)">[\s\S]*?href="#([^"]+)"[\s\S]*?<\/span>([^<]*)<\/button>/g)]
  .map(([,on,go,ic,l])=>`<button class="ex-spt${on?' on':''}" data-go="${go}">${drop(ic)}<b>${l.replace('Lefekvés','Lefek&shy;vés')}</b></button>`).join('');
const cmpOf=h=>{const i=h.indexOf('<div class="fx-cmp">');return i<0?'':h.slice(i,bal(h,i))};
function muhely3(a){if(a&&a!=='vazlat'&&a!=='vazlat-egesz')return O.muhely(a);
  const base=O.muhely(a),cs=cardsOf(base),hero=cs[0];if(!hero)return base;const H=hero.html;
  if(!a){const pi=H.indexOf('<div class="fu-potc">'),pot=pi>=0?H.slice(pi,bal(H,pi)):'';
    const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="lbl">([^<]*)/)}</small><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2>
      <div class="fx-pot">${pot}</div><div class="ex-spg fx-gl">${goalTiles(H)}</div><div class="fx-cw">${cmpOf(H)}</div>
      ${mz('Válassz egy célt, vagy mondd el a saját szavaiddal. Én hozzávalót és mennyiséget javaslok, a számokat a kamrád adja. Minden kör javításként jön, a kézi módosításaid megmaradnak.')}
      <div class="ex-acts fx-wide">${pills(g(H,/(<button class="btn "[^>]*>[^<]*<\/button>)/))}</div></section>`;
    return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
  const pi=H.indexOf('<span class="fu-pot">'),pot=pi>=0?H.slice(pi,bal(H,pi,'span')):'',si=H.indexOf('<span class="fx-stp">'),stp=si>=0?H.slice(si,bal(H,si,'span')):'',gi=H.indexOf('<div class="fh-seg"'),seg=gi>=0?H.slice(gi,bal(H,gi)):'';
  const big=g(H,/<span class="fh-big">([^<]*)/),unit=g(H,/<span class="fh-big">[^<]*<small>([^<·]*)/).trim();
  const ic=cs.find(c=>/fx-it/.test(c.html)),ih=ic?ic.html:'';
  const items=[...ih.matchAll(/<div class="fh-row fx-it">[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^<]*)<\/small><\/span><span class="v">([^<]*)(?:<small>kcal<\/small>)?<\/span><div class="fx-l2">([\s\S]*?)(<span class="fx-stp">[\s\S]*?<\/span>)<\/div><\/div>/g)]
    .map(([,ic2,n,src,k,lk,st])=>({ic:ic2,n,src,k,st,swap:/kamrapick/.test(lk),miss:k==='—'}));
  const miss=items.find(x=>x.miss),mname=miss?miss.n.split(' · ')[0]:'',stem=mname.toLowerCase().replace(/a$/,'á').replace(/e$/,'é');
  
  const act=miss?`<button class="n9-btn" data-fxfix>Javítsuk a ${stem}t</button>`:pills('<button class="btn" data-toast="Recept mentve">Mentés a receptkönyvbe</button>');
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="lbl">([^<]*)/)}</small><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2>
    <div class="fx-pk">${pot}<span class="fx-kc"><b>${big}</b><small>${unit}</small></span></div><div class="fx-ctl">${stp}<div class="ex-seg">${seg}</div></div><div class="ex-acts fx-wide">${act}</div></section>`;
  const cards=items.map(x=>`<div class="fx-rr fx-mi${x.miss?' fx-miss':''}"><span class="fx-rh">${drop(x.ic)}<span class="g"><b>${x.n}</b><span class="fx-ir"><span class="fx-src ${x.src==='kamra'?'k':'b'}">${x.src==='kamra'?'kamrából':'nincs tápérték'}</span></span></span><span class="fx-ikv"><b>${x.k}</b>${x.miss?'':'<small>kcal</small>'}</span></span>
    <span class="fx-mf">${x.swap?`<button class="fx-swp" data-sheet="kamrapick">${I('t-swap')}Csere kamra-tételre</button>`:'<span></span>'}${x.st}</span></div>`).join('');
  const ingS=`<section class="mx-s ln">${KH(`Hozzávalók · ${items.length} tétel`)}<div class="ex-ml">${cards}</div>${miss?mz(`A ${stem}hoz nincs tápérték a kamrában, ezért a számokból kimarad, nem találgatom. Cseréld kamra-tételre, vagy töröld a sort.`):''}</section>`;
  const pc=cs.find(c=>/t-journal/.test(c.html)),prow=pc?[...pc.html.matchAll(/<button class="fh-row" ([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^<]*)<\/small>/g)].map(([,at,ic2,t,sm])=>`<button class="ex-mrow" ${at}>${drop(ic2)}<span class="g"><b>${t}</b><i class="q">${sm}</i></span><span class="v">›</span></button>`).join(''):'';
  const askC=cs[cs.length-1].html;
  const out=`${top}${ingS}<section class="mx-s ln">${KH('Elkészítés')}<div class="ex-ml">${prow}</div></section>
    <section class="mx-s ln">${KH('Kérj módosítást')}<div class="ex-spg fx-gl" style="margin-top:0">${goalTiles(askC)}</div><div class="fx-cw">${cmpOf(askC)}</div></section>`;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${out}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.muhely=muhely3;
/* the live fix button: scroll to the unpriced row and flash it (one delegated listener, like the carousel dots) */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-fxfix]');if(!b)return;const r=b.closest('.mx')&&b.closest('.mx').querySelector('.fx-miss');if(!r)return;
  r.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});r.classList.remove('flash');void r.offsetWidth;r.classList.add('flash')});

/* ═══ LOGOLÁS (2026-11-02): step 1 — the sentence on top, the day's bowl beside what still fits, the text box (now with
   the pantry button, which opens its drawer at once) and one wide "Elemzés"; the six modes as a 3×2 grid of drop tiles
   that swap only the panel below — no re-render, no jump (owner: the old page "reloaded" on every mode); "Recept" opens
   the recipe drawer straight away (owner); search stays on the page with the plate total under it (owner); every grey
   note is Mezo's line. Step 2 — the meal's sentence and bowl with its macros in full words, the day sum as Mezo's line,
   the items as cards (source tag, macro chips, stepper; the uncertain one framed amber), the time row. ═══ */
const MW3={'feh.':['fehérje','var(--protein)'],'szénh.':['szénhidrát','var(--carb)'],'zsír':['zsír','var(--fat)']};
/* any approved row → a drop card; a trailing add button / status / value is kept on the right */
const rowCards=h=>{let out='',i=0;const re=/<(div|button) class="fh-row( fx-it)?"/g;let m;while((m=re.exec(h))){const st=m.index,en=bal(h,st,m[1]);out+=h.slice(i,st);const r=h.slice(st,en);i=en;re.lastIndex=en;
    const at=(r.match(/^<\w+ class="[^"]*"([^>]*)>/)||['',''])[1],ic=g(r,/href="#(t-[^"]+)"/),t=g(r,/<strong>([^<]*)/),sm=g(r,/<\/strong><small>([^<]*)/),v=g(r,/<span class="v">(\d[^<]*)<small>([^<]*)/)?r.match(/<span class="v">(\d[^<]*)<small>([^<]*)/):null;
    const add=(r.match(/<button class="fx-add[\s\S]*?<\/button>/)||[''])[0],stt=(r.match(/<span class="st [^"]*">[^<]*<\/span>/)||[''])[0],tag=m[1]==='button'?'button':'div';
    out+=`<${tag} class="ex-mrow fx-lr"${at}>${drop(ic)}<span class="g"><b>${t}</b>${sm?`<i class="q">${sm}</i>`:''}</span>${v?`<span class="fx-ikv"><b>${v[1]}</b><small>${v[2]}</small></span>`:''}${stt}${add}${tag==='button'&&!add&&!v?'<span class="v">›</span>':''}</${tag}>`}
  return out+h.slice(i)};
const panelOf=h=>rowCards(h).replace(/<span class="fh-lab">([^<]*)<\/span>/g,'<p class="fx-lab">$1</p>').replace(/<p class="fh-note[^"]*">([\s\S]*?)<\/p>/g,(x,t)=>mz(t)).replace(/ g feh\./g,' g fehérje').replace(/ g szénh\./g,' g szénhidrát');
function log3(a){a=a||'foto';if(a==='tetelek'||a==='ido')return logItems3(a);
  const base=O.log(a),cs=cardsOf(base),hero=cs.find(c=>/fu-ng/.test(c.html));if(!hero)return base;const H=hero.html,warn=cs.find(c=>/fh-hero warn/.test(c.html.slice(0,60)));
  const gi=H.indexOf('<span class="gg">'),pic=gi>=0?H.slice(gi,bal(H,gi,'span')):'',big=g(H,/<span class="fh-big">([^<]*)/),unit=g(H,/<span class="fh-big">[^<]*<small>([^<]*)/);
  const ate=g(H,/<i class="a"><\/i>([^<]*)/),slot=g(H,/<i class="b"><\/i>([^<]*)/);
  const cmp=cmpOf(H);
  const win=/^w[0-3]$/.test(a),cur=win||a==='hiba'||a==='recept'||a==='kereses'||a==='kamra'?'foto':a;
  const warnS=warn?`<div class="fx-wrn">${drop('t-camera')}<span class="g"><b>${g(warn.html,/<p class="verdict"[^>]*>([^<]*)/)}</b><i class="q">${g(warn.html,/<p class="sub">([^<]*)/)}</i></span>${pills(g(warn.html,/(<button class="btn sm"[^>]*>[^<]*<\/button>)/))}</div>`:'';
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="lbl">([^<]*)/)}</small><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2>${warnS}
    <div class="fx-pk fx-lb">${pic}<span class="fx-kc"><b>${big}</b><small>${unit}</small></span></div><div class="fx-cw">${cmp}</div>
    ${mz(`${ate.replace(/^ma/,'Ma')}${slot&&!/^ide kerül/.test(slot)?', '+slot:''}. Szöveg, hang és fotó egy piszkozatba kerül, elemzés után a felismert tételeket még átírhatod.`)}
    <div class="ex-acts fx-wide">${pills(g(H,/(<button class="btn "[^>]*>[^<]*<\/button>)/))}</div></section>`;
  /* owner 2026-11-02: no Keresés tile — Recept then Kamra, both open their drawer at once */
  const MODES=LOGMODES;
  const tiles=MODES.map(([k,l,ic,sh])=>sh?`<button class="ex-spt" data-sheet="${sh}">${drop(ic)}<b>${l}</b></button>`:`<button class="ex-spt${k===cur?' on':''}" data-fxmode="${k}">${drop(ic)}<b>${l}</b></button>`).join('');
  const body=k=>{const h=O.log(k),i=h.indexOf('<div class="fx-mode">');return i<0?'':h.slice(i+21,bal(h,i)-6)};
  const panels=MODES.filter(m=>!m[3]).map(([k])=>`<div class="fx-pnl" data-fxpanel="${k}"${k===cur?'':' hidden'}>${panelOf(body(k))}</div>`).join('');
  const tc=cs.find(c=>/t-clock/.test(c.html)),tr=tc?g(tc.html,/<strong>([^<]*)/):'';
  const timeS=`<section class="mx-s ln">${KH('Mikor ettél?')}<div class="ex-ml"><div class="ex-mrow">${drop('t-clock')}<span class="g"><b>${tr}</b></span></div></div>${mz('Alapból a mostani időt írom. Mentés előtt átállíthatod; a tétel abba az ablakba kerül, amelyikbe az idő esik.')}</section>`;
  const out=`${DEFS}<div class="mx ex">${top}<section class="mx-s ln">${KH('Hat mód, egy koppintásra')}<div class="ex-spg fx-md">${tiles}</div><div class="fx-pns">${panels}</div></section>${timeS}<div class="ng-tail"></div></div>`;
  const tail=base.slice(cs[cs.length-1].end).replace(/<div class="fh-foot[\s\S]*?<\/div>(?=<nav)/,'');
  return base.slice(0,cs[0].start)+out+tail}
function logItems3(a){const base=O.log(a),cs=cardsOf(base),hero=cs[0],H=hero.html;
  const gi=H.indexOf('<span class="gg">'),pic=gi>=0?H.slice(gi,bal(H,gi,'span')):'',big=g(H,/<span class="fh-big">([^<]*)/),unit=g(H,/<span class="fh-big">[^<]*<small>([^<]*)/);
  const chips=[...H.matchAll(/<span class="fl-mini" style="--c:([^"]+)"><span class="t"><i style="height:([\d.]+)%"><\/i><\/span><b>([^<]*)<\/b><small>([^<]*)<\/small><\/span>/g)]
    .map(([,c,hh,v,l])=>`<span class="fx-mc" style="--c:${c}"><span class="t"><i style="height:${hh}%"></i></span><span class="tx"><b>${v}</b><small>${(MW3[l]||[l])[0]}</small></span></span>`).join('');
  const sum=g(H,/<p class="sub">([^<]*)/).match(/eddig ([\d ]+) \+ ([\d ]+) = ([\d ]+) kcal · a ([\d ]+)-ból marad ([\d ]+)/);
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="lbl">([^<]*)/)}</small><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2>
    <div class="fx-pk fx-lb">${pic}<span class="fx-kc"><b>${big}</b><small>${unit} · ez az étkezés</small></span></div><div class="fx-mg fx-lm">${chips}</div>
    ${sum?mz(`Ma eddig ${sum[1]} kcal-t ettél, ezzel ${sum[3]} lesz. A ${sum[4]}-ból még ${sum[5]} marad.`):''}</section>`;
  const ic=cs.find(c=>/fx-it/.test(c.html)),ih=ic?ic.html:'';
  const items=[...ih.matchAll(/<div class="fh-row fx-it">[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^ ·<]+) · (\d+) · (\d+) · (\d+) g[^<]*<\/small><\/span><span class="v">(\d+)<small>kcal<\/small><\/span><div class="fx-l2">([\s\S]*?)(<span class="fx-stp">[\s\S]*?<\/span>)<\/div><\/div>/g)]
    .map(([,ic2,n,src,p,c,f,k,l2,st])=>{const unsure=/st warn/.test(l2);
      return `<div class="fx-rr fx-mi${unsure?' fx-miss':''}"><span class="fx-rh">${drop(ic2)}<span class="g"><b>${n}</b><span class="fx-ir"><span class="fx-src ${src==='kamra'?'k':'b'}">${src==='kamra'?'kamrából':'becsült'}</span>${unsure?'<span class="fx-src b">nézd át</span>':''}</span></span><span class="fx-ikv"><b>${k}</b><small>kcal</small></span></span>
        <span class="fx-mx">${[[p,'fehérje','var(--protein)'],[c,'szénhidrát','var(--carb)'],[f,'zsír','var(--fat)']].map(([v,l,col])=>`<span style="--c:${col}"><i></i><b>${v} g</b> ${l}</span>`).join('')}</span>
        <span class="fx-mf"><span></span>${st}</span></div>`}).join('');
  const wn=g(ih,/<p class="fh-note fx-warn">([^<]*)/),ai=ih.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(ih.slice(ai+21,bal(ih,ai)-6).replace('data-go="log.kereses"','data-go="log"')):'';
  const itS=`<section class="mx-s ln">${KH(`Tételek · ${(ih.match(/fx-it/g)||[]).length}`)}<div class="ex-ml">${items}</div>${wn?mz(wn.replace('Az Erdei gyümölcs sorban','Az erdei gyümölcsben')):''}<div class="ex-acts">${acts}</div></section>`;
  const tc=cs[cs.length-1],th=tc.html,ti=th.indexOf('<span class="fh-lab">'),extra=ti>=0?th.slice(ti).replace(/<\/section>$/,''):'';
  const tS=`<section class="mx-s ln">${KH('Mikor ettél?')}<div class="ex-ml">${rowCards(th.replace(/^<section[^>]*>/,'').replace(extra,'').replace(/<\/section>$/,''))}</div>${extra?`<div class="fx-tx">${panelOf(extra)}</div>`:''}</section>`;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${itS}${tS}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.log=log3;
/* mode tiles: swap the panel in place, keep the scroll, keep the hash in step (owner: no reload on a mode) */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-fxmode]');if(!b)return;e.preventDefault();e.stopPropagation();const m=b.dataset.fxmode,ph=b.closest('#phone')||document;
  ph.querySelectorAll('[data-fxmode]').forEach(x=>x.classList.toggle('on',x===b));ph.querySelectorAll('[data-fxpanel]').forEach(x=>x.hidden=x.dataset.fxpanel!==m);
  try{ARG=m}catch(_){}history.replaceState(null,'',location.hash.replace(/(-log)(\.[^#]*)?$/,'$1.'+m))},true);

/* the tab pages' header, as on Nap and Edzés: no big title, the "?" top left */
const head=h=>typeof h==='string'?hubHead(h):h;
Object.keys(fu.routes).forEach(k=>{const f=fu.routes[k];if(typeof f==='function'&&!f.__hub){const w=(...a)=>head(f(...a));w.__hub=1;fu.routes[k]=w}});

/* review fixes (2026-11-03): words, not "kcal" (as Én says); the Mai page's yesterday is the day before everyone's
   today (Thursday, szeptember 24.), not the approved data's "kedd, október 6.". Text nodes only, never attributes. */
const inText=f=>h=>typeof h==='string'?h.replace(/>([^<]+)</g,(m,t)=>'>'+f(t)+'<'):h;
const kcal=inText(t=>t.replace(/KCAL-T/g,'KALÓRIÁT').replace(/kcal-t\b/g,'kalóriát').replace(/kcal-lal\b/g,'kalóriával').replace(/kcal-os\b/g,'kalóriás')
  .replace(/\bKCAL\b/g,'KALÓRIA').replace(/\bKcal\b/g,'Kalória').replace(/\bkcal\b/g,'kalória'));
/* the approved Fuel data lives in an October week whose today is Wednesday, október 7.: a date with its weekday moves
   back 13 days and takes the right weekday, so yesterday reads "szerda, szeptember 23." */
const DN=['vasárnap','hétfő','kedd','szerda','csütörtök','péntek','szombat'];
const shiftDay=inText(t=>t.replace(/(Vasárnap|Hétfő|Kedd|Szerda|Csütörtök|Péntek|Szombat|vasárnap|hétfő|kedd|szerda|csütörtök|péntek|szombat), (október|okt\.) (\d{1,2})\./g,(m,wd,mo,d)=>{
  const x=new Date(2026,9,+d-13),n=DN[x.getDay()],nd=/^[A-ZÁÉÍÓÖŐÚÜŰ]/.test(wd)?n[0].toUpperCase()+n.slice(1):n;
  return `${nd}, ${x.getMonth()===8?(mo==='okt.'?'szept.':'szeptember'):mo} ${x.getDate()}.`}));
Object.keys(fu.routes).forEach(k=>{const f=fu.routes[k];if(typeof f!=='function'||/-lista$/.test(k)||f.__kx)return;
  const w=k==='mai'?(...a)=>kcal(shiftDay(f(...a))):(...a)=>kcal(f(...a));w.__kx=1;w.__hub=f.__hub;fu.routes[k]=w});

F.css(`/* kiserlet-fuel */
${P} .fx-wk{margin:14px 14px 0}${P} .fx-wk .fu-wk{margin:0}${P} .fx-wk .fu-wd small{font-size:12px!important}${P} .fx-wk .fu-wd em{font-size:13px!important}
${P} .fx-stats{margin:0 18px}${P} .fx-stats .fh-grid{margin:0}
${P} .fx-lk,${P} .fx-long,${P} .fx-goal{margin:0 18px;padding:14px 12px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .fx-long .fu-lg{font-size:12.5px}${P} .fx-long .fh-lab{font-size:13px;font-weight:700;color:var(--ink)}

${P} .fx-caps{margin:16px 22px 0}${P} .fx-caps .fu-caps{margin:0}${P} .fx-caps .fu-caps i{width:24px;height:58px}${P} .fx-caps .fu-caps small{font-size:13px;font-weight:700;color:var(--ink)}@media (max-width:360px){${P} .fx-caps .fu-caps i{width:18px;height:50px}${P} .fx-caps .fu-caps .r{gap:4px}}
${P} .fx-sl{display:grid;gap:10px;margin:0 18px}${P} .fx-sr{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:22px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .fx-cp{flex:none;display:grid;place-items:center;width:44px;height:52px;background:none!important;border:0!important;box-shadow:none!important}${P} .fx-cp svg{display:none}
${P} .fx-cp i{display:block;width:22px;height:44px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dom) 45%,#fff)}${P} .fx-cp.on i{background:linear-gradient(180deg,var(--liq1),var(--liq2));box-shadow:none}
${P} .fx-sg{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-height:44px;justify-content:center}${P} .fx-sg b{font-size:15.5px;font-weight:750;color:var(--ink)}${P} .fx-sg small{font-size:13px;color:var(--ink);opacity:.8}
${P} .fx-chv{font-size:22px;color:var(--ink);opacity:.45}
${P} .fx-band summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-right:22px}${P} .fx-band summary::-webkit-details-marker{display:none}
${P} .fx-band summary .mx-h{flex:none}${P} .fx-bs{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}${P} .fx-bs em{font-style:normal;font-size:20px;transition:transform .2s}${P} .fx-band[open] .fx-bs em{transform:rotate(90deg)}
${P} .fx-mini{display:flex;gap:3px}${P} .fx-mini i{width:9px;height:20px;border-radius:999px;background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${P} .fx-band[open] .fx-sl{margin-top:4px}

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
${P} .fx-pot{display:flex;justify-content:center;margin:10px 0 0}${P} .fx-pot .fu-pot svg{width:150px!important}
${P} .fx-gl{grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:14px 14px 0}${P} .fx-gl .ex-spt{padding:10px 2px;border-radius:18px}${P} .fx-gl .ex-spt svg.ng{width:40px;height:40px}${P} .fx-gl .ex-spt b{font-size:12px;hyphens:manual}
${P} .ex-hero .ex-mz{margin-top:14px}${P} .fx-q2{grid-template-columns:repeat(2,minmax(0,1fr))}${P} .fx-q2 .ex-spt{padding:14px 8px}${P} .fx-q2 .ex-spt b{font-size:14.5px}
${P} .fx-rec{margin:0 18px;padding:16px 14px 6px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .fx-rec .fu-top{margin:0 0 6px;gap:12px}${P} .fx-rec .fu-top span{font-size:14px;color:var(--ink)}${P} .fx-rec .fu-top em{font-size:15px;color:color-mix(in srgb,var(--dom) 80%,var(--ink))}${P} .fx-rec .fl-level{--h:18px!important}
${P} .fx-all{background:none!important;box-shadow:none!important;border-top:1px solid rgba(10,42,60,.08);border-radius:0!important;padding:12px 2px!important;margin-top:6px}${P} .fx-all .v{font-size:22px;opacity:.5}${P} .fx-all .g b{font-size:14.5px;color:color-mix(in srgb,var(--dom) 80%,var(--ink))}
${P} .fx-pk{display:flex;align-items:center;justify-content:center;gap:18px;margin:12px 0 0}${P} .fx-pk .fu-pot svg{width:130px!important}${P} .fx-kc{display:flex;flex-direction:column}${P} .fx-kc b{font:800 44px/1 var(--disp,inherit);color:var(--ink)}${P} .fx-kc small{font-size:14px;font-weight:700;color:var(--ink)}
${P} .fx-sg2{margin:14px 18px 0}
${P} .fx-ing{align-items:center}${P} .fx-ir{display:flex;align-items:center;gap:8px;margin-top:2px}${P} .fx-ir em{font-style:normal;font-size:13.5px;font-weight:700;color:var(--ink)}
${P} .fx-src{padding:1px 8px;border-radius:999px;font-size:12px;font-weight:750}${P} .fx-src.k{background:color-mix(in srgb,var(--dom) 16%,#fff);color:#23704A}${P} .fx-src.b{background:#FCEFD9;color:#8A5513}
${P} .fx-sh{display:block;height:8px;margin-top:8px;border-radius:999px;background:rgba(10,42,60,.07);overflow:hidden}${P} .fx-sh i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--liq1),var(--liq2))}
${P} .fx-ikv{flex:none;display:flex;flex-direction:column;align-items:flex-end;margin-left:8px}${P} .fx-ikv b{font:800 18px/1.1 var(--disp,inherit);color:var(--ink)}${P} .fx-ikv small{font-size:12px;font-weight:700;color:var(--ink);opacity:.8}
${P} .fx-qual{margin:0 18px;padding:14px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .fx-sct{width:100%;box-shadow:none;background:color-mix(in srgb,var(--dom) 9%,#fff)}${P} .fx-sct .ic{width:44px;height:44px}${P} .fx-sct .ic>*{width:40px;height:40px}${P} .fx-sct .tx{flex:1}${P} .fx-sct .tx b{font-size:20px}${P} .fx-sct .v{font-size:22px;color:var(--ink);opacity:.45}
${P} .fx-qg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}${P} .fx-qt{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:16px;background:color-mix(in srgb,var(--dom) 7%,#fff)}
${P} .fx-qt small{font-size:12.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 60%,var(--ink))}${P} .fx-qt b{font:800 17px/1.15 var(--disp,inherit);color:var(--ink)}${P} .fx-qt.na b{font-size:14px;font-weight:700;opacity:.75}
${P} .fx-qt:last-child:nth-child(odd){grid-column:1/-1}${P} .fx-ikv{min-width:70px}${P} .fx-ir em{white-space:nowrap}@media (max-width:360px){${P} .fx-ing svg.ng{width:34px;height:34px}${P} .fx-ing{gap:8px;padding-left:10px;padding-right:12px}${P} .fx-ikv{min-width:58px}${P} .fx-qt small{hyphens:manual}}${P} .fx-qual+.ex-mz{margin-top:12px}${P} .fx-born{margin:10px 22px 0}${P} .fx-rm .k2-vial b{font-size:20px}
${P} .fx-jr{display:flex;align-items:center;justify-content:center;gap:22px;margin:14px 18px 0}
${P} .fx-bj{flex:none;display:flex;flex-direction:column;align-items:center}${P} .fx-bj .j{position:relative;display:flex;flex-direction:column-reverse;width:104px;height:150px;padding-top:18px;border-radius:18px 18px 26px 26px;background:#fff;overflow:hidden;box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--dom) 45%,#fff),0 14px 26px -18px rgba(10,42,60,.5)}
${P} .fx-bj .j::before{content:"";position:absolute;left:10px;right:10px;top:0;height:14px;border-radius:0 0 7px 7px;background:color-mix(in srgb,var(--dom) 55%,#fff)}
${P} .fx-bj .j i{display:block;flex:none;border-top:1.5px solid rgba(255,255,255,.7)}${P} .fx-bj .j i:first-child{border-top:0}
${P} .fx-bj.s .j{flex-direction:column;justify-content:flex-end;box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--water) 45%,#fff),0 14px 26px -18px rgba(10,42,60,.5)}${P} .fx-bj.s .j::before{background:color-mix(in srgb,var(--water) 55%,#fff)}${P} .fx-bj.s .j i{background:linear-gradient(180deg,color-mix(in srgb,var(--water) 60%,#fff),var(--water))}
${P} .fx-bs2{display:flex;flex-direction:column;gap:10px;min-width:0}${P} .fx-ly{display:flex;flex-direction:column;gap:5px}${P} .fx-ly span{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:700;color:var(--ink)}${P} .fx-ly i{flex:none;width:12px;height:12px;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(10,42,60,.12)}${P} .fx-ly b{margin-left:auto;padding-left:8px;font-weight:800}
@media (max-width:360px){${P} .fx-jr{gap:14px}${P} .fx-bj .j{width:88px;height:130px}${P} .fx-jr .fx-kc b{font-size:36px}}
${P} .fx-sub{margin-top:8px}${P} .fx-pk2{display:grid;gap:10px;margin:0 18px}${P} .fx-pk2 .fh-pills{margin:0}${P} .fx-pk2 .fx-srch{margin:0;background:#fff}
${P} .fx-rr{display:flex;flex-direction:column;gap:10px;width:100%;padding:12px 14px;border-radius:22px;background:#fff;text-align:left;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .fx-rh{display:flex;align-items:center;gap:10px}${P} .fx-rh svg.ng{width:46px;height:46px;margin:0;flex:none}${P} .fx-rh .g{flex:1;min-width:0;display:flex;flex-direction:column}${P} .fx-rh .g b{font-size:15.5px;font-weight:750;line-height:1.25;color:var(--ink)}${P} .fx-rh .g .q{font-style:normal;font-size:13px;color:var(--ink);opacity:.8}
${P} .fx-rh .ng-pipe,${P} .fx-rh .ng-flow{display:none}${P} .fx-star{width:16px;height:16px;margin-left:5px;vertical-align:-2px;color:#E0A21B}
${P} .fx-kr .fx-ikv small,${P} .fx-rh .fx-ikv small{white-space:nowrap}${P} .fx-kr.s .fx-ikv b{color:color-mix(in srgb,var(--water) 70%,var(--ink))}
@media (max-width:360px){${P} .fx-m3 .fx-mc{padding:6px}${P} .fx-m3 .fx-mc .t{display:none}${P} .fx-rh svg.ng{width:38px;height:38px}}
${P} .fx-roomy{gap:16px}${P} .fx-roomy .fx-kr{min-height:84px;padding:18px 18px 18px 14px;gap:14px}${P} .fx-roomy .fx-kr svg.ng{width:54px;height:54px}
${P} .fx-roomy .fx-kr .g b,${P} .fx-roomy .fx-rh .g b{font-size:16.5px;line-height:1.3}${P} .fx-roomy .fx-kr .g .q,${P} .fx-roomy .fx-rh .g .q{display:block;margin-top:4px;font-size:14px;line-height:1.35}
${P} .fx-roomy .fx-ikv{min-width:0}${P} .fx-roomy .fx-kr .fx-ikv small{text-align:right;line-height:1.25}${P} .fx-roomy .fx-ikv b{font-size:20px}${P} .fx-roomy .fx-ikv small{font-size:12.5px;margin-top:2px}
${P} .fx-roomy .fx-rr{gap:16px;padding:18px 18px 18px 14px;border-radius:24px}${P} .fx-roomy .fx-rh{gap:14px}${P} .fx-roomy .fx-rh svg.ng{width:54px;height:54px}

@media (max-width:360px){${P} .fx-roomy .fx-kr svg.ng,${P} .fx-roomy .fx-rh svg.ng{width:42px;height:42px}${P} .fx-roomy .fx-kr,${P} .fx-roomy .fx-rr{padding:16px 14px 16px 10px;gap:10px}${P} .fx-roomy .fx-m3{gap:6px}${P} .fx-roomy .fx-m3 .fx-mc{padding:8px}}
${P} .fx-tgs{display:flex;flex-wrap:wrap;gap:6px}${P} .fx-tg{display:inline-flex;align-items:center;gap:5px;padding:5px 10px 5px 7px;border-radius:999px;background:rgba(10,42,60,.05);font-size:13px;font-weight:700;color:var(--ink)}
${P} .fx-tg svg.ic{width:17px;height:17px;flex:none}${P} .fx-tg.m{background:color-mix(in srgb,var(--dom) 14%,#fff);color:#23704A}${P} .fx-tg.w{background:color-mix(in srgb,#E07A3F 13%,#fff);color:#A04A1E}
${P} .fx-rg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}${P} .fx-rg .fx-mc{padding:10px 12px;border-radius:16px;gap:10px}${P} .fx-rg .fx-mc .t{height:32px;width:10px}${P} .fx-rg .fx-mc .tx b{font-size:16px}${P} .fx-rg .fx-mc .tx small{font-size:12.5px;margin-top:2px}
${P} .fx-kt{display:flex;flex-direction:column;justify-content:center;padding:10px 14px;border-radius:16px;background:linear-gradient(135deg,color-mix(in srgb,var(--liq1) 30%,#fff),color-mix(in srgb,var(--liq2) 22%,#fff))}${P} .fx-kt b{font:800 22px/1.05 var(--disp,inherit);color:var(--ink)}${P} .fx-kt small{font-size:12.5px;font-weight:700;color:#23704A;margin-top:2px}
${P} .fx-roomy .fx-rr .fx-rh .g b{font-size:17.5px}
${P} .fx-br{font-size:14.5px!important;font-weight:700;opacity:1!important;margin-top:2px}${P} .fx-tg.s{background:color-mix(in srgb,var(--water) 14%,#fff);color:#2A62A8}${P} .fx-kt.s{background:linear-gradient(135deg,color-mix(in srgb,var(--water) 22%,#fff),color-mix(in srgb,var(--water) 12%,#fff))}${P} .fx-kt.s small{color:#2A62A8}
${P} .fx-kt.w{background:rgba(10,42,60,.05)}${P} .fx-kt.w svg.ic{width:20px;height:20px;margin-bottom:4px}${P} .fx-kt.w b{font-size:16px;line-height:1.2}${P} .fx-kt.w small{color:var(--ink);opacity:.75}
${P} .fx-cw{margin:14px 18px 0}${P} .fx-cw .fx-cmp{margin:0;background:#fff}${P} .fx-gl .ex-spt.on{box-shadow:inset 0 0 0 2px var(--dom),0 10px 22px -14px var(--dom)}${P} .fx-gl .ex-spt.on b{color:#23704A}
${P} .fx-ctl{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 18px 0}${P} .fx-ctl .ex-seg{margin:0;flex:1;max-width:190px}${P} .fx-ctl .fx-stp{background:#fff;border-radius:999px;padding:4px}
${P} .fx-mi .fx-ir{margin-top:4px}${P} .fx-mf{display:flex;align-items:center;justify-content:space-between;gap:10px}${P} .fx-mf .fx-stp{background:rgba(10,42,60,.05);border-radius:999px;padding:3px}
${P} .fx-swp{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:6px 12px;border-radius:999px;background:#FCEFD9;font-size:13.5px;font-weight:750;color:#8A5513}${P} .fx-swp svg.ic{width:18px;height:18px}
${P} .fx-miss{box-shadow:inset 0 0 0 2px #E7B25A,0 10px 24px -16px rgba(180,116,31,.5)}${P} .fx-miss .fx-ikv b{color:#B4741F}
${P} .fx-miss.flash{animation:fxFlash 1.2s ease-out 2}@keyframes fxFlash{0%{box-shadow:inset 0 0 0 2px #E7B25A,0 0 0 0 rgba(231,178,90,.7)}60%{box-shadow:inset 0 0 0 3px #E7B25A,0 0 0 12px rgba(231,178,90,0)}100%{box-shadow:inset 0 0 0 2px #E7B25A,0 0 0 0 rgba(231,178,90,0)}}
@media (prefers-reduced-motion:reduce){${P} .fx-miss.flash{animation:none;background:#FFF8EC}}
@media (max-width:360px){${P} .fx-swp{padding:6px 10px;font-size:12.5px}${P} .fx-ctl .ex-seg{max-width:150px}}
${P} .ex-mrow .ng-pipe,${P} .ex-mrow .ng-flow,${P} .fx-wrn .ng-pipe,${P} .fx-wrn .ng-flow,${P} .fx-rh .ng-pipe,${P} .fx-rh .ng-flow{display:none}${P} .fx-md{margin:0 18px}${P} .fx-md .ex-spt.on{box-shadow:inset 0 0 0 2px var(--dom),0 10px 22px -14px var(--dom)}${P} .fx-md .ex-spt.on b{color:#23704A}
${P} .fx-pns{margin:14px 18px 0}${P} .fx-pnl{display:grid;gap:10px}${P} .fx-pnl[hidden]{display:none}${P} .fx-pnl .fx-srch{margin:0;background:#fff}${P} .fx-pnl .ex-mz{margin:0}
${P} .fx-lab{margin:6px 2px 0;font-size:14px;font-weight:750;color:color-mix(in srgb,var(--dom) 70%,var(--ink))}${P} .fx-lr .fx-add{flex:none}${P} .fx-lr .st{flex:none;font-size:12.5px!important}
${P} .fx-pnl .fx-ph{background:#fff;margin:0}${P} .fx-pnl .fx-ph small{font-size:13px;color:var(--ink);opacity:.8}${P} .fx-pnl .fx-listen{background:#fff;border-radius:22px;padding:14px;margin:0}${P} .fx-pnl .fh-in{background:#fff}${P} .fx-pnl .fh-acts{margin:0}
${P} .fx-wrn{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 18px 0;padding:12px 14px;border-radius:22px;background:#FFF8EC;box-shadow:inset 0 0 0 2px #E7B25A}${P} .fx-wrn .g{flex:1;min-width:150px;display:flex;flex-direction:column}${P} .fx-wrn .g b{font-size:15px;color:#8A5513}${P} .fx-wrn .g .q{font-style:normal;font-size:13.5px;color:var(--ink)}${P} .fx-wrn svg.ng{width:42px;height:42px;margin:0}
${P} .fx-lb .gg svg{width:150px!important}${P} .fx-lm{grid-template-columns:repeat(3,minmax(0,1fr));margin:12px 18px 0}${P} .fx-lm .fx-mc{padding:8px 10px}
${P} .fx-mx{display:flex;flex-wrap:wrap;gap:6px 12px}${P} .fx-mx span{display:inline-flex;align-items:center;gap:5px;font-size:13.5px;color:var(--ink)}${P} .fx-mx i{width:9px;height:9px;border-radius:3px;background:var(--c)}${P} .fx-mx b{font-weight:800}
${P} .fx-tx{display:grid;gap:8px;margin:10px 18px 0}${P} .fx-tx .fx-lab{margin-top:0}${P} .fx-tx .fx-time{margin:0}
@media (max-width:360px){${P} .fx-lm .fx-mc .t{display:none}${P} .fx-lm .fx-mc{padding:8px}}/* review fixes (2026-11-03): no text under 12 px at 320 on Trendek, the meal and the score page (charts get room first, then the size) */
${P} .fx-dn small{font-size:12px}${P} .fx-lk svg.fl-link text{font-size:11px}${P} .fx-long svg.fh-chart text{font-size:14.5px}
${P} .fx-goal{margin:0 12px;padding:14px 6px}${P} .fx-goal svg.fh-chart text{font-size:15px}
${P} .fh-hero .lbl{font-size:12px}${P} .fh-row .v small,${P} .fx-it .fu-shn,${P} .fh-row .st{font-size:12px}${P} .b .nm small{font-size:12px}${P} .c .fl-level span,${P} .c .fl-level b{font-size:12px}
${P} .fx-ml .fm-mn{min-height:40px}${P} .fx-pk2 .fh-pills button{min-height:40px}
`);

window.FNOTES_FOLY=`<h2>Kísérlet · Fuel</h2><p><a href="#w-fuel-mai"><b>Mai</b></a> — felül a mondat és a tál, a makrók csövei a napi cél szaggatott vonalával, az étkezések időrendben egyforma kártyán (az ablakon kívüli a helyén, a következő kiemelve), a logolás módjai csempéken. Arcok: <a href="#w-fuel-mai.kihagyva">kihagyott étkezés</a> · <a href="#w-fuel-mai.kimelo">kímélő mód</a> (nincs kalóriacél, a pohár víz a kép, értékelés nélkül). Összevetésnek: <a href="#w-fuel-mai-lista">a mostani Mai</a>.</p><p><a href="#w-fuel-stack"><b>Kiegészítők</b></a> — a következő adag a mondatban, a nap kapszulái a kép, a kész napszak összecsukva (<a href="#w-fuel-stack-lista">régi</a>).</p><p><a href="#w-fuel-trendek"><b>Trendek</b></a> — a mondat felül, a hét csövei a kép, a csempék és a görbék maradtak, a szürke magyarázatok helyett Mezo (<a href="#w-fuel-trendek-lista">régi</a>).</p><p><a href="#w-fuel-konyha"><b>Konyha</b></a> — a mondat és az üres fazék felül, a célok egy sorban, a receptek és a kamra egy-egy belépő sor (<a href="#w-fuel-konyha-lista">régi</a>).</p><p><a href="#w-fuel-recept.r3"><b>Recept</b></a> — a mondat és a fazék a kalóriával felül, a makrók csövei, a hozzávalók színes forrás-címkével, a minőség csempéken Mezo pontszámával, minden receptnek saját Mezo-mondata. Másik arcok: <a href="#w-fuel-recept.r3.egesz">egész recept</a> · <a href="#w-fuel-recept.r1">egyadagos</a> · <a href="#w-fuel-recept.r6">még nincs pontszám</a> (<a href="#w-fuel-recept-lista.r3">régi</a>).</p><p><a href="#w-fuel-kamra.csirke"><b>Kamra-tétel</b></a> — a mondat felül, a kép a polc üvege nagyban: ételnél rétegekben telik azzal, ami 100 grammban van, kiegészítőnél kék az adaggal; minőség csempéken, a forrásnál Mezo kiszámolja a fehérje árát, a receptek csövekként. Másik arcok: <a href="#w-fuel-kamra.lazac">lazac</a> · <a href="#w-fuel-kamra.kreatin">kiegészítő</a> (<a href="#w-fuel-kamra-lista.csirke">régi</a>).</p><p><a href="#w-fuel-receptek"><b>Receptek</b></a> és <a href="#w-fuel-kamra"><b>Kamra</b></a> — a mondat és egy széles gomb felül, előnézet nélkül; egy sor egy recept a makróival, egy sor egy kamra-tétel (<a href="#w-fuel-receptek-lista">régi receptek</a> · <a href="#w-fuel-kamra-lista">régi kamra</a>).</p><p><a href="#w-fuel-muhely"><b>Receptműhely</b></a> — üres fazék a célokkal és a szövegmezővel; a <a href="#w-fuel-muhely.vazlat">vázlat</a> a fazékkal és a kalóriával, a hiányzó sorhoz élő „Javítsuk…” gomb visz (<a href="#w-fuel-muhely-lista">régi</a>).</p><p><a href="#w-fuel-log"><b>Logolás</b></a> — a mondat, a tál és a szövegmező felül; a hat mód csempéken (Fotó, Recept, Kamra, Gyors, Diktálás, Szokásosak), módváltáskor csak az alatta lévő rész cserélődik; a Recept és a Kamra azonnal felhozza a választó lapot. Tovább: <a href="#w-fuel-log.tetelek">tételek</a> · <a href="#w-fuel-log.hiba">nem ismertem fel</a> · <a href="#w-fuel-log.w0">ablakba</a> (<a href="#w-fuel-log-lista">régi</a>).</p>`+(window.FNOTES_FOLY||'');
})();
