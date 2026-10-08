/* csepp/feher.js — "Világos klinikai": light-only, structure-first direction (owner 2026-10-08:
   "összefolyik, nem értem mit hol látok, hova kéne nézni, hol keresni; a színvilág és a dark mode sem tetszik").
   Every screen has the same skeleton: title + search → top tabs → 1 állapot (hero) → 2 most következik →
   3 mai számok → 4 napló. The five domains are always visible in the bottom bar. */
(function(){
const {I,csepp,mchp,muscleColor,css}=K;
const DOM=[['nap','Nap','i-sun','#1F6FEB'],['edzes','Edzés','i-dumb','#E2553F'],['fuel','Fuel','i-bowl','#1E9E6A'],['mezo','Mezo','i-chat','#6D5BD0'],['en','Én','i-heart','#0E9AA7']];
const SEARCH=`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`;

css(`
.phone[data-v="feher"]{--page:#F2F5F9;--card:#FFFFFF;--card2:#F2F5F9;--hair:rgba(15,30,51,.10);--ink:#0F1E33;--sub:#52627A;--faint:#8A97AB;
  --acc:#1F6FEB;--acc-ink:#FFFFFF;--ok:#1E9E6A;--warn:#C98A12;--bad:#D4483B;--info:#1F6FEB;--protein:#D9605A;--carb:#D99A2B;--fat:#7C8F2A;
  --disp:var(--ff);--dispw:700;--dispt:-.5px;--r:16px;--dom:#1F6FEB;
  box-shadow:0 40px 90px -30px rgba(15,30,51,.35),0 0 0 10px #FFFFFF,0 0 0 11px rgba(15,30,51,.12)}
.phone[data-v="feher"][data-d="edzes"]{--dom:#E2553F}.phone[data-v="feher"][data-d="fuel"]{--dom:#1E9E6A}
.phone[data-v="feher"][data-d="mezo"]{--dom:#6D5BD0}.phone[data-v="feher"][data-d="en"]{--dom:#0E9AA7}
.phone[data-v="feher"] .scroll{background:var(--page);padding-bottom:96px}
/* 1 · title bar: where am I + search */
.fh-top{position:sticky;top:0;z-index:20;background:#fff;padding:14px 16px 0;border-bottom:1px solid var(--hair)}
.fh-trow{display:flex;align-items:center;gap:8px}
.fh-title{flex:1;min-width:0}
.fh-title small{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--sub)}
.fh-title small i{width:8px;height:8px;border-radius:50%;background:var(--dom)}
.fh-title h1{font-size:28px;font-weight:700;letter-spacing:-.8px;line-height:1.1;margin-top:2px}
.fh-ib{position:relative;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:var(--ink);background:var(--page);flex:0 0 auto}
.fh-ib svg.ic{width:20px;height:20px}
.fh-ib b{position:absolute;top:-3px;right:-3px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;display:grid;place-items:center;font-size:10px;font-weight:700;color:#fff;background:var(--bad);box-shadow:0 0 0 2px #fff}
/* 2 · top tabs: the domain's pages */
.fh-tabs{display:flex;gap:4px;margin:12px -4px 0;overflow-x:auto;scrollbar-width:none}
.fh-tabs button{padding:9px 12px 11px;font-size:14px;font-weight:500;color:var(--sub);white-space:nowrap;border-bottom:3px solid transparent}
.fh-tabs button.on{color:var(--ink);font-weight:650;border-bottom-color:var(--dom)}
/* cards: every section is its own white card with a header */
.fh-card{background:#fff;border:1px solid var(--hair);border-radius:18px;margin:12px 14px 0;padding:16px;box-shadow:0 1px 2px rgba(15,30,51,.04)}
.fh-h{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.fh-h .tile{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;color:var(--acc);background:color-mix(in srgb,var(--acc) 10%,#fff);flex:0 0 auto}
.fh-h .tile svg.ic{width:18px;height:18px;stroke-width:1.9}
.fh-h h2{flex:1;font-size:16px;font-weight:650;letter-spacing:-.2px}
.fh-h a,.fh-h button{font-size:13px;font-weight:550;color:var(--acc);text-decoration:none}
.fh-n{font-size:11px;font-weight:650;color:var(--sub);letter-spacing:.6px;text-transform:uppercase;margin:20px 16px -2px}
/* hero: the one thing to look at */
.fh-hero{background:linear-gradient(180deg,#EAF2FF,#FFFFFF 78%);border-color:color-mix(in srgb,var(--acc) 28%,transparent)}
.fh-hero.warn{background:linear-gradient(180deg,#FFF4DC,#FFFFFF 78%);border-color:color-mix(in srgb,var(--warn) 40%,transparent)}
.fh-hrow{display:flex;gap:16px;align-items:center}
.fh-hero .lbl{font-size:11px;font-weight:650;letter-spacing:.6px;text-transform:uppercase;color:var(--acc)}
.fh-hero.warn .lbl{color:var(--warn)}
.fh-hero .verdict{font-size:20px;font-weight:700;letter-spacing:-.4px;line-height:1.2;margin:4px 0 6px;text-wrap:balance}
.fh-hero .sub{font-size:13.5px;line-height:1.45;color:var(--sub)}
.fh-acts{display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap}
.phone[data-v="feher"] .btn{border-radius:12px;padding:12px 18px;font-size:15px}
.phone[data-v="feher"] .btn.sm{padding:9px 14px;font-size:13.5px;border-radius:10px;font-weight:600}
.phone[data-v="feher"] .btn.ghost{background:#fff;border:1px solid var(--hair);color:var(--ink)}
.fh-lk{font-size:13.5px;font-weight:550;color:var(--acc)}
/* steps: what comes next, in order */
.fh-step{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--hair)}
.fh-step:first-of-type{border-top:0;padding-top:0}.fh-step:last-of-type{padding-bottom:0}
.fh-step time{width:46px;flex:0 0 auto;font-size:13px;font-weight:650;font-variant-numeric:tabular-nums;color:var(--ink)}
.fh-step .g{flex:1;min-width:0}
.fh-step strong{display:block;font-size:14.5px;font-weight:600}
.fh-step small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px;line-height:1.35}
.fh-step.now time{color:var(--acc)}
.fh-step .chev{width:18px;height:18px;color:var(--faint)}
/* stat tiles: today's numbers, same anatomy every time */
.fh-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fh-stat{display:block;text-align:left;padding:12px;border-radius:14px;border:1px solid var(--hair);background:#fff}
.fh-stat .k{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--sub)}
.fh-stat .k svg.ic{width:15px;height:15px}
.fh-stat .n{font-size:24px;font-weight:700;letter-spacing:-.6px;font-variant-numeric:tabular-nums;margin-top:6px;line-height:1.1}
.fh-stat .n small{font-size:12.5px;font-weight:500;color:var(--sub);letter-spacing:0;margin-left:3px}
.fh-stat .bar{margin:8px 0 6px;height:6px;border-radius:3px}
.fh-stat .bar b{border-radius:3px}
.fh-stat .s{font-size:12px;color:var(--sub)}
.fh-stat .s.ok{color:var(--ok);font-weight:600}.fh-stat .s.warn{color:var(--warn);font-weight:600}
.fh-facts{display:grid;grid-template-columns:repeat(3,1fr);margin:12px 0 4px;border:1px solid var(--hair);border-radius:12px;background:#fff}
.fh-facts div{padding:10px 8px;text-align:center;border-left:1px solid var(--hair)}.fh-facts div:first-child{border-left:0}
.fh-facts b{display:block;font-size:18px;font-weight:700;letter-spacing:-.3px;font-variant-numeric:tabular-nums}
.fh-facts small{font-size:11.5px;color:var(--sub)}
.fh-mus{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--hair)}
.fh-mus:first-of-type{border-top:0}
.fh-mus .l{flex:1;font-size:14px;font-weight:500}
.fh-mus .v{font-size:12.5px;color:var(--sub);font-variant-numeric:tabular-nums}
.fh-mus .bar{width:88px;height:6px;border-radius:3px}
.fh-why{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center;margin-top:12px;font-size:13.5px}
.fh-why .bar{grid-column:1/-1;height:6px;border-radius:3px;margin-bottom:4px}
.fh-why .v{font-weight:650;font-variant-numeric:tabular-nums}
.fh-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fh-pair button{display:flex;flex-direction:column;gap:8px;padding:14px 12px;border-radius:14px;border:1px solid var(--hair);background:#fff;font-size:14px;font-weight:600}
.fh-pair button svg.ic{color:var(--acc)}
.fh-note{font-size:12px;color:var(--faint);line-height:1.45;margin-top:10px}
.fh-txt{font-size:14.5px;line-height:1.5}
.phone[data-v="feher"] .ds{padding:12px 14px 0;gap:6px}
.phone[data-v="feher"] .ds button{background:#fff;border:1px solid var(--hair);border-radius:12px;padding:8px 0 7px}
.phone[data-v="feher"] .ds b{font-family:var(--ff);font-size:15px;font-weight:650}
.phone[data-v="feher"] .ds small{font-family:var(--ff);font-size:10px;font-weight:600}
.phone[data-v="feher"] .ds button.on{background:var(--ink);border-color:var(--ink)}
.phone[data-v="feher"] .ds button.on b,.phone[data-v="feher"] .ds button.on small,.phone[data-v="feher"] .ds button.on i{color:#fff}
.phone[data-v="feher"] .ds button.rest{opacity:.5}
.phone[data-v="feher"] .st{font-family:var(--ff);font-size:11px;font-weight:650;letter-spacing:.2px;text-transform:none;padding:4px 9px;border-radius:999px}
.phone[data-v="feher"] .st.q{color:var(--sub);background:var(--page)}
.phone[data-v="feher"] .mchp{background:radial-gradient(circle at 35% 28%,#fff,color-mix(in srgb,var(--c) 20%,#EEF2F7));box-shadow:inset 0 0 0 1px var(--hair)}
.phone[data-v="feher"] .csepp .shell{fill:color-mix(in srgb,var(--c) 10%,#fff);stroke:color-mix(in srgb,var(--c) 55%,rgba(15,30,51,.15))}
.phone[data-v="feher"] .csepp .val{color:var(--ink)}
.phone[data-v="feher"] .csepp .val b{text-shadow:0 0 10px rgba(255,255,255,.9),0 0 3px rgba(255,255,255,.9)}
.phone[data-v="feher"] .csepp .val small{opacity:.7}
.phone[data-v="feher"] .csepp .liq{opacity:.55}
.phone[data-v="feher"] .csepp .body{filter:drop-shadow(0 8px 14px color-mix(in srgb,var(--c) 35%,transparent))}
.fh-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.fh-chips span{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;border-radius:999px;border:1px solid var(--hair);background:#fff;font-size:12px;font-weight:550}
.fh-chips .mchp{width:22px;height:22px}
/* bottom bar: the five domains, always visible */
.fh-nav{position:absolute;left:0;right:0;bottom:0;z-index:30;display:flex;padding:6px 6px calc(8px + env(safe-area-inset-bottom,0px));background:#fff;border-top:1px solid var(--hair)}
.fh-nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 0 5px;border-radius:12px;font-size:11px;font-weight:550;color:var(--faint)}
.fh-nav button svg.ic{width:23px;height:23px}
.fh-nav button.on{color:var(--c);font-weight:700;background:color-mix(in srgb,var(--c) 9%,#fff)}
.phone[data-v="feher"] .toast{bottom:92px}
`);

const top=(title,sub,tabs)=>`<header class="fh-top"><div class="fh-trow"><div class="fh-title"><small><i></i>${sub}</small><h1>${title}</h1></div>
  <button class="fh-ib" data-toast="Keresés az egész appban: étel, edzés, bejegyzés, beállítás" aria-label="Keresés">${SEARCH}</button>
  <button class="fh-ib" data-toast="Értesítések" aria-label="Értesítések">${I('i-bell')}<b>3</b></button>
  <button class="fh-ib" data-toast="Beállítások és profil" aria-label="Beállítások">${I('i-gear')}</button></div>
  <nav class="fh-tabs">${tabs.map((t,i)=>`<button class="${i===0?'on':''}" data-toast="${t}">${t}</button>`).join('')}</nav></header>`;
const nav=d=>`<nav class="fh-nav">${DOM.map(([k,l,ic,c])=>`<button class="${k===d?'on':''}" style="--c:${c}" data-dom="${k}">${I(ic)}<span>${l}</span></button>`).join('')}</nav>`;
const head=(ic,t,link='')=>`<div class="fh-h"><span class="tile">${I(ic)}</span><h2>${t}</h2>${link?`<a href="#" data-toast="${link}">${link} ›</a>`:''}</div>`;
const wrap=(inner,d)=>`<div class="scroll">${inner}</div>${nav(d)}<div class="toast" id="toast"></div>`;

function nap(){return wrap(`${top('Ma','Nap · szerda, október 7.',['Mai','A napom','Beszélgetés','Rutin'])}
  <section class="fh-card fh-hero rise"><div class="fh-hrow">${csepp('ok',57,{s:104,val:72,label:'MA'})}
    <div style="flex:1;min-width:0"><span class="lbl">Mai állapot</span><p class="verdict">Ma jó nap egy közepes edzéshez.</p><p class="sub">Nyugodt ébredés, 7 ó 40 p alvás. A hét jeledből négy megvan.</p></div></div>
    <div class="fh-acts"><button class="btn" data-toast="Délutáni check-in">Délutáni check-in</button><button class="fh-lk" data-toast="Életjelek · miből áll össze a 72">Miből áll össze?</button></div></section>
  <p class="fh-n rise" style="--i:1">1 · Most következik</p>
  <section class="fh-card rise" style="--i:1">
    <div class="fh-step now"><time>14:00</time><span class="g"><strong>Délutáni check-in</strong><small>8 koppintás, kb. fél perc</small></span><button class="btn sm" data-toast="Check-in">Kitöltöm</button></div>
    <div class="fh-step"><time>18:00</time><span class="g"><strong>Röpi edzés · BVSC</strong><small>90 perc · feladó</small></span><button class="btn sm ghost" data-dom="edzes">Megnézem</button></div>
    <div class="fh-step"><time>19:30</time><span class="g"><strong>Vacsora</strong><small>1 040 kcal van még · 72 g fehérje hiányzik</small></span><button class="btn sm ghost" data-toast="Fuel · Logolás">Logolom</button></div></section>
  <p class="fh-n rise" style="--i:2">2 · Mai számok</p>
  <section class="fh-card rise" style="--i:2"><div class="fh-grid">
    <button class="fh-stat" data-toast="Fuel · Mai"><span class="k">${I('i-flame')}Kalória</span><div class="n">2 060<small>/ 3 100</small></div><div class="bar" style="--c:var(--acc)"><b style="--w:66%"></b></div><span class="s">1 040 kcal van még</span></button>
    <button class="fh-stat" data-toast="Fuel · Fehérje"><span class="k">${I('i-bowl')}Fehérje</span><div class="n">148<small>/ 220 g</small></div><div class="bar" style="--c:var(--protein)"><b style="--w:67%"></b></div><span class="s">72 g hiányzik</span></button>
    <button class="fh-stat" data-toast="Én · Alvás"><span class="k">${I('i-bed')}Alvás</span><div class="n">7 ó 40<small>perc</small></div><div class="bar" style="--c:var(--ok)"><b style="--w:92%"></b></div><span class="s ok">a heti átlagod fölött</span></button>
    <button class="fh-stat" data-dom="edzes"><span class="k">${I('i-dumb')}Mozgás</span><div class="n">0<small>/ 2 alkalom</small></div><div class="bar" style="--c:var(--warn)"><b style="--w:4%"></b></div><span class="s warn">Pull Day még hátravan</span></button>
  </div></section>
  <p class="fh-n rise" style="--i:3">3 · Észrevétel</p>
  <section class="fh-card rise" style="--i:3">${head('i-chat','Anna és az alvásod','Összes')}
    <p class="fh-txt">Amikor <b>Anna</b> szerepel a hála-naplódban, másnap átlag <b>40 perccel többet</b> alszol. Négy nap adata, ez még kevés. Figyeljem tovább?</p>
    <div class="fh-acts"><button class="btn sm" data-toast="Megjegyeztem: figyelem tovább">Igen, figyeld</button><button class="btn sm ghost" data-toast="Megjegyeztem">Nem stimmel</button><button class="fh-lk" data-toast="Miből látom?">Miből látod?</button></div></section>
  <p class="fh-n rise" style="--i:4">4 · Mai napló</p>
  <section class="fh-card rise" style="--i:4">
    <div class="fh-step"><time>13:00</time><span class="g"><strong>Ebéd</strong><small>Csirke · édesburgonya · spenót · 760 kcal</small></span>${I('i-chev','chev')}</div>
    <div class="fh-step"><time>09:15</time><span class="g"><strong>Reggeli</strong><small>Túrós zabkása áfonyával · 420 kcal</small></span>${I('i-chev','chev')}</div>
    <div class="fh-step"><time>07:10</time><span class="g"><strong>Reggeli check-in</strong><small>Nyugodt ébredés, pihenve</small></span>${I('i-chev','chev')}</div>
    <div class="fh-acts"><button class="btn sm ghost" data-toast="Gyors logolás">+ Új bejegyzés</button></div></section>`,'nap')}

function edzes(){
  const D=[['H',21,'ok'],['K',22,'ok'],['Sze',23,'–'],['Cs',24,'ma','on'],['P',25,'•'],['Szo',26,'pihenő','rest'],['V',27,'pihenő','rest']];
  const MUS=[['back-wide','Hát (széles)',6,0],['back-mid','Hát (közép)',4,3],['shoulder-rear','Váll (hátsó)',3,0],['biceps-brachialis','Kar',3,0]];
  const LBL={'back-wide':'Hát','back-mid':'Hát közép','shoulder-rear':'Hátsó váll','biceps-brachialis':'Kar','traps':'Trapéz'};
  return wrap(`${top('Edzés','Hypertrophy 04 · 3. hét / 6',['Mai','Terv','Terhelés','Gyakorlatok'])}
  <section class="ds rise">${D.map(([l,n,m,k])=>`<button class="${k||''}" data-toast="${l} · ${n}."><small>${l}</small><b>${n}</b><i class="${m==='ok'?'ok':''}">${m==='ok'?I('i-check'):m}</i></button>`).join('')}</section>
  <section class="fh-card fh-hero rise" style="--i:1"><span class="lbl">Mai edzés · 07:30 · Gym</span><p class="verdict" style="font-size:26px">Pull Day</p>
    <div class="fh-facts"><div><b>5</b><small>gyakorlat</small></div><div><b>16</b><small>szett</small></div><div><b>~78</b><small>perc</small></div></div>
    <div class="fh-chips">${Object.keys(LBL).map(k=>`<span>${mchp(k,'sm')}${LBL[k]}</span>`).join('')}</div>
    <div class="fh-acts"><button class="btn" style="flex:1" data-toast="Eligazítás, majd indul az edzés">Edzés indítása</button><button class="fh-lk" data-toast="Kihagyom · megadhatod, miért">Kihagyom</button></div></section>
  <p class="fh-n rise" style="--i:2">1 · Mielőtt elkezded</p>
  <section class="fh-card fh-hero warn rise" style="--i:2"><div class="fh-hrow" style="gap:12px">${csepp('warn',57,{s:60,val:48})}
    <div style="flex:1;min-width:0"><span class="lbl">A reggeli check-inből</span><p class="verdict" style="font-size:18px;margin-bottom:2px">Könnyebb nap javasolt</p><p class="sub">A jobb vállad fáj. A Rear Delt Fly-t könnyebb súllyal, vagy hagyd ki.</p></div></div>
    <div class="fh-why"><span>Kipihentség</span><span class="v">4 / 10</span><div class="bar" style="--c:var(--warn)"><b style="--w:40%"></b></div>
      <span>Izomláz</span><span class="v">7 / 10</span><div class="bar" style="--c:var(--bad)"><b style="--w:70%"></b></div></div>
    <div class="fh-acts"><button class="btn sm" data-toast="Könnyítve: a múlt heti súly marad">Könnyítsük</button><button class="btn sm ghost" data-toast="Marad a terv">Maradjon a terv</button></div></section>
  <p class="fh-n rise" style="--i:3">2 · Ma még</p>
  <section class="fh-card rise" style="--i:3">
    <div class="fh-step"><time>18:00</time><span class="g"><strong>Röpi edzés · BVSC</strong><small>90 perc · feladó</small></span><span class="st q">Tervezett</span></div>
    <div class="fh-step"><time>tegnap</time><span class="g"><strong>Sprint-intervallum</strong><small>6 kör · elmaradt</small></span><button class="btn sm ghost" data-toast="Futás pótlása">Pótlom</button></div></section>
  <p class="fh-n rise" style="--i:4">3 · Mai terhelés</p>
  <section class="fh-card rise" style="--i:4">${head('i-muscle','Mit terhel a mai mozgásod','Térkép')}
    ${MUS.map(([k,l,p,d])=>`<div class="fh-mus">${mchp(k,'sm')}<span class="l">${l}</span><span class="v">${d} / ${p} szett</span><div class="bar" style="--c:${muscleColor(k)}"><b style="--w:${Math.max(4,d/p*100)}%"></b></div></div>`).join('')}
    <p class="fh-note">+650 kcal kerül a mai kereted fölé, ha mindent megcsinálsz. Becslés, nem mérés.</p></section>
  <p class="fh-n rise" style="--i:5">4 · Vagy inkább</p>
  <section class="fh-card rise" style="--i:5"><div class="fh-pair"><button data-toast="Egyedi edzés">${I('i-dumb')}Egyedi edzés</button><button data-toast="Sport naplózása">${I('i-ball')}Sport naplózása</button></div></section>`,'edzes')}

const soon=(d,t)=>()=>wrap(`${top(t,'Ez a terület még nincs megrajzolva',['Mai'])}<section class="fh-card"><p class="fh-txt" style="color:var(--sub)">Ebben a körben csak a Nap és az Edzés főoldala készült el, hogy az irányról tudj dönteni. Az alsó sáv és a fenti fülek minden területen így működnének.</p></section>`,d);
window.FREG={nap:{mai:nap},edzes:{mai:edzes},fuel:{mai:soon('fuel','Fuel')},mezo:{mai:soon('mezo','Mezo')},en:{mai:soon('en','Én')}};
window.FNOTES=`<h2>Világos klinikai</h2><p>Új irány a mostani visszajelzésedre: nem a díszítésen változtat, hanem a <b>szerkezeten</b>. Világos, fehér-kék, sötét mód nélkül.</p>
<h2>Hova nézz</h2><ul>
<li><b>Legfelül: hol vagy.</b> A terület neve nagy betűvel, alatta a dátum, a terület színes pöttyével. Mellette kereső, értesítések, beállítások.</li>
<li><b>Fent a fülek.</b> A terület oldalai a cím alatt, aláhúzással jelölve (Mai · A napom · Beszélgetés · Rutin).</li>
<li><b>Lent mindig az öt terület.</b> Nap · Edzés · Fuel · Mezo · Én, felirattal. Nem kell külön váltót nyitni.</li>
</ul>
<h2>Minden oldal ugyanúgy épül fel</h2><ul>
<li><b>Kék kártya legfelül: az állapotod.</b> Egy mondat és egy gomb: mi a helyzet, mit csinálj most.</li>
<li><b>1 · Most következik.</b> A következő teendők időrendben, mindegyik mellett egy gomb.</li>
<li><b>2 · Mai számok.</b> Négy egyforma csempe: név, nagy szám, sáv, egy mondat.</li>
<li><b>3 · Észrevétel</b> és <b>4 · Mai napló.</b></li>
</ul>
<h2>Színek</h2><p>Fehér kártyák világos szürke alapon, sötétkék szöveg, egy kék a gombokra. Zöld, sárga, piros csak állapotot jelent. A területeknek saját színük van, de csak az alsó sávban és a cím pöttyében.</p>
<h2>Ami megmaradt</h2><p>A csepp (a mai állapotod jele) és az izomtérkép-jelek.</p>
<p><b>Ebben a körben csak a Nap és az Edzés főoldala készült el.</b> Az alsó sávon a másik három terület üres lapot mutat.</p>`;
})();
