# Frontend Conventions — house standard (Phase 1+)

> **Non-negotiable house standard.** Read this **before** you write, review, refactor, or plan any `frontend/src` code. It is the actionable "where does this go / what do I name it / how do I add one" companion to the living structure description in [`docs/features/_platform-design-system.md` §1a](../features/_platform-design-system.md) and the rationale in [ADR 0003](../decisions/0003-frontend-structure-conventions.md). When those and this disagree, fix the drift — they must stay in sync.

## 1. The four layers — where everything goes

```
frontend/src/
├─ app/        shell + routing ONLY: AppLayout, PhoneFrame, StatusBar, TabBar, ThemeProvider,
│              providers/QueryProvider, router.tsx (the single route map). No domain logic here.
├─ features/   one folder per domain, each with the SAME internal template (§2)
├─ shared/     domain-INDEPENDENT, reused across ≥2 features: ui/ · lib/ · hooks/
└─ data/       the whole FE↔BE boundary: per-domain hooks + mock + types + REST client (§4)
```

**Decide the layer first:** a routed screen or a domain component → `features/<domain>/`. A reusable, domain-free primitive/util/hook → `shared/`. Anything that reads or writes data → `data/`. App chrome or routing → `app/`.

## 2. Feature template — identical for every feature

```
features/<domain>/
├─ pages/        *Section · *Page · *SubNav · tabs.ts · *Skeleton   (the routed layer)
├─ components/   presentational components + their small pure view-helpers
├─ sheets/       *Sheet / *Modal bottom-sheets
└─ logic/        pure feature logic / derivations / feature-local logic hooks
```

Only folders with content exist. A non-routed full-screen overlay provider (e.g. `progression/LevelUpProvider`) stays at the feature root, not under `pages/`.

## 3. Naming taxonomy — everything routed is a `*Section` or a `*Page`

| You are adding… | Name it | Put it in |
|---|---|---|
| a tab-root that renders a `SubNav` + `<Outlet>` | `<Domain>Section` | `pages/` |
| any routed leaf — an `<Outlet>` child **or** a standalone full-page route | `<Name>Page` | `pages/` |
| a modal / bottom-sheet | `<Name>Sheet` (or `<Name>Modal`) | `sheets/` |
| a loading skeleton for a page | `<Name>Skeleton` | `pages/` (next to its page) |
| a sub-navigation bar / its tab config | `<Domain>SubNav` / `tabs.ts` | `pages/` |
| a presentational unit | `<Name>Card/Panel/Row/Hero/Stat/Bar/Grid/Chip/Cell` | `components/` |
| pure logic / a derivation / a feature-local logic hook | descriptive `.ts` (`planner.ts`, `agenda.ts`, `useEditableNumber.ts`) | `logic/` |

**Never introduce a new `*Screen` or `*View`** — every routed component is a `*Section` or a `*Page`. (Two non-routed legacy names survive by design: `features/progression/LevelUpScreen` — the `LevelUpProvider` overlay — and `features/today/pages/AnchorModeView` — a page-composition `TodayPage` swaps in. Don't add more.)

## 4. `data/` layer — per-domain, one barrel

- **`data/hooks.ts` is the single import surface.** Every feature imports its hooks from `@/data/hooks` and **nowhere else**. `hooks.ts` is a **thin re-export barrel** — it contains NO implementations.
- **Implementations live per-domain:** `data/<domain>/<name>Hooks.ts` (`today · fuel · train · me · insights · progression`). Each domain folder also holds its mock-data file(s), types, and the REST `*Api.ts` client.
- **`data/_client/`** holds cross-cutting infra — exactly five files: `api.ts` (base fetch), `api.gen.ts` (generated contract types), `mode.ts` (`isMockMode`), `flags.ts`, `auth.ts`.
- **The shared core stays at `data/` root:** the type spine `types.ts`, `nova.ts`, `pantrySources.ts`, `kindMeta.ts`, plus the `data/hooks.ts` barrel and `data/useDualQuery.ts`. Never move a module that `data/types.ts` imports into a domain folder (it would invert the dependency). Cross-domain imports *between* domain folders are fine.
- **Dual-mode reads go through `useDualQuery`** (`data/useDualQuery.ts`): `useDualQuery({ queryKey, mockData, realFetch, realEmpty, realStaleTime? })`. Real mode **never** falls back to the mock seed — return `realEmpty` while loading. The `data/dualMode.guard.test.ts` guard fails the build if a `const { data = seed } = useQuery()` default reappears.

## 5. `shared/` layer

- `shared/ui/` = ~25 domain-free primitives (`Chip`, `Cta`, `Sheet`, `ScoreRing`, `NotchCard`…). **A `shared/ui` primitive must not import `@/data/*`.** If a UI file imports domain data or is used by exactly one feature, it belongs in `features/<domain>/components/`, not here (e.g. `NovaDot`/`SourceBadge` live in `features/fuel/components/`).
- `shared/lib/` = pure utils (`cn`, `dates`, `pct`, `theme`, `safeMarkdown`). `shared/hooks/` = reusable hooks (`useReducedMotion`, `useStickyTab`).

## 6. Imports & tests

- **No barrels** anywhere except `data/hooks.ts`. Do not add per-feature `index.ts`.
- **Deep + absolute** imports through the `@/*`→`src/*` alias: `@/features/train/pages/GymPage`, `@/shared/ui/Chip`, `@/data/fuel/fuelHooks`. Never write relative `../` imports.
- **Colocate tests** next to their source (`GymPage.tsx` + `GymPage.test.tsx`).

## 7. Recipes

**Add a routed page under an existing tab:**
1. Create `features/<domain>/pages/<Name>Page.tsx` (+ `<Name>Page.test.tsx`).
2. Register it in `app/router.tsx` — as a child of the domain's `*Section` (shows the sub-nav) or as a top-level sibling route (full-screen, no sub-nav, like `train/session`).
3. If it has a sub-nav entry, add it to the domain's `pages/tabs.ts` / `*SubNav`.
4. Data via `useXxx()` from `@/data/hooks`; loading via a colocated `<Name>Skeleton`.

**Add a bottom-sheet:** create `features/<domain>/sheets/<Name>Sheet.tsx` wrapping `@/shared/ui/Sheet` (whose props are `children`/`onClose`/`className`/`labelledBy` — there is **no `open` prop**). The opener (a page/component) owns a `useState` boolean and **conditionally mounts** the sheet — `{open && <XSheet onClose={() => setOpen(false)} … />}` — which is the idiom 30 of the 31 sheets use.

**Add a data hook:** implement in `data/<domain>/<name>Hooks.ts`; **re-export it from `data/hooks.ts`**; mock seed in `data/<domain>/<mock>.ts`; real path in `data/<domain>/<x>Api.ts` (typed off `@/data/_client/api.gen.ts`, `satisfies` on request bodies) wired via `useDualQuery`.

**Add a shared primitive:** `shared/ui/<Name>.tsx`, `cn()` for classes, `var(--token)` colors only (no raw hex/`rgba()`), no `@/data/*` import. If it needs domain data, it's a feature component instead.

## 8. Red flags — stop if you're about to…

- name something `*Screen` or `*View`, or put a routed component outside `pages/`;
- import from `@/data/<domain>/…Hooks` in a feature (use `@/data/hooks`);
- add an `index.ts` barrel, or a relative `../` import;
- import `@/data/*` from a `shared/ui` primitive;
- put a domain hook implementation in `data/hooks.ts` (barrel only);
- return the mock seed as a real-mode loading fallback (use `useDualQuery` / `realEmpty`).

## 9. Verify before you're done

`cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — the build (`tsc -b`) catches broken imports; **both** test modes must stay green. Touched a feature? Update its `docs/features/<domain>.md` and run `node scripts/lint-docs.mjs`.
