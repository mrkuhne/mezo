# Finance Tracker — read-only map

Source: read-only map of `/Users/mrkuhne/Applications/Personal/Finance Tracker/` as of 2026-11-13 (HEAD `c63ee38`, 120 commits, first commit 2026-11-01).

---

## 1. What it is, stack, deployment

**What it is.** A single-user personal finance PWA for the repo owner: it tracks accounts and
transactions (a large share arriving automatically from MBH Bank SMS via an iOS Shortcut), projects a
weekly and monthly "pocket money" allowance, plans big purchases with AI advice, tracks savings goals
and a hand-kept investment portfolio, and delivers an AI morning brief with Hungarian financial news.
All money is stored in minor units in its account's currency plus a HUF-valued twin field; HUF is the
base currency and the UI is English (news/brief AI text is Hungarian).

**Stack.**
- Backend/platform: **Base44** (entities + row-level security, auth, Deno backend functions, scheduled
  workflows, LLM gateway, hosting). App id `6ae79ac9c00f11f600c038fc`, visibility `private`.
- Frontend: Vite 6 + React 18 + TypeScript (strict) + Tailwind 3, `react-router-dom` 6 with a
  `BrowserRouter`, installable PWA via `vite-plugin-pwa` with a **custom `injectManifest` service
  worker** (`src/sw.ts`) for Web Push. No component library — hand-written CSS in `src/index.css`,
  hand-drawn SVG icon sprite (`src/features/shell/Icons.tsx`). Fonts: Instrument Serif + Schibsted
  Grotesk from Google Fonts.
- Tests: **Vitest**, 57 files / ~604 tests, all pure logic (`src/domain`, feature models,
  `base44/functions/*/logic.ts`). No component or e2e tests.
- Auth: Base44 built-in, email+password **and** Google login enabled (`base44/auth/config.jsonc`).
- ~17.3k lines of TS/TSX across `src/` + `base44/`.

**Deployment.** `npm run deploy` = `base44 deploy --yes --build`; the plain `npm run build` bundle
lacks the injected Base44 app id, so production login loops (documented in `CLAUDE.md`). Base44 hosts
the built site; backend functions deploy from `base44/functions/<name>/entry.ts`; the two scheduled
workflows from `base44/workflows/*.json`. Secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`) live in the Base44 secret store (`base44:runtime`). Local dev: `base44 dev`
(`.claude/launch.json`, port 5173). Git workflow: commit straight to `main`, no PRs.

---

## 2. Data model

19 Base44 entities + the extended `User`. All live **in the Base44 cloud** (managed Postgres-like
store; no local DB, no copy in the repo). There is **no fixture, seed or export file in the repo** —
the only seeded rows are 15 default categories (client, `ensureDefaultCategories`) and 8 news sources
(server, `SEED_SOURCES`). Export is available in-app (see §8).

**RLS pattern.** Two shapes:
- *Client-owned* entities: `create: true`, `read/update/delete: {created_by_id: {{user.id}}}`.
- *Server-owned* entities (`create: false`, read filtered by `data.owner_id`): `SmsMessage`,
  `NewsItem`, `NewsSource`, `DailyDigest`, `AiUsage`, and `PushSubscription` (client-creatable,
  no update). Functions additionally cross-check `owner_id === created_by_id` before trusting a row.

### Core money

| Entity | Fields (type) | Notes |
|---|---|---|
| **Account** | `name` str*, `type` enum(checking/savings/cash/investment)*, `currency` str*, `opening_balance_minor` int*, `is_default` bool, `is_savings_target` bool, `archived` bool, `sms_sender` str\|null | user-scoped |
| **Category** | `name` str*, `kind` enum(expense/income)*, `icon` str, `monthly_budget_minor` int\|null | user-scoped; 12 expense + 3 income defaults seeded (Groceries, Dining out, Transport, Housing, Utilities, Subscriptions, Health, Shopping, Entertainment, Travel, Gifts, Other; Salary, Bonus, Other income) |
| **Transaction** | `account_id` str*, `kind` enum(expense/income/transfer_out/transfer_in/invest_buy/invest_sell)*, `amount_minor` int*, `currency` str*, `amount_huf_minor` int*, `category_id` str\|null, `date` date*, `note` str\|null, `source` enum(manual/sms/recurring)*, `needs_review` bool, `recurring_rule_id` str\|null, `transfer_pair_id` str\|null, `sms_message_id` str\|null | the spine of everything; transfers are two rows sharing `transfer_pair_id` |
| **RecurringRule** | `name`*, `kind` enum(expense/income)*, `amount_minor` int*, `currency`*, `amount_huf_minor` int*, `category_id` str\|null, `account_id`*, `frequency` enum(weekly/monthly/yearly)*, `start_date` date*, `end_date` date\|null, `last_materialized_date` date\|null, `active` bool | |
| **MonthClose** | `month` `YYYY-MM`*, `final_remaining_minor` int*, `deficit_minor` int*, `leftover_action` enum(transferred/kept/none)*, `transfer_pair_id` str\|null | one per closed month |
| **FxRate** | `pair` str*, `date` date*, `rate` number* | per-date cache of `<CUR>HUF` from frankfurter.dev; user-scoped (one cache per user) |

### Plan / savings

| Entity | Fields |
|---|---|
| **PurchasePlan** | `title` str*, `needed_by` date\|null, `status` enum(considering/decided/bought/dropped)*, `selected_option_id` str\|null, `planned_month` str\|null, `transaction_id` str\|null, `recurring_rule_id` str\|null, `advice` object\|null (stored AI advice: `{fingerprint, generated_at, advice}`) |
| **PurchaseOption** | `plan_id`*, `name`*, `price_minor` int*, `currency` enum(HUF)*, `payment` enum(one_time/installments)*, `installment_minor` int\|null, `installment_count` int\|null, `link` str\|null, `note` str\|null, `position` int* |
| **SavingsGoal** | `name`*, `kind` enum(emergency/custom)*, `target_minor` int\|null, `account_id`*, `priority` int*, `icon` str |

### Investing

| Entity | Fields |
|---|---|
| **Holding** | `asset_type` enum(bond/etf/stock/crypto)*, `product_id` str* (catalog id), `name`*, `ticker` str\|null, `platform` enum(mbh/revolut/other)*, `platform_name` str\|null, `currency`*, `bond_rate_pct` number\|null |
| **InvestmentTransaction** | `holding_id`*, `side` enum(buy/sell)*, `amount_huf_minor` int*, `quantity` number\|null, `price` number\|null, `currency`*, `date` date*, `account_id`*, `transaction_id`* (the paired Transaction row) |
| **PriceQuote** | `ticker`*, `price` number*, `currency`*, `as_of` date* — cache of Yahoo chart prices |

### SMS / automation

| Entity | Fields |
|---|---|
| **ApiKey** | `name`*, `key_hash`* (SHA-256 of `ft_<base64url32>`), `last4`*, `owner_id`*, `revoked` bool, `last_used_at` dt\|null |
| **SmsMessage** | `owner_id`*, `sender`*, `text` str\|null, `text_hash`* (sha256 of `sender|text`), `received_at` dt*, `status` enum(parsed/ignored/failed/converted)*, `reason` str\|null, `kind` enum(expense/income), `amount_minor` int\|null, `currency` str\|null, `merchant` str\|null, `date` date\|null, `category_name` str\|null, `transaction_id` str\|null |
| **PushSubscription** | `owner_id`*, `endpoint`*, `p256dh`*, `auth`*, `device_name`, `active` bool*, `last_error` str\|null |

### News / brief / AI budget

| Entity | Fields |
|---|---|
| **NewsSource** | `owner_id`*, `name`*, `url`*, `default_tags` str[], `active` bool, `last_fetched_at` dt\|null, `last_error` str\|null |
| **NewsItem** | `owner_id`*, `source_id`*, `source_name`, `title`*, `link`*, `published_at` dt\|null, `title_hu` str\|null, `summary` str\|null, `tags` str[], `affects_portfolio` bool, `ai_done` bool, `analysis` object\|null (the per-item Hungarian analysis) |
| **DailyDigest** | `owner_id`*, `date` date*, `numbers` object, `notification` str\|null, `what_happened` str\|null, `this_month` str\|null, `news_ids` str[], `incomplete` bool, `ai_ok` bool, `push_status` enum(sent/failed/skipped), `push_error` str\|null |
| **AiUsage** | `owner_id`*, `date` date*, `collect` int, `brief` int, `analyze` int — per-day LLM call counters |

### User (settings live on the auth user, written with `auth.updateMe`)

`base_currency` (HUF), `monthly_savings_target_minor`, `monthly_investment_amount_minor` (null =
auto-suggest), `emergency_fund_months` (default 6), `week_start` (monday), `digest_time` (HH:MM),
`digest_enabled`, `news_interval_hours` (2/4/8/12), `timezone`, `month_overrides`
(`{YYYY-MM: {savings_target_minor?, category_budgets?{catId: minor}}}`), `invest_suggested_log`
(`{YYYY-MM: minor}`), `brief_snapshot` (object, see below), `has_expensive_debt` bool\|null,
`guide_cache`, `invest_cache`, `risk_profile` enum(cautious/balanced/bold), `risk_checkin_at`.

**`brief_snapshot`** is the one bridge from client to server: the client writes it on every app
start/resume and after relevant writes (`src/app/briefSnapshot.ts`), because the backend brief
function cannot run the client's allowance math. Shape: `{month, computed_at, suggestion{kind,
amountMinor, source}, split{bond,etf,stock,crypto}|null, emergencyDone, remainingMinor,
dailySpendMinor, holdings[{holding_id,name,asset_type,quote_symbol,currency,costMinor,valueMinor}]}`.
It is duplicated field-for-field in `base44/functions/morningBrief/brief.ts`, kept in sync by a
compile-time test (`src/domain/briefSnapshotSync.test.ts`).

---

## 3. Screens / routes

Five bottom tabs: **Home `/`**, **Activity `/transactions`**, **Plan `/plan`**, **Invest `/invest`**,
**News `/news`**. A floating "+" (quick add) shows only on Home and Activity. Settings open from the
Home avatar. All routes (`src/App.tsx`):

| Route | What the user sees / can do |
|---|---|
| `/` **Home** | Month name title. "Left this week" hero (remaining, week range, per-day left, 7-day bar chart with a daily-share marker), "Left this month" card with progress bar, a month-close banner when a past month is unclosed (move leftover to Savings / keep / already overspent), an "N from SMS to check" banner, account balances strip with total, Recent transactions list. Tapping either number opens the breakdown. |
| `/breakdown` | "Where the numbers come from": the full allowance derivation (recurring income, one-off income, recurring expenses, savings target, investments, previous deficit, free, spent). |
| `/transactions` **Activity** | All transactions, grouped/filtered; edit/delete; quick-add sheet; link to Recurring. |
| `/recurring` | Recurring rules list + sheet to add/edit (name, amount, currency, category, account, frequency, start/end, active). |
| `/plan` **Plan** | Purchase plans (active + done) with status pills (Idea / Comparing N / Decided · month / Bought / Dropped), price or price range; Savings card with emergency-fund ratio; "Smart money guide — you are on step N of 5" banner; link to Category budgets. "+" creates a plan. |
| `/plan/new`, `/plan/:id/edit` | Create/edit a plan: title, needed-by date, and its options (name, price, one-time vs installments + instalment/count, link, note). |
| `/plan/:id` | Purchase impact: per option — left this month after buying, how much comes from savings, monthly cost, the earliest safe month; mark bought/dropped. |
| `/plan/:id/advice` | AI recommendation: recommended option, best month, why not the others, and up to 3 proposed changes (lower a category budget, lower the savings target, postpone) applicable "just for this month" or "from now on". |
| `/guide` | Smart money guide: 5 steps (track → emergency fund → no expensive debt → invest monthly → passive income), each with status and an AI tip; answer the expensive-debt question. |
| `/budgets` | Category budgets: per expense category budget vs spent vs left, month-only override marker. |
| `/savings` | Savings account balance, planned monthly saving, goals with progress bars and ETA, create/edit/delete goals, set up the emergency fund, "Changes for one month" (overrides) with reset, transfer history. |
| `/invest` **Invest** | Portfolio value, gain since start, allocation bar + legend with target shares per asset type, holdings list, the month's suggested amount and split, AI intro, risk check-in prompt ("How did the ups and downs feel?" → bolder / keep). Empty state when there are no holdings. |
| `/invest/type/:type` | Asset-type page: what it is, where to buy it (MBH / Revolut / other, in plain language), catalog products, AI text, "I bought this" buy sheet. |
| `/invest/holding/:id` | One holding: value, return, quantity, platform, bond rate; sell sheet; delete; a calm note when it is ≥15% under cost. |
| `/news` **News** | Today's morning-brief card (or "the brief is off" / "arrives at HH:MM"), tag filter chips, news list (Hungarian title, summary, source, age, "affects your money" chip). |
| `/news/:id` | One news item: Hungarian analysis — *about*, *impact on your holdings/forint/rates*, verdict (buy / wait / nothing to do) with an amount and catalog product when buying, reason; "analyse now" action. |
| `/brief/:date` | A full morning brief: numbers, what happened, this month's money, cited news; "Incomplete" pill when prices were missing. |
| `/accounts` | Accounts list with balances; add/edit (name, type, currency, opening balance, default, savings target, archived, SMS sender). |
| `/review/:id` | "Check SMS": confirm/adjust an SMS-created transaction (category, account, amount, note) or delete it. |
| `/settings` | Monthly plan (save every month, emergency fund months, timezone), Investing (monthly amount, risk profile), Accounts link, Automation (SMS automation, Morning brief), Data (Export everything JSON / Export transactions CSV), Sign out. |
| `/settings/sms` | SMS automation: create/copy/revoke the personal `ft_…` key, the 7-step iOS Shortcut recipe, endpoint URL, "Send a test message" with a sample MBH SMS, recent messages with status pills. |
| `/settings/brief` | Morning brief on/off, delivery hour (whole hours only), news collection interval (2/4/8/12 h), enable notifications (Web Push permission + subscription), send a test push, AI daily-cap state. |
| `*` | "Not found". |

---

## 4. Imports

**There is no bank-file, CSV, receipt or statement import.** Revolut CSV import is an explicit
non-goal in the v1 spec ("később jöhet"). The only automatic inbound path is **bank SMS**:

- **Transport:** an iOS Shortcut automation on the owner's iPhone triggers on a message from sender
  `MBH Bank` and POSTs `{text, sender, received_at?}` as JSON to
  `https://<app-host>/functions/ingest-sms` with header `X-Api-Key: ft_…` (or
  `Authorization: Bearer ft_…`). The screen `/settings/sms` prints the exact recipe and the URL.
- **Parsing path:** `base44/functions/ingest-sms/entry.ts` + `logic.ts`.
  1. Key check — SHA-256 of the key matched against `ApiKey.key_hash`, must be unrevoked and
     `owner_id === created_by_id`; otherwise 401 before the body is read.
  2. Body validation: `text` required, ≤1000 chars; `sender` ≤100 chars (default `unknown`);
     `received_at` defaults to now.
  3. Dedupe by `text_hash = sha256(sender|text)`; a repeat returns `{status:'duplicate'}` (re-checked
     after the slow LLM call).
  4. Cheap regex pre-filter `looksLikeMoney` (number next to `HUF|Ft|EUR|USD|GBP|CHF|€|$`); a miss is
     stored as `ignored/no_amount` **with the text dropped**.
  5. The owner's category names are loaded.
  6. One LLM call (Base44 `InvokeLLM`, default cheap model, JSON schema `PARSE_SCHEMA`) with a
     Hungarian-bank-SMS prompt that encodes the mapping rules: *"terhelés"/"vásárlás"/minus →
     debit; "jóváírás"/"érkezett" → credit*; merchant cleaned of store numbers and city
     ("ALDI 152. BUDAPEST" → "Aldi"); category chosen only from the user's own list; OTP codes,
     login notices, marketing and balance-only texts → `is_transaction:false`.
  7. `normalizeParsed` guards the output: amount > 0 and ≤ 1e9 major units, currency in
     {HUF,EUR,USD,GBP,CHF}, merchant ≤80 chars, date must be real and within ±7 days of the SMS
     date (else the SMS date in Europe/Budapest), category matched case-insensitively.
  Result rows: `parsed` (with the text kept), `ignored` (text nulled), `failed` (reason:
  `llm_error`/`bad_shape`/`bad_amount`/…). The function **never** writes a Transaction.
- **SMS → Transaction** happens client-side on app start (`src/app/runConvertSms.ts`,
  `smsConversion.ts`): pick the account by matching `sms_sender`, else the default, else the first
  non-archived; convert the amount into the account currency via cached FX; map the AI's category
  name to a real category; note = `merchant · <original amount if converted>`; `source:'sms'`,
  `needs_review:true`, `sms_message_id` linked, and the SmsMessage flips to `converted`. Pending
  messages are deduped per `text_hash` (oldest wins). A previously recorded `invest_buy` on the same
  account, same `amount_minor`, within ±3 days and with no SMS attached is adopted instead of
  creating a second expense.

---

## 5. AI features

Every call goes through the **Base44 LLM gateway** (`integrations.Core.InvokeLLM`) with a
`response_json_schema` — so costs are Base44 credits from the owner's workspace, shared with another
project. Two model tiers: the SMS parse and the news labelling use the gateway's cheap "Automatic"
default (no `model` field); everything else pins **`claude-sonnet-5`**. Daily caps are counted in
`AiUsage`.

| # | Feature | Where it runs | Model | Prompt shape | Cost shape |
|---|---|---|---|---|---|
| 1 | **SMS parsing** | backend `ingest-sms` | default (cheap) | Hungarian bank SMS + the user's category names → `{is_transaction, direction, amount, currency, merchant, date, category}` | 1 call per money-looking SMS; pre-filter kills the rest |
| 2 | **News labelling** (`buildCollectPrompt`) | backend `collectNews` | default (cheap) | ≤40 headlines as one JSON-line list + holdings identifiers → per item `{i, title_hu, summary(≤160), tags(from 11 fixed tags), affects_portfolio}`; headlines explicitly marked untrusted | **1 call per collect run**, cap `COLLECT_DAILY_CAP = 10`/day |
| 3 | **Morning brief** (`buildBriefPrompt`) | backend `morningBrief` | `claude-sonnet-5` | Hungarian brief; holdings with day/week moves, portfolio week change, EUR/HUF, this month's suggested/invested/left/pull-forward room, ≤15 picked news with ids → `{notification(≤180 chars, ≤2 sentences), what_happened(2-4 sentences), this_month(1-3), news_ids}` | **1 call per day**, cap `BRIEF_DAILY_CAP = 2`/day |
| 4 | **Per-item news analysis** (`buildAnalysisPrompt`) | backend `morningBrief {action:'analyze'}` | `claude-sonnet-5` | Title + summary + (optionally) fetched article text, holdings, this month's budget → `{about, impact, reason, verdict: buy\|wait\|none, amount_huf, product}` | on demand, cap `ANALYZE_DAILY_CAP = 20`/day; result cached on `NewsItem.analysis` |
| 5 | **Purchase advice** (`buildAdvicePrompt`) | **client** (`src/data/ai.ts`) | `claude-sonnet-5` | English; lettered options with their computed impacts, remaining, set-aside, savings target, emergency months, category budgets+spend → `{recommended_option, best_month, summary, others, changes[≤3]}` | on demand; cached on `PurchasePlan.advice` keyed by a fingerprint of the inputs |
| 6 | **Smart money guide tips** (`buildGuidePrompt`) | **client** | `claude-sonnet-5` | English; aggregated numbers + the 5 steps with statuses → `{intro, tips[{step,text}]}` | cached in `User.guide_cache` under a bucketed key |
| 7 | **Investment split explanation** (`buildInvestPrompt`) | **client** | `claude-sonnet-5` | English; month, risk profile, emergency status, amount, split per asset type with holdings, plus the full hand-checked catalog → `{intro, bond/etf/stock/crypto: {text, product_id}}` | cached in `User.invest_cache` keyed by month+amount+profile+costs |

**Safety machinery around the AI (notable, and reusable).**
- Every model output passes a normalizer that drops malformed shapes; nothing is shown raw.
- **Amount guards:** `hufAmountsMinor()` parses forint amounts out of the generated Hungarian text
  (including "1,5 millió Ft", "10e Ft", "2 Mrd") and nulls any text naming an amount above what the
  month allows; a `buy` verdict is downgraded to `wait` with a canned reason. Products must be exact
  catalog names.
- Prompt-injection defence: feed titles, summaries and fetched article bodies are labelled untrusted
  in the prompt; the brief may only cite news ids from the supplied list.
- Tone rules, repeated verbatim across prompts: calm, never suggest selling, "nothing to do today" is
  a complete answer, never invent numbers, educational not advice.
- **SSRF-guarded article fetch** (`base44/shared/article.ts`): only the allow-listed hosts of the
  item's own seed source, redirects followed manually with a host re-check each hop (max 3), 10 s per
  hop, 2 MB body cap, HTML stripped to ≤12 000 chars, ≥600 chars required or the summary is used.
- No transactions, notes or raw personal rows are ever sent to a model — only aggregates, holdings
  identifiers and category names.

---

## 6. Backend functions, workflows, scheduled jobs

**Functions** (`base44/functions/`, Deno, each `entry.ts` + a dependency-free `logic.ts` so Vitest can
cover it):

| Function | Trigger | What it does |
|---|---|---|
| `ingest-sms` | HTTP POST from the iOS Shortcut, API-key auth | §4 above. Returns `parsed`/`ignored`/`failed`/`duplicate`; never 500s on an LLM failure. |
| `quotes` | HTTP POST from the client, signed-in users only | 1–20 ticker symbols (`^[A-Za-z0-9.\-=^]{1,20}$`) → Yahoo Finance chart API (`chartUrl`), returns `{quotes:[{symbol,price,currency,as_of}], failed:[]}`. The client caches into `PriceQuote`. |
| `collectNews` | scheduled workflow + `{action:'now'}` | Seeds any missing of the 8 RSS sources, dedupes sources by URL, **interval gate** (`news_interval_hours`, ±10 min jitter slack), fetches feeds in batches of 6 (10 s timeout, 2 MB cap, regex RSS/Atom parsing — Workers have no DOMParser), creates ≤40 new items deduped by link, runs **one** AI labelling call within the daily cap, then deletes items older than `NEWS_RETENTION_DAYS = 30` (oldest-first paging, ≤5 pages × 500). |
| `morningBrief` | scheduled workflow + `{action:'now'\|'test'\|'analyze'}` | `scheduled/now`: skip if today's digest exists; require a snapshot or a push subscription; due when local time ≥ `digest_time` in the user's tz. Then: read this month's buys, fetch day/week moves for the holdings' symbols (or VWCE.DE as a market reference when there are none), fetch EUR/HUF (and USD/HUF if needed) from frankfurter.dev, pick ≤15 news, make one AI call, normalize, create the `DailyDigest` (deduped per date), and send Web Push to every active subscription (VAPID via `jsr:@negrel/webpush`, 10 s timeout; 404/410 deactivates the subscription). `test`: resend the latest digest. `analyze`: the per-item news analysis (§5.4). |

**Workflows** (`base44/workflows/`):

| Workflow | Cron (Europe/Budapest) | Action |
|---|---|---|
| `news-collect` | `0 */2 * * *` (every 2 h) | invoke `collectNews`; the real cadence is gated inside by `news_interval_hours` |
| `morning-brief` | `0 * * * *` (hourly) | invoke `morningBrief`; the function decides whether the user's digest hour has passed (hence whole-hour delivery times only) |

**Client-side "jobs"** on app start/resume (`src/app/startup.ts`): seed default categories, materialize
due recurring transactions (single-flight, idempotent), convert pending SMS, refresh the brief
snapshot.

---

## 7. Categorisation / budgets / recurring / goals — the actual rules

**Categorisation.** Only two sources: the user picks a category manually, or the SMS LLM picks a name
from the user's own list and the client maps it case-insensitively (no match → `category_id: null`,
"Uncategorised"). There are **no rules, no merchant memory, no learning**.

**The allowance (the core engine, `src/domain/allowance.ts`).**
- `recurringTotal` never rewrites the past: every rule-linked transaction dated in the month counts at
  *its own* amount, plus the *current* amount of each not-yet-materialized occurrence of an active
  rule (after `last_materialized_date` and with no linked txn on that date). Occurrences on or before
  `last_materialized_date` with no txn were deliberately skipped and never materialize.
- `freeMinor = recurringIncome + oneOffIncome − recurringExpenses − savingsTarget − invest_buy total − previousDeficit`.
- `spentMinor` = expenses **not** linked to a recurring rule (`isSpend`). `remaining = free − spent`.
- Weekly: the week is split into per-month portions; each portion =
  `floor(remainingAtWeekStart × daysInWeekInThatMonth / daysToMonthEnd)`, floored at 0; days before the
  current month are excluded (they belong to a closed month). Budget = sum of portions.
- `savingsTargetFor(month)` prefers `month_overrides[month].savings_target_minor`.

**Month close** (`monthClose.ts`, Home banner): every complete month after the earliest data month
without a `MonthClose` row is offered. `leftover = max(0, remaining)`, `deficit = max(0, −remaining)`;
the leftover can be transferred to the savings account (writes a transfer pair) or kept; the deficit is
carried into the next month as `previousDeficitMinor`.

**Budgets** (`budgets.ts`). Per expense category: `effectiveBudget = month_overrides[month]
.category_budgets[catId] ?? category.monthly_budget_minor` (null = no budget). Spent counts **every**
expense of the month including recurring ones (unlike the allowance's `isSpend`). Rows are ordered by
the default category order then by name. Overrides for the current and later months are listed and
resettable on the Savings screen.

**Recurring** (`recurrence.ts`, `app/materialize.ts`). Weekly = every 7 days from `start_date`;
monthly/yearly = the start day clamped to the month length (31 → 30/28). `dueOccurrences` covers
`(last_materialized_date+1 … today]` for active rules only. Materialization is idempotent (it re-reads
the date range and skips dates that already have a txn for that rule), converts FX at the occurrence
date, writes `source:'recurring'`, `needs_review:false`, and advances `last_materialized_date`.

**Savings goals** (`savings.ts`). `emergencyTarget = emergency_fund_months × avgMonthlyExpenses`.
Goals are filled in `priority` order from their account's balance, treated as a shared pool per
account — so a lower-priority goal only sees what the higher ones left. `monthsCovered`,
`monthsToReach = ceil(gap / monthlyRate)`.

**Planning** (`planning.ts`). "Complete months" start at the earliest non-recurring transaction (that
month counts only if the txn is on the 1st). `typicalMonthlySpend` / `avgExpenses` / `avgIncome` =
average of the **last 3** complete months, falling back to an extrapolation of the current month.
`dailySpend = max(this month's pace so far, complete-month average / 30)`.
`setAside = max(0, nextMonthFree − typicalSpend)`. `simulateOption` computes left-this-month,
how much comes out of savings, monthly cost, and the earliest safe month (scanning up to
`SAFE_HORIZON_MONTHS = 24`).

**Guide** (`guide.ts`). 5 steps, each `done/now/todo`: (1) ≥1 month tracked, (2) emergency fund full,
(3) `has_expensive_debt === false`, (4) an `invest_buy` this or last month, (5) passive income —
never done.

**Investing** (`invest.ts`, `INVEST_RULES`).
- Suggested monthly amount: an explicit setting wins; else needs ≥1 tracked month;
  `available = min(avgIncome − avgExpenses − savingsTarget, freeBeforeInvest)`; share **25 %** before
  the emergency fund is full, **60 %** after; last month's overspend above the suggestion trims it
  (capped at half, `OVERSPEND_CAP_SHARE = 0.5`); rounded down to 1 000 Ft.
- Split by risk profile: cautious 50/35/8/7, balanced 35/45/12/8, bold 15/45/25/15
  (bond/etf/stock/crypto). The split is by **deficit against the target mix** after the new money, then
  parts below the minimum ticket (bonds 100 000 Ft, others 2 000 Ft) are folded into the biggest other
  part and flagged `tooSmall`.
- Valuation: bonds accrue `cost × (1 + rate × days/365)` per lot; market products need a quote **and**
  a known quantity, else they show at cost with "Price not updated". Sells shrink lots
  proportionally. `isBigDrop` at ≤ −15 % triggers the calm note.
- Risk check-in: for cautious/balanced profiles, 3 months after the first buy (or last check-in).
- Pull-forward room (`shared/brief.ts`): 0 until the emergency fund is done; else
  `min(floor(suggested × 0.5) − excessAlreadyInvested, remaining − dailySpend × daysLeft)`, floored at 0.
- The **catalog** (`src/features/invest/catalog.ts`) is a hand-checked, dated (2026-11-03) list of 8
  products — MÁP Plusz, FixMÁP, VWCE, EUNL, AAPL, MSFT, BTC, ETH — each with platform, plain-language
  summary, risk, Yahoo symbol, bond rate, minimum, source URL. The AI may name nothing outside it.

---

## 8. Data volume & migration surface

**Volume.** Not discoverable offline, and no API was called. Evidence in the repo:
- **No seed, fixture, backup or export file exists** (`.gitignore` excludes nothing relevant; the only
  JSON data in the repo are the workflow definitions and lockfiles).
- The SDD progress log records the first live scheduled brief on **2026-11-06** reading
  `no_data, 0 holdings, invested 0` — i.e. at that point the production user had **no complete tracked
  month and no investments**. The app itself is only ~12 days old.
- Soft caps in the code suggest the expected scale: transactions are read with `MAX = 5000` in one
  page; news items are capped at 2000 known links / 500 pending, 30-day retention, ≤40 new items per
  run (~150–250/day across the 8 feeds). `FxRate` and `PriceQuote` are small caches.
- Reasonable expectation: a few hundred transactions at most, a handful of accounts, 15 categories,
  0–few holdings, a few thousand transient NewsItems, one DailyDigest/day.

**What an export looks like.** Settings → *Export everything (JSON)* produces
`finance-export-<date>.json`: `{exported_at, version:1, accounts, categories, transactions,
recurring_rules, month_closes, purchase_plans, purchase_options, savings_goals, holdings,
investment_transactions, settings}` — i.e. **all durable user data**. Settings → *Export transactions
(CSV)* produces `transactions-<date>.csv` with header
`date,account,kind,amount,currency,amount_huf,category,note,source` (RFC 4180 quoting plus
spreadsheet-formula neutralisation). On an installed iOS PWA the file goes through the share sheet.

**Not covered by the export** (would need a separate pull if wanted): `SmsMessage` history,
`NewsItem`/`NewsSource`/`DailyDigest`/`AiUsage`, `PushSubscription`, `ApiKey`, `FxRate`,
`PriceQuote`, and the User-field caches (`brief_snapshot`, `guide_cache`, `invest_cache`,
`invest_suggested_log`, `month_overrides` — the last two *are* inside `settings`).

**What has no obvious equivalent elsewhere** (the real porting cost, roughly in order):
1. The **allowance engine** — the weekly/monthly pocket-money math with month-portioning, the
   "never rewrite the past" recurring rule, deficit carry-over and month close. Pure, well-tested
   TypeScript (`src/domain/*`, ~1 800 lines incl. tests) — portable as logic, but there is no
   equivalent concept in Mezo.
2. The **SMS ingestion pipeline** — API key issuance + hashing, the iOS Shortcut contract, the
   Hungarian MBH SMS prompt and its guards, dedupe by text hash, and the client-side
   SMS→Transaction conversion with invest-buy adoption. Needs a replacement HTTP endpoint and key
   store on a Spring backend; the Shortcut on the phone can keep working if the URL/header shape is
   preserved.
3. The **AI amount guard** (`hufAmountsMinor` + `withinLimits`/`normalizeAnalysis`) — Hungarian
   number-form parsing to stop the model naming an amount the budget does not allow. Nothing like it
   exists elsewhere and it is cheap to port.
4. The **investment catalog + split rules + bond accrual valuation** — hand-curated, dated, and the
   whole AI investing surface depends on it.
5. The **news pipeline** — 8 seed RSS feeds, regex feed parsing (no DOMParser), 30-day retention, the
   SSRF-guarded article fetch, the Hungarian labelling/analysis prompts, and the per-day AI caps.
6. **Web Push from the server** — VAPID keys live in Base44 secrets; the subscription rows and the
   iOS "Home Screen app only" handling would move to APNs in a native app (and the whole
   `PushSubscription`/service-worker layer then disappears).
7. **Base44-specific** and therefore non-portable as-is: RLS JSON on entities, `auth.me/updateMe` as
   the settings store (all User fields), `integrations.Core.InvokeLLM` with `response_json_schema`,
   backend functions, scheduled workflows, hosting, and the credit-based LLM billing.
8. Free external dependencies that carry over unchanged: **frankfurter.dev** (FX) and the
   **Yahoo Finance chart endpoint** (quotes).

---

## 9. What is half-built / TODO / broken

**Never built at all**
- **The conversational AI assistant** (spec §6.9: a Base44 agent with entity/function tools and an
  "Ask" button in the prototype). No `base44/agents/` folder, no chat screen, no plan document. It is
  the one v1 goal with nothing shipped; plans 1–5b stop before it.
- Bank/Open Banking integration, Revolut CSV import, native app, desktop layout, multi-user — all
  explicit non-goals of v1.
- User-editable news sources: the spec promised the user would add/edit RSS URLs; the implementation
  hard-codes 8 seed sources and **refuses to fetch any URL that is not a seed URL**
  (`planFetch`/`isKnownSourceUrl` marks others `unknown source`). The `NewsSource` entity is
  updatable by the user, but editing a URL silently disables that source.
- `AiUsage.analyze` exists as a field; the collect/brief paths only maintain `collect` and `brief`
  (the create calls pass `{collect:0, brief:0}`).

**Shipped but not deployed**
- HEAD `c63ee38` ("malformed news id returns not_found instead of 500") is committed and pushed but
  the SDD log ends with *"Not deployed: the live fix needs `npm run deploy`"*. So production still
  returns a 500 for a malformed news id. The working tree is otherwise clean (only an untracked
  `deno.lock`).

**Known weak spots recorded in the SDD logs as "minor (deferred)"**
- `htmlToText` regexes can be slow on adversarial ~2 MB bodies (allow-listed hosts only); no
  content-type check; the entity decoder has drifted between `article.ts` and `news.ts` (`nbsp`).
- The `AiUsage` increment is silently skipped when the just-created row is not yet visible (no
  fallback, no log) — an AI call can go uncounted.
- `validAnalysis` accepts an amount/product on `wait`/`none`, and a `buy` with no amount.
- `forDisplay` blanks *any* forint-naming reason when the analysis is stale, even a still-valid lower
  amount; the "no suggested amount" hint was called misleading before a late fix.
- `ANALYSIS_SCHEMA` uses a nullable integer (`type: ['integer','null']`); acceptance by the Base44
  `InvokeLLM` gateway was only to be confirmed live — a failing analyse call is the stated risk.
- `productNames` duplicates `briefCatalogNames` logic; the analysis `"""` article fence is not escaped.
- News-screen behaviours are untested (no component-test pattern): an `inFlight` ref is shared across
  ids, a failed refresh replaces a good analysis with an error card, a `listNewsByIds` rejection is
  swallowed.
- `FxRate` is deliberately **not** written by the brief function (its rows are client-owned under RLS),
  so the server re-fetches FX every run.

**Structural / operational risks named in the spec**
- The Base44 backend is in beta and holds financial data — hence the export requirement and the
  advice to back up regularly. There is no automated backup; the export is a manual button.
- LLM credits are shared with the owner's other Base44 project; the daily caps (10 collect / 2 brief /
  20 analyse) are the only cost control, and the spec asks for the first weeks' consumption to be
  measured and the cadences tuned. No measurement is recorded.
- The `brief_snapshot` bridge means the morning brief is **stale whenever the owner has not opened the
  app this month** — the prompt then forbids discussing the month's money and only asks him to open
  the app. The whole server-side brief depends on client activity.
- Whole-hour brief delivery only, because the workflow ticks hourly.
- Catalog rows (rates, platforms) are hand-checked and dated `2026-11-03`; nothing re-checks them.
