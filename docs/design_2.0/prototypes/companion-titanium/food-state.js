// Illustrative per-100 g fixtures, not a nutrition database or AI output.
export const foods={yogurt:{name:'Natúr joghurt',kcal:64,p:4,c:5,f:3.1,fiber:0,sugar:4.7,salt:.13,satfat:2},greek:{name:'Görög joghurt',kcal:97,p:9,c:4,f:5,fiber:0,sugar:3.8,salt:.11,satfat:3.2},banana:{name:'Banán',kcal:89,p:1.1,c:22.8,f:.3,fiber:2.6,sugar:12.2,salt:0,satfat:.1}};
// Per-meal detail facts by name: ingredient lines (source: kamra/recept/becslés, NOVA group) and
// the frozen nutrition-quality snapshot (null = the source carried no value — honest unknown).
export const mealFacts={
 'Zabkása gyümölccsel':{lines:[['Zabpehely','60 g','kamra',223,1],['Görög joghurt','150 g','kamra',146,1],['Erdei gyümölcs','80 g','becslés',51,1]],nutrients:{sugar:11.2,salt:.2,satfat:3.1},plants:3,macros:{p:22,c:64,f:9,fiber:7}},
 'Csirkés rizstál':{lines:[['Csirkemell','180 g','kamra',216,1],['Jázmin rizs','90 g (száraz)','kamra',320,1],['Zöldségkeverék','150 g','becslés',66,1],['Olívaolaj','10 g','becslés',88,2]],nutrients:{sugar:4.8,salt:1.1,satfat:3.4},plants:4,macros:{p:64,c:64,f:27,fiber:11}},
 'Banán és skyr':{lines:[['Skyr','150 g','kamra',95,1],['Banán','120 g','kamra',107,1],['Méz','10 g','becslés',30,2]],nutrients:{sugar:22.4,salt:.15,satfat:.3},plants:2,macros:{p:24,c:44,f:3,fiber:4}},
 'Görög joghurt':{lines:[['Görög joghurt','250 g','kamra',243,1]],nutrients:{sugar:9.5,salt:.28,satfat:8},plants:0,macros:{p:20,c:9,f:11,fiber:0}},
 'Tojásos tortilla':{lines:[['Tojás','3 db','kamra',215,1],['Tortilla lap','2 db','kamra',290,4],['Sajt','40 g','kamra',161,3],['Paprika','80 g','becslés',26,1]],nutrients:{sugar:null,salt:null,satfat:12.4},plants:1,macros:{p:38,c:52,f:34,fiber:6}},
 'Joghurtos zabkása':{lines:[['Zabpehely','60 g','kamra',223,1],['Joghurt','150 g','kamra',96,1],['Gyümölcs','80 g','becslés',48,1]],nutrients:{sugar:10.8,salt:.19,satfat:2.4},plants:3,macros:{p:26,c:62,f:10,fiber:6}},
 'Lazacos rizstál':{lines:[['Lazacfilé','160 g','kamra',330,1],['Rizs','80 g (száraz)','kamra',285,1],['Brokkoli','120 g','becslés',41,1]],nutrients:{sugar:2.1,salt:.9,satfat:2.8},plants:2,macros:{p:48,c:68,f:22,fiber:5}},
 'Csirkés tortilla':{lines:[['Csirkemell','150 g','kamra',180,1],['Tortilla lap','2 db','kamra',290,4],['Zöldségek','100 g','becslés',35,1]],nutrients:{sugar:3.4,salt:1.6,satfat:4.9},plants:2,macros:{p:52,c:58,f:20,fiber:5}},
 'Joghurt és banán':{lines:[['Natúr joghurt','150 g','kamra',96,1],['Banán','120 g','kamra',107,1]],nutrients:{sugar:21.7,salt:.2,satfat:3.1},plants:1,macros:{p:7,c:35,f:5,fiber:3}},
};
export function nutrientFor(draft){if(draft.fixed)return mealFacts[draft.name]?.nutrients??{sugar:null,salt:null,satfat:null};return draft.items.reduce((out,item)=>{const food=foods[item.key];if(!food)return out;out.sugar+=food.sugar*item.grams/100;out.salt+=food.salt*item.grams/100;out.satfat+=food.satfat*item.grams/100;return out;},{sugar:0,salt:0,satfat:0});}
// The demo day starts with two already-logged sample meals so editing and deleting are demonstrable.
export const createFoodDay=()=>({meals:[
 {id:'seed-breakfast',time:'08:00',name:'Zabkása gyümölccsel',slot:'Reggeli',score:8.2,fixed:{kcal:420,p:22,c:64,f:9,fiber:7}},
 {id:'seed-lunch',time:'12:30',name:'Csirkés rizstál',slot:'Ebéd',score:8.4,fixed:{kcal:760,p:64,c:64,f:27,fiber:11}},
]});
// --- Meal-window roles (mezo-ud77t) -----------------------------------------------------------
// Role presets follow the sports-science rule engine (RP-style): carbs toward training, fat away
// from it, protein spread evenly (ISSN 0.25-0.4 g/kg per meal). `share` is the window's soft
// share of the daily kcal budget — the DAILY total stays the only hard target; window budgets
// are guides, never red/green grades. `peri` marks training-adjacent windows where glucose-spike
// advice relaxes (contraction-driven GLUT4 uptake disposes the carbs).
export const MEAL_ROLES={
 pre:{label:'Edzés előtti',art:'bolt',color:'#8ed2e8',share:.14,mix:{p:25,c:55,f:20},peri:true,hint:'Könnyű, szénhidrát-hangsúlyos adag az edzés elé.'},
 during:{label:'Edzés közbeni',art:'water',color:'#7dd4f1',share:.06,mix:{p:10,c:85,f:5},peri:true,hint:'Gyors szénhidrát hosszú edzéshez vagy versenyhez.'},
 post:{label:'Edzés utáni',art:'dumbbell',color:'#c8e895',share:.22,mix:{p:35,c:45,f:20},peri:true,hint:'Szénhidrát és fehérje a regenerációhoz.'},
 main:{label:'Főétkezés',art:'bowl',color:'#d9c395',share:.30,mix:{p:30,c:40,f:30},peri:false,hint:'Kiegyensúlyozott, fehérje-erős nagy étkezés.'},
 snack:{label:'Könnyű falat',art:'sprout',color:'#8fd97a',share:.10,mix:{p:35,c:35,f:30},peri:false,hint:'Kis adag, fehérje- és rost-hangsúllyal.'},
 night:{label:'Lefekvés előtti',art:'moon',color:'#bca6f1',share:.10,mix:{p:50,c:15,f:35},peri:false,hint:'Lassú fehérje estére, kevés szénhidrát.'},
};
export const DAILY_KCAL=2400;
export const minutesOf=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
export const timeOf=m=>{const c=Math.max(0,Math.min(1439,Math.round(m)));return `${String(Math.floor(c/60)).padStart(2,'0')}:${String(c%60).padStart(2,'0')}`;};
// Planned meal windows: the Mai page lists these blocks and logging targets one of them.
// Demo seeds tell the feature's story: the 16:00 window is pre-workout for the 17:00 session.
export const mealBlocks=[
 {key:'reggeli',label:'Reggeli',role:'main',mix:{...MEAL_ROLES.main.mix},time:'08:00',budget:520,box:['06:00','11:00'],optimal:['07:30','09:30'],color:'#d9c395',art:'sun'},
 {key:'ebed',label:'Ebéd',role:'main',mix:{...MEAL_ROLES.main.mix},time:'12:30',budget:760,box:['10:30','15:30'],optimal:['12:00','14:00'],color:'#c8e895',art:'bowl'},
 {key:'uzsonna',label:'Uzsonna',role:'pre',mix:{...MEAL_ROLES.pre.mix},time:'16:00',budget:320,box:['14:00','19:00'],optimal:['15:30','17:00'],color:'#8ed2e8',art:'bolt'},
 {key:'vacsora',label:'Vacsora',role:'main',mix:{...MEAL_ROLES.main.mix},time:'19:30',budget:800,box:['17:00','22:00'],optimal:['18:30','20:30'],color:'#bca6f1',art:'moon'},
];
export const roleOf=block=>MEAL_ROLES[block?.role]??null;
export const roleDefaults=(roleId,daily=DAILY_KCAL)=>{const r=MEAL_ROLES[roleId];return r?{budget:Math.round(r.share*daily/10)*10,mix:{...r.mix}}:null;};
// Picking a role fills the smart preset; every number stays hand-editable afterwards.
export function applyRole(block,roleId,daily=DAILY_KCAL){const d=roleDefaults(roleId,daily);if(!d)return false;block.role=roleId;block.budget=d.budget;block.mix=d.mix;return true;}
export const presetDrift=(block,daily=DAILY_KCAL)=>{const d=roleDefaults(block.role,daily);return d?block.budget!==d.budget||['p','c','f'].some(k=>block.mix?.[k]!==d.mix[k]):false;}
// Moving a window recomputes its 5h box and the optimal band around the new time.
export function setWindowTime(block,time){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return false;const m=minutesOf(time);block.time=time;block.box=[timeOf(m-120),timeOf(m+180)];block.optimal=[timeOf(m-30),timeOf(m+90)];return true;}
let windowSerial=0;
export function addWindow(daily=DAILY_KCAL){const block={key:`ablak-${++windowSerial}`,label:'Új ablak',role:'snack',mix:{...MEAL_ROLES.snack.mix},time:'11:00',budget:roleDefaults('snack',daily).budget,box:['09:00','14:00'],optimal:['10:30','12:30'],color:MEAL_ROLES.snack.color,art:MEAL_ROLES.snack.art};setWindowTime(block,block.time);mealBlocks.push(block);mealBlocks.sort((a,b)=>a.time.localeCompare(b.time));return block;}
export function removeWindow(key){const i=mealBlocks.findIndex(b=>b.key===key);if(i<0||mealBlocks.length<=1)return false;mealBlocks.splice(i,1);return true;}
export const windowByKey=key=>mealBlocks.find(b=>b.key===key)??null;
export function blockFor(time){if(time<'10:30')return 'reggeli';if(time<'14:30')return 'ebed';if(time<'18:00')return 'uzsonna';return 'vacsora';}
let serial=0;
export const sampleDraft=(time='15:30')=>({id:`food-demo-${++serial}`,time,score:7.6,items:[{key:'yogurt',grams:150},{key:'banana',grams:120}]});
export const fixedDraft=(name,fixed,time='15:30',score=7.4)=>({id:`food-demo-${++serial}`,time,name,score,fixed:{...fixed}});
export function nutrition(draft){if(draft.fixed)return {...draft.fixed};return draft.items.reduce((out,item)=>{const food=foods[item.key];if(!food)return out;for(const k of ['kcal','p','c','f','fiber'])out[k]+=food[k]*item.grams/100;return out;},{kcal:0,p:0,c:0,f:0,fiber:0});}
const validFixed=d=>d.name&&d.fixed&&['kcal','p','c','f','fiber'].every(k=>Number.isFinite(d.fixed[k])&&d.fixed[k]>=0);
const validItems=d=>Array.isArray(d.items)&&d.items.length&&d.items.every(i=>Object.hasOwn(foods,i.key)&&Number.isFinite(i.grams)&&i.grams>0&&i.grams<=2000);
export function saveMeal(day,draft){if(!draft.id||!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))return false;if(!(draft.fixed?validFixed(draft):validItems(draft)))return false;const copy=structuredClone(draft),index=day.meals.findIndex(m=>m.id===draft.id);if(index<0)day.meals.push(copy);else day.meals[index]=copy;return true;}
export function deleteMeal(day,id){const index=day.meals.findIndex(m=>m.id===id);if(index<0)return false;day.meals.splice(index,1);return true;}
// Demo glycemic-response verdict ("vércukor-válasz"), Glucose-Goddess-informed, deliberately
// categorical: a GL-style load from carbs weighted by their refined (sugar) share, braked by the
// fiber/protein/fat that "clothe" them. No numeric GI is shown anywhere — mixed-meal GI math
// mispredicts by 22-50%, so the demo (like the planned live feature) commits to three honest bands.
export function glycemicFor({c,fiber,p,f,sugar}={},role=null){
 if(!Number.isFinite(c))return null;
 const s=Number.isFinite(sugar)?sugar:c*.3,fb=Number.isFinite(fiber)?fiber:0,pr=Number.isFinite(p)?p:0,fa=Number.isFinite(f)?f:0;
 const load=c*(.6+.4*Math.min(1,s/Math.max(1,c))),brake=fb*2+pr*.25+fa*.2,index=load-brake;
 const level=index<12?'low':index<24?'mid':'high';
 const sugary=s>=c*.45&&s>=12,bare=fb<4&&pr<15;
 // Training-adjacent windows: contraction-driven glucose uptake makes the same spike useful —
 // the band stays honest, the advice flips from damping to fueling.
 const peri=MEAL_ROLES[role]?.peri===true;
 if(peri){const tip=level==='low'
   ?{title:'Könnyű és edzésbarát',body:'Alacsony vércukor-terhelés — edzés-közeli ablakban akár több gyors szénhidrát is elférne.'}
   :{title:'Ezt az edzésed használja el',body:'Edzés-közeli ablakban a dolgozó izom közvetlenül felveszi a glükózt — ez a csúcs munkára megy, nem raktárba.'};
  return {level,peri:true,label:level==='low'?'alacsony':level==='mid'?'közepes':'magas',tip,
   expect:{energy:'Gyors üzemanyag az edzésedhez',back:'A mozgás maga viszi le — edzés közben/után gyorsan alapszintre ér',hunger:'Edzés után jelentkezik majd — a következő ablakod fedezi'},
   facts:[['szénhidrát',`${Math.round(c)} g`],['ebből cukor',Number.isFinite(sugar)?`${Math.round(sugar)} g`:'becsült'],['rost',`${Math.round(fb)} g`],['fehérje',`${Math.round(pr)} g`]]};}
 const tip=level==='low'
  ?{title:'Szép egyensúly',body:'A fehérje és a rost lassan engedi fel a vércukrot — ez a tányér magától simít.'}
  :level==='high'
  ?(sugary
    ?{title:'Öltöztesd fel a szénhidrátot',body:'Az édes rész magában gyorsan felszív. Egy kis fehérje vagy zsír mellé — joghurt, dió — sokat lapít a csúcson.'}
    :{title:'Egy séta most sokat ér',body:'10-15 perc mozgás evés után az izmok azonnal elhasználják a glükóz egy részét — a csúcs láthatóan kisebb lesz.'})
  :(bare
    ?{title:'Rost előre',body:'Pár falat zöldség vagy saláta a szénhidrát előtt lassítja a felszívódást — a domb így laposabb.'}
    :{title:'Jó irány, egy aprósággal',body:'Ha teheted, a zöldséget és a fehérjét edd előre, a szénhidrátot utoljára — a sorrend önmagában simít a görbén.'});
 const expect=level==='low'
  ?{energy:'Egyenletes energia 3-4 órára',back:'Kb. 2 óra múlva ér vissza az alapszintre, finoman',hunger:'Az éhség későn, fokozatosan tér vissza'}
  :level==='mid'
  ?{energy:'Stabil energia 2-3 órára',back:'Kb. 2 óra múlva újra alapszinten',hunger:'Az éhség 2-3 óra múlva jelentkezik'}
  :{energy:'Gyors löket, majd visszaesés',back:'Kb. 1,5 óra múlva zuhan — az alapszint alá is eshet',hunger:'A visszaesés után korán, akár 1-1,5 óra múlva újra megéhezhetsz'};
 return {level,peri:false,label:level==='low'?'alacsony':level==='mid'?'közepes':'magas',tip,expect,
  facts:[['szénhidrát',`${Math.round(c)} g`],['ebből cukor',Number.isFinite(sugar)?`${Math.round(sugar)} g`:'becsült'],['rost',`${Math.round(fb)} g`],['fehérje',`${Math.round(pr)} g`]]};
}
// The same verdict straight from a meal record ({macros,nutrients}) or a live draft.
export const glycemicForMeal=(rec,role=null)=>rec?glycemicFor({...(rec.macros||{}),sugar:rec.nutrients?.sugar},role):null;
// The role of the window a given eating time falls into — feeds role-aware glucose advice.
export const roleForTime=time=>windowByKey(blockFor(time))?.role??mealBlocks.find(b=>b.key===blockFor(time))?.role??null;
export function totals(day){return day.meals.reduce((out,m)=>{const n=nutrition(m);for(const k of ['kcal','p','c','f','fiber'])out[k]+=n[k];return out;},{kcal:0,p:0,c:0,f:0,fiber:0});}
// Time-of-day-ranked quick repeats ("szokásosak"): recency+frequency sample, morning items first in the morning.
const usualRows=[
 {name:'Joghurt és banán',daypart:'nap',hint:'Uzsonna · legutóbb tegnap',sample:true},
 {name:'Banán és skyr',daypart:'nap',hint:'Uzsonna · a héten kétszer',score:8.0,fixed:{kcal:310,p:24,c:44,f:3,fiber:4},time:'16:20'},
 {name:'Zabkása gyümölccsel',daypart:'reggel',hint:'Reggeli · szinte minden nap',score:8.2,fixed:{kcal:420,p:22,c:64,f:9,fiber:7},time:'08:00'},
 {name:'Görög joghurt',daypart:'reggel',hint:'Reggeli · a héten háromszor',score:7.8,fixed:{kcal:240,p:20,c:9,f:11,fiber:0},time:'08:30'},
 {name:'Csirkés rizstál',daypart:'nap',hint:'Ebéd · heti négyszer',score:8.4,fixed:{kcal:760,p:64,c:64,f:27,fiber:11},time:'12:30'},
 {name:'Tojásos tortilla',daypart:'este',hint:'Vacsora · a héten kétszer',score:7.1,fixed:{kcal:750,p:38,c:52,f:34,fiber:6},time:'20:30'},
];
export function usualMeals(daypart='nap'){const order={nap:1,reggel:2,este:3,[daypart]:0};return [...usualRows].sort((a,b)=>(order[a.daypart]??4)-(order[b.daypart]??4));}
