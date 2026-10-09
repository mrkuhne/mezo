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
${Q} .btn{white-space:nowrap}${Q} .sheet .fh-acts{row-gap:12px}${Q} .sheet .fh-acts .btn[style*="flex:1"]{flex:1 1 100%!important}
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
const reg0=F.register;
F.register=(d,def)=>{if(d==='nap'&&def.routes&&def.routes.mai){const m0=def.routes.mai;def.routes.mai=a=>{if(!(window.FH_FOLY&&!a&&window.K2INNER))return m0(a);if(F.napMaiState&&F.napMaiState()&&F.napMaiFull)return F.napMaiFull();return page('nap',{title:'Ma',sub:'Szerda, október 7.',tab:'mai'},`<div class="k2c">${K2INNER()}${F.napMaiExtra?F.napMaiExtra():''}</div>`)}}reg0(d,def)};

/* ═══ liquid primitives (F.*) — the shared graphic language; use these before drawing your own ═══ */
let UID=0; const uid=p=>p+(++UID);
const I=F.I, cl=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
/* wave(color, opacity, cls) — a wave strip to sit on top of any liquid block (position it yourself, or use the helpers below) */
const wave=(c='var(--liq1)',o=1,cls='')=>`<svg class="k2-w ${cls}" viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden="true"><path fill="${c}" opacity="${o}" d="M0 10 Q25 0 50 10 T100 10 T150 10 T200 10 T250 10 T300 10 T350 10 T400 10 T450 10 T500 10 V20 H0Z"/></svg>`;
/* bub(iconId,{s,c}) — an icon inside a glass bubble; the way icons live on white */
const bub=(id,{s=44,c='var(--dom)',cls=''}={})=>`<span class="fb ${cls}" style="--s:${s}px;--c:${c}">${I(id)}</span>`;
/* tank({pct,num,cap,lbl,verdict,marks,cta,ctaAct,h,air}) — the big vessel hero (Nap · Mai). `air` = extra html above the liquid */
const tank=o=>`<section class="k2-tank rise" style="${o.h?`height:${o.h}px;`:''}${o.c1?`--liq1:${o.c1};--liq2:${o.c2||o.c1};`:''}"><div class="k2-air">${o.lbl?`<small>${o.lbl}</small>`:''}${o.verdict?`<p>${o.verdict}</p>`:''}${o.air||''}</div>
  <div class="k2-liq" style="height:${cl(o.pct,o.cta?56:44,78)}%">${wave('var(--liq1)',.55,'b')}${wave('var(--liq1)')}<i class="k2-bub" style="left:62%;bottom:20%;width:12px;height:12px;--d:6s"></i><i class="k2-bub" style="left:78%;bottom:8%;width:7px;height:7px;--d:8s;--dl:2s"></i><i class="k2-bub" style="left:48%;bottom:12%;width:9px;height:9px;--d:7s;--dl:1s"></i>
    ${o.marks?`<div class="marks">${o.marks.map(m=>`<span>${m}</span>`).join('')}</div>`:''}<div class="n"><b style="${String(o.num).length>3?'font-size:96px;letter-spacing:-5px':''}">${o.num}</b>${o.cap?`<small>${o.cap}</small>`:''}</div></div>
  ${o.cta?`<button class="k2-cta"${F.act(o.ctaAct)}>${o.cta}<i>→</i></button>`:''}</section>`;
/* vials([{l,ic,c,p,v,s,mark,on}]) — 2–5 test tubes side by side: label l, icon ic, colour c, fill p%, value v, note s, cap mark, action on */
const vial=o=>`<button class="k2-vial"${F.act(o.on||{toast:o.l})} style="--c:${o.c||'var(--dom)'}"><span class="k2-tube" ${o.h?`style="height:${o.h}px"`:''}><em>${o.mark??''}</em><span class="l" style="--p:${cl(o.p)}%">${wave('color-mix(in srgb,'+(o.c||'var(--dom)')+' 70%,#fff)')}</span>${o.ic?I(o.ic):''}</span><b>${o.v}</b><small>${o.l}${o.s?`<i>${o.s}</i>`:''}</small></button>`;
const vials=(a,{h}={})=>`<div class="k2-vials" style="grid-template-columns:repeat(${a.length},1fr)">${a.map(o=>vial({...o,h:o.h||h})).join('')}</div>`;
/* mini({p,c,ic,v,l}) — a small capsule level (macro cells, per-set marks, week days): icon on top, value below */
const mini=o=>`<span class="fl-mini" style="--c:${o.c||'var(--dom)'}">${o.ic?I(o.ic):''}<span class="t"><i style="height:${cl(o.p)}%"></i></span>${o.v!=null?`<b>${o.v}</b>`:''}${o.l?`<small>${o.l}</small>`:''}</span>`;
/* level(pct,{c,h,label,val}) — a horizontal vessel (a bar that is a liquid): use instead of bar() when the bar is the point */
const level=(p,{c='var(--dom)',h=18,val='',label=''}={})=>`<div class="fl-level" style="--c:${c};--h:${h}px"><i style="width:${cl(p)}%"></i>${label?`<span>${label}</span>`:''}${val?`<b>${val}</b>`:''}</div>`;
/* fill(pathD,{vb,p,c,c2,s,w,cls,inner}) — ANY silhouette filled with liquid to p% (a bowl, a moon, a glass, a heart, a body…).
   pathD: one path in the viewBox `vb` (default 0 0 100 100). s = rendered width px. `inner` = svg drawn above the liquid (marks, text). */
const fill=(d,{vb='0 0 100 100',p=50,c='var(--liq1)',c2='var(--liq2)',s=120,cls='',inner='',stroke=true}={})=>{const [x,y,w,h]=vb.split(' ').map(Number),id=uid('fl'),ly=y+h*(1-cl(p)/100),a=w/8;
  return `<svg class="fl-fill ${cls}" viewBox="${vb}" style="width:${s}px" aria-hidden="true"><defs><clipPath id="${id}"><path d="${d}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <path d="${d}" fill="#fff" ${stroke?`stroke="rgba(10,42,60,.10)" stroke-width="${w/60}"`:''}/><g clip-path="url(#${id})"><g class="fl-wv"><path fill="url(#${id}g)" d="M${x-w} ${ly} q${a/2} ${-h/36} ${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 t${a} 0 V${y+h} H${x-w}Z"/></g></g>
    <path d="${d}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="${w/90}"/>${inner}</svg>`};
/* area(values,{w,h,c,c2,min,max,dots,target,labels}) — a time series as a liquid surface: smoothed line, gradient body, optional raw dots and a target waterline */
const area=(v,{w=320,h=130,c='var(--liq1)',c2='var(--liq2)',min,max,dots=null,target=null,labels=null,pad=8}={})=>{const id=uid('fa'),lo=min??Math.min(...v,...(dots||[]),...(target!=null?[target]:[])),hi=max??Math.max(...v,...(dots||[]),...(target!=null?[target]:[])),r=(hi-lo)||1;
  const X=i=>pad+i*(w-2*pad)/(v.length-1),Y=y=>pad+(1-(y-lo)/r)*(h-2*pad-(labels?14:0));const P=v.map((y,i)=>[X(i),Y(y)]);
  const line=P.map((p,i)=>{if(!i)return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;const a=P[i-2]||P[i-1],b=P[i-1],d=P[i+1]||p;return `C${(b[0]+(p[0]-a[0])/6).toFixed(1)} ${(b[1]+(p[1]-a[1])/6).toFixed(1)} ${(p[0]-(d[0]-b[0])/6).toFixed(1)} ${(p[1]-(d[1]-b[1])/6).toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`}).join('');
  return `<svg class="fh-chart fl-area" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".85"/><stop offset="1" stop-color="${c2}" stop-opacity=".18"/></linearGradient></defs>
    <path d="${line} L${X(v.length-1)} ${h-(labels?14:0)} L${X(0)} ${h-(labels?14:0)}Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${c2}" stroke-width="2.5" stroke-linecap="round"/>
    ${target!=null?`<path d="M${pad} ${Y(target)}H${w-pad}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 4" opacity=".45"/>`:''}
    ${dots?dots.map((y,i)=>y==null?'':`<circle cx="${X(i*(v.length-1)/(dots.length-1))}" cy="${Y(y)}" r="2" fill="var(--faint)"/>`).join(''):''}
    <circle cx="${P.at(-1)[0]}" cy="${P.at(-1)[1]}" r="5" fill="#fff" stroke="${c2}" stroke-width="3"/>
    ${labels?labels.map((l,i)=>`<text x="${pad+i*(w-2*pad)/(labels.length-1)}" y="${h-2}" text-anchor="${i?i===labels.length-1?'end':'middle':'start'}" font-size="9.5" fill="var(--sub)" font-family="var(--mono)">${l}</text>`).join(''):''}</svg>`};
/* stream([{time,title,sub,right,now,on}]) — time-ordered pills on a liquid line (the concept's "Most következik") */
const stream=a=>`<div class="k2-stream">${a.map(o=>`<button class="k2-drop ${o.now?'now':''}"${F.act(o.on||{toast:o.title})}><time>${o.time}</time><span><strong>${o.title}</strong>${o.sub?`<small>${o.sub}</small>`:''}</span>${o.right?`<em>${o.right}</em>`:''}</button>`).join('')}</div>`;
/* linked(aPct,bPct,{a,b,c}) — two communicating vessels joined by a pipe: a correlation / "this moves with that" graphic */
const linked=(pa,pb,{a='',b='',c='var(--liq1)',c2='var(--liq2)',s=220,va='',vb=''}={})=>{const id=uid('fk'),ya=96-cl(pa)*.74,yb=96-cl(pb)*.74;
  const liq=(x,y)=>`<path fill="url(#${id})" d="M${x} ${y} q7.75 -4.5 15.5 0 t15.5 0 t15.5 0 t15.5 0 V112 H${x}Z"/>`;
  const glass=x=>`<rect x="${x}" y="12" width="62" height="86" rx="28" fill="none" stroke="rgba(10,42,60,.12)" stroke-width="2"/><path d="M${x+11} 34 q2 -11 12 -13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>`;
  return `<svg class="fl-link" viewBox="0 0 220 124" style="width:${s}px" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c2}"/></linearGradient><clipPath id="${id}a"><rect x="16" y="12" width="62" height="86" rx="28"/></clipPath><clipPath id="${id}b"><rect x="142" y="12" width="62" height="86" rx="28"/></clipPath></defs>
    <rect x="64" y="80" width="92" height="9" rx="4.5" fill="${c2}" opacity=".35"/><rect x="16" y="12" width="62" height="86" rx="28" fill="#fff"/><rect x="142" y="12" width="62" height="86" rx="28" fill="#fff"/>
    <g clip-path="url(#${id}a)">${liq(16,ya)}</g><g clip-path="url(#${id}b)">${liq(142,yb)}</g>${glass(16)}${glass(142)}
    ${va?`<text x="47" y="${Math.max(ya+20,60)}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" font-family="var(--disp)">${va}</text>`:''}${vb?`<text x="173" y="${Math.max(yb+20,60)}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" font-family="var(--disp)">${vb}</text>`:''}
    <text x="47" y="116" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)">${a}</text><text x="173" y="116" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)">${b}</text></svg>`};
/* small phones (320 px): titles clear the header buttons, long labels wrap instead of running out */
F.css(`@media (max-width:360px){
${Q} .fh-title h1:not(.sm){font-size:25px;letter-spacing:-.9px}
${Q} .fh-title h1.sm{font-size:21px!important}
${Q} .fh-hero .verdict{overflow-wrap:break-word;hyphens:auto}
${Q} .fh-hero:has(.fh-art) .verdict{font-size:19px}
.phone.foly .fh-foot .btn,#sheet .btn{white-space:normal;min-width:0;line-height:1.2}
.phone.foly .fh-foot .btn{padding-inline:10px}
${Q} .gfm small{font-size:8px;letter-spacing:-.4px}
${Q} .gfm button>span:not(.csepp),${Q} .gfm>span>span:not(.csepp){font-size:10px;letter-spacing:-.2px}
}`);
/* F1 frame parity: kalauz mark, tab marks, the Nap drop's message count, the floating quick-log button */
F.css(`
${Q} .fh-title small{flex-wrap:nowrap}${Q} .fh-title small>span,${Q} .fh-eb>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${Q} .fh-trow.hub{gap:6px}
${Q} .fh-eb{flex:1;min-width:0;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--sub)}
${Q} .fh-eb i{flex:none;width:8px;height:10px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:linear-gradient(160deg,var(--liq1),var(--liq2))}
${Q} .fh-btns{display:flex;gap:6px;flex:none}
${Q} .fh-trow.hub .fh-ib{width:38px;height:38px}
${Q} .fh-day .csepp .body{filter:none}
${Q} .fh-trow.hub+.fh-title{margin-top:6px}
${Q} .fh-help{position:relative;width:22px;height:22px;margin-left:8px;vertical-align:middle;border-radius:50%;display:inline-grid;place-items:center;font:800 12.5px/1 var(--disp);letter-spacing:0;color:color-mix(in srgb,var(--dom) 80%,var(--ink));background:#fff;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--dom) 30%,#fff)}
${Q} .fh-help::before{content:'';position:absolute;inset:-11px}
${Q} .fh-help.new::after{content:'';position:absolute;right:-3px;top:-3px;width:8px;height:9px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:linear-gradient(160deg,var(--liq1),var(--liq2));box-shadow:0 0 0 2px #F8FCFD}
@media (max-width:360px){${Q} .fh-trow.hub{flex-wrap:wrap;row-gap:8px}${Q} .fh-trow.hub .fh-btns{margin-left:auto;order:1}${Q} .fh-trow.hub .fh-eb{order:2;flex:0 0 100%}${Q} .fh-trow.hub .fh-ib{width:36px;height:36px}}
${Q} .fh-tabs button{position:relative}
${Q} .fh-tabs .td{display:inline-block;width:7px;height:8px;margin-left:6px;vertical-align:1px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:linear-gradient(160deg,var(--liq1),var(--liq2))}
${Q} .fh-tabs .on .td{background:#fff}
${Q} .fh-tabs .tn{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:6px;padding:0 5px;border-radius:9px;font:800 10.5px/1 var(--disp);color:#fff;background:var(--liq2);vertical-align:1px}
${Q} .fh-tabs .on .tn{color:var(--liq2);background:#fff}
${Q} .fh-fab{position:absolute;right:16px;bottom:96px;z-index:29;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 16px 24px -12px var(--liq2),0 4px 8px -4px rgba(10,42,60,.3),inset 0 0 0 1.5px rgba(255,255,255,.35)}
${Q} .fh-fab svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.8;stroke-linecap:round}
${Q} .fh-fab::before{content:'';position:absolute;left:8px;right:8px;top:5px;height:13px;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.4),transparent)}
`);
Object.assign(F,{wave,bub,tank,vial,vials,mini,level,fill,area,stream,linked,uid});
F.css(`
/* icons live in bubbles */
${Q} .fb{position:relative;display:inline-grid;place-items:center;width:var(--s);height:var(--s);border-radius:50%;flex:0 0 auto;
  background:radial-gradient(circle at 30% 24%,#fff 0 16%,color-mix(in srgb,var(--c) 9%,#fff) 58%,color-mix(in srgb,var(--c) 26%,#fff));
  box-shadow:inset 0 -7px 10px -6px color-mix(in srgb,var(--c) 55%,transparent),inset 0 0 0 1.5px rgba(255,255,255,.95),0 10px 16px -10px color-mix(in srgb,var(--c) 70%,rgba(10,42,60,.5))}
${Q} .fb::after{content:'';position:absolute;left:18%;top:12%;width:26%;height:14%;border-radius:50%;background:rgba(255,255,255,.9);transform:rotate(-28deg);filter:blur(.4px)}
${Q} .fb svg.ic{width:62%;height:62%;filter:drop-shadow(0 3px 4px rgba(10,42,60,.28)) saturate(1.08)}
${Q} .fh-step .si,${Q} .fh-row .si,${Q} .fh-h .tile,${Q} .fm-bh .si{position:relative;border-radius:50%;
  background:radial-gradient(circle at 30% 24%,#fff 0 16%,color-mix(in srgb,var(--dom) 9%,#fff) 58%,color-mix(in srgb,var(--dom) 24%,#fff));
  box-shadow:inset 0 -7px 10px -6px color-mix(in srgb,var(--dom) 50%,transparent),inset 0 0 0 1.5px rgba(255,255,255,.95),0 10px 16px -10px color-mix(in srgb,var(--dom) 65%,rgba(10,42,60,.5))}
${Q} .fh-step .si::after,${Q} .fh-row .si::after,${Q} .fh-h .tile::after{content:'';position:absolute;left:18%;top:12%;width:26%;height:14%;border-radius:50%;background:rgba(255,255,255,.9);transform:rotate(-28deg)}
${Q} .fh-step .si svg.ic,${Q} .fh-row .si svg.ic,${Q} .fh-h .tile svg.ic.td{width:62%;height:62%;filter:drop-shadow(0 3px 4px rgba(10,42,60,.28)) saturate(1.08)}
${Q} .fh-stat .ti{width:40px;height:40px;right:8px;top:8px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 24%,#fff 0 16%,rgba(255,255,255,.75) 60%,rgba(255,255,255,.35));box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.95),0 8px 12px -8px rgba(10,42,60,.45)}
${Q} .fh-stat .ti svg.ic{width:26px;height:26px}
/* small levels */
${Q} .fl-mini{display:inline-flex;flex-direction:column;align-items:center;gap:3px;min-width:30px}
${Q} .fl-mini svg.ic{width:18px;height:18px;filter:drop-shadow(0 2px 3px rgba(10,42,60,.25))}
${Q} .fl-mini .t{position:relative;display:block;width:22px;height:38px;border-radius:999px;overflow:hidden;background:linear-gradient(180deg,#fff,#F3FAFC);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.09),0 6px 10px -8px var(--c)}
${Q} .fl-mini .t i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 65%,#fff),var(--c));border-radius:0 0 999px 999px}
${Q} .fl-mini .t i::before{content:'';position:absolute;left:0;right:0;top:-3px;height:4px;background:color-mix(in srgb,var(--c) 65%,#fff);${mask('16px 4px')}}
${Q} .fl-mini b{font-family:var(--disp);font-size:12px;font-weight:800;letter-spacing:-.3px}
${Q} .fl-mini small{font-size:10px;color:var(--sub)}
${Q} .fl-level{position:relative;height:var(--h);border-radius:999px;overflow:hidden;background:linear-gradient(180deg,#fff,#F3FAFC);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.08)}
${Q} .fl-level i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 60%,#fff),var(--c))}
${Q} .fl-level span,${Q} .fl-level b{position:absolute;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700}
${Q} .fl-level span{left:10px;color:#fff}${Q} .fl-level b{right:10px;color:var(--ink)}
${Q} .fl-fill{display:block;height:auto;overflow:visible;filter:drop-shadow(0 14px 16px color-mix(in srgb,var(--liq2) 35%,transparent))}
${Q} .fl-link{display:block;height:auto;margin:0 auto}
${Q} .k2-vials{padding:0}${Q} .k2-stream{margin:0}
${Q} .k2c>.k2-vials{padding:0 16px}${Q} .k2c>.k2-stream{margin:0 16px}
${Q} .fh-card .k2-tank{margin:0 0 4px}
@media (prefers-reduced-motion:no-preference){body:not(.still) ${Q} .fl-fill .fl-wv{animation:flw 6s linear infinite}}
@keyframes flw{to{transform:translateX(12.5%)}}
`);
window.FNOTES_FOLY=`<h2>Folyadék</h2><p>A választott irány az egész appon. Minden egy szint, ami töltődik:</p><ul><li><b>A fő kártya egy edény</b>, az alján hullámzó folyadék, benne a fő gomb. A terület színében.</li><li><b>A szám-csempék szintek:</b> a háttérben annyira van feltöltve, amennyire a célhoz állsz.</li><li><b>Az időrendi teendők egy folyam mentén</b> sorakoznak, a soron következő van megtöltve.</li><li><b>Alul az öt terület öt csepp</b>, a szakaszok száma is csepp-jelvény.</li></ul><p>A Nap főoldala a jóváhagyott koncepció képernyője. A többi oldal ugyanebből a készletből öltözött át, ezeket most nézzük át együtt.</p>`;
})();
