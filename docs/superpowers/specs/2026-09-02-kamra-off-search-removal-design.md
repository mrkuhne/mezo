# Kamra — a „Keresés (OFF)" import mód eltávolítása

**bd:** `mezo-ymt4` · **Dátum:** 2026-09-02 · **Scope:** frontend-only

## Probléma

A Kamra import sheet (`ImportItemSheet`) három módot kínál: **Keresés (OFF)** (OpenFoodFacts
termékkeresés), **Link** (URL-scrape) és **Fotó** (címkefotó-kivonatolás). Az OFF-keresés a
gyengébb út: a találatok gyakran hiányos/rossz tápértékkel jönnek, és a másik két mód —
amely LLM-mel teljes draftot állít elő — ugyanazt a végeredményt adja jobb minőségben.
A mód jelenléte az alapértelmezett belépési pont, így a rosszabb utat tolja előre.

## Döntés

A Keresés (OFF) mód **kikerül a frontendből**. Az alapértelmezett mód a **Fotó** lesz,
mellette a **Link**. A backend `GET /api/pantry-import/lookup` endpoint, az OFF kliens, a
`PantryImportProperties` config és a hozzá tartozó ITek **változatlanul maradnak** — a
`POST /api/pantry-import` confirm-út továbbra is kell a Link/Fotó mentéshez, a lookup pedig
ártalmatlanul hívatlan marad (későbbi újrahasznosításra).

## Változások

### 1. `frontend/src/features/fuel/sheets/ImportItemSheet.tsx`

- `type Mode = 'link' | 'photo'`; `useState<Mode>('photo')`.
- A chip-sor sorrendje: **Fotó · Link** (a Fotó az első és alapértelmezett).
- Törlendő: a `Keresés (OFF)` chip; a `phase === 'input' && mode === 'search'` kereső-input ág;
  a `phase === 'preview' && mode === 'search'` találatlista/megerősítő ág; a `query`, `results`,
  `picked` state-ek; a `lookupItems` hívás és a `runSearch` ág; a `PantryLookupItem` típusimport.
- A `searching` fázis megmarad (Link/Fotó is használja).
- A `SourceBadge` forrása `mode === 'photo' ? 'photo' : (draft?.source ?? 'web')` — az
  `'openfoodfacts'` ág megszűnik.
- A fejléc-komment három módot leíró blokkja két módra íródik át.

### 2. FE lookup-réteg törlése

| Fájl | Törlendő |
|---|---|
| `frontend/src/data/fuel/pantryHooks.ts` | `lookupItems` callback, a return-objektum `lookupItems` mezője, a `pantryLookupFixture` import |
| `frontend/src/data/fuel/pantryApi.ts` | `lookup()`, `fromLookupResult()`, a feleslegessé váló `PantryLookupResult` / `PantryLookupResponse` importok |
| `frontend/src/data/fuel/pantry.ts` | `pantryLookupFixture` |
| `frontend/src/test/msw/handlers.ts` | a `GET /api/pantry-import/lookup` handler |

**Marad:** a `PantryLookupItem` *típus* (`data/types.ts`) — a `PantryScrapeDraft` és a
`PantryImportInput` őse, nem dead code. A generált `api.gen.ts` érintetlen (a backend
kontraktus nem változik).

### 3. Tesztek

`frontend/src/features/fuel/sheets/ImportItemSheet.test.tsx`:

- Törlendő a négy search-módú teszt: `input phase has the search field and the inert quick-import
  chips`, `search runs the mock OFF lookup…`, `Polcra imports the picked draft…`,
  `az OFF-találat visszaigazolása…`.
- Új teszt: **a sheet alapból Fotó módban nyílik** (a Fotó chip `aria-pressed=true`, és a
  fotóválasztó input látszik).
- A maradó 13 Link/Fotó teszt változatlanul zöld. Ahol a mód-váltó teszt a `Keresés (OFF)`
  gomb neve miatt disambiguált (`getByRole('button', { name: 'Keresés' })` kommentje),
  a komment aktualizálandó.

### 4. Dokumentáció

- `docs/features/fuel.md`: a Kamra-import bekezdésben rögzítjük, hogy az OFF lookup-import
  UI-ból kivezetve (`mezo-ymt4`), a backend endpoint marad, a FE nem hívja.
- `docs/CODEMAP.md` regenerálás, ha az exportlista változik.

## Hibakezelés

Nincs új hibaút: a törölt ág saját `error` állapotát a megmaradó Link/Fotó ágak már kezelik
ugyanazon a megosztott `error` state-en.

## Verifikáció

- `pnpm test` **mindkét módban** (mock és `VITE_USE_MOCK=false` real) — a mock-only futás
  vacuum lenne.
- `pnpm build` + `pnpm lint`.
- Backend nem érintett → BE gate nem kell; a CI teljes suite-ja a self-PR-en fut.

## Nem-célok

- A backend OFF kliens / endpoint / config / IT törlése.
- A `PantryLookupItem` típus átalakítása.
- A Kamra oldal saját (leltár-)keresőmezője — az marad, semmi köze ehhez.
