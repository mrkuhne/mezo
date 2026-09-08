import test from "node:test";
import assert from "node:assert/strict";
import {
  createInsightState,
  decidePattern,
  saveFact,
  judgeClaim,
  closePrediction,
  accuracy,
  decideExperiment,
} from "./insight-state.mjs";
test("confirmed pattern creates one traceable fact and rejection disables it", () => {
  const seed = createInsightState();
  let s = decidePattern(seed, "walk-sleep", "confirmed");
  assert.equal(s.facts.filter((f) => f.patternId === "walk-sleep").length, 1);
  s = decidePattern(s, "walk-sleep", "confirmed");
  assert.equal(s.facts.filter((f) => f.patternId === "walk-sleep").length, 1);
  s = decidePattern(s, "walk-sleep", "rejected");
  assert.equal(
    s.facts.find((f) => f.patternId === "walk-sleep").enabled,
    false,
  );
  assert.equal(seed.patterns[0].status, "decide");
});
test("corrected fact replaces text and approval without changing unrelated facts", () => {
  const s = createInsightState();
  const next = saveFact(s, "f1", "Röviden, egy konkrét lépéssel segíts.", true);
  assert.equal(next.facts[0].text, "Röviden, egy konkrét lépéssel segíts.");
  assert.equal(next.facts[1], s.facts[1]);
  assert.throws(() => saveFact(s, "f1", " ", true));
});
test("claim feedback preserves correction and distinguishes rejected from active", () => {
  const s = judgeClaim(
    createInsightState(),
    "c1",
    "refine",
    "A reggeli edzés helyett a délutánit szeretem.",
  );
  assert.equal(s.claims[0].feedback, "refine");
  assert.match(s.claims[0].correction, /délután/);
  assert.equal(judgeClaim(s, "c1", "reject").claims[0].status, "retired");
});
test("prediction accuracy excludes pending forecasts and can correct outcome", () => {
  const seed = createInsightState();
  const before = accuracy(seed.predictions);
  let s = closePrediction(
    seed,
    "pred1",
    "validated",
    "Ma valóban könnyebben ment.",
  );
  assert.equal(accuracy(s.predictions).closed, before.closed + 1);
  s = closePrediction(s, "pred1", "missed", "Mégsem.");
  assert.equal(accuracy(s.predictions).closed, before.closed + 1);
  assert.equal(s.predictions[0].status, "missed");
  assert.equal(accuracy([]), null);
});
test("experiment approval is explicit and idempotent", () => {
  let s = createInsightState();
  s = decideExperiment(s, "exp1", "active");
  assert.equal(s.experiments[0].status, "active");
  assert.equal(
    decideExperiment(s, "exp1", "active").experiments.length,
    s.experiments.length,
  );
});

test("confirmation destination reuses existing fact IDs and linked experiment follows pattern", async () => {
  const { patternFactId, patternExperiment } = await import(
    "./insight-state.mjs"
  );
  let s = decidePattern(createInsightState(), "morning-plan", "monitoring");
  s = decidePattern(s, "morning-plan", "confirmed");
  assert.equal(patternFactId(s, "morning-plan"), "f2");
  assert.equal(
    patternFactId(decidePattern(s, "walk-sleep", "confirmed"), "walk-sleep"),
    "fact-walk-sleep",
  );
  assert.equal(patternExperiment(s, "protein-training").id, "exp2");
  assert.equal(patternExperiment(s, "caffeine"), null);
});
test("archived week stays in its own dates and never consumes current live results", async () => {
  const { weekSnapshot } = await import("./insight-state.mjs");
  const before = weekSnapshot(
    "previous",
    { workoutFinished: false },
    { kcal: 400 },
  );
  const after = weekSnapshot(
    "previous",
    { workoutFinished: true, personal: { sleep: { logs: [] } } },
    { kcal: 2600 },
  );
  assert.deepEqual(after, before);
  assert.equal(before.days[0].date, "2026-08-26");
  assert.equal(before.days.at(-1).date, "2026-09-01");
  assert.ok(before.days.every((d) => !d.route));
  const { createTrainState } = await import("./train-state.mjs");
  const current = weekSnapshot(
    "current",
    {
      training: createTrainState(),
      workoutFinished: true,
      completedSets: [1, 2],
      personal: { sleep: { logs: [{ date: "2026-09-08", minutes: 480 }] } },
    },
    { kcal: 2300 },
  );
  assert.equal(current.days.at(-1).kcal, 2300);
  assert.equal(current.days.at(-1).sleepMinutes, 480);
  assert.equal(
    current.days.find((d) => d.date === "2026-09-07").params.id,
    "gym-1",
  );
  assert.equal(
    current.days.find((d) => d.date === "2026-09-04").params.id,
    "gym-2",
  );
});

test("new dated movement changes current week counts and drilldowns, never archived data", async () => {
  const { weekSnapshot } = await import("./insight-state.mjs");
  const { createTrainState, logRun, logSport } = await import(
    "./train-state.mjs"
  );
  let training = createTrainState();
  const before = weekSnapshot("current", { training });
  const archive = weekSnapshot("previous", { training });
  training = logRun(training, {
    id: "new-run",
    date: "2026-09-08",
    distance: 5.2,
    duration: 34,
    rpe: 5,
  });
  training = logSport(training, {
    id: "new-sport",
    date: "2026-09-08",
    sport: "Röplabda",
    duration: 80,
    rpe: 6,
  });
  training = {
    ...training,
    gymHistory: [
      ...training.gymHistory,
      { id: "gym-today", name: "Pull Day", date: "2026-09-08", duration: 45 },
      { id: "outside", name: "Régebbi", date: "2026-08-20", duration: 100 },
    ],
  };
  const after = weekSnapshot("current", { training });
  assert.equal(after.completed, before.completed + 1);
  assert.equal(after.runningDistance, before.runningDistance + 5.2);
  assert.equal(
    after.days.at(-1).movementMinutes,
    before.days.at(-1).movementMinutes + 159,
  );
  assert.deepEqual(
    after.days
      .at(-1)
      .movements.map((x) => x.route)
      .sort(),
    ["train-gym-detail", "train-run-detail", "train-sport-detail"].sort(),
  );
  assert.equal(
    after.days.at(-1).movements.find((x) => x.route === "train-run-detail")
      .params.id,
    "new-run",
  );
  assert.deepEqual(weekSnapshot("previous", { training }), archive);
});
test("memoir reactions belong to their own chapter and can be toggled independently", async () => {
  const { toggleMemoirLike } = await import("./insight-state.mjs");
  const seed = createInsightState();
  const first = toggleMemoirLike(seed, "current");
  const both = toggleMemoirLike(first, "earlier");
  assert.deepEqual(first.memoirLikes, { current: true });
  assert.deepEqual(both.memoirLikes, { current: true, earlier: true });
  assert.equal(toggleMemoirLike(both, "current").memoirLikes.earlier, true);
  assert.equal(toggleMemoirLike(both, "current").memoirLikes.current, false);
});
