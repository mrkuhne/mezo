// Konyha (fuel/1), Trendek (fuel/2) and Kiegészítők (fuel/3) full-page renderers.
import { createRecipes, addRecipe, updateRecipe, removeRecipe, createPantry, addPantryItem, removePantryItem, pantrySwaps, createStack, toggleIntake, stackProgress, addStackItem, stackZones, weekData, weekSummary, weekCompare, weekDeltas, fuelDayScore, longHorizon, patterns } from './fuel-state.js';
import { mealBlocks } from './food-state.js';
import { GOALS, draftFromRecipe, draftNutrition, lineMacros, draftTotals, canSave, setLineAmount, scaleServings, replaceWithPantry, dropLine, workshopTurn } from './workshop-state.js';
import { openFoodFixed } from './food.js';
import { energyDetailHtml, dimGlassHtml, ingredientStyle, NOVA_COLOR, NOVA_SHORT, qualityTilesHtml, microCardsHtml } from './fuel-dashboard.js';
import { icon, safe, toast, react } from './nap.js';
const fmt=v=>Math.round(v).toLocaleString('hu-HU');
const fmt1=v=>v==null?'—':Number(v).toLocaleString('hu-HU',{maximumFractionDigits:1});
const score1=v=>Number(v).toLocaleString('hu-HU',{minimumFractionDigits:1,maximumFractionDigits:1});
let recipes=createRecipes(),pantry=createPantry(),stack=createStack(),week='current',callbacks;
let recipeFilter='Mind',pantryFilter='Mind',servings=1,servingsFor=null,armedDelete=null;

// --- Konyha ---------------------------------------------------------------
// Recipes wear the hue of the meal block they belong to — the same language as Fuel Mai.
const slotBlock=slot=>mealBlocks.find(b=>b.label===slot)??mealBlocks[1];
const SOURCE_ICON={'katalógus':'book','fotó':'camera','link':'link','kézi':'chat'};
const SOURCE_LABEL={'katalógus':'közös katalógusból','fotó':'címkefotóról','link':'linkből','kézi':'kézzel felvéve'};
const pantryStyle=k=>k.kind==='supp'?['#bca6f1','micro']:ingredientStyle(k.name);
const added=d=>d==null?'':d===0?'ma':d===1?'tegnap':`${d} napja`;
const back=(label,attr)=>`<button ${attr} aria-label="Vissza: ${label}">‹</button>`;
const shareRings=(p,c,f,scale=1,unit='g')=>{const pK=p*4,cK=c*4,fK=f*9,t=pK+cK+fK||1;return `<section class="fuel-rings three">${[['Fehérje','meat',pK,p,'#e08a7c'],['Szénhidrát','carb',cK,c,'#d9c395'],['Zsír','avocado',fK,f,'#cdd170']].map(([name,art,kcal,g,color])=>{const pct=Math.round(kcal/t*100);return `<div class="macro-cell"><span class="macro-ico">${icon(art)}</span><div class="fuel-ring share" style="--macro-color:${color};--ring-progress:${pct}"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="fuel-ring-track" cx="40" cy="40" r="34" pathLength="100"/><circle class="fuel-ring-progress" cx="40" cy="40" r="34" pathLength="100"/></svg><span aria-label="${name}: ${pct}%, ${fmt1(g*scale)} ${unit}"><strong><span>${pct}</span><i>%</i></strong><b>${fmt1(g*scale)} ${unit}</b></span></div><span class="macro-name">${name}</span></div>`;}).join('')}</section>`;};
const deleteControl=(kind,id,label)=>armedDelete===`${kind}:${id}`?`<div class="kx-delete armed"><p>Biztosan ${label}? Ez nem vonható vissza a demóban.</p><button data-delete-confirm="${kind}:${id}">Igen, ${label}</button><button data-delete-cancel>Mégse</button></div>`:`<div class="kx-delete"><button data-delete-arm="${kind}:${id}">${icon('stack')}${label.charAt(0).toUpperCase()+label.slice(1)}</button></div>`;

function konyha(){
 const food=pantry.filter(k=>k.kind==='food').length,supp=pantry.length-food;
 const inProgress=wsx.draft&&!wsx.sourceId?wsx.draft:null;
 const favourite=[...recipes].sort((a,b)=>(b.eaten||0)-(a.eaten||0))[0];
 return `<div class="kx-captures">
  <button class="kx-capture" style="--kx:#bca6f1" data-konyha-recipe><span class="kx-capture-art">${icon('book')}</span><b class="kx-plus">＋</b><strong>Recept mentése</strong><small>Műhely · kézzel</small></button>
  <button class="kx-capture" style="--kx:#d9c395" data-konyha-pantry><span class="kx-capture-art">${icon('camera')}</span><b class="kx-plus">＋</b><strong>Új elem a kamrába</strong><small>Fotó · link · katalógus</small></button>
 </div>
 <button class="kx-poster kx-ws-poster" style="--kx:#bca6f1" data-workshop-open><span class="kx-poster-head"><span class="kx-poster-title">${icon('score')}<strong>Receptműhely</strong></span><b>↗</b></span><span class="kx-ws-copy"><strong>${inProgress?safe(inProgress.name):'Főzzünk ki valamit'}</strong><small>${inProgress?`Folytatjuk? ${inProgress.lines.length} hozzávaló vár a vázlatban.`:'Te mondod a célt, én a hozzávalót — a számokat a kamrád adja.'}</small></span><span class="kx-ws-goals">${GOALS.map(g=>`<i style="--kx:${g.color}" title="${g.label}">${icon(g.art)}</i>`).join('')}</span><u class="chip-sheen"></u></button>
 <button class="kx-poster" style="--kx:#bca6f1" data-subroute="receptek"><span class="kx-poster-head"><span class="kx-poster-title">${icon('book')}<strong>Receptek</strong></span><b>↗</b></span><span class="kx-poster-main"><strong>${recipes.length}</strong><span class="kx-bowls">${recipes.slice(0,5).map(r=>`<i style="--slot:${slotBlock(r.slot).color}">${icon('bowl')}</i>`).join('')}</span></span>${favourite?.eaten?`<span class="kx-poster-foot">${icon('score')}<span>Kedvenced most: <b>${safe(favourite.name)}</b> · ${favourite.eaten}× etted</span></span>`:''}</button>
 <button class="kx-poster" style="--kx:#d9c395" data-subroute="kamra"><span class="kx-poster-head"><span class="kx-poster-title">${icon('stack')}<strong>Kamra</strong></span><b>↗</b></span><span class="kx-poster-main"><strong>${pantry.length}</strong><span class="kx-split" role="img" aria-label="${food} étel, ${supp} kiegészítő"><i style="--w:${pantry.length?food/pantry.length*100:0}%"></i><u></u></span></span><span class="kx-legend"><em>${icon('carb')}${food} étel</em><em>${icon('micro')}${supp} kiegészítő</em></span></button>
`;
}

function recipeTile(r){
 const block=slotBlock(r.slot),pK=r.p*4,cK=r.c*4,fK=r.f*9,t=pK+cK+fK||1;
 return `<button class="kx-recipe" style="--kx:${block.color}" data-recipe-open="${r.id}"><span class="kx-recipe-top"><span class="kx-recipe-art">${icon('bowl')}</span>${r.fit==null?`<span class="score-chip pending">${icon('score')}<b>számolódik</b></span>`:`<span class="score-chip">${icon('score')}<b>${score1(r.fit)}</b></span>`}</span><strong>${safe(r.name)}</strong><span class="kx-recipe-kcal"><b>${fmt(r.kcal)}</b> kcal / adag</span><span class="kx-macro-bar" role="img" aria-label="Makró-arány"><i style="--w:${pK/t*100}%;--c:#e08a7c"></i><i style="--w:${cK/t*100}%;--c:#d9c395"></i><i style="--w:${fK/t*100}%;--c:#cdd170"></i></span><span class="kx-recipe-meta">${icon(block.art)}${r.slot}${r.mins?` · ${r.mins} perc`:''}</span></button>`;
}
function receptekPage(){
 const slots=['Mind',...mealBlocks.map(b=>b.label)];
 const list=recipeFilter==='Mind'?recipes:recipes.filter(r=>r.slot===recipeFilter);
 return `<div class="kx-subhead">${back('Konyha','data-route="fuel/1"')}<span><small>KONYHA</small><strong>Receptek</strong></span></div>
 <div class="kx-filters">${slots.map(s=>{const n=s==='Mind'?recipes.length:recipes.filter(r=>r.slot===s).length;return `<button data-recipe-filter="${s}" aria-pressed="${recipeFilter===s}" style="--kx:${s==='Mind'?'#bca6f1':slotBlock(s).color}">${s==='Mind'?'':icon(slotBlock(s).art)}${s}<b>${n}</b></button>`;}).join('')}</div>
 ${list.length?`<div class="kx-recipe-grid">${list.map(recipeTile).join('')}</div>`:`<div class="kx-empty">${icon('bowl')}<strong>Ebben a blokkban még nincs recepted.</strong><button data-konyha-recipe>Mentsünk egyet ＋</button></div>`}`;
}
function recipeDetailPage(id){
 if(servingsFor!==id){servings=1;servingsFor=id;}
 const r=recipes.find(x=>x.id===id);
 if(!r)return `<div class="kx-subhead">${back('Receptek','data-subroute="receptek"')}<span><strong>Nincs meg ez a recept</strong></span></div>`;
 const block=slotBlock(r.slot),lineKcal=r.lines.reduce((s,l)=>s+(l[2]||0),0)||1;
 return `<div class="score-head">${back('Receptek','data-subroute="receptek"')}<span><small>${r.slot.toLocaleUpperCase('hu-HU')}-RECEPT</small><strong>${safe(r.name)}</strong></span>${r.fit==null?`<span class="score-chip pending">${icon('score')}<b>számolódik</b></span>`:`<button class="score-chip" data-recipe-score="${r.id}" aria-label="Mezo-illeszkedés: ${score1(r.fit)}">${icon('score')}<b>${score1(r.fit)}</b></button>`}</div>
 <div class="meal-hero3" style="--block-color:${block.color}"><span class="mh-glow"></span>
  <div class="mh-left"><span class="mh-art">${icon('bowl')}</span><div class="mh-kcal"><strong>${fmt(r.kcal*servings)}</strong><small>kcal</small></div></div>
  <div class="mh-right"><div class="mh-info"><span class="mh-info-art">${icon(block.art)}</span><span><strong>${r.slot}</strong><small>${r.mins?`${r.mins} perc alatt kész`:'elkészítési idő nincs megadva'}</small></span></div><div class="mh-info" style="--block-color:#bca6f1"><span class="mh-info-art">${icon('ring')}</span><span><strong>${r.eaten?`${r.eaten}× etted`:'Még nem etted'}</strong><small>${r.lastEaten?`legutóbb ${r.lastEaten}`:'naplózd, ha elkészült'}</small></span></div></div>
 </div>
 <div class="kx-servings" role="group" aria-label="Adagok száma">${[1,2,3,4].map(n=>`<button data-servings="${n}" aria-pressed="${servings===n}">${n} adag</button>`).join('')}</div>
 <div class="lf-section"><h2>Makrók</h2></div>${shareRings(r.p,r.c,r.f,servings)}
 <div class="lf-section"><h2>Hozzávalók</h2></div>
 <div class="ing-list">${r.lines.length?r.lines.map(([name,amount,kcal,nova])=>{const [color,art]=ingredientStyle(name),share=kcal?Math.round(kcal/lineKcal*100):null;return `<div class="ing-row" style="--ing-color:${color}"><span class="ing-art">${icon(art)}</span><span class="ing-copy"><strong>${safe(name)}</strong><span class="ing-meta">${nova?`<em class="nova" style="--nova:${NOVA_COLOR[nova]}"><i></i>${NOVA_SHORT[nova]}</em>`:''}${servings>1?`<em>${icon('ring')}× ${servings}</em>`:''}</span>${share!=null?`<i class="ing-bar"><b style="--w:${share}%"></b></i>`:''}</span><span class="ing-end"><b>${kcal==null?'—':fmt(kcal*servings)}<small>kcal</small></b><small>${safe(amount)}</small></span></div>`;}).join(''):`<p class="block-empty">A hozzávalók még nincsenek részletezve.</p>`}</div>
 <div class="lf-section"><h2>Minőség</h2></div>${qualityTilesHtml(r.lines.map(([,amount,kcal,nova])=>({amount,kcal,nova})),r.plants)}
 <div class="lf-section"><h2>Mikrotápanyagok</h2></div>${microCardsHtml({fiber:r.fiber,sugar:r.sugar,salt:r.salt,satfat:r.satfat},servings)}
 <div class="prov-card"><span class="prov-art">${icon('score')}</span><span><strong>Mezo jegyzete</strong><small>${safe(r.note)}</small></span></div>
 <button class="meal-edit kx-primary" data-recipe-log="${r.id}">${icon('bowl')}<span>Ma ettem ilyet — naplózom</span><b>›</b></button>
 <button class="meal-edit kx-secondary" data-workshop-iterate="${r.id}">${icon('score')}<span>Iterálás a Műhelyben</span><b>›</b></button>
 <div class="kx-actions"><button data-demo-edit="recept">${icon('book')}Szerkesztés</button>${deleteControl('recipe',r.id,'törlöm')}</div>`;
}
function recipeScoreGlass(id){
 const r=recipes.find(x=>x.id===id);if(!r||r.fit==null)return '<p class="sheet-sub">A pontszám még számolódik.</p>';
 const ultra=r.lines.some(l=>l[3]===4);
 const dims=[['Makró-illeszkedés','macro','#e08a7c',Math.min(10,r.fit+.3),'A fehérje–szénhidrát–zsír arány a célodhoz és a blokkhoz képest.'],['Feldolgozottság','processing','#d9c395',Math.min(10,Math.max(3,r.fit+(ultra?-1.3:.6))),ultra?'Van benne ultra-feldolgozott összetevő.':'Szinte csak alapanyagokból áll.'],['Tápanyag-sűrűség','micro','#bca6f1',Math.max(3,r.fit-.4),'Rost és mikrotápanyag a kalóriájához képest.']];
 return `<div class="glass-dim" style="--dim-color:#bca6f1"><div class="glass-hero dim"><span class="glass-hero-art">${icon('score')}</span><div><strong>${score1(r.fit)}</strong><small>Mezo-illeszkedés · ${safe(r.name)}</small></div></div><div class="glass-bar dimbar"><i style="--w:${r.fit*10}%"></i></div><div class="glass-list">${dims.map(([l,a,c,v,d])=>`<div class="glass-stat" style="--stat-color:${c}"><span class="gs-art">${icon(a)}</span><span class="gs-copy"><strong>${l}</strong><i><b style="--w:${v*10}%"></b></i><small>${d}</small></span><b>${score1(v)}</b></div>`).join('')}</div><div class="glass-callout"><span>${icon('score')}</span><p><small>MIÉRT JÓ?</small>${safe(r.note)}</p></div></div>`;
}

function pantryTile(k){
 const [color,art]=pantryStyle(k);
 const fact=k.kind==='supp'?`<b>${safe(k.dose||'—')}</b> adag`:k.kcal100!=null?`<b>${fmt(k.kcal100)}</b> kcal / 100 g`:'<b>—</b> nincs adat';
 return `<button class="kx-item" style="--kx:${color}" data-pantry-open="${k.id}" data-name="${safe(k.name.toLocaleLowerCase('hu-HU'))}"><span class="kx-item-top"><span class="kx-item-art">${icon(art)}</span><em title="${SOURCE_LABEL[k.source]||''}">${icon(SOURCE_ICON[k.source]||'chat')}</em></span><strong>${safe(k.name)}</strong><span class="kx-item-fact">${fact}</span>${k.kind==='food'&&k.p100!=null?`<span class="kx-protein"><i><b style="--w:${Math.min(100,k.p100/25*100)}%"></b></i><small>${fmt1(k.p100)} g fehérje</small></span>`:k.kind==='supp'?`<span class="kx-protein supp"><small>${icon('clock')}${safe(k.timing||'')}</small></span>`:''}<span class="kx-item-amount">${safe(k.amount||'')}</span></button>`;
}
function kamraPage(){
 const food=pantry.filter(k=>k.kind==='food').length,supp=pantry.length-food;
 const tabs=[['Mind',pantry.length,'#d9c395',''],['Étel',food,'#8fd97a','carb'],['Kiegészítő',supp,'#bca6f1','micro']];
 const list=pantryFilter==='Étel'?pantry.filter(k=>k.kind==='food'):pantryFilter==='Kiegészítő'?pantry.filter(k=>k.kind==='supp'):pantry;
 return `<div class="kx-subhead">${back('Konyha','data-route="fuel/1"')}<span><small>KONYHA</small><strong>Kamra</strong></span></div>
 <label class="kx-search"><span>${icon('stack')}</span><input type="search" placeholder="Keresés a polcon…" aria-label="Keresés a kamrában" data-pantry-search></label>
 <div class="kx-filters">${tabs.map(([label,n,color,art])=>`<button data-pantry-filter="${label}" aria-pressed="${pantryFilter===label}" style="--kx:${color}">${art?icon(art):''}${label}<b>${n}</b></button>`).join('')}</div>
 <div class="kx-pantry-grid">${list.map(pantryTile).join('')}</div><p class="kx-search-empty" hidden>Nincs ilyen a polcodon.</p>
 ${pantrySwaps.length?`<div class="lf-section"><h2>Okosabb csere</h2></div>${pantrySwaps.map(s=>`<div class="kx-swap"><span class="kx-swap-from">${icon(ingredientStyle(s.from)[1])}<small>${safe(s.from)}</small></span><b>→</b><span class="kx-swap-to">${icon('fiber')}<strong>${safe(s.to)}</strong><small>${safe(s.reason)} · ${safe(s.price)}</small></span></div>`).join('')}`:''}`;
}
function pantryDetailPage(id){
 const k=pantry.find(x=>x.id===id);
 if(!k)return `<div class="kx-subhead">${back('Kamra','data-subroute="kamra"')}<span><strong>Nincs ilyen tétel</strong></span></div>`;
 const [color,art]=pantryStyle(k),supp=k.kind==='supp';
 const usedIn=recipes.filter(r=>r.lines.some(l=>l[0].toLocaleLowerCase('hu-HU').includes(k.name.split(/[\s-]/)[0].toLocaleLowerCase('hu-HU'))));
 const quality=[['Cukor',k.sugar100,'g','sugar','#f0a8c8'],['Só',k.salt100,'g','salt','#b9c7d6'],['Telített zsír',k.satfat100,'g','fat','#f0b36e'],['Feldolgozottság',k.nova,'','processing',k.nova?NOVA_COLOR[k.nova]:'#8ed2e8']];
 return `<div class="score-head">${back('Kamra','data-subroute="kamra"')}<span><small>${safe(k.category||'KAMRA').toLocaleUpperCase('hu-HU')}</small><strong>${safe(k.name)}</strong></span><span class="kx-source-chip">${icon(SOURCE_ICON[k.source]||'chat')}${safe(k.source)}</span></div>
 <div class="meal-hero3" style="--block-color:${color}"><span class="mh-glow"></span>
  <div class="mh-left"><span class="mh-art">${icon(art)}</span><div class="mh-kcal">${supp?`<strong class="kx-dose">${safe(k.dose||'—')}</strong><small>adag</small>`:`<strong>${k.kcal100==null?'—':fmt(k.kcal100)}</strong><small>kcal / 100 g</small>`}</div></div>
  <div class="mh-right"><div class="mh-info"><span class="mh-info-art">${icon('stack')}</span><span><strong>A polcodon</strong><small>${safe(k.amount||'mennyiség nincs megadva')}</small></span></div><div class="mh-info" style="--block-color:#8ed2e8"><span class="mh-info-art">${icon(SOURCE_ICON[k.source]||'chat')}</span><span><strong>${SOURCE_LABEL[k.source]||'felvéve'}</strong><small>${added(k.addedDays)||'—'}</small></span></div></div>
 </div>
 ${supp?`<div class="lf-section"><h2>A napodban</h2></div><button class="kx-link-card" data-route="fuel/3">${icon('clock')}<span><strong>${safe(k.timing||'Nincs időzítve')}</strong><small>A Kiegészítők oldalon pipálod — ott látod a protokollt is</small></span><b>›</b></button>`:`<div class="lf-section"><h2>Makrók</h2></div>${k.p100==null?`<p class="block-empty">Ehhez az elemhez még nincs tápérték — a forrás nem adott értéket.</p>`:shareRings(k.p100,k.c100,k.f100,1,'g / 100 g')}
 <div class="lf-section"><h2>Minőség</h2></div><div class="nutri-tiles">${quality.map(([label,v,unit,art,c])=>`<div class="nutri-tile ${v==null?'unknown':''}" style="--nt-color:${c}"><span class="nt-top"><span class="nt-art">${icon(art)}</span><strong>${v==null?'—':label==='Feldolgozottság'?`${v}`:fmt1(v)}<small>${v==null?'':label==='Feldolgozottság'?'NOVA':unit}</small></strong></span><span class="nt-label">${label==='Feldolgozottság'&&v?NOVA_SHORT[v]:label}${label!=='Feldolgozottság'?' · 100 g':''}</span></div>`).join('')}</div>`}
 ${usedIn.length?`<div class="lf-section"><h2>Receptjeidben</h2></div><div class="kx-used">${usedIn.map(r=>`<button style="--kx:${slotBlock(r.slot).color}" data-recipe-open="${r.id}">${icon('bowl')}<span>${safe(r.name)}</span></button>`).join('')}</div>`:''}
 ${supp||k.kcal100==null?'':`<button class="meal-edit kx-primary" data-pantry-log="${k.id}">${icon('bowl')}<span>Ettem belőle — naplózom</span><b>›</b></button>`}
 <div class="kx-actions"><button data-demo-edit="kamraelem">${icon('book')}Szerkesztés</button>${deleteControl('pantry',k.id,'leveszem a polcról')}</div>`;
}
// --- Receptműhely ------------------------------------------------------------
const freshWorkshop=()=>({draft:null,history:[],busy:false,error:null,context:[],flash:[],sourceId:null,seededFrom:null,text:'',picker:null,basis:'serving'});
let wsx=freshWorkshop();
const withContext=message=>wsx.context.length?`${message}\n(Kamrából: ${wsx.context.join(', ')})`:message;
const bubble=m=>m.role==='user'?`<div class="wsx-bubble me"><p>${safe(m.text).replace(/\n/g,'<br>')}</p></div>`:`<div class="wsx-bubble mezo"><span>${icon('score')}</span><p>${safe(m.text)}</p></div>`;
function muhelyPage(id){
 if(id&&wsx.seededFrom!==id){const r=recipes.find(x=>x.id===id);if(r){wsx=freshWorkshop();wsx.draft=draftFromRecipe(r,pantry);wsx.sourceId=id;wsx.seededFrom=id;wsx.history=[{role:'assistant',text:`Betöltöttem: ${r.name}. Mit alakítsunk rajta?`}];}}
 const d=wsx.draft,goal=GOALS.find(g=>g.id===d?.goal);
 const head=`<div class="kx-subhead">${wsx.sourceId?back('Recept',`data-recipe-open="${wsx.sourceId}"`):back('Konyha','data-route="fuel/1"')}<span><small>KONYHA${wsx.sourceId?' · ITERÁLÁS':''}</small><strong>Receptműhely</strong></span></div>`;
 let canvas='';
 if(!d){
  canvas=`<div class="wsx-empty"><span class="wsx-empty-glow"></span><span class="wsx-empty-art">${icon('score')}</span><strong>Mit főzzünk ki?</strong><p>Válassz egy célt, vagy írd le alul a saját szavaiddal. Én hozzávalót és mennyiséget javaslok — a számokat mindig a kamrád adja.</p></div>
  <div class="wsx-goals">${GOALS.map(g=>`<button class="wsx-goal" style="--kx:${g.color}" data-wsx-goal="${g.id}" ${wsx.busy?'disabled':''}><span>${icon(g.art)}</span><strong>${g.label}</strong></button>`).join('')}<button class="wsx-goal" style="--kx:#d9c395" data-wsx-pick-open="context"><span>${icon('stack')}</span><strong>Kamrából indulok</strong></button></div>`;
 }else{
  const totals=draftTotals(d,pantry),per=wsx.basis==='serving'?d.servings:1;
  const nutrition=draftNutrition(d,pantry);
  canvas=`<div class="wsx-name"><input value="${safe(d.name)}" data-wsx-name aria-label="Recept neve" placeholder="Recept neve">${goal?`<span class="wsx-goal-chip" style="--kx:${goal.color}">${icon(goal.art)}${goal.label}</span>`:''}</div>
  <div class="meal-hero3 wsx-hero" style="--block-color:${goal?.color??'#bca6f1'}"><span class="mh-glow"></span>
   <div class="mh-left"><span class="mh-art">${icon('bowl')}</span><div class="mh-kcal"><strong>${fmt(totals.kcal/per)}</strong><small>kcal ${wsx.basis==='serving'?'/ adag':'· egész'}</small></div></div>
   <div class="mh-right"><div class="wsx-stepper"><button data-wsx-servings="-1" aria-label="Kevesebb adag" ${d.servings<=1?'disabled':''}>−</button><span><strong>${d.servings}</strong><small>adag</small></span><button data-wsx-servings="1" aria-label="Több adag" ${d.servings>=12?'disabled':''}>＋</button></div><div class="wsx-basis" role="group" aria-label="Nézet">${[['serving','1 adag'],['total','Egész recept']].map(([v,l])=>`<button data-wsx-basis="${v}" aria-pressed="${wsx.basis===v}">${l}</button>`).join('')}</div></div>
  </div>
  ${totals.unknown?`<p class="nutri-note">${totals.unknown} sorhoz nincs tápérték a kamrában — a számokból kimarad, nem találgatjuk.</p>`:''}
  <div class="lf-section"><h2>Makrók</h2></div>${shareRings(totals.p/per,totals.c/per,totals.f/per)}
  <div class="lf-section"><h2>Hozzávalók</h2></div>
  <div class="ing-list">${d.lines.length?d.lines.map((l,i)=>{const m=lineMacros(l,pantry),[color,art]=ingredientStyle(l.name),est=l.source==='estimate';return `<div class="ing-row wsx-line ${est?'estimate':''} ${wsx.flash.includes(l.key)?'flash':''}" style="--ing-color:${color}"><span class="ing-art">${icon(art)}</span><span class="ing-copy"><strong>${safe(l.name)}</strong><span class="ing-meta">${est?`<em class="est">${icon('score')}becsült sor</em>`:`<em>${icon('stack')}kamra</em>`}</span><span class="wsx-amount"><button data-wsx-amount="${i}|-1" aria-label="${safe(l.name)}: kevesebb">−</button><input type="number" inputmode="decimal" min="0" step="${l.unit==='db'?1:10}" value="${l.amount}" data-wsx-amount-input="${i}" aria-label="${safe(l.name)} mennyisége"><em>${l.unit}</em><button data-wsx-amount="${i}|1" aria-label="${safe(l.name)}: több">＋</button></span>${est?`<span class="wsx-est-actions"><button data-wsx-pick-open="${i}">${icon('stack')}Csere kamraelemre</button><button data-wsx-drop="${i}">Törlés</button></span>`:''}</span><span class="ing-end"><b>${m.known?fmt(m.kcal):'—'}<small>kcal</small></b>${est?'':`<button class="wsx-remove" data-wsx-drop="${i}" aria-label="${safe(l.name)} törlése">×</button>`}</span></div>`;}).join(''):`<p class="block-empty">Nincs hozzávaló — kérj egyet alul, vagy válassz a kamrából.</p>`}</div>
  <div class="lf-section"><h2>Minőség</h2></div>${qualityTilesHtml(nutrition.qualityLines,nutrition.plants)}
  <div class="lf-section"><h2>Mikrotápanyagok</h2></div>${microCardsHtml(nutrition.perServing,wsx.basis==='serving'?1:d.servings)}
  ${d.steps.length?`<details class="wsx-steps"><summary>${icon('book')}<span><strong>Elkészítés</strong><small>${d.steps.length} lépés</small></span><b>⌄</b></summary><ol>${d.steps.map(s=>`<li>${safe(s)}</li>`).join('')}</ol></details>`:''}`;
 }
 const gate=d&&!canSave(d)?`<p class="wsx-gate">${d.lines.some(l=>l.source==='estimate')?'Becsült sor van a vázlatban — cseréld kamraelemre vagy töröld a mentéshez.':'Adj nevet és legalább egy hozzávalót a mentéshez.'}</p>`:'';
 const recent=wsx.history.slice(-1),older=wsx.history.slice(0,-1);
 const dock=`<div class="wsx-dock">
  ${older.length?`<details class="wsx-history"><summary>Beszélgetés · még ${older.length} üzenet</summary>${older.map(bubble).join('')}</details>`:''}
  ${recent.map(bubble).join('')}
  ${wsx.busy?`<div class="wsx-bubble mezo busy" role="status" aria-label="A Műhely gondolkodik"><span>${icon('score')}</span><p><i></i><i></i><i></i></p></div>`:''}
  ${wsx.error?`<div class="wsx-bubble error" role="alert"><span>${icon('chat')}</span><p>A Műhely most nem elérhető — az üzeneted megvan.</p><span class="wsx-error-actions"><button data-wsx-retry>Újra</button><button data-wsx-edit-failed>Átírom</button></span></div>`:''}
  ${d?`<div class="wsx-goal-row">${GOALS.map(g=>`<button data-wsx-goal="${g.id}" style="--kx:${g.color}" aria-pressed="${d.goal===g.id}" ${wsx.busy?'disabled':''}>${icon(g.art)}${g.label}</button>`).join('')}</div>`:''}
  ${wsx.context.length?`<div class="wsx-context">${wsx.context.map(n=>`<button data-wsx-context-drop="${safe(n)}" aria-label="${safe(n)} eltávolítása">${icon('stack')}${safe(n)}<b>×</b></button>`).join('')}</div>`:''}
  <form class="wsx-composer" data-wsx-form><button type="button" data-wsx-pick-open="context" aria-label="Hozzávaló a kamrából">${icon('stack')}</button><input name="msg" data-wsx-text placeholder="${d?'Mit alakítsunk rajta?':'Írd le, mit főznél…'}" value="${safe(wsx.text)}" autocomplete="off" ${wsx.busy?'disabled':''}><button type="submit" aria-label="Küldés" ${wsx.busy?'disabled':''}>›</button></form>
 </div>`;
 const save=d?`<div class="wsx-save">${gate}<button data-wsx-save ${canSave(d)?'':'disabled'}>${icon('book')}<span>${wsx.sourceId?'Recept frissítése':'Mentés a Receptkönyvbe'}</span></button></div>`:'';
 return `${head}${canvas}${save}<p class="wsx-demo">Demó-kulcsszavak: „fehérje”, „könnyebb”, „zöldség” — vagy „hiba” a hibaállapothoz.</p><div class="wsx-spacer" aria-hidden="true"></div>${dock}`;
}
function pickerHtml(){
 const foods=pantry.filter(k=>k.kind==='food'),context=wsx.picker==='context';
 return `<div class="glass-dim" style="--dim-color:#d9c395"><div class="glass-hero dim"><span class="glass-hero-art">${icon('stack')}</span><div><strong>Kamra</strong><small>${context?'Jelöld, mire építsünk — többet is választhatsz':'Válaszd ki, mire cseréljük a becsült sort'}</small></div></div><div class="glass-list">${foods.map(k=>{const [color,art]=ingredientStyle(k.name),picked=context&&wsx.context.includes(k.name);return `<button class="glass-pick ${picked?'picked':''}" data-wsx-pick="${k.id}" style="--stat-color:${color}"><span class="gs-art">${icon(art)}</span><span class="gs-copy"><strong>${safe(k.name)}</strong><small>${k.kcal100!=null?`${fmt(k.kcal100)} kcal · ${fmt1(k.p100)} g fehérje / 100 g`:'nincs tápérték'}</small></span><b>${picked?'✓':'＋'}</b></button>`;}).join('')}</div>${context?'<p class="glass-fact">A jelöltek a következő üzeneteddel mennek a Műhelynek.</p>':''}</div>`;
}
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function runTurn(message,goal){
 if(wsx.busy)return;
 wsx.history.push({role:'user',text:message});wsx.busy=true;wsx.error=null;keepScroll();
 const session=wsx;
 setTimeout(()=>{
  if(session!==wsx)return;
  const res=workshopTurn({draft:wsx.draft,message,goal,context:wsx.context});
  wsx.busy=false;
  if(!res.ok)wsx.error={retryText:message};
  else{wsx.draft=res.draft;wsx.history.push({role:'assistant',text:res.reply});wsx.flash=res.changed;wsx.context=[];react('connect',1500);setTimeout(()=>{if(session===wsx)wsx.flash=[];},2600);}
  if(location.hash.startsWith('#fuel/1/muhely'))keepScroll();
 },reduceMotion()?120:750);
}
function saveWorkshop(){
 const d=wsx.draft;if(!canSave(d))return;
 const totals=draftTotals(d,pantry),goal=GOALS.find(g=>g.id===d.goal);
 const lines=d.lines.map(l=>{const m=lineMacros(l,pantry),item=pantry.find(k=>k.id===l.refId);return [l.name,`${fmt1(l.amount)} ${l.unit}`,m.known?Math.round(m.kcal):null,item?.nova??null];});
 const perServing={kcal:Math.round(totals.kcal/d.servings),p:Math.round(totals.p/d.servings),c:Math.round(totals.c/d.servings),f:Math.round(totals.f/d.servings)};
 const {perServing:micro,plants}=draftNutrition(d,pantry),facts={fiber:micro.fiber,sugar:micro.sugar,salt:micro.salt,satfat:micro.satfat,plants};
 if(wsx.sourceId){const id=wsx.sourceId;updateRecipe(recipes,id,{name:d.name.trim(),servings:d.servings,lines,...perServing,...facts,...(goal?{slot:goal.slot}:{})});wsx=freshWorkshop();toast('Recept frissítve.');location.hash=`#fuel/1/recept/${id}`;}
 else{const saved=addRecipe(recipes,{name:d.name.trim(),slot:goal?.slot??'Ebéd',lines,...perServing});if(saved)Object.assign(saved,facts);wsx=freshWorkshop();toast('Recept mentve a Receptkönyvbe.');location.hash='#fuel/1/receptek';}
}

const workshopSheet=()=>`<h2 class="sheet-title">Recept mentése</h2><button class="kx-link-card" data-workshop-new>${icon('score')}<span><strong>Inkább a Műhelyben rakjuk össze</strong><small>Te mondod a célt, én a hozzávalót</small></span><b>›</b></button><form id="recipe-manual-form"><label class="lf-field">Név<input name="name" required placeholder="Pl. Lencsés curry"></label><label class="lf-field">Kalória / adag<input name="kcal" type="number" min="1" max="3000" required value="610"></label><label class="lf-field">Fehérje (g)<input name="p" type="number" min="0" max="300" required value="31"></label><button class="sheet-action">Mentem a receptet ✓</button></form>`;
const pantrySheet=()=>`<h2 class="sheet-title">Új elem a kamrába</h2><div class="lf-chips" data-pantry-tabs>${[['foto','📷 Fotó'],['link','Link'],['kezi','Kézzel'],['katalogus','Katalógus']].map(([v,l],i)=>`<button data-pantry-tab="${v}" aria-pressed="${i===0}">${l}</button>`).join('')}</div><div data-pantry-pane="foto"><div class="food-finder small"><span></span><span></span><span></span><span></span><p>CÍMKE A KERESŐBEN · DEMÓ</p></div><button class="sheet-action" data-pantry-shot>Exponálás — minta: túró 250 g</button><div id="pantry-photo-result"></div></div><div data-pantry-pane="link" hidden><form id="pantry-link-form"><label class="lf-field">Termék linkje<input name="url" type="url" placeholder="https://…" required></label><button class="sheet-action">Kinyerem az adatokat ✦</button></form><div id="pantry-link-result"></div></div><div data-pantry-pane="kezi" hidden><form id="pantry-manual-form"><label class="lf-field">Név<input name="name" required placeholder="Pl. Mandula"></label><label class="lf-field">Mennyiség<input name="amount" placeholder="Pl. 200 g"></label><label class="lf-field">Típus<select name="kind"><option value="food">Étel</option><option value="supp">Kiegészítő</option></select></label><button class="sheet-action">Felveszem ✓</button></form></div><div data-pantry-pane="katalogus" hidden><div class="konyha-list">${[['Zabpehely','372 kcal / 100 g'],['Mandula','579 kcal / 100 g'],['Skyr','63 kcal / 100 g']].map(([n,s])=>`<button class="konyha-row" data-catalog-add="${safe(n)}">${icon('stack')}<span><strong>${n}</strong><small>${s} · közös katalógus</small></span><b>＋</b></button>`).join('')}</div></div><p class="food-note">Demó: a fotó- és link-kinyerés mintaeredményt ad. Kétszeri hozzáadás nem duplikál.</p>`;

// --- Trendek ----------------------------------------------------------------
const TX_STAT={
 avg:['Napi átlag','bowl','#8ed2e8','kcal','A naplózott napok átlaga. A nem naplózott nap nem nullaként számít, hanem sehogy — ezért marad őszinte a szám.'],
 score:['Étkezés-minőség','score','#bca6f1','','A héten pontozott étkezéseid átlaga. A pontszám mentéskor, determinisztikusan születik, és később sem írja át semmi.'],
 weight:['Heti súlyátlag','person','#d7a7bc','kg','A napi mérések heti átlaga, így egyetlen reggel ingadozása nem visz félre.'],
};
const dayLabel=date=>new Intl.DateTimeFormat('hu-HU',{month:'long',day:'numeric',weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
const overBudget=d=>d.kcal>d.target+60;
function weekBars(w){
 const max=Math.max(2900,...w.days.map(d=>d.kcal||0));
 return `<div class="tx-bars">${w.days.map(d=>{
  const logged=Number.isFinite(d.kcal),height=logged?Math.max(12,Math.round(d.kcal/max*100)):0;
  return `<button class="tx-day ${d.weekend?'weekend':''} ${d.today?'today':''}" data-tx-day="${d.date}" aria-label="${dayLabel(d.date)}: ${logged?`${fmt(d.kcal)} kcal a ${fmt(d.target)} kcal-os keretből, étkezés-pont ${d.score!=null?score1(d.score):'nincs'}`:'nincs naplózva'}"><span class="tx-col"><i class="tx-target" style="--h:${Math.round(d.target/max*100)}%"></i>${logged?`<i class="tx-fill ${overBudget(d)?'over':'within'}" style="--h:${height}%"></i>`:'<i class="tx-gap"></i>'}</span><b class="tx-score">${d.score!=null?score1(d.score):'·'}</b><span class="tx-name">${d.day}</span>${d.training?`<u title="Edzésnap"></u>`:''}</button>`;
 }).join('')}</div>`;
}
function trendek(){
 const w=weekData[week],s=weekSummary(w),cmp=weekCompare(w),deltas=weekDeltas(w,weekData.previous),isCurrent=week==='current';
 const values={avg:s.avg,score:w.scoreAvg,weight:w.weightAvg};
 const read=isCurrent
  ?`${s.logged} naplózott nap, mind a ${s.within} a kereteden belül. A hét többi része még előtted áll — üresen hagyjuk, nem találgatjuk.`
  :cmp.delta>0?`Hétvégén átlagosan ${fmt(cmp.delta)} kcal-lal többet ettél, mint hétköznap. Nem hiba — így alakult, és most már látod.`:'Kiegyensúlyozott hét volt.';
 return `<div class="tx-hero"><span class="tx-glow"></span>
  <div class="tx-weeknav"><button data-week="previous" aria-pressed="${!isCurrent}" ${isCurrent?'':'disabled'}>‹ Múlt hét</button><strong>${w.label}</strong><button data-week="current" aria-pressed="${isCurrent}" ${isCurrent?'disabled':''}>Ez a hét ›</button></div>
  <div class="tx-big"><strong>${s.logged?s.within:'—'}</strong><span><b>/ ${s.logged} naplózott nap</b><small>A KERETEDEN BELÜL</small></span></div>
  ${weekBars(w)}
  <p class="tx-read">${read}</p>
  <p class="tx-hint">A szám a nap étkezés-pontja · koppints a részletekért</p></div>
 <div class="tx-tiles">${Object.entries(TX_STAT).map(([kind,[label,art,color,unit]])=>{const v=values[kind],delta=isCurrent?deltas[kind]:null;
  return `<button class="tx-tile" style="--kx:${color}" data-tx-stat="${kind}"><span class="tx-tile-art">${icon(art)}</span><strong>${v==null?'—':fmt1(v)}${unit?`<small>${unit}</small>`:''}</strong><span class="tx-tile-label">${label}</span>${delta?`<em>${delta>0?'▲':'▼'} ${fmt1(Math.abs(delta))}${unit?` ${unit}`:''}</em>`:''}</button>`;}).join('')}</div>
 <div class="lf-section"><h2>Hétköznap és hétvége</h2></div>
 <div class="tx-split">${cmp.weekday!=null?`<div class="tx-splitrow" style="--kx:#8ed2e8"><span class="tx-split-art">${icon('sun')}</span><span class="tx-split-copy"><strong>Hétköznap</strong><i><b style="--w:${Math.min(100,cmp.weekday/30)}%"></b></i></span><b>${fmt(cmp.weekday)}<small>kcal</small></b></div>`:''}
  ${cmp.weekend!=null?`<div class="tx-splitrow" style="--kx:#d9c395"><span class="tx-split-art">${icon('moon')}</span><span class="tx-split-copy"><strong>Hétvége</strong><i><b style="--w:${Math.min(100,cmp.weekend/30)}%"></b></i></span><b>${fmt(cmp.weekend)}<small>kcal</small></b></div>`:`<p class="tx-empty">${icon('moon')}<span>Ezen a héten még nincs naplózott hétvégi nap — üresen hagyjuk.</span></p>`}
  ${cmp.delta!=null?`<p class="tx-split-note">A különbség <b>${fmt(Math.abs(cmp.delta))} kcal</b> ${cmp.delta>0?'a hétvége javára':'a hétköznapok javára'}.</p>`:''}</div>
 <div class="lf-section"><h2>Hosszabb táv</h2></div>
 <button class="tx-card" data-tx-horizon><span class="tx-card-head"><span class="tx-card-title">${icon('ring')}<strong>Evés és súly együtt</strong></span><b>↗</b></span>${horizonChart()}<span class="tx-legend"><em class="kcal">heti átlag kcal</em><em class="weight">heti súlyátlag</em></span></button>
 <div class="lf-section"><h2>Mintázatok</h2></div>
 ${patterns.map((p,i)=>`<button class="tx-pattern" data-tx-pattern="${i}"><span class="tx-pattern-art">${icon('gem')}</span><span><strong>${safe(p.title)}</strong><small>${safe(p.state)}</small></span><b>↗</b></button>`).join('')}
 <p class="food-note">A mintázatok otthona a Mezo — innen odalépsz, nem másolatot látsz.</p>`;
}
function horizonChart(){
 const ks=longHorizon.map(r=>r.kcal),ws=longHorizon.map(r=>r.weight);
 const kmin=Math.min(...ks)-60,kmax=Math.max(...ks)+60,wmin=Math.min(...ws)-.2,wmax=Math.max(...ws)+.2;
 const x=i=>18+i*300/(longHorizon.length-1),ky=v=>110-(v-kmin)/(kmax-kmin)*80,wy=v=>110-(v-wmin)/(wmax-wmin)*80;
 const kcalPoints=longHorizon.map((r,i)=>`${x(i)},${ky(r.kcal)}`).join(' ');
 return `<svg class="tx-chart" viewBox="0 0 336 150" role="img" aria-label="Heti átlag kalória és heti súlyátlag hét héten át"><defs><linearGradient id="tx-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8ed2e855"/><stop offset="1" stop-color="#8ed2e800"/></linearGradient></defs><path d="M18 34H318M18 72H318M18 110H318" stroke="#ffffff0d"/><polygon points="${kcalPoints} 318,118 18,118" fill="url(#tx-area)"/><polyline points="${kcalPoints}" fill="none" stroke="#8ed2e8" stroke-width="2.6" stroke-linejoin="round"/><polyline points="${longHorizon.map((r,i)=>`${x(i)},${wy(r.weight)}`).join(' ')}" fill="none" stroke="#d7a7bc" stroke-width="2.4" stroke-dasharray="1 6" stroke-linecap="round"/>${longHorizon.map((r,i)=>`<circle cx="${x(i)}" cy="${wy(r.weight)}" r="3" fill="#d7a7bc"/>`).join('')}<text x="18" y="140">${longHorizon[0].week}</text><text x="264" y="140">${longHorizon.at(-1).week}</text></svg>`;
}
function trendDayGlass(date){
 const d=weekData[week].days.find(x=>x.date===date);
 if(!d)return '<p class="sheet-sub">Nincs ilyen nap.</p>';
 const logged=Number.isFinite(d.kcal);
 if(!logged)return `<div class="glass-dim" style="--dim-color:#8ed2e8"><div class="glass-hero dim"><span class="glass-hero-art">${icon('bowl')}</span><div><strong>—</strong><small>${dayLabel(d.date)}</small></div></div><div class="glass-callout"><span>${icon('chat')}</span><p><small>ŐSZINTÉN</small>Ezen a napon nem naplóztál. Nem töltjük ki becsléssel, és a heti átlagból is kimarad.</p></div></div>`;
 const fuelScore=fuelDayScore(d),color=overBudget(d)?'#d9c395':'#8ed2e8';
 const dims=[['nutrition','Táplálkozás','macro','#e08a7c',30],['quality','Minőség','processing','#d9c395',15]];
 const rows=[['Étkezés','bowl',`${d.meals?.length??0} étkezés`],['Fehérje','meat',`${fmt(d.protein)} g`],['Víz','water',`${fmt1(d.water)} l`],['Mozgás','dumbbell',d.training?'edzésnap':'pihenőnap']];
 return `<div class="glass-dim" style="--dim-color:${color}">
 <div class="glass-hero dim"><span class="glass-hero-art">${icon('score')}</span><div><strong>${d.score!=null?score1(d.score):'—'}</strong><small>${dayLabel(d.date)} · étkezés-pont</small></div></div>
 <div class="glass-chips"><span>${fmt(d.kcal)} / ${fmt(d.target)} kcal</span><span>${d.meals?.length??0} étkezés</span>${fuelScore!=null?`<span>napi fuel-érték ${fuelScore}/100</span>`:''}</div>
 <div class="glass-bar dimbar"><i style="--w:${Math.min(100,Math.round(d.kcal/d.target*100))}%"></i></div>
 <p class="glass-fact">A kereted ezen a napon <b>${fmt(d.target)} kcal</b> volt${d.training?' — edzésnapra igazítva':''}. ${overBudget(d)?`${fmt(d.kcal-d.target)} kcal-lal fölé ment; így alakult.`:'Belefértél.'}</p>
 <div class="tx-dims">${dims.map(([id,label,art,dimColor,weight])=>{const dim=d.dims?.[id];const score=dim?.score??null;
  return `<div class="tx-dim ${score==null?'degraded':''}" style="--kx:${dimColor}"><div class="tx-dim-head"><span class="tx-dim-art">${icon(art)}</span><span><strong>${label}</strong><small>a napi értékelés ${weight}%-a</small></span><b>${score==null?'—':score}</b></div>${score!=null?`<i class="tx-dim-bar"><b style="--w:${score}%"></b></i>`:''}<div class="tx-facts">${(dim?.facts??[]).map(([factLabel,value])=>`<span><em>${safe(factLabel)}</em>${safe(value)}</span>`).join('')||'<span class="quiet">nincs elég adat ehhez a szemponthoz</span>'}</div></div>`;}).join('')}</div>
 <div class="lf-section glass-section"><h2>A nap étkezései</h2></div>
 <div class="glass-list">${(d.meals??[]).map(([name,kcal,score])=>`<div class="glass-stat plain" style="--stat-color:${color}"><span class="gs-art">${icon('bowl')}</span><span class="gs-copy"><strong>${safe(name)}</strong><small>${fmt(kcal)} kcal</small></span><b>${icon('score')} ${score1(score)}</b></div>`).join('')}</div>
 <div class="glass-list">${rows.map(([label,art,value])=>`<div class="glass-kv"><span>${label}</span><b>${value}</b></div>`).join('')}</div>
 <p class="food-note">A napi értékelés hat szempontból áll — itt a két étkezéshez tartozó látszik. A többi (edzés, alvás, naplózás, ritmus) az Én oldal napi nézetén él.</p></div>`;
}
function trendStatGlass(kind){
 const [label,art,color,unit,copy]=TX_STAT[kind],w=weekData[week],previous=weekData.previous;
 const pick=source=>({avg:weekSummary(source).avg,score:source.scoreAvg,weight:source.weightAvg}[kind]);
 const now=pick(w),before=pick(previous),delta=now!=null&&before!=null&&week==='current'?Math.round((now-before)*10)/10:null;
 return `<div class="glass-dim" style="--dim-color:${color}"><div class="glass-hero dim"><span class="glass-hero-art">${icon(art)}</span><div><strong>${now==null?'—':fmt1(now)}</strong><small>${label}${unit?` · ${unit}`:''}</small></div></div>
 <p class="glass-lead">${copy}</p>
 <div class="glass-list"><div class="glass-kv"><span>${w.label}</span><b>${now==null?'—':`${fmt1(now)}${unit?` ${unit}`:''}`}</b></div><div class="glass-kv"><span>${previous.label}</span><b>${before==null?'—':`${fmt1(before)}${unit?` ${unit}`:''}`}</b></div>${delta!=null?`<div class="glass-kv"><span>Változás</span><b>${delta>0?'+':''}${fmt1(delta)}${unit?` ${unit}`:''}</b></div>`:''}</div>
 <p class="glass-fact">${kind==='avg'?`Ezen a héten <b>${weekSummary(w).logged} nap</b> van naplózva a hétből.${w.days.some(d=>d.today&&Number.isFinite(d.kcal))?' A mai nap még nyitva van — félkész napként is beleszámít az átlagba.':''}`:kind==='score'?'Az egyes étkezések bontása a Mai oldalon, az AI-értékelésnél nyílik.':'A súly részletes görbéje az Én oldalon él — ott szerkeszthető is.'}</p></div>`;
}
function trendPatternGlass(index){
 const p=patterns[Number(index)];if(!p)return '<p class="sheet-sub">Nincs ilyen mintázat.</p>';
 return `<div class="glass-dim" style="--dim-color:#bca6f1"><div class="glass-hero dim"><span class="glass-hero-art">${icon('gem')}</span><div><strong>${safe(p.state)}</strong><small>${safe(p.title)}</small></div></div>
 <p class="glass-lead">${safe(p.detail)}</p>
 <button class="kx-link-card" data-route="${p.route}">${icon('gem')}<span><strong>Megnézem a Mezo oldalán</strong><small>Ott a teljes bizonyíték és a visszajelzés</small></span><b>›</b></button></div>`;
}
function trendHorizonGlass(){
 return `<div class="glass-dim" style="--dim-color:#8ed2e8"><div class="glass-hero dim"><span class="glass-hero-art">${icon('ring')}</span><div><strong>7 hét</strong><small>Evés és súly együtt</small></div></div>
 <p class="glass-lead">A heti átlagok egymás mellett: a kalória és a súly ugyanazon a héten. Egyik sem ok, csak együttjárás.</p>
 <div class="glass-list">${longHorizon.map(r=>`<div class="glass-kv"><span>${r.week}</span><b>${fmt(r.kcal)} kcal · ${fmt1(r.weight)} kg</b></div>`).join('')}</div></div>`;
}

// --- Kiegészítők ----------------------------------------------------------
function stackPage(){const prog=stackProgress(stack),pct=Math.round(prog.taken/prog.total*100);return `<div class="stack-hero"><div class="stack-ring" style="--stack-progress:${pct}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="stack-ring-track" cx="60" cy="60" r="52" pathLength="100"/><circle class="stack-ring-progress" cx="60" cy="60" r="52" pathLength="100"/></svg><span><strong>${prog.taken}<small> / ${prog.total}</small></strong><b>BEVÉVE MA</b></span></div><div class="stack-hero-copy"><span class="overline">MIT VESZEK BE MA?</span><p>${prog.taken===prog.total?'Minden a helyén. Mára ennyi volt.':'Egy érintés, és pipálva. Ha félrement, még egy érintés visszavonja.'}</p></div></div>${stackZones.map(([zone,label])=>{const rows=stack.items.filter(i=>i.zone===zone);if(!rows.length)return '';return `<div class="lf-section"><h2>${label}</h2><small>${rows.filter(r=>stack.taken.has(r.id)).length} / ${rows.length}</small></div>${rows.map(r=>{const done=stack.taken.has(r.id);return `<button class="stack-row ${done?'done':''}" data-stack-tick="${r.id}" aria-pressed="${done}"><span class="stack-check">${done?'✓':''}</span><span><strong>${safe(r.name)}</strong><small>${safe(r.dose)} · ${safe(r.zoneLabel)}</small></span><b>${done?'VISSZAVONOM':'BEVETTEM'}</b></button>`;}).join('')}`;}).join('')}<div class="lf-section"><h2>Mélyebben</h2></div><button class="konyha-row" data-stack-protocol>${icon('stack')}<span><strong>Protokoll</strong><small>Mit miért szedsz — és ki tette a helyére</small></span><b>↗</b></button><button class="konyha-row" data-stack-manage>${icon('gem')}<span><strong>Kezelés</strong><small>Új elem, adag, időzítés</small></span><b>↗</b></button><button class="konyha-row quiet" data-stack-medication>${icon('moon')}<span><strong>Gyógyszer</strong><small>Most nincs követett gyógyszered</small></span><b>↗</b></button><p class="food-note">Mintaprotokoll. A pipák a demóban élnek, újratöltéskor törlődnek.</p>`;}
const protocolSheet=()=>`<h2 class="sheet-title">A protokollod</h2><p class="sheet-sub">Minden elemnél látod, miért szeded és ki döntött a helyéről.</p>${stack.items.map(r=>`<div class="proto-row">${icon('gem')}<span><strong>${safe(r.name)} · ${safe(r.dose)}</strong><small>${safe(r.zoneLabel)} · ${safe(r.source)}</small><p>${safe(r.why)}</p></span></div>`).join('')}`;
const manageSheet=()=>`<h2 class="sheet-title">Kezelés</h2><p class="sheet-sub">Új elem felvételekor az okos elhelyezés javasol idősávot — te bármikor átteheted.</p><form id="stack-add-form"><label class="lf-field">Mit vennél fel?<input name="name" required placeholder="Pl. Cink"></label><label class="lf-field">Adag<input name="dose" placeholder="Pl. 15 mg"></label><label class="lf-field">Idősáv<select name="zone"><option value="auto" selected>✨ Okos elhelyezés dönti</option>${stackZones.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><button class="sheet-action">Felveszem a protokollba ✓</button></form>`;
const medicationSheet=()=>`${icon('moon')}<h2 class="sheet-title">Gyógyszer</h2><p class="sheet-sub">Most nincs követett gyógyszered — és ezt nem is töltjük ki találgatással. Ha egyszer szükség lesz rá, itt indul: napi ciklus, beadások, emlékeztetők.</p>`;

export function fuelPagesContent(domain,page){if(domain!=='fuel')return null;const [,, view='',itemId='']=location.hash.slice(1).split('/');if(page===1)return view==='receptek'?receptekPage():view==='kamra'?kamraPage():view==='recept'?recipeDetailPage(itemId):view==='elem'?pantryDetailPage(itemId):view==='muhely'?muhelyPage(itemId):konyha();if(page===2)return trendek();if(page===3)return stackPage();return null;}
function keepScroll(){const sc=document.querySelector('#app-scroll'),y=sc.scrollTop;callbacks.refresh();requestAnimationFrame(()=>sc.scrollTo({top:y,behavior:'instant'}));}
export function initFuelPages(options){callbacks=options;
 document.querySelector('#sheet')?.addEventListener('close',e=>e.target.classList.remove('glass'));
 document.addEventListener('click',e=>{const el=e.target.closest('button');if(!el)return;
  if(el.dataset.subroute)location.hash=`#fuel/1/${el.dataset.subroute}`;
  if(el.dataset.score)location.hash=`#fuel/0/score/${el.dataset.score}`;
  if(el.dataset.mealOpen)location.hash=`#fuel/0/meal/${el.dataset.mealOpen}`;
  if(el.hasAttribute('data-energy-detail')){callbacks.dialog('A NAPI KERETED',energyDetailHtml());document.querySelector('#sheet').classList.add('glass');}
  if(el.dataset.dim){const [mealId,dimId]=el.dataset.dim.split('|');callbacks.dialog('AI-ÉRTÉKELÉS · SZEMPONT',dimGlassHtml(mealId,dimId));document.querySelector('#sheet').classList.add('glass');}
  if(el.dataset.scoreFeedback){toast(el.dataset.scoreFeedback==='up'?'Köszönöm — ez segít pontosítani.':'Értem. Ezt a visszajelzést is tanulom.');react('connect',1200);}
  if(el.hasAttribute('data-konyha-recipe'))callbacks.dialog('KONYHA · RECEPT',workshopSheet());
  if(el.hasAttribute('data-konyha-pantry'))callbacks.dialog('KONYHA · KAMRA',pantrySheet());
  if(el.dataset.recipeTab||el.dataset.pantryTab){const kind=el.dataset.recipeTab?'recipe':'pantry',value=el.dataset[kind==='recipe'?'recipeTab':'pantryTab'];document.querySelectorAll(`[data-${kind}-pane]`).forEach(p=>p.hidden=p.dataset[kind==='recipe'?'recipePane':'pantryPane']!==value);document.querySelectorAll(`[data-${kind}-tab]`).forEach(t=>t.setAttribute('aria-pressed',String(t===el)));}
  if(el.hasAttribute('data-workshop-open')){if(wsx.sourceId)wsx=freshWorkshop();location.hash='#fuel/1/muhely';}
  if(el.hasAttribute('data-workshop-new')){callbacks.closeSheet();wsx=freshWorkshop();location.hash='#fuel/1/muhely';}
  if(el.dataset.workshopIterate){wsx=freshWorkshop();location.hash=`#fuel/1/muhely/${el.dataset.workshopIterate}`;}
  if(el.dataset.wsxGoal){const g=GOALS.find(x=>x.id===el.dataset.wsxGoal);runTurn(withContext(wsx.draft?g.message:`Rakjunk össze egy receptet: ${g.label.toLocaleLowerCase('hu-HU')}.`),g.id);}
  if(el.dataset.wsxServings&&wsx.draft){wsx.draft=scaleServings(wsx.draft,wsx.draft.servings+Number(el.dataset.wsxServings));keepScroll();}
  if(el.dataset.wsxBasis){wsx.basis=el.dataset.wsxBasis;keepScroll();}
  if(el.dataset.wsxAmount&&wsx.draft){const [i,dir]=el.dataset.wsxAmount.split('|').map(Number),line=wsx.draft.lines[i];if(line){wsx.draft=setLineAmount(wsx.draft,i,line.amount+dir*(line.unit==='db'?1:10));keepScroll();}}
  if(el.dataset.wsxDrop!==undefined&&wsx.draft){wsx.draft=dropLine(wsx.draft,Number(el.dataset.wsxDrop));keepScroll();}
  if(el.dataset.wsxPickOpen!==undefined){wsx.picker=el.dataset.wsxPickOpen==='context'?'context':Number(el.dataset.wsxPickOpen);callbacks.dialog('RECEPTMŰHELY · KAMRA',pickerHtml());document.querySelector('#sheet').classList.add('glass');}
  if(el.dataset.wsxPick){const item=pantry.find(k=>k.id===el.dataset.wsxPick);if(item){if(wsx.picker==='context'){wsx.context=wsx.context.includes(item.name)?wsx.context.filter(n=>n!==item.name):[...wsx.context,item.name];el.classList.toggle('picked');el.querySelector('b').textContent=wsx.context.includes(item.name)?'✓':'＋';keepScroll();}else if(typeof wsx.picker==='number'&&wsx.draft){wsx.draft=replaceWithPantry(wsx.draft,wsx.picker,item);wsx.flash=[wsx.draft.lines[wsx.picker].key];wsx.picker=null;callbacks.closeSheet();keepScroll();}}}
  if(el.dataset.wsxContextDrop){wsx.context=wsx.context.filter(n=>n!==el.dataset.wsxContextDrop);keepScroll();}
  if(el.hasAttribute('data-wsx-retry')&&wsx.error){const failed=wsx.error.retryText;if(wsx.history.at(-1)?.role==='user')wsx.history.pop();wsx.error=null;runTurn(failed,wsx.draft?.goal??null);}
  if(el.hasAttribute('data-wsx-edit-failed')&&wsx.error){wsx.text=wsx.error.retryText;if(wsx.history.at(-1)?.role==='user')wsx.history.pop();wsx.error=null;keepScroll();}
  if(el.hasAttribute('data-wsx-save'))saveWorkshop();
  if(el.hasAttribute('data-pantry-shot')){const target=document.querySelector('#pantry-photo-result');if(target)target.innerHTML=`<div class="import-preview"><span class="overline">KIOLVASOTT ADATOK · BIZONYTALANSÁGGAL</span><strong>Félzsíros túró · 250 g</strong><small>121 kcal / 100 g · 12 g fehérje · forrás: címkefotó</small><button class="sheet-action" data-pantry-import="Félzsíros túró|250 g|fotó">Felveszem a kamrába ✓</button></div>`;react('connect',2000);}
  if(el.dataset.pantryImport!==undefined&&el.dataset.pantryImport){const [name,amount,src]=el.dataset.pantryImport.split('|');if(pantry.some(p=>p.name===name))toast('Már a polcodon van.');else addPantryItem(pantry,{name,amount,source:src});callbacks.closeSheet();toast(`${name} · a kamrádban`);callbacks.refresh();}
  if(el.dataset.catalogAdd){if(pantry.some(p=>p.name===el.dataset.catalogAdd))toast('Már a polcodon van.');else{addPantryItem(pantry,{name:el.dataset.catalogAdd,amount:'',source:'katalógus'});toast(`${el.dataset.catalogAdd} · a kamrádban`);}callbacks.closeSheet();callbacks.refresh();}
  if(el.dataset.recipeOpen){servings=1;armedDelete=null;callbacks.closeSheet();location.hash=`#fuel/1/recept/${el.dataset.recipeOpen}`;}
  if(el.dataset.pantryOpen){armedDelete=null;location.hash=`#fuel/1/elem/${el.dataset.pantryOpen}`;}
  if(el.dataset.recipeFilter){recipeFilter=el.dataset.recipeFilter;callbacks.refresh();}
  if(el.dataset.pantryFilter){pantryFilter=el.dataset.pantryFilter;callbacks.refresh();}
  if(el.dataset.servings){servings=Number(el.dataset.servings);keepScroll();}
  if(el.dataset.recipeScore){callbacks.dialog('RECEPT · MEZO-ILLESZKEDÉS',recipeScoreGlass(el.dataset.recipeScore));document.querySelector('#sheet').classList.add('glass');}
  if(el.dataset.deleteArm){armedDelete=el.dataset.deleteArm;keepScroll();}
  if(el.hasAttribute('data-delete-cancel')){armedDelete=null;keepScroll();}
  if(el.dataset.deleteConfirm){const [kind,itemId]=el.dataset.deleteConfirm.split(':');armedDelete=null;if(kind==='recipe'){removeRecipe(recipes,itemId);toast('Recept törölve.');location.hash='#fuel/1/receptek';}else{removePantryItem(pantry,itemId);toast('Levéve a polcról.');location.hash='#fuel/1/kamra';}}
  if(el.dataset.demoEdit)toast(`A ${el.dataset.demoEdit}-szerkesztő élesben a meglévő szerkesztőt nyitja — a demóban nem változtat.`);
  if(el.dataset.recipeLog){const r=recipes.find(x=>x.id===el.dataset.recipeLog);if(r){callbacks.closeSheet();openFoodFixed(r.name,{kcal:r.kcal*servings,p:r.p*servings,c:r.c*servings,f:r.f*servings,fiber:(r.fiber??5)*servings},slotBlock(r.slot).time);}}
  if(el.dataset.pantryLog){const k=pantry.find(x=>x.id===el.dataset.pantryLog);if(k){callbacks.closeSheet();openFoodFixed(k.name,{kcal:Math.round(k.kcal100*1.5),p:Math.round((k.p100||0)*1.5),c:Math.round((k.c100||0)*1.5),f:Math.round((k.f100||0)*1.5),fiber:1},'16:00');}}
  if(el.dataset.week){week=el.dataset.week;callbacks.refresh();}
  if(el.dataset.txDay){callbacks.dialog('TRENDEK · NAP',trendDayGlass(el.dataset.txDay));document.querySelector('#sheet').classList.add('glass');}
  if(el.dataset.txStat){callbacks.dialog('TRENDEK · MUTATÓ',trendStatGlass(el.dataset.txStat));document.querySelector('#sheet').classList.add('glass');}
  if(el.dataset.txPattern){callbacks.dialog('TRENDEK · MINTÁZAT',trendPatternGlass(el.dataset.txPattern));document.querySelector('#sheet').classList.add('glass');}
  if(el.hasAttribute('data-tx-horizon')){callbacks.dialog('TRENDEK · HOSSZABB TÁV',trendHorizonGlass());document.querySelector('#sheet').classList.add('glass');}
  if(el.dataset.stackTick){const taken=toggleIntake(stack,el.dataset.stackTick);if(taken!==null){toast(taken?'Bevéve. Még egy érintés visszavonja.':'Visszavonva.');react('connect',1200);callbacks.refresh();}}
  if(el.hasAttribute('data-stack-protocol'))callbacks.dialog('KIEGÉSZÍTŐK',protocolSheet());
  if(el.hasAttribute('data-stack-manage'))callbacks.dialog('KIEGÉSZÍTŐK',manageSheet());
  if(el.hasAttribute('data-stack-medication'))callbacks.dialog('KIEGÉSZÍTŐK',medicationSheet());
 });
 document.addEventListener('submit',e=>{const data=new FormData(e.target);
  if(e.target.matches('[data-wsx-form]')){e.preventDefault();const msg=String(data.get('msg')||'').trim();if(!msg||wsx.busy)return;wsx.text='';runTurn(withContext(msg),wsx.draft?.goal??null);return;}
  if(e.target.id==='recipe-manual-form'){e.preventDefault();const saved=addRecipe(recipes,{name:String(data.get('name')).trim(),kcal:Number(data.get('kcal')),p:Number(data.get('p'))});callbacks.closeSheet();toast(saved?`Recept mentve: ${saved.name}`:'Nézd meg a név és a számok mezőit.');callbacks.refresh();}
  if(e.target.id==='pantry-link-form'){e.preventDefault();const target=document.querySelector('#pantry-link-result');if(target)target.innerHTML=`<div class="import-preview"><span class="overline">KINYERT ADATOK · ELŐNÉZET</span><strong>Földimogyoró-krém · 350 g</strong><small>588 kcal / 100 g · 25 g fehérje · forrás: link</small><button class="sheet-action" data-pantry-import="Földimogyoró-krém|350 g|link">Felveszem a kamrába ✓</button></div>`;react('connect',2000);}
  if(e.target.id==='stack-add-form'){e.preventDefault();const zoneChoice=String(data.get('zone')),auto=zoneChoice==='auto',zone=auto?'este':zoneChoice,zoneLabel=Object.fromEntries(stackZones)[zone];const item=addStackItem(stack,{name:String(data.get('name')).trim(),dose:String(data.get('dose')).trim(),zone,zoneLabel});callbacks.closeSheet();toast(item?`${item.name} · ${auto?'az okos elhelyezés estére tette':zoneLabel.toLocaleLowerCase('hu')}`:'Add meg a nevét.');callbacks.refresh();}
 });
 document.addEventListener('input',e=>{if(e.target.matches('[data-wsx-name]')&&wsx.draft){wsx.draft.name=e.target.value;const save=document.querySelector('[data-wsx-save]');if(save)save.disabled=!canSave(wsx.draft);return;}if(e.target.matches('[data-wsx-text]'))wsx.text=e.target.value;});
 document.addEventListener('change',e=>{if(!e.target.matches('[data-wsx-amount-input]')||!wsx.draft)return;wsx.draft=setLineAmount(wsx.draft,Number(e.target.dataset.wsxAmountInput),e.target.value);keepScroll();});
 document.addEventListener('input',e=>{if(!e.target.matches('[data-pantry-search]'))return;const q=e.target.value.trim().toLocaleLowerCase('hu-HU');let shown=0;document.querySelectorAll('.kx-item').forEach(t=>{const hit=!q||t.dataset.name.includes(q);t.hidden=!hit;if(hit)shown++;});const empty=document.querySelector('.kx-search-empty');if(empty)empty.hidden=shown>0;});
 document.querySelector('#restart')?.addEventListener('click',()=>{recipes=createRecipes();pantry=createPantry();stack=createStack();week='current';recipeFilter='Mind';pantryFilter='Mind';servings=1;armedDelete=null;wsx=freshWorkshop();});
}
