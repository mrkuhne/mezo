import { fuelOverview, mealInfo } from './food.js';
import { mealBlocks, blockFor } from './food-state.js';
import { icon, safe } from './nap.js';

const fmt=value=>Math.round(value).toLocaleString('hu-HU');
const score1=v=>Number(v).toLocaleString('hu-HU',{minimumFractionDigits:1,maximumFractionDigits:1});
const ring=(name,value,target,color)=>`<div class="fuel-ring" style="--macro-color:${color};--ring-progress:${Math.min(100,value/target*100)}"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="fuel-ring-track" cx="40" cy="40" r="34" pathLength="100"/><circle class="fuel-ring-progress" cx="40" cy="40" r="34" pathLength="100"/></svg><span><small>${name}</small><strong data-fuel-count="${value}">0</strong><b>/ ${target} g</b></span></div>`;

export function animateFuelDashboard(root=document){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 root.querySelectorAll('[data-fuel-count]').forEach(element=>{
  const target=Number(element.dataset.fuelCount);
  if(reduce||!Number.isFinite(target)){element.textContent=fmt(target||0);return;}
  const started=performance.now(),duration=950;
  const frame=now=>{const progress=Math.min(1,(now-started)/duration),eased=1-(1-progress)**3;element.textContent=fmt(target*eased);if(progress<1&&element.isConnected)requestAnimationFrame(frame);};
  requestAnimationFrame(frame);
 });
}

const scoreChip=m=>m.score==null?`<span class="score-chip pending">${icon('score')}<b>folyamatban</b></span>`:`<button class="score-chip" data-score="${m.id}" aria-label="AI-értékelés: ${score1(m.score)}">${icon('score')}<b>${score1(m.score)}</b></button>`;
const mealRow=m=>`<div class="block-meal"><button class="block-meal-main" ${m.editable?`data-food-edit="${m.id}"`:''}><span class="meal-time">${m.time}</span>${icon('bowl')}<span><strong>${safe(m.name)}</strong><small>${m.editable?`${safe(m.hint)} · ✎`:'mintaelőzmény'}</small></span><b>${fmt(m.kcal)}<small>kcal</small></b></button>${scoreChip(m)}</div>`;

function blocksSection({current,meals}){
 return mealBlocks.map(block=>{
  const rows=meals.filter(m=>blockFor(m.time)===block.key);
  const logged=rows.reduce((s,m)=>s+m.kcal,0);
  return `<section class="meal-block" aria-label="${block.label}"><div class="block-head"><span><strong>${block.label}</strong><small>${block.time} · keret kb. ${fmt(block.budget)} kcal</small></span><b>${rows.length?`${fmt(logged)} kcal`:''}</b></div>${rows.map(mealRow).join('')}${!rows.length&&current?`<button class="block-log" data-food-block="${block.time}">＋ Logolás ide<small>kamera · hang · szokásosak</small></button>`:!rows.length?`<p class="block-empty">Ezen a napon üresen maradt.</p>`:''}</section>`;
 }).join('');
}

function scorePage(id){
 const m=mealInfo(id);
 if(!m)return `<div class="score-head"><button data-route="fuel/0" aria-label="Vissza a Mai oldalra">‹</button><span><small>AI-ÉRTÉKELÉS</small><strong>Nincs meg ez az étkezés</strong></span></div>`;
 const base=m.score??7.4;
 const dims=[['Makró-egyensúly',.4,'A fehérje–szénhidrát–zsír arány a célodhoz képest.'],
  ['Feldolgozottság',.9,'Minél közelebb az alapanyagokhoz, annál jobb.'],
  ['Fehérje-időzítés',-.3,'Mennyi fehérje jutott erre a napszakra.'],
  ['Zsírminőség',.1,'Telített és telítetlen zsírok aránya.'],
  ['Mikrotápanyagok',-.6,'Vitamin- és ásványianyag-sűrűség.'],
  ['Növényi változatosság',-.2,'Hányféle növény került a tányérra.'],
  ['Energiasűrűség',.5,'Mennyire laktató a kalóriájához képest.'],
  ['Napi kontextus',.3,'Hogyan illeszkedik az addigi napodhoz.']]
  .map(([label,delta,copy])=>({label,copy,value:Math.min(10,Math.max(3,base+delta))}));
 const verdict=base>=8?'Erős választás volt. A fehérje és a feldolgozottság viszi a hátán — ezt nyugodtan ismételd.':base>=7?'Rendben lévő étkezés. Egy marék zöldség vagy gyümölcs mellé, és a mikrotápanyag-sor is felzárkózik.':'Belefér. A nap egészében nézzük — egyetlen étkezés sosem ítélet.';
 return `<div class="score-head"><button data-route="fuel/0" aria-label="Vissza a Mai oldalra">‹</button><span><small>AI-ÉRTÉKELÉS${m.history?' · KORÁBBI NAP':''}</small><strong>${safe(m.name)}</strong></span><b>${m.time} · ${fmt(m.kcal)} kcal</b></div>
 <div class="score-hero"><span class="score-hero-art">${icon('score')}</span><div><strong>${score1(base)}</strong><small>/ 10</small></div><p>${verdict}</p></div>
 <div class="lf-section"><h2>Miből áll össze?</h2><small>8 SZEMPONT</small></div>
 <div class="score-dims">${dims.map(d=>`<div class="score-dim"><span><strong>${d.label}</strong><small>${d.copy}</small></span><i style="--v:${d.value*10}%"><b>${score1(d.value)}</b></i></div>`).join('')}</div>
 <div class="score-feedback"><span class="overline">TALÁLT AZ ÉRTÉKELÉS?</span><button data-score-feedback="up">Talál ✓</button><button data-score-feedback="down">Nem talál</button></div>
 <p class="food-note">Mintaértékelés előre megírt szöveggel. A pontszámot mentéskor számoljuk, a magyarázat később sem írja át.</p>`;
}

export function fuelDashboardContent(domain,page,date){
 if(domain!=='fuel'||page!==0)return null;
 const segments=location.hash.slice(1).split('/');
 if(segments[2]==='score')return scorePage(segments[3]||'');
 const overview=fuelOverview(date);
 const {current,record,values,remaining}=overview;
 const main=current?Math.abs(remaining):values.kcal;
 const mainLabel=current?(remaining>=0?'KCAL MARADT':'KCAL TÖBBLET'):(record?'KCAL BEVITT':'NINCS ADAT');
 const progress=Math.min(100,values.kcal/2400*100);
 return `<section class="fuel-focus" aria-label="Napi energiakeret"><div class="fuel-visual"><div class="fuel-gauge" style="--fuel-progress:${progress}"><svg class="fuel-gauge-rings" viewBox="0 0 160 160" aria-hidden="true"><circle class="fuel-gauge-base" cx="80" cy="80" r="69" pathLength="100"/><circle class="fuel-gauge-progress" cx="80" cy="80" r="69" pathLength="100"/></svg><span class="fuel-gauge-art">${icon('bowl')}</span></div><div class="fuel-primary-number"><small>${mainLabel}</small><strong data-fuel-count="${main}">0</strong><span>${current?'kcal':'/ 2 400 kcal'}</span></div></div><div class="fuel-equation" aria-label="Keretszámítás"><span><strong>2 400</strong><small>KERET</small></span><b>−</b><span><strong>${fmt(values.kcal)}</strong><small>ÉTEL</small></span><b>+</b><span><strong>0</strong><small>MOZGÁS</small></span></div></section><section class="fuel-rings" aria-label="Makrók és rost">${ring('Fehérje',values.p,160,'#bca6f1')}${ring('Szénhidrát',values.c,270,'#d9c395')}${ring('Zsír',values.f,76,'#8ed2e8')}${ring('Rost',values.fiber,30,'#c8e895')}</section><div class="food-list-heading"><h2>${current?'A mai blokkjaid':'Ezen a napon'}</h2><span>${overview.mealCount} ÉTKEZÉS</span></div>${current||record?blocksSection(overview):`<div class="food-day-empty flat">${icon('bowl')}<strong>Nincs étkezés.</strong></div>`}<button class="fuel-log-action" ${current?'data-food':'data-day-today'}><span class="fuel-log-icon">${icon('chat')}</span><span><strong>${current?'Étkezés logolása':'Vissza a mai naphoz'}</strong><small>${current?'Kamera · hang · gépelés · szokásosak':'Logolni mindig a mai naphoz tudsz'}</small></span><b>${current?'＋':'→'}</b></button><details class="fuel-more flat"><summary>További részletek <span>KERET · MOZGÁS · RECEPTEK</span></summary><button class="fuel-secondary" data-food-budget>${icon('ring')}<span><strong>Keretszámítás</strong></span><b>↗</b></button>${record||current?`<button class="fuel-secondary" data-route="train/0">${icon('dumbbell')}<span><strong>${current?'Felsőtest A':record.training}</strong></span><b>↗</b></button>`:''}<button class="fuel-secondary" data-route="fuel/1">${icon('bowl')}<span><strong>Konyha</strong></span><b>↗</b></button></details>`;
}
