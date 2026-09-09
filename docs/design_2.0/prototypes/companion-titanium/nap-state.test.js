import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDay, addWater, saveCheckin, toggleHabit } from './nap-state.js';
test('water logs update hydration and reward the daily quest once', () => {
  const day = createDay();
  for (let i = 0; i < 3; i++) addWater(day);
  assert.equal(day.water, 2000);
  assert.equal(day.xp, 785);
  addWater(day);
  assert.equal(day.water, 2250);
  assert.equal(day.xp, 785);
});
test('editing one check-in replaces that slot, not the daily count', () => {
  const day = createDay();
  saveCheckin(day, 'nap', { energy: 7, stress: 4, body: 8, mind: 6 });
  saveCheckin(day, 'nap', { energy: 8, stress: 3, body: 8, mind: 7 });
  assert.equal(Object.keys(day.checkins).length, 2);
  assert.equal(day.checkins.nap.energy, 8);
});
test('manual habit can toggle but derived sleep completion is not self-claimed', () => {
  const day = createDay();
  assert.equal(toggleHabit(day, 'sleep'), false);
  assert.equal(day.habits.find(h => h.id === 'sleep').done, true);
  assert.equal(toggleHabit(day, 'sun'), true);
  assert.equal(day.habits.find(h => h.id === 'sun').done, true);
});
