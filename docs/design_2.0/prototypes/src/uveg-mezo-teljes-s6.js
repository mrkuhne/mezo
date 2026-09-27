
/* ═════════ S6c · RÓLAD RÖVID ELOSZTÓ (mezo-d6ivw.6 utómunka, owner 2026-09-27) ═════════
   A leszállított Tudástár-hub (uveg-tudastar-hub.html, /mezo/knowledge) a raktár — ez a
   réteg csak a Rólad oldalt alakítja rövid elosztóvá: benyomás + döntésre vár (max 2, a
   többi lenyitható) + a hub négy szakasz-csempéje (kirakat) + ajtók. Az életesemények
   saját oldalt kaptak. A kirakat csempéi a hub-prototípus lapjaira visznek át. */

Object.assign(ST,{s6all:false});

const S6HUB='uveg-tudastar-hub.html#';
function kirakat6(){
  const K=[['person','var(--rose)','90','Tények rólad','83 bekapcsolva · 7 elhallgattatva','tenyek'],
    ['people','var(--lav)','70','Emberek','18 ember · 3 elhallgattatva','emberek'],
    ['pattern','var(--gold)','30','Észrevételek','26 még igaz · 1 felülírva','eszrevetelek'],
    ['cowave','var(--sky)','12','Hatások','7 ember · 4 esemény','hatasok']];
  return sec('Amit a csapat megjegyzett','A TUDÁSTÁRBAN')+
  `<div class="iko">${K.map((k,i)=>`<a class="qt glass lift rise" style="--c:${k[1]};--i:${i}" href="${S6HUB}${k[5]}"><span class="n">${k[2]}</span>${I(k[0])}<b>${k[3]}</b><small>${k[4]}</small></a>`).join('')}</div>`;
}
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

/* ── regisztráció + kattintások ── */
Object.assign(U9V,{rolad:rolad6,eletesemenyek:eletesemenyek6});
TABS.rolad.push('eletesemenyek');
document.addEventListener('click',e=>{
  const fo=e.target.closest('[data-s6fold]'); if(fo){ST['s6'+fo.dataset.s6fold]=!ST['s6'+fo.dataset.s6fold];soft();return}
});

render();
