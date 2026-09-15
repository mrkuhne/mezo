import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATHLETE, SPORTS, sportById, fieldsFor, defaultValues, personalFactor, kcalFor,
  runMet, bikeMet, metFor, estimate, sportStars,
} from './sport-state.js';

test('every sport is complete enough to render a form and an estimate', () => {
  assert.equal(SPORTS.length, 11);
  for (const sport of SPORTS) {
    assert.ok(sport.name && sport.art && sport.color, `${sport.id} lacks identity`);
    assert.ok(sport.fields.some(f => f.key === 'minutes'), `${sport.id} has no duration`);
    assert.ok(sport.muscles.length, `${sport.id} loads no muscle`);
    assert.ok(typeof sport.met === 'function' || sport.modes?.length, `${sport.id} cannot price itself`);
  }
});

test('the personal factor moves with lean mass, sex and age, and stays sane', () => {
  assert.equal(personalFactor({ sex: 'male', age: 30, bodyFatPct: 25 }), 1);
  assert.ok(personalFactor({ sex: 'female', age: 30, bodyFatPct: 25 }) < 1);
  assert.ok(personalFactor({ sex: 'male', age: 30, bodyFatPct: 10 }) > 1);
  assert.ok(personalFactor({ sex: 'male', age: 70, bodyFatPct: 25 }) >= 0.9);
  assert.ok(personalFactor({ sex: 'male', age: 18, bodyFatPct: 5 }) <= 1.05 * 1.08);
});

test('the MET formula matches the textbook for a plain body', () => {
  // 8 MET, 60 minutes, 70 kg, no personal correction ⇒ 8 × 3.5 × 70 / 200 × 60 = 588 kcal
  const plain = { weightKg: 70, sex: 'male', age: 30, bodyFatPct: 25 };
  assert.equal(kcalFor(8, 60, plain), 588);
});

test('no duration means no energy, and nonsense never becomes a number', () => {
  assert.equal(kcalFor(8, 0), 0);
  assert.equal(kcalFor(8, -30), 0);
  assert.equal(kcalFor(Number.NaN, 60), 0);
});

test('running and cycling price themselves from the pace held', () => {
  assert.ok(runMet(12) > runMet(8), 'faster running must cost more');
  assert.ok(bikeMet(30) > bikeMet(18));
  assert.equal(runMet(0), 0);
  assert.ok(runMet(60) <= 19, 'a nonsense pace is clamped');
});

test('a faster run of the same distance burns more per minute but not per session forever', () => {
  const run = sportById('run');
  const slow = estimate(run, { distance: 6, minutes: 45 }, null);
  const fast = estimate(run, { distance: 6, minutes: 30 }, null);
  assert.ok(fast.met > slow.met);
  assert.ok(slow.kcal > 0 && fast.kcal > 0);
});

test('a mode changes what a session costs', () => {
  const volley = sportById('volley');
  assert.ok(metFor(volley, {}, 'match') > metFor(volley, {}, 'training'));
});

test('fields hidden by the mode are not offered', () => {
  const volley = sportById('volley');
  assert.ok(fieldsFor(volley, 'match').some(f => f.key === 'sets'));
  assert.ok(!fieldsFor(volley, 'training').some(f => f.key === 'sets'));
  assert.equal(defaultValues(volley).minutes, 90);
});

test('the hike gets harder as the climb grows', () => {
  const hike = sportById('hike');
  const flat = estimate(hike, { distance: 9, minutes: 150, climb: 0 }, null);
  const steep = estimate(hike, { distance: 9, minutes: 150, climb: 900 }, null);
  assert.ok(steep.kcal > flat.kcal);
});

test('a 90 minute volleyball match lands in a believable range for this athlete', () => {
  const volley = sportById('volley');
  const { kcal } = estimate(volley, { minutes: 90, intensity: 7 }, 'match', ATHLETE);
  assert.ok(kcal > 600 && kcal < 1100, `got ${kcal}`);
});

test('stars weigh time first and effort second, and cap at five', () => {
  const volley = sportById('volley');
  assert.equal(sportStars(volley, { minutes: 90, intensity: 10 }).stars, 5);
  assert.equal(sportStars(volley, { minutes: 0, intensity: 0 }).stars, 0);
  const short = sportStars(volley, { minutes: 30, intensity: 10 });
  const long = sportStars(volley, { minutes: 90, intensity: 3 });
  assert.ok(long.stars > short.stars, 'the full session still beats a short hard one');
  assert.ok(short.stars > 0, 'a short hard session is not written off');
});
