import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDayNavigation,
  dayDescriptor,
  dayRoute,
  swipeDayDelta,
} from './day-navigation-state.js';

test('the five daily roots share one selected date and never move beyond today', () => {
  const nav = createDayNavigation('2026-09-09');

  assert.equal(nav.date, '2026-09-09');
  assert.equal(nav.shift(-1), true);
  assert.equal(nav.date, '2026-09-08');
  assert.equal(nav.select('2026-09-01'), true);
  assert.equal(nav.date, '2026-09-01');
  assert.equal(nav.select('2026-09-10'), false);
  assert.equal(nav.date, '2026-09-01');
  assert.equal(nav.today(), true);
  assert.equal(nav.date, '2026-09-09');

  assert.equal(dayRoute('me', 1, ''), true);
  assert.equal(dayRoute('me', 2, ''), true);
  assert.equal(dayRoute('me', 3, ''), true);
  assert.equal(dayRoute('fuel', 0, ''), true);
  assert.equal(dayRoute('train', 0, ''), true);
  assert.equal(dayRoute('me', 1, 'weight-log'), false);
  assert.equal(dayRoute('nap', 0, ''), false);
});

test('a deliberate horizontal swipe changes one day in the natural direction', () => {
  assert.equal(swipeDayDelta({ startX: 300, endX: 210, startY: 200, endY: 210 }), 1);
  assert.equal(swipeDayDelta({ startX: 80, endX: 170, startY: 200, endY: 190 }), -1);
  assert.equal(swipeDayDelta({ startX: 200, endX: 175, startY: 100, endY: 102 }), 0);
  assert.equal(swipeDayDelta({ startX: 200, endX: 120, startY: 100, endY: 190 }), 0);
});

test('the date header distinguishes today, yesterday and older days', () => {
  assert.deepEqual(dayDescriptor('2026-09-09', '2026-09-09'), {
    eyebrow: 'MA',
    label: 'szeptember 9., szerda',
    isToday: true,
  });
  assert.equal(dayDescriptor('2026-09-08', '2026-09-09').eyebrow, 'TEGNAP');
  assert.equal(dayDescriptor('2026-09-07', '2026-09-09').eyebrow, '2 NAPPAL EZELŐTT');
});
