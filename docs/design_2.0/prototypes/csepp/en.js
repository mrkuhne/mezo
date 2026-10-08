/* csepp/en.js — Én domain (Hol tartok · Test · Célok · Napló + minden al-oldal, lapok, beállítások). Built on window.K (see csepp/README.md).
   Route names = the living prototype's VW table (elo/en.html). Trend-first (MacroFactor / BWS): the smoothed trend is the headline, raw points are texture. */
(function(){
const {I,T,csepp,page,back,register,css,mchp,circ}=K;
/* the shell's icon map lacks the three Én tab symbols; extend the mapping at runtime (additive only) */
if(typeof TD==='object'){TD['i-weight']='t-weight';TD['i-target']='c-i-cel';TD['i-hub']='c-i-emberek'}
const E='.phone[data-v="ajanlott"][data-d="en"]';
const S={period:'30d',swin:'7d',celv:'het',wk:0,dp:false,df:false,life:false,pf:'mind',tit:'letra',dec:'open'};
const fmt=v=>v.toFixed(1).replace('.',',');
const pg=(inner,tab,opt)=>page(inner,'en',tab,opt);
const op=(eb,inner,i=0,cls='')=>`<section class="open rise ${cls}" style="--i:${i}">${eb?`<span class="eb">${eb}</span>`:''}${inner}</section>`;
const hg=(inner,i=1,cls='')=>`<section class="card hg rise ${cls}" style="--i:${i}">${inner}</section>`;
const ic=n=>!n?'':n.startsWith('i-')?I(n):T(n);
const ln=(n,t,s,v,attr='',chev=true)=>`<div class="ln ${attr?'tap':''}" ${attr}>${ic(n)}<span class="g">${t}${s?`<small>${s}</small>`:''}</span>${v?`<span class="v">${v}</span>`:''}${chev&&attr?I('i-chev','chev'):''}</div>`;
const big=(n,v)=>`<div class="big"><span class="num">${n}</span>${v?`<span class="v">${v}</span>`:''}</div>`;
const fn=(t,i=9)=>`<p class="fn p16 rise" style="--i:${i};padding:0 16px 10px">${t}</p>`;
const segq=(items,cur,mk)=>`<div class="segq">${items.map(([k,l])=>`<button class="${k===cur?'on':''}" ${mk(k)}>${l}</button>`).join('')}</div>`;
const d7=a=>`<span class="d7">${a.map(x=>`<i class="${x}"></i>`).join('')}</span>`;
const arr=a=>`<span class="arr">${a}</span>`;
const fld=(l,v,ph)=>`<label class="fld"><span class="eb">${l}</span><span class="inp ${ph?'ph':''}">${v}</span></label>`;
const ta=(l,v,ph)=>`<label class="fld"><span class="eb">${l}</span><span class="inp ta ${ph?'ph':''}">${v}</span></label>`;
const tgl=(on,label)=>`<button class="tgl ${on?'on':''}" data-en="tgl" aria-label="${label}"></button>`;
const rng=(p,sub,cls='')=>`<div class="ring ${cls}" style="--c:var(--acc)"><svg viewBox="0 0 88 88"><circle class="t" cx="44" cy="44" r="38"/><circle class="p" cx="44" cy="44" r="38" style="--d:${(circ(38)*(p||0)/100).toFixed(1)}"/></svg><div class="c"><span><b>${p||'—'}</b><small>${sub}</small></span></div></div>`;
const gl=(x,y,t,anchor='start')=>`<text class="gl" x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;
const curve=P=>{let d=`M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;for(let i=0;i<P.length-1;i++){const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;d+=` C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)} ${(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)} ${(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`}return d};
const cells=a=>`<div class="cells9">${a.map(([n,u,l,att])=>`<span class="${att?'att':''}"><b>${n}${u?`<i>${u}</i>`:''}</b><small>${l}</small></span>`).join('')}</div>`;

/* ── adatok (az élő mock alapján: data/me, data/lifegoal) ─────── */
const DIM={er:['Érzelem','t-heart'],el:['Elmélyülés','t-book'],ka:['Kapcsolatok','t-people'],ert:['Értelem','t-compass'],te:['Teljesítmény','t-record'],eg:['Egészség','t-sprout']};
const GOALS=[
  {id:'hustle',t:'Side hustle',d:['te','el'],arrow:'↗',dots:['hit','hit','part','hit','miss','hit','hit'],ma:'2/3 ma'},
  {id:'kocka',t:'Kockahas',d:['eg','te'],arrow:'→',dots:['hit','part','hit','hit','part','miss','hit'],ma:'3/5 ma'},
  {id:'baratno',t:'Az utolsó barátnő',d:['ka','er'],arrow:'↗',dots:['hit','nd','hit','part','hit','hit','nd'],ma:'1/2 ma'}];
const word=a=>a==='↗'?'emelkedik':a==='→'?'tartja':'figyelmet kér';
const TONE={jo:'Jó',ok:'OK',vegyes:'Vegyes',nehez:'Nehéz'};
const PEOPLE=[{id:'petra',n:'Petra',r:'Élettárs · Napi',t:'jo',w:3,all:41,sp:[6,8,7,9,8,9,10]},
  {id:'bence',n:'Bence',r:'Csapattárs · röpi',t:'nehez',w:2,all:14,sp:[8,7,7,5,4,4,3]},
  {id:'adam',n:'Ádám',r:'Mentee · Mizu Velünk',t:'ok',w:1,all:9,sp:[5,6,5,6,6,5,6]},
  {id:'reka',n:'Réka',r:'Mentee · Mizu Velünk',t:'vegyes',w:1,all:7,sp:[6,5,7,4,6,5,5]},
  {id:'mark',n:'Márk',r:'Mentee · Mizu Velünk',t:'ok',w:0,all:5,sp:[5,5,6,5,4,4,4]},
  {id:'anyu',n:'Anya',r:'Család · Heti',t:'jo',w:1,all:12,sp:[7,7,8,7,8,8,8]}];
const av=(p,cls='')=>`<span class="av ${cls} ${p.t==='nehez'?'att':''}">${p.n[0]}</span>`;
const spark=(v,w=64,h=22)=>{const lo=Math.min(...v),hi=Math.max(...v);return `<svg class="spark" viewBox="0 0 ${w} ${h}"><path d="${v.map((a,i)=>`${i?'L':'M'}${(i/(v.length-1)*w).toFixed(1)} ${(h-2-(a-lo)/((hi-lo)||1)*(h-4)).toFixed(1)}`).join('')}" style="fill:none;stroke:var(--sub);stroke-width:1.5;stroke-linecap:round"/></svg>`};

/* ═══════════ HOL TARTOK ═══════════ */
const strip=full=>`<button class="strip rise" data-go="novekedes" aria-label="Daniel · Fejlődés"><span class="av">D</span><span class="g"><b>Daniel</b>${full?' · A kitartó · Lv 12 · 3 140 XP · 240 érme':' · az első napjaid · Lv 1'}</span>${I('i-chev','chev')}</button>`;
const ELV={w:[82.2,81.9,82.0,81.4,81.1,80.6,79.9,80.2,79.7,79.3,78.9,78.4],s:[6.6,6.9,7.0,6.4,7.2,7.1,6.8,7.3,7.0,7.2,6.9,7.1],
  st:[[0,'Tempó átállítva','júl. 8.','Heti −0,4 kg-ra lassítottad a tempót — azóta egyenletes.'],[6,'Új mélypont · 80 kg alatt','aug. 19.','Először mértél 80 kg alatti heti átlagot.'],[8,'Új képesség: Páncélzat','szept. 2.','10 hét töretlen — sérülésállóság nő.'],[11,'Új mélypont','szept. 24.','78,4 kg — a 12 hét legalacsonyabb átlaga.']]};
const ELVR=[82.2,81.6,81.0,80.4,79.8,79.2,78.4,77.6,76.5,75.4,74.1,72.9];
function elvChart(state){
  const reached=state==='reached', proj=state==='proj', w=reached?ELVR:ELV.w;
  const W=300,H=108,x0=4,xp=W-30,x1=proj?xp-60:xp,lo=72.2,hi=82.8;
  const X=i=>x0+i*(x1-x0)/11, Y=v=>6+(hi-v)/(hi-lo)*(H-12);
  const P=w.map((v,i)=>[X(i),Y(v)]), last=P[11], ty=Y(73);
  const st=reached?[ELV.st[0],ELV.st[1],ELV.st[2],[11,'Cél elérve','szept. 24.','72,9 kg — a célsáv alá értél.']]:ELV.st;
  return `<svg viewBox="0 0 ${W} ${H+16}" role="img" aria-label="Életvonal: 12 hét, 82,2 → ${fmt(w[11])} kg${reached?'':', cél 73,0'}">
    ${[82,79,76].map(v=>`<line x1="${x0}" x2="${xp}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" style="stroke:var(--hair)"/>${gl(W,(Y(v)+3).toFixed(1),v,'end')}`).join('')}
    <line x1="${x0}" x2="${xp}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" style="stroke:var(--faint);stroke-dasharray:3 4"/>${gl(W,(ty+3).toFixed(1),'cél','end')}
    <path d="${curve(P)}" style="fill:none;stroke:var(--acc);stroke-width:2;stroke-linecap:round"/>
    ${proj?`<path d="M${last[0].toFixed(1)} ${last[1].toFixed(1)} L${xp} ${ty.toFixed(1)}" style="fill:none;stroke:var(--acc);stroke-width:1.5;stroke-dasharray:2 4;opacity:.75"/>`:''}
    ${st.map(s=>{const p=P[s[0]];return `<g data-toast="${s[1]} · ${s[2]} — ${s[3]}" role="button" aria-label="${s[1]} · ${s[2]}"><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="11" style="fill:transparent"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" style="fill:var(--page);stroke:var(--ink);stroke-width:1.3"/></g>`}).join('')}
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" style="fill:var(--acc)"/>
    ${gl(x0,H+14,'júl. 8.')}${gl(X(6).toFixed(1),H+14,'aug. 19.','middle')}${gl(x1.toFixed(1),H+14,'szept. 24.','end')}
  </svg>`;
}
function elv(state){
  if(state==='empty') return `<p class="txt sub">Még kevés a mérés — két mérés után rajzolódik ki az életvonalad.</p><div class="act"><button class="btn sm" data-sheet="weight">Mérj most</button></div>`;
  const reached=state==='reached';
  return `<div class="ln tap" style="border-top:0;padding:0 0 6px" data-go="test">${big(reached?'−9,3':'−3,8','kg · 12 hét')}<span class="v" style="margin-left:auto;white-space:normal;text-align:right"><b>${reached?'72,9':'78,4'} kg</b><br>7 napos trend</span></div>
  <div class="chart">${elvChart(state)}</div>
  <div class="slband" role="img" aria-label="Alvás, heti átlag: 6,4–7,3 óra">${ELV.s.map(h=>`<i style="height:${Math.round((h-5.6)*10)}px"></i>`).join('')}</div>
  <div class="leg"><span><i class="bd"></i>alvás · heti átlag 6,4–7,3 ó</span><span><i class="raw"></i>állomás — koppints rá</span></div>
  <div class="ln tap" data-go="${reached?'celok':'sulycel'}"><span class="g">${reached?'Elérted a célod: <b>73,0 kg</b>':state==='noproj'?'Vetítés még nincs: négy egyenletes hét kell hozzá.':'A következő állomás: <b>73,0 kg</b> — még 5,4 kg'}</span>${I('i-chev','chev')}</div>`;
}
function hub(arg){
  const ures=arg==='ures', st=arg==='celelerve'?'reached':arg==='nincsvetites'?'noproj':ures?'empty':'proj';
  return pg(`
  ${strip(!ures)}
  ${hg(ures?`<span class="eb">Szept. 21–27. · az első heted</span><div class="hero-w">${rng(0,'HÉTFŐN','wring')}<div class="lines"><p class="verdict">Az első heti kép hétfő reggel érkezik.</p><p>Addig elég, ha naplózol.</p></div></div><div class="act"><button class="lk" data-go="het.fut">A heted ›</button></div>`
   :`<span class="eb">Szept. 21–27. · lezárt hét</span><div class="hero-w">${rng(78,'/ 100','wring')}<div class="lines"><p class="verdict">Az egyensúly hete: 78 pont, +4 az előzőhöz.</p><p><b>Jól ment:</b> fehérjecél öt napon, stabil alvás.</p><p><b>Nézd meg:</b> két késői vacsora felszínes alvással.</p></div></div><div class="act"><button class="btn sm" data-go="het">A heti elemzés</button></div>`,1)}
  ${op('Életvonal · 12 hét',elv(st),2)}
  ${ures?op('Célok',ln('t-ring','Első cél','Mezo pilléreket javasol hozzá','','data-go="celuj.1"'),3)
   :op('Célok állása',ln('t-weight','Súlycél · 78,4 → 73 kg','−0,5 kg / hét · kb. 11 hét','<b>33%</b>','data-go="sulycel"')+GOALS.map(g=>ln(DIM[g.d[0]][1],g.t,`${word(g.arrow)} · ${g.ma}`,arr(g.arrow),'data-go="cel"')).join('')+`<div class="act" style="margin-top:4px"><button class="lk" data-go="celok">Mind a 4 cél ›</button></div>`,3)}
  ${op('',ln('t-up','Fejlődés',ures?'':'Lv 12 · 82% fegyelem · 6. hét ritmus','','data-go="novekedes"')+ln('t-people','Emberek',ures?'':'Petra 3× e héten · 8 említés','','data-go="emberek"'),4)}
  ${fn('Ahol még nincs adat, a sor csak a nevét mutatja — soha nem nullát. A rutinod a Nap · Rutin fülön épül.',5)}`,'en');
}

/* ═══════════ CÉLOK ═══════════ */
function permah(active){
  const keys=Object.keys(DIM), seg=100/6, gap=3;
  return `<svg viewBox="0 0 88 88" aria-hidden="true" style="transform:rotate(-90deg)">${keys.map((k,i)=>`<circle cx="44" cy="44" r="37" pathLength="100" fill="none" stroke-width="${active.includes(k)?7:4}" stroke-linecap="round" style="stroke:${active.includes(k)?'var(--sub)':'var(--hair)'}" stroke-dasharray="${seg-gap} ${100-seg+gap}" stroke-dashoffset="${-(i*seg)}"/>`).join('')}</svg>`;
}
function celok(arg){
  const ures=arg==='ures', active=ures?[]:['te','el','eg','ka','er'];
  const cnt=k=>ures?0:GOALS.filter(g=>g.d.includes(k)).length;
  return pg(`
  <div class="sec rise"><span class="eb">${ures?'Még nincs aktív cél':'4 aktív · 1 parkol'}</span><button class="lk" data-go="celuj.1">＋ Új cél</button></div>
  ${hg(`<div class="hero-w"><div class="ring permah" style="--c:var(--sub)">${permah(active)}<div class="c"><span><b>${ures?0:3}</b><small>ÉLETCÉL</small></span></div></div><div class="lines"><p class="verdict">${ures?'Egy cél, két-három pillér — a többit a naplód hozza.':'Két cél emelkedik, egy tartja magát.'}</p><p>${ures?'Még nincs aktív életcélod.':'A pillérek a meglévő naplódból számolnak. 2↗ · 1→ · 0↘ ezen a héten.'}</p></div></div>`,1)}
  <div class="p16 rise dims" style="--i:2">${Object.entries(DIM).map(([k,d])=>`<span class="dim ${cnt(k)?'':'off'}">${T(d[1])}${d[0]}<b>${cnt(k)}</b></span>`).join('')}</div>
  ${op('Aktív célok',ures?ln('t-weight','＋ Súlycél','Tervezd meg a tempót','','data-go="sulycel.ures"')+ln('t-ring','＋ Új cél','Mezo pilléreket javasol','','data-go="celuj.1"')
    :ln('t-weight','Súlycél · Egészség','Fogyás · 78,4 → 73 kg · −0,5 kg / hét · kb. 11 hét','<b>33%</b>','data-go="sulycel"')+GOALS.map(g=>ln(DIM[g.d[0]][1],g.t,`${DIM[g.d[0]][0]} · ${g.ma}`,`${d7(g.dots)} ${arr(g.arrow)}`,'data-go="cel"')).join('')+ln('t-ring','＋ Új cél','Mezo pilléreket javasol','','data-go="celuj.1"'),3)}
  ${ures?'':op('Parkol',`<div class="ln">${T('t-book')}<span class="g">Spanyol B2<small>parkol · Elmélyülés</small></span><button class="lk" data-toast="Újra aktív">Vissza</button></div>`,4)}
  ${op('A célok mögött',ln('c-i-eletjel','Jelek · mit figyel a rendszer','28 forrás · 19 él · 9 alszik','','data-go="jelek"'),5)}
  ${ures?'':op('Lezárt célok',`<div class="ln">${T('t-sprout')}<span class="g">Félmaraton<small>kész · Egészség</small></span><span class="v">kész</span></div>`,6)}
  ${fn('Ami nincs naplózva, az nem nulla — az üres.',7)}`,'celok');
}
function cel(){
  const P=[['Fehérje','átlag · 7 nap · ≥ 160 g','163 g','↗','t-meat',['hit','hit','part','hit','hit','miss','hit'],'cooking'],
    ['Edzésnapok','darab · heti · ≥ 4','3','→','t-dumbbell',['hit','nd','hit','nd','hit','nd','nd'],''],
    ['Alvásidő','átlag · 7 nap · ≥ 7 ó','7,1 ó','↗','t-sleep',['hit','part','hit','hit','hit','hit','part'],''],
    ['Késői nassolás','darab · heti · ≤ 2','—','','t-snack',null,'']];
  const hm=()=>`<span class="heat">${Array.from({length:28},(_,i)=>`<i class="${[0,3,7,12,19,24].includes(i)?'miss':i%5===2?'part':'hit'}"></i>`).join('')}</span>`;
  return pg(`${back('Célok','celok')}
  ${hg(`<span class="eb">Egészség · Teljesítmény · aktív</span><h1 class="t" style="margin:6px 0 4px">Kockahas</h1>${big('↗ 71%','a pillérek átlaga · aug. 10. → nov. 30.')}<div class="act" style="margin-top:8px"><button class="lk" data-sheet="pillar">＋ Pillér</button></div>`,1)}
  <div class="p16 rise" style="--i:2">${segq([['het','Hét'],['ho','Hónap']],S.celv,k=>`data-en="celv:${k}"`)}</div>
  ${op('Pillérek · 4',P.map(p=>`<div class="ln">${T(p[4])}<span class="g">${p[0]}<small>${p[1]}${p[6]?` · skill: ${p[6]}`:''}</small>${p[5]?`<small style="margin-top:5px">${S.celv==='het'?d7(p[5]):hm()}</small>`:'<small>még nincs adat · az első nyíl 5 adat-nap után</small>'}</span><span class="v"><b>${p[2]}</b> ${p[3]}</span></div>`).join(''),3)}
  ${op('Miért · ha–akkor',`<p class="quote">„Nyárra látni akarom, hogy a munka megvan.”</p><p class="txt sub" style="margin-top:6px">Akadály · esti éhség, hétvégi vendégségek</p>
    <div class="ln"><span class="eb" style="width:48px">HA</span><span class="g">21 után éhes vagyok</span></div>
    <div class="ln"><span class="eb" style="width:48px">AKKOR</span><span class="g">túró + fahéj, nem nassolás<small>Mezo figyeli · Fuel-napló</small></span></div>`,4)}
  <div class="act p16 rise" style="--i:5;padding:4px 16px"><button class="lk" data-toast="Parkolva">Parkolás</button><button class="lk" data-toast="Lezárva — a Lezárt célok közé került">Lezárás</button><button class="lk" data-toast="Archiválva">Archiválás</button></div>
  ${fn('Az irány-nyíl 7 nap vs 21 nap · mindkettőben legalább 5 adat-nap kell.',6)}`,'celok');
}
function celuj(step){
  const s=Math.min(5,Math.max(1,+(step||1))), names=['Cél','Keret','Pillérek','Ha–akkor','Összegzés'], H=['Mit építünk?','Miért fontos?','Miből mérjük?','Mi jön közbe?','Így indul'];
  let body='';
  if(s===1) body=`<div class="p16">${fld('A cél, a te szavaiddal','Félmaraton tavasszal')}${ta('Miért fontos? · egy mondat','Hogy bírjam a nyári túrákat')}${fld('Határidő · opcionális','2027. ápr. 12.')}</div>`;
  if(s===2) body=op('Mezo olvasata',`<p class="txt">Egy tavaszi félmaraton egészség- és teljesítménycél: a futásra épül, de az alvás és a fehérje is tartja.</p>`,1)+
    op('Belső keret · egészség + képesség',`<p class="txt sub">A cél abból indul, amit te akarsz megtapasztalni — nem abból, hogy mások mit látnak.</p><div class="act"><button class="btn sm" data-toast="Egészség-keret elfogadva">Elfogadom</button><button class="lk" data-toast="Marad">Maradjon</button></div>`,2)+
    op('Életterület · Mezo javaslata, átírhatod',`<div class="dims" style="padding:0">${Object.entries(DIM).map(([k,d])=>`<button class="dim ${k==='eg'||k==='te'?'':'off'}" data-en="dim">${T(d[1])}${d[0]}${k==='te'?'<b>2.</b>':''}</button>`).join('')}</div>`,3);
  if(s===3) body=op('Javasolt pillérek',[['Heti futókilométer','szokás · skill: futás','t-run',1],['Alvásidő','szokás · skill: alvás','t-sleep',1],['Fehérje','szokás · skill: cooking','t-meat',0]].map(p=>`<div class="ln">${T(p[2])}<span class="g">${p[0]}<small>${p[1]}</small></span>${tgl(p[3],p[0])}</div>`).join('')+`<div class="act"><button class="lk" data-sheet="pillar">＋ Pillér a katalógusból</button></div><p class="fn">Az AI csak a zárt jel-katalógusból választhat · 5 pillér a felső határ.</p>`,1);
  if(s===4) body=`<div class="p16"><div class="dims" style="padding:12px 0 0">${['Idő','Fáradtság','Időjárás','Utazás'].map((n,i)=>`<button class="dim ${i<2?'':'off'}" data-en="dim">${n}</button>`).join('')}</div>${ta('Mi fog közbejönni?','pl. esős hétvégék',true)}</div>`+
    op('Ha–akkor',`<div class="ln"><span class="eb" style="width:48px">HA</span><span class="g">kimarad a keddi futás</span></div><div class="ln"><span class="eb" style="width:48px">AKKOR</span><span class="g">szerdán 30 perc könnyű<small>sport-napló · másnap szólok · Mezo javaslata</small></span></div><div class="act"><button class="lk" data-toast="Új ha–akkor sor">＋ Még egy ha–akkor</button></div>`,1);
  if(s===5) body=op('',`<h2 class="t">Félmaraton tavasszal</h2><p class="txt sub">Egészség · Teljesítmény · határidő 2027. ápr. 12. · 2 pillér</p><p class="quote" style="margin-top:8px">„Hogy bírjam a nyári túrákat.”</p>`,1)+
    op('Így mérjük',ln('t-run','Heti futókilométer','≥ 20 km','')+ln('t-sleep','Alvásidő','7 nap átlag ≥ 7 ó',''),2)+
    op('Amire Mezo figyel · 1 szabály',`<p class="txt">Ha kimarad a keddi futás → szerdán 30 perc könnyű.</p><p class="fn">Aktiválás után a pillérek a meglévő naplódból számolnak — semmi újat nem kell rögzítened.</p>`,3);
  return pg(`${back(s>1?names[s-2]:'Célok',s>1?`celuj.${s-1}`:'celok')}
  <div class="p16 rise"><div class="prog">${names.map((n,i)=>`<i class="${i<s?'on':''}"></i>`).join('')}</div><div class="stepl"><span class="eb">0${s} / 05 · ${names[s-1]}</span><span class="eb">Én · új cél</span></div><h1 class="t">${H[s-1]}</h1></div>
  <div class="rise" style="--i:1">${body}</div>
  <div class="foot">${s<5?`<button class="btn" data-go="celuj.${s+1}">${names[s]} →</button>`:`<button class="lk" data-go="celok">Mentés tervezettként</button><button class="btn" data-go="cel">${I('i-check')}Aktiválás</button>`}</div>`,'celok');
}
function jelek(){
  const LIVE=[['Alvásidő','5 / 7 nap · Alvás','t-sleep',['Kockahas']],['Fehérje','7 / 7 nap · Fuel','t-bowl',['Kockahas']],['Edzésnapok','3 / 7 nap · Edzés','t-dumbbell',['Kockahas','Side hustle']],['Check-in energia','6 / 7 nap · Elme','t-checkin',[]],['Lépésszám','7 / 7 nap · Activity','t-steps',[]],['Említett emberek','4 / 7 nap · Emberek','t-people',['Az utolsó barátnő']]];
  const SLEEP=[['Pulzus-variancia','nincs adat 7 napja · Életjel','t-heart'],['Meditáció','nincs adat 7 napja · Elme','t-checkin']];
  return pg(`${back('Célok','celok')}
  ${hg(`<span class="eb">Jelek</span>${big('19 <small>/ 28</small>','forrás él · volt adata az elmúlt 7 napban')}<p class="txt sub" style="margin-top:8px">Semmi újat nem kell naplóznod. Ezekből számolom a pilléreket — ami alszik, ott a pillér üres marad, nem nulla.</p>`,1)}
  ${op('Él · 19 forrás',LIVE.map(r=>ln(r[2],r[0],r[1]+(r[3].length?` · → ${r[3].join(', ')}`:''),'él')).join(''),2)}
  ${op('Alszik · 9 forrás',SLEEP.map(r=>ln(r[2],r[0],r[1],'alszik')).join(''),3)}
  ${fn('Nincs külső forrás — se naptár, se időjárás, se GitHub. Ami itt nincs, azt a rendszer nem tudja.',4)}`,'celok');
}

/* ═══════════ SÚLYCÉL ═══════════ */
function dial(val,lo,hi,min,max){
  const cx=60,cy=56,r=46, a=v=>Math.PI*(1-(v-min)/(max-min));
  const pt=(v,rr=r)=>[+(cx+rr*Math.cos(a(v))).toFixed(1),+(cy-rr*Math.sin(a(v))).toFixed(1)];
  const arc=(v1,v2,rr)=>{const [x1,y1]=pt(v1,rr),[x2,y2]=pt(v2,rr);return `M${x1} ${y1} A${rr} ${rr} 0 0 1 ${x2} ${y2}`};
  const [nx,ny]=pt(val,r-7);
  return `<svg class="dial" viewBox="0 0 120 70" role="img" aria-label="Ütem ${fmt(val)} kg/hét, biztonságos sáv ${fmt(lo)}…${fmt(hi)}">
    <path d="${arc(min,max,r)}" style="fill:none;stroke:var(--hair);stroke-width:6"/><path d="${arc(lo,hi,r)}" style="fill:none;stroke:var(--sub);stroke-width:6;opacity:.45"/>
    ${[lo,hi].map(v=>{const [x1,y1]=pt(v,r-7),[x2,y2]=pt(v,r+7);return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--sub);stroke-width:1.2"/>`}).join('')}
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" style="stroke:var(--acc);stroke-width:2;stroke-linecap:round"/><circle cx="${cx}" cy="${cy}" r="3" style="fill:var(--acc)"/>
    ${gl(2,66,fmt(min))}${gl(118,66,(max>0?'+':'')+fmt(max),'end')}${gl(pt(lo,r+14)[0],pt(lo,r+14)[1]+3,fmt(lo),'middle')}${gl(pt(hi,r+14)[0],pt(hi,r+14)[1]+3,fmt(hi),'middle')}
  </svg>`;
}
function waterfall(){
  const D=[-0.5,-0.4,-0.6,0.1,-0.5,-0.3,-0.4,-0.4], W=300,H=92,n=D.length,bw=(W-44)/n, Y=v=>6+(-v/3.4)*(H-12);
  let out='',prev=0;
  D.forEach((d,i)=>{const x=4+i*bw,y1=Y(prev),y2=Y(prev+d),top=Math.min(y1,y2),h=Math.max(1.5,Math.abs(y2-y1));
    out+=`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(bw-6).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" style="fill:var(--sub);opacity:${d>0?.35:.6}"/>`;
    if(i<n-1)out+=`<line x1="${(x+bw-6).toFixed(1)}" x2="${(x+bw).toFixed(1)}" y1="${y2.toFixed(1)}" y2="${y2.toFixed(1)}" style="stroke:var(--hair)"/>`;
    out+=gl((x+(bw-6)/2).toFixed(1),H+14,'W'+(i+1),'middle');prev+=d});
  const xe=4+(n-1)*bw+(bw-6);
  return `<svg viewBox="0 0 ${W} ${H+18}" role="img" aria-label="Heti változások: 8 hét, összesen −3,0 kg">
    <line x1="4" x2="${W-40}" y1="${Y(0)}" y2="${Y(0)}" style="stroke:var(--hair)"/>${gl(W,Y(0)+3,'81,4','end')}
    ${out}<circle cx="${xe.toFixed(1)}" cy="${Y(prev).toFixed(1)}" r="4" style="fill:var(--acc)"/>${gl(W,(Y(prev)+3).toFixed(1),'78,4','end')}
  </svg>`;
}
function sulycel(arg){
  if(arg==='ures') return pg(`${back('Célok','celok')}
    ${hg(`<span class="eb">Súlycél</span><h1 class="t" style="margin:6px 0 4px">Még nincs aktív célod</h1><p class="txt sub">Hozz létre egyet, és a Mezo köré szervezi a terveket.</p><div class="act"><button class="btn sm" data-sheet="gate">＋ Új cél</button></div>`,1)}
    ${fn('A súlycélhoz előbb a biometriád kell — egyszeri beállítás, kb. 20 másodperc.',2)}`,'celok');
  const T6=[['diet','Mai étrendi keret','Edzésnap · P 163 · C 226 · F 66','2 300 kcal','t-bowl'],['segment','Aktuális szakasz','W5–10 · még 5 nap','MAV','t-peak'],['plans','Tervkapcsolatok','4 hét még fedezetlen','2 aktív','t-calendar'],['guards','Védőkorlátok','van egy figyelendő jel','3/4','t-shield'],['javaslat','Új javaslat<span class="dot"></span>','változások áttekintése','1','t-note'],['settings','Cél beállításai','Fogyás · W8/20','73 kg','t-gear']];
  return pg(`<div class="sec rise" style="padding-top:10px"><button class="backbtn" data-go="celok"><b>‹</b>Célok</button><button class="lk" data-sheet="gate">＋ Új cél</button></div>
  ${hg(`<span class="eb">Fogyás · Nyári forma · aktív</span><p class="verdict">Jó úton: a mért ütem a biztonságos sávban halad.</p>
    <div class="hero-w" style="align-items:flex-end"><div class="lines"><div class="big"><span class="num">78,4</span><span class="v">→ <b>73</b> kg · 33%</span></div><p>Tényleges ütem <b>−0,5 kg/hét</b> · tervezett −0,5<br>Várható cél: <b>aug. 14.</b></p></div><div class="dialw">${dial(-0.5,-0.7,-0.3,-1,0.2)}<small class="eb" style="text-align:center;display:block">ütem · kg/hét</small></div></div>`,1)}
  ${op('Heti lépések · 8 hét',`<div class="chart">${waterfall()}</div><p class="fn">Egy oszlop egy hét változása a trendben; a vékony vonal a lépcső. A felfelé lépő hét is csak szürke — a sáv dönt, nem egy hét.</p>`,2)}
  ${op('A cél részei',T6.map(t=>ln(t[4],t[1],t[2],`<b>${t[3]}</b>`,t[0]==='settings'?'data-toast="Beállítások · súlycél"':`data-go="sulyresz.${t[0]}"`)).join(''),3)}`,'celok');
}
const lane=(items,c='')=>`<div class="lane">${items.map(([l,w,t,gap])=>`<i class="${gap?'gap':''}" style="left:${l}%;width:${w}%">${t}</i>`).join('')}</div>`;
const ruler=()=>`<div class="ruler">${Array.from({length:20},(_,i)=>`<span class="${i===7?'now':''}">${i+1}</span>`).join('')}</div>`;
function sulyresz(k){
  k=k||'diet'; let out='';
  if(k==='diet') out=hg(`<span class="eb">Ma · edzésnap</span>${big('2 300','kcal')}${cells([['2 150','','heti átlag'],['2 300','','edzésnap'],['1 950','','pihenőnap']])}`,1)+
    op('Mai makrók',`<div class="ln"><span class="g">Fehérje</span><span class="v"><b>163</b> g</span><div class="bar" style="--c:var(--protein)"><b style="--w:100%"></b></div></div><div class="ln"><span class="g">Szénhidrát</span><span class="v"><b>226</b> g</span><div class="bar" style="--c:var(--carb)"><b style="--w:100%"></b></div></div><div class="ln"><span class="g">Zsír</span><span class="v"><b>66</b> g</span><div class="bar" style="--c:var(--fat)"><b style="--w:100%"></b></div></div>`,2)+
    op('Heti ritmus',`${ln('','Edzésnap × 4','','<b>2 300</b> kcal','',false)}${ln('','Pihenőnap × 3','','<b>1 950</b> kcal','',false)}<p class="txt" style="margin-top:8px">Heti átlag <b>2 150 kcal</b> — ebből jön ki a −0,5 kg/hét.</p><p class="fn">Formula-alap: a nyugalmi anyagcseréd és az edzésnapjaid számából, a heti célütemhez igazítva. A napi szám mögött mindig látható marad a heti logika.</p>`,3);
  if(k==='segment') out=hg(`<span class="eb">Aktuális szakasz · W5–10</span>${big('MAV','még 5 nap')}${cells([['5','nap','hátra'],['Strength 02','','következő'],['−0,5','kg','heti cél']])}`,1)+
    op('A teljes ív · 20 hét',lane([[20,30,'Most · MAV W5–10'],[50,30,'Strength 02']])+ruler()+`<p class="txt" style="margin-top:8px">Következő: <b>Strength 02</b> · W11-től · jún. 16.</p>`,2)+
    op('Mit változtat?',`<p class="txt">A MAV-szakaszban a heti szettszám a csúcs felé emelkedik, a kalóriakeret nem változik — az erőd megtartása a cél.</p>`,3);
  if(k==='plans') out=hg(`<span class="eb">Tervkapcsolatok</span>${big('2','aktív')}${cells([['16','hét','lefedve'],['4','hét','fedezetlen',1],['2','','sport-időpont']])}`,1)+
    op('Idővonal · 20 hét',ruler()+`<span class="eb" style="margin-top:8px">Mesociklus</span>`+lane([[20,30,'Hypertrophy 04 · W5–10']])+`<span class="eb" style="margin-top:8px">Futóblokk</span>`+lane([[25,40,'Base Build · 5K W6–13']])+lane([[0,20,'W1–4 fedezetlen',1]]),2)+
    op('Sport · heti rend',ln('t-volley','Röplabda · Edzés · BVSC','Kedd · 18:30 · 90 perc','')+`<div class="act"><button class="lk" data-toast="Mesociklus csatolása">＋ Mesociklus</button><button class="lk" data-toast="Futóblokk csatolása">＋ Futóblokk</button></div>`,3);
  if(k==='guards') out=hg(`<span class="eb">Célbiztonság</span>${big('3 <small>/ 4</small>','jel rendben')}<p class="txt sub" style="margin-top:8px">A fehérjecél még nincs Fuel-adattal ellenőrizve.</p>`,1)+
    op('Jelek',[['Erővédelem','A fő emeléseid súlya nem csökkent a vágás alatt.','+1,2%','ok'],['Izomvédelem','Minden nagy izomcsoport kap elég munkát.','≥ 8 szett / izom','ok'],['Fehérje','Még nincs elég Fuel-nap az ellenőrzéshez.','figyelendő','warn'],['Ütem','A biztonságos sávban.','−0,5 kg/hét','ok']].map(g=>`<div class="ln">${I(g[3]==='ok'?'i-check':'i-warn')}<span class="g">${g[0]}<small>${g[1]}</small></span><span class="st ${g[3]==='ok'?'q':'warn'}">${g[2]}</span></div>`).join(''),2);
  if(k==='javaslat') out=hg(`<span class="eb">Javaslat · W17 · átnézésre vár</span><h1 class="t" style="margin:6px 0 4px">Mielőtt alkalmazod</h1><p class="txt sub">Két hete lassabb az ütem a tervezettnél.</p>`,1)+
    op('Miért javasoljuk?',`<p class="txt">A mért ütem −0,2 kg/hét, a terv −0,5. A pihenőnapi keret 150 kcal-lal csökkenne.</p>`,2)+
    op('Mi változik?',`<div class="ln"><span class="g">Pihenőnap</span><span class="v"><s>1 950</s> → <b>1 800</b> kcal</span></div><div class="ln"><span class="g">Heti átlag</span><span class="v"><s>2 150</s> → <b>2 086</b> kcal</span></div>`,3)+
    `<div class="p16 rise" style="--i:4;display:grid;gap:10px;margin-top:8px"><button class="btn wide" data-toast="Alkalmazva">${I('i-check')}Módosítások alkalmazása</button><div class="act" style="justify-content:center;margin:0"><button class="lk" data-go="sulycel">Most nem</button><button class="lk" data-toast="Biztosan elveted? · Igen, elvetem / Mégsem">Javaslat elvetése</button></div></div>`;
  return pg(back('Cél','sulycel')+out,'celok');
}
function sulyuj(step){
  const s=+(step||1);
  const body=s===1?op('',[['Fogyás','↓ deficit','t-down',1],['Hízás','↑ surplus','t-up',0],['Szinten tartás','≈ tartás','t-hold',0]].map(t=>`<div class="ln tap" data-toast="${t[0]} kiválasztva">${T(t[2])}<span class="g">${t[0]}<small>${t[1]}</small></span>${t[3]?I('i-check'):''}</div>`).join(''),1)+
    op('Védőkorlátok',`<div class="ln">${T('t-shield')}<span class="g">Erő megtartása</span>${tgl(1,'Erő megtartása')}</div><div class="ln">${T('t-shield')}<span class="g">Izom megtartása</span>${tgl(1,'Izom megtartása')}</div>`,2)
   :`<div class="p16 rise" style="--i:1">${fld('Cél neve','Nyári forma')}<div class="two">${fld('Kezdés','ápr. 22.')}${fld('Cél dátum','szept. 8.')}</div><div class="two">${fld('Start súly','81,4 kg')}${fld('Cél súly','73 kg')}</div>${ta('Identity frame · opcionális','pl. „aki bírja a nyarat”',true)}
    <p class="txt" style="margin-top:14px">${I('i-check')} <b>Reális</b> · −0,5 kg/hét, a biztonságos sávon belül.</p></div>`;
  return pg(`${back(s>1?'Mit építünk?':'Cél',s>1?'sulyuj.1':'sulycel')}
  <div class="p16 rise"><div class="prog">${[1,2].map(i=>`<i class="${i<=s?'on':''}"></i>`).join('')}</div><div class="stepl"><span class="eb">0${s} / 02</span><span class="eb">Én · súlycél</span></div><h1 class="t">${s===1?'Mit építünk?':'Mennyi időnk van?'}</h1></div>
  ${body}
  <div class="foot">${s===1?`<button class="btn" data-go="sulyuj.2">Tovább →</button>`:`<button class="lk" data-go="sulycel">Mentés tervezettként</button><button class="btn" data-go="sulycel">${I('i-check')}Létrehozás + aktiválás</button>`}</div>`,'celok');
}

/* ═══════════ TEST · SÚLY ═══════════ */
function wseries(){const n=31,out=[];for(let i=0;i<n;i++){const t=i/(n-1);out.push(80.4-2.0*t+Math.sin(i*1.7)*.28+Math.cos(i*.9)*.15)}out[n-1]=78.2;return out}
function wchart(){
  const d=wseries(), W=330,H=132,lo=77.4,hi=81, x=i=>8+i/(d.length-1)*(W-40), y=v=>H-(v-lo)/(hi-lo)*(H-10);
  let e=d[0];const ema=d.map(v=>(e=e+0.25*(v-e)));ema[ema.length-1]=78.4;
  const P=ema.map((v,i)=>[x(i),y(v)]);
  const p0=80.4,p1=78.4, band=`M${x(0)} ${y(p0+.5)} L${x(30)} ${y(p1+.5)} L${x(30)} ${y(p1-.5)} L${x(0)} ${y(p0-.5)}Z`;
  return `<svg viewBox="0 0 ${W} ${H+20}" role="img" aria-label="Súlytrend, 30 nap: simított trend 80,4 → 78,4 kg, napi mérések pontokként">
    ${[78,79,80].map(v=>`<line x1="8" x2="${W-32}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" style="stroke:var(--hair)"/>${gl(W,(y(v)+3).toFixed(1),v,'end')}`).join('')}
    <path d="${band}" style="fill:var(--hair)"/>
    <line x1="${x(0)}" y1="${y(p0).toFixed(1)}" x2="${x(30)}" y2="${y(p1).toFixed(1)}" style="stroke:var(--faint);stroke-dasharray:4 4"/>
    ${d.map((v,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="1.9" style="fill:var(--sub);opacity:.7"/>`).join('')}
    <path d="${curve(P)}" style="fill:none;stroke:var(--acc);stroke-width:2.2;stroke-linecap:round"/>
    <circle cx="${x(30).toFixed(1)}" cy="${y(78.4).toFixed(1)}" r="4.5" style="fill:var(--acc)"/>
    ${gl(8,H+16,S.period==='7d'?'szept. 17.':S.period==='30d'?'aug. 25.':S.period==='90d'?'jún. 26.':'2025. szept.')}${gl(W-32,H+16,'ma','end')}
  </svg>`;
}
function sulyBody(){
  const WK=[['szept. 15–21','−0,4','78,6 kg átlag · 5 bejegyzés · min 78,4',[78.9,78.7,78.8,78.6,78.5,78.4,78.4]],['szept. 8–14','−0,6','79,0 kg átlag · 6 bejegyzés · min 78,8',[79.5,79.3,79.2,79.0,78.9,78.8,78.9]],['szept. 1–7','+0,1','79,6 kg átlag · 4 bejegyzés · min 79,4',[79.5,79.7,79.6,79.4,79.7,79.6,79.6]]];
  const DN=['Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat','Vasárnap'];
  return hg(`<span class="eb">Trend · 7 napos simítás</span>${big('78,4','kg · ma mérve 78,2')}<p class="txt sub" style="margin-top:4px">−3,0 kg indulás óta · 81,4 → 78,4 · cél 73 kg</p>
    <div class="chart">${wchart()}</div>
    <div class="leg"><span><i></i>trend</span><span><i class="raw"></i>napi mérés</span><span><i class="pl"></i>terv</span><span><i class="bd"></i>tűréssáv</span></div>
    ${segq([['7d','7 nap'],['30d','30 nap'],['90d','90 nap'],['1y','1 év']],S.period,k=>`data-en="period:${k}"`)}`,1)+
  op('',`${ln('','7 nap / hét','','<b>−0,4</b> kg','',false)}${ln('','4 heti tempó','','<b>−0,5</b> kg/hét','',false)}${ln('','A célig','','<b>33%</b> · 5,4 kg','',false)}${ln('','Várható cél','','<b>11 hét</b> · aug. 14.','',false)}`,2)+
  op('Megfigyelés',`<p class="txt">Négy hét alatt <b>−2,0 kg</b> a trend, miközben a fő emeléseid súlya <b>+1,2%</b>. Ez inkább zsírvesztés, mint izom — a Védőkorlátok ugyanezt mondják.</p>`,3)+
  op('Heti előzmény · 3 / 22 hét',WK.map((w,i)=>`<div class="ln tap" data-en="wk:${i}">${spark(w[3])}<span class="g">${w[0]}<small>${w[2]}</small></span><span class="v"><b>${w[1]}</b> kg</span><span class="v">${S.wk===i?'⌃':'⌄'}</span></div>${S.wk===i?`<div class="days">${w[3].map((v,j)=>`<div><span>${DN[j]}</span><b>${fmt(v)} kg</b><em>${j?((v-w[3][j-1])>=0?'+':'')+fmt(v-w[3][j-1]):'—'}</em></div>`).join('')}<button class="lk" data-toast="Mezo · diagnózis erre a hétre">Mi történt ezen a héten?</button></div>`:''}`).join('')+`<div class="act"><button class="lk" data-toast="Régebbi hetek betöltve">Régebbi hetek ⌄</button></div>`,4);
}
/* ═══════════ TEST · ALVÁS ═══════════ */
const PH=[['Mély',18,.9],['Könnyű',52,.55],['REM',24,.75],['Éber',6,.3]];
const rail=a=>`<div class="rail">${a.map(p=>`<i style="width:${p[1]}%;opacity:${p[2]}"></i>`).join('')}</div><div class="leg">${a.map(p=>`<span><i class="bd" style="opacity:${p[2]}"></i>${p[0]} ${p[1]}%</span>`).join('')}</div>`;
const ref=(n,v,lo,hi)=>`<div class="ln" style="padding:8px 0"><span class="g">${n}</span><span class="band"><s style="left:${lo*2}%;width:${(hi-lo)*2}%"></s><u style="left:${v*2}%"></u></span><span class="v"><b>${v}%</b> · a sávban</span></div>`;
function schart(){
  const avg=[6.6,6.9,7.0,6.4,7.2,7.1,6.8,7.1], mn=[5.9,6.1,6.3,5.6,6.5,6.4,6.1,6.1], mx=[7.6,7.8,7.9,7.4,8.1,7.9,7.6,7.9];
  const W=330,H=110,lo=5.4,hi=8.4,x=i=>8+i/7*(W-40),y=v=>6+(hi-v)/(hi-lo)*(H-12);
  const P=avg.map((v,i)=>[x(i),y(v)]);
  const bandD=mx.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')+mn.map((v,i)=>v).reverse().map((v,i)=>`L${x(7-i).toFixed(1)} ${y(v).toFixed(1)}`).join('')+'Z';
  return `<svg viewBox="0 0 ${W} ${H+20}" role="img" aria-label="Alvás heti átlaga 8 héten: 6,4–7,3 óra, a sáv a hét legrövidebb és leghosszabb éjszakája">
    ${[6,7,8].map(v=>`<line x1="8" x2="${W-32}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" style="stroke:var(--hair)"/>${gl(W,(y(v)+3).toFixed(1),v+' ó','end')}`).join('')}
    <line x1="8" x2="${W-32}" y1="${y(7.5).toFixed(1)}" y2="${y(7.5).toFixed(1)}" style="stroke:var(--faint);stroke-dasharray:3 4"/>
    <path d="${bandD}" style="fill:var(--hair)"/>
    <path d="${curve(P)}" style="fill:none;stroke:var(--acc);stroke-width:2.2;stroke-linecap:round"/>
    ${avg.map((v,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.2" style="fill:var(--acc)"/>`).join('')}
    ${gl(8,H+16,'aug. 3.')}${gl(W-32,H+16,'ez a hét','end')}
  </svg>`;
}
function hypno(){
  const st=[1,2,3,2,1,2,3,3,2,1,0,1,2,3,2,1,1,2,3,2,1,1,0,1,2,3,2,1], L=[3,2,1,0], y=v=>10+L.indexOf(v)*18, W=300, X0=40, dx=(W-X0-4)/(st.length-1);
  let d=`M${X0} ${y(st[0])}`; st.forEach((v,i)=>{if(i)d+=` H${(X0+i*dx).toFixed(1)} V${y(v)}`});
  return `<svg viewBox="0 0 ${W} 86" role="img" aria-label="Az éjszaka íve: 00:42 → 09:03">${['Éber','REM','Könnyű','Mély'].map((n,i)=>gl(0,10+i*18+3,n)).join('')}<path d="${d}" style="fill:none;stroke:var(--sub);stroke-width:1.8;stroke-linejoin:round"/>${gl(X0,84,'00:42')}${gl(W,84,'09:03','end')}</svg>`;
}
function strend(){
  const N7=[[7.5,9],[6.8,6],[7.2,7],[6.1,5],[7.9,8],[7.0,7],[7.1,7]], N14=[[7.0,7],[6.6,6],[7.3,8],[7.1,7],[6.4,5],[7.4,8],[7.2,7],...N7];
  const N=S.swin==='7d'?N7:N14, W=330,H=96,n=N.length,bw=(W-40)/n;
  return `<svg viewBox="0 0 ${W} ${H+18}" role="img" aria-label="Alvás trend: időtartam oszlop, minőség pont">
    <line x1="4" x2="${W-32}" y1="${(H-7/9*H).toFixed(1)}" y2="${(H-7/9*H).toFixed(1)}" style="stroke:var(--faint);stroke-dasharray:3 4"/>${gl(W,(H-7/9*H+3).toFixed(1),'7 ó','end')}
    ${N.map((v,i)=>{const x=4+i*bw,h=v[0]/9*H;return `<rect x="${x.toFixed(1)}" y="${(H-h).toFixed(1)}" width="${(bw-5).toFixed(1)}" height="${h.toFixed(1)}" rx="2" style="fill:var(--sub);opacity:${v[0]<7?.75:.4}"/><circle cx="${(x+(bw-5)/2).toFixed(1)}" cy="${(H-v[1]/10*H-4).toFixed(1)}" r="2.4" style="fill:var(--ink)"/>${n<=7?gl((x+(bw-5)/2).toFixed(1),H+14,['H','K','Sz','Cs','P','Sz','V'][i],'middle'):''}`}).join('')}
  </svg>`;
}
function scatter(){
  const P=[[6.1,78],[6.5,84],[6.8,92],[7.0,101],[7.2,104],[7.5,112],[7.9,118],[8.2,121],[6.3,80],[7.1,99]], W=330,H=100,x=h=>(h-5.8)/2.6*(W-10)+4,y=m=>H-(m-70)/56*(H-8);
  return `<svg viewBox="0 0 ${W} ${H+18}" role="img" aria-label="Alvásidő és REM-perc">
    <line x1="${x(7).toFixed(1)}" x2="${x(7).toFixed(1)}" y1="0" y2="${H}" style="stroke:var(--faint);stroke-dasharray:3 4"/>${gl(x(7)+4,10,'7 ó')}
    ${P.map(p=>`<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="4" style="fill:${p[0]<7?'var(--sub)':'var(--ink)'}"/>`).join('')}
    ${gl(4,H+14,'6 ó')}${gl(W,H+14,'8 ó · REM perc ↑','end')}
  </svg>`;
}
function alvasBody(){
  const LOG=[['09/23','7,1 ó','23:20 → 06:30',7,''],['09/22','7,5 ó','00:42 → 09:03',9,'Tegnap stabil'],['09/21','6,1 ó','01:10 → 07:15',5,'Késő vacsora'],['09/20','7,2 ó','23:40 → 06:55',7,''],['09/19','6,8 ó','23:55 → 06:45',6,''],['09/18','7,9 ó','22:50 → 06:45',8,''],['09/17','7,0 ó','23:30 → 06:30',7,'']];
  return hg(`<span class="eb">Alvás · heti átlag</span>${big('7,1','ó · a hét sávja 6,1–7,9')}<p class="txt sub" style="margin-top:4px">tegnap 7,1 ó · 23:20 → 06:30 · minőség 7/10</p>
    <div class="chart">${schart()}</div><div class="leg"><span><i></i>heti átlag</span><span><i class="bd"></i>legrövidebb–leghosszabb</span><span><i class="pl"></i>7,5 ó cél</span></div>`,1)+
  op('Alvás-cél',`<div class="ln">${T('t-sleep')}<span class="g"><b>23:15</b> → <b>06:45</b><small>7,5 ó cél · ±15 perc · „a rendszeresség a király”</small></span><button class="lk" data-toast="Beállítások · alvás-cél">szerkeszt</button></div>
    ${ln('','Rendszeresség','14 nap · ±15 perc','<b>78%</b>','',false).replace('</div>','<div class="bar q"><b style="--w:78%"></b></div></div>')}${ln('','Hatékonyság','cél ≥ 85%','<b>91%</b>','',false).replace('</div>','<div class="bar q"><b style="--w:91%"></b></div></div>')}
    ${ln('t-book','Miért számít?','Az azonos időben lefekvés többet ér, mint egy-egy hosszabb éjszaka.','','data-sheet="stats"')}`,2)+
  op('Tegnap éjjel',`${big('7,5','ó · 00:42 → 09:03 · ébredés 1× · minőség 9/10')}<p class="txt sub" style="margin-top:4px">87 perccel a cél lefekvés után · hatékonyság 93%</p>
    <span class="eb" style="margin-top:12px">Fázisok</span>${rail(PH)}${ref('Mély',18,13,23)}${ref('REM',24,20,25)}<p class="txt" style="margin-top:6px">Tegnap stabil.</p>
    <span class="eb" style="margin-top:12px">Az éjszaka íve</span><div class="chart">${hypno()}</div>
    <span class="eb" style="margin-top:12px">Átlagos összetétel · 14 éjszaka</span>${rail([['Mély',16,.9],['Könnyű',55,.55],['REM',22,.75],['Éber',7,.3]])}${ref('Mély',16,13,23)}${ref('REM',22,20,25)}`,3)+
  op('Trend',`${segq([['7d','7 nap'],['14d','14 nap']],S.swin,k=>`data-en="swin:${k}"`)}<div class="chart">${strend()}</div><div class="leg"><span><i class="bd"></i>időtartam</span><span><i class="raw" style="background:var(--ink)"></i>minőség 1–10</span><span><i class="pl"></i>7 ó</span></div>
    <span class="eb" style="margin-top:14px">Ha rövidebb az éjszaka</span><div class="chart">${scatter()}</div><p class="txt">A 7 óra alatti éjszakáidon átlagosan <b>21 perccel kevesebb</b> a REM-ed.</p>`,4)+
  op('Napló · utolsó 7 éjszaka',LOG.map(n=>{const w=parseFloat(n[1].replace(',','.'))<7||n[3]<=5;return `<div class="ln"><time>${n[0]}</time><span class="g"><b${w?' style="color:var(--warn)"':''}>${n[1]}</b> · ${n[2]}${n[4]?`<small>${n[4]}</small>`:''}</span><span class="v"><b>${n[3]}</b>/10</span><div class="bar q"><b style="--w:${n[3]*10}%"></b></div></div>`}).join(''),5)+
  op('',ln('t-moon','Éjszakai mód','Eszközök éjszakai ébredéshez — 20 perces szabály, légzés, 4K-séta.','','data-go="ejszaka.idle"'),6);
}
function test(arg){
  const v=arg==='alvas'?'alvas':'suly';
  return pg(`<div class="sec rise" style="padding-top:10px">${segq([['suly','Súly'],['alvas','Alvás']],v,k=>`data-go="${k==='suly'?'test':'test.alvas'}"`)}<button class="lk" data-sheet="${v==='suly'?'weight':'sleep'}">${v==='suly'?'＋ Súly':'＋ Alvás'}</button></div>
  ${v==='suly'?sulyBody():alvasBody()}
  ${op('',ln('t-person','<b>34</b> év · <b>180</b> cm · <b>78,4</b> kg · <b>15%</b> testzsír','','','data-toast="Beállítások · testadatok"'),7)}`,'test');
}
function ejszaka(ph){
  ph=ph||'idle';
  const nb=`<button class="nback" data-go="${ph==='idle'?'test.alvas':'ejszaka.wait'}">← vissza</button>`;
  let inner='';
  if(ph==='idle') inner=`${nb}<span class="eb">Éjszakai mód</span>${T('t-moon','moonart')}<h1>Felébredtél?</h1><p>Ne nézd meg az órát. Én figyelem helyetted az időt — neked csak pihenned kell.</p><button class="ncta" data-go="ejszaka.wait">Ébren vagyok</button>`;
  else if(ph==='wait') inner=`${nb}<span class="eb">Én figyelem az időt</span><div class="orb"></div><p>Maradj az ágyban, lazíts. Ha segít, válassz egyet:</p>
    ${[['t-rested','Légzés','be 5 · tartsd 6 · ki 7 — vezetett ütem','data-go="ejszaka.legzes"'],['t-person','Testpásztázás','fejtől lábujjig, lassú vezetéssel','data-toast="Testpásztázás — lassú, sötét kártyák"'],['t-steps','4K-séta','járj végig fejben egy jól ismert utat','data-toast="4K-séta — lassú, sötét kártyák"']].map(t=>`<button class="tool" ${t[3]}>${T(t[0])}<span class="g">${t[1]}<small>${t[2]}</small></span><em>›</em></button>`).join('')}
    <button class="quitl" data-go="test.alvas">elalszom · kilépek</button><button class="quitl" data-go="ejszaka.getup">(20 perc múlva →)</button>`;
  else if(ph==='legzes') inner=`${nb}<span class="eb">Légzés · 5 – 6 – 7</span><div class="breath">Be…</div><p>Kövesd a kört: ahogy nő, szívd be; ahogy áll, tartsd; ahogy húzódik, fújd ki.</p><button class="quitl" data-go="ejszaka.wait">megállítom ›</button>`;
  else inner=`${nb}<span class="eb">20 perc eltelt</span>${T('t-dawn','moonart')}<h1>Ideje felkelni</h1><p>Kelj fel — ez most a jobb út.</p><ul><li>Menj át egy másik, félhomályos szobába.</li><li>Csinálj valami unalmasat, képernyő nélkül.</li><li>Csak akkor feküdj vissza, ha álmos vagy.</li></ul><button class="ncta" data-go="test.alvas">Visszafeküdtem</button>`;
  return `<div class="night">${inner}</div><div class="toast" id="toast"></div><div class="sheet" id="sheet"></div><div class="scrim" id="scrim"></div>`;
}

/* ═══════════ A HETED ═══════════ */
const DAYSC=[['H',78],['K',72],['Sze',85],['Cs',null],['P',null],['Szo',null],['V',null]];
const mbars=()=>`<span class="mb">${DAYSC.map(d=>`<i class="${d[1]?'':'nd'}" style="height:${d[1]?Math.round(d[1]*.22):4}px"></i>`).join('')}</span>`;
const wkhead=()=>back('Heti','het');
function het(arg){
  const run=arg==='fut';
  return pg(`<div class="sec rise" style="padding-top:10px"><button class="backbtn" data-go="en"><b>‹</b>Hol tartok</button><span class="wnav"><button data-toast="Előző hét" aria-label="Előző hét">‹</button><button ${run?'disabled':'data-toast="Következő hét"'} aria-label="Következő hét">›</button></span></div>
  ${hg(`<span class="eb">Szept. 21–27. · ${run?'ez a hét · még fut':'lezárt hét · a Mezo elemzésével'}</span><div class="hero-w">${rng(78,'/ 100','wring')}<div class="lines"><h1 class="t" style="font-size:24px">${run?'A visszatérés hete':'Az egyensúly hete'}</h1><p><b>+4</b> az előző héthez (74)</p></div></div>`,1)}
  ${op('A hét számokban',cells([['3 004','kcal','kcal átlag'],['212','g','fehérje'],['7ó 19p','','alvás',1],['75','%','check-in'],['7,0','/ 10','energia'],['6,8','/ 10','hangulat'],['78,6','kg','súly'],['−0,4','kg/hét','súly-trend'],['585','','XP']])+`<p class="fn">Színt csak az kap, ami figyelmet kér: az alvás a 7,5 órás célod alatt maradt. Minden más rendben — szürke.</p>`,2)}
  ${op('A hét négy nézete',`<div class="ln tap" data-go="elemzes">${T('t-score')}<span class="g">Mezo · heti elemzés<small>${run?'hétfőn jön · a hét még fut':'hétfő 06:15 · erős hét volt: a fehérjecélt öt napon tartottad'}</small></span>${mbars()}${I('i-chev','chev')}</div>
    ${ln('t-gem','A hét tanulságai',run?'a hét közben még gyűlik':'nincs javaslat ehhez a héthez','—','data-go="tanulsagok"')}${ln('t-sun','A hét napjai','nézd meg egyesével','<b>4</b> / 7','data-go="napok"')}${ln('t-orb','Heti felfedezések','23 minta · 6 új tudás · 3 életesemény · 1 emlékkönyv · 1 előrejelzés','<b>34</b> új nyom','data-go="felfedezesek"')}`,3)}
  ${run?op('Célok · a hét iránya',GOALS.map(g=>ln(DIM[g.d[0]][1],g.t,g.arrow==='↗'?'Emelkedik: a pillérei többsége a héten célon volt.':'Tartja: a pillérek a múlt heti szinten.',arr(g.arrow),'data-go="celok"')).join(''),4)+op('Mezo · a következő heted',`<p class="txt">Jövő héten két korai lefekvés elég lenne, hogy a hatékonyságod 90% fölött maradjon — a többi mehet így.</p><div class="act"><button class="lk" data-toast="Köszönöm">Hasznos</button><button class="lk" data-toast="Rendben">Nem most</button></div>`,5):''}
  ${fn('A pontszám a hat mért területből áll össze: tápanyag, minőség, edzés, alvás, logolás, ritmus.',6)}`,'en');
}
function elemzes(){
  return pg(`${wkhead()}
  ${hg(`<span class="eb">Heti elemzés · hétfő 06:15</span>${big('78 <small>/ 100</small>','napi pontszámok · a Mezo olvasata')}
    <div class="sbars">${DAYSC.map(d=>`<button data-toast="${d[0]} — A napom oldala (Nap)"><em>${d[1]??''}</em><i class="${d[1]?'':'nd'}" style="height:${d[1]?Math.round((d[1]-40)*1.3):10}px"></i><small>${d[0]}</small></button>`).join('')}</div>`,1)}
  ${op('Mezo · heti elemzés',`<p class="txt">Erős hét volt: a fehérjecélt öt napon tartottad, és az alvásod a hét második felében stabilizálódott. A csütörtöki kimaradt nap után szombaton visszajöttél — ez a hét mintája.</p>
    <p class="fn">Amire épült: minta · tudás · életesemény · emlék</p><div class="act"><button class="lk" data-toast="Elemzés frissítve">↻ Frissítsd</button><button class="lk" data-toast="Beszélgetés a hétről (Mezo)">Beszélgess a hétről ›</button></div><div class="act" style="margin-top:6px"><button class="lk" data-toast="Köszönöm">Hasznos</button><button class="lk" data-toast="Rendben">Nem talált</button></div>`,2)}
  ${op('',ln('t-gem','A hét tanulságai','még nincs javaslat','','data-go="tanulsagok"'),3)}`,'en');
}
function napok(){
  const D=[['H','szept. 21.',78,[8,6,7,9,5,7],['2 840 kcal','7ó 40p','1× edzés','4/4 check-in'],0],['K','szept. 22.',72,[6,7,5,6,8,6],['3 120 kcal','6ó 50p','','3/4 check-in'],0],['Sze','szept. 23.',85,[9,8,8,8,9,8],['2 950 kcal','7ó 30p','1× edzés','4/4 check-in'],0],['Cs','szept. 24.',null,[3,0,0,0,6,0],['','7ó 10p','','1/4 check-in · jegyzet'],1],['P','szept. 25.','f'],['Szo','szept. 26.','f'],['V','szept. 27.','f']];
  return pg(`${wkhead()}
  ${hg(`<span class="eb">A hét napjai</span>${big('4 <small>/ 7</small>','mért nap · koppints egy napra')}${cells([['Sze 85','','legjobb nap'],['K 72','','leggyengébb'],['1','','tanulom']])}`,1)}
  ${op('',D.map(d=>d[2]==='f'?`<div class="ln" style="opacity:.5"><time>${d[0]}</time><span class="g">${d[1]}<small>még előtted — ide majd a nap adatai jönnek</small></span></div>`
    :`<div class="ln tap" data-toast="${d[0]} — A napom oldala (Nap)"><time>${d[0]}${d[5]?' · MA':''}</time><span class="g">${d[1]}<small>${d[4].filter(Boolean).join(' · ')}</small></span><span class="mb">${d[3].map(v=>`<i style="height:${Math.max(2,v*2)}px"></i>`).join('')}</span><span class="v"><b>${d[2]??'tanulom'}</b>${d[2]?' / 100':''}</span></div>`).join(''),2)}
  ${fn('A hat pálcika a nap részpontszáma: tápanyag, minőség, edzés, alvás, logolás, ritmus.',3)}`,'en');
}
const SIG=['Fehérjebevitel','Alvásminőség','Lépésszám','Koffein','Hangulat','Esti képernyőidő','Edzésnap','Stressz','Reggeli check-in','Hála-napló'], SIG2=['másnapi energia','fókusz','étvágy','pihentség','edzésteljesítmény','türelem'];
const PATS=[['A késői lefekvés a másnapi napstruktúrát is gyengítheti','előléptetve'],...Array.from({length:13},(_,i)=>[`${SIG[i%10]} és ${SIG2[i%6]}`,'előléptetve']),['Edzésnapokon mélyebben alszol','erősödött'],['A munkahelyi fókusz nehézsége összefügghet a gyengébb mentális közérzettel','erősödött'],['A hirtelen mérlegemelkedés fokozhatja az aznapi stresszt','erősödött'],['Vízbevitel és napi energia','erősödött'],...Array.from({length:5},(_,i)=>[`${SIG[(i+13)%10]} és ${SIG2[(i+13)%6]}`,'megerősítve'])];
const FACTS=['A fehérjecél tartása javítja a check-in energiát','Hétköznap 23:00 után fekszel le a legtöbbször','A kedd a legsűrűbb munkanapod','Futás után jobb a hangulatod','A hétvégi reggeli rendszerint kimarad','A délutáni kávé után később alszol el'];
function felfedezesek(arg){
  const D=arg==='csend'?{p:[],f:[],l:[],m:0,r:[]}:arg==='keves'?{p:PATS.slice(1,2),f:FACTS.slice(0,1),l:[['Nyaralás kezdete','szept. 23.']],m:1,r:[['A súly csökkenő trendje folytatódik fehérjecél mellett','folyamatban']]}:{p:PATS,f:FACTS,l:[['Nyaralás kezdete','szept. 23.'],['Új munkahelyi projekt','szept. 22.'],['Költözés előkészítése','szept. 26.']],m:1,r:[['A súly csökkenő trendje folytatódik fehérjecél mellett','folyamatban']]};
  const n=D.p.length+D.f.length+D.l.length+D.r.length+D.m;
  if(!n) return pg(`${wkhead()}${hg(`<span class="eb">Heti felfedezések</span>${big('—','csendes hét volt')}<p class="txt sub" style="margin-top:8px">Nem született új minta vagy tudás. Ez nem hiba: a memória csak akkor nő, ha van mit tanulni.</p>`,1)}`,'en');
  const drawer=(k,eb,items,row,open,unit)=>op(eb,items.slice(0,open?undefined:3).map(row).join('')+(items.length>3?`<div class="act"><button class="lk" data-en="drawer:${k}">${open?'Kevesebb ‹':`Mind a ${items.length} ${unit} ›`}</button></div>`:''),k==='p'?3:4);
  return pg(`${wkhead()}
  ${hg(`<span class="eb">Heti felfedezések</span>${big(n,'új nyom a memóriában')}<p class="txt sub" style="margin-top:8px">Amit a Mezo a héten <b>magától</b> tett a memóriába — ezek nem javaslatok, hanem megtörtént nyomok.</p>`,1)}
  ${op('A hét kiemelt nyomai',D.l.map(l=>ln('t-pin',l[0],`életesemény · ${l[1]}`,'','data-toast="Életesemény — a Rólad oldalon döntesz róla"')).join('')+(D.m?ln('t-scroll','Új bejegyzés készült a hétről','emlékkönyv · olvasd el','','data-toast="Emlékkönyv (Mezo)"'):'')+D.r.map(r=>ln('t-orb',r[0],`előrejelzés · ${r[1]}`,'','data-toast="Előrejelzések (Mezo)"')).join(''),2)}
  ${D.p.length?drawer('p',`Minták · ${D.p.length}`,D.p,p=>ln('t-pattern',p[0],p[1],'','data-toast="Minta oldala (Mezo)"'),S.dp,'minta'):''}
  ${D.f.length?drawer('f',`Új tudás · ${D.f.length} · a legfrissebb elöl`,D.f,f=>ln('t-book',f,'','','data-toast="Ez a tudás a Tudástárban"'),S.df,'új tudás'):''}`,'en');
}
function tanulsagok(){
  return pg(`${wkhead()}
  ${hg(`<span class="eb">A hét tanulságai · a visszatérés hete</span><p class="verdict">A heti felismerésekről a Tudástár közös postaládájában döntesz.</p><p class="txt sub">Ott egy helyen látod mindet, és egyenként elfogadhatod vagy elvetheted.</p><div class="act"><button class="btn sm" data-toast="Tudástár postaládája (Mezo)">Tudástár postaládája →</button><button class="lk" data-go="het">Vissza a heti értékeléshez</button></div>`,1)}`,'en');
}

/* ═══════════ NÖVEKEDÉS ═══════════ */
const LIFE=[['Tudatosság','c-i-life-tudatossag',4,62,'Reggeli jelenlét'],['Szemlélet','c-i-life-szemlelet',3,40],['Konyha','c-i-life-konyha',5,78,'Kockahas','perk Lv 10'],['Pénzügyek','c-i-life-penzugyek',2,55],['Produktivitás','c-i-life-produktivitas',4,20,'Side hustle'],['Tanulás','c-i-life-tanulas',3,85],['Kapcsolatok','c-i-life-kapcsolatok',3,33,'Az utolsó barátnő'],['Regeneráció','c-i-life-regeneracio',3,48]];
const skl=(n,icn,lv,p,goal,perk)=>`<div class="ln">${icn.startsWith('c-')||icn.startsWith('t-')?T(icn):`<span class="mono2">${icn}</span>`}<span class="g">${n}${goal||perk?`<small>${[goal?`→ ${goal}`:'',perk].filter(Boolean).join(' · ')}</small>`:''}</span><span class="v"><b>Lv ${lv}</b></span><div class="bar q"><b style="--w:${p}%"></b></div></div>`;
function novekedes(arg){
  const ures=arg==='ures';
  const q=(t,k)=>`<div class="ln">${k==='done'?I('i-check'):k==='gone'?`<span class="dotgone"></span>`:T('t-quest')}<span class="g" ${k==='gone'?'style="color:var(--faint)"':''}>${t}${k==='gone'?'<small>csendben lejárt</small>':k==='open'?'<small>küldetés · nyitott</small>':''}</span></div>`;
  return pg(`${back('Hol tartok','en')}
  ${hg(`<div class="ln tap" style="border-top:0;padding:0" data-toast="Küldetések · a Nap fülön"><span class="eb">Ma${ures?'':' · 2/4 küldetés · +45 XP'}</span>${I('i-chev','chev')}</div>
    ${ures?`<p class="verdict" style="margin-top:8px">Ma még nincs küldetés — a reggeli briefinggel jön.</p><p class="txt sub">Tevékenységet közben is logolhatsz.</p>`:q('Fehérje 150 g','done')+q('Reggeli séta','done')+q('Esti nyújtás','open')+q('Heti meal prep','gone')+`<div class="ln">${T('t-note')}<span class="g">Meal prep a hétre<small>tevékenység · +15</small></span></div><div class="ln">${T('t-note')}<span class="g">Pénzügyek rendezése<small>tevékenység · +20</small></span></div>`}
    <div class="act"><button class="btn sm" data-toast="Tevékenység naplózása">＋ Tevékenység</button></div>`,1)}
  ${op('Szint és ritmus',`${ln('','Szint '+(ures?1:12),ures?'0 / 100 XP':'420 / 3 500 XP a következőig · 3 140 XP összesen','','',false).replace('</div>',`<div class="bar q"><b style="--w:${ures?0:12}%"></b></div></div>`)}${ures?'':ln('','Fegyelem','','<b>82%</b>','',false).replace('</div>','<div class="bar q"><b style="--w:82%"></b></div></div>')}
    <div class="ln"><span class="g">Ritmus</span><span class="wdots">${Array.from({length:8},(_,n)=>`<i class="${n>=(ures?7:2)?'on':''}${n===7?' now':''}"></i>`).join('')}</span><span class="v"><b>${ures?1:6}</b> hét</span></div>`,2)}
  ${op('',ln('t-sprout','Skillek',ures?'':'14 skill · legjobb Lv 7','','data-go="skillek"')+ln('t-journal','Tevékenységek',ures?'':'23 küldetés · 9 tevékenység · 30 nap','','data-go="tevekenysegek"')+ln('t-record','Kitüntetések',ures?'':'5 / 9 jelvény','','data-go="kitunt"'),3)}
  ${fn('A szint visszajelzés, nem jutalom — semmi nem nyílik vagy zárul tőle. Az XP-idősort nem rajzoljuk.',4)}`,'en');
}
function skillek(){
  const life=S.life?LIFE:LIFE.slice(0,4);
  return pg(`${back('Növekedés','novekedes')}
  ${hg(`<span class="eb">Növekedés · képességek</span>${big('14','skill')}${cells([['3,4','','LIFE Lv-átlag'],['5','','atléta-szint'],['Lv 7','','izom legjobb']])}`,1)}
  ${op('LIFE · 8 skill · 1 085 XP',life.map(l=>skl(l[0],l[1],l[2],l[3],l[4],l[5])).join('')+`<div class="act"><button class="lk" data-en="life">${S.life?'Kevesebb ▴':'Mind a 8 ▸'}</button></div>${ln('','Megtakarítás (30 nap)','','<b>50 000</b> Ft','',false)}`,2)}
  ${op('Atlétikus · 4 skill · átlag 5,0',[['Maximális erő','Ma',7,64],['Állóképesség','Ál',5,30],['Robbanékonyság','Ro',4,72],['Mobilitás','Mo',4,15]].map(s=>skl(s[0],s[1],s[2],s[3])).join(''),3)}
  ${op('Izom · 9 izom · legjobb Lv 7',`<div class="ln">${mchp('back-wide','sm')}<span class="g">Hát</span><span class="v"><b>Lv 7</b></span><div class="bar q"><b style="--w:58%"></b></div></div><div class="ln">${mchp('chest-mid','sm')}<span class="g">Mell</span><span class="v"><b>Lv 6</b></span><div class="bar q"><b style="--w:80%"></b></div></div><div class="ln">${mchp('shoulder-side','sm')}<span class="g">Váll</span><span class="v"><b>Lv 5</b></span><div class="bar q"><b style="--w:44%"></b></div></div>${skl('Comb','Co',5,12)}<div class="act"><button class="lk" data-toast="Mind a 9 izom">Mind a 9 ▸</button></div>`,4)}
  ${fn('A szint visszajelzés, nem jutalom — semmi nem nyílik vagy zárul tőle.',5)}`,'en');
}
function tevekenysegek(){
  const day=(d,dt,xp,rows)=>op(`${d} · ${dt} · +${xp} XP`,rows.join(''));
  const q=(t,m,xp)=>`<div class="ln">${I('i-check')}<span class="g">${t}<small>küldetés · ${m} · +${xp}</small></span></div>`;
  const a=(t,sk,xp,ft)=>`<div class="ln">${T('t-note')}<span class="g">${t}<small>tevékenység · ${sk||'besorolatlan'} · +${xp}${ft?` · ${ft}`:''}</small></span></div>`;
  const g=t=>`<div class="ln"><span class="dotgone"></span><span class="g" style="color:var(--faint)">${t}<small>küldetés · csendben lejárt</small></span></div>`;
  return pg(`${back('Növekedés','novekedes')}
  ${hg(`<span class="eb">Növekedés · utolsó 30 nap</span>${big('23','teljesített küldetés')}<span class="eb" style="margin-top:10px">Ez a hét · szept. 21 – 27.</span>${cells([['6','','küldetés'],['2','','lejárt'],['4','','tevékenység'],['+120','','LIFE XP'],['8 500','Ft','megtakarítás']])}`,1)}
  ${day('Ma','09.24',45,[q('10 perc séta ebéd után','reggel',15),a('Meal prep a hétre','Konyha',10,'2 000 Ft'),g('Olvass 10 oldalt')])}
  ${day('Tegnap','09.23',30,[q('Víz az ágy mellé','este — tevékenységgel teljesült',15),a('Kiadások átnézése','Pénzügyek',15)])}
  ${day('Szept. 22.','09.22',10,[a('Hosszú beszélgetés Petrával','',10)])}
  ${fn('Utolsó 30 nap. A csendben lejárt küldetés nem hiba — ajánlat volt.',5)}`,'en');
}
const BADGES=[['t-quest','Első küldetés',100,'megvan'],['t-scroll','10 küldetés',100,'megvan'],['t-record','50 küldetés',46,'23 / 50'],['t-note','Első tevékenység',100,'megvan'],['t-flame','4 hetes ritmus',100,'megvan'],['t-gem','Mind a 8 LIFE aktív',75,'6 / 8'],['c-i-tudas','LIFE Lv 5',60,'Lv 3'],['t-peak','10 000 LIFE XP',31,'3 140'],['t-coin','100k megtakarítás',50,'50k']];
function kitunt(){
  const bolt=S.tit==='bolt';
  return pg(`${back('Növekedés','novekedes')}
  ${hg(`<span class="eb">Növekedés · kitüntetések</span>${big('5 <small>/ 9</small>','jelvény megvan · 240 érme')}<p class="txt sub" style="margin-top:6px">Viselt cím: <b>A kitartó</b>.</p>`,1)}
  ${op('Sorozat',ln('t-flame','6 nap egymás után','következő mérföldkő: 30 nap · +150 érme · bármilyen mai log életben tartja','','',false)+`<div class="ln">${T('t-shield')}<span class="g">Sorozat-mentő<small>200 érme · nálad: 1/2</small></span><button class="btn sm" data-toast="Megvetted · 2/2">Megveszem</button></div>`,2)}
  ${op('Címek',segq([['letra','Létra'],['bolt','Bolt']],S.tit,k=>`data-en="tit:${k}"`)+(bolt?`<div class="ln"><span class="g">Az éjjeli bagoly<small>120 érme</small></span><button class="lk" data-toast="Megvetted">Megveszem</button></div><div class="ln"><span class="g">A reggeli ember<small>180 érme</small></span><button class="lk" data-toast="Megvetted">Megveszem</button></div><p class="fn">A sorozat-mentő is itt vehető.</p>`
    :`${ln('','Az újonc','Lv 1','felvesz','',false)}${ln('','A kitartó','Lv 5','<b>viselve</b>','',false)}${ln('','A mester','Lv 10','Lv 10-től','',false)}`),3)}
  ${op('Jelvények · 5 / 9',BADGES.map(b=>`<div class="ln">${T(b[0])}<span class="g">${b[1]}</span><span class="v">${b[3]==='megvan'?I('i-check'):`<b>${b[3]}</b>`}</span><div class="bar q"><b style="--w:${b[2]}%"></b></div></div>`).join(''),4)}
  ${op('Perkek · 3 feloldva',[['Páncélzat','10 hét töretlen — sérülésállóság nő','Maximális erő'],['Tűzhely-mester','heti 3 meal prep — kevesebb döntés','Konyha'],['Csendes óra','reggeli jelenlét — fókusz nő','Tudatosság']].map(p=>ln('','<b>'+p[0]+'</b>',`${p[1]} · ${p[2]}`,'Lv 10','',false)).join(''),5)}
  ${fn('Az érme itt költhető el — címre vagy sorozat-mentőre. Semmi más nem vásárolható, és semmi nem jár le.',6)}`,'en');
}

/* ═══════════ NAPLÓ ═══════════ */
function naplo(){
  const done=S.dec==='done';
  const N=[['Ma','Ma reggel nagyon nyugodt voltam a meeting előtt — a légzőgyakorlat tényleg segít.','t-journal','napló'],['Tegnap','Hálás vagyok Petrának, hogy végighallgatott a munkás dologgal.','t-heart','hála'],['Szept. 22.','Túl sokat vállaltam a héten. Jövő héten egy estét szabadon hagyok.','t-journal','napló'],['Szept. 21.','Heti négy edzés — meglátjuk, belefér-e.','t-compass','döntés']];
  return pg(`<div class="sec rise" style="padding-top:10px"><span class="eb">Napló · 12 bejegyzés</span><button class="lk" data-sheet="journal">＋ Új bejegyzés</button></div>
  ${hg(`<span class="eb">Döntés · tegnap · ${done?'visszanézve':'nézd vissza'}</span><p class="quote" style="margin-top:6px">Szeptembertől heti négy edzésre váltok háromról.</p>
    ${done?`<div class="act">${I('i-check')}<span class="txt">Visszanézve · 4/5</span><button class="lk" data-sheet="decision">Mi lett belőle? ›</button></div>`:`<p class="txt sub" style="margin-top:8px">Mennyire vált be? (1–5)</p><div class="rate">${[1,2,3,4,5].map(n=>`<button data-en="dec:done">${n}</button>`).join('')}</div>`}`,1)}
  ${op('',ln('t-heart','Hálanapló','12 bejegyzés · 5 nap egymás után','','data-toast="Hála · új sor a lapon"'),2)}
  ${op('2026. szeptember',N.map(n=>`<div class="ln tap" data-sheet="journal"><time>${n[0]}</time><span class="g">${n[1]}<small>${n[3]}</small></span>${T(n[2])}</div>`).join('')+`<div class="act"><button class="lk" data-toast="Augusztus betöltése">Korábbi hónapok</button></div>`,3)}`,'naplo');
}

/* ═══════════ EMBEREK ═══════════ */
function emberek(){
  return pg(`<div class="sec rise" style="padding-top:10px"><button class="backbtn" data-go="en"><b>‹</b>Hol tartok</button><span class="inl"><button class="lk" data-sheet="plog">Log</button><button class="lk" data-sheet="pedit">＋ Új személy</button></span></div>
  ${hg(`<span class="eb">Kapcsolatok · 6 aktív kör</span><p class="verdict">Petra a legtöbbet említett; Bence hangulata lejt.</p>${big('8','említés e héten')}`,1)}
  ${op('',`<div class="ln tap" data-go="jeloltek">${T('t-orb')}<span class="g">Jelöltek<small>Marci · új arc a szövegeidben</small></span><span class="v"><b>1</b></span>${I('i-chev','chev')}</div>
    <div class="ln tap" data-go="kor"><span class="pile">${PEOPLE.slice(0,4).map(p=>av(p)).join('')}</span><span class="g">A köröm<small>6 személy · Petra a legaktívabb</small></span>${I('i-chev','chev')}</div>
    ${ln('t-chat','Említések','8 e héten · 1 figyelem-jelzés','','data-go="emlitesek"')}${ln('t-calendar','Heti kép','Bence ↘ · Petra ↗ · a hét iránya','','data-go="heti"')}`,2)}
  ${fn('Az emberek a szövegeidből, a hangjegyeidből és a Mezo-beszélgetésekből kerülnek ide.',3)}`,'en');
}
function jeloltek(arg){
  const e=arg==='ures';
  return pg(`${back('Kapcsolatok','emberek')}
  ${hg(`<span class="eb">Jelöltek</span>${big(e?'0':'1',e?'nincs új arc':'új arc a szövegeidben')}${e?`<p class="txt sub" style="margin-top:8px">Nincs több jelölt — az éjszakai kör hajnalban néz újra.</p>`:`<h2 class="t" style="margin-top:10px">Marci</h2><p class="quote" style="font-size:14.5px;margin-top:6px">„…délben futottam Marcival a gáton, jó tempót diktált…”</p><p class="txt sub" style="margin-top:6px">visszatérő név · éjszakai kör</p><div class="act"><button class="btn sm" data-sheet="pedit">${I('i-check')}Felveszem</button><button class="lk" data-go="jeloltek.ures">Nem ő az / nem kell</button></div>`}`,1)}
  ${fn('Jelöltet csak visszatérő, ismeretlen név kap. Az elvetett nevet nem javasolja újra.',2)}`,'en');
}
function kor(){
  return pg(`<div class="sec rise" style="padding-top:10px"><button class="backbtn" data-go="emberek"><b>‹</b>Kapcsolatok</button><button class="lk" data-sheet="pedit">＋ Új személy</button></div>
  ${op('A köröm · 6',PEOPLE.map(p=>`<div class="ln tap" data-go="ember">${av(p)}<span class="g">${p.n}<small>${p.r} · ${p.w}× e héten · ${p.all} említés</small></span>${spark(p.sp)}${I('i-chev','chev')}</div>`).join(''),1)}
  ${fn('A vonal a kapcsolat hangulat-íve; a borostyán keret azt jelzi, ahol a hét nehéz tónusú volt.',2)}`,'en');
}
const MEN=[['bence','t-journal','18:42 · napló','Bence-vel röpi után gyors sör, de feszült volt a meccs miatt.','edzés','nehez',true,'Volleyball · 17:30–19:00'],['reka','t-mic','22:18 · hang','Réka hívott · másfél óra, sokat segített a céges ügyben.','segítség','jo',false,'Hangjegy · 22:18'],['petra','t-journal','20:14 · napló','Petrával hosszú vacsi, csendben, jó volt.','közös program','jo',false,''],['adam','t-chat','12:05 · Mezo-chat','Ádámmal átnéztük a portfólióját.','munka','ok',false,'']];
function emlitesek(){
  const R=[['H',2,'jo'],['K',1,'ok'],['Sze',3,'nehez'],['Cs',1,'jo'],['P',0,''],['Szo',0,''],['V',1,'jo']];
  return pg(`<div class="sec rise" style="padding-top:10px"><button class="backbtn" data-go="emberek"><b>‹</b>Kapcsolatok</button><button class="lk" data-sheet="plog">Log</button></div>
  ${hg(`<span class="eb">Említések · a hét ritmusa</span>${big('8','említés e héten · 1 figyelem-jelzés')}<div class="rhythm">${R.map((d,i)=>`<div class="${i===3?'today':''}"><b style="height:${d[1]?d[1]*16:3}px;${d[2]==='nehez'?'background:var(--warn)':''}"></b><small>${d[0]}</small></div>`).join('')}</div>`,1)}
  <div class="p16 rise" style="--i:2">${segq([['mind','Mind'],['het','Hét']],S.pf,k=>`data-en="pf:${k}"`)}<p class="fn" style="margin-top:4px">Tónus: Jó · OK · Vegyes · Nehéz (ez kap színt) · kontextus: munka, edzés, közös program, konfliktus</p></div>
  ${op('',MEN.map(m=>{const p=PEOPLE.find(x=>x.id===m[0]);return `<div class="ln" style="align-items:flex-start">${av(p)}<span class="g"><b>${p.n}</b> <span class="v">${m[2]} · ${TONE[m[5]]}</span><small style="color:var(--ink);margin-top:3px">${m[3]}</small><small>${m[4]}${m[6]?' · <b style="color:var(--warn)">figyelem</b>':''}${m[7]?` · kapcsolódik: ${m[7]}`:''}</small></span>${['t-journal','t-chat'].includes(m[1])?`<button class="lk" data-toast="Visszavonva" aria-label="Visszavon">✕</button>`:T(m[1])}</div>`}).join(''),3)}`,'en');
}
function heti(){
  const dirs=[[PEOPLE[1],'↘','többször nehéz tónus, mint korábban'],[PEOPLE[0],'↗','több közös program'],[PEOPLE[3],'→','kiegyensúlyozott']];
  return pg(`${back('Kapcsolatok','emberek')}
  ${hg(`<span class="eb">Heti kép · a hét tónusa</span>${big('8','említés e héten')}<div class="tone"><b style="flex:4;opacity:.35"></b><b style="flex:2;opacity:.5"></b><b style="flex:1;opacity:.7"></b><b style="flex:1;background:var(--warn);opacity:1"></b></div><div class="leg"><span>4 jó</span><span>2 OK</span><span>1 vegyes</span><span><i class="bd" style="background:var(--warn);opacity:1"></i>1 nehéz</span></div>`,1)}
  ${op('Irányok · 7 nap',dirs.map(d=>`<div class="ln tap" data-go="ember">${av(d[0])}<span class="g">${d[0].n} ${arr(d[1])}<small>${d[2]} · ${d[0].w}× e héten</small></span>${spark(d[0].sp)}${I('i-chev','chev')}</div>`).join(''),2)}
  ${op('A hét pillanata',`<div class="ln">${av(PEOPLE[3])}<span class="g">Réka <span class="v">péntek 22:18 · napló</span><small style="color:var(--ink);margin-top:3px">„Réka hívott · másfél óra, sokat segített a céges ügyben.”</small></span></div>`,3)}
  ${op('Csendben maradt · 1',`<div class="ln">${av(PEOPLE[4])}<span class="g">Márk<small>10 napja · Mentee — jólesne neki egy jel?</small></span><button class="lk" data-sheet="plog">Írok neki</button></div>`,4)}
  ${fn('Az irányok és a tónus-sáv az e heti említésekből jönnek — a hétfői heti áttekintés erre is kitér.',5)}`,'en');
}
function ember(){
  const p=PEOPLE[0];
  return pg(`<div class="sec rise" style="padding-top:10px"><button class="backbtn" data-go="kor"><b>‹</b>A köröm</button><button class="lk" data-sheet="pedit">Szerkesztés</button></div>
  ${hg(`<div class="hero-w">${av(p,'lg')}<div class="lines"><h1 class="t" style="font-size:26px">${p.n}</h1><p>${p.r}</p></div></div>${cells([['41','','összes'],['3×','','e héten'],['Jó','','hangulat']])}
    <span class="eb" style="margin-top:8px">Hangulat-ív · júl → szept</span><div class="chart"><svg viewBox="0 0 300 50" role="img" aria-label="Hangulat-ív">${[5,6,6,7,6,8,7,8,9,8,9,10].map((v,i)=>`<rect x="${i*25+2}" y="${48-v*4.4}" width="18" height="${v*4.4}" rx="2" style="fill:var(--sub);opacity:.55"/>`).join('')}</svg></div>`,1)}
  ${op('Milyen helyzetekben',[['közös program',48],['család',30],['segítség',22]].map(c=>ln('',c[0],'',`<b>${c[1]}%</b>`,'',false).replace('</div>',`<div class="bar q"><b style="--w:${c[1]}%"></b></div></div>`)).join(''),2)}
  ${op('Kapcsolt események · 3',[['t-pin','Nyári szabadság · júl 14–21','életesemény · kapcsolódik · erős'],['t-ring','Az utolsó barátnő','cél · kapcsolódik'],['t-pattern','Hétvégi közös főzés','minta · kapcsolódik']].map(e=>ln(e[0],e[1],e[2],'','data-toast="A tudástárba visz (Mezo)"')).join(''),3)}
  ${op('Amit Mezo tud',`<p class="txt">Allergén: kagyló · konyhakerülő · reggeli ember</p>`,4)}
  ${op('Idővonal',[['t-journal','20:14 · tegnap','közös program','Petrával hosszú vacsi, csendben, jó volt.'],['t-mic','08:02 · kedd','család','Petra elvitte a kocsit szervizbe.'],['t-chat','21:40 · hétfő','segítség','Végighallgatott a munkás dologgal.']].map(t=>`<div class="ln" style="align-items:flex-start">${T(t[0])}<span class="g"><span class="v">${t[1]} · ${t[2]}</span><small style="color:var(--ink);margin-top:3px">${t[3]}</small></span></div>`).join(''),5)}
  <div class="foot"><button class="btn" data-sheet="plog">${T('t-mic')}Log most</button></div>`,'en');
}

/* ═══════════ ÉRTESÍTÉSEK ═══════════ */
function ertesitesek(arg){
  if(arg==='ures') return pg(`${back('Hol tartok','en')}${hg(`<span class="eb">Értesítések</span>${big('0','még nincs értesítésed')}`,1)}`,'en');
  const row=(icn,t,x,tm,u)=>`<div class="ln tap" data-toast="A kapcsolódó oldalra visz">${T(icn)}<span class="g">${t}${u?'<span class="dot"></span>':''}<small>${x}</small></span><time style="width:auto">${tm}</time></div>`;
  return pg(`${back('Hol tartok','en')}
  ${hg(`<span class="eb">Értesítések</span>${big('3','olvasatlan · 11 értesítés')}`,1)}
  ${op('Ma',row('t-pattern','Új minta vár döntésre','A késői vacsora és a felszínes alvás között erős jel rajzolódik ki…','09:12',1)+row('t-orb','Bejött egy előrejelzés','A múlt heti jóslatod a pihenőnapról beigazolódott.','08:40',1)+row('t-people','Új arc a szövegeidben','Marci · visszatérő név','07:55',1),2)}
  ${op('Tegnap',row('t-scroll','Elkészült a heti memoár','A hét története, hét fejezetben.','21:02')+row('t-harvest','Beérett egy szokás','Az „Ébredés időben” már magától megy.','18:30')+row('t-flask','Kísérlet: 5. nap','A koffein-cutoff kísérlet félúton jár.','09:00'),3)}
  ${op('Szept. 21.',row('t-calendar','Kész a heti áttekintés','Az egyensúly hete — 72 pont.','20:00')+row('t-book','Új tény a tudástárban','Reggel jobban megy a fókusz.','14:12')+row('t-chat','A konzílium döntött','A regeneráció most elsőbbséget kap.','11:40'),4)}
  ${fn('Egy sorra koppintva az olvasottá válik és a helyére visz; a „Mind olvasott” a fejléc paneljén marad.',5)}`,'en');
}

/* ═══════════ BEÁLLÍTÁSOK ═══════════ */
const DOMC={fuel:'#8FB49A',train:'#CF6B5E',mezo:'#AB9FD2',en:'#D98B9D',nap:'#CFA14A'};
const dmk=d=>csepp('ok',57,{s:28,form:'ok',color:DOMC[d],alive:false});
const sth=(eb,h,p)=>hg(`<span class="eb">${eb}</span><h1 class="t" style="margin:6px 0 6px">${h}</h1><p class="txt sub">${p}</p>`,1);
const srow=(icn,t,s,go,extra='')=>ln(icn,t,s,extra,go?(go[0]==='#'?`data-go="${go.slice(1)}"`:`data-toast="${go}"`):'');
function beall(){
  const D=[['fuel','Fuel','Táplálkozás, ahogy neked jó.','Kalória és makrók · étkezési ritmus','Fuel beállítások (a Fuel-körben kész)'],['train','Edzés','Helyet a mozgásnak.','Gym-időpontok · rendszeres sport','#b-train'],['mezo','Mezo','A közös nyelvünk.','Rólam · instrukciók · személyes kontextus','#b-mezo'],['en','Én','A tested. A céljaid.','Testprofil · súlycél · alvás','#b-me'],['nap','Nap','Jó reggeltől a pihenésig.','Napi horgonyok · emlékeztetők','#b-nap']];
  return pg(`${back('Vissza','en')}${sth('Mezo · beállítások','Legyen a tiéd.','Egy helyen minden, ami hozzád igazítja a Mezót.')}
  ${op('Innen érkeztél',`<div class="ln tap" data-go="b-me">${dmk('en')}<span class="g">Én<small>Testprofil · súlycél · alvás</small></span>${I('i-chev','chev')}</div>`,2)}
  ${op('A te területeid',D.map(d=>`<div class="ln tap" ${d[4][0]==='#'?`data-go="${d[4].slice(1)}"`:`data-toast="${d[4]}"`}>${dmk(d[0])}<span class="g">${d[1]} <span class="v">${d[2]}</span><small>${d[3]}</small></span>${I('i-chev','chev')}</div>`).join(''),3)}
  ${op('Az app körülötted',srow('i-bell','Értesítések','Mikor és miről szóljon a Mezo','#b-ert')+srow('c-i-kristaly','Megjelenés és alkalmazás','Kalauzok, fiók, jelszó','#b-alt')+srow('t-gear','Fiókod','Név és e-mail-cím','#b-fiok'),4)}
  ${fn('Minden terület ugyanazokat az alapadatokat használja. Amit itt javítasz, az appban is követ.',5)}`,'en');
}
function btrain(){
  return pg(`${back('Beállítások','beall')}${sth('Edzés','Helyet a mozgásnak.','A terved mondja, mit. Te döntöd el, mikor. A hét többi része igazodik.')}
  ${op('',cells([['4','','gym-időpont / hét'],['2','','sportalkalom / hét']])+`<div class="wk7">${[['H','07:00'],['K','—',1],['Sze','07:00'],['Cs','17:30'],['P','07:00'],['Szo','10:00'],['V','—',1]].map(d=>`<span class="${d[2]?'off':''}">${d[0]}<b>${d[1]}</b></span>`).join('')}</div>`,2)}
  ${op('',srow('t-dumbbell','Heti gym-időpontok','4 alkalom · reggel','Gym-időpontok szerkesztése (lap)')+srow('t-volley','Rendszeres sport','Röplabda · Cs, Szo','Sport-időpontok szerkesztése (lap)')+srow('i-bell','Edzésemlékeztetők','Edzés előtt 30 perccel','#b-ert'),3)}
  ${fn('Az időpontokból tudja a Nap és a Fuel, mikor edzel.',4)}`,'en');
}
function bme(){
  return pg(`${back('Beállítások','beall')}${sth('Én','A tested, a céljaid, a pihenésed.','Az alapok változnak. A beállításaid követhetik.')}
  ${op('',cells([['180','cm','magasság · testprofil'],['8','óra','alváscél']]),2)}
  ${op('',srow('t-person','Testprofil','34 év · 180 cm · 15% testzsír','Testprofil szerkesztése (lap)')+srow('t-weight','Súlycél','Fogyás · 76 kg · −0,4 kg/hét','#b-cel')+srow('t-sleep','Alvás és napi horgony','23:00 lefekvés · 07:00 ébredés','Alváscél szerkesztése (lap)')+srow('t-orb','Mit tud rólam Mezo?','A személyes alapjaid','#b-szemely.about'),3)}`,'en');
}
function bcel(){
  return pg(`${back('Én beállításai','b-me')}
  ${hg(`<span class="eb">Fogyás · aktív</span>${big('76','kg célsúly')}${cells([['78,4','','most'],['2,4','kg','hátra'],['38%','','teljesült']])}`,1)}
  ${op('A te tempódban · célból dátum',`<div class="two">${fld('Célsúly (kg)','76,0')}${fld('Céltempó (kg/hét)','0,4')}</div><p class="txt" style="margin-top:12px"><span class="eb">Becsült céldátum · számított</span><b>november 2.</b> — reális, a tempó belefér.</p>`,2)}
  ${op('Jelenleg mentett cél',[['Irány','Fogyás'],['Súlyút','80,0 → 76,0 kg'],['Célablak','W 4 / 10'],['Céltempó','−0,4 kg/hét'],['Várható céldátum','nov. 2.'],['Védőkorlátok','Erővédelem · Izomvédelem']].map(r=>ln('',r[0],'',`<b>${r[1]}</b>`,'',false)).join('')+`<div class="act"><button class="btn ghost sm" data-toast="Cél szerkesztése (lap)">Cél szerkesztése</button></div>`,3)}`,'en');
}
function bmezo(){
  return pg(`${back('Beállítások','beall')}${sth('Mezo és te','Legyen világos, mit tud rólad.','És hogyan szóljon hozzád. Amit itt megírsz, azt Mezo minden beszélgetésben szem előtt tartja.')}
  ${op('A közös nyelvünk',srow('t-person','Rólam','A saját szavaimmal · te alakítod','#b-szemely.about')+srow('t-chat','Így beszélj velem','Saját instrukció és tanult stílus','#b-szemely.communication'),2)}
  ${op('Átlátható működés',srow('t-orb','Ezt kapja meg Mezo','A pontos összeállított szöveg','#b-szemely.context')+srow('i-bell','Mezo jelzései','Minták, előrejelzések, összegzések','#b-ert'),3)}`,'en');
}
function bnap(){
  return pg(`${back('Beállítások','beall')}${sth('Nap','A ritmus, ami összefogja a napodat.','Jó reggeltől a lecsendesedésig.')}
  ${op('',cells([['07:00','','ébredés'],['23:00','','pihenés']]),2)}
  ${op('',srow('t-dawn','Ébredés és lefekvés','A napod két horgonya','Alvás és napi ritmus (Én beállításai)')+srow('t-checkin','Check-in és napzárás','Emlékeztetők','#b-ert')+srow('t-plate','Étkezési ritmus','Étkezési ablakok','Fuel beállítások (a Fuel-körben kész)'),3)}
  ${fn('A Nap a többi terület időpontjaiból rakja össze a ritmusod.',4)}`,'en');
}
function balt(){
  return pg(`${back('Beállítások','beall')}${sth('Megjelenés és alkalmazás','Otthon az appban.','Ugyanaz a világ. A saját fényeiddel és szokásaiddal.')}
  ${op('Fiók',srow('t-person','Daniel','daniel@pelda.hu','#b-fiok')+srow('t-gear','Jelszó módosítása','A belépésed maradjon a tiéd','Jelszó módosítása (lap)')+srow('t-skip','Kijelentkezés','','Kijelentkezés'),2)}
  ${op('Ami körülvesz',srow('i-bell','Értesítések','18 / 22 kategória','#b-ert')+srow('t-compass','Kalauzok újranézése','Minden oldal kalauza újra megjelenik','Kész — a kalauzok újra megjelennek'),3)}
  ${op('Tulajdonosi eszközök',srow('t-coin','AI-napló','Költség és hívások','Tulajdonosi konzol (a 10. szeletben)')+srow('t-people','Admin','Meghívók · felhasználók','Tulajdonosi konzol (a 10. szeletben)'),4)}`,'en');
}
function bert(){
  const cat=(icn,t,s,on,min)=>`<div class="ln">${T(icn)}<span class="g">${t}<small>${s}${min?` · −${min} perc`:''}</small></span>${tgl(on,t)}</div>`;
  const hrs=[0,0,0,0,0,0,0,1,1,0,0,0,1,0,0,0,0,0,1,0,2,1,1,0];
  return pg(`${back('Beállítások','beall')}
  ${hg(`<span class="eb">Értesítés-beállítások</span>${big('9','tervezett ma · nyugodt ritmus')}<div class="bars24">${hrs.map(h=>`<i class="${h===2?'hot':''}" style="height:${h?h*16+8:4}px"></i>`).join('')}</div><div class="ax">${[0,4,8,12,16,20,24].map(x=>`<span>${x}</span>`).join('')}</div><p class="txt sub" style="margin-top:8px">Sűrű ablak — 20 és 22 óra között 4 értesítés esne.</p>`,1)}
  ${op('',`<div class="ln">${I('i-bell')}<span class="g">Push értesítések<small>iPhone · engedélyezve</small></span>${tgl(1,'Push')}</div><div class="act"><button class="btn ghost sm" data-toast="Teszt értesítés elküldve">${T('t-send')}Teszt értesítés küldése</button></div>`,2)}
  ${op('Mezo megszólal',[['t-dawn','Reggeli briefing','07:15',1],['t-note','Déli jegyzet','12:30',1],['t-score','Heti elemzés','vasárnap 19:00',1],['t-calendar','Heti összefoglaló','hétfő 08:00',0],['t-dawn','Napzárás','21:30',1,15],['t-sleep','Alvás-reakció','ébredés után',1],['t-weight','Súly-reakció','mérés után',1]].map(c=>cat(...c)).join(''),3)}
  ${op('Emlékeztetők',[['t-dumbbell','Edzés előtt','30 perccel előtte',1,30],['t-syringe','Gyógyszer beadás','hétfő 20:00',1],['t-clock','Napzárás','22:00',0],['t-moon','Villanyoltás','22:45',1],['t-rested','Lecsendesítés','22:15',1],['t-checkin','Check-in','09:00',1],['t-supps','Fuel & stack','étkezésekhez',1]].map(c=>cat(...c)).join(''),4)}
  ${op('Az agy eseményei',[['t-pattern','Minták','ha új jel rajzolódik ki',1],['t-book','Tudástár','új tény',0],['t-orb','Előrejelzések','ha beteljesül',1],['t-flask','Kísérletek','napi állás',1],['t-quest','Kihívások','indulás, zárás',1],['t-stack','Memória','új emlék',0],['t-compass','Döntés visszanézés','ha esedékes',1],['t-shield','Közbelépések','ha Mezo szól',1]].map(c=>cat(...c)).join(''),5)}
  ${fn('Az agy eseményei eseményvezéreltek — nem szerepelnek a napi terhelés előnézetben.',6)}`,'en');
}
function bfiok(){
  return pg(`${back('Beállítások','b-alt')}${sth('A fiókod','A neved és a címed.','Amivel belépsz.')}
  <div class="p16 rise" style="--i:2">${fld('Név','Daniel')}${fld('E-mail-cím','daniel@pelda.hu')}<div class="act" style="margin-top:18px"><button class="btn" data-toast="Fiókadatok mentve.">Fiókadatok mentése</button></div></div>`,'en');
}
function bszemely(mode){
  mode=mode||'about';
  const M={about:['Rólam, a saját szavaimmal','Amit még tudj rólam','Hétköznap szoftverfejlesztő vagyok, este röpizek. A reggelek a legjobb időszakom…'],communication:['Így beszélj velem','Az én kérésem','Legyél tömör és egyenes. Ne dicsérj feleslegesen, mondd meg, ha hibázok…'],context:['Ezt kapja meg Mezo']};
  const m=M[mode]||M.about;
  const top=`${back('Mezo és te','b-mezo')}${sth('Mezo · beállítások',m[0],mode==='context'?'Pontosan ez kerül minden beszélgetés elejére.':'Csak te szerkeszted. A következő beszélgetéstől érvényes.')}
  <div class="p16 rise" style="--i:2">${segq([['about','Rólam'],['communication','Stílus'],['context','Kontextus']],mode,k=>`data-go="b-szemely.${k}"`)}</div>`;
  if(mode==='context') return pg(top+op('',[['Személyes alapok','bekerül','Fiók · testadatok','Daniel, 34 éves, 180 cm, 78,4 kg.'],['Saját bemutatkozás','bekerül','Rólam','Hétköznap szoftverfejlesztő vagyok…'],['Tanult stílus','nem kerül be','Így beszélj velem','A tanult profil ki van kapcsolva.']].map(s=>`<div class="ln" style="align-items:flex-start"><span class="g"><b>${s[0]}</b> <span class="v">${s[1]}</span><small>forrás: ${s[2]}</small><small style="color:var(--ink);margin-top:3px">${s[3]}</small><button class="lk" style="margin-top:4px" data-toast="Javítás">${s[0]} javítása ›</button></span></div>`).join('')+`<div class="act"><button class="btn ghost sm" data-toast="Kinyitva">Pontos összeállított szöveg ▾</button></div>`,3),'en');
  return pg(top+(mode==='about'?op('Az alapok, amiket ismer',`<p class="txt">Daniel · 34 év · 180 cm · fogyás 76 kg-ig · heti 4 edzés</p>`,3)+op('A tények forrása',srow('t-person','Név és fiók','','#b-fiok')+srow('t-heart','Testadatok és életkor','','#b-me')+srow('t-weight','Súly- és edzéscéljaim','','#b-cel'),4):'')+
    op(m[1],ta('',m[2])+`<p class="fn" style="display:flex;justify-content:space-between"><span>Csak te szerkeszted</span><span>${m[2].length} / 4000</span></p>${mode==='communication'?`<div class="ln"><span class="g">Tanult kommunikációs profil használata</span>${tgl(1,'Tanult profil')}</div>`:''}<div class="act"><button class="btn" data-toast="Mentve — a következő beszélgetési fordulótól érvényes.">Változtatások mentése</button></div>`,5)+
    (mode==='communication'?op('Amit Mezo tanult a stílusodról',`<p class="txt"><b>Tömör, adatvezérelt.</b> Rövid válaszokat szeretsz, számokkal. Az érzelmi kérdéseknél lassabb tempót.</p>`,6):'')+
    op('',srow('t-orb','Nézd meg, mi kerül be','','#b-szemely.context'),7),'en');
}
function ikonok(){
  const MISSING=[['Felfedezések · Jelöltek (lens)','t-orb','a heti felfedezések sora, a jelöltek — most a gömb áll helyette'],['Jelek (signal)','c-i-eletjel','„Jelek · mit figyel a rendszer” — most az életjel'],['Légzés (breath)','t-rested','éjszakai mód · vezetett légzés — most a kipihentség'],['Ideje felkelni (candle)','t-dawn','éjszakai mód · 20 perces szabály — most a hajnal'],['LIFE Lv 5 (brain)','c-i-tudas','kitüntetések · jelvény — most a tudás'],['Első küldetés (flag)','t-quest','kitüntetések · jelvény — most a küldetés'],['Jelszó és fiók (key)','t-gear','fiókod, jelszó — most a fogaskerék'],['Kijelentkezés (exit)','t-skip','megjelenés és alkalmazás — most a kihagyás'],['Megjelenés (palette)','c-i-kristaly','a beállítások „Megjelenés” sora — most a kristály'],['Tevékenység (pencil)','t-note','a Növekedés tevékenység-sorai — most a jegyzet']];
  return pg(`${back('Hol tartok','en')}
  ${hg(`<span class="eb">Új ikonok · az Én kéri</span><h1 class="t" style="margin:6px 0 6px">Tíz jel hiányzik</h1><p class="txt sub">Az élő Én képernyők ezeket használják, de az acél készletben még nincsenek. Alább a helyettesítő, amivel most dolgozik a prototípus. Ha rendben vannak, bekerülnek a közös készletbe.</p>`,1)}
  ${op('Hiányzó jel → mostani helyettesítő',MISSING.map(m=>ln(m[1],m[0],m[2],'')).join(''),2)}
  ${fn('Minden más Én-ikon (súly, alvás, cél, emberek, napló, életterületek, LIFE skillek) már az acél készletből jön. Emoji sehol.',3)}`,'en');
}

/* ═══════════ LAPOK (alulról) ═══════════ */
const shh=(icn,eb,h,s)=>`<div class="shh">${T(icn)}<span class="g"><span class="eb">${eb}</span><h2 class="t">${h}</h2>${s?`<small class="fn" style="margin:2px 0 0">${s}</small>`:''}</span><button class="lk" data-close aria-label="Bezár">✕</button></div>`;
const pair=(ok,okAttr)=>`<div class="act" style="justify-content:flex-end"><button class="lk" data-close>Mégse</button><button class="btn sm" ${okAttr}>${I('i-check')}${ok}</button></div>`;
const sheets={
  weight:()=>`${shh('t-weight','Súly','Mi a számunk ma?','Egy mérés a napodban.')}${big('78,4','kg · tegnap 78,6')}<div class="inl" style="margin-top:10px">${['−0,5','−0,1','+0,1','+0,5'].map(n=>`<button class="chip" data-toast="${n} kg">${n}</button>`).join('')}</div>${ta('Egy mondat · opcionális','pl. sós vacsora tegnap',true)}${pair('Mentés','data-toast="Mentve · 78,4 kg"')}`,
  sleep:()=>`${shh('t-sleep','Alvás','Hogyan aludtunk?')}${segq([['k','Kézi'],['s','Screenshot']],'k',()=>`data-toast="Screenshot-mód"`)}<div class="two">${fld('Lefekvés','23:20')}${fld('Ébredés','06:30')}</div><div class="two">${fld('Alvásidő (óra)','7,1')}${fld('Minőség / 10','7')}</div><div class="two">${fld('Ébredések éjjel','1')}${fld('Ágyban (perc)','430')}</div>${pair('Mentés','data-toast="Mentve"')}`,
  pillar:()=>`${shh('c-i-eletjel','Pillér','Pillér a katalógusból')}${[['Alvás',['Alvásidő','Lefekvés ideje','Minőség']],['Fuel',['Fehérje','Kalória','Rost']],['Edzés',['Edzésnapok','Heti szettek']],['Elme',['Check-in energia','Hangulat']],['Emberek',['Említett emberek']]].map(g=>`<span class="eb" style="margin-top:12px">${g[0]}</span><div class="inl" style="margin-top:6px">${g[1].map(n=>`<button class="chip" data-toast="${n} hozzáadva">${n}</button>`).join('')}</div>`).join('')}<div class="act" style="justify-content:flex-end"><button class="lk" data-close>Mégse</button></div>`,
  stats:()=>`${shh('t-book','A kutatás számai','Miért számít az alvás?')}${[['A rendszeresség a király','Az azonos lefekvési idő erősebben jár együtt a jó közérzettel, mint az alvás hossza.'],['7 óra alatt','Kevesebb REM és mély alvás — a regeneráció a második felében történik.'],['Az éjszakai ébredés normális','Egy-két rövid ébredés minden éjszaka része.']].map(r=>ln('',`<b>${r[0]}</b>`,r[1],'','',false)).join('')}`,
  journal:()=>`${shh('t-journal','Napló','Mi jár a fejedben?','A gondolataidnak itt van helye.')}${segq([['n','Napló'],['d','Döntés'],['h','Hála']],'n',k=>`data-toast="${k==='d'?'Döntés':'Hála'} mód"`)}${ta('','Ma reggel sokkal nyugodtabb voltam a meeting előtt, a légzőgyakorlat tényleg segít. Holnap is megcsinálom.')}${fld('Dátum','2026. 09. 24.')}${pair('Mentés','data-toast="Mentve"')}`,
  decision:()=>`${shh('t-compass','Döntés','Mennyire vált be? (1–5)')}<div class="rate">${[1,2,3,4,5].map(n=>`<button class="${n===4?'on':''}" data-toast="${n} / 5">${n}</button>`).join('')}</div>${ta('Mi lett belőle? (nem kötelező)','Három hét után belefér, a péntek a nehéz.')}${pair('Mentés','data-toast="Mentve"')}`,
  plog:()=>`${shh('t-people','Emberek · gyors log','Mit jegyzünk meg?')}<span class="eb" style="margin-top:10px">Ki?</span><div class="inl" style="margin-top:6px">${PEOPLE.slice(0,5).map((p,i)=>`<button class="chip ${i?'':'on'}" data-toast="${p.n}">${p.n}</button>`).join('')}</div><span class="eb" style="margin-top:12px">Hogy érzed</span><div class="inl" style="margin-top:6px">${Object.values(TONE).map((t,i)=>`<button class="chip ${i?'':'on'}" data-toast="${t}">${t}</button>`).join('')}</div>${ta('Egy mondat · opcionális','pl. „Petrával hosszú vacsi, csendben”',true)}${pair('Mentés','data-toast="Mentve"')}`,
  pedit:()=>`${shh('t-person','Emberek','Új személy')}${fld('Név','Marci')}${fld('Becenév','pl. Marcika',true)}<span class="eb" style="margin-top:12px">Kapcsolat</span><div class="inl" style="margin-top:6px">${['Barát','Család','Kolléga','Csapattárs','Ismerős'].map((k,i)=>`<button class="chip ${i===4?'on':''}" data-toast="${k}">${k}</button>`).join('')}</div>${ta('Jegyzet','honnan ismered, mi fontos…',true)}${pair('Felveszem','data-toast="Felvéve"')}`,
  gate:()=>`${shh('t-heart','Új cél','Előbb: a biometriád','A súlycélhoz tudnom kell, kiből indulunk.')}<p class="txt sub" style="margin-top:8px">Hiányzik: nem. Egyszeri beállítás · kb. 20 mp.</p><div class="act" style="justify-content:flex-end"><button class="lk" data-close>Mégse</button><button class="btn sm" data-go="sulyuj.1">Biometria beállítása →</button></div>`,
};

/* ═══════════ regisztráció, nézet-állapot ═══════════ */
const routes={en:hub,mai:hub,celok,cel,celuj,jelek,sulycel,sulyresz,sulyuj,test,suly:test,alvas:()=>test('alvas'),ejszaka,het,elemzes,napok,felfedezesek,tanulsagok,
  novekedes,skillek,tevekenysegek,kitunt,naplo,emberek,jeloltek,kor,emlitesek,heti,ember,ertesitesek,
  beall,'b-train':btrain,'b-me':bme,'b-cel':bcel,'b-mezo':bmezo,'b-nap':bnap,'b-alt':balt,'b-ert':bert,'b-fiok':bfiok,'b-szemely':bszemely,ikonok};
function soft(){const ph=document.getElementById('phone');const sc=ph.querySelector('.scroll');const y=sc?sc.scrollTop:0;const f=routes[K.R]||hub;ph.innerHTML=f(K.ARG);const sc2=ph.querySelector('.scroll');if(sc2)sc2.scrollTop=y}
document.addEventListener('click',e=>{
  if(K.D!=='en')return; const el=e.target.closest('[data-en]'); if(!el)return;
  e.preventDefault(); const [k,v]=el.dataset.en.split(':');
  if(k==='tgl'){el.classList.toggle('on');return}
  if(k==='dim'){el.classList.toggle('off');return}
  if(k==='wk'){S.wk=S.wk===+v?-1:+v}
  else if(k==='drawer'){if(v==='p')S.dp=!S.dp;else S.df=!S.df}
  else if(k==='life'){S.life=!S.life}
  else S[k]=v;
  soft();
});
register('en',{
  mark:'i-hub',
  tabs:[['Hol tartok','i-hub','en'],['Test','i-weight','test'],['Célok','i-target','celok'],['Napló','i-book','naplo']],
  routes,sheets,
  css:`
${E} .strip{display:flex;align-items:center;gap:10px;width:100%;padding:12px 16px 0;font-family:var(--mono);font-size:11.5px;color:var(--sub)}
${E} .strip .g{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} ${E} .strip b{color:var(--ink);font-weight:500}
${E} .av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:12.5px;font-weight:500;color:var(--ink);box-shadow:inset 0 0 0 1px var(--hair);flex:0 0 auto;background:var(--card2)}
${E} .av.lg{width:56px;height:56px;font-size:22px} ${E} .av.att{box-shadow:inset 0 0 0 1.5px var(--warn)}
${E} .pile{display:inline-flex;flex:0 0 auto} ${E} .pile .av{margin-left:-9px} ${E} .pile .av:first-child{margin-left:0}
${E} .hero-w{display:flex;gap:14px;align-items:center} ${E} .hero-w .lines{flex:1;min-width:0} ${E} .hero-w .lines p{font-size:13px;line-height:1.45;color:var(--sub);margin-top:5px} ${E} .hero-w .lines p b{color:var(--ink);font-weight:500}
${E} .ring.wring{width:96px;height:96px} ${E} .ring.wring svg{width:96px;height:96px} ${E} .ring.wring .c b{font-size:26px}
${E} .ring.permah{width:92px;height:92px} ${E} .ring.permah svg{width:92px;height:92px;transform:none} ${E} .ring.permah .c b{font-size:26px}
${E} .verdict{font-family:var(--disp);font-weight:var(--dispw);letter-spacing:var(--dispt);font-size:18px;line-height:1.25;color:var(--ink);text-wrap:balance}
${E} .chart{margin:10px 0 2px} ${E} .chart svg,${E} .dial{width:100%;height:auto;display:block;overflow:visible}
${E} svg .gl{font-family:var(--mono);font-size:9.5px;fill:var(--faint)}
${E} .leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:6px} ${E} .leg i{display:inline-block;width:12px;height:2px;background:var(--acc);vertical-align:middle;margin-right:5px}
${E} .leg i.raw{width:5px;height:5px;border-radius:50%;background:var(--sub)} ${E} .leg i.pl{background:none;border-top:1px dashed var(--faint);height:0} ${E} .leg i.bd{height:8px;background:var(--sub);opacity:.4}
${E} .slband{display:flex;align-items:flex-end;gap:4px;height:22px;margin-top:10px} ${E} .slband i{flex:1;background:var(--sub);opacity:.35;border-radius:1px}
${E} .cells9{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 10px;padding:8px 0 2px} ${E} .cells9 span{display:block;min-width:0}
${E} .cells9 b{display:block;font-family:var(--disp);font-weight:var(--dispw);font-size:19px;letter-spacing:-.5px;font-variant-numeric:tabular-nums;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${E} .cells9 b i{font-family:var(--mono);font-style:normal;font-size:10px;letter-spacing:0;color:var(--sub);font-weight:400;margin-left:3px}
${E} .cells9 small{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--faint);margin-top:3px} ${E} .cells9 .att b{color:var(--warn)}
${E} .segq{display:flex;gap:16px;padding:4px 0 2px;font-size:13px} ${E} .segq button{color:var(--sub);padding:4px 0;border-bottom:1.5px solid transparent} ${E} .segq button.on{color:var(--ink);border-bottom-color:var(--ink)}
${E} .d7{display:inline-flex;gap:3px;vertical-align:middle} ${E} .d7 i{width:7px;height:7px;border-radius:50%;background:var(--sub);opacity:.75}
${E} .d7 i.part{background:linear-gradient(90deg,var(--sub) 50%,transparent 50%);box-shadow:inset 0 0 0 1px var(--sub)} ${E} .d7 i.miss{background:transparent;box-shadow:inset 0 0 0 1px var(--sub);opacity:.5} ${E} .d7 i.nd{background:transparent;box-shadow:inset 0 0 0 1px var(--hair)}
${E} .heat{display:grid;grid-template-columns:repeat(14,10px);gap:3px} ${E} .heat i{width:10px;height:10px;border-radius:2px;background:var(--sub);opacity:.7} ${E} .heat i.part{opacity:.35} ${E} .heat i.miss{background:transparent;box-shadow:inset 0 0 0 1px var(--hair);opacity:1}
${E} .arr{font-family:var(--mono);font-size:13px;color:var(--sub)}
${E} .dims{display:flex;flex-wrap:wrap;gap:6px 14px;padding-top:4px} ${E} .dim{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--ink)} ${E} .dim b{font-family:var(--mono);font-weight:500;color:var(--sub);font-size:11px;margin-left:2px} ${E} .dim.off{color:var(--faint)} ${E} .dim svg.ic.td{width:18px;height:18px} ${E} .dim.off svg.ic.td{opacity:.4}
${E} .fld{display:block;margin-top:12px} ${E} .fld .inp{display:block;padding:8px 0;border-bottom:1px solid var(--hair);font-size:15px;color:var(--ink);margin-top:2px;min-width:0;overflow-wrap:anywhere} ${E} .fld .inp.ph{color:var(--faint)} ${E} .fld .ta{min-height:56px;line-height:1.45;font-size:14px}
${E} .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 16px}
${E} .tgl{width:34px;height:20px;border-radius:10px;border:1px solid var(--hair);position:relative;flex:0 0 auto;background:transparent;padding:0} ${E} .tgl::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--sub);transition:.2s} ${E} .tgl.on{background:var(--acc);border-color:var(--acc)} ${E} .tgl.on::after{left:16px;background:var(--acc-ink)}
${E} .prog{display:flex;gap:4px;height:2px;margin:4px 0 14px} ${E} .prog i{flex:1;background:var(--hair)} ${E} .prog i.on{background:var(--ink)} ${E} .stepl{display:flex;justify-content:space-between;margin-bottom:8px}
${E} .foot{display:flex;gap:14px;align-items:center;justify-content:flex-end;padding:18px 16px 4px}
${E} .ln .g .v{white-space:normal}
${E} .quote{font-family:var(--disp);font-size:16px;line-height:1.4;color:var(--ink);text-wrap:balance}
${E} .rate{display:flex;gap:8px;margin-top:10px} ${E} .rate button{flex:1;padding:9px 0;text-align:center;border:1px solid var(--hair);border-radius:8px;font-family:var(--mono);font-size:13px;color:var(--ink)} ${E} .rate button.on{background:var(--acc);color:var(--acc-ink);border-color:var(--acc)}
${E} .bars24{display:flex;align-items:flex-end;gap:2px;height:44px;margin-top:10px} ${E} .bars24 i{flex:1;background:var(--sub);opacity:.5;border-radius:1px} ${E} .bars24 i.hot{background:var(--warn);opacity:1} ${E} .ax{display:flex;justify-content:space-between;font-family:var(--mono);font-size:9.5px;color:var(--faint);margin-top:4px}
${E} .wk7{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:10px} ${E} .wk7 b{display:block;font-size:11.5px;color:var(--ink);font-weight:500;margin-top:3px} ${E} .wk7 .off b{color:var(--faint)}
${E} .inl{display:inline-flex;gap:8px 10px;flex-wrap:wrap;align-items:center} ${E} .chip.on{color:var(--ink);border-color:var(--sub)}
${E} .mb{display:inline-flex;align-items:flex-end;gap:2px;height:20px;flex:0 0 auto} ${E} .mb i{width:4px;background:var(--sub);opacity:.6;border-radius:1px} ${E} .mb i.nd{opacity:.2}
${E} .sbars{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:12px} ${E} .sbars button{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:84px} ${E} .sbars em{font-family:var(--mono);font-style:normal;font-size:10px;color:var(--sub)} ${E} .sbars i{width:100%;max-width:26px;background:var(--sub);opacity:.6;border-radius:3px} ${E} .sbars i.nd{opacity:.15} ${E} .sbars small{font-family:var(--mono);font-size:9.5px;color:var(--faint)}
${E} .wnav{display:inline-flex;gap:14px;font-size:18px;color:var(--sub)} ${E} .wnav button[disabled]{color:var(--faint);cursor:default}
${E} .spark{width:64px;height:22px;flex:0 0 auto;overflow:visible}
${E} .days{padding:4px 0 8px 76px} ${E} .days div{display:flex;gap:10px;padding:5px 0;font-size:12.5px;border-top:1px solid var(--hair)} ${E} .days div span{flex:1;color:var(--sub)} ${E} .days div b{font-family:var(--mono);font-weight:500} ${E} .days div em{font-family:var(--mono);font-style:normal;color:var(--faint);width:40px;text-align:right} ${E} .days .lk{margin-top:8px}
${E} .rail{display:flex;height:6px;border-radius:3px;overflow:hidden;gap:1px;margin-top:8px} ${E} .rail i{display:block;background:var(--sub)}
${E} .band{position:relative;width:96px;height:6px;border-radius:3px;background:var(--hair);flex:0 0 auto} ${E} .band s{position:absolute;top:0;height:100%;background:var(--sub);opacity:.35;border-radius:3px} ${E} .band u{position:absolute;top:-3px;width:2px;height:12px;background:var(--ink);text-decoration:none}
${E} .dialw{width:120px;flex:0 0 auto}
${E} .lane{position:relative;height:20px;border-radius:4px;background:var(--hair);margin-top:8px;overflow:hidden} ${E} .lane i{position:absolute;top:0;height:100%;background:var(--sub);opacity:.55;font-family:var(--mono);font-style:normal;font-size:9px;color:var(--page);padding:0 6px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:4px} ${E} .lane i.gap{background:repeating-linear-gradient(135deg,var(--sub) 0 2px,transparent 2px 6px);color:var(--sub);opacity:.6}
${E} .ruler{display:grid;grid-template-columns:repeat(20,minmax(0,1fr));margin-top:6px;font-family:var(--mono);font-size:7.5px;color:var(--faint);text-align:center} ${E} .ruler .now{color:var(--ink);font-weight:600}
${E} .rhythm{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;align-items:end;margin-top:12px;height:70px} ${E} .rhythm div{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%} ${E} .rhythm b{display:block;width:18px;background:var(--sub);opacity:.6;border-radius:3px} ${E} .rhythm small{font-family:var(--mono);font-size:9.5px;color:var(--faint)} ${E} .rhythm .today small{color:var(--ink)}
${E} .tone{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px;margin-top:12px} ${E} .tone b{display:block;background:var(--sub)}
${E} .mono2{font-family:var(--mono);font-size:11px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:var(--sub);box-shadow:inset 0 0 0 1px var(--hair);flex:0 0 auto}
${E} .dotgone{width:26px;height:26px;display:grid;place-items:center;flex:0 0 auto} ${E} .dotgone::before{content:'';width:8px;height:8px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--faint)}
${E} .wdots{display:inline-flex;gap:4px} ${E} .wdots i{width:8px;height:8px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--hair)} ${E} .wdots i.on{background:var(--sub);box-shadow:none;opacity:.7} ${E} .wdots i.now{outline:1.5px solid var(--acc);outline-offset:1px}
${E} .ln .v s{color:var(--faint)} ${E} .ln.tap{cursor:pointer}
${E} .sheet .shh{display:flex;gap:12px;align-items:flex-start;margin-bottom:8px} ${E} .sheet .shh .g{flex:1} ${E} .sheet .shh h2.t{margin:2px 0 0} ${E} .sheet .big .num{font-size:40px}
${E} .night{position:absolute;inset:0;z-index:5;background:#07090B;color:#9AA3A8;padding:64px 28px 40px;display:flex;flex-direction:column;overflow-y:auto}
${E} .night .eb{color:#5B646A} ${E} .night h1{font-family:var(--disp);font-size:28px;color:#C9CFD2;margin:14px 0 10px;font-weight:500;letter-spacing:-.4px} ${E} .night p{font-size:15px;line-height:1.6}
${E} .night .ncta{margin-top:auto;padding:14px;border:1px solid #2A3238;border-radius:12px;text-align:center;color:#C9CFD2;font-size:15px;width:100%}
${E} .night .quitl{display:block;margin:14px auto 0;color:#5B646A;font-size:13px;text-decoration:underline;text-underline-offset:3px;text-align:center}
${E} .night .nback{position:absolute;top:20px;left:22px;color:#5B646A;font-size:13px}
${E} .night .tool{display:flex;gap:12px;align-items:center;padding:14px 0;border-top:1px solid #1C2227;color:#C9CFD2;width:100%;font-size:14.5px} ${E} .night .tool .g{flex:1} ${E} .night .tool small{display:block;color:#5B646A;font-size:12.5px;margin-top:2px} ${E} .night .tool em{color:#5B646A;font-style:normal} ${E} .night svg.ic.td{filter:grayscale(1) brightness(.7)}
${E} .night .moonart{width:56px;height:56px;margin-top:18px}
${E} .night .orb{width:120px;height:120px;border-radius:50%;margin:20px auto;background:radial-gradient(circle at 40% 35%,#1C2227,#0B0E11);box-shadow:inset 0 0 0 1px #1C2227}
${E} .night .breath{width:140px;height:140px;border-radius:50%;margin:24px auto;display:grid;place-items:center;border:1px solid #2A3238;color:#C9CFD2;font-size:18px}
@media (prefers-reduced-motion:no-preference){body:not(.still) ${E} .night .breath{animation:en-breath 18s ease-in-out infinite}}
@keyframes en-breath{0%{transform:scale(.8)}28%{transform:scale(1.1)}61%{transform:scale(1.1)}100%{transform:scale(.8)}}
${E} .night ul{padding-left:18px;line-height:1.7;font-size:14.5px;margin-top:6px}
`,
  notes:`<h2>Én</h2>
<p><b>Útvonalak</b> (az élő prototípus nevei): <b>#a-en-en</b> (hub; változatok: <b>en.ures</b> első hét, <b>en.celelerve</b> cél elérve, <b>en.nincsvetites</b> vetítés nélkül) · <b>test</b> / <b>test.alvas</b> (suly, alvas alias) · <b>ejszaka.idle|wait|legzes|getup</b> · <b>celok</b> (+<b>celok.ures</b>) · <b>cel</b> · <b>celuj.1…5</b> · <b>jelek</b> · <b>sulycel</b> (+<b>sulycel.ures</b>) · <b>sulyresz.diet|segment|plans|guards|javaslat</b> · <b>sulyuj.1|2</b> · <b>het</b> (+<b>het.fut</b>) · <b>elemzes</b> · <b>napok</b> · <b>felfedezesek</b> (+<b>.keves</b>, <b>.csend</b>) · <b>tanulsagok</b> · <b>novekedes</b> (+<b>.ures</b>) · <b>skillek</b> · <b>tevekenysegek</b> · <b>kitunt</b> · <b>naplo</b> · <b>emberek</b> · <b>jeloltek</b> (+<b>.ures</b>) · <b>kor</b> · <b>emlitesek</b> · <b>heti</b> · <b>ember</b> · <b>ertesitesek</b> (+<b>.ures</b>) · <b>beall</b>, <b>b-train</b>, <b>b-me</b>, <b>b-cel</b>, <b>b-mezo</b>, <b>b-nap</b>, <b>b-alt</b>, <b>b-ert</b>, <b>b-fiok</b>, <b>b-szemely.about|communication|context</b> · <b>ikonok</b>. Lapok: súly, alvás, pillér, kutatás, napló, döntés, emberek-log, új személy, biometria-kapu.</p>
<p><b>Mi változott.</b> <b>Hol tartok:</b> a név-sor csendes mono csík (szint, XP, érme kicsiben; a sorozat nincs itt), a hét üvegben a hős (pontszám-gyűrű + ítélet-mondat + „Jól ment / Nézd meg”), alatta nyitott listák: Életvonal (akcentus-görbe, szaggatott cél, pontozott vetítés, állomások koppintható üres pontok), Célok állása, Fejlődés · Emberek. <b>Test · Súly:</b> a <b>simított trend a főszám</b> (78,4), a napi mérés kicsi pont-szöveg; a grafikonon a trend az akcentusvonal, a napi mérések apró szürke pontok, a terv szaggatott, a tűréssáv hajszálszínű; 7/30/90 nap/1 év váltó; a számok nyitott sorokban; „Megfigyelés” mondat (recomp-jellegű, megfigyelő hangon); heti előzmény kinyitható napokkal. <b>Test · Alvás:</b> a <b>heti átlag a főszám</b>, a görbe mellett a hét sávja (legrövidebb–leghosszabb), 7,5 ó cél szaggatva; alvás-cél, rendszeresség és hatékonyság szürke sávokkal (rendben = szürke); tegnap éjjel, fázisok, íve, összetétel, trend (időtartam oszlop + minőség pont), „ha rövidebb az éjszaka” két árnyalattal — nincs piros-zöld; a napló rövid éjszakái borostyán értéket kapnak (ez kér figyelmet). Éjszakai mód teljes képernyős, sötét. <b>Súlycél:</b> ítélet-mondat, 78,4 → 73, <b>ütem-tárcsa</b> a biztonságos sáv jelölőivel (−0,7…−0,3), alatta <b>vízesés-ábra</b> a nyolc hét lépéseiről (a felfelé lépő hét is szürke), majd a hat rész nyitott sorokban. <b>Célok:</b> a PERMAH-gyűrű üvegben, életterületek szürke címkék számmal, a súlycél az első sor, a célok 7 napos pöttyökkel és iránynyíllal, Parkol / Jelek / Lezárt nyitott szakaszok. <b>A heted:</b> 3×3 csendes rács — csak az kap színt, ami figyelmet kér (alvás a cél alatt); a hét négy nézete sorokban. <b>Növekedés:</b> a „Ma” küldetések a hős (mit csinálj most), szint / fegyelem / ritmus szürke sorok, XP-idősor nincs; Kitüntetések: sorozat, címek, jelvények, perkek nyitott listában, sorozat nem hős. <b>Napló:</b> a döntés-visszanézés a hős (1–5), a hálanapló egy sor. <b>Emberek:</b> ítélet-mondat + említésszám, négy sor; a kör sorai hangulat-vonallal, borostyán keret csak a nehéz tónusnál. <b>Beállítások:</b> minden oldal nyitott sorokkal, kapcsolókkal; a terület-sorokon a területek kis jelei a váltóból.</p>
<p><b>Alapelv.</b> MacroFactor: trend a cím, nyers pont a textúra; teljesült cél = szürke; nincs sorozat-hős, nincs dicséret, csak megfigyelő mondat. BWS/Oura: áttekintés → trend → nyers adat három szinten (hub → Test → heti napok). Egy-két üveg hős oldalanként, minden más nyitott lista; a csepp sehol nem jelent mást, mint a napot (itt egy „ma” sincs, ezért nem is szerepel).</p>
<p><b>Amit nem tudtam átvinni.</b> Tíz Én-ikon hiányzik az acél készletből (Jelek, Felfedezések, Légzés, Ideje felkelni, Agy, Zászló, Kulcs, Kilépés, Paletta, Ceruza) — a helyettesítők az <b>#a-en-ikonok</b> lapon állnak, jóváhagyásra. Az Életvonal állomásainak koppintása most felugró üzenetben mutatja a történetet (az élőben a grafikon alatti sor). A hub név-sorából a 6 napos sorozat lekerült (a Kitüntetések listában megvan) — ez szándékos, kérdés, hogy maradjon-e így. A beállítások területsorain a csepp testvérformák helyett a váltó kis területjeleit használom.</p>`
});
})();
