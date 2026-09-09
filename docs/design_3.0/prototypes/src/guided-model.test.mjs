import test from "node:test";
import assert from "node:assert/strict";
import {
  SPACES,
  createGuided,
  selectSpace,
  selectTab,
  greet,
  addWater,
  logMeal,
  startWorkout,
  toggleSet,
  finishWorkout,
  dismissCelebration,
  foodBudget,
  doneSets,
} from "./guided-model.mjs";

test("seed is consistent with the space map", () => {
  const s = createGuided();
  assert.ok(SPACES[s.space]);
  for (const [space, tab] of Object.entries(s.tabs))
    assert.ok(SPACES[space].tabs.some(([id]) => id === tab), `${space}/${tab}`);
});

test("selectSpace and selectTab ignore unknown targets", () => {
  const s = createGuided();
  assert.equal(selectSpace(s, "nope"), s);
  assert.equal(selectSpace(s, "fuel").space, "fuel");
  assert.equal(selectTab(s, "nope"), s);
  assert.equal(selectTab(s, "het").tabs.nap, "het");
});

test("greeting is one-way", () => {
  assert.equal(greet(createGuided()).greeted, true);
});

test("water caps at the target", () => {
  let s = createGuided();
  for (let i = 0; i < 10; i++) s = addWater(s);
  assert.equal(s.water, s.waterTarget);
});

test("logMeal appends with defaults and rejects junk", () => {
  const s = createGuided();
  assert.equal(logMeal(s, { name: "x" }), s);
  const next = logMeal(s, { id: "m9", name: "Joghurt", kcal: 180 });
  assert.equal(next.meals.length, s.meals.length + 1);
  assert.equal(next.meals.at(-1).icon, "i-snack");
});

test("meal logging shrinks the remaining budget", () => {
  const s = createGuided();
  const before = foodBudget(s).remaining;
  const after = foodBudget(logMeal(s, { id: "m9", name: "Joghurt", kcal: 180 })).remaining;
  assert.equal(after, before - 180);
});

test("workout lifecycle: planned → active → done with celebration", () => {
  let s = createGuided();
  assert.equal(toggleSet(s, "s1"), s, "sets locked before start");
  assert.equal(finishWorkout(s), s, "cannot finish before start");
  s = startWorkout(s);
  assert.equal(s.workout.status, "active");
  assert.equal(startWorkout(s), s, "start is idempotent");
  s = toggleSet(s, "s1");
  assert.equal(doneSets(s), 1);
  s = toggleSet(s, "s1");
  assert.equal(doneSets(s), 0);
  s = finishWorkout(toggleSet(s, "s2"));
  assert.equal(s.workout.status, "done");
  assert.equal(s.celebration, true);
  assert.equal(dismissCelebration(s).celebration, false);
});
