import test from "node:test";
import assert from "node:assert/strict";
import {
  createTrainState,
  buildMesoDraft,
  editDraftExercise,
  activateDraft,
  saveSportSlot,
  logSport,
  buildRunPlan,
  activateRunPlan,
  logRun,
  crossLoad,
  searchExercises,
} from "./train-state.mjs";

test("plan respects available equipment, frequency and sport recovery; edits survive activation", () => {
  const initial = createTrainState();
  const draft = buildMesoDraft({
    goal: "strength",
    frequency: 3,
    equipment: "home",
    sportLoad: "high",
    weeks: 6,
  });
  assert.equal(draft.days.length, 3);
  assert.ok(
    draft.days.every((d) =>
      d.exercises.every(
        (e) => !["bench", "pulldown", "row", "squat"].includes(e.id),
      ),
    ),
  );
  assert.ok(draft.days.every((d) => d.exercises.every((e) => e.sets <= 3)));
  const edited = editDraftExercise(
    draft,
    draft.days[0].id,
    draft.days[0].exercises[0].id,
    { sets: 2, reps: 12 },
  );
  const next = activateDraft({ ...initial, draft: edited }, "my-cycle");
  assert.equal(next.cycles.filter((c) => c.status === "active").length, 1);
  assert.equal(
    next.cycles.find((c) => c.id === "my-cycle").days[0].exercises[0].reps,
    12,
  );
  assert.equal(initial.cycles[0].status, "active");
  assert.throws(() => buildMesoDraft({ frequency: 0 }), /heti/);
  assert.throws(
    () =>
      editDraftExercise(
        draft,
        draft.days[0].id,
        draft.days[0].exercises[0].id,
        { sets: 0 },
      ),
    /sorozat/,
  );
});
test("multiple sport slots per day persist independently and edits replace only one slot", () => {
  let s = createTrainState();
  s = saveSportSlot(s, {
    id: "slot-new",
    day: 2,
    sport: "TRX",
    time: "12:00",
    duration: 35,
    location: "Terem",
  });
  assert.equal(s.schedule.filter((x) => x.day === 2).length, 2);
  s = saveSportSlot(s, {
    id: "slot-new",
    day: 2,
    sport: "TRX",
    time: "13:00",
    duration: 40,
    location: "Park",
  });
  assert.equal(s.schedule.filter((x) => x.id === "slot-new").length, 1);
  assert.equal(s.schedule.find((x) => x.id === "slot-new").duration, 40);
  assert.throws(
    () =>
      saveSportSlot(s, { day: 2, sport: "TRX", time: "99:00", duration: 30 }),
    /időpont/,
  );
});
test("sport logs require valid duration and effort, update load, and prevent duplicate slot logging", () => {
  const s = createTrainState();
  const before = crossLoad(s).sport;
  const n = logSport(s, {
    id: "new-log",
    slotId: "sport-tue",
    sport: "Röplabda",
    date: "2026-09-08",
    duration: 75,
    rpe: 7,
    notes: "Jó csapatjáték.",
  });
  assert.equal(n.sportLogs[0].notes, "Jó csapatjáték.");
  assert.ok(crossLoad(n).sport > before);
  assert.throws(
    () =>
      logSport(n, {
        slotId: "sport-tue",
        sport: "Röplabda",
        date: "2026-09-08",
        duration: 75,
        rpe: 7,
      }),
    /már/,
  );
  assert.throws(() => logSport(s, { duration: -1, rpe: 4 }), /időtartam/);
});
test("run plan preview activates independently of gym cycle and logs against session identity", () => {
  let s = createTrainState();
  const p = buildRunPlan({ goal: "5k", frequency: 2, weeks: 6, minutes: 25 });
  assert.equal(p.sessions.length, 2);
  s = activateRunPlan(s, p, "run-new");
  assert.equal(s.cycles[0].status, "active");
  s = logRun(s, {
    id: "runlog-new",
    planId: "run-new",
    sessionId: p.sessions[0].id,
    date: "2026-09-08",
    distance: 4.2,
    duration: 30,
    rpe: 5,
  });
  assert.equal(s.runLogs[0].pace, "7:09");
  assert.throws(
    () =>
      logRun(s, {
        planId: "run-new",
        sessionId: p.sessions[0].id,
        date: "2026-09-08",
        distance: 4,
        duration: 30,
        rpe: 5,
      }),
    /már/,
  );
  assert.throws(() => logRun(s, { distance: 0, duration: 30, rpe: 5 }), /táv/);
});
test("exercise search ignores accents and supports muscle filter; seeds are isolated", () => {
  assert.equal(searchExercises("guggolas", "all")[0].id, "squat");
  assert.ok(searchExercises("", "Hát").every((e) => e.muscle === "Hát"));
  const a = createTrainState(),
    b = createTrainState();
  a.schedule[0].duration = 999;
  assert.notEqual(a.schedule[0].duration, b.schedule[0].duration);
});
test("interval duration matches the advertised session even at the shortest allowed run", () => {
  const plan = buildRunPlan({
    goal: "base",
    frequency: 2,
    weeks: 2,
    minutes: 15,
  });
  for (const session of plan.sessions)
    assert.equal(
      session.intervals.reduce((sum, x) => sum + x.minutes, 0),
      session.duration,
    );
  assert.throws(() => buildMesoDraft({ frequency: 2.5 }), /heti/);
  assert.throws(
    () => buildRunPlan({ frequency: 2.5, weeks: 3, minutes: 20 }),
    /alkalom/,
  );
});

test("explicit stale plan and day IDs never resolve to a different active record", async () => {
  const { resolveCycle, resolveRunPlan, resolveCycleDay } = await import(
    "./train-state.mjs"
  );
  const s = createTrainState();
  assert.equal(resolveCycle(s).id, "cycle-current");
  assert.equal(resolveCycle(s, "missing"), undefined);
  assert.equal(resolveRunPlan(s).id, "run-current");
  assert.equal(resolveRunPlan(s, "missing"), undefined);
  assert.equal(resolveCycleDay(s.cycles[0], "missing"), undefined);
  assert.equal(resolveCycleDay(s.cycles[0]).id, s.cycles[0].days[0].id);
});
test("hub appointments follow schedule changes, logged slots and active running plan", async () => {
  const { hubAppointments } = await import("./train-state.mjs");
  const s = createTrainState();
  assert.equal(hubAppointments(s).sport.slot.id, "sport-tue");
  const logged = logSport(s, {
    slotId: "sport-tue",
    date: "2026-09-08",
    sport: "Röplabda",
    duration: 75,
    rpe: 6,
  });
  assert.equal(hubAppointments(logged).sport.log.id, logged.sportLogs[0].id);
  const withoutTuesday = {
    ...s,
    schedule: s.schedule.filter((x) => x.id !== "sport-tue"),
  };
  assert.equal(hubAppointments(withoutTuesday).sport.slot.id, "sport-wed");
  assert.equal(hubAppointments({ ...s, schedule: [] }).sport, undefined);
  const plan = {
    ...buildRunPlan({ goal: "5k", frequency: 2, weeks: 6, minutes: 35 }),
    sessions: [
      { id: "new-session", name: "Áthelyezett futás", day: 4, duration: 35 },
    ],
  };
  const next = activateRunPlan(s, plan, "new-active");
  assert.equal(hubAppointments(next).run.plan.id, "new-active");
  assert.equal(hubAppointments(next).run.session.day, 4);
});
test("seeded current seven-day gym history matches three completed weekly workouts", () => {
  const s = createTrainState();
  const week = s.gymHistory.filter(
    (h) => h.date >= "2026-09-02" && h.date <= "2026-09-08",
  );
  assert.equal(week.length, 3);
  assert.ok(week.some((h) => h.date === "2026-09-02"));
  assert.ok(
    week.every(
      (h) =>
        !h.exercises ||
        h.exercises.reduce((n, e) => n + e.sets.length, 0) === h.sets,
    ),
  );
});
