import test from "node:test";
import assert from "node:assert/strict";
import {
  createPresence,
  selectRole,
  selectTab,
  recordPresenceCheckin,
  foodBudget,
  presenceReply,
  applyPresenceTool,
} from "./presence-model.mjs";
test("workspace switches retain local tab and conversation without changing training", () => {
  let s = createPresence();
  s = selectRole(s, "movement");
  s = selectTab(s, "gym");
  s = selectRole(s, "fuel");
  s = selectTab(s, "pantry");
  s = selectRole(s, "movement");
  assert.equal(s.tabs.movement, "gym");
  assert.equal(s.tabs.fuel, "pantry");
  assert.deepEqual(s.training, createPresence().training);
  assert.deepEqual(s.messages, createPresence().messages);
  assert.equal(selectRole(s, "invalid"), s);
});
test("checkins grow the daily rhythm and shared context without diagnosing or rewriting plans", () => {
  let s = createPresence();
  const before = s.training;
  s = recordPresenceCheckin(s, "tired", "Hosszú volt a nap.");
  assert.equal(s.checkins.length, 3);
  assert.equal(s.checkins.at(-1).slot, "Délután");
  assert.equal(s.checkins.at(-1).note, "Hosszú volt a nap.");
  assert.deepEqual(s.training, before);
  s = recordPresenceCheckin(s, "good", "");
  s = recordPresenceCheckin(s, "busy", "");
  assert.equal(s.checkins.length, 5);
  assert.equal(s.checkins.at(-1).slot, "Napközben");
  assert.equal(recordPresenceCheckin(s, "nonsense", ""), s);
});
test("a question about cancelling sport cannot silently change the sport-linked food budget", () => {
  const s = createPresence();
  const r = presenceReply("Mi lenne, ha elmaradna ma a röplabda?", s);
  assert.equal(r.tool, undefined);
  assert.equal(foodBudget(s).target, 2750);
  assert.equal(s.training.sportActive, true);
});
test("explicit cancellation changes only sport and linked budget; repeated tool execution is idempotent", () => {
  const s = createPresence();
  const r = presenceReply("A mai röplabda elmarad, vezesd át.", s);
  assert.equal(r.tool, "cancel-sport");
  const next = applyPresenceTool(s, r.tool);
  assert.equal(foodBudget(next).target, 2400);
  assert.equal(foodBudget(next).remaining, 960);
  assert.deepEqual(next.training.cycle, s.training.cycle);
  assert.deepEqual(applyPresenceTool(next, r.tool), next);
});
test("contextual chat reads new checkin and opens the existing mesocycle rather than generating a session", () => {
  let s = recordPresenceCheckin(createPresence(), "tired", "Sok volt a munka.");
  const reply = presenceReply("Hogy fér össze a mai edzés és a közérzetem?", s);
  assert.match(reply.text, /fáradtabb/);
  assert.deepEqual(reply.actions[0], {
    label: "A meglévő mezociklusom",
    role: "movement",
    tab: "gym",
  });
  assert.match(reply.sources.join(" "), /Délután/);
});
test("wellbeing conversation uses the saved journal and gratitude as context", () => {
  const s = createPresence();
  s.journal = "Ma hiányzott a nyugodt közös idő.";
  s.gratitude = "Jó volt együtt kávézni.";
  const r = presenceReply("Szeretnék beszélni arról, ami ma foglalkoztat.", s);
  assert.match(r.text, /hiányzott a nyugodt közös idő/);
  assert.match(r.text, /Jó volt együtt kávézni/);
});
test("already cancelled sport is not presented as an upcoming budget change", () => {
  const s = applyPresenceTool(createPresence(), "cancel-sport");
  const r = presenceReply("Mi lenne, ha elmaradna ma a röplabda?", s);
  assert.match(r.text, /már elmarad/);
  assert.equal(r.suggestion, undefined);
});
