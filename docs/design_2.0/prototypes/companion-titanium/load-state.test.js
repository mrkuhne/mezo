import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEEK_LOG, weekLoad, groupLoad, weekProgress, weekDays, loadStory } from './load-state.js';
import { MESO, weekTotal } from './plan-state.js';

test('a finished Monday credits exactly what Monday asked, muscle by muscle', () => {
  const rows = weekLoad();
  assert.equal(rows.find(r => r.key === 'shoulder-side').done, 3, 'Monday pressed the shoulder for three sets');
  assert.equal(rows.find(r => r.key === 'quad').done, 0, 'legs only come on Friday');
  for (const row of rows) assert.ok(row.done <= row.planned || row.left === 0, `${row.key} never owes negative work`);
});

test('groups add their heads and the share never lies past one', () => {
  const groups = groupLoad();
  const back = groups.find(g => g.key === 'back');
  assert.equal(back.done, 3, 'the Monday pull-ups landed on the wide back');
  assert.ok(groups.every(g => g.share >= 0 && g.share <= 1));
  assert.ok(groups[0].done >= groups[groups.length - 1].done, 'the worked groups lead, descending');
  const zeros = groups.filter(g => !g.done);
  assert.ok(zeros[0].planned >= zeros[zeros.length - 1].planned, 'untouched groups follow by what the plan asks');
});

test('the week progress counts every muscle the week touches, tracked or not', () => {
  const p = weekProgress();
  assert.equal(p.planned, weekLoad().reduce((t, r) => t + r.planned, 0));
  assert.ok(p.planned >= weekTotal(MESO), 'the day-only muscles add to the ask, never subtract');
  assert.equal(p.done, weekLoad().reduce((t, r) => t + r.done, 0));
  assert.ok(p.share > 0 && p.share < 1, 'mid-week sits honestly between empty and full');
});

test('work on a muscle the plan list does not track still counts', () => {
  const wide = weekLoad().find(r => r.key === 'back-wide');
  assert.equal(wide.done, 3, 'the Monday pull-ups are not lost');
  assert.equal(wide.planned, 3, 'its ask is what the days deliver');
});

test('the days know their state seen from the frozen Wednesday', () => {
  const days = weekDays();
  assert.equal(days.find(d => d.token === 'Hét').state, 'done');
  assert.equal(days.find(d => d.token === 'Sze').state, 'today');
  assert.equal(days.find(d => d.token === 'P').state, 'ahead');
  assert.equal(days.find(d => d.token === 'Szo').state, 'rest');
  assert.equal(days.find(d => d.token === 'K').sport.name, 'Röplabda');
});

test('the story leads with the hardest-worked group and names tonight', () => {
  const story = loadStory();
  assert.ok(story.percent > 0 && story.percent < 100);
  assert.equal(story.today.type, 'Felsőtest A');
  assert.match(story.say, /ma este/);
});

test('an empty week tells the truth instead of a zero parade', () => {
  const story = loadStory(MESO, { doneDays: [], sports: [] });
  assert.equal(story.say, 'Ez a hét még előtted áll.');
  assert.equal(story.lead, null);
});

test('the map heat speaks four honest states and never a fake percent', async () => {
  const { mapHeat } = await import('./load-state.js');
  const rows = mapHeat('done');
  assert.equal(rows.find(r => r.key === 'back-wide').state, 'done', 'the finished pull-up work is done');
  assert.equal(rows.find(r => r.key === 'quad').state, 'none', 'legs are untouched until Friday');
  assert.equal(rows.find(r => r.key === 'back-mid').state, 'none');
  assert.ok(rows.every(r => r.value >= 0 && r.value <= 1));
  const planned = mapHeat('planned');
  assert.ok(planned.every(r => r.state === 'planned'), 'the planned mode paints the ask, not progress');
});

test('the untouched list names what still waits, and sport reach stays an estimate list', async () => {
  const { untouched, sportTouched } = await import('./load-state.js');
  assert.ok(untouched().some(r => r.key === 'quad'));
  assert.ok(!untouched().some(r => r.key === 'back-wide'), 'worked muscles are not on the waiting list');
  assert.deepEqual(sportTouched(), ['shoulder-side', 'quad', 'calf', 'core']);
});

test('the movement week adds gym estimate and logged sport without mixing their honesty', async () => {
  const { movementWeek } = await import('./load-state.js');
  const m = movementWeek();
  assert.equal(m.gymMin, 8 + 12 * 4, 'one done gym day, estimated from its sets');
  assert.equal(m.sportMin, 95);
  assert.equal(m.totalMin, m.gymMin + m.sportMin);
  assert.equal(m.totalKcal, m.gymKcal + 610);
});
