/* ══ U8 · Mezo I — a uveg-mezo.html nézetei, változatlanul (mezo-me75u.8) ══ */

const $=s=>document.querySelector(s);
const C=n=>`<svg class="icon" aria-hidden="true"><use href="#c-i-${n}"/></svg>`;
const B=(d,alive=false)=>`<svg class="boop ${alive?'is-alive':''}" viewBox="0 0 100 100" aria-hidden="true"><use href="#boop-${d}"/></svg>`;
const I=(n,c='')=>`<svg class="icon ${c}" aria-hidden="true"><use href="#t-${n}"/></svg>`;
const ring=(p,c,r=34,vb=80)=>`<svg viewBox="0 0 ${vb} ${vb}" aria-hidden="true"><circle class="ring-track" cx="${vb/2}" cy="${vb/2}" r="${r}" pathLength="100"/><circle class="ring-prog" cx="${vb/2}" cy="${vb/2}" r="${r}" pathLength="100" style="--p:${p};--c:${c}"/></svg>`;
const bar=(w,c,i=0)=>`<span class="bar" style="--c:${c}"><b style="--w:${Math.max(2,Math.min(100,w))}%;--i:${i}"></b></span>`;
const ST={ch:'full',card:'open',dg:'idle',ex:'mind',srch:'off',mem:'retegek',rule:'r1',tools:false,mems:false,probe:false,act:'menu'};

/* ── fejléc + keret (fuel-uveg.html, változatlan; Mezo akcentus) ── */
/* topbar(): a csapatfal-világ globális fejléce */
const back=(to,l,right='')=>`<div class="phead rise"><button class="backbtn glass" ${to[0]==='#'?`data-go="${to}"`:`data-toast="${to}"`}><b>‹</b>${l}</button>${right}</div>`;
const ALL='#osszes';
const hero=(c,ic,eb,h,num,p='',c2='')=>`<div class="pagehero rise" style="--c:${c}${c2?`;--c2:${c2}`:''}">${ic?I(ic,'art'):''}${eb?`<span class="eb">${eb}</span>`:''}<h1>${h}</h1>${num?`<div class="num">${num}</div>`:''}${p?`<p>${p}</p>`:''}</div>`;
const h3=(eb,em='')=>`<div class="h3"><span class="eb">${eb}</span>${em?`<em>${em}</em>`:''}</div>`;
const principle=t=>`<p class="principle2">${t}</p>`;
const fchip=(t,c,ic='',cls='')=>`<span class="flatchip ${cls}" style="--c:${c}">${ic?I(ic):''}${t}</span>`;
const well=(ic,c)=>`<span class="well" style="--c:${c}">${I(ic)}</span>`;
const door=(ic,c,t,s,go)=>`<button class="door" ${go[0]==='#'?`data-go="${go}"`:`data-toast="${go}"`}>${well(ic,c)}<div class="grow"><strong>${t}</strong>${s?`<small>${s}</small>`:''}</div><span class="chev">›</span></button>`;

/* ═════════ BESZÉLGETÉS ═════════ */
const STATUS={full:['élő · Gemini',''],typing:['dolgozom rajta…','busy'],err:['élő · Gemini',''],empty:['új beszélgetés',''],off:['a társ most nem elérhető','off']};
function chatHead(){const [s,k]=STATUS[ST.ch];return `<header class="chhead"><button class="rbtn glass" data-toast="Vissza az Üzenőfalra" aria-label="Vissza">‹</button>
  <div class="who"><span class="well ${k}">${I('chat')}</span><div style="min-width:0"><strong>Mezo</strong><small><i class="${k}"></i>${s}</small></div></div>
  <button class="rbtn glass" data-msheet="picker" aria-label="Beszélgetések">≡</button><button class="rbtn glass" style="--c:var(--lav)" data-st="ch:empty" aria-label="Új beszélgetés">+</button><button class="rbtn glass" data-msheet="actions" aria-label="Műveletek">⋯</button></header>`}
function toolsBlock(){
  const rows=[['sleep','Alvás · tegnap éjjel','hogy lássam, mennyit pihentél','7 óra 4 perc, két ébredés','tick'],
    ['dumbbell','Edzés · Push Day','a tegnapi terhelésért','Lat Pulldown 105 × 9 @ RIR 1, 16 szett','tick'],
    ['pattern','Minták · alvás','van-e friss összefüggés','Nincs friss minta, a régi még nem erős.','info']];
  return `<div class="tools"><button class="tools-h" data-tools><span class="tstack">${I('sleep')}${I('dumbbell')}${I('pattern')}</span>Utánanézett · 3 forrás<em>${ST.tools?'⌃':'⌄'}</em></button>
  ${ST.tools?rows.map(r=>`<div class="trow">${I(r[0])}<div class="grow"><strong>${r[1]}</strong><small>miért: ${r[2]}</small><small class="out">${r[3]}</small></div><span class="st">${I(r[4])}</span></div>`).join(''):''}</div>`}
function memsBlock(){
  return `<div class="memx"><button data-mems>${I('spark')}Emlékek · 2 <span style="color:var(--faint)">${ST.mems?'⌃':'⌄'}</span></button>
  ${ST.mems?[['futás után jobban aludtam','2026-05-18',92],['a push nap után a váll érzékeny','2026-08-03',81]].map(m=>`<div class="memc"><div class="top"><strong>${m[0]}</strong><span class="sim">${m[2]}%</span></div><small>${m[1]}</small>
    <div class="acts2"><button class="minib" data-toast="Köszi, megjegyeztem">Hasznos</button><button class="minib" data-toast="Rendben, ide nem veszem elő">Nem ide tartozik</button><button class="minib warn" data-toast="Biztosan? Többé nem használom ezt az emléket.">Ne használd többé</button></div></div>`).join(''):''}</div>`}
function chat(){
  const a1=`<div class="msg-a glass rise" style="--i:1"><div class="msg-meta">${I('chat')}<b>Mezo</b>06:32</div>
    ${toolsBlock()}
    <p>Jó reggelt. Tegnap a Push Day jól ment: a <b>Lat Pulldown 105 × 9</b> RIR 1-gyel az eddigi legjobbad.</p>
    <p>Hét óra alvás után ma nyugodtan tarthatod a tervezett terhelést, de a vállad miatt a nyomásoknál maradj a megszokott súlynál.</p>
    <div class="mrefs"><span class="eb">AMIRE ÉPÜLT</span><div class="wrapchips">${fchip('Push Day · tegnap','var(--coral)','dumbbell')}${fchip('Lat Pulldown 105 × 9','var(--gold)','record')}${fchip('Alvás 7 ó 4 p','var(--lav)','sleep')}</div></div>
    ${memsBlock()}
    <div class="fbk"><button class="minib" data-toast="Köszi!">${I('thumb-up')}Segített</button><button class="minib" data-toast="Mi nem stimmelt? pontatlan · túl sok · rossz időzítés · nem rólam szól">${I('thumb-down')}Nem talált</button></div></div>`;
  const u1=`<div class="msg-u rise" style="--i:2">Aludtam 7 órát. Érzem, hogy ma jobb, mint tegnap.<small>06:35</small></div>`;
  const a2=`<div class="msg-a glass rise" style="--i:3"><div class="msg-meta">${I('chat')}<b>Mezo</b>06:35${fchip('nem ellenőrzött','var(--gold)','info')}</div>
    <p>Látszik is: a pulzusod reggel három ütéssel lejjebb volt. Ha délután röpi van, ebédnél egyél egy tányér rizst, az kitart a harmadik szettig.</p></div>`;
  let tail='';
  if(ST.ch==='typing')tail=`<div class="typing rise"><span><i></i><i></i><i></i></span>megnézem az adataidat…</div>`;
  if(ST.ch==='err')tail=`<div class="msg-err rise"><b>Nem jött válasz.</b> Az üzeneted nem veszett el.<div class="hrow"><button class="pillx" style="--c:var(--lav)" data-st="ch:typing">Újra</button><button class="pillx ghost" data-toast="Szerkesztés">Szerkesztés</button></div></div>`;
  if(ST.ch==='empty')return chatHead()+`<div class="chempty rise">${I('chat')}<h2>Új beszélgetés</h2><p>Kérdezz bármit a napodról, az edzésről, az evésről.</p></div>
    <div class="qq">${[['sun','Foglald össze a mai napom röviden'],['dumbbell','Mit edzek ma?'],['bowl','Mennyi fehérje hiányzik még?'],['sleep','Miért aludtam rosszul?']].map((q,i)=>`<button class="rise" style="--i:${i+1}" data-st="ch:typing">${I(q[0])}${q[1]}</button>`).join('')}</div>`;
  if(ST.ch==='off')return chatHead()+`<div class="thread"><div class="degr rise">A társ jelenleg nincs bekapcsolva. A korábbi beszélgetéseid megvannak, de most nem tudok válaszolni.</div>${a1}${u1}</div>`;
  return chatHead()+`<div class="thread">${a1}${u1}${a2}${ST.ch==='typing'||ST.ch==='err'?`<div class="msg-u rise">Akkor ma mehet a röpi is?<small>06:37</small></div>`:''}${tail}</div>`;
}
function composer(){const rec=false;return `<div class="composer glass"><button class="cbtn" data-toast="Tartsd nyomva, és mondd el" aria-label="Diktálás">${I('mic')}</button><span class="inp">${ST.ch==='off'?'Most nem elérhető':'Mondj valamit…'}</span><button class="cbtn send" data-st="ch:typing" aria-label="Küldés">${I('send')}</button></div>`}

/* ═════════ COACHING ═════════ */
const RULES=[
  {n:'Terhelés–táplálás',ic:'bowl',s:'act',win:1,why:'7 napos terhelés 412 perc, a kalória a cél 71%-án.',f:[['Mért érték','71%'],['Küszöb','85%']]},
  {n:'Edzés-monotónia',ic:'dumbbell',s:'act',why:'Öt napja ugyanaz a terhelés, pihenőnap nélkül.',f:[['Mért érték','2,4'],['Küszöb','2,0']]},
  {n:'Késői koffein',ic:'flame',s:'pend',why:'Tegnap szólt, két napig pihen, hogy ne ismételje magát.',f:[['Utoljára','szept. 24.'],['Pihen még','1 nap']]},
  {n:'Alvásadósság',ic:'sleep',s:'ok',why:'Az elmúlt 3 éjszaka átlaga rendben van.',f:[['Mért érték','1,0 óra'],['Küszöb','2,0 óra']]},
  {n:'Fehérje-hiány',ic:'protein',s:'ok'},{n:'Súlytrend',ic:'weight',s:'ok'},{n:'Hidratáció',ic:'water',s:'ok'},{n:'Lépésszám',ic:'steps',s:'ok'},
  {n:'Regeneráció',ic:'sprout',s:'ok'},{n:'Napló-csend',ic:'journal',s:'ok'},{n:'Esti képernyő',ic:'moon',s:'ok'},
  {n:'Pulzus-variancia',ic:'heart',s:'mut',why:'Nincs óra-adat az elmúlt 7 napból.'},{n:'Stressz-jelek',ic:'signal',s:'mut'},{n:'Ciklus',ic:'calendar',s:'mut'}];
const SCHIP={act:['Jelzett','var(--coral)','bell'],pend:['Pihenőn','var(--gold)','hold'],ok:['Rendben','var(--sage)','tick'],mut:['Nem mérhető','var(--faint)','info']};
function segRing(){let s=0;const segs=[[14.3,'var(--coral)'],[7.1,'var(--gold)'],[57.1,'var(--sage)'],[21.4,'#6F6356']];
  return `<svg viewBox="0 0 156 156" aria-hidden="true"><circle class="ring-track" cx="78" cy="78" r="66" pathLength="100"/>${segs.map(([v,c],i)=>{const o=`<circle class="ring-prog" cx="78" cy="78" r="66" pathLength="100" style="--p:${v-1.6};--c:${c};--i:${i};stroke-dashoffset:${-s}"/>`;s+=v;return o}).join('')}</svg>`}
function coaching(){
  return topbar()+back(ALL,'Összes funkció')+
  `<div class="pagehero rise" style="--c:var(--gold);--c2:var(--coral)"><span class="eb">PROAKTÍV COACHING · MA</span>
   <div class="vgauge">${segRing()}<div class="ctr">${I('whistle')}<b>3</b><small>JELZÉS</small></div></div>
   <p>14 szabály · ma ennyi szólalt meg</p>
   <div class="vlegend"><span style="--c:var(--coral)"><i></i>2 jelzett</span><span style="--c:var(--gold)"><i></i>1 pihenőn</span><span style="--c:var(--sage)"><i></i>8 rendben</span><span style="--c:#6F6356"><i></i>3 nem mérhető</span></div></div>`+
  h3('A NAP NYERTESE')+
  `<div class="p16"><button class="win glass rise" style="--i:1" data-go="#kartya"><div class="top">${well('bowl','var(--gold)')}<div class="grow"><strong>Terhelés–táplálás</strong><div class="wrapchips" style="margin-top:5px">${fchip('Nyertes','var(--gold)','star')}${fchip('Jelzett','var(--coral)','bell')}</div></div><span class="rank lg">1/14</span></div>
   <p>7 napos terhelés 412 perc, a kalória a cél 71%-án.</p><div class="foot3"><span>Ebből lett a mai kártya</span><b>A napi kártya ›</b></div></button></div>`+
  `<div class="p16" style="margin-top:14px">${door('eye','var(--lav)','Megfigyelő','mind a 14 szabály, súlyossági sorrendben','#megfigyelo')}${door('card','var(--gold)','A napi kártya','Terhelés–táplálás nyerte a napot','#kartya')}</div>`+
  principle('Ez a felület nem dönt: azt mutatja meg, mit döntött ma a motor, és miért.');
}
function ruleTile(r,i){
  const [l,c,ic]=SCHIP[r.s], open=ST.rule==='r'+(i+1), glass=r.s==='act';
  const cls=r.s==='ok'?'ok':r.s==='mut'?'mut':'';
  return `<button class="rule ${glass?'glass':''} ${cls} rise" style="--c:${r.s==='pend'?'var(--gold)':'var(--coral)'};--i:${Math.min(i,8)}" ${r.why?`data-rule="r${i+1}"`:''}>
  <div class="top"><span class="rank">${i+1}</span>${I(r.ic)}<div class="grow"><strong>${r.n}</strong><div class="wrapchips">${r.win?fchip('Nyertes','var(--gold)','star'):''}${fchip(l,c,ic)}</div></div>${r.why?`<span class="chev2">${open?'▴':'▾'}</span>`:''}</div>
  ${r.why&&(glass||open)?`<div class="why">${r.why}</div>`:''}
  ${open&&r.f?`<div class="facts">${r.f.map(f=>`<div><span>${f[0]}</span><b>${f[1]}</b></div>`).join('')}</div>`:''}</button>`}
function megfigyelo(){
  return topbar()+back('#coaching','Coaching')+
  `<div class="pagehero rise" style="--c:var(--lav)">${I('eye','art sm')}<span class="eb">COACHING</span><h1>Megfigyelő</h1><p>3 jelzett · 14 szabály</p>
   <div class="daysw"><button data-toast="Szerda">‹</button><span>ma<small>csütörtök</small></span><button disabled>›</button></div></div>`+
  `<div class="rgrp">MEGSZÓLALT</div><div class="rules">${RULES.slice(0,3).map((r,i)=>ruleTile(r,i)).join('')}</div>`+
  `<div class="rgrp">RENDBEN</div><div class="rules">${RULES.slice(3,11).map((r,i)=>ruleTile(r,i+3)).join('')}</div>`+
  `<div class="rgrp">NEM MÉRHETŐ</div><div class="rules">${RULES.slice(11).map((r,i)=>ruleTile(r,i+11)).join('')}</div>`+
  h3('A NAP VÁLTOZÁSAI')+
  `<div class="mtl rise">${[['09:00','Terhelés–táplálás','A szabály jelzett.'],['09:00','Edzés-monotónia','A szabály jelzett.'],['07:10','Késői koffein','Pihenőre került.']].map(t=>`<div><b>${t[0]}</b><span><em>${t[1]}</em> · ${t[2]}</span></div>`).join('')}</div>`+
  principle('A sorrend maga a döntés: fent az, ami ma a legsürgetőbb.');
}
function kartya(){
  if(ST.card==='none')return topbar()+back('#coaching','Coaching')+hero('var(--gold)','card','COACHING','A napi kártya','')+`<div class="p16"><div class="dash" style="--c:var(--gold);font-size:13px;color:var(--sub);text-align:center">Ma nem érkezett kártya. Egyik szabály sem volt elég sürgős ahhoz, hogy szóljon.</div></div>`;
  return topbar()+back('#coaching','Coaching')+
  hero('var(--gold)','card','COACHING','A napi kártya','','Egy kártya naponta. Ma ez nyert.')+
  `<div class="p16"><div class="dcard glass rise" style="--i:1"><div class="top">${well('bowl','var(--gold)')}<div><span class="eb">TERHELÉS–TÁPLÁLÁS</span><strong>Egyél a terheléshez</strong></div></div>
   <p class="lead2">A heti terhelésed magas, a bevitel viszont a cél alatt maradt. Ma tegyél be egy tisztességes ebédet, és a holnapi edzést vedd egy fokkal lazábbra.</p>
   <div class="facts2"><div><small>7 NAPOS TERHELÉS</small><b>412 perc</b></div><div><small>KALÓRIA A CÉLHOZ</small><b>71%</b></div></div>
   <ul><li>${I('bowl')}Ebédre legalább 600 kcal, benne szénhidrát.</li><li>${I('dumbbell')}Holnap a tervezett szettek 80%-a is elég.</li></ul>
   ${ST.card==='done'?`<div class="applied">${I('tick')}Könnyítettük a holnapot</div>`:`<button class="pillx cta2" style="--c:var(--gold)" data-st="card:done">${I('tick')}Könnyítsd a holnapot</button>`}</div></div>`+
  h3('MIÉRT EZ NYERT')+
  `<div class="p16"><div class="rise" style="--i:2;padding:4px 14px;border-radius:18px;background:rgba(245,239,230,.035);box-shadow:inset 0 0 0 1px var(--hair)">
   ${[['dumbbell','Edzés-monotónia','ugyanolyan súlyos, de tegnap is szólt','rang 2'],['flame','Késői koffein','pihenőn','rang 3'],['sleep','Alvásadósság','alacsonyabb súlyosság','rang 6']].map(l=>`<div class="loser">${I(l[0])}<span><b>${l[1]}</b> · ${l[2]}</span><em>${l[3]}</em></div>`).join('')}</div></div>`+
  principle('Egy kártya naponta: itt az is látszik, mi ellen nyert.');
}

/* ═════════ DIAGNÓZIS ═════════ */
const ASKS=[['Miért vagyok fáradt?','Az alvásod, az edzéseid és az evésed két hetéből keresem az okot.'],['Miért alszom rosszul?','Az esti szokásaid és az alvásnaplód összevetése.'],['Miért mozog a súlyom?','Valódi változás vagy víz és só? Heti számvetéssel.']];
function diagnozis(){
  return topbar()+back(ALL,'Összes funkció')+
  hero('var(--lav)','diagnose','KÉRDÉSEK A MEZÓNAK','Diagnózis','2<small> riport</small>','kérdés → gyanúsítottak bizonyítékkal → próba')+
  `<div class="p16">${ASKS.map((a,i)=>{const busy=ST.dg==='busy'&&i===0;return `<div class="ask glass rise ${busy?'busy':''}" style="--i:${i+1}"><span class="eb">${I('spark')}KÉRDEZD MEG</span><h3>${a[0]}</h3><p>${a[1]}</p>
    <button class="pillx" data-st="dg:${busy?'idle':'busy'}">${I('spark')}${busy?'A két hét adatait olvasom…':'Kérdezd meg most'}</button></div>`}).join('')}</div>`+
  `<p class="quota">napi 3 kérdés · a megnyitás mindig ingyen</p>`+
  h3('TOVÁBBI KÉRDÉSEK')+`<div class="soon rise"><div>Kell most deload?<small>HAMAROSAN</small></div><div>Havi Mezo-riport<small>HAMAROSAN</small></div></div>`+
  h3('KORÁBBI RIPORTOK','2')+
  `<div class="p16">${[['1','Aug 30','Miért vagyok fáradt?','A fáradtság mögött leginkább a rövid alvás áll.','2 gyanúsított · a legerősebb: Alváshiány (erős)'],['2','Szept 7','Miért mozog a súlyom?','A súlyod valóban csökken, a napi ugrálás víz.','2 gyanúsított · a legerősebb: Víz-visszatartás (erős)']].map((r,i)=>`<button class="rep rise" style="--i:${i+4}" data-go="#diag/${r[0]}"><div class="top">${fchip('mérsékelt bizonyosság','var(--lav)','gem')}${r[1]}<span class="chev">›</span></div><strong>${r[2]}</strong><p>${r[3]}</p><small>${r[4]}</small></button>`).join('')}</div>`;
}
const DIAG={
 1:{q:'Miért vagyok fáradt?',win:'Aug 17 – 30 · az utolsó 14 nap adatából',v:'A fáradtság mögött leginkább a rövid alvás áll; a késői edzések csak rátesznek egy lapáttal.',
   s:[{n:'Alváshiány',st:['erős','var(--sage)'],c:'Az utóbbi két hétben átlagosan egy órával kevesebbet aludtál, mint előtte.',ev:[['alváshossz','6,1 h','↓ 1,2','bad','Alvás-napló · 13 nap'],['éjszakai ébredés','3,4','↑ 1,1','bad','Alvás-napló · 13 nap']],pr:['7 nap','Feküdj le hét estén át 23:00 előtt, és figyeljük a reggeli energiádat.']},
      {n:'Késői edzés',st:['mérsékelt','var(--gold)'],c:'A 19:00 utáni edzések utáni éjszakák 25 perccel rövidebbek.',ev:[['esti edzés','4 alkalom','',' ','Edzésnapló · 14 nap'],['alvás utána','5,7 h','↓ 0,6','bad','Alvás-napló · 4 éj']],pr:['14 nap','Két hétig tedd a nehéz napokat 18:00 elé.']}]},
 2:{q:'Miért mozog a súlyom?',win:'Aug 31 – Szept 6 · heti számvetés',v:'A súlyod valóban csökken; a napi ugrálás a só és a víz, nem a zsír.',szam:[['valódi változás','−0,7 kg'],['heti átlag','82,4 kg'],['előző hét','83,1 kg'],['víz-zaj','± 0,9 kg']],
   s:[{n:'Víz-visszatartás',st:['erős','var(--sage)'],c:'A sósabb napok után reggel 0,6–0,9 kg-mal többet mutat a mérleg.',ev:[['sóbevitel','5,8 g','↑ 1,4','bad','Fuel · 7 nap'],['reggeli súly','+0,8 kg','↑','bad','Súlynapló · 3 reggel']],pr:['7 nap','Egy hétig tartsd a sót 4 g alatt, és nézzük a reggeli súlyt.']},
      {n:'Kalória-deficit',st:['mérsékelt','var(--gold)'],c:'Átlagosan napi 420 kcal-lal a karbantartás alatt eszel.',ev:[['napi átlag','2 180 kcal','↓ 420','good','Fuel · 7 nap']],pr:['7 nap','Maradj ennél, és figyeljük a heti átlagot.']}]}};
function diag(id){
  const d=DIAG[id]||DIAG[1];
  const sus=(s,i)=>`<div class="susp ${i===0?'glass':''} rise" style="--i:${i+2};--c:${i===0?'var(--gold)':'var(--lav)'}"><div class="top"><span class="rank ${i===0?'lg':''}">${i+1}</span><strong>${s.n}</strong>${fchip(s.st[0],s.st[1])}</div><p>${s.c}</p>
    <div class="mevs">${s.ev.map(e=>`<div class="mev"><span>${e[0]}</span><b>${e[1]}</b><em class="${e[3]}">${e[2]}</em><small>${e[4]}</small></div>`).join('')}</div>
    <div class="probe">${I('flask')}<div><span class="eb">PRÓBA · ${s.pr[0].toUpperCase()}</span><p>${s.pr[1]}</p></div></div>
    ${i===0&&ST.probe?`<button class="actual" data-toast="A Kísérletek oldalon követed">${I('clock')}Aktív kísérlet lett, a Kísérletek oldalon követed ›</button>`:`<button class="pillx" style="--c:${i===0?'var(--gold)':'var(--lav)'}" ${i===0?'data-probe':'data-toast="Elindítva: aktív kísérlet lett"'}>${I('tick')}Próbáljuk ki</button>`}</div>`;
  return topbar()+back('#diagnozis','Diagnózis')+
  `<div class="vhero rise">${I('diagnose','art')}<span class="eb">${d.win.toUpperCase()}</span><h1>${d.q}</h1><p class="verdict">${d.v}</p>
   <span class="cert">${I('gem')}mérsékelt bizonyosság<i></i></span></div>`+
  (d.szam?h3('SZÁMVETÉS')+`<div class="szamv rise">${d.szam.map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>`:'')+
  h3('GYANÚSÍTOTTAK','erősség szerint')+`<div class="p16">${d.s.map(sus).join('')}</div>`+
  `<p class="quota">azóta új adatod érkezett a riport ablakában</p>`;
}

/* ═════════ EMLÉKEK ═════════ */
const DAYS=[['2026-08-12','12','AUG','Erős pull-nap volt: a Chest Supported Row 3×8-ra ment, és délután is maradt energia. Este korán feküdtél, 7 óra 40 perc lett belőle, a reggeli pulzus is lejjebb ment.'],
  ['2026-08-11','11','AUG','Pihenőnap, sok séta. Ebédnél kimaradt a fehérje, este pótoltad. A napló szerint feszült voltál a munka miatt, de a lefekvés így is 23:00 előtt volt.'],
  ['2026-08-10','10','AUG','Röpi este, három szett, a harmadikban elfogyott a lendület. Utána későn vacsoráztál, az alvás felszínes lett.']];
const SIM=[['2026-08-09',88,'Rossz alvás a késő esti edzés után; másnap nehezebben indult a nap.'],['2026-07-28',79,'Rövid éjszaka röpi után, reggel fáradtság, délutánra rendbe jött.'],['2026-07-14',71,'Hosszú edzés, késői vacsora, két ébredés.']];
const search=()=>`<div class="srch rise">${I('lens')}<span class="${ST.srch==='on'?'val':''}">${ST.srch==='on'?'rossz alvás edzés után':'Milyen napot keresel? (pl. rossz alvás edzés után)'}</span><button class="pillx" data-st="srch:on">Keresés</button></div>`+
  (ST.srch==='on'?`<div class="simh">3 hasonló nap a memóriából</div><div class="p16">${SIM.map((s,i)=>`<button class="simrow rise" style="--i:${i}" data-go="#emlek"><span class="rw">${ring(s[1],'var(--lav)',32,80)}<span class="ctr"><b>${s[1]}</b></span></span><div class="grow"><strong>${s[0]} · ${[47,59,73][i]} napja</strong><small>${s[2]}</small></div><span class="chev">›</span></button>`).join('')}</div>`:'');
function emlekek(){
  return topbar()+back('Üzenőfal (már üvegben, a csapatfal-programból)','Üzenőfal')+
  hero('var(--lav)','album','','Emlékek','','A napjaid és a közös történetünk')+
  `<div class="p16"><button class="memo glass rise" style="--i:1" data-go="#memoar"><div class="top">${I('scroll')}<div><span class="eb">HETI MEMOÁR · HÉT 20 · MÁJ 11–17</span><span class="ttl">Egy hét, amikor a tested megtanult várni</span></div></div>
   <p class="ex">Hétfőn még úgy indultál, mintha minden nap csúcsnap lenne. Szerdára a tested szólt: a guggolás nem ment, az alvás rövid volt. Csütörtökön pihenőt tartottál, és pénteken jött a hét legjobb edzése.</p><span class="go">Memoár olvasása ›</span></button>
   <div style="margin-top:10px">${door('scroll','var(--lav)','Memoár · archívum','6 fejezet','#archivum')}</div></div>`+
  h3('NAPI EMLÉKEK','éjszakai összefoglalók')+
  `<div class="p16">${DAYS.map((d,i)=>`<button class="drow rise" style="--i:${i+2}" data-go="#emlek"><span class="dblk"><b>${d[1]}</b><small>${d[2]}</small></span><div class="grow"><p>${d[3]}</p><em>A nap története ›</em></div></button>`).join('')}</div>`+
  h3('HASONLÓ NAPOK KERESÉSE')+search()+
  `<div class="p16" style="margin-top:14px">${door('calendar','var(--rose)','Heti értékelés','az Én · Hét oldalán','Heti értékelés (az Én I körében kész)')}${door('layers','var(--lav)','Memória','rétegek és audit','#memoria')}</div>`;
}
function emlek(){
  return topbar()+back('#emlekek','Emlékek')+
  hero('var(--gold)','album','NAPI EMLÉK','2026. augusztus 12.','')+
  `<div class="article glass rise" style="--i:1"><span class="eb">KEDD · 2026-08-12</span><div class="prose"><p>Erős pull-nap volt: a Chest Supported Row 3×8-ra ment, és délután is maradt energia. A napló szerint a munka is jól haladt, és egyszer sem kellett kávé 14 óra után.</p><p>Este korán feküdtél, 7 óra 40 perc lett belőle, a reggeli pulzus is lejjebb ment. Ez volt a hét legnyugodtabb éjszakája.</p></div>
   <p class="note2">Boop éjszakai összefoglalója a rögzített napodról.</p></div>`+
  `<div class="pager" style="margin-top:14px"><button data-toast="2026-08-11"><small>‹ KORÁBBI EMLÉK</small><strong>2026-08-11</strong></button><button class="r" data-toast="2026-08-13"><small>KÖVETKEZŐ EMLÉK ›</small><strong>2026-08-13</strong></button></div>`+
  `<div class="p16" style="margin-top:10px">${door('album','var(--gold)','Emlékek','összes nap','#emlekek')}</div>`;
}

/* ═════════ KÍSÉRLETEK ═════════ */
const EXP=[
  {s:'aktiv',t:'Glikogén-feltöltés röpi előtt',h:'Ha röpi előtt 3 órával 80 g szénhidrátot eszel, a harmadik szettben is megmarad a robbanékonyság.',d:4},
  {s:'aktiv',t:'Korábbi vacsora',h:'Ha 19:30 előtt vacsorázol, mélyebb és hosszabb az alvásod.',d:2},
  {s:'javaslat',t:'Reggeli napfény 10 perc',h:'A reggeli fény korábbra tolja az esti elalvást.'},
  {s:'megerosit',t:'Kreatin 5 g naponta',o:'3/4 mérés'},{s:'nemigaz',t:'Hideg zuhany edzés után',o:'a regeneráció nem változott'},
  {s:'nemert',t:'Esti magnézium',o:'kevés alvás-adat'},{s:'elvetve',t:'16:8-as időablak'}];
const EXS={aktiv:['Aktív','var(--gold)','clock'],javaslat:['Javaslat','var(--lav)','bulb'],megerosit:['Megerősítve','var(--sage)','tick'],nemigaz:['Nem igazolódott','var(--coral)','down'],nemert:['Nem értékelhető','var(--faint)','info'],elvetve:['Elvetve','var(--faint)','skip']};
function kiserletek(){
  const f=ST.ex, pass=e=>f==='mind'||(f==='aktiv'&&e.s==='aktiv')||(f==='javaslat'&&e.s==='javaslat')||(f==='lezart'&&!['aktiv','javaslat'].includes(e.s));
  const list=f==='ures'?[]:EXP.filter(pass);
  const card=(e,i)=>{const [l,c,ic]=EXS[e.s];
    if(e.s==='aktiv')return `<div class="exp glass rise" style="--i:${i+2}" data-toast="Egy kísérlet oldala — már üvegben kész"><div class="top">${well('clock','var(--gold)')}<div class="grow">${fchip(l,c,ic)}</div><em>${e.d}/7 nap</em></div><strong class="t">${e.t}</strong><p>${e.h}</p>
      <div class="ddots">${[...Array(7)].map((_,k)=>`<i class="${k<e.d?'on':k===e.d?'now':''}"></i>`).join('')}</div></div>`;
    if(e.s==='javaslat')return `<div class="exp rise" style="--i:${i+2};--c:var(--lav)"><div class="top">${I('bulb')}<div class="grow">${fchip(l,c,ic)}</div><em>7 nap</em></div><strong class="t">${e.t}</strong><p>${e.h}</p>
      <div class="dec"><button class="pillx" style="--c:var(--lav)" data-toast="Elfogadva — holnap indul">${I('tick')}Elfogadom</button><button class="pillx ghost" data-toast="Elvetve">${I('skip')}Elvetem</button></div></div>`;
    return `<button class="exp rise" style="--i:${i+2}" data-toast="Egy kísérlet oldala — már üvegben kész"><div class="top">${I('flask')}<div class="grow">${fchip(l,c,ic)}</div><span class="chev">›</span></div><strong class="t">${e.t}</strong>${e.o?`<div class="outc">${e.o}</div>`:''}</button>`};
  return topbar()+back(ALL,'Összes funkció')+
  hero('var(--gold)','flask','A SAJÁT TESTEDEN BIZONYÍTJUK','N=1 kísérletek','2<small> fut most</small>')+
  `<div class="chips">${[['mind','Mind',7],['aktiv','Aktív',2],['javaslat','Javaslat',1],['lezart','Lezárt',4]].map(c=>`<button class="flat ${f===c[0]?'on':''}" style="--c:var(--gold)" data-st="ex:${c[0]}">${c[1]} <b>${c[2]}</b></button>`).join('')}</div>`+
  (list.length?`<div class="p16">${list.map(card).join('')}</div>`:`<div class="p16"><div class="dash rise" style="--c:var(--gold);font-size:13px;color:var(--sub);line-height:1.5">${I('sprout','xs')} Tanulom, mi működik nálad. Az első kísérletet akkor javaslom, ha lesz elég adatom egy jó kérdéshez.</div></div>`)+
  `<div class="p16" style="margin-top:12px"><button class="dashbtn" style="--c:var(--gold)" data-toast="Mezo gondolkodik egy új kísérleten…">${I('bulb')}Új kísérletet javasol Mezo</button></div>`;
}

/* ═════════ MEMOÁR ═════════ */
const MCH=[['május 2026',[[20,'Máj 11 – 17','Egy hét, amikor a tested megtanult várni','Hétfőn még úgy indultál, mintha minden nap csúcsnap lenne. Szerdára a tested szólt.',6],[19,'Máj 4 – 10','Amikor az alvás előre szólt','Kedd éjjel 5,7 óra, és szerdán már a bemelegítésnél látszott, hogy ez nem az a nap.',5]]],
  ['április 2026',[[18,'Ápr 27 – Máj 3','Az első közös korrekció','Ezen a héten először mondtad, hogy nem értesz egyet, és igazad lett.',4],[17,'Ápr 20 – 26','Lassabban, de tovább','A futások rövidültek, a hét mégis a legerősebb lett.',5],[16,'Ápr 13 – 19','A hét, amikor visszajött az étvágy','Három hét után először maradt el a délutáni nassolás.',3]]],
  ['március 2026',[[15,'Márc 30 – Ápr 5','Az első fejezet','Még alig ismertük egymást. Ezen a héten kezdtük.',2]]]];
function memoar(){
  return topbar()+back('Üzenőfal (már üvegben, a csapatfal-programból)','Mezo')+
  hero('var(--lav)','scroll','','Memoár','','A közös történetünk, hétről hétre')+
  `<div class="article lav glass rise" style="--i:1"><span class="eb">HETI MEMOÁR · HÉT 20 · 2026 · MÁJ 11–17</span><span class="ttl">Egy hét, amikor a tested megtanult várni</span>
   <div class="prose"><p class="drop">Hétfőn még úgy indultál, mintha minden nap csúcsnap lenne. Szerdára a tested szólt: a guggolás nem ment, az alvás rövid volt, és a reggeli pulzus is feljebb kúszott.</p>
   <p>Csütörtökön pihenőt tartottál, pedig a terv mást mondott. Pénteken jött a hét legjobb edzése: a Chest Row 102,5 × 9 új csúcs lett.</p>
   <p>Ez volt az első hét, amikor a várás nem kimaradás volt, hanem döntés.</p></div>
   <div class="anch"><span class="eb">HORGONYOK</span><div class="wrapchips">${fchip('Chest Row 102,5 × 9','var(--gold)','record')}${fchip('D1 reggel · pihenve','var(--sky)','syringe')}${fchip('Alvás 7,8 h szombat','var(--lav)','sleep')}</div></div>
   <div class="fbk"><button class="minib" data-toast="Köszi!">${I('thumb-up')}Talált</button><button class="minib" data-toast="Mi nem stimmelt?">${I('thumb-down')}Nem ilyen volt</button></div></div>`+
  `<div class="anniv rise" style="--i:2;margin-top:12px">${I('calendar')}<div><span class="eb">ÉVFORDULÓ · 1 HÓNAP</span><p>Egy hónapja kezdtük tudatosan korábbra tolni a vacsorát. Azóta 18 este sikerült.</p></div></div>`+
  `<div class="p16" style="margin-top:12px">${door('scroll','var(--lav)','Archívum','a korábbi fejezetek · 6','#archivum')}</div>`;
}
function archivum(){
  return topbar()+back('#memoar','Memoár')+
  hero('var(--lav)','scroll','MEMOÁR · ARCHÍVUM','Minden fejezet','6<small> fejezet</small>','3 hónap közös történet')+
  MCH.map(([m,rows],g)=>`<div class="mhead rise"><strong>${m}</strong><small>${rows.length} fejezet</small></div><div class="p16">${rows.map((r,i)=>`<button class="chap rise" style="--i:${g*2+i}" data-go="#fejezet/${r[0]}"><span class="wkb"><small>HÉT</small><b>${r[0]}</b></span><div class="grow"><div class="meta2"><span>${r[1]}</span><span>${I('anchor','xs')}${r[4]}</span></div><strong>${r[2]}</strong><p>${r[3]}</p></div></button>`).join('')}</div>`).join('');
}
function fejezet(id){
  const all=MCH.flatMap(c=>c[1]), k=Math.max(0,all.findIndex(r=>String(r[0])===String(id))), r=all[k], prev=all[k+1], next=all[k-1];
  return topbar()+back('#archivum','Archívum')+
  `<div class="pagehero rise" style="--c:var(--lav)"><span class="eb">HETI MEMOÁR</span><h1>Hét ${r[0]}</h1><p>${r[1]} · 2026</p></div>`+
  `<div class="article lav glass rise" style="--i:1"><span class="eb">HÉT ${r[0]}</span><span class="ttl">${r[2]}</span>
   <div class="prose"><p class="drop">${r[3]} A hét elején még minden a terv szerint ment, aztán egy rövid éjszaka mindent átrendezett.</p><p>Ami ebből megmaradt: a tested előbb szól, mint a mérleg vagy a napló. Érdemes rá hallgatni.</p></div>
   <div class="anch"><span class="eb">MIBŐL ÍRÓDOTT</span><div class="wrapchips">${fchip('5,7 h kedd éjjel','var(--lav)','sleep')}${fchip('Guggolás kimaradt','var(--coral)','dumbbell')}${fchip('Napló · szerda','var(--sage)','journal')}</div></div>
   <div class="fbk"><button class="minib" data-toast="Köszi!">${I('thumb-up')}Talált</button><button class="minib" data-toast="Mi nem stimmelt?">${I('thumb-down')}Nem ilyen volt</button></div></div>`+
  `<div class="pager" style="margin-top:14px">${prev?`<button data-go="#fejezet/${prev[0]}"><small>‹ ELŐZŐ</small><strong>Hét ${prev[0]}</strong><span>${prev[2]}</span></button>`:`<button class="ghost" disabled></button>`}${next?`<button class="r" data-go="#fejezet/${next[0]}"><small>KÖVETKEZŐ ›</small><strong>Hét ${next[0]}</strong><span>${next[2]}</span></button>`:`<button class="ghost" disabled></button>`}</div>`;
}

/* ═════════ MEMÓRIA ═════════ */
function memoria(){
  const tab=ST.mem;
  const layer=(c,ic,eb,t,num,unit,chips,go)=>`<button class="layer glass rise" style="--c:${c}" ${go?(go[0]==='#'?`data-go="${go}"`:go):''}><div class="top">${well(ic,c)}<div class="grow"><span class="eb">${eb}</span><strong>${t}</strong></div><b>${num}<small>${unit}</small></b></div>${chips?`<div class="wrapchips">${chips.map(x=>fchip(x,c)).join('')}</div>`:''}</button>`;
  const flow=t=>`<div class="flow"><i></i>${t}<i></i></div>`;
  let body='';
  if(tab==='retegek')body=`<div class="p16">${layer('var(--gold)','signal','L0 · NYERS ADAT','Minden, amit rögzítesz','47','/60 nap')}${flow('napi összefoglaló · minden nap 02:20')}
    ${layer('var(--sky)','journal','L1 · EPIZODIKUS NAPLÓ','Napi emlékek','38','nap',['112 chat-vektor','2026-07-01 – 2026-08-12'],'data-st="mem:naplo"')}${flow('mintakeresés · hetente')}
    ${layer('var(--coral)','pattern','L2 · ÍTÉLET-INBOX','Minták, amikről te döntesz','6','minta',['3 statisztikai · megerősített','2 függő tényjelölt'],'data-toast="Üzenőfal (már üvegben)"')}${flow('megerősítés után')}
    ${layer('var(--lav)','brain','L3 · TARTÓS TUDÁS','Amit biztosan tudok rólad','15','tény',['168× megerősítés','14 a promptban'],'data-toast="Tudástár (a Mezo II körében)"')}</div>
    <div class="p16" style="margin-top:12px">${door('lens','var(--lav)','Miért nem lát még mintát a motor?','a minták oldalán','Minták (a Mezo II körében)')}</div>`;
  if(tab==='naplo')body=`<div class="mhead"><strong>augusztus 2026</strong><small>38 nap</small></div><div class="p16">${DAYS.map((d,i)=>`<div class="jday rise ${i===0?'focus':''}" style="--i:${i}"><i class="vd ${i===2?'off':''}"></i><span class="dblk" style="--c:var(--lav)"><b style="color:#E6DDFF">${d[1]}</b><small>${d[2]}</small></span><div class="grow"><strong>${['augusztus 12., kedd','augusztus 11., hétfő','augusztus 10., vasárnap'][i]}</strong><p>${d[3]}</p></div></div>`).join('')}</div>
    <p class="quota">${fchip('kereshető','var(--sage)')} ${fchip('még nincs vektor','var(--faint)','','is-dim')}</p>`;
  if(tab==='kereso')body=`<div style="padding-top:8px">${search()}</div>`;
  if(tab==='audit')body=`<div class="p16"><div class="audit glass rise"><span class="eb">LLM-HASZNÁLAT · 30 NAP</span><div class="big"><b>$0,042</b><small>ennyibe került az emlékezet</small></div>
    <div class="tcols">${[40,62,35,80,55,48,90,30,66,72,44,58,38,84].map((h,i)=>`<span><i style="--c:var(--lav);--h:${h}%;--i:${i}"></i><i style="--c:var(--sage);--h:${Math.round(h*.35)}%;--i:${i}"></i></span>`).join('')}</div>
    <div class="tleg"><span style="--c:var(--lav)"><i></i>bemenet</span><span style="--c:var(--sage)"><i></i>kimenet</span></div>
    <div class="foot2"><span><b>214</b> hívás</span><span>bemenet <b>41,2k</b></span><span>kimenet <b>9,8k</b></span></div></div>
    <div style="margin-top:12px">${door('brain','var(--lav)','Tudástár','tények és eredetük','Tudástár (a Mezo II körében)')}</div></div>`;
  return topbar()+back('Üzenőfal (már üvegben, a csapatfal-programból)','Mezo')+
  `<div class="pagehero rise" style="--c:var(--lav)"><span class="eb">MEMÓRIA</span><div class="memring">${ring(78,'var(--lav)',66,150)}<div class="ctr"><b>47<small>/60</small></b><span>MÉRT NAP</span></div></div><p>ennyi nap van a minta-ablakban</p></div>`+
  `<div class="mseg"><div class="seg">${[['retegek','Rétegek'],['naplo','Napló'],['kereso','Kereső'],['audit','Audit']].map(t=>`<button class="${tab===t[0]?'on':''}" data-st="mem:${t[0]}">${t[1]}</button>`).join('')}</div></div>`+body;
}

/* ═════════ ÚJ IKONOK ═════════ */
function ikonok(){
  const N=[['whistle','Coaching','a coaching áttekintő hőse','var(--gold)'],['eye','Megfigyelő','a megfigyelő hőse és ajtaja','var(--lav)'],['card','A napi kártya','a kártya oldala, az áttekintő ajtaja','var(--gold)'],
    ['diagnose','Diagnózis','a diagnózis hőse és a riportok','var(--lav)'],['album','Emlékek','az Emlékek és a napi emlék hőse','var(--gold)'],['layers','Memória','a memória-rétegek, a Memória ajtaja','var(--lav)'],['pencil','Átnevezés','a beszélgetés műveletei','var(--gold)']];
  return topbar()+back('#chat','Beszélgetés')+
  `<div class="eyeb rise"><span><span class="eb">A 8. SZELET</span><h2>Új ikonok</h2></span><span class="meta">${N.length} új</span></div>
  <p class="lead">Ezek eddig nem voltak a 3D-s készletben. Jóváhagyás után a közös készletbe kerülnek, és a későbbi körök is ezeket használják.</p>
  <div class="icgrid">${N.map((n,i)=>`<div class="iccard glass rise" style="--c:${n[3]};--i:${i}">${I(n[0])}<strong>${n[1]}</strong><small>${n[2]}</small></div>`).join('')}</div>`+
  h3('A MEGLÉVŐ KÉSZLETBŐL, ÚJ HELYEN')+
  `<div class="p16"><div class="card glass" style="--c:var(--lav)"><div class="wrapchips">${[['chat','Mezo, a beszélgetés'],['sleep','Alvás-forrás'],['pattern','Minta-forrás'],['spark','Emlékek a válaszban'],['bell','Jelzett szabály'],['hold','Pihenőn'],['star','Nyertes'],['gem','Bizonyosság'],['flask','Próba, kísérlet'],['bulb','Javaslat'],['down','Nem igazolódott'],['scroll','Memoár'],['anchor','Horgonyok'],['calendar','Évforduló'],['signal','L0 · nyers adat'],['brain','L3 · tartós tudás'],['lens','Keresés']].map(m=>fchip(m[1],'var(--lav)',m[0])).join('')}</div>
  <p class="quiet" style="padding:10px 2px 0">A régi jelek (✦ ◆ ◇ ◐ ◯ ◌ ✓ ⌕ 👍 👎 és a vonalas ikonok) mind ezekre cserélődnek. A chat fejlécének ≡ + ⋯ gombjai és a ‹ › nyilak jelek maradnak, ahogy a keretben is.</p></div></div>`;
}

/* ── lapok (alulról) ─────────────────────────────────────── */
const x=`<button class="x" data-closesheet aria-label="Bezár">✕</button>`;
const SH={
  picker:['var(--lav)',()=>`<div class="shh">${I('chat')}<div class="grow"><span class="eb">BESZÉLGETÉSEK</span><h3>4 korábbi beszélgetés</h3></div>${x}</div>
    <div class="pick"><button class="optrow newrow" data-st="ch:empty">${I('chat')}<div class="grow"><strong>Új beszélgetés</strong></div></button>
    ${[['Reggeli átnézés','ma · 06:32',1],['Röpi előtti evés','tegnap',0],['Váll és nyomások','szept. 21.',0],['Alvás és koffein','szept. 18.',0]].map(r=>`<div class="optrow ${r[2]?'on':''}"><div class="grow"><strong>${r[0]}</strong><small>${r[1]}</small></div>${r[2]?I('tick','xs'):''}<button class="more" data-msheet="actions">⋯</button></div>`).join('')}</div>`],
  actions:['var(--lav)',()=>`<div class="shh">${I('chat')}<div class="grow"><span class="eb">BESZÉLGETÉS</span><h3>Reggeli átnézés</h3></div>${x}</div>
    ${ST.act==='rename'?`<label class="field"><span>ÚJ NÉV</span><span class="inp">Reggeli átnézés</span></label><div class="pair" style="padding:16px 0 0"><button class="pillx ghost" data-act="menu" style="justify-content:center">Mégse</button><button class="pillx" style="--c:var(--lav);justify-content:center" data-toast="Átnevezve">${I('tick')}Mentés</button></div>`
    :ST.act==='delete'?`<div class="confirm">Biztosan törlöd? A beszélgetés és minden üzenete eltűnik, ezt nem lehet visszacsinálni.</div><div class="pair" style="padding:14px 0 0"><button class="pillx ghost" data-act="menu" style="justify-content:center">Mégse</button><button class="pillx" style="--c:var(--coral);justify-content:center" data-toast="Törölve">${I('trash')}Törlöm</button></div>`
    :`<div class="mrows"><button data-act="rename">${I('pencil')}<span><strong>Átnevezés</strong></span></button><button class="warnr" data-act="delete">${I('trash')}<span><strong>Törlés</strong></span></button></div>`}`],
};
function openSheet(k){if(k==='actions'&&!$('#sheet').classList.contains('on'))ST.act='menu';const [c,f]=SH[k];const s=$('#sheet');s.style.setProperty('--c',c);
  s.innerHTML=`<div class="grab"></div><div class="u8">`+f()+`</div>`;$('#scrim').classList.add('on');s.classList.add('on');s.scrollTop=0}
function closeSheet(){$('#sheet').classList.remove('on');$('#scrim').classList.remove('on')}

