# Receptműhely — AI-vezérelt recept builder (design spec)

- **Dátum:** 2026-09-01
- **bd issue:** mezo-92pb
- **Státusz:** jóváhagyott brainstorm-design; jelen kör szállítmánya a spec + a
  `docs/design_2.0/prototypes/receptmuhely.html` artifact-prototípus. Implementációs terv
  (writing-plans) csak a prototípus-iteráció lezárta után.

## 1. Probléma és cél

Daniel visszatérő workflow-ja: AI-jal beszélgetve rak össze egy receptet — mi legyen benne,
milyenek legyenek a makrói, kcal-breakdown, adagok — és a brainstorm végére áll össze a recept.
Ez ma az appon kívül történik. A Receptműhely ezt hozza be a Fuel alá: egy AI-vezérelt
recept-builder, ami kamra-itemekből és/vagy szabad szövegből indul, iterálható (adagok,
mennyiségek, makró-irány), és cél-presetekkel terelhető (high protein, pre-workout,
post-workout, lefekvés előtt, reggeli). A végeredmény a meglévő receptkönyvbe mentett recept
per-adag makrókkal.

## 2. Eldöntött irányok (brainstorm-válaszok)

1. **Interakciós modell: hibrid, vászon-first.** A képernyő maga az élő receptkártya
   („vászon"), alul dokkolt/felhúzható chat-sáv. Nem tiszta chat, nem form + AI-gombok.
2. **A recept sorsa: receptkönyvbe mentés.** A mentett recept a meglévő recept-entitásba
   kerül és később a Műhelyben újranyitható. (Fuel-logolás a meglévő recept-flow-n át már
   adott; kamra-levonás explicit későbbi fázis.)
3. **Elhelyezés: Fuel alá, saját belépési ponttal.** A Receptek oldalról nyílik
   („✨ Új recept a Műhelyben"), meglévő receptnél „Iterálás a Műhelyben" akció.
4. **Cél-presetek: kétszintűek.** A preset AI-instrukció az iterációhoz, ÉS ahol létező
   `MealRole`-nak felel meg (pre/post workout), a mentett recept `role` mezőjébe is beíródik.
   Új szerepek (before-bed, breakfast) későbbi enum-bővítés — nem e kör scope-ja.

## 3. Flow

Belépés → üres vászon + nyitó chat-prompt → input: szabad szöveg és/vagy kamra-picker
(`KamraPickSheet`-minta) → opcionális cél-preset chip → AI-kör: strukturált receptjavaslat →
a vászon frissül, a változott elemek kiemelve → iteráció chatben ÉS/VAGY kézzel
(mennyiség-szerkesztés, adag-stepper, sor törlés/csere) → „Mentés a Receptkönyvbe" →
recept-CRUD-ba ír (név, adagok, hozzávaló-sorok, elkészítés, role) → később újranyitható,
a műhely-beszélgetés a recepthez kötve folytatható.

## 4. A vászon anatómiája

Fentről lefelé:

- **Fejléc:** recept neve (AI javasolja, inline szerkeszthető) + cél-chip.
- **Makró-összkép:** kcal + P/C/F per adag; `ServingToggle`-mintájú per-adag/egész váltó;
  kcal-breakdown csík (hány kcal jön fehérjéből/szénhidrátból/zsírból).
- **Adag-stepper:** adagszám állítás; a hozzávaló-mennyiségek arányosan skálázódnak.
- **Hozzávaló-sorok:** kamra-találatos sor = név + inline szerkeszthető mennyiség +
  determinisztikusan számított makró-cellák; kamra-fedés nélküli (AI-javasolt szabad
  szöveges) sor = BECSLÉS-tag, vagy őszinte `—` a makró-cellákban ha becslés sincs
  (`MealComposer` / `NutrientCells empty="dashes"` idióma).
- **Elkészítés:** AI-írta lépések, összecsukható szekció.
- **Mentés-sáv** alul (a `RecipeEditorPage` portalozott save-bar mintájára).

## 5. Chat- és AI-kör-szemantika

- A chat-sáv alul dokkol (a `mezo-chat` work-strip vizuális családja), felhúzva teljes
  beszélgetés-történet.
- Minden AI-válasz **két rész**: rövid prózai indoklás a bubiban + **strukturált patch**
  a vászonra (hozzávaló hozzáadva/cserélve/mennyiség változott, név, lépések, adagszám).
- **Patch, nem regen:** az AI sosem generálja újra nulláról a receptet; a kézi szerkesztések
  kérés nélkül soha nem íródnak felül. A változott sorok pár másodpercre kiemelve villannak
  (diff-highlight). Ez a DishGen-féle „minden kör mindent felülír" csapda tudatos elkerülése.
- **Makrót soha nem az LLM mond:** a vászon számol a kamra-tényekből, a meglévő
  `lineContribution` matekkal (`recipeMacros.ts` ≡ `RecipeMapper`); per-adag = össz ÷ adagok.
  Az LLM hozzávaló-nevet + mennyiséget javasol; a nevet determinisztikus lépés párosítja
  kamra-itemhez (draft→validate pipeline, `MealAiDraftValidator` minta).
- Hiba esetén retry-bubi (F7.5 minta: a user-bubi marad, amber hibabubi Újra +
  Szerkesztés akcióval).

## 6. Presetek, cél-illeszkedés, mentés

- Preset-chipek a chat-sáv felett: **High protein · Pre-workout · Post-workout ·
  Lefekvés előtt · Reggeli** + „saját cél" szabad szöveg.
- A preset a beszélgetés rendszerinstrukciójába kerül; pre/post workout esetén mentéskor a
  recept `role` mezőjébe is (`MealRole.PRE_WORKOUT`/`POST_WORKOUT`).
- A vászon finom **cél-illeszkedés** jelzést adhat (a `RecipeFitBadge` szellemében; sosem
  büntető, piros tiltva — ADR 0010/0018 színszabályok). A makró-célok forrása az aktív cél
  előírása (`GoalPrescriptionJson`), nem statikus `mezo.nutrition.*` értékek.
- Mentés a meglévő recept-CRUD-ra épül. Figyelem: a `RecipeInput` full-replace — minden új
  recept-mező köteles átfolyni a `recipeToInput`-on (mezo-uavr lecke, teszt-pinelve).

## 7. Jelen kör szállítmánya: artifact-prototípus

- `docs/design_2.0/prototypes/src/receptmuhely-head.html` + `-body.html`, `./build.sh`
  sorral, README-táblázatsorral és „what it demonstrates" bekezdéssel; az összeállított
  `receptmuhely.html` Artifactként publikálva, stabil URL-lel — ezen iterálunk.
- A prototípus mock-adatokkal, kattintható demó-forgatókönyvvel mutatja: üres indulás →
  kamra-pick + szabad szöveg → AI-kör → patch-kiemelés → kézi mennyiség-állítás →
  adag-skálázás → preset-váltás → mentés.
- Vizuális család: fuel-mely (recept-mozaik + sheet-család) + mezo-chat (chat-sáv, orb,
  work-strip); Mozaik-2.0 page dress, clay ikonok, rise-choreográfia, reduced-motion guard.

## 8. Későbbi fázisok (tudatosan nem most)

- Kamra-készlet levonás főzéskor.
- `MealRole` enum-bővítés (BREAKFAST, BEFORE_BED, …) + scoring-rubrika overlay-ek.
- Backend implementáció: contract-first (`api/feature/recipe/` bővítés vagy új fragment),
  consumer-owned LLM-port (`RecipeWorkshopLlm` a recipe feature-ben, adapter a
  companion/llm alatt — ADR 0012, recipe→companion import tilos), feature-flag +
  `SwitchOff`/`LlmUnavailable` IT-k, őszinte 503-degrade a FE-n.
- Műhely-beszélgetés perzisztálása a recepthez.

## 9. Prior art (researcher-jelentés szűrve)

- **Átvéve — „AI azonosít, adatbázis számol"** ([MacrosFirst](https://www.blog.macrosfirst.com/post/we-rebuilt-ai-food-search-from-the-ground-up-here-s-why-it-s-more-accurate-than-ever),
  [NutriAdmin](https://nutriadmin.com/features/ai-recipe-generator)): az LLM hozzávalókat +
  mennyiségeket ad, a makró mindig adatbázis-tényekből számolódik; a nem-párosított sor
  láthatóan jelölt (nálunk: BECSLÉS-tag / `—`). Ez nálunk már házon belüli minta.
- **Átvéve — szerkeszthető „tányér" a chat mellett** ([MacroFactor](https://macrofactor.com/ai-food-logging/)):
  minden AI-eredmény inspektálható, inline szerkeszthető lista; az AI „gyors kollaborátor,
  nem elsődleges döntéshozó".
- **Átvéve — társalgási generate-then-refine loop + kamra-belépő** ([DishGen](https://www.dishgen.com/));
  **elvetve** a whole-recipe-regen szemantikája (kézi szerkesztések elvesznek) — helyette
  patch-szemantika.
- **Átvéve — strukturált kontrollok a chat mellett** ([Samsung Food](https://samsungfood.com/)):
  cél-presetek chipként, adag-skálázás dedikált stepperrel, nem chat-kéréssel.

## 10. Codebase terrain (investigator-jelentés szűrve)

- **Érintett feature-ök:** fuel (FE), recipe (BE, CRUD + breakdown — nincs saját
  feature-doc, fuel.md §2 fedi), pantry (BE, 3 meglévő LLM-pipeline), meal
  (`MealAiDraftService` + validator = a draft→validate pipeline sablon), nutrition
  (`MealRole`, scoring), companion (LLM-adapterek, chat-precedens).
- **Kulcsfájlok:** `RecipeEntity.java` (servings, role, ingredient-aggregate);
  `MealRole.java` (STANDARD/PRE_WORKOUT/POST_WORKOUT); `recipeHooks.ts` (dual-mode,
  „real mode never falls back to mock seeds"); `recipeMacros.ts` (`lineContribution` ≡
  `RecipeMapper`); `pantryPickables.ts`; `MealComposer.tsx` (✨ AI-panel, BECSLÉS-sorok);
  `RecipeEditorPage.tsx`/`RecipeDetailPage.tsx` (`recipeToInput` full-replace!);
  `ChatPage.tsx` + `chatHooks.ts` (streaming, retry-bubi); router: flat Fuel-útvonalak.
- **Követendő minták:** contract-first; consumer-owned LLM-port (ADR 0012) + ArchUnit
  irány-szabály; draft→validate; makró determinisztikus; FE modul-szabás
  (`@/data/hooks` barrel, Mozaik-2.0 dress, honest-null, never-punitive színek);
  mock-mód: `initialData` + canned AI-payload demo-késleltetéssel.
- **Csapdák:** CODEMAP-frissesség gate; contract-drift gate; `VITE_USE_MOCK` unset = mock;
  `RecipeInput` full-replace; docs-mandátum (fuel.md frissítés + lint-docs; eldöntendő,
  hogy a recipe kap-e végre saját feature-doc-ot); prototípus-fegyelem (src/ + build.sh,
  assembled fájl build-output).
