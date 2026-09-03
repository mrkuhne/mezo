# Karakter Slice 8 — The /me Karakter Page Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user-facing Karakter dossier — hub, dimensions, claim feedback, csapat, konzílium transcript, feed and the bootstrap ceremony — built on the shipped S1–S7 backend and the approved v2.2 design prototype — bd `mezo-1gim.13`.

**Architecture:** A new FE feature family under `frontend/src/features/character/` speaking the live Design 2.0 Mozaik language (`@/shared/ui/mozaik`: `Tile`/`Mosaic`/`MozaikPage`/`MCells`/`StatStrip`/`EntranceGroup`/`useCountUp`; `@/shared/ui/clay`), wired through new dual-mode hooks in `frontend/src/data/character/` over the existing `/api/character/*` endpoints. One small backend addition: `GET /api/character/experts` so the persona catalog (the Csapat page's content) lives in ONE place.

**Design source of truth:** `docs/design_2.0/prototypes/src/karakter-body.html` + `karakter-head.html` (v2.2) and the iteration log `docs/design_2.0/2026-08-31-karakter-design-iterations.md`. The FE mirrors the prototype's structure and copy at ×1.18 scale, the same way `EnHubPage` mirrors `en-body.html` (read its header comment).

## Global Constraints

- **Honest states everywhere** (handoff §2): a missing datum renders NOTHING (no `—` theater unless the prototype shows one), unknown = „tanulom", no red anywhere (error = terracotta), advisory never blocks. Confidence is NEVER a raw number in the UI — FE maps it to words with the backend's exact thresholds (`CharacterConfidenceWords`: `biztos` ≥ 0.75, `valószínű` ≥ 0.5, else `figyeljük`).
- **Dual-mode data layer** (docs/features/_platform-data-layer.md): views import ONLY from `@/data/hooks`; each hook branches on `isMockMode()` (`@/data/_client/mode.ts` — `VITE_USE_MOCK !== 'false'`, default mock); reads use the `useDualQuery` idiom, writes use `useMutation` + invalidation; mock writes must behave like the server (patch caches/seeds so the demo surface stays coherent). A real-mode 404 on the character switch-off is the honest degraded state (the companion precedent), never a crash.
- **Mozaik fidelity contract**: sprites in `frontend/src/shared/ui/clay/*.svg` are VERBATIM copies of `docs/design_2.0/assets/` — re-copy, never hand-edit; new spot names extend the `ClaySpotName` union. Page scaffolds use `MozaikPage` + the subpage-hero recipe; tiles use `Tile` with a `MozaikWash`; entrance choreography via `EntranceGroup`/`delayMs`, reduced-motion respected by the shared CSS (do not add bespoke keyframes where a shared one exists — new CSS goes to the feature's own stylesheet or `styles/prototype.css` §Mozaik if genuinely shared).
- Routes: the family lives under `/me/karakter` (hub) with full-page siblings `/me/karakter/dimenziok`, `/me/karakter/dimenzio/:key`, `/me/karakter/feed`, `/me/karakter/csapat`, `/me/karakter/konzilium` (list + `?id=` opens one transcript — the WeekHub sibling idiom, read `router.tsx:195-215`). The Én hub (`EnHubPage`) gains the Karakter tile in its mosaic.
- Backend/contract changes only in Task 1; `api/openapi.yml` + FE client regenerated and committed (`cd api/generate && npm run generate:api`; `cd frontend && pnpm generate:api`) — CI contract-drift gate.
- FE tests run in BOTH modes: `cd frontend && pnpm test` (mock) AND `VITE_USE_MOCK=false pnpm test` (real-mode against msw/undefined — mirror how sibling page tests do it; a bare `pnpm test` alone is the vacuous trap, bd memory `vite-use-mock-unset-means-mock`). Also `pnpm build` before shipping. Backend tests: focused Testcontainers only.
- ArchUnit/backend idioms for Task 1 (both switches where LLM-adjacent — the experts read is character-only; no raw exceptions; controller implements the generated API).
- Conventional commits with bd id `mezo-1gim.13`; regenerate `docs/CODEMAP.md` whenever files are added; keep `docs/features/character.md` §FE truthful in the final task.

---

### Task 1: `GET /api/character/experts` — the persona catalog endpoint

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterExpertCatalog.java`
- Modify: `api/feature/character/character.yml` (+ regenerated `api/openapi.yml`, FE client)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/controller/CharacterController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterApiIT.java` (+ the companion-off IT)

**Interfaces:**
- Produces: `GET /api/character/experts` → `200` with `CharacterExpertsResponse{ experts: CharacterExpertDto[] }`; `CharacterExpertDto{ key, displayName, role, voiceLine, watch: string[], dimensionKey (nullable — null for szkeptikus/mezo), kind: EXPERT|SKEPTIC|CHAIR }`. Order: the 7 experts in `CharacterCoreCatalog` order, then `szkeptikus`, then `mezo`.

The user-facing copy (role, voiceLine, watch) extends `CharacterExpertCatalog.Expert` with new fields — the HU texts come VERBATIM from the prototype's `CSAPAT` array + Szkeptikus/Mezo cards (`docs/design_2.0/prototypes/src/karakter-body.html`, search `var CSAPAT`). One catalog, one truth. The endpoint is a pure static read (character switch only, no LLM, no DB) served through `CharacterService`.

- [ ] **Step 1**: extend the contract (operationId `getCharacterExperts`, 200/401 — a list endpoint, never 404 while the switch is on) + regenerate; failing IT first: `experts_returnsNineInCatalogOrder_withCsapatCopy` asserting size 9, order, `kind` values, a spot-checked voiceLine, and the companion-off IT gaining a case that the endpoint still answers with companion off.
- [ ] **Step 2**: implement; run `./mvnw test -Dtest='CharacterApiIT,CharacterApiCompanionOffIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` + `./mvnw compile -q`.
- [ ] **Step 3**: commit `feat(character): persona catalog endpoint for the Csapat page (mezo-1gim.13)` (contract + regenerated artifacts included).

---

### Task 2: Sprites + data layer (hooks, mocks)

**Files:**
- Modify: `frontend/src/shared/ui/clay/clay-spots.svg` + `clay-icons.svg` (verbatim re-copy from `docs/design_2.0/assets/`), `frontend/src/shared/ui/clay/index.tsx` (`ClaySpotName` union += the 8 `s-orb-*` variants)
- Create: `frontend/src/data/character/characterApi.ts`, `frontend/src/data/character/characterHooks.ts`, `frontend/src/data/character/characterMock.ts`
- Modify: `frontend/src/data/hooks.ts` (re-exports)
- Test: `frontend/src/data/character/characterHooks.test.tsx` (+ the clay test if it asserts the union)

**Interfaces (Tasks 3–5 rely on these EXACT names):**
- `useCharacterOverview()` → `{ overview: CharacterOverviewResponse | null, isLoading }` — 404 → null (degraded/off), the `useBiometricProfile` idiom.
- `useCharacterDimension(key: string)` → `{ dimension: CharacterDimensionResponse | null, isLoading }`.
- `useCharacterFeed(limit?: number)` → `{ items: CharacterFeedItem[], isLoading }` — `[]` honest empty.
- `useCharacterConferences()` / `useCharacterConference(id: string | null)`.
- `useCharacterExperts()` → `{ experts: CharacterExpertDto[], isLoading }`.
- `useClaimFeedback()` → `{ submit(claimId, kind, text?), pending }` — real: POST + invalidate `['characterDimension']`+`['characterOverview']`+`['characterFeed']`; mock: patches the mock claim (talál bumps the word tier if warranted, nem igaz flips to retired, pontosítom stores) so the demo behaves like the server.
- `useCharacterBootstrap()` → `{ start(), pending, result: 'created'|'empty'|'conflict'|null }` mapping 200/204/409; mock: resolves 'created' after a short delay and flips the mock overview from empty→seeded (the ceremony needs a real state change to reveal).
- Mock seeds in `characterMock.ts` mirror the prototype's content VERBATIM (`DIMS`, feed rows, `KONZ` + `TRANSCRIPT`, the 9 personas) so mock mode IS the approved design's demo.
- Confidence words: export `confidenceWord(c: number): 'biztos'|'valószínű'|'figyeljük'` with thresholds 0.75/0.5 (mirror `CharacterConfidenceWords`, cite it in a comment).

- [ ] **Step 1**: failing hook tests first (both modes: mock returns seeds; real mode with msw-style stubs returns mapped DTOs and 404→null; feedback mutation invalidates; guard test `dualMode.guard.test.ts` conventions respected — read it first).
- [ ] **Step 2**: implement; `cd frontend && pnpm test src/data/character && VITE_USE_MOCK=false pnpm test src/data/character`.
- [ ] **Step 3**: commit `feat(character): FE data layer — dual-mode character hooks + orb sprites (mezo-1gim.13)`.

---

### Task 3: Hub page + routes + Én tile + bootstrap/empty states

**Files:**
- Create: `frontend/src/features/character/pages/KarakterHubPage.tsx` (+ `.test.tsx`), `frontend/src/features/character/components/MaturityRing.tsx` (+ test), `frontend/src/features/character/components/PersonaOrb.tsx`, `frontend/src/features/character/character.css`
- Modify: `frontend/src/app/router.tsx` (the 6 routes), `frontend/src/features/me/pages/EnHubPage.tsx` (Karakter tile), navigation test

**Content (prototype hub, ×1.18):** maturity ring hero (SVG segmented ring — 7 CORE arcs, expert domain colors from a shared `EXPERT_COLORS` map in the feature, arc length = maturity, center count-up % via `useCountUp`) + the self-portrait line ONLY if the backend someday serves one — v1 renders the hero WITHOUT the Fraunces line (the spec flagged it non-v1; the prototype note says visual direction only). Below: 4-tile `Mosaic` — Dimenziók (avg maturity + `7+1 dimenzió` line), Feed (latest observation preview + dot), Csapat (orb cluster + `9 profilozó`), Konzílium (latest conference date + outcome count, gold dot when a conference is newer than the last visit — v1 keeps it simple: dot shown when a conference exists from the last 3 days).
- Empty dossier (overview exists, all portraits empty, no claims) → the bootstrap intro face on the hub itself (orb + the 9-orb cluster + „Kezdjétek el" CTA per the prototype); `start()` → progress face (the staggered `bootlines` + arc), then on `'created'` → refetch + entrance replay; `'empty'` (204) → the honest „Még nincs elég történet" face; `'conflict'`/off → plain hub.
- Switch-off/degraded (overview null) → the feature's degraded row idiom (read how ChatPage renders its degraded badge and mirror the tone).

- [ ] **Step 1**: failing tests first — hub renders the 4 tiles from mock seeds; ring gets 7 arcs; navigation test covers the new routes; EnHub shows the Karakter tile; bootstrap faces switch on the mutation states (mock).
- [ ] **Step 2**: implement; both-mode tests + `pnpm build`.
- [ ] **Step 3**: commit `feat(character): Karakter hub + maturity ring + bootstrap ceremony (mezo-1gim.13)`.

---

### Task 4: Dimenziók + dimenzió-oldal (claim feedback) + Feed

**Files:**
- Create: `frontend/src/features/character/pages/DimensionsPage.tsx`, `DimensionPage.tsx`, `CharacterFeedPage.tsx` (+ tests), `frontend/src/features/character/components/ClaimTile.tsx` (+ test)

**Content:** per the prototype — DimensionsPage = the 8 `Tile`s (CHAPTER dashed variant via a `chapter` class in `character.css`); DimensionPage = `MozaikPage` tinted hero (PersonaOrb + maturity count-up + title), portrait card (only when non-empty), claim tiles: confidence-word chip (sage/amber/lav tones), text, ÉRZÉKENY frame + mirror line styling for `sensitive`, the three pills wired to `useClaimFeedback` (talál → thanks microcopy + disable; nem igaz → retired face incl. mock/real state change + toast; pontosítom → inline textarea + Küldés + toast), „Beszélgess erről Mezóval" chat-handoff (navigate to the chat with the anchored-context idiom IF a claim/dimension context kind exists — read how WeekPage's chat handoff chips navigate and reuse; if no context kind fits, plain `/mezo` navigation with no fake anchor), principle line. FeedPage = day-grouped rows with PersonaOrbs + konzílium-diff rows linking to the transcript.

- [ ] Steps: failing tests (incl. all three feedback flows against the mock, and a real-mode test asserting the POST + invalidation) → implement → both-mode tests → commit `feat(character): dimension pages + claim feedback + feed (mezo-1gim.13)`.

---

### Task 5: Csapat + Konzílium + doc/goldens/ship-prep

**Files:**
- Create: `frontend/src/features/character/pages/CsapatPage.tsx`, `KonziliumPage.tsx` (+ tests), `frontend/src/features/character/components/TranscriptTurn.tsx`
- Modify: `docs/features/character.md` (§FE from "not started" to the shipped truth), `docs/CODEMAP.md`

**Content:** CsapatPage = the 9 persona cards from `useCharacterExperts` (orb, name, voiceLine, watch list, dimension chip; Szkeptikus graphite card, Mezo coral-gradient card with the real `s-orb`). KonziliumPage = conference rows (kind badges HETI/HAVI/BOOTSTRAP, outcome summary from `outcome`/`changes` counts) → transcript view (`?id=`): outcome `MCells` (sage/amber/lav), phase labels derived from persona kinds (expert turns → „Javaslatok", szkeptikus → „A Szkeptikus", mezo → „Döntés"), persona-railed turn bubbles, the gold-railed „DANIEL VÁLASZA" block for turns whose text carries the user-quote (render from the transcript turn refs/text as served — do NOT invent structure the API does not have; if the transcript turn has no structured user-quote field, style the `DANIEL VÁLASZA —` prefix line the S6 backend actually emits), honesty note line. Check `frontend` visual-test config: if new routes need goldens, generate them per the repo recipe; otherwise state why not in the report.

- [ ] Steps: failing tests → implement → both-mode tests + `pnpm build` + `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check` + `node scripts/lint-docs.mjs --errors-only` → commit `feat(character): csapat + konzílium transcript pages (mezo-1gim.13)`.

---

### Task 6: Ship

- [ ] Final gates: both-mode FE tests (full `pnpm test` twice), `pnpm build`, focused backend ITs for Task 1, codemap/docs lint, contract regeneration leaves the tree clean.
- [ ] House flow: push `feat/character-s8-fe`, self-PR → CI green (flaky TRUNCATE deadlock = bd `mezo-oou9`, rerun once) → `git pull --rebase` on main → `--no-ff` merge (`ALLOW_MAIN_COMMIT=1` for the merge commit) → push → delete branch → `bd close mezo-1gim.13` → `bd dolt push`.

## Out of scope

Történet view + claim confidence-history sparkline (v1.5, needs a contract addition), konzílium app-notification (v1.5), the self-portrait line (needs backend), Design 2.0 F5 re-skins of other Me pages.
