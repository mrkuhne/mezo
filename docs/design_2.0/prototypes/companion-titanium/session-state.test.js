import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXERCISES, createSession, logSet, undoSet, addSet, removeSet, moveExercise, setNote,
  finishSession, metrics, doneCount, setVerdict, inRange, nextOpen, legacyShape, e1rm,
  skipExercise, isSkipped, pendingCount, starsFor, sessionStars, starLedger,
} from './session-state.js';

const fresh = () => createSession();

test('a new session prescribes every planned set, none of them saved', () => {
  const s = fresh();
  assert.deepEqual(s.order, ['bench', 'row', 'press']);
  assert.equal(s.rows.bench.length, 3);
  assert.equal(metrics(s).planned, 9);
  assert.equal(metrics(s).count, 0);
});

test('checking the box saves the set and starts the session', () => {
  const s = fresh();
  assert.equal(logSet(s, 'bench', 0, { kg: 60, reps: 10, rir: 2 }), true);
  assert.equal(s.status, 'active');
  assert.ok(s.startedAt);
  assert.equal(doneCount(s, 'bench'), 1);
  assert.equal(metrics(s).volume, 600);
});

test('nonsense input never becomes a saved set', () => {
  const s = fresh();
  assert.equal(logSet(s, 'bench', 0, { kg: -5, reps: 10, rir: 2 }), false);
  assert.equal(logSet(s, 'bench', 0, { kg: 60, reps: 0, rir: 2 }), false);
  assert.equal(logSet(s, 'bench', 0, { kg: 60, reps: 10, rir: 11 }), false);
  assert.equal(logSet(s, 'nope', 0, { kg: 60, reps: 10, rir: 2 }), false);
  assert.equal(metrics(s).count, 0);
});

test('unchecking keeps the numbers but drops the set from the totals', () => {
  const s = fresh();
  logSet(s, 'bench', 0, { kg: 60, reps: 10, rir: 2 });
  assert.equal(undoSet(s, 'bench', 0), true);
  assert.equal(metrics(s).count, 0);
  assert.equal(s.rows.bench[0].kg, 60);
  assert.equal(undoSet(s, 'bench', 0), false);
});

test('an added set copies the previous one and is marked as extra', () => {
  const s = fresh();
  logSet(s, 'bench', 2, { kg: 62.5, reps: 8, rir: 1 });
  assert.equal(addSet(s, 'bench'), true);
  assert.equal(s.rows.bench.length, 4);
  assert.deepEqual({ ...s.rows.bench[3] }, { kg: 62.5, reps: 8, rir: 1, done: false, extra: true });
});

test('only an unchecked trailing set can be removed', () => {
  const s = fresh();
  assert.equal(removeSet(s, 'bench'), true);
  assert.equal(s.rows.bench.length, 2);
  logSet(s, 'bench', 1, { kg: 60, reps: 10, rir: 2 });
  assert.equal(removeSet(s, 'bench'), false);
  assert.equal(s.rows.bench.length, 2);
});

test('the last remaining set is never removable', () => {
  const s = fresh();
  removeSet(s, 'bench');
  removeSet(s, 'bench');
  assert.equal(s.rows.bench.length, 1);
  assert.equal(removeSet(s, 'bench'), false);
});

test('reordering moves an exercise and refuses to fall off either end', () => {
  const s = fresh();
  assert.equal(moveExercise(s, 'press', -1), true);
  assert.deepEqual(s.order, ['bench', 'press', 'row']);
  assert.equal(moveExercise(s, 'bench', -1), false);
  assert.equal(moveExercise(s, 'row', 1), false);
});

test('notes are kept per exercise and capped', () => {
  const s = fresh();
  assert.equal(setNote(s, 'bench', 'Vállban érzem.'), true);
  assert.equal(s.notes.bench, 'Vállban érzem.');
  setNote(s, 'bench', 'x'.repeat(400));
  assert.equal(s.notes.bench.length, 280);
  assert.equal(setNote(s, 'nope', 'hi'), false);
});

test('a session with no saved set cannot be finished', () => {
  const s = fresh();
  assert.equal(finishSession(s), false);
  logSet(s, 'bench', 0, { kg: 60, reps: 10, rir: 2 });
  assert.equal(finishSession(s), true);
  assert.equal(s.status, 'complete');
  assert.equal(logSet(s, 'bench', 1, { kg: 60, reps: 10, rir: 2 }), false);
});

test('the verdict compares with the same set last time, and knows a record', () => {
  const bench = EXERCISES[0];
  assert.equal(setVerdict(bench, 0, { kg: 60, reps: 10, rir: 2 }), 'up');
  assert.equal(setVerdict(bench, 0, { kg: 57.5, reps: 10, rir: 2 }), 'hold');
  assert.equal(setVerdict(bench, 0, { kg: 50, reps: 8, rir: 2 }), 'down');
  assert.equal(setVerdict(bench, 0, { kg: 65, reps: 8, rir: 1 }), 'record');
  assert.equal(setVerdict(bench, 0, { kg: 62.5, reps: 9, rir: 1 }), 'record');
});

test('the recommended rep range is reported honestly', () => {
  const bench = EXERCISES[0];
  assert.equal(inRange(bench, { reps: 10 }), true);
  assert.equal(inRange(bench, { reps: 8 }), true);
  assert.equal(inRange(bench, { reps: 13 }), false);
});

test('the next open exercise wraps around and disappears when nothing is left', () => {
  const s = fresh();
  assert.equal(nextOpen(s, 'bench'), 'row');
  s.order.forEach(id => s.rows[id].forEach((r, i) => logSet(s, id, i, { kg: 40, reps: 10, rir: 2 })));
  assert.equal(nextOpen(s, 'bench'), null);
});

test('the legacy shape exposes saved sets in order and nulls the rest', () => {
  const s = fresh();
  logSet(s, 'bench', 0, { kg: 60, reps: 10, rir: 2 });
  const legacy = legacyShape(s);
  assert.deepEqual(legacy.sets[0], [{ kg: 60, reps: 10, rir: 2 }, null, null]);
  assert.equal(legacy.status, 'active');
});

test('the one-rep-max estimate matches what the history card shows', () => {
  assert.equal(e1rm({ kg: 60, reps: 10 }), 80);
  assert.equal(e1rm({ kg: 62.5, reps: 8 }), 79.2);
});

test('skipping an exercise keeps its logged sets and clears the rest from pending', () => {
  const s = fresh();
  assert.equal(pendingCount(s), 9);
  logSet(s, 'press', 0, { kg: 20, reps: 10, rir: 2 });
  assert.equal(pendingCount(s), 8);
  assert.equal(skipExercise(s, 'press'), true);
  assert.equal(isSkipped(s, 'press'), true);
  assert.equal(pendingCount(s), 6);
  assert.equal(doneCount(s, 'press'), 1);
  skipExercise(s, 'press', false);
  assert.equal(pendingCount(s), 8);
});

test('a finished session refuses to be skipped around', () => {
  const s = fresh();
  logSet(s, 'bench', 0, { kg: 60, reps: 10, rir: 2 });
  finishSession(s);
  assert.equal(skipExercise(s, 'row'), false);
});

test('stars come in halves and never leave the 0..5 scale', () => {
  assert.equal(starsFor(0), 0);
  assert.equal(starsFor(1), 5);
  assert.equal(starsFor(0.5), 2.5);
  assert.equal(starsFor(0.44), 2);
  assert.equal(starsFor(1.9), 5);
  assert.equal(starsFor(-3), 0);
});

test('the session earns its stars from the work actually done', () => {
  const s = fresh();
  assert.equal(sessionStars(s), 0);
  s.order.forEach(id => s.rows[id].forEach((r, i) => logSet(s, id, i, { kg: 40, reps: 10, rir: 2 })));
  assert.equal(sessionStars(s), 5);
});

test('the week ledger puts the live session on today and leaves the future blank', () => {
  const s = fresh();
  logSet(s, 'bench', 0, { kg: 60, reps: 10, rir: 2 });
  const ledger = starLedger(s);
  assert.equal(ledger[2].today, true);
  assert.equal(ledger[2].stars, starsFor(1 / 9));
  assert.equal(ledger[3].stars, null);
  assert.equal(ledger[0].stars, 5);
});
