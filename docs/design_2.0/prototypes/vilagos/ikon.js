/* ikon.js — icon-direction experiment for Folyadék (owner: "az ikonok színben, stílusban nem passzolnak").
   The Titanium sprite (t-*) was drawn for a dark ground: 122 of its shapes use the graphite gradient
   `tg-titanium`. Here we build re-lit variants of the whole family without touching the originals:
     a = Porcelán      — same 3D drawings, white-porcelain bodies, cleaner natural colours, soft blue shadow
     b = Területszín   — same drawings, glass body + the current domain's two liquid colours only
     c = Folyadék-jel  — a new, own family: outlined glyph half-filled with the domain liquid (drawn for
                         the icons in GLY; everything else falls back to "a" until drawn)
   window.IKON ('0'|'a'|'b'|'c') picks the family; a MutationObserver swaps <use> hrefs. Compare: #w-nap-ikonok */
(function(){
const F=window.F,NS='http://www.w3.org/2000/svg';
const sprite=document.querySelector('symbol[id^="t-"]').closest('svg');
const defs=document.createElementNS(NS,'defs');sprite.appendChild(defs);
const grad=(id,stops,x2='.8',y2='1')=>`<linearGradient id="${id}" x2="${x2}" y2="${y2}">${stops.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const A={titanium:[[0,'#ffffff'],[.2,'#e6edf6'],[.48,'#9fb1cb'],[.7,'#d3deec'],[.88,'#f7fafd'],[1,'#8496b4']],
  blue:[[0,'#d6f6ff'],[.4,'#4fb6ee'],[1,'#1c6fd0']],gold:[[0,'#fff3c9'],[.45,'#f6bd4a'],[1,'#d48a1c']],
  purple:[[0,'#e4efff'],[.4,'#79a8f2'],[1,'#3566c9']],lime:[[0,'#f0ffc4'],[.5,'#9bd457'],[1,'#3f9a46']],
  red:[[0,'#ffe0d4'],[.45,'#f47d5e'],[1,'#d1432e']],avo:[[0,'#f6f3b8'],[.5,'#bcd45c'],[1,'#5f9a35']],
  pink:[[0,'#fff2f8'],[.5,'#f6a3c8'],[1,'#d65c95']],rose:[[0,'#ffe6ea'],[.45,'#f58a9e'],[1,'#cf4662']]};
const KEYS=Object.keys(A);
defs.innerHTML=KEYS.map(k=>grad('tga-'+k,A[k])).join('')+KEYS.map(k=>grad('tgb-'+k,A[k])).join('')
 +`<filter id="tga-shadow" x="-60%" y="-60%" width="220%" height="240%"><feDropShadow dx="0" dy="2.4" stdDeviation="1.7" flood-color="#17406e" flood-opacity=".26"/></filter>`
 +`<filter id="tgb-shadow" x="-60%" y="-60%" width="220%" height="240%"><feDropShadow dx="0" dy="2.4" stdDeviation="1.7" flood-color="#17406e" flood-opacity=".24"/></filter>`
 +`<clipPath id="tc-lv"><path d="M-2 37Q6 32 14 37T30 37T46 37T66 37V70H-2Z"/></clipPath>`;
/* graphite hard-coded fills → slate, so screens/lenses do not stay black holes */
const lum=h=>{h=h.slice(1);if(h.length===3)h=[...h].map(c=>c+c).join('');const[r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);return[.2126*r+.7152*g+.0722*b,Math.max(r,g,b)-Math.min(r,g,b)]};
const relit=(src,v)=>src.replace(/url\(#tg-/g,`url(#tg${v}-`).replace(/(fill|stroke)="(#[0-9a-fA-F]{3,6})"/g,(m,a,h)=>{const[l,s]=lum(h);
  if(l<.3&&s<.16)return `${a}="${v==='a'?'#566884':'#566884'}"`;
  if(v==='b'&&l<.34)return `${a}="#566884" data-dk="1"`;return m});
let html='';
sprite.querySelectorAll('symbol[id^="t-"]').forEach(s=>{const o=s.outerHTML;for(const v of ['a','b'])html+=relit(o,v).replace(`id="${s.id}"`,`id="t${v}-${s.id.slice(2)}"`)});
/* c — own glyph family. [outline, details] in a 64 box; details are strokes in the domain colour */
const GLY={
 dawn:['M12 44A20 20 0 0 1 52 44Z','M5 44H59M32 10V16M12 22L16 26M52 22L48 26M18 53H46'],
 sun:['M32 20A12 12 0 1 1 31.9 20Z','M32 6V12M32 52V58M6 32H12M52 32H58M13.5 13.5L18 18M46 46L50.5 50.5M50.5 13.5L46 18M18 46L13.5 50.5'],
 moon:['M46 41A21 21 0 1 1 25 11A17 17 0 0 0 46 41Z','M46 12V20M42 16H50'],
 sleep:['M46 41A21 21 0 1 1 25 11A17 17 0 0 0 46 41Z','M40 10H50L40 22H50'],
 dumbbell:['M8 24A4 4 0 0 1 12 20H16A4 4 0 0 1 20 24V28H44V24A4 4 0 0 1 48 20H52A4 4 0 0 1 56 24V40A4 4 0 0 1 52 44H48A4 4 0 0 1 44 40V36H20V40A4 4 0 0 1 16 44H12A4 4 0 0 1 8 40Z','M3 28V36M61 28V36'],
 camera:['M12 20H20L24 13H40L44 20H52A5 5 0 0 1 57 25V46A5 5 0 0 1 52 51H12A5 5 0 0 1 7 46V25A5 5 0 0 1 12 20Z','M32 26A9 9 0 1 1 31.9 26Z'],
 weight:['M17 10H47A8 8 0 0 1 55 18V46A8 8 0 0 1 47 54H17A8 8 0 0 1 9 46V18A8 8 0 0 1 17 10Z','M21 26A11 11 0 0 1 43 26Z M32 26L36 19'],
 bowl:['M7 30H57C57 44 47 54 32 54S7 44 7 30Z','M22 21C19 16 25 14 22 9M34 21C31 16 37 14 34 9M44 21C42 17 46 15 44 12'],
 pot:['M7 30H57C57 44 47 54 32 54S7 44 7 30Z','M22 21C19 16 25 14 22 9M34 21C31 16 37 14 34 9M44 21C42 17 46 15 44 12'],
 plate:['M32 10A22 22 0 1 1 31.9 10Z','M32 20A12 12 0 1 1 31.9 20Z'],
 run:['M7 46C7 40 13 39 17 29L29 34C33 41 44 40 52 43C57 44.5 57 50 54 50H11C8 50 7 48.5 7 46Z','M21 31L25 37M3 24H11M2 33H8'],
 steps:['M7 46C7 40 13 39 17 29L29 34C33 41 44 40 52 43C57 44.5 57 50 54 50H11C8 50 7 48.5 7 46Z','M21 31L25 37M3 24H11M2 33H8'],
 meat:['M24 8C36 8 45 17 45 28C45 37 39 41 37 43L45 51A4 4 0 1 1 40 56L32 47C28 49 22 49 16 44C8 37 9 24 14 16C16 12 20 8 24 8Z','M21 20C24 17 29 18 31 21'],
 protein:['M24 8C36 8 45 17 45 28C45 37 39 41 37 43L45 51A4 4 0 1 1 40 56L32 47C28 49 22 49 16 44C8 37 9 24 14 16C16 12 20 8 24 8Z','M21 20C24 17 29 18 31 21'],
 carb:['M12 27C10 14 54 14 52 27C52 31 49 32 49 35V52H15V35C15 32 12 31 12 27Z','M24 38V46M32 38V46M40 38V46'],
 avocado:['M32 7C40 7 43 17 46 27C50 41 44 56 32 56S14 41 18 27C21 17 24 7 32 7Z','M32 31A7.5 7.5 0 1 1 31.9 31Z'],
 fat:['M32 7C40 7 43 17 46 27C50 41 44 56 32 56S14 41 18 27C21 17 24 7 32 7Z','M32 31A7.5 7.5 0 1 1 31.9 31Z'],
 fiber:['M10 54C10 28 28 10 54 10C54 36 36 54 10 54Z','M10 54L38 26M24 40V28M24 40H36'],
 sprout:['M10 54C10 28 28 10 54 10C54 36 36 54 10 54Z','M10 54L38 26M24 40V28M24 40H36'],
 water:['M32 6C41 19 50 28 50 39A18 18 0 0 1 14 39C14 28 23 19 32 6Z','M23 40C23 45 26 48 30 49'],
 journal:['M14 8H46A5 5 0 0 1 51 13V51A5 5 0 0 1 46 56H14Z','M22 8V56M30 20H42M30 29H42'],
 book:['M14 8H46A5 5 0 0 1 51 13V51A5 5 0 0 1 46 56H14Z','M22 8V56M30 20H42M30 29H42'],
 supps:['M38.5 9.5A11.5 11.5 0 0 1 54.5 25.5L25.5 54.5A11.5 11.5 0 0 1 9.5 38.5Z','M24 24L40 40'],
 checkin:['M32 8A24 24 0 1 1 31.9 8Z','M21 32L29 40L44 24'],
 tick:['M32 8A24 24 0 1 1 31.9 8Z','M21 32L29 40L44 24'],
 clock:['M32 8A24 24 0 1 1 31.9 8Z','M32 18V32L41 38'],
 calendar:['M13 13H51A5 5 0 0 1 56 18V50A5 5 0 0 1 51 55H13A5 5 0 0 1 8 50V18A5 5 0 0 1 13 13Z','M8 25H56M20 7V17M44 7V17M19 36H25M39 36H45M19 45H25'],
 heart:['M32 54C12 40 6 30 8 21C10 12 22 8 32 19C42 8 54 12 56 21C58 30 52 40 32 54Z','M17 22C18 18 21 17 24 18'],
 shield:['M32 6L54 14V30C54 44 44 53 32 58C20 53 10 44 10 30V14Z','M22 31L29 38L42 24'],
 flame:['M32 5C36 16 48 22 48 38A16 16 0 0 1 16 38C16 30 21 27 23 21C27 25 30 18 32 5Z','M32 34C36 39 37 43 32 48C27 43 28 39 32 34Z'],
 bolt:['M37 5L13 36H29L26 59L51 27H35Z',''],
 pattern:['M32 6L38 26L58 32L38 38L32 58L26 38L6 32L26 26Z',''],
 people:['M6 54C6 43 13 38 22 38S38 43 38 54Z','M22 14A9 9 0 1 1 21.9 14Z M43 20A7 7 0 1 1 42.9 20Z M44 40C52 40 58 45 58 54H45'],
 person:['M12 56C12 43 20 37 32 37S52 43 52 56Z','M32 9A11 11 0 1 1 31.9 9Z'],
 volley:['M32 8A24 24 0 1 1 31.9 8Z','M32 8C28 20 30 30 40 38M9 26C20 24 30 28 36 36M22 54C22 44 28 37 40 38C48 39 53 36 55 30'],
 record:['M32 5L39 16L52 15L50 28L59 37L48 44L46 57L34 52L22 57L18 44L7 37L16 28L13 15L26 16Z','M32 23L35 30L42 30.5L36.5 35L38.5 42L32 38L25.5 42L27.5 35L22 30.5L29 30Z'],
 score:['M32 6L40 23L58 25L45 38L48 56L32 47L16 56L19 38L6 25L24 23Z',''],
 star:['M32 6L40 23L58 25L45 38L48 56L32 47L16 56L19 38L6 25L24 23Z',''],
 send:['M6 28L58 6L44 58L30 38Z','M30 38L58 6'],
 scroll:['M14 8H50V50A6 6 0 0 1 44 56H20A6 6 0 0 1 14 50Z','M22 20H42M22 29H42M22 38H34'],
 note:['M14 8H50V50A6 6 0 0 1 44 56H20A6 6 0 0 1 14 50Z','M22 20H42M22 29H42M22 38H34'],
 orb:['M32 8A22 22 0 1 1 31.9 8Z','M20 24C23 18 28 16 33 16M18 58H46'],
 gear:['M27 5H37L39 13L46 17L54 14L59 23L53 29V35L59 41L54 50L46 47L39 51L37 59H27L25 51L18 47L10 50L5 41L11 35V29L5 23L10 14L18 17L25 13Z','M32 23A9 9 0 1 1 31.9 23Z'],
 bell:['M32 8C42 8 47 16 47 26C47 38 53 42 55 46H9C11 42 17 38 17 26C17 16 22 8 32 8Z','M26 53A6 6 0 0 0 38 53M32 3V8'],
 pencil:['M42 8L56 22L22 56H8V42Z','M36 14L50 28'],
 lens:['M27 6A21 21 0 1 1 26.9 6Z','M42 42L58 58'],
 key:['M22 20A14 14 0 1 1 21.9 20Z','M34 30L58 30M48 30V40M56 30V38'],
 mic:['M32 5A9 9 0 0 1 41 14V28A9 9 0 0 1 23 28V14A9 9 0 0 1 32 5Z','M14 28A18 18 0 0 0 50 28M32 46V58M22 58H42'],
 history:['M32 8A24 24 0 1 1 31.9 8Z','M32 18V32L41 38'],
 dawn2:['','']};
delete GLY.dawn2;
const gsym=(k,[p,x])=>`<symbol id="tc-${k}" viewBox="0 0 64 64"><path d="${p}" style="fill:color-mix(in srgb,var(--ic,var(--dom)) 11%,#fff)"/><g clip-path="url(#tc-lv)"><path d="${p}" style="fill:var(--ic2,var(--dom2))"/></g><path d="${p}" fill="none" style="stroke:var(--ic,var(--dom))" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${x?`<path d="${x}" fill="none" style="stroke:var(--ic,var(--dom))" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>`:''}</symbol>`;
html+=Object.entries(GLY).map(([k,v])=>gsym(k,v)).join('');
const holder=document.createElementNS(NS,'g');sprite.appendChild(holder);
const tmp=document.createElement('div');tmp.innerHTML=`<svg xmlns="${NS}">${html}</svg>`;[...tmp.firstChild.childNodes].forEach(n=>sprite.appendChild(n));
const HAS=id=>!!document.getElementById(id);
/* c also needs equivalents for the handful of clay icons used in chrome */
const CMAP={'c-i-ertesites':'tc-bell','c-i-beallitas':'tc-gear','c-i-emberek':'tc-people','c-i-tanyer':'tc-plate'};
const variant=(o,m)=>{if(m==='0')return o;if(m==='c'){if(CMAP[o])return CMAP[o];if(!o.startsWith('t-'))return o;const c='tc-'+o.slice(2);return HAS(c)?c:'ta-'+o.slice(2)}
  return o.startsWith('t-')?`t${m}-${o.slice(2)}`:o};
let MODE='0';try{MODE=localStorage.getItem('mezo-ikon')||'0'}catch(e){}
if(!/^[0abc]$/.test(MODE))MODE='0';
const hex=c=>c.trim();
function tint(){const ph=document.getElementById('phone');if(!ph)return;const cs=getComputedStyle(ph),d=hex(cs.getPropertyValue('--dom'))||'#1877F2',d2=hex(cs.getPropertyValue('--dom2'))||'#19C7C0';
  const mix=(c,p,w='#fff')=>`color-mix(in srgb,${c} ${p}%,${w})`;
  const set=(k,st)=>{const g=document.getElementById('tgb-'+k);if(g)[...g.children].forEach((s,i)=>s.style.stopColor=st[Math.min(i,st.length-1)])};
  set('titanium',['#ffffff',mix(d,10),mix(d,38),mix(d,16),mix(d,4),mix(d,46)]);
  for(const k of ['purple','blue','red','rose'])set(k,[mix(d,22),mix(d,82),mix(d,88,'#0b1f33')]);
  for(const k of ['gold','lime','avo','pink'])set(k,[mix(d2,22),mix(d2,85),mix(d2,84,'#0b1f33')]);
  document.documentElement.style.setProperty('--ikdk',mix(d,62,'#22324a'))}
function swap(root){(root.querySelectorAll?root:document).querySelectorAll('use').forEach(u=>{if(u.closest('[data-fixic]')||u.closest('symbol'))return;const h=u.getAttribute('href');if(!h)return;const o=u.dataset.o||h.slice(1);if(!/^(t-|c-i-)/.test(o))return;u.dataset.o=o;const want='#'+variant(o,MODE);if(h!==want)u.setAttribute('href',want)})}
function apply(){document.documentElement.dataset.ikon=MODE;tint();swap(document);document.querySelectorAll('#ikseg button').forEach(b=>b.classList.toggle('on',b.dataset.ik===MODE))}
let busy=false;new MutationObserver(()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{busy=false;tint();swap(document)})}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-d']});
window.IKON_SET=m=>{MODE=m;try{localStorage.setItem('mezo-ikon',m)}catch(e){}apply()};
document.addEventListener('click',e=>{const b=e.target.closest('[data-ik]');if(b)IKON_SET(b.dataset.ik)});
/* panel switcher */
const top=document.querySelector('.top');if(top){const s=document.createElement('div');s.className='seg';s.id='ikseg';s.setAttribute('aria-label','Ikonok');
  s.innerHTML=`<button data-ik="0">Ikon: mostani</button><button data-ik="a">A · Porcelán</button><button data-ik="b">B · Területszín</button><button data-ik="c">C · Folyadék-jel</button>`;top.appendChild(s)}
/* look tweaks per family */
const Q='.phone.foly[data-s="elo"]';
const st=document.createElement('style');st.textContent=`
symbol [data-dk]{fill:var(--ikdk)}
html:not([data-ikon="0"]) ${Q} .fb svg.ic,html:not([data-ikon="0"]) ${Q} .fh-step .si svg.ic,html:not([data-ikon="0"]) ${Q} .fh-row .si svg.ic,html:not([data-ikon="0"]) ${Q} .fh-h .tile svg.ic.td{width:70%;height:70%;filter:none}
html[data-ikon="a"] ${Q} .fb,html[data-ikon="b"] ${Q} .fb,html[data-ikon="a"] ${Q} .fh-step .si,html[data-ikon="b"] ${Q} .fh-step .si,html[data-ikon="a"] ${Q} .fh-row .si,html[data-ikon="b"] ${Q} .fh-row .si{background:radial-gradient(circle at 30% 24%,#fff 0 12%,color-mix(in srgb,var(--c,var(--dom)) 16%,#fff) 55%,color-mix(in srgb,var(--c,var(--dom)) 36%,#fff))}
${Q} .ikc.ik-a .fb,${Q} .ikc.ik-b .fb{background:radial-gradient(circle at 30% 24%,#fff 0 12%,color-mix(in srgb,var(--dom) 16%,#fff) 55%,color-mix(in srgb,var(--dom) 36%,#fff))!important}
html[data-ikon="c"] ${Q} .fb svg.ic,html[data-ikon="c"] ${Q} .fh-step .si svg.ic,html[data-ikon="c"] ${Q} .fh-row .si svg.ic,html[data-ikon="c"] ${Q} .fh-h .tile svg.ic.td{width:58%;height:58%}
html[data-ikon="c"] ${Q} .fb::after,html[data-ikon="c"] ${Q} .si::after,html[data-ikon="c"] ${Q} .tile::after{display:none}
html[data-ikon="c"] ${Q} .fb,html[data-ikon="c"] ${Q} .fh-step .si,html[data-ikon="c"] ${Q} .fh-row .si,html[data-ikon="c"] ${Q} .fh-h .tile{background:color-mix(in srgb,var(--c,var(--dom)) 8%,#fff);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c,var(--dom)) 16%,#fff)}
html[data-ikon="c"] ${Q} .k2-tube svg.ic{--ic:#fff;--ic2:rgba(255,255,255,.55)}
.ikc{display:grid;gap:14px;padding:16px}.ikc h4{font:700 15px var(--disp);margin:0 0 2px;color:var(--ink)}.ikc p{margin:0 0 10px;font-size:12.5px;color:var(--sub);line-height:1.45}
.ikc .rw{display:flex;gap:10px;flex-wrap:wrap}.ikc .rw svg.ic{width:100%;height:100%}
.ikc .b1{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;position:relative}
.ikc .ln{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid var(--line,#e6edf3);font-size:14px;font-weight:600;color:var(--ink)}.ikc .ln small{display:block;font-weight:400;color:var(--sub);font-size:12px}
#ikseg{margin-top:6px}`;document.head.appendChild(st);
/* comparison screen: the same icons in the four families, side by side on one page */
const SET=['dawn','sun','dumbbell','camera','weight','bowl','run','meat','carb','avocado','fiber','water','moon','journal','supps','checkin','calendar','people','heart','shield','flame','pattern','volley','record'];
const fam=(m,name,desc)=>{const use=k=>`<svg class="ic td" aria-hidden="true"><use href="#${variant('t-'+k,m)}"/></svg>`;
  const b=(k,s=46)=>`<span class="fb" style="--s:${s}px;--c:var(--dom)">${use(k)}</span>`;
  return F.card(`<div class="ikc ik-${m}" data-fixic="1" data-ikm="${m}"><div><h4>${name}</h4><p>${desc}</p><div class="rw">${SET.map(k=>b(k)).join('')}</div></div>
   <div>${[['dawn','Ébredés időben','a lánc kezdete'],['camera','Reggeli videó','megvolt az 50 fekvőtámasz'],['weight','Reggeli súlymérés','fogmosás után'],['bowl','Gombakávé','súlymérés után']].map(([k,t,s])=>`<div class="ln">${b(k,42)}<span>${t}<small>${s}</small></span></div>`).join('')}</div>
   <button class="btn pri" data-ik="${m}" style="justify-self:start">Ezt nézem az egész appon</button></div>`)};
if(window.FREG&&FREG.nap){FREG.nap.routes.ikonok=()=>F.page('nap',{title:'Ikon-irányok',sub:'ugyanaz a 24 ikon négyféleképp',back:'mai'},
  F.sec(1,'Mostani')+(fam('0','Mostani · sötét Titanium','Sötét grafit testek, lila–arany fény. Sötét háttérre készült, fehéren koszosnak hat.'))
 +F.sec(2,'A · Porcelán')+(fam('a','A · Porcelán','Ugyanazok a 3D rajzok, fehér porcelán testtel, tisztább természetes színekkel, puha kék árnyékkal.'))
 +F.sec(3,'B · Területszín')+(fam('b','B · Területszín','Ugyanazok a rajzok, de csak üveg + a terület két folyadékszíne. Egy oldalon minden ikon egy család.'))
 +F.sec(4,'C · Folyadék-jel')+(fam('c','C · Folyadék-jel','Új, saját készlet: egyszerű körvonalas jel, félig töltve a terület folyadékával. Kis méretben is olvasható.')))}
/* fixed-family blocks keep their own look regardless of the global switch */
const st2=document.createElement('style');st2.textContent=`
${Q} .ikc .fb svg.ic{width:62%;height:62%;filter:drop-shadow(0 3px 4px rgba(10,42,60,.28)) saturate(1.08)!important}
${Q} .ikc.ik-a .fb svg.ic,${Q} .ikc.ik-b .fb svg.ic{width:70%!important;height:70%!important;filter:none!important}
${Q} .ikc.ik-c .fb svg.ic{width:58%!important;height:58%!important;filter:none!important}
${Q} .ikc.ik-c .fb{background:color-mix(in srgb,var(--dom) 8%,#fff)!important;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--dom) 16%,#fff)!important}${Q} .ikc.ik-c .fb::after{display:none!important}`;document.head.appendChild(st2);
apply();
})();
