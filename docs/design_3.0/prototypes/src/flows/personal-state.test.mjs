import test from "node:test";
import assert from "node:assert/strict";
import {
  createPersonalState,
  sleepMinutes,
  saveSleep,
  saveWeight,
  savePerson,
  addContact,
  planEvent,
  saveRoutine,
  toggleRoutineStep,
  filterNotifications,
  markNotificationsRead,
} from "./personal-state.mjs";
test("sleep crosses midnight, including a midnight wake, without inventing a 24-hour night", () => {
  assert.equal(sleepMinutes("23:15", "07:00"), 465);
  assert.equal(sleepMinutes("21:30", "00:00"), 150);
  assert.equal(sleepMinutes("00:30", "08:00"), 450);
  assert.throws(() => sleepMinutes("07:00", "07:00"));
  assert.throws(() => sleepMinutes("25:00", "07:00"));
});
test("sleep validation and edits preserve history and the freshest latest metric", () => {
  const s = createPersonalState();
  const n = saveSleep(s, {
    id: "new",
    date: "2026-09-09",
    bed: "23:00",
    wake: "07:00",
    quality: 4,
    factors: ["Olvasás"],
  });
  assert.equal(n.sleep.latest.minutes, 480);
  assert.equal(s.sleep.logs.length + 1, n.sleep.logs.length);
  const e = saveSleep(n, { ...n.sleep.latest, wake: "07:30" });
  assert.equal(e.sleep.logs.length, n.sleep.logs.length);
  assert.equal(e.sleep.latest.minutes, 510);
  assert.throws(() =>
    saveSleep(s, { date: "", bed: "23:00", wake: "07:00", quality: 4 }),
  );
});
test("weight rejects empty/invalid values and editing older log never replaces latest", () => {
  const s = createPersonalState();
  assert.throws(() => saveWeight(s, { value: "", date: "2026-09-09" }));
  assert.throws(() => saveWeight(s, { value: -5, date: "2026-09-09" }));
  const n = saveWeight(s, { id: "old", value: 90, date: "2026-08-01" });
  assert.equal(n.weight.latest, s.weight.latest);
  const e = saveWeight(n, { id: "old", value: "89,4", date: "2026-08-01" });
  assert.equal(e.weight.logs.length, n.weight.logs.length);
  assert.equal(e.weight.logs.find((x) => x.id === "old").value, 89.4);
});
test("contact logging and a shared plan are separate dated records", () => {
  const s = createPersonalState();
  const p = savePerson(s, {
    id: "p-new",
    name: "  Luca  ",
    relationship: "Barát",
    importantDates: [],
    note: "",
  });
  assert.equal(p.people.find((x) => x.id === "p-new").name, "Luca");
  const c = addContact(p, "p-new", {
    id: "c",
    date: "2026-09-08",
    type: "Beszélgetés",
    note: "Hogy sikerült a vizsga?",
    feeling: "Feltöltött",
  });
  const e = planEvent(c, "p-new", {
    id: "e",
    date: "2026-09-12",
    time: "10:00",
    title: "Közös kávé",
    place: "Műhely",
  });
  assert.equal(e.people.find((x) => x.id === "p-new").contacts.length, 1);
  assert.equal(e.people.find((x) => x.id === "p-new").events.length, 1);
  assert.equal(
    e.people.find((x) => x.id === "p-new").events[0].status,
    "planned",
  );
  assert.throws(() => planEvent(c, "p-new", { date: "", title: "" }));
});
test("routine step checks are date scoped, reversible, and derived steps cannot be manually checked", () => {
  let s = saveRoutine(createPersonalState(), {
    id: "r-test",
    title: "Kicsi reggel",
    anchor: "Kávé után",
    time: "08:00",
    days: [1, 2, 3],
    steps: [
      { id: "a", title: "Nyújtás", kind: "manual" },
      { id: "b", title: "Súly", kind: "derived", route: "me-weight-log" },
    ],
  });
  s = toggleRoutineStep(s, "r-test", "a", "2026-09-08");
  assert.deepEqual(
    s.routines.find((x) => x.id === "r-test").checks["2026-09-08"],
    ["a"],
  );
  s = toggleRoutineStep(s, "r-test", "b", "2026-09-08");
  assert.deepEqual(
    s.routines.find((x) => x.id === "r-test").checks["2026-09-08"],
    ["a"],
  );
  s = toggleRoutineStep(s, "r-test", "a", "2026-09-08");
  assert.deepEqual(
    s.routines.find((x) => x.id === "r-test").checks["2026-09-08"],
    [],
  );
  assert.throws(() => saveRoutine(s, { title: "", days: [], steps: [] }));
});
test("inbox category and read filters combine; mark all read preserves links", () => {
  const s = createPersonalState();
  const before = s.notifications.length;
  const rows = filterNotifications(s.notifications, "people", true);
  assert.ok(rows.length);
  assert.ok(rows.every((x) => x.kind === "people" && !x.read));
  const n = markNotificationsRead(s);
  assert.equal(n.notifications.length, before);
  assert.equal(filterNotifications(n.notifications, "all", true).length, 0);
  assert.equal(n.notifications[0].route, s.notifications[0].route);
});
