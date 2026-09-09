import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,dayTotals,nutrition,portionLines,saveMeal,toggleIntake,addShortages,TODAY,target,load} from './model.mjs';
test('a saved meal correction replaces the same record and updates daily totals',()=>{
 const s=createState(),count=s.meals.length,before=dayTotals(s,TODAY);const d=structuredClone(s.meals[0]);d.lines[0].g+=100;saveMeal(s,d);
 assert.equal(s.meals.length,count);assert.ok(Math.abs(dayTotals(s,TODAY).kcal-before.kcal-390)<.001);
});
test('portion scaling uses recipe total servings and keeps original recipe quantities',()=>{
 const s=createState(),r=s.recipes[0],one=nutrition(portionLines(r),s.pantry),two=nutrition(portionLines(r,2),s.pantry);
 assert.equal(two.kcal,2*one.kcal);assert.equal(r.lines[0].g,320);
});
test('invalid or empty food quantities cannot be saved',()=>{
 const s=createState(),m=structuredClone(s.meals[0]);m.lines[0].g=0;assert.throws(()=>saveMeal(s,m));m.lines=[];assert.throws(()=>saveMeal(s,m));
});
test('date filtering keeps history independent of today',()=>{
 const s=createState(),previous=dayTotals(s,'2026-09-08');s.meals=s.meals.filter(m=>m.date!==TODAY);assert.equal(dayTotals(s,TODAY).kcal,0);assert.deepEqual(dayTotals(s,'2026-09-08'),previous);
});
test('movement changes the goal without changing consumption',()=>{
 const s=createState(),before=dayTotals(s,TODAY),goal=target(s);s.settings.movement=0;assert.equal(target(s),goal-350);assert.deepEqual(dayTotals(s,TODAY),before);
});
test('intake can be undone on its original date',()=>{
 const s=createState();toggleIntake(s,'s2',TODAY);assert.deepEqual(s.stack[1].taken,[TODAY]);toggleIntake(s,'s2',TODAY);assert.deepEqual(s.stack[1].taken,[]);
});
test('adding recipe shortages twice does not duplicate shopping items',()=>{
 const s=createState(),r=s.recipes[2];addShortages(s,r);addShortages(s,r);assert.equal(s.shopping.length,1);assert.equal(s.shopping[0].id,'broccoli');assert.equal(s.shopping[0].g,50);
});
test('corrupt saved data falls back to a usable sample',()=>{assert.equal(load({getItem:()=>'{bad'}).version,1);});
