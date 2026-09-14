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
  assert.ok(groups[0].planned >= groups[groups.length - 1].planned, 'sorted by how much the plan asks');
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
