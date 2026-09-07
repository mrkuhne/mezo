---
title: "Life-goal progress engine — prior art research report (agent web-research)"
type: article
source_url: agent-web-research (Claude subagent, sources cited inline)
ingested: 2026-09-06
sha256: 48b973582a6a067deb144de76d8df2f3525c6987dbc4a1600e8ca8f361c8cd86  # body below this frontmatter, pre-frontmatter capture
---

<!-- RAW SOURCE — immutable. Agent web-research report (Claude subagent, 2026-09-06),
     commissioned for the life-goal research-wiki ingest (mezo-iizd.13). The source list is
     the one named in docs/superpowers/specs/2026-09-03-lifegoal-slice2-motor-design.md §2.
     Do not edit content below. -->

# Life-goal progress engine — prior art research report (2026-09-06)

> Fetch note from the agent: ml4devs.com (403) and habitica.fandom.com/wiki/Cron (402) were both
> unreachable directly via WebFetch; authoritative alternates found via search were substituted
> (GitHub issue threads for Habitica, a dev.to summary of the same ml4devs pattern), and the
> direct-fetch failures are noted explicitly below.

## 1. Habit/score engines

### Loop Habit Tracker (uhabits)

**Reached (full):** GitHub Discussion #689 (FAQ), Discussion #1112 (constants question). Direct source file fetch (`ScoreList.java`) 404'd; formula content below is taken from maintainer statements quoted inside Discussion #1112, not from reading the source directly — flagged as second-hand quotation, not primary-source code reading.

- **Source:** https://github.com/iSoron/uhabits/discussions/689
- **What it describes:** The FAQ explains uhabits' habit "Score" as a value computed by exponential smoothing over the entire history of checkmarks — "a weighted average that takes into consideration every repetition of the habit, from the very first day you started your habit until today," with recent repetitions weighted more heavily than old ones.
- **Concrete mechanism / exact numbers:** Daily habits reach 80% of max score after one month, 96% after two months, 99% after three months. Non-daily habits (e.g. every-other-day) take proportionally longer to reach the same benchmarks.
- **Source of truth:** The FAQ implies, but does not explicitly state, that the raw daily checkmark is the only stored fact and score/streak/trend are derived — this is an **inference**, not a direct quote. The FAQ does not address what happens computationally when a past checkmark is edited (full recompute vs. partial window vs. cache invalidation) — this is explicitly undocumented in the source.
- **Fit:** Good prior art for "one source of truth, N derived read-models recomputed on demand"; weak prior art for the recompute-window question specifically, since uhabits' own docs don't address it.

- **Source:** https://github.com/iSoron/uhabits/discussions/1112
- **What it describes:** A user asks why the smoothing constants in `Score.java`'s multiplier formula are what they are; a maintainer responds with the exact formula and its derivation.
- **Concrete mechanism / exact numbers:** Multiplier formula quoted verbatim: `double multiplier = pow(0.5, frequency / 13.0);`. The maintainer states the constants (0.5, divisor 13.0) are chosen deliberately, not arbitrarily, to produce the 80%/96%/99% decay curve above. For a daily habit (frequency = 1), the multiplier simplifies to ≈0.95 — i.e. **the old (running) score contributes 95% of the new score on each day's update**, and the day's new checkmark contributes the remaining weight. This is a textbook single-pole exponential moving average: `score_new = multiplier * score_old + (1 - multiplier) * today_value`.
- **Retroactive edits:** Not addressed in this thread either — explicitly noted by the model that fetched it as "not available."
- **Fit:** Directly relevant if mezo's life-goal "momentum"/"trend" needs a smooth, self-decaying score from raw daily booleans rather than a rigid streak counter. Bad fit if the product requirement is "day N's edit must retroactively change day N+5's displayed score" — an EMA update rule, run forward-only from history, naturally does this (recompute forward from the edited day), but uhabits' own docs never confirm they implement that recompute-forward step; treat this as a mechanism you'd have to design yourself, not one you can point to as validated by uhabits' code as fetched here.

### Habitica cron

**Reached (partial):** Direct WebFetch of `https://habitica.fandom.com/wiki/Cron` returned **HTTP 402 Payment Required** on two separate attempts — the wiki page itself is unreachable through this tool. Content below is reconstructed from a web search (search-engine snippet, not the page itself) plus direct WebFetch of two Habitica GitHub issue threads that are primary sources on the bug class.

- **Source:** https://habitica.fandom.com/wiki/Cron — **UNREACHABLE (402), reported explicitly rather than paraphrased from memory.**
- **What the search summary (not the page) indicates:** "Cron" is Habitica's daily job that evaluates all of a user's Dailies at the user's configured day-start time (or on next login after that time), applying damage for incomplete Dailies, resetting Dailies to unchecked, applying streak increments/resets, and progressing any active quest/boss damage.

- **Source:** https://github.com/HabitRPG/habitica/issues/8665 ("Double cron run in a single day")
- **What it describes:** A concrete, reported instance of cron executing twice for the same calendar day for one user.
- **Concrete mechanism:** Root cause traced to custom day-start time interacting with timezone changes across a party member's devices: cron ran once at the configured custom-day-start time, then ran again when the user logged in later that same day, because the two trigger paths ("run at day-start" vs "run on first login after day-start") both fired independently without a done-for-today guard being consistently checked across the timezone shift. Direct quote from the reporter: "for whatever reason today it ran at her custom day time plus the moment she logged in for the first time in the day."
- **Damage:** Reporter describes "a loss of levels and such" — i.e., dailies were evaluated as incomplete/incurred damage or lost streak progress twice for the same day. Manual repair was required via Habitica's admin/support tooling ("Fix Character Values"); no code-level idempotency fix is described as confirmed in the thread — it was closed with data manually patched, root cause not definitively nailed down in the visible thread.
- **Fit:** This is exactly the failure mode a recompute engine must design against: a day-boundary/timezone-driven job that runs "at day start" OR "on next login," where those two triggers can race and neither has a durable done-for-today marker, causes real user-facing double punishment. Directly applicable if mezo's daily recompute is similarly triggered by both a schedule and a client-visit fallback.

## 2. Rolling recompute windows

### Exist.io sync window

**Reached (partial):** The specific KB article fetched does not contain sync-window/backfill content — it answers a different, adjacent question. Reported explicitly rather than invented.

- **Source:** https://kb.exist.io/article/55-will-exist-find-correlations-across-multiple-days
- **What it actually describes:** This article is about Exist's cross-day correlation-finding for its insights feature, not about sync/backfill windows. It states Exist checks for correlations between attributes on **two consecutive days** — e.g., "whether alcohol consumption today affects sleep tomorrow, or if workout duration today impacts mood the following day" — and recommends users "track things as they happen" on the day they occur, since Exist checks whether that day's data correlates with the next day's.
- **Explicit gap:** The article contains **no mention of sync windows, backfill periods, or rewriting recent days of data** — the "each run rewrites the last N days" claim in the task's framing could not be verified against this specific URL. No further reachable Exist.io docs on sync-window mechanics were found in this pass.
- **Fit:** Cannot be cited as prior art for the rolling-recompute-window pattern based on this source; it is useful only as evidence that Exist's *analysis* layer (correlations) operates on short (1-day-lag) windows over otherwise finalized daily records, which is a distinct concern from write-side backfill. Flag this gap explicitly in the wiki entry rather than assert an unverified mechanism.

## 3. Combining heterogeneous signals

### Oura Readiness contributors

**Reached (full):** https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors

- **What it describes:** Oura's Readiness Score is built from nine named contributors, each independently scored, then combined into a single top-level score.
- **Concrete mechanism / exact numbers:**
  - Nine contributors, named exactly: Resting Heart Rate, HRV Balance, Body Temperature, Recovery Index, Sleep, Sleep Balance, Sleep Regularity, Previous Day Activity, Activity Balance.
  - Each contributor is normalized onto a common **0–100 scale**, with published bands: 85–100 = "Optimal," 70–84 = "Good," 60–69 = "Fair," 0–59 = "Pay Attention."
  - Normalization is personalized: contributors are computed "based on your personal averages," and the article states it takes the app **up to two weeks** to learn a given user's baseline averages before contributor scores are meaningful.
  - **Weighting/combination is explicitly not disclosed.** The article states what each contributor measures and why it matters but gives no formula, weights, or aggregation method for turning the nine 0–100 numbers into the final Readiness Score — this is a genuine documented opacity in the primary source, not a gap introduced by the fetch.
- **Fit:** Good prior art for "normalize N heterogeneous per-domain signals onto one common 0–100 scale, using a personal rolling baseline, before combining" — directly transferable if mezo's life-goal score blends heterogeneous inputs. Bad/weak prior art for the actual combination step, since Oura treats that as proprietary/undisclosed; mezo cannot point to Oura for "how to weight," only for "how to normalize per-signal before weighting."

## 4. The batch-job shape

### Idempotent partition-overwrite / backfilling

**Reached (partial):** Direct WebFetch of https://www.ml4devs.com/what-is/backfilling-data/ returned **HTTP 403 Forbidden** on two separate attempts — unreachable via this tool. A substitute source found by search documents the identical named pattern in the same terminology; it is **not** the assigned URL and is flagged as such.

- **Source (assigned, unreachable):** https://www.ml4devs.com/what-is/backfilling-data/ — **403 Forbidden, could not be read directly.**
- **Source (substitute, reached):** https://dev.to/alexmercedcoder/idempotent-pipelines-build-once-run-safely-forever-2o2o
- **What it describes:** The general data-engineering pattern for making a recurring batch job safe to re-run over historical date ranges.
- **Concrete mechanism:**
  - **Partition overwrite:** "Instead of appending rows, your pipeline replaces the complete partition for the time period being processed" — delete-then-insert (or `INSERT OVERWRITE` / Delta Lake `replaceWhere`) scoped to the exact time-partition being recomputed, so "if the job reruns, it deletes and recreates the same partition — resulting in the same data."
  - **Upsert/MERGE by business key** as the alternative for non-time-partitioned tables: "if the merge runs twice with the same staging data, the result is identical."
  - **Event/streaming dedup** via process-level checks, conditional writes, or windowed dedup — named as a distinct third case, relevant only if the recompute job also emits side-effecting events (notifications, etc.), which maps to the "side-effect ledger" framing.
  - **Core stated principle, quoted directly:** "Idempotency is not about preventing retries. It's about making retries safe." — an idempotent operation must produce the same result regardless of how many times or how often it's invoked, which is what makes backfills, retries, and orchestrator-driven reprocessing all safe operations on the same code path.
- **Gap vs. the task's framing:** The bounded-recomputation-window and "side-effect ledger" language was **not found verbatim** in either the assigned or substitute source; the substitute source's dedup discussion is the closest analogue to a side-effect ledger, but no source fetched in this pass names that concept directly. This should be marked as a synthesis/gap in the wiki entry, not attributed to either fetched source.
- **Fit:** Directly applicable to mezo's daily recompute job: model each day of life-goal progress as a partition; the daily job should always delete/overwrite the specific day-partitions it's recomputing rather than append, so that reruns (whether from a schedule retry, a manual backfill, or a retroactive raw-data edit) are safe by construction — this generalizes the uhabits and Habitica-cron findings above into an explicit engineering pattern with a name and a mechanism.

## 5. Source table

| # | Source | URL | Reached? (full / partial / unreachable) |
|---|--------|-----|------------------------------------------|
| 1a | uhabits FAQ | https://github.com/iSoron/uhabits/discussions/689 | full |
| 1b | uhabits score constants discussion | https://github.com/iSoron/uhabits/discussions/1112 | full |
| 1c | uhabits `Score.java` source (attempted direct read) | https://github.com/iSoron/uhabits/blob/dev/uhabits-core/src/main/java/org/isoron/uhabits/core/models/Score.java | unreachable (404 — path not located in this pass) |
| 2 | Habitica Cron wiki | https://habitica.fandom.com/wiki/Cron | unreachable (402, twice) — reconstructed only from search-engine snippet |
| 2b | Habitica "Double cron run in a single day" issue | https://github.com/HabitRPG/habitica/issues/8665 | full |
| 3 | Exist.io cross-day correlations KB article | https://kb.exist.io/article/55-will-exist-find-correlations-across-multiple-days | full (but does not contain the sync-window/backfill content the spec cites it for) |
| 4 | Oura Readiness Contributors | https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors | full |
| 5a | ml4devs backfilling article (assigned) | https://www.ml4devs.com/what-is/backfilling-data/ | unreachable (403, twice) |
| 5b | dev.to idempotent pipelines (substitute) | https://dev.to/alexmercedcoder/idempotent-pipelines-build-once-run-safely-forever-2o2o | full |

**Explicit unreachable/gap summary:** `habitica.fandom.com/wiki/Cron` (402) and `ml4devs.com/what-is/backfilling-data/` (403) could not be fetched directly despite two attempts each; both are reported here as unreachable rather than paraphrased from model memory. Substitute/adjacent sources were used to cover the same named patterns where found via search, and are marked as such above. The Exist.io KB article was reached in full but did not contain the sync-window/backfill content the spec's framing assumed exists there — this is a content gap in the source, not a fetch failure, and should be treated as unverified in the wiki rather than asserted.
