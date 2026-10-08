/* vilagos/foly.js — "Folyadék": the owner's chosen identity (2026-10-08), applied to the whole kit.
   Everything is a level that fills: heroes are vessels with liquid, number tiles are levels,
   time-ordered rows sit on a stream, the five domains are drops. Loaded last; active when the
   shell sets window.FH_FOLY and the phone has class "foly". */
(function(){
const {page}=F;
const Q='.phone.foly[data-s="elo"]';
const WAVE=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 13' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q11.25 0 22.5 7 T45 7 T67.5 7 T90 7 V13 H0Z'/%3E%3C/svg%3E")`;
const mask=(sz='90px 13px')=>`-webkit-mask:${WAVE} repeat-x 0 0/${sz};mask:${WAVE} repeat-x 0 0/${sz}`;
F.css(`
${Q}{--liq1:var(--dom2);--liq2:var(--dom);--page:#EEF5F9;--ink:#0A2A3C;--sub:#4E6B7A;--faint:#8AA0AC;box-shadow:0 40px 90px -30px rgba(10,42,60,.45),0 0 0 10px #fff,0 0 0 11px rgba(10,42,60,.1)}
${Q}[data-d="nap"]{--dom:#1877F2;--dom2:#19C7C0}
${Q}[data-d="edzes"]{--dom:#F2683A;--dom2:#F7B23B}
${Q}[data-d="fuel"]{--dom:#149E6E;--dom2:#8FD14F}
${Q}[data-d="mezo"]{--dom:#6B4FE0;--dom2:#E06BB5}
${Q}[data-d="en"]{--dom:#0E94B8;--dom2:#46D3B3}
${Q} .scroll{background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 5%,#FBFDFE),color-mix(in srgb,var(--dom) 12%,#EAF2F6));padding-bottom:118px}
/* title + tabs */
${Q} .fh-top{background:color-mix(in srgb,#F8FCFD 78%,transparent);border-bottom:0;padding:18px 18px 0}
${Q} .fh-top.sub{padding-bottom:12px}
${Q} .fh-title small{color:var(--sub);font-weight:600}
${Q} .fh-title small i{background:linear-gradient(160deg,var(--liq1),var(--liq2));border-radius:50% 50% 50% 50%/62% 62% 38% 38%;width:8px;height:10px}
${Q} .fh-ib{width:42px;height:42px;border-radius:50%;background:#fff;box-shadow:0 6px 14px -8px rgba(10,42,60,.4)}
${Q} .fh-ib b{background:var(--liq2);box-shadow:0 0 0 2px #F8FCFD}
${Q} .fh-tabs{gap:6px;margin:14px -2px 0;padding-bottom:10px}
${Q} .fh-tabs button{padding:8px 14px;border-radius:999px;border-bottom:0;font-weight:600;font-size:13.5px}
${Q} .fh-tabs button.on{color:#fff;font-weight:700;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 8px 16px -8px var(--liq2)}
/* section labels: a drop badge */
${Q} .fh-n{font-size:20px;font-weight:800;letter-spacing:-.6px;margin:26px 18px 0}
${Q} .fh-n b{width:22px;height:26px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:linear-gradient(160deg,var(--liq1),var(--liq2));box-shadow:0 8px 12px -6px var(--liq2);font-size:12px}
/* cards */
${Q} .fh-card{border-radius:30px;box-shadow:0 14px 26px -18px color-mix(in srgb,var(--dom) 50%,rgba(10,42,60,.55)),0 2px 4px -2px rgba(10,42,60,.06)}
/* hero = a vessel; its action row is the liquid */
${Q} .fh-hero{position:relative;border-radius:40px;padding:22px 20px 0;overflow:hidden;background:linear-gradient(180deg,#fff,#F4FAFC);box-shadow:inset 0 0 0 2px rgba(10,42,60,.06),inset 0 8px 20px -10px rgba(10,42,60,.10),0 30px 50px -30px var(--liq2)}
${Q} .fh-hero.warn{--liq1:#F6CB5A;--liq2:#E9892B;background:linear-gradient(180deg,#fff,#FFF8EA)}
${Q} .fh-hero .lbl{color:var(--sub)}
${Q} .fh-hero.warn .lbl{color:#9A6708}
${Q} .fh-hero>.fh-acts{position:relative;margin:22px -20px 0;padding:26px 20px 20px;background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${Q} .fh-hero>.fh-acts::before{content:'';position:absolute;left:0;right:0;top:-12px;height:13px;background:var(--liq1);${mask()}}
${Q} .fh-hero>.fh-acts::after{content:'';position:absolute;left:0;right:0;top:-17px;height:18px;background:var(--liq1);opacity:.45;${mask('130px 18px')}}
${Q} .fh-hero:not(:has(>.fh-acts))::after{content:'';display:block;height:34px;margin:20px -20px 0;background:linear-gradient(180deg,var(--liq1),var(--liq2))}
${Q} .fh-hero:not(:has(>.fh-acts))::before{content:'';position:absolute;z-index:1;left:0;right:0;bottom:33px;height:13px;background:var(--liq1);${mask()}}
${Q} .fh-hero>.fh-acts .btn{background:#fff;color:var(--ink);border-radius:999px;box-shadow:0 12px 22px -12px rgba(10,42,60,.6)}
${Q} .fh-hero>.fh-acts .btn.ghost{background:rgba(255,255,255,.2);color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.65)}
${Q} .fh-hero>.fh-acts .fh-lk,${Q} .fh-hero>.fh-acts>button:not(.btn),${Q} .fh-hero>.fh-acts>a{color:#fff;font-weight:700}
${Q} .fh-hero .fh-facts,${Q} .fh-hero .fh-chips span{background:#fff}
/* buttons, pills */
${Q} .btn{border-radius:999px;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 10px 20px -10px var(--liq2)}
${Q} .btn.ghost{background:#fff;color:var(--ink);box-shadow:0 4px 10px -6px rgba(10,42,60,.3),inset 0 0 0 1px rgba(10,42,60,.08)}
${Q} .btn.sm{border-radius:999px}
${Q} .fh-pill.on,${Q} .fh-seg button.on{color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 8px 14px -8px var(--liq2)}
${Q} .fh-seg{border-radius:999px;padding:4px}${Q} .fh-seg button{border-radius:999px}
${Q} .fh-lk{color:color-mix(in srgb,var(--dom) 85%,var(--ink))}
/* number tiles = levels */
${Q} .fh-stat{position:relative;overflow:hidden;isolation:isolate;border-radius:26px;min-height:132px;background:linear-gradient(180deg,#fff,#F4FAFC);box-shadow:inset 0 0 0 2px rgba(10,42,60,.06),0 14px 22px -18px var(--c)}
${Q} .fh-stat::before{content:'';position:absolute;z-index:-1;left:0;right:0;bottom:0;height:var(--p,0%);background:linear-gradient(180deg,color-mix(in srgb,var(--c) 36%,#fff),color-mix(in srgb,var(--c) 58%,#fff))}
${Q} .fh-stat::after{content:'';position:absolute;z-index:-1;left:0;right:0;bottom:calc(var(--p,0%) - 1px);height:9px;background:color-mix(in srgb,var(--c) 36%,#fff);${mask('60px 9px')}}
${Q} .fh-stat:not([style*="--p"])::after{display:none}
${Q} .fh-stat .bar{display:none}
${Q} .fh-stat .k{color:var(--ink)}
${Q} .fh-stat .s,${Q} .fh-stat .s.ok,${Q} .fh-stat .s.warn{display:block;margin-top:8px;color:var(--ink);font-weight:600;opacity:.8}
/* time-ordered rows sit on a stream */
${Q} .fh-card:has(>.fh-step){position:relative;padding-left:40px}
${Q} .fh-card:has(>.fh-step)::before{content:'';position:absolute;left:20px;top:28px;bottom:28px;width:4px;border-radius:2px;background:linear-gradient(180deg,var(--liq1),color-mix(in srgb,var(--liq2) 22%,transparent))}
${Q} .fh-step{position:relative;border-top:0;padding:10px 0}
${Q} .fh-step::before{content:'';position:absolute;left:-28px;top:50%;width:16px;height:18px;margin-top:-9px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:#fff;box-shadow:inset 0 0 0 4px color-mix(in srgb,var(--liq2) 32%,transparent)}
${Q} .fh-step.now{margin:0 -6px 6px -2px;padding:12px;border-radius:24px;border-top:0;color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 16px 24px -16px var(--liq2)}
${Q} .fh-step.now::before{left:-26px;background:var(--liq1);box-shadow:0 0 0 5px color-mix(in srgb,var(--liq1) 28%,transparent)}
${Q} .fh-step.now time,${Q} .fh-step.now strong{color:#fff}
${Q} .fh-step.now small{color:rgba(255,255,255,.85)}
${Q} .fh-step.now .si{background:rgba(255,255,255,.92)}
${Q} .fh-step.now .btn{background:#fff;color:var(--ink);box-shadow:none}
${Q} .fh-step.now .chev{color:#fff}
${Q} .fh-step .si,${Q} .fh-row .si{border-radius:50%}
${Q} .bar{border-radius:999px}${Q} .bar b{border-radius:999px}
${Q} .fh-facts{border-radius:20px}
${Q} .fh-empty{border-radius:26px}
/* bottom bar: five drops */
${Q} .fh-nav{border-radius:30px;padding:8px 6px 6px}
${Q} .fh-nav button{gap:3px;padding:0;font-weight:600}
${Q} .fh-nav button.on{background:none;color:var(--ink);font-weight:800}
${Q} .fh-nav .csepp .body{filter:none}
${Q} .fh-foot{border-radius:28px}
${Q} .sheet{border-radius:36px 36px 0 0}
${Q} .ds button{border-radius:999px}
@media (prefers-reduced-motion:no-preference){
  body:not(.still) ${Q} .fh-hero>.fh-acts::before{animation:fw 5s linear infinite}
  body:not(.still) ${Q} .fh-hero>.fh-acts::after{animation:fw2 8s linear infinite}
  body:not(.still) ${Q} .fh-stat::before{animation:flv 1.2s cubic-bezier(.2,.8,.2,1) both .15s}
}
@keyframes fw{to{-webkit-mask-position:90px 0;mask-position:90px 0}}
@keyframes fw2{to{-webkit-mask-position:-130px 0;mask-position:-130px 0}}
@keyframes flv{from{height:0}}
`);
/* Nap · Mai is the approved concept screen itself (tank · levels · stream), on the real chrome */
const nap=FREG.nap, mai0=nap&&nap.routes.mai;
if(mai0) nap.routes.mai=a=>(window.FH_FOLY&&!a&&window.K2INNER)?page('nap',{title:'Ma',sub:'Szerda, október 7.',tab:'mai'},K2INNER()):mai0(a);
window.FNOTES_FOLY=`<h2>Folyadék</h2><p>A választott irány az egész appon. Minden egy szint, ami töltődik:</p><ul><li><b>A fő kártya egy edény</b>, az alján hullámzó folyadék, benne a fő gomb. A terület színében.</li><li><b>A szám-csempék szintek:</b> a háttérben annyira van feltöltve, amennyire a célhoz állsz.</li><li><b>Az időrendi teendők egy folyam mentén</b> sorakoznak, a soron következő van megtöltve.</li><li><b>Alul az öt terület öt csepp</b>, a szakaszok száma is csepp-jelvény.</li></ul><p>A Nap főoldala a jóváhagyott koncepció képernyője. A többi oldal ugyanebből a készletből öltözött át, ezeket most nézzük át együtt.</p>`;
})();
