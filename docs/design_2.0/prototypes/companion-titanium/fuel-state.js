// Fuel demo state for Konyha, Trendek and Kiegészítők. Sample data only, no persistence.
let serial=0;
const id=prefix=>`${prefix}-${++serial}`;

// --- Konyha: recipes -------------------------------------------------------
// Lines: [name, amount, kcal, NOVA group]. eaten/lastEaten mirror the recipe-logs read.
export function createRecipes(){return [
 {id:'r-rizstal',name:'Csirkés rizstál',slot:'Ebéd',kcal:760,p:52,c:78,f:24,fiber:9,sugar:4.8,salt:1.1,satfat:3.4,plants:4,fit:8.4,servings:1,mins:25,eaten:4,lastEaten:'tegnap',lines:[['Csirkemell','180 g',216,1],['Jázmin rizs','90 g (száraz)',320,1],['Zöldségkeverék','150 g',66,1],['Olívaolaj','10 g',88,2]],note:'A heted leggyakoribb ebédje — fehérjében erős, tiszta alapanyagokból.'},
 {id:'r-zabkasa',name:'Joghurtos zabkása',slot:'Reggeli',kcal:420,p:28,c:56,f:10,fiber:7,sugar:11.2,salt:.2,satfat:3.1,plants:3,fit:8.9,servings:1,mins:10,eaten:5,lastEaten:'ma',lines:[['Zabpehely','60 g',223,1],['Görög joghurt','150 g',146,1],['Erdei gyümölcs','80 g',51,1]],note:'Gyors, fehérjében erős reggeli, sok rosttal.'},
 {id:'r-tortilla',name:'Tojásos tortilla',slot:'Vacsora',kcal:750,p:38,c:52,f:34,fiber:6,sugar:null,salt:null,satfat:12.4,plants:1,fit:7.1,servings:2,mins:20,eaten:2,lastEaten:'3 napja',lines:[['Tojás','3 db',215,1],['Tortilla lap','2 db',290,4],['Sajt','40 g',161,3],['Paprika','80 g',26,1]],note:'Két adag: marad holnapra is. A tortillalap ultra-feldolgozott — teljes kiőrlésűvel feljebb menne.'},
 {id:'r-lazac',name:'Lazacos rizstál',slot:'Ebéd',kcal:735,p:48,c:68,f:22,fiber:5,sugar:2.1,salt:.9,satfat:2.8,plants:2,fit:8.7,servings:1,mins:30,eaten:1,lastEaten:'4 napja',lines:[['Lazacfilé','160 g',330,1],['Jázmin rizs','80 g (száraz)',285,1],['Brokkoli','120 g',41,1]],note:'Omega-3-ban gazdag ebéd, kevés feldolgozott összetevővel.'},
 {id:'r-skyr',name:'Banán és skyr',slot:'Uzsonna',kcal:310,p:24,c:44,f:3,fiber:4,sugar:22.4,salt:.15,satfat:.3,plants:2,fit:8.0,servings:1,mins:3,eaten:3,lastEaten:'2 napja',lines:[['Skyr','150 g',95,1],['Banán','120 g',107,1],['Méz','10 g',30,2]],note:'Edzés előtti gyors energia, könnyű fehérjével.'},
]}
export function addRecipe(recipes,{name,slot='Ebéd',kcal,p,c,f,lines=[]}){if(!name||!Number.isFinite(kcal)||kcal<=0||!Number.isFinite(p)||p<0)return null;const recipe={id:id('r'),name,slot,kcal,p,c:Number.isFinite(c)?c:Math.round(kcal*.45/4),f:Number.isFinite(f)?f:Math.round(kcal*.3/9),fiber:null,sugar:null,salt:null,satfat:null,plants:null,fit:null,servings:1,mins:null,eaten:0,lastEaten:null,lines:lines.map(l=>typeof l==='string'?[l,'',null,1]:l),note:'Új recept · a pontszáma még számolódik.'};recipes.unshift(recipe);return recipe;}
export function updateRecipe(recipes,recipeId,patch){const recipe=recipes.find(r=>r.id===recipeId);if(!recipe)return null;Object.assign(recipe,patch);return recipe;}
export function removeRecipe(recipes,recipeId){const index=recipes.findIndex(r=>r.id===recipeId);if(index<0)return false;recipes.splice(index,1);return true;}

// --- Konyha: pantry --------------------------------------------------------
// Per-100 g facts are the stored definition; null = the source had no value. addedDays feeds the imports feed.
export function createPantry(){return [
 {id:'k-csirke',name:'Csirkemell',kind:'food',category:'Hús',amount:'600 g',source:'fotó',addedDays:1,kcal100:120,p100:22.5,c100:0,f100:2.6,fiber100:0,sugar100:0,salt100:.2,satfat100:.7,nova:1},
 {id:'k-rizs',name:'Jázmin rizs',kind:'food',category:'Gabona',amount:'1 kg',source:'link',addedDays:2,kcal100:356,p100:7,c100:79,f100:.6,fiber100:1.3,sugar100:.1,salt100:0,satfat100:.2,nova:1},
 {id:'k-joghurt',name:'Görög joghurt',kind:'food',category:'Tejtermék',amount:'2 pohár',source:'katalógus',addedDays:4,kcal100:97,p100:9,c100:4,f100:5,fiber100:0,sugar100:3.8,salt100:.11,satfat100:3.2,nova:1},
 {id:'k-banan',name:'Banán',kind:'food',category:'Gyümölcs',amount:'3 darab',source:'kézi',addedDays:5,kcal100:89,p100:1.1,c100:22.8,f100:.3,fiber100:2.6,sugar100:12.2,salt100:0,satfat100:.1,nova:1},
 {id:'k-zab',name:'Zabpehely',kind:'food',category:'Gabona',amount:'500 g',source:'katalógus',addedDays:9,kcal100:372,p100:13.5,c100:58.7,f100:7,fiber100:10.6,sugar100:1,salt100:.01,satfat100:1.3,nova:1},
 {id:'k-tojas',name:'Tojás',kind:'food',category:'Tojás',amount:'10 db',source:'kézi',addedDays:6,kcal100:143,p100:12.6,c100:.7,f100:9.5,fiber100:0,sugar100:.4,salt100:.36,satfat100:3.1,nova:1},
 {id:'k-tortilla',name:'Tortilla lap',kind:'food',category:'Pékáru',amount:'6 db',source:'fotó',addedDays:3,kcal100:310,p100:8.5,c100:50,f100:7.5,fiber100:null,sugar100:null,salt100:null,satfat100:3,nova:4},
 {id:'k-d3',name:'D3-vitamin',kind:'supp',category:'Vitamin',amount:'90 kapszula',source:'katalógus',addedDays:20,dose:'4000 NE',timing:'Reggelivel'},
 {id:'k-kreatin',name:'Kreatin-monohidrát',kind:'supp',category:'Teljesítmény',amount:'300 g',source:'link',addedDays:12,dose:'5 g',timing:'Ebéd után'},
 {id:'k-magnezium',name:'Magnézium-biszglicinát',kind:'supp',category:'Ásványi anyag',amount:'120 kapszula',source:'katalógus',addedDays:15,dose:'200 mg',timing:'Vacsorával'},
]}
export function addPantryItem(pantry,{name,kind='food',amount='',source='kézi'}){if(!name)return null;const item={id:id('k'),name,kind,category:kind==='supp'?'Kiegészítő':'Új elem',amount,source,addedDays:0,kcal100:null,p100:null,c100:null,f100:null,fiber100:null,sugar100:null,salt100:null,satfat100:null,nova:null};pantry.unshift(item);return item;}
export function removePantryItem(pantry,itemId){const index=pantry.findIndex(i=>i.id===itemId);if(index<0)return false;pantry.splice(index,1);return true;}
// Read-only swap heuristics (pantry suggestions): cheaper or cleaner alternatives, never a shopping list.
export const pantrySwaps=[{from:'Tortilla lap',to:'Teljes kiőrlésű tortilla',reason:'Kevésbé feldolgozott, kétszer annyi rost.',price:'+90 Ft / csomag'}];

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
  {day:'H',date:'2026-09-07',kcal:2115,target:2400,training:true,score:8.2,protein:148,water:2.6,
   dims:{nutrition:{score:84,facts:[['kcal','2115 / 2400'],['fehérje','148 / 160 g'],['c · f','220 g · 69 g'],['sáv','edzésnapi +150 kcal']]},quality:{score:79,facts:[['nova','86%'],['mikro','74%']]}},
   meals:[['Zabkása gyümölccsel',420,8.2],['Lazacos rizstál',735,8.7],['Görög joghurt',240,7.8],['Csirkés tortilla',720,7.5]]},
  {day:'K',date:'2026-09-08',kcal:2260,target:2400,training:true,score:7.4,protein:154,water:2.1,
   dims:{nutrition:{score:88,facts:[['kcal','2260 / 2400'],['fehérje','154 / 160 g'],['c · f','245 g · 74 g'],['sáv','edzésnapi +150 kcal']]},quality:{score:62,facts:[['nova','54%'],['mikro','70%']]}},
   meals:[['Joghurtos zabkása',440,8.1],['Csirkés rizstál',760,8.4],['Banán és skyr',310,8.0],['Tojásos tortilla',750,7.1]]},
  {day:'Sze',date:'2026-09-09',kcal:1180,target:2400,training:true,today:true,score:8.3,protein:86,water:1.25,
   dims:{nutrition:{score:null,facts:[['kcal','1180 / 2400'],['fehérje','86 / 160 g']]},quality:{score:81,facts:[['nova','92%'],['mikro','76%']]}},
   meals:[['Zabkása gyümölccsel',420,8.2],['Csirkés rizstál',760,8.4]]},
  {day:'Cs',date:'2026-09-10',kcal:null,target:2400},
  {day:'P',date:'2026-09-11',kcal:null,target:2200},
  {day:'Szo',date:'2026-09-12',kcal:null,target:2200,weekend:true},
  {day:'V',date:'2026-09-13',kcal:null,target:2200,weekend:true},
 ],scoreAvg:7.8,weightAvg:81.3},
 previous:{label:'Múlt hét',days:[
  {day:'H',date:'2026-08-31',kcal:2350,target:2400,training:true,score:7.6,protein:141,water:2.4,
   dims:{nutrition:{score:90,facts:[['kcal','2350 / 2400'],['fehérje','141 / 160 g'],['c · f','258 g · 76 g']]},quality:{score:68,facts:[['nova','64%'],['mikro','72%']]}},
   meals:[['Zabkása gyümölccsel',430,8.0],['Csirkés rizstál',770,8.3],['Skyr gyümölccsel',300,7.6],['Tojásos tortilla',850,6.6]]},
  {day:'K',date:'2026-09-01',kcal:2180,target:2400,training:true,score:7.9,protein:150,water:2.7,
   dims:{nutrition:{score:86,facts:[['kcal','2180 / 2400'],['fehérje','150 / 160 g'],['c · f','232 g · 71 g']]},quality:{score:76,facts:[['nova','80%'],['mikro','73%']]}},
   meals:[['Joghurtos zabkása',420,8.2],['Lazacos rizstál',735,8.7],['Banán és skyr',305,8.0],['Csirkés tortilla',720,7.4]]},
  {day:'Sze',date:'2026-09-02',kcal:2490,target:2400,score:6.8,protein:120,water:1.8,
   dims:{nutrition:{score:74,facts:[['kcal','2490 / 2400'],['fehérje','120 / 160 g'],['c · f','286 g · 92 g']]},quality:{score:58,facts:[['nova','48%'],['mikro','66%']]}},
   meals:[['Croissant',340,5.4],['Csirkés rizstál',760,8.4],['Csoki és kávé',290,5.2],['Pizza',1100,6.1]]},
  {day:'Cs',date:'2026-09-03',kcal:2210,target:2400,training:true,score:7.5,protein:139,water:2.2,
   dims:{nutrition:{score:85,facts:[['kcal','2210 / 2400'],['fehérje','139 / 160 g'],['c · f','236 g · 73 g']]},quality:{score:70,facts:[['nova','70%'],['mikro','71%']]}},
   meals:[['Zabkása gyümölccsel',420,8.2],['Csirkés rizstál',760,8.4],['Görög joghurt',240,7.8],['Tojásos tortilla',790,6.9]]},
  {day:'P',date:'2026-09-04',kcal:2050,target:2200,score:7.1,protein:112,water:1.6,
   dims:{nutrition:{score:80,facts:[['kcal','2050 / 2200'],['fehérje','112 / 150 g'],['c · f','228 g · 68 g']]},quality:{score:64,facts:[['nova','60%'],['mikro','68%']]}},
   meals:[['Zabkása gyümölccsel',420,8.2],['Szendvics',560,6.4],['Tojásos tortilla',750,7.1],['Csoki',320,5.4]]},
  {day:'Szo',date:'2026-09-05',kcal:2740,target:2200,weekend:true,score:6.4,protein:104,water:1.4,
   dims:{nutrition:{score:52,facts:[['kcal','2740 / 2200'],['fehérje','104 / 150 g'],['c · f','318 g · 104 g']]},quality:{score:56,facts:[['nova','46%'],['mikro','62%']]}},
   meals:[['Croissant',380,5.2],['Hamburger menü',1180,5.6],['Sütemény',420,5.0],['Tésztás vacsora',760,7.2]]},
  {day:'V',date:'2026-09-06',kcal:2520,target:2200,weekend:true,score:7.2,protein:118,water:1.9,
   dims:{nutrition:{score:66,facts:[['kcal','2520 / 2200'],['fehérje','118 / 150 g'],['c · f','276 g · 88 g']]},quality:{score:72,facts:[['nova','74%'],['mikro','69%']]}},
   meals:[['Rántotta',390,7.8],['Vasárnapi ebéd',980,7.0],['Sütemény',330,5.6],['Saláta',420,8.2]]},
 ],scoreAvg:7.2,weightAvg:81.6},
};
export function weekSummary(week){const logged=week.days.filter(d=>Number.isFinite(d.kcal));if(!logged.length)return {logged:0,within:0,avg:null,weekendDelta:null};
 const within=logged.filter(d=>d.kcal<=d.target+60).length,avg=Math.round(logged.reduce((s,d)=>s+d.kcal,0)/logged.length);
 const mean=rows=>rows.length?rows.reduce((s,d)=>s+d.kcal,0)/rows.length:null;
 const weekend=mean(logged.filter(d=>d.weekend)),weekday=mean(logged.filter(d=>!d.weekend));
 const weekendDelta=weekend!=null&&weekday!=null?Math.round(weekend-weekday):null;
 return {logged:logged.length,within,avg,weekendDelta};}
// The two fuel dimensions of the day engine (nutrition .30, quality .15), renormalised the way the
// engine renormalises DONE dimensions — so a day with only one measurable dimension stays honest.
export function fuelDayScore(day){
 const n=day?.dims?.nutrition?.score??null,q=day?.dims?.quality?.score??null;
 if(n==null&&q==null)return null;
 if(n==null)return q;
 if(q==null)return n;
 return Math.round((n*.30+q*.15)/.45);
}
// Weekday vs weekend split and week-over-week deltas — both honest about unlogged days.
export function weekCompare(week){
 const logged=week.days.filter(d=>Number.isFinite(d.kcal));
 const mean=rows=>rows.length?Math.round(rows.reduce((sum,d)=>sum+d.kcal,0)/rows.length):null;
 const weekday=mean(logged.filter(d=>!d.weekend)),weekend=mean(logged.filter(d=>d.weekend));
 return {weekday,weekend,delta:weekday!=null&&weekend!=null?weekend-weekday:null,coverage:logged.length};
}
export function weekDeltas(week,previous){
 const now=weekSummary(week),before=weekSummary(previous);
 const diff=(a,b)=>a==null||b==null?null:Math.round((a-b)*10)/10;
 return {avg:diff(now.avg,before.avg),score:diff(week.scoreAvg,previous.scoreAvg),weight:diff(week.weightAvg,previous.weightAvg)};
}
export const longHorizon=[
 {week:'júl 27.',kcal:2380,weight:82.4},{week:'aug 3.',kcal:2310,weight:82.1},{week:'aug 10.',kcal:2405,weight:82.2},
 {week:'aug 17.',kcal:2290,weight:81.9},{week:'aug 24.',kcal:2240,weight:81.7},{week:'aug 31.',kcal:2360,weight:81.6},
 {week:'szept 7.',kcal:2185,weight:81.3},
];
export const patterns=[
 {title:'Edzésnapokon kevesebb fehérje jut estére',state:'megfigyelés alatt',route:'mezo/0',detail:'Három edzésnapon a vacsora fehérjéje 20–25 g-mal alacsonyabb volt, mint pihenőnapokon. Ez megfigyelés, nem bizonyított ok — a Mezo tovább gyűjti hozzá az adatot.'},
 {title:'A hétvégi vacsorák viszik el a keret nagyját',state:'megerősítetted',route:'mezo/0',detail:'Szombaton és vasárnap a napi kalória fele a vacsorára esett. Te magad erősítetted meg, hogy ez így van — a Mezo ezt már tényként kezeli.'},
];
