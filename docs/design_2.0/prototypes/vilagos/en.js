/* vilagos/en.js — Én domain in the "Világos · élő" look. Built on window.F (see vilagos/README.md).
   Content + parity source: csepp/en.js (route names = the living prototype's, elo/en.html). Trend-first: the smoothed trend is the headline, raw points are texture. */
(function(){
const {I,mchp,page,sec,card,head,hero,btn,lk,step,row,bar,stat,grid,facts,seg,pills,st,ring,note,txt,empty,msg,chev,register}=F;
const E='.phone[data-v="feher"][data-d="en"]';
const S={period:'30d',swin:'7d',celv:'het',wk:0,dp:false,df:false,life:false,pf:'mind',tit:'letra',dec:'open',stn:-1};
const fmt=v=>v.toFixed(1).replace('.',',');
const P=(o,inner,x)=>page('en',o,inner,x);
/* ── small domain helpers (kit anatomy; only what the kit lacks) ── */
const segE=(items,cur,key)=>`<div class="fh-seg">${items.map(([k,l])=>`<button class="${k===cur?'on':''}" data-ev="${key}:${k}">${l}</button>`).join('')}</div>`;
const nhero=(o,i=0)=>`<section class="fh-card fh-hero n ${o.warn?'warn':''} rise" style="--i:${i}">${o.art?`<span class="fh-art">${I(o.art)}</span>`:''}<span class="lbl">${o.lbl||''}</span><div class="fh-big en-hn">${o.n}${o.unit?`<small>${o.unit}</small>`:''}</div>${o.verdict?`<p class="verdict">${o.verdict}</p>`:''}${o.sub?`<p class="sub">${o.sub}</p>`:''}${o.body||''}${o.acts?`<div class="fh-acts">${o.acts}</div>`:''}</section>`;
const hart=n=>`<span class="en-hart">${I(n)}</span>`;
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
const prog=(n,s)=>`<div class="en-prog">${Array.from({length:n},(_,i)=>`<i class="${i<s?'on':''}"></i>`).join('')}</div>`;
const gl=(x,y,t,anchor='start')=>`<text class="gl" x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;
const curve=p=>{let d=`M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;for(let i=0;i<p.length-1;i++){const p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2;d+=` C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)} ${(p1[1]+(p2[1]-p0[1])/6).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)} ${(p2[1]-(p3[1]-p1[1])/6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`}return d};
const save=(l,m)=>`<div class="fh-acts" style="justify-content:flex-end"><button class="btn sm ghost" data-close>Mégse</button><button class="btn sm" data-ev="save:${m}">${l}</button></div>`;
const shh=(icon,eb,h,s)=>`<div class="en-shh">${I(icon)}<div><small>${eb}</small><h2>${h}</h2>${s?`<p>${s}</p>`:''}</div></div>`;

/* ── adatok (az élő mock alapján) ── */
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
const av=(p,cls='')=>`<span class="en-av ${cls} ${p.t==='nehez'?'att':''}">${p.n[0]}</span>`;
const spark=(v,w=64,h=22)=>{const lo=Math.min(...v),hi=Math.max(...v);return `<svg class="en-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${v.map((a,i)=>`${i?'L':'M'}${(i/(v.length-1)*w).toFixed(1)} ${(h-2-(a-lo)/((hi-lo)||1)*(h-4)).toFixed(1)}`).join('')}"/></svg>`};

/* ═══════════ HOL TARTOK ═══════════ */
const ELV={w:[82.2,81.9,82.0,81.4,81.1,80.6,79.9,80.2,79.7,79.3,78.9,78.4],s:[6.6,6.9,7.0,6.4,7.2,7.1,6.8,7.3,7.0,7.2,6.9,7.1],
  st:[[0,'Tempó átállítva','júl. 8.','Heti −0,4 kg-ra lassítottad a tempót, azóta egyenletes.'],[6,'Új mélypont · 80 kg alatt','aug. 19.','Először mértél 80 kg alatti heti átlagot.'],[8,'Új képesség: Páncélzat','szept. 2.','10 hét töretlen: a sérülésállóság nő.'],[11,'Új mélypont','szept. 24.','78,4 kg: a 12 hét legalacsonyabb átlaga.']]};
const ELVR=[82.2,81.6,81.0,80.4,79.8,79.2,78.4,77.6,76.5,75.4,74.1,72.9];
const elvSt=state=>state==='reached'?[ELV.st[0],ELV.st[1],ELV.st[2],[11,'Cél elérve','szept. 24.','72,9 kg: a célsáv alá értél.']]:ELV.st;
function elvChart(state){
  const reached=state==='reached', proj=state==='proj', w=reached?ELVR:ELV.w;
  const W=300,H=108,x0=4,xp=W-30,x1=proj?xp-60:xp,lo=72.2,hi=82.8;
  const X=i=>x0+i*(x1-x0)/11, Y=v=>6+(hi-v)/(hi-lo)*(H-12);
  const p=w.map((v,i)=>[X(i),Y(v)]), last=p[11], ty=Y(73);
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H+16}" role="img" aria-label="Életvonal: 12 hét, 82,2 → ${fmt(w[11])} kg${reached?'':', cél 73,0'}">
    ${[82,79,76].map(v=>`<line x1="${x0}" x2="${xp}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" style="stroke:var(--hair)"/>${gl(W,(Y(v)+3).toFixed(1),v,'end')}`).join('')}
    <line x1="${x0}" x2="${xp}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" style="stroke:var(--faint);stroke-dasharray:3 4"/>${gl(W,(ty+3).toFixed(1),'cél','end')}
    <path d="${curve(p)} L${last[0].toFixed(1)} ${H} L${x0} ${H}Z" style="fill:color-mix(in srgb,var(--dom) 9%,transparent)"/>
    <path d="${curve(p)}" style="fill:none;stroke:var(--dom);stroke-width:2.4;stroke-linecap:round"/>
    ${proj?`<path d="M${last[0].toFixed(1)} ${last[1].toFixed(1)} L${xp} ${ty.toFixed(1)}" style="fill:none;stroke:var(--dom);stroke-width:1.6;stroke-dasharray:2 4;opacity:.75"/>`:''}
    ${elvSt(state).map((s,i)=>{const q=p[s[0]];return `<g data-ev="stn:${i}" role="button" aria-label="${s[1]} · ${s[2]}" style="cursor:pointer"><circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="11" style="fill:transparent"/><circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${S.stn===i?5.5:4}" style="fill:${S.stn===i?'var(--dom)':'var(--card)'};stroke:var(--ink);stroke-width:1.4"/></g>`}).join('')}
    ${S.stn===elvSt(state).length-1?'':`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" style="fill:var(--dom)"/>`}
    ${gl(x0,H+14,'júl. 8.')}${gl(X(6).toFixed(1),H+14,'aug. 19.','middle')}${gl(x1.toFixed(1),H+14,'szept. 24.','end')}
  </svg>`;
}
function elv(state){
  if(state==='empty') return card(head('t-trend','Életvonal · 12 hét')+empty('t-weight','Még kevés a mérés. Két mérés után rajzolódik ki az életvonalad.',btn('Mérj most',{sheet:'weight'},'sm ghost')),{i:2});
  const reached=state==='reached', sts=elvSt(state), s=sts[S.stn];
  return card(head('t-trend',`${reached?'−9,3':'−3,8'} kg · 12 hét`,'Test','test')
    +txt(`A 7 napos trend most <b>${reached?'72,9':'78,4'} kg</b>.`)
    +`<div class="en-chart">${elvChart(state)}</div>
    <div class="en-slband" role="img" aria-label="Alvás, heti átlag: 6,4–7,3 óra">${ELV.s.map(h=>`<i style="height:${Math.round((h-5.6)*10)}px"></i>`).join('')}</div>
    ${leg([['ln','súly · heti átlag'],['bd','alvás · heti átlag 6,4–7,3 ó'],['st','állomás']])}`
    +(s?`<div class="en-stn"><b>${s[1]} · ${s[2]}</b>${s[3]}</div>`:note('Koppints egy állomásra a görbén, és megmutatom, mi történt ott.'))
    +row({icon:reached?'t-flag':'t-target',title:reached?'Elérted a célod: 73,0 kg':state==='noproj'?'Vetítés még nincs':'A következő állomás: 73,0 kg',sub:reached?'A célok között találod a lezárást.':state==='noproj'?'Négy egyenletes hét kell hozzá.':'Még 5,4 kg van hátra.',on:reached?'celok':'sulycel'}),{i:2});
}
function hub(arg){
  const ures=arg==='ures', state=arg==='celelerve'?'reached':arg==='nincsvetites'?'noproj':ures?'empty':'proj';
  return P({title:'Én',sub:ures?'Daniel · az első napjaid':'Daniel · szept. 21–27.',tab:'mai'},`
  ${ures?hero({lbl:'Szept. 21–27. · az első heted',verdict:'Az első heti kép hétfő reggel érkezik.',sub:'Addig elég, ha naplózol.',left:ring(0,{s:92,val:'—',label:'hétfőn'}),acts:btn('A heted','het.fut')})
   :hero({lbl:'Szept. 21–27. · lezárt hét',verdict:'Az egyensúly hete: 78 pont, +4 az előzőhöz.',sub:'<b>Jól ment:</b> fehérjecél öt napon, stabil alvás. <b>Nézd meg:</b> két késői vacsora felszínes alvással.',left:ring(78,{s:92,val:78,label:'/ 100'}),acts:btn('A heti elemzés','het')})}
  ${sec(1,'Ami a héten mozdult',1)}
  ${card(grid(ures?[stat({k:'Súly trend',icon:'t-weight',n:'—',s:'két mérés után látszik',on:{sheet:'weight'}}),stat({k:'Alvás átlag',icon:'t-sleep',n:'—',s:'még nincs adat',c:'var(--info)',on:'test.alvas'}),stat({k:'Edzések',icon:'t-dumbbell',n:'—',s:'még nincs adat',c:'var(--warn)',on:{dom:'edzes'}}),stat({k:'Fehérje',icon:'t-meat',n:'—',s:'még nincs adat',c:'var(--protein)',on:{dom:'fuel'}})]
   :[stat({k:'Súly trend',icon:'t-weight',n:'−0,4',unit:'kg/hét',s:'78,6 kg heti átlag',sCls:'ok',on:'test'}),
     stat({k:'Alvás átlag',icon:'t-sleep',n:'7 ó 19',unit:'p',pct:98,s:'a 7,5 órás cél alatt',sCls:'warn',c:'var(--warn)',on:'test.alvas'}),
     stat({k:'Edzések',icon:'t-dumbbell',n:'3',unit:'/ 4 nap',pct:75,s:'a múlt heti szinten',c:'var(--info)',on:{dom:'edzes'}}),
     stat({k:'Fehérje',icon:'t-meat',n:'212',unit:'g átlag',pct:100,s:'öt napon célon',sCls:'ok',c:'var(--protein)',on:{dom:'fuel'}})]),{i:1})}
  ${sec(2,'Életvonal',2)}
  ${elv(state)}
  ${sec(3,ures?'Célok':'Célok állása',3)}
  ${card(ures?row({icon:'t-ring',title:'Első cél',sub:'Mezo pilléreket javasol hozzá',on:'celuj.1'})
   :row({icon:'t-weight',title:'Súlycél · 78,4 → 73 kg',sub:'−0,5 kg / hét · kb. 11 hét',v:'33%',on:'sulycel'})+GOALS.map(g=>row({icon:DIM[g.d[0]][1],title:g.t,sub:`${word(g.arrow)} · ${g.ma}`,right:arr(g.arrow)+chev(),on:'cel'})).join('')+`<div class="fh-acts">${lk('Mind a 4 cél ›','celok')}</div>`,{i:3})}
  ${sec(4,'Fejlődés · Emberek',4)}
  ${card(row({icon:'t-up',title:'Fejlődés',sub:ures?'Lv 1 · az első napjaid':'A kitartó · Lv 12 · 3 140 XP · 240 érme · 82% fegyelem · 6. hét ritmus',on:ures?'novekedes.ures':'novekedes'})
    +row({icon:'t-people',title:'Emberek',sub:ures?'':'Petra 3× e héten · 8 említés',on:'emberek'})
    +note('Ahol még nincs adat, a sor csak a nevét mutatja, soha nem nullát. A rutinod a Nap · Rutin fülön épül.'),{i:4})}`);
}

/* ═══════════ CÉLOK ═══════════ */
function permah(active,n){
  const keys=Object.keys(DIM), sg=100/6, gap=3;
  return `<div class="fh-ring" style="--s:92px"><svg viewBox="0 0 100 100" aria-hidden="true">${keys.map((k,i)=>`<circle cx="50" cy="50" r="40" pathLength="100" stroke-linecap="round" style="stroke:${active.includes(k)?'var(--dom)':'rgba(15,30,51,.10)'};stroke-width:${active.includes(k)?9:6}" stroke-dasharray="${sg-gap} ${100-sg+gap}" stroke-dashoffset="${-(i*sg)}"/>`).join('')}</svg><div class="c"><span><b>${n}</b><small>életcél</small></span></div></div>`;
}
function celok(arg){
  const ures=arg==='ures', active=ures?[]:['te','el','eg','ka','er'];
  const cnt=k=>ures?0:GOALS.filter(g=>g.d.includes(k)).length;
  return P({title:'Célok',sub:ures?'Én · még nincs aktív cél':'Én · 4 aktív · 1 parkol',tab:'celok'},`
  ${hero({lbl:ures?'Még nincs aktív életcélod':'Ezen a héten · 2↗ · 1→ · 0↘',verdict:ures?'Egy cél, két-három pillér. A többit a naplód hozza.':'Két cél emelkedik, egy tartja magát.',sub:ures?'':'A pillérek a meglévő naplódból számolnak.',left:permah(active,ures?0:3),acts:btn('+ Új cél','celuj.1')})}
  ${sec(1,'Aktív célok',1)}
  ${card(ures?row({icon:'t-weight',title:'+ Súlycél',sub:'Tervezd meg a tempót',on:'sulycel.ures'})+row({icon:'t-ring',title:'+ Új cél',sub:'Mezo pilléreket javasol',on:'celuj.1'})
   :row({icon:'t-weight',title:'Súlycél · Egészség',sub:'Fogyás · 78,4 → 73 kg · −0,5 kg / hét · kb. 11 hét',v:'33%',on:'sulycel'})
    +GOALS.map(g=>row({icon:DIM[g.d[0]][1],title:g.t,sub:`${DIM[g.d[0]][0]} · ${g.ma}<br>${d7(g.dots)}`,right:arr(g.arrow)+chev(),on:'cel'})).join(''),{i:1})}
  ${sec(2,'Életterületek',2)}
  ${card(`<div class="fh-chips en-dims" style="margin-top:0">${Object.entries(DIM).map(([k,d])=>`<span class="${cnt(k)?'':'off'}">${I(d[1])}${d[0]}<b>${cnt(k)}</b></span>`).join('')}</div>`,{i:2})}
  ${ures?'':sec(3,'Parkol és lezárt',3)+card(row({icon:'t-book',title:'Spanyol B2',sub:'parkol · Elmélyülés',right:btn('Vissza',{toast:'Újra aktív'},'sm ghost')})+row({icon:'t-sprout',title:'Félmaraton',sub:'kész · Egészség',right:st('kész','ok')}),{i:3})}
  ${sec(ures?3:4,'A célok mögött',4)}
  ${card(row({icon:'t-signal',title:'Jelek · mit figyel a rendszer',sub:'28 forrás · 19 él · 9 alszik',on:'jelek'})+note('Ami nincs naplózva, az nem nulla: az üres.'),{i:4})}`);
}
function cel(){
  const PL=[['Fehérje','átlag · 7 nap · ≥ 160 g','163 g','↗','t-meat',['hit','hit','part','hit','hit','miss','hit'],'cooking'],
    ['Edzésnapok','darab · heti · ≥ 4','3','→','t-dumbbell',['hit','nd','hit','nd','hit','nd','nd'],''],
    ['Alvásidő','átlag · 7 nap · ≥ 7 ó','7,1 ó','↗','t-sleep',['hit','part','hit','hit','hit','hit','part'],''],
    ['Késői nassolás','darab · heti · ≤ 2','—','','t-snack',null,'']];
  const hm=()=>`<span class="en-heat">${Array.from({length:28},(_,i)=>`<i class="${[0,3,7,12,19,24].includes(i)?'miss':i%5===2?'part':'hit'}"></i>`).join('')}</span>`;
  return P({title:'Kockahas',sub:'Cél · Egészség · Teljesítmény · aktív',back:'celok'},`
  ${hero({lbl:'aug. 10. → nov. 30.',verdict:'Emelkedik: a pillérek átlaga 71%.',left:ring(71,{s:92,val:'71%',label:'↗'}),acts:btn('+ Pillér',{sheet:'pillar'})})}
  ${sec(1,'Pillérek · 4',1)}
  ${card(segE([['het','Hét'],['ho','Hónap']],S.celv,'celv')+PL.map(p=>row({icon:p[4],title:p[0],sub:`${p[1]}${p[6]?` · skill: ${p[6]}`:''}<br>${p[5]?(S.celv==='het'?d7(p[5]):hm()):'még nincs adat · az első nyíl 5 adat-nap után'}`,v:p[2],right:p[3]?arr(p[3]):''})).join('')
    +note('Az irány-nyíl 7 nap vs 21 nap. Mindkettőben legalább 5 adat-nap kell.'),{i:1})}
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
    +sec(2,'Belső keret · egészség + képesség',2)+card(txt('A cél abból indul, amit te akarsz megtapasztalni. Nem abból, hogy mások mit látnak.')+`<div class="fh-acts">${btn('Elfogadom',{toast:'Egészség-keret elfogadva'},'sm ghost')}${lk('Maradjon',{toast:'Marad'})}</div>`,{i:2})
    +sec(3,'Életterület · átírhatod',3)+card(`<div class="fh-pills">${Object.entries(DIM).map(([k,d])=>`<button class="fh-pill ${k==='eg'||k==='te'?'on':''}" data-ev="dim">${I(d[1])}${d[0]}${k==='te'?' · 2.':''}</button>`).join('')}</div>`+note('Mezo javaslata: Egészség az első, Teljesítmény a második.'),{i:3});
  if(s===3) body=sec(1,'Javasolt pillérek',1)+card([['Heti futókilométer','szokás · skill: futás','t-run',1],['Alvásidő','szokás · skill: alvás','t-sleep',1],['Fehérje','szokás · skill: cooking','t-meat',0]].map(p=>row({icon:p[2],title:p[0],sub:p[1],right:tgl(p[3],p[0])})).join('')
    +`<div class="fh-acts">${lk('+ Pillér a katalógusból',{sheet:'pillar'})}</div>`+note('Az AI csak a zárt jel-katalógusból választhat · 5 pillér a felső határ.'),{i:1});
  if(s===4) body=sec(1,'Akadályok',1)+card(`<div class="fh-pills">${['Idő','Fáradtság','Időjárás','Utazás'].map((n,i)=>`<button class="fh-pill ${i<2?'on':''}" data-ev="dim">${n}</button>`).join('')}</div>`+ta('Mi fog közbejönni?','pl. esős hétvégék',true),{i:1})
    +sec(2,'Ha–akkor',2)+card(row({left:'<span class="en-tag">HA</span>',title:'kimarad a keddi futás'})+row({left:'<span class="en-tag">AKKOR</span>',title:'szerdán 30 perc könnyű',sub:'sport-napló · másnap szólok · Mezo javaslata'})+`<div class="fh-acts">${lk('+ Még egy ha–akkor',{toast:'Új ha–akkor sor'})}</div>`,{i:2});
  if(s===5) body=sec(1,'A cél',1)+card(head('t-run','Félmaraton tavasszal')+`<p class="fh-note" style="margin-top:0">Egészség · Teljesítmény · határidő 2027. ápr. 12. · 2 pillér</p>`+quote('„Hogy bírjam a nyári túrákat.”'),{i:1})
    +sec(2,'Így mérjük',2)+card(row({icon:'t-run',title:'Heti futókilométer',v:'≥ 20 km'})+row({icon:'t-sleep',title:'Alvásidő',sub:'7 nap átlag',v:'≥ 7 ó'}),{i:2})
    +sec(3,'Amire Mezo figyel · 1 szabály',3)+card(txt('Ha kimarad a keddi futás → szerdán 30 perc könnyű.')+note('Aktiválás után a pillérek a meglévő naplódból számolnak. Semmi újat nem kell rögzítened.'),{i:3});
  return P({title:'Új cél',sub:`Én · ${s} / 5 · ${names[s-1]}`,back:s>1?`celuj.${s-1}`:'celok'},
    hero({lbl:`${s}. lépés az ötből`,verdict:H[s-1],body:prog(5,s)})+body,
    {foot:s<5?`<button class="btn" style="flex:1" data-go="celuj.${s+1}">${names[s]} →</button>`:`<button class="btn ghost" data-go="celok">Mentés tervezettként</button><button class="btn" style="flex:1" data-go="cel">Aktiválás</button>`});
}
function jelek(){
  const LIVE=[['Alvásidő','5 / 7 nap · Alvás','t-sleep',['Kockahas']],['Fehérje','7 / 7 nap · Fuel','t-bowl',['Kockahas']],['Edzésnapok','3 / 7 nap · Edzés','t-dumbbell',['Kockahas','Side hustle']],['Check-in energia','6 / 7 nap · Elme','t-checkin',[]],['Lépésszám','7 / 7 nap · Activity','t-steps',[]],['Említett emberek','4 / 7 nap · Emberek','t-people',['Az utolsó barátnő']]];
  const SLEEP=[['Pulzus-variancia','nincs adat 7 napja · Életjel','t-heart'],['Meditáció','nincs adat 7 napja · Elme','t-checkin']];
  return P({title:'Jelek',sub:'Célok · mit figyel a rendszer',back:'celok'},`
  ${nhero({lbl:'Élő források',n:'19',unit:'/ 28',art:'t-signal',verdict:'Semmi újat nem kell naplóznod.',sub:'Ezekből számolom a pilléreket. Ami alszik, ott a pillér üres marad, nem nulla.',body:bar(68)})}
  ${sec(1,'Él · 19 forrás',1)}
  ${card(LIVE.map(r=>row({icon:r[2],title:r[0],sub:r[1]+(r[3].length?` · → ${r[3].join(', ')}`:''),right:st('él','ok')})).join(''),{i:1})}
  ${sec(2,'Alszik · 9 forrás',2)}
  ${card(SLEEP.map(r=>row({icon:r[2],title:r[0],sub:r[1],right:st('alszik','q')})).join('')+note('Nincs külső forrás: se naptár, se időjárás, se GitHub. Ami itt nincs, azt a rendszer nem tudja.'),{i:2})}`);
}

/* ═══════════ SÚLYCÉL ═══════════ */
function dial(val,lo,hi,min,max){
  const cx=60,cy=56,r=46, a=v=>Math.PI*(1-(v-min)/(max-min));
  const pt=(v,rr=r)=>[+(cx+rr*Math.cos(a(v))).toFixed(1),+(cy-rr*Math.sin(a(v))).toFixed(1)];
  const arc=(v1,v2,rr)=>{const [x1,y1]=pt(v1,rr),[x2,y2]=pt(v2,rr);return `M${x1} ${y1} A${rr} ${rr} 0 0 1 ${x2} ${y2}`};
  const [nx,ny]=pt(val,r-7);
  return `<svg class="fh-chart en-dial" viewBox="0 0 120 70" role="img" aria-label="Ütem ${fmt(val)} kg/hét, biztonságos sáv ${fmt(lo)}…${fmt(hi)}">
    <path d="${arc(min,max,r)}" style="fill:none;stroke:var(--hair);stroke-width:7;stroke-linecap:round"/><path d="${arc(lo,hi,r)}" style="fill:none;stroke:var(--ok);stroke-width:7;opacity:.55"/>
    ${[lo,hi].map(v=>{const [x1,y1]=pt(v,r-7),[x2,y2]=pt(v,r+7);return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--ok);stroke-width:1.2"/>`}).join('')}
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" style="stroke:var(--dom);stroke-width:2.6;stroke-linecap:round"/><circle cx="${cx}" cy="${cy}" r="3.5" style="fill:var(--dom)"/>
    ${gl(2,66,fmt(min))}${gl(118,66,(max>0?'+':'')+fmt(max),'end')}${gl(pt(lo,r+14)[0],pt(lo,r+14)[1]+3,fmt(lo),'middle')}${gl(pt(hi,r+14)[0],pt(hi,r+14)[1]+3,fmt(hi),'middle')}
  </svg>`;
}
function waterfall(){
  const D=[-0.5,-0.4,-0.6,0.1,-0.5,-0.3,-0.4,-0.4], W=300,H=92,n=D.length,bw=(W-44)/n, Y=v=>6+(-v/3.4)*(H-12);
  let out='',prev=0;
  D.forEach((d,i)=>{const x=4+i*bw,y1=Y(prev),y2=Y(prev+d),top=Math.min(y1,y2),h=Math.max(1.5,Math.abs(y2-y1));
    out+=`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(bw-6).toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" style="fill:${d>0?'var(--faint)':'var(--dom)'};opacity:${d>0?.6:.8}"/>`;
    if(i<n-1)out+=`<line x1="${(x+bw-6).toFixed(1)}" x2="${(x+bw).toFixed(1)}" y1="${y2.toFixed(1)}" y2="${y2.toFixed(1)}" style="stroke:var(--faint)"/>`;
    out+=gl((x+(bw-6)/2).toFixed(1),H+14,(i+1)+'.','middle');prev+=d});
  const xe=4+(n-1)*bw+(bw-6);
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H+18}" role="img" aria-label="Heti változások: 8 hét, összesen −3,0 kg">
    <line x1="4" x2="${W-40}" y1="${Y(0)}" y2="${Y(0)}" style="stroke:var(--hair)"/>${gl(W,Y(0)+3,'81,4','end')}
    ${out}<circle cx="${xe.toFixed(1)}" cy="${Y(prev).toFixed(1)}" r="4" style="fill:var(--dom)"/>${gl(W,(Y(prev)+3).toFixed(1),'78,4','end')}
  </svg>`;
}
function sulycel(arg){
  if(arg==='ures') return P({title:'Súlycél',sub:'Célok · még nincs aktív',back:'celok'},`
    ${hero({lbl:'Súlycél',verdict:'Még nincs aktív súlycélod.',sub:'Hozz létre egyet, és a Mezo köré szervezi a terveket.',left:hart('t-weight'),acts:btn('+ Új cél',{sheet:'gate'})})}
    ${card(note('A súlycélhoz előbb a biometriád kell: egyszeri beállítás, kb. 20 másodperc.'),{i:1})}`);
  const T6=[['diet','Mai étrendi keret','Edzésnap · P 163 · C 226 · F 66','2 300 kcal','t-bowl'],['segment','Aktuális szakasz','W5–10 · még 5 nap','MAV','t-peak'],['plans','Tervkapcsolatok','4 hét még fedezetlen','2 aktív','t-calendar'],['guards','Védőkorlátok','van egy figyelendő jel','3/4','t-shield'],['javaslat','Új javaslat','változások áttekintése','1 új','t-note'],['settings','Cél beállításai','Fogyás · W8/20','73 kg','t-gear']];
  return P({title:'Súlycél',sub:'Fogyás · Nyári forma · aktív',back:'celok'},`
  ${hero({lbl:'78,4 → 73 kg · 33% megvan',verdict:'Jó úton: a mért ütem a biztonságos sávban halad.',sub:'Várható cél: <b>aug. 14.</b> Egy új javaslat vár átnézésre.',body:`<div style="margin-top:12px">${bar(33)}</div>`,acts:btn('Javaslat megnézése','sulyresz.javaslat')+lk('+ Új cél',{sheet:'gate'})})}
  ${sec(1,'Ütem',1)}
  ${card(`<div class="en-dialw">${dial(-0.5,-0.7,-0.3,-1,0.2)}<small>ütem · kg / hét · a zöld a biztonságos sáv</small></div>`+facts([['−0,5','tényleges'],['−0,5','tervezett'],['aug. 14.','várható cél']]),{i:1})}
  ${sec(2,'Heti lépések · 8 hét',2)}
  ${card(`<div class="en-chart">${waterfall()}</div>`+note('Egy oszlop egy hét változása a trendben, a vékony vonal a lépcső. A felfelé lépő hét is csak szürke: a sáv dönt, nem egy hét.'),{i:2})}
  ${sec(3,'A cél részei',3)}
  ${card(T6.map(t=>row({icon:t[4],title:t[1],sub:t[2],v:t[0]==='javaslat'?null:t[3],right:t[0]==='javaslat'?st(t[3],'warn')+chev():'',on:t[0]==='settings'?{toast:'Beállítások · súlycél'}:`sulyresz.${t[0]}`})).join(''),{i:3})}`);
}
const lane=items=>`<div class="en-lane">${items.map(([l,w,t,gap])=>`<i class="${gap?'gap':''}" style="left:${l}%;width:${w}%">${t}</i>`).join('')}</div>`;
const ruler=()=>`<div class="en-ruler">${Array.from({length:20},(_,i)=>`<span class="${i===7?'now':''}">${i+1}</span>`).join('')}</div>`;
function sulyresz(k){
  k=k||'diet'; let o={},out='';
  if(k==='diet'){o={title:'Mai étrendi keret',sub:'Súlycél · ma edzésnap'};
    out=nhero({lbl:'Ma · edzésnap',n:'2 300',unit:'kcal',art:'t-bowl',verdict:'A heti átlagból jön ki a −0,5 kg/hét.',body:cells([['2 150','','heti átlag'],['2 300','','edzésnap'],['1 950','','pihenőnap']])})
    +sec(1,'Mai makrók',1)+card(row({title:'Fehérje',v:'163 g',right:bar(100,'var(--protein)')})+row({title:'Szénhidrát',v:'226 g',right:bar(100,'var(--carb)')})+row({title:'Zsír',v:'66 g',right:bar(100,'var(--fat)')}),{i:1})
    +sec(2,'Heti ritmus',2)+card(row({icon:'t-dumbbell',title:'Edzésnap × 4',v:'2 300 kcal'})+row({icon:'t-rested',title:'Pihenőnap × 3',v:'1 950 kcal'})+`<p class="fh-txt" style="margin-top:12px">Heti átlag <b>2 150 kcal</b>: ebből jön ki a −0,5 kg/hét.</p>`+note('Formula-alap: a nyugalmi anyagcseréd és az edzésnapjaid számából, a heti célütemhez igazítva. A napi szám mögött mindig látható marad a heti logika.'),{i:2})}
  if(k==='segment'){o={title:'Aktuális szakasz',sub:'Súlycél · W5–10'};
    out=nhero({lbl:'Aktuális szakasz · W5–10',n:'MAV',unit:'még 5 nap',art:'t-peak',verdict:'Az erőd megtartása a cél.',body:cells([['5','nap','hátra'],['Strength 02','','következő'],['−0,5','kg','heti cél']])})
    +sec(1,'A teljes ív · 20 hét',1)+card(lane([[20,30,'Most · MAV W5–10'],[50,30,'Strength 02']])+ruler()+`<p class="fh-txt" style="margin-top:12px">Következő: <b>Strength 02</b> · W11-től · jún. 16.</p>`,{i:1})
    +sec(2,'Mit változtat?',2)+card(txt('A MAV-szakaszban a heti szettszám a csúcs felé emelkedik, a kalóriakeret nem változik. Az erőd megtartása a cél.'),{i:2})}
  if(k==='plans'){o={title:'Tervkapcsolatok',sub:'Súlycél · 20 hét'};
    out=nhero({lbl:'Tervkapcsolatok',n:'2',unit:'aktív',art:'t-calendar',verdict:'Négy hét még nincs lefedve.',body:cells([['16','hét','lefedve'],['4','hét','fedezetlen',1],['2','','sport-időpont']])})
    +sec(1,'Idővonal · 20 hét',1)+card(ruler()+lab('Mesociklus')+lane([[20,30,'Hypertrophy 04 · W5–10']])+lab('Futóblokk')+lane([[25,40,'Base Build · 5K W6–13']])+lab('Fedezetlen')+lane([[0,20,'W1–4',1]]),{i:1})
    +sec(2,'Sport · heti rend',2)+card(row({icon:'t-volley',title:'Röplabda · Edzés · BVSC',sub:'Kedd · 18:30 · 90 perc'})+`<div class="fh-acts">${btn('+ Mesociklus',{toast:'Mesociklus csatolása'},'sm ghost')}${btn('+ Futóblokk',{toast:'Futóblokk csatolása'},'sm ghost')}</div>`,{i:2})}
  if(k==='guards'){o={title:'Védőkorlátok',sub:'Súlycél · célbiztonság'};
    out=nhero({lbl:'Célbiztonság',n:'3',unit:'/ 4 jel rendben',art:'t-shield',verdict:'Egy jel még figyelmet kér.',sub:'A fehérjecél még nincs Fuel-adattal ellenőrizve.'})
    +sec(1,'Jelek',1)+card([['Erővédelem','A fő emeléseid súlya nem csökkent a vágás alatt.','+1,2%','ok'],['Izomvédelem','Minden nagy izomcsoport kap elég munkát.','≥ 8 szett','ok'],['Fehérje','Még nincs elég Fuel-nap az ellenőrzéshez.','figyelendő','warn'],['Ütem','A biztonságos sávban.','−0,5 kg/hét','ok']].map(g=>row({left:ck(g[3]),title:g[0],sub:g[1],right:st(g[2],g[3])})).join(''),{i:1})}
  if(k==='javaslat'){o={title:'Mielőtt alkalmazod',sub:'Súlycél · javaslat · W17'};
    out=hero({warn:true,lbl:'Javaslat · W17 · átnézésre vár',verdict:'Két hete lassabb az ütem a tervezettnél.',sub:'A pihenőnapi keret 150 kcal-lal csökkenne.',acts:btn('Módosítások alkalmazása',{toast:'Alkalmazva'})+lk('Most nem','sulycel')+lk('Javaslat elvetése',{toast:'Biztosan elveted? · Igen, elvetem / Mégsem'})})
    +sec(1,'Miért javasoljuk?',1)+card(txt('A mért ütem −0,2 kg/hét, a terv −0,5. A pihenőnapi keret 150 kcal-lal csökkenne.'),{i:1})
    +sec(2,'Mi változik?',2)+card(row({title:'Pihenőnap',v:'<s>1 950</s> → 1 800 kcal'})+row({title:'Heti átlag',v:'<s>2 150</s> → 2 086 kcal'}),{i:2})}
  return P({...o,back:'sulycel'},out);
}
function sulyuj(sp){
  const s=+(sp||1)===2?2:1;
  const body=s===1?sec(1,'Irány',1)+card([['Fogyás','↓ deficit','t-down',1],['Hízás','↑ surplus','t-up',0],['Szinten tartás','≈ tartás','t-hold',0]].map(t=>row({icon:t[2],title:t[0],sub:t[1],right:t[3]?ck('ok'):'<span class="en-ck gone"></span>',on:{toast:`${t[0]} kiválasztva`}})).join(''),{i:1})
    +sec(2,'Védőkorlátok',2)+card(row({icon:'t-shield',title:'Erő megtartása',right:tgl(1,'Erő megtartása')})+row({icon:'t-shield',title:'Izom megtartása',right:tgl(1,'Izom megtartása')}),{i:2})
   :sec(1,'A cél adatai',1)+card(fld('Cél neve','Nyári forma')+two(fld('Kezdés','ápr. 22.'),fld('Cél dátum','szept. 8.'))+two(fld('Start súly','81,4 kg'),fld('Cél súly','73 kg'))+ta('Identity frame · opcionális','pl. „aki bírja a nyarat”',true),{i:1})
    +sec(2,'Ellenőrzés',2)+card(row({left:ck('ok'),title:'Reális',sub:'−0,5 kg/hét, a biztonságos sávon belül.'}),{i:2});
  return P({title:'Új súlycél',sub:`Én · ${s} / 2`,back:s>1?'sulyuj.1':'sulycel'},
    hero({lbl:`${s}. lépés a kettőből`,verdict:s===1?'Mit építünk?':'Mennyi időnk van?',body:prog(2,s)})+body,
    {foot:s===1?`<button class="btn" style="flex:1" data-go="sulyuj.2">Tovább →</button>`:`<button class="btn ghost" data-go="sulycel">Mentés tervezettként</button><button class="btn" style="flex:1" data-go="sulycel">Létrehozás + aktiválás</button>`});
}

/* ═══════════ TEST · SÚLY ═══════════ */
function wseries(){const n=31,out=[];for(let i=0;i<n;i++){const t=i/(n-1);out.push(80.4-2.0*t+Math.sin(i*1.7)*.28+Math.cos(i*.9)*.15)}out[n-1]=78.2;return out}
function wchart(){
  const d=wseries(), W=330,H=132,lo=77.4,hi=81, x=i=>8+i/(d.length-1)*(W-40), y=v=>H-(v-lo)/(hi-lo)*(H-10);
  let e=d[0];const ema=d.map(v=>(e=e+0.25*(v-e)));ema[ema.length-1]=78.4;
  const p=ema.map((v,i)=>[x(i),y(v)]);
  const p0=80.4,p1=78.4, band=`M${x(0)} ${y(p0+.5)} L${x(30)} ${y(p1+.5)} L${x(30)} ${y(p1-.5)} L${x(0)} ${y(p0-.5)}Z`;
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H+20}" role="img" aria-label="Súlytrend: simított trend 80,4 → 78,4 kg, napi mérések pontokként">
    ${[78,79,80].map(v=>`<line x1="8" x2="${W-32}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" style="stroke:var(--hair)"/>${gl(W,(y(v)+3).toFixed(1),v,'end')}`).join('')}
    <path d="${band}" style="fill:color-mix(in srgb,var(--dom) 8%,transparent)"/>
    <line x1="${x(0)}" y1="${y(p0).toFixed(1)}" x2="${x(30)}" y2="${y(p1).toFixed(1)}" style="stroke:var(--faint);stroke-dasharray:4 4"/>
    ${d.map((v,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2" style="fill:var(--faint);opacity:.75"/>`).join('')}
    <path d="${curve(p)}" style="fill:none;stroke:var(--dom);stroke-width:2.6;stroke-linecap:round"/>
    <circle cx="${x(30).toFixed(1)}" cy="${y(78.4).toFixed(1)}" r="5" style="fill:var(--dom);stroke:var(--card);stroke-width:2"/>
    ${gl(8,H+16,S.period==='7d'?'szept. 17.':S.period==='30d'?'aug. 25.':S.period==='90d'?'jún. 26.':'2025. szept.')}${gl(W-32,H+16,'ma','end')}
  </svg>`;
}
function sulyBody(){
  const WK=[['szept. 15–21','−0,4','78,6 kg átlag · 5 bejegyzés · min 78,4',[78.9,78.7,78.8,78.6,78.5,78.4,78.4]],['szept. 8–14','−0,6','79,0 kg átlag · 6 bejegyzés · min 78,8',[79.5,79.3,79.2,79.0,78.9,78.8,78.9]],['szept. 1–7','+0,1','79,6 kg átlag · 4 bejegyzés · min 79,4',[79.5,79.7,79.6,79.4,79.7,79.6,79.6]]];
  const DN=['Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat','Vasárnap'];
  return nhero({lbl:'Trend · 7 napos simítás',n:'78,4',unit:'kg',art:'t-weight',verdict:'Egyenletesen lefelé: −0,5 kg hetente.',sub:'Ma mérve 78,2 · −3,0 kg indulás óta (81,4 → 78,4) · cél 73 kg',acts:btn('+ Súly',{sheet:'weight'})+lk('Súlycél','sulycel')})
  +sec(1,'A görbe',1)+card(segE([['7d','7 nap'],['30d','30 nap'],['90d','90 nap'],['1y','1 év']],S.period,'period')+`<div class="en-chart">${wchart()}</div>`+leg([['ln','trend'],['raw','napi mérés'],['pl','terv'],['tol','tűréssáv']]),{i:1})
  +sec(2,'A számok',2)+card(row({title:'7 nap / hét',v:'−0,4 kg'})+row({title:'4 heti tempó',v:'−0,5 kg/hét'})+row({title:'A célig',sub:'5,4 kg van hátra',v:'33%',right:bar(33)})+row({title:'Várható cél',sub:'aug. 14.',v:'11 hét'}),{i:2})
  +sec(3,'Megfigyelés',3)+card(head('t-eye','Zsír megy, az erő marad')+txt('Négy hét alatt <b>−2,0 kg</b> a trend, miközben a fő emeléseid súlya <b>+1,2%</b>. Ez inkább zsírvesztés, mint izom. A Védőkorlátok ugyanezt mondják.'),{i:3})
  +sec(4,'Heti előzmény · 3 / 22 hét',4)+card(WK.map((w,i)=>`<button class="fh-row" data-ev="wk:${i}">${spark(w[3])}<span class="g"><strong>${w[0]}</strong><small>${w[2]}</small></span><span class="v">${w[1]}<small>kg</small></span><span class="en-car ${S.wk===i?'open':''}">${chev()}</span></button>${S.wk===i?`<div class="en-days">${w[3].map((v,j)=>`<div><span>${DN[j]}</span><b>${fmt(v)} kg</b><em>${j?((v-w[3][j-1])>=0?'+':'')+fmt(v-w[3][j-1]):'—'}</em></div>`).join('')}<div class="fh-acts" style="margin-top:8px">${lk('Mi történt ezen a héten?',{toast:'Mezo · diagnózis erre a hétre'})}</div></div>`:''}`).join('')+`<div class="fh-acts">${lk('Régebbi hetek',{toast:'Régebbi hetek betöltve'})}</div>`,{i:4});
}
/* ═══════════ TEST · ALVÁS ═══════════ */
const PH=[['Mély',18,.95],['Könnyű',52,.4],['REM',24,.7],['Éber',6,.18]];
const rail=a=>`<div class="en-rail">${a.map(p=>`<i style="width:${p[1]}%;opacity:${p[2]}"></i>`).join('')}</div><div class="en-leg">${a.map(p=>`<span><i class="bd" style="opacity:${p[2]}"></i>${p[0]} ${p[1]}%</span>`).join('')}</div>`;
const ref=(n,v,lo,hi)=>row({title:n,right:`<span class="en-band"><s style="left:${lo*2}%;width:${(hi-lo)*2}%"></s><u style="left:${v*2}%"></u></span>`,v:`${v}%`,sub:'a sávban'});
function schart(){
  const avg=[6.6,6.9,7.0,6.4,7.2,7.1,6.8,7.1], mn=[5.9,6.1,6.3,5.6,6.5,6.4,6.1,6.1], mx=[7.6,7.8,7.9,7.4,8.1,7.9,7.6,7.9];
  const W=330,H=110,lo=5.4,hi=8.4,x=i=>8+i/7*(W-40),y=v=>6+(hi-v)/(hi-lo)*(H-12);
  const p=avg.map((v,i)=>[x(i),y(v)]);
  const bandD=mx.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')+mn.slice().reverse().map((v,i)=>`L${x(7-i).toFixed(1)} ${y(v).toFixed(1)}`).join('')+'Z';
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H+20}" role="img" aria-label="Alvás heti átlaga 8 héten: 6,4–7,3 óra, a sáv a hét legrövidebb és leghosszabb éjszakája">
    ${[6,7,8].map(v=>`<line x1="8" x2="${W-32}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" style="stroke:var(--hair)"/>${gl(W,(y(v)+3).toFixed(1),v+' ó','end')}`).join('')}
    <line x1="8" x2="${W-32}" y1="${y(7.5).toFixed(1)}" y2="${y(7.5).toFixed(1)}" style="stroke:var(--faint);stroke-dasharray:3 4"/>
    <path d="${bandD}" style="fill:color-mix(in srgb,var(--dom) 10%,transparent)"/>
    <path d="${curve(p)}" style="fill:none;stroke:var(--dom);stroke-width:2.6;stroke-linecap:round"/>
    ${avg.map((v,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" style="fill:var(--dom)"/>`).join('')}
    ${gl(8,H+16,'aug. 3.')}${gl(W-32,H+16,'ez a hét','end')}
  </svg>`;
}
function hypno(){
  const sq=[1,2,3,2,1,2,3,3,2,1,0,1,2,3,2,1,1,2,3,2,1,1,0,1,2,3,2,1], L=[3,2,1,0], y=v=>10+L.indexOf(v)*18, W=300, X0=44, dx=(W-X0-4)/(sq.length-1);
  let d=`M${X0} ${y(sq[0])}`; sq.forEach((v,i)=>{if(i)d+=` H${(X0+i*dx).toFixed(1)} V${y(v)}`});
  return `<svg class="fh-chart" viewBox="0 0 ${W} 86" role="img" aria-label="Az éjszaka íve: 00:42 → 09:03">${['Éber','REM','Könnyű','Mély'].map((n,i)=>gl(0,10+i*18+3,n)+`<line x1="${X0}" x2="${W}" y1="${10+i*18}" y2="${10+i*18}" style="stroke:var(--hair)"/>`).join('')}<path d="${d}" style="fill:none;stroke:var(--dom);stroke-width:2;stroke-linejoin:round"/>${gl(X0,84,'00:42')}${gl(W,84,'09:03','end')}</svg>`;
}
function strend(){
  const N7=[[7.5,9],[6.8,6],[7.2,7],[6.1,5],[7.9,8],[7.0,7],[7.1,7]], N14=[[7.0,7],[6.6,6],[7.3,8],[7.1,7],[6.4,5],[7.4,8],[7.2,7],...N7];
  const N=S.swin==='7d'?N7:N14, W=330,H=96,n=N.length,bw=(W-40)/n;
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H+18}" role="img" aria-label="Alvás trend: időtartam oszlop, minőség pont">
    <line x1="4" x2="${W-32}" y1="${(H-7/9*H).toFixed(1)}" y2="${(H-7/9*H).toFixed(1)}" style="stroke:var(--faint);stroke-dasharray:3 4"/>${gl(W,(H-7/9*H+3).toFixed(1),'7 ó','end')}
    ${N.map((v,i)=>{const x=4+i*bw,h=v[0]/9*H;return `<rect x="${x.toFixed(1)}" y="${(H-h).toFixed(1)}" width="${(bw-5).toFixed(1)}" height="${h.toFixed(1)}" rx="4" style="fill:${v[0]<7?'var(--warn)':'var(--dom)'};opacity:${v[0]<7?.55:.3}"/><circle cx="${(x+(bw-5)/2).toFixed(1)}" cy="${(H-v[1]/10*H-4).toFixed(1)}" r="2.8" style="fill:var(--ink)"/>${n<=7?gl((x+(bw-5)/2).toFixed(1),H+14,['H','K','Sz','Cs','P','Sz','V'][i],'middle'):''}`}).join('')}
  </svg>`;
}
function scatter(){
  const q=[[6.1,78],[6.5,84],[6.8,92],[7.0,101],[7.2,104],[7.5,112],[7.9,118],[8.2,121],[6.3,80],[7.1,99]], W=330,H=100,x=h=>(h-5.8)/2.6*(W-10)+4,y=m=>H-(m-70)/56*(H-8);
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H+18}" role="img" aria-label="Alvásidő és REM-perc">
    <line x1="4" x2="${W}" y1="${H}" y2="${H}" style="stroke:var(--hair)"/>
    <line x1="${x(7).toFixed(1)}" x2="${x(7).toFixed(1)}" y1="0" y2="${H}" style="stroke:var(--faint);stroke-dasharray:3 4"/>${gl(x(7)+4,10,'7 ó')}
    ${q.map(v=>`<circle cx="${x(v[0]).toFixed(1)}" cy="${y(v[1]).toFixed(1)}" r="4.5" style="fill:${v[0]<7?'var(--faint)':'var(--dom)'}"/>`).join('')}
    ${gl(4,H+14,'6 ó')}${gl(W,H+14,'8 ó · REM perc ↑','end')}
  </svg>`;
}
function alvasBody(){
  const LOG=[['09/23','7,1 ó','23:20 → 06:30',7,''],['09/22','7,5 ó','00:42 → 09:03',9,'Tegnap stabil'],['09/21','6,1 ó','01:10 → 07:15',5,'Késő vacsora'],['09/20','7,2 ó','23:40 → 06:55',7,''],['09/19','6,8 ó','23:55 → 06:45',6,''],['09/18','7,9 ó','22:50 → 06:45',8,''],['09/17','7,0 ó','23:30 → 06:30',7,'']];
  return nhero({lbl:'Alvás · heti átlag',n:'7,1',unit:'óra',art:'t-sleep',verdict:'Közel a 7,5 órás célhoz, egyenletes héttel.',sub:'A hét sávja 6,1–7,9 ó · tegnap 7,1 ó · 23:20 → 06:30 · minőség 7/10',acts:btn('+ Alvás',{sheet:'sleep'})+lk('Éjszakai mód','ejszaka.idle')})
  +sec(1,'Nyolc hét',1)+card(`<div class="en-chart" style="margin-top:0">${schart()}</div>`+leg([['ln','heti átlag'],['tol','legrövidebb–leghosszabb'],['pl','7,5 ó cél']]),{i:1})
  +sec(2,'Alvás-cél',2)+card(row({icon:'t-sleep',title:'23:15 → 06:45',sub:'7,5 ó cél · ±15 perc · „a rendszeresség a király”',right:btn('szerkeszt',{toast:'Beállítások · alvás-cél'},'sm ghost')})
    +row({title:'Rendszeresség',sub:'14 nap · ±15 perc',v:'78%',right:bar(78)})+row({title:'Hatékonyság',sub:'cél ≥ 85%',v:'91%',right:bar(91,'var(--ok)')})
    +row({icon:'t-book',title:'Miért számít?',sub:'Az azonos időben lefekvés többet ér, mint egy-egy hosszabb éjszaka.',on:{sheet:'stats'}}),{i:2})
  +sec(3,'Tegnap éjjel',3)+card(`<div class="fh-big">7,5<small>óra</small></div><p class="fh-note" style="margin-top:6px">00:42 → 09:03 · ébredés 1× · minőség 9/10 · 87 perccel a cél lefekvés után · hatékonyság 93%</p>`
    +lab('Fázisok')+rail(PH)+ref('Mély',18,13,23)+ref('REM',24,20,25)+`<p class="fh-txt" style="margin-top:10px">Tegnap stabil.</p>`
    +lab('Az éjszaka íve')+`<div class="en-chart">${hypno()}</div>`
    +lab('Átlagos összetétel · 14 éjszaka')+rail([['Mély',16,.95],['Könnyű',55,.4],['REM',22,.7],['Éber',7,.18]])+ref('Mély',16,13,23)+ref('REM',22,20,25),{i:3})
  +sec(4,'Trend',4)+card(segE([['7d','7 nap'],['14d','14 nap']],S.swin,'swin')+`<div class="en-chart">${strend()}</div>`+leg([['bd','időtartam'],['wn','7 óra alatt'],['ink','minőség 1–10'],['pl','7 ó']])
    +lab('Ha rövidebb az éjszaka')+`<div class="en-chart">${scatter()}</div>`+txt('A 7 óra alatti éjszakáidon átlagosan <b>21 perccel kevesebb</b> a REM-ed.'),{i:4})
  +sec(5,'Napló · utolsó 7 éjszaka',5)+card(LOG.map(n=>{const w=parseFloat(n[1].replace(',','.'))<7||n[3]<=5;return step({time:n[0],title:`<span${w?' style="color:var(--warn)"':''}>${n[1]}</span> · ${n[2]}`,sub:n[4],right:`<span class="en-q">${n[3]}/10</span>${bar(n[3]*10,w?'var(--warn)':'var(--dom)')}`})}).join('')
    +row({icon:'t-moon',title:'Éjszakai mód',sub:'Eszközök éjszakai ébredéshez: 20 perces szabály, légzés, 4K-séta.',on:'ejszaka.idle'}),{i:5});
}
function test(arg){
  const v=arg==='alvas'?'alvas':'suly';
  return P({title:'Test',sub:v==='suly'?'Én · súly · szept. 24.':'Én · alvás · szept. 24.',tab:'test'},`
  <div class="en-sw rise">${seg([['Súly','test',v==='suly'],['Alvás','test.alvas',v==='alvas']])}</div>
  ${v==='suly'?sulyBody():alvasBody()}
  ${card(row({icon:'t-person',title:'Testadatok',sub:'34 év · 180 cm · 78,4 kg · 15% testzsír',on:{toast:'Beállítások · testadatok'}}),{i:6})}`);
}
function ejszaka(ph){
  ph=ph||'idle';
  const nb=`<button class="nback" data-go="${ph==='idle'?'test.alvas':'ejszaka.wait'}">‹ vissza</button>`;
  let inner='';
  if(ph==='idle') inner=`${nb}<span class="eb">Éjszakai mód</span><span class="art">${I('t-moon')}</span><h1>Felébredtél?</h1><p>Ne nézd meg az órát. Én figyelem helyetted az időt, neked csak pihenned kell.</p><button class="ncta" data-go="ejszaka.wait">Ébren vagyok</button>`;
  else if(ph==='wait') inner=`${nb}<span class="eb">Én figyelem az időt</span><div class="orb"></div><p>Maradj az ágyban, lazíts. Ha segít, válassz egyet:</p>
    ${[['t-breath','Légzés','be 5 · tartsd 6 · ki 7 · vezetett ütem','data-go="ejszaka.legzes"'],['t-person','Testpásztázás','fejtől lábujjig, lassú vezetéssel','data-toast="Testpásztázás: lassú, sötét kártyák"'],['t-steps','4K-séta','járj végig fejben egy jól ismert utat','data-toast="4K-séta: lassú, sötét kártyák"']].map(t=>`<button class="tool" ${t[3]}>${I(t[0])}<span class="g">${t[1]}<small>${t[2]}</small></span><em>›</em></button>`).join('')}
    <button class="quitl" data-go="test.alvas">elalszom · kilépek</button><button class="quitl" data-go="ejszaka.getup">(20 perc múlva →)</button>`;
  else if(ph==='legzes') inner=`${nb}<span class="eb">Légzés · 5 – 6 – 7</span><div class="breath">Be…</div><p>Kövesd a kört: ahogy nő, szívd be; ahogy áll, tartsd; ahogy húzódik, fújd ki.</p><button class="quitl" data-go="ejszaka.wait">megállítom ›</button>`;
  else inner=`${nb}<span class="eb">20 perc eltelt</span><span class="art">${I('t-candle')}</span><h1>Ideje felkelni</h1><p>Kelj fel: ez most a jobb út.</p><ul><li>Menj át egy másik, félhomályos szobába.</li><li>Csinálj valami unalmasat, képernyő nélkül.</li><li>Csak akkor feküdj vissza, ha álmos vagy.</li></ul><button class="ncta" data-go="test.alvas">Visszafeküdtem</button>`;
  return `<div class="scroll en-night">${inner}</div><div class="toast" id="toast"></div><div class="sheet" id="sheet"></div><div class="scrim" id="scrim"></div>`;
}

/* ═══════════ A HETED ═══════════ */
const DAYSC=[['H',78],['K',72],['Sze',85],['Cs',null],['P',null],['Szo',null],['V',null]];
const mbars=a=>`<span class="en-mb">${a.map(v=>`<i class="${v?'':'nd'}" style="height:${v?Math.max(3,Math.round(v)):4}px"></i>`).join('')}</span>`;
function het(arg){
  const run=arg==='fut';
  return P({title:'A heted',sub:`Szept. 21–27. · ${run?'ez a hét · még fut':'lezárt hét'}`,back:'mai'},`
  ${hero({lbl:run?'Ez a hét · még fut':'Lezárt hét · a Mezo elemzésével',verdict:run?'A visszatérés hete':'Az egyensúly hete',sub:'<b>+4</b> az előző héthez (74)',left:ring(78,{s:92,val:78,label:'/ 100'}),
    acts:btn('Mezo elemzése','elemzes')+`<span class="en-wnav"><button class="btn sm ghost" data-toast="Előző hét" aria-label="Előző hét">‹</button><button class="btn sm ghost" ${run?'disabled':'data-toast="Következő hét"'} aria-label="Következő hét">›</button></span>`})}
  ${sec(1,'A hét számokban',1)}
  ${card(cells([['3 004','kcal','kcal átlag'],['212','g','fehérje'],['7ó 19p','','alvás',1],['75','%','check-in'],['7,0','/ 10','energia'],['6,8','/ 10','hangulat'],['78,6','kg','súly'],['−0,4','kg/hét','súly-trend'],['585','','XP']])+note('Színt csak az kap, ami figyelmet kér: az alvás a 7,5 órás célod alatt maradt. Minden más rendben.'),{i:1})}
  ${sec(2,'A hét négy nézete',2)}
  ${card(row({icon:'t-score',title:'Mezo · heti elemzés',sub:run?'hétfőn jön · a hét még fut':'hétfő 06:15 · erős hét volt: a fehérjecélt öt napon tartottad',right:mbars(DAYSC.map(d=>d[1]&&d[1]*.22))+chev(),on:'elemzes'})
    +row({icon:'t-gem',title:'A hét tanulságai',sub:run?'a hét közben még gyűlik':'nincs javaslat ehhez a héthez',v:'—',on:'tanulsagok'})
    +row({icon:'t-sun',title:'A hét napjai',sub:'nézd meg egyesével',v:'4 / 7',on:'napok'})
    +row({icon:'t-lens',title:'Heti felfedezések',sub:'23 minta · 6 új tudás · 3 életesemény · 1 emlékkönyv · 1 előrejelzés',v:'34',on:'felfedezesek'}),{i:2})}
  ${run?sec(3,'Célok · a hét iránya',3)+card(GOALS.map(g=>row({icon:DIM[g.d[0]][1],title:g.t,sub:g.arrow==='↗'?'Emelkedik: a pillérei többsége a héten célon volt.':'Tartja: a pillérek a múlt heti szinten.',right:arr(g.arrow)+chev(),on:'celok'})).join(''),{i:3})
    +sec(4,'A következő heted',4)+card(msg('mezo','Jövő héten két korai lefekvés elég lenne, hogy a hatékonyságod 90% fölött maradjon. A többi mehet így.')+`<div class="fh-acts">${btn('Hasznos',{toast:'Köszönöm'},'sm ghost')}${btn('Nem most',{toast:'Rendben'},'sm ghost')}</div>`,{i:4}):''}
  ${card(note('A pontszám a hat mért területből áll össze: tápanyag, minőség, edzés, alvás, logolás, ritmus.'),{i:5,cls:'en-foot'})}`);
}
function elemzes(){
  return P({title:'Heti elemzés',sub:'A heted · hétfő 06:15',back:'het'},`
  ${nhero({lbl:'A Mezo olvasata · napi pontszámok',n:'78',unit:'/ 100',art:'t-score',verdict:'Erős hét volt: a fehérjecélt öt napon tartottad.',
    body:`<div class="en-sbars">${DAYSC.map(d=>`<button data-toast="${d[0]}: A napom oldala (Nap)"><em>${d[1]??''}</em><i class="${d[1]?'':'nd'}" style="height:${d[1]?Math.round((d[1]-40)*1.3):10}px"></i><small>${d[0]}</small></button>`).join('')}</div>`,
    acts:btn('Beszélgess a hétről',{toast:'Beszélgetés a hétről (Mezo)'})+lk('Frissítsd',{toast:'Elemzés frissítve'})})}
  ${sec(1,'Mezo · heti elemzés',1)}
  ${card(msg('mezo','Erős hét volt: a fehérjecélt öt napon tartottad, és az alvásod a hét második felében stabilizálódott. A csütörtöki kimaradt nap után szombaton visszajöttél. Ez a hét mintája.','hétfő 06:15')
    +note('Amire épült: minta · tudás · életesemény · emlék')+`<div class="fh-acts">${btn('Hasznos',{toast:'Köszönöm'},'sm ghost')}${btn('Nem talált',{toast:'Rendben'},'sm ghost')}</div>`,{i:1})}
  ${sec(2,'Tovább',2)}
  ${card(row({icon:'t-gem',title:'A hét tanulságai',sub:'még nincs javaslat',on:'tanulsagok'}),{i:2})}`);
}
function napok(){
  const D=[['H','szept. 21.',78,[8,6,7,9,5,7],['2 840 kcal','7ó 40p','1× edzés','4/4 check-in'],0],['K','szept. 22.',72,[6,7,5,6,8,6],['3 120 kcal','6ó 50p','','3/4 check-in'],0],['Sze','szept. 23.',85,[9,8,8,8,9,8],['2 950 kcal','7ó 30p','1× edzés','4/4 check-in'],0],['Cs','szept. 24.',null,[3,0,0,0,6,0],['','7ó 10p','','1/4 check-in · jegyzet'],1],['P','szept. 25.','f'],['Szo','szept. 26.','f'],['V','szept. 27.','f']];
  return P({title:'A hét napjai',sub:'A heted · szept. 21–27.',back:'het'},`
  ${nhero({lbl:'Mért napok',n:'4',unit:'/ 7',art:'t-sun',verdict:'A szerda volt a legjobb napod.',sub:'Koppints egy napra, és megnyílik A napom oldala.',body:cells([['Sze 85','','legjobb nap'],['K 72','','leggyengébb'],['1','','tanulom']])})}
  ${sec(1,'Napról napra',1)}
  ${card(D.map(d=>d[2]==='f'?`<div class="fh-step en-dim"><time>${d[0]}</time><span class="g"><strong>${d[1]}</strong><small>még előtted · ide majd a nap adatai jönnek</small></span></div>`
    :step({time:d[0],now:!!d[5],title:d[1]+(d[5]?' · ma':''),sub:d[4].filter(Boolean).join(' · '),right:mbars(d[3].map(v=>v*2))+`<span class="en-q">${d[2]??'tanulom'}</span>`,on:null}).replace('<div class="fh-step',`<div data-toast="${d[0]}: A napom oldala (Nap)" class="fh-step`)).join('')
    +note('A hat pálcika a nap részpontszáma: tápanyag, minőség, edzés, alvás, logolás, ritmus.'),{i:1})}`);
}
const SIG=['Fehérjebevitel','Alvásminőség','Lépésszám','Koffein','Hangulat','Esti képernyőidő','Edzésnap','Stressz','Reggeli check-in','Hála-napló'], SIG2=['másnapi energia','fókusz','étvágy','pihentség','edzésteljesítmény','türelem'];
const PATS=[['A késői lefekvés a másnapi napstruktúrát is gyengítheti','előléptetve'],...Array.from({length:13},(_,i)=>[`${SIG[i%10]} és ${SIG2[i%6]}`,'előléptetve']),['Edzésnapokon mélyebben alszol','erősödött'],['A munkahelyi fókusz nehézsége összefügghet a gyengébb mentális közérzettel','erősödött'],['A hirtelen mérlegemelkedés fokozhatja az aznapi stresszt','erősödött'],['Vízbevitel és napi energia','erősödött'],...Array.from({length:5},(_,i)=>[`${SIG[(i+13)%10]} és ${SIG2[(i+13)%6]}`,'megerősítve'])];
const FACTS=['A fehérjecél tartása javítja a check-in energiát','Hétköznap 23:00 után fekszel le a legtöbbször','A kedd a legsűrűbb munkanapod','Futás után jobb a hangulatod','A hétvégi reggeli rendszerint kimarad','A délutáni kávé után később alszol el'];
function felfedezesek(arg){
  const D=arg==='csend'?{p:[],f:[],l:[],m:0,r:[]}:arg==='keves'?{p:PATS.slice(1,2),f:FACTS.slice(0,1),l:[['Nyaralás kezdete','szept. 23.']],m:1,r:[['A súly csökkenő trendje folytatódik fehérjecél mellett','folyamatban']]}:{p:PATS,f:FACTS,l:[['Nyaralás kezdete','szept. 23.'],['Új munkahelyi projekt','szept. 22.'],['Költözés előkészítése','szept. 26.']],m:1,r:[['A súly csökkenő trendje folytatódik fehérjecél mellett','folyamatban']]};
  const n=D.p.length+D.f.length+D.l.length+D.r.length+D.m, o={title:'Heti felfedezések',sub:'A heted · szept. 21–27.',back:'het'};
  if(!n) return P(o,nhero({lbl:'Heti felfedezések',n:'—',art:'t-lens',verdict:'Csendes hét volt.',sub:'Nem született új minta vagy tudás. Ez nem hiba: a memória csak akkor nő, ha van mit tanulni.'}));
  const drawer=(k,items,rw,open,unit)=>card(items.slice(0,open?undefined:3).map(rw).join('')+(items.length>3?`<div class="fh-acts"><button class="fh-lk" data-ev="drawer:${k}">${open?'Kevesebb ‹':`Mind a ${items.length} ${unit} ›`}</button></div>`:''),{i:k==='p'?2:3});
  let k=1;
  return P(o,`
  ${nhero({lbl:'Új nyom a memóriában',n,art:'t-lens',verdict:'Amit a Mezo a héten magától megjegyzett.',sub:'Ezek nem javaslatok, hanem megtörtént nyomok.'})}
  ${sec(k++,'A hét kiemelt nyomai',1)}
  ${card(D.l.map(l=>row({icon:'t-pin',title:l[0],sub:`életesemény · ${l[1]}`,on:{toast:'Életesemény: a Rólad oldalon döntesz róla'}})).join('')+(D.m?row({icon:'t-scroll',title:'Új bejegyzés készült a hétről',sub:'emlékkönyv · olvasd el',on:{toast:'Emlékkönyv (Mezo)'}}):'')+D.r.map(r=>row({icon:'t-orb',title:r[0],sub:`előrejelzés · ${r[1]}`,on:{toast:'Előrejelzések (Mezo)'}})).join(''),{i:1})}
  ${D.p.length?sec(k++,`Minták · ${D.p.length}`,2)+drawer('p',D.p,p=>row({icon:'t-pattern',title:p[0],sub:p[1],on:{toast:'Minta oldala (Mezo)'}}),S.dp,'minta'):''}
  ${D.f.length?sec(k++,`Új tudás · ${D.f.length}`,3)+drawer('f',D.f,f=>row({icon:'t-book',title:f,on:{toast:'Ez a tudás a Tudástárban'}}),S.df,'új tudás'):''}`);
}
function tanulsagok(){
  return P({title:'A hét tanulságai',sub:'A heted · a visszatérés hete',back:'het'},`
  ${hero({lbl:'A hét tanulságai',verdict:'A heti felismerésekről a Tudástár közös postaládájában döntesz.',sub:'Ott egy helyen látod mindet, és egyenként elfogadhatod vagy elvetheted.',left:hart('t-gem'),acts:btn('Tudástár postaládája',{toast:'Tudástár postaládája (Mezo)'})+lk('Vissza a heti értékeléshez','het')})}`);
}

/* ═══════════ FEJLŐDÉS ═══════════ */
const LIFE=[['Tudatosság','c-i-life-tudatossag',4,62,'Reggeli jelenlét'],['Szemlélet','c-i-life-szemlelet',3,40],['Konyha','c-i-life-konyha',5,78,'Kockahas','perk Lv 10'],['Pénzügyek','c-i-life-penzugyek',2,55],['Produktivitás','c-i-life-produktivitas',4,20,'Side hustle'],['Tanulás','c-i-life-tanulas',3,85],['Kapcsolatok','c-i-life-kapcsolatok',3,33,'Az utolsó barátnő'],['Regeneráció','c-i-life-regeneracio',3,48]];
const skl=(n,icn,lv,p,goal,perk)=>row({icon:/^(c-|t-)/.test(icn)?icn:null,left:/^(c-|t-)/.test(icn)?'':`<span class="en-mono">${icn}</span>`,title:n,sub:goal||perk?[goal?`→ ${goal}`:'',perk].filter(Boolean).join(' · '):'',v:`Lv ${lv}`,right:bar(p)});
function novekedes(arg){
  const ures=arg==='ures';
  const q=(t,k)=>row({left:ck(k==='done'?'ok':k==='gone'?'gone':'open'),title:k==='gone'?`<span style="color:var(--faint)">${t}</span>`:t,sub:k==='gone'?'csendben lejárt':k==='open'?'küldetés · nyitott':'küldetés · kész'});
  return P({title:'Fejlődés',sub:ures?'Hol tartok · az első napjaid':'Hol tartok · Daniel · A kitartó',back:'mai'},`
  ${ures?hero({lbl:'Ma',verdict:'Ma még nincs küldetés. A reggeli briefinggel jön.',sub:'Tevékenységet közben is logolhatsz.',left:hart('t-quest'),acts:btn('+ Tevékenység',{toast:'Tevékenység naplózása'})+lk('Küldetések',{toast:'Küldetések · a Nap fülön'})})
   :hero({lbl:'Ma · 2/4 küldetés · +45 XP',verdict:'Két küldetés megvan, egy még nyitva áll.',left:ring(50,{s:84,val:'2/4',label:'ma'}),acts:btn('+ Tevékenység',{toast:'Tevékenység naplózása'})+lk('Küldetések',{toast:'Küldetések · a Nap fülön'})})}
  ${ures?'':sec(1,'Mai küldetések',1)+card(q('Fehérje 150 g','done')+q('Reggeli séta','done')+q('Esti nyújtás','open')+q('Heti meal prep','gone')
    +row({icon:'t-pencil',title:'Meal prep a hétre',sub:'tevékenység · +15'})+row({icon:'t-pencil',title:'Pénzügyek rendezése',sub:'tevékenység · +20'}),{i:1})}
  ${sec(ures?1:2,'Szint és ritmus',2)}
  ${card(row({title:'Szint '+(ures?1:12),sub:ures?'0 / 100 XP':'420 / 3 500 XP a következőig · 3 140 XP összesen',right:bar(ures?0:12)})
    +(ures?'':row({title:'Fegyelem',v:'82%',right:bar(82)}))
    +row({title:'Ritmus',right:`<span class="en-wdots">${Array.from({length:8},(_,n)=>`<i class="${n>=(ures?7:2)?'on':''}${n===7?' now':''}"></i>`).join('')}</span>`,v:`${ures?1:6} hét`}),{i:2})}
  ${sec(ures?2:3,'Részletek',3)}
  ${card(row({icon:'t-sprout',title:'Skillek',sub:ures?'':'14 skill · legjobb Lv 7',on:'skillek'})+row({icon:'t-journal',title:'Tevékenységek',sub:ures?'':'23 küldetés · 9 tevékenység · 30 nap',on:'tevekenysegek'})+row({icon:'t-record',title:'Kitüntetések',sub:ures?'':'5 / 9 jelvény',on:'kitunt'})
    +note('A szint visszajelzés, nem jutalom: semmi nem nyílik vagy zárul tőle. Az XP-idősort nem rajzoljuk.'),{i:3})}`);
}
function skillek(){
  const life=S.life?LIFE:LIFE.slice(0,4);
  return P({title:'Skillek',sub:'Fejlődés · képességek',back:'novekedes'},`
  ${nhero({lbl:'Képességek',n:'14',unit:'skill',art:'t-sprout',verdict:'A hát az erősséged, a konyha a legjobb LIFE skilled.',body:cells([['3,4','','LIFE Lv-átlag'],['5','','atléta-szint'],['Lv 7','','izom legjobb']])})}
  ${sec(1,'LIFE · 8 skill · 1 085 XP',1)}
  ${card(life.map(l=>skl(l[0],l[1],l[2],l[3],l[4],l[5])).join('')+`<div class="fh-acts"><button class="fh-lk" data-ev="life">${S.life?'Kevesebb ‹':'Mind a 8 ›'}</button></div>`+row({icon:'t-coin',title:'Megtakarítás (30 nap)',v:'50 000 Ft'}),{i:1})}
  ${sec(2,'Atlétikus · 4 skill · átlag 5,0',2)}
  ${card([['Maximális erő','Ma',7,64],['Állóképesség','Ál',5,30],['Robbanékonyság','Ro',4,72],['Mobilitás','Mo',4,15]].map(s=>skl(s[0],s[1],s[2],s[3])).join(''),{i:2})}
  ${sec(3,'Izom · 9 izom · legjobb Lv 7',3)}
  ${card([['back-wide','Hát',7,58],['chest-mid','Mell',6,80],['shoulder-side','Váll',5,44]].map(m=>row({left:mchp(m[0],'sm'),title:m[1],v:`Lv ${m[2]}`,right:bar(m[3])})).join('')+skl('Comb','Co',5,12)+`<div class="fh-acts">${lk('Mind a 9 ›',{toast:'Mind a 9 izom'})}</div>`
    +note('A szint visszajelzés, nem jutalom: semmi nem nyílik vagy zárul tőle.'),{i:3})}`);
}
function tevekenysegek(){
  const q=(t,m,xp)=>row({left:ck('ok'),title:t,sub:`küldetés · ${m} · +${xp}`});
  const a=(t,sk,xp,ft)=>row({icon:'t-pencil',title:t,sub:`tevékenység · ${sk||'besorolatlan'} · +${xp}${ft?` · ${ft}`:''}`});
  const g=t=>row({left:ck('gone'),title:`<span style="color:var(--faint)">${t}</span>`,sub:'küldetés · csendben lejárt'});
  return P({title:'Tevékenységek',sub:'Fejlődés · utolsó 30 nap',back:'novekedes'},`
  ${nhero({lbl:'Utolsó 30 nap',n:'23',unit:'teljesített küldetés',art:'t-journal',verdict:'Ezen a héten hat küldetés és négy tevékenység.',sub:'Szept. 21–27.',body:cells([['6','','küldetés'],['2','','lejárt'],['4','','tevékenység'],['+120','','LIFE XP'],['8 500','Ft','megtakarítás']])})}
  ${sec(1,'Ma · 09.24 · +45 XP',1)}
  ${card(q('10 perc séta ebéd után','reggel',15)+a('Meal prep a hétre','Konyha',10,'2 000 Ft')+g('Olvass 10 oldalt'),{i:1})}
  ${sec(2,'Tegnap · 09.23 · +30 XP',2)}
  ${card(q('Víz az ágy mellé','este · tevékenységgel teljesült',15)+a('Kiadások átnézése','Pénzügyek',15),{i:2})}
  ${sec(3,'Szept. 22. · +10 XP',3)}
  ${card(a('Hosszú beszélgetés Petrával','',10)+note('Utolsó 30 nap. A csendben lejárt küldetés nem hiba: ajánlat volt.'),{i:3})}`);
}
const BADGES=[['t-flag','Első küldetés',100,'megvan'],['t-scroll','10 küldetés',100,'megvan'],['t-record','50 küldetés',46,'23 / 50'],['t-pencil','Első tevékenység',100,'megvan'],['t-flame','4 hetes ritmus',100,'megvan'],['t-gem','Mind a 8 LIFE aktív',75,'6 / 8'],['t-brain','LIFE Lv 5',60,'Lv 3'],['t-peak','10 000 LIFE XP',31,'3 140'],['t-coin','100k megtakarítás',50,'50k']];
function kitunt(){
  const bolt=S.tit==='bolt';
  return P({title:'Kitüntetések',sub:'Fejlődés · jelvények, címek',back:'novekedes'},`
  ${nhero({lbl:'Jelvények',n:'5',unit:'/ 9 megvan',art:'t-record',verdict:'Viselt címed: A kitartó.',sub:'240 érméd van. Címre vagy sorozat-mentőre költheted.',body:`<div style="margin-top:12px">${bar(56)}</div>`})}
  ${sec(1,'Jelvények · 5 / 9',1)}
  ${card(BADGES.map(b=>row({icon:b[0],title:b[1],v:b[3]==='megvan'?null:b[3],right:(b[3]==='megvan'?st('megvan','ok'):'')+bar(b[2],b[3]==='megvan'?'var(--ok)':'var(--dom)')})).join(''),{i:1})}
  ${sec(2,'Címek',2)}
  ${card(segE([['letra','Létra'],['bolt','Bolt']],S.tit,'tit')+(bolt?row({title:'Az éjjeli bagoly',sub:'120 érme',right:btn('Megveszem',{toast:'Megvetted'},'sm ghost')})+row({title:'A reggeli ember',sub:'180 érme',right:btn('Megveszem',{toast:'Megvetted'},'sm ghost')})+note('A sorozat-mentő is itt vehető.')
    :row({title:'Az újonc',sub:'Lv 1',right:btn('felvesz',{toast:'Felvetted: Az újonc'},'sm ghost')})+row({title:'A kitartó',sub:'Lv 5',right:st('viselve','ok')})+row({title:'A mester',sub:'Lv 10',right:st('Lv 10-től','q')})),{i:2})}
  ${sec(3,'Perkek · 3 feloldva',3)}
  ${card([['Páncélzat','10 hét töretlen: a sérülésállóság nő','Maximális erő'],['Tűzhely-mester','heti 3 meal prep: kevesebb döntés','Konyha'],['Csendes óra','reggeli jelenlét: a fókusz nő','Tudatosság']].map(p=>row({title:p[0],sub:`${p[1]} · ${p[2]}`,right:st('Lv 10','q')})).join(''),{i:3})}
  ${sec(4,'Sorozat',4)}
  ${card(row({icon:'t-flame',title:'6 nap egymás után',sub:'következő mérföldkő: 30 nap · +150 érme · bármilyen mai log életben tartja'})+row({icon:'t-shield',title:'Sorozat-mentő',sub:'200 érme · nálad: 1/2',right:btn('Megveszem',{toast:'Megvetted · 2/2'},'sm ghost')})
    +note('Az érme itt költhető el: címre vagy sorozat-mentőre. Semmi más nem vásárolható, és semmi nem jár le.'),{i:4})}`);
}

/* ═══════════ NAPLÓ ═══════════ */
function naplo(){
  const done=S.dec==='done';
  const N=[['Ma','Ma reggel nagyon nyugodt voltam a meeting előtt, a légzőgyakorlat tényleg segít.','t-journal','napló'],['Tegnap','Hálás vagyok Petrának, hogy végighallgatott a munkás dologgal.','t-heart','hála'],['09. 22.','Túl sokat vállaltam a héten. Jövő héten egy estét szabadon hagyok.','t-journal','napló'],['09. 21.','Heti négy edzés: meglátjuk, belefér-e.','t-compass','döntés']];
  return P({title:'Napló',sub:'Én · 12 bejegyzés',tab:'naplo'},`
  ${hero({lbl:`Döntés · tegnap · ${done?'visszanézve':'nézd vissza'}`,verdict:done?'Visszanézted: 4 az 5-ből.':'Egy döntésed vár visszanézésre.',sub:'„Szeptembertől heti négy edzésre váltok háromról.”',left:hart('t-compass'),
    body:done?'':`<p class="fh-note" style="margin-top:12px">Mennyire vált be? (1–5)</p><div class="en-rate">${[1,2,3,4,5].map(n=>`<button data-ev="dec:done" aria-label="${n} az 5-ből">${n}</button>`).join('')}</div>`,
    acts:btn('+ Új bejegyzés',{sheet:'journal'})+(done?lk('Mi lett belőle?',{sheet:'decision'}):'')})}
  ${sec(1,'2026. szeptember',1)}
  ${card(N.map(n=>step({time:n[0],icon:n[2],title:n[1],sub:n[3],on:{sheet:'journal'}})).join('')+`<div class="fh-acts">${lk('Korábbi hónapok',{toast:'Augusztus betöltése'})}</div>`,{i:1,cls:'en-jr'})}
  ${sec(2,'Hálanapló',2)}
  ${card(row({icon:'t-heart',title:'Hálanapló',sub:'12 bejegyzés · 5 nap egymás után',on:{toast:'Hála · új sor a lapon'}}),{i:2})}`);
}

/* ═══════════ EMBEREK ═══════════ */
function emberek(){
  return P({title:'Emberek',sub:'Hol tartok · 6 aktív kör',back:'mai'},`
  ${hero({lbl:'Kapcsolatok · 8 említés e héten',verdict:'Petra a legtöbbet említett; Bence hangulata lejt.',left:`<span class="en-pile big">${PEOPLE.slice(0,3).map(p=>av(p)).join('')}</span>`,acts:btn('Log',{sheet:'plog'})+lk('+ Új személy',{sheet:'pedit'})})}
  ${sec(1,'A köröd',1)}
  ${card(row({icon:'t-lens',title:'Jelöltek',sub:'Marci · új arc a szövegeidben',v:'1',on:'jeloltek'})
    +row({left:`<span class="en-pile">${PEOPLE.slice(0,3).map(p=>av(p)).join('')}</span>`,title:'A köröm',sub:'6 személy · Petra a legaktívabb',on:'kor'})
    +row({icon:'t-chat',title:'Említések',sub:'8 e héten · 1 figyelem-jelzés',on:'emlitesek'})+row({icon:'t-calendar',title:'Heti kép',sub:'Bence ↘ · Petra ↗ · a hét iránya',on:'heti'})
    +note('Az emberek a szövegeidből, a hangjegyeidből és a Mezo-beszélgetésekből kerülnek ide.'),{i:1})}`);
}
function jeloltek(arg){
  const e=arg==='ures';
  return P({title:'Jelöltek',sub:'Emberek · új arcok',back:'emberek'},`
  ${e?card(empty('t-lens','Nincs több jelölt. Az éjszakai kör hajnalban néz újra.'),{i:0})
   :hero({lbl:'1 jelölt · visszatérő név · éjszakai kör',verdict:'Marci: új arc a szövegeidben.',sub:'„…délben futottam Marcival a gáton, jó tempót diktált…”',left:`<span class="en-av lg">M</span>`,acts:btn('Felveszem',{sheet:'pedit'})+lk('Nem ő az / nem kell','jeloltek.ures')})}
  ${card(note('Jelöltet csak visszatérő, ismeretlen név kap. Az elvetett nevet nem javasolja újra.'),{i:1,cls:'en-foot'})}`);
}
function kor(){
  return P({title:'A köröm',sub:'Emberek · 6 személy',back:'emberek'},`
  ${hero({lbl:'A köröm · 6',verdict:'Hat ember, Petra a legaktívabb.',left:`<span class="en-pile big">${PEOPLE.slice(0,3).map(p=>av(p)).join('')}</span>`,acts:btn('+ Új személy',{sheet:'pedit'})})}
  ${sec(1,'Akik körülötted vannak',1)}
  ${card(PEOPLE.map(p=>row({left:av(p),title:p.n,sub:`${p.r} · ${p.w}× e héten · ${p.all} említés`,right:spark(p.sp)+chev(),on:'ember'})).join('')
    +note('A vonal a kapcsolat hangulat-íve. A sárga keret azt jelzi, ahol a hét nehéz tónusú volt.'),{i:1})}`);
}
const MEN=[['bence','t-journal','18:42 · napló','Bence-vel röpi után gyors sör, de feszült volt a meccs miatt.','edzés','nehez',true,'Volleyball · 17:30–19:00'],['reka','t-mic','22:18 · hang','Réka hívott · másfél óra, sokat segített a céges ügyben.','segítség','jo',false,'Hangjegy · 22:18'],['petra','t-journal','20:14 · napló','Petrával hosszú vacsi, csendben, jó volt.','közös program','jo',false,''],['adam','t-chat','12:05 · Mezo-chat','Ádámmal átnéztük a portfólióját.','munka','ok',false,'']];
function emlitesek(){
  const R=[['H',2,'jo'],['K',1,'ok'],['Sze',3,'nehez'],['Cs',1,'jo'],['P',0,''],['Szo',0,''],['V',1,'jo']];
  return P({title:'Említések',sub:'Emberek · a hét ritmusa',back:'emberek'},`
  ${nhero({lbl:'Említés e héten',n:'8',art:'t-chat',verdict:'Szerdán volt a legtöbb, egy figyelem-jelzéssel.',
    body:`<div class="en-rhythm">${R.map((d,i)=>`<div class="${i===3?'today':''}"><b style="height:${d[1]?d[1]*16:3}px;${d[2]==='nehez'?'background:var(--warn)':''}"></b><small>${d[0]}</small></div>`).join('')}</div>`,acts:btn('Log',{sheet:'plog'})})}
  ${sec(1,'Mit írtál róluk',1)}
  ${card(segE([['mind','Mind'],['het','Hét']],S.pf,'pf')+MEN.map(m=>{const p=PEOPLE.find(x=>x.id===m[0]);return row({left:av(p),title:`${p.n} <span class="en-meta">${m[2]}</span>`,sub:`<span class="en-body">${m[3]}</span>${m[4]} · ${TONE[m[5]]}${m[6]?' · <b style="color:var(--warn)">figyelem</b>':''}${m[7]?` · kapcsolódik: ${m[7]}`:''}`,right:['t-journal','t-chat'].includes(m[1])?`<button class="en-x" data-toast="Visszavonva" aria-label="Visszavon">✕</button>`:`<span class="en-src">${I(m[1])}</span>`})}).join('')
    +note('Tónus: Jó · OK · Vegyes · Nehéz (ez kap színt) · kontextus: munka, edzés, közös program, konfliktus'),{i:1,cls:'en-top'})}`);
}
function heti(){
  const dirs=[[PEOPLE[1],'↘','többször nehéz tónus, mint korábban'],[PEOPLE[0],'↗','több közös program'],[PEOPLE[3],'→','kiegyensúlyozott']];
  return P({title:'Heti kép',sub:'Emberek · a hét tónusa',back:'emberek'},`
  ${nhero({lbl:'Említés e héten',n:'8',art:'t-calendar',verdict:'Többnyire jó tónus, egy nehéz pillanattal.',
    body:`<div class="en-tone"><b style="flex:4;background:var(--ok)"></b><b style="flex:2;background:var(--dom)"></b><b style="flex:1;background:var(--faint)"></b><b style="flex:1;background:var(--warn)"></b></div>${leg([['ok','4 jó'],['bd','2 OK'],['fa','1 vegyes'],['wn','1 nehéz']])}`})}
  ${sec(1,'Irányok · 7 nap',1)}
  ${card(dirs.map(d=>row({left:av(d[0]),title:`${d[0].n} ${arr(d[1])}`,sub:`${d[2]} · ${d[0].w}× e héten`,right:spark(d[0].sp)+chev(),on:'ember'})).join(''),{i:1})}
  ${sec(2,'A hét pillanata',2)}
  ${card(row({left:av(PEOPLE[3]),title:`Réka <span class="en-meta">péntek 22:18 · napló</span>`,sub:'<span class="en-body">„Réka hívott · másfél óra, sokat segített a céges ügyben.”</span>'}),{i:2,cls:'en-top'})}
  ${sec(3,'Csendben maradt · 1',3)}
  ${card(row({left:av(PEOPLE[4]),title:'Márk',sub:'10 napja · Mentee. Jólesne neki egy jel?',right:btn('Írok neki',{sheet:'plog'},'sm ghost')})
    +note('Az irányok és a tónus-sáv az e heti említésekből jönnek. A hétfői heti áttekintés erre is kitér.'),{i:3})}`);
}
function ember(){
  const p=PEOPLE[0];
  return P({title:p.n,sub:'A köröm · '+p.r,back:'kor'},`
  ${hero({lbl:p.r,verdict:'41 említés, e héten háromszor. A hangulat jó.',left:av(p,'lg'),acts:btn('Log most',{sheet:'plog'})+lk('Szerkesztés',{sheet:'pedit'})})}
  ${sec(1,'Hangulat-ív · júl → szept',1)}
  ${card(cells([['41','','összes'],['3×','','e héten'],['Jó','','hangulat']])+`<div class="en-chart"><svg class="fh-chart" viewBox="0 0 300 50" role="img" aria-label="Hangulat-ív">${[5,6,6,7,6,8,7,8,9,8,9,10].map((v,i)=>`<rect x="${i*25+2}" y="${48-v*4.4}" width="18" height="${v*4.4}" rx="4" style="fill:var(--dom);opacity:${.3+v*.06}"/>`).join('')}</svg></div>`,{i:1})}
  ${sec(2,'Milyen helyzetekben',2)}
  ${card([['közös program',48],['család',30],['segítség',22]].map(c=>row({title:c[0],v:`${c[1]}%`,right:bar(c[1])})).join(''),{i:2})}
  ${sec(3,'Kapcsolt események · 3',3)}
  ${card([['t-pin','Nyári szabadság · júl 14–21','életesemény · kapcsolódik · erős'],['t-ring','Az utolsó barátnő','cél · kapcsolódik'],['t-pattern','Hétvégi közös főzés','minta · kapcsolódik']].map(e=>row({icon:e[0],title:e[1],sub:e[2],on:{toast:'A tudástárba visz (Mezo)'}})).join(''),{i:3})}
  ${sec(4,'Amit Mezo tud',4)}
  ${card(txt('Allergén: kagyló · konyhakerülő · reggeli ember'),{i:4})}
  ${sec(5,'Idővonal',5)}
  ${card([['t-journal','tegnap','20:14 · közös program','Petrával hosszú vacsi, csendben, jó volt.'],['t-mic','kedd','08:02 · család','Petra elvitte a kocsit szervizbe.'],['t-chat','hétfő','21:40 · segítség','Végighallgatott a munkás dologgal.']].map(t=>step({time:t[1],icon:t[0],title:t[3],sub:t[2]})).join(''),{i:5,cls:'en-jr'})}`);
}

/* ═══════════ ÉRTESÍTÉSEK ═══════════ */
function ertesitesek(arg){
  const o={title:'Értesítések',sub:'Hol tartok · 11 értesítés',back:'mai'};
  if(arg==='ures') return P({...o,sub:'Hol tartok'},card(empty('t-bell','Még nincs értesítésed.'),{i:0}));
  const r=(icn,t,x,tm,u)=>step({time:tm,icon:icn,now:!!u,title:t,sub:x,on:{toast:'A kapcsolódó oldalra visz'}});
  return P(o,`
  ${nhero({lbl:'Olvasatlan',n:'3',unit:'/ 11 értesítés',art:'t-bell',verdict:'Három új dolog vár ma reggel óta.',acts:btn('Mind olvasott',{toast:'Mind olvasott'})})}
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
  ${nhero({lbl:'Fogyás · aktív',n:'76',unit:'kg célsúly',art:'t-weight',verdict:'Reális: a tempó belefér.',body:cells([['78,4','','most'],['2,4','kg','hátra'],['38%','','teljesült']]),acts:btn('Cél szerkesztése',{toast:'Cél szerkesztése (lap)'})})}
  ${sec(1,'A te tempódban · célból dátum',1)}
  ${card(two(fld('Célsúly (kg)','76,0'),fld('Céltempó (kg/hét)','0,4'))+row({icon:'t-calendar',title:'Becsült céldátum · számított',sub:'reális, a tempó belefér',v:'nov. 2.'}),{i:1,cls:'en-form'})}
  ${sec(2,'Jelenleg mentett cél',2)}
  ${card([['Irány','Fogyás'],['Súlyút','80,0 → 76,0 kg'],['Célablak','W 4 / 10'],['Céltempó','−0,4 kg/hét'],['Várható céldátum','nov. 2.'],['Védőkorlátok','Erő · Izom']].map(r=>row({title:r[0],v:r[1]})).join(''),{i:2})}`);
}
function bmezo(){
  return P({title:'Mezo és te',sub:'Beállítások · mezo',back:'beall'},`
  ${sth('Mezo és te','Legyen világos, mit tud rólad.','És hogyan szóljon hozzád. Amit itt megírsz, azt Mezo minden beszélgetésben szem előtt tartja.','c-i-mezo')}
  ${sec(1,'A közös nyelvünk',1)}
  ${card(srow('t-person','Rólam','A saját szavaimmal · te alakítod','#b-szemely.about')+srow('t-chat','Így beszélj velem','Saját instrukció és tanult stílus','#b-szemely.communication'),{i:1})}
  ${sec(2,'Átlátható működés',2)}
  ${card(srow('t-orb','Ezt kapja meg Mezo','A pontos összeállított szöveg','#b-szemely.context')+srow('t-bell','Mezo jelzései','Minták, előrejelzések, összegzések','#b-ert'),{i:2})}`);
}
function bnap(){
  return P({title:'Nap',sub:'Beállítások · nap',back:'beall'},`
  ${sth('Nap','A ritmus, ami összefogja a napodat.','Jó reggeltől a lecsendesedésig.','c-i-nap')}
  ${sec(1,'A két horgony',1)}
  ${card(cells([['07:00','','ébredés'],['23:00','','pihenés']]),{i:1})}
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
    body:`<div class="en-bars24">${hrs.map(h=>`<i class="${h===2?'hot':''}" style="height:${h?h*16+8:4}px"></i>`).join('')}</div><div class="en-ax">${[0,4,8,12,16,20,24].map(x=>`<span>${x}</span>`).join('')}</div>`,
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
  return P({title:'Új ikonok',sub:'Hol tartok · az Én ikonjai',back:'mai'},`
  ${nhero({lbl:'Új ikonok · az Én kérte',n:'10',unit:'jel',art:'t-palette',verdict:'Mind a tíz bekerült a közös készletbe.',sub:'Az előző körben még helyettesítőkkel dolgoztam. Most már a saját jelük áll minden sorban.'})}
  ${sec(1,'A tíz jel és ahol megjelenik',1)}
  ${card(NEW.map(m=>row({icon:m[1],title:m[0],sub:m[2]})).join('')+note('Minden más Én-ikon (súly, alvás, cél, emberek, napló, életterületek, LIFE skillek) is a 3D készletből jön. Emoji sehol.'),{i:1})}`);
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
${E} .en-hart{display:grid;place-items:center;width:76px;height:76px;border-radius:24px;background:rgba(255,255,255,.75);box-shadow:inset 0 0 0 1px rgba(15,30,51,.06),0 10px 18px -12px rgba(15,30,51,.4);flex:0 0 auto}
${E} .en-hart svg.ic{width:52px;height:52px;filter:drop-shadow(0 8px 9px rgba(15,30,51,.28))}
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
${E} .en-dims span{padding:5px 10px 5px 6px;background:var(--page);box-shadow:none} ${E} .en-dims span svg.ic{width:22px;height:22px} ${E} .en-dims span b{font-family:var(--disp);font-weight:800;margin-left:2px} ${E} .en-dims span.off{color:var(--faint)} ${E} .en-dims span.off svg.ic{filter:grayscale(1) opacity(.45)}
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
${E} .en-shh{display:flex;gap:12px;align-items:center;margin-bottom:12px} ${E} .en-shh>svg.ic{width:44px;height:44px;filter:drop-shadow(0 6px 7px rgba(15,30,51,.25))} ${E} .en-shh small{font-size:11px;font-weight:650;letter-spacing:.6px;text-transform:uppercase;color:color-mix(in srgb,var(--dom) 75%,var(--ink))} ${E} .en-shh h2{margin:1px 0 0} ${E} .en-shh p{font-size:13px;color:var(--sub);margin-top:2px}
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
`,
  notes:`<h2>Én</h2>
<p><b>Mit nézz meg.</b> A négy fül: <b>Hol tartok</b>, <b>Test</b>, <b>Célok</b>, <b>Napló</b>. Mindegyik ugyanúgy épül fel: fent egy színes kártya egy mondattal arról, hol tartasz, és egy gombbal; alatta számozott szakaszok.</p>
<p><b>Hol tartok.</b> A hét egy mondatban, mellette a heti pontszám gyűrűje, a gomb a heti elemzésre visz. Alatta: <b>1</b> ami a héten mozdult (súly, alvás, edzés, fehérje négy csempén), <b>2</b> az Életvonal (koppints a görbe pöttyeire, alatta megjelenik, mi történt ott), <b>3</b> a célok állása, <b>4</b> Fejlődés és Emberek. A fenti csengő az értesítéseket, a fogaskerék a beállításokat nyitja.</p>
<p><b>Test.</b> Fent váltasz Súly és Alvás között. A súlynál a nagy szám a <b>kisimított súlyod</b>, nem a mai mérés; a görbén a vastag vonal a trend, a halvány pöttyök a napi mérések, a szaggatott a terv. Lejjebb a heti előzmény sorai kinyithatók napokra. Az alvásnál a heti átlag a nagy szám.</p>
<p><b>Célok.</b> A súlycél oldalán megmaradt az ütem-óra (a zöld sáv a biztonságos tempó) és a nyolc hét lépcsője. Új cél: öt rövid lépés, alul a „tovább” gombbal.</p>
<p><b>Napló.</b> Elöl a visszanézésre váró döntésed (1–5 gombok), alatta a bejegyzések.</p>
<p><b>Ami háttérbe került.</b> A szint, az XP, az érmék és a kitüntetések csak sorok a Fejlődés alatt. A napi sorozat egyedül a Kitüntetések lista alján látszik, sehol máshol.</p>
<p><b>Kérdések neked.</b> 1) A napi sorozat maradjon így, csak a Kitüntetések között? 2) Az <b>Éjszakai mód</b> (Test · Alvás alján) az egyetlen sötét képernyő, mert éjjel, ágyban használod. Maradjon sötét, vagy ez is legyen világos?</p>
<p><b>További állapotok</b> (a címsorba írva): <b>#e-en-mai.ures</b> első hét, <b>.celelerve</b>, <b>.nincsvetites</b> · <b>celok.ures</b> · <b>sulycel.ures</b> · <b>het.fut</b> · <b>felfedezesek.keves</b> / <b>.csend</b> · <b>novekedes.ures</b> · <b>jeloltek.ures</b> · <b>ertesitesek.ures</b> · <b>ikonok</b> (a tíz új ikon).</p>`
});
})();
