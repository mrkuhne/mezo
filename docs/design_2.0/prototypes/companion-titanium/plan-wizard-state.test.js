import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG, catalogItem, newDraft, draftFromTemplate, toggleDay, draftDay, addExercise,
  removeExercise, moveExercise, changeSets, dayMinutes, draftMuscles, rampSeries, lintDraft, stampRun,
} from './plan-wizard-state.js';
import { MESO } from './plan-state.js';

test('a blank draft starts truly blank', () => {
  const d = newDraft();
  assert.equal(d.days.length, 0);
  assert.equal(d.weeks, 6);
  assert.deepEqual(d.focus, {});
});

test('a template hands the wizard its own days, cloned and safe to edit', () => {
  const own = draftFromTemplate('alap-ero');
  assert.equal(own.days.length, MESO.days.length);
  assert.equal(own.days[0].exercises[0].name, MESO.days[0].exercises[0].name);
  own.days[0].exercises[0].sets = 99;
  assert.notEqual(MESO.days[0].exercises[0].sets, 99, 'the clone must not touch the running plan');
  const other = draftFromTemplate('vall-hat');
  assert.equal(other.days.length, 4);
  assert.ok(other.days.every(d => d.exercises.length >= 2), 'every template day arrives with its exercises');
  assert.ok(Object.values(other.focus).every(t => t === 'grow'));
});

test('weekdays toggle in and out and the week keeps its order', () => {
  const d = newDraft();
  toggleDay(d, 'P'); toggleDay(d, 'Hét');
  assert.deepEqual(d.days.map(x => x.day), ['Hét', 'P']);
  toggleDay(d, 'P');
  assert.deepEqual(d.days.map(x => x.day), ['Hét']);
});

test('exercises add from the catalog, move by arrows, and leave cleanly', () => {
  const d = newDraft();
  toggleDay(d, 'Hét');
  addExercise(d, 'Hét', 'Guggolás'); addExercise(d, 'Hét', 'Fekvenyomás'); addExercise(d, 'Hét', 'nincs-ilyen');
  assert.deepEqual(draftDay(d, 'Hét').exercises.map(e => e.name), ['Guggolás', 'Fekvenyomás']);
  assert.equal(d.focus.quad, 'grow');
  moveExercise(d, 'Hét', 1, -1);
  assert.deepEqual(draftDay(d, 'Hét').exercises.map(e => e.name), ['Fekvenyomás', 'Guggolás']);
  moveExercise(d, 'Hét', 0, -1);
  assert.deepEqual(draftDay(d, 'Hét').exercises.map(e => e.name), ['Fekvenyomás', 'Guggolás'], 'the top row stays');
  removeExercise(d, 'Hét', 0);
  assert.deepEqual(draftDay(d, 'Hét').exercises.map(e => e.name), ['Guggolás']);
});

test('set counts clamp between one and eight', () => {
  const d = newDraft();
  toggleDay(d, 'Hét'); addExercise(d, 'Hét', 'Guggolás');
  changeSets(d, 'Hét', 0, -5);
  assert.equal(draftDay(d, 'Hét').exercises[0].sets, 1);
  changeSets(d, 'Hét', 0, 99);
  assert.equal(draftDay(d, 'Hét').exercises[0].sets, 8);
});

test('minutes are an honest rough guess and an empty day is zero', () => {
  const d = newDraft();
  toggleDay(d, 'Hét');
  assert.equal(dayMinutes(draftDay(d, 'Hét')), 0);
  addExercise(d, 'Hét', 'Guggolás');
  assert.equal(dayMinutes(draftDay(d, 'Hét')), 8 + 3 * 4);
});

test('the draft knows its muscles: weekly sets and how many days reach them', () => {
  const d = newDraft();
  toggleDay(d, 'Hét'); toggleDay(d, 'Cs');
  addExercise(d, 'Hét', 'Fekvenyomás'); addExercise(d, 'Cs', 'Fekvenyomás'); addExercise(d, 'Cs', 'Guggolás');
  const chest = draftMuscles(d).find(r => r.key === 'chest-mid');
  assert.equal(chest.sets, 6);
  assert.equal(chest.days, 2);
  assert.equal(draftMuscles(d).find(r => r.key === 'quad').days, 1);
});

test('the ramp holds, climbs or climbs higher, and always rests at the end', () => {
  assert.deepEqual(rampSeries(6, 'maintain', 6), [6, 6, 6, 6, 6, 3]);
  assert.deepEqual(rampSeries(8, 'grow', 6), [8, 10, 12, 14, 14, 7]);
  assert.deepEqual(rampSeries(8, 'emphasize', 6), [8, 10, 12, 14, 16, 8]);
});

test('lint speaks up but never blocks: empty plan, empty day, back-to-back muscle', () => {
  assert.equal(lintDraft(newDraft())[0].say, 'Még nincs edzésnap a tervben.');
  const d = newDraft();
  toggleDay(d, 'Hét'); toggleDay(d, 'K'); toggleDay(d, 'P');
  addExercise(d, 'Hét', 'Fekvenyomás'); addExercise(d, 'K', 'Tárogatás kábelen');
  const notes = lintDraft(d).map(x => x.say);
  assert.ok(notes.some(s => s.includes('P napra')), 'the empty day is named');
  assert.ok(notes.some(s => s.includes('egymás utáni')), 'the adjacency is noted');
});

test('stamping puts a queued run on the shelf and derives its shape from the days', () => {
  const shelf = { planned: [] };
  const d = draftFromTemplate('vall-hat');
  d.name = 'Próbaterv';
  const run = stampRun(d, '2026-10-12', { planned: shelf.planned });
  assert.equal(shelf.planned.length, 1);
  assert.equal(run.name, 'Próbaterv');
  assert.equal(run.daysPerWeek, 4);
  assert.equal(run.from, 'vall-hat');
  assert.equal(run.start, '2026-10-12');
});

test('the catalog search is accent-blind and filters by region too', async () => {
  const { searchCatalog } = await import('./plan-wizard-state.js');
  assert.ok(searchCatalog('gugg').some(c => c.name === 'Guggolás'));
  assert.ok(searchCatalog('vall').some(c => c.muscle === 'shoulder-side'), 'a bare "vall" reaches the shoulder work');
  assert.equal(searchCatalog('', 'leg').every(c => ['quad', 'ham', 'glute', 'calf'].includes(c.muscle)), true);
  assert.equal(searchCatalog('nyomás', 'chest').every(c => c.muscle.startsWith('chest')), true);
  assert.deepEqual(searchCatalog('nincsilyen'), []);
});
