import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresence } from './presence-model.mjs';
import { imprintWeek } from './imprint-model.mjs';
test('today reflects every saved check-in and never treats planned sport as completed',()=>{
 const s=createPresence();const today=imprintWeek(s)[1];
 assert.equal(today.events.filter(e=>e.kind==='checkin').length,2);
 assert.ok(today.events.filter(e=>e.kind==='movement').every(e=>e.planned));
 s.training.sportActive=false;
 assert.equal(imprintWeek(s)[1].events.filter(e=>e.kind==='movement').length,1);
});
test('journal and gratitude appear only when written and preserve source text',()=>{
 const s=createPresence();s.journal='  Fontos nap. ';s.gratitude=' Közös vacsora. ';
 const events=imprintWeek(s)[1].events;
 assert.equal(events.find(e=>e.kind==='journal').detail,'Fontos nap.');
 assert.equal(events.find(e=>e.kind==='gratitude').detail,'Közös vacsora.');
 s.journal=' '; assert.ok(!imprintWeek(s)[1].events.some(e=>e.kind==='journal'));
});
test('future days remain empty and historical data is identified as fixture',()=>{
 const week=imprintWeek(createPresence());assert.equal(week.length,7);
 assert.equal(week[0].fixture,true);
 assert.ok(week.slice(2).every(day=>day.future && day.events.length===0));
});
