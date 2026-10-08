// Builds the "Tisztított Üveg" variant: each living prototype (elo/<domain>.html) + one
// overlay (quiet cards, one focus per screen, bubbles instead of Boops). The living files
// are never edited; output goes to tiszta/<domain>.html.  Run: node csepp/build-tiszta.mjs
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const FORM={round:'M50 6C72 6 91 21 92 45 93 70 76 94 50 94 24 94 7 70 8 45 9 21 28 6 50 6Z',
  bean:'M38 7C62 3 91 17 93 44 95 71 78 94 54 94 37 94 32 80 26 66 18 51 7 39 10 25 14 13 26 9 38 7Z',
  drop:'M50 5C62 24 89 44 89 64 89 82 72 94 50 94 28 94 11 82 11 64 11 44 38 24 50 5Z',
  crystal:'M50 5L85 26 89 65 58 94 21 85 9 44 24 17Z',
  leaf:'M50 5C83 19 94 56 77 83 67 94 33 94 23 83 6 56 17 19 50 5Z',
  pebble:'M50 15C77 13 94 32 92 54 90 79 69 89 48 87 23 85 6 70 8 48 10 27 27 17 50 15Z'};
const SHAPE={nap:'round',train:'bean',fuel:'drop',mezo:'pebble',en:'leaf',gold:'round',slate:'crystal'};
const SOLID={gold:'#E0AC2F',slate:'#8C97A8'};
function bubble(id,body){
  const g=(body.match(/url\(#([a-z0-9-]*body[a-z0-9-]*)\)/)||[])[1];
  const fill=g?`url(#${g})`:(SOLID[id]||'#9AA3A8'); const d=FORM[SHAPE[id]||'round'];
  return `<symbol id="boop-${id}" viewBox="0 0 100 100"><title>Buborék · ${id}</title>
    <ellipse cx="50" cy="94" rx="22" ry="3.6" fill="#000" opacity=".22"/>
    <g class="boop-body"><path d="${d}" fill="rgba(245,239,230,.07)" stroke="rgba(245,239,230,.38)" stroke-width="1.4"/>
      <clipPath id="tzc-${id}"><path d="${d}"/></clipPath>
      <g clip-path="url(#tzc-${id})"><path class="tz-liq" fill="${fill}" d="M-20 42 Q-10 37 0 42 T20 42 T40 42 T60 42 T80 42 T100 42 T120 42 V110 H-20Z"/></g>
      <path d="M27 25 Q35 15 47 13" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2.6" stroke-linecap="round"/></g></symbol>`;
}
const CSS=`
/* ══ TISZTÍTOTT ÜVEG — the living look, decluttered (owner 2026-10-08) ══
   one focus card per screen keeps the full glass; other wide cards open up (no box);
   small tiles go quiet; coloured glows only on the focus; Boops are bubbles. */
.tz-open{background:none!important;box-shadow:none!important;border-radius:0!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;
  border-top:1px solid var(--hair);padding-left:2px!important;padding-right:2px!important}
.tz-open::before,.tz-open::after,.tz-tile::before,.tz-tile::after{display:none!important}
.tz-tile{background:rgba(245,239,230,.035)!important;box-shadow:inset 0 0 0 1px var(--hair)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.tz-open .icon,.tz-tile .icon{filter:drop-shadow(0 4px 5px rgba(0,0,0,.45))!important}
.tz-open .flat,.tz-tile .flat{background:none!important;box-shadow:inset 0 0 0 1px var(--hair)!important}
.tz-open+.tz-open{margin-top:4px}
.tz-focus{margin-top:10px;margin-bottom:14px}
@media (prefers-reduced-motion:no-preference){body:not(.still) .boop.is-alive .tz-liq{animation:tz-wave 3.8s ease-in-out infinite}}
@keyframes tz-wave{0%,100%{transform:translateX(0)}50%{transform:translateX(-10px)}}
`;
const JS=`
(function(){const sc=document.getElementById('scroll');if(!sc)return;
  const KEEP='.backbtn,.back,.start,.btn,.chip,.send,.pillx,.primary,.fab,.rbtn,.orb';
  function run(){const W=sc.clientWidth;let focus=false;
    sc.querySelectorAll('.glass').forEach(el=>{el.classList.remove('tz-open','tz-tile','tz-focus');
      if(el.matches(KEEP)||el.closest('.topbar'))return;
      if(el.parentElement&&el.parentElement.closest('.tz-focus'))return;
      const wide=el.offsetWidth>=W*0.72&&el.offsetHeight>=72;
      if(wide){if(!focus){focus=true;el.classList.add('tz-focus')}else el.classList.add('tz-open')}
      else el.classList.add('tz-tile')})}
  let t;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(run,40)}).observe(sc,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>setTimeout(run,60));run();setTimeout(run,300)})();
`;
mkdirSync(join(root,'tiszta'),{recursive:true});
for(const d of ['nap','edzes','fuel','mezo','en']){
  let s=readFileSync(join(root,'elo',d+'.html'),'utf8'); let n=0;
  s=s.replace(/<symbol id="boop-([a-z]+)"[^>]*>([\s\S]*?)<\/symbol>/g,(m,id,body)=>{n++;return bubble(id,body)});
  const i=s.lastIndexOf('</style>'); s=s.slice(0,i)+CSS+s.slice(i);
  const j=s.lastIndexOf('</body>'); s=s.slice(0,j)+'<script>'+JS+'</script>\n'+s.slice(j);
  writeFileSync(join(root,'tiszta',d+'.html'),s); console.log(d,'bubbles:',n,'bytes:',s.length);
}
