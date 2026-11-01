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
const O={mai:ed.routes.mai,terv:ed.routes.terv,het:ed.routes.het,terheles:ed.routes.terheles,terkep:ed.routes.terkep,exercises:ed.routes.exercises,indulas:ed.routes.indulas,session:ed.routes.session,review:ed.routes.review,cer:ed.routes.cer,sport:ed.routes.sport,futas:ed.routes.futas};
ed.routes['sport-lista']=O.sport;ed.routes['futas-lista']=O.futas;
ed.routes['review-lista']=O.review;ed.routes['cer-lista']=O.cer;
ed.routes['session-lista']=O.session;
ed.routes['indulas-lista']=O.indulas;
ed.routes['exercises-lista']=O.exercises;
ed.routes['terkep-lista']=O.terkep;
ed.routes['mai-lista']=O.mai;ed.routes['terv-lista']=O.terv;ed.routes['terheles-lista']=O.terheles;

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
function hero3(c,ready,o={}){const h=c.html,lbl=g(h,/<span class="lbl">([^<]*)<\/span>/),sub=g(h,/<p class="sub">([\s\S]*?)<\/p>/).replace(/<[^>]+>/g,'');
  const time=g(lbl,/(\d\d:\d\d)/),fig=g(h,/<span class="vs-hb([^"]*)">([\s\S]*?)<small>([^<]*)<\/small><\/span>/,0);
  const body=g(fig,/(<span class="vs-body[\s\S]*<\/span>)<small>/),cap=g(fig,/<small>([^<]*)<\/small>/),off=/vs-hb [^"]*off/.test(fig);
  const facts=[...g(h,/<div class="vs-hf">([\s\S]*?)<\/div>/).matchAll(/<b>([^<]*)<\/b><small>([^<]*)<\/small>/g)].map(m=>[m[1],m[2]]);
  const ai=h.indexOf('<div class="fh-acts">'),acts=ai>=0?h.slice(ai+21,bal(h,ai)-6):'';
  const ci=h.indexOf('<div class="fh-chips">'),from=ci>=0?bal(h,ci):h.indexOf('</div>',h.indexOf('vs-hf'))+12,extra=h.slice(from,ai>=0?ai:h.length-10).trim();
  const st=sub.split(' · ')[0];
  const say=/^Folyamatban/.test(st)?'A Pull Day folyamatban.':/^Kész/.test(st)?'A Pull Day megvan.':/^Kímélő/.test(st)?'Ma pihensz, a Pull Day kimarad.'
    :/^Kihagyva/.test(st)?'A mai Pull Day kimarad.':ready==='ask'?'Ma Pull Day, de könnyebben javaslom.':ready==='done'?'Ma Pull Day, egy fokkal könnyebben.':`Ma Pull Day, ${time}-kor.`;
  return `<section class="mx-s ex-hero"><small class="ex-eb">${o.eb||`${time} · Gym · ${sub}`}</small><h2 class="n7-h">${o.say||say}</h2>
    <div class="ex-row"><div class="ex-fig ${off?'off':''}">${body}<small>${cap}</small></div>
    <div class="ex-facts">${facts.map(([b,s])=>`<span><b>${b}</b><small>${s}</small></span>`).join('')}</div></div>
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
    return `<article class="n8-c">${drop(ico(s))}<div><div class="n8-t"><b>${ti}</b><em>${t||chip}</em></div><p>${chip&&chip!=='Ma'?g(sm,/(<span class="st[^"]*">[^<]*<\/span>)/)+' ':''}${facts}</p>${said&&!/^<span>\s*<\/span>$/.test(said)?`<p class="ex-said">${said}</p>`:''}${btns?`<div class="qs-acts">${pills(btns)}</div>`:''}</div></article>`}).join('')}</div></section>`}
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
const weekOf=(h,day='Csütörtök')=>{const i=h.indexOf('<div class="k2-vials');return i<0?'':h.slice(i,bal(h,i)).replace(/height:96px/g,'height:132px')
  .replace(new RegExp(`(<button class="k2-vial vs-t\\s+hatch\\s+" data-toast="${day})`),m=>m.replace('hatch','hatch ex-today'))};
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
  else top=sportHero(hh,'Ma',acts);
  const rest=cs.slice(1).map(c=>{const h=c.html;return h.includes('fh-big')?kcal3(c):h.includes('fh-mus vs-mt')?imp3(c):h.includes('fh-row tap')||h.includes('fh-pair')?'':
    `<section class="mx-s ln">${c.head?KH(c.head):''}<div class="ex-keep">${pills(h)}</div></section>`}).join('');
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${rest}${more3()}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
/* a sport as the day's main thing: the body with what it works, its facts stacked beside it, the buttons below */
function sportHero(hh,on,acts){const lbl=g(hh,/<span class="lbl">([^<]*)<\/span>/),title=g(hh,/<p class="verdict"[^>]*>([^<]*)<\/p>/),sub=g(hh,/<p class="sub">([^<]*)<\/p>/);
  {const done=/Megvan/.test(sub),[,time,tag]=lbl.match(/(\d\d:\d\d) · (.+)$/)||[0,'',''],one=/egyszeri esemény/.test(sub),facts=sub.split(' · ').slice(1).filter(f=>f!=='egyszeri esemény'),st=sub.split(' · ')[0],t=title.toLowerCase();
    const say=on==='Ma'?(done?`A ${t} megvan.`:/Kihagyva|Kímélő/.test(sub)?`A mai ${t} kimarad.`:`Ma ${t}, ${time}-kor.`)
      :done?`${on} ${t} volt, megvan.`:/Elmaradt/.test(st)?`${on} ${t} elmaradt.`:`${on} ${t} jön, ${time}-kor.`;
    const ex=hh.indexOf('<div class="vs-box"'),extra=ex>=0?hh.slice(ex,bal(hh,ex)):'';
    return `<section class="mx-s ex-hero"><small class="ex-eb">${on==='Ma'?'':lbl.split(' · ')[0]+' · '}${time} · ${tag} · ${st}${one?' · egyszeri':''}</small><h2 class="n7-h">${say}</h2>
      <div class="ex-row"><div class="ex-fig">${body('front',VOLLEY.map(([k,n])=>[k,done?n/3:0,n/3]))}<small>${done?'ezt dolgoztatta meg':on==='Ma'?'ennyit kér ma a röpi':'ennyit kér aznap a röpi'}</small></div>
      <div class="ex-facts">${facts.map(f=>{const m=f.match(/^(\d+) (.+)$/);return `<span class="${m?'':'tx'}"><b>${m?m[1]:f}</b><small>${m?m[2]:''}</small></span>`}).join('')}</div></div>
      ${extra?`<div class="ex-x">${pills(extra)}</div>`:''}${acts?`<div class="ex-acts">${acts}</div>`:''}</section>`}}
/* ═══ MAI · the other days of the week (2026-10-19): the same page as today — the sentence says what was or will be
   on that day, the gym day's body with its facts, the day's other sessions as cards, the quick starts. The "you can
   still give a reason for the last 7 days" grey note goes: the missed card has its own "Kihagytam" button. A day with
   nothing planned shows the week's tubes with that day ringed. ═══ */
const ON={Hétfő:'Hétfőn',Kedd:'Kedden',Szerda:'Szerdán',Csütörtök:'Csütörtökön',Péntek:'Pénteken',Szombat:'Szombaton',Vasárnap:'Vasárnap'};
const DAYS3=['het','kedd','sze','pen','szo','vas'];
function day3(a){let wk='';if(/nincs tervezett edzés/.test(O.mai(a)))wk=O.mai('pihen');/* the week's tubes come from the rest-day page */
  const base=O.mai(a),cs=cardsOf(base);if(!cs.length)return base;
  const hh=cs[0].html,lbl=g(hh,/<span class="lbl">([^<]*)<\/span>/),dn=lbl.split(' · ')[0],on=ON[dn]||dn,title=g(hh,/<p class="verdict"[^>]*>([^<]*)<\/p>/).replace(' · ',' '),sub=g(hh,/<p class="sub">([^<]*)<\/p>/);
  const ai=hh.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(hh.slice(ai+21,bal(hh,ai)-6)):'';
  let top;
  if(hh.includes('vs-h2')){const time=g(lbl,/(\d\d:\d\d)/),st=sub.split(' · ')[0];
    top=hero3(cs[0],'',{eb:`${dn} · ${time} · Gym · ${st}`,say:/Megvan/.test(st)?`${on} ${title} volt, megvan.`:/Elmaradt/.test(st)?`${on} ${title} elmaradt.`:`${on} ${title} jön, ${time}-kor.`})}
  else if(/nincs tervezett edzés/.test(hh)){const w=weekOf(wk||'',g(lbl,/^(\S+)/));O.mai(a);
    top=`<section class="mx-s ex-hero"><small class="ex-eb">${lbl}</small><h2 class="n7-h">${on} pihenőnap, nincs tervezett edzés.</h2><div class="ex-wk">${w}</div></section>`}
  else top=sportHero(hh,on,acts);
  const rest=cs.slice(1).map(c=>{const h=c.html;return h.includes('fh-step')?sess3(c):h.includes('fh-big')?kcal3(c):h.includes('fh-mus vs-mt')?imp3(c)
    :h.includes('fh-row tap')||h.includes('fh-pair')||h.includes('utólag is megadhatod')?'':`<section class="mx-s ln">${c.head?KH(c.head):''}<div class="ex-keep">${pills(h)}</div></section>`}).join('');
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${rest}${more3()}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
ed.routes.mai=a=>['pihen','pihen-sajat','pihen-sport'].includes(a)?rest3(a):DAYS3.includes(a)?day3(a):mai3(a);

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

/* ═══ "Miért marad ki?" (2026-10-20): the drawer skeleton of Nap — the session big in its drop with "Kihagyva", the
   question, the eight reasons as a 2×4 grid of soft tiles, then (only when it matters) how long and Mezo's one line
   about what the reason means; "Kész" wide at the bottom. The grey "Nem kötelező…" lines go. The approved sheet keeps
   all its state (ST.sk, kímélő mód, the weekly pass); this rebuilds its markup and keeps every data-ve. ═══ */
const O_why=ed.sheets&&ed.sheets.why;
const SKI=t=>/Röp/.test(t)?'t-volley':/Pull|Push|Legs|Day|Felső|felső/.test(t)?'t-dumbbell':'t-run';
const blk=(h,cls)=>{const i=h.indexOf(`<div class="${cls}`);return i<0?['',-1,-1]:[h.slice(i,bal(h,i)),i,bal(h,i)]};
if(O_why)ed.sheets.why=(...a)=>{const h=O_why(...a),lbl=g(h,/<div class="vs-sh"><span>([^<]*)<\/span>/),name=lbl.replace(/^Kihagyva · /,'');
  const [opts,,oe]=blk(h,'vs-opts'),[bx,bi,be]=blk(h,'vs-box'),[ac,ai]=blk(h,'fh-acts');
  const mid=h.slice(oe,bi>=0?bi:ai).trim();
  const bt=g(bx,/<b>([^<]*)<\/b>/),bp=g(bx,/<\/b>([\s\S]*)<\/div><\/div>$/).replace(/<\/?p>/g,' ').trim(),bic=g(bx,/href="#([^"]+)"/);
  const note=bx&&bt!=='Nem kötelező'?`<div class="ex-mz ex-why-n">${badge('mezo',{s:30})}<p><b>${bt}</b> ${bp}</p></div>`:'';
  const btns=ac.replace(/^<div class="fh-acts">|<\/div>$/g,'').replace(/class="btn[^"]*"/,'class="dv-btn pri"').replace(/class="fh-lk[^"]*"/,'class="n8-b"');
  return `<div class="dv ex-why"><div class="dv-top">${drop(SKI(name))}<div><small>Kihagyva</small><b>${name}</b></div><button class="ex-x0" data-close aria-label="Bezárás">×</button></div>
    <h2 class="n7-h ex-why-q">Miért marad ki?</h2>${opts.replace('class="vs-opts"','class="vs-opts ex-opts"')}${mid?`<div class="ex-why-m">${mid}</div>`:''}${note}
    <div class="ex-why-a">${btns}</div></div>`};

/* ═══ TERV (2026-10-21): the six weeks' tubes are the page's picture (sentence on top, dates in one short line, "A terv
   oldala" as an outline button); the week's days are a carousel of equal cards (owner: "legyen lapozható"), each with
   its day, name, state and the small body of that day, today's card scrolled into view; the muscles are three tubes
   (where there is most room) with a link to the muscle page; the plans are two cards side by side. The other faces of
   Terv (first workout ahead, no plan, not running, loading) stay the approved page for now. ═══ */
const DAYID={Hétfő:'het',Kedd:'kedd',Szerda:'sze',Csütörtök:'csu',Péntek:'pen',Szombat:'szo',Vasárnap:'vas'};
const bodyOf=h=>{const i=h.indexOf('<span class="vs-body');return i<0?'':h.slice(i,bal(h,i,'span'))};
/* Terv · the empty faces (no plan yet / no plan running): the sentence, the empty plan as a drawn drop, the way on */
function tervEmpty(a){const base=O.terv(a),cs=cardsOf(base);if(!cs.length)return base;const hh=cs[0].html;
  const v=g(hh,/<p class="verdict"[^>]*>([^<]*)<\/p>/)||g(hh,/<div class="vs-ev">[\s\S]*?<p>([^—<]*)/).trim()+'.',sub=g(hh,/<p class="sub">([^<]*)<\/p>/),ic=g(g(hh,/<div class="vs-ev">([\s\S]*?)<\/div>/),/href="#([^"]+)"/)||'c-i-retegek';
  const ai=hh.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(hh.slice(ai+21,bal(hh,ai)-6)):'';
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex"><section class="mx-s ex-hero"><small class="ex-eb">Terv</small><h2 class="n7-h">${v}</h2>
    <div class="ex-empty">${drop(ic)}<p>${sub}</p></div><div class="ex-acts">${acts.replace('>Edzéstervek<','>Edzéstervek megnyitása<')}</div></section>${more3()}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
function terv3(a){if(a==='ures'||a==='nincs')return tervEmpty(a);if(a&&a!=='elso')return O.terv(a);const first=a==='elso';
  const bodies={};['het','kedd','sze','pen'].forEach(d=>bodies[d]=bodyOf(O.mai(d)));O.mai();
  const izh=O.het(first?'elso':undefined),base=O.terv(a),cs=cardsOf(base);if(!cs.length||base.indexOf('vs-dcs')<0)return base;
  const hh=cs[0].html,lbl=g(hh,/<span class="lbl">([^<]*)<\/span>/),sub=g(hh,/<p class="sub">([^<]*)<\/p>/);
  const vi=hh.indexOf('<div class="k2-vials'),tubes=vi>=0?hh.slice(vi,bal(hh,vi)).replace(/height:104px/g,'height:150px'):'';
  const dates=[...hh.matchAll(/<div class="vs-ft"><span>([^<]*)<\/span><span>[^<]*<\/span><span>([^<]*)<\/span>/g)][0]||[];
  const wk=g(hh,/A (\d+) hétből a (\d+)\./,2),of=g(hh,/A (\d+) hétből/),rest=g(sub,/— (.*)$/);
  const ai=hh.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(hh.slice(ai+21,bal(hh,ai)-6)).replace('class="n9-btn"','class="n8-b"'):'';
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${lbl.replace(' · ',` · ${wk}. hét a ${of}-ból · `)}</small><h2 class="n7-h">${first?'Az első edzésed előtt állsz. Így épül fel a 6 hét.':`A ${wk}. héten jársz, ${rest.replace(/\.$/,'')}.`}</h2>
    <p class="ex-dates">${dates[1]||''} – ${dates[2]||''} · ${first?'a terv íve, a szettszámok az első edzés után jönnek':'heti szettszám'}</p><div class="ex-wk ex-6">${tubes}</div><div class="ex-acts">${acts}</div></section>`;
  /* the week's days */
  const di=base.indexOf('<div class="vs-dcs'),dh=base.slice(di,bal(base,di));
  const days=[...dh.matchAll(/<(button|div) class="vs-dc ([^"]*)"([^>]*)>([\s\S]*?)<\/\1>(?=<button|<div class="vs-dc|$)/g)].map(m=>{const inner=m[4],cls=m[2],dn=g(inner,/<small>([^<]*)<\/small>/),nm=g(inner,/<strong>([^<]*)<\/strong>/);
    const st=g(inner,/(<span class="st [^"]*">[^<]*<\/span>)/),facts=g(inner,/<em>([^<]*)<\/em>/),go=g(m[3],/data-go="([^"]*)"/),id=DAYID[dn];
    const f3=[...inner.matchAll(/<i><b>([^<]*)<\/b><small>([^<]*)<\/small><\/i>/g)].map(x=>`${x[1]} ${x[2]}`).join(' · ');
    const pic=id==='csu'?bodyOf(inner):bodies[id]?bodies[id]:/röp/i.test(nm)?body('front',VOLLEY.map(([k,n])=>[k,0,n/3])):`<svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${V.icd({ic:'t-moon'})}</svg>`;
    return `<button class="ex-dc ${/now/.test(cls)?'now':''} ${/quiet/.test(cls)?'quiet':''}" ${go?`data-go="${go}"`:'data-toast="'+dn+' · '+nm+'"'}><small>${dn}</small><b>${nm.charAt(0).toUpperCase()+nm.slice(1)}</b>
      <span class="ex-dcp">${pic}</span><em>${facts||f3||'&nbsp;'}</em>${st||'<span class="st q">&nbsp;</span>'}</button>`}).join('');
  const nDays=(dh.match(/class="vs-dc /g)||[]).length;
  const week=`<section class="mx-s ln">${KH(cs.length?(g(base,/<b>1<\/b>([^<]*)<\/p>/)||'A heted'):'A heted')}<div class="ex-dcr">${days}</div>${dots(Math.max(1,nDays-2))}</section>`;
  /* the muscles: three with most room, from the muscle page */
  const rows=[...izh.matchAll(/<div class="fh-row tap " data-go="(izom\.[^"]+)">(<span class="mchp sm" style="--c:([^"]+)">[\s\S]*?<\/svg><\/span>)<span class="g"><strong>([^<]*)<span class="st [^"]*">([^<]*)<\/span><\/strong><small>([^<]*)<span[\s\S]*?<i style="width:([\d.]+)%"><\/i><u class="" style="left:([\d.]+)%"[\s\S]*?<span class="v">(\d+)/g)].slice(0,3);
  const chg=g(izh,/<strong>A következő heti váltás[^<]*<\/strong><small>([^<]*)<\/small>/).split(' · ').filter(x=>/\+/.test(x)&&!/^\+\d/.test(x)).join(' · ');
  const mus=`<section class="mx-s ln">${KH('Az izmaid','',`<button class="fh-lk" data-go="${first?'het.elso':'het'}">Részletek ›</button>`)}
    <p class="ex-say">${rows.length?`Ezekben van a legtöbb hely ezen a héten.${chg?` Hétfőtől: <b>${chg}</b>.`:''}`:'Az első edzésed után itt látod, melyik izmodban mennyi hely van még.'}</p>
    ${rows.length?'':'<!--'}<div class="ex-imp">${F.vials(rows.map(r=>({l:(m=>m?`még ${m[1]} szett fér bele`:'szinten tartod')(r[6].match(/Még (\d+) szett/)),v:`${r[4].trim()}`,s:'',p:+r[7]*.88,c:`color-mix(in srgb,${r[3]} 74%,#0A2A3C)`,mark:'',on:{go:r[1]}})),{h:118}).replace(/<span class="k2-tube"/g,(()=>{let i=0;return m=>`<span class="ex-mc">${((rows[i++]||[])[2]||'').replace('mchp sm','mchp')}</span>`+m})())}</div>${rows.length?'':'-->'}</section>`;
  const plans=`<section class="mx-s ln">${KH('Terveid')}<div class="ex-pl">${[['c-i-retegek','Edzéstervek','amiből indíthatsz','data-go="konyvtar"'],['t-flag','Terv lezárása','ha a 6 hét megvan','data-sheet="close"']].map(([ic,t,x,at])=>`<button class="ex-plc" ${at}><span class="mt-bub">${I(ic)}</span><b>${t}</b><small>${x}</small></button>`).join('')}</div></section>`;
  const end=base.indexOf('</div><nav class="fh-nav"')>=0?base.lastIndexOf('</section>',base.indexOf('<nav class="fh-nav"'))+10:cs[cs.length-1].end;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${week}${mus}${plans}<div class="ng-tail"></div></div>`+base.slice(end)}
ed.routes.terv=terv3;
/* today's day card scrolled into view after each render of Terv */
const O_after=ed.after;ed.after=(r,a)=>{O_after&&O_after(r,a);if(r==='terv'&&(!a||a==='elso'))requestAnimationFrame(()=>{const c=document.querySelector('#phone .ex-dcr'),n=c&&c.querySelector('.now');if(c&&n)c.scrollLeft=n.offsetLeft-18})};

/* ═══ TERHELÉS (2026-10-21): the Mai tank goes (a reused picture — rejected on Nap); the page's own picture is the body,
   front and back, large, filled with the week's work (owner chose: bodies on top, the three numbers in a row below);
   the muscle groups are five tubes with their drawings (tap = the approved group sheet); sport is a sentence and three
   estimated tubes; "Mozgás és terv" is a carousel. The three "how is it counted" links move behind "Részletek". ═══ */
/* ═══ the week's sport (owner, 2026-10-21: "nagyon basic és unalmas"): the five sessions on a week line — a full drop
   when done, a glass drop when ahead, a red one when missed — then the body the week's sport works (from the approved
   SPL table: Röpi = váll, láb, core; futás = láb, lábhajlító, vádli) and Mezo's line on how it counts. Numbers are the
   approved page's (Minden mozgásod: 90 perc naplózva, 610 kcal; 333 perc a heti rendben). ═══ */
const SW=[['Kedd','t-volley','Röpi',90,'done'],['Szerda','t-run','Sprint',15,'miss'],['Csütörtök','t-volley','Röpi',90,'today'],['Péntek','t-run','Piramis',18,'plan'],['Szombat','t-volley','Meccs',120,'plan']];
const SWST={done:['Megvolt','ok'],miss:['Elmaradt','bad'],today:['Ma','now'],plan:['Jön','q']};
const SPLW={'shoulder-front':3,'shoulder-side':2,quad:3,ham:3,calf:2,core:1};
const sportWeek=head=>{const done=SW.filter(x=>x[4]==='done').reduce((q,x)=>q+x[3],0),all=SW.reduce((q,x)=>q+x[3],0);
  return `<section class="mx-s ln">${KH(head,'',`<button class="fh-lk" data-go="mozgas">Részletek ›</button>`)}
    <p class="ex-say"><b>${done} perc</b> megvolt a heti ${all}-ból, a röpi <b>610 kcal</b>-t hozott.</p>
    <div class="ex-sw">${SW.map(([d,ic,n,m,st])=>`<button class="${st}" data-go="mai.${({Kedd:'kedd',Szerda:'sze',Csütörtök:'csu',Péntek:'pen',Szombat:'szo'})[d]}"><svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${st==='done'?V.drop({ic}):V.icd({ic})}</svg>
      <small>${d.slice(0,d==='Csütörtök'?3:d==='Szerda'?3:d==='Szombat'?3:1)}</small><b>${n}</b><em>${m} p</em><i class="${SWST[st][1]}">${SWST[st][0]}</i></button>`).join('')}</div>
    <div class="ex-swb">${body('front',Object.entries(SPLW).map(([k,n])=>[k,0,n/3]))}<ul>
      <li>${I('t-volley')}<span><b>Röpi</b> váll, láb, core</span></li><li>${I('t-run')}<span><b>Futás</b> láb, lábhajlító, vádli</span></li></ul></div>
    <div class="ex-mz">${badge('mezo',{s:30})}<p>A sport nem számít bele a szettekbe, de a pihenésednél figyelembe veszem.</p></div></section>`};
const andL=a=>a.length<=1?a[0]||'':`${a.slice(0,-1).join(', ')} és ${a[a.length-1]}`;
/* Terhelés faces (2026-10-21): the week still ahead and the week done use the same page with their own sentence;
   no plan yet is the empty face of Terv (sentence, drawn drop, the way on) */
function terhelesEmpty(a){const base=O.terheles(a),cs=cardsOf(base);if(!cs.length)return base;const hh=cs[0].html;
  const v=g(hh,/<p class="verdict"[^>]*>([^<]*)<\/p>/),sub=g(hh,/<p class="sub">([^<]*)<\/p>/),ic=g(g(hh,/<span class="fh-art">([\s\S]*?)<\/span>/),/href="#([^"]+)"/)||'t-dumbbell';
  const ai=hh.indexOf('<div class="fh-acts">'),acts=ai>=0?pills(hh.slice(ai+21,bal(hh,ai)-6)):'';
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex"><section class="mx-s ex-hero"><small class="ex-eb">Terhelés</small><h2 class="n7-h">${v}</h2>
    <div class="ex-empty">${drop(ic)}<p>${sub}</p></div><div class="ex-acts">${acts}</div></section>${more3()}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
function terheles3(a){if(a==='ures')return terhelesEmpty(a);if(a&&a!=='elotte'&&a!=='megvan')return O.terheles(a);
  const base=O.terheles(a),ti=base.indexOf('<section class="k2-tank');if(ti<0)return base;
  const tank=base.slice(ti,bal(base,ti,'section')),eb=g(tank,/<small>([^<]*)<\/small>/),done=+g(tank,/<b[^>]*>(\d+)<\/b>/),plan=+g(tank,/a (\d+)-ből/);
  const cs=cardsOf(base),find=k=>cs.find(c=>c.html.includes(k))||{html:''};
  const mapc=find('vs-mapc').html,di=mapc.indexOf('<span class="vs-duo'),duo=di>=0?mapc.slice(di,bal(mapc,di,'span')).replace('vs-duo sm','vs-duo'):'';
  const info=k=>`<button class="fh-lk" data-sheet="info" data-arg="${k}">Részletek ›</button>`;
  /* groups */
  const gh=find('data-sheet="grp"').html;
  const G=[...gh.matchAll(/data-sheet="grp" data-arg="([^"]+)">(<span class="mchp sm" style="--c:([^"]+)">[\s\S]*?<\/svg><\/span>)<span class="g"><strong>([^<]*)(<b[^>]*>· ([^<]*)<\/b>)?<\/strong><small>([^<]*)<span[\s\S]*?<i style="width:([\d.]+)%"><\/i>[\s\S]*?<span class="v">(\d+) \/ (\d+)/g)]
    .map(m=>({arg:m[1],chip:m[2].replace('mchp sm','mchp'),c:m[3],l:m[4].trim(),warn:m[6]||'',sub:m[7],w:+m[8],d:+m[9],p:+m[10]}));
  const art=w=>(/^[aáeéiíoóöőuúüű]/i.test(w)?'az ':'a ')+w,wait=G.filter(x=>!x.d).map(x=>art(x.l.toLowerCase()));
  const say=!done?'A hét még előtted van, eddig egy szett sem ment le.':done>=plan?`A hét munkáját letudtad, ${done} szett kész. Innen már a pihenés dolgozik.`:`Ezen a héten ${done} szett kész a ${plan}-ből${wait.length?`, ${andL(wait)} még munkára vár`:''}.`;
  const tubes=(list,h)=>{let i=0;return F.vials(list.map(x=>({l:x.l,v:x.v,s:x.s||'',p:x.p_,c:`color-mix(in srgb,${x.c} 74%,#0A2A3C)`,mark:x.mark||'',on:x.on})),{h}).replace(/<span class="k2-tube"/g,m=>`<span class="ex-mc">${(list[i++]||{}).chip||''}</span>`+m)};
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${eb}</small><h2 class="n7-h">${say}</h2>
    <div class="ex-duo">${duo}</div><div class="ex-facts ex-f3"><span><b>${done}</b><small>szett kész</small></span><span><b>${plan}</b><small>a heti terv</small></span><span><b>${wait.length}</b><small>${wait.length===G.length&&!done?'csoport mind vár':'csoport vár'}</small></span></div>
    <div class="ex-acts"><button class="n8-b" data-go="terkep">A tested térképe</button><button class="n8-b" data-sheet="info" data-arg="szam">Hogyan számolunk?</button></div></section>`;
  G.forEach(x=>GRP[x.arg]=x);
  const grp=`<section class="mx-s ln">${KH('Izomcsoportok ezen a héten','',info('sav'))}<div class="ex-imp ex-g5">${tubes(G.map(x=>({...x,v:`${x.d}/${x.p}`,p_:x.w*.9,mark:x.warn||(lagging(parts(x.arg),x).length?'figyelj':''),on:{toast:x.l}})),112)
    .replace(/<button class="k2-vial"[^>]*?data-toast="([^"]*)"/g,(m,l)=>m.replace(`data-toast="${l}"`,`data-exg="${(G.find(x=>x.l===l)||{}).arg}"`))}</div></section>`;
  /* sport */
  const sh=find('fh-big').html,min=g(sh,/fh-big">(\d+)/),works=g(sh,/Ezeket is dolgoztatja: ([^<]*)\./);
  const S=[...sh.matchAll(/(<span class="mchp sm" style="--c:([^"]+)">[\s\S]*?<\/svg><\/span>)<span class="g"><strong>([^<]*)<\/strong><\/span><span class="vs-dr"[^>]*aria-label="(\d) \/ 3"/g)].map(m=>({chip:m[1].replace('mchp sm','mchp'),c:m[2],l:m[3],n:+m[4]}));
  const sport=sh?sportWeek('Sport a héten'):'';
  /* moves and plan */
  const mh=find('data-go="mozgas"').html,medal=g(mh,/<strong>(\d+ medál[^<]*)<\/strong>/);
  const MV=[['t-flame','Minden mozgásod','data-go="mozgas"'],['c-i-retegek','Mezociklus','data-go="run"'],['t-record',medal||'Medálok','data-go="medals"'],['t-dumbbell','Saját edzés','data-sheet="custom"']];
  const moves=`<section class="mx-s ln">${KH('Mozgás és terv')}<div class="cr sm">${MV.map(([ic,t,at])=>`<button class="cr-c" ${at}><span class="mt-bub">${I(ic)}</span><b>${t}</b></button>`).join('')}</div>${dots(MV.length-2)}</section>`;
  const end=cs.length?cs[cs.length-1].end:bal(base,ti,'section');
  return base.slice(0,ti)+`${DEFS}<div class="mx ex">${top}${grp}${sport}${moves}<div class="ng-tail"></div></div>`+base.slice(end)}
ed.routes.terheles=terheles3;
/* round 2 (owner, 2026-10-21: "bontsuk le részekre"): a group's parts in the drawer. The approved group sheet lists the
   parts and their planned weekly sets; the page knows only the group's done sets, so the prototype fills the parts in
   the order the sheet lists them (the first part's sets are done first). A part well behind the group is "lemaradt",
   and the group tube carries "figyelj" when one of its parts is. Where the drawing shares one shape (the three biceps
   heads), the body shows them together. */
const GRP={};
function parts(arg){const sh=ed.sheets.grp(arg),g0=GRP[arg]||{d:0,p:1};let left=g0.d;
  return [...sh.matchAll(/<strong>([^<]*)<\/strong><small>(\d+) szett/g)].map(m=>{const l=m[1].trim(),pl=+m[2],mu=MUSCLES.find(x=>x.label===l),d=Math.min(pl,left);left-=d;
    return {l,short:(l.match(/\(([^)]*)\)/)||[0,l])[1],k:mu?mu.key:arg,p:pl,d}})}
/* every part of the group, the planned ones from the sheet, the rest "nincs a tervben" (round 3, owner: "hogy néz ki
   ha van biceps és triceps is"); the arm splits into Bicepsz and Tricepsz rows */
const FAM={biceps:'Bicepsz',triceps:'Tricepsz'};
function allParts(arg){const ps=parts(arg),reg=(MUSCLES.find(m=>m.key===(ps[0]||{}).k)||MUSCLES.find(m=>m.key===arg)||{}).region;
  return MUSCLES.filter(m=>m.region===reg).map(m=>{const x=ps.find(q=>q.k===m.key)||{l:m.label,k:m.key,p:0,d:0};
    return {...x,fam:FAM[m.key.split('-')[0]]||'',short:m.key==='biceps-brachialis'?'brachialis':(m.label.match(/\(([^)]*)\)/)||[0,m.label])[1].replace(' fej','')}})}
const lagging=(ps,g0)=>g0.d/g0.p<.4?[]:ps.filter(x=>x.p&&!x.d);/* only a part with nothing done, while its group is well under way */
document.addEventListener('click',e=>{const b=e.target.closest('[data-exg]');if(!b)return;const arg=b.dataset.exg,g0=GRP[arg];if(!g0)return;
  const ps=allParts(arg),lag=lagging(ps,g0),mx=Math.max(1,...ps.map(x=>x.p));
  const views=['front','back'].filter(v=>ps.some(x=>(TOKEN_SHAPES[x.k]||[]).some(([w])=>w===v)));
  const fig=views.map(v=>body(v,ps.map(x=>[x.k,x.d/Math.max(1,x.p),1]))).join('');
  const fams=[...new Set(ps.map(x=>x.fam))];
  const vi=list=>F.vials(list.map(x=>({l:x.short,v:x.p?`${x.d}/${x.p}`:'–',p:x.p?x.p/mx*88*(x.d?Math.max(.25,x.d/x.p):.06):0,c:`color-mix(in srgb,${g0.c} 74%,#0A2A3C)`,s:lag.includes(x)?'<u class="lag">lemaradt</u>':x.p?'':'nincs a tervben',mark:''})),{h:fams.length>1?84:110});
  const tb=fams.length>1?fams.map(f=>`<div class="ex-fam"><b>${f}</b>${vi(ps.filter(x=>x.fam===f))}</div>`).join(''):vi(ps);
  const say=lag.length?`${andL(lag.map(x=>x.l.toLowerCase().replace(/^(\S+) \((.*)\)$/,'$2 $1').replace('első váll','elülső váll')))} a héten még alig kapott munkát. Ha teheted, a következő edzésen kezdd azzal.`
    :`A ${g0.l.toLowerCase()} minden része nagyjából egyformán halad a héten.`;
  const say1=say.charAt(0).toUpperCase()+say.slice(1);
  F.openSheet(`<div class="dv ex-grp"><div class="dv-top"><span class="ex-gc">${g0.chip}</span><div><small>${g0.l} · ezen a héten</small><b>${g0.d}<u> / ${g0.p} szett</u></b>${g0.warn?`<i class="w">${g0.warn}</i>`:''}</div></div>
    <div class="ex-gfig">${fig}</div><div class="ex-imp ex-gp">${tb}</div>${dvMezo(say1)}
    <button class="dv-btn pri" data-sheet="grp" data-arg="${arg}">Gyakorlatok és tervezett szettek</button></div>`)});

/* ═══ IZOMTÉRKÉP (2026-10-21): the two bodies are the page, larger, with no card; tapping a muscle on the body opens the
   group's parts drawer (owner: "legyen mindkettő") and so do five big group buttons under the bodies (small muscles
   are hard to hit on the drawing). The waiting group is a card, sport one line with Mezo, the 21 muscles one card.
   "Miből rajzoljuk?" moves behind the title's "?". ═══ */
const artL=w=>(/^[aáeéiíoóöőuúüű]/i.test(w)?'az ':'a ')+w;
const regionOf3=k=>(MUSCLES.find(m=>m.key===k)||{}).region;
const grpByRegion=r=>Object.keys(GRP).find(a=>regionOf3(a)===r);
function terkep3(a){if(a&&a!=='terv')return O.terkep(a);
  if(!Object.keys(GRP).length)terheles3();/* the group numbers live on the Terhelés page */
  const base=O.terkep(a).replace('data-toast="Kalauz ehhez az oldalhoz"','data-sheet="info" data-arg="terkep"'),cs=cardsOf(base);if(!cs.length)return base;
  const hh=cs[0].html,lbl=g(hh,/<span class="lbl">([^<]*)<\/span>/),v=g(hh,/<p class="verdict"[^>]*>([^<]*)<\/p>/);
  const si=hh.indexOf('<div class="fh-seg"'),seg=si>=0?hh.slice(si,bal(hh,si)):'',di=hh.indexOf('<span class="vs-duo'),duo=di>=0?hh.slice(di,bal(hh,di,'span')):'';
  const L=[...hh.matchAll(/<span><i style="background:([^"]+)"><\/i>([^<]*)<b>([^<]*)<\/b>([^<]*)<\/span>/g)].map(m=>{const l=m[2].trim(),arg=Object.keys(GRP).find(k=>GRP[k].l===l);return {c:m[1],l,n:m[3],st:m[4].trim(),arg}});
  const plan=a==='terv',waitL=L.filter(x=>/vár/.test(x.st)).map(x=>artL(x.l.toLowerCase()));
  const say=plan?v:waitL.length?`${andL(waitL).replace(/^a/,'A')} még munkára vár, a többi jó úton van.`:v;
  const chips=`<div class="ex-gb">${L.map(x=>`<button ${x.arg?`data-exg="${x.arg}"`:''}><span>${(GRP[x.arg]||{}).chip||''}</span><b>${x.l} ${x.n}</b>${x.st?`<small>${x.st}</small>`:''}</button>`).join('')}</div>`;
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${lbl}</small><h2 class="n7-h">${say}</h2><div class="ex-seg">${seg}</div>
    <div class="ex-map">${duo}<div class="ex-sides"><span>elölről</span><span>hátulról</span></div></div><p class="ex-tip">Bökj egy izomra, és megmutatom a részeit.</p>${chips}${dots(Math.max(1,L.length-3))}</section>`;
  const rest=cs.slice(1).map(c=>{const h=c.html;
    if(/szett vár a héten/.test(h)){const items=[...h.matchAll(/(<span class="mchp sm" style="--c:[^"]+">[\s\S]*?<\/svg><\/span>)<span class="g"><strong>([^<]*)<\/strong><small>([^<]*)<\/small>/g)];
      return `<section class="mx-s ln">${KH(c.head||'Még munkára vár')}<div class="ex-cards">${items.map(m=>{const arg=Object.keys(GRP).find(k=>GRP[k].l===m[2].trim());
        return `<article class="n8-c ex-wc"><span class="ex-wcc">${m[1].replace('mchp sm','mchp')}</span><div><div class="n8-t"><b>${m[2]}</b></div><p>${m[3]}</p>${arg?`<div class="qs-acts"><button class="n8-b" data-exg="${arg}">Megnézem</button></div>`:''}</div></article>`}).join('')}</div></section>`}
    if(/A sport ezeket is/.test(h))return sportWeek(c.head||'A sport is dolgozott');
    if(/data-go="jelek"/.test(h)){const ic=g(h,/href="#([^"]+)"/)||'t-muscle';
      return `<section class="mx-s ln">${KH(c.head||'Mélyebben')}<div class="ex-cards"><article class="n8-c">${drop(ic)}<div><div class="n8-t"><b>Minden izomjel</b></div><p>A 21 izom, saját jellel, régiónként.</p><div class="qs-acts"><button class="n8-b" data-go="jelek">Megnyitom</button></div></div></article></div></section>`}
    return `<section class="mx-s ln">${c.head?KH(c.head):''}<div class="ex-keep">${pills(h)}</div></section>`}).join('');
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${rest}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
ed.routes.terkep=terkep3;
/* a tap on the drawing: the muscle shape under the finger (the liquid lies over it, so look through) → its group */
document.addEventListener('click',e=>{const m=e.target.closest('#phone .ex-map');if(!m)return;
  /* the drawing does not take pointer events: pick the muscle shape whose box holds the tap, the smallest one wins */
  const u=[...m.querySelectorAll('use')].filter(el=>/#bm-(front|back)-/.test(el.getAttribute('href')||'')).map(el=>[el,el.getBoundingClientRect()])
    .filter(([,r])=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom).sort((x,y)=>x[1].width*x[1].height-y[1].width*y[1].height).map(x=>x[0])[0];if(!u)return;
  const [,v,sh]=u.getAttribute('href').match(/#bm-(front|back)-(.+)$/),k=Object.keys(TOKEN_SHAPES).find(x=>TOKEN_SHAPES[x].some(([w,q])=>w===v&&q===sh)),arg=k&&grpByRegion(regionOf3(k));
  if(arg){const b=document.createElement('button');b.dataset.exg=arg;b.style.display='none';m.appendChild(b);b.click();b.remove()}else F.toast(k?`${muscleLabel(k)} · ezen a héten nincs terv rá`:'Ezen a héten nincs terv rá')});

/* ═══ GYAKORLATOK (2026-10-22): the kettlebell tank goes; the page's picture is the latest records as a carousel of
   medal cards; search and the group pills sit on the ground; the list is grouped by muscle group (owner: "legyen
   csoportonként"), each row with the exact muscle part, the best estimated max and where it is heading instead of the
   old bar (which only compared exercises with each other). Data: the approved exercise rows and medal list, read from
   the approved pages. ═══ */
const EXQ={q:'',f:''},REPK={chest:'chest-mid',back:'back-wide',shoulder:'shoulder-side',arm:'biceps-long',leg:'quad',core:'core'};
const MON={jan:1,febr:2,márc:3,ápr:4,máj:5,jún:6,júl:7,aug:8,szept:9,okt:10,nov:11,dec:12};
let EXR=[],EXM=[];
const exTrend=x=>{if(!x.kg)return['még nincs naplózva','none'];const last=EXM.find(m=>m.n===x.n);if(!last)return['tartja a szintet','flat'];
  const mo=MON[last.d.split(' ')[0]]||0;return mo>=9?[`${last.c==='CÉL'?'cél teljesítve':'új rekord'} · ${last.d.split(',')[0]}`,'new']:mo>=8?['emelkedik','up']:['tartja a szintet','flat']};
/* round 2 (owner, 2026-10-22: "ömlesztett, rendezetlen, fapados"): one group at a time, chosen on a row of group
   wheels (default: the group trained last, Láb); a search reaches all groups. Every exercise is the same card in the
   same order: the muscle part's drawing, the name and part, the best estimated max large, a small curve of where it is
   heading and one badge. The exercise page, the medal page and the new-exercise drawer follow the same system. */
EXQ.f='leg';
const exKey=x=>(MUSCLES.find(m=>m.label===x.ml)||{}).key||REPK[x.r]||'core';
const SER={'Döntött törzsű evezés':[80,83,86,84,89,92,94,96.7,98.2,93.3],'Fekvenyomás':[88,90,93,95,96,98.2,99,101.3]};
const exSer=(x,tr)=>{if(SER[x.n])return SER[x.n];const v=parseFloat(String(x.kg).replace(/\s/g,'').replace(',','.'))||0;
  return Array.from({length:8},(_,i)=>tr==='flat'?v*(.97+.03*Math.sin(i*1.3)):v*(.86+.14*i/7))};
const spark=(ser,c)=>{const mn=Math.min(...ser),mx=Math.max(...ser),w=120,h=34,pt=ser.map((v,i)=>[i/(ser.length-1)*w,h-3-(mx>mn?(v-mn)/(mx-mn):.5)*(h-8)]);
  const d=pt.map((q,i)=>`${i?'L':'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(''),l=pt[pt.length-1];
  return `<svg class="ex-sp" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}L${w} ${h}L0 ${h}Z" style="fill:${c};opacity:.18"/><path d="${d}" style="fill:none;stroke:${c};stroke-width:2;stroke-linejoin:round;stroke-linecap:round" vector-effect="non-scaling-stroke"/><circle cx="${l[0]}" cy="${l[1]}" r="3" style="fill:${c}"/></svg>`};
/* round 3 (owner: "ez a grafikon így semmit nem mond"): no curve in the list — the last set with its date, and a badge
   that says the change in numbers. Prototype content: the last logged set per exercise (useTrain().exerciseRecords). */
const LAST={'Fekvenyomás':['80 kg × 8','szept 21.','+5,3 kg nyár óta'],'Döntött törzsű evezés':['77,5 kg × 7','szept 17.','+13,3 kg márc óta'],
  'Húzódzkodás (súlyozott)':['10 kg × 8','szept 17.','+5 kg júl óta'],'Guggolás':['120 kg × 6','szept 23.','+9 kg nyár óta'],'Román felhúzás':['100 kg × 10','szept 23.','+6,7 kg nyár óta'],
  'Lábtolás':['180 kg × 12','szept 16.','4 hete nem változott'],'Vállból nyomás':['45 kg × 8','szept 21.','3 hete nem változott'],'Vállemelés':['30 kg × 15','szept 17.','+5 kg aug óta'],
  'Tricepsz letolás':['30 kg × 12','szept 21.','+2,5 kg aug óta'],'Kalapácsbicepsz':['16 kg × 10','szept 17.','+2 kg nyár óta']};
const exBadge=x=>{const [t,c]=exTrend(x);if(c==='new')return [t.split(' · ')[0],c];const l=LAST[x.n];return l?[l[2],/^\+/.test(l[2])?'up':'flat']:[t,c]};
const exCard=x=>{const k=exKey(x),[t,c]=exTrend(x),col=`color-mix(in srgb,${muscleColor(k)} 74%,#0A2A3C)`;
  if(!x.kg)return `<button class="ex-xc off" data-go="${x.go}">${mchp(k)}<span class="g"><b>${x.n}</b><small>${x.ml}</small><i class="none">Még nincs alkalmad</i></span><svg class="ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`;
  const [bt,bc]=exBadge(x),l=LAST[x.n];
  return `<button class="ex-xc" data-go="${x.go}">${mchp(k)}<span class="g"><b>${x.n}</b><small>${x.ml}</small></span><span class="v">${x.kg}<u> kg</u><small>becsült max</small></span>
    <span class="ex-xf">${l?`<span class="ex-last">Legutóbb <b>${l[0]}</b> · ${l[1]}</span>`:''}<i class="${bc}">${bt}</i></span></button>`};
const exList=()=>{const q=EXQ.q.trim().toLowerCase();
  const L=q?EXR.filter(x=>(x.n+' '+x.ml).toLowerCase().includes(q)):EXR.filter(x=>x.r===EXQ.f);
  if(!L.length)return `<p class="ex-say">${q?'Nincs ilyen gyakorlat a tárban.':'Ebben a csoportban még nincs gyakorlatod.'}</p>`;
  if(!q)return L.map(exCard).join('');
  return REGIONS.filter(r=>L.some(x=>x.r===r.key)).map(r=>`<p class="ex-xgl">${r.label}</p>${L.filter(x=>x.r===r.key).map(exCard).join('')}`).join('')};
const exWheels=()=>REGIONS.filter(r=>EXR.some(x=>x.r===r.key)).map(r=>`<button class="ex-wh ${!EXQ.q&&EXQ.f===r.key?'on':''}" data-exf="${r.key}">${mchp(REPK[r.key])}<b>${r.label}</b><small>${EXR.filter(x=>x.r===r.key).length}</small></button>`).join('');
function exLoad(){if(EXR.length)return;const b=O.exercises();EXR=b.split('<div class="fh-row tap " data-go="').slice(1).filter(r=>/^exercise/.test(r)).map(r=>{const ml=g(r,/<small>([^·<]*)/).trim(),mu=MUSCLES.find(x=>x.label===ml)||{};
    return {go:g(r,/^([^"]*)"/),n:g(r,/<strong>([^<]*)<\/strong>/),ml,r:mu.region||'',kg:g(r,/<span class="v">([^<]*) kg<\/span>/)}});
  const mh=ed.routes.medals('__raw');EXM=[];let d='';const re=/<span class="fh-lab">([^<]*)<\/span>|<strong>([^<]*?) <span class="st [^"]*">(REKORD|CÉL)<\/span><\/strong><small>([^<]*?)(?:<br>Előző: ([^·<]*)· ([^<]*?) óta állt)?<\/small><\/span><span class="v">([^<]*)<\/span>/g;let m;
  while((m=re.exec(mh))){if(m[1])d=m[1].trim();else EXM.push({d,n:m[2].trim(),c:m[3],t:m[4].trim(),prev:(m[5]||'').trim(),since:(m[6]||'').trim(),v:m[7]})}}
function exercises3(a){if(a)return O.exercises(a);
  const base=O.exercises(a),cs=cardsOf(base);if(!cs.length)return base;exLoad();
  const hh=cs[0].html,v=g(hh,/<p class="verdict"[^>]*>([^<]*)<\/p>/),nGy=+g(v,/(\d+) gyakorlat/),nRec=+g(v,/(\d+) rekord/),nMed=g(hh,/>(\d+) medál</);
  const recent=EXM.filter(m=>m.c==='REKORD').slice(0,5);
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">A mozdulataid</small><h2 class="n7-h">${nGy} gyakorlatod van, ${nRec}&#8209;ben már rekordod is.</h2>
    <label class="ex-sb"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input id="ex-gyq" type="search" value="${EXQ.q.replace(/"/g,'&quot;')}" placeholder="Keresés névre vagy izomra" aria-label="Keresés a gyakorlatok között" autocomplete="off"></label>
    <div class="ex-whs" role="group" aria-label="Izomcsoport">${exWheels()}</div><div id="ex-gyl" class="ex-xl">${exList()}</div>
    <div class="ex-acts"><button class="n8-b" data-sheet="cat" data-arg="uj">Új gyakorlat</button></div></section>`;
  const rec=`<section class="mx-s ln">${KH('Friss rekordok','',`<button class="fh-lk" data-go="medals">Mind a ${nMed||EXM.length} ›</button>`)}<div class="ex-mr">${recent.map(m=>{const x=EXR.find(q=>q.n===m.n)||{};return medCard(m,x.go||'medals',true)}).join('')}</div>${dots(Math.max(1,recent.length-1))}</section>`;
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${rec}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
ed.routes.exercises=exercises3;
const exRedraw=()=>{const l=document.getElementById('ex-gyl');if(l)l.innerHTML=exList();const w=document.querySelector('#phone .ex-whs');if(w)w.innerHTML=exWheels()};
document.addEventListener('input',e=>{if(e.target.id!=='ex-gyq')return;EXQ.q=e.target.value;exRedraw()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-exf]');if(!b)return;EXQ.f=b.dataset.exf;EXQ.q='';const i=document.getElementById('ex-gyq');if(i)i.value='';exRedraw()});

/* a medal as a card: the drop, the date, the exercise or the kind, and old → new */
const medStep=m=>{if(!m.prev)return m.c==='CÉL'?'cél teljesítve':'';if(/rep$/.test(m.prev)){const n=g(m.v,/× (\d+)/);return `${m.prev.replace(' rep','')} → ${n} ismétlés`}return `${m.prev} → ${m.v.replace(/ × \d+$/,'')}`};
const medCard=(m,go,withName)=>`<button class="ex-mc2 ${m.c==='CÉL'?'goal':''}" data-go="${go}"><svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${V.drop({ic:m.c==='CÉL'?'t-flag':'t-record'})}</svg>
  <small>${m.d.split(',')[0]}</small><b>${withName?m.n:m.t}</b>${withName?`<em>${m.t}</em>`:''}<span>${m.v}</span>${medStep(m)?`<i>${medStep(m)}</i>`:''}</button>`;

/* ═══ EGY GYAKORLAT (round 2): the sentence (the next goal), the max large with its curve and no card, the three
   records as tiles, the medals as a carousel, where it is used as two cards, editing and video as two buttons ═══ */
O.exercise=ed.routes.exercise;ed.routes['exercise-lista']=O.exercise;
const rowsOf=h=>h.split(/<div class="fh-row [^"]*"/).slice(1).map(r=>({title:g(r,/<strong>([^<]*)/).trim(),sub:g(r,/<small>([\s\S]*?)<\/small>/),v:g(r,/<span class="v">([^<]*)<\/span>/),
  go:g(r,/^[^>]*data-go="([^"]*)"/),sheet:g(r,/^[^>]*data-sheet="([^"]*)"/),arg:g(r,/^[^>]*data-arg="([^"]*)"/),ic:g(r,/href="#([^"]+)"/)}));
function exercise3(a){if(a&&!['kozos','egy','uj'].includes(a))return O.exercise(a);exLoad();
  const base=O.exercise(a),cs=cardsOf(base);if(!cs.length)return base;
  const name=g(base,/<h1[^>]*>([^<]*)/).trim(),hh=cs[0].html,lbl=g(hh,/<span class="lbl">([^<]*)<\/span>/),v=g(hh,/<p class="verdict"[^>]*>([^<]*)<\/p>/),sub=g(hh,/<p class="sub">([^<]*)<\/p>/);
  const big=g(hh,/<p class="fh-big"[^>]*>([^<]*)<small>/),ci=hh.indexOf('<div class="vs-hg'),chart=ci>=0?hh.slice(ci,bal(hh,ci)):'',note=g(hh,/<p class="fh-note">([^<]*)<\/p>/);
  const [lead,...facts]=sub.split(' · '),mk=(MUSCLES.find(m=>lbl.startsWith(m.label))||{}).key||'back-mid';
  const hero=`<section class="mx-s ex-hero"><small class="ex-eb">${lbl}</small><h2 class="n7-h">${v}</h2><p class="ex-dates">${lead}</p>
    ${a==='uj'?`<div class="ex-empty">${mchp(mk)}<p>${sub}</p></div>`:`<div class="ex-kg">${mchp(mk)}${big?`<b>${big}<u> kg most</u></b>`:''}</div>${chart?`<div class="ex-chart">${chart}</div>`:note?`<p class="ex-say">${note}</p>`:''}
    ${facts.length?`<p class="ex-dates">${facts.join(' · ')}</p>`:''}`}</section>`;
  const sec=cs.slice(1).map(c=>{const R=rowsOf(c.html),lk=g(c.html,/<button class="fh-lk"([^>]*)>([^<]*)<\/button>/,0);
    if(/Rekord/.test(c.head))return `<section class="mx-s ln">${KH('Rekordjaid','',lk.replace(/>[^<]*</,'>Mi számít? <'))}<div class="ex-rt">${R.map(r=>`<div><small>${r.title.replace('Becsült 1RM','Becsült max')}</small><b>${r.v.replace(/ × rep$/,'').replace(' × ','<br>× ')}</b></div>`).join('')}</div></section>`;
    if(/Medál/.test(c.head)){const ms=EXM.filter(m=>m.n===name);return `<section class="mx-s ln">${KH('Medáljaid')}${ms.length?`<div class="ex-mr">${ms.map(m=>medCard(m,'medals',false)).join('')}</div>${ms.length>2?dots(ms.length-1):''}`:`<p class="ex-say">Ezen a gyakorlaton még nincs medálod. Az első megdöntött rekord ide kerül.</p>`}</section>`}
    if(/Hol/.test(c.head)||/Sablon|tervedben|egyetlen tervedben/.test(c.html))return `<section class="mx-s ln">${KH('Hol szerepel')}${R.length?`<div class="ex-pl">${R.map(r=>`<button class="ex-plc" ${r.go?`data-go="${r.go}"`:''}><span class="mt-bub">${I(r.ic||'t-stack')}</span><b>${r.title}</b><small>${r.sub}</small></button>`).join('')}</div>`:`<p class="ex-say">${g(c.html,/<p class="fh-note"[^>]*>([^<]*)/)}</p>`}</section>`;
    if(/kezel/.test(c.head)||/data-sheet="cat"/.test(c.html))return `<section class="mx-s ln ex-mg"><div class="ex-acts">${R.map(r=>`<button class="n8-b" data-sheet="${r.sheet}"${r.arg?` data-arg="${r.arg}"`:''}>${r.title}</button>`).join('')}</div></section>`;
    return `<section class="mx-s ln">${c.head?KH(c.head):''}<div class="ex-keep">${pills(c.html)}</div></section>`}).join('');
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${hero}${sec}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
ed.routes.exercise=exercise3;

/* ═══ MEDÁLOK (round 2): the medals as drops on a shelf (this month's full and bright), then month by month as cards,
   each with old → new instead of the long "Előző: … óta állt" line ═══ */
O.medals=ed.routes.medals;ed.routes['medals-lista']=O.medals;
const MHU={jan:'Január',febr:'Február',márc:'Március',ápr:'Április',máj:'Május',jún:'Június',júl:'Július',aug:'Augusztus',szept:'Szeptember',okt:'Október',nov:'November',dec:'December'};
function medals3(a){if(a==='__raw')return O.medals();if(a)return O.medals(a);exLoad();
  const base=O.medals(a),cs=cardsOf(base);if(!cs.length)return base;const v=g(cs[0].html,/<p class="verdict"[^>]*>([^<]*)<\/p>/);
  const mon=EXM[0]?EXM[0].d.split(' ')[0]:'',nNew=EXM.filter(m=>m.d.startsWith(mon)).length;
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">Medálok</small><h2 class="n7-h">${v}</h2>
    <div class="ex-shelf">${EXM.map((m,i)=>`<i class="${i<nNew?'new':''}"><svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${i<nNew?V.drop({ic:m.c==='CÉL'?'t-flag':'t-record'}):V.icd({ic:'t-record'})}</svg></i>`).join('')}</div>
    <p class="ex-dates"><b>${nNew}</b> ebben a hónapban · <b>${EXM.length-nNew}</b> korábbról</p></section>`;
  const months=[...new Set(EXM.map(m=>m.d.split(' ')[0]))];
  const list=months.map(mo=>{const ms=EXM.filter(m=>m.d.split(' ')[0]===mo);return `<section class="mx-s ln">${KH(MHU[mo]||mo,'',`<span class="ex-cnt">${ms.length} medál</span>`)}<div class="ex-ml">${ms.map(m=>{const x=EXR.find(q=>q.n===m.n)||{};
    return `<button class="ex-mrow ${m.c==='CÉL'?'goal':''}" data-go="${x.go||'exercises'}"><svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${V.drop({ic:m.c==='CÉL'?'t-flag':'t-record'})}</svg>
      <span class="g"><small>${m.d.split(',')[0]} · ${m.t}</small><b>${m.n}</b>${medStep(m)?`<i>${medStep(m)}</i>`:''}</span><span class="v">${m.v}</span></button>`}).join('')}</div></section>`}).join('');
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${list}<p class="ex-say ex-foot">A medálok visszamenőleg, a korábbi szetteidből is épültek, nem mindet élőben szerezted.</p><div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
ed.routes.medals=medals3;

/* ═══ ÚJ GYAKORLAT (round 2): the drawer skeleton; the muscle is picked on the body (a tap selects the muscle, its
   group's parts follow as pills), the type is a three-way switch; the approved fields and steppers stay ═══ */
const CAT={k:null};const O_cat=ed.sheets&&ed.sheets.cat;
const catPick=()=>{const k=CAT.k,r=k&&regionOf3(k),ms=r?MUSCLES.filter(m=>m.region===r):[];
  const bod=v=>body(v,MUSCLES.map(m=>[m.key,m.key===k?1:0,m.key===k?1:ms.includes(m)?.4:.1]));
  return `<div class="ex-cbody">${bod('front')}${bod('back')}</div><p class="ex-ctip">${k?`<b>${muscleLabel(k)}</b>`:'Bökj a testen arra az izomra, amit a gyakorlat dolgoztat.'}</p>
    ${r?`<div class="ex-cpp">${ms.map(m=>`<button class="${m.key===k?'on':''}" data-exc="${m.key}">${m.label.replace(/^.*\((.*)\)$/,'$1')}</button>`).join('')}</div>`:''}`};
if(O_cat)ed.sheets.cat=(...a)=>{const edt=a[0]==='szerk',h=O_cat(...a);CAT.k=edt?'back-mid':null;
  const ins=[...h.matchAll(/<input class="fh-in"[^>]*>/g)].map(m=>m[0]),stp=(()=>{let o='',i=0;while((i=h.indexOf('<div class="vs-sjl"',i))>=0){const e=bal(h,i);o+=h.slice(i,e);i=e}return o})();
  const ai=h.lastIndexOf('<div class="fh-acts">'),acts=h.slice(h.indexOf('<div class="fh-acts">'));
  const btns=acts.replace(/<\/?div[^>]*>/g,'').replace(/class="btn[^"]*"/,'class="dv-btn pri"').replace(/class="fh-lk[^"]*"/g,'class="n8-b"');
  return `<div class="dv ex-why ex-cat"><div class="dv-top">${drop('t-muscle')}<div><small>Gyakorlat</small><b>${edt?'Szerkesztés':'Új gyakorlat'}</b></div><button class="ex-x0" data-close aria-label="Bezárás">×</button></div>
    <p class="ex-cl">Név</p>${ins[0]||''}<p class="ex-cl">Melyik izom?</p><div class="ex-cpick">${catPick()}</div>
    <p class="ex-cl">Típus</p><div class="ex-cseg">${['összetett','izolált','plyo'].map((t,i)=>`<button class="${i?'':'on'}" data-exty>${t}</button>`).join('')}</div>
    <div class="ex-cst">${stp}</div><p class="ex-cl">Videó link</p>${ins[1]||''}<div class="ex-why-a">${btns}</div></div>`};
const catRedraw=()=>{const c=document.querySelector('.ex-cpick');if(c)c.innerHTML=catPick()};
document.addEventListener('click',e=>{const t=e.target.closest('[data-exty]');if(t){t.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===t));return}
  const p=e.target.closest('[data-exc]');if(p){CAT.k=p.dataset.exc;catRedraw();return}
  const m=e.target.closest('.ex-cbody');if(!m)return;
  const u=[...m.querySelectorAll('use')].filter(el=>/#bm-(front|back)-/.test(el.getAttribute('href')||'')).map(el=>[el,el.getBoundingClientRect()])
    .filter(([,r])=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom).sort((x,y)=>x[1].width*x[1].height-y[1].width*y[1].height).map(x=>x[0])[0];if(!u)return;
  const [,v,sh]=u.getAttribute('href').match(/#bm-(front|back)-(.+)$/),k=Object.keys(TOKEN_SHAPES).find(x=>TOKEN_SHAPES[x].some(([w,q])=>w===v&&q===sh));if(k){CAT.k=k;catRedraw()}});

/* ═══ ELIGAZÍTÁS (2026-10-30): one sentence (what, how long, where we step up); the page's picture is today's row as
   tubes — one per exercise, a notch per set, the muscle drawing on top, the target under it, a flag where a mission is;
   the shoulder note is one Mezo card and the two exercise warnings sit under their tube; the missions are a carousel
   of equal cards (owner: "legyen lapozható") with the certainty as a level, "Miért?" and a "Vállalom" switch; the
   bottom bar is Vissza + Indulás. Handlers stay the approved ones (btick / bstart). ═══ */
let BRX=0;
function indulas3(a){if(a)return O.indulas(a);
  const base=O.indulas(a),cs=cardsOf(base);if(cs.length<3)return base;
  const ttl=g(base,/<small><i><\/i><span>([^<]*)<\/span><\/small>/),day=ttl.split(' · ')[0];
  const h0=cs[0].html,time=g(h0,/<p class="verdict"[^>]*>([^,<]*)/),F3=[...h0.matchAll(/<b>(\d+)<\/b><small>([^<]*)<\/small>/g)].map(m=>m[1]);
  const W=cs.find(c=>/hero warn/.test(c.html)),wv=W?g(W.html,/<p class="verdict"[^>]*>([^<]*)/):'',ws=W?g(W.html,/<p class="sub">([^<]*)/):'',wic=W?g(W.html,/href="#([^"]+)"/):'';
  const Q=cs.find(c=>/btick/.test(c.html)),U=cs.find(c=>/lépünk előre|Túlterhelés ·/.test(c.html)&&!/btick/.test(c.html)),R=cs.find(c=>/vs-caps/.test(c.html));
  const step=U?g(U.html,/<strong>[^·<]*· ([^<]*)<\/strong>/).replace(/(\d)×/g,'$1 gyakorlaton').replace(' · ',', '):'';
  const QS=(Q?Q.html.split('<div class="fh-row tap " data-ve="btick:').slice(1):[]).map(r=>({i:+g(r,/^(\d+)/),on:/vs-qc on/.test(r),p:+g(r,/--p:(\d+)%/),n:g(r,/<strong>([^<]*)/),
    ic:g(r,/class="vs-qt">[\s\S]*?href="#([^"]+)"/),t:g(r,/<\/svg><\/span>([^<]*)<\/span> <b>/).trim(),goal:g(r,/<\/span> <b>([^<]*)<\/b>/),cert:g(r,/<br>([^·<]*)/).trim(),why:g(r,/data-toast="([^"]*)">Miért/)}));
  const RS=(R?R.html.split('<div class="fh-row  ">').slice(1):[]).map(r=>{const sm=g(r,/<small>([^<]*)/);return {chip:g(r,/(<span class="mchp sm"[\s\S]*?<\/svg><\/span>)/).replace('mchp sm','mchp'),c:g(r,/--c:([^"]+)"/),n:g(r,/<strong>([^<]*)/),
    sets:+g(sm,/^(\d+) szett/),goal:g(sm,/cél ([^·]*)/).trim(),chg:sm.split(' · ').slice(2).join(' · '),warn:g(r,/<span class="vs-warn">([^<]*)/),flag:/vs-rr"><span class="fb/.test(r)}});
  const short=n=>({'Húzódzkodás (súlyozott)':'Húzódzk.','Döntött törzsű evezés':'Evezés','Rear Delt Fly':'Rear Delt','Kalapácsbicepsz':'Kalapács','Vállemelés':'Vállemelés'})[n]||n.split(' ')[0];
  let ti=0;const tubes=F.vials(RS.map(x=>({l:short(x.n),v:x.goal.replace(/ × /,'×'),s:x.chg.replace('könnyítve · ','').replace('tartjuk','tartjuk'),p:0,c:`color-mix(in srgb,${x.c} 74%,#0A2A3C)`,mark:x.flag?'⚑':'',on:{toast:`${x.n} · ${x.sets} szett · cél ${x.goal}${x.warn?' · '+x.warn:''}`}})),{h:120})
    .replace(/<span class="k2-tube"([^>]*)>/g,(m)=>{const x=RS[ti++]||{};return `<span class="ex-mc">${x.chip||''}</span>${m}${Array.from({length:Math.max(0,(x.sets||1)-1)},(_,k)=>`<i class="ex-notch" style="bottom:${(k+1)/(x.sets||1)*100}%"></i>`).join('')}`});
  const warns=RS.filter(x=>x.warn);
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">Eligazítás · ${ttl.split(' · ').slice(1).join(' · ')}</small><h2 class="n7-h">${day}: ${F3[0]||''} gyakorlat, ${F3[1]||''} szett, nagyjából ${time}.</h2>
    ${step?`<p class="ex-dates">Ma ${step.toLowerCase().replace('+súly','súlyt emelünk').replace('+rep','ismétlést')}.</p>`:''}
    <div class="ex-wk ex-br">${tubes}</div><p class="ex-tip">A csövek az edzés közben telnek meg; a ⚑ jelű gyakorlathoz küldetés tartozik.</p></section>`;
  const care=W?`<section class="mx-s ln">${KH('Figyelj rá')}<div class="ex-cards"><article class="n8-c">${drop(wic||'t-bandage')}<div><div class="n8-t"><b>${wv}</b></div><p class="ex-ws">${ws}</p>
    ${warns.map(x=>`<p class="ex-wl"><b>${short(x.n)}:</b> ${x.warn}</p>`).join('')}</div></article></div></section>`:'';
  const nOn=QS.filter(q=>q.on).length;
  const quests=QS.length?`<section class="mx-s ln">${KH('Küldetések · mit vállalsz ma?','',`<span class="ex-cnt">${nOn} / ${QS.length} vállalva</span>`)}<div class="ex-mr ex-qr">${QS.map(q=>`<article class="ex-qc ${q.on?'on':''}">
      <small><span class="ex-qi">${I(q.ic||'t-flag')}</span>${q.t}</small><b>${q.n}</b><span class="ex-qg">${q.goal}</span>
      <div class="ex-qb"><i style="width:${q.p}%"></i></div><em>${/^\d/.test(q.cert)?q.cert:'még tanulom, mennyire biztos'}</em>
      <div class="ex-qa"><button class="ex-qw" data-toast="${q.why}">Miért?</button><button class="ex-qt ${q.on?'on':''}" data-ve="btick:${q.i}" aria-pressed="${q.on}">${q.on?'Vállalva':'Vállalom'}</button></div></article>`).join('')}</div>${dots(Math.max(1,QS.length-1))}</section>`:'';
  const fi=base.indexOf('<div class="fh-foot'),fe=fi>=0?bal(base,fi):-1,foot=fi>=0?base.slice(fi,fe).replace(/<button class="btn "([^>]*)style="flex:1">/,'<button class="n8-b" data-go="mai">Vissza</button><button class="n9-btn"$1style="flex:1">'):'';
  const body=base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${care}${quests}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end);
  return fi>=0?body.replace(base.slice(fi,fe),foot):body}
ed.routes.indulas=indulas3;
document.addEventListener('click',e=>{if(!e.target.closest('[data-ve^="btick"]'))return;const c=document.querySelector('#phone .ex-qr');BRX=c?c.scrollLeft:0;
  const put=()=>{const n=document.querySelector('#phone .ex-qr');if(n){n.style.scrollSnapType='none';n.scrollLeft=BRX;requestAnimationFrame(()=>{n.style.scrollSnapType=''})}};setTimeout(put,0);setTimeout(put,60)},true);
{const O_after2=ed.after;ed.after=(r,a)=>{O_after2&&O_after2(r,a);if(r==='indulas'&&BRX)requestAnimationFrame(()=>{const c=document.querySelector('#phone .ex-qr');if(c)c.scrollLeft=BRX})}}

/* ═══ EDZÉS KÖZBEN (2026-10-30): the briefing's five tubes at the top, now filling a notch per finished set — a tap
   brings that exercise up (owner: the "A mai sor" list goes, the tubes do the same); the current exercise without a card:
   drawing, name, "last week → today", the mission line, three round tools; the approved set table stays; the bottom bar
   is "Gyakorlat hozzáadása" + "Edzés befejezése"; the legend and the notes move behind the title's "?". ═══ */
const SHORTN=n=>({'Húzódzkodás (súlyozott)':'Húzódzk.','Döntött törzsű evezés':'Evezés','Rear Delt Fly':'Rear Delt','Kalapácsbicepsz':'Kalapács','Vállemelés':'Vállemelés'})[n]||n.split(' ')[0];
/* round 2 (owner, 2026-10-30): ticking is live — a tick marks the set done at once and moves to the next; the rest
   timer starts after every set but the last (150 s compound, 90 s isolation, +30 / Kész), and "hogy ment?" comes only
   after the LAST set of an exercise, then the next unfinished exercise comes up — as in the live app
   (ActiveWorkoutPage handleLogSet). The head is only the drawing and the name; last week moved into Rekordok (its sheet
   already shows "A múltkori alkalom"), the mission is a fourth round tool. State is local: SM[name] = sets. */
const SM={},RESTS={'Húzódzkodás (súlyozott)':150,'Döntött törzsű evezés':150};let RST2=null,FB=null;
const smDone=n=>(SM[n]||[]).filter(x=>x.st==='d').length;
const reDraw=()=>{const sc=document.querySelector('#phone .scroll'),y=sc?sc.scrollTop:0;window.dispatchEvent(new HashChangeEvent('hashchange'));const s2=document.querySelector('#phone .scroll');if(s2)s2.scrollTop=y;document.querySelectorAll('#phone .rise').forEach(e=>{e.style.animation='none'})};
const goFocus=i=>{const ph=document.querySelector('#phone');if(!ph)return;const b=document.createElement('button');b.dataset.ve='focus:'+i;b.style.display='none';ph.querySelector('.scroll').appendChild(b);b.click();b.remove()};
function seedSets(name,sets){if(SM[name])return;SM[name]=sets.split('<span class="n').slice(1).map(r=>{const v=[...r.matchAll(/class="v [du]">([^<]*)<\/span>/g)].map(m=>m[1]),iv=[...r.matchAll(/<input class="vin"[^>]*value="([^"]*)"/g)].map(m=>m[1]);
  return /^ f"/.test(r)?{st:'d',kg:v[0],r:v[1],rir:v[2],vd:/rekord/.test(r)?'record':'tick'}:{st:'u',kg:(iv[0]||v[0]),r:(iv[1]||v[1]),rir:(iv[2]||v[2])}})}
const setTable=(name,fi,c)=>{const L=SM[name]||[],cur=L.findIndex(x=>x.st!=='d');
  return `<div class="ex-st" style="--c:${c}"><span class="h">#</span><span class="h">kg</span><span class="h">ism</span><span class="h">RIR</span><span></span>${L.map((x,j)=>x.st==='d'
    ?`<span class="n d">${j+1}</span><span class="v d">${x.kg}</span><span class="v d">${x.r}</span><span class="v d">${x.rir}</span><button class="ok ${x.vd}" data-sheet="set" data-arg="${fi}.${j}" aria-label="${j+1}. szett kész · szerkesztés">${I(x.vd==='record'?'t-record':'t-tick')}</button>`
    :j===cur?`<span class="n c">${j+1}</span><input class="vin" inputmode="decimal" value="${x.kg}" aria-label="Súly, kg"><input class="vin" inputmode="numeric" value="${x.r}" aria-label="Ismétlés"><input class="vin" inputmode="numeric" value="${x.rir}" aria-label="RIR"><button class="tk" data-exs="tick" aria-label="Szett kész">${I('t-tick')}</button>`
    :`<span class="n">${j+1}</span><span class="v u">${x.kg}</span><span class="v u">${x.r}</span><span class="v u">${x.rir}</span><span></span>`).join('')}</div>`};
const mmss2=t=>`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
function session3(a){if(a&&a!=='uj')return O.session(a);
  const base=O.session(a),pi=base.indexOf('<div class="vs-pv'),cs=cardsOf(base);if(pi<0||!cs.length)return base;
  const pv=base.slice(pi,bal(base,pi)),hh=cs[0].html,chips={};
  [...base.matchAll(/(<span class="mchp[^"]*" style="--c:[^"]+">[\s\S]*?<\/svg><\/span>)(?:<span class="g"><strong>([^<]*)<\/strong>|<div[^>]*><span class="lbl">[^<]*<\/span><p class="verdict"[^>]*>([^<]*)<\/p>)/g)].forEach(m=>{chips[(m[2]||m[3]||'').trim()]=m[1].replace(/mchp sm|mchp /,'mchp ')});
  const name=g(hh,/<p class="verdict"[^>]*>([^<]*)<\/p>/),chip=g(hh,/(<span class="mchp[\s\S]*?<\/svg><\/span>)/);
  const si=hh.indexOf('<div class="vs-sets"'),sets=si>=0?hh.slice(si,bal(hh,si)):'',col=g(sets,/--c:([^"]+)"/);seedSets(name,sets);
  const T=[...pv.matchAll(/<button class="([^"]*)" data-ve="focus:(\d+)" style="--c:([^;]+);[^"]*" aria-label="([^"]*) · (\d+) \/ (\d+) szett">/g)].map(m=>({on:/\bon\b/.test(m[1]),i:+m[2],c:m[3],n:m[4],d:SM[m[4]]?smDone(m[4]):+m[5],t:SM[m[4]]?SM[m[4]].length:+m[6]}));
  const fi=(T.find(x=>x.n===name)||{i:0}).i,done=T.reduce((q,x)=>q+x.d,0),tot=T.reduce((q,x)=>q+x.t,0);
  let ti=0;const tubes=F.vials(T.map(x=>({l:SHORTN(x.n),v:`${x.d}/${x.t}`,s:'',p:x.d/x.t*90,c:x.c,mark:x.d===x.t?'✓':'',on:{toast:'focus:'+x.i}})),{h:84})
    .replace(/<button class="k2-vial([^"]*)"([^>]*?)data-toast="focus:(\d+)"/g,(m,c,mid,i)=>`<button class="k2-vial${c}${+i===fi?' ex-cur':''}"${mid}data-ve="focus:${i}"`)
    .replace(/<span class="k2-tube"([^>]*)>/g,m=>{const x=T[ti++]||{};return `<span class="ex-mc">${chips[x.n]||''}</span>${m}${Array.from({length:Math.max(0,(x.t||1)-1)},(_,k)=>`<i class="ex-notch" style="bottom:${(k+1)/(x.t||1)*100}%"></i>`).join('')}`});
  const tools=[...hh.matchAll(/<button data-sheet="(recs|tech|menu)" data-arg="([^"]*)"[^>]*>/g)].map(m=>[m[1],m[2]]);
  const q=g(hh,/<button class="vs-ql" data-sheet="qb" data-arg="(\d+)"/);
  const TL={recs:['t-record','Rekordok'],tech:['t-book','Technika'],qb:['t-flag','Küldetés'],menu:['t-gear','Műveletek']};
  const tl=[...tools.filter(t=>t[0]!=='menu'),...(q!==''?[['qb',q]]:[]),...tools.filter(t=>t[0]==='menu')].map(([k,ar])=>`<button class="ex-tl" data-sheet="${k}" data-arg="${ar}">${I(TL[k][0])}<small>${TL[k][1]}</small></button>`).join('');
  const state=g(hh,/Állapot<\/small><b>([^<]*)/)||(/Első alkalom/.test(hh)?'Első alkalom: a súlyt te adod meg, innentől jön a javaslat.':''),xl=[...hh.matchAll(/<p class="vs-xl">[\s\S]*?<\/p>/g)].map(m=>m[0]).join(''),allDone=T.every(x=>x.d===x.t);
  const cur=`<section class="mx-s ex-hero ex-ses"><div class="ex-wk ex-br ex-tt">${tubes}</div>
    <div class="ex-now">${chip}<b>${name}</b></div>${state?`<p class="ex-dates">${state}</p>`:''}${xl?`<div class="ex-xls">${xl}</div>`:''}
    <div class="ex-tls" style="grid-template-columns:repeat(${tl.split('ex-tl').length-1},1fr)">${tl}</div><div class="ex-sets">${setTable(name,fi,col)}</div>
    ${allDone?`<p class="ex-say ex-alld">Minden szett megvan. Zárd le az edzést.</p>`:''}</section>`;
  const fixHelp=h=>h.replace(/<span>\d+ \/ \d+ szett kész/,`<span>${done} / ${tot} szett kész`).replace(/data-toast="Kalauz ehhez az oldalhoz"/,'data-toast="A pipa után a szett kész, és indul a pihenő. A gyakorlat utolsó szettje után megkérdezem, hogy ment. Egy csőre bökve másik gyakorlatra válthatsz."');
  const foot=RST2?`<div class="fh-foot nonav ex-sf ex-rf"><span class="ex-rv"><i id="ex-rl" style="height:${RST2.left/RST2.tot*100}%"></i></span><span class="g"><b id="ex-rt">${mmss2(RST2.left)}</b><small>pihenő · ${SHORTN(RST2.n)}</small></span><button class="n8-b" data-exs="plus">+30 mp</button><button class="n9-btn" data-exs="rstop">Kész</button></div>`
    :`<div class="fh-foot nonav ex-sf"><button class="n8-b" data-ve="pick:add" aria-label="Gyakorlat hozzáadása">+ Gyakorlat</button><button class="${allDone?'n9-btn ok':'n9-btn'}" data-sheet="fin" style="flex:1">Edzés befejezése</button></div>`;
  const end=cs[cs.length-1].end,out=fixHelp(base.slice(0,pi))+`${DEFS}<div class="mx ex">${cur}<div class="ng-tail" style="height:110px"></div></div>`+base.slice(end);
  const ti2=out.indexOf('<div class="toast"');return ti2>=0?out.slice(0,ti2)+foot+out.slice(ti2):out}
/* the finish drawer counts what was ticked here */
const O_fin=ed.sheets&&ed.sheets.fin;if(O_fin)ed.sheets.fin=(...x)=>{const h=O_fin(...x),m=(document.querySelector('#phone .fh-title small span')?.textContent||'').match(/(\d+) \/ (\d+)/);if(!m)return h;const d=+m[1],t=+m[2];
  let hh2=h;Object.keys(SM).forEach(n=>{const left=SM[n].length-smDone(n),re=new RegExp(n.replace(/[()]/g,'\\$&')+'(</strong>[\\s\\S]*?)\\d+ szett maradna');hh2=hh2.replace(re,(m,mid)=>left?`${n}${mid}${left} szett maradna`:`${n}${mid}kész, minden szett megvan`)});
  return hh2.replace(/Van még \d+ bepipálatlan/,`Van még ${t-d} bepipálatlan`).replace(/Befejezem így · \d+ elvégzett · \d+ kihagyott/,`Befejezem így · ${d} elvégzett · ${t-d} kihagyott`)};
function restStart(n){clearInterval(RST2&&RST2.t);const tot=RESTS[n]||90;RST2={n,left:tot,tot};RST2.t=setInterval(()=>{if(!RST2)return;RST2.left--;
  const t=document.getElementById('ex-rt'),l=document.getElementById('ex-rl');if(t)t.textContent=mmss2(Math.max(0,RST2.left));if(l)l.style.height=Math.max(0,RST2.left/RST2.tot*100)+'%';
  if(RST2.left<=0||!document.getElementById('ex-rt')&&!/w-edzes-session/.test(location.hash)){restStop();F.toast&&F.toast('Pihenő vége, jöhet a következő szett')}},1000)}
function restStop(){if(RST2)clearInterval(RST2.t);RST2=null;if(/w-edzes-session/.test(location.hash))reDraw()}
const fbSheet=n=>`<div class="dv ex-why ex-fb"><div class="dv-top">${drop('t-tick')}<div><small>Gyakorlat kész</small><b>${n}</b></div><button class="ex-x0" data-close aria-label="Bezárás">×</button></div>
  <h2 class="n7-h ex-why-q">Hogy ment?</h2>${[['Pumpa · érzed?',['Semmi','Enyhe','Jó','Brutális'],2],['Ízületi fájdalom',['Nincs','Enyhe','Erős'],0],['Akarunk még?',['Kevés volt','Pont jó','Sok volt'],1]].map(([qq,o,d])=>`<p class="ex-cl">${qq}</p><div class="ex-cseg" style="grid-template-columns:repeat(${o.length},1fr)">${o.map((x,i)=>`<button class="${i===d?'on':''}" data-exty>${x}</button>`).join('')}</div>`).join('')}
  <div class="ex-why-a"><button class="dv-btn pri" data-exfb="save">Mentés · tovább</button><button class="n8-b" data-exfb="skip">Hagyjuk</button></div></div>`;
document.addEventListener('click',e=>{const b=e.target.closest('[data-exs],[data-exfb]');if(!b)return;
  if(b.dataset.exfb){const n=FB;FB=null;F.closeSheet();F.toast&&F.toast(b.dataset.exfb==='save'?'Mentve':'Rendben');const ph=document.querySelector('#phone');
    const names=[...ph.querySelectorAll('.ex-tt .k2-vial')].map(v=>({i:+v.dataset.ve.split(':')[1],l:v.querySelector('b')?.textContent||''}));const nx=names.find(x=>{const [d,t]=x.l.split('/').map(Number);return d<t});if(nx)goFocus(nx.i);else reDraw();return}
  const k=b.dataset.exs;if(k==='plus'){if(RST2){RST2.left+=30;RST2.tot+=30}return}if(k==='rstop'){restStop();return}
  if(k==='tick'){const ph=document.querySelector('#phone'),n=ph.querySelector('.ex-now b').textContent,L=SM[n];if(!L)return;const j=L.findIndex(x=>x.st!=='d');if(j<0)return;
    const iv=[...ph.querySelectorAll('.ex-st .vin')].map(x=>x.value);L[j]={st:'d',kg:iv[0],r:iv[1],rir:iv[2],vd:'tick'};
    for(let q=j+1;q<L.length;q++)if(L[q].st!=='d')L[q]={...L[q],kg:iv[0]};
    if(j===L.length-1){restStop();FB=n;reDraw();F.openSheet(fbSheet(n))}else{restStart(n);reDraw()}}});
ed.routes.session=session3;

/* ═══ AZ EDZÉS VÉGE (2026-11-01, owner: "maradjon a kettő"): the ceremony keeps its staged reveal and the cup (ids and
   reveal classes untouched, runCer still drives them) but loses the card; new records are the medal cards of
   Gyakorlatok (old → new), the numbers are tiles, the missions two cards. The Összegzés: sentence + a short line, the
   muscle tubes as the picture, last week as three number tiles with Mezo's trend line, medals as a carousel, missions
   side by side, every exercise in the Gyakorlatok card shape, the note as a quote; grey notes go behind "?". ═══ */
const rowsR=h=>h.split(/<div class="fh-row [^"]*"/).slice(1).map(r=>({go:g(r,/^[^>]*data-go="([^"]*)"/),title:g(r,/<strong>([^<]*)/).trim(),sub:g(r,/<small>([\s\S]*?)(?:<span class="vs-rowbar|<\/small>)/),
  v:g(r,/<span class="v">([\s\S]*?)<\/span>/),st:g(r,/<span class="st ([a-z]+)">([^<]*)<\/span>/,0),chip:g(r,/(<span class="mchp[\s\S]*?<\/svg><\/span>)/),caps:g(r,/(<span class="vs-caps[\s\S]*?<\/span>)/)}));
const recCard=(n,kind,v,prev)=>`<article class="ex-mc2 ex-rc"><svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${V.drop({ic:/célszett/.test(n)?'t-flag':'t-record'})}</svg><small>${kind}</small><b>${n}</b><span>${v}</span>${prev?`<i>${prev} → ${v.replace(/ <small>.*$/,'')}</i>`:''}</article>`;
const REVM=()=>{const h=O.review(),cs=cardsOf(h),c=cs.find(x=>/Súly-rekord|Rep-rekord/.test(x.html));return c?rowsR(c.html):[]};
function review3(a){if(a)return O.review(a);
  const base=O.review(a),cs=cardsOf(base);if(cs.length<3)return base;const hh=cs[0].html;
  const v=g(hh,/<p class="verdict"[^>]*>([^<]*)/),sub=g(hh,/<p class="sub">([^<]*)/),vi=hh.indexOf('<div class="k2-vials'),tubes=vi>=0?hh.slice(vi,bal(hh,vi)):'';
  const m=sub.match(/(\d+)\/\d+ gyakorlat · terv ~(\d+), tény (\d+) perc/),line=m?`${m[1]} gyakorlat · ${m[3]} perc (a terv ~${m[2]} volt)`:sub;
  const prevLk=g(hh,/(<button class="fh-lk" data-toast="[^"]*">[^<]*<\/button>)/).replace('class="fh-lk"','class="ex-prev"');
  const top=`<section class="mx-s ex-hero">${prevLk}<small class="ex-eb">${g(hh,/<span class="lbl">([^<]*)/)}</small><h2 class="n7-h">${v}</h2><p class="ex-dates">${line}</p><div class="ex-wk ex-rv2">${tubes}</div></section>`;
  const parts=cs.slice(1).map(c=>{const R=rowsR(c.html),hd=c.head||'';
    if(/Mihez/.test(hd)){const trend=g(c.html,/<p class="fh-note">(A javulás[^<]*)/);return `<section class="mx-s ln">${KH('Múlt héthez képest','',`<span class="ex-cnt">${hd.split(' · ').slice(1).join(' · ')}</span>`)}
      <div class="ex-rt">${R.map(r=>`<div><small>${r.title.replace('Ø RIR','Átlag RIR')}</small><b>${r.v.replace(/<small>([^<]*)<\/small>/,'<em class="up">$1</em>')}</b><em>${r.sub.replace(/ · .*$/,'')}</em></div>`).join('')}</div>${trend?`<div class="ex-mz">${badge('mezo',{s:30})}<p>${trend}</p></div>`:''}</section>`}
    if(/Medál/.test(hd))return `<section class="mx-s ln">${KH('Medálok','',`<span class="ex-cnt">${hd.split(' · ').slice(1).join(' · ')}</span>`)}<div class="ex-mr">${R.map(r=>{const [kind,prev]=r.sub.split(' · előző: ');return /célszett/.test(r.title)?recCard(r.title,'célszettek',r.sub,''):recCard(r.title,kind,r.v,prev)}).join('')}</div>${dots(Math.max(1,R.length-1))}</section>`;
    if(/Küldet/.test(hd))return `<section class="mx-s ln">${KH('Küldetések')}<div class="ex-pl">${R.map(r=>{const ok=/ok/.test(r.st);return `<article class="ex-plc ex-qd ${ok?'ok':''}"><span class="mt-bub">${I(ok?'t-tick':'t-flag')}</span><b>${r.title}</b><small>${ok?'megvan':'nem jött össze, nem baj'}</small></article>`}).join('')}</div></section>`;
    if(/Gyakorlaton/.test(hd))return `<section class="mx-s ln">${KH('Gyakorlatonként')}<div class="ex-xl">${R.map(r=>`<button class="ex-xr2" data-go="${r.go||'review.gyak'}">${r.chip.replace('mchp sm','mchp')}<span class="g"><b>${r.title}</b><small>${r.sub.replace(/ · .*$/,'')}${/jegyzet/.test(r.sub)?' · jegyzet':''}</small></span><span class="r">${/Rekord/.test(r.st)?'<i>rekord</i>':''}${r.caps}</span></button>`).join('')}</div></section>`;
    if(/írtál/.test(hd))return `<section class="mx-s ln">${KH('Amit aznap írtál','',`<button class="fh-lk" data-sheet="wnote">Szerkesztés ›</button>`)}<blockquote class="ex-quote">${g(c.html,/<p class="fh-txt">([^<]*)/)}</blockquote></section>`;
    return `<section class="mx-s ln">${hd?KH(hd):''}<div class="ex-keep">${pills(c.html)}</div></section>`}).join('');
  const help=base.slice(0,cs[0].start).replace(/data-toast="Kalauz ehhez az oldalhoz"/,'data-toast="A csövön a szaggatott vonal a múlt heti szint. A riport sosem büntet: a kimaradt szett üres kapszula, a kihagyott küldetés halk."');
  return help+`${DEFS}<div class="mx ex">${top}${parts}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
ed.routes.review=review3;
function cer3(a){if(a)return O.cer(a);
  const base=O.cer(a),ri=base.indexOf('<div id="cerroot">');if(ri<0)return base;const re=bal(base,ri),root=base.slice(ri,re);
  const si=root.indexOf('<section'),stage=root.slice(si,bal(root,si,'section')).replace('class="fh-card fh-hero vs-cer"','class="fh-card fh-hero vs-cer ex-stage"');
  const cs=cardsOf(root),rec=cs.find(c=>/vs-qt/.test(c.html)),num=cs.find(c=>/data-c=/.test(c.html)),qs=cs.find(c=>/vs-qc/.test(c.html)),RM=REVM();
  const recs=rec?rowsR(rec.html).map(r=>{const kind=g(r.sub,/<\/span>([^<]*)<\/span>$/)||g(r.sub,/svg><\/span>([^<]*)/),pm=RM.find(x=>x.title===r.title&&x.sub.startsWith(kind));return recCard(r.title,kind,r.v,pm?pm.sub.split(' · előző: ')[1]:'')}).join(''):'';
  const nums=num?[...num.html.matchAll(/<div><b([^>]*)>([^<]*)<\/b><small>([^<]*)<\/small><\/div>/g)].map(m=>`<span><b${m[1]}>${m[2]}</b><small>${m[3].replace(' · becslés','')}</small></span>`).join(''):'';
  const qd=qs?rowsR(qs.html).map(r=>{const ok=/ok/.test(r.st);return `<article class="ex-plc ex-qd ${ok?'ok':''}"><span class="mt-bub">${I(ok?'t-tick':'t-flag')}</span><b>${r.title}</b><small>${r.sub.replace(/ · .*$/,'')}: ${ok?'teljesült':'nem jött össze'}</small></article>`}).join(''):'';
  const skip=qs?g(qs.html,/<p class="fh-note">([^<]*)/):'';
  const body=`<div id="cerroot" class="mx ex">${DEFS}${stage}
    <div class="vs-cres"><section class="mx-s ln">${KH(`${(rec&&rec.head||'').split(' · ')[1]||'Új rekordok'}`)}<div class="ex-mr">${recs}</div></section></div>
    <div class="vs-ccard"><section class="mx-s ln">${KH('A mai számok')}<div class="ex-facts ex-f3 ex-n6">${nums}</div></section>
    ${qd?`<section class="mx-s ln">${KH('Küldetések')}<div class="ex-pl">${qd}</div>${skip?`<p class="ex-say">${skip}</p>`:''}</section>`:''}<div class="ng-tail"></div></div></div>`;
  return base.slice(0,ri)+body+base.slice(re)}
ed.routes.cer=cer3;

/* ═══ SPORT + FUTÁS (2026-11-01): sentence on top, the week's (sport) or the block's (futás) tubes as the picture with
   no card, one wide action; sport: only the days with a session, as a carousel (owner: "legyen az első"), one-off
   events as cards, the "independent rhythm" box as Mezo's line; futás: each run a card with its interval drawing and
   one short line instead of chips, cross-load as Mezo's line. The inner tabs stay; their pages come next. ═══ */
const heroParts=hh=>{const vi=hh.indexOf('<div class="k2-vials'),F3=[...hh.matchAll(/<div><b>([^<]*)<\/b><small>([^<]*)<\/small><\/div>/g)].map(m=>[m[1],m[2]]);
  return {lbl:g(hh,/<span class="lbl">([^<]*)/),v:g(hh,/<p class="verdict"[^>]*>([^<]*)/),sub:g(hh,/<p class="sub">([^<]*)/),tubes:vi>=0?hh.slice(vi,bal(hh,vi)):'',F3,act:g(hh,/<div class="fh-acts">(<button[\s\S]*?<\/button>)/)}};
const segOf=h=>{const i=h.indexOf('<div class="vs-seg');return i<0?'':`<div class="ex-seg">${h.slice(i,bal(h,i)).replace(/ rise"/,'"')}</div>`};
function sport3(a){if(a&&a!=='terv')return O.sport(a);
  const base=O.sport(a),cs=cardsOf(base);if(cs.length<2)return base;const H=heroParts(cs[0].html);
  const done=g(H.v,/^(\d+)/),of=g(H.v,/a (\d+)-ból/);
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${H.lbl}</small><h2 class="n7-h">A héten ${done} röpi megvolt a ${of}-ból.</h2>
    <p class="ex-dates">${H.F3.map(([b,sm])=>`${b} ${sm.replace(' · 1–10','').replace('pályán e héten','a pályán')}`).join(' · ')}</p>
    <div class="ex-wk ex-swk">${H.tubes}</div><div class="ex-acts"><button class="n9-btn" data-go="sportlog">Sport naplózása</button></div></section>${segOf(base)}`;
  const rc=cs.find(c=>/vs-day/.test(c.html)),ev=cs.find(c=>/evdel/.test(c.html));
  const DAYF={K:'Kedd',Cs:'Csütörtök',Szo:'Szombat',H:'Hétfő',Sze:'Szerda',P:'Péntek',V:'Vasárnap'};
  const days=rc?rc.html.split('<div class="fh-row ').slice(1).filter(r=>!/^ muted/.test(r)).map(r=>{const d=g(r,/<span class="vs-day">([^<]*)/),st=g(r,/<strong>([^<]*)/).trim(),tags=[...r.matchAll(/<span class="st ([a-z]+)">([^<]*)<\/span>/g)].map(m=>m[2]),sm=g(r,/<small>([^<]*)/),today=tags.includes('Ma');
    return `<article class="ex-dc2 ${today?'now':''}"><small>${DAYF[d]||d}${today?' · ma':''}</small><b>${st.replace('p',' perc').replace(' · ',', ')}</b><span class="ex-dsp">${I('t-volley')}${tags.filter(t=>t!=='Ma').join(' · ')}</span><em>${sm.split(' · ').join(' · ')}</em>${today?`<button class="n9-btn" data-sheet="sportlog">Naplózom</button>`:''}</article>`}).join(''):'';
  const nDays=(days.match(/ex-dc2/g)||[]).length;
  const why=rc?g(rc.html,/<div class="vs-box">[\s\S]*?<p>([^<]*)<\/p>/):'';
  const rhythm=rc?`<section class="mx-s ln">${KH(rc.head||'Heti ritmus')}<div class="ex-mr">${days}</div>${nDays>1?dots(nDays-1):''}${why?`<div class="ex-mz">${badge('mezo',{s:30})}<p>${why.replace('A röplabda a saját heti rendjén megy, a mesociklustól függetlenül. ','A röpi a saját heti rendjén megy, a mesociklustól függetlenül. ')}</p></div>`:''}</section>`:'';
  const evs=ev?`<section class="mx-s ln">${KH(ev.head||'Egyszeri események')}<div class="ex-ml">${ev.html.split('<div class="fh-row ').slice(1).map(r=>`<div class="ex-mrow"><svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${V.icd({ic:'t-calendar'})}</svg><span class="g"><small>${g(r,/<strong>([^<]*)/).trim()}</small><b>${g(r,/<small>([^<]*)/)}</b></span>${g(r,/(<button class="fh-lk[^"]*" data-ve="evdel:\d+"\s*>[^<]*<\/button>)/).replace(/class="fh-lk[^"]*"/,'class="ex-qw"').replace('>törlés<','>Törlés<')}</div>`).join('')}</div>
    <div class="ex-acts"><button class="n8-b" data-sheet="sportev">Új egyszeri esemény</button></div></section>`:'';
  const before=base.slice(0,cs[0].start),after=base.slice(cs[cs.length-1].end);
  return before+`${DEFS}<div class="mx ex">${top}${rhythm}${evs}<div class="ng-tail"></div></div>`+after}
ed.routes.sport=sport3;
function futas3(a){if(a&&a!=='het')return O.futas(a);
  const base=O.futas(a),cs=cardsOf(base);if(cs.length<2)return base;const H=heroParts(cs[0].html);
  const wk=g(H.v,/(\d+)\. hetében/),of=g(H.v,/(\d+) hetes/),dn=g(H.sub,/(\d+) \/ (\d+) edzés/),dt=g(H.sub,/\d+ \/ (\d+) edzés/),blk=H.sub.split(' · ')[0];
  const act=H.act.replace(/class="btn "/,'class="n9-btn"').replace('Pótold · ','Pótolom: ');
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">${blk} · ${H.lbl}</small><h2 class="n7-h">A ${of} hetes blokk ${wk}. hetében jársz, a héten még ${dn} a ${dt} futásból.</h2>
    <div class="ex-wk ex-swk">${H.tubes}</div><div class="ex-acts">${act}</div></section>${segOf(base)}`;
  const rc=cs.find(c=>/vs-ivl/.test(c.html)),cl=cs.find(c=>/levonunk|Comb/.test(c.html));
  const runs=rc?rc.html.split('<div class="vs-log">').slice(1).map(r=>{const bt=g(r,/(<button class="fh-lk"[^>]*>[^<]*<\/button>)/),ivl=g(r,/(<span class="vs-ivl"[\s\S]*?<\/span>)<div/),chips=[...r.matchAll(/<span class="tx">([^<]*)<\/span>/g)].map(m=>m[1].replace(/(\d+)p /,"$1′ ").replace('／','/'));
    return `<article class="ex-run"><div class="t">${I('t-sprint')}<div><b>${g(r,/<strong>([^<]*)/)}</b><small>${g(r,/<small>([^<]*)/)}</small></div></div>${ivl}<p>${chips.join(' · ')}</p>
      ${bt?bt.replace(/class="fh-lk"/,'class="n9-btn"').replace(/>[^<]*<\/button>$/,'>Pótolom</button>'):`<button class="n8-b" data-sheet="runlog">Naplózom</button>`}</article>`}).join(''):'';
  const runsS=rc?`<section class="mx-s ln">${KH(rc.head||'E hét')}<div class="ex-ml">${runs}</div></section>`:'';
  const clS=cl?`<section class="mx-s ln">${KH('Keresztterhelés')}<div class="ex-mz">${badge('mezo',{s:30})}<p><b>${g(cl.html,/<strong>([^<]*)/)}.</b> ${g(cl.html,/<small>([^<]*)/)}</p></div></section>`:'';
  return base.slice(0,cs[0].start)+`${DEFS}<div class="mx ex">${top}${runsS}${clS}<div class="ng-tail"></div></div>`+base.slice(cs[cs.length-1].end)}
ed.routes.futas=futas3;

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
${P} .ex-fig small{margin-top:6px;font-size:13px;color:var(--ink);text-align:center}
/* round 3 (owner, 2026-10-19): the body on the left, the three facts stacked beside it, the buttons below */
${P} .ex-row{display:flex;align-items:center;gap:14px;margin:14px 22px 0}
${P} .ex-row .ex-fig{flex:0 0 46%;margin:0}${P} .ex-row .ex-fig .vs-body{width:100%;max-width:150px}
${P} .ex-facts{flex:1;min-width:0;display:grid;gap:8px}
${P} .ex-facts span.tx b{font:700 16px/1.25 var(--ff,inherit);letter-spacing:0}
${P} .ex-facts span{flex-direction:row!important;align-items:baseline!important;gap:6px;flex-wrap:wrap}
${P} .ex-facts span{display:flex;flex-direction:column;align-items:flex-start;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.85);box-shadow:0 8px 20px -16px rgba(30,70,140,.4)}
${P} .ex-facts b{font:800 22px/1.1 var(--disp,inherit);letter-spacing:-.4px;color:var(--ink)}${P} .ex-facts small{font-size:13px;color:var(--ink)}
${P} .ex-x{margin:14px 22px 0}${P} .ex-x .vs-box{margin-top:0}
${P} .ex-acts{display:flex;flex-wrap:wrap;gap:8px;margin:16px 22px 0}
${P} .ex-acts .n9-btn,${P} .ex-acts .n8-b{margin:0;min-height:48px}${P} .ex-acts .n9-btn{flex:1;min-width:150px}
${P} .ex-rd .k2-vials{margin:6px 18px 0}
${P} .ex-mz{display:flex;gap:10px;align-items:flex-start;margin:16px 22px 0}${P} .ex-mz>.csepp,${P} .ex-mz>span{flex:none}
${P} .ex-mz p{margin:0;font-size:14.5px;line-height:1.5;color:var(--ink)}${P} .ex-mz p+p{margin-top:6px}
${P} .ex-cards{display:grid;gap:12px;margin:0 18px}${P} .ex-cards .n8-c{margin:0}
${P} .ex-said{font-size:13.5px}${P} .n8-c .st{font-size:12px!important}
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
${P} .ex-empty .ng-pipe,${P} .ex-empty .ng-flow,${P} .ex-empty .ng-drip{display:none}${P} .ex-empty{display:flex;align-items:center;gap:14px;margin:16px 22px 0}${P} .ex-empty svg.ng{flex:none;width:96px;height:96px;margin:0}${P} .ex-empty p{margin:0;font-size:15.5px;line-height:1.5;color:var(--ink)}
${P} .ex-duo{display:flex;justify-content:center;margin:14px 22px 0}${P} .ex-duo .vs-duo{display:flex;gap:10px;justify-content:center;width:100%}${P} .ex-duo .vs-body{width:42%;max-width:150px}${P} .ex-duo .vs-body svg{width:100%;height:auto;display:block}
${P} .ex-f3{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));margin:16px 22px 0}${P} .ex-f3 span{flex-direction:column!important;align-items:flex-start!important;gap:0}
${P} .ex-g5 .k2-vials{gap:4px!important}${P} .ex-g5 .ex-mc .mchp{width:38px;height:38px}${P} .ex-g5 .k2-tube{width:46px!important}${P} .ex-g5 .k2-tube em:not(:empty){color:#A86A0C!important;background:#fff;font-size:12px!important}
${P} .ex-gc .mchp{width:72px;height:72px;flex:none}${P} .ex-grp .dv-top{align-items:center;gap:14px}
${P} .ex-gfig{display:flex;justify-content:center;gap:12px;margin:10px 0 4px}${P} .ex-gfig .vs-body{width:38%;max-width:132px}${P} .ex-gfig .vs-body svg{width:100%;height:auto;display:block}
${P} .ex-gp{margin:6px 0 0}${P} .ex-fam{margin-top:10px}${P} .ex-fam>b{display:block;margin:0 0 6px;font-size:14px;font-weight:750;color:var(--ink)}${P} .ex-gp .k2-vial small i{white-space:nowrap}${P} .ex-gp .k2-vial small i{display:block;font-style:normal;font-weight:600;color:var(--ink)}${P} .ex-gp .k2-vial small u.lag{text-decoration:none;font-weight:700;color:#A86A0C}${P} .ex-gp .k2-tube{width:52px!important;margin:0 auto}${P} .ex-gp .k2-tube em:not(:empty),${P} .ex-g5 .k2-tube em:not(:empty){color:#A86A0C!important;background:#fff;font-size:12px!important;white-space:nowrap}
${P} .ex-seg{margin:14px 22px 0}${P} .ex-seg .fh-seg{margin:0}${P} .ex-seg .fh-seg button{min-height:44px}
${P} .ex-map{margin:14px 10px 0;cursor:pointer}${P} .ex-map .vs-duo{display:flex;justify-content:center;gap:8px}${P} .ex-map .vs-body{width:47%;max-width:180px}${P} .ex-map .vs-body svg{width:100%;height:auto;display:block}
${P} .ex-sides{display:flex;justify-content:space-around;margin-top:4px;font-size:13px;color:var(--ink)}
${P} .ex-tip{margin:10px 22px 0;font-size:14px;color:var(--ink);text-align:center}
${P} .ex-gb{display:flex;gap:8px;overflow-x:auto;padding:14px 18px 6px;scrollbar-width:none}
${P} .ex-gb button{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:84px;padding:10px 10px 8px;border-radius:20px;background:#fff;box-shadow:0 8px 18px -14px rgba(30,70,140,.45),inset 0 0 0 1px rgba(10,42,60,.07)}
${P} .ex-gb .mchp{width:40px;height:40px}${P} .ex-gb b{font-size:14px;font-weight:750;color:var(--ink);white-space:nowrap}${P} .ex-gb small{font-size:12px;color:var(--ink)}
${P} .ex-wcc{flex:none;display:grid;place-items:center;width:72px}${P} .ex-wcc .mchp{width:60px;height:60px}
${P} .ex-sw{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin:14px 12px 0}
${P} .ex-sw::before{content:"";position:absolute;left:10%;right:10%;top:30px;height:2px;border-radius:2px;background:linear-gradient(90deg,var(--liq1),var(--liq2));opacity:.3}
${P} .ex-sw>button{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0;padding:0;text-align:center}
${P} .ex-sw svg.ng{width:58px;height:58px;margin:0 0 4px}${P} .ex-sw .ng-pipe,${P} .ex-sw .ng-flow{display:none}
${P} .ex-sw .ng-nd{fill:var(--dom)!important;filter:drop-shadow(0 4px 5px color-mix(in srgb,var(--dom) 35%,transparent))!important}${P} .ex-sw .miss .ng-line{stroke:#C2453B;stroke-dasharray:3 3}${P} .ex-sw .today svg.ng{filter:drop-shadow(0 0 6px color-mix(in srgb,var(--dom) 45%,transparent))}
${P} .ex-sw small{font-size:12px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}${P} .ex-sw b{font-size:13px;font-weight:750;color:var(--ink)}${P} .ex-sw em{font-style:normal;font-size:12px;color:var(--ink)}
${P} .ex-sw i{font-style:normal;font-size:12px;font-weight:700}${P} .ex-sw i.ok{color:#2E8B57}${P} .ex-sw i.bad{color:#C2453B}${P} .ex-sw i.now{color:#1F6FEB}${P} .ex-sw i.q{color:var(--ink)}
${P} .ex-swb{display:flex;align-items:center;gap:14px;margin:18px 22px 0}${P} .ex-swb .vs-body{flex:none;width:92px}${P} .ex-swb .vs-body svg{width:100%;height:auto;display:block}
${P} .ex-swb ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}${P} .ex-swb li{display:flex;align-items:center;gap:10px;font-size:14px;line-height:1.35;color:var(--ink)}${P} .ex-swb li svg.ic{flex:none;width:28px;height:28px}${P} .ex-swb li b{display:block;font-weight:750}
${P} .ex-mr{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 18px;padding:16px 18px 10px;scrollbar-width:none}
${P} .ex-mc2{flex:0 0 150px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:14px;border-radius:24px;background:#fff;text-align:left;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-mc2 svg.ng{width:54px;height:54px;margin:0 0 6px}${P} .ex-mc2 .ng-pipe,${P} .ex-mc2 .ng-flow{display:none}${P} .ex-mc2 .ng-nd{fill:var(--dom)!important}
${P} .ex-mc2 small{font-size:12px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}${P} .ex-mc2 b{font-size:15px;font-weight:750;line-height:1.25;color:var(--ink)}${P} .ex-mc2 em{font-style:normal;font-size:13px;color:var(--ink)}${P} .ex-mc2 span{margin-top:6px;font:800 17px/1.1 var(--disp,inherit);color:var(--ink)}
${P} .ex-srch{margin:0 18px}${P} .ex-srch .fh-pills{margin-top:12px;flex-wrap:wrap}${P} .ex-srch .fh-pill{min-height:40px}
${P} .ex-xg{margin:0 18px 18px;padding:6px 16px 4px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-xgh{display:flex;align-items:center;gap:10px;padding:10px 0}${P} .ex-xgh .mchp{width:40px;height:40px;flex:none}${P} .ex-xgh b{font:800 17px/1.2 var(--disp,inherit);color:var(--ink)}${P} .ex-xgh small{margin-left:auto;font-size:13px;color:var(--ink)}
${P} .ex-xr{display:flex;align-items:center;gap:10px;width:100%;min-height:56px;padding:10px 0;text-align:left;border-top:1px solid rgba(10,42,60,.07)}
${P} .ex-xr .g{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}${P} .ex-xr .g b{font-size:15px;font-weight:750;color:var(--ink)}${P} .ex-xr .g small{font-size:13px;color:var(--ink)}
${P} .ex-xr .g i{font-style:normal;font-size:12.5px;font-weight:700}${P} .ex-xr i.new{color:#C76A12}${P} .ex-xr i.up{color:#2E8B57}${P} .ex-xr i.flat{color:#4A6070}${P} .ex-xr i.none{color:#4A6070;font-weight:500}
${P} .ex-xr .v{font:800 17px/1 var(--disp,inherit);color:var(--ink);white-space:nowrap}${P} .ex-xr .v u{text-decoration:none;font-size:13px;font-weight:600}
${P} .ex-xr svg.ch{flex:none;width:18px;height:18px;fill:none;stroke:#8AA0B0;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}${P} .ex-xr.off .g b{color:#4A6070}
${P} .ex-sb{display:flex;align-items:center;gap:10px;margin:16px 18px 0;padding:0 16px;min-height:50px;border-radius:999px;background:#fff;box-shadow:0 8px 18px -14px rgba(30,70,140,.45),inset 0 0 0 1px rgba(10,42,60,.08)}
${P} .ex-sb svg{flex:none;width:20px;height:20px;fill:none;stroke:#4A6070;stroke-width:2;stroke-linecap:round}${P} .ex-sb input{flex:1;min-width:0;border:0;background:transparent;font:500 16px/1.2 inherit;color:var(--ink);outline:none}
${P} .ex-whs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:16px 14px 6px}
${P} .ex-wh{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;padding:0;background:none}${P} .ex-wh .mchp{width:min(52px,100%);height:auto;aspect-ratio:1;transition:transform .2s}
${P} .ex-wh b{font-size:13px;font-weight:700;color:var(--ink)}${P} .ex-wh small{font-size:12px;color:var(--ink)}${P} .ex-wh.on .mchp{box-shadow:0 0 0 3px #fff,0 0 0 5px var(--dom);transform:scale(1.06)}${P} .ex-wh.on b{color:color-mix(in srgb,var(--dom) 85%,var(--ink))}
${P} .ex-xl{display:grid;gap:10px;margin:12px 18px 0}${P} .ex-xgl{margin:8px 4px 0;font-size:13px;font-weight:750;color:var(--ink)}
${P} .ex-xc{display:grid;grid-template-columns:44px minmax(0,1fr) auto;grid-template-areas:"c g v" "f f f";align-items:center;column-gap:12px;row-gap:6px;width:100%;padding:14px 16px;border-radius:22px;background:#fff;text-align:left;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-xc .mchp{grid-area:c;align-self:start;width:44px;height:44px}${P} .ex-xc .g{grid-area:g;min-width:0;display:flex;flex-direction:column}${P} .ex-xc .g b{font-size:15.5px;font-weight:750;line-height:1.25;color:var(--ink)}${P} .ex-xc .g small{font-size:13px;color:var(--ink)}
${P} .ex-xc .v{grid-area:v;font:800 20px/1 var(--disp,inherit);color:var(--ink);white-space:nowrap}${P} .ex-xc .v u{text-decoration:none;font-size:13px;font-weight:600}
${P} .ex-xf{grid-area:f;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding-top:10px;border-top:1px solid rgba(10,42,60,.07)}${P} .ex-xc .g i{align-self:flex-start;margin-top:6px}${P} .ex-last{font-size:13.5px;color:var(--ink)}${P} .ex-last b{font-weight:750}${P} .ex-xc .v small{display:block;margin-top:4px;font-family:var(--body,system-ui);font-size:12px;font-weight:600;line-height:1;text-align:right}${P} .ex-sp{flex:1;min-width:0;width:100%;height:30px}
${P} .ex-xf i,${P} .ex-xc .g i{flex:none;font-style:normal;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap}
${P} .ex-xc i.new{background:#FFF0E0;color:#A65511}${P} .ex-xc i.up{background:#E4F4EA;color:#23704A}${P} .ex-xc i.flat{background:#EEF2F5;color:#3F5566}
${P} .ex-xc.off{grid-template-columns:44px minmax(0,1fr) 18px;grid-template-areas:"c g ch";box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.14);background:rgba(255,255,255,.6)}${P} .ex-xc.off .g i{align-self:flex-start;margin-top:6px;background:#EEF2F5;color:#3F5566}
${P} .ex-xc svg.ch{grid-area:ch;width:18px;height:18px;fill:none;stroke:#8AA0B0;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
${P} .ex-mc2 i{margin-top:4px;font-style:normal;font-size:12.5px;font-weight:700;color:#23704A}${P} .ex-mc2.goal .ng-nd{fill:#3E9E6A!important}
${P} .ex-kg{display:flex;align-items:center;gap:12px;margin:14px 22px 0}${P} .ex-kg .mchp{width:52px;height:52px}${P} .ex-kg b{font:800 44px/1 var(--disp,inherit);color:var(--ink)}${P} .ex-kg b u{text-decoration:none;font-size:15px;font-weight:600}
${P} .ex-chart{margin:8px 12px 0}${P} .ex-chart text{font-size:13.5px}${P} .ex-chart .vs-hg{margin:0}
${P} .ex-rt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 18px}${P} .ex-rt>div{display:flex;flex-direction:column;gap:2px;padding:12px 10px;border-radius:20px;background:#fff;box-shadow:0 8px 18px -14px rgba(30,70,140,.45),inset 0 0 0 1px rgba(10,42,60,.07)}
${P} .ex-rt b{font:800 17px/1.15 var(--disp,inherit);color:var(--ink)}${P} .ex-rt small{font-size:12.5px;font-weight:650;color:var(--ink)}${P} .ex-rt em{font-style:normal;font-size:12px;color:var(--ink)}
${P} .ex-mg .ex-acts{margin-top:0}
${P} .ex-shelf{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px 4px;margin:16px 16px 0}${P} .ex-shelf i{display:grid;place-items:center}${P} .ex-shelf svg.ng{width:100%;max-width:46px;height:auto;margin:0}
${P} .ex-shelf .ng-pipe,${P} .ex-shelf .ng-flow,${P} .ex-mrow .ng-pipe,${P} .ex-mrow .ng-flow{display:none}${P} .ex-shelf .ng-nd,${P} .ex-mrow .ng-nd{fill:var(--dom)!important}${P} .ex-shelf i:not(.new){opacity:.75}
${P} .ex-cnt{font-size:13px;color:var(--ink)}${P} .ex-ml{display:grid;gap:10px;margin:0 18px}
${P} .ex-mrow{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:22px;background:#fff;text-align:left;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-mrow svg.ng{flex:none;width:46px;height:46px;margin:0}${P} .ex-mrow.goal .ng-nd{fill:#3E9E6A!important}${P} .ex-mrow .g{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
${P} .ex-mrow .g small{font-size:12px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}${P} .ex-mrow .g b{font-size:15px;font-weight:750;color:var(--ink)}${P} .ex-mrow .g i{font-style:normal;font-size:12.5px;font-weight:700;color:#23704A}
${P} .ex-mrow .v{font:800 15px/1.1 var(--disp,inherit);color:var(--ink);text-align:right;max-width:92px}${P} .ex-foot{margin-top:18px}
${P} .ex-br{margin:14px 10px 0}${P} .ex-br .k2-vials{gap:4px!important}${P} .ex-br .ex-mc .mchp{width:38px;height:38px}${P} .ex-br .k2-tube{width:44px!important;margin:0 auto}
${P} .ex-br .k2-tube em:not(:empty){color:var(--dom)!important;background:#fff;font-size:14px!important}${P} .ex-br .k2-vial b{font-size:13px!important;white-space:nowrap}${P} .ex-br .k2-vial small{font-size:12px!important}
${P} .ex-notch{position:absolute;left:22%;right:22%;height:2px;border-radius:2px;background:rgba(10,42,60,.14);z-index:2}
${P} .ex-cards .n8-c p.ex-ws,${P} .ex-wl{display:block!important;-webkit-line-clamp:unset!important;overflow:visible!important}${P} .ex-wl{margin:6px 0 0;font-size:13.5px;line-height:1.4;color:#8A4B0C}
${P} .ex-qc{flex:0 0 220px;scroll-snap-align:start;display:flex;flex-direction:column;gap:4px;padding:16px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-qc.on{box-shadow:inset 0 0 0 2px var(--dom),0 12px 24px -16px var(--dom)}
${P} .ex-qc>small{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}${P} .ex-qi svg.ic{width:22px;height:22px}
${P} .ex-qc>b{font-size:15px;font-weight:750;color:var(--ink)}${P} .ex-qg{font:800 20px/1.15 var(--disp,inherit);color:var(--ink);min-height:46px}
${P} .ex-qb{height:10px;border-radius:999px;background:#EEF2F5;overflow:hidden;margin-top:4px}${P} .ex-qb i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--liq1),var(--liq2))}
${P} .ex-qc>em{font-style:normal;font-size:12.5px;color:var(--ink)}
${P} .ex-qa{display:flex;gap:8px;margin-top:10px}${P} .ex-qw{min-height:44px;padding:0 14px;border-radius:999px;background:#EEF2F5;font-size:14px;font-weight:650;color:var(--ink)}
${P} .ex-qt{flex:1;display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--dom) 55%,transparent);font-size:14px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}
${P} .ex-qt.on{background:var(--dom);color:#fff;box-shadow:none}
${P} .ex-tt{margin:6px 8px 0}${P} .ex-tt .ex-mc .mchp{width:32px;height:32px}${P} .ex-tt .k2-tube{width:40px!important}${P} .ex-tt .k2-vial{opacity:.8}
${P} .ex-tt .k2-vial.ex-cur{opacity:1}${P} .ex-tt .k2-vial.ex-cur .k2-tube{box-shadow:0 0 0 2.5px var(--dom)}${P} .ex-tt .k2-vial.ex-cur small{color:color-mix(in srgb,var(--dom) 85%,var(--ink))!important;font-weight:750}
${P} .ex-now{display:flex;align-items:center;gap:12px;margin:18px 22px 0}${P} .ex-now .mchp{width:56px;height:56px;flex:none}${P} .ex-now small{font-size:13px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}${P} .ex-now b{display:block;font:800 23px/1.15 var(--disp,inherit);color:var(--ink)}
${P} .ex-st{display:grid;grid-template-columns:30px repeat(3,minmax(0,1fr)) 48px;gap:8px 6px;align-items:center;padding:14px 12px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-st .h{font-size:12.5px;font-weight:700;color:var(--ink);text-align:center}${P} .ex-st .n{display:grid;place-items:center;width:30px;height:48px;border-radius:12px;font-size:13px;font-weight:750;color:var(--ink);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.14)}
${P} .ex-st .n.d{background:var(--c);color:#fff;box-shadow:none}${P} .ex-st .n.c{box-shadow:inset 0 0 0 2px var(--c)}
${P} .ex-st .v,${P} .ex-st .vin{display:grid;place-items:center;min-width:0;height:48px;border-radius:14px;font:800 18px/1 var(--disp,inherit);text-align:center;color:var(--ink)}
${P} .ex-st .v.d{background:color-mix(in srgb,var(--c) 14%,#fff)}${P} .ex-st .v.u{background:#F1F4F7;color:#7A8C99}${P} .ex-st .vin{width:100%;border:0;background:#fff;box-shadow:inset 0 0 0 2px var(--dom);outline:none}
${P} .ex-st .ok,${P} .ex-st .tk{display:grid;place-items:center;width:48px;height:48px;padding:0;border-radius:50%}${P} .ex-st .ok{background:#E4F4EA}${P} .ex-st .ok.record{background:#FFF0E0}${P} .ex-st .ok svg.ic{width:26px;height:26px}
${P} .ex-st .tk{background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 8px 16px -8px var(--dom)}${P} .ex-st .tk svg.ic{width:26px;height:26px;--ic:#fff;--ic2:rgba(255,255,255,.35);--icf:transparent}
${P} .ex-rf{align-items:center}${P} .ex-rv{position:relative;flex:none;width:22px;height:44px;border-radius:999px;background:#EEF2F5;overflow:hidden}${P} .ex-rv i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,var(--liq1),var(--liq2));transition:height 1s linear}
${P} .ex-rf .g{flex:1;min-width:0;display:flex;flex-direction:column}${P} .ex-rf .g b{font:800 22px/1 var(--disp,inherit);color:var(--ink)}${P} .ex-rf .g small{font-size:12.5px;color:var(--ink)}
${P} .ex-sf .n9-btn.ok{background:linear-gradient(135deg,#4CB27A,#2E8B57)}${P} .ex-xls{margin:8px 22px 0}${P} .ex-xls .vs-xl{font-size:13.5px!important}${P} .ex-alld{margin-top:14px;text-align:center;font-weight:650}
${P} .ex-cmp{margin:12px 22px 0;font-size:15px;color:var(--ink)}${P} .ex-cmp b{font-weight:800}${P} .ex-cmp i{font-style:normal;font-weight:750;color:#23704A}
${P} .ex-qlw{margin:10px 18px 0}${P} .ex-qlw .vs-ql{min-height:48px;width:100%}
${P} .ex-tls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 18px 0}${P} .ex-tl{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:64px;padding:8px 4px;border-radius:18px;background:#fff;box-shadow:0 8px 18px -14px rgba(30,70,140,.45),inset 0 0 0 1px rgba(10,42,60,.07)}
${P} .ex-tl svg.ic{width:26px;height:26px}${P} .ex-tl small{font-size:13px;font-weight:650;color:var(--ink)}
${P} .ex-sets{margin:14px 12px 0}${P} .ex-sets .vs-sets{margin:0}${P} .ex-sets .vs-sets .h{font-size:12.5px!important}${P} .ex-sets .vin,${P} .ex-sets .v{min-height:48px;font-size:18px!important}${P} .ex-sets .tk{width:48px;height:48px}${P} .ex-sf .n8-b,${P} .ex-sf .n9-btn{white-space:nowrap}
${P} .ex-sf{gap:8px}
${P} .ex-prev{display:inline-flex;align-items:center;min-height:40px;margin:0 22px 6px;padding:0 14px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1px rgba(10,42,60,.1);font-size:13.5px;font-weight:650;color:var(--ink)}
${P} .ex-rv2{margin:16px 10px 0}${P} .ex-rv2 .k2-vial small{font-size:12px!important}${P} .ex-rt em.up{font-style:normal;font-size:13px;color:#23704A;margin-left:4px}
${P} .ex-rc{flex-basis:190px}${P} .ex-qd small{font-size:13px}${P} .ex-qd.ok .mt-bub{background:#E4F4EA}
${P} .ex-xr2{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:22px;background:#fff;text-align:left;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-xr2 .mchp{flex:none;width:42px;height:42px}${P} .ex-xr2 .g{flex:1;min-width:0;display:flex;flex-direction:column}${P} .ex-xr2 .g b{font-size:15px;font-weight:750;line-height:1.25;color:var(--ink)}${P} .ex-xr2 .g small{font-size:13px;color:var(--ink)}
${P} .ex-xr2 .r{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px}${P} .ex-xr2 .r i{font-style:normal;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:#FFF0E0;color:#A65511}
${P} .ex-quote{margin:0 18px;padding:16px 18px;border-radius:22px;background:#fff;border-left:4px solid var(--dom);font-size:15px;line-height:1.5;color:var(--ink);box-shadow:0 10px 24px -16px rgba(10,42,60,.35)}
${P} .ex-n6{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}${P} .ex-n6 span{padding:12px 10px;border-radius:18px;background:#fff;box-shadow:0 8px 18px -14px rgba(30,70,140,.45),inset 0 0 0 1px rgba(10,42,60,.07)}${P} .ex-n6 b{font:800 20px/1.1 var(--disp,inherit)}${P} .ex-n6 small{font-size:12.5px}
${P} .ex-stage{background:none!important;box-shadow:none!important;border:0!important;margin:0 4px!important}${P} .ex-stage::after,${P} .ex-stage::before{display:none!important}${P} .ex-stage .lbl{font-size:12.5px!important}
${P} .ex-seg .fh-seg{display:flex;width:100%}${P} .ex-seg .fh-seg button{flex:1;min-width:0;min-height:44px;padding:0 3px;font-size:13px;letter-spacing:-.01em;white-space:nowrap}${P} .ex-swk{margin:14px 10px 0}${P} .ex-swk .k2-vial small{font-size:12px!important}${P} .ex-swk .k2-vial b{font-size:13px!important}${P} .ex-swk .k2-tube em{font-size:12px!important}
${P} .ex-dc2{flex:0 0 210px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-dc2.now{box-shadow:inset 0 0 0 2px var(--dom),0 12px 24px -16px var(--dom)}${P} .ex-dc2 small{font-size:12.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}${P} .ex-dc2 b{font:800 19px/1.2 var(--disp,inherit);color:var(--ink)}
${P} .ex-dsp{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:650;color:var(--ink)}${P} .ex-dsp svg.ic{width:24px;height:24px}${P} .ex-dc2 em{font-style:normal;font-size:13px;color:var(--ink)}${P} .ex-dc2 .n9-btn{margin-top:8px;width:100%}
${P} .ex-mrow .ex-qw{flex:none}
${P} .ex-run{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-run .t{display:flex;align-items:center;gap:10px}${P} .ex-run .t svg.ic{width:34px;height:34px;flex:none}${P} .ex-run .t b{display:block;font-size:16px;font-weight:750;color:var(--ink)}${P} .ex-run .t small{font-size:13px;color:var(--ink)}
${P} .ex-run p{margin:0;font-size:13.5px;line-height:1.45;color:var(--ink)}${P} .ex-run .vs-ivl{margin:0}${P} .ex-run>button{align-self:flex-start;min-width:140px}
${P} .ex-dates{margin:6px 22px 0;font-size:13.5px;color:var(--ink)}
${P} .ex-6 .k2-vial small{white-space:nowrap}${P} .ex-wk .k2-vial b u{font-size:12px!important}
${P} .ex-dcr{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 18px;padding:4px 18px 16px;scrollbar-width:none}
${P} .ex-dc{flex:0 0 142px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:14px;border-radius:24px;background:#fff;text-align:left;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-dc.now{box-shadow:inset 0 0 0 2px var(--dom),0 12px 24px -16px var(--dom)}
${P} .ex-dc.quiet{background:rgba(255,255,255,.7)}
${P} .ex-dc>small{font-size:12px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}${P} .ex-dc>b{font:800 17px/1.2 var(--disp,inherit);color:var(--ink)}
${P} .ex-dcp{display:flex;justify-content:center;align-items:center;width:100%;height:118px;margin:6px 0}${P} .ex-dcp .vs-body{width:64px}${P} .ex-dcp .vs-body svg{width:100%;height:auto;display:block}${P} .ex-dcp svg.ng{width:84px;height:84px;margin:0}
${P} .ex-dc>em{font-style:normal;font-size:12.5px;line-height:1.35;color:var(--ink);min-height:34px}${P} .ex-dc .st{margin-top:6px;font-size:12px!important}
${P} .ex-pl{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 18px}
${P} .ex-plc{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px;border-radius:24px;background:#fff;text-align:left;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .ex-plc b{margin-top:6px;font-size:15px;font-weight:750;color:var(--ink)}${P} .ex-plc small{font-size:13px;color:var(--ink)}
/* why drawer (sheets sit outside the phone scope's page, so these use the sheet's own class too) */
.ex-why .dv-top{position:relative}.ex-why .ex-x0{position:absolute;right:0;top:0;width:44px;height:44px;display:grid;place-items:center;padding:0;line-height:1;border-radius:50%;background:rgba(10,42,60,.06);font-size:20px;color:var(--ink)}
.ex-fb .ex-cl{margin:16px 0 8px;font-size:14px;font-weight:750;color:var(--ink)}.ex-fb .ex-cseg button{padding:0 6px}.ex-fb .dv-top b{font-size:22px!important;line-height:1.15!important}.ex-cat .dv-top b{font-size:24px!important;line-height:1.15!important}.ex-cat .ex-cl{margin:18px 0 8px;font-size:14px;font-weight:750;color:var(--ink)}.ex-cat .fh-in{width:100%}
.ex-cbody{display:flex;justify-content:center;gap:10px;cursor:pointer}.ex-cbody .vs-body{width:40%;max-width:130px}.ex-cbody .vs-body svg{width:100%;height:auto;display:block}
.ex-ctip{margin:8px 0 0;text-align:center;font-size:14px;color:var(--ink)}.ex-ctip b{font-weight:750}
.ex-cpp{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:10px}.ex-cpp button,.ex-cseg button{min-height:40px;padding:0 14px;border-radius:999px;background:#EEF2F5;font-size:14px;font-weight:650;color:var(--ink)}
.ex-cpp button.on,.ex-cseg button.on{background:var(--dom,#F07A2C);color:#fff}
.ex-cseg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:4px;border-radius:999px;background:#EEF2F5}.ex-cseg button{background:transparent}
.ex-cst{margin-top:14px}
.ex-why .ex-why-q{margin:14px 0 0!important;padding:0!important;font-size:24px}
.ex-why .ex-opts{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
.ex-why .ex-opts button{min-height:56px;padding:8px 10px;border-radius:18px;background:#fff!important;box-shadow:0 8px 18px -14px rgba(30,70,140,.45),inset 0 0 0 1px rgba(10,42,60,.07);font-size:14px;font-weight:650;color:var(--ink);text-align:left}
.ex-why .ex-opts button.on{background:color-mix(in srgb,var(--dom) 10%,#fff)!important;box-shadow:inset 0 0 0 2px var(--dom)}
.ex-why .ex-why-m{margin-top:14px}.ex-why .ex-why-m .fh-lab{display:block;margin:6px 0 8px;font-size:14px;font-weight:700;color:var(--ink)}
.ex-why .ex-why-m .fh-pill{min-height:40px;font-size:14px}
.ex-why .ex-why-n{margin:16px 0 0}.ex-why .ex-why-n p{font-size:14.5px}
.ex-why .ex-why-a{display:flex;flex-direction:column;gap:8px;margin-top:18px}.ex-why .ex-why-a .dv-btn{width:100%;margin:0}.ex-why .ex-why-a .n8-b{align-self:center;margin:0;min-height:44px}
.ex-why .ex-why-a .dv-btn[disabled]{opacity:.45}
${P} .ex-fl1{margin:12px 22px 0;font-size:15px;font-weight:600;color:var(--ink);text-align:center}
${P} .ex-wk{margin:16px 14px 0}${P} .ex-wk .k2-vials{gap:5px!important}${P} .ex-wk .k2-vial{min-width:0}${P} .ex-wk .k2-vial small,${P} .ex-wk .k2-vial b{font-size:12px!important}
${P} .ex-wk .k2-tube em{font-size:12px!important}
${P} .ex-wk .ex-today .k2-tube{box-shadow:0 0 0 3px color-mix(in srgb,var(--dom) 45%,#fff),0 10px 18px -10px var(--dom)}${P} .ex-wk .ex-today b,${P} .ex-wk .ex-today small{color:color-mix(in srgb,var(--dom) 85%,var(--ink))}
${P} .ds small{font-size:12px}${P} .ds i{font-size:12px}
${P} .mx-h .fh-lk{white-space:nowrap;flex:none}${P} .mx-h{gap:10px}
`);
window.FNOTES_FOLY=`<h2>Kísérlet · Edzés a Nap rendszerében</h2><p><a href="#w-edzes-mai"><b>Mai</b></a> — a mondat felül (benne a reggeli javaslat), a test a mai izmokkal, a reggeli három cső Mezo soraival, a többi alkalom kártyán, a keret egy mondatban, az izmok csövekben, a gyors indítások lapozva. A hét többi napja: a felső napsávban bármelyik napra bökve. Pihenőnap: <a href="#w-edzes-mai.pihen">sima</a> · <a href="#w-edzes-mai.pihen-sajat">saját edzés folyamatban</a> · <a href="#w-edzes-mai.pihen-sport">sportnap</a>. Összevetésnek: <a href="#w-edzes-mai-lista">a mostani Mai</a>.</p><p><a href="#w-edzes-terv"><b>Terv</b></a> — a hat hét csövei a kép, a hét napjai lapozható kártyákon, az izmok három csőben, a tervek két kártyán. Arcai: <a href="#w-edzes-terv.elso">első edzés előtt</a> · <a href="#w-edzes-terv.ures">még nincs terv</a> · <a href="#w-edzes-terv.nincs">nem fut terv</a>. Összevetésnek: <a href="#w-edzes-terv-lista">a mostani Terv</a>.</p><p><a href="#w-edzes-terheles"><b>Terhelés</b></a> — a test elölről és hátulról a kép, alatta a három szám; az izomcsoportok öt csőben, a sport három becsült csőben, a mozgás lapozva. <a href="#w-edzes-sport"><b>Sport</b></a> · <a href="#w-edzes-futas"><b>Futás</b></a> (<a href="#w-edzes-sport-lista">régi</a> · <a href="#w-edzes-futas-lista">régi</a>). <a href="#w-edzes-cer"><b>Edzés lezárva</b></a> · <a href="#w-edzes-review"><b>Összegzés</b></a> (<a href="#w-edzes-cer-lista">régi</a> · <a href="#w-edzes-review-lista">régi</a>). <a href="#w-edzes-session"><b>Edzés közben</b></a> — felül a telő csövek, a mostani gyakorlat, alul a két gomb (<a href="#w-edzes-session-lista">a mostani</a>). <a href="#w-edzes-indulas"><b>Eligazítás</b></a> — a mai sor csövekben, küldetések lapozva (<a href="#w-edzes-indulas-lista">a mostani</a>). <a href="#w-edzes-exercises"><b>Gyakorlatok</b></a> — csoportonként, kerékkel váltva; <a href="#w-edzes-exercise">egy gyakorlat</a> · <a href="#w-edzes-exercise.uj">még nincs alkalma</a> · <a href="#w-edzes-medals">medálok</a>. Összevetésnek: <a href="#w-edzes-exercises-lista">lista</a> · <a href="#w-edzes-exercise-lista">gyakorlat</a> · <a href="#w-edzes-medals-lista">medálok</a>. <a href="#w-edzes-terkep">Izomtérkép</a> (a test is bökhető) · <a href="#w-edzes-terkep.terv">a heti terv</a>. Arcai: <a href="#w-edzes-terheles.elotte">még előtted</a> · <a href="#w-edzes-terheles.megvan">letudva</a> · <a href="#w-edzes-terheles.ures">nincs terv</a>. Összevetésnek: <a href="#w-edzes-terheles-lista">a mostani Terhelés</a>.</p>`+(window.FNOTES_FOLY||'');
})();
