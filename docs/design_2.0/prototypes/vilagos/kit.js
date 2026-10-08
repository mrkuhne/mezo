/* vilagos/kit.js — "Világos · élő": the owner-approved direction (2026-10-08).
   Light only, structure first, with character. Read vilagos/README.md before writing a domain file. */
(function(){
const {I,csepp,mchp,muscleColor,css,esc}=K;
window.FH_LIVE=true;
const DOM=[['nap','Nap','c-i-nap','#1F6FEB'],['edzes','Edzés','c-i-edzes','#F26A3D'],['fuel','Fuel','c-i-tanyer','#1E9E6A'],['mezo','Mezo','c-i-mezo','#6D5BD0'],['en','Én','c-i-emberek','#0E9AA7']];
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

.fh-n b{font-weight:650}.fh-n b::after{content:' ·';margin-right:4px}
.fh-step .si,.fh-stat .ti,.fh-art{display:none}
/* ══ ÉLŐ réteg: ugyanaz a szerkezet, saját karakterrel ══ */
.phone[data-s="elo"]{--disp:'Bricolage Grotesque',var(--ff);--acc:var(--dom);--dom2:#19B5A5}
.phone[data-s="elo"][data-d="edzes"]{--dom:#F26A3D;--dom2:#F2B13D}
.phone[data-s="elo"][data-d="fuel"]{--dom2:#9BC53D}.phone[data-s="elo"][data-d="mezo"]{--dom2:#E26BA8}.phone[data-s="elo"][data-d="en"]{--dom2:#4D7CFE}
.phone[data-s="elo"] .scroll{background:radial-gradient(130% 420px at 15% -80px,color-mix(in srgb,var(--dom) 26%,#fff),transparent 70%),radial-gradient(110% 380px at 105% -40px,color-mix(in srgb,var(--dom2) 22%,#fff),transparent 68%),var(--page);padding-bottom:112px}
.phone[data-s="elo"] .fh-top{background:color-mix(in srgb,#fff 62%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border-bottom-color:rgba(15,30,51,.06)}
.phone[data-s="elo"] .fh-title h1{font-family:var(--disp);font-size:36px;font-weight:800;letter-spacing:-1.4px}
.phone[data-s="elo"] .fh-title small{font-weight:600;color:color-mix(in srgb,var(--dom) 70%,var(--ink))}
.phone[data-s="elo"] .fh-ib{background:rgba(255,255,255,.8);box-shadow:0 4px 12px -6px rgba(15,30,51,.25),inset 0 0 0 1px rgba(15,30,51,.05)}
.phone[data-s="elo"] .fh-ib svg.ic.td{width:24px;height:24px;filter:drop-shadow(0 3px 4px rgba(15,30,51,.25))}
.phone[data-s="elo"] .fh-tabs button.on{font-weight:700}
.phone[data-s="elo"] .fh-card{border:0;border-radius:24px;padding:18px;box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 14px 30px -20px rgba(15,30,51,.35),0 2px 6px -2px rgba(15,30,51,.08)}
.phone[data-s="elo"] .fh-hero{position:relative;overflow:hidden;padding:20px;
  background:radial-gradient(90% 130% at 0% 0%,color-mix(in srgb,var(--dom) 34%,#fff),transparent 62%),radial-gradient(80% 120% at 100% 100%,color-mix(in srgb,var(--dom2) 30%,#fff),transparent 60%),#fff;
  box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 22px 40px -22px color-mix(in srgb,var(--dom) 60%,transparent),0 2px 6px -2px rgba(15,30,51,.08)}
.phone[data-s="elo"] .fh-hero.warn{background:radial-gradient(90% 130% at 0% 0%,#FFE2A6,transparent 62%),radial-gradient(80% 120% at 100% 100%,#FFD3C2,transparent 60%),#fff;box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 22px 40px -22px rgba(201,138,18,.6)}
.phone[data-s="elo"] .fh-hero .lbl{color:color-mix(in srgb,var(--dom) 75%,var(--ink))}
.phone[data-s="elo"] .fh-hero.warn .lbl{color:#9A6708}
.phone[data-s="elo"] .fh-hero .verdict{font-family:var(--disp);font-size:24px;font-weight:800;letter-spacing:-.8px;line-height:1.12}
.phone[data-s="elo"] .fh-hero .sub{color:color-mix(in srgb,var(--ink) 72%,transparent)}
.phone[data-s="elo"] .fh-art{display:block;position:absolute;right:10px;top:8px;width:96px;height:96px;transform:rotate(8deg)}
.phone[data-s="elo"] .fh-art svg.ic{width:96px;height:96px;filter:drop-shadow(0 14px 16px rgba(15,30,51,.3))}
.phone[data-s="elo"] .btn{border-radius:14px;font-weight:700;background:linear-gradient(180deg,color-mix(in srgb,var(--acc) 88%,#fff),var(--acc));box-shadow:0 10px 20px -10px var(--acc),inset 0 1px 0 rgba(255,255,255,.35)}
.phone[data-s="elo"] .btn.ghost{background:#fff;box-shadow:0 4px 10px -6px rgba(15,30,51,.25),inset 0 0 0 1px rgba(15,30,51,.08);border:0}
.phone[data-s="elo"] .fh-lk{color:color-mix(in srgb,var(--dom) 80%,var(--ink));font-weight:650}
.phone[data-s="elo"] .fh-n{display:flex;align-items:center;gap:8px;font-family:var(--disp);font-size:17px;font-weight:700;letter-spacing:-.3px;text-transform:none;color:var(--ink);margin:24px 16px 0}
.phone[data-s="elo"] .fh-n b{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:800;color:#fff;background:var(--dom);box-shadow:0 6px 12px -6px var(--dom)}
.phone[data-s="elo"] .fh-n b::after{content:none}
.phone[data-s="elo"] .fh-step{gap:10px}
.phone[data-s="elo"] .fh-step .si{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:var(--page);flex:0 0 auto}
.phone[data-s="elo"] .fh-step .si svg.ic{width:28px;height:28px;filter:drop-shadow(0 4px 5px rgba(15,30,51,.22))}
.phone[data-s="elo"] .fh-step time{width:auto;min-width:40px;font-family:var(--disp);font-size:14px;font-weight:700}
.phone[data-s="elo"] .fh-step.now{margin:-6px -8px 4px;padding:12px 8px;border-radius:16px;border-top:0;background:color-mix(in srgb,var(--dom) 9%,#fff)}
.phone[data-s="elo"] .fh-step.now + .fh-step{border-top:0}
.phone[data-s="elo"] .fh-step.now .si{background:#fff}
.phone[data-s="elo"] .fh-stat{position:relative;border:0;border-radius:18px;padding:14px;background:linear-gradient(160deg,color-mix(in srgb,var(--c) 15%,#fff),color-mix(in srgb,var(--c) 5%,#fff))}
.phone[data-s="elo"] .fh-stat .ti{display:block;position:absolute;right:10px;top:10px}
.phone[data-s="elo"] .fh-stat .ti svg.ic{width:34px;height:34px;filter:drop-shadow(0 5px 6px rgba(15,30,51,.25))}
.phone[data-s="elo"] .fh-stat .k svg.ic{display:none}
.phone[data-s="elo"] .fh-stat .k{font-weight:650;color:color-mix(in srgb,var(--c) 55%,var(--ink))}
.phone[data-s="elo"] .fh-stat .n{font-family:var(--disp);font-size:28px;font-weight:800;letter-spacing:-1px;margin-top:10px}
.phone[data-s="elo"] .fh-stat .bar{height:8px;border-radius:4px;background:rgba(255,255,255,.75)}
.phone[data-s="elo"] .fh-stat .bar b{border-radius:4px;box-shadow:0 0 10px -2px var(--c)}
.phone[data-s="elo"] .fh-h h2{font-family:var(--disp);font-size:18px;font-weight:700;letter-spacing:-.4px}
.phone[data-s="elo"] .fh-h .tile{width:40px;height:40px;border-radius:13px;background:color-mix(in srgb,var(--dom) 10%,#fff)}
.phone[data-s="elo"] .fh-h .tile svg.ic.td{width:28px;height:28px;filter:drop-shadow(0 4px 5px rgba(15,30,51,.22))}
.phone[data-s="elo"] .fh-facts{border:0;background:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(15,30,51,.06)}
.phone[data-s="elo"] .fh-facts b{font-family:var(--disp);font-size:22px;font-weight:800}
.phone[data-s="elo"] .fh-chips span{border:0;background:rgba(255,255,255,.8);box-shadow:inset 0 0 0 1px rgba(15,30,51,.06)}
.phone[data-s="elo"] .fh-pair button{border:0;background:var(--page);font-family:var(--disp);font-size:15px}
.phone[data-s="elo"] .fh-pair button svg.ic.td{width:36px;height:36px;filter:drop-shadow(0 5px 6px rgba(15,30,51,.25))}
.phone[data-s="elo"] .ds button{border:0;box-shadow:0 4px 10px -8px rgba(15,30,51,.4)}
.phone[data-s="elo"] .ds button.on{background:var(--dom);box-shadow:0 10px 18px -10px var(--dom)}
.phone[data-s="elo"] .ds b{font-family:var(--disp);font-size:17px;font-weight:700}
.phone[data-s="elo"] .csepp .val b{font-family:var(--disp);font-weight:800}
.phone[data-s="elo"] .fh-nav{left:10px;right:10px;bottom:10px;padding:6px;border:0;border-radius:26px;background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);box-shadow:0 18px 34px -16px rgba(15,30,51,.45),inset 0 0 0 1px rgba(15,30,51,.06)}
.phone[data-s="elo"] .fh-nav button{border-radius:20px;padding:7px 0 6px;font-weight:600}
.phone[data-s="elo"] .fh-nav button svg.ic.td{width:28px;height:28px;filter:grayscale(.7) opacity(.6)}
.phone[data-s="elo"] .fh-nav button.on svg.ic.td{filter:drop-shadow(0 5px 6px color-mix(in srgb,var(--c) 55%,transparent))}
.phone[data-s="elo"] .fh-nav button.on{background:color-mix(in srgb,var(--c) 13%,#fff)}
.phone[data-s="elo"] .toast{bottom:104px}

/* ── kit additions: sub-pages, rows, segmented control, forms, foot bar, sheets ── */
.fh-hero:has(.fh-art) .lbl,.fh-hero:has(.fh-art) .verdict{padding-right:92px}
.fh-hrow{flex-wrap:wrap}.fh-hrow>div{min-width:150px}
.fh-title h1.sm{font-size:24px!important;letter-spacing:-.6px!important}
.fh-back{font-size:24px;line-height:1;font-weight:500;padding-bottom:3px}
.fh-top.sub{padding-bottom:12px}
.fh-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-top:1px solid var(--hair);width:100%;text-align:left}
.fh-row:first-of-type{border-top:0;padding-top:0}.fh-row:last-of-type{padding-bottom:0}
.fh-h + .fh-row{border-top:0;padding-top:0}
.fh-row .si{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:var(--page);flex:0 0 auto}
.fh-row .si svg.ic{width:28px;height:28px;filter:drop-shadow(0 4px 5px rgba(15,30,51,.22))}
.fh-row .g{flex:1;min-width:0}
.fh-row strong{display:block;font-size:14.5px;font-weight:600}
.fh-row small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px;line-height:1.35}
.fh-row .v{font-family:var(--disp);font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.fh-row .v small{display:inline;font-family:var(--ff);font-weight:500;margin-left:2px}
.fh-row .chev{width:18px;height:18px;color:var(--faint);flex:0 0 auto}
.fh-row .bar{width:72px;height:6px;border-radius:3px;flex:0 0 auto}
.fh-seg{display:flex;gap:3px;padding:3px;border-radius:13px;background:var(--page);margin:0 0 12px}
.fh-seg button{flex:1;padding:8px 6px;border-radius:10px;font-size:13px;font-weight:600;color:var(--sub);text-align:center;white-space:nowrap}
.fh-seg button.on{background:#fff;color:var(--ink);box-shadow:0 2px 6px -2px rgba(15,30,51,.25)}
.fh-pills{display:flex;gap:6px;flex-wrap:wrap}
.fh-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;font-size:13px;font-weight:600;color:var(--ink);background:var(--page)}
.fh-pill.on{color:#fff;background:var(--dom)}
.fh-pill svg.ic{width:18px;height:18px}
.fh-in{display:block;width:100%;padding:12px 14px;border-radius:13px;border:1px solid var(--hair);background:#fff;font:inherit;font-size:15px;color:var(--ink)}
.fh-in::placeholder{color:var(--faint)}
.fh-lab{display:block;font-size:12.5px;font-weight:650;color:var(--sub);margin:14px 0 6px}
.fh-big{font-family:var(--disp);font-size:40px;font-weight:800;letter-spacing:-1.6px;line-height:1;font-variant-numeric:tabular-nums}
.fh-big small{font-family:var(--ff);font-size:14px;font-weight:500;letter-spacing:0;color:var(--sub);margin-left:6px}
.fh-foot{position:absolute;left:10px;right:10px;bottom:86px;z-index:28;display:flex;gap:8px;align-items:center;padding:10px;border-radius:20px;background:rgba(255,255,255,.9);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);box-shadow:0 18px 34px -16px rgba(15,30,51,.45),inset 0 0 0 1px rgba(15,30,51,.06)}
.fh-foot.nonav{bottom:12px}
.fh-empty{padding:26px 10px;text-align:center;color:var(--sub);font-size:14px;line-height:1.5;border:1.5px dashed var(--hair);border-radius:18px}
.fh-empty svg.ic{width:44px;height:44px;margin:0 auto 10px;display:block}
.fh-chart{display:block;width:100%;height:auto;overflow:visible}
.fh-ring{position:relative;width:var(--s,96px);height:var(--s,96px);flex:0 0 auto}
.fh-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.fh-ring circle{fill:none;stroke-width:9}
.fh-ring .t{stroke:rgba(15,30,51,.08)}
.fh-ring .p{stroke:var(--c,var(--dom));stroke-linecap:round}
.fh-ring .c{position:absolute;inset:0;display:grid;place-items:center;text-align:center}
.fh-ring .c b{font-family:var(--disp);font-size:calc(var(--s,96px)*.28);font-weight:800;letter-spacing:-.04em;line-height:1}
.fh-ring .c small{display:block;font-size:10.5px;font-weight:600;color:var(--sub);margin-top:2px}
.fh-msg{display:flex;gap:10px;align-items:flex-start}
.fh-msg .who{flex:0 0 auto}
.fh-msg .b{flex:1;min-width:0}
.fh-msg .b .nm{font-size:12.5px;font-weight:700}
.fh-msg .b .nm small{font-weight:500;color:var(--sub);margin-left:6px}
.phone[data-v="feher"] .sheet{background:#fff;border-radius:26px 26px 0 0;border-top:0;box-shadow:0 -24px 50px -20px rgba(15,30,51,.4);z-index:70;padding:8px 18px calc(22px + env(safe-area-inset-bottom,0px))}
.phone[data-v="feher"] .sheet h2{font-family:var(--disp);font-size:22px;font-weight:800;letter-spacing:-.6px;margin-bottom:10px}
.phone[data-v="feher"] .scrim{background:rgba(15,30,51,.35);z-index:65}
.phone[data-v="feher"] .fh-nav.hide{display:none}
.phone[data-v="feher"] .fh-step button.g,.phone[data-v="feher"] button.fh-row{cursor:pointer}
`);
window.FREG=window.FREG||{};
const chev=()=>I('i-chev','chev');
const A=o=>o?Object.entries(o).map(([k,v])=>v===true?` ${k}`:v==null||v===false?'':` ${k}="${String(v).replace(/"/g,'&quot;')}"`).join(''):'';
/* act(o): turns {go,sheet,arg,toast,dom,back} into data-attributes */
const act=o=>{if(!o)return'';if(typeof o==='string')return ` data-go="${o}"`;return A({'data-go':o.go,'data-sheet':o.sheet,'data-arg':o.arg,'data-toast':o.toast,'data-dom':o.dom,'data-back':o.back})};
function top(d,o){const reg=FREG[d]||{tabs:[]};
  return `<header class="fh-top ${o.back?'sub':''}"><div class="fh-trow">${o.back?`<button class="fh-ib fh-back" data-go="${o.back}" aria-label="Vissza">‹</button>`:''}
    <div class="fh-title"><small><i></i>${o.sub||''}</small><h1 class="${o.back?'sm':''}">${o.title}</h1></div>
    ${o.back?'':`<button class="fh-ib" data-toast="Keresés az egész appban: étel, edzés, bejegyzés, beállítás" aria-label="Keresés">${SEARCH}</button>`}
    <button class="fh-ib" data-toast="Értesítések" aria-label="Értesítések">${I('c-i-ertesites')}<b>3</b></button>
    ${o.back?'':`<button class="fh-ib" data-toast="Beállítások és profil" aria-label="Beállítások">${I('c-i-beallitas')}</button>`}</div>
    ${o.back?'':`<nav class="fh-tabs">${reg.tabs.map(([l,r])=>`<button class="${r===o.tab?'on':''}" data-go="${r}">${l}</button>`).join('')}</nav>`}</header>`}
const nav=d=>`<nav class="fh-nav">${DOM.map(([k,l,ic,c])=>`<button class="${k===d?'on':''}" style="--c:${c}" data-dom="${k}">${I(ic)}<span>${l}</span></button>`).join('')}</nav>`;
/* page(domain, {title, sub, tab | back}, innerHtml, {foot, nonav, pad}) */
function page(d,o,inner,x={}){
  return `<div class="scroll" ${x.pad?`style="padding-bottom:${x.pad}"`:x.foot?'style="padding-bottom:190px"':''}>${top(d,o)}${inner}</div>${x.foot?`<div class="fh-foot ${x.nonav?'nonav':''}">${x.foot}</div>`:''}${x.nonav?'':nav(d)}<div class="toast" id="toast"></div><div class="sheet" id="sheet"></div><div class="scrim" id="scrim"></div>`}
const sec=(n,t,i=1)=>`<p class="fh-n rise" style="--i:${i}">${n?`<b>${n}</b>`:''}${t}</p>`;
const card=(inner,{cls='',i=1,style=''}={})=>`<section class="fh-card ${cls} rise" style="--i:${i};${style}">${inner}</section>`;
const head=(icon,t,link='',linkAct=null)=>`<div class="fh-h">${icon?`<span class="tile">${I(icon)}</span>`:''}<h2>${t}</h2>${link?`<button${act(linkAct||{toast:link})}>${link} ›</button>`:''}</div>`;
/* hero({lbl, verdict, sub, left, art, acts, warn, big}) — the ONE thing to look at; max one (two with a warn hero) per screen */
const hero=(o,i=0)=>`<section class="fh-card fh-hero ${o.warn?'warn':''} rise" style="--i:${i}">${o.art?`<span class="fh-art">${I(o.art)}</span>`:''}
  ${o.left?`<div class="fh-hrow">${o.left}<div style="flex:1;min-width:0">`:''}<span class="lbl">${o.lbl||''}</span><p class="verdict" ${o.big?'style="font-size:28px"':''}>${o.verdict}</p>${o.sub?`<p class="sub">${o.sub}</p>`:''}${o.left?`</div></div>`:''}
  ${o.body||''}${o.acts?`<div class="fh-acts">${o.acts}</div>`:''}</section>`;
const btn=(l,a,cls='')=>`<button class="btn ${cls}"${act(a)}>${l}</button>`;
const lk=(l,a)=>`<button class="fh-lk"${act(a)}>${l}</button>`;
/* step({time, icon, title, sub, right, now, on}) — a row with a time; use for "Most következik" and timelines */
const step=o=>`<div class="fh-step ${o.now?'now':''}"${o.right?'':act(o.on)}>${o.time!=null?`<time>${o.time}</time>`:''}${o.icon?`<span class="si">${I(o.icon)}</span>`:''}<span class="g"><strong>${o.title}</strong>${o.sub?`<small>${o.sub}</small>`:''}</span>${o.right||(o.on?chev():'')}</div>`;
/* row({icon, left, title, sub, v, right, on}) — a list row without a time; opens a sub-page/sheet when `on` is set */
const row=o=>`<${o.on?'button':'div'} class="fh-row"${act(o.on)}>${o.left||''}${o.icon?`<span class="si">${I(o.icon)}</span>`:''}<span class="g"><strong>${o.title}</strong>${o.sub?`<small>${o.sub}</small>`:''}</span>${o.v!=null?`<span class="v">${o.v}</span>`:''}${o.right||''}${o.on&&!o.right?chev():''}</${o.on?'button':'div'}>`;
const bar=(pct,c='var(--dom)')=>`<div class="bar" style="--c:${c}"><b style="--w:${Math.max(0,Math.min(100,pct))}%"></b></div>`;
/* stat({k, icon, n, unit, pct, s, sCls, c, on}) — one number tile; put 2 or 4 of them in grid() */
const stat=o=>`<button class="fh-stat" style="--c:${o.c||'var(--dom)'}"${act(o.on)}>${o.icon?`<span class="ti">${I(o.icon)}</span>`:''}<span class="k">${o.k}</span><div class="n">${o.n}${o.unit?`<small>${o.unit}</small>`:''}</div>${o.pct!=null?`<div class="bar"><b style="--w:${Math.max(0,Math.min(100,o.pct))}%"></b></div>`:''}${o.s?`<span class="s ${o.sCls||''}">${o.s}</span>`:''}</button>`;
const grid=items=>`<div class="fh-grid">${items.join('')}</div>`;
const facts=a=>`<div class="fh-facts" style="grid-template-columns:repeat(${a.length},1fr)">${a.map(([b,s])=>`<div><b>${b}</b><small>${s}</small></div>`).join('')}</div>`;
/* seg([[label, action, on]]) — a segmented control inside a card */
const seg=a=>`<div class="fh-seg">${a.map(([l,x,on])=>`<button class="${on?'on':''}"${act(x)}>${l}</button>`).join('')}</div>`;
const pills=a=>`<div class="fh-pills">${a.map(([l,x,on,ic])=>`<button class="fh-pill ${on?'on':''}"${act(x)}>${ic?I(ic):''}${l}</button>`).join('')}</div>`;
const st=(l,k='q')=>`<span class="st ${k}">${l}</span>`;
const ring=(pct,{s=96,c='var(--dom)',val=null,label=''}={})=>{const r=40,C=2*Math.PI*r;return `<div class="fh-ring" style="--s:${s}px;--c:${c}"><svg viewBox="0 0 100 100"><circle class="t" cx="50" cy="50" r="${r}"/><circle class="p" cx="50" cy="50" r="${r}" stroke-dasharray="${C*Math.min(100,pct)/100} ${C}"/></svg><div class="c"><span><b>${val==null?pct+'%':val}</b>${label?`<small>${label}</small>`:''}</span></div></div>`};
const note=t=>`<p class="fh-note">${t}</p>`;
const txt=t=>`<p class="fh-txt">${t}</p>`;
const empty=(icon,t,a='')=>`<div class="fh-empty">${icon?I(icon):''}${t}${a?`<div class="fh-acts" style="justify-content:center">${a}</div>`:''}</div>`;
/* the team: sibling forms of the csepp — the form is the sender, the text is the voice */
const TEAM={szunya:['Szunya','alvás','#AB9FD2','pebble',62],mocor:['Mocor','mozgás','#5B9BD5','bean',48],falat:['Falat','étel','#6FB08A','drop',70],deru:['Derű','kedv','#D9A94E','leaf',55],mezo:['Mezo','összkép','#8C97A8','crystal',64]};
const who=(k,s=36)=>{const t=TEAM[k]||TEAM.mezo;return csepp('ok',t[4],{s,form:t[3],color:t[2],alive:false})};
const msg=(k,text,meta='')=>{const t=TEAM[k]||TEAM.mezo;return `<div class="fh-msg"><span class="who">${who(k)}</span><div class="b"><span class="nm">${t[0]}<small>${meta||t[1]}</small></span><p class="fh-txt" style="margin-top:2px">${text}</p></div></div>`};
function register(d,def){FREG[d]=def;if(def.css)css(def.css)}
window.F={I,csepp,mchp,muscleColor,css,esc,page,sec,card,head,hero,btn,lk,step,row,bar,stat,grid,facts,seg,pills,st,ring,note,txt,empty,TEAM,who,msg,chev,act,register,
  go:(...a)=>K.go(...a),toast:(...a)=>K.toast(...a),openSheet:(...a)=>K.openSheet(...a),closeSheet:(...a)=>K.closeSheet(...a),get R(){return K.R},get ARG(){return K.ARG},get D(){return K.D}};
window.FNOTES_ELO=`<h2>Világos · élő</h2><p>Minden oldal ugyanúgy épül fel: fent a terület neve és a fülek, alatta egy színes fő kártya az állapottal és egy gombbal, aztán számozott szakaszok fehér kártyákban. Alul mindig az öt terület.</p>`;
})();
