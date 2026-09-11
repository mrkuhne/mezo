// Fuel demo state for Konyha, Trendek and Kiegészítők. Sample data only, no persistence.
let serial=0;
const id=prefix=>`${prefix}-${++serial}`;

// --- Konyha: recipes -------------------------------------------------------
export function createRecipes(){return [
 {id:'r-rizstal',name:'Csirkés rizstál',slot:'Ebéd',kcal:760,p:52,fit:8.4,servings:1,mins:25,lines:['Csirkemell 180 g','Rizs 90 g','Zöldségek 150 g'],note:'A heted leggyakoribb ebédje.'},
 {id:'r-zabkasa',name:'Joghurtos zabkása',slot:'Reggeli',kcal:420,p:28,fit:8.9,servings:1,mins:10,lines:['Zabpehely 60 g','Görög joghurt 150 g','Gyümölcs 80 g'],note:'Gyors, fehérjében erős reggeli.'},
 {id:'r-tortilla',name:'Tojásos tortilla',slot:'Vacsora',kcal:750,p:38,fit:7.6,servings:2,mins:20,lines:['Tojás 3 db','Tortilla 2 db','Sajt 40 g'],note:'Két adag: marad holnapra is.'},
]}
export function addRecipe(recipes,{name,slot='Ebéd',kcal,p,lines=[]}){if(!name||!Number.isFinite(kcal)||kcal<=0||!Number.isFinite(p)||p<0)return null;const recipe={id:id('r'),name,slot,kcal,p,fit:null,servings:1,mins:null,lines,note:'Új recept · a pontszáma még számolódik.'};recipes.unshift(recipe);return recipe;}

// --- Konyha: pantry --------------------------------------------------------
export function createPantry(){return [
 {id:'k-joghurt',name:'Görög joghurt',kind:'food',amount:'2 pohár',kcal100:97,p100:9,source:'katalógus'},
 {id:'k-banan',name:'Banán',kind:'food',amount:'3 darab',kcal100:89,p100:1.1,source:'kézi'},
 {id:'k-zab',name:'Zabpehely',kind:'food',amount:'500 g',kcal100:372,p100:13.5,source:'katalógus'},
 {id:'k-csirke',name:'Csirkemell',kind:'food',amount:'600 g',kcal100:120,p100:22.5,source:'fotó'},
 {id:'k-rizs',name:'Jázmin rizs',kind:'food',amount:'1 kg',kcal100:356,p100:7,source:'link'},
 {id:'k-tojas',name:'Tojás',kind:'food',amount:'10 db',kcal100:143,p100:12.6,source:'kézi'},
 {id:'k-d3',name:'D3-vitamin',kind:'supp',amount:'90 kapszula',dose:'4000 NE',source:'katalógus'},
 {id:'k-kreatin',name:'Kreatin-monohidrát',kind:'supp',amount:'300 g',dose:'5 g',source:'link'},
 {id:'k-magnezium',name:'Magnézium-biszglicinát',kind:'supp',amount:'120 kapszula',dose:'200 mg',source:'katalógus'},
 {id:'k-omega',name:'Omega-3',kind:'supp',amount:'60 kapszula',dose:'1000 mg',source:'kézi'},
]}
export function addPantryItem(pantry,{name,kind='food',amount='',source='kézi'}){if(!name)return null;const item={id:id('k'),name,kind,amount,source};pantry.unshift(item);return item;}
export function removePantryItem(pantry,itemId){const index=pantry.findIndex(i=>i.id===itemId);if(index<0)return false;pantry.splice(index,1);return true;}

// --- Kiegészítők: protocol + intakes --------------------------------------
export function createStack(){return {
 items:[
  {id:'s-d3',name:'D3-vitamin',dose:'4000 NE',zone:'reggel',zoneLabel:'Reggelivel',why:'A téli félévben mért alacsony szint miatt.',source:'saját döntés'},
  {id:'s-omega',name:'Omega-3',dose:'1000 mg',zone:'reggel',zoneLabel:'Reggelivel',why:'Zsírsav-egyensúly; étkezéssel szívódik jól.',source:'okos elhelyezés'},
  {id:'s-kreatin',name:'Kreatin',dose:'5 g',zone:'delben',zoneLabel:'Ebéd után',why:'Erőépítés; a napszak mindegy, a rendszeresség számít.',source:'okos elhelyezés'},
  {id:'s-magnezium',name:'Magnézium',dose:'200 mg',zone:'este',zoneLabel:'Vacsorával',why:'Esti lecsendesedés és alvásminőség.',source:'saját döntés'},
 ],
 taken:new Set(['s-d3','s-omega']),
}}
export function toggleIntake(stack,itemId){if(!stack.items.some(i=>i.id===itemId))return null;if(stack.taken.has(itemId)){stack.taken.delete(itemId);return false;}stack.taken.add(itemId);return true;}
export const stackProgress=stack=>({taken:stack.taken.size,total:stack.items.length});
export function addStackItem(stack,{name,dose='',zone='reggel',zoneLabel='Reggelivel'}){if(!name)return null;const item={id:id('s'),name,dose,zone,zoneLabel,why:'Új elem · az okos elhelyezés tette a helyére.',source:'okos elhelyezés'};stack.items.push(item);return item;}
export const stackZones=[['reggel','Reggel'],['delben','Délben'],['este','Este']];

// --- Trendek: weekly picture + long horizon --------------------------------
// Adherence-neutral: within/over are states, never shame. kcal null = unlogged day (honest gap).
export const weekData={
 current:{label:'Ez a hét',days:[
  {day:'H',date:'2026-09-07',kcal:2115,target:2400,training:true},
  {day:'K',date:'2026-09-08',kcal:2260,target:2400,training:true},
  {day:'Sze',date:'2026-09-09',kcal:1180,target:2400,training:true,today:true},
  {day:'Cs',date:'2026-09-10',kcal:null,target:2400},
  {day:'P',date:'2026-09-11',kcal:null,target:2200},
  {day:'Szo',date:'2026-09-12',kcal:null,target:2200,weekend:true},
  {day:'V',date:'2026-09-13',kcal:null,target:2200,weekend:true},
 ],scoreAvg:7.8,weightAvg:81.3},
 previous:{label:'Múlt hét',days:[
  {day:'H',date:'2026-08-31',kcal:2350,target:2400,training:true},
  {day:'K',date:'2026-09-01',kcal:2180,target:2400,training:true},
  {day:'Sze',date:'2026-09-02',kcal:2490,target:2400},
  {day:'Cs',date:'2026-09-03',kcal:2210,target:2400,training:true},
  {day:'P',date:'2026-09-04',kcal:2050,target:2200},
  {day:'Szo',date:'2026-09-05',kcal:2740,target:2200,weekend:true},
  {day:'V',date:'2026-09-06',kcal:2520,target:2200,weekend:true},
 ],scoreAvg:7.2,weightAvg:81.6},
};
export function weekSummary(week){const logged=week.days.filter(d=>Number.isFinite(d.kcal));if(!logged.length)return {logged:0,within:0,avg:null,weekendDelta:null};
 const within=logged.filter(d=>d.kcal<=d.target+60).length,avg=Math.round(logged.reduce((s,d)=>s+d.kcal,0)/logged.length);
 const weekend=logged.filter(d=>d.weekend),weekday=logged.filter(d=>!d.weekend);
 const mean=rows=>rows.length?rows.reduce((s,d)=>s+d.kcal,0)/rows.length:null;
 const weekendDelta=mean(weekend)!=null&&mean(weekday)!=null?Math.round(mean(weekend)-mean(weekday)):null;
 return {logged:logged.length,within,avg,weekendDelta};}
export const longHorizon=[
 {week:'júl 27.',kcal:2380,weight:82.4},{week:'aug 3.',kcal:2310,weight:82.1},{week:'aug 10.',kcal:2405,weight:82.2},
 {week:'aug 17.',kcal:2290,weight:81.9},{week:'aug 24.',kcal:2240,weight:81.7},{week:'aug 31.',kcal:2360,weight:81.6},
 {week:'szept 7.',kcal:2185,weight:81.3},
];
export const patterns=[
 {title:'Edzésnapokon kevesebb fehérje jut estére',state:'megfigyelés alatt',route:'mezo/0'},
 {title:'A hétvégi vacsorák viszik el a keret nagyját',state:'megerősítetted',route:'mezo/0'},
];
