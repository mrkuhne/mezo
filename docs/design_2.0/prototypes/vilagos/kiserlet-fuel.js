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
const O={mai:fu.routes.mai,stack:fu.routes.stack,trendek:fu.routes.trendek,konyha:fu.routes.konyha,recept:fu.routes.recept};fu.routes['recept-lista']=O.recept;fu.routes['trendek-lista']=O.trendek;fu.routes['konyha-lista']=O.konyha;
fu.routes['mai-lista']=O.mai;fu.routes['stack-lista']=O.stack;
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
    return sec(c,`<div class="fx-goal">${cut(inner(h),'<p class="fh-note">')}</div>${note?mz(note.replace('Ami még hátravan, az utolsó oszlop a cél vízvonaláig.','Ami még hátravan: az utolsó oszlop a cél vonaláig.')):''}`)}).join('');
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${out}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
fu.routes.trendek=trendek3;

/* ═══ KONYHA (2026-11-02): the sentence on top, the empty pot as the picture, the five goals as one row of drop tiles,
   the grey line as Mezo's, one wide button; quick add as two tiles without helper text; the recipes as tubes (the most
   eaten fullest, owner: tubes over a carousel); the pantry as a shelf of jars (food green, filled by protein per 100 g;
   supplements blue), Mezo naming the richest one. ═══ */
function konyha3(a){const base=O.konyha(a),cs=cardsOf(base);const hero=cs.find(c=>/fu-pot/.test(c.html));if(!hero)return base;
  const H=hero.html,pi=H.indexOf('<span class="fu-pot"'),pot=pi>=0?H.slice(pi,bal(H,pi,'span')):'',ai=H.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(H.slice(ai+21,bal(H,ai)-6)):'';
  const tile=(at,ic,l)=>`<button class="ex-spt" ${at}>${drop(ic)}<b>${l}</b></button>`;
  const goals=[...H.matchAll(/<button class="fh-pill[^"]*" data-go="([^"]+)">[\s\S]*?href="#([^"]+)"[\s\S]*?<\/span>([^<]*)<\/button>/g)].map(([,go,ic,l])=>tile(`data-go="${go}"`,ic,l.replace('Lefekvés','Lefek&shy;vés'))).join('');
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${g(H,/<span class="lbl">([^<]*)/)}</small><h2 class="n7-h">${g(H,/<p class="verdict"[^>]*>([^<]*)/)}</h2>
    <div class="fx-pot">${pot}</div><div class="ex-spg fx-gl">${goals}</div>${mz(g(H,/<p class="sub">([^<]*)/))}<div class="ex-acts fx-wide">${acts}</div></section>`;
  const qc=cs.find(c=>/fu-pair/.test(c.html)),qh=qc?qc.html:'';
  const quick=[...qh.matchAll(/<button (data-[^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<\/svg>(?:<\/span>)*([^<]*)<small>/g)].map(([,at,ic,l])=>tile(at,ic,l)).join('');
  const qS=`<section class="mx-s ln">${KH('Gyors felvétel')}<div class="ex-spg fx-q2">${quick}</div></section>`;
  const R=fu.routes.receptek(),ti=R.indexOf('<div class="fu-top"'),tubes=ti>=0?R.slice(ti,bal(R,ti)):'';
  const rc=cs.find(c=>/data-go="receptek"/.test(c.html)),rt=rc?g(rc.html,/<strong>([^<]*)<\/strong>/):'';
  const rS=`<section class="mx-s ln">${KH('Receptek')}<div class="fx-rec">${tubes}<button class="ex-mrow fx-all" data-go="receptek"><span class="g"><b>Mind a ${rt}</b></span><span class="v">›</span></button></div></section>`;
  const K=fu.routes.kamra();
  const jars=[...K.matchAll(/<button class="fh-stat" style="--c:var\(--(\w+)\)(?:;--p:([\d.]+)%)?" data-go="(kamra\.\w+)">[\s\S]*?<span class="k">([^<]*)<\/span>/g)]
    .map(([,c,p,go,n])=>({food:c==='protein',p:p?+p:78,go,n:n.split(' · ')[0].split('-')[0]}));
  const best=jars.filter(j=>j.food).sort((x,y)=>y.p-x.p)[0],nf=jars.filter(j=>j.food).length;
  const shelf=`<div class="fx-shelf">${jars.map(j=>`<button class="fx-jar ${j.food?'':'s'}" data-go="${j.go}"><span class="j"><i style="height:${Math.max(12,Math.min(92,j.p))}%"></i></span><small>${j.n.replace(/(Csirke|Zab|Mandula|Lazac)(?=\S)/,'$1&shy;')}</small></button>`).join('')}</div>`;
  const kS=`<section class="mx-s ln">${KH('Kamra')}<div class="fx-kam">${shelf}<p class="fx-kl"><span><i></i>${nf} étel</span><span class="s"><i></i>${jars.length-nf} kiegészítő</span></p><button class="ex-mrow fx-all" data-go="kamra"><span class="g"><b>A teljes polc · ${jars.length} tétel</b></span><span class="v">›</span></button></div>
    ${best?mz(`Az ételek üvegében a fehérje szintje áll, 100 grammonként. A ${best.n.toLowerCase()} áll a legmagasabban, abból főzünk a legtöbb fehérjét.`):''}</section>`;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${qS}${rS}${kS}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
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
  const macS=mac?`<section class="mx-s ln">${KH('Makrók · egy adagban'.replace(' · egy adagban',/egesz/.test(a||'')?' · az egész receptben':' · egy adagban'))}<div class="ex-imp fx-mac fx-rm">${mac.html.slice(mi,bal(mac.html,mi))}</div></section>`:'';
  const ingC=cs.find(c=>/fx-it/.test(c.html));
  const ings=ingC?[...ingC.html.matchAll(/<button class="fh-row fx-it" ([^>]*)>[\s\S]*?href="#([^"]+)"[\s\S]*?<strong>([^<]*)<\/strong><small>([^·<]*)· (\w+)[^<]*<\/small><\/span><span class="v">(\d+)<small>kcal<\/small><\/span>[\s\S]*?width:([\d.]+)%[\s\S]*?<small class="fu-shn">([^<]*)<\/small>/g)]
    .map(([,at,ic,n,amt,src,k,w,pc])=>`<button class="ex-mrow fx-ing" ${at}>${drop(ic)}<span class="g"><b>${n}</b><span class="fx-ir"><em>${amt.trim()}</em><span class="fx-src ${src==='kamra'?'k':'b'}">${src==='kamra'?'kamrából':'becsült'}</span></span><span class="fx-sh"><i style="width:${w}%"></i></span></span><span class="fx-kv"><b>${k}</b><small>kcal · ${pc}</small></span></button>`).join(''):'';
  /* the approved page reuses the lunch's ingredients for most recipes (a salmon recipe listing chicken); here each recipe
     gets its own, summing to its kcal: [name, icon, pantry id, source, kcal for the whole recipe, amount] */
  const RING={r3:[['Lazacfilé · norvég','t-meat','lazac','kamra',832,'400 g'],['Barna rizs','t-carb',null,'becslés',576,'160 g'],['Brokkoli','t-fiber',null,'becslés',102,'300 g'],['Olívaolaj · extra szűz','t-avocado',null,'becslés',126,'14 ml']],
    r6:[['Túró · félzsíros','t-protein','turo','kamra',221,'170 g'],['Áfonya · fagyasztott','t-fiber',null,'becslés',57,'100 g'],['Akácméz','t-sugar',null,'becslés',46,'15 g']],
    r5:[['Tojás · M-es','t-protein',null,'becslés',210,'3 db'],['Spenót · friss','t-fiber',null,'becslés',35,'150 g'],['Vaj','t-fat',null,'becslés',73,'10 g']]};
  const [rid,rmode]=(a||'r1').split('.'),dv=rmode==='egesz'?1:+(g(H,/(\d+) adagos/)||1),own=RING[rid];
  const ingRow=(at,ic,n,amt,src,k,w,pc)=>`<button class="ex-mrow fx-ing" ${at}>${drop(ic)}<span class="g"><b>${n}</b><span class="fx-ir"><em>${amt.trim()}</em><span class="fx-src ${src==='kamra'?'k':'b'}">${src==='kamra'?'kamrából':'becsült'}</span></span><span class="fx-sh"><i style="width:${w}%"></i></span></span><span class="fx-kv"><b>${k}</b><small>kcal · ${pc}</small></span></button>`;
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

/* the tab pages' header, as on Nap and Edzés: no big title, the "?" top left */
const head=h=>typeof h==='string'?hubHead(h):h;
Object.keys(fu.routes).forEach(k=>{const f=fu.routes[k];if(typeof f==='function'&&!f.__hub){const w=(...a)=>head(f(...a));w.__hub=1;fu.routes[k]=w}});

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
${P} .fx-rec,${P} .fx-kam{margin:0 18px;padding:16px 14px 6px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .fx-rec .fu-top{margin:0 0 6px;gap:12px}${P} .fx-rec .fu-top span{font-size:14px;color:var(--ink)}${P} .fx-rec .fu-top em{font-size:15px;color:color-mix(in srgb,var(--dom) 80%,var(--ink))}${P} .fx-rec .fl-level{--h:18px!important}
${P} .fx-all{background:none!important;box-shadow:none!important;border-top:1px solid rgba(10,42,60,.08);border-radius:0!important;padding:12px 2px!important;margin-top:6px}${P} .fx-all .v{font-size:22px;opacity:.5}${P} .fx-all .g b{font-size:14.5px;color:color-mix(in srgb,var(--dom) 80%,var(--ink))}
${P} .fx-shelf{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 6px;padding-bottom:12px;background:linear-gradient(transparent calc(50% - 4px),transparent calc(50% - 4px))}
${P} .fx-jar{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;position:relative;padding-bottom:8px}
${P} .fx-jar::after{content:"";position:absolute;left:-3px;right:-3px;top:62px;height:6px;border-radius:3px;background:rgba(10,42,60,.12)}
${P} .fx-jar .j{position:relative;width:40px;height:56px;border-radius:9px 9px 13px 13px;background:#fff;overflow:hidden;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dom) 45%,#fff)}
${P} .fx-jar .j::before{content:"";position:absolute;left:4px;right:4px;top:0;height:7px;border-radius:0 0 4px 4px;background:color-mix(in srgb,var(--dom) 55%,#fff);z-index:1}
${P} .fx-jar .j i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${P} .fx-jar.s .j{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--water) 45%,#fff)}${P} .fx-jar.s .j::before{background:color-mix(in srgb,var(--water) 55%,#fff)}${P} .fx-jar.s .j i{background:linear-gradient(180deg,color-mix(in srgb,var(--water) 60%,#fff),var(--water))}
${P} .fx-jar small{margin-top:6px;max-width:100%;font-size:12.5px;font-weight:700;line-height:1.2;color:var(--ink);text-align:center;hyphens:manual}
${P} .fx-kl{display:flex;gap:16px;margin:0 0 4px;font-size:13.5px;font-weight:700;color:var(--ink)}${P} .fx-kl i{display:inline-block;width:10px;height:14px;margin-right:6px;border-radius:3px;vertical-align:-2px;background:var(--dom)}${P} .fx-kl .s i{background:var(--water)}
${P} .fx-kam+.ex-mz{margin-top:12px}
${P} .fx-pk{display:flex;align-items:center;justify-content:center;gap:18px;margin:12px 0 0}${P} .fx-pk .fu-pot svg{width:130px!important}${P} .fx-kc{display:flex;flex-direction:column}${P} .fx-kc b{font:800 44px/1 var(--disp,inherit);color:var(--ink)}${P} .fx-kc small{font-size:14px;font-weight:700;color:var(--ink)}
${P} .fx-sg2{margin:14px 18px 0}
${P} .fx-ing{align-items:center}${P} .fx-ir{display:flex;align-items:center;gap:8px;margin-top:2px}${P} .fx-ir em{font-style:normal;font-size:13.5px;font-weight:700;color:var(--ink)}
${P} .fx-src{padding:1px 8px;border-radius:999px;font-size:12px;font-weight:750}${P} .fx-src.k{background:color-mix(in srgb,var(--dom) 16%,#fff);color:#23704A}${P} .fx-src.b{background:#FCEFD9;color:#8A5513}
${P} .fx-sh{display:block;height:8px;margin-top:8px;border-radius:999px;background:rgba(10,42,60,.07);overflow:hidden}${P} .fx-sh i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--liq1),var(--liq2))}
${P} .fx-kv{flex:none;display:flex;flex-direction:column;align-items:flex-end;margin-left:8px}${P} .fx-kv b{font:800 18px/1.1 var(--disp,inherit);color:var(--ink)}${P} .fx-kv small{font-size:12px;font-weight:700;color:var(--ink);opacity:.8}
${P} .fx-qual{margin:0 18px;padding:14px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .fx-sct{width:100%;box-shadow:none;background:color-mix(in srgb,var(--dom) 9%,#fff)}${P} .fx-sct .ic{width:44px;height:44px}${P} .fx-sct .ic>*{width:40px;height:40px}${P} .fx-sct .tx{flex:1}${P} .fx-sct .tx b{font-size:20px}${P} .fx-sct .v{font-size:22px;color:var(--ink);opacity:.45}
${P} .fx-qg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}${P} .fx-qt{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:16px;background:color-mix(in srgb,var(--dom) 7%,#fff)}
${P} .fx-qt small{font-size:12.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 60%,var(--ink))}${P} .fx-qt b{font:800 17px/1.15 var(--disp,inherit);color:var(--ink)}${P} .fx-qt.na b{font-size:14px;font-weight:700;opacity:.75}
${P} .fx-qt:last-child:nth-child(odd){grid-column:1/-1}${P} .fx-kv{min-width:70px}${P} .fx-ir em{white-space:nowrap}@media (max-width:360px){${P} .fx-ing svg.ng{width:34px;height:34px}${P} .fx-ing{gap:8px;padding-left:10px;padding-right:12px}${P} .fx-kv{min-width:58px}${P} .fx-qt small{hyphens:manual}}${P} .fx-qual+.ex-mz{margin-top:12px}${P} .fx-born{margin:10px 22px 0}${P} .fx-rm .k2-vial b{font-size:20px}
`);

window.FNOTES_FOLY=`<h2>Kísérlet · Fuel</h2><p><a href="#w-fuel-mai"><b>Mai</b></a> — felül a mondat és a tál, a makrók csövei a napi cél szaggatott vonalával, az étkezések időrendben egyforma kártyán (az ablakon kívüli a helyén, a következő kiemelve), a logolás módjai csempéken. Arcok: <a href="#w-fuel-mai.kihagyva">kihagyott étkezés</a> · <a href="#w-fuel-mai.kimelo">kímélő mód</a> (nincs kalóriacél, a pohár víz a kép, értékelés nélkül). Összevetésnek: <a href="#w-fuel-mai-lista">a mostani Mai</a>.</p><p><a href="#w-fuel-stack"><b>Kiegészítők</b></a> — a következő adag a mondatban, a nap kapszulái a kép, a kész napszak összecsukva (<a href="#w-fuel-stack-lista">régi</a>).</p><p><a href="#w-fuel-trendek"><b>Trendek</b></a> — a mondat felül, a hét csövei a kép, a csempék és a görbék maradtak, a szürke magyarázatok helyett Mezo (<a href="#w-fuel-trendek-lista">régi</a>).</p><p><a href="#w-fuel-konyha"><b>Konyha</b></a> — a mondat és az üres fazék felül, a célok egy sorban, a receptek csövekként (a legtöbbször evett a legtelibb), a kamra egy polc üvegekkel (<a href="#w-fuel-konyha-lista">régi</a>).</p><p><a href="#w-fuel-recept.r3"><b>Recept</b></a> — a mondat és a fazék a kalóriával felül, a makrók csövei, a hozzávalók színes forrás-címkével, a minőség csempéken Mezo pontszámával, minden receptnek saját Mezo-mondata. Másik arcok: <a href="#w-fuel-recept.r3.egesz">egész recept</a> · <a href="#w-fuel-recept.r1">egyadagos</a> · <a href="#w-fuel-recept.r6">még nincs pontszám</a> (<a href="#w-fuel-recept-lista.r3">régi</a>).</p>`+(window.FNOTES_FOLY||'');
})();
