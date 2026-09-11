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
// Planned meal windows: the Mai page lists these blocks and logging targets one of them.
export const mealBlocks=[
 {key:'reggeli',label:'Reggeli',time:'08:00',budget:520},
 {key:'ebed',label:'Ebéd',time:'12:30',budget:760},
 {key:'uzsonna',label:'Uzsonna',time:'16:00',budget:320},
 {key:'vacsora',label:'Vacsora',time:'19:30',budget:800},
];
export function blockFor(time){if(time<'10:30')return 'reggeli';if(time<'14:30')return 'ebed';if(time<'18:00')return 'uzsonna';return 'vacsora';}
let serial=0;
export const sampleDraft=(time='15:30')=>({id:`food-demo-${++serial}`,time,score:7.6,items:[{key:'yogurt',grams:150},{key:'banana',grams:120}]});
export const fixedDraft=(name,fixed,time='15:30',score=7.4)=>({id:`food-demo-${++serial}`,time,name,score,fixed:{...fixed}});
export function nutrition(draft){if(draft.fixed)return {...draft.fixed};return draft.items.reduce((out,item)=>{const food=foods[item.key];if(!food)return out;for(const k of ['kcal','p','c','f','fiber'])out[k]+=food[k]*item.grams/100;return out;},{kcal:0,p:0,c:0,f:0,fiber:0});}
const validFixed=d=>d.name&&d.fixed&&['kcal','p','c','f','fiber'].every(k=>Number.isFinite(d.fixed[k])&&d.fixed[k]>=0);
const validItems=d=>Array.isArray(d.items)&&d.items.length&&d.items.every(i=>Object.hasOwn(foods,i.key)&&Number.isFinite(i.grams)&&i.grams>0&&i.grams<=2000);
export function saveMeal(day,draft){if(!draft.id||!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))return false;if(!(draft.fixed?validFixed(draft):validItems(draft)))return false;const copy=structuredClone(draft),index=day.meals.findIndex(m=>m.id===draft.id);if(index<0)day.meals.push(copy);else day.meals[index]=copy;return true;}
export function deleteMeal(day,id){const index=day.meals.findIndex(m=>m.id===id);if(index<0)return false;day.meals.splice(index,1);return true;}
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
