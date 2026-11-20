# Boop Pénz L7 — build notes (practice, catalog, proposals)

- **Issue:** `mezo-r36n9.105` · **Contract:** plan [`2026-11-19-boop-penz-plan.md`](2026-11-19-boop-penz-plan.md) §0/§5 ·
  spec [`2026-11-13-boop-penz-design.md`](../specs/2026-11-13-boop-penz-design.md) §2/§5.4/§5.5/§5.6/§6/§7/§10.1/§10.2 ·
  research [`04-invest-prior-art.md`](../research/boop-life/04-invest-prior-art.md) §4/§5 · approved spike
  `docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/EletContent.swift` (Pénz → Gyakorlás tab, Ma menu).
- **Written:** 2026-11-20 by the L7 builder. Builder calls inside the owner-approved design; nothing here changes
  what the owner sees in the approved spike. `mezo-r36n9.120` (weekly long-horizon *news* review) is **not** the
  practice weekly review — left open.

## 1. Calls made here

| # | Call | Why |
|---|---|---|
| 1 | **The weekly review is deterministic** — computed figures and fixed Hungarian templates on the server, no model call. | "Exact shape of the weekly review" is the builder's (spec §10). A template cannot invent a number; the spike's sentences are all computable. |
| 2 | **The plan is the row.** A trade is created as a *plan* (instrument · direction · why · stop · quantity · planned entry), then *opened* (entry price + date), then *closed* with the journal line. Close is only possible from `open`, `open` only from a plan — so "no plan, no trade" is structural, not a validation. A plan may be created and opened in one call (`entry` present). | Spec §5.4, Kész-ha 1. |
| 3 | **The 8 tags** (fixed, server-owned): `kitores` Kitörés · `visszateszt` Visszateszt · `nyitasi_tartomany` Nyitási tartomány · `trend` Trend mentén · `fordulo` Fordulóra · `hirre` Hírre ugrottam · `korai_zaras` Korán zártam · `terven_kivul` Eltértem a tervtől. A close needs ≥ 1 tag; a **mistake flag** is separate. **"The week's most common mistake"** = the most frequent tag among the week's mistake-flagged closed trades (ties → the costlier); **its cost** = −Σ P/L (HUF) of those trades when negative, else 0. | Research §5: small vocabulary + mistake flag; the spike's "hírre ugrottam · hiba megjelölve". |
| 4 | **R** = P/L ÷ initial risk, both in the instrument's own currency: risk = \|entry − stop\| × qty; P/L long = (exit − entry) × qty, short = (entry − exit) × qty. Rounded to 2 decimals (HALF_UP) for storage, 1 decimal on screen. Long needs stop < entry, short stop > entry (risk > 0). | Research §5.3. |
| 5 | **HUF twins** use THE L4 booking policy (`PenzFxService`, the trade's own date): `cost_huf` = entry × qty at the entry date's rate; `pnl_huf` = P/L at the exit date's rate; an open position's `unrealized_huf` = (last close − entry) × qty at the last-close date's rate. HUF instruments need no rate. | One FX policy (penz.md §4.1). |
| 6 | **The cap.** `C` = `penz_settings.practice_monthly_minor` — **the same field** as Költés's *Gyakorlás* derivation line, so the two can never disagree. For the Budapest month of the asked date: `used = Σ cost_huf of open trades + max(0, −Σ pnl_huf of trades closed this month)`; `left = max(0, C − used)`. **Opening** a trade whose `cost_huf` exceeds `left` → 422 `PENZ_PRACTICE_CAP_EXCEEDED`. Gains never raise the cap; nothing reads another sleeve, the allowance or a holding. | Spec decision 3, §10.1.2. |
| 7 | **No market data.** Entry, exit, stop and the last close are owner-typed. An open position shows "utolsó záróár, amit beírtál: … (dátum)"; with none typed it is valued at entry (unrealized 0) and says so. Nothing watches a stop. | Spec §10.1.4. |
| 8 | **`paper` on every row**, `NOT NULL DEFAULT true`. Phase 1 the API never accepts `false` (not in the request schema). Statistics filter on `paper = true`. | Spec §10.1.5. |
| 9 | **Sample-size honesty**: `taggedCount` = all-time closed paper trades with ≥ 1 tag; under 50 the overview carries `noiseLine` ("50 jelölt kereskedés alatt ezek a számok még zajnak számítanak — most N van."). | Research §5.5. |
| 10 | **The catalog is per owner, seeded once** (like the default categories) from a researched list in code, every seed row `status = suggested`, `suggested_by = research`, with fee fields, `source_name`, `source_url` and `reviewed_at` = the date the figures were checked against that source. **The model never adds a product.** The owner approves / declines with one tap; he may add one himself (`suggested_by = owner`, approved, `reviewed_at = today`) or update fees (→ `reviewed_at = today`). Only `approved` rows can appear in a proposal (server-side filter **and** validator). | Spec §10.2.1. |
| 11 | **The split** (pure `ProposalSplitter`): emergency target = `emergency_fund_months` × the allowance engine's `fixedCosts` for the current month. Short sleeve (1–3 év) gets `min(A, max(0, target − shortValue))`; the remainder goes **40 % mid (5–10 év) / 60 % long (10+ év)**; amounts rounded down to 1 000 Ft, the rounding rest to long. Every rule is printed in "miért?". | Builder's default; owner adjusts every number before accepting. |
| 12 | **Options per sleeve**: approved products whose `sleeves` contain that sleeve, cheapest running cost first, at most 3. Fewer than 2 → the sleeve still gets its amount and an honest line ("ehhez a rekeszhez még csak N jóváhagyott termék van — a termékjegyzékben tudsz jóváhagyni"). Each option carries computed figures only: TER %, entry fee %, the **yearly running cost in Ft for the proposed amount** (amount × TER, rounded to 10 Ft), currency, distribution, `reviewed_at`. "How they differ" = server-computed comparison lines (cost delta per year, currency, accumulating vs distributing). | Spec decision 12, §10.2.1. |
| 13 | **Narration = one model call per proposal**, JSON out: `summary`, per sleeve `why`, `uncertainty` (where this could be wrong). Validated by `ProposalValidator` (copy of the digest validator's four-class + boundary gate): every number must be in the proposal's FIGURES (`HufAmountGuard.verdict` on every field), product names only from that sleeve's options, no other product named, boundary wording (urge · return promise · sell · buy-imperative, HU + EN), no URLs, no markup except `*emphasis*`. Any failing field → **fixed fallback copy** built from the same figures (`narratedBy: fallback`). | Spec §6 architectural rule; L4 amount guard. |
| 14 | **Monthly strategy figure** = the old app's monthly-investable formula ported (spec §10.1.1: `available = min(avgIncome − avgExpenses − savingsTarget, freeBeforeInvest)`, the old share + pull-forward rules — port from the old app's source with its vitest cases as oracle). `GET /api/penz/strategy` returns it with its inputs; *Havi stratégia* creates a `monthly` proposal for that amount through the same splitter. Re-proposed only when he asks (no job, no push). | Spec decision 5. |
| 15 | **Accept = his numbers.** `accept` takes per-sleeve `{sleeve, amountHufMinor ≥ 0, productId}` — `productId` must be one of that sleeve's offered options (re-checked as still approved) or null when the amount is 0. The accepted plan is a checklist he ticks himself (`steps/{i}` done/undone). Ticking records nothing in Pénzem — he records the real buy with the existing *Befektetést rögzítek* sheet. A newer proposal of the same kind supersedes an un-accepted older one. | Spec §5.5, decision 2. |
| 16 | **The shared proposal surface** is the kit's `NKProposalCard` + `NKWhyBody` (the "miért?" page). Pénz proposals render through them on Pénz Ma; the full proposal (sleeves, options, adjusters, plan) is an `NKAreaSubPage`. No second card component, no wall source, no push (decision 6 / §10.2.4). | Rule "no second card surface" (`mezo-r36n9.58`). |

## 2. Backend layout (`feature/penz`)

- Schema: `db/changelog/1.1.0/script/202611202000_mezo-r36n9.105_penz_practice.sql` (`penz_paper_trade`),
  `…202611202010_mezo-r36n9.105_penz_proposals.sql` (`penz_product`, `penz_proposal`). jsonb columns are read in
  Java, never queried with `?` (Liquibase trap). All tables in `ResetDatabase`, rows via `PenzPopulator`.
- Pure (no Spring): `service/practice/{PracticeTag, PaperTradeMath, PracticeCap, WeeklyReview, PracticeCopy}`,
  `service/proposal/{ProposalSplitter, ProductOptions, ProposalFigures, ProposalValidator, ProposalFallbackCopy,
  ProposalPrompt, MonthlyInvestable}`, unit-tested first.
- Services: `PenzPracticeService`, `PenzCatalogService` (+ `PenzCatalogSeed`), `PenzProposalService`,
  `PenzStrategyService`; port `PenzProposalLlm`, adapter `feature/companion/llm/PenzProposalLlmAdapter` + scripted
  fake under `companion-fake`.
- Controllers: `PenzPracticeController implements PenzPracticeApi`, `PenzProposalController implements
  PenzProposalApi, PenzCatalogApi`. Contract files: `api/feature/penz/penz-practice.yml`,
  `api/feature/penz/penz-proposals.yml`, both in `api/generate/merge.yml`.
- Error codes (both bundles): `PENZ_PAPER_TRADE_NOT_FOUND`, `PENZ_PRACTICE_CAP_EXCEEDED`,
  `PENZ_PAPER_TRADE_STATE` (wrong transition), `PENZ_PAPER_TRADE_INVALID_STOP`, `PENZ_PRACTICE_TAG_UNKNOWN`,
  `PENZ_PRODUCT_NOT_FOUND`, `PENZ_PRODUCT_NOT_APPROVED`, `PENZ_PROPOSAL_NOT_FOUND`, `PENZ_PROPOSAL_STATE`,
  `PENZ_PROPOSAL_AMOUNT_INVALID`.

## 3. The wire (JSON shapes both sides build against)

Money on the wire as elsewhere in Pénz: `PenzMoney {minor, currency, hufMinor}` for own-currency amounts; plain
`…HufMinor: int64` for HUF-only figures. Dates `YYYY-MM-DD`. Every text field below that the server writes is
final Hungarian copy; the phone renders it with the hue-text component (`*emphasis*`).

### 3.1 Practice

```
GET /api/penz/practice?date=            → PenzPracticeOverview
{ paper: true, month: "2026-11",
  cap: { capHufMinor, usedHufMinor, leftHufMinor },
  monthPnlHufMinor,                       // Σ pnl_huf of paper trades closed this month
  avgR: number|null,                      // all-time closed paper trades
  closedCount, taggedCount, noiseLine: string|null,
  tags: [ { key, label } ],               // the fixed 8, in order
  week: PenzPracticeWeek,
  open: [PenzPaperTrade], planned: [PenzPaperTrade] }

PenzPracticeWeek
{ weekStart, weekEnd,
  headline: string|null, sub: string|null,  // the highlight; null when no closed trade this week
  closedCount, winRatePct: int|null, avgR: number|null,
  bySetup: [ { tag, label, count, wins, avgR } ],
  distribution: { bigWins, smallLosses, worseThanLimit, healthy: bool },   // ≥ +2R · −1.2R…0 · < −1.5R
  commonMistake: { tag, label, count, costHufMinor } | null,
  observations: [ { title, body } ],      // 0–3 deterministic lines
  curve: [ { date, cumulativeHufMinor } ],// Mon..today, cumulative closed P/L of the week (0 baseline)
  trades: [PenzPaperTrade] }              // closed this week, newest first

PenzPaperTrade
{ id, paper: true, status: planned|open|closed|cancelled,
  instrument, direction: long|short, why, currency,
  quantity: number, plannedEntry: PenzMoney|null, stop: PenzMoney, target: PenzMoney|null,
  entry: PenzMoney|null, entryDate|null, exit: PenzMoney|null, exitDate|null,
  lastClose: PenzMoney|null, lastCloseDate|null,
  riskMinor|null, riskHufMinor|null, costHufMinor|null,
  pnl: PenzMoney|null, rMultiple: number|null, unrealizedHufMinor|null,
  tags: [key], mistake: bool, line: string|null,
  stopRespected: bool|null,               // closed: exit at/beyond the stop side only when it hit; see PaperTradeMath
  createdAt, clientRef|null }

GET  /api/penz/practice/trades?from=&to=   → [PenzPaperTrade] newest first (the full journal)
POST /api/penz/practice/trades             { clientRef?, instrument, direction, why, currency, quantity,
                                             plannedEntryMinor?, stopMinor, targetMinor?, entryMinor?, entryDate? } → 201
PUT  /api/penz/practice/trades/{id}        same fields, planned only
POST /api/penz/practice/trades/{id}/open   { entryMinor, entryDate }          (cap checked here)
POST /api/penz/practice/trades/{id}/close  { exitMinor, exitDate, tags[≥1], mistake, line(≤140) }
POST /api/penz/practice/trades/{id}/last-close { closeMinor, date }           open only
POST /api/penz/practice/trades/{id}/cancel                                    planned only
DELETE /api/penz/practice/trades/{id}                                         soft
```

### 3.2 Catalog

```
GET  /api/penz/catalog                     → [PenzProduct] (approved, then suggested, then declined)
POST /api/penz/catalog                     { name, kind, currency, sleeves[], whatItIs, terPct?, entryFeePct?,
                                             distribution, isin?, symbol?, sourceName?, sourceUrl? } → 201 approved
PUT  /api/penz/catalog/{id}                fee/text edit → reviewedAt = today
POST /api/penz/catalog/{id}/approve | /decline

PenzProduct
{ id, name, kind: state_bond|money_market|bond_etf|equity_etf|mixed_fund|deposit, currency,
  sleeves: [short|mid|long], whatItIs, terPct: number|null, entryFeePct: number|null, feeNote: string|null,
  distribution: accumulating|distributing|interest, isin|null, symbol|null,
  sourceName|null, sourceUrl|null, reviewedAt, status: suggested|approved|declined,
  suggestedBy: research|owner, approvedAt|null }
```

### 3.3 Proposals and strategy

```
GET  /api/penz/strategy?date=   → { availableHufMinor, inputs: [ { key, label, hufMinor } ], note, current: PenzProposal|null }
POST /api/penz/proposals        { kind: lump_sum, amountHufMinor } | { kind: monthly }   → 201 PenzProposal
GET  /api/penz/proposals?status=   → [PenzProposal] newest first
GET  /api/penz/proposals/{id}
POST /api/penz/proposals/{id}/accept   { sleeves: [ { sleeve, amountHufMinor, productId|null } ] }
POST /api/penz/proposals/{id}/dismiss
POST /api/penz/proposals/{id}/steps/{index}  { done: bool }

PenzProposal
{ id, kind: lump_sum|monthly, status: proposed|accepted|dismissed|superseded,
  amountHufMinor, createdAt, acceptedAt|null,
  title, sub,                              // the proposal card's two lines (computed copy)
  summary, uncertainty, narratedBy: model|fallback,
  facts: [ { value, unit, label } ],       // NKWhyBody facts, formatted by the server
  rules: [string],                         // the split rules in words, for "miért?"
  sleeves: [ { sleeve, label, amountHufMinor, sharePct, why, optionsNote|null,
               options: [ { productId, name, whatItIs, kind, currency, distribution,
                            terPct|null, entryFeePct|null, feeNote|null, yearlyCostHufMinor|null,
                            reviewedAt, differs: [string] } ] } ],
  plan: [ { index, sleeve, productId|null, productName|null, amountHufMinor, done, doneAt|null } ] }
```

## 4. iOS

- `BoopCore/Penz`: `PenzPracticeWire/Client/Logic`, `PenzProposalWire/Client/Logic` on the lenient
  `RawJSONClient`, cached in ServerCache (`penz/practice`, `penz/proposals`), pure builders TDD with `StubTransport`.
- `ios/Boop/Penz`: **Gyakorlás** per the spike (highlight = week headline/sub, or the empty "még nincs lezárt
  kereskedés a héten" line · *Új kereskedés · A teljes napló* · stats: month P/L "papíron" · avg R · cap used /
  cap · the week curve · *A HÉT KERESKEDÉSEI* incl. open ones · *AMIT A HÉTEN LÁTOK* · noise line · info row
  "Mit jelent az R, és miért papíron megy?" · menu Új terv · Címkék · A keret · Élesre fordítás · ask row).
  Sheets / sub-pages: new plan, trade detail (open, close with the 8 chips + mistake toggle + one line, last close,
  cancel), full journal, tags, the cap, élesre (says phase 2 is his to switch, not built).
- **Proposals**: *Befektetnék* (Ma), *Felosztást kérek* (Pénzem), menu *Nagyobb összeg* → amount sheet → the
  proposal sub-page; menu *Havi stratégia* → strategy figure + its inputs + *Kérek javaslatot*. Open proposals sit
  on Pénz Ma as `NKProposalCard` (Elfogadom opens the proposal page to adjust; Most nem = dismiss; miért? →
  `NKWhyBody` sheet). The catalog page (*Termékjegyzék*) lists suggestions with one-tap *Jóváhagyom* / *Nem kell*
  and the approved list, each fee with "ellenőrizve: <date>" and its source.
