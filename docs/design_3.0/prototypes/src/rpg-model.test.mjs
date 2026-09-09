import test from "node:test";
import assert from "node:assert/strict";
import { createPresence } from "./presence-model.mjs";
import { hydrateComplete } from "./complete-model.mjs";
import {
  rpgStats,
  storageFor,
  levelProgress,
  RPG_ROLES,
} from "./rpg-model.mjs";
const seed = () => hydrateComplete(createPresence());
test("new visual variant owns separate storage and preserves navigation domains", () => {
  assert.notEqual(storageFor("rpg"), storageFor("boop"));
  assert.deepEqual(Object.keys(RPG_ROLES), [
    "home",
    "movement",
    "fuel",
    "life",
    "understanding",
  ]);
});
test("dashboard uses saved food, macros and targets", () => {
  const s = seed();
  s.full.meals = [{ id: "a", kcal: 500, protein: 30, carbs: 50, fat: 20 }];
  s.full.fuel.targets.kcal = 2600;
  const d = rpgStats(s);
  assert.equal(d.kcal, 500);
  assert.equal(d.remaining, 2100);
  assert.equal(d.macros.protein, 30);
});
test("logging XP cannot be increased by editing calories or duplicating identity", () => {
  const s = seed(),
    before = rpgStats(s).xp;
  s.full.meals[0].kcal = 10;
  assert.equal(rpgStats(s).xp, before);
  s.full.meals.push({ ...s.full.meals[0] });
  assert.equal(rpgStats(s).xp, before);
  s.full.meals.push({ id: "fresh", kcal: 100 });
  assert.equal(rpgStats(s).xp, before + 10);
});
test("level progress rolls over and empty logs never produce NaN", () => {
  assert.deepEqual(levelProgress(100), {
    level: 2,
    current: 0,
    next: 100,
    percent: 0,
  });
  const s = seed();
  s.full.meals = [];
  s.full.training.gymHistory = [];
  s.full.personal.weight.logs = [];
  const d = rpgStats(s);
  assert.equal(d.kcal, 0);
  assert.equal(d.volume, 0);
  assert.equal(d.latestWeight, null);
});
test("weekly volume understands formatted demo history values", () => {
  assert.equal(rpgStats(seed()).volume, 3240);
});
test("record panel reflects newly saved exercise records", async () => {
  const { rpgRecords } = await import("./rpg-model.mjs");
  const s = seed();
  s.full.training.gymHistory.unshift({
    id: "new",
    exercises: [
      { name: "Fekvenyomás rúddal", sets: [{ weight: 80, reps: 6 }] },
    ],
  });
  assert.equal(rpgRecords(s)[0].best, "80 kg × 6");
  assert.equal(rpgRecords(s)[0].source, "Naplózott rekord");
});
