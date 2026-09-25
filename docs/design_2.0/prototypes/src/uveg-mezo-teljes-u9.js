
/* ══ U9 · Mezo II a csapatfal-világban (mezo-me75u.9) ══════════════════════════════════════
   Karakter-napló, Rólad, dimenziók, Konzílium, Gépterem (+ futások, adatforrások, detektorok,
   Összes funkció), Tudástár, Minták, Előrejelzések — a csapatfal jóváhagyott anyagában
   (D3/D5), az 5 szereplővel. A régi 9 szakértő a live leképezés szerint olvad beléjük
   (features/insights/logic/team.ts PERSONA_OWNER). A csapatfal globálisai (topbar, av, CH,
   phead, rrow, sec, ELORE, PST, KIS, MINTA) innen is elérhetők. */
const PER={doki:'deru',edzo:'mocor',drill:'mocor',taplalkozo:'falat',szomnologus:'szunya',pszichologus:'deru',antropologus:'mezo',szkeptikus:'szk',mezo:'mezo'};
const nm=id=>CH[id].n;
Object.assign(ST,{hub:'feed',ff:'Minden',fb:{},konz:'ov',th:'t1',src:'be',wk:false,tud:'full',chk:true,waitOpen:true,offOpen:false,bucket:'decide',ack:'',pred:'all',mfb:{}});
const dh=(small,strong,right='')=>`<div class="dhead rise"><button class="back glass" data-back aria-label="Vissza">‹</button><span class="t"><small>${small}</small><strong>${strong}</strong></span>${right}</div>`;
const go=t=>t?(t[0]==='#'?`data-go="${t}"`:`data-toast="${t}"`):'';
const cse=o=>{const tag=o.go?'button':'div';return `<${tag} class="case ${o.flat?'flatc':'glass'} ${o.go?'lift':''} rise" style="--c:${o.c};--s:${o.s||o.c};--i:${o.i||0}" ${go(o.go)}>${o.st?`<span class="crow"><span class="st">${o.st}</span>${o.em?`<em>${o.em}</em>`:''}</span>`:''}<span class="cmain">${o.ic?I(o.ic):o.av?av(o.av,true):''}<span class="ctxt"><b>${o.b}</b>${o.sm?`<small>${o.sm}</small>`:''}</span>${o.go?'<span class="chev">›</span>':''}</span>${o.extra||''}</${tag}>`};
const rowg=(ic,c,b,sm,to,em='')=>`<button class="rowg glass lift rise" style="--c:${c}" ${go(to)}>${ic.startsWith('@')?av(ic.slice(1)):I(ic)}<span style="flex:1;min-width:0"><b>${b}</b>${sm?`<small>${sm}</small>`:''}</span><em>${em||'›'}</em></button>`;
const tc=(id,chip,t,i=0)=>`<div class="tcmt rise" style="--c:${CH[id].c};--i:${i}"><div class="th">${av(id,true)}<b>${nm(id)}</b>${chip?`<span class="area">${chip}</span>`:''}</div><p>${t}</p></div>`;
const princ=t=>`<p class="m9-principle">${t}</p>`;
const lede=t=>`<p class="m9-lede rise">${t}</p>`;
const dsh=(ic,t)=>`<div class="dash rise">${I(ic)}<span>${t}</span></div>`;

/* ═════════ KARAKTER-NAPLÓ (/mezo/karakter + /feed, a fülsor nélkül) ═════════ */
const FEED=[
  {k:'doki',t:'A reggeli mérések három hete <b>makulátlanul pontosak</b> — ez ritka fegyelem.',d:'ma · 06:12'},
  {k:'drill',t:'A tegnapi kihagyott logolást ma reggelre már pótoltad — ez a minta ismerős nálad.',d:'ma · 07:40'},
  {k:'mezo',t:'Vasárnapi konzílium: <b>2 új állítás</b> · 1 portré átírva',d:'tegnap',conf:1},
  {k:'edzo',t:'A tegnapi teremedzésen <b>minden RIR-cél 1-en belül</b> teljesült.',d:'tegnap'},
  {k:'mezo',t:'Portré frissült: Alvás &amp; regeneráció — a hétvégi eltolódás mostantól „biztos” szintű állítás.',d:'aug. 29.',conf:1}];
function npost(p,i){const id=PER[p.k];const c=CH[id].c;
  const kind=p.conf?`<span class="m9-kind" style="--c:var(--gold)">Összegzés</span>`:`<span class="m9-kind" style="--c:${c}">Megfigyelés</span>`;
  const thread=p.conf&&i===2?`<div class="sum"><span class="minis">${av('szunya',true)}${av('deru',true)}${av('mocor',true)}</span>3 szakértői hozzászólás</div>
    <div class="cmt">${av('deru',true)}<p><b>Derű</b>támogatja — A pulzusvariancia is ezt a két napot mutatja gyengébbnek.</p></div>
    <div class="cmt">${av('mocor',true)}<p><b>Mocor</b>vitatja — Szerintem ez nem alvás, hanem hétvégi program.</p></div>
    <div class="cmt">${av('szk',true)}<p><b>Szkeptikus</b>meghagyta — Hat hét adat, konzisztens.</p></div>
    <div class="cmt">${av('mezo',true)}<p><b>Mezo</b>elfogadott javaslat — Bekerül a dossziéba, a Szkeptikus érvét fogadom el. <button data-toast="Mi változott? — üveg-dialógus, már kész" style="color:var(--gold);font-weight:600">Mi változott?</button></p></div>
    <div class="acts">${[['up','thumb-up','Hasznos'],['down','thumb-down','Nem így érzem']].map(([k,ic,l])=>`<button data-mfb="c${i}:${k}" aria-pressed="${ST.mfb['c'+i]===k}">${I(ic)}${l}</button>`).join('')}</div>`:'';
  return `<article class="post rise" style="--c:${c};--i:${i+3}">${phead(id,p.d+' · '+(p.conf?'a csapat összegzése':CH[id].a.toLowerCase()),kind)}<p class="pbody">${p.t}</p>${thread}
   <div class="acts"><button data-sheet="evidence">${I('lens')}Miből látszik?</button><button data-sheet="reply">${I('chat')}Válaszolok</button>${p.conf?`<button data-go="#konzilium">${I('council')}Beszélgetés ›</button>`:''}</div>${rrow()}</article>`}
function hubFace(){
  const h=ST.hub;
  if(h==='degraded')return dsh('info','A karakter-dosszié jelenleg nem elérhető — ez nem hiba, csak a funkció ki van kapcsolva. A napló, az edzés és a Fuel változatlanul működik.');
  if(h==='intro')return `<div class="rhero rise" style="--c:var(--gold)">${B('gold',true)}<h3>Kezdjük el a dossziét</h3><p>A csapat elolvassa a teljes eddigi történetedet — és felépíti az első portrékat.</p></div>
    ${lede('Napi összegzőket, mintákat, tényeket, heti áttekintéseket, naplóbejegyzéseket olvasnak.')}
    <div class="cast" style="justify-content:center;gap:10px">${['szunya','mocor','falat','deru','mezo'].map(id=>`<span class="castb" style="flex:0 0 auto"><span class="fring"><i>${B(CH[id].b)}</i></span><b>${nm(id)}</b></span>`).join('')}</div>
    <div style="text-align:center"><button class="m9-cta" style="--c:var(--gold)" data-st="hub:progress">${I('play')}Kezdjétek el</button></div>`;
  if(h==='progress')return `<div class="rgauges rise" style="padding-top:18px"><div class="rgauge" style="width:120px;height:120px">${ring(34,'var(--gold)',52,120)}<b style="font-size:13px;color:var(--sub)">gyűjtjük…</b></div></div>
    <div class="rows" style="margin-top:22px">${[['deru','Derű a súlytrendet olvassa…'],['mocor','Mocor a logolási mintákat nézi…'],['mezo','Mezo az életeseményeket rendezi…'],['szk','A Szkeptikus ellenőriz…'],['mezo','Mezo összegzi a portrékat…']].map(([id,t],i)=>`<div class="case flatc rise" style="--i:${i+1};--c:${CH[id].c};--s:${CH[id].c}"><span class="cmain">${av(id,true)}<span class="ctxt"><small style="margin:0">${t}</small></span></span></div>`).join('')}</div>
    <p class="m9-fn" style="text-align:center"><button data-st="hub:reveal" style="color:var(--lav)">(prototípus: ugrás a végére)</button></p>`;
  if(h==='reveal')return `<div class="rhero rise" style="--c:var(--gold)"><div class="rgauge" style="width:132px;height:132px;margin:6px auto 0">${segMat()}<b style="font-size:34px;font-weight:300">7</b></div><h3>A dossziéd elkészült</h3><p>7 dimenzió, kezdő állításokkal — mindegyik forrással. Ez csak a kezdet: minden héten tovább finomodik.</p>
    <button class="m9-cta" style="--c:var(--gold);margin-top:16px" data-go="#konzilium">${I('council')}Nézd meg az első konzíliumot</button></div>`;
  if(h==='empty')return `<div class="rhero rise" style="--c:var(--sage)">${I('sprout')}<h3>Még nincs elég történet</h3><p>A csapat pár nap logolás után kezd — addig nincs mit összegezni. Ez nem hiba, csak még korai.</p><button class="m9-cta ghost" style="margin-top:14px" data-st="hub:feed">‹ vissza</button></div>`;
  return '';
}
function segMat(){let s=0;const cs=['var(--lav)','var(--sky)','var(--sage)','var(--rose)','var(--gold)','var(--sky)','var(--rose)'];
  return `<svg viewBox="0 0 132 132" aria-hidden="true"><circle class="ring-track" cx="66" cy="66" r="58" pathLength="100"/>${cs.map((c,i)=>{const o=`<circle class="ring-prog" cx="66" cy="66" r="58" pathLength="100" style="--p:${100/7-1.6};--c:${c};--i:${i};stroke-dashoffset:${-s}"/>`;s+=100/7;return o}).join('')}</svg>`}
function naplo(){
  if(ST.hub!=='feed')return topbar()+dh('EGYRE JOBBAN ISMERÜNK','Karakter')+hubFace();
  const list=FEED.map((p,i)=>[p,i]).filter(([p])=>ST.ff==='Minden'||(ST.ff==='Következtetések'?p.conf:ST.ff==='Megfigyelések'?!p.conf:false));
  return topbar()+dh('EGYRE JOBBAN ISMERÜNK','Karakter')+
  `<div class="strip glass rise" style="--c:var(--sage)">${I('tick')}<span>Elkészült a csapat napi beszélgetése.<small style="display:block;font-weight:400;font-size:10.5px;color:var(--faint);margin-top:2px">Feldolgozott adatok: aug. 30-ig.</small></span><em role="button" data-go="#konzilium">Napi beszélgetés ↗</em></div>`+
  `<article class="glass poster rise" style="--c:var(--lav);--i:1"><div class="crow" style="display:flex;justify-content:space-between;font-size:9.5px;font-weight:600;letter-spacing:1.4px;color:var(--faint)"><span>A CSAPAT TÖRTÉNETEI</span><span>MA</span></div>
    <div class="m9-cast">${av('szunya')}${av('deru')}${av('mocor')}<span class="m9-bub">„A hétvégi lefekvés két órával kitolódik…”</span></div>
    <h3 class="claim">Rólad beszélgettünk.<br>Most te jössz.</h3><p class="pbody">Szunya szerint a hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik. Mocor szerint ez inkább program, mint alvás. A Szkeptikus meghagyta, Mezo elfogadta…</p>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><button class="m9-cta" data-go="#konzilium">Belenézek a beszélgetésbe ↗</button><small style="font-size:10.5px;color:var(--faint);margin-top:10px">3 karakter · 3 szakértői hozzászólás</small></div></article>`+
  `<div class="m9-filt" role="group" aria-label="Bejegyzések szűrése">${['Minden','Megfigyelések','Beszélgetések','Következtetések'].map(f=>`<button class="${ST.ff===f?'on':''}" data-mff="${f}" aria-pressed="${ST.ff===f}">${f}</button>`).join('')}</div>`+
  (list.length?list.map(([p,i])=>npost(p,i)).join('')+`<div style="text-align:center"><button class="m9-cta ghost" data-toast="+12 korábbi bejegyzés">Korábbi bejegyzések</button></div>`:`<p class="m9-lede" style="padding-top:6px">Egyelőre nincs friss megfigyelés ebben a nézetben.</p>`)+
  sec('Mögötte')+`<div class="rows">${rowg('gear','#8E86A3','Hogyan működik?','Források, megfigyelések és feldolgozás','#gepterem')}${rowg('council','var(--gold)','A csapat beszélgetései','Korábbi tanácskozások és döntések','#konzilium')}</div>`;
}

/* ═════════ RÓLAD + DIMENZIÓK ═════════ */
const DIMS=[
  {key:'physical',k:'doki',t:'Fizikai',m:58,c:'A testzsírszázalék lassan csökken, miközben a testsúly stagnál — ez rekompozícióra utal.'},
  {key:'training',k:'edzo',t:'Edzés',m:64,c:'A RIR-becsléseid pontosak: a mondott tartalék jellemzően 1-en belül megjósolja a következő szettet.'},
  {key:'nutrition',k:'taplalkozo',t:'Táplálkozási',m:47,c:'Hétköznap a fehérje stabilan cél körüli, hétvégén rendszeresen alatta marad.'},
  {key:'recovery',k:'szomnologus',t:'Alvás & regeneráció',m:71,c:'A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.'},
  {key:'mind',k:'pszichologus',t:'Lelki',m:39,c:'A hála-bejegyzéseid után jellemzően nyugodtabb napot írsz le.'},
  {key:'discipline',k:'drill',t:'Fegyelem',m:66,c:'A kihagyott logolást jellemzően másnap reggelre pótolod.'},
  {key:'life',k:'antropologus',t:'Élet & emberek',m:31,c:'Az új munkahely első hete óta később fekszel le.'},
  {key:'selfaudit',k:'szkeptikus',t:'A társ önvizsgálata',m:34,c:'A javasolt tényeimből az elmúlt 4 hétben 9-ből 6 maradt meg (2 finomítva), 3 esett ki — ez az én találati arányom, nem a te tulajdonságod.'},
  {key:'chapter',k:null,t:'Munka-stressz ciklus',m:21,c:'Sűrű munkahetek után jellemzően egyszerre csúszik a logolás és a lefekvés.'}];
const dimOwner=d=>d.k?PER[d.k]:'mezo';
function dimRows(){return `<div class="rows">${DIMS.map((d,i)=>{const id=dimOwner(d);
  return `<button class="rowg glass lift rise" style="--c:${CH[id].c};--i:${Math.min(i+1,9)}" data-go="#dimenzio/${d.key}">${d.k?av(id):I('spark')}<span style="flex:1;min-width:0"><b>${d.t}</b><small>${d.c}</small></span><em>${d.m}%</em></button>`}).join('')}</div>`}
function dimenziok(){
  if(ST.hub==='degraded')return topbar()+dh('KARAKTER','Amit eddig tudunk rólad')+dsh('info','A karakter-dosszié jelenleg nem elérhető — ez nem hiba, csak a funkció ki van kapcsolva.');
  return topbar()+dh('KARAKTER · 9 TÉMAKÖR · MINDEGYIK PONTOSÍTHATÓ','Amit eddig tudunk rólad')+dimRows();
}
function rolad(){
  return topbar()+`<div class="pgh rise m9-pgh"><div><small>TE IS ALAKÍTOD A KÉPET</small><h1>Rólad</h1></div>${B('en',true)}</div>
  <div class="rows" style="padding-top:4px">${rowg('book','var(--sage)','Tudástár','tények, jelöltek, életesemények','#tudastar')}${rowg('chat','var(--lav)','Így beszélj velem','a saját kommunikációs kéréseid','Így beszélj velem — a beállításokban (Én II, kész)')}${rowg('graph','var(--lav)','Kapcsolatok','a tudásod térképe','#kategoriak')}</div>`+
  sec('Amit eddig tudunk rólad','9 TÉMAKÖR · MIND PONTOSÍTHATÓ')+dimRows()+
  `<div class="dash rise" style="margin-top:16px">${I('info')}<span>A csapatfal-terv teljes „közös kép” Rólad oldala <b style="color:var(--ink)">később, külön szeletben</b> jön (a Tudástár döntései ide költöznek). <button data-go="#rolad-terv" style="color:var(--lav);font-weight:600">Megnézem a tervet ›</button></span></div>`;
}
const CLAIMS=[['BIZTOS','var(--sage)','A testzsírszázalék lassan csökken, miközben a testsúly stagnál — ez rekompozícióra utal.'],['FIGYELJÜK','var(--lav)','A gyógyszerciklus hetei egyelőre nem mutatnak kimutatható hatást a súlytrenden.'],['VALÓSZÍNŰ','var(--sky)','A reggeli mérések szórása alacsony — a mérési fegyelmed stabil alapot ad a trendnek.']];
function dimenzio(key){
  const d=DIMS.find(x=>x.key===key)||DIMS[0],id=dimOwner(d),c=CH[id].c;
  const sub=d.key==='chapter'?'közös AI-fejezet · érettség':d.key==='selfaudit'?'a társ önvizsgálata · Szkeptikus':`${nm(id)} · érettség`;
  return topbar()+dh('DIMENZIÓ',d.t)+
  `<div class="rhero rise" style="--c:${c}">${B(CH[id].b,true)}<h3>${d.t}</h3><p>${sub}</p></div>
  <div class="rgauges rise" style="padding-bottom:18px"><div class="rgauge" style="--c:${c}">${ring(d.m,c,28,64)}<b>${d.m}%</b><small>ÉRETTSÉG</small></div></div>`+
  `<div class="tcmt rise" style="--c:${c}"><p style="font-size:13.5px;color:var(--ink)">A testösszetételed lassan, de biztosan javul — a testzsír-trend nagyjából három hónap alatt csökken, miközben a testsúlyod közben gyakorlatilag helyben áll. Ez arra utal, hogy a hipertrófia-blokkok tényleg izmot építenek, nem csak számokat mozgatnak.</p></div>`+
  sec('Állítások','3')+`<div class="rows">${CLAIMS.map(([cf,cc,t],i)=>{const fb=ST.fb[i];
    const body=fb==='no'?`<span class="m9-foot">nyugdíjazva — a csapat nem viszi tovább</span>`:fb==='yes'?`<span class="after">${I('tick')}Köszönöm — jegyzem.</span>`:`<span class="inboxa"><button class="chip glass main" style="--c:var(--sage)" data-mfb2="${i}:yes">${I('tick')}Talál</button><button class="chip glass" style="--c:#8E86A3" data-mfb2="${i}:no">${I('skip')}Nem igaz</button><button class="chip glass" style="--c:var(--gold)" data-sheet="reply">${I('pencil')}Pontosítom</button></span>`;
    return `<div class="case glass rise" style="--c:${cc};--s:${cc};--i:${i+2};${fb==='no'?'opacity:.6':''}"><span class="crow"><span class="st">${cf}</span></span><span class="cmain"><span class="ctxt"><b>${t}</b></span></span>${body}
      <div class="m9-links" style="--c:${cc}"><button data-sheet="evidence">Miből látszik?</button><button data-toast="Mi változott? — üveg-dialógus, már kész">Mi változott?</button></div></div>`}).join('')}</div>`+
  `<div class="rows" style="margin-top:12px">${rowg('@mezo','var(--gold)','Beszélgess erről Mezóval','','#chat')}</div>`+
  princ('Az állítások bizonyítékból születnek, sosem fordítva — és amit tévesnek mondasz, azt a csapat nem vitatja tovább.');
}

/* ═════════ KONZÍLIUM (D5 jegyzőkönyv + a live oldal teljes tartalma) ═════════ */
const THREADS=[
  {id:'t1',t:'Regeneráció',faces:['szunya','deru','mocor'],sub:'2 állítás · 3 hozzászólás',items:[['BEKERÜLT','var(--sage)','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.'],['MEGERŐSÍTVE','var(--sage)','Hétfőn a pulzusvariancia rendszeresen gyengébb.']]},
  {id:'t2',t:'Táplálkozási',faces:['falat','szk'],sub:'1 állítás · nem vitatták',items:[['ELVETVE','#8E86A3','A hétvégi fehérje-elmaradás három hete következetes mintázat.']]},
  {id:'t3',t:'Fizikai',faces:['deru'],sub:'1 állítás · 1 elfogadva',items:[['BEKERÜLT','var(--sage)','A testzsír-trend és a stagnáló testsúly rekompozícióra utal.']]},
  {id:'t4',t:'Fegyelem',faces:['mocor'],sub:'1 állítás · 1 elfogadva',items:[['NYUGDÍJAZVA','var(--gold)','A hétvégi logolás rendszeresen elmarad.']]}];
function konzHead(){return topbar()+dh('KONZÍLIUM · AUGUSZTUS 30. · HETI','Az ülés jegyzőkönyve')+
  `<div class="m9-step rise"><button aria-label="Korábbi tanácskozás" data-toast="Korábbi tanácskozás">‹</button><button class="date glass" style="--c:var(--gold)" data-msheet9="archive">augusztus 30. · heti<em>⌄</em></button><button disabled aria-label="Későbbi tanácskozás">›</button></div>`}
function konzilium(){
  if(ST.konz==='none')return topbar()+dh('KONZÍLIUM','Az ülés jegyzőkönyve')+dsh('council','Egyelőre nincs konzílium — a csapat hetente tanácskozik, ez az első hét még nem zajlott le.');
  const seg=`<div class="m9-seg rise" role="group" aria-label="Nézet" style="--c:var(--gold)"><button class="${ST.konz==='ov'?'on':''}" data-st="konz:ov">Áttekintés</button><button class="${ST.konz==='cv'?'on':''}" data-st="konz:cv">Beszélgetés</button></div>`;
  const honest=`<div class="dash rise">${I('shield')}<span>A fenti a valódi beszélgetés, ami lezajlott — a felület sosem dramatizálja utólag; amit itt olvasol, azt a csapat pontosan így mondta.</span></div>`;
  if(ST.konz==='cv')return konzHead()+seg+
    sec('1 · Javaslatok','3 FELVETÉS')+tc('szunya','','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.')+tc('deru','','A testzsír-trend és a stagnáló testsúly rekompozícióra utal.')+tc('falat','','A hétvégi fehérje-elmaradás három hete következetes mintázat.')+
    sec('2 · Kereszt-vita','3 HOZZÁSZÓLÁS')+`<p class="m9-lede" style="font-family:var(--serif);font-style:italic">„A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.” — Szunya</p>`+tc('deru','TÁMOGATJA','A pulzusvariancia is ezt a két napot mutatja gyengébbnek.')+tc('mocor','VITATJA','Szerintem ez nem alvás, hanem hétvégi program — nem viselkedési minta.')+tc('deru','ÁRNYALJA','A kettő nem zárja ki egymást: a program tolja ki, a hatása viszont alvás.')+
    sec('3 · Szkeptikus','2 VIZSGÁLAT')+tc('szk','MEGHAGYTA','Hat hét adat, konzisztens. Mocor ellenvetése nem cáfolja a mintát.')+tc('szk','KUKÁZTA','Három hét túl kevés, és két hétvége nyaralás volt.')+
    sec('4 · Mezo dönt','1 BEKERÜLT · 1 ELVETVE')+`<div class="rows">${cse({c:'var(--gold)',s:'var(--sage)',st:'BEKERÜLT · BIZTOS',av:'mezo',b:'Bekerül a dossziéba — a Szkeptikus érvét fogadom el.'})}${cse({c:'var(--gold)',s:'#8E86A3',st:'ELVETVE',av:'mezo',b:'Elvetem — a Szkeptikus kifogása megalapozott.'})}</div>`+honest;
  return konzHead()+seg+
  `<p class="pbody rise" style="padding:0 18px 10px;font-size:12.5px;color:var(--sub)">Hetente a szakértői csapat átnézi az adataidat, megvitatja egymás felvetéseit, a Szkeptikus kikérdezi őket, és Mezo dönt arról, mi kerül be a rólad szóló dossziéba.</p>`+
  sec('Mi változott a dossziédban')+`<div class="rstat rise">${[['2','BEKERÜLT','var(--sage)'],['1','NYUGDÍJAZVA','var(--gold)'],['1','PORTRÉ ÁTÍRVA','var(--lav)']].map(([n,l,c])=>`<div class="qt glass" style="--c:${c}"><strong class="tint">${n}</strong><small>${l}</small></div>`).join('')}</div>`+
  sec('Hogyan zajlott','4 FORDULÓ')+`<div class="rows">
    ${cse({c:'var(--gold)',s:'var(--lav)',st:'1 · JAVASLAT',em:'5 felvetés',b:'Ki mit hozott az asztalra',sm:'Szunya 2 · Falat 1 · Derű 1 · Mocor 1',i:1,flat:1})}
    ${cse({c:'var(--gold)',s:'var(--sky)',st:'2 · KERESZT-VITA',em:'3 hozzászólás',b:'Ahol egymás felvetéseit nézték',sm:'Derű Szunya mellé állt; Mocor vitatta, Derű árnyalta',i:2,flat:1})}
    ${cse({c:'var(--gold)',s:'#8E86A3',st:'3 · SZKEPTIKUS',em:'5 vizsgálat',b:'A kételkedés köre',sm:'a fehérje-ügyet kevés napnak találta',i:3,flat:1})}
    ${cse({c:'var(--gold)',s:'var(--sage)',st:'4 · MEZO DÖNT',em:'3 elfogadva · 2 elvetve',b:'Ami a képedbe került',sm:'a hétvégi lefekvés-minta + a rekompozíció',i:4,flat:1})}</div>`+
  sec('A szálak','4')+`<div class="rows">${THREADS.map((t,i)=>{const open=ST.th===t.id;
    return `<div class="case ${open?'glass':'flatc'} rise" style="--c:var(--lav);--s:var(--lav);--i:${i+5}"><button class="cmain" data-th="${t.id}" aria-expanded="${open}" style="width:100%;text-align:left"><span class="sum" style="margin:0"><span class="minis">${t.faces.map(f=>av(f,true)).join('')}</span></span><span class="ctxt" style="margin-left:6px"><b>${t.t}</b><small>${t.sub}</small></span><span class="chev">${open?'⌄':'›'}</span></button>
    ${open&&t.id==='t1'?`<div style="margin-top:10px">${tc('szunya','FELVETETTE','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.')}${tc('deru','TÁMOGATJA','A pulzusvariancia is ezt a két napot mutatja gyengébbnek.')}${tc('mocor','VITATJA','Szerintem ez nem alvás, hanem hétvégi program — nem viselkedési minta.')}${tc('szk','MEGHAGYTA · BIZTOS','Hat hét adat, konzisztens.')}${tc('mezo','BEKERÜLT · BIZTOS','Bekerül a dossziéba — a Szkeptikus érvét fogadom el.')}${rrow()}</div>`
    :`<div style="margin-top:8px">${t.items.map(it=>`<div class="evrow"><span class="tst" style="--s:${it[1]}">${it[0]}</span><b style="font-weight:500">${it[2]}</b></div>`).join('')}</div>`}</div>`}).join('')}</div>`+honest;
}

/* ═════════ GÉPTEREM (D5: dev-ajtó, pala) ═════════ */
const SL='#8E86A3';
function gepterem(){
  return topbar()+dh('DEV-AJTÓ · A MOTORHÁZTETŐ ALATT','Gépterem')+
  lede('Boop működése · források, memória és futások. Legutóbb: <b>aug. 30. · 3 megfigyelés · 2 szakértő hívva</b>.')+
  dsh('info','Ez nem a fal része — ide akkor jössz, ha a <b style="color:var(--ink)">gépezetre</b> vagy kíváncsi. Minden, amit a csapat mond, innen ellenőrizhető.')+
  `<div class="rows">${[['history','Futások','e héten 7 futás · 11 megfigyelés','#futasok'],['link','Adatforrások','a teljes tervezett korpusz','#adatforrasok'],['journal','AI-napló','minden hívás tárolva','AI-napló — admin felület (U10)'],['radar','Detektorok','az aktív katalógus','#detektorok'],['layers','Memória','rétegek, eredet és költségek','#memoria'],['eye','Megfigyelők','a coaching javaslatainak háttere','#megfigyelo'],['grid','Összes funkció','a régi teljes menü — minden eszköz egy helyen','#osszes']].map(([ic,t,s,to],i)=>cse({c:SL,s:SL,ic,b:t,sm:s,go:to,i:i+1})).join('')}</div>`+
  princ('Minden Karakter-hívás mentve — feature=character, lépésenként (observe / propose / skeptic / integrate / portrait). Semmi nem tűnik el.');
}
function osszes(){
  const M=[['pattern','var(--lav)','Minták','Amit újra és újra észreveszünk','#mintak'],['orb','var(--sky)','Előrejelzések','Mit vártunk, és mi történt?','#elorejelzesek'],['diagnose','var(--gold)','Diagnózis','Keressünk magyarázatot együtt','#diagnozis'],['flask','var(--sage)','Kísérletek','Kis változtatás, követhető eredmény','#kiserletek'],['calendar','var(--rose)','Heti','Értékelés és a napjaid','Heti — az Én területen (kész)'],['person','var(--lav)','Karakter','Ahogyan a csapat lát téged','#dimenziok'],['book','var(--sage)','Tudástár','Tények, események, kapcsolatok','#tudastar'],['album','var(--lav)','Emlékek','Napló, memoár és visszakeresés','#emlekek'],['council','var(--sky)','Konzílium','A csapat beszélgetései és következtetései','#konzilium'],['whistle','var(--gold)','Coaching','Miért ezt javasoltuk ma?','#coaching'],['chat','var(--rose)','Beszélgetés','Booppal, szövegben és hanggal','#chat'],['gear',SL,'Gépterem','Futások, adatforrások és memória','#gepterem']];
  return topbar()+dh('A GÉPTEREM MELLŐL','Összes funkció')+lede('Minden ismerős eszközöd egy helyen, a saját nevén.')+
  `<div class="iko">${M.map(([ic,c,b,s,to],i)=>`<button class="qt glass lift rise" style="--c:${c};--i:${Math.min(i,9)}" ${go(to)}>${I(ic)}<b>${b}</b><small>${s}</small></button>`).join('')}</div>`;
}
const RUNDAYS=[['H','aug. 24.',[{k:'Konzílium',b:'HETI',ic:'calendar',s:'6 megfigyelés feldolgozva',to:'heti'},{k:'Éjszakai kör',b:'ÉJSZAKAI',ic:'moon',s:'2 megfigyelés · 2 szakértő hívva',to:'ejsz'}]],['K','aug. 25.',[{k:'Éjszakai kör',b:'ÉJSZAKAI',ic:'moon',s:'csendes nap · 0 hívás',q:1,to:'csendes'}]],['SZE','aug. 26.',null],['CS','aug. 27.',[{k:'Éjszakai kör',b:'ÉJSZAKAI',ic:'moon',s:'2 megfigyelés · 2 szakértő hívva',to:'ejsz'}]],['P','aug. 28.',[{k:'Éjszakai kör',b:'ÉJSZAKAI',ic:'moon',s:'hiányos feldolgozás · 1 megfigyelés',f:1,to:'ejsz'},{k:'Esti kiadás',b:'KIADÁS',ic:'scroll',s:'3 poszt',to:'kiadas'}]],['SZO','aug. 29.',[{k:'Éjszakai kör',b:'ÉJSZAKAI',ic:'moon',s:'jelek korábban feldolgozva',q:1,to:'csendes'}]],['MA','aug. 30.',[{k:'Éjszakai kör',b:'ÉJSZAKAI',ic:'moon',s:'3 megfigyelés · 2 szakértő hívva',to:'ejsz'}]]];
function futasok(){
  const W=['aug. 24. – aug. 30.','aug. 17. – aug. 23.','aug. 10. – aug. 16.','aug. 3. – aug. 9.','júl. 27. – aug. 2.','júl. 20. – júl. 26.','júl. 13. – júl. 19.','júl. 6. – júl. 12.'];
  return topbar()+dh('GÉPTEREM · A PIPELINE FUTÁSAI, HETEKRE BONTVA','Futások')+
  `<div class="m9-week rise"><button aria-label="Előző hét" data-toast="Előző hét">‹</button><button class="wl glass" style="--c:${SL}" data-wk><strong>aug. 24. – aug. 30.</strong><small>legutóbbi futások ⌄</small></button><button disabled aria-label="Következő hét">›</button>
   ${ST.wk?`<div class="m9-wmenu glass">${W.map((w,i)=>`<button class="${i?'':'on'}" data-wk>${w}</button>`).join('')}</div>`:''}</div>`+
  RUNDAYS.map(([dow,dt,rows],di)=>`<div class="m9-day ${dow==='MA'?'today':''}"><b>${dow}</b>${dt}</div><div class="rows">${rows?rows.map(r=>cse({c:r.b==='HETI'?'var(--gold)':r.b==='KIADÁS'?'var(--rose)':'var(--lav)',s:r.f?'var(--gold)':r.b==='HETI'?'var(--gold)':r.b==='KIADÁS'?'var(--rose)':'var(--lav)',flat:r.q,st:r.b,em:r.f?'hiányos':'',ic:r.ic,b:r.k,sm:r.s,go:'#futas/'+r.to,i:Math.min(di,8)})).join(''):`<p class="dash free" style="margin:0">${I('info')}<span>nincs adat erről az éjszakáról</span></p>`}</div>`).join('')+
  sec('Ritkább futások')+`<div class="rows">${cse({c:'var(--gold)',s:'var(--gold)',flat:1,st:'HAVI',ic:'calendar',b:'Havi mélyolvasás',sm:'aug. 1. · 23 állítás újramérlegelve',go:'#futas/havi'})}${cse({c:'var(--sage)',s:'var(--sage)',flat:1,st:'BOOTSTRAP',ic:'sprout',b:'Bootstrap',sm:'júl. 15. · 9 kezdő állítás',go:'#futas/havi'})}</div>`;
}
function futas(id){
  const ai=`<div class="rows" style="margin-top:14px">${rowg('journal',SL,'Ehhez a futáshoz tartozó nyers hívások az AI-naplóban','','AI-napló — admin felület (U10)')}</div>`;
  const experts=(ids,lbl)=>`<div class="pills rise">${ids.map(id=>`<span style="--c:${CH[id].c}">${av(id,true)}${nm(id)} · ${lbl}</span>`).join('')}</div>`;
  if(id==='nincs')return topbar()+dh('FUTÁS','Futás')+dsh('info','Ez a futás nem található.');
  if(id==='csendes')return topbar()+dh('FUTÁS · AUG. 25. · CSENDES NAP','Éjszakai kör')+lede('Csendes éjszaka — egyetlen jel sem tüzelt, senkit sem hívtunk.')+
    `<div class="m9-flow rise"><div><b>0</b><small>DETEKTOR TÜZELT</small></div><em>→</em><div><b>0</b><small>HÍVÁS</small></div><em>→</em><div><b>0</b><small>MEGFIGYELÉS</small></div></div>`+
    `<div class="tcmt rise" style="--c:var(--sage);margin-top:14px"><p>Nulla LLM-hívás, nulla token, nulla költség. Ez nem hiányos futás — ez a rendszer pontosan azt csinálta, amit kell: nem talált ki jelet, ahol nem volt.</p></div>`+
    sec('Hívott szakértők')+lede('A többi szakértő ma nem kapott hívást — az ő jeleik a heti konzíliumon érkeznek.')+ai;
  if(id==='heti'||id==='havi'||id==='kiadas'){const W={heti:['FUTÁS · AUG. 24.','Konzílium','A hét 6 megfigyelését dolgoztuk fel a konzíliumon.','6','MEGFIGYELÉS',['szunya','deru','falat','mocor','szk'],'javaslat / döntés'],havi:['FUTÁS · AUG. 1.','Havi mélyolvasás','Havonta egyszer az egész eddigi képet újranézzük — ezúttal 23 állítást mérlegeltünk újra.',null,null,['mezo','szk'],'áttekintés'],kiadas:['FUTÁS · AUG. 28.','Esti kiadás','A mai esti kiadásba 3 poszt került.',null,null,['falat','deru'],'poszt']}[id];
    return topbar()+dh(W[0],W[1])+lede(W[2])+(W[3]?`<div class="m9-flow rise"><div><b>${W[3]}</b><small>${W[4]}</small></div></div>`:'')+sec(id==='kiadas'?'Posztoló karakterek':'Hívott szakértők')+experts(W[5],W[6])+
    (id==='heti'?`<div style="padding:12px 16px 0"><button class="m9-cta" style="--c:var(--gold)" data-go="#konzilium">Teljes transzkript megnyitása ›</button></div>`:'')+ai}
  const S=[['checkin-gap','2 egymást követő napon elmaradt a délutáni check-in','mocor','A kihagyások ritkák nálad — ezen a héten kétszer maradt el a délutáni check-in, érdemes visszaállni a ritmusba.'],['rir-calibration','Szettpárokon: a mondott RIR 1-en belül megjósolta a következő szettet','mocor','A tegnapi teremedzésen minden RIR-cél 1-en belül teljesült — a becsléseidre lehet építeni.'],['sleep-performance-chain','Rövid alvás után kisebb volumen a teremben','szunya','Hat óra alatti éjszaka után a volumened rendre visszaesik — ez a heti konzíliumra megy.']];
  return topbar()+dh('FUTÁS · AUG. 30.','Éjszakai kör')+lede('Átnéztük a szombati napodat — 3 detektor tüzelt, ebből 3 megfigyelés készült (Mocor, Szunya).')+
  `<div class="m9-flow rise"><div><b>3</b><small>DETEKTOR TÜZELT</small></div><em>→</em><div><b>2</b><small>HÍVÁS</small></div><em>→</em><div><b>3</b><small>MEGFIGYELÉS</small></div></div>`+
  sec('A jellánc','EGY SOR = EGY MEGFIGYELÉS')+S.map(([k,code,id,t],i)=>`<div class="tcmt rise" style="--c:${CH[id].c};--i:${i+1}"><div class="th"><span class="tst" style="--s:${CH[id].c}">${i+1}</span><span class="m9-det">${k}</span></div><p>${code}</p><span class="m9-arrow">↓</span><div class="th" style="margin:0 0 4px">${av(id,true)}<b>${nm(id)}</b></div><p style="color:var(--ink)">${t}</p></div>`).join('')+
  sec('Hívott szakértők')+experts(['mocor','szunya'],'megfigyelés')+lede('<span style="display:block;padding-top:8px">A többi szakértő ma nem kapott hívást — az ő jeleik a heti konzíliumon érkeznek.</span>')+ai;
}
const READS=[['Éjszakai kör',['14 nap']],['Vasárnapi konzílium',['1 hét']],['Havi mélyolvasás',['30 nap']],['Bootstrap',['60 összegző','60 minta','40 tény','60 review','60 napló','40 esemény']],['Gym szettek + feedback (RIR, target, ízület)',['14 nap']],['Sport-sessionök',['14 nap']],['Alvás (időtartam, minőség)',['14 nap']],['Kiegészítő-stack (aktív protokoll + bevitelek)',['8 hét','aktív protokoll']],['Étkezés-napok, makró-célok',['14 nap']],['Check-in skálák',['14 nap']]];
function adatforrasok(){
  return topbar()+dh('GÉPTEREM · MIT OLVAS A RENDSZER MA, ÉS MIT TERVEZ','Adatforrások')+
  `<div class="m9-seg rise" role="tablist" style="--c:var(--sage)"><button class="${ST.src==='be'?'on':''}" data-src="be">Bekötve</button><button class="${ST.src==='terv'?'on':''}" data-src="terv">Tervezett</button></div>`+
  (ST.src==='be'?`<div class="tlist rise">${READS.map(([w,ch])=>`<div class="trow">${I('tick')}<span class="ttx"><b>${w}</b><small>${ch.join(' · ')}</small></span></div>`).join('')}<div class="trow"><span class="ttx"><small>+ még 19 bekötött forrás (étkezés, víz, gyógyszerciklus, napló, emberek, chat…)</small></span></div></div>`
   :dsh('tick','Mind a négy kör bekötve.')+lede('+ még 4 terület később'));
}
function kor(){return topbar()+dh('ADATFORRÁSOK','Egy kör')+dsh('info','Ez a kör nem található.')+lede('Ma ez az egyetlen élő állapota: mind a négy kör bekötve, ide nem vezet link.')}
const DET=[['logging-gap','drill','N napja nincs étkezés logolva (2+ egymást követő nap, 14 napos honest cap) — hiányzó kaja-napló jelzés.'],['rir-calibration','edzo','Szettpárokon nézi: a mondott RIR megjósolja-e a következő szettet — az irányt is jelzi.'],['sleep-performance-chain','szomnologus','Rossz alvás utáni napokon visszaesik-e az edzés-teljesítmény.'],['weekend-protein-dip','taplalkozo','Hétvégén a fehérje rendszeresen a cél alá esik-e.'],['weight-trend-break','doki','A 7 napos súlytrend iránya megfordult-e.'],['mood-journal-tone','pszichologus','A napló hangneme 3 napja tartósan lefelé tart-e.'],['life-event-shift','antropologus','Egy új életesemény óta eltolódott-e a napi ritmus.'],['knowledge-rejection-pattern','szkeptikus','A javasolt tények és minták mekkora része maradt meg — a rendszer találati aránya, nem a te tulajdonságod. ÉRZÉKENY.']];
function detektorok(){
  return topbar()+dh('GÉPTEREM · A MA AKTÍV KATALÓGUS, EGY MONDATBAN','Detektorok')+
  `<div class="tlist rise">${DET.map(([k,p,t])=>{const id=PER[p];return `<div class="trow"><span class="ttx"><b style="font-weight:500">${t}</b><small><span class="m9-det">${k}</span> <span style="color:${CH[id].c};font-weight:700;margin-left:4px">${nm(id)}</span></small></span></div>`}).join('')}<div class="trow"><span class="ttx"><small>+ még 32 detektor ugyanígy, egy mondatban</small></span></div></div>`+
  princ('A kód csak észlel — az értelmezés mindig az adott szakértő LLM-hívása. Egy detektor sosem ítél, csak jelez.');
}

/* ═════════ TUDÁSTÁR ═════════ */
const help=`<button class="m9-help glass" data-go="#hogyan" aria-label="Hogyan működik?">?</button>`;
const tudBig=()=>ST.tud==='degraded'?'':`<div class="m9-big rise"><b>15</b><small>tény rólad · 10 megy a chatbe · 12 kapcsolat</small></div>`;
function tudastar(){
  const doors=`<div class="rows">${ST.tud==='degraded'?'':rowg('note','var(--sage)','Tények','10 a chatben · 4 vár · 1 kikapcsolva','#tenyek','15')}${rowg('graph','var(--lav)','Kategóriák','Késői evés rontja az alvást · 12 él','#kategoriak','7')}</div>`;
  const life=sec('Életesemény-jelöltek','1')+`<div class="rows">${cse({c:'var(--gold)',s:'var(--gold)',st:'ÉLETESEMÉNY-JELÖLT',em:'2026-08-21',ic:'journal',b:'Új munkahely első hete',sm:'Hétfőn kezdtél az új helyen, és a hét végére kimerültél. A naplódból raktam össze — csak akkor kerül a gráfba, ha elfogadod.',extra:`<span class="inboxa"><button class="chip glass main" style="--c:var(--sage)" data-toast="Bekerült a gráfba · 1 kapcsolattal">${I('tick')}Elfogad</button><button class="chip glass" style="--c:var(--gold)" data-toast="Pontosít — cím és összefoglaló szerkesztése">${I('pencil')}Pontosít</button><button class="chip glass" style="--c:${SL}" data-toast="Elvetve">${I('skip')}Elvet</button></span><span class="m9-foot">Elfogadás után 1 kapcsolat is bekerül.</span>`})}</div>`+
    sec('Szezon-jelöltek','1')+`<div class="rows">${cse({c:'var(--sky)',s:'var(--sky)',st:'SZEZON-JELÖLT',em:'2026. III. negyedév',ic:'calendar',b:'Nyári alapozás',extra:`<span class="inboxa"><button class="chip glass main" style="--c:var(--sage)" data-toast="Elfogadva">${I('tick')}Elfogad</button><button class="chip glass" style="--c:var(--gold)" data-toast="Pontosít">${I('pencil')}Pontosít</button><button class="chip glass" style="--c:${SL}" data-toast="Elvetve">${I('skip')}Elvet</button></span>`})}</div>`;
  if(ST.tud==='degraded')return topbar()+dh('RÓLAD','Tudástár',help)+dsh('info','A társ jelenleg nincs bekapcsolva — a tudástár most nem elérhető.')+
    sec('Életesemények')+`<div class="rows"><div class="glass case rise" style="--c:var(--sage)"><span class="lifer" style="border-bottom:0"><u style="background:var(--sage)"></u><span style="flex:1"><b>Új munkahely első hete</b><small>Bekerült a gráfba · 1 kapcsolattal</small></span></span></div></div>`+sec('A tudás')+doors;
  return topbar()+dh('RÓLAD','Tudástár',help)+tudBig()+
  (ST.tud==='week'?`<div class="strip glass rise" style="--c:var(--rose)">${I('calendar')}<span>Heti áttekintés · aug. 24. A postaláda minden nyitott javaslatot mutat.</span><em role="button" data-toast="Vissza ehhez a héthez — Én · Hét (kész)">Vissza ›</em></div>`:'')+
  sec('Jóváhagyásra vár','2 JELÖLT')+`<div class="rows">
   ${cse({c:'var(--gold)',s:'var(--gold)',st:'TÉNYJELÖLT',em:'Étkezés · beszélgetésből',ic:'note',b:'Edzés előtt 2-3 órával eszik a legszívesebben.',sm:'Ezt a beszélgetésből szűrtem ki — csak akkor jegyzem meg, ha elfogadod.',i:1,
     extra:`<span class="inboxa"><button class="chip glass main" style="--c:var(--sage)" data-toast="Elfogadva — bekerül a tudástárba">${I('tick')}Elfogad</button><button class="chip glass" style="--c:var(--gold)" data-toast="Pontosít — átírod a szövegét">${I('pencil')}Pontosít</button><button class="chip glass" style="--c:${SL}" data-toast="Elvetve — eldobom">${I('skip')}Elvet</button></span><span class="m9-foot">Elfogad → bekerül a tudástárba · Pontosít → átírod a szövegét · Elvet → eldobom.</span>`})}
   ${cse({c:'var(--gold)',s:'var(--gold)',st:'TÉNYJELÖLT',em:'Edzés · beszélgetésből',ic:'note',b:'A röplabdát heti egy alkalomra ritkítod — csak szombaton jársz.',sm:'Ezt a beszélgetésből szűrtem ki — csak akkor jegyzem meg, ha elfogadod.',i:2,
     extra:`<div class="m9-conflict">Ellentmond ennek: »Volleyball: kedd + csütörtök + szombat«</div><button class="m9-chk ${ST.chk?'':'off'}" data-chk><i>${I('tick')}</i>A régit kikapcsolom</button><span class="inboxa"><button class="chip glass main" style="--c:var(--sage)" data-toast="Elfogadva — a régi kikapcsolva">${I('tick')}Elfogad</button><button class="chip glass" style="--c:var(--gold)" data-toast="Pontosít">${I('pencil')}Pontosít</button><button class="chip glass" style="--c:${SL}" data-toast="Elvetve">${I('skip')}Elvet</button></span>`})}</div>`+
  life+sec('A tudás')+doors;
}
const CAT={train:['EDZÉS','dumbbell','var(--sky)'],fuel:['ÉTKEZÉS','bowl','var(--sage)'],health:['EGÉSZSÉG','heart','var(--rose)'],life:['ÉLET','sun','var(--gold)']};
const FACTS=[['train','Pull Day-en a Chest Supported Row a key compound.','12× visszaigazolva · beszélgetésből'],['fuel','A késői étkezés és az alvásminőség együtt mozog.','8× visszaigazolva · mintából — „Késői étkezés ↔ rákövetkező alvásminőség”',1],['health','A reggeli mérés 7:00 és 7:30 között történik.','6× visszaigazolva · beszélgetésből'],['life','Volleyball: kedd + csütörtök + szombat.','5× visszaigazolva · kézzel']];
const frow=(f,st)=>{const [l,ic,c]=CAT[f[0]];return `<div class="trow ${st==='off'?'off':''} ${f[3]?'hl':''}">${I(ic)}<span class="ttx"><b style="font-weight:500">${f[1]}</b><small>${l.toLowerCase()} · ${f[2]}</small><small style="color:${st==='in'?'var(--sage)':'var(--faint)'};font-weight:600">${st==='in'?'Most benne van a chatben':st==='wait'?'Bekapcsolva, de most kimarad':'Kikapcsolva — a társ nem látja'}</small></span><span class="m9-tgl ${st==='off'?'':'on'}" role="switch" aria-checked="${st!=='off'}"><i></i></span></div>`};
function tenyek(){
  return topbar()+dh('TUDÁSTÁR','Tények',help)+tudBig()+
  `<button class="search rise" data-toast="Keresés a tények között">${I('lens')}Keresés · pl. alvás, kávé, váll</button>`+
  `<div class="m9-filt" style="--c:var(--sage);padding-top:8px">${['Mind','Edzés','Étkezés','Egészség','Élet'].map((c,i)=>`<button class="${i?'':'on'}" data-toast="Szűrés: ${c}">${c}</button>`).join('')}</div>`+
  sec('Most ezeket kapja meg a társ','10')+`<div class="tlist rise">${FACTS.map(f=>frow(f,'in')).join('')}</div>`+
  `<p class="m9-fn">Minden beszélgetés elején ezek a mondatok mennek elé: a 10 legerősebb bekapcsolt tény, plusz a frissen megerősített minták.</p>`+
  `<div style="padding:0 16px"><button class="m9-fold" data-life="wait"><span>Bekapcsolva, de most kimarad · 4</span>${ST.waitOpen?'⌃':'⌄'}</button></div>${ST.waitOpen?`<div class="tlist" style="margin-top:8px">${frow(['fuel','Hétvégén később kezdődik az első étkezés.','2× visszaigazolva · beszélgetésből'],'wait')}${frow(['train','A vállnyomásnál a bal oldal érzékenyebb.','1× visszaigazolva · beszélgetésből'],'wait')}</div><p class="m9-fn">Ha megerősödnek, vagy egy erősebb tény kiesik, bekerülnek a chatbe.</p>`:''}`+
  `<div style="padding:0 16px"><button class="m9-fold" data-life="off"><span>Kikapcsolva · 1</span>${ST.offOpen?'⌃':'⌄'}</button></div>${ST.offOpen?`<div class="tlist" style="margin-top:8px">${frow(['fuel','kifli.hu az elsődleges élelmiszer-forrás.','3× visszaigazolva · beszélgetésből'],'off')}</div><p class="m9-fn">Megőrzöm őket, de a társ nem használja.</p>`:''}`;
}
const KINDS=[['Minták','pattern','var(--gold)',3,'Késői evés rontja az alvást'],['Preferenciák','checkin','var(--sage)',4,'Reggel edz a legszívesebben'],['Célok','flag','var(--coral)',2,'Nyári alapozás'],['Életesemények','sun','var(--sky)',1,'Új munkahely első hete'],['Szezonok','calendar','var(--sky)',1,'Nyári alapozás'],['Belátások','bulb','var(--lav)',0,'—'],['Emberek','people','var(--rose)',2,'Anna']];
function kategoriak(){
  return topbar()+dh('TUDÁSTÁR · UGYANENNEK A TUDÁSNAK A TÉRKÉPE','Kategóriák')+
  `<div class="iko" style="padding-top:4px">${KINDS.map((k,i)=>k[3]?`<button class="qt glass lift rise" style="--c:${k[2]};--i:${i}" data-go="#kind/${i}"><span class="n">${k[3]}</span>${I(k[1])}<b>${k[0]}</b><small>${k[4]}</small></button>`:`<div class="qt empty rise" style="--c:${k[2]};--i:${i}"><span class="n">0</span>${I(k[1])}<b>${k[0]}</b><small>—</small></div>`).join('')}</div>`;
}
function kind(i){const k=KINDS[+i||0];
  return topbar()+dh('KATEGÓRIA',`${k[0]} · ${k[3]}`)+`<div class="tlist rise">${[['Késői evés rontja az alvást','2 kapcsolat'],['Hétvégi fehérje-elmaradás','1 kapcsolat'],['Rövid alvás után kisebb volumen','']].slice(0,Math.max(1,k[3])).map(r=>`<button class="trow tlink" data-go="#node">${I(k[1])}<span class="ttx"><b>${r[0]}</b>${r[1]?`<small>${r[1]}</small>`:''}</span><span class="chev" style="color:var(--faint)">›</span></button>`).join('')}</div>`}
function hogyan(){
  const Q=[['book','Mi az a tény?','Egy rólad szóló mondat, amit a társ megjegyzett. Vagy a beszélgetéseitekből szűrte ki, vagy egy megerősített mintából tanulta, vagy te vetted fel kézzel.'],['key','Mit csinál a kapcsoló?','Bekapcsolva a tény versenyben van azért, hogy bekerüljön minden beszélgetés elé. Kikapcsolva a társ soha nem látja — sem a válaszaiban, sem a felismeréseiben.'],['repeat','Mit jelent a visszaigazolás?','Hányszor jött vissza ugyanez magától: vagy újra elmondtad a chatben, vagy a minta-motor újra kimérte. Minél többször, annál előrébb sorolódik.'],['layers','Miért marad ki néhány?','Csak a 10 legerősebb bekapcsolt tény fér be egy beszélgetésbe. A többi bekapcsolva marad és várakozik — ha megerősödik, bekerül. Kivétel: egy frissen megerősített minta-tényt az első 3 napban a rangsortól függetlenül is megkapja a társ.'],['bulb','Mi vár jóváhagyásra?','A beszélgetésből kiszűrt javaslatok. Amíg nem fogadod el őket, semmi nem történik velük — a társ nem használja őket.'],['graph','Mik a kategóriák?','Ugyanennek a tudásnak a térképe: minták, célok, életesemények és a köztük lévő kapcsolatok.']];
  return topbar()+dh('TUDÁSTÁR','Hogyan működik?')+Q.map(([ic,q,a],i)=>`<div class="tcmt rise" style="--c:var(--gold);--i:${i}"><div class="th">${I(ic)}<b>${q}</b></div><p>${a}</p></div>`).join('');
}
function node(){
  return topbar()+dh('MINTA · KAPCSOLAT','Késői evés rontja az alvást')+
  `<div class="rows">${cse({c:'var(--gold)',s:'var(--gold)',st:'MINTA',ic:'pattern',b:'A 21 óra utáni vacsora után a következő éjszaka rendre felszínesebb.',
    extra:`<div style="margin-top:12px"><small style="display:block;font-size:8.5px;font-weight:700;letter-spacing:1px;color:var(--faint);margin-bottom:4px">KAPCSOLATOK</small>
      <div class="evrow"><b>Késői evés → kiváltja → Rossz alvás</b><em>erős</em></div><div class="evrow" style="border-bottom:0"><b>Rossz alvás → támogatja → Gyenge edzés</b><em>közepes</em></div></div>
      <span class="inboxa"><button class="chip glass" style="--c:${SL}" data-toast="Archiválva">${I('album')}Archivál</button></span><span class="m9-foot">Archiválás után nem kerül a beszélgetésbe. A forrásadataid megmaradnak.</span>`})}</div>
  <a class="m9-flink" href="#kategoriak">Tudástár · vissza a listához →</a>`;
}

/* ═════════ MINTÁK (a lista, ahová az U8a mélyoldalak vissza-gombja visz) ═════════ */
const BK=[['decide','döntésre vár','bell',2,'var(--coral)'],['monitoring','megfigyelés','eye',4,'var(--lav)'],['confirmed','megerősítve','tick',6,'var(--sage)'],['gathering','még gyűlik','up',5,'var(--gold)'],['noRel','nincs kapcsolat','hold',3,SL],['rejected','elvetve','skip',1,SL]];
const tile=(ic,c,b,s,to,cls='glass lift',bar_=null)=>`<button class="qt ${cls} rise" style="--c:${c}" ${go(to)}>${I(ic)}<b>${b}</b><small>${s}</small>${bar_!=null?bar(bar_,c):''}</button>`;
function bucket(){const b=ST.bucket;
  if(b==='decide')return sec('Döntésre vár · 2','CSAK ERŐS JEL')+`<div class="rows">
    ${cse({c:'var(--gold)',s:'var(--sage)',st:'MEGBÍZHATÓ JEL',em:'Vízbevitel ↔ energia · 34 közös nap',ic:'water',b:'Több energiád van, ha többet iszol?',i:2,
      extra:`<span class="well" style="display:block"><small style="display:block;font-size:8.5px;font-weight:700;letter-spacing:1px;color:var(--faint)">AMIT EDDIG LÁTUNK</small><span style="display:block;font-size:13px;line-height:1.5;margin-top:4px">Erős jel: a többet ivós napokon <b style="display:inline;font-size:13px;color:var(--gold)">határozottan</b> jobb a délutáni energiád.</span><span style="display:block;font-size:11px;color:var(--faint);margin-top:3px">34 nap alapján, a véletlen kizárható.</span></span>
      <span class="well" style="display:block;background:rgba(171,159,210,.06)"><small style="display:block;font-size:8.5px;font-weight:700;letter-spacing:1px;color:var(--faint)">MI TÖRTÉNIK A DÖNTÉSEDDEL</small><span style="display:block;font-size:11.5px;line-height:1.5;color:var(--sub);margin-top:4px"><b style="display:inline;font-size:11.5px;color:var(--sage)">Megerősítem</b> — tartós tudás lesz. <b style="display:inline;font-size:11.5px;color:var(--lav)">Figyeljük még</b> — marad a listán, de nem tanulok belőle. <b style="display:inline;font-size:11.5px">Elvetem</b> — befagy, többé nem hozom elő.</span></span>
      <span class="inboxa"><button class="chip glass main" style="--c:var(--sage)" data-mack="confirm">${I('tick')}Megerősítem</button><button class="chip glass" style="--c:var(--lav)" data-mack="monitor">${I('lens')}Figyeljük</button><button class="chip glass" style="--c:${SL}" data-mack="reject">${I('skip')}Elvetem</button></span>
      <button class="m9-flink" style="padding:10px 0 0" data-go="#minta/viz">Részletek és előzmények →</button>`})}
    ${cse({c:'var(--gold)',s:'var(--gold)',st:'ÍGÉRETES JEL',em:'14 közös nap',ic:'moon',b:'Rosszabbul alszol, ha későn vacsorázol?',sm:'Késői étkezés ↔ rákövetkező alvásminőség',i:3,
      extra:`<span class="inboxa"><button class="chip glass main" style="--c:var(--sage)" data-mack="confirm">${I('tick')}Megerősítem</button><button class="chip glass" style="--c:var(--lav)" data-mack="monitor">${I('lens')}Figyeljük</button><button class="chip glass" style="--c:${SL}" data-mack="reject">${I('skip')}Elvetem</button></span>`})}</div>`;
  if(b==='confirmed')return sec('Megerősítve — él a tudásban','6')+`<div class="iko">${[['moon','Magas sportterhelés → mélyebb alvás','12 közös nap'],['plate','Késői étkezés → felszínes alvás','14 közös nap'],['water','Vízbevitel → délutáni energia','8 közös nap'],['journal','Hála-napló → nyugodtabb nap','11 közös nap']].map(t=>tile(t[0],'var(--sage)',t[1],t[2],'#minta/viz/megerositve')).join('')}</div><p class="m9-fn">Ez a 6 összefüggés benne van a társ fejében minden beszélgetésnél, és ebből épülnek az előrejelzések.</p>`;
  if(b==='monitoring')return sec('Megfigyelés alatt','4')+`<div class="iko">${[['moon','Vacsora ideje ↔ alvásminőség','Ígéretes jel, de még nem elég biztos.',70],['journal','Anna a hála-naplóban → többet alszol','4 találat, 1 kihagyás.',38],['person','Súly ↔ vízbevitel','Gyenge, még ingadozó.',45],['dumbbell','Push nap ↔ vállérzékenység','Tartja magát.',60]].map(t=>tile(t[0],'var(--lav)',t[1],t[2],'#minta/vacsora','glass lift',t[3])).join('')}</div>`;
  if(b==='gathering')return sec('Még gyűlik az adat','5')+`<div class="iko">${[['dumbbell','Egyforma terhelés ↔ reggeli energia','5 / 8 nap'],['plate','Hétvége ↔ késői étkezés','+2 hétvégi nap kell'],['water','Vízbevitel ↔ energia-szint','Pihen — várom az adatot']].map(t=>tile(t[0],'var(--gold)',t[1],t[2],'#minta/egyhangu','empty lift')).join('')}</div><p class="m9-fn">Ezek nem hibák — csak nincs elég közös nap. Amit logolsz, az hozza őket életre.</p>`;
  return sec(b==='rejected'?'Elvetve':'Megnéztük — nincs összefüggés',b==='rejected'?'1':'3')+`<div class="iko">${[['plate','Koffein ↔ edzés-RPE','Nincs kapcsolat a két érték között.'],['moon','Lépésszám ↔ alvásidő','Nincs kapcsolat.']].map(t=>tile(t[0],SL,t[1],t[2],'#minta/viz/elvetve','flatq lift')).join('')}</div><p class="m9-fn">Ez is eredmény: megnéztük, és nincs kapcsolat. Nem kér döntést — ha később megerősödne, feljebb lép.</p>`;
}
function mintak(){
  const ackT={confirm:'Beépítettem a tudásba — mostantól számolok vele.',monitor:'Rendben, figyeljük tovább — szólok, ha erősödik.',reject:'Elvetve — nem hozom fel újra.'};
  return topbar()+dh('MEZO · A MOTOR','Minták')+`<div class="m9-big rise"><b>6</b><small>megerősített összefüggés él a tudásban</small></div>`+
  `<div class="rows"><div class="case glass rise" style="--c:var(--gold);--s:var(--lav);--i:1"><span class="crow"><span class="st">A MOTOR ÁLLAPOTA</span><em>ma 14:12 · 60 nap</em></span>
    <p class="pbody" style="--c:var(--gold)"><b>21 kérdést</b> figyelek a naplóidból. <b>6 megerősített</b> összefüggés dolgozik a társban, <b>2 vár a döntésedre</b>.</p>
    <div class="m9-lgrid">${BK.map(k=>`<button class="${k[0]==='decide'?'hot':''} ${ST.bucket===k[0]?'sel':''}" style="--c:${k[4]}" data-st="bucket:${k[0]}" aria-pressed="${ST.bucket===k[0]}"><b>${k[3]}</b><small>${I(k[2])}${k[1]}</small></button>`).join('')}</div>
    <div class="m9-tool"><span>Minden téma</span><button data-msheet9="filter">${I('gear')}Szűrés</button></div></div></div>`+
  (ST.ack?`<div style="padding:10px 16px 0"><span class="after big">${I('tick')}${ackT[ST.ack]}</span></div>`:'')+
  bucket()+`<div class="m9-pager"><button aria-label="Előző oldal" data-toast="Előző oldal">‹</button>1–4 / 6<button aria-label="Következő oldal" data-toast="Következő oldal">›</button></div>`+
  sec('Adat-egészség')+`<div class="m9-cov">${[['Hangulat',12,'var(--coral)','7/60 · 3 napja'],['Vízbevitel',40,'var(--gold)','24/60 · ma'],['Alvás',97,'var(--sage)','58/60 · ma'],['Edzés',88,'var(--sage)','53/60 · tegnap'],['Étkezés',93,'var(--sage)','56/60 · ma']].map(c=>`<div class="rgauge" style="--c:${c[2]}">${ring(c[1],c[2],28,64)}<b>${c[1]}</b><small>${c[0].toUpperCase()}<br>${c[3]}</small></div>`).join('')}</div>`+
  `<a class="m9-flink" href="#memoria">A motor bemenete: memória-rétegek →</a>`;
}

/* ═════════ ELŐREJELZÉSEK (a lista; a mélyoldalak az U8a #elore/* oldalai) ═════════ */
const PRED=[{k:'meccs-energia',s:'pending',c:72,b:'Március óta a 102.5 stabil. Múlt heti RIR 2 + 7.5h alvás kombináció historikusan +5kg-os emelést támogatott.'},{k:'lefekves',s:'validated',a:'RPE 8.2 · vacsora 20:50'},{k:'alvas-edzes',s:'missed',a:'6 ó 20 p'}];
const PS9={pending:['FOLYAMATBAN','var(--lav)'],validated:['BEVÁLT','var(--sage)'],missed:['NEM JÖTT BE',SL]};
function elorejelzesek(){
  const head=topbar()+dh('MEZO · ÖSSZES FUNKCIÓ','Előrejelzések');
  if(ST.pred==='empty')return head+dsh('orb','<b style="color:var(--sky)">tanulom</b> · Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.');
  const list=PRED.filter(p=>ST.pred==='all'||(ST.pred==='pending'?p.s==='pending':p.s!=='pending'));
  return head+`<div class="m9-big rise"><span class="m9-acc">68<small>%</small></span><small>2 bevált · 60 napos pontosság</small></div>`+
  sec('Aktív predikciók')+`<div class="m9-filt" style="--c:var(--sky)" role="group" aria-label="Előrejelzések szűrése">${[['all','Mind'],['pending','Folyamatban'],['closed','Lezárt']].map(([k,l])=>`<button class="${ST.pred===k?'on':''}" data-st="pred:${k}">${l}</button>`).join('')}</div>`+
  (list.length?`<div class="rows">${list.map((p,i)=>{const e=ELORE[p.k]||{},live=p.s==='pending',[sl,sc]=PS9[p.s];const f=ST.mfb['p'+i];
    return `<div class="case ${live?'glass':'flatc'} rise" style="--c:${live?'var(--sky)':sc};--s:${sc};--i:${i+1}"><span class="crow"><span class="st">${sl}</span><em>${e.date||''}</em></span>
    <button class="cmain" data-go="#elore/${p.k}" style="width:100%;text-align:left">${I('orb')}<span class="ctxt"><b>${e.title||''}</b>${p.b?`<small>${p.b}</small>`:''}</span><span class="chev">›</span></button>
    ${live?`<div class="honest" style="margin-top:10px">${bar(p.c,'var(--sky)',i)}<b style="color:#BFDCF5">${p.c}%</b></div>`:''}
    ${p.a?(p.s==='validated'?`<span class="after">${I('tick')}Bejött: ${p.a}</span>`:`<span class="m9-foot">Megfigyelt eredmény: ${p.a}</span>`):''}
    <div class="acts">${[['up','thumb-up','Segített'],['down','thumb-down','Nem talált']].map(([k,ic,l])=>`<button data-mfb="p${i}:${k}" aria-pressed="${f===k}">${I(ic)}${l}</button>`).join('')}</div></div>`}).join('')}</div>`
  :lede('Ebben az állapotban még nincs előrejelzés.'));
}

/* ═════════ ÚJ IKONOK (U9) ═════════ */
function ikonok9(){
  const N=[['council','Konzílium','a Konzílium, a napló és az Összes funkció','var(--gold)'],['radar','Detektor','a Detektorok és a Gépterem sora','var(--sky)'],['graph','Kapcsolatok','a Kategóriák, a Rólad és a Tudástár','var(--lav)'],['grid','Összes funkció','a régi teljes menü sora a Gépteremben',SL]];
  return topbar()+dh('A 9. SZELET · JÓVÁHAGYVA 2026-09-25','Új ikonok')+lede('A közös 3D-készletbe kerültek; a későbbi körök is ezeket használják.')+
  `<div class="iko">${N.map((n,i)=>`<div class="qt glass rise" style="--c:${n[3]};--i:${i}">${I(n[0])}<b>${n[1]}</b><small>${n[2]}</small></div>`).join('')}</div>`;
}

/* ═════════ lapok (MZX saját lapjai; a csapatfal-lapok változatlanok) ═════════ */
const SH9={
  archive:['var(--gold)',()=>`<div class="shh">${I('council')}<div class="grow"><span class="eb">KONZÍLIUM</span><h3>Korábbi tanácskozások · 9</h3></div><button class="x" data-closesheet aria-label="Bezár">✕</button></div>
   <div class="arcmh">2026 · AUGUSZTUS</div>${[['augusztus 30.','2 bekerült · 1 nyugdíjazva','HETI',1],['augusztus 29.','nincs új következtetés','NAPI BESZÉLGETÉS',0],['augusztus 23.','3 bekerült · 1 egyéb változás','HETI',0],['augusztus 1.','23 állítás újramérlegelve','HAVI',0]].map(r=>`<button class="optrow ${r[3]?'on':''}" data-closesheet><div class="grow"><strong>${r[0]}</strong><small>${r[1]}</small></div>${fchip(r[2],'var(--gold)')}</button>`).join('')}
   <div class="arcmh">2026 · JÚLIUS</div><button class="optrow" data-closesheet><div class="grow"><strong>július 15.</strong><small>9 kezdő állítás</small></div>${fchip('BOOTSTRAP','var(--sage)')}</button>`],
  filter:['var(--gold)',()=>`<div class="shh">${I('pattern')}<div class="grow"><span class="eb">MINTÁK</span><h3>Szűrés</h3></div><button class="x" data-closesheet aria-label="Bezár">✕</button></div>
   <span class="eb" style="display:block;margin:6px 2px 8px">TÉMA</span><div style="display:flex;flex-wrap:wrap;gap:6px"><button class="flat on" style="--c:var(--gold)">Mind</button>${[['moon','Alvás'],['dumbbell','Edzés'],['plate','Fuel'],['journal','Lélek'],['person','Test']].map(d=>`<button class="flat" style="--c:var(--gold)">${I(d[0])}${d[1]}</button>`).join('')}</div>
   <span class="eb" style="display:block;margin:16px 2px 8px">SORREND</span><div class="seg" style="margin:0"><button class="on" style="--c:var(--gold)">Áttöréshez legközelebb</button><button>Téma szerint</button></div>
   <div style="padding-top:18px"><button class="pillx" style="--c:var(--gold);width:100%;justify-content:center" data-closesheet>${I('tick')}Alkalmazom</button></div>`]};
function openSheet9(k){const [c,f]=SH9[k];const s=$('#sheet');s.style.setProperty('--c',c);s.innerHTML=`<div class="grab"></div><div class="u8">`+f()+`</div>`;$('#scrim').classList.add('on');s.classList.add('on');s.scrollTop=0}

/* ═════════ regiszter: a csapatfal render()-je ezt kérdezi ═════════ */
const U8V={chat,coaching,megfigyelo,kartya,diagnozis,diag:id=>diag(id),emlekek,emlek,kiserletek,memoar,archivum,fejezet:id=>fejezet(id||19),memoria};
const U9V={naplo,dimenziok,dimenzio:id=>dimenzio(id),rolad,konzilium,gepterem,osszes,futasok,futas:id=>futas(id||'ejsz'),adatforrasok,kor,detektorok,tudastar,tenyek,kategoriak,kind:id=>kind(id),hogyan,node,mintak,elorejelzesek,ikonok9};
const TABS={fal:['naplo','mintak','elorejelzesek','kiserletek','diagnozis','diag','coaching','megfigyelo','kartya','chat'],csapat:['konzilium','gepterem','osszes','futasok','futas','adatforrasok','kor','detektorok','memoria'],
  rolad:['rolad','dimenziok','dimenzio','tudastar','tenyek','kategoriak','kind','hogyan','node','ikonok9','rolad-terv'],emlekek:['emlekek','emlek','memoar','archivum','fejezet']};
window.MZX={
  has:r=>r in U8V||r in U9V,
  view:(r,id)=>r in U8V?`<div class="u8">${U8V[r](id)}</div>`:`<div class="m9">${U9V[r](id)}</div>`,
  after:r=>{if(r==='chat'){$('#dock').innerHTML=`<div class="u8">${ST.ch!=='off'?composer():''}</div>`;$('#phone').classList.add('nofab')}},
  tab:r=>Object.keys(TABS).find(t=>TABS[t].includes(r))||null,
};
const route=()=>(location.hash||'#fal').slice(1).split('/');
function soft(){const y=$('#scroll').scrollTop,[r,id]=route();if(!MZX.has(r))return;$('#scroll').innerHTML=MZX.view(r,id);$('#dock').innerHTML='';$('#phone').classList.remove('nofab');MZX.after(r,id);$('#scroll').scrollTop=y}
const HOME={ch:'#chat',card:'#kartya',dg:'#diagnozis',ex:'#kiserletek',srch:'#emlekek',mem:'#memoria',hub:'#naplo',konz:'#konzilium',tud:'#tudastar',bucket:'#mintak',pred:'#elorejelzesek'};
document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('[data-closesheet]')){closeSheet();return}
  const ac=t.closest('[data-act]'); if(ac){ST.act=ac.dataset.act;openSheet('actions');return}
  const st=t.closest('[data-st]'); if(st){e.preventDefault();const [k,v]=st.dataset.st.split(':');ST[k]=v;if(k==='bucket')ST.ack='';closeSheet();
    const cur='#'+route()[0];if(cur!==HOME[k]&&!(k==='srch'&&cur==='#memoria')&&!(k==='hub'&&cur==='#dimenziok')){location.hash=HOME[k]}else{soft()}return}
  if(t.closest('[data-tools]')){ST.tools=!ST.tools;soft();return}
  if(t.closest('[data-mems]')){ST.mems=!ST.mems;soft();return}
  if(t.closest('[data-probe]')){ST.probe=true;soft();toast('Elindítva: aktív kísérlet lett');return}
  const ru=t.closest('[data-rule]'); if(ru){ST.rule=ST.rule===ru.dataset.rule?'':ru.dataset.rule;soft();return}
  const ms=t.closest('[data-msheet]'); if(ms){e.preventDefault();openSheet(ms.dataset.msheet);return}
  const ms9=t.closest('[data-msheet9]'); if(ms9){e.preventDefault();openSheet9(ms9.dataset.msheet9);return}
  const ff=t.closest('[data-mff]'); if(ff){ST.ff=ff.dataset.mff;soft();return}
  const fb=t.closest('[data-mfb]'); if(fb){const [i,v]=fb.dataset.mfb.split(':');ST.mfb[i]=ST.mfb[i]===v?'':v;soft();if(ST.mfb[i])toast(v==='up'?'Köszönjük a visszajelzést.':'Mi nem stimmelt? pontatlan · túl sok · rossz időzítés · nem rólam szól');return}
  const fb2=t.closest('[data-mfb2]'); if(fb2){const [i,v]=fb2.dataset.mfb2.split(':');ST.fb[i]=v;soft();if(v==='no')toast('Rendben — a csapat nem viszi tovább');return}
  const th=t.closest('[data-th]'); if(th){ST.th=ST.th===th.dataset.th?'':th.dataset.th;soft();return}
  const sr=t.closest('[data-src]'); if(sr){ST.src=sr.dataset.src;soft();return}
  if(t.closest('[data-wk]')){ST.wk=!ST.wk;soft();return}
  if(t.closest('[data-chk]')){ST.chk=!ST.chk;soft();return}
  const lf=t.closest('[data-life]'); if(lf){if(lf.dataset.life==='wait')ST.waitOpen=!ST.waitOpen;else ST.offOpen=!ST.offOpen;soft();return}
  const ak=t.closest('[data-mack]'); if(ak){ST.ack=ak.dataset.mack;soft();return}
});
if(/still/.test(location.search)){document.body.classList.add('still');$('#still').checked=true}
render();
