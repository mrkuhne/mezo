import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugOf, exerciseList, exerciseBySlug, whereUsed, libraryCounts } from './exercise-state.js';

test('slugs are accent-blind and route-safe', () => {
  assert.equal(slugOf('Fekvenyomás'), 'fekvenyomas');
  assert.equal(slugOf('Lehúzás széles fogással'), 'lehuzas-szeles-fogassal');
});

test('the list joins the catalog with the earned records, honestly', () => {
  const rows = exerciseList();
  const bench = rows.find(r => r.key === 'fekvenyomas');
  assert.equal(bench.logged.history.sessions, 12, 'the bench carries its real story');
  assert.equal(rows.find(r => r.key === 'labtolas').logged, null, 'an unlogged move claims nothing');
});

test('search and region filtering reach the same enriched rows', () => {
  assert.ok(exerciseList('vall').some(r => r.name === 'Oldalemelés'));
  assert.ok(exerciseList('', 'leg').every(r => ['quad', 'ham', 'glute', 'calf'].includes(r.muscle)));
  assert.equal(exerciseBySlug('evezes-csigan').name, 'Evezés csigán');
  assert.equal(exerciseBySlug('nincs-ilyen'), null);
});

test('a move knows the days and templates it appears in', () => {
  const bench = whereUsed('Fekvenyomás');
  assert.deepEqual(bench.days.map(d => d.type), ['Felsőtest A']);
  assert.deepEqual(bench.templates.map(t => t.key), ['nyari-tomeg']);
  assert.deepEqual(whereUsed('Csípőemelés').days, [], 'not in the running plan');
  assert.equal(whereUsed('Csípőemelés').templates.length, 1);
});

test('the headline numbers only count what exists', () => {
  const c = libraryCounts();
  assert.equal(c.logged, 3);
  assert.equal(c.medals, 6);
  assert.ok(c.total >= 17);
});
