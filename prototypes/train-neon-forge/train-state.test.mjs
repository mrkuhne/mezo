import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTrain, saveSport, saveRun, addSportSlot, activateMeso } from './train-state.mjs';
test('sport logs retain kind-specific values and do not complete other sessions', () => {
  const base = initialTrain();
  const next = saveSport(base, { kind: 'trx', duration: 45, rounds: 6, rpe: 7, notes: 'Stabil' });
  assert.equal(next.sportLogs.length, base.sportLogs.length + 1);
  assert.equal(next.sportLogs.at(-1).kind, 'trx');
  assert.equal(next.sportLogs.at(-1).rounds, 6);
  assert.deepEqual(next.runLogs, base.runLogs);
  assert.throws(() => saveSport(base, { kind: 'unknown', duration: 45, rounds: 6, rpe: 7 }));
  assert.throws(() => saveSport(base, { kind: 'trx', duration: 0, rounds: 6, rpe: 7 }));
});
test('running log is keyed to prescribed session and repeated save updates it', () => {
  const run = { key: 'wed', rounds: 6, rpe: 8, recovery: 50, notes: 'Jó' };
  const first = saveRun(initialTrain(), run);
  const next = saveRun(first, { ...run, rounds: 5 });
  assert.equal(next.runLogs.filter(r => r.key === 'wed').length, 1);
  assert.equal(next.runLogs.find(r => r.key === 'wed').rounds, 5);
  assert.throws(() => saveRun(first, { ...run, rounds: 31 }));
  assert.throws(() => saveRun(first, { ...run, key: 'future' }));
});
test('schedule supports multiple sports on a day and meso activation updates title', () => {
  const base = initialTrain();
  const next = addSportSlot(base, { day: 2, kind: 'cross', time: '12:00', duration: 45 });
  assert.equal(next.sportSchedule.filter(s => s.day === 2).length, 2);
  assert.equal(activateMeso(base, 'Erőépítés', 6).meso.title, 'Erőépítés');
  assert.throws(() => activateMeso(base, '', 6));
});
