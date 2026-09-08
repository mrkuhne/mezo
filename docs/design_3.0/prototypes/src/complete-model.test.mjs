import test from "node:test";
import assert from "node:assert/strict";
import { createPresence, foodBudget } from "./presence-model.mjs";
import {
  hydrateComplete,
  updateComplete,
  saveLifeGoal,
  startSession,
  logSessionSet,
  finishSession,
  closeCycle,
  removeBodyLog,
} from "./complete-model.mjs";
test("migration preserves journal and full domain writes survive subsequent hydration", () => {
  let s = hydrateComplete({ ...createPresence(), journal: "Saját szöveg" });
  s = updateComplete(s, "meals", (m) => [
    ...m,
    { id: "new", kcal: 100, protein: 5, carbs: 10, fat: 4 },
  ]);
  assert.equal(s.journal, "Saját szöveg");
  assert.ok(hydrateComplete(s).full.meals.some((m) => m.id === "new"));
  assert.equal(
    foodBudget(s).logged,
    s.full.meals.reduce((n, m) => n + m.kcal, 0),
  );
});
test("goal validates target, persists pillar, edit keeps identity", () => {
  let s = hydrateComplete(createPresence());
  assert.throws(() => saveLifeGoal(s.full, { title: "", pillars: [] }));
  let full = saveLifeGoal(
    s.full,
    {
      title: "Nyugodt napok",
      dimension: "lelki",
      pillars: [{ title: "Séta", target: 3, value: 0 }],
    },
    "g-new",
  );
  assert.equal(full.lifeGoals.at(-1).pillars[0].target, 3);
  full = saveLifeGoal(full, {
    ...full.lifeGoals.at(-1),
    title: "Nyugodtabb napok",
  });
  assert.equal(full.lifeGoals.filter((g) => g.id === "g-new").length, 1);
});
test("workout only completes on explicit finish and resume preserves sets", () => {
  let full = hydrateComplete(createPresence()).full;
  full = startSession(full);
  const id = full.session.id;
  full = logSessionSet(full, 0, 0, { kg: 40, reps: 10, rir: 2, done: true });
  assert.equal(startSession(full).session.id, id);
  assert.throws(() =>
    logSessionSet(full, 0, 0, { kg: -1, reps: 10, rir: 2, done: true }),
  );
  full = finishSession(full);
  assert.equal(full.training.gymHistory[0].id, id);
  assert.equal(full.training.gymHistory[0].sets, 1);
  assert.equal(
    finishSession(full).training.gymHistory.length,
    full.training.gymHistory.length,
  );
});
test("closed cycle freezes its report and cannot be closed twice", () => {
  let full = hydrateComplete(createPresence()).full;
  const id = full.training.cycles[0].id;
  full = closeCycle(full, id, "Jó blokk");
  assert.equal(full.training.cycles[0].status, "archived");
  assert.equal(full.cycleReports[id].note, "Jó blokk");
  assert.equal(closeCycle(full, id, "Más"), full);
});

test("deleting the latest or final body entry keeps an honest empty state", () => {
  let f = hydrateComplete(createPresence()).full;
  for (const domain of ["weight", "sleep"]) {
    while (f.personal[domain].logs.length)
      f = removeBodyLog(f, domain, f.personal[domain].logs[0].id);
    assert.equal(f.personal[domain].latest, null);
    assert.equal(f.personal[domain].logs.length, 0);
  }
});
test("selected mesocycle day and custom workout retain their origin", () => {
  const f = hydrateComplete(createPresence()).full,
    c = f.training.cycles[0],
    d = c.days[1];
  assert.equal(startSession(f, { id: c.id, day: d.id }).session.title, d.name);
  assert.equal(startSession(f, { custom: "true" }).session.cycleId, undefined);
  const finished = finishSession(
    logSessionSet(startSession(f), 0, 0, {
      kg: 40,
      reps: 10,
      rir: 2,
      done: true,
    }),
  );
  assert.equal(finished.workoutFinished, true);
  assert.equal(finished.training.gymHistory[0].exercises[0].sets[0].weight, 40);
});
