# Boop Pénz — handover and implementation plan

- **Date:** 2026-11-19 · **Epic:** `mezo-r36n9` · **Design issue:** `mezo-r36n9.33.1`
- **Design (the why, approved by the owner 2026-11-19):**
  [`../specs/2026-11-13-boop-penz-design.md`](../specs/2026-11-13-boop-penz-design.md)
- **Status:** ready to build, **blocked on B6** (`mezo-r36n9.16`). Nothing here starts before that ships.

---

## 0. Read this first — the handover

**What you are building.** The fifth life area of Boop: the owner's money in one place, with an AI companion
that watches the news daily and helps him invest across four horizons. It replaces his standalone Base44 finance
app entirely. One AI that already sees his sleep, food and training now also sees his money — that is the whole
point, and it is why this lives in Boop rather than staying where it is.

**The three owner gates are closed.** Brainstorm → spec → OK (2026-11-13…19), prototype → OK (2026-11-19),
and this plan. Per `CLAUDE.md` §Frontend change workflow the owner does **not** want another visual round:
build to match the approved spike, then run straight through *build → gates → merge → deploy → verify live →
report*. Stop and ask only if a blocker would change what he sees.

**Read, in this order, and no more than this:**

| # | What | Why |
|---|---|---|
| 1 | the design spec, **§2 decisions · §5 the five pages · §5.6 the approved look · §6 boundaries** | this is the contract with the owner |
| 2 | spec **§9 Codebase terrain** | where every piece goes, with the file to copy |
| 3 | spec **§7 Data** and **§10.1/§10.2** | the model, and every call already made so you do not re-open them |
| 4 | [`../research/boop-life/02-finance-tracker-map.md`](../research/boop-life/02-finance-tracker-map.md) | the old app is the specification — the allowance engine, the amount guard, the SMS path |
| 5 | [`../research/boop-life/04-invest-prior-art.md`](../research/boop-life/04-invest-prior-art.md) | §4 (numbers are computed, never generated) and §5 (the trade-journal primitives) |
| 6 | the spike: `docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/{EletContent.swift,EletPenzKit.swift}` | executable copy and layout for all four pages |

**What already exists and must be reused, not rebuilt** (checked 2026-11-19):

- The whole area page: `NKAreaPage`, `NKAreaBar`, `NKAreaTab(s)`, `NKAreaSubPage` — plus every block
  (`NKHighlight`, `NKStatRow`, `NKLevelBar`, `NKCurve`, `NKComposition`, `NKRowList`, `NKMenuGrid`, `NKList`,
  `NKNote`, `NKAskRow`, `NKActions`, `NKInfoRow`, `NKBare`, `NKHueText`) in
  `ios/BoopKit/Sources/BoopDesign/Napkelte/{Area,AreaBlocks}.swift`.
- **`Hue.penz`** already exists. **`NKAreaPage(display: nil)`** already gives the scoreless orb the owner asked
  for. Neither needs a kit change.
- Honest states: `NKStale`, `NKNoFreshData`, `NKNotLiveYet`, `NKBlockState` — use them instead of inventing
  placeholder numbers for a tab whose data is not built yet.
- Offline-first writes: B3's `RitmusEnvironment` (ledger → outbox → flush), `OutboxKind`, `RitmusClient`.
- The backend module template: `feature/dayclose`, file for file.

**The two kit gaps you will have to fill** (spec §9): a `glyph:` parameter on `NKBare`'s section head, and the
news card plus its analysis sub-page. Everything else is composition.

**The five things that will bite you**, each already written up in spec §9 — read it, do not rediscover them:
Testcontainers for backend suites, focused ITs missing ArchUnit, `merge.yml` omission failing silently, the
jsonb `?` placeholder killing the changelog, and the scheduler pool of size 1.

---

## 1. Slices

Four slices, in order. **L4 ships no screen; the digest cannot ship before the portfolio it talks about.**
Each is one bd issue, one `feat/` branch, one worktree.

| Slice | Issue | What lands | Depends on |
|---|---|---|---|
| **L4** Pénz · adatalap | `mezo-r36n9.102` | money type + FX policy, accounts/categories/transactions/recurring/month-close, the allowance engine, the bank-SMS ingest and its auth, the amount guard. Backend only. | B6 |
| **L5** Pénz · a terület | `mezo-r36n9.103` | the area page, **Költés** and **Ma** (without the digest), cash capture, the Pénz card on Terv | L4 |
| **L6** Pénz · portfólió és hírek | `mezo-r36n9.104` | holdings with sleeves, quotes, **Pénzem**, the news poller + relevance filter + the digest and its analysis page | L5 |
| **L7** Pénz · Gyakorlás és javaslatok | `mezo-r36n9.105` | the paper-trading loop, the curated product catalog, the proposal flow, the monthly strategy | L6 |

---

## 2. L4 — Pénz · adatalap

**Goal:** the money is in the database and the weekly remainder is computable. No screen.

1. **The money value type** (spec §7). This is the first in the codebase: minor units + currency + a HUF twin,
   and one conversion policy (which rate, as of when, stored or derived) decided once and written down, not
   discovered per field. FX from frankfurter.dev, cached per date as the old app does.
2. **Schema** in `db/changelog/1.1.0/`, copying `202611121120_mezo-r36n9.13_day_close.sql` for the house style.
   Register every table in `support/ResetDatabase` and add a populator **in the same change**.
   Dedup-by-external-id upserts go native `ON CONFLICT` (soft delete hides rows from derived finders).
3. **The allowance engine**, ported as **pure functions, TDD**. The old app's 604 vitest tests are the oracle and
   are runnable locally. The derivation must include the two lines the owner decided on: *Gyakorlás* as its own
   deduction (§10.1.2) and the previous month's deficit.
4. **The bank-SMS ingest.** Per §10.1.7 build the **proper auth mechanism**, not a 30-day JWT: filter, matcher,
   secret handling, rate limiting, and owner resolution for `created_by`. Keep the iOS Shortcut contract.
5. **The amount guard**, ported and extended: parse every HUF figure out of generated Hungarian text and verify
   it against the computed inputs.

**Kész, ha…**
- [ ] A money value type exists with one documented conversion policy; no bare `Integer` forint fields.
- [ ] The allowance engine reproduces the old app's test oracle; the derivation shows *Gyakorlás* and the
      previous deficit as their own lines.
- [ ] An SMS posted by the Shortcut lands as a transaction, idempotently, authenticated, rate-limited, with the
      right owner — and a replayed message does not double.
- [ ] The amount guard downgrades generated text naming more money than the inputs allow (test with a fixture).
- [ ] Contract: `api/feature/penz/penz.yml` written first, **appended to `api/generate/merge.yml`**,
      `api/openapi.yml` and `api.gen.ts` regenerated and committed, error codes in **both** message bundles.
- [ ] Gates: `./mvnw test -Dmezo.test.use-testcontainers=true` with `ArchitectureTest` in the `-Dtest` list;
      `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0.
- [ ] `docs/features/` has the module's page; the feature index row and the roadmap entry are true.

---

## 3. L5 — Pénz · a terület

**Goal:** the owner opens the area and sees what he has to do today and what is left this week.

1. `NKAreaPage(hue: .penz, display: nil, …)` with the five-item bar (`Ma · Pénzem · Költés · Gyakorlás` + Boop).
   `Pénzem` and `Gyakorlás` ship as **`NKNotLiveYet`** — they say what will be there and what has to happen
   first. **Never a fake number.**
2. **Költés** exactly as spec §5.3 and the approved spike: the weekly remainder as the hero, the derivation
   rows, the month standing, the breakdown, today's items with the "needs review" row, and *mire gyűjtök*.
3. **Ma** as §5.1 minus the digest: the verdict (most days "nincs dolgod"), two buttons, the three numbers.
4. **§5.6 is the acceptance bar**: a glyph on every section head, two buttons under the verdict, the explanation
   behind `NKInfoRow`, and no "how it works" paragraph left in the scroll.
5. Cash capture as a new `OutboxKind` + payload + `RitmusClient` branch + test; `OutboxItem.id` is the
   `clientRef` the server keys idempotency on.
6. The Pénz card on Terv.

**Kész, ha…**
- [ ] Every screen and sheet of the approved spike exists and matches it; empty, loading and error states done;
      320 pt width; reduced motion.
- [ ] The orb carries **no number**; it fills with the week's remaining share.
- [ ] Every section head has a glyph; every page opens with two buttons; every explanation is behind an info row.
- [ ] `Pénzem` and `Gyakorlás` show `NKNotLiveYet`, not placeholder data.
- [ ] A cash expense recorded with the network off appears immediately, survives a relaunch, and flushes later.
- [ ] Gates: `BoopCoreTests` green locally (iOS is **not** built in CI); codemap; lint-docs 0/0.
- [ ] `docs/features/boop-ios.md`, the feature index row and the roadmap entry updated.

---

## 4. L6 — Pénz · portfólió és hírek

**Goal:** he sees his money by horizon, and every morning what moved and how it touches him.

1. Holdings **with a sleeve**, investment transactions with **lot-level cost basis**, and one product in two
   sleeves as two holdings (§10.1.3). The quote cache behind the **SSRF-guarded** fetcher (`WebPageClient`
   pattern: http/https only, public hosts only, redirects never followed, streaming body cap).
2. **Pénzem** as §5.2. The long sleeve's measure is **years of coverage** in the exact wording of §10.2.2 — which
   needs the allowance engine's fixed-cost total, so this depends on L4 for more than storage.
3. **The news poller.** First scheduled outbound-HTTP job in the repo: two switches, `UserFanOut`, the clock
   pinned in a package-visible overload, and **it must offload its I/O to an `@Async` executor** (scheduler pool
   is 1). Add an `AdminAlertService` rule for it — a job that makes no LLM call and writes no row is invisible
   to every existing alert.
4. **The digest** as §5.1: holdings-only relevance, M1's published criteria, stories grouped with a source count.
   **Every figure is computed by the backend and passed through verbatim**; the model narrates. No free-text
   numeric answers about the portfolio. Evaluate against the taxonomy: Entity Swap · Numerical Error ·
   Negation Flip · Temporal Confusion.
5. **The analysis page** as `NKAreaSubPage` with the five parts of §5.6, none dropped — including the
   per-item "nincs teendőd" reason and the written account of where Boop could be wrong.
6. **Untrusted text.** Article bodies are the first adversarial external text in the app; there is no in-repo
   pattern to copy. Label and isolate them in the prompt, and keep the deterministic validator downstream.
7. **No push** (§10.2.4).

**Kész, ha…**
- [ ] Sleeve cards, the holdings under them, the forward event timeline and the quiet Gyakorlás row all match
      the spike; stale prices say they are stale (`NKStale` / `NKNoFreshData`).
- [ ] The long sleeve prints years of coverage in the agreed wording, with no growth assumed.
- [ ] Every forint figure in a digest item traces to a backend computation; a seeded prompt-injection string in
      an article body does not change Boop's output or leak instructions.
- [ ] Killing the news provider in a test surfaces an admin alert.
- [ ] The analysis page has all five parts and no verdict or action button anywhere in the digest.
- [ ] Gates as L4/L5, plus the AI ITs under `@ActiveProfiles("companion-fake")`.

---

## 5. L7 — Pénz · Gyakorlás és javaslatok

**Goal:** he can practise trading without risking money, and ask Boop what to do with a bigger sum.

1. **The paper-trading loop** (§5.4): plan before (what · why · where I get out), one line after with the fixed
   8-tag set and a mistake flag, **one trade id per position**, R as the unit, the weekly review, the hard
   20 000 Ft cap, and the sample-size honesty line under ~50 tagged trades.
   **No market data at all** (§10.1.4) — everything is owner-typed; an open position is valued at the last
   close, labelled as such. Every row carries a `paper` flag from day one (§10.1.5).
2. **The curated product catalog** (§10.2.1): products with fee fields and a `reviewed_at`, research that may
   **suggest** an addition, and a one-tap owner approval before anything may be named in a proposal.
3. **The proposal flow** on the shared proposal desk: per-horizon splits and purchase advice, two or three
   concrete products per sleeve with what each is, how they differ, what they cost and the why — then he adjusts
   and accepts. The monthly recurring strategy is proposed the same way.

**Kész, ha…**
- [ ] A trade cannot be journalled without a plan; the weekly review names the week's most common mistake and
      what it cost; under 50 trades the page says the numbers are noise.
- [ ] The cap is enforced and cannot borrow from another sleeve; the derivation on Költés shows it as its own line.
- [ ] No proposal can name a product that is not in the catalog and approved; every printed fee has a date.
- [ ] A proposal never urges, never promises a return, never says sell, and always carries its "miért?".
- [ ] Gates as above.

---

## 6. Rules that hold for every slice

- **Boundaries** (spec §6) are the copy spec. Six rules, and the architectural one: **the model narrates figures
  computed elsewhere.** If a number on screen was generated rather than computed, that is a bug, not a style.
- **The app never moves money and never buys.** No broker connection, ever.
- **Privacy.** The owner's real figures never enter commits, docs, prototypes or Notion — prototypes use
  real-*looking* content, Notion examples are invented and marked „például". Production reads are free; any
  production write needs his explicit OK for that specific change.
- **Perimeter.** This sits outside regulated investment advice only while the app serves one person. Sharing it
  with anyone is a new owner decision, not a deployment detail.
- **Parallel sessions:** one issue, one branch, one worktree, your own simulator; `BoopDesign/Napkelte/**`,
  `merge.yml`, `openapi.yml`, `api.gen.ts`, the message bundles, `1.1.0_master.yml`, `ResetDatabase` and
  `AbstractIntegrationTest` are shared hot spots — one writer at a time.
- **Report to the owner in Hungarian**, business language, walking the *Kész, ha…* list in everyday words.

## 7. Still open, and whose call it is

| | What | Whose |
|---|---|---|
| 1 | Market data provider: start on the old app's free path (Yahoo + RSS + frankfurter.dev); move to EODHD only if breadth demands it. **Confirm Budapest/HUF coverage** before anything depends on it. ~$20/month ceiling cleared with the owner. | builder, within that ceiling |
| 2 | The bank (open-banking) connection instead of SMS. GoCardless looks free for one person and supports Revolut, Hungary covered — **unverified against an official source**. The screens are identical either way, so it does not block anything. | later, owner |
| 3 | MNB's position on the single-user perimeter: not found, unverified. | owner, if he ever shares the app |
| 4 | Verify the old app's export is still near-empty before writing an importer (§4 of the spec) — if it has filled up, the importer needs real merge semantics. | builder, before L4 |
