# Kamra — „Keresés (OFF)" import mód eltávolítása · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az `ImportItemSheet` háromról két módra (Fotó · Link) szűkül; a Keresés (OFF) mód és a hozzá tartozó frontend lookup-réteg törlődik.

**Architecture:** Tisztán frontend deléció. A sheet megosztott 3-fázisú váza (`input → searching → preview`) marad, csak a `search` mód ágai esnek ki; az alapértelmezett mód `'photo'`. A `lookupItems` hook / `pantryApi.lookup` / mock fixture / MSW handler törlődik. A backend `/api/pantry-import/lookup` endpoint és a generált `api.gen.ts` **változatlan**.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, MSW (real-mode tesztek), pnpm.

**Spec:** `docs/superpowers/specs/2026-09-02-kamra-off-search-removal-design.md` · **bd:** `mezo-ymt4`

## Global Constraints

- Frontend-only: `backend/` alatt semmi nem módosul, `frontend/src/data/_client/api.gen.ts` nem módosul.
- A `PantryLookupItem` **típus** marad (`frontend/src/data/types.ts:384`) — a `PantryScrapeDraft` és a `PantryImportInput` ebből származik.
- UI-copy magyar, a meglévő hangnemben; a `chip` / `cta-primary` / `cta-ghost` osztályok és az inline-style konvenció változatlan.
- Minden commit conventional-commit subject a bd id-vel: `... (mezo-ymt4)`.
- A gate mindkét FE módban fut: mock (`pnpm test`) és real (`VITE_USE_MOCK=false pnpm test`) — a bare `pnpm test` önmagában vacuum.

---

### Task 1: `ImportItemSheet` — a Keresés mód kivágása

**Files:**
- Modify: `frontend/src/features/fuel/sheets/ImportItemSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/ImportItemSheet.test.tsx`

**Interfaces:**
- Consumes: `usePantryActions()` → `{ importItem, scrapeItem, photoExtract }` (a `lookupItems` mező a Task 2-ben tűnik el a hookból; ez a task már **nem** destrukturálja).
- Produces: a sheet publikus felülete változatlan — `ImportItemSheet({ onClose }: { onClose: () => void })`.

- [ ] **Step 1: Írd át a teszteket (a piros lépés)**

`frontend/src/features/fuel/sheets/ImportItemSheet.test.tsx` — töröld ezt a négy tesztet teljesen:

- `input phase has the search field and the inert quick-import chips`
- `search runs the mock OFF lookup and lands on the preview with a confirmable draft`
- `Polcra imports the picked draft and closes the sheet`
- `az OFF-találat visszaigazolása a telített/cukor/rost/só értéket is mutatja`

A `toggling to Link mode shows the URL input and the Beolvasás CTA` teszt fölötti komment
(`// Exact name: the Link-mode toggle button reads 'Keresés (OFF)', so /Keresés/ is now ambiguous.`)
törlendő, ahol előfordul.

Ezután **minden** olyan teszt, amely eddig Fotó módba lépéssel kezdődött
(`fireEvent.click(screen.getByRole('button', { name: 'Fotó' }))`), változatlanul jó marad —
a kattintás a már aktív módra no-op. A Link-módú teszteknél a `{ name: 'Link' }` kattintás kell,
ez már most is ott van.

Végül szúrd be ezt az új tesztet a fájl elejére, az importok után, első tesztként:

```tsx
test('a sheet alapból Fotó módban nyílik (mezo-ymt4)', () => {
  renderSheet()
  expect(screen.getByRole('button', { name: 'Fotó' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Link' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByRole('button', { name: 'Keresés (OFF)' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Címke fotó')).toBeInTheDocument()
})
```

> A `renderSheet()` helyére írd azt a render-helpert/hívást, amit a fájl többi tesztje használ
> (nézd meg az első megmaradó tesztet, és másold a render-sorát szó szerint).

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd frontend && pnpm vitest run src/features/fuel/sheets/ImportItemSheet.test.tsx
```

Várt: az új teszt FAIL — `aria-pressed` a Fotó gombon `"false"`, és a `Keresés (OFF)` gomb még a DOM-ban van.

- [ ] **Step 3: Vágd ki a Keresés módot a komponensből**

`ImportItemSheet.tsx`:

1. Fejléc-komment: a `Keresés (OFF) — …` két sora törlendő, a nyitó sor `Three-mode import wizard` → `Two-mode import wizard`, és a `Keresés (OFF) · Link · Fotó` felsorolás `Fotó · Link`-re javítandó.
2. `type Mode = 'search' | 'link' | 'photo'` → `type Mode = 'link' | 'photo'`.
3. `useState<Mode>('search')` → `useState<Mode>('photo')`.
4. Töröld a `query`, `results`, `picked` state-eket:
   ```tsx
   const [query, setQuery] = useState('')
   const [results, setResults] = useState<PantryLookupItem[]>([])
   const [picked, setPicked] = useState<number | null>(null)
   ```
5. Töröld a `search` és a `pick` függvényeket, valamint a `save` függvényt (ez a `results[picked]`-et menti; a Link/Fotó ág a `saveDraft`-ot használja).
6. A `usePantryActions()` destrukturálásából vedd ki a `lookupItems`-et:
   ```tsx
   const { importItem, scrapeItem, photoExtract } = usePantryActions()
   ```
7. Importok: töröld a `PantryLookupItem`-et a type-importból (`import type { PantryScrapeDraft } from '@/data/types'`) és a `NovaDot` importot (csak a törölt találatlista használta).
8. Fejléc-copy — az `Eyebrow` és a bevezető bekezdés már nem OpenFoodFacts:
   ```tsx
   <Eyebrow brand>Import · Fotó & Link</Eyebrow>
   ```
   ```tsx
   <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
     Fotózd le a termék címkéjét, vagy illeszd be egy termékoldal linkjét — a nevet, makrókat
     és tápértékeket az AI olvassa ki.
   </p>
   ```
9. A mód-chipek: töröld a `Keresés (OFF)` gombot, és a maradék kettőt tedd **Fotó · Link** sorrendbe (a `Fotó` chip blokkja kerül elsőnek, utána a `Link` chip blokkja — a `style`/`aria-pressed` tartalmuk változatlan).
10. Töröld a teljes `{phase === 'input' && mode === 'search' && ( … )}` blokkot (a terméknév/vonalkód input, a hibaszöveg, a `HAMAROSAN · gyors-import` kártya az inert vonalkód/diktálás chipekkel, és a Mégse/Keresés CTA-sor).
11. Töröld a teljes `{phase === 'preview' && mode === 'search' && ( … )}` blokkot (találatlista + `Polcra kerül` kártya + Vissza/Polcra CTA-sor).
12. A `searching` fázis `SourceBadge` forrása egyszerűsödik:
    ```tsx
    Keresés <SourceBadge source={mode === 'photo' ? 'photo' : (draft?.source ?? 'web')} size="lg" />
    ```

- [ ] **Step 4: Futtasd — legyen zöld**

```bash
cd frontend && pnpm vitest run src/features/fuel/sheets/ImportItemSheet.test.tsx
```

Várt: PASS, 14 teszt (13 megmaradó + az új default-mode teszt). Ha valamelyik Fotó-módú teszt
azért bukik, mert eddig explicit módváltásra támaszkodott, hagyd benne a `Fotó` kattintást — nem árt.

- [ ] **Step 5: Típusellenőrzés**

```bash
cd frontend && pnpm exec tsc --noEmit
```

Várt: 0 hiba a `ImportItemSheet.tsx`-ben. A `pantryHooks.ts` `lookupItems`-e ilyenkor még
létezik, csak hívatlan — ez nem tsc-hiba.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fuel/sheets/ImportItemSheet.tsx frontend/src/features/fuel/sheets/ImportItemSheet.test.tsx
git commit -m "feat(fuel): drop the Keresés (OFF) import mode from the Kamra import sheet (mezo-ymt4)"
```

---

### Task 2: A frontend lookup-réteg törlése

**Files:**
- Modify: `frontend/src/data/fuel/pantryHooks.ts`
- Modify: `frontend/src/data/fuel/pantryApi.ts`
- Modify: `frontend/src/data/fuel/pantry.ts`
- Modify: `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Consumes: semmi a Task 1-ből azon túl, hogy az `ImportItemSheet` már nem hívja a `lookupItems`-et.
- Produces: `usePantryActions()` return-alakja `{ addItem, updateItem, deleteItem, importItem, scrapeItem, photoExtract }` — `lookupItems` nélkül.

- [ ] **Step 1: `pantryHooks.ts` — a hook-akció törlése**

Töröld a `lookupItems` callbacket a kommentjével együtt:

```tsx
  // OFF lookup is a plain read (no cache — results are ephemeral search hits);
  // mock mode serves the canned fixture after a demo delay.
  const lookupItems = useCallback(
    (q: string): Promise<PantryLookupItem[]> =>
      mock
        ? new Promise(resolve => setTimeout(() => resolve(pantryLookupFixture), 700))
        : pantryApi.lookup(q),
    [mock],
  )
```

A return-sor:

```tsx
  return { addItem, updateItem, deleteItem, importItem, scrapeItem, photoExtract }
```

A fájl tetején vedd ki a `pantryLookupFixture`-t a `@/data/fuel/pantry` importból, és a
`PantryLookupItem`-et a type-importból (a többi típus marad).
A `scrapeItem` fölötti komment `like lookupItems` utalását írd át: `— an ephemeral read (no cache);`.

- [ ] **Step 2: `pantryApi.ts` — a lookup wrapper törlése**

Töröld a `lookup` metódust a kommentjével és a `fromLookupResult` segédfüggvényt:

```ts
function fromLookupResult(r: PantryLookupResult): PantryLookupItem { … }
```
```ts
  // P6 (mezo-bka): OpenFoodFacts proxy lookup + confirmed-draft import.
  lookup: (q: string): Promise<PantryLookupItem[]> =>
    apiFetch<PantryLookupResponse>(`/api/pantry-import/lookup?q=${encodeURIComponent(q)}`) …
```

A megmaradó `importItem` fölé kerüljön a komment: `// P6 (mezo-bka): confirmed-draft import.`
Ezután futtasd a tsc-t (Step 5) és **csak azokat** a most feleslegessé vált importokat töröld,
amikre az panaszkodik (várhatóan `PantryLookupResult`, `PantryLookupResponse`, és ha máshol nem
használt, a `PantryLookupItem`).

- [ ] **Step 3: `pantry.ts` — a mock fixture törlése**

Töröld a `pantryLookupFixture` exportot (`frontend/src/data/fuel/pantry.ts:353` környéke) a
tömb teljes tartalmával és a fölötte álló kommenttel együtt. Ha ettől valamelyik import
(pl. `PantryLookupItem`) feleslegessé válik a fájl tetején, azt is töröld.

- [ ] **Step 4: `handlers.ts` — az MSW lookup handler törlése**

```ts
  http.get(`${API_BASE}/api/pantry-import/lookup`, () => HttpResponse.json({ results: [] })),
```

A fölötte álló kommentet írd át:
```ts
  // Pantry import (P6, mezo-bka) — confirmed-draft import.
```

- [ ] **Step 5: Típusellenőrzés + a data-réteg tesztjei**

```bash
cd frontend && pnpm exec tsc --noEmit && pnpm vitest run src/data/fuel src/features/fuel/sheets
```

Várt: 0 tsc-hiba, minden teszt PASS. Ha a `pantryHooks.test.tsx` a `lookupItems`-re hivatkozik
(a 96. sor kommentje csak említi — az átírandó, nem hívja), javítsd a kommentet, ne a tesztet.

- [ ] **Step 6: Nincs maradék referencia**

```bash
cd frontend && grep -rn "lookupItems\|pantryLookupFixture\|pantryApi.lookup\|pantry-import/lookup" src | grep -v api.gen.ts
```

Várt: üres kimenet (az `api.gen.ts` generált találatai megengedettek és ott is maradnak).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/fuel/pantryHooks.ts frontend/src/data/fuel/pantryApi.ts frontend/src/data/fuel/pantry.ts frontend/src/test/msw/handlers.ts
git commit -m "refactor(fuel): drop the frontend OFF lookup layer with the search import mode (mezo-ymt4)"
```

---

### Task 3: Dokumentáció + teljes gate

**Files:**
- Modify: `docs/features/fuel.md`
- Modify: `docs/CODEMAP.md` (regenerálva)

**Interfaces:**
- Consumes: a Task 1–2 utáni fatörzs.
- Produces: semmi kód.

- [ ] **Step 1: `docs/features/fuel.md` aktualizálása**

Keresd meg a Kamra-import bekezdést (a `GET /api/pantry-import/lookup` említését) és told hozzá,
hogy az OFF keresés-import a **frontendből kivezetve** (`mezo-ymt4`, 2026-09-02): a Kamra import
sheet két módot kínál (Fotó · Link), a lookup endpoint a backendben megmarad, de a FE nem hívja.
Ne írd át a P6 történeti mondatot — egészítsd ki, hogy a doc a jelen állapotot mondja.

- [ ] **Step 2: CODEMAP regenerálás**

```bash
node scripts/gen-codemap.mjs
```

Ha a diff üres, az is rendben van — commitolni nem kell.

- [ ] **Step 3: Teljes FE gate — mindkét mód**

```bash
cd frontend && pnpm lint && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Várt: mind a négy zöld. A backend nem érintett, BE gate nem kell (a teljes suite a self-PR CI-n fut).

- [ ] **Step 4: Commit**

```bash
git add docs/features/fuel.md docs/CODEMAP.md
git commit -m "docs(fuel): the Kamra import sheet is Fotó+Link only; OFF lookup FE-retired (mezo-ymt4)"
```
