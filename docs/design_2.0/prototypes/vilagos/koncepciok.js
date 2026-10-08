/* vilagos/koncepciok.js — three bold, deliberately different concepts for Nap · Mai (owner 2026-10-08:
   "még mindig egyhangú és stock"). Same content and skeleton (title · tabs · state · next · numbers ·
   insight · log · five domains), three different ideas:  k1 Műszer · k2 Folyadék · k3 Magazin. */
(function(){
const {I,csepp,css}=K;
const t=s=>`data-toast="${s}"`;

/* ═════════ 1 · MŰSZER — the number is the decoration ═════════ */
css(`
.phone[data-v="k1"]{background:#fff;color:#0B0B0C;--ink:#0B0B0C;--sub:#77777D;--acc:#1F4BFF;--page:#fff;box-shadow:0 40px 90px -30px rgba(0,0,0,.4),0 0 0 10px #0B0B0C}
.phone[data-v="k1"] .scroll{background:#fff;padding-bottom:84px}
.k1-top{display:flex;align-items:baseline;justify-content:space-between;padding:20px 20px 0;font-family:var(--mono);font-size:11px;letter-spacing:.8px;text-transform:uppercase}
.k1-top b{font-family:'Bricolage Grotesque',var(--ff);font-size:18px;font-weight:800;letter-spacing:-.6px;text-transform:none}
.k1-top span{display:flex;gap:14px;color:var(--sub)}
.k1-tabs{display:flex;gap:18px;padding:14px 20px 0;font-family:var(--mono);font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--sub);border-bottom:1px solid #0B0B0C}
.k1-tabs button{padding-bottom:10px;border-bottom:4px solid transparent;margin-bottom:-1px}
.k1-tabs button.on{color:var(--ink);border-bottom-color:var(--ink)}
.k1-hero{padding:18px 20px 22px;border-bottom:1px solid #0B0B0C}
.k1-lab{display:flex;justify-content:space-between;font-family:var(--mono);font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--sub)}
.k1-num{display:flex;align-items:flex-end;gap:18px;margin:2px 0 6px -6px}
.k1-num b{font-family:'Bricolage Grotesque',var(--ff);font-size:184px;font-weight:800;letter-spacing:-12px;line-height:.78;font-variant-numeric:tabular-nums}
.k1-num span{font-family:var(--mono);font-size:12px;color:var(--sub);padding-bottom:6px;line-height:1.4}
.k1-num span i{display:block;font-style:normal;color:var(--acc);font-weight:500}
.k1-rule{position:relative;height:22px;margin:14px 0 14px;background:repeating-linear-gradient(90deg,#0B0B0C 0 1px,transparent 1px 10%) bottom/100% 8px no-repeat,repeating-linear-gradient(90deg,rgba(11,11,12,.35) 0 1px,transparent 1px 2%) bottom/100% 4px no-repeat;border-bottom:1px solid #0B0B0C}
.k1-rule i{position:absolute;left:72%;top:0;width:0;height:0;border:6px solid transparent;border-top:9px solid var(--acc);transform:translateX(-6px)}
.k1-rule::after{content:'0';position:absolute;left:0;top:-2px;font-family:var(--mono);font-size:9px;color:var(--sub)}
.k1-rule::before{content:'100';position:absolute;right:0;top:-2px;font-family:var(--mono);font-size:9px;color:var(--sub)}
.k1-v{font-family:'Bricolage Grotesque',var(--ff);font-size:26px;font-weight:700;letter-spacing:-.9px;line-height:1.08;text-wrap:balance}
.k1-s{font-size:13.5px;color:var(--sub);margin-top:8px;line-height:1.45}
.k1-btn{display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:16px;padding:16px 18px;background:#0B0B0C;color:#fff;font-size:15px;font-weight:600;border-radius:4px}
.k1-btn i{font-style:normal;font-family:var(--mono)}
.k1-h{display:flex;justify-content:space-between;padding:16px 20px 10px;font-family:var(--mono);font-size:11px;letter-spacing:1px;text-transform:uppercase}
.k1-h span{color:var(--sub)}
.k1-row{display:grid;grid-template-columns:54px 1fr auto;gap:10px;align-items:baseline;padding:13px 20px;border-top:1px solid rgba(11,11,12,.14);width:100%;text-align:left}
.k1-row time{font-family:var(--mono);font-size:13px;font-weight:500}
.k1-row strong{font-size:15px;font-weight:600}
.k1-row small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px}
.k1-row em{font-style:normal;font-family:var(--mono);font-size:12px}
.k1-row.now time,.k1-row.now em{color:var(--acc)}
.k1-row.now em{padding:5px 9px;border:1.5px solid var(--acc);border-radius:3px;font-weight:500}
.k1-sec{border-top:1px solid #0B0B0C;margin-top:8px}
.k1-m{display:grid;grid-template-columns:1fr auto;align-items:end;gap:4px 12px;padding:14px 20px 16px;border-top:1px solid rgba(11,11,12,.14);width:100%;text-align:left}
.k1-m small{font-family:var(--mono);font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--sub)}
.k1-m b{font-family:'Bricolage Grotesque',var(--ff);font-size:54px;font-weight:800;letter-spacing:-2.6px;line-height:.9;font-variant-numeric:tabular-nums}
.k1-m b sub{font-family:var(--mono);font-size:12px;font-weight:400;letter-spacing:0;color:var(--sub);vertical-align:baseline;margin-left:6px}
.k1-m em{font-style:normal;font-family:var(--mono);font-size:11.5px;color:var(--sub);text-align:right;line-height:1.4}
.k1-m em.a{color:var(--acc)}
.k1-m .bar{grid-column:1/-1;height:6px;border-radius:0;background:rgba(11,11,12,.10);margin-top:8px}
.k1-m .bar b{display:block;height:100%;width:var(--w);background:#0B0B0C;border-radius:0}
.k1-m .bar.a b{background:var(--acc)}
.k1-q{padding:16px 20px 20px;border-top:1px solid rgba(11,11,12,.14);font-size:16px;line-height:1.45}
.k1-q b{font-weight:700}
.k1-q div{display:flex;gap:18px;margin-top:12px;font-family:var(--mono);font-size:12px}
.k1-q div button{text-decoration:underline;text-underline-offset:4px}
.k1-q div button:first-child{color:var(--acc);font-weight:500}
.k1-nav{position:absolute;left:0;right:0;bottom:0;z-index:30;display:flex;background:#0B0B0C;padding:0 6px calc(6px + env(safe-area-inset-bottom,0px))}
.k1-nav button{flex:1;padding:16px 0 14px;font-family:var(--mono);font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,.5);text-align:center;border-top:4px solid transparent}
.k1-nav button.on{color:#fff;border-top-color:var(--acc)}
.phone[data-v="k1"] .toast{bottom:80px;border-radius:4px}
`);
function k1(){return `<div class="scroll">
  <div class="k1-top"><b>boop</b><span><button ${t('Keresés')}>Keresés</button><button ${t('Értesítések')}>Értesítés 3</button></span></div>
  <nav class="k1-tabs"><button class="on">Mai</button><button ${t('A napom')}>A napom</button><button ${t('Beszélgetés')}>Beszélgetés</button><button ${t('Rutin')}>Rutin</button></nav>
  <section class="k1-hero rise"><div class="k1-lab"><span>Mai állapot</span><span>Sze · 10. 07.</span></div>
    <div class="k1-num"><b>72</b><span>/ 100<i>+4 a heti<br>átlaghoz</i></span></div>
    <div class="k1-rule"><i></i></div>
    <p class="k1-v">Ma jó nap egy közepes edzéshez.</p>
    <p class="k1-s">Nyugodt ébredés, 7 ó 40 p alvás. A hét jeledből négy megvan.</p>
    <button class="k1-btn" ${t('Délutáni check-in')}>Délutáni check-in<i>→</i></button></section>
  <div class="k1-h rise" style="--i:1"><b>01 · Most következik</b><span>3 tétel</span></div>
  <button class="k1-row now rise" style="--i:1" ${t('Check-in')}><time>14:00</time><span><strong>Délutáni check-in</strong><small>8 koppintás, kb. fél perc</small></span><em>Kitöltöm</em></button>
  <button class="k1-row rise" style="--i:1" ${t('Edzés')}><time>18:00</time><span><strong>Röpi edzés · BVSC</strong><small>90 perc · feladó</small></span><em>→</em></button>
  <button class="k1-row rise" style="--i:1" ${t('Fuel · logolás')}><time>19:30</time><span><strong>Vacsora</strong><small>72 g fehérje hiányzik</small></span><em>→</em></button>
  <div class="k1-sec"><div class="k1-h rise" style="--i:2"><b>02 · Mai számok</b><span>4 mutató</span></div>
  <button class="k1-m rise" style="--i:2" ${t('Fuel')}><small>Kalória</small><em>1 040 van még</em><b>2 060<sub>/ 3 100 kcal</sub></b><span></span><div class="bar"><b style="--w:66%"></b></div></button>
  <button class="k1-m rise" style="--i:2" ${t('Fuel')}><small>Fehérje</small><em class="a">72 g hiányzik</em><b>148<sub>/ 220 g</sub></b><span></span><div class="bar a"><b style="--w:67%"></b></div></button>
  <button class="k1-m rise" style="--i:2" ${t('Én · alvás')}><small>Alvás</small><em>átlag fölött</em><b>7:40<sub>óra</sub></b><span></span><div class="bar"><b style="--w:92%"></b></div></button>
  <button class="k1-m rise" style="--i:2" ${t('Edzés')}><small>Mozgás</small><em class="a">Pull Day hátravan</em><b>0<sub>/ 2 alkalom</sub></b><span></span><div class="bar a"><b style="--w:3%"></b></div></button></div>
  <div class="k1-sec"><div class="k1-h rise" style="--i:3"><b>03 · Észrevétel</b><span>4 nap adata</span></div>
  <div class="k1-q rise" style="--i:3">Amikor <b>Anna</b> szerepel a hála-naplódban, másnap átlag <b>40 perccel többet</b> alszol. Ez még kevés adat. Figyeljem tovább?
    <div><button ${t('Megjegyeztem: figyelem tovább')}>Igen, figyeld</button><button ${t('Megjegyeztem')}>Nem stimmel</button><button ${t('Miből látom?')}>Miből?</button></div></div></div>
  <div class="k1-sec"><div class="k1-h rise" style="--i:4"><b>04 · Mai napló</b><span>+ Új</span></div>
  <button class="k1-row rise" style="--i:4" ${t('Étkezés')}><time>13:00</time><span><strong>Ebéd</strong><small>Csirke · édesburgonya · spenót</small></span><em>760</em></button>
  <button class="k1-row rise" style="--i:4" ${t('Étkezés')}><time>09:15</time><span><strong>Reggeli</strong><small>Túrós zabkása áfonyával</small></span><em>420</em></button>
  <button class="k1-row rise" style="--i:4" ${t('Check-in')}><time>07:10</time><span><strong>Reggeli check-in</strong><small>Nyugodt ébredés, pihenve</small></span><em>✓</em></button></div>
  </div><nav class="k1-nav"><button class="on">Nap</button><button ${t('Edzés')}>Edzés</button><button ${t('Fuel')}>Fuel</button><button ${t('Mezo')}>Mezo</button><button ${t('Én')}>Én</button></nav><div class="toast" id="toast"></div>`}

/* ═════════ 2 · FOLYADÉK — everything is a level that fills ═════════ */
const wave=(c,o=1,cls='')=>`<svg class="k2-w ${cls}" viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden="true"><path fill="${c}" opacity="${o}" d="M0 10 Q25 0 50 10 T100 10 T150 10 T200 10 T250 10 T300 10 T350 10 T400 10 T450 10 T500 10 V20 H0Z"/></svg>`;
css(`
.phone[data-v="k2"]{background:#EEF7F9;color:#0A2A3C;--ink:#0A2A3C;--sub:#4E6B7A;--page:#EEF7F9;--liq1:#19C7C0;--liq2:#1877F2;box-shadow:0 40px 90px -30px rgba(10,42,60,.45),0 0 0 10px #fff,0 0 0 11px rgba(10,42,60,.1)}
.phone[data-v="k2"] .scroll{background:linear-gradient(180deg,#F7FCFD,#E6F3F7);padding-bottom:110px}
.k2-top{display:flex;align-items:center;gap:8px;padding:18px 18px 0}
.k2-top div{flex:1}
.k2-top small{font-size:12px;font-weight:600;color:var(--sub)}
.k2-top h1{font-family:'Bricolage Grotesque',var(--ff);font-size:34px;font-weight:800;letter-spacing:-1.4px;line-height:1}
.k2-ib{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#fff;box-shadow:0 6px 14px -8px rgba(10,42,60,.4);position:relative}
.k2-ib svg.ic{width:24px;height:24px}
.k2-ib b{position:absolute;top:-2px;right:-2px;min-width:17px;height:17px;border-radius:9px;background:#1877F2;color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center;box-shadow:0 0 0 2px #F7FCFD}
.k2-tabs{display:flex;gap:6px;padding:14px 16px 0;overflow-x:auto;scrollbar-width:none}
.k2-tabs button{padding:8px 14px;border-radius:999px;font-size:13.5px;font-weight:600;color:var(--sub);white-space:nowrap}
.k2-tabs button.on{color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 8px 16px -8px var(--liq2)}
/* the tank */
.k2-tank{position:relative;margin:14px 14px 0;height:372px;border-radius:44px;overflow:hidden;background:linear-gradient(180deg,#fff,#F3FAFC);box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),inset 0 8px 20px -8px rgba(10,42,60,.12),0 30px 50px -30px rgba(24,119,242,.6)}
.k2-air{position:absolute;left:22px;right:22px;top:20px;z-index:3}
.k2-air small{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--sub)}
.k2-air p{font-family:'Bricolage Grotesque',var(--ff);font-size:23px;font-weight:800;letter-spacing:-.8px;line-height:1.1;margin-top:4px;text-wrap:balance}
.k2-liq{position:absolute;left:0;right:0;bottom:0;height:68%;background:linear-gradient(180deg,var(--liq1),var(--liq2))}
.k2-w{position:absolute;left:0;bottom:calc(100% - 1px);width:200%;height:18px}
.k2-w.b{height:24px;bottom:calc(100% - 1px)}
.k2-liq .n{position:absolute;left:22px;bottom:86px;color:#fff;line-height:.8}
.k2-liq .n b{font-family:'Bricolage Grotesque',var(--ff);font-size:148px;font-weight:800;letter-spacing:-9px;text-shadow:0 10px 30px rgba(10,42,60,.25)}
.k2-liq .n small{display:block;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.9;margin:12px 0 0 6px}
.k2-liq .marks{position:absolute;right:16px;top:8px;bottom:84px;display:flex;flex-direction:column;justify-content:space-between;font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.75);text-align:right}
.k2-liq .marks span::after{content:'';display:inline-block;width:10px;height:1px;background:rgba(255,255,255,.7);margin-left:6px;vertical-align:middle}
.k2-bub{position:absolute;border-radius:50%;background:rgba(255,255,255,.35);box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}
.k2-cta{position:absolute;left:16px;right:16px;bottom:16px;z-index:4;display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-radius:999px;background:#fff;color:var(--ink);font-size:15.5px;font-weight:700;box-shadow:0 14px 26px -12px rgba(10,42,60,.6)}
.k2-cta i{font-style:normal;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2))}
.k2-h{display:flex;align-items:baseline;justify-content:space-between;padding:26px 20px 12px}
.k2-h b{font-family:'Bricolage Grotesque',var(--ff);font-size:21px;font-weight:800;letter-spacing:-.6px}
.k2-h span{font-size:12.5px;font-weight:600;color:var(--sub)}
/* vials */
.k2-vials{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 16px}
.k2-vial{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.k2-tube{position:relative;width:100%;height:168px;border-radius:999px;overflow:hidden;background:linear-gradient(180deg,#fff,#F3FAFC);box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),inset 0 6px 14px -6px rgba(10,42,60,.14),0 16px 26px -18px var(--c)}
.k2-tube .l{position:absolute;left:0;right:0;bottom:0;height:var(--p);background:linear-gradient(180deg,color-mix(in srgb,var(--c) 70%,#fff),var(--c))}
.k2-tube .l .k2-w{height:10px}
.k2-tube svg.ic{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:34px;height:34px;filter:drop-shadow(0 4px 6px rgba(10,42,60,.3))}
.k2-tube em{position:absolute;left:0;right:0;top:14px;font-style:normal;font-family:var(--mono);font-size:10px;color:var(--sub)}
.k2-vial b{font-family:'Bricolage Grotesque',var(--ff);font-size:20px;font-weight:800;letter-spacing:-.6px;line-height:1}
.k2-vial small{font-size:11.5px;font-weight:600;color:var(--sub);line-height:1.25}
.k2-vial small i{display:block;font-style:normal;font-weight:500;font-size:10.5px}
/* stream: next steps as drops on a line */
.k2-stream{position:relative;margin:0 16px;padding-left:34px}
.k2-stream::before{content:'';position:absolute;left:15px;top:14px;bottom:14px;width:4px;border-radius:2px;background:linear-gradient(180deg,var(--liq1),var(--liq2) 40%,rgba(24,119,242,.15) 41%)}
.k2-drop{position:relative;display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:10px;border-radius:26px;background:#fff;box-shadow:0 12px 22px -16px rgba(10,42,60,.5);width:100%;text-align:left}
.k2-drop::before{content:'';position:absolute;left:-28px;top:50%;width:18px;height:18px;margin-top:-9px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:#fff;box-shadow:inset 0 0 0 4px rgba(24,119,242,.25)}
.k2-drop.now{background:linear-gradient(135deg,var(--liq1),var(--liq2));color:#fff;box-shadow:0 18px 28px -16px var(--liq2)}
.k2-drop.now::before{background:var(--liq1);box-shadow:0 0 0 5px rgba(25,199,192,.25)}
.k2-drop time{font-family:'Bricolage Grotesque',var(--ff);font-size:17px;font-weight:800;letter-spacing:-.5px;width:52px;flex:0 0 auto}
.k2-drop span{flex:1;min-width:0}
.k2-drop strong{display:block;font-size:15px;font-weight:700}
.k2-drop small{display:block;font-size:12.5px;opacity:.75;margin-top:1px}
.k2-drop em{font-style:normal;font-size:13px;font-weight:700;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.95);color:var(--ink);flex:0 0 auto}
.k2-drop:not(.now) em{background:#EEF7F9}
.k2-note{margin:0 16px;padding:18px;border-radius:30px;background:#fff;box-shadow:0 12px 22px -16px rgba(10,42,60,.5);display:flex;gap:12px}
.k2-note p{font-size:15px;line-height:1.45}
.k2-note div div{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.k2-note button{padding:9px 14px;border-radius:999px;font-size:13px;font-weight:700;background:#EEF7F9}
.k2-note button.p{color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2))}
.k2-nav{position:absolute;left:10px;right:10px;bottom:10px;z-index:30;display:flex;padding:8px 6px 6px;border-radius:30px;background:rgba(255,255,255,.9);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 18px 34px -14px rgba(10,42,60,.5)}
.k2-nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:600;color:var(--sub)}
.k2-nav button.on{color:var(--ink);font-weight:800}
.k2-nav .csepp .body{filter:none}
.phone[data-v="k2"] .toast{bottom:100px}
@media (prefers-reduced-motion:no-preference){
  body:not(.still) .k2-w{animation:k2w 5s linear infinite}
  body:not(.still) .k2-w.b{animation-duration:8s;animation-direction:reverse}
  body:not(.still) .k2-bub{animation:k2b var(--d,7s) ease-in infinite;animation-delay:var(--dl,0s)}
  body:not(.still) .k2-liq{animation:k2fill 1.6s cubic-bezier(.2,.8,.2,1) both}
  body:not(.still) .k2-tube .l{animation:k2fillv 1.4s cubic-bezier(.2,.8,.2,1) both .2s}
}
@keyframes k2w{to{transform:translateX(-50%)}}
@keyframes k2b{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(-190px);opacity:0}}
@keyframes k2fill{from{height:6%}}
@keyframes k2fillv{from{height:4%}}
`);
const NAVC=[['Nap','#1877F2',78],['Edzés','#F2683A',30],['Fuel','#1FA971',66],['Mezo','#7A5CE0',50],['Én','#12A5B5',60]];
function k2(){
  const vial=(l,ic,c,p,v,s,mark)=>`<button class="k2-vial" ${t(l)} style="--c:${c}"><span class="k2-tube"><em>${mark}</em><span class="l" style="--p:${p}%">${wave('color-mix(in srgb,'+c+' 70%,#fff)')}</span>${I(ic)}</span><b>${v}</b><small>${l}<i>${s}</i></small></button>`;
  return `<div class="scroll">
  <div class="k2-top"><div><small>Szerda, október 7.</small><h1>Ma</h1></div><button class="k2-ib" ${t('Keresés')} aria-label="Keresés"><svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></button><button class="k2-ib" ${t('Értesítések')} aria-label="Értesítések">${I('c-i-ertesites')}<b>3</b></button></div>
  <nav class="k2-tabs"><button class="on">Mai</button><button ${t('A napom')}>A napom</button><button ${t('Beszélgetés')}>Beszélgetés</button><button ${t('Rutin')}>Rutin</button></nav>
  <section class="k2-tank rise"><div class="k2-air"><small>Mai állapot</small><p>Ma jó nap egy közepes edzéshez.</p></div>
    <div class="k2-liq">${wave('#19C7C0',.55,'b')}${wave('#19C7C0')}
      <i class="k2-bub" style="left:62%;bottom:20%;width:12px;height:12px;--d:6s"></i><i class="k2-bub" style="left:78%;bottom:8%;width:7px;height:7px;--d:8s;--dl:2s"></i><i class="k2-bub" style="left:70%;bottom:30%;width:18px;height:18px;--d:9s;--dl:4s"></i><i class="k2-bub" style="left:48%;bottom:12%;width:9px;height:9px;--d:7s;--dl:1s"></i>
      <div class="marks"><span>75</span><span>50</span><span>25</span></div>
      <div class="n"><b>72</b><small>a 100-ból · 4 jel a 7-ből</small></div></div>
    <button class="k2-cta" ${t('Délutáni check-in')}>Délutáni check-in<i>→</i></button></section>
  <div class="k2-h rise" style="--i:1"><b>Mai szintek</b><span>hol tartasz a célhoz</span></div>
  <div class="k2-vials rise" style="--i:1">${vial('Kalória','t-flame','#1877F2',66,'2 060','1 040 van még','3 100')}${vial('Fehérje','t-meat','#E8615C',67,'148 g','72 g hiányzik','220')}${vial('Alvás','t-sleep','#1FA971',92,'7 ó 40','átlag fölött','8 ó')}${vial('Mozgás','t-dumbbell','#E8A21E',6,'0 / 2','Pull Day vár','2')}</div>
  <div class="k2-h rise" style="--i:2"><b>Most következik</b><span>3 teendő</span></div>
  <div class="k2-stream rise" style="--i:2">
    <button class="k2-drop now" ${t('Check-in')}><time>14:00</time><span><strong>Délutáni check-in</strong><small>8 koppintás, kb. fél perc</small></span><em>Kitöltöm</em></button>
    <button class="k2-drop" ${t('Edzés')}><time>18:00</time><span><strong>Röpi edzés · BVSC</strong><small>90 perc · feladó</small></span><em>Megnézem</em></button>
    <button class="k2-drop" ${t('Fuel · logolás')}><time>19:30</time><span><strong>Vacsora</strong><small>72 g fehérje hiányzik</small></span><em>Logolom</em></button></div>
  <div class="k2-h rise" style="--i:3"><b>Észrevétel</b><span>Mezo · 4 nap adata</span></div>
  <div class="k2-note rise" style="--i:3">${csepp('ok',64,{s:44,form:'crystal',color:'#7A5CE0',alive:false})}<div><p>Amikor <b>Anna</b> szerepel a hála-naplódban, másnap átlag <b>40 perccel többet</b> alszol. Ez még kevés adat. Figyeljem tovább?</p><div><button class="p" ${t('Megjegyeztem: figyelem tovább')}>Igen, figyeld</button><button ${t('Megjegyeztem')}>Nem stimmel</button><button ${t('Miből látom?')}>Miből?</button></div></div></div>
  <div class="k2-h rise" style="--i:4"><b>Mai napló</b><span>+ Új bejegyzés</span></div>
  <div class="k2-stream rise" style="--i:4">
    <button class="k2-drop" ${t('Étkezés')}><time>13:00</time><span><strong>Ebéd</strong><small>Csirke · édesburgonya · spenót</small></span><em>760</em></button>
    <button class="k2-drop" ${t('Étkezés')}><time>09:15</time><span><strong>Reggeli</strong><small>Túrós zabkása áfonyával</small></span><em>420</em></button>
    <button class="k2-drop" ${t('Check-in')}><time>07:10</time><span><strong>Reggeli check-in</strong><small>Nyugodt ébredés, pihenve</small></span><em>✓</em></button></div>
  </div><nav class="k2-nav">${NAVC.map(([l,c,f],i)=>`<button class="${i?'':'on'}" ${i?t(l):''}>${csepp('ok',i?f:86,{s:i?34:40,color:c,alive:!i})}<span>${l}</span></button>`).join('')}</nav><div class="toast" id="toast"></div>`}

/* ═════════ 3 · MAGAZIN — the day as an edited page ═════════ */
css(`
.phone[data-v="k3"]{background:#fff;color:#141414;--ink:#141414;--sub:#6E6A66;--acc:#0E7A5F;--page:#fff;--se:'Fraunces',Georgia,serif;box-shadow:0 40px 90px -30px rgba(0,0,0,.35),0 0 0 10px #fff,0 0 0 11px rgba(0,0,0,.12)}
.phone[data-v="k3"] .scroll{background:#fff;padding-bottom:78px}
.k3-mast{display:flex;align-items:baseline;justify-content:space-between;margin:0 22px;padding:20px 0 12px;border-bottom:3px double #141414}
.k3-mast b{font-family:var(--se);font-style:italic;font-size:28px;font-weight:600;letter-spacing:-.8px}
.k3-mast span{font-size:10.5px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:var(--sub)}
.k3-tabs{display:flex;gap:20px;margin:0 22px;padding:11px 0;border-bottom:1px solid rgba(20,20,20,.18);font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--sub)}
.k3-tabs button.on{color:var(--ink)}
.k3-tabs button.on::before{content:'● ';color:var(--acc);font-size:8px;vertical-align:1px}
.k3-lead{padding:26px 22px 24px}
.k3-kick{font-size:10.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:var(--acc)}
.k3-lead h1{font-family:var(--se);font-size:50px;font-weight:400;letter-spacing:-1.9px;line-height:.98;margin:12px 0 16px;text-wrap:balance}
.k3-lead h1 em{font-style:italic;color:var(--acc)}
.k3-stand{font-family:var(--se);font-size:18px;line-height:1.4;color:#3A3835}
.k3-stand::first-letter{font-size:56px;font-weight:600;float:left;line-height:.82;padding:6px 8px 0 0;color:var(--ink)}
.k3-go{display:inline-flex;align-items:center;gap:10px;margin-top:20px;padding-bottom:5px;border-bottom:2px solid var(--ink);font-size:15px;font-weight:700}
.k3-go i{font-style:normal;color:var(--acc)}
.k3-score{float:right;margin:2px 4px 6px 14px;padding-right:6px;text-align:right;shape-outside:margin-box}
.k3-score b{display:block;font-family:var(--se);font-style:italic;font-size:74px;font-weight:400;letter-spacing:-3px;line-height:.8;color:var(--acc)}
.k3-score small{font-size:9.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--sub)}
.k3-h{display:flex;align-items:baseline;gap:10px;margin:0 22px;padding:14px 0 4px;border-top:1px solid #141414;font-size:10.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase}
.k3-h::after{content:'';flex:1;border-bottom:1px solid rgba(20,20,20,.18);transform:translateY(-3px)}
.k3-item{display:grid;grid-template-columns:58px 1fr;gap:4px 8px;align-items:start;margin:0 22px;padding:16px 0;border-bottom:1px solid rgba(20,20,20,.14);width:calc(100% - 44px);text-align:left}
.k3-item i{font-family:var(--se);font-style:italic;font-size:58px;font-weight:400;line-height:.78;color:var(--acc);letter-spacing:-2px}
.k3-item strong{display:block;font-family:var(--se);font-size:23px;font-weight:500;letter-spacing:-.5px;line-height:1.1}
.k3-item small{display:block;font-size:12.5px;color:var(--sub);margin-top:6px}
.k3-item small b{color:var(--ink);font-weight:700;letter-spacing:.4px}
.k3-item small u{text-decoration:none;font-weight:700;color:var(--ink);border-bottom:1.5px solid var(--acc);margin-left:8px}
.k3-nums{display:grid;grid-template-columns:1fr 1fr;margin:0 22px}
.k3-nums button{padding:18px 0 16px;border-bottom:1px solid rgba(20,20,20,.14);text-align:left}
.k3-nums button:nth-child(odd){padding-right:14px;border-right:1px solid rgba(20,20,20,.14)}
.k3-nums button:nth-child(even){padding-left:16px}
.k3-nums small{font-size:9.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--sub)}
.k3-nums b{display:block;font-family:var(--se);font-size:46px;font-weight:400;letter-spacing:-2px;line-height:1;margin:6px 0 4px}
.k3-nums b sub{font-family:var(--ff);font-size:12px;letter-spacing:0;color:var(--sub);vertical-align:baseline;margin-left:4px}
.k3-nums em{font-family:var(--se);font-style:italic;font-size:14.5px;color:#3A3835}
.k3-nums em.a{color:var(--acc)}
.k3-plate{position:relative;margin:22px 0 0;padding:26px 22px 22px;background:#EAF3EE}
.k3-plate .dish{float:right;width:138px;height:138px;margin:-52px -6px 4px 12px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#DCEBE3);box-shadow:0 22px 30px -18px rgba(14,122,95,.7),inset 0 0 0 9px #fff;display:grid;place-items:center}
.k3-plate .dish svg.ic{width:84px;height:84px;filter:drop-shadow(0 10px 10px rgba(0,0,0,.25))}
.k3-plate h3{font-family:var(--se);font-size:28px;font-weight:400;letter-spacing:-.9px;line-height:1.05;margin:8px 0 8px}
.k3-plate h3 em{font-style:italic}
.k3-plate p{font-family:var(--se);font-style:italic;font-size:15px;color:#3A3835;line-height:1.4}
.k3-plate .tl{clear:both;display:flex;gap:18px;margin-top:16px;padding-top:12px;border-top:1px solid rgba(20,20,20,.18);font-size:12px;color:var(--sub)}
.k3-plate .tl b{color:var(--ink)}
.k3-quote{padding:30px 22px 26px;position:relative}
.k3-quote::before{content:'“';position:absolute;left:14px;top:-6px;font-family:var(--se);font-size:150px;line-height:1;color:var(--acc);opacity:.22}
.k3-quote p{position:relative;font-family:var(--se);font-style:italic;font-size:25px;font-weight:400;letter-spacing:-.6px;line-height:1.2}
.k3-quote p b{font-style:normal;font-weight:600}
.k3-quote small{display:block;margin-top:14px;font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--sub)}
.k3-quote div{display:flex;gap:20px;margin-top:16px;font-size:14px;font-weight:700}
.k3-quote div button{padding-bottom:3px;border-bottom:2px solid rgba(20,20,20,.2)}
.k3-quote div button:first-child{border-bottom-color:var(--acc)}
.k3-nav{position:absolute;left:0;right:0;bottom:0;z-index:30;display:flex;background:#fff;border-top:3px double #141414;padding:0 14px calc(4px + env(safe-area-inset-bottom,0px))}
.k3-nav button{flex:1;padding:16px 0 14px;font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--sub);text-align:center}
.k3-nav button.on{color:var(--ink);font-family:var(--se);font-style:italic;font-size:19px;font-weight:600;letter-spacing:-.4px;text-transform:none;padding:9px 0 9px}
.phone[data-v="k3"] .toast{bottom:74px;border-radius:2px}
`);
function k3(){return `<div class="scroll">
  <div class="k3-mast"><b>boop</b><span>Szerda · X. 7. · 281. nap</span></div>
  <nav class="k3-tabs"><button class="on">Mai</button><button ${t('A napom')}>A napom</button><button ${t('Beszélgetés')}>Beszélgetés</button><button ${t('Rutin')}>Rutin</button></nav>
  <section class="k3-lead rise"><span class="k3-kick">A mai nap</span>
    <h1>Ma jó nap egy <em>közepes</em> edzéshez.</h1>
    <div class="k3-score"><b>72</b><small>pont a százból</small></div>
    <p class="k3-stand">Nyugodtan ébredtél, hét óra negyven percet aludtál, ami a heti átlagod fölött van. A hét jeledből négy már megvan; két check-in és a vacsora van hátra.</p>
    <button class="k3-go" ${t('Délutáni check-in')}>Délutáni check-in <i>→</i></button></section>
  <div class="k3-h rise" style="--i:1">Három teendő</div>
  <button class="k3-item rise" style="--i:1" ${t('Check-in')}><i>1</i><span><strong>Délutáni check-in</strong><small><b>14:00</b> · nyolc koppintás, fél perc<u>Kitöltöm</u></small></span></button>
  <button class="k3-item rise" style="--i:1" ${t('Edzés')}><i>2</i><span><strong>Röpi edzés a BVSC-ben</strong><small><b>18:00</b> · kilencven perc, feladóként</small></span></button>
  <button class="k3-item rise" style="--i:1" ${t('Fuel · logolás')}><i>3</i><span><strong>Vacsora, sok fehérjével</strong><small><b>19:30</b> · 72 gramm hiányzik a mai célból</small></span></button>
  <div class="k3-h rise" style="--i:2" style="margin-top:8px">A nap számokban</div>
  <div class="k3-nums rise" style="--i:2">
    <button ${t('Fuel')}><small>Kalória</small><b>2 060<sub>/ 3 100</sub></b><em>ezernegyven van még</em></button>
    <button ${t('Fuel')}><small>Fehérje</small><b>148<sub>g / 220</sub></b><em class="a">hetvenkettő hiányzik</em></button>
    <button ${t('Én · alvás')}><small>Alvás</small><b>7:40</b><em>a heti átlag fölött</em></button>
    <button ${t('Edzés')}><small>Mozgás</small><b>0<sub>/ 2 alkalom</sub></b><em class="a">a Pull Day hátravan</em></button></div>
  <section class="k3-plate rise" style="--i:3"><span class="k3-kick">Az asztalon · 13:00</span><div class="dish">${I('t-bowl')}</div>
    <h3>Csirke, édesburgonya, <em>spenót.</em></h3><p>Edzés utánra pont jó: sok fehérje, elég szénhidrát a visszatöltéshez.</p>
    <div class="tl"><span><b>760</b> kcal</span><span><b>63 g</b> fehérje</span><span><b>8,1</b> pont</span></div></section>
  <section class="k3-quote rise" style="--i:4"><p>Amikor <b>Anna</b> szerepel a hála-naplódban, másnap <b>negyven perccel többet</b> alszol.</p>
    <small>Mezo észrevétele · négy nap adata, még kevés</small>
    <div><button ${t('Megjegyeztem: figyelem tovább')}>Figyeld tovább</button><button ${t('Megjegyeztem')}>Nem stimmel</button><button ${t('Miből látom?')}>Miből?</button></div></section>
  <div class="k3-h rise" style="--i:5">Korábban ma</div>
  <button class="k3-item rise" style="--i:5;grid-template-columns:58px 1fr" ${t('Étkezés')}><i style="font-size:22px;line-height:1.3;letter-spacing:0">9:15</i><span><strong style="font-size:19px">Túrós zabkása áfonyával</strong><small>Reggeli · 420 kcal</small></span></button>
  <button class="k3-item rise" style="--i:5" ${t('Check-in')}><i style="font-size:22px;line-height:1.3;letter-spacing:0">7:10</i><span><strong style="font-size:19px">Nyugodt ébredés, pihenve</strong><small>Reggeli check-in</small></span></button>
  </div><nav class="k3-nav"><button class="on">Nap</button><button ${t('Edzés')}>Edzés</button><button ${t('Fuel')}>Fuel</button><button ${t('Mezo')}>Mezo</button><button ${t('Én')}>Én</button></nav><div class="toast" id="toast"></div>`}

window.KONC={k1,k2,k3};
window.KNOTES={
k1:`<h2>1 · Műszer</h2><p><b>Az ötlet:</b> a szám maga a dísz. Nincs kártya, nincs árnyék, nincs ikon. Fekete, fehér és egyetlen kék.</p><ul><li>A 72 akkora, hogy karnyújtásnyiról is olvasod, alatta egy mérőléc mutatja, hol áll a százból.</li><li>Minden mutató egy teljes sor: nagy szám, alatta vastag sáv. A kék azt jelenti: itt van teendő.</li><li>Az alsó sáv fekete, csak felirat.</li></ul><p><b>Milyen érzés:</b> precíz, magabiztos, felnőtt. Egy jó mérőműszer vagy egy pénzügyi app. <b>Kockázat:</b> rideg lehet, és a 3D ikonok kimaradnak.</p>`,
k2:`<h2>2 · Folyadék</h2><p><b>Az ötlet:</b> minden egy szint, ami töltődik. Ez a csepp-ötlet végigvíve, ez lenne a leginkább a tiéd.</p><ul><li>A fő kártya egy tartály: a napod 72-ig van töltve, a folyadék hullámzik, buborékok szállnak fel.</li><li>A négy mutató négy kémcső, mindegyik a saját színében, a céljáig töltve. Ránézésre látod, melyik üres.</li><li>A teendők egy folyam mentén sorakoznak, a soron következő van megtöltve.</li><li>Alul az öt terület öt csepp.</li></ul><p><b>Milyen érzés:</b> élő, játékos, de nem gyerekes. <b>Kockázat:</b> a mozgás sok lehet, és bonyolultabb megépíteni. A „mozgás nélkül” pipával megnézheted állóképként.</p>`,
k3:`<h2>3 · Magazin</h2><p><b>Az ötlet:</b> a napod egy megszerkesztett újságoldal. Nagy talpas betű, sok levegő, vonalak dobozok helyett, egyetlen zöld.</p><ul><li>A fő mondat címlap-méretű, a 72 dőlt betűvel áll mellette, a bevezető folyó szöveg.</li><li>A teendők nagy dőlt számokkal számozva, a mutatók kéthasábos táblában.</li><li>Az ebéd saját kiemelt blokkot kap tányérral, az észrevétel idézetként jelenik meg.</li></ul><p><b>Milyen érzés:</b> nyugodt, igényes, emberi. <b>Kockázat:</b> igazán jó valódi ételfotókkal lenne, és a szöveg minőségén múlik.</p>`};
})();
