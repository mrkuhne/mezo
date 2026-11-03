# Alternative prototype — review fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what the 2026-11-03 full review of the alternative prototype (mezo-pi0jf) found: the few real feature losses, the chrome that is below the touch/readability floor, dead-end buttons, and cross-domain wording/date contradictions.

**Architecture:** Every change lives in the experiment layer `docs/design_2.0/prototypes/vilagos/kiserlet-{napom,edzes,fuel,mezo,en}.js`; the approved files (`nap.js`, `edzes.js`, `fuel.js`, `mezo.js`, `en.js`, `kit.js`, `foly.js`, `klinikai-iranyok.html`) are NOT edited. Tasks are grouped by file so four implementers can run in parallel without touching the same file; the controller verifies with the scratchpad Playwright scripts and republishes once.

**Tech Stack:** plain JS template strings + CSS in the prototype, Playwright (`frontend/node_modules/@playwright/test`) probes served from `python3 -m http.server 8757 --bind 127.0.0.1` in `docs/design_2.0/prototypes`.

**Spec:** the review report given to the owner on 2026-11-03 (findings restated in §Findings below, corrected against `vilagos/KISERLET.md` owner decisions).

## Findings this plan implements

Corrected after checking KISERLET.md — these are **owner decisions, NOT losses, do not restore**: Nap Életjelek detail page and the Beszélgetés › Életjelek tab (removed 2026-10-14), the Mai napló timeline on Nap Mai (approved Mai 2026-10-14; quick log is the + button), the Fuel log Keresés tile (removed 2026-11-02), the Küldetések swap (now "Cserélem" inside Részletek).

Real items:
1. Nap › Rutin "‹ Tegnap" only toasts; the approved past-day view (`rst:rutin:past`, nap.js:467–470) is unreachable.
2. Mezo › Konzílium lost "Te hogy látod? Válaszolj…" (approved sheet `reply`, mezo.js:1068).
3. Mezo › Üzenőfal shows the same posts twice (Rád vár rows and again in Tegnap · esti kiadás); page is 4,7 screens.
4. Title-bar buttons are 36×36 (floor 40); top tabs are 31–35 px high on Nap/Edzés/Fuel/Mezo (Én already 40).
5. Bell and gear open the Én pages only inside Én; elsewhere they toast.
6. The + button covers the last row of a page (e.g. Üzenőfal "Korábbi napok").
7. Dead ends: Nap "Beszélgess Mezóval" / "Chat" toast "Mezo · Chat" although `#w-mezo-chat` exists; Én › A hét napjai says "Koppints egy napra…" but each day only toasts.
8. Text below 12 px at 320 (header badges excepted) on converted pages: Fuel trendek, meal, score; Mezo szoba; Edzés nap, izom (and any other converted route `audit3.mjs` flags).
9. Wording/dates: "kcal" in Nap/Edzés/Fuel vs "kalória" in Én; Fuel says yesterday is "október 6." while every domain's today is szeptember 24.; Én says "lezárt hét" on Thursday of that week; Fuel Mai "Logolj bármit" still has Keresés while the log page dropped it.

## Global Constraints

- Owner rules: no grey helper text (Mezo lines instead), no abbreviations, no numbered headings, no emojis, no purple/orange hero boxes, each domain keeps its tinted ground, mode switches in place, ≥12 px text at 320 px, ≥40 px tap targets (44 for primary).
- Never edit an approved file; wrap/override from the `kiserlet-*.js` layer (`FREG.<domain>.routes` wrapping, CSS under the file's `P` scope, `inText` for text-only rewrites).
- en.js / mezo.js `soft()` re-render from private tables: in-place state goes on own `data-w12` / `data-w13` / `data-w3…w11` attributes, never on the approved handlers' keys.
- Cross-domain navigation from a click: `location.hash='#w-<domain>-<route>'` (the shell re-renders on `hashchange`).
- Default hash of both shells stays `#w-en-beall` unless the controller changes it for publishing.

## Review Focus

1. Redraw after an approved in-place switch (`soft()`) wiping a newly added element → each task's click test clicks once more after the switch.
2. 320 px width: enlarged tabs must still fit in one row without horizontal page scroll → Task 1 test.
3. Bell/gear inside Én must not double-navigate (the existing en.js capture handler) → Task 4 test.
4. Back button after a cross-domain jump returns to a sensible page (no blank "nincs kidolgozva") → Tasks 1, 4 tests.
5. Reduced motion (`body.still`) still hides any new animation → none added; reviewer confirms.

---

### Task 1: Nap file + shared chrome (`kiserlet-napom.js`)

**Files:** Modify `vilagos/kiserlet-napom.js` (its `P` scope covers all five domains). Test: `<scratchpad>/t1.mjs`.

- [ ] **Step 1: Write the probe** `t1.mjs` (uses `lib.mjs`), asserting at 320×800:
  - on `nap-mai`, `edzes-mai`, `fuel-mai`, `mezo-mai`, `en-mai`: every `.fh-top .fh-ib` and `.fh-tabs [data-go]` has `getBoundingClientRect().height >= 40` and width ≥ 40; `sc.scrollWidth <= sc.clientWidth`;
  - on `mezo-mai`: the last row's bottom ≤ the `.fh-fab` top − 8;
  - on `nap-rutin`: clicking the "‹ Tegnap" control renders text "Tegnap · kedd"; clicking "Vissza a mai napra" returns;
  - on `nap-uzenetek` and `nap-mai`: clicking "Beszélgess Mezóval" / "Chat" lands on `#w-mezo-chat`; history back returns to the Nap page.
- [ ] **Step 2: Run it** — `node t1.mjs` — expect FAILs on all four groups.
- [ ] **Step 3: Implement** — CSS under `P`: `.fh-top .fh-ib{min-width:40px;min-height:40px}`, tab buttons `min-height:40px` (reuse the Én `tabs5` values); `.scroll` bottom padding so content clears the FAB. Rutin: the new rutin page's Tegnap control emits `data-n="rst:rutin:past"` (approved handler) instead of the toast. Chat: a capture click listener (pattern of en.js:792) that turns `[data-toast="Mezo · Chat"]` into `location.hash='#w-mezo-chat'`. Wording: an `inText` pass on Nap routes, `kcal-t` → `kalóriát`, `kcal` → `kalória` (Step 1 also asserts no `\bkcal\b` on `nap-mai nap-napom nap-uzenetek`).
- [ ] **Step 4: Run** `node t1.mjs` → all PASS; `node err.mjs nap-mai nap-rutin nap-uzenetek` → no page errors.
- [ ] **Step 5: Commit** `docs(prototype): review fixes — chrome sizes, Rutin Tegnap, chat links (mezo-pi0jf)`.

### Task 2: Mezo (`kiserlet-mezo.js`)

**Files:** Modify `vilagos/kiserlet-mezo.js`. Test: `<scratchpad>/t2.mjs`.

- [ ] **Step 1: Probe** asserting: `mezo-konzilium` has a "Te hogy látod?" control opening sheet `reply` (sheet text contains "Elmesélem"), still present after clicking `[data-w9="v:cv"]` and back; on `mezo-mai` no post title appears both in the Rád vár block and in the Tegnap block; `mezo-szoba` has no text < 12 px (badges excepted) at 320.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — konzilium: a "Te hogy látod? Válaszolj…" card at the end of the page with `data-sheet="reply"`; Üzenőfal: the Ma/Tegnap blocks skip posts already listed in Rád vár (their keys are the `w3c=` values) — if a block becomes empty it is omitted; szoba: raise the flagged labels to 12 px.
- [ ] **Step 4: Run** probe + `err.mjs mezo-mai mezo-konzilium mezo-szoba` → PASS, clean.
- [ ] **Step 5: Commit** `docs(prototype): review fixes — Konzílium reply, Üzenőfal without repeats (mezo-pi0jf)`.

### Task 3: Fuel + Edzés (`kiserlet-fuel.js`, `kiserlet-edzes.js`)

**Files:** Modify both. Test: `<scratchpad>/t3.mjs`.

- [ ] **Step 1: Probe** asserting at 320: no text < 12 px (badges excepted; SVG text measured by box height × 0.8 as in `audit3.mjs`) on `fuel-trendek fuel-meal fuel-score edzes-nap edzes-izom`; the visible text of every converted Fuel/Edzés/Nap route contains no `\bkcal\b`; `fuel-mai` contains no "október"; `fuel-mai` "Logolj bármit" has no "Keresés" tile and has "Kamra".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — CSS floors under each file's scope for the flagged classes; an `inText` pass (copy the `hu`/`hu4` helper idea from kiserlet-en.js) turning `kcal-t` → `kalóriát`, `kcal` → `kalória`; date text "október 6." / "okt. 6" → "szeptember 23." / "szept. 23."; the Fuel Mai tile row gets the log page's six modes (Fotó, Recept, Kamra, Gyors, Diktálás, Szokásosak). Wording goes in `kiserlet-napom.js` for Nap — Task 1's implementer adds the same `kcal` pass there (Step 3 of Task 1 includes it).
- [ ] **Step 4: Run** probe + `err.mjs` on the five routes → PASS.
- [ ] **Step 5: Commit** `docs(prototype): review fixes — Fuel/Edzés readability and wording (mezo-pi0jf)`.

### Task 4: Én (`kiserlet-en.js`)

**Files:** Modify `vilagos/kiserlet-en.js`. Test: `<scratchpad>/t4.mjs`.

- [ ] **Step 1: Probe** asserting: from `nap-mai`, `edzes-mai`, `fuel-mai`, `mezo-mai` the bell lands on `#w-en-ertesitesek` and the gear on `#w-en-beall`; from `en-mai` each lands there exactly once (history length +1); on `en-napok` clicking the Hétfő row lands on `#w-nap-napom`; `en-mai` and `en-het` show no "lezárt hét".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — one capture listener that, outside Én, maps `.fh-top .fh-ib[aria-label="Értesítések"|"Beállítások"]` to `location.hash='#w-en-ertesitesek'|'#w-en-beall'` (Én keeps the approved en.js handler); the converted A hét napjai rows navigate to `#w-nap-napom` instead of the toast (past days: `#w-nap-napom.<iso>` if the Nap route accepts it, else plain); eyebrow "Szeptember 21–27. · lezárt hét" → "Szeptember 21–27. · a hét eddig".
- [ ] **Step 4: Run** probe + `err.mjs en-mai en-het en-napok` → PASS.
- [ ] **Step 5: Commit** `docs(prototype): review fixes — bell and gear everywhere, days open A napom (mezo-pi0jf)`.

### Task 5: Whole-prototype check, log, publish (controller)

- [ ] Re-run `routes.mjs`, `reach.mjs` (visited ≥ 318, 0 page errors), `parity.mjs`/`lost.mjs` (no new X lines beyond the owner-decision list above), `audit3.mjs` over all routes (no converted route with text < 12 px except badges; no title-bar/tab tap < 40).
- [ ] Add one row to `vilagos/KISERLET.md` ("Review fixes, 2026-11-03") listing items 1–9.
- [ ] Copy the five changed files into the scratchpad artifact map; republish via SendMessage to subagent `a843fc2d82953d9aa` with url `https://claude.ai/artifact/2ZdMk9D8jsjbFRhf2cB9cP`.
- [ ] Commit + `git push` the branch `claude/mai-napom-custom-graphics-eedeb2`.
