import { fuelOverview } from './food.js';
import { icon } from './nap.js';

const fmt=value=>Math.round(value).toLocaleString('hu-HU');
const macro=(name,value,target,color)=>`<div class="fuel-meter" style="--macro-color:${color};--macro-progress:${Math.min(100,value/target*100)}%"><span><small>${name}</small><strong>${fmt(value)}<b> / ${target} g</b></strong></span><i><b></b></i></div>`;

export function fuelDashboardContent(domain,page,date){
 if(domain!=='fuel'||page!==0)return null;
 const {current,record,values,remaining,mealCount,entries}=fuelOverview(date);
 const main=current?Math.abs(remaining):values.kcal;
 const mainLabel=current?(remaining>=0?'KCAL MARADT':'KCAL TÖBBLET'):(record?'KCAL BEVITT':'NINCS ADAT');
 const progress=Math.min(100,values.kcal/2400*100);
 return `<section class="fuel-focus" aria-label="Napi energiakeret"><div class="fuel-visual"><div class="fuel-gauge" style="--fuel-progress:${progress}%"><span class="fuel-gauge-track"></span><span class="fuel-gauge-art">${icon('bowl')}</span></div><div class="fuel-primary-number"><small>${mainLabel}</small><strong>${fmt(main)}</strong><span>${current?'kcal':'/ 2 400 kcal'}</span></div></div><div class="fuel-equation" aria-label="Keretszámítás"><span><strong>2 400</strong><small>KERET</small></span><b>−</b><span><strong>${fmt(values.kcal)}</strong><small>ÉTEL</small></span><b>+</b><span><strong>0</strong><small>MOZGÁS</small></span></div></section><section class="fuel-meters" aria-label="Makrók">${macro('Fehérje',values.p,160,'#bca6f1')}${macro('Szénhidrát',values.c,270,'#d9c395')}${macro('Zsír',values.f,76,'#8ed2e8')}</section><button class="fuel-log-action" ${current?'data-food':'data-day-today'}><span class="fuel-log-icon">${icon('chat')}</span><span><strong>${current?'Étkezés logolása':'Vissza a mai naphoz'}</strong><small>${current?'Mondd vagy írd be':'Logolni mindig a mai naphoz tudsz'}</small></span><b>${current?'＋':'→'}</b></button><div class="food-list-heading"><h2>${current?'Ma':'Ezen a napon'}</h2><span>${mealCount} ÉTKEZÉS</span></div><div class="food-timeline flat">${entries||`<div class="food-day-empty flat">${icon('bowl')}<strong>Nincs étkezés.</strong></div>`}</div><details class="fuel-more flat"><summary>További részletek <span>KERET · MOZGÁS · RECEPTEK</span></summary><button class="fuel-secondary" data-food-budget>${icon('ring')}<span><strong>Keretszámítás</strong></span><b>↗</b></button>${record||current?`<button class="fuel-secondary" data-route="train/0">${icon('dumbbell')}<span><strong>${current?'Felsőtest A':record.training}</strong></span><b>↗</b></button>`:''}<button class="fuel-secondary" data-route="fuel/1">${icon('bowl')}<span><strong>Receptek</strong></span><b>↗</b></button></details>`;
}
