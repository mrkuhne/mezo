---
title: Pénz — money foundation, portfolio, news digest and weekly review (Boop Pénz L4–L7)
type: feature-domain
status: done
updated: 2026-11-21
tags: [backend, boop, penz, data-layer, auth]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/penz
  - api/feature/penz/penz.yml
  - api/feature/penz/penz-sms.yml
  - api/feature/penz/penz-portfolio.yml
  - api/feature/penz/penz-weekly.yml
  - backend/src/main/resources/db/changelog/1.1.0/script/202611201600_mezo-r36n9.104_penz_portfolio.sql
  - backend/src/main/resources/db/changelog/1.1.0/script/202611211400_mezo-r36n9.119_penz_invest_account_link.sql
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PenzSmsLlmAdapter.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PenzDigestLlmAdapter.java
  - backend/src/test/java/io/mrkuhne/mezo/feature/penz
related: [boop-ios, _platform-api-backend, _platform-auth-security, companion, dayclose]
---

# Pénz — money foundation, portfolio, news digest and weekly review (Boop Pénz L4–L7) — Feature Documentation

> Backend feature, no screen yet; its future client is **Boop**'s Pénz area (L5). Backend ✅ done (2026-11-19,
> `mezo-r36n9.102`, slice **L4 · adatalap**) · iOS: none until L5 (`mezo-r36n9.103`) · web: none (retired, #52).
> Two API tags: `Penz` (JWT) and `PenzSms` (the bank-SMS ingest, own API-key auth). L5 (`mezo-r36n9.103`, 2026-11-20)
> added the **savings goals / purchase plans** backend (*mire gyűjtök*, §4.2, §4.3). **L6** (`mezo-r36n9.104`,
> 2026-11-20) added the **portfolio by horizon** (*Pénzem*: holdings in three sleeves, FIFO lots, a valuation policy,
> Yahoo quotes) and the **daily news digest** (*Ma*: feeds → deterministic match → validated narration), under two
> more tags: `PenzPortfolio` and `PenzNews` (§3.6–§3.11). Builder calls:
> [`2026-11-20-boop-penz-l6-build.md`](../superpowers/plans/2026-11-20-boop-penz-l6-build.md). **L7** (`mezo-r36n9.105`)
> adds the **curated product catalog**, the **investment proposal flow** and the **monthly strategy** under tags
> `PenzCatalog` and `PenzProposal` (§3.13). **`mezo-r36n9.120`** (2026-11-21) adds the **weekly long-horizon
> review** — "did anything this week change the long-term picture?", one section per horizon, built from the stored
> daily digests — under tag `PenzWeekly` (§3.14); server side only, its place on the phone waits for the owner.

## 1. Summary

The owner's money lives in Boop: accounts, categories, transactions (manual, from a bank SMS, or materialized from
a recurring rule), transfer pairs, recurring income / fixed costs, the month close — and from these the **allowance
engine** computes the month's free money, the week's budget and what is left today, with every line of the
derivation. It is a server-side port of the owner's old *Finance Tracker* app (React + Base44); the old app's
603-case vitest suite is the oracle (§8.1). L4 ships **no screen**: it is the data foundation the Pénz area (L5),
the portfolio and news digest (L6) and the practice / proposal loop (L7) build on.

What L4 adds, in one line each:

- **A money value type** (`Money` + `BookedAmount`) and **one FX policy** — the first in the codebase (§4.1).
- **Nine `penz_*` tables** in one changelog (§4.3).
- **The allowance engine** as pure functions with the owner's two extra lines: *Gyakorlás* (practice money) and the
  previous month's deficit from a real close (§3.1).
- **The bank-SMS ingest** behind its own API-key filter chain, rate limited, parsed by the cheap LLM tier and
  converted to a review transaction server-side (§3.4).
- **The Hungarian amount guard** that stops generated text naming money the engine did not compute (§3.5).

What L6 adds:

- **The portfolio** — holdings (one product in one sleeve: 1–3 év · 5–10 év · 10+ év), buys and sells recorded
  after the fact, owner-entered events; FIFO lot-level cost basis; **the valuation policy** (distinct from the L4
  booking policy, §4.1); sleeves, shares, the long sleeve's years of coverage, staleness (§3.6).
- **Quotes** from the free Yahoo chart endpoint into a global cache, refreshed at most once a day per symbol (§3.7).
- **The SSRF-guarded fetcher** every quote and news request goes through, with a host allow-list (§3.8).
- **The daily news digest**: the twice-daily poll, a deterministic holding / macro match, story grouping, figures
  computed from his own positions, one validated narration call, fallback copy (§3.9–§3.10).
- **The provider-down alert** as a metric + vmalert rule (§3.11), and **seven `penz_*` tables** (§4.3).

What `mezo-r36n9.120` adds: **the weekly long-horizon review** — the previous Monday–Sunday week's stored digest
stories, per sleeve, narrated once a week by the cheap model under the same validator families, with honest fallback
and quiet copy; one `penz_weekly_review` row per week, built by the existing news run (§3.14).

Driving docs: spec [`2026-11-13-boop-penz-design.md`](../superpowers/specs/2026-11-13-boop-penz-design.md) §6, §7,
§9, §10.1; plan [`2026-11-19-boop-penz-plan.md`](../superpowers/plans/2026-11-19-boop-penz-plan.md) §2; the old-app
map [`02-finance-tracker-map.md`](../superpowers/research/boop-life/02-finance-tracker-map.md).

## 2. User-facing behavior

Nothing visible on the phone yet. What the owner can already rely on:

- An **iOS Shortcut** forwards each bank SMS to the server; a money SMS becomes a transaction marked *needs review*
  within seconds, a replay never doubles it, an OTP / marketing SMS is dropped without keeping its text (§3.4).
- `GET /api/penz/allowance` answers "how much is left this week, and today" with the full derivation — the
  numbers L5's **Költés** page will print.
- **Savings goals / purchase plans** (*mire gyűjtök*, L5): the owner keeps a short, ordered list of things he
  saves for — a `goal` (a pot filled over time) or a `purchase` (a planned buy) — each with a HUF target, the
  amount saved so far (his own running figure, not derived from transactions), an optional due date and note.
  A phone retry never doubles a goal (`clientRef`); delete is soft.
- Recurring items appear as transactions on their due date the next time anything reads the money (no cron).
- Past months close **oldest first**, a leftover optionally moved to the savings-target account.

**L6 on the phone** (backend side): **Pénzem** reads `GET /api/penz/portfolio` — the total, the move since the
previous close (price and currency apart), the three sleeves (the long one with "N év M hónapnyi fix kiadásodat
fedezi"), the price date with a stale flag, the forward timeline, the quiet *Gyakorlás* row. **Ma** shows the day's
digest from `GET /api/penz/digest`: one card per story about *his* holdings (plus the forint / rates when they move
something he owns), each with the backend-computed forint effect, Boop's one-line reading, confidence, sources and
the five-part analysis (what it means for you · Boop's reading · how sure · where from · why there is nothing to do).
The digest is built at 06:30 and 13:30 Budapest; *Frissítés* rebuilds it on demand (at most every 15 minutes).

Seeded on first access: a settings row with the defaults, and **15 Hungarian categories** (12 expense, 3 income:
*Élelmiszer*, *Étterem*, … — `PenzCategoryService.DEFAULTS`).

## 3. Architecture & data flow

`PenzController` (tag `Penz`) / `PenzSmsController` (tag `PenzSms`) → services in `feature/penz/service` →
`OwnedRepository`-style repositories → Postgres. Everything that is arithmetic lives in three pure packages with no
Spring: `service/money`, `service/engine`, `service/guard` (+ `service/sms` for the SMS's pure half). Services map
rows into the engine's input records (`PenzEngineInputs`) and back (`PenzMapper`). "Today" is always the owner's
today in `penz_settings.timezone` (default `Europe/Budapest`), from the application `Clock` when defined.

### 3.1 The allowance — the 10 derivation lines

`AllowanceEngine.monthly` (port of the old `src/domain/allowance.ts`), every amount a HUF minor unit (the stored
twins). Line keys are `AllowanceLineKey.wireKey()`, identical in engine and API, in this order:

| # | key | what it is |
|---|---|---|
| 1 | `recurringIncome` | rule-linked income txns in the month at their own amount + the current amount of every not-yet-materialized occurrence of an **active** income rule |
| 2 | `oneOffIncome` | income txns not linked to a rule |
| 3 | `fixedCosts` | the same as (1) for expense rules |
| 4 | `savingsTarget` | `penz_settings.savings_target_minor`, or that month's own value from `month_overrides` |
| 5 | `practice` | **Gyakorlás** — `practice_monthly_minor` (default 2 000 000 = 20 000 Ft), deducted like a fixed cost (spec §10.1.2) |
| 6 | `invested` | the month's `invest_buy` total (an `invest_sell` is never income) — manual rows and, since `mezo-r36n9.119`, the money row of every investment buy recorded with an account (§3.6) |
| 7 | `previousDeficit` | the `deficit_minor` the **previous month's close** stored — 0 while that month is open |
| 8 | `free` | `recurringIncome + oneOffIncome − fixedCosts − savingsTarget − practice − invested − previousDeficit` |
| 9 | `spent` | day-to-day spend: `expense` txns **not** linked to a rule |
| 10 | `remaining` | `free − spent` |

Recurring totals never rewrite the past: an occurrence on or before a rule's `last_materialized_date` with no txn
was deliberately skipped (schedule edit, pause, deleted entry) and is not projected. With `practice = 0` the
engine reproduces the old oracle exactly (`PenzAllowanceEngineTest`).

### 3.2 The week and the per-day figure

`AllowanceEngine.weekly(today, …)` takes the **Monday-start** week containing the date. Days before the date's month
belong to a month that closes to savings and are excluded (`countedFrom = max(weekStart, first of month)`). A week
reaching into the next month takes a **portion of each month**:

`portion = max(0, floor(remainingAtFrom × daysInWeek / daysToMonthEnd))`, where `remainingAtFrom` = the month's
`free` minus the spend dated before the portion's first day. The previous deficit applies to the date's month only.
`budget` = Σ portions, `spent` = spend from `countedFrom` to week end, `remaining = budget − spent`.

**perDay** (`PenzAllowanceService.perDay`, old `homeModel.ts perDayLeftMinor`):
`max(0, week remaining) / days left in the week counting the asked date itself` (Wednesday → 5), floored to a whole
minor unit (the old app kept the fraction; 1/100 Ft is invisible).

### 3.3 Recurring materialization and the month close

- **Materialization on read** (`PenzRecurringMaterializer`, old `src/app/materialize.ts`): the allowance and the
  transaction-list reads first write every due occurrence (`Recurrence.dueOccurrences`, after
  `last_materialized_date`, up to the owner's real today) as a `source = recurring` transaction booked at the
  **occurrence's** date. Native `INSERT … ON CONFLICT DO NOTHING` on `(recurring_rule_id, date)` makes concurrent
  reads idempotent. An unbookable rate stops that rule at that occurrence (rows written stay, the date does not
  move, the next read resumes; `PenzFxService.tryBook` never marks the read's transaction rollback-only) — the
  engine projects the missing occurrences meanwhile.
- **Month close** (`PenzMonthCloseService`, old `monthClose.ts` + `closeRecord`): open months = every month from the
  earliest transaction to before the current one with no close (`GET …/month-closes/open` carries the figures a
  close would store now). Closing stores `final_remaining_minor` (the engine's `remaining`, previous deficit only
  from a closed month) and splits it: deficit or zero → `none`; a leftover → `kept` or `transferred` (a HUF transfer
  pair dated the month's last day, default account → savings-target account; 409 `PENZ_NO_SAVINGS_TARGET_ACCOUNT`
  when either is missing, 409 `PENZ_CURRENCY_MISMATCH` when either is not a HUF account). **Months close oldest first** — 409 `PENZ_EARLIER_MONTH_OPEN` otherwise — because the
  next month's `previousDeficit` reads the stored close and closing out of order would freeze it without the earlier
  deficit. Other guards: 400 `PENZ_MONTH_NOT_OVER`, 409 `PENZ_MONTH_ALREADY_CLOSED`.
- **Accounts** (`AccountRules.planSave`, old `planAccountSave`): exactly one non-archived default, exactly one savings
  target among non-archived `savings` accounts, promoted automatically on archive; flags written clear-first so the
  partial unique indexes never see two holders; archiving the last active account is 409 `PENZ_LAST_ACTIVE_ACCOUNT`.
  **The currency is locked** once the account carries a live transaction or recurring rule: changing it is 409
  `PENZ_ACCOUNT_CURRENCY_LOCKED` (every row is in its account's currency, so a change would recreate the mismatch
  and make the balances skip those rows); other fields stay editable, and deleting the rows unlocks it
  (`mezo-r36n9.108`).
- **Transactions** (`PenzTransactionService`): `clientRef` writes are idempotent (native insert + read-back); a
  transfer is a `transfer_out` + `transfer_in` pair sharing `transfer_pair_id` (editing a leg moves both, deleting a
  leg deletes both — a month close's leg included, the close keeps its figures); an update re-books the HUF twin
  **only** when amount, currency or date changed (old `needsHufRecompute`). **A row's currency is its account's
  currency** (transactions, transfer legs, recurring rules: 400 `PENZ_CURRENCY_MISMATCH`) — the balance sums rows in
  the account's currency and would skip a stranger; a transfer needs both accounts in its currency (cross-currency
  transfers are a later slice). A leg moved onto the other leg's account is 400 `PENZ_TRANSFER_SAME_ACCOUNT`; a
  transfer replaying a plain transaction's `clientRef` is 409 `PENZ_CLIENT_REF_CONFLICT`. Amounts are capped at
  1 billion major units (`maximum: 100000000000` minor in the contract; a HUF twin beyond a `long` is a 400).

### 3.4 The bank-SMS ingest

**Auth (spec §10.1.7 — not a 30-day JWT).** `PenzSmsSecurityConfig` adds a **second Spring Security filter chain,
ordered first, matching only `/api/penz/sms/ingest`**; the main JWT chain (`techcore.security.SecurityConfig`)
matches everything else. `PenzSmsApiKeyFilter` (deliberately not a bean, so it exists in no other chain) reads the
key from `X-Api-Key`, or from `Authorization: Bearer` **only when the token starts with `mzp_`**, looks up its
SHA-256 hex, rejects a revoked key and stamps `last_used_at`. Missing / unknown / revoked → **401
`PENZ_SMS_KEY_INVALID` before the body is read**. The key's owner becomes the principal as a `JwtAuthenticationToken`
over an unsigned in-memory `Jwt` (subject = owner id, authority `PENZ_SMS_INGEST`), so `CurrentUser` (status check),
`created_by`, the LLM actor and the message language resolve exactly as for a JWT user. A JWT on the ingest → 401; a
key anywhere else → 401. Neither the key nor the SMS text is ever logged.

**Rate limit** (`PenzSmsRateLimiter`): per key, in memory — **20 per rolling minute, 500 per UTC day**
(`mezo.penz.sms-per-minute` / `sms-per-day`) → 429 `PENZ_SMS_RATE_LIMITED` + `Retry-After`. In memory means a pod
restart resets the counters; fine for one replica and a bank-SMS rate. A rejected call does not count.

**Keys** (`PenzSmsKeyService`, JWT): `POST /api/penz/sms/keys {"name":"iPhone"}` returns the plaintext
`mzp_<base64url of 32 random bytes>` **once** (only the hash + last four characters are stored); creating a key
revokes the owner's other live keys (old-app rule: one working key, revoked only after the new one exists);
`GET` lists keys without key or hash; `DELETE /api/penz/sms/keys/{id}` revokes (soft, stays listed).

**Pipeline** (`PenzSmsIngestService`, old `ingest-sms/entry.ts` + `runConvertSms.ts`; writes in `PenzSmsStore`, each a
short transaction — the LLM and FX calls happen before, outside any transaction):

1. **Validate** — `text` required, ≤ 1000 after trim (blank → 400); `sender` optional ≤ 100, default `unknown`;
   `received_at` optional and lenient, unparseable = now.
2. **Dedupe** — `text_hash = sha256(trim(sender) + '|' + trim(text))`, native `ON CONFLICT (created_by, text_hash)
   DO NOTHING`: a replay answers `duplicate` with the original `transactionId`, never a second row.
3. **Pre-filter** — `looksLikeMoney` miss → stored `ignored / no_amount`, **text dropped**, no model call.
4. **LLM parse** — penz-owned port `PenzSmsLlm`, adapter `companion/llm/PenzSmsLlmAdapter` (cheap tier, call tagged
   `penz_sms/parse`, prompt marker `BOOP_PENZ_SMS_V1` in `SmsPrompt`; scripted fake under `companion-fake`; companion
   off ⇒ no bean ⇒ `failed / llm_error`), then the ported `normalizeParsed` guards (`SmsIngestLogic`). The LLM audit
   row keeps **no payload** (`LlmCallContext.FEATURE_PENZ_SMS` is payload-free: cost, tokens and size only, stamped
   scrubbed at write) — an SMS the model ignores (a one-time code next to an amount) leaves its text nowhere.
5. **Amount cross-check** (`SmsAmountCheck`) — the parsed amount must literally be in the SMS: HUF through
   `HufAmountGuard.containsAmount`, EUR / USD / GBP / CHF by the same literal rule next to the code or symbol; else
   `failed / amount_mismatch`.
6. **Convert at once** (`SmsConversion`) — account by `sms_sender` match (trimmed, case-insensitive), else the
   default, else the first non-archived (none → `parsed / no_account`); the transaction is in the **account's**
   currency (the original amount follows the merchant in the note when converted), its HUF twin booked by the FX
   policy (no rate → `parsed / fx_unavailable`, no transaction; an amount that converts to zero →
   `parsed / amount_too_small`, no transaction); category by name + kind, case-insensitive; note =
   merchant; `source = sms`, `needs_review = true`, `sms_message_id` unique. The SMS row flips to `converted`.
7. **Invest-buy adoption** (`mezo-r36n9.119`, old `linkSmsToInvestBuy` / `matchInvestTxnForSms`; in the same
   `PenzSmsStore.storeConverted` transaction, before step 6's row is written) — a planned **expense** first looks for
   a recorded `invest_buy` on the same account with the same `amount_minor` (account currency), no `sms_message_id`
   yet and a date within **±3 days** of the SMS date, closest date first then the earlier one
   (`service/sms/InvestSmsMatch`). Found → that row takes the SMS (`sms_message_id`, `source = sms`;
   `needs_review` stays false, kind and date stay), the SMS flips to `converted` pointing at it, **no second row**;
   the response is `parsed` with that `transactionId` and reason **`invest_buy_linked`**. Not found → step 6's
   normal expense.

`ignored` SMS drop their text; `failed` ones keep it for review. Response:
`{status: parsed|ignored|failed|duplicate, transactionId?, reason?}` with reasons `no_amount`, `not_a_transaction`,
`llm_error`, `amount_mismatch`, `bad_*`, `no_account`, `fx_unavailable`, `amount_too_small`, and with `parsed`
`invest_buy_linked` (step 7).

**The iOS Shortcut recipe** (the old app's contract, kept): a personal automation on *Message received* (from the
bank's sender) → **Get Contents of URL**: method `POST`, URL `https://<server>/api/penz/sms/ingest`, headers
`X-Api-Key: mzp_…` (or `Authorization: Bearer mzp_…`) and `Content-Type: application/json`, request body JSON
`{"text": <Message body>, "sender": <Message sender, e.g. MBH Bank>, "received_at": <Current Date, ISO 8601>}`.
Create the key once with `POST /api/penz/sms/keys` and paste it into the Shortcut; set the account's `smsSender` to
the bank's sender name so the SMS lands on the right account.

### 3.5 The amount guard

`service/guard/HufAmountGuard` (port of the old `morningBrief/brief.ts` `hufAmountsMinor` / `withinLimits` and
`analysis.ts` `normalizeAnalysis`, extended) — pure and static:

- `hufAmountsMinor(text)` reads every forint figure: a number with `Ft` / `HUF` / `forint…` (any Hungarian case
  ending) or a `HUF` prefix; thousands grouped by space, NBSP, narrow NBSP, thin space, dot or comma; 1–2 decimals;
  unit words `ezer`/`e`, `millió`/`M`/`mn`, `milliárd`/`mrd`. The full words *millió* / *milliárd* count even without a
  currency marker (an extension: reading one figure too many only downgrades); a bare *ezer* does not ("10 ezer
  lépés"). Dates, times, store numbers and percentages are never read. Signs are dropped (magnitudes).
- `verdict(text, allowedMinor, maxMinor)` → `OK` or `DOWNGRADE` with the offending figures. **A figure must be one of
  the computed inputs** and not above the max. **Derived sums are not tolerated** — a sum or difference of two
  allowed figures is a figure the engine did not compute; a caller that wants a total quoted puts it in the allowed
  set. **Rounding tolerance**: an input also matches its value rounded to whole forints (the app prints whole
  forints). A negative max (no known limit) downgrades every figure.
- `containsAmount(text, minor)` — the SMS cross-check (§3.4 step 5).

In L4 its only production consumer is the SMS cross-check; L6's digest and every later Boop money sentence go
through `verdict`. Fixtures: `backend/src/test/resources/penz/guard-brief-{consistent,overspend}.txt`.

### 3.6 The portfolio — holdings, FIFO lots, the valuation policy (L6)

`PenzPortfolioController` (tag `PenzPortfolio`) → `PenzHoldingService` / `PenzInvestTxnService` /
`PenzHoldingEventService` / `PenzPortfolioService` → the pure package `service/portfolio` (`Lots`, `Valuation`,
`PortfolioEngine`, no Spring).

- **A holding** is one product in one **sleeve** (`short` 1–3 év · `mid` 5–10 év · `long` 10+ év); the same product
  in two sleeves is two holdings (spec §10.1.3). Asset type `bond|etf|stock|fund|crypto|cash`, platform
  `mbh|revolut|other`, currency, optional Yahoo `symbol`, optional `bondRatePct`, the owner's own `newsTerms`.
  A symbol is checked against the quote source once on create / change: unknown → 400 `PENZ_SYMBOL_UNKNOWN`, an
  unreachable source accepts the holding unpriced. The currency cannot change once a transaction exists.
- **Buys and sells** (`penz_invest_txn`) are what he already did on his own platform; amount in the holding's
  currency + the HUF twin **booked by the L4 FX policy** at the trade date. Idempotent on `clientRef`.
- **The money-account link** (`mezo-r36n9.119`, `PenzInvestLinkService`). The app never moves money; with an
  optional `accountId` a buy (paid from) / sell (paid into) is also **recorded** on that account as ONE
  `penz_transaction` — kind `invest_buy` / `invest_sell`, so the balance and the allowance `invested` line (§3.1) see
  it — written in the same transaction, its id in `penz_invest_txn.transaction_id`, only by the request that
  actually inserted the investment row (a `clientRef` replay, or a concurrent duplicate, never writes a second money
  row). Only the owner's live, **non-archived `checking` or `cash`** account can pay (old `payableAccounts`): another
  type → 400 field error on `accountId`; not his / deleted / archived → 404 `PENZ_ACCOUNT_NOT_FOUND`. The money row
  is in the **account's** currency: `accountAmountMinor` when he gave it (the exact bank debit); else the investment
  amount itself when the currencies agree; else its **HUF twin** on a HUF account; else the HUF twin ÷ the account
  currency's **booking rate** of the date (`PenzFxService`, HALF_UP — never a second rate path). Its own HUF twin is
  booked by the FX policy like every row's; category null, note = the holding's name, source `manual`, reviewed.
  The response carries `accountId` + `transactionId`.
- **Adopting a bank-SMS debit** (a buy only). `GET /api/penz/invest-transactions/sms-candidates?accountId=&amountMinor=&date=`
  (old `findSmsCandidates`, `InvestSmsMatch`): on an account with an `smsSender`, live **expenses** that came from a
  bank SMS (`source = sms` or an `sms_message_id`), no recurring rule, not already linked to an investment, exactly
  `amountMinor` in the account currency, dated within ±3 days — closest first; empty without an SMS sender. A buy
  with `linkTransactionId` re-checks the same rule (fail → 409 `PENZ_SMS_LINK_MISMATCH`; a sell, or no `accountId` →
  400 field error) and the debit **becomes** the money row: kind → `invest_buy`, category null, reviewed, note = the
  holding's name; the investment takes that row's **date** (one buy never carries two dates) and nothing new is
  written. The investment's own amount and twin stay as he typed them (holding currency).
- **Delete releases the link.** Deleting an investment transaction (after the FIFO guard) releases its money row in
  the same transaction: one carrying an `sms_message_id` (the debit really happened) **reverts** to `expense` (buy) /
  `income` (sell) with `needs_review = true` — offered again by the candidates list when the buy is recorded again;
  any other is soft-deleted. Deleting a holding releases every one of its transactions' rows the same way.
- **The guard from the other side.** `PUT` / `DELETE /api/penz/transactions/{id}` of a row linked to a live
  investment → 409 `PENZ_TRANSACTION_INVEST_LINKED` (change it through the investment), so the two never drift;
  marking it reviewed stays allowed.
- **FIFO lots** (`Lots`, build notes call 4): transactions by date, buys before sells on the same day; each buy is a
  lot; a sell consumes the oldest lots first — by quantity when every transaction carries one (a partly consumed lot
  gives up `cost × taken / lotQuantity`, HALF_UP; a fully consumed one all its remaining cost, so nothing drifts),
  otherwise by HUF cost. A sell above the open position — or a delete that would leave a later sell above it — is
  400 `PENZ_SELL_EXCEEDS_POSITION`. Realized P/L per sell.
- **The valuation policy** (`Valuation`, build notes calls 2–3), every result HUF minor, HALF_UP once per figure:
  - *quote* (symbol + cached quote + quantities + a cached rate unless HUF): value = qty × price × fx; the move since
    the **previous close** splits into **price** = qty × (price − prev) × fxPrev and **currency** = qty × price ×
    (fx − fxPrev); no previous close → no move. "Since the last look" is read as *since the previous close* so the
    number does not depend on how often he opens the app;
  - *accrual* (unquoted bond with a rate): per open lot `cost × (1 + rate × days / 365)` (old app);
  - *cost* otherwise: the FIFO cost of the open lots, **not priced** (counted in `unpricedCount`) — except forint
    cash, whose cost is its exact value.
  A quote in another currency than the holding's is ignored.
- **Pénzem** (`PortfolioEngine`): always the three sleeves in order; values, costs, moves, shares (percent, 1 decimal);
  the long sleeve's **coverage** = `floor(longValue / fixedCostsMonthly)` months, fixed costs = the allowance
  engine's `fixedCosts` line of the month (null when missing or ≤ 0) — iOS prints years + months "növekedést nem
  feltételezve"; the prices' date; **stale** when the newest price is older than **3 days** or the quote source is
  failing while he holds a quoted holding.
- **Events** (`penz_holding_event`): owner-entered maturity / coupon / dividend / earnings / other dates (no free
  source for Hungarian bond calendars); Pénzem shows the next 12 months.
- **The practice row** carries the settings' monthly *Gyakorlás* cap and `monthPnlHufMinor: null` until L7's trades.

### 3.7 Quotes (L6)

`QuoteClient` reads the free Yahoo chart endpoint `{base}/v8/finance/chart/{symbol}?range=5d&interval=1d` for
securities and FX pairs (`EURHUF=X`) through the fetcher (allow-list `mezo.penz.yahoo-allowed-host`). Price =
`meta.regularMarketPrice`; the quote's date = the Budapest date of `regularMarketTime`; previous close = the last
close dated before it. `PenzQuoteService` keeps one global `penz_quote` row per symbol and refetches a symbol only
when its quote is dated before today **and** the last attempt is older than `mezo.penz.quote-refetch-minutes` (60) —
a weekend or a dead source is not hammered; a failure keeps the cached quote. Pénzem's read refreshes the owner's due
symbols first; the news poll calls `refreshAllHeld` (every held symbol + every held non-HUF pair). Every fetch records
the provider's health (key `yahoo`, kind `quotes`): any answer — even "unknown symbol" — is a success.

### 3.8 The SSRF-guarded fetcher (L6)

`service/net/PenzHttpFetcher` — every quote and news request goes through it; it never throws (a `FetchResult` with
the status or a short reason, never a body):

- http/https only; no userinfo; no explicit port; no IP-literal host; never `localhost`;
- a **host allow-list per call** (the host equals an allowed one or is its subdomain — `evilcnbc.com` and
  `cnbc.com.evil.io` fail for `cnbc.com`);
- **every** resolved address must be public (loopback, private, link-local, any-local, multicast, CGNAT, ULA,
  reserved, the IPv4 documentation nets, Teredo `2001::/32` and `2001:db8::/32` refused; an IPv4 embedded in IPv6 —
  `::a.b.c.d`, NAT64 `64:ff9b::/96`, 6to4 `2002::/16` — is judged by that IPv4) — `pantry/WebPageClient` checks only
  the first;
- **redirects are never followed** (a 30x is a failure); the body is streamed and dropped the moment it crosses the
  cap; explicit timeouts (`mezo.penz.fetch-timeout-ms`) **and an overall per-fetch deadline**
  (`mezo.penz.fetch-deadline-ms`, 20 s): a watchdog closes the stream at the deadline, so a slow drip cannot hold the
  single news thread; a body cut off there is a failure (`deadline`), never a partial body.

**Not pinned:** like `WebPageClient`, the connection is not pinned to the checked address (the request factory
resolves again on connect). The DNS-rebinding window this leaves is bounded by the allow-list, which admits only a
few public provider domains — pinning would mean a custom socket factory per call for little gain. The test-only
`mezo.penz.allow-loopback-for-tests` admits a loopback WireMock and nothing else (false outside ITs).

### 3.9 The daily news digest (L6)

Pure core in `service/news` (no Spring), wiring in `PenzNewsClient`, `PenzDigestService`, `PenzDigestStore`,
`PenzNewsRunner`, `PenzNewsJob`, `PenzNewsController` (tag `PenzNews`):

1. **Poll** (`PenzNewsClient.poll`): the old app's eight seed feeds (`NewsSources.SEED`: CNBC Top, CNBC Economy,
   MarketWatch, BBC Business, FT Markets, ECB, BBJ, Hungary Today, each with its own article hosts) + one Google News
   RSS search (Hungarian edition) per distinct holding term of every user's live holdings (de-duplicated, ≤ 40), each
   through the fetcher with the feed's own host and a 2 MB cap; `RssParser` (RSS + Atom, regex — no XML parser, so
   no entity-expansion surface — CDATA, entities, http(s) links only); upsert by url (native `ON CONFLICT (url) DO
   NOTHING`); prune articles older than 30 days. **Input hardening** (security review #5 / #6): the parser reads at
   most the first 512 KB of a feed and is linear by construction (`indexOf` scans for blocks, tags, links and CDATA,
   `<[^<>]*>` for tag stripping) — a run of 100 000 `<` or an unterminated tag costs milliseconds, not seconds;
   titles, summaries and article text lose control characters (NUL included), format / bidi characters and lone
   surrogates (`NewsText.clean`), and a link carrying one is refused; one item the database refuses is logged by
   feed key and skipped, and a feed's health is its fetch + parse, not the store.
2. **Match** (`NewsMatcher`, deterministic — no model decides relevance): articles of the last **36 h** whose title or
   summary names a holding term (the symbol root `OTP.BD` → `OTP`, exact; distinctive name words ≥ 3 characters
   minus generic / issuer / index words like *ETF, Nyrt, UCITS, Vanguard, MSCI, world, világ*, with Hungarian case
   endings; the owner's `newsTerms`), whole-word, case- and diacritic-insensitive. Macro **fx** only when he holds a
   non-HUF holding (a pair term, or *forint/HUF* together with a currency-move word — Hungarian news names forint
   amounts all the time); **rates** only when he holds a bond (*MNB, alapkamat, kamatdöntés, interest rate…*).
3. **Group** (`StoryClusterer`): per key, greedy title-token Jaccard ≥ 0.3; ≤ 3 stories per key, ≤ 6 in total (most
   sources first, then newest), ≤ 6 sources per story; a stable id per story (`<kind>-<10 hex>` of the key and the
   oldest url).
4. **Figures** (`PenzDigestService.figures`, from `PenzPortfolioService.positions` — cached quotes only, the run
   refreshes first): holding → its `priceMoveHufMinor`, `changePct`, value; **fx** → Σ `fxMoveHufMinor` over his
   non-HUF holdings, the % from the pair of the currency he holds the most of (by HUF value); **rates** → 0 with the
   fixed note *változatlan hozam*. A forint story whose pair % points the other way than the summed effect shows no %
(`DigestFigures.fx`). `effectNote` is fixed copy (`DigestFallbackCopy`). Spelling (`DigestFigures`):
   whole forints, plain-space grouping, real minus sign — `−18 400 Ft`; percent `1,1%`.
5. **Bodies**: ≤ 2 article pages per story, only from that feed's article hosts (`NewsSources.isAllowedArticleUrl`),
   HTML → text (`ArticleText`: the first 256 KB, cleaned, parsed by jsoup — linear — instead of regexes; ≤ 4 000
   chars, < 600 = a paywall stub, no body). Google News links are redirects —
   never fetched; those stories are narrated from headlines, and a story with no body is capped at confidence 1.
6. **Narrate**: ONE call per digest, outside any transaction — penz-owned port `PenzDigestLlm`, adapter
   `companion/llm/PenzDigestLlmAdapter` (cheap tier, tag `penz_digest/narrate`, **payload-free** in the LLM audit
   log like the SMS parse — the prompt carries his holdings' names and forint effects; a budget refusal, a throttle
   or a provider error is an empty answer, never an exception). Prompt marker `BOOP_PENZ_DIGEST_V1` (`DigestPrompt`);
   scripted fake under `companion-fake` (a clean answer per story, or `[fake-penz-digest:<base64>]`).
7. **Validate** (`DigestAssembler` + `DigestValidator`, §3.10): `keep: false` drops a story (M1's relevance rule:
   lasting structure / regulation / technology / long-run financials; reactionary noise is dropped); an unknown id is
   ignored; a story the model left out, an entry with any violation, or no answer at all → **fallback copy**
   (`narratedBy: fallback`, confidence 0, an honest "could not summarise reliably", the source count in words, and a
   per-kind / per-sleeve *nincs teendőd*).
   A **holding story whose effect is not 0 Ft is never dropped**: the model's `keep: false` turns it into the fallback
   item instead (an injection must not hide news about his money); zero-effect and macro stories still drop. Source
   links are stored only when the url is https on that feed's article hosts (Google News: `news.google.com`) — the
   rest of the source is omitted; source names and titles are cleaned of control / format characters.
8. **Store** (`PenzDigestStore.replace`, one short transaction: hard-delete the day's row, save the new one):
   `ready` (items), `quiet` (no story touched his holdings, or every story `keep: false`), `failed` (the build itself
   broke). The GET answers `pending` when no row exists for the day, and `newsHealthy = !allFailing(news)`.
   Rejections are logged as story id + rule names only — never prose, titles or bodies.

**Schedule and switches.** `PenzNewsJob` fires at **06:30 and 13:30 Europe/Budapest** (`mezo.penz.news.cron` /
`.zone`) and exists only with both `mezo.penz.news.enabled` (`FeaturesConfiguration.PENZ_NEWS_SWITCH`) and
`mezo.techcore.cron.penz-news-job.enabled` — both on in `application.yml`, off in the test profile. The job only
hands off to `PenzNewsRunner.runAsync` (`@Async("penzNewsExecutor")`): a dedicated **single-thread** executor
(`PenzNewsAsyncConfig`, queue 4, a full queue drops the run with a warning; not a default `@Async` candidate), so a
poll and a refresh never overlap and the size-1 scheduler pool is never held by network calls. A run = refresh the
held quotes → poll the feeds → `UserFanOut.forEachActiveUser` → build each user's digest for **his own today** (money
timezone); each step has its own try/catch. **Refresh** (`POST /api/penz/digest/refresh`): 202, the same three steps
for the caller on the same executor; a second call within 15 minutes (`refresh-cooldown-minutes`, in memory per
user) is 429 `PENZ_DIGEST_REFRESH_LIMITED`. The cooldown starts only when the executor took the run; a full queue
answers the same 429 and leaves the next attempt free (the job logs a dropped poll).

### 3.10 Untrusted text and the validator (L6)

Build notes §4. **In the prompt:** every article title / summary / body appears only inside
`<<<ARTICLE id=N source="…">>> … <<<END ARTICLE N>>>`, after `DigestPrompt.sanitizeUntrusted` removed invisible format
characters, replaced every run of `<<` / `>>` by one guillemet (no article can close its fence or open a fake one)
and collapsed whitespace to one line (no article can start a fake `STORY` / `FIGURES` line); the source name and the
ledger name get the same treatment. The untrusted-data rule is stated in the system prompt and again before and after
the articles; the only numbers the model may write are the story's `FIGURES` lines, verbatim; the holding is named
from the ledger (`Tétel:`), and an `Irány:` line states the direction of the effect.

**Before the prompt**, `sanitizeUntrusted` also NFKC-normalizes (fullwidth `＜` / small-form `﹤` become `<`) and
collapses runs of two or more angle marks of any kind — ASCII, `‹ ›`, fullwidth, small form, spaced (`< < <`) — and
strips lone surrogates. The FIGURES carry **no signs** (`Hatás: 18 400 Ft`, `Elmozdulás: 1,1%`) and an `Irány:` line
for every story (*változatlan* when the effect rounds to 0 Ft); the prompt says to write no number but the FIGURES
strings, never spell one out and never put a sign before a figure.

**After the model — the real defence** (`DigestValidator`, every field, any violation → fallback), by the spec §6
taxonomy (hardened after the L6 security review — its probe phrases are regression tests in
`PenzDigestHardeningTest`):

| Class | Rule |
|---|---|
| **Numerical Error** | every number in the prose (Hungarian formats normalized: `18 400`, `18.400`, `1,1`) is one of the story's figures (effect, %, value); a `%` / *százalék* only on the story's own percentage; no scale word (*ezer, millió, milliárd, mrd, mn, bn, k, m, e*) or other currency (*euró, dollár, frank, font, $, €, £*) next to a figure, even an allowed one; the horizon digits only inside the story's own horizon phrase (*10+ éves*, *5–10 év*, *1–3 év*); `HufAmountGuard.verdict` on every field (no derived sums); no spelled-out number beyond *egy..hat* (*tíz, húsz, száz, ezer, tizennyolcezer, kétmillió…*) and no `Ft` / `HUF` that does not follow a digit figure; digits inside his own ledger name are skipped |
| **Entity Swap** | no other holding's name or match terms; a macro story may name the holdings it moves (fx: non-HUF, rates: bonds) |
| **Negation Flip** | no signed figure at all (`+`, `−`, `-`, `–` before a digit — the card prints the signed effect); holding story with a non-zero effect (in whole forints): no rise / gain word (*emelkedett, nőtt, erősödött, drágult, szárnyalt, nyertél, nyereség, gyarapodott, gazdagabb, profit*, EN) with a negative effect, no fall / loss word (*esett, csökkent, gyengült, zuhant, visszaesett, veszített, veszteség, mínusz, kár*, EN) with a positive one — in **every** field; forint story: the same for the words about his money only (the currency's own *erősödött / gyengült* is inverted for foreign holdings) |
| **Temporal Confusion** | no year and no weekday name (other dates are numbers → caught above) |
| **Boundary** (§6) | no buy / sell / urge / promise wording, matched as word-start stems on the folded text **and** on a copy with letter-spaced words joined (`a d d  e l` → *add el*): *vedd meg, vegyél, vásárol-, add el, elad-, megválni, realizál-, pozíciód, növeld, csökkentsd, bővítsd, haladéktalan, mielőtt késő, most kell, azonnal, sürgős, garantál-, biztos nyereség*, EN *buy, sell, trim, exit, take profit, offload, dump, reduce / increase your, add to your, urgent, guarantee, act now*; no URL (incl. `domain.tld/` forms like `bit.ly/x`), no markup but `*emphasis*`, no prompt-leak marker (*BOOP_PENZ, ARTICLE, utasítás, instruction, ignore, system, prompt, FIGURES*). *eladás* in a news title is blocked too — accepted |
| **Shape** | every text field non-blank; title ≤ 120, verdict ≤ 220, body ≤ 1 800, uncertainty ≤ 500, noAction ≤ 300; confidence 0..2 |

The injection test (`PenzDigestInjectionTest`, `PenzDigestPipelineIT`): an article body carrying a fence breaker, an
instruction to sell, a fake figure and a URL leaves the stored digest identical when the model ignores it, and a
model that obeys it is replaced by fallback copy that leaks none of it.

### 3.11 The provider-down alert (L6)

There is no admin alert screen any more — `feature/admin` (and its `AdminAlertService`) left the server on
2026-11-19 (decision #52, `mezo-r36n9.97.4`). Instead: `PenzProviderHealth` keeps one `penz_provider_status` row per
outbound provider — each seed feed (`rss:<key>`), **one** row for all Google News searches (`rss:google-news`, a
success when any search answered; per-term rows would leave stale rows behind when a term goes away) and the quote
source (`yahoo`) — with `fail_streak`, last success / failure and a short error (never a body). Each row backs the
Micrometer gauge `mezo.penz.provider.fail.streak{provider,kind}` (loaded from the table at startup, so it survives a
restart), exported as `mezo_penz_provider_fail_streak` on `/actuator/prometheus`; `k8s/monitoring/vmrule-mezo.yaml`
alerts **`PenzNewsProviderDown`** on `min(…{kind="news"}) >= 3` (every news source failed three runs in a row) and
**`PenzQuotesProviderDown`** for the quote source. The digest's `newsHealthy` is false while every news provider's
last fetch failed.

### 3.12 Practice — paper trading (L7)

Gyakorlás is day trading as learning, **on paper** (`penz_paper_trade.paper` is `NOT NULL DEFAULT true`; the API never
accepts anything else). Builder calls: [`2026-11-20-boop-penz-l7-build.md`](../superpowers/plans/2026-11-20-boop-penz-l7-build.md)
§1 calls 1–9. `PenzPracticeService` maps rows; the arithmetic is pure in `service/practice/`:

- **The plan is the row** — `planned` → `open` (typed entry + date) → `closed` (exit, ≥ 1 of the eight fixed
  `PracticeTag`s, mistake flag, one line ≤ 140); a plan may be `cancelled`. Any other step is 409
  `PENZ_PAPER_TRADE_STATE`, so "no plan, no trade" is structural. Create may open in the same call (`entryMinor`).
  The stop must be on the losing side of the (planned) entry: 400 `PENZ_PAPER_TRADE_INVALID_STOP`.
- **The entry date** lies in the owner's current month, up to today: later, or before the month's first day, is 400
  `VALIDATION_INVALID_VALUE` on `entryDate` — nothing is booked into a closed month (L7 review I1).
- **Delete** — planned, open and cancelled rows may be (soft-)deleted (an open one frees its committed cost: it
  never happened); a **closed** row is history and is refused with 409 `PENZ_PAPER_TRADE_STATE`, so its P/L — and a
  loss counted in the cap — can never vanish (L7 review I3).
- **Overflow is a 400, never a 500**: an |R| beyond `r_multiple numeric(10,2)` (> 99 999 999,99) is a field error on
  `exitMinor`; a risk HUF twin beyond a `long` is a field error on `quantity` (as `PenzFxService.toHufMinor`).
- **`PaperTradeMath`** — risk = |entry − stop| × qty, P/L long/short, R = P/L ÷ risk (computed from the prices, so
  exact), stored with 2 decimals; `stopRespected` = the exit did not go beyond the stop.
- **HUF twins** by THE booking policy (§4.1, `PenzFxService.book`): cost and risk at the entry date, P/L at the exit
  date, the unrealized P/L at the typed last close's date; the plan's per-unit figures at today's rate until opened.
  No market data at all — every price is typed; without a typed close an open trade is valued at entry (0).
- **The cap (`PracticeCap`)** — `C = practice_monthly_minor`, the same field as the allowance's `practice` line
  (§3.1). For the month: used = Σ `cost_huf` of open trades + max(0, −Σ `pnl_huf` closed this month); left =
  max(0, C − used). Opening above left → **422 `PENZ_PRACTICE_CAP_EXCEEDED`**. Gains never raise it; nothing reads a
  holding, a savings goal, the allowance or income. The month is always the owner's **current** month (`today`),
  never the entry's. **The lock**: create, edit and open first take a per-owner transaction advisory lock
  (`PenzPaperTradeRepository.lockOwner`, `pg_advisory_xact_lock(hashtext('penz_practice:' || owner))`), so two
  concurrent opens are serialized and cannot both pass the cap (`PenzPracticeApiIT` races two).
- **The week (`WeeklyReview`)** — Monday-start (the owner's money timezone): win rate (R > 0), by setup, distribution
  (≥ +2R · −1,2R…0 · < −1,5R; healthy = none below −1,5R), the most common mistake (the most frequent tag among the
  week's mistake-flagged trades, ties → the costlier; cost = −Σ their HUF P/L when negative) and the cumulative curve.
- **The copy (`PracticeCopy`)** — deterministic Hungarian templates over those figures, no model call: headline / sub
  (null without a closed trade this week), 0–3 observations, and under 50 tagged trades the `noiseLine`. Forints as
  the digest formats them (`DigestFigures.hufMagnitude`), R with a decimal comma (`+0,8R`). Boundary (spec §6): never
  urges, promises a return or says sell — `PenzPracticeCopyTest` guards it.
- Pénzem's practice row (`PenzPracticeRow.monthPnlHufMinor`) reads the same month P/L.
### 3.13 Catalog and proposals (L7)

`PenzProposalController` (tags `PenzCatalog` + `PenzProposal`) → `PenzCatalogService` / `PenzProposalService` /
`PenzStrategyService` → the pure package `service/proposal` (no Spring). Builder calls 10–16 of
[`2026-11-20-boop-penz-l7-build.md`](../superpowers/plans/2026-11-20-boop-penz-l7-build.md).

- **The catalog** (`penz_product`, per owner): seeded once per owner and seed key from `PenzCatalogSeed.SEEDS`
  (native insert, `ON CONFLICT DO NOTHING` on `uq_penz_product_created_by_seed_key`, which ignores `is_deleted` — a
  declined or deleted seed never returns; a seed added to the code later appears as a new suggestion). Seeds are
  `suggested` / `research` with fee fields, source and `reviewed_at`. **The list is empty for now** (the product facts
  are being verified). He approves / declines with one tap (idempotent), adds his own (`approved` / `owner`,
  `reviewed_at` = his today) or edits fees (`reviewed_at` = his today, status kept). The model never writes this table.
- **The split** (`ProposalSplitter`): emergency target = `emergency_fund_months` × the allowance engine's `fixedCosts`
  line of the month (none → no target); the short sleeve gets `min(A, max(0, target − shortValue))` (short value =
  Σ short-sleeve positions from `PenzPortfolioService.positions`, cached quotes); the rest 40 % mid / 60 % long;
  short and mid round down to 1 000 Ft, every rounding rest goes to long (the three always sum to A). A shortfall
  below 1 000 Ft rounds the short sleeve to 0 — the fallback says no money goes there this time, never "0 Ft".
- **Options** (`ProductOptions`): approved products of that sleeve only (status re-checked in the pure code), TER
  ascending (unknown last), then entry fee, then name, at most 3; fewer than 2 → `optionsNote`. Per option: the
  yearly running cost for the sleeve amount (`amount × TER`, HALF_../ to 10 Ft, null without TER) and the server-
  computed "differs" lines (cost delta vs the cheapest — "the lowest" only for a strictly cheapest option, never on a
  TER tie or a 0 Ft amount — currency and distribution only when the options differ, entry fee).
- **Narration** = one call per proposal (`PenzProposalLlm`, adapter `PenzProposalLlmAdapter`, cheap tier, tag
  `penz_proposal/narrate`, payload-free) on `ProposalPrompt` → `ProposalNarration.parse` →
  `ProposalNarration.normalised` (`NewsText.clean`, NFKC, `\p{Cf}` out, every `\p{Z}` → a space; the text is validated
  AND stored in this form, so a zero-width space, soft hyphen, no-break space or full-width digit hides nothing) →
  `ProposalValidator` (the digest validator's sibling: every number from `ProposalFigures` — forint figures incl. the
  cost deltas, percentages, the months — with `HufAmountGuard.verdict` on every field; `%` / `százalék` / `percent`
  only right after an allowed digit figure; a sleeve's "why" names only that sleeve's options, summary / uncertainty
  only offered options, no other catalog product ever — by full name, ticker root, ISIN or a distinctive short form
  such as "MSCI World", "S&P 500", "LifeStrategy", "All-World" (a short form that also occurs in a name allowed there
  is left alone) — **and nothing outside his catalog** (`mezo-r36n9.121`): a capitalised word in mid-sentence, a word
  with two or more capitals anywhere (*OTP*, *BUX*) or a well-known asset name at a sentence start (*Bitcoin*,
  *Tesla*; `KNOWN_OUTSIDE_NAMES`) must be a word of a catalog product's name or description (inflected allowed:
  *Vanguardnál*, *ETF-ben*) or one of a few generic words (*Boop, ETF, UCITS, TER, ISIN, EU, Magyar*) — else the
  narration falls back; boundary stems HU + EN for buy-imperative, sell, urge, countdown, return promise and forecast —
  `hozam` only inside the server's own option wording ("újrabefekteti / kifizeti a hozamot") and the fallback's
  no-claim sentence; no URL, no markup but `*emphasis*`, no prompt-leak marker).
  Any failure anywhere → the whole narration is `ProposalFallbackCopy` (`narratedBy: fallback`), built from the same
  figures and proven to pass the validator. Title, sub, facts and rules are always computed copy.
- **Lifecycle** (`penz_proposal`): created `proposed` (a newer one of the same kind supersedes a still-proposed
  older one; an accepted one is never superseded) → `accepted` with HIS numbers (each sleeve once, amount ≥ 0, a
  product must be one of that sleeve's offered options AND still approved now, else 409 `PENZ_PRODUCT_NOT_APPROVED`;
  total > 0) or `dismissed`. The plan = the sleeves with an amount, in horizon order; `steps/{i}` ticks done/undone.
  **Nothing moves money**: no proposal endpoint writes a transaction, holding or investment row.
- **The monthly strategy** (`MonthlyInvestable`, a port of the old app's `suggestInvestment` / `pullForwardRoomMinor`
  / `planning.ts` averages with their vitest vectors): `available = min(avgIncome − avgExpenses − savingsTarget,
  freeBeforeInvest)`, 25 % before / 60 % after the emergency fund (short value ≥ target), last month's excess over
  last month's accepted monthly proposal trims it by at most half, floored to 1 000 Ft; no complete tracked month →
  0 with a note. `GET /api/penz/strategy` returns it with its inputs and the month's current monthly proposal;
  `POST /api/penz/proposals {kind: monthly}` splits exactly that figure. Recomputed on every read, no job, no push.

### 3.14 The weekly long-horizon review (`mezo-r36n9.120`)

Spec §5.1 designer's call: the daily digest reports *what moved and how it touches him*; the long-horizon "what
actually matters" verdict is **weekly**, because the cadence is the filter (M1's relevance criteria — lasting
industry structure, regulation, technology, long-run financials; reactionary noise dropped). Pure core in
`service/news` (`WeeklyReviewSectioner`, `WeeklyFigures`, `WeeklyReviewPrompt`, `WeeklyReviewValidator`,
`WeeklyReviewFallbackCopy`, `WeeklyReviewAssembler`), wiring in `PenzWeeklyReviewService`, `PenzWeeklyReviewStore`,
`PenzWeeklyController` (tag `PenzWeekly`).

1. **Source** — the owner's stored daily digests (`penz_digest.items`) of the **previous complete Monday–Sunday
   week** of his today in his money timezone (`PenzSettings.timezone`; a digest's `digest_date` is already his local
   date). Items are de-duplicated by story `id` across days — the latest day's copy wins; only items narrated by the
   model or by fallback copy count (all stored items are one of the two). **No new feed fetch, no article bodies**,
   and the stored model prose (verdict / body) is never fed back.
2. **Sections** — always `short` (1–3 év), `mid` (5–10 év), `long` (10+ év), in order. A holding story belongs to
   its stored sleeve (else the ledger's; a story of a holding no longer held and without a sleeve is dropped); an
   `fx` story to every sleeve holding a non-HUF holding, a `rates` story to every sleeve holding a bond — by the
   **current live holdings**. Within a section: most sources first, then newest.
3. **Figures** (`WeeklyFigures`, deterministic, per sleeve): the week's story count, the distinct source names
   (case- and diacritic-insensitive), the holdings the stories touch (ledger names: a holding story's holding; for
   fx the sleeve's non-HUF holdings, for rates its bonds) and, for `long` only, the **coverage months** exactly as
   Pénzem computes them (`PenzPortfolioService.longCoverageMonths` → `PortfolioEngine`, cached quotes; null when
   fixed costs are unknown or the computation fails). Spelled like `DigestFigures` (plain digits, space-grouped).
4. **Narration** — ONE call per review, outside any transaction, only when at least one sleeve had stories:
   penz-owned port `PenzWeeklyReviewLlm`, adapter `companion/llm/PenzWeeklyReviewLlmAdapter` (1:1 the digest
   adapter: cheap tier, tag `penz_weekly/narrate`, **payload-free** in the LLM audit log —
   `LlmCallContext.FEATURE_PENZ_WEEKLY`; a budget refusal, throttle or provider error is an empty answer). Prompt
   marker `BOOP_PENZ_WEEKLY_V1` (`WeeklyReviewPrompt`): Boop's voice, the six §6 boundaries, the weekly relevance
   rule, the number / name rules, the schema; per non-quiet sleeve a `SECTION sleeve=…` header with `Horizont`,
   `FIGURES` and the `Tételek:` it may name, then ≤ 12 stories, each fenced
   `<<<STORY id=… kind=…>>> Tétel / Megbízhatóság / Cím (≤ 3 feed headlines; the stored card title when none) /
   Forrás <<<END STORY …>>>`. Headlines, source names and ledger names pass `DigestPrompt.sanitizeUntrusted` (no
   fence break, no fake `SECTION` / `FIGURES` line); story ids are stripped to `[A-Za-z0-9_-]`. No dates are given
   (they would be numbers the model may not write). Scripted fake under `companion-fake`: a clean answer per section
   (`matters: true` on its first story), `[fake-penz-weekly:<base64>]` in the user message, or
   `FakeCompanionLlm.scriptPenzWeekly(raw)`.
5. **Model output per sleeve** — `{sleeve, matters, storyIds, verdict ≤ 220, body ≤ 1 200, uncertainty ≤ 500,
   noAction ≤ 300}`. `matters: false` is a normal, complete answer (*„Ezen a héten semmi nem változtatott a hosszú
   távú képen"*).
6. **Validate** (`WeeklyReviewValidator`, the `DigestValidator` rule families through its shared package helpers —
   `checkTemporal`, `checkNumbers`, `checkSigned`, `checkEntities`, `checkBoundary`, `forbiddenTerms`; the digest's
   own behaviour unchanged):

   | Class | Rule |
   |---|---|
   | **Numerical Error** | every number is one of the section's figures (story count, source count, coverage months); no `%`; no scale word / other currency by a figure; horizon digits only inside the sleeve's own phrase; `HufAmountGuard.verdict` against an **empty** allowed set (the review has no forint figure, so any amount is invented; no derived sums); no spelled-out number beyond *egy..hat*, no bare `Ft`; digits inside the section's ledger names skipped |
   | **Entity Swap** | only the section's holdings (its sleeve's live holdings + the stories' own) — no other holding's name or match terms |
   | **Negation Flip** | no figure has a direction, so only the sign rule (no signed figure) |
   | **Temporal Confusion** | no year, no weekday |
   | **Boundary** | the digest's buy / sell / urge / promise stems (also letter-spaced), no URL, no markup but `*emphasis*`, no prompt-leak marker (the digest's + *story, section, sleeve*) |
   | **Shape** | the four fields non-blank and within caps; `matters` a boolean; `matters: true` must cite at least one of the section's own story ids (unknown ids are ignored) |

7. **Fallback / quiet** (`WeeklyReviewAssembler`, `WeeklyReviewFallbackCopy`): a sleeve with any violation, missing
   from the answer, or no answer at all → fixed copy (`narratedBy: fallback`, `matters: false`): an honest *„nem
   tudtam megbízhatóan összefoglalni"*, the story count in words (*Egy … Hat*, then *Hatnál több*), and a per-sleeve
   *nincs teendőd* (10+ / 5–10 / 1–3 years differ). A sleeve with no stories → deterministic quiet copy
   (`narratedBy: quiet`), never asked of the model. Every fixed string passes the validator (tested). Stories shown:
   ≤ 6 per section — the ones the model relied on first, then most sources, newest.
8. **Store** (`PenzWeeklyReviewStore.replace`, one short transaction): `penz_weekly_review`, one live row per owner
   and `week_start`; `ready` (any sleeve had stories), `quiet` (none — no model call), `failed` (the build itself
   broke — the next run rebuilds it). Rejections are logged as sleeve + rule names only.
9. **When** — `PenzNewsRunner.buildFor`, after each user's daily digest (job run and manual refresh alike):
   `buildIfMissing` builds the previous week's review if no non-failed row exists for it — so the **Monday 06:30**
   run creates it and a later run fills a missed week; idempotent, one review per week. No new cron, no new switch,
   **no push, no notification, no action button**.
10. **API** — `GET /api/penz/weekly-review?week=` (§4.2): `week` = a Monday (another day means its week); without
    it the latest stored review, else `pending` for the previous complete week. Response `{weekStart, weekEnd, status
    pending|ready|quiet|failed, generatedAt, sections: [{sleeve, horizonLabel, storyCount, sourceCount, matters,
    verdict, body, uncertainty, noAction, narratedBy model|fallback|quiet, coverageMonths?, stories: [{id, title,
    holdingName, kind, sources: [{name, url}], publishedAt}]}]}`.

## 4. Data model & API

### 4.1 The money value type and THE one FX policy

- `Money(long minor, String currency)` — minor = **1/100 of the major unit for every currency, HUF included**
  (15 500 Ft = `1_550_000`); currency ∈ {HUF, EUR, USD, GBP, CHF}; arithmetic only within one currency.
  `BookedAmount(Money amount, long hufMinor, LocalDate rateDate, BigDecimal rate)` = an amount plus its HUF twin.
  No bare `Integer` forint field exists anywhere; every money column is a `bigint` of minor units.
- **The booking rate** (`PenzFxService`, the only place a rate is applied): HUF twin = amount × the frankfurter.dev
  ECB reference rate `CUR→HUF` **for the transaction's own date** (frankfurter answers the last rate published on or
  before it — a weekend books Friday's), rounded HALF_UP to a whole minor unit. A future-dated row asks today's rate.
- **Computed once at write time and STORED** (`amount_huf_minor`, with `fx_rate` + `fx_rate_date` = the ECB publication
  date used) — **never re-derived**; a later rate never rewrites history (an edit of amount / currency / date
  re-books, nothing else does). HUF → rate 1, no fetch, fx columns null (a check constraint enforces it).
- **Global per-date cache** `penz_fx_rate` (no `created_by`), unique `(base, quote, rate_date)` where `rate_date` is the
  date asked and `published_date` the ECB date answered: one HTTP fetch per (currency, date), ever.
- **Provider down or no rate**: the newest cached rate asked within **7 days before** the date
  (`mezo.penz.fx-fallback-days`) is used, marked by nothing — the stored rate date tells the truth; none →
  the write fails with **503 `PENZ_FX_UNAVAILABLE`**.
- **Valuation is a different thing** (L6, §3.6): a holding's *value* uses the latest quote and the latest cached
  `CURHUF=X` close, recomputed on every read and never stored; the *booking* policy above applies only to the
  money a buy or sell cost (`penz_invest_txn.amount_huf_minor`, booked once at the trade date's ECB rate).

The engine works only on the HUF twins; the allowance is HUF-based. Money on the wire is
`PenzMoney {minor: int64, currency, hufMinor: int64}`.

### 4.2 Endpoints

Contract-first: [`api/feature/penz/penz.yml`](../../api/feature/penz/penz.yml) (tag `Penz`, JWT) and
[`penz-sms.yml`](../../api/feature/penz/penz-sms.yml) (tag `PenzSms`), and since L6
[`penz-portfolio.yml`](../../api/feature/penz/penz-portfolio.yml) (tags `PenzPortfolio` and `PenzNews`, JWT), since L7
[`penz-practice.yml`](../../api/feature/penz/penz-practice.yml) (tag `PenzPractice`, JWT), all in
[`penz-proposals.yml`](../../api/feature/penz/penz-proposals.yml) (tags `PenzCatalog` and `PenzProposal`, JWT), since
`.120` [`penz-weekly.yml`](../../api/feature/penz/penz-weekly.yml) (tag `PenzWeekly`, JWT), all in
`api/generate/merge.yml`.

| Method · path | What |
|---|---|
| `GET`/`PUT /api/penz/settings` | settings (created with defaults on first access) |
| `GET`/`POST /api/penz/accounts`, `PUT /api/penz/accounts/{id}`, `POST …/{id}/archive` | accounts with the flag rules |
| `GET`/`POST /api/penz/categories`, `PUT …/{id}` | categories (15 defaults seeded) |
| `GET /api/penz/transactions?month=` · `POST` · `PUT`/`DELETE …/{id}` · `POST …/{id}/reviewed` | one month newest first (materializes first); idempotent create on `clientRef`; soft delete; `PUT`/`DELETE` of an investment's money row → 409 `PENZ_TRANSACTION_INVEST_LINKED` (`.119`) |
| `POST /api/penz/transfers` | a transfer pair, idempotent on `clientRef` |
| `GET`/`POST /api/penz/recurring-rules`, `PUT`/`DELETE …/{id}` | recurring income and fixed costs (delete keeps produced txns) |
| `GET`/`POST /api/penz/savings-goals`, `PUT`/`DELETE …/{id}` | savings goals / purchase plans (L5): by `position` then creation; create 201, idempotent on `clientRef`, no position = append at the end; update ignores `clientRef`, null position keeps it; soft delete 204 |
| `GET /api/penz/allowance?date=` | month + week (`perDay`) + the 10 `lines[]` (materializes first) |
| `GET /api/penz/month-closes` · `GET …/open` · `POST …/{month}` | closed months; open months with the figures a close would store; close (`leftoverAction`) |
| `POST /api/penz/sms/ingest` | the Shortcut (API key, §3.4) |
| `GET`/`POST /api/penz/sms/keys`, `DELETE …/{id}` | key management (JWT; plaintext once) |
| `GET`/`POST /api/penz/holdings`, `PUT`/`DELETE …/{id}` | L6 holdings (archived included, flagged), by sleeve then position; create 201 idempotent on `clientRef`, symbol checked once (400 `PENZ_SYMBOL_UNKNOWN`); delete soft, with its transactions and events |
| `GET /api/penz/holdings/{id}/transactions` · `POST /api/penz/invest-transactions` · `DELETE …/{id}` | L6 buys / sells, newest first; create 201 idempotent, FIFO guard 400 `PENZ_SELL_EXCEEDS_POSITION`, non-HUF booked by the FX policy (503 `PENZ_FX_UNAVAILABLE`); since `.119` optional `accountId` / `accountAmountMinor` / `linkTransactionId` record the linked money row (§3.6; 404 `PENZ_ACCOUNT_NOT_FOUND`, 409 `PENZ_SMS_LINK_MISMATCH`), the response carries `accountId` + `transactionId`; delete releases the money row |
| `GET /api/penz/invest-transactions/sms-candidates?accountId=&amountMinor=&date=` | `.119` bank-SMS debits a buy may adopt (§3.6), closest date first; empty without an SMS sender |
| `GET`/`POST /api/penz/holding-events?from=`, `DELETE …/{id}` | L6 forward timeline (owner-entered), soonest first |
| `GET /api/penz/portfolio?date=` | L6 Pénzem: totals, moves (price / currency), the three sleeves with holdings and coverage, price date + stale, timeline, practice row (refreshes due quotes first) |
| `GET /api/penz/digest?date=` | L6 the day's digest (default his today); `pending` when not built; `newsHealthy` |
| `POST /api/penz/digest/refresh` | L6 rebuild in the background → 202; 429 `PENZ_DIGEST_REFRESH_LIMITED` within 15 minutes |
| `GET /api/penz/weekly-review?week=` | `.120` the weekly long-horizon review (§3.14): of `week`'s week (a Monday), else the latest stored; `pending` before any; three sleeve sections |
| `GET /api/penz/practice?date=` | L7 Gyakorlás: cap, month P/L, avg R, tag counts + `noiseLine`, the eight tags, the week (figures + copy + curve + trades), open and planned trades |
| `GET`/`POST /api/penz/practice/trades`, `PUT`/`DELETE …/{id}` | L7 the journal (newest first, `from`/`to`); create 201 idempotent on `clientRef` (optionally opened); edit planned only; soft delete |
| `POST /api/penz/practice/trades/{id}/open` · `/close` · `/last-close` · `/cancel` | L7 the transitions (409 out of order); open checks the stop and the cap (422) |
| `GET`/`POST /api/penz/catalog`, `PUT …/{id}`, `POST …/{id}/approve` · `…/decline` | L7 the curated product list (seeded once per owner; approved, suggested, declined); own product 201 approved; edit sets `reviewedAt` today |
| `GET /api/penz/strategy?date=` | L7 the monthly strategy figure + inputs + the month's current monthly proposal |
| `GET`/`POST /api/penz/proposals?status=`, `GET …/{id}`, `POST …/{id}/accept` · `…/dismiss` · `…/steps/{index}` | L7 proposals: create 201 (lump_sum amount ≥ 1 000 Ft or monthly = the strategy figure, else 400 `PENZ_PROPOSAL_AMOUNT_INVALID`), accept with his numbers (409 `PENZ_PRODUCT_NOT_APPROVED` / `PENZ_PROPOSAL_STATE`), steps tick |

Error codes (both bundles): `PENZ_ACCOUNT_NOT_FOUND`, `PENZ_CATEGORY_NOT_FOUND`, `PENZ_CATEGORY_NAME_TAKEN`,
`PENZ_TRANSACTION_NOT_FOUND`, `PENZ_RECURRING_RULE_NOT_FOUND`, `PENZ_TRANSFER_SAME_ACCOUNT`, `PENZ_FX_UNAVAILABLE`,
`PENZ_MONTH_NOT_OVER`, `PENZ_EARLIER_MONTH_OPEN`, `PENZ_MONTH_ALREADY_CLOSED`, `PENZ_LAST_ACTIVE_ACCOUNT`,
`PENZ_NO_SAVINGS_TARGET_ACCOUNT`, `PENZ_SMS_KEY_NOT_FOUND`, `PENZ_SMS_KEY_INVALID`, `PENZ_SMS_RATE_LIMITED`,
`PENZ_CURRENCY_MISMATCH`, `PENZ_CLIENT_REF_CONFLICT`, `PENZ_ACCOUNT_CURRENCY_LOCKED` (`.108`), `PENZ_SAVINGS_GOAL_NOT_FOUND` (L5), and L6:
`PENZ_HOLDING_NOT_FOUND`, `PENZ_INVEST_TXN_NOT_FOUND`, `PENZ_HOLDING_EVENT_NOT_FOUND`, `PENZ_SYMBOL_UNKNOWN`,
`PENZ_SELL_EXCEEDS_POSITION`, `PENZ_DIGEST_REFRESH_LIMITED`, and L7: `PENZ_PAPER_TRADE_NOT_FOUND`,
`PENZ_PRACTICE_CAP_EXCEEDED` (422), `PENZ_PAPER_TRADE_STATE` (409), `PENZ_PAPER_TRADE_INVALID_STOP`,
`PENZ_PRACTICE_TAG_UNKNOWN`.
`PENZ_SELL_EXCEEDS_POSITION`, `PENZ_DIGEST_REFRESH_LIMITED`, and L7: `PENZ_PRODUCT_NOT_FOUND`,
`PENZ_PRODUCT_NOT_APPROVED`, `PENZ_PROPOSAL_NOT_FOUND`, `PENZ_PROPOSAL_STATE`, `PENZ_PROPOSAL_AMOUNT_INVALID`, and
`.119`: `PENZ_SMS_LINK_MISMATCH` (409), `PENZ_TRANSACTION_INVEST_LINKED` (409).

### 4.3 Tables

One changelog, [`202611191400_mezo-r36n9.102_penz.sql`](../../backend/src/main/resources/db/changelog/1.1.0/script/202611191400_mezo-r36n9.102_penz.sql):

| Table | Holds |
|---|---|
| `penz_settings` | one per owner: `savings_target_minor`, `practice_monthly_minor` (2 000 000), `week_start` (`monday` only), `emergency_fund_months` (6), `timezone`, `month_overrides` jsonb |
| `penz_account` | name, type `checking|savings|cash|investment`, currency, opening balance, `is_default` / `is_savings_target` (partial unique: one each), archived, `sms_sender` |
| `penz_category` | name, kind `expense|income`, icon, `monthly_budget_minor`, position; unique per owner + kind + lower(name) |
| `penz_transaction` | account, kind `expense|income|transfer_out|transfer_in|invest_buy|invest_sell`, `amount_minor` + currency + `amount_huf_minor` + `fx_rate` / `fx_rate_date`, category, date, note, source `manual|sms|recurring`, `needs_review`, `recurring_rule_id` (unique with date), `transfer_pair_id`, `sms_message_id` (unique), `client_ref` (unique per owner) |
| `penz_recurring_rule` | the old RecurringRule: amount (own currency + HUF twin), account, category, `weekly|monthly|yearly`, start / end, `last_materialized_date`, active |
| `penz_month_close` | `month` 'YYYY-MM' (unique per owner), `final_remaining_minor`, `deficit_minor`, `leftover_action` `transferred|kept|none`, `transfer_pair_id` |
| `penz_fx_rate` | **global** rate cache: base, quote, `rate_date` (asked), `published_date`, rate |
| `penz_sms_message` | sender, text (null when ignored), `text_hash` (unique per owner), received_at, status `parsed|ignored|failed|converted`, reason, the parsed fields, `transaction_id` |
| `penz_api_key` | name, `key_hash` (SHA-256 hex, unique), `last4`, revoked, `last_used_at` |
| `penz_savings_goal` | L5, own changelog [`202611201000_mezo-r36n9.103_penz_savings_goal.sql`](../../backend/src/main/resources/db/changelog/1.1.0/script/202611201000_mezo-r36n9.103_penz_savings_goal.sql): name, kind `goal|purchase`, `target_minor` (> 0) and `saved_minor` (≥ 0) HUF minor units, `due_date`, note, position, `client_ref` (unique per owner among live rows) |

L6 adds seven tables in [`202611201600_mezo-r36n9.104_penz_portfolio.sql`](../../backend/src/main/resources/db/changelog/1.1.0/script/202611201600_mezo-r36n9.104_penz_portfolio.sql):

| Table | Holds |
|---|---|
| `penz_holding` | name, `asset_type`, `symbol`, platform (+ `platform_name`), `sleeve` `short|mid|long`, currency, `bond_rate_pct`, `news_terms` jsonb, note, position, archived, `client_ref` |
| `penz_invest_txn` | holding, side `buy|sell`, quantity (optional), `amount_minor` in the holding's currency + `amount_huf_minor` + `fx_rate` / `fx_rate_date` (the L4 booking policy), date, note, `client_ref`, and since `.119` `transaction_id` (nullable FK → `penz_transaction`, the linked money row; [`202611211400_mezo-r36n9.119_penz_invest_account_link.sql`](../../backend/src/main/resources/db/changelog/1.1.0/script/202611211400_mezo-r36n9.119_penz_invest_account_link.sql)) |
| `penz_holding_event` | holding, kind `maturity|coupon|dividend|earnings|other`, date, optional amount + currency, note, `client_ref` |
| `penz_quote` | **global** quote cache, one row per symbol (securities and `CURHUF=X`): price, `previous_close`, `market_time`, `as_of` (Budapest date), `fetched_at` |
| `penz_news_article` | **global** articles from the allow-listed feeds, unique url: `source_key`, `source_name`, title, summary (untrusted text), `published_at`, `fetched_at`; pruned after 30 days |
| `penz_digest` | one live row per owner and `digest_date`: status `ready|quiet|failed`, `items` jsonb (contract-shaped `PenzDigestItemJson`), `generated_at`, `prices_as_of` |
| `penz_provider_status` | **global** health per outbound provider: `provider_key` (unique), kind `news|quotes`, last success / failure, `fail_streak`, `last_error` (§3.11) |

L7 adds [`202611202000_mezo-r36n9.105_penz_practice.sql`](../../backend/src/main/resources/db/changelog/1.1.0/script/202611202000_mezo-r36n9.105_penz_practice.sql):

| Table | Holds |
|---|---|
| `penz_paper_trade` | `paper` (always true), status `planned|open|closed|cancelled`, instrument, direction `long|short`, why, currency, quantity, per-unit `planned_entry` / `stop` / `target` / `entry` / `exit` / `last_close` minor units, plan / exit / last-close fx rate + date, `risk_minor` + `risk_huf_minor`, `cost_huf_minor`, `pnl_minor` + `pnl_huf_minor`, `r_multiple`, `unrealized_huf_minor`, `tags` jsonb (read in Java only), `mistake`, `line`, `client_ref` (unique per owner among live rows) |
L7 adds two tables in [`202611202010_mezo-r36n9.105_penz_proposals.sql`](../../backend/src/main/resources/db/changelog/1.1.0/script/202611202010_mezo-r36n9.105_penz_proposals.sql):

| Table | Holds |
|---|---|
| `penz_product` | the owner's curated list: `seed_key` (research seeds only, unique per owner incl. deleted rows), name, `kind` `state_bond|money_market|bond_etf|equity_etf|mixed_fund|deposit`, currency, `sleeves` jsonb, `what_it_is`, `ter_pct`, `entry_fee_pct`, `fee_note`, `distribution` `accumulating|distributing|interest`, isin, symbol, `source_name` / `source_url`, `reviewed_at`, `status` `suggested|approved|declined`, `suggested_by` `research|owner`, `approved_at` |
| `penz_proposal` | `kind` `lump_sum|monthly`, `status` `proposed|accepted|dismissed|superseded`, `amount_huf_minor` (> 0), `month` 'YYYY-MM', `body` jsonb (`PenzProposalJson`: card lines, narration, facts, rules, sleeves with options), `plan` jsonb (his accepted steps), `accepted_at` |

`.120` adds [`202611211600_mezo-r36n9.120_penz_weekly_review.sql`](../../backend/src/main/resources/db/changelog/1.1.0/script/202611211600_mezo-r36n9.120_penz_weekly_review.sql):

| Table | Holds |
|---|---|
| `penz_weekly_review` | one live row per owner and `week_start` (a Monday — check constraint; partial unique index over live rows): status `ready|quiet|failed`, `sections` jsonb (contract-shaped `PenzWeeklySectionJson`, always three once built), `generated_at` |

All registered in `support/ResetDatabase`; test rows through `PenzPopulator`.

## 5. Integrations

- **Companion → LLM (SMS parse).** Penz owns the port `PenzSmsLlm`; `feature/companion/llm/PenzSmsLlmAdapter` adapts
  it on the cheap tier (the `DayCloseLlm` precedent, ADR 0008/0012: `LlmCallContext` tag `penz_sms/parse`, budget
  gate, audit). Penz never imports companion.
- **Auth platform.** The ingest's own filter chain sits beside the main JWT chain; the synthetic principal keeps
  `CurrentUser` / `created_by` unchanged — see [`_platform-auth-security.md`](_platform-auth-security.md).
- **frankfurter.dev** (outbound HTTP, `FrankfurterClient`, `OffClient` shape: explicit timeouts, typed error).
- **Yahoo chart endpoint and the news feeds** (L6, outbound through `PenzHttpFetcher`, §3.7–§3.9) — free, no key;
  WireMock in every IT.
- **Companion → LLM (proposal narration, L7).** Penz-owned port `PenzProposalLlm`, adapter
  `companion/llm/PenzProposalLlmAdapter` (cheap tier, tag `penz_proposal/narrate`, payload-free:
  `LlmCallContext.FEATURE_PENZ_PROPOSAL`); the `companion-fake` profile answers a canned valid narration, scriptable
  per IT (`FakeCompanionLlm.scriptPenzProposal`).
- **Companion → LLM (digest narration, L6).** Penz-owned port `PenzDigestLlm`, adapter
  `companion/llm/PenzDigestLlmAdapter` (cheap tier, tag `penz_digest/narrate`, payload-free audit:
  `LlmCallContext.FEATURE_PENZ_DIGEST`).
- **Monitoring (L6).** `mezo_penz_provider_fail_streak` + the `PenzNewsProviderDown` / `PenzQuotesProviderDown`
  vmalert rules (§3.11).
- **Auth platform (L6 cron).** The news run fans out with `UserFanOut.forEachActiveUser` (active + onboarded users,
  each under `LlmActorContext.runAs`).
- **Boop iOS (L5).** The Pénz area will read `allowance`, transactions, month closes, and write cash expenses through
  the outbox with `clientRef`; the iOS openapi-generator filter is untouched in L4.
- **Boop money text.** Every generated sentence with a forint figure must pass `HufAmountGuard.verdict` against the
  computed inputs (spec §6: the model narrates figures computed elsewhere) — since L6 the digest does, inside
  `DigestValidator`.

## 6. How to use it (consume)

From another backend feature: none yet — no other feature reads Pénz. Inside Pénz, the digest reads the
portfolio through `PenzPortfolioService.positions(owner, date)` (cached quotes only — refresh first). From a client: call the endpoints above
with the owner's JWT; render `lines[]` in order (each `amount` a `PenzMoney`; print `hufMinor / 100` as whole
forints). Treat `PENZ_FX_UNAVAILABLE` (503) as "retry later", never as a validation error. Use `clientRef` (UUID) on
every phone write so a retry returns the stored row.

## 7. How to extend it

- New arithmetic → a pure function in `service/engine` with a ported or new unit test first; services only map rows.
- A new money column → `bigint` minor units in its own currency + `amount_huf_minor` booked through
  `PenzFxService.book` at write time; never a rate applied elsewhere.
- A new endpoint → contract first in the right fragment, `enum` only on responses / `pattern` on requests, new error
  codes in **both** `messages_hu.properties` and `messages_en.properties`, regenerate `api/openapi.yml` (see
  [`_platform-api-backend.md`](_platform-api-backend.md)); house rules in `docs/references/`.
- A new table → into the same feature's changelog style, `ResetDatabase`, a populator, in the same change.
- Generated money text → feed the engine's figures (and any total you want quoted) as the allowed set of
  `HufAmountGuard.verdict`; downgrade on `DOWNGRADE`.
- A new news feed → a `NewsSources.SEED` entry (key, name, url, article hosts) — code, reviewed like code, because it
  is an outbound allow-list entry; it gets its own `rss:<key>` health row automatically.
- A new outbound provider → through `PenzHttpFetcher` with its own allow-list, health via `PenzProviderHealth` (the
  gauge and the alert follow from the kind).
- A researched catalog product → a `PenzCatalogSeed.SEEDS` row with a new, never-reused `key`, its fee figures, source
  and `reviewedAt` (code, reviewed like code); every owner gets it as a suggestion on the next catalog read.
- A new proposal rule → `ProposalValidator` + a test in `PenzProposalValidatorTest` by taxonomy class, and
  `PenzProposalFallbackCopyTest` must stay green (the fixed copy passes every rule by construction).
- A new digest rule → a test in `PenzDigestValidatorTest` named by its taxonomy class first, then the rule; make sure
  `DigestFallbackCopy` still passes it (`PenzDigestFallbackCopyTest`).

## 8. Testing

Backend only (`-Dmezo.test.use-testcontainers=true`, `ArchitectureTest` in the `-Dtest` list):

- Pure / ported: `PenzAllowanceEngineTest`, `PenzDatesTest`, `PenzRecurrenceTest`, `PenzMonthCloseTest`,
  `PenzBalancesTest`, `PenzEmergencyFundTest`, `PenzAccountRulesTest`, `PenzCategoryBudgetsTest`,
  `PenzRecurringMathTest`, `PenzMoneyTest`, `PenzFxConversionTest`, `PenzFxServiceTest`, `PenzTxLogicTest`,
  `HufAmountGuardPortedTest` + `HufAmountGuardTest`, `service/sms/*` (ingest logic, conversion, keys, amount check,
  `PenzInvestSmsMatchTest` — the invest-buy ↔ bank-SMS matching, `.119`).
- ITs: `PenzApiIT` (CRUD, ownership, `clientRef`, transfers, the FX policy incl. cache / fallback / 503, account
  flags, close guards), `PenzAllowanceApiIT` (10 lines with Gyakorlás and a real-close deficit, week + perDay,
  materialization), `PenzMonthCloseServiceIT`, `PenzSmsIngestApiIT` (chains, rate limit, dedupe, pre-filter, fake
  LLM, conversion, and since `.119` the 3 invest-buy adoption cases of the old `runConvertSms`). frankfurter.dev is
  always WireMock; every figure is invented.
- L6 pure: `service/portfolio/{PenzLotsTest,PenzValuationTest,PenzPortfolioEngineTest}`, `PenzQuoteParseTest`,
  `service/net/PenzHttpFetcherTest`, `service/news/{PenzRssParserTest,PenzNewsSourcesTest,PenzNewsMatcherTest,
  PenzStoryClustererTest,PenzArticleTextTest,PenzDigestFiguresTest,PenzDigestFallbackCopyTest,PenzDigestPromptTest,
  PenzDigestValidatorTest (by taxonomy),PenzDigestAssemblerTest,PenzDigestInjectionTest}`,
  `companion/llm/PenzDigestFakeLlmTest`.
- L6 ITs: `PenzPortfolioApiIT` (CRUD, ownership, FIFO and its guards, symbol check, FX booking, Pénzem figures),
  `PenzInvestAccountLinkApiIT` (`.119`: the money row on a HUF / same-currency / explicit / cross-currency account and
  the allowance `invested` line, sell → `invest_sell`, payable-account rule, ownership, `clientRef` replay, SMS
  adoption + date from the bank row, link mismatch, delete / holding delete release, the 409 guard),
  `PenzQuoteServiceIT`, `PenzNewsDigestStoreIT` (article upsert / prune, digest round trip and replace),
  `PenzDigestPipelineIT` (companion-fake + WireMock feeds, pages, Yahoo: a full run's figures equal the portfolio's,
  holdings-only relevance, grouping, injection ignored / obeyed → fallback, quiet day, model failure, GET pending /
  ready, refresh 202 → 429), `PenzNewsProviderAlertIT` (three failed runs → every news streak 3, gauge 3,
  `newsHealthy=false`, the vmalert rule present, the job bean absent with its switch off).
- L7 pure: `service/practice/{PenzPracticeTagTest,PenzPaperTradeMathTest,PenzPracticeCapTest,PenzWeeklyReviewTest,
  PenzPracticeCopyTest}` (the copy by case, the boundary words, numbers only from the computed week).
- L7 IT: `PenzPracticeApiIT` (plan → open → last close → close → overview / week / journal / Pénzem row; every
  out-of-order step 409; ≥ 1 known tag; the stop side; the cap 422 not borrowing and not raised by gains, the
  settings' practice amount = the allowance line; `clientRef` replay; owner isolation; `paper` everywhere; EUR twins).

- L7 pure: `service/proposal/{PenzMonthlyInvestableTest (the old suggestInvestment / pullForwardRoomMinor /
  planning averages vectors),PenzProposalSplitterTest,PenzProductOptionsTest,PenzProposalValidatorTest (by
  taxonomy),PenzProposalFallbackCopyTest,PenzProposalPromptTest}`.
- `.120` pure: `service/news/{PenzWeeklyReviewSectionerTest (week boundaries in his timezone, de-dup across days,
  fx / rates attribution, figures),PenzWeeklyReviewPromptTest (fences, an injected headline cannot break one, no stored
  prose, no dates),PenzWeeklyReviewValidatorTest (by taxonomy: sell / urge, an invented forint figure, a %, another
  sleeve's holding, a year, a URL…),PenzWeeklyReviewFallbackCopyTest (passes the validator),PenzWeeklyReviewAssemblerTest}`,
  `companion/llm/PenzWeeklyReviewFakeLlmTest`.
- `.120` IT: `PenzWeeklyReviewIT` (companion-fake + WireMock: last week's digests → the run builds one review, GET
  returns it, a second run does not duplicate, an obeying-injection answer → that sleeve falls back, empty week →
  quiet without a model call, pending before any, a failed week is rebuilt, owner isolation).
- L7 IT: `PenzProposalApiIT` (companion-fake: only approved products offered / accepted, every rule-breaking narration →
  fallback with figures unchanged, split rules, accept with his numbers + re-check, steps, supersede, dismiss, the
  monthly figure, seed once per owner, owner isolation, no money row written).

### 8.1 Oracle — the old app's 603 vitest cases

Counted 2026-11-19 (`it()` / `test()` per file). "Ported" = same vectors in a JUnit test; the target slice says
where the rest goes.

| Group (old file) | Cases | Ported in L4 | Rest → |
|---|---|---|---|
| `domain/allowance` | 17 | 17 | — |
| `domain/dates` | 5 | 5 | — |
| `domain/recurrence` | 7 | 7 | — |
| `domain/monthClose` | 9 | 9 | — |
| `domain/balances` | 7 | 7 | — |
| `domain/money` | 5 | 2 | 3 `formatMoney` → L5 iOS display |
| `domain/savings` | 6 | 2 (emergency fund) | 4 `allocateGoals` → L5 *mire gyűjtök* |
| `morningBrief/brief` + `analysis` | 37 + 24 | 15 (amount guard) | digest copy / analysis → L6 |
| `ingest-sms/logic` | 15 | 15 | — |
| `app/smsConversion` | 11 | 6 (+2 `dedupePending` replaced by the unique index, IT-covered); `.119`: +3 `matchInvestTxnForSms` (`PenzInvestSmsMatchTest`) | — |
| `app/runConvertSms` | 3 | 0; `.119`: 3 invest-buy adoption (`PenzSmsIngestApiIT`) | — |
| `app/materialize` | 5 | 5 | — |
| `data/fx` | 4 | 4 | — |
| `data/apiKeys` + `apiKeys.create` | 3 + 1 | 4 | — |
| `features/recurring/recurringMath` | 6 | 5 (1 unit + 4 in `PenzAllowanceApiIT`) | 1 frequency label → L5 |
| `features/plan/budgets` | 4 | 2 | 2 `upcomingOverrides` → L5 (CategoryBudgets on the wire) |
| `features/transactions/txLogic` | 14 | 2 (`needsHufRecompute`) | 12 keypad / display → L5 |
| `features/accounts/accountRules` | 16 | 14 | 2 `healAccounts` → never (impossible by the partial unique indexes) |
| `features/home/homeModel` | 15 | the perDay rule (no case 1:1) | Költés display model → L5 |
| `features/plan/advice`, `purchaseRecord` | 15 + 6 | 0 | → L5 *mire gyűjtök* |
| `features/sms/smsUi`, `lib/amountInput` | 2 + 2 | 0 | → L5 iOS |
| `data/investments`, `features/invest/{investModel,record,catalog}` | 16 + 24 + 17 + 11 | 0 (L6 re-specified, see below) | catalog curation → L7 |
| `shared/news` | 15 | 5 (L6: `parseFeed` ×3, seed list, `articleHostsFor`) | collect-prompt / labelling / due cases → never (no per-headline LLM labelling; the digest replaces it) |
| `shared/article` | 8 | 4 (L6: host allow-list, `htmlToText`, short page, chrome dropped) | 4 redirect / fetch-error cases → replaced by `PenzHttpFetcherTest` (redirects are never followed) |
| `collectNews/logic`, `quotes/logic`, `shared/chart`, `data/news`, `features/news/newsModel` | 20 + 6 + 8 + 3 + 30 | 0 | → re-specified in L6 (feeds, quotes, digest) or iOS display |
| `morningBrief/{analyze,logic,due}`, `shared/brief`, `app/briefSnapshot*`, `domain/briefSnapshotSync`, `features/settings/briefSettings`, `data/settings` | 13 + 16 + 7 + 8 + 3 + 4 + 1 + 5 + 3 | 0 | → L6 digest |
| `domain/invest`, `domain/planning`, `domain/guide`, `features/plan/{guideAi,planDraft,applyChanges}`, `features/invest/investAi` | 39 + 32 + 7 + 6 + 7 + 7 + 8 | 0 | → L7 practice / proposals / planning / invest suggestion |
| `morningBrief/push`, `data/push` | 13 + 11 | 0 | never (no push, spec §10.2.4) |
| `app/startup`, `data/export`, `features/auth/gateState` | 6 + 6 + 4 | 0 | never (Base44 plumbing; seeding / materialize-on-read cover startup) |

Total ported 1:1 in L4: **123** cases (allowance 17, dates 5, recurrence 7, monthClose 9, balances 7, money 2,
savings 2, guard 15, ingest 15, smsConversion 6 + 2 via IT, materialize 5, fx 4, apiKeys 4, recurringMath 5,
budgets 2, txLogic 2, accountRules 14). **L6 ports 9 more** (news 5, article 4) → **132**; **`.119` ports 6 more**
(`matchInvestTxnForSms` 3, `runConvertSms` 3) → **138**. Sum of the table's cases: 603.

**Honest note on L6.** The investing and news groups were mostly **re-specified, not ported**: the old app used a
pro-rata average cost (L6 is FIFO, lot-level), had no price / currency split, and labelled each headline with an LLM
(L6 matches deterministically and narrates once per digest). Their behaviour is covered by new tests written against
the build notes (`PenzLotsTest`, `PenzValuationTest`, `PenzPortfolioEngineTest`, the `service/news` suite), not by
the old vectors. `matchInvestTxnForSms` (3) and the `runConvertSms` invest-buy adoption (3) were ported with
`mezo-r36n9.119`.

## 9. Decisions, gotchas & deferred

- **One FX policy, stored twin** (§4.1) — decided once (plan §2.1), not per field.
- **Gyakorlás is its own line**, default 20 000 Ft / month (spec §10.1.2); the hard cap enforcement on trades is L7.
- **Previous deficit only from a real close**, months close oldest first (§3.3).
- **Guard: no derived sums** — stricter than the old app, which only capped figures at a limit.
- **perDay floors** to a whole minor unit (old app kept the fraction).
- **Rate limiter is in memory** — single replica; a second replica or a restart-sensitive limit needs a shared store.
- **`CategoryBudgets` is pure and tested but not on the wire** — the allowance contract has no room; L5's Terv screen.
- **No importer from the old app — not needed** (`mezo-r36n9.107`, closed 2026-11-20): the owner never used the
  Base44 app, so there is nothing to bring over; Boop Pénz started empty and the old app can be switched off
  (decision #65 in `14-decisions.md`).
- **Out of L4:** holdings, quotes, news (shipped in L6);
  invest-buy adoption on SMS (old `linkSmsToInvestBuy` / `matchInvestTxnForSms` — done in `mezo-r36n9.119`, §3.4);
  every iOS screen (L5).
- **L6 — valuation ≠ booking** (§4.1, §3.6): a holding's value is recomputed from the latest quote on every read;
  only what a trade cost is booked and stored.
- **L6 — "since the last look" = since the previous close**, labelled so; a per-view baseline would make the number
  depend on how often he opens the app.
- **Known, not fixed (security review, L6):** a company the owner does *not* hold, named in the narration as if it
  were his (Entity Swap only knows his own holdings — a heuristic would block ordinary news context); the DNS-
  rebinding window of the unpinned fetcher (§3.8, bounded by the allow-list); Google News receives his holdings'
  match terms as search queries (a design choice: names of products he holds, nothing else about him).
- **L6 — the strict validator means visible fallback.** Any number outside the figures, a "sell-off", a source domain
  like *portfolio.hu*, an index name with digits (*S&P 500*) or a careful "nem kell eladni" sends the item to fallback
  copy. Expect a noticeable share of `narratedBy: fallback` items in real use; loosening a rule needs a test that
  shows it cannot let an invented figure or a sell instruction through.
- **L6 — Google News stories have no body** (redirect links, never followed): narrated from headlines, confidence ≤ 1.
- **L6 — refresh limit and executor are in memory** (one replica): a restart resets the 15-minute limit; a full
  executor queue drops a run with a warning.
- **L6 — no admin alert screen**: the provider-down alert is the gauge + vmalert path (§3.11), since `feature/admin`
  left the server (#52, `mezo-r36n9.97.4`).
- **Done after L6 — `mezo-r36n9.119`:** linking an investment buy / sell to its money account (the linked
  `invest_buy` / `invest_sell` row, §3.6) and adopting a bank-SMS invest buy (§3.4 step 7, old
  `linkSmsToInvestBuy` / `matchInvestTxnForSms`). Decided here: a linked target that is not his is a 404, not a
  409; deleting a holding releases its rows like deleting each transaction.
- **Done after L6 — `mezo-r36n9.120`:** the **weekly long-horizon review** (§3.14, spec §5.1 designer's call —
  the daily digest never carries a call to act on the 5–10 / 10+ sleeves). Decided here: it reads only the stored
  digests (no fetch, no bodies, no stored prose), a `failed` week is rebuilt by the next run, no dates enter the
  prompt, `matters: true` must cite one of the section's own stories. **Its placement on the phone waits for the
  owner** — the server ships it, no iOS screen reads it yet.
- **Savings goals shipped in L5 as plain CRUD** (`mezo-r36n9.103`): `saved` is the owner's own figure, not linked to
  transactions or the savings-target account; the old app's `allocateGoals` / advice (§8.1) stay unported.

## 10. Key files

- Contract: `api/feature/penz/penz.yml`, `api/feature/penz/penz-sms.yml`, `api/feature/penz/penz-portfolio.yml` (L6),
  `api/feature/penz/penz-practice.yml` (L7), `api/feature/penz/penz-weekly.yml` (`.120`)
- L7 practice: `…/penz/service/practice/` (pure), `…/penz/service/PenzPracticeService.java`,
  `…/penz/controller/PenzPracticeController.java`, `…/penz/mapper/PenzPracticeMapper.java`,
  `…/202611202000_mezo-r36n9.105_penz_practice.sql`
- Schema: `backend/src/main/resources/db/changelog/1.1.0/script/202611191400_mezo-r36n9.102_penz.sql`, L6:
  `…/202611201600_mezo-r36n9.104_penz_portfolio.sql`, `.119`: `…/202611211400_mezo-r36n9.119_penz_invest_account_link.sql`
- Investment ↔ money account (`.119`): `…/penz/service/PenzInvestLinkService.java`,
  `…/penz/service/sms/InvestSmsMatch.java` (pure), the adoption in `…/penz/service/PenzSmsStore.java`
- L6 portfolio: `…/penz/service/portfolio/`, `…/penz/service/{PenzHoldingService,PenzInvestTxnService,PenzHoldingEventService,PenzPortfolioService,PenzQuoteService,QuoteClient,PenzProviderHealth}.java`,
  `…/penz/service/net/PenzHttpFetcher.java`, `…/penz/controller/PenzPortfolioController.java`
- L6 digest: `…/penz/service/news/` (pure), `…/penz/service/{PenzNewsClient,PenzDigestService,PenzDigestStore,PenzNewsRunner,PenzNewsJob,PenzDigestLlm}.java`,
  `…/penz/config/{PenzNewsProperties,PenzNewsAsyncConfig}.java`, `…/penz/controller/PenzNewsController.java`,
  `…/penz/mapper/PenzDigestMapper.java`, `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PenzDigestLlmAdapter.java`
- Alert: `k8s/monitoring/vmrule-mezo.yaml` (`PenzNewsProviderDown`, `PenzQuotesProviderDown`)
- Weekly review (`.120`): `…/penz/service/news/{WeeklyReviewSectioner,WeeklyFigures,WeeklySection,WeeklyModelSection,WeeklyReviewPrompt,WeeklyReviewValidator,WeeklyReviewFallbackCopy,WeeklyReviewAssembler}.java` (pure),
  `…/penz/service/{PenzWeeklyReviewService,PenzWeeklyReviewStore,PenzWeeklyReviewLlm}.java`,
  `…/penz/controller/PenzWeeklyController.java`, `…/penz/mapper/PenzWeeklyReviewMapper.java`,
  `…/penz/entity/{PenzWeeklyReviewEntity,PenzWeeklySectionJson}.java`,
  `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PenzWeeklyReviewLlmAdapter.java`, contract
  `api/feature/penz/penz-weekly.yml`, schema `…/202611211600_mezo-r36n9.120_penz_weekly_review.sql`
- L7 catalog + proposals: `…/penz/service/proposal/` (pure), `…/penz/service/{PenzCatalogService,PenzCatalogSeed,PenzProposalService,PenzProposalStore,PenzStrategyService,PenzProposalLlm}.java`,
  `…/penz/controller/PenzProposalController.java`, `…/penz/mapper/PenzProposalMapper.java`,
  `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PenzProposalLlmAdapter.java`, contract
  `api/feature/penz/penz-proposals.yml`, schema `…/202611202010_mezo-r36n9.105_penz_proposals.sql`
- Builder calls: [`2026-11-20-boop-penz-l6-build.md`](../superpowers/plans/2026-11-20-boop-penz-l6-build.md)
- Controllers / config: `backend/src/main/java/io/mrkuhne/mezo/feature/penz/controller/`,
  `…/penz/config/{PenzProperties,PenzSmsSecurityConfig,PenzSmsApiKeyFilter}.java`
- Pure core: `…/penz/service/money/`, `…/penz/service/engine/`, `…/penz/service/guard/HufAmountGuard.java`,
  `…/penz/service/sms/`
- Services: `…/penz/service/{PenzAllowanceService,PenzMonthCloseService,PenzRecurringMaterializer,PenzFxService,FrankfurterClient,PenzTransactionService,PenzAccountService,PenzSmsIngestService,PenzSmsKeyService,PenzSmsRateLimiter,PenzSmsStore,PenzSavingsGoalService}.java`
- LLM adapter: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PenzSmsLlmAdapter.java`
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/penz/`, `backend/src/test/resources/penz/`
