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
const pills=h=>h.replace(/class="btn sm ghost"/g,'class="n8-b"').replace(/class="btn sm"/g,'class="n9-btn"').replace(/class="btn ?"/g,'class="n9-btn"').replace(/class="fh-lk ?[^"]*"/g,'class="n8-b"');
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
/* round 2 (owner, 2026-10-19: "kérek custom grafikát"): the energy is a flame-shaped vessel. Solid = already in the
   budget, the pale part with the dashed line = what comes if you do it. Beside it the sources, each with its share.
   The page only knows the two totals; the sources are the subset of the day's sessions (gym 460, röpi 190, extra
   310 — the approved page's numbers) that adds up to each total. */
const SRCK=[['t-dumbbell','Pull Day',460],['t-volley','Röplabda',190],['t-run','Reggeli mozgás',310]];
const sub=(n,pool)=>{for(let m=0;m<1<<pool.length;m++){const pk=pool.filter((_,i)=>m>>i&1);if(pk.reduce((q,x)=>q+x[2],0)===n)return pk}return []};
const FLAME='M52 4C58 22 86 38 86 74A34 34 0 0 1 18 74C18 56 28 46 34 36C37 50 44 56 50 58C45 40 46 20 52 4Z';
const flame=(e,p)=>{const id='exf'+(++FL),tot=e+p||1,top=18,bot=108,h=bot-top,ye=bot-h*e/tot,yp=top+22;
  const wv=y=>`M0 ${y}${' q8 -4 16 0 t16 0'.repeat(4)} V120 H0Z`;
  return `<svg class="ng ex-fl" viewBox="0 0 104 112" aria-hidden="true"><defs><clipPath id="${id}"><path d="${FLAME}"/></clipPath>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:#F6B44B"/><stop offset="1" style="stop-color:#E5845A"/></linearGradient></defs>
    <path class="ng-glass" d="${FLAME}"/><g clip-path="url(#${id})">${p?`<path d="${wv(yp)}" style="fill:color-mix(in srgb,#F6B44B 38%,#fff)"/>`:''}${e?`<path d="${wv(ye)}" fill="url(#${id}g)"/>`:''}</g>
    ${p?`<path d="M20 ${yp+1}H86" style="fill:none;stroke:#D08A2E;stroke-width:2;stroke-dasharray:4 4;stroke-linecap:round" clip-path="url(#${id})"/>`:''}
    <path class="ng-line" d="${FLAME}"/><path class="ng-hi" d="M30 66C29 76 33 86 40 92"/></svg>`};
let FL=0;
function kcal3(c){const h=c.html,earned=+g(h,/fh-big">\+(\d+)/)||0,pend=+g(h,/\+(\d+) kcal<\/b> még jön/)||0;
  const done=sub(earned,SRCK),todo=sub(pend,SRCK.filter(x=>!done.includes(x)).slice(0,2));
  const say=!earned?'kerül a keretedbe, ha megcsinálod':pend?`már bent van, +${pend} még jöhet`:'került ma a keretedbe';
  return `<section class="mx-s ln">${KH('A mai keretedhez','',`<button class="fh-lk" data-exd="kcal:${earned}:${pend}">Részletek ›</button>`)}
    <div class="ex-kc">${flame(earned,pend)}<div><p class="ex-kn"><b>+${earned||pend}</b> kcal</p><p class="ex-ks">${say}</p>
    <ul class="ex-src">${[...done.map(x=>[x,1]),...todo.map(x=>[x,0])].map(([[ic,l,v],d])=>`<li class="${d?'on':''}">${I(ic)}<span>${l}</span><b>+${v}</b></li>`).join('')}</ul></div></div></section>`}
const IMP=[];
function imp3(c){const h=c.html;IMP.length=0;
  for(const m of h.matchAll(/<div class="fh-mus vs-mt">(<span class="mchp sm" style="--c:([^"]+)">[\s\S]*?<\/svg><\/span>)<span class="l">([^<]*)<small>([^<]*)<\/small><\/span><span class="v">([^<]*)<\/span><span class="vs-split"[^>]*><i style="width:([\d.]+)%"><\/i><u style="left:[\d.]+%;width:([\d.]+)%"/g)){
    const [d,p]=(m[5].match(/(\d+) \/ (\d+)/)||[0,0,0]).slice(1).map(Number);IMP.push({chip:m[1].replace('mchp sm','mchp'),c:m[2],l:m[3],w:m[4],d,p,est:m[5]?null:(+m[6]+ +m[7])})}
  const mx=Math.max(1,...IMP.map(r=>r.p));
  return `<section class="mx-s ln">${KH(c.head||'Hatás az izomzatodra','',`<button class="fh-lk" data-exd="izom">Részletek ›</button>`)}
    <div class="ex-imp">${chips(F.vials(IMP.map(r=>({l:r.est!=null?r.w:r.l,s:r.est!=null?'':r.w,v:r.est!=null?r.l:r.p?`${r.d}/${r.p}`:r.w,p:r.est!=null?r.est*.88:r.p?Math.max(r.d,r.p)/mx*88:0,c:`color-mix(in srgb,${r.c} 74%,#0A2A3C)`,mark:'',on:{go:'terheles'}})),{h:118}))}</div></section>`}
/* the muscle-group drawing above each tube's number (owner, round 2: "izomcsoport grafika ikont") */
const chips=v=>{let i=0;return v.replace(/<span class="k2-tube"/g,m=>`<span class="ex-mc">${(IMP[i++]||{}).chip||''}</span>`+m)};
const MORE=[['t-dumbbell','Egyedi edzés','data-sheet="custom"'],['t-volley','Sport naplózása','data-go="sportlog"'],['c-i-retegek','Mezociklus','data-go="run"'],['c-i-sport','Sportjaid','data-go="sport"']];
/* MORE is the quick-start carousel on every Mai face */
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

/* ═══ MAI · rest day (2026-10-19): the week's seven tubes are the picture (today with the moon, done days full, the days
   ahead dashed); "+ Saját edzés" is an outline button — training is not today's job. Two variants: a custom workout in
   progress (sentence + Folytassuk, the week stays), and a sport day, which starts like a gym day: the body with what
   the sport works (owner: "legyen a test"), then the energy flame and the muscle tubes. ═══ */
/* the BodyMap silhouette as a vessel, as in edzes.js (bodyLiq): the shapes and colours are the shell's globals */
const bwv=(x,y,w,n=5,a=5)=>{const q=w/(2*n);let d=`M${x} ${y}`;for(let i=0;i<n;i++)d+=` q${q/2} ${-a} ${q} 0 q${q/2} ${a} ${q} 0`;return d};
let BU=0;
function body(v,ent){const by={};ent.forEach(([k,p=0,pl=0])=>(TOKEN_SHAPES[k]||[]).filter(([x])=>x===v).forEach(([,sh])=>{const o=by[sh]||(by[sh]={k,p:0,pl:0});o.p=Math.max(o.p,p);o.pl=Math.max(o.pl,pl)}));
  const id='exb'+(++BU),bb=(sh)=>window.box?window.box(v,sh):BODY[v].b[sh];
  const gg=Object.entries(by).map(([sh,o],i)=>{const [x,y,w,h]=bb(sh),c=muscleColor(o.k),Y=q=>y+h*(1-Math.max(0,Math.min(1,q))*.94);
    return `<clipPath id="${id}${i}">${BODY[v].p[sh].map(d=>`<path d="${d}"/>`).join('')}</clipPath>
      <g style="fill:color-mix(in srgb,${c} 16%,#fff);stroke:color-mix(in srgb,${c} 70%,#0A2A3C);stroke-width:3.5;stroke-linejoin:round"><use href="#bm-${v}-${sh}"/></g>
      <g clip-path="url(#${id}${i})">${o.pl>0?`<path style="fill:color-mix(in srgb,${c} 82%,#fff)" d="${bwv(x-6,Y(o.pl),w+12,4,7)} V${y+h+8} H${x-6}Z"/>`:''}${o.p>0?`<path style="fill:color-mix(in srgb,${c} 74%,#0A2A3C)" d="${bwv(x-6,Y(o.p),w+12,4,7)} V${y+h+8} H${x-6}Z"/>`:''}</g>`}).join('');
  return `<span class="vs-body"><svg viewBox="${BODY[v].vb}" aria-hidden="true"><g class="sil"><use href="#bm-sil-${v}"/></g>${gg}</svg></span>`}
const VOLLEY=[['shoulder-front',3],['quad',2],['core',1]];
const weekOf=h=>{const i=h.indexOf('<div class="k2-vials');return i<0?'':h.slice(i,bal(h,i)).replace(/height:96px/g,'height:132px')
  .replace(/(<button class="k2-vial vs-t\s+hatch\s+" data-toast="Csütörtök)/,m=>m.replace('hatch','hatch ex-today'))};
const weekCount=w=>{const all=(w.match(/class="k2-vial vs-t [^"]*"/g)||[]).filter(c=>!/hatch/.test(c)),done=all.filter(c=>!/ghost/.test(c)).length;return [done,all.length]};
function rest3(a){const base=O.mai(a),cs=cardsOf(base);if(!cs.length)return base;
  const hh=cs[0].html,lbl=g(hh,/<span class="lbl">([^<]*)<\/span>/),title=g(hh,/<p class="verdict"[^>]*>([^<]*)<\/p>/),sub=g(hh,/<p class="sub">([^<]*)<\/p>/);
  const ai=hh.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(hh.slice(ai+21,bal(hh,ai)-6)):'';
  let top;
  if(a==='pihen'){const w=weekOf(hh),[d,n]=weekCount(w);
    top=`<section class="mx-s ex-hero"><small class="ex-eb">Pihenőnap · ${d} edzés megvolt a ${n}-ből</small><h2 class="n7-h">Ma pihensz. A heted eddig jól megy.</h2>
      <div class="ex-wk">${w}</div><div class="ex-acts">${acts.replace('class="n9-btn"','class="n8-b"')}</div></section>`}
  else if(a==='pihen-sajat'){const w=weekOf(O.mai('pihen'));O.mai(a);/* the week comes from the plain rest-day page; render this face again to restore its state */
    top=`<section class="mx-s ex-hero"><small class="ex-eb">Pihenőnap · saját edzés</small><h2 class="n7-h">A ${title.toLowerCase()} folyamatban, ${g(sub,/(\d+ szett kész)/)}.</h2>
      <div class="ex-acts">${acts}</div></section><section class="mx-s ln">${KH('A heted')}<div class="ex-wk">${w}</div></section>`}
  else{const done=/Megvan/.test(sub),[,time,tag]=lbl.match(/(\d\d:\d\d) · (.+)$/)||[0,'',''],facts=sub.split(' · ').slice(1);
    const say=done?`A ${title.toLowerCase()} megvan.`:/Kihagyva|Kímélő/.test(sub)?`A mai ${title.toLowerCase()} kimarad.`:`Ma ${title.toLowerCase()}, ${time}-kor.`;
    const ex=hh.indexOf('<div class="vs-box"'),extra=ex>=0?hh.slice(ex,bal(hh,ex)):'';
    top=`<section class="mx-s ex-hero"><small class="ex-eb">${time} · ${tag} · ${sub.split(' · ')[0]}</small><h2 class="n7-h">${say}</h2>
      <div class="ex-fig">${body('front',VOLLEY.map(([k,n])=>[k,done?n/3:0,n/3]))}<small>${done?'ezt dolgoztatta meg':'ennyit kér ma a röpi'}</small></div>
      <p class="ex-fl1">${facts.join(' · ')}</p>
      ${extra?`<div class="ex-x">${pills(extra)}</div>`:''}<div class="ex-acts">${acts}</div></section>`}
  const rest=cs.slice(1).map(c=>{const h=c.html;return h.includes('fh-big')?kcal3(c):h.includes('fh-mus vs-mt')?imp3(c):h.includes('fh-row tap')||h.includes('fh-pair')?'':
    `<section class="mx-s ln">${c.head?KH(c.head):''}<div class="ex-keep">${pills(h)}</div></section>`}).join('');
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${rest}${more3()}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
ed.routes.mai=a=>['pihen','pihen-sajat','pihen-sport'].includes(a)?rest3(a):mai3(a);

/* the drawers: the Nap skeleton (.dv) — the thing big, its number and chip, Mezo's text, one action */
const dvTop=(ic,l,b,u,chip)=>`<div class="dv-top">${drop(ic)}<div><small>${l}</small><b>${b}${u?`<u>${u}</u>`:''}</b>${chip?`<i class="w">${chip}</i>`:''}</div></div>`;
const dvMezo=t=>`<section class="dv-s"><div class="ng-who">${badge('mezo',{s:30})}<b>Mezo</b></div><p class="ng-pr">${t}</p></section>`;
document.addEventListener('click',e=>{const b=e.target.closest('[data-exd]');if(!b)return;const [k,x,y]=b.dataset.exd.split(':');
  if(k==='kcal'){const ea=+x,pe=+y;F.openSheet(`<div class="dv">${dvTop('t-flame','A mai keretedhez',`+${ea+pe}`,'kcal',pe?`ebből +${pe} még jön`:'mind bent van')}
    ${dvMezo(`Ennyit ad a mai mozgásod a napi keretedhez: a Pull Day kb. 460 kcal, a röplabda kb. 190. Ami megvolt, az már bent van, a többi akkor kerül be, ha megcsinálod. Ugyanez a szám áll a Fuel keretében. Becslés, nem mérés.`)}
    <button class="dv-btn pri" data-dom="fuel">Megnézem a Fuelben</button></div>`)}
  if(k==='izom'){const top=IMP[0]||{l:'Hát',w:'erős'};F.openSheet(`<div class="dv">${dvTop('t-muscle','Hatás az izomzatodra',top.l,'',top.w)}
    <div class="ex-imp dv-imp">${chips(F.vials(IMP.map(r=>({l:r.est!=null?r.w:r.l,s:r.est!=null?'':r.w,v:r.est!=null?r.l:`${r.d}/${r.p}`,p:r.est!=null?r.est*.88:r.p?Math.max(r.d,r.p)/Math.max(1,...IMP.map(q=>q.p))*88:0,c:`color-mix(in srgb,${r.c} 74%,#0A2A3C)`,mark:''})),{h:118}))}</div>
    ${dvMezo(IMP.some(r=>r.est!=null)?`A cső a sport becsült terhelése izmonként: ennyit dolgoztat meg a mai röplabda. Nem mért adat, becslés.`:`A cső annyira telt, amennyit a mai terv kér az izomtól; a szám a kész és a tervezett szett. Itt a mai gym terved látod, a sportod terhelését külön, becsléssel számoljuk. Becslés, nem mérés.`)}
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
${P} .ex-fig .vs-body{display:block;width:100px}${P} .ex-fig .vs-body svg{width:100%;height:auto;display:block}
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
${P} .ex-kc{display:flex;align-items:center;gap:16px;margin:0 22px}${P} .ex-kc>div{flex:1;min-width:0}
${P} svg.ex-fl{flex:none;width:96px;height:104px;margin:0;filter:drop-shadow(0 12px 14px rgba(229,132,90,.22))}
${P} .ex-kn{margin:0;font-size:15px;font-weight:700;color:var(--ink)}${P} .ex-kn b{font:800 30px/1 var(--disp,inherit);letter-spacing:-.6px}
${P} .ex-ks{margin:4px 0 0;font-size:14px;line-height:1.4;color:var(--ink)}
${P} .ex-src{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}
${P} .ex-src li{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--ink)}${P} .ex-src li span{flex:1;min-width:0}
${P} .ex-src svg.ic{width:22px;height:22px;flex:none}${P} .ex-src li b{font-weight:800}${P} .ex-src li:not(.on) b{color:#B5772A}
${P} .ex-mc{display:flex;justify-content:center;margin:0 0 8px}${P} .ex-mc .mchp{width:44px;height:44px}${P} .ex-mc .mchp svg{width:100%;height:100%}
${P} .ex-imp{margin:0 18px}${P} .ex-imp .k2-vials{gap:8px}${P} .ex-imp .k2-vial{min-width:0}${P} .ex-imp .k2-tube{width:58px!important;margin:0 auto}${P} .dv-imp{margin:8px 0 4px}
${P} .ex-keep{margin:0 18px}
${P} .ex-fl1{margin:12px 22px 0;font-size:15px;font-weight:600;color:var(--ink);text-align:center}
${P} .ex-wk{margin:16px 14px 0}${P} .ex-wk .k2-vials{gap:5px!important}${P} .ex-wk .k2-vial{min-width:0}${P} .ex-wk .k2-vial small,${P} .ex-wk .k2-vial b{font-size:12px!important}
${P} .ex-wk .k2-tube em{font-size:12px!important}
${P} .ex-wk .ex-today .k2-tube{box-shadow:0 0 0 3px color-mix(in srgb,var(--dom) 45%,#fff),0 10px 18px -10px var(--dom)}${P} .ex-wk .ex-today b,${P} .ex-wk .ex-today small{color:color-mix(in srgb,var(--dom) 85%,var(--ink))}
${P} .ds small{font-size:12px}${P} .ds i{font-size:12px}
${P} .mx-h .fh-lk{white-space:nowrap;flex:none}${P} .mx-h{gap:10px}
`);
window.FNOTES_FOLY=`<h2>Kísérlet · Edzés a Nap rendszerében</h2><p><a href="#w-edzes-mai"><b>Mai</b></a> — a mondat felül (benne a reggeli javaslat), a test a mai izmokkal, a reggeli három cső Mezo soraival, a többi alkalom kártyán, a keret egy mondatban, az izmok csövekben, a gyors indítások lapozva. Pihenőnap: <a href="#w-edzes-mai.pihen">sima</a> · <a href="#w-edzes-mai.pihen-sajat">saját edzés folyamatban</a> · <a href="#w-edzes-mai.pihen-sport">sportnap</a>. Összevetésnek: <a href="#w-edzes-mai-lista">a mostani Mai</a>.</p>`+(window.FNOTES_FOLY||'');
})();
