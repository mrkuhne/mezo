# Boop V3 implementation

Driver: mezo-dcuyw. Approved design: [V3](../specs/2026-09-21-boop-social-ai-v3-navigation.md), owner approval 2026-09-22.
Tracking lives in Beads, not markdown checkboxes. This plan records interfaces and verification.

## Goal and architecture

Implement the approved social entry, direct original-name menu, persistent dock and page-based content navigation using existing typed reads/mutations. Keep the existing ownership/data contracts, daily header indicator and canonical records. No prototype records, artificial counters or health rewards in real mode. Existing deep links remain valid.

Independent work packages may execute in parallel under the executing-plans skill. Shared router, nav model, app shell, stylesheet and final docs are owned by the primary agent; packages own only their listed feature files. No backend/contract changes in these frontend packages. Backend topic unification beyond existing source links remains a separate explicitly documented architecture extension, not a fabricated UI capability.

## Package A — shell, menu and social entry

Files: app/navModel.ts and its tests; app/router.tsx; app/AppLayout.tsx; features/insights/pages/BoopMenuPage.tsx, BoopWorldPage.tsx, BoopAboutPage.tsx; features/insights/components/BoopNavigation.tsx; features/insights/boop-world.css; feature-local tests. Existing CharacterFeedPage accepts optional `embedded?: boolean` to suppress its own section header when used by BoopWorldPage. Existing feed route and bootstrap flow stay available.

Routes: `/mezo` is the social entry, `/mezo/menu` direct menu, `/mezo/rolad` about hub, `/mezo/emlekek` memories. Bottom tabs use those four routes. The menu links original routes for patterns/predictions/diagnosis/experiments/character/knowledge/memoir/coaching/chat/memory and canonical `/me/week`. Route ownership maps deep pages to the appropriate tab.

Write navigation tests asserting four labels and original-name destinations, then run red. Implement the menu from one catalog and real existing components. Add direct crosslinks on content pages, preserving local parent navigation and query strings. Run focused tests in both modes and commit.

## Package B — discovery details

Owned files: features/insights/pages/{PatternsPage,PatternDetailPage,PredictionsPage,PredictionDetailPage,ExperimentsPage,ExperimentDetailPage,DiagnosisListPage,DiagnosisDetailPage,CoachingHubPage,CoachingObserverPage,CoachingCardPage}.tsx and colocated tests; feature-only components/logic needed for those pages. Do not edit router/nav/shared stylesheet. Primary registers `/mezo/predictions/:id` and `/mezo/experiments/:id`.

Reuse `usePredictions`, `useFeedback`, `useExperiments`, `useExperimentActions`, current diagnosis hooks and all existing actions. Lists link to full detail pages using IDs; details handle pending/error/not-found honestly. Keep existing original labels and data semantics. Fix missed prediction actual-result text while adding detail, with regression test. Existing pattern/diagnosis detail remains functional and back links point to their parents/menu. No fabricated confidence, assessment state or charts where DTO lacks data.

Write focused deep-link/detail/action preservation tests first, run red, implement, run both modes, commit package files only. Supply exported page names and route requirements to primary.

## Package C — knowledge and memories

Owned files: features/insights/pages/{BoopMemoriesPage,MemoryDayPage,KnowledgeNodePage,KnowledgeListPage,MemoryPage}.tsx; insights components/MemoryAuditPanel.tsx and new memory-specific components; me/pages/WeekLessonsPage.tsx; tests for these files. Primary registers `/mezo/emlekek`, `/mezo/emlekek/:date`, `/mezo/knowledge/node/:id`.

Use existing `useMemoir`, `useMemoirArchive`, `useMemorySummaries`, `useSimilarDays`, knowledge/graph hooks. Memories expose weekly memoir, actual daily summary list/detail and existing search with no dependency on overview availability. Knowledge node content becomes a page with archive actions preserved; current query links remain supported. Remove duplicate editable fact list from memory audit in favor of canonical knowledge link. Weekly lessons link to the existing canonical decision inbox with the week context instead of a second decision UI. Retain life-event candidates and explicit communication settings.

Tests assert actual dates, missing summary handling, knowledge return links and canonical inbox navigation. Run red, implement, then focused both modes. Commit package-owned files only.

## Integration and visual verification

Register all pages; preserve legacy paths. Update insights, character and design-system living docs for changed behavior and ADR 0049 approval with V3 overriding the old Folyamatban proposal. Generate CODEMAP. Compare doc lint against recorded baseline (9 stale, 2 warn, 0 error) and resolve new findings. Browser-check actual running mock app at narrow/mobile size and real-mode empty/error states; retain existing header and bottom dock.

Required gates: `cd frontend && pnpm build`; `CI=true VITE_USE_MOCK=true pnpm test`; `CI=true VITE_USE_MOCK=false pnpm test`; `node scripts/gen-codemap.mjs --check`; `node scripts/lint-docs.mjs`. Tests cover navigation, detail deep links, mutations and canonical data ownership, rather than CSS snapshots. Review diff and fix regressions before integration. Follow repository local-gates → no-ff main merge → push workflow; deployment uses the mezo-deploy skill and existing GitOps path.
