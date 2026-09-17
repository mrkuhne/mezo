import test from "node:test";
import assert from "node:assert/strict";
import {
  createExplorationState,
  updateSlice,
  routeUrl,
  parseRoute,
  companionSuggestion,
  recordCheckIn,
  addNotification,
  addExplorationMeal,
  contextualReply,
  workoutRecord,
} from "./exploration-model.mjs";
test("fresh explorations do not leak domain state; slice changes preserve other domains", () => {
  const a = createExplorationState(),
    b = createExplorationState();
  const next = updateSlice(a, "companion", (s) => ({ ...s, checkin: "tired" }));
  assert.equal(b.companion.checkin, null);
  assert.equal(next.fuel, a.fuel);
  assert.equal(next.companion.checkin, "tired");
});
test("route keys and selected detail identifiers round-trip without encoding ambiguity", () => {
  const url = routeUrl("fuel-recipe", { id: "salmon & rice" });
  assert.deepEqual(parseRoute(url), {
    page: "fuel-recipe",
    params: { id: "salmon & rice" },
  });
  assert.equal(parseRoute("#").page, "home");
});
test("feeling tired changes proposed action without silently accepting a new plan", () => {
  const s = recordCheckIn(createExplorationState(), "tired");
  assert.equal(companionSuggestion(s).page, "train-recovery");
  assert.equal(s.companion.adjusted, false);
  assert.equal(s.workoutFinished, false);
  const ready = recordCheckIn(s, "ready");
  assert.equal(companionSuggestion(ready).page, "workout");
});
test("notification preserves exact linked object and only adds an unread item", () => {
  const s = createExplorationState(),
    next = addNotification(s, {
      id: "n-test",
      title: "Új felismerés",
      body: "Séta",
      route: "pattern",
      params: { id: "walk-sleep" },
    });
  assert.equal(next.personal.notifications[0].read, false);
  assert.deepEqual(next.personal.notifications[0].params, { id: "walk-sleep" });
  assert.equal(
    next.personal.notifications.length,
    s.personal.notifications.length + 1,
  );
});
test("AI review meal ID remains addressable and is not silently renamed", () => {
  const s = addExplorationMeal(createExplorationState(), {
    id: "review-1",
    name: "Tál",
    kcal: 500,
    protein: 30,
    carbs: 40,
    fat: 20,
  });
  assert.equal(s.meals.at(-1).id, "review-1");
  assert.equal(
    addExplorationMeal(s, {
      id: "review-1",
      name: "Tál",
      kcal: 500,
      protein: 30,
      carbs: 40,
      fat: 20,
    }).meals.length,
    s.meals.length,
  );
});

test("chat honours disabled linked knowledge after a pattern was confirmed", () => {
  const s = createExplorationState();
  s.insight.patterns[0].status = "confirmed";
  s.insight.facts.push({
    id: "fact-walk-sleep",
    patternId: "walk-sleep",
    enabled: false,
    status: "confirmed",
    text: "Séta",
  });
  const reply = contextualReply("Az alvásom mintája", s);
  assert.match(reply.text, /kikapcsoltad/);
  assert.doesNotMatch(reply.text, /Tudástárban is használható/);
});
test("disabled notification preferences suppress new alerts but preserve the inbox", () => {
  const s = createExplorationState();
  s.personal.preferences.categories.training = false;
  assert.equal(addNotification(s, { title: "Edzés", kind: "training" }), s);
  s.personal.preferences.enabled = false;
  assert.equal(addNotification(s, { title: "Minta", kind: "insight" }), s);
});
test("partial workout history contains only completed sets with their actual edited values", () => {
  const s = createExplorationState();
  s.completedSets = ["0-0", "0-2", "2-1"];
  s.setValues = { "0-0": { weight: 60, reps: 8 } };
  const row = workoutRecord(s);
  assert.equal(row.sets, 3);
  assert.equal(row.exercises.length, 2);
  assert.equal(row.exercises[0].sets.length, 2);
  assert.deepEqual(row.exercises[0].sets[0], { weight: 60, reps: 8 });
  assert.equal(
    Number(row.volume),
    row.exercises
      .flatMap((e) => e.sets)
      .reduce((n, s) => n + s.weight * s.reps, 0),
  );
});
