# Fuel beállítások önálló Mozaik 2.0 oldal — Implementation Plan (mezo-2xzf)

> **For agentic workers:** REQUIRED SUB-SKILL: Use the repo-local `executing-plans`, `tdd`, `mezo-frontend`, and `verification-before-completion` skills. Execute tasks in order; every implementation change starts from a failing focused test.

**Goal:** A Fuel-beállítások teljes tartalma a drawer helyett önálló `/fuel/settings` oldalon jelenjen meg Huawei Health / Mozaik 2.0 vizuális nyelven, felfedezhető makróprofil-dropdownnal és az aktuális napi célból származó kcal + százalék + gramm előnézettel.

**Architecture:** Tiszta frontend view- és navigációs változás. A hub meglévő beállítás-sávja `navigate('/fuel/settings')` hívással nyitja a routed leaf page-et; a page a meglévő Fuel- és Diet-settings hookokat változatlanul használja. A makró-előnézet külön, tiszta helperben normalizálja a `useFuelDay().fuel.targets` protein/szénhidrát/zsír energiáját, ezért nem másolja le a backend célmotorját és nem ígér előre még el nem mentett célértéket. A mentés után a meglévő query invalidáció frissíti a tényleges napi célt.

**Tech Stack:** React 19, TypeScript, React Router, TanStack Query, Mozaik shared UI, CSS (`prototype.css`), Vitest + Testing Library + MSW, Playwright visual goldens.

**Design spec:** [`docs/superpowers/specs/2026-09-04-fuel-settings-page-design.md`](../specs/2026-09-04-fuel-settings-page-design.md)

**Driving issue:** `mezo-2xzf`

## Global Constraints

- Csak UI és navigáció változik: nincs REST/OpenAPI/backend/DTO módosítás, és a hook-signatúrák érintetlenek.
- Routed leaf neve `FuelSettingsPage`, helye `frontend/src/features/fuel/pages/`; a törölt sheet helyén nem marad kompatibilitási wrapper.
- Feature-kód adatot kizárólag `@/data/hooks` felől importál; deep absolute importok, új barrel nélkül.
- A fuel- és diet-draft külön `touched` flaget és külön late-arrival resync effectet tart meg. Egy fuel-mező szerkesztése nem fagyaszthatja be a későn érkező diet-adatot, és fordítva.
- A custom makróösszeg validációja változatlan: tizedszázalék-pontosságú összeg pontosan 100%; hibás összeg blokkolja a Mentést.
- Az előnézet az aktuális `fuel.targets` szerinti **valódi** kcal/p/c/f értéket mutatja. Mentetlen diet-draftnál külön „Mentés után frissül” jelzés jelenik meg; projektált grammokat nem fabrikálunk.
- A normalizált makrószázalékok egész számok és pontosan 100-at adnak ki; a helper determinisztikus legnagyobb-maradékos kerekítést használ.
- Minden felhasználónak látszó szöveg magyar; számformázás `hu-HU` locale-lal.
- A fő CTA portaled save barban, a tab bar fölött marad; folyamatban/érvénytelen draftnál disabled. Sikeres mentés `/fuel`-ra navigál, hiba esetén az oldal nyitva marad és a globális mutation toast dolgozik.
- Minden interaktív felületnek stabil accessible neve és `np-press` állapota van; a hero dekoratív grafikája nem duplázza a screen-reader tartalmat.
- Focused Vitest után build, teljes Vitest mindkét módban, Playwright visual/layout gate, CODEMAP-regenerálás és docs lint szükséges.
- Commit-tárgyak conventional commit formátumúak és tartalmazzák a `mezo-2xzf` id-t.

## Fájlstruktúra

| Fájl | Felelősség | Művelet |
|---|---|---|
| `frontend/src/features/fuel/logic/fuelSettingsPreview.ts` | honest kcal/makró cél-előnézet | új |
| `frontend/src/features/fuel/logic/fuelSettingsPreview.test.ts` | normalizálás, kerekítés, invalid célok | új |
| `frontend/src/features/fuel/pages/FuelSettingsPage.tsx` | routed beállítás-oldal, draftok, mentés | új |
| `frontend/src/features/fuel/pages/FuelSettingsPage.test.tsx` | mezők, dropdown, preview, cold-open, save/navigáció | új |
| `frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx` | régi drawer | törlés |
| `frontend/src/features/fuel/sheets/FuelSettingsSheet.test.tsx` | régi drawer tesztjei | törlés, lefedettsége a page tesztbe költözik |
| `frontend/src/features/fuel/pages/FuelMaiPage.tsx` | settings entry navigációja | módosítás |
| `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx` | hub → `/fuel/settings` regresszió | módosítás |
| `frontend/src/app/router.tsx` | új sibling route | módosítás |
| `frontend/src/styles/prototype.css` | izolált `.fset-*` Mozaik/Huawei stílus | módosítás |
| `frontend/tests/visual/visual.spec.ts` | settings page két témás goldenje | módosítás |
| `frontend/tests/visual/visual.spec.ts-snapshots/fuel-settings-*.png` | darwin vizuális baseline | új |
| `docs/features/fuel.md` | élő Fuel-dokumentáció | módosítás |
| `docs/CODEMAP.md` | generált fájltérkép | regenerálás |

---

### Task 1: Valódi napi célból számolt makró-előnézet

**Files:**
- Create: `frontend/src/features/fuel/logic/fuelSettingsPreview.ts`
- Test: `frontend/src/features/fuel/logic/fuelSettingsPreview.test.ts`

**Interfaces:**

```ts
export interface FuelSettingsTargetInput {
  kcal: number
  p: number
  c: number
  f: number
}

export interface FuelSettingsMacroPreview {
  kcal: number
  protein: { grams: number; pct: number }
  carbs: { grams: number; pct: number }
  fat: { grams: number; pct: number }
}

export function buildFuelSettingsMacroPreview(
  targets: FuelSettingsTargetInput,
): FuelSettingsMacroPreview | null
```

Az energia-súlyok `p * 4`, `c * 4`, `f * 9`. A százalékokhoz számold ki a floor értékeket, majd a még hiányzó pontokat a legnagyobb törtmaradék sorrendjében oszd ki; azonos maradéknál a stabil sorrend protein → carbs → fat. Nem véges/negatív érték vagy nulla teljes makróenergia esetén `null` az eredmény.

- [ ] **Step 1: Írd meg a bukó unit teszteket**

A `fuelSettingsPreview.test.ts` fedje le:

```ts
expect(buildFuelSettingsMacroPreview({ kcal: 3100, p: 220, c: 380, f: 95 })).toEqual({
  kcal: 3100,
  protein: { grams: 220, pct: 27 },
  carbs: { grams: 380, pct: 47 },
  fat: { grams: 95, pct: 26 },
})
```

Továbbá legyen külön teszt arra, hogy:

- törtmaradékos esetben a három százalék összege pontosan 100;
- az inputot nem mutálja;
- nulla/negatív/`NaN` céloknál `null`-t ad, tehát nem rajzol hazug 0%-os preview-t.

- [ ] **Step 2: Futtasd a focused tesztet és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm vitest run src/features/fuel/logic/fuelSettingsPreview.test.ts
```

Várt: FAIL, mert a helper modul még nem létezik.

- [ ] **Step 3: Implementáld a tiszta helpert**

Írd meg a fenti publikus interfészt és a determinisztikus normalizálást. Ne importáld a preset-konfigurációt és ne számolj a diet draftból új grammcélokat: ez a helper kizárólag a célmotor már kiszolgált céljait formázza.

- [ ] **Step 4: Futtasd újra a focused tesztet**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm vitest run src/features/fuel/logic/fuelSettingsPreview.test.ts
```

Várt: PASS, minden helper-teszt zöld.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && git add frontend/src/features/fuel/logic/fuelSettingsPreview.ts frontend/src/features/fuel/logic/fuelSettingsPreview.test.ts && git commit -m "feat(fuel): add honest macro target preview (mezo-2xzf)"
```

### Task 2: A sheet routed page-re költöztetése és a viselkedés megőrzése

**Files:**
- Create: `frontend/src/features/fuel/pages/FuelSettingsPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelSettingsPage.test.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx`
- Modify: `frontend/src/app/router.tsx`
- Delete: `frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx`
- Delete: `frontend/src/features/fuel/sheets/FuelSettingsSheet.test.tsx`

**Interfaces:**

- Reads unchanged: `useFuelSettings()`, `useFuelSettingsActions()`, `useDietSettings()`, `useDietSettingsActions()`, `useFuelDay()` from `@/data/hooks`.
- Writes unchanged: `setSettings({ mealsPerDay, caffeineCutoff })` és `setDiet({ splitPreset, pPct, cPct, fPct, proteinTier, waterMl, fiberG, dayTypeShiftKcal })`.
- Routes: hub band → `/fuel/settings`; back/save → `/fuel`; meal-window row → `/fuel/slots`.
- The page owns no dialog semantics. Root composition: `MozaikPage` → `PageHead` → `PageBody`, plus a portaled save bar into `.phone-screen`.

- [ ] **Step 1: Költöztesd át a sheet regressziós tesztjeit page-tesztként, még implementáció nélkül**

Hozd létre a `FuelSettingsPage.test.tsx`-et a régi sheet tesztjeinek tartalmi átemelésével. A render helper route-olt legyen:

```tsx
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const renderPage = () => render(
  <QueryWrapper>
    <MemoryRouter initialEntries={['/fuel', '/fuel/settings']} initialIndex={1}>
      <Routes>
        <Route path="/fuel" element={<LocationProbe />} />
        <Route path="/fuel/settings" element={<><FuelSettingsPage /><LocationProbe /></>} />
        <Route path="/fuel/slots" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  </QueryWrapper>,
)
```

Az új tesztek legalább ezeket bizonyítsák:

- nincs `dialog`, a „Fuel beállítások” page heading látszik;
- a ghost prefill 4 étkezés/nap és 14:00 koffein-stop;
- étkezésszám 3–6 között clampel;
- makróprofil **combobox**, benne mind az öt profil, és custom választáskor megjelennek a százalék-inputok;
- hibás custom összeg blokkolja a Mentést, helyes összeg engedi;
- protein tier, víz, rost és 50 kcal-os edzésnap-shift szerkeszthető és a pontos payload mentődik;
- az „Étkezési ablakok szerkesztése” `/fuel/slots`-ra navigál;
- sikeres Mentés mindkét mutationt meghívja, majd `/fuel`-ra navigál;
- mentés alatt a CTA disabled.

Másold át változatlan elvvel a két valódi módú cold-open tesztet is:

- a későn érkező Fuel GET újraszinkronizálja az érintetlen fuel draftot;
- a fetch közben módosított fuel draftot nem írja felül;
- a fuel módosítása közben későn érkező diet GET ettől még újraszinkronizálja az érintetlen diet draftot.

A hub tesztben cseréld az „opens FuelSettingsSheet” esetet erre:

```tsx
test('the Fuel-beállítások band navigates to its own page', async () => {
  renderView()
  await userEvent.click(screen.getByRole('button', { name: 'Fuel-beállítások' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/fuel/settings')
})
```

- [ ] **Step 2: Futtasd a két focused tesztfájlt és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm vitest run src/features/fuel/pages/FuelSettingsPage.test.tsx src/features/fuel/pages/FuelMaiPage.test.tsx
```

Várt: FAIL, mert `FuelSettingsPage`/route még nincs, a hub továbbra is sheetet nyit.

- [ ] **Step 3: Hozd létre a működő routed page-et a meglévő state machine megőrzésével**

A `FuelSettingsPage.tsx`-ben:

1. Vedd át a sheet lokális draft state-jeit és **külön** `touchedFuel`/`touchedDiet` guardjait.
2. Tartsd meg a két külön `useEffect` resyncet és a jelenlegi clamp/step/custom-sum logikát.
3. Kérd le a `useFuelDay()` célját, és memoizáld a `buildFuelSettingsMacroPreview(fuel.targets)` eredményét.
4. A profile control natív `<select aria-label="Makróprofil">`; opciói a `PRESET_LABELS` stabil sorrendjében jelenjenek meg.
5. A preview-ban `Intl.NumberFormat('hu-HU')` formázza a kcal- és grammértékeket. Ha a helper `null`, „A napi cél betöltése…” honest placeholder jelenjen meg.
6. Ha a diet draft eltér a betöltött `diet` értékeitől, a preview mellett jelenjen meg: `Mentés után frissül`.
7. A `save` `await Promise.all([setSettings(...), setDiet(...)])` után `navigate('/fuel')`; kivételnél ne navigáljon, ne nyelje el a mutation hibáját.
8. A portaled save bar csak böngésző DOM esetén készüljön; cél `document.querySelector('.phone-screen') ?? document.body`.

A Task 3 végleges vizuális osztályneveit már itt használd (`fset-page`, `fset-hero`, `fset-card`, `fset-preview`, `fset-save`), de ebben a taskban még csak a funkcionális DOM a cél.

- [ ] **Step 4: Kösd be a route-ot és a hub entry pointot**

- `router.tsx`: importáld a `FuelSettingsPage`-et és add hozzá a `{ path: 'fuel/settings', element: <FuelSettingsPage /> }` sibling route-ot a `/fuel` és `/fuel/slots` közelében.
- `FuelMaiPage.tsx`: töröld a `FuelSettingsSheet` importot, a `settingsOpen` state-et és a conditional sheet mountot; a sáv `onClick={() => navigate('/fuel/settings')}` legyen.
- Frissítsd az érintett kódkommenteket: többé sehol ne állítsák, hogy a sáv sheetet nyit vagy hogy a slots csak sheetből érhető el.

- [ ] **Step 5: Futtasd a focused teszteket, majd töröld a régi sheetet**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm vitest run src/features/fuel/pages/FuelSettingsPage.test.tsx src/features/fuel/pages/FuelMaiPage.test.tsx
```

Várt: PASS. Ezután töröld a `FuelSettingsSheet.tsx` és `FuelSettingsSheet.test.tsx` fájlokat, majd futtasd ugyanazt a parancsot újra. Egy célzott `rg -n "FuelSettingsSheet" frontend/src` keresésnek 0 találatot kell adnia.

- [ ] **Step 6: Commit**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && git add frontend/src/app/router.tsx frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/features/fuel/pages/FuelMaiPage.test.tsx frontend/src/features/fuel/pages/FuelSettingsPage.tsx frontend/src/features/fuel/pages/FuelSettingsPage.test.tsx frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx frontend/src/features/fuel/sheets/FuelSettingsSheet.test.tsx && git commit -m "feat(fuel): move settings from sheet to page (mezo-2xzf)"
```

### Task 3: Huawei/Mozaik 2.0 vizuális kompozíció és responsive polish

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelSettingsPage.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelSettingsPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Modify: `frontend/tests/visual/visual.spec.ts`
- Modify: `frontend/tests/visual/layout.spec.ts`
- Create: `frontend/tests/visual/visual.spec.ts-snapshots/fuel-settings-light-darwin.png`
- Create: `frontend/tests/visual/visual.spec.ts-snapshots/fuel-settings-dark-darwin.png`

**Visual anatomy:**

1. Kompakt `PageHead`: vissza + „Fuel beállítások”.
2. Zsálya hero: „Napi ritmus” eyebrow, élő étkezésszám, koffein-stop, 24 órás ív étkezéspontokkal és cutoff markerrel.
3. „Ritmus” floating card: étkezés/nap stepper + koffein-stop time input.
4. „Makrók” floating card: dropdown, valódi napi cél kcal, három színes macro sor százalék + gramm értékkel, custom inputok csak customnál.
5. Víz/rost két mini-tile, majd protein tier és edzésnap-shift card.
6. „Étkezési ablakok” navigációs row.
7. Fixen elérhető coral Mentés CTA a tab bar felett.

- [ ] **Step 1: Írd meg a vizuális anatómia bukó DOM-tesztjeit**

A `FuelSettingsPage.test.tsx`-et egészítsd ki:

- a root `.fset-page`, a hero `.fset-hero` és a fő cardok sorrendjének ellenőrzésével;
- a mock `3100/220/380/95` targetből `3 100 kcal`, `27% · 220 g`, `47% · 380 g`, `26% · 95 g` szövegek ellenőrzésével;
- a natív `Makróprofil` comboboxon `Alacsony szénhidrát` választással és a dirty-note ellenőrzésével;
- étkezésszám-változtatás után a hero ugyanazon élő számának frissülésével;
- annak ellenőrzésével, hogy a dekoratív ív `aria-hidden="true"`, miközben az összefoglaló szöveg hozzáférhető.

- [ ] **Step 2: Futtasd a focused page tesztet és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm vitest run src/features/fuel/pages/FuelSettingsPage.test.tsx
```

Várt: FAIL a még hiányzó hero/anatómia/preview szövegeken.

- [ ] **Step 3: Építsd meg a jóváhagyott kompozíciót**

A `FuelSettingsPage.tsx` markupja használja az `EntranceGroup`-ot a fő blokkok enyhe staggeréhez, de a beállítások állapota maradjon egyszerű kontrollált input. A hero íve CSS/SVG dekoráció lehet, a pontok száma a `mealsPerDay` draftból származzon; a koffein marker szöveges összefoglalója ugyanott hozzáférhető legyen.

A dropdown ne rejtse vízszintes görgetés mögé a profilokat. Az opciók:

```ts
balanced  → Kiegyensúlyozott
low_fat   → Alacsony zsír
low_carb  → Alacsony szénhidrát
high_carb → Magas szénhidrát
custom    → Egyéni
```

Az aktuális cél preview-ja nem változik optimistán profilváltáskor: ilyenkor a számok mellett a „Mentés után frissül” jelzés teszi világossá, hogy ezek még az aktív cél értékei.

- [ ] **Step 4: Írd meg az izolált `.fset-*` CSS-t**

A `prototype.css` végén, kommentelt Fuel-settings szekcióban készítsd el:

- sage/törtfehér hero és soft depth/shadow;
- maximum szélesség nélküli mobile-first layoutot a meglévő `.mz-page` kereten belül;
- 44 px minimum hit area stepperhez, selecthez és navigation rowhoz;
- kétszínű, kontrasztos macro legendát light/dark témában;
- sticky/portaled CTA safe-area és tab-bar távolságát;
- `@media (max-width: 380px)` töréspontot a víz/rost tile-ok és macro sorok töréséhez;
- `@media (prefers-reduced-motion: reduce)` alatt az új animációk kikapcsolását.

Ne módosíts globális `.row`, `.zcard`, `.recipe-save-bar` vagy Mozaik primitive szabályt; szükség esetén kompozíciós osztállyal bővítsd őket.

- [ ] **Step 5: Futtasd a focused tesztet**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm vitest run src/features/fuel/pages/FuelSettingsPage.test.tsx src/features/fuel/pages/FuelMaiPage.test.tsx
```

Várt: PASS.

- [ ] **Step 6: Adj visual és kis-kijelzős layout kaput**

A `visual.spec.ts` `SCREENS` listájába add:

```ts
['fuel-settings', '/fuel/settings'],
```

A `layout.spec.ts` mindkét `PHONE_VIEWPORTS` esetére ellenőrizze, hogy `/fuel/settings` oldalon:

- nincs vízszintes overflow (`scrollWidth <= clientWidth + 1`);
- az „Étkezési ablakok” és a Mentés gomb görgetéssel/kattintással elérhető;
- a portaled save bar nem takarja ki végleg az utolsó content sort.

- [ ] **Step 7: Frissítsd és ellenőrizd a darwin goldent**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm test:visual:update -- --grep "fuel-settings"
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm test:visual -- --grep "fuel-settings|Fuel settings"
```

Várt: light + dark `fuel-settings` screenshot és mindkét telefonméret layout-teszt zöld. Nyisd meg mindkét új PNG-t vizuális ellenőrzésre; csak szándékos eltérés kerülhet commitba.

- [ ] **Step 8: Commit**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && git add frontend/src/features/fuel/pages/FuelSettingsPage.tsx frontend/src/features/fuel/pages/FuelSettingsPage.test.tsx frontend/src/styles/prototype.css frontend/tests/visual/visual.spec.ts frontend/tests/visual/layout.spec.ts frontend/tests/visual/visual.spec.ts-snapshots/fuel-settings-*-darwin.png && git commit -m "feat(fuel): apply Mozaik settings page design (mezo-2xzf)"
```

### Task 4: Élő dokumentáció, teljes kapuk és kézi átadás

**Files:**
- Modify: `docs/features/fuel.md`
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Frissítsd az élő Fuel-dokumentációt**

A `docs/features/fuel.md`-ben írj át minden elavult `FuelSettingsSheet` hivatkozást:

- §2 route table: új `/fuel/settings` sor, entry point a hub band, leaf `FuelSettingsPage`;
- §2 `/fuel/slots`: most a settings page navigációs sorából érhető el;
- §9 döntés/gotcha: két külön touched guard, honest goal preview, mentetlen diet draftnál refresh-note;
- §10 file map: `pages/FuelSettingsPage.tsx` + `logic/fuelSettingsPreview.ts`, a sheet eltávolítása;
- röviden linkeld a jóváhagyott design specet és a driving issue-t.

Ne adj changelog-szekciót: az élő dokumentumot helyben írd át.

- [ ] **Step 2: Regeneráld a CODEMAP-et és futtasd a docs lintet**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && node scripts/gen-codemap.mjs
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && node scripts/lint-docs.mjs
```

Várt: 0 lint error; a Fuel feature doc key-file driftje megszűnik. Ha más, már a kezdőállapotban stale dokumentum warning marad, rögzítsd baseline-ként, de ne javíts scope-on kívüli fájlokat.

- [ ] **Step 3: Futtasd a teljes lokális frontend kapukat friss állapotból**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm build
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm test
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && VITE_USE_MOCK=true pnpm test
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo/frontend && pnpm test:visual
```

Várt: TypeScript/Vite build, real-mode Vitest, mock-mode Vitest, valamint a teljes Playwright visual+layout suite zöld.

- [ ] **Step 4: Ellenőrizd a scope-ot és az accessibility maradványokat**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && rg -n "FuelSettingsSheet|opens FuelSettingsSheet|only from FuelSettingsSheet" frontend/src docs/features/fuel.md
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && git diff --check
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && git status --short
```

Várt: az `rg` 0 találat, `git diff --check` 0 hiba, csak a terv szerinti doc/CODEMAP módosítások staged/unstagedek.

- [ ] **Step 5: Commitold a dokumentációt**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && git add docs/features/fuel.md docs/CODEMAP.md && git commit -m "docs(fuel): document settings page flow (mezo-2xzf)"
```

- [ ] **Step 6: Frissítsd a Beads issue-t a bizonyítékokkal**

Adj `bd` kommentet a focused/full gate eredményeiről, a két darwin visual golden kézi ellenőrzéséről és minden baseline warningról. Csak akkor zárd `mezo-2xzf`-et, amikor a branch push és a CI gate is sikeres.

- [ ] **Step 7: Push, linux visual baseline és self-PR CI gate**

```bash
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && bd dolt push
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && git push -u origin feat/fuel-settings-page
cd /Users/mrkuhne/.codex/worktrees/0d4c/mezo && gh workflow run update-visual-baselines.yml -r feat/fuel-settings-page
```

Várd meg a baseline workflow-t, húzd be a branchre írt linux snapshot commitot, majd nyisd meg a self-PR-t. A PR body sorolja fel a commitokat, a gate-ek kimenetét és az esetleges eltéréseket. Várd meg a `ci.yml` teljes zöld állapotát; pirosnál a hibát ugyanazon branchen javítsd és futtasd újra az érintett lokális kaput.

- [ ] **Step 8: Merge és lezárás a repo workflow szerint**

CI green után mainen `git pull --rebase`, majd a feature branchet `--no-ff` merge-eld, pushold a maint, töröld a feature branchet, és zárd a Beads issue-t. A végső `git status` mutasson tiszta, originhez képest up-to-date állapotot.

---

## Kész definíció

- A Fuel hub egyetlen beállítás entry pointja `/fuel/settings`-re navigál.
- A régi drawer és minden hivatkozása eltűnt.
- Minden korábbi mező, validáció, late-arrival/touched viselkedés és slots-navigáció megmaradt.
- A profilválasztás dropdown, a preview az aktív napi cél kcal + gramm + normalizált százalék adatait mutatja, mentetlen változtatásnál becsületes refresh-note-tal.
- A light/dark és 360/393 px nézetek vizuálisan és layout-invariánsokkal ellenőrzöttek.
- Feature doc, CODEMAP, Beads, commitok, push és CI gate rendezett.
