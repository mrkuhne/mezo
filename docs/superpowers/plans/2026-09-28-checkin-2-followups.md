# Check-in 2.0 — close-out + follow-ups (fresh session prompt)

> Paste the block below into a **fresh Claude Code session on the owner's machine** (it needs
> `bd`, the Dolt DB, `kubectl` to production and Docker/compose — none of these existed in the cloud
> session that built Check-in 2.0). Owner decision 2026-09-28: close everything closable and do the
> small refinements now; no new owner gates are needed for items A–C (no new UI surface); item D is
> a docs/prototype task.

---

```text
You are continuing the shipped "Check-in 2.0" epic in the mezo repo (bd placeholder id `mezo-ck2`
— it was never filed). Read CLAUDE.md and AGENTS.md first (mandatory), then:
- spec:  docs/superpowers/specs/2026-09-27-checkin-2-design.md
- plan:  docs/superpowers/plans/2026-09-27-checkin-2.md  (Kész, ha… checklist at the bottom)
- this follow-up file: docs/superpowers/plans/2026-09-28-checkin-2-followups.md
- what shipped: main merge 47d4553 (release v2.367.0, deploy + ci.yml green on 2026-09-28).
  `git log --oneline 448a83b..47d4553` lists every commit. Feature docs: docs/features/me.md §4
  (check-in backend), today.md, train.md, character.md, companion.md (§9 has the follow-up notes),
  lifegoal.md, needs.md, fuel.md, ritual.md.

The owner is a non-engineer: talk to him in Hungarian, business language (CLAUDE.md §Communication).
He approved all of this already — do not re-ask; only stop for a real blocker.

## 0. Session start
- `gh run list --branch main --limit 3` — a red main outranks everything.
- `bd prime`. Then FILE THE TRACKING that the cloud session could not:
  - an epic "Check-in 2.0 — richer check-in feeding every area" (closed, shipped 2026-09-28,
    close reason referencing 47d4553 / v2.367.0), with child issues for the 10 plan tasks (closed)
    so history is searchable; put the plan's Kész, ha… list into the epic's --acceptance.
  - one open issue per follow-up below (A–E), children of the epic; claim them as you go.
  - The code, migrations and commit messages use the placeholder `mezo-ck2`. Do NOT rewrite
    released Liquibase changesets or history. Instead, in the epic description, record
    "placeholder id in code/migrations: mezo-ck2". New commits use the real bd ids.

## 1. Close-out verification (production is read-only without an explicit owner OK)
- Live site: open https://46.225.112.172.sslip.io/ in the browser. Check the Nap → Check-in page and
  sheet (nothing pre-selected, "Most csak ennyi" after 5 items, pain figure + chips, craving kinds,
  "A nap kérdése" callout), A napod "Te: X/10" card, the Edzés Mai readiness card on a planned gym
  day. Screenshot evidence.
- Production DB (KUBECONFIG=~/.kube/mezo-k3s.yaml, `kubectl exec -n mezo postgres-0 -- psql -U mezo
  -d mezo -c "..."`, no -it): after the owner has saved at least one new check-in, verify the row:
  `select date, slot_time, mood, rested, soreness, pain, pain_regions, pain_intensity, motivation,
  hunger, craving, craving_kinds, digestion, connection, day_rating, asked_items, adaptive_item,
  adaptive_reason, quick_exit from check_in where created_at > '2026-09-28' order by created_at desc
  limit 5;` — expect answered items filled, skipped/unasked NULL, asked_items listing what the sheet
  showed. Also confirm the migrations ran:
  `select id from databasechangelog where id like '%mezo-ck2%';` (3 rows: checkin_2,
  readiness_choice, checkin_2_flag_keys). Pull only what you need; never copy personal data anywhere.
  If the owner hasn't saved one yet, ask him (Hungarian, one line) to fill one in, then check.
- Tick the plan's Kész, ha… items that were open ("new version live on the production URL",
  "production DB shows the expected rows") with evidence in the epic.
- `node scripts/check-beads-backup.mjs --fix`, commit the backup.

## 2. Follow-ups (small; do them in this order, one feat/ branch each or one branch for all,
##    house git flow: local gates → merge --no-ff to main → push → watch deploy)

A. Question of the day: real "need" source + specific why sentence
   - Today `CheckInNeedSource` has only `AllNonCoreNeedSource` (every non-core item is "wanted"),
     and the need why-sentence is generic ("Most azt figyeljük, hogyan alakul {item} — erről van a
     legkevesebb válaszod.").
   - Add a companion-side implementation (companion → biometrics is the legal dependency direction;
     check ArchitectureTest) that returns the check-in items an ACTIVE hypothesis, an enabled pattern
     pair (mezo.companion.patterns.pairs whose metric-a/metric-b is a CHECKIN_* key) or an enabled
     character detector reading that item is waiting on. Map MetricKey CHECKIN_* ↔ CheckInItem.
   - Carry a reason with each wanted item (e.g. the pair's `question` text or the hypothesis title)
     so `AdaptiveItemChooser` can build a specific Hungarian why sentence in the prototype's voice,
     e.g. „Most azt figyeljük, összefügg-e a délutáni sóvárgásod az alvásoddal." Keep the random
     20 % branch and its existing sentence. Keep the pick stable per (user, date, slot).
   - When the need source yields nothing, fall back to AllNonCoreNeedSource behaviour.
   - Tests: chooser picks the wanted item with the thinnest series; why sentence uses the reason;
     fallback; ArchitectureTest.

B. Two pattern pairs that were skipped / substituted (spec §3.8, §3.4b)
   - `day-score~checkin-day` was skipped because no day-score MetricKey exists. Add a DAY_SCORE
     metric (the persisted day score from DayScoreService / day evaluation, one value per closed
     day; null for unscored days), mark it correlatable, and add the pair (same day, lag 0) with
     Hungarian title/mechanism/question/when-texts in the style of the existing pairs („Egyezik az
     app pontszáma azzal, ahogy te értékeled a napot?").
   - `meal-processing~checkin-digestion` was substituted by `meal-score~checkin-digestion`. Add a
     daily NOVA-4 share metric (share of the day's logged meals/kcal classified NOVA 4 — reuse the
     classification ComfortEatingDetector already uses) and switch the pair to it (keep or drop the
     meal-score variant — keep it only if it is not redundant; say which in the commit).
   - Also re-check the lag of `sleep-duration~next-day-checkin-craving`: the builder noted
     sleep_log.date is the WAKE-UP date, so lag 0 may already mean "the day after the night".
     Verify against how existing sleep pairs (e.g. sleep-quality~next-day-training-rpe) are
     interpreted in the pattern engine; fix the new pair (and rename its key) only if it is really
     off by one — do not touch pre-existing pairs without evidence; note what you found in
     companion.md §9.
   - Update CompanionPropertiesIT pair counts and the pattern-pair docs.

C. Small correctness nits found during the build
   - persistent_pain card: it now offers the generic lighten_tomorrow (like joint_overuse). Narrow
     it: offer it only when tomorrow's planned workout loads the painful region (use train's
     PainRegionMap + the planned template read path JointOveruseRule uses; never WorkoutService
     .getToday). Test both branches (AdviceActionCatalogTest / an IT).
   - Request enums (PainRegion, CravingKind, AdaptiveReason, CheckInItemId) with an unknown value
     currently produce HTTP 500 (JSON parse error, no handler). Return 400 with the house
     SystemMessage format (error_handling.md) — check whether a global HttpMessageNotReadable
     handler is acceptable for all endpoints or scope it; add a contract IT.
   - JelekPage aria-label reads „32-ból"; fix the Hungarian suffix harmony („32-ből") generally
     (a tiny helper for -ból/-ből by the number's last word), update its test.

D. Én living prototype + week view parity
   - The week hub now has 9 cells (3×3) with a Hangulat cell (lavender) next to Energia. The Én
     domain has no living prototype yet. Seed docs/design_2.0/prototypes/elo/en.html from
     uveg-en.html + uveg-en2.html (CLAUDE.md §Living prototypes: seed first, commit the seed,
     match the live screens), then add the 3×3 week hub with the mood cell. Publish as an Artifact
     (artifact-design skill first), record the fixed URL in elo/README.md. Also merge the missing
     uveg-napod.html routes into elo/nap.html and uveg-edzes2.html routes into elo/edzes.html if
     feasible in this session (the README says they were not merged); republish those to their
     existing URLs (nap: https://claude.ai/artifact/K16pachHoksG9KY1yKo4C3,
     edzes: https://claude.ai/artifact/DdTK5jJ6XTBuqnPSC3fpcC — read them first, then publish with url).

E. Docs hygiene
   - `node scripts/lint-docs.mjs` had 3 pre-existing stale docs (goal-engine.md from mezo-y72o3,
     recipe.md from mezo-iwmsw, settings.md from mezo-zn01o/wqzx8/mcb44) and 1 warn (habit.md,
     9 key_files). Review and refresh them so the gate reads 0 errors / 0 stale.
   - Update companion.md §9 / me.md §4 / today.md for A–D; `node scripts/gen-codemap.mjs`.

## 3. Gates (per CLAUDE.md; this machine has Docker)
- Backend: focused tests for every touched class, then the full suite once:
  `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true` (ALWAYS clean).
- Frontend (if touched): `cd frontend && pnpm build && CI=true VITE_USE_MOCK=true pnpm test &&
  CI=true VITE_USE_MOCK=false pnpm test`; affected `pnpm test:layout` specs.
- lint-docs 0/0, gen-codemap, check-beads-backup --fix.
- Merge `--no-ff` to main, push, watch `deploy` + `ci.yml` to green, verify live (A's why sentence
  visible on the check-in sheet when a need item is chosen; the Napom/week screens unchanged).

## 4. Report to the owner (Hungarian, short, CLAUDE.md §Communication)
Walk what was closed (tracking filed, live + DB verified) and what changed in everyday words:
„A nap kérdése most megmondja, pontosan mit nyomoz", „két új összefüggés: az app pontszáma vs. a
te ítéleted; a feldolgozott étel vs. az emésztés", „a fájdalom-kártya csak akkor ajánl könnyítést,
ha holnap tényleg az a testrész dolgozna", „az Én résznek is van élő mintája". Anything not done:
say so plainly with the reason.
```
