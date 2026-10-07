/* csepp/mezo.js — Mezo domain (Üzenőfal · A csapat · Rólad · Emlékek + minden mélyoldal). Built on window.K (see csepp/README.md).
   Paritás-forrás: elo/mezo.html (route-tábla: fal csapat szoba tud ugyek poszt bizonyitek elsonap ikonok elo nap-uzenetek
   chat coaching megfigyelo kartya diagnozis diag naplo rolad rolad-terv dimenziok dimenzio tudastar tenyek kategoriak kind hogyan
   node eletesemenyek konzilium gepterem osszes futasok futas adatforrasok kor detektorok memoria mintak minta elore elorejelzesek
   kiserletek kiserlet-oldal emlekek emlek memoar archivum fejezet nap ikonok9). A Boop-figurák helyett mindenhol a testvérformák. */
(function(){
const {I,T,csepp,page,sec,back,register,toast,openSheet,closeSheet,esc}=K;

/* ── a csapat: forma = feladó, szöveg = hang ── */
const CH={
  szunya:{n:'Szunya',a:'ALVÁS',c:'#AB9FD2',f:'pebble',fl:62},
  mocor:{n:'Mocor',a:'MOZGÁS',c:'#7FB2D0',f:'bean',fl:48},
  falat:{n:'Falat',a:'ÉTKEZÉS',c:'#8FB49A',f:'drop',fl:70},
  deru:{n:'Derű',a:'KÖZÉRZET',c:'#D9B67E',f:'leaf',fl:55},
  mezo:{n:'Mezo',a:'A CSAPAT',c:'#9AA3A8',f:'crystal',fl:64},
  szk:{n:'Szkeptikus',a:'',c:'var(--faint)',f:'crystal',fl:8}
};
const FIVE=['szunya','mocor','falat','deru','mezo'];
const nm=id=>CH[id].n;
const SIB=(id,s=26,alive=false)=>{const p=CH[id];return csepp('ok',p.fl,{s,form:p.f,color:p.c,alive})};
const minis=ids=>`<span class="minis">${ids.map(id=>SIB(id,18)).join('')}</span>`;
/* Titanium-jelek: ami a shell készletében nincs, létező acél-jelre képezzük (lásd Új ikonok lap) */
const M={eye:'t-trend',card:'t-note',diagnose:'t-compass',album:'c-i-memoar',layers:'c-i-retegek',pencil:'t-note',lens:'t-info',council:'c-i-emberek',graph:'t-link',radar:'t-pattern',grid:'t-stack',eraser:'t-trash',whistle:'t-bolt',brain:'c-i-tudas',signal:'t-pattern',key:'t-shield',flag:'t-quest',bell:'c-i-ertesites',cowave:'t-chain',template:'t-stack',source:'t-link',compare:'t-trend',gear:'c-i-beallitas'};
const ic=(n,cls='')=>T(M[n]||(n.startsWith('c-i-')?n:'t-'+n),cls);
const chev=I('i-chev','chev');

/* ── állapot (a prototípus kattintásai) ── */
const ST={vote:{},s8:{dori:'on',self:'ask',anna:'gone',bence:'gone',all:false},s8m:{a:'on',b:'on'},s8rk:'1',ch:'mem',tools:false,mems:false,
  rinb:{},redit:'',rq:'',s6all:false,s9open:false,s9back:{},waitOpen:true,offOpen:false,ff:'Minden',konz:'ov',th:'t1',src:'be',wk:false,
  bucket:'decide',ack:'',pred:'all',mem:'retegek',ex:'mind',card:'open',dg:'idle',probe:false,rule:'r1',srch:'off',fb:{},mfb:{},
  s7:{phase:'open',text:''},s7k:'open',s7r:'open',chk:true,act:'menu',eloDone:false,pillUsed:false,pill:false,dontes:'',mstep:0,fold:{},rsn:{},xdec:{},pdec:{}};
const still=()=>document.body.classList.contains('still');

/* ── kis építőelemek ── */
const P=(inner,active,opt)=>page(inner,'mezo',active,opt);
const hd=(eb,title,i=0)=>`<div class="p16 rise pgh" style="--i:${i}"><span class="eb">${eb}</span><h1 class="t">${title}</h1></div>`;
const bk=(label='Vissza',route='')=>`<div class="backrow rise"><button class="backbtn" ${route?`data-go="${route}"`:'data-back'}><b>‹</b>${label}</button></div>`;
const fday=t=>`<div class="fday rise"><span class="eb">${t}</span></div>`;
const ln=(icon,b,sm,right='',go='',extra='')=>`<div class="ln ${go?'tap':''}" ${go}>${icon}<span class="g">${b}${sm?`<small>${sm}</small>`:''}</span>${right}${extra}</div>`;
const G=t=>t?(t[0]==='#'?`data-go="${t.slice(1)}"`:t.startsWith('toast:')?`data-toast="${t.slice(6)}"`:`data-go="${t}"`):'';
const row=(o)=>`<div class="ln ${o.go?'tap':''}" ${G(o.go)}>${o.ic?ic(o.ic):o.av?SIB(o.av,30):''}<span class="g">${o.b}${o.sm?`<small>${o.sm}</small>`:''}</span>${o.v?`<span class="v">${o.v}</span>`:''}${o.go?chev:''}</div>`;
const st=(l,k='q')=>`<span class="st ${k}">${l}</span>`;
const pill=(l,c)=>`<span class="eb" style="color:${c||'var(--faint)'}">${l}</span>`;
const ph=(id,meta,right='')=>`<div class="ph"><button class="pav" data-go="szoba.${id}" aria-label="${nm(id)} szobája">${SIB(id,32)}</button><span class="who"><b>${nm(id)}</b>${CH[id].a?`<span class="area">${CH[id].a}</span>`:''}<small>${meta}</small></span>${right||`<button class="pmenu" data-sheet="menu" aria-label="Továbbiak">···</button>`}</div>`;
const vote=(k,i)=>{const v=ST.vote[k];return `<button class="lk" data-m="vote:${k}:up" aria-pressed="${v==='up'}">Ez talál${i||''}</button><button class="lk" data-m="vote:${k}:down" aria-pressed="${v==='down'}">Nem így érzem</button>`};
const acts=(k,extra='')=>`<div class="act">${vote(k,extra)}<button class="lk" data-sheet="reply">Elmesélem</button></div>`;
const rrow=(sheet='reply')=>`<button class="rrow" data-sheet="${sheet}"><span class="me">Te</span><span class="g">Te hogy látod? Válaszolj…</span>${ic('send')}</button>`;
const src=(to,meta='')=>`<button class="lk src" data-go="${to}">Miből látszik?${meta?` · ${meta}`:''} ›</button>`;
const after=t=>`<p class="aft">${ic('tick')}${t}</p>`;
const cmt=(id,t,i=0,tag='')=>`<div class="cmt rise" style="--i:${i}">${SIB(id,22)}<p><b>${nm(id)}</b>${tag?`<span class="area">${tag}</span>`:''}${t}</p></div>`;
const fn=t=>`<p class="fn">${t}</p>`;
const big=(n,v)=>`<div class="big"><span class="num">${n}</span><span class="v">${v}</span></div>`;
const bigs=(arr)=>`<div class="bigs">${arr.map(([n,l])=>`<div><span class="num">${n}</span><span class="eb">${l}</span></div>`).join('')}</div>`;
const barq=(w,c='')=>`<div class="bar ${c?'':'q'}" ${c?`style="--c:${c}"`:''}><b style="--w:${w}%"></b></div>`;
const seg=(opts,cur,key)=>`<div class="seg rise" role="group">${opts.map(([k,l])=>`<button class="${cur===k?'on':''}" data-m="${key}:${k}" aria-pressed="${cur===k}">${l}</button>`).join('')}</div>`;
const fold=(key,label,open,body)=>`<button class="foldb" data-m="fold:${key}" aria-expanded="${open}"><span>${label}</span><i>${open?'⌃':'⌄'}</i></button>${open?body:''}`;
const isOpen=k=>!!ST.fold[k];
const tgl=(on,m)=>`<button class="tgl ${on?'on':''}" role="switch" aria-checked="${on}" data-m="${m}"><i></i></button>`;
const vs=(a,b)=>`<div class="vs"><div><span class="eb">Ezt vártam</span><p class="txt">${a}</p></div><div><span class="eb">Ez történt</span><p class="txt">${b}</p></div></div>`;
const dcell=(cells)=>`<div class="dc">${cells.map(([l,k])=>`<span class="${k||''}">${l}</span>`).join('')}</div>`;

/* ── a Mezo-terület grafikus nyelve: csillagkép (pontok + hajszálvonalak, hangsúly csak a legerősebb kapcsolaton) ── */
function kst(nodes,links,w=300,h=96){
  return `<svg class="kst" viewBox="0 0 ${w} ${h}" aria-hidden="true">
  ${links.map(([a,b,k])=>`<line class="${k||''}" x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}"/>`).join('')}
  ${nodes.map(([x,y,l,k])=>`<circle class="${k||''}" cx="${x}" cy="${y}" r="${k==='big'?4.5:2.6}"/>${l?`<text x="${x}" y="${y+(k==='up'?-9:15)}" text-anchor="middle">${l}</text>`:''}`).join('')}</svg>`;
}
const KST_VACS=()=>kst([[62,46,'vacsora ideje','big'],[238,46,'alvásminőség','big'],[150,18,'hétvége','up'],[150,78,'edzés-esték']],[[0,1,'s'],[0,2,'d'],[2,1,'d'],[0,3,'d']]);
/* pontfelhő: minden pont egy nap (textúra), a trendvonal a főcím (MF) */
function scat(m){
  const L=36,R=290,Tp=12,B=108,[x0,x1]=m.xa,[y0,y1,yt]=m.ya,X=v=>(L+(v-x0)/(x1-x0)*(R-L)).toFixed(1),Y=v=>(B-(v-y0)/(y1-y0)*(B-Tp)).toFixed(1);
  const d=m.days,n=d.length,mx=d.reduce((s,q)=>s+q[1],0)/n,my=d.reduce((s,q)=>s+q[2],0)/n,k=d.reduce((s,q)=>s+(q[1]-mx)*(q[2]-my),0)/d.reduce((s,q)=>s+(q[1]-mx)**2,0),b0=my-k*mx;
  const path=d.map((q,i)=>(i?'L':'M')+X(q[1])+' '+Y(q[2])).join(' ');
  return `<svg class="kst sc" viewBox="0 0 300 130" role="img" aria-label="${m.A.l} és ${m.B.l} ${n} napon">
  ${yt.map(t=>`<text x="${L-6}" y="${+Y(t)+3}" text-anchor="end">${m.fy(t)}</text>`).join('')}
  <path class="d" d="${path}"/>
  ${m.trend?`<line class="s" x1="${X(x0)}" y1="${Y(k*x0+b0)}" x2="${X(x1)}" y2="${Y(k*x1+b0)}"/>`:''}
  ${d.map((q,i)=>`<circle class="${i===n-1?'big':''}" cx="${X(q[1])}" cy="${Y(q[2])}" r="${i===n-1?4.5:2.6}"/>`).join('')}
  ${m.xa[2].map(t=>`<text x="${X(t)}" y="124" text-anchor="middle">${m.fx(t)}</text>`).join('')}</svg>`;
}
function scbin(m){
  const Tp=12,B=100,[y0,y1,yt]=m.ya,Y=v=>(B-(v-y0)/(y1-y0)*(B-Tp)).toFixed(1),jit=[-14,-5,5,14,-10,0,10,-2],cx=a=>a<.5?95:215;
  const d=m.days,med=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),h=s.length>>1;return s.length%2?s[h]:(s[h-1]+s[h])/2};
  const m0=med(d.filter(q=>q[1]<.5).map(q=>q[2])),m1=med(d.filter(q=>q[1]>=.5).map(q=>q[2]));
  return `<svg class="kst sc" viewBox="0 0 300 130" role="img" aria-label="${m.B.l}: ${m.g[0]} és ${m.g[1]}">
  ${yt.map(t=>`<text x="30" y="${+Y(t)+3}" text-anchor="end">${m.fy(t)}</text>`).join('')}
  ${d.map((q,i)=>`<circle class="${i===d.length-1?'big':''}" cx="${cx(q[1])+jit[i%8]}" cy="${Y(q[2])}" r="${i===d.length-1?4.5:2.6}"/>`).join('')}
  ${m0!=null?`<line class="d" x1="63" x2="127" y1="${Y(m0)}" y2="${Y(m0)}"/>`:''}${m1!=null?`<line class="s" x1="183" x2="247" y1="${Y(m1)}" y2="${Y(m1)}"/>`:''}
  <text x="95" y="118" text-anchor="middle">${m.g[0]}${m0!=null?' · medián '+m.fy(m0):''}</text><text x="215" y="118" text-anchor="middle">${m.g[1]}${m1!=null?' · medián '+m.fy(m1):''}</text></svg>`;
}
/* simított érettség-görbe (a főcím), nyers pontok textúraként */
function curve(mat,c){
  const mn=Math.min(...mat),mx=Math.max(...mat),sp=(mx-mn)||1,pts=mat.map((v,j)=>[14+j*38.6,50-((v-mn)/sp)*32]);
  const line=pts.map((q,j)=>(j?'L':'M')+q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');
  return `<svg class="kst cur" viewBox="0 0 300 64" aria-hidden="true" style="--c:${c}"><path class="s" d="${line}"/>${pts.map((q,j)=>`<circle class="${j===7?'big':''}" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${j===7?4:2.2}"/>`).join('')}<text x="14" y="62" text-anchor="start">8 hete</text><text x="286" y="62" text-anchor="end">ma</text></svg>`;
}

/* ── újrarajzolás helyben (állapotváltás görgetés nélkül) ── */
let ROUTES={};
function soft(){const phn=document.querySelector('#phone');if(!phn||K.D!=='mezo'||phn.dataset.v!=='ajanlott')return;const sc=phn.querySelector('.scroll');const y=sc?sc.scrollTop:0;const f=ROUTES[K.R]||ROUTES.mai;phn.innerHTML=f(K.ARG);const s2=phn.querySelector('.scroll');if(s2)s2.scrollTop=y;afterRender(K.R,K.ARG)}

/* ── CSS (csak ez a terület) ── */
const CSS=`
& .pgh{padding-top:6px;padding-bottom:8px}& .pgh .eb{margin-bottom:6px}& h1.t{font-size:26px}
& .fday{padding:14px 16px 2px}& .fday .eb{color:var(--faint)}
& .tb svg.ic:not(.td){stroke:none;filter:grayscale(.75) sepia(.6) hue-rotate(165deg) saturate(1.35) brightness(1.04) drop-shadow(0 4px 6px rgba(0,0,0,.5))}
&[data-t="light"] .tb svg.ic:not(.td){filter:grayscale(.75) sepia(.6) hue-rotate(165deg) saturate(1.5) brightness(.96) drop-shadow(0 3px 5px rgba(21,34,44,.25))}
& .cast{display:flex;gap:4px;padding:6px 10px 2px;overflow-x:auto;scrollbar-width:none}& .cast button{flex:1;min-width:58px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px;font-size:11px;color:var(--ink);position:relative}
& .cast button small{font-family:var(--mono);font-size:9px;letter-spacing:.6px;color:var(--faint);text-transform:uppercase}& .cast .fr{border-radius:50%;padding:3px}& .cast .fr.new{box-shadow:0 0 0 1.5px var(--c)}
& .cast .cd{position:absolute;top:4px;right:10px;width:7px;height:7px;border-radius:50%;background:var(--acc);box-shadow:0 0 8px color-mix(in srgb,var(--acc) 70%,transparent)}
& .minis{display:inline-flex;align-items:center}& .minis .csepp{margin-left:-5px}& .minis .csepp:first-child{margin-left:0}
& .ldot{width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 8px color-mix(in srgb,var(--acc) 80%,transparent);flex:0 0 auto}
@media (prefers-reduced-motion:no-preference){body:not(.still) & .ldot{animation:mz-pulse 1.8s ease-in-out infinite}}@keyframes mz-pulse{0%,100%{opacity:.5}50%{opacity:1}}
& .po{padding:14px 16px 12px;border-top:1px solid var(--hair)}& .po.first{border-top:0}& .po .txt{margin-top:8px}& .po h2.t{margin-top:8px}
& .ph{display:flex;align-items:center;gap:10px}& .ph .who{flex:1;min-width:0;line-height:1.25}& .ph .who b{font-size:14px;font-weight:600}& .ph .who .area{font-family:var(--mono);font-size:9px;letter-spacing:1px;color:var(--faint);margin-left:7px;vertical-align:1px}
& .ph .who small{display:block;font-size:12px;color:var(--sub);margin-top:1px}& .ph .pmenu{color:var(--faint);font-size:16px;letter-spacing:1px;padding:4px 6px}
& .card.hg .po,& .card.hg{padding:14px 14px 12px}& .card.hg .ph{margin-bottom:2px}& .card.hg h2.t{margin:8px 0 4px}
& .act .lk[aria-pressed="true"]{color:var(--ink);text-decoration-color:var(--acc);text-decoration-thickness:2px}& .lk.src{color:var(--sub)}
& .aft{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--sub);margin-top:10px}& .aft svg.ic.td{width:18px;height:18px}
& .rrow{display:flex;align-items:center;gap:10px;width:100%;margin-top:12px;padding:9px 0 8px;border-bottom:1px solid var(--hair);font-size:13px;color:var(--faint);text-align:left}
& .rrow .me{font-family:var(--mono);font-size:10px;letter-spacing:.8px;color:var(--sub)}& .rrow .g{flex:1}& .rrow svg.ic.td{width:20px;height:20px}
& .cmt{display:flex;gap:10px;align-items:flex-start;margin-top:10px}& .cmt p{font-size:13.5px;line-height:1.45;color:var(--sub);margin:0}& .cmt p b{color:var(--ink);font-weight:600;margin-right:6px}& .cmt .area{font-family:var(--mono);font-size:9px;letter-spacing:1px;color:var(--faint);margin-right:6px}
& .sum{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12.5px;color:var(--sub)}& .sum button{color:var(--sub);text-decoration:underline;text-underline-offset:3px;text-align:left}
& .kst{display:block;width:100%;height:auto;margin:10px 0 2px;overflow:visible}& .kst line{stroke:color-mix(in srgb,var(--ink) 22%,transparent);stroke-width:1}& .kst line.d{stroke-dasharray:2 4}& .kst line.s{stroke:var(--acc);stroke-width:1.6;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--acc) 70%,transparent))}
& .kst circle{fill:var(--sub)}& .kst circle.big{fill:var(--acc);filter:drop-shadow(0 0 5px color-mix(in srgb,var(--acc) 70%,transparent))}& .kst text{font-family:var(--mono);font-size:8.5px;fill:var(--faint);letter-spacing:.4px}
& .kst path.d{fill:none;stroke:color-mix(in srgb,var(--ink) 16%,transparent);stroke-width:1;stroke-dasharray:2 3}& .kst.cur path.s{fill:none;stroke:var(--c,var(--acc));stroke-width:1.8;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--c,var(--acc)) 60%,transparent))}& .kst.cur circle.big{fill:var(--c,var(--acc))}
& .dc{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px}& .dc span{font-family:var(--mono);font-size:10px;text-align:center;padding:6px 0;color:var(--faint);border-top:1px solid var(--hair)}& .dc span.hit{color:var(--ink);border-top-color:var(--ink)}& .dc span.now{color:var(--acc);border-top-color:var(--acc)}& .dc span.el{color:var(--ink);border-top-color:var(--sub)}
& .bigs{display:flex;gap:18px;flex-wrap:wrap;margin-top:8px}& .bigs .num{display:block;font-size:26px}& .bigs .eb{margin-top:2px}
& .seg{display:flex;gap:16px;padding:6px 16px 0;border-bottom:1px solid var(--hair);margin:0 0 6px;overflow-x:auto;scrollbar-width:none;white-space:nowrap}& .seg::-webkit-scrollbar{display:none}& .seg button{padding:8px 0 10px;font-size:13px;color:var(--faint);margin-bottom:-1px}& .seg button.on{color:var(--ink);box-shadow:inset 0 -2px 0 var(--acc)}
& .open .seg{padding-left:0;padding-right:0}
& .foldb{display:flex;align-items:center;justify-content:space-between;width:100%;padding:11px 0;border-top:1px solid var(--hair);font-size:13.5px;color:var(--sub);text-align:left}& .foldb i{font-style:normal;color:var(--faint)}
& .tgl{width:34px;height:20px;border-radius:10px;background:var(--hair);position:relative;flex:0 0 auto;transition:.2s}& .tgl i{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--sub);transition:.2s}& .tgl.on{background:color-mix(in srgb,var(--ink) 70%,transparent)}& .tgl.on i{left:17px;background:var(--page)}
& .ln.off .g{color:var(--faint)}& .ln .g .tst{font-family:var(--mono);font-size:9.5px;letter-spacing:.8px;color:var(--faint);margin-right:6px}
& .vs{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px}& .vs .eb{margin-bottom:4px}& .vs .txt{font-size:13px}
& .lifer{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-top:1px solid var(--hair)}& .lifer:first-of-type{border-top:0}& .lifer u{width:8px;height:8px;border-radius:50%;background:var(--sub);margin-top:6px;flex:0 0 auto}& .lifer u.dim{background:var(--hair)}& .lifer .g{flex:1}& .lifer .g small{display:block;font-size:12px;color:var(--sub)}& .lifer em{font-family:var(--mono);font-style:normal;font-size:11px;color:var(--faint);white-space:nowrap}
& .tl .ln time{width:92px;font-size:10.5px;line-height:1.3;white-space:normal}& .tl .ln .g small{color:var(--faint)}& .tl .ln.you .g{color:var(--ink);font-style:italic}
& .conf{display:flex;align-items:center;gap:10px;margin-top:8px;font-family:var(--mono);font-size:11px;color:var(--faint)}& .conf .bar{flex:1}
/* beszélgetés */
& .cm{display:flex;gap:10px;align-items:flex-start;padding:10px 16px}& .cm .cb{flex:1;min-width:0}& .cm .nmr{display:flex;align-items:baseline;gap:8px;font-size:13px}& .cm .nmr b{font-weight:600}& .cm .nmr .area{font-family:var(--mono);font-size:9px;letter-spacing:1px;color:var(--faint)}& .cm .nmr em{font-family:var(--mono);font-style:normal;font-size:10.5px;color:var(--faint);margin-left:auto}
& .cm .tx{font-size:14px;line-height:1.5;margin-top:3px}& .cm .tx .hl{color:var(--ink);font-weight:600}& .cm .tx .m{color:var(--acc)}& .cm.guest .tx{color:var(--sub)}
& .cm.me{justify-content:flex-end}& .cm.me .cb{flex:0 1 auto;max-width:84%;background:var(--card2);border-radius:14px 14px 4px 14px;padding:8px 12px}
& .ctag{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px;font-family:var(--mono);font-size:10px;letter-spacing:.6px;color:var(--faint)}& .ctag .st{letter-spacing:.8px}& .ctag .lk{font-size:11.5px}
& .typing{display:inline-flex;gap:4px;padding:8px 0}& .typing i{width:6px;height:6px;border-radius:50%;background:var(--faint)}
@media (prefers-reduced-motion:no-preference){body:not(.still) & .typing i{animation:mz-ty 1.2s infinite}body:not(.still) & .typing i:nth-child(2){animation-delay:.2s}body:not(.still) & .typing i:nth-child(3){animation-delay:.4s}}@keyframes mz-ty{0%,100%{opacity:.3}50%{opacity:1}}
& .ofr{padding:4px 16px 0 58px}
/* chat */
& .chh{display:flex;align-items:center;gap:10px;padding:8px 16px 10px;border-bottom:1px solid var(--hair)}& .chh .who{flex:1;min-width:0;display:flex;align-items:center;gap:10px}& .chh strong{display:block;font-size:14px}& .chh small{display:block;font-size:11.5px;color:var(--sub)}& .chh small i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ok);margin-right:5px}& .chh small i.busy{background:var(--warn)}& .chh small i.off{background:var(--faint)}
& .chh .hb{width:32px;height:32px}& .thread{padding:8px 0 0}
& .msg-u{margin:10px 16px 10px 56px;padding:9px 12px;border-radius:14px 14px 4px 14px;background:var(--card2);font-size:14px;line-height:1.5}& .msg-u small{display:block;font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:4px;text-align:right}
& .msg-a{display:flex;gap:10px;align-items:flex-start;padding:8px 16px}& .msg-a .mb{flex:1;min-width:0}& .msg-a .meta{display:flex;align-items:baseline;gap:8px;font-size:12px;color:var(--sub)}& .msg-a .meta b{color:var(--ink);font-weight:600}& .msg-a .meta .eb{display:inline;margin-left:4px}
& .msg-a p{font-size:14px;line-height:1.5;margin:4px 0 0}& .mrefs{margin-top:8px}& .mrefs .eb{margin-bottom:4px}& .mrefs .v{font-family:var(--mono);font-size:11px;color:var(--sub);line-height:1.6}
& .fbk{display:flex;gap:14px;margin-top:8px}
& .mch{display:flex;align-items:flex-start;gap:8px;margin:6px 16px 0 56px;padding:8px 0;border-top:1px solid var(--hair);font-size:12.5px;line-height:1.4;color:var(--sub)}& .mch svg.ic.td{width:20px;height:20px;margin-top:1px}& .mch .g{flex:1;min-width:0}& .mch .g b{color:var(--ink);font-weight:600}& .mch .g small{display:block;font-size:11px;color:var(--faint);margin-top:2px}& .mch .ma{display:flex;gap:10px;flex:0 0 auto;align-self:center}& .mch .ma .lk{font-size:12px}
& .mch.prop .g b{color:var(--warn)}& .mch ul{margin:4px 0 0;padding-left:14px}& .mch s{text-decoration-color:var(--faint)}& .mch.two{flex-wrap:wrap}& .mch.two .ma{flex-basis:100%;justify-content:flex-end}
& .mdone{margin:4px 16px 0 56px;font-size:11.5px;color:var(--faint);display:flex;gap:6px;align-items:center}& .mdone svg.ic.td{width:16px;height:16px}
& .s8rec{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:var(--sub);text-decoration:underline;text-underline-offset:3px}& .s8rec svg.ic.td{width:18px;height:18px}& .s8rec b{color:var(--ink)}
& .comp{position:absolute;left:10px;right:10px;bottom:92px;z-index:25;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:16px;background:color-mix(in srgb,var(--card) 92%,transparent);border:1px solid var(--hair);backdrop-filter:blur(14px)}& .comp .inp{flex:1;font-size:13.5px;color:var(--faint);padding:6px 4px}& .comp .inp.on{color:var(--ink)}& .comp button{width:36px;height:36px;display:grid;place-items:center}& .comp button svg.ic.td{width:22px;height:22px}& .comp button.send{background:var(--acc);border-radius:10px}& .comp button.send svg.ic.td{filter:none}
& .vb{position:absolute;left:16px;right:16px;bottom:150px;z-index:26;display:flex;align-items:center;gap:12px;padding:12px 14px}& .vb .g{flex:1}& .vb strong{display:block;font-size:14px}& .vb small{display:block;font-size:12px;color:var(--sub)}& .vb .bars{display:flex;gap:2px;align-items:center;height:22px}& .vb .bars i{width:3px;border-radius:2px;background:var(--acc);height:var(--h)}
@media (prefers-reduced-motion:no-preference){body:not(.still) & .vb .bars i{animation:mz-bar 1.1s ease-in-out infinite;animation-delay:calc(var(--i)*.09s)}}@keyframes mz-bar{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
& .chempty{text-align:center;padding:40px 24px 10px}& .chempty h2{margin-top:10px}& .qq{display:grid;gap:0;padding:0 16px}& .qq .ln{cursor:pointer}
& .degr{margin:8px 16px;padding:10px 0;border-top:1px solid var(--hair);border-bottom:1px solid var(--hair);font-size:13px;color:var(--sub)}
/* lapok */
& .sheet .eb{margin-bottom:6px}& .sheet .txt{margin-top:8px}& .sheet .act{margin-top:14px}& .sheet textarea,& .open textarea,& .open input{width:100%;margin-top:10px;padding:10px 12px;border-radius:9px;border:1px solid var(--hair);background:var(--card2);color:var(--ink);font:inherit;font-size:13.5px;line-height:1.45;resize:none}
& .sheet .qf{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}& .sheet .qf .lk{font-size:12.5px}& .sheet ul{margin:8px 0 0;padding-left:16px;font-size:13.5px;line-height:1.5;color:var(--sub)}& .sheet li small{display:block;font-size:11px;color:var(--faint)}
& .sheet .cmp{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}& .sheet .cmp .num{display:block;font-size:30px}& .sheet .cmp .eb{margin:0 0 2px}& .sheet .cmp small{display:block;font-size:11.5px;color:var(--sub)}
& .ds{padding-top:6px}& .ds button.has i{color:var(--acc)}
& .pillx{position:absolute;left:50%;top:70px;transform:translateX(-50%) translateY(-6px);z-index:24;padding:7px 12px;border-radius:999px;background:var(--acc);color:var(--acc-ink);font-size:12px;font-weight:600;opacity:0;pointer-events:none;transition:.25s}& .pillx.on{opacity:1;transform:translateX(-50%);pointer-events:auto}
& .steps{display:flex;gap:6px;padding:0 16px}& .steps i{flex:1;height:3px;border-radius:2px;background:var(--hair)}& .steps i.done{background:var(--sub)}& .steps i.cur{background:var(--acc)}
& .prose p{font-size:14.5px;line-height:1.6;margin:0 0 10px}& .prose p.drop::first-letter{font-size:38px;float:left;line-height:.9;margin:4px 6px 0 0;font-family:var(--disp);font-weight:600}
& .pager{display:flex;justify-content:space-between;gap:12px;padding:6px 16px 0}& .pager button{text-align:left;font-size:13px;color:var(--sub)}& .pager button.r{text-align:right}& .pager small{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.8px;color:var(--faint)}& .pager strong{display:block;font-weight:500;color:var(--ink)}
& .dgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin-top:8px}& .dgrid strong{display:block;font-size:15px;font-weight:500}& .dgrid .eb{margin:0}
& .mono{font-family:var(--mono)}& .wrap{display:flex;flex-wrap:wrap;gap:6px 14px}
& .hero-r{display:flex;gap:16px;align-items:center}& .hero-r .g{flex:1;min-width:0}& .hero-r .verdict{font-family:var(--disp);font-weight:600;letter-spacing:-.4px;font-size:18px;line-height:1.2;margin:2px 0 4px}
& .act{flex-wrap:wrap;row-gap:6px}& .hero-r>div{min-width:0}& .hero-r .big{flex-direction:column;align-items:flex-start;gap:2px;flex:0 1 auto}& .hero-r .big .v{max-width:130px;white-space:normal;line-height:1.3}& .hero-r .g{flex:1 1 0;min-width:140px}& .flat{color:var(--sub)}& .open .btn.sm{margin-top:2px}
& .ln .g .q{font-style:italic}
& .quote p.q{font-family:var(--disp);font-weight:600;letter-spacing:-.4px;font-size:19px;line-height:1.25;margin:6px 0 8px;text-wrap:balance}
& .ln .ic.td.sm{width:20px;height:20px}
& .honest{display:flex;align-items:center;gap:10px;margin-top:10px;font-family:var(--mono);font-size:11px;color:var(--faint)}& .honest .bar{flex:1}
`.replace(/&/g,'.phone[data-v="ajanlott"][data-d="mezo"]');

/* ═════════ ÜZENŐFAL ═════════ */
function cast(){return `<nav class="cast rise" style="--i:1" aria-label="A csapat">${FIVE.map(id=>`<button data-go="szoba.${id}" style="--c:${CH[id].c}"><span class="fr ${['deru','mezo'].includes(id)?'':'new'}">${SIB(id,40)}</span>${['szunya','falat'].includes(id)?'<i class="cd"></i>':''}<b>${nm(id)}</b><small>${CH[id].a.toLowerCase()}</small></button>`).join('')}</nav>`}
const KCH=(arr)=>`<p class="v mono" style="margin-top:8px;font-size:11.5px;color:var(--sub)">${arr.join(' · ')}</p>`;
function fal(){
  const live=ST.eloDone;
  return P(`
  <div class="sec rise"><span class="eb">A te kis csapatod · hétfő</span><span class="eb">esti kiadás · 21:00</span></div>
  ${cast()}
  <section class="open rise" style="--i:2;padding-top:8px;padding-bottom:8px">
    ${ln(`<i class="ldot"></i>${minis([live?'deru':'falat'])}`,`<span class="eb" style="display:inline;margin-right:6px">Élőben · a csapat beszél</span>`,live?'<b>Derű:</b> Harmadik napja 7 fölötti stresszt jelöltél…':'<b>Falat:</b> Megvan, 1 140 kcal — rendeződött ✅',live?'':'<span class="v"><b>1</b></span>','data-go="elo"',chev)}
    ${ln(ic('chat'),'2 beszélgetésben várnak rád','Szunya vacsora-ügye · Falat döntése','','data-go="poszt.vacsora"',chev)}
  </section>
  <div class="pillx ${ST.pill&&!ST.pillUsed?'on':''}" id="mzpill" data-m="pill">1 új bejegyzés ↑</div>
  ${fday('Ma')}<div id="today">
  <article class="po rise" style="--i:3">${ph('deru','ma 13:40 · kérés')}
    <p class="txt">Két hétből csak <b>4 estéről tudom</b>, hogy érezted magad — így a stressz-szálhoz még nem tudok hozzányúlni, pedig gyanús nekem valami. 🌤️ Ha ma este bejelentkezel (tényleg 1 perc), hétvégére már meg tudom mutatni, mi mozgatja az energiádat. A sejtésem: <b>az alvásoddal függ össze</b>, nem a munkával.</p>
    <div class="act"><button class="btn sm ghost" data-toast="Bejelentkezés — 1 perces közérzet-kör">${ic('heart')}Bejelentkezem · 1 perc</button></div>
  </article></div>
  ${fday('Tegnap · esti kiadás')}
  <section class="card hg rise" style="--i:4;--c:${CH.szunya.c};margin-top:6px">
    ${ph('szunya','20:30 · bevonta Falatot és a Szkeptikust',st('Rád vár','warn'))}
    <h2 class="t">Lehet, hogy nem az edzés tolja el az estédet.</h2>
    <p class="txt">A késői vacsorák inkább a <b>későn befejezett napok</b> mellé esnek — és utánuk rendre rosszabb az éjszakád: később alszol el, és a mély szakaszból is kevesebb jut. 🌙 Az edzés-estéket külön néztem: azok után <b>nem</b> látom ugyanezt. <span style="color:var(--acc)">@Falat</span>, nálad mi látszik a vacsora-oldalon?</p>
    <button style="display:block;width:100%" data-sheet="evidence" aria-label="Miből látszik?">${KST_VACS()}</button>
    ${src('minta.vacsora','14 közös nap')}
    <div class="sum">${minis(['falat','szk'])}<button data-go="poszt.vacsora">Falat egyetért, a Szkeptikus vitatja · 3 hozzászólás</button></div>
    ${acts('p-vacs',' · 1')}
    ${cmt('szk','Szép együttfutás, de a hétvége önmagában is magyarázhatja: akkor eszel későn <b>és</b> akkor alszol rosszabbul. Válasszuk szét a hétköznapot a hétvégétől, mielőtt bármit kimondunk.')}
    <button class="lk" style="margin-top:8px" data-go="poszt.vacsora">Mind a 3 hozzászólás megnézése</button>
    ${rrow()}
  </section>
  <article class="po rise" style="--i:5">${ph('falat','20:30 · napi értékelés')}
    <p class="txt">A mai tányérod rendben volt — a fehérje megint összejött (<b>148 g</b> 💪), és a meccs előtti szénhidrát is a helyén. Egy dolgot vinnék át holnapra: <b>a zöldség délután elmaradt</b>, pedig délelőtt szépen megy. 🥦 Holnap a délutáni falatokhoz hozok egy konkrét javaslatot.</p>
    ${[['A tányér',78,'rendben'],['A cél',64,'jó úton'],['Az edzés',90,'bevált']].map(([l,w,v])=>`<div class="ln"><span class="g">${l}</span><span class="v">${v}</span>${barq(w)}</div>`).join('')}
    ${acts('p-falat1')}
  </article>
  <article class="po rise" style="--i:6">${ph('mezo','20:30 · a nap beszélgetései')}
    <p class="txt">Tegnap két ügyön dolgoztunk. 📔 Délben Mocor szólt, hogy az esti edzéshez kevés az üzemanyag — Falat az ebédnél pótoltatta, és <b>13:05-re rendeződött</b> ✅. Szunya alvás-ügye nyitva maradt: a <b>22:45-ös</b> lefekvésből 23:20 lett, ma este újra próbáljuk.</p>
    ${KCH(['2 ügy','1 rendeződött','1 holnapra maradt'])}
    <div class="sum">${minis(['szunya','mocor','falat'])}<button data-go="elo">A tegnapi beszélgetés · 9 üzenet</button></div>
    ${acts('p-mezo1')}
  </article>
  <article class="po rise" style="--i:7">${ph('falat','20:30 · a te döntésed kell')}
    <p class="txt">Kezd úgy tűnni, hogy <b>a többet ivós napjaidon több az energiád</b> 💧 — 2 liter fölött rendre 6–8 pontot jelentettél, 1,5 alatt inkább 4–5-öt. <b>8 napot tudok összevetni</b>, épp annyit, amennyit a terv kér. Innen a te szavad kell: igaz ez rád?</p>
    ${src('minta.viz','8 nap')}${acts('p-viz')}
  </article>
  <article class="po rise" style="--i:7">${ph('mocor','20:30 · még csak sejtés')}
    <p class="txt">Kezd összeállni egy kép: az <b>egyhangúbb hetek</b> után esik az energiád — ha három napig ugyanaz a terhelés megy, a negyediken laposabb a reggeli jelentkezésed. ⚡ Még csak 5 közös napom van a 8-ból, úgyhogy nem mondom ki. Ha jövő héten becsúszik egy változatosabb blokk, sokat fogok tanulni belőle.</p>
    <button class="honest" style="width:100%" data-go="poszt.sejtes"><span>5 / 8 nap</span>${barq(62)}<span>még kevés adat</span></button>
    ${src('minta.egyhangu','5 / 8 nap')}${acts('p-sejt')}
  </article>
  <article class="po rise" style="--i:8">${ph('falat','20:30 · közös kísérlet Mocorral · 4/7 nap')}
    <p class="txt"><b>Szénhidrát a meccs előtt</b> 🏐 — két meccsnapon próbáltuk, és mindkétszer stabilabb volt az ugrásod a végjátékban, a 4. szettben is. Ma este megint meccs: ha 17 óráig bekerül a <b>80 g szénhidrát</b>, holnapra majdnem kész a kép.</p>
    <button style="display:block;width:100%" data-go="poszt.kiserlet">${dcell([['Cs','hit'],['P','hit'],['Szo'],['V','hit'],['H','now'],['K'],['Sze']])}</button>
    ${src('kiserlet-oldal.szenhidrat','4/7 nap')}
    <div class="sum">${minis(['mocor'])}<button data-go="poszt.kiserlet">Mocor követi · a kísérlet oldala</button></div>
    ${acts('p-kis')}
  </article>
  <article class="po rise" style="--i:9">${ph('szunya','szombat · megfigyelés')}
    <p class="txt">Hétvégén átlag <b>40 perccel később</b> fekszel le, mint hétköznap — és ezt a hétfői első bejelentkezésed rendre megérzi. 💤 Nem a hétvége a baj, hanem a <b>hétfői ugrás</b>: már egy köztes vasárnapi lefekvés is sokat kisimítana.</p>
    ${after('Megerősítetted · bekerült a rólad szóló képbe')}${src('minta.hetvege','26 nap')}
  </article>
  ${fday('Vasárnap · konzílium')}
  <article class="po rise" style="--i:10">${ph('mezo','vasárnap 19:30 · heti konzílium')}
    <p class="txt">Vasárnap leültünk mind az öten, és végigvettük a hetedet. 📔 <b>Két dolog került a rólad szóló képbe</b> (a hétvégi lefekvés-minta és a meccs előtti szénhidrát), egyet nyugdíjaztunk, mert három hete nem erősödik. A Szkeptikus két felvetést visszadobott — jogosan: kevés még mögöttük a nap. <b>Jövő héten a vacsora-ügy a fókusz.</b></p>
    ${KCH(['+2 bekerült','1 nyugdíjazva','2 visszadobva'])}
    <div class="sum">${minis(['szunya','mocor','falat'])}<button data-go="konzilium">Az ülés jegyzőkönyve · 4 forduló</button></div>
    ${acts('p-konz')}
  </article>
  <article class="po rise" style="--i:11">${ph('mocor','vasárnap · lezárt előrejelzés')}
    <p class="txt"><b>Ez most nem jött be.</b> Könnyebbnek vártam a jó alvás utáni edzést, te ugyanolyannak érezted. Ez is számít — ebből a jelből mostantól óvatosabban következtetek. ⚡</p>
    ${src('elore.alvas-edzes')}<div class="sum"><button data-go="poszt.elorejelzes">Ezt vártam — és ez történt · a teljes kép</button></div>
    ${acts('p-elore')}
  </article>
  ${fday('Ennyi történt')}
  ${fn('<span style="display:block;text-align:center;padding:0 24px 10px">A folyamatban lévő ügyeket közben tovább figyeljük.</span>')}
  `,'fal');
}

/* ═════════ ÉLŐBEN · a csapat beszél (Act III) + S7 válasz ═════════ */
const cmeta=(push,t)=>push?`<span>${ic('bell','sm')} értesítettünk · ${t}</span>`:`<span>csendben · ${t}</span>`;
const ctag=(label,k,meta,ev=true)=>`<div class="ctag">${st(label,k)}${meta}${ev?`<button class="lk" data-sheet="elo-ev">Miből látszik?</button>`:''}</div>`;
const cm=(id,time,tx,{guest=false,tag='',act=''}={})=>`<div class="cm ${guest?'guest':''} rise">${SIB(id,28)}<div class="cb"><div class="nmr"><b>${nm(id)}</b>${CH[id].a?`<span class="area">${CH[id].a}</span>`:''}<em>${time}</em></div><p class="tx">${tx}</p>${tag}${act}</div></div>`;
const me=(time,tx)=>`<div class="cm me rise"><div class="cb"><div class="nmr"><b>Te</b><em>${time}</em></div><p class="tx">${tx}</p></div></div>`;
const typing=id=>`<div class="cm rise">${SIB(id,28)}<div class="cb"><span class="typing" aria-label="${nm(id)} ír"><i></i><i></i><i></i></span></div></div>`;
const s7acts=()=>`<div class="act">${vote('s7')}<button class="lk" data-sheet="reply-falat">Elmesélem</button></div>`;
function s7Block(){const p=ST.s7.phase,t=esc(ST.s7.text);
  const closed=p==='closed';
  const open=cm('falat','21:40','Harmadszor ezen a héten <span class="hl">21 óra után</span> került a vacsora a tányérra. 🍽️ Ha holnap <span class="hl">20:00</span> előtt eszel, az alvásod is hálás lesz érte.',
    {tag:ctag(closed?'Késői vacsora · rendeződött 21:52':'Késői vacsora · nyitott',closed?'q':'warn',cmeta(false,'21:40')),act:(p==='open'||p==='undone'||p==='mood')?s7acts():''});
  let tail='';
  if(p==='typing'||p==='moodTyping')tail=me('21:51',t)+typing('falat');
  if(p==='closed'||p==='undone'){
    const aft=closed?`${ctag('Falat lezárta: meccsnap','q','<span>csendben</span>',false)}<div class="mch" style="margin-left:0">${ic('spark')}<span class="g"><b>Megjegyeztem:</b> meccsnapokon később eszel — ez rendben van.</span><span class="ma"><button class="lk" data-m="s7:undo">Visszavonom</button></span></div>`
      :`<p class="mdone" style="margin-left:0">Visszavonva — nem jegyeztem meg, és az ügy újra nyitott.</p>`;
    tail=me('21:51',t)+cm('falat','21:52','Értem — egy 10-kor véget érő kupa után ez teljesen rendben van. Meccsnapokon nem ezen fogok aggódni.',{tag:aft})}
  if(p==='mood')tail=me('21:51',t)+cm('falat','21:52','Megértem, ilyen napok is vannak. Holnap nézzük meg együtt, mi lenne a gyors, korai megoldás.');
  return `<div id="s7">${fday('Este')}${open}${tail}</div>`}
const DERU=()=>cm('deru','16:20','Harmadik napja <span class="hl">7 fölötti</span> stresszt jelöltél be délután. 🌤️ Nem kell most megoldani — de vacsora után <span class="hl">10 perc séta</span> nálad eddig a következő reggelre átlag 2 ponttal lejjebb vitte.',{tag:ctag('Tartós stressz · nyitott','warn',cmeta(false,'a mai 2 értesítés elfogyott')),act:acts('deru-live')});
function elo(arg){
  if(arg==='kivetel'){const done=ST.s7k==='done';
    return P(`${bk('Üzenőfal','fal')}${hd('Szerda · élőben · a következő alkalom','A csapat beszél')}
    ${fday('Este')}${cm('falat','21:35','Tudom, hogy meccsnapokon később eszel — ez rendben van. Ma is meccsnap volt?',{tag:ctag(done?'Kivétel: meccsnap':'Késői vacsora · kérdés',done?'q':'warn','<span>csendben · nem értesítettünk</span>',false)})}
    ${done?me('21:36','Igen, meccsnap volt')+cm('falat','21:36','Rendben, akkor ez most is kivétel volt.'):`<div class="ofr"><button class="btn sm" data-m="s7k">${ic('tick')}Igen, meccsnap volt</button></div>`}
    <section class="open rise"><span class="eb">Honnan tudja?</span><p class="txt sub">Hétfőn elmondtad Falatnak, és megjegyezte. Ha a mai jegyzetedben szerepelt volna a meccs, ez a kérdés meg sem jelenik — csak egy csendes strigula kerül a kivételre.</p>
    <p class="txt sub" style="margin-top:8px">Ha a gomb helyett írsz, azt is megérti — de kikapcsolni egy kivételt csak gombbal lehet.</p></section>`,'fal')}
  if(arg==='felulvizsgalat'){const s=ST.s7r;
    return P(`${bk('Üzenőfal','fal')}${hd('Egy hónappal később · élőben','A csapat beszél')}
    ${fday('Este')}${cm('falat','21:35','Az utóbbi időben 4 alkalommal jött elő ez a kivétel: meccsnap. Ez még rendben van így, vagy figyeljek rá újra?',{tag:ctag(s==='keep'?'Kivétel marad: meccsnap':s==='stop'?'Kivétel kikapcsolva':'Késői vacsora · felülvizsgálat',s==='open'?'warn':'q','<span>csendben · nem értesítettünk</span>',false)})}
    ${s==='open'?`<div class="ofr act" style="margin-top:0"><button class="btn sm" data-m="s7r:keep">${ic('tick')}Rendben van</button><button class="lk" data-m="s7r:stop">Nem, figyelj rá</button></div>`:''}
    ${s==='keep'?me('21:37','Rendben van')+cm('falat','21:37','Rendben, akkor marad így — tovább figyelek.'):''}
    ${s==='stop'?me('21:37','Nem, figyelj rá')+cm('falat','21:37','Rendben, akkor újra szólok, ha előjön.',{tag:`<p class="mdone" style="margin-left:0">A „meccsnap” kivételt kikapcsoltam — a Tudástárban is elnémítva, a késői vacsorákra újra szólok.</p>`}):''}
    <section class="open rise"><span class="eb">Miért kérdez?</span><p class="txt sub">Egy kivétel 30 napon belül legfeljebb négyszer ment fel csendben. Az ötödiknél egyszer rákérdez — „Rendben van” után újraindul a számolás.</p></section>`,'fal')}
  return P(`${bk('Üzenőfal','fal')}${hd('Ma · élőben · hétfő','A csapat beszél')}
  <section class="open rise" style="--i:1;padding-top:6px;padding-bottom:6px">
    ${ln('<i class="ldot"></i>','Mind az öten figyelnek — akkor szólnak, ha teendő van','',minis(FIVE))}
    ${KCH(['1 nyitott ügy','1 rendeződött','értesítés ma: 2 / 2'])}
    ${ln(ic('moon'),'Rád vár: <b>22:45 előtt ágyba</b>','Szunya este megnézi','','data-toast="Ugrás a reggeli üzenethez"',chev)}
  </section>
  ${fday('Reggel')}
  ${cm('szunya','07:40','Az elmúlt 3 éjszakán összesen <span class="hl">2 óra 10 perc</span> hiányzik a 7 és fél órás célodhoz képest. 🌙 Ma este nem kell semmi különös — csak <span class="hl">22:45 előtt</span> kerülj ágyba, és holnap reggelre a felét visszanyerjük.',{tag:ctag('Alvásadósság · nyitott','warn',cmeta(true,'07:40')),act:acts('szunya-live')})}
  ${cm('szk','07:41','Egy megjegyzés: a szombati éjszakán az óra nem mérte a mély szakaszt, azt becsültük. A hiány ettől még valós, de lehet 20 perccel kevesebb is.',{guest:true})}
  ${fday('Délben')}
  ${cm('mocor','12:05','Ma este <span class="hl">90 perces</span> röplabda-edzés vár, de délig csak <span class="hl">620 kcal</span> ment be — a szokásodnak a fele sincs meg. ⚡ Így a 4. szettre elfogy a lábad. <span class="m">@Falat</span>, tudsz segíteni?',{tag:ctag('Terhelés–táplálás','plan',cmeta(true,'12:05 · súlyosabb a reggelinél'))})}
  ${cm('falat','12:06','Persze! Az ebédnél pótolnám: <span class="hl">+40 g szénhidrát</span> — egy adag rizs vagy két szelet kenyér a fehérjéd mellé. 🍽️ Ha 14 óráig bekerül, bőven marad idő megemészteni.',{guest:true,act:acts('falat-live')})}
  ${me('12:40','Rizses csirkét ettem, dupla adag rizzsel.')}
  ${cm('falat','13:05','Megvan: az ebéddel <span class="hl">1 140 kcal</span> és <span class="hl">95 g szénhidrát</span> jött össze — ez bőven elég az estéhez. ✅ 🥦 Mocor, a te köröd!',{tag:ctag('Rendeződött · 13:05','q',cmeta(false,'a lezárás sosem értesít'))})}
  ${cm('mocor','13:06','Akkor este teljes gázzal. 💪 Az első szettben figyelem, bírja-e a lábad.',{guest:true})}
  ${fday('Délután')}<div id="live">${ST.eloDone?DERU():typing('deru')}</div>
  ${s7Block()}
  <section class="open rise"><p class="txt sub">${ic('journal')} <b>21:00-kor az esti kiadás</b> összefoglalja a nap szálait a falon. A nyitva maradt ügyet holnap reggel Szunya újra előveszi.</p>${rrow()}</section>`,'fal');
}
function napUzenetek(){return P(`${hd('Nap · beszélgetés','Beszélgetés')}
  ${seg([['u','Üzenetek'],['e','Életjelek'],['o','Észrevételek']],'u','ntab')}
  <section class="open rise" style="--i:2">${ln(minis(['szunya','falat','deru']),'A csapat most erről beszél','Szunya: 22:45 előtt ágyba · Falat: az ebéd rendben ✅ · Derű: tartós stressz','','data-go="elo"',chev)}
  ${fn('A napi tanácskártya innen átköltözött a csapat-chatbe — ott születik, ott reagálsz rá, és ott zárul le. Itt csak ez az egy sor maradt, hogy ugyanonnan elérd.')}</section>`,'fal')}

/* ═════════ A CSAPAT + SZOBÁK ═════════ */
function csapat(){const R=[['szunya','Most figyeli: a késői vacsorák és az éjszakád · 1 új dolga van neked','72%'],['mocor','Most figyeli: a terhelésed · 1 sejtésen dolgozik','60%'],['falat','Most figyeli: a vacsoraidőd · 1 aktív kísérlete fut','80%'],['deru','Kevés az adata — ma kért tőled egy bejelentkezést','30%'],['mezo','Vasárnapi konzílium: 2 dolog került a közös képbe','66%']];
  return P(`${hd('Ők figyelnek rád','A csapat')}
  <section class="open first rise" style="--i:1;padding-top:0">${R.map(([id,s,m])=>row({av:id,b:`${nm(id)} · ${CH[id].a.toLowerCase()}`,sm:s,v:`<b>${m}</b> érett`,go:`szoba.${id}`})).join('')}</section>
  <section class="open rise" style="--i:2"><div class="hero-r">${SIB('szk',40)}<p class="txt sub"><b style="color:var(--ink)">A Szkeptikus</b> nem posztol — a beszélgetésekben kérdez vissza, mielőtt bármi bekerülne rólad. A gépezet a <b style="color:var(--ink)">Gépteremben</b> él.</p></div>
  ${row({ic:'gear',b:'Gépterem · Összes funkció',sm:'A motorháztető és a régi eszköztár — dev-ajtó',go:'gepterem'})}</section>`,'csapat')}
const ROOMS={
  szunya:{quote:'Az éjszakáid a szakterületem. Amit itt látsz, azt mind a te naplódból tanultam.',stats:[['15','éjszaka / 60 nap'],['3','beépült tudás']],rows:[
    ['Rád vár','warn','14 közös nap','moon','Rosszabbul alszol, ha későn vacsorázol?','Falattal közös ügy — a te szemed hiányzik hozzá','poszt.vacsora',0],
    ['Gyűlik','q','6 / 8 nap','clock','A hétfői mélypontot a lefekvés ingadozása okozza?','Kb. egy hét, és megszólal — addig csendben számol','',75],
    ['Bekerült','q','szept. 20.','tick','Hétvégén 40 perccel később fekszel','Te erősítetted meg — a rólad szóló kép része','minta.hetvege',0]],
    mat:[52,55,58,58,63,66,70,72],
    tud:[['Hétvégén átlag 40 perccel később fekszel, és ezt a hétfőd érzi meg','te erősítetted meg','szept. 20.','Beépült'],['A jó éjszakáid 23:15 előtti lefekvéssel kezdődnek','12 éjszaka mintája','szept. 5.','Beépült'],['A 16 óra utáni kávé nyugtalanabb éjszakát hoz nálad','8 éjszaka + a te válaszod','aug. 30.','Beépült']],
    arch:[['Nyugdíjazva','3 hétig nem erősödött','moon','A délutáni alvás rontja az éjszakát?','Nem gyűlt hozzá elég nap — ha újra felbukkan, előveszi'],['Elvetetted','a te döntésed','skip','Képernyő lefekvés előtt = rossz alvás?','Azt mondtad, nálad nem így van — a csapat elfogadta']],
    ask:'Kérése: két hétből csak 6 éjszakát naplóztál — minden hiányzó éjszaka egy nappal tolja ki, mire biztosat mondhat.'},
  mocor:{quote:'A terhelésed és az erőd — és az, hogy a napló ne maradjon el. Nem hajtalak, de észreveszem.',stats:[['15','edzésnap / 60 nap'],['1','sejtés']],rows:[
    ['Sejtés','q','5 / 8 nap','bolt','Az egyhangú hetek viszik el az energiádat?','Még nem mondja ki — egy változatosabb hét kellene hozzá','poszt.sejtes',62],
    ['Kísérlet','q','4 / 7 nap','flask','Séta ebéd után — nyugodtabb lesz a délután?','Falattal közös próba, együtt nézik majd az eredményt','poszt.kiserlet',57],
    ['Nem jött be','q','lezárva','down','Könnyebb az edzés, ha jól aludtál?','Nem igazolódott — ebből a jelből óvatosabban következtet','poszt.elorejelzes',0]],
    mat:[40,44,47,50,52,55,58,60],
    tud:[['Kihagyott nap után erősebben jössz vissza — az újrakezdés a te terepad','5 visszatérés mintája','szept. 12.','Beépült'],['A felsőtest-napok reggelén magasabb az energiád','9 edzésnap','szept. 2.','Beépült']],
    arch:[['Nem jött be','lezárva vasárnap','down','Könnyebb az edzés, ha jól aludtál?','Az érzeten nem látszik — Szunyával a súlyoknál keresik tovább']],
    ask:'Kérése: a szettek súlyát is írd fel — abból látja a valódi terhelést.'},
  falat:{quote:'A tányérod, a célod és az edzésed üzemanyaga. Minden este három szólamban értékelek.',stats:[['28','kajanap / 60 nap'],['1','aktív kísérlet']],rows:[
    ['Kísérlet','q','4 / 7 nap','flask','Meccs előtti szénhidrát — stabilabb az ugrásod?','Mocorral közös próba · ma este megint meccs 🏐','poszt.kiserlet',57],
    ['Rád vár','warn','14 közös nap','moon','Rosszabbul alszol, ha későn vacsorázol?','Szunyával közös ügy — ő hozta, Falat a vacsora-oldalt nézi','poszt.vacsora',0],
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
function szoba(id){id=CH[id]&&ROOMS[id]?id:'szunya';const p=CH[id],r=ROOMS[id];
  return P(`${bk('A csapat','csapat')}
  <section class="card hg rise" style="--i:1;--c:${p.c}"><div class="hero-r">${SIB(id,88,true)}<div class="g"><span class="eb">${p.a}</span><p class="verdict">${p.n}</p><p class="txt sub">„${r.quote}”</p></div></div></section>
  <section class="open rise" style="--i:2;padding-top:4px">${bigs([[r.mat[7]+'%','érettség'],...r.stats])}</section>
  <section class="open rise" style="--i:3"><span class="eb">Most ezen dolgozik</span>
    ${r.rows.map(([s,k,meta,i,title,sub,go,pct])=>`<div class="ln ${go?'tap':''}" ${go?`data-go="${go}"`:'data-toast="Saját oldala a megvalósításban nyílik meg"'}>${ic(i)}<span class="g"><span class="tst">${s} · ${meta}</span><br>${title}<small>${sub}</small></span>${pct?barq(pct):''}${chev}</div>`).join('')}</section>
  <section class="open rise" style="--i:4"><div class="sec" style="padding:0 0 4px"><span class="eb">Így érik a képe rólad</span><span class="eb">+${r.mat[7]-r.mat[4]}% · 3 hét</span></div>${curve(r.mat,p.c)}
  ${fn('A görbe a kimondott heti poszt-szám simítása — érettség-történet még nem létezik, ezért ennyit mutatunk, nem többet.')}</section>
  <section class="open rise" style="--i:5"><div class="sec" style="padding:0 0 4px"><span class="eb">Amit rólad tud</span><button class="lk" data-go="tud.${id}">mind · ${r.tud.length} ›</button></div>
    ${r.tud.slice(0,3).map(([t,s,d,k])=>`<div class="ln"><span class="g"><span class="tst">${k}</span>${t}<small>${s} · ${d}</small></span></div>`).join('')}
    ${r.arch.length?row({ic:'history',b:`Lezárt és nyugdíjazott ügyei · ${r.arch.length}`,sm:'az őszinteség itt is látszik',go:`ugyek.${id}`}):''}</section>
  <section class="open rise" style="--i:6"><span class="eb">${p.n} jegyzete · kérése hozzád</span><p class="txt">${r.ask}</p></section>`,'csapat')}
function tud(id){id=ROOMS[id]?id:'szunya';const p=CH[id],r=ROOMS[id];
  return P(`${bk(p.n,'szoba.'+id)}${hd(`${p.n} · amit rólad tud`,`${r.tud.length} beépült tudás`)}
  <section class="open first rise" style="padding-top:0"><p class="txt sub">Minden elemnél látszik a forrása, és te döntesz: használható-e a beszélgetésekben. A kikapcsolás nem törli — csak elhallgattatja.</p>
  ${r.tud.map(([t,s,d,k])=>`<div class="ln" style="align-items:flex-start;flex-wrap:wrap"><span class="g"><span class="tst">${k} · ${d}</span><br>${t}<small>${s}</small><span class="act" style="margin-top:6px"><button class="lk" data-sheet="mibol" data-arg="${esc(t)}">Miből látom?</button><button class="lk" data-toast="Kikapcsolva a beszélgetésekből — az eredet megmarad">Elhallgattatom</button></span></span></div>`).join('')}</section>`,'csapat')}
function ugyek(id){id=ROOMS[id]?id:'szunya';const p=CH[id],r=ROOMS[id];
  return P(`${bk(p.n,'szoba.'+id)}${hd(`${p.n} · lezárt ügyek`,'Ami nem jött be — az is számít')}
  <section class="open first rise" style="padding-top:0"><p class="txt sub">A csapat a tévedéseit is megőrzi: ettől hihető, amit kimond. Egy nyugdíjazott ügy bármikor visszatérhet, ha új adat érkezik.</p>
  ${r.arch.length?r.arch.map(([s,meta,i,title,sub])=>`<div class="ln">${ic(i)}<span class="g"><span class="tst">${s} · ${meta}</span><br>${title}<small>${sub}</small></span></div>`).join(''):fn('Még nincs lezárt ügye.')}</section>`,'csapat')}

/* ═════════ POSZT-OLDALAK ═════════ */
const poszter=(id,meta,flag,claim,body,extra,c)=>`<section class="card hg rise" style="--i:1;--c:${c||CH[id].c};margin-top:6px">${ph(id,meta,flag)}<h2 class="t">${claim}</h2><p class="txt">${body}</p>${extra}</section>`;
function poszt(arg){
  if(arg==='kiserlet')return P(`${bk('Üzenőfal','fal')}${hd('Közös kísérlet · Falat × Mocor · 4/7 nap','Meccs előtti szénhidrát')}
    ${poszter('falat','a kísérlet gazdája · Mocorral közösen',st('Kísérlet'),'Stabilabb az ugrásod, ha meccs előtt szénhidrátot kapsz?','A terv egyszerű: meccsnapokon <b>17 óráig 80 g szénhidrát</b>, aztán megnézzük, mit mond a 4. szett. 🏐 Két meccsnapon már próbáltuk — mindkétszer stabilabb volt a végjáték.',
      dcell([['Cs','hit'],['P','hit'],['Szo'],['V','hit'],['H','now'],['K'],['Sze']])+`<div class="act"><button class="btn sm" data-toast="Ma esti adag megjelölve">${ic('tick')}Ma esti adag: megvolt</button>${src('kiserlet-oldal.szenhidrat','4/7 nap')}</div>`)}
    <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">Eddigi meccsnapok</span><span class="eb">2 / 2 találat</span></div>
      <div class="ln">${ic('up')}<span class="g"><span class="tst">Találat · szept. 18. · csütörtök</span><br>4. szett: az ugrásmagasság kitartott<small>80 g szénhidrát 16:40-ig · a meccs utáni jelentkezésed: „végig volt erőm”</small></span></div>
      <div class="ln">${ic('up')}<span class="g"><span class="tst">Találat · szept. 21. · vasárnap</span><br>Végjátékban is stabil láb<small>75 g szénhidrát 17:00-ig · Mocor a szettenkénti bontást is átnézte</small></span></div></section>
    <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 4px"><span class="eb">Beszélgetés</span><span class="eb">1 hozzászólás</span></div>
      ${cmt('mocor','A szettenkénti bontásban is látszik: a 4. szett ugrásai a 2. szetthez képest csak <b>4%-ot</b> estek — a próba előtt ez <b>11%</b> volt. 💪 Még két meccsnap, és kimondhatjuk. Addig ne változtass semmi máson, mert összekeveri a képet.',0,'MOZGÁS')}
      ${acts('pk')}${rrow()}</section>`,'fal');
  if(arg==='sejtes')return P(`${bk('Üzenőfal','fal')}${hd('Még csak sejtés · mozgás','Az egyhangú hetek viszik el az energiádat?')}
    ${poszter('mocor','5/8 közös nap · még kevés adat',st('Sejtés'),'Ha három napig ugyanaz megy, a negyediken laposabb vagy.','Ötször láttam eddig: három egyforma terhelésű nap után a reggeli energiád <b>átlag 1,2 ponttal</b> alacsonyabb. ⚡ Ez még nem bizonyíték — nyolc közös nap kell, hogy kimondjam, és a Szkeptikus is figyel.',
      `<div class="honest"><span>5 / 8 nap</span>${barq(62)}<span>még kevés adat</span></div>${src('minta.egyhangu','5 / 8 nap')}`)}
    <section class="open rise" style="--i:2"><span class="eb">Mi kellene még?</span>
      ${row({ic:'bolt',b:'Egy változatosabb hét',sm:'Ha jövő héten vegyes a terhelés, és az energiád NEM esik — az ellene szól, és azt is megköszönöm'})}
      ${row({ic:'heart',b:'3 további reggeli jelentkezés',sm:'Derű gyűjti — az energiapontod nélkül nincs mihez mérni'})}</section>
    <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 4px"><span class="eb">Beszélgetés</span><span class="eb">1 hozzászólás</span></div>
      ${cmt('szk','Öt eset kevés, és a hét vége felé amúgy is fáradtabb az ember. Kérlek, a nyolcból legalább kettő legyen <b>hét eleji</b> egyforma-blokk, különben a naptár magyarázza, nem a terhelés.')}
      ${acts('ps')}${rrow()}</section>`,'fal');
  if(arg==='dontes'){const done=ST.dontes==='yes';
    return P(`${bk('Üzenőfal','fal')}${hd('Döntésre vár · étkezés','Korábbi vacsora, nyugodtabb este?')}
    ${poszter('falat','18 összevethető nap · elég adat van',st('Rád vár','warn'),'A 19 óra előtti vacsoráid után nyugodtabbak az estéid.','18 napot tudtam összevetni: a korai vacsorás estéken kevesebb a késő esti nassolás és <b>korábbi a lefekvés</b> is. 🥦 A számok szerint ez már nem véletlen — de a te megerősítésed nélkül nem kerül a rólad szóló képbe.',
      `<button style="display:block;width:100%" data-sheet="evidence">${kst([[60,46,'vacsora 19 előtt','big'],[150,22,'kevesebb nassolás'],[240,46,'korábbi lefekvés','big'],[150,76,'nyugodtabb este']],[[0,1,'d'],[0,2,'s'],[0,3,'d'],[1,2,'d']])}</button>
      ${done?after('Megerősítetted · bekerült a rólad szóló képbe — Mezo jóváhagyta'):`<div class="act"><button class="btn sm" data-m="dontes">${ic('tick')}Ez talál</button><button class="lk" data-m="vote:pd:down">Nem így érzem</button><button class="lk" data-sheet="reply">Elmesélem</button></div>${fn('Az „Ez talál” itt döntés: a megfigyelés bekerül a rólad szóló képbe. Bármikor visszavonhatod.')}`}`,'var(--warn)')}
    <section class="open rise" style="--i:2"><span class="eb">Ha bekerül, mire használjuk?</span>
      ${row({ic:'clock',b:'Az esti javaslatok időzítése',sm:'Falat 18 óra körül szól majd, nem fél tízkor'})}
      ${row({ic:'moon',b:'Szunya vacsora-ügye',sm:'Ez a minta a késői-vacsora vizsgálat egyik építőköve lesz'})}</section>`,'fal')}
  if(arg==='elorejelzes')return P(`${bk('Üzenőfal','fal')}${hd('Lezárt előrejelzés · mozgás','Könnyebb az edzés, ha jól aludtál?')}
    ${poszter('mocor','vasárnap zárult · nem igazolódott',st('Nem jött be'),'Ezt vártam — és ez történt.','',
      vs('A jó éjszaka utáni edzés <b>könnyebbnek</b> érződik majd — 7-es erőfeszítés-érzet alatt.','Ugyanolyannak érezted: <b>7,5 és 8</b> között, a jó éjszakák után is.')+
      `<p class="txt" style="margin-top:10px">Ez is számít — sőt. ⚡ Ebből azt tanultam, hogy nálad az alvás <b>nem az érzeten</b> látszik meg, hanem máshol; Szunyával most azt nézzük, a súlyoknál jelentkezik-e. A becsléseimet ezért óvatosabbra vettem ennél a jelnél.</p>${src('elore.alvas-edzes')}`)}
    <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">Beszélgetés</span><span class="eb">1 hozzászólás</span></div>
      ${cmt('szunya','Örülök, hogy kimondtad. 🌙 Nálam közben az látszik, hogy a jó éjszakák utáni napokon <b>korábban</b> kezded az edzést — lehet, hogy ott a hatás, nem az érzetben. Felveszem gyűlő ügynek.',0,'ALVÁS')}
      ${acts('pe')}${rrow()}</section>`,'fal');
  return P(`${bk('Üzenőfal','fal')}${hd('Közös ügy · alvás × étkezés','Mi tolja későbbre az estédet?')}
    ${poszter('szunya','tegnap 20:30 · bevonta Falatot és a Szkeptikust',st('Rád vár','warn'),'Lehet, hogy nem az edzés tolja el az estédet.','A késői vacsorák inkább a <b>későn befejezett napok</b> mellé esnek — és utánuk rendre rosszabb az éjszakád: később alszol el, és a mély szakaszból is kevesebb jut. 🌙 Az edzés-estéket külön néztem: azok után <b>nem</b> látom ugyanezt.',
      `<button style="display:block;width:100%" data-sheet="evidence">${KST_VACS()}</button>${acts('pv',' · 1')}`)}
    <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">Beszélgetés</span><span class="eb">3 hozzászólás</span></div>
      ${cmt('falat','Nálam is a <b>23 óra utáni vacsora</b> a vízválasztó: azokon a napokon átlag <b>380 kcal</b> csúszik este 9 utánra. 🥗 Két hét még, és szét tudom szedni, hogy a mennyiség vagy az időpont számít-e — a tippem: <b>az időpont</b>.',0,'ÉTKEZÉS')}
      ${cmt('szk','Mielőtt megszeretjük ezt a történetet: a hétvége önmagában is magyarázhatja — akkor eszel későn <b>és</b> akkor alszol rosszabbul, a kettő között nem kell ok-okozatnak lennie. Javaslom, válasszuk szét a hétköznapot a hétvégétől. Ha hétköznap is kirajzolódik, meggyőztetek.',1)}
      ${cmt('mezo','A Szkeptikus javaslatát elfogadom — mostantól a hétvégét <b>külön követjük</b>, és addig ez <b>nem kerül</b> a rólad szóló képbe. ✅ Ha a hétköznapi napokon is kirajzolódik, jövő vasárnap újra elővesszük, és szavazunk róla.',2,'DÖNTÉS')}
      ${rrow()}</section>
    <section class="open rise" style="--i:3"><span class="eb">Miből látszik?</span>${row({ic:'clock',b:'14 közös nap',sm:'ahol vacsoraidő ÉS alvásminőség is rögzült',go:'minta.vacsora'})}${row({ic:'info',b:'A napok egyenként',sm:'11 mellette · 3 ellene',go:'bizonyitek'})}</section>`,'fal');
}
function bizonyitek(){const rows=[['szept. 8.','20:10','6,1',1],['szept. 9.','18:35','7,8',1],['szept. 10.','21:05','5,9',1],['szept. 11.','19:20','7,1',0],['szept. 13.','22:00','5,4',1],['szept. 14.','18:50','7,6',1],['szept. 15.','19:05','6,2',0],['szept. 16.','21:30','5,8',1],['szept. 18.','18:20','7,9',1],['szept. 19.','20:45','6,4',0],['szept. 20.','22:15','5,6',1],['szept. 21.','19:00','7,4',1],['szept. 22.','20:30','6,0',1],['ma','—','még nincs',0]];
  return P(`${bk('Vissza')}${hd('Miből látszik?','Rosszabbul alszol, ha későn vacsorázol?')}
  <section class="card hg rise" style="--i:1;--c:${CH.szunya.c}"><p class="txt">Két jel együttfutása: az <b>utolsó étkezésed ideje</b> és a <b>másnapi alvásminőség</b>. A kiemelt vonal a két jel kapcsolata; a szaggatottak azok, amiket a Szkeptikus még szét akar választani.</p>${KST_VACS()}${scat(MINTA.vacsora)}</section>
  <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">A napok egyenként</span><span class="eb">11 mellette · 3 ellene</span></div>
    ${rows.map(r=>`<div class="ln"><time>${r[0]}</time><span class="g">vacsora ${r[1]}<small>alvás ${r[2]}</small></span><span class="v">${r[3]?'mellette':'ellene'}</span></div>`).join('')}
    ${fn('Őszinteség: ez együttjárás, nem bizonyított ok-okozat. A hiányzó napokon nem volt mindkét adat — azok nem számítanak sem mellette, sem ellene.')}</section>`,'fal')}
function elsonap(){
  const intro=[['szunya','Én az <b>éjszakáidra</b> figyelek majd. 🌙 Még semmit sem tudok rólad — pár naplózott alvás után jelentkezem az első észrevétellel. Addig is egy titok: már az is rengeteget elárul, hogy <b>mikor</b> fekszel le, nem csak az, hogy mennyit alszol.',1],['falat','Én a <b>tányérodat</b> nézem: mit eszel, mikor, és mit tesz ez a céljaiddal. 🍳 Az első naplózott étkezés után már mondok valamit — nem pontozni fogok, hanem észrevenni. A kedvenc kérdésem: <b>mi vált be?</b> Azt ugyanis érdemes megismételni.',0],['mocor','Én a <b>mozgásodra</b> és a terhelésedre figyelek — meg arra, hogy a naplózás ne maradjon el. 💪 Nem hajtalak, de észreveszem, és szólok, ha három nap ugyanaz megy: a tested a <b>változatosságból</b> épül, nem a megszokásból.',0],['deru','Én arra figyelek, <b>hogy vagy</b>. 🌤️ Ehhez a te szavad kell: egy-egy rövid esti bejelentkezés — cserébe én veszem észre, mi mozgatja a hangulatod, és szólok, mielőtt te is éreznéd. Az energiád történetét szerintem együtt fogjuk megfejteni.',0]];
  return P(`${hd('1. nap · bemutatkozunk','Üzenőfal')}${cast()}
  ${poszter('mezo','bemutatkozás',st('Új arc'),'Szia! Mi leszünk a te kis csapatod.','Öten vagyunk, és mostantól rád figyelünk. 👋 Én fogom össze a többieket: hetente leülünk, megvitatjuk, mit láttunk, és <b>csak az kerül a rólad szóló képbe, amiben egyetértünk</b> — a Szkeptikusunk erre kínosan ügyel. Te pedig bármikor rákérdezhetsz bármire: <b>miből látszik?</b> 🔍','')}
  ${intro.map(([id,t,bar],i)=>`<article class="po rise" style="--i:${i+2}">${ph(id,'bemutatkozás')}<p class="txt">${t}</p>${bar?`<div class="honest"><span>0 / 8 nap</span>${barq(3)}<span>ismerkedünk</span></div>`:''}</article>`).join('')}
  ${fday('2. nap · az első szavak')}
  <article class="po rise">${ph('falat','este · az első naplózott étkezésed után')}<p class="txt">Megvolt az első közös vacsoránk! 🍳 Egy tányérból még nem olvasok — de azt már látom, hogy <b>este 8 után</b> ettél, és ezt megjegyeztem. Ha pár nap múlva mintát látok az időpontjaidban, szólok. Addig: minden tányér, amit felírsz, egy mondattal okosabbá tesz.</p><div class="honest"><span>1 / 8 nap</span>${barq(12)}<span>ismerkedünk</span></div></article>
  <article class="po rise">${ph('mezo','este · hogyan tanulunk')}<p class="txt">Egy kis házirend, hogy átlásd: 📔 amit mondunk, arra mindig rákoppinthatsz — <b>Miből látszik?</b> Ott vannak a napok, a források, minden. Amit pedig te mondasz nekünk („Ez talál” / „Nem így érzem”), abból mi tanulunk. Nincs kioktatás, nincs tananyag — <b>a fal magyarázza önmagát</b>.</p></article>
  ${fday('4. nap · az első észrevétel')}
  <article class="po rise">${ph('szunya','reggel · első megfigyelés')}<p class="txt">Három éjszakád van a naplóban, és máris feltűnt valami: mindhárom este <b>23 után</b> feküdtél, de ma reggel — a legkorábbi kelés után — voltál a legfrissebb. 🌙 Ez még csak egy szál, de már húzom. Öt éjszaka múlva mondok róla többet.</p><div class="honest"><span>3 / 8 nap</span>${barq(37)}<span>gyűlik</span></div></article>
  ${fday('7. nap · az első kiadás')}
  ${poszter('mezo','vasárnap este · az első konzíliumotok',st('Első kiadás'),'Egy hét — és már van mit megbeszélnünk.','Ma este leültünk először mind az öten. ✅ Két dolog már <b>gyűlik</b> (Szunya lefekvés-szála és Falat vacsoraidő-figyelése), és egy kérésünk van: Derűnek kellenének az esti bejelentkezések. Mostantól minden este itt találsz minket — keveset írunk, de azt komolyan.',`<div class="sum">${minis(['szunya','falat','deru'])}<button data-go="konzilium">Így zajlik majd a konzílium ›</button></div>`,CH.szunya.c)}`,'fal')}
function ikonok(){
  const used=[['send','Küldés','a válaszmező és a chat küldője'],['flask','Kísérlet','a próbák jele a falon és a szobákban'],['orb','Előrejelzés','az előrejelzés-oldalak jele'],['spark','Megjegyeztem','a chat memória-jelzése'],['bulb','Megjegyezném','a kérdező memória-jelzés'],['people','Emlékszem','amit emberekről elővett'],['pattern','Minta','a Minták és a Tudástár jele'],['history','Futások · előzmények','Gépterem, lezárt ügyek'],['note','Tény','Rólad · tényjelölt'],['journal','Életesemény · konzílium','a krónika jele'],['shield','A te kezedben','jóváhagyás, őszinteség'],['compass','Diagnózis','a Kérdezd a csapatot oldala']];
  const missing=[['eraser → trash','Elfelejtettem','a radír nincs az acél készletben — a kuka jelzi'],['lens → info','Figyeljük · keresés','a nagyító helyett az info-jel'],['council → emberek','Konzílium','a tanács-jel helyett az Emberek (clay)'],['graph → link','Kapcsolatok','a gráf helyett a lánc-jel'],['radar → pattern','Detektorok','a radar helyett a minta-jel'],['eye → trend','Megfigyelő','a szem helyett a trend-jel'],['card → note','A napi kártya','a kártya helyett a jegyzet'],['whistle → bolt','Coaching','a síp helyett a villám']];
  return P(`${bk('Üzenőfal','fal')}${hd('Jóváhagyásra','Új ikonok')}
  <section class="card hg rise" style="--i:1"><span class="eb">A csapat · testvérformák, arc nélkül</span><div class="wrap" style="justify-content:space-between;margin-top:10px">${FIVE.map(id=>`<span style="display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px">${SIB(id,44)}<b>${nm(id)}</b><span class="eb">${CH[id].a.toLowerCase()}</span></span>`).join('')}</div>
  <p class="txt sub" style="margin-top:10px">Nincs új rajzolt ikon: a Boop-figurákat ezen a területen is az öt testvérforma váltja. A Szkeptikus üres, szürke kristály — nem posztol, csak kérdez.</p></section>
  <section class="open rise" style="--i:2"><span class="eb">A meglévő acél készletből, ezen a területen</span>${used.map(([n,t,d])=>row({ic:n,b:t,sm:d})).join('')}</section>
  <section class="open rise" style="--i:3"><span class="eb">Ami hiányzik a shell készletéből · pótlás létező jellel</span>${missing.map(([n,t,d])=>`<div class="ln"><span class="g">${t}<small>${d}</small></span><span class="v">${n}</span></div>`).join('')}
  ${fn('Döntést kér: megrajzoljuk-e ezeket az acél receptben, vagy maradnak a pótló jelek.')}</section>`,'fal')}

/* ═════════ RÓLAD ═════════ */
const INB=[
  {id:'m1',kind:'Összevonási javaslat',who:'mezo',when:'hétfő',ic:'layers',merge:1,src:['Késő esti evés után nehezebben alszol el.','Ha 21 óra után vacsorázol, rosszabbul alszol.'],b:'Késő esti evés után nálad gyakran nehezebb az elalvás.',sm:'A heti rendrakásnál feltűnt, hogy ez a kettő ugyanarról szól. Ha összevonom, a két régi mondat nem vész el: a Tényeknél visszakapcsolhatod.',txt:{keep:'Összevontam — a két régi mondat a Tényeknél visszakapcsolható',snooze:'Jövő hétfőn újra megkérdezem',no:'Külön maradnak — ezt a kettőt nem hozom fel újra'}},
  {id:'c1',kind:'Tényjelölt',who:'falat',when:'ma',ic:'note',b:'Edzés előtt 2-3 órával eszel a legszívesebben.',sm:'A beszélgetésből szűrtük ki — ha bekerül, Falat ehhez igazítja az edzésnapi étkezéseidet.'},
  {id:'c3',kind:'Tényjelölt',who:'mocor',when:'tegnap',ic:'note',b:'A röplabdát heti egy alkalomra ritkítod — csak szombaton jársz.',sm:'A beszélgetésből szűrtük ki.',conflict:'Volleyball: kedd + csütörtök + szombat'},
  {id:'le1',kind:'Életesemény-jelölt',who:'mezo',when:'szept. 22.',ic:'journal',b:'Randizni kezdtél valakivel',sm:'A chatben említetted — ha bekerül, a csapat ehhez méri a következő heteidet. Ha még korai, nyugodtan mondd, hogy most ne.',life:1},
  {id:'se1',kind:'Évszak-jelölt',who:'mezo',when:'2026. IV. negyedév',ic:'calendar',b:'Őszi alapozás',sm:'A negyedéves visszatekintésből — a csapat ehhez az időszakhoz méri az edzéseidet.',life:1}];
const TXT={keep:'Bekerült a rólad szóló képbe — a forrásával együtt',snooze:'Most nem került be — kb. két hét múlva újra megkérdezzük',no:'Nem került be — nem kérdezzük újra'};
function inboxCard(x,i,glass){const d=ST.rinb[x.id],cur=ST['rt_'+x.id]||x.b,who=nm(x.who),T2=x.txt||TXT;
  const wrap=(inner,c)=>glass?`<section class="card hg rise" style="--i:${i};--c:${c||'var(--warn)'}">${inner}</section>`:`<article class="po rise" style="--i:${i}">${inner}</article>`;
  const head=`<div class="ph">${SIB(x.who,26)}<span class="who"><span class="eb" style="display:inline">${x.kind}</span><small>${who} hozta · ${x.when}</small></span></div>`;
  if(d==='keep')return wrap(head+`<p class="txt" style="margin-top:8px"><b>${x.life?'':'„'}${cur}${x.life?'':'”'}</b></p>${after(T2.keep+(x.life&&!x.kind.startsWith('Évszak')?' · 1 kapcsolattal':''))}`,'var(--ok)');
  if(d==='snooze'||d==='no')return `<div class="ln rise" style="margin:0 16px;opacity:.75">${ic(d==='snooze'?'clock':'skip')}<span class="g">${x.merge?x.src.join(' · '):cur}<small>${T2[d]}</small></span></div>`;
  const edit=ST.redit===x.id;
  const body=x.merge?`<div style="margin-top:8px">${x.src.map(t=>`<p class="txt sub">${ic('note','sm')} „${t}”</p>`).join('')}<span class="eb" style="margin:8px 0 2px">egy mondatban</span><p class="txt"><b>„${cur}”</b></p><p class="txt sub">${x.sm}</p></div>`
    :`<p class="txt" style="margin-top:8px"><b>${x.life?'':'„'}${cur}${x.life?'':'”'}</b></p><p class="txt sub">${x.sm}</p>${x.conflict?`<p class="txt sub" style="margin-top:6px;color:var(--warn)">Ellentmond ennek: »${x.conflict}«</p><button class="lk" data-m="chk" aria-pressed="${ST.chk}">${ST.chk?'✓ ':''}A régit kikapcsolom</button>`:''}`;
  const act=edit?`<div>${x.life?`<input value="${esc(cur)}" aria-label="Cím"><textarea rows="2" aria-label="Összefoglaló">${x.sm}</textarea>`:`<textarea rows="2" aria-label="A tény szövege">${cur}</textarea>`}<div class="act"><button class="btn sm" data-m="rsave:${x.id}">${ic('tick')}${x.merge?'Így vond össze':'Így jegyezd meg'}</button><button class="lk" data-m="redit:">Mégse</button></div></div>`
    :x.merge?`<div class="act"><button class="${glass?'btn sm':'lk'}" data-m="rdec:${x.id}:keep">${glass?ic('tick'):''}Összevonom</button><button class="lk" data-m="redit:${x.id}">Átírom</button><button class="lk" data-m="rdec:${x.id}:snooze">Később</button><button class="lk" data-m="rdec:${x.id}:no">Maradjon külön</button></div>`
    :`<div class="act"><button class="${glass?'btn sm':'lk'}" data-m="rdec:${x.id}:keep">${glass?ic('tick'):''}Igen, jegyezd meg</button><button class="lk" data-m="redit:${x.id}">Pontosítom</button><button class="lk" data-m="rdec:${x.id}:snooze">Most ne</button><button class="lk" data-m="rdec:${x.id}:no">Nem igaz</button></div>`;
  return wrap(head+body+act)}
const RFACTS=[['szunya','Hétvégén átlag 40 perccel később fekszel le','21× visszaigazolva · beszélgetésből'],['falat','Koffein 14:00 után már nem','23× visszaigazolva · beszélgetésből'],['mocor','Röplabda: kedd + csütörtök + szombat','18× visszaigazolva · beszélgetésből'],['mezo','Szereted érteni a javaslatok indoklását','tőled · kézzel vetted fel · aug. 20.']];
const lifers=()=>{const le=ST.rinb.le1==='keep'?[[ST.rt_le1||'Randizni kezdtél valakivel','most került be · tőled tudjuk','szept. 22.']]:[],se=ST.rinb.se1==='keep'?[[ST.rt_se1||'Őszi alapozás','évszak · most került be','2026. IV. n.év']]:[];
  return [...le,...se,['Új munkahely első hete','hétfőn kezdtél · a naplódból, te hagytad jóvá','aug. 21.'],['Nyári alapozás','lezárult évszak — a nyári hetek külön mércével számítanak','2026. III. n.év','dim']]};
const lifer=([b,sm,d,k])=>`<div class="lifer"><u class="${k||''}"></u><span class="g">${b}<small>${sm}</small></span><em>${d}</em></div>`;
function rolad(full){
  const quote=`<section class="card hg rise quote" style="--i:1;--c:${CH.szunya.c}"><span class="eb">A csapat benyomása · a legbiztosabb állítás</span>
    <p class="q">„Hétvégén rendszeresen később fekszel le — és a hétfői edzésed ezt meg is érzi.”</p>
    <p class="txt sub">Így fogalmaz most rólad <b>Szunya</b> · javítható benyomás, nem címke</p>
    <div class="act">${ST.rq==='talal'?after('Megerősítetted — a benyomás erősödik').replace('class="aft"','class="aft" style="margin:0"'):`<button class="btn sm ghost" data-m="rq">${ic('thumb-up')}Talál</button>`}<button class="lk" data-sheet="reply">Pontosítom</button><button class="lk" data-sheet="mibol" data-arg="Hétvégén rendszeresen később fekszel le">Miből látom?</button></div></section>`;
  const undecided=INB.filter(x=>!ST.rinb[x.id]),open=undecided.length;
  const shown=ST.s6all||full?INB:undecided.slice(0,2),rest=INB.length-shown.length;
  const inbox=`<div class="sec rise"><span class="eb">Döntésre vár</span><span class="eb">${open?open+' jelölt':'mind eldöntve'}</span></div>
    ${shown.map((x,i)=>inboxCard(x,i+2,i===0&&!ST.rinb[x.id])).join('')}
    ${rest>0||ST.s6all?`<div class="p16">${fold('s6all',ST.s6all?'Mutass kevesebbet':`Még ${rest} javaslat · korábban eldöntöttek és további jelöltek`,ST.s6all,'')}</div>`:''}`;
  const kirakat=`<section class="open rise" style="--i:5"><span class="eb">Amit a csapat megjegyzett · a Tudástárban</span>
    ${row({ic:'person',b:'Tények rólad',sm:'83 bekapcsolva · 7 elhallgattatva',v:'<b>90</b>',go:'tenyek'})}${row({ic:'people',b:'Emberek',sm:'18 ember · 3 elhallgattatva',v:'<b>70</b>',go:'kind.6'})}${row({ic:'pattern',b:'Észrevételek',sm:'26 még igaz · 1 felülírva',v:'<b>30</b>',go:'mintak'})}${row({ic:'cowave',b:'Hatások',sm:'7 ember · 4 esemény',v:'<b>12</b>',go:'toast:Hatások — a Tudástár hub lapja'})}</section>`;
  const nf=15+INB.filter(x=>!x.life&&ST.rinb[x.id]==='keep').length;
  const facts=`<section class="open rise" style="--i:6"><div class="sec" style="padding:0 0 4px"><span class="eb">A tények rólad</span><span class="eb">${nf} aktív</span></div>
    ${RFACTS.map(([w,t,s])=>`<div class="ln">${SIB(w,22)}<span class="g">${t}<small>${s}</small></span></div>`).join('')}${row({ic:'book',b:`Mind a ${nf} tény`,sm:'kereséssel, forrással és Elhallgattatom-kapcsolóval',go:'tenyek'})}</section>`;
  const life=`<section class="open rise" style="--i:7"><div class="sec" style="padding:0 0 4px"><span class="eb">Életesemények</span><button class="lk" data-go="eletesemenyek">mind ›</button></div>${lifers().slice(0,full?9:2).map(lifer).join('')}</section>`;
  const doors=`<section class="open rise" style="--i:8"><span class="eb">Tovább</span>${row({ic:'person',b:'A csapat képe rólad, dimenziónként',sm:'9 témakör · mindegyik pontosítható',go:'dimenziok'})}${row({ic:'chat',b:'Így beszélj velem',sm:'a saját kommunikációs kéréseid',go:'toast:Így beszélj velem — a beállításokban (Én)'})}${row({ic:'graph',b:'Kapcsolatok',sm:'a tudásod térképe',go:'kategoriak'})}</section>`;
  const note=`<section class="open rise" style="--i:9"><span class="eb">A te kezedben</span><p class="txt sub">${ic('shield','sm')} Minden, ami itt áll, forrással együtt él — bármit elhallgattathatsz vagy pontosíthatsz. A csapat csak azt használja, amit jóváhagytál.</p></section>`;
  return P(`${hd('A közös kép · amit a csapat kimondott rólad','Rólad')}${quote}${inbox}${kirakat}${facts}${life}${doors}${note}`,'rolad');
}
function eletesemenyek(){return P(`${bk('Rólad','rolad')}${hd('Rólad','Életesemények')}
  <section class="open first rise" style="padding-top:0"><p class="txt sub">A nagy fordulatok, amikhez a csapat igazodik — a mércék és a javaslatok ezekhez képest értelmeződnek.</p>${lifers().map(lifer).join('')}
  ${fn('Új életesemény javaslatként érkezik a Rólad oldalra — ott döntesz róla.')}</section>`,'rolad')}
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
function dimenziok(){return P(`${bk('Rólad','rolad')}${hd('Karakter · 9 témakör · mindegyik pontosítható','Amit eddig tudunk rólad')}
  <section class="open first rise" style="padding-top:0">${DIMS.map(d=>`<div class="ln tap" data-go="dimenzio.${d.key}">${d.o?SIB(d.o,28):ic('spark')}<span class="g">${d.t}<small>${d.c}</small></span><span class="v"><b>${d.m}%</b></span>${chev}</div>`).join('')}</section>`,'rolad')}
const CLAIMS=[['Biztos','A testzsírszázalék lassan csökken, miközben a testsúly stagnál — ez rekompozícióra utal.'],['Figyeljük','A gyógyszerciklus hetei egyelőre nem mutatnak kimutatható hatást a súlytrenden.'],['Valószínű','A reggeli mérések szórása alacsony — a mérési fegyelmed stabil alapot ad a trendnek.']];
function dimenzio(key){const d=DIMS.find(x=>x.key===key)||DIMS[0],id=d.o||'mezo',c=CH[id].c;
  const sub=d.key==='chapter'?'közös AI-fejezet':d.key==='selfaudit'?'a társ önvizsgálata · Szkeptikus':`${nm(id)} figyeli`;
  return P(`${bk('Dimenziók','dimenziok')}
  <section class="card hg rise" style="--i:1;--c:${c}"><div class="hero-r">${d.o?SIB(id,72,true):ic('spark')}<div class="g"><span class="eb">Dimenzió · ${sub}</span><p class="verdict">${d.t}</p>${big(d.m+'%','érettség')}</div></div></section>
  <section class="open rise" style="--i:2"><p class="txt">A testösszetételed lassan, de biztosan javul — a testzsír-trend nagyjából három hónap alatt csökken, miközben a testsúlyod közben gyakorlatilag helyben áll. Ez arra utal, hogy a hipertrófia-blokkok tényleg izmot építenek, nem csak számokat mozgatnak.</p></section>
  <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 4px"><span class="eb">Állítások</span><span class="eb">3</span></div>
    ${CLAIMS.map(([cf,t],i)=>{const fb=ST.fb[i];return `<div class="ln" style="flex-wrap:wrap;${fb==='no'?'opacity:.6':''}"><span class="g"><span class="tst">${cf}</span><br>${t}</span>
      ${fb==='no'?`<p class="fn" style="margin:4px 0 0;flex-basis:100%">nyugdíjazva — a csapat nem viszi tovább</p>`:fb==='yes'?after('Köszönöm — jegyzem.').replace('class="aft"','class="aft" style="flex-basis:100%;margin-top:6px"'):`<div class="act" style="flex-basis:100%;margin-top:6px"><button class="lk" data-m="mfb2:${i}:yes">Talál</button><button class="lk" data-m="mfb2:${i}:no">Nem igaz</button><button class="lk" data-sheet="reply">Pontosítom</button><button class="lk" data-sheet="mibol" data-arg="${esc(t)}">Miből látom?</button><button class="lk" data-toast="Mi változott? — a dialógus a megvalósításban él">Mi változott?</button></div>`}</div>`}).join('')}</section>
  <section class="open rise" style="--i:4">${row({av:'mezo',b:'Beszélgess erről Mezóval',go:'chat'})}${fn('Az állítások bizonyítékból születnek, sosem fordítva — és amit tévesnek mondasz, azt a csapat nem vitatja tovább.')}</section>`,'rolad')}

/* ═════════ TUDÁSTÁR ═════════ */
const CAT={train:['edzés','dumbbell'],fuel:['étkezés','bowl'],health:['egészség','heart'],life:['élet','sun']};
const FACTS=[['train','Pull Day-en a Chest Supported Row a key compound.','12× visszaigazolva · beszélgetésből'],['fuel','A késői étkezés és az alvásminőség együtt mozog.','8× visszaigazolva · mintából — „Késői étkezés ↔ rákövetkező alvásminőség”'],['health','A reggeli mérés 7:00 és 7:30 között történik.','6× visszaigazolva · beszélgetésből'],['life','Volleyball: kedd + csütörtök + szombat.','5× visszaigazolva · kézzel']];
const frow=(f,s,key)=>{const [l,i]=CAT[f[0]];const on=ST.toff&&ST.toff[key]?false:s!=='off';return `<div class="ln ${on?'':'off'}">${ic(i)}<span class="g">${f[1]}<small>${l} · ${f[2]}</small><small>${on?(s==='wait'?'Bekapcsolva, de most kimarad':'Most benne van a chatben'):'Kikapcsolva — a társ nem látja'}</small></span>${tgl(on,`toff:${key}`)}</div>`};
const S9M=[{id:'g1',cat:'fuel',t:'Az edzés előtti étkezés 2-3 órával előtte esik neked a legjobban.',into:'Edzés előtt 2-3 órával eszel a legszívesebben.',d:'szept. 29.'},{id:'g2',cat:'train',t:'A röplabda után másnap fáradtabbnak érzed a lábad.',into:'Hosszú röplabda után a következő napon gyakran nehezebb a lábad.',d:'szept. 29.'}];
function tudastar(){const n=INB.filter(x=>!ST.rinb[x.id]).length;
  return P(`${bk('Rólad','rolad')}<div class="sec rise"><span class="eb">Rólad</span><button class="lk" data-go="hogyan">Hogyan működik? ›</button></div><div class="p16 rise"><h1 class="t">Tudástár</h1></div>
  <section class="open first rise" style="--i:1">${big('15','tény rólad · 10 megy a chatbe · 12 kapcsolat')}</section>
  <section class="open rise" style="--i:2">${n?row({ic:'bell',b:`${n} javaslat vár rád a Rólad oldalon`,sm:'Ott döntesz róluk: Igen, jegyezd meg · Pontosítom · Most ne · Nem igaz',go:'rolad'}):fn('Nincs döntésre váró javaslat. Ha a csapat újat hoz, a Rólad oldalon kérdez meg.')}</section>
  <section class="open rise" style="--i:3"><span class="eb">A tudás</span>${row({ic:'note',b:'Tények',sm:'10 a chatben · 4 vár · 1 kikapcsolva',v:'<b>15</b>',go:'tenyek'})}${row({ic:'graph',b:'Kategóriák',sm:'Késői evés rontja az alvást · 12 él',v:'<b>7</b>',go:'kategoriak'})}</section>`,'rolad')}
function tenyek(){const nM=S9M.filter(m=>!ST.s9back[m.id]).length;
  return P(`${bk('Tudástár','tudastar')}<div class="sec rise"><span class="eb">Tudástár</span><button class="lk" data-go="hogyan">Hogyan működik? ›</button></div><div class="p16 rise"><h1 class="t">Tények</h1></div>
  <section class="open first rise" style="--i:1">${big('15','tény rólad · 10 megy a chatbe · 12 kapcsolat')}
    <div class="ln tap" data-toast="Keresés a tények között">${ic('lens')}<span class="g" style="color:var(--faint)">Keresés · pl. alvás, kávé, váll</span></div>
    ${seg([['m','Mind'],['e','Edzés'],['t','Étkezés'],['g','Egészség'],['l','Élet']],'m','tf')}
    ${ln(ic('layers'),'<b>Hétfői rendrakás:</b> '+(nM?`${nM} ismétlést összevontam`:'mindent visszakapcsoltál')+', 1 javaslat vár rád a Rólad oldalon.','','','data-go="rolad"',chev)}</section>
  <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">Most ezeket kapja meg a társ</span><span class="eb">10</span></div>${FACTS.map((f,i)=>frow(f,'in','f'+i)).join('')}
    ${fn('Minden beszélgetés elején ezek a mondatok mennek elé: a 10 legerősebb bekapcsolt tény, plusz a frissen megerősített minták.')}</section>
  <section class="open rise" style="--i:3;padding-top:0">${fold('wait','Bekapcsolva, de most kimarad · 4',ST.waitOpen,frow(['fuel','Hétvégén később kezdődik az első étkezés.','2× visszaigazolva · beszélgetésből'],'wait','w1')+frow(['train','A vállnyomásnál a bal oldal érzékenyebb.','1× visszaigazolva · beszélgetésből'],'wait','w2')+fn('Ha megerősödnek, vagy egy erősebb tény kiesik, bekerülnek a chatbe.'))}
    ${fold('off','Kikapcsolva · 1',ST.offOpen,frow(['fuel','kifli.hu az elsődleges élelmiszer-forrás.','3× visszaigazolva · beszélgetésből'],'off','o1')+fn('Megőrzöm őket, de a társ nem használja.'))}
    ${fold('s9','Összevontam · '+S9M.length,ST.s9open,S9M.map(m=>{const back_=ST.s9back[m.id];const [l,i]=CAT[m.cat];return `<div class="ln ${back_?'':'off'}">${ic(back_?i:'layers')}<span class="g">${m.t}<small>${l} · beszélgetésből</small><small>${back_?'Újra külön — mindkettőt használom':`összevontam ezzel: „${m.into}”, ${m.d}`}</small><button class="lk" style="margin-top:4px" data-m="s9back:${m.id}">${back_?'Mégis maradjon összevonva':'Visszakapcsolom'}</button></span></div>`}).join('')+fn('Ezek ugyanazt mondták, mint egy másik tény, ezért a másikba olvasztottam őket — a szövegük nem változott, és semmi nem veszett el. Ha mégis külön kellenek, kapcsold vissza.'))}</section>`,'rolad')}
const KINDS=[['Minták','pattern',3,'Késői evés rontja az alvást'],['Preferenciák','checkin',4,'Reggel edz a legszívesebben'],['Célok','flag',2,'Nyári alapozás'],['Életesemények','sun',1,'Új munkahely első hete'],['Szezonok','calendar',1,'Nyári alapozás'],['Belátások','bulb',0,'—'],['Emberek','people',2,'Anna']];
function kategoriak(){return P(`${bk('Tudástár','tudastar')}${hd('Tudástár · ugyanennek a tudásnak a térképe','Kategóriák')}
  <section class="open first rise" style="padding-top:0">${KINDS.map((k,i)=>k[2]?row({ic:k[1],b:k[0],sm:k[3],v:`<b>${k[2]}</b>`,go:`kind.${i}`}):`<div class="ln" style="opacity:.6">${ic(k[1])}<span class="g">${k[0]}<small>—</small></span><span class="v">0</span></div>`).join('')}</section>`,'rolad')}
function kind(i){const k=KINDS[+i||0];const L=[['Késői evés rontja az alvást','2 kapcsolat'],['Hétvégi fehérje-elmaradás','1 kapcsolat'],['Rövid alvás után kisebb volumen','']].slice(0,Math.max(1,k[2]));
  return P(`${bk('Kategóriák','kategoriak')}${hd('Kategória',`${k[0]} · ${k[2]}`)}<section class="open first rise" style="padding-top:0">${L.map(r=>row({ic:k[1],b:r[0],sm:r[1],go:'node'})).join('')}</section>`,'rolad')}
const HOGYAN=[['book','Mi az a tény?','Egy rólad szóló mondat, amit a társ megjegyzett. Vagy a beszélgetéseitekből szűrte ki, vagy egy megerősített mintából tanulta, vagy te vetted fel kézzel.'],['key','Mit csinál a kapcsoló?','Bekapcsolva a tény versenyben van azért, hogy bekerüljön minden beszélgetés elé. Kikapcsolva a társ soha nem látja — sem a válaszaiban, sem a felismeréseiben.'],['repeat','Mit jelent a visszaigazolás?','Hányszor jött vissza ugyanez magától: vagy újra elmondtad a chatben, vagy a minta-motor újra kimérte. Minél többször, annál előrébb sorolódik.'],['layers','Miért marad ki néhány?','Csak a 10 legerősebb bekapcsolt tény fér be egy beszélgetésbe. A többi bekapcsolva marad és várakozik — ha megerősödik, bekerül. Kivétel: egy frissen megerősített minta-tényt az első 3 napban a rangsortól függetlenül is megkapja a társ.'],['bulb','Hol döntök a javaslatokról?','A Rólad oldalon. Amíg nem fogadod el őket, semmi nem történik velük — a társ nem használja őket. A „Most ne” két hét múlva újra előhozza, a „Nem igaz” végleg elengedi.'],['graph','Mik a kategóriák?','Ugyanennek a tudásnak a térképe: minták, preferenciák, célok, életesemények, szezonok, belátások, emberek — és a köztük futó kapcsolatok.']];
function hogyan(){return P(`${bk('Tudástár','tudastar')}${hd('Tudástár','Hogyan működik?')}
  <section class="open first rise" style="padding-top:0"><p class="txt sub">Hat rövid kérdés. Koppints, és egy lapon elolvasod a választ — a munkafelületen nem tartunk bekezdéseket.</p>
  ${HOGYAN.map(([i,q],n)=>`<div class="ln tap" data-sheet="hogyan" data-arg="${n}">${ic(i)}<span class="g">${q}</span>${chev}</div>`).join('')}</section>`,'rolad')}
function node(){return P(`${bk('Kategóriák','kategoriak')}${hd('Minta · kapcsolat','Késői evés rontja az alvást')}
  <section class="card hg rise" style="--i:1"><span class="eb">Minta</span><p class="txt" style="margin-top:6px"><b>A 21 óra utáni vacsora után a következő éjszaka rendre felszínesebb.</b></p>
  ${kst([[60,46,'késői evés','big'],[150,46,'rossz alvás','big'],[240,46,'gyenge edzés']],[[0,1,'s'],[1,2,'d']])}
  <div class="ln"><span class="g">Késői evés → kiváltja → Rossz alvás</span><span class="v">erős</span></div><div class="ln"><span class="g">Rossz alvás → támogatja → Gyenge edzés</span><span class="v">közepes</span></div>
  <div class="act"><button class="lk" data-toast="Archiválva">Archivál</button></div>${fn('Archiválás után nem kerül a beszélgetésbe. A forrásadataid megmaradnak.')}</section>`,'rolad')}

/* ═════════ KONZÍLIUM ═════════ */
const THREADS=[
  {id:'t1',t:'Regeneráció',faces:['szunya','deru','mocor'],sub:'2 állítás · 3 hozzászólás',items:[['Bekerült','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.'],['Megerősítve','Hétfőn a pulzusvariancia rendszeresen gyengébb.']]},
  {id:'t2',t:'Táplálkozási',faces:['falat','szk'],sub:'1 állítás · nem vitatták',items:[['Elvetve','A hétvégi fehérje-elmaradás három hete következetes mintázat.']]},
  {id:'t3',t:'Fizikai',faces:['deru'],sub:'1 állítás · 1 elfogadva',items:[['Bekerült','A testzsír-trend és a stagnáló testsúly rekompozícióra utal.']]},
  {id:'t4',t:'Fegyelem',faces:['mocor'],sub:'1 állítás · 1 elfogadva',items:[['Nyugdíjazva','A hétvégi logolás rendszeresen elmarad.']]}];
const tc=(id,tag,t,i=0)=>cmt(id,t,i,tag);
function konzilium(){
  const head=`${bk('A csapat','csapat')}${hd('Konzílium · augusztus 30. · heti','Az ülés jegyzőkönyve')}
  <div class="sec rise" style="padding-top:0"><button class="lk" data-toast="Korábbi tanácskozás">‹ korábbi</button><button class="lk" data-sheet="archive">augusztus 30. · heti ⌄</button><span class="eb" style="color:var(--hair)">későbbi ›</span></div>
  ${seg([['ov','Áttekintés'],['cv','Beszélgetés']],ST.konz,'konz')}`;
  const honest=fn('A fenti a valódi beszélgetés, ami lezajlott — a felület sosem dramatizálja utólag; amit itt olvasol, azt a csapat pontosan így mondta.');
  if(ST.konz==='cv')return P(head+`
  <section class="open first rise" style="--i:1;padding-top:4px"><div class="sec" style="padding:0 0 2px"><span class="eb">1 · Javaslatok</span><span class="eb">3 felvetés</span></div>${tc('szunya','','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.')}${tc('deru','','A testzsír-trend és a stagnáló testsúly rekompozícióra utal.')}${tc('falat','','A hétvégi fehérje-elmaradás három hete következetes mintázat.')}</section>
  <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 2px"><span class="eb">2 · Kereszt-vita</span><span class="eb">3 hozzászólás</span></div><p class="txt sub" style="font-style:italic">„A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.” — Szunya</p>${tc('deru','TÁMOGATJA','A pulzusvariancia is ezt a két napot mutatja gyengébbnek.')}${tc('mocor','VITATJA','Szerintem ez nem alvás, hanem hétvégi program — nem viselkedési minta.')}${tc('deru','ÁRNYALJA','A kettő nem zárja ki egymást: a program tolja ki, a hatása viszont alvás.')}</section>
  <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 2px"><span class="eb">3 · Szkeptikus</span><span class="eb">2 vizsgálat</span></div>${tc('szk','MEGHAGYTA','Hat hét adat, konzisztens. Mocor ellenvetése nem cáfolja a mintát.')}${tc('szk','KUKÁZTA','Három hét túl kevés, és két hétvége nyaralás volt.')}</section>
  <section class="open rise" style="--i:4"><div class="sec" style="padding:0 0 2px"><span class="eb">4 · Mezo dönt</span><span class="eb">1 bekerült · 1 elvetve</span></div>${tc('mezo','BEKERÜLT · BIZTOS','Bekerül a dossziéba — a Szkeptikus érvét fogadom el.')}${tc('mezo','ELVETVE','Elvetem — a Szkeptikus kifogása megalapozott.')}${honest}</section>`,'csapat');
  return P(head+`
  <section class="open first rise" style="--i:1;padding-top:4px"><p class="txt sub">Hetente a szakértői csapat átnézi az adataidat, megvitatja egymás felvetéseit, a Szkeptikus kikérdezi őket, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.</p>
    <span class="eb" style="margin-top:12px">Mi változott a dossziédban</span>${bigs([['2','bekerült'],['1','nyugdíjazva'],['1','portré átírva']])}</section>
  <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">Hogyan zajlott</span><span class="eb">4 forduló</span></div>
    ${[['1 · Javaslat','5 felvetés','Ki mit hozott az asztalra','Szunya 2 · Falat 1 · Derű 1 · Mocor 1'],['2 · Kereszt-vita','3 hozzászólás','Ahol egymás felvetéseit nézték','Derű Szunya mellé állt; Mocor vitatta, Derű árnyalta'],['3 · Szkeptikus','5 vizsgálat','A kételkedés köre','a fehérje-ügyet kevés napnak találta'],['4 · Mezo dönt','3 elfogadva · 2 elvetve','Ami a képedbe került','a hétvégi lefekvés-minta + a rekompozíció']].map(([s,m,b,sm])=>`<div class="ln"><span class="g"><span class="tst">${s} · ${m}</span><br>${b}<small>${sm}</small></span></div>`).join('')}</section>
  <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 4px"><span class="eb">A szálak</span><span class="eb">4</span></div>
    ${THREADS.map(t=>{const open=ST.th===t.id;return `<div class="ln tap" style="flex-wrap:wrap" data-m="th:${t.id}">${minis(t.faces)}<span class="g">${t.t}<small>${t.sub}</small></span><i style="font-style:normal;color:var(--faint)">${open?'⌃':'⌄'}</i>
      ${open?`<div style="flex-basis:100%">${t.id==='t1'?tc('szunya','FELVETETTE','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.')+tc('deru','TÁMOGATJA','A pulzusvariancia is ezt a két napot mutatja gyengébbnek.')+tc('mocor','VITATJA','Szerintem ez nem alvás, hanem hétvégi program — nem viselkedési minta.')+tc('szk','MEGHAGYTA · BIZTOS','Hat hét adat, konzisztens.')+tc('mezo','BEKERÜLT · BIZTOS','Bekerül a dossziéba — a Szkeptikus érvét fogadom el.')+rrow():t.items.map(it=>`<p class="txt sub" style="margin-top:6px"><span class="tst">${it[0]}</span>${it[1]}</p>`).join('')}</div>`:''}</div>`}).join('')}${honest}</section>
  <section class="open rise" style="--i:4">${row({ic:'shield',b:'Mi változott a dossziédban',sm:'a bekerült állítások a Rólad oldalon élnek',go:'rolad'})}</section>`,'csapat');
}

/* ═════════ GÉPTEREM ═════════ */
function gepterem(){return P(`${bk('A csapat','csapat')}${hd('Dev-ajtó · a motorháztető alatt','Gépterem')}
  <section class="open first rise" style="padding-top:0"><p class="txt sub">Boop működése · források, memória és futások. Legutóbb: <b>aug. 30. · 3 megfigyelés · 2 szakértő hívva</b>. Ez nem a fal része — ide akkor jössz, ha a gépezetre vagy kíváncsi. Minden, amit a csapat mond, innen ellenőrizhető.</p>
  ${[['history','Futások','e héten 7 futás · 11 megfigyelés','futasok'],['link','Adatforrások','a teljes tervezett korpusz','adatforrasok'],['journal','AI-napló','minden hívás tárolva','toast:AI-napló — admin felület'],['radar','Detektorok','az aktív katalógus','detektorok'],['layers','Memória','rétegek, eredet és költségek','memoria'],['eye','Megfigyelők','a coaching javaslatainak háttere','megfigyelo'],['grid','Összes funkció','a régi teljes menü — minden eszköz egy helyen','osszes']].map(([i,b,sm,go])=>row({ic:i,b,sm,go})).join('')}
  ${fn('Minden Karakter-hívás mentve — feature=character, lépésenként (observe / propose / skeptic / integrate / portrait). Semmi nem tűnik el.')}</section>`,'csapat')}
function osszes(){const Mn=[['pattern','Minták','Amit újra és újra észreveszünk','mintak'],['orb','Előrejelzések','Mit vártunk, és mi történt?','elorejelzesek'],['diagnose','Diagnózis','Keressünk magyarázatot együtt','diagnozis'],['flask','Kísérletek','Kis változtatás, követhető eredmény','kiserletek'],['calendar','Heti','Értékelés és a napjaid','toast:Heti — az Én területen'],['person','Karakter','Ahogyan a csapat lát téged','dimenziok'],['book','Tudástár','Tények, események, kapcsolatok','tudastar'],['album','Emlékek','Napló, memoár és visszakeresés','emlekek'],['council','Konzílium','A csapat beszélgetései és következtetései','konzilium'],['whistle','Coaching','Miért ezt javasoltuk ma?','coaching'],['chat','Beszélgetés','Mezóval, szövegben és hanggal','chat'],['gear','Gépterem','Futások, adatforrások és memória','gepterem']];
  return P(`${bk('Gépterem','gepterem')}${hd('A gépterem mellől','Összes funkció')}<section class="open first rise" style="padding-top:0"><p class="txt sub">Minden ismerős eszközöd egy helyen, a saját nevén.</p>${Mn.map(([i,b,sm,go])=>row({ic:i,b,sm,go})).join('')}</section>`,'csapat')}
const RUNDAYS=[['H','aug. 24.',[['Konzílium','Heti','calendar','6 megfigyelés feldolgozva','heti'],['Éjszakai kör','Éjszakai','moon','2 megfigyelés · 2 szakértő hívva','ejsz']]],['K','aug. 25.',[['Éjszakai kör','Éjszakai','moon','csendes nap · 0 hívás','csendes']]],['Sze','aug. 26.',null],['Cs','aug. 27.',[['Éjszakai kör','Éjszakai','moon','2 megfigyelés · 2 szakértő hívva','ejsz']]],['P','aug. 28.',[['Éjszakai kör','Éjszakai · hiányos','moon','hiányos feldolgozás · 1 megfigyelés','ejsz'],['Esti kiadás','Kiadás','scroll','3 poszt','kiadas']]],['Szo','aug. 29.',[['Éjszakai kör','Éjszakai','moon','jelek korábban feldolgozva','csendes']]],['Ma','aug. 30.',[['Éjszakai kör','Éjszakai','moon','3 megfigyelés · 2 szakértő hívva','ejsz']]]];
function futasok(){const W=['aug. 24. – aug. 30.','aug. 17. – aug. 23.','aug. 10. – aug. 16.','aug. 3. – aug. 9.','júl. 27. – aug. 2.'];
  return P(`${bk('Gépterem','gepterem')}${hd('Gépterem · a pipeline futásai, hetekre bontva','Futások')}
  <div class="sec rise" style="padding-top:0"><button class="lk" data-toast="Előző hét">‹ előző</button><button class="lk" data-m="wk">${W[0]} · legutóbbi futások ⌄</button><span class="eb" style="color:var(--hair)">következő ›</span></div>
  ${ST.wk?`<section class="open rise" style="padding-top:4px;padding-bottom:4px">${W.map((w,i)=>`<div class="ln tap" data-m="wk"><span class="g" ${i?'style="color:var(--sub)"':''}>${w}</span>${i?'':'<span class="v">ez</span>'}</div>`).join('')}</section>`:''}
  ${RUNDAYS.map(([dow,dt,rows],di)=>`<section class="open rise" style="--i:${Math.min(di+1,8)};padding-top:10px;padding-bottom:6px"><span class="eb">${dow} · ${dt}</span>${rows?rows.map(([k,b,i,s,to])=>`<div class="ln tap" data-go="futas.${to}">${ic(i)}<span class="g"><span class="tst">${b}</span>${k}<small>${s}</small></span>${chev}</div>`).join(''):fn('nincs adat erről az éjszakáról')}</section>`).join('')}
  <section class="open rise"><span class="eb">Ritkább futások</span>${row({ic:'calendar',b:'Havi mélyolvasás',sm:'aug. 1. · 23 állítás újramérlegelve',go:'futas.havi'})}${row({ic:'sprout',b:'Bootstrap',sm:'júl. 15. · 9 kezdő állítás',go:'futas.havi'})}</section>`,'csapat')}
function futas(id){
  const ai=row({ic:'journal',b:'Ehhez a futáshoz tartozó nyers hívások az AI-naplóban',go:'toast:AI-napló — admin felület'});
  const experts=(ids,l)=>`<div class="wrap" style="margin-top:8px">${ids.map(i=>`<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--sub)">${SIB(i,20)}${nm(i)} · ${l}</span>`).join('')}</div>`;
  const flow=cells=>`<div class="bigs">${cells.map(([n,l])=>`<div><span class="num">${n}</span><span class="eb">${l}</span></div>`).join('<span class="eb" style="align-self:center">→</span>')}</div>`;
  if(id==='nincs')return P(`${bk('Futások','futasok')}${hd('Futás','Futás')}<section class="open first rise">${fn('Ez a futás nem található.')}</section>`,'csapat');
  if(id==='csendes')return P(`${bk('Futások','futasok')}${hd('Futás · aug. 25. · csendes nap','Éjszakai kör')}<section class="open first rise" style="padding-top:0"><p class="txt sub">Csendes éjszaka — egyetlen jel sem tüzelt, senkit sem hívtunk.</p>${flow([['0','detektor tüzelt'],['0','hívás'],['0','megfigyelés']])}
    <p class="txt" style="margin-top:12px">Nulla LLM-hívás, nulla token, nulla költség. Ez nem hiányos futás — ez a rendszer pontosan azt csinálta, amit kell: nem talált ki jelet, ahol nem volt.</p></section>
    <section class="open rise"><span class="eb">Hívott szakértők</span><p class="txt sub">A többi szakértő ma nem kapott hívást — az ő jeleik a heti konzíliumon érkeznek.</p>${ai}</section>`,'csapat');
  if(id==='heti'||id==='havi'||id==='kiadas'){const W={heti:['Futás · aug. 24.','Konzílium','A hét 6 megfigyelését dolgoztuk fel a konzíliumon.',[['6','megfigyelés']],['szunya','deru','falat','mocor','szk'],'javaslat / döntés'],havi:['Futás · aug. 1.','Havi mélyolvasás','Havonta egyszer az egész eddigi képet újranézzük — ezúttal 23 állítást mérlegeltünk újra.',[['23','állítás újramérlegelve']],['mezo','szk'],'áttekintés'],kiadas:['Futás · aug. 28.','Esti kiadás','A mai esti kiadásba 3 poszt került.',[['3','poszt']],['falat','deru'],'poszt']}[id];
    return P(`${bk('Futások','futasok')}${hd(W[0],W[1])}<section class="open first rise" style="padding-top:0"><p class="txt sub">${W[2]}</p>${flow(W[3])}</section>
    <section class="open rise"><span class="eb">${id==='kiadas'?'Posztoló karakterek':'Hívott szakértők'}</span>${experts(W[4],W[5])}${id==='heti'?`<div class="act"><button class="btn sm" data-go="konzilium">Teljes transzkript megnyitása ›</button></div>`:''}${ai}</section>`,'csapat')}
  const S=[['checkin-gap','2 egymást követő napon elmaradt a délutáni check-in','mocor','A kihagyások ritkák nálad — ezen a héten kétszer maradt el a délutáni check-in, érdemes visszaállni a ritmusba.'],['rir-calibration','Szettpárokon: a mondott RIR 1-en belül megjósolta a következő szettet','mocor','A tegnapi teremedzésen minden RIR-cél 1-en belül teljesült — a becsléseidre lehet építeni.'],['sleep-performance-chain','Rövid alvás után kisebb volumen a teremben','szunya','Hat óra alatti éjszaka után a volumened rendre visszaesik — ez a heti konzíliumra megy.']];
  return P(`${bk('Futások','futasok')}${hd('Futás · aug. 30.','Éjszakai kör')}<section class="open first rise" style="padding-top:0"><p class="txt sub">Átnéztük a szombati napodat — 3 detektor tüzelt, ebből 3 megfigyelés készült (Mocor, Szunya).</p>${flow([['3','detektor tüzelt'],['2','hívás'],['3','megfigyelés']])}</section>
  <section class="open rise"><div class="sec" style="padding:0 0 4px"><span class="eb">A jellánc</span><span class="eb">egy sor = egy megfigyelés</span></div>
    ${S.map(([k,code,id2,t],i)=>`<div class="ln" style="align-items:flex-start">${SIB(id2,26)}<span class="g"><span class="tst">${i+1} · ${k}</span><br><span style="color:var(--sub)">${code}</span><small style="color:var(--ink);margin-top:4px">${nm(id2)}: ${t}</small></span></div>`).join('')}</section>
  <section class="open rise"><span class="eb">Hívott szakértők</span>${experts(['mocor','szunya'],'megfigyelés')}<p class="txt sub" style="margin-top:8px">A többi szakértő ma nem kapott hívást — az ő jeleik a heti konzíliumon érkeznek.</p>${ai}</section>`,'csapat');
}
const READS=[['Éjszakai kör','14 nap'],['Vasárnapi konzílium','1 hét'],['Havi mélyolvasás','30 nap'],['Bootstrap','60 összegző · 60 minta · 40 tény · 60 review · 60 napló · 40 esemény'],['Gym szettek + feedback (RIR, target, ízület)','14 nap'],['Sport-sessionök','14 nap'],['Alvás (időtartam, minőség)','14 nap'],['Kiegészítő-stack (aktív protokoll + bevitelek)','8 hét · aktív protokoll'],['Étkezés-napok, makró-célok','14 nap'],['Check-in skálák','14 nap']];
function adatforrasok(){return P(`${bk('Gépterem','gepterem')}${hd('Gépterem · mit olvas a rendszer ma, és mit tervez','Adatforrások')}
  ${seg([['be','Bekötve'],['terv','Tervezett']],ST.src,'src')}
  <section class="open first rise" style="padding-top:0">${ST.src==='be'?READS.map(([w,c])=>`<div class="ln">${ic('tick')}<span class="g">${w}<small>${c}</small></span></div>`).join('')+fn('+ még 19 bekötött forrás (étkezés, víz, gyógyszerciklus, napló, emberek, chat…)'):`<div class="ln">${ic('tick')}<span class="g">Mind a négy kör bekötve.</span></div>${fn('+ még 4 terület később')}`}</section>`,'csapat')}
function kor(){return P(`${bk('Adatforrások','adatforrasok')}${hd('Adatforrások','Egy kör')}<section class="open first rise">${fn('Ez a kör nem található. Ma ez az egyetlen élő állapota: mind a négy kör bekötve, ide nem vezet link.')}</section>`,'csapat')}
const DET=[['logging-gap','mocor','N napja nincs étkezés logolva (2+ egymást követő nap, 14 napos honest cap) — hiányzó kaja-napló jelzés.'],['rir-calibration','mocor','Szettpárokon nézi: a mondott RIR megjósolja-e a következő szettet — az irányt is jelzi.'],['sleep-performance-chain','szunya','Rossz alvás utáni napokon visszaesik-e az edzés-teljesítmény.'],['weekend-protein-dip','falat','Hétvégén a fehérje rendszeresen a cél alá esik-e.'],['weight-trend-break','deru','A 7 napos súlytrend iránya megfordult-e.'],['mood-journal-tone','deru','A napló hangneme 3 napja tartósan lefelé tart-e.'],['life-event-shift','mezo','Egy új életesemény óta eltolódott-e a napi ritmus.'],['knowledge-rejection-pattern','szk','A javasolt tények és minták mekkora része maradt meg — a rendszer találati aránya, nem a te tulajdonságod. ÉRZÉKENY.']];
function detektorok(){return P(`${bk('Gépterem','gepterem')}${hd('Gépterem · a ma aktív katalógus, egy mondatban','Detektorok')}
  <section class="open first rise" style="padding-top:0">${DET.map(([k,id,t])=>`<div class="ln">${SIB(id,24)}<span class="g">${t}<small class="mono">${k} · ${nm(id)}</small></span></div>`).join('')}${fn('+ még 39 detektor ugyanígy, egy mondatban (47 aktív). A kód csak észlel — az értelmezés mindig az adott szakértő LLM-hívása. Egy detektor sosem ítél, csak jelez.')}</section>`,'csapat')}

/* ═════════ MEMÓRIA ═════════ */
const DAYS=[['2026-08-12','12','aug','Erős pull-nap volt: a Chest Supported Row 3×8-ra ment, és délután is maradt energia. Este korán feküdtél, 7 óra 40 perc lett belőle, a reggeli pulzus is lejjebb ment.'],['2026-08-11','11','aug','Pihenőnap, sok séta. Ebédnél kimaradt a fehérje, este pótoltad. A napló szerint feszült voltál a munka miatt, de a lefekvés így is 23:00 előtt volt.'],['2026-08-10','10','aug','Röpi este, három szett, a harmadikban elfogyott a lendület. Utána későn vacsoráztál, az alvás felszínes lett.']];
const SIM=[['2026-08-09',88,'Rossz alvás a késő esti edzés után; másnap nehezebben indult a nap.'],['2026-07-28',79,'Rövid éjszaka röpi után, reggel fáradtság, délutánra rendbe jött.'],['2026-07-14',71,'Hosszú edzés, késői vacsora, két ébredés.']];
const search=()=>`<div class="ln tap" data-m="srch">${ic('lens')}<span class="g ${ST.srch==='on'?'':''}" style="${ST.srch==='on'?'':'color:var(--faint)'}">${ST.srch==='on'?'rossz alvás edzés után':'Milyen napot keresel? (pl. rossz alvás edzés után)'}</span><span class="lk">Keresés</span></div>`+
  (ST.srch==='on'?`<span class="eb" style="margin-top:10px">3 hasonló nap a memóriából</span>${SIM.map(s=>`<div class="ln tap" data-go="emlek"><span class="g">${s[0]}<small>${s[2]}</small></span><span class="v"><b>${s[1]}</b>%</span>${chev}</div>`).join('')}`:'');
function memoria(){const tab=ST.mem;let body='';
  const layer=(i,eb,t,n,u,chips,go)=>`<div class="ln ${go?'tap':''}" ${G(go)}>${ic(i)}<span class="g"><span class="tst">${eb}</span><br>${t}${chips?`<small>${chips.join(' · ')}</small>`:''}</span><span class="v"><b>${n}</b> ${u}</span>${go?chev:''}</div>`;
  const flow=t=>`<p class="fn" style="margin:2px 0 2px 38px">↓ ${t}</p>`;
  if(tab==='retegek')body=`<section class="open first rise" style="padding-top:0">${layer('signal','L0 · nyers adat','Minden, amit rögzítesz','47','/60 nap')}${flow('napi összefoglaló · minden nap 02:20')}${layer('journal','L1 · epizodikus napló','Napi emlékek','38','nap',['112 chat-vektor','2026-07-01 – 2026-08-12'],'toast:Napló fül')}${flow('mintakeresés · hetente')}${layer('pattern','L2 · ítélet-inbox','Minták, amikről te döntesz','6','minta',['3 statisztikai · megerősített','2 függő tényjelölt'],'rolad')}${flow('megerősítés után')}${layer('brain','L3 · tartós tudás','Amit biztosan tudok rólad','15','tény',['168× megerősítés','14 a promptban'],'tudastar')}
    ${row({ic:'lens',b:'Miért nem lát még mintát a motor?',sm:'a minták oldalán',go:'mintak'})}</section>`;
  if(tab==='naplo')body=`<section class="open first rise" style="padding-top:0"><div class="sec" style="padding:0 0 4px"><span class="eb">augusztus 2026</span><span class="eb">38 nap</span></div>${DAYS.map((d,i)=>`<div class="ln" style="align-items:flex-start"><time>${d[1]} ${d[2]}</time><span class="g">${['augusztus 12., kedd','augusztus 11., hétfő','augusztus 10., vasárnap'][i]}<small>${d[3]}</small><small class="mono">${i===2?'még nincs vektor':'kereshető'}</small></span></div>`).join('')}</section>`;
  if(tab==='kereso')body=`<section class="open first rise" style="padding-top:0">${search()}</section>`;
  if(tab==='audit')body=`<section class="open first rise" style="padding-top:0"><span class="eb">LLM-használat · 30 nap</span>${big('$0,042','ennyibe került az emlékezet')}
    <div class="wk" style="height:60px;margin-top:10px">${[40,62,35,80,55,48,90,30,66,72,44,58,38,84].slice(0,7).map(h=>`<span class="d met" style="--h:${h}%"><i style="--f:1"></i></span>`).join('')}</div>
    <div class="ln"><span class="g">214 hívás</span><span class="v">bemenet <b>41,2k</b> · kimenet <b>9,8k</b></span></div>${row({ic:'brain',b:'Tudástár',sm:'tények és eredetük',go:'tudastar'})}</section>`;
  return P(`${bk('Gépterem','gepterem')}${hd('Memória','47 / 60 mért nap')}<section class="open first rise" style="padding-top:0;padding-bottom:4px">${big('47','/ 60 nap van a minta-ablakban')}</section>
  ${seg([['retegek','Rétegek'],['naplo','Napló'],['kereso','Kereső'],['audit','Audit']],tab,'mem')}${body}`,'csapat');
}

/* ═════════ MINTÁK · mélyoldalak (PatternDetailPage) ═════════ */
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
const decTrio=key=>`<div class="act"><button class="btn sm" data-m="pdec:${key}:megerositve">${ic('tick')}Megerősítem</button><button class="lk" data-m="pdec:${key}:figyeljuk">Figyeljük</button><button class="lk" data-m="pdec:${key}:elvetve">Elvetem</button></div>${fn('<b>Megerősítem</b> — beépül a rólad szóló képbe · <b>Figyeljük</b> — tovább számolom, de nem tanulok belőle · <b>Elvetem</b> — befagy, többé nem hozom elő.')}`;
const evlog=rows=>rows.length?`<div class="tl">${rows.map(([s,l,x,you])=>`<div class="ln ${you?'you':''}"><time>${s}<br><span class="mono" style="color:var(--faint)">${l}</span></time><span class="g">${x}</span></div>`).join('')}</div>`:fn('Még nincs bejegyzés — az első bizonyíték-éjszaka tölti fel.');
const daysCard=m=>{const d=m.days,n=d.length,n0=d.filter(x=>x[1]<.5).length;return `${n<2?fn('Még nincs elég nap az összevetéshez — ahogy gyűlnek, itt jelennek meg.'):(m.binary?scbin(m):scat(m))+fn('Minden pont egy nap, a kiemelt a legutóbbi. A hangsúlyos vonal a trend (a főcím); a pontok a textúra.')}
  ${n?fold('dlist','Napok listája · '+n,isOpen('dlist'),d.map((x,i)=>`<div class="ln"><time>${x[0]}</time><span class="g">${m.A.l.toLowerCase()}: ${m.binary?(x[1]?'igen':'nem'):m.fx(x[1])}</span><span class="v">${m.B.l.toLowerCase()} <b>${m.fy(x[2])}</b></span></div>`).join('')):''}`};
const diagF=o=>fold('diag','Hogyan számoltuk? · ablak, források, technikai adatok',isOpen('diag'),`<div class="dgrid">${[['Adatablak',o.win+' nap'],['Párosított nap',o.n],['Csoportarány',o.grp],['Utolsó számítás',o.last]].map(([l,v])=>`<div><span class="eb">${l}</span><strong>${v}</strong></div>`).join('')}</div>
  <p class="txt sub" style="margin-top:8px">${o.sa} · ${o.sb} · ${o.lag?o.lag+' nappal később':'azonos nap'}</p><p class="fn mono">korreláció ${o.r} · közös nap ${o.n} · p-érték ${o.p}${o.frozen?' · a számok a döntésed pillanatában befagytak':''}</p>`);
function mintaLab(key,m,over){
  const OV={megerositve:'confirmed',figyeljuk:'monitoring',elvetve:'rejected'};const s=OV[over]||m.st;const n=m.days.length,enough=n>=m.minN,[pl,pk]=s==='proposed'&&enough?['Dönthetsz','warn']:PILL[s];
  const n0=m.days.filter(d=>d[1]<.5).length,n1=n-n0,decidable=s!=='confirmed'&&s!=='rejected';
  const log=[...m.log];if(OV[over]){log.push(['Szept. 24. · 09:12','döntés',{confirmed:'<b>Megerősítetted.</b>',monitoring:'Megfigyelésre tetted.',rejected:'Elvetetted — befagyasztva.'}[s]]);if(s==='confirmed')log.push(['Szept. 24. · 09:12','tudás','Bekerült a tudástárba.'])}
  const sub=(m.binary?`<b>${n1}</b> ilyen napot tudok összevetni <b>${n0}</b> másikkal`:`<b>${n}</b> napot tudok összevetni`)+(enough?' — elég ahhoz, hogy dönts.':`. <b>${m.minN}</b> napnál mondok többet.`);
  return P(`${bk('Minták','mintak')}
  <section class="card hg rise" style="--i:1"><div class="sec" style="padding:0 0 6px"><span class="eb">${m.cat} · minta részletei</span>${st(pl,pk)}</div><h2 class="t">${m.title}</h2><p class="txt sub">Hipotézis: ${m.q}?</p>
    <div class="hero-r" style="margin-top:8px"><div>${big(n<=m.minN?`${n}<small>/${m.minN}</small>`:n,'nap')}</div><div class="g"><p class="verdict">${labAnswer(s,m.minN,n,m.hits,m.miss)}</p><p class="txt sub">${sub}</p></div></div>
    ${m.belief!=null?`<div class="conf"><span>bizonyosság</span>${barq(m.belief)}<b style="color:var(--ink)">${m.belief}%</b></div>${fn('A bizonyosságot a <b>számítás</b> és a <b>te válaszaid</b> mozgatják. Mezo csak megfogalmazza. Te bármikor felülírhatod.')}`:''}
    ${decidable?decTrio(key):''}</section>
  <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">A teszt-terv</span><span class="eb">előre rögzítve</span></div>
    <div class="ln">${ic(DOMI[m.A.d])}<span class="g"><span class="tst">Ha…</span><br>${m.A.l}<small>${KINDL[m.A.k]}</small></span></div><div class="ln">${ic(DOMI[m.B.d])}<span class="g"><span class="tst">…akkor</span><br>${m.B.l}<small>${KINDL[m.B.k]}</small></span></div>
    ${bigs([['+'+m.lag,'nap eltolás'],[m.minN,'nap kell min.'],[m.dir==='positive'?'több':'kevesebb','várt irány'],[m.win,'nap ablak']])}</section>
  <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 0"><span class="eb">Az eddigi napok</span><span class="eb">pont = egy nap</span></div>${daysCard(m)}</section>
  <section class="open rise" style="--i:4"><div class="sec" style="padding:0 0 4px"><span class="eb">Bizonyíték-napló</span><span class="eb">minden, ami történt</span></div>${evlog(log)}</section>
  <section class="open rise" style="--i:5;padding-top:0">${diagF({win:m.win,n,grp:m.binary?`${n0} : ${n1}`:'nem csoportos',last:m.last,sa:m.A.src,sb:m.B.src,lag:m.lag,r:m.r,p:m.p,frozen:false})}</section>`,'fal');
}
function mintaKat(){const m={binary:true,g:['Hétköznap','Hétvége'],A:{l:'Hétvége'},B:{l:'Lefekvés ideje'},fy:clock,ya:[22.5,24.5,[22.5,23,23.5,24,24.5]],days:HET};
  const wd=HET.filter(d=>!d[1]).map(d=>d[2]),we=HET.filter(d=>d[1]).map(d=>d[2]);
  const S=[31,38,44,47,52,55],sx=i=>14+i*(272/5),sy=v=>50-(v-25)/35*38,path=S.map((v,i)=>`${i?'L':'M'}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');
  return P(`${bk('Minták','mintak')}
  <section class="card hg rise" style="--i:1"><div class="sec" style="padding:0 0 6px"><span class="eb">Alvás · minta részletei</span>${st('Megerősítve')}</div><h2 class="t">Hétvége ↔ lefekvés ideje</h2><p class="txt sub">Amit vizsgálunk: Hétvégén később fekszel le?</p>
    <div class="hero-r" style="margin-top:8px"><div>${big(HET.length,'közös nap')}</div><div class="g"><p class="verdict">Ezt a kapcsolatot már megerősítetted.</p><p class="txt sub">Az eddigi adatok szerint hétvégén <b>kb. 40 perccel</b> később fekszel le. Közepes bizonyosság — ${HET.length} napból.</p></div></div></section>
  <section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">Az összevetés alapja</span><span class="eb">éles adatok</span></div>
    ${[['Hétköznap',wd],['Hétvége',we]].map(([l,a])=>`<div class="ln"><span class="g">${l}<small>${clock(Math.min(...a))}–${clock(Math.max(...a))} között</small></span><span class="v">${a.length} nap · középső <b>${clock(median(a))}</b></span></div>`).join('')}</section>
  <section class="open rise" style="--i:3"><span class="eb">Hogyan változott a kapcsolat?</span><svg class="kst cur" viewBox="0 0 300 56" aria-hidden="true" style="--c:var(--acc)"><path class="s" d="${path}"/>${S.map((v,i)=>`<circle class="${i===5?'big':''}" cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="${i===5?4:2.2}"/>`).join('')}</svg>${fn('Az első számítás óta erősödött: 12 közös napból indult, ma '+HET.length+' napon áll.')}</section>
  <section class="open rise" style="--i:4"><div class="sec" style="padding:0"><span class="eb">Az eddigi napok</span><span class="eb">pont = egy nap</span></div>${daysCard(m)}</section>
  <section class="open rise" style="--i:5"><span class="eb">Mit vigyél magaddal?</span>${row({ic:'info',b:'Mit jelent ez?',sm:'A grafikon a most összevethető napokat mutatja. Az irányt mindig a fenti lelet mondja ki.'})}${row({ic:'repeat',b:'Mi történik ezután?',sm:'Az új közös napokkal a motor újraszámolja a kapcsolatot és jelzi, ha érdemben változik.'})}</section>
  <section class="open rise" style="--i:6"><span class="eb">Mit kezd ezzel az app</span>${row({ic:'note',b:'Tudástár-tény',sm:'×2 megerősítve · benne van a társ promptjában',go:'tenyek'})}${row({ic:'orb',b:'1 előrejelzés',sm:'1 bejött · 0 még fut',go:'elore.lefekves'})}</section>
  <section class="open rise" style="--i:7;padding-top:0">${fold('hist','A minta története · 3 jelentős esemény',isOpen('hist'),evlog([['Aug. 29.','','Először számolhatóvá vált — 12 közös nap.'],['Szept. 10.','','Erősödött a kapcsolat.'],['Szept. 20.','','<b>Megerősítetted.</b> Létrejött a tudás-tény a Tudástárban.']]))}${diagF({win:60,n:HET.length,grp:`${wd.length} : ${we.length}`,last:'ma 03:10',sa:'Naptár',sb:'Alvás-napló',lag:0,r:'0,55',p:'0,004',frozen:true})}</section>`,'fal');
}
function mintaMentett(over){const t={megerositve:['Megerősítve','A társ figyelembe veszi ezt a mintát a beszélgetésekben és a későbbi előrejelzéseknél.'],figyeljuk:['Megfigyelés alatt','Ezt a mintát tovább figyeljük. Még nem épül be tartós tudásként a társ válaszaiba.'],elvetve:['Elvetve','Ezt a mintát nem használjuk a társ válaszaiban, és nem kérünk róla újabb döntést.']}[over];
  return P(`${bk('Minták','mintak')}
  <section class="card hg rise" style="--i:1"><div class="sec" style="padding:0 0 6px"><span class="eb">Táplálkozás · mentett minta</span>${st(t?t[0]:'Bizonyosság 69%')}</div><h2 class="t">Édes nasi a rövid éjszakák után?</h2>
    ${t?`<p class="txt">${t[1]}</p>`:`<span class="eb" style="margin-top:8px">Amit eddig látunk</span><p class="txt">A 6 óránál rövidebb éjszakák utáni délutánokon gyakrabban kerül édesség a naplódba.</p>${decTrio('mentett')}`}</section>
  <section class="open rise" style="--i:2"><span class="eb">Mit figyelt meg az app?</span><div class="ln">${ic('tick')}<span class="g">Szept. 9., 15. és 19.: rövid éjszaka után délutáni édesség</span></div><div class="ln">${ic('tick')}<span class="g">Hosszabb éjszakák után ez ritkább volt</span></div>
  ${fn('Ez egy mentett felismerés. Nincs hozzá külön motor-pár és napgrafikon, ezért itt csak azt mutatjuk, amit a minta ténylegesen tartalmaz.')}</section>`,'fal')}
function minta(arg){const [id,over]=(arg||'viz').split('.');
  if(id==='hetvege')return mintaKat();if(id==='mentett')return mintaMentett(over);
  if(id==='nincs')return P(`${bk('Minták','mintak')}<section class="open first rise">${fn('<b style="color:var(--ink)">Nincs ilyen minta.</b> A link egy már nem létező mintára mutat.')}<div class="ln"><span class="g">Nem sikerült betölteni a mintát.</span><button class="lk" data-toast="Újrapróbálom">Újra</button></div><div class="ln">${ic('clock')}<span class="g" style="color:var(--faint)">A minta betöltése…</span></div></section>`,'fal');
  return mintaLab(MINTA[id]?id:'viz',MINTA[id]||MINTA.viz,over)}

/* ═════════ ELŐREJELZÉS · KÍSÉRLET mélyoldalak ═════════ */
const ELORE={'meccs-energia':{title:'Holnap reggel 7 fölött lesz az energiád',date:'szept. 25. · csütörtök',st:'pending',conf:.64,basis:'Az utolsó 6 meccs utáni reggelen ötször 7 fölött jelentkeztél, ha előtte 23:30 előtt lefeküdtél — tegnap 23:05-kor feküdtél le.'},
  lefekves:{title:'Ezen a hétvégén is fél órával később fekszel, mint hét közben',date:'szept. 21. · vasárnap',st:'validated',conf:.71,basis:'A hétvége ↔ lefekvés minta: 26 napból hétvégén kb. 40 perccel később feküdtél le.',actual:'szombaton 23:50, vasárnap 23:35 — hét közben a középső időpont 23:05.'},
  'alvas-edzes':{title:'A jó éjszaka után könnyebbnek érzed az edzést',date:'szept. 21. · vasárnap',st:'missed',conf:null,basis:'Két jó éjszaka utáni edzésen 7 alatti erőfeszítés-érzetet jelentettél.',actual:'7,5 és 8 közötti erőfeszítés-érzet, a jó éjszakák után is.'}};
const PST={pending:['Folyamatban','plan'],validated:['Bevált','q'],missed:['Nem jött be','q']};
function elore(id){const p=ELORE[id]||ELORE['meccs-energia'],[sl,sk]=PST[p.st],conf=p.conf==null?null:Math.round(p.conf*100),res=p.st!=='pending';const f=ST.fb['e'+id],rsn=ST.rsn['e'+id];
  const happened=p.actual?`${p.st==='validated'?'Bejött':'Megfigyelt eredmény'}: ${p.actual}`:'Az eredmény még nem ismert. A megfigyelési időszak adatai alapján értékeljük.';
  return P(`${bk('Előrejelzések','elorejelzesek')}
  <section class="card hg rise" style="--i:1"><div class="sec" style="padding:0 0 6px"><span class="eb">${p.date} · előrejelzés</span>${st(sl,sk)}</div><h2 class="t">${p.title}</h2>
    ${res?vs(p.title+'.',p.actual)+`<p class="txt" style="margin-top:10px">${p.st==='validated'?'Bejött — ez a jel erősödik a következő becsléseknél.':'Nem jött be — ez is számít: ebből a jelből ezután óvatosabban következtetek.'}</p>`
    :`<div class="hero-r" style="margin-top:8px"><div>${big(conf==null?'?':conf+'<small>%</small>','becsült megbízhatóság')}</div><div class="g"><p class="verdict">Mennyire biztos benne a csapat?</p><p class="txt sub">${conf==null?'Még tanulom — ehhez az előrejelzéshez nincs megbízhatósági becslés.':`<b>${conf}%</b> becsült megbízhatóság.`}</p></div></div>`}</section>
  ${res?`<section class="open rise" style="--i:2"><span class="eb">Mennyire biztos benne a csapat?</span>${conf==null?fn('Még tanulom — ehhez az előrejelzéshez nincs megbízhatósági becslés.'):`<div class="conf">${barq(conf)}<b style="color:var(--ink)">${conf}%</b><span>becsült megbízhatóság</span></div>`}</section>`:''}
  <section class="open rise" style="--i:3"><span class="eb">Miből következik?</span><p class="txt">${p.basis}</p></section>
  ${res?'':`<section class="open rise" style="--i:4"><span class="eb">Mi történt?</span><p class="txt sub">${happened}</p></section>`}
  <section class="open rise" style="--i:5"><span class="eb">Hasznos volt?</span><div class="act"><button class="lk" data-m="fbv:e${id}:up" aria-pressed="${f==='up'}">Segített</button><button class="lk" data-m="fbv:e${id}:down" aria-pressed="${f==='down'}">Nem talált</button></div>
    ${f==='down'?`<div class="act" style="margin-top:8px">${['pontatlan','túl sok','rossz időzítés','nem rólam szól'].map(r=>`<button class="lk" data-m="rsn:e${id}:${r}" aria-pressed="${rsn===r}">${r}</button>`).join('')}</div>`:''}</section>`,'fal');
}
const KIS={szenhidrat:{title:'Meccs előtti szénhidrát',st:'active',day:4,total:7,hyp:'Ha meccsnapon 17 óráig bekerül 80 g szénhidrát, a 4. szettben is stabil marad az ugrásod.'},korai:{title:'Korai vacsora-hét',st:'proposed',day:0,total:7,hyp:'Ha egy hétig 19 óra előtt vacsorázol, korábban alszol el, és jobb az alvásminőséged.'},kave:{title:'Délutáni kávé nélkül',st:'completed',good:true,day:10,total:10,hyp:'Ha 16 óra után nem iszol kávét, nyugodtabb az éjszakád.',outcome:'10 éjszakából 8-on jobb volt az alvásod: átlag <b>7,4 pont</b> a korábbi 6,6 helyett.'}};
const xchip=x=>x.st==='proposed'?['Javaslat','q']:x.st==='active'?['Aktív','plan']:x.st==='dismissed'?['Elvetve','q']:x.good===true?['Megerősítve','q']:x.good===false?['Nem igazolódott','q']:['Nem értékelhető','q'];
function kiserletOldal(arg){const [id0,over0]=(arg||'szenhidrat').split('.');const key=KIS[id0]?id0:'szenhidrat',over=ST.xdec[key]||over0;const x={...KIS[key],...(over==='aktiv'?{st:'active',day:0}:over==='elvetve'?{st:'dismissed'}:{})};
  const [cl,ck]=xchip(x),pct=x.total?Math.min(100,Math.round(x.day/x.total*100)):0,outcome=x.outcome||(x.st==='dismissed'?'Ezt a javaslatot elvetetted; nem indult belőle kísérlet.':x.st==='completed'?'A kísérlet lezárult, de nincs szöveges eredmény.':'Még nincs lezárt eredmény.');
  let body;
  if(x.st==='active')body=`<div class="hero-r" style="margin-top:8px"><div>${big(`${x.day}<small>/${x.total}</small>`,'nap')}</div><div class="g"><p class="verdict">Hol tartunk?</p><p class="txt sub">Az eltelt napokat látod. Az eredmény a lezárt megfigyelés után jelenik meg.</p></div></div>${dcell(Array.from({length:x.total},(_,d)=>[(d+1)+'.',d<x.day?'el':d===x.day?'now':'']))}`;
  else if(x.st==='proposed')body=`<span class="eb" style="margin-top:8px">Mit vizsgálunk?</span><p class="txt">${x.hyp}</p><div class="act"><button class="btn sm" data-m="xdec:${key}:aktiv">${ic('tick')}Elfogadom</button><button class="lk" data-m="xdec:${key}:elvetve">Elvetem</button></div>`;
  else body=`<span class="eb" style="margin-top:8px">Eredmény</span><p class="txt">${outcome}</p>`;
  return P(`${bk('Kísérletek','kiserletek')}
  <section class="card hg rise" style="--i:1"><div class="sec" style="padding:0 0 6px"><span class="eb">${x.total} napos saját megfigyelés · kísérlet</span>${st(cl,ck)}</div><h2 class="t">${x.title}</h2>${body}</section>
  ${x.st!=='proposed'?`<section class="open rise" style="--i:2"><span class="eb">Mit vizsgálunk?</span><p class="txt">${x.hyp}</p></section>`:''}
  ${x.st==='active'||x.st==='proposed'?`<section class="open rise" style="--i:3"><span class="eb">Eredmény</span><p class="txt sub">${outcome}</p></section>`:''}`,'fal');
}

/* ═════════ LISTÁK: Minták · Előrejelzések · Kísérletek ═════════ */
const BK=[['decide','döntésre vár',2,'warn'],['monitoring','megfigyelés',4,''],['confirmed','megerősítve',6,''],['gathering','még gyűlik',5,''],['noRel','nincs kapcsolat',3,''],['rejected','elvetve',1,'']];
function bucket(){const b=ST.bucket;
  const trio=(k)=>`<div class="act"><button class="${k?'btn sm':'lk'}" data-m="mack:confirm">${k?ic('tick'):''}Megerősítem</button><button class="lk" data-m="mack:monitor">Figyeljük</button><button class="lk" data-m="mack:reject">Elvetem</button></div>`;
  if(b==='decide')return `<section class="card hg rise" style="--i:2;--c:var(--warn)"><div class="sec" style="padding:0 0 6px"><span class="eb">Döntésre vár · megbízható jel</span>${st('34 közös nap')}</div><h2 class="t">Több energiád van, ha többet iszol?</h2>
    <p class="txt">Erős jel: a többet ivós napokon <b>határozottan</b> jobb a délutáni energiád. 34 nap alapján, a véletlen kizárható.</p>${kst([[60,46,'vízbevitel','big'],[240,46,'délutáni energia','big'],[150,20,'edzésnap','up']],[[0,1,'s'],[2,0,'d']])}
    ${fn('<b>Megerősítem</b> — tartós tudás lesz. <b>Figyeljük még</b> — marad a listán, de nem tanulok belőle. <b>Elvetem</b> — befagy, többé nem hozom elő.')}${trio(1)}<button class="lk src" data-go="minta.viz">Részletek és előzmények ›</button></section>
    <section class="open rise" style="--i:3"><span class="eb">Ígéretes jel · 14 közös nap</span><p class="txt" style="margin-top:6px"><b>Rosszabbul alszol, ha későn vacsorázol?</b></p><p class="txt sub">Késői étkezés ↔ rákövetkező alvásminőség</p>${trio(0)}<button class="lk src" data-go="minta.vacsora">Részletek ›</button></section>`;
  if(b==='confirmed')return `<section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">Megerősítve — él a tudásban</span><span class="eb">6</span></div>${[['moon','Magas sportterhelés → mélyebb alvás','12 közös nap'],['plate','Késői étkezés → felszínes alvás','14 közös nap'],['water','Vízbevitel → délutáni energia','8 közös nap'],['journal','Hála-napló → nyugodtabb nap','11 közös nap']].map(t=>row({ic:t[0],b:t[1],sm:t[2],go:'minta.viz.megerositve'})).join('')}${fn('Ez a 6 összefüggés benne van a társ fejében minden beszélgetésnél, és ebből épülnek az előrejelzések.')}</section>`;
  if(b==='monitoring')return `<section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">Megfigyelés alatt</span><span class="eb">4</span></div>${[['moon','Vacsora ideje ↔ alvásminőség','Ígéretes jel, de még nem elég biztos.',70],['journal','Anna a hála-naplóban → többet alszol','4 találat, 1 kihagyás.',38],['person','Súly ↔ vízbevitel','Gyenge, még ingadozó.',45],['dumbbell','Push nap ↔ vállérzékenység','Tartja magát.',60]].map(t=>`<div class="ln tap" data-go="minta.vacsora">${ic(t[0])}<span class="g">${t[1]}<small>${t[2]}</small></span>${barq(t[3])}${chev}</div>`).join('')}</section>`;
  if(b==='gathering')return `<section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">Még gyűlik az adat</span><span class="eb">5</span></div>${[['dumbbell','Egyforma terhelés ↔ reggeli energia','5 / 8 nap'],['plate','Hétvége ↔ késői étkezés','+2 hétvégi nap kell'],['water','Vízbevitel ↔ energia-szint','Pihen — várom az adatot']].map(t=>row({ic:t[0],b:t[1],sm:t[2],go:'minta.egyhangu'})).join('')}${fn('Ezek nem hibák — csak nincs elég közös nap. Amit logolsz, az hozza őket életre.')}</section>`;
  return `<section class="open rise" style="--i:2"><div class="sec" style="padding:0 0 4px"><span class="eb">${b==='rejected'?'Elvetve':'Megnéztük — nincs összefüggés'}</span><span class="eb">${b==='rejected'?'1':'3'}</span></div>${[['plate','Koffein ↔ edzés-RPE','Nincs kapcsolat a két érték között.'],['moon','Lépésszám ↔ alvásidő','Nincs kapcsolat.']].map(t=>row({ic:t[0],b:t[1],sm:t[2],go:'minta.viz.elvetve'})).join('')}${fn('Ez is eredmény: megnéztük, és nincs kapcsolat. Nem kér döntést — ha később megerősödne, feljebb lép.')}</section>`;
}
function mintak(){const ackT={confirm:'Beépítettem a tudásba — mostantól számolok vele.',monitor:'Rendben, figyeljük tovább — szólok, ha erősödik.',reject:'Elvetve — nem hozom fel újra.'};
  return P(`${hd('Mezo · a motor','Minták')}
  <section class="open first rise" style="--i:1;padding-top:0">${big('6','megerősített összefüggés él a tudásban')}<p class="txt sub" style="margin-top:8px"><b>21 kérdést</b> figyelek a naplóidból. <b>6 megerősített</b> összefüggés dolgozik a társban, <b>2 vár a döntésedre</b>. Ma 14:12 · 60 nap.</p>
    <div class="wrap" style="margin-top:10px">${BK.map(k=>`<button class="lk" style="${ST.bucket===k[0]?'color:var(--ink);text-decoration-color:var(--acc)':''}${k[3]&&ST.bucket!==k[0]?';color:var(--warn)':''}" data-m="bucket:${k[0]}" aria-pressed="${ST.bucket===k[0]}"><b>${k[2]}</b> ${k[1]}</button>`).join('')}<button class="lk" data-sheet="filter" style="margin-left:auto">Szűrés · minden téma</button></div></section>
  ${ST.ack?`<div class="p16 rise">${after(ackT[ST.ack])}</div>`:''}${bucket()}
  <div class="sec rise"><button class="lk" data-toast="Előző oldal">‹ előző</button><span class="eb">1–4 / 6</span><button class="lk" data-toast="Következő oldal">következő ›</button></div>
  <section class="open rise" style="--i:4"><span class="eb">Adat-egészség</span>${[['Hangulat',12,'7/60 · 3 napja',1],['Vízbevitel',40,'24/60 · ma',1],['Alvás',97,'58/60 · ma'],['Edzés',88,'53/60 · tegnap'],['Étkezés',93,'56/60 · ma']].map(c=>`<div class="ln"><span class="g">${c[0]}<small>${c[2]}</small></span><span class="v"><b>${c[1]}</b>%</span>${barq(c[1],c[3]?'var(--warn)':'')}</div>`).join('')}${fn('Ahol kevés a mért nap, ott a sáv borostyán: oda kell adat. Ami rendben van, az szürke.')}
  ${row({ic:'layers',b:'A motor bemenete: memória-rétegek',go:'memoria'})}</section>`,'fal');
}
const PRED=[{k:'meccs-energia',s:'pending',c:72,b:'Március óta a 102.5 stabil. Múlt heti RIR 2 + 7.5h alvás kombináció historikusan +5kg-os emelést támogatott.'},{k:'lefekves',s:'validated',a:'RPE 8.2 · vacsora 20:50'},{k:'alvas-edzes',s:'missed',a:'6 ó 20 p'}];
function elorejelzesek(){const list=PRED.filter(p=>ST.pred==='all'||(ST.pred==='pending'?p.s==='pending':p.s!=='pending'));
  return P(`${hd('Mezo · összes funkció','Előrejelzések')}
  <section class="open first rise" style="--i:1;padding-top:0">${big('68<small>%</small>','2 bevált · 60 napos pontosság')}</section>
  ${seg([['all','Mind'],['pending','Folyamatban'],['closed','Lezárt']],ST.pred,'pred')}
  ${list.length?list.map((p,i)=>{const e=ELORE[p.k],[sl,sk]=PST[p.s],f=ST.mfb['p'+i],live=p.s==='pending';
    return live?`<section class="card hg rise" style="--i:${i+2}"><div class="sec" style="padding:0 0 6px"><span class="eb">${e.date}</span>${st(sl,sk)}</div><button style="display:block;text-align:left;width:100%" data-go="elore.${p.k}"><h2 class="t">${e.title}</h2><p class="txt sub">${p.b}</p></button><div class="conf">${barq(p.c)}<b style="color:var(--ink)">${p.c}%</b></div><div class="act"><button class="lk" data-m="mfb:p${i}:up" aria-pressed="${f==='up'}">Segített</button><button class="lk" data-m="mfb:p${i}:down" aria-pressed="${f==='down'}">Nem talált</button></div></section>`
    :`<article class="po rise" style="--i:${i+2}"><div class="ln tap" style="border-top:0;padding-top:0" data-go="elore.${p.k}">${ic('orb')}<span class="g"><span class="tst">${sl} · ${e.date}</span><br>${e.title}<small>${p.s==='validated'?'Bejött: ':'Megfigyelt eredmény: '}${p.a}</small></span>${chev}</div><div class="act" style="margin-top:4px"><button class="lk" data-m="mfb:p${i}:up" aria-pressed="${f==='up'}">Segített</button><button class="lk" data-m="mfb:p${i}:down" aria-pressed="${f==='down'}">Nem talált</button></div></article>`}).join('')
  :`<section class="open rise">${fn('Ebben az állapotban még nincs előrejelzés. Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.')}</section>`}`,'fal');
}
const EXP=[{s:'aktiv',t:'Glikogén-feltöltés röpi előtt',h:'Ha röpi előtt 3 órával 80 g szénhidrátot eszel, a harmadik szettben is megmarad a robbanékonyság.',d:4,go:'kiserlet-oldal.szenhidrat'},{s:'aktiv',t:'Korábbi vacsora',h:'Ha 19:30 előtt vacsorázol, mélyebb és hosszabb az alvásod.',d:2,go:'kiserlet-oldal.korai.aktiv'},{s:'javaslat',t:'Reggeli napfény 10 perc',h:'A reggeli fény korábbra tolja az esti elalvást.',go:'kiserlet-oldal.korai'},{s:'megerosit',t:'Kreatin 5 g naponta',o:'3/4 mérés',go:'kiserlet-oldal.kave'},{s:'nemigaz',t:'Hideg zuhany edzés után',o:'a regeneráció nem változott',go:'kiserlet-oldal.kave'},{s:'nemert',t:'Esti magnézium',o:'kevés alvás-adat',go:'kiserlet-oldal.kave'},{s:'elvetve',t:'16:8-as időablak',go:'kiserlet-oldal.korai.elvetve'}];
const EXS={aktiv:'Aktív',javaslat:'Javaslat',megerosit:'Megerősítve',nemigaz:'Nem igazolódott',nemert:'Nem értékelhető',elvetve:'Elvetve'};
function kiserletek(){const f=ST.ex,pass=e=>f==='mind'||(f==='aktiv'&&e.s==='aktiv')||(f==='javaslat'&&e.s==='javaslat')||(f==='lezart'&&!['aktiv','javaslat'].includes(e.s));const list=f==='ures'?[]:EXP.filter(pass);
  return P(`${hd('A saját testeden bizonyítjuk','N=1 kísérletek')}
  <section class="open first rise" style="--i:1;padding-top:0">${big('2','fut most')}</section>
  ${seg([['mind','Mind · 7'],['aktiv','Aktív · 2'],['javaslat','Javaslat · 1'],['lezart','Lezárt · 4']],f,'ex')}
  ${list.length?list.map((e,i)=>e.s==='aktiv'&&i===0?`<section class="card hg rise" style="--i:2"><div class="sec" style="padding:0 0 6px"><span class="eb">${EXS[e.s]} · ${e.d}/7 nap</span></div><button style="display:block;text-align:left;width:100%" data-go="${e.go}"><h2 class="t">${e.t}</h2><p class="txt sub">${e.h}</p></button>${dcell([1,2,3,4,5,6,7].map(k=>[k+'.',k<=e.d?'el':k===e.d+1?'now':'']))}</section>`
    :`<article class="po rise" style="--i:${i+2}"><div class="ln tap" style="border-top:0;padding-top:0" data-go="${e.go}">${ic(e.s==='javaslat'?'bulb':e.s==='aktiv'?'clock':'flask')}<span class="g"><span class="tst">${EXS[e.s]}${e.d?' · '+e.d+'/7 nap':''}</span><br>${e.t}<small>${e.h||e.o||''}</small></span>${chev}</div>${e.s==='javaslat'?`<div class="act" style="margin-top:4px"><button class="btn sm" data-toast="Elfogadva — holnap indul">${ic('tick')}Elfogadom</button><button class="lk" data-toast="Elvetve">Elvetem</button></div>`:''}</article>`).join('')
  :`<section class="open rise">${fn('Tanulom, mi működik nálad. Az első kísérletet akkor javaslom, ha lesz elég adatom egy jó kérdéshez.')}</section>`}
  <section class="open rise">${row({ic:'bulb',b:'Új kísérletet javasol Mezo',go:'toast:Mezo gondolkodik egy új kísérleten…'})}</section>`,'fal');
}

/* ═════════ BESZÉLGETÉS (chat + S8 memória) ═════════ */
const STATUS={full:['élő · Gemini',''],mem:['élő · Gemini',''],typing:['dolgozom rajta…','busy'],err:['élő · Gemini',''],empty:['új beszélgetés',''],off:['a társ most nem elérhető','off'],hallgat:['élő · Gemini','']};
const chatHead=(k)=>{const [s,c]=STATUS[k]||STATUS.full;return `<div class="chh rise"><button class="backbtn" data-go="fal"><b>‹</b></button><div class="who">${SIB('mezo',36,true)}<div><strong>Mezo</strong><small><i class="${c}"></i>${s}</small></div></div><button class="hb" data-sheet="picker" aria-label="Beszélgetések">≡</button><button class="hb" data-go="chat.empty" aria-label="Új beszélgetés">+</button><button class="hb" data-sheet="actions" aria-label="Műveletek">⋯</button></div>`};
const msgA=(time,body,i=1,x='')=>`<div class="msg-a rise" style="--i:${i}">${SIB('mezo',26)}<div class="mb"><div class="meta"><b>Mezo</b>${time}${x}</div>${body}</div></div>`;
const msgU=(t,time,i=2)=>`<div class="msg-u rise" style="--i:${i}">${t}<small>${time}</small></div>`;
const composer=(k)=>`<div class="comp"><button data-go="chat.hallgat" aria-label="Diktálás" ${k==='off'?'disabled':''}>${ic('mic')}</button><span class="inp ${k==='hallgat'?'on':''}">${k==='off'?'Most nem elérhető':k==='hallgat'?'Szerinted holnap edzhetek, vagy inkább pihenjek?':'Mondj valamit…'}</span><button class="send" data-go="chat.typing" aria-label="Küldés">${ic('send')}</button></div>`;
const vbubble=()=>`<div class="card hg vb rise" style="margin:0">${SIB('mezo',48,true)}<div class="g"><strong>Figyelek · Mondd nyugodtan</strong><small>Koppints ide, ha végeztél</small></div><div class="bars">${[6,12,18,22,14,20,10,16,22,12,8,14].map((h,i)=>`<i style="--h:${h}px;--i:${i}"></i>`).join('')}</div><button class="lk" data-go="chat.full">Mégse</button></div>`;
const S8F={dori:{w:'Dóri',t:'a strandröpi-párod, együtt nyertétek a szeptemberi tornát',k:'rem'},self:{w:'',t:'Egy nagy közös élmény után nehezen viselem az egyedül töltött estét.',k:'prop'},anna:{w:'Anna',t:'régi csapattársad, rég beszéltetek',k:'rem'},bence:{w:'Bence',t:'jövőre hármasban játszana veled és Annával',k:'rem'}};
const S8R={dori:['tavasz óta a strandröpi-párod','hétköznap ritkán ér rá, inkább hétvégén játszotok'],bence:['az egyetem óta ismeritek','ő szervezi a szombati edzéseket']};
const s8txt=f=>f.w?`<b>${f.w}</b> — ${f.t}`:f.t;
function s8chip(id){const f=S8F[id],s=ST.s8[id];
  if(s==='undone')return `<p class="mdone">${ic('spark')}Visszavonva — nem jegyeztem meg.</p>`;
  if(s==='gone')return `<p class="mdone">${ic('eraser')}<span>Elfelejtve · <s>${f.w?f.w+' — ':''}${f.t}</s></span></p>`;
  if(s==='no')return `<p class="mdone">${ic('bulb')}Rendben, nem jegyzem meg — és nem is javaslom újra.</p>`;
  if(f.k==='prop'&&s==='ask')return `<div class="mch prop">${ic('bulb')}<span class="g"><b>Megjegyezném:</b> ${f.t}<small>rólad szól, ezért előbb megkérdezlek</small></span><span class="ma"><button class="btn sm" data-m="s8:keep:${id}">Igen</button><button class="lk" data-m="s8:no:${id}">Ne</button></span></div>`;
  return `<div class="mch">${ic('spark')}<span class="g"><b>Megjegyeztem:</b> ${s8txt(f)}${f.k==='prop'?'<small>a Tudástár Rólad részében látod</small>':''}</span><span class="ma"><button class="lk" data-m="s8:undo:${id}">Visszavonom</button></span></div>`}
const s8rec=(names,key)=>`<button class="s8rec" data-m="s8:rec:${key}">${ic('people')}Emlékszem: <b>${names.join(' · ')}</b> ›</button>`;
function s8gone(){const latest=['anna','bence'],rest=['dori','self'].filter(id=>['on','ask','kept'].includes(ST.s8[id]));
  const list=(ST.s8.all?[...latest,...['dori','self'].filter(id=>ST.s8[id]==='gone')]:latest).map(id=>`<li>${S8F[id].w?S8F[id].w+' — ':''}${S8F[id].t}</li>`).join('');
  return `<div class="mch">${ic('eraser')}<span class="g"><b>Elfelejtettem:</b><ul>${list}</ul><small>végleg — ezeket többé nem használom, és nem is tanulom meg újra</small>${!ST.s8.all&&rest.length?`<button class="lk" style="margin-top:6px" data-m="s8:allask">Mindent ebből a beszélgetésből?</button>`:''}</span></div>`}
function s8chat(){return chatHead('mem')+`<div class="thread">
  ${msgU('Megnyertük ma a strandröpi-tornát Dórival és Bencével! Aztán mindenki hazament, én meg itt ülök egyedül. Furcsa ez a csend.','22:05',1)}
  ${msgA('22:05',`<p>Gratulálok, ez nagy nap volt! Dórival tavasz óta játszotok párban, és most jött ki igazán.</p><p>Nem meglepő, hogy ilyen csúcs után furcsa a csend: egy nagy közös élmény után a hirtelen egyedüllét sokakat lehúz egy kicsit. Mi esne most jól, átbeszélni a meccset, vagy inkább lecsendesedni?</p>${s8rec(['Dóri','Bence'],'1')}`,2)}
  ${s8chip('dori')}${s8chip('self')}
  ${msgU('Átbeszélni. Bence mondta, hogy jövőre Annával is összeállhatnánk, vele régen nem beszéltem. Ezt el tudod menteni valahova?','22:07',4)}
  ${msgA('22:07',`<p>Igen, a magam módján: a beszélgetés után megjegyzem, ami fontos. Amit az emberekről mondasz, azt elmentem, amit magadról, azt előbb megkérdezem. Mindkettőt itt a beszélgetésben látod, és később a Tudástárban is.</p><p>Bence ötlete jó alkalom lehet: ha Annával rég beszéltél, egy közös edzés könnyebb belépő, mint egy nagy „mi van veled”.</p>${s8rec(['Bence'],'2')}`,5)}
  ${s8chip('anna')}${s8chip('bence')}
  ${msgU('Az Annásat inkább ne jegyezd meg.','22:09',7)}
  ${msgA('22:09',`<p>Rendben, elfelejtettem. Lent látod pontosan, mit: az előző üzenetedből tanult két dolgot. Ha a mai estéről semmit ne tartsak meg, egy koppintás.</p>`,8)}
  ${s8gone()}</div>`}
function s8ureschat(){return chatHead('mem')+`<div class="thread">
  ${msgU('Dórival ma is strandröpiztünk, megint nyertünk!','19:40',1)}${msgA('19:40','<p>Szuper, gratulálok — Dórival megint összejött.</p>',2)}
  <div class="mch">${ic('spark')}<span class="g"><b>Megjegyeztem:</b> <b>Dóri</b> — a strandröpi-párod, ma is nyertetek</span><span class="ma"><button class="lk" data-toast="Visszavonva — nem jegyeztem meg.">Visszavonom</button></span></div>
  ${msgU('Milyen lesz az idő holnap az edzéshez?','19:42',4)}${msgA('19:42','<p>Holnap napos, enyhe szél — jó nap a szabadtéri edzéshez.</p>',5)}
  ${msgU('Ezt ne jegyezd meg.','19:43',7)}${msgA('19:43','<p>Rendben. Lent látod, mit találtam — vagy inkább mennyit.</p>',8)}
  <div class="mch">${ic('eraser')}<span class="g">Nem volt mit elfelejteni — az előző üzenetedből semmit nem jegyeztem meg.<button class="lk" style="display:block;margin-top:6px" data-m="s8:allask">Mindent ebből a beszélgetésből?</button></span></div></div>`}
const S8M={a:{w:'Dóri',t:'Dórival egyre komfortosabbak vagyunk egymással, az ölelés is természetes már köztünk.'},b:{w:'Dóri',t:'Dóri mellett nem kell megjátszanom magam.'}};
function s8mchip(id){const f=S8M[id],s=ST.s8m[id];if(s==='undone')return `<p class="mdone">${ic('spark')}Visszavonva — nem jegyeztem meg.</p>`;const me_=s==='me';
  return `<div class="mch two">${ic('spark')}<span class="g"><b>Megjegyeztem: ${f.w}</b> — ${f.t}<small>${me_?'Dóri lapján és a Tudástár Rólad részében is látod':'Dóri lapján látod'}</small></span><span class="ma"><button class="lk" data-m="s8:me:${id}" aria-pressed="${me_}">${me_?'Rólad is · kész':'Rólam is'}</button><button class="lk" data-m="s8:mundo:${id}">Visszavonom</button></span></div>`}
function s8rolamis(){return chatHead('mem')+`<div class="thread">${msgU('Dórival egyre jobban vagyunk, már az ölelés is természetes köztünk. Mellette nem kell megjátszanom magam, ez nagyon jó érzés.','09:04',1)}
  ${msgA('09:04',`<p>Ez nagyon szép. Amikor valaki mellett nem kell szerepet játszanod, az nem egy programhoz vagy teljesítményhez kötődik, hanem hozzád.</p><p>És hogy az érintés is egyre természetesebb, az azt jelzi, hogy épül a bizalom. Nem kell siettetni semmit.</p>${s8rec(['Dóri'],'3')}`,2)}${s8mchip('a')}${s8mchip('b')}</div>`}
function chatFull(k){
  const tools=`<button class="lk" data-m="tools">Utánanézett · 3 forrás ${ST.tools?'⌃':'⌄'}</button>${ST.tools?[['sleep','Alvás · tegnap éjjel','hogy lássam, mennyit pihentél','7 óra 4 perc, két ébredés'],['dumbbell','Edzés · Push Day','a tegnapi terhelésért','Lat Pulldown 105 × 9 @ RIR 1, 16 szett'],['pattern','Minták · alvás','van-e friss összefüggés','Nincs friss minta, a régi még nem erős.']].map(r=>`<div class="ln">${ic(r[0])}<span class="g">${r[1]}<small>miért: ${r[2]}</small><small>${r[3]}</small></span></div>`).join(''):''}`;
  const mems=`<button class="lk" data-m="mems">Emlékek · 2 ${ST.mems?'⌃':'⌄'}</button>${ST.mems?[['futás után jobban aludtam','2026-05-18',92],['a push nap után a váll érzékeny','2026-08-03',81]].map(m=>`<div class="ln"><span class="g">${m[0]}<small>${m[1]}</small><span class="act" style="margin-top:4px"><button class="lk" data-toast="Köszi, megjegyeztem">Hasznos</button><button class="lk" data-toast="Rendben, ide nem veszem elő">Nem ide tartozik</button><button class="lk" data-toast="Biztosan? Többé nem használom ezt az emléket.">Ne használd többé</button></span></span><span class="v"><b>${m[2]}</b>%</span></div>`).join(''):''}`;
  const a1=msgA('06:32',`${tools}<p>Jó reggelt. Tegnap a Push Day jól ment: a <b>Lat Pulldown 105 × 9</b> RIR 1-gyel az eddigi legjobbad.</p><p>Hét óra alvás után ma nyugodtan tarthatod a tervezett terhelést, de a vállad miatt a nyomásoknál maradj a megszokott súlynál.</p><div class="mrefs"><span class="eb">Amire épült</span><p class="v">Push Day · tegnap · Lat Pulldown 105 × 9 · Alvás 7 ó 4 p</p></div>${mems}<div class="fbk"><button class="lk" data-toast="Köszi!">Segített</button><button class="lk" data-toast="Mi nem stimmelt? pontatlan · túl sok · rossz időzítés · nem rólam szól">Nem talált</button></div>`,1);
  const u1=msgU('Aludtam 7 órát. Érzem, hogy ma jobb, mint tegnap.','06:35',2);
  const a2=msgA('06:35','<p>Látszik is: a pulzusod reggel három ütéssel lejjebb volt. Ha délután röpi van, ebédnél egyél egy tányér rizst, az kitart a harmadik szettig.</p>',3,'<span class="eb">nem ellenőrzött</span>');
  if(k==='empty')return chatHead(k)+`<div class="chempty rise">${SIB('mezo',56,true)}<h2 class="t">Új beszélgetés</h2><p class="txt sub">Kérdezz bármit a napodról, az edzésről, az evésről.</p></div><div class="qq">${[['sun','Foglald össze a mai napom röviden'],['dumbbell','Mit edzek ma?'],['bowl','Mennyi fehérje hiányzik még?'],['sleep','Miért aludtam rosszul?']].map(q=>`<div class="ln tap" data-go="chat.typing">${ic(q[0])}<span class="g">${q[1]}</span>${chev}</div>`).join('')}</div>`;
  if(k==='off')return chatHead(k)+`<div class="thread"><p class="degr rise">A társ jelenleg nincs bekapcsolva. A korábbi beszélgetéseid megvannak, de most nem tudok válaszolni.</p>${a1}${u1}</div>`;
  let tail='';if(k==='typing')tail=`<div class="cm rise">${SIB('mezo',26)}<div class="cb"><span class="typing"><i></i><i></i><i></i></span><p class="fn" style="margin:0">megnézem az adataidat…</p></div></div>`;
  if(k==='err')tail=`<div class="msg-a rise">${SIB('mezo',26)}<div class="mb"><p><b>Nem jött válasz.</b> Az üzeneted nem veszett el.</p><div class="act"><button class="btn sm" data-go="chat.typing">Újra</button><button class="lk" data-toast="Szerkesztés">Szerkesztés</button></div></div></div>`;
  return chatHead(k)+`<div class="thread">${a1}${u1}${a2}${k==='typing'||k==='err'?msgU('Akkor ma mehet a röpi is?','06:37',4):''}${tail}</div>`;
}
function chat(arg){const k=arg||'';const body=k==='ures'?s8ureschat():k==='rolamis'?s8rolamis():k===''?s8chat():chatFull(k);
  return P(body,'fal',{pad:'180px'})+(k==='off'?'':composer(k))+(k==='hallgat'?vbubble():'')}

/* ═════════ COACHING · MEGFIGYELŐ · KÁRTYA ═════════ */
const RULES=[{n:'Terhelés–táplálás',ic:'bowl',s:'act',win:1,why:'7 napos terhelés 412 perc, a kalória a cél 71%-án.',f:[['Mért érték','71%'],['Küszöb','85%']]},{n:'Edzés-monotónia',ic:'dumbbell',s:'act',why:'Öt napja ugyanaz a terhelés, pihenőnap nélkül.',f:[['Mért érték','2,4'],['Küszöb','2,0']]},{n:'Késői koffein',ic:'flame',s:'pend',why:'Tegnap szólt, két napig pihen, hogy ne ismételje magát.',f:[['Utoljára','szept. 24.'],['Pihen még','1 nap']]},{n:'Alvásadósság',ic:'sleep',s:'ok',why:'Az elmúlt 3 éjszaka átlaga rendben van.',f:[['Mért érték','1,0 óra'],['Küszöb','2,0 óra']]},{n:'Fehérje-hiány',ic:'protein',s:'ok'},{n:'Súlytrend',ic:'weight',s:'ok'},{n:'Hidratáció',ic:'water',s:'ok'},{n:'Lépésszám',ic:'steps',s:'ok'},{n:'Regeneráció',ic:'sprout',s:'ok'},{n:'Napló-csend',ic:'journal',s:'ok'},{n:'Esti képernyő',ic:'moon',s:'ok'},{n:'Pulzus-variancia',ic:'heart',s:'mut',why:'Nincs óra-adat az elmúlt 7 napból.'},{n:'Stressz-jelek',ic:'signal',s:'mut'},{n:'Ciklus',ic:'calendar',s:'mut'}];
const SCHIP={act:['Jelzett','warn'],pend:['Pihenőn','q'],ok:['Rendben','q'],mut:['Nem mérhető','q']};
function coaching(){return P(`${bk('Összes funkció','osszes')}${hd('Proaktív coaching · ma','3 jelzés')}
  <section class="open first rise" style="--i:1;padding-top:0">${bigs([['2','jelzett'],['1','pihenőn'],['8','rendben'],['3','nem mérhető']])}${fn('14 szabály · ma ennyi szólalt meg. Ez a felület nem dönt: azt mutatja meg, mit döntött ma a motor, és miért.')}</section>
  <section class="card hg rise" style="--i:2;--c:var(--warn)"><span class="eb">A nap nyertese · 1 / 14</span><button style="display:block;text-align:left;width:100%" data-go="kartya"><h2 class="t">Terhelés–táplálás</h2><p class="txt sub">7 napos terhelés 412 perc, a kalória a cél 71%-án.</p></button><div class="act"><button class="lk" data-go="kartya">Ebből lett a mai kártya ›</button></div></section>
  <section class="open rise" style="--i:3">${row({ic:'eye',b:'Megfigyelő',sm:'mind a 14 szabály, súlyossági sorrendben',go:'megfigyelo'})}${row({ic:'card',b:'A napi kártya',sm:'Terhelés–táplálás nyerte a napot',go:'kartya'})}</section>`,'fal')}
const ruleRow=(r,i)=>{const [l,k]=SCHIP[r.s],open=ST.rule==='r'+(i+1);return `<div class="ln ${r.why?'tap':''}" style="flex-wrap:wrap;${r.s==='ok'||r.s==='mut'?'opacity:.75':''}" ${r.why?`data-m="rule:r${i+1}"`:''}><span class="v" style="width:18px">${i+1}</span>${ic(r.ic)}<span class="g">${r.n}${r.win?' · nyertes':''}</span>${st(l,k)}${r.why?`<i style="font-style:normal;color:var(--faint)">${open?'⌃':'⌄'}</i>`:''}
  ${(r.s==='act'||open)&&r.why?`<p class="txt sub" style="flex-basis:100%;margin-top:4px">${r.why}</p>`:''}${open&&r.f?`<p class="fn mono" style="flex-basis:100%;margin:2px 0 0">${r.f.map(f=>f[0]+' '+f[1]).join(' · ')}</p>`:''}</div>`};
function megfigyelo(){return P(`${bk('Coaching','coaching')}${hd('Coaching · 3 jelzett · 14 szabály','Megfigyelő')}
  <div class="sec rise" style="padding-top:0"><button class="lk" data-toast="Szerda">‹ szerda</button><span class="eb">ma · csütörtök</span><span class="eb" style="color:var(--hair)">›</span></div>
  <section class="open first rise" style="--i:1"><span class="eb">Megszólalt</span>${RULES.slice(0,3).map((r,i)=>ruleRow(r,i)).join('')}</section>
  <section class="open rise" style="--i:2"><span class="eb">Rendben</span>${RULES.slice(3,11).map((r,i)=>ruleRow(r,i+3)).join('')}</section>
  <section class="open rise" style="--i:3"><span class="eb">Nem mérhető</span>${RULES.slice(11).map((r,i)=>ruleRow(r,i+11)).join('')}</section>
  <section class="open rise" style="--i:4"><span class="eb">A nap változásai</span>${[['09:00','Terhelés–táplálás','A szabály jelzett.'],['09:00','Edzés-monotónia','A szabály jelzett.'],['07:10','Késői koffein','Pihenőre került.']].map(t=>`<div class="ln"><time>${t[0]}</time><span class="g">${t[1]}<small>${t[2]}</small></span></div>`).join('')}${fn('A sorrend maga a döntés: fent az, ami ma a legsürgetőbb.')}</section>`,'fal')}
function kartya(){if(ST.card==='none')return P(`${bk('Coaching','coaching')}${hd('Coaching','A napi kártya')}<section class="open first rise">${fn('Ma nem érkezett kártya. Egyik szabály sem volt elég sürgős ahhoz, hogy szóljon.')}</section>`,'fal');
  return P(`${bk('Coaching','coaching')}${hd('Coaching · egy kártya naponta. Ma ez nyert.','A napi kártya')}
  <section class="card hg rise" style="--i:1;--c:var(--warn)"><span class="eb">Terhelés–táplálás</span><h2 class="t">Egyél a terheléshez</h2><p class="txt">A heti terhelésed magas, a bevitel viszont a cél alatt maradt. Ma tegyél be egy tisztességes ebédet, és a holnapi edzést vedd egy fokkal lazábbra.</p>
    ${bigs([['412','perc · 7 napos terhelés'],['71%','kalória a célhoz']])}
    <div class="ln">${ic('bowl')}<span class="g">Ebédre legalább 600 kcal, benne szénhidrát.</span></div><div class="ln">${ic('dumbbell')}<span class="g">Holnap a tervezett szettek 80%-a is elég.</span></div>
    ${ST.card==='done'?after('Könnyítettük a holnapot'):`<div class="act"><button class="btn sm" data-m="card:done">${ic('tick')}Könnyítsd a holnapot</button></div>`}</section>
  <section class="open rise" style="--i:2"><span class="eb">Miért ez nyert</span>${[['dumbbell','Edzés-monotónia','ugyanolyan súlyos, de tegnap is szólt','rang 2'],['flame','Késői koffein','pihenőn','rang 3'],['sleep','Alvásadósság','alacsonyabb súlyosság','rang 6']].map(l=>row({ic:l[0],b:l[1],sm:l[2],v:l[3]})).join('')}${fn('Egy kártya naponta: itt az is látszik, mi ellen nyert.')}</section>`,'fal')}

/* ═════════ DIAGNÓZIS (Kérdezd a csapatot) ═════════ */
const ASKS=[['Miért vagyok fáradt?','Az alvásod, az edzéseid és az evésed két hetéből keresem az okot.'],['Miért alszom rosszul?','Az esti szokásaid és az alvásnaplód összevetése.'],['Miért mozog a súlyom?','Valódi változás vagy víz és só? Heti számvetéssel.']];
function diagnozis(){const busy=ST.dg==='busy';
  return P(`${bk('Összes funkció','osszes')}${hd('Kérdések a csapatnak · 2 riport','Diagnózis')}
  <section class="card hg rise" style="--i:1"><span class="eb">Kérdezd meg</span><h2 class="t">${ASKS[0][0]}</h2><p class="txt sub">${ASKS[0][1]}</p><div class="act"><button class="btn sm" data-m="dg:${busy?'idle':'busy'}">${ic('spark')}${busy?'A két hét adatait olvasom…':'Kérdezd meg most'}</button></div></section>
  <section class="open rise" style="--i:2">${ASKS.slice(1).map(a=>row({ic:'spark',b:a[0],sm:a[1],go:'toast:Kérdés feltéve — a riport készül'})).join('')}${fn('kérdés → gyanúsítottak bizonyítékkal → próba · napi 3 kérdés · a megnyitás mindig ingyen')}</section>
  <section class="open rise" style="--i:3"><span class="eb">További kérdések</span><div class="ln" style="opacity:.6"><span class="g">Kell most deload?</span><span class="v">hamarosan</span></div><div class="ln" style="opacity:.6"><span class="g">Havi Mezo-riport</span><span class="v">hamarosan</span></div></section>
  <section class="open rise" style="--i:4"><div class="sec" style="padding:0 0 4px"><span class="eb">Korábbi riportok</span><span class="eb">2</span></div>${[['1','Aug 30','Miért vagyok fáradt?','A fáradtság mögött leginkább a rövid alvás áll.','2 gyanúsított · a legerősebb: Alváshiány (erős)'],['2','Szept 7','Miért mozog a súlyom?','A súlyod valóban csökken, a napi ugrálás víz.','2 gyanúsított · a legerősebb: Víz-visszatartás (erős)']].map(r=>`<div class="ln tap" data-go="diag.${r[0]}">${ic('gem')}<span class="g"><span class="tst">${r[1]} · mérsékelt bizonyosság</span><br>${r[2]}<small>${r[3]} · ${r[4]}</small></span>${chev}</div>`).join('')}</section>`,'fal')}
const DIAG={1:{q:'Miért vagyok fáradt?',win:'Aug 17 – 30 · az utolsó 14 nap adatából',v:'A fáradtság mögött leginkább a rövid alvás áll; a késői edzések csak rátesznek egy lapáttal.',s:[{n:'Alváshiány',st:'erős',c:'Az utóbbi két hétben átlagosan egy órával kevesebbet aludtál, mint előtte.',ev:[['alváshossz','6,1 h','↓ 1,2','Alvás-napló · 13 nap'],['éjszakai ébredés','3,4','↑ 1,1','Alvás-napló · 13 nap']],pr:['7 nap','Feküdj le hét estén át 23:00 előtt, és figyeljük a reggeli energiádat.']},{n:'Késői edzés',st:'mérsékelt',c:'A 19:00 utáni edzések utáni éjszakák 25 perccel rövidebbek.',ev:[['esti edzés','4 alkalom','','Edzésnapló · 14 nap'],['alvás utána','5,7 h','↓ 0,6','Alvás-napló · 4 éj']],pr:['14 nap','Két hétig tedd a nehéz napokat 18:00 elé.']}]},
  2:{q:'Miért mozog a súlyom?',win:'Aug 31 – Szept 6 · heti számvetés',v:'A súlyod valóban csökken; a napi ugrálás a só és a víz, nem a zsír.',szam:[['valódi változás','−0,7 kg'],['heti átlag','82,4 kg'],['előző hét','83,1 kg'],['víz-zaj','± 0,9 kg']],s:[{n:'Víz-visszatartás',st:'erős',c:'A sósabb napok után reggel 0,6–0,9 kg-mal többet mutat a mérleg.',ev:[['sóbevitel','5,8 g','↑ 1,4','Fuel · 7 nap'],['reggeli súly','+0,8 kg','↑','Súlynapló · 3 reggel']],pr:['7 nap','Egy hétig tartsd a sót 4 g alatt, és nézzük a reggeli súlyt.']},{n:'Kalória-deficit',st:'mérsékelt',c:'Átlagosan napi 420 kcal-lal a karbantartás alatt eszel.',ev:[['napi átlag','2 180 kcal','↓ 420','Fuel · 7 nap']],pr:['7 nap','Maradj ennél, és figyeljük a heti átlagot.']}]}};
function diag(id){const d=DIAG[id]||DIAG[1];
  return P(`${bk('Diagnózis','diagnozis')}
  <section class="card hg rise" style="--i:1"><span class="eb">${d.win}</span><h2 class="t">${d.q}</h2><p class="txt">${d.v}</p><p class="fn">${ic('gem','sm')} mérsékelt bizonyosság · azóta új adatod érkezett a riport ablakában</p></section>
  ${d.szam?`<section class="open rise" style="--i:2"><span class="eb">Számvetés</span>${d.szam.map(r=>`<div class="ln"><span class="g">${r[0]}</span><span class="v"><b>${r[1]}</b></span></div>`).join('')}</section>`:''}
  <section class="open rise" style="--i:3"><div class="sec" style="padding:0 0 4px"><span class="eb">Gyanúsítottak</span><span class="eb">erősség szerint</span></div>
  ${d.s.map((s,i)=>`<div class="ln" style="flex-wrap:wrap;align-items:flex-start"><span class="v" style="width:18px">${i+1}</span><span class="g"><span class="tst">${s.st}</span><br><b>${s.n}</b><small>${s.c}</small>${s.ev.map(e=>`<small class="mono">${e[0]} <b>${e[1]}</b> ${e[2]} · ${e[3]}</small>`).join('')}<small style="margin-top:6px">${ic('flask','sm')} Próba · ${s.pr[0]}: ${s.pr[1]}</small>
    <span class="act" style="margin-top:6px">${i===0&&ST.probe?`<button class="lk" data-go="kiserletek">Aktív kísérlet lett, a Kísérletek oldalon követed ›</button>`:`<button class="${i===0?'btn sm':'lk'}" ${i===0?'data-m="probe"':'data-toast="Elindítva: aktív kísérlet lett"'}>${i===0?ic('tick'):''}Próbáljuk ki</button>`}</span></span></div>`).join('')}</section>`,'fal')}

/* ═════════ KARAKTER-NAPLÓ (naplo) ═════════ */
const FEED=[{k:'deru',t:'A reggeli mérések három hete <b>makulátlanul pontosak</b> — ez ritka fegyelem.',d:'ma · 06:12'},{k:'mocor',t:'A tegnapi kihagyott logolást ma reggelre már pótoltad — ez a minta ismerős nálad.',d:'ma · 07:40'},{k:'mezo',t:'Vasárnapi konzílium: <b>2 új állítás</b> · 1 portré átírva',d:'tegnap',conf:1},{k:'mocor',t:'A tegnapi teremedzésen <b>minden RIR-cél 1-en belül</b> teljesült.',d:'tegnap'},{k:'mezo',t:'Portré frissült: Alvás &amp; regeneráció — a hétvégi eltolódás mostantól „biztos” szintű állítás.',d:'aug. 29.',conf:1}];
function naplo(){const list=FEED.map((p,i)=>[p,i]).filter(([p])=>ST.ff==='Minden'||(ST.ff==='Következtetések'?p.conf:ST.ff==='Megfigyelések'?!p.conf:false));
  return P(`${hd('Egyre jobban ismerünk','Karakter')}
  <section class="open first rise" style="--i:1;padding-top:0">${ln(ic('tick'),'Elkészült a csapat napi beszélgetése.','Feldolgozott adatok: aug. 30-ig.','','data-go="konzilium"',chev)}</section>
  <section class="card hg rise" style="--i:2"><div class="sec" style="padding:0 0 6px"><span class="eb">A csapat történetei</span><span class="eb">ma</span></div><div class="hero-r">${minis(['szunya','deru','mocor'])}<p class="txt sub" style="font-style:italic">„A hétvégi lefekvés két órával kitolódik…”</p></div>
    <h2 class="t">Rólad beszélgettünk. Most te jössz.</h2><p class="txt">Szunya szerint a hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik. Mocor szerint ez inkább program, mint alvás. A Szkeptikus meghagyta, Mezo elfogadta…</p>
    <div class="act"><button class="btn sm" data-go="konzilium">Belenézek a beszélgetésbe ›</button><span class="eb">3 karakter · 3 hozzászólás</span></div></section>
  ${seg([['Minden','Minden'],['Megfigyelések','Megfigyelések'],['Beszélgetések','Beszélgetések'],['Következtetések','Következtetések']],ST.ff,'ff')}
  ${list.length?list.map(([p,i])=>`<article class="po rise" style="--i:${i+3}">${ph(p.k,p.d+' · '+(p.conf?'a csapat összegzése':CH[p.k].a.toLowerCase()),`<span class="eb" style="display:inline">${p.conf?'Összegzés':'Megfigyelés'}</span>`)}<p class="txt">${p.t}</p>
    ${p.conf&&i===2?`${cmt('deru','<span class="area">TÁMOGATJA</span>A pulzusvariancia is ezt a két napot mutatja gyengébbnek.')}${cmt('mocor','<span class="area">VITATJA</span>Szerintem ez nem alvás, hanem hétvégi program.')}${cmt('szk','<span class="area">MEGHAGYTA</span>Hat hét adat, konzisztens.')}${cmt('mezo','<span class="area">ELFOGADTA</span>Bekerül a dossziéba, a Szkeptikus érvét fogadom el. <button class="lk" data-toast="Mi változott? — a dialógus a megvalósításban él">Mi változott?</button>')}
    <div class="act"><button class="lk" data-m="mfb:c${i}:up" aria-pressed="${ST.mfb['c'+i]==='up'}">Hasznos</button><button class="lk" data-m="mfb:c${i}:down" aria-pressed="${ST.mfb['c'+i]==='down'}">Nem így érzem</button></div>`:''}
    <div class="act"><button class="lk" data-sheet="evidence">Miből látszik?</button><button class="lk" data-sheet="reply">Válaszolok</button>${p.conf?`<button class="lk" data-go="konzilium">Beszélgetés ›</button>`:''}</div>${rrow()}</article>`).join('')+`<div class="p16 rise"><button class="lk" data-toast="+12 korábbi bejegyzés">Korábbi bejegyzések</button></div>`:`<section class="open rise">${fn('Egyelőre nincs friss megfigyelés ebben a nézetben.')}</section>`}
  <section class="open rise"><span class="eb">Mögötte</span>${row({ic:'gear',b:'Hogyan működik?',sm:'Források, megfigyelések és feldolgozás',go:'gepterem'})}${row({ic:'council',b:'A csapat beszélgetései',sm:'Korábbi tanácskozások és döntések',go:'konzilium'})}</section>`,'fal')}

/* ═════════ EMLÉKEK · MEMOÁR ═════════ */
function emlekek(){return P(`${hd('A te történeted · napok, amikből összeállsz','Emlékek')}
  <section class="card hg rise" style="--i:1;--c:${CH.mezo.c}">${ph('mezo','a heted története · szept. 15–21.',`<span class="eb" style="display:inline">heti fejezet</span>`)}<h2 class="t">Apró fordulatok.</h2><p class="txt sub">Nem egy nagy elhatározás — egy korábban lezárt este, egy meccs, és egy mondat, amit végre leírtál. Mezo meséli, négy rövid lépésben.</p><div class="act"><button class="btn sm" data-go="memoar">Olvasom ›</button><button class="lk" data-go="archivum">Archívum · 6 fejezet</button></div></section>
  <div class="sec rise"><span class="eb">A napjaid</span><span class="eb">pötty = van emléke</span></div>
  <section class="ds rise" style="--i:2">${[['H','15',1],['K','16',1],['Sze','17',0],['Cs','18',1],['P','19',1],['Szo','20',1],['V','21',1]].map(([d,n,has])=>`<button class="${has?'has':''}${n==='21'?' on':''}" ${has?`data-go="nap.${n}"`:'data-toast="Ezen a napon nem született emlék"'}><small>${d}</small><b>${n}</b><i>${has?'•':''}</i></button>`).join('')}</section>
  <section class="open rise" style="--i:3"><span class="eb">Napi emlékek · éjszakai összefoglalók</span>
    ${row({ic:'moon',b:'Vasárnap · szept. 21. — Meccs, korai vacsora — és a legjobb éjszakád a héten',sm:'3 forrásból · a kísérlet egyik találat-napja',go:'nap.21'})}${row({ic:'sun',b:'Szombat · szept. 20. — Lassú reggel, hosszú séta',sm:'2 forrásból',go:'nap.20'})}
    ${DAYS.map(d=>`<div class="ln tap" data-go="emlek"><time>${d[1]} ${d[2]}</time><span class="g">${d[3]}<small>A nap története ›</small></span></div>`).join('')}</section>
  <section class="open rise" style="--i:4"><span class="eb">Hasonló napok keresése</span>${search()}</section>
  <section class="open rise" style="--i:5">${row({ic:'calendar',b:'Heti értékelés',sm:'az Én · Hét oldalán',go:'toast:Heti értékelés — az Én területen'})}${row({ic:'layers',b:'Memória',sm:'rétegek és audit',go:'memoria'})}</section>`,'emlekek')}
function emlek(){return P(`${bk('Emlékek','emlekek')}${hd('Napi emlék · kedd','2026. augusztus 12.')}
  <section class="card hg rise" style="--i:1"><div class="prose"><p>Erős pull-nap volt: a Chest Supported Row 3×8-ra ment, és délután is maradt energia. A napló szerint a munka is jól haladt, és egyszer sem kellett kávé 14 óra után.</p><p>Este korán feküdtél, 7 óra 40 perc lett belőle, a reggeli pulzus is lejjebb ment. Ez volt a hét legnyugodtabb éjszakája.</p></div>${fn('Mezo éjszakai összefoglalója a rögzített napodról.')}</section>
  <div class="pager rise"><button data-toast="2026-08-11"><small>‹ korábbi emlék</small><strong>2026-08-11</strong></button><button class="r" data-toast="2026-08-13"><small>következő emlék ›</small><strong>2026-08-13</strong></button></div>
  <section class="open rise">${row({ic:'album',b:'Emlékek',sm:'összes nap',go:'emlekek'})}</section>`,'emlekek')}
/* memoár: vezetett, átugorható modulsor (MF-elv) — miért most → mi történt → miből íródott → hogy olvastad */
const MSTEPS=['Miért most','Mi történt','Miből íródott','Hogy olvastad?'];
function memoar(){const s=ST.mstep;
  const steps=`<div class="steps rise">${MSTEPS.map((_,i)=>`<i class="${i<s?'done':i===s?'cur':''}"></i>`).join('')}</div><div class="sec rise" style="padding-top:6px"><span class="eb">${s+1} / 4 · ${MSTEPS[s]}</span>${s<3?`<button class="lk" data-m="mstep:${s+1}">Kihagyom ›</button>`:''}</div>`;
  const body=[
    `<section class="card hg rise" style="--i:1;--c:${CH.mezo.c}">${ph('mezo','vasárnap este · a hét lezárult',`<span class="eb" style="display:inline">heti fejezet</span>`)}<h2 class="t">Apró fordulatok</h2><p class="txt">Ez a hét nem a nagy elhatározásokról szólt. 📔 Vasárnap este leültem, és összeraktam a napi emlékeidből — négy rövid lépésben mesélem, mindegyiket átugorhatod.</p><div class="act"><button class="btn sm" data-m="mstep:1">Mesélj ›</button></div></section>`,
    `<section class="card hg rise" style="--i:1;--c:${CH.mezo.c}"><div class="prose" style="margin-top:4px"><p class="drop">Kedden még úgy nézett ki, megint elúszik minden este — aztán csütörtökön <b>17 óráig megvolt a szénhidrát</b>, és a meccs végjátékában is maradt láb. Szombaton lassú reggel, hosszú séta.</p><p>Vasárnap pedig az történt, amire Szunya hetek óta várt: <b>korai vacsora, 23 előtti lefekvés</b> — és a hét legjobb éjszakája. Ha a jövő hét is így megy, a vacsora-ügyben ki tudjuk mondani az első biztos mondatot.</p></div><div class="act"><button class="btn sm" data-m="mstep:2">Tovább ›</button></div></section>`,
    `<section class="open first rise" style="--i:1;padding-top:0"><span class="eb">Horgonyok · a napokból, amikből íródott</span>${[['moon','Alvás-napló','vasárnap 7,4 — a hét legjobbja'],['bowl','Étkezés-napló','csütörtök · 80 g szénhidrát 17:00-ig'],['volley','Meccsnapok','csütörtök, vasárnap · találat'],['chat','Esti jegyzeteid','szombat · „nem történt semmi nagy — pont ez volt a jó”']].map(a=>row({ic:a[0],b:a[1],sm:a[2]})).join('')}<div class="act"><button class="btn sm" data-m="mstep:3">Tovább ›</button></div></section>`,
    `<section class="card hg rise" style="--i:1;--c:${CH.mezo.c}"><span class="eb">Hogy olvastad?</span><p class="txt" style="margin-top:6px">A következő fejezet ehhez a hanghoz igazodik.</p>${ST.fb.memo?after(ST.fb.memo==='up'?'Jó volt így olvasni — jegyzem.':'Nem ilyen volt — ebből tanulok a legtöbbet.'):`<div class="act"><button class="btn sm" data-m="mfbm:up">${ic('thumb-up')}Talált</button><button class="lk" data-m="mfbm:down">Nem ilyen volt</button></div>`}</section>
     <section class="open rise" style="--i:2">${row({ic:'calendar',b:'Évforduló · 1 hónap',sm:'Egy hónapja kezdtük tudatosan korábbra tolni a vacsorát. Azóta 18 este sikerült.'})}${row({ic:'scroll',b:'Archívum',sm:'a korábbi fejezetek · 6',go:'archivum'})}${row({ic:'flask',b:'Ehhez a héthez tartozó ügy',sm:'Meccs előtti szénhidrát · találat-nap',go:'poszt.kiserlet'})}</section>`][s];
  return P(`${bk('Emlékek','emlekek')}${steps}${body}${s>0?`<div class="p16 rise"><button class="lk" data-m="mstep:${s-1}">‹ vissza</button></div>`:''}`,'emlekek')}
const MCH=[['május 2026',[[20,'Máj 11 – 17','Egy hét, amikor a tested megtanult várni','Hétfőn még úgy indultál, mintha minden nap csúcsnap lenne. Szerdára a tested szólt.',6],[19,'Máj 4 – 10','Amikor az alvás előre szólt','Kedd éjjel 5,7 óra, és szerdán már a bemelegítésnél látszott, hogy ez nem az a nap.',5]]],['április 2026',[[18,'Ápr 27 – Máj 3','Az első közös korrekció','Ezen a héten először mondtad, hogy nem értesz egyet, és igazad lett.',4],[17,'Ápr 20 – 26','Lassabban, de tovább','A futások rövidültek, a hét mégis a legerősebb lett.',5],[16,'Ápr 13 – 19','A hét, amikor visszajött az étvágy','Három hét után először maradt el a délutáni nassolás.',3]]],['március 2026',[[15,'Márc 30 – Ápr 5','Az első fejezet','Még alig ismertük egymást. Ezen a héten kezdtük.',2]]]];
function archivum(){return P(`${bk('Memoár','memoar')}${hd('Memoár · archívum · 3 hónap közös történet','Minden fejezet')}
  ${MCH.map(([m,rows],g)=>`<section class="open ${g?'':'first'} rise" style="--i:${g+1};${g?'':'padding-top:0'}"><div class="sec" style="padding:0 0 4px"><span class="eb">${m}</span><span class="eb">${rows.length} fejezet</span></div>${rows.map(r=>`<div class="ln tap" data-go="fejezet.${r[0]}"><time>hét ${r[0]}</time><span class="g">${r[2]}<small>${r[1]} · ${r[4]} horgony · ${r[3]}</small></span>${chev}</div>`).join('')}</section>`).join('')}`,'emlekek')}
function fejezet(id){const all=MCH.flatMap(c=>c[1]),k=Math.max(0,all.findIndex(r=>String(r[0])===String(id||19))),r=all[k],prev=all[k+1],next=all[k-1];
  return P(`${bk('Archívum','archivum')}${hd(`Heti memoár · hét ${r[0]} · ${r[1]} · 2026`,r[2])}
  <section class="card hg rise" style="--i:1;--c:${CH.mezo.c}"><div class="prose"><p class="drop">${r[3]} A hét elején még minden a terv szerint ment, aztán egy rövid éjszaka mindent átrendezett.</p><p>Ami ebből megmaradt: a tested előbb szól, mint a mérleg vagy a napló. Érdemes rá hallgatni.</p></div>
    <span class="eb">Miből íródott</span><p class="v mono" style="font-size:11.5px;color:var(--sub)">5,7 h kedd éjjel · Guggolás kimaradt · Napló · szerda</p>
    <div class="act"><button class="lk" data-toast="Köszi!">Talált</button><button class="lk" data-toast="Mi nem stimmelt?">Nem ilyen volt</button></div></section>
  <div class="pager rise">${prev?`<button data-go="fejezet.${prev[0]}"><small>‹ előző</small><strong>Hét ${prev[0]}</strong>${prev[2]}</button>`:'<span></span>'}${next?`<button class="r" data-go="fejezet.${next[0]}"><small>következő ›</small><strong>Hét ${next[0]}</strong>${next[2]}</button>`:''}</div>`,'emlekek')}
function napemlek(id){const days={'21':['Vasárnap · szeptember 21.','Meccs, korai vacsora — és a legjobb éjszakád a héten','Délelőtt csend, délután bemelegítés — este pedig meccs. 🏐 A vacsora ezúttal <b>18:40-kor</b> lezárult, és bejött: az éjszakád <b>7,4-es</b> lett, a hét legjobbja. A kísérlet is találatot írt: a 4. szettben stabil maradt az ugrásod.',['alvás 7,4','vacsora 18:40','meccs · találat']],'20':['Szombat · szeptember 20.','Lassú reggel, hosszú séta','Nem történt semmi nagy — és pont ez volt a jó benne. 🌤️ Két forrásból is nyugodt napnak látszik; Derű szerint az ilyen szombatok tartják egyben a heted.',['séta 6,2 km','check-in: nyugodt']]};const d=days[id]||days['21'];
  return P(`${bk('Emlékek','emlekek')}${hd('Napi emlék',d[0])}
  <section class="card hg rise" style="--i:1;--c:${CH.mezo.c}">${ph('mezo','a nap krónikája · a naplóidból')}<h2 class="t">${d[1]}</h2><p class="txt">${d[2]}</p><p class="v mono" style="margin-top:8px;font-size:11.5px;color:var(--sub)">${d[3].join(' · ')}</p></section>
  <section class="open rise" style="--i:2">${row({ic:'flask',b:'Ehhez a naphoz tartozó ügy',sm:'Meccs előtti szénhidrát · találat-nap',go:'poszt.kiserlet'})}${row({ic:'history',b:'Mikor volt még ilyen napom?',sm:'hasonló emlékek visszakeresése',go:'toast:Hasonló napok keresése — a megvalósításban él'})}</section>`,'emlekek')}

/* ═════════ LAPOK (alulról) ═════════ */
const SHEETS={
  menu:()=>`<span class="eb">Ehhez a bejegyzéshez · a poszt saját menüje</span>${row({ic:'info',b:'Miből látszik?',sm:'bizonyíték',go:'toast:Miből látszik?'})}${row({ic:'history',b:'A téma története',sm:'idővonal',go:'toast:A téma története'})}${row({ic:'skip',b:'Ritkábban ilyet',sm:'a csapat tanul belőle',go:'toast:Ritkábban ilyet — feljegyeztük'})}`,
  reply:()=>`<span class="eb">Elmesélem · a te részed a történetben</span><p class="txt">Mi az, amit csak te tudhatsz erről? A válaszod a témához kerül, és a csapat újraértékeli vele a képet.</p><textarea rows="3" placeholder="Például: két este későig dolgoztam, azért csúszott a vacsora…"></textarea><div class="act"><button class="btn sm" data-m="reply:send">${ic('send')}Válasz küldése</button><button class="lk" data-toast="Diktálás">${ic('mic','sm')} diktálom</button></div>`,
  'reply-falat':()=>`<span class="eb">Elmesélem · késői vacsora · Falat ügye</span><p class="txt">Mi az, amit csak te tudhatsz erről? Falat válaszol rá — ha konkrét okot mondasz (meccs, utazás, betegség), le is zárja az ügyet, és megjegyzi.</p><div class="qf"><button class="lk" data-m="s7fill:10-kor ért véget a röpikupa, csak utána tudtam enni.">„10-kor ért véget a röpikupa…”</button><button class="lk" data-m="s7fill:Nem volt kedvem főzni, csak később kaptam be valamit.">„Nem volt kedvem főzni…”</button></div><textarea rows="3" id="s7ta" placeholder="Például: 10-kor ért véget a meccs, csak utána tudtam enni…"></textarea><div class="act"><button class="btn sm" data-m="s7:send">${ic('send')}Válasz küldése</button></div>`,
  evidence:()=>`<span class="eb">Miből látszik? · ez látszik eddig a naplóidból · 14 nap</span><h2 class="t">Rosszabbul alszol, ha későn vacsorázol?</h2><p class="txt">A 14 estéből, ahol vacsora-idő és alvás is rögzült: a <b>21 óra utáni</b> vacsorák másnapján az alvásod átlag <b>6,0 pont</b> — a korábbi vacsorák után <b>7,5</b>. Ez másfél pont különbség, és 11 nap szól mellette, 3 ellene.</p>
    <div class="cmp"><div><span class="eb">Késői vacsora után</span><span class="num">6,0</span><small>alvás-átlag · 5 ilyen este</small></div><div><span class="eb">Korai vacsora után</span><span class="num">7,5</span><small>alvás-átlag · 9 ilyen este</small></div></div>${KST_VACS()}
    <p class="txt sub">Ami még hiányzik: a hétvége külön vizsgálata — addig a Szkeptikus nem enged kimondani semmit.</p>${fn('Ez együttjárás, nem bizonyított ok-okozat — ezért még nem került a rólad szóló képbe.')}<div class="act"><button class="btn sm" data-go="minta.vacsora">A napok egyenként ›</button></div>`,
  mibol:(t)=>`<span class="eb">Miből látom?</span><h2 class="t">${t||'Ez a tény'}</h2><p class="txt">Három forrásból áll össze: a naplóidból kimért napok, a te saját szavaid a beszélgetésekben, és a konzílium döntése. A kiemelt vonal a legerősebb kapcsolat.</p>${kst([[60,46,'a naplód · 21 nap','big'],[150,20,'te mondtad','up'],[240,46,'konzílium · bekerült','big']],[[0,2,'s'],[1,0,'d'],[1,2,'d']])}${fn('Ha nem stimmel, a lapon elhallgattathatod — a forrás megmarad, csak a társ nem használja.')}<div class="act"><button class="lk" data-go="tenyek">A tény a Tudástárban ›</button></div>`,
  'elo-ev':()=>`<span class="eb">Honnan jön a hiány? · alvásadósság · ma 07:05-kor kapcsolt be</span>${big('2:10','óra hiányzik 3 éjszakából')}<p class="txt">A célod éjszakánként <b>7 óra 30 perc</b>. Az utolsó három éjszakád ennyi volt — a hiányokat összeadtuk:</p>
    ${[['péntek éjjel','6 ó 55 p','−35 p'],['szombat éjjel','6 ó 40 p','−50 p · becsült'],['vasárnap éjjel','6 ó 45 p','−45 p']].map(r=>`<div class="ln"><span class="g">${r[0]}</span><span class="v">${r[1]} · <b>${r[2]}</b></span></div>`).join('')}
    <p class="txt sub" style="margin-top:8px"><b>Mikor zárul le?</b> Ha egy éjszaka eléri a célt, vagy a három napos hiány 1 óra alá megy. Akkor Szunya szól — értesítés nélkül.</p>${fn('A mondatot a karakter hangján írtuk meg, de csak ezek a számok szerepelhetnek benne. Ha az ellenőrzés elbukik, a nyers szabály-szöveg jelenik meg.')}<div class="act"><button class="lk" data-go="gepterem">A motor naplója a Gépteremben ›</button></div>`,
  s8rec:()=>{const k=ST.s8rk,names=k==='1'?['dori','bence']:k==='3'?['dori']:['bence'];return `<span class="eb">Emlékszem</span><h2 class="t">Ezt vettem elő a válaszhoz</h2>${names.map(n=>`<div class="ln" style="align-items:flex-start">${ic('person')}<span class="g"><b>${n==='dori'?'Dóri':'Bence'}</b>${S8R[n].map(x=>`<small>${x}</small>`).join('')}</span></div>`).join('')}${fn('Csak azt veszem elő, amit a Tudástárban is látsz. Ha valamelyiket nem szeretnéd, ott elhallgattathatod vagy elfelejtheted.')}<div class="act"><button class="lk" data-go="kind.6">Emberek a Tudástárban ›</button></div>`},
  s8all:()=>{const rest=['dori','self'].filter(id=>!['undone','no','gone'].includes(ST.s8[id])).map(id=>S8F[id]),n=rest.length;const title=n===1?'Ezt az egyet':n===2?'Ezt a kettőt':`Ezt a ${n} dolgot`,cta=n===1?'Elfelejtem':n===2?'Elfelejtem mind a kettőt':'Elfelejtem mindet';
    return `<span class="eb">Mindent ebből a beszélgetésből</span><h2 class="t">${title} is elfelejtem</h2><ul>${rest.map(f=>`<li>${f.w?`<b>${f.w}</b> — `:''}${f.t}<small>${f.k==='prop'?'javaslat, még nem döntöttél róla':'22:05-kor jegyeztem meg'}</small></li>`).join('')||'<li>Ebből a fordulóból nincs mit elfelejteni.</li>'}</ul>${fn('Végleges: nem használom többé, és ugyanebből nem tanulom meg újra. Amit máskor, máshol mondasz, azt továbbra is megjegyezhetem.')}<div class="act"><button class="btn sm" data-m="s8:allgo">${cta}</button><button class="lk" data-close>Mégse</button></div>`},
  picker:()=>`<span class="eb">Beszélgetések · 4 korábbi</span>${row({ic:'chat',b:'Új beszélgetés',go:'chat.empty'})}${[['Reggeli átnézés','ma · 06:32',1],['Röpi előtti evés','tegnap',0],['Váll és nyomások','szept. 21.',0],['Alvás és koffein','szept. 18.',0]].map(r=>`<div class="ln tap" data-go="chat.full"><span class="g">${r[0]}<small>${r[1]}</small></span>${r[2]?`<span class="v">ez</span>`:''}<button class="lk" data-sheet="actions">⋯</button></div>`).join('')}`,
  actions:()=>ST.act==='rename'?`<span class="eb">Beszélgetés · új név</span><input value="Reggeli átnézés" aria-label="Új név"><div class="act"><button class="btn sm" data-toast="Átnevezve">${ic('tick')}Mentés</button><button class="lk" data-m="act:menu">Mégse</button></div>`
    :ST.act==='delete'?`<span class="eb">Beszélgetés · törlés</span><p class="txt">Biztosan törlöd? A beszélgetés és minden üzenete eltűnik, ezt nem lehet visszacsinálni.</p><div class="act"><button class="btn sm" style="background:var(--bad)" data-toast="Törölve">${ic('trash')}Törlöm</button><button class="lk" data-m="act:menu">Mégse</button></div>`
    :`<span class="eb">Beszélgetés · Reggeli átnézés</span>${row({ic:'pencil',b:'Átnevezés',go:''})}`.replace('<div class="ln " >','<div class="ln tap" data-m="act:rename">')+`<div class="ln tap" data-m="act:delete">${ic('trash')}<span class="g" style="color:var(--bad)">Törlés</span></div>`,
  archive:()=>`<span class="eb">Konzílium · korábbi tanácskozások · 9</span><span class="eb" style="margin-top:8px">2026 · augusztus</span>${[['augusztus 30.','2 bekerült · 1 nyugdíjazva','heti',1],['augusztus 29.','nincs új következtetés','napi beszélgetés',0],['augusztus 23.','3 bekerült · 1 egyéb változás','heti',0],['augusztus 1.','23 állítás újramérlegelve','havi',0]].map(r=>`<div class="ln tap" data-close><span class="g">${r[0]}<small>${r[1]}</small></span><span class="v">${r[2]}${r[3]?' · ez':''}</span></div>`).join('')}<span class="eb" style="margin-top:8px">2026 · július</span><div class="ln tap" data-close><span class="g">július 15.<small>9 kezdő állítás</small></span><span class="v">bootstrap</span></div>`,
  filter:()=>`<span class="eb">Minták · szűrés</span><span class="eb" style="margin-top:8px">Téma</span><div class="wrap" style="margin-top:6px">${['Mind','Alvás','Edzés','Fuel','Lélek','Test'].map((d,i)=>`<button class="lk" aria-pressed="${!i}" data-toast="Téma: ${d}">${d}</button>`).join('')}</div><span class="eb" style="margin-top:12px">Sorrend</span><div class="wrap" style="margin-top:6px"><button class="lk" aria-pressed="true" data-toast="Áttöréshez legközelebb">Áttöréshez legközelebb</button><button class="lk" data-toast="Téma szerint">Téma szerint</button></div><div class="act"><button class="btn sm" data-close>${ic('tick')}Alkalmazom</button></div>`,
  hogyan:(i)=>{const [icn,q,a]=HOGYAN[+i||0];return `<span class="eb">Hogyan működik? · ${+i+1} / ${HOGYAN.length}</span><div class="hero-r" style="margin-top:6px">${ic(icn)}<h2 class="t">${q}</h2></div><p class="txt">${a}</p><div class="act">${+i>0?`<button class="lk" data-sheet="hogyan" data-arg="${+i-1}">‹ előző</button>`:''}${+i<HOGYAN.length-1?`<button class="btn sm" data-sheet="hogyan" data-arg="${+i+1}">Következő ›</button>`:`<button class="btn sm" data-close>Értem</button>`}</div>`},
  'reply-done':()=>`<span class="eb">Megvan — köszönjük! · így folytatódik</span>${[['1','A válaszod a témánál marad','a te szavaiddal, forrásként megjelölve'],['2','A csapat újraértékel','megnézik, melyik magyarázatot erősíti vagy gyengíti. Ezt itt olvashatod majd.'],['3','Ha új tudás születik','külön megmutatjuk — te hagyod jóvá, mielőtt bekerül a rólad szóló képbe.']].map(s=>`<div class="ln"><span class="v">${s[0]}</span><span class="g">${s[1]}<small>${s[2]}</small></span></div>`).join('')}<div class="act"><button class="btn sm" data-close>Rendben</button></div>`
};

/* ═════════ KATTINTÁSOK (saját állapot) ═════════ */
const ACT={
  vote:(a)=>{const [k,v]=a.split(':');ST.vote[k]=ST.vote[k]===v?'':v;soft();if(ST.vote[k])toast(v==='up'?'„Ez talál” — köszönjük, feljegyeztük.':'„Nem így érzem” — ebből tanulunk a legtöbbet. Írd meg válaszban is!')},
  pill:()=>{ST.pillUsed=true;ST.pill=false;const t=document.querySelector('#today');if(t)t.insertAdjacentHTML('afterbegin',`<article class="po rise">${ph('szunya','most · gyors jelzés')}<p class="txt">Láttam a tegnapi korábbi lefekvést — <b>23:05</b>! 🎉 Ha ma is összejön, az már hármas sorozat, és a hármas sorozat nálam a minta kezdete. Szurkolok — este halkan jelentkezem.</p>${acts('p-quick')}</article>`);document.querySelector('#mzpill')?.classList.remove('on');document.querySelector('#phone .scroll')?.scrollTo({top:0,behavior:'smooth'})},
  dontes:()=>{ST.dontes='yes';soft();toast('Bekerült. Bármikor visszavonhatod a Rólad oldalon.')},
  s7fill:(t)=>{const ta=document.querySelector('#s7ta');if(ta)ta.value=t},
  s7:(a)=>{if(a==='undo'){ST.s7.phase='undone';soft();toast('Visszavontam — nem jegyeztem meg, és az ügy újra nyitott.');return}
    const ta=document.querySelector('#s7ta'),v=ta?ta.value.trim():'';if(!v){toast('Írj pár szót — Falat erre válaszol.');return}
    const concrete=/meccs|kupa|röpi|edzés|utaz|beteg|munk|dolgoz/i.test(v);ST.s7={phase:concrete?'typing':'moodTyping',text:v};closeSheet();soft();
    setTimeout(()=>{ST.s7.phase=concrete?'closed':'mood';soft();document.querySelector('#s7')?.scrollIntoView({behavior:'smooth',block:'center'})},still()?0:1800)},
  s7k:()=>{ST.s7k='done';soft();toast('Lezárva kivételként — egy csendes strigula a meccsnapra.')},
  s7r:(v)=>{ST.s7r=v;soft();toast(v==='keep'?'Marad a kivétel — újraindul a számolás.':'Kikapcsolva — a késői vacsorára újra szól.')},
  reply:()=>{const ta=document.querySelector('#sheet textarea');if(ta&&!ta.value.trim()){toast('Írj pár szót — ebből tanul a csapat.');return}openSheet(SHEETS['reply-done']())},
  rq:()=>{ST.rq='talal';soft();toast('Talál — megerősítetted, Szunya benyomása erősödik')},
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
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-m]');if(!b||K.D!=='mezo')return;
  const phn=document.querySelector('#phone');if(!phn||phn.dataset.v!=='ajanlott')return;
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
  rolad:()=>rolad(false),'rolad-terv':()=>rolad(true),eletesemenyek,dimenziok,dimenzio,tudastar,tenyek,kategoriak,kind,hogyan,node,
  konzilium,gepterem,osszes,futasok,futas,adatforrasok,kor,detektorok,memoria,
  mintak,minta,elore,elorejelzesek,kiserletek,'kiserlet-oldal':kiserletOldal,
  chat,coaching,megfigyelo,kartya,diagnozis,diag,naplo,
  emlekek,emlek,memoar,archivum,fejezet,nap:napemlek};

register('mezo',{
  mark:'i-chat',
  tabs:[['Üzenőfal','i-chat','fal'],['A csapat','c-i-emberek','csapat'],['Rólad','c-i-kristaly','rolad'],['Emlékek','i-book','emlekek']],
  routes:ROUTES,
  sheets:SHEETS,
  after:afterRender,
  css:CSS,
  notes:`<h2>Mezo</h2>
<p><b>Az öt szereplő mostantól testvérforma, arc nélkül:</b> Szunya lila kavics, Mocor kék bab, Falat zöld csepp, Derű arany levél, Mezo szürke kristály — a Szkeptikus üres szürke kristály. A forma a feladó, a szöveg a hang: a mondataik változatlanok (hangulatjel csak az ő idézett soraikban maradt, a felületen sehol). Minden posztnál a kis forma + név + szakterület a fejléc; a szobában a forma nagyban lélegzik.</p>
<p><b>Üzenőfal</b> <a href="#a-mezo-fal">#a-mezo-fal</a>: történetsáv (új = vékony gyűrű a saját színnel, pötty = dolga van veled), élő sor, „2 beszélgetésben várnak rád”, a nap posztja az egyetlen üvegkártya (Szunya · Rád vár) csillagkép-grafikával (vacsora–alvás a hangsúlyos vonal, hétvége és edzés-esték szaggatott); a többi poszt nyitott lista hajszálvonallal. Ez talál · Nem így érzem · Elmesélem szöveglinkek; a megerősítés utóélete szürke pipa. ~9 mp után „1 új bejegyzés” korong.</p>
<p><b>Élőben</b> <a href="#a-mezo-elo">#a-mezo-elo</a> (+ <a href="#a-mezo-elo.kivetel">elo.kivetel</a>, <a href="#a-mezo-elo.felulvizsgalat">elo.felulvizsgalat</a>): a csapat beszélgetése, Derű 4 mp múlva beír, Falat válasza (Elmesélem → konkrét ok lezárja és megjegyzi, visszavonható). <a href="#a-mezo-nap-uzenetek">nap-uzenetek</a>, <a href="#a-mezo-elsonap">elsonap</a>.</p>
<p><b>Posztoldalak:</b> <a href="#a-mezo-poszt">poszt</a> (vacsora-ügy, 3 hozzászólás), <a href="#a-mezo-poszt.kiserlet">poszt.kiserlet</a>, <a href="#a-mezo-poszt.sejtes">poszt.sejtes</a>, <a href="#a-mezo-poszt.dontes">poszt.dontes</a> (döntésre váró üvegkártya, „Ez talál” = döntés), <a href="#a-mezo-poszt.elorejelzes">poszt.elorejelzes</a>, <a href="#a-mezo-bizonyitek">bizonyitek</a> (pontfelhő: minden pont egy nap, a trend a hangsúlyos vonal; mellette/ellene szóval, nem színnel).</p>
<p><b>A csapat</b> <a href="#a-mezo-csapat">#a-mezo-csapat</a>: öt sor + Szkeptikus + Gépterem. <b>Szobák</b> <a href="#a-mezo-szoba.szunya">szoba.szunya</a> · mocor · falat · deru · mezo: üveg hős a lélegző formával és az idézettel, nagy számok, „Most ezen dolgozik”, simított érettség-görbe (őszinte lábjegyzettel), „Amit rólad tud” (<a href="#a-mezo-tud.szunya">tud.*</a> — Miből látom? lap + Elhallgattatom), lezárt ügyek (<a href="#a-mezo-ugyek.szunya">ugyek.*</a>), a karakter kérése.</p>
<p><b>Rólad</b> <a href="#a-mezo-rolad">#a-mezo-rolad</a>: 1. üveg = a rólad szóló idézet (Talál · Pontosítom · Miből látom?), 2. üveg = az első döntésre váró javaslat (Igen, jegyezd meg · Pontosítom · Most ne · Nem igaz; az összevonási javaslat: Összevonom · Átírom · Később · Maradjon külön); a többi jelölt nyitott listában, „Még N javaslat” lenyitó. Kirakat (Tények · Emberek · Észrevételek · Hatások), A tények rólad, Életesemények (<a href="#a-mezo-eletesemenyek">eletesemenyek</a>), Tovább, A te kezedben. <a href="#a-mezo-rolad-terv">rolad-terv</a> = minden kibontva. <a href="#a-mezo-dimenziok">dimenziok</a> → <a href="#a-mezo-dimenzio.recovery">dimenzio.*</a> (állítások Talál · Nem igaz · Pontosítom · Miből látom?).</p>
<p><b>Tudástár</b> <a href="#a-mezo-tudastar">tudastar</a> → <a href="#a-mezo-tenyek">tenyek</a> (kapcsolók, Hétfői rendrakás sor, „Bekapcsolva, de most kimarad”, „Kikapcsolva”, „Összevontam” fiók visszakapcsolással), <a href="#a-mezo-kategoriak">kategoriak</a> → <a href="#a-mezo-kind.0">kind.*</a> → <a href="#a-mezo-node">node</a>, <a href="#a-mezo-hogyan">hogyan</a> = hat kérdés, mindegyik egy lapon nyílik (BWS: a magyarázat koppintásra, nem a munkafelületen).</p>
<p><b>Konzílium</b> <a href="#a-mezo-konzilium">konzilium</a> (Áttekintés / Beszélgetés, szálak lenyitása, archívum-lap). <b>Gépterem</b> <a href="#a-mezo-gepterem">gepterem</a> → <a href="#a-mezo-futasok">futasok</a> → <a href="#a-mezo-futas.ejsz">futas.*</a>, <a href="#a-mezo-adatforrasok">adatforrasok</a>, <a href="#a-mezo-detektorok">detektorok</a>, <a href="#a-mezo-memoria">memoria</a> (Rétegek · Napló · Kereső · Audit), <a href="#a-mezo-osszes">osszes</a>, <a href="#a-mezo-kor">kor</a>.</p>
<p><b>Minták</b> <a href="#a-mezo-mintak">mintak</a> (a döntésre váró minta az üveg; adat-egészség: csak a kevés adat borostyán) → <a href="#a-mezo-minta.viz">minta.viz</a> · <a href="#a-mezo-minta.vacsora">vacsora</a> · <a href="#a-mezo-minta.egyhangu">egyhangu</a> · <a href="#a-mezo-minta.hetvege">hetvege</a> · <a href="#a-mezo-minta.mentett">mentett</a> · nincs; <a href="#a-mezo-elorejelzesek">elorejelzesek</a> → <a href="#a-mezo-elore.meccs-energia">elore.*</a>; <a href="#a-mezo-kiserletek">kiserletek</a> → <a href="#a-mezo-kiserlet-oldal.szenhidrat">kiserlet-oldal.*</a>.</p>
<p><b>Beszélgetés</b> <a href="#a-mezo-chat">chat</a> (S8 memória: Megjegyeztem · Megjegyezném · Emlékszem · Elfelejtettem, „Mindent ebből a beszélgetésből?”), <a href="#a-mezo-chat.ures">chat.ures</a>, <a href="#a-mezo-chat.rolamis">chat.rolamis</a> („Rólam is”), <a href="#a-mezo-chat.full">chat.full</a> (források, emlékek, visszajelzés), <a href="#a-mezo-chat.typing">typing</a> · err · empty · off, <a href="#a-mezo-chat.hallgat">chat.hallgat</a> = a hallgató buborék a lélegző kristállyal (Figyelek · Mondd nyugodtan). <a href="#a-mezo-coaching">coaching</a> → <a href="#a-mezo-megfigyelo">megfigyelo</a>, <a href="#a-mezo-kartya">kartya</a>; <a href="#a-mezo-diagnozis">diagnozis</a> → <a href="#a-mezo-diag.1">diag.*</a>; <a href="#a-mezo-naplo">naplo</a> (Karakter-napló).</p>
<p><b>Emlékek</b> <a href="#a-mezo-emlekek">emlekek</a> (heti fejezet üvegben, napok sávja, napi emlékek, hasonló napok keresése) → <a href="#a-mezo-memoar">memoar</a> = <b>vezetett, átugorható négy modul</b> (MacroFactor-elv): Miért most → Mi történt → Miből íródott → Hogy olvastad; <a href="#a-mezo-archivum">archivum</a> → <a href="#a-mezo-fejezet.19">fejezet.*</a>; <a href="#a-mezo-nap.21">nap.21</a> · 20; <a href="#a-mezo-emlek">emlek</a>.</p>
<p><b>Elvek:</b> 1–2 üveg oldalanként (a rólad szóló idézet, a döntésre váró kártya, a nap posztja), minden más nyitott lista; szín csak ott, ahol kérdés vár (Rád vár, Dönthetsz, kevés adat); a megerősített, rendben lévő dolgok szürkék; ítélet-mondat a címek helyett; a csillagkép a terület grafikus nyelve (pontok + hajszálvonalak, hangsúly a legerősebb kapcsolaton, mono feliratok); a trend a főcím, a nyers napok textúra.</p>
<p><b>Amit nem tudtam leképezni:</b> a shell acél készletéből hiányzik a radír, nagyító, tanács, gráf, radar, szem, kártya, síp jel — létező jelekkel pótoltam (lista az <a href="#a-mezo-ikonok">Új ikonok</a> lapon, döntést kér). A Szkeptikus formája nem owner-döntés: üres szürke kristályként rajzoltam. A Tudástár „Emberek” és „Hatások” hub-lapjai külön fájlban élnek — itt a Kategóriák Emberek-listájára, ill. toastra mennek. A Rólad oldalon nincs saját Boop-figura (a csepp csak a napot jelenti).</p>`
});
})();
