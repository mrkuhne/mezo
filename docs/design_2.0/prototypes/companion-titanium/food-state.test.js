import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoodDay, sampleDraft, fixedDraft, nutrition, saveMeal, deleteMeal, totals, usualMeals, glycemicFor, glycemicForMeal, mealFacts } from './food-state.js';
test('the demo day starts from two editable sample meals summing the known baseline',()=>{const day=createFoodDay();assert.equal(day.meals.length,2);assert.equal(totals(day).kcal,1180);assert.equal(totals(day).fiber,18);});
test('portion edits recalculate and preview never changes the day',()=>{const day=createFoodDay(),d=sampleDraft();const first=nutrition(d);d.items[0].grams*=2;assert.ok(nutrition(d).kcal>first.kcal);assert.equal(totals(day).kcal,1180);});
test('banana fibre contributes to the daily fibre total',()=>{const day=createFoodDay(),d=sampleDraft();assert.ok(nutrition(d).fiber>3);saveMeal(day,d);assert.ok(totals(day).fiber>18);});
test('save is idempotent by draft ID, corrections replace, invalid portions do not mutate day',()=>{const day=createFoodDay(),d=sampleDraft();assert.equal(saveMeal(day,d),true);const first=totals(day).kcal;saveMeal(day,d);assert.equal(totals(day).kcal,first);d.items[0].grams=200;saveMeal(day,d);assert.equal(day.meals.length,3);const corrected=totals(day).kcal;d.items[0].grams=-1;assert.equal(saveMeal(day,d),false);assert.equal(totals(day).kcal,corrected);});
test('fixed-value meals (usuals, seeds) save, edit and delete like any other meal',()=>{const day=createFoodDay(),d=fixedDraft('Banán és skyr',{kcal:310,p:24,c:44,f:3,fiber:4},'16:20');assert.equal(saveMeal(day,d),true);assert.equal(totals(day).kcal,1490);d.time='17:00';saveMeal(day,d);assert.equal(day.meals.length,3);assert.equal(deleteMeal(day,d.id),true);assert.equal(totals(day).kcal,1180);assert.equal(deleteMeal(day,'missing'),false);});
test('deleting a seeded meal lowers the day honestly',()=>{const day=createFoodDay();assert.equal(deleteMeal(day,'seed-lunch'),true);assert.equal(totals(day).kcal,420);});
test('usual meals rank the current daypart first',()=>{const morning=usualMeals('reggel');assert.equal(morning[0].daypart,'reggel');const evening=usualMeals('este');assert.equal(evening[0].daypart,'este');});

test('glycemic verdict is categorical and tracks the clothed-carb heuristic',()=>{
 const rice=glycemicFor({...mealFacts['Csirkés rizstál'].macros,sugar:mealFacts['Csirkés rizstál'].nutrients.sugar});
 assert.equal(rice.level,'low'); // heavy carbs, but clothed in protein, fat and fiber
 const yb=glycemicFor({...mealFacts['Joghurt és banán'].macros,sugar:mealFacts['Joghurt és banán'].nutrients.sugar});
 assert.equal(yb.level,'mid');
 const naked=glycemicFor({c:60,sugar:45,fiber:1,p:2,f:1}); // sugary and bare → high, sugary tip
 assert.equal(naked.level,'high');assert.match(naked.tip.title,/Öltöztesd/);
 assert.ok(rice.facts.length===4&&rice.label==='alacsony');
});
test('glycemic verdict degrades honestly: no carbs data, no verdict',()=>{
 assert.equal(glycemicFor({}),null);assert.equal(glycemicFor(),null);assert.equal(glycemicForMeal(null),null);
 assert.equal(glycemicForMeal({macros:{p:20},nutrients:{}}),null);
});
import { MEAL_ROLES, mealBlocks, applyRole, roleDefaults, presetDrift, setWindowTime, addWindow, removeWindow, roleForTime, DAILY_KCAL } from './food-state.js';
test('picking a role fills the smart preset and stays hand-editable (drift detected)',()=>{
 const block={...mealBlocks[0],mix:{...mealBlocks[0].mix}};
 assert.equal(applyRole(block,'pre'),true);
 assert.equal(block.budget,roleDefaults('pre').budget);assert.deepEqual(block.mix,MEAL_ROLES.pre.mix);
 assert.equal(presetDrift(block),false);
 block.budget+=50;assert.equal(presetDrift(block),true); // hand edit → drift, never reverted silently
 assert.equal(applyRole(block,'nope'),false);
});
test('window shares are soft guides: role presets sum near (not over) the daily total',()=>{
 const sum=['main','main','pre','main'].reduce((s,r)=>s+roleDefaults(r).budget,0);
 assert.ok(sum<=DAILY_KCAL*1.1&&sum>DAILY_KCAL*.8);
});
test('moving a window recomputes its box and optimal band around the new time',()=>{
 const block={...mealBlocks[0]};
 assert.equal(setWindowTime(block,'06:00'),true);
 assert.deepEqual(block.box,['04:00','09:00']);assert.deepEqual(block.optimal,['05:30','07:30']);
 assert.equal(setWindowTime(block,'25:99'),false);
});
test('add/remove window round-trips, keeps time order, and refuses unknown keys',()=>{
 const before=mealBlocks.length,added=addWindow();
 assert.equal(mealBlocks.length,before+1);
 assert.ok(mealBlocks.every((b,i)=>i===0||mealBlocks[i-1].time<=b.time));
 assert.equal(removeWindow(added.key),true);assert.equal(mealBlocks.length,before);
 assert.equal(removeWindow('nincs-ilyen'),false);
});
test('peri-workout role flips the glucose advice to fueling but keeps the band honest',()=>{
 const meal={c:60,sugar:30,fiber:2,p:5,f:3};
 const rest=glycemicFor(meal),peri=glycemicFor(meal,'pre');
 assert.equal(rest.level,peri.level); // the band never lies
 assert.equal(peri.peri,true);assert.match(peri.tip.title,/edzésed/i);
 assert.equal(glycemicFor(meal,'main').peri,false);
 assert.equal(roleForTime('16:30'),'pre'); // the 16:00 demo window is pre-workout for the 17:00 session
});
