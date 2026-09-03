# ADR 0032 — Five first-class tabs, no section shells: every tab is a Mozaik hub over full-page siblings

- **Status:** accepted (2026-08-29)
- **Driving bd:** `mezo-d20` (epic), Decision B in [`2026-08-26-ui-ia-redesign-handoff.md`](../design_2.0/2026-08-26-ui-ia-redesign-handoff.md)
- **Spec:** [`docs/superpowers/specs/2026-08-27-design-2.0-implementation-spec.md`](../superpowers/specs/2026-08-27-design-2.0-implementation-spec.md) §2, over the nine validated prototypes in [`docs/design_2.0/prototypes/`](../design_2.0/prototypes/)
- **Companion ADR:** [ADR 0033](0033-mozaik-2-tile-language.md) decides what the surfaces *look* like; this one decides *where they live and how you reach them*.
- **Supersedes:** the center-FAB five-slot tab bar and the `SubNavDropdown` section-shell pattern (introduced piecemeal across the Fuel, Me, Train and Insights sections; never itself ADR'd, which is part of why it drifted).

## Context

The app had grown five navigation idioms at once, and they disagreed with each other:

1. **The tab bar spent its center slot on an action, not a place.** Four destinations (Ma · Edzés · Fuel · Én) plus a center "+" meant the companion — the single feature the whole product is organised around — had no tab. It lived at `/insights`, reachable only as a sub-item of a section whose name ("Insights") described a data category rather than a thing the user goes to.
2. **Four sections had invented their own sub-navigation.** Fuel, Me, Train and Insights each rendered a `SubNavDropdown` over a per-section `tabs.ts` list. The dropdown was a shell: it owned a header, and its children rendered *inside* it. This produced a two-level mental model ("which section am I in, then which page inside it") that the tab bar already claimed to answer, and the two levels were not visible at the same time.
3. **The shells disagreed about who owns the page header.** `InsightsScreen` rendered a shared `.page-header` with a title derived from the route, so its sub-views were forbidden from rendering their own — while Fuel and Me did the opposite, each view rendering its own header. Nothing enforced either rule; a new page was a coin flip, and getting it wrong produced either two headers or none.
4. **Depth was cheap to add and expensive to leave.** Because a sub-page rendered inside a shell, "going deeper" meant nesting further inside the same frame. There was no natural end to it, and no consistent way back.

The redesign (`mezo-88jw` → `mezo-d20`) is a **recompose, not a reinvent**: the data layer, the contracts, the domain logic and the honest-state discipline all survive unchanged. What had to change was the map.

## Decision

**Five first-class tabs — `Nap · Edzés · Fuel · Mezo · Én` — and no section shells at all. Each tab root is a Mozaik hub page whose tiles navigate to full-page siblings on stable routes.**

1. **The companion becomes a tab.** `/insights` is promoted to `/mezo`, and the remaining insights pages (Minták, Heti, Memoár, Tudástár, Előrejelzések, Kísérletek, Memória) become tiles on that hub rather than dropdown entries under a category. "Insights" as a section name is retired; the tab is named after the companion, because that is what the user is going to.
2. **`/today` becomes `/nap`.** The Ma tab becomes the day's spine: daypart heroes plus a tile mosaic, with each tile leading to its own page.
3. **Quick logging leaves the tab bar and becomes a floating coral FAB** (`QuickLogFab`, bottom-right, present on every tabbed screen) behind the quick-log sheet v2. This frees the fifth tab slot for a destination and stops an action from masquerading as a place.
4. **Every `SubNavDropdown` shell is dissolved.** There is no per-section `tabs.ts`, no shell component, and no nesting: a tab's sub-pages are **siblings** of the hub in the router, not children of a shell. Each page renders its own header via the shared `PageHead` primitive — one rule, everywhere, with no per-section exception to remember.
5. **Tile → its own page** is the canonical transition (the Huawei Health pattern the prototypes are modelled on): a tile carries an eyebrow, a clay spot and exactly **one** datum; the detail lives on the page it opens, which slides in from the right with a tinted hero zone (spot + big number + name), a `‹ vissza` chip, content in cards, and a quiet principle line at the bottom.
6. **Old routes redirect rather than break.** `LegacyPathRedirect` (`frontend/src/app/router.tsx`) rewrites `/today/*` → `/nap` and `/insights/*` → `/mezo`, preserving the query string, and a handful of individual renames get their own `<Navigate replace>` entries. This is not politeness: the app is an installed PWA, and a user's home-screen shortcut or a bookmark points at the old path.
7. **Full-screen flows stay outside the tab bar** — the active session, Napzárás, night mode and the builders keep their tab-bar-less, focused presentation. The five-tab rule governs the tabbed surface, not every route.

## Consequences

- **Navigation depth is now exactly two, and it is legible.** Tab → page. Anything that wants to be deeper is either a sheet (a modal decision) or its own full page reached from a card, never a third nesting level inside a shell.
- **One header rule replaces four.** Because no shell renders a header any more, `PageHead` is unconditionally the page's own responsibility. The old Insights-specific "sub-views must not render a header" seam rule is **gone** — a future session reading the pre-redesign `insights.md` would otherwise reproduce it and ship a headerless page.
- **A large deletion followed, deliberately deferred.** The redesign slices left dead code in tree on purpose and flagged it; F8 removed it in one reviewed pass (~8,400 lines): `AppHero`, `SubNavDropdown`, the whole `TodayPage` view family, the superseded Fuel sheets, and the Train components the Heti fold orphaned. Doing this per-slice would have produced N merge conflicts on the same shared files.
- **`/train/gym` survives as a thin alias.** It renders `TrainWeekPage` because three callers still navigate to that pathname. This is an honest exception, kept because deleting it would break working links, not because the route means anything any more.
- **The tab bar's fifth slot is spent.** Adding a sixth destination now requires demoting one of the five, which is the intended pressure — the five were chosen as the product's actual top-level nouns, and the constraint is what keeps them that way.
- **Structural guards replaced the ones the shells provided.** `frontend/src/app/hubHeaders.test.tsx` pins that every tab root renders its own hub header; the old `appHeroMount.test.tsx` (which pinned that no tab root mounts `AppHero`) served its purpose during the migration and retired with the component.
- **No backend, contract or data-model change.** Every hub and every sibling page reads the same TanStack Query hooks, in the same dual mock/real mode, under the same honest-state rules.

## Alternatives considered

- **Keep four tabs and give the companion a persistent floating entry point** (a bubble, like the old `MezoChip` scaled up). Rejected: the companion is not one message, it is a place with seven sub-surfaces (chat, patterns, weekly, memoir, knowledge, predictions, experiments). A floating affordance can open one thing; it cannot be a hub.
- **Keep the section shells but standardise them** (one `SectionShell` component, one header rule, one `tabs.ts` schema). Rejected: it fixes the inconsistency but keeps the two-level model and the nesting temptation, and it would have made the tile → page transition — the pattern the prototypes are actually built on — impossible to render, because a shell frame is exactly what a full-page slide-in cannot live inside.
- **Six tabs (splitting Mezo's chat from its analysis surfaces).** Rejected: six tabs on a 390px viewport puts labels below the legibility floor, and the split is not one the user makes — talking to the companion and reading what it found are the same errand.
- **Move quick-log into a long-press on the Nap tab** instead of a floating FAB. Rejected on discoverability: logging is the app's highest-frequency action and a hidden gesture is the wrong home for it. The FAB costs a corner of every screen and is worth it.

**Módosítás (2026-09-01, hub-tile-reorg):** the Én hub's full-width settings band dissolved into a tile + page (`Beállítások` → `/me/beallitasok`, `BeallitasokPage`), following the same tile → own page rule this ADR established rather than an exception to it. In the same change, the AI-domain tiles that had drifted onto the Én hub — `Karakter` (the character dossier's entry point) and the `Tudás` graph entry (now reached from the Mezo-tab Tudástár page instead of its own hub tile) — consolidated onto the Mezo hub, alongside `Heti`'s existing cross-hub precedent. Spec: [`2026-09-01-hub-tile-reorg-design.md`](../superpowers/specs/2026-09-01-hub-tile-reorg-design.md); detail in [`me.md`](../features/me.md) §2 and [`insights.md`](../features/insights.md) §2.0. No change to the five-tab structure or the tile → page rule this ADR decided.
