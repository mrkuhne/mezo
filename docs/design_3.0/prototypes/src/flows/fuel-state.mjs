const food = (
  id,
  name,
  category,
  stock,
  kcal,
  protein,
  carbs,
  fat,
  aliases,
  expiry = "",
) => ({
  id,
  name,
  category,
  stock,
  unit: "g",
  kcal,
  protein,
  carbs,
  fat,
  aliases,
  expiry,
  source: "Szerkeszthető mintaadat · 100 g",
  notes: "",
});
export function createFuelState() {
  return {
    pantry: [
      food(
        "salmon",
        "Lazac",
        "Fehérje",
        150,
        208,
        20,
        0,
        13,
        ["lazac"],
        "2026-09-10",
      ),
      food("rice", "Főtt barna rizs", "Gabonák", 500, 123, 2.7, 26, 1, [
        "rizs",
      ]),
      food(
        "broccoli",
        "Brokkoli",
        "Zöldség",
        100,
        34,
        2.8,
        7,
        0.4,
        ["brokkoli", "zöldség"],
        "2026-09-11",
      ),
      food(
        "chicken",
        "Sült csirkemell",
        "Fehérje",
        400,
        165,
        31,
        0,
        3.6,
        ["csirke"],
        "2026-09-10",
      ),
      food("oats", "Zabpehely", "Gabonák", 600, 389, 17, 66, 7, ["zab"]),
      food(
        "yogurt",
        "Görög joghurt",
        "Tejtermék",
        300,
        73,
        10,
        4,
        2,
        ["joghurt"],
        "2026-09-12",
      ),
      food("berries", "Áfonya", "Gyümölcs", 100, 57, 0.7, 14, 0.3, ["áfonya"]),
      food("almond", "Mandula", "Magvak", 150, 579, 21, 22, 50, ["mandula"]),
      food("banana", "Banán", "Gyümölcs", 240, 89, 1.1, 23, 0.3, ["banán"]),
    ],
    recipes: [
      {
        id: "salmon-bowl",
        name: "Citromos lazactál",
        description:
          "Meleg rizs, omlós lazac, roppanós brokkoli. Egy nyugodt vacsora, kevés mosogatással.",
        kind: "salmon",
        category: "Vacsora",
        minutes: 25,
        servings: 1,
        saved: true,
        ingredients: [
          { id: "salmon", amount: 150 },
          { id: "rice", amount: 180 },
          { id: "broccoli", amount: 150 },
        ],
        steps: [
          {
            title: "Készíts mindent elő",
            body: "A brokkolit szedd rózsákra, a halat töröld szárazra. A főtt rizst készítsd a munkapult mellé.",
            minutes: 5,
          },
          {
            title: "Süsd meg a lazacot",
            body: "Enyhén sózd a lazacot. Süsd előmelegített sütőben, amíg átsül; a szükséges idő a szelet vastagságától függ.",
            minutes: 15,
          },
          {
            title: "Párolj és tálalj",
            body: "Párold puhára a brokkolit, melegítsd át a rizst, majd rendezd a lazac mellé. Ízlés szerint citrommal tálald.",
            minutes: 5,
          },
        ],
      },
      {
        id: "chicken-bowl",
        name: "Csirkés ebédtál",
        description: "Egy ismerős ebéd, amit a kamrádból is összeállíthatsz.",
        kind: "bowl",
        category: "Ebéd",
        minutes: 15,
        servings: 1,
        saved: false,
        ingredients: [
          { id: "chicken", amount: 150 },
          { id: "rice", amount: 180 },
          { id: "broccoli", amount: 100 },
        ],
        steps: [
          {
            title: "Adagold ki",
            body: "Mérd ki a főtt rizst és a már elkészített csirkét.",
            minutes: 3,
          },
          {
            title: "Párold a brokkolit",
            body: "Kevés vízzel párold a brokkolit a neked megfelelő állagúra.",
            minutes: 8,
          },
          {
            title: "Melegíts és tálalj",
            body: "A csirkét és a rizst alaposan melegítsd át. Tálald a brokkolival.",
            minutes: 4,
          },
        ],
      },
      {
        id: "berry-oats",
        name: "Áfonyás joghurtos zab",
        description:
          "Este összeállítod, reggel csak előveszed. Krémes, egyszerű, a saját adagoddal.",
        kind: "oats",
        category: "Reggeli",
        minutes: 5,
        servings: 1,
        saved: true,
        ingredients: [
          { id: "oats", amount: 60 },
          { id: "yogurt", amount: 150 },
          { id: "berries", amount: 80 },
          { id: "almond", amount: 15 },
        ],
        steps: [
          {
            title: "Keverd össze",
            body: "Forgasd a zabpelyhet a joghurtba. Adj hozzá kevés vizet a kívánt állaghoz.",
            minutes: 2,
          },
          {
            title: "Rétegezd",
            body: "Tedd rá az áfonyát és a durvára vágott mandulát. Lefedve hűtsd, vagy fogyaszd azonnal.",
            minutes: 3,
          },
        ],
      },
      {
        id: "banana-yogurt",
        name: "Banános joghurt",
        description: "Öt perc magadra, egy kanál és néhány ismerős hozzávaló.",
        kind: "oats",
        category: "Kisétkezés",
        minutes: 5,
        servings: 1,
        saved: false,
        ingredients: [
          { id: "yogurt", amount: 150 },
          { id: "banana", amount: 120 },
          { id: "almond", amount: 10 },
        ],
        steps: [
          {
            title: "Szeletelj",
            body: "Karikázd a banánt, a mandulát vágd durvára.",
            minutes: 2,
          },
          {
            title: "Állítsd össze",
            body: "Kanalazd tálba a joghurtot, majd tedd rá a banánt és a mandulát.",
            minutes: 3,
          },
        ],
      },
    ],
    shopping: [],
    draft: null,
    cooked: [],
    plan: [
      {
        id: "breakfast",
        name: "Reggeli",
        time: "08:00",
        recipeId: "berry-oats",
      },
      { id: "lunch", name: "Ebéd", time: "12:30", recipeId: "chicken-bowl" },
      { id: "dinner", name: "Vacsora", time: "19:00", recipeId: "salmon-bowl" },
    ],
    targets: { kcal: 2400, protein: 140, carbs: 280, fat: 75, water: 2500 },
  };
}
const positive = (n) => Number.isFinite(Number(n)) && Number(n) > 0;
export function draftFromText(
  state,
  text,
  source = "Szöveges mintaértelmezés",
) {
  const normalized = text.toLocaleLowerCase("hu");
  const ingredients = state.pantry.flatMap((item) => {
    const alias =
      item.aliases?.find((a) => normalized.includes(a)) ||
      (normalized.includes(item.name.toLocaleLowerCase("hu"))
        ? item.name.toLocaleLowerCase("hu")
        : null);
    if (!alias) return [];
    const index = normalized.indexOf(alias);
    const prefix = normalized.slice(Math.max(0, index - 16), index);
    const suffix = normalized.slice(
      index + alias.length,
      index + alias.length + 20,
    );
    const amount = Number(
      prefix.match(/(\d+(?:[.,]\d+)?)\s*g\s*$/)?.[1]?.replace(",", ".") ||
        suffix.match(/^\w*\s+(\d+(?:[.,]\d+)?)\s*g/)?.[1]?.replace(",", ".") ||
        100,
    );
    return [{ id: item.id, amount }];
  });
  return {
    name:
      ingredients.length === 1
        ? state.pantry.find((i) => i.id === ingredients[0].id).name
        : "Saját étkezés",
    originalText: text,
    source,
    kind: ingredients.some((i) => i.id === "salmon")
      ? "salmon"
      : ingredients.some((i) => i.id === "oats")
        ? "oats"
        : "bowl",
    time: "19:00",
    slot: "Vacsora",
    ingredients,
  };
}
export function setDraftQuantity(draft, id, amount) {
  if (!positive(amount)) throw Error("A mennyiség legyen nagyobb nullánál.");
  return {
    ...draft,
    ingredients: draft.ingredients.map((i) =>
      i.id === id ? { ...i, amount: Number(amount) } : i,
    ),
  };
}
export function draftTotals(state, draft) {
  return Object.fromEntries(
    ["kcal", "protein", "carbs", "fat"].map((key) => [
      key,
      Math.round(
        (draft?.ingredients || []).reduce(
          (sum, i) =>
            sum +
            ((state.pantry.find((p) => p.id === i.id)?.[key] || 0) * i.amount) /
              100,
          0,
        ),
      ),
    ]),
  );
}
export function mealFromDraft(state, draft, id) {
  if (
    !draft?.name?.trim() ||
    !draft.ingredients.length ||
    draft.ingredients.some((i) => !positive(i.amount))
  )
    throw Error("Adj meg nevet és legalább egy érvényes hozzávalót.");
  return {
    id,
    name: draft.name.trim(),
    ...draftTotals(state, draft),
    kind: draft.kind || "bowl",
    time: draft.time,
    slot: draft.slot,
    ingredients: draft.ingredients.map((i) => ({
      ...i,
      name: state.pantry.find((p) => p.id === i.id)?.name,
    })),
    assessment: {
      source: draft.source,
      confidence: "Becslés · ellenőrzött mennyiségek",
      originalText: draft.originalText,
    },
  };
}
export function recipeNeeds(state, recipe, portions = 1) {
  if (!positive(portions)) throw Error("Érvénytelen adagszám.");
  return recipe.ingredients.map((i) => {
    const item = state.pantry.find((p) => p.id === i.id);
    const required = Math.round((i.amount * portions) / recipe.servings);
    return {
      ...item,
      id: i.id,
      required,
      missing: Math.max(0, required - (item?.stock || 0)),
    };
  });
}
export function addRecipeShopping(state, recipeId, portions = 1) {
  const recipe = state.recipes.find((r) => r.id === recipeId);
  const shopping = state.shopping.map((i) => ({ ...i }));
  for (const item of recipeNeeds(state, recipe, portions).filter(
    (i) => i.missing > 0,
  )) {
    const existing = shopping.find((i) => i.id === item.id && !i.bought);
    if (existing) existing.amount = Math.max(existing.amount, item.missing);
    else {
      const old = shopping.findIndex((i) => i.id === item.id);
      const next = {
        id: item.id,
        name: item.name,
        amount: item.missing,
        unit: "g",
        bought: false,
      };
      if (old >= 0) shopping[old] = next;
      else shopping.push(next);
    }
  }
  return { ...state, shopping };
}
export function purchaseShopping(state, id) {
  const line = state.shopping.find((i) => i.id === id);
  if (!line || line.bought) return state;
  return {
    ...state,
    pantry: state.pantry.map((i) =>
      i.id === id ? { ...i, stock: i.stock + line.amount } : i,
    ),
    shopping: state.shopping.map((i) =>
      i.id === id ? { ...i, bought: true } : i,
    ),
  };
}
export function savePantryItem(state, item) {
  if (
    !item.name.trim() ||
    !Number.isFinite(Number(item.stock)) ||
    Number(item.stock) < 0 ||
    ["kcal", "protein", "carbs", "fat"].some(
      (k) => !Number.isFinite(Number(item[k])) || Number(item[k]) < 0,
    )
  )
    throw Error("Ellenőrizd a nevet és a nem negatív mennyiségeket.");
  const value = {
    ...item,
    stock: Number(item.stock),
    ...Object.fromEntries(
      ["kcal", "protein", "carbs", "fat"].map((k) => [k, Number(item[k])]),
    ),
  };
  return {
    ...state,
    pantry: state.pantry.some((i) => i.id === item.id)
      ? state.pantry.map((i) => (i.id === item.id ? value : i))
      : [...state.pantry, value],
  };
}
export function consumeRecipe(state, id, portions) {
  const r = state.recipes.find((r) => r.id === id);
  const needs = recipeNeeds(state, r, portions);
  if (needs.some((i) => i.missing))
    throw Error(
      "A készlet nem elég. Ellenőrizd a kamrát vagy egészítsd ki a bevásárlólistát.",
    );
  return {
    ...state,
    pantry: state.pantry.map((i) => ({
      ...i,
      stock: i.stock - (needs.find((n) => n.id === i.id)?.required || 0),
    })),
    cooked: [...state.cooked, { recipeId: id, portions, time: "Most" }],
  };
}
export function saveRecipe(state, recipe) {
  if (
    !recipe.name.trim() ||
    !positive(recipe.servings) ||
    !recipe.ingredients.length ||
    recipe.ingredients.some(
      (i) => !positive(i.amount) || !state.pantry.some((p) => p.id === i.id),
    )
  )
    throw Error("Adj meg nevet, adagszámot és hozzávalókat.");
  return {
    ...state,
    recipes: state.recipes.some((r) => r.id === recipe.id)
      ? state.recipes.map((r) => (r.id === recipe.id ? recipe : r))
      : [...state.recipes, recipe],
  };
}
