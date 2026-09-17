import test from "node:test";
import assert from "node:assert/strict";
import {
  createFuelState,
  draftFromText,
  draftTotals,
  setDraftQuantity,
  mealFromDraft,
  recipeNeeds,
  addRecipeShopping,
  purchaseShopping,
  savePantryItem,
  consumeRecipe,
  saveRecipe,
} from "./fuel-state.mjs";

test("text quantities become an editable draft; correction scales nutrition before logging", () => {
  const s = createFuelState();
  const draft = draftFromText(s, "150 g lazac, 200 g rizs");
  assert.equal(draft.ingredients.length, 2);
  assert.equal(draft.ingredients[0].amount, 150);
  const corrected = setDraftQuantity(draft, "salmon", 300);
  assert.equal(corrected.ingredients[0].amount, 300);
  assert.equal(draft.ingredients[0].amount, 150);
  assert.ok(draftTotals(s, corrected).kcal > draftTotals(s, draft).kcal);
  assert.equal(
    mealFromDraft(s, corrected, "new-meal").ingredients[0].amount,
    300,
  );
  assert.throws(() => mealFromDraft(s, { ...draft, ingredients: [] }, "empty"));
  assert.throws(() => setDraftQuantity(draft, "salmon", -1));
});
test("unknown free text is not silently replaced by sample food", () => {
  const draft = draftFromText(createFuelState(), "egy sajtos pizza");
  assert.equal(draft.ingredients.length, 0);
  assert.equal(draft.originalText, "egy sajtos pizza");
});
test("recipe portions, shortage, shopping and restock share the pantry quantities", () => {
  const s = createFuelState();
  const recipe = s.recipes.find((r) => r.id === "salmon-bowl");
  assert.equal(
    recipeNeeds(s, recipe, 2).find((i) => i.id === "salmon").required,
    300,
  );
  const listed = addRecipeShopping(s, recipe.id, 2);
  assert.ok(listed.shopping.length > 0);
  assert.deepEqual(
    addRecipeShopping(listed, recipe.id, 2).shopping,
    listed.shopping,
  );
  let bought = listed;
  for (const item of listed.shopping)
    bought = purchaseShopping(bought, item.id);
  assert.ok(recipeNeeds(bought, recipe, 2).every((i) => i.missing === 0));
  assert.ok(bought.shopping.every((i) => i.bought));
  assert.deepEqual(purchaseShopping(bought, listed.shopping[0].id), bought);
});
test("cooking consumes stock only if every ingredient is available", () => {
  const s = createFuelState();
  assert.throws(() => consumeRecipe(s, "salmon-bowl", 2));
  let filled = addRecipeShopping(s, "salmon-bowl", 2);
  for (const item of filled.shopping)
    filled = purchaseShopping(filled, item.id);
  const done = consumeRecipe(filled, "salmon-bowl", 2);
  assert.equal(done.pantry.find((i) => i.id === "salmon").stock, 0);
  assert.equal(done.cooked.length, 1);
  assert.ok(done.pantry.every((i) => i.stock >= 0));
});
test("pantry editing preserves recipe references and rejects invalid stock", () => {
  const s = createFuelState();
  const rice = s.pantry.find((i) => i.id === "rice");
  const changed = savePantryItem(s, {
    ...rice,
    stock: 900,
    name: "Barna rizs, főtt",
  });
  assert.equal(changed.pantry.length, s.pantry.length);
  assert.equal(
    recipeNeeds(changed, s.recipes[0], 1).find((i) => i.id === "rice").name,
    "Barna rizs, főtt",
  );
  assert.throws(() => savePantryItem(s, { ...rice, stock: -5 }));
});
test("recipe edits persist selected ingredients and reject zero servings", () => {
  const s = createFuelState();
  const r = { ...s.recipes[0], name: "Saját tál", servings: 2 };
  assert.equal(saveRecipe(s, r).recipes[0].name, "Saját tál");
  assert.throws(() => saveRecipe(s, { ...r, servings: 0 }));
});
