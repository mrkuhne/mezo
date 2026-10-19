/* vilagos/kiserlet-edzes.js — EXPERIMENT (mezo-pi0jf), the Edzés domain in the system the Nap domain settled on
   (KISERLET.md "Hand-off (2026-10-19)"): one ground, thin straight dividers, the sentence on top and the page's own
   picture, cards with real buttons, one drawer skeleton, no numbered headings, no grey helper lines.
   NOT part of the build target: loaded only by ../kiserlet-napom-grafika.html after kiserlet-napom.js, whose styles
   (scoped to nap + edzes) and helpers (window.KXN) it reuses. The approved Edzés pages stay reachable as <route>-lista.
   The approved page keeps its state machine (plan / run / done, kímélő mód, kihagyás, könnyítés): every page here is
   rebuilt from the approved page's rendered markup, keeping its buttons and their data-ve / data-go actions, so a tap
   changes the same state and the page redraws through the same route. */
(function(){
const F=window.F,ed=window.FREG&&FREG.edzes,X=window.KXN;if(!ed||!X)return;
const {I,badge}=F,{V,KH,dots,DEFS,hubHead}=X;
const P='.phone.foly[data-s="elo"][data-d="edzes"]';
const O={mai:ed.routes.mai};
ed.routes['mai-lista']=O.mai;

/* the end of the balanced <div> / <section> that starts at i */
const bal=(h,i,tag='div')=>{const re=new RegExp(`<${tag}[\\s>]|</${tag}>`,'g');re.lastIndex=i;let d=0,m;
  while((m=re.exec(h))){d+=m[0][1]==='/'?-1:1;if(!d)return re.lastIndex}return h.length};
const g=(h,re,i=1)=>{const m=h.match(re);return m?m[i]:''};
/* the approved buttons in the new look: filled stays filled, links and ghosts become outline pills */
const pills=h=>h.replace(/class="btn sm ghost"/g,'class="n8-b"').replace(/class="btn sm"/g,'class="n9-btn"').replace(/class="btn"/g,'class="n9-btn"').replace(/class="fh-lk ?[^"]*"/g,'class="n8-b"');
const ico=h=>g(h,/href="#([^"]+)"/)||'t-dumbbell';
const drop=ic=>`<svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${V.icd({ic})}</svg>`;

/* ═══ MAI (2026-10-19): the sentence names the day and, if the morning check-in asks for it, says "lighter" right
   there (owner: "hozd fel a mondatba"); the body with today's muscles is the page's own picture; then the check-in's
   three tubes with Mezo's line, the other sessions as cards, the energy in one sentence, the muscles as tubes, and
   the quick starts as a carousel. The explanations moved into two drawers. ═══ */
function cardsOf(h){const out=[];let i=0;
  while((i=h.indexOf('<section class="fh-card',i))>=0){const e=bal(h,i,'section'),pre=h.lastIndexOf('<p class="fh-n',i),
    head=pre>=0&&pre>(out.length?out[out.length-1].end:0)?g(h.slice(pre,i),/<\/b>([^<]*)<\/p>/):'';
    out.push({html:h.slice(i,e),head,start:i,end:e});i=e}
  return out}
function hero3(c,ready){const h=c.html,lbl=g(h,/<span class="lbl">([^<]*)<\/span>/),sub=g(h,/<p class="sub">([\s\S]*?)<\/p>/).replace(/<[^>]+>/g,'');
  const time=g(lbl,/(\d\d:\d\d)/),fig=g(h,/<span class="vs-hb([^"]*)">([\s\S]*?)<small>([^<]*)<\/small><\/span>/,0);
  const body=g(fig,/(<span class="vs-body[\s\S]*<\/span>)<small>/),cap=g(fig,/<small>([^<]*)<\/small>/),off=/vs-hb [^"]*off/.test(fig);
  const facts=[...g(h,/<div class="vs-hf">([\s\S]*?)<\/div>/).matchAll(/<b>([^<]*)<\/b><small>([^<]*)<\/small>/g)].map(m=>[m[1],m[2]]);
  const ai=h.indexOf('<div class="fh-acts">'),acts=ai>=0?h.slice(ai+21,bal(h,ai)-6):'';
  const ci=h.indexOf('<div class="fh-chips">'),from=ci>=0?bal(h,ci):h.indexOf('</div>',h.indexOf('vs-hf'))+12,extra=h.slice(from,ai>=0?ai:h.length-10).trim();
  const st=sub.split(' · ')[0];
  const say=/^Folyamatban/.test(st)?'A Pull Day folyamatban.':/^Kész/.test(st)?'A Pull Day megvan.':/^Kímélő/.test(st)?'Ma pihensz, a Pull Day kimarad.'
    :/^Kihagyva/.test(st)?'A mai Pull Day kimarad.':ready==='ask'?'Ma Pull Day, de könnyebben javaslom.':ready==='done'?'Ma Pull Day, egy fokkal könnyebben.':`Ma Pull Day, ${time}-kor.`;
  return `<section class="mx-s ex-hero"><small class="ex-eb">${time} · Gym · ${sub}</small><h2 class="n7-h">${say}</h2>
    <div class="ex-fig ${off?'off':''}">${body}<small>${cap}</small></div>
    <div class="ex-facts">${facts.map(([b,s])=>`<span><b>${b}</b><small>${s}</small></span>`).join('')}</div>
    ${extra?`<div class="ex-x">${pills(extra)}</div>`:''}<div class="ex-acts">${pills(acts)}</div></section>`}
function ready3(c){const h=c.html;
  if(h.includes('Ma egy fokkal lejjebb')){const sub=g(h,/<p class="sub">([\s\S]*?)<\/p>/),ai=h.indexOf('<div class="fh-acts">');
    return `<section class="mx-s ln">${KH('A mai állapotod')}<div class="ex-mz">${badge('mezo',{s:30})}<p><b>Könnyítve.</b> ${sub}</p></div><div class="ex-acts">${pills(h.slice(ai+21,bal(h,ai)-6))}</div></section>`}
  const vi=h.indexOf('<div class="k2-vials'),tubes=vi>=0?h.slice(vi,bal(h,vi)):'';
  const care=[...h.matchAll(/<div class="vs-box">[\s\S]*?<b>([^<]*)<\/b><p>([\s\S]*?)<\/p><\/div><\/div>/g)].map(m=>`<p><b>${m[1]}:</b> ${m[2].charAt(0).toLowerCase()+m[2].slice(1)}</p>`).join('');
  const ai=h.indexOf('<div class="fh-acts">');
  return `<section class="mx-s ln ex-rd">${KH('A reggeli check-inből')}${tubes}
    ${care?`<div class="ex-mz">${badge('mezo',{s:30})}<div>${care}</div></div>`:''}<div class="ex-acts">${pills(h.slice(ai+21,bal(h,ai)-6))}</div></section>`}
/* the other sessions of the day: each step (+ its follow-up row) becomes a card with its own icon in a glass drop */
function sess3(c){const h=c.html,items=[];let i=0;
  while((i=h.indexOf('<div class="fh-step',i))>=0){const e=bal(h,i),s=h.slice(i,e);let tail='';
    const n=h.indexOf('<div class="vs-in',e);if(n>=0&&h.slice(e,n).trim()===''){const e2=bal(h,n);tail=h.slice(n,e2);i=e2}else i=e;
    items.push([s,tail])}
  return `<section class="mx-s ln">${KH(c.head||'Ma még')}<div class="ex-cards">${items.map(([s,tail])=>{
    const t=g(s,/<time>([^<]*)<\/time>/),ti=g(s,/<strong>([\s\S]*?)<\/strong>/),sm=g(s,/<small>([\s\S]*?)<\/small>/);
    const chip=g(sm,/<span class="st ([^"]*)">([^<]*)<\/span>/,2),facts=sm.replace(/<span class="st[\s\S]*?<\/span>/,'').replace(/^[^·]*· /,'').trim();
    const btns=[...tail.matchAll(/<button[\s\S]*?<\/button>/g)].map(m=>m[0]).join(''),said=tail.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<\/?div[^>]*>/g,'').replace(/<span class="fb[\s\S]*?<\/span>/g,'').trim();
    return `<article class="n8-c">${drop(ico(s))}<div><div class="n8-t"><b>${ti}</b><em>${t||chip}</em></div><p>${facts}</p>${said&&!/^<span>\s*<\/span>$/.test(said)?`<p class="ex-said">${said}</p>`:''}${btns?`<div class="qs-acts">${pills(btns)}</div>`:''}</div></article>`}).join('')}</div></section>`}
function kcal3(c){const h=c.html,earned=+g(h,/fh-big">\+(\d+)/)||0,pend=+g(h,/\+(\d+) kcal<\/b> még jön/)||0,bar=g(h,/(<span class="vs-split"[\s\S]*?<\/span>)/);
  const say=!earned?`<b>+${pend} kcal</b> kerül a keretedbe, ha megcsinálod.`:pend?`<b>+${earned} kcal</b> már bent van, <b>+${pend}</b> még jöhet.`:`<b>+${earned} kcal</b> került ma a keretedbe.`;
  return `<section class="mx-s ln">${KH('A mai keretedhez','',`<button class="fh-lk" data-exd="kcal:${earned}:${pend}">Részletek ›</button>`)}<p class="ex-say">${say}</p><div class="ex-bar">${bar}</div></section>`}
const IMP=[];
function imp3(c){const h=c.html;IMP.length=0;
  for(const m of h.matchAll(/<div class="fh-mus vs-mt"><span class="mchp sm" style="--c:([^"]+)">[\s\S]*?<span class="l">([^<]*)<small>([^<]*)<\/small><\/span><span class="v">([^<]*)<\/span>/g)){
    const [d,p]=(m[4].match(/(\d+) \/ (\d+)/)||[0,0,0]).slice(1).map(Number);IMP.push({c:m[1],l:m[2],w:m[3],d,p})}
  const mx=Math.max(1,...IMP.map(r=>r.p));
  return `<section class="mx-s ln">${KH(c.head||'Hatás az izomzatodra','',`<button class="fh-lk" data-exd="izom">Részletek ›</button>`)}
    <div class="ex-imp">${F.vials(IMP.map(r=>({l:r.l,s:r.w,v:r.p?`${r.d}/${r.p}`:r.w,p:r.p?Math.max(r.d,r.p)/mx*88:0,c:`color-mix(in srgb,${r.c} 74%,#0A2A3C)`,mark:'',on:{go:'terheles'}})),{h:118})}</div></section>`}
const MORE=[['t-dumbbell','Egyedi edzés','data-sheet="custom"'],['t-volley','Sport naplózása','data-go="sportlog"'],['c-i-retegek','Mezociklus','data-go="run"'],['c-i-sport','Sportjaid','data-go="sport"']];
const more3=()=>`<section class="mx-s ln">${KH('Vagy inkább')}<div class="cr sm">${MORE.map(([ic,t,a])=>`<button class="cr-c" ${a}><span class="mt-bub">${I(ic)}</span><b>${t}</b></button>`).join('')}</div>${dots(MORE.length-2)}</section>`;
function mai3(a){const base=O.mai(a);
  if(base.indexOf('<span class="lbl">Ma 07:30')<0||base.indexOf('vs-h2')<0)return base;/* rest day, other days, empty: next round */
  const cs=cardsOf(base);if(!cs.length)return base;
  const rc=cs.find(c=>/fh-hero warn|Ma egy fokkal lejjebb/.test(c.html)&&c!==cs[0]);
  const ready=!rc?'':rc.html.includes('Ma egy fokkal lejjebb')?'done':'ask';
  const parts=[hero3(cs[0],ready)];
  cs.slice(1).forEach(c=>{const h=c.html;
    parts.push(c===rc?ready3(c):h.includes('fh-step')?sess3(c):h.includes('fh-big')?kcal3(c):h.includes('fh-mus vs-mt')?imp3(c):h.includes('fh-pair')?more3()
      :`<section class="mx-s ln">${c.head?KH(c.head):''}<div class="ex-keep">${pills(h)}</div></section>`)});
  /* everything from the hero to the last card (the numbered headings between them included) is replaced */
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${parts.join('')}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
ed.routes.mai=mai3;

/* the drawers: the Nap skeleton (.dv) — the thing big, its number and chip, Mezo's text, one action */
const dvTop=(ic,l,b,u,chip)=>`<div class="dv-top">${drop(ic)}<div><small>${l}</small><b>${b}${u?`<u>${u}</u>`:''}</b>${chip?`<i class="w">${chip}</i>`:''}</div></div>`;
const dvMezo=t=>`<section class="dv-s"><div class="ng-who">${badge('mezo',{s:30})}<b>Mezo</b></div><p class="ng-pr">${t}</p></section>`;
document.addEventListener('click',e=>{const b=e.target.closest('[data-exd]');if(!b)return;const [k,x,y]=b.dataset.exd.split(':');
  if(k==='kcal'){const ea=+x,pe=+y;F.openSheet(`<div class="dv">${dvTop('t-flame','A mai keretedhez',`+${ea+pe}`,'kcal',pe?`ebből +${pe} még jön`:'mind bent van')}
    ${dvMezo(`Ennyit ad a mai mozgásod a napi keretedhez: a Pull Day kb. 460 kcal, a röplabda kb. 190. Ami megvolt, az már bent van, a többi akkor kerül be, ha megcsinálod. Ugyanez a szám áll a Fuel keretében. Becslés, nem mérés.`)}
    <button class="dv-btn pri" data-dom="fuel">Megnézem a Fuelben</button></div>`)}
  if(k==='izom'){const top=IMP[0]||{l:'Hát',w:'erős'};F.openSheet(`<div class="dv">${dvTop('t-muscle','Hatás az izomzatodra',top.l,'',top.w)}
    <div class="ex-imp dv-imp">${F.vials(IMP.map(r=>({l:r.l,s:r.w,v:`${r.d}/${r.p}`,p:r.p?Math.max(r.d,r.p)/Math.max(1,...IMP.map(q=>q.p))*88:0,c:`color-mix(in srgb,${r.c} 74%,#0A2A3C)`,mark:''})),{h:118})}</div>
    ${dvMezo(`A cső annyira telt, amennyit a mai terv kér az izomtól; a szám a kész és a tervezett szett. Itt a mai gym terved látod, a sportod terhelését külön, becsléssel számoljuk. Becslés, nem mérés.`)}
    <button class="dv-btn pri" data-go="terheles">A heti terhelésem</button></div>`)}});

/* the tab pages' header, as on Nap: no big title, the "?" top left */
/* Edzés marks its guide button "new" (class="fh-help new"), which the Nap matcher does not expect: drop the mark first */
const head=h=>typeof h==='string'?hubHead(h.replace('class="fh-help new"','class="fh-help"')):h;
Object.keys(ed.routes).forEach(k=>{const f=ed.routes[k];if(typeof f==='function'&&!f.__hub){const w=(...a)=>head(f(...a));w.__hub=1;ed.routes[k]=w}});

F.css(`/* kiserlet-edzes */
${P} .mx.ex{padding-top:4px}
${P} .ex-hero{padding-top:6px}
${P} .ex-eb{display:block;margin:6px 22px 0;font-size:13px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}
${P} .ex-hero .n7-h{margin:4px 22px 0;text-wrap:balance}
${P} .ex-fig{display:flex;flex-direction:column;align-items:center;margin:14px 0 0}
${P} .ex-fig .vs-body{display:block;width:140px}${P} .ex-fig .vs-body svg{width:100%;height:auto;display:block}
${P} .ex-fig.off .vs-body{opacity:.45;filter:grayscale(.6)}
${P} .ex-fig small{margin-top:6px;font-size:13px;color:var(--ink)}
${P} .ex-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:16px 22px 0}
${P} .ex-facts span{display:flex;flex-direction:column;align-items:flex-start;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.85);box-shadow:0 8px 20px -16px rgba(30,70,140,.4)}
${P} .ex-facts b{font:800 22px/1.1 var(--disp,inherit);letter-spacing:-.4px;color:var(--ink)}${P} .ex-facts small{font-size:13px;color:var(--ink)}
${P} .ex-x{margin:14px 22px 0}${P} .ex-x .vs-box{margin-top:0}
${P} .ex-acts{display:flex;flex-wrap:wrap;gap:8px;margin:16px 22px 0}
${P} .ex-acts .n9-btn,${P} .ex-acts .n8-b{margin:0;min-height:48px}${P} .ex-acts .n9-btn{flex:1;min-width:150px}
${P} .ex-rd .k2-vials{margin:6px 18px 0}
${P} .ex-mz{display:flex;gap:10px;align-items:flex-start;margin:16px 22px 0}${P} .ex-mz>.csepp,${P} .ex-mz>span{flex:none}
${P} .ex-mz p{margin:0;font-size:14.5px;line-height:1.5;color:var(--ink)}${P} .ex-mz p+p{margin-top:6px}
${P} .ex-cards{display:grid;gap:12px;margin:0 18px}${P} .ex-cards .n8-c{margin:0}
${P} .ex-said{font-size:13.5px}
${P} .ex-say{margin:0 22px;font-size:16px;line-height:1.5;color:var(--ink)}${P} .ex-say b{font-weight:800}
${P} .ex-bar{margin:12px 22px 0}${P} .ex-bar .vs-split{height:14px}
${P} .ex-imp{margin:0 18px}${P} .ex-imp .k2-vials{gap:8px}${P} .ex-imp .k2-vial{min-width:0}${P} .ex-imp .k2-tube{width:58px!important;margin:0 auto}${P} .dv-imp{margin:8px 0 4px}
${P} .ex-keep{margin:0 18px}
${P} .ds small{font-size:12px}${P} .ds i{font-size:12px}
${P} .mx-h .fh-lk{white-space:nowrap;flex:none}${P} .mx-h{gap:10px}
`);
window.FNOTES_FOLY=`<h2>Kísérlet · Edzés a Nap rendszerében</h2><p><a href="#w-edzes-mai"><b>Mai</b></a> — a mondat felül (benne a reggeli javaslat), a test a mai izmokkal, a reggeli három cső Mezo soraival, a többi alkalom kártyán, a keret egy mondatban, az izmok csövekben, a gyors indítások lapozva. Összevetésnek: <a href="#w-edzes-mai-lista">a mostani Mai</a>.</p>`+(window.FNOTES_FOLY||'');
})();
