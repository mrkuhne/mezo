import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MESO, TIERS, phaseOf, isDeloadWeek, ceilingOf, setsAt, currentSets, peakWeek, nextRollover,
  bandPosition, dayByToken, isTrainingDay, dayLoad, daySets, whereItWorks, weekTotal, adjacencyNotes,
  LIBRARY, template, closedRun, templateStory, closedShare,
} from './plan-state.js';

test('the run is internally consistent: a curve per week and a series per muscle', () => {
  assert.equal(MESO.phaseCurve.length, MESO.weeks);
  for (const muscle of MESO.muscles) {
    assert.equal(muscle.series.length, MESO.weeks, `${muscle.key} series does not cover the block`);
    assert.ok(muscle.mev < muscle.mav && muscle.mav < muscle.mrv, `${muscle.key} landmarks are out of order`);
    assert.ok(TIERS[muscle.tier], `${muscle.key} has an unknown focus`);
  }
});

test('the focus decides the ceiling', () => {
  const grow = MESO.muscles.find(m => m.tier === 'grow');
  const emphasize = MESO.muscles.find(m => m.tier === 'emphasize');
  const maintain = MESO.muscles.find(m => m.tier === 'maintain');
  assert.equal(ceilingOf(grow), grow.mav);
  assert.equal(ceilingOf(emphasize), emphasize.mrv);
  assert.equal(ceilingOf(maintain), maintain.mev);
});

test('the phase reads Rámpa, Csúcs and Deload off the curve', () => {
  assert.equal(phaseOf(MESO, 1).key, 'ramp');
  assert.equal(phaseOf(MESO, 5).key, 'peak');
  assert.equal(phaseOf(MESO, 6).key, 'deload');
  assert.equal(isDeloadWeek(MESO, 6), true);
  assert.equal(isDeloadWeek(MESO, 3), false);
});

test('the peak week is the last one before the deload', () => {
  assert.equal(peakWeek(MESO), 5);
});

test('a maintaining muscle holds all the way, a growing one climbs', () => {
  const maintain = MESO.muscles.find(m => m.tier === 'maintain');
  assert.equal(setsAt(maintain, 1), setsAt(maintain, 5));
  const grow = MESO.muscles.find(m => m.key === 'chest-mid');
  assert.ok(setsAt(grow, 4) > setsAt(grow, 1));
});

test('Monday says per muscle whether it climbs, holds, or drops into the deload', () => {
  const soon = nextRollover(MESO);
  assert.equal(soon.week, 4);
  assert.equal(soon.deload, false);
  const chest = soon.rows.find(r => r.key === 'chest-mid');
  assert.equal(chest.move, 'up');
  assert.equal(chest.delta, 2);
  const held = soon.rows.find(r => r.tier === 'maintain');
  assert.equal(held.move, 'hold');
  assert.equal(held.delta, 0);
});

test('the week before the deload announces the deload, and the last week announces nothing', () => {
  const intoDeload = nextRollover({ ...MESO, currentWeek: 5 });
  assert.equal(intoDeload.deload, true);
  assert.ok(intoDeload.rows.every(r => r.move === 'deload'));
  assert.deepEqual(nextRollover({ ...MESO, currentWeek: 6 }), { week: null, rows: [] });
});

test('the band knows where you stand and whether you are at your ceiling', () => {
  const back = MESO.muscles.find(m => m.key === 'back-mid');
  const position = bandPosition(back);
  assert.equal(position.now, 16);
  assert.equal(position.ceiling, back.mrv);
  assert.equal(position.inZone, true);
  assert.equal(position.atCeiling, false);
  const maintain = MESO.muscles.find(m => m.tier === 'maintain');
  assert.equal(bandPosition(maintain).atCeiling, true, 'a maintaining muscle sits on its ceiling by design');
});

test('days resolve by token and rest days are simply absent', () => {
  assert.equal(dayByToken('Sze').type, 'Felsőtest A');
  assert.equal(dayByToken('Vas'), null);
  assert.equal(isTrainingDay('P'), true);
  assert.equal(isTrainingDay('Szo'), false);
});

test('a day reports its own working sets per muscle', () => {
  const day = dayByToken('P');
  assert.equal(daySets(day), 14);
  const load = dayLoad(day);
  assert.equal(load.find(r => r.key === 'quad').sets, 4);
  assert.equal(load.length, 4);
});

test('a muscle worked twice in one day is summed, not listed twice', () => {
  const day = { exercises: [{ muscle: 'chest-mid', sets: 3 }, { muscle: 'chest-mid', sets: 2 }] };
  assert.deepEqual(dayLoad(day), [{ key: 'chest-mid', sets: 5 }]);
});

test('where a muscle works names the days and the exercises behind the number', () => {
  const rows = whereItWorks('shoulder-side');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.day), ['Hét', 'Sze']);
  assert.equal(rows.reduce((total, r) => total + r.sets, 0), 6);
  assert.deepEqual(whereItWorks('nincs-ilyen'), []);
});

test('the week total adds up every muscle at the current week', () => {
  assert.equal(weekTotal(MESO), MESO.muscles.reduce((t, m) => t + m.series[2], 0));
});

test('back-to-back days sharing a muscle are noted, and a gap is not', () => {
  const notes = adjacencyNotes();
  assert.deepEqual(notes, [], 'Hét / Sze / P leave a rest day between every pair');
  const tight = adjacencyNotes({
    ...MESO,
    days: [
      { day: 'Hét', type: 'A', exercises: [{ muscle: 'chest-mid', sets: 3 }] },
      { day: 'K', type: 'B', exercises: [{ muscle: 'chest-mid', sets: 3 }] },
    ],
  });
  assert.equal(tight.length, 1);
  assert.deepEqual(tight[0], { key: 'chest-mid', from: 'Hét', to: 'K' });
});

test('the library is internally consistent: dates ordered, honest counts, known sources', () => {
  for (const run of LIBRARY.closed) {
    assert.ok(run.start < run.end, `${run.key} runs backwards`);
    assert.ok(run.done <= run.planned, `${run.key} claims more sessions than planned`);
    assert.ok(run.stars >= 0 && run.stars <= 5, `${run.key} stars off the scale`);
    assert.ok(LIBRARY.templates.some(t => t.key === run.from), `${run.key} came from an unknown template`);
    for (const m of run.muscles) assert.ok(m.peak >= m.start, `${run.key}/${m.key} peaked below its start`);
  }
  for (const run of LIBRARY.planned) {
    assert.ok(LIBRARY.templates.some(t => t.key === run.from), `${run.key} came from an unknown template`);
  }
  assert.ok(LIBRARY.templates.some(t => t.key === LIBRARY.active.from), 'the running block has an unknown source');
});

test('templates and closed runs resolve by key, and a miss is null not a crash', () => {
  assert.equal(template('alap-ero').name, 'Alapból erő');
  assert.equal(template('nincs'), null);
  assert.equal(closedRun('hyper-nyar').records, 7);
  assert.equal(closedRun('nincs'), null);
});

test('a template tells its whole story: what runs now, what waits, what closed', () => {
  const alap = templateStory('alap-ero');
  assert.equal(alap.activeNow, MESO);
  assert.deepEqual(alap.planned.map(r => r.key), ['osz-ero']);
  assert.deepEqual(alap.closed.map(r => r.key), ['tavasz-alap']);
  const nyar = templateStory('nyari-tomeg');
  assert.equal(nyar.activeNow, null);
  assert.deepEqual(nyar.closed.map(r => r.key), ['hyper-nyar']);
});

test('the delivered share is honest and capped', () => {
  assert.equal(closedShare({ done: 15, planned: 18 }), 15 / 18);
  assert.equal(closedShare({ done: 20, planned: 18 }), 1);
  assert.equal(closedShare({ done: 3, planned: 0 }), 0);
});
