/* vilagos/keret.js — slice F1 (Alap + keret + készlet, mezo-n4wf5.1): the three things the owner decides before code.
   1 · #w-nap-indito                the opening animation — the owner's pick: one vessel, five drops (3 s, then the app; reduced motion = a still frame)
   2 · #w-<domain>-atmenet          the new frame around a page that has not been converted yet (the mixed look while F2–F7 run)
   3 · #w-<domain>-mindenoldal      "Minden oldal": the page map behind the header's grid button (the retired domain switcher's link)
   The frame parity itself (kalauz mark, tab marks, the Nap drop's day level, the floating quick-log button) lives in kit.js / foly.js.
   Loaded last. Prototype-only scaffolding is marked "proto"; nothing here is a kit primitive. */
(function(){
const F=window.F,K=window.K,Q='.phone.foly[data-s="elo"]';
if(!(window.FREG&&FREG.nap))return;
const DOMS=[['nap','Nap','#1877F2','#19C7C0'],['edzes','Edzés','#F2683A','#F7B23B'],['fuel','Fuel','#149E6E','#8FD14F'],['mezo','Mezo','#6B4FE0','#E06BB5'],['en','Én','#0E94B8','#46D3B3']];
const NAVC=['#1F6FEB','#F26A3D','#1E9E6A','#6D5BD0','#0E9AA7'];
const W=(c,o=1,cls='')=>`<svg class="sp-w ${cls}" viewBox="0 0 800 20" preserveAspectRatio="none" aria-hidden="true"><path fill="${c}" opacity="${o}" d="M0 10 Q25 0 50 10 T100 10 T150 10 T200 10 T250 10 T300 10 T350 10 T400 10 T450 10 T500 10 T550 10 T600 10 T650 10 T700 10 T750 10 T800 10 V20 H0Z"/></svg>`;

/* ═══ 1 · the opening animation ═══ */
/* Owner's choice (2026-10-09): "öt csepp, de az egy edénnyel együtt". One vessel fills with the five areas' liquids,
   then lets them go one by one: each layer leaves through the bottom as a drop and lands in its place in the bottom bar. */
const splash=()=>`<div class="sp sp-d"><div class="sp-ves"><div class="sp-stk">${DOMS.map(([k,l,c,c2],i)=>`<i style="--i:${i};--c1:${c2};--c2:${c};--lv:${(i+1)*17+4}%;z-index:${9-i}">${W(c2)}</i>`).join('')}</div><em></em></div><b class="sp-wm">boop</b>
  <nav class="fh-nav sp-bar" aria-hidden="true">${DOMS.map(([k,l],i)=>`<button tabindex="-1" class="${k==='nap'?'on':''}" style="--c:${NAVC[i]};--i:${i}"><span class="sp-dx"><span class="sp-dr">${F.csepp('ok',k==='nap'?86:[0,34,62,50,58][i],{s:k==='nap'?40:34,color:NAVC[i],alive:false})}</span></span><span class="sp-l">${l}</span></button>`).join('')}</nav></div>`;
function indito(){window.FH_NOFAB=true;let app='';try{app=FREG.nap.routes.mai('')}finally{window.FH_NOFAB=false}
  return `${app}${splash()}<div class="sp-ctl" data-proto><button data-go="indito" aria-label="Újra lejátszás">↻ Újra</button></div>`}
let spT=[];
function runSplash(){spT.forEach(clearTimeout);spT=[];const sp=document.querySelector('#phone .sp');if(!sp)return;
  spT.push(setTimeout(()=>sp.classList.add('out'),2400),setTimeout(()=>sp.classList.add('gone'),3000))}

/* ═══ 2 · the frame around a page that still wears the old look ═══ */
const HUB={nap:['Ma','mai'],edzes:['Edzés','mai'],fuel:['Fuel','mai'],mezo:['Mezo','fal'],en:['Én','en']};
function atmenet(arg){const d=K.D,dark=arg==='sotet',[t,r0]=HUB[d];
  return F.page(d,{title:t,sub:'Szerda, október 7.',tab:'mai'},`<iframe class="at-if" data-mode="${dark?'sotet':'vilagos'}" title="Még át nem öltöztetett oldal" src="elo/${d}.html#${r0}"></iframe>`,{pad:'0'})}
const CL={ertesites:'bell',beallitas:'gear',emberek:'people',tanyer:'plate',edzes:'dumbbell',nap:'sun',mezo:'orb',retegek:'layers',sport:'volley',fuel:'bowl',heti:'calendar',rend:'stack',meso:'trend',naplo:'journal',kiegeszito:'supps',trend:'trend',fazek:'pot',kristaly:'gem',memoar:'album',suly:'weight',cel:'target',level:'send'};
const AT_BASE=`.topbar,.tabbar,.aurora,.side,.notes,#panel,.panel{display:none!important}html,body{background:transparent!important}.stage{padding:0!important;gap:0!important}.phone{width:100vw!important;height:100vh!important;border-radius:0!important;box-shadow:none!important}`;
const AT_LIGHT=(c,c2)=>`:root{--page:transparent;--ink:#0A2A3C;--sub:#4E6B7A;--faint:#8AA0AC;--hair:rgba(10,42,60,.09);--protein:#E26B67;--carb:#D49245;--fat:#B8930F;--water:#4F93CF;--fiber:#5B9A3C;--sage:#4E9A6B;--lav:#7C6BC4;--gold:#D9952A;--coral:#E8603C;--rose:#D4637A;--sky:#4F93CF;--dom:${c};--dom2:${c2};--ic:${c};--ic2:${c2};--serif:'Bricolage Grotesque',var(--ff)}
.phone{background:transparent!important;color:var(--ink)!important}
.glass{background:#fff!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;box-shadow:0 14px 26px -18px color-mix(in srgb,var(--c) 45%,rgba(10,42,60,.55)),0 2px 4px -2px rgba(10,42,60,.06)!important;color:var(--ink)}
.glass::before,.glass::after{display:none!important}
svg.icon,.icon{filter:none!important}`;
function dressFrame(f){let doc;try{doc=f.contentDocument}catch(e){return}if(!doc||!doc.head||doc.getElementById('at-css'))return;
  const dark=f.dataset.mode==='sotet',[,,c,c2]=DOMS.find(x=>x[0]===K.D)||DOMS[0];
  const st=doc.createElement('style');st.id='at-css';st.textContent=AT_BASE+(dark?'':AT_LIGHT(c,c2));doc.head.appendChild(st);
  if(dark)return;
  /* the new icon family reaches every page at once (the sprite keeps its ids): show that here too */
  const lv=document.getElementById('tc-lv'),hx=document.getElementById('tc-hx'),sp=doc.querySelector('svg.sprite defs')||doc.querySelector('svg defs');
  if(sp&&lv&&hx&&!doc.getElementById('tc-lv')){sp.appendChild(doc.importNode(lv,true));sp.appendChild(doc.importNode(hx,true))}
  doc.querySelectorAll('symbol[id]').forEach(s=>{const id=s.id,k=id.startsWith('t-')?id.slice(2):id.startsWith('i-')?CL[id.slice(2)]:null;const g=k&&document.getElementById('tc-'+k);if(g){s.setAttribute('viewBox','0 0 64 64');s.innerHTML=g.innerHTML}})
  /* the readability pass F1 does with tokens, approximated: light text on a light ground becomes ink, small dark wells become white */
  const lum=c=>{const m=/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/.exec(c||'');return m?{l:(.299*m[1]+.587*m[2]+.114*m[3])/255,a:m[4]===undefined?1:+m[4]}:null};
  const darkGrad=g=>{const all=[...g.matchAll(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/g)].filter(m=>m[4]===undefined||+m[4]>.5);return all.length&&all.every(m=>(.299*m[1]+.587*m[2]+.114*m[3])/255<.3)};
  const onDark=e=>{for(let n=e;n&&n.nodeType===1;n=n.parentElement){const cs=doc.defaultView.getComputedStyle(n),b=lum(cs.backgroundColor);if(b&&b.a>.5)return b.l<.5;if(/gradient/.test(cs.backgroundImage)&&!n.dataset.atw)return /rgba?\((\d|[1-9]\d|1[0-4]\d), (\d|[1-9]\d|1[0-4]\d), /.test(cs.backgroundImage)&&!/255, 255, 255/.test(cs.backgroundImage)}return false};
  let busy=false;const pass=()=>{busy=false;doc.querySelectorAll('.phone *').forEach(e=>{if(e.dataset.atw||e.closest('svg'))return;const cs=doc.defaultView.getComputedStyle(e);
     if(/gradient/.test(cs.backgroundImage)&&darkGrad(cs.backgroundImage)&&e.offsetWidth<170){e.dataset.atw='1';e.style.setProperty('background','#fff','important');e.style.setProperty('box-shadow','inset 0 0 0 1.5px rgba(10,42,60,.1)','important')}});
    doc.querySelectorAll('.phone *').forEach(e=>{if(e.dataset.atc||e.closest('svg'))return;if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;const f=lum(doc.defaultView.getComputedStyle(e).color);if(!f||f.l<.72)return;e.dataset.atc='1';if(onDark(e))return;e.style.setProperty('color',f.a<.75||f.l<.9?'#4E6B7A':'#0A2A3C','important');e.style.setProperty('text-shadow','none','important')})};
  pass();new doc.defaultView.MutationObserver(()=>{if(busy)return;busy=true;doc.defaultView.requestAnimationFrame(pass)}).observe(doc.body,{childList:true,subtree:true})}
function runAtmenet(){const f=document.querySelector('#phone .at-if');if(!f)return;f.addEventListener('load',()=>dressFrame(f));let n=0;const t=setInterval(()=>{dressFrame(f);if(++n>20||!f.isConnected)clearInterval(t)},150)}

/* ═══ 3 · Minden oldal — the real page inventory of the app (app/pageIndex.ts grouped by navModel), in the new skeleton ═══ */
const MNO={"nap":{"Mai":[["Mai","A napod központja: mit csináltál, mi van hátra, hogy vagy."],["Napi küldetések","A mai apró feladatok és a jutalmuk."],["Check-in","Hogy vagy most — pár koppintás, fél perc."],["Gyors logolás","Egy mozdulattal rögzíthető dolgok rácsa."],["Életjel","A mai alapjeleid egy helyen."]],"A napom":[["A napom","A mai napod olvasata és a legjobb következő lépés."]],"Beszélgetés":[["Beszélgetés","Boop üzenetei és a válaszaid egy szálon."]],"Rutin":[["Rutin","A mai szokásaid: mit pipáltál ki, mi maradt."],["Rutinok szerkesztése","A szokás-láncaid: láncok, szokások, új szokás."],["Új rutin","Szokás-lánc összeállítása."],["Szokásaid","Minden szokásod egy listán."]],"Napzárás":[["Napzárás","Az esti zárókör: mit hoztál ma, mi jön holnap."]]},"train":{"Mai":[["Mai edzés","A mai nap edzésképe és az indítás."],["Edzés közben","A teljes képernyős edzésmód. Csak futó edzés közben nyílik meg."],["Sport","A nem-súlyzós mozgásaid."],["Sport rögzítése","Egy sportmozgás felvitele lépésről lépésre."],["Saját edzés","Egyedi edzés összeállítása terv nélkül."]],"Terhelés":[["Terhelés","A heti terhelésed izmonként."],["Izomtérkép","A terhelés testre rajzolva."],["Minden mozgásod","A hét összes mozgása egy listán."],["Minden izomjel","Amit az izmaid jeleznek — fáradás, elmaradás, túlterhelés."]],"Terv":[["Futás","A futásaid és a futóterved."],["Terv","A futó edzésterved áttekintése."],["Új edzésterv","Tervkészítő varázsló, lépésről lépésre."],["Edzéstervek","Minden terved egy könyvtárban."],["Lezárt futamaid","A befejezett tervek és az eredményük."],["Két futam összevetése","Két lezárt terv egymás mellett."],["Sablonjaid","A mentett edzés-sablonjaid."]],"Gyakorlatok":[["Gyakorlatok","A teljes gyakorlat-katalógus."],["Medálok","Az edzésben szerzett elismeréseid."]]},"fuel":{"Mai":[["Mai","A mai napod tápértéke és étkezései."],["Étel rögzítése","Új étkezés felvitele."],["Hogy tanultam?","Hétről hétre, mennyit égetsz — és melyik napod számít bele."]],"Trendek":[["Trendek","Hogyan alakult az étkezésed hetek alatt."]],"Konyha":[["Konyha","A receptek, a kamra és a műhely bejárata."],["Receptek","A recept-könyvtárad."],["Új recept","Recept felvitele kézzel."],["Receptműhely","Recept építése segítséggel, alapanyagokból."],["Kamra","Ami itthon van — a polcod."]],"Kiegészítők":[["Kiegészítők","A kiegészítőid és a mai adagjaid."],["Protokoll","Mit mikor és mihez veszel be."],["Új kiegészítő","Termék felvitele és az adagja beállítása."],["Gyógyszer","A gyógyszereid külön nyilvántartva."]]},"mezo":{"Rólad":[["Rólad","a közös kép rólad — itt döntesz a javaslatokról."],["Életesemények","a nagy fordulatok idővonala, amikhez a csapat igazodik."],["Karakter","Amit Boop rólad összerakott — a dosszié."],["Dimenziók","A karaktered tengelyei egyenként."],["Tudástár","a teljes tény-lista, kategóriák."]],"Üzenőfal":[["Üzenőfal","Az öt karakter posztjai: mit vettek észre, és mit kérdeznek tőled."],["A csapat beszél","A csapat élő beszélgetése: ma ki szólt, mi vár rád, és mi rendeződött."],["Minták","Az ismétlődő összefüggések a napjaidban."],["Előrejelzések","Mire számíthatsz a jelenlegi irány mellett."],["Karakter-napló","Mikor és mitől változott a képed."],["Chat","Szabad beszélgetés Booppal."],["N=1 kísérletek","Saját kísérletek magadon, mérhető végponttal."],["Proaktív coaching","Mit javasol magától, és miért."],["Megfigyelő","Minden szabály döntése egy napra lebontva."],["A napi kártya","A mai javaslat — és amit legyőzött."]],"A csapat":[["A csapat","Az öt karakter szobája: mit figyelnek most, és mennyit tudnak rólad."],["Konzílium","A csapat együtt beszéli meg az ügyedet."],["Gépterem","Ami a motorháztető alatt történik."],["Összes funkció","A régi teljes menü — minden Boop-eszköz a saját nevén."],["Futások","Az elemzési körök naplója."],["Adatforrások","Miből dolgozik az elemzés."],["Detektorok","A szabályok, amik a jeleket keresik."],["Memória","Mire emlékszik rólad, rétegenként."],["Kérdezd a csapatot","Diagnózis: a csapat utánanéz, miért vagy fáradt, miért alszol rosszul, miért mozog a súlyod."]],"Emlékek":[["Emlékek","Napi emlékek, heti memoár és hasonló napok keresése."],["Memoár","A heted története, megírva."],["Memoár-archívum","A korábbi fejezetek polca."]]},"me":{"Hol tartok":[["Hol tartok","Hol tartasz: a heted, az életvonalad és a céljaid."],["A heted","A hét pontszáma és a négy részletnézet."],["Heti elemzés","Mi történt a héten, napról napra."],["A hét napjai","A hét hét napja mozaikban."],["A hét tanulságai","Amit érdemes megjegyezni a hétből."],["Heti felfedezések","Az e héten talált új összefüggések."],["Fejlődés","A hosszú távú ívek egy helyen."],["Skillek","Amiben fejlődsz, szintekkel."],["Tevékenységek","Küldetések és tevékenységek az elmúlt 30 napból."],["Kitüntetések","Amit eddig kiérdemeltél."],["Emberek","Akik számítanak — a köröd."],["A köröm","A közeli embereid és a kapcsolat állapota."],["Jelöltek","Akiket Boop javasol felvenni a körödbe."],["Említések","Kit mikor említettél."],["Heti kép","A kapcsolataid heti pillanatképe."],["Értesítések","Minden értesítésed egy helyen."]],"Test":[["Súly","A súlyod alakulása és a naplózás."],["Alvás","Az alvásod hossza és minősége."],["Éjszakai mód","Sötét, teljes képernyős felület lefekvéshez."]],"Napló":[["Napló","Amit leírsz magadról — döntések, gondolatok."]],"Célok":[["Célok","A futó és lezárt céljaid."],["Új cél","Célkitűzés varázsló, öt lépésben."],["Jelek","Mi mozdítja a céljaidat — a jelzőszámok."],["A célod ma","A súlycélod mai állása."],["Új súlycél","Súlycél tervezése."],["Mai étrendi keret","Mennyit ehetsz ma a célod szerint."],["Aktuális szakasz","A célod jelenlegi szakasza és a tempó."],["Tervkapcsolatok","Hogyan kapcsolódik a célod az edzés- és étrendtervhez."],["Védőkorlátok","A határok, amiket a cél nem léphet át."]]},"settings":{"":[["Beállítások","Minden terület és a fiókod egy helyen."],["Fuel beállítások","Táplálkozási célok, makrók és ritmus."],["Étkezési ablakok","A három naptípus étkezési sablonjai."],["Edzés beállításai","A rendszeres mozgás időpontjai."],["Gym időpontok","Heti edzőtermi rend."],["Sport időpontok","Sportágak és rendszeres alkalmak."],["Személyes alapadatok","Testadatok, súlycél és alvás."],["Testprofil","Mért testadatok és aktivitás."],["Alváscél","Alvásidő és napi horgony."],["Súlycél beállításai","Célsúly és tempó, számított céldátummal."],["Mezo beállításai","Személyes háttér és kommunikáció."],["Rólam","Saját bemutatkozás és javítható források."],["Így beszélj velem","Saját instrukció és tanult profil."],["Személyes prompt","A ténylegesen összeállított személyes blokkok."],["Napi ritmus","Megosztott alvás- és étkezési horgonyok."],["Megjelenés és alkalmazás","Téma, fiók, kalauz és tulajdonosi funkciók."],["Értesítés-beállítások","Kategóriák, időpontok és csendes órák."],["Fiókadatok","A neved és az e-mail-címed javítása."]]}};
const MD=[['nap','Nap','nap','t-sun'],['train','Edzés','edzes','t-dumbbell'],['fuel','Fuel','fuel','t-bowl'],['mezo','Mezo','mezo','t-orb'],['me','Én','en','t-people']];
const total=Object.values(MNO).reduce((n,g)=>n+Object.values(g).reduce((m,p)=>m+p.length,0),0);
function mindenoldal(){const d=K.D,cur=MD.find(x=>x[2]===d)||MD[0];
  const dom=([id,name,pd,ic],i)=>{const g=MNO[id],n=Object.values(g).reduce((m,p)=>m+p.length,0),[, ,c,c2]=DOMS.find(x=>x[0]===pd);
    return F.sec(i+1,name)+F.card(`<div class="mn" style="--dom:${c};--dom2:${c2};--liq1:${c2};--liq2:${c}">${Object.entries(g).map(([h,ps])=>`<h3>${h}<small>${ps.length}</small></h3>${ps.map(([l,hint])=>F.row({title:l,sub:hint,on:{toast:l}})).join('')}`).join('')}</div>`)};
  return F.page(d,{title:'Minden oldal',sub:'Az app térképe',back:'mai',nohelp:true},
   F.hero({lbl:'Leltár',verdict:`Az app ${total} oldala, területenként.`,sub:'Ugyanabban a bontásban, ahogy a felső fülek mutatják. Ha valamit nem találsz a menüben, itt megvan.',
     body:`<div class="mn-dr">${MD.map(([id,name,pd],i)=>{const n=Object.values(MNO[id]).reduce((m,p)=>m+p.length,0);return `<button data-mnjump="${i}" style="--c:${NAVC[i]}">${F.csepp('ok',Math.round(n/26*100),{s:38,color:NAVC[i],alive:false})}<b>${n}</b><small>${name}</small></button>`}).join('')}</div>`})
   +MD.map(dom).join('')
   +F.sec(6,'Beállítások')+F.card(`<div class="mn">${MNO.settings[''].map(([l,hint])=>F.row({title:l,sub:hint,on:{toast:l}})).join('')}</div>`),{nofab:true})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-mnjump]');if(!b)return;const s=document.querySelectorAll('#phone .fh-n')[+b.dataset.mnjump];if(s)s.scrollIntoView({block:'start',behavior:'smooth'})});

/* register on every domain; chain the domain's own after-hook */
['nap','edzes','fuel','mezo','en'].forEach(d=>{const r=FREG[d];if(!r)return;r.routes.atmenet=atmenet;r.routes.mindenoldal=mindenoldal;const a0=r.after;r.after=(route,arg)=>{if(a0)a0(route,arg);if(route==='atmenet')runAtmenet();if(route==='indito')runSplash()}});
FREG.nap.routes.indito=indito;

F.css(`
@property --spy{syntax:'<percentage>';inherits:true;initial-value:0%}
/* splash: the base rules are the FINAL frame (what reduced motion shows); motion only adds the way there */
.sp{position:absolute;inset:0;z-index:90;overflow:hidden;container-type:size;background:linear-gradient(180deg,#FBFDFE,#E6F0F6);--liq1:#19C7C0;--liq2:#1877F2;--ink:#0A2A3C}
.sp.out{pointer-events:none}.sp.gone{display:none}
.sp-wm{position:absolute;left:0;right:0;top:41%;text-align:center;font:800 68px/1 'Bricolage Grotesque',var(--ff);letter-spacing:-3.4px;color:var(--ink)}
.sp-w{position:absolute;left:0;bottom:calc(100% - 1px);width:200%;height:18px}.sp-w.b{height:26px}
.sp-ctl{position:absolute;z-index:95;left:50%;top:12px;transform:translateX(-50%);display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,.92);box-shadow:0 0 0 1.5px rgba(10,42,60,.18),0 10px 20px -12px rgba(10,42,60,.5);white-space:nowrap}
.sp-ctl button{padding:6px 10px;border-radius:999px;font:700 11.5px/1 var(--ff);color:#4E6B7A}.sp-ctl button.on{color:#fff;background:#0A2A3C}
.sp-dx,.sp-dr{display:block}.sp-dr{transform-origin:50% 100%}
.sp-d{--dy:calc(-79cqh + 300px);--sw:calc((100cqw - 32px) / 5)}
.sp-ves{position:absolute;z-index:40;left:50%;top:21%;width:150px;height:250px;margin-left:-75px;border-radius:75px;overflow:hidden;isolation:isolate;background:linear-gradient(180deg,#fff,#F4FAFC);box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),inset 0 10px 22px -12px rgba(10,42,60,.14),0 34px 50px -30px rgba(24,119,242,.55)}
.sp-stk{position:absolute;inset:0}
.sp-stk>i{position:absolute;left:0;right:0;bottom:0;height:var(--lv);background:linear-gradient(180deg,var(--c1),var(--c2)) top/100% 46px no-repeat,var(--c2)}
.sp-ves .sp-w{height:9px;width:400%}
.sp-ves>em{position:absolute;z-index:12;left:22px;top:26px;width:16px;height:64px;border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,0))}
.sp-d .sp-wm{top:57%;font-size:56px;letter-spacing:-2.8px}
@media (prefers-reduced-motion:no-preference){
 body:not(.still) .sp.out{opacity:0;transition:opacity .6s ease}
 body:not(.still) .sp-w{animation:spw 3.2s linear infinite}
 body:not(.still) .sp-ves{animation:spin .4s ease both}
 body:not(.still) .sp-d .sp-wm{animation:spin .45s ease both .15s}
 body:not(.still) .sp-stk>i{animation:sprise .42s cubic-bezier(.2,.8,.2,1) both calc(.12s + var(--i)*.13s)}
 body:not(.still) .sp-stk{animation:spdrain .9s linear both 1.08s}
 body:not(.still) .sp-dx{animation:spdx .56s cubic-bezier(.2,.6,.4,1) both calc(1.08s + var(--i)*.17s)}
 body:not(.still) .sp-dr{animation:spdrop .56s both calc(1.08s + var(--i)*.17s)}
 body:not(.still) .sp-bar .sp-l{animation:spin0 .3s ease both calc(1.6s + var(--i)*.17s)}
 body:not(.still) .sp-bar{animation:spbar .4s ease both 2s}
}
@keyframes spw{to{transform:translateX(-12.5%)}}
@keyframes spin{from{opacity:0;transform:translateY(8px)}}
@keyframes spin0{from{opacity:0}}
@keyframes spbar{from{background-color:transparent;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}}
@keyframes sprise{from{transform:translateY(102%)}}
@keyframes spdrain{to{transform:translateY(96%)}}
@keyframes spdx{from{transform:translateX(calc((2 - var(--i)) * var(--sw)))}}
@keyframes spdrop{0%{transform:translateY(var(--dy)) scale(.8,1.25);animation-timing-function:cubic-bezier(.55,0,.9,.55)}66%{transform:translateY(0) scale(1.22,.72);animation-timing-function:cubic-bezier(.2,.7,.3,1)}84%{transform:translateY(-6px) scale(.95,1.07);animation-timing-function:ease-in}100%{transform:none}}
/* átmenet */
${Q} .scroll:has(.at-if){display:flex;flex-direction:column;overflow:hidden;padding-bottom:0!important}
.phone .at-if{position:static;flex:1;min-height:0;width:100%;height:auto;border:0;background:transparent}
.phone .at-if[data-mode="sotet"]{background:#191614}
/* minden oldal */
.mn h3{display:flex;align-items:baseline;gap:8px;margin:18px 0 8px;font:800 13px/1 var(--disp,inherit);letter-spacing:.2px;color:color-mix(in srgb,var(--dom) 80%,var(--ink))}.mn h3:first-child{margin-top:0}
.mn h3 small{font:600 11px/1 var(--ff);color:var(--faint)}
.mn h3+.fh-row{border-top:0;padding-top:0}
.mn-dr{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:16px}
.mn-dr button{display:grid;justify-items:center;gap:2px;text-align:center}.mn-dr .csepp .body{filter:none}
.mn-dr b{font:800 15px/1 var(--disp,inherit);color:var(--ink);margin-top:4px}.mn-dr small{font-size:10.5px;font-weight:600;color:var(--sub)}
`);

/* owner-facing notes for the slice (prepended to every domain's panel while F1 is open) */
const N1=`<h2>F1 · most ezt nézd meg</h2>
<p><b>1 · Megnyitó animáció</b> — az edény megtelik az öt terület színével, aztán egyenként elengedi őket: öt csepp esik a helyére az alsó sávba. <a href="#w-nap-indito">Lejátszás</a></p>
<p><b>2 · A fejléc</b> — fent a dátum és öt gomb: Minden oldal, Mezo üzenetei, értesítések, beállítások, a napi gömb. Alatta a cím, mellette a kalauz „?”. Nézd meg <a href="#w-nap-mai">a Napon</a>, <a href="#w-fuel-stack">egy hosszú című oldalon</a> és <a href="#w-fuel-meal.ebed">egy aloldalon</a>. A Mezo üzenetei gomb a <a href="#w-nap-uzenetek">Beszélgetésre</a> visz, a gömb <a href="#w-nap-napom">A napomra</a>.</p>
<p><b>3 · Átmeneti kinézet</b> (világosra hangolva, ahogy kérted): <a href="#w-nap-atmenet">Nap</a> · <a href="#w-edzes-atmenet">Edzés</a> · <a href="#w-fuel-atmenet">Fuel</a> · <a href="#w-mezo-atmenet">Mezo</a> · <a href="#w-en-atmenet">Én</a></p>`;
window.FNOTES_FOLY=N1+(window.FNOTES_FOLY||'');
})();
