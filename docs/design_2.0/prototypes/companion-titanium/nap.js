import { createDay, addWater, saveCheckin, toggleHabit } from './nap-state.js';
const $ = s => document.querySelector(s);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const safe = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let day = createDay(), part = 'nap', sheetType = '', checkinSlot = 'nap', toastTimer, reactionTimer, motionPaused = false;
const parts = {
  reggel: { name:'Reggel', clock:'07:45', icon:'sun', greeting:'Jó reggelt, Dani.', message:'Kipihentebben indul a napod. Adjunk neki egy irányt, a többi jön lépésenként.' },
  nap: { name:'Napközben', clock:'14:20', icon:'sun', greeting:'Jó itt folytatni, Dani.', message:'A délelőtt mögötted. Most egy kis figyelem magadra, aztán mehetünk tovább.' },
  este: { name:'Este', clock:'21:45', icon:'moon', greeting:'Megérkeztél, Dani.', message:'Ami ma belefért, az már a tiéd. A többit nyugodtan letehetjük holnapig.' },
};
const needs = () => [ ['Energia',72,'#d5bb8b'], ['Víz',Math.min(100,Math.round(day.water/2000*100)),'#87cddd'], ['Pihenés',84,'#aaa0de'], ['Mozgás',62,'#bfd787'], ['Lélek',day.checkins[part] ? day.checkins[part].mind*10 : 68,'#ce9cad'], ['Rend',Math.round(day.habits.filter(h=>h.done).length/day.habits.length*100),'#b5a7d7'] ];
function react(mode='connect', duration=5000) { clearTimeout(reactionTimer); $('#companion').contentWindow?.postMessage({type:'mezo:mode',mode},location.origin); reactionTimer=setTimeout(()=>$('#companion').contentWindow?.postMessage({type:'mezo:mode',mode:'listen'},location.origin),duration); }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').classList.add('visible'); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200); }
function tile({label,value,unit='',hint,art,color,open,fill='',water=false}) {
  return `<button class="tile tile-enter" style="--tile-color:${color};--fill:${fill}" ${water?'data-water':'data-open="'+open+'"'}><span class="tile-label">${label}</span><span class="tile-art">${icon(art)}</span><span class="tile-value">${value}<small>${unit}</small></span><span class="tile-hint">${hint}</span><span class="tile-button">${water?'+':'↗'}</span>${fill?'<span class="tile-track"><i></i></span>':''}</button>`;
}
function render(replay=false) {
  const cfg=parts[part], done=day.habits.filter(h=>h.done).length;
  $('.device').classList.toggle('evening',part==='este'); $('.device').classList.toggle('morning',part==='reggel');
  $('#part-label').textContent=cfg.name; $('#day-switch .icon use').setAttribute('href',`#i-${cfg.icon}`); $('#demo-clock').textContent=cfg.clock;
  $('#greeting').textContent=cfg.greeting; $('#hero-message').textContent=cfg.message;
  document.querySelectorAll('[data-daypart]').forEach(el=>{el.classList.toggle('selected',el.dataset.daypart===part);el.setAttribute('aria-pressed',String(el.dataset.daypart===part));});
  let next;
  if(part==='reggel') next=['Induljunk könnyedén.','Pár perc reggeli fény még belefér.','Folytatom a rutinom','sun','routine'];
  else if(part==='este') next=day.closed?['A mai nap a helyén.','Most már jöhet a pihenés.','Megnézem a napom','moon','ritual']:['Tegyük le a napot.','23:15 · a tervezett lefekvésed','Zárjuk le együtt','moon','ritual'];
  else if(day.checkins.nap) next=['Egy kis feltöltődés.','Az edzésig még van időd magadra.','A mai étkezéseim','bowl','fuel'];
  else next=['Hogy vagy most?','Egy rövid check-in. Magadért.','Ránézek magamra','heart','checkin'];
  $('#next-title').textContent=next[0];$('#next-hint').textContent=next[1];$('#next-action').innerHTML=`${next[2]} <b>↗</b>`;$('#next-art').innerHTML=icon(next[3]);$('#next-card').dataset.open=next[4];
  const items={
    water:{label:'Hidratáció',value:(day.water/1000).toLocaleString('hu-HU',{maximumFractionDigits:2}),unit:'liter',hint:'+250 ml · egy érintés',art:'water',color:'#8ed2e8',fill:`${Math.min(100,day.water/20)}%`,water:true},
    train:{label:'Mozgás · 17:00',value:'Felsőtest A',hint:'3 gyakorlat · 9 sorozat',art:'dumbbell',color:'#c6df9d',open:'train'},
    fuel:{label:'Táplálkozás',value:'1 180',unit:'kcal',hint:'Eddig ma · 86 g fehérje',art:'bowl',color:'#b8ce91',open:'fuel'},
    quests:{label:'Küldetések',value:day.waterRewarded?'2 / 3':'1 / 3',hint:day.waterRewarded?'Ma is haladsz':'A saját tempódban',art:'gem',color:'#c4a9ea',open:'quests',fill:day.waterRewarded?'66%':'33%'},
    routine:{label:part==='este'?'Esti rutin':'A rutinod',value:`${done} / 4`,hint:'Apró lépésekből lesz ritmus',art:'ring',color:'#c6acd9',open:'routine',fill:`${done*25}%`},
    stack:{label:'Stack · következő',value:'Vacsorával',hint:'Magnézium · a terved szerint',art:'stack',color:'#9ebdd7',open:'stack'},
    sleep:{label:'Az éjszakád',value:'7',unit:'óra 42 perc',hint:'Minőség · 8 / 10',art:'moon',color:'#b8a8e5',open:'sleep'},
    checkin:{label:'Check-in',value:`${Object.keys(day.checkins).length} / 4`,hint:day.checkins[part]?'Visszanézhetsz magadra':'Hogy vagy most?',art:'heart',color:'#d0a5c4',open:'checkin'},
    journal:{label:'Napló',value:day.journal.length?'Megérkezett':'Egy gondolat',hint:day.journal.length?`${day.journal.length} bejegyzés ma`:'Ami most benned van',art:'book',color:'#c1a7e3',open:'journal'},
  };
  const list=part==='reggel'?['sleep','routine','quests','checkin']:part==='este'?['routine','journal','quests','checkin']:['water','train','fuel','quests','routine','stack'];
  $('#tiles').innerHTML=list.map(key=>tile(items[key])).join('');
  if(!replay) $('#tiles').querySelectorAll('.tile-enter').forEach(el=>el.classList.remove('tile-enter'));
  $('#need-bars').innerHTML=needs().map(([name,n,color])=>`<span class="need" style="--need-color:${color};--fill:${n}%"><span class="need-track"><i></i></span><small>${name}</small></span>`).join('');
  $('#intention-text').textContent=day.intention;$('#xp-label').textContent=day.xp;$('#xp-bar').style.width=`${day.xp/1200*100}%`;
}
function setPart(next) { part=next;render(true);react('listen');$('#app-scroll').scrollTo({top:0,behavior:'smooth'}); }
function logWater() { const earned=addWater(day);render();const water=$('[data-water]');if(water){water.classList.remove('ripple');void water.offsetWidth;water.classList.add('ripple');}toast(earned?'+250 ml · Víz-küldetés teljesítve · +25 XP':`+250 ml · ${(day.water/1000).toLocaleString('hu-HU')} liter ma`); if(earned)react('celebrate',4500);else react('connect',2200); }
const title=(art,heading,sub='')=>`<div class="sheet-art">${icon(art)}</div><h2 class="sheet-title">${heading}</h2>${sub?`<p class="sheet-sub">${sub}</p>`:''}`;
function openSheet(type) {
  if(type==='checkin' && sheetType!=='checkin') checkinSlot=part;
  sheetType=type;$('#sheet-label').textContent=type==='quick'?'EGY APRÓ LÉPÉS':'MEZO · '+parts[part].name.toUpperCase();
  let html='';
  if(type==='quick') html=title('bolt','Mi érkezett?','Egy pillanat. Máris a napod része.')+`<div class="choice-grid"><button class="sheet-row" data-water-close>${icon('water')}<strong>+250 ml víz</strong></button><button class="sheet-row" data-open="checkin">${icon('heart')}<strong>Check-in</strong></button><button class="sheet-row" data-open="journal">${icon('book')}<strong>Egy gondolat</strong></button><button class="sheet-row" data-open="intention">${icon('sun')}<strong>Napi szándék</strong></button></div>`;
  if(type==='checkin') {
    const values=day.checkins[checkinSlot]||{energy:6,stress:4,body:7,mind:6};
    html=title('heart','Hogy vagy most?','Nincs jó vagy rossz válasz. Csak egy pillanatkép rólad.')+`<div class="slot-picker" aria-label="Check-in időpontja">${[["reggel","Reggel"],["nap","Délben"],["delutan","Délután"],["este","Este"]].map(([key,label])=>`<button data-slot="${key}" aria-pressed="${key===checkinSlot}">${label}${day.checkins[key]?" ✓":""}</button>`).join('')}</div><form id="checkin-form">${[['energy','Energia'],['stress','Stressz'],['body','Testi jóllét'],['mind','Mentális jóllét']].map(([key,label])=>`<label class="form-field"><span>${label}<output id="out-${key}">${values[key]} / 10</output></span><input aria-label="${label}" name="${key}" type="range" min="1" max="10" value="${values[key]}" data-measure="${key}"></label>`).join('')}<button class="sheet-action" type="submit">${day.checkins[checkinSlot]?'Pontosítom':'Így vagyok most'}</button></form><p class="quiet">${Object.keys(day.checkins).length} / 4 mai pillanat rögzítve. A kimaradt check-in pótolható.</p>`;
  }
  if(type==='routine') html=title('ring',part==='este'?'Lassan elengedheted.':'Lépésről lépésre.','A rutinod megtart. Egy kimaradt lépés után is folytathatod.')+day.habits.map(h=>`<${h.derived?'div':'button'} class="sheet-row ${h.done?'done':''}" ${h.derived?'':`data-habit="${h.id}" aria-pressed="${h.done}"`}><span>${icon(h.id==='sleep'?'moon':h.id==='sun'?'sun':h.id==='intention'?'gem':'ring')}</span><span><strong>${h.name}</strong><small>${h.hint}</small></span><span class="row-end">${h.done?'✓':'○'}</span></${h.derived?'div':'button'}>`).join('')+`<p class="quiet">Az alvás és a napi szándék a naplózott adataidból teljesül.</p>`;
  if(type==='quests') html=title('gem','Ma ennyi is számít.','Három lehetőség a napodban. A teljesítés a naplózásodból látszik.')+`<div class="sheet-row done">${icon('sun')}<span><strong>Adj irányt a napnak</strong><small>Napi szándék · teljesítve</small></span><span class="row-end">✓</span></div><button class="sheet-row ${day.waterRewarded?'done':''}" data-water>${icon('water')}<span><strong>Egy kis figyelem a vízre</strong><small>${day.water} / 2 000 ml · +25 XP</small></span><span class="row-end">${day.waterRewarded?'✓':'+250'}</span></button><button class="sheet-row" data-open="train">${icon('dumbbell')}<span><strong>Mozdulj magadért</strong><small>A mai edzésedből teljesül</small></span><span class="row-end">↗</span></button>`;
  if(type==='needs') html=title('heart','Így vagy most.','Hat életjel, egy közös nap. Jelzések arra, mire érdemes figyelned.')+needs().map(([name,n,color])=>`<div class="need-detail" style="--need-color:${color};--fill:${n}%"><strong>${name}</strong><span class="bar"><i></i></span><small>${n}%</small></div>`).join('')+`<button class="sheet-action" data-water-close>Iszom egy pohár vizet · +250 ml</button>`;
  if(type==='journal') html=title('book','Ami most benned van.','Lehet egy mondat. Lehet több. Itt helye van.')+`<form id="journal-form"><label class="form-field">A gondolatod<textarea name="text" maxlength="4000" placeholder="Most az jár a fejemben…" required></textarea></label><button class="sheet-action" type="submit">Leteszem ide</button></form>${day.journal.map(text=>`<div class="note-card">${safe(text)}</div>`).join('')}`;
  if(type==='intention') html=title('sun','Merre szeretnél menni?','Egy mondat, amihez ma visszatalálhatsz.')+`<form id="intention-form"><label class="form-field">A mai irányod<input type="text" name="text" maxlength="160" value="${safe(day.intention)}" required></label><button class="sheet-action" type="submit">Ez legyen ma az irány</button></form>`;
  if(type==='messages') html=title('chat','Együtt a napban.','Mezo · a mai üzeneteid')+`<div class="chat-bubble"><span class="chat-time">07:45 · REGGEL</span>Jó reggelt, Dani. A 7 óra 42 perc alvás után ma van miből indulnod. Mit szeretnél magaddal vinni ebből a reggelből?</div><div class="chat-bubble"><span class="chat-time">14:20 · NAPKÖZBEN</span>${safe(parts[part].message)}</div><button class="sheet-action" data-open="journal">Elmesélek valamit</button>`;
  if(type==='train') html=title('dumbbell','Felsőtest A.','17:00 · 3. hét / 6 · erőt építünk')+`<div class="chat-bubble">Ma a fekvenyomásnál +2,5 kg a terv. Maradjon két ismétlés tartalékban.</div>${[['Fekvenyomás','3 × 10 · 60 kg'],['Evezés csigán','3 × 12 · 45 kg'],['Vállból nyomás','3 × 10 · 20 kg']].map(([a,b])=>`<div class="sheet-row">${icon('dumbbell')}<span><strong>${a}</strong><small>${b}</small></span></div>`).join('')}<p class="quiet">A mai tervben a fokozatos építkezésé a főszerep.</p>`;
  if(type==='fuel') html=title('bowl','Van miből építkezned.','1 180 kcal · 86 g fehérje eddig ma')+`<div class="sheet-row done">${icon('bowl')}<span><strong>Reggeli · 08:00</strong><small>Zabkása gyümölccsel · 420 kcal</small></span><span class="row-end">✓</span></div><div class="sheet-row done">${icon('bowl')}<span><strong>Ebéd · 12:30</strong><small>Csirkés rizstál · 760 kcal</small></span><span class="row-end">✓</span></div><div class="sheet-row">${icon('bowl')}<span><strong>Uzsonna · 15:30</strong><small>A következő étkezési ablakod</small></span></div><button class="sheet-action" data-water-close>Most egy pohár víz · +250 ml</button>`;
  if(type==='stack') html=title('stack','A napodhoz igazítva.','A beállított terved következő elemei.')+`<div class="sheet-row">${icon('stack')}<span><strong>Magnézium</strong><small>Vacsorával · a saját protokollod szerint</small></span></div><p class="quiet">A saját protokollod igazodik az étkezéseid ritmusához.</p>`;
  if(type==='sleep') html=title('moon','Volt időd feltöltődni.','A tegnap éjszakád')+`<div class="reward-number">7 óra 42 perc</div><div class="sheet-row"><span><strong>Alvásminőség</strong><small>A reggeli visszajelzésed</small></span><span class="row-end">8 / 10</span></div><div class="sheet-row"><span><strong>Mai lefekvési cél</strong><small>Innen indul az esti lecsendesedés</small></span><span class="row-end">23:15</span></div>`;
  if(type==='profile') html=title('gem','Alakulsz, Dani.','A fejlődésed nyomai. A saját tempódban.')+`<div class="reward-number">12. szint</div><div class="sheet-row">${icon('gem')}<span><strong>${day.xp} / 1 200 XP</strong><small>A következő szint felé</small></span></div><div class="sheet-row">${icon('sun')}<span><strong>${day.coins.toLocaleString('hu-HU')} érme</strong><small>A már megszerzett egyenleged</small></span></div><button class="sheet-action" data-open="journal">A mai gondolataim</button>`;
  if(type==='ritual') html=title('moon',day.closed?'A mai nap megérkezett.':'Tegyük a helyére a napot.',day.closed?'A többi ráér holnapig. Jó pihenést.':'Nem kell mindent befejezni ahhoz, hogy lezárhasd.')+`<div class="note-card">${safe(day.intention)}</div><div class="sheet-row">${icon('water')}<span><strong>${(day.water/1000).toLocaleString('hu-HU')} liter víz</strong><small>Ma ennyit figyeltél a hidratációra</small></span></div><div class="sheet-row">${icon('heart')}<span><strong>${Object.keys(day.checkins).length} check-in</strong><small>Visszanéztél magadra</small></span></div>${day.closed?'':`<form id="ritual-form"><label class="form-field">Mit vinnél magaddal a mai napból?<textarea name="text" maxlength="4000" placeholder="Egy pillanat, ami számított…"></textarea></label><button class="sheet-action" type="submit">Mára elég. Lezárom.</button></form>`}`;
  $('#sheet-body').innerHTML=html;
  if(!$('#sheet').open)$('#sheet').showModal();
  $('#sheet').scrollTop=0;
}
function closeSheet(){ $('#sheet').close();sheetType=''; }
document.addEventListener('click',e=>{
  const slot=e.target.closest('[data-slot]');if(slot){checkinSlot=slot.dataset.slot;openSheet('checkin');return;}
  const dp=e.target.closest('[data-daypart]');if(dp){setPart(dp.dataset.daypart);return;}
  const water=e.target.closest('[data-water],[data-water-close]');if(water){const close=water.hasAttribute('data-water-close');logWater();if(close)closeSheet();else if($('#sheet').open&&sheetType==='quests')openSheet('quests');return;}
  const habit=e.target.closest('[data-habit]');if(habit){toggleHabit(day,habit.dataset.habit);render();openSheet('routine');react('connect',2000);return;}
  const opener=e.target.closest('[data-open]');if(opener){openSheet(opener.dataset.open);if(opener.dataset.open==='messages')react();}
});
document.addEventListener('input',e=>{if(e.target.dataset.measure)$(`#out-${e.target.dataset.measure}`).value=`${e.target.value} / 10`;});
document.addEventListener('submit',e=>{
  const form=e.target;if(!['checkin-form','journal-form','intention-form','ritual-form'].includes(form.id))return;e.preventDefault();const data=new FormData(form);
  if(form.id==='checkin-form'){saveCheckin(day,checkinSlot,Object.fromEntries(['energy','stress','body','mind'].map(k=>[k,Number(data.get(k))])));toast('Megérkezett a check-in. Most már ezt is tudjuk.');}
  else {const text=String(data.get('text')||'').trim();if(form.id!=='ritual-form'&&!text){form.querySelector('[name=text]').focus();return;}
    if(form.id==='intention-form'){day.intention=text;toast('Megvan a mai irányod.');}
    if(form.id==='journal-form'){day.journal.push(text);toast('A gondolatod megérkezett.');}
    if(form.id==='ritual-form'){day.closed=true;if(text)day.journal.push(text);toast('A mai nap a helyén. Jó pihenést.');}
  }closeSheet();render();react('connect',4500);
});
$('#quick-add').addEventListener('click',()=>openSheet('quick'));
$('#close-sheet').addEventListener('click',closeSheet);
$('#sheet').addEventListener('click',e=>{if(e.target===$('#sheet')){const r=$('#sheet').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet();}});
$('#day-switch').addEventListener('click',()=>setPart(({reggel:'nap',nap:'este',este:'reggel'})[part]));
$('#home').addEventListener('click',()=>$('#app-scroll').scrollTo({top:0,behavior:'smooth'}));
$('#restart').addEventListener('click',()=>{day=createDay();setPart('nap');toast('Újra a mintanap elején.');});
$('#motion-toggle').addEventListener('click',()=>{motionPaused=!motionPaused;$('#motion-toggle').setAttribute('aria-pressed',String(motionPaused));$('#motion-toggle').setAttribute('aria-label',motionPaused?'Társ mozgásának folytatása':'Társ mozgásának szüneteltetése');$('#motion-toggle').textContent=motionPaused?'▷':'Ⅱ';$('#companion').contentWindow?.postMessage({type:'mezo:pause',paused:motionPaused},location.origin);});
$('#companion').addEventListener('load',()=>{motionPaused=matchMedia('(prefers-reduced-motion: reduce)').matches;$('#motion-toggle').setAttribute('aria-pressed',String(motionPaused));$('#motion-toggle').textContent=motionPaused?'▷':'Ⅱ';$('#motion-toggle').setAttribute('aria-label',motionPaused?'Társ mozgásának folytatása':'Társ mozgásának szüneteltetése');});
render(true);
