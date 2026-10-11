/* vilagos/kiserlet-napom.js — EXPERIMENT (owner idea, 2026-10-11): "A napom" without cards and lists.
   NOT part of the build target: it is loaded only by ../kiserlet-napom-grafika.html, never by the shell
   (klinikai-iranyok.html), so the approved #w-nap-napom stays what the builders read.
   Route: #w-nap-napomg — the week strip and the hero tank are the approved ones; everything under the
   hero is ONE drawing: the day's liquid runs down a pipe, and every unit is its own vessel on that pipe.
   The vessel is the frame, the pipe's bends are the dividers and the spacing. Same data as nap.js (NDT). */
(function(){
const F=window.F,nap=window.FREG&&FREG.nap;if(!nap)return;
const P='.phone.foly[data-s="elo"][data-d="nap"]';
const DROP='M32 6C41 19 50 28 50 39A18 18 0 0 1 14 39C14 28 23 19 32 6Z';
const MOON='M46 41A21 21 0 1 1 25 11A17 17 0 0 0 46 41Z';
const DUMB='M8 24A4 4 0 0 1 12 20H16A4 4 0 0 1 20 24V28H44V24A4 4 0 0 1 48 20H52A4 4 0 0 1 56 24V40A4 4 0 0 1 52 44H48A4 4 0 0 1 44 40V36H20V40A4 4 0 0 1 16 44H12A4 4 0 0 1 8 40Z';
/* a liquid body clipped to a vessel: wave top at y, one wave period = 48 (the drift animation shifts by 48) */
const liq=(clip,y,g='dom')=>`<g clip-path="url(#${clip})"><path class="ng-wv" fill="url(#ng-g-${g})" d="M-48 ${y}${' q12 -5 24 0 t24 0'.repeat(5)} V120 H-48Z"/></g>`;
const drip=(x,y,dl=0)=>`<path class="ng-drip" style="--dl:${dl}s" transform="translate(${x} ${y})" d="M0 -6C3 -2 4.5 .5 4.5 3A4.5 4.5 0 0 1 -4.5 3C-4.5 .5 -3 -2 0 -6Z"/>`;
const pipe=d=>`<path class="ng-pipe" d="${d}"/><path class="ng-flow" d="${d}"/>`;

/* ── the six vessels, each drawn in a 104×104 box; the pipe enters at (52,0) and leaves at (52,104) ── */
const V={
  /* Tápanyag — a bowl filled to the calories eaten, its rim is the day's budget; the egg is the protein */
  nutrition:()=>`<defs><clipPath id="ng-c-bowl"><path d="M8 40H96C96 74 78 90 52 90C26 90 8 74 8 40Z"/></clipPath>
      <clipPath id="ng-c-egg"><path d="M84 5C91 5 95.5 15 95.5 22.5A11.5 11.5 0 0 1 72.5 22.5C72.5 15 77 5 84 5Z"/></clipPath></defs>
    ${pipe('M52 0V12')}${drip(52,22)}${drip(52,33,1.1)}
    <path class="ng-glass" d="M36 89H68L72 99H32Z"/>
    <path class="ng-glass" d="M8 40H96C96 74 78 90 52 90C26 90 8 74 8 40Z"/>${liq('ng-c-bowl',53)}
    <path class="ng-line" d="M8 40H96C96 74 78 90 52 90C26 90 8 74 8 40Z"/><path class="ng-rim" d="M4 40H100"/>
    <path class="ng-hi" d="M19 60C23 71 31 79 41 83"/>
    <path class="ng-glass" d="M84 5C91 5 95.5 15 95.5 22.5A11.5 11.5 0 0 1 72.5 22.5C72.5 15 77 5 84 5Z"/>${liq('ng-c-egg',9,'prot')}
    <path class="ng-line" d="M84 5C91 5 95.5 15 95.5 22.5A11.5 11.5 0 0 1 72.5 22.5C72.5 15 77 5 84 5Z"/>
    ${pipe('M52 99V104')}`,
  /* Minőség — a sprout: the left leaf is the unprocessed share, the right leaf the micronutrients */
  quality:()=>`<defs><clipPath id="ng-c-pot"><path d="M30 66H74L68 98H36Z"/></clipPath>
      <clipPath id="ng-c-l1"><path d="M52 58C36 60 20 52 14 32C34 28 48 40 52 58Z"/></clipPath>
      <clipPath id="ng-c-l2"><path d="M52 44C68 46 86 36 90 14C70 12 56 26 52 44Z"/></clipPath></defs>
    ${pipe('M52 0V6')}${drip(52,16)}
    <path class="ng-stem" d="M52 66V30"/>
    <path class="ng-glass" d="M52 58C36 60 20 52 14 32C34 28 48 40 52 58Z"/>${liq('ng-c-l1',39.5)}<path class="ng-line" d="M52 58C36 60 20 52 14 32C34 28 48 40 52 58Z"/>
    <path class="ng-glass" d="M52 44C68 46 86 36 90 14C70 12 56 26 52 44Z"/>${liq('ng-c-l2',20)}<path class="ng-line" d="M52 44C68 46 86 36 90 14C70 12 56 26 52 44Z"/>
    <path class="ng-glass" d="M30 66H74L68 98H36Z"/>${liq('ng-c-pot',75)}<path class="ng-line" d="M30 66H74L68 98H36Z"/><path class="ng-rim" d="M26 66H78"/>
    <path class="ng-hi" d="M38 76L40 90"/>
    ${pipe('M52 98V104')}`,
  /* Edzés — an empty kettlebell with a dashed wall: not done yet */
  training:()=>`<defs><clipPath id="ng-c-kb"><circle cx="52" cy="66" r="30"/></clipPath></defs>
    ${pipe('M52 0V8')}
    <path class="ng-open" d="M40 39L36 20C35 12 40 8 46 8H58C64 8 69 12 68 20L64 39"/>
    <circle class="ng-glass" cx="52" cy="66" r="30"/>${liq('ng-c-kb',91,'warn')}<circle class="ng-open" cx="52" cy="66" r="30"/>
    <path class="ng-hi" d="M32 56C35 48 41 43 48 41"/>
    ${pipe('M52 96V104')}`,
  /* Alvás — a moon holding the night; the sparks are just the night sky */
  sleep:()=>`<defs><clipPath id="ng-c-moon"><path transform="translate(-3.65 -15.1) scale(2.1)" d="${MOON}"/></clipPath></defs>
    ${pipe('M52 0V9')}
    <path class="ng-glass" transform="translate(-3.65 -15.1) scale(2.1)" style="stroke-width:.95" d="${MOON}"/>${liq('ng-c-moon',21,'ok')}
    <path class="ng-line" transform="translate(-3.65 -15.1) scale(2.1)" style="stroke-width:.95" d="${MOON}"/>
    <path class="ng-hi" d="M17 62C20 74 28 83 39 88"/>
    <path class="ng-spark" d="M80 16L82.5 24.5L91 27L82.5 29.5L80 38L77.5 29.5L69 27L77.5 24.5Z"/><path class="ng-spark" d="M94 44L95.4 48.6L100 50L95.4 51.4L94 56L92.6 51.4L88 50L92.6 48.6Z"/>
    ${pipe('M52 95V104')}`,
  /* Logolás — four small tubes on a rack, one per check-in of the day: two are filled */
  logging:()=>{const xs=[16,40,64,88],tube=x=>`M${x-8} 38A8 8 0 0 1 ${x+8} 38V78A8 8 0 0 1 ${x-8} 78Z`;
    return `<defs>${xs.map((x,i)=>`<clipPath id="ng-c-t${i}"><path d="${tube(x)}"/></clipPath>`).join('')}</defs>
    ${pipe('M52 0V12M16 30V18Q16 12 22 12H82Q88 12 88 18V30M40 12V30M64 12V30')}
    ${xs.map((x,i)=>i<2?`<path class="ng-glass" d="${tube(x)}"/>${liq('ng-c-t'+i,40)}<path class="ng-line" d="${tube(x)}"/><path class="ng-hi" d="M${x-3.5} 46V66"/>`
      :`<path class="ng-glass" d="${tube(x)}"/><path class="ng-open q" d="${tube(x)}"/>`).join('')}
    <path class="ng-rim" d="M4 90H100"/>${pipe('M52 90V104')}`},
  /* Ritmus — a coil: the pipe itself swings, and the liquid has climbed 74% of it */
  rhythm:()=>{const d='M52 104C52 96 82 98 82 88S22 80 22 68S82 60 82 48S22 40 22 28S52 12 52 0';
    return `<path class="ng-coil a" d="${d}"/><path class="ng-coil b" d="${d}"/><path class="ng-coil c" pathLength="100" stroke-dasharray="74 100" d="${d}"/>`}
};
/* one station: the vessel on its side of the page, the words on the other */
function station(key,side,y,title,stt,sk,val,unit,sub){const L=side==='L',cx=L?72:288,tx=L?146:214,an=L?'start':'end';
  return `<g class="ng-st ${sk}"><g class="ng-ves" transform="translate(${cx-52} ${y})">${V[key]()}</g>
    <text class="ng-t" x="${tx}" y="${y+30}" text-anchor="${an}">${title}<tspan class="ng-k ${sk}" dx="7">${stt}</tspan></text>
    <text class="ng-v" x="${tx}" y="${y+62}" text-anchor="${an}">${val}${unit?`<tspan class="ng-u" dx="4">${unit}</tspan>`:''}</text>
    ${sub.map((s,i)=>`<text class="ng-s" x="${tx}" y="${y+82+i*16}" text-anchor="${an}">${s}</text>`).join('')}</g>`}
const badge=(x,y,n,t,an='start')=>`<g class="ng-b"><path transform="translate(${x-32*.66} ${y-34*.66}) scale(.66)" d="${DROP}"/><text x="${x}" y="${y+7.5}" text-anchor="middle">${n}</text></g>
  <text class="ng-h" x="${an==='start'?x+20:x-20}" y="${y+6}" text-anchor="${an}">${t}</text>`;

function drawing(){
  const Y0=262,PITCH=140,ST=[
    ['nutrition','Tápanyag','úton','q','2 060','kcal',['a 2 782-ből','fehérje 148 / 166 g']],
    ['quality','Minőség','úton','q','74','%',['feldolgozatlan 68%','mikro 80%']],
    ['training','Edzés','nyitva','warn','0/1','',['a mai edzés még hátravan']],
    ['sleep','Alvás','kész','ok','7ó 16p','',['minőség 7/10','az éjszaka lezárult']],
    ['logging','Logolás','úton','q','2/4','',['check-in','a nap négy pillanata']],
    ['rhythm','Ritmus','kész','ok','74','',['a heted eddigi üteme']]];
  const cx=i=>i%2?288:72,yEnd=Y0+PITCH*5+104;
  /* the S-bends between two stations are the dividers */
  const bends=ST.slice(0,-1).map((_,i)=>{const a=cx(i),b=cx(i+1),y=Y0+PITCH*i+104;return `M${a} ${y}C${a} ${y+28} ${b} ${y+8} ${b} ${y+36}`}).join('');
  const U=yEnd+96; /* top of the two glasses */
  return `<svg class="ng" viewBox="0 0 360 ${U+200}" role="img" aria-label="A mai napod rajza: most érdemes, a hat terület, te és az app">
  <defs>
    <linearGradient id="ng-g-dom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--liq1)"/><stop offset="1" style="stop-color:var(--liq2)"/></linearGradient>
    <linearGradient id="ng-g-ok" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FD3A0"/><stop offset="1" stop-color="#149E6E"/></linearGradient>
    <linearGradient id="ng-g-warn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3C969"/><stop offset="1" stop-color="#C98A12"/></linearGradient>
    <linearGradient id="ng-g-prot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0A29B"/><stop offset="1" stop-color="#D9605A"/></linearGradient>
    <clipPath id="ng-c-u"><path d="M96 ${U}V${U+104}C96 ${U+170} 264 ${U+170} 264 ${U+104}V${U}H212V${U+100}C212 ${U+124} 148 ${U+124} 148 ${U+100}V${U}Z"/></clipPath>
    <clipPath id="ng-c-ul"><rect x="0" y="0" width="180" height="${U+200}"/></clipPath><clipPath id="ng-c-ur"><rect x="180" y="0" width="180" height="${U+200}"/></clipPath>
  </defs>
  ${pipe(`M72 0V26M72 50V62M72 196V218M72 242V${Y0}${bends}M288 ${yEnd}C288 ${yEnd+30} 180 ${yEnd+10} 180 ${yEnd+38}M180 ${yEnd+62}C180 ${yEnd+80} 122 ${yEnd+66} 122 ${yEnd+82}M180 ${yEnd+62}C180 ${yEnd+80} 238 ${yEnd+66} 238 ${yEnd+82}`)}

  ${badge(72,38,1,'Most érdemes · délután')}
  <g class="ng-next" data-toast="Edzés megnyitása" role="button" tabindex="0" aria-label="Még hátravan a mai edzés. Edzés megnyitása">
    <path class="ng-nd" transform="translate(-11.2 46.4) scale(2.6)" d="${DROP}"/>
    <path class="ng-hi" d="M43 142C45 128 52 116 60 106"/>
    <g transform="translate(41.6 117.4) scale(.95)"><path class="ng-ng" d="${DUMB}"/><path class="ng-ng" d="M3 28V36M61 28V36"/></g>
    <text class="ng-nt" x="140" y="112">Még hátravan</text><text class="ng-nt" x="140" y="136">a mai edzés</text>
    <text class="ng-s" x="140" y="160">Utána egy fehérjés vacsora,</text><text class="ng-s" x="140" y="176">és a tápanyag is kész.</text>
  </g>
  ${badge(72,230,2,'Ma eddig · 6 terület')}
  ${ST.map(([k,t,s,sk,v,u,sub],i)=>station(k,i%2?'R':'L',Y0+PITCH*i,t,s,sk,v,u,sub)).join('')}

  ${badge(180,yEnd+50,3,'A napod · te és az app')}
  ${drip(122,yEnd+92)}${drip(238,yEnd+92,.8)}
  <g class="ng-ves"><path class="ng-glass" d="M96 ${U}V${U+104}C96 ${U+170} 264 ${U+170} 264 ${U+104}V${U}H212V${U+100}C212 ${U+124} 148 ${U+124} 148 ${U+100}V${U}Z"/>
    <g clip-path="url(#ng-c-u)"><g clip-path="url(#ng-c-ul)"><path class="ng-wv" fill="url(#ng-g-dom)" d="M48 ${U+55}${' q12 -5 24 0 t24 0'.repeat(4)} V${U+200} H48Z"/></g>
      <g clip-path="url(#ng-c-ur)"><path class="ng-wv" fill="url(#ng-g-ok)" d="M132 ${U+46}${' q12 -5 24 0 t24 0'.repeat(4)} V${U+200} H132Z"/></g></g>
    <path class="ng-line" d="M96 ${U}V${U+104}C96 ${U+170} 264 ${U+170} 264 ${U+104}V${U}H212V${U+100}C212 ${U+124} 148 ${U+124} 148 ${U+100}V${U}Z"/>
    <path class="ng-hi" d="M104 ${U+70}V${U+112}"/><path class="ng-hi" d="M220 ${U+62}V${U+112}"/></g>
  <path class="ng-mark" d="M152 ${U+55}H208M152 ${U+46}H208"/>
  <g data-toast="Az app pontszáma: a hat terület súlyozott átlaga" role="button" tabindex="0"><rect class="ng-hit" x="50" y="${U}" width="130" height="198"/>
    <text class="ng-un" x="122" y="${U+96}" text-anchor="middle">64</text><text class="ng-uu" x="122" y="${U+112}" text-anchor="middle">/ 100</text>
    <text class="ng-t" x="108" y="${U+176}" text-anchor="middle">az app szerint</text><text class="ng-s" x="108" y="${U+193}" text-anchor="middle">közepes nap</text></g>
  <g data-toast="A te ítéleted: az esti check-in utolsó kérdése" role="button" tabindex="0"><rect class="ng-hit" x="180" y="${U}" width="130" height="198"/>
    <text class="ng-un" x="238" y="${U+96}" text-anchor="middle">7</text><text class="ng-uu" x="238" y="${U+112}" text-anchor="middle">/ 10</text>
    <text class="ng-t" x="252" y="${U+176}" text-anchor="middle">szerinted</text><text class="ng-s" x="252" y="${U+193}" text-anchor="middle">jó nap</text></g>
  </svg>`}

/* ── VARIANT 2 ("bátrabb"): no pipe, no rows. Every unit is one big vessel and its words live INSIDE it —
   in the air above the level (ink) or in the liquid (white). The shapes themselves tile the page. ── */
function drawing2(){
  const wv=(x,y,n,g)=>`<path class="ng-wv" fill="url(#ng-g-${g})" d="M${x} ${y}${' q12 -5 24 0 t24 0'.repeat(n)} V1400 H${x}Z"/>`;
  const BOWL='M14 300H346C346 410 280 450 180 450C80 450 14 410 14 300Z',EGG='M304 236C318 236 327 256 327 271A23 23 0 0 1 281 271C281 256 290 236 304 236Z';
  const LF1='M90 596C58 600 22 574 12 518C52 510 84 546 90 596Z',LF2='M90 568C122 572 160 546 168 488C128 482 96 520 90 568Z',POT='M30 604H150L138 694H42Z';
  const MT='translate(164 446) scale(4)',KB='M118 768A82 82 0 1 1 117.9 768Z',KH='M90 776L82 752C79 740 87 732 97 732H139C149 732 157 740 154 752L146 776';
  const tube=x=>`M${x-13} 776A13 13 0 0 1 ${x+13} 776V886A13 13 0 0 1 ${x-13} 886Z`,TX=[226,260,294,328];
  const RW='M-10 1058'+' q22 -40 44 0 t44 0'.repeat(5);
  const UU='M20 1140V1260C20 1360 340 1360 340 1260V1140H220V1256C220 1292 140 1292 140 1256V1140Z';
  return `<svg class="ng ng2" viewBox="0 0 360 1350" role="img" aria-label="A mai napod rajza: most érdemes, a hat terület, te és az app">
  <defs>
    <linearGradient id="ng-g-dom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--liq1)"/><stop offset="1" style="stop-color:var(--liq2)"/></linearGradient>
    <linearGradient id="ng-g-ok" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FD3A0"/><stop offset="1" stop-color="#149E6E"/></linearGradient>
    <linearGradient id="ng-g-warn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3C969"/><stop offset="1" stop-color="#C98A12"/></linearGradient>
    <linearGradient id="ng-g-prot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0A29B"/><stop offset="1" stop-color="#D9605A"/></linearGradient>
    <clipPath id="n2-bowl"><path d="${BOWL}"/></clipPath><clipPath id="n2-egg"><path d="${EGG}"/></clipPath>
    <clipPath id="n2-l1"><path d="${LF1}"/></clipPath><clipPath id="n2-l2"><path d="${LF2}"/></clipPath><clipPath id="n2-pot"><path d="${POT}"/></clipPath>
    <clipPath id="n2-moon"><path transform="${MT}" d="${MOON}"/></clipPath><clipPath id="n2-kb"><path d="${KB}"/></clipPath>
    ${TX.map((x,i)=>`<clipPath id="n2-t${i}"><path d="${tube(x)}"/></clipPath>`).join('')}
    <clipPath id="n2-u"><path d="${UU}"/></clipPath><clipPath id="n2-ul"><rect x="0" y="1100" width="180" height="300"/></clipPath><clipPath id="n2-ur"><rect x="180" y="1100" width="180" height="300"/></clipPath>
  </defs>

  <!-- 1 · most érdemes: the drop that hangs from the day's tank -->
  <g class="ng-next" data-toast="Edzés megnyitása" role="button" tabindex="0" aria-label="Most érdemes: még hátravan a mai edzés. Edzés megnyitása">
    <rect class="ng-hit" x="10" y="70" width="340" height="180"/>
    <path class="ng-nd" d="M104 2C122 44 192 94 192 156A88 88 0 0 1 16 156C16 94 86 44 104 2Z"/>
    <path class="ng-hi" d="M54 116C60 102 68 90 78 78"/>
    <g transform="translate(83 72) scale(.66)"><path class="ng-ng" d="${DUMB}"/><path class="ng-ng" d="M3 28V36M61 28V36"/></g>
    <text class="n2-eb w" x="104" y="140" text-anchor="middle">MOST ÉRDEMES · DÉLUTÁN</text>
    <text class="n2-big w" x="104" y="168" text-anchor="middle">Még hátravan</text><text class="n2-big w" x="104" y="192" text-anchor="middle">a mai edzés</text>
    <text class="ng-t" x="206" y="150">Utána egy fehérjés</text><text class="ng-t" x="206" y="168">vacsora, és a tápanyag</text><text class="ng-t" x="206" y="186">is kész.</text>
  </g>
  <text class="ng-s f" x="350" y="30" text-anchor="end">Napközben nincs pontszám.</text><text class="ng-s f" x="350" y="46" text-anchor="end">Hajnali 3-kor zárom a napot,</text><text class="ng-s f" x="350" y="62" text-anchor="end">reggelre megírom, milyen volt.</text>
  ${drip(104,262)}${drip(104,280,1)}

  <!-- 2 · tápanyag: a bowl as wide as the page; its rim is the day's budget, the egg is the protein -->
  <g class="ng-ves"><path class="ng-glass" d="M130 449H230L238 464H122Z"/><path class="ng-glass" d="${BOWL}"/><g clip-path="url(#n2-bowl)">${wv(-40,340,9,'dom')}</g><path class="ng-line" d="${BOWL}"/>
    <path class="ng-glass" d="${EGG}"/><g clip-path="url(#n2-egg)">${wv(260,244,3,'prot')}</g><path class="ng-line" d="${EGG}"/></g>
  <path class="ng-rim" d="M8 300H352"/><path class="ng-hi" d="M40 352C52 396 84 422 124 434"/>
  <text class="ng-t" x="28" y="326">Tápanyag<tspan class="ng-k q" dx="7">úton</tspan></text><text class="ng-s" x="332" y="326" text-anchor="end">keret 2 782 kcal</text>
  <text class="n2-num w" x="180" y="398" text-anchor="middle">2 060<tspan class="n2-unit" dx="6">kcal</tspan></text>
  <text class="n2-in w" x="180" y="422" text-anchor="middle">a 2 782-ből</text>
  <text class="n2-in w b" x="304" y="278" text-anchor="middle">148</text><text class="ng-s" x="272" y="268" text-anchor="end">fehérje</text><text class="ng-t" x="272" y="285" text-anchor="end">148 / 166 g</text>

  <!-- 3 · minőség: a sprout — each leaf is one share -->
  <path class="ng-stem" style="stroke-width:5" d="M90 606V560"/>
  <g class="ng-ves"><path class="ng-glass" d="${LF1}"/><g clip-path="url(#n2-l1)">${wv(-20,543,5,'dom')}</g><path class="ng-line" d="${LF1}"/>
    <path class="ng-glass" d="${LF2}"/><g clip-path="url(#n2-l2)">${wv(70,503,5,'dom')}</g><path class="ng-line" d="${LF2}"/>
    <path class="ng-glass" d="${POT}"/><g clip-path="url(#n2-pot)">${wv(10,627,7,'dom')}</g><path class="ng-line" d="${POT}"/></g>
  <path class="ng-rim" d="M24 604H156"/>
  <text class="n2-in w b" x="50" y="570" text-anchor="middle">68%</text><text class="n2-in w b" x="130" y="538" text-anchor="middle">80%</text>
  <text class="ng-s" x="10" y="508">feldolgozatlan</text><text class="ng-s" x="168" y="478" text-anchor="end">mikro</text>
  <text class="n2-num w s" x="90" y="672" text-anchor="middle">74<tspan class="n2-unit" dx="3">%</tspan></text>
  <text class="ng-t" x="90" y="716" text-anchor="middle">Minőség<tspan class="ng-k q" dx="7">úton</tspan></text>

  <!-- 4 · alvás: the moon holds the night, the words sit in its hollow -->
  <g class="ng-ves"><path class="ng-glass" transform="${MT}" d="${MOON}"/><g clip-path="url(#n2-moon)">${wv(170,516,8,'ok')}</g><path class="ng-line" transform="${MT}" style="stroke-width:.5" d="${MOON}"/></g>
  <path class="ng-hi" d="M202 590C208 618 226 640 250 650"/>
  <text class="ng-t" x="304" y="528" text-anchor="middle">Alvás<tspan class="ng-k ok" dx="7">kész</tspan></text>
  <text class="n2-num s" x="304" y="560" text-anchor="middle">7ó 16p</text>
  <text class="ng-s" x="304" y="579" text-anchor="middle">minőség 7/10</text><text class="ng-s" x="304" y="595" text-anchor="middle">az éjszaka lezárult</text>

  <!-- 5 · edzés: an empty kettlebell with a dashed wall — still ahead -->
  <path class="ng-open" style="stroke-width:3.4;stroke-dasharray:8 8" d="${KH}"/>
  <g class="ng-ves"><path class="ng-glass" d="${KB}"/><g clip-path="url(#n2-kb)">${wv(20,921,6,'warn')}</g></g><path class="ng-open" style="stroke-width:3.4;stroke-dasharray:8 8" d="${KB}"/>
  <text class="ng-t" x="118" y="826" text-anchor="middle">Edzés<tspan class="ng-k warn" dx="7">nyitva</tspan></text>
  <text class="n2-num" x="118" y="870" text-anchor="middle">0/1</text>
  <text class="ng-s" x="118" y="890" text-anchor="middle">a mai edzés</text><text class="ng-s" x="118" y="906" text-anchor="middle">még hátravan</text>

  <!-- 6 · logolás: four tall tubes, one per check-in of the day -->
  <text class="ng-t" x="277" y="750" text-anchor="middle">Logolás<tspan class="ng-k q" dx="7">úton</tspan></text>
  <g class="ng-ves">${TX.map((x,i)=>i<2?`<path class="ng-glass" d="${tube(x)}"/><g clip-path="url(#n2-t${i})">${wv(x-40,782,4,'dom')}</g><path class="ng-line" d="${tube(x)}"/><path class="ng-hi" d="M${x-6} 796V840"/>`
    :`<path class="ng-glass" d="${tube(x)}"/><path class="ng-open q" d="${tube(x)}"/>`).join('')}</g>
  <path class="ng-rim" d="M206 906H348"/>
  <text class="n2-num s" x="208" y="940">2/4<tspan class="n2-unit" dx="5">check-in</tspan></text><text class="ng-s" x="208" y="958">a nap négy pillanata</text>

  <!-- 7 · ritmus: a swinging tube across the page, filled to 74% -->
  <text class="ng-t" x="20" y="982">Ritmus<tspan class="ng-k ok" dx="7">kész</tspan></text><text class="n2-num s" x="20" y="1012">74</text>
  <text class="ng-s" x="340" y="1012" text-anchor="end">a heted eddigi üteme</text>
  <g class="ng-ves"><path class="ng-coil a" d="${RW}"/><path class="ng-coil b" d="${RW}"/><path class="ng-coil c" pathLength="100" stroke-dasharray="74 100" d="${RW}"/></g>

  <!-- 8 · te és az app: one U-shaped glass, two opinions -->
  <text class="ng-h" x="180" y="1118" text-anchor="middle">A napod · te és az app</text>
  <g class="ng-ves"><path class="ng-glass" d="${UU}"/><g clip-path="url(#n2-u)"><g clip-path="url(#n2-ul)">${wv(-20,1212,5,'dom')}</g><g clip-path="url(#n2-ur)">${wv(176,1199,5,'ok')}</g></g><path class="ng-line" d="${UU}"/></g>
  <path class="ng-mark" d="M146 1212H214M146 1199H214"/>
  <g data-toast="Az app pontszáma: a hat terület súlyozott átlaga" role="button" tabindex="0"><rect class="ng-hit" x="20" y="1140" width="140" height="200"/>
    <text class="ng-t" x="80" y="1168" text-anchor="middle">az app szerint</text><text class="ng-s" x="80" y="1185" text-anchor="middle">közepes nap</text>
    <text class="n2-num w xl" x="80" y="1278" text-anchor="middle">64</text><text class="n2-in w" x="80" y="1298" text-anchor="middle">/ 100</text></g>
  <g data-toast="A te ítéleted: az esti check-in utolsó kérdése" role="button" tabindex="0"><rect class="ng-hit" x="200" y="1140" width="140" height="200"/>
    <text class="ng-t" x="280" y="1166" text-anchor="middle">szerinted</text><text class="ng-s" x="280" y="1183" text-anchor="middle">jó nap</text>
    <text class="n2-num w xl" x="280" y="1278" text-anchor="middle">7</text><text class="n2-in w" x="280" y="1298" text-anchor="middle">/ 10</text></g>
  </svg>`}

/* the comparison switch (the owner asked for it on the screen; it exists only on this experiment page) */
const orig=nap.routes.napom;
const sw=on=>`<div class="ng-sw"><small>Kísérlet</small>${[['napom','Lista'],['napomg','Csöves'],['napomt','Bátrabb']].map(([r,l])=>`<button class="${r===on?'on':''}" data-go="${r}">${l}</button>`).join('')}</div>`;
const withSw=(html,on)=>html.replace('</header>','</header>'+sw(on));
const TAIL=`<p class="ng-say">Az app szerint közepes nap, szerinted jó volt.</p>
    <p class="ng-foot">A 7/10 az esti check-in utolsó kérdéséből jön („Milyen volt a napod összességében?”). A napod többi része nem változik.</p>`;
function variant(on,body){const base=orig('');
  const a=base.indexOf('<p class="np-under'),b=base.indexOf('</div><nav class="fh-nav"');
  if(a<0||b<0)return base;
  return withSw(base.slice(0,a)+body+TAIL+base.slice(b),on)}
nap.routes.napom=a=>a?orig(a):withSw(orig(''),'napom');
nap.routes.napomg=()=>variant('napomg',`<div class="ng-lead"><p>Napközben nincs pontszám. Hajnali 3-kor zárom a napot, és reggelre megírom, milyen volt.</p></div>${drawing()}`);
nap.routes.napomt=()=>variant('napomt',drawing2());

F.css(`/* kiserlet-napom */
${P} .ng-sw{display:flex;align-items:center;gap:6px;margin:10px 14px 0;padding:5px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.1)}
${P} .ng-sw small{padding:0 6px 0 10px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
${P} .ng-sw button{flex:1;min-height:36px;border-radius:999px;font-size:13px;font-weight:700;color:var(--sub)}
${P} .ng-sw button.on{background:linear-gradient(160deg,var(--liq1),var(--liq2));color:#fff}
${P} svg.ng2{width:100%;margin:0}
${P} .ng-s.f{fill:var(--faint);font-size:11.5px}
${P} .ng text.w{fill:#fff}
${P} .n2-eb{font-size:9.5px;font-weight:700;letter-spacing:.08em;opacity:.9}
${P} .n2-big{font:800 20px var(--disp,inherit);letter-spacing:-.03em}
${P} .n2-num{font:800 38px var(--disp,inherit);letter-spacing:-.04em;fill:var(--ink)}
${P} .n2-num.s{font-size:28px}${P} .n2-num.xl{font-size:58px}
${P} .n2-unit{font:600 13px var(--ff,inherit);letter-spacing:0;opacity:.85}
${P} .n2-in{font-size:12.5px;font-weight:600}${P} .n2-in.b{font:800 14px var(--disp,inherit)}
${P} .ng2 .ng-coil.a{stroke-width:21}${P} .ng2 .ng-coil.b,${P} .ng2 .ng-coil.c{stroke-width:16}
${P} .ng-lead{position:relative;margin-top:0;padding:16px 22px 14px calc(14px + (100% - 28px)*.2 + 24px)}
${P} .ng-lead::before{content:"";position:absolute;left:calc(14px + (100% - 28px)*.2 - 4px);top:-2px;bottom:-2px;width:8px;background:color-mix(in srgb,var(--liq1) 52%,#E9F2F8)}
${P} .ng-lead p{font-size:12.5px;line-height:1.45;color:var(--sub)}
${P} svg.ng{display:block;width:calc(100% - 28px);margin:0 14px;overflow:visible}
${P} .ng text{font-family:var(--ff,inherit)}
${P} .ng-pipe{fill:none;stroke:color-mix(in srgb,var(--liq1) 52%,#E9F2F8);stroke-width:8;stroke-linecap:round}
${P} .ng-flow{fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-dasharray:1 21;opacity:.9}
${P} .ng-ves{filter:drop-shadow(0 9px 10px rgba(24,119,242,.16))}
${P} .ng-glass{fill:#fff;stroke:none}
${P} .ng-line{fill:none;stroke:rgba(10,42,60,.2);stroke-width:2;stroke-linejoin:round}
${P} .ng-rim{fill:none;stroke:rgba(10,42,60,.3);stroke-width:3;stroke-linecap:round}
${P} .ng-hi{fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;opacity:.75}
${P} .ng-stem{fill:none;stroke:var(--liq2);stroke-width:3.2;stroke-linecap:round}
${P} .ng-open{fill:none;stroke:var(--warn);stroke-width:2.4;stroke-dasharray:5 5;stroke-linecap:round}
${P} .ng-open.q{stroke:rgba(10,42,60,.28)}
${P} .ng-spark{fill:#149E6E;opacity:.85}
${P} .ng-drip{fill:var(--liq1)}
${P} .ng-coil{fill:none;stroke-linecap:butt}
${P} .ng-coil.a{stroke:rgba(10,42,60,.22);stroke-width:13.5}${P} .ng-coil.b{stroke:#fff;stroke-width:10}${P} .ng-coil.c{stroke:#1FAE7C;stroke-width:10}
${P} .ng-b path{fill:url(#ng-g-dom)}
${P} .ng-b text{font:800 12px var(--disp,inherit);fill:#fff}
${P} .ng-h{font-size:13.5px;font-weight:700;fill:var(--ink)}
${P} .ng-t{font-size:14.5px;font-weight:700;fill:var(--ink)}
${P} .ng-k{font-size:11.5px;font-weight:700;fill:var(--dom)}${P} .ng-k.ok{fill:var(--ok)}${P} .ng-k.warn{fill:var(--warn)}
${P} .ng-v{font:800 28px var(--disp,inherit);letter-spacing:-.03em;fill:var(--ink)}
${P} .ng-u{font:600 13px var(--ff,inherit);fill:var(--sub);letter-spacing:0}
${P} .ng-s{font-size:12.5px;fill:var(--sub)}
${P} .ng-next{cursor:pointer}
${P} .ng-nd{fill:url(#ng-g-dom);filter:drop-shadow(0 4px 5px rgba(24,119,242,.3))}
${P} .ng-ng{fill:none;stroke:#fff;stroke-width:4;stroke-linejoin:round;stroke-linecap:round}
${P} .ng-nt{font:800 21px var(--disp,inherit);letter-spacing:-.03em;fill:var(--ink)}
${P} .ng-un{font:800 27px var(--disp,inherit);fill:#fff;letter-spacing:-.03em}
${P} .ng-uu{font-size:10.5px;font-weight:700;fill:#fff;opacity:.9}
${P} .ng-mark{fill:none;stroke:rgba(10,42,60,.3);stroke-width:1.4;stroke-dasharray:3 4}
${P} .ng-hit{fill:transparent;cursor:pointer}
${P} .ng-say{margin:18px 26px 0;font:800 19px/1.2 var(--disp,inherit);letter-spacing:-.02em;text-align:center;color:var(--ink);text-wrap:balance}
${P} .ng-foot{margin:8px 30px 0;font-size:12px;line-height:1.45;text-align:center;color:var(--sub)}
@media (prefers-reduced-motion:no-preference){
  body:not(.still) ${P} .ng-wv{animation:ng-wv 5s linear infinite}
  body:not(.still) ${P} .ng-flow{animation:ng-fl 1.6s linear infinite}
  body:not(.still) ${P} .ng-drip{animation:ng-dr 2.2s ease-in infinite;animation-delay:var(--dl,0s)}
}
@keyframes ng-wv{to{transform:translateX(-48px)}}
@keyframes ng-fl{to{stroke-dashoffset:-22}}
@keyframes ng-dr{0%{opacity:0;translate:0 -6px}25%{opacity:1}100%{opacity:0;translate:0 12px}}
`);
window.FNOTES_FOLY=`<h2>Kísérlet · A napom rajzolva</h2><p>Ugyanaz az oldal, ugyanazokkal a számokkal, kétféleképp: <a href="#w-nap-napom">Lista</a> (a mostani), <a href="#w-nap-napomg">Csöves</a> és <a href="#w-nap-napomt"><b>Bátrabb</b></a> — a telefon tetején lévő váltóval is lépkedhetsz köztük. A hét csíkja és a nagy edény változatlan; ami alatta van, az egyetlen rajz: a nap folyadéka egy csövön fut le, és minden egység a saját edénye rajta.</p>`+(window.FNOTES_FOLY||'');
})();
