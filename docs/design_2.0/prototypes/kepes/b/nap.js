/* Nap domain — the Lágy look (owner OK 2026-11-06, mezo-pi0jf). Tabs: Mai · A napom · Beszélgetés · Rutin.
   Mai states (reggel, napközben, este, lezárt, üres, kímélő), the day review, the companion thread, the
   habit chains, check-in, életjelek, quests, quick log, the six-act napzárás and the routine builder.
   Content mirrors the real Nap records (today.md, needs.md, habit.md, ritual.md); invented, real-looking. */
(()=>{
Object.assign(SH,{
  heart:(u,h)=>`<path d="M32 54C14 42 8 32 8 23a12 12 0 0 1 24-3 12 12 0 0 1 24 3c0 9-6 19-24 31z" fill="url(#${u})"/><path d="M18 20c2-3 5-4 8-3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8" fill="none"/>`,
  home:(u,h)=>`<path d="M10 30L32 10l22 20v22a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="url(#${u})"/><rect x="26" y="38" width="12" height="18" rx="3" fill="#fff" opacity=".9"/><path d="M20 30l6-5" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
  pen:(u,h)=>`<path d="M44 8l12 12-28 28-14 4 4-14z" fill="url(#${u})"/><path d="M40 12l12 12" stroke="#fff" stroke-width="3" opacity=".8"/><path d="M14 56h36" stroke="url(#${u})" stroke-width="4" stroke-linecap="round" opacity=".5"/>`,
  chat:(u,h)=>`<path d="M10 16a8 8 0 0 1 8-8h28a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H28l-12 10v-10h0a8 8 0 0 1-6-8z" fill="url(#${u})"/><circle cx="24" cy="26" r="3" fill="#fff"/><circle cx="32" cy="26" r="3" fill="#fff"/><circle cx="40" cy="26" r="3" fill="#fff"/>`,
  thumb:(u,h)=>`<rect x="8" y="28" width="12" height="26" rx="4" fill="url(#${u})"/><path d="M24 28h4l8-18c5 0 8 4 7 9l-2 9h11a5 5 0 0 1 5 6l-4 16a6 6 0 0 1-6 4H24z" fill="url(#${u})"/><path d="M30 34v14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
  thumbd:(u,h)=>`<g transform="rotate(180 32 32)"><rect x="8" y="28" width="12" height="26" rx="4" fill="url(#${u})"/><path d="M24 28h4l8-18c5 0 8 4 7 9l-2 9h11a5 5 0 0 1 5 6l-4 16a6 6 0 0 1-6 4H24z" fill="url(#${u})"/></g>`,
  link:(u,h)=>`<rect x="6" y="22" width="26" height="20" rx="10" fill="none" stroke="url(#${u})" stroke-width="6"/><rect x="32" y="22" width="26" height="20" rx="10" fill="none" stroke="url(#${u})" stroke-width="6"/><path d="M24 32h16" stroke="url(#${u})" stroke-width="6" stroke-linecap="round"/>`
});
document.head.insertAdjacentHTML('beforeend',`<style>
/* ── Nap ── */
.nplv{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:16px 12px 14px}
.nplv button{border:0;background:none;padding:0;display:grid;justify-items:center;gap:5px;text-align:center;color:var(--ink);min-height:40px}
.nplv .tb{position:relative;width:26px;height:72px;border-radius:999px;background:rgba(30,35,33,.07);overflow:hidden}
.nplv .tb i{position:absolute;left:0;right:0;bottom:0;height:var(--h);border-radius:999px 999px 0 0;background:linear-gradient(180deg,var(--sage2),var(--sage));transition:height 1.1s cubic-bezier(.2,.8,.2,1)}
.nplv .low .tb i{background:linear-gradient(180deg,var(--peach2),var(--peach))}.nplv .full .tb i{background:linear-gradient(180deg,#6FB893,var(--deep))}
.nplv b{font:600 14px var(--d);font-variant-numeric:tabular-nums}.nplv small{font:700 12px var(--b);color:var(--ink2)}
.pre .nplv .tb i,.nplv.pre .tb i{height:0}
.npsig .bars{gap:9px}.npsig .br{grid-template-columns:auto 1fr auto}.npsig .br span{display:flex;gap:6px;align-items:center}.npsig .br span .g{font-size:16px}
.npnext{display:grid;gap:10px}
.npnext .dl .stk img{width:44px;height:44px;border-radius:50%;object-fit:cover}
.npobs{padding:16px 18px;display:grid;gap:12px}
.npobs p{margin:0;font:600 15px/1.4 var(--d);letter-spacing:-.01em}.npobs p em{font-style:normal;color:var(--deep)}
.npev{display:flex;gap:6px;align-items:center}.npev i{width:22px;height:22px;border-radius:50%;background:rgba(30,35,33,.08);display:block}.npev i.h{background:var(--sage)}.npev i.m{background:var(--peach2);box-shadow:inset 0 0 0 2px var(--peach)}.npev small{margin-left:6px;font:700 12px var(--b);color:var(--ink2)}
.npans{display:flex;flex-wrap:wrap;gap:8px}.npans button{min-height:40px;padding:0 14px;border-radius:999px;border:0;background:var(--paper);font:700 13px var(--b);color:var(--ink)}.npans button.on{background:var(--ink);color:#fff}
.npdone{display:flex;gap:8px;align-items:center;font:700 13px var(--b);color:var(--deep)}.npdone .g{font-size:20px}
.nplog{padding:6px 16px}
.nplog li{display:grid;grid-template-columns:44px 40px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);list-style:none}
.nplog li:first-child{border-top:0}.nplog{margin:0}
.nplog time{font:700 13px var(--d);color:var(--ink2);font-variant-numeric:tabular-nums}
.nplog img,.nplog .gi{width:40px;height:40px;border-radius:50%;object-fit:cover}.nplog .gi{display:grid;place-items:center;background:var(--paper)}.nplog .gi .g{font-size:22px}
.nplog b{display:block;font:600 14px var(--d)}.nplog small{font:700 12px var(--b);color:var(--ink2)}
.npempty{display:grid;justify-items:center;gap:10px;text-align:center;padding:22px 18px}.npempty img{width:72px;height:72px;border-radius:50%;object-fit:cover}.npempty b{font:600 16px var(--d)}.npempty p{margin:0;font:600 13.5px/1.4 var(--b);color:var(--ink2)}
.npkm{padding:16px;display:grid;gap:12px}.npkm .acts{margin:0}
.npweek{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:14px 10px 12px}
.npweek button{border:0;background:none;padding:4px 0;border-radius:16px;display:grid;justify-items:center;gap:5px;color:var(--ink);min-height:40px}
.npweek button.on{background:var(--sage3)}.npweek button[disabled]{opacity:.45}
.npweek .tb{position:relative;width:22px;height:54px;border-radius:999px;background:rgba(30,35,33,.07);overflow:hidden}
.npweek .tb i{position:absolute;left:0;right:0;bottom:0;height:var(--h);background:linear-gradient(180deg,var(--sage2),var(--sage));border-radius:999px 999px 0 0}
.npweek .live .tb i{background:repeating-linear-gradient(135deg,var(--sage2) 0 5px,var(--sage3) 5px 10px)}
.npweek b{font:700 12px var(--b)}.npweek small{font:700 12px var(--d);color:var(--ink2)}
.nparea{padding:6px 16px}
.nparea>div{border-top:1px solid var(--line);padding:12px 0}.nparea>div:first-child{border-top:0}
.nparea .ah{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;border:0;background:none;padding:0;text-align:left;color:var(--ink);min-height:40px}
.nparea .ah .g{font-size:28px}.nparea .ah b{display:block;font:600 14px var(--d)}.nparea .ah small{font:700 12px var(--b);color:var(--ink2)}
.nparea .ah .v{font:600 15px var(--d);font-variant-numeric:tabular-nums;text-align:right}
.nparea u{display:block;height:6px;border-radius:3px;background:rgba(30,35,33,.08);overflow:hidden;margin:8px 0 0 48px;text-decoration:none}.nparea u i{display:block;height:100%;width:var(--w);background:var(--sage);border-radius:3px}
.nparea .ad{margin:10px 0 0 48px;display:grid;gap:8px}.nparea .ad p{margin:0;font:600 13px/1.4 var(--b);color:var(--ink2)}
.nparea>div.shut .ad{display:none}
.npvs{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px}
.npvs>div{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:end}
.npvs .tb{position:relative;width:30px;height:84px;border-radius:999px;background:rgba(30,35,33,.08);overflow:hidden}.npvs .tb i{position:absolute;left:0;right:0;bottom:0;height:var(--h);background:linear-gradient(180deg,var(--sage2),var(--sage))}
.npvs .me .tb i{background:linear-gradient(180deg,#FDE6A6,#E9B44C)}
.npvs b{display:block;font:700 22px var(--d)}.npvs small{font:700 12px var(--b);color:var(--ink2)}
.npvs p{grid-column:1/-1;margin:0;font:600 13px/1.4 var(--b);color:var(--ink2)}
.nphl{display:grid;gap:8px;margin:2px 0 4px}.nphl span{display:flex;gap:8px;align-items:flex-start;font:600 13.5px/1.35 var(--b)}.nphl .g{font-size:18px;flex:0 0 auto}
.npthumb{display:flex;gap:8px}.npthumb button{min-height:40px;min-width:48px;border-radius:999px;border:0;background:#fff;font:700 13px var(--b);color:var(--ink)}.npthumb button.on{background:var(--ink);color:#fff}
.npseg{display:flex;gap:4px;margin:0 16px;padding:4px;border-radius:999px;background:#fff;box-shadow:var(--sh)}
.npseg button{flex:1;min-height:42px;border:0;border-radius:999px;background:none;font:700 13px var(--b);color:var(--ink2);display:flex;align-items:center;justify-content:center;gap:6px}
.npseg button.on{background:var(--ink);color:#fff}.npseg i{width:8px;height:8px;border-radius:50%;background:var(--peach)}
.npmsg{padding:16px;display:grid;gap:10px}
.npmsg .who{display:flex;align-items:center;gap:8px}.npmsg .who .bd{width:34px;height:34px;border-radius:50%;background:var(--paper);display:grid;place-items:center}.npmsg .who .bd .g{font-size:20px}
.npmsg .who b{font:700 14px var(--d)}.npmsg .who small{margin-left:auto;font:700 12px var(--b);color:var(--ink2)}
.npmsg .new{box-shadow:0 0 0 2px var(--peach)}
.npmsg p{margin:0;font:600 15px/1.42 var(--d);letter-spacing:-.01em}.npmsg p em{font-style:normal;color:var(--deep)}
.npmsg details summary{list-style:none;cursor:pointer;font:700 13px var(--b);color:var(--deep);min-height:40px;display:flex;align-items:center;gap:6px}.npmsg details summary::-webkit-details-marker{display:none}
.npmsg details ul{margin:0;padding:0 0 4px 0;display:grid;gap:6px}.npmsg details li{list-style:none;display:flex;gap:8px;font:600 13px/1.35 var(--b);color:var(--ink2)}.npmsg details li::before{content:"";flex:0 0 8px;height:8px;border-radius:50%;background:var(--sage2);margin-top:5px}
.npmsg .npfbk{display:flex;gap:8px;flex-wrap:wrap}.npmsg .npfbk button{min-height:40px;padding:0 14px;border-radius:999px;border:0;background:var(--paper);font:700 13px var(--b);color:var(--ink)}
.npmsg .npfbk button.on{background:var(--sage3);color:var(--deep)}
.npmsg .act{justify-self:start}
.npold .row{grid-template-columns:36px minmax(0,1fr) auto}.npold .row.open small{white-space:normal}.npold .row small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.npcomp{display:flex;gap:8px;margin:18px 16px 0;padding:6px;border-radius:999px;background:#fff;box-shadow:0 14px 30px -14px rgba(0,0,0,.35)}
.npcomp input{flex:1;min-width:0;border:0;outline:none;background:none;font:600 14px var(--b);padding:0 12px;color:var(--ink)}
.npcomp button{width:44px;height:44px;border-radius:50%;border:0;background:var(--sage3);display:grid;place-items:center}.npcomp button.s{background:var(--ink)}.npcomp .g{font-size:20px}
.npobs .st{justify-self:start}
.npchain{display:flex;align-items:center;gap:0;padding:16px 14px;overflow-x:auto;scrollbar-width:none}
.npchain::-webkit-scrollbar{display:none}
.npchain button{flex:0 0 auto;border:0;background:none;padding:0;display:grid;justify-items:center;gap:6px;width:64px;color:var(--ink)}
.npchain button img{width:48px;height:48px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px #fff,0 0 0 5px rgba(30,35,33,.1)}
.npchain button.d img{box-shadow:0 0 0 3px #fff,0 0 0 5px var(--sage)}.npchain button.npn img{box-shadow:0 0 0 3px #fff,0 0 0 5px var(--peach)}
.npchain button.f img{filter:grayscale(.7);opacity:.7}
.npchain small{font:700 12px var(--b);color:var(--ink2);text-align:center;line-height:1.2}
.npchain i{flex:0 0 14px;height:3px;border-radius:2px;background:rgba(30,35,33,.12);margin-bottom:26px}.npchain i.d{background:var(--sage)}
.nphab .row{grid-template-columns:44px minmax(0,1fr) auto}
.nphab .tick{width:40px;height:40px;border-radius:50%;border:2px solid rgba(30,35,33,.18);background:#fff;display:grid;place-items:center;padding:0}
.nphab .tick.on{background:var(--sage);border-color:var(--sage)}.nphab .tick svg{width:20px;height:20px}
.nphab .row .now{display:inline-flex;margin-left:6px;vertical-align:middle}
.nphab .str{display:grid;justify-items:end;gap:4px;font:600 13px var(--d)}.nphab .str u{width:52px;height:5px;border-radius:3px;background:var(--paper);display:block;overflow:hidden;text-decoration:none}.nphab .str u i{display:block;height:100%;width:var(--w);background:var(--sage)}
.nphab .row.dn b{color:var(--ink2)}
.npdp{display:flex;gap:6px;margin:0 16px}.npdp button{flex:1;min-height:44px;border-radius:16px;border:0;background:#fff;box-shadow:var(--sh);font:700 13px var(--b);color:var(--ink2);display:grid;justify-items:center;align-content:center;gap:2px}
.npdp button.on{background:var(--ink);color:#fff}.npdp small{font:700 12px var(--b);opacity:.8}
.npdays{display:flex;justify-content:space-between;margin:12px 16px 0}.npdays button{min-height:40px;border:0;background:none;font:700 13px var(--b);color:var(--deep);display:flex;align-items:center;gap:4px}.npdays .g{font-size:14px}
.nphr{display:flex;gap:8px;align-items:center}
.nphb{position:relative;width:40px;height:40px;border-radius:50%;border:0;display:grid;place-items:center;background:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.28)}
.nphb .g{font-size:20px}.nphb i{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border-radius:10px;background:#E8835A;color:#fff;font:800 12px/20px var(--b);font-style:normal;text-align:center}
.seg .npbd{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:4px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:#E8835A;color:#fff;font:800 12px/18px var(--b);font-style:normal;vertical-align:1px}
.seg .npdot{display:inline-block;width:7px;height:7px;margin-left:5px;border-radius:50%;background:#F4C860;vertical-align:2px}
.npmorn{display:flex;gap:12px;align-items:center;padding:14px 16px}.npmorn .g{font-size:30px}.npmorn b{display:block;font:600 15px var(--d)}.npmorn small{font:700 12px var(--b);color:var(--ink2)}
.npsk{display:block;border-radius:14px;background:linear-gradient(90deg,rgba(30,35,33,.06),rgba(30,35,33,.11),rgba(30,35,33,.06));background-size:200% 100%;animation:npsk 1.3s linear infinite}
@keyframes npsk{to{background-position:-200% 0}}body.still .npsk{animation:none}@media (prefers-reduced-motion:reduce){.npsk{animation:none}}
.nperr{display:grid;justify-items:start;gap:10px;padding:16px 18px}.nperr b{font:600 15px var(--d)}.nperr p{margin:0;font:600 13px/1.4 var(--b);color:var(--ink2)}
.npft{display:flex;align-items:center;gap:8px}
.npft .npwhyb{min-height:40px;border:0;background:none;padding:0;font:700 13px var(--b);color:var(--deep);display:flex;align-items:center;gap:4px}.npft .npwhyb .g{font-size:14px;transition:transform .2s}.npft .npwhyb[aria-expanded="true"] .g{transform:rotate(90deg)}
.npft .rx{margin-left:auto;display:flex;gap:6px;align-items:center}
.nprb{width:40px;height:40px;border-radius:50%;border:0;background:var(--paper);display:grid;place-items:center}.nprb .g{font-size:20px}
.nprx{font:700 12.5px var(--b);color:var(--deep);display:flex;align-items:center;gap:4px}.nprx .g{font-size:16px}
.npwy{display:grid;gap:8px;padding:10px 12px;border-radius:16px;background:var(--paper)}.npwy ul{margin:0;padding:0;display:grid;gap:6px}.npwy li{list-style:none;display:flex;gap:8px;font:600 13px/1.35 var(--b);color:var(--ink2)}.npwy li::before{content:"";flex:0 0 8px;height:8px;border-radius:50%;background:var(--sage2);margin-top:5px}
.npwhyr{display:flex;flex-wrap:wrap;gap:6px}.npwhyr button{min-height:40px;padding:0 12px;border-radius:999px;border:0;background:var(--paper);font:700 12.5px var(--b);color:var(--ink)}
.npcompw{position:sticky;bottom:-22px;z-index:3;margin-top:8px;padding:14px 0 4px;background:linear-gradient(180deg,rgba(246,244,239,0),var(--paper) 40%)}
.npcompw .npcomp{margin:0 16px}
.nphab .tick.lock{border-style:dashed}.nphab .tick.lock.on{border-style:solid;opacity:.75}
.nphab .src{display:inline-flex;margin-left:6px;vertical-align:middle;background:var(--sky);background:#E4F0F8;color:#3E6E90;box-shadow:none}
.npbody{display:flex;justify-content:center;padding:4px 0}.npbody svg{width:100%;max-width:300px;height:auto}.npbody g[data-ckreg]{cursor:pointer}
.npnot .row{grid-template-columns:44px minmax(0,1fr) auto}.npnot img{width:44px;height:44px;border-radius:50%;object-fit:cover}.npnot .new b::after{content:"";display:inline-block;width:8px;height:8px;margin-left:6px;border-radius:50%;background:#E8835A;vertical-align:1px}
.w320 .nplv .tb{height:60px}.w320 .nphr{gap:6px}.w320 .npweek{gap:2px;padding:12px 6px}.w320 .npchain button{width:58px}
</style>`);

/* ── data: today is csütörtök, szeptember 24., 14:10 ── */
const NAPTABS=[['Mai','nap'],['A napom','nap-napom'],['Beszélgetés','nap-beszelgetes'],['Rutin','nap-rutin']];
const NB={notif:3,unread:2};
const AVB='<button class="av" data-toast="Profil — az Én területen" aria-label="Profil">P</button>';
const napHead=(tab,o,morning)=>{let h=phead(tab,{...o,tabs:morning?[['Mai','nap-mai-reggel'],['A napom','nap-napom-reggel'],['Beszélgetés','nap-beszelgetes'],['Rutin','nap-rutin-reggel']]:NAPTABS});
  h=h.replace(AVB,`<span class="nphr"><button class="nphb" data-go="nap-gyors" aria-label="Gyors logolás">${G('plus','cream')}</button><button class="nphb" data-sheet="napNotif" aria-label="Értesítések${NB.notif?', '+NB.notif+' új':''}">${G('bell','cream')}${NB.notif?`<i>${NB.notif}</i>`:''}</button>${AVB}</span>`);
  if(NB.unread&&tab!=='Beszélgetés')h=h.replace(/>Beszélgetés<\/button>/,`>Beszélgetés<i class="npbd" aria-label="${NB.unread} új">${NB.unread}</i></button>`);
  if(morning)h=h.replace(/>A napom<\/button>/,'>A napom<i class="npdot" aria-label="tegnapi nap vár"></i></button>');
  return h};
const SIGS=[['Étel','bowl','sage',78],['Víz','drop','sky',55],['Alvás','moon','sky',82],['Mozgás','shoe','peach',34],['Kapcsolat','heart','berry',70],['Rend','home','sun',66]];
const sigAvg=()=>Math.round(SIGS.reduce((a,s)=>a+s[3],0)/SIGS.length);
const LOG=[['13:00','csirke','Ebéd','Csirkés tál · 760 kalória'],['11:20','drop','Víz','500 ml · ma 1,4 liter'],['10:05','check','Check-in','Energia 7 · fókusz 6 · térd 2'],['08:10','scale','Súly','82,4 kg · a trend lefelé megy'],['07:30','omlett','Reggeli','Tojásrántotta · 318 kalória'],['06:40','nap-ebredes','Ébredés','7 óra 16 perc alvás']];
const STATESN=[['','Napközben (alap)'],['hiba','Betöltési hiba'],['reggel','Reggel'],['este','Este · napzárás'],['lezart','Lezárt nap'],['ures','Üres nap'],['kimelo','Kímélő mód']];
const ck=()=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
const gi=(ic,pal)=>`<span class="gi">${G(ic,pal)}</span>`;
const isPh=s=>!SH[s];
const tubes=(L,cls='')=>`<div class="nplv ${cls}">${L.map(([l,v,h,st,at])=>`<button class="${st||''}" ${at||''}><span class="tb"><i style="--h:${h}%"></i></span><b>${v}</b><small>${l}</small></button>`).join('')}</div>`;
const sigCard=(link=true)=>`<div class="card gy g1 deep pre npsig ${link?'tap':''}" ${link?'role="button" tabindex="0" data-go="nap-eletjel"':''}>${ring({d:104,sw:10,p:sigAvg()/100,c:'#A8D5BA',val:sigAvg(),unit:'a 100-ból'})}<div class="bars">${SIGS.map(([l,ic,pal,v])=>`<div class="br"><span>${G(ic,pal)}${l}</span><b>${v}<small> %</small></b><u><i style="--w:${v}%;background:${v<40?'#F0B48C':'#A8D5BA'}"></i></u></div>`).join('')}</div></div>`;
const NOBS={ack:''};
const obsCard=()=>`<div class="card npobs" id="npobs"><span class="chip warm st">${G('moon','sky')}Gyűlik · 4 nap a 7-ből</span><p>Amikor <em>23 óra után</em> fekszel le, másnap kevesebbet mozogsz, átlagosan 2 400 lépéssel.</p><div class="npev">${['h','h','m','h','','h',''].map(c=>`<i class="${c}"></i>`).join('')}<small>az elmúlt hét éjszaka</small></div>${NOBS.ack?`<div class="npdone">${G('check','sage')}Köszönöm, ${NOBS.ack.toLowerCase()} · figyelem tovább</div>`:`<div class="npans">${['Igaz','Nem rólam szól','Majd meglátjuk'].map(a=>`<button data-npobs="${a}">${a}</button>`).join('')}</div>`}<button class="pill soft" data-sheet="napObs" style="justify-self:start">Miből látod?</button></div>`;
const logList=(L=LOG)=>L.length?`<ol class="card nplog">${L.map(([t,p,b,s])=>`<li class="sw" data-swipe><div class="rc2" data-nplp="${b}|${p}|${t}"><time>${t}</time>${isPh(p)?`<img src="${PH(p+'-sq.jpg')}" alt="">`:gi(p,p==='drop'?'sky':p==='check'?'sage':'deep')}<div><b>${b}</b><small>${s}</small></div><span></span></div><div class="acts2"><button ${logEdit(b)}>Szerkesztem</button><button class="del" data-delrow>Törlöm</button></div></li>`).join('')}</ol>`:`<div class="card npempty"><img src="${PH('kave-sq.jpg')}" alt=""><b>Még nincs bejegyzés</b><p>Az első étkezés, a víz vagy egy check-in ide kerül.</p></div>`;
const logEdit=b=>/Víz/.test(b)?'data-sheet="napWater"':/Súly/.test(b)?'data-sheet="napWeight"':/Check-in/.test(b)?'data-sheet="napCheckin"':/Ébredés/.test(b)?'data-sheet="napSleep"':/Tea|Pull Day/.test(b)?'data-sheet="napAct"':'data-go=""';
const moreRows=()=>`<div class="card pad">${[['bowl','sage','A napod üzemanyaga','2 060 kalória · 148 g fehérje','data-sheet="napFuel"'],['star','sun','Napi küldetések','1 kész a 3-ból · +20 XP','data-go="nap-kuldetesek"'],['spark','deep','Összes észrevétel','1 vár rád','data-go="nap-beszelgetes-eszrevetelek"'],['chat','sky','Valami nem stimmel ma?','a csapat utánanéz','data-sheet="napAsk"'],['dots','ink','Több','aktivitás, napló, gyors logolás','data-sheet="napTobb"']].map(([ic,pal,b,s,a])=>`<div class="row tap" role="button" tabindex="0" ${a}>${G(ic,pal)}<div><b>${b}</b><small>${s}</small></div>${G('chev','ink','chev')}</div>`).join('')}</div>`;

/* ── Mai ── */
function mai(st=''){const er=st==='hiba';if(er)st='';
  const errC=(t)=>`<div class="card nperr">${G('repeat','peach')}<b>${t}</b><p>A kapcsolat akadozik. Az adataid megvannak, csak most nem érem el őket.</p><button class="pill soft" data-go="nap">Újra</button></div>`;
  const H={'':{ph:'taj.jpg',eb:'Most jön · délutáni check-in · 14:00',title:'Hogy telik a délután?',sub:'Négy koppintás, nagyjából fél perc.',btn:`${G('check','ink')}Kitöltöm`,at:'data-sheet="napCheckin"',
      h1:'Jól halad a nap. <em>Fehérjéből 18 g</em> hiányzik, az edzés még hátravan.',lead:'A mozgás a leggyengébb életjel: a 17:30-as Pull Day ezt egyben rendbe teszi.'},
    reggel:{ph:'reggelfeny.jpg',eb:'Jó reggelt · csütörtök, 06:50',title:'Kezdjük a napot',sub:'Reggeli check-in, öt kérdés.',btn:`${G('sun','ink')}Kitöltöm`,at:'data-sheet="napCheckin"',
      h1:'Jól aludtál: <em>7 óra 16 perc</em>. A reggeli lánc 3 / 9-nél tart.',lead:'Ma Pull Day és este röpi. Reggelire fehérje kell.'},
    este:{ph:'nap-alkony.jpg',eb:'Este · napzárás · 20:40',title:'Tegyük le a napot',sub:'3 / 6 terület kész · edzés 1 / 1 · check-in 3 / 4',btn:`${G('moon','ink')}Napzárás indítása`,at:'data-go="nap-zaras-1"',
      h1:'Megvolt az edzés, <em>a vacsora még hiányzik</em>. Utána jöhet a napzárás.',lead:'Négy perc az egész, a végén látod a nap termését.'},
    lezart:{ph:'nap-ej.jpg',eb:'Lezárva · 21:52',title:'Letetted a napot',sub:'87 pont · a hét legjobb napja',btn:`${G('book','ink')}A napom`,at:'data-go="nap-napom-24"',
      h1:'Szép nap volt. <em>87 pont</em>, a hét legjobbja.',lead:'Reggel visszanézheted, mi vitte. 22:30 villanyoltás.'},
    ures:{ph:'kave.jpg',eb:'Csütörtök · 09:15',title:'Még üres a napod',sub:'Az első bejegyzéssel indul minden szám.',btn:`${G('plus','ink')}Gyors logolás`,at:'data-go="nap-gyors"',
      h1:'Még nincs adat mára. <em>Egy check-in</em> vagy egy étkezés elindítja.',lead:'Az életjelek ilyenkor a tegnapi szintről indulnak.'},
    kimelo:{ph:'nap-tea.jpg',eb:'Kímélő mód · beteg vagyok · 2. nap',title:'Hogy vagy ma?',sub:'Becslés: 2–3 nap · az edzések kimaradnak',btn:`${G('heart','ink')}Jobban vagyok`,at:'data-sheet="napKmWelcome"',
      h1:'Ma <em>a pihenés a dolgod</em>. Minden más megvár.',lead:'Igyál sokat, a kalóriacél ma szünetel. Az edzésterv tolódik, semmi nem vész el.'}}[st];
  const km=st==='kimelo',ev=st==='este',ur=st==='ures',lz=st==='lezart',rg=st==='reggel';
  const lv=ur?[['kalória','0','0','low','data-go=""'],['fehérje','0 g','0','low','data-go=""'],['alvás','–','0','low','data-sheet="napSleep"'],['mozgás','0 / 1','0','low','data-go="edzes"']]
    :[['kalória',km?'1 240':ev||lz?'2 690':rg?'0':'2 060',km?45:ev||lz?97:rg?2:74,'','data-go=""'],['fehérje',km?'70 g':ev||lz?'171 g':rg?'0 g':'148 g',km?42:ev||lz?100:rg?2:89,ev||lz?'full':'','data-go=""'],['alvás','7 óra 16',91,'','data-sheet="napSleep"'],['mozgás',km?'kimarad':ev||lz?'1 / 1':'0 / 1',km?0:ev||lz?100:6,km?'':ev||lz?'full':'low','data-go="edzes"']];
  const next=km?[['nap-tea','Pihenés és folyadék','egész nap · 2,5 liter','<span class="chip soft">ma ez a dolgod</span>','data-sheet="napWater"'],['edz-huzodzkodas','Pull Day','kimarad · hétfőre tolódik','<span class="chip">kímélő</span>','data-go="edzes"']]
    :ev?[['lazac','Vacsora · 19:30','lazac, rizs, brokkoli · 818 kalória','<span class="chip soft">még hiányzik</span>','data-go="log-vacsora"'],['nap-ej','Esti rutin','21:45 csend · 22:30 alvás','<span class="chip">2 / 5</span>','data-go="nap-rutin-este"']]
    :lz?[['nap-ej','Villanyoltás','22:30 · 8 óra alvás a cél','<span class="chip soft">kész a nap</span>','data-go="nap-rutin-este"']]
    :rg?[['nap-lista','Reggeli rutin','most jön: 50 fekvőtámasz','<span class="chip soft">3 / 9</span>','data-go="nap-rutin-reggel"'],['edz-huzodzkodas','Pull Day','17:30 · 64 perc','<span class="chip">ma</span>','data-go="edzes"']]
    :[['edz-huzodzkodas','Pull Day','17:30 · 64 perc · 16 szett','<span class="chip">edzés</span>','data-go="edzes"'],['edz-ropi-terem','Röplabda','18:00 · BVSC','<span class="chip">sport</span>','data-go="edzes-sport"']];
  const lg=ur?[]:km?[['10:20','drop','Víz','400 ml · ma 1,1 liter'],['09:00','check','Check-in','Energia 3 · torok fáj'],['08:30','nap-tea','Tea','mézzel · 40 kalória']]:rg?LOG.slice(-2):ev||lz?[['19:40','lazac','Vacsora','Lazac, rizs, brokkoli · 818 kalória'],['18:05','edz-huzodzkodas','Pull Day','16 szett · 2 rekord'],...LOG]:LOG;
  return `${napHead('Mai',{ph:H.ph,eb:H.eb,title:H.title,sub:H.sub,btn:H.btn,attrs:H.at},rg)}
  <h1 class="head rise" style="--i:1">${H.h1}</h1><p class="lead rise" style="--i:1">${H.lead}</p>
  ${km?`<section class="sec rise first" style="--i:2"><div class="card npkm t-peach"><div class="dlist one"><article class="dl" style="box-shadow:none;background:transparent;padding:0"><span class="stk"><img src="${PH('nap-tea-sq.jpg')}" alt=""></span><div class="dtx"><strong>Még nem vagyok jobban</strong><div class="chips"><span class="chip">holnap reggel újra kérdezem</span></div></div></article></div><div class="acts"><button class="pill soft" data-toast="Rendben: holnap reggel újra kérdezem">Még nem</button><button class="pill soft" data-sheet="napKmMistake">Tévedés volt</button></div></div></section>`:''}
  <section class="sec rise ${km?'':'first'}" style="--i:2"><div class="sh"><h3>${ur?'Az életjelek':'Ma eddig'}</h3><a href="#nap-eletjel">Életjelek ${G('chev')}</a></div>${er?errC('Az életjeleket most nem érem el'):sigCard()}</section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Mai szintek</h3></div><div class="card t-sky pre">${tubes(lv)}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Most következik</h3></div><div class="dlist one npnext">${next.map(([p,t,s,c,a])=>`<article class="dl tap" role="button" tabindex="0" ${a}><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${t}</strong><div class="chips">${c}<span class="chip">${s}</span></div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  ${ur||km?'':`<section class="sec rise" style="--i:5"><div class="sh"><h3>Észrevétel</h3><a href="#nap-beszelgetes-eszrevetelek">Mind ${G('chev')}</a></div>${obsCard()}</section>`}
  <section class="sec rise" style="--i:6"><div class="sh"><h3>Mai napló</h3><a href="#" data-sheet="napNaploPick">Új ${G('plus')}</a></div>${er?errC('A mai naplót most nem érem el'):logList(lg)}</section>
  <section class="sec rise" style="--i:7"><div class="sh"><h3>Továbbiak</h3></div>${moreRows()}${km?'':`<div class="dlist one" style="margin-top:12px"><article class="dl tap" role="button" tabindex="0" data-sheet="napKimelo"><span class="stk"><img src="${PH('nap-tea-sq.jpg')}" alt=""></span><div class="dtx"><strong>Nem vagyok jól</strong><div class="chips"><span class="chip">kímélő mód · az edzés tolódik</span></div></div>${G('chev','ink','chev')}</article></div>`}</section>
  ${mzCard(km?'Ha holnap reggel <em>láz nélkül</em> ébredsz, könnyű sétával kezdünk. A Pull Day hétfőn jön, fél terheléssel.':ev?'A vacsorán múlik a fehérje: <em>lazac rizzsel</em>, és a nap 100%-on zárul.':lz?'Holnap Push Day. Ha <em>22:30-kor</em> lefekszel, a nyolc óra is meglesz.':ur?'Kezdd <em>egy pohár vízzel</em> és a reggeli check-innel, onnan én viszem.':'A Pull Day előtt egy <em>túró áfonyával</em> hozza a hiányzó 18 g fehérjét, és nem leszel nehéz az edzésen.',`<button class="pill soft" data-toast="${km?'Rendben, reggel szólok':'Betervezve'}">${km?'Szólj reggel':'Betervezem'}</button>`)}</div>`}

/* ── A napom: the week strip, today live, a closed day as a magazine page, thin and future days ── */
const WEEK=[['H','21',null,'thin'],['K','22',87,'done'],['Sze','23',81,'done'],['Cs','24',null,'live'],['P','25',null,'fut'],['Szo','26',null,'fut'],['V','27',null,'fut']];
const AREAS=[['Tápanyag','bowl','sage',30,92,'2 690 / 2 782 kalória · 171 g fehérje','A fehérje este jött össze, a vacsora vitte.'],['Minőség','star','sun',15,84,'8,4 a 10-ből','Sok zöldség, kevés hozzáadott cukor.'],['Edzés','dumbbell','berry',20,100,'Pull Day · 16 / 16 szett · 2 rekord','A súlyozott húzódzkodás új csúcs lett.'],['Alvás','moon','sky',15,78,'7 óra 16 perc · cél 8 óra','A lefekvés 23:20 volt, fél órával a cél után.'],['Logolás','book','sage',10,90,'9 bejegyzés · 3 / 4 check-in','A délutáni check-in maradt ki.'],['Ritmus','clock','peach',10,70,'étkezések 3,5 óránként','Az ebéd és az uzsonna között öt óra telt el.']];
const LIVE=[['Tápanyag','bowl','sage','2 060 / 2 782','úton',74],['Minőség','star','sun','8,1','kész',81],['Edzés','dumbbell','berry','0 / 1 · 17:30','nyitva',0],['Alvás','moon','sky','7 óra 16','kész',91],['Logolás','book','sage','6 bejegyzés','úton',60],['Ritmus','clock','peach','3 étkezés','úton',55]];
const weekStrip=sel=>`<div class="card npweek rise" style="--i:2">${WEEK.map(([d,n,sc,st])=>`<button class="${st==='live'?'live':''} ${n===sel?'on':''}" ${st==='fut'?'disabled':`data-go="nap-napom${st==='live'?'':'-'+n}"`} aria-label="${d} ${n}.${sc?`, ${sc} pont`:''}"><b>${d}</b><span class="tb"><i style="--h:${st==='live'?60:sc||(st==='thin'?8:0)}%"></i></span><small>${sc||(st==='live'?'élő':st==='thin'?'–':n)}</small></button>`).join('')}</div>`;
const NV={open:{}};
function napom(d,morning){
  if(d==='betolt'||d==='hiba')return napState(d);
  if(d&&+d>=25)return `${ihead({ph:'reggelfeny.jpg',crumb:'Nap › A napom › <b>Szeptember '+d+'.</b>',eb:['Péntek','Szombat','Vasárnap'][+d-25]+' · szeptember '+d+'.',title:'Még előtted',sub:'Erre a napra még nincs pont, csak terv.'})}${weekStrip(d)}
    <section class="sec rise" style="--i:3"><div class="sh"><h3>Ami be van tervezve</h3></div><div class="dlist one">${(+d===25?[['edz-tarcsa','Push Day','17:30 · 15 szett'],['edz-palya','Piramis-intervallum','17:30 · 5 kör']]:+d===26?[['edz-ropi-blokk','Röplabda, meccs','10:00 · Kőbánya Sport']]:[['nap-seta','Pihenőnap','séta és nyújtás']]).map(([p,t,s])=>`<article class="dl fut"><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${t}</strong><div class="chips"><span class="chip">${s}</span></div></div></article>`).join('')}</div></section>
    ${mzCard('A pontot a nap végén számolom ki, <em>hat terület</em> alapján. Előre csak a tervet látod.')}</div>`;
  if(d==='21')return `${ihead({ph:'kod.jpg',crumb:'Nap › A napom › <b>Hétfő</b>',eb:'Hétfő · szeptember 21.',title:'Kevés az adat',sub:'Erre a napra nem adok pontot.'})}${weekStrip(d)}
    <h1 class="head rise" style="--i:2">Erre a napra <em>kevés az adat</em>: két bejegyzés és egy check-in.</h1>
    <section class="sec rise" style="--i:3"><div class="sh"><h3>Ami megvan</h3></div>${logList([['12:40','csirke','Ebéd','Csirkés tál · 720 kalória'],['08:00','check','Check-in','Energia 5 · fókusz 4']])}</section>
    ${mzCard('Ha egy napon <em>legalább három</em> terület kap adatot, pontot is adok. Utólag is pótolhatod.',`<button class="pill soft" data-sheet="napNaploPick">Pótolom</button>`)}</div>`;
  if(d){const sc=d==='22'?87:81,best=d==='22',shut=NV.open[d]||{};
    const morn=morning?`<section class="sec rise first" style="--i:2"><div class="card t-sun npmorn">${G('sun','sun')}<div><b>Jó reggelt! Ez a tegnapod.</b><small>Éjjel 3-kor zártam le · 81 pont</small></div></div></section>`:'';
    const headD=(morning?napHead('A napom',{ph:'nap-naplo.jpg',eb:'Szerda · szeptember 23. · tegnap',title:'Erős, kiegyensúlyozott nap',sub:'Az alvás húzta le egy kicsit.',btn:`${G('chev','ink')}Tovább a mai napra`,attrs:'data-go="nap-napom"'},true)+weekStrip(d)+morn:ihead({ph:'nap-naplo.jpg',crumb:'Nap › A napom › <b>'+(best?'Kedd':'Szerda')+'</b>',eb:(best?'Kedd · szeptember 22.':'Szerda · szeptember 23. · tegnap'),title:best?'A hét legjobb napja':'Erős, kiegyensúlyozott nap',sub:best?'Minden terület 70 fölött.':'Az alvás húzta le egy kicsit.',btn:`${G('chat','ink')}Beszélgess a napról`,attrs:'data-go="nap-beszelgetes"'})+weekStrip(d));
    return `${headD}
    <section class="sec rise ${morning?'':'first'}" style="--i:2"><div class="sh"><h3>A nap pontja</h3></div><div class="card gy g1 deep pre">${ring({d:104,sw:10,p:sc/100,c:'#F4C860',val:sc,unit:'a 100-ból'})}<div class="bars"><div class="br"><span>alap</span><b>${sc+2} <small>pont</small></b><u><i style="--w:${sc+2}%;background:#A8D5BA"></i></u></div><div class="br"><span>a Mezo szerint</span><b>−2 <small>pont</small></b><u><i style="--w:12%;background:#F0B48C"></i></u></div><p style="margin:2px 0 0;font:600 13px/1.4 var(--b);color:rgba(255,255,255,.85)">A késői lefekvés miatt vontam le kettőt: másnap ez a mozgáson látszik.</p></div></div></section>
    <section class="sec rise" style="--i:3"><div class="sh"><h3>Mezo a napodról</h3></div><div class="card npobs"><p>${best?'Ritkán jön össze ennyi egy napon: <em>két rekord</em> az edzésen, a fehérje megvolt, és a vacsora sem csúszott el.':'Jó nap volt, <em>az edzés és az étkezés</em> rendben. Az alvás fél órával rövidebb lett a célnál.'}</p><div class="nphl">${(best?[['medal','sun','Két rekord a Pull Dayen'],['bowl','sage','171 g fehérje, 103% a célból'],['heart','berry','Este röpi a csapattal']]:[['check','sage','Minden étkezés a kereten belül'],['moon','sky','7 óra 16 perc alvás'],['shoe','peach','8 200 lépés']]).map(([ic,pal,t])=>`<span>${G(ic,pal)}${t}</span>`).join('')}</div><div class="npthumb" id="npthumb"><button data-npthumb="1" aria-label="Talált">Talált</button><button data-npthumb="0" aria-label="Nem talált">Nem talált</button></div></div></section>
    <section class="sec rise" style="--i:4"><div class="sh"><h3>Miből jött össze</h3><span class="crumb">a súlya a pontban</span></div><div class="card nparea">${AREAS.map(([n,ic,pal,w,v,c,note],i)=>`<div class="${shut[i]?'shut':''}"><button class="ah" data-nparea="${d}|${i}" aria-expanded="${!shut[i]}">${G(ic,pal)}<div><b>${n}</b><small>${w}% súly</small></div><span class="v">${best?v:Math.max(55,v-[4,6,0,14,3,8][i])}</span></button><u><i style="--w:${best?v:Math.max(55,v-[4,6,0,14,3,8][i])}%"></i></u><div class="ad"><div class="chips"><span class="chip soft">${c}</span></div><p>${note}</p></div></div>`).join('')}</div></section>
    <section class="sec rise" style="--i:5"><div class="sh"><h3>A nap körülményei</h3><span class="chip">nem számít a pontba</span></div><div class="card trio t-sun">${[['bolt','sun','5,5','energia a 10-ből'],['scale','sage','82,3','kiló · a trend lefelé'],['drop','sky','2,1 l','víz']].map(([ic,pal,n,l])=>`<div>${G(ic,pal)}<b>${n}</b><small>${l}</small></div>`).join('')}</div></section>
    ${morning?`<div class="acts rise" style="--i:6"><button class="pill" data-go="nap-napom">Tovább a mai napra ${G('chev','cream')}</button></div>`:''}${mzCard(best?'Ezt a napot érdemes megismételni: <em>korai vacsora, este sport</em>. Jövő kedden ugyanígy tervezem.':'Holnap feküdj le <em>23 óra előtt</em>, és a pont is visszajön a 85 fölé.',`<button class="pill soft" data-toast="${best?'Betervezve jövő keddre':'Emlékeztető 22:30-ra beállítva'}">${best?'Így tervezd':'Emlékeztess'}</button>`)}</div>`}
  /* today, live */
  return `${napHead('A napom',{ph:'kave.jpg',eb:'Ma · élő · 14:20',title:'3 / 6 terület kész',sub:'Napközben nincs pont, csak állapot. Este zárjuk.',btn:`${G('check','ink')}Check-in`,attrs:'data-sheet="napCheckin"',tabs:NAPTABS})}
  ${weekStrip('24')}
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Ma eddig · 6 terület</h3></div><div class="card gy g1 deep pre">${ring({d:104,sw:10,p:.5,c:'#A8D5BA',val:'3 / 6',unit:'terület kész'})}<div class="bars">${LIVE.map(([n,ic,pal,v,s,p])=>`<div class="br"><span>${n}</span><b>${v}</b><u><i style="--w:${p}%;background:${s==='kész'?'#A8D5BA':s==='úton'?'#F4C860':'rgba(255,255,255,.25)'}"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Most érdemes</h3></div><div class="dlist one"><article class="dl tap" role="button" tabindex="0" data-go="edzes"><span class="stk"><img src="${PH('edz-huzodzkodas-sq.jpg')}" alt=""></span><div class="dtx"><strong>Pull Day · 17:30</strong><div class="chips"><span class="chip soft">az edzés 20%-ot ér</span><span class="chip">64 perc</span></div></div>${G('chev','ink','chev')}</article></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>A napod · te és az app</h3></div><div class="card npvs t-sun"><div><span class="tb"><i style="--h:64%"></i></span><div><b>64</b><small>az app szerint · a 100-ból</small></div></div><div class="me"><span class="tb"><i style="--h:70%"></i></span><div><b>7</b><small>te mondtad · a 10-ből</small></div></div><p>Egyetértünk: jó a nap, de nem kiemelkedő.</p></div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Korábbi napok</h3></div><div class="dlist one">${[['23','Szerda',81,'nap-naplo'],['22','Kedd',87,'reggelfeny']].map(([n,dn,s,p])=>`<article class="dl tap" role="button" tabindex="0" data-go="nap-napom-${n}"><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${dn} · szeptember ${n}.</strong><div class="chips"><span class="chip warm">${G('star','sun')}${s} pont</span>${s===87?'<span class="chip soft">a hét legjobbja</span>':''}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  ${mzCard('Ha este <em>a vacsora is megvan</em> és lezárod a napot, 85 pont fölé várom.')}</div>`}

const napState=d=>`${napHead('A napom',{ph:'kave.jpg',eb:'Ma · élő',title:d==='hiba'?'Most nem érem el a napod':'Összeszedem…',sub:d==='hiba'?'Az adataid megvannak, csak a kapcsolat akadozik.':'Pár másodperc, és itt a napod.',btn:d==='hiba'?`${G('repeat','ink')}Próbáld újra`:'',attrs:'data-go="nap-napom"'})}
  ${weekStrip('24')}
  ${d==='hiba'?`<section class="sec rise first" style="--i:2"><div class="card nperr">${G('repeat','peach')}<b>Nem sikerült betölteni</b><p>Próbáld újra pár másodperc múlva. Ha nem megy, a tegnapi napot addig is megnézheted.</p><div class="acts" style="margin:0"><button class="pill" data-go="nap-napom">Próbáld újra</button><button class="pill soft" data-go="nap-napom-23">A tegnapom</button></div></div></section>`
  :`<section class="sec rise first" style="--i:2" aria-busy="true"><div class="card" style="padding:16px;display:grid;grid-template-columns:104px 1fr;gap:16px;align-items:center"><span class="npsk" style="width:104px;height:104px;border-radius:50%"></span><div style="display:grid;gap:12px">${'<span class="npsk" style="height:14px"></span>'.repeat(5)}</div></div></section><section class="sec rise" style="--i:3"><div style="display:grid;gap:10px">${'<span class="npsk" style="height:70px;border-radius:22px"></span>'.repeat(3)}</div></section>`}</div>`;
/* ── Beszélgetés: Üzenetek · Életjelek · Észrevételek ── */
const TEAM={'Alvás':['moon','sky'],'Mozgás':['shoe','peach'],'Étkezés':['bowl','sage'],'Közérzet':['heart','berry'],'Mezo':['spark','deep']};
const MSGS=[{id:'m1',who:'Étkezés',t:'13:10',nw:1,txt:'Az ebéd jó volt, de <em>18 g fehérje</em> még hiányzik. Egy túró az edzés előtt pont elég.',on:['ebéd · 760 kalória','fehérje 148 / 166 g'],why:['Ebédig 148 g fehérje jött össze.','Az edzés 17:30-kor kezdődik, előtte két órával érdemes enni.'],act:'Szólj 15:30-kor'},
  {id:'m2',who:'Alvás',t:'07:05',nw:1,txt:'7 óra 16 percet aludtál, de <em>23:20-kor</em> feküdtél le. Ma este próbáljuk 22:45-öt.',on:['alvás 7 óra 16 perc','lefekvés 23:20'],why:['A heti átlag lefekvés 23:05.','A korai lefekvésű napokon több a lépésed.'],act:'Emlékeztess 22:30-kor'},
  {id:'m3',who:'Mozgás',t:'tegnap',txt:'A tegnapi röpi után a váll 6 / 10. A mai húzásnál a <em>negyedik szettet</em> kihagynám.',on:['röpi · 90 perc','váll 6 / 10'],why:['A röpi napján a váll terhelése nő.'],act:''},
  {id:'m4',who:'Közérzet',t:'tegnap',txt:'Három napja jó a kedved a délutáni check-inen. Ez a <em>korai ebéd</em> óta van így.',on:['check-in · kedv 7'],why:['Az ebéd 12:30 előtt volt mindhárom napon.'],act:''}];
const MS={fb:{},act:{},old:{},open:{}};
const msgCard=m=>{const [ic,pal]=TEAM[m.who],f=MS.fb[m.id],o=MS.open[m.id];return `<article class="card npmsg" id="msg-${m.id}"><div class="who"><span class="bd ${m.nw?'new':''}">${G(ic,pal)}</span><b>${m.who}</b><small>${m.t}${m.nw?' · új':''}</small></div><p>${m.txt}</p>${m.act?(MS.act[m.id]?`<div class="npdone">${G('check','sage')}Beállítva: ${m.act.toLowerCase()}</div>`:`<button class="pill soft act" data-npact="${m.id}">${G('clock','deep')}${m.act}</button>`):''}
  <div class="npft"><button class="npwhyb" data-npwhyo="${m.id}" aria-expanded="${!!o}">Miből gondolom ${G('chev','deep')}</button><span class="rx">${f==='ok'?`<span class="nprx">${G('thumb','sage')}Segített</span>`:f&&f!=='bad'?`<span class="nprx">Megjegyeztem: ${f}</span>`:f==='bad'?`<span class="nprx">Miért nem?</span>`:`<button class="nprb" data-npfb="${m.id}|ok" aria-label="Segített">${G('thumb','sage')}</button><button class="nprb" data-npfb="${m.id}|bad" aria-label="Nem talált">${G('thumbd','peach')}</button>`}</span></div>
  ${o?`<div class="npwy"><div class="chips">${m.on.map(c=>`<span class="chip soft">${c}</span>`).join('')}</div><ul>${m.why.map(w=>`<li>${w}</li>`).join('')}</ul></div>`:''}${f==='bad'?`<div class="npwhyr">${['pontatlan','túl sok','rossz időzítés','nem rólam szól'].map(r=>`<button data-npwhy="${m.id}|${r}">${r}</button>`).join('')}</div>`:''}</article>`};
const OLDM=[['Mezo','hétfő','A heti terv kész: öt edzés, két röpi. A Push Day csütörtökről péntekre került, mert csütörtökön meccs van.'],['Étkezés','hétfő','A hétvégén kétszer volt késő vacsora. Ezen a héten 20 óra előtt próbáljuk.'],['Alvás','vasárnap','A hét alvásátlaga 7 óra 2 perc, ez 18 perccel jobb a múlt hétnél.']];
const OBS=[['Gyűlik','Amikor 23 óra után fekszel le, másnap kevesebbet mozogsz.','moon','sky',['h','h','m','h','','h',''],'4 / 7'],['Figyelem','Edzésnapokon az uzsonna kimarad, és este többet eszel.','bowl','sage',['h','m','h','h','h','m','h'],'5 / 7']];
function besz(sub=''){const S=sub||'uzenetek';
  const seg=`<div class="npseg rise" style="--i:2" role="tablist">${[['uzenetek','Üzenetek',1],['eletjelek','Életjelek',0],['eszrevetelek','Észrevételek',1]].map(([k,l,dot])=>`<button role="tab" class="${S===k?'on':''}" ${S===k?'':`data-go="nap-beszelgetes${k==='uzenetek'?'':'-'+k}"`}>${l}${dot&&S!==k?'<i aria-label="új"></i>':''}</button>`).join('')}</div>`;
  const head=napHead('Beszélgetés',{ph:'nap-baratok.jpg',eb:'Mezo és a csapat · ma',title:S==='eletjelek'?'Hat életjel, egy gyenge':S==='eszrevetelek'?'Két észrevétel vár':'Kettő új üzenet vár',sub:S==='uzenetek'?'Négy üzenet ma, kettőt még nem olvastál.':S==='eletjelek'?'A mozgás 34%-on, a többi rendben.':'Ma még kettő fér a keretbe.',btn:`${G('chat','ink')}Írj Mezónak`,attrs:'data-sheet="napWrite"',tabs:NAPTABS});
  if(S==='eletjelek')return `${head}${seg}<h1 class="head rise" style="--i:2">Átlag <em>64</em>. A mozgás az egyetlen, ami ma figyelmet kér.</h1>
    <section class="sec rise first" style="--i:3"><div class="sh"><h3>Most</h3><a href="#nap-eletjel">Részletek ${G('chev')}</a></div>${sigCard()}</section>
    <section class="sec rise" style="--i:4"><div class="sh"><h3>Amit javaslok</h3></div><div class="dlist one">${[['edz-huzodzkodas','Mozgás · 34%','a Pull Day 17:30-kor visz 80 fölé','data-go="edzes"'],['viz','Víz · 55%','még egy liter estig','data-sheet="napWater"']].map(([p,t,s,a])=>`<article class="dl tap" role="button" tabindex="0" ${a}><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${t}</strong><div class="chips"><span class="chip warm">${s}</span></div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
    ${mzCard('Az életjelek <em>óránként fogynak</em>, és a logjaidból töltődnek. Nem kell külön pipálni semmit.')}</div>`;
  if(S==='eszrevetelek')return `${head}${seg}<h1 class="head rise" style="--i:2">Két mintát látok. <em>Egyiket sem</em> állítom biztosra.</h1>
    <section class="sec rise first" style="--i:3"><div class="card t-sky" style="padding:14px 16px;display:flex;gap:10px;align-items:center">${G('bell','sky')}<div><b style="font:600 14px var(--d)">Ma még 2 fér a keretbe</b><div class="chips" style="margin-top:6px"><span class="chip">22:00 után csendben maradok</span></div></div></div></section>
    ${OBS.map(([st,t,ic,pal,ev,n],i)=>`<section class="sec rise" style="--i:${4+i}"><div class="card npobs"><span class="chip ${st==='Figyelem'?'warm':'soft'} st">${G(ic,pal)}${st} · ${n}</span><p>${t}</p><div class="npev">${ev.map(c=>`<i class="${c}"></i>`).join('')}<small>az elmúlt hét nap</small></div><div class="npans" data-npobs2="${i}">${['Igaz','Nem rólam szól','Majd meglátjuk'].map(a=>`<button data-npo2="${i}|${a}">${a}</button>`).join('')}</div><button class="pill soft" data-sheet="napLab" data-arg="${i}" style="justify-self:start">${G('chart','deep')}Laborfüzet</button></div></section>`).join('')}
    ${mzCard('Egy mintát akkor mondok ki, ha <em>hét napból ötször</em> igaz. Addig csak figyelem.')}</div>`;
  return `${head}${seg}
  <section class="sec rise first" style="--i:3"><div class="dlist one"><article class="dl tap" role="button" tabindex="0" data-sheet="napTeam"><span class="stk"><img src="${PH('nap-baratok-sq.jpg')}" alt=""></span><div class="dtx"><strong>A csapat most erről beszél</strong><div class="chips"><span class="chip soft">${G('moon','sky')}Alvás</span><span class="chip soft">${G('shoe','peach')}Mozgás</span><span class="chip">a késői lefekvés</span></div></div>${G('chev','ink','chev')}</article></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Ma</h3></div><div style="display:grid;gap:12px">${MSGS.slice(0,2).map(msgCard).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Tegnap</h3></div><div style="display:grid;gap:12px">${MSGS.slice(2).map(msgCard).join('')}</div></section>
  <section class="sec rise" style="--i:6"><div class="sh"><h3>Korábbi üzenetek</h3></div><div class="card pad npold">${OLDM.map(([w,d,t],i)=>`<div class="row tap ${MS.old[i]?'open':''}" role="button" tabindex="0" data-npold="${i}">${G(...TEAM[w])}<div><b>${w} · ${d}</b><small>${t}</small></div>${G('chev','ink','chev')}</div>`).join('')}</div></section>
  <div class="npcompw"><div class="npcomp"><input placeholder="Írj vissza Mezónak…" aria-label="Írj vissza Mezónak"><button aria-label="Diktálás" data-toast="Hallgatlak…">${G('mic','sage')}</button><button class="s" aria-label="Küldés" data-npsend>${G('chev','cream')}</button></div></div>
  ${mzCard('Ha egy üzenet <em>nem talált</em>, mondd meg miért: a következőnél már figyelembe veszem.')}</div>`}

/* ── Rutin: the chains of the day ── */
const HAB={reggel:[['Ébredés időben','06:40','nap-ebredes','a riasztó után',1,92,'Ébredés','az alvásodból'],['Mai fókusz','06:45','nap-lista','az ébredés után',1,74,'Fókusz'],['Reggeli napfény','06:55','reggelfeny','a fókusz után',1,68,'Napfény'],['50 fekvőtámasz','07:05','edz-izom','a napfény után',0,61,'Fekvő'],['Reggeli videó','07:10','nap-naplo','a fekvőtámasz után',0,40,'Videó'],['Súlymérés','07:15','edz-sulyzo','zuhany előtt',0,88,'Súly','a mérlegről'],['Gombakávé','07:20','kave','a mérés után',0,83,'Kávé'],['Fehérjés reggeli','07:30','omlett','a kávé mellé',0,79,'Reggeli'],['Vitaminok','07:40','herbs','a reggeli után',0,72,'Vitamin']],
  napkozben:[['Ebéd utáni séta','13:30','nap-seta','az ebéd után',0,58,'Séta'],['Víz 2 liter','estig','viz','minden étkezéshez egy pohár',0,64,'Víz','a víz logjaidból'],['Képernyőszünet','15:00','nap-baratok','a délutáni check-in után',0,37,'Szünet']],
  este:[['Koffein-zárás','14:00','kave','14 óra után nincs kávé',1,81,'Koffein','a kávé logjaidból'],['Konyha zárva','20:00','lazac','a vacsora után',0,66,'Konyha'],['Szándékkal éltem?','21:30','nap-lista','a napzárásban',0,52,'Szándék'],['Napzárás','21:40','nap-alkony','vacsora után',0,70,'Zárás'],['Lecsendesítés','21:45','nap-ej','a napzárás után',0,48,'Csend']]};
const DPN={reggel:['Reggel','06:40–07:40'],napkozben:['Napközben','13:30–15:00'],este:['Este','20:00–22:30']};
const NSK={};const nowOf=dp=>HAB[dp].findIndex(h=>!h[4]&&!NSK[h[0]]);
function rutin(dp='napkozben',teg=false){const L=HAB[dp],done=L.filter(h=>h[4]).length,ni=nowOf(dp),n=L[ni];
  const hero=teg?{ph:'nap-lista.jpg',eb:'Tegnap · szerda',title:'Tegnap kimaradt: képernyőszünet',sub:'A reggeli lánc 9 / 9 volt: tökéletes reggel.',btn:`${G('back','ink')}Vissza mára`,at:'data-go="nap-rutin"'}
    :n?{ph:n[2]+'.jpg',eb:`${DPN[dp][0]}i lánc · ${done} / ${L.length} kész`,title:`Most jön: ${n[0].toLowerCase()}`,sub:n[7]?`magától pipálódik ${n[7]}`:`${n[3]} · ${n[1]}`,btn:n[7]?(/víz/.test(n[7])?`${G('drop','sky')}Víz +250 ml`:`${G('chev','ink')}A szokás`):`${G('check','ink')}Megvan, pipálom`,at:n[7]?(/víz/.test(n[7])?'data-sheet="napWater"':'data-go="nap-szokas"'):`data-nptick="${dp}|${ni}|hero"`}
    :{ph:'nap-alkony.jpg',eb:`${DPN[dp][0]}i lánc · kész`,title:'Tökéletes lánc',sub:`${L.length} / ${L.length} · +25 XP`,btn:`${G('star','ink')}A lánc ereje`,at:'data-go="nap-lanc"'};
  return `${napHead('Rutin',{ph:hero.ph,eb:hero.eb,title:hero.title,sub:hero.sub,btn:hero.btn,attrs:hero.at,tabs:NAPTABS})}
  <div class="npdp rise" style="--i:2">${Object.entries(DPN).map(([k,[l,t]])=>`<button class="${k===dp?'on':''}" ${k===dp?'':`data-go="nap-rutin-${k}"`}>${l}<small>${HAB[k].filter(h=>h[4]).length} / ${HAB[k].length}</small></button>`).join('')}</div>
  <section class="sec rise first" style="--i:3"><div class="sh"><h3>A lánc</h3><a href="#nap-rutin-epites">Szerkesztés ${G('chev')}</a></div><div class="card npchain">${L.map((h,i)=>`${i?`<i class="${h[4]&&L[i-1][4]?'d':''}"></i>`:''}<button class="${h[4]?'d':i===ni?'npn':'f'}" data-go="nap-szokas" aria-label="${h[0]}"><img src="${PH(h[2]+'-sq.jpg')}" alt=""><small>${h[6]}</small></button>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>${DPN[dp][0]} · ${DPN[dp][1]}</h3><a href="#${teg?'nap-rutin':'nap-rutin-tegnap'}">${teg?'Ma':'Tegnap'} ${G('chev')}</a></div><div class="card pad nphab" id="nphab">${L.map((h,i)=>habRow(dp,h,i,ni)).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>A lánc ereje</h3></div><div class="card trio t-sage">${[['star','sun','6 / 30','tökéletes reggel'],['link','deep','62%','lánc-erő · 28 nap'],['bolt','sun','+25 XP','ma eddig']].map(([ic,pal,v,l])=>`<div>${G(ic,pal)}<b>${v}</b><small>${l}</small></div>`).join('')}</div></section>
  ${mzCard(dp==='este'?'Ha a <em>lecsendesítés</em> 21:45-kor elindul, a 22:30-as villanyoltás magától jön.':dp==='reggel'?'A <em>reggeli videó</em> a leggyengébb láncszem: tegyük a kávé mellé, ott könnyebb.':'A <em>képernyőszünet</em> a leggyengébb: 37%. Kössük a délutáni check-inhez.',`<button class="pill soft" data-toast="Áthelyezve a lánc másik pontjára">Így legyen</button>`)}</div>`}
const habRow=(dp,h,i,ni)=>{const sk=NSK[h[0]];return `<div class="row sw ${h[4]?'dn':''} ${sk?'npsk2':''}" data-swipe><div class="rc2"><button class="tick ${h[4]?'on':''} ${h[7]?'lock':''}" data-nptick="${dp}|${i}" aria-label="${h[0]}: ${h[7]?(h[4]?'kész, az adataidból':'magától pipálódik'):h[4]?'kész':'pipálom'}">${h[4]?ck():''}</button><div><b>${h[0]}${i===ni?'<span class="chip soft now">most jön</span>':''}${h[7]?'<span class="chip src">adatból</span>':''}${sk?`<span class="chip warm now">ma kihagyva</span>`:''}</b><small>${sk?sk:`${h[1]} · ${h[3]}`}</small></div><span class="str">${h[5]}%<u><i style="--w:${h[5]}%"></i></u></span></div><div class="acts2">${sk?`<button data-npunskip="${h[0]}">Visszaveszem</button>`:h[4]?'':`<button data-nplater="${dp}|${i}">Később</button><button class="del" data-sheet="napSkip" data-arg="${h[0]}">Ma kihagyom</button>`}</div></div>`};

document.head.insertAdjacentHTML('beforeend',`<style>
/* check-in: the day as a line with four moments */
.npday{position:relative;padding:22px 18px 16px}
.npday .ln{position:relative;height:6px;border-radius:3px;background:rgba(30,35,33,.08);margin:34px 6px 30px}
.npday .ln i.f{position:absolute;left:0;top:0;bottom:0;width:var(--w);border-radius:3px;background:var(--sage)}
.npday .pt{position:absolute;top:50%;transform:translate(-50%,-50%);display:grid;justify-items:center}
.npday .pt b{position:absolute;bottom:22px;font:700 12px var(--d);white-space:nowrap}
.npday .pt span{width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px rgba(30,35,33,.15)}
.npday .pt.d span{background:var(--sage);box-shadow:0 0 0 3px var(--sage3)}.npday .pt.n span{background:var(--peach);box-shadow:0 0 0 5px var(--peach2)}
.npday .pt small{position:absolute;top:22px;font:700 12px var(--b);color:var(--ink2);white-space:nowrap}
.npday .now{position:absolute;top:-26px;transform:translateX(-50%);font:700 12px var(--b);color:var(--deep)}
.npcap{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.npcap span{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px 0 4px;border-radius:999px;background:var(--paper);font:700 12.5px var(--b)}
.npcap span u{display:block;width:22px;height:22px;border-radius:50%;background:conic-gradient(var(--sage) calc(var(--v)*10%),rgba(30,35,33,.08) 0);text-decoration:none;-webkit-mask:radial-gradient(circle,transparent 6px,#000 7px);mask:radial-gradient(circle,transparent 6px,#000 7px)}
/* életjelek: six big levels */
.npsix{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:18px 12px 14px;align-items:end}
.npsix button{border:0;background:none;padding:0;display:grid;justify-items:center;gap:6px;color:#fff;min-height:40px}
.npsix .tb{position:relative;width:100%;max-width:38px;height:130px;border-radius:16px;background:rgba(255,255,255,.12);overflow:hidden}
.npsix .tb i{position:absolute;left:0;right:0;bottom:0;height:var(--h);background:linear-gradient(180deg,#CFEBD9,#7CC39F);transition:height 1.1s cubic-bezier(.2,.8,.2,1)}
.npsix .low .tb i{background:linear-gradient(180deg,#FBE6D6,#F0B48C)}
.npsix .tb .g{position:absolute;left:50%;top:8px;transform:translateX(-50%);font-size:20px}
.npsix b{font:700 15px var(--d)}.npsix small{font:700 12px var(--b);opacity:.8}
.pre .npsix .tb i{height:0}
/* quests */
.npq{display:grid;gap:12px}
.npq article{display:grid;grid-template-columns:96px minmax(0,1fr);gap:0;border-radius:24px;background:#fff;box-shadow:var(--sh);overflow:hidden}
.npq article>img{width:96px;height:100%;min-height:150px;object-fit:cover}
.npq .qx{padding:14px 14px 12px;display:grid;gap:8px;align-content:start}
.npq .qx b{font:600 15px/1.25 var(--d)}.npq .qx p{margin:0;font:600 13px/1.35 var(--b);color:var(--ink2)}
.npq .qx .lv{display:block;height:8px;border-radius:4px;background:rgba(30,35,33,.08);overflow:hidden}.npq .qx .lv i{display:block;height:100%;width:var(--w);background:var(--sage);border-radius:4px}
.npq .qa{display:flex;gap:8px;flex-wrap:wrap}.npq .qa .pill{height:40px;padding:0 14px;font-size:13px}
.npq .done{box-shadow:inset 0 0 0 2px var(--sage),var(--sh)}
/* quick log */
.npql{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 16px}
.npql button{position:relative;aspect-ratio:1;border:0;border-radius:24px;overflow:hidden;padding:0;background:#1E2321;color:#fff;text-align:left}
.npql img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.npql button::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,20,18,0) 35%,rgba(16,20,18,.82))}
.npql span{position:absolute;left:10px;right:8px;bottom:9px;z-index:1;display:grid;gap:2px}.npql b{font:700 14px var(--d)}.npql small{font:700 12px var(--b);opacity:.85}
.npql .bd{position:absolute;top:8px;left:8px;z-index:1;width:32px;height:32px;border-radius:50%;background:#fff;display:grid;place-items:center}.npql .bd .g{font-size:18px}
.npmic{display:flex;align-items:center;gap:12px;margin:0 16px;padding:12px 14px;border-radius:24px;background:var(--ink);color:#fff;border:0;width:calc(100% - 32px);text-align:left}
.npmic .g{font-size:26px}.npmic b{display:block;font:700 15px var(--d)}.npmic small{font:700 12px var(--b);opacity:.75}
/* napzárás: dusk, full screen, six acts */
.phone.npzon .nav,.phone.npzon #cbar{display:none!important}
.phone.npzon .scroll{background:#1B2230;padding:0}
.npz{position:relative;min-height:100%;color:#F1F2F6;background:linear-gradient(180deg,#2A3550 0%,#1B2230 46%,#141922 100%);display:flex;flex-direction:column;padding-bottom:22px}
.npz>img{position:absolute;left:0;right:0;top:0;width:100%;height:300px;object-fit:cover;opacity:.55;-webkit-mask:linear-gradient(180deg,#000 30%,transparent);mask:linear-gradient(180deg,#000 30%,transparent)}
.npz>*:not(img){position:relative}
.npz .tp{display:flex;align-items:center;gap:10px;padding:18px 16px 0}
.npz .tp button{width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;display:grid;place-items:center;font:700 18px var(--b)}
.npz .tp .pg{flex:1;display:flex;gap:4px}.npz .tp .pg i{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.18)}.npz .tp .pg i.on{background:#F4C860}
.npz .hd{padding:120px 22px 0}.npz .hd small{font:700 12px var(--b);letter-spacing:.1em;text-transform:uppercase;color:#F4C860}
.npz .hd h2{font:700 34px/1.08 var(--d);letter-spacing:-.03em;margin:6px 0 8px}.npz .hd p{margin:0;font:600 15px/1.45 var(--b);color:rgba(241,242,246,.8)}
.npz .bx{margin:18px 16px 0;padding:16px;border-radius:24px;background:rgba(255,255,255,.08);display:grid;gap:12px}
.npz .bx b{font:600 15px var(--d)}.npz .bx small{font:700 12px var(--b);color:rgba(241,242,246,.7)}
.npz .chips .chip{background:rgba(255,255,255,.14);color:#fff;box-shadow:none}
.npz .lvl{display:block;height:10px;border-radius:5px;background:rgba(255,255,255,.14);overflow:hidden}.npz .lvl i{display:block;height:100%;width:var(--w);border-radius:5px;background:#F4C860}
.npz .sp{flex:1;min-height:20px}
.npz .ft{display:grid;grid-template-columns:auto 1fr;gap:8px;margin:18px 16px 0}
.npz .ft button{min-height:50px;border-radius:999px;border:0;font:800 15px var(--d);padding:0 20px;background:rgba(255,255,255,.14);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px}
.npz .ft button.go{background:#F4C860;color:#1B2230}.npz .ft .g{font-size:18px}
.npz .sc{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.npz .sc button{min-height:44px;border-radius:14px;border:0;background:rgba(255,255,255,.1);color:#fff;font:700 15px var(--d)}.npz .sc button.on{background:#F4C860;color:#1B2230}
.npz textarea,.npz input{width:100%;box-sizing:border-box;border:0;border-radius:14px;background:rgba(255,255,255,.1);color:#fff;font:600 14px var(--b);padding:12px 14px;outline:none;resize:none}
.npz textarea::placeholder,.npz input::placeholder{color:rgba(241,242,246,.55)}
.npz .yn{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.npz .yn button{min-height:42px;border-radius:14px;border:0;background:rgba(255,255,255,.1);color:#fff;font:700 13px var(--b)}.npz .yn button.on{background:#F4C860;color:#1B2230}
.npz .nprw b,.npz .nprw small{display:block}.npz .nprw{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:center}.npz .nprw .g{font-size:28px}
.npz .nprw .pill{height:40px;padding:0 14px;font-size:13px;background:rgba(255,255,255,.14);box-shadow:none}
.npz .xp{display:flex;height:16px;border-radius:8px;overflow:hidden}.npz .xp i{display:block;height:100%}
.npz .lg2{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px}.npz .lg2 span{display:flex;align-items:center;gap:6px;font:700 12.5px var(--b)}.npz .lg2 span u{width:10px;height:10px;border-radius:3px;display:block}
.npz .arc{width:100%;height:120px;display:block}
.npz .jar{display:grid;justify-items:center;gap:6px;padding-top:6px}.npz .jar .g{font-size:86px}
.npz blockquote{margin:0;font:600 17px/1.45 var(--d);color:#fff}
.npz .npbig{font:800 54px/1 var(--d);letter-spacing:-.04em;color:#F4C860}
/* routine builder */
.nplink{padding:6px 16px 10px}
.nplink li{list-style:none;display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;position:relative}
.nplink li::before{content:"";position:absolute;left:25px;top:-10px;height:20px;width:2px;background:var(--sage2)}.nplink li:first-child::before{display:none}
.nplink img{width:52px;height:52px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px var(--sage3)}
.nplink b{display:block;font:600 14px var(--d)}.nplink small{font:700 12px var(--b);color:var(--ink2)}
.nplink .ed{display:none;gap:6px}.nplink.nped .ed{display:flex}.nplink.nped .lvw{display:none}
.nplink .ed button{width:40px;height:40px;border-radius:12px;border:0;background:var(--paper);font:700 15px var(--b);color:var(--ink)}
.nplink .lvw{width:54px;height:6px;border-radius:3px;background:var(--paper);overflow:hidden;display:block}.nplink .lvw i{display:block;height:100%;width:var(--w);background:var(--sage)}
.npstage{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px 12px}
.npstage button{border:0;border-radius:18px;background:none;padding:8px 0;display:grid;justify-items:center;gap:5px;color:var(--ink);min-height:40px}
.npstage button.on{background:var(--sage3)}
.npstage .tb{position:relative;width:28px;height:60px;border-radius:999px;background:rgba(30,35,33,.07);overflow:hidden}.npstage .tb i{position:absolute;left:0;right:0;bottom:0;height:var(--h);background:linear-gradient(180deg,var(--sage2),var(--deep))}
.npstage b{font:700 15px var(--d)}.npstage small{font:700 12px var(--b);color:var(--ink2)}
.npgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:14px 16px}
.npgrid i{aspect-ratio:1;border-radius:8px;background:rgba(30,35,33,.07);display:block}.npgrid i.on{background:var(--sage)}.npgrid i.part{background:var(--sage2)}.npgrid i.to{box-shadow:inset 0 0 0 2px var(--deep)}
.npgrid b{font:700 12px var(--b);color:var(--ink2);text-align:center}
.npwd{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:14px 12px;align-items:end}
.npwd div{display:grid;justify-items:center;gap:4px}.npwd .tb{position:relative;width:20px;height:58px;border-radius:999px;background:rgba(30,35,33,.07);overflow:hidden}.npwd .tb i{position:absolute;left:0;right:0;bottom:0;height:var(--h);background:linear-gradient(180deg,var(--sage2),var(--sage))}.npwd small{font:700 12px var(--b);color:var(--ink2)}
.nprec{padding:16px 18px;font:600 17px/1.4 var(--d);letter-spacing:-.01em}.nprec em{font-style:normal;color:var(--deep)}
.npf{display:grid;gap:14px;padding:16px}
.npf label>span{display:block;font:700 12px var(--b);color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.npf input,.npf textarea{width:100%;box-sizing:border-box;min-height:48px;border:0;border-radius:14px;background:var(--paper);padding:12px 14px;font:600 14px var(--b);color:var(--ink);outline:none;resize:none}
.npopt{display:flex;flex-wrap:wrap;gap:8px}.npopt button{min-height:40px;padding:0 14px;border-radius:999px;border:0;background:var(--paper);font:700 13px var(--b);color:var(--ink)}.npopt button.on{background:var(--ink);color:#fff}
.npeff{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.npeff button{min-height:64px;border-radius:16px;border:0;background:var(--paper);display:grid;align-content:center;justify-items:center;gap:2px;font:700 13px var(--b);color:var(--ink)}.npeff button.on{background:var(--sage3);box-shadow:inset 0 0 0 2px var(--sage)}.npeff small{font:700 12px var(--b);color:var(--deep)}
.npwz{position:sticky;top:0;z-index:4;display:flex;gap:4px;padding:12px 16px;background:rgba(246,244,239,.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.npwz i{flex:1;height:6px;border-radius:3px;background:rgba(30,35,33,.1)}.npwz i.on{background:var(--sage)}
.npfw{display:grid;gap:10px}.npfw button{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border-radius:22px;border:0;background:#fff;box-shadow:var(--sh);text-align:left;color:var(--ink)}
.npfw button.on{box-shadow:inset 0 0 0 2px var(--sage),var(--sh)}.npfw img{width:64px;height:64px;border-radius:18px;object-fit:cover}.npfw b{display:block;font:600 15px var(--d)}.npfw small{font:700 12px var(--b);color:var(--ink2)}
.w320 .npsix .tb{height:110px}.w320 .npsix{gap:2px;padding:16px 6px 12px}.w320 .npz .hd{padding-top:100px}.w320 .npz .hd h2{font-size:30px}.w320 .npql{gap:8px}
</style>`);

/* ── check-in: the four moments ── */
const SLOTS=[['06:30','Reggel','d',6,[['Energia',7],['Alvás',8],['Kedv',7]]],['10:00','Délelőtt','d',24,[['Energia',7],['Fókusz',6],['Térd',2]]],['14:00','Délután','n',47,[]],['20:00','Este','',87,[]]];
function checkin(){return `${ihead({ph:'kave.jpg',crumb:'Nap › <b>Check-in</b>',eb:'A nap négy pillanata',title:'Kettő kész, egy most esedékes',sub:'Délután négy kérdés, fél perc.',btn:`${G('check','ink')}Kitöltöm`,attrs:'data-sheet="napCheckin"'})}
  <h1 class="head rise" style="--i:1">Ma eddig <em>két check-in</em>. Az energiád délelőtt is 7 maradt.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A nap</h3></div><div class="card deep npday pre"><div class="ln" data-scrub='${JSON.stringify(SLOTS.map(([t,l,st,x,a])=>[x/100,`${t} · ${l.toLowerCase()} · ${a.length?a.map(([n,v])=>n.toLowerCase()+' '+v).join(', '):st==='n'?'most esedékes':'később'}`]))}'><i class="f" style="--w:52%"></i><span class="now" style="left:52%">most · 14:10</span>${SLOTS.map(([t,l,st,x])=>`<span class="pt ${st}" style="left:${x}%"><b>${t}</b><span></span><small>${st==='d'?'kész':st==='n'?'esedékes':'később'}</small></span>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Pillanatok</h3></div><div class="dlist one">${SLOTS.map(([t,l,st,x,a],i)=>`<article class="dl ${st===''?'fut':''} ${st==='n'?'today':''} ${st==='n'?'tap':''}" ${st==='n'?'role="button" tabindex="0" data-sheet="napCheckin"':''}><span class="stk"><img src="${PH(['reggelfeny','kave','nap-seta','nap-alkony'][i]+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${l} · ${t}</strong>${a.length?`<div class="npcap">${a.map(([n,v])=>`<span><u style="--v:${v}"></u>${n} ${v}</span>`).join('')}</div>`:`<div class="chips"><span class="chip ${st==='n'?'soft':''}">${st==='n'?'most · 4 kérdés':'később · 5 kérdés'}</span></div>`}</div>${st==='n'?G('chev','ink','chev'):''}</article>`).join('')}</div></section>
  ${mzCard('A délelőtti <em>térd 2</em> jó jel: a hétfői fájdalom elmúlt. Ma a lábat nem kell kímélni.')}</div>`}

/* ── életjelek ── */
const SIGT=['data-go="log-uzsonna"','data-sheet="napWater"','data-sheet="napSleep"','data-go="edzes"','data-sheet="napCheckin"',''];
const SIGS2=['utolsó étkezés 13:00 · 3 óra múlva fogy el','1,4 liter · óránként 6%-ot fogy','7 óra 16 perc · ma már nem változik','0 / 1 edzés · 4 100 lépés','két beszélgetés · check-in kedv 7','a rutin 62%-a megvan'];
function eletjel(){const a=sigAvg();return `${ihead({ph:'nap-seta.jpg',crumb:'Nap › <b>Életjelek</b>',eb:'Hat életjel · élő',title:`Átlag ${a}`,sub:'Óránként fogynak, a logjaidból töltődnek.'})}
  <h1 class="head rise" style="--i:1">Öt életjel rendben. <em>A mozgás</em> kér figyelmet.</h1>
  <section class="sec rise first" style="--i:2"><div class="card deep pre"><div class="npsix">${SIGS.map(([l,ic,pal,v],i)=>`<button class="${v<40?'low':''}" ${SIGT[i]} aria-label="${l} ${v}%"><span class="tb"><i style="--h:${v}%"></i>${G(ic,'cream')}</span><b>${v}</b><small>${l}</small></button>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Egyenként</h3></div><div class="card pad">${SIGS.map(([l,ic,pal,v],i)=>`<div class="row ${SIGT[i]?'tap':''}" ${SIGT[i]?`role="button" tabindex="0" ${SIGT[i]}`:''}>${G(ic,pal)}<div><b>${l}${v<40?' · <span style="color:#C26A3A">figyelj</span>':''}</b><small>${SIGS2[i]}</small></div><span class="v">${v}%<u><i style="--p:${v}%;${v<40?'background:var(--peach)':''}"></i></u></span></div>`).join('')}</div></section>
  ${mzCard('A <em>Pull Day</em> egyedül 80 fölé viszi a mozgást. Utána a nap átlaga 72 lesz.',`<button class="pill soft" data-go="edzes">Az edzés</button>`)}</div>`}

/* ── napi küldetések ── */
const QST=[{t:'Igyál meg 2 litert estig',why:'a víz ma 55%-on áll',ph:'viz',p:70,done:0,act:['Víz +250 ml','data-sheet="napWater"'],xp:20},{t:'Ebéd után 10 perc séta',why:'a mozgás a leggyengébb életjel',ph:'nap-seta',p:100,done:1,act:null,xp:20},{t:'Írj három sort a napodról',why:'a héten még nem írtál naplót',ph:'nap-naplo',p:0,done:0,act:['Írok','data-sheet="napJournal"'],xp:20}];
const QALT={t:'Feküdj le 22:45 előtt',why:'a késői lefekvés minta miatt',ph:'nap-ej',p:0,done:0,act:['Emlékeztess','data-toast="Emlékeztető 22:30-ra"'],xp:20};
const QS={swaps:1};
function kuldetes(){const d=QST.filter(q=>q.done).length;return `${ihead({ph:'nap-lista.jpg',crumb:'Nap › <b>Napi küldetések</b>',eb:'Ma · három küldetés',title:`${d} kész a 3-ból`,sub:'A logjaidból záródnak maguktól.'})}
  <section class="sec rise first" style="--i:2"><div class="card gy g1 deep pre">${ring({d:96,sw:10,p:d/3,c:'#F4C860',val:`${d} / 3`,unit:'kész'})}<div class="bars">${QST.map(q=>`<div class="br"><span>${q.t.split(' ').slice(0,3).join(' ')}…</span><b>${q.done?'kész':q.p+'%'}</b><u><i style="--w:${q.p}%;background:${q.done?'#F4C860':'#A8D5BA'}"></i></u></div>`).join('')}<div class="br"><span>ma eddig</span><b>+${d*20} XP <small>/ 60</small></b></div></div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>A mai három</h3><span class="chip">csere · ${QS.swaps} maradt</span></div><div class="npq" id="npq">${QST.map((q,i)=>`<article class="${q.done?'done':''}"><img src="${PH(q.ph+'-sq.jpg')}" alt=""><div class="qx"><b>${q.t}</b><p>${q.why}</p><span class="lv"><i style="--w:${q.p}%"></i></span><div class="chips">${q.done?`<span class="chip soft">${G('check','sage')}kész · +${q.xp} XP</span>`:`<span class="chip">folyamatban · magától záródik</span>`}</div>${q.done?'':`<div class="qa">${q.act?`<button class="pill soft" ${q.act[1]}>${q.act[0]}</button>`:''}${QS.swaps?`<button class="pill soft" data-npswap="${i}">${G('repeat','deep')}Csere</button>`:''}</div>`}</div></article>`).join('')}</div></section>
  ${mzCard('A küldetéseket a <em>leggyengébb életjeleidből</em> sorsolom. Pipálni nem kell: a logjaidból látom.')}</div>`}

/* ── gyors logolás ── */
const QL=[['Étkezés','bowl','sage','salata','fotó, kamra, recept','data-go="log-uzsonna"'],['Víz','drop','sky','viz','250 ml egy koppintás','data-sheet="napWater"'],['Kiegészítő','capsule','berry','herbs','a mai stack','data-go="kieg"'],['Edzés','dumbbell','berry','edz-sulyzotarto','Pull Day 17:30','data-go="edzes"'],['Sport','ball','sun','edz-ropi-terem','röpi, futás','data-go="edzes-sportlog"'],['Súly','scale','sage','edz-sulyzo','reggeli mérés','data-sheet="napWeight"'],['Check-in','check','sage','kave','14:00 esedékes','data-sheet="napCheckin"'],['Napló','pen','sun','nap-naplo','gondolat, hála','data-sheet="napJournal"'],['Alvás','moon','sky','nap-ebredes','kézzel vagy képről','data-sheet="napSleep"']];
function gyors(){return `${ihead({ph:'flatlay.jpg',crumb:'Nap › <b>Gyors logolás</b>',eb:'Bármit, egy helyről',title:'Mi érkezett?',sub:'Koppints, vagy mondd el Mezónak.',sm:1})}
  <section class="sec rise first" style="--i:1"><button class="npmic" data-sheet="napWrite">${G('mic','sage')}<div><b>Mondd el Mezónak</b><small>„ettem egy túrót és ittam fél litert”</small></div></button></section>
  <section class="sec rise" style="--i:2"><div class="sh"><h3>Válassz</h3></div></section><div class="npql rise" style="--i:2">${QL.map(([l,ic,pal,p,s,a])=>`<button ${a}><img src="${PH(p+'-sq.jpg')}" alt=""><span class="bd">${G(ic,pal)}</span><span><b>${l}</b><small>${s}</small></span></button>`).join('')}</div>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Legutóbb</h3></div>${logList(LOG.slice(0,3))}</section>
  ${mzCard('Ha elmondod, én szétszedem: <em>étkezés, víz, hangulat</em> külön sorba kerül.')}</div>`}

/* ── napzárás: six acts ── */
const NZ={score:7,yn:'',grat:['','',''],skip:false};
const NZT=['Megérkezés','A napod íve','Ma milyen volt','Nyitott hurkok','Termés','Elengedés'];
function zaras(n){n=Math.max(1,Math.min(6,+n||1));
  const tp=`<div class="tp"><button data-npzexit aria-label="Kilépés a napzárásból">×</button><div class="pg" aria-label="${n}. lépés a hatból">${NZT.map((_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</div></div>`;
  const ft=(go,lbl)=>`<div class="sp"></div><div class="ft">${n>1?`<button data-go="nap-zaras-${n-1}" aria-label="Vissza">${G('back','cream')}</button>`:'<span></span>'}<button class="go" ${go}>${lbl} ${n<6?G('chev','ink'):''}</button></div>`;
  const hd=(t,p)=>`<div class="hd"><small>${n} / 6 · ${NZT[n-1]}</small><h2>${t}</h2><p>${p}</p></div>`;
  let b='';
  if(n===1)b=`${hd('Megérkeztél.','Vegyél egy mély levegőt. Négy perc, és letesszük a napot.')}<div class="bx"><b>A mai check-inek</b><span class="lvl"><i style="--w:75%"></i></span><small>3 / 4 megvan · a délutáni maradt ki</small></div>${ft('data-go="nap-zaras-2"','Kezdjük')}`;
  if(n===2){const P=[[0,60],[25,70],[50,50],[75,62],[100,58]],pth=P.map(([x,y],i)=>`${i?'L':'M'}${x*3.4+10} ${110-y}`).join(' ');
    b=`${hd('A napod íve','Délelőtt csúcs, délután egy hullámvölgy, este visszajött.')}<div class="bx"><svg class="arc" viewBox="0 0 360 120" role="img" aria-label="Energia a nap folyamán" data-scrub='${JSON.stringify([[10,'06:30 · energia 6'],[95,'10:00 · energia 7 · csúcs'],[180,'14:00 · energia 5'],[265,'17:30 · edzés után 6'],[350,'20:00 · energia 6']].map(([x,l])=>[x/360,l]))}'><path d="${pth} L350 120 L10 120 Z" fill="rgba(244,200,96,.22)"/><path d="${pth}" fill="none" stroke="#F4C860" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${['06:30','10:00','14:00','20:00'].map((t,i)=>`<text x="${[14,100,186,300][i]}" y="116" fill="rgba(241,242,246,.7)" font-size="12" font-weight="700" font-family="Manrope">${t}</text>`).join('')}</svg><div class="chips">${['Pull Day · 2 rekord','3 étkezés','Alvás 7,4 óra','Check-in 3 / 4'].map(c=>`<span class="chip">${c}</span>`).join('')}</div></div>${ft('data-go="nap-zaras-3"','Tovább')}`}
  if(n===3)b=`${hd('Ma milyen volt?','Egy szám, és ha akarod, pár sor.')}<div class="bx"><div style="display:flex;align-items:end;gap:10px"><span class="npbig" id="npzv">${NZ.score}</span><small>a 10-ből</small></div><div class="sc">${[6,7,8,9,10].map(v=>`<button class="${NZ.score===v?'on':''}" data-npzs="${v}">${v}</button>`).join('')}</div><textarea rows="2" placeholder="Mi volt a nap legjobb pillanata?" aria-label="A nap legjobb pillanata"></textarea></div><div class="bx"><b>Három dolog, amiért hálás vagy</b>${[0,1,2].map(i=>`<input placeholder="${i+1}." aria-label="Hála ${i+1}">`).join('')}</div>${ft('data-go="nap-zaras-4"','Tovább')}`;
  if(n===4)b=`${hd('Nyitott hurkok','Ami nyitva maradt, most lezárhatod. Vagy holnapra viheted.')}<div class="bx"><div class="nprw">${G('check','sun')}<div><b>Délutáni check-in</b><small>kimaradt</small></div><button class="pill" data-sheet="napCheckin">Pótolom</button></div></div><div class="bx"><b>Mai fókusz: „korán lefeküdni”</b><small>Sikerült?</small><div class="yn">${['Igen','Részben','Nem'].map(a=>`<button class="${NZ.yn===a?'on':''}" data-npzyn="${a}">${a}</button>`).join('')}</div></div><div class="bx"><div class="nprw">${G('pen','sun')}<div><b>Napló</b><small>ha valami még benned van</small></div><button class="pill" data-sheet="napJournal">Írok</button></div></div>${ft('data-go="nap-zaras-5"','Tovább')}`;
  if(n===5)b=`${hd('A nap termése','Ennyit tettél ma magadért.')}<div class="bx"><div style="display:flex;align-items:end;gap:10px"><span class="npbig">+185</span><small>XP ma</small></div><span class="xp">${[['#F4C860',80],['#7CC39F',45],['#8CC3E8',35],['#C9A8E8',25]].map(([c,v])=>`<i style="width:${v/185*100}%;background:${c}"></i>`).join('')}</span><div class="lg2">${[['#F4C860','edzés · 80'],['#7CC39F','étkezés · 45'],['#8CC3E8','rutin · 35'],['#C9A8E8','check-in · 25']].map(([c,l])=>`<span><u style="background:${c}"></u>${l}</span>`).join('')}</div></div><div class="bx"><div class="nprw">${G('star','sun')}<div><b>Tudatosság · 4. szint</b><small>68% a következőig</small></div><span></span></div><span class="lvl"><i style="--w:68%"></i></span><div class="chips"><span class="chip">${G('medal','sun')}+12 érme</span><span class="chip">12 napos sorozat</span><span class="chip">86 napja velem</span></div></div>${ft('data-go="nap-zaras-6"','Tovább')}`;
  if(n===6)b=`${hd('Elengedés','A nap le van téve. Ami holnapra maradt, az a holnapé.')}<div class="bx"><div class="jar">${G('jar','sun')}<small>a mai nap lezárva · ${NZ.score} / 10</small></div><blockquote>„Ma nem kellett tökéletesnek lennie. Elég volt, hogy jelen voltál.”</blockquote><small>Mezo</small></div><div class="bx"><div class="nprw">${G('moon','sky')}<div><b>21:45 lecsendesítés</b><small>a képernyő elsötétül</small></div><span></span></div><div class="nprw">${G('moon','berry')}<div><b>22:30 villanyoltás</b><small>8 óra alvás a cél</small></div><span></span></div></div><div class="sp"></div><div class="ft"><button data-go="nap-rutin-este">${G('moon','cream')}Esti rutin</button><button class="go" data-npzdone>Kész, jó éjszakát</button></div>`;
  return `<div class="npz"><img src="${PH(n>=5?'nap-ej.jpg':'nap-alkony.jpg')}" alt="">${tp}${b}</div>`}

/* ── rutin építő ── */
function epites(){return `${ihead({ph:'nap-lista.jpg',crumb:'Nap › Rutin › <b>Építés</b>',eb:'Három lánc · 17 szokás',title:'A rutinod',sub:'Láncok, szokások, új ötletek egy helyen.',btn:`${G('plus','ink')}Új szokás`,attrs:'data-go="nap-rutin-uj-1"'})}
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A láncaid ereje</h3></div><div class="card gy g1 deep pre">${ring({d:96,sw:10,p:.62,c:'#A8D5BA',val:'62%',unit:'lánc-erő'})}<div class="bars">${[['Reggel · 9 szokás',74],['Napközben · 3',53],['Este · 5',63]].map(([l,v])=>`<div class="br"><span>${l}</span><b>${v}%</b><u><i style="--w:${v}%;background:#A8D5BA"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Láncok</h3></div><div class="dlist one">${[['reggelfeny','Reggeli lánc','9 szokás · 06:40–07:40','74%'],['nap-seta','Napközbeni lánc','3 szokás · 13:30–15:00','53%'],['nap-alkony','Esti lánc','5 szokás · 20:00–22:30','63%']].map(([p,t,s,v])=>`<article class="dl tap" role="button" tabindex="0" data-go="nap-lanc"><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${t}</strong><div class="chips"><span class="chip soft">${v} erő</span><span class="chip">${s}</span></div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Még</h3></div><div class="card pad">${[['book','sage','Szokásaid','17 szokás · 4 szakasz','data-go="nap-szokasok"'],['link','deep','Új lánc','szokások egymás után','data-sheet="napChainNew"'],['spark','deep','Mezo javasol','két ötlet a mintáid alapján','data-sheet="napAi"']].map(([ic,pal,b,s,a])=>`<div class="row tap" role="button" tabindex="0" ${a}>${G(ic,pal)}<div><b>${b}</b><small>${s}</small></div>${G('chev','ink','chev')}</div>`).join('')}</div></section>
  ${mzCard('Egy új szokás akkor marad meg, ha <em>egy meglévő után</em> jön. A varázsló ebben segít.')}</div>`}
const NL={edit:false};
function lanc(){const L=HAB.reggel;return `${ihead({ph:'nap-ebredes.jpg',crumb:'Nap › Rutin › <b>Reggeli lánc</b>',eb:'Reggel · 06:40–07:40',title:'Reggeli lánc',sub:'Kilenc szokás, egymás után.',btn:`${G('book','ink')}${NL.edit?'Kész':'Szerkesztem'}`,attrs:'data-nplanced'})}
  <section class="sec rise first" style="--i:2"><div class="card trio t-sage">${[['star','sun','6 / 30','tökéletes reggel'],['link','deep','74%','lánc-erő'],['clock','sky','58 perc','a lánc hossza']].map(([ic,pal,v,l])=>`<div>${G(ic,pal)}<b>${v}</b><small>${l}</small></div>`).join('')}</div></section>
  ${NL.edit?`<section class="sec rise" style="--i:3"><div class="card npf"><label><span>A lánc neve</span><input value="Reggeli lánc" aria-label="A lánc neve"></label><div><span style="display:block;font:700 12px var(--b);color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Napszak</span><div class="npopt">${['Reggel','Napközben','Este'].map((x,i)=>`<button class="${i?'':'on'}" data-npopt>${x}</button>`).join('')}</div></div></div></section>`:''}
  <section class="sec rise" style="--i:3"><div class="sh"><h3>A sorrend</h3></div><ol class="card nplink ${NL.edit?'nped':''}" id="nplink">${L.map((h,i)=>`<li><img src="${PH(h[2]+'-sq.jpg')}" alt=""><div><b>${h[0]}</b><small>${h[1]} · ${h[3]}</small></div><span class="lvw"><i style="--w:${h[5]}%"></i></span><span class="ed"><button data-npmv="${i}|-1" aria-label="Feljebb">▲</button><button data-npmv="${i}|1" aria-label="Lejjebb">▼</button></span></li>`).join('')}</ol></section>
  ${NL.edit?`<div class="acts rise" style="--i:4"><button class="pill soft" data-toast="A lánc szünetel egy hétig">Szüneteltetem</button><button class="pill soft" data-nptoast="Új szokás a lánc végére" data-npgo="nap-rutin-uj-1">${G('plus','deep')}Szokás</button></div>`:''}
  ${mzCard('A <em>reggeli videó</em> szakítja meg legtöbbször a láncot. Ha a kávé mellé teszed, nem kell külön emlékezni rá.')}</div>`}
const HALL=[...HAB.reggel,...HAB.napkozben,...HAB.este].map(h=>[...h.slice(0,7),h[7]||'',h[5]>=85?'Automatikus':h[5]>=65?'Erős':h[5]>=45?'Épül':'Új']);
const STG=[['Új',12],['Épül',48],['Erős',74],['Automatikus',94]].map(([l,h])=>[l,HALL.filter(x=>x[8]===l).length,h]);
const NSZ={stage:'',q:''};
function szokasok(){return `${ihead({ph:'nap-naplo.jpg',crumb:'Nap › Rutin › <b>Szokásaid</b>',eb:'17 szokás · négy szakasz',title:'Szokásaid',sub:'Hogy hol tartanak az automatikusság felé.',sm:1})}
  <section class="sec rise first" style="--i:1">${searchBar({ph:'Keresés a szokások közt…',cls:'npsq',aria:'Keresés a szokások közt'})}</section>
  <section class="sec rise" style="--i:2"><div class="card npstage t-sky">${STG.map(([l,n,h])=>`<button class="${NSZ.stage===l?'on':''}" data-npstg="${l}"><span class="tb"><i style="--h:${h}%"></i></span><b>${n}</b><small>${l}</small></button>`).join('')}</div></section>
  <section class="sec rise" style="--i:3"><div class="dlist one" id="nphall">${HALL.map(h=>`<article class="dl tap" role="button" tabindex="0" data-go="nap-szokas" data-stg="${h[8]}"><span class="stk"><img src="${PH(h[2]+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${h[0]}</strong><div class="chips"><span class="chip soft">${h[8]} · ${h[5]}%</span><span class="chip">${h[3]}</span></div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  ${mzCard('Átlagosan <em>66 nap</em> kell, mire egy szokás automatikus lesz. A reggeli napfény a 29. napnál tart.')}</div>`}
function szokas(){return `${ihead({ph:'reggelfeny.jpg',crumb:'Nap › Rutin › <b>Reggeli napfény</b>',eb:'Reggeli lánc · 3. szokás',title:'Reggeli napfény',sub:'29 napja építed.',btn:`${G('pen','ink')}Szerkesztés`,attrs:'data-go="nap-szokas-szerk"'})}
  <section class="sec rise first" style="--i:2"><div class="card gy g1 deep pre">${ring({d:96,sw:10,p:.48,c:'#A8D5BA',val:'48%',unit:'épül'})}<div class="bars">${[['Idő · 06:50–07:00',82],['Hely · az erkély',70],['Előtte · a mai fókusz',64]].map(([l,v])=>`<div class="br"><span>${l}</span><b>${v}%</b><u><i style="--w:${v}%;background:#A8D5BA"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>A recept</h3></div><div class="card nprec t-sun">A <em>mai fókusz</em> után kimegyek az erkélyre <em>öt percre</em>, és utána megiszom egy pohár vizet.</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Az elmúlt 29 nap</h3><span class="crumb">19 megvolt</span></div><div class="card npgrid">${['H','K','Sze','Cs','P','Szo','V'].map(d=>`<b>${d}</b>`).join('')}${'<i></i>'.repeat(4)}${Array.from({length:29},(_,i)=>`<i class="${i===28?'to':''} ${[1,2,4,5,7,8,9,11,12,14,15,16,18,19,21,22,24,25,27].includes(i)?'on':[6,13].includes(i)?'part':''}"></i>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Melyik nap megy</h3></div><div class="card npwd t-sky">${[['H',80],['K',85],['Sze',75],['Cs',70],['P',60],['Szo',30],['V',35]].map(([d,v])=>`<div><span class="tb"><i style="--h:${v}%"></i></span><small>${d}</small></div>`).join('')}</div></section>
  ${mzCard('Hétvégén csúszik el: <em>szombaton nincs fókusz</em>, ami elindítaná. Kössük hétvégén a kávéhoz.',`<button class="pill soft" data-toast="Hétvégén a kávé után jön">Így legyen</button>`)}</div>`}
const NSE={fw:'Fogg',tick:'adat',eff:1};
function szerk(){return `${ihead({ph:'kod.jpg',crumb:'Nap › Rutin › Reggeli napfény › <b>Szerkesztés</b>',eb:'Szerkesztés',title:'Reggeli napfény',sm:1})}
  <section class="sec rise first" style="--i:1"><div class="card npf">
  <div><span style="display:block;font:700 12px var(--b);color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Keret</span><div class="npopt" data-npgrp="fw">${['Fogg','Clear','Keret nélkül'].map(x=>`<button class="${NSE.fw===x?'on':''}" data-npset="fw|${x}">${x}</button>`).join('')}</div></div>
  <label><span>A horgony · mi után jön</span><input value="A mai fókusz után" aria-label="A horgony"></label>
  <label><span>A szokás</span><input value="Kimegyek az erkélyre öt percre" aria-label="A szokás"></label>
  <label><span>Az ünneplés</span><input value="Megiszom egy pohár vizet" aria-label="Az ünneplés"></label>
  <label><span>Miért</span><textarea rows="2" aria-label="Miért">A reggeli fény korábban álmosít este.</textarea></label>
  <label><span>Videó vagy link</span><input placeholder="nem kötelező" aria-label="Videó vagy link"></label>
  <div><span style="display:block;font:700 12px var(--b);color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Pipálás</span><div class="npopt">${[['kezi','Kézzel'],['adat','Adatból · napfény-percek']].map(([k,x])=>`<button class="${NSE.tick===k?'on':''}" data-npset="tick|${k}">${x}</button>`).join('')}</div></div>
  <div><span style="display:block;font:700 12px var(--b);color:var(--ink2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Erőfeszítés</span><div class="npeff">${[['Kicsi','+5 XP'],['Közepes','+10 XP'],['Nagy','+20 XP']].map(([l,x],i)=>`<button class="${NSE.eff===i?'on':''}" data-npset="eff|${i}">${l}<small>${x}</small></button>`).join('')}</div></div>
  <label><span>Lánc</span><input value="Reggeli lánc · 3. hely" aria-label="Lánc"></label></div></section>
  <div class="acts rise" style="--i:2"><button class="pill" data-nptoast="Mentve" data-npgo="nap-szokas">Mentés</button><button class="pill soft" data-toast="Szünetel egy hétig">Szünet</button><button class="pill soft" data-sheet="napHabDel">Törlés</button></div>
  ${mzCard('Ha a <em>pipálás adatból</em> megy, nem kell rá gondolnod: a napfény-percekből látom.')}</div>`}
const NW={fw:'Fogg'};
const WZS={Fogg:['Keret','A horgony','A kis lépés','Az ünneplés'],Clear:['Keret','Tedd láthatóvá','Tedd vonzóvá','Tedd könnyűvé','Tedd jutalmazóvá'],'Keret nélkül':['Keret','A szokás']};
function ujszokas(s){const st=WZS[NW.fw],n=Math.max(1,Math.min(st.length,+s||1)),last=n===st.length;
  const body=n===1?`<div class="npfw">${[['Fogg','nap-lista','Apró lépés egy horgony után','négy lépés'],['Clear','nap-naplo','Négy törvény: látható, vonzó, könnyű, jutalmazó','öt lépés'],['Keret nélkül','kave','Csak a szokás és az idő','két lépés']].map(([k,p,d,c])=>`<button class="${NW.fw===k?'on':''}" data-npfw="${k}"><img src="${PH(p+'-sq.jpg')}" alt=""><div><b>${k}</b><small>${d}</small></div><span class="chip">${c}</span></button>`).join('')}</div>`
    :`<div class="card npf"><label><span>${st[n-1]}</span><input placeholder="${['','A kávé után…','Egy fekvőtámasz…','Azt mondom: ez az!','Egy érme a napra'][n-1]||'Például: este 10 perc olvasás'}" aria-label="${st[n-1]}"></label><div class="npopt">${(n===2?['a kávé után','a fogmosás után','az ebéd után']:n===3?['egy perc','egy ismétlés','egy oldal']:['egy mosoly','egy pipa','egy pohár víz']).map(x=>`<button data-npopt>${x}</button>`).join('')}</div></div>`;
  return `${ihead({ph:'flatlay.jpg',crumb:'Nap › Rutin › <b>Új szokás</b>',eb:`${n}. lépés · ${st.length} lépésből`,title:st[n-1],sm:1})}<div class="npwz">${st.map((_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</div>
  <section class="sec rise first" style="--i:1">${body}</section>
  <div class="acts rise" style="--i:2">${n>1?`<button class="pill soft" data-go="nap-rutin-uj-${n-1}">Vissza</button>`:''}<button class="pill" ${last?'data-nptoast="Új szokás a reggeli lánc végén" data-npgo="nap-rutin-epites"':`data-go="nap-rutin-uj-${n+1}"`}>${last?'Kész':'Tovább'}</button></div>
  ${mzCard(n===1?'Ha most kezded, a <em>Fogg</em> a legkönnyebb: egy apró lépés valami után, amit már úgyis csinálsz.':'Vedd <em>kisebbre</em>, mint gondolnád: az első héten a rendszeresség számít, nem a mennyiség.')}</div>`}

/* ── sheets ── */
document.head.insertAdjacentHTML('beforeend',`<style>
.npck{display:grid;gap:14px}
.npck .q{font:600 20px/1.2 var(--d);letter-spacing:-.02em;margin:0}
.npck .jar{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:end}
.npck .jar .tb{position:relative;width:46px;height:120px;border-radius:18px;background:var(--paper);overflow:hidden}
.npck .jar .tb i{position:absolute;left:0;right:0;bottom:0;height:var(--h);background:linear-gradient(180deg,var(--sage2),var(--sage));transition:height .35s cubic-bezier(.2,.8,.2,1)}
.npck .jar b{font:800 46px/1 var(--d);letter-spacing:-.03em}.npck .jar small{display:block;font:700 12px var(--b);color:var(--ink2)}
.npck .sc{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.npck .sc button{min-height:44px;border-radius:14px;border:0;background:var(--paper);font:700 15px var(--d);color:var(--ink)}.npck .sc button.on{background:var(--ink);color:#fff}
.npck .pr{display:flex;gap:4px}.npck .pr i{flex:1;height:5px;border-radius:3px;background:var(--paper)}.npck .pr i.on{background:var(--sage)}
.npck .nav2{display:flex;gap:8px;flex-wrap:wrap}.npck .nav2 .pill{flex:1;min-width:0}
.npck .sum .row{grid-template-columns:36px minmax(0,1fr) auto}
.npck .reg{display:flex;flex-wrap:wrap;gap:8px}
.npwat{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.npwat button{min-height:84px;border-radius:20px;border:0;background:#E4F0F8;display:grid;justify-items:center;align-content:center;gap:4px;font:700 15px var(--d);color:var(--ink)}.npwat .g{font-size:28px}
.npsl{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.npsl label{display:grid;gap:6px;font:700 12px var(--b);color:var(--ink2)}.npsl input{height:48px;border:0;border-radius:14px;background:var(--paper);padding:0 14px;font:600 15px var(--d);color:var(--ink);outline:none;width:100%;box-sizing:border-box}
.sheet textarea.npta{width:100%;box-sizing:border-box;min-height:96px;border:0;border-radius:14px;background:var(--paper);padding:12px 14px;font:600 14px var(--b);color:var(--ink);outline:none;resize:none}
.npkind{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.npkind button{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:center;padding:10px;border-radius:18px;border:0;background:var(--paper);text-align:left;color:var(--ink);min-height:64px}
.npkind button.on{background:var(--sage3);box-shadow:inset 0 0 0 2px var(--sage)}.npkind img{width:44px;height:44px;border-radius:12px;object-fit:cover}.npkind b{font:600 14px var(--d)}
.npwlv{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.npwlv div{border-radius:18px;background:var(--paper);padding:12px;display:grid;gap:4px}.npwlv b{font:700 20px var(--d)}.npwlv small{font:700 12px var(--b);color:var(--ink2)}
.npwlv .tb{height:6px;border-radius:3px;background:rgba(30,35,33,.08);overflow:hidden;display:block}.npwlv .tb i{display:block;height:100%;width:var(--w);background:var(--sage)}
</style>`);
const strip=(...p)=>`<div class="dshph">${p.map(x=>`<img src="${PH(x+'-sq.jpg')}" alt="">`).join('')}</div>`;
const sh=(p,t,chips,body)=>`<div class="grab"></div><div class="dsh">${strip(...p)}<h2>${t}</h2>${chips?`<div class="chips">${chips}</div>`:''}</div>${body}`;
const ch=(t,c='')=>`<span class="chip ${c}">${t}</span>`;
const CKQ=[['Energia','Mennyi energiád van most?','bolt','sun'],['Kedv','Milyen a kedved?','heart','berry'],['Fókusz','Mennyire tudsz figyelni?','star','sun'],['Feszültség','Mennyire vagy feszült?','spark','deep'],['Éhség','Mennyire vagy éhes?','bowl','sage'],['Fájdalom','Fáj valami?','person','peach'],['A nap kérdése','Mennyire volt ma időd magadra?','sun','sun']];
const CK={i:0,a:{},pain:'',reg:[]};
const PAINR={'Váll':[['front','deltoids'],['front','front-deltoid'],['back','deltoids']],'Nyak':[['front','neck'],['back','neck'],['back','trapezius']],'Hát':[['back','upper-back'],['back','lower-back']],'Térd':[['front','knees']],'Csukló':[['front','forearm'],['front','hands'],['back','forearm'],['back','hands']],'Fej':[['front','head'],['back','head']]};
const painMap=()=>{const B=window.MZBODY;if(!B)return '';const own={};Object.entries(PAINR).forEach(([k,L])=>L.forEach(([v,p])=>own[v+'|'+p]=k));
  const view=v=>Object.entries(B[v].p).map(([p,ps])=>{const k=own[v+'|'+p],d=ps.map(x=>`<path d="${x}"/>`).join('');return k?`<g data-ckreg="${k}" fill="${CK.reg.includes(k)?'#F0B48C':'rgba(30,35,33,.16)'}">${d}</g>`:`<g fill="${p==='hair'?'rgba(30,35,33,.2)':'rgba(30,35,33,.09)'}">${d}</g>`}).join('');
  return `<div class="npbody"><svg viewBox="41 71 1366 1297" role="img" aria-label="Testrajz: koppints oda, ahol fáj">${view('front')}${view('back')}</svg></div>`};
const ckBody=()=>{const i=CK.i;if(i>=CKQ.length)return ckSum();const [k,q,ic,pal]=CKQ[i],v=CK.a[k];
  const pain=k==='Fájdalom';
  return `<div class="npck" id="npck"><div class="pr">${CKQ.map((_,j)=>`<i class="${j<=i?'on':''}"></i>`).join('')}</div><div class="chips">${ch(`${i+1}. kérdés · ${CKQ.length}-ből`)}${ch(k,'soft')}</div><p class="q">${q}</p>
  ${pain?`<div class="npopt">${['Nem','Igen'].map(x=>`<button class="${CK.pain===x?'on':''}" data-ckpain="${x}">${x}</button>`).join('')}</div>${CK.pain==='Igen'?`${painMap()}<div class="reg npopt">${['Váll','Térd','Hát','Nyak','Fej','Csukló'].map(r=>`<button class="${CK.reg.includes(r)?'on':''}" data-ckreg="${r}">${r}</button>`).join('')}</div>`:''}`
   :`<div class="jar"><span class="tb"><i style="--h:${(v||0)*10}%"></i></span><div><b>${v||'–'}</b><small>a 10-ből</small></div></div><div class="sc">${[2,4,6,8,10].map(x=>`<button class="${v===x?'on':''}" data-ckv="${x}">${x}</button>`).join('')}</div>`}
  <div class="nav2">${i?`<button class="pill soft" data-ckback>Vissza</button>`:''}<button class="pill soft" data-cknext="skip">Kihagyom</button><button class="pill" data-cknext>Tovább</button></div>${i>=4?`<button class="pill soft" data-ckend style="width:100%">Most csak ennyi</button>`:''}</div>`};
const ckSum=()=>`<div class="npck" id="npck"><div class="chips">${ch('Összegzés','soft')}${ch('14:00 · délután')}</div><div class="card pad sum" style="background:var(--paper);box-shadow:none">${CKQ.filter(([k])=>CK.a[k]||(k==='Fájdalom'&&CK.pain)).map(([k,q,ic,pal])=>`<div class="row">${G(ic,pal)}<div><b>${k}</b></div><span class="v">${k==='Fájdalom'?(CK.pain==='Igen'?CK.reg.join(', ')||'igen':'nincs'):CK.a[k]+' / 10'}</span></div>`).join('')||'<p class="sub">Most nem válaszoltál semmire.</p>'}</div><label class="fld"><span>Gondolatok</span><textarea class="npta" placeholder="ha valami még eszedbe jut" aria-label="Gondolatok"></textarea></label><div class="nav2"><button class="pill soft" data-ckback>Vissza</button><button class="pill" data-cksave>Mentés · 14:00</button></div></div>`;
const ckPaint=()=>{const b=$('#sheet .npckh');if(b)b.innerHTML=ckBody()};
Object.assign(SHEETS,{
  napNotif:()=>sh(['kave','nap-baratok','edz-huzodzkodas'],'Értesítések',NB.notif?ch(NB.notif+' új','warm'):ch('mind olvasott','soft'),`<div class="card pad npnot" style="background:var(--paper);box-shadow:none">${[['kave','Délutáni check-in','esedékes · 14:00','data-sheet="napCheckin"',1],['nap-baratok','Étkezés üzent','18 g fehérje hiányzik · 13:10','data-go="nap-beszelgetes"',1],['edz-huzodzkodas','Pull Day 17:30-kor','64 perc · 16 szett','data-go="edzes"',1],['nap-ej','Alvás üzent','tegnap 23:20-kor feküdtél le · 07:05','data-go="nap-beszelgetes"',0]].map(([p,b,t,a,nw])=>`<div class="row tap ${nw&&NB.notif?'new':''}" role="button" tabindex="0" ${a}><img src="${PH(p+'-sq.jpg')}" alt=""><div><b>${b}</b><small>${t}</small></div>${G('chev','ink','chev')}</div>`).join('')}</div>${NB.notif?`<div class="acts" style="margin:14px 0 0"><button class="pill soft" data-npread>Mind olvasott</button></div>`:''}`),
  napCheckin:()=>{CK.i=0;CK.a={};CK.pain='';CK.reg=[];return sh(['kave','nap-seta'],'Délutáni check-in',ch('négy alap és a nap kérdése')+ch('fél perc','soft'),`<div class="npckh">${ckBody()}</div>`)},
  napObs:()=>sh(['nap-ej','edz-futas'],'Miből látom?',ch('az elmúlt hét éjszaka')+ch('alvás és lépések','soft'),`<div class="card pad" style="background:var(--paper);box-shadow:none">${[['Hétfő','23:40','5 200 lépés','h'],['Kedd','22:30','9 800 lépés',''],['Szerda','23:20','6 100 lépés','h'],['Csütörtök','23:05','7 900 lépés','m'],['Péntek','23:50','4 800 lépés','h'],['Szombat','—','nincs adat',''],['Vasárnap','23:30','5 600 lépés','h']].map(([d,t,s,c])=>`<div class="row">${G(c==='h'?'moon':c==='m'?'clock':'check',c==='h'?'sky':c==='m'?'peach':'sage')}<div><b>${d} · lefekvés ${t}</b><small>másnap ${s}</small></div><span class="v">${c==='h'?'igaz':c==='m'?'nem':'–'}</span></div>`).join('')}</div><p class="sub" style="margin-top:12px">Négyszer igaz, egyszer nem, kétszer nincs adat. Hét napból ötnél mondom ki.</p>`),
  napAsk:()=>sh(['nap-baratok','nap-lista'],'Valami nem stimmel ma?',ch('a csapat utánanéz','soft'),`<label class="fld"><span>Mi furcsa?</span><textarea class="npta" placeholder="például: túl alacsony a víz, pedig ittam" aria-label="Mi furcsa"></textarea></label><div class="acts" style="margin:14px 0 0"><button class="pill" data-toast="Elküldve: a csapat utánanéz, és szól" data-close>Elküldöm</button></div>`),
  napNaploPick:()=>sh(['nap-naplo','nap-lista','nap-baratok'],'Új bejegyzés',ch('mit írnál?'),`<div class="npkind">${[['nap-lista','Aktivitás','napAct'],['nap-naplo','Napló','napJournal'],['nap-baratok','Hála','napJournal'],['viz','Víz','napWater']].map(([p,l,s])=>`<button data-npswitch="${s}"><img src="${PH(p+'-sq.jpg')}" alt=""><b>${l}</b></button>`).join('')}</div>`),
  napTobb:()=>sh(['nap-lista','nap-baratok'],'Több',null,`<div class="card pad" style="background:var(--paper);box-shadow:none">${[['star','sun','Aktivitás','+15 XP egy szabad bejegyzésért','data-npswitch="napAct"'],['chat','sky','Beszélgetés','Mezo és a csapat','data-go="nap-beszelgetes"'],['chart','deep','Életjelek','hat szint, élő','data-go="nap-eletjel"'],['medal','sun','Napi küldetések','1 / 3','data-go="nap-kuldetesek"'],['plus','sage','Gyors logolás','bármit, egy helyről','data-go="nap-gyors"'],['check','sage','Check-in','a nap négy pillanata','data-go="nap-checkin"']].map(([ic,pal,b,s,a])=>`<div class="row tap" role="button" tabindex="0" ${a}>${G(ic,pal)}<div><b>${b}</b><small>${s}</small></div>${G('chev','ink','chev')}</div>`).join('')}</div><p class="sub" style="margin:14px 0 8px">Az appon kívül</p><div class="card pad" style="background:var(--paper);box-shadow:none">${[['phone','sky','Kezdőképernyő','csempék: életjel, víz, szokás, check-in','nap-kezdo'],['bell','sun','Értesítés','a check-in megválaszolható az appon kívül','nap-ertesites'],['moon','berry','Esti emlékeztető','a zárolt képernyőn, 21:30','nap-esti']].map(([ic,pal,b2,s2,g])=>`<div class="row tap" role="button" tabindex="0" data-go="${g}">${G(ic,pal)}<div><b>${b2}</b><small>${s2}</small></div>${G('chev','ink','chev')}</div>`).join('')}</div>`),
  napFuel:()=>sh(['csirke','omlett','salata'],'A napod üzemanyaga',ch('2 060 / 2 782 kalória','soft')+ch('722 van még'),`<div class="card gy g1 deep" style="margin-bottom:12px">${ring({d:96,sw:10,p:2060/2782,c:'#A8D5BA',val:'2 060',unit:'kalória'})}<div class="bars">${[['fehérje',148,166,'#E09A6A'],['szénhidrát',212,300,'#E2B24A'],['zsír',71,92,'#8FBF9F']].map(([l,a,b,c])=>`<div class="br"><span>${l}</span><b>${a} <small>/ ${b} g</small></b><u><i style="--w:${a/b*100}%;background:${c}"></i></u></div>`).join('')}</div></div><div class="acts" style="margin:0"><button class="pill" data-go="">Fuel megnyitása</button></div>`),
  napKimelo:()=>sh(['nap-tea','nap-ebredes'],'Nem vagyok jól',ch('kímélő mód','warm')+ch('az edzés tolódik'),`<p class="sub">Mi történt?</p><div class="npkind" style="margin-bottom:14px">${[['nap-tea','Beteg vagyok'],['salata','Gyomorrontás'],['edz-nyujtas','Sérülés'],['nap-seta','Úton vagyok']].map(([p,l],i)=>`<button class="${i?'':'on'}" data-npopt><img src="${PH(p+'-sq.jpg')}" alt=""><b>${l}</b></button>`).join('')}</div><p class="sub">Meddig tarthat?</p><div class="npopt">${['Csak ma','2–3 nap','Kb. egy hét','Nem tudom'].map((x,i)=>`<button class="${i===1?'on':''}" data-npopt>${x}</button>`).join('')}</div><div class="acts" style="margin:16px 0 0"><button class="pill" data-go="nap-mai-kimelo">Bekapcsolom</button><button class="pill soft" data-close>Mégse</button></div>`),
  napKmWelcome:()=>sh(['nap-seta','edz-nyujtas'],'Jó, hogy jobban vagy',ch('2 nap pihenő')+ch('visszatérés · 3 edzés','soft'),`<div class="npwlv">${[['1.','fél terhelés',50],['2.','háromnegyed',75],['3.','teljes',100]].map(([n,l,w])=>`<div><b>${n} edzés</b><small>${l}</small><span class="tb"><i style="--w:${w}%"></i></span></div>`).join('')}</div><p class="sub" style="margin-top:12px">Két edzés maradt ki, a terv egy héttel tolódik. Semmi nem vész el.</p><div class="acts" style="margin:14px 0 0"><button class="pill" data-nptoast="Visszatérés indul: fél terheléssel" data-npgo="nap">Rendben</button><button class="pill soft" data-close>Mégsem vagyok jól</button></div>`),
  napKmMistake:()=>sh(['nap-tea'],'Tévedés volt?',ch('a kímélő mód törlődik','warm'),`<p class="sub">A két nap visszakerül a tervbe, mintha nem lett volna.</p><div class="acts" style="margin:14px 0 0"><button class="pill" data-nptoast="Törölve: a terv visszaállt" data-npgo="nap">Törlöm</button><button class="pill soft" data-close>Mégse</button></div>`),
  napWater:()=>sh(['viz','nap-seta'],'Víz',ch('ma 1,4 liter','soft')+ch('cél 2,5 liter'),`<div class="npwat">${[250,400,500].map(ml=>`<button data-npwater="${ml}">${G('drop','sky')}${ml} ml</button>`).join('')}</div><div class="npsl" style="margin-top:12px"><label>Kézzel, ml<input inputmode="numeric" placeholder="például 330" aria-label="Víz kézzel, ml"></label><label>&nbsp;<button class="pill" data-npwater="330" style="height:48px">Hozzáadom</button></label></div>`),
  napWeight:()=>sh(['edz-sulyzo','reggelfeny'],'Súly',ch('reggel, éhgyomorra')+ch('a trend lefelé','soft'),`<div class="npck"><div class="jar"><span class="tb"><i style="--h:62%"></i></span><div><b id="npkg">82,4</b><small>kiló · tegnap 82,6</small></div></div><div class="npopt">${['−0,1','+0,1'].map(x=>`<button data-npkg="${x}">${x}</button>`).join('')}</div><label class="fld"><span>Megjegyzés</span><input placeholder="például: késő vacsora volt" aria-label="Megjegyzés"></label><button class="pill" data-toast="Rögzítve: súly" data-close style="width:100%">Mentés</button></div>`),
  napSleep:()=>sh(['nap-ebredes','nap-ej'],'Alvás',ch('tegnap éjjel')+ch('7 óra 16 perc','soft'),`<div class="npopt" style="margin-bottom:12px">${['Kézzel','Képernyőképről'].map((x,i)=>`<button class="${i?'':'on'}" data-npopt>${x}</button>`).join('')}</div><div class="npsl"><label>Lefekvés<input value="23:20" aria-label="Lefekvés"></label><label>Ébredés<input value="06:40" aria-label="Ébredés"></label></div><p class="sub" style="margin-top:12px">Milyen volt?</p><div class="npopt">${['Rossz','Közepes','Jó','Kiváló'].map((x,i)=>`<button class="${i===2?'on':''}" data-npopt>${x}</button>`).join('')}</div><p class="sub" style="margin-top:12px">Felébredtél éjjel?</p><div class="npopt">${['Nem','Egyszer','Többször'].map((x,i)=>`<button class="${i===1?'on':''}" data-npopt>${x}</button>`).join('')}</div><div class="acts" style="margin:16px 0 0"><button class="pill" data-toast="Rögzítve: alvás" data-close>Mentés</button></div>`),
  napJournal:()=>sh(['nap-naplo','nap-lista'],'Napló',ch('csak neked')+ch('ma, 14:10','soft'),`<div class="npopt" style="margin-bottom:12px">${['Napló','Döntés','Hála'].map((x,i)=>`<button class="${i?'':'on'}" data-npopt>${x}</button>`).join('')}</div><textarea class="npta" placeholder="Mi jár a fejedben?" aria-label="Napló"></textarea><div class="acts" style="margin:14px 0 0"><button class="pill" data-toast="Mentve a naplóba · +5 XP" data-close>Mentés</button><button class="pill soft" data-toast="Hallgatlak…">${G('mic','sage')}Diktálom</button></div>`),
  napAct:()=>sh(['nap-lista','nap-seta'],'Aktivitás',ch('bármi, ami számít'),`<textarea class="npta" placeholder="például: segítettem anyának bevásárolni" aria-label="Aktivitás"></textarea><div class="acts" style="margin:14px 0 0"><button class="pill" data-toast="+15 XP · Kapcsolat · a küldetés is teljesült" data-close>Rögzítem</button></div>`),
  napWrite:()=>sh(['nap-baratok','kave'],'Írj Mezónak',ch('írás vagy diktálás'),`<textarea class="npta" placeholder="Kérdezz, vagy mondd el, mi történt…" aria-label="Üzenet Mezónak"></textarea><div class="acts" style="margin:14px 0 0"><button class="pill" data-toast="Elküldve · Mezo válaszol" data-close>Küldés</button><button class="pill soft" data-toast="Hallgatlak…">${G('mic','sage')}Diktálom</button></div>`),
  napTeam:()=>sh(['nap-baratok','nap-ej'],'A csapat most erről beszél',ch(`${G('moon','sky')}Alvás`,'soft')+ch(`${G('shoe','peach')}Mozgás`,'soft'),`<div style="display:grid;gap:10px">${[['Alvás','moon','sky','Négy éjszakából háromszor 23 után feküdt le.'],['Mozgás','shoe','peach','Azokon a napokon 2 400 lépéssel kevesebb jött össze.'],['Mezo','spark','deep','Ma este 22:30-kor szólok. Ha sikerül, a minta megtörik.']].map(([w,ic,pal,t])=>`<div class="card npmsg" style="background:var(--paper);box-shadow:none"><div class="who"><span class="bd" style="background:#fff">${G(ic,pal)}</span><b>${w}</b></div><p>${t}</p></div>`).join('')}</div>`),
  napLab:i=>{const o=OBS[+i||0];return sh([+i?'salata':'nap-ej',+i?'edz-sulyzotarto':'nap-seta'],'Laborfüzet',ch(o[0],o[0]==='Figyelem'?'warm':'soft')+ch(o[5]),`<p style="font:600 15px/1.4 var(--d);margin:0 0 12px">${o[1]}</p><div class="card pad" style="background:var(--paper);box-shadow:none">${[['chart','deep','Mióta figyelem','12 napja'],['check','sage','Igaz volt','4 alkalommal'],['repeat','peach','Nem volt igaz','1 alkalommal'],['bell','sky','Mikor szólok','ha 7-ből 5 igaz']].map(([ic,pal,b,s])=>`<div class="row">${G(ic,pal)}<div><b>${b}</b><small>${s}</small></div></div>`).join('')}</div>`)},
  napChainNew:()=>sh(['nap-lista','reggelfeny','nap-alkony'],'Új lánc',ch('szokások egymás után'),`<label class="fld"><span>A lánc neve</span><input placeholder="például: munka utáni lánc" aria-label="A lánc neve"></label><p class="sub" style="margin-top:12px">Mikor?</p><div class="npopt">${['Reggel','Napközben','Este'].map((x,i)=>`<button class="${i===1?'on':''}" data-npopt>${x}</button>`).join('')}</div><div class="acts" style="margin:16px 0 0"><button class="pill" data-toast="Lánc létrehozva" data-close>Létrehozom</button></div>`),
  napAi:()=>sh(['nap-ej','nap-seta'],'Mezo javasol',ch('a mintáid alapján','soft'),`<div style="display:grid;gap:10px">${[['nap-ej','Telefon a nappaliban 22:00-tól','a késői lefekvés minta miatt'],['nap-seta','Tíz perc séta ebéd után','a délutáni energia-völgy ellen']].map(([p,t,s])=>`<div class="dl" style="grid-template-columns:44px minmax(0,1fr);box-shadow:none;background:var(--paper)"><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${t}</strong><div class="chips"><span class="chip">${s}</span></div><button class="pill soft" style="margin-top:8px;height:40px" data-npgo="nap-rutin-uj-1">Megnyitom a varázslóban</button></div></div>`).join('')}</div>`),
  napHabDel:()=>sh(['reggelfeny'],'Törlöd a szokást?',ch('a 29 nap előzmény megmarad','soft'),`<div class="acts" style="margin:6px 0 0"><button class="pill" data-nptoast="Törölve: reggeli napfény" data-npgo="nap-szokasok">Törlöm</button><button class="pill soft" data-close>Mégse</button></div>`)
});

/* ── behaviour ── */
const rerender=()=>{const h=location.hash.slice(1),sc=$('#scroll'),y=sc.scrollTop;sc.innerHTML=DOM.nap.render(h);sc.querySelectorAll('.rise').forEach(x=>x.classList.remove('rise'));sc.querySelectorAll('.pre').forEach(x=>x.classList.remove('pre'));sc.scrollTop=y};
const one=(btn)=>{[...btn.parentElement.children].forEach(b=>b.classList.toggle('on',b===btn))};
const hallFilter=()=>$$('#nphall .dl').forEach(a=>{a.style.display=(!NSZ.stage||a.dataset.stg===NSZ.stage)&&(!NSZ.q||a.textContent.toLowerCase().includes(NSZ.q))?'':'none'});
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;const q=s=>t.closest(s);let el;
  if(el=q('[data-npgo]')){e.preventDefault();e.stopPropagation();if(el.dataset.nptoast)toast(el.dataset.nptoast);location.hash=el.dataset.npgo;return}
  if(el=q('[data-npswitch]')){e.stopPropagation();openSheet(SHEETS[el.dataset.npswitch]());return}
  if(q('[data-npread]')){NB.notif=0;closeSheet();toast('Minden értesítés olvasott');if(location.hash.startsWith('#nap'))rerender();return}
  if(el=q('[data-npobs]')){NOBS.ack=el.dataset.npobs;$('#npobs').outerHTML=obsCard();haptic();return}
  if(el=q('[data-npo2]')){const [i,a]=el.dataset.npo2.split('|');el.parentElement.outerHTML=`<div class="npdone">${G('check','sage')}Köszönöm: ${a.toLowerCase()} · figyelem tovább</div>`;haptic();return}
  if(el=q('[data-npthumb]')){one(el);toast(el.dataset.npthumb==='1'?'Köszönöm, jó tudni':'Megjegyeztem, legközelebb pontosabb leszek');return}
  if(el=q('[data-nparea]')){const [d,i]=el.dataset.nparea.split('|');NV.open[d]=NV.open[d]||{};NV.open[d][i]=!NV.open[d][i];el.parentElement.classList.toggle('shut',NV.open[d][i]);el.setAttribute('aria-expanded',!NV.open[d][i]);return}
  if(el=q('[data-npfb]')){const [id,v]=el.dataset.npfb.split('|');MS.fb[id]=v;$('#msg-'+id).outerHTML=msgCard(MSGS.find(m=>m.id===id));haptic();return}
  if(el=q('[data-npwhy]')){const [id,v]=el.dataset.npwhy.split('|');MS.fb[id]=v;$('#msg-'+id).outerHTML=msgCard(MSGS.find(m=>m.id===id));return}
  if(el=q('[data-npact]')){const id=el.dataset.npact,m=MSGS.find(x=>x.id===id);MS.act[id]=1;$('#msg-'+id).outerHTML=msgCard(m);toast('Beállítva: '+m.act.toLowerCase());return}
  if(el=q('[data-npwhyo]')){const id=el.dataset.npwhyo;MS.open[id]=!MS.open[id];$('#msg-'+id).outerHTML=msgCard(MSGS.find(m=>m.id===id));return}
  if(el=q('[data-npold]')){const i=el.dataset.npold;MS.old[i]=!MS.old[i];el.classList.toggle('open',MS.old[i]);return}
  if(el=q('[data-npsend]')){const inp=el.parentElement.querySelector('input');if(inp.value.trim()){toast('Elküldve Mezónak');inp.value=''}else inp.focus();return}
  if(el=q('[data-nptick]')){const [dp,i]=el.dataset.nptick.split('|'),h=HAB[dp][+i];if(h[7]){if(!h[4]&&/víz/.test(h[7])){openSheet(SHEETS.napWater());return}toast(h[4]?`Ezt ${h[7]} látom, kézzel nem vonható vissza`:`Magától pipálódik, ${h[7]}`);return}h[4]=h[4]?0:1;haptic();const all=h[4]&&HAB[dp].every(x=>x[4]||NSK[x[0]]);if(h[4]){h[5]=Math.min(100,h[5]+1);if(!all)toast(`Kész: ${h[0].toLowerCase()} · +10 XP`);NT.last=[dp,HAB[dp].indexOf(h)]}rerender();tickAnim();if(all)celebrate(dp);return}
  if(el=q('[data-npswap]')){const i=+el.dataset.npswap;QST[i]=QALT;QS.swaps--;toast('Csere kész: '+QALT.t.toLowerCase());rerender();return}
  if(el=q('[data-npzs]')){NZ.score=+el.dataset.npzs;one(el);$('#npzv').textContent=NZ.score;haptic();return}
  if(el=q('[data-npzyn]')){NZ.yn=el.dataset.npzyn;one(el);haptic();return}
  if(q('[data-npzexit]')){location.hash='nap-mai-este';return}
  if(q('[data-npzdone]')){toast('A nap letéve · jó éjszakát');location.hash='nap-mai-lezart';return}
  if(q('[data-nplanced]')){NL.edit=!NL.edit;rerender();return}
  if(el=q('[data-npmv]')){const [i,d]=el.dataset.npmv.split('|').map(Number),L=HAB.reggel,j=i+d;if(j<0||j>=L.length)return;[L[i],L[j]]=[L[j],L[i]];rerender();return}
  if(el=q('[data-npstg]')){NSZ.stage=NSZ.stage===el.dataset.npstg?'':el.dataset.npstg;$$('.npstage button').forEach(b=>b.classList.toggle('on',b.dataset.npstg===NSZ.stage));hallFilter();haptic();return}
  if(el=q('[data-npset]')){const [k,v]=el.dataset.npset.split('|');NSE[k]=k==='eff'?+v:v;one(el);return}
  if(el=q('[data-npfw]')){NW.fw=el.dataset.npfw;one(el);return}
  if(el=q('[data-npopt]')){one(el);return}
  if(el=q('[data-npwater]')){const s=SIGS.find(x=>x[0]==='Víz');s[3]=Math.min(100,s[3]+6);closeSheet();toast(`+${el.dataset.npwater} ml víz · az életjel ${s[3]}%`);if(location.hash.startsWith('#nap'))rerender();return}
  if(el=q('[data-npkg]')){const k=$('#npkg'),v=parseFloat(k.textContent.replace(',','.'))+parseFloat(el.dataset.npkg.replace('−','-').replace(',','.'));k.textContent=v.toFixed(1).replace('.',',');return}
  /* check-in sheet */
  if(el=q('[data-ckv]')){CK.a[CKQ[CK.i][0]]=+el.dataset.ckv;haptic();ckPaint();return}
  if(el=q('[data-ckpain]')){CK.pain=el.dataset.ckpain;ckPaint();return}
  if(el=q('[data-ckreg]')){const r=el.dataset.ckreg;CK.reg=CK.reg.includes(r)?CK.reg.filter(x=>x!==r):[...CK.reg,r];ckPaint();return}
  if(q('[data-cknext]')){CK.i=Math.min(CKQ.length,CK.i+1);ckPaint();return}
  if(q('[data-ckback]')){CK.i=Math.max(0,CK.i-1);ckPaint();return}
  if(q('[data-ckend]')){CK.i=CKQ.length;ckPaint();return}
  if(q('[data-cksave]')){closeSheet();toast('Check-in mentve · 14:00');const s=SIGS.find(x=>x[0]==='Kapcsolat');s[3]=Math.min(100,s[3]+4);return}
},true);
document.addEventListener('input',e=>{if(e.target.classList.contains('npsq')){NSZ.q=e.target.value.trim().toLowerCase();hallFilter()}});

/* ── Package B (owner OK 2026-11-07): touch. Ticking a habit springs and links the chain, a perfect chain
   gets its moment; napló and habit rows swipe (Szerkesztem / Törlöm, Később / Ma kihagyom); a long press on
   a napló row or a message opens a quick menu; the tapped photo grows into the next page's head; A napom
   pages swipe between days; the energy arc and the check-in day line scrub under a finger. ── */
document.head.insertAdjacentHTML('beforeend',`<style>
.nplog li.sw{display:block;padding:0;position:relative;overflow:hidden;touch-action:pan-y}
.nplog .rc2{display:grid;grid-template-columns:44px 40px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;background:var(--card);position:relative;z-index:1;transition:transform .3s cubic-bezier(.2,.8,.2,1);user-select:none;-webkit-user-select:none}
.nplog li.dragging .rc2{transition:none}
.nplog .acts2{position:absolute;right:0;top:0;bottom:0;display:flex;gap:6px;align-items:center}
.nplog .acts2 button{height:calc(100% - 12px);min-width:84px;border:0;border-radius:14px;font:700 13px var(--b);color:#fff;background:var(--ink2);padding:0 10px}.nplog .acts2 button.del{background:#D9654F}
.nphab .row.sw .rc2{grid-template-columns:44px minmax(0,1fr) auto;user-select:none;-webkit-user-select:none}
.nphab .row.sw .acts2{gap:6px}.nphab .row.sw .acts2 button{min-width:84px;background:var(--ink2)}.nphab .row.sw .acts2 button.del{background:#E39565}
.nphab .npsk2 .rc2>div,.nphab .npsk2 .str{opacity:.55}.nphab .npsk2 .tick{border-style:dotted}
.npmsg{user-select:none;-webkit-user-select:none}
@keyframes nppop{0%{transform:scale(.6)}55%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes nplink{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.nphab .tick.pop{animation:nppop .45s cubic-bezier(.3,1.4,.5,1)}
.npchain button.pop img{animation:nppop .5s cubic-bezier(.3,1.4,.5,1)}.npchain i.pop{transform-origin:left;animation:nplink .4s ease-out}
.npcel{position:absolute;inset:0;z-index:45;display:grid;place-items:center;pointer-events:none;background:rgba(246,244,239,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .25s}
.npcel.on{opacity:1}
.npcel .cc{position:relative;display:grid;justify-items:center;gap:6px;padding:26px 30px;border-radius:30px;background:#fff;box-shadow:0 30px 60px -24px rgba(0,0,0,.4);transform:scale(.85);transition:transform .35s cubic-bezier(.3,1.4,.5,1)}
.npcel.on .cc{transform:none}.npcel .cc .g{font-size:64px}.npcel b{font:800 24px var(--d);letter-spacing:-.02em}.npcel small{font:700 13px var(--b);color:var(--deep)}
.npcel .cc i{position:absolute;left:50%;top:40%;width:10px;height:10px;border-radius:50%;opacity:0;animation:npburst .9s ease-out .1s forwards}
@keyframes npburst{0%{opacity:1;transform:translate(-50%,-50%) rotate(var(--a)) translateY(0)}100%{opacity:0;transform:translate(-50%,-50%) rotate(var(--a)) translateY(-90px)}}
.nfly{position:absolute;z-index:40;object-fit:cover;pointer-events:none;box-shadow:0 24px 40px -18px rgba(0,0,0,.45);transition:left .46s cubic-bezier(.2,.8,.2,1),top .46s cubic-bezier(.2,.8,.2,1),width .46s cubic-bezier(.2,.8,.2,1),height .46s cubic-bezier(.2,.8,.2,1),border-radius .46s,opacity .18s}
@keyframes npinl{from{transform:translateX(-36px);opacity:.3}to{transform:none;opacity:1}}@keyframes npinr{from{transform:translateX(36px);opacity:.3}to{transform:none;opacity:1}}
.npin-l{animation:npinl .26s cubic-bezier(.2,.8,.2,1)}.npin-r{animation:npinr .26s cubic-bezier(.2,.8,.2,1)}
.npz .scrb i{background:#fff}.npz .scrb b{background:#fff;color:#1B2230}
body.still .nphab .tick.pop,body.still .npchain .pop,body.still .npchain .pop img,body.still .npin-l,body.still .npin-r,body.still .npcel .cc i{animation:none}
@media (prefers-reduced-motion:reduce){.nphab .tick.pop,.npchain .pop,.npchain .pop img,.npin-l,.npin-r,.npcel .cc i{animation:none}}
</style>`);
/* ticking: spring, link, and the perfect-chain moment */
const NT={last:null};
const tickAnim=()=>{const L=NT.last;NT.last=null;if(!L||stillN())return;const [dp,i]=L;const t=$(`#nphab [data-nptick="${dp}|${i}"]`);if(t)t.classList.add('pop');const nodes=$$('.npchain button'),links=$$('.npchain i');if(nodes[i])nodes[i].classList.add('pop');if(links[i-1])links[i-1].classList.add('pop')};
const stillN=()=>document.body.classList.contains('still')||matchMedia('(prefers-reduced-motion:reduce)').matches;
const celebrate=(dp)=>{haptic();if(stillN()){toast('Tökéletes lánc · +25 XP');return}const o=document.createElement('div');o.className='npcel';o.setAttribute('role','status');
  o.innerHTML=`<div class="cc">${G('star','sun')}<b>Tökéletes lánc</b><small>${DPN[dp][0]}i lánc · +25 XP</small>${Array.from({length:10},(_,k)=>`<i style="--a:${k*36}deg;background:${['#F4C860','#7CC39F','#F0B48C','#8CC3E8','#C9A8E8'][k%5]}"></i>`).join('')}</div>`;
  $('#phone').appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));setTimeout(()=>{o.classList.remove('on');setTimeout(()=>o.remove(),300)},1700)};
/* the long-press quick menu (napló rows, messages) */
let NLP=null;
const nlpOpen=el=>{let img='',title='',sub='',items=[];
  if(el.matches('[data-nplp]')){const [b,p,t]=el.dataset.nplp.split('|');img=isPh(p)?`<img src="${PH(p+'.jpg')}" alt="">`:'';title=b;sub=t+' · '+el.querySelector('small').textContent;
    items=[['Szerkesztem','pen',logEdit(b)],['Napló a nap végén','book','data-go="nap-napom"'],['Törlöm','back','data-npdellp','del']]}
  else{const id=el.id.slice(4),m=MSGS.find(x=>x.id===id);title=m.who;sub=m.t;img=`<img src="${PH({'Alvás':'nap-ej','Mozgás':'nap-seta','Étkezés':'salata','Közérzet':'nap-baratok','Mezo':'kave'}[m.who]+'.jpg')}" alt="">`;
    items=[['Segített','thumb',`data-npfb="${id}|ok"`],['Nem talált','thumbd',`data-npfb="${id}|bad"`],...(m.act&&!MS.act[id]?[[m.act,'clock',`data-npact="${id}"`]]:[]),['Válaszolok','chat','data-npreply']]}
  haptic();const o=document.createElement('div');o.className='peek';o.innerHTML=`<div class="pc">${img}<div class="pt"><b>${title}</b><small>${sub}</small></div><div class="pm">${items.map(([l,ic,a,c])=>`<button class="${c||''}" ${a}>${l} ${G(ic,'ink')}</button>`).join('')}</div></div>`;
  $('#phone').appendChild(o);NLP.menu=o;NLP.el=el;requestAnimationFrame(()=>o.classList.add('on'));
  o.addEventListener('click',e=>{const b=e.target.closest('button');if(e.target===o||b){if(b&&b.hasAttribute('data-npdellp')){const del=el.closest('li').querySelector('[data-delrow]');del&&del.click()}if(b&&b.hasAttribute('data-npreply')){const i=$('.npcomp input');i&&setTimeout(()=>i.focus(),250)}o.classList.remove('on');setTimeout(()=>o.remove(),200)}})};
document.addEventListener('pointerdown',e=>{const el=e.target.closest('[data-nplp],.npmsg');if(!el||!el.closest('#scroll')||e.target.closest('button,a'))return;NLP={x:e.clientX,y:e.clientY,t:setTimeout(()=>{NLP.fired=true;nlpOpen(el)},480)}},{passive:true});
document.addEventListener('pointermove',e=>{if(NLP&&!NLP.fired&&(Math.abs(e.clientX-NLP.x)>8||Math.abs(e.clientY-NLP.y)>8)){clearTimeout(NLP.t);NLP=null}},{passive:true});
document.addEventListener('pointerup',()=>{if(!NLP)return;clearTimeout(NLP.t);if(NLP.fired){const stop=ev=>{if(ev.target.closest&&ev.target.closest('.peek'))return;ev.stopPropagation();ev.preventDefault();document.removeEventListener('click',stop,true)};document.addEventListener('click',stop,true);setTimeout(()=>document.removeEventListener('click',stop,true),300)}NLP=null});
document.addEventListener('pointercancel',()=>{if(NLP){clearTimeout(NLP.t);NLP=null}});
window.addEventListener('hashchange',()=>$$('.peek').forEach(x=>x.remove()));
/* the tapped photo grows into the next page's head */
let NFLY=null;
const NFLY_SEL='.dl,.npql button,.npq article,.npchain button,.npkind button';
document.addEventListener('click',e=>{const t=e.target.closest('[data-go]');if(!t||!t.closest('#scroll')||stillN()||!location.hash.startsWith('#nap'))return;const g=t.dataset.go;if(!/^nap-/.test(g))return;const c=t.closest(NFLY_SEL)||t,img=c.querySelector('img');if(!img)return;const r=img.getBoundingClientRect(),ph=$('#phone').getBoundingClientRect();NFLY={src:img.currentSrc||img.src,r:[r.left-ph.left,r.top-ph.top,r.width,r.height],br:getComputedStyle(img).borderRadius,at:Date.now()}},true);
const nflyIn=()=>{const F=NFLY;NFLY=null;if(!F||Date.now()-F.at>1500)return;const tg=$('#scroll .phead img.bg');if(!tg)return;const ph=$('#phone').getBoundingClientRect(),tr=tg.getBoundingClientRect();
  const el=document.createElement('img');el.src=F.src;el.className='nfly';el.alt='';const [x,y,w,h]=F.r;Object.assign(el.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px',borderRadius:F.br});$('#phone').appendChild(el);tg.style.opacity='0';
  el.getBoundingClientRect();Object.assign(el.style,{left:(tr.left-ph.left)+'px',top:(tr.top-ph.top)+'px',width:tr.width+'px',height:tr.height+'px',borderRadius:'0px'});
  setTimeout(()=>{tg.style.opacity='';el.style.opacity='0';setTimeout(()=>el.remove(),200)},470)};
/* A napom: swipe between days */
const NDAYS=['nap-napom-21','nap-napom-22','nap-napom-23','nap-napom','nap-napom-25','nap-napom-26','nap-napom-27'];
let NSW=null,NSWD='';
document.addEventListener('pointerdown',e=>{const h=location.hash.slice(1);if(!NDAYS.includes(h)||!e.target.closest('#scroll')||e.target.closest('[data-swipe],[data-scrub],.npweek,input,textarea'))return;NSW={x:e.clientX,y:e.clientY,h}},{passive:true});
document.addEventListener('pointerup',e=>{if(!NSW)return;const dx=e.clientX-NSW.x,dy=e.clientY-NSW.y,i=NDAYS.indexOf(NSW.h);NSW=null;if(Math.abs(dx)<70||Math.abs(dy)>50)return;const j=i+(dx<0?1:-1);if(j<0||j>=NDAYS.length)return;NSWD=dx<0?'r':'l';haptic();const stop=ev=>{ev.stopPropagation();ev.preventDefault();document.removeEventListener('click',stop,true)};document.addEventListener('click',stop,true);setTimeout(()=>document.removeEventListener('click',stop,true),300);location.hash=NDAYS[j]});
const swIn=()=>{if(!NSWD)return;const d=NSWD;NSWD='';if(stillN())return;const b=$('#scroll .body');if(b){b.classList.add('npin-'+d);setTimeout(()=>b.classList.remove('npin-'+d),300)}};
/* skip / later */
SHEETS.napSkip=name=>sh(['nap-lista','nap-tea'],'Ma kihagyom',ch(name,'soft')+ch('holnap újra jön'),`<p class="sub">Miért? (nem kötelező)</p><div class="npopt" style="margin-bottom:14px">${['Nincs időm','Fáradt vagyok','Beteg vagyok','Úton vagyok','Egyéb'].map(x=>`<button data-npskr="${x}">${x}</button>`).join('')}</div><div class="acts" style="margin:0"><button class="pill" data-npskip="${name}">Kihagyom</button><button class="pill soft" data-close>Mégse</button></div>`);
const NSKR={r:''};
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;let el;
  if(el=t.closest('[data-npskr]')){NSKR.r=el.dataset.npskr;one(el);return}
  if(el=t.closest('[data-npskip]')){e.stopPropagation();NSK[el.dataset.npskip]=NSKR.r?'ma kihagyva · '+NSKR.r.toLowerCase():'ma kihagyva · holnap újra jön';NSKR.r='';closeSheet();toast('Kihagyva mára · a lánc nem szakad meg');rerender();return}
  if(el=t.closest('[data-npunskip]')){e.stopPropagation();delete NSK[el.dataset.npunskip];toast('Visszavéve');rerender();return}
  if(el=t.closest('[data-nplater]')){e.stopPropagation();const [dp,i]=el.dataset.nplater.split('|'),L=HAB[dp],[h]=L.splice(+i,1);L.push(h);toast(`Később: ${h[0].toLowerCase()} a lánc végére került`);rerender();return}
},true);

/* ── Package C (owner OK 2026-11-09): Nap outside the app. Home-screen widgets that work (életjel average,
   water +250, the next habit's tick, the next check-in), a notification you answer without opening the app
   (the check-in, an advice with its action), and the evening reminder on the lock screen. Routes
   nap-kezdo · nap-ertesites · nap-esti open over Mai; the Több sheet and the side panel lead there. ── */
document.head.insertAdjacentHTML('beforeend',`<style>
.lkx.npx .wall{pointer-events:none}.lkx.npx img{-webkit-user-drag:none}.lkx.npx .wall{filter:blur(16px) brightness(.88) saturate(.9);transform:scale(1.15)}
.lkx.npx.esti .wall{filter:saturate(.85) brightness(.62);transform:none}
.lkx.npx.esti::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,0) 40%,rgba(0,0,0,.45));pointer-events:none}
.lkx.npx .npxcap{position:absolute;left:50%;top:56px;transform:translateX(-50%);white-space:nowrap;font:700 12px var(--b);background:rgba(0,0,0,.5);padding:7px 12px;border-radius:12px;z-index:3}
.lkx.npx .npwg{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:40px 22px 0}
.npwg .wd{border-radius:24px;background:rgba(255,255,255,.88);color:var(--ink);padding:14px;display:grid;gap:6px;align-content:space-between;min-height:150px;box-shadow:0 14px 30px -18px rgba(0,0,0,.5);text-align:left;border:0;justify-items:start}
.npwg .wd.w2{grid-column:1/-1;min-height:0;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px}
.npwg .wd .hd2{display:flex;align-items:center;gap:6px;font:700 12px var(--b);color:var(--ink2);text-transform:uppercase;letter-spacing:.05em}.npwg .wd .hd2 .mark{width:18px;height:18px}
.npwg .wd b{display:block;font:700 17px/1.15 var(--d)}.npwg .wd small{font:700 12px var(--b);color:var(--ink2)}
.npwg .wd .rw{margin:0}.npwg .wd .rc b{font-size:18px}
.npwg .wd .lv{display:block;height:10px;border-radius:5px;background:rgba(30,35,33,.1);overflow:hidden}.npwg .wd .lv i{display:block;height:100%;width:var(--w);background:linear-gradient(90deg,#C9E4F6,#6FAFDD);border-radius:5px;transition:width .4s}
.npwg .wd .wb{min-height:40px;border-radius:999px;border:0;background:var(--ink);color:#fff;font:700 13px var(--b);padding:0 14px;display:inline-flex;align-items:center;gap:6px;justify-self:start}
.npwg .wd .wb.s{background:#E4F0F8;color:#2F5F80}.npwg .wd .wb .g{font-size:16px}
.npwg .wd img{width:56px;height:56px;border-radius:16px;object-fit:cover}
.npwg .wd .tk{width:44px;height:44px;border-radius:50%;border:2px solid rgba(30,35,33,.2);background:#fff;display:grid;place-items:center;padding:0}.npwg .wd .tk.on{background:var(--sage);border-color:var(--sage)}.npwg .wd .tk svg{width:22px;height:22px}
.npwg .wd .dots{display:flex;gap:4px;margin-top:4px}.npwg .wd .dots i{width:16px;height:5px;border-radius:3px;background:rgba(30,35,33,.15)}.npwg .wd .dots i.d{background:var(--sage)}
.lkx.npx .npapps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;padding:26px 28px 0}
.lkx.npx .npapps span{display:grid;justify-items:center;gap:6px;font:700 12px var(--b)}.lkx.npx .npapps i{display:block;width:100%;aspect-ratio:1;border-radius:22%;background:rgba(255,255,255,.3)}
.lkx.npx .npapps .npmz{display:block;background:none;border-radius:22%;overflow:hidden}.lkx.npx .npapps .npmz .mark{display:block;width:100%;height:auto}
.lkx.npx .npban{margin:10px 10px 0;border-radius:24px;background:rgba(245,245,245,.92);color:var(--ink);padding:12px 14px;display:grid;gap:8px;box-shadow:0 18px 36px -18px rgba(0,0,0,.55);transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .3s}
.lkx.npx .npban.gone{transform:translateY(-130%);opacity:0}
.lkx.npx.esti .npban{background:rgba(30,34,40,.62);color:#fff;-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}
.npban .nh{display:flex;align-items:center;gap:8px;font:700 12px var(--b);color:var(--ink2)}.npban .nh .mark{width:20px;height:20px}.npban .nh span{margin-left:auto}
.lkx.npx.esti .npban .nh,.lkx.npx.esti .npban small{color:rgba(255,255,255,.72)}
.npban b{font:700 15px var(--d)}.npban p{margin:0;font:600 13.5px/1.35 var(--b)}
.npban .sc5{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.npban .sc5 button{min-height:42px;border-radius:12px;border:0;background:#fff;font:700 15px var(--d);color:var(--ink)}
.npban .na2{display:flex;gap:8px}.npban .na2 button{flex:1;min-height:44px;border-radius:12px;border:0;background:#fff;font:700 13px var(--b);color:var(--ink)}.npban .na2 button.p{background:var(--sage3);color:var(--deep)}
.lkx.npx.esti .npban .na2 button{background:rgba(255,255,255,.16);color:#fff}.lkx.npx.esti .npban .na2 button.p{background:#F4C860;color:#1B2230}
.npban .ok{display:flex;gap:8px;align-items:center;font:700 13px var(--b);color:var(--deep)}.npban .ok .g{font-size:20px}
.lkx.npx .npstack{margin-top:22px}
.lkx.npx .lkb2{position:absolute;left:0;right:0;bottom:12px;display:grid;justify-items:center;gap:12px;z-index:2}.lkx.npx .lkb2 small{font:600 13px var(--b);color:rgba(255,255,255,.8)}.lkx.npx .lkb2 .hbar{width:134px;height:5px;border-radius:3px;background:#fff}
.w320 .lkx.npx .npwg{gap:12px;padding:34px 14px 0}.w320 .npwg .wd{min-height:136px}.w320 .lkx.npx .npapps{padding:20px 24px 0;gap:14px}.w320 .lkx.npx .hdock{gap:16px;padding:14px}
</style>`);
const NX={el:null,kind:'',ans:[],wat:1.4,snooze:false,adv:false};
const nxNext=()=>HAB.napkozben.find(h=>!h[4]&&!NSK[h[0]]&&!h[7]);
const nxWidgets=()=>{const n=nxNext(),L=HAB.napkozben;return `<div class="npwg">
  <button class="wd" data-nxgo="nap-eletjel" aria-label="Életjelek csempe: átlag ${sigAvg()}"><span class="hd2">${MARK(18)}Nap</span>${ring({d:62,sw:7,p:sigAvg()/100,c:'#5FB08A',val:sigAvg()})}<div><b>Életjelek</b><small>a mozgás kér figyelmet</small></div></button>
  <div class="wd" role="group" aria-label="Víz csempe"><span class="hd2">${G('drop','sky')}Víz</span><div><b id="nxw">${String(NX.wat.toFixed(2)).replace(/0$/,'').replace('.',',')} liter</b><small>a cél 2,5 liter</small></div><span class="lv"><i id="nxwl" style="--w:${Math.min(100,NX.wat/2.5*100)}%"></i></span><button class="wb s" data-nxwater>${G('plus','sky')}250 ml</button></div>
  <div class="wd w2" role="group" aria-label="Rutin csempe">${n?`<img src="${PH(n[2]+'-sq.jpg')}" alt=""><div><span class="hd2">${MARK(18)}Napközbeni lánc</span><b>${n[0]}</b><span class="dots">${L.map(h=>`<i class="${h[4]?'d':''}"></i>`).join('')}</span></div><button class="tk" data-nxtick aria-label="${n[0]}: pipálom"></button>`:`<img src="${PH('nap-alkony-sq.jpg')}" alt=""><div><span class="hd2">${MARK(18)}Napközbeni lánc</span><b>Kész a lánc</b><small>+25 XP</small></div><span class="tk on">${ck()}</span>`}</div>
  <div class="wd w2" role="group" aria-label="Check-in csempe"><img src="${PH('kave-sq.jpg')}" alt=""><div><span class="hd2">${G('clock','sky')}Most jön · 14:00</span><b>Délutáni check-in</b><small>négy koppintás</small></div><button class="wb" data-nxgo="nap|napCheckin">Kitöltöm</button></div></div>`};
const nxApps=()=>`<div class="npapps"><span><i class="npmz">${MARK(64)}</i>Mezo</span>${'<span><i></i></span>'.repeat(7)}</div><div class="hdock">${'<i></i>'.repeat(4)}</div>`;
const nxStb=t=>`<div class="stb"><b>${t}</b><span class="bat"><span class="sig"><u style="height:5px"></u><u style="height:8px"></u><u style="height:11px"></u><u style="height:14px"></u></span><i></i></span></div>`;
const nxCk=()=>{const Q=['Mennyi energiád van most?','Milyen a kedved?'];const i=NX.ans.length;
  return i<2?`<div class="nh">${MARK(20)}Mezo<span>most</span></div><b>Délutáni check-in · ${i+1} / 2</b><p>${Q[i]}</p><div class="sc5">${[2,4,6,8,10].map(v=>`<button data-nxans="${v}">${v}</button>`).join('')}</div><div class="na2"><button data-nxgo="nap|napCheckin">Mind a négy kérdés</button><button data-nxlater>Később</button></div>`
   :`<div class="nh">${MARK(20)}Mezo<span>most</span></div><div class="ok">${G('check','sage')}Mentve · energia ${NX.ans[0]}, kedv ${NX.ans[1]}</div><p>A másik kettőt este kérdezem.</p>`};
const nxAdv=()=>`<div class="nh">${MARK(20)}Mezo · Alvás<span>07:05</span></div><b>23:20-kor feküdtél le</b><p>Ma este próbáljuk 22:45-öt.</p>${NX.adv?`<div class="ok">${G('check','sage')}Szólok 22:30-kor</div>`:`<div class="na2"><button class="p" data-nxadv>Emlékeztess 22:30-kor</button><button data-nxgo="nap-beszelgetes">Megnyitom</button></div>`}`;
const nxEve=()=>NX.snooze?`<div class="nh">${MARK(20)}Mezo<span>21:30</span></div><div class="ok" style="color:#F4C860">${G('clock','sun')}Rendben, 22:00-kor újra szólok</div>`
  :`<div class="nh">${MARK(20)}Mezo<span>most</span></div><b>Tegyük le a napot</b><p>3 / 6 terület kész · négy perc az egész, a végén látod a nap termését.</p><div class="na2"><button class="p" data-nxgo="nap-zaras-1">Indítom</button><button data-nxsnooze>30 perc múlva</button></div>`;
function nxOpen(kind){nxClose(true);NX.kind=kind;NX.ans=[];NX.snooze=false;NX.adv=false;const o=document.createElement('div');o.className='lkx npx '+kind;o.setAttribute('role','dialog');
  o.setAttribute('aria-label',{kezdo:'Kezdőképernyő Mezo-csempékkel',ertesites:'Értesítés egy másik appban',esti:'Zárolt képernyő este'}[kind]);
  o.innerHTML=kind==='esti'
   ?`<img class="wall" src="${PH('nap-ej.jpg')}" alt=""><span class="pill0"></span><div class="lkt"><small>csütörtök, szeptember 24.</small><b>21:30</b></div><div class="npstack"><div class="npban" id="nxeve">${nxEve()}</div><div class="npban"><div class="nh">${MARK(20)}Mezo · Rutin<span>21:00</span></div><b>Esti lánc · 2 / 5</b><p>21:45 lecsendesítés, 22:30 villanyoltás.</p></div></div><div class="lkb2"><small>Koppints egy értesítésre, vagy húzd fel: visszajutsz</small><span class="hbar"></span></div>`
   :kind==='ertesites'
   ?`<img class="wall" src="${PH('taj.jpg')}" alt="">${nxStb('14:02')}<div class="npban" id="nxck">${nxCk()}</div><div class="npban" id="nxadv">${nxAdv()}</div>${nxApps()}<div class="lkb2"><span class="hbar"></span></div>`
   :`<img class="wall" src="${PH('taj.jpg')}" alt="">${nxStb('14:10')}<span class="npxcap">Előnézet · a kezdőképernyőd Mezo-csempékkel</span>${nxWidgets()}${nxApps()}<div class="lkb2"><span class="hbar"></span></div>`;
  $('#phone').appendChild(o);NX.el=o;requestAnimationFrame(()=>o.classList.add('on'));if(kind==='kezdo')setTimeout(()=>{const c=o.querySelector('.npxcap');c&&(c.style.opacity='0')},3200)}
function nxClose(silent){const o=NX.el;NX.el=null;if(!o)return;if(silent||stillN())o.remove();else{o.classList.add('out');setTimeout(()=>o.remove(),320)}}
const nxGo=to=>{const [h,sheet]=to.split('|');nxClose(false);location.hash=h;if(sheet)setTimeout(()=>openSheet(SHEETS[sheet]()),380)};
document.addEventListener('click',e=>{if(!NX.el||!NX.el.contains(e.target))return;const t=e.target;let el;e.stopPropagation();
  if(el=t.closest('[data-nxgo]')){nxGo(el.dataset.nxgo);return}
  if(t.closest('[data-nxwater]')){NX.wat+=.25;const s2=SIGS.find(x=>x[0]==='Víz');s2[3]=Math.min(100,s2[3]+6);haptic();$('#nxw').textContent=String(NX.wat.toFixed(2)).replace(/0$/,'').replace('.',',')+' liter';$('#nxwl').style.setProperty('--w',Math.min(100,NX.wat/2.5*100)+'%');return}
  if(t.closest('[data-nxtick]')){const n=nxNext();if(n){n[4]=1;haptic()}const g=NX.el.querySelector('.npwg');g.outerHTML=nxWidgets();if(!nxNext()&&HAB.napkozben.every(h=>h[4]||NSK[h[0]]||h[7]))celebrate('napkozben');return}
  if(el=t.closest('[data-nxans]')){NX.ans.push(+el.dataset.nxans);haptic();$('#nxck').innerHTML=nxCk();if(NX.ans.length>=2){const s2=SIGS.find(x=>x[0]==='Kapcsolat');s2[3]=Math.min(100,s2[3]+4);setTimeout(()=>{const b=$('#nxck');b&&b.classList.add('gone')},1600)}return}
  if(t.closest('[data-nxlater]')){$('#nxck').classList.add('gone');return}
  if(t.closest('[data-nxadv]')){NX.adv=true;$('#nxadv').innerHTML=nxAdv();haptic();return}
  if(t.closest('[data-nxsnooze]')){NX.snooze=true;$('#nxeve').innerHTML=nxEve();haptic();return}
  if(NX.kind==='esti'&&t.closest('.npban')){nxGo('nap-mai-este');return}
  if(t.closest('.npapps .npmz')){nxGo('nap');return}},true);
let NXD=null;
document.addEventListener('pointerdown',e=>{if(NX.el&&NX.el.contains(e.target)&&!e.target.closest('button,.wd'))NXD={y:e.clientY}},true);
document.addEventListener('pointermove',e=>{if(NXD&&NX.el){const d=Math.min(0,e.clientY-NXD.y);if(d<-6){NX.el.style.transition='none';NX.el.style.transform=`translateY(${d}px)`}}},true);
document.addEventListener('pointerup',e=>{if(!NXD||!NX.el){NXD=null;return}const d=e.clientY-NXD.y;NX.el.style.transition='';NX.el.style.transform='';NXD=null;if(d<-90){const stop=ev=>{ev.stopPropagation();ev.preventDefault();document.removeEventListener('click',stop,true)};document.addEventListener('click',stop,true);setTimeout(()=>document.removeEventListener('click',stop,true),300);nxGo(NX.kind==='esti'?'nap-mai-este':'nap')}},true);
document.addEventListener('pointercancel',()=>{if(NXD&&NX.el){NX.el.style.transition='';NX.el.style.transform=''}NXD=null},true);
window.addEventListener('hashchange',()=>{if(NX.el&&!/^#nap-(kezdo|ertesites|esti)$/.test(location.hash))nxClose(true)});

/* ── register ── */
const NTAB=['nap',...STATESN.filter(s=>s[0]).map(s=>'nap-mai-'+s[0]),'nap-napom','nap-napom-reggel','nap-napom-betolt','nap-napom-hiba','nap-beszelgetes','nap-beszelgetes-eletjelek','nap-beszelgetes-eszrevetelek','nap-rutin','nap-rutin-reggel','nap-rutin-napkozben','nap-rutin-este','nap-rutin-tegnap'];
const NBSP=x=>x.replace(/(\d) (g|perc|óra|pont|kalória|liter|ml|kg|szett|nap|XP|lépés)(?=[\s.,:;!?<)])/g,'$1&nbsp;$2');
const R0=h=>{let m;
  if(h==='nap')return mai('');if(m=h.match(/^nap-mai-(\w+)$/))return mai(m[1]);
  if(h==='nap-napom')return napom();if(h==='nap-napom-reggel')return napom('23',true);if(m=h.match(/^nap-napom-(\d+|betolt|hiba)$/))return napom(m[1]);
  if(h==='nap-beszelgetes')return besz();if(m=h.match(/^nap-beszelgetes-(\w+)$/))return besz(m[1]);
  if(h==='nap-rutin-epites')return epites();if(m=h.match(/^nap-rutin-uj-(\d)$/))return ujszokas(m[1]);
  if(h==='nap-rutin-tegnap')return rutin('reggel',true);if(h==='nap-rutin')return rutin();if(m=h.match(/^nap-rutin-(reggel|napkozben|este)$/))return rutin(m[1]);
  if(h==='nap-checkin')return checkin();if(h==='nap-eletjel')return eletjel();if(h==='nap-kuldetesek')return kuldetes();if(h==='nap-gyors')return gyors();
  if(m=h.match(/^nap-zaras-(\d)$/))return zaras(m[1]);if(h==='nap-zaras')return zaras(1);
  if(/^nap-(kezdo|ertesites|esti)$/.test(h))return mai(h==='nap-esti'?'este':'');if(h==='nap-lanc')return lanc();if(h==='nap-szokasok')return szokasok();if(h==='nap-szokas')return szokas();if(h==='nap-szokas-szerk')return szerk();
  return mai('')};
const R=h=>NBSP(R0(h));
DOM.nap={tabs:NTAB,render:R,tabName:h=>/napom/.test(h)?'A napom':/beszelgetes/.test(h)?'Beszélgetés':/rutin/.test(h)?'Rutin':'Mai',
  after:h=>{$('#phone').classList.toggle('npzon',/^nap-zaras/.test(h));nflyIn();swIn();{const m=h.match(/^nap-(kezdo|ertesites|esti)$/);if(m)nxOpen(m[1])}if(NTAB.includes(h)){const ac=$('#cba'),ru=/rutin/.test(h);ac.style.visibility='visible';ac.innerHTML=ru?G('pen','ink'):G('plus','ink');ac.setAttribute('aria-label',ru?'Rutin szerkesztése':'Gyors logolás');ac.onclick=()=>location.hash=ru?'nap-rutin-epites':'nap-gyors'}if(/^nap-beszelgetes/.test(h))NB.unread=0;if(/^nap-szokasok$/.test(h)){NSZ.q='';NSZ.stage=''}}};
window.addEventListener('hashchange',()=>{if(!/^#nap-zaras/.test(location.hash))$('#phone').classList.remove('npzon')});

/* side panel: Nap notes while the domain is open */
const notes=document.querySelector('.notes');
const NNOTES=()=>`<h2>Lágy irány · Nap</h2><small>Állapot: 2026-11-09 · a Nap · az appon kívül</small><p><b>Legutóbb változott · 2026-11-09 · az appon kívül:</b> <a href="#nap-kezdo">kezdőképernyő-csempék</a> (életjel, víz +250 ml, a következő szokás pipája, a check-in), <a href="#nap-ertesites">értesítés</a>, amire az appon kívül is válaszolhatsz, és az <a href="#nap-esti">esti emlékeztető</a> a zárolt képernyőn. A Mai fül „Több” ablakából is elérhető.</p><p><b>Előtte · 2026-11-07 · tapintás:</b> pipáláskor rugózik a pipa és összekapcsolódik a lánc, a tökéletes láncnak saját pillanata van (<a href="#nap-rutin">Rutin</a>); a napló és a szokások sorai oldalra húzhatók; hosszan nyomva egy naplósor vagy üzenet gyors menüt nyit; a koppintott fotó átnő a következő oldal tetejére; <a href="#nap-napom">A napom</a> oldalain oldalra húzva lapozol a napok között; az <a href="#nap-zaras-2">energiaíven</a> és a <a href="#nap-checkin">check-in vonalán</a> végighúzhatod az ujjad.</p><p><b>Előtte · 2026-11-07 · rend:</b> kevesebb ismétlés a Main; harang és „+” a fejlécben, jelzés a füleken; letisztult üzenetek, az írósáv alul marad; reggel <a href="#nap-napom-reggel">a tegnapod</a> vár; betöltés és hiba állapot; a Rutinon egy navigációs sor, az adatból jövő szokások zárolva; a check-inben testrajz a fájdalomhoz.</p><p><b>Előtte · 2026-11-06:</b> a Nap az új nyelven, új fotókkal; az app a Napon nyílik.</p>
  <p><b>A Mai fül állapotai:</b></p><ul>${STATESN.map(([k,l])=>`<li><a href="#nap${k?'-mai-'+k:''}">${l}</a></li>`).join('')}</ul>
  <p><b>A napom:</b></p><ul><li><a href="#nap-napom">ma, élőben</a> · <a href="#nap-napom-reggel">reggel (a tegnapod)</a> · <a href="#nap-napom-betolt">betöltés</a> · <a href="#nap-napom-hiba">hiba</a></li><li><a href="#nap-napom-22">egy lezárt nap (kedd, 87)</a></li><li><a href="#nap-napom-23">tegnap (81)</a></li><li><a href="#nap-napom-21">kevés adat (hétfő)</a></li><li><a href="#nap-napom-25">egy jövőbeli nap</a></li></ul>
  <p><b>Beszélgetés:</b></p><ul><li><a href="#nap-beszelgetes">Üzenetek</a></li><li><a href="#nap-beszelgetes-eletjelek">Életjelek</a></li><li><a href="#nap-beszelgetes-eszrevetelek">Észrevételek</a></li></ul>
  <p><b>Rutin:</b></p><ul><li><a href="#nap-rutin">napközben (most)</a> · <a href="#nap-rutin-reggel">reggel</a> · <a href="#nap-rutin-este">este</a> · <a href="#nap-rutin-tegnap">tegnap</a></li><li><a href="#nap-rutin-epites">rutinépítés</a> → <a href="#nap-lanc">egy lánc</a>, <a href="#nap-szokasok">szokásaid</a>, <a href="#nap-szokas">egy szokás</a>, <a href="#nap-szokas-szerk">szerkesztés</a>, <a href="#nap-rutin-uj-1">új szokás</a></li></ul>
  <p><b>Belső oldalak:</b></p><ul><li><a href="#nap-checkin">Check-in</a> · <a href="#nap-eletjel">Életjelek</a> · <a href="#nap-kuldetesek">Napi küldetések</a> · <a href="#nap-gyors">Gyors logolás</a></li><li><a href="#nap-zaras-1">Napzárás</a> (hat lépés)</li></ul>`;
const setN=on=>{if(!notes)return;const has=document.getElementById('nnotes');if(on&&!has){[...notes.children].forEach(c=>{if(!c.classList.contains('tog')){c.dataset.fh=1;c.style.display='none'}});const d=document.createElement('div');d.id='nnotes';d.innerHTML=NNOTES();notes.insertBefore(d,notes.firstChild);const t=notes.querySelector('.tog');if(t)d.insertBefore(t,d.children[2]||null)}
  else if(!on&&has){const t=has.querySelector('.tog');if(t){const ref=[...notes.children].find(c=>c.dataset.fh&&c.tagName==='P'&&c.previousElementSibling&&c.previousElementSibling.tagName==='SMALL');notes.insertBefore(t,ref?ref.nextSibling:null)}has.remove();if(!document.getElementById('enotes'))[...notes.children].forEach(c=>{if(c.dataset.fh){c.style.display='';delete c.dataset.fh}})}};
window.addEventListener('hashchange',()=>setN(/^#nap(-|$)/.test(location.hash)));
/* the app opens on Nap; Fuel keeps its own (bare) routes behind the bottom bar */
if(!location.hash||location.hash==='#')history.replaceState(null,'','#nap');
setN(/^#nap(-|$)/.test(location.hash));
['nap-seta','kave','nap-baratok','reggelfeny','nap-alkony'].forEach(n=>{const im=new Image();im.src=PH(n+'.jpg');if(im.decode)im.decode().catch(()=>{});TABPH.push(im)});
})();
