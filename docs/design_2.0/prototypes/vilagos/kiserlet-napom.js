/* vilagos/kiserlet-napom.js — EXPERIMENT (owner idea, 2026-10-11): Nap pages without cards, lists or a hero.
   NOT part of the build target: it is loaded only by ../kiserlet-napom-grafika.html, never by the shell
   (klinikai-iranyok.html), so the approved #w-nap-* routes stay what the builders read.
   Every page gets its OWN graphic, the one its content asks for (owner, round 5: the pipe is right for A napom
   and wrong everywhere else — do not reuse one device across pages):
     napom (+ nap.<date>)   the pipe: the day's liquid runs through six vessels, one per area
     mai                    the day as a flat line, filled up to now, with what is behind and ahead on it; the four
                            "Mai szintek" tubes (kept as they are); the day's jar, one layer per log entry
     uzenetek               depth: the newest message floats at the surface, older ones sink and fade
     uzenetek.eletjelek     the rack of six tubes; the team's remark hangs as a tag on the tube it is about
     uzenetek.eszrevetelek  communicating vessels: cause and effect joined by a pipe that fills with evidence days
     rutin                  a chain: vessels joined by chain links, three per row, any number of rows
   The approved list versions stay reachable as mai-lista / napom-lista / uzenetek-lista / rutin-lista.
   Data is copied from nap.js (NDT, NDY, RUTIN, messages): same numbers, same sentences. */
(function(){
const F=window.F,nap=window.FREG&&FREG.nap;if(!nap)return;
const {I,page,badge}=F;
const P='.phone.foly[data-s="elo"][data-d="nap"]';
const O={eletjel:nap.routes.eletjel,checkin:nap.routes.checkin,kuldetesek:nap.routes.kuldetesek,mai:nap.routes.mai,napom:nap.routes.napom,nap:nap.routes.nap,uzenetek:nap.routes.uzenetek,rutin:nap.routes.rutin};
const DROP='M32 6C41 19 50 28 50 39A18 18 0 0 1 14 39C14 28 23 19 32 6Z';
const MOON='M46 41A21 21 0 1 1 25 11A17 17 0 0 0 46 41Z';
const DUMB='M8 24A4 4 0 0 1 12 20H16A4 4 0 0 1 20 24V28H44V24A4 4 0 0 1 48 20H52A4 4 0 0 1 56 24V40A4 4 0 0 1 52 44H48A4 4 0 0 1 44 40V36H20V40A4 4 0 0 1 16 44H12A4 4 0 0 1 8 40Z';
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
let UID=0;const uid=()=>'ngc'+(++UID);
/* a liquid body clipped to a vessel: wave top at y, one wave period = 48 (the drift animation shifts by 48) */
const liq=(clip,y,g='dom')=>`<g clip-path="url(#${clip})"><path class="ng-wv" fill="url(#ng-g-${g})" d="M-48 ${y}${' q12 -5 24 0 t24 0'.repeat(5)} V120 H-48Z"/></g>`;
const drip=(x,y,dl=0)=>`<path class="ng-drip" style="--dl:${dl}s" transform="translate(${x} ${y})" d="M0 -6C3 -2 4.5 .5 4.5 3A4.5 4.5 0 0 1 -4.5 3C-4.5 .5 -3 -2 0 -6Z"/>`;
const pipe=d=>`<path class="ng-pipe" d="${d}"/><path class="ng-flow" d="${d}"/>`;
const svg=(h,inner,cls='')=>`<svg class="ng ${cls}" viewBox="0 0 360 ${h}" aria-hidden="true">${inner}</svg>`;
const DEFS=`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="ng-g-dom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#19C7C0"/><stop offset="1" stop-color="#1877F2"/></linearGradient>
  <linearGradient id="ng-g-ok" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FD3A0"/><stop offset="1" stop-color="#149E6E"/></linearGradient>
  <linearGradient id="ng-g-warn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3C969"/><stop offset="1" stop-color="#C98A12"/></linearGradient>
  <linearGradient id="ng-g-prot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0A29B"/><stop offset="1" stop-color="#D9605A"/></linearGradient>
  <linearGradient id="ng-g-arc" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="200" y2="0"><stop offset="0" stop-color="#1877F2"/><stop offset="1" stop-color="#19C7C0"/></linearGradient>
  <linearGradient id="ng-g-seg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#19C7C0"/><stop offset="1" stop-color="#1877F2"/></linearGradient></defs></svg>`;

/* ── the six vessels, each drawn in a 104×104 box; the pipe enters at (52,0) and leaves at (52,104).
      o.p = level 0–100, o.g = liquid colour (dom | ok | warn), the rest is the vessel's own second reading ── */
const V={
  /* Tápanyag — a bowl filled to the calories eaten, its rim is the day's budget; the egg is the protein */
  nutrition:o=>{const b=uid(),e=uid(),B='M8 40H96C96 74 78 90 52 90C26 90 8 74 8 40Z',E='M84 5C91 5 95.5 15 95.5 22.5A11.5 11.5 0 0 1 72.5 22.5C72.5 15 77 5 84 5Z';
    return `<defs><clipPath id="${b}"><path d="${B}"/></clipPath><clipPath id="${e}"><path d="${E}"/></clipPath></defs>
    ${pipe('M52 0V12')}${drip(52,22)}${drip(52,33,1.1)}
    <path class="ng-glass" d="M36 89H68L72 99H32Z"/><path class="ng-glass" d="${B}"/>${o.p?liq(b,90-48*cl(o.p,0,100)/100,o.g):''}
    <path class="ng-line" d="${B}"/><path class="ng-rim" d="M4 40H100"/><path class="ng-hi" d="M19 60C23 71 31 79 41 83"/>
    ${o.prot!=null?`<path class="ng-glass" d="${E}"/>${liq(e,34-29*cl(o.prot,0,100)/100,'prot')}<path class="ng-line" d="${E}"/>`:''}
    ${pipe('M52 99V104')}`},
  /* Minőség — a sprout: the left leaf is the unprocessed share, the right leaf the micronutrients */
  quality:o=>{const a=uid(),b=uid(),c=uid(),L1='M52 58C36 60 20 52 14 32C34 28 48 40 52 58Z',L2='M52 44C68 46 86 36 90 14C70 12 56 26 52 44Z',PT='M30 66H74L68 98H36Z';
    return `<defs><clipPath id="${a}"><path d="${PT}"/></clipPath><clipPath id="${b}"><path d="${L1}"/></clipPath><clipPath id="${c}"><path d="${L2}"/></clipPath></defs>
    ${pipe('M52 0V6')}${drip(52,16)}<path class="ng-stem" d="M52 66V30"/>
    <path class="ng-glass" d="${L1}"/>${o.a?liq(b,58-28*o.a/100,o.g):''}<path class="ng-line" d="${L1}"/>
    <path class="ng-glass" d="${L2}"/>${o.b?liq(c,44-31*o.b/100,o.g):''}<path class="ng-line" d="${L2}"/>
    <path class="ng-glass" d="${PT}"/>${o.p?liq(a,98-32*o.p/100,o.g):''}<path class="ng-line" d="${PT}"/><path class="ng-rim" d="M26 66H78"/><path class="ng-hi" d="M38 76L40 90"/>
    ${pipe('M52 98V104')}`},
  /* Edzés — a kettlebell: full when done, an empty one with a dashed wall while it is still ahead */
  training:o=>{const k=uid(),H='M40 39L36 20C35 12 40 8 46 8H58C64 8 69 12 68 20L64 39',open=o.g==='warn';
    return `<defs><clipPath id="${k}"><circle cx="52" cy="66" r="30"/></clipPath></defs>
    ${pipe('M52 0V8')}<path class="${open?'ng-open':'ng-rim'}" d="${H}"/>
    <circle class="ng-glass" cx="52" cy="66" r="30"/>${o.none?'':liq(k,open?91:96-60*cl(o.p,0,100)/100,o.g)}<circle class="${open?'ng-open':'ng-line'}" cx="52" cy="66" r="30"/>
    <path class="ng-hi" d="M32 56C35 48 41 43 48 41"/>${pipe('M52 96V104')}`},
  /* Alvás — a moon holding the night; the sparks are just the night sky */
  sleep:o=>{const m=uid(),T='translate(-3.65 -15.1) scale(2.1)';
    return `<defs><clipPath id="${m}"><path transform="${T}" d="${MOON}"/></clipPath></defs>
    ${pipe('M52 0V9')}<path class="ng-glass" transform="${T}" d="${MOON}"/>${o.p?liq(m,96-88*cl(o.p,0,97)/100,o.g):''}
    <path class="ng-line" transform="${T}" style="stroke-width:.95" d="${MOON}"/><path class="ng-hi" d="M17 62C20 74 28 83 39 88"/>
    <path class="ng-spark ${o.g}" d="M80 16L82.5 24.5L91 27L82.5 29.5L80 38L77.5 29.5L69 27L77.5 24.5Z"/><path class="ng-spark ${o.g}" d="M94 44L95.4 48.6L100 50L95.4 51.4L94 56L92.6 51.4L88 50L92.6 48.6Z"/>
    ${pipe('M52 95V104')}`},
  /* Logolás — small tubes on a rack, one per check-in of the day */
  logging:o=>{const xs=[16,40,64,88],tube=x=>`M${x-8} 38A8 8 0 0 1 ${x+8} 38V78A8 8 0 0 1 ${x-8} 78Z`,ids=xs.map(uid);
    return `<defs>${xs.map((x,i)=>`<clipPath id="${ids[i]}"><path d="${tube(x)}"/></clipPath>`).join('')}</defs>
    ${pipe('M52 0V12M16 30V18Q16 12 22 12H82Q88 12 88 18V30M40 12V30M64 12V30')}
    ${xs.map((x,i)=>i<o.n?`<path class="ng-glass" d="${tube(x)}"/>${liq(ids[i],40,o.g)}<path class="ng-line" d="${tube(x)}"/><path class="ng-hi" d="M${x-3.5} 46V66"/>`
      :`<path class="ng-glass" d="${tube(x)}"/><path class="ng-open q" d="${tube(x)}"/>`).join('')}
    <path class="ng-rim" d="M4 90H100"/>${pipe('M52 90V104')}`},
  /* a full drop with a white glyph: the thing to do now */
  drop:o=>`${pipe('M52 0V6')}<path class="ng-nd" transform="translate(-4 -6) scale(1.75)" d="${DROP}"/><path class="ng-hi" d="M30 60C32 50 37 42 43 35"/>
    <svg class="ic" x="35" y="45" width="34" height="34" viewBox="0 0 64 64" style="--ic:#fff;--ic2:rgba(255,255,255,.3);--icf:transparent"><use href="#${o.ic}"/></svg>${pipe('M52 93V104')}`,
  /* Ritmus — a coil: the pipe itself swings, and the liquid has climbed p% of it */
  rhythm:o=>{const d='M52 104C52 96 82 98 82 88S22 80 22 68S82 60 82 48S22 40 22 28S52 12 52 0';
    return `<path class="ng-coil a" d="${d}"/><path class="ng-coil b" d="${d}"/><path class="ng-coil c ${o.g}" pathLength="100" stroke-dasharray="${cl(o.p,0,100)} 100" d="${d}"/>`}
};
const wrap=(t,n)=>{const out=[];let cur='';t.split(' ').forEach(w=>{if((cur+' '+w).trim().length>n&&cur){out.push(cur);cur=w}else cur=(cur+' '+w).trim()});if(cur)out.push(cur);return out};
/* one station: the vessel on its side of the page, the words on the other */
function station(s,side,y){const L=side==='L',cx=L?72:288,tx=L?146:20,an='start';
  return `<g class="ng-st ${s.none?'none':''}" ${s.tap?`data-ngs="${s.key}" role="button" tabindex="0"`:s.attr?`${s.attr} role="button" tabindex="0"`:''}>${s.tap||s.attr?`<rect class="ng-hit" x="6" y="${y}" width="348" height="104"/>`:''}
    <g class="ng-ves" transform="translate(${cx-52} ${y})">${V[s.key](s.v)}</g>
    <text class="ng-t" x="${tx}" y="${y+30}" text-anchor="${an}">${s.title}${s.tag?`<tspan class="ng-k ${s.sk}" dx="7">${s.tag}</tspan>`:''}</text>
    <text class="ng-v" x="${tx}" y="${y+62}" text-anchor="${an}">${s.val}${s.unit?`<tspan class="ng-u" dx="4">${s.unit}</tspan>`:''}</text>
    ${s.sub.map((t,i)=>`<text class="ng-s" x="${tx}" y="${y+83+i*17}" text-anchor="${an}">${t}</text>`).join('')}
    ${s.go?`<g class="ng-pl"><rect x="${tx}" y="${y+76+s.sub.length*17}" width="112" height="32" rx="16"/><text x="${tx+56}" y="${y+97+s.sub.length*17}" text-anchor="middle">${s.go}</text></g>`:''}</g>`}
const badgeN=(x,y,n,t,an='start')=>`<g class="ng-b"><path transform="translate(${x-32*.66} ${y-34*.66}) scale(.66)" d="${DROP}"/><text x="${x}" y="${y+7.5}" text-anchor="middle">${n}</text></g>
  <text class="ng-h" x="${an==='start'?x+20:x-20}" y="${y+6}" text-anchor="${an}">${t}</text>`;
/* stations from y0, alternating sides; returns [svg, yEnd] — the S-bends between two stations are the dividers */
function stations(ST,y0,pitch=140){const cx=i=>i%2?288:72;
  const bends=ST.slice(0,-1).map((_,i)=>{const a=cx(i),b=cx(i+1),y=y0+pitch*i+104,g=pitch-104;return `M${a} ${y}C${a} ${y+g*.78} ${b} ${y+g*.22} ${b} ${y+g}`}).join('');
  return [pipe(bends)+ST.map((s,i)=>station(s,i%2?'R':'L',y0+pitch*i)).join(''),y0+pitch*(ST.length-1)+104]}
const wl=y=>`<path class="ng-wl" d="M18 ${y} q12 -6 24 0${' t24 0'.repeat(12)}"/>`;
const hd=(x,y,t)=>`<path class="ng-j" transform="translate(${x-32*.42} ${y-34*.42}) scale(.42)" d="${DROP}"/><text class="ng-h2" x="${x+22}" y="${y+7}">${t}</text>`;
const pill=(x,y,w,t,pri)=>`<g class="ng-pl ${pri?'pri':''}"><rect x="${x}" y="${y}" width="${w}" height="38" rx="19"/><text x="${x+w/2}" y="${y+24}" text-anchor="middle">${t}</text></g>`;
/* the wave line between the lead and the first section, with the pipe passing through */
const gap=h=>svg(h,wl(16)+pipe(`M72 0V${h}`));
const lead=(inner,cls='')=>`<div class="ng-lead ${cls}">${inner}</div>`;
/* a lighter full-width layer behind part of a drawing: groups a logical unit without a card (wave edge where it starts/ends) */
const band=(y0,y1,top=true,bot=true)=>{const w=' q12.5 -6 25 0 t25 0'.repeat(8),wb=' q-12.5 6 -25 0 t-25 0'.repeat(8);
  return `<path class="ng-band" d="M-20 ${y0}${top?w:'H380'}V${y1}${bot?wb:'H-20'}Z"/>`};
const WEEKX={'2026-09-21':0,'2026-09-22':1,'2026-09-23':2,'2026-09-24':3};
const topPipe=iso=>{const x=Math.round(25.7+51.43*WEEKX[iso]);return svg(40,pipe(`M${x} 0C${x} 30 72 12 72 40`),'ng-top')};
/* the approved page up to (not including) its hero: title bar, tabs, week strip */
function frame(arg,cut){const base=O.nap(arg);const a=base.search(cut),b=base.indexOf('</div><nav class="fh-nav"');return a<0||b<0?null:[base.slice(0,a)+DEFS,base.slice(b)]}

/* ═══ A NAPOM · a closed day (the overnight evaluation) ═══ */
const NDY={score:87,base:89,corr:-2,label:'A hét legjobb napja',
  dims:{nutrition:[100,'2 962 / 2 782 kcal · fehérje 162 / 166 g'],quality:[79,'nova 71% · mikro 100%'],training:[100,'2/2 edzés'],sleep:[79,'6 óra · minőség Q7'],logging:[85,'check-in 2/4 · étkezések időben'],rhythm:[64,'7/7 nap a héten']},
  weight:{nutrition:30,quality:15,training:20,sleep:15,logging:10,rhythm:10},
  chips:{nutrition:['kcal · 2962 / 2782','fehérje · 162 / 166 g','c · f · 379 g · 80 g','sáv · edzésnapi +150 kcal'],quality:['nova · 71%','mikro · 100%'],training:['edzés · 2 / 2'],sleep:['alvás · 6 h','minőség · Q7'],logging:['check-in · 2 / 4','időben · 100%'],rhythm:['ritmus · 7 / 7']},
  ctx:[['energia','5,5 / 10'],['súlytrend','+0,07 kg / hét'],['alváscél','2 napja elmarad'],['víz','jelölve']],
  prose:['A hét legjobb napja volt. Mindkét edzés megvolt, és a tányér is rendben volt: 2&nbsp;962 kcal az edzésnapi kerettel együtt, a fehérje pedig csak 4 g-mal maradt el a céltól. A mikrotápanyagok teljesen megvoltak.','Egy dolog lóg ki: két napja nem jön össze az alváscél. Tegnap is csak 6 óra lett, és ez az 5,5-ös energiádon is látszott. Ma este ez a legjobb befektetés.'],
  hl:[['A nap kulcsa','Minden mikrotápanyag megvolt'],['Felismert minta','Egész héten minden nap mozogtál'],['Jó irány','Mindkét edzés megvolt']],
  adj:'Levontam 2 pontot, mert a rövid alvás már második napja ismétlődik, és ez az energiádon is látszott.',
  notes:{nutrition:'180 kcal-lal a keret fölött, de edzésnapon ez belefér. A fehérje szinte pont a célon.',quality:'Jó arány: a nagy része feldolgozatlan étel volt, és a mikrotápanyagok is mind megvoltak.',training:'Mindkét tervezett edzés megvolt.',sleep:'6 óra, jó minőségben, de már második napja rövid. Az energiádon is látszott.',logging:'Az ételeket időben írtad be. A check-inből kettő maradt ki.',rhythm:'A mai nap kiugrott a hét eddigi napjai közül.'}};
const DIM=[['nutrition','Tápanyag'],['quality','Minőség'],['training','Edzés'],['sleep','Alvás'],['logging','Logolás'],['rhythm','Ritmus']];
const DAYN={'2026-09-21':['Hétfő','szept 21'],'2026-09-22':['Kedd','szept 22'],'2026-09-23':['Szerda','szept 23']};
const dimV=(k,sc)=>{const g=sc>=80?'ok':'dom';return k==='nutrition'?{p:sc,prot:98,g}:k==='quality'?{p:sc,a:71,b:100,g}:k==='logging'?{n:2,g}:{p:sc,g}};
/* ═══ A NAPOM, round 7 (owner, 2026-10-14): the pipe went ("too much drawing, no app feeling"); the page is built
       from Mai's blocks — the free-standing vessel on top, sections on one ground with wave lines, the six drawn
       vessels in a 3×2 grid, Mezo's highlights in a card carousel, a closing button. ═══ */
const six=(ST,tap)=>`<div class="n6">${ST.map(s=>`<${tap?`button data-ngs="${s.key}" aria-label="${s.title}: részletek"`:'div'} class="n6-c ${s.none?'none':''}"><svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${V[s.key](s.v)}</svg><em>${s.val}${s.unit?`<small>${s.unit}</small>`:''}</em><b>${s.title}${tap?' <i>›</i>':''}</b></${tap?'button':'div'}>`).join('')}</div>`;
const nTank=(pct,num,verdict)=>`<div class="tk-lebego">`+F.tank({pct,h:330,num,cap:'a 100-ból',verdict,marks:[75,50,25]})+'</div>';
const nWrap=(fr,inner)=>fr[0]+`<div class="mx n7">${inner}</div>`+fr[1];
function today3(){const fr=frame('2026-09-24',/<section class="k2-tank/);if(!fr)return O.nap('2026-09-24');
  const ST=[
    {key:'nutrition',title:'Tápanyag',val:'2 060',unit:'kcal',v:{p:74,prot:89,g:'dom'}},
    {key:'quality',title:'Minőség',val:'74',unit:'%',v:{p:74,a:68,b:80,g:'dom'}},
    {key:'training',title:'Edzés',val:'0/1',v:{p:0,g:'warn'}},
    {key:'sleep',title:'Alvás',val:'7ó 16p',v:{p:86,g:'ok'}},
    {key:'logging',title:'Logolás',val:'2/4',v:{n:2,g:'dom'}},
    {key:'rhythm',title:'Ritmus',val:'74',v:{p:74,g:'ok'}}];
  return nWrap(fr,`<section class="mx-s">${nTank(64,64,'Fehérjéből már csak 18 g hiányzik, az edzés még hátravan.')}</section>
  <section class="mx-s ln">${KH('Most érdemes')}
    <div class="n7-next"><svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${V.training({p:0,g:'warn'})}</svg><div><b>Még hátravan a mai edzés</b><button class="mx-btn pri" data-dom="edzes">Megnyitom</button></div></div></section>
  <section class="mx-s ln">${KH('Hat terület')}${six(ST)}</section>
  <section class="mx-s ln">${KH('Te és az app')}
    <div class="n7-te">${F.vials([{l:'Az app szerint',ic:'t-orb',c:'#3F8FDB',p:64,v:'64'},{l:'Szerinted',ic:'t-person',c:'#3FA277',p:70,v:'7/10'}])}
    <p class="n7-say">Az app szerint közepes nap, szerinted jó volt.</p></div></section>
  <div class="ng-tail"></div>`)}
function closed3(iso){const fr=frame(iso,/<section class="k2-tank/);if(!fr)return O.nap(iso);const v=NDY,last=iso==='2026-09-23';
  const ST=DIM.map(([k,l])=>({key:k,title:l,val:v.dims[k][0],v:dimV(k,v.dims[k][0])}));
  return nWrap(fr,`<section class="mx-s">${nTank(v.score,v.score,v.label+'.')}</section>
  <section class="mx-s ln">${KH('Mezo a napodról','',`<button class="fh-lk" data-ngm="1">Értékelés ›</button>`)}
    <div class="cr">${v.hl.map(([e,t])=>`<div class="cr-c n7-hl"><i class="nb-st">${e}</i><b>${t}</b></div>`).join('')}</div>${dots(v.hl.length)}</section>
  <section class="mx-s ln">${KH('Hat terület')}${six(ST,true)}</section>
  <section class="mx-s ln">${KH('Körülmények')}<div class="n7-ctx">${v.ctx.map(([a,b])=>`<div><span>${a[0].toUpperCase()+a.slice(1)}</span><b>${b}</b></div>`).join('')}</div></section>
  ${last?`<section class="mx-s ln mx-end"><button class="mx-km" data-go="nap.2026-09-24"><span>Tovább a mai napra</span></button></section>`:'<div class="ng-tail"></div>'}`)}
function sparse3(iso){const fr=frame(iso,/<section class="fh-card fh-hero/);if(!fr)return O.nap(iso);
  const ST=DIM.map(([k,l])=>k==='sleep'?{key:k,title:l,val:'7ó 02p',v:{p:70,g:'dom'}}:{key:k,title:l,val:'–',none:true,v:k==='logging'?{n:0,g:'dom'}:{p:0,g:'dom',none:true}});
  return nWrap(fr,`<section class="mx-s"><h2 class="n7-h">Erre a napra kevés az adat, ezért nincs pontszám.</h2></section>
  <section class="mx-s ln">${KH('Amit tudunk róla')}${six(ST)}</section>
  <section class="mx-s ln mx-end"><button class="mx-km" data-go="nap.2026-09-24"><span>Vissza a mai napra</span></button></section>`)}
const day=a=>{const [iso,ph]=(a||'').split('.');return ph||iso==='hiba'||iso==='tolt'?O.nap(a):!iso||iso==='2026-09-24'?today3():iso==='2026-09-21'?sparse3(iso):DAYN[iso]?closed3(iso):O.nap(a)};
/* a closed day: Mezo's evaluation in a sheet */
document.addEventListener('click',e=>{if(!e.target.closest('[data-ngm]'))return;const v=NDY;
  F.openSheet(`<h2 class="ng-sh">Mezo a napodról</h2><p class="ng-adj2"><b>alap ${v.base} · a Mezo szerint −${Math.abs(v.corr)}.</b> ${v.adj}</p>${v.prose.map(p=>`<p class="ng-pr">${p}</p>`).join('')}
    <div class="ng-fb"><span>Segített?</span><button data-toast="Köszönöm, jegyzem" aria-label="Segített">${I('t-thumb-up')}</button><button data-toast="Mi nem talált? (itt jönnének az okok)" aria-label="Nem talált">${I('t-thumb-down')}</button></div>
    <div class="nb-a"><button class="fh-lk" data-toast="Beszélgetés a napról (Mezo chat)">Beszélgess a napról ›</button></div>`)});
/* a closed day's vessel opens its details */
document.addEventListener('click',e=>{const g=e.target.closest('[data-ngs]');if(!g)return;const k=g.dataset.ngs,v=NDY,l=DIM.find(d=>d[0]===k)[1];
  F.openSheet(`<h2 class="ng-sh">${l} · ${v.dims[k][0]}<small>súly ${v.weight[k]}%</small></h2><div class="ng-chips">${v.chips[k].map(c=>`<span>${c}</span>`).join('')}</div>
    <div class="ng-who">${badge('mezo',{s:30})}<b>Mezo</b><small>erről a területről</small></div><p class="ng-pr">${v.notes[k]}</p><div class="fh-acts"><button class="btn" data-close style="flex:1">Rendben</button></div>`)});

/* ═══ BESZÉLGETÉS · the day's stream: every message is a drop on it, at its time ═══ */
const TC={szunya:'#8F7FD0',mocor:'#3F8FDB',falat:'#3FA277',mezo:'#6F7F95'},TG={szunya:'t-sleep',mocor:'t-dumbbell',falat:'t-bowl',mezo:'t-orb'},TN={szunya:'Alvás',mocor:'Mozgás',falat:'Étkezés',mezo:'Mezo'};
const node=(k,cls='')=>`<span class="nb-node ${cls}" style="--c:${TC[k]}"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="${DROP}"/></svg>${I(TG[k])}</span>`;
const BS={adv:false,fb:false,exp:{},jar:false};const TICK_='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5L6.8 11.5L12.5 5"/></svg>';
const MSG=[
  {k:'falat',t:'10:12',kind:'étkezési javaslat',sz:58,x:0,text:'A reggelid 420 kcal volt, 22 g fehérjével. Ha az ebédhez legalább 40 g-ot teszel, estére nem marad nagy hiány.',adv:true},
  {k:'mezo',t:'06:30',kind:'reggeli briefing',sz:50,x:12,text:'Jó reggelt — Week 3, Day 4, és érzed a tempót. Tegnap Push Day-en a Lat Pulldown 105 kg × 9 ment RIR 1-re, ma a hátad pihen.<br><br>Az alvásod 7,4 óra volt, a reggeli check-in nyugodt. Ma délben érdemes a fehérjét előrehozni.',
    built:['Push Day · tegnap','Chest Row 105,8 · márc 4','késő szénhidrát ↔ alvás'],from:[['t-sleep','7,4 óra alvás, 2 ébredés'],['t-checkin','Reggeli check-in: energia 7/10']],why:true},
  {k:'szunya',t:'21:48',kind:'esti visszanézés',sz:40,x:22,old:true,text:'Szép nap volt: 3 szokás, 2 check-in és egy erős edzés.'},
  {k:'mocor',t:'14:10',kind:'délutáni jelzés',sz:34,x:38,old:true,text:'Alacsony az energiád — egy rövid séta többet ad, mint a harmadik kávé.'}];
const msgSheet=i=>{const m=MSG[i];return `<h2 class="ng-sh">${TN[m.k]}<small>${m.old?'tegnap ':''}${m.t} · ${m.kind}</small></h2><p class="ng-pr">${m.text}</p>
  ${m.built?`<p class="nb-l">Amire épült</p><div class="ng-chips">${m.built.map(b=>`<span>${b}</span>`).join('')}</div>`:''}
  ${m.from?`<p class="nb-l">Miből gondolom</p><div class="nb-f">${m.from.map(([ic,t])=>`<span>${I(ic)}${t}</span>`).join('')}</div>`:''}
  ${m.adv?`<div class="nb-a">${BS.adv?`<span class="nb-ok">${TICK_}Beállítva: az ebédnél szólok a fehérjéről.</span>`:`<button class="btn sm" data-nb="adv:${i}">Szólj az ebédnél</button>`}</div>`:''}
  <div class="nb-a"><span>Segített?</span><button class="btn sm ghost" data-toast="Köszönöm — ezt megjegyzem">Segített</button><button class="btn sm ghost" ${m.why?`data-nb="fb:${i}"`:'data-toast="Köszönöm, finomítok"'}>Nem talált</button></div>
  ${m.why&&BS.fb?`<div class="ng-chips tap">${['pontatlan','túl sok','rossz időzítés','nem rólam szól'].map(r=>`<button data-toast="Köszönöm, finomítok">${r}</button>`).join('')}</div>`:''}`};
function streamBody(){
  const bub=(k,sz,cls='')=>`<span class="pl-bub ${cls}" style="--c:${TC[k]};--s:${sz}px">${I(TG[k])}</span>`;
  const row=(m,i)=>`<button class="pl-m ${m.old?'old':''}" style="--x:${m.x}px" data-nb="msg:${i}">${bub(m.k,m.sz,m.old?'old':'')}<span class="pl-b"><span class="nb-h"><b>${TN[m.k]}</b>${m.t} · ${m.kind}</span><span class="nb-t pl-2">${m.text.replace(/<br>/g,' ')}</span><span class="fh-lk">Elolvasom ›</span></span></button>`;
  const o=(l,t,sz)=>`<i class="pl-o" style="left:${l}%;top:${t}px;--s:${sz}px"></i>`;
  return `<div class="pl">
  <div class="pl-air"><small>Mezo · ma · 4 üzenet</small><h2>Négy üzenet, kettő új.</h2>
    <button class="pl-buoy" data-toast="Mezo · Chat"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="${DROP}"/></svg><span><b>Beszélgess Mezóval ›</b></span></button></div>
  <div class="pl-water"><i class="pl-wave"></i>${o(86,40,10)}${o(92,150,6)}${o(80,300,8)}
    <button class="pl-m duo" style="--x:6px" data-toast="Mezo · Élő beszélgetés"><span class="pl-two">${bub('szunya',36)}${bub('mocor',36)}</span><span class="pl-b"><span class="nb-h"><b>A csapat most erről beszél</b></span><span class="nb-t pl-2">belefér-e ma az esti röpi a rövid éjszaka után</span><span class="fh-lk">Belehallgatok ›</span></span></button>
    ${MSG.map((m,i)=>m.old?'':row(m,i)).join('')}
  </div>
  <div class="pl-water deep"><i class="pl-wave"></i><p class="pl-day">tegnap</p>${o(88,60,9)}${o(78,150,6)}
    ${MSG.map((m,i)=>m.old?row(m,i):'').join('')}
  </div></div>`}
/* observations (Beszélgetés · Észrevételek and Mai): communicating vessels — cause and effect joined by a pipe
   that has one segment per evidence day: full = agrees, dashed = against, empty = still missing */
const OBS=[
  {k:'anna',h:'Anna és az alvásod',lbl:'megfigyelés',st:'Gyűlik',hits:4,miss:0,minN:7,a:['t-people',['Anna a','hála-naplódban']],b:['t-sleep',['+40 perc','alvás másnap']],x:'Amikor <b>Anna</b> szerepel a hála-naplódban, másnap átlag <b>40 perccel többet</b> alszol. Négy nap adata, ez még kevés. Figyeljem tovább?',ev:['4 hála-bejegyzés','4 éjszaka','+1 nap eltolás'],acts:['Igen, figyeld','Nem stimmel','Mesélj erről']},
  {k:'keso',h:'Késői vacsora és az alvás',lbl:'figyelem',st:'Figyelem',hits:5,miss:1,minN:6,a:['t-bowl',['vacsora','21:00 után']],b:['t-sleep',['−1,2 pont','alvásminőség']],x:'Amikor 21:00 után eszel, az alvásod minősége átlag <b>1,2 ponttal</b> alacsonyabb.',ev:['6 késői vacsora','6 éjszaka'],acts:['Így van','Kivétel volt']}];
const OS={done:{},ev:{}};
/* On the page: the heading, the drawing and ONE action line — the whole block is the target. The sentence, the
   answers and the evidence open in a bottom sheet (thumb-reach, the page stays behind it; text of any length scrolls there). */
function obsGraph(o){const n=o.minN,x0=78,x1=242,g=4,w=(x1-x0-g*(n-1))/n;
  const ves=(cx,[ic,l])=>`<circle class="lk-v" cx="${cx}" cy="40" r="31"/><path class="ng-hi" d="M${cx-20} 34C${cx-17} 25 ${cx-11} 19 ${cx-3} 16"/><svg class="ic" x="${cx-16}" y="24" width="32" height="32" viewBox="0 0 64 64"><use href="#${ic}"/></svg>
`;
  return `<svg class="lk-g" viewBox="0 0 320 80" role="img" aria-label="${o.a[1].join(' ')} és ${o.b[1].join(' ')}: ${o.hits} nap egybevág, ${o.miss} ellene szól, ${n-o.hits-o.miss} még hiányzik">
      <path class="lk-p" d="M70 40H250"/>${Array.from({length:n},(_,i)=>`<rect class="lk-s ${i<o.hits?'p':i<o.hits+o.miss?'m':''}" x="${(x0+i*(w+g)).toFixed(1)}" y="33" width="${w.toFixed(1)}" height="14" rx="7"/>`).join('')}
      ${ves(40,o.a)}${ves(280,o.b)}</svg>
      <span class="lk-lab"><span><b>${o.a[1][0]}</b>${o.a[1][1]}</span><span class="lk-mid"><b>${o.hits} / ${n} nap</b>egybevág${o.miss?` · ${o.miss} ellene`:''}</span><span><b>${o.b[1][0]}</b>${o.b[1][1]}</span></span>`}
const obsLinked=(o,all)=>`<article class="lk"><button class="lk-tap" data-nb="osh:${o.k}" aria-label="${o.h}: megnézem és válaszolok"><span class="lk-h"><b>${o.h}</b><i class="nb-st ${o.st==='Gyűlik'?'':'w'}">${o.st}</i></span>
    ${obsGraph(o)}<span class="lk-go ${OS.done[o.k]?'ok':''}">${OS.done[o.k]?`${TICK_}Megjegyeztem a válaszod · megnézem ›`:'Megnézem és válaszolok ›'}</span></button>
    ${all?'<div class="nb-a" style="margin-top:0;justify-content:center"><button class="fh-lk" data-go="uzenetek.eszrevetelek">Összes észrevétel ›</button></div>':''}</article>`;
const obsSheet=o=>`<h2 class="ng-sh">${o.h}<small>${o.st}</small></h2>${obsGraph(o)}
    <div class="ng-who">${badge('mezo',{s:28})}<b>Mezo</b><small>${o.lbl}</small></div><p class="ng-pr">${o.x}</p>
    ${OS.ev[o.k]?`<p class="nb-l">Miből látom</p><div class="ng-chips">${o.ev.map(e=>`<span>${e}</span>`).join('')}</div>`:''}
    <div class="nb-a">${OS.done[o.k]?`<span class="nb-ok">${TICK_}Megjegyeztem a válaszod.</span>`:o.acts.map((a,i)=>`<button class="btn sm ${i?'ghost':''}" data-nb="obs:${o.k}">${a}</button>`).join('')}</div>
    <div class="nb-a" style="margin-top:4px"><button class="fh-lk" data-nb="ev:${o.k}">${OS.ev[o.k]?'Elrejtem, miből látod':'Miből látod?'}</button>${o.st==='Gyűlik'?'<button class="fh-lk" data-toast="Mezo · Laborfüzet — ez a minta">Laborfüzet ›</button>':''}<button class="fh-lk" data-toast="Mezo · Chat — előtöltve">Beszéljünk róla ›</button></div>`;
function obsBody(){const left=OBS.filter(o=>!OS.done[o.k]).length;
  return `<div class="pg-lead"><small>Észrevételek · ma</small><h2>${left?`${left===2?'Két':'Egy'} észrevétel vár a válaszodra.`:'Mindkettőre válaszoltál. Köszönöm.'}</h2></div>
  ${OBS.map((o,i)=>`<section class="bd ${i%2?'':'w'}">${obsLinked(o)}</section>`).join('')}
  <div class="mt-acts"><button class="btn" data-toast="Mezo · Chat">Beszéljük meg</button></div>`}
/* Életjelek: the rack. The six tubes are the approved ones, taken as they are; the remark hangs on its tube. */
const cutOut=(html,a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);return i<0||j<0?'':html.slice(i,j)};
function vitalsBody(){const v=cutOut(O.uzenetek('eletjelek'),'<div class="np-vh np-six">','<div class="fh-acts">');
  return `<div class="pg-lead"><small>Életjelek · ma · átlag 60</small><h2>A mozgás az egyetlen, ami figyelmet kér.</h2><p><button class="fh-lk" data-go="eletjel">Részletek ›</button></p></div>
  <section class="bd w" style="padding-bottom:22px;margin-top:20px"><div class="np-pad rk">${v}<i class="rk-shelf"></i></div></section>
  <svg class="rk-str" viewBox="0 0 360 46" preserveAspectRatio="none" aria-hidden="true"><path d="M207 0C207 26 62 14 58 46"/></svg>
  <div class="rk-tag"><i class="rk-hole"></i><p class="nb-h"><b>Mozgás</b>34% · amit a csapat mond</p>
    <p class="nb-t"><b>Ma még alig mozdultál.</b> Egy 10 perces séta ebéd után elég, hogy a szint megmozduljon. Nem kell edzés.</p>
    <div class="nb-a"><button class="btn sm ghost" data-toast="Edzés · Mai">Megnézem</button></div></div>`}
const LOG=[['13:40','Napló','Ebéd után nyugodtabb vagyok, mint reggel.','↗','data-toast="Én · Napló"','en'],['13:00','Ebéd','Csirke · édesburgonya · spenót','760 kcal','data-dom="fuel"','fuel'],['11:20','Aktivitás','Olvastam fél órát','+15 XP','data-toast="Én · Fejlődés"','en'],['10:00','Délelőtti check-in','Most csak ennyi · az alap megvan','kész','data-go="checkin"','nap'],['09:15','Reggeli','Túrós zabkása áfonyával','420 kcal','data-dom="fuel"','fuel'],['07:10','Reggeli check-in','Nyugodt ébredés, pihenve','kész','data-go="checkin"','nap']];
const RR={moc:()=>OBS.map(o=>`<div class="cr-c obs">${obsLinked(o)}</div>`).join(''),jar:()=>(BS.jar?LOG:LOG.slice(0,3)).map(([t,ti,sub,r,attr,k])=>`<button class="jr-l k-${k}" ${attr}><time>${t}</time><span><b>${ti}</b><small>${sub}</small></span><em>${r==='↗'?'':r} ›</em></button>`).join('')+`<button class="jr-more" data-nb="jar">${BS.jar?'Csak a legutóbbi három':`Még ${LOG.length-3} korábbi bejegyzés`} ›</button>`,nb:()=>streamBody(),ob:()=>obsBody(),mo:()=>obsLinked(OBS[0],true)};
function uzenetek(tab){tab=tab||'uzenetek';
  const TABS=[['uzenetek','Üzenetek'],['eletjelek','Életjelek'],['eszrevetelek','Észrevételek']];if(!TABS.some(t=>t[0]===tab))return O.uzenetek(tab);
  return page('nap',{title:'Beszélgetés',sub:'Mezo · ma · 4 üzenet',tab:'uzenetek'},`${DEFS}<div class="np-pre"><div class="fh-seg">${TABS.map(([k,l])=>`<button class="${k===tab?'on':''}" data-go="uzenetek${k==='uzenetek'?'':'.'+k}">${l}${k==='eletjelek'&&k!==tab?'<i class="np-dot"></i>':''}</button>`).join('')}</div></div>
    ${tab==='eletjelek'?vitalsBody():`<div data-rr="${tab==='uzenetek'?'nb':'ob'}">${RR[tab==='uzenetek'?'nb':'ob']()}</div>`}`)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-nb]');if(!b)return;const a=b.dataset.nb,[k,x]=a.split(':');
  if(k==='cis'){F.openSheet(ciSheet(+x));return}
  if(k==='msg'){F.openSheet(msgSheet(+x));return}
  if(k==='qs'){const q=QS[+x];F.openSheet(`<h2 class="ng-sh">${q.s}<small>+${q.xp} XP</small></h2><p class="ng-pr"><b>${q.t}</b></p>${q.why?`<p class="ng-pr">${q.why}</p>`:''}<p class="ng-pr">${q.foot||''}</p><p class="ng-pr">A küldetés ajánlat: ha kimarad, csendben lejár, bukás nincs.</p><div class="nb-a">${q.cta?`<button class="btn sm" data-toast="${q.cta} · Mai">${q.cta}</button>`:''}<button class="btn sm ghost" data-toast="Csere: új ajánlat érkezik a helyére · ma már nincs több">Csere · 1 maradt</button></div>`);return}
  if(k==='adv'){BS.adv=true;F.toast('Beállítva: az ebédnél szólok');F.openSheet(msgSheet(+x))}else if(k==='fb'){BS.fb=!BS.fb;F.openSheet(msgSheet(+x))}else if(a==='jar')BS.jar=!BS.jar;else if(k==='exp')BS.exp[x]=!BS.exp[x];
  else if(k==='obs'){OS.done[x]=true;F.closeSheet();F.toast('Megjegyeztem a válaszod')}else if(k==='ev'){OS.ev[x]=!OS.ev[x];F.openSheet(obsSheet(OBS.find(o=>o.k===x)))}
  else if(k==='osh'){F.openSheet(obsSheet(OBS.find(o=>o.k===x)));return}
  document.querySelectorAll('[data-rr]').forEach(r=>{const x=r.scrollLeft;r.innerHTML=RR[r.dataset.rr]();r.scrollLeft=x})});

/* ═══ MAI · the day as a flat line (06–22), filled up to now; behind it what you logged, ahead what is left.
       Then the four tubes the owner likes (as they are), the next three as three vessels in time order,
       and the day's jar: one layer per log entry, newest on top. ═══ */
/* The top of Mai: the day as a flat line (06–22), filled up to now, with what is behind and ahead on it, and the
   day's number beside the sentence. The owner picked this over the arc, a liquid layer and a plain level (2026-10-13). */
/* The top of Mai: the old hero vessel without its card (owner's pick, 2026-10-14) — the liquid stands free with a
   rounded bottom, the sentence on the page ground above it. Tried and not picked: the arc, the flat day line, a plain
   level, full-width liquid. The level is a stage for the number (bible F2.10), not proportional to it. */
const maiHero=()=>`<div class="tk-lebego">`+F.tank({pct:56,h:330,num:60,cap:'a 100-ból · hat életjel átlaga',verdict:'Most a délutáni check‑in jön, utána a Pull&nbsp;Day.',marks:[75,50,25]})+'</div>'; /* no button in the vessel: the check-in starts from Most következik (owner, 2026-10-14) */
const dots=n=>`<div class="cr-dots" aria-hidden="true">${Array.from({length:n},(_,i)=>`<i class="${i?'':'on'}"></i>`).join('')}</div>`;
/* the dot under a carousel follows the first card in view */
document.addEventListener('scroll',e=>{const c=e.target;if(!(c instanceof Element)||!c.classList.contains('cr'))return;const d=c.nextElementSibling;if(!d||!d.classList.contains('cr-dots'))return;
  const max=c.scrollWidth-c.clientWidth,n=d.children.length,i=max>0?Math.round(c.scrollLeft/max*(n-1)):0;
  [...d.children].forEach((x,j)=>x.classList.toggle('on',j===Math.min(n-1,i)))},true);
const KH=(t,sub='',link='')=>`<div class="mx-h"><b>${t}</b>${link||(sub?`<span>${sub}</span>`:'')}</div>`;
function mai2(){const base=O.mai(''),lv=cutOut(base,'<div class="np-pad rise" style="--i:1">','<div class="k2-h rise" style="--i:2">');
  const NX=[
    {key:'drop',t:'14:00',title:'Délutáni check-in',sub:'9 koppintás, kb. fél perc',go:'Kitöltöm',v:{ic:'t-checkin'},attr:'data-n="ck:open"',now:true},
    {key:'training',t:'ma',title:'Pull Day',sub:'a mai edzés még hátravan',go:'Megnézem',v:{p:0,g:'warn'},attr:'data-dom="edzes"'},
    {key:'nutrition',t:'19:30',title:'Vacsora',sub:'722 kcal van még · 18 g fehérje hiányzik',go:'Logolom',v:{p:74,prot:89,g:'dom'},attr:'data-dom="fuel"'}];
  const MORE=[[I('t-macro'),'A napod üzemanyaga','kalória és makrók','data-sheet="uzemanyag"'],[I('t-heart'),'Életjelek','átlag 60 · a mozgás kér figyelmet','data-go="eletjel"'],[I('t-pattern'),'Összes észrevétel',`${OBS.filter(o=>!OS.done[o.k]).length} vár a válaszodra`,'data-go="uzenetek.eszrevetelek"'],[badge('mezo',{s:30}),'Valami nem stimmel ma?','a csapat utánanéz','data-toast="Mezo · Kérdezd a csapatot"'],
    [I('t-checkin'),'Check-in','','data-go="checkin"'],[I('t-steps'),'Aktivitás','','data-sheet="activity"'],[I('t-chat'),'Chat','','data-toast="Mezo · Chat"'],[I('t-quest'),'Napi küldetések','','data-go="kuldetesek"']];
  /* Mai, round 6 (owner, 2026-10-14, after looking at Strava): one ground for the whole page, sections divided by a wave
     LINE only; cards only inside carousels (Észrevétel, Továbbiak) — the top is NOT a card (owner, same day); no napló. */
  return page('nap',{title:'Ma',sub:'Szerda, október 7.',tab:'mai'},`${DEFS}<div class="mx">
  <section class="mx-s">${maiHero()}</section>
  <section class="mx-s ln">${KH('Most következik')}
  <div class="mx-next">${NX.map(x=>`<button class="${x.now?'now':''}" ${x.attr}><svg class="ng" viewBox="0 0 104 104" aria-hidden="true">${V[x.key](x.v)}</svg><em>${x.t}</em><b>${x.title}</b><span class="mx-btn ${x.now?'pri':''}">${x.go}</span></button>`).join('')}</div></section>
  <section class="mx-s ln">${KH('Mai szintek')}${lv}</section>
  <section class="mx-s ln">${KH('Észrevétel','',`<button class="fh-lk" data-go="uzenetek.eszrevetelek">Összes ›</button>`)}
  <div class="cr" data-rr="moc">${RR.moc()}</div>${dots(OBS.length)}</section>
  <section class="mx-s ln">${KH('Továbbiak')}
  <div class="cr sm">${MORE.map(([ic,t,sub,attr])=>`<button class="cr-c" ${attr}><span class="mt-bub">${ic}</span><b>${t}</b></button>`).join('')}</div>${dots(MORE.length-2)/* about three cards are in view: one dot per stop */}</section>
  <section class="mx-s ln mx-end"><button class="mx-km" data-n="km:open">${I('t-kimelo')}<span>Nem vagyok jól ma</span></button></section></div>`).replace('<div class="toast"','<a class="fh-fab" href="#w-nap-gyors" aria-label="Gyors logolás"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></a><div class="toast"')}

/* ═══ CHECK-IN · the day's four snapshots side by side: one column per moment, one row per feeling, so you can see
       how each of the five core answers moved through the day. A finished column opens its full snapshot in a sheet
       (the extra questions of that moment and the note live there); the one that is due carries the action. ═══ */
const CI_ROWS=[['energy','Energia','t-bolt'],['mood','Hangulat','t-mood'],['stress','Stressz','t-checkin'],['body','Test','t-person'],['mental','Fej','t-gem'],
  ['rested','Pihent','t-rested'],['soreness','Izomláz','t-soreness'],['pain','Fájdalom','t-pain'],['motivation','Kedv','t-motivation'],['hunger','Éhség','t-hunger'],['craving','Sóvárgás','t-craving'],['digestion','Emésztés','t-digestion'],['connection','Kapcsolat','t-people'],['day','A nap','t-day']];
const CORE=['energy','mood','stress','body','mental'];
/* ask = what this moment asks (the five core questions, its own ones, and the day's adaptive question) */
const CI=[{n:'Reggel',t:'06:30',st:'done',ask:[...CORE,'rested','soreness','pain','motivation','hunger'],a:{energy:7,mood:8,stress:3,body:6,mental:7,rested:6,soreness:5,pain:4,motivation:8,hunger:5},x:{pain:'Térd'},note:'Nyugodt ébredés · pihenve'},
  {n:'Délelőtt',t:'10:00',st:'done',ask:[...CORE,'motivation','hunger','craving'],a:{energy:9,mood:7,stress:4,body:7,mental:8},note:'Most csak ennyi · az alap megvan'},
  {n:'Délután',t:'14:00',st:'now',ask:[...CORE,'hunger','craving','digestion','motivation']},{n:'Este',t:'20:00',st:'later',ask:[...CORE,'soreness','pain','craving','digestion','connection','day','motivation']}];
/* how far a feeling moved between its first and last answer today; the largest move is the row to look at */
const ciMove=k=>{const v=CI.map(c=>c.a&&c.a[k]).filter(x=>x!=null);return v.length>1?v[v.length-1]-v[0]:0};
const ciHot=()=>{const m=Math.max(...CI_ROWS.map(([k])=>Math.abs(ciMove(k))));return m>1?CI_ROWS.filter(([k])=>Math.abs(ciMove(k))===m).map(r=>r[0]):[]};
const ciSheet=i=>{const c=CI[i];return `<h2 class="ng-sh">${c.n}<small>${c.t} · ${Object.keys(c.a).length} válasz</small></h2>
  <div class="ci-all">${CI_ROWS.filter(([k])=>k in c.a).map(([k,l])=>`<span><i class="ci-v ${k==='pain'?'wn':''}" style="--p:${c.a[k]*10}%"><b>${c.a[k]}</b></i><em>${l}${c.x&&c.x[k]?`<small>${c.x[k]}</small>`:''}</em></span>`).join('')}</div>
  ${c.note?`<p class="ng-pr">${c.note}</p>`:''}<div class="nb-a"><button class="btn sm ghost" data-n="ckslot:${c.t}">Újra kitöltöm</button></div>`};
function checkin2(){const cur=CI.find(c=>c.st==='now'),done=CI.filter(c=>c.st==='done').length,hot=ciHot(),H=k=>hot.includes(k)?'hot':'',G=i=>i===5?'<span class="ci-g"></span>':'';
  return page('nap',{title:'Check-in',sub:`Nap · ${done} / 4 pillanatkép`,back:'mai'},`${DEFS}
  <section class="bd"><div class="pg-lead"><small>A nap négy pillanata · ${done} / 4</small><h2>A délutáni most esedékes.</h2></div></section>
  <section class="bd w"><div class="ci">
    <div class="ci-l"><span class="ci-h"></span>${CI_ROWS.map(([k,l,ic],i)=>`${i===5?'<span class="ci-g"><b>Időpont szerint</b></span>':''}<span class="ci-r ${H(k)}">${I(ic)}<b>${l}</b>${H(k)?`<em>${ciMove(k)>0?'+':'−'}${Math.abs(ciMove(k))}</em>`:''}</span>`).join('')}<span class="ci-f"></span></div>
    ${CI.map((c,i)=>`<button class="ci-c ${c.st}" ${c.st==='done'?`data-nb="cis:${i}"`:c.st==='now'?'data-n="ck:open"':`data-n="ckslot:${c.t}"`} aria-label="${c.n} ${c.t}">
      <span class="ci-h"><b>${c.t}</b><small>${c.n}</small></span>
      ${CI_ROWS.map(([k],r)=>{const v=c.a&&c.a[k],asked=c.ask.includes(k);return `${G(r)}<span class="ci-r ${H(k)}">${asked?`<i class="ci-v ${v==null?'e':''} ${k==='pain'&&v?'wn':''} ${v!=null&&v<6?'lo':''}" style="--p:${v?v*10:0}%"><b>${v??''}</b></i>`:'<i class="ci-no"></i>'}</span>`}).join('')}
      <span class="ci-f fh-lk">${c.st==='done'?'kész ›':c.st==='now'?'most ›':'előre ›'}</span></button>`).join('')}
  </div></section>`,{foot:`<div class="rt-foot"><span class="rt-fn"><small>Most jön · ${cur.t}</small><b>${cur.n}i check-in</b></span><button class="btn" data-n="ck:open">Kitöltöm</button></div>`})}

/* Gyors logolás: the drawn version (nine drops above the day's jar) was shown and NOT picked — the approved page stays. */

/* ═══ ÉLETJELEK (detail) · the page where you top a sign up: the six tubes, bigger, in two rows on two shelves; each
       tube that you can raise yourself carries its own action. The one that asks for attention sits in the bottom bar. ═══ */
const EJ=[['Étel','t-bowl',72,'Logolom',{toast:'Fuel · Logolás'}],['Víz','t-water',52,'+250 ml',{toast:'+250 ml víz — rögzítve'}],['Alvás','t-sleep',81,'Rögzítem',{sheet:'sleep'}],
  ['Mozgás','t-dumbbell',34,'Edzés',{toast:'Edzés · Mai'}],['Kapcsolat','t-people',64,'Check-in','checkin'],['Rend','t-chain',58,'',{toast:'Rend · magától töltődik a rutinból'}]];
function eletjel2(){const avg=Math.round(EJ.reduce((a,e)=>a+e[2],0)/EJ.length),low=EJ.filter(e=>e[2]<40);
  const row=a=>`<div class="np-pad rk ej">${F.vials(a.map(([l,ic,p,act,on])=>({l,ic,p,v:p,c:p<40?'var(--warn)':'var(--dom)',mark:p<40?'figyelj':'',s:act?act+' ›':'',on})),{h:132})}<i class="rk-shelf"></i></div>`;
  return page('nap',{title:'Életjelek',sub:'Nap · a hat jel',back:'mai'},`${DEFS}
  <section class="bd"><div class="pg-lead hv-c"><small>A hat jel · ma</small><h2>${low.length?`Egy jel kér figyelmet: a ${low[0][0].toLowerCase()}.`:'Mind a hat jel rendben van.'}</h2><b class="hv-n">${avg}</b></div></section>
  <section class="bd w" style="padding-bottom:26px">${row(EJ.slice(0,3))}${row(EJ.slice(3))}</section>`,
  low.length?{foot:`<div class="rt-foot"><span class="rt-fn"><small>Figyelmet kér · ${low[0][2]}%</small><b>${low[0][0]}</b></span><button class="btn" data-toast="Edzés · Mai">Edzés megnyitása</button></div>`}:{})}

/* ═══ NAPI KÜLDETÉSEK · three flasks on offer; what a finished one holds is poured into the day's XP collector ═══ */
const QS=[
  {ic:'t-dumbbell',s:'Edzés',p:6,t:'A mai tervezett edzés a naptárban van — csináld végig',why:'A megjelenés a legerősebb identitás-szavazat: aki ma edz, az edző ember.',xp:25,cta:'Edzés',foot:'folyamatban · az edzésből záródik magától'},
  {ic:'t-weight',s:'Súlymérés',p:100,t:'Reggeli súlymérés — logold be',xp:15,done:true},
  {ic:'t-journal',s:'Olvasás',p:6,t:'Olvass ma legalább 10 percet',xp:20,foot:'folyamatban · a logjaidból záródik magától'}];
const FLASK=['M44 12H60V37A30 30 0 1 1 44 37Z','M44 12H60V34L88 86Q91 94 83 94H21Q13 94 16 86L44 34Z','M42 12H62V26Q76 31 76 45V85Q76 94 67 94H37Q28 94 28 85V45Q28 31 42 26Z'];
function flask(q,i){const id=uid(),d=FLASK[i%3],y=q.done?30:94-56*q.p/100,g=q.done?'ok':'dom';
  return `<svg class="ng qf" viewBox="0 0 104 104" aria-hidden="true"><defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>
    <g class="ng-ves"><path class="ng-glass" d="${d}"/>${liq(id,y,g)}<path class="ng-line" d="${d}"/></g><path class="ng-rim" d="M40 12H64"/><path class="ng-hi" d="M34 58C34 68 38 78 46 84"/>
    ${q.done?'<rect class="qf-cork" x="43" y="2" width="18" height="13" rx="3"/>':''}
    <svg class="ic" x="37" y="${i%3===1?56:50}" width="30" height="30" viewBox="0 0 64 64" style="${q.done?'--ic:#fff;--ic2:rgba(255,255,255,.3);--icf:transparent':''}"><use href="#${q.ic}"/></svg></svg>`}
function kuldetesek(arg){if(arg)return O.kuldetesek(arg);const tot=QS.reduce((a,q)=>a+q.xp,0),got=QS.filter(q=>q.done).reduce((a,q)=>a+q.xp,0),dn=QS.filter(q=>q.done).length,cid=uid();
  const C='M30 8H330V46C330 74 300 84 180 84C60 84 30 74 30 46Z';
  return page('nap',{title:'Napi küldetések',sub:'Nap · ajánlatok mára',back:'mai'},`${DEFS}
  <section class="bd"><div class="pg-lead"><small>Mai ajánlatok · +${tot} XP</small><h2>${dn} kész a ${QS.length} ajánlatból.</h2></div>
  <svg class="ng" viewBox="0 0 360 132" role="img" aria-label="A mai XP gyűjtője: ${got} a ${tot}-ból" style="margin-top:10px"><defs><clipPath id="${cid}"><path d="${C}"/></clipPath></defs>
    <g class="ng-ves"><path class="ng-glass" d="${C}"/><g clip-path="url(#${cid})"><path class="ng-wv" fill="url(#ng-g-ok)" d="M-48 ${84-76*got/tot}${' q12 -5 24 0 t24 0'.repeat(9)} V120 H-48Z"/></g><path class="ng-line" d="${C}"/></g>
    <path class="ng-rim" d="M24 8H336"/>${QS.map((q,i)=>`<path class="ng-mark" d="M${30+300*(i+1)/QS.length} 12V20" />`).slice(0,-1).join('')}
    <text class="qs-xp" x="180" y="50" text-anchor="middle">+${got}<tspan class="ng-u" dx="5">XP</tspan></text>
    <text class="ng-s" x="180" y="108" text-anchor="middle">jóváírva ma · a ${tot}-ból</text>${drip(180,0)}</svg></section>
  ${QS.map((q,i)=>`<section class="bd ${i%2?'':'w'} qs"><div class="qs-r">${flask(q,i)}<div class="qs-b">
      <p class="nb-h"><b>${q.s}</b><i class="nb-st ${q.done?'ok':''}">${q.done?'kész':`+${q.xp} XP`}</i></p>
      <p class="qs-t">${q.t}</p>
      <div class="nb-a" style="margin-top:4px">${q.done?`<span class="nb-ok">${TICK_}+${q.xp} XP jóváírva</span>`:`${q.cta?`<button class="btn sm" data-toast="${q.cta} · Mai">${q.cta}</button>`:''}<button class="fh-lk" data-nb="qs:${i}">Részletek ›</button>`}</div>
    </div></div></section>`).join('')}`)}

/* ═══ RUTIN · the chain as a string of vessels that winds down the page — three per row, any number of rows.
       The vessel's level is the habit's 28-day strength; the pipe behind it is full up to where you have got today. ═══ */
const RUT={
  reggel:{title:'Reggeli rutin',stat:['6/30','tökéletes reggel'],xp:25,rows:[
    ['Ébredés időben','a lánc kezdete','t-dawn',82,1],['Mai fókusz','koppints, és írd le','t-ring',null,0,0,'intention'],['Reggeli napfény','ébredés után','t-sun',64,1],['50 fekvőtámasz','megvolt a reggeli napfény','t-dumbbell',48,0],['Reggeli videó','megvolt az 50 fekvőtámasz','t-camera',39,0,1],['Reggeli súlymérés','fogmosás után','t-weight',93,1],['Gombakávé','súlymérés után','t-bowl',71,0],['Reggeli edzés','kávé után','t-run',57,0],['Fehérjés reggeli','edzés után','t-protein',79,0]]},
  napkozben:{title:'Napközbeni rutin',stat:null,xp:10,rows:[
    ['Ebéd utáni séta','ebéd után','t-steps',61,1],['Víz · 2 liter','délutánig','t-water',70,0],['Képernyőszünet','minden óra végén','t-clock',44,0]]},
  este:{title:'Esti rutin',stat:['4/30','tökéletes este'],xp:0,rows:[
    ['Koffein-cutoff','14:00 után már nem','t-clock',86,0],['Konyha zárva','elpakoltam a vacsora után','t-stack',68,0],['Szándékkal éltem?','koppints, és válaszolj','t-journal',55,0,0,'reflect'],['Napzárás','a nap lezárása','t-moon',null,0,0,'ritual'],['Wind-down, képernyő le','Napzárás után','t-sleep',43,0]]}};
let face='reggel';
const rAttr=(r,i,g)=>r[6]==='reflect'?'data-sheet="reflect"':r[6]==='intention'?'data-sheet="intention"':r[6]==='ritual'?'data-go="napzaras.1"':`data-rt="${g}:${i}"`;
const rVerb=r=>r[6]==='reflect'?'Válaszolok':r[6]==='intention'?'Leírom':r[6]==='ritual'?'Napzárás indítása':'Megvan, pipálom';
function chain(k,n,nx){const G=RUT[k],N=G.rows.length,dn=G.rows.filter(r=>r[4]).length;
  return `<section class="bd ${n%2?'w':''}"><p class="fh-n"><b>${n}</b>${G.title} · ${dn}/${N}${G.stat?`<span class="rt-perf"><strong>${G.stat[0]}</strong>${G.stat[1]}</span>`:''}</p><div class="rt-chain">${G.rows.map((r,i)=>{const [nm,s,ic,str,d]=r,row=Math.floor(i/3),c=i%3,col=c+1,dir=i===N-1?'':c===2?'wrap':'rt';
    return `<button class="rt-b ${d?'done':''} ${i===nx?'now':''} ${dir} ${str==null?'ns':''}" style="grid-column:${col};grid-row:${row+1};--p:0%" ${rAttr(r,i,k)} aria-label="${nm}${d?' · kész':''}">
      <span class="rt-v">${I(ic)}${d?'<i class="rt-ok"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5L6.8 11.5L12.5 5"/></svg></i>':''}</span><b>${nm}</b>${i===nx?'<small><em>Most jön</em></small>':''}</button>`}).join('')}</div></section>`}
function rutinBody(){const R=RUT[face],done=R.rows.filter(r=>r[4]).length,nx=R.rows.findIndex(r=>!r[4]),all=nx<0;
  const order=[face,...Object.keys(RUT).filter(k=>k!==face)];
  return `<div class="rt-lead"><small>${R.title} · ${done}/${R.rows.length} kész</small><h2>${all?'Mind megvan. Szép munka.':`Most jön: ${R.rows[nx][0]}.`}</h2>
    <div class="rt-acts"><button class="fh-lk" data-toast="Tegnap — csak a kézi, kimaradt elemek pipálhatók">‹ Tegnap</button><span class="fh-lk" style="opacity:.35">Holnap ›</span></div></div>
  ${order.map((k,i)=>chain(k,i+1,k===face?nx:-1)).join('')}
  <section class="bd ${order.length%2?'':'w'} last">
  <button class="rt-edit" data-go="rutin-epites">${I('t-chain')}<span><b>Rutinok szerkesztése</b></span><i>›</i></button></section>`}
const rutinFoot=()=>{const R=RUT[face],nx=R.rows.findIndex(r=>!r[4]);return nx<0?`<span class="rt-fdone">Mind megvan mára. Szép munka.</span>`
  :`<span class="rt-fn"><small>Most jön</small><b>${R.rows[nx][0]}</b></span><button class="btn" ${rAttr(R.rows[nx],nx,face)}>${rVerb(R.rows[nx])}</button>`};
function rutin(arg){if(arg&&RUT[arg])face=arg;return page('nap',{title:'Rutin',sub:'Nap · ma, szerda',tab:'rutin'},`<div id="rt-root">${rutinBody()}</div>`,{foot:`<div id="rt-foot" class="rt-foot">${rutinFoot()}</div>`})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-rt]');if(!b)return;const [g,ix]=b.dataset.rt.split(':'),R=RUT[g].rows,i=+ix;R[i][4]=R[i][4]?0:1;
  if(R[i][4]){const d=R.filter(r=>r[4]).length;F.toast(d===R.length?`${g==='este'?'Tökéletes este':g==='reggel'?'Tökéletes reggel':'Minden megvan'} · ${d} / ${R.length}`:`Szokás · ${d} / ${R.length} · megvan, a lánc erősödik`)}
  const r=document.getElementById('rt-root');if(r)r.innerHTML=rutinBody();const f=document.getElementById('rt-foot');if(f)f.innerHTML=rutinFoot()});

/* ── routes: on this page the top tabs open the drawn versions; the approved ones stay reachable ── */
nap.routes['eletjel-lista']=O.eletjel;nap.routes.eletjel=eletjel2;nap.routes['checkin-lista']=O.checkin;nap.routes.checkin=checkin2;nap.routes['kuldetesek-lista']=O.kuldetesek;nap.routes.kuldetesek=kuldetesek;nap.routes['mai-lista']=O.mai;nap.routes.mai=a=>a?O.mai(a):mai2();nap.routes['napom-lista']=O.napom;nap.routes['uzenetek-lista']=O.uzenetek;nap.routes['rutin-lista']=O.rutin;
nap.routes.napom=a=>a?O.napom(a):today3();nap.routes.nap=day;nap.routes.napomg=today3;nap.routes.napomt=today3;
nap.routes.uzenetek=uzenetek;nap.routes.rutin=rutin;

F.css(`/* kiserlet-napom */
/* RULES (owner-approved UX round, 2026-10-12): nothing renders under 12 px on a 360 px phone — so text inside a
   drawing is at least 13 user units; every tappable thing has a 44 px target; a tappable drawing carries a blue
   "… ›" line and nothing else does; words are always left-aligned. */
${P} .scroll .fh-lk{display:inline-flex;align-items:center;min-height:44px}
${P} .scroll .btn.sm{min-height:44px}
${P} .np-pre .fh-seg button{min-height:44px}
${P} .k2-vial small{font-size:12.5px}${P} .k2-vial small i{font-size:12px}
${P} .np-week small{font-size:12px}
${P} .mt-acts .fh-lk{min-width:44px;justify-content:center}
${P} .k2-tube em{font-size:12px!important;font-family:var(--ff,inherit)!important;font-weight:700;top:8px!important}
/* the target sits on a white chip so it reads on any liquid */
${P} .mx-s .k2-tube em:not(:empty){left:50%!important;right:auto!important;translate:-50% 0;padding:1px 7px;border-radius:999px;white-space:nowrap;background:rgba(255,255,255,.92);color:var(--ink)!important;box-shadow:0 1px 3px rgba(10,42,60,.15)}
${P} .np-six .k2-vial small{font-size:12px;letter-spacing:-.35px}
/* six tubes need ~56 px each for their label: on a narrow phone they stand in two rows of three */
${P} .rk{container-type:inline-size}
@container (max-width:350px){${P} .np-six .k2-vials{grid-template-columns:repeat(3,1fr)!important;row-gap:16px}}
${P} svg.ng{display:block;width:calc(100% - 28px);margin:0 14px;overflow:visible}
${P} svg.ng-top{margin-top:6px}
${P} .ng text{font-family:var(--ff,inherit)}
${P} .ng-lead{position:relative;margin:0;padding:4px 22px 16px calc(14px + (100% - 28px)*.2 + 24px)}
${P} .ng-lead::before{content:"";position:absolute;left:calc(14px + (100% - 28px)*68/360);top:-2px;bottom:-2px;width:calc((100% - 28px)*8/360);background:color-mix(in srgb,var(--liq1) 52%,#E9F2F8)}
${P} .ng-lead p{margin-top:8px;font-size:13px;line-height:1.45;color:var(--sub)}
${P} .ng-lead>small{display:block;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
${P} .ng-lead h2{margin:6px 0 0;font:800 23px/1.12 var(--disp,inherit);letter-spacing:-.03em;color:var(--ink);text-wrap:balance}
${P} .ng-lead .ng-cnt{margin:10px 0 0;font-size:13px;font-weight:700;color:var(--ink)}
${P} .ng-lead .ng-cnt b{font:800 30px var(--disp,inherit);letter-spacing:-.04em;margin-right:6px;background:linear-gradient(160deg,var(--liq1),var(--liq2));-webkit-background-clip:text;background-clip:text;color:transparent}
${P} .ng-adj{color:var(--ink)}
${P} .ng-lead .ng-pr,${P} .sheet .ng-pr{font-size:14px;line-height:1.5;color:var(--ink);margin-top:10px}
${P} .ng-who{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--ink)}${P} .ng-who small{font-size:12px;color:var(--sub)}
${P} .ng-fb{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:12.5px;font-weight:600;color:var(--sub)}
${P} .ng-fb button{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.1)}${P} .ng-fb svg.ic{width:22px;height:22px}
${P} .ng-pipe{fill:none;stroke:color-mix(in srgb,var(--liq1) 52%,#E9F2F8);stroke-width:8;stroke-linecap:round}
${P} .ng-flow{fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-dasharray:1 21;opacity:.9}
${P} .ng-ves{filter:drop-shadow(0 9px 10px rgba(24,119,242,.16))}
${P} .ng-st.none .ng-ves{opacity:.45;filter:none}${P} .ng-st.none text{opacity:.55}
${P} .ng-st[data-ngs]{cursor:pointer}
${P} .ng-glass{fill:#fff;stroke:none}
${P} .ng-line{fill:none;stroke:rgba(10,42,60,.2);stroke-width:2;stroke-linejoin:round}
${P} .ng-rim{fill:none;stroke:rgba(10,42,60,.3);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
${P} .ng-hi{fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;opacity:.75}
${P} .ng-stem{fill:none;stroke:var(--liq2);stroke-width:3.2;stroke-linecap:round}
${P} .ng-open{fill:none;stroke:var(--warn);stroke-width:2.4;stroke-dasharray:5 5;stroke-linecap:round}
${P} .ng-open.q{stroke:rgba(10,42,60,.28)}
${P} .ng-spark{fill:var(--dom);opacity:.85}${P} .ng-spark.ok{fill:#149E6E}
${P} .ng-drip{fill:var(--liq1)}
${P} .ng-coil{fill:none;stroke-linecap:butt}
${P} .ng-coil.a{stroke:rgba(10,42,60,.22);stroke-width:13.5}${P} .ng-coil.b{stroke:#fff;stroke-width:10}${P} .ng-coil.c{stroke:#1D9BE0;stroke-width:10}${P} .ng-coil.c.ok{stroke:#1FAE7C}
${P} .ng-b path,${P} .ng-hl path{fill:url(#ng-g-dom)}
${P} .ng-b text{font:800 12px var(--disp,inherit);fill:#fff}
${P} .ng-h{font-size:14.5px;font-weight:700;fill:var(--ink)}
${P} .ng-t{font-size:14.5px;font-weight:700;fill:var(--ink)}
${P} .ng-k{font-size:13px;font-weight:700;fill:var(--dom)}${P} .ng-k.ok{fill:var(--ok)}${P} .ng-k.warn{fill:var(--warn)}${P} .ng-k.w{fill:var(--faint);font-weight:600}
${P} .ng-v{font:800 28px var(--disp,inherit);letter-spacing:-.03em;fill:var(--ink)}
${P} .ng-u{font:600 13px var(--ff,inherit);fill:var(--sub);letter-spacing:0}
${P} .ng-s{font-size:13.5px;fill:var(--sub)}${P} .ng-s.f{fill:var(--sub);font-size:13px}
${P} .ng-next{cursor:pointer}
${P} .ng-nd{fill:url(#ng-g-dom);filter:drop-shadow(0 4px 5px rgba(24,119,242,.3))}
${P} .ng-ng{fill:none;stroke:#fff;stroke-width:4;stroke-linejoin:round;stroke-linecap:round}
${P} .ng-nt{font:800 21px var(--disp,inherit);letter-spacing:-.03em;fill:var(--ink)}
${P} .ng-go{font-size:14px;font-weight:700;fill:var(--dom)}
${P} .ng-un{font:800 27px var(--disp,inherit);fill:#fff;letter-spacing:-.03em}
${P} .ng-uu{font-size:13px;font-weight:700;fill:#fff;opacity:.9}
${P} .ng-mark{fill:none;stroke:rgba(10,42,60,.3);stroke-width:1.4;stroke-dasharray:3 4}
${P} .ng-ctx circle{fill:none;stroke:var(--liq1);stroke-width:2;stroke-dasharray:3 3}
${P} .ng-hit{fill:transparent;cursor:pointer}
${P} .ng-say{margin:18px 26px 0;font:800 19px/1.2 var(--disp,inherit);letter-spacing:-.02em;text-align:center;color:var(--ink);text-wrap:balance}
${P} .ng-foot{margin:8px 30px 0;font-size:12px;line-height:1.45;text-align:center;color:var(--sub)}
${P} .ng-on{display:flex;flex-direction:column;align-items:center;width:100%;gap:2px;padding-bottom:10px}${P} .ng-on b{font:800 17px var(--disp,inherit);color:var(--ink)}${P} .ng-on small{font-size:12px;color:var(--sub)}
${P} .ng-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
${P} .ng-chips>*{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:600;color:var(--ink);background:color-mix(in srgb,var(--dom) 7%,#fff);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dom) 20%,#fff)}
${P} .ng-chips.tap>*{min-height:44px;padding-inline:14px}
${P} .ng-sh{font:800 22px var(--disp,inherit);letter-spacing:-.02em}${P} .ng-sh small{margin-left:8px;font:600 12px var(--ff,inherit);color:var(--sub)}
${P} .sheet .ng-who{margin-top:16px}

/* Beszélgetés */
${P} .nb{position:relative;--rail:calc(14px + (100% - 28px)*.2)}
${P} .nb::before{content:"";position:absolute;left:calc(var(--rail) - (100% - 28px)*4/360);top:-2px;bottom:-2px;width:calc((100% - 28px)*8/360);background:color-mix(in srgb,var(--liq1) 52%,#E9F2F8)}
${P} .nb:has(>.nb-end)::before{bottom:40px}
${P} .nb.nb2{margin-top:10px}${P} .nb.nb2::before{top:14px;border-radius:4px 4px 0 0}
${P} .nb-six{margin-bottom:4px}${P} .nb-six .np-vh{margin-top:0}
${P} .nb-st{font-style:normal;margin-left:8px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;color:var(--dom);background:color-mix(in srgb,var(--dom) 10%,#fff)}
${P} .nb-st.w{color:#8A5F06;background:color-mix(in srgb,var(--warn) 18%,#fff)}
${P} .nb-tally{display:flex;gap:5px;margin-top:10px}
${P} .nb-tally i,${P} .nb-leg i{display:block;width:16px;height:30px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.16)}
${P} .nb-tally i.p,${P} .nb-leg i.p{background:linear-gradient(180deg,var(--liq1),var(--liq2));box-shadow:none}
${P} .nb-tally i.m,${P} .nb-leg i.m{background:none;box-shadow:none;border:1.5px dashed var(--warn)}
${P} .nb-leg{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin-top:8px;font-size:12px;color:var(--sub)}${P} .nb-leg b{flex:1 1 100%;color:var(--ink)}
${P} .nb-leg span{display:flex;align-items:center;gap:4px}${P} .nb-leg i{width:8px;height:14px}
${P} .nb-m.log{display:flex;align-items:flex-start;gap:8px;padding-top:9px;padding-bottom:9px;padding-left:calc(var(--rail) + 22px)}
${P} .nb-m.log time{top:12px}
${P} .nb-dot{position:absolute;left:calc(var(--rail) - 8px);top:11px;width:16px;height:16px;border-radius:50%;background:linear-gradient(160deg,var(--liq1),var(--liq2));box-shadow:0 0 0 3px #E9F2F8}
${P} .nb-m.log .nb-b{flex:1;min-width:0}${P} .nb-m.log .nb-t{font-size:12.5px;line-height:1.4;color:var(--sub);margin-top:1px}
${P} .nb-m.log em{font-style:normal;font-size:12.5px;font-weight:700;color:var(--ink);white-space:nowrap;padding-top:2px}
${P} .ng-lead.first{padding-top:16px}${P} .ng-lead.first::before{top:10px;border-radius:4px 4px 0 0}
${P} .ng-lead .btn{margin-top:4px}
${P} .bd .k2-vial small i,${P} .mx-s .k2-vial small i{display:none}
${P} text.ng-go[data-go]{cursor:pointer}
${P} .mt-more{display:grid;grid-template-columns:repeat(4,1fr);row-gap:18px;margin:0 14px}
${P} .mt-more button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:0 3px;text-align:center;min-width:0}
${P} .mt-bub{display:grid;place-items:center;width:58px;height:58px;border-radius:50% 50% 50% 50%/42% 42% 58% 58%;background:#fff;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--liq1) 45%,#fff),0 10px 14px -10px var(--liq2)}
${P} .mt-bub>svg.ic{width:28px;height:28px}
${P} .mt-more b{margin-top:5px;font-size:12px;font-weight:700;line-height:1.2;color:var(--ink)}${P} .mt-more small{font-size:12px;line-height:1.25;color:var(--sub)}
${P} .mt-acts{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px 14px;margin:20px 16px 0}
${P} .mt-km{display:flex;align-items:center;gap:12px;min-height:48px;width:calc(100% - 44px);margin:18px 22px 0;text-align:left}
${P} .mt-km>svg.ic{width:32px;height:32px;flex:none}${P} .mt-km b{display:block;font-size:14.5px;font-weight:700;color:var(--ink)}${P} .mt-km small{font-size:12px;color:var(--sub)}
${P} .nb-lead{position:relative;padding:8px 22px 14px calc(var(--rail) + 22px)}
${P} .nb-lead small{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
${P} .nb-lead h2{margin:6px 0 0;font:800 23px/1.12 var(--disp,inherit);letter-spacing:-.03em;color:var(--ink)}
${P} .nb-lead p{margin-top:8px;font-size:12.5px;line-height:1.45;color:var(--sub)}
${P} .nb-trib{position:relative;display:flex;align-items:center;gap:10px;width:100%;min-height:64px;padding:0 14px 0 0;text-align:left}
${P} .nb-trib>svg{position:absolute;left:calc(var(--rail) - 22px);top:0;width:120px;height:64px;overflow:visible}
${P} .nb-duo{position:relative;display:flex;flex-direction:column;gap:4px;margin-left:calc(var(--rail) + 58px)}
${P} .nb-tt b{display:block;font-size:14px;font-weight:700;color:var(--ink)}${P} .nb-tt small{display:block;font-size:12px;line-height:1.35;color:var(--sub)}
${P} .nb-mark{position:relative;margin:18px 0 6px;height:22px}
${P} .nb-mark::before{content:"";position:absolute;left:14px;right:14px;top:10px;height:0;border-top:1.5px dashed color-mix(in srgb,var(--liq2) 30%,#fff)}
${P} .nb-mark span{position:absolute;left:calc(var(--rail) + 22px);top:0;padding:2px 10px;border-radius:999px;background:#EAF2F8;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)}
${P} .nb-m{position:relative;display:block;width:100%;padding:12px 16px 14px calc(var(--rail) + 36px);text-align:left}
${P} .nb-m time{position:absolute;left:8px;top:25px;width:calc(var(--rail) - 34px);text-align:right;font:500 11px var(--mono,ui-monospace,monospace);color:var(--sub)}
${P} .nb-node{position:absolute;left:calc(var(--rail) - 24px);top:6px;width:48px;height:48px;display:grid;place-items:center}
${P} .nb-node>svg:first-child{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 5px 6px color-mix(in srgb,var(--c) 40%,transparent))}
${P} .nb-node>svg:first-child path{fill:var(--c)}
${P} .nb-node svg.ic{position:relative;width:20px;height:20px;margin-top:9px;--ic:#fff;--ic2:rgba(255,255,255,.3);--icf:transparent}
${P} .nb-node.old>svg:first-child{filter:none}${P} .nb-node.old>svg:first-child path{fill:#fff;stroke:color-mix(in srgb,var(--c) 55%,#fff);stroke-width:2.5}
${P} .nb-node.old svg.ic{--ic:var(--c);--ic2:color-mix(in srgb,var(--c) 45%,#fff)}
${P} .nb-h{display:block;font-size:12px;color:var(--sub)}${P} .nb-h b{font-size:14.5px;font-weight:800;color:var(--ink);margin-right:7px}
${P} .nb-t{display:block;margin-top:4px;font-size:14px;line-height:1.5;color:var(--ink)}
${P} .nb-m.old .nb-t{color:var(--sub)}
${P} .nb-l{margin-top:12px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
${P} .nb-f{display:grid;gap:6px;margin-top:8px}${P} .nb-f span{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink)}${P} .nb-f svg.ic{width:20px;height:20px;flex:none}
${P} .nb-a{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}${P} .nb-a>span{font-size:12.5px;font-weight:600;color:var(--sub)}
${P} .nb-ok{display:flex;align-items:center;gap:6px;color:var(--ok)!important}${P} .nb-ok svg{width:16px;height:16px;fill:none;stroke:var(--ok);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
${P} .nb-end{position:relative;display:flex;align-items:center;gap:14px;width:100%;margin-top:10px;padding:0 16px 0 calc(var(--rail) - 36px);text-align:left}
${P} .nb-end svg{width:72px;height:72px;flex:none;overflow:visible;filter:drop-shadow(0 8px 9px rgba(24,119,242,.3))}${P} .nb-end path{fill:url(#ng-g-dom)}
${P} .nb-end b{display:block;font:800 18px var(--disp,inherit);letter-spacing:-.02em;color:var(--ink)}${P} .nb-end small{display:block;font-size:12.5px;color:var(--sub)}

/* shared plain lead (no rail) */
${P} .pg-lead{padding:16px 22px 0}
${P} .pg-lead small{font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
${P} .pg-lead h2{margin:6px 0 0;font:800 24px/1.12 var(--disp,inherit);letter-spacing:-.03em;color:var(--ink);text-wrap:balance}
${P} .pg-lead p{margin-top:8px;font-size:13px;line-height:1.45;color:var(--sub)}
${P} .mx-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:30px 22px 8px;min-height:44px}
${P} .mx-h b{font:800 20px var(--disp,inherit);letter-spacing:-.03em;color:var(--ink)}${P} .mx-h span{font-size:12px;color:var(--sub);text-align:right}

/* Mai · grouping without cards: every logical unit is one full-width layer of the page. Layers alternate
   between the ground and a lighter one, and the lighter one has a wave edge above and below. */
${P} .bd{position:relative;padding:2px 0 26px}
${P} .bd.w{background:rgba(255,255,255,.72);margin:10px 0}
${P} .bd.w::before,${P} .bd.w::after{content:"";position:absolute;left:0;right:0;height:12px;background:rgba(255,255,255,.72);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 13' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q11.25 0 22.5 7 T45 7 T67.5 7 T90 7 V13 H0Z'/%3E%3C/svg%3E") repeat-x 0 0/90px 12px;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 13' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q11.25 0 22.5 7 T45 7 T67.5 7 T90 7 V13 H0Z'/%3E%3C/svg%3E") repeat-x 0 0/90px 12px}
${P} .bd.w::before{top:-11.5px}${P} .bd.w::after{bottom:-11.5px;transform:scaleY(-1);-webkit-mask-position:-45px 0;mask-position:-45px 0}
${P} .bd.w.last{padding-bottom:150px;margin-bottom:-118px}${P} .bd.w.last::after{display:none}
${P} .bd .mx-h{margin-top:16px}
${P} .bd>.fh-n{margin-top:18px}${P} .bd>.rt-chain{margin-top:18px}${P} .bd .rt-b:not(.wrap):nth-last-child(-n+3){height:100px}
${P} .bd.last:not(.w){padding-bottom:10px}
${P} .bd.w .rt-ok{box-shadow:0 0 0 2px #fff}
${P} .ng-band{fill:rgba(255,255,255,.72)}
${P} .ng-lead.w{background:rgba(255,255,255,.72)}
${P} .rt-lead{padding-bottom:18px}
${P} .bd .mx-h b{display:flex;align-items:center;gap:10px}
${P} .bd .mx-h b::before{content:"";flex:none;width:12px;height:16px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:linear-gradient(160deg,var(--liq1),var(--liq2))}
/* Mai · one ground, wave-line dividers, cards and card carousels */
${P} .mx{background:#F4F8FB;margin-top:-1px;padding-bottom:20px}
${P} .scroll:has(.mx){background:#F4F8FB}
${P} .mx-s{position:relative;padding:4px 0 22px}
${P} .mx-s.ln::before{content:"";position:absolute;left:18px;right:18px;top:-6px;height:12px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 12'%3E%3Cpath d='M0 6 Q12 0 24 6 T48 6' fill='none' stroke='%23B9CFDD' stroke-width='2'/%3E%3C/svg%3E") repeat-x 0 0/48px 12px}
${P} .mx .mx-h{margin-top:14px}
${P} .mx .mx-h b::before{display:none}
${P} .mx-card{margin:12px 14px 0;padding:2px 0 14px;border-radius:24px;background:#fff;box-shadow:0 10px 26px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .mx-card .pg-lead{padding-top:16px}${P} .mx-card svg.ng{width:calc(100% - 20px);margin:10px 10px 0}
${P} .cr{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 18px;padding:4px 18px 16px;scrollbar-width:none}
${P} .cr::-webkit-scrollbar{display:none}
${P} .cr-c{flex:0 0 84%;scroll-snap-align:start;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .cr-c.obs .lk{padding:14px 16px 6px}
${P} .cr.sm .cr-c{flex:0 0 34%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:128px;padding:14px 8px;text-align:center}
${P} .cr.sm .cr-c b{font-size:13px;font-weight:700;line-height:1.2;color:var(--ink)}
/* Mai · the old hero vessel without its card */
${P} .tk-lebego .k2-tank{background:none;box-shadow:none}
${P} .tk-lebego .k2-tank .k2-liq{box-shadow:0 26px 40px -30px var(--liq2)}
${P} .tk-lebego .k2-air small{font-size:12px}
/* without the button row the number sits low in the liquid (the kit leaves 86 px for the button) */
${P} .tk-lebego .k2-liq .n{bottom:26px}${P} .tk-lebego .k2-bub{display:none}${P} .tk-lebego .k2-liq .marks{bottom:30px}
/* on a narrow phone the sentence takes three lines: give the air more room so the wave never touches it */
${P} .tk-lebego{container-type:inline-size}
@container (max-width:340px){${P} .tk-lebego .k2-tank{height:372px!important}${P} .tk-lebego .k2-liq .marks span:last-child{visibility:hidden}}${P} .tk-lebego .marks span{font-size:12px!important}
/* Mai · real buttons, carousel dots, the closing section */
${P} .mx-next .mx-btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;margin-top:8px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink));background:color-mix(in srgb,var(--dom) 9%,#fff);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--dom) 28%,#fff)}
${P} .mx-next .mx-btn.pri{color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 8px 14px -8px var(--liq2)}
${P} .mx-next button{padding-bottom:4px}
/* the three buttons stand on one line even when a title wraps */
${P} .mx-next .mx-btn{margin-top:auto}${P} .mx-next b{margin-bottom:8px}
${P} .cr-dots{display:flex;justify-content:center;gap:6px;margin-top:-4px}
${P} .cr-dots i{width:7px;height:7px;border-radius:999px;background:rgba(10,42,60,.18);transition:width .2s}
${P} .cr-dots i.on{width:20px;background:var(--dom)}
${P} .mx-end{padding:30px 22px 120px}
${P} .mx-km{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:52px;border-radius:999px;font-size:15px;font-weight:700;color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.14),0 6px 14px -10px rgba(10,42,60,.4)}
${P} .mx-km svg.ic{width:24px;height:24px}
${P} .mx{padding-bottom:0}
/* Mai · the top: the day line */
${P} .hv-n{font:800 64px/1 var(--disp,inherit);letter-spacing:-.05em;color:var(--ink)}
${P} .hv-c{display:grid;grid-template-columns:1fr auto;column-gap:14px;align-items:end}${P} .hv-c small{grid-column:1/-1}${P} .hv-c h2{margin-bottom:2px}
${P} svg.ng:has(.ar-now){margin-top:12px}
/* Mai · the arc */
${P} .ar-base{fill:none;stroke:rgba(10,42,60,.2);stroke-width:1.4;stroke-dasharray:2 5}
${P} .ar-a,${P} .ar-b,${P} .ar-c{fill:none;stroke-linecap:round}
${P} .ar-a{stroke:rgba(10,42,60,.18);stroke-width:19}${P} .ar-b{stroke:#fff;stroke-width:15.5}${P} .ar-c{stroke:url(#ng-g-arc);stroke-width:15.5}
${P} .ar-p{fill:#fff}${P} .ar-f{fill:#fff;stroke:rgba(10,42,60,.35);stroke-width:2}
${P} .ar-now{fill:#fff;stroke:var(--dom);stroke-width:3.5;filter:drop-shadow(0 4px 5px rgba(24,119,242,.4))}${P} .ar-now2{fill:var(--dom)}
${P} .ar-nl{font-size:13px;font-weight:800;fill:var(--dom)}
${P} .ar-t{font:500 13px var(--mono,ui-monospace,monospace);fill:var(--sub)}
/* Mai · the next three */
${P} .mx-next{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:4px;margin:0 12px}
${P} .mx-next button{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;padding:0 2px;text-align:center}
${P} .mx-next svg.ng{width:86px;height:86px;margin:0}
${P} .mx-next .ng-pipe,${P} .mx-next .ng-flow,${P} .mx-next .ng-drip{display:none}
${P} .mx-next em{margin-top:4px;font:800 22px var(--disp,inherit);font-style:normal;letter-spacing:-.03em;color:var(--ink)}
${P} .mx-next button.now em{color:var(--dom)}
${P} .mx-next b{font-size:13px;font-weight:700;line-height:1.2;color:var(--ink)}${P} .mx-next small{font-size:12px;line-height:1.3;color:var(--sub)}
${P} .mx-next .fh-lk{margin-top:0;font-size:13.5px}
/* Mai · the jar */
${P} .jr{position:relative;margin:6px 26px 10px}
${P} .jr::before{content:"";position:absolute;left:-10px;right:-10px;top:-4px;height:9px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.2);z-index:2}
${P} .jr-in{border:2px solid rgba(10,42,60,.2);border-top:0;border-radius:0 0 44px 44px;overflow:hidden;background:#fff;box-shadow:0 18px 22px -18px rgba(24,119,242,.5)}
${P} .jr-air{padding:16px 10px 20px;font-size:12px;text-align:center;color:var(--sub)}
${P} .jr-l{position:relative;display:flex;align-items:flex-start;gap:10px;width:100%;padding:10px 16px 12px;text-align:left;background:color-mix(in srgb,var(--k) var(--a,15%),#fff)}
${P} .jr-l::before{content:"";position:absolute;left:0;right:0;top:-8px;height:9px;background:inherit;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 13' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q11.25 0 22.5 7 T45 7 T67.5 7 T90 7 V13 H0Z'/%3E%3C/svg%3E") repeat-x 0 0/72px 9px;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 13' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q11.25 0 22.5 7 T45 7 T67.5 7 T90 7 V13 H0Z'/%3E%3C/svg%3E") repeat-x 0 0/72px 9px}
${P} .jr-l:nth-of-type(even)::before{-webkit-mask-position:-30px 0;mask-position:-30px 0}

${P} .jr-l.k-fuel{--k:#149E6E}${P} .jr-l.k-nap{--k:#1877F2}${P} .jr-l.k-en{--k:#19B9C6;--a:20%}
${P} .jr-l time{flex:none;width:40px;padding-top:2px;font:500 12px var(--mono,ui-monospace,monospace);color:var(--sub)}
${P} .jr-l span{flex:1;min-width:0}${P} .jr-l b{display:block;font-size:14px;font-weight:700;color:var(--ink)}${P} .jr-l small{display:block;font-size:12px;line-height:1.35;color:var(--sub)}
${P} .jr-l em{font-style:normal;font-size:12.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink));white-space:nowrap;padding-top:2px}
${P} .jr-l{min-height:48px}
${P} .jr-more{display:block;width:100%;min-height:52px;padding:6px 16px 22px;font-size:13.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink));background:color-mix(in srgb,var(--dom) 8%,#fff);text-align:center}
${P} .jr-l:last-of-type{padding-bottom:12px}

/* Beszélgetés · Üzenetek: depth */
${P} .pl-air{padding:16px 22px 0}
${P} .pl-air>small{font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
${P} .pl-air h2{margin:6px 0 0;font:800 24px/1.12 var(--disp,inherit);letter-spacing:-.03em;color:var(--ink)}
${P} .pl-air p{margin-top:8px;font-size:12.5px;line-height:1.45;color:var(--sub)}
${P} .pl-buoy{position:relative;z-index:2;display:flex;align-items:center;gap:12px;margin:14px 0 -30px;text-align:left}
${P} .pl-buoy svg{width:64px;height:64px;flex:none;overflow:visible;filter:drop-shadow(0 8px 9px rgba(24,119,242,.35))}${P} .pl-buoy path{fill:url(#ng-g-dom)}
${P} .pl-buoy b{display:block;font:800 17px var(--disp,inherit);letter-spacing:-.02em;color:color-mix(in srgb,var(--dom) 85%,var(--ink));padding-bottom:26px}${P} .pl-buoy small{display:block;font-size:12px;color:var(--sub);padding-bottom:26px}
${P} .pl-water{position:relative;margin-top:12px;padding:34px 0 18px;background:linear-gradient(180deg,color-mix(in srgb,var(--liq1) 20%,#fff),color-mix(in srgb,var(--dom) 15%,#fff))}
${P} .pl-water.deep{margin-top:0;padding-top:14px;padding-bottom:40px;background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 24%,#fff),color-mix(in srgb,var(--dom) 34%,#fff))}
${P} .pl-wave{position:absolute;left:0;right:0;top:-11px;height:12px;background:color-mix(in srgb,var(--liq1) 20%,#fff);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 13' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q11.25 0 22.5 7 T45 7 T67.5 7 T90 7 V13 H0Z'/%3E%3C/svg%3E") repeat-x 0 0/90px 12px;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 13' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q11.25 0 22.5 7 T45 7 T67.5 7 T90 7 V13 H0Z'/%3E%3C/svg%3E") repeat-x 0 0/90px 12px}
${P} .pl-water.deep .pl-wave{background:color-mix(in srgb,var(--dom) 24%,#fff)}
${P} .pl-day{padding:4px 22px 6px;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:color-mix(in srgb,var(--dom) 60%,var(--ink))}
${P} .pl-m{position:relative;display:flex;align-items:flex-start;gap:12px;width:100%;padding:12px 20px 14px calc(16px + var(--x,0px));text-align:left}
${P} .pl-b{flex:1;min-width:0}
${P} .pl-bub{position:relative;display:grid;place-items:center;flex:none;width:var(--s);height:var(--s);border-radius:50%;background:radial-gradient(circle at 30% 26%,color-mix(in srgb,var(--c) 55%,#fff),var(--c) 62%);box-shadow:0 8px 12px -6px color-mix(in srgb,var(--c) 70%,transparent),inset 0 0 0 2px rgba(255,255,255,.5)}
${P} .pl-bub svg.ic{width:44%;height:44%;--ic:#fff;--ic2:rgba(255,255,255,.3);--icf:transparent}
${P} .pl-bub.old{background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--c) 55%,#fff)}
${P} .pl-bub.old svg.ic{--ic:var(--c);--ic2:color-mix(in srgb,var(--c) 45%,#fff)}
${P} .pl-two{display:flex;flex:none}${P} .pl-two .pl-bub+.pl-bub{margin-left:-12px}
${P} .pl-m .fh-lk{display:flex}
${P} .pl-m.old .nb-t{font-size:13px;color:color-mix(in srgb,var(--ink) 70%,var(--dom))}${P} .pl-m.old .nb-h b{font-size:13.5px}
${P} .pl-o{position:absolute;width:var(--s);height:var(--s);border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.85);background:rgba(255,255,255,.25);pointer-events:none}

/* Beszélgetés · Életjelek: the rack and the tag */
${P} .rk{position:relative;margin-top:18px;padding-bottom:14px}${P} .rk .np-vh{margin-top:0}
${P} .rk-shelf{position:absolute;left:8px;right:8px;bottom:0;height:8px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.2)}
${P} .rk-str{display:block;width:100%;height:46px;overflow:visible}
${P} .rk-str path{fill:none;stroke:var(--warn);stroke-width:2;stroke-dasharray:1 5;stroke-linecap:round;vector-effect:non-scaling-stroke}
${P} .rk-tag{position:relative;margin:0 20px 0 26px;padding:16px 18px 16px 44px;background:color-mix(in srgb,var(--warn) 13%,#fff);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--warn) 45%,#fff),0 14px 18px -14px rgba(160,110,10,.55);border-radius:6px 20px 20px 6px;clip-path:polygon(22px 0,100% 0,100% 100%,22px 100%,0 calc(100% - 26px),0 26px)}
${P} .rk-hole{position:absolute;left:14px;top:calc(50% - 8px);width:16px;height:16px;border-radius:50%;background:#EAF2F8;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--warn) 55%,#fff)}

/* Beszélgetés · Észrevételek: communicating vessels */
${P} .lk{padding:10px 22px 0}
${P} .lk-tap{display:block;width:100%;text-align:left}
${P} .lk-go{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;margin:8px auto 0;padding:0 18px;width:max-content;max-width:100%;border-radius:999px;font-size:14px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink));background:color-mix(in srgb,var(--dom) 9%,#fff);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--dom) 28%,#fff)}
${P} .lk-go.ok{color:#0E7A55}${P} .lk-go svg{width:16px;height:16px;fill:none;stroke:var(--ok);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
${P} .sheet .lk-g{margin-top:6px}${P} .sheet .ng-sh small{padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--dom) 10%,#fff);color:var(--dom);font-weight:700}
${P} .lk-h{display:flex;align-items:center;flex-wrap:wrap;gap:6px 0}${P} .lk-h b{font:800 19px var(--disp,inherit);letter-spacing:-.02em;color:var(--ink)}
${P} .lk-g{display:block;width:100%;max-width:380px;margin:12px auto 0;overflow:visible}
${P} .lk-g text{font-family:var(--ff,inherit)}
${P} .lk-p{fill:none;stroke:rgba(10,42,60,.14);stroke-width:22;stroke-linecap:round}
${P} .lk-s{fill:#fff;stroke:rgba(10,42,60,.16);stroke-width:1.5}${P} .lk-s.p{fill:url(#ng-g-seg);stroke:none}${P} .lk-s.m{fill:#fff;stroke:var(--warn);stroke-width:1.8;stroke-dasharray:3 3}
${P} .lk-v{fill:#fff;stroke:rgba(10,42,60,.2);stroke-width:2;filter:drop-shadow(0 8px 8px rgba(24,119,242,.18))}
${P} .lk-lab{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:6px;margin-top:6px;text-align:center}
${P} .lk-lab>span{display:flex;flex-direction:column;font-size:12.5px;line-height:1.3;color:var(--sub)}${P} .lk-lab b{font-size:13.5px;font-weight:700;color:var(--ink)}
${P} .lk-lab .lk-mid b{font-size:13px}
${P} .lk .nb-leg{justify-content:center}${P} .lk .ng-who{margin-top:14px}${P} .lk .nb-t{margin-top:6px}
${P} .lk-sep{display:block;height:1px;margin:26px 22px 4px;border-top:1.5px dashed color-mix(in srgb,var(--liq2) 28%,#fff)}

/* Életjelek (detail): two shelves of three tubes, each with its own action */
${P} .ej{margin-top:22px}${P} .ej+.ej{margin-top:26px}
${P} .ej .k2-vial small{font-size:13.5px;font-weight:700;color:var(--ink)}
${P} .bd .ej .k2-vial small i{display:flex;align-items:center;justify-content:center;min-height:36px;font-style:normal;font-size:13.5px;font-weight:700;color:color-mix(in srgb,var(--dom) 85%,var(--ink))}
${P} .ej .k2-vial b{font-size:22px}

/* Check-in: the four snapshots */
${P} .ci{display:grid;grid-template-columns:86px repeat(4,1fr);margin:22px 10px 0}
${P} .ci-l,${P} .ci-c{display:flex;flex-direction:column;align-items:center;min-width:0;padding:0}
${P} .ci-l{align-items:flex-start}
${P} .ci-h{display:flex;flex-direction:column;align-items:center;justify-content:center;height:58px}
${P} .ci-h b{font:800 15px var(--disp,inherit);letter-spacing:-.02em;color:var(--ink)}${P} .ci-h small{font-size:12px;color:var(--sub)}
${P} .ci-r{display:flex;align-items:center;gap:5px;height:56px;width:100%;justify-content:center}
${P} .ci-l .ci-r{justify-content:flex-start;padding-left:4px;border-radius:14px 0 0 14px}
${P} .ci-g{display:flex;align-items:flex-end;height:38px;width:100%;padding:0 0 6px 4px;white-space:nowrap}${P} .ci-g b{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)}
${P} .ci-no{width:6px;height:6px;border-radius:50%;background:rgba(10,42,60,.14)}
/* the feeling that moved the most today: no coloured band — its vessels carry the strong liquid, its name the change */
${P} .ci-r.hot .ci-v:not(.e){background:linear-gradient(to top,var(--liq2) 0,var(--liq1) var(--p),#fff var(--p));box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dom) 55%,#fff),0 6px 10px -6px var(--liq2)}
${P} .ci-r.hot .ci-v:not(.e) b{color:#fff;text-shadow:0 1px 2px rgba(10,60,140,.35)}
/* a low value leaves the number above the liquid: it stays dark there */
${P} .ci-r.hot .ci-v.lo b{color:var(--ink);text-shadow:none}
${P} .ci-l .ci-r.hot b{color:var(--dom)}
${P} .ci-l .ci-r.hot{flex-wrap:wrap;align-content:center;row-gap:1px}${P} .ci-l .ci-r.hot em{flex:1 1 100%;padding-left:25px;font:800 12.5px var(--disp,inherit);font-style:normal;color:var(--dom);line-height:1}
${P} .ci-v.wn{background:linear-gradient(to top,color-mix(in srgb,var(--warn) 40%,#fff) 0 var(--p),color-mix(in srgb,var(--warn) 80%,#fff) var(--p) calc(var(--p) + 2px),#fff calc(var(--p) + 2px))}
${P} .ci-l .ci-r svg.ic{width:20px;height:20px;flex:none}${P} .ci-l .ci-r b{font-size:12.5px;font-weight:700;color:var(--ink)}
${P} .ci-f{display:flex;align-items:center;justify-content:center;min-height:48px;font-size:13px;font-weight:700;white-space:nowrap}
${P} .ci-c{border-radius:26px}
${P} .ci-c.now{background:color-mix(in srgb,var(--dom) 9%,#fff);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dom) 45%,#fff)}
${P} .ci-c.now .ci-h b{color:var(--dom)}
${P} .ci-c.later .ci-h b,${P} .ci-c.later .ci-h small{color:var(--faint)}${P} .ci-c.later .ci-f{color:var(--sub)}
${P} .ci-v{position:relative;display:grid;place-items:center;width:40px;height:44px;border-radius:20px;font-style:normal;
  background:linear-gradient(to top,color-mix(in srgb,var(--liq1) 42%,#fff) 0 var(--p),color-mix(in srgb,var(--liq1) 80%,#fff) var(--p) calc(var(--p) + 2px),#fff calc(var(--p) + 2px));box-shadow:inset 0 0 0 2px rgba(10,42,60,.16)}
${P} .ci-v b{font:800 16px var(--disp,inherit);color:var(--ink)}
${P} .ci-v.e{background:none;box-shadow:none;border:2px dashed rgba(10,42,60,.2)}
${P} .ci-c.now .ci-v.e{border-color:color-mix(in srgb,var(--dom) 55%,#fff)}
${P} .ci-all{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 10px;margin-top:14px}
${P} .ci-all span{display:flex;align-items:center;gap:10px;min-width:0}${P} .ci-all em{font-style:normal;font-size:13.5px;font-weight:700;color:var(--ink)}${P} .ci-all em small{display:block;font-size:12px;font-weight:500;color:var(--sub)}
${P} .ci-all .ci-v{flex:none}

/* Napi küldetések: flasks */
${P} .qs-r{display:flex;align-items:flex-start;gap:14px;padding:22px 22px 0 14px}
${P} .qs svg.qf{flex:none;width:96px;height:96px;margin:0}
${P} .qs-xp{font:800 34px var(--disp,inherit);letter-spacing:-.04em;fill:var(--ink)}
${P} .qf-cork{fill:#C9A26B;stroke:rgba(10,42,60,.25);stroke-width:1.5}
${P} .qs-b{flex:1;min-width:0}
${P} .nb-st.ok{color:#0E7A55;background:color-mix(in srgb,var(--ok) 16%,#fff)}
${P} .qs-t{margin-top:6px;font:700 16px/1.25 var(--disp,inherit);letter-spacing:-.01em;color:var(--ink)}
${P} .qs-w{margin-top:6px;font-size:12.5px;line-height:1.45;color:var(--sub)}
${P} .qs-f{margin-top:8px;font-size:12px;font-weight:600;color:var(--sub)}

${P} .pl-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
${P} .ng-lead .ng-adj{font-size:13px;font-weight:700;color:var(--sub)}
${P} .sheet .ng-adj2{margin-top:10px;font-size:13.5px;line-height:1.45;color:var(--sub)}${P} .sheet .ng-adj2 b{color:var(--ink)}
${P} text.ng-go[data-ngm]{cursor:pointer}
/* A napom in the Mai system (2026-10-14): one ground, wave lines, plain headings, real buttons */
${P} .ng-wl{fill:none;stroke:#B9CFDD;stroke-width:2}
${P} .ng-j{fill:url(#ng-g-dom)}
${P} .ng-h2{font:800 19px var(--disp,inherit);letter-spacing:-.03em;fill:var(--ink)}
${P} .ng-pl rect{fill:color-mix(in srgb,var(--dom) 9%,#fff);stroke:color-mix(in srgb,var(--dom) 28%,#fff);stroke-width:1.5}
${P} .ng-pl text{font-size:13.5px;font-weight:700;fill:color-mix(in srgb,var(--dom) 85%,var(--ink))}
${P} .ng-pl.pri rect{fill:url(#ng-g-dom);stroke:none}${P} .ng-pl.pri text{fill:#fff;font-size:14px}
${P} [data-ngm],${P} [data-ngs]{cursor:pointer}
${P} .ng-n{font-size:13.5px;fill:var(--ink)}
${P} .ng-pill{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:6px;padding:0 20px;border-radius:999px;font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 8px 14px -8px var(--liq2)}
${P} .ng-pill.wide{display:flex;width:100%;min-height:52px;font-size:15px;color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.14),0 6px 14px -10px rgba(10,42,60,.4)}
${P} .ng-end{padding:8px 22px 120px}
/* A napom round 7: Mai's blocks */
${P} .n6{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 6px;margin:6px 12px 0}
${P} .n6-c{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;min-height:44px;padding:0 2px;text-align:center}
${P} .n6-c svg.ng,${P} .n7-next svg.ng{width:84px;height:84px;margin:0}
${P} .n6 .ng-pipe,${P} .n6 .ng-flow,${P} .n6 .ng-drip,${P} .n7-next .ng-pipe,${P} .n7-next .ng-flow,${P} .n7-next .ng-drip{display:none}
${P} .n6-c em{margin-top:4px;font:800 20px var(--disp,inherit);font-style:normal;letter-spacing:-.03em;color:var(--ink);white-space:nowrap}
${P} .n6-c em small{margin-left:3px;font:700 12px var(--sans,inherit);letter-spacing:0;color:var(--ink)}
${P} .n6-c b{font-size:13px;font-weight:700;color:var(--ink)}${P} .n6-c b i{font-style:normal;color:var(--dom)}
${P} .n6-c.none em{color:#8FA3B3}
${P} .n7-next{display:flex;align-items:center;gap:14px;margin:4px 22px 0}
${P} .n7-next b{display:block;font-size:16px;font-weight:700;line-height:1.25;color:var(--ink)}
${P} .n7-next .mx-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:10px;padding:0 20px;border-radius:999px;font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 8px 14px -8px var(--liq2)}
${P} .n7-te{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:16px;margin:6px 22px 0}${P} .n7-te .k2-vials{margin:0}${P} .n7-te .n7-say{margin:0}
${P} .n7-say{margin:14px 22px 0;font:800 18px/1.25 var(--disp,inherit);letter-spacing:-.02em;color:var(--ink)}
${P} .n7-hl{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:18px 18px 20px}
${P} .n7-hl b{font:800 18px/1.25 var(--disp,inherit);letter-spacing:-.02em;color:var(--ink)}
${P} .n7-ctx{display:grid;grid-template-columns:1fr 1fr;gap:16px 12px;margin:6px 22px 0}
${P} .n7-ctx span{display:block;font-size:13px;color:var(--ink)}${P} .n7-ctx b{display:block;margin-top:2px;font:800 18px var(--disp,inherit);letter-spacing:-.02em;color:var(--ink)}
${P} .n7-h{margin:22px 22px 4px;font:800 24px/1.15 var(--disp,inherit);letter-spacing:-.03em;color:var(--ink);text-wrap:balance}${P} .ng-tail{height:110px}
${P} .jr-air{padding:0;height:34px}
/* Rutin */
${P} .fh-n:has(.rt-perf){display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px}
${P} .rt-perf{margin-left:auto;display:inline-flex;align-items:baseline;gap:6px;font:600 12.5px var(--ff,inherit);letter-spacing:0;color:var(--sub)}
${P} .rt-perf strong{font:800 17px var(--disp,inherit);letter-spacing:-.02em;color:var(--ink)}
${P} .bd.last .rt-edit{margin-top:14px}
${P} .rt-foot{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
${P} .rt-fn{flex:1;min-width:0;padding-left:8px}${P} .rt-fn small{display:block;font-size:12px;font-weight:700;color:var(--dom)}${P} .rt-fn b{display:block;font-size:15px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .rt-fdone{flex:1;padding:10px 8px;font-size:14px;font-weight:700;color:var(--ink);text-align:center}
${P} .fh-fab{width:46px;height:46px;right:12px;bottom:92px}${P} .fh-fab svg{width:20px;height:20px}
${P} .rt-lead{padding:14px 22px 0}
${P} .rt-lead small{font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
${P} .rt-lead h2{margin:6px 0 0;font:800 25px/1.1 var(--disp,inherit);letter-spacing:-.03em;color:var(--ink);text-wrap:balance}
${P} .rt-lead p{margin-top:6px;font-size:12.5px;color:var(--sub)}
${P} .rt-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:14px}
${P} .rt-chain{display:grid;grid-template-columns:repeat(3,1fr);margin:14px 14px 0}
${P} .rt-b{position:relative;display:flex;flex-direction:column;align-items:center;height:132px;padding:0 10px;text-align:center}
${P} .rt-b::after{content:"";position:absolute;z-index:0;pointer-events:none}
/* between two vessels: chain links (one seen face-on, one edge-on), grey while ahead, liquid once you are past */
${P} .rt-b.rt::after{top:21px;height:18px;width:calc(100% - 58px);background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 18'%3E%3Cellipse cx='10' cy='9' rx='8.5' ry='5.6' fill='none' stroke='%23B5C7D3' stroke-width='3.2'/%3E%3Crect x='17' y='7.2' width='16' height='3.6' rx='1.8' fill='%23B5C7D3'/%3E%3Crect x='-13' y='7.2' width='16' height='3.6' rx='1.8' fill='%23B5C7D3'/%3E%3C/svg%3E") center/30px 18px repeat-x}
${P} .rt-b.rt::after{left:calc(50% + 29px)}
${P} .rt-b.done.rt::after{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 18'%3E%3Cellipse cx='10' cy='9' rx='8.5' ry='5.6' fill='none' stroke='%231A8FE0' stroke-width='3.2'/%3E%3Crect x='17' y='7.2' width='16' height='3.6' rx='1.8' fill='%2319B9C6'/%3E%3Crect x='-13' y='7.2' width='16' height='3.6' rx='1.8' fill='%2319B9C6'/%3E%3C/svg%3E")}
/* at a row's end: one long link — out to the right, down, back under the labels, and into the next row's first vessel */
${P} .rt-b{height:112px}${P} .rt-b.wrap{height:132px}
${P} .rt-b.wrap::after{left:calc(50% + 24px);right:-8px;top:26px;height:98px;border:4px solid #B5C7D3;border-left:0;border-radius:0 26px 26px 0}
${P} .rt-b.wrap::before{content:"";position:absolute;z-index:0;pointer-events:none;left:calc(-150% - 2px);right:14px;top:120px;height:16px;border:4px solid #B5C7D3;border-right:0;border-bottom:0;border-radius:14px 0 0 0}
${P} .rt-b.done.wrap::after,${P} .rt-b.done.wrap::before{border-color:#1A8FE0}
${P} .rt-v{position:relative;z-index:1;display:grid;place-items:center;width:60px;height:60px;flex:none;border-radius:50%;
  background:linear-gradient(to top,color-mix(in srgb,var(--liq1) 38%,#fff) 0 var(--p),color-mix(in srgb,var(--liq1) 75%,#fff) var(--p) calc(var(--p) + 2px),#fff calc(var(--p) + 2px));
  box-shadow:inset 0 0 0 2px rgba(10,42,60,.14),0 8px 12px -8px rgba(24,119,242,.5)}
${P} .rt-b.ns .rt-v{background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.14)}
${P} .rt-v>svg.ic{width:26px;height:26px}
${P} .rt-b.done .rt-v{background:color-mix(in srgb,var(--ok) 22%,#fff);box-shadow:inset 0 0 0 2.5px var(--ok),0 8px 12px -8px var(--ok)}
${P} .rt-b.done.ns .rt-v{background:color-mix(in srgb,var(--ok) 20%,#fff)}
${P} .rt-b.done .rt-v>svg.ic{--ic:#0E7A55;--ic2:var(--ok)}
${P} .rt-ok{position:absolute;right:-4px;bottom:-3px;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 2px #F3F8FB}
${P} .rt-ok svg{width:14px;height:14px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
${P} .rt-b.now .rt-v{box-shadow:inset 0 0 0 3px var(--dom),0 0 0 5px color-mix(in srgb,var(--dom) 16%,transparent),0 10px 14px -8px var(--dom)}
${P} .rt-b>b{position:relative;z-index:1;margin-top:7px;font-size:12.5px;font-weight:700;line-height:1.2;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
${P} .rt-b>small{margin-top:2px;font-size:12px;color:var(--sub);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .rt-b>small em{font-style:normal;font-weight:800;color:var(--dom)}
${P} .rt-b.done>b{color:var(--sub)}
${P} .rt-note{margin:4px 22px 0;font-size:12px;line-height:1.45;color:var(--sub)}
${P} .rt-flasks{display:flex;justify-content:space-around;gap:8px;margin:14px 18px 0}
${P} .rt-fl{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;min-width:0;text-align:center}
${P} .rt-fl span{display:grid;place-items:center;width:78px;height:78px;border-radius:50% 50% 50% 50%/42% 42% 58% 58%;
  background:linear-gradient(to top,var(--liq2),var(--liq1) var(--p),#fff var(--p));box-shadow:inset 0 0 0 2px rgba(10,42,60,.14),0 10px 14px -10px var(--liq2)}
${P} .rt-fl b{font:800 19px var(--disp,inherit);letter-spacing:-.03em;color:var(--ink);background:rgba(255,255,255,.82);padding:1px 7px;border-radius:999px}
${P} .rt-fl.np span{background:#fff;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dom) 35%,#fff)}
${P} .rt-fl small{font-size:12px;line-height:1.3;color:var(--sub)}
${P} .rt-edit{display:flex;align-items:center;gap:12px;width:calc(100% - 44px);margin:22px 22px 0;padding:6px 0;text-align:left}
${P} .rt-edit>svg.ic{width:34px;height:34px;flex:none}${P} .rt-edit span{flex:1}${P} .rt-edit b{display:block;font-size:15px;font-weight:700;color:var(--ink)}${P} .rt-edit small{font-size:12px;color:var(--sub)}${P} .rt-edit i{font-style:normal;font-size:22px;color:var(--faint)}
@media (prefers-reduced-motion:no-preference){
  /* one thing moves per screen: the flow in the pipe (A napom), the vessel that is next (Rutin). Levels and drops stand still. */
  body:not(.still) ${P} .ng-flow{animation:ng-fl 1.8s linear infinite}
  body:not(.still) ${P} .rt-b.now .rt-v{animation:rt-now 2.4s ease-in-out infinite}
}
@keyframes ng-fl{to{stroke-dashoffset:-22}}
@keyframes rt-now{50%{transform:scale(1.06)}}
`);
window.FNOTES_FOLY=`<h2>Kísérlet · a Nap rajzolva</h2><p>Nincs nagy edény, nincs kártya, nincs lista. Minden oldal saját rajzot kapott, azt, ami a tartalmából következik:</p>
<ul><li><a href="#w-nap-mai"><b>Mai</b></a> — a nap vonala: reggeltől estig, a mostani időpontig feltöltve. Alatta a négy kémcső (változatlan), a három következő teendő három edényként, és a nap befőttesüvege, rétegenként a bejegyzésekkel.</li>
<li><a href="#w-nap-eletjel"><b>Életjelek részletei</b></a> (a Mai aloldala) — a hat kémcső két polcon, mindegyik alatt a saját művelete.</li>
<li><a href="#w-nap-checkin"><b>Check-in</b></a> (a Mai aloldala) — a nap négy pillanatképe egymás mellett: oszloponként egy időpont, soronként egy érzés.</li>
<li><a href="#w-nap-kuldetesek"><b>Napi küldetések</b></a> (a Mai aloldala) — három lombik: ami elkészül, annak a tartalma a nap XP-gyűjtőjébe kerül.</li>
<li><a href="#w-nap-napom"><b>A napom</b></a> — a cső: a nap folyadéka hat edényen fut át. Lezárt napok: <a href="#w-nap-nap.2026-09-23">szerda</a>, <a href="#w-nap-nap.2026-09-22">kedd</a>; kevés adat: <a href="#w-nap-nap.2026-09-21">hétfő</a>.</li>
<li><a href="#w-nap-uzenetek"><b>Beszélgetés</b></a> — vízmélység: a legfrissebb üzenet a felszínen, a régiek lejjebb. <a href="#w-nap-uzenetek.eletjelek">Életjelek</a>: kémcsőállvány, a megjegyzés címkeként lóg a kémcsövén. <a href="#w-nap-uzenetek.eszrevetelek">Észrevételek</a>: közlekedőedény, a cső a bizonyíték napjaival telik.</li>
<li><a href="#w-nap-rutin"><b>Rutin</b></a> — lánc: az edényeket láncszemek kötik össze, soronként kanyarodik, akárhány szokásra. Másik láncok: <a href="#w-nap-rutin.este">este</a>, <a href="#w-nap-rutin.napkozben">napközben</a>.</li></ul>
<p>Összevetésnek a mostani, listás oldalak: <a href="#w-nap-mai-lista">Mai</a> · <a href="#w-nap-napom-lista">A napom</a> · <a href="#w-nap-uzenetek-lista">Beszélgetés</a> · <a href="#w-nap-rutin-lista">Rutin</a>.</p>`+(window.FNOTES_FOLY||'');
})();
