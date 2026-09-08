import test from 'node:test';
import assert from 'node:assert/strict';
import { rhythmPoints, budgetFraction } from './signature-model.mjs';
test('four daily milestones remain complete after additional check-ins', () => {
  assert.deepEqual(rhythmPoints(4, 5).map(p => p.state), ['done','done','done','done']);
  assert.deepEqual(rhythmPoints(4, 2).map(p => p.state), ['done','done','current','future']);
});
test('six-week arc places current week after completed weeks within drawing bounds', () => {
  const points = rhythmPoints(6, 2);
  assert.equal(points[2].state, 'current');
  assert.ok(points.every(p => p.x >= 28 && p.x <= 332 && p.y >= 16 && p.y <= 78));
  assert.equal(rhythmPoints(1, 0)[0].x, 180);
});
test('budget fill stays within its container even if target is exceeded or absent', () => {
  assert.equal(budgetFraction(1440, 2400), .6);
  assert.equal(budgetFraction(3000, 2400), 1);
  assert.equal(budgetFraction(100, 0), 0);
});
