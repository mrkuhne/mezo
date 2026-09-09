import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, logSet, finishWorkout, claimReward, buyAura, totals } from './state.mjs';

test('a full workout records exact volume and grants one reward only', () => {
  let state = initialState();
  for (let i = 0; i < 9; i++) state = logSet(state, 60, 10);
  assert.equal(totals(state).volume, 5400);
  assert.equal(state.xp, 1175);
  state = finishWorkout(state);
  state = claimReward(state);
  assert.equal(state.xp, 1375);
  assert.equal(state.coins, 1345);
  assert.equal(totals(state).level, 13);
  assert.deepEqual(claimReward(state), state);
  assert.throws(() => logSet(state, 60, 10));
});
test('invalid input and empty finish never grant rewards', () => {
  const state = initialState();
  for (const [kg, reps] of [[-1, 10], [60, 0], [NaN, 8], [60, 1.5], [Infinity, 8]]) {
    assert.throws(() => logSet(state, kg, reps));
  }
  assert.throws(() => finishWorkout(state));
  assert.throws(() => claimReward(state));
  assert.equal(state.logs.length, 0);
});
test('partial completion is honest and cosmetics spend coins once', () => {
  let state = finishWorkout(logSet(initialState(), 40, 8));
  assert.equal(totals(state).volume, 320);
  assert.equal(state.logs.length, 1);
  state = buyAura(state);
  assert.equal(state.coins, 995);
  assert.deepEqual(buyAura(state), state);
  assert.throws(() => buyAura({ ...initialState(), coins: 0 }));
});
