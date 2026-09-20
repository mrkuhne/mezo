# Central settings implementation

Goal: one domain-aware settings center plus inspectable, editable personal Mezo context.
Architecture: settings UI composes existing domain hooks; companion preferences and the prompt
preview share one owner-scoped backend assembler. Canonical data remains in its source domain.
Driver: `mezo-txunr`. [Approved design](../specs/2026-09-20-central-settings-design.md).
Task tracking lives exclusively in Beads, as required by AGENTS.md.

## Global constraints

Keep the existing nutrition engine and real/mock boundary. Explicit communication preferences
and introduction are capped at 4000 characters each. Learned-profile inclusion defaults true.
Root is `/settings`; existing URLs redirect. Estimated goal date is derived, never independently
editable. Water/fiber are compact rows. Use the saved approved prototype as the visual baseline.

## 1. Personal context and account APIs — mezo-txunr.1

Contract first in `api/feature/companion-preferences/companion-preferences.yml` and auth fragment;
register the fragment in `api/generate/merge.yml`, merge and regenerate FE/BE models. Use the
exact DTOs/endpoints in the spec. Add preference entity/repository, migration, ResetDatabase
entry, generated-interface controller, service, shared assembler and integration tests in the
companion feature. Update auth service/controller for current-account source corrections.
Write failing API/assembly tests first, run focused Maven clean test, implement, run green.
Cover production and rollback, sync and stream; a preference change changes the actual input,
not just the preview. Commit scoped files with `feat(companion): ... (mezo-txunr.1)`.

## 2. Settings UI and data — mezo-txunr.2

Create `frontend/src/features/settings/{pages,components,logic}` and scoped settings CSS.
Create `data/companion/preferencesApi.ts` and `preferencesHooks.ts` using generated types;
re-export hooks from `data/hooks.ts`. Dual queries never fake real-mode data. Export a route
list from `features/settings/settingsRoutes.tsx` for root integration; imports are deep.
Implement the approved landing page/domain faces, source-linked Mezo editors/preview,
biometric/sleep/Train schedule editors, general settings and notification links using existing
hooks and editors. Include account corrections and dirty-state guards. Write failing behavior
and real API wiring tests before implementation. Existing Fuel page is composed via canonical
route, not reimplemented. Root handles Goal editor and shell migration separately.
Run focused Vitest in both modes, then commit `feat(settings): ... (mezo-txunr.2)`.

## 3. Shell, Fuel and goal integration — mezo-txunr.3

Modify `app/AppHeader.tsx`, `AppLayout.tsx`, `router.tsx`, nav routing and affected tests to replace
the daypart entry and mount canonical routes. Remove redundant domain settings doors and redirect
legacy URLs. Ensure date/daypart behavior unrelated to the removed switch remains intact.
Adapt `FuelSettingsPage.tsx`/`FuelSlotsPage.tsx` back/finish routes and compact water/fiber styling,
preserving draft preview, validation and server hooks. Implement pure goal date derivation plus
an editor using existing full-upsert/feasibility hooks, preserving start/history and guards.
Write/run RED then GREEN focused tests for navigation, Fuel and goal behavior. Commit with
`feat(settings): ... (mezo-txunr.3)`.

## 4. Verification and delivery

Run `CI=true VITE_USE_MOCK=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`
in frontend; focused backend integration suite with `./mvnw clean test
-Dmezo.test.use-testcontainers=true` and selected companion/auth classes, broadening shared
prompt verification as warranted. No overlapping Maven builds in the shared checkout.
Exercise actual app routes with browser/layout checks and inspect mobile screenshots.
Update platform, Me, Fuel, Train, Insights and Companion living docs as appropriate; ADR for
personal prompt ownership. Regenerate CODEMAP and API artifacts, run doc lint and backup script.
Close completed Beads tasks, commit backup, fetch main and merge locally with --no-ff from a
detached origin/main checkout, push HEAD:main, verify the push, delete the feature branch.
The current AGENTS.md no-self-PR workflow overrides historical skill PR instructions.
