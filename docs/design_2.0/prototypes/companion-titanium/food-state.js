// Illustrative per-100 g fixtures, not a nutrition database or AI output.
export const foods={yogurt:{name:'Natúr joghurt',kcal:64,p:4,c:5,f:3.1},greek:{name:'Görög joghurt',kcal:97,p:9,c:4,f:5},banana:{name:'Banán',kcal:89,p:1.1,c:22.8,f:.3}};
export const createFoodDay=()=>({meals:[]});
let serial=0;
export const sampleDraft=()=>({id:`food-demo-${++serial}`,time:'15:30',items:[{key:'yogurt',grams:150},{key:'banana',grams:120}]});
export function nutrition(draft){return draft.items.reduce((out,item)=>{const food=foods[item.key];if(!food)return out;for(const k of ['kcal','p','c','f'])out[k]+=food[k]*item.grams/100;return out;},{kcal:0,p:0,c:0,f:0});}
export function saveMeal(day,draft){if(!draft.id||!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)||!draft.items.length||draft.items.some(i=>!Object.hasOwn(foods,i.key)||!Number.isFinite(i.grams)||i.grams<=0||i.grams>2000))return false;const copy=structuredClone(draft),index=day.meals.findIndex(m=>m.id===draft.id);if(index<0)day.meals.push(copy);else day.meals[index]=copy;return true;}
export function totals(day){return day.meals.reduce((out,m)=>{const n=nutrition(m);for(const k of ['kcal','p','c','f'])out[k]+=n[k];return out;},{kcal:1180,p:86,c:128,f:36});}
