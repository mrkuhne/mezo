/* vilagos/kiserlet-napom.js — EXPERIMENT (owner idea, 2026-10-11): Nap pages without cards, lists or a hero.
   NOT part of the build target: it is loaded only by ../kiserlet-napom-grafika.html, never by the shell
   (klinikai-iranyok.html), so the approved #w-nap-* routes stay what the builders read.
   On the experiment page the three top tabs open the drawn versions:
     napom (+ nap.<date>)  the day as one drawing — a pipe starts under the day's vessel in the week strip and
                           every unit is its own vessel on it; the pipe's bends are the dividers and the spacing
     uzenetek              the conversation as the day's stream — every message is a drop on it, at its time
     rutin                 the chain as a string of vessels that winds down the page, for any number of habits
   The approved list versions stay reachable as napom-lista / uzenetek-lista / rutin-lista.
   Data is copied from nap.js (NDT, NDY, RUTIN, messages): same numbers, same sentences. */
(function(){
const F=window.F,nap=window.FREG&&FREG.nap;if(!nap)return;
const {I,page,badge}=F;
const P='.phone.foly[data-s="elo"][data-d="nap"]';
const O={napom:nap.routes.napom,nap:nap.routes.nap,uzenetek:nap.routes.uzenetek,rutin:nap.routes.rutin};
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
  <linearGradient id="ng-g-prot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0A29B"/><stop offset="1" stop-color="#D9605A"/></linearGradient></defs></svg>`;

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
  /* Ritmus — a coil: the pipe itself swings, and the liquid has climbed p% of it */
  rhythm:o=>{const d='M52 104C52 96 82 98 82 88S22 80 22 68S82 60 82 48S22 40 22 28S52 12 52 0';
    return `<path class="ng-coil a" d="${d}"/><path class="ng-coil b" d="${d}"/><path class="ng-coil c ${o.g}" pathLength="100" stroke-dasharray="${cl(o.p,0,100)} 100" d="${d}"/>`}
};
const wrap=(t,n)=>{const out=[];let cur='';t.split(' ').forEach(w=>{if((cur+' '+w).trim().length>n&&cur){out.push(cur);cur=w}else cur=(cur+' '+w).trim()});if(cur)out.push(cur);return out};
/* one station: the vessel on its side of the page, the words on the other */
function station(s,side,y){const L=side==='L',cx=L?72:288,tx=L?146:214,an=L?'start':'end';
  return `<g class="ng-st ${s.none?'none':''}" ${s.tap?`data-ngs="${s.key}" role="button" tabindex="0"`:''}>${s.tap?`<rect class="ng-hit" x="6" y="${y}" width="348" height="104"/>`:''}
    <g class="ng-ves" transform="translate(${cx-52} ${y})">${V[s.key](s.v)}</g>
    <text class="ng-t" x="${tx}" y="${y+30}" text-anchor="${an}">${s.title}${s.tag?`<tspan class="ng-k ${s.sk}" dx="7">${s.tag}</tspan>`:''}</text>
    <text class="ng-v" x="${tx}" y="${y+62}" text-anchor="${an}">${s.val}${s.unit?`<tspan class="ng-u" dx="4">${s.unit}</tspan>`:''}</text>
    ${s.sub.map((t,i)=>`<text class="ng-s" x="${tx}" y="${y+82+i*16}" text-anchor="${an}">${t}</text>`).join('')}</g>`}
const badgeN=(x,y,n,t,an='start')=>`<g class="ng-b"><path transform="translate(${x-32*.66} ${y-34*.66}) scale(.66)" d="${DROP}"/><text x="${x}" y="${y+7.5}" text-anchor="middle">${n}</text></g>
  <text class="ng-h" x="${an==='start'?x+20:x-20}" y="${y+6}" text-anchor="${an}">${t}</text>`;
/* stations from y0, alternating sides; returns [svg, yEnd] — the S-bends between two stations are the dividers */
function stations(ST,y0,pitch=140){const cx=i=>i%2?288:72;
  const bends=ST.slice(0,-1).map((_,i)=>{const a=cx(i),b=cx(i+1),y=y0+pitch*i+104,g=pitch-104;return `M${a} ${y}C${a} ${y+g*.78} ${b} ${y+g*.22} ${b} ${y+g}`}).join('');
  return [pipe(bends)+ST.map((s,i)=>station(s,i%2?'R':'L',y0+pitch*i)).join(''),y0+pitch*(ST.length-1)+104]}
const lead=inner=>`<div class="ng-lead">${inner}</div>`;
const WEEKX={'2026-09-21':0,'2026-09-22':1,'2026-09-23':2,'2026-09-24':3};
const topPipe=iso=>{const x=Math.round(25.7+51.43*WEEKX[iso]);return svg(40,pipe(`M${x} 0C${x} 30 72 12 72 40`),'ng-top')};
/* the approved page up to (not including) its hero: title bar, tabs, week strip */
function frame(arg,cut){const base=O.nap(arg);const a=base.search(cut),b=base.indexOf('</div><nav class="fh-nav"');return a<0||b<0?null:[base.slice(0,a)+DEFS,base.slice(b)]}

/* ═══ A NAPOM · today (live) ═══ */
function today(){const fr=frame('2026-09-24',/<section class="k2-tank/);if(!fr)return O.nap('2026-09-24');
  const ST=[
    {key:'nutrition',title:'Tápanyag',tag:'úton',sk:'q',val:'2 060',unit:'kcal',sub:['a 2 782-ből','fehérje 148 / 166 g'],v:{p:74,prot:89,g:'dom'}},
    {key:'quality',title:'Minőség',tag:'úton',sk:'q',val:'74',unit:'%',sub:['feldolgozatlan 68%','mikro 80%'],v:{p:74,a:68,b:80,g:'dom'}},
    {key:'training',title:'Edzés',tag:'nyitva',sk:'warn',val:'0/1',sub:['a mai edzés még hátravan'],v:{p:0,g:'warn'}},
    {key:'sleep',title:'Alvás',tag:'kész',sk:'ok',val:'7ó 16p',sub:['minőség 7/10','az éjszaka lezárult'],v:{p:86,g:'ok'}},
    {key:'logging',title:'Logolás',tag:'úton',sk:'q',val:'2/4',sub:['check-in','a nap négy pillanata'],v:{n:2,g:'dom'}},
    {key:'rhythm',title:'Ritmus',tag:'kész',sk:'ok',val:'74',sub:['a heted eddigi üteme'],v:{p:74,g:'ok'}}];
  const [stSvg,yEnd]=stations(ST,262),U=yEnd+96,UU=`M96 ${U}V${U+104}C96 ${U+170} 264 ${U+170} 264 ${U+104}V${U}H212V${U+100}C212 ${U+124} 148 ${U+124} 148 ${U+100}V${U}Z`;
  return fr[0]+topPipe('2026-09-24')+lead(`<small>Csütörtök · szept 24 · élő · 14:20</small>
      <h2>Fehérjéből már csak 18 g hiányzik, az edzés még hátravan.</h2>
      <p class="ng-cnt"><b>2/6</b> terület kész</p>
      <p>Napközben nincs pontszám. Hajnali 3-kor zárom a napot, és reggelre megírom, milyen volt.</p>`)
  +`<svg class="ng" viewBox="0 0 360 ${U+200}" role="img" aria-label="A mai napod rajza: most érdemes, a hat terület, te és az app">
  <defs><clipPath id="ng-c-u"><path d="${UU}"/></clipPath><clipPath id="ng-c-ul"><rect x="0" y="0" width="180" height="${U+200}"/></clipPath><clipPath id="ng-c-ur"><rect x="180" y="0" width="180" height="${U+200}"/></clipPath></defs>
  ${pipe(`M72 0V26M72 50V62M72 196V218M72 242V262M288 ${yEnd}C288 ${yEnd+30} 180 ${yEnd+10} 180 ${yEnd+38}M180 ${yEnd+62}C180 ${yEnd+80} 122 ${yEnd+66} 122 ${yEnd+82}M180 ${yEnd+62}C180 ${yEnd+80} 238 ${yEnd+66} 238 ${yEnd+82}`)}
  ${badgeN(72,38,1,'Most érdemes · délután')}
  <g class="ng-next" data-toast="Edzés megnyitása" role="button" tabindex="0" aria-label="Még hátravan a mai edzés. Edzés megnyitása">
    <rect class="ng-hit" x="10" y="70" width="340" height="142"/><path class="ng-nd" transform="translate(-11.2 46.4) scale(2.6)" d="${DROP}"/>
    <path class="ng-hi" d="M43 142C45 128 52 116 60 106"/>
    <g transform="translate(41.6 117.4) scale(.95)"><path class="ng-ng" d="${DUMB}"/><path class="ng-ng" d="M3 28V36M61 28V36"/></g>
    <text class="ng-nt" x="140" y="112">Még hátravan</text><text class="ng-nt" x="140" y="136">a mai edzés</text>
    <text class="ng-s" x="140" y="160">Utána egy fehérjés vacsora,</text><text class="ng-s" x="140" y="176">és a tápanyag is kész.</text>
    <text class="ng-go" x="140" y="200">Edzés megnyitása ›</text></g>
  ${badgeN(72,230,2,'Ma eddig · 6 terület')}${stSvg}
  ${badgeN(180,yEnd+50,3,'A napod · te és az app')}${drip(122,yEnd+92)}${drip(238,yEnd+92,.8)}
  <g class="ng-ves"><path class="ng-glass" d="${UU}"/>
    <g clip-path="url(#ng-c-u)"><g clip-path="url(#ng-c-ul)"><path class="ng-wv" fill="url(#ng-g-dom)" d="M48 ${U+55}${' q12 -5 24 0 t24 0'.repeat(4)} V${U+200} H48Z"/></g>
      <g clip-path="url(#ng-c-ur)"><path class="ng-wv" fill="url(#ng-g-ok)" d="M132 ${U+46}${' q12 -5 24 0 t24 0'.repeat(4)} V${U+200} H132Z"/></g></g>
    <path class="ng-line" d="${UU}"/><path class="ng-hi" d="M104 ${U+70}V${U+112}"/><path class="ng-hi" d="M220 ${U+62}V${U+112}"/></g>
  <path class="ng-mark" d="M152 ${U+55}H208M152 ${U+46}H208"/>
  <g data-toast="Az app pontszáma: a hat terület súlyozott átlaga" role="button" tabindex="0"><rect class="ng-hit" x="50" y="${U}" width="130" height="198"/>
    <text class="ng-un" x="122" y="${U+96}" text-anchor="middle">64</text><text class="ng-uu" x="122" y="${U+112}" text-anchor="middle">/ 100</text>
    <text class="ng-t" x="108" y="${U+176}" text-anchor="middle">az app szerint</text><text class="ng-s" x="108" y="${U+193}" text-anchor="middle">közepes nap</text></g>
  <g data-toast="A te ítéleted: az esti check-in utolsó kérdése" role="button" tabindex="0"><rect class="ng-hit" x="180" y="${U}" width="130" height="198"/>
    <text class="ng-un" x="238" y="${U+96}" text-anchor="middle">7</text><text class="ng-uu" x="238" y="${U+112}" text-anchor="middle">/ 10</text>
    <text class="ng-t" x="252" y="${U+176}" text-anchor="middle">szerinted</text><text class="ng-s" x="252" y="${U+193}" text-anchor="middle">jó nap</text></g>
  </svg>
  <p class="ng-say">Az app szerint közepes nap, szerinted jó volt.</p>
  <p class="ng-foot">A 7/10 az esti check-in utolsó kérdéséből jön („Milyen volt a napod összességében?”). A napod többi része nem változik.</p>`+fr[1]}

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
function closed(iso){const fr=frame(iso,/<section class="k2-tank/);if(!fr)return O.nap(iso);const v=NDY,[dn,dd]=DAYN[iso];
  const ST=DIM.map(([k,l])=>({key:k,title:l,tag:`súly ${v.weight[k]}%`,sk:'w',val:v.dims[k][0],sub:v.dims[k][1].split(' · ').slice(0,2),v:dimV(k,v.dims[k][0]),tap:true}));
  const [stSvg,yEnd]=stations(ST,148),C=yEnd+92,last=iso==='2026-09-23';
  /* the three highlights: small drops on the pipe */
  const hl=v.hl.map(([e,t],i)=>{const y=20+i*38;return `<g class="ng-hl"><path transform="translate(${72-32*.5} ${y-34*.5}) scale(.5)" d="${DROP}"/><text class="ng-t" x="96" y="${y+1}">${t}</text><text class="ng-s f" x="96" y="${y+16}">${e}</text></g>`}).join('');
  return fr[0]+topPipe(iso)+lead(`<small>${dn} · ${dd} · lezárva, hajnali 3:04</small>
      <h2>${v.label}.</h2>
      <p class="ng-cnt"><b>${v.score}</b> a 100-ból · hat területből</p>
      <p><b class="ng-adj">alap ${v.base} · a Mezo szerint −${Math.abs(v.corr)}.</b> ${v.adj}</p>
      <p><button class="fh-lk" data-toast="Beszélgetés a napról (Mezo chat)">Beszélgess a napról ›</button></p>`)
  +svg(70,pipe('M72 0V24M72 48V70')+badgeN(72,36,1,'Mezo a napodról'))
  +lead(`<div class="ng-who">${badge('mezo',{s:30})}<b>Mezo</b><small>a napodról</small></div>${v.prose.map(p=>`<p class="ng-pr">${p}</p>`).join('')}
      <div class="ng-fb"><span>Segített?</span><button data-toast="Köszönöm, jegyzem" aria-label="Segített">${I('t-thumb-up')}</button><button data-toast="Mi nem talált? (itt jönnének az okok)" aria-label="Nem talált">${I('t-thumb-down')}</button></div>`)
  +`<svg class="ng" viewBox="0 0 360 ${C+118}" role="img" aria-label="A nap rajza: a nap kiemelései, miből jött össze a pontszám, a nap körülményei">
  ${pipe(`M72 0V114M72 138V148M288 ${yEnd}C288 ${yEnd+30} 180 ${yEnd+10} 180 ${yEnd+38}${last?`M180 ${yEnd+62}V${C+118}`:''}`)}
  ${hl}${badgeN(72,126,2,'Miből jött össze')}${stSvg}
  ${badgeN(180,yEnd+50,3,'A nap körülményei')}
  ${v.ctx.map(([a,b],i)=>{const x=i%2?272:88,y=C+6+(i>1?56:0);return `<g class="ng-ctx"><circle cx="${x}" cy="${y}" r="5"/><text class="ng-s" x="${x}" y="${y+21}" text-anchor="middle">${a}</text><text class="ng-t" x="${x}" y="${y+38}" text-anchor="middle">${b}</text></g>`}).join('')}
  </svg>
  ${last?`<button class="ng-on" data-go="nap.2026-09-24">${svg(64,pipe('M180 0V8')+`<path class="ng-nd" transform="translate(${180-32*1.1} -2) scale(1.1)" d="${DROP}"/><path class="ng-ng" style="stroke-width:3" d="M172 42H188M182 36L188 42L182 48"/>`)}<b>Tovább a mai napra</b><small>csütörtök · élő nap</small></button>`:''}
  <p class="ng-foot">A hat edényre koppintva látod a részleteket. A körülmények nem számítanak a pontba, ezért a csövön kívül lebegnek. Ha utólag beírsz még valamit erre a napra, a jegyzetet egyszer újraírom.</p>`+fr[1]}
/* a day with too little data: the same six vessels, five of them empty */
function sparse(iso){const fr=frame(iso,/<section class="fh-card fh-hero/);if(!fr)return O.nap(iso);const [dn,dd]=DAYN[iso];
  const ST=DIM.map(([k,l])=>k==='sleep'?{key:k,title:l,sk:'q',val:'70',sub:['7ó 02p · minőség 6/10'],v:{p:70,g:'dom'}}
    :{key:k,title:l,sk:'q',val:'–',sub:['nincs adat'],none:true,v:k==='logging'?{n:0,g:'dom'}:{p:0,g:'dom',none:true}});
  const [stSvg,yEnd]=stations(ST,64);
  return fr[0]+topPipe(iso)+lead(`<small>${dn} · ${dd} · lezárva, hajnali 3:02</small>
      <h2>Erre a napra kevés az adat.</h2>
      <p>Csak egy területről van adat (egy alvás), ezért nem adok pontszámot: kitalálni nem fogok. A hét pontszámába ez a nap nem számít bele.</p>
      <p><button class="fh-lk" data-go="nap.2026-09-24">Vissza a mai napra ›</button></p>`)
  +`<svg class="ng" viewBox="0 0 360 ${yEnd+16}" role="img" aria-label="Amit erről a napról tudunk: a hat területből egy alvás">${pipe('M72 0V24M72 48V64')}${badgeN(72,36,1,'Amit erről a napról tudunk')}${stSvg}</svg>`+fr[1]}
const day=a=>{const [iso,ph]=(a||'').split('.');return ph||iso==='hiba'||iso==='tolt'?O.nap(a):!iso||iso==='2026-09-24'?today():iso==='2026-09-21'?sparse(iso):DAYN[iso]?closed(iso):O.nap(a)};
/* a closed day's vessel opens its details */
document.addEventListener('click',e=>{const g=e.target.closest('[data-ngs]');if(!g)return;const k=g.dataset.ngs,v=NDY,l=DIM.find(d=>d[0]===k)[1];
  F.openSheet(`<h2 class="ng-sh">${l} · ${v.dims[k][0]}<small>súly ${v.weight[k]}%</small></h2><div class="ng-chips">${v.chips[k].map(c=>`<span>${c}</span>`).join('')}</div>
    <div class="ng-who">${badge('mezo',{s:30})}<b>Mezo</b><small>erről a területről</small></div><p class="ng-pr">${v.notes[k]}</p><div class="fh-acts"><button class="btn" data-close style="flex:1">Rendben</button></div>`)});

/* ═══ BESZÉLGETÉS · the day's stream: every message is a drop on it, at its time ═══ */
const TC={szunya:'#8F7FD0',mocor:'#3F8FDB',falat:'#3FA277',mezo:'#6F7F95'},TG={szunya:'t-sleep',mocor:'t-dumbbell',falat:'t-bowl',mezo:'t-orb'},TN={szunya:'Alvás',mocor:'Mozgás',falat:'Étkezés',mezo:'Mezo'};
const node=(k,cls='')=>`<span class="nb-node ${cls}" style="--c:${TC[k]}"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="${DROP}"/></svg>${I(TG[k])}</span>`;
const BS={adv:false,fb:false,exp:{}};
function streamBody(){
  const m=(k,time,kind,text,extra='',cls='new')=>`<article class="nb-m ${cls}"><time>${time}</time>${node(k,cls)}<div class="nb-b"><p class="nb-h"><b>${TN[k]}</b>${kind}</p><p class="nb-t">${text}</p>${extra}</div></article>`;
  const fb=no=>`<div class="nb-a"><span>Segített?</span><button class="btn sm ghost" data-toast="Köszönöm — ezt megjegyzem">Segített</button><button class="btn sm ghost" ${no?'data-nb="fb"':'data-toast="Köszönöm, finomítok"'}>Nem talált</button></div>`;
  const old=[['szunya','21:48','esti visszanézés','Szép nap volt: 3 szokás, 2 check-in és egy erős edzés.'],['mocor','14:10','délutáni jelzés','Alacsony az energiád — egy rövid séta többet ad, mint a harmadik kávé.']];
  return `<div class="nb">
  <div class="nb-lead"><small>Mezo · ma · 4 üzenet</small><h2>Négy üzenet, kettő új.</h2><p>A napod fonala: amit ma észrevettünk és javasoltunk. A legfrissebb van felül.</p></div>
  <button class="nb-trib" data-toast="Mezo · Élő beszélgetés"><svg viewBox="0 0 120 64" aria-hidden="true"><path class="ng-pipe" d="M92 16C56 16 60 40 22 40M92 48C66 48 60 40 22 40"/><path class="ng-flow" d="M92 16C56 16 60 40 22 40M92 48C66 48 60 40 22 40"/></svg>
    <span class="nb-duo">${badge('szunya',{s:30})}${badge('mocor',{s:30})}</span><span class="nb-tt"><b>A csapat most erről beszél</b><small>belefér-e ma az esti röpi a rövid éjszaka után</small></span></button>
  <p class="nb-mark"><span>Ma</span></p>
  ${m('falat','10:12','étkezési javaslat','A reggelid 420 kcal volt, 22 g fehérjével. Ha az ebédhez legalább 40 g-ot teszel, estére nem marad nagy hiány.',
    `<div class="nb-a">${BS.adv?`<span class="nb-ok"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5L6.8 11.5L12.5 5"/></svg>Beállítva: az ebédnél szólok a fehérjéről.</span>`:`<button class="btn sm" data-nb="adv">Szólj az ebédnél</button>`}</div>${fb(false)}`)}
  ${m('mezo','06:30','reggeli briefing','Jó reggelt — Week 3, Day 4, és érzed a tempót. Tegnap Push Day-en a Lat Pulldown 105 kg × 9 ment RIR 1-re, ma a hátad pihen.<br><br>Az alvásod 7,4 óra volt, a reggeli check-in nyugodt. Ma délben érdemes a fehérjét előrehozni.',
    `<p class="nb-l">Amire épült</p><div class="ng-chips"><span>Push Day · tegnap</span><span>Chest Row 105,8 · márc 4</span><span>késő szénhidrát ↔ alvás</span></div>
     <p class="nb-l">Miből gondolom</p><div class="nb-f"><span>${I('t-sleep')}7,4 óra alvás, 2 ébredés</span><span>${I('t-checkin')}Reggeli check-in: energia 7/10</span></div>${fb(true)}
     ${BS.fb?`<div class="ng-chips tap">${['pontatlan','túl sok','rossz időzítés','nem rólam szól'].map(r=>`<button data-toast="Köszönöm, finomítok">${r}</button>`).join('')}</div>`:''}`)}
  <p class="nb-mark"><span>Tegnap · korábbi üzenetek</span></p>
  ${old.map(([k,t,kind,p],i)=>BS.exp[i]?m(k,t,kind,p,`<div class="nb-a"><button class="fh-lk" data-nb="exp:${i}">Összecsukom</button></div>`,'old')
    :`<button class="nb-m old fold" data-nb="exp:${i}"><time>${t}</time>${node(k,'old')}<span class="nb-b"><span class="nb-h"><b>${TN[k]}</b>${kind}</span><span class="nb-t">${p.slice(0,38)}…</span></span></button>`).join('')}
  <button class="nb-end" data-toast="Mezo · Chat"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="${DROP}"/></svg><span><b>Beszélgess Mezóval</b><small>kérdezz, mesélj, vagy beszéljük át a napot</small></span></button>
  </div>`}
function uzenetek(tab){if(tab&&tab!=='uzenetek')return O.uzenetek(tab);
  const TABS=[['uzenetek','Üzenetek'],['eletjelek','Életjelek'],['eszrevetelek','Észrevételek']];
  return page('nap',{title:'Beszélgetés',sub:'Mezo · ma · 4 üzenet',tab:'uzenetek'},`${DEFS}<div class="np-pre"><div class="fh-seg">${TABS.map(([k,l])=>`<button class="${k==='uzenetek'?'on':''}" data-go="uzenetek${k==='uzenetek'?'':'.'+k}">${l}${k==='eletjelek'?'<i class="np-dot"></i>':''}</button>`).join('')}</div></div><div id="nb-root">${streamBody()}</div>`)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-nb]');if(!b)return;const a=b.dataset.nb;
  if(a==='adv'){BS.adv=true;F.toast('Beállítva: az ebédnél szólok')}else if(a==='fb')BS.fb=!BS.fb;else if(a.startsWith('exp:')){const i=a.slice(4);BS.exp[i]=!BS.exp[i]}
  const r=document.getElementById('nb-root');if(r)r.innerHTML=streamBody()});

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
  return `<p class="fh-n"><b>${n}</b>${G.title} · ${dn}/${N}</p><div class="rt-chain">${G.rows.map((r,i)=>{const [nm,s,ic,str,d]=r,row=Math.floor(i/3),c=i%3,col=row%2?3-c:c+1,dir=i===N-1?'':c===2?(row%2?'dnl':'dnr'):row%2?'lf':'rt';
    return `<button class="rt-b ${d?'done':''} ${i===nx?'now':''} ${dir} ${str==null?'ns':''}" style="grid-column:${col};grid-row:${row+1};--p:${str??0}%" ${rAttr(r,i,k)} aria-label="${nm}${d?' · kész':''}">
      <span class="rt-v">${I(ic)}${d?'<i class="rt-ok"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5L6.8 11.5L12.5 5"/></svg></i>':''}</span><b>${nm}</b><small>${i===nx?'<em>Most jön</em>':str!=null?str+'%':s}</small></button>`}).join('')}</div>`}
function rutinBody(){const R=RUT[face],done=R.rows.filter(r=>r[4]).length,nx=R.rows.findIndex(r=>!r[4]),all=nx<0,strs=R.rows.filter(r=>r[3]!=null),avg=Math.round(strs.reduce((a,r)=>a+r[3],0)/strs.length);
  const order=[face,...Object.keys(RUT).filter(k=>k!==face)];
  return `<div class="rt-lead"><small>${R.title} · ${done}/${R.rows.length} kész</small><h2>${all?'Mind megvan. Szép munka.':`Most jön: ${R.rows[nx][0]}.`}</h2>
    <p>${all?'Holnap ugyanitt folytatódik.':`${R.rows.length} elem · lánc · ${R.rows[nx][1]}`}</p>
    <div class="rt-acts">${all?'':`<button class="btn" ${rAttr(R.rows[nx],nx,face)}>${rVerb(R.rows[nx])}</button>`}<button class="fh-lk" data-toast="Tegnap — csak a kézi, kimaradt elemek pipálhatók">‹ Tegnap</button><span class="fh-lk" style="opacity:.35">Holnap ›</span></div></div>
  ${order.map((k,i)=>chain(k,i+1,k===face?nx:-1)).join('')}
  <p class="rt-note">Az edény szintje a szokás 28 napos ereje. A cső addig telik meg, ameddig ma eljutottál.</p>
  <p class="fh-n"><b>${order.length+1}</b>A lánc ereje</p>
  <div class="rt-flasks">${[...(R.stat?[[R.stat[0],R.stat[1],Math.round(parseInt(R.stat[0])/30*100)]]:[]),[`${avg}%`,'lánc-erő · 28 nap',avg],[`+${R.xp}`,'XP ma',null]].map(([b,l,p])=>`<div class="rt-fl ${p==null?'np':''}" style="--p:${p??0}%"><span><b>${b}</b></span><small>${l}</small></div>`).join('')}</div>
  <p class="rt-note">A lánc-erő az elmúlt 28 nap következetessége: egy kihagyás nem nulláz, csak halványít.</p>
  <button class="rt-edit" data-go="rutin-epites">${I('t-chain')}<span><b>Rutinok szerkesztése</b><small>láncok, szokások, új szokás</small></span><i>›</i></button>`}
function rutin(arg){if(arg&&RUT[arg])face=arg;return page('nap',{title:'Rutin',sub:'Nap · ma, szerda',tab:'rutin'},`<div id="rt-root">${rutinBody()}</div>`)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-rt]');if(!b)return;const [g,ix]=b.dataset.rt.split(':'),R=RUT[g].rows,i=+ix;R[i][4]=R[i][4]?0:1;
  if(R[i][4]){const d=R.filter(r=>r[4]).length;F.toast(d===R.length?`${g==='este'?'Tökéletes este':g==='reggel'?'Tökéletes reggel':'Minden megvan'} · ${d} / ${R.length}`:`Szokás · ${d} / ${R.length} · megvan, a lánc erősödik`)}
  const r=document.getElementById('rt-root');if(r)r.innerHTML=rutinBody()});

/* ── routes: on this page the top tabs open the drawn versions; the approved ones stay reachable ── */
nap.routes['napom-lista']=O.napom;nap.routes['uzenetek-lista']=O.uzenetek;nap.routes['rutin-lista']=O.rutin;
nap.routes.napom=a=>a?O.napom(a):today();nap.routes.nap=day;nap.routes.napomg=today;nap.routes.napomt=today;
nap.routes.uzenetek=uzenetek;nap.routes.rutin=rutin;

F.css(`/* kiserlet-napom */
${P} svg.ng{display:block;width:calc(100% - 28px);margin:0 14px;overflow:visible}
${P} svg.ng-top{margin-top:6px}
${P} .ng text{font-family:var(--ff,inherit)}
${P} .ng-lead{position:relative;margin:0;padding:4px 22px 16px calc(14px + (100% - 28px)*.2 + 24px)}
${P} .ng-lead::before{content:"";position:absolute;left:calc(14px + (100% - 28px)*68/360);top:-2px;bottom:-2px;width:calc((100% - 28px)*8/360);background:color-mix(in srgb,var(--liq1) 52%,#E9F2F8)}
${P} .ng-lead p{margin-top:8px;font-size:12.5px;line-height:1.45;color:var(--sub)}
${P} .ng-lead>small{display:block;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
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
${P} .ng-h{font-size:13.5px;font-weight:700;fill:var(--ink)}
${P} .ng-t{font-size:14.5px;font-weight:700;fill:var(--ink)}
${P} .ng-k{font-size:11.5px;font-weight:700;fill:var(--dom)}${P} .ng-k.ok{fill:var(--ok)}${P} .ng-k.warn{fill:var(--warn)}${P} .ng-k.w{fill:var(--faint);font-weight:600}
${P} .ng-v{font:800 28px var(--disp,inherit);letter-spacing:-.03em;fill:var(--ink)}
${P} .ng-u{font:600 13px var(--ff,inherit);fill:var(--sub);letter-spacing:0}
${P} .ng-s{font-size:12.5px;fill:var(--sub)}${P} .ng-s.f{fill:var(--faint);font-size:11.5px}
${P} .ng-next{cursor:pointer}
${P} .ng-nd{fill:url(#ng-g-dom);filter:drop-shadow(0 4px 5px rgba(24,119,242,.3))}
${P} .ng-ng{fill:none;stroke:#fff;stroke-width:4;stroke-linejoin:round;stroke-linecap:round}
${P} .ng-nt{font:800 21px var(--disp,inherit);letter-spacing:-.03em;fill:var(--ink)}
${P} .ng-go{font-size:13px;font-weight:700;fill:var(--dom)}
${P} .ng-un{font:800 27px var(--disp,inherit);fill:#fff;letter-spacing:-.03em}
${P} .ng-uu{font-size:10.5px;font-weight:700;fill:#fff;opacity:.9}
${P} .ng-mark{fill:none;stroke:rgba(10,42,60,.3);stroke-width:1.4;stroke-dasharray:3 4}
${P} .ng-ctx circle{fill:none;stroke:var(--liq1);stroke-width:2;stroke-dasharray:3 3}
${P} .ng-hit{fill:transparent;cursor:pointer}
${P} .ng-say{margin:18px 26px 0;font:800 19px/1.2 var(--disp,inherit);letter-spacing:-.02em;text-align:center;color:var(--ink);text-wrap:balance}
${P} .ng-foot{margin:8px 30px 0;font-size:12px;line-height:1.45;text-align:center;color:var(--sub)}
${P} .ng-on{display:flex;flex-direction:column;align-items:center;width:100%;gap:2px;padding-bottom:10px}${P} .ng-on b{font:800 17px var(--disp,inherit);color:var(--ink)}${P} .ng-on small{font-size:12px;color:var(--sub)}
${P} .ng-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
${P} .ng-chips>*{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:600;color:var(--ink);background:color-mix(in srgb,var(--dom) 7%,#fff);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dom) 20%,#fff)}
${P} .ng-chips.tap>*{min-height:36px}
${P} .ng-sh{font:800 22px var(--disp,inherit);letter-spacing:-.02em}${P} .ng-sh small{margin-left:8px;font:600 12px var(--ff,inherit);color:var(--sub)}
${P} .sheet .ng-who{margin-top:16px}

/* Beszélgetés */
${P} .nb{position:relative;padding:6px 16px 0 0;--rail:62px}
${P} .nb::before{content:"";position:absolute;left:calc(var(--rail) - 4px);top:0;bottom:36px;width:8px;border-radius:4px;background:color-mix(in srgb,var(--liq1) 52%,#E9F2F8)}
${P} .nb-lead{position:relative;padding:8px 6px 14px calc(var(--rail) + 22px)}
${P} .nb-lead small{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
${P} .nb-lead h2{margin:6px 0 0;font:800 23px/1.12 var(--disp,inherit);letter-spacing:-.03em;color:var(--ink)}
${P} .nb-lead p{margin-top:8px;font-size:12.5px;line-height:1.45;color:var(--sub)}
${P} .nb-trib{position:relative;display:flex;align-items:center;gap:10px;width:100%;min-height:64px;padding:0;text-align:left}
${P} .nb-trib>svg{position:absolute;left:calc(var(--rail) - 22px);top:0;width:120px;height:64px;overflow:visible}
${P} .nb-duo{position:relative;display:flex;flex-direction:column;gap:4px;margin-left:calc(var(--rail) + 58px)}
${P} .nb-tt b{display:block;font-size:14px;font-weight:700;color:var(--ink)}${P} .nb-tt small{display:block;font-size:12px;line-height:1.35;color:var(--sub)}
${P} .nb-mark{position:relative;margin:18px 0 6px;height:22px}
${P} .nb-mark::before{content:"";position:absolute;left:14px;right:-2px;top:10px;height:0;border-top:1.5px dashed color-mix(in srgb,var(--liq2) 30%,#fff)}
${P} .nb-mark span{position:absolute;left:calc(var(--rail) + 22px);top:0;padding:2px 10px;border-radius:999px;background:#EAF2F8;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)}
${P} .nb-m{position:relative;display:block;width:100%;padding:12px 0 14px calc(var(--rail) + 36px);text-align:left}
${P} .nb-m time{position:absolute;left:8px;top:25px;width:calc(var(--rail) - 34px);text-align:right;font:500 11px var(--mono,ui-monospace,monospace);color:var(--sub)}
${P} .nb-node{position:absolute;left:calc(var(--rail) - 24px);top:6px;width:48px;height:48px;display:grid;place-items:center}
${P} .nb-node>svg:first-child{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 5px 6px color-mix(in srgb,var(--c) 40%,transparent))}
${P} .nb-node>svg:first-child path{fill:var(--c)}
${P} .nb-node svg.ic{position:relative;width:20px;height:20px;margin-top:9px;--ic:#fff;--ic2:rgba(255,255,255,.55)}
${P} .nb-node.old>svg:first-child{filter:none}${P} .nb-node.old>svg:first-child path{fill:#fff;stroke:color-mix(in srgb,var(--c) 55%,#fff);stroke-width:2.5}
${P} .nb-node.old svg.ic{--ic:var(--c);--ic2:color-mix(in srgb,var(--c) 45%,#fff)}
${P} .nb-h{display:block;font-size:12px;color:var(--sub)}${P} .nb-h b{font-size:14.5px;font-weight:800;color:var(--ink);margin-right:7px}
${P} .nb-t{display:block;margin-top:4px;font-size:14px;line-height:1.5;color:var(--ink)}
${P} .nb-m.old .nb-t{color:var(--sub)}
${P} .nb-l{margin-top:12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
${P} .nb-f{display:grid;gap:6px;margin-top:8px}${P} .nb-f span{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink)}${P} .nb-f svg.ic{width:20px;height:20px;flex:none}
${P} .nb-a{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}${P} .nb-a>span{font-size:12.5px;font-weight:600;color:var(--sub)}
${P} .nb-ok{display:flex;align-items:center;gap:6px;color:var(--ok)!important}${P} .nb-ok svg{width:16px;height:16px;fill:none;stroke:var(--ok);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
${P} .nb-end{position:relative;display:flex;align-items:center;gap:14px;width:100%;margin-top:10px;padding:0 0 0 calc(var(--rail) - 36px);text-align:left}
${P} .nb-end svg{width:72px;height:72px;flex:none;overflow:visible;filter:drop-shadow(0 8px 9px rgba(24,119,242,.3))}${P} .nb-end path{fill:url(#ng-g-dom)}
${P} .nb-end b{display:block;font:800 18px var(--disp,inherit);letter-spacing:-.02em;color:var(--ink)}${P} .nb-end small{display:block;font-size:12.5px;color:var(--sub)}

/* Rutin */
${P} .rt-lead{padding:14px 22px 0}
${P} .rt-lead small{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
${P} .rt-lead h2{margin:6px 0 0;font:800 25px/1.1 var(--disp,inherit);letter-spacing:-.03em;color:var(--ink);text-wrap:balance}
${P} .rt-lead p{margin-top:6px;font-size:12.5px;color:var(--sub)}
${P} .rt-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:14px}
${P} .rt-chain{display:grid;grid-template-columns:repeat(3,1fr);margin:14px 14px 0}
${P} .rt-b{position:relative;display:flex;flex-direction:column;align-items:center;height:132px;padding:0 10px;text-align:center}
${P} .rt-b::after{content:"";position:absolute;z-index:0;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--liq1) 40%,#E9F2F8) 0 6px,transparent 6px 11px)}
${P} .rt-b.rt::after{left:50%;width:100%;top:26px;height:8px}
${P} .rt-b.lf::after{right:50%;width:100%;top:26px;height:8px}
/* the turn at a row's end loops around the outside of the labels */
${P} .rt-b.dnr::after,${P} .rt-b.dnl::after{top:26px;height:140px;background:none;border:8px dotted color-mix(in srgb,var(--liq1) 45%,#E9F2F8)}
${P} .rt-b.dnr::after{left:50%;right:-6px;border-left:0;border-radius:0 26px 26px 0}
${P} .rt-b.dnl::after{right:50%;left:-6px;border-right:0;border-radius:26px 0 0 26px}
${P} .rt-b.done.rt::after,${P} .rt-b.done.lf::after{background:linear-gradient(90deg,var(--liq1),var(--liq2))}
${P} .rt-b.done.dnr::after,${P} .rt-b.done.dnl::after{border-style:solid;border-color:var(--liq2)}
${P} .rt-v{position:relative;z-index:1;display:grid;place-items:center;width:60px;height:60px;flex:none;border-radius:50%;
  background:linear-gradient(to top,color-mix(in srgb,var(--liq1) 38%,#fff) 0 var(--p),color-mix(in srgb,var(--liq1) 75%,#fff) var(--p) calc(var(--p) + 2px),#fff calc(var(--p) + 2px));
  box-shadow:inset 0 0 0 2px rgba(10,42,60,.14),0 8px 12px -8px rgba(24,119,242,.5)}
${P} .rt-b.ns .rt-v{background:#fff;box-shadow:inset 0 0 0 2px rgba(10,42,60,.14)}
${P} .rt-v>svg.ic{width:26px;height:26px}
${P} .rt-b.done .rt-v{background:linear-gradient(to top,color-mix(in srgb,var(--ok) 34%,#fff) 0 var(--p),color-mix(in srgb,var(--ok) 70%,#fff) var(--p) calc(var(--p) + 2px),#fff calc(var(--p) + 2px));box-shadow:inset 0 0 0 2.5px var(--ok),0 8px 12px -8px var(--ok)}
${P} .rt-b.done.ns .rt-v{background:color-mix(in srgb,var(--ok) 20%,#fff)}
${P} .rt-b.done .rt-v>svg.ic{--ic:#0E7A55;--ic2:var(--ok)}
${P} .rt-ok{position:absolute;right:-4px;bottom:-3px;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 2px #F3F8FB}
${P} .rt-ok svg{width:14px;height:14px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
${P} .rt-b.now .rt-v{box-shadow:inset 0 0 0 3px var(--dom),0 0 0 5px color-mix(in srgb,var(--dom) 16%,transparent),0 10px 14px -8px var(--dom)}
${P} .rt-b>b{position:relative;z-index:1;margin-top:7px;font-size:12.5px;font-weight:700;line-height:1.2;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
${P} .rt-b>small{margin-top:2px;font-size:11px;color:var(--sub);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .rt-b>small em{font-style:normal;font-weight:800;color:var(--dom)}
${P} .rt-b.done>b{color:var(--sub)}
${P} .rt-note{margin:4px 22px 0;font-size:12px;line-height:1.45;color:var(--sub)}
${P} .rt-flasks{display:flex;justify-content:space-around;gap:8px;margin:14px 18px 0}
${P} .rt-fl{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;min-width:0;text-align:center}
${P} .rt-fl span{display:grid;place-items:center;width:78px;height:78px;border-radius:50% 50% 50% 50%/42% 42% 58% 58%;
  background:linear-gradient(to top,var(--liq2),var(--liq1) var(--p),#fff var(--p));box-shadow:inset 0 0 0 2px rgba(10,42,60,.14),0 10px 14px -10px var(--liq2)}
${P} .rt-fl b{font:800 19px var(--disp,inherit);letter-spacing:-.03em;color:var(--ink);background:rgba(255,255,255,.82);padding:1px 7px;border-radius:999px}
${P} .rt-fl.np span{background:#fff;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dom) 35%,#fff)}
${P} .rt-fl small{font-size:11.5px;line-height:1.3;color:var(--sub)}
${P} .rt-edit{display:flex;align-items:center;gap:12px;width:calc(100% - 44px);margin:22px 22px 0;padding:6px 0;text-align:left}
${P} .rt-edit>svg.ic{width:34px;height:34px;flex:none}${P} .rt-edit span{flex:1}${P} .rt-edit b{display:block;font-size:15px;font-weight:700;color:var(--ink)}${P} .rt-edit small{font-size:12px;color:var(--sub)}${P} .rt-edit i{font-style:normal;font-size:22px;color:var(--faint)}
@media (prefers-reduced-motion:no-preference){
  body:not(.still) ${P} .ng-wv{animation:ng-wv 5s linear infinite}
  body:not(.still) ${P} .ng-flow{animation:ng-fl 1.6s linear infinite}
  body:not(.still) ${P} .ng-drip{animation:ng-dr 2.2s ease-in infinite;animation-delay:var(--dl,0s)}
  body:not(.still) ${P} .rt-b.now .rt-v{animation:rt-now 2.4s ease-in-out infinite}
}
@keyframes ng-wv{to{transform:translateX(-48px)}}
@keyframes ng-fl{to{stroke-dashoffset:-22}}
@keyframes ng-dr{0%{opacity:0;translate:0 -6px}25%{opacity:1}100%{opacity:0;translate:0 12px}}
@keyframes rt-now{50%{transform:scale(1.06)}}
`);
window.FNOTES_FOLY=`<h2>Kísérlet · a Nap rajzolva</h2><p>Ezen az oldalon a három fül a rajzolt változatot nyitja: nincs nagy edény, nincs kártya, nincs lista.</p>
<ul><li><a href="#w-nap-napom"><b>A napom</b></a> — a mai nap: a nap edényéből cső indul, minden egység a saját edénye rajta. Lezárt napok: <a href="#w-nap-nap.2026-09-23">szerda</a>, <a href="#w-nap-nap.2026-09-22">kedd</a>; kevés adat: <a href="#w-nap-nap.2026-09-21">hétfő</a>.</li>
<li><a href="#w-nap-uzenetek"><b>Beszélgetés</b></a> — a nap folyama: minden üzenet egy csepp rajta, a maga idejében.</li>
<li><a href="#w-nap-rutin"><b>Rutin</b></a> — a lánc edények füzére, ami soronként kanyarodik: akárhány szokásra. Másik láncok: <a href="#w-nap-rutin.este">este</a>, <a href="#w-nap-rutin.napkozben">napközben</a>.</li></ul>
<p>Összevetésnek a mostani, listás oldalak: <a href="#w-nap-napom-lista">A napom</a> · <a href="#w-nap-uzenetek-lista">Beszélgetés</a> · <a href="#w-nap-rutin-lista">Rutin</a>.</p>`+(window.FNOTES_FOLY||'');
})();
