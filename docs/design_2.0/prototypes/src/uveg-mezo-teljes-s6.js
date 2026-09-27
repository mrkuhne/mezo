
/* ═════════════════ S6 · MEZO EMLÉKEZETE — TUDÁSTÁR-HUB (mezo-d6ivw.6) ═════════════════
   Kirakat + raktár (owner, 2026-09-27): a Rólad oldalon kirakat-kártyák, minden kezelés a
   Tudástár füleiben. Új nézetek: #emberek, #hatasok. Bővül: #tudastar (ajtók), #tenyek
   (forrás · szerkesztés · törlés+visszavonás · elnémítva/korábban igaz volt), a Minták
   „megerősítve” vödre (életciklus-jelvények). Csak meglévő sprite-ikonok. */

Object.assign(ST,{s6del:{},s6edit:'',s6undo:null,s6m:false,s6h:false,s6all:false});

/* ── Rólad: kirakat a Tovább elé ── */
function kirakat6(){
  const K=[['note','var(--sage)','15','Tények rólad','Koffein 14:00 után már nem','#tenyek'],
    ['people','var(--rose)','3','Emberek','Anna · Márk · Lili','#emberek'],
    ['tick','var(--gold)','6','Észrevételek','1 újraellenőrzés fut','#mintak'],
    ['chain','var(--sky)','5','Hatások','Anna szóba kerül → jobb hangulat','#hatasok']];
  return sec('Amit a csapat megjegyzett','A TELJES TÁR')+
  `<div class="iko">${K.map((k,i)=>`<button class="qt glass lift rise" style="--c:${k[1]};--i:${i}" data-go="${k[5]}"><span class="n">${k[2]}</span>${I(k[0])}<b>${k[3]}</b><small>${k[4]}</small></button>`).join('')}</div>`;
}
/* Rövid elosztó (owner, 2026-09-27): benyomás + döntésre vár (max 2, a többi lenyitható) +
   kirakat + ajtók. A tény-lista dupláját a kirakat váltja; az életesemények ajtót kaptak. */
function rolad6(){
  const off=ST.rol==='degraded',empty=ST.rol==='empty';
  const head=topbar()+`<div class="pgh rise m9-pgh"><div><small>A KÖZÖS KÉP · AMIT A CSAPAT KIMONDOTT RÓLAD</small><h1>Rólad</h1></div>${B('en',true)}</div>`;
  const week=ST.rol==='week'?`<div class="strip glass rise" style="--c:var(--rose)">${I('calendar')}<span>Heti áttekintés · szept. 15–21. A héten felmerült javaslatok.</span><em role="button" data-toast="Vissza ehhez a héthez — Én · Hét (kész)">Vissza ›</em></div>`:'';
  const quote=empty?`<div class="note glass rise" style="--c:var(--rose);--i:1;margin-top:10px">${I('person')}<div><small>A CSAPAT BENYOMÁSA</small><p>Még gyűjtjük, amit rólad tudni érdemes — az első kimondott benyomás ide kerül.</p></div></div>`:
   `<div class="quote glass rise" style="--c:var(--rose);--i:1"><p>„Hétvégén rendszeresen később fekszel le — és a hétfői edzésed ezt meg is érzi.”</p>
    <small>Így fogalmaz most rólad <b style="color:var(--lav)">Szunya</b> · a legbiztosabb állítás · javítható benyomás, nem címke</small>
    <span class="crow">${ST.rq==='talal'?`<span class="after" style="margin:0">${I('thumb-up')}Megerősítetted — a benyomás erősödik</span>`:`<button class="chip glass" style="--c:var(--sage)" data-rq="talal">${I('thumb-up')}Talál</button>`}<button class="chip glass" style="--c:var(--gold)" data-sheet="reply">${I('chat')}Pontosítom</button></span></div>`;
  const items=empty?[]:(ST.rol==='week'?INB.filter(x=>!x.life):INB);
  const undecided=items.filter(x=>!ST.rinb[x.id]),open=undecided.length;
  const shown=ST.s6all?items:undecided.slice(0,2);
  const rest=items.length-shown.length;
  const more=rest>0?`<button class="rowg glass lift rise" style="--c:var(--gold)" data-s6fold="all">${I('bell')}<span style="flex:1;min-width:0"><b>${ST.s6all?'Mutass kevesebbet':`Még ${rest} javaslat`}</b><small>${ST.s6all?'vissza a rövid nézethez':'korábban eldöntöttek és további jelöltek'}</small></span><em>${ST.s6all?'⌃':'›'}</em></button>`:'';
  const inbox=off?sec('Döntésre vár')+dsh('info','A társ jelenleg nincs bekapcsolva — a tényjavaslatok most nem elérhetők.'):
    items.length?sec('Döntésre vár',open?`${open} JELÖLT`:'MIND ELDÖNTVE')+`<div class="rows">${shown.map((x,i)=>inboxCard(x,i+2)).join('')}${more}</div>`:
    sec('Döntésre vár')+`<p class="m9-fn" style="padding-top:2px">Nincs döntésre váró javaslat.</p>`;
  const kirakat=off||empty?'':kirakat6();
  const doors=sec('Tovább')+`<div class="rows">${rowg('person','var(--rose)','A csapat képe rólad, dimenziónként','9 témakör · mindegyik pontosítható','#dimenziok')}${rowg('sun','var(--gold)','Életesemények','Új munkahely · Őszi alapozás — a nagy fordulatok','#eletesemenyek')}${rowg('chat','var(--lav)','Így beszélj velem','a saját kommunikációs kéréseid','Így beszélj velem — a beállításokban (Én II, kész)')}${rowg('graph','var(--lav)','Kapcsolatok','a tudásod térképe','#kategoriak')}</div>`;
  const note=`<p class="m9-fn" style="margin-top:8px">Minden, ami itt áll, forrással együtt él — bármit elhallgattathatsz vagy pontosíthatsz. A csapat csak azt használja, amit jóváhagytál.</p>`;
  return head+week+quote+inbox+kirakat+doors+note;
}
/* Életesemények — a Rólad ajtaja mögött (az eredeti oldalról kiemelt szakasz) */
function eletesemenyek6(){
  const le=ST.rinb.le1==='keep'?[`<span class="lifer"><u></u><span style="flex:1"><b>${ST.rt_le1||'Randizni kezdtél valakivel'}</b><small>most került be · tőled tudjuk</small></span><em>szept. 22.</em></span>`]:[];
  const se=ST.rinb.se1==='keep'?[`<span class="lifer"><u style="background:var(--sky);box-shadow:0 0 8px rgba(125,178,221,.6)"></u><span style="flex:1"><b>${ST.rt_se1||'Őszi alapozás'}</b><small>évszak · most került be</small></span><em>2026. IV. n.év</em></span>`]:[];
  return topbar()+dh('RÓLAD','Életesemények')+lede('A nagy fordulatok, amikhez a csapat igazodik — a mércék és a javaslatok ezekhez képest értelmeződnek.')+
  `<div class="rows"><div class="glass case rise" style="--c:var(--gold);--i:1;padding-top:8px">${[...le,...se,
    `<span class="lifer"><u></u><span style="flex:1"><b>Új munkahely első hete</b><small>hétfőn kezdtél · a naplódból, te hagytad jóvá</small></span><em>aug. 21.</em></span>`,
    `<span class="lifer" style="border-bottom:0"><u style="background:#8E86A3;box-shadow:none"></u><span style="flex:1"><b>Nyári alapozás</b><small>lezárult évszak — a nyári hetek külön mércével számítanak</small></span><em>2026. III. n.év</em></span>`].join('')}</div></div>`+
  `<p class="m9-fn">Új életesemény javaslatként érkezik a Rólad oldalra — ott döntesz róla.</p>`;
}

/* ── Tudástár: a raktár ajtói (Tények · Emberek · Észrevételek · Hatások · Kategóriák) ── */
function tudastar6(){
  const deg=ST.tud==='degraded';
  const doors=`<div class="rows">${deg?'':rowg('note','var(--sage)','Tények rólad','10 a chatben · 4 vár · 1 kikapcsolva','#tenyek','15')}${
    rowg('people','var(--rose)','Emberek','Anna · Márk · Lili — tények és hatások','#emberek','3')}${
    deg?'':rowg('tick','var(--gold)','Megerősített észrevételek','6 él · 1 újraellenőrzés fut · 1 megváltozott','#mintak','6')}${
    deg?'':rowg('chain','var(--sky)','Hatások','Mi jár együtt a hangulatoddal, energiáddal, alvásoddal','#hatasok','5')}${
    rowg('graph','var(--lav)','Kategóriák','Késői evés rontja az alvást · 12 él','#kategoriak','7')}</div>`;
  const n=INB.filter(x=>!ST.rinb[x.id]&&(!deg||x.life)).length;
  const ptr=`<div class="rows">${n?cse({c:'var(--gold)',s:'var(--gold)',st:'DÖNTÉSRE VÁR',ic:'bell',b:`${n} javaslat vár rád a Rólad oldalon`,sm:'Ott döntesz róluk: Igen, jegyezd meg · Pontosítom · Most ne · Nem igaz',go:'#rolad',i:1}):
    `<p class="m9-fn" style="padding-top:2px">Nincs döntésre váró javaslat. Ha a csapat újat hoz, a Rólad oldalon kérdez meg.</p>`}</div>`;
  const big=`<div class="m9-big rise"><b>29</b><small>megjegyzett dolog rólad és a világodról · mind forrással</small></div>`;
  if(deg)return topbar()+dh('RÓLAD','Tudástár',help)+dsh('info','A társ jelenleg nincs bekapcsolva — a tények és az észrevételek most nem elérhetők.')+ptr+sec('A tudás')+doors;
  return topbar()+dh('RÓLAD','Tudástár',help)+big+ptr+sec('A tudás')+doors;
}

/* ── Tények: forrás-chip + szerkesztés + törlés (visszavonással) + életciklus-szakaszok ── */
function frow6(f,st,key){
  if(ST.s6del[key])return '';
  const [l,ic,c]=CAT[f[0]];
  const txt=ST['s6t_'+key]||f[1];
  const srcIc=f[2].includes('mintából')?'pattern':f[2].includes('kézzel')?'pencil':'chat';
  const srcTo=f[2].includes('mintából')?'Forrás: az észrevétel oldala (Minták)':f[2].includes('kézzel')?'Forrás: kézzel vetted fel':'Forrás: a beszélgetés napja megnyílik';
  const ops=ST.s6edit===key?
    `<div class="m9-edit"><textarea rows="2" aria-label="A tény szövege">${txt}</textarea><span class="inboxa"><button class="chip glass main" style="--c:var(--sage)" data-s6save="${key}">${I('tick')}Így jegyezd meg</button><button class="chip glass" style="--c:#8E86A3" data-s6edit="">Mégse</button></span></div>`:
    `<span class="s6-ops"><button class="s6-src" data-toast="${srcTo}">${I(srcIc)}forrás ›</button><button class="s6-ico" data-s6edit="${key}" aria-label="Szerkesztés">${I('pencil')}</button><button class="s6-ico" data-s6del="${key}" data-s6txt="${txt}" aria-label="Törlés">${I('trash')}</button></span>`;
  return `<div class="trow ${st==='off'?'off':''} ${f[3]?'hl':''}">${I(ic)}<span class="ttx"><b style="font-weight:500">${txt}</b><small>${l.toLowerCase()} · ${f[2]}</small><small style="color:${st==='in'?'var(--sage)':'var(--faint)'};font-weight:600">${st==='in'?'Most benne van a chatben':st==='wait'?'Bekapcsolva, de most kimarad':'Kikapcsolva — a társ nem látja'}</small>${ops}</span><span class="m9-tgl ${st==='off'?'':'on'}" role="switch" aria-checked="${st!=='off'}"><i></i></span></div>`;
}
function tenyek6(){
  const undo=ST.s6undo?`<div class="s6-undo rise">${I('trash')}<b>Törölve: „${ST.s6undo[1]}”</b><button data-s6undo>Visszavonás</button></div>`:'';
  return topbar()+dh('TUDÁSTÁR','Tények',help)+tudBig()+undo+
  `<button class="search rise" data-toast="Keresés a tények között">${I('lens')}Keresés · pl. alvás, kávé, váll</button>`+
  `<div class="m9-filt" style="--c:var(--sage);padding-top:8px">${['Mind','Edzés','Étkezés','Egészség','Élet'].map((c,i)=>`<button class="${i?'':'on'}" data-toast="Szűrés: ${c}">${c}</button>`).join('')}</div>`+
  sec('Most ezeket kapja meg a társ','10')+`<div class="tlist rise">${FACTS.map((f,i)=>frow6(f,'in','f'+i)).join('')}</div>`+
  `<p class="m9-fn">Minden beszélgetés elején ezek a mondatok mennek elé: a 10 legerősebb bekapcsolt tény, plusz a frissen megerősített minták. A törlés mindenhonnan kiveszi — a forrásbejegyzésed megmarad.</p>`+
  `<div style="padding:0 16px"><button class="m9-fold" data-life="wait"><span>Bekapcsolva, de most kimarad · 4</span>${ST.waitOpen?'⌃':'⌄'}</button></div>${ST.waitOpen?`<div class="tlist" style="margin-top:8px">${frow6(['fuel','Hétvégén később kezdődik az első étkezés.','2× visszaigazolva · beszélgetésből'],'wait','w0')}${frow6(['train','A vállnyomásnál a bal oldal érzékenyebb.','1× visszaigazolva · beszélgetésből'],'wait','w1')}</div><p class="m9-fn">Ha megerősödnek, vagy egy erősebb tény kiesik, bekerülnek a chatbe.</p>`:''}`+
  `<div style="padding:0 16px"><button class="m9-fold" data-life="off"><span>Kikapcsolva · 1</span>${ST.offOpen?'⌃':'⌄'}</button></div>${ST.offOpen?`<div class="tlist" style="margin-top:8px">${frow6(['fuel','kifli.hu az elsődleges élelmiszer-forrás.','3× visszaigazolva · beszélgetésből'],'off','o0')}</div><p class="m9-fn">Megőrzöm őket, de a társ nem használja.</p>`:''}`+
  `<div style="padding:0 16px"><button class="m9-fold" data-s6fold="m"><span>Elnémítva cáfolat miatt · 1</span>${ST.s6m?'⌃':'⌄'}</button></div>${ST.s6m?`<div class="tlist" style="margin-top:8px"><div class="trow off">${I('shield')}<span class="ttx"><b style="font-weight:500">Hétvégén bepótolható az alváshiány.</b><small>egészség · ${fchip('ELNÉMÍTVA','#8E86A3')} cáfoltad szept. 12-én</small><span class="s6-ops"><button class="s6-src" data-toast="Forrás: a cáfolt észrevétel oldala">${I('pattern')}a cáfolt észrevétel ›</button></span></span></div></div><p class="m9-fn">Nem törlöm — de a társ soha többé nem használja, és magától nem tér vissza.</p>`:''}`+
  `<div style="padding:0 16px"><button class="m9-fold" data-s6fold="h"><span>Korábban igaz volt · 1</span>${ST.s6h?'⌃':'⌄'}</button></div>${ST.s6h?`<div class="tlist" style="margin-top:8px"><div class="trow off">${I('history')}<span class="ttx"><b style="font-weight:500" class="s6-old">Koffein 15:00-ig még belefér.</b><small>étkezés · ${fchip('KORÁBBAN IGAZ VOLT','var(--gold)')}</small><small>Leváltotta: „Koffein 14:00 után már nem” · szept. 26.</small></span></div></div><p class="m9-fn">Amikor megerősíted, hogy valami megváltozott, a régi mondat ide kerül — látható marad, de nem él.</p>`:''}`;
}

/* ── Emberek: összkép, a kezelés a személy oldalán ── */
const S6P=[['Anna',5,2,'kedd esti röpi után gyakran együtt vacsoráztok'],['Márk',3,1,'a késői munkanapok hozzá kötődnek'],['Lili',1,0,'most került be: költözés előtt áll']];
function emberek6(){
  return topbar()+dh('TUDÁSTÁR','Emberek',help)+
  lede('Amit a társ az embereidről megjegyzett — az összkép. A részletes kezelés (szerkesztés, némítás, törlés) a személy saját oldalán él.')+
  `<div class="tlist rise">${S6P.map(p=>`<button class="trow tlink" data-toast="${p[0]} oldala — az Emberek területen (kész, S3)">${I('person')}<span class="ttx"><b>${p[0]}</b><small>${p[1]} tény${p[2]?` · ${p[2]} hatás`:''} · ${p[3]}</small></span><span class="chev" style="color:var(--faint)">›</span></button>`).join('')}</div>`+
  `<p class="m9-fn">Új személy-tény mindig „Megjegyeztem…” chippel érkezik a beszélgetésben — ott azonnal vissza is vonhatod, vagy szólhatsz: „ezt ne jegyezd meg”.</p>`;
}

/* ── Hatások: a teljes lista (S4 kánon: erősség és bizonyosság külön, sosem ok-okozat) ── */
function hatasok6(){
  const dots=(n,ring)=>`<span class="effdots${ring?' ring':''}">${[1,2,3].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span>`;
  const row=(sent,st,stLb,cf,cfLb,n)=>`<div class="effrow"><p class="effsent">${sent}</p><div class="effmeta"><span class="effsig"><small>EGYÜTTJÁRÁS</small>${dots(st)}<em>${stLb}</em></span><span class="effsig"><small>BIZONYOSSÁG</small>${dots(cf,true)}<em>${cfLb}</em></span><em class="effn">${n}</em></div></div>`;
  return topbar()+dh('TUDÁSTÁR','Hatások',help)+
  lede('Együttjárások a napjaid és az emberek, események között. Az erősség és a bizonyosság két külön jelzés — és ez sosem ok-okozat.')+
  sec('Emberek','2')+`<div class="rows"><div class="case glass rise" style="--c:var(--rose);--i:1;padding-top:6px">${
    row('Úgy tűnik, azokon a napokon, amikor Anna szóba kerül, jobb a hangulatod.',3,'erős',2,'közepes','14 nap alapján')+
    row('Úgy tűnik, azokon a napokon, amikor Márk szóba kerül, több a stressz.',1,'enyhe',1,'gyenge','6 nap alapján')
  }<p class="efffoot">Együttjárás, nem ok-okozat.</p></div></div>`+
  sec('Eseménytípusok','3')+`<div class="rows"><div class="case glass rise" style="--c:var(--sky);--i:2;padding-top:6px">${
    row('Úgy tűnik, röplabda-napokon este hamarabb elalszol.',3,'erős',3,'erős','18 nap alapján')+
    row('Úgy tűnik, a késői munkanapok után felszínesebb az alvásod.',2,'közepes',2,'közepes','9 nap alapján')+
    row('Úgy tűnik, randi-napokon estére kevesebb az energiád — de jobb a hangulatod.',2,'közepes',1,'gyenge','5 nap alapján')
  }<p class="efffoot">Együttjárás, nem ok-okozat.</p></div></div>`+
  `<p class="m9-fn">Ahol kevés a közös nap, a sor meg sem jelenik — nem találgatunk. Egy-egy hatás a személy oldalán és az esti csapatfal-kiadásban is felbukkanhat, mindig óvatos megfogalmazásban.</p>`;
}

/* ── Minták · „megerősítve” vödör: életciklus-jelvények (S2 hozadék) ── */
function bucket6(){
  if(ST.bucket!=='confirmed')return bucket();
  const R=[
    ['moon','Magas sportterhelés → mélyebb alvás','12 közös nap','ÉRVÉNYES','var(--sage)',''],
    ['water','Vízbevitel → délutáni energia','8 közös nap','ÉRVÉNYES','var(--sage)',''],
    ['journal','Hála-napló → nyugodtabb nap','11 közös nap','ÉRVÉNYES','var(--sage)',''],
    ['plate','Késői étkezés → felszínes alvás','14 közös nap','ÚJRAELLENŐRZÉS FUT','var(--lav)','Negyedévente visszamérjük, tartja-e még magát — ha nem, megkérdezünk.'],
    ['kettle','Koffein 15:00-ig még belefér','','KORÁBBAN IGAZ VOLT','var(--gold)','Megerősítetted, hogy megváltozott — a helyére a „14:00 után már nem” lépett.'],
    ['moon','Hétvégi pótalvás rendbe teszi a hetet','','ELNÉMÍTVA','#8E86A3','Cáfoltad — nem kerül többé elő, és a belőle lett tény is elnémult.']];
  return sec('Megerősítve — él a tudásban','6')+`<div class="tlist rise">${R.map(r=>`<div class="trow ${r[3]==='ÉRVÉNYES'||r[3]==='ÚJRAELLENŐRZÉS FUT'?'':'off'}">${I(r[0])}<span class="ttx"><b style="font-weight:500" ${r[3]==='KORÁBBAN IGAZ VOLT'?'class="s6-old"':''}>${r[1]}</b><small>${r[2]?r[2]+' · ':''}${fchip(r[3],r[4])}</small>${r[5]?`<small>${r[5]}</small>`:''}</span></div>`).join('')}</div>`+
  `<p class="m9-fn">Az érvényesek ott vannak a társ fejében minden beszélgetésnél. Ami megváltozott vagy elnémult, látható marad — de nem él.</p>`;
}
function mintak6(){
  const ackT={confirm:'Beépítettem a tudásba — mostantól számolok vele.',monitor:'Rendben, figyeljük tovább — szólok, ha erősödik.',reject:'Elvetve — nem hozom fel újra.'};
  return topbar()+dh('MEZO · A MOTOR','Minták')+`<div class="m9-big rise"><b>6</b><small>megerősített összefüggés él a tudásban</small></div>`+
  `<div class="rows"><div class="case glass rise" style="--c:var(--gold);--s:var(--lav);--i:1"><span class="crow"><span class="st">A MOTOR ÁLLAPOTA</span><em>ma 14:12 · 60 nap</em></span>
    <p class="pbody" style="--c:var(--gold)"><b>21 kérdést</b> figyelek a naplóidból. <b>6 megerősített</b> összefüggés dolgozik a társban, <b>2 vár a döntésedre</b>.</p>
    <div class="m9-lgrid">${BK.map(k=>`<button class="${k[0]==='decide'?'hot':''} ${ST.bucket===k[0]?'sel':''}" style="--c:${k[4]}" data-st="bucket:${k[0]}" aria-pressed="${ST.bucket===k[0]}"><b>${k[3]}</b><small>${I(k[2])}${k[1]}</small></button>`).join('')}</div>
    <div class="m9-tool"><span>Minden téma</span><button data-msheet9="filter">${I('gear')}Szűrés</button></div></div></div>`+
  (ST.ack?`<div style="padding:10px 16px 0"><span class="after big">${I('tick')}${ackT[ST.ack]}</span></div>`:'')+
  bucket6()+`<div class="m9-pager"><button aria-label="Előző oldal" data-toast="Előző oldal">‹</button>1–4 / 6<button aria-label="Következő oldal" data-toast="Következő oldal">›</button></div>`+
  sec('Adat-egészség')+`<div class="m9-cov">${[['Hangulat',12,'var(--coral)','7/60 · 3 napja'],['Vízbevitel',40,'var(--gold)','24/60 · ma'],['Alvás',97,'var(--sage)','58/60 · ma'],['Edzés',88,'var(--sage)','53/60 · tegnap'],['Étkezés',93,'var(--sage)','56/60 · ma']].map(c=>`<div class="rgauge" style="--c:${c[2]}">${ring(c[1],c[2],28,64)}<b>${c[1]}</b><small>${c[0].toUpperCase()}<br>${c[3]}</small></div>`).join('')}</div>`+
  `<a class="m9-flink" href="#memoria">A motor bemenete: memória-rétegek →</a>`;
}

/* ── regisztráció + kattintások ── */
Object.assign(U9V,{rolad:rolad6,tudastar:tudastar6,tenyek:tenyek6,mintak:mintak6,emberek:emberek6,hatasok:hatasok6,eletesemenyek:eletesemenyek6});
TABS.rolad.push('emberek','hatasok','eletesemenyek');
document.addEventListener('click',e=>{
  const t=e.target;
  const fo=t.closest('[data-s6fold]'); if(fo){ST['s6'+fo.dataset.s6fold]=!ST['s6'+fo.dataset.s6fold];soft();return}
  const sv=t.closest('[data-s6save]'); if(sv){const k=sv.dataset.s6save;const ta=sv.closest('.m9-edit').querySelector('textarea');ST['s6t_'+k]=ta.value;ST.s6edit='';soft();toast('Átírva — a forrása megmarad');return}
  const ed=t.closest('[data-s6edit]'); if(ed){ST.s6edit=ed.dataset.s6edit;soft();return}
  const dl=t.closest('[data-s6del]'); if(dl){const k=dl.dataset.s6del;ST.s6del[k]=1;ST.s6undo=[k,dl.dataset.s6txt||'a tény'];ST.s6edit='';soft();return}
  if(t.closest('[data-s6undo]')){if(ST.s6undo)delete ST.s6del[ST.s6undo[0]];ST.s6undo=null;soft();toast('Visszavontad — a tény újra él');return}
});

render();
