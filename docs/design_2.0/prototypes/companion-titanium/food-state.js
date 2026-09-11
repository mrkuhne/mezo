// Illustrative per-100 g fixtures, not a nutrition database or AI output.
export const foods={yogurt:{name:'Natúr joghurt',kcal:64,p:4,c:5,f:3.1,fiber:0},greek:{name:'Görög joghurt',kcal:97,p:9,c:4,f:5,fiber:0},banana:{name:'Banán',kcal:89,p:1.1,c:22.8,f:.3,fiber:2.6}};
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
