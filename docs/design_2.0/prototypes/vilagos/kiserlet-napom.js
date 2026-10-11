/* vilagos/kiserlet-napom.js — EXPERIMENT (owner idea, 2026-10-11): "A napom" without cards and lists.
   NOT part of the build target: it is loaded only by ../kiserlet-napom-grafika.html, never by the shell
   (klinikai-iranyok.html), so the approved #w-nap-napom stays what the builders read.
   Route: #w-nap-napomg — the week strip is the approved one; there is no hero tank (owner, round 3);
   everything under the strip is ONE drawing: the day's liquid runs down a pipe, and every unit is its own vessel on that pipe.
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
    <rect class="ng-hit" x="10" y="70" width="340" height="142"/><path class="ng-nd" transform="translate(-11.2 46.4) scale(2.6)" d="${DROP}"/>
    <path class="ng-hi" d="M43 142C45 128 52 116 60 106"/>
    <g transform="translate(41.6 117.4) scale(.95)"><path class="ng-ng" d="${DUMB}"/><path class="ng-ng" d="M3 28V36M61 28V36"/></g>
    <text class="ng-nt" x="140" y="112">Még hátravan</text><text class="ng-nt" x="140" y="136">a mai edzés</text>
    <text class="ng-s" x="140" y="160">Utána egy fehérjés vacsora,</text><text class="ng-s" x="140" y="176">és a tápanyag is kész.</text>
    <text class="ng-go" x="140" y="200">Edzés megnyitása ›</text>
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

/* No hero (owner, round 3): the week strip stays, the pipe starts under today's vessel, and what the hero said
   (day, verdict, 2/6, the note) stands beside the pipe as plain words. The lead drop carries the action. */
function napomg(){const base=nap.routes.napom('');
  const a=base.indexOf('<section class="k2-tank'),b=base.indexOf('</div><nav class="fh-nav"');
  if(a<0||b<0)return base;
  return base.slice(0,a)+`<svg class="ng ng-top" viewBox="0 0 360 40" aria-hidden="true">${pipe('M180 0C180 30 72 12 72 40')}</svg>
    <div class="ng-lead"><small>Csütörtök · szept 24 · élő · 14:20</small>
      <h2>Fehérjéből már csak 18 g hiányzik, az edzés még hátravan.</h2>
      <p class="ng-cnt"><b>2/6</b> terület kész</p>
      <p>Napközben nincs pontszám. Hajnali 3-kor zárom a napot, és reggelre megírom, milyen volt.</p></div>
    ${drawing()}
    <p class="ng-say">Az app szerint közepes nap, szerinted jó volt.</p>
    <p class="ng-foot">A 7/10 az esti check-in utolsó kérdéséből jön („Milyen volt a napod összességében?”). A napod többi része nem változik.</p>`+base.slice(b)}
nap.routes.napomg=napomg;
nap.routes.napomt=napomg; /* the removed variant's address: a tab left open on it must not fall back to Mai */

F.css(`/* kiserlet-napom */
${P} svg.ng-top{margin-top:6px}
${P} .ng-lead small{display:block;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sub)}
${P} .ng-lead h2{margin:6px 0 0;font:800 23px/1.12 var(--disp,inherit);letter-spacing:-.03em;color:var(--ink);text-wrap:balance}
${P} .ng-lead .ng-cnt{margin:10px 0 8px;font-size:13px;font-weight:700;color:var(--ink)}
${P} .ng-lead .ng-cnt b{font:800 30px var(--disp,inherit);letter-spacing:-.04em;margin-right:6px;background:linear-gradient(160deg,var(--liq1),var(--liq2));-webkit-background-clip:text;background-clip:text;color:transparent}
${P} .ng-go{font-size:13px;font-weight:700;fill:var(--dom)}
${P} .ng-lead{position:relative;margin-top:0;padding:4px 22px 16px calc(14px + (100% - 28px)*.2 + 24px)}
${P} .ng-lead::before{content:"";position:absolute;left:calc(14px + (100% - 28px)*68/360);top:-2px;bottom:-2px;width:calc((100% - 28px)*8/360);background:color-mix(in srgb,var(--liq1) 52%,#E9F2F8)}
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
window.FNOTES_FOLY=`<h2>Kísérlet · A napom rajzolva</h2><p><a href="#w-nap-napomg"><b>A rajzolt változat</b></a>: a hét csíkja alatt nincs nagy edény és nincs kártya, a mai nap edényéből egy cső indul, és minden egység a saját edénye rajta. Összevetésnek: <a href="#w-nap-napom">a mostani, listás oldal</a>.</p>`+(window.FNOTES_FOLY||'');
})();
