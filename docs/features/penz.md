---
title: Pénz — the money foundation (Boop Pénz L4)
type: feature-domain
status: done
updated: 2026-11-19
tags: [backend, boop, penz, data-layer, auth]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/penz
  - api/feature/penz/penz.yml
  - api/feature/penz/penz-sms.yml
  - backend/src/main/resources/db/changelog/1.1.0/script/202611191400_mezo-r36n9.102_penz.sql
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PenzSmsLlmAdapter.java
  - backend/src/test/java/io/mrkuhne/mezo/feature/penz
related: [boop-ios, _platform-api-backend, _platform-auth-security, companion, dayclose]
---

# Pénz — the money foundation (Boop Pénz L4) — Feature Documentation

> Backend feature, no screen yet; its future client is **Boop**'s Pénz area (L5). Backend ✅ done (2026-11-19,
> `mezo-r36n9.102`, slice **L4 · adatalap**) · iOS: none until L5 (`mezo-r36n9.103`) · web: none (retired, #52).
> Two API tags: `Penz` (JWT) and `PenzSms` (the bank-SMS ingest, own API-key auth).

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

Driving docs: spec [`2026-11-13-boop-penz-design.md`](../superpowers/specs/2026-11-13-boop-penz-design.md) §6, §7,
§9, §10.1; plan [`2026-11-19-boop-penz-plan.md`](../superpowers/plans/2026-11-19-boop-penz-plan.md) §2; the old-app
map [`02-finance-tracker-map.md`](../superpowers/research/boop-life/02-finance-tracker-map.md).

## 2. User-facing behavior

Nothing visible on the phone yet. What the owner can already rely on:

- An **iOS Shortcut** forwards each bank SMS to the server; a money SMS becomes a transaction marked *needs review*
  within seconds, a replay never doubles it, an OTP / marketing SMS is dropped without keeping its text (§3.4).
- `GET /api/penz/allowance` answers "how much is left this week, and today" with the full derivation — the
  numbers L5's **Költés** page will print.
- Recurring items appear as transactions on their due date the next time anything reads the money (no cron).
- Past months close **oldest first**, a leftover optionally moved to the savings-target account.

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
| 6 | `invested` | the month's `invest_buy` total (an `invest_sell` is never income) |
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

`ignored` SMS drop their text; `failed` ones keep it for review. Response:
`{status: parsed|ignored|failed|duplicate, transactionId?, reason?}` with reasons `no_amount`, `not_a_transaction`,
`llm_error`, `amount_mismatch`, `bad_*`, `no_account`, `fx_unavailable`, `amount_too_small`.

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
- **Valuation is a different thing**: valuing a holding at today's rate (L6 portfolio) does not go through this
  policy and will be documented as its own.

The engine works only on the HUF twins; the allowance is HUF-based. Money on the wire is
`PenzMoney {minor: int64, currency, hufMinor: int64}`.

### 4.2 Endpoints

Contract-first: [`api/feature/penz/penz.yml`](../../api/feature/penz/penz.yml) (tag `Penz`, JWT) and
[`penz-sms.yml`](../../api/feature/penz/penz-sms.yml) (tag `PenzSms`), both in `api/generate/merge.yml`.

| Method · path | What |
|---|---|
| `GET`/`PUT /api/penz/settings` | settings (created with defaults on first access) |
| `GET`/`POST /api/penz/accounts`, `PUT /api/penz/accounts/{id}`, `POST …/{id}/archive` | accounts with the flag rules |
| `GET`/`POST /api/penz/categories`, `PUT …/{id}` | categories (15 defaults seeded) |
| `GET /api/penz/transactions?month=` · `POST` · `PUT`/`DELETE …/{id}` · `POST …/{id}/reviewed` | one month newest first (materializes first); idempotent create on `clientRef`; soft delete |
| `POST /api/penz/transfers` | a transfer pair, idempotent on `clientRef` |
| `GET`/`POST /api/penz/recurring-rules`, `PUT`/`DELETE …/{id}` | recurring income and fixed costs (delete keeps produced txns) |
| `GET /api/penz/allowance?date=` | month + week (`perDay`) + the 10 `lines[]` (materializes first) |
| `GET /api/penz/month-closes` · `GET …/open` · `POST …/{month}` | closed months; open months with the figures a close would store; close (`leftoverAction`) |
| `POST /api/penz/sms/ingest` | the Shortcut (API key, §3.4) |
| `GET`/`POST /api/penz/sms/keys`, `DELETE …/{id}` | key management (JWT; plaintext once) |

Error codes (both bundles): `PENZ_ACCOUNT_NOT_FOUND`, `PENZ_CATEGORY_NOT_FOUND`, `PENZ_CATEGORY_NAME_TAKEN`,
`PENZ_TRANSACTION_NOT_FOUND`, `PENZ_RECURRING_RULE_NOT_FOUND`, `PENZ_TRANSFER_SAME_ACCOUNT`, `PENZ_FX_UNAVAILABLE`,
`PENZ_MONTH_NOT_OVER`, `PENZ_EARLIER_MONTH_OPEN`, `PENZ_MONTH_ALREADY_CLOSED`, `PENZ_LAST_ACTIVE_ACCOUNT`,
`PENZ_NO_SAVINGS_TARGET_ACCOUNT`, `PENZ_SMS_KEY_NOT_FOUND`, `PENZ_SMS_KEY_INVALID`, `PENZ_SMS_RATE_LIMITED`,
`PENZ_CURRENCY_MISMATCH`, `PENZ_CLIENT_REF_CONFLICT`.

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

All registered in `support/ResetDatabase`; test rows through `PenzPopulator`.

## 5. Integrations

- **Companion → LLM (SMS parse).** Penz owns the port `PenzSmsLlm`; `feature/companion/llm/PenzSmsLlmAdapter` adapts
  it on the cheap tier (the `DayCloseLlm` precedent, ADR 0008/0012: `LlmCallContext` tag `penz_sms/parse`, budget
  gate, audit). Penz never imports companion.
- **Auth platform.** The ingest's own filter chain sits beside the main JWT chain; the synthetic principal keeps
  `CurrentUser` / `created_by` unchanged — see [`_platform-auth-security.md`](_platform-auth-security.md).
- **frankfurter.dev** (outbound HTTP, `FrankfurterClient`, `OffClient` shape: explicit timeouts, typed error).
- **Boop iOS (L5).** The Pénz area will read `allowance`, transactions, month closes, and write cash expenses through
  the outbox with `clientRef`; the iOS openapi-generator filter is untouched in L4.
- **Later Boop money text (L6+).** Every generated sentence with a forint figure must pass `HufAmountGuard.verdict`
  against the computed inputs (spec §6: the model narrates figures computed elsewhere).

## 6. How to use it (consume)

From another backend feature: none yet — no other feature reads Pénz in L4. From a client: call the endpoints above
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

## 8. Testing

Backend only (`-Dmezo.test.use-testcontainers=true`, `ArchitectureTest` in the `-Dtest` list):

- Pure / ported: `PenzAllowanceEngineTest`, `PenzDatesTest`, `PenzRecurrenceTest`, `PenzMonthCloseTest`,
  `PenzBalancesTest`, `PenzEmergencyFundTest`, `PenzAccountRulesTest`, `PenzCategoryBudgetsTest`,
  `PenzRecurringMathTest`, `PenzMoneyTest`, `PenzFxConversionTest`, `PenzFxServiceTest`, `PenzTxLogicTest`,
  `HufAmountGuardPortedTest` + `HufAmountGuardTest`, `service/sms/*` (ingest logic, conversion, keys, amount check).
- ITs: `PenzApiIT` (CRUD, ownership, `clientRef`, transfers, the FX policy incl. cache / fallback / 503, account
  flags, close guards), `PenzAllowanceApiIT` (10 lines with Gyakorlás and a real-close deficit, week + perDay,
  materialization), `PenzMonthCloseServiceIT`, `PenzSmsIngestApiIT` (chains, rate limit, dedupe, pre-filter, fake
  LLM, conversion). frankfurter.dev is always WireMock; every figure is invented.

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
| `app/smsConversion` | 11 | 6 (+2 `dedupePending` replaced by the unique index, IT-covered) | 3 `matchInvestTxnForSms` → L6 |
| `app/runConvertSms` | 3 | 0 | 3 invest-buy adoption → L6 |
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
| `data/investments`, `features/invest/{investModel,record,catalog}` | 16 + 24 + 17 + 11 | 0 | → L6 investing (catalog curation L7) |
| `collectNews/logic`, `quotes/logic`, `shared/{news,article,chart}`, `data/news`, `features/news/newsModel` | 20 + 6 + 15 + 8 + 8 + 3 + 30 | 0 | → L6 news |
| `morningBrief/{analyze,logic,due}`, `shared/brief`, `app/briefSnapshot*`, `domain/briefSnapshotSync`, `features/settings/briefSettings`, `data/settings` | 13 + 16 + 7 + 8 + 3 + 4 + 1 + 5 + 3 | 0 | → L6 digest |
| `domain/invest`, `domain/planning`, `domain/guide`, `features/plan/{guideAi,planDraft,applyChanges}`, `features/invest/investAi` | 39 + 32 + 7 + 6 + 7 + 7 + 8 | 0 | → L7 practice / proposals / planning / invest suggestion |
| `morningBrief/push`, `data/push` | 13 + 11 | 0 | never (no push, spec §10.2.4) |
| `app/startup`, `data/export`, `features/auth/gateState` | 6 + 6 + 4 | 0 | never (Base44 plumbing; seeding / materialize-on-read cover startup) |

Total ported 1:1 in L4: **123** cases (allowance 17, dates 5, recurrence 7, monthClose 9, balances 7, money 2,
savings 2, guard 15, ingest 15, smsConversion 6 + 2 via IT, materialize 5, fx 4, apiKeys 4, recurringMath 5,
budgets 2, txLogic 2, accountRules 14). Sum of the table's cases: 603.

## 9. Decisions, gotchas & deferred

- **One FX policy, stored twin** (§4.1) — decided once (plan §2.1), not per field.
- **Gyakorlás is its own line**, default 20 000 Ft / month (spec §10.1.2); the hard cap enforcement on trades is L7.
- **Previous deficit only from a real close**, months close oldest first (§3.3).
- **Guard: no derived sums** — stricter than the old app, which only capped figures at a limit.
- **perDay floors** to a whole minor unit (old app kept the fraction).
- **Rate limiter is in memory** — single replica; a second replica or a restart-sensitive limit needs a shared store.
- **`CategoryBudgets` is pure and tested but not on the wire** — the allowance contract has no room; L5's Terv screen.
- **Out of L4:** the one-shot **importer** from the old app (its data is in Base44's cloud; L5 cut-over, bd
  `mezo-r36n9.107`); **savings goals / purchase plans** (*mire gyűjtök*, L5); holdings, quotes, news (L6);
  **invest-buy adoption on SMS** (old `linkSmsToInvestBuy` / `matchInvestTxnForSms`, L6); every iOS screen (L5).

## 10. Key files

- Contract: `api/feature/penz/penz.yml`, `api/feature/penz/penz-sms.yml`
- Schema: `backend/src/main/resources/db/changelog/1.1.0/script/202611191400_mezo-r36n9.102_penz.sql`
- Controllers / config: `backend/src/main/java/io/mrkuhne/mezo/feature/penz/controller/`,
  `…/penz/config/{PenzProperties,PenzSmsSecurityConfig,PenzSmsApiKeyFilter}.java`
- Pure core: `…/penz/service/money/`, `…/penz/service/engine/`, `…/penz/service/guard/HufAmountGuard.java`,
  `…/penz/service/sms/`
- Services: `…/penz/service/{PenzAllowanceService,PenzMonthCloseService,PenzRecurringMaterializer,PenzFxService,FrankfurterClient,PenzTransactionService,PenzAccountService,PenzSmsIngestService,PenzSmsKeyService,PenzSmsRateLimiter,PenzSmsStore}.java`
- LLM adapter: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/PenzSmsLlmAdapter.java`
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/penz/`, `backend/src/test/resources/penz/`
