import { fuelOverview, mealInfo, mealRecord } from './food.js';
import { mealBlocks, blockFor, minutesOf, mealFacts } from './food-state.js';
import { icon, safe } from './nap.js';

const fmt=value=>Math.round(value).toLocaleString('hu-HU');
const fmt1=v=>v==null?'—':Number(v).toLocaleString('hu-HU',{maximumFractionDigits:1});
const score1=v=>Number(v).toLocaleString('hu-HU',{minimumFractionDigits:1,maximumFractionDigits:1});
const ring=(name,art,value,target,color,unit='g')=>`<div class="macro-cell"><span class="macro-ico">${icon(art)}</span><div class="fuel-ring" style="--macro-color:${color};--ring-progress:${Math.min(100,value/target*100)}"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="fuel-ring-track" cx="40" cy="40" r="34" pathLength="100"/><circle class="fuel-ring-progress" cx="40" cy="40" r="34" pathLength="100"/></svg><span aria-label="${name}: ${fmt1(value)} / ${fmt1(target)} ${unit}"><strong data-fuel-count="${value}" data-fuel-dec="${unit==='l'?1:0}">0</strong><b>/ ${fmt1(target)}<i>${unit}</i></b></span></div></div>`;

export function animateFuelDashboard(root=document){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 root.querySelectorAll('[data-fuel-count]').forEach(element=>{
  const target=Number(element.dataset.fuelCount),dec=Number(element.dataset.fuelDec||0);
  const show=v=>Number(v).toLocaleString('hu-HU',{minimumFractionDigits:dec,maximumFractionDigits:dec});
  if(reduce||!Number.isFinite(target)){element.textContent=show(target||0);return;}
  const started=performance.now(),duration=950;
  const frame=now=>{const progress=Math.min(1,(now-started)/duration),eased=1-(1-progress)**3;element.textContent=show(target*eased);if(progress<1&&element.isConnected)requestAnimationFrame(frame);};
  requestAnimationFrame(frame);
 });
}

const scoreChip=m=>m.score==null?`<span class="score-chip pending">${icon('score')}<b>folyamatban</b></span>`:`<button class="score-chip" data-score="${m.id}" aria-label="AI-értékelés: ${score1(m.score)}">${icon('score')}<b>${score1(m.score)}</b></button>`;
// Row kcal intentionally omitted: the block ring already carries the number (owner 2026-09-11).
const mealRow=m=>`<div class="block-meal"><button class="block-meal-main" data-meal-open="${m.id}"><span class="block-meal-copy"><strong>${safe(m.name)}</strong></span></button>${scoreChip(m)}</div>`;

// 5-hour window bar: the optimal range highlighted inside the box, one marker per logged meal.
function windowBar(block,rows){
 const [boxFrom,boxTo]=block.box.map(minutesOf),span=boxTo-boxFrom;
 const pct=t=>Math.min(98,Math.max(2,(minutesOf(t)-boxFrom)/span*100));
 const [optFrom,optTo]=block.optimal;
 return `<div class="block-window" role="img" aria-label="${block.label}-ablak ${block.box[0]}–${block.box[1]}, optimális ${optFrom}–${optTo}"><span>${block.box[0]}</span><i><em style="--from:${pct(optFrom)}%;--to:${pct(optTo)}%"></em>${rows.map(m=>`<b style="--at:${pct(m.time)}%" title="${m.time}"></b>`).join('')}</i><span>${block.box[1]}</span></div>`;
}

const budgetRing=(logged,budget)=>{const pct=Math.min(100,Math.round(logged/budget*100));return `<span class="budget-ring ${logged?'':'empty'}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="br-track" cx="22" cy="22" r="18" pathLength="100"/><circle class="br-fill" cx="22" cy="22" r="18" pathLength="100" style="--p:${pct}"/></svg><b>${logged?fmt(logged):fmt(budget)}</b></span>`;};
function blockCard(block,rows,current,budgetMode='head'){
 const logged=rows.reduce((s,m)=>s+m.kcal,0);
 let headRight='',afterWindow='';
 if(budgetMode==='head')headRight=rows.length?`<span class="block-sum">${fmt(logged)} <small>/ ${fmt(block.budget)} kcal</small></span>`:`<span class="block-sum quiet">kb. ${fmt(block.budget)} kcal</span>`;
 else if(budgetMode==='bar'){headRight=rows.length?`<span class="block-sum">${fmt(logged)} kcal</span>`:'';afterWindow=`<div class="budget-bar ${rows.length?'':'empty'}"><i><b style="--w:${Math.min(100,logged/block.budget*100)}%"></b></i><span>${rows.length?`${fmt(logged)} / ${fmt(block.budget)}`:`kb. ${fmt(block.budget)} kcal keret`}</span></div>`;}
 else if(budgetMode==='ring')headRight=budgetRing(logged,block.budget);
 return `<section class="meal-block v-a" style="--block-color:${block.color}" aria-label="${block.label}"><div class="block-head"><span class="block-art">${icon(block.art)}</span><strong>${block.label}</strong>${headRight}</div>${windowBar(block,rows)}${afterWindow}${rows.map(mealRow).join('')}${!rows.length&&current?`<button class="block-log" data-food-block="${block.time}"><span>＋</span><span><strong>Logolás ide</strong></span></button>`:!rows.length?`<p class="block-empty">Ezen a napon üresen maradt.</p>`:''}</section>`;
}
let budgetMode='ring';
function blocksSection({current,meals}){
 return mealBlocks.map(block=>blockCard(block,meals.filter(m=>blockFor(m.time)===block.key),current,budgetMode)).join('');
}
// The energy hero: at first glance only "ettél / még belefér"; the math opens in the glass box.
const gauge=(progress,size='')=>`<div class="fuel-gauge ${size}" style="--fuel-progress:${progress}"><svg class="fuel-gauge-rings" viewBox="0 0 160 160" aria-hidden="true"><circle class="fuel-gauge-base" cx="80" cy="80" r="69" pathLength="100"/><circle class="fuel-gauge-progress" cx="80" cy="80" r="69" pathLength="100"/></svg><span class="fuel-gauge-art">${icon('bowl')}</span></div>`;
const eqGlyph=`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.9 7H9.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="17" cy="17" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14.9 17H19.1M17 14.9V19.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13.5 6L18.5 6M13.8 9.5L17.2 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".55"/></svg>`;
const tapChip=(label='Miből jön össze?')=>`<span class="fuel-tapchip"><span>${label}</span><b>›</b><u class="chip-sheen"></u></span>`;
function heroSection(values,remaining,current,record,variant='h2'){
 const progress=Math.min(100,values.kcal/2400*100);
 const attrs=`class="fuel-focus v-${variant}" data-energy-detail aria-label="Energia-részletek megnyitása"`;
 if(!current){const label=record?'KCAL BEVITT':'NINCS ADAT';return `<button ${attrs}><div class="fuel-visual">${gauge(progress)}<div class="fuel-primary-number"><small>${label}</small><strong data-fuel-count="${values.kcal}">0</strong><span>/ 2 400 kcal</span></div></div>${tapChip('Részletek erről a napról')}</button>`;}
 if(variant==='h1')return `<button ${attrs}><div class="hero-pair"><div class="hero-side"><strong data-fuel-count="${values.kcal}">0</strong><small>KCAL·T ETTÉL</small></div>${gauge(progress,'small')}<div class="hero-side lead"><strong data-fuel-count="${Math.abs(remaining)}">0</strong><small>${remaining>=0?'MÉG BELEFÉR':'A KERET FELETT'}</small></div></div>${tapChip()}</button>`;
 if(variant==='h3')return `<button ${attrs}><div class="hero-pair top"><div class="hero-side"><strong data-fuel-count="${values.kcal}">0</strong><small>KCAL·T ETTÉL</small></div><div class="hero-side lead"><strong data-fuel-count="${Math.abs(remaining)}">0</strong><small>${remaining>=0?'MÉG BELEFÉR':'A KERET FELETT'}</small></div></div><div class="hero-track"><i style="--w:${progress}%"></i><b></b></div>${tapChip()}</button>`;
 return `<button ${attrs}><div class="fuel-visual">${gauge(progress)}<div class="fuel-primary-number"><small>${remaining>=0?'MÉG BELEFÉR':'A KERET FELETT'}</small><strong data-fuel-count="${Math.abs(remaining)}">0</strong><span>kcal</span></div></div><p class="fuel-eaten"><b data-fuel-count="${values.kcal}">0</b> kcal·t ettél ma</p>${tapChip()}</button>`;
}
let heroVariant='h1';
export function setHeroVariant(v){heroVariant=v;}
// Glass-box content: the math behind the number, only on tap.
export function energyDetailHtml(){
 const {values,remaining}=fuelOverview();
 const eatenPct=Math.min(100,values.kcal/2400*100);
 return `<div class="glass-hero">${icon('bowl')}<div><strong>${fmt(Math.abs(remaining))}</strong><small>kcal ${remaining>=0?'fér még bele ma':'a keret felett'}</small></div></div>
 <div class="glass-bar" role="img" aria-label="A napi keretedből ${fmt(values.kcal)} kcal fogyott el"><i style="--w:${eatenPct}%"></i><span class="gb-left">ettél</span><span class="gb-right">még szabad</span></div>
 <div class="glass-flow">
 <div class="glass-node" style="--node-color:#d9c395"><span class="gn-art">${icon('ring')}</span><span class="gn-copy"><strong>Napi keret</strong><small>edzésnapra igazítva, az aktív célod előírásából</small></span><b>2 400</b></div>
 <div class="glass-node" style="--node-color:#e08a7c"><span class="gn-art">${icon('bowl')}</span><span class="gn-copy"><strong>Megetted</strong><small>${fmt(values.p)} g fehérje · ${fmt(values.c)} g szénhidrát · ${fmt(values.f)} g zsír</small></span><b>− ${fmt(values.kcal)}</b></div>
 <div class="glass-node" style="--node-color:#c8e895"><span class="gn-art">${icon('dumbbell')}</span><span class="gn-copy"><strong>Mozgásból vissza</strong><small>ma még nincs logolt edzés</small></span><b>+ 0</b></div>
 <div class="glass-node total" style="--node-color:#8ed2e8"><span class="gn-art">${icon('bolt')}</span><span class="gn-copy"><strong>${remaining>=0?'Még belefér':'A keret felett'}</strong></span><b>${fmt(Math.abs(remaining))}<i>kcal</i></b></div>
 </div><p class="food-note">A keretet az alapigényed, a súlycélod és a mozgásod együtt adja — a számítás minden nap újraszületik.</p>`;
}
// Temporary comparison view for the owner: three hero options.
function variantsPage(overview){
 const {values,remaining}=overview;
 return `<div class="score-head"><button data-route="fuel/0" aria-label="Vissza a Mai oldalra">‹</button><span><small>FEJLÉC · 3 OPCIÓ</small><strong>Mit láss elsőre?</strong></span></div>
 <div class="lf-section"><h2>1 · Két szám a tál körül</h2><small>BALRA AMIT ETTÉL, JOBBRA AMI BELEFÉR</small></div>${heroSection(values,remaining,true,null,'h1')}
 <div class="lf-section"><h2>2 · Egy uralkodó szám</h2><small>A „MÉG BELEFÉR" A FŐSZEREPLŐ, ALATTA EGY CSENDES SOR</small></div>${heroSection(values,remaining,true,null,'h2')}
 <div class="lf-section"><h2>3 · Számpár + sáv</h2><small>KÉT SZÁM FELÜL, ALATTA TÖLTŐDŐ NAPI SÁV</small></div>${heroSection(values,remaining,true,null,'h3')}
 <p class="food-note">Mindegyik koppintásra a részletes bontást nyitja az üvegdobozban. Mondd a számát.</p>`;
}
export function setBudgetMode(mode){budgetMode=mode;}

// --- Meal detail ------------------------------------------------------------
const NOVA_LABEL={1:'NOVA 1 · alapanyag',2:'NOVA 2 · konyhai összetevő',3:'NOVA 3 · feldolgozott',4:'NOVA 4 · ultra-feldolgozott'};
function mealDetailPage(id){
 const m=mealRecord(id);
 if(!m)return `<div class="score-head"><button data-route="fuel/0" aria-label="Vissza">‹</button><span><strong>Nincs meg ez az étkezés</strong></span></div>`;
 const facts=m.raw&&!m.raw.fixed?{lines:m.raw.items.map(i=>[i.key==='banana'?'Banán':i.key==='greek'?'Görög joghurt':'Natúr joghurt',`${i.grams} g`,'kamra',null,1]),plants:mealFacts[m.name]?.plants??1}:mealFacts[m.name]??null;
 const n=m.nutrients;
 const nutrientRow=(label,value,unit='g')=>`<div class="nutri-row"><span>${label}</span><b>${value==null?'—':`${fmt1(value)} ${unit}`}</b></div>`;
 return `<div class="score-head"><button data-route="fuel/0" aria-label="Vissza a Mai oldalra">‹</button><span><small>${safe(m.slot||'ÉTKEZÉS').toLocaleUpperCase('hu-HU')}${m.history?' · KORÁBBI NAP':''}</small><strong>${safe(m.name)}</strong></span><b>${m.time}</b></div>
 <div class="meal-hero"><div class="meal-hero-kcal"><strong data-fuel-count="${m.macros.kcal}">0</strong><small>kcal</small></div>${m.score!=null?`<button class="score-chip big" data-score="${m.id}">${icon('score')}<span><b>${score1(m.score)}</b><small>AI-ÉRTÉKELÉS ↗</small></span></button>`:''}</div>
 <div class="lf-section"><h2>Hozzávalók</h2><small>${facts?facts.lines.length:0} TÉTEL</small></div>
 ${facts?facts.lines.map(([name,amount,source,kcal,nova])=>`<div class="line-row">${icon(source==='kamra'?'stack':source==='recept'?'book':'chat')}<span><strong>${safe(name)}</strong><small>${safe(amount)} · ${safe(source)}${nova?` · <u class="${nova===4?'warn':''}">${NOVA_LABEL[nova]}</u>`:''}</small></span><b>${kcal==null?'':`${fmt(kcal)} kcal`}</b></div>`).join(''):'<p class="block-empty">Ehhez a mintaelőzményhez nincsenek részletezett sorok.</p>'}
 <div class="lf-section"><h2>Tápértékek</h2><small>MENTÉSKOR BEFAGYASZTVA</small></div>
 <div class="nutri-grid">${nutrientRow('Fehérje',m.macros.p)}${nutrientRow('Szénhidrát',m.macros.c)}${nutrientRow('Zsír',m.macros.f)}${nutrientRow('Rost',m.macros.fiber)}${nutrientRow('Cukor',n?.sugar)}${nutrientRow('Só',n?.salt)}${nutrientRow('Telített zsír',n?.satfat)}<div class="nutri-row"><span>Növényféle</span><b>${facts?.plants??'—'}</b></div></div>
 <p class="nutri-note">A „—" azt jelenti: a forrás nem adott értéket — nem nulla, és nem találgatjuk.</p>
 <div class="lf-section"><h2>Eredet</h2></div><p class="meal-prov">${icon('chat')} ${safe(m.provenance)}</p>
 ${m.history?'':`<button class="food-action" data-food-edit="${m.id}">Szerkesztem az étkezést ✎</button>`}
 <p class="food-note">Minden érték a mentéskori pillanatkép — a katalógus későbbi módosítása nem írja át a múltat.</p>`;
}

// --- AI score breakdown (mirrors the production 8-dimension envelope) -------
function buildEnvelope(m){
 const base=m.score??7.4,facts=mealFacts[m.name],n=facts?.nutrients,plants=facts?.plants??1;
 const novaLines=(facts?.lines??[]).map(([name,,,,nova])=>({name,nova:nova??1}));
 const novaShare=g=>{const rows=(facts?.lines??[]).filter(l=>l[4]===g),total=(facts?.lines??[]).reduce((s,l)=>s+(l[3]||0),0)||1;return Math.round(rows.reduce((s,l)=>s+(l[3]||0),0)/total*100);};
 const block=mealBlocks.find(b=>b.key===blockFor(m.time));
 const clamp=v=>Math.min(10,Math.max(3,v));
 const microRows=n?[
  {name:'Rost',value:`${fmt1(facts.macros?.fiber)} g`,pct:Math.min(120,Math.round((facts.macros?.fiber??0)/7*100)),status:(facts.macros?.fiber??0)>=6?'good':'ok'},
  n.sugar==null?null:{name:'Cukor',value:`${fmt1(n.sugar)} g`,pct:Math.round(n.sugar/25*100),status:n.sugar<=12?'good':n.sugar<=22?'ok':'low'},
  n.salt==null?null:{name:'Só',value:`${fmt1(n.salt)} g`,pct:Math.round(n.salt/1.7*100),status:n.salt<=1?'good':'ok'},
  n.satfat==null?null:{name:'Telített zsír',value:`${fmt1(n.satfat)} g`,pct:Math.round(n.satfat/7*100),status:n.satfat<=5?'good':n.satfat<=9?'ok':'low'},
 ].filter(Boolean):[];
 const microDegraded=microRows.length<3;
 const dims=[
  {id:'macro',label:'Makró-egyensúly',weight:.22,score:clamp(base+.4),coverage:1,detail:'A fehérje–szénhidrát–zsír arány a napi célodhoz képest.',macro:{ratioP:32,ratioC:44,ratioF:24,targetP:'25–35%',targetC:'40–50%',targetF:'20–30%',kcalShareOfDay:Math.round(m.kcal/2400*100),targetOrigin:'az aktív célod előírásából'}},
  {id:'micro',label:'Mikrotápanyagok',weight:microDegraded?0:.10,score:microDegraded?0:clamp(base-.6),coverage:microDegraded?.4:.9,detail:microDegraded?'Nem volt elég adat — a szempont kimaradt, a többi súlya átveszi.':'Rost, cukor, só és telített zsír az étkezés-keretedhez mérve.',micros:microRows},
  {id:'who',label:'WHO-irányelvek',weight:.14,score:clamp(base+.1),coverage:.9,detail:'Cukor-, só- és zsírbevitel a WHO ajánlásaihoz képest.',context:[['Hozzáadott cukor','ajánláson belül'],['Só','megfelelő'],['Zsírarány','rendben']]},
  {id:'fat_quality',label:'Zsírminőség',weight:.10,score:clamp(base+(n?.satfat!=null&&n.satfat>9?-1.2:.2)),coverage:n?.satfat==null?.5:1,detail:n?.satfat==null?'A telített zsírról nem volt adat minden sorban.':'Telített és telítetlen zsírok aránya.',context:[['Telített zsír',n?.satfat==null?'—':`${fmt1(n.satfat)} g`],['Arány a zsírokon belül',n?.satfat==null?'nem látható':'kiegyensúlyozott']]},
  {id:'nova',label:'Feldolgozottság',weight:.18,score:clamp(base+(novaLines.some(l=>l.nova===4)?-1.4:.9)),coverage:1,detail:'Minél közelebb az alapanyagokhoz, annál jobb.',nova:{dominant:novaLines.some(l=>l.nova===4)&&novaShare(4)>40?4:1,stack:[1,2,3,4].map(g=>({nova:g,pct:novaShare(g),label:novaLines.filter(l=>l.nova===g).map(l=>l.name).join(', ')||'—'})),items:novaLines.map(l=>({...l,warning:l.nova===4}))}},
  {id:'plant_diversity',label:'Növényi változatosság',weight:.08,score:clamp(4+plants*1.4),coverage:1,detail:'Hányféle növény került a tányérra.',context:[['Növényfélék száma',String(plants)],['A heti 30-féle célhoz','minden féle számít']]},
  {id:'energy_density',label:'Energiasűrűség',weight:.06,score:clamp(base+.5),coverage:1,detail:'Mennyire laktató a kalóriájához képest.',context:[['Energiasűrűség','mérsékelt'],['Teltségérzet','jó']]},
  {id:'context',label:'Napi kontextus',weight:.12,score:clamp(base+.3),coverage:1,detail:'Hogyan illeszkedik az addigi napodhoz és az étkezés-ablakodhoz.',context:[['A nap addigi része','kereten belül'],['Fehérje eddig','jó ütemben']],timing:{eatenAt:m.time,windowFrom:block?.time??null,windowTo:block?block.time.replace(/^(\d\d)/,h=>String(Number(h)+2).padStart(2,'0')):null,slotLabel:block?.label?.toLocaleLowerCase('hu-HU')??'nasi'},note:'Jó ütemben jött — az ablakod közepén, és hagyott teret a vacsorának.'},
 ];
 const active=dims.filter(d=>d.weight>0),wsum=active.reduce((s,d)=>s+d.weight,0);
 const confidence=Math.round(dims.reduce((s,d)=>s+(d.coverage??1),0)/dims.length*100);
 const verdict=base>=8?'Erős választás volt. A fehérje és a feldolgozottság viszi a hátán — ezt nyugodtan ismételd.':base>=7?'Rendben lévő étkezés. Egy marék zöldség vagy gyümölcs mellé, és a mikrotápanyag-sor is felzárkózik.':'Belefér. A nap egészében nézzük — egyetlen étkezés sosem ítélet.';
 const tagline=base>=8?'Fehérjében erős, tiszta tányér':base>=7?'Stabil választás, kis ráfejlesztéssel':'Belefér — a nap egésze számít';
 const improve=[base>=8?'Ha még feljebb vinnéd: egy marék leveles zöld a rost-sorért.':'Tegyél mellé egy adag zöldséget — a mikró- és rost-sor egyszerre lép feljebb.','A telített zsírt sajt helyett olajos maggal cserélve a zsírminőség-sor javul.'];
 return {value:base,confidence,tagline,summary:verdict,dims,wsum,improve};
}
const STATUS_LABEL={good:'rendben',ok:'oké',low:'figyeld'};
const STATUS_COLOR={good:'#8fd97a',ok:'#8ed2e8',low:'#e0b56e'};
const NOVA_SHORT={1:'Alapanyag',2:'Konyhai összetevő',3:'Feldolgozott',4:'Ultra-feldolgozott'};
// Each scoring dimension gets its own hue + clay icon so the breakdown reads as a colorful mosaic.
const DIM_STYLE={macro:['#e08a7c','macro'],micro:['#bca6f1','micro'],who:['#8ed2e8','heart'],fat_quality:['#cdd170','avocado'],nova:['#d9c395','processing'],plant_diversity:['#8fd97a','fiber'],energy_density:['#f0b36e','bolt'],context:['#8fa8f0','sun']};
const weightPct=(d,wsum)=>Math.round(d.weight/(wsum||1)*100);
function dimTile(mealId,d,wsum){
 const [color,art]=DIM_STYLE[d.id],degraded=d.weight===0;
 return `<button class="dim-tile ${degraded?'degraded':''}" style="--dim-color:${color}" data-dim="${mealId}|${d.id}" aria-label="${d.label}: ${degraded?'kimaradt':score1(d.score)} — részletek"><span class="dim-tile-top"><span class="dim-tile-art">${icon(art)}</span><strong>${degraded?'—':score1(d.score)}</strong></span><span class="dim-tile-label">${d.label}</span><i class="dim-tile-bar"><b style="--v:${degraded?0:d.score*10}%"></b></i><small>${degraded?'kimaradt · kevés adat':`súly ${weightPct(d,wsum)}%`}</small></button>`;
}
// Glass-box body for one dimension: same material and rhythm as the energy breakdown.
export function dimGlassHtml(mealId,dimId){
 const m=mealInfo(mealId);if(!m)return '<p class="sheet-sub">Nincs meg ez az étkezés.</p>';
 const env=buildEnvelope(m),d=env.dims.find(x=>x.id===dimId);if(!d)return '<p class="sheet-sub">Nincs ilyen szempont.</p>';
 const [color,art]=DIM_STYLE[d.id],degraded=d.weight===0;
 let body='';
 if(degraded)body+=`<div class="glass-callout"><span>${icon('chat')}</span><p><small>ŐSZINTÉN</small>Ehhez az étkezéshez nem volt elég adat, ezért ez a szempont kimaradt, és a többi súlya vette át a helyét. Nem találgatunk.</p></div>`;
 if(d.macro){const p=d.macro;body+=`<div class="glass-list">${[['Fehérje',p.ratioP,p.targetP,'#e08a7c','meat'],['Szénhidrát',p.ratioC,p.targetC,'#d9c395','carb'],['Zsír',p.ratioF,p.targetF,'#cdd170','avocado']].map(([l,v,t,c,a])=>`<div class="glass-stat" style="--stat-color:${c}"><span class="gs-art">${icon(a)}</span><span class="gs-copy"><strong>${l}</strong><i><b style="--w:${v}%"></b></i><small>cél: ${t}</small></span><b>${v}%</b></div>`).join('')}</div><p class="glass-fact">A nap energiájának <b>${p.kcalShareOfDay}%</b>-a · a cél ${safe(p.targetOrigin)}.</p>`;}
 if(d.micros?.length)body+=`<div class="glass-list">${d.micros.map(r=>`<div class="glass-stat" style="--stat-color:${STATUS_COLOR[r.status]}"><span class="gs-dot"></span><span class="gs-copy"><strong>${r.name}</strong><i><b style="--w:${Math.min(100,r.pct)}%"></b></i><small>az étkezés-keret ${r.pct}%-a</small></span><b>${r.value}<em>${STATUS_LABEL[r.status]}</em></b></div>`).join('')}</div>`;
 if(d.nova){const nv=d.nova,groups=nv.stack.filter(s=>s.pct>0);body+=`<div class="glass-nova">${groups.map(s=>`<i class="n${s.nova}" style="--w:${s.pct}%"></i>`).join('')}</div><div class="glass-list">${groups.map(s=>`<div class="glass-stat plain"><span class="gs-dot nova n${s.nova}"></span><span class="gs-copy"><strong>${NOVA_SHORT[s.nova]}</strong><small>${safe(s.label)}</small></span><b>${s.pct}%</b></div>`).join('')}</div>${nv.items.some(i=>i.warning)?`<p class="glass-fact warn">Ultra-feldolgozott sor: ${safe(nv.items.filter(i=>i.warning).map(i=>i.name).join(', '))}</p>`:''}`;}
 if(d.timing){const t=d.timing;const pos=t.windowFrom&&t.windowTo?Math.min(96,Math.max(4,(minutesOf(t.eatenAt)-minutesOf(t.windowFrom))/(minutesOf(t.windowTo)-minutesOf(t.windowFrom))*100)):50;body+=`<div class="glass-timing"><span>${t.windowFrom??''}</span><i><b style="--at:${pos}%"></b></i><span>${t.windowTo??''}</span></div><p class="glass-fact"><b>${t.eatenAt}</b>-kor etted · ${safe(t.slotLabel)}-ablak.</p>`;}
 if(d.context)body+=`<div class="glass-list">${d.context.map(([l,v])=>`<div class="glass-kv"><span>${safe(l)}</span><b>${safe(v)}</b></div>`).join('')}</div>`;
 if(d.note)body+=`<div class="glass-callout"><span>${icon('score')}</span><p><small>MEZO JEGYZETE</small>${safe(d.note)}</p></div>`;
 return `<div class="glass-dim" style="--dim-color:${color}"><div class="glass-hero dim"><span class="glass-hero-art">${icon(art)}</span><div><strong>${degraded?'—':score1(d.score)}</strong><small>${d.label}</small></div></div><div class="glass-chips"><span>súly ${weightPct(d,env.wsum)}%</span>${d.coverage!=null?`<span>lefedettség ${Math.round(d.coverage*100)}%</span>`:''}</div><div class="glass-bar dimbar"><i style="--w:${degraded?0:d.score*10}%"></i></div><p class="glass-lead">${safe(d.detail)}</p>${body}</div>`;
}
function scorePage(id){
 const m=mealInfo(id);
 if(!m)return `<div class="score-head"><button data-route="fuel/0" aria-label="Vissza a Mai oldalra">‹</button><span><strong>Nincs meg ez az étkezés</strong></span></div>`;
 const env=buildEnvelope(m);
 return `<div class="score-head"><button data-route="fuel/0" aria-label="Vissza a Mai oldalra">‹</button><span><small>AI-ÉRTÉKELÉS${m.history?' · KORÁBBI NAP':''}</small><strong>${safe(m.name)}</strong></span><b>${m.time} · ${fmt(m.kcal)} kcal</b></div>
 <div class="ai-hero"><span class="ai-hero-glow"></span><span class="ai-hero-art">${icon('score')}</span><strong class="ai-hero-score">${score1(env.value)}</strong><em>${safe(env.tagline)}</em><p>${safe(env.summary)}</p><span class="ai-conf"><i style="--w:${env.confidence}%"></i>Bizonyosság ${env.confidence}%</span></div>
 <div class="lf-section"><h2>Miből áll össze?</h2><small>KOPPINTS A RÉSZLETEKÉRT</small></div>
 <div class="dim-grid">${env.dims.map(d=>dimTile(m.id,d,env.wsum)).join('')}</div>
 <div class="lf-section"><h2>Ha feljebb vinnéd</h2></div>
 ${env.improve.map(row=>`<div class="ai-improve"><span>${icon('bolt')}</span><p>${safe(row)}</p></div>`).join('')}
 <div class="score-feedback"><span class="overline">TALÁLT AZ ÉRTÉKELÉS?</span><button data-score-feedback="up">Talál ✓</button><button data-score-feedback="down">Nem talál</button></div>
 <p class="food-note">A pontszám mentéskor, determinisztikusan születik; a szöveges részt a coach írja hozzá, és sosem írja át a számokat. Mintaadatok.</p>`;
}

export function fuelDashboardContent(domain,page,date){
 if(domain!=='fuel'||page!==0)return null;
 const segments=location.hash.slice(1).split('/');
 if(segments[2]==='score')return scorePage(segments[3]||'');
 if(segments[2]==='meal')return mealDetailPage(segments[3]||'');
 if(segments[2]==='variants')return variantsPage(fuelOverview(date));
 const overview=fuelOverview(date);
 const {current,record,values,remaining}=overview;
 return `${heroSection(values,remaining,current,record,heroVariant)}<section class="fuel-rings" aria-label="Makrók, víz és rost">${ring('Fehérje','meat',values.p,160,'#e08a7c')}${ring('Szénhidrát','carb',values.c,270,'#d9c395')}${ring('Zsír','avocado',values.f,76,'#cdd170')}${ring('Víz','water',(values.water||0)/1000,2.5,'#8ed2e8','l')}${ring('Rost','fiber',values.fiber,30,'#8fd97a')}</section><div class="food-list-heading"><h2>${current?'A mai blokkjaid':'Ezen a napon'}</h2><span>${overview.mealCount} ÉTKEZÉS</span></div>${current||record?blocksSection(overview):`<div class="food-day-empty flat">${icon('bowl')}<strong>Nincs étkezés.</strong></div>`}<button class="fuel-log-action" ${current?'data-food':'data-day-today'}><span class="fuel-log-icon">${icon('chat')}</span><span><strong>${current?'Étkezés logolása':'Vissza a mai naphoz'}</strong><small>${current?'Kamera · hang · gépelés · szokásosak':'Logolni mindig a mai naphoz tudsz'}</small></span><b>${current?'＋':'→'}</b></button><details class="fuel-more flat"><summary>További részletek <span>KERET · MOZGÁS · RECEPTEK</span></summary><button class="fuel-secondary" data-food-budget>${icon('ring')}<span><strong>Keretszámítás</strong></span><b>↗</b></button>${record||current?`<button class="fuel-secondary" data-route="train/0">${icon('dumbbell')}<span><strong>${current?'Felsőtest A':record.training}</strong></span><b>↗</b></button>`:''}<button class="fuel-secondary" data-route="fuel/1">${icon('bowl')}<span><strong>Konyha</strong></span><b>↗</b></button></details>`;
}
