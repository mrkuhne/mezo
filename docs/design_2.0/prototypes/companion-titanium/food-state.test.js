import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoodDay, sampleDraft, nutrition, saveMeal, totals } from './food-state.js';
test('portion edits recalculate and preview never changes the day',()=>{const day=createFoodDay(),d=sampleDraft();const first=nutrition(d);d.items[0].grams*=2;assert.ok(nutrition(d).kcal>first.kcal);assert.equal(totals(day).kcal,1180);});
test('banana fibre contributes to the daily fibre total',()=>{const day=createFoodDay(),d=sampleDraft();assert.ok(nutrition(d).fiber>3);assert.equal(totals(day).fiber,18);saveMeal(day,d);assert.ok(totals(day).fiber>18);});
test('save is idempotent by draft ID, corrections replace, invalid portions do not mutate day',()=>{const day=createFoodDay(),d=sampleDraft();assert.equal(saveMeal(day,d),true);const first=totals(day).kcal;saveMeal(day,d);assert.equal(totals(day).kcal,first);d.items[0].grams=200;saveMeal(day,d);assert.equal(day.meals.length,1);const corrected=totals(day).kcal;d.items[0].grams=-1;assert.equal(saveMeal(day,d),false);assert.equal(totals(day).kcal,corrected);});
