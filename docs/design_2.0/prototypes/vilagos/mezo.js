/* vilagos/mezo.js — Mezo domain in the "Világos · élő" look (Üzenőfal · A csapat · Rólad · Emlékek + every deep page).
   Built on window.F (see vilagos/README.md). Content/parity source: csepp/mezo.js (same routes, args, sheets, states). */
(function(){
const {I,csepp,esc,page,sec,card,head,hero,btn,lk,step,row,bar,stat,grid,facts,pills,st,note,txt,TEAM,who,msg,chev,register,wave,bub,area,uid}=F;
const toast=(...a)=>F.toast(...a),openSheet=(...a)=>F.openSheet(...a),closeSheet=(...a)=>F.closeSheet(...a);
const still=()=>document.body.classList.contains('still');

/* ── a csapat: testvérformák (kit TEAM) + a Szkeptikus szürke kristálya ── */
const NM={szunya:'Alvás',mocor:'Mozgás',falat:'Étkezés',deru:'Közérzet',mezo:'Mezo',szk:'Szkeptikus'};
const AREA={szunya:'pihenés',mocor:'terhelés',falat:'étrend',deru:'hangulat',mezo:'a csapat',szk:'visszakérdez'};
const FIVE=['szunya','mocor','falat','deru','mezo'];
const nm=id=>NM[id];
const W=(id,s=36)=>id==='szk'?csepp('ok',30,{s,form:'crystal',color:'var(--faint)',alive:false}):who(id,s);
const WA=(id,s=88)=>{const t=TEAM[id];return t?csepp('ok',t[4],{s,form:t[3],color:t[2],alive:true}):W(id,s)};
const minis=ids=>`<span class="mz-minis">${ids.map(id=>W(id,22)).join('')}</span>`;
/* say(): a member's line — msg() for the five, the same anatomy with the grey crystal for the Szkeptikus */
const say=(id,text,meta='')=>id==='szk'?`<div class="fh-msg"><span class="who">${W('szk')}</span><div class="b"><span class="nm">Szkeptikus<small>${meta||'visszakérdez'}</small></span><p class="fh-txt" style="margin-top:2px">${text}</p></div></div>`:msg(id,text,meta||AREA[id]);
const cmt=(id,t,tag='')=>`<div class="mz-c">${say(id,t,tag?tag.toLowerCase():'')}</div>`;
const me=(time,tx)=>`<div class="mz-me"><p>${tx}</p><small>Te · ${time}</small></div>`;
const typing=id=>`<div class="fh-msg"><span class="who">${W(id)}</span><div class="b"><span class="nm">${nm(id)}<small>ír…</small></span><span class="mz-ty" aria-label="${nm(id)} ír"><i></i><i></i><i></i></span></div></div>`;

/* ── kis építőelemek ── */
const ic=n=>/^(t-|c-i-|i-)/.test(n)?n:'t-'+n;
const P=(o,inner,x)=>page('mezo',o,inner,x);
const mb=(l,m,cls='')=>`<button class="btn ${cls}" data-m="${m}">${l}</button>`;
const ml=(l,m,on)=>`<button class="fh-lk" data-m="${m}"${on==null?'':` aria-pressed="${!!on}"`}>${l}</button>`;
const chip=(l,attr,on)=>`<button class="mz-chip" ${attr}${on==null?'':` aria-pressed="${!!on}"`}>${l}</button>`;
const cm=(l,m,on)=>chip(l,`data-m="${m}"`,on);
const cs=(l,sheet,arg)=>chip(l,`data-sheet="${sheet}"${arg?` data-arg="${esc(arg)}"`:''}`);
const ct=(l,t)=>chip(l,`data-toast="${esc(t)}"`);
const acts=h=>`<div class="fh-acts">${h}</div>`;
const more=()=>`<button class="mz-more" data-sheet="menu" aria-label="Továbbiak ehhez a bejegyzéshez">···</button>`;
const votes=(k,extra='',menu=true)=>{const v=ST.vote[k];return `<div class="mz-v">${cm('Ez talál'+extra,`vote:${k}:up`,v==='up')}${cm('Nem így érzem',`vote:${k}:down`,v==='down')}${cs('Elmesélem','reply')}${menu?more():''}</div>`};
const reply=(sheet='reply')=>`<button class="mz-reply" data-sheet="${sheet}"><b>Te</b><span>Te hogy látod? Válaszolj…</span>${bub('t-send',{s:30})}</button>`;
const src=(to,meta='')=>lk(`Miből látszik?${meta?` · ${meta}`:''} ›`,to);
const done=t=>`<p class="mz-done">${bub('t-tick',{s:26,c:'var(--ok)'})}<span>${t}</span></p>`;
const quiet=(icon,t)=>`<p class="mz-quiet">${drop({k:'gone',ic:icon,s:22,c:'var(--faint)'})}<span>${t}</span></p>`;
const empty=(icon,t,a='')=>`<div class="fh-empty"><span class="gv dash" style="--c:var(--dom)"><span class="t" style="height:64px"><i style="height:6%"></i></span></span>${icon?bub(icon,{s:40}):''}<p>${t}</p>${a?`<div class="fh-acts" style="justify-content:center">${a}</div>`:''}</div>`;
const h3=t=>`<h3 class="mz-h">${t}</h3>`;
const sub=t=>`<p class="mz-sub">${t}</p>`;
const lab=(l,r='')=>`<div class="mz-lab"><span>${l}</span>${r?`<span>${r}</span>`:''}</div>`;
const big=(n,v)=>`<div class="mz-big"><span class="fh-big">${n}</span>${v?`<span class="v">${v}</span>`:''}</div>`;
const lvl=(pct,c='var(--dom)',h=12)=>`<div class="fl-level" style="--c:${c};--h:${h}px"><i style="width:${cl(pct)}%"></i></div>`;
const conf=(pct,l='',r='')=>`<div class="mz-conf">${l?`<span>${l}</span>`:''}${lvl(pct)}<b>${r||pct+'%'}</b></div>`;
const honest=(l,pct,r,go='')=>`<${go?`button data-go="${go}"`:'div'} class="mz-conf">${`<span>${l}</span>`}${lvl(pct)}<span>${r}</span></${go?'button':'div'}>`;
const sg=(opts,cur,key)=>`<div class="fh-seg" role="group">${opts.map(([k,l])=>`<button class="${cur===k?'on':''}" data-m="${key}:${k}" aria-pressed="${cur===k}">${l}</button>`).join('')}</div>`;
const fold=(key,label,open,body)=>`<button class="mz-fold" data-m="fold:${key}" aria-expanded="${open}"><span>${label}</span><i>${open?'bezár':'megnyit'}</i></button>${open?`<div class="mz-foldb">${body}</div>`:''}`;
const isOpen=k=>!!ST.fold[k];
const tgl=(on,m,l)=>`<button class="mz-tgl ${on?'on':''}" role="switch" aria-checked="${on}" aria-label="${l||'Kapcsoló'}" data-m="${m}"><i></i></button>`;
const vs=(a,b)=>`<div class="mz-vs"><div><span>Ezt vártam</span><p>${a}</p></div><div><span>Ez történt</span><p>${b}</p></div></div>`;
const dcell=cells=>rack(cells.map(([l,k])=>({p:k==='hit'||k==='el'?100:k==='now'?46:0,l,cls:k==='now'?'now':'',dash:!k})),{h:38,cls:'days'});
const itags=arr=>`<div class="mz-tags it">${arr.map(([i,t])=>`<span>${bub('t-'+i,{s:24})}${t}</span>`).join('')}</div>`;
const tags=arr=>`<div class="mz-tags">${arr.map(t=>`<span>${t}</span>`).join('')}</div>`;
const dayl=t=>`<p class="mz-day">${t}</p>`;
/* r(): a row whose icon name comes from the content tables (without the t- prefix) */
const r=o=>row({...o,icon:o.icon?ic(o.icon):undefined});
const ton=t=>t?(t.startsWith('toast:')?{toast:t.slice(6)}:{go:t}):null;

/* ── állapot (a prototípus kattintásai) — ugyanaz, mint csepp/mezo.js ── */
const ST={vote:{},s8:{dori:'on',self:'ask',anna:'gone',bence:'gone',all:false},s8m:{a:'on',b:'on'},s8rk:'1',ch:'mem',tools:false,mems:false,
  rinb:{},redit:'',rq:'',s6all:false,s9open:false,s9back:{},waitOpen:true,offOpen:false,ff:'Minden',konz:'ov',th:'t1',src:'be',wk:false,
  bucket:'decide',ack:'',pred:'all',mem:'retegek',ex:'mind',card:'open',dg:'idle',probe:false,rule:'r1',srch:'off',fb:{},mfb:{},
  s7:{phase:'open',text:''},s7k:'open',s7r:'open',chk:true,act:'menu',eloDone:false,pillUsed:false,pill:false,dontes:'',mstep:0,fold:{},rsn:{},xdec:{},pdec:{}};

/* ══ FOLYADÉK · a Mezo-terület saját grafikái ══
   Minden oldal egy saját, az adataiból rajzolt folyadék-grafikát kap. Az építőelemek:
   forms()  — a csapat öt testvérformája mint edény (szint = amit az oldal mér)
   rack()   — kapszula-edények sora (állapotok, napok, témakörök, szabályok)
   chain()  — közlekedőedények csővel (minta, bizonyíték, jellánc, ok → okozat)
   flowG()  — csőrajz: források → tartály → kimenetek (a gépezet)
   strata() — rétegzett tartály (memória-rétegek, hónapok, tények sorsa)
   fore()   — előrejelzés: szint + szaggatott várt sáv + az eredmény vízvonala
   drops()  — cseppek (memória-jelzések, tények, kvóta)   tide() — cseppek egy folyamon (a nap)
   scat()/scbin()/curve() — pontok halványan, a trend a folyadék felszíne */
const cl=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const MC=id=>id==='szk'?'#9AA8B4':(TEAM[id]||TEAM.mezo)[2];
const AC=o=>!o?'':(typeof o==='string'&&o.startsWith('m:'))?` data-m="${esc(o.slice(2))}"`:F.act(o);
const WVP=(x0,y,a,n,amp=4)=>`M${x0} ${y.toFixed(1)} q${a/2} ${-amp} ${a} 0`+` t${a} 0`.repeat(n);
/* forms([{id,p,v,l,on,dot,alive}]) */
const forms=(a,{s=54,cls=''}={})=>`<nav class="gfm ${cls}" aria-label="A csapat">${a.map(o=>`<button${AC(o.on||('szoba.'+o.id))} aria-label="${nm(o.id)}${o.l?' · '+o.l:''}">${o.id==='szk'?csepp('ok',o.p,{s,form:'crystal',color:MC('szk'),alive:false,val:o.v}):csepp('ok',o.p,{s,form:TEAM[o.id][3],color:TEAM[o.id][2],alive:!!o.alive,val:o.v})}${o.dot?'<i class="dot" title="dolga van veled"></i>':''}<span>${nm(o.id)}</span>${o.l?`<small>${o.l}</small>`:''}</button>`).join('')}</nav>`;
/* bigform(id,pct,{val,label,marks}) — egy tag nagyban: a forma maga az edény, a szint az érettsége */
const bigform=(id,p,{s=124,val,label='érettség',cap=''}={})=>`<div class="gbig" style="--c:${MC(id)}"><span class="f">${csepp('ok',p,{s,form:id==='szk'?'crystal':TEAM[id][3],color:MC(id),alive:true,val:val??(p+'%'),label})}<i class="b1"></i><i class="b2"></i><i class="b3"></i></span><span class="sc" aria-hidden="true"><em>sokat tud</em><em>ismerkedik</em><em>még semmit</em></span>${cap?`<p>${cap}</p>`:''}</div>`;
/* rack([{p,c,v,l,top,in,on,dash,mark,band,sel}]) */
const ves=o=>{const tag=o.on?'button':'span',c=o.c||'var(--dom)';
  return `<${tag} class="gv ${o.cls||''}${o.dash?' dash':''}${o.sel?' sel':''}" style="--c:${c}"${o.on?AC(o.on):''}${o.aria?` aria-label="${esc(o.aria)}"`:''}${o.sel!=null&&o.on?` aria-pressed="${!!o.sel}"`:''}>${o.top||''}<span class="t" style="height:${o.h}px"><i style="height:${cl(o.p||0)}%"></i>${o.band?`<u style="bottom:${o.band[0]}%;height:${o.band[1]-o.band[0]}%"></u>`:''}${o.mark!=null?`<s style="bottom:${cl(o.mark)}%"></s>`:''}${o.in!=null?`<em>${o.in}</em>`:''}</span>${o.v!=null?`<b>${o.v}</b>`:''}${o.l?`<small>${o.l}</small>`:''}</${tag}>`};
const rack=(a,{h=92,cols,cls=''}={})=>`<div class="gr ${cls}" style="grid-template-columns:repeat(${cols||a.length},minmax(0,1fr))">${a.map(o=>ves({h,...o})).join('')}</div>`;
/* dayrow(total,done,{cur,lab}) — gyűlő napok: megtelt / ma / még üres edények */
const dayrow=(total,done,{cur=done,lab=i=>(i+1)+'.',hit=null,h=38}={})=>rack(Array.from({length:total},(_,i)=>({p:hit?(hit[i]===1?100:hit[i]===2?46:0):(i<done?100:i===cur?46:0),l:lab(i),cls:(hit?hit[i]===2:i===cur)?'now':'',dash:hit?!hit[i]:i>cur})),{h,cls:'days'});
/* chain(vessels,pipes) — vessel {l,s,v,p,c,dash,dots,band,mark,markL}; pipe {w,dash,cap,cap2} | null */
function chain(vs,ps=[],{h=140,vw}={}){const n=vs.length,W=320,vW=vw||(n<=2?92:n===3?60:52),gp=n>1?(W-n*vW)/(n-1):0,top=8,bot=h-38,H=bot-top,rx=Math.min(vW/2,28),id=uid('gc');
  const X=i=>n===1?(W-vW)/2:i*(vW+gp);
  const pipes=ps.map((q,i)=>{if(!q)return'';const t=q.w||8,y=bot-18-t/2,x1=X(i)+vW-6,x2=X(i+1)+6,mx=(x1+x2)/2;
    return `<rect x="${x1}" y="${y}" width="${x2-x1}" height="${t}" rx="${t/2}" fill="url(#${id}p)" opacity="${q.dash?.4:.9}"/>${q.dash?`<path d="M${x1+10} ${y+t/2}H${x2-10}" stroke="#fff" stroke-width="${Math.max(2,t-3)}" stroke-dasharray="4 8"/>`:''}`}).join('');
  const caps=ps.map((q,i)=>{if(!q)return'';const t=q.w||8,y=bot-18-t/2,mx=(X(i)+vW+X(i+1))/2;return `${q.cap?`<text x="${mx}" y="${y-8}" class="cap">${q.cap}</text>`:''}${q.cap2?`<text x="${mx}" y="${y+t+14}" class="cap2">${q.cap2}</text>`:''}`}).join('');
  const body=vs.map((o,i)=>{const x=X(i),c=o.c||'var(--liq2)',c1=o.c?`color-mix(in srgb,${o.c} 55%,#fff)`:'var(--liq1)',p=cl(o.p??0),ly=bot-p/100*H,a=vW/4,cx=x+vW/2,inn=p>=36;
    return `<defs><clipPath id="${id}c${i}"><rect x="${x}" y="${top}" width="${vW}" height="${H}" rx="${rx}"/></clipPath><linearGradient id="${id}g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
    <rect class="sh" x="${x}" y="${top}" width="${vW}" height="${H}" rx="${rx}"${o.dash?' stroke-dasharray="4 5"':''}/>
    <g clip-path="url(#${id}c${i})">${p>0?`<g class="gw" style="--dx:${2*a}px"><path fill="url(#${id}g${i})" d="${WVP(x-2*a,ly,a,12,3.5)} V${bot} H${x-2*a}Z"/></g>`:''}
      ${o.band?`<rect class="band" x="${x+5}" y="${bot-o.band[1]/100*H}" width="${vW-10}" height="${(o.band[1]-o.band[0])/100*H}" rx="6"/>`:''}
      ${(o.dots||[]).map((d,k)=>`<circle class="dt" cx="${cx+[-.26,.18,-.08,.28,-.2,.06,.24,-.3][k%8]*vW}" cy="${bot-cl(d)/100*H}" r="2.6"/>`).join('')}</g>
    ${o.mark!=null?`<path class="mk" d="M${x-4} ${bot-cl(o.mark)/100*H}H${x+vW+4}"/>${o.markL?`<text class="cap" x="${cx}" y="${bot-cl(o.mark)/100*H-5}">${o.markL}</text>`:''}`:''}
    <path class="hi" d="M${x+vW*.22} ${top+18} q${vW*.05} -9 ${vW*.2} -10"/>
    ${o.v!=null?`<text class="v${inn?' in':''}" x="${cx}" y="${inn?bot-14:Math.min(ly-9,bot-14)}">${o.v}</text>`:''}
    ${o.l?`<text class="l" x="${cx}" y="${h-21}">${o.l}</text>`:''}${o.s?`<text class="s" x="${cx}" y="${h-7}">${o.s}</text>`:''}`}).join('');
  return `<svg class="gc" viewBox="0 0 ${W} ${h}" aria-hidden="true"><defs><linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--liq1)"/><stop offset="1" stop-color="var(--liq2)"/></linearGradient></defs>${pipes}${body}${caps}</svg>`}
/* flowG(sources,reservoir,outputs) — a gépezet csőrajza */
function flowG(srcs,res,outs){const id=uid('gp'),W=320,rows=Math.max(srcs.length,outs.length),h=Math.max(132,rows*32+10),cw=102,ch=24,rx0=122,rw=76,rt=6,rb=h-6,RH=rb-rt,p=cl(res.p),ly=rb-p/100*RH,a=20;
  const yy=(i,n)=>n===1?h/2-ch/2:6+i*((h-12-ch)/(n-1));
  const cap=(x,y,o,k)=>`<rect class="sh" x="${x}" y="${y}" width="${cw}" height="${ch}" rx="${ch/2}"${o.dash?' stroke-dasharray="4 5"':''}/>${o.p?`<clipPath id="${id}${k}"><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="${ch/2}"/></clipPath><rect clip-path="url(#${id}${k})" x="${x}" y="${y}" width="${cw*cl(o.p)/100}" height="${ch}" fill="${o.c||'var(--liq1)'}" opacity=".5"/>`:''}<text class="k" x="${x+cw/2}" y="${y+ch/2+3.5}">${o.l}</text>`;
  const S=srcs.map((o,i)=>{const y=yy(i,srcs.length),ty=h/2+(i-(srcs.length-1)/2)*9;return `<path class="pp${o.dash?' d':''}" d="M${cw-2} ${y+ch/2} C${cw+14} ${y+ch/2} ${rx0-16} ${ty} ${rx0+6} ${ty}"/>`+cap(0,y,o,'s'+i)}).join('');
  const O=outs.map((o,i)=>{const y=yy(i,outs.length),ty=h/2+(i-(outs.length-1)/2)*9;return `<path class="pp${o.dash?' d':''}" d="M${rx0+rw-6} ${ty} C${rx0+rw+16} ${ty} ${W-cw-14} ${y+ch/2} ${W-cw+2} ${y+ch/2}"/>`+cap(W-cw,y,o,'o'+i)}).join('');
  return `<svg class="gc gp" viewBox="0 0 ${W} ${h}" aria-hidden="true"><defs><clipPath id="${id}r"><rect x="${rx0}" y="${rt}" width="${rw}" height="${RH}" rx="26"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--liq1)"/><stop offset="1" stop-color="var(--liq2)"/></linearGradient></defs>
    ${S}${O}<rect class="sh" x="${rx0}" y="${rt}" width="${rw}" height="${RH}" rx="26"/><g clip-path="url(#${id}r)">${p>0?`<g class="gw" style="--dx:${2*a}px"><path fill="url(#${id}g)" d="${WVP(rx0-2*a,ly,a,10,3.5)} V${rb} H${rx0-2*a}Z"/></g>`:''}</g>
    <path class="hi" d="M${rx0+16} ${rt+20} q4 -9 16 -10"/>${res.l?`<text class="cap" x="${rx0+rw/2}" y="${Math.max(rt+16,Math.min(ly-8,rb-40))}">${res.l}</text>`:''}<text class="v${p>=30?' in':''}" x="${rx0+rw/2}" y="${rb-24}">${res.v}</text>${res.s?`<text class="s${p>=30?' in':''}" x="${rx0+rw/2}" y="${rb-11}">${res.s}</text>`:''}</svg>`}
/* strata([{l,s,v,c,on,h,cls}]) — rétegek egy tartályban; a felső a legfrissebb / legtisztább */
const strata=(ls,{cap=''}={})=>`<div class="gs">${cap?`<small class="air">${cap}</small>`:''}${ls.map((o,i)=>{const tag=o.on?'button':'div',k=ls.length>1?i/(ls.length-1):1;return `<${tag} class="l ${k>.45?'deep':''} ${o.cls||''}" style="--c:${o.c||'var(--dom)'};--k:${Math.round(26+k*62)}%;min-height:${o.h||46}px"${o.on?AC(o.on):''}>${i===0?wave('var(--lc)'):''}${o.left||''}<span><strong>${o.l}</strong>${o.s?`<small>${o.s}</small>`:''}</span>${o.v!=null?`<b>${o.v}</b>`:''}</${tag}>`}).join('')}</div>`;
/* fore({p,v,l,band,bandL,out,outL,c,h,ticks}) — előrejelzés-edény */
const fore=o=>`<div class="gf${o.cls?' '+o.cls:''}" style="--c:${o.c||'var(--dom)'};height:${o.h||150}px"><i style="height:${cl(o.p)}%">${wave('var(--lc)')}</i>${(o.ticks||[]).map(([y,t])=>`<q style="bottom:${y}%">${t}</q>`).join('')}${o.band?`<u style="bottom:${o.band[0]}%;height:${o.band[1]-o.band[0]}%"><em>${o.bandL||'várt sáv'}</em></u>`:''}${o.out!=null?`<s style="bottom:${cl(o.out)}%"><em>${o.outL||''}</em></s>`:''}<span class="n ${o.p<46?'up':''}"><b>${o.v}</b>${o.l?`<small>${o.l}</small>`:''}</span></div>`;
/* drops([{k:'full|half|empty|gone',c,ic,in,on,s}],caption) */
const drop=o=>`<${o.on?'button':'span'} class="gd ${o.k||'full'}" style="--c:${o.c||'var(--dom)'};--s:${o.s||24}px"${o.on?AC(o.on):''}${o.t?` title="${esc(o.t)}"`:''}><i>${o.ic?I(ic(o.ic)):(o.in??'')}</i></${o.on?'button':'span'}>`;
const drops=(a,cap='')=>`<div class="gds">${a.map(drop).join('')}${cap?`<small>${cap}</small>`:''}</div>`;
/* tide([{x,t,l,c,k,on}]) — a nap folyama, rajta az érkező cseppek (x: 0–100) */
const tide=(a,{now=null,from='06',to='24'}={})=>`<div class="gt">${wave('var(--liq1)',.5)}<span class="ln"></span>${now!=null?`<span class="nw" style="left:${now}%"></span>`:''}${a.map(o=>`<${o.on?'button':'span'} class="p" style="left:${o.x}%;--c:${o.c||'var(--dom)'}"${o.on?AC(o.on):''}>${drop({k:o.k,c:o.c,s:22,in:o.in})}<b>${o.t}</b>${o.l?`<small>${o.l}</small>`:''}</${o.on?'button':'span'}>`).join('')}<em class="a">${from}</em><em class="b">${to}</em></div>`;
const gcap=t=>`<p class="gcap">${t}</p>`;
/* a vacsora-ügy bizonyítéka: a két este-fajta utáni alvás, két edényben — a különbség a lényeg */
/* perday(days,{lo,hi,legend}) — every day of a comparison as its own small vessel: level = the measured value,
   colour = which group the day belongs to, dashed = a day that speaks against the pattern. days=[label,value,group,against] */
const perday=(days,{lo=4,hi=9,ca='var(--warn)',cb='var(--dom)',legend=''}={})=>`<p class="gpd-h">Napról napra</p>`+rack(days.map(([l,v,g,x])=>({p:Math.round((v-lo)/(hi-lo)*100),c:g?cb:ca,l,top:`<em class="gpd-v">${String(v).replace('.',',')}</em>`,cls:x?"x":""})),{h:54,cls:'tiny gpd'})+(legend?`<p class="gpd-l">${legend}</p>`:'');
const VACS_DAYS=[['8.',7.9,1],['9.',5.4,0],['10.',8.0,1],['11.',6.1,1,1],['12.',5.9,0],['13.',7.8,1],['14.',7.7,1],['15.',7.3,0,1],['16.',8.1,1],['17.',5.6,0],['18.',6.3,1,1],['19.',7.8,1],['20.',5.8,0],['21.',7.8,1]];
const G_VACS=(small)=>chain([{l:'késői vacsora után',s:'5 ilyen este',v:'6,0',p:42,c:'var(--warn)'},{l:'korai vacsora után',s:'9 ilyen este',v:'7,5',p:80}],[{w:9,cap:'másfél pont',cap2:'11 mellette · 3 ellene'}],{h:small?128:140})+(small?'':perday(VACS_DAYS,{legend:'<i style="--c:var(--warn)"></i>késői vacsora (21 óra után) <i style="--c:var(--dom)"></i>korai vacsora <i class="d"></i>ellene szól · szept. 8–21., a szám az alvásod aznap éjjel'}));
/* pontfelhő folyadékban: minden pont egy nap (halvány), a trend a felszín */
function scat(m){
  const id=uid('gsc'),L=36,R=292,Tp=12,B=108,[x0,x1]=m.xa,[y0,y1,yt]=m.ya,X=v=>(L+(v-x0)/(x1-x0)*(R-L)),Y=v=>cl(B-(v-y0)/(y1-y0)*(B-Tp),Tp,B);
  const d=m.days,n=d.length,mx=d.reduce((s,q)=>s+q[1],0)/n,my=d.reduce((s,q)=>s+q[2],0)/n,k=d.reduce((s,q)=>s+(q[1]-mx)*(q[2]-my),0)/d.reduce((s,q)=>s+(q[1]-mx)**2,0),b0=my-k*mx;
  const ya=m.trend?Y(k*x0+b0):Y(my),yb=m.trend?Y(k*x1+b0):Y(my),N=8,seg=(R-L)/N;
  const surf=Array.from({length:N+1},(_,i)=>{const x=L+i*seg,y=ya+(yb-ya)*i/N;return (i?`Q${(x-seg/2).toFixed(1)} ${(ya+(yb-ya)*(i-.5)/N+(i%2?-3:3)).toFixed(1)} `:'M')+`${x.toFixed(1)} ${y.toFixed(1)}`}).join(' ');
  return `<svg class="gc sc" viewBox="0 0 300 130" role="img" aria-label="${m.A.l} és ${m.B.l} ${n} napon"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--liq1)" stop-opacity=".8"/><stop offset="1" stop-color="var(--liq2)" stop-opacity=".2"/></linearGradient></defs>
  ${yt.map(t=>`<text class="ax" x="${L-6}" y="${Y(t)+3}" text-anchor="end">${m.fy(t)}</text><path class="gl" d="M${L} ${Y(t)}H${R}"/>`).join('')}
  <path d="${surf} L${R} ${B} L${L} ${B}Z" fill="url(#${id})"/><path d="${surf}" fill="none" stroke="var(--liq2)" stroke-width="2.5" stroke-linecap="round"/>
  ${d.map((q,i)=>i===n-1?'':`<circle class="dt" cx="${X(q[1]).toFixed(1)}" cy="${Y(q[2]).toFixed(1)}" r="2.6"/>`).join('')}<circle class="last" cx="${X(d[n-1][1]).toFixed(1)}" cy="${Y(d[n-1][2]).toFixed(1)}" r="5"/>
  ${m.xa[2].map(t=>`<text class="ax" x="${X(t)}" y="124" text-anchor="middle">${m.fx(t)}</text>`).join('')}</svg>`;
}
/* két csoport = két edény: a szint a középső érték, a buborékok a napok */
function scbin(m){const [y0,y1]=m.ya,pc=v=>cl((v-y0)/(y1-y0)*100,4,96),d=m.days,g0=d.filter(q=>q[1]<.5).map(q=>q[2]),g1=d.filter(q=>q[1]>=.5).map(q=>q[2]),m0=median(g0),m1=median(g1);
  const num=v=>typeof v==='number'&&m.fy===clock?null:v;
  const diff=m0!=null&&m1!=null?(m.fy===clock?`${Math.round(Math.abs(m1-m0)*60)} perc`:dec1(Math.abs(m1-m0))+' pont'):'';
  return `<div role="img" aria-label="${m.B.l}: ${m.g[0]} és ${m.g[1]}">${chain([{l:m.g[0],s:`${g0.length} nap`,v:m0!=null?String(m.fy(m0)).replace('.',','):'—',p:m0!=null?pc(m0):0,dots:g0.map(pc),c:'var(--faint)'},{l:m.g[1],s:`${g1.length} nap`,v:m1!=null?String(m.fy(m1)).replace('.',','):'—',p:m1!=null?pc(m1):0,dots:g1.map(pc)}],[{w:8,cap:diff,cap2:'különbség'}],{h:150})}</div>`;
}
/* érettség-görbe: a simított vonal a folyadék felszíne */
const curve=(mat,c)=>area(mat,{w:320,h:96,c:`color-mix(in srgb,${c} 55%,#fff)`,c2:c,min:Math.min(...mat)-12,max:Math.max(...mat)+6,labels:['8 hete','','','','','','','ma']});

/* ── újrarajzolás helyben (állapotváltás görgetés és újra-animálás nélkül) ── */
let ROUTES={};
function soft(){const phn=document.querySelector('#phone');if(!phn||F.D!=='mezo'||phn.dataset.v!=='feher')return;const sc=phn.querySelector('.scroll');const y=sc?sc.scrollTop:0;const f=ROUTES[F.R]||ROUTES.mai;phn.innerHTML=f(F.ARG);const s2=phn.querySelector('.scroll');if(s2){s2.classList.add('mz-soft');s2.scrollTop=y}afterRender(F.R,F.ARG)}

const CSS=`
& .mz-soft .rise,& .mz-soft .bar b{animation:none!important}
& .fh-hero .verdict{overflow-wrap:anywhere}
& .fh-hrow>.csepp,& .fh-hrow>.fh-ring,& .fh-hrow>.mz-minis{flex:0 0 auto}
& .fh-msg .who{flex:0 0 auto}& .fh-msg .fh-txt b{font-weight:700}
& .fh-row .g,& .fh-step .g{overflow-wrap:anywhere}
& div.fh-row[data-go],& div.fh-row[data-m],& div.fh-row[data-toast],& div.fh-row[data-sheet],& div.fh-row[data-close]{cursor:pointer}
& .fh-row .st,& .fh-step .st{flex:0 0 auto}
& .fh-card>.fh-lk{display:inline-block;margin-top:12px}
& .hl{font-weight:700}& .m{color:var(--dom);font-weight:650}
& .mz-team{display:flex;justify-content:space-between;gap:2px}
& .mz-team button{flex:1;min-width:0;position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:12.5px;font-weight:700}
& .mz-team small{font-size:10.5px;font-weight:500;color:var(--sub);margin-top:-3px}
& .mz-team .dot{position:absolute;top:-2px;left:calc(50% + 12px);width:11px;height:11px;border-radius:50%;background:var(--dom);box-shadow:0 0 0 2.5px #fff}
& .mz-minis{display:inline-flex;align-items:center}& .mz-minis .csepp{margin-left:-7px}& .mz-minis .csepp:first-child{margin-left:0}
& .mz-ldot{width:10px;height:10px;border-radius:50%;background:var(--dom);box-shadow:0 0 0 4px color-mix(in srgb,var(--dom) 18%,#fff);flex:0 0 auto;margin:0 4px}
& .mz-pill{position:absolute;left:50%;top:128px;transform:translateX(-50%) translateY(-8px);z-index:24;padding:8px 14px;border-radius:999px;background:var(--dom);color:#fff;font-size:12.5px;font-weight:700;opacity:0;pointer-events:none;transition:.25s;white-space:nowrap;box-shadow:0 10px 20px -10px var(--dom)}& .mz-pill.on{opacity:1;transform:translateX(-50%);pointer-events:auto;cursor:pointer}
& .mz-v{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:12px}
& .mz-chip{padding:7px 12px;border-radius:999px;font-size:13px;font-weight:600;color:var(--ink);background:var(--page);text-align:left}
& .mz-chip[aria-pressed="true"]{color:color-mix(in srgb,var(--dom) 78%,var(--ink));background:color-mix(in srgb,var(--dom) 12%,#fff);box-shadow:inset 0 0 0 1.5px var(--dom)}
& .mz-more{margin-left:auto;padding:4px 6px;font-size:16px;font-weight:800;letter-spacing:1px;color:var(--faint)}
& .fh-lk[aria-pressed="true"]{text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:2px}
& .mz-done{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;font-weight:650;color:var(--ok)}& .mz-done svg.ic{width:22px;height:22px;flex:0 0 auto}
& .mz-quiet{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12.5px;color:var(--sub)}& .mz-quiet svg.ic{width:20px;height:20px;flex:0 0 auto;filter:grayscale(.6)}& .mz-quiet s{color:var(--faint)}
& .mz-reply{display:flex;align-items:center;gap:10px;width:100%;margin-top:14px;padding:10px 12px;border-radius:14px;background:var(--page);font-size:13.5px;color:var(--faint);text-align:left}& .mz-reply b{font-size:12px;font-weight:700;color:var(--sub)}& .mz-reply span{flex:1;min-width:0}& .mz-reply svg.ic{width:24px;height:24px;flex:0 0 auto}
& .mz-h{font-family:var(--disp);font-size:19px;font-weight:700;letter-spacing:-.4px;line-height:1.2;margin:10px 0 6px;text-wrap:balance}
& .mz-sub{font-size:13px;line-height:1.45;color:var(--sub);margin-top:6px}& .mz-sub b{color:var(--ink)}
& .mz-lab{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12px;font-weight:650;color:var(--sub);margin:0 0 8px}& .mz-lab span:last-child:not(:first-child){font-weight:500;color:var(--faint);text-align:right}
& .fh-card>.mz-lab:not(:first-child){margin-top:14px}
& .mz-big{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}& .mz-big .v{font-size:13px;color:var(--sub);line-height:1.35;flex:1;min-width:120px}& .mz-big .fh-big small{margin-left:2px}
& .mz-conf{display:flex;align-items:center;gap:10px;width:100%;margin-top:12px;font-size:12.5px;color:var(--sub);text-align:left}& .mz-conf .bar{flex:1;height:6px;border-radius:3px}& .mz-conf b{color:var(--ink);font-weight:700}
& .mz-c{padding-top:14px;margin-top:14px;border-top:1px solid var(--hair)}& .mz-c:first-child,& .mz-lab + .mz-c{padding-top:0;margin-top:0;border-top:0}
& .mz-th>*+*{margin-top:16px}
& .mz-me{margin-left:auto;width:fit-content;max-width:86%;padding:9px 13px;border-radius:16px 16px 4px 16px;background:color-mix(in srgb,var(--dom) 11%,#fff)}& .mz-me p{font-size:14.5px;line-height:1.45}& .mz-me small{display:block;font-size:11px;color:var(--sub);text-align:right;margin-top:2px}
& .mz-tag{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:8px 0 0 46px;font-size:12px;color:var(--sub)}
& .mz-in{margin-left:46px}
& .mz-ty{display:inline-flex;gap:4px;padding:8px 0}& .mz-ty i{width:7px;height:7px;border-radius:50%;background:var(--faint)}& .mz-ty i:nth-child(2){opacity:.7}& .mz-ty i:nth-child(3){opacity:.4}
& .mz-kb{display:block;width:100%;margin-top:6px}
& .kst{display:block;width:100%;height:auto;margin:10px 0 2px;overflow:visible}& .kst line{stroke:rgba(15,30,51,.22);stroke-width:1}& .kst line.d{stroke-dasharray:2 4}& .kst line.s{stroke:var(--dom);stroke-width:2.2;stroke-linecap:round}
& .kst circle{fill:var(--faint)}& .kst circle.big{fill:var(--dom)}& .kst text{font-size:9px;font-weight:600;fill:var(--sub)}
& .kst path.d{fill:none;stroke:rgba(15,30,51,.16);stroke-width:1;stroke-dasharray:2 3}& .kst.cur path.s{fill:none;stroke:var(--c,var(--dom));stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}& .kst.cur circle.big{fill:var(--c,var(--dom))}
& .mz-dc{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:12px}& .mz-dc span{font-size:11.5px;font-weight:650;text-align:center;padding:8px 0;border-radius:10px;color:var(--faint);background:var(--page)}
& .mz-dc span.hit,& .mz-dc span.el{color:#fff;background:var(--dom)}& .mz-dc span.now{color:color-mix(in srgb,var(--dom) 80%,var(--ink));background:#fff;box-shadow:inset 0 0 0 2px var(--dom)}
& .mz-vs{display:grid;grid-template-columns:1fr 1fr;gap:10px}& .mz-vs div{padding:12px;border-radius:14px;background:var(--page);min-width:0}& .mz-vs span{font-size:11.5px;font-weight:700;color:var(--sub)}& .mz-vs p{font-size:13.5px;line-height:1.4;margin-top:4px;overflow-wrap:anywhere}
& .mz-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}& .mz-tags span{padding:4px 10px;border-radius:999px;background:var(--page);font-size:12px;font-weight:600;color:var(--sub)}
& .mz-day{font-size:12px;font-weight:700;color:var(--sub);margin:16px 0 8px}& .mz-day:first-child{margin-top:0}& .mz-day + .fh-row,& .mz-day + .fh-step{border-top:0;padding-top:0}
& .mz-fold{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:13px 0;border-top:1px solid var(--hair);font-size:14px;font-weight:600;text-align:left}& .mz-fold:first-child{border-top:0;padding-top:0}& .mz-fold i{font-style:normal;font-size:12px;font-weight:650;color:color-mix(in srgb,var(--dom) 80%,var(--ink));flex:0 0 auto}
& .mz-foldb{padding-bottom:10px}& .mz-foldb .fh-row:first-of-type{padding-top:0}
& .mz-tgl{width:44px;height:26px;border-radius:13px;background:rgba(15,30,51,.14);position:relative;flex:0 0 auto;transition:.2s}& .mz-tgl i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(15,30,51,.25);transition:.2s}& .mz-tgl.on{background:var(--dom)}& .mz-tgl.on i{left:21px}
& .fh-row.off strong{color:var(--faint)}
& .mz-life{display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-top:1px solid var(--hair)}& .mz-life:first-of-type{border-top:0;padding-top:0}& .mz-life u{width:10px;height:10px;border-radius:50%;background:var(--dom);margin-top:5px;flex:0 0 auto}& .mz-life u.dim{background:rgba(15,30,51,.16)}& .mz-life .g{flex:1;min-width:0}& .mz-life strong{display:block;font-size:14.5px;font-weight:600}& .mz-life small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px}& .mz-life em{font-style:normal;font-size:12px;font-weight:600;color:var(--sub);white-space:nowrap}
& .mz-q{font-family:var(--disp);font-size:17px;font-weight:700;letter-spacing:-.3px;line-height:1.25;margin:10px 0 4px;text-wrap:balance}
& .mz-srcq{font-size:13.5px;line-height:1.4;color:var(--sub);padding:8px 12px;border-radius:12px;background:var(--page);margin-top:8px}
& .mz-warn{font-size:13px;font-weight:600;color:var(--warn);margin-top:10px}
& .mz-ed .fh-in{margin-top:10px}& textarea.fh-in{resize:none;line-height:1.45}
& .mz-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}& .mz-nav .off{font-size:13.5px;color:var(--faint)}
& .mz-flow{display:flex;align-items:stretch;gap:6px;margin-top:12px}& .mz-flow div{flex:1;min-width:0;padding:10px 6px;border-radius:14px;background:rgba(255,255,255,.75);text-align:center;box-shadow:inset 0 0 0 1px rgba(15,30,51,.06)}& .mz-flow b{display:block;font-family:var(--disp);font-size:22px;font-weight:800}& .mz-flow small{font-size:11px;color:var(--sub);line-height:1.2;display:block}& .mz-flow i{align-self:center;font-style:normal;color:var(--faint);font-weight:700}
& .mz-code{font-size:11.5px;color:var(--faint);overflow-wrap:anywhere}
& .mz-mem{display:flex;align-items:flex-start;gap:10px;margin-left:46px;padding:10px 12px;border-radius:14px;background:var(--page);font-size:13px;line-height:1.4}& .mz-mem svg.ic{width:24px;height:24px;flex:0 0 auto}& .mz-mem .g{flex:1;min-width:0}& .mz-mem .g small{display:block;font-size:11.5px;color:var(--sub);margin-top:2px}& .mz-mem.prop{background:color-mix(in srgb,var(--warn) 12%,#fff)}
& .mz-mem ul{margin:4px 0 0;padding-left:16px}& .mz-mem .ma{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin-top:8px}& .mz-mem .ma .btn.sm{padding:7px 14px}
& .mz-rec{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:12.5px;font-weight:600;color:color-mix(in srgb,var(--dom) 80%,var(--ink));text-align:left}& .mz-rec svg.ic{width:20px;height:20px;flex:0 0 auto}
& .mz-comp{display:flex;align-items:center;gap:8px;flex:1;min-width:0}& .mz-comp .inp{flex:1;min-width:0;font-size:14px;color:var(--faint);padding:6px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}& .mz-comp .inp.on{color:var(--ink)}& .mz-comp button{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:var(--page);flex:0 0 auto}& .mz-comp button svg.ic{width:26px;height:26px}& .mz-comp button.send{background:var(--dom)}& .mz-comp button[disabled]{opacity:.4}
& .mz-bars{display:flex;gap:3px;align-items:center;height:24px;flex:0 0 auto}& .mz-bars i{width:3px;border-radius:2px;background:var(--dom);height:var(--h)}
& .mz-refs{margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--page);font-size:12.5px;color:var(--sub);line-height:1.5}& .mz-refs b{display:block;font-size:11.5px;color:var(--ink)}
& .mz-prose p{font-size:15px;line-height:1.6;margin:0 0 10px}& .mz-prose p.drop::first-letter{font-family:var(--disp);font-size:40px;font-weight:800;float:left;line-height:.9;margin:4px 8px 0 0;color:var(--dom)}
& .mz-pager{display:flex;justify-content:space-between;gap:10px}& .mz-pager button{flex:1;min-width:0;text-align:left;padding:12px;border-radius:14px;background:var(--page);font-size:12.5px;color:var(--sub)}& .mz-pager button.r{text-align:right}& .mz-pager small{display:block;font-size:11px;font-weight:650;color:var(--faint)}& .mz-pager strong{display:block;font-size:14px;color:var(--ink)}
& .mz-steps{display:flex;gap:6px;margin-bottom:10px}& .mz-steps i{flex:1;height:5px;border-radius:3px;background:rgba(15,30,51,.1)}& .mz-steps i.done{background:color-mix(in srgb,var(--dom) 45%,#fff)}& .mz-steps i.cur{background:var(--dom)}
& .mz-forms{display:flex;justify-content:space-between;gap:4px;flex-wrap:wrap}& .mz-forms span{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:700;min-width:44px}& .mz-forms small{font-size:10.5px;font-weight:500;color:var(--sub)}
& .mz-num{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-family:var(--disp);font-size:13px;font-weight:800;color:color-mix(in srgb,var(--dom) 80%,var(--ink));background:color-mix(in srgb,var(--dom) 12%,#fff);flex:0 0 auto}
& .mz-wk{display:flex;align-items:flex-end;gap:6px;height:64px;margin-top:12px}& .mz-wk i{flex:1;border-radius:6px 6px 2px 2px;background:color-mix(in srgb,var(--dom) 55%,#fff);height:var(--h)}
& .sheet .fh-txt{margin-top:6px}& .sheet .fh-in{margin-top:12px}& .sheet ul{margin:8px 0 0;padding-left:18px;font-size:14px;line-height:1.5}& .sheet li small{display:block;font-size:12px;color:var(--sub)}
& .sheet .mz-eb{display:block;font-size:12px;font-weight:650;color:color-mix(in srgb,var(--dom) 75%,var(--ink));margin-bottom:4px}
& .sheet .mz-cmp{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}& .sheet .mz-cmp div{padding:12px;border-radius:14px;background:var(--page)}& .sheet .mz-cmp span{display:block;font-size:11.5px;font-weight:700;color:var(--sub)}& .sheet .mz-cmp small{display:block;font-size:11.5px;color:var(--sub)}
`.replace(/&/g,'.phone[data-v="feher"][data-d="mezo"]');

/* ═════════ ÜZENŐFAL ═════════ */
/* a csapat mint öt edény: a szint az, mennyi mondanivalójuk van ma neked */
const TEAMNOW=[{id:'szunya',p:92,l:'rád vár',dot:1,alive:1},{id:'mocor',p:40,l:'sejtés · 5/8'},{id:'falat',p:84,l:'döntés kell',dot:1,alive:1},{id:'deru',p:54,l:'kérése van'},{id:'mezo',p:22,l:'csendben'}];
const sum=(ids,label,go)=>`<button class="mz-sum" data-go="${go}">${ids.length?minis(ids):''}<span>${label} ›</span></button>`;
const post=(id,meta,text,extra='',i=3,flag='')=>card(`${flag?lab(flag[0],flag[1]||''):''}${say(id,text,meta)}${extra}`,{i});
function fal(){
  const live=ST.eloDone;
  return P({title:'Üzenőfal',sub:'Mezo · hétfő · esti kiadás 21:00',tab:'mai'},`
  <div class="mz-pill ${ST.pill&&!ST.pillUsed?'on':''}" id="mzpill" data-m="pill">1 új bejegyzés ↑</div>
  ${hero({lbl:'A te kis csapatod · ma',verdict:'2 beszélgetésben várnak rád.',sub:'A késői vacsora ügyéhez és az étkezési döntéshez a te szavad hiányzik.',body:forms(TEAMNOW)+gcap('A szint: mennyi mondanivalójuk van ma neked. Koppints valakire, és az oldalára jutsz.'),
    acts:btn('Megnézem',{go:'poszt.vacsora'})+lk('Az étkezési döntés ›',{go:'poszt.dontes'})})}
  ${sec(1,'Rád vár',2)}
  ${card(row({left:'<i class="mz-ldot"></i>',title:'Élőben · a csapat beszél',sub:live?'Közérzet: „Harmadik napja 7 fölötti stresszt jelöltél…”':'Étkezés: „Megvan, 1 140 kcal — rendeződött ✅”',v:live?null:'1 új',on:'elo'})
    +row({left:W('szunya'),title:'Rosszabbul alszol, ha későn vacsorázol?',sub:'Alvás · a késői vacsora ügye · 3 hozzászólás',right:st('Rád vár','warn'),on:'poszt.vacsora'})
    +row({left:W('falat'),title:'Korábbi vacsora, nyugodtabb este?',sub:'Étkezés · döntés kell · 18 nap, elég adat van',right:st('Döntés','warn'),on:'poszt.dontes'}),{i:2})}
  ${sec(2,'Ma',3)}
  <div id="today">${post('deru','közérzet · ma 13:40 · kérés','Két hétből csak <b>4 estéről tudom</b>, hogy érezted magad — így a stressz-szálhoz még nem tudok hozzányúlni, pedig gyanús nekem valami. 🌤️ Ha ma este bejelentkezel (tényleg 1 perc), hétvégére már meg tudom mutatni, mi mozgatja az energiádat. A sejtésem: <b>az alvásoddal függ össze</b>, nem a munkával.',acts(btn('Bejelentkezem · 1 perc',{toast:'Bejelentkezés — 1 perces közérzet-kör'},'sm ghost')+more()),3)}</div>
  ${sec(3,'Tegnap · esti kiadás',4)}
  ${card(`${lab('Alvás · bevonva: Étkezés és a Szkeptikus',st('Rád vár','warn'))}${h3('Lehet, hogy nem az edzés tolja el az estédet.')}${say('szunya','A késői vacsorák inkább a <b>későn befejezett napok</b> mellé esnek — és utánuk rendre rosszabb az éjszakád: később alszol el, és a mély szakaszból is kevesebb jut. 🌙 Az edzés-estéket külön néztem: azok után <b>nem</b> látom ugyanezt. <span style="color:var(--acc)">@Étkezés</span>, nálad mi látszik a vacsora-oldalon?','alvás · 20:30')}
    <button class="mz-kb" data-sheet="evidence" aria-label="Miből látszik?">${G_VACS(1)}</button>${gcap('Az alvásod átlaga a kétféle este után · koppints a részletekért')}
    ${src('minta.vacsora','14 közös nap')}
    ${sum(['falat','szk'],'Az Étkezés egyetért, a Szkeptikus vitatja · 3 hozzászólás','poszt.vacsora')}
    ${votes('p-vacs',' · 1')}
    ${cmt('szk','Szép együttfutás, de a hétvége önmagában is magyarázhatja: akkor eszel későn <b>és</b> akkor alszol rosszabbul. Válasszuk szét a hétköznapot a hétvégétől, mielőtt bármit kimondunk.')}
    ${lk('Mind a 3 hozzászólás megnézése',{go:'poszt.vacsora'})}${reply()}`,{i:4})}
  ${post('falat','étkezés · 20:30 · napi értékelés','A mai tányérod rendben volt — a fehérje megint összejött (<b>148 g</b> 💪), és a meccs előtti szénhidrát is a helyén. Egy dolgot vinnék át holnapra: <b>a zöldség délután elmaradt</b>, pedig délelőtt szépen megy. 🥦 Holnap a délutáni falatokhoz hozok egy konkrét javaslatot.',rack([['A tányér',78,'rendben','t-bowl'],['A cél',64,'jó úton','t-target'],['Az edzés',90,'bevált','t-dumbbell']].map(([l,w,v,i2])=>({p:w,v,l,top:bub(i2,{s:34})})),{h:64})+gcap('Az Étkezés esti három szempontja: a tányér · a cél · az edzés üzemanyaga')+votes('p-falat1'),5)}
  ${post('mezo','a csapat · 20:30 · a nap beszélgetései','Tegnap két ügyön dolgoztunk. 📔 Délben a Mozgás jelezte, hogy az esti edzéshez kevés az üzemanyag — az Étkezés az ebédnél pótoltatta, és <b>13:05-re rendeződött</b> ✅. A lefekvés ügye nyitva maradt: a <b>22:45-ös</b> lefekvésből 23:20 lett, ma este újra próbáljuk.',tags(['2 ügy','1 rendeződött','1 holnapra maradt'])+sum(['szunya','mocor','falat'],'A tegnapi beszélgetés · 9 üzenet','elo')+votes('p-mezo1'),5)}
  ${post('falat','étkezés · 20:30','Kezd úgy tűnni, hogy <b>a többet ivós napjaidon több az energiád</b> 💧 — 2 liter fölött rendre 6–8 pontot jelentettél, 1,5 alatt inkább 4–5-öt. <b>8 napot tudok összevetni</b>, épp annyit, amennyit a terv kér. Innen a te szavad kell: igaz ez rád?',acts(src('minta.viz','8 nap'))+votes('p-viz'),6,['A te döntésed kell',st('Rád vár','warn')])}
  ${post('mocor','mozgás · 20:30 · még csak sejtés','Kezd összeállni egy kép: az <b>egyhangúbb hetek</b> után esik az energiád — ha három napig ugyanaz a terhelés megy, a negyediken laposabb a reggeli jelentkezésed. ⚡ Még csak 5 közös napom van a 8-ból, úgyhogy nem mondom ki. Ha jövő héten becsúszik egy változatosabb blokk, sokat fogok tanulni belőle.',honest('5 / 8 nap',62,'még kevés adat','poszt.sejtes')+acts(src('minta.egyhangu','5 / 8 nap'))+votes('p-sejt'),6)}
  ${post('falat','étkezés · 20:30 · közös kísérlet a Mozgással · 4/7 nap','<b>Szénhidrát a meccs előtt</b> 🏐 — két meccsnapon próbáltuk, és mindkétszer stabilabb volt az ugrásod a végjátékban, a 4. szettben is. Ma este megint meccs: ha 17 óráig bekerül a <b>80 g szénhidrát</b>, holnapra majdnem kész a kép.',`<button class="mz-kb" data-go="poszt.kiserlet" aria-label="A kísérlet oldala">${dcell([['Cs','hit'],['P','hit'],['Szo'],['V','hit'],['H','now'],['K'],['Sze']])}</button>`+acts(src('kiserlet-oldal.szenhidrat','4/7 nap'))+sum(['mocor'],'A Mozgás követi · a kísérlet oldala','poszt.kiserlet')+votes('p-kis'),7)}
  ${post('szunya','alvás · szombat · megfigyelés','Hétvégén átlag <b>40 perccel később</b> fekszel le, mint hétköznap — és ezt a hétfői első bejelentkezésed rendre megérzi. 💤 Nem a hétvége a baj, hanem a <b>hétfői ugrás</b>: már egy köztes vasárnapi lefekvés is sokat kisimítana.',done('Megerősítetted · bekerült a rólad szóló képbe')+acts(src('minta.hetvege','26 nap')),7)}
  ${sec(4,'Vasárnap · konzílium',8)}
  ${post('mezo','a csapat · vasárnap 19:30 · heti konzílium','Vasárnap leültünk mind az öten, és végigvettük a hetedet. 📔 <b>Két dolog került a rólad szóló képbe</b> (a hétvégi lefekvés-minta és a meccs előtti szénhidrát), egyet nyugdíjaztunk, mert három hete nem erősödik. A Szkeptikus két felvetést visszadobott — jogosan: kevés még mögöttük a nap. <b>Jövő héten a vacsora-ügy a fókusz.</b>',tags(['+2 bekerült','1 nyugdíjazva','2 visszadobva'])+sum(['szunya','mocor','falat'],'Az ülés jegyzőkönyve · 4 forduló','konzilium')+votes('p-konz'),8)}
  ${post('mocor','mozgás · vasárnap · lezárt előrejelzés','<b>Ez most nem jött be.</b> Könnyebbnek vártam a jó alvás utáni edzést, te ugyanolyannak érezted. Ez is számít — ebből a jelből mostantól óvatosabban következtetek. ⚡',acts(src('elore.alvas-edzes'))+sum([],'Ezt vártam — és ez történt · a teljes kép','poszt.elorejelzes')+votes('p-elore'),8)}
  ${card(note('Ennyi történt. A folyamatban lévő ügyeket közben tovább figyeljük.'),{i:8,cls:'mz-end'})}`);
}

/* ═════════ ÉLŐBEN · a csapat beszél + Étkezés válasza ═════════ */
const cmeta=(push,t)=>push?`értesítettünk · ${t}`:`csendben · ${t}`;
const ctag=(label,k,meta,ev=true)=>`<div class="mz-tag">${st(label,k)}<span>${meta}</span>${ev?lk('Miből látszik?',{sheet:'elo-ev'}):''}</div>`;
const tm=(id,time,tx,{tag='',act=''}={})=>`<div>${say(id,tx,`${AREA[id]} · ${time}`)}${tag}${act?`<div class="mz-in">${act}</div>`:''}</div>`;
const MDK={spark:'full',bulb:'half',eraser:'gone',people:'empty'};
const memchip=(icon,body,actions='',cls='')=>`<div class="mz-mem ${cls}">${drop({k:MDK[icon]||'full',ic:icon,s:26,c:icon==='bulb'?'var(--warn)':icon==='eraser'?'var(--faint)':'var(--dom)'})}<div class="g">${body}${actions?`<div class="ma">${actions}</div>`:''}</div></div>`;
const s7acts=()=>{const v=ST.vote.s7;return `<div class="mz-v">${cm('Ez talál','vote:s7:up',v==='up')}${cm('Nem így érzem','vote:s7:down',v==='down')}${cs('Elmesélem','reply-falat')}</div>`};
function s7Block(){const p=ST.s7.phase,t=esc(ST.s7.text),closed=p==='closed';
  const open=tm('falat','21:40','Harmadszor ezen a héten <span class="hl">21 óra után</span> került a vacsora a tányérra. 🍽️ Ha holnap <span class="hl">20:00</span> előtt eszel, az alvásod is hálás lesz érte.',{tag:ctag(closed?'Késői vacsora · rendeződött 21:52':'Késői vacsora · nyitott',closed?'q':'warn',cmeta(false,'21:40')),act:(p==='open'||p==='undone'||p==='mood')?s7acts():''});
  let tail='';
  if(p==='typing'||p==='moodTyping')tail=me('21:51',t)+typing('falat');
  if(p==='closed'||p==='undone'){
    const aft=closed?ctag('Lezárva: meccsnap','q','csendben',false)+`<div style="margin-top:8px">${memchip('spark','<b>Megjegyeztem:</b> meccsnapokon később eszel — ez rendben van.',ml('Visszavonom','s7:undo'))}</div>`
      :`<div class="mz-in">${quiet('spark','Visszavonva — nem jegyeztem meg, és az ügy újra nyitott.')}</div>`;
    tail=me('21:51',t)+tm('falat','21:52','Értem — egy 10-kor véget érő kupa után ez teljesen rendben van. Meccsnapokon nem ezen fogok aggódni.',{tag:aft})}
  if(p==='mood')tail=me('21:51',t)+tm('falat','21:52','Megértem, ilyen napok is vannak. Holnap nézzük meg együtt, mi lenne a gyors, korai megoldás.');
  return `<div id="s7" class="mz-th">${open}${tail}</div>`}
const DERU=()=>tm('deru','16:20','Harmadik napja <span class="hl">7 fölötti</span> stresszt jelöltél be délután. 🌤️ Nem kell most megoldani — de vacsora után <span class="hl">10 perc séta</span> nálad eddig a következő reggelre átlag 2 ponttal lejjebb vitte.',{tag:ctag('Tartós stressz · nyitott','warn',cmeta(false,'a mai 2 értesítés elfogyott')),act:votes('deru-live','',false)});
function elo(arg){
  if(arg==='kivetel'){const d=ST.s7k==='done';
    return P({title:'A csapat beszél',sub:'Szerda · élőben · a következő alkalom',back:'mai'},`
    ${hero({lbl:'Étkezés · kérdés',verdict:d?'Kivételként lezárva: meccsnap.':'Ma is meccsnap volt?',sub:'Meccsnapokon később eszel — ezt hétfő óta tudjuk, ezért most csak rákérdezünk.',left:WA('falat',64),
      body:dayrow(5,d?1:0,{cur:d?-1:0,lab:i=>i<4?(i+1)+'.':'kérdez'})+gcap('A „meccsnap” kivétel 30 napon belül négyszer megy fel csendben — az ötödiknél rákérdezünk.'),
      acts:d?done('Egy csendes strigula került a meccsnapra.'):mb('Igen, meccsnap volt','s7k')})}
    ${sec(1,'Este · a beszélgetés',1)}
    ${card(`<div class="mz-th">${tm('falat','21:35','Tudom, hogy meccsnapokon később eszel — ez rendben van. Ma is meccsnap volt?',{tag:ctag(d?'Kivétel: meccsnap':'Késői vacsora · kérdés',d?'q':'warn','csendben · nem értesítettünk',false)})}${d?me('21:36','Igen, meccsnap volt')+tm('falat','21:36','Rendben, akkor ez most is kivétel volt.'):''}</div>`,{i:1})}
    ${sec(2,'Honnan tudja?',2)}
    ${card(txt('Hétfőn elmondtad, és megjegyeztük. Ha a mai jegyzetedben szerepelt volna a meccs, ez a kérdés meg sem jelenik — csak egy csendes strigula kerül a kivételre.')+sub('Ha a gomb helyett írsz, azt is megérti — de kikapcsolni egy kivételt csak gombbal lehet.'),{i:2})}`)}
  if(arg==='felulvizsgalat'){const s=ST.s7r;
    return P({title:'A csapat beszél',sub:'Egy hónappal később · élőben',back:'mai'},`
    ${hero({lbl:'Étkezés · kérdés',verdict:s==='keep'?'Marad a kivétel: meccsnap.':s==='stop'?'A kivételt kikapcsoltad.':'Rendben van még a meccsnap-kivétel?',sub:'Az utóbbi időben 4 alkalommal jött elő — az ötödiknél egyszer rákérdezünk.',left:WA('falat',64),
      body:dayrow(5,s==='keep'?0:4,{cur:s==='open'?4:-1,lab:i=>i<4?(i+1)+'.':'kérdez',hit:s==='stop'?[0,0,0,0,0]:null})+gcap(s==='keep'?'Kiürítve — a számolás újraindult.':s==='stop'?'A kivétel kikapcsolva: nincs több csendes felmentés.':'Négy csendes felmentés megtelt — ez az ötödik alkalom.'),
      acts:s==='open'?mb('Rendben van','s7r:keep')+ml('Nem, figyelj rá','s7r:stop'):done(s==='keep'?'Újraindul a számolás.':'A késői vacsorákra újra szól.')})}
    ${sec(1,'Este · a beszélgetés',1)}
    ${card(`<div class="mz-th">${tm('falat','21:35','Az utóbbi időben 4 alkalommal jött elő ez a kivétel: meccsnap. Ez még rendben van így, vagy figyeljek rá újra?',{tag:ctag(s==='keep'?'Kivétel marad: meccsnap':s==='stop'?'Kivétel kikapcsolva':'Késői vacsora · felülvizsgálat',s==='open'?'warn':'q','csendben · nem értesítettünk',false)})}
      ${s==='keep'?me('21:37','Rendben van')+tm('falat','21:37','Rendben, akkor marad így — tovább figyelek.'):''}
      ${s==='stop'?me('21:37','Nem, figyelj rá')+tm('falat','21:37','Rendben, akkor újra szólok, ha előjön.',{tag:`<div class="mz-in">${quiet('mute','A „meccsnap” kivételt kikapcsoltam — a Tudástárban is elnémítva, a késői vacsorákra újra szólok.')}</div>`}):''}</div>`,{i:1})}
    ${sec(2,'Miért kérdez?',2)}
    ${card(txt('Egy kivétel 30 napon belül legfeljebb négyszer ment fel csendben. Az ötödiknél egyszer rákérdez — „Rendben van” után újraindul a számolás.'),{i:2})}`)}
  return P({title:'A csapat beszél',sub:'Ma · élőben · hétfő',back:'mai'},`
  ${hero({lbl:'Rád vár ma este',verdict:'22:45 előtt kerülj ágyba.',sub:'Este megnézzük. Mind az öt terület figyel — akkor szólnak, ha teendő van.',left:WA('szunya',64),
    body:tide([{x:9.3,t:'07:40',l:'alvás',c:MC('szunya'),k:'half'},{x:33.9,t:'12:05',l:'ebéd ✓',c:MC('falat'),k:'full'},{x:57.4,t:'16:20',l:'stressz',c:MC('deru'),k:ST.eloDone?'half':'empty'},{x:87,t:'21:40',l:'vacsora',c:MC('falat'),k:ST.s7.phase==='closed'?'full':'half'}],{now:88.5})+gcap('A nap folyama: teli csepp = rendeződött · fél csepp = nyitott ügy')+facts([['1','nyitott ügy'],['1','rendeződött'],['2 / 2','értesítés ma']]),acts:btn('A reggeli üzenethez',{toast:'Ugrás a reggeli üzenethez'})+minis(FIVE)})}
  ${sec(1,'Reggel',1)}
  ${card(`<div class="mz-th">${tm('szunya','07:40','Az elmúlt 3 éjszakán összesen <span class="hl">2 óra 10 perc</span> hiányzik a 7 és fél órás célodhoz képest. 🌙 Ma este nem kell semmi különös — csak <span class="hl">22:45 előtt</span> kerülj ágyba, és holnap reggelre a felét visszanyerjük.',{tag:ctag('Alvásadósság · nyitott','warn',cmeta(true,'07:40')),act:votes('szunya-live','',false)})}
    ${tm('szk','07:41','Egy megjegyzés: a szombati éjszakán az óra nem mérte a mély szakaszt, azt becsültük. A hiány ettől még valós, de lehet 20 perccel kevesebb is.')}</div>`,{i:1})}
  ${sec(2,'Délben',2)}
  ${card(`<div class="mz-th">${tm('mocor','12:05','Ma este <span class="hl">90 perces</span> röplabda-edzés vár, de délig csak <span class="hl">620 kcal</span> ment be — a szokásodnak a fele sincs meg. ⚡ Így a 4. szettre elfogy a lábad. <span class="m">@Étkezés</span>, tudsz segíteni?',{tag:ctag('Terhelés–táplálás','plan',cmeta(true,'12:05 · súlyosabb a reggelinél'))})}
    ${tm('falat','12:06','Persze! Az ebédnél pótolnám: <span class="hl">+40 g szénhidrát</span> — egy adag rizs vagy két szelet kenyér a fehérjéd mellé. 🍽️ Ha 14 óráig bekerül, bőven marad idő megemészteni.',{act:votes('falat-live','',false)})}
    ${me('12:40','Rizses csirkét ettem, dupla adag rizzsel.')}
    ${tm('falat','13:05','Megvan: az ebéddel <span class="hl">1 140 kcal</span> és <span class="hl">95 g szénhidrát</span> jött össze — ez bőven elég az estéhez. ✅ 🥦 Mozgás, tiéd a szó!',{tag:ctag('Rendeződött · 13:05','q',cmeta(false,'a lezárás sosem értesít'))})}
    ${tm('mocor','13:06','Akkor este teljes gázzal. 💪 Az első szettben figyelem, bírja-e a lábad.')}</div>`,{i:2})}
  ${sec(3,'Délután',3)}
  ${card(`<div id="live" class="mz-th">${ST.eloDone?DERU():typing('deru')}</div>`,{i:3})}
  ${sec(4,'Este',4)}
  ${card(s7Block(),{i:4})}
  ${card(row({icon:'t-journal',title:'21:00-kor az esti kiadás',sub:'Összefoglalja a nap szálait a falon. A nyitva maradt ügyet holnap reggel az Alvás újra előveszi.'})+note('Szabály: egy terület csak akkor szól, ha teendő van — és akkor, amikor rendeződött. Naponta legfeljebb 2 értesítés megy ki; a második csak súlyosabb ügyre.')+reply(),{i:5})}`);
}
function napUzenetek(){return P({title:'Beszélgetés',sub:'Nap · beszélgetés',back:'mai'},`
  ${card(sg([['u','Üzenetek'],['e','Életjelek'],['o','Észrevételek']],'u','ntab').replace('class="fh-seg"','class="fh-seg" style="margin:0"'),{i:0})}
  ${hero({lbl:'A csapat most erről beszél',verdict:'Három szál fut ma: alvás, ebéd, stressz.',sub:'Alvás: „22:45 előtt ágyba” · Étkezés: „az ebéd rendben ✅” · Közérzet: „tartós stressz”',left:minis(['szunya','falat','deru']),body:tide([{x:9.3,t:'07:40',l:'alvás',c:MC('szunya'),k:'half',on:'elo'},{x:39,t:'13:05',l:'ebéd ✓',c:MC('falat'),k:'full',on:'elo'},{x:57.4,t:'16:20',l:'stressz',c:MC('deru'),k:'half',on:'elo'}],{now:60}),acts:btn('Megnyitom a beszélgetést',{go:'elo'})},1)}
  ${sec(1,'Mi változott itt?',2)}
  ${card(txt('A napi tanácskártya innen átköltözött a csapat-chatbe — ott születik, ott reagálsz rá, és ott zárul le. Itt csak ez az egy sor maradt, hogy ugyanonnan elérd.'),{i:2})}`)}

/* ═════════ A CSAPAT + SZOBÁK ═════════ */
function csapat(){const R=[['szunya','Most figyeli: a késői vacsorák és az éjszakád · 1 új kérdés vár rád','72%'],['mocor','Most figyeli: a terhelésed · 1 sejtésen dolgozik','60%'],['falat','Most figyeli: a vacsoraidőd · 1 aktív kísérlete fut','80%'],['deru','Kevés az adata — ma kért tőled egy bejelentkezést','30%'],['mezo','Vasárnapi konzílium: 2 dolog került a közös képbe','66%']];
  return P({title:'A csapat',sub:'Mezo · ők figyelnek rád',tab:'csapat'},`
  ${hero({lbl:'Öten figyelnek rád',verdict:'Az alvásod ügyében új kérdés vár.',sub:'A késői vacsorák és az éjszakád ügyében a te szemed hiányzik.',body:forms(R.map(([id,s,m])=>({id,p:parseInt(m),v:parseInt(m),l:AREA[id],dot:id==='szunya',alive:id==='szunya'})),{s:58})+gcap('A szint: mennyire érett a képük rólad (%) — minél több naplód van, annál többet tudnak.'),acts:btn('Alvás oldala',{go:'szoba.szunya'})})}
  ${sec(1,'A csapat tagjai',1)}
  ${card(R.map(([id,s,m])=>row({left:W(id,40),title:`${nm(id)} · ${AREA[id]}`,sub:`${s}${lvl(parseInt(m),MC(id),8)}`,v:m,on:`szoba.${id}`})).join(''),{i:1})}
  ${sec(2,'A Szkeptikus',2)}
  ${card(say('szk','Nem posztol — a beszélgetésekben kérdez vissza, mielőtt bármi bekerülne rólad.','a csapat kételkedője'),{i:2})}
  ${sec(3,'A közös munka',3)}
  ${card(row({icon:'t-council',title:'Konzílium',sub:'A heti ülés jegyzőkönyve · 2 dolog került be rólad',on:'konzilium'})
    +row({icon:'t-gear',title:'Gépterem · Összes funkció',sub:'A motorháztető és a régi eszköztár — dev-ajtó',on:'gepterem'}),{i:3})}`)}
const ROOMS={
  szunya:{quote:'Az éjszakáid a szakterületem. Amit itt látsz, azt mind a te naplódból tanultam.',stats:[['15','éjszaka / 60 nap'],['3','beépült tudás']],rows:[
    ['Rád vár','warn','14 közös nap','moon','Rosszabbul alszol, ha későn vacsorázol?','Közös ügy az Étkezéssel — a te szemed hiányzik hozzá','poszt.vacsora',0],
    ['Gyűlik','q','6 / 8 nap','clock','A hétfői mélypontot a lefekvés ingadozása okozza?','Kb. egy hét, és megszólal — addig csendben számol','',75],
    ['Bekerült','q','szept. 20.','tick','Hétvégén 40 perccel később fekszel','Te erősítetted meg — a rólad szóló kép része','minta.hetvege',0]],
    mat:[52,55,58,58,63,66,70,72],
    tud:[['Hétvégén átlag 40 perccel később fekszel, és ezt a hétfőd érzi meg','te erősítetted meg','szept. 20.','Beépült'],['A jó éjszakáid 23:15 előtti lefekvéssel kezdődnek','12 éjszaka mintája','szept. 5.','Beépült'],['A 16 óra utáni kávé nyugtalanabb éjszakát hoz nálad','8 éjszaka + a te válaszod','aug. 30.','Beépült']],
    arch:[['Nyugdíjazva','3 hétig nem erősödött','moon','A délutáni alvás rontja az éjszakát?','Nem gyűlt hozzá elég nap — ha újra felbukkan, előveszi'],['Elvetetted','a te döntésed','skip','Képernyő lefekvés előtt = rossz alvás?','Azt mondtad, nálad nem így van — a csapat elfogadta']],
    ask:'Kérése: két hétből csak 6 éjszakát naplóztál — minden hiányzó éjszaka egy nappal tolja ki, mire biztosat mondhat.'},
  mocor:{quote:'A terhelésed és az erőd — és az, hogy a napló ne maradjon el. Nem hajtalak, de észreveszem.',stats:[['15','edzésnap / 60 nap'],['1','sejtés']],rows:[
    ['Sejtés','q','5 / 8 nap','bolt','Az egyhangú hetek viszik el az energiádat?','Még nem mondja ki — egy változatosabb hét kellene hozzá','poszt.sejtes',62],
    ['Kísérlet','q','4 / 7 nap','flask','Séta ebéd után — nyugodtabb lesz a délután?','Közös próba az Étkezéssel, együtt nézik majd az eredményt','poszt.kiserlet',57],
    ['Nem jött be','q','lezárva','down','Könnyebb az edzés, ha jól aludtál?','Nem igazolódott — ebből a jelből óvatosabban következtet','poszt.elorejelzes',0]],
    mat:[40,44,47,50,52,55,58,60],
    tud:[['Kihagyott nap után erősebben jössz vissza — az újrakezdés a te terepad','5 visszatérés mintája','szept. 12.','Beépült'],['A felsőtest-napok reggelén magasabb az energiád','9 edzésnap','szept. 2.','Beépült']],
    arch:[['Nem jött be','lezárva vasárnap','down','Könnyebb az edzés, ha jól aludtál?','Az érzeten nem látszik — az Alvással a súlyoknál keressük tovább']],
    ask:'Kérése: a szettek súlyát is írd fel — abból látja a valódi terhelést.'},
  falat:{quote:'A tányérod, a célod és az edzésed üzemanyaga. Minden este három szólamban értékelek.',stats:[['28','kajanap / 60 nap'],['1','aktív kísérlet']],rows:[
    ['Kísérlet','q','4 / 7 nap','flask','Meccs előtti szénhidrát — stabilabb az ugrásod?','Közös próba a Mozgással · ma este megint meccs 🏐','poszt.kiserlet',57],
    ['Rád vár','warn','14 közös nap','moon','Rosszabbul alszol, ha későn vacsorázol?','Közös ügy az Alvással — onnan indult, az Étkezés a vacsora-oldalt nézi','poszt.vacsora',0],
    ['Döntésre vár','warn','18 nap','sprout','Korábbi vacsora, nyugodtabb este?','Elég napja van hozzá — most a te döntésed kell','poszt.dontes',0]],
    mat:[60,64,68,70,73,76,78,80],
    tud:[['A fehérje-célod stabilan megvan — ez a te erősséged','21 nap átlaga','szept. 15.','Beépült'],['Hétvégén előfordul, hogy utólag naplózol','a te pontosításod','szept. 8.','Tőled'],['Edzésnapokon kisebb az esti sóvárgás','14 nap összevetése','aug. 28.','Beépült']],
    arch:[['Nyugdíjazva','nem erősödött','sugar','A reggeli cukor dönti el a napod?','6 hét után sem állt össze — pihen']],
    ask:'Napi műsora: a tányér · a cél · az edzés — minden este.'},
  deru:{quote:'Én arra figyelek, hogy vagy. Ehhez a te szavad kell — egy-egy rövid esti bejelentkezés.',stats:[['8','bejelentkezés / 60 nap'],['0','nyitott ügy']],rows:[
    ['Kérés','warn','1 perc','heart','Bejelentkezel ma este?','Hétvégére már látja, mi mozgatja az energiádat','',0]],
    mat:[18,20,22,24,25,27,28,30],
    tud:[['A jó napjaid reggeli mozgással kezdődnek','6 bejelentkezés + edzésnapló','szept. 10.','Beépült']],arch:[],
    ask:'Kevés az adata: két hétből 4 este. Ma bejelentkezést kért tőled.'},
  mezo:{quote:'Én fogom össze a csapatot. Csak az kerül a rólad szóló képbe, amiben egyetértünk.',stats:[['2','bekerült a héten'],['4','forduló']],rows:[
    ['Konzílium','q','vasárnap','journal','Mi került be rólad a héten?','2 bekerült · 1 nyugdíjazva — a jegyzőkönyv olvasható','konzilium',0],
    ['Krónika','q','készül','book','A heted története','Memoár-fejezet érkezik vasárnap estére','memoar',0],
    ['Dev','q','ajtó','info','Gépterem · Összes funkció','Futások, adatforrások, memória — a motorháztető alatt','gepterem',0]],
    mat:[50,53,55,58,60,62,64,66],
    tud:[['Szereted látni, mi miből következik — az indoklás neked jár','a te kérésed','aug. 20.','Tőled'],['Új munkarendet próbálsz szeptembertől','életesemény · tőled','szept. 1.','Tőled']],
    arch:[['Visszadobva','a Szkeptikus kérésére','skip','A hétvégi késés csak a röplabda miatt van?','Kevés volt mögötte a nap — várólistán']],
    ask:'A közös kép gondnoka: minden tény, esemény és döntés nála kereshető vissza.'}
};
function szoba(id){id=TEAM[id]&&ROOMS[id]?id:'szunya';const q=ROOMS[id],c=TEAM[id][2];
  return P({title:nm(id),sub:`A csapat · ${AREA[id]}`,back:'csapat'},`
  ${hero({lbl:`${nm(id)} mondja`,verdict:`„${q.quote}”`,body:bigform(id,q.mat[7],{cap:`Ennyire érett ${nm(id)} képe rólad — 3 hét alatt +${q.mat[7]-q.mat[4]}%.`})+facts([[q.mat[7]+'%','érettség'],...q.stats]),acts:btn('Amit rólad tud',{go:'tud.'+id})+lk(`Lezárt ügyei · ${q.arch.length}`,{go:'ugyek.'+id})})}
  ${sec(1,'Most ezen dolgozik',1)}
  ${card(q.rows.map(([s,k,meta,i,title,sb,go,pct])=>row({icon:ic(i),title,sub:`${meta} · ${sb}${pct?lvl(pct,c,8):''}`,right:st(s,k),on:go?{go}:{toast:'Saját oldala a megvalósításban nyílik meg'}})).join(''),{i:1})}
  ${sec(2,'Így érik a képe rólad',2)}
  ${card(lab('Érettség · 8 hét',`+${q.mat[7]-q.mat[4]}% · 3 hét`)+curve(q.mat,c)+note('A görbe a kimondott heti poszt-szám simítása — érettség-történet még nem létezik, ezért ennyit mutatunk, nem többet.'),{i:2})}
  ${sec(3,'Amit rólad tud',3)}
  ${card(q.tud.slice(0,3).map(([t,s,d,k])=>row({title:t,sub:`${s} · ${d}`,right:st(k)})).join('')+row({icon:'t-book',title:`Mind a ${q.tud.length} beépült tudás`,sub:'forrással és Elhallgattatom-kapcsolóval',on:'tud.'+id})
    +(q.arch.length?row({icon:'t-history',title:`Lezárt és nyugdíjazott ügyei · ${q.arch.length}`,sub:'az őszinteség itt is látszik',on:'ugyek.'+id}):''),{i:3})}
  ${sec(4,`${nm(id)} jegyzete · kérése hozzád`,4)}
  ${card(say(id,q.ask),{i:4})}`)}
function tud(id){id=ROOMS[id]?id:'szunya';const q=ROOMS[id];
  return P({title:'Amit rólad tud',sub:`${nm(id)} · ${q.tud.length} beépült tudás`,back:'szoba.'+id},`
  ${hero({lbl:`${nm(id)} · ${AREA[id]}`,verdict:`${q.tud.length} dolgot tud rólad biztosan.`,sub:'Minden elemnél látszik a forrása, és te döntesz: használható-e a beszélgetésekben. A kikapcsolás nem törli — csak elhallgattatja.',left:WA(id,64),body:drops(q.tud.map(([t,s,d,k])=>({k:k==='Tőled'?'half':'full',c:MC(id),s:26,t})),'teli csepp: a naplóidból mérte ki · fél csepp: tőled tudja')})}
  ${sec(1,'Beépült tudás',1)}
  ${q.tud.map(([t,s,d,k],n)=>card(`${lab(`<span class="mz-by">${drop({k:k==='Tőled'?'half':'full',c:MC(id),s:18})}${s} · ${d}</span>`,st(k))}<p class="mz-q">${t}</p><div class="mz-v">${cs('Miből látom?','mibol',t)}${ct('Elhallgattatom','Kikapcsolva a beszélgetésekből — az eredet megmarad')}</div>`,{i:n+1})).join('')}`)}
function ugyek(id){id=ROOMS[id]?id:'szunya';const q=ROOMS[id];
  return P({title:'Lezárt ügyek',sub:`${nm(id)} · ami nem jött be — az is számít`,back:'szoba.'+id},`
  ${hero({lbl:`${nm(id)} · ${AREA[id]}`,verdict:q.arch.length?`${q.arch.length} ügyet tett félre — nyíltan.`:'Még nincs lezárt ügye.',sub:'A csapat a tévedéseit is megőrzi: ettől hihető, amit kimond. Egy nyugdíjazott ügy bármikor visszatérhet, ha új adat érkezik.',left:W(id,64),body:q.arch.length?rack(q.arch.map(([s])=>({p:s==='Nyugdíjazva'?14:0,dash:s!=='Nyugdíjazva',c:'var(--faint)',l:s})),{h:54,cols:Math.max(3,q.arch.length)})+gcap('Kiürített edények: ami nem töltődött fel, azt nem tartjuk színültig.'):''})}
  ${sec(1,'Lezárt és nyugdíjazott ügyek',1)}
  ${card(q.arch.length?q.arch.map(([s,meta,i,title,sb])=>row({icon:ic(i),title,sub:`${meta} · ${sb}`,right:st(s)})).join(''):empty('t-history','Még nincs lezárt ügye.'),{i:1})}`)}

/* ═════════ POSZT-OLDALAK ═════════ */
function poszt(arg){
  if(arg==='kiserlet')return P({title:'Meccs előtti szénhidrát',sub:'Közös kísérlet · Étkezés × Mozgás',back:'mai'},`
    ${hero({lbl:'Kísérlet · 4 / 7 nap',verdict:'Stabilabb az ugrásod, ha meccs előtt szénhidrátot kapsz?',sub:'Az Étkezés a kísérlet gazdája, a Mozgással közösen. Két meccsnapból kettő találat.',body:chain([{l:'szénhidrát nélkül',s:'a próba előtt',v:'−11%',p:78,c:'var(--warn)'},{l:'80 g szénhidráttal',s:'2 meccsnap',v:'−4%',p:30}],[null])+gcap('Ennyit esik az ugrásod a 4. szettre a 2. szetthez képest — minél alacsonyabb a szint, annál jobb.'),acts:btn('Ma esti adag: megvolt',{toast:'Ma esti adag megjelölve'})+src('kiserlet-oldal.szenhidrat','4/7 nap')})}
    ${sec(1,'A terv',1)}
    ${card(say('falat','A terv egyszerű: meccsnapokon <b>17 óráig 80 g szénhidrát</b>, aztán megnézzük, mit mond a 4. szett. 🏐 Két meccsnapon már próbáltuk — mindkétszer stabilabb volt a végjáték.','étkezés · a kísérlet gazdája')+dcell([['Cs','hit'],['P','hit'],['Szo'],['V','hit'],['H','now'],['K'],['Sze']]),{i:1})}
    ${sec(2,'Eddigi meccsnapok · 2 / 2 találat',2)}
    ${card(row({icon:'t-up',title:'4. szett: az ugrásmagasság kitartott',sub:'szept. 18. · csütörtök · 80 g szénhidrát 16:40-ig · a meccs utáni jelentkezésed: „végig volt erőm”',right:st('Találat','ok')})
      +row({icon:'t-up',title:'Végjátékban is stabil láb',sub:'szept. 21. · vasárnap · 75 g szénhidrát 17:00-ig · a Mozgás a szettenkénti bontást is átnézte',right:st('Találat','ok')}),{i:2})}
    ${sec(3,'Beszélgetés · 1 hozzászólás',3)}
    ${card(cmt('mocor','A szettenkénti bontásban is látszik: a 4. szett ugrásai a 2. szetthez képest csak <b>4%-ot</b> estek — a próba előtt ez <b>11%</b> volt. 💪 Még két meccsnap, és kimondhatjuk. Addig ne változtass semmi máson, mert összekeveri a képet.','mozgás')+votes('pk')+reply(),{i:3})}`);
  if(arg==='sejtes')return P({title:'Az egyhangú hetek viszik el az energiádat?',sub:'Még csak sejtés · mozgás',back:'mai'},`
    ${hero({lbl:'Mozgás · sejtés · még kevés adat',verdict:'Ha három napig ugyanaz megy, a negyediken laposabb vagy.',sub:'5 közös nap a 8-ból — nyolc kell, hogy kimondja, és a Szkeptikus is figyel.',body:chain([{l:'vegyes terhelés után',s:'reggeli energia',v:'6,4',p:68,c:'var(--faint)'},{l:'3 egyforma nap után',s:'reggeli energia',v:'5,2',p:46}],[{w:5,dash:1,cap:'−1,2 pont',cap2:'még csak sejtés'}])+dayrow(8,5)+gcap('5 közös nap gyűlt össze a 8-ból — a szaggatott cső: még nem mondjuk ki.'),acts:btn('Miből látszik?',{go:'minta.egyhangu'})})}
    ${sec(1,'Amit a Mozgás lát',1)}
    ${card(say('mocor','Ötször láttam eddig: három egyforma terhelésű nap után a reggeli energiád <b>átlag 1,2 ponttal</b> alacsonyabb. ⚡ Ez még nem bizonyíték — nyolc közös nap kell, hogy kimondjam, és a Szkeptikus is figyel.','mozgás · 5/8 közös nap'),{i:1})}
    ${sec(2,'Mi kellene még?',2)}
    ${card(row({icon:'t-bolt',title:'Egy változatosabb hét',sub:'Ha jövő héten vegyes a terhelés, és az energiád NEM esik — az ellene szól, és azt is megköszönöm'})
      +row({icon:'t-heart',title:'3 további reggeli jelentkezés',sub:'A Közérzet gyűjti — az energiapontod nélkül nincs mihez mérni'}),{i:2})}
    ${sec(3,'Beszélgetés · 1 hozzászólás',3)}
    ${card(cmt('szk','Öt eset kevés, és a hét vége felé amúgy is fáradtabb az ember. Kérlek, a nyolcból legalább kettő legyen <b>hét eleji</b> egyforma-blokk, különben a naptár magyarázza, nem a terhelés.')+votes('ps')+reply(),{i:3})}`);
  if(arg==='dontes'){const d=ST.dontes==='yes';
    return P({title:'Korábbi vacsora, nyugodtabb este?',sub:'Döntésre vár · étkezés',back:'mai'},`
    ${hero({warn:!d,lbl:d?'Bekerült a rólad szóló képbe':'Étkezés · a te döntésed kell',verdict:'A 19 óra előtti vacsoráid után nyugodtabbak az estéid.',sub:'18 összevethető nap · elég adat van',left:W('falat',64),
      acts:d?done('Megerősítetted · bekerült a rólad szóló képbe — Mezo jóváhagyta'):mb('Ez talál','dontes')+cm('Nem így érzem','vote:pd:down',ST.vote.pd==='down')+cs('Elmesélem','reply'),
      body:''})}
    ${d?'':card(note('Az „Ez talál” itt döntés: a megfigyelés bekerül a rólad szóló képbe. Bármikor visszavonhatod.').replace('margin-top:10px',''),{i:1})}
    ${sec(1,'Amit az Étkezés lát',1)}
    ${card(say('falat','18 napot tudtam összevetni: a korai vacsorás estéken kevesebb a késő esti nassolás és <b>korábbi a lefekvés</b> is. 🥦 A számok szerint ez már nem véletlen — de a te megerősítésed nélkül nem kerül a rólad szóló képbe.','étkezés · 18 nap')+`<button class="mz-kb" data-sheet="evidence" aria-label="Miből látszik?">${chain([{l:'vacsora 19 előtt',s:'18 nap',p:82},{l:'kevesebb nassolás',s:'késő este',p:60},{l:'korábbi lefekvés',s:'nyugodtabb este',p:72}],[{w:11,cap:'erős'},{w:6,dash:1,cap:'gyengébb'}])}</button>`+gcap('Ami együtt mozog: a korai vacsora szintjével emelkedik a másik kettő is.'),{i:1})}
    ${sec(2,'Ha bekerül, mire használjuk?',2)}
    ${card(row({icon:'t-clock',title:'Az esti javaslatok időzítése',sub:'Az Étkezés 18 óra körül szól majd, nem fél tízkor'})+row({icon:'t-moon',title:'A késői vacsora ügye',sub:'Ez a minta a késői-vacsora vizsgálat egyik építőköve lesz'}),{i:2})}`)}
  if(arg==='elorejelzes')return P({title:'Könnyebb az edzés, ha jól aludtál?',sub:'Lezárt előrejelzés · mozgás',back:'mai'},`
    ${hero({lbl:'Mozgás · vasárnap zárult',verdict:'Ez most nem jött be — és ez is számít.',sub:'Nem igazolódott: a jó éjszaka utáni edzést ugyanolyannak érezted.',left:W('mocor',64),body:fore({p:62,v:'7 alatt',l:'ezt vártam · erőfeszítés-érzet',band:[52,70],bandL:'várt sáv',out:78,outL:'ez történt: 7,5–8',c:MC('mocor'),ticks:[[50,'5'],[70,'7'],[90,'9']]}),acts:btn('Miből látszik?',{go:'elore.alvas-edzes'})})}
    ${sec(1,'Ezt vártam — és ez történt',1)}
    ${card(vs('A jó éjszaka utáni edzés <b>könnyebbnek</b> érződik majd — 7-es erőfeszítés-érzet alatt.','Ugyanolyannak érezted: <b>7,5 és 8</b> között, a jó éjszakák után is.')+`<div style="margin-top:14px">${say('mocor','Ez is számít — sőt. ⚡ Ebből azt tanultam, hogy nálad az alvás <b>nem az érzeten</b> látszik meg, hanem máshol; az Alvással most azt nézzük, a súlyoknál jelentkezik-e. A becsléseimet ezért óvatosabbra vettem ennél a jelnél.','mozgás · amit ebből tanult')}</div>`,{i:1})}
    ${sec(2,'Beszélgetés · 1 hozzászólás',2)}
    ${card(cmt('szunya','Örülök, hogy kimondtad. 🌙 Nálam közben az látszik, hogy a jó éjszakák utáni napokon <b>korábban</b> kezded az edzést — lehet, hogy ott a hatás, nem az érzetben. Felveszem gyűlő ügynek.','alvás')+votes('pe')+reply(),{i:2})}`);
  return P({title:'Mi tolja későbbre az estédet?',sub:'Közös ügy · alvás × étkezés',back:'mai'},`
    ${hero({warn:true,lbl:'Alvás · rád vár',verdict:'Lehet, hogy nem az edzés tolja el az estédet.',sub:'Tegnap 20:30 · bevonva: Étkezés és a Szkeptikus.',left:W('szunya',64),
      acts:btn('Elmesélem',{sheet:'reply'})+cm('Ez talál · 1','vote:pv:up',ST.vote.pv==='up')+cm('Nem így érzem','vote:pv:down',ST.vote.pv==='down')+more()})}
    ${sec(1,'Amit az Alvás lát',1)}
    ${card(say('szunya','A késői vacsorák inkább a <b>későn befejezett napok</b> mellé esnek — és utánuk rendre rosszabb az éjszakád: később alszol el, és a mély szakaszból is kevesebb jut. 🌙 Az edzés-estéket külön néztem: azok után <b>nem</b> látom ugyanezt.','alvás · tegnap 20:30')+`<button class="mz-kb" data-sheet="evidence" aria-label="Miből látszik?">${G_VACS()}</button>`+gcap('Az alvásod átlaga a késői és a korai vacsorák után — a cső a kapcsolat ereje.'),{i:1})}
    ${sec(2,'Beszélgetés · 3 hozzászólás',2)}
    ${card(cmt('falat','Nálam is a <b>23 óra utáni vacsora</b> a vízválasztó: azokon a napokon átlag <b>380 kcal</b> csúszik este 9 utánra. 🥗 Két hét még, és szét tudom szedni, hogy a mennyiség vagy az időpont számít-e — a tippem: <b>az időpont</b>.','étkezés')+cmt('szk','Mielőtt megszeretjük ezt a történetet: a hétvége önmagában is magyarázhatja — akkor eszel későn <b>és</b> akkor alszol rosszabbul, a kettő között nem kell ok-okozatnak lennie. Javaslom, válasszuk szét a hétköznapot a hétvégétől. Ha hétköznap is kirajzolódik, meggyőztetek.')+cmt('mezo','A Szkeptikus javaslatát elfogadom — mostantól a hétvégét <b>külön követjük</b>, és addig ez <b>nem kerül</b> a rólad szóló képbe. ✅ Ha a hétköznapi napokon is kirajzolódik, jövő vasárnap újra elővesszük, és szavazunk róla.','a csapat · döntés')+reply(),{i:2})}
    ${sec(3,'Miből látszik?',3)}
    ${card(row({icon:'t-clock',title:'14 közös nap',sub:'ahol vacsoraidő ÉS alvásminőség is rögzült',on:'minta.vacsora'})+row({icon:'t-info',title:'A napok egyenként',sub:'11 mellette · 3 ellene',on:'bizonyitek'}),{i:3})}`);
}
function bizonyitek(){const rows=[['szept. 8.','20:10','6,1',1],['szept. 9.','18:35','7,8',1],['szept. 10.','21:05','5,9',1],['szept. 11.','19:20','7,1',0],['szept. 13.','22:00','5,4',1],['szept. 14.','18:50','7,6',1],['szept. 15.','19:05','6,2',0],['szept. 16.','21:30','5,8',1],['szept. 18.','18:20','7,9',1],['szept. 19.','20:45','6,4',0],['szept. 20.','22:15','5,6',1],['szept. 21.','19:00','7,4',1],['szept. 22.','20:30','6,0',1],['ma','—','még nincs',0]];
  return P({title:'Miből látszik?',sub:'Rosszabbul alszol, ha későn vacsorázol?',back:'poszt.vacsora'},`
  ${hero({lbl:'14 közös nap',verdict:'11 nap szól mellette, 3 ellene.',sub:'Két jel együttfutása: az <b>utolsó étkezésed ideje</b> és a <b>másnapi alvásminőség</b>. A felszín a trend; a halvány pontok a napok.',body:scat(MINTA.vacsora)+gcap('Vízszintesen a vacsora ideje, függőlegesen a másnapi alvásminőség. A kiemelt pont a legutóbbi nap.')})}
  ${sec(1,'A két jel, naponként',1)}
  ${card(G_VACS()+note('A csapat addig nem mond ki semmit, amíg a hétvégét külön nem látta — ez a Szkeptikus feltétele.'),{i:1})}
  ${sec(2,'A napok egyenként',2)}
  ${card(rows.map(q=>step({time:q[0],title:`vacsora ${q[1]}`,sub:`alvás ${q[2]}`+(parseFloat(q[2])?lvl((parseFloat(q[2].replace(',','.'))-4)/5*100,q[3]?'var(--dom)':'var(--faint)',8):''),right:st(q[3]?'mellette':'ellene')})).join('')+note('Őszinteség: ez együttjárás, nem bizonyított ok-okozat. A hiányzó napokon nem volt mindkét adat — azok nem számítanak sem mellette, sem ellene.'),{i:2,cls:'mz-wide'})}`)}
  const intro=[['szunya','Én az <b>éjszakáidra</b> figyelek majd. 🌙 Még semmit sem tudok rólad — pár naplózott alvás után jelentkezem az első észrevétellel. Addig is egy titok: már az is rengeteget elárul, hogy <b>mikor</b> fekszel le, nem csak az, hogy mennyit alszol.',1],['falat','Én a <b>tányérodat</b> nézem: mit eszel, mikor, és mit tesz ez a céljaiddal. 🍳 Az első naplózott étkezés után már mondok valamit — nem pontozni fogok, hanem észrevenni. A kedvenc kérdésem: <b>mi vált be?</b> Azt ugyanis érdemes megismételni.',0],['mocor','Én a <b>mozgásodra</b> és a terhelésedre figyelek — meg arra, hogy a naplózás ne maradjon el. 💪 Nem hajtalak, de észreveszem, és szólok, ha három nap ugyanaz megy: a tested a <b>változatosságból</b> épül, nem a megszokásból.',0],['deru','Én arra figyelek, <b>hogy vagy</b>. 🌤️ Ehhez a te szavad kell: egy-egy rövid esti bejelentkezés — cserébe én veszem észre, mi mozgatja a hangulatod, és szólok, mielőtt te is éreznéd. Az energiád történetét szerintem együtt fogjuk megfejteni.',0]];
function elsonap(){
  return P({title:'Üzenőfal',sub:'1. nap · bemutatkozunk',tab:'mai'},`
  ${hero({lbl:'Mezo · bemutatkozás',verdict:'Szia! Mi leszünk a te kis csapatod.',sub:'Öten vagyunk, és mostantól rád figyelünk. Csak az kerül a rólad szóló képbe, amiben egyetértünk.',body:forms(FIVE.map(id=>({id,p:id==='mezo'?12:4,l:'0 / 8 nap',alive:id==='mezo'})))+gcap('Öt üres edény: még semmit sem tudunk rólad — a naplóid töltik majd fel.'),acts:btn('Ismerd meg a csapatot',{go:'csapat'})})}
  ${sec(1,'1. nap · bemutatkozunk',2)}
  ${post('mezo','a csapat · bemutatkozás','Öten vagyunk, és mostantól rád figyelünk. 👋 Én fogom össze a többieket: hetente leülünk, megvitatjuk, mit láttunk, és <b>csak az kerül a rólad szóló képbe, amiben egyetértünk</b> — a Szkeptikusunk erre kínosan ügyel. Te pedig bármikor rákérdezhetsz bármire: <b>miből látszik?</b> 🔍','',2,['Új arc'])}
  ${intro.map(([id,t,b],i)=>post(id,`${AREA[id]} · bemutatkozás`,t,b?honest('0 / 8 nap',3,'ismerkedünk'):'',i+2)).join('')}
  ${sec(2,'2. nap · az első szavak',6)}
  ${post('falat','étkezés · este · az első naplózott étkezésed után','Megvolt az első közös vacsoránk! 🍳 Egy tányérból még nem olvasok — de azt már látom, hogy <b>este 8 után</b> ettél, és ezt megjegyeztem. Ha pár nap múlva mintát látok az időpontjaidban, szólok. Addig: minden tányér, amit felírsz, egy mondattal okosabbá tesz.',honest('1 / 8 nap',12,'ismerkedünk'),6)}
  ${post('mezo','a csapat · este · hogyan tanulunk','Egy kis házirend, hogy átlásd: 📔 amit mondunk, arra mindig rákoppinthatsz — <b>Miből látszik?</b> Ott vannak a napok, a források, minden. Amit pedig te mondasz nekünk („Ez talál” / „Nem így érzem”), abból mi tanulunk. Nincs kioktatás, nincs tananyag — <b>a fal magyarázza önmagát</b>.','',6)}
  ${sec(3,'4. nap · az első észrevétel',7)}
  ${post('szunya','alvás · reggel · első megfigyelés','Három éjszakád van a naplóban, és máris feltűnt valami: mindhárom este <b>23 után</b> feküdtél, de ma reggel — a legkorábbi kelés után — voltál a legfrissebb. 🌙 Ez még csak egy szál, de már húzom. Öt éjszaka múlva mondok róla többet.',honest('3 / 8 nap',37,'gyűlik'),7)}
  ${sec(4,'7. nap · az első kiadás',8)}
  ${post('mezo','a csapat · vasárnap este · az első konzíliumotok','Ma este leültünk először mind az öten. ✅ Két dolog már <b>gyűlik</b> (a lefekvés szála és a vacsoraidő figyelése), és egy kérésünk van: a Közérzethez kellenének az esti bejelentkezések. Mostantól minden este itt találsz minket — keveset írunk, de azt komolyan.',sum(['szunya','falat','deru'],'Így zajlik majd a konzílium','konzilium'),8,['Egy hét — és már van mit megbeszélnünk.',st('Első kiadás')])}`)}
  const used=[['send','Küldés','a válaszmező és a chat küldője'],['flask','Kísérlet','a próbák jele a falon és a tagok oldalán'],['orb','Előrejelzés','az előrejelzés-oldalak jele'],['spark','Megjegyeztem','a chat memória-jelzése'],['bulb','Megjegyezném','a kérdező memória-jelzés'],['people','Emlékszem','amit emberekről elővett'],['eraser','Elfelejtettem','a felejtés jelzése a chatben'],['lens','Figyeljük · keresés','minta-döntés, kereső'],['council','Konzílium','a jegyzőkönyv és a csapat beszélgetései'],['graph','Kapcsolatok','Kategóriák, a Rólad térképe'],['radar','Detektorok','a Gépterem katalógusa'],['eye','Megfigyelő','a coaching szabályai'],['card','A napi kártya','a coaching kártyája'],['whistle','Coaching','a coaching áttekintő'],['pencil','Átnevezés · Pontosítom','szerkesztő műveletek'],['layers','Memória · Összevontam','rétegek, összevonás'],['album','Emlékek','napok és fejezetek'],['brain','Tartós tudás','L3 réteg, Tudástár'],['signal','Nyers adat','L0 réteg, stressz-jelek'],['key','Kapcsoló','Hogyan működik? — mit csinál a kapcsoló'],['flag','Célok','Tudástár kategória'],['bell','Döntésre vár','Tudástár · Rólad mutató'],['cowave','Hatások','a Tudástár kirakata'],['pattern','Minta','Minták, Tudástár'],['history','Előzmények','futások, lezárt ügyek'],['note','Tény','Rólad · tényjelölt'],['journal','Életesemény','a krónika jele'],['shield','A te kezedben','jóváhagyás, őszinteség'],['compass','Diagnózis','Kérdezd a csapatot'],['gear','Gépterem','a motorháztető']];
function ikonok(){
  return P({title:'Új ikonok',sub:'Jóváhagyásra',back:'mai'},`
  ${hero({lbl:'Nincs új rajz',verdict:'Az öt testvérforma és a meglévő 3D készlet elég ehhez a területhez.',sub:'A korábbi figurákat ezen a területen is az öt forma váltja. A Szkeptikus üres, szürke kristály — nem posztol, csak kérdez.'})}
  ${sec(1,'A csapat · testvérformák',1)}
  ${card(forms([...FIVE.map(id=>({id,p:TEAM[id][4],l:AREA[id]})),{id:'szk',p:8,l:'kérdez',on:{toast:'A Szkeptikus nem posztol — a beszélgetésekben kérdez vissza'}}],{s:44,cls:'six'})+note('A forma maga az edény: a benne álló szint mindig azt mutatja, amit az adott oldal mér (mondanivaló, érettség, álláspont).'),{i:1})}
  ${sec(2,'Ikonok ezen a területen',2)}
  ${card(used.map(([n,t,d])=>row({icon:'t-'+n,title:t,sub:d})).join('')+note('Mind a meglévő 3D készletből való, eredeti színben — pótlás és új rajz nélkül.'),{i:2})}`)}

/* ═════════ RÓLAD ═════════ */
const INB=[
  {id:'m1',kind:'Összevonási javaslat',who:'mezo',when:'hétfő',ic:'layers',merge:1,src:['Késő esti evés után nehezebben alszol el.','Ha 21 óra után vacsorázol, rosszabbul alszol.'],b:'Késő esti evés után nálad gyakran nehezebb az elalvás.',sm:'A heti rendrakásnál feltűnt, hogy ez a kettő ugyanarról szól. Ha összevonom, a két régi mondat nem vész el: a Tényeknél visszakapcsolhatod.',txt:{keep:'Összevontam — a két régi mondat a Tényeknél visszakapcsolható',snooze:'Jövő hétfőn újra megkérdezem',no:'Külön maradnak — ezt a kettőt nem hozom fel újra'}},
  {id:'c1',kind:'Tényjelölt',who:'falat',when:'ma',ic:'note',b:'Edzés előtt 2-3 órával eszel a legszívesebben.',sm:'A beszélgetésből szűrtük ki — ha bekerül, az Étkezés ehhez igazítja az edzésnapi étkezéseidet.'},
  {id:'c3',kind:'Tényjelölt',who:'mocor',when:'tegnap',ic:'note',b:'A röplabdát heti egy alkalomra ritkítod — csak szombaton jársz.',sm:'A beszélgetésből szűrtük ki.',conflict:'Volleyball: kedd + csütörtök + szombat'},
  {id:'le1',kind:'Életesemény-jelölt',who:'mezo',when:'szept. 22.',ic:'journal',b:'Randizni kezdtél valakivel',sm:'A chatben említetted — ha bekerül, a csapat ehhez méri a következő heteidet. Ha még korai, nyugodtan mondd, hogy most ne.',life:1},
  {id:'se1',kind:'Évszak-jelölt',who:'mezo',when:'2026. IV. negyedév',ic:'calendar',b:'Őszi alapozás',sm:'A negyedéves visszatekintésből — a csapat ehhez az időszakhoz méri az edzéseidet.',life:1}];
const TXT={keep:'Bekerült a rólad szóló képbe — a forrásával együtt',snooze:'Most nem került be — kb. két hét múlva újra megkérdezzük',no:'Nem került be — nem kérdezzük újra'};
function inboxCard(x,i){const d=ST.rinb[x.id],cur=ST['rt_'+x.id]||x.b,T2=x.txt||TXT,q=x.life?cur:`„${cur}”`;
  const hd=`<div class="mz-lab"><span class="mz-by">${W(x.who,24)}${x.kind}</span><span>${nm(x.who)} hozta · ${x.when}</span></div>`;
  if(d==='keep')return card(hd+`<p class="mz-q">${q}</p>`+done(T2.keep+(x.life&&!x.kind.startsWith('Évszak')?' · 1 kapcsolattal':'')),{i});
  if(d==='snooze'||d==='no')return card(row({icon:d==='snooze'?'t-clock':'t-skip',title:x.merge?x.src.join(' · '):cur,sub:T2[d]}),{i,cls:'mz-dim'});
  const edit=ST.redit===x.id;
  const body=x.merge?x.src.map(t=>`<p class="mz-srcq">„${t}”</p>`).join('')+`<p class="mz-sub" style="margin-top:12px"><b>Egy mondatban</b></p><p class="mz-q" style="margin-top:2px">„${cur}”</p>${sub(x.sm)}`
    :`<p class="mz-q">${q}</p>${sub(x.sm)}${x.conflict?`<p class="mz-warn">Ellentmond ennek: »${x.conflict}«</p><div class="mz-v" style="margin-top:8px">${cm('A régit kikapcsolom','chk',ST.chk)}</div>`:''}`;
  const a=edit?`<div class="mz-ed">${x.life?`<input class="fh-in" value="${esc(cur)}" aria-label="Cím"><textarea class="fh-in" rows="2" aria-label="Összefoglaló">${x.sm}</textarea>`:`<textarea class="fh-in" rows="2" aria-label="A tény szövege">${cur}</textarea>`}${acts(mb(x.merge?'Így vond össze':'Így jegyezd meg','rsave:'+x.id,'sm')+ml('Mégse','redit:'))}</div>`
    :x.merge?`<div class="mz-v">${mb('Összevonom',`rdec:${x.id}:keep`,'sm')}${cm('Átírom','redit:'+x.id)}${cm('Később',`rdec:${x.id}:snooze`)}${cm('Maradjon külön',`rdec:${x.id}:no`)}</div>`
    :`<div class="mz-v">${mb('Igen, jegyezd meg',`rdec:${x.id}:keep`,'sm')}${cm('Pontosítom','redit:'+x.id)}${cm('Most ne',`rdec:${x.id}:snooze`)}${cm('Nem igaz',`rdec:${x.id}:no`)}</div>`;
  return card(hd+body+a,{i})}
const RFACTS=[['szunya','Hétvégén átlag 40 perccel később fekszel le','21× visszaigazolva · beszélgetésből'],['falat','Koffein 14:00 után már nem','23× visszaigazolva · beszélgetésből'],['mocor','Röplabda: kedd + csütörtök + szombat','18× visszaigazolva · beszélgetésből'],['mezo','Szereted érteni a javaslatok indoklását','tőled · kézzel vetted fel · aug. 20.']];
const lifers=()=>{const le=ST.rinb.le1==='keep'?[[ST.rt_le1||'Randizni kezdtél valakivel','most került be · tőled tudjuk','szept. 22.']]:[],se=ST.rinb.se1==='keep'?[[ST.rt_se1||'Őszi alapozás','évszak · most került be','2026. IV. n.év']]:[];
  return [...le,...se,['Új munkahely első hete','hétfőn kezdtél · a naplódból, te hagytad jóvá','aug. 21.'],['Nyári alapozás','lezárult évszak — a nyári hetek külön mércével számítanak','2026. III. n.év','dim']]};
const lifer=([b,sm,d,k])=>`<div class="mz-life"><u class="${k||''}"></u><span class="g"><strong>${b}</strong><small>${sm}</small></span><em>${d}</em></div>`;
const DSH=['Fiz','Edz','Tápl','Alv','Lel','Fegy','Élet','Önv','Cikl'];
const dimRack=(h,top,empty)=>rack(DIMS.map((d,i)=>({p:empty?3:d.m,dash:!!empty,c:MC(d.o||'mezo'),v:top&&!empty?d.m:undefined,l:DSH[i],top:top?W(d.o||'mezo',20):'',on:'dimenzio.'+d.key,aria:`${d.t} · ${d.m}% érettség`})),{h,cls:'tiny'});
function rolad(full,mode){
  const off=mode==='ki',none=mode==='ures',week=mode==='het';
  const ITEMS=none?[]:week?INB.filter(x=>!x.life):INB;
  const undecided=ITEMS.filter(x=>!ST.rinb[x.id]),open=undecided.length;
  const shown=ST.s6all||full?ITEMS:undecided.slice(0,2),rest=ITEMS.length-shown.length;
  const nf=15+INB.filter(x=>!x.life&&ST.rinb[x.id]==='keep').length;
  return P({title:'Rólad',sub:'Mezo · a közös kép rólad',tab:'rolad'},`
  ${week?card(row({icon:'t-calendar',title:'Heti áttekintés · szept. 15–21.',sub:'A héten felmerült javaslatok.',right:lk('Vissza ›',{toast:'Vissza ehhez a héthez — Én · Hét'})}),{i:0}):''}
  ${none?hero({lbl:'A csapat benyomása',verdict:'Még gyűjtjük, amit rólad tudni érdemes.',sub:'Az első kimondott benyomás ide kerül.',body:dimRack(54,false,true)+gcap('Kilenc témakör, kilenc még üres edény — a naplóid töltik fel.')}):hero({lbl:`<span class="mz-by">${W('szunya',26)}A csapat benyomása · a legbiztosabb állítás</span>`,verdict:'„Hétvégén rendszeresen később fekszel le — és a hétfői edzésed ezt meg is érzi.”',sub:'Így fogalmaz most rólad az <b>Alvás</b> · javítható benyomás, nem címke',
    body:dimRack(54)+gcap('A kép rólad kilenc témakörben — a szint: mennyire érett. Koppints egyre.'),
    acts:(ST.rq==='talal'?done('Megerősítetted — a benyomás erősödik').replace('class="mz-done"','class="mz-done" style="margin:0"'):mb('Talál','rq'))+btn('Pontosítom',{sheet:'reply'},'ghost')+lk('Miből látom?',{sheet:'mibol',arg:'Hétvégén rendszeresen később fekszel le'})})}
  ${sec(1,off||none?'Döntésre vár':`Döntésre vár · ${open?open+' jelölt':'mind eldöntve'}`,1)}
  ${off?card(row({icon:'t-info',title:'A társ jelenleg nincs bekapcsolva',sub:'A tényjavaslatok most nem elérhetők.'}),{i:1}):none?card(note('Nincs döntésre váró javaslat.').replace('margin-top:10px','margin:0'),{i:1}):shown.map((x,i)=>inboxCard(x,i+1)).join('')}
  ${rest>0||ST.s6all?card(fold('s6all',ST.s6all?'Mutass kevesebbet':`Még ${rest} javaslat · korábban eldöntöttek és további jelöltek`,ST.s6all,''),{i:3}):''}
  ${off||none?'':sec(2,'Amit a csapat megjegyzett · a Tudástárban',4)+card(grid([stat({k:'Tények rólad',icon:'t-person',n:'90',pct:92,s:'83 bekapcsolva · 7 elhallgattatva',on:'tenyek'}),stat({k:'Emberek',icon:'t-people',n:'70',pct:72,s:'18 ember · 3 elhallgattatva',on:'kind.6'}),
    stat({k:'Észrevételek',icon:'t-pattern',n:'30',pct:87,s:'26 még igaz · 1 felülírva',on:'mintak'}),stat({k:'Hatások',icon:'t-cowave',n:'12',pct:30,s:'7 ember · 4 esemény',on:{toast:'Hatások — a Tudástár hub lapja'}})]),{i:4})}
  ${off||none?'':sec(3,`A tények rólad · ${nf} aktív`,5)+card(RFACTS.map(([w,t,s])=>row({left:W(w,32),title:t,sub:s})).join('')+row({icon:'t-book',title:`Mind a ${nf} tény`,sub:'kereséssel, forrással és Elhallgattatom-kapcsolóval',on:'tenyek'}),{i:5})}
  ${none?'':sec(4,'Életesemények',6)+card(lifers().slice(0,full?9:2).map(lifer).join('')+acts(lk('Mind ›',{go:'eletesemenyek'})),{i:6})}
  ${sec(5,'Tovább',7)}
  ${card(row({icon:'t-person',title:'A csapat képe rólad, dimenziónként',sub:'9 témakör · mindegyik pontosítható',on:'dimenziok'})
    +row({icon:'t-chat',title:'Így beszélj velem',sub:'a saját kommunikációs kéréseid',on:{toast:'Így beszélj velem — a beállításokban (Én)'}})
    +row({icon:'t-graph',title:'Kapcsolatok',sub:'a tudásod térképe',on:'kategoriak'})
    +row({icon:'t-brain',title:'Tudástár',sub:'tények, kategóriák és a működése',on:'tudastar'})
    +row({icon:'t-shield',title:'A te kezedben',sub:'Minden, ami itt áll, forrással együtt él — bármit elhallgattathatsz vagy pontosíthatsz. A csapat csak azt használja, amit jóváhagytál.'}),{i:7})}`);
}
function eletesemenyek(){return P({title:'Életesemények',sub:'Rólad',back:'rolad'},`
  ${hero({lbl:'A nagy fordulatok',verdict:'Ezekhez igazodik a csapat.',sub:'A mércék és a javaslatok ezekhez képest értelmeződnek.'})}
  ${sec(1,'Időrendben',1)}
  ${card(strata(lifers().map(([b,sm,d,k])=>({l:b,s:sm,v:`<small>${d}</small>`,h:54})),{cap:'legfelül a legfrissebb · lent, ami már leülepedett'}).replace('margin-top:14px','margin-top:0')+note('Új életesemény javaslatként érkezik a Rólad oldalra — ott döntesz róla.'),{i:1})}`)}
const DIMS=[
  {key:'physical',o:'deru',t:'Fizikai',m:58,c:'A testzsírszázalék lassan csökken, miközben a testsúly stagnál — ez rekompozícióra utal.'},
  {key:'training',o:'mocor',t:'Edzés',m:64,c:'A RIR-becsléseid pontosak: a mondott tartalék jellemzően 1-en belül megjósolja a következő szettet.'},
  {key:'nutrition',o:'falat',t:'Táplálkozási',m:47,c:'Hétköznap a fehérje stabilan cél körüli, hétvégén rendszeresen alatta marad.'},
  {key:'recovery',o:'szunya',t:'Alvás & regeneráció',m:71,c:'A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.'},
  {key:'mind',o:'deru',t:'Lelki',m:39,c:'A hála-bejegyzéseid után jellemzően nyugodtabb napot írsz le.'},
  {key:'discipline',o:'mocor',t:'Fegyelem',m:66,c:'A kihagyott logolást jellemzően másnap reggelre pótolod.'},
  {key:'life',o:'mezo',t:'Élet & emberek',m:31,c:'Az új munkahely első hete óta később fekszel le.'},
  {key:'selfaudit',o:'szk',t:'A társ önvizsgálata',m:34,c:'A javasolt tényeimből az elmúlt 4 hétben 9-ből 6 maradt meg (2 finomítva), 3 esett ki — ez az én találati arányom, nem a te tulajdonságod.'},
  {key:'chapter',o:null,t:'Munka-stressz ciklus',m:21,c:'Sűrű munkahetek után jellemzően egyszerre csúszik a logolás és a lefekvés.'}];
function dimenziok(arg){if(arg==='ki')return P({title:'Amit eddig tudunk rólad',sub:'Karakter',back:'rolad'},hero({lbl:'Karakter',verdict:'A karakter-dosszié jelenleg nem elérhető.',sub:'Ez nem hiba, csak a funkció ki van kapcsolva.',body:dimRack(54,false,true)}));
  const top=[...DIMS].sort((a,b)=>b.m-a.m)[0],low=[...DIMS].sort((a,b)=>a.m-b.m)[0];
  return P({title:'Amit eddig tudunk rólad',sub:'Karakter · 9 témakör · mindegyik pontosítható',back:'rolad'},`
  ${hero({lbl:'Karakter',verdict:`A legtöbbet erről tudjuk: ${top.t.toLowerCase()}.`,sub:`${top.m}% érettség. A legkevesebbet erről: ${low.t.toLowerCase()} (${low.m}%).`,body:dimRack(104,true)+gcap('Kilenc kémcső, kilenc témakör — fölöttük, aki figyeli. A szint az érettség (%).'),acts:btn(top.t,{go:'dimenzio.'+top.key})})}
  ${sec(1,'A 9 témakör',1)}
  ${card(DIMS.map(d=>row({left:d.o?W(d.o,36):undefined,icon:d.o?undefined:'t-spark',title:d.t,sub:d.c+lvl(d.m,MC(d.o||'mezo'),8),v:d.m+'%',on:'dimenzio.'+d.key})).join(''),{i:1})}`)}
const CLAIMS=[['Biztos','A testzsírszázalék lassan csökken, miközben a testsúly stagnál — ez rekompozícióra utal.'],['Figyeljük','A gyógyszerciklus hetei egyelőre nem mutatnak kimutatható hatást a súlytrenden.'],['Valószínű','A reggeli mérések szórása alacsony — a mérési fegyelmed stabil alapot ad a trendnek.']];
function dimenzio(key){const d=DIMS.find(x=>x.key===key)||DIMS[0],id=d.o||'mezo';
  const who2=d.key==='chapter'?'közös AI-fejezet':d.key==='selfaudit'?'a társ önvizsgálata · Szkeptikus':`${nm(id)} figyeli`;
  return P({title:d.t,sub:`Dimenzió · ${who2}`,back:'dimenziok'},`
  ${hero({lbl:`${d.m}% érettség · ${who2}`,verdict:d.c,body:bigform(d.key==='selfaudit'?'szk':id,d.m,{s:112,cap:d.key==='chapter'?'Közös AI-fejezet — a csapat együtt tölti.':`Ennyire érett ez a témakör — ${d.key==='selfaudit'?'a Szkeptikus':nm(id)} tölti, hétről hétre.`}),acts:btn('Beszélgess erről Mezóval',{go:'chat'})})}
  ${sec(1,'Összkép',1)}
  ${card(d.o?say(id,'A testösszetételed lassan, de biztosan javul — a testzsír-trend nagyjából három hónap alatt csökken, miközben a testsúlyod közben gyakorlatilag helyben áll. Ez arra utal, hogy a hipertrófia-blokkok tényleg izmot építenek, nem csak számokat mozgatnak.',who2):row({icon:'t-spark',title:'Közös AI-fejezet',sub:'A testösszetételed lassan, de biztosan javul — a testzsír-trend nagyjából három hónap alatt csökken, miközben a testsúlyod közben gyakorlatilag helyben áll. Ez arra utal, hogy a hipertrófia-blokkok tényleg izmot építenek, nem csak számokat mozgatnak.'}),{i:1})}
  ${sec(2,'Állítások · 3',2)}
  ${CLAIMS.map(([cf,t],i)=>{const fb=ST.fb[i];return card(`${lab(cf,fb==='no'?st('nyugdíjazva'):'')}<p class="fh-txt">${t}</p>${fb==='no'?'':conf({Biztos:90,'Valószínű':64,'Figyeljük':34}[cf],'bizonyosság',cf.toLowerCase())}
    ${fb==='no'?quiet('skip','Nyugdíjazva — a csapat nem viszi tovább.'):fb==='yes'?done('Köszönöm — jegyzem.'):`<div class="mz-v">${cm('Talál',`mfb2:${i}:yes`)}${cm('Nem igaz',`mfb2:${i}:no`)}${cs('Pontosítom','reply')}${cs('Miből látom?','mibol',t)}${ct('Mi változott?','Mi változott? — a dialógus a megvalósításban él')}</div>`}`,{i:i+2,cls:fb==='no'?'mz-dim':''})}).join('')}
  ${card(note('Az állítások bizonyítékból születnek, sosem fordítva — és amit tévesnek mondasz, azt a csapat nem vitatja tovább.').replace('margin-top:10px','margin:0'),{i:5})}`)}

/* ═════════ TUDÁSTÁR ═════════ */
const CAT={train:['edzés','dumbbell'],fuel:['étkezés','bowl'],health:['egészség','heart'],life:['élet','sun']};
const FACTS=[['train','Pull Day-en a Chest Supported Row a key compound.','12× visszaigazolva · beszélgetésből'],['fuel','A késői étkezés és az alvásminőség együtt mozog.','8× visszaigazolva · mintából — „Késői étkezés ↔ rákövetkező alvásminőség”'],['health','A reggeli mérés 7:00 és 7:30 között történik.','6× visszaigazolva · beszélgetésből'],['life','Volleyball: kedd + csütörtök + szombat.','5× visszaigazolva · kézzel']];
const frow=(f,s,key)=>{const [l,i]=CAT[f[0]];const on=ST.toff&&ST.toff[key]?false:s!=='off',nx=parseInt(f[2])||0;return `<div class="fh-row ${on?'':'off'}"><span class="si">${I('t-'+i)}</span><span class="g"><strong>${f[1]}</strong><small>${l} · ${f[2]}</small><small>${on?(s==='wait'?'Bekapcsolva, de most kimarad':'Most benne van a chatben'):'Kikapcsolva — a társ nem látja'}</small>${lvl(Math.min(100,nx/12*100),on?'var(--dom)':'var(--faint)',7)}</span>${tgl(on,`toff:${key}`,f[1])}</div>`};
const S9M=[{id:'g1',cat:'fuel',t:'Az edzés előtti étkezés 2-3 órával előtte esik neked a legjobban.',into:'Edzés előtt 2-3 órával eszel a legszívesebben.',d:'szept. 29.'},{id:'g2',cat:'train',t:'A röplabda után másnap fáradtabbnak érzed a lábad.',into:'Hosszú röplabda után a következő napon gyakran nehezebb a lábad.',d:'szept. 29.'}];
function tudastar(){const n=INB.filter(x=>!ST.rinb[x.id]).length;
  return P({title:'Tudástár',sub:'Rólad',back:'rolad'},`
  ${hero({lbl:'Amit a társ megjegyzett',verdict:'15 tényt tudunk rólad — 10 megy a chatbe.',sub:'12 kapcsolat köti össze őket.',body:strata([{l:'A chatben',s:'a 10 legerősebb bekapcsolt tény — ezt kapja meg a társ',v:'10',on:'tenyek',h:58},{l:'Bekapcsolva, de most kimarad',s:'ha megerősödnek, feljönnek',v:'4',on:'tenyek'},{l:'Kikapcsolva',s:'megőrzöm, de a társ nem látja',v:'1',on:'tenyek',cls:'off'}],{cap:'15 tény · a felszínen, ami a beszélgetésekbe kerül'}),acts:btn('Tények',{go:'tenyek'})+lk('Hogyan működik? ›',{go:'hogyan'})})}
  ${sec(1,'Rád vár',1)}
  ${card(n?row({icon:'t-bell',title:`${n} javaslat vár rád a Rólad oldalon`,sub:'Ott döntesz róluk: Igen, jegyezd meg · Pontosítom · Most ne · Nem igaz',on:'rolad'}):row({icon:'t-tick',title:'Nincs döntésre váró javaslat',sub:'Ha a csapat újat hoz, a Rólad oldalon kérdez meg.'}),{i:1})}
  ${sec(2,'A tudás',2)}
  ${card(row({icon:'t-note',title:'Tények',sub:'10 a chatben · 4 vár · 1 kikapcsolva',v:'15',on:'tenyek'})+row({icon:'t-graph',title:'Kategóriák',sub:'Késői evés rontja az alvást · 12 él',v:'7',on:'kategoriak'}),{i:2})}`)}
function tenyek(){const nM=S9M.filter(m=>!ST.s9back[m.id]).length;
  return P({title:'Tények',sub:'Tudástár',back:'tudastar'},`
  ${hero({lbl:'Amit a társ megjegyzett',verdict:'15 tény rólad — 10 megy a chatbe.',sub:'12 kapcsolat. Minden tényt te kapcsolsz be vagy ki.',body:drops([...Array(10).fill({k:'full'}),...Array(4).fill({k:'half'}),{k:'gone'}].map(o=>({...o,s:20})),'teli: megy a chatbe · fél: vár · szaggatott: kikapcsolva'),acts:lk('Hogyan működik? ›',{go:'hogyan'})})}
  ${sec(1,'Keresés és rendrakás',1)}
  ${card(`<button class="mz-reply" style="margin-top:0" data-toast="Keresés a tények között">${bub('t-lens',{s:30})}<span>Keresés · pl. alvás, kávé, váll</span></button><div style="margin:12px 0">${pg([['m','Mind'],['e','Edzés'],['t','Étkezés'],['g','Egészség'],['l','Élet']],'m','tf')}</div>
    ${row({icon:'t-layers',title:'Hétfői rendrakás',sub:(nM?`${nM} ismétlést összevontam`:'mindent visszakapcsoltál')+', 1 javaslat vár rád a Rólad oldalon.',on:'rolad'})}`,{i:1})}
  ${sec(2,'Most ezeket kapja meg a társ · 10',2)}
  ${card(FACTS.map((f,i)=>frow(f,'in','f'+i)).join('')+note('Minden beszélgetés elején ezek a mondatok mennek elé: a 10 legerősebb bekapcsolt tény, plusz a frissen megerősített minták.'),{i:2})}
  ${sec(3,'A többi tény',3)}
  ${card(fold('wait','Bekapcsolva, de most kimarad · 4',ST.waitOpen,frow(['fuel','Hétvégén később kezdődik az első étkezés.','2× visszaigazolva · beszélgetésből'],'wait','w1')+frow(['train','A vállnyomásnál a bal oldal érzékenyebb.','1× visszaigazolva · beszélgetésből'],'wait','w2')+note('Ha megerősödnek, vagy egy erősebb tény kiesik, bekerülnek a chatbe.'))
    +fold('off','Kikapcsolva · 1',ST.offOpen,frow(['fuel','kifli.hu az elsődleges élelmiszer-forrás.','3× visszaigazolva · beszélgetésből'],'off','o1')+note('Megőrzöm őket, de a társ nem használja.'))
    +fold('s9','Összevontam · '+S9M.length,ST.s9open,S9M.map(m=>{const bk=ST.s9back[m.id];const [l,i]=CAT[m.cat];return `<div class="fh-row ${bk?'':'off'}"><span class="si">${I(bk?'t-'+i:'t-layers')}</span><span class="g"><strong>${m.t}</strong><small>${l} · beszélgetésből</small><small>${bk?'Újra külön — mindkettőt használom':`összevontam ezzel: „${m.into}”, ${m.d}`}</small><span class="mz-v" style="margin-top:8px">${cm(bk?'Mégis maradjon összevonva':'Visszakapcsolom','s9back:'+m.id)}</span></span></div>`}).join('')+note('Ezek ugyanazt mondták, mint egy másik tény, ezért a másikba olvasztottam őket — a szövegük nem változott, és semmi nem veszett el. Ha mégis külön kellenek, kapcsold vissza.')),{i:3})}`)}
const KINDS=[['Minták','pattern',3,'Késői evés rontja az alvást'],['Preferenciák','checkin',4,'Reggel edz a legszívesebben'],['Célok','flag',2,'Nyári alapozás'],['Életesemények','sun',1,'Új munkahely első hete'],['Szezonok','calendar',1,'Nyári alapozás'],['Belátások','bulb',0,'—'],['Emberek','people',2,'Anna']];
function kategoriak(){return P({title:'Kategóriák',sub:'Tudástár · ugyanennek a tudásnak a térképe',back:'tudastar'},`
  ${hero({lbl:'A tudásod térképe',verdict:'7 kategória, 12 kapcsolat.',sub:'A legtöbb a preferenciáid között van; belátás még nincs.',body:rack(KINDS.map((k,i)=>({p:k[2]/4*100,dash:!k[2],v:k[2],l:k[0].replace('Életesemények','Élet&shy;események').replace('Preferenciák','Prefe&shy;renciák'),top:bub('t-'+k[1],{s:32}),on:k[2]?'kind.'+i:{toast:k[0]+' — még nincs'}})),{h:50,cols:4,cls:'cat'})+gcap('Egy edény = egy kategória; a szint: hány elem van benne.')})}
  ${sec(1,'Kategóriák',1)}
  ${card(KINDS.map((k,i)=>k[2]?row({icon:'t-'+k[1],title:k[0],sub:k[3],v:k[2],on:'kind.'+i}):`<div class="fh-row off"><span class="si">${I('t-'+k[1])}</span><span class="g"><strong>${k[0]}</strong><small>még nincs</small></span><span class="v">0</span></div>`).join(''),{i:1})}`)}
function kind(i){const k=KINDS[+i||0];const L=[['Késői evés rontja az alvást','2 kapcsolat'],['Hétvégi fehérje-elmaradás','1 kapcsolat'],['Rövid alvás után kisebb volumen','']].slice(0,Math.max(1,k[2]));
  return P({title:k[0],sub:'Tudástár · kategória',back:'kategoriak'},`
  ${hero({lbl:'Kategória',verdict:`${k[2]} elem ebben a kategóriában.`,sub:`Például: ${k[3]}`,left:bub('t-'+k[1],{s:56}),body:drops(Array.from({length:Math.max(1,k[2])},()=>({k:'full',s:24})),`${k[2]} csepp a „${k[0]}” edényében`)})}
  ${sec(1,k[0],1)}
  ${card(L.map(q=>row({icon:'t-'+k[1],title:q[0],sub:q[1]||undefined,on:'node'})).join(''),{i:1})}`)}
const HOGYAN=[['book','Mi az a tény?','Egy rólad szóló mondat, amit a társ megjegyzett. Vagy a beszélgetéseitekből szűrte ki, vagy egy megerősített mintából tanulta, vagy te vetted fel kézzel.'],['key','Mit csinál a kapcsoló?','Bekapcsolva a tény versenyben van azért, hogy bekerüljön minden beszélgetés elé. Kikapcsolva a társ soha nem látja — sem a válaszaiban, sem a felismeréseiben.'],['repeat','Mit jelent a visszaigazolás?','Hányszor jött vissza ugyanez magától: vagy újra elmondtad a chatben, vagy a minta-motor újra kimérte. Minél többször, annál előrébb sorolódik.'],['layers','Miért marad ki néhány?','Csak a 10 legerősebb bekapcsolt tény fér be egy beszélgetésbe. A többi bekapcsolva marad és várakozik — ha megerősödik, bekerül. Kivétel: egy frissen megerősített minta-tényt az első 3 napban a rangsortól függetlenül is megkapja a társ.'],['bulb','Hol döntök a javaslatokról?','A Rólad oldalon. Amíg nem fogadod el őket, semmi nem történik velük — a társ nem használja őket. A „Most ne” két hét múlva újra előhozza, a „Nem igaz” végleg elengedi.'],['graph','Mik a kategóriák?','Ugyanennek a tudásnak a térképe: minták, preferenciák, célok, életesemények, szezonok, belátások, emberek — és a köztük futó kapcsolatok.']];
function hogyan(){return P({title:'Hogyan működik?',sub:'Tudástár',back:'tudastar'},`
  ${hero({lbl:'Hat rövid kérdés',verdict:'Koppints egy kérdésre, és egy lapon elolvasod a választ.',body:chain([{l:'tény rólad',s:'amit megjegyzett',v:'15',p:96},{l:'bekapcsolva',s:'te döntöd el',v:'14',p:84},{l:'a chatben',s:'a 10 legerősebb',v:'10',p:60}],[{w:11,cap:'kapcsoló'},{w:7,cap:'rangsor'}])+gcap('Így jut el egy tény a beszélgetésig: a kapcsolón és a rangsoron át.'),acts:btn('Kezdem az elsővel',{sheet:'hogyan',arg:'0'})})}
  ${sec(1,'Kérdések',1)}
  ${card(HOGYAN.map(([i,q],n)=>row({icon:'t-'+i,title:q,on:{sheet:'hogyan',arg:String(n)}})).join(''),{i:1})}`)}
function node(){return P({title:'Késői evés rontja az alvást',sub:'Minta · kapcsolat',back:'kategoriak'},`
  ${hero({lbl:'Minta',verdict:'A 21 óra utáni vacsora után a következő éjszaka rendre felszínesebb.',body:chain([{l:'Késői evés',s:'21 óra után',p:80},{l:'Rossz alvás',s:'a következő éjjel',p:64},{l:'Gyenge edzés',s:'másnap',p:40}],[{w:12,cap:'kiváltja',cap2:'erős'},{w:6,cap:'támogatja',cap2:'közepes'}])+gcap('A cső vastagsága a kapcsolat ereje.'),acts:btn('Archivál',{toast:'Archiválva'},'ghost')+lk('Tudástár · vissza a listához ›',{go:'kategoriak'})})}
  ${sec(1,'Kapcsolatok',1)}
  ${card(row({title:'Késői evés → kiváltja → Rossz alvás',right:st('erős','ok')})+row({title:'Rossz alvás → támogatja → Gyenge edzés',right:st('közepes')})+note('Archiválás után nem kerül a beszélgetésbe. A forrásadataid megmaradnak.'),{i:1})}`)}

/* ═════════ KONZÍLIUM ═════════ */
const THREADS=[
  {id:'t1',t:'Regeneráció',faces:['szunya','deru','mocor'],sub:'2 állítás · 3 hozzászólás',items:[['Bekerült','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.'],['Megerősítve','Hétfőn a pulzusvariancia rendszeresen gyengébb.']]},
  {id:'t2',t:'Táplálkozási',faces:['falat','szk'],sub:'1 állítás · nem vitatták',items:[['Elvetve','A hétvégi fehérje-elmaradás három hete következetes mintázat.']]},
  {id:'t3',t:'Fizikai',faces:['deru'],sub:'1 állítás · 1 elfogadva',items:[['Bekerült','A testzsír-trend és a stagnáló testsúly rekompozícióra utal.']]},
  {id:'t4',t:'Fegyelem',faces:['mocor'],sub:'1 állítás · 1 elfogadva',items:[['Nyugdíjazva','A hétvégi logolás rendszeresen elmarad.']]}];
function konzilium(arg){
  if(arg==='nincs')return P({title:'Az ülés jegyzőkönyve',sub:'A csapat · konzílium',back:'csapat'},hero({lbl:'Konzílium',verdict:'Egyelőre nincs konzílium.',sub:'A csapat hetente tanácskozik — ez az első hét még nem zajlott le.',body:forms(FIVE.map(id=>({id,p:4,l:'még vár'})))}));
  const nav=card(`<div class="mz-nav">${lk('‹ korábbi',{toast:'Korábbi tanácskozás'})}${lk('aug. 30. · heti ▾',{sheet:'archive'})}<span class="off">későbbi ›</span></div>${sg([['ov','Áttekintés'],['cv','Beszélgetés']],ST.konz,'konz').replace('class="fh-seg"','class="fh-seg" style="margin:0"')}`,{i:1});
  const hon=note('A fenti a valódi beszélgetés, ami lezajlott — a felület sosem dramatizálja utólag; amit itt olvasol, azt a csapat pontosan így mondta.');
  const top=hero({lbl:'Konzílium · augusztus 30. · heti',verdict:'2 állítás bekerült rólad, 1 nyugdíjba ment.',sub:'Hetente a szakértői csapat átnézi az adataidat, megvitatja egymás felvetéseit, a Szkeptikus kikérdezi őket, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.',body:forms([{id:'szunya',p:86,l:'felvetette'},{id:'deru',p:78,l:'támogatja'},{id:'mocor',p:22,l:'vitatja'},{id:'szk',p:62,l:'hagyta'},{id:'mezo',p:96,l:'bekerült',alive:1}],{s:52})+gcap('„A hétvégi lefekvés két órával kitolódik…” — a szint: ki mennyire áll az állítás mellett.')+lab('Mi változott a dossziédban').replace('class="mz-lab"','class="mz-lab" style="margin:16px 0 0"')+facts([['2','bekerült'],['1','nyugdíjazva'],['1','portré átírva']]),acts:btn('Mi változott rólad?',{go:'rolad'})});
  const o={title:'Az ülés jegyzőkönyve',sub:'A csapat · konzílium',back:'csapat'};
  if(ST.konz==='cv')return P(o,`${top}${nav}
  ${sec(1,'Javaslatok · 3 felvetés',2)}
  ${card(cmt('szunya','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.')+cmt('deru','A testzsír-trend és a stagnáló testsúly rekompozícióra utal.')+cmt('falat','A hétvégi fehérje-elmaradás három hete következetes mintázat.'),{i:2})}
  ${sec(2,'Kereszt-vita · 3 hozzászólás',3)}
  ${card(`<p class="mz-srcq" style="margin:0 0 14px">„A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.” — Alvás</p>`+cmt('deru','A pulzusvariancia is ezt a két napot mutatja gyengébbnek.','Támogatja').replace('class="mz-c"','class="mz-c" style="border-top:0;padding-top:0;margin-top:0"')+cmt('mocor','Szerintem ez nem alvás, hanem hétvégi program — nem viselkedési minta.','Vitatja')+cmt('deru','A kettő nem zárja ki egymást: a program tolja ki, a hatása viszont alvás.','Árnyalja'),{i:3})}
  ${sec(3,'Szkeptikus · 2 vizsgálat',4)}
  ${card(cmt('szk','Hat hét adat, konzisztens. A Mozgás ellenvetése nem cáfolja a mintát.','Meghagyta')+cmt('szk','Három hét túl kevés, és két hétvége nyaralás volt.','Kukázta'),{i:4})}
  ${sec(4,'Mezo dönt · 1 bekerült · 1 elvetve',5)}
  ${card(cmt('mezo','Bekerül a dossziéba — a Szkeptikus érvét fogadom el.','Bekerült · biztos')+cmt('mezo','Elvetem — a Szkeptikus kifogása megalapozott.','Elvetve')+hon,{i:5})}`);
  return P(o,`${top}${nav}
  ${sec(1,'Hogyan zajlott · 4 forduló',2)}
  ${card([['1','Javaslat','5 felvetés','Ki mit hozott az asztalra','Alvás 2 · Étkezés 1 · Közérzet 1 · Mozgás 1'],['2','Kereszt-vita','3 hozzászólás','Ahol egymás felvetéseit nézték','A Közérzet az Alvás mellé állt; a Mozgás vitatta'],['3','Szkeptikus','5 vizsgálat','A kételkedés köre','a fehérje-ügyet kevés napnak találta'],['4','Mezo dönt','3 elfogadva · 2 elvetve','Ami a képedbe került','a hétvégi lefekvés-minta + a rekompozíció']]
    .map(([n,s,m,b,sm])=>row({left:`<span class="mz-num">${n}</span>`,title:`${s} · ${m}`,sub:`${b} — ${sm}`})).join(''),{i:2})}
  ${sec(2,'A szálak · 4',3)}
  ${card(THREADS.map(t=>{const op=ST.th===t.id;return `<div class="fh-row" data-m="th:${t.id}" role="button" aria-expanded="${op}">${minis(t.faces)}<span class="g"><strong>${t.t}</strong><small>${t.sub}</small></span><span class="fh-lk">${op?'bezár':'megnyit'}</span></div>
    ${op?`<div class="mz-foldb">${t.id==='t1'?cmt('szunya','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.','Felvetette')+cmt('deru','A pulzusvariancia is ezt a két napot mutatja gyengébbnek.','Támogatja')+cmt('mocor','Szerintem ez nem alvás, hanem hétvégi program — nem viselkedési minta.','Vitatja')+cmt('szk','Hat hét adat, konzisztens.','Meghagyta · biztos')+cmt('mezo','Bekerül a dossziéba — a Szkeptikus érvét fogadom el.','Bekerült · biztos')+reply():t.items.map(it=>row({title:it[1],right:st(it[0])})).join('')}</div>`:''}`}).join('')+hon,{i:3})}`);
}

/* ═════════ GÉPTEREM ═════════ */
function gepterem(){return P({title:'Gépterem',sub:'A csapat · dev-ajtó, a motorháztető alatt',back:'csapat'},`
  ${hero({lbl:'A gépezet',verdict:'Legutóbb aug. 30-án futott: 3 megfigyelés, 2 szakértő hívva.',sub:'Források, memória és futások. Ez nem a fal része — ide akkor jössz, ha a gépezetre vagy kíváncsi. Minden, amit a csapat mond, innen ellenőrizhető.',body:flowG([{l:'Edzés · 53 nap',p:88},{l:'Alvás · 58 nap',p:97},{l:'Étkezés · 56 nap',p:93},{l:'Check-in · 7 nap',p:12,dash:1}],{l:'memória',v:'47',s:'/ 60 nap',p:78},[{l:'3 megfigyelés'},{l:'2 szakértő hívva'},{l:'esti kiadás',dash:1}])+gcap('A gépezet csőrajza: a naplóid → a 60 napos emlékezet → amit a csapat ebből kimond.'),acts:btn('Futások',{go:'futasok'})})}
  ${sec(1,'Mi fut a háttérben',1)}
  ${card([['history','Futások','e héten 7 futás · 11 megfigyelés','futasok'],['link','Adatforrások','a teljes tervezett korpusz','adatforrasok'],['journal','AI-napló','minden hívás tárolva','toast:AI-napló — admin felület'],['radar','Detektorok','az aktív katalógus','detektorok'],['layers','Memória','rétegek, eredet és költségek','memoria'],['eye','Megfigyelők','a coaching javaslatainak háttere','megfigyelo']].map(([i,b,sm,go])=>r({icon:i,title:b,sub:sm,on:ton(go)})).join(''),{i:1})}
  ${sec(2,'A régi eszköztár',2)}
  ${card(row({icon:'t-grid',title:'Összes funkció',sub:'a régi teljes menü — minden eszköz egy helyen',on:'osszes'})+note('Minden szakértő-hívás mentve, lépésenként (megfigyelés, javaslat, szkeptikus, döntés, portré). Semmi nem tűnik el.'),{i:2})}`)}
function osszes(){const G=[['Amit a motor lát',[['pattern','Minták','Amit újra és újra észreveszünk','mintak'],['orb','Előrejelzések','Mit vártunk, és mi történt?','elorejelzesek'],['diagnose','Diagnózis','Keressünk magyarázatot együtt','diagnozis'],['flask','Kísérletek','Kis változtatás, követhető eredmény','kiserletek']]],
    ['Rólad',[['calendar','Heti','Értékelés és a napjaid','toast:Heti — az Én területen'],['person','Karakter','Ahogyan a csapat lát téged','dimenziok'],['book','Tudástár','Tények, események, kapcsolatok','tudastar'],['album','Emlékek','Napló, memoár és visszakeresés','emlekek']]],
    ['A csapat',[['council','Konzílium','A csapat beszélgetései és következtetései','konzilium'],['whistle','Coaching','Miért ezt javasoltuk ma?','coaching'],['chat','Beszélgetés','Mezóval, szövegben és hanggal','chat'],['journal','Karakter-napló','A csapat megfigyelései időrendben','naplo'],['gear','Gépterem','Futások, adatforrások és memória','gepterem']]]];
  return P({title:'Összes funkció',sub:'A gépterem mellől',back:'gepterem'},`
  ${hero({lbl:'A régi teljes menü',verdict:'Minden ismerős eszközöd egy helyen, a saját nevén.',body:rack(G.map(([t,rows],g)=>({p:rows.length/5*100,v:rows.length,l:t,top:bub(['t-pattern','t-person','t-council'][g],{s:36})})),{h:46})+gcap('Három polc, tizenhárom eszköz.')})}
  ${G.map(([t,rows],g)=>sec(g+1,t,g+1)+card(rows.map(([i,b,sm,go])=>r({icon:i,title:b,sub:sm,on:ton(go)})).join(''),{i:g+1})).join('')}`)}
const RUNDAYS=[['H','aug. 24.',[['Konzílium','Heti','calendar','6 megfigyelés feldolgozva','heti'],['Éjszakai kör','Éjszakai','moon','2 megfigyelés · 2 szakértő hívva','ejsz']]],['K','aug. 25.',[['Éjszakai kör','Éjszakai','moon','csendes nap · 0 hívás','csendes']]],['Sze','aug. 26.',null],['Cs','aug. 27.',[['Éjszakai kör','Éjszakai','moon','2 megfigyelés · 2 szakértő hívva','ejsz']]],['P','aug. 28.',[['Éjszakai kör','Éjszakai · hiányos','moon','hiányos feldolgozás · 1 megfigyelés','ejsz'],['Esti kiadás','Kiadás','scroll','3 poszt','kiadas']]],['Szo','aug. 29.',[['Éjszakai kör','Éjszakai','moon','jelek korábban feldolgozva','csendes']]],['Ma','aug. 30.',[['Éjszakai kör','Éjszakai','moon','3 megfigyelés · 2 szakértő hívva','ejsz']]]];
/* a futás jellánca: közlekedőedények — amennyi az egyikből a másikba átfolyt */
const flow=cells=>chain(cells.map(([n,l])=>({v:n,l,p:+n?Math.min(96,26+(+n)*14):0,dash:!+n})),cells.slice(1).map(([n])=>({w:+n?7:4,dash:!+n})),{h:128});
function futasok(){const WK=['aug. 24. – aug. 30.','aug. 17. – aug. 23.','aug. 10. – aug. 16.','aug. 3. – aug. 9.','júl. 27. – aug. 2.'];
  return P({title:'Futások',sub:'Gépterem · a futások, hetekre bontva',back:'gepterem'},`
  ${hero({lbl:'Ez a hét · aug. 24. – aug. 30.',verdict:'7 futás, 11 megfigyelés ezen a héten.',sub:'Egy éjszakáról nincs adat, egy feldolgozás hiányos volt.',body:rack([['H',8,'heti'],['K',0,'csendes'],['Sze',null,''],['Cs',2,'ejsz'],['P',1,'ejsz'],['Szo',0,'csendes'],['Ma',3,'ejsz']].map(([d,n,to])=>({p:n?12+n*11:n===0?5:0,dash:n==null,c:d==='P'?'var(--warn)':'var(--dom)',v:n==null?'–':n,l:d,cls:d==='Ma'?'now':'',on:to?'futas.'+to:{toast:'Erről az éjszakáról nincs adat'}})),{h:74,cls:'days'})+gcap('A hét hét edénye: a szint a napi megfigyelések száma. Borostyán: hiányos feldolgozás · szaggatott: nincs adat.'),acts:btn('A legutóbbi futás',{go:'futas.ejsz'})})}
  ${card(`<div class="mz-nav" style="margin:0">${lk('‹ előző',{toast:'Előző hét'})}${ml(`${WK[0]} ▾`,'wk')}<span class="off">következő ›</span></div>${ST.wk?`<div style="margin-top:12px">${WK.map((w,i)=>`<div class="fh-row" data-m="wk" role="button"><span class="g"><strong>${w}</strong></span>${i?'':st('ez')}</div>`).join('')}</div>`:''}`,{i:1})}
  ${sec(1,'A hét napjai',2)}
  ${card(RUNDAYS.map(([dow,dt,rows])=>dayl(`${dow} · ${dt}`)+(rows?rows.map(([k,b,i,s,to])=>r({icon:i,title:k,sub:`${b} · ${s}`,on:'futas.'+to})).join(''):`<p class="mz-sub" style="margin:0">nincs adat erről az éjszakáról</p>`)).join(''),{i:2})}
  ${sec(2,'Ritkább futások',3)}
  ${card(row({icon:'t-calendar',title:'Havi mélyolvasás',sub:'aug. 1. · 23 állítás újramérlegelve',on:'futas.havi'})+row({icon:'t-sprout',title:'Bootstrap',sub:'júl. 15. · 9 kezdő állítás',on:'futas.havi'}),{i:3})}`)}
function futas(id){
  const ai=row({icon:'t-journal',title:'A futás nyers hívásai az AI-naplóban',on:{toast:'AI-napló — admin felület'}});
  const experts=(ids,l)=>ids.map(i=>row({left:W(i,32),title:nm(i),sub:l})).join('');
  const o=(t,s)=>({title:t,sub:s,back:'futasok'});
  if(id==='nincs')return P(o('Futás','Futások'),card(empty('t-history','Ez a futás nem található.',btn('Vissza a futásokhoz',{go:'futasok'},'sm ghost'))));
  if(id==='csendes')return P(o('Éjszakai kör','Futás · aug. 25. · csendes nap'),`
    ${hero({lbl:'Csendes éjszaka',verdict:'Egyetlen jel sem tüzelt, senkit sem hívtunk.',sub:'Nulla LLM-hívás, nulla token, nulla költség. Ez nem hiányos futás — ez a rendszer pontosan azt csinálta, amit kell: nem talált ki jelet, ahol nem volt.',body:flow([['0','detektor tüzelt'],['0','hívás'],['0','megfigyelés']])})}
    ${sec(1,'Hívott szakértők',1)}
    ${card(txt('A többi szakértő ma nem kapott hívást — az ő jeleik a heti konzíliumon érkeznek.')+ai,{i:1})}`);
  if(id==='heti'||id==='havi'||id==='kiadas'){const X={heti:['Futás · aug. 24.','Konzílium','A hét 6 megfigyelését dolgoztuk fel a konzíliumon.',[['6','megfigyelés']],['szunya','deru','falat','mocor','szk'],'javaslat / döntés'],havi:['Futás · aug. 1.','Havi mélyolvasás','Havonta egyszer az egész eddigi képet újranézzük — ezúttal 23 állítást mérlegeltünk újra.',[['23','állítás újramérlegelve']],['mezo','szk'],'áttekintés'],kiadas:['Futás · aug. 28.','Esti kiadás','A mai esti kiadásba 3 poszt került.',[['3','poszt']],['falat','deru'],'poszt']}[id];
    return P(o(X[1],X[0]),`
    ${hero({lbl:X[0],verdict:X[2],body:flow([...X[3],[String(X[4].length),id==='kiadas'?'terület posztolt':'szakértő hívva']]),acts:id==='heti'?btn('Teljes jegyzőkönyv',{go:'konzilium'}):''})}
    ${sec(1,id==='kiadas'?'Posztoló területek':'Hívott szakértők',1)}
    ${card(experts(X[4],X[5])+ai,{i:1})}`)}
  const S=[['checkin-gap','2 egymást követő napon elmaradt a délutáni check-in','mocor','A kihagyások ritkák nálad — ezen a héten kétszer maradt el a délutáni check-in, érdemes visszaállni a ritmusba.'],['rir-calibration','Szettpárokon: a mondott RIR 1-en belül megjósolta a következő szettet','mocor','A tegnapi teremedzésen minden RIR-cél 1-en belül teljesült — a becsléseidre lehet építeni.'],['sleep-performance-chain','Rövid alvás után kisebb volumen a teremben','szunya','Hat óra alatti éjszaka után a volumened rendre visszaesik — ez a heti konzíliumra megy.']];
  return P(o('Éjszakai kör','Futás · aug. 30.'),`
  ${hero({lbl:'A szombati napod',verdict:'3 detektor tüzelt, ebből 3 megfigyelés készült.',sub:'A Mozgást és az Alvást hívtuk.',body:flow([['3','detektor tüzelt'],['2','hívás'],['3','megfigyelés']])})}
  ${sec(1,'A jellánc · egy kártya = egy megfigyelés',1)}
  ${S.map(([k,code,id2,t],i)=>card(`${lab(`<span class="mz-by">${drop({k:'full',s:20,in:i+1})}${k}</span>`,'a detektor jele')}<p class="mz-sub" style="margin:0 0 4px">${code}</p><p class="mz-arrow" aria-hidden="true">↓ ebből lett</p>${say(id2,t)}`,{i:i+1})).join('')}
  ${sec(2,'Hívott szakértők',4)}
  ${card(experts(['mocor','szunya'],'megfigyelés')+sub('A többi szakértő ma nem kapott hívást — az ő jeleik a heti konzíliumon érkeznek.')+`<div style="margin-top:12px">${ai}</div>`,{i:4})}`);
}
const READS=[['Éjszakai kör','14 nap'],['Vasárnapi konzílium','1 hét'],['Havi mélyolvasás','30 nap'],['Bootstrap','60 összegző · 60 minta · 40 tény · 60 review · 60 napló · 40 esemény'],['Gym szettek + feedback (RIR, target, ízület)','14 nap'],['Sport-sessionök','14 nap'],['Alvás (időtartam, minőség)','14 nap'],['Kiegészítő-stack (aktív protokoll + bevitelek)','8 hét · aktív protokoll'],['Étkezés-napok, makró-célok','14 nap'],['Check-in skálák','14 nap']];
function adatforrasok(){return P({title:'Adatforrások',sub:'Gépterem · mit olvas a rendszer ma, és mit tervez',back:'gepterem'},`
  ${hero({lbl:'A motor bemenete',verdict:'29 forrás bekötve, mind a négy kör él.',sub:'Edzés, alvás, étkezés, check-in — és még 19 másik forrás.',body:flowG([{l:'Edzés',p:100},{l:'Alvás',p:100},{l:'Étkezés',p:100},{l:'Check-in',p:100}],{l:'bekötve',v:'29',s:'forrás',p:88},[{l:'Éjszakai · 14 nap'},{l:'Konzílium · 1 hét'},{l:'Havi · 30 nap'}])+gcap('Négy kör tölti a tartályt; a három olvasó más-más mélységig merít belőle.')})}
  ${sec(1,'Források',1)}
  ${card(sg([['be','Bekötve'],['terv','Tervezett']],ST.src,'src')+(ST.src==='be'?READS.map(([w,c])=>{const m=/^(\d+) (nap|hét)/.exec(c),dd=m?(+m[1])*(m[2]==='hét'?7:1):60;return row({icon:'t-tick',title:w,sub:c+lvl(dd/60*100,'var(--dom)',7)})}).join('')+note('A sáv: milyen mélyre nyúl vissza az olvasás a 60 napos ablakban.')+note('+ még 19 bekötött forrás (étkezés, víz, gyógyszerciklus, napló, emberek, chat…)'):row({icon:'t-tick',title:'Mind a négy kör bekötve.'})+note('+ még 4 terület később')),{i:1})}`)}
function kor(){return P({title:'Egy kör',sub:'Adatforrások',back:'adatforrasok'},card(empty('t-link','Ez a kör nem található. Ma ez az egyetlen élő állapota: mind a négy kör bekötve, ide nem vezet link.',btn('Vissza az adatforrásokhoz',{go:'adatforrasok'},'sm ghost'))))}
const DET=[['logging-gap','mocor','N napja nincs étkezés logolva (2+ egymást követő nap, 14 napos honest cap) — hiányzó kaja-napló jelzés.'],['rir-calibration','mocor','Szettpárokon nézi: a mondott RIR megjósolja-e a következő szettet — az irányt is jelzi.'],['sleep-performance-chain','szunya','Rossz alvás utáni napokon visszaesik-e az edzés-teljesítmény.'],['weekend-protein-dip','falat','Hétvégén a fehérje rendszeresen a cél alá esik-e.'],['weight-trend-break','deru','A 7 napos súlytrend iránya megfordult-e.'],['mood-journal-tone','deru','A napló hangneme 3 napja tartósan lefelé tart-e.'],['life-event-shift','mezo','Egy új életesemény óta eltolódott-e a napi ritmus.'],['knowledge-rejection-pattern','szk','A javasolt tények és minták mekkora része maradt meg — a rendszer találati aránya, nem a te tulajdonságod. ÉRZÉKENY.']];
function detektorok(){return P({title:'Detektorok',sub:'Gépterem · a ma aktív katalógus, egy mondatban',back:'gepterem'},`
  ${hero({lbl:'Az aktív katalógus',verdict:'47 detektor figyel — egyik sem ítél, csak jelez.',sub:'A kód csak észlel; az értelmezés mindig az adott szakértő dolga.',body:drops([...DET.map(([k,id])=>({k:'full',c:MC(id),s:16,t:k})),...Array.from({length:39},()=>({k:'empty',c:'var(--faint)',s:16}))],'')+gcap('47 csepp = 47 detektor. A nyolc színes az, amelyiket lent egy mondatban is látod — a gazdája színében.')})}
  ${sec(1,'Detektorok · 8 a 47-ből',1)}
  ${card(DET.map(([k,id,t])=>row({left:W(id,32),title:t,sub:`<span class="mz-code">${k} · ${nm(id)}</span>`})).join('')+note('+ még 39 detektor ugyanígy, egy mondatban (47 aktív).'),{i:1})}`)}

/* ═════════ MEMÓRIA ═════════ */
const DAYS=[['2026-08-12','12','aug','Erős pull-nap volt: a Chest Supported Row 3×8-ra ment, és délután is maradt energia. Este korán feküdtél, 7 óra 40 perc lett belőle, a reggeli pulzus is lejjebb ment.'],['2026-08-11','11','aug','Pihenőnap, sok séta. Ebédnél kimaradt a fehérje, este pótoltad. A napló szerint feszült voltál a munka miatt, de a lefekvés így is 23:00 előtt volt.'],['2026-08-10','10','aug','Röpi este, három szett, a harmadikban elfogyott a lendület. Utána későn vacsoráztál, az alvás felszínes lett.']];
const SIM=[['2026-08-09',88,'Rossz alvás a késő esti edzés után; másnap nehezebben indult a nap.'],['2026-07-28',79,'Rövid éjszaka röpi után, reggel fáradtság, délutánra rendbe jött.'],['2026-07-14',71,'Hosszú edzés, késői vacsora, két ébredés.']];
const search=()=>`<button class="mz-reply" style="margin-top:0" data-m="srch">${bub('t-lens',{s:30})}<span ${ST.srch==='on'?'style="color:var(--ink)"':''}>${ST.srch==='on'?'rossz alvás edzés után':'Milyen napot keresel? (pl. rossz alvás edzés után)'}</span><b>Keresés</b></button>`+
  (ST.srch==='on'?`<p class="mz-day" style="margin-top:14px">3 hasonló nap a memóriából</p>${SIM.map((s,i)=>row({title:`${s[0]} · ${[47,59,73][i]} napja`,sub:s[2]+lvl(s[1],'var(--dom)',7),v:s[1]+'%',on:'emlek'})).join('')+note('A szám és a szint: mennyire hasonlít az a nap a keresésedre.')}`:'');
function memoria(){const tab=ST.mem;let body='';
  const layer=(i,eb,t,n,u,chips,go)=>row({icon:'t-'+i,title:t,sub:eb+(chips?' · '+chips.join(' · '):''),v:`${n}<small>${u}</small>`,on:ton(go)});
  const fl=t=>`<p class="mz-sub" style="margin:0 0 0 50px;padding:6px 0">↓ ${t}</p>`;
  if(tab==='retegek')body=layer('signal','L0 · nyers adat','Minden, amit rögzítesz','47','/60 nap')+fl('napi összefoglaló · minden nap 02:20')+layer('journal','L1 · epizodikus napló','Napi emlékek','38','nap',['112 chat-vektor','2026-07-01 – 2026-08-12'],'toast:Napló fül')+fl('mintakeresés · hetente')+layer('pattern','L2 · ítélet-inbox','Minták, amikről te döntesz','6','minta',['3 statisztikai · megerősített','2 függő tényjelölt'],'rolad')+fl('megerősítés után')+layer('brain','L3 · tartós tudás','Amit biztosan tudok rólad','15','tény',['168× megerősítés','14 a promptban'],'tudastar')
    +row({icon:'t-lens',title:'Miért nem lát még mintát a motor?',sub:'a minták oldalán',on:'mintak'});
  if(tab==='naplo')body=lab('augusztus 2026','38 nap')+DAYS.map((d,i)=>step({time:`${d[1]} ${d[2]}`,title:['augusztus 12., kedd','augusztus 11., hétfő','augusztus 10., vasárnap'][i],sub:d[3],right:st(i===2?'még nincs vektor':'kereshető')})).join('');
  if(tab==='kereso')body=search();
  if(tab==='audit')body=lab('LLM-használat · 30 nap','bemenet · kimenet')+big('$0,042','ennyibe került az emlékezet')+`<div class="mz-wk2" aria-hidden="true">${[40,62,35,80,55,48,90,30,66,72,44,58,38,84].map(h=>`<span><i style="--h:${h}%"></i><i class="o" style="--h:${Math.round(h*.35)}%"></i></span>`).join('')}</div><p class="mz-leg"><span><i></i>bemenet</span><span><i class="o"></i>kimenet</span></p>`
    +`<div style="margin-top:12px">${row({title:'214 hívás',sub:'bemenet 41,2k · kimenet 9,8k'})}${row({icon:'t-brain',title:'Tudástár',sub:'tények és eredetük',on:'tudastar'})}</div>`;
  return P({title:'Memória',sub:'Gépterem · rétegek, eredet és költségek',back:'gepterem'},`
  ${hero({lbl:'A minta-ablak',verdict:'60 napból 47 mért nap van az emlékezetben.',sub:'Lentről fölfelé tisztul: a nyers adatból napló, a naplóból minta, a mintából tartós tudás lesz.',body:strata([{l:'L3 · tartós tudás',s:'amit biztosan tudok rólad',v:'15<small>tény</small>',on:'tudastar'},{l:'L2 · ítélet-inbox',s:'minták, amikről te döntesz',v:'6<small>minta</small>',on:'rolad'},{l:'L1 · epizodikus napló',s:'napi emlékek · 112 chat-vektor',v:'38<small>nap</small>',on:'m:mem:naplo'},{l:'L0 · nyers adat',s:'minden, amit rögzítesz',v:'47<small>/60 nap</small>',h:58}],{cap:'a tartály rétegei'})})}
  ${sec(1,{retegek:'Rétegek · a nyers adattól a tudásig',naplo:'Napló',kereso:'Kereső',audit:'Audit'}[tab],1)}
  ${card(sg([['retegek','Rétegek'],['naplo','Napló'],['kereso','Kereső'],['audit','Audit']],tab,'mem')+body,{i:1,cls:tab==='naplo'?'mz-wide':''})}`);
}

/* ═════════ MINTÁK · mélyoldalak ═════════ */
const liter=v=>v.toFixed(1).replace('.',',')+' l',dec1=v=>v.toFixed(1).replace('.',','),clock=h=>{const t=Math.round(h*60),H=Math.floor(t/60)%24,Mi=t%60;return `${String(H).padStart(2,'0')}:${String(Mi).padStart(2,'0')}`};
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),h=s.length>>1;return s.length%2?s[h]:(s[h-1]+s[h])/2};
const DOMI={fuel:'plate',mind:'journal',train:'dumbbell',sleep:'moon',body:'person',other:'heart'};
const KINDL={binary:'napi jel · 0 / 1',clock_hour:'napi időpont',number:'napi érték'};
const PILL={monitoring:['Figyelem','plan'],proposed:['Gyűlik','q'],confirmed:['Beépült','q'],refuted:['Elengedve','q'],dormant:['Pihen','q'],rejected:['Elvetve','q']};
const HET=(()=>{const wk=[65,50,80,70,55,62,90,68,45,75,65,58,100,64,72,60,85,40],we=[100,125,95,104,150,105,90,130],Mo=['jan.','febr.','márc.','ápr.','máj.','jún.','júl.','aug.','szept.','okt.','nov.','dec.'];const out=[];let a=0,b=0;for(let i=0;i<26;i++){const d=new Date(2026,7,29+i),w=d.getDay()===0||d.getDay()===6;out.push([`${Mo[d.getMonth()]} ${d.getDate()}.`,w?1:0,22+(w?we[b++]:wk[a++])/60])}return out})();
const MINTA={
  viz:{title:'Vízbevitel ↔ energia-szint',q:'Több energiád van, ha többet iszol',cat:'Fiziológia · közérzet',st:'proposed',minN:8,lag:0,dir:'positive',win:14,A:{l:'Napi vízbevitel',k:'number',d:'fuel',src:'Víz-számláló'},B:{l:'Energia-szint',k:'number',d:'mind',src:'Check-in'},belief:58,hits:0,miss:0,r:'0,41',p:'0,31',last:'ma 03:10',trend:true,fx:liter,fy:v=>String(v),xa:[1,3,[1,1.5,2,2.5,3]],ya:[3,9,[3,5,7,9]],
    days:[['szept. 13.',1.4,5],['szept. 14.',2.1,6],['szept. 16.',1.8,6],['szept. 17.',2.6,8],['szept. 18.',1.2,4],['szept. 20.',2.3,7],['szept. 21.',1.6,6],['szept. 22.',2.4,7]],
    log:[['Szept. 13. · 21:40','észrevétel','Feltűnt: a többet ivós napjaidon magasabb volt az esti energia-jelentésed.'],['Szept. 14. · 08:10','te','„Lehet, hogy edzésnapon amúgy is többet iszom.”',1],['Szept. 14. · 08:40','átfogalmazva','Ha a napi vízbevitel magasabb, aznap magasabb az energia-szinted — az edzésnapokat külön jelölöm.'],['Szept. 21. · 03:10','bizonyíték','Kevés nap · 7 éjszaka'],['Szept. 23. · 03:10','számítás','Először számolhatóvá vált — 8 közös nap.']]},
  egyhangu:{title:'Egyforma terhelés ↔ reggeli energia',q:'Laposabb vagy, ha három napig ugyanaz a terhelés',cat:'Edzés · közérzet',st:'proposed',minN:8,lag:1,dir:'negative',win:21,A:{l:'3 egyforma terhelésű nap',k:'binary',d:'train',src:'Edzésnapló'},B:{l:'Reggeli energia',k:'number',d:'mind',src:'Check-in'},belief:null,hits:0,miss:0,r:'—',p:'—',last:'ma 03:10',binary:true,g:['Vegyes terhelés után','3 egyforma nap után'],fy:v=>String(v),ya:[3,9,[3,5,7,9]],
    days:[['szept. 10.',0,7],['szept. 13.',1,5],['szept. 16.',0,6],['szept. 19.',1,4],['szept. 22.',1,5]],
    log:[['Szept. 15. · 21:05','észrevétel','Feltűnt: három egyforma terhelésű nap után laposabb a reggeli energiád.'],['Szept. 16. · 09:20','átfogalmazva','Ha 3 napig ugyanaz a terhelés, a 4. reggelen alacsonyabb az energia-szint.'],['Szept. 23. · 03:10','bizonyíték','Kevés nap · 7 éjszaka']]},
  vacsora:{title:'Vacsora ideje ↔ alvásminőség',q:'Rosszabbul alszol, ha későn vacsorázol',cat:'Étkezés · alvás',st:'monitoring',minN:6,lag:1,dir:'negative',win:21,A:{l:'Utolsó étkezés ideje',k:'clock_hour',d:'fuel',src:'Étkezésnapló'},B:{l:'Alvásminőség',k:'number',d:'sleep',src:'Alvás-napló'},belief:72,hits:7,miss:2,r:'−0,58',p:'0,03',last:'ma 03:10',trend:true,fx:clock,fy:v=>dec1(v),xa:[18,23,[18,19,20,21,22,23]],ya:[5,8,[5,6,7,8]],
    days:[['szept. 8.',20+10/60,6.1],['szept. 9.',18+35/60,7.8],['szept. 10.',21+5/60,5.9],['szept. 11.',19+20/60,7.1],['szept. 13.',22,5.4],['szept. 14.',18+50/60,7.6],['szept. 15.',19+5/60,6.2],['szept. 16.',21.5,5.8],['szept. 18.',18+20/60,7.9],['szept. 19.',20.75,6.4],['szept. 20.',22.25,5.6],['szept. 21.',19,7.4],['szept. 22.',20.5,6.0],['szept. 23.',21+10/60,5.7]],
    log:[['Szept. 9. · 21:40','észrevétel','Feltűnt: a késői vacsorák utáni éjszakákon rosszabb az alvásod.'],['Szept. 10. · 07:55','te','„Szerintem inkább a hosszú munkanapok miatt eszem későn.”',1],['Szept. 10. · 08:30','átfogalmazva','Ha az utolsó étkezés 21 óra utánra csúszik, másnap alacsonyabb az alvásminőség — a munkanap hosszát külön figyelem.'],['Szept. 14. · 03:10','bizonyíték','Bejött · 6 nap'],['Szept. 16. · 03:10','bizonyíték','Nem jött be · 8 nap'],['Szept. 20. · 03:10','bizonyíték','Bejött · 11 nap'],['Szept. 21. · 19:56','döntés','Megfigyelésre tetted.'],['Szept. 23. · 03:10','bizonyíték','Bejött · 14 nap']]}
};
const labAnswer=(s,minN,n,h,m)=>s==='confirmed'?'Beépült.':n<minN?'Ígéretes, de még gyűlik.':h+m<minN?'Ígéretes — elég nap van a döntéshez.':m>h?'Nem igazolódik.':h>=3*m?'Tartja magát.':'Vegyes kép — még figyelem.';
const pg=(opts,cur,key)=>`<div class="fh-pills" role="group">${opts.map(([k,l])=>`<button class="fh-pill ${cur===k?'on':''}" data-m="${key}:${k}" aria-pressed="${cur===k}">${l}</button>`).join('')}</div>`;
const decTrio=key=>`<div class="mz-v">${mb('Megerősítem',`pdec:${key}:megerositve`,'sm')}${cm('Figyeljük',`pdec:${key}:figyeljuk`)}${cm('Elvetem',`pdec:${key}:elvetve`)}</div>${note('<b>Megerősítem</b> — beépül a rólad szóló képbe · <b>Figyeljük</b> — tovább számolom, de nem tanulok belőle · <b>Elvetem</b> — befagy, többé nem hozom elő.')}`;
const evlog=rows=>rows.length?rows.map(([s,l,x,you])=>step({time:s.replace(' · ','<br>'),title:you?`<i>${x}</i>`:x,sub:l||undefined})).join(''):note('Még nincs bejegyzés — az első bizonyíték-éjszaka tölti fel.');
const daysCard=(m,noChart)=>{const d=m.days,n=d.length;return `${noChart?'':n<2?note('Még nincs elég nap az összevetéshez — ahogy gyűlnek, itt jelennek meg.'):(m.binary?scbin(m)+note('A szint a csoport középső értéke; a buborékok a napok.'):scat(m)+note('Minden pont egy nap, a kiemelt a legutóbbi. A felszín a trend; a pontok a napok.'))}
  ${n?`<div style="margin-top:12px">${fold('dlist','Napok listája · '+n,isOpen('dlist'),d.map(x=>step({time:x[0],title:`${m.A.l}: ${m.binary?(x[1]?'igen':'nem'):m.fx(x[1])}`,sub:`${m.B.l}: ${m.fy(x[2])}`})).join(''))}</div>`:''}`};
const diagF=o=>fold('diag','Hogyan számoltuk? · ablak, források, technikai adatok',isOpen('diag'),grid([['Adatablak',o.win+' nap'],['Párosított nap',o.n],['Csoportarány',o.grp],['Utolsó számítás',o.last]].map(([l,v])=>stat({k:l,n:v})))
  +sub(`${o.sa} · ${o.sb} · ${o.lag?o.lag+' nappal később':'azonos nap'}`)+`<p class="mz-code" style="margin-top:6px">korreláció ${o.r} · közös nap ${o.n} · p-érték ${o.p}${o.frozen?' · a számok a döntésed pillanatában befagytak':''}</p>`);
function mintaLab(key,m,over){
  const OV={megerositve:'confirmed',figyeljuk:'monitoring',elvetve:'rejected'};const s=OV[over]||m.st;const n=m.days.length,enough=n>=m.minN,[pl,pk]=s==='proposed'&&enough?['Dönthetsz','warn']:PILL[s];
  const n0=m.days.filter(d=>d[1]<.5).length,n1=n-n0,decidable=s!=='confirmed'&&s!=='rejected';
  const log=[...m.log];if(OV[over]){log.push(['Szept. 24. · 09:12','döntés',{confirmed:'<b>Megerősítetted.</b>',monitoring:'Megfigyelésre tetted.',rejected:'Elvetetted — befagyasztva.'}[s]]);if(s==='confirmed')log.push(['Szept. 24. · 09:12','tudás','Bekerült a tudástárba.'])}
  const sb=(m.binary?`<b>${n1}</b> ilyen napot tudok összevetni <b>${n0}</b> másikkal`:`<b>${n}</b> napot tudok összevetni`)+(enough?' — elég ahhoz, hogy dönts.':`. <b>${m.minN}</b> napnál mondok többet.`);
  return P({title:m.title,sub:`Minta · ${m.cat}`,back:'mintak'},`
  ${hero({warn:pk==='warn',lbl:pl,verdict:labAnswer(s,m.minN,n,m.hits,m.miss),sub:`Hipotézis: ${m.q}? ${sb}`,body:(()=>{const rr=Math.abs(parseFloat(String(m.r).replace(',','.').replace('−','-')))||0,weak=!enough||!rr||s==='proposed';return chain([{l:m.A.l,s:'ha ez…',v:m.binary?'igen':'több',p:76,c:'var(--faint)'},{l:m.B.l,s:'…akkor ez',v:m.dir==='positive'?'több':'kevesebb',p:m.dir==='positive'?76:34}],[{w:rr?4+rr*14:5,dash:weak,cap:rr>=.5?'erős kapcsolat':rr>=.3?'közepes kapcsolat':rr?'gyenge kapcsolat':'még nem mérhető',cap2:`${n} közös nap`}])})()+gcap('Közlekedőedények: a cső vastagsága a kapcsolat ereje; szaggatott, amíg nem mondjuk ki.')+(m.belief!=null?conf(m.belief,'bizonyosság')+note('A bizonyosságot a <b>számítás</b> és a <b>te válaszaid</b> mozgatják. Mezo csak megfogalmazza. Te bármikor felülírhatod.'):'')+(decidable?decTrio(key):'')})}
  ${sec(1,'A teszt-terv · előre rögzítve',1)}
  ${card(r({icon:DOMI[m.A.d],title:m.A.l,sub:`Ha… · ${KINDL[m.A.k]}`})+r({icon:DOMI[m.B.d],title:m.B.l,sub:`…akkor · ${KINDL[m.B.k]}`})
    +grid([stat({k:'Eltolás',n:'+'+m.lag,unit:'nap'}),stat({k:'Minimum',n:m.minN,unit:'nap kell'}),stat({k:'Várt irány',n:`<span style="font-size:21px">${m.dir==='positive'?'több':'kevesebb'}</span>`}),stat({k:'Ablak',n:m.win,unit:'nap'})]).replace('class="fh-grid"','class="fh-grid" style="margin-top:14px"')+lab(`Gyűlő napok · ${Math.min(n,m.minN)} / ${m.minN}`,n>m.minN?`+${n-m.minN} ráadás`:'ennyi kell a döntéshez').replace('class="mz-lab"','class="mz-lab" style="margin:16px 0 0"')+dayrow(m.minN,Math.min(n,m.minN),{cur:n>=m.minN?-1:n}),{i:1})}
  ${sec(2,'Az eddigi napok',2)}
  ${card(daysCard(m),{i:2,cls:'mz-wide'})}
  ${sec(3,'Bizonyíték-napló · minden, ami történt',3)}
  ${card(evlog(log),{i:3,cls:'mz-wide'})}
  ${sec(4,'A számítás',4)}
  ${card(diagF({win:m.win,n,grp:m.binary?`${n0} : ${n1}`:'nem csoportos',last:m.last,sa:m.A.src,sb:m.B.src,lag:m.lag,r:m.r,p:m.p,frozen:false}),{i:4})}`);
}
function mintaKat(){const m={binary:true,g:['Hétköznap','Hétvége'],A:{l:'Hétvége'},B:{l:'Lefekvés ideje'},fy:clock,ya:[22.5,24.5,[22.5,23,23.5,24,24.5]],days:HET};
  const wd=HET.filter(d=>!d[1]).map(d=>d[2]),we=HET.filter(d=>d[1]).map(d=>d[2]);
  const S=[31,38,44,47,52,55],sx=i=>14+i*(272/5),sy=v=>50-(v-25)/35*38,path=S.map((v,i)=>`${i?'L':'M'}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');
  return P({title:'Hétvége ↔ lefekvés ideje',sub:'Minta · alvás',back:'mintak'},`
  ${hero({lbl:'Megerősítve',verdict:'Ezt a kapcsolatot már megerősítetted.',sub:`Amit vizsgálunk: hétvégén később fekszel le? Az eddigi adatok szerint hétvégén <b>kb. 40 perccel</b> később fekszel le. Közepes bizonyosság — ${HET.length} napból.`,body:scbin(m)+gcap(`${HET.length} közös nap: a szint a lefekvés középső időpontja, a buborékok az egyes esték.`),acts:btn('A tény a Tudástárban',{go:'tenyek'})})}
  ${sec(1,'Az összevetés alapja · éles adatok',1)}
  ${card([['Hétköznap',wd],['Hétvége',we]].map(([l,a])=>row({title:l,sub:`${a.length} nap · ${clock(Math.min(...a))}–${clock(Math.max(...a))} között`,v:clock(median(a))})).join('')+note('A jobb oldali időpont a középső érték.'),{i:1})}
  ${sec(2,'Így változott a kapcsolat',2)}
  ${card(area(S,{w:320,h:96,min:20,max:60,labels:['aug. 29.','','','','','ma']})+note('Így erősödött a kapcsolat az első számítás óta: 12 közös napból indult, ma '+HET.length+' napon áll.')+`<div style="margin-top:14px">${daysCard(m,true)}</div>`,{i:2,cls:'mz-wide'})}
  ${sec(3,'Mit kezd ezzel az app',3)}
  ${card(row({icon:'t-note',title:'Tudástár-tény',sub:'×2 megerősítve · benne van a társ promptjában',on:'tenyek'})+row({icon:'t-orb',title:'1 előrejelzés',sub:'1 bejött · 0 még fut',on:'elore.lefekves'})
    +row({icon:'t-info',title:'Mit jelent ez?',sub:'A grafikon a most összevethető napokat mutatja. Az irányt mindig a fenti mondat mondja ki.'})+row({icon:'t-repeat',title:'Mi történik ezután?',sub:'Az új közös napokkal a motor újraszámolja a kapcsolatot és jelzi, ha érdemben változik.'}),{i:3})}
  ${sec(4,'Történet és számítás',4)}
  ${card(fold('hist','A minta története · 3 jelentős esemény',isOpen('hist'),evlog([['Aug. 29.','','Először számolhatóvá vált — 12 közös nap.'],['Szept. 10.','','Erősödött a kapcsolat.'],['Szept. 20.','','<b>Megerősítetted.</b> Létrejött a tudás-tény a Tudástárban.']]))+diagF({win:60,n:HET.length,grp:`${wd.length} : ${we.length}`,last:'ma 03:10',sa:'Naptár',sb:'Alvás-napló',lag:0,r:'0,55',p:'0,004',frozen:true}),{i:4,cls:'mz-wide'})}`);
}
function mintaMentett(over){const t={megerositve:['Megerősítve','A társ figyelembe veszi ezt a mintát a beszélgetésekben és a későbbi előrejelzéseknél.'],figyeljuk:['Megfigyelés alatt','Ezt a mintát tovább figyeljük. Még nem épül be tartós tudásként a társ válaszaiba.'],elvetve:['Elvetve','Ezt a mintát nem használjuk a társ válaszaiban, és nem kérünk róla újabb döntést.']}[over];
  return P({title:'Édes nasi a rövid éjszakák után?',sub:'Mentett minta · táplálkozás',back:'mintak'},`
  ${hero({warn:!t,lbl:t?t[0]:'A te döntésed kell',verdict:t?t[1]:'A 6 óránál rövidebb éjszakák utáni délutánokon gyakrabban kerül édesség a naplódba.',body:chain([{l:'rövid éjszaka után',s:'6 óra alatt',v:'3 nap',p:72},{l:'hosszabb éjszaka után',s:'édesség délután',v:'ritkán',p:22,c:'var(--faint)'}],[null],{h:128})+gcap('Amit eddig látunk: a szint az édességes délutánok gyakorisága.')+(t?'':conf(69,'bizonyosság')+decTrio('mentett')+note('<b>Megerősítem</b> — tartós tudás lesz: bekerül a Tudástárba és a társ fejébe, előrejelzés és kísérlet épülhet rá. <b>Figyeljük még</b> — marad a listán, a motor tovább számolja, de nem tanulok belőle.'))})}
  ${sec(1,'Mit figyelt meg az app?',1)}
  ${card(row({icon:'t-tick',title:'Szept. 9., 15. és 19.: rövid éjszaka után délutáni édesség'})+row({icon:'t-tick',title:'Hosszabb éjszakák után ez ritkább volt'})+note('Ez egy mentett felismerés. Nincs hozzá külön motor-pár és napgrafikon, ezért itt csak azt mutatjuk, amit a minta ténylegesen tartalmaz.'),{i:1})}`)}
function minta(arg){const [id,over]=(arg||'viz').split('.');
  if(id==='hetvege')return mintaKat();if(id==='mentett')return mintaMentett(over);
  if(id==='nincs')return P({title:'Minta',sub:'Minták',back:'mintak'},`${hero({warn:true,lbl:'Nincs ilyen minta',verdict:'A link egy már nem létező mintára mutat.',sub:'Nem sikerült betölteni a mintát.',acts:btn('Újra',{toast:'Újrapróbálom'})+lk('Vissza a mintákhoz',{go:'mintak'})})}
    ${card(empty('t-pattern','A minta betöltése… (betöltés közbeni állapot)'),{i:1,cls:'mz-dim'})}`);
  return mintaLab(MINTA[id]?id:'viz',MINTA[id]||MINTA.viz,over)}

/* ═════════ ELŐREJELZÉS · KÍSÉRLET mélyoldalak ═════════ */
const ELORE={'meccs-energia':{title:'Holnap reggel 7 fölött lesz az energiád',date:'szept. 25. · csütörtök',st:'pending',conf:.64,g:{p:74,v:'7 fölött',l:'holnap reggeli energia · ezt várom',band:[70,92],ticks:[[50,'5'],[70,'7'],[90,'9']]},basis:'Az utolsó 6 meccs utáni reggelen ötször 7 fölött jelentkeztél, ha előtte 23:30 előtt lefeküdtél — tegnap 23:05-kor feküdtél le.'},
  lefekves:{title:'Ezen a hétvégén is fél órával később fekszel, mint hét közben',date:'szept. 21. · vasárnap',st:'validated',conf:.71,g:{p:50,v:'+30 perc',l:'ennyivel későbbi lefekvést vártam',band:[40,75],out:63,outL:'ez történt: +38 perc',ticks:[[25,'+15'],[50,'+30'],[75,'+45']]},basis:'A hétvége ↔ lefekvés minta: 26 napból hétvégén kb. 40 perccel később feküdtél le.',actual:'szombaton 23:50, vasárnap 23:35 — hét közben a középső időpont 23:05.'},
  'alvas-edzes':{title:'A jó éjszaka után könnyebbnek érzed az edzést',date:'szept. 21. · vasárnap',st:'missed',conf:null,g:{p:62,v:'7 alatt',l:'ezt vártam · erőfeszítés-érzet',band:[52,70],out:78,outL:'ez történt: 7,5–8',ticks:[[50,'5'],[70,'7'],[90,'9']]},basis:'Két jó éjszaka utáni edzésen 7 alatti erőfeszítés-érzetet jelentettél.',actual:'7,5 és 8 közötti erőfeszítés-érzet, a jó éjszakák után is.'}};
const PST={pending:['Folyamatban','plan'],validated:['Bevált','q'],missed:['Nem jött be','q']};
function elore(id){const p=ELORE[id]||ELORE['meccs-energia'],[sl,sk]=PST[p.st],cf=p.conf==null?null:Math.round(p.conf*100),res=p.st!=='pending';const f=ST.fb['e'+id],rsn=ST.rsn['e'+id];
  const happened=p.actual?`${p.st==='validated'?'Bejött':'Megfigyelt eredmény'}: ${p.actual}`:p.st==='pending'?'Az eredmény még nem ismert. A megfigyelési időszak adatai alapján értékeljük.':'Ehhez a lezárt előrejelzéshez nincs szöveges eredmény.';
  return P({title:'Előrejelzés',sub:`${p.date} · ${sl.toLowerCase()}`,back:'elorejelzesek'},`
  ${hero({lbl:`${sl} · ${p.date}`,verdict:p.title+'.',sub:res?(p.st==='validated'?'Bejött — ez a jel erősödik a következő becsléseknél.':'Nem jött be — ez is számít: ebből a jelből ezután óvatosabban következtetek.'):(cf==null?'Még tanulom — ehhez az előrejelzéshez nincs megbízhatósági becslés.':`A csapat <b>${cf}%</b>-ra becsüli a megbízhatóságát.`),
    body:fore({...p.g,c:p.st==='validated'?'var(--ok)':p.st==='missed'?'var(--faint)':'var(--dom)'})+gcap(res?(p.st==='validated'?'A vonal a szaggatott sávba esett: bejött.':'A vonal a szaggatott sávon kívül állt meg: nem jött be.'):'A szaggatott sáv, ahová az eredményt várjuk — a vízvonal akkor kerül be, ha megvan.')+(res||cf==null?'':conf(cf,'becsült megbízhatóság'))})}
  ${res?sec(1,'Ezt vártam — és ez történt',1)+card(vs(p.title+'.',p.actual)+(cf==null?note('Még tanulom — ehhez az előrejelzéshez nincs megbízhatósági becslés.'):conf(cf,'becsült megbízhatóság')),{i:1}):sec(1,'Mi történt?',1)+card(sub(happened).replace('margin-top:6px','margin:0'),{i:1})}
  ${sec(2,'Miből következik?',2)}
  ${card(txt(p.basis),{i:2})}
  ${sec(3,'Hasznos volt?',3)}
  ${card(`<div class="mz-v" style="margin-top:0">${cm('Segített',`fbv:e${id}:up`,f==='up')}${cm('Nem talált',`fbv:e${id}:down`,f==='down')}</div>
    ${f==='down'?`<p class="mz-sub">Mi nem stimmelt?</p><div class="mz-v" style="margin-top:8px">${['pontatlan','túl sok','rossz időzítés','nem rólam szól'].map(x=>cm(x,`rsn:e${id}:${x}`,rsn===x)).join('')}</div>`:''}`,{i:3})}`);
}
const KIS={szenhidrat:{title:'Meccs előtti szénhidrát',st:'active',day:4,total:7,cmp:[[{l:'szénhidrát nélkül',s:'a próba előtt',v:'−11%',p:78,c:'var(--warn)'},{l:'80 g szénhidráttal',s:'2 meccsnap eddig',v:'−4%',p:30}],'Ennyit esik az ugrásod a 4. szettre — minél alacsonyabb, annál jobb.'],hyp:'Ha meccsnapon 17 óráig bekerül 80 g szénhidrát, a 4. szettben is stabil marad az ugrásod.'},korai:{title:'Korai vacsora-hét',st:'proposed',day:0,total:7,cmp:[[{l:'ahogy most eszel',s:'alvásminőség',v:'6,0',p:42,c:'var(--faint)'},{l:'19 előtti vacsorával',s:'ezt mérnénk ki',v:'?',p:0,dash:1}],'A jobb oldali edényt a kísérlet hét napja tölti fel.'],hyp:'Ha egy hétig 19 óra előtt vacsorázol, korábban alszol el, és jobb az alvásminőséged.'},kave:{title:'Délutáni kávé nélkül',st:'completed',good:true,day:10,total:10,cmp:[[{l:'délutáni kávéval',s:'alvás-átlag',v:'6,6',p:52,c:'var(--faint)'},{l:'16 után kávé nélkül',s:'10 éjszaka',v:'7,4',p:78}],'10 éjszakából 8-on jobb volt az alvásod.'],hyp:'Ha 16 óra után nem iszol kávét, nyugodtabb az éjszakád.',outcome:'10 éjszakából 8-on jobb volt az alvásod: átlag <b>7,4 pont</b> a korábbi 6,6 helyett.'}};
const xchip=x=>x.st==='proposed'?['Javaslat','q']:x.st==='active'?['Aktív','plan']:x.st==='dismissed'?['Elvetve','q']:x.good===true?['Megerősítve','q']:x.good===false?['Nem igazolódott','q']:['Nem értékelhető','q'];
function kiserletOldal(arg){const [id0,over0]=(arg||'szenhidrat').split('.');const key=KIS[id0]?id0:'szenhidrat',over=ST.xdec[key]||over0;const x={...KIS[key],...(over==='aktiv'?{st:'active',day:0}:over==='elvetve'?{st:'dismissed'}:{})};
  const [cl,ck]=xchip(x),outcome=x.outcome||(x.st==='dismissed'?'Ezt a javaslatot elvetetted; nem indult belőle kísérlet.':x.st==='completed'?'A kísérlet lezárult, de nincs szöveges eredmény.':'Még nincs lezárt eredmény.');
  const o={title:x.title,sub:`Kísérlet · ${x.total} napos saját megfigyelés`,back:'kiserletek'};
  const two=chain(x.cmp[0],[null],{h:132})+gcap(x.cmp[1]);
  if(x.st==='active')return P(o,`
    ${hero({lbl:`${cl} · hol tartunk?`,verdict:x.day?`${x.day} nap telt el a ${x.total}-ből.`:'Ma indul — az első nap még előtted van.',sub:'Az eltelt napokat látod. Az eredmény a lezárt megfigyelés után jelenik meg.',
      body:two+lab(`Gyűlő napok · ${x.day} / ${x.total}`).replace('class="mz-lab"','class="mz-lab" style="margin:16px 0 0"')+dcell(Array.from({length:x.total},(_,d)=>[(d+1)+'.',d<x.day?'el':d===x.day?'now':'']))})}
    ${sec(1,'Mit vizsgálunk?',1)}${card(txt(x.hyp),{i:1})}
    ${sec(2,'Eredmény',2)}${card(sub(outcome).replace('margin-top:6px','margin:0'),{i:2})}`);
  if(x.st==='proposed')return P(o,`
    ${hero({warn:true,lbl:`${cl} · a te döntésed`,verdict:'Elindítsuk ezt a kísérletet?',sub:x.hyp,body:two,acts:mb('Elfogadom',`xdec:${key}:aktiv`)+ml('Elvetem',`xdec:${key}:elvetve`)})}
    ${sec(1,'Eredmény',1)}${card(sub(outcome).replace('margin-top:6px','margin:0'),{i:1})}`);
  return P(o,`
    ${hero({lbl:cl,verdict:x.st==='dismissed'?'Ezt a javaslatot elvetetted.':x.good?'Bevált: a változtatás működik nálad.':'A kísérlet lezárult.',sub:outcome,body:x.st==='dismissed'?chain(x.cmp[0].map(v=>({...v,p:0,v:'–',dash:1})),[null],{h:120}):two+dayrow(x.total,x.total,{cur:-1})})}
    ${sec(1,'Mit vizsgálunk?',1)}${card(txt(x.hyp),{i:1})}`);
}

/* ═════════ LISTÁK: Minták · Előrejelzések · Kísérletek ═════════ */
const BK=[['decide','döntésre vár',2,'warn'],['monitoring','megfigyelés',4,''],['confirmed','megerősítve',6,''],['gathering','még gyűlik',5,''],['noRel','nincs kapcsolat',3,''],['rejected','elvetve',1,'']];
function bucket(){const b=ST.bucket;
  const trio=k=>`<div class="mz-v">${k?mb('Megerősítem','mack:confirm','sm'):cm('Megerősítem','mack:confirm')}${cm('Figyeljük','mack:monitor')}${cm('Elvetem','mack:reject')}</div>`;
  if(b==='decide')return sec(1,'Döntésre vár · 2 · csak erős jel',2)+card(`${lab('Megbízható jel',st('34 közös nap','warn'))}${h3('Több energiád van, ha többet iszol?')}${sub('Vízbevitel ↔ energia').replace('margin-top:6px','margin:0')}${lab('Amit eddig látunk').replace('class="mz-lab"','class="mz-lab" style="margin:12px 0 4px"')}${txt('Erős jel: a többet ivós napokon <b>határozottan</b> jobb a délutáni energiád. 34 nap alapján, a véletlen kizárható.')}${chain([{l:'1,5 liter alatt',s:'délutáni energia',v:'4–5',p:44,c:'var(--faint)'},{l:'2 liter fölött',s:'délutáni energia',v:'6–8',p:74}],[{w:11,cap:'erős jel',cap2:'34 közös nap'}])}
    ${lab('Mi történik a döntéseddel').replace('class="mz-lab"','class="mz-lab" style="margin:14px 0 0"')}${trio(1)}${note('<b>Megerősítem</b> — tartós tudás lesz. <b>Figyeljük még</b> — marad a listán, de nem tanulok belőle. <b>Elvetem</b> — befagy, többé nem hozom elő.')}${lk('Részletek és előzmények ›',{go:'minta.viz'})}`,{i:2})
    +card(`${lab('Ígéretes jel',st('14 közös nap'))}${h3('Rosszabbul alszol, ha későn vacsorázol?')}${sub('Késői étkezés ↔ rákövetkező alvásminőség')}${G_VACS(1)}${trio(0)}${lk('Részletek ›',{go:'minta.vacsora'})}`,{i:3});
  if(b==='confirmed')return sec(1,'Megerősítve — él a tudásban · 6',2)+card([['moon','Magas sportterhelés → mélyebb alvás','12 közös nap'],['plate','Késői étkezés → felszínes alvás','14 közös nap'],['water','Vízbevitel → délutáni energia','8 közös nap'],['journal','Hála-napló → nyugodtabb nap','11 közös nap']].map(t=>r({icon:t[0],title:t[1],sub:t[2],on:'minta.viz.megerositve'})).join('')+note('Ez a 6 összefüggés benne van a társ fejében minden beszélgetésnél, és ebből épülnek az előrejelzések.'),{i:2});
  if(b==='monitoring')return sec(1,'Megfigyelés alatt · 4',2)+card([['moon','Vacsora ideje ↔ alvásminőség','Ígéretes jel, de még nem elég biztos.',70],['journal','Anna a hála-naplóban → többet alszol','4 találat, 1 kihagyás.',38],['person','Súly ↔ vízbevitel','Gyenge, még ingadozó.',45],['dumbbell','Push nap ↔ vállérzékenység','Tartja magát.',60]].map(t=>r({icon:t[0],title:t[1],sub:t[2]+lvl(t[3]),on:'minta.vacsora'})).join(''),{i:2});
  if(b==='gathering')return sec(1,'Még gyűlik az adat · 5',2)+card([['dumbbell','Egyforma terhelés ↔ reggeli energia','5 / 8 nap'],['plate','Hétvége ↔ késői étkezés','+2 hétvégi nap kell'],['water','Vízbevitel ↔ energia-szint','Pihen — várom az adatot']].map(t=>r({icon:t[0],title:t[1],sub:t[2],on:'minta.egyhangu'})).join('')+note('Ezek nem hibák — csak nincs elég közös nap. Amit logolsz, az hozza őket életre.'),{i:2});
  return sec(1,b==='rejected'?'Elvetve · 1':'Megnéztük — nincs összefüggés · 3',2)+card([['plate','Koffein ↔ edzés-RPE','Nincs kapcsolat a két érték között.'],['moon','Lépésszám ↔ alvásidő','Nincs kapcsolat.']].map(t=>r({icon:t[0],title:t[1],sub:t[2],on:'minta.viz.elvetve'})).join('')+note('Ez is eredmény: megnéztük, és nincs kapcsolat. Nem kér döntést — ha később megerősödne, feljebb lép.'),{i:2});
}
function mintak(){const ackT={confirm:'Beépítettem a tudásba — mostantól számolok vele.',monitor:'Rendben, figyeljük tovább — szólok, ha erősödik.',reject:'Elvetve — nem hozom fel újra.'};
  return P({title:'Minták',sub:'Mezo · a motor · ma 14:12 · 60 nap',back:'osszes'},`
  ${hero({lbl:'Amit újra és újra észreveszünk',verdict:'6 megerősített összefüggés él a tudásban — 2 vár a döntésedre.',sub:'<b>21 kérdést</b> figyelek a naplóidból.',
    body:lab('A motor állapota','ma 14:12 · 60 nap').replace('class="mz-lab"','class="mz-lab" style="margin:14px 0 0"')+rack(BK.map(k=>({p:k[2]/6*100,c:k[3]==='warn'?'var(--warn)':k[0]==='rejected'||k[0]==='noRel'?'var(--faint)':'var(--dom)',v:k[2],l:k[1],on:'m:bucket:'+k[0],sel:ST.bucket===k[0]})),{h:46,cols:3})+gcap('21 kérdés hat edényben, állapot szerint — koppints egyre, és lent azt látod.'),
    acts:mb('A döntésre várók','bucket:decide')+lk('Szűrés · minden téma',{sheet:'filter'})})}
  ${ST.ack?card(done(ackT[ST.ack]).replace('class="mz-done"','class="mz-done" style="margin:0"'),{i:1}):''}
  ${bucket()}
  ${card(`<div class="mz-nav" style="margin:0">${lk('‹ előző',{toast:'Előző oldal'})}<span class="off">1–4 / 6</span>${lk('következő ›',{toast:'Következő oldal'})}</div>`,{i:3})}
  ${sec(2,'Adat-egészség',4)}
  ${card(rack([['Hangulat',12,'7/60 · 3 napja',1,'t-mood'],['Vízbevitel',40,'24/60 · ma',1,'t-water'],['Alvás',97,'58/60 · ma',0,'t-moon'],['Edzés',88,'53/60 · tegnap',0,'t-dumbbell'],['Étkezés',93,'56/60 · ma',0,'t-bowl']].map(c=>({p:c[1],c:c[3]?'var(--warn)':'var(--dom)',v:c[1]+'%',l:`${c[0]}<br>${c[2]}`,top:bub(c[4],{s:30,c:c[3]?'var(--warn)':'var(--dom)'})})),{h:84}).replace('margin-top:14px','margin-top:0')+note('Ahol kevés a mért nap, ott az edény borostyán és alig van benne: oda kell adat.')
    +`<div style="margin-top:12px">${row({icon:'t-layers',title:'A motor bemenete: memória-rétegek',on:'memoria'})}</div>`,{i:4})}`);
}
const PRED=[{k:'meccs-energia',s:'pending',c:72,b:'Március óta a 102.5 stabil. Múlt heti RIR 2 + 7.5h alvás kombináció historikusan +5kg-os emelést támogatott.'},{k:'lefekves',s:'validated',a:'RPE 8.2 · vacsora 20:50'},{k:'alvas-edzes',s:'missed',a:'6 ó 20 p'}];
function elorejelzesek(arg){const list=arg==='ures'?[]:PRED.filter(p=>ST.pred==='all'||(ST.pred==='pending'?p.s==='pending':p.s!=='pending'));
  return P({title:'Előrejelzések',sub:'Mezo · mit vártunk, és mi történt?',back:'osszes'},`
  ${hero({lbl:'60 napos pontosság',verdict:'Az előrejelzések 68%-a bevált.',sub:'2 bevált az elmúlt 60 napban — a tévedések is itt maradnak.',body:fore({p:68,v:'68%',l:'bevált · 60 napos pontosság',h:112,out:68,outL:'2 bevált',ticks:[[50,'50'],[100,'100']]})+drops([{k:'full',c:'var(--ok)',s:22},{k:'full',c:'var(--ok)',s:22},{k:'gone',s:22},{k:'half',s:22}],'teli: bevált · szaggatott: nem jött be · fél: még fut'),acts:btn('A most futó előrejelzés',{go:'elore.meccs-energia'})})}
  ${sec(1,'Aktív predikciók',1)}
  ${card(sg([['all','Mind'],['pending','Folyamatban'],['closed','Lezárt']],ST.pred,'pred').replace('class="fh-seg"','class="fh-seg" style="margin:0"'),{i:1})}
  ${list.length?list.map((p,i)=>{const e=ELORE[p.k],[sl,sk]=PST[p.s],f=ST.mfb['p'+i],live=p.s==='pending';
    return card(`${lab(e.date,st(sl,sk))}<button class="mz-kb" style="text-align:left;margin:0" data-go="elore.${p.k}">${h3(e.title)}${sub(live?p.b:(p.s==='validated'?'Bejött: ':'Megfigyelt eredmény: ')+p.a)}</button>${live?conf(p.c):`<div class="mz-mf">${fore({...e.g,h:74,v:'',l:'',ticks:[],c:p.s==='validated'?'var(--ok)':'var(--faint)'})}</div>`}
      <div class="mz-v">${cm('Segített',`mfb:p${i}:up`,f==='up')}${cm('Nem talált',`mfb:p${i}:down`,f==='down')}${lk('Megnyitom ›',{go:'elore.'+p.k})}</div>`,{i:i+2})}).join('')
  :card(empty('t-orb',arg==='ures'?'<b>Tanulom.</b> Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.':'Ebben az állapotban még nincs előrejelzés.'),{i:2})}`);
}
const EXP=[{s:'aktiv',t:'Glikogén-feltöltés röpi előtt',h:'Ha röpi előtt 3 órával 80 g szénhidrátot eszel, a harmadik szettben is megmarad a robbanékonyság.',d:4,go:'kiserlet-oldal.szenhidrat'},{s:'aktiv',t:'Korábbi vacsora',h:'Ha 19:30 előtt vacsorázol, mélyebb és hosszabb az alvásod.',d:2,go:'kiserlet-oldal.korai.aktiv'},{s:'javaslat',t:'Reggeli napfény 10 perc',h:'A reggeli fény korábbra tolja az esti elalvást.',go:'kiserlet-oldal.korai'},{s:'megerosit',t:'Kreatin 5 g naponta',o:'3/4 mérés',go:'kiserlet-oldal.kave'},{s:'nemigaz',t:'Hideg zuhany edzés után',o:'a regeneráció nem változott',go:'kiserlet-oldal.kave'},{s:'nemert',t:'Esti magnézium',o:'kevés alvás-adat',go:'kiserlet-oldal.kave'},{s:'elvetve',t:'16:8-as időablak',go:'kiserlet-oldal.korai.elvetve'}];
const EXS={aktiv:'Aktív',javaslat:'Javaslat',megerosit:'Megerősítve',nemigaz:'Nem igazolódott',nemert:'Nem értékelhető',elvetve:'Elvetve'};
function kiserletek(){const f=ST.ex,pass=e=>f==='mind'||(f==='aktiv'&&e.s==='aktiv')||(f==='javaslat'&&e.s==='javaslat')||(f==='lezart'&&!['aktiv','javaslat'].includes(e.s));const list=f==='ures'?[]:EXP.filter(pass);
  return P({title:'Kísérletek',sub:'Mezo · a saját testeden bizonyítjuk',back:'osszes'},`
  ${hero({lbl:'Kis változtatás, követhető eredmény',verdict:'2 kísérlet fut most.',sub:'Egy javaslat vár rád, négy már lezárult.',body:EXP.filter(e=>e.s==='aktiv').map(e=>lab(e.t,`${e.d} / 7 nap`).replace('class="mz-lab"','class="mz-lab" style="margin:14px 0 0"')+dayrow(7,e.d)).join('')+gcap('Egy edény = egy nap: a megteltek mögötted vannak, a keretes a mai.'),acts:btn('A futó kísérlet',{go:EXP[0].go})+lk('Új kísérletet kérek Mezótól',{toast:'Mezo gondolkodik egy új kísérleten…'})})}
  ${sec(1,'Kísérletek',1)}
  ${card(pg([['mind','Mind · 7'],['aktiv','Aktív · 2'],['javaslat','Javaslat · 1'],['lezart','Lezárt · 4']],f,'ex'),{i:1})}
  ${list.length?list.map((e,i)=>card(`${lab(EXS[e.s]+(e.d?` · ${e.d}/7 nap`:''),st(EXS[e.s],e.s==='aktiv'?'plan':e.s==='javaslat'?'warn':'q'))}<button class="mz-kb" style="text-align:left;margin:0" data-go="${e.go}">${h3(e.t)}${e.h||e.o?sub(e.h||e.o):''}</button>
      ${e.s==='aktiv'?dcell([1,2,3,4,5,6,7].map(k=>[k+'.',k<=e.d?'el':k===e.d+1?'now':''])):''}
      ${e.s==='javaslat'?`<div class="mz-v">${btn('Elfogadom',{toast:'Elfogadva — holnap indul'},'sm')}${ct('Elvetem','Elvetve')}</div>`:''}
      <div class="fh-acts">${lk('Megnyitom ›',{go:e.go})}</div>`,{i:Math.min(i+2,8)})).join('')
  :card(empty('t-flask','Tanulom, mi működik nálad. Az első kísérletet akkor javaslom, ha lesz elég adatom egy jó kérdéshez.'),{i:2})}`);
}

/* ═════════ BESZÉLGETÉS (chat + memória-jelzések) ═════════ */
const STATUS={full:['élő · Gemini',''],mem:['élő · Gemini',''],typing:['dolgozom rajta…','busy'],err:['élő · Gemini',''],empty:['új beszélgetés',''],off:['a társ most nem elérhető','off'],hallgat:['élő · Gemini','']};
const chatTop=()=>card(`<div class="fh-pills"><button class="fh-pill" data-sheet="picker">Beszélgetések</button><button class="fh-pill" data-go="chat.empty">+ Új</button><button class="fh-pill" data-sheet="actions">Műveletek</button></div>`,{i:0});
const msgA=(time,body,x='')=>`<div class="fh-msg mz-a"><span class="who">${W('mezo')}</span><div class="b"><span class="nm">Mezo<small>${time}${x?' · '+x:''}</small></span>${body}</div></div>`;
const msgU=(t,time)=>me(time,t);
const composer=k=>`<div class="mz-comp"><button data-go="chat.hallgat" aria-label="Diktálás">${I('t-mic')}</button><span class="inp ${k==='hallgat'?'on':''}">${k==='hallgat'?'Szerinted holnap edzhetek, vagy inkább pihenjek?':'Mondj valamit…'}</span><button class="send" data-go="chat.typing" aria-label="Küldés">${I('t-send')}</button></div>`;
const S8F={dori:{w:'Dóri',t:'a strandröpi-párod, együtt nyertétek a szeptemberi tornát',k:'rem'},self:{w:'',t:'Egy nagy közös élmény után nehezen viselem az egyedül töltött estét.',k:'prop'},anna:{w:'Anna',t:'régi csapattársad, rég beszéltetek',k:'rem'},bence:{w:'Bence',t:'jövőre hármasban játszana veled és Annával',k:'rem'}};
const S8R={dori:['tavasz óta a strandröpi-párod','hétköznap ritkán ér rá, inkább hétvégén játszotok'],bence:['az egyetem óta ismeritek','ő szervezi a szombati edzéseket']};
const s8txt=f=>f.w?`<b>${f.w}</b> — ${f.t}`:f.t;
function s8chip(id){const f=S8F[id],s=ST.s8[id];
  if(s==='undone')return `<div class="mz-in">${quiet('spark','Visszavonva — nem jegyeztem meg.')}</div>`;
  if(s==='gone')return `<div class="mz-in">${quiet('eraser',`Elfelejtve · <s>${f.w?f.w+' — ':''}${f.t}</s>`)}</div>`;
  if(s==='no')return `<div class="mz-in">${quiet('bulb','Rendben, nem jegyzem meg — és nem is javaslom újra.')}</div>`;
  if(f.k==='prop'&&s==='ask')return memchip('bulb',`<b>Megjegyezném:</b> ${f.t}<small>rólad szól, ezért előbb megkérdezlek</small>`,mb('Igen','s8:keep:'+id,'sm')+ml('Ne','s8:no:'+id),'prop');
  return memchip('spark',`<b>Megjegyeztem:</b> ${s8txt(f)}${f.k==='prop'?'<small>a Tudástár Rólad részében látod</small>':''}`,ml('Visszavonom','s8:undo:'+id))}
const s8rec=(names,key)=>`<button class="mz-rec" data-m="s8:rec:${key}">${drop({k:'empty',ic:'people',s:22})}<span>Emlékszem: <b>${names.join(' · ')}</b> ›</span></button>`;
function s8gone(){const latest=['anna','bence'],rest=['dori','self'].filter(id=>['on','ask','kept'].includes(ST.s8[id]));
  const list=(ST.s8.all?[...latest,...['dori','self'].filter(id=>ST.s8[id]==='gone')]:latest).map(id=>`<li>${S8F[id].w?S8F[id].w+' — ':''}${S8F[id].t}</li>`).join('');
  return memchip('eraser',`<b>Elfelejtettem:</b><ul>${list}</ul><small>végleg — ezeket többé nem használom, és nem is tanulom meg újra</small>`,!ST.s8.all&&rest.length?ml('Mindent ebből a beszélgetésből?','s8:allask'):'')}
const thread=h=>card(`<div class="mz-th">${h}</div>`,{i:1});
function s8chat(){return thread(`
  ${msgU('Megnyertük ma a strandröpi-tornát Dórival és Bencével! Aztán mindenki hazament, én meg itt ülök egyedül. Furcsa ez a csend.','22:05')}
  ${msgA('22:05',`<p>Gratulálok, ez nagy nap volt! Dórival tavasz óta játszotok párban, és most jött ki igazán.</p><p>Nem meglepő, hogy ilyen csúcs után furcsa a csend: egy nagy közös élmény után a hirtelen egyedüllét sokakat lehúz egy kicsit. Mi esne most jól, átbeszélni a meccset, vagy inkább lecsendesedni?</p>${s8rec(['Dóri','Bence'],'1')}`)}
  ${s8chip('dori')}${s8chip('self')}
  ${msgU('Átbeszélni. Bence mondta, hogy jövőre Annával is összeállhatnánk, vele régen nem beszéltem. Ezt el tudod menteni valahova?','22:07')}
  ${msgA('22:07',`<p>Igen, a magam módján: a beszélgetés után megjegyzem, ami fontos. Amit az emberekről mondasz, azt elmentem, amit magadról, azt előbb megkérdezem. Mindkettőt itt a beszélgetésben látod, és később a Tudástárban is.</p><p>Bence ötlete jó alkalom lehet: ha Annával rég beszéltél, egy közös edzés könnyebb belépő, mint egy nagy „mi van veled”.</p>${s8rec(['Bence'],'2')}`)}
  ${s8chip('anna')}${s8chip('bence')}
  ${msgU('Az Annásat inkább ne jegyezd meg.','22:09')}
  ${msgA('22:09',`<p>Rendben, elfelejtettem. Lent látod pontosan, mit: az előző üzenetedből tanult két dolgot. Ha a mai estéről semmit ne tartsak meg, egy koppintás.</p>`)}
  ${s8gone()}`)}
function s8ureschat(){return thread(`
  ${msgU('Dórival ma is strandröpiztünk, megint nyertünk!','19:40')}${msgA('19:40','<p>Szuper, gratulálok — Dórival megint összejött.</p>')}
  ${memchip('spark','<b>Megjegyeztem:</b> <b>Dóri</b> — a strandröpi-párod, ma is nyertetek',lk('Visszavonom',{toast:'Visszavonva — nem jegyeztem meg.'}))}
  ${msgU('Milyen lesz az idő holnap az edzéshez?','19:42')}${msgA('19:42','<p>Holnap napos, enyhe szél — jó nap a szabadtéri edzéshez.</p>')}
  ${msgU('Ezt ne jegyezd meg.','19:43')}${msgA('19:43','<p>Rendben. Lent látod, mit találtam — vagy inkább mennyit.</p>')}
  ${memchip('eraser','Nem volt mit elfelejteni — az előző üzenetedből semmit nem jegyeztem meg.',ml('Mindent ebből a beszélgetésből?','s8:allask'))}`)}
const S8M={a:{w:'Dóri',t:'Dórival egyre komfortosabbak vagyunk egymással, az ölelés is természetes már köztünk.'},b:{w:'Dóri',t:'Dóri mellett nem kell megjátszanom magam.'}};
function s8mchip(id){const f=S8M[id],s=ST.s8m[id];if(s==='undone')return `<div class="mz-in">${quiet('spark','Visszavonva — nem jegyeztem meg.')}</div>`;const mine=s==='me';
  return memchip('spark',`<b>Megjegyeztem: ${f.w}</b> — ${f.t}<small>${mine?'Dóri lapján és a Tudástár Rólad részében is látod':'Dóri lapján látod'}</small>`,cm(mine?'Rólad is · kész':'Rólam is','s8:me:'+id,mine)+ml('Visszavonom','s8:mundo:'+id))}
function s8rolamis(){return thread(`${msgU('Dórival egyre jobban vagyunk, már az ölelés is természetes köztünk. Mellette nem kell megjátszanom magam, ez nagyon jó érzés.','09:04')}
  ${msgA('09:04',`<p>Ez nagyon szép. Amikor valaki mellett nem kell szerepet játszanod, az nem egy programhoz vagy teljesítményhez kötődik, hanem hozzád.</p><p>És hogy az érintés is egyre természetesebb, az azt jelzi, hogy épül a bizalom. Nem kell siettetni semmit.</p>${s8rec(['Dóri'],'3')}`)}${s8mchip('a')}${s8mchip('b')}`)}
function chatFull(k){
  const tools=`${ml(`Utánanézett · 3 forrás · ${ST.tools?'bezár':'megnyit'}`,'tools',ST.tools)}${ST.tools?`<div class="mz-refs" style="padding:4px 12px">${[['sleep','Alvás · tegnap éjjel','hogy lássam, mennyit pihentél','7 óra 4 perc, két ébredés'],['dumbbell','Edzés · Push Day','a tegnapi terhelésért','Lat Pulldown 105 × 9 @ RIR 1, 16 szett'],['pattern','Minták · alvás','van-e friss összefüggés','Nincs friss minta, a régi még nem erős.']].map(q=>r({icon:q[0],title:q[1],sub:`miért: ${q[2]} · ${q[3]}`})).join('')}</div>`:''}`;
  const mems=`${ml(`Emlékek · 2 · ${ST.mems?'bezár':'megnyit'}`,'mems',ST.mems)}${ST.mems?[['futás után jobban aludtam','2026-05-18',92],['a push nap után a váll érzékeny','2026-08-03',81]].map(m=>`<div class="mz-refs"><b>${m[0]} · ${m[2]}%</b>${m[1]}<div class="mz-v" style="margin-top:8px">${ct('Hasznos','Köszi, megjegyeztem')}${ct('Nem ide tartozik','Rendben, ide nem veszem elő')}${ct('Ne használd többé','Biztosan? Többé nem használom ezt az emléket.')}</div></div>`).join(''):''}`;
  const a1=msgA('06:32',`${tools}<p>Jó reggelt. Tegnap a Push Day jól ment: a <b>Lat Pulldown 105 × 9</b> RIR 1-gyel az eddigi legjobbad.</p><p>Hét óra alvás után ma nyugodtan tarthatod a tervezett terhelést, de a vállad miatt a nyomásoknál maradj a megszokott súlynál.</p><div class="mz-refs"><b>Amire épült</b>Push Day · tegnap · Lat Pulldown 105 × 9 · Alvás 7 ó 4 p</div><div style="margin-top:10px">${mems}</div><div class="mz-v">${ct('Segített','Köszi!')}${ct('Nem talált','Mi nem stimmelt? pontatlan · túl sok · rossz időzítés · nem rólam szól')}</div>`);
  const u1=msgU('Aludtam 7 órát. Érzem, hogy ma jobb, mint tegnap.','06:35');
  const a2=msgA('06:35','<p>Látszik is: a pulzusod reggel három ütéssel lejjebb volt. Ha délután röpi van, ebédnél egyél egy tányér rizst, az kitart a harmadik szettig.</p>','nem ellenőrzött');
  if(k==='empty')return hero({lbl:'Új beszélgetés',verdict:'Kérdezz bármit a napodról, az edzésről, az evésről.',left:WA('mezo',64)},1)+sec(1,'Kezdheted ezzel',2)+card([['sun','Foglald össze a mai napom röviden'],['dumbbell','Mit edzek ma?'],['bowl','Mennyi fehérje hiányzik még?'],['sleep','Miért aludtam rosszul?']].map(q=>r({icon:q[0],title:q[1],on:'chat.typing'})).join(''),{i:2});
  if(k==='off')return hero({warn:true,lbl:'A társ most nem elérhető',verdict:'Most nem tudok válaszolni.',sub:'A társ jelenleg nincs bekapcsolva. A korábbi beszélgetéseid megvannak.'},1)+thread(a1+u1);
  let tail='';if(k==='typing')tail=`<div class="fh-msg"><span class="who">${W('mezo')}</span><div class="b"><span class="nm">Mezo<small>dolgozom rajta…</small></span><span class="mz-ty"><i></i><i></i><i></i></span><p class="mz-sub" style="margin:0">megnézem az adataidat…</p></div></div>`;
  if(k==='err')tail=msgA('06:37',`<p><b>Nem jött válasz.</b> Az üzeneted nem veszett el.</p><div class="mz-v">${btn('Újra',{go:'chat.typing'},'sm')}${ct('Szerkesztés','Szerkesztés')}</div>`);
  return thread(a1+u1+a2+(k==='typing'||k==='err'?msgU('Akkor ma mehet a röpi is?','06:37'):'')+tail)
    +(k==='hallgat'?hero({lbl:'Hallgatlak',verdict:'Figyelek · mondd nyugodtan.',sub:'Koppints ide, ha végeztél.',left:WA('mezo',56),acts:`<span class="mz-bars" aria-hidden="true">${[6,12,18,22,14,20,10,16,22,12,8,14].map(h=>`<i style="--h:${h}px"></i>`).join('')}</span>`+lk('Mégse',{go:'chat.full'})},2):'');
}
/* a beszélgetés emlékezete egy pillantásra: minden csepp egy dolog, amit megjegyzett / megjegyezne / elfelejtett */
function memstrip(k){let a=[],cap='';
  if(k===''){const m={on:'full',kept:'full',ask:'half',gone:'gone',undone:'gone',no:'gone'};a=['dori','self','anna','bence'].map(id=>({k:m[ST.s8[id]]||'full',c:ST.s8[id]==='ask'?'var(--warn)':'var(--dom)'}));
    const n=x=>a.filter(o=>o.k===x).length;cap=`${n('full')} megjegyezve · ${n('half')} kérdés hozzád · ${n('gone')} elfelejtve`}
  else if(k==='rolamis'){a=['a','b'].map(id=>({k:ST.s8m[id]==='undone'?'gone':'full'}));cap=`${a.filter(o=>o.k==='full').length} megjegyezve Dóri lapjára${['a','b'].some(id=>ST.s8m[id]==='me')?' · rólad is':''}`}
  else if(k==='ures'){a=[{k:'full'},{k:'gone',c:'var(--faint)'}];cap='1 megjegyezve · az utolsó fordulóból nem volt mit elfelejteni'}
  else if(k==='empty'||k==='off')return '';
  else{a=[{k:'empty'},{k:'empty'},{k:'half',c:'var(--faint)'},{k:'half',c:'var(--faint)'},{k:'half',c:'var(--faint)'}];cap='2 emléket vett elő · 3 forrásnak nézett utána'}
  return card(lab('Ennek a beszélgetésnek az emlékezete').replace('class="mz-lab"','class="mz-lab" style="margin:0"')+drops(a.map(o=>({s:22,...o})),cap).replace('margin-top:12px','margin-top:4px'),{i:0,cls:'mz-ms'})}
function chat(arg){const k=arg||'';const [s]=STATUS[k===''||k==='ures'||k==='rolamis'?'mem':k]||STATUS.full;
  const body=k==='ures'?s8ureschat():k==='rolamis'?s8rolamis():k===''?s8chat():chatFull(k);
  return P({title:'Mezo',sub:`Beszélgetés · ${s}`,back:'mai'},chatTop()+memstrip(k)+body,k==='off'?{}:{foot:composer(k)})}

/* ═════════ COACHING · MEGFIGYELŐ · KÁRTYA ═════════ */
const RULES=[{n:'Terhelés–táplálás',ic:'bowl',s:'act',win:1,why:'7 napos terhelés 412 perc, a kalória a cél 71%-án.',f:[['Mért érték','71%'],['Küszöb','85%']]},{n:'Edzés-monotónia',ic:'dumbbell',s:'act',why:'Öt napja ugyanaz a terhelés, pihenőnap nélkül.',f:[['Mért érték','2,4'],['Küszöb','2,0']]},{n:'Késői koffein',ic:'flame',s:'pend',why:'Tegnap szólt, két napig pihen, hogy ne ismételje magát.',f:[['Utoljára','szept. 24.'],['Pihen még','1 nap']]},{n:'Alvásadósság',ic:'sleep',s:'ok',why:'Az elmúlt 3 éjszaka átlaga rendben van.',f:[['Mért érték','1,0 óra'],['Küszöb','2,0 óra']]},{n:'Fehérje-hiány',ic:'protein',s:'ok'},{n:'Súlytrend',ic:'weight',s:'ok'},{n:'Hidratáció',ic:'water',s:'ok'},{n:'Lépésszám',ic:'steps',s:'ok'},{n:'Regeneráció',ic:'sprout',s:'ok'},{n:'Napló-csend',ic:'journal',s:'ok'},{n:'Esti képernyő',ic:'moon',s:'ok'},{n:'Pulzus-variancia',ic:'heart',s:'mut',why:'Nincs óra-adat az elmúlt 7 napból.'},{n:'Stressz-jelek',ic:'signal',s:'mut'},{n:'Ciklus',ic:'calendar',s:'mut'}];
const SCHIP={act:['Jelzett','warn'],pend:['Pihenőn','q'],ok:['Rendben','q'],mut:['Nem mérhető','q']};
const ruleRack=()=>rack(RULES.map((q,i)=>({p:{act:100,pend:52,ok:18,mut:0}[q.s],dash:q.s==='mut',c:{act:'var(--warn)',pend:'var(--carb)',ok:'var(--ok)',mut:'var(--faint)'}[q.s],l:i+1,on:'megfigyelo',aria:`${q.n} · ${SCHIP[q.s][0]}`})),{h:56,cls:'tiny'});
function coaching(){return P({title:'Coaching',sub:'Proaktív coaching · ma 3 jelzés',back:'osszes'},`
  ${hero({warn:true,lbl:'A nap nyertese · 1 / 14',verdict:'Terhelés–táplálás szólt a leghangosabban.',sub:'7 napos terhelés 412 perc, a kalória a cél 71%-án.',body:ruleRack()+gcap('14 szabály, 14 kémcső: tele, ami ma jelzett · félig, ami pihen · alacsonyan, ami rendben · szaggatott, ami nem mérhető.'),acts:btn('Ebből lett a mai kártya',{go:'kartya'})})}
  ${sec(1,'Ma ennyi szólalt meg · 14 szabály',1)}
  ${card(grid([stat({k:'Jelzett',n:'2',c:'var(--warn)'}),stat({k:'Pihenőn',n:'1'}),stat({k:'Rendben',n:'8',c:'var(--ok)'}),stat({k:'Nem mérhető',n:'3'})])+note('Ez a felület nem dönt: azt mutatja meg, mit döntött ma a motor, és miért.'),{i:1})}
  ${sec(2,'Nézz bele',2)}
  ${card(row({icon:'t-eye',title:'Megfigyelő',sub:'mind a 14 szabály, súlyossági sorrendben',on:'megfigyelo'})+row({icon:'t-card',title:'A napi kártya',sub:'Terhelés–táplálás nyerte a napot',on:'kartya'}),{i:2})}`)}
const ruleRow=(q,i)=>{const [l,k]=SCHIP[q.s],op=ST.rule==='r'+(i+1),show=(q.s==='act'||op)&&q.why;
  return `<div class="fh-row ${q.s==='ok'||q.s==='mut'?'off':''}" ${q.why?`data-m="rule:r${i+1}" role="button" aria-expanded="${op}"`:''}><span class="si">${I('t-'+q.ic)}</span><span class="g"><strong>${i+1}. ${q.n}${q.win?' · nyertes':''}</strong>${show?`<small>${q.why}</small>`:''}${op&&q.f?`<span class="mz-kv">${q.f.map(f=>`<span>${f[0]}<b>${f[1]}</b></span>`).join('')}</span>`:''}</span>${st(l,k)}</div>`};
function megfigyelo(){return P({title:'Megfigyelő',sub:'Coaching · 3 jelzett · 14 szabály',back:'coaching'},`
  ${hero({lbl:'Ma · csütörtök',verdict:'Ma 3 szabály szólalt meg a 14-ből.',sub:'A sorrend maga a döntés: fent az, ami ma a legsürgetőbb.',body:rack([{p:71,mark:85,v:'71%',l:'Terhelés–táplálás<br>küszöb 85%',c:'var(--warn)'},{p:80,mark:67,v:'2,4',l:'Edzés-monotónia<br>küszöb 2,0',c:'var(--warn)'},{p:50,v:'1 nap',l:'Késői koffein<br>pihen még',c:'var(--carb)'},{p:33,mark:67,v:'1,0 ó',l:'Alvásadósság<br>küszöb 2,0 ó',c:'var(--ok)'}],{h:86})+gcap('A vonal a küszöb. Ahol a szint a rossz oldalára kerül, a szabály megszólal.'),acts:btn('A napi kártya',{go:'kartya'})+lk('‹ szerda',{toast:'Szerda'})+`<span class="mz-today">ma · csütörtök</span>`})}
  ${sec(1,'Megszólalt',1)}${card(RULES.slice(0,3).map((q,i)=>ruleRow(q,i)).join(''),{i:1})}
  ${sec(2,'Rendben',2)}${card(RULES.slice(3,11).map((q,i)=>ruleRow(q,i+3)).join(''),{i:2})}
  ${sec(3,'Nem mérhető',3)}${card(RULES.slice(11).map((q,i)=>ruleRow(q,i+11)).join(''),{i:3})}
  ${sec(4,'A nap változásai',4)}
  ${card([['09:00','Terhelés–táplálás','A szabály jelzett.'],['09:00','Edzés-monotónia','A szabály jelzett.'],['07:10','Késői koffein','Pihenőre került.']].map(t=>step({time:t[0],title:t[1],sub:t[2]})).join(''),{i:4})}`)}
function kartya(){if(ST.card==='none')return P({title:'A napi kártya',sub:'Coaching',back:'coaching'},card(empty('t-card','Ma nem érkezett kártya. Egyik szabály sem volt elég sürgős ahhoz, hogy szóljon.')));
  return P({title:'A napi kártya',sub:'Coaching · egy kártya naponta',back:'coaching'},`
  ${hero({warn:true,lbl:'Terhelés–táplálás · ma ez nyert',verdict:'Egyél a terheléshez.',sub:'A heti terhelésed magas, a bevitel viszont a cél alatt maradt. Ma tegyél be egy tisztességes ebédet, és a holnapi edzést vedd egy fokkal lazábbra.',body:chain([{l:'7 napos terhelés',s:'magas',v:'412 p',p:90},{l:'kalória a célhoz',s:'a küszöb 85%',v:'71%',p:71,mark:85}],[{w:6,dash:1,cap:'nem ér össze'}])+gcap('Egy kártya naponta. Ma ez nyert: a terhelés edénye tele, a bevitelé a vonal alatt.'),
    acts:ST.card==='done'?done('Könnyítettük a holnapot'):mb('Könnyítsd a holnapot','card:done')})}
  ${sec(1,'Mit tegyél',1)}
  ${card(row({icon:'t-bowl',title:'Ebédre legalább 600 kcal, benne szénhidrát.'})+row({icon:'t-dumbbell',title:'Holnap a tervezett szettek 80%-a is elég.'}),{i:1})}
  ${sec(2,'Miért ez nyert',2)}
  ${card([['dumbbell','Edzés-monotónia','ugyanolyan súlyos, de tegnap is szólt','rang 2'],['flame','Késői koffein','pihenőn','rang 3'],['sleep','Alvásadósság','alacsonyabb súlyosság','rang 6']].map(l=>r({icon:l[0],title:l[1],sub:l[2],right:st(l[3])})).join('')+note('Egy kártya naponta: itt az is látszik, mi ellen nyert.'),{i:2})}`)}

/* ═════════ DIAGNÓZIS ═════════ */
const ASKS=[['Miért vagyok fáradt?','Az alvásod, az edzéseid és az evésed két hetéből keresem az okot.'],['Miért alszom rosszul?','Az esti szokásaid és az alvásnaplód összevetése.'],['Miért mozog a súlyom?','Valódi változás vagy víz és só? Heti számvetéssel.']];
function diagnozis(){const busy=ST.dg==='busy';
  return P({title:'Diagnózis',sub:'Kérdések a csapatnak · 2 riport',back:'osszes'},`
  ${hero({lbl:'Kérdezd meg a csapatot',verdict:ASKS[0][0],sub:ASKS[0][1],left:bub('t-diagnose',{s:56}),body:drops([{k:busy?'half':'full',s:26,in:1},{k:'full',s:26,in:2},{k:'full',s:26,in:3}],busy?'egy kérdés épp úton van · napi 3 kérdés':'napi 3 kérdés · a megnyitás mindig ingyen'),acts:mb(busy?'A két hét adatait olvasom…':'Kérdezd meg most','dg:'+(busy?'idle':'busy'))})}
  ${sec(1,'Más kérdések',1)}
  ${card(ASKS.slice(1).map(a=>row({icon:'t-spark',title:a[0],sub:a[1],on:{toast:'Kérdés feltéve — a riport készül'}})).join('')
    +`<div class="fh-row off"><span class="g"><strong>Kell most deload?</strong></span>${st('hamarosan')}</div><div class="fh-row off"><span class="g"><strong>Havi Mezo-riport</strong></span>${st('hamarosan')}</div>`
    +note('kérdés → gyanúsítottak bizonyítékkal → próba · napi 3 kérdés · a megnyitás mindig ingyen'),{i:1})}
  ${sec(2,'Korábbi riportok · 2',2)}
  ${card([['1','Aug 30','Miért vagyok fáradt?','A fáradtság mögött leginkább a rövid alvás áll.','2 gyanúsított · a legerősebb: Alváshiány (erős)'],['2','Szept 7','Miért mozog a súlyom?','A súlyod valóban csökken, a napi ugrálás víz.','2 gyanúsított · a legerősebb: Víz-visszatartás (erős)']].map(q=>row({icon:'t-gem',title:q[2],sub:`${q[1]} · ${q[3]} ${q[4]}${conf(55,'bizonyosság','mérsékelt')}`,on:'diag.'+q[0]})).join(''),{i:2})}`)}
const DIAG={1:{q:'Miért vagyok fáradt?',win:'Aug 17 – 30 · az utolsó 14 nap adatából',v:'A fáradtság mögött leginkább a rövid alvás áll; a késői edzések csak rátesznek egy lapáttal.',s:[{n:'Alváshiány',st:'erős',c:'Az utóbbi két hétben átlagosan egy órával kevesebbet aludtál, mint előtte.',ev:[['alváshossz','6,1 h','↓ 1,2','Alvás-napló · 13 nap'],['éjszakai ébredés','3,4','↑ 1,1','Alvás-napló · 13 nap']],pr:['7 nap','Feküdj le hét estén át 23:00 előtt, és figyeljük a reggeli energiádat.']},{n:'Késői edzés',st:'mérsékelt',c:'A 19:00 utáni edzések utáni éjszakák 25 perccel rövidebbek.',ev:[['esti edzés','4 alkalom','','Edzésnapló · 14 nap'],['alvás utána','5,7 h','↓ 0,6','Alvás-napló · 4 éj']],pr:['14 nap','Két hétig tedd a nehéz napokat 18:00 elé.']}]},
  2:{q:'Miért mozog a súlyom?',win:'Aug 31 – Szept 6 · heti számvetés',v:'A súlyod valóban csökken; a napi ugrálás a só és a víz, nem a zsír.',szam:[['valódi változás','−0,7 kg'],['heti átlag','82,4 kg'],['előző hét','83,1 kg'],['víz-zaj','± 0,9 kg']],s:[{n:'Víz-visszatartás',st:'erős',c:'A sósabb napok után reggel 0,6–0,9 kg-mal többet mutat a mérleg.',ev:[['sóbevitel','5,8 g','↑ 1,4','Fuel · 7 nap'],['reggeli súly','+0,8 kg','↑','Súlynapló · 3 reggel']],pr:['7 nap','Egy hétig tartsd a sót 4 g alatt, és nézzük a reggeli súlyt.']},{n:'Kalória-deficit',st:'mérsékelt',c:'Átlagosan napi 420 kcal-lal a karbantartás alatt eszel.',ev:[['napi átlag','2 180 kcal','↓ 420','Fuel · 7 nap']],pr:['7 nap','Maradj ennél, és figyeljük a heti átlagot.']}]}};
function diag(id){const d=DIAG[id]||DIAG[1];
  return P({title:d.q,sub:`Riport · ${d.win}`,back:'diagnozis'},`
  ${hero({lbl:'A csapat válasza',verdict:d.v,sub:'Mérsékelt bizonyosság · azóta új adatod érkezett a riport ablakában.',body:flowG(d.s.map(s=>({l:s.n,p:s.st==='erős'?86:52})),{l:'a kérdés',v:id==2?'súly':'fáradt',s:'miért?',p:66},d.s.map(s=>({l:`Próba · ${s.pr[0]}`,dash:1})))+gcap('Balra a gyanúsítottak — a szint a bizonyíték ereje. Jobbra a próba, amivel kiderül.')+conf(55,'bizonyosság','mérsékelt')})}
  ${d.szam?sec(1,'Számvetés',1)+card(grid(d.szam.map(q=>stat({k:q[0],n:q[1]}))),{i:1}):''}
  ${sec(d.szam?2:1,'Gyanúsítottak · erősség szerint',2)}
  ${d.s.map((s,i)=>card(`${lab(`${i+1}. gyanúsított`,st(s.st,s.st==='erős'?'warn':'q'))}${h3(s.n)}${txt(s.c)}${lvl(s.st==='erős'?86:52,s.st==='erős'?'var(--warn)':'var(--dom)',10).replace('class="fl-level"','class="fl-level" style="margin-top:10px"').replace('style="margin-top:10px" style="','style="margin-top:10px;')}
    <div style="margin-top:12px">${s.ev.map(e=>row({title:e[0],sub:e[3],v:`${e[1]}${e[2]?` <small style="color:var(--${s.n==='Kalória-deficit'?'ok':'bad'});font-weight:700">${e[2]}</small>`:''}`})).join('')}</div>
    <div style="margin-top:12px">${row({icon:'t-flask',title:`Próba · ${s.pr[0]}`,sub:s.pr[1]})}</div>
    <div class="mz-v">${i===0&&ST.probe?lk('Aktív kísérlet lett, a Kísérletek oldalon követed ›',{go:'kiserletek'}):i===0?mb('Próbáljuk ki','probe','sm'):ct('Próbáljuk ki','Elindítva: aktív kísérlet lett')}</div>`,{i:i+2})).join('')}`)}

/* ═════════ KARAKTER-NAPLÓ ═════════ */
const FEED=[{k:'deru',t:'A reggeli mérések három hete <b>makulátlanul pontosak</b> — ez ritka fegyelem.',d:'ma · 06:12'},{k:'mocor',t:'A tegnapi kihagyott logolást ma reggelre már pótoltad — ez a minta ismerős nálad.',d:'ma · 07:40'},{k:'mezo',t:'Vasárnapi konzílium: <b>2 új állítás</b> · 1 portré átírva',d:'tegnap',conf:1},{k:'mocor',t:'A tegnapi teremedzésen <b>minden RIR-cél 1-en belül</b> teljesült.',d:'tegnap'},{k:'mezo',t:'Portré frissült: Alvás &amp; regeneráció — a hétvégi eltolódás mostantól „biztos” szintű állítás.',d:'aug. 29.',conf:1}];
function naploState(h){const o={title:'Karakter',sub:'Mezo · egyre jobban ismerünk',back:'osszes'};
  if(h==='ki')return P(o,hero({lbl:'Karakter-dosszié',verdict:'A karakter-dosszié jelenleg nem elérhető.',sub:'Ez nem hiba, csak a funkció ki van kapcsolva. A napló, az edzés és a Fuel változatlanul működik.',body:dimRack(54,false,true)}));
  if(h==='indul')return P(o,`${hero({lbl:'Az első lépés',verdict:'Kezdjük el a dossziét.',sub:'A csapat elolvassa a teljes eddigi történetedet — és felépíti az első portrékat.',body:forms(FIVE.map(id=>({id,p:5,l:'vár',on:{toast:nm(id)+' még nem kezdte el'}})))+gcap('Öt üres edény — az olvasás tölti fel őket.'),acts:btn('Kezdjétek el',{go:'naplo.fut'})})}
    ${sec(1,'Mit olvasnak el?',1)}${card(txt('Napi összegzőket, mintákat, tényeket, heti áttekintéseket, naplóbejegyzéseket olvasnak.'),{i:1})}`);
  if(h==='fut')return P(o,`${hero({lbl:'A csapat olvas',verdict:'Gyűjtjük, amit rólad tudni érdemes…',sub:'Ez pár percig tart; közben nyugodtan használd az appot.',body:fore({p:34,v:'34%',l:'gyűjtjük…',h:118}),acts:lk('(prototípus: ugrás a végére)',{go:'naplo.kesz'})})}
    ${sec(1,'Most éppen',1)}${card([['deru','A Közérzet a súlytrendet olvassa…'],['mocor','A Mozgás a logolási mintákat nézi…'],['mezo','Mezo az életeseményeket rendezi…'],['szk','A Szkeptikus ellenőriz…'],['mezo','Mezo összegzi a portrékat…']].map(([id,t],i)=>row({left:W(id,32),title:t,right:i<2?st('kész','ok'):i===2?st('most','plan'):st('vár')})).join(''),{i:1})}`);
  if(h==='kesz')return P(o,hero({lbl:'Kész',verdict:'A dossziéd elkészült.',sub:'7 dimenzió, kezdő állításokkal — mindegyik forrással. Ez csak a kezdet: minden héten tovább finomodik.',body:rack(DIMS.slice(0,7).map((d,i)=>({p:16+((i*7)%11),c:MC(d.o||'mezo'),l:DSH[i],top:W(d.o||'mezo',20)})),{h:64,cls:'tiny'})+gcap('Hét témakör, hét edény — egyelőre épp csak az aljuk nedves.'),acts:btn('Nézd meg az első konzíliumot',{go:'konzilium'})}));
  return P(o,hero({lbl:'Még korai',verdict:'Még nincs elég történet.',sub:'A csapat pár nap logolás után kezd — addig nincs mit összegezni. Ez nem hiba, csak még korai.',body:dimRack(54,false,true),acts:btn('‹ vissza',{go:'naplo'},'ghost')}))}
function naplo(arg){if(arg)return naploState(arg);const list=FEED.map((p,i)=>[p,i]).filter(([p])=>ST.ff==='Minden'||(ST.ff==='Következtetések'?p.conf:ST.ff==='Megfigyelések'?!p.conf:false));
  return P({title:'Karakter',sub:'Mezo · egyre jobban ismerünk',back:'osszes'},`
  ${hero({lbl:'A csapat történetei · ma',verdict:'Rólad beszélgettünk. Most te jössz.',sub:'Az Alvás szerint a hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik. A Mozgás szerint ez inkább program, mint alvás. A Szkeptikus meghagyta, Mezo elfogadta…',left:minis(['szunya','deru','mocor']),body:drops(FEED.map(q=>({k:q.conf?'half':'full',c:MC(q.k),s:24,t:q.d})),'5 friss csepp: teli a megfigyelés, fél az összegzés — a gazdája színében')+note('3 terület · 3 szakértői hozzászólás').replace('margin-top:10px','margin-top:6px'),acts:btn('Belenézek a beszélgetésbe',{go:'konzilium'})})}
  ${sec(1,'Friss',1)}
  ${card(row({icon:'t-tick',title:'Elkészült a csapat napi beszélgetése.',sub:'Feldolgozott adatok: aug. 30-ig. · 3 terület · 3 hozzászólás',on:'konzilium'}),{i:1})}
  ${sec(2,'Bejegyzések',2)}
  ${card(pg([['Minden','Minden'],['Megfigyelések','Megfigyelések'],['Beszélgetések','Beszélgetések'],['Következtetések','Következtetések']],ST.ff,'ff'),{i:2})}
  ${list.length?list.map(([p,i])=>card(`${lab(p.conf?'Összegzés':'Megfigyelés')}${say(p.k,p.t,`${p.d} · ${p.conf?'a csapat összegzése':AREA[p.k]}`)}
    ${p.conf&&i===2?`<div style="margin-top:14px">${lab('3 szakértői hozzászólás')}${cmt('deru','A pulzusvariancia is ezt a két napot mutatja gyengébbnek.','Támogatja')}${cmt('mocor','Szerintem ez nem alvás, hanem hétvégi program.','Vitatja')}${cmt('szk','Hat hét adat, konzisztens.','Meghagyta')}${cmt('mezo','Bekerül a dossziéba, a Szkeptikus érvét fogadom el.','Elfogadta')}</div>
      <div class="mz-v">${ct('Mi változott?','Mi változott? — a dialógus a megvalósításban él')}${cm('Hasznos',`mfb:c${i}:up`,ST.mfb['c'+i]==='up')}${cm('Nem így érzem',`mfb:c${i}:down`,ST.mfb['c'+i]==='down')}</div>`:''}
    <div class="mz-v">${cs('Miből látszik?','evidence')}${cs('Válaszolok','reply')}${p.conf?chip('Beszélgetés ›','data-go="konzilium"'):''}${more()}</div>${reply()}`,{i:Math.min(i+3,8)})).join('')+card(acts(lk('Korábbi bejegyzések',{toast:'+12 korábbi bejegyzés'})).replace('margin-top:14px','margin-top:0'),{i:8})
  :card(empty('t-journal','Egyelőre nincs friss megfigyelés ebben a nézetben.'),{i:3})}
  ${sec(3,'Mögötte',8)}
  ${card(row({icon:'t-gear',title:'Hogyan működik?',sub:'Források, megfigyelések és feldolgozás',on:'gepterem'})+row({icon:'t-council',title:'A csapat beszélgetései',sub:'Korábbi tanácskozások és döntések',on:'konzilium'}),{i:8})}`)}

/* ═════════ EMLÉKEK · MEMOÁR ═════════ */
function emlekek(){return P({title:'Emlékek',sub:'Mezo · a te történeted',tab:'emlekek'},`
  ${hero({lbl:'A heted története · szept. 15–21.',verdict:'Apró fordulatok.',sub:'Nem egy nagy elhatározás — egy korábban lezárt este, egy meccs, és egy mondat, amit végre leírtál. Mezo meséli, négy rövid lépésben.',body:rack([['H','15',1],['K','16',2],['Sze','17',0],['Cs','18',3],['P','19',1],['Szo','20',2],['V','21',3]].map(([d,n,src])=>({p:src/3*100,dash:!src,v:n,l:d,cls:n==='21'?'now':'',on:src?'nap.'+n:{toast:'Ezen a napon nem született emlék'},aria:`${d} ${n}. · ${src?src+' forrásból':'nincs emlék'}`})),{h:70,cls:'days'})+gcap('A heted hét edénye: a szint, hány forrásból állt össze a nap emléke. Koppints egy napra.'),acts:btn('Olvasom',{go:'memoar'})+lk('Archívum · 6 fejezet',{go:'archivum'})})}
  ${sec(1,'Napi emlékek · éjszakai összefoglalók',2)}
  ${card(row({icon:'t-moon',title:'Meccs, korai vacsora — és a legjobb éjszakád a héten',sub:'Vasárnap · szept. 21. · 3 forrásból · a kísérlet egyik találat-napja',on:'nap.21'})
    +row({icon:'t-sun',title:'Lassú reggel, hosszú séta',sub:'Szombat · szept. 20. · 2 forrásból',on:'nap.20'})
    +DAYS.map(d=>row({icon:'t-album',title:`${d[1]} ${d[2]}. · a nap története`,sub:d[3],on:'emlek'})).join(''),{i:2})}
  ${sec(2,'Hasonló napok keresése · mikor éreztem már így magam?',3)}
  ${card(search(),{i:3})}
  ${sec(3,'Tovább',4)}
  ${card(row({icon:'t-calendar',title:'Heti értékelés',sub:'az Én · Hét oldalán',on:{toast:'Heti értékelés — az Én területen'}})+row({icon:'t-layers',title:'Memória',sub:'rétegek és audit',on:'memoria'}),{i:4})}`)}
function emlek(){return P({title:'2026. augusztus 12.',sub:'Napi emlék · kedd',back:'emlekek'},`
  ${hero({lbl:'Mezo éjszakai összefoglalója',verdict:'Ez volt a hét legnyugodtabb éjszakája.',sub:'Erős pull-nap, korai lefekvés, 7 óra 40 perc alvás.',body:fore({p:88,v:'7:40',l:'óra alvás · a hét legjobbja',out:84,outL:'a célod: 7:30',h:124,c:MC('szunya')})+gcap('Az éjszaka edénye a cél vonala fölé telt.')})}
  ${sec(1,'A nap története',1)}
  ${card(`<div class="mz-prose"><p>Erős pull-nap volt: a Chest Supported Row 3×8-ra ment, és délután is maradt energia. A napló szerint a munka is jól haladt, és egyszer sem kellett kávé 14 óra után.</p><p>Este korán feküdtél, 7 óra 40 perc lett belőle, a reggeli pulzus is lejjebb ment. Ez volt a hét legnyugodtabb éjszakája.</p></div>${note('Mezo éjszakai összefoglalója a rögzített napodról.')}`,{i:1})}
  ${sec(2,'Lapozz',2)}
  ${card(`<div class="mz-pager"><button data-toast="2026-08-11"><small>‹ korábbi emlék</small><strong>2026-08-11</strong></button><button class="r" data-toast="2026-08-13"><small>következő emlék ›</small><strong>2026-08-13</strong></button></div><div style="margin-top:12px">${row({icon:'t-album',title:'Emlékek',sub:'összes nap',on:'emlekek'})}</div>`,{i:2})}`)}
/* memoár: vezetett, átugorható négy lépés — miért most → mi történt → miből íródott → hogy olvastad */
const MSTEPS=['Miért most','Mi történt','Miből íródott','Hogy olvastad?'];
function memoar(){const s=ST.mstep;
  const body=[
    card(say('mezo','Ez a hét nem a nagy elhatározásokról szólt. 📔 Vasárnap este leültem, és összeraktam a napi emlékeidből — négy rövid lépésben mesélem, mindegyiket átugorhatod.','a csapat · vasárnap este · a hét lezárult'),{i:1}),
    card(`<div class="mz-prose"><p class="drop">Kedden még úgy nézett ki, megint elúszik minden este — aztán csütörtökön <b>17 óráig megvolt a szénhidrát</b>, és a meccs végjátékában is maradt láb. Szombaton lassú reggel, hosszú séta.</p><p>Vasárnap pedig az történt, amire az Alvás hetek óta várt: <b>korai vacsora, 23 előtti lefekvés</b> — és a hét legjobb éjszakája. Ha a jövő hét is így megy, a vacsora-ügyben ki tudjuk mondani az első biztos mondatot.</p></div>`,{i:1}),
    card([['moon','Alvás-napló','vasárnap 7,4 — a hét legjobbja'],['bowl','Étkezés-napló','csütörtök · 80 g szénhidrát 17:00-ig'],['volley','Meccsnapok','csütörtök, vasárnap · találat'],['chat','Esti jegyzeteid','szombat · „nem történt semmi nagy — pont ez volt a jó”']].map(a=>r({icon:a[0],title:a[1],sub:a[2]})).join(''),{i:1}),
    card(txt('A következő fejezet ehhez a hanghoz igazodik.')+(ST.fb.memo?done(ST.fb.memo==='up'?'Jó volt így olvasni — jegyzem.':'Nem ilyen volt — ebből tanulok a legtöbbet.'):`<div class="mz-v">${mb('Talált','mfbm:up','sm')}${cm('Nem ilyen volt','mfbm:down')}</div>`),{i:1})
      +card(row({icon:'t-calendar',title:'Évforduló · 1 hónap',sub:'Egy hónapja kezdtük tudatosan korábbra tolni a vacsorát. Azóta 18 este sikerült.'})+row({icon:'t-scroll',title:'Archívum',sub:'a korábbi fejezetek · 6',on:'archivum'})+row({icon:'t-flask',title:'Ehhez a héthez tartozó ügy',sub:'Meccs előtti szénhidrát · találat-nap',on:'poszt.kiserlet'}),{i:2})][s];
  return P({title:'Apró fordulatok',sub:'Heti fejezet · szept. 15–21.',back:'emlekek'},`
  ${hero({lbl:`Mezo meséli · ${s+1} / 4`,verdict:['Ez a hét nem a nagy elhatározásokról szólt.','Kedden még elúszott az este — vasárnapra megfordult.','Négy naplódból állt össze a fejezet.','Hogy olvastad?'][s],sub:'Négy rövid lépés — mindegyiket átugorhatod.',left:WA('mezo',56),
    body:rack(MSTEPS.map((t,i)=>({p:i<s?100:i===s?52:0,dash:i>s,l:t,in:i+1,cls:i===s?'now':'',on:'m:mstep:'+i,sel:i===s})),{h:52,cls:'days'}),
    acts:(s<3?mb(s===0?'Mesélj':'Tovább','mstep:'+(s+1))+ml('Kihagyom ›','mstep:'+(s+1)):'')+(s>0?ml('‹ vissza','mstep:'+(s-1)):'')})}
  ${sec(s+1,MSTEPS[s],1)}
  ${body}`)}
const MCH=[['május 2026',[[20,'Máj 11 – 17','Egy hét, amikor a tested megtanult várni','Hétfőn még úgy indultál, mintha minden nap csúcsnap lenne. Szerdára a tested szólt.',6],[19,'Máj 4 – 10','Amikor az alvás előre szólt','Kedd éjjel 5,7 óra, és szerdán már a bemelegítésnél látszott, hogy ez nem az a nap.',5]]],['április 2026',[[18,'Ápr 27 – Máj 3','Az első közös korrekció','Ezen a héten először mondtad, hogy nem értesz egyet, és igazad lett.',4],[17,'Ápr 20 – 26','Lassabban, de tovább','A futások rövidültek, a hét mégis a legerősebb lett.',5],[16,'Ápr 13 – 19','A hét, amikor visszajött az étvágy','Három hét után először maradt el a délutáni nassolás.',3]]],['március 2026',[[15,'Márc 30 – Ápr 5','Az első fejezet','Még alig ismertük egymást. Ezen a héten kezdtük.',2]]]];
function archivum(){return P({title:'Minden fejezet',sub:'Memoár · archívum',back:'memoar'},`
  ${hero({lbl:'3 hónap közös történet',verdict:'6 fejezet készült eddig — hetente egy.',sub:'A legfrissebb: „Egy hét, amikor a tested megtanult várni”.',body:strata(MCH.map(([m,rows])=>({l:m,s:rows.map(c=>'hét '+c[0]).join(' · '),v:`${rows.length}<small>fejezet</small>`,on:'fejezet.'+rows[0][0],h:38+rows.length*12})),{cap:'ahogy leülepedett: legfelül a legfrissebb hónap'}),acts:btn('A legutóbbi fejezet',{go:'fejezet.20'})})}
  ${MCH.map(([m,rows],g)=>sec(g+1,`${m} · ${rows.length} fejezet`,g+1)+card(rows.map(c=>step({time:`hét ${c[0]}`,title:c[2],sub:`${c[1]} · ${c[4]} horgony · ${c[3]}${lvl(c[4]/6*100,'var(--dom)',7)}`,on:'fejezet.'+c[0]})).join(''),{i:g+1,cls:'mz-wide'})).join('')}`)}
function fejezet(id){const all=MCH.flatMap(c=>c[1]),k=Math.max(0,all.findIndex(c=>String(c[0])===String(id||19))),c=all[k],prev=all[k+1],next=all[k-1];
  return P({title:c[2],sub:`Heti memoár · hét ${c[0]} · ${c[1]} · 2026`,back:'archivum'},`
  ${hero({lbl:`Mezo meséli · hét ${c[0]}`,verdict:c[3],left:WA('mezo',56),body:rack([...all].reverse().map(w=>({p:w[4]/6*100,v:w[4],l:'hét '+w[0],in:'',cls:w===c?'now':'',sel:w===c,on:'fejezet.'+w[0]})),{h:56,cls:'days'})+gcap('Hat hét, hat edény: a szint, hány horgonyból (valódi adatpontból) íródott a fejezet.')})}
  ${sec(1,'A fejezet',1)}
  ${card(`<div class="mz-prose">${String(c[0])==='20'?`<p class="drop">Hétfőn még úgy indultál, mintha minden nap csúcsnap lenne. Szerdára a tested szólt: a guggolás nem ment, az alvás rövid volt, és a reggeli pulzus is feljebb kúszott.</p><p>Csütörtökön pihenőt tartottál, pedig a terv mást mondott. Pénteken jött a hét legjobb edzése: a Chest Row 102,5 × 9 új csúcs lett.</p><p>Ez volt az első hét, amikor a várás nem kimaradás volt, hanem döntés.</p>`:`<p class="drop">${c[3]} A hét elején még minden a terv szerint ment, aztán egy rövid éjszaka mindent átrendezett.</p><p>Ami ebből megmaradt: a tested előbb szól, mint a mérleg vagy a napló. Érdemes rá hallgatni.</p>`}</div>
    ${lab(String(c[0])==='20'?'Horgonyok':'Miből íródott')}${itags(String(c[0])==='20'?[['record','Chest Row 102,5 × 9'],['syringe','D1 reggel · pihenve'],['sleep','Alvás 7,8 h szombat']]:[['sleep','5,7 h kedd éjjel'],['dumbbell','Guggolás kimaradt'],['journal','Napló · szerda']])}
    <div class="mz-v">${ct('Talált','Köszi!')}${ct('Nem ilyen volt','Mi nem stimmelt?')}</div>`,{i:1})}
  ${sec(2,'Lapozz',2)}
  ${card(`<div class="mz-pager">${prev?`<button data-go="fejezet.${prev[0]}"><small>‹ előző</small><strong>Hét ${prev[0]}</strong>${prev[2]}</button>`:''}${next?`<button class="r" data-go="fejezet.${next[0]}"><small>következő ›</small><strong>Hét ${next[0]}</strong>${next[2]}</button>`:''}</div>`,{i:2})}`)}
function napemlek(id){const days={'21':['Vasárnap · szeptember 21.','Meccs, korai vacsora — és a legjobb éjszakád a héten','Délelőtt csend, délután bemelegítés — este pedig meccs. 🏐 A vacsora ezúttal <b>18:40-kor</b> lezárult, és bejött: az éjszakád <b>7,4-es</b> lett, a hét legjobbja. A kísérlet is találatot írt: a 4. szettben stabil maradt az ugrásod.',['alvás 7,4','vacsora 18:40','meccs · találat'],[[74,'t-moon','7,4','alvás'],[62,'t-bowl','18:40','vacsora'],[100,'t-volley','találat','meccs']]],'20':['Szombat · szeptember 20.','Lassú reggel, hosszú séta','Nem történt semmi nagy — és pont ez volt a jó benne. 🌤️ Két forrásból is nyugodt napnak látszik; a Közérzet szerint az ilyen szombatok tartják egyben a heted.',['séta 6,2 km','check-in: nyugodt'],[[62,'t-steps','6,2 km','séta'],[82,'t-heart','nyugodt','check-in']]]};const d=days[id]||days['21'];
  return P({title:d[0],sub:'Napi emlék',back:'emlekek'},`
  ${hero({lbl:'Mezo · a nap krónikája',verdict:d[1]+'.',sub:'A naplóidból íródott.',body:rack(d[4].map(([pp,i2,v,l])=>({p:pp,v,l,top:bub(i2,{s:32})})),{h:62,cols:3})+gcap('A nap edényei: amiből a krónika íródott.')})}
  ${sec(1,'A nap története',1)}
  ${card(say('mezo',d[2],'a csapat · a naplóidból')+tags(d[3]),{i:1})}
  ${sec(2,'Kapcsolódik',2)}
  ${card(row({icon:'t-flask',title:'Ehhez a naphoz tartozó ügy',sub:'Meccs előtti szénhidrát · találat-nap',on:'poszt.kiserlet'})+row({icon:'t-history',title:'Mikor volt még ilyen napom?',sub:'hasonló emlékek visszakeresése',on:{toast:'Hasonló napok keresése — a megvalósításban él'}}),{i:2})}`)}

/* ═════════ LAPOK (alulról) ═════════ */
const eb=t=>`<span class="mz-eb">${t}</span>`;
const SHEETS={
  menu:()=>`${eb('A poszt saját menüje')}<h2>Ehhez a bejegyzéshez</h2>${row({icon:'t-info',title:'Miből látszik?',sub:'bizonyíték',on:{toast:'Miből látszik?'}})}${row({icon:'t-history',title:'A téma története',sub:'idővonal',on:{toast:'A téma története'}})}${row({icon:'t-skip',title:'Ritkábban ilyet',sub:'a csapat tanul belőle',on:{toast:'Ritkábban ilyet — feljegyeztük'}})}`,
  reply:()=>`${eb('A te részed a történetben')}<h2>Elmesélem</h2>${txt('Mi az, amit csak te tudhatsz erről? A válaszod a témához kerül, és a csapat újraértékeli vele a képet.')}<textarea class="fh-in" rows="3" placeholder="Például: két este későig dolgoztam, azért csúszott a vacsora…"></textarea>${acts(mb('Válasz küldése','reply:send')+lk('Diktálom',{toast:'Diktálás'}))}`,
  'reply-falat':()=>`${eb('Késői vacsora · Étkezés ügye')}<h2>Elmesélem</h2>${txt('Mi az, amit csak te tudhatsz erről? Az Étkezés válaszol rá — ha konkrét okot mondasz (meccs, utazás, betegség), le is zárja az ügyet, és megjegyzi.')}<div class="mz-v">${cm('„10-kor ért véget a röpikupa…”','s7fill:10-kor ért véget a röpikupa, csak utána tudtam enni.')}${cm('„Nem volt kedvem főzni…”','s7fill:Nem volt kedvem főzni, csak később kaptam be valamit.')}</div><textarea class="fh-in" rows="3" id="s7ta" placeholder="Például: 10-kor ért véget a meccs, csak utána tudtam enni…"></textarea>${acts(mb('Válasz küldése','s7:send'))}`,
  evidence:()=>`${eb('Miből látszik? · 14 nap a naplóidból')}<h2>Rosszabbul alszol, ha későn vacsorázol?</h2>${txt('A 14 estéből, ahol vacsora-idő és alvás is rögzült: a <b>21 óra utáni</b> vacsorák másnapján az alvásod átlag <b>6,0 pont</b> — a korábbi vacsorák után <b>7,5</b>. Ez másfél pont különbség, és 11 nap szól mellette, 3 ellene.')}
    ${G_VACS()}${gcap('Alvás-átlag a késői és a korai vacsorák után.')}
    ${sub('Ami még hiányzik: a hétvége külön vizsgálata — addig a Szkeptikus nem enged kimondani semmit.')}${note('Ez együttjárás, nem bizonyított ok-okozat — ezért még nem került a rólad szóló képbe.')}${acts(btn('A napok egyenként',{go:'minta.vacsora'}))}`,
  mibol:t=>`${eb('Miből látom?')}<h2>${t||'Ez a tény'}</h2>${txt('Három forrásból áll össze: a naplóidból kimért napok, a te saját szavaid a beszélgetésekben, és a konzílium döntése. A legvastagabb ér a legerősebb forrás.')}${flowG([{l:'a naplód · 21 nap',p:100},{l:'te mondtad',p:60},{l:'konzílium · bekerült',p:80}],{l:'a tény',v:'21×',s:'visszaigazolva',p:82},[{l:'megy a chatbe'}])}${note('Ha nem stimmel, a lapon elhallgattathatod — a forrás megmarad, csak a társ nem használja.')}${acts(lk('A tény a Tudástárban ›',{go:'tenyek'}))}`,
  'elo-ev':()=>`${eb('Alvásadósság · ma 07:05-kor kapcsolt be')}<h2>Honnan jön a hiány?</h2>${big('2:10','óra hiányzik 3 éjszakából')}${txt('A célod éjszakánként <b>7 óra 30 perc</b>. Az utolsó három éjszakád ennyi volt — a hiányokat összeadtuk:')}${rack([['péntek',83,'6:55'],['szombat',80,'6:40'],['vasárnap',81,'6:45']].map(([l,pp,v])=>({p:pp,mark:90,v,l,c:MC('szunya')})),{h:84,cols:3})}${gcap('A vonal a cél (7:30) — mindhárom éjszaka alatta maradt.')}
    <div style="margin-top:12px">${[['péntek éjjel','6 ó 55 p','−35 p'],['szombat éjjel','6 ó 40 p','−50 p · becsült'],['vasárnap éjjel','6 ó 45 p','−45 p']].map(q=>row({title:q[0],sub:q[1],v:q[2]})).join('')}</div>
    ${sub('<b>Mikor zárul le?</b> Ha egy éjszaka eléri a célt, vagy a három napos hiány 1 óra alá megy. Akkor az Alvás szól — értesítés nélkül.')}${note('A mondatot a terület hangján írtuk meg, de csak ezek a számok szerepelhetnek benne. Ha az ellenőrzés elbukik, a nyers szabály-szöveg jelenik meg.')}${acts(lk('A motor naplója a Gépteremben ›',{go:'gepterem'}))}`,
  s8rec:()=>{const k=ST.s8rk,names=k==='1'?['dori','bence']:k==='3'?['dori']:['bence'];return `${eb('Emlékszem')}<h2>Ezt vettem elő a válaszhoz</h2>${names.map(n=>row({icon:'t-person',title:n==='dori'?'Dóri':'Bence',sub:S8R[n].join(' · ')})).join('')}${note('Csak azt veszem elő, amit a Tudástárban is látsz. Ha valamelyiket nem szeretnéd, ott elhallgattathatod vagy elfelejtheted.')}${acts(lk('Emberek a Tudástárban ›',{go:'kind.6'}))}`},
  s8all:()=>{const rest=['dori','self'].filter(id=>!['undone','no','gone'].includes(ST.s8[id])).map(id=>S8F[id]),n=rest.length;const title=n===1?'Ezt az egyet':n===2?'Ezt a kettőt':`Ezt a ${n} dolgot`,cta=n===1?'Elfelejtem':n===2?'Elfelejtem mind a kettőt':'Elfelejtem mindet';
    return `${eb('Mindent ebből a beszélgetésből')}<h2>${title} is elfelejtem</h2><ul>${rest.map(f=>`<li>${f.w?`<b>${f.w}</b> — `:''}${f.t}<small>${f.k==='prop'?'javaslat, még nem döntöttél róla':'22:05-kor jegyeztem meg'}</small></li>`).join('')||'<li>Ebből a fordulóból nincs mit elfelejteni.</li>'}</ul>${note('Végleges: nem használom többé, és ugyanebből nem tanulom meg újra. Amit máskor, máshol mondasz, azt továbbra is megjegyezhetem.')}${acts(mb(cta,'s8:allgo')+`<button class="fh-lk" data-close>Mégse</button>`)}`},
  picker:()=>`${eb('4 korábbi')}<h2>Beszélgetések</h2>${row({icon:'t-chat',title:'Új beszélgetés',on:'chat.empty'})}${[['Reggeli átnézés','ma · 06:32',1],['Röpi előtti evés','tegnap',0],['Váll és nyomások','szept. 21.',0],['Alvás és koffein','szept. 18.',0]].map(q=>`<div class="fh-row" data-go="chat.full" role="button"><span class="g"><strong>${q[0]}</strong><small>${q[1]}</small></span>${q[2]?st('ez'):''}<button class="mz-more" style="margin:0" data-sheet="actions" aria-label="Műveletek">···</button></div>`).join('')}`,
  actions:()=>ST.act==='rename'?`${eb('Beszélgetés')}<h2>Új név</h2><input class="fh-in" value="Reggeli átnézés" aria-label="Új név">${acts(btn('Mentés',{toast:'Átnevezve'})+ml('Mégse','act:menu'))}`
    :ST.act==='delete'?`${eb('Beszélgetés')}<h2>Törlés</h2>${txt('Biztosan törlöd? A beszélgetés és minden üzenete eltűnik, ezt nem lehet visszacsinálni.')}${acts(`<button class="btn" style="background:var(--bad);box-shadow:none" data-toast="Törölve">Törlöm</button>`+ml('Mégse','act:menu'))}`
    :`${eb('Beszélgetés')}<h2>Reggeli átnézés</h2><div class="fh-row" data-m="act:rename" role="button"><span class="si">${I('t-pencil')}</span><span class="g"><strong>Átnevezés</strong></span>${chev()}</div><div class="fh-row" data-m="act:delete" role="button"><span class="si">${I('t-trash')}</span><span class="g"><strong style="color:var(--bad)">Törlés</strong></span>${chev()}</div>`,
  archive:()=>`${eb('Konzílium · 9 korábbi tanácskozás')}<h2>Korábbi tanácskozások</h2>${dayl('2026 · augusztus')}${[['augusztus 30.','2 bekerült · 1 nyugdíjazva','heti',1],['augusztus 29.','nincs új következtetés','napi beszélgetés',0],['augusztus 23.','3 bekerült · 1 egyéb változás','heti',0],['augusztus 1.','23 állítás újramérlegelve','havi',0]].map(q=>`<div class="fh-row" data-close role="button"><span class="g"><strong>${q[0]}</strong><small>${q[1]}</small></span>${st(q[2]+(q[3]?' · ez':''),q[3]?'plan':'q')}</div>`).join('')}${dayl('2026 · július')}<div class="fh-row" data-close role="button"><span class="g"><strong>július 15.</strong><small>9 kezdő állítás</small></span>${st('bootstrap')}</div>`,
  filter:()=>`${eb('Minták')}<h2>Szűrés</h2>${dayl('Téma')}<div class="mz-v" style="margin-top:0">${['Mind','Alvás','Edzés','Fuel','Lélek','Test'].map((d,i)=>chip(d,`data-toast="Téma: ${d}"`,!i)).join('')}</div>${dayl('Sorrend')}<div class="mz-v" style="margin-top:0">${chip('Áttöréshez legközelebb','data-toast="Áttöréshez legközelebb"',true)}${chip('Téma szerint','data-toast="Téma szerint"',false)}</div>${acts(`<button class="btn" data-close>Alkalmazom</button>`)}`,
  hogyan:i=>{const [icn,q,a]=HOGYAN[+i||0];return `${eb(`Hogyan működik? · ${(+i||0)+1} / ${HOGYAN.length}`)}<h2>${q}</h2>${txt(a)}${acts((+i<HOGYAN.length-1?`<button class="btn" data-sheet="hogyan" data-arg="${+i+1}">Következő</button>`:`<button class="btn" data-close>Értem</button>`)+(+i>0?`<button class="fh-lk" data-sheet="hogyan" data-arg="${+i-1}">‹ előző</button>`:''))}`},
  'reply-done':()=>`${eb('Megvan — köszönjük!')}<h2>Így folytatódik</h2>${[['1','A válaszod a témánál marad','a te szavaiddal, forrásként megjelölve'],['2','A csapat újraértékel','megnézik, melyik magyarázatot erősíti vagy gyengíti. Ezt itt olvashatod majd.'],['3','Ha új tudás születik','külön megmutatjuk — te hagyod jóvá, mielőtt bekerül a rólad szóló képbe.']].map(s=>row({left:`<span class="mz-num">${s[0]}</span>`,title:s[1],sub:s[2]})).join('')}${acts(`<button class="btn" data-close>Rendben</button>`)}`
};

/* ═════════ KATTINTÁSOK (saját állapot) — a viselkedés a csepp/mezo.js-ével azonos ═════════ */
const ACT={
  vote:(a)=>{const [k,v]=a.split(':');ST.vote[k]=ST.vote[k]===v?'':v;soft();if(ST.vote[k])toast(v==='up'?'„Ez talál” — köszönjük, feljegyeztük.':'„Nem így érzem” — ebből tanulunk a legtöbbet. Írd meg válaszban is!')},
  pill:()=>{ST.pillUsed=true;ST.pill=false;const t=document.querySelector('#today');if(t)t.insertAdjacentHTML('afterbegin',`<article class="po rise">${ph('szunya','most · gyors jelzés')}<p class="txt">Láttam a tegnapi korábbi lefekvést — <b>23:05</b>! 🎉 Ha ma is összejön, az már hármas sorozat, és a hármas sorozat nálam a minta kezdete. Szurkolok — este halkan jelentkezem.</p>${acts('p-quick')}</article>`);document.querySelector('#mzpill')?.classList.remove('on');document.querySelector('#phone .scroll')?.scrollTo({top:0,behavior:'smooth'})},
  dontes:()=>{ST.dontes='yes';soft();toast('Bekerült. Bármikor visszavonhatod a Rólad oldalon.')},
  s7fill:(t)=>{const ta=document.querySelector('#s7ta');if(ta)ta.value=t},
  s7:(a)=>{if(a==='undo'){ST.s7.phase='undone';soft();toast('Visszavontam — nem jegyeztem meg, és az ügy újra nyitott.');return}
    const ta=document.querySelector('#s7ta'),v=ta?ta.value.trim():'';if(!v){toast('Írj pár szót — az Étkezés erre válaszol.');return}
    const concrete=/meccs|kupa|röpi|edzés|utaz|beteg|munk|dolgoz/i.test(v);ST.s7={phase:concrete?'typing':'moodTyping',text:v};closeSheet();soft();
    setTimeout(()=>{ST.s7.phase=concrete?'closed':'mood';soft();document.querySelector('#s7')?.scrollIntoView({behavior:'smooth',block:'center'})},still()?0:1800)},
  s7k:()=>{ST.s7k='done';soft();toast('Lezárva kivételként — egy csendes strigula a meccsnapra.')},
  s7r:(v)=>{ST.s7r=v;soft();toast(v==='keep'?'Marad a kivétel — újraindul a számolás.':'Kikapcsolva — a késői vacsorára újra szól.')},
  reply:()=>{const ta=document.querySelector('#sheet textarea');if(ta&&!ta.value.trim()){toast('Írj pár szót — ebből tanul a csapat.');return}openSheet(SHEETS['reply-done']())},
  rq:()=>{ST.rq='talal';soft();toast('Talál — megerősítetted, az Alvás benyomása erősödik')},
  rdec:(a)=>{const [id,v]=a.split(':');ST.rinb[id]=v;ST.redit='';soft();const x=INB.find(q=>q.id===id);toast(v==='keep'?(id==='c3'&&ST.chk?'Elmentve — a régi röplabda-tény kikapcsolva':x.merge?x.txt.keep:'Elmentve. A Tudástárban bármikor elhallgattathatod.'):(x.txt||TXT)[v])},
  redit:(id)=>{ST.redit=id;soft()},
  rsave:(id)=>{const f=document.querySelector('#phone textarea, #phone input');if(f&&f.value.trim())ST['rt_'+id]=f.value.trim();ST.rinb[id]='keep';ST.redit='';soft();toast('Pontosítva és elmentve')},
  chk:()=>{ST.chk=!ST.chk;soft()},
  fold:(k)=>{if(k==='s6all'){ST.s6all=!ST.s6all}else if(k==='wait'){ST.waitOpen=!ST.waitOpen}else if(k==='off'){ST.offOpen=!ST.offOpen}else if(k==='s9'){ST.s9open=!ST.s9open}else ST.fold[k]=!ST.fold[k];soft()},
  toff:(k)=>{ST.toff=ST.toff||{};ST.toff[k]=!ST.toff[k];soft();toast(ST.toff[k]?'Kikapcsolva — a társ nem látja':'Bekapcsolva')},
  s9back:(id)=>{ST.s9back[id]=!ST.s9back[id];soft();toast(ST.s9back[id]?'Visszakapcsoltam — újra külön használom':'Újra összevonva')},
  mfb2:(a)=>{const [i,v]=a.split(':');ST.fb[i]=v;soft();if(v==='no')toast('Rendben — a csapat nem viszi tovább')},
  mfb:(a)=>{const [i,v]=a.split(':');ST.mfb[i]=ST.mfb[i]===v?'':v;soft();if(ST.mfb[i])toast(v==='up'?'Köszönjük a visszajelzést.':'Mi nem stimmelt? pontatlan · túl sok · rossz időzítés · nem rólam szól')},
  mfbm:(v)=>{ST.fb.memo=v;soft()},
  fbv:(a)=>{const [k,v]=a.split(':');ST.fb[k]=ST.fb[k]===v?'':v;if(ST.fb[k]!=='down')ST.rsn[k]='';soft();if(ST.fb[k]==='up')toast('„Segített” — köszönjük.');if(ST.fb[k]==='down')toast('Mi nem stimmelt? Válassz egy okot.')},
  rsn:(a)=>{const i=a.indexOf(':'),k=a.slice(0,i),r=a.slice(i+1);ST.rsn[k]=r;soft();toast('„Nem talált · '+r+'” — ebből tanulunk.')},
  th:(id)=>{ST.th=ST.th===id?'':id;soft()},
  konz:(v)=>{ST.konz=v;soft()},src:(v)=>{ST.src=v;soft()},mem:(v)=>{ST.mem=v;soft()},ff:(v)=>{ST.ff=v;soft()},pred:(v)=>{ST.pred=v;soft()},ex:(v)=>{ST.ex=v;soft()},
  tf:(v)=>{toast('Szűrés: '+v)},ntab:(v)=>{toast(v==='u'?'Üzenetek':v==='e'?'Életjelek — a Nap területen':'Észrevételek — a Nap területen')},
  wk:()=>{ST.wk=!ST.wk;soft()},srch:()=>{ST.srch=ST.srch==='on'?'off':'on';soft()},
  bucket:(v)=>{ST.bucket=v;ST.ack='';soft()},
  mack:(v)=>{ST.ack=v;soft()},
  pdec:(a)=>{const [key,v]=a.split(':');K.go(`minta.${key}.${v}`);toast({megerositve:'Megerősítetted — beépül a rólad szóló képbe.',figyeljuk:'Figyeljük — tovább számolom, de nem tanulok belőle.',elvetve:'Elvetetted — befagy, többé nem hozom elő.'}[v])},
  xdec:(a)=>{const [key,v]=a.split(':');ST.xdec[key]=v;soft();toast(v==='aktiv'?'Elfogadtad — a kísérlet elindult.':'Elvetetted — nem indul belőle kísérlet.')},
  tools:()=>{ST.tools=!ST.tools;soft()},mems:()=>{ST.mems=!ST.mems;soft()},
  s8:(a)=>{const [act,id]=a.split(':'),S=ST.s8;
    if(act==='keep'){S[id]='kept';soft();toast('Elmentve — a Tudástárban bármikor elhallgattathatod.')}
    else if(act==='no'){S[id]='no';soft()}else if(act==='undo'){S[id]='undone';soft()}
    else if(act==='rec'){ST.s8rk=id;openSheet(SHEETS.s8rec())}
    else if(act==='me'){const on=ST.s8m[id]==='me';ST.s8m[id]=on?'on':'me';soft();toast(on?'Csak Dóri lapján marad.':'Rólad is megjegyeztem.')}
    else if(act==='mundo'){ST.s8m[id]='undone';soft()}
    else if(act==='allask'){openSheet(SHEETS.s8all())}
    else if(act==='allgo'){if(K.ARG!=='ures'){['dori','self'].forEach(k=>{if(S[k]!=='undone'&&S[k]!=='no')S[k]='gone'});S.all=true}closeSheet();soft();toast('Elfelejtve — ebből a beszélgetésből semmit nem tartok meg.')}},
  act:(v)=>{ST.act=v;openSheet(SHEETS.actions())},
  rule:(r)=>{ST.rule=ST.rule===r?'':r;soft()},card:(v)=>{ST.card=v;soft()},dg:(v)=>{ST.dg=v;soft()},probe:()=>{ST.probe=true;soft();toast('Elindítva: aktív kísérlet lett')},
  mstep:(n)=>{ST.mstep=Math.max(0,Math.min(3,+n));soft()}
};
ACT.pill=()=>{ST.pillUsed=true;ST.pill=false;const t=document.querySelector('#today');if(t)t.insertAdjacentHTML('afterbegin',post('szunya','alvás · most · gyors jelzés','Láttam a tegnapi korábbi lefekvést — <b>23:05</b>! 🎉 Ha ma is összejön, az már hármas sorozat, és a hármas sorozat nálam a minta kezdete. Szurkolok — este halkan jelentkezem.',votes('p-quick'),0));document.querySelector('#mzpill')?.classList.remove('on');document.querySelector('#phone .scroll')?.scrollTo({top:0,behavior:still()?'auto':'smooth'})};
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-m]');if(!b||F.D!=='mezo')return;
  const phn=document.querySelector('#phone');if(!phn||phn.dataset.v!=='feher'||!phn.contains(b))return;
  e.preventDefault();e.stopPropagation();
  const i=b.dataset.m.indexOf(':'),a=i<0?b.dataset.m:b.dataset.m.slice(0,i),arg=i<0?'':b.dataset.m.slice(i+1);
  if(ACT[a])ACT[a](arg,b);
},true);

let eloT=null,pillT=null;
function afterRender(route,arg){
  clearTimeout(eloT);clearTimeout(pillT);
  if(route==='elo'&&!arg&&!ST.eloDone)eloT=setTimeout(()=>{ST.eloDone=true;const l=document.querySelector('#live');if(l)l.innerHTML=DERU()},still()?0:4200);
  if((route==='fal'||route==='mai')&&!ST.pillUsed)pillT=setTimeout(()=>{ST.pill=true;document.querySelector('#mzpill')?.classList.add('on')},still()?600:9000);
}

ROUTES={mai:fal,fal,elo,'nap-uzenetek':napUzenetek,csapat,szoba,tud,ugyek,poszt,bizonyitek,elsonap,ikonok,ikonok9:ikonok,
  rolad:a=>rolad(false,a),'rolad-terv':()=>rolad(true),eletesemenyek,dimenziok,dimenzio,tudastar,tenyek,kategoriak,kind,hogyan,node,
  konzilium,gepterem,osszes,futasok,futas,adatforrasok,kor,detektorok,memoria,
  mintak,minta,elore,elorejelzesek,kiserletek,'kiserlet-oldal':kiserletOldal,
  chat,coaching,megfigyelo,kartya,diagnozis,diag,naplo,
  emlekek,emlek,memoar,archivum,fejezet,nap:napemlek};

const CSS2=`
& .fh-row + .fh-row{border-top:1px solid var(--hair);padding-top:12px}& .fh-row:not(:last-child){padding-bottom:12px}& .mz-fold:last-child{padding-bottom:0}
& .fh-hrow{gap:14px}
& .fh-art{width:72px;height:72px;right:12px;top:12px}& .fh-art svg.ic{width:72px;height:72px}& .fh-hero:has(.fh-art) .lbl{display:block;padding-right:80px}& .fh-hero:has(.fh-art) .verdict{padding-right:80px}
& .mz-nav>*{white-space:nowrap}
& .mz-sum{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;font-weight:650;color:color-mix(in srgb,var(--dom) 80%,var(--ink));text-align:left}
& .mz-by{display:inline-flex;align-items:center;gap:8px}
& .fh-hero .lbl .mz-by{text-transform:none;letter-spacing:0;font-size:12.5px}
& .mz-dim{opacity:.72}
& .mz-wide .fh-step time{min-width:74px;font-size:12.5px;line-height:1.3}
& .mz-a .b>p{font-size:14.5px;line-height:1.5;margin-top:6px}& .mz-a .b>.mz-v{margin-top:10px}
& .mz-end{background:transparent!important;box-shadow:none!important;text-align:center;padding-top:6px!important}& .mz-end .fh-note{margin:0}
& .fh-row small .bar{display:block;width:100%;margin-top:7px}
& .fh-step small .bar{display:block;margin-top:7px}
& .ds button i{font-style:normal}& .ds button.has i{color:var(--dom);font-weight:800}& .ds button.on i{color:#fff}
& .mz-kb + .fh-acts,& .mz-conf + .fh-acts{margin-top:10px}
& .fh-pill b{font-weight:800}
& .fh-seg button{min-width:0;overflow:hidden;text-overflow:ellipsis}
& .mz-foldb .fh-step:first-of-type{padding-top:0}
`.replace(/&/g,'.phone[data-v="feher"][data-d="mezo"]');

/* ══ FOLYADÉK · a Mezo-terület grafikái ══ */
const WVM=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 13' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q11.25 0 22.5 7 T45 7 T67.5 7 T90 7 V13 H0Z'/%3E%3C/svg%3E")`;
const MSK=sz=>`-webkit-mask:${WVM} repeat-x 0 0/${sz};mask:${WVM} repeat-x 0 0/${sz}`;
const CSS3=`
& .gcap{font-size:11.5px;line-height:1.4;color:var(--sub);margin-top:10px;text-align:center;text-wrap:balance}
& .fh-hero .gcap{margin-bottom:2px}
& .gfm{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;margin-top:16px}
& .gfm.six{grid-template-columns:repeat(6,minmax(0,1fr));margin-top:0}
& .gfm button{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;font-size:12px;font-weight:700;color:var(--ink)}
& .gfm .csepp{margin-bottom:3px}
& .gfm small{font-size:10px;font-weight:600;color:var(--sub);line-height:1.2;text-align:center;overflow-wrap:anywhere}
& .gfm .dot{position:absolute;top:-3px;left:calc(50% + 14px);width:12px;height:12px;border-radius:50%;background:var(--warn);box-shadow:0 0 0 2.5px #fff}
& .gfm .csepp .val b{font-size:calc(var(--s)*.27);font-weight:800}
& .gbig{position:relative;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin:16px 0 4px}
& .gbig .f{position:relative;display:block}
& .gbig .f i{position:absolute;border-radius:50%;background:color-mix(in srgb,var(--c) 26%,#fff);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.9),0 4px 8px -4px var(--c)}
& .gbig .b1{width:12px;height:12px;left:76%;top:-6px}& .gbig .b2{width:7px;height:7px;left:92%;top:14px}& .gbig .b3{width:9px;height:9px;left:8%;top:4px}
& .gbig .csepp .val small{font-family:var(--ff);font-size:10.5px;font-weight:700;letter-spacing:0;opacity:1;color:var(--ink)}
& .gbig .sc{display:flex;flex-direction:column;justify-content:space-between;height:104px;font-family:var(--mono);font-size:10px;color:var(--sub)}
& .gbig .sc em{font-style:normal;display:flex;align-items:center;gap:6px}& .gbig .sc em::before{content:'';width:12px;height:1px;background:var(--faint)}
& .gbig p{flex:1 1 100%;text-align:center;font-size:12px;line-height:1.4;color:var(--sub)}
& .gr{display:grid;gap:8px;margin-top:14px;align-items:end}
& .gv{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;text-align:center;color:var(--ink)}
& .gv .t{position:relative;display:block;width:100%;max-width:56px;border-radius:999px;overflow:hidden;background:linear-gradient(180deg,#fff,#F3FAFC);box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),inset 0 6px 12px -6px rgba(10,42,60,.14),0 12px 18px -14px var(--c)}
& .gv.dash .t{box-shadow:none;outline:1.5px dashed rgba(10,42,60,.22);outline-offset:-1.5px;background:rgba(255,255,255,.5)}
& .gv .t i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 58%,#fff),var(--c))}
& .gv .t i::before{content:'';position:absolute;left:0;right:0;top:-5px;height:6px;background:color-mix(in srgb,var(--c) 58%,#fff);${MSK('22px 6px')}}
& .gv .t u{position:absolute;left:4px;right:4px;border:1.5px dashed rgba(10,42,60,.6);border-radius:8px}
& .gv .t s{position:absolute;left:0;right:0;height:0;border-top:2px solid var(--ink);opacity:.75}
& .gv .t em{position:absolute;left:0;right:0;top:9px;font-style:normal;font-family:var(--mono);font-size:10px;color:var(--sub)}
& .gv b{font-family:var(--disp);font-size:15px;font-weight:800;letter-spacing:-.4px;line-height:1.05;overflow-wrap:anywhere}
& .gv small{font-size:10.5px;font-weight:600;color:var(--sub);line-height:1.2;overflow-wrap:anywhere}
& .gv.sel .t{box-shadow:inset 0 0 0 2.5px var(--c),0 12px 18px -12px var(--c)}& .gv.sel small{color:var(--ink);font-weight:800}
& .gv .fb{margin-bottom:1px}
& .gr.days{gap:5px;margin-top:12px}& .gr.days .gv .t{max-width:none;border-radius:13px}& .gr.days .gv small{font-size:10px}
& .gr.days .gv.now .t{box-shadow:inset 0 0 0 2px var(--c)}& .gr.days .gv.now small{color:var(--ink);font-weight:800}
& .gr.cat .gv small{font-size:9.5px}
& .gr.tiny{gap:4px}
.gpd-h{font-size:11px;font-weight:700;letter-spacing:.3px;color:var(--sub);margin:16px 0 -6px;text-align:left}
.gr.gpd{gap:3px}.gr.gpd .gv{display:flex;flex-direction:column;align-items:center;min-width:0}.gr.gpd .gv small{font-size:8.5px}
.gpd-v{font-style:normal;font-family:var(--disp);font-size:9.5px;font-weight:700;color:var(--ink);margin-bottom:2px;letter-spacing:-.3px}
.gr.gpd .gv.x .t{outline:1.5px dashed color-mix(in srgb,var(--ink) 55%,transparent);outline-offset:1px}
.gpd-l{font-size:10.5px;line-height:1.7;color:var(--sub);margin-top:8px;text-align:left}
.gpd-l i{display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--c);margin:0 4px 0 0;vertical-align:-1px}.gpd-l i:not(:first-child){margin-left:8px}
.gpd-l i.d{background:none;outline:1.5px dashed color-mix(in srgb,var(--ink) 55%,transparent)}& .gr.tiny .gv .t{max-width:none;border-radius:9px}
& .gc{display:block;width:100%;height:auto;overflow:visible;margin-top:12px;filter:drop-shadow(0 12px 12px color-mix(in srgb,var(--liq2) 20%,transparent))}
& .gc .sh{fill:#fff;stroke:rgba(10,42,60,.10);stroke-width:2}
& .gc .hi{fill:none;stroke:rgba(255,255,255,.9);stroke-width:3;stroke-linecap:round}
& .gc text{font-family:var(--ff);text-anchor:middle}
& .gc .v{font-family:var(--disp);font-size:18px;font-weight:800;letter-spacing:-.5px;fill:var(--ink)}& .gc .v.in{fill:#fff}
& .gc .l{font-size:10.5px;font-weight:700;fill:var(--ink)}& .gc .s{font-size:9.5px;fill:var(--sub)}& .gc .s.in{fill:rgba(255,255,255,.92)}
& .gc .cap{font-size:9.5px;font-weight:700;fill:var(--ink)}& .gc .cap2{font-size:9px;fill:var(--sub)}
& .gc .k{font-size:9.5px;font-weight:700;fill:var(--ink)}
& .gc .band{fill:rgba(255,255,255,.18);stroke:var(--ink);stroke-width:1.5;stroke-dasharray:4 4;opacity:.6}
& .gc .mk{stroke:var(--ink);stroke-width:2;opacity:.75}
& .gc .dt{fill:rgba(255,255,255,.8);stroke:rgba(10,42,60,.28);stroke-width:1}
& .gc .pp{fill:none;stroke:color-mix(in srgb,var(--liq2) 50%,#fff);stroke-width:5;stroke-linecap:round}& .gc .pp.d{stroke-dasharray:2 7;opacity:.7}
& .gc.sc{filter:none}& .gc.sc .dt{fill:var(--faint);stroke:none}& .gc.sc .last{fill:#fff;stroke:var(--liq2);stroke-width:3}
& .gc.sc .ax{font-size:9px;font-weight:600;fill:var(--sub)}& .gc.sc .ax[text-anchor="end"]{text-anchor:end}& .gc .gl{stroke:rgba(10,42,60,.07);stroke-width:1}
& .mz-kb .gc{margin-top:8px}
& .gs{position:relative;margin-top:14px;padding-top:18px;border-radius:28px;overflow:hidden;background:linear-gradient(180deg,#fff,#F3FAFC);box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),0 18px 26px -20px var(--liq2)}
& .gs .air{display:block;margin-top:-6px;padding:0 16px 16px;font-size:11px;font-weight:700;color:var(--sub)}
& .gs .l{--lc:color-mix(in srgb,var(--c) var(--k),#fff);position:relative;display:flex;align-items:center;gap:10px;width:100%;padding:8px 16px;background:var(--lc);text-align:left;color:var(--ink)}
& .gs .l.deep{color:#fff}
& .gs .l .k2-w{height:10px}
& .gs .l>span{flex:1;min-width:0}
& .gs .l strong{display:block;font-size:13.5px;font-weight:700;overflow-wrap:anywhere}
& .gs .l small{display:block;font-size:11.5px;line-height:1.3;opacity:.88}
& .gs .l>b{font-family:var(--disp);font-size:20px;font-weight:800;white-space:nowrap}
& .gs .l>b small{display:inline;font-family:var(--ff);font-size:11px;font-weight:600;margin-left:2px}
& .gs .l.cur{box-shadow:inset 4px 0 0 var(--ink)}
& .gs .l .csepp{flex:0 0 auto}
& .gf{position:relative;margin-top:14px;border-radius:30px;overflow:hidden;background:linear-gradient(180deg,#fff,#F3FAFC);box-shadow:inset 0 0 0 2px rgba(10,42,60,.07),0 18px 26px -20px var(--c)}
& .gf>i{--lc:color-mix(in srgb,var(--c) 52%,#fff);position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,var(--lc),var(--c))}
& .gf>i .k2-w{height:10px}
& .gf u{position:absolute;left:10px;right:34px;border:1.5px dashed rgba(10,42,60,.6);border-radius:12px;background:rgba(255,255,255,.14)}
& .gf u em{position:absolute;right:8px;top:5px;font-style:normal;font-size:10px;font-weight:700;color:var(--ink);background:rgba(255,255,255,.85);padding:1px 7px;border-radius:999px}
& .gf s{position:absolute;left:0;right:0;height:0;border-top:2.5px solid var(--ink)}
& .gf s em{position:absolute;left:12px;bottom:5px;font-style:normal;font-size:10.5px;font-weight:800;color:#fff;background:var(--ink);padding:2px 9px;border-radius:999px;white-space:nowrap}
& .gf q{position:absolute;right:10px;font-family:var(--mono);font-size:9.5px;color:var(--sub);transform:translateY(50%);quotes:none}
& .gf .n{position:absolute;left:18px;bottom:12px;color:#fff;line-height:1;text-shadow:0 4px 12px rgba(10,42,60,.25)}
& .gf .n.up{color:var(--ink);bottom:auto;top:14px;text-shadow:none}
& .gf .n b{font-family:var(--disp);font-size:40px;font-weight:800;letter-spacing:-1.8px}
& .gf .n small{display:block;font-size:11px;font-weight:700;margin-top:5px}
& .gds{display:flex;flex-wrap:wrap;align-items:center;gap:8px 7px;margin-top:12px}
& .gds>small{font-size:11.5px;color:var(--sub);flex:1 1 130px;line-height:1.35;margin-left:4px}
& .gd{position:relative;display:inline-grid;place-items:center;width:var(--s);height:var(--s);flex:0 0 auto;border-radius:0 50% 50% 50%;transform:rotate(45deg);margin:calc(var(--s)*.2) calc(var(--s)*.12) calc(var(--s)*.04);background:linear-gradient(135deg,color-mix(in srgb,var(--c) 50%,#fff),var(--c));box-shadow:5px 5px 10px -6px var(--c)}
& .gd.half{background:linear-gradient(135deg,#fff 52%,color-mix(in srgb,var(--c) 75%,#fff) 52%);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c) 70%,#fff)}
& .gd.empty{background:#fff;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c) 70%,#fff)}
& .gd.gone{background:transparent;box-shadow:none;outline:1.5px dashed rgba(10,42,60,.3);outline-offset:-1.5px}
& .gd i{transform:rotate(-45deg);font-style:normal;display:grid;place-items:center;font-family:var(--disp);font-size:calc(var(--s)*.42);font-weight:800;color:#fff;line-height:1}
& .gd.half i,& .gd.empty i,& .gd.gone i{color:var(--ink)}
& .gd svg.ic{width:calc(var(--s)*.6);height:calc(var(--s)*.6);filter:drop-shadow(0 2px 2px rgba(10,42,60,.25))}
& .gt{position:relative;height:88px;margin:18px 14px 0}
& .gt .ln{position:absolute;left:-14px;right:-14px;top:24px;height:7px;border-radius:4px;background:linear-gradient(90deg,var(--liq1),var(--liq2))}
& .gt>.k2-w{position:absolute;left:-14px;right:-14px;width:auto;top:14px;bottom:auto;height:11px}
& .gt .nw{position:absolute;top:6px;width:2px;height:36px;border-radius:1px;background:var(--ink);opacity:.45}
& .gt .p{position:absolute;top:2px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:3px}
& .gt .p .gd{margin:4px 0 14px}
& .gt .p b{font-family:var(--mono);font-size:10px;font-weight:600;color:var(--ink)}
& .gt .p small{font-size:10px;color:var(--sub);white-space:nowrap}
& .gt>em{position:absolute;top:36px;font-style:normal;font-family:var(--mono);font-size:9px;color:var(--faint)}& .gt>em.a{left:-10px}& .gt>em.b{right:-10px}
/* ikonok buborékban, szintek a sávok helyén */
& .mz-done{align-items:center}& .mz-quiet .gd{margin:2px 4px 0 2px}& .mz-quiet .gd svg.ic{filter:grayscale(.5)}
& .mz-reply{border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.08),0 8px 14px -12px var(--liq2)}
& .mz-conf .fl-level{flex:1;min-width:40px}
& .fh-row>.fl-level{width:72px;flex:0 0 auto}
& .fh-row small .fl-level,& .fh-step small .fl-level{display:block;width:100%;margin-top:7px}
& .fl-level i{min-width:8px}
& .fh-empty{display:flex;flex-direction:column;align-items:center;gap:10px}& .fh-empty .gv .t{width:40px}& .fh-empty p{font-size:14px;line-height:1.5}
& .mz-chip{background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.08)}
& .mz-chip[aria-pressed="true"]{color:#fff;background:linear-gradient(135deg,var(--liq1),var(--liq2));box-shadow:0 8px 14px -8px var(--liq2)}
& .mz-vs div,& .mz-tags span,& .mz-srcq,& .mz-refs,& .mz-pager button{background:color-mix(in srgb,var(--dom) 6%,#F4FAFC)}
& .mz-num{border-radius:50% 50% 50% 50%/62% 62% 38% 38%;width:24px;height:28px;color:#fff;background:linear-gradient(160deg,var(--liq1),var(--liq2))}
& .mz-me{background:linear-gradient(135deg,color-mix(in srgb,var(--liq1) 22%,#fff),color-mix(in srgb,var(--liq2) 16%,#fff));border-radius:20px 20px 6px 20px}
& .mz-tgl.on{background:linear-gradient(135deg,var(--liq1),var(--liq2))}
/* a chat: memória-cseppek, a beviteli sor a vízvonalon */
& .mz-mem{border-radius:20px;background:color-mix(in srgb,var(--dom) 6%,#F4FAFC);align-items:center}& .mz-mem .gd{margin:2px 6px 0 4px}
& .mz-mem.prop{background:color-mix(in srgb,var(--warn) 12%,#fff)}
& .mz-rec{padding:5px 12px 5px 6px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.08)}& .mz-rec .gd{margin:2px 4px 0 4px}
& .mz-comp button{border-radius:50%;background:radial-gradient(circle at 30% 24%,#fff 0 16%,color-mix(in srgb,var(--dom) 9%,#fff) 58%,color-mix(in srgb,var(--dom) 24%,#fff));box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.95),0 8px 12px -8px var(--liq2)}
& .mz-comp button.send{background:linear-gradient(135deg,var(--liq1),var(--liq2))}
& .fh-foot:has(.mz-comp){overflow:visible;background:rgba(255,255,255,.94)}
& .fh-foot:has(.mz-comp)::before{content:'';position:absolute;left:18px;right:18px;top:-9px;height:10px;background:color-mix(in srgb,var(--liq1) 55%,#fff);${MSK('44px 10px')}}
& .mz-bars i{background:linear-gradient(180deg,var(--liq1),var(--liq2))}
& .mz-reply .fb{flex:0 0 auto}& .mz-reply .fb + span{margin-left:2px}
& .fh-hero>.fh-acts .mz-chip{color:var(--ink)}& .fh-hero>.fh-acts .mz-chip[aria-pressed="true"]{color:#fff;background:var(--ink);box-shadow:none}
& .fh-hero>.fh-acts .mz-more{color:#fff}& .fh-hero>.fh-acts .mz-done{color:#fff;margin:0}& .fh-hero>.fh-acts .mz-today{color:rgba(255,255,255,.85);font-size:12.5px;font-weight:600}
& .gfm .csepp .liq,& .gbig .csepp .liq{opacity:.82}
& .gs .l.off{background:transparent;color:var(--sub);border-top:1.5px dashed rgba(10,42,60,.2)}
& .mz-wk2{display:flex;align-items:flex-end;gap:5px;height:72px;margin-top:12px}& .mz-wk2 span{flex:1;display:flex;align-items:flex-end;gap:2px;height:100%}
& .mz-wk2 i{flex:1;height:var(--h);border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,var(--liq1),var(--liq2))}& .mz-wk2 i.o{background:color-mix(in srgb,var(--ok) 60%,#fff)}
& .mz-leg{display:flex;gap:14px;margin-top:8px;font-size:11.5px;color:var(--sub)}& .mz-leg span{display:inline-flex;align-items:center;gap:6px}& .mz-leg i{width:10px;height:10px;border-radius:3px;background:var(--liq2)}& .mz-leg i.o{background:color-mix(in srgb,var(--ok) 60%,#fff)}
& .mz-arrow{font-size:11.5px;font-weight:700;color:var(--sub);margin:6px 0 10px}
& .mz-kv{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}& .mz-kv span{display:block;padding:7px 10px;border-radius:12px;background:color-mix(in srgb,var(--dom) 6%,#F4FAFC);font-size:11px;color:var(--sub)}& .mz-kv b{display:block;font-family:var(--disp);font-size:15px;color:var(--ink)}
& .mz-mf .gf{margin-top:10px;border-radius:20px}
& .mz-ms{padding-top:14px!important;padding-bottom:14px!important}
& .mz-tags.it span{display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 3px}
& .mz-lab .mz-by .gd{margin:0 4px 0 2px}
& .mz-a .b>.fh-lk{display:block;margin-top:6px;text-align:left}
& .fh-hero>.fh-acts .mz-bars i{background:#fff}
& .gc .cap,& .gc .cap2{paint-order:stroke;stroke:rgba(255,255,255,.9);stroke-width:3px;stroke-linejoin:round}
& .mz-steps{display:none}
& .mz-flow{display:none}
@media (prefers-reduced-motion:no-preference){
  body:not(.still) & .gc .gw{animation:mzgw 7s linear infinite}
  body:not(.still) & .gv .t i{animation:mzup 1.2s cubic-bezier(.2,.8,.2,1) both .15s}
  body:not(.still) & .mz-soft .gv .t i{animation:none}
  body:not(.still) & .gbig .f i{animation:mzbb 6s ease-in-out infinite}& .gbig .b2{animation-delay:1.5s!important}& .gbig .b3{animation-delay:3s!important}
}
@keyframes mzgw{to{transform:translateX(var(--dx))}}
@keyframes mzup{from{height:0}}
@keyframes mzbb{0%,100%{transform:translateY(0);opacity:.9}50%{transform:translateY(-7px);opacity:.5}}
`.replace(/&/g,'.phone.foly[data-s="elo"][data-d="mezo"]');

register('mezo',{title:'Mezo',
  tabs:[['Üzenőfal','mai'],['A csapat','csapat'],['Rólad','rolad'],['Emlékek','emlekek']],
  routes:ROUTES,sheets:SHEETS,after:afterRender,css:CSS+CSS2+CSS3,
  notes:`<h2>Mezo</h2>
<p><b>Mi változott most?</b> Minden oldal kapott egy saját, az adataiból rajzolt folyadék-grafikát: a csapat öt tagja maga az edény (a szint mindig azt mutatja, amit az oldal mér — mondanivaló, érettség, álláspont), a minták közlekedőedények (a cső vastagsága a kapcsolat ereje), az előrejelzés egy szint szaggatott „várt sávval” és az eredmény vízvonalával, a kísérlet két edény és a gyűlő napok sora, a gépezet csőrajz, az emlékezet rétegzett tartály. A kis köröket (gyűrűket) mindenhol szintek váltották, az ikonok buborékban ülnek. A tartalom és minden gomb megmaradt.</p>
<p><b>Üzenőfal</b> <a href="#w-mezo-mai">megnyitom</a>: a fő kártya azt mondja, hol várnak rád. Koppints a <i>Megnézem</i> gombra (a késői vacsora ügye), utána próbáld: Ez talál · Nem így érzem · Elmesélem. A csapat sorában bármelyik formára koppintva az oldalára jutsz. Kb. 9 mp után megjelenik az „1 új bejegyzés” jelzés.</p>
<p>Innen nyílnak: <a href="#w-mezo-elo">Élőben</a> (a Közérzet pár mp múlva beír; az Este résznél <i>Elmesélem</i> → az Étkezés válaszol) · <a href="#w-mezo-elo.kivetel">a következő alkalom</a> · <a href="#w-mezo-elo.felulvizsgalat">egy hónappal később</a> · posztok: <a href="#w-mezo-poszt.vacsora">vacsora-ügy</a>, <a href="#w-mezo-poszt.dontes">döntés</a>, <a href="#w-mezo-poszt.kiserlet">kísérlet</a>, <a href="#w-mezo-poszt.sejtes">sejtés</a>, <a href="#w-mezo-poszt.elorejelzes">lezárt előrejelzés</a> · <a href="#w-mezo-bizonyitek">Miből látszik?</a> · <a href="#w-mezo-elsonap">Az első nap</a> · <a href="#w-mezo-nap-uzenetek">a Nap beszélgetés-sora</a>.</p>
<p><b>A csapat</b> <a href="#w-mezo-csapat">megnyitom</a>: öt sor, mindegyik egy tag oldala (<a href="#w-mezo-szoba.szunya">Alvás</a>, <a href="#w-mezo-szoba.mocor">Mozgás</a>, <a href="#w-mezo-szoba.falat">Étkezés</a>, <a href="#w-mezo-szoba.deru">Közérzet</a>, <a href="#w-mezo-szoba.mezo">Mezo</a>). A tag oldalán: min dolgozik, hogyan érik a képe rólad, mit tud rólad (<a href="#w-mezo-tud.szunya">mind</a>), és mit tett félre (<a href="#w-mezo-ugyek.szunya">lezárt ügyek</a>). Lent: <a href="#w-mezo-konzilium">Konzílium</a> (Áttekintés / Beszélgetés, a szálak lenyithatók) és a <a href="#w-mezo-gepterem">Gépterem</a> → <a href="#w-mezo-osszes">Összes funkció</a>, <a href="#w-mezo-futasok">Futások</a>, <a href="#w-mezo-adatforrasok">Adatforrások</a>, <a href="#w-mezo-detektorok">Detektorok</a>, <a href="#w-mezo-memoria">Memória</a>.</p>
<p><b>Rólad</b> <a href="#w-mezo-rolad">megnyitom</a>: a fő kártya a csapat mondata rólad — <i>Talál</i> vagy <i>Pontosítom</i>. Alatta a döntésre váró javaslatok, kártyánként egy fő gombbal (próbáld a <i>Pontosítom</i>-ot is: helyben átírhatod). Lejjebb a számok, a tények, az életesemények. Mélyebben: <a href="#w-mezo-dimenziok">9 témakör</a> → <a href="#w-mezo-dimenzio.recovery">egy témakör</a> · <a href="#w-mezo-tudastar">Tudástár</a> → <a href="#w-mezo-tenyek">Tények</a> (kapcsolók, lenyitható fiókok), <a href="#w-mezo-kategoriak">Kategóriák</a>, <a href="#w-mezo-hogyan">Hogyan működik?</a> · <a href="#w-mezo-rolad-terv">minden javaslat kibontva</a>.</p>
<p><b>Emlékek</b> <a href="#w-mezo-emlekek">megnyitom</a>: a heted története (<a href="#w-mezo-memoar">Olvasom</a> — négy lépés, bármelyik átugorható), a napjaid sávja (<a href="#w-mezo-nap.21">vasárnap</a>), napi emlékek (<a href="#w-mezo-emlek">egy nap</a>), keresés hasonló napokra, <a href="#w-mezo-archivum">archívum</a> → <a href="#w-mezo-fejezet.19">egy fejezet</a>.</p>
<p><b>A motor oldalai</b> (az Összes funkcióból): <a href="#w-mezo-mintak">Minták</a> (hat edény állapot szerint — koppints egyre) → <a href="#w-mezo-minta.vacsora">egy minta</a> · <a href="#w-mezo-elorejelzesek">Előrejelzések</a> · <a href="#w-mezo-kiserletek">Kísérletek</a> · <a href="#w-mezo-chat">Beszélgetés Mezóval</a> (mit jegyzett meg, mit felejtett el) · <a href="#w-mezo-coaching">Coaching</a> → <a href="#w-mezo-kartya">a napi kártya</a> · <a href="#w-mezo-diagnozis">Diagnózis</a> · <a href="#w-mezo-naplo">Karakter-napló</a>.</p>
<p><b>Visszahozott állapotok</b> (az élő prototípusból): <a href="#w-mezo-rolad.ures">Rólad üresen</a> · <a href="#w-mezo-rolad.ki">kikapcsolt társsal</a> · <a href="#w-mezo-rolad.het">heti áttekintésből</a> · <a href="#w-mezo-naplo.indul">a dosszié indulása</a> → <a href="#w-mezo-naplo.fut">olvasás közben</a> → <a href="#w-mezo-naplo.kesz">elkészült</a> · <a href="#w-mezo-naplo.ures">még korai</a> · <a href="#w-mezo-konzilium.nincs">még nincs konzílium</a> · <a href="#w-mezo-elorejelzesek.ures">még nincs előrejelzés</a>.</p>
<p><b>Kérdés hozzád:</b> jó-e, hogy a csapat tagjai maguk az edények (a formájukban áll a szint), vagy inkább külön kémcsövek fölött üljenek? És nem sok-e, hogy a mintáknál a közlekedőedény a fő kép és alatta a pontfelhő is megmaradt?</p>`
});
})();
