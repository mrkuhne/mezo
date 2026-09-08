import test from "node:test";
import assert from "node:assert/strict";
import { createState, reduce, nutrition, replyTo, FOODS } from "./model.mjs";

test("same mock day has consistent totals; adding food updates all summaries", () => {
  const state = createState();
  assert.equal(nutrition(state).kcal, 1260);
  const next = reduce(state, {
    type: "food",
    food: {
      id: "salmon",
      name: "Lazac rizzsel",
      kcal: 540,
      protein: 36,
      carbs: 48,
      fat: 22,
    },
  });
  assert.equal(nutrition(next).kcal, 1800);
  assert.equal(nutrition(next).protein, 128);
  assert.equal(state.meals.length, 3);
});
test("set completion toggles independently and finishing closes workout", () => {
  const one = reduce(createState(), { type: "set", key: "0-0" });
  const two = reduce(one, { type: "set", key: "0-1" });
  assert.deepEqual(two.completedSets, ["0-0", "0-1"]);
  assert.deepEqual(reduce(two, { type: "set", key: "0-0" }).completedSets, [
    "0-1",
  ]);
  assert.equal(reduce(two, { type: "finish" }).workoutFinished, true);
});
test("water, routine and confirmation persist without mutating unrelated data", () => {
  let state = createState();
  state = reduce(state, { type: "water" });
  state = reduce(state, { type: "routine" });
  state = reduce(state, { type: "confirm" });
  assert.equal(state.water, 2000);
  assert.equal(state.routineDone, true);
  assert.equal(state.patternConfirmed, true);
  assert.equal(nutrition(state).kcal, 1260);
});
test("scripted chat uses updated food context and preserves nonempty user messages", () => {
  const state = reduce(createState(), {
    type: "message",
    role: "user",
    text: " Mit egyek? ",
  });
  assert.equal(state.messages.at(-1).text, "Mit egyek?");
  assert.match(replyTo("Mit egyek?", state), /1140/);
  assert.equal(
    reduce(state, { type: "message", role: "user", text: "  " }).messages
      .length,
    state.messages.length,
  );
});
test("journal text is data; each new state is isolated", () => {
  const a = reduce(createState(), {
    type: "journal",
    text: "<script>bad</script>",
  });
  assert.equal(a.journal, "<script>bad</script>");
  assert.equal(createState().journal, "");
});
test("edited workout values remain attached to the correct set", () => {
  const state = reduce(createState(), {
    type: "setValue",
    key: "0-1",
    field: "weight",
    value: 52.5,
  });
  assert.equal(state.setValues["0-1"].weight, 52.5);
  assert.equal(state.setValues["0-0"], undefined);
});

test("chat suggestions distinguish food, week and walking in Hungarian", () => {
  const s = createState();
  assert.match(replyTo("Hogy áll a hetem?", s), /3 edzés/);
  assert.match(replyTo("Hogy áll a hét?", s), /3 edzés/);
  assert.match(replyTo("Mesélj az esti sétáról", s), /34 perccel/);
  assert.match(replyTo("Mit egyek edzés előtt?", s), /1140 kcal/);
});

test("food reply changes suggestion after a substantial meal", () => {
  const s = reduce(createState(), {
    type: "food",
    food: { ...FOODS[0], kcal: 810, protein: 54, carbs: 72, fat: 33 },
  });
  assert.match(replyTo("Mit egyek edzés előtt?", s), /330 kcal/);
  assert.match(replyTo("Mit egyek edzés előtt?", s), /joghurt/);
});
