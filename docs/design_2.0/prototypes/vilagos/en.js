/* vilagos/en.js — Én domain, "Folyadék" identity (see vilagos/README.md, last part). Built on window.F (kit.js + foly.js).
   Every route has its own liquid graphic drawn from that page's data; the living prototype (elo/en.html) is the floor for richness.
   Route names = the living prototype's. Trend-first: the smoothed trend is the headline, raw points are texture. */
(function(){
const {I,mchp,page,sec,card,head,hero,btn,lk,step,row,bar,stat,grid,facts,seg,pills,st,note,txt,msg,chev,act,register,
  tank,vials,mini,level,fill,area,linked,stream,bub,wave,uid}=F;
const E='.phone[data-v="feher"][data-d="en"]', Q='.phone.foly[data-s="elo"][data-d="en"]';
const S={period:'30d',swin:'7d',celv:'het',wk:0,dp:false,df:false,life:false,pf:'mind',tit:'letra',dec:'open',stn:-1};
const WAVE=`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 13' preserveAspectRatio='none'%3E%3Cpath d='M0 7 Q11.25 0 22.5 7 T45 7 T67.5 7 T90 7 V13 H0Z'/%3E%3C/svg%3E")`;
const mk=sz=>`-webkit-mask:${WAVE} repeat-x 0 0/${sz};mask:${WAVE} repeat-x 0 0/${sz}`, MASK=mk('14px 5px'), MASK2=mk('40px 6px');
const fmt=v=>v.toFixed(1).replace('.',',');
const cl=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const P=(o,inner,x)=>page('en',o,inner,x);
/* ── small domain helpers (kit anatomy; only what the kit lacks) ── */
const segE=(items,cur,key)=>`<div class="fh-seg">${items.map(([k,l])=>`<button class="${k===cur?'on':''}" data-ev="${key}:${k}">${l}</button>`).join('')}</div>`;
const nhero=(o,i=0)=>`<section class="fh-card fh-hero n ${o.warn?'warn':''} rise" style="--i:${i}">${o.art?`<span class="fh-art">${I(o.art)}</span>`:''}<span class="lbl">${o.lbl||''}</span><div class="fh-big en-hn">${o.n}${o.unit?`<small>${o.unit}</small>`:''}</div>${o.verdict?`<p class="verdict">${o.verdict}</p>`:''}${o.sub?`<p class="sub">${o.sub}</p>`:''}${o.body||''}${o.acts?`<div class="fh-acts">${o.acts}</div>`:''}</section>`;
const hart=n=>bub(n,{s:76,cls:'en-hart'});
const cells=a=>`<div class="en-cells">${a.map(([n,u,l,att])=>`<div class="${att?'att':''}"><b>${n}${u?`<i>${u}</i>`:''}</b><small>${l}</small></div>`).join('')}</div>`;
const fld=(l,v,ph)=>`${l?`<span class="fh-lab">${l}</span>`:''}<input class="fh-in" ${ph?`placeholder="${v}"`:`value="${v}"`} aria-label="${l||v}">`;
const ta=(l,v,ph)=>`${l?`<span class="fh-lab">${l}</span>`:''}<textarea class="fh-in en-ta" rows="3" ${ph?`placeholder="${v}"`:''} aria-label="${l||'Szöveg'}">${ph?'':v}</textarea>`;
const two=(a,b)=>`<div class="en-two"><div>${a}</div><div>${b}</div></div>`;
const tgl=(on,label)=>`<button class="en-tgl ${on?'on':''}" data-ev="tgl" aria-label="${label}"></button>`;
const d7=a=>`<span class="en-d7">${a.map(x=>`<i class="${x}"></i>`).join('')}</span>`;
const arr=a=>`<span class="en-arr ${a==='↗'?'up':a==='↘'?'dn':''}">${a}</span>`;
const leg=a=>`<div class="en-leg">${a.map(([c,t])=>`<span><i class="${c}"></i>${t}</span>`).join('')}</div>`;
const lab=t=>`<span class="fh-lab">${t}</span>`;
const quote=t=>`<p class="en-quote">${t}</p>`;
const ck=k=>`<span class="en-ck ${k}">${k==='gone'?'':I(k==='warn'?'i-warn':'i-check')}</span>`;
const chips=a=>`<div class="en-chips">${a.map(c=>Array.isArray(c)?`<span>${bub(c[0],{s:22})}${c[1]}</span>`:`<span>${c}</span>`).join('')}</div>`;
const emp=(icon,t,a='')=>`<div class="fh-empty en-emp">${bub(icon,{s:56})}${t}${a?`<div class="fh-acts" style="justify-content:center">${a}</div>`:''}</div>`;
const gl=(x,y,t,anchor='start')=>`<text class="gl" x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;
const curve=p=>{let d=`M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;for(let i=0;i<p.length-1;i++){const p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2;d+=` C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)} ${(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)} ${(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`}return d};
const save=(l,m)=>`<div class="fh-acts" style="justify-content:flex-end"><button class="btn sm ghost" data-close>Mégse</button><button class="btn sm" data-ev="save:${m}">${l}</button></div>`;
const shh=(icon,eb,h,s)=>`<div class="en-shh">${bub(icon,{s:52})}<div><small>${eb}</small><h2>${h}</h2>${s?`<p>${s}</p>`:''}</div></div>`;
const grad=(id,o1=.9,o2=.2)=>`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--liq1)" stop-opacity="${o1}"/><stop offset="1" stop-color="var(--liq2)" stop-opacity="${o2}"/></linearGradient>`;

/* ══════════ FOLYADÉK-GRAFIKÁK: az Én saját edényei (a közös készletre építve) ══════════ */
/* jar(p,{val,label,s,mark}) — a befőttes edény: egy cél / pontszám / szint szintje; `mark` = egy második vízvonal (előző hét, cél) */
const JAR='M24 5H76Q81 5 81 10V13Q81 17 77 19Q91 27 91 44V78Q91 95 74 95H26Q9 95 9 78V44Q9 27 23 19Q19 17 19 13V10Q19 5 24 5Z';
const jy=p=>95-cl(p)*.72;
const jar=(p,{val='',label='',s=96,c,c2,mark=null,p2=0,cls=''}={})=>`<span class="en-jar ${cls}" style="--s:${s}px">${fill(JAR,{p:5+cl(p)*.72,s,c,c2,
  inner:(p2?`<path d="M11 ${jy(p)}H89" stroke="#fff" stroke-width="1.2" opacity=".85"/>`:'')+(mark!=null?`<path d="M6 ${jy(mark)}H94" stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="3 3" opacity=".6"/>`:'')})}<span class="t"><b>${val}</b>${label?`<small>${label}</small>`:''}</span></span>`;
/* tubes([{l,v,p,p2,deep,r,c,ic,cap,cls,on,ev}],{h,cls,lines}) — kapszula-edények sora: a hét napjai, nyolc hét, célok, emberek.
   p = szint, p2 = felső (e heti) réteg, deep = sötét alsó réteg, r = [min,max] sáv, lines = közös vízvonal(ak) */
const tubes=(a,{h=92,cls='',lines=[]}={})=>`<div class="en-tubes ${cls}" style="--h:${h}px;grid-template-columns:repeat(${a.length},minmax(0,1fr))">${a.map(o=>{const tag=o.on||o.ev?'button':'div';
  return `<${tag} class="c ${o.cls||''}"${o.ev?` data-ev="${o.ev}"`:act(o.on)} style="--c:${o.c||'var(--dom)'}">${o.cap||''}${o.v!=null?`<em>${o.v}</em>`:''}<span class="t">${o.p!=null?`<i style="height:${cl(o.p)}%"></i>`:''}${o.p2?`<u style="bottom:${cl(o.p)}%;height:${o.p2}%"></u>`:''}${o.deep?`<b style="height:${o.deep}%"></b>`:''}${o.dot!=null?`<span class="d" style="bottom:${o.dot}%"></span>`:''}${o.r?`<span class="r" style="bottom:${o.r[0]}%;height:${o.r[1]-o.r[0]}%"></span>`:''}${lines.map(l=>`<s style="bottom:${l}%"></s>`).join('')}${o.ic?I(o.ic):''}</span>${o.l!=null?`<small>${o.l}</small>`:''}</${tag}>`}).join('')}</div>`;
/* lspark(values) — egy apró folyadék-szalag (hangulat-ív, heti súly) */
const lspark=(v,w=60,h=24,lo=Math.min(...v),hi=Math.max(...v))=>{const p=v.map((a,i)=>[i/(v.length-1)*w,h-4-(a-lo)/((hi-lo)||1)*(h-9)]),d=curve(p);
  return `<svg class="en-ls" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d} L${w} ${h} L0 ${h}Z"/><path class="ln" d="${d}"/></svg>`};
/* strata([[n,label,cls]]) — egy fekvő edény rétegekkel (a hét tónusa, a felfedezések típusai) */
const strata=a=>`<div class="en-strata">${a.filter(x=>x[0]).map(x=>`<i class="${x[2]||''}" style="flex-grow:${x[0]}"></i>`).join('')}</div><div class="en-leg">${a.filter(x=>x[0]).map(x=>`<span><i class="sq ${x[2]||''}"></i>${x[0]} ${x[1]}</span>`).join('')}</div>`;
/* stepsV(names,s) — a varázsló lépései mint sorban töltődő edények */
const stepsV=(names,s)=>tubes(names.map((n,i)=>({l:n,p:i<s-1?100:i===s-1?55:0,cls:i===s-1?'now':i>=s?'nd':''})),{h:34,cls:'steps'});
/* drain({start,cur,target,unit}) — az edény, ami a kezdősúlytól a célig apad: két vízvonal, köztük a mostani szint */
function drain({start=81.4,cur=78.4,target=73,w=150}={}){
  const id=uid('ed'),Y=v=>22+(start-v)/(start-target)*112,yc=Y(cur),yt=Y(target);
  return `<svg class="en-drain" viewBox="0 0 150 172" style="width:${w}px" role="img" aria-label="Súly: ${fmt(start)} → ${fmt(cur)} → ${fmt(target)} kg"><defs>${grad(id,1,1)}<clipPath id="${id}c"><rect x="8" y="6" width="64" height="160" rx="30"/></clipPath></defs>
    <rect x="8" y="6" width="64" height="160" rx="30" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="2"/>
    <g clip-path="url(#${id}c)"><rect x="8" y="${yt}" width="64" height="${166-yt}" fill="var(--liq2)" opacity=".22"/><rect x="8" y="${yc}" width="64" height="${yt-yc}" fill="url(#${id})"/>
      <path d="M8 ${yc} q8 -5 16 0 t16 0 t16 0 t16 0 V${yc+6} H8Z" fill="var(--liq1)"/><circle cx="54" cy="${(yc+yt)/2+6}" r="3.5" fill="#fff" opacity=".45"/><circle cx="30" cy="${(yc+yt)/2-10}" r="2.2" fill="#fff" opacity=".45"/></g>
    <path d="M4 ${Y(start)}H84" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="3 3" opacity=".45"/><path d="M4 ${yt}H84" stroke="var(--ink)" stroke-width="1.6" stroke-dasharray="3 3" opacity=".75"/>
    <text class="dl" x="90" y="${Y(start)+4}">${fmt(start)}<tspan class="ds" dx="4">start</tspan></text>
    ${cur<start?`<text class="dl big" x="90" y="${yc+6}">${fmt(cur)}<tspan class="ds" dx="4">most</tspan></text>`:''}
    <text class="dl" x="90" y="${yt+4}">${fmt(target)}<tspan class="ds" dx="4">cél</tspan></text></svg>`;
}
/* flowg(val,lo,hi,min,max) — az ütem mint áramlásmérő: a cső, benne a biztonságos sáv két vízvonala és a mostani ütem cseppje */
function flowg(val,plan,lo,hi,min,max){
  const X=v=>((v-min)/(max-min)*100).toFixed(1);
  return `<div class="en-flow ${val<lo||val>hi?'off':''}" role="img" aria-label="Ütem ${fmt(val)} kg/hét, biztonságos sáv ${fmt(lo)}…${fmt(hi)}"><div class="pipe"><i style="left:${X(val)}%;right:${(100-X(0)).toFixed(1)}%"></i><s style="left:${X(lo)}%;width:${(X(hi)-X(lo)).toFixed(1)}%"></s><u class="pl" style="left:${X(plan)}%"></u><b style="left:${X(val)}%"><em>${fmt(val)}</em></b></div>
    <div class="ax"><span style="left:0">${fmt(min)}</span><span style="left:${X(lo)}%">${fmt(lo)}</span><span style="left:${X(hi)}%">${fmt(hi)}</span><span style="left:${X(0)}%">0</span><span style="left:100%">+${fmt(max)}</span></div></div>`;
}
/* tap(rate) — a csap: az ütem mint kifolyó mennyiség */
function tap(){const id=uid('et');
  return `<svg class="en-tap" viewBox="0 0 120 104" aria-hidden="true"><defs>${grad(id,1,1)}<clipPath id="${id}c"><rect x="50" y="68" width="48" height="32" rx="12"/></clipPath></defs>
    <rect x="46" y="2" width="34" height="8" rx="4" fill="#fff" stroke="rgba(10,42,60,.14)" stroke-width="1.5"/><rect x="59" y="8" width="8" height="10" fill="#fff" stroke="rgba(10,42,60,.14)" stroke-width="1.5"/>
    <path d="M0 16H66a16 16 0 0 1 16 16v8H66v-6a4 4 0 0 0-4-4H0Z" fill="url(#${id})"/><path d="M0 19H64" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".5"/>
    <path d="M74 44c0 0-5 6-5 9.500a5 5 0 0 0 10 0C79 50 74 44 74 44Z" fill="var(--liq1)"/><path class="dr2" d="M74 57c0 0-3.500 4.500-3.500 7a3.500 3.500 0 0 0 7 0C77.500 61.500 74 57 74 57Z" fill="var(--liq2)" opacity=".7"/>
    <rect x="50" y="68" width="48" height="32" rx="12" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="2"/><g clip-path="url(#${id}c)"><path d="M50 84q6-4 12 0t12 0t12 0t12 0V100H50Z" fill="url(#${id})"/></g></svg>`;
}
/* surfacing(parts) — felszínre jövő buborékok: a hét nyomai típusonként, a méret a darabszám */
function surfacing(parts){
  const id=uid('es'),a=parts.filter(x=>x[0]),W=300,n=a.length,mx=Math.max(...a.map(x=>x[0]));
  return `<svg class="fh-chart en-surf" viewBox="0 0 ${W} 124" role="img" aria-label="${a.map(x=>x[0]+' '+x[1]).join(', ')}"><defs>${grad(id,.85,.35)}</defs>
    <path d="M0 62 q12.500 -8 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 V108 H0Z" fill="url(#${id})"/>
    ${a.map((x,i)=>{const cx=W/n*(i+.5),r=11+Math.sqrt(x[0]/mx)*17,cy=62-(x[0]/mx)*20+ (i%2?6:0);
      return `<circle cx="${cx.toFixed(1)}" cy="${(cy+r+16).toFixed(1)}" r="3" fill="#fff" opacity=".5"/><circle cx="${(cx+7).toFixed(1)}" cy="${(cy+r+26).toFixed(1)}" r="1.800" fill="#fff" opacity=".5"/>
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" fill-opacity=".86" stroke="var(--liq2)" stroke-opacity=".45" stroke-width="1.5"/><ellipse cx="${(cx-r*.34).toFixed(1)}" cy="${(cy-r*.42).toFixed(1)}" rx="${(r*.22).toFixed(1)}" ry="${(r*.12).toFixed(1)}" fill="#fff" transform="rotate(-28 ${(cx-r*.34).toFixed(1)} ${(cy-r*.42).toFixed(1)})"/>
      <text class="bn" x="${cx.toFixed(1)}" y="${(cy+r*.3).toFixed(1)}" text-anchor="middle" style="font-size:${(9+r*.42).toFixed(1)}px">${x[0]}</text>${gl(cx.toFixed(1),121,x[1],'middle')}`}).join('')}</svg>`;
}
/* w20(now,segs) — a 20 hetes ív húsz kis edényként; a szakaszok színezik */
const w20=(st)=>`<div class="en-w20">${Array.from({length:20},(_,i)=>`<i class="${st(i)}"></i>`).join('')}</div><div class="en-ruler">${Array.from({length:20},(_,i)=>`<span class="${i===7?'now':''}">${i+1}</span>`).join('')}</div>`;

/* ── adatok (az élő mock alapján) ── */
const DIM={er:['Érzelem','t-heart'],el:['Elmélyülés','t-book'],ka:['Kapcsolatok','t-people'],ert:['Értelem','t-compass'],te:['Teljesítmény','t-record'],eg:['Egészség','t-sprout']};
const GOALS=[
  {id:'hustle',t:'Side hustle',d:['te','el'],arrow:'↗',dots:['hit','hit','part','hit','miss','hit','hit'],ma:'2/3 ma',pct:64,wk:6},
  {id:'kocka',t:'Kockahas',d:['eg','te'],arrow:'→',dots:['hit','part','hit','hit','part','miss','hit'],ma:'3/5 ma',pct:71,wk:3},
  {id:'baratno',t:'Az utolsó barátnő',d:['ka','er'],arrow:'↗',dots:['hit','nd','hit','part','hit','hit','nd'],ma:'1/2 ma',pct:52,wk:5}];
const word=a=>a==='↗'?'emelkedik':a==='→'?'tartja':'figyelmet kér';
const TONE={jo:'Jó',ok:'OK',vegyes:'Vegyes',nehez:'Nehéz'};
const PEOPLE=[{id:'petra',n:'Petra',r:'Élettárs · Napi',t:'jo',w:3,all:41,sp:[6,8,7,9,8,9,10],cx:'közös program · család'},
  {id:'bence',n:'Bence',r:'Csapattárs · röpi',t:'nehez',w:2,all:14,sp:[8,7,7,5,4,4,3],cx:'edzés'},
  {id:'adam',n:'Ádám',r:'Mentee · Mizu Velünk',t:'ok',w:1,all:9,sp:[5,6,5,6,6,5,6],cx:'munka'},
  {id:'reka',n:'Réka',r:'Mentee · Mizu Velünk',t:'vegyes',w:1,all:7,sp:[6,5,7,4,6,5,5],cx:'munka · segítség'},
  {id:'mark',n:'Márk',r:'Mentee · Mizu Velünk',t:'ok',w:0,all:5,sp:[5,5,6,5,4,4,4],cx:'munka'},
  {id:'anyu',n:'Anya',r:'Család · Heti',t:'jo',w:1,all:12,sp:[7,7,8,7,8,8,8],cx:'család'}];
const av=(p,cls='')=>`<span class="en-av ${cls} ${p.t==='nehez'?'att':''}">${p.n[0]}</span>`;
const DAYSC=[['H',78],['K',72],['Sze',85],['Cs',null],['P',null],['Szo',null],['V',null]];
const dayTubes=(o={})=>tubes(DAYSC.map((d,i)=>({l:d[0],v:d[1]??(i===3?'ma':''),p:d[1]?d[1]:i===3?12:null,cls:d[1]?'':i===3?'now':'nd',on:o.on||{toast:`${d[0]}: A napom oldala (Nap)`}})),{h:o.h||74,cls:'week'});

/* ═══════════ HOL TARTOK ═══════════ */
const ELV={w:[82.2,81.9,82.0,81.4,81.1,80.6,79.9,80.2,79.7,79.3,78.9,78.4],s:[6.6,6.9,7.0,6.4,7.2,7.1,6.8,7.3,7.0,7.2,6.9,7.1],
  st:[[0,'Tempó átállítva','júl. 8.','Heti −0,4 kg-ra lassítottad a tempót, azóta egyenletes.'],[6,'Új mélypont · 80 kg alatt','aug. 19.','Először mértél 80 kg alatti heti átlagot.'],[8,'Új képesség: Páncélzat','szept. 2.','10 hét töretlen: a sérülésállóság nő.'],[11,'Új mélypont','szept. 24.','78,4 kg: a 12 hét legalacsonyabb átlaga.']]};
const ELVR=[82.2,81.6,81.0,80.4,79.8,79.2,78.4,77.6,76.5,75.4,74.1,72.9];
const elvSt=state=>state==='reached'?[ELV.st[0],ELV.st[1],ELV.st[2],[11,'Cél elérve','szept. 24.','72,9 kg: a célsáv alá értél.']]:ELV.st;
/* Életvonal: a heti átlagsúly mint apadó vízfelszín a cél vízvonala felé; az állomások bóják a felszínen */
function elvChart(state){
  const reached=state==='reached', proj=state==='proj', w=reached?ELVR:ELV.w, id=uid('ev');
  const W=300,H=124,x0=4,xp=W-30,x1=proj?xp-60:xp,lo=71.6,hi=82.8;
  const X=i=>x0+i*(x1-x0)/11, Y=v=>10+(hi-v)/(hi-lo)*(H-14);
  const p=w.map((v,i)=>[X(i),Y(v)]), last=p[11], ty=Y(73), d=curve(p);
  return `<svg class="fh-chart en-elv" viewBox="0 0 ${W} ${H+16}" role="img" aria-label="Életvonal: 12 hét, 82,2 → ${fmt(w[11])} kg${reached?'':', cél 73,0'}"><defs>${grad(id,.8,.28)}</defs>
    ${[82,79,76].map(v=>`<line x1="${x0}" x2="${xp}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" style="stroke:var(--hair)"/>${gl(W,(Y(v)+3).toFixed(1),v,'end')}`).join('')}
    <path d="${d} L${last[0].toFixed(1)} ${H} L${x0} ${H}Z" fill="url(#${id})"/>
    ${proj?`<path d="M${last[0].toFixed(1)} ${last[1].toFixed(1)} L${xp} ${ty.toFixed(1)} V${H} H${last[0].toFixed(1)}Z" style="fill:var(--liq2);opacity:.10"/><path d="M${last[0].toFixed(1)} ${last[1].toFixed(1)} L${xp} ${ty.toFixed(1)}" style="fill:none;stroke:var(--liq2);stroke-width:1.8;stroke-dasharray:2 5;stroke-linecap:round"/>`:''}
    <path d="${d}" style="fill:none;stroke:var(--liq2);stroke-width:2.6;stroke-linecap:round"/>
    <path d="M${x0} ${ty.toFixed(1)} q7 -3 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0" style="fill:none;stroke:var(--ink);stroke-width:1.2;stroke-dasharray:4 4;opacity:.55"/>${gl(W,(ty+3).toFixed(1),'cél','end')}
    ${elvSt(state).map((s,i)=>{const q=p[s[0]],x=q[0].toFixed(1),y=q[1].toFixed(1),on=S.stn===i;return `<g data-ev="stn:${i}" role="button" aria-label="${s[1]} · ${s[2]}" style="cursor:pointer"><circle cx="${x}" cy="${(q[1]-8).toFixed(1)}" r="14" style="fill:transparent"/>
      <path d="M${x} ${y} v-15 l8 3.500 -8 3.500" style="fill:${on?'var(--liq2)':'#fff'};stroke:var(--ink);stroke-width:1.3;stroke-linejoin:round"/><circle cx="${x}" cy="${y}" r="${on?6:4.6}" style="fill:${on?'var(--liq2)':'#fff'};stroke:var(--ink);stroke-width:1.4"/></g>`}).join('')}
    ${gl(x0,H+14,'júl. 8.')}${gl(X(6).toFixed(1),H+14,'aug. 19.','middle')}${gl(x1.toFixed(1),H+14,'szept. 24.','end')}
  </svg>`;
}
function elv(state){
  if(state==='empty') return card(head('t-trend','Életvonal · 12 hét')+emp('t-weight','Még kevés a mérés. Két mérés után rajzolódik ki az életvonalad.',btn('Mérj most',{sheet:'weight'},'sm ghost')),{i:3});
  const reached=state==='reached', sts=elvSt(state), s=sts[S.stn];
  return card(head('t-trend',`${reached?'−9,3':'−3,8'} kg · 12 hét`,'Test','test')
    +txt(`A 7 napos átlag most <b>${reached?'72,9':'78,4'} kg</b>. A felszín ${reached?'elérte a cél vízvonalát.':'a cél vízvonala felé apad.'}`)
    +`<div class="en-chart">${elvChart(state)}</div>
    <div class="en-slband" role="img" aria-label="Alvás, heti átlag: 6,4–7,3 óra">${ELV.s.map(h=>`<i><b style="height:${Math.round((h-5.6)/1.9*100)}%"></b></i>`).join('')}</div>
    ${leg([['ln','súly · heti átlag'],['bd','alvás · heti átlag 6,4–7,3 ó'],['st','állomás (bója)'],['pl','cél 73,0 kg']])}`
    +(s?`<div class="en-stn"><b>${s[1]} · ${s[2]}</b>${s[3]}</div>`:note('Koppints egy bójára a felszínen, és megmutatom, mi történt ott.'))
    +row({icon:reached?'t-flag':'t-target',title:reached?'Elérted a célod: 73,0 kg':state==='noproj'?'Vetítés még nincs':'A következő állomás: 73,0 kg',sub:reached?'A célok között találod a lezárást.':state==='noproj'?'Négy egyenletes hét kell hozzá.':'Még 5,4 kg van hátra.',on:reached?'celok':'sulycel'}),{i:3});
}
function hub(arg){
  const ures=arg==='ures', state=arg==='celelerve'?'reached':arg==='nincsvetites'?'noproj':ures?'empty':'proj';
  return P({title:'Én',sub:ures?'Daniel · az első napjaid':'Daniel · szept. 21–27.',tab:'mai'},`
  ${ures?hero({lbl:'Szept. 21–27. · az első heted',verdict:'Az első heti kép hétfő reggel érkezik.',sub:'Addig elég, ha naplózol: az edény magától telik.',left:jar(0,{val:'—',label:'hétfőn'}),acts:btn('A heted','het.fut')})
   :tank({pct:78,num:78,cap:'/ 100 · +4 a múlt héthez',lbl:'Szept. 21–27. · lezárt hét',verdict:'Az egyensúly hete.',marks:['75','50','25'],cta:'A heti elemzés',ctaAct:'het'})}
  ${sec(1,ures?'A hét napjai':'A hét hét napja',1)}
  ${card((ures?tubes(DAYSC.map((d,i)=>({l:d[0],cls:i===3?'now':'nd',p:i===3?8:null})),{h:74,cls:'week'})+note('Egy nap egy edény: ahogy naplózol, úgy telik. Hétfőn jön az első heti kép.')
    :dayTubes({on:'napok'})+`<div class="en-wkl"><p><i class="ok"></i><span><b>Jól ment:</b> fehérjecél öt napon, stabil alvás.</span></p><p><i class="wn"></i><span><b>Nézd meg:</b> két késői vacsora felszínes alvással.</span></p></div>`),{i:1})}
  ${sec(2,'Ami a héten mozdult',2)}
  ${card(vials(ures?[{l:'Súly',ic:'t-weight',p:0,v:'—',s:'két mérés után',on:{sheet:'weight'}},{l:'Alvás',ic:'t-sleep',c:'var(--info)',p:0,v:'—',s:'még nincs adat',on:'test.alvas'},{l:'Edzés',ic:'t-dumbbell',c:'var(--warn)',p:0,v:'—',s:'még nincs adat',on:{dom:'edzes'}},{l:'Fehérje',ic:'t-meat',c:'var(--protein)',p:0,v:'—',s:'még nincs adat',on:{dom:'fuel'}}]
   :[{l:'Súly trend',ic:'t-weight',p:80,v:'−0,4',s:'kg/hét · 78,6 átlag',mark:'−0,5',on:'test'},
     {l:'Alvás átlag',ic:'t-sleep',c:'var(--warn)',p:90,v:'7ó 19',s:'a cél alatt',mark:'7,5 ó',on:'test.alvas'},
     {l:'Edzések',ic:'t-dumbbell',c:'var(--info)',p:75,v:'3 / 4',s:'a múlt heti szinten',mark:'4',on:{dom:'edzes'}},
     {l:'Fehérje',ic:'t-meat',c:'var(--protein)',p:96,v:'212 g',s:'öt napon célon',mark:'200',on:{dom:'fuel'}}],{h:128})
    +note(ures?'Ahol még nincs adat, az edény üres marad, soha nem nulla.':'Az edény teteje a heti célod. Színt az kap, ami figyelmet kér: az alvás a 7,5 órás cél alatt maradt.'),{i:2,cls:'en-vc'})}
  ${sec(3,'Életvonal',3)}
  ${elv(state)}
  ${sec(4,ures?'Célok':'Célok állása',4)}
  ${card(ures?row({icon:'t-ring',title:'Első cél',sub:'Mezo pilléreket javasol hozzá',on:'celuj.1'})
   :row({icon:'t-weight',title:'Súlycél · 78,4 → 73 kg',sub:`−0,5 kg / hét · kb. 11 hét<br>${level(33,{h:14,val:'33%'})}`,on:'sulycel'})+GOALS.map(g=>row({icon:DIM[g.d[0]][1],title:g.t,sub:`${word(g.arrow)} · ${g.ma}<br>${d7(g.dots)}`,right:arr(g.arrow)+chev(),on:'cel'})).join('')+`<div class="fh-acts">${lk('Mind a 4 cél ›','celok')}</div>`,{i:4})}
  ${sec(5,'Fejlődés · Emberek',5)}
  ${card(row({icon:'t-up',title:ures?'Fejlődés':'Fejlődés · A kitartó · Lv 12',sub:ures?'Lv 1 · az első napjaid':`3 140 XP · 240 érme · 82% fegyelem · 6. hét ritmus<br>${level(12,{h:14,val:'420 / 3 500 XP'})}`,on:ures?'novekedes.ures':'novekedes'})
    +row({left:ures?'':`<span class="en-pile">${PEOPLE.slice(0,3).map(p=>av(p)).join('')}</span>`,icon:ures?'t-people':null,title:'Emberek',sub:ures?'':'Petra 3× e héten · 8 említés · Bence hangulata lejt',on:'emberek'})
    +note('Ahol még nincs adat, a sor csak a nevét mutatja, soha nem nullát. A rutinod a Nap · Rutin fülön épül.'),{i:5})}`);
}

/* ═══════════ CÉLOK ═══════════ */
const goalTubes=()=>tubes([{l:'Súlycél',v:'33%',p:29,p2:4,ic:'t-weight',on:'sulycel'},...GOALS.map(g=>({l:g.t,v:g.pct+'%',p:g.pct-g.wk,p2:g.wk,ic:DIM[g.d[0]][1],on:'cel'}))],{h:118,cls:'wide'});
function celok(arg){
  const ures=arg==='ures';
  const cnt=k=>ures?0:GOALS.filter(g=>g.d.includes(k)).length;
  return P({title:'Célok',sub:ures?'Én · még nincs aktív cél':'Én · 4 aktív · 1 parkol',tab:'celok'},`
  ${hero({lbl:ures?'Még nincs aktív életcélod':'Ezen a héten · 2↗ · 1→ · 0↘',verdict:ures?'Egy cél, két-három pillér. A többit a naplód hozza.':'Két cél emelkedik, egy tartja magát.',sub:ures?'Minden cél egy edény lesz: a pillérek töltik, a naplódból.':'Minden cél egy edény. A világos felső réteg az, amit <b>ez a hét</b> tett hozzá.',
    body:ures?tubes([{l:'Súlycél',cls:'nd',on:'sulycel.ures'},{l:'Első cél',cls:'nd',on:'celuj.1'},{l:'',cls:'nd'},{l:'',cls:'nd'}],{h:118,cls:'wide'}):goalTubes(),acts:btn('+ Új cél','celuj.1')})}
  ${sec(1,'Aktív célok',1)}
  ${card(ures?row({icon:'t-weight',title:'+ Súlycél',sub:'Tervezd meg a tempót',on:'sulycel.ures'})+row({icon:'t-ring',title:'+ Új cél',sub:'Mezo pilléreket javasol',on:'celuj.1'})
   :row({icon:'t-weight',title:'Súlycél · Egészség',sub:`Fogyás · 78,4 → 73 kg · −0,5 kg / hét · kb. 11 hét<br>${level(33,{h:14,val:'33%'})}`,on:'sulycel'})
    +GOALS.map(g=>row({icon:DIM[g.d[0]][1],title:g.t,sub:`${g.d.map(k=>DIM[k][0]).join(' · ')} · ${g.ma}<br>${d7(g.dots)}`,v:g.pct+'%',right:arr(g.arrow)+chev(),on:'cel'})).join('')
    +note('A hét kis edénye egy-egy nap: tele = teljesült, félig = részben, üres = kimaradt, szaggatott = nincs adat.'),{i:1})}
  ${sec(2,'Életterületek',2)}
  ${card(tubes(Object.entries(DIM).map(([k,d])=>({l:d[0],v:cnt(k),p:cnt(k)?cnt(k)*42:null,ic:d[1],cls:cnt(k)?'':'nd'})),{h:58,cls:'dims'})+note('Hat életterület, hat szint: annyira telik, ahány aktív célod épít rá.'),{i:2})}
  ${ures?'':sec(3,'Parkol és lezárt',3)+card(row({icon:'t-book',title:'Spanyol B2',sub:'parkol · Elmélyülés',right:btn('Vissza',{toast:'Újra aktív'},'sm ghost')})+row({icon:'t-sprout',title:'Félmaraton',sub:'kész · Egészség',right:st('kész','ok')}),{i:3})}
  ${sec(ures?3:4,'A célok mögött',4)}
  ${card(row({icon:'t-signal',title:'Jelek · mit figyel a rendszer',sub:'28 forrás · 19 él · 9 alszik',on:'jelek'})+note('Ami nincs naplózva, az nem nulla: az üres.'),{i:4})}`);
}
function cel(){
  const PL=[['Fehérje','átlag · 7 nap · ≥ 160 g','163 g','↗','t-meat',['hit','hit','part','hit','hit','miss','hit'],'cooking','cél 160 g'],
    ['Edzésnapok','darab · heti · ≥ 4','3','→','t-dumbbell',['hit','nd','hit','nd','hit','nd','nd'],'','cél 4 / hét'],
    ['Alvásidő','átlag · 7 nap · ≥ 7 ó','7,1 ó','↗','t-sleep',['hit','part','hit','hit','hit','hit','part'],'','cél 7 ó'],
    ['Késői nassolás','darab · heti · ≤ 2','—','','t-snack',null,'','']];
  const hm=()=>`<span class="en-heat">${Array.from({length:28},(_,i)=>`<i class="${[0,3,7,12,19,24].includes(i)?'miss':i%5===2?'part':'hit'}"></i>`).join('')}</span>`;
  return P({title:'Kockahas',sub:'Cél · Egészség · Teljesítmény · aktív',back:'celok'},`
  ${hero({lbl:'aug. 10. → nov. 30. · aktív',verdict:'Emelkedik: a pillérek átlaga 71%.',sub:'A világos felső réteg az e heti <b>+3 pont</b>. Négy pillér tölti, a naplódból.',left:jar(71,{val:'71%',label:'↗',p2:3,cls:'lay'}),acts:btn('+ Pillér',{sheet:'pillar'})})}
  ${sec(1,'Pillérek · 4',1)}
  ${card(segE([['het','Hét'],['ho','Hónap']],S.celv,'celv')+PL.map(p=>row({icon:p[4],title:p[0],sub:`${p[1]}${p[6]?` · skill: ${p[6]}`:''}<br>${p[5]?(S.celv==='het'?d7(p[5]):hm()):'még nincs adat · az első nyíl 5 adat-nap után'}`,v:p[2]+(p[7]?`<small class="en-tg">${p[7]}</small>`:''),right:p[3]?arr(p[3]):''})).join('')
    +note('Egy kis edény egy nap: tele = teljesült, félig = részben, üres = kimaradt. Az irány-nyíl 7 nap vs 21 nap; mindkettőben legalább 5 adat-nap kell.'),{i:1,cls:'en-pl'})}
  ${sec(2,'Miért · ha–akkor',2)}
  ${card(quote('„Nyárra látni akarom, hogy a munka megvan.”')+`<p class="fh-note" style="margin-top:6px">Akadály · esti éhség, hétvégi vendégségek</p>`
    +row({left:'<span class="en-tag">HA</span>',title:'21 után éhes vagyok'})+row({left:'<span class="en-tag">AKKOR</span>',title:'túró + fahéj, nem nassolás',sub:'Mezo figyeli · Fuel-napló'}),{i:2})}
  ${sec(3,'A cél sorsa',3)}
  ${card(`<div class="fh-acts" style="margin-top:0">${btn('Parkolás',{toast:'Parkolva'},'sm ghost')}${btn('Lezárás',{toast:'Lezárva. A Lezárt célok közé került'},'sm ghost')}${btn('Archiválás',{toast:'Archiválva'},'sm ghost')}</div>`,{i:3})}`);
}
function celuj(sp){
  const s=Math.min(5,Math.max(1,+(sp||1))), names=['Cél','Keret','Pillérek','Ha–akkor','Összegzés'], H=['Mit építünk?','Miért fontos?','Miből mérjük?','Mi jön közbe?','Így indul'];
  let body='';
  if(s===1) body=sec(1,'A cél',1)+card(fld('A cél, a te szavaiddal','Félmaraton tavasszal')+ta('Miért fontos? · egy mondat','Hogy bírjam a nyári túrákat')+fld('Határidő · opcionális','2027. ápr. 12.'),{i:1});
  if(s===2) body=sec(1,'Mezo olvasata',1)+card(msg('mezo','Egy tavaszi félmaraton egészség- és teljesítménycél: a futásra épül, de az alvás és a fehérje is tartja.'),{i:1})
    +sec(2,'Belső keret · egészség + képesség',2)+card(txt('A cél abból indul, amit te akarsz megtapasztalni. Nem abból, hogy mások mit látnak.')+`<div class="fh-acts">${btn('Egészség-keret · elfogadom',{toast:'Egészség-keret elfogadva'},'sm ghost')}${lk('Maradjon',{toast:'Marad'})}</div>`,{i:2})
    +sec(3,'Életterület · átírhatod',3)+card(`<div class="fh-pills">${Object.entries(DIM).map(([k,d])=>`<button class="fh-pill ${k==='eg'||k==='te'?'on':''}" data-ev="dim">${I(d[1])}${d[0]}${k==='te'?' · 2.':''}</button>`).join('')}</div>`+note('Mezo javaslata: Egészség az első, Teljesítmény a második.'),{i:3});
  if(s===3) body=sec(1,'Javasolt pillérek',1)+card([['Heti futókilométer','szokás · skill: futás','t-run',1],['Alvásidő','szokás · skill: alvás','t-sleep',1],['Fehérje','szokás · skill: cooking','t-meat',0]].map(p=>row({icon:p[2],title:p[0],sub:p[1],right:tgl(p[3],p[0])})).join('')
    +`<div class="fh-acts">${lk('+ Pillér a katalógusból',{sheet:'pillar'})}</div>`+note('Az AI csak a zárt jel-katalógusból választhat · 5 pillér a felső határ.'),{i:1});
  if(s===4) body=sec(1,'Akadályok',1)+card(`<div class="fh-pills">${['Idő','Fáradtság','Időjárás','Utazás'].map((n,i)=>`<button class="fh-pill ${i<2?'on':''}" data-ev="dim">${n}</button>`).join('')}</div>`+ta('Mi fog közbejönni?','pl. esős hétvégék',true),{i:1})
    +sec(2,'Ha–akkor',2)+card(row({left:'<span class="en-tag">HA</span>',title:'kimarad a keddi futás'})+row({left:'<span class="en-tag">AKKOR</span>',title:'szerdán 30 perc könnyű',sub:'sport-napló · másnap szólok · Mezo javaslata'})+`<div class="fh-acts">${lk('+ Még egy ha–akkor',{toast:'Új ha–akkor sor'})}</div>`,{i:2});
  if(s===5) body=sec(1,'A cél',1)+card(`<div class="en-sum">${jar(0,{val:'0%',label:'induláskor',s:84,mark:100})}<div>${head('t-run','Félmaraton tavasszal')}${chips([['t-sprout','Egészség'],['t-record','Teljesítmény']])}<p class="fh-note" style="margin-top:8px">határidő 2027. ápr. 12. · 2 pillér</p></div></div>`+quote('„Hogy bírjam a nyári túrákat.”'),{i:1})
    +sec(2,'Így mérjük',2)+card(row({icon:'t-run',title:'Heti futókilométer',v:'≥ 20 km'})+row({icon:'t-sleep',title:'Alvásidő',sub:'7 nap átlag',v:'≥ 7 ó'}),{i:2})
    +sec(3,'Amire Mezo figyel · 1 szabály',3)+card(txt('Ha kimarad a keddi futás → szerdán 30 perc könnyű.')+note('Aktiválás után a pillérek a meglévő naplódból számolnak. Semmi újat nem kell rögzítened.'),{i:3});
  return P({title:'Új cél',sub:`Én · ${s} / 5 · ${names[s-1]}`,back:s>1?`celuj.${s-1}`:'celok'},
    hero({lbl:`${s}. lépés az ötből`,verdict:H[s-1],body:stepsV(names,s)})+body,
    {foot:s<5?`<button class="btn" style="flex:1" data-go="celuj.${s+1}">${names[s]} →</button>`:`<button class="btn ghost" data-go="celok">Mentés tervezettként</button><button class="btn" style="flex:1" data-go="cel">Aktiválás</button>`});
}
function jelek(){
  const LIVE=[['Alvásidő','Alvás','t-sleep',['Kockahas'],5],['Fehérje','Fuel','t-bowl',['Kockahas'],7],['Edzésnapok','Edzés','t-dumbbell',['Kockahas','Side hustle'],3],['Check-in energia','Elme','t-checkin',[],6],['Lépésszám','Activity','t-steps',[],7],['Említett emberek','Emberek','t-people',['Az utolsó barátnő'],4]];
  const SLEEP=[['Pulzus-variancia','nincs adat 7 napja · Életjel','t-heart'],['Meditáció','nincs adat 7 napja · Elme','t-checkin']];
  const n7=n=>d7(Array.from({length:7},(_,i)=>i<n?'hit':'miss'));
  return P({title:'Jelek',sub:'Célok · mit figyel a rendszer',back:'celok'},`
  ${nhero({lbl:'Élő források · 7 nap',n:'19',unit:'/ 28',art:'t-signal',verdict:'Semmi újat nem kell naplóznod.',sub:'Ennyi forrásnak volt adata az elmúlt 7 napban: ezekből csordogál az adat a pillérekbe. Ami alszik, ott a pillér üres marad, nem nulla.',
    body:`<div class="en-src28" role="img" aria-label="28 forrás: 19 él, 9 alszik">${Array.from({length:28},(_,i)=>`<i class="${i<19?'on':''}"></i>`).join('')}</div>${leg([['dr','19 él'],['dr off','9 alszik']])}`})}
  ${sec(1,'Él · 19 forrás · 6 látszik',1)}
  ${card(LIVE.map(r=>row({icon:r[2],title:r[0],sub:`${r[4]} / 7 nap · ${r[1]}${r[3].length?` · → ${r[3].join(', ')}`:''}<br>${n7(r[4])}`,right:st('él','ok')})).join(''),{i:1})}
  ${sec(2,'Alszik · 9 forrás · 2 látszik',2)}
  ${card(SLEEP.map(r=>row({icon:r[2],title:r[0],sub:`${r[1]}<br>${n7(0)}`,right:st('alszik','q')})).join('')+note('Nincs külső forrás: se naptár, se időjárás, se GitHub. Ami itt nincs, azt a rendszer nem tudja.'),{i:2})}`);
}

/* ═══════════ SÚLYCÉL ═══════════ */
function pours(){
  const D=[-0.5,-0.4,-0.6,0.1,-0.5,-0.3,-0.4,-0.4];
  return tubes(D.map((d,i)=>({l:(i+1)+'.',v:(d>0?'+':'−')+fmt(Math.abs(d)),p:Math.abs(d)/0.8*100,cls:d>0?'back':''})),{h:64,cls:'cup',lines:[37.5,87.5]});
}
function sulycel(arg){
  if(arg==='ures') return P({title:'Súlycél',sub:'Célok · még nincs aktív',back:'celok'},`
    ${hero({lbl:'Súlycél',verdict:'Még nincs aktív súlycélod.',sub:'Hozz létre egyet, és a Mezo köré szervezi a terveket.',left:jar(0,{val:'—',label:'üres'}),acts:btn('+ Új cél',{sheet:'gate'})})}
    ${card(row({icon:'t-down',title:'+ Új cél',sub:'Irány, tempó, védőkorlátok: két rövid lépés',on:{sheet:'gate'}})+note('A súlycélhoz előbb a biometriád kell: egyszeri beállítás, kb. 20 másodperc.'),{i:1})}`);
  const T6=[['diet','Mai étrendi keret','Edzésnap · P 163 · C 226 · F 66','2 300 kcal','t-bowl'],['segment','Aktuális szakasz','W5–10 · még 5 nap','MAV','t-peak'],['plans','Tervkapcsolatok','4 hét még fedezetlen','2 aktív','t-calendar'],['guards','Védőkorlátok','van egy figyelendő jel','3/4','t-shield'],['javaslat','Új javaslat','változások áttekintése','1 új','t-note'],['settings','Cél beállításai','Fogyás · W8/20','73 kg','t-gear']];
  return P({title:'Súlycél',sub:'Fogyás · Nyári forma · aktív',back:'celok'},`
  ${hero({lbl:'Jó pályán · 33% megvan',verdict:'Jó úton: az edény a terv szerint apad.',sub:'<b>78,4 kg</b> most → <b>73 kg</b> cél · még 5,4 kg · várható cél: <b>aug. 14.</b> Egy új javaslat vár átnézésre.',left:drain({w:132}),acts:btn('Javaslat megnézése','sulyresz.javaslat')+lk('+ Új cél',{sheet:'gate'})+lk('A görbe','test')})}
  ${sec(1,'Ütem · áramlás',1)}
  ${card(flowg(-0.5,-0.5,-0.7,-0.3,-1,0.2)+`<p class="fh-note" style="margin-top:6px;text-align:center">kg / hét · a két vízvonal között a biztonságos sáv · a csepp a mért ütem</p>`+facts([['−0,5','tényleges'],['−0,5','tervezett'],['aug. 14.','várható cél']]),{i:1})}
  ${sec(2,'Heti kiöntések · 8 hét',2)}
  ${card(pours()+`<div class="en-pourf"><span>81,4 kg</span><i></i><b>összesen −3,0 kg</b><i></i><span>78,4 kg</span></div>`+note('Egy pohár egy hét: ennyi fogyott a trendből. A két szaggatott vonal a biztonságos sáv (−0,3 és −0,7). A visszatöltő hét csak szürke: a sáv dönt, nem egy hét.'),{i:2})}
  ${sec(3,'A cél részei',3)}
  ${card(T6.map(t=>row({icon:t[4],title:t[1],sub:t[2],v:t[0]==='javaslat'?null:t[3],right:t[0]==='javaslat'?st(t[3],'warn')+chev():'',on:t[0]==='settings'?{toast:'Beállítások · súlycél'}:`sulyresz.${t[0]}`})).join(''),{i:3})}`);
}
const lane=items=>`<div class="en-lane">${items.map(([l,w,t,gap])=>`<i class="${gap?'gap':''}" style="left:${l}%;width:${w}%">${t}</i>`).join('')}</div>`;
function sulyresz(k){
  k=k||'diet'; let o={},out='';
  if(k==='diet'){o={title:'Mai étrendi keret',sub:'Súlycél · ma edzésnap'};
    const WD=[['H',2300],['K',1950],['Sze',2300],['Cs',2300,1],['P',1950],['Szo',2300],['V',1950]];
    out=nhero({lbl:'Ma · edzésnap',n:'2 300',unit:'kcal',art:'t-bowl',verdict:'A heti átlagból jön ki a −0,5 kg/hét.',body:cells([['2 150','','heti átlag'],['2 300','','edzésnap'],['1 950','','pihenőnap']])})
    +sec(1,'Heti ritmus · hét tál',1)+card(tubes(WD.map(d=>({l:d[0],v:d[1]===2300?'2,3':'1,95',p:d[1]/2600*100,cls:d[2]?'now':'',c:d[1]===2300?'var(--dom)':'color-mix(in srgb,var(--dom) 55%,#fff)'})),{h:84,cls:'week',lines:[2150/2600*100]})
      +leg([['bd','edzésnap × 4 · 2 300 kcal'],['tol','pihenőnap × 3 · 1 950 kcal'],['pl','heti átlag 2 150 kcal']])
      +`<p class="fh-txt" style="margin-top:12px">Heti átlag <b>2 150 kcal</b>: ebből jön ki a −0,5 kg/hét.</p>`+note('Formula-alap: a nyugalmi anyagcseréd és az edzésnapjaid számából, a heti célütemhez igazítva. A napi szám mögött mindig látható marad a heti logika.'),{i:1})
    +sec(2,'Mai makrók',2)+card(vials([{l:'Fehérje',ic:'t-meat',c:'var(--protein)',p:100*163*4/2300*2.2,v:'163 g',s:'28%'},{l:'Szénhidrát',ic:'t-carb',c:'var(--carb)',p:100*226*4/2300*2.2,v:'226 g',s:'39%'},{l:'Zsír',ic:'t-fat',c:'var(--fat)',p:100*66*9/2300*2.2,v:'66 g',s:'26%'}],{h:104})+note('Az edény magassága a makró részét mutatja a mai 2 300 kcal-ból.'),{i:2,cls:'en-vc en-m3'})}
  if(k==='segment'){o={title:'Aktuális szakasz',sub:'Súlycél · W5–10'};
    out=nhero({lbl:'Aktuális szakasz · W5–10',n:'MAV',unit:'még 5 nap',art:'t-peak',verdict:'Az erőd megtartása a cél.',body:cells([['5','nap','hátra'],['Strength 02','','következő'],['−0,5','kg','heti cél']])})
    +sec(1,'A teljes ív · 20 hét',1)+card(w20(i=>(i<7?'full ':i===7?'now ':'')+(i>=4&&i<10?'a':i>=10&&i<16?'b':''))+lane([[20,30,'Most · MAV W5–10'],[50,30,'Strength 02']])
      +leg([['bd','MAV · W5–10'],['tol','Strength 02 · W11–16'],['dr','eltelt hét']])+`<p class="fh-txt" style="margin-top:12px">Következő: <b>Strength 02</b> · W11-től · jún. 16.</p>`,{i:1})
    +sec(2,'Mit változtat?',2)+card(txt('A MAV-szakaszban a heti szettszám a csúcs felé emelkedik, a kalóriakeret nem változik. Az erőd megtartása a cél.'),{i:2})}
  if(k==='plans'){o={title:'Tervkapcsolatok',sub:'Súlycél · 20 hét'};
    out=nhero({lbl:'Tervkapcsolatok',n:'2',unit:'aktív',art:'t-calendar',verdict:'Négy hét még nincs lefedve.',body:cells([['16','hét','lefedve'],['4','hét','fedezetlen',1],['2','','sport-időpont']])})
    +sec(1,'Idővonal · 20 hét',1)+card(w20(i=>i<4?'gap':'full a')+lab('Mesociklus')+lane([[20,30,'Hypertrophy 04 · W5–10']])+lab('Futóblokk')+lane([[25,40,'Base Build · 5K W6–13']])+lab('Fedezetlen')+lane([[0,20,'W1–4',1]])
      +note('Egy kis edény egy hét: tele, ha van rá terv; a csíkos üres, ha fedezetlen.'),{i:1})
    +sec(2,'Sport · heti rend',2)+card(row({icon:'t-volley',title:'Röplabda · Edzés · BVSC',sub:'Kedd · 18:30 · 90 perc'})+`<div class="fh-acts">${btn('+ Mesociklus',{toast:'Mesociklus csatolása'},'sm ghost')}${btn('+ Futóblokk',{toast:'Futóblokk csatolása'},'sm ghost')}</div>`,{i:2})}
  if(k==='guards'){o={title:'Védőkorlátok',sub:'Súlycél · célbiztonság'};
    out=hero({lbl:'Célbiztonság · 3 / 4 jel rendben',verdict:'Három korlát tele, egy még figyelmet kér.',sub:'A fehérjecél még nincs Fuel-adattal ellenőrizve.',
      body:vials([{l:'Erő',ic:'t-dumbbell',c:'var(--ok)',p:92,v:'+1,2%',s:'rendben'},{l:'Izom',ic:'t-muscle',c:'var(--ok)',p:88,v:'≥ 8',s:'szett / izom'},{l:'Fehérje',ic:'t-meat',c:'var(--warn)',p:22,v:'?',s:'figyelendő'},{l:'Ütem',ic:'t-trend',c:'var(--ok)',p:90,v:'−0,5',s:'kg / hét'}],{h:108})+cells([['3','','rendben'],['1','','figyelendő',1],['4','jel','összesen']])})
    +sec(1,'Jelek',1)+card([['Erővédelem','A fő emeléseid súlya nem csökkent a vágás alatt.','rendben · +1,2%','ok'],['Izomvédelem','Minden nagy izomcsoport kap elég munkát: ≥ 8 szett / izom, 0 izom a minimum alatt.','rendben','ok'],['Fehérje','Még nincs elég Fuel-nap az ellenőrzéshez.','figyelendő','warn'],['Ütem','A biztonságos sávban: −0,5 kg/hét.','rendben','ok']].map(g=>row({left:ck(g[3]),title:g[0],sub:g[1],right:st(g[2],g[3])})).join(''),{i:1})}
  if(k==='javaslat'){o={title:'Mielőtt alkalmazod',sub:'Súlycél · javaslat · W17'};
    out=hero({warn:true,lbl:'Javaslat · W17 · átnézésre vár',verdict:'Két hete lassabb az ütem a tervezettnél.',sub:'A pihenőnapi keret 150 kcal-lal csökkenne.',body:`<div class="en-lk">${linked(86,74,{a:'most · 1 950',b:'javasolt · 1 800',c:'#F6CB5A',c2:'#E9892B'})}</div>`,acts:btn('Módosítások alkalmazása',{toast:'Alkalmazva'})+lk('Most nem','sulycel')+lk('Javaslat elvetése',{toast:'Biztosan elveted? · Igen, elvetem / Mégsem'})})
    +sec(1,'Miért javasoljuk?',1)+card(flowg(-0.2,-0.5,-0.7,-0.3,-1,0.2)+txt('A mért ütem <b>−0,2 kg/hét</b>, a terv −0,5: a csepp kicsúszott a biztonságos sávból. A pihenőnapi keret 150 kcal-lal csökkenne.'),{i:1})
    +sec(2,'Mi változik?',2)+card(row({title:'Pihenőnap',v:'<s>1 950</s> → 1 800 kcal'})+row({title:'Heti átlag',v:'<s>2 150</s> → 2 086 kcal'}),{i:2})}
  return P({...o,back:'sulycel'},out);
}
function sulyuj(sp){
  const s=+(sp||1)===2?2:1;
  const dj=(p,a)=>`<span class="en-dj">${fill(JAR,{p:5+p*.72,s:50,inner:`<path d="${a}" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>`})}</span>`;
  const body=s===1?sec(1,'Irány',1)+card([['Fogyás','↓ deficit · az edény apad','M50 34V66M38 55L50 67L62 55',1,38],['Hízás','↑ surplus · az edény telik','M50 66V34M38 45L50 33L62 45',0,78],['Szinten tartás','≈ tartás · a szint marad','M34 50H66',0,58]].map(t=>row({left:dj(t[4],t[2]),title:t[0],sub:t[1],right:t[3]?ck('ok'):'<span class="en-ck gone"></span>',on:{toast:`${t[0]} kiválasztva`}})).join(''),{i:1})
    +sec(2,'Védőkorlátok',2)+card(row({icon:'t-shield',title:'Erő megtartása',right:tgl(1,'Erő megtartása')})+row({icon:'t-shield',title:'Izom megtartása',right:tgl(1,'Izom megtartása')}),{i:2})
   :sec(1,'A cél adatai',1)+card(fld('Cél neve','Nyári forma')+two(fld('Kezdés','ápr. 22.'),fld('Cél dátum','szept. 8.'))+two(fld('Start súly','81,4 kg'),fld('Cél súly','73 kg'))+ta('Identity frame · opcionális','pl. „aki bírja a nyarat”',true),{i:1})
    +sec(2,'Ellenőrzés',2)+card(row({left:ck('ok'),title:'Reális',sub:'−0,5 kg/hét, a biztonságos sávon belül.'}),{i:2});
  return P({title:'Új súlycél',sub:`Én · ${s} / 2`,back:s>1?'sulyuj.1':'sulycel'},
    hero({lbl:`${s}. lépés a kettőből`,verdict:s===1?'Mit építünk?':'Mennyi időnk van?',sub:s===2?'A két vízvonal a start és a cél: <b>−8,4 kg</b>, 20 hét alatt.':'',left:s===2?drain({cur:81.4,w:120}):'',body:stepsV(['Irány','Időkeret'],s)})+body,
    {foot:s===1?`<button class="btn" style="flex:1" data-go="sulyuj.2">Tovább →</button>`:`<button class="btn ghost" data-go="sulycel">Mentés tervezettként</button><button class="btn" style="flex:1" data-go="sulycel">Létrehozás + aktiválás</button>`});
}

/* ═══════════ TEST · SÚLY ═══════════ */
function wseries(){const n=31,out=[];for(let i=0;i<n;i++){const t=i/(n-1);out.push(80.4-2.0*t+Math.sin(i*1.7)*.28+Math.cos(i*.9)*.15)}out[n-1]=78.2;return out}
/* a simított súly mint vízfelszín, ami a cél vízvonala felé apad: napi mérések halvány pöttyök, terv szaggatott, tűréssáv, vetítés */
function wchart(){
  const d=wseries(), id=uid('ew'), W=330,H=178,lo=72.3,hi=81.5, xe=206, xp=W-38, x=i=>8+i/(d.length-1)*(xe-8), y=v=>10+(hi-v)/(hi-lo)*(H-20);
  let e=d[0];const ema=d.map(v=>(e=e+0.25*(v-e)));ema[ema.length-1]=78.4;
  const p=ema.map((v,i)=>[x(i),y(v)]), c=curve(p), ty=y(73);
  const p0=80.4,p1=78.4, band=`M${x(0)} ${y(p0+.5)} L${x(30)} ${y(p1+.5)} L${x(30)} ${y(p1-.5)} L${x(0)} ${y(p0-.5)}Z`;
  return `<svg class="fh-chart en-wch" viewBox="0 0 ${W} ${H+18}" role="img" aria-label="Súlytrend: simított trend 80,4 → 78,4 kg, napi mérések pontokként, cél 73 kg"><defs>${grad(id,.85,.3)}</defs>
    ${[80,78,76].map(v=>`<line x1="8" x2="${xp}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" style="stroke:var(--hair)"/>${gl(W,(y(v)+3).toFixed(1),v,'end')}`).join('')}
    <path d="${c} L${x(30).toFixed(1)} ${H} L8 ${H}Z" fill="url(#${id})"/>
    <path d="M${x(30).toFixed(1)} ${y(78.4).toFixed(1)} L${xp} ${ty.toFixed(1)} V${H} H${x(30).toFixed(1)}Z" style="fill:var(--liq2);opacity:.10"/>
    <path d="${band}" style="fill:#fff;opacity:.38"/>
    <line x1="${x(0)}" y1="${y(p0).toFixed(1)}" x2="${x(30)}" y2="${y(p1).toFixed(1)}" style="stroke:var(--ink);stroke-dasharray:4 4;opacity:.45"/>
    ${d.map((v,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="1.900" style="fill:var(--ink);opacity:.3"/>`).join('')}
    <path d="${c}" style="fill:none;stroke:var(--liq2);stroke-width:2.8;stroke-linecap:round"/>
    <path d="M${x(30).toFixed(1)} ${y(78.4).toFixed(1)} L${xp} ${ty.toFixed(1)}" style="fill:none;stroke:var(--liq2);stroke-width:1.8;stroke-dasharray:2 5;stroke-linecap:round"/>
    <path d="M8 ${ty.toFixed(1)} q7 -3 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t6 0" style="fill:none;stroke:var(--ink);stroke-width:1.3;stroke-dasharray:4 4;opacity:.6"/>${gl(W,(ty+3).toFixed(1),'cél 73','end')}
    <circle cx="${xp}" cy="${ty.toFixed(1)}" r="3.500" style="fill:#fff;stroke:var(--liq2);stroke-width:2"/>
    <circle cx="${x(30).toFixed(1)}" cy="${y(78.4).toFixed(1)}" r="5.500" style="fill:#fff;stroke:var(--liq2);stroke-width:3"/><text class="bn" x="${(x(30)+9).toFixed(1)}" y="${(y(78.4)-7).toFixed(1)}" style="font-size:12px">78,4</text>
    ${gl(8,H+14,S.period==='7d'?'szept. 17.':S.period==='30d'?'aug. 25.':S.period==='90d'?'jún. 26.':'2025. szept.')}${gl(x(30).toFixed(1),H+14,'ma','middle')}${gl(xp,H+14,'+11 hét','end')}
  </svg>`;
}
function sulyBody(){
  const WK=[['szept. 15–21','−0,4','78,6 kg átlag · 5 bejegyzés · min 78,4',[78.9,78.7,78.8,78.6,78.5,78.4,78.4],'↓ lefelé'],['szept. 8–14','−0,6','79,0 kg átlag · 6 bejegyzés · min 78,8',[79.5,79.3,79.2,79.0,78.9,78.8,78.9],'↓ lefelé'],['szept. 1–7','+0,1','79,6 kg átlag · 4 bejegyzés · min 79,4',[79.5,79.7,79.6,79.4,79.7,79.6,79.6],'→ stabil']];
  const DN=['Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat','Vasárnap'];
  return nhero({lbl:'Trend · 7 napos simítás',n:'78,4',unit:'kg',art:'t-weight',verdict:'Egyenletesen apad: −0,5 kg hetente.',sub:'Ma mérve 78,2 · −3,0 kg indulás óta (81,4 → 78,4) · cél 73 kg',
    body:`<div class="en-hseg">${segE([['7d','7 nap'],['30d','30 nap'],['90d','90 nap'],['1y','1 év']],S.period,'period')}</div><div class="en-chart">${wchart()}</div>${leg([['ln','trend (felszín)'],['raw','napi mérés'],['pl','terv'],['tol','tűréssáv'],['pr','vetítés a célig']])}`,
    acts:btn('+ Súly',{sheet:'weight'})+lk('Súlycél','sulycel')})
  +sec(1,'Ütem · a csap',1)+card(`<div class="en-tapw">${tap()}<div><div class="fh-big">−0,5<small>kg / hét</small></div><p class="fh-note" style="margin-top:6px">4 heti tempó · pont a terv szerint csordogál. Az utolsó 7 nap: <b>−0,4 kg</b>.</p></div></div>`
    +facts([['78,4','jelenleg · kg'],['−0,4','7 nap / hét'],['11 hét','várható cél']])
    +row({title:'A célig',sub:'33% megvan · 5,4 kg van hátra · várható cél aug. 14.',right:`<span class="en-lvw"><b>${'33%'}</b>${level(33,{h:16})}</span>`}),{i:1})
  +sec(2,'Megfigyelés',2)+card(head('t-eye','Zsír megy, az erő marad')+txt('Négy hét alatt <b>−2,0 kg</b> a trend, miközben a fő emeléseid súlya <b>+1,2%</b>. Ez inkább zsírvesztés, mint izom. A Védőkorlátok ugyanezt mondják.')+`<div class="fh-acts">${lk('Védőkorlátok ›','sulyresz.guards')}</div>`,{i:2})
  +sec(3,'Heti előzmény · 3 / 22 hét',3)+card(WK.map((w,i)=>`<button class="fh-row" data-ev="wk:${i}">${lspark(w[3])}<span class="g"><strong>${w[0]}</strong><small>${w[2]} · ${w[4]}</small></span><span class="v">${w[1]}<small>kg</small></span><span class="en-car ${S.wk===i?'open':''}">${chev()}</span></button>${S.wk===i?`<div class="en-days">${w[3].map((v,j)=>`<div><span>${DN[j]}</span><b>${fmt(v)} kg</b><em>${j?((v-w[3][j-1])>=0?'+':'')+fmt(v-w[3][j-1]):'—'}</em></div>`).join('')}<div class="fh-acts" style="margin-top:8px">${lk('Mi történt ezen a héten?',{toast:'Mezo · diagnózis erre a hétre'})}</div></div>`:''}`).join('')+`<div class="fh-acts">${lk('Régebbi hetek',{toast:'Régebbi hetek betöltve'})}</div>`,{i:3});
}
/* ═══════════ TEST · ALVÁS ═══════════ */
const PH=[['Mély',18,.95],['Könnyű',52,.4],['REM',24,.7],['Éber',6,.18]];
const rail=a=>`<div class="en-rail">${a.map(p=>`<i style="width:${p[1]}%;opacity:${p[2]}"></i>`).join('')}</div><div class="en-leg">${a.map(p=>`<span><i class="bd" style="opacity:${p[2]}"></i>${p[0]} ${p[1]}%</span>`).join('')}</div>`;
const ref=(n,v,lo,hi)=>row({title:n,right:`<span class="en-band"><s style="left:${lo*2}%;width:${(hi-lo)*2}%"></s><u style="left:${v*2}%"></u></span>`,v:`${v}%`,sub:'a sávban'});
/* nyolc hét = nyolc edény a 7,5 órás vízvonalhoz; a kis sáv a hét legrövidebb és leghosszabb éjszakája */
function w8(){
  const avg=[6.6,6.9,7.0,6.4,7.2,7.1,6.8,7.1], mn=[5.9,6.1,6.3,5.6,6.5,6.4,6.1,6.1], mx=[7.6,7.8,7.9,7.4,8.1,7.9,7.6,7.9], pc=v=>(v-5)/4*100;
  return `<div role="img" aria-label="Alvás heti átlaga 8 héten: 6,4–7,2 óra, cél 7,5 óra">${tubes(avg.map((v,i)=>({v:fmt(v),p:pc(v),r:[pc(mn[i]),pc(mx[i])],l:i===0?'aug. 3.':i===7?'most':'',cls:i===7?'now':''})),{h:104,cls:'w8',lines:[pc(7.5)]})}</div>`;
}
/* az éjszaka mint árapály: a felszín az ébrenlét, minél mélyebb a víz, annál mélyebb az alvás */
function tideN(){
  const sq=[0,1,2,3,3,2,1,2,3,3,2,1,0,1,2,3,2,1,1,2,2,1,0,1,2,2,1,0], id=uid('en'), W=300, X0=46, dx=(W-X0-4)/(sq.length-1), y=v=>12+v*24;
  const p=sq.map((v,i)=>[X0+i*dx,y(v)]);
  return `<svg class="fh-chart en-tide" viewBox="0 0 ${W} 108" role="img" aria-label="Az éjszaka íve: 00:42 → 09:03"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--liq1)" stop-opacity=".55"/><stop offset="1" stop-color="var(--liq2)"/></linearGradient></defs>
    ${['Éber','REM','Könnyű','Mély'].map((n,i)=>gl(0,y(i)+3,n)+`<line x1="${X0}" x2="${W}" y1="${y(i)}" y2="${y(i)}" style="stroke:var(--hair)"/>`).join('')}
    <path d="${curve(p)} L${W-4} 12 L${X0} 12Z" fill="url(#${id})"/><path d="${curve(p)}" style="fill:none;stroke:var(--liq2);stroke-width:2;stroke-linecap:round"/>
    <path d="M${X0} 12 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t10 0" style="fill:none;stroke:var(--liq1);stroke-width:2.2;stroke-linecap:round"/>
    ${gl(X0,104,'00:42')}${gl(X0+(W-X0)/2,104,'04:50','middle')}${gl(W,104,'09:03','end')}</svg>`;
}
function strend(){
  const N7=[[7.5,9],[6.8,6],[7.2,7],[6.1,5],[7.9,8],[7.0,7],[7.1,7]], N14=[[7.0,7],[6.6,6],[7.3,8],[7.1,7],[6.4,5],[7.4,8],[7.2,7],...N7];
  const N=S.swin==='7d'?N7:N14, wide=N.length<=7;
  return `<div role="img" aria-label="Alvás trend: időtartam edényenként, minőség pöttyel">${tubes(N.map((v,i)=>({v:wide?fmt(v[0]):null,p:v[0]/9*100,deep:v[0]/9*22,dot:v[1]*10,c:v[0]<7?'var(--warn)':'var(--dom)',l:wide?['H','K','Sz','Cs','P','Sz','V'][i]:(i%7===0?'H':i===13?'V':'')})),{h:96,cls:'nights',lines:[7/9*100]})}</div>`;
}
function scatter(){
  const q=[[6.1,78],[6.5,84],[6.8,92],[7.0,101],[7.2,104],[7.5,112],[7.9,118],[8.2,121],[6.3,80],[7.1,99]], W=330,H=100,x=h=>(h-5.8)/2.6*(W-10)+4,y=m=>H-(m-70)/56*(H-8);
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H+18}" role="img" aria-label="Alvásidő és REM-perc">
    <line x1="4" x2="${W}" y1="${H}" y2="${H}" style="stroke:var(--hair)"/>
    <line x1="${x(7).toFixed(1)}" x2="${x(7).toFixed(1)}" y1="0" y2="${H}" style="stroke:var(--ink);stroke-dasharray:3 4;opacity:.45"/>${gl(x(7)+4,10,'7 ó')}
    ${q.map(v=>`<circle cx="${x(v[0]).toFixed(1)}" cy="${y(v[1]).toFixed(1)}" r="6" style="fill:${v[0]<7?'color-mix(in srgb,var(--warn) 30%,#fff)':'color-mix(in srgb,var(--dom) 30%,#fff)'};stroke:${v[0]<7?'var(--warn)':'var(--dom)'};stroke-width:1.6"/><circle cx="${(x(v[0])-2).toFixed(1)}" cy="${(y(v[1])-2).toFixed(1)}" r="1.500" fill="#fff"/>`).join('')}
    ${gl(4,H+14,'6 ó')}${gl(W,H+14,'8 ó · REM perc ↑','end')}
  </svg>`;
}
function alvasBody(){
  const LOG=[['09/23','7,1 ó','23:20 → 06:30',7,''],['09/22','7,5 ó','00:42 → 09:03',9,'Tegnap stabil'],['09/21','6,1 ó','01:10 → 07:15',5,'Késő vacsora'],['09/20','7,2 ó','23:40 → 06:55',7,''],['09/19','6,8 ó','23:55 → 06:45',6,''],['09/18','7,9 ó','22:50 → 06:45',8,''],['09/17','7,0 ó','23:30 → 06:30',7,'']];
  return nhero({lbl:'Alvás · heti átlag',n:'7,1',unit:'óra',art:'t-sleep',verdict:'Közel a 7,5 órás vízvonalhoz, egyenletes héttel.',sub:'A hét sávja 6,1–7,9 ó · tegnap 7,1 ó · 23:20 → 06:30 · minőség 7/10',
    body:w8()+leg([['bd','heti átlag'],['rg','legrövidebb–leghosszabb éjszaka'],['pl','7,5 ó cél']]),acts:btn('+ Alvás',{sheet:'sleep'})+lk('Éjszakai mód','ejszaka.idle')})
  +sec(1,'Alvás-cél',1)+card(`<div class="en-bed"><span>${bub('t-moon',{s:38})}<b>23:15</b></span><div>${level(100,{h:22,label:'7,5 ó cél'})}</div><span>${bub('t-sun',{s:38})}<b>06:45</b></span></div>`
    +`<p class="fh-note" style="margin-top:10px">„a rendszeresség a király” · ±15 perc ${lk('szerkeszt',{toast:'Beállítások · alvás-cél'})}</p>`
    +row({title:'Rendszeresség',sub:'14 nap · ±15 perc',right:`<span class="en-lvw"><b>${'78%'}</b>${level(78,{h:16})}</span>`})+row({title:'Hatékonyság',sub:'cél ≥ 85%',right:`<span class="en-lvw"><b>${'91%'}</b>${level(91,{h:16,c:'var(--ok)'})}</span>`})
    +row({icon:'t-book',title:'Miért számít?',sub:'<b>A rendszeresség a király.</b> Az azonos időben lefekvés többet ér, mint egy-egy hosszabb éjszaka.',on:{sheet:'stats'}}),{i:1})
  +sec(2,'Tegnap éjjel · az árapály',2)+card(`<div class="en-lastn"><div class="fh-big">7,5<small>óra</small></div><div class="fh-big q">9<small>/ 10 minőség</small></div></div><p class="fh-note" style="margin-top:6px">00:42 → 09:03 · ébredés 1× éjjel</p>`
    +chips(['+87 perc a cél lefekvéshez képest','hatékonyság 93%'])
    +`<div class="en-chart">${tideN()}</div>`+note('A felszín az ébrenlét. Minél mélyebbre ér a víz, annál mélyebb az alvás.')
    +lab('Fázisok')+rail(PH)+ref('Mély',18,13,23)+ref('REM',24,20,25)+`<p class="fh-txt" style="margin-top:10px">Tegnap stabil.</p>`
    +lab('Átlagos összetétel · 14 éjszakából')+rail([['Mély',16,.95],['Könnyű',55,.4],['REM',22,.7],['Éber',7,.18]])+ref('Mély',16,13,23)+ref('REM',22,20,25),{i:2})
  +sec(3,'Trend',3)+card(segE([['7d','7 nap'],['14d','14 nap']],S.swin,'swin')+strend()+leg([['bd','időtartam'],['dp','ebből mély'],['wn','7 óra alatt'],['ink','minőség 1–10'],['pl','7 ó']])
    +lab('Ha rövidebb az éjszaka')+`<div class="en-chart">${scatter()}</div>`+txt('A 7 óra alatti éjszakáidon átlagosan <b>21 perccel kevesebb</b> a REM-ed.'),{i:3})
  +sec(4,'Napló · utolsó 7 éjszaka',4)+card(LOG.map(n=>{const w=parseFloat(n[1].replace(',','.'))<7||n[3]<=5;return step({time:n[0],title:`<span${w?' style="color:var(--warn)"':''}>${n[1]}</span> · ${n[2]}`,sub:n[4],right:`<span class="en-lvw sm"><b>${n[3]+'/10'}</b>${level(n[3]*10,{h:14,c:w?'var(--warn)':'var(--dom)'})}</span>`})}).join('')
    +row({icon:'t-moon',title:'Éjszakai mód',sub:'Eszközök éjszakai ébredéshez: 20 perces szabály, légzés, 4K-séta.',on:'ejszaka.idle'}),{i:4,cls:'en-nl'});
}
function test(arg){
  const v=arg==='alvas'?'alvas':'suly';
  return P({title:'Test',sub:v==='suly'?'Én · súly · szept. 24.':'Én · alvás · szept. 24.',tab:'test'},`
  <div class="en-sw rise">${seg([['Súly','test',v==='suly'],['Alvás','test.alvas',v==='alvas']])}</div>
  ${v==='suly'?sulyBody():alvasBody()}
  ${card(row({icon:'t-person',title:'Testadatok',sub:'34 év · 180 cm · 78,4 kg · 15% testzsír',on:{toast:'Beállítások · testadatok'}}),{i:6})}`);
}
/* éjszakai mód: sötét marad (a tulajdonos kérdése még nyitva), lent egy lassan lélegző vízszinttel */
function ejszaka(ph){
  ph=ph||'idle';
  const nb=`<button class="nback" data-go="${ph==='idle'?'test.alvas':'ejszaka.wait'}">‹ vissza</button>`;
  const sea=`<div class="nsea" aria-hidden="true"><div>${wave('currentColor',.5,'b')}${wave('currentColor')}</div></div>`;
  const pool=(cls,t)=>`<div class="${cls}"><i>${wave('currentColor')}</i><span>${t}</span></div>`;
  let inner='';
  if(ph==='idle') inner=`${nb}<span class="eb">Éjszakai mód</span><span class="art">${I('t-moon')}</span><h1>Felébredtél?</h1><p>Ne nézd meg az órát. Én figyelem helyetted az időt, neked csak pihenned kell.</p><button class="ncta" data-go="ejszaka.wait">Ébren vagyok</button>`;
  else if(ph==='wait') inner=`${nb}<span class="eb">Én figyelem az időt</span>${pool('orb','')}<p>Maradj az ágyban, lazíts. Ha segít, válassz egyet:</p>
    ${[['t-breath','Légzés','be 5 · tartsd 6 · ki 7 · vezetett ütem','data-go="ejszaka.legzes"'],['t-person','Testpásztázás','fejtől lábujjig, lassú vezetéssel','data-toast="Testpásztázás: lassú, sötét kártyák"'],['t-steps','4K-séta','járj végig fejben egy jól ismert utat','data-toast="4K-séta: lassú, sötét kártyák"']].map(t=>`<button class="tool" ${t[3]}>${I(t[0])}<span class="g">${t[1]}<small>${t[2]}</small></span><em>›</em></button>`).join('')}
    <button class="quitl" data-go="test.alvas">elalszom · kilépek</button><button class="quitl" data-go="ejszaka.getup">(20 perc múlva →)</button>`;
  else if(ph==='legzes') inner=`${nb}<span class="eb">Légzés · 5 – 6 – 7</span>${pool('breath','Be…')}<p>Kövesd a vizet: ahogy emelkedik, szívd be; ahogy áll, tartsd; ahogy apad, fújd ki.</p><button class="quitl" data-go="ejszaka.wait">megállítom ›</button>`;
  else inner=`${nb}<span class="eb">20 perc eltelt</span><span class="art">${I('t-candle')}</span><h1>Ideje felkelni</h1><p>Kelj fel: ez most a jobb út.</p><ul><li>Menj át egy másik, félhomályos szobába.</li><li>Csinálj valami unalmasat, képernyő nélkül.</li><li>Csak akkor feküdj vissza, ha álmos vagy.</li></ul><button class="ncta" data-go="test.alvas">Visszafeküdtem</button>`;
  return `<div class="scroll en-night ${ph}">${sea}${inner}</div><div class="toast" id="toast"></div><div class="sheet" id="sheet"></div><div class="scrim" id="scrim"></div>`;
}

/* ═══════════ A HETED ═══════════ */
const mbars=a=>`<span class="en-mb">${a.map(v=>`<i class="${v?'':'nd'}"><b style="height:${v?cl(Math.round(v)):0}%"></b></i>`).join('')}</span>`;
/* kilenc terület = kilenc szint; színt csak az kap, ami figyelmet kér */
const nine=a=>`<div class="en-cells nine">${a.map(([n,u,l,p,att])=>`<div class="${att?'att':''}" style="--p:${p==null?0:cl(p)}%"><b>${n}${u?`<i>${u}</i>`:''}</b><small>${l}</small></div>`).join('')}</div>`;
const DISC=[[23,'minta',''],[6,'új tudás','b'],[3,'életesemény','c'],[1,'emlékkönyv','d'],[1,'előrejelzés','e']];
function het(arg){
  const run=arg==='fut';
  return P({title:'A heted',sub:`Szept. 21–27. · ${run?'ez a hét · még fut':'lezárt hét'}`,back:'mai'},`
  ${hero({lbl:run?'Ez a hét · még fut':'Lezárt hét · a Mezo elemzésével',verdict:run?'A visszatérés hete':'Az egyensúly hete',sub:'<b>+4</b> az előző héthez. A szaggatott vonal az edényen az előző hét: <b>74</b>.',left:jar(78,{val:78,label:'/ 100',mark:74,s:108}),
    acts:btn('Mezo elemzése',run?'elemzes.fut':'elemzes')+`<span class="en-wnav"><button class="btn sm ghost" data-toast="Előző hét" aria-label="Előző hét">‹</button><button class="btn sm ghost" ${run?'disabled':'data-toast="Következő hét"'} aria-label="Következő hét">›</button></span>`})}
  ${sec(1,'A hét kilenc szintje',1)}
  ${card(nine([['3 004','kcal','kcal átlag',97],['212','g','fehérje',100],['7ó 19p','','alvás',88,1],['75','%','check-in',75],['7,0','/ 10','energia',70],['6,8','/ 10','hangulat',68],['78,6','kg','súly',null],['−0,4','kg/hét','súly-trend',80],['585','','XP',null]])+note('Minden csempe annyira van feltöltve, amennyire a célhoz állsz. Színt csak az kap, ami figyelmet kér: az alvás a 7,5 órás célod alatt maradt. Minden más rendben.'),{i:1})}
  ${sec(2,'A hét négy nézete',2)}
  ${card(row({icon:'t-score',title:'Mezo · heti elemzés',sub:run?'hétfőn jön · a hét még fut':'hétfő 06:15 · erős hét volt: a fehérjecélt öt napon tartottad, és az alvásod is stabilizálódott<br><span class="en-sm">napi pontszám · 3 / 7 nap</span>',right:mbars(DAYSC.map(d=>d[1]))+chev(),on:run?'elemzes.fut':'elemzes'})
    +row({icon:'t-gem',title:'A hét tanulságai',sub:run?'a hét közben még gyűlik':'nincs javaslat ehhez a héthez',v:'—',on:'tanulsagok'})
    +row({icon:'t-sun',title:'A hét napjai',sub:'nézd meg egyesével',v:'4 / 7',on:'napok'})
    +row({icon:'t-lens',title:'Heti felfedezések',sub:'34 új nyom a memóriában',v:'34',on:'felfedezesek'})+strata(DISC),{i:2,cls:'en-v4'})}
  ${run?sec(3,'Célok · a hét iránya · 3 cél',3)+card(GOALS.map(g=>row({icon:DIM[g.d[0]][1],title:`${g.t} <span class="en-meta">${DIM[g.d[0]][0]}</span>`,sub:g.arrow==='↗'?'Emelkedik: a pillérei többsége a héten célon volt.':'Tartja: a pillérek a múlt heti szinten.',right:arr(g.arrow)+chev(),on:'celok'})).join('')+`<div class="fh-acts">${lk('Célok · nyisd ki ›','celok')}</div>`,{i:3})
    +sec(4,'A következő heted',4)+card(msg('mezo','Jövő héten két korai lefekvés elég lenne, hogy a hatékonyságod 90% fölött maradjon. A többi mehet így.')+`<div class="fh-acts">${btn('Hasznos',{toast:'Köszönöm'},'sm ghost')}${btn('Nem most',{toast:'Rendben'},'sm ghost')}</div>`,{i:4}):''}
  ${card(note('A pontszám a hat mért területből áll össze: tápanyag, minőség, edzés, alvás, logolás, ritmus.'),{i:5,cls:'en-foot'})}`);
}
function elemzes(arg){
  const run=arg==='fut';
  return P({title:'Heti elemzés',sub:run?'A heted · hétfőn jön':'A heted · hétfő 06:15',back:run?'het.fut':'het'},`
  ${nhero({lbl:'A Mezo olvasata · napi pontszámok',n:'78',unit:'/ 100',art:'t-score',verdict:run?'A hét még fut: három nap edénye telt meg eddig.':'Erős hét volt: a fehérjecélt öt napon tartottad.',sub:'Hét nap, hét edény. Koppints egyre, és megnyílik A napom oldala.',
    body:dayTubes({h:112}),
    acts:run?btn('A hét napjai','napok'):btn('Beszélgess a hétről',{toast:'Beszélgetés a hétről (Mezo)'})+lk('Frissítsd',{toast:'Elemzés frissítve'})})}
  ${sec(1,'Mezo · heti elemzés',1)}
  ${card(run?msg('mezo','Hétfő reggel érkezik. Eddig <b>4 / 7 nap</b> logolva.','hétfőn jön')
    :msg('mezo','Erős hét volt: a fehérjecélt öt napon tartottad, és az alvásod a hét második felében stabilizálódott. A csütörtöki kimaradt nap után szombaton visszajöttél. Ez a hét mintája.','hétfő 06:15')
    +lab('Amire épült')+chips([['t-pattern','Minta'],['t-book','Tudás'],['t-pin','Életesemény'],['t-scroll','Emlék']])+`<div class="fh-acts">${btn('Hasznos',{toast:'Köszönöm'},'sm ghost')}${btn('Nem talált',{toast:'Rendben'},'sm ghost')}</div>`,{i:1})}
  ${sec(2,'Tovább',2)}
  ${card(row({icon:'t-gem',title:'A hét tanulságai',sub:'még nincs javaslat',on:'tanulsagok'}),{i:2})}`);
}
function napok(){
  const D=[['H','szept. 21.',78,[8,6,7,9,5,7],[['t-bowl','2 840 kcal'],['t-sleep','7ó 40p'],['t-dumbbell','1× edzés'],['t-checkin','4/4']],0],['K','szept. 22.',72,[6,7,5,6,8,6],[['t-bowl','3 120 kcal'],['t-sleep','6ó 50p'],['t-checkin','3/4']],0],['Sze','szept. 23.',85,[9,8,8,8,9,8],[['t-bowl','2 950 kcal'],['t-sleep','7ó 30p'],['t-dumbbell','1× edzés'],['t-checkin','4/4']],0],['Cs','szept. 24.',null,[3,0,0,0,6,0],[['t-sleep','7ó 10p'],['t-checkin','1/4'],['t-note','jegyzet']],1],['P','szept. 25.','f'],['Szo','szept. 26.','f'],['V','szept. 27.','f']];
  const six=v=>`<span class="en-six">${v.map((x,i)=>`<i class="${i===3?'gp':''}"><b style="height:${x*10}%"></b></i>`).join('')}</span>`;
  return P({title:'A hét napjai',sub:'A heted · szept. 21–27.',back:'het'},`
  ${nhero({lbl:'Mért napok',n:'4',unit:'/ 7',art:'t-sun',verdict:'A szerda volt a legjobb napod.',sub:'Koppints egy napra, és megnyílik A napom oldala.',body:cells([['Sze 85','','legjobb nap'],['K 72','','leggyengébb'],['1','','tanulom']])})}
  ${sec(1,'Napról napra · hat kis edény',1)}
  ${card(`<div class="en-sixl"><span>tápanyag · minőség · edzés</span><span>alvás · logolás · ritmus</span></div>`+D.map(d=>d[2]==='f'?`<div class="fh-row en-dayr en-dim"><span class="dl"><b>${d[0]}</b><small>${d[1]}</small></span><span class="g">${six([0,0,0,0,0,0])}<small>még előtted · ide majd a nap adatai jönnek</small></span></div>`
    :`<button class="fh-row en-dayr ${d[5]?'now':''}" data-toast="${d[0]}: A napom oldala (Nap)"><span class="dl"><b>${d[0]}</b><small>${d[1]}${d[5]?' · ma':''}</small></span><span class="g">${six(d[3])}${chips(d[4].map(x=>x[1]))}</span><span class="en-q ${d[2]?(d[2]>=80?'ok':''):'lrn'}">${d[2]??'tanulom'}${d[2]?'<small>/ 100</small>':''}</span></button>`).join('')
    +note('A hat kis edény a nap részpontszáma: balra a tápanyag, a minőség és az edzés, jobbra az alvás, a logolás és a ritmus.'),{i:1})}`);
}
const SIG=['Fehérjebevitel','Alvásminőség','Lépésszám','Koffein','Hangulat','Esti képernyőidő','Edzésnap','Stressz','Reggeli check-in','Hála-napló'], SIG2=['másnapi energia','fókusz','étvágy','pihentség','edzésteljesítmény','türelem'];
const PATS=[['A késői lefekvés a másnapi napstruktúrát is gyengítheti','előléptetve'],...Array.from({length:13},(_,i)=>[`${SIG[i%10]} és ${SIG2[i%6]}`,'előléptetve']),['Edzésnapokon mélyebben alszol','erősödött'],['A munkahelyi fókusz nehézsége összefügghet a gyengébb mentális közérzettel','erősödött'],['A hirtelen mérlegemelkedés fokozhatja az aznapi stresszt','erősödött'],['Vízbevitel és napi energia','erősödött'],...Array.from({length:5},(_,i)=>[`${SIG[(i+13)%10]} és ${SIG2[(i+13)%6]}`,'megerősítve'])];
const FACTS=['A fehérjecél tartása javítja a check-in energiát','Hétköznap 23:00 után fekszel le a legtöbbször','A kedd a legsűrűbb munkanapod','Futás után jobb a hangulatod','A hétvégi reggeli rendszerint kimarad','A délutáni kávé után később alszol el'];
function felfedezesek(arg){
  const D=arg==='csend'?{p:[],f:[],l:[],m:0,r:[]}:arg==='keves'?{p:PATS.slice(1,2),f:FACTS.slice(0,1),l:[['Nyaralás kezdete','szept. 23.']],m:1,r:[['A súly csökkenő trendje folytatódik fehérjecél mellett','folyamatban']]}:{p:PATS,f:FACTS,l:[['Nyaralás kezdete','szept. 23.'],['Új munkahelyi projekt','szept. 22.'],['Költözés előkészítése','szept. 26.']],m:1,r:[['A súly csökkenő trendje folytatódik fehérjecél mellett','folyamatban']]};
  const n=D.p.length+D.f.length+D.l.length+D.r.length+D.m, o={title:'Heti felfedezések',sub:'A heted · szept. 21–27.',back:'het'};
  if(!n) return P(o,nhero({lbl:'Heti felfedezések',n:'—',art:'t-lens',verdict:'Csendes hét volt.',sub:'Nem született új minta vagy tudás. Ez nem hiba: a memória csak akkor nő, ha van mit tanulni.',body:`<div class="en-chart"><svg class="fh-chart en-surf" viewBox="0 0 300 60" aria-hidden="true"><path d="M0 22 q12.500 -6 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 V60 H0Z" style="fill:var(--liq2);opacity:.16"/></svg></div>`}));
  const cnt={};D.p.forEach(p=>cnt[p[1]]=(cnt[p[1]]||0)+1);
  const psum=['előléptetve','erősödött','megerősítve'].filter(e=>cnt[e]).map(e=>`${cnt[e]} ${e}`).join(' · ');
  const PK={'előléptetve':'plan','erősödött':'q','megerősítve':'ok'};
  const drawer=(k,items,rw,open,unit,sum)=>card((sum?`<p class="fh-note" style="margin:0 0 10px">${sum}</p>`:'')+items.slice(0,open?undefined:3).map(rw).join('')+(items.length>3?`<div class="fh-acts"><button class="fh-lk" data-ev="drawer:${k}">${open?'Kevesebb ‹':`Mind a ${items.length} ${unit} ›`}</button></div>`:''),{i:k==='p'?2:3});
  let k=1;
  return P(o,`
  ${nhero({lbl:'Új nyom a memóriában',n,art:'t-lens',verdict:'Amit a Mezo a héten magától megjegyzett.',sub:'Ezek nem javaslatok, hanem megtörtént nyomok: a hét alatt jöttek a felszínre.',
    body:`<div class="en-chart">${surfacing([[D.p.length,'minta'],[D.f.length,'új tudás'],[D.l.length,'életesemény'],[D.m,'emlékkönyv'],[D.r.length,'előrejelzés']])}</div>`})}
  ${sec(k++,'A hét kiemelt nyomai',1)}
  ${card(D.l.map(l=>row({icon:'t-pin',title:l[0],sub:`életesemény · ${l[1]}`,on:{toast:'Életesemény: a Rólad oldalon döntesz róla'}})).join('')+(D.m?row({icon:'t-scroll',title:'Új bejegyzés készült a hétről',sub:'emlékkönyv · olvasd el',on:{toast:'Emlékkönyv (Mezo)'}}):'')+D.r.map(r=>row({icon:'t-orb',title:r[0],sub:'előrejelzés',right:st(r[1],'q')+chev(),on:{toast:'Előrejelzések (Mezo)'}})).join(''),{i:1})}
  ${D.p.length?sec(k++,`Amit a memória tanult · ${D.p.length} minta`,2)+drawer('p',D.p,p=>row({icon:'t-pattern',title:p[0],right:st(p[1],PK[p[1]])+chev(),on:{toast:'Minta oldala (Mezo)'}}),S.dp,'minta',psum):''}
  ${D.f.length?sec(k++,`Új tudás · ${D.f.length}`,3)+drawer('f',D.f,f=>row({icon:'t-book',title:f,on:{toast:'Ez a tudás a Tudástárban'}}),S.df,'új tudás','a legfrissebb elöl'):''}`);
}
function tanulsagok(){
  return P({title:'A hét tanulságai',sub:'A heted · a visszatérés hete',back:'het'},`
  ${hero({lbl:'A hét tanulságai · a visszatérés hete',verdict:'Erről a Tudástárban döntesz.',sub:'A heti felismerések a Tudástár közös postaládájába kerülnek: ott egy helyen látod mindet, és egyenként elfogadhatod vagy elvetheted. Ehhez a héthez most <b>nincs javaslat</b>: az üveg üres.',left:jar(0,{val:'0',label:'javaslat'}),acts:btn('Tudástár postaládája',{toast:'Tudástár postaládája (Mezo)'})+lk('Vissza a heti értékeléshez','het')})}`);
}

/* ═══════════ FEJLŐDÉS ═══════════ */
const LIFE=[['Tudatosság','c-i-life-tudatossag',4,62,'Reggeli jelenlét'],['Szemlélet','c-i-life-szemlelet',3,40],['Konyha','c-i-life-konyha',5,78,'Kockahas','perk Lv 10'],['Pénzügyek','c-i-life-penzugyek',2,55],['Produktivitás','c-i-life-produktivitas',4,20,'Side hustle'],['Tanulás','c-i-life-tanulas',3,85],['Kapcsolatok','c-i-life-kapcsolatok',3,33,'Az utolsó barátnő'],['Regeneráció','c-i-life-regeneracio',3,48]];
const lvw=(p,lv)=>`<span class="en-lvw"><b>Lv ${lv}</b>${level(p,{h:16})}</span>`;
const skl=(n,icn,lv,p,goal,perk)=>row({icon:/^(c-|t-)/.test(icn)?icn:null,left:/^(c-|t-)/.test(icn)?'':`<span class="en-mono">${icn}</span>`,title:n,sub:[`${p}% a következőig`,goal?`→ ${goal}`:'',perk].filter(Boolean).join(' · '),right:lvw(p,lv)});
function novekedes(arg){
  const ures=arg==='ures';
  const q=(t,k)=>row({left:ck(k==='done'?'ok':k==='gone'?'gone':'open'),title:k==='gone'?`<span style="color:var(--faint)">${t}</span>`:t,sub:k==='gone'?'küldetés · csendben lejárt':k==='open'?'küldetés · nyitott':'küldetés · kész',on:k==='open'?{toast:'Küldetések · a Nap fülön'}:null});
  const wd=n=>`<span class="en-wdots">${Array.from({length:8},(_,i)=>`<i class="${i>=n?'on':''}${i===7?' now':''}"></i>`).join('')}</span>`;
  return P({title:'Fejlődés',sub:ures?'Hol tartok · az első napjaid':'Hol tartok · Daniel · A kitartó',back:'mai'},`
  ${ures?hero({lbl:'Szint 1 · 0 / 100 XP',verdict:'Ma még nincs küldetés. A reggeli briefinggel jön.',sub:'Tevékenységet közben is logolhatsz: minden log egy csepp az edénybe.',left:jar(0,{val:'Lv 1',label:'0 XP'}),acts:btn('+ Tevékenység',{toast:'Tevékenység naplózása'})+lk('Küldetések',{toast:'Küldetések · a Nap fülön'})})
   :hero({lbl:'Szint 12 · 3 140 XP összesen',verdict:'420 XP gyűlt a 13. szint edényébe.',sub:'Még <b>3 080 XP</b> a következő szintig. Ma <b>2/4 küldetés</b> megvan, <b>+45 XP</b>.',left:jar(12,{val:'Lv 12',label:'420 / 3 500'}),acts:btn('+ Tevékenység',{toast:'Tevékenység naplózása'})+lk('Küldetések',{toast:'Küldetések · a Nap fülön'})})}
  ${ures?'':sec(1,'Ma · 2/4 küldetés · +45 XP',1)+card(q('Fehérje 150 g','done')+q('Reggeli séta','done')+q('Esti nyújtás','open')+q('Heti meal prep','gone')
    +row({icon:'t-pencil',title:'Meal prep a hétre',sub:'tevékenység · +15'})+row({icon:'t-pencil',title:'Pénzügyek rendezése',sub:'tevékenység · +20'}),{i:1})}
  ${sec(ures?1:2,'Fegyelem és ritmus',2)}
  ${card((ures?'':row({title:'Fegyelem',sub:'a vállalt küldetések aránya',right:`<span class="en-lvw"><b>${'82%'}</b>${level(82,{h:16})}</span>`}))
    +row({title:'Ritmus',sub:'nyolc hét, nyolc edény: tele, ha megvolt a heted',v:`${ures?1:6} hét`,right:wd(ures?7:2)}),{i:2})}
  ${sec(ures?2:3,'Részletek',3)}
  ${card(row({icon:'t-sprout',title:'Skillek',sub:ures?'':'14 skill · legjobb Lv 7',on:'skillek'})+row({icon:'t-journal',title:'Tevékenységek',sub:ures?'':'23 küldetés · 9 tevékenység · 30 nap',on:'tevekenysegek'})+row({icon:'t-record',title:'Kitüntetések',sub:ures?'':'5 / 9 jelvény · 6 napos sorozat',on:'kitunt'})
    +note('A szint visszajelzés, nem jutalom: semmi nem nyílik vagy zárul tőle. Az XP-idősort nem rajzoljuk.'),{i:3})}`);
}
function skillek(){
  const life=S.life?LIFE:LIFE.slice(0,4);
  return P({title:'Skillek',sub:'Fejlődés · képességek',back:'novekedes'},`
  ${hero({lbl:'Képességek · 14 skill',verdict:'A hát az erősséged, a konyha a legjobb LIFE skilled.',sub:'Három család, három edény: a szint a 10-es skálán áll.',
    body:tubes([{l:'LIFE · átlag',v:'Lv 3,4',p:34,ic:'t-compass'},{l:'Atlétikus · átlag',v:'Lv 5,0',p:50,ic:'t-run'},{l:'Izom · legjobb',v:'Lv 7',p:70,ic:'t-muscle'}],{h:112,cls:'wide'})})}
  ${sec(1,'LIFE · 8 skill · 1 085 XP',1)}
  ${card(life.map(l=>skl(l[0],l[1],l[2],l[3],l[4],l[5])).join('')+`<div class="fh-acts"><button class="fh-lk" data-ev="life">${S.life?'Kevesebb ‹':'Mind a 8 ›'}</button></div>`+row({icon:'t-coin',title:'Megtakarítás (30 nap)',v:'50 000 Ft'}),{i:1})}
  ${sec(2,'Atlétikus · 4 skill · átlag 5,0',2)}
  ${card([['Maximális erő','Ma',7,64],['Állóképesség','Ál',5,30],['Robbanékonyság','Ro',4,72],['Mobilitás','Mo',4,15]].map(s=>skl(s[0],s[1],s[2],s[3])).join(''),{i:2})}
  ${sec(3,'Izom · 9 izom · legjobb Lv 7',3)}
  ${card([['back-wide','Hát',7,58],['chest-mid','Mell',6,80],['shoulder-side','Váll',5,44]].map(m=>row({left:mchp(m[0],'sm'),title:m[1],sub:`${m[3]}% a következőig`,right:lvw(m[3],m[2])})).join('')+skl('Comb','Co',5,12)+`<div class="fh-acts">${lk('Mind a 9 ›',{toast:'Mind a 9 izom'})}</div>`
    +note('A szint visszajelzés, nem jutalom: semmi nem nyílik vagy zárul tőle. Az XP-idősort nem rajzoljuk.'),{i:3})}`);
}
function tevekenysegek(){
  const q=(t,m,xp)=>({time:'+'+xp,title:t,sub:`küldetés · ${m}`,right:'kész',on:{toast:t}});
  const a=(t,sk,xp,ft)=>({time:'+'+xp,title:t,sub:`tevékenység · ${sk||'besorolatlan'}${ft?` · ${ft}`:''}`,on:{toast:t}});
  const g=t=>({time:'—',title:t,sub:'küldetés · csendben lejárt',on:{toast:'Csendben lejárt: ajánlat volt'}});
  const day=a=>`<div class="en-xps rise">${stream(a)}</div>`;
  return P({title:'Tevékenységek',sub:'Fejlődés · utolsó 30 nap',back:'novekedes'},`
  ${nhero({lbl:'Utolsó 30 nap',n:'23',unit:'teljesített küldetés',art:'t-journal',verdict:'Ezen a héten hat küldetés és négy tevékenység.',sub:'Szept. 21–27. · megtakarítás e héten: <b>8 500 Ft</b>',body:cells([['6','','küldetés'],['2','','lejárt'],['4','','tevékenység'],['+120','','LIFE XP'],['8 500','Ft','megtakarítás'],['9','','tevékenység · 30 nap']])})}
  ${sec(1,'Ma · 09.24 · +45 XP',1)}
  ${day([q('10 perc séta ebéd után','reggel',15),a('Meal prep a hétre','Konyha',10,'2 000 Ft'),g('Olvass 10 oldalt')])}
  ${sec(2,'Tegnap · 09.23 · +30 XP',2)}
  ${day([q('Víz az ágy mellé','este · tevékenységgel teljesült',15),a('Kiadások átnézése','Pénzügyek',15)])}
  ${sec(3,'Szept. 22. · +10 XP',3)}
  ${day([a('Hosszú beszélgetés Petrával','',10)])}
  ${card(note('Az XP-folyam: minden bejegyzés egy csepp, előtte az érte járó XP. Utolsó 30 nap. A csendben lejárt küldetés nem hiba: ajánlat volt.'),{i:4,cls:'en-foot'})}`);
}
const BADGES=[['t-flag','Első küldetés',100,'megvan'],['t-scroll','10 küldetés',100,'megvan'],['t-record','50 küldetés',46,'23 / 50'],['t-pencil','Első tevékenység',100,'megvan'],['t-flame','4 hetes ritmus',100,'megvan'],['t-gem','Mind a 8 LIFE aktív',75,'6 / 8'],['t-brain','LIFE Lv 5',60,'Lv 3'],['t-peak','10 000 LIFE XP',31,'3 140'],['t-coin','100k megtakarítás',50,'50k']];
/* a jelvények lezárt fiolák: ami megvan, tele és dugóval zárva; a többi nyitva töltődik */
const bvials=()=>`<div class="en-bvs">${BADGES.map(b=>{const got=b[3]==='megvan';return `<button class="en-bv ${got?'got':''}" data-toast="${b[1]} · ${got?'megvan':b[3]}"><span class="v">${got?'<s></s>':''}<span class="g"><i style="height:${b[2]}%"></i>${I(b[0])}</span></span><strong>${b[1]}</strong><small>${got?'megvan · lezárva':b[3]}</small></button>`}).join('')}</div>`;
function kitunt(){
  const bolt=S.tit==='bolt';
  return P({title:'Kitüntetések',sub:'Fejlődés · jelvények, címek',back:'novekedes'},`
  ${nhero({lbl:'Jelvények',n:'5',unit:'/ 9 megvan',art:'t-record',verdict:'Viselt címed: A kitartó.',sub:'240 érméd van. Címre vagy sorozat-mentőre költheted.',body:`<div style="margin-top:12px">${level(56,{h:18,label:'5 lezárt fiola',val:'4 még töltődik'})}</div>`})}
  ${sec(1,'Jelvények · 5 / 9 megszerezve',1)}
  ${card(bvials()+note('Egy jelvény egy fiola: ha megtelik, dugó kerül rá, és a tiéd marad.'),{i:1})}
  ${sec(2,'Címek · 240 érme',2)}
  ${card(segE([['letra','Létra'],['bolt','Bolt']],S.tit,'tit')+(bolt?row({icon:'t-coin',title:'Az éjjeli bagoly',sub:'120 érme',right:btn('Megveszem',{toast:'Megvetted'},'sm ghost')})+row({icon:'t-coin',title:'A reggeli ember',sub:'180 érme',right:btn('Megveszem',{toast:'Megvetted'},'sm ghost')})+note('A sorozat-mentő is itt vehető.')
    :row({title:'Az újonc',sub:'Lv 1',right:btn('felvesz',{toast:'Felvetted: Az újonc'},'sm ghost')})+row({title:'A kitartó',sub:'Lv 5',right:st('viselve','ok')})+row({title:'A mester',sub:'Lv 10',right:st('Lv 10-től','q')})),{i:2})}
  ${sec(3,'Perkek · 3 feloldva',3)}
  ${card([['Páncélzat','10 hét töretlen: a sérülésállóság nő','Maximális erő'],['Tűzhely-mester','heti 3 meal prep: kevesebb döntés','Konyha'],['Csendes óra','reggeli jelenlét: a fókusz nő','Tudatosság']].map(p=>row({title:p[0],sub:`${p[1]} · ${p[2]}`,right:st('Lv 10','q')})).join(''),{i:3})}
  ${sec(4,'Sorozat',4)}
  ${card(row({icon:'t-flame',title:'6 nap egymás után',sub:`következő mérföldkő: 30 nap · +150 érme · bármilyen mai log életben tartja<br>${level(20,{h:14,val:'6 / 30 nap'})}`})+row({icon:'t-shield',title:'Sorozat-mentő',sub:'200 érme · nálad: 1/2',right:btn('Megveszem',{toast:'Megvetted · 2/2'},'sm ghost')})
    +note('Az érme itt költhető el: címre vagy sorozat-mentőre. Semmi más nem vásárolható, és semmi nem jár le.'),{i:4})}`);
}

/* ═══════════ NAPLÓ ═══════════ */
function naplo(){
  const done=S.dec==='done';
  const N=[['Ma','Ma reggel nagyon nyugodt voltam a meeting előtt, a légzőgyakorlat tényleg segít.','napló'],['Tegnap','Hálás vagyok Petrának, hogy végighallgatott a munkás dologgal.','hála'],['09. 22.','Túl sokat vállaltam a héten. Jövő héten egy estét szabadon hagyok.','napló'],['09. 21.','Heti négy edzés: meglátjuk, belefér-e.','döntés']];
  return P({title:'Napló',sub:'Én · 12 bejegyzés',tab:'naplo'},`
  ${hero({lbl:`Döntés · tegnap · ${done?'visszanézve':'nézd vissza'}`,verdict:done?'Visszanézted: 4 az 5-ből.':'Egy döntésed vár visszanézésre.',sub:'„Szeptembertől heti négy edzésre váltok háromról.”',left:hart('t-compass'),
    body:done?'':`<p class="fh-note" style="margin-top:12px">Mennyire vált be? (1–5)</p><div class="en-rate">${[1,2,3,4,5].map(n=>`<button data-ev="dec:done" aria-label="${n} az 5-ből">${n}${n===5?'<small>bevált</small>':''}</button>`).join('')}</div>`,
    acts:btn('+ Új bejegyzés',{sheet:'journal'})+(done?lk('Mi lett belőle?',{sheet:'decision'}):'')})}
  ${sec(1,'2026. szeptember · a folyam',1)}
  <div class="en-jst rise">${stream(N.map((n,i)=>({time:n[0],title:n[1],sub:n[2],now:!i,on:{sheet:'journal'}})))}</div>
  ${card(`<div class="fh-acts" style="margin-top:0">${lk('Korábbi hónapok',{toast:'Augusztus betöltése'})}</div>`,{i:1,cls:'en-foot'})}
  ${sec(2,'Hálanapló',2)}
  ${card(row({icon:'t-heart',title:'Hálanapló',sub:'12 bejegyzés · 5 nap egymás után · él a sorozat',right:d7(['hit','hit','hit','hit','hit','nd','nd'])+chev(),on:{toast:'Hála · új sor a lapon'}}),{i:2})}`);
}

/* ═══════════ EMBEREK ═══════════ */
/* egy ember jelenléte az életedben = egy edény: a szint az összes említés, a világos felső réteg az e heti */
const pplTubes=()=>tubes(PEOPLE.map(p=>({cap:av(p,'sm'),l:p.n,v:p.all,p:(p.all-p.w)/41*88,p2:p.w/41*88||0,c:p.t==='nehez'?'var(--warn)':'var(--dom)',on:'ember'})),{h:96,cls:'ppl'});
function emberek(){
  return P({title:'Emberek',sub:'Hol tartok · 6 aktív kör',back:'mai'},`
  ${hero({lbl:'Kapcsolatok · 6 aktív kör',verdict:'Petra a legtöbbet említett; Bence hangulata lejt.',sub:'Hat ember, hat edény: a szint az összes említés, a világos felső réteg az e heti.',body:pplTubes()+facts([['8','említés · hét'],['Petra','legtöbbet említett'],['Bence ↘','hangulat-lejtő']]),acts:btn('Log',{sheet:'plog'})+lk('+ Új személy',{sheet:'pedit'})})}
  ${sec(1,'A köröd',1)}
  ${card(row({icon:'t-lens',title:'Jelöltek',sub:'Marci · új arc a szövegeidben',v:'1',on:'jeloltek'})
    +row({left:`<span class="en-pile">${PEOPLE.slice(0,4).map(p=>av(p)).join('')}</span>`,title:'A köröm',sub:'6 személy · Petra a legaktívabb',on:'kor'})
    +row({icon:'t-chat',title:'Említések',sub:'8 e héten · 1 figyelem-jelzés',v:'8',on:'emlitesek'})+row({icon:'t-calendar',title:'Heti kép',sub:'Bence ↘ · Petra ↗ · a hét iránya',on:'heti'})
    +note('Az emberek a szövegeidből, a hangjegyeidből és a Mezo-beszélgetésekből kerülnek ide.'),{i:1})}`);
}
function jeloltek(arg){
  const e=arg==='ures', id=uid('ej');
  const art=`<svg class="en-newd" viewBox="0 0 110 132" aria-hidden="true"><defs>${grad(id,1,1)}<clipPath id="${id}c"><rect x="14" y="62" width="82" height="64" rx="24"/></clipPath></defs>
    ${e?'':`<path d="M55 4C55 4 37 26 37 38a18 18 0 0 0 36 0C73 26 55 4 55 4Z" fill="url(#${id})"/><ellipse cx="48" cy="30" rx="4" ry="2.500" fill="#fff" opacity=".8" transform="rotate(-30 48 30)"/><text class="bn" x="55" y="45" text-anchor="middle" style="font-size:16px;fill:#fff">M</text>`}
    <rect x="14" y="62" width="82" height="64" rx="24" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="2"/><g clip-path="url(#${id}c)"><path d="M14 88q10-6 20.500 0t20.500 0t20.500 0t20.500 0V126H14Z" fill="url(#${id})" opacity=".85"/>
    ${[[30,104],[46,112],[62,102],[78,110],[38,118],[70,119]].map(c=>`<circle cx="${c[0]}" cy="${c[1]}" r="5.500" fill="#fff" opacity=".8"/>`).join('')}</g></svg>`;
  return P({title:'Jelöltek',sub:'Emberek · új arcok',back:'emberek'},`
  ${e?hero({lbl:'Jelöltek · 0',verdict:'Nincs több jelölt.',sub:'Az éjszakai kör hajnalban néz újra. A köröd hat embere a helyén van.',left:art})
   :hero({lbl:'1 jelölt · visszatérő név · éjszakai kör',verdict:'Marci: új arc a szövegeidben.',sub:'Egy új csepp a köröd fölött. Te döntöd el, belekerül-e.',left:art,body:`<blockquote class="en-bq">„…délben futottam Marcival a gáton, jó tempót diktált…”</blockquote>`,acts:btn('Felveszem',{sheet:'pedit'})+lk('Nem ő az / nem kell','jeloltek.ures')})}
  ${card(note('Jelöltet csak visszatérő, ismeretlen név kap. Az elvetett nevet nem javasolja újra.'),{i:1,cls:'en-foot'})}`);
}
function kor(){
  return P({title:'A köröm',sub:'Emberek · 6 személy',back:'emberek'},`
  ${hero({lbl:'A köröm · 6',verdict:'Hat ember, Petra a legaktívabb.',sub:'Mindenkinél egy szalag: a kapcsolat <b>hangulat-íve</b> az utolsó hét hétben.',left:`<span class="en-pile big">${PEOPLE.slice(0,3).map(p=>av(p)).join('')}</span>`,acts:btn('+ Új személy',{sheet:'pedit'})})}
  ${sec(1,'Akik körülötted vannak',1)}
  ${card(PEOPLE.map(p=>row({left:av(p),title:p.n,sub:`${p.r}<br>${p.w}× e héten · ${p.all} említés · ${p.cx}`,right:`<span class="en-lsw ${p.t==='nehez'?'wn':''}">${lspark(p.sp,64,30,2,10)}</span>`+chev(),on:'ember'})).join('')
    +note('A szalag a kapcsolat hangulat-íve, mellette a jellemző helyzetek. A sárga azt jelzi, ahol a hét nehéz tónusú volt.'),{i:1})}`);
}
const MEN=[['bence','t-journal','18:42 · napló','Bence-vel röpi után gyors sör, de feszült volt a meccs miatt.','edzés','nehez',true,'Volleyball · 17:30–19:00'],['reka','t-mic','22:18 · hang','Réka hívott · másfél óra, sokat segített a céges ügyben.','segítség','jo',false,'Hangjegy · 22:18'],['petra','t-journal','20:14 · napló','Petrával hosszú vacsi, csendben, jó volt.','közös program','jo',false,''],['adam','t-chat','12:05 · Mezo-chat','Ádámmal átnéztük a portfólióját.','munka','ok',false,'']];
function emlitesek(){
  const R=[['H',2,'jo'],['K',1,'ok'],['Sze',3,'nehez'],['Cs',1,'jo'],['P',0,''],['Szo',0,''],['V',1,'jo']];
  return P({title:'Említések',sub:'Emberek · a hét ritmusa',back:'emberek'},`
  ${nhero({lbl:'Említés e héten',n:'8',art:'t-chat',verdict:'Szerdán volt a legtöbb, egy figyelem-jelzéssel.',sub:'Egy említés egy csepp. A sárga csepp nehéz tónusú volt.',
    body:`<div class="en-dropd" role="img" aria-label="A hét ritmusa: 8 említés">${R.map((d,i)=>`<div class="${i===3?'today':''}"><span>${Array.from({length:d[1]},(_,j)=>`<i class="${d[2]==='nehez'&&j===0?'wn':''}"></i>`).join('')||'<u></u>'}</span><small>${d[0]}</small></div>`).join('')}</div>`,acts:btn('Log',{sheet:'plog'})})}
  ${sec(1,'Mit írtál róluk',1)}
  ${card(segE([['mind','Mind'],['het','Hét']],S.pf,'pf')+MEN.map(m=>{const p=PEOPLE.find(x=>x.id===m[0]);return row({left:av(p),title:`${p.n} <span class="en-meta">${m[2]}</span>`,sub:`<span class="en-body">${m[3]}</span>${chips([m[4],TONE[m[5]],...(m[6]?['<b style="color:var(--warn)">figyelem</b>']:[]),...(m[7]?[`kapcsolódik · ${m[7]}`]:[])])}`,right:['t-journal','t-chat'].includes(m[1])?`<button class="en-x" data-toast="Visszavonva" aria-label="Visszavon">✕</button>`:bub(m[1],{s:30})})}).join('')
    +note('Tónus: Jó · OK · Vegyes · Nehéz (ez kap színt) · kontextus: munka, edzés, közös program, konfliktus'),{i:1,cls:'en-top'})}`);
}
function heti(){
  const dirs=[[PEOPLE[1],'↘','többször nehéz tónus, mint korábban'],[PEOPLE[0],'↗','több közös program'],[PEOPLE[3],'→','kiegyensúlyozott']];
  return P({title:'Heti kép',sub:'Emberek · a hét tónusa',back:'emberek'},`
  ${nhero({lbl:'Említés e héten · a hét tónusa',n:'8',art:'t-calendar',verdict:'Többnyire jó tónus, egy nehéz pillanattal.',sub:'Egy edény, négy réteg: ennyi jutott a hétből mindegyik tónusra.',
    body:`<div style="margin-top:14px">${strata([[4,'jó','ok'],[2,'OK',''],[1,'vegyes','fa'],[1,'nehéz','wn']])}</div>`})}
  ${sec(1,'Irányok · 7 nap',1)}
  ${card(dirs.map(d=>row({left:av(d[0]),title:`${d[0].n} ${arr(d[1])}`,sub:`${d[2]} · ${d[0].w}× e héten`,right:`<span class="en-lsw ${d[0].t==='nehez'?'wn':''}">${lspark(d[0].sp,64,30,2,10)}</span>`+chev(),on:'ember'})).join(''),{i:1})}
  ${sec(2,'A hét pillanata',2)}
  ${card(row({left:av(PEOPLE[3]),title:`Réka <span class="en-meta">péntek 22:18 · napló</span>`,sub:'<span class="en-body">„Réka hívott · másfél óra, sokat segített a céges ügyben.”</span>'}),{i:2,cls:'en-top'})}
  ${sec(3,'Csendben maradt · 1',3)}
  ${card(row({left:av(PEOPLE[4]),title:'Márk',sub:'10 napja · Mentee. Jólesne neki egy jel?',right:btn('Írok neki',{sheet:'plog'},'sm ghost')})
    +note('Az irányok és a tónus-sáv az e heti említésekből jönnek. A hétfői heti áttekintés erre is kitér.'),{i:3})}`);
}
function ember(){
  const p=PEOPLE[0];
  return P({title:p.n,sub:'A köröm · '+p.r,back:'kor'},`
  ${hero({lbl:p.r,verdict:'41 említés, e héten háromszor. A hangulat jó.',left:av(p,'lg'),body:cells([['41','','összes'],['3×','','e héten'],['Jó','','hangulat']]),acts:btn('Log most',{sheet:'plog'})+lk('Szerkesztés',{sheet:'pedit'})})}
  ${sec(1,'Hangulat-ív · júl → szept',1)}
  ${card(`<div class="en-chart" style="margin-top:0" role="img" aria-label="Hangulat-ív júliustól szeptemberig: emelkedik">${area([5,6,6,7,6,8,7,8,9,8,9,10],{h:112,min:2,max:10.5,labels:['júl.','aug.','szept.']})}</div>`+note('Petra jelenléte az életedben mint vízszint: a naplóid róla szóló sorainak hangulata, hétről hétre.'),{i:1})}
  ${sec(2,'Együtt mozog',2)}
  ${card(`<div class="en-lk">${linked(73,82,{a:'Petra · 3× e héten',b:'a hangulatod · jó'})}</div>`+txt('Azokon a heteken, amikor <b>több a közös program</b>, a róla írt soraid hangulata is feljebb áll.')+note('Közlekedőedény: megfigyelés a saját naplódból, nem ítélet.'),{i:2})}
  ${sec(3,'Milyen helyzetekben',3)}
  ${card([['közös program',48],['család',30],['segítség',22]].map(c=>row({title:c[0],right:`<span class="en-lvw"><b>${c[1]+'%'}</b>${level(c[1],{h:16})}</span>`})).join(''),{i:3})}
  ${sec(4,'Kapcsolt események · gráf · 3',4)}
  ${card([['t-pin','Nyári szabadság · júl 14–21','életesemény · kapcsolódik · erős'],['t-ring','Az utolsó barátnő','cél · kapcsolódik'],['t-pattern','Hétvégi közös főzés','minta · kapcsolódik']].map(e=>row({icon:e[0],title:e[1],sub:e[2],on:{toast:'A tudástárba visz (Mezo)'}})).join(''),{i:4})}
  ${sec(5,'Amit Mezo tud',5)}
  ${card(chips(['Allergén: kagyló','konyhakerülő','reggeli ember']),{i:5})}
  ${sec(6,'Idővonal',6)}
  <div class="en-jst rise">${stream([['tegnap','20:14 · közös program · jó','Petrával hosszú vacsi, csendben, jó volt.'],['kedd','08:02 · család · OK','Petra elvitte a kocsit szervizbe.'],['hétfő','21:40 · segítség · jó','Végighallgatott a munkás dologgal.']].map(t=>({time:t[0],title:t[2],sub:t[1],on:{toast:'A bejegyzés a Naplóban'}})))}</div>`);
}


/* ═══════════ ÉRTESÍTÉSEK ═══════════ */
function ertesitesek(arg){
  const o={title:'Értesítések',sub:'Hol tartok · 11 értesítés',back:'mai'};
  if(arg==='ures') return P({...o,sub:'Hol tartok'},card(emp('t-bell','Még nincs értesítésed.'),{i:0}));
  const r=(icn,t,x,tm,u)=>step({time:tm,icon:icn,now:!!u,title:t,sub:x,on:{toast:'A kapcsolódó oldalra visz'}});
  return P(o,`
  ${nhero({lbl:'Olvasatlan',n:'3',unit:'/ 11 értesítés',art:'t-bell',verdict:'Három új dolog vár ma reggel óta.',body:`<div style="margin-top:12px">${level(27,{h:18,label:'3 új',val:'8 olvasott'})}</div>`,acts:btn('Mind olvasott',{toast:'Mind olvasott'})})}
  ${sec(1,'Ma',1)}
  ${card(r('t-pattern','Új minta vár döntésre','A késői vacsora és a felszínes alvás között erős jel rajzolódik ki…','09:12',1)+r('t-orb','Bejött egy előrejelzés','A múlt heti jóslatod a pihenőnapról beigazolódott.','08:40',1)+r('t-people','Új arc a szövegeidben','Marci · visszatérő név','07:55',1),{i:1,cls:'en-nt'})}
  ${sec(2,'Tegnap',2)}
  ${card(r('t-scroll','Elkészült a heti memoár','A hét története, hét fejezetben.','21:02')+r('t-harvest','Beérett egy szokás','Az „Ébredés időben” már magától megy.','18:30')+r('t-flask','Kísérlet: 5. nap','A koffein-cutoff kísérlet félúton jár.','09:00'),{i:2})}
  ${sec(3,'Szept. 21.',3)}
  ${card(r('t-calendar','Kész a heti áttekintés','Az egyensúly hete: 72 pont.','20:00')+r('t-book','Új tény a tudástárban','Reggel jobban megy a fókusz.','14:12')+r('t-chat','A konzílium döntött','A regeneráció most elsőbbséget kap.','11:40')
    +note('Egy sorra koppintva az olvasottá válik, és a helyére visz.'),{i:3})}`);
}

/* ═══════════ BEÁLLÍTÁSOK ═══════════ */
const DOMI={fuel:'c-i-tanyer',train:'c-i-edzes',mezo:'c-i-mezo',en:'c-i-emberek',nap:'c-i-nap'};
const srow=(icn,t,s,go,v)=>row({icon:icn,title:t,sub:s,v,on:go?(go[0]==='#'?go.slice(1):{toast:go}):null});
const sth=(lbl,h,p,icon,acts)=>hero({lbl,verdict:h,sub:p,left:hart(icon),acts});
function beall(){
  const D=[['fuel','Fuel','Táplálkozás, ahogy neked jó.','Kalória és makrók · étkezési ritmus','Fuel beállítások (a Fuel-körben kész)'],['train','Edzés','Helyet a mozgásnak.','Gym-időpontok · rendszeres sport','#b-train'],['mezo','Mezo','A közös nyelvünk.','Rólam · instrukciók · személyes kontextus','#b-mezo'],['en','Én','A tested. A céljaid.','Testprofil · súlycél · alvás','#b-me'],['nap','Nap','Jó reggeltől a pihenésig.','Napi horgonyok · emlékeztetők','#b-nap']];
  return P({title:'Beállítások',sub:'Mezo · beállítások',back:'mai'},`
  ${sth('Innen érkeztél: Én','Legyen a tiéd.','Egy helyen minden, ami hozzád igazítja a Mezót.','t-gear',btn('Én beállításai','b-me'))}
  ${sec(1,'A te területeid',1)}
  ${card(D.map(d=>srow(DOMI[d[0]],`${d[1]} <span class="en-meta">${d[2]}</span>`,d[3],d[4])).join(''),{i:1})}
  ${sec(2,'Az app körülötted',2)}
  ${card(srow('t-bell','Értesítések','Mikor és miről szóljon a Mezo','#b-ert')+srow('t-palette','Megjelenés és alkalmazás','Kalauzok, fiók, jelszó','#b-alt')+srow('t-key','Fiókod','Név és e-mail-cím','#b-fiok')
    +note('Minden terület ugyanazokat az alapadatokat használja. Amit itt javítasz, az appban is követ.'),{i:2})}`);
}
function btrain(){
  return P({title:'Edzés',sub:'Beállítások · edzés',back:'beall'},`
  ${sth('Edzés','Helyet a mozgásnak.','A terved mondja, mit. Te döntöd el, mikor. A hét többi része igazodik.','c-i-edzes')}
  ${sec(1,'A heted',1)}
  ${card(cells([['4','','gym-időpont / hét'],['2','','sportalkalom / hét']])+`<div class="en-wk7">${[['H','07:00'],['K','—',1],['Sze','07:00'],['Cs','17:30'],['P','07:00'],['Szo','10:00'],['V','—',1]].map(d=>`<span class="${d[2]?'off':''}">${d[0]}<b>${d[1]}</b></span>`).join('')}</div>`,{i:1})}
  ${sec(2,'Időpontok',2)}
  ${card(srow('t-dumbbell','Heti gym-időpontok','4 alkalom · reggel','Gym-időpontok szerkesztése (lap)')+srow('t-volley','Rendszeres sport','Röplabda · Cs, Szo','Sport-időpontok szerkesztése (lap)')+srow('t-bell','Edzésemlékeztetők','Edzés előtt 30 perccel','#b-ert')
    +note('Az időpontokból tudja a Nap és a Fuel, mikor edzel.'),{i:2})}`);
}
function bme(){
  return P({title:'Én',sub:'Beállítások · én',back:'beall'},`
  ${sth('Én','A tested, a céljaid, a pihenésed.','Az alapok változnak. A beállításaid követhetik.','c-i-emberek')}
  ${sec(1,'Alapok',1)}
  ${card(cells([['180','cm','magasság · testprofil'],['8','óra','alváscél']]),{i:1})}
  ${sec(2,'Amit állíthatsz',2)}
  ${card(srow('t-person','Testprofil','34 év · 180 cm · 15% testzsír','Testprofil szerkesztése (lap)')+srow('t-weight','Súlycél','Fogyás · 76 kg · −0,4 kg/hét','#b-cel')+srow('t-sleep','Alvás és napi horgony','23:00 lefekvés · 07:00 ébredés','Alváscél szerkesztése (lap)')+srow('t-orb','Mit tud rólam Mezo?','A személyes alapjaid','#b-szemely.about'),{i:2})}`);
}
function bcel(){
  return P({title:'Súlycél',sub:'Én beállításai · fogyás · aktív',back:'b-me'},`
  ${hero({lbl:'Fogyás · aktív · 76 kg célsúly',verdict:'Reális: a tempó belefér.',sub:'<b>78,4 kg</b> most · még <b>2,4 kg</b> · 38% teljesült',left:jar(38,{val:'38%',label:'teljesült'}),body:cells([['78,4','','most'],['2,4','kg','hátra'],['76','kg','célsúly']]),acts:btn('Cél szerkesztése',{toast:'Cél szerkesztése (lap)'})})}
  ${sec(1,'A te tempódban · célból dátum',1)}
  ${card(two(fld('Célsúly (kg)','76,0'),fld('Céltempó (kg/hét)','0,4'))+row({icon:'t-calendar',title:'Becsült céldátum · számított',sub:'reális, a tempó belefér',v:'nov. 2.'}),{i:1,cls:'en-form'})}
  ${sec(2,'Jelenleg mentett cél',2)}
  ${card([['Irány','Fogyás'],['Súlyút','80,0 → 76,0 kg'],['Célablak','W 4 / 10'],['Céltempó','−0,4 kg/hét'],['Várható céldátum','nov. 2.']].map(r=>row({title:r[0],v:r[1]})).join('')+lab('Védőkorlátok')+chips([['t-shield','Erővédelem'],['t-shield','Izomvédelem']]),{i:2})}`);
}
function bmezo(){
  return P({title:'Mezo és te',sub:'Beállítások · mezo',back:'beall'},`
  ${sth('Mezo és te','Legyen világos, mit tud rólad.','És hogyan szóljon hozzád. Amit itt megírsz, azt Mezo minden beszélgetésben szem előtt tartja.','c-i-mezo')}
  ${sec(1,'A közös nyelvünk',1)}
  ${card(txt('<b>Egy közös alap, amit te is alakítasz.</b>')+srow('t-person','Rólam','A saját szavaimmal · te alakítod','#b-szemely.about')+srow('t-chat','Így beszélj velem','Saját instrukció és tanult stílus','#b-szemely.communication'),{i:1})}
  ${sec(2,'Átlátható működés',2)}
  ${card(srow('t-orb','Ezt kapja meg Mezo','A pontos összeállított szöveg','#b-szemely.context')+srow('t-bell','Mezo jelzései','Minták, előrejelzések, összegzések','#b-ert'),{i:2})}`);
}
function bnap(){
  return P({title:'Nap',sub:'Beállítások · nap',back:'beall'},`
  ${sth('Nap','A ritmus, ami összefogja a napodat.','Jó reggeltől a lecsendesedésig.','c-i-nap')}
  ${sec(1,'A két horgony',1)}
  ${card(cells([['07:00','','ébredés'],['23:00','','pihenés']])+`<div class="en-day24" role="img" aria-label="Ébren 07:00 és 23:00 között"><i style="left:29.2%;right:4.2%"></i>${bub('t-dawn',{s:30,cls:'a'}).replace('style="','style="left:29.2%;')}${bub('t-moon',{s:30}).replace('style="','style="left:95.8%;')}</div><div class="en-ax">${[0,6,12,18,24].map(x=>`<span>${x}</span>`).join('')}</div>`+note('A nap vízszintje: a két horgony között vagy ébren, előtte és utána apály.'),{i:1})}
  ${sec(2,'Amit állíthatsz',2)}
  ${card(srow('t-dawn','Ébredés és lefekvés','A napod két horgonya','Alvás és napi ritmus (Én beállításai)')+srow('t-checkin','Check-in és napzárás','Emlékeztetők','#b-ert')+srow('t-plate','Étkezési ritmus','Étkezési ablakok','Fuel beállítások (a Fuel-körben kész)')
    +note('A Nap a többi terület időpontjaiból rakja össze a ritmusod.'),{i:2})}`);
}
function balt(){
  return P({title:'Megjelenés és alkalmazás',sub:'Beállítások · alkalmazás',back:'beall'},`
  ${sth('Megjelenés és alkalmazás','Otthon az appban.','Ugyanaz a világ. A saját fényeiddel és szokásaiddal.','t-palette')}
  ${sec(1,'Fiók',1)}
  ${card(srow('t-person','Daniel','daniel@pelda.hu','#b-fiok')+srow('t-key','Jelszó módosítása','A belépésed maradjon a tiéd','Jelszó módosítása (lap)')+srow('t-exit','Kijelentkezés','','Kijelentkezés'),{i:1})}
  ${sec(2,'Ami körülvesz',2)}
  ${card(srow('t-bell','Értesítések','18 / 22 kategória','#b-ert')+srow('t-compass','Kalauzok újranézése','Minden oldal kalauza újra megjelenik','Kész: a kalauzok újra megjelennek'),{i:2})}
  ${sec(3,'Tulajdonosi eszközök',3)}
  ${card(srow('t-coin','AI-napló','Költség és hívások','Tulajdonosi konzol (a 10. szeletben)')+srow('t-people','Admin','Meghívók · felhasználók','Tulajdonosi konzol (a 10. szeletben)'),{i:3})}`);
}
function bert(){
  const cat=(icn,t,s,on,min)=>row({icon:icn,title:t,sub:`${s}${min?` · −${min} perc`:''}`,right:tgl(on,t)});
  const hrs=[0,0,0,0,0,0,0,1,1,0,0,0,1,0,0,0,0,0,1,0,2,1,1,0];
  return P({title:'Értesítések',sub:'Beállítások · értesítések',back:'beall'},`
  ${nhero({lbl:'Tervezett ma',n:'9',unit:'értesítés',art:'t-bell',verdict:'Nyugodt ritmus, egy sűrű ablakkal.',sub:'20 és 22 óra között 4 értesítés esne.',
    body:`<div class="en-chart" role="img" aria-label="Napi terhelés óránként: 9 értesítés, a legsűrűbb 20 és 22 óra között">${area(hrs.map((h,i)=>(h+(hrs[i-1]||0)*.35+(hrs[i+1]||0)*.35)),{h:92,min:0,max:3,labels:['0','4','8','12','16','20','24']})}</div><p class="fh-note" style="margin-top:6px">A nap mint árapály: éjjel 23 és 7 között apály (csend), este 20–22 között a dagály.</p>`,
    acts:btn('Teszt értesítés küldése',{toast:'Teszt értesítés elküldve'})})}
  ${sec(1,'Csatorna',1)}
  ${card(row({icon:'t-bell',title:'Push értesítések',sub:'iPhone · engedélyezve',right:tgl(1,'Push')}),{i:1})}
  ${sec(2,'Mezo megszólal',2)}
  ${card([['t-dawn','Reggeli briefing','07:15',1],['t-note','Déli jegyzet','12:30',1],['t-score','Heti elemzés','vasárnap 19:00',1],['t-calendar','Heti összefoglaló','hétfő 08:00',0],['t-dawn','Napzárás','21:30',1,15],['t-sleep','Alvás-reakció','ébredés után',1],['t-weight','Súly-reakció','mérés után',1]].map(c=>cat(...c)).join(''),{i:2})}
  ${sec(3,'Emlékeztetők',3)}
  ${card([['t-dumbbell','Edzés előtt','30 perccel előtte',1,30],['t-syringe','Gyógyszer beadás','hétfő 20:00',1],['t-clock','Napzárás','22:00',0],['t-moon','Villanyoltás','22:45',1],['t-rested','Lecsendesítés','22:15',1],['t-checkin','Check-in','09:00',1],['t-supps','Fuel & stack','étkezésekhez',1]].map(c=>cat(...c)).join(''),{i:3})}
  ${sec(4,'Az agy eseményei',4)}
  ${card([['t-pattern','Minták','ha új jel rajzolódik ki',1],['t-book','Tudástár','új tény',0],['t-orb','Előrejelzések','ha beteljesül',1],['t-flask','Kísérletek','napi állás',1],['t-quest','Kihívások','indulás, zárás',1],['t-stack','Memória','új emlék',0],['t-compass','Döntés visszanézés','ha esedékes',1],['t-shield','Közbelépések','ha Mezo szól',1]].map(c=>cat(...c)).join('')
    +note('Az agy eseményei eseményvezéreltek: nem szerepelnek a napi terhelés előnézetben.'),{i:4})}`);
}
function bfiok(){
  return P({title:'A fiókod',sub:'Beállítások · fiók',back:'b-alt'},`
  ${sth('A fiókod','A neved és a címed.','Amivel belépsz.','t-key')}
  ${sec(1,'Adatok',1)}
  ${card(fld('Név','Daniel')+fld('E-mail-cím','daniel@pelda.hu')+`<div class="fh-acts">${btn('Fiókadatok mentése',{toast:'Fiókadatok mentve.'})}</div>`,{i:1,cls:'en-form'})}`);
}
function bszemely(mode){
  const M={about:['Rólam, a saját szavaimmal','Amit még tudj rólam','Hétköznap szoftverfejlesztő vagyok, este röpizek. A reggelek a legjobb időszakom…','t-person'],communication:['Így beszélj velem','Az én kérésem','Legyél tömör és egyenes. Ne dicsérj feleslegesen, mondd meg, ha hibázok…','t-chat'],context:['Ezt kapja meg Mezo','','','t-orb']};
  mode=M[mode]?mode:'about'; const m=M[mode];
  const sw=`<div class="en-sw rise">${seg([['Rólam','b-szemely.about',mode==='about'],['Stílus','b-szemely.communication',mode==='communication'],['Kontextus','b-szemely.context',mode==='context']])}</div>`;
  const o={title:'Mezo és te',sub:'Beállítások · '+(mode==='about'?'rólam':mode==='communication'?'stílus':'kontextus'),back:'b-mezo'};
  const top=sw+sth('Mezo · beállítások',m[0],mode==='context'?'Pontosan ez kerül minden beszélgetés elejére.':'Csak te szerkeszted. A következő beszélgetéstől érvényes.',m[3]);
  if(mode==='context') return P(o,top+sec(1,'Ami bekerül',1)+card([['Személyes alapok','bekerül','Fiók · testadatok','Daniel, 34 éves, 180 cm, 78,4 kg.'],['Saját bemutatkozás','bekerül','Rólam','Hétköznap szoftverfejlesztő vagyok…'],['Tanult stílus','nem kerül be','Így beszélj velem','A tanult profil ki van kapcsolva.']].map(s=>`<div class="fh-row en-ctx"><span class="g"><strong>${s[0]} ${st(s[1],s[1]==='bekerül'?'ok':'q')}</strong><small>forrás: ${s[2]}</small><span class="en-body">${s[3]}</span>${lk(`${s[0]} javítása ›`,{toast:'Javítás'})}</span></div>`).join('')+`<div class="fh-acts">${btn('Pontos összeállított szöveg',{toast:'Kinyitva'},'sm ghost')}</div>`,{i:1}));
  let k=1;
  return P(o,top+(mode==='about'?sec(k++,'Az alapok, amiket ismer',1)+card(txt('Daniel · 34 év · 180 cm · fogyás 76 kg-ig · heti 4 edzés'),{i:1})+sec(k++,'A tények forrása',2)+card(srow('t-key','Név és fiók','','#b-fiok')+srow('t-heart','Testadatok és életkor','','#b-me')+srow('t-weight','Súly- és edzéscéljaim','','#b-cel'),{i:2}):'')
    +sec(k++,m[1],3)+card(ta('',m[2])+`<p class="fh-note en-cnt"><span>Csak te szerkeszted</span><span>${m[2].length} / 4000</span></p>`+(mode==='communication'?row({title:'Tanult kommunikációs profil használata',right:tgl(1,'Tanult profil')}):'')+`<div class="fh-acts">${btn('Változtatások mentése',{toast:'Mentve. A következő beszélgetési fordulótól érvényes.'})}</div>`,{i:3,cls:'en-form'})
    +(mode==='communication'?sec(k++,'Amit Mezo tanult a stílusodról',4)+card(msg('mezo','<b>Tömör, adatvezérelt.</b> Rövid válaszokat szeretsz, számokkal. Az érzelmi kérdéseknél lassabb tempót.','tanult profil'),{i:4}):'')
    +sec(k++,'Átláthatóság',5)+card(srow('t-orb','Nézd meg, mi kerül be','','#b-szemely.context'),{i:5}));
}
function ikonok(){
  const NEW=[['Felfedezések · Jelöltek','t-lens','a heti felfedezések sora, a jelöltek'],['Jelek','t-signal','„Jelek · mit figyel a rendszer”'],['Légzés','t-breath','éjszakai mód · vezetett légzés'],['Ideje felkelni','t-candle','éjszakai mód · 20 perces szabály'],['LIFE Lv 5','t-brain','kitüntetések · jelvény'],['Első küldetés','t-flag','kitüntetések · jelvény'],['Jelszó és fiók','t-key','fiókod, jelszó'],['Kijelentkezés','t-exit','megjelenés és alkalmazás'],['Megjelenés','t-palette','a beállítások „Megjelenés” sora'],['Tevékenység','t-pencil','a Fejlődés tevékenység-sorai']];
  const OLD=[['t-heart','Érzelem'],['t-book','Elmélyülés'],['t-people','Kapcsolatok'],['t-compass','Értelem'],['t-record','Teljesítmény'],['t-sprout','Egészség'],['t-ring','Célok'],['t-weight','Súly'],['t-sleep','Alvás'],['t-up','Fejlődés'],['t-journal','Napló'],['t-coin','Érme'],['t-bowl','Étrendi keret'],['t-peak','Szakasz'],['t-calendar','Tervkapcsolatok'],['t-shield','Védőkorlátok'],['t-note','Javaslat'],['t-gear','Beállítás'],['t-down','Fogyás'],['t-hold','Szinten tartás'],['t-moon','Éjszakai mód'],['t-sun','Ébredés'],['t-steps','4K-séta'],['t-person','Testpásztázás'],['t-score','Heti elemzés'],['t-gem','Tanulságok'],['t-pattern','Minta'],['t-pin','Életesemény'],['t-scroll','Emlékkönyv'],['t-orb','Előrejelzés'],['t-harvest','Szokás beérett'],['t-flame','Sorozat']];
  return P({title:'Új ikonok',sub:'Hol tartok · az Én ikonjai',back:'mai'},`
  ${nhero({lbl:'Új ikonok · az Én kérte',n:'10',unit:'jel',art:'t-palette',verdict:'Mind a tíz bekerült a közös készletbe.',sub:'Az előző körben még helyettesítőkkel dolgoztam. Most már a saját jelük áll minden sorban.'})}
  ${sec(1,'A tíz jel és ahol megjelenik',1)}
  ${card(`<div class="en-icg">${NEW.map(m=>`<div>${bub(m[1],{s:44})}<span><strong>${m[0]}</strong><small>${m[2]}</small></span></div>`).join('')}</div>`+note('Minden ikon üvegbuborékban ül, soha nem csupaszon a fehéren. Emoji sehol.'),{i:1})}
  ${sec(2,'A meglévő készletből, így fordítjuk',2)}
  ${card(`<div class="en-icg">${OLD.map(m=>`<div>${bub(m[0],{s:36})}<span><strong>${m[1]}</strong></span></div>`).join('')}</div>`+note('Ezek már a közös 3D készletben voltak; az Én oldalai ugyanígy, buborékban használják őket.'),{i:2})}`);
}

/* ═══════════ LAPOK (alulról) ═══════════ */
const sheets={
  weight:()=>`${shh('t-weight','Súly','Mi a számunk ma?','Egy mérés a napodban.')}<div class="fh-big" style="margin-top:6px">78,4<small>kg · tegnap 78,6</small></div><div class="fh-pills" style="margin-top:12px">${['−0,5','−0,1','+0,1','+0,5'].map(n=>`<button class="fh-pill" data-toast="${n} kg">${n}</button>`).join('')}</div>${ta('Egy mondat · opcionális','pl. sós vacsora tegnap',true)}${save('Mentés','Mentve · 78,4 kg')}`,
  sleep:()=>`${shh('t-sleep','Alvás','Hogyan aludtunk?')}${seg([['Kézi',{toast:'Kézi mód'},true],['Screenshot',{toast:'Screenshot-mód'},false]])}${two(fld('Lefekvés','23:20'),fld('Ébredés','06:30'))}${two(fld('Alvásidő (óra)','7,1'),fld('Minőség / 10','7'))}${two(fld('Ébredések éjjel','1'),fld('Ágyban (perc)','430'))}${save('Mentés','Mentve')}`,
  pillar:()=>`${shh('t-signal','Pillér','Pillér a katalógusból')}${[['Alvás',['Alvásidő','Lefekvés ideje','Minőség']],['Fuel',['Fehérje','Kalória','Rost']],['Edzés',['Edzésnapok','Heti szettek']],['Elme',['Check-in energia','Hangulat']],['Emberek',['Említett emberek']]].map(g=>`${lab(g[0])}<div class="fh-pills">${g[1].map(n=>`<button class="fh-pill" data-toast="${n} hozzáadva">${n}</button>`).join('')}</div>`).join('')}<div class="fh-acts" style="justify-content:flex-end"><button class="btn sm ghost" data-close>Mégse</button></div>`,
  stats:()=>`${shh('t-book','A kutatás számai','Miért számít az alvás?')}${[['A rendszeresség a király','Az azonos lefekvési idő erősebben jár együtt a jó közérzettel, mint az alvás hossza.'],['7 óra alatt','Kevesebb REM és mély alvás. A regeneráció a második felében történik.'],['Az éjszakai ébredés normális','Egy-két rövid ébredés minden éjszaka része.']].map(r=>row({title:r[0],sub:r[1]})).join('')}<div class="fh-acts" style="justify-content:flex-end"><button class="btn sm ghost" data-close>Bezár</button></div>`,
  journal:()=>`${shh('t-journal','Napló','Mi jár a fejedben?','A gondolataidnak itt van helye.')}${seg([['Napló',{toast:'Napló mód'},true],['Döntés',{toast:'Döntés mód'},false],['Hála',{toast:'Hála mód'},false]])}${ta('','Ma reggel sokkal nyugodtabb voltam a meeting előtt, a légzőgyakorlat tényleg segít. Holnap is megcsinálom.')}${fld('Dátum','2026. 09. 24.')}${save('Mentés','Mentve')}`,
  decision:()=>`${shh('t-compass','Döntés','Mennyire vált be? (1–5)')}<div class="en-rate">${[1,2,3,4,5].map(n=>`<button class="${n===4?'on':''}" data-toast="${n} / 5">${n}</button>`).join('')}</div>${ta('Mi lett belőle? (nem kötelező)','Három hét után belefér, a péntek a nehéz.')}${save('Mentés','Mentve')}`,
  plog:()=>`${shh('t-people','Emberek · gyors log','Mit jegyzünk meg?')}${lab('Ki?')}<div class="fh-pills">${PEOPLE.slice(0,5).map((p,i)=>`<button class="fh-pill ${i?'':'on'}" data-toast="${p.n}">${p.n}</button>`).join('')}</div>${lab('Hogy érzed')}<div class="fh-pills">${Object.values(TONE).map((t,i)=>`<button class="fh-pill ${i?'':'on'}" data-toast="${t}">${t}</button>`).join('')}</div>${ta('Egy mondat · opcionális','pl. „Petrával hosszú vacsi, csendben”',true)}${save('Mentés','Mentve')}`,
  pedit:()=>`${shh('t-person','Emberek','Új személy')}${fld('Név','Marci')}${fld('Becenév','pl. Marcika',true)}${lab('Kapcsolat')}<div class="fh-pills">${['Barát','Család','Kolléga','Csapattárs','Ismerős'].map((k,i)=>`<button class="fh-pill ${i===4?'on':''}" data-toast="${k}">${k}</button>`).join('')}</div>${ta('Jegyzet','honnan ismered, mi fontos…',true)}${save('Felveszem','Felvéve')}`,
  gate:()=>`${shh('t-heart','Új cél','Előbb: a biometriád','A súlycélhoz tudnom kell, kiből indulunk.')}<p class="fh-txt" style="margin-top:8px">Hiányzik: nem. Egyszeri beállítás · kb. 20 mp.</p><div class="fh-acts" style="justify-content:flex-end"><button class="btn sm ghost" data-close>Mégse</button>${btn('Biometria beállítása →','sulyuj.1','sm')}</div>`,
};

/* ═══════════ regisztráció, nézet-állapot ═══════════ */
const routes={mai:hub,en:hub,celok,cel,celuj,jelek,sulycel,sulyresz,sulyuj,test,suly:()=>test(''),alvas:()=>test('alvas'),ejszaka,het,elemzes,napok,felfedezesek,tanulsagok,
  novekedes,skillek,tevekenysegek,kitunt,naplo,emberek,jeloltek,kor,emlitesek,heti,ember,ertesitesek,
  beall,'b-train':btrain,'b-me':bme,'b-cel':bcel,'b-mezo':bmezo,'b-nap':bnap,'b-alt':balt,'b-ert':bert,'b-fiok':bfiok,'b-szemely':bszemely,ikonok};
const live=()=>{const ph=document.getElementById('phone');return F.D==='en'&&ph&&ph.dataset.v==='feher'?ph:null};
function soft(){const ph=live();if(!ph)return;const sc=ph.querySelector('.scroll');const y=sc?sc.scrollTop:0;ph.innerHTML=(routes[F.R]||hub)(F.ARG);ph.querySelectorAll('.rise').forEach(e=>e.classList.remove('rise'));const s2=ph.querySelector('.scroll');if(s2)s2.scrollTop=y}
document.addEventListener('click',e=>{
  if(!live())return; const el=e.target.closest('[data-ev]'); if(!el)return;
  e.preventDefault(); const raw=el.dataset.ev, c=raw.indexOf(':'), k=c<0?raw:raw.slice(0,c), v=c<0?'':raw.slice(c+1);
  if(k==='tgl'){el.classList.toggle('on');return}
  if(k==='dim'){el.classList.toggle('on');return}
  if(k==='save'){F.closeSheet();F.toast(v);return}
  if(k==='wk'){S.wk=S.wk===+v?-1:+v}
  else if(k==='stn'){S.stn=S.stn===+v?-1:+v}
  else if(k==='drawer'){if(v==='p')S.dp=!S.dp;else S.df=!S.df}
  else if(k==='life'){S.life=!S.life}
  else S[k]=v;
  soft();
});
/* the kit's title-bar bell and gear only toast; in the Én domain they open the Én pages the live app opens */
document.addEventListener('click',e=>{
  if(!live())return; const b=e.target.closest('.fh-top .fh-ib[aria-label]'); if(!b||b.dataset.go)return;
  const to=b.getAttribute('aria-label')==='Értesítések'?'ertesitesek':b.getAttribute('aria-label')==='Beállítások'?'beall':'';
  if(!to)return; e.preventDefault();e.stopPropagation();F.go(to);
},true);
register('en',{title:'Én',
  tabs:[['Hol tartok','mai'],['Test','test'],['Célok','celok'],['Napló','naplo']],
  routes,sheets,
  css:`
${E} .fh-card>.fh-row{border-top:1px solid var(--hair);padding:12px 0}
${E} .fh-card>.fh-row:first-child,${E} .fh-card>.fh-h+.fh-row{border-top:0;padding-top:0}
${E} .fh-card>.fh-row:last-child{padding-bottom:0}
${E} .fh-row .g{overflow-wrap:anywhere} ${E} .fh-step .g{overflow-wrap:anywhere}
${E} .fh-row .v s{color:var(--faint);font-weight:500}
${E} .fh-hero .sub b{color:var(--ink);font-weight:650}
${E} .fh-hero.n .fh-art{width:72px;height:72px;right:14px;top:12px} ${E} .fh-hero.n .fh-art svg.ic{width:72px;height:72px}
${E} .en-hn{margin:8px 0 12px;padding-right:84px} ${E} .en-hn small{white-space:nowrap}
${E} .en-sw{margin:12px 14px 0} ${E} .en-sw .fh-seg{margin:0;background:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(15,30,51,.06)}
${E} .en-chart{margin:12px 0 2px} ${E} svg .gl{font-family:var(--ff);font-size:9.5px;font-weight:500;fill:var(--faint)}
${E} .en-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;color:var(--sub);margin-top:8px}
${E} .en-leg i{display:inline-block;width:14px;height:3px;border-radius:2px;background:var(--dom);vertical-align:middle;margin-right:6px}
${E} .en-leg i.raw{width:6px;height:6px;border-radius:50%;background:var(--faint)} ${E} .en-leg i.pl{background:none;border-top:1.5px dashed var(--faint);height:0;border-radius:0}
${E} .en-leg i.tol{height:8px;background:color-mix(in srgb,var(--dom) 14%,#fff)} ${E} .en-leg i.bd{height:8px;background:color-mix(in srgb,var(--dom) 45%,#fff)}
${E} .en-leg i.st{width:8px;height:8px;border-radius:50%;background:var(--card);box-shadow:inset 0 0 0 1.4px var(--ink)} ${E} .en-leg i.ink{width:6px;height:6px;border-radius:50%;background:var(--ink)}
${E} .en-leg i.wn{height:8px;background:var(--warn)} ${E} .en-leg i.ok{height:8px;background:var(--ok)} ${E} .en-leg i.fa{height:8px;background:var(--faint)}
${E} .en-slband{display:flex;align-items:flex-end;gap:4px;height:20px;margin-top:10px} ${E} .en-slband i{flex:1;background:color-mix(in srgb,var(--dom) 45%,#fff);border-radius:3px 3px 0 0}
${E} .en-stn{margin-top:12px;padding:12px 14px;border-radius:14px;background:color-mix(in srgb,var(--dom) 9%,#fff);font-size:13.5px;line-height:1.45} ${E} .en-stn b{display:block;font-family:var(--disp);font-size:15px;margin-bottom:2px}
${E} .en-stn+.fh-row,${E} .fh-note+.fh-row{margin-top:12px}
${E} .en-cells{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
${E} .en-cells div{min-width:0;padding:10px 8px;border-radius:14px;background:rgba(255,255,255,.72);box-shadow:inset 0 0 0 1px rgba(15,30,51,.06);text-align:center}
${E} .fh-card:not(.fh-hero) .en-cells{margin-top:0} ${E} .fh-card:not(.fh-hero) .en-cells div{background:var(--page);box-shadow:none}
${E} .en-cells b{display:block;font-family:var(--disp);font-size:17px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums;line-height:1.15;display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:0 2px;white-space:nowrap}
${E} .en-cells b i{font-family:var(--ff);font-style:normal;font-size:10.5px;font-weight:500;letter-spacing:0;color:var(--sub);margin-left:2px;white-space:nowrap}
${E} .en-cells small{display:block;font-size:11px;color:var(--sub);margin-top:3px;line-height:1.25} ${E} .en-cells .att b{color:var(--warn)}
${E} .en-cells+.fh-note{margin-top:12px}
${E} .en-d7{display:inline-flex;gap:4px;vertical-align:middle;margin-top:6px} ${E} .en-d7 i{width:9px;height:9px;border-radius:50%;background:var(--dom)}
${E} .en-d7 i.part{background:linear-gradient(90deg,var(--dom) 50%,transparent 50%);box-shadow:inset 0 0 0 1.4px var(--dom)} ${E} .en-d7 i.miss{background:transparent;box-shadow:inset 0 0 0 1.4px var(--faint)} ${E} .en-d7 i.nd{background:transparent;box-shadow:inset 0 0 0 1.4px var(--hair)}
${E} .en-heat{display:inline-grid;grid-template-columns:repeat(14,10px);gap:3px;margin-top:6px} ${E} .en-heat i{width:10px;height:10px;border-radius:3px;background:var(--dom)} ${E} .en-heat i.part{opacity:.4} ${E} .en-heat i.miss{background:transparent;box-shadow:inset 0 0 0 1.2px var(--hair)}
${E} .en-arr{font-family:var(--disp);font-size:17px;font-weight:800;color:var(--sub);flex:0 0 auto} ${E} .en-arr.up{color:var(--ok)} ${E} .en-arr.dn{color:var(--warn)}
${E} .fh-pill svg.ic{filter:none}
${E} .en-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 10px} ${E} .fh-in{min-width:0;box-sizing:border-box} ${E} .en-ta{resize:none;line-height:1.45;font-size:14.5px}
${E} .fh-card>.fh-lab:first-child,${E} .fh-card>.en-two:first-child .fh-lab{margin-top:0} ${E} .en-form .fh-row{margin-top:12px}
${E} .en-cnt{display:flex;justify-content:space-between;gap:10px}
${E} .en-tgl{width:44px;height:26px;border-radius:13px;position:relative;flex:0 0 auto;background:rgba(15,30,51,.14);padding:0;transition:.2s} ${E} .en-tgl::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(15,30,51,.25);transition:.2s} ${E} .en-tgl.on{background:var(--dom)} ${E} .en-tgl.on::after{left:21px}
${E} .en-prog{display:flex;gap:5px;margin-top:14px} ${E} .en-prog i{flex:1;height:6px;border-radius:3px;background:rgba(15,30,51,.10)} ${E} .en-prog i.on{background:var(--dom)}
${E} .en-quote{font-family:var(--disp);font-size:18px;font-weight:700;letter-spacing:-.3px;line-height:1.3;text-wrap:balance}
${E} .en-tag{flex:0 0 auto;width:56px;padding:5px 0;border-radius:8px;text-align:center;font-size:10.5px;font-weight:800;letter-spacing:.5px;color:color-mix(in srgb,var(--dom) 75%,var(--ink));background:color-mix(in srgb,var(--dom) 11%,#fff)}
${E} .en-ck{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;flex:0 0 auto;margin:0 6px;box-shadow:inset 0 0 0 1.6px var(--hair);color:transparent} ${E} .en-ck svg.ic{width:16px;height:16px;stroke-width:2.4;filter:none}
${E} .en-ck.ok{background:var(--ok);box-shadow:none;color:#fff} ${E} .en-ck.warn{background:color-mix(in srgb,var(--warn) 16%,#fff);box-shadow:none;color:var(--warn)} ${E} .en-ck.open{box-shadow:inset 0 0 0 1.8px var(--dom)} ${E} .en-ck.gone{box-shadow:inset 0 0 0 1.4px var(--hair);opacity:.7}
${E} .en-rate{display:flex;gap:8px;margin-top:8px} ${E} .en-rate button{flex:1;padding:11px 0;text-align:center;border-radius:13px;font-family:var(--disp);font-size:17px;font-weight:800;color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1px rgba(15,30,51,.10)} ${E} .en-rate button.on{background:var(--dom);color:#fff;box-shadow:0 8px 14px -8px var(--dom)}
${E} .en-dialw{max-width:230px;margin:0 auto} ${E} .en-dialw small{display:block;text-align:center;font-size:11.5px;color:var(--sub);margin-top:4px}
${E} .fh-facts b{white-space:nowrap}
${E} .en-lane{position:relative;height:26px;border-radius:9px;background:var(--page);margin-top:8px;overflow:hidden} ${E} .en-lane i{position:absolute;top:0;height:100%;background:var(--dom);font-style:normal;font-size:10.5px;font-weight:650;color:#fff;padding:0 8px;line-height:26px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:9px} ${E} .en-lane i+i{background:color-mix(in srgb,var(--dom) 55%,#fff)}
${E} .en-lane i.gap{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--warn) 55%,#fff) 0 3px,color-mix(in srgb,var(--warn) 14%,#fff) 3px 8px);color:var(--ink)}
${E} .en-ruler{display:grid;grid-template-columns:repeat(20,minmax(0,1fr));margin-top:8px;font-size:8px;color:var(--faint);text-align:center;font-variant-numeric:tabular-nums} ${E} .en-ruler .now{color:var(--dom);font-weight:800}
${E} .en-spark{width:56px;height:22px;flex:0 0 auto;overflow:visible} ${E} .en-spark path{fill:none;stroke:var(--dom);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
${E} .en-car{display:grid;flex:0 0 auto;transform:rotate(90deg);transition:.2s} ${E} .en-car.open{transform:rotate(-90deg)}
${E} .en-days{margin:0 0 4px;padding:6px 12px 12px;border-radius:14px;background:var(--page)} ${E} .en-days>div:not(.fh-acts){display:flex;gap:10px;padding:7px 0;font-size:13px;border-top:1px solid var(--hair)} ${E} .en-days>div:first-child{border-top:0} ${E} .en-days span{flex:1;color:var(--sub)} ${E} .en-days b{font-weight:650;font-variant-numeric:tabular-nums} ${E} .en-days em{font-style:normal;color:var(--faint);width:40px;text-align:right;font-variant-numeric:tabular-nums}
${E} .en-rail{display:flex;height:10px;border-radius:5px;overflow:hidden;gap:2px} ${E} .en-rail i{display:block;background:var(--dom)}
${E} .en-band{position:relative;width:72px;height:8px;border-radius:4px;background:var(--page);flex:0 0 auto} ${E} .en-band s{position:absolute;top:0;height:100%;background:color-mix(in srgb,var(--ok) 45%,#fff);border-radius:4px} ${E} .en-band u{position:absolute;top:-3px;width:3px;height:14px;border-radius:2px;background:var(--ink);text-decoration:none}
${E} .en-q{font-family:var(--disp);font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;flex:0 0 auto} ${E} .fh-step .bar{width:44px;height:6px;border-radius:3px;flex:0 0 auto}
${E} .en-mb{display:inline-flex;align-items:flex-end;gap:2px;height:22px;flex:0 0 auto} ${E} .en-mb i{width:4px;background:var(--dom);border-radius:2px} ${E} .en-mb i.nd{background:var(--hair)}
${E} .en-wnav{display:inline-flex;gap:6px;margin-left:auto} ${E} .en-wnav .btn{padding:9px 14px;font-size:17px;line-height:1} ${E} .en-wnav .btn[disabled]{opacity:.4;cursor:default}
${E} .en-sbars{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:14px} ${E} .en-sbars button{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:90px} ${E} .en-sbars em{font-style:normal;font-family:var(--disp);font-size:12px;font-weight:700} ${E} .en-sbars i{width:100%;max-width:28px;background:var(--dom);border-radius:7px} ${E} .en-sbars i.nd{background:rgba(15,30,51,.10)} ${E} .en-sbars small{font-size:11px;color:var(--sub)}
${E} .en-dim{opacity:.5}
${E} .en-foot{box-shadow:none!important;background:transparent!important;padding-top:0!important;padding-bottom:0!important;margin-top:4px!important} ${E} .en-foot .fh-note{margin-top:8px}
${E} .en-mono{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:var(--page);font-family:var(--disp);font-size:14px;font-weight:800;color:var(--sub);flex:0 0 auto}
${E} .fh-row .mchp{flex:0 0 auto}
${E} .en-wdots{display:inline-flex;gap:4px;flex:0 0 auto} ${E} .en-wdots i{width:9px;height:9px;border-radius:50%;box-shadow:inset 0 0 0 1.4px var(--hair)} ${E} .en-wdots i.on{background:var(--dom);box-shadow:none} ${E} .en-wdots i.now{outline:2px solid color-mix(in srgb,var(--dom) 35%,#fff);outline-offset:1px}
${E} .en-av{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-family:var(--disp);font-size:16px;font-weight:800;color:color-mix(in srgb,var(--dom) 70%,var(--ink));background:color-mix(in srgb,var(--dom) 13%,#fff);box-shadow:0 0 0 2px #fff;flex:0 0 auto}
${E} .en-av.lg{width:76px;height:76px;font-size:32px;box-shadow:0 0 0 3px #fff,0 10px 18px -10px rgba(15,30,51,.4)} ${E} .en-av.att{box-shadow:0 0 0 2px #fff,0 0 0 4px var(--warn)}
${E} .en-pile{display:inline-flex;flex:0 0 auto} ${E} .en-pile .en-av{margin-left:-14px} ${E} .en-pile .en-av:first-child{margin-left:0} ${E} .en-pile:not(.big) .en-av{width:30px;height:30px;font-size:13px}
${E} .en-pile.big .en-av{width:52px;height:52px;font-size:21px;margin-left:-20px} ${E} .en-pile.big .en-av:first-child{margin-left:0}
${E} .en-meta{font-size:12px;font-weight:500;color:var(--sub);margin-left:4px} ${E} .en-body{display:block;font-size:13.5px;line-height:1.45;color:var(--ink);margin:3px 0 4px}
${E} .en-top .fh-row{align-items:flex-start} ${E} .en-x{width:30px;height:30px;border-radius:50%;background:var(--page);color:var(--sub);font-size:12px;flex:0 0 auto} ${E} .en-src{flex:0 0 auto} ${E} .en-src svg.ic{width:26px;height:26px}
${E} .en-ctx .fh-lk{display:block;margin-top:4px;text-align:left} ${E} .en-ctx strong{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
${E} .en-rhythm{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;align-items:end;margin-top:14px;height:74px} ${E} .en-rhythm div{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%} ${E} .en-rhythm b{display:block;width:20px;background:var(--dom);border-radius:6px} ${E} .en-rhythm small{font-size:11px;color:var(--sub)} ${E} .en-rhythm .today small{color:var(--ink);font-weight:700}
${E} .en-tone{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px;margin-top:14px} ${E} .en-tone b{display:block}
${E} .en-bars24{display:flex;align-items:flex-end;gap:2px;height:46px;margin-top:14px} ${E} .en-bars24 i{flex:1;background:color-mix(in srgb,var(--dom) 55%,#fff);border-radius:3px} ${E} .en-bars24 i.hot{background:var(--warn)} ${E} .en-ax{display:flex;justify-content:space-between;font-size:10px;color:var(--sub);margin-top:4px}
${E} .en-wk7{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center;font-size:11px;font-weight:600;color:var(--sub);margin-top:12px} ${E} .en-wk7 span{padding:8px 0;border-radius:11px;background:color-mix(in srgb,var(--dom) 10%,#fff);min-width:0} ${E} .en-wk7 b{display:block;font-size:11px;color:var(--ink);font-weight:700;margin-top:3px;font-variant-numeric:tabular-nums} ${E} .en-wk7 .off{background:var(--page)} ${E} .en-wk7 .off b{color:var(--faint)}
${E} .en-jr .fh-step{align-items:flex-start} ${E} .en-jr .fh-step strong{font-weight:550;line-height:1.4} ${E} .en-jr .fh-step time{padding-top:10px} ${E} .en-jr .fh-step .chev{margin-top:10px}
${E} .en-nt .fh-step.now{margin:0 -8px 4px;border-top:0} ${E} .fh-step[data-go],${E} .fh-step[data-sheet],${E} .fh-step[data-toast]{cursor:pointer}
${E} .en-shh{display:flex;gap:12px;align-items:center;margin-bottom:12px} ${E} .en-shh small{font-size:11px;font-weight:650;letter-spacing:.6px;text-transform:uppercase;color:color-mix(in srgb,var(--dom) 75%,var(--ink))} ${E} .en-shh h2{margin:1px 0 0} ${E} .en-shh p{font-size:13px;color:var(--sub);margin-top:2px}
${E} .sheet .fh-seg{margin-top:4px}
/* éjszakai mód: az egyetlen szándékosan sötét képernyő (éjjel használod, ne világítson) — a tinta-tokenből */
${E} .scroll.en-night{position:absolute;inset:0;background:var(--ink);color:color-mix(in srgb,#fff 58%,var(--ink));padding:72px 28px 40px;display:flex;flex-direction:column;overflow-y:auto}
${E} .en-night .eb{font-size:11px;font-weight:650;letter-spacing:.8px;text-transform:uppercase;color:color-mix(in srgb,#fff 36%,var(--ink))}
${E} .en-night h1{font-family:var(--disp);font-size:30px;font-weight:800;letter-spacing:-.8px;color:color-mix(in srgb,#fff 82%,var(--ink));margin:14px 0 10px} ${E} .en-night p{font-size:15px;line-height:1.6}
${E} .en-night .ncta{margin-top:auto;padding:15px;border-radius:16px;text-align:center;color:color-mix(in srgb,#fff 82%,var(--ink));font-size:15px;font-weight:650;width:100%;box-shadow:inset 0 0 0 1px color-mix(in srgb,#fff 18%,var(--ink))}
${E} .en-night .quitl{display:block;margin:14px auto 0;color:color-mix(in srgb,#fff 36%,var(--ink));font-size:13px;text-decoration:underline;text-underline-offset:3px;text-align:center}
${E} .en-night .nback{position:absolute;top:24px;left:22px;color:color-mix(in srgb,#fff 40%,var(--ink));font-size:13.5px}
${E} .en-night .tool{display:flex;gap:12px;align-items:center;padding:14px 0;border-top:1px solid color-mix(in srgb,#fff 10%,var(--ink));color:color-mix(in srgb,#fff 82%,var(--ink));width:100%;font-size:14.5px;text-align:left} ${E} .en-night .tool .g{flex:1} ${E} .en-night .tool small{display:block;color:color-mix(in srgb,#fff 40%,var(--ink));font-size:12.5px;margin-top:2px} ${E} .en-night .tool em{color:color-mix(in srgb,#fff 40%,var(--ink));font-style:normal}
${E} .en-night svg.ic.td{width:30px;height:30px;filter:brightness(.7) saturate(.6)} ${E} .en-night .art{display:block;margin-top:18px} ${E} .en-night .art svg.ic.td{width:64px;height:64px}
${E} .en-night .orb{width:120px;height:120px;border-radius:50%;margin:20px auto;flex:0 0 auto;background:radial-gradient(circle at 40% 35%,color-mix(in srgb,#fff 14%,var(--ink)),var(--ink));box-shadow:inset 0 0 0 1px color-mix(in srgb,#fff 12%,var(--ink))}
${E} .en-night .breath{width:140px;height:140px;border-radius:50%;margin:24px auto;flex:0 0 auto;display:grid;place-items:center;box-shadow:inset 0 0 0 1px color-mix(in srgb,#fff 22%,var(--ink));color:color-mix(in srgb,#fff 82%,var(--ink));font-size:18px}
@media (prefers-reduced-motion:no-preference){body:not(.still) ${E} .en-night .breath{animation:v-en-breath 18s ease-in-out infinite}}
@keyframes v-en-breath{0%{transform:scale(.8)}28%{transform:scale(1.1)}61%{transform:scale(1.1)}100%{transform:scale(.8)}}
${E} .en-night ul{padding-left:18px;line-height:1.7;font-size:14.5px;margin-top:6px}
/* ══════════ FOLYADÉK: az Én saját grafikái ══════════ */
${Q} .en-hart{border-radius:50%} ${Q} .en-emp .fb{margin:0 auto 10px;display:grid}
${Q} .fh-hero .fh-hrow{align-items:center} ${Q} .fh-hero .sub b{color:var(--ink);font-weight:700}
${Q} .k2-tank .k2-liq .n small{white-space:nowrap}
${Q} .en-vc .k2-vial b{font-size:17px;white-space:nowrap} ${Q} .en-vc .k2-vial small{font-size:11px} ${Q} .en-vc .k2-vials{gap:8px}
${Q} .en-m3 .k2-vials{max-width:230px;margin:0 auto;gap:14px} ${Q} .fh-hero .k2-vials{margin-top:14px;gap:8px} ${Q} .fh-hero .k2-vial b{font-size:17px;white-space:nowrap}
${Q} .en-jar{position:relative;display:inline-grid;flex:0 0 auto;width:var(--s)} ${Q} .en-jar .t{position:absolute;left:0;right:0;top:47%;text-align:center;line-height:1;pointer-events:none}
${Q} .en-jar .t b{display:block;font-family:var(--disp);font-size:calc(var(--s)*.25);font-weight:800;letter-spacing:-.04em;color:var(--ink);text-shadow:0 0 8px #fff,0 0 3px #fff,0 0 2px #fff}
${Q} .en-jar .t small{display:block;font-size:10.5px;font-weight:700;color:var(--ink);opacity:.8;margin-top:3px;text-shadow:0 0 6px #fff,0 0 2px #fff;white-space:nowrap}
${Q} .en-tubes{display:grid;gap:6px;align-items:start;margin-top:14px}
${Q} .en-tubes .c{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;text-align:center}
${Q} .en-tubes em{font-style:normal;font-family:var(--disp);font-size:13px;font-weight:800;letter-spacing:-.3px;line-height:1;white-space:nowrap;color:var(--ink);min-height:13px}
${Q} .en-tubes .t{position:relative;display:block;width:100%;max-width:36px;height:var(--h);border-radius:999px;overflow:hidden;background:linear-gradient(180deg,#fff,#F1F8FB);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.09),inset 0 5px 8px -5px rgba(10,42,60,.14),0 12px 14px -12px var(--c)}
${Q} .en-tubes .t i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 60%,#fff),var(--c))}
${Q} .en-tubes .t i::before{content:'';position:absolute;left:0;right:0;top:-4px;height:5px;background:color-mix(in srgb,var(--c) 60%,#fff);${MASK}}
${Q} .en-tubes .t u{position:absolute;left:0;right:0;background:color-mix(in srgb,var(--c) 30%,#fff);border-top:1.5px solid rgba(255,255,255,.9)}
${Q} .en-tubes .t u::before{content:'';position:absolute;left:0;right:0;top:-5px;height:5px;background:color-mix(in srgb,var(--c) 30%,#fff);${MASK}}
${Q} .en-tubes .t b{position:absolute;left:0;right:0;bottom:0;background:color-mix(in srgb,var(--c) 62%,var(--ink));opacity:.8}
${Q} .en-tubes .t s{position:absolute;left:0;right:0;height:0;border-top:1.5px dashed color-mix(in srgb,var(--ink) 60%,transparent)}
${Q} .en-tubes .t .r{position:absolute;right:4px;width:3px;border-radius:2px;background:rgba(10,42,60,.38)}
${Q} .en-tubes .t .d{position:absolute;left:50%;width:7px;height:7px;margin:0 0 -3px -3.5px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 1.5px #fff}
${Q} .en-tubes .t svg.ic{position:absolute;left:50%;bottom:7px;width:24px;height:24px;transform:translateX(-50%);filter:drop-shadow(0 3px 4px rgba(10,42,60,.3))}
${Q} .en-tubes small{font-size:10.5px;font-weight:600;color:var(--sub);line-height:1.2;min-height:12px;overflow-wrap:anywhere}
${Q} .en-tubes .c.nd .t{background:none;box-shadow:none;outline:1.5px dashed rgba(10,42,60,.16);outline-offset:-1.5px}
${Q} .en-tubes .c.now small{color:var(--ink);font-weight:800} ${Q} .en-tubes .c.now .t{box-shadow:inset 0 0 0 2px var(--liq2),0 12px 14px -12px var(--c)}
${Q} .en-tubes .c.back .t i{background:var(--faint)} ${Q} .en-tubes .c.back .t i::before{background:var(--faint)}
${Q} .en-tubes.dims{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px 6px;margin-top:0} ${Q} .en-tubes.dims .t{max-width:44px} ${Q} .en-tubes.dims .t svg.ic{width:20px;height:20px}
${Q} .en-tubes.wide .t{max-width:58px} ${Q} .en-tubes.wide em{font-size:16px} ${Q} .en-tubes.wide{gap:8px}
${Q} .en-tubes.week .t{max-width:30px} ${Q} .en-tubes.w8 .t{max-width:30px} ${Q} .en-tubes.w8 em,${Q} .en-tubes.nights em,${Q} .en-tubes.cup em{font-size:11.5px}
${Q} .en-tubes.cup .t{border-radius:6px 6px 14px 14px;max-width:30px} ${Q} .en-tubes.cup{gap:4px}
${Q} .en-tubes.nights{gap:3px} ${Q} .en-tubes.nights .t{max-width:28px}
${Q} .en-pile.big .en-av{margin-left:-12px;width:46px;height:46px;font-size:19px} ${Q} .en-pile.big .en-av:first-child{margin-left:0}
${Q} .en-pile:not(.big) .en-av{margin-left:-9px} ${Q} .en-pile:not(.big) .en-av:first-child{margin-left:0}
${Q} .en-tubes.ppl .t{max-width:34px} ${Q} .en-tubes.ppl .en-av{width:30px;height:30px;font-size:13px}
${Q} .en-tubes.steps{margin-top:14px;gap:5px} ${Q} .en-tubes.steps .t{max-width:none;border-radius:12px} ${Q} .en-tubes.steps small{font-size:10px}
${Q} .en-wkl{margin-top:14px;display:grid;gap:6px;font-size:13.5px;line-height:1.4} ${Q} .en-wkl p{display:flex;gap:9px;align-items:baseline} ${Q} .en-wkl i{flex:0 0 auto;width:9px;height:11px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:var(--ok)} ${Q} .en-wkl i.wn{background:var(--warn)}
${Q} .fh-row .fl-level{margin-top:7px;max-width:230px} ${Q} .fl-level b{font-size:10.5px} ${Q} .fl-level span{font-size:10.5px;text-shadow:0 1px 2px rgba(10,42,60,.35)}
${Q} .en-lvw{display:flex;align-items:center;gap:8px;width:128px;flex:0 0 auto} ${Q} .fh-row .g{overflow-wrap:break-word} ${Q} .en-lvw:has(>b){width:98px;gap:6px} ${Q} .en-lvw>b{min-width:30px!important}
${Q} .en-lvw.sm{width:84px;gap:6px} ${Q} .en-lvw.sm>b{min-width:30px;font-size:12px} ${Q} .en-lvw .fl-level{margin-top:0;flex:1;min-width:0} ${Q} .en-lvw>b{font-family:var(--disp);font-size:13.5px;font-weight:800;white-space:nowrap;min-width:34px;text-align:right}
${Q} .en-slband{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;height:26px;margin-top:10px;align-items:stretch} ${Q} .en-slband i{position:relative;border-radius:7px;overflow:hidden;background:#F1F8FB;box-shadow:inset 0 0 0 1.2px rgba(10,42,60,.08)} ${Q} .en-slband i b{position:absolute;left:0;right:0;bottom:0;background:color-mix(in srgb,var(--dom) 45%,#fff)}
${Q} .en-leg i.dr{width:8px;height:10px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:linear-gradient(160deg,var(--liq1),var(--liq2))} ${Q} .en-leg i.dr.off{background:none;box-shadow:inset 0 0 0 1.4px rgba(10,42,60,.2)}
${Q} .en-leg i.st{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1.4px var(--ink)} ${Q} .en-leg i.pl{background:none;border-top:1.5px dashed var(--ink);opacity:.6;height:0;border-radius:0}
${Q} .en-leg i.pr{background:none;border-top:2px dotted var(--liq2);height:0;border-radius:0} ${Q} .en-leg i.rg{width:3px;height:12px;background:rgba(10,42,60,.38)} ${Q} .en-leg i.dp{height:8px;background:color-mix(in srgb,var(--dom) 62%,var(--ink));opacity:.8}
${Q} .en-leg i.raw{background:var(--ink);opacity:.3} ${Q} .en-leg i.ln{background:var(--liq2)} ${Q} .en-leg i.sq{width:10px;height:10px;border-radius:3px}
${Q} svg .bn{font-family:var(--disp);font-weight:800;letter-spacing:-.03em;fill:var(--ink)}
${Q} .en-d7{gap:3px} ${Q} .en-d7 i{width:9px;height:17px;border-radius:5px;background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 60%,#fff),var(--dom));box-shadow:none}
${Q} .en-d7 i.part{background:linear-gradient(0deg,var(--dom) 50%,#fff 50%);box-shadow:inset 0 0 0 1.3px color-mix(in srgb,var(--dom) 55%,#fff)} ${Q} .en-d7 i.miss{background:#fff;box-shadow:inset 0 0 0 1.3px rgba(10,42,60,.2)} ${Q} .en-d7 i.nd{background:none;box-shadow:none;outline:1.2px dashed rgba(10,42,60,.2);outline-offset:-1.2px}
${Q} .en-heat{grid-template-columns:repeat(14,9px);gap:3px} ${Q} .en-heat i{width:9px;height:15px;border-radius:5px;background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 60%,#fff),var(--dom))} ${Q} .en-heat i.part{opacity:1;background:linear-gradient(0deg,var(--dom) 50%,#fff 50%);box-shadow:inset 0 0 0 1.3px color-mix(in srgb,var(--dom) 55%,#fff)} ${Q} .en-heat i.miss{background:#fff;box-shadow:inset 0 0 0 1.3px rgba(10,42,60,.2)}
${Q} .en-wdots{gap:3px} ${Q} .en-wdots i{width:9px;height:17px;border-radius:5px;background:#fff;box-shadow:inset 0 0 0 1.3px rgba(10,42,60,.2)} ${Q} .en-wdots i.on{background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 60%,#fff),var(--dom));box-shadow:none} ${Q} .en-wdots i.now{outline:2px solid color-mix(in srgb,var(--dom) 35%,#fff);outline-offset:1px}
${Q} .en-tg{display:block!important;font-family:var(--ff);font-size:11px;font-weight:500;color:var(--sub);margin:1px 0 0!important;text-align:right} ${Q} .en-pl .fh-row .v{text-align:right}
${Q} .en-dims{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 6px;text-align:center} ${Q} .en-dims span{padding:0;background:none} ${Q} .en-dims .fl-mini{width:100%} ${Q} .en-dims .fl-mini svg.ic{width:24px;height:24px;filter:drop-shadow(0 2px 3px rgba(10,42,60,.25))} ${Q} .en-dims .fl-mini .t{width:26px;height:40px} ${Q} .en-dims span.off{opacity:.55}
${Q} .en-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px} ${Q} .en-chips span{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--dom) 8%,#fff);box-shadow:inset 0 0 0 1px rgba(10,42,60,.06);font-size:11.5px;font-weight:600;color:var(--ink)} ${Q} .en-chips span:has(.fb){padding-left:4px}
${Q} .en-sum{display:flex;gap:14px;align-items:center;margin-bottom:12px} ${Q} .en-sum>div{flex:1;min-width:0} ${Q} .en-sum .fh-h{margin-bottom:8px}
${Q} .en-src28{display:grid;grid-template-columns:repeat(14,minmax(0,1fr));gap:7px 4px;margin:14px 0 4px;justify-items:center} ${Q} .en-src28 i{width:13px;height:16px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;box-shadow:inset 0 0 0 1.4px rgba(10,42,60,.18)} ${Q} .en-src28 i.on{background:linear-gradient(160deg,var(--liq1),var(--liq2));box-shadow:0 5px 7px -5px var(--liq2)}
${Q} .en-drain{display:block;height:auto;flex:0 0 auto;overflow:visible;filter:drop-shadow(0 14px 14px color-mix(in srgb,var(--liq2) 28%,transparent))} ${Q} .en-drain .dl{font-family:var(--disp);font-size:13px;font-weight:800;fill:var(--ink)} ${Q} .en-drain .dl.big{font-size:17px} ${Q} .en-drain .ds{font-family:var(--ff);font-size:9.5px;font-weight:600;fill:var(--sub)}
${Q} .en-flow{padding:30px 14px 0;margin-bottom:22px} ${Q} .en-flow .pipe{position:relative;height:22px;border-radius:999px;background:linear-gradient(180deg,#fff,#F1F8FB);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.09)}
${Q} .en-flow .pipe i{position:absolute;top:3px;bottom:3px;border-radius:999px;background:linear-gradient(90deg,var(--liq2),var(--liq1));opacity:.8}
${Q} .en-flow .pipe s{position:absolute;top:-7px;bottom:-7px;border-left:1.6px dashed var(--ok);border-right:1.6px dashed var(--ok);background:color-mix(in srgb,var(--ok) 14%,transparent);border-radius:3px}
${Q} .en-flow .pipe u.pl{position:absolute;top:-4px;bottom:-4px;width:0;border-left:2px solid var(--ink);opacity:.35}
${Q} .en-flow .pipe b{position:absolute;top:-10px;width:22px;height:27px;margin-left:-11px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:linear-gradient(160deg,var(--liq1),var(--liq2));box-shadow:0 0 0 3px #fff,0 8px 12px -6px var(--liq2);transform:rotate(180deg)}
${Q} .en-flow .pipe b em{position:absolute;left:50%;top:32px;transform:translateX(-50%) rotate(180deg);font-style:normal;font-family:var(--disp);font-size:14px;font-weight:800;color:var(--ink);white-space:nowrap}
${Q} .fh-hero.warn .en-flow .pipe b,${Q} .en-flow.off .pipe b{background:var(--warn)}
${Q} .en-flow .ax{position:relative;height:14px;margin-top:9px;font-size:10px;font-weight:600;color:var(--sub);font-variant-numeric:tabular-nums} ${Q} .en-flow .ax span{position:absolute;transform:translateX(-50%);white-space:nowrap}
${Q} .en-pourf{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:var(--sub);font-weight:600} ${Q} .en-pourf i{flex:1;height:0;border-top:1.5px dashed rgba(10,42,60,.18)} ${Q} .en-pourf b{font-family:var(--disp);font-size:14px;font-weight:800;color:var(--ink);white-space:nowrap}
${Q} .en-lane{border-radius:999px;background:#F1F8FB;box-shadow:inset 0 0 0 1.2px rgba(10,42,60,.07)} ${Q} .en-lane i{border-radius:999px;background:linear-gradient(90deg,var(--liq1),var(--liq2))}
${Q} .en-w20{display:grid;grid-template-columns:repeat(20,minmax(0,1fr));gap:2px;margin-top:4px} ${Q} .en-w20 i{position:relative;height:34px;border-radius:6px;overflow:hidden;background:#F1F8FB;box-shadow:inset 0 0 0 1.2px rgba(10,42,60,.09)}
${Q} .en-w20 i::before{content:'';position:absolute;left:0;right:0;bottom:0;height:0;background:var(--faint)} ${Q} .en-w20 i.full::before{height:100%} ${Q} .en-w20 i.now::before{height:55%} ${Q} .en-w20 i.now{box-shadow:inset 0 0 0 2px var(--liq2)}
${Q} .en-w20 i.a::before{background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 60%,#fff),var(--dom))} ${Q} .en-w20 i.a:not(.full):not(.now){background:color-mix(in srgb,var(--dom) 13%,#fff)} ${Q} .en-w20 i.b{background:color-mix(in srgb,var(--dom) 7%,#fff);box-shadow:inset 0 0 0 1.2px color-mix(in srgb,var(--dom) 30%,#fff)}
${Q} .en-w20 i.gap{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--warn) 50%,#fff) 0 3px,color-mix(in srgb,var(--warn) 12%,#fff) 3px 7px)}
${Q} .en-lk{margin:12px 0 2px} ${Q} .en-lk .fl-link{max-width:100%}
${Q} .en-dj{flex:0 0 auto;display:grid;place-items:center;width:50px} ${Q} .en-dj .fl-fill{filter:drop-shadow(0 6px 6px color-mix(in srgb,var(--liq2) 30%,transparent))}
${Q} .en-hseg{margin-top:14px} ${Q} .en-hseg .fh-seg{margin:0;background:rgba(10,42,60,.05)} ${Q} .fh-hero .en-leg{margin-bottom:2px}
${Q} .en-tapw{display:flex;gap:14px;align-items:center;margin-bottom:6px} ${Q} .en-tapw>div{flex:1;min-width:0} ${Q} .en-tap{width:112px;height:auto;flex:0 0 auto;overflow:visible;filter:drop-shadow(0 10px 10px color-mix(in srgb,var(--liq2) 28%,transparent))}
${Q} .en-ls{width:60px;height:24px;flex:0 0 auto;overflow:visible} ${Q} .en-ls path{fill:color-mix(in srgb,var(--c,var(--dom)) 24%,#fff);stroke:none} ${Q} .en-ls path.ln{fill:none;stroke:var(--c,var(--dom));stroke-width:2;stroke-linecap:round}
${Q} .en-lsw{flex:0 0 auto;display:block;padding:5px 7px 0;border-radius:12px;background:#F4FAFC;box-shadow:inset 0 0 0 1.2px rgba(10,42,60,.07);overflow:hidden;line-height:0} ${Q} .en-lsw .en-ls{width:64px;height:30px} ${Q} .en-lsw.wn{--c:var(--warn)}
${Q} .en-bed{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center} ${Q} .en-bed span{display:flex;flex-direction:column;align-items:center;gap:4px} ${Q} .en-bed b{font-family:var(--disp);font-size:14px;font-weight:800}
${Q} .en-lastn{display:flex;justify-content:space-between;align-items:flex-end;gap:10px} ${Q} .en-lastn .q{font-size:28px;text-align:right} ${Q} .en-lastn .q small{font-size:12px}
${Q} .en-rail{height:16px;border-radius:999px;gap:0;background:#F1F8FB;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.08)} ${Q} .en-rail i{background:var(--liq2)}
${Q} .en-band{width:84px;height:12px;border-radius:999px;background:#F1F8FB;box-shadow:inset 0 0 0 1.2px rgba(10,42,60,.08)} ${Q} .en-band s{border-radius:999px} ${Q} .en-band u{top:-4px;width:3px;height:20px}
${Q} .en-nl .fh-step time{font-size:13px}
${Q} .en-cells.nine div{position:relative;overflow:hidden;isolation:isolate;background:linear-gradient(180deg,#fff,#F4FAFC);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.07);padding:14px 6px 12px;border-radius:18px}
${Q} .en-cells.nine div::before{content:'';position:absolute;z-index:-1;left:0;right:0;bottom:0;height:var(--p);background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 13%,#fff),color-mix(in srgb,var(--dom) 24%,#fff))}
${Q} .en-cells.nine div::after{content:'';position:absolute;z-index:-1;left:0;right:0;bottom:calc(var(--p) - 1px);height:6px;background:color-mix(in srgb,var(--dom) 13%,#fff);${MASK2}}
${Q} .en-cells.nine div[style*="--p:0%"]::after{display:none}
${Q} .en-cells.nine .att::before{background:linear-gradient(180deg,color-mix(in srgb,var(--warn) 40%,#fff),color-mix(in srgb,var(--warn) 62%,#fff))} ${Q} .en-cells.nine .att::after{background:color-mix(in srgb,var(--warn) 40%,#fff)} ${Q} .en-cells.nine .att b{color:var(--ink)} ${Q} .en-cells.nine small{color:var(--ink);opacity:.75}
${Q} .en-mb{height:24px;gap:2px} ${Q} .en-mb i{position:relative;width:6px;height:24px;border-radius:3px;background:#F1F8FB;box-shadow:inset 0 0 0 1px rgba(10,42,60,.1);overflow:hidden} ${Q} .en-mb i b{position:absolute;left:0;right:0;bottom:0;background:var(--dom)} ${Q} .en-mb i.nd{background:none}
${Q} .en-sm{font-size:11.5px;color:var(--faint)} ${Q} .en-v4 .en-strata{margin-top:4px} ${Q} .en-v4 .fh-row:last-of-type{padding-bottom:10px}
${Q} .en-strata{display:flex;height:22px;border-radius:999px;overflow:hidden;gap:2px;padding:3px;background:linear-gradient(180deg,#fff,#F1F8FB);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.09)} ${Q} .en-strata i{display:block;border-radius:999px;background:var(--dom);min-width:8px}
${Q} .en-strata i.b,${Q} .en-leg i.b{background:color-mix(in srgb,var(--dom) 72%,#fff)} ${Q} .en-strata i.c,${Q} .en-leg i.c{background:color-mix(in srgb,var(--dom) 52%,#fff)} ${Q} .en-strata i.d,${Q} .en-leg i.d{background:color-mix(in srgb,var(--dom) 34%,#fff)} ${Q} .en-strata i.e,${Q} .en-leg i.e{background:color-mix(in srgb,var(--dom) 20%,#fff)}
${Q} .en-strata i.ok{background:var(--ok)} ${Q} .en-strata i.fa{background:var(--faint)} ${Q} .en-strata i.wn{background:var(--warn)}
${Q} .en-dayr{align-items:center} ${Q} .en-dayr .dl{flex:0 0 58px} ${Q} .en-dayr .dl b{display:block;font-family:var(--disp);font-size:17px;font-weight:800;letter-spacing:-.4px} ${Q} .en-dayr .dl small{font-size:10.5px;margin-top:0} ${Q} .en-dayr .en-chips{margin-top:6px;gap:4px} ${Q} .en-dayr .en-chips span{font-size:10.5px;padding:3px 8px} ${Q} .en-dayr .en-chips .fb{--s:18px!important}
${Q} .en-dayr.now{margin:0 -10px;padding:12px 10px;width:calc(100% + 20px);border-radius:20px;background:color-mix(in srgb,var(--dom) 8%,#fff);border-top:0!important} ${Q} .en-dayr.now+.fh-row{border-top:0!important}
${Q} .en-six{display:inline-flex;gap:3px;align-items:flex-end} ${Q} .en-six i{position:relative;width:11px;height:30px;border-radius:6px;background:#F1F8FB;box-shadow:inset 0 0 0 1.2px rgba(10,42,60,.1);overflow:hidden} ${Q} .en-six i.gp{margin-left:8px} ${Q} .en-six i b{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 60%,#fff),var(--dom))}
${Q} .en-sixl{display:flex;gap:10px;justify-content:space-between;font-size:10.5px;font-weight:600;color:var(--sub);padding:0 0 10px 68px} ${Q} .en-q small{display:block;font-family:var(--ff);font-size:9.5px;font-weight:500;color:var(--sub);text-align:right} ${Q} .en-q.lrn{font-size:12px;color:var(--sub)} ${Q} .en-q.ok{color:var(--ok)}
${Q} .en-xps,${Q} .en-jst{margin:12px 14px 0} ${Q} .en-xps .k2-stream,${Q} .en-jst .k2-stream{margin:0} ${Q} .k2-drop span{overflow-wrap:anywhere}
${Q} .en-xps .k2-drop time{width:40px;font-size:15px;color:var(--ok)} ${Q} .en-xps .k2-drop{padding:12px 14px}
${Q} .en-jst .k2-drop{align-items:flex-start;padding:14px} ${Q} .en-jst .k2-drop time{width:54px;font-size:13.5px;padding-top:2px;overflow-wrap:anywhere} ${Q} .en-jst .k2-drop strong{font-size:14.5px;font-weight:600;line-height:1.4} ${Q} .en-jst .k2-drop small{margin-top:5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;font-size:10.5px}
${Q} .en-bvs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 8px} ${Q} .en-bv{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0} ${Q} .en-bv .v{position:relative;display:block;padding-top:9px}
${Q} .en-bv .v s{position:absolute;left:50%;top:0;width:26px;height:13px;margin-left:-13px;border-radius:5px 5px 3px 3px;background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 34%,#fff),color-mix(in srgb,var(--ink) 52%,#fff));z-index:2;box-shadow:0 3px 4px -2px rgba(10,42,60,.4)}
${Q} .en-bv .g{position:relative;display:grid;place-items:center;width:58px;height:74px;border-radius:14px 14px 26px 26px;overflow:hidden;background:linear-gradient(180deg,#fff,#F1F8FB);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10),inset 0 6px 9px -6px rgba(10,42,60,.16),0 14px 16px -14px var(--liq2)}
${Q} .en-bv .g i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,color-mix(in srgb,var(--dom) 34%,#fff),color-mix(in srgb,var(--dom) 62%,#fff))} ${Q} .en-bv.got .g i{background:linear-gradient(180deg,color-mix(in srgb,var(--ok) 38%,#fff),color-mix(in srgb,var(--ok) 70%,#fff))}
${Q} .en-bv .g i::before{content:'';position:absolute;left:0;right:0;top:-4px;height:5px;background:color-mix(in srgb,var(--dom) 34%,#fff);${MASK}} ${Q} .en-bv.got .g i::before{display:none}
${Q} .en-bv .g svg.ic{position:relative;width:32px;height:32px;margin-top:8px;filter:drop-shadow(0 4px 5px rgba(10,42,60,.3))} ${Q} .en-bv:not(.got) .g svg.ic{filter:grayscale(.55) opacity(.75)}
${Q} .en-bv strong{font-size:12px;font-weight:700;line-height:1.25;margin-top:8px} ${Q} .en-bv small{font-size:11px;color:var(--sub);margin-top:2px} ${Q} .en-bv.got small{color:var(--ok);font-weight:600}
${Q} .en-rate button small{display:block;font-family:var(--ff);font-size:9.5px;font-weight:600;color:var(--sub)}
${Q} .en-av{background:radial-gradient(circle at 30% 24%,#fff 0 16%,color-mix(in srgb,var(--dom) 10%,#fff) 58%,color-mix(in srgb,var(--dom) 28%,#fff));box-shadow:inset 0 -6px 9px -6px color-mix(in srgb,var(--dom) 55%,transparent),0 0 0 2px #fff,0 8px 12px -8px color-mix(in srgb,var(--dom) 70%,rgba(10,42,60,.5))}
${Q} .en-av.att{box-shadow:inset 0 -6px 9px -6px color-mix(in srgb,var(--warn) 55%,transparent),0 0 0 2px #fff,0 0 0 4px var(--warn)} ${Q} .en-av.lg{box-shadow:inset 0 -10px 14px -8px color-mix(in srgb,var(--dom) 55%,transparent),0 0 0 3px #fff,0 14px 20px -12px var(--liq2)}
${Q} .en-newd{width:104px;height:auto;flex:0 0 auto;overflow:visible;filter:drop-shadow(0 12px 12px color-mix(in srgb,var(--liq2) 28%,transparent))}
${Q} .en-bq{margin:14px 0 0;padding:12px 14px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 1.2px rgba(10,42,60,.07);font-size:14px;line-height:1.45;font-style:italic}
${Q} .en-dropd{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;align-items:end;margin-top:14px;padding:10px 6px 8px;border-radius:22px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.06)}
${Q} .en-dropd div{display:flex;flex-direction:column;align-items:center;gap:6px} ${Q} .en-dropd span{display:flex;flex-direction:column-reverse;align-items:center;gap:4px;min-height:74px;justify-content:flex-start}
${Q} .en-dropd i{width:17px;height:21px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:linear-gradient(160deg,var(--liq1),var(--liq2));box-shadow:0 6px 8px -5px var(--liq2)} ${Q} .en-dropd i.wn{background:linear-gradient(160deg,#F6CB5A,var(--warn));box-shadow:0 6px 8px -5px var(--warn)}
${Q} .en-dropd u{width:14px;height:0;border-top:1.5px dashed rgba(10,42,60,.2)} ${Q} .en-dropd small{font-size:11px;font-weight:600;color:var(--sub)} ${Q} .en-dropd .today small{color:var(--ink);font-weight:800}
${Q} .en-top .en-chips{margin-top:2px} ${Q} .en-top .fb{align-self:flex-start}
${Q} .en-shh .fb svg.ic{width:62%;height:62%}
${Q} .en-day24{position:relative;height:26px;border-radius:999px;margin:34px 4px 0;background:color-mix(in srgb,var(--ink) 8%,#fff);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.08)} ${Q} .en-day24 i{position:absolute;top:3px;bottom:3px;border-radius:999px;background:linear-gradient(90deg,var(--liq1),var(--liq2))}
${Q} .en-day24 .fb{position:absolute;top:-30px;margin-left:-15px} ${Q} .en-ax{display:flex;justify-content:space-between;font-size:10px;color:var(--sub);margin:5px 4px 0}
${Q} .en-icg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 8px} ${Q} .en-icg div{display:flex;gap:10px;align-items:center;min-width:0} ${Q} .en-icg strong{display:block;font-size:13px;font-weight:700} ${Q} .en-icg small{display:block;font-size:11px;color:var(--sub);line-height:1.3;overflow-wrap:anywhere}
${Q} .en-wk7 span{border-radius:14px}
${Q} .en-cells:has(>div:nth-child(2):last-child){grid-template-columns:repeat(2,minmax(0,1fr))}
/* éjszakai mód: sötét marad, lent lassan lélegző vízszinttel */
${Q} .scroll.en-night{background:var(--ink);padding-bottom:40px} ${Q} .en-night>*:not(.nsea):not(.nback){position:relative;z-index:1} ${Q} .en-night .nback{z-index:2}
${Q} .en-night .nsea{position:absolute;left:0;right:0;bottom:0;height:24%;z-index:0;overflow:hidden;pointer-events:none}
${Q} .en-night .nsea>div{position:absolute;left:0;right:0;top:40px;bottom:-14px;color:color-mix(in srgb,#fff 9%,var(--ink));background:linear-gradient(180deg,color-mix(in srgb,#fff 9%,var(--ink)),color-mix(in srgb,#fff 4%,var(--ink)))}
${Q} .en-night.wait .nsea,${Q} .en-night.legzes .nsea{height:15%}
${Q} .en-night .orb,${Q} .en-night .breath{position:relative;overflow:hidden;background:none;color:color-mix(in srgb,#fff 14%,var(--ink));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,#fff 22%,var(--ink))}
${Q} .en-night .orb i,${Q} .en-night .breath i{position:absolute;left:0;right:0;bottom:0;height:46%;background:currentColor} ${Q} .en-night .breath i{height:50%}
${Q} .en-night .breath span{position:relative;color:color-mix(in srgb,#fff 82%,var(--ink))} ${Q} .en-night .breath{animation:none!important;width:150px;height:150px}
@media (prefers-reduced-motion:no-preference){
  body:not(.still) ${Q} .en-night .nsea>div{animation:en-tide 11s ease-in-out infinite}
  body:not(.still) ${Q} .en-night .orb i{animation:en-orb 9s ease-in-out infinite}
  body:not(.still) ${Q} .en-night .breath i{animation:en-br 18s ease-in-out infinite}
  body:not(.still) ${Q} .en-tap .dr2{animation:en-drip 2.800s ease-in infinite}
}
@keyframes en-tide{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes en-orb{0%,100%{height:42%}50%{height:52%}}
@keyframes en-br{0%{height:16%}28%{height:84%}61%{height:84%}100%{height:16%}}
@keyframes en-drip{0%{transform:translateY(-10px);opacity:0}30%{opacity:.7}100%{transform:translateY(6px);opacity:0}}
`,
  notes:`<h2>Én · Folyadék</h2>
<p><b>Mit nézz meg.</b> A négy fül: <b>Hol tartok</b>, <b>Test</b>, <b>Célok</b>, <b>Napló</b>. Minden oldalnak saját rajza van, a saját adataiból. Gyűrű sehol: minden szint, edény vagy vízvonal.</p>
<p><b>Hol tartok.</b> A hét egy nagy tartály (78 pont), alatta a hét hét napja hét kis edényként, majd négy kémcső arról, ami a héten mozdult. Az <b>Életvonal</b> a súlyod mint apadó vízfelszín a cél vízvonala felé; a bóják az állomások, koppints rájuk.</p>
<p><b>Test.</b> Súly: a kisimított súly a felszín, a halvány pöttyök a napi mérések, a pontozott vonal a vetítés a cél vízvonaláig; alatta a csap mutatja a heti ütemet. Alvás: nyolc hét nyolc edény a 7,5 órás vízvonalhoz, a tegnap éjjel pedig árapály (minél mélyebb a víz, annál mélyebb az alvás).</p>
<p><b>Célok.</b> Minden cél egy edény, a világos felső réteg az e heti hozzájárulás. A súlycél egy apadó edény két vízvonallal (start és cél), az ütem egy áramlásmérő, a nyolc hét nyolc pohár. A pillérek napjai apró edények: tele, félig, üres.</p>
<p><b>A heted.</b> Az edényen a szaggatott vonal az előző hét. A kilenc terület kilenc szint, színt csak az alvás kap. A felfedezések felszínre jövő buborékok.</p>
<p><b>Fejlődés, Emberek.</b> A szint egy edény a következő szintig, a jelvények dugóval lezárt fiolák. Az emberek edényei az említéseket mutatják, Petra oldalán a hangulat-ív vízszint, alatta egy közlekedőedény.</p>
<p><b>Kérdések neked.</b> 1) Az <b>Éjszakai mód</b> maradt sötét, lent egy lassan lélegző vízszinttel. Maradjon így, vagy legyen világos? 2) Petra oldalán a „közös program ↔ hangulat” közlekedőedény új megfogalmazás a meglévő adatokból. Kell ilyen, vagy túl sokat állít? 3) A napi sorozat csak a Kitüntetések alján látszik. Jó így?</p>
<p><b>További állapotok</b> (a címsorba írva): <b>#w-en-mai.ures</b> első hét, <b>.celelerve</b>, <b>.nincsvetites</b> · <b>celok.ures</b> · <b>sulycel.ures</b> · <b>het.fut</b> · <b>elemzes.fut</b> · <b>felfedezesek.keves</b> / <b>.csend</b> · <b>novekedes.ures</b> · <b>jeloltek.ures</b> · <b>ertesitesek.ures</b> · <b>ikonok</b>.</p>`
});
})();
