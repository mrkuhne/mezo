# Boop Pénz — personal finance + the AI investing companion (design)

- **Status:** draft, awaiting the owner's approval · **Date:** 2026-11-13 · **Issue:** `mezo-r36n9.33` · **Epic:** `mezo-r36n9`
- **Evidence:** old-app map [`02-finance-tracker-map.md`](../research/boop-life/02-finance-tracker-map.md),
  prior art [`04-invest-prior-art.md`](../research/boop-life/04-invest-prior-art.md),
  UI direction [`03-ui-direction.md`](../research/boop-life/03-ui-direction.md).
- **Builds on:** `2026-11-11-boop-standalone-design.md` (the spine: Ma · Terv · Napló · Boop + `+`),
  `2026-11-10-boop-napkelte-design.md` (the Napkelte look), and the area-page pattern from the life-dashboard
  rounds (own masthead with the living orb, own five-item bottom bar, head dissolving into the page,
  the living background down the whole scroll).
- **Supersedes** `2026-11-13-boop-life-dashboard-design.md` **§3.4** (the Pénz room as tabs
  *Ma · Keretek · Előzmények · Tervezett*, with no investing companion) and reshapes its slices **L4/L5** (§11).
  Its §4.5 (what is worth porting from the old app, and what is not) stays valid and is the porting list here.

## 1. Intent

**Pénz** is the fifth life area of Boop: one place for the owner's money, with an AI companion that watches the
news every day and helps him invest across four horizons. It replaces the standalone Base44 finance app
(`/Users/mrkuhne/Applications/Personal/Finance Tracker/`) entirely — data and all.

The point is not a better portfolio tracker. The point is that **one AI sees money next to sleep, food, training
and mood**, so Boop can connect "you spent a lot eating out the week you slept badly" — and so the owner has one
app and one login instead of two.

**The owner's words that define it:** „personal finance és AI befektetési tanácsadót akarok aki minden nap
figyeli a newst és segít befektetni" · „Boop álljon elő javaslattal, és én igazítok rajta" · „ezeket én fektetem
be és itt vezetem, **az app csak segít benne, tehát ő nem kezel pénzt**".

## 2. Owner decisions (2026-11-13) — do not re-litigate

1. **Four horizons, and the split is per horizon** — Gyakorlás (day trading) · 1–3 év · 5–10 év · 10+ év.
   The same instrument means different things in different sleeves, so there is no single risk profile for one pot.
2. **The app never handles money and never buys.** The owner invests himself, through his own platforms, and
   records it in Boop. No broker connection, no order placement, ever.
3. **Day trading is learning, not earning** — half an hour in the morning or the afternoon, **~20 000 Ft/month**,
   for fun. The cap is hard and cannot borrow from the long-horizon money. It starts as a **paper-trading
   practice run** („a papír nélküli próba jó, kezdjük azzal").
4. **Long horizons are occasional, not automatic.** A bigger sum arrives, or the owner says he wants to invest →
   Boop researches and proposes a split → **Boop proposes, he adjusts**.
5. **Plus a monthly recurring strategy**, computed from salary and actual spending, as the old app does.
6. **An ordinary day says so.** „Ma nincs dolgod" is a complete answer — with the month's standing visible and the
   daily news digest still delivered, tied to his actual holdings, without nudging him to touch the long money.
7. **Spending capture stays on the bank-SMS path**, made seamless, plus fast manual entry for cash.
   A bank (open-banking) connection is researched separately and may replace it later; **the screens do not change
   either way**, so it does not block this design (§10).
8. **Five pages:** `Ma · Pénzem · Költés · Gyakorlás · Boop`. The news digest lives at the bottom of **Ma**
   (not its own page). The fourth page is named **Gyakorlás**.
9. **Purchase planning and savings goals are kept** from the old app, as a "mire gyűjtök" block under **Költés**.
10. **The weekly remainder is the headline number** of Költés — „ezen a héten még 34 500 Ft-od van" — exactly as
    the old app computes it. The month's standing and the category breakdown live on cards below it.
11. **The practice money is a separate world.** It is *not* part of the Pénzem total; Pénzem carries one quiet
    row at the bottom ("Gyakorlás: 20 000 Ft bent, +1 200 Ft ›"). Rationale: losses are the price of learning and
    must not read as damage to his wealth, and 20 000 Ft is noise next to the serious money.
12. **Proposals name concrete products, always with two or three options and the why** — not one name, not
    categories only. Each option carries what it is, how the options differ, what they cost, and that this is
    not an instruction.
13. **The migration is the chosen approach** (§4): the money logic and the data move into the Mezo backend and
    native Boop pages. The old app becomes the specification, not a dependency.

## 3. Goals, non-goals, anti-goals

**Goals**
- One app, one login, one AI that sees money alongside the rest of his life.
- The daily question answered in one number: can I spend this now?
- An investing companion that does the research he does not want to do, per horizon, and explains itself.
- A day-trading practice loop he actually keeps: plan before · one line after · weekly review.
- Every figure on screen computed by the backend, never by a language model.

**Non-goals**
- Executing trades, moving money, or connecting a broker.
- Multi-user, multi-account, or anything shareable (sharing changes the regulatory perimeter, §6).
- Tax reporting, performance attribution, dividend forecasting (the tracker-market feature floor,
  `04-invest-prior-art.md` §2) — not now.
- Real-time quotes or a live tape. Delayed/EOD prices are enough for everything here.
- Budget envelopes per category as a control mechanism. Categories inform; the weekly remainder decides.

**Anti-goals — this ships and is still a failure if…**
- …Boop ever reads as urging a trade, or as promising a return.
- …a number on screen is wrong or stale and nothing says so. A missing figure beats a confident wrong one.
- …the daily digest makes him touch the 10+ year money.
- …recording a cash expense takes more than a few seconds, so he stops doing it and the weekly number lies.
- …the practice journal needs more than three taps after a trade.

## 4. Approaches considered

| | What it is | Why not / why |
|---|---|---|
| **A. Migrate into the Mezo backend** ✅ **chosen** | The money domain becomes a backend feature module with its own tables; Boop's Pénz pages are native SwiftUI; the old app's logic (allowance engine, amount guards, prompt-injection labelling, SSRF-guarded fetch, AI prompts) is re-implemented from its map. | One account, one database, one AI with memory across all areas. The largest build, and the safety machinery must be rebuilt — but it is well documented in the old app and is portable logic, not platform code. |
| **B. Keep the Base44 app as the engine; Boop displays it** | Boop calls the Base44 app's API and renders its numbers. | Days instead of weeks, but: two systems, two logins, the owner's money data stays outside Boop's memory so the "one AI" promise breaks, and he stays dependent on a third-party platform from which the data can only be hand-exported. Rejected by the owner. |
| **C. Fresh design, ignoring the old app** | Build the money domain from first principles. | Discards 604 passing tests' worth of validated logic — above all the allowance engine and the amount guards — and the owner's own working habits. Folded into A: the old app *is* the spec. |

**Correction to what the owner was told in the brainstorm.** I said his data would "obviously" be carried over.
That overstates it: the old app is twelve days old and, per `2026-11-13-boop-life-dashboard-design.md` §4.5,
**practically empty — no complete tracked month and no investments recorded.** So this is a **rebuild whose
specification is the old app**, not a data migration. Whatever rows do exist come over as a one-off,
re-runnable, idempotent import from the app's own export (`02-finance-tracker-map.md` §8) — never a hand-written
SQL load — and his real holdings are entered once, by hand, as part of setting up the sleeves. Nothing he sees
changes either way; the word was wrong, not the plan. **Verify the export's actual contents before writing the
importer** (§10.5): if it really is near-empty, the importer may not be worth building at all.

## 5. The area — five pages

The area page skeleton is the one approved in the life-dashboard rounds: masthead with the area's big living orb
and the score inside it over a fading rule → eyebrow row (`PÉNZ · <open page>`) → photo head dissolving into the
page → content cards on the living background → the area's own five-item bottom bar.

### 5.1 Ma — „mi a dolgom ma?"

1. **Verdict.** One sentence. On most days: „Ma nincs dolgod a pénzeddel." When there is something: one thing
   only, with a primary button („Rögzítsd a hétvégi készpénzt", „Lejárt egy állampapírod — mi legyen vele?").
2. **A hónap állása**, one line: the weekly remainder and the month's remainder, tappable into Költés.
3. **A napi hírösszefoglaló** — the bottom block, and the reason he opens this page on a quiet day.
   - Only stories touching **his actual holdings**, plus a short macro section (HUF, rates, energy) when it
     moves something he owns.
   - Each item: what happened · **how it touches him, with the computed figure** · the source(s) and the date.
   - Stories about the same event from several sources are grouped into one item with a source count
     (M1's pattern, `04-invest-prior-art.md` §1).
   - **Relevance filter**, adapted from M1's published criteria: does it change industry structure · is it a
     lasting regulatory or technological change · does it meaningfully affect long-run financials. Reactionary
     short-term noise is dropped.
   - **Designer's call** (not the owner's): the daily digest reports *what moved and how it touches him*; the
     long-horizon "what actually matters" verdict is the **weekly** review, because the cadence is the filter
     (M1 chose weekly for exactly this reason). The daily block therefore never carries a call to act on the
     5–10 or 10+ sleeves.

### 5.2 Pénzem — the portfolio, by horizon

- **Hero:** total value, change since the last look, and the date the prices are from (stale prices say so).
- **Three sleeves** (1–3 év · 5–10 év · 10+ év), each a card: value, what is in it, and the sleeve's own
  honest measure — for the long sleeve **years of coverage, not today's per cent**
  (`04-invest-prior-art.md` §3: the long bucket's number is not a return figure, so the page cannot invite churn).
- **Holdings** under each sleeve: name, platform (MBH / Revolut / other), value, share of the sleeve.
- **A forward timeline** of portfolio events (bond maturities, earnings, ex-dividend) — the one idea worth taking
  from the tracker market.
- **Bottom:** the quiet Gyakorlás row (decision 11).
- **Actions:** record a buy/sell (he already did it on his platform); „Van egy nagyobb összegem" → the proposal
  flow (§5.5).

### 5.3 Költés — the weekly remainder and where the money goes

- **Hero:** „Ezen a héten még **34 500 Ft**-od van" · per-day figure · the week's bar with the daily-share marker.
  Computed by the ported allowance engine (`02-finance-tracker-map.md` §: income − fixed costs − savings target
  − the investment share − previous deficit = free; free − spent = remaining; portioned across weeks).
- **„Honnan jön ez a szám?"** — the full derivation, kept from the old app's breakdown page. This is what makes
  the hero trustworthy.
- **A hónap állása** card, with the month-close ritual (move the leftover to savings / keep it / it was overspent).
- **Mi ment el mire** — category breakdown.
- **„Mire gyűjtök"** — savings goals and purchase plans (decision 9), each with where it stands and, for a
  purchase, Boop's advice: which option, which month, what it pushes out.
- **Capture:** the SMS-ingested rows needing review („N üzenet ellenőrzésre vár") and a fast manual entry for
  cash — the few-seconds path the anti-goals demand.

### 5.4 Gyakorlás — day trading as learning

The primitives are the journal literature's, and they need only entry, exit and stop, all typed by the owner
(`04-invest-prior-art.md` §5):

- **Plan before:** what · why · **where I get out** (the stop). No plan, no trade — the page says so.
- **Journal after:** one line, a **small fixed tag set** (8 tags, deliberately not 20), and a **mistake flag**.
  One trade ID per position, never per fill.
- **The unit of review is R** (P/L ÷ initial risk), so position size stops hiding the truth.
- **Weekly review by Boop:** what worked · win rate by setup · is the R distribution healthy · **this week's most
  common mistake and what it cost**. Under ~50 tagged trades the page states plainly that the numbers are noise.
- **The 20 000 Ft cap** is enforced and visible; it cannot borrow from the other sleeves.
- **Phase 1 is paper trading:** real prices, no real money, same screens. The owner's decision 3.

### 5.5 Boop — the money conversation, and the proposal flow

- Ordinary chat about money, in the one Boop voice, with his whole context available.
- **The proposal flow** („Van egy nagyobb összegem" / „Be akarok fektetni"): Boop researches, then proposes a
  split **per horizon**, with **two or three concrete products per sleeve**, what each is, how they differ, what
  they cost, and the why — then the owner adjusts the numbers and accepts. What he accepts becomes a plan he can
  tick off as he executes it himself.
- **The monthly recurring strategy** (decision 5) is proposed the same way, computed from salary and actual
  spending, and re-proposed when the spending picture changes materially.

## 6. Boundaries — and the copy rules they imply

Owner-confirmed rules (2026-11-13). Every string on every Pénz screen is written to these:

1. Boop **never buys and never moves money.** The owner acts; Boop records.
2. Boop **never urges.** No „most kell lépni", no countdowns, no streaks on money.
3. Boop **never promises a return.**
4. Boop **never says sell.** When something falls, it explains why; it does not send him to sell.
5. **„Ma nincs dolgod" is a complete answer.** Most days it is the answer.
6. Boop **always says why**, and where it could be wrong.

**The architectural rule behind all of it** (`04-invest-prior-art.md` §4): **the model narrates figures computed
elsewhere.** Prices, P&L, percentages and allowances are computed by the backend and passed through verbatim,
each with a citation and a date stamp. No free-text numeric answers about the portfolio. The old app's
amount-guard machinery (parse every HUF figure out of generated Hungarian text and verify it against the computed
inputs) is ported and extended; so are its prompt-injection labelling of untrusted feed text and its SSRF-guarded
article fetch. Evaluation uses the error taxonomy from the research: **Entity Swap · Numerical Error ·
Negation Flip · Temporal Confusion**.

**Regulatory perimeter.** ESMA's definition of investment advice hinges on there being a *client*; a tool one
person builds and uses alone, serving nobody else, is outside the regulated activity, and disclaimers do not
settle it either way (`04-invest-prior-art.md` §7). **This holds only while the app serves one person.** Sharing
Pénz with anyone — a second account, a TestFlight tester, a published build — changes the perimeter and must be a
new owner decision, not a deployment detail. MNB confirmation for Hungary was not found and is listed as an open
item (§10).

## 7. Data

Modelled on the old app's 19 entities (`02-finance-tracker-map.md` §2), reshaped for four horizons. Money is
stored in **minor units in its own currency plus a HUF-valued twin**, as the old app does; HUF is the base.

**This introduces the first money abstraction in the Mezo backend.** Today there is no `Money` type, no
minor-unit convention, no currency enum and no FX anywhere: the only persisted price is
`pantry_item.price_huf` as a whole-forint `Integer`, and the only currency code lives in the LLM pricing
snapshot (USD). Multi-currency arithmetic does not exist. A portfolio with USD/EUR tickers against HUF accounts
therefore needs a deliberate value type and a conversion policy (which rate, as of when, stored or derived)
designed up front rather than discovered per field — the single largest piece of new platform work in this area.

| Group | What it is modelled on | Change from the old app |
|---|---|---|
| Accounts & money | `Account`, `Category`, `Transaction`, `RecurringRule`, `MonthClose`, `FxRate` | unchanged in substance |
| Plan & savings | `PurchasePlan`, `PurchaseOption`, `SavingsGoal` | unchanged |
| Investing | `Holding`, `InvestmentTransaction`, `PriceQuote` | **`Holding` gains a horizon/sleeve**; the sleeve, not a global risk profile, drives proposals |
| Day trading | *new:* a paper-trade plan + journal entry (entry, exit, stop, tags, mistake flag, one id per position) | new area |
| News & AI | `NewsSource`, `NewsItem`, `DailyDigest`, `AiUsage` | digest gains the relevance filter and per-item "how it touches me" figures |
| Ingestion | `SmsMessage` | the ingest endpoint and the iOS Shortcut path are kept |

**Never stored or sent anywhere:** bank credentials, card numbers, platform logins. The owner's real figures never
appear in commits, docs, prototypes or Notion — prototypes use real-*looking* content, and Notion examples are
invented and marked „például".

## 8. Prior art

Summarised in [`04-invest-prior-art.md`](../research/boop-life/04-invest-prior-art.md); what this design takes:

1. **M1 News Snapshot** — top holdings only, one item per story with a source count, published relevance
   criteria, and *weekly* for the long horizon. Adopted in §5.1.
2. **Bucket/sleeve theory** (Kitces, Avantis, Morningstar) — the value is behavioural: the near sleeve visibly
   covering the next years is what stops a panic sale of the long one. No app UX prior art exists, so §5.2's
   sleeve cards are original work; the honest long-sleeve measure is **years of coverage**.
3. **Numeric hallucination evidence** — domain fine-tuning made it worse, multi-document summarisation is the
   worst case, and a market digest *is* multi-document. Hence §6's architectural rule.
4. **Trade-journal literature** — one id per position, small tag vocabulary, R-multiple, a review ritual separate
   from the journal, sample-size honesty. Adopted wholesale in §5.4.
5. **Non-broker trackers** — the feature floor; only the forward event timeline is worth taking. Corporate
   actions need manual reconciliation in every one of them: a real running cost of any self-kept ledger.
6. **Market data:** EODHD is the one verified EU-broad source with **news on every plan including free**
   (free sandbox 20 calls/day, 15-min delay; $19.99/mo for EOD + live). The old app's free path — Yahoo chart
   endpoint + RSS + frankfurter.dev for FX — already works and costs nothing. **Budapest/HUF coverage is
   unconfirmed** (§10).

## 9. Codebase terrain

From the recon of 2026-11-13. Entry points: `docs/CODEMAP.md`, `docs/features/_platform-api-backend.md`,
`docs/features/boop-ios.md`.

**The module.** `feature/dayclose` (slice B3, ten files) is the template to copy file for file:
`config/DayCloseProperties` · per-aggregate `entity/` + `repository/` · `service/` (incl.
`DayCloseLlm`, the consumer-owned LLM port) · `mapper/DayCloseMapper` (MapStruct) ·
`controller/DayCloseController implements DayCloseApi`. The layout is mandated by
`docs/references/java_package_structure.md` and enforced by `ArchitectureTest` **on the leaf package**
(`@RestController`→`..controller..`, `@Service`→`..service..`, `@Entity`→`..entity..`, repositories→`..repository..`),
plus: no feature cycles (frozen ArchUnit store — a `penz`↔`x` pair fails), method-level `@Transactional` only, no
Spring `@Value` (use a `@Validated @ConfigurationProperties` record), controllers must implement the generated
`<Tag>Api`, no raw `RuntimeException` outside techcore. Owned tables extend `OwnedEntity`/`OwnedRepository`
(`created_by`/`is_deleted`/`created_at`, `@SQLDelete`+`@SQLRestriction`); **`OwnedRepository.findAllOwned` needs an
`e.date` field**, so date-less aggregates (accounts, holdings) take bespoke finders like
`feature/goal/repository/GoalRepository`.

**Scheduled work.** `@EnableScheduling` is gated on `mezo.techcore.scheduling.enabled`, which **must stay false in
tests** (a live tick deadlocks against `ResetDatabase`'s TRUNCATE for the rest of the JVM). Every cron job carries
two switches (feature + `mezo.techcore.cron.<x>-job.enabled`). Canonical shape:
`feature/character/service/CharacterCouncilJob` — `@Scheduled(cron=…, zone=…)` with the real body in a
package-visible overload taking an explicit `ZonedDateTime` so tests pin the clock, catch-up over N days, per-day
try/catch, idempotent inner service, attempt counters. Per-user work goes through
`feature/auth/service/UserFanOut.forEachActiveUser` (ACTIVE + onboarded, each user wrapped in
`LlmActorContext.runAs`, one failure never aborts the run) — never `findAll()`. **The scheduler pool is size 1**:
a job doing outbound I/O must hand the work to an `@Async` executor (`NotificationDispatchJob` precedent) or it
starves every other cron.

**External HTTP.** The whole repo has three outbound clients. Copy `feature/pantry/service/OffClient` for the
shape (`RestClient.Builder` + a `*Properties` record, explicit connect/read timeouts, typed `SystemMessage` on
failure, "no result" is an empty list not an error) and `feature/pantry/service/WebPageClient` for the
**SSRF guard** a quote/news fetcher must reuse: http/https only, public hosts only, **redirects never followed**,
and a body cap enforced while streaming. There is **no URL allow-list** and **no retry logic anywhere** — both are
new work here. Tests use `wiremock-standalone` with a `@DynamicPropertySource` base-url override
(`PantryImportApiIT`).

**AI.** One seam, `feature/companion/CompanionLlm`, with `FakeCompanionLlm` under the `companion-fake` profile so
ITs never hit the network. A feature declares its **own narrow port** in its own `service/` package and the
adapter lives in `feature/companion/llm/` (ADR 0012; copy `DayCloseLlm` + `DayCloseLlmAdapter`). **Prompts are
Java constants** in the feature's `service/` package (`feature/boop/service/BoopPrompts`); JSON-answer prompts
keep their schema inline (`ScrapeExtractionService`). Model choice goes through `LlmModelRouter`
(tier × provider × `CallKind`). Three accounting layers, all required: `LlmCallContext`
(feature/operation/entity, written to `llm_log_history` and priced), `LlmBudgetGate`/`LlmBudgetService` (spend
ceiling, `isThrottled(feature)`), and `LlmCallQuota` (bounded work per run). Chat/memory entry points:
`ChatService`/`ChatStreamService`, `ContextSnapshotAssembler`, `MemoryContextService`/`MemoryRecallService`,
`BoopDayContext`; a domain becomes answerable in chat by registering a tool in `feature/companion/tools/` —
which **may not depend on an HTTP client** (ArchUnit IDENT-2), so a news fetcher cannot live there.

**Untrusted text is unhandled terrain.** Every existing "sanitize" guards the model's *output*, not its input; the
closest precedent (`WebPageClient → HtmlNutritionStripper → ScrapeExtractionService`) hands stripped HTML to the
model raw and defends downstream with a strict JSON schema, a deterministic validator and a manual-review
fallback. **News-article bodies would be the first genuinely adversarial external text in the app** — §6's
labelling and isolation convention is new work, with no in-repo pattern to copy.

**Contract.** Contract-first: write `api/feature/penz/penz.yml`, then **append it to `api/generate/merge.yml`
before the `output:` line** (omission is silent — the endpoints simply never appear), regenerate the committed
`api/openapi.yml` and `frontend/src/data/_client/api.gen.ts`, add every new error code to **both**
`messages_hu.properties` and `messages_en.properties`, add each `operationId` to `filter.operations` in
`ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml`, run `ios/scripts/sync-openapi.sh` (`--check` is the
staleness gate), and wrap each call in a `BoopCore` model with a `StubTransport` test. **One controller per tag**
(`skipDefaultInterface`): if Pénz wants separate accounts / portfolio / news controllers, each needs its own
fragment and tag (`CompanionFeedback` precedent). `enum` on a *request* field is a 500 — use `pattern` on
requests, `enum` only on responses.

**Database.** New work goes in `db/changelog/1.1.0/`: a changeSet `id: "1.1.0:<timestamp>_<bd-id>_<name>"` pointing
at one `script/*.sql`. Copy `202611121120_mezo-r36n9.13_day_close.sql` for the house style (uuid default,
`created_by` FK on delete cascade, `is_deleted`, named constraints, `jsonb not null default '[]'`, a `client_ref`
for idempotent phone writes, a partial unique index `where is_deleted = false`). `ddl-auto: validate` — entity and
DDL must match exactly. **Register every new table in the same change** in `support/ResetDatabase` (the TRUNCATE
list) and add a `support/populator/<X>Populator` wired into `AbstractIntegrationTest` + `DatabasePopulator`.
**Traps:** a bare `?` in changelog SQL is a JDBC placeholder and kills the whole changelog (use
`jsonb_exists(col,'key')`) — relevant because transactions, holdings and digests all want jsonb; `@SQLRestriction`
hides soft-deleted rows from derived finders, so a dedup-by-external-id upsert (SMS ingest) must use native
`ON CONFLICT` (`feature/wearable` precedent); and whole-row upserts overwrite every column, so a sender that knows
only part of a transaction must not use one.

**No API-key authentication exists.** `SecurityConfig` permits only `/api/auth/login` and `/api/auth/register`
unauthenticated; everything else is a JWT bearer resolved to `CurrentUser`. The SMS-ingest endpoint the iOS
Shortcut posts to is therefore **either a new auth mechanism** (filter, matcher, secret handling, rate limiting,
and it must still resolve an owner for `created_by`) **or a 30-day JWT carried in the Shortcut** — the
zero-new-mechanism option, at the cost of a silent sign-out when it expires (there is no refresh). This is the one
place where "make the SMS path seamless" (decision 7) has real cost, and it belongs in the first Pénz slice.

**Observability.** There is no alerting pipeline: `feature/admin/service/AdminAlertService` derives a fixed list of
alerts **on read** from `llm_log_history` aggregates and domain-row freshness. **A job that makes no LLM call and
writes no row leaves no trace any alert can see**, so a news poller needs either an LLM-logged call or a new rule
in `AdminAlertService`/`AdminAlertQuery`. Nothing in the repo is a scheduled outbound-HTTP poller today — this is
the first job whose health depends on a third party staying up.

**iOS.** The shell is `ios/Boop/Shell/ShellView` with `NKSpineBar` (Ma · Terv · Napló · Boop + `+`); every sheet
and cover is presented **at page level**. Rooms are `NKDrillPage` + `NKDrillSection` (`ios/Boop/Nap/MaDrill.swift`);
the shared proposal desk (`BoopCore/Morning/Proposals.swift`, `ios/Boop/Nap/ProposalDesk.swift`,
`Napkelte/Proposal.swift`) is where §5.5's split and purchase proposals belong — capped at three a day, nothing
applied without a tap. The write path is B3's offline-first `RitmusEnvironment` (ledger → outbox → flush): a new
capture type adds an `OutboxKind` case, a payload in `RitmusPayloads`, a `send…` branch in `RitmusClient` and a
test; `OutboxItem.id` **is** the `clientRef` the server keys idempotency on, and the status mapping
(2xx `.sent` · no-connection `.offline` · 401/409/429/5xx/timeout `.retryLater`, cap 8 · other 4xx `.failed`,
shown as *Újra*) is authoritative.

**Two iOS facts that make this area more than a new screen:**
- **There is no area page in code yet.** `ios/Boop` has `Nap`, `Terv`, `Naplo`, `BoopChat`, `Capture`, `Shell`,
  `Connect`, `Ritmus`. The area-page pattern of §5 lives only in the prototypes and this spec, so Pénz is
  *defining* it. (`L0` in the life-dashboard slice map is the slice that builds the shared area kit.)
- **`NKSpineBar` is a hard-coded four-item array and `Hue` is a closed five-case enum** (forma, alvas, mozgas,
  fuel, pulzus) driving every sky, orb and glow palette through array-indexed lookups that **crash on a new case
  if any table is missed** (and the orb shader needs exactly four colours). A per-area bottom bar and a Pénz hue
  are kit changes touching every `switch` over `Hue` — a shared hot spot, so one writer at a time.

**Shared hot spots** other sessions may own concurrently: `api/generate/merge.yml`, `api/openapi.yml`,
`frontend/src/data/_client/api.gen.ts`, `messages_hu/en.properties`, `1.1.0_master.yml`,
`support/ResetDatabase.java`, `AbstractIntegrationTest.java`, `openapi-generator-config.yaml`, `docs/CODEMAP.md`,
`docs/boop-handbook/_jegyek.json`, and the `Napkelte` kit.

**Gates that apply.** Backend suites need `-Dmezo.test.use-testcontainers=true` (the default fixed-DB mode races
and fakes failures); focused ITs **miss ArchUnit**, so add `ArchitectureTest` to the `-Dtest` list; AI-touching ITs
need `@ActiveProfiles("companion-fake")`; `node scripts/gen-codemap.mjs --check` after **every** merge including
the final one onto main; `node scripts/lint-docs.mjs` 0/0; `node scripts/boop-notion-sync.mjs check` exits 0.
**iOS is not built in CI** — its tests run locally only. The Mac's LuLu firewall blocks network calls from the
simulator app, so live calls are tested on the phone or with the DEBUG `-preview*` flags and `PreviewTransport`.

**Doc staleness found** (flagged, not fixed here): `docs/features/_platform-api-backend.md` §10 still says
"30 per-feature fragments … of merge.yml's 32 inputFile entries" while the live count is 53 — treat `merge.yml`
itself as the only count that matters. `docs/features/boop-ios.md` §7 still instructs new work to reuse
`LagyTabPage`/`LagyFlowFrame` and the `Lagy*.swift` spike, superseded by S2.5/B2 (`BoopDesign/Napkelte/*`); that
doc is layered rather than rewritten, so read its newest slice block first.

## 10. Open items and what is left to the builder

**Open, and none of them blocks the UI design:**

1. **Market data provider.** Start on the old app's free path (Yahoo + RSS + frankfurter.dev), which is proven and
   free; move to EODHD if breadth or reliability demands it. **Confirm Budapest/HUF coverage against EODHD's
   exchange list** before anything depends on it. Cost ceiling to clear with the owner: ~$20/month.
2. **Bank (open-banking) connection.** GoCardless Bank Account Data appears to have a free tier for one person
   and to support Revolut with Hungary covered, but the free-tier terms and his own Hungarian bank's coverage are
   **unverified against an official source**. The SMS path ships first; the screens are identical either way.
3. **MNB position** on the regulated-activity perimeter for a single-user tool: not found, unverified.
4. **How the SMS path becomes "seamless"** — an iOS Shortcut automation that runs without asking is the likely
   answer; confirm what current iOS allows for message-triggered automations.
5. **Migration rehearsal.** The export's exact shape must be read from a real export before the importer is
   written; the import runs against production only with the owner's explicit OK per the repo's rules.

**Left to the builder:** the slicing; the allowance engine's port (pure functions, TDD, the old app's 604 tests as
the oracle — its source and vitest suite are present locally, so the oracle is real and runnable); how many digest
items and how deep; the cash-capture interaction; the exact shape of the weekly review; which Napkelte components
the sleeve cards reuse.

### 10.1 Calls I made after the builder check

A fresh engineer read this document and reported where they would have to guess. These I settled myself; they are
my calls, not the owner's, and a builder may raise any of them again with a reason.

1. **The monthly investment amount stays one figure** from the allowance engine, as the old app computes it
   (`available = min(avgIncome − avgExpenses − savingsTarget, freeBeforeInvest)`, ~25 % share, pull-forward
   allowance); the **proposal** then splits that one figure across the sleeves. Per-sleeve monthly targets would
   double the engine's state for no visible gain.
2. **The practice 20 000 Ft is its own line in the derivation**, deducted like a fixed cost — not part of the
   investment share. Decision 3 says the cap cannot borrow from the long-term money, and this is the arithmetic
   that makes that true. It is visible in "honnan jön ez a szám?" as *Gyakorlás*.
3. **One product may be held in two sleeves as two holdings**, each with its own quantity and cost, and
   **lot-level cost basis is kept** (`InvestmentTransaction` already carries quantity, price and date). Per-sleeve
   P/L is otherwise not computable, and retrofitting a split holding after rows exist is a migration.
4. **The practice world needs no market data at all.** Entry, exit and stop are owner-typed; the quiet
   `+1 200 Ft` row is the sum of his own closed trades, and an open position is valued at the last **close**,
   labelled as such. A stop cannot be evaluated on delayed data, so Boop never watches one — the non-goals rule
   out real-time quotes, and this keeps L7 small.
5. **Every plan and journal row carries a `paper` flag from day one**, so phase 2 is a switch rather than a
   migration. Phase 2 is the owner's to start; the statistics then carry over but paper and real are shown apart.
6. **The import is a one-shot load at a known cut date**, with no merge semantics, and the old app is switched
   off when **L5** ships (the moment Költés is live). This is only safe *because* the old app is near-empty
   (§4) — re-verify that before L4, and if it has filled up by then, the importer needs real merge semantics and
   a stable external-id mapping.
7. **The SMS ingest gets the proper auth mechanism**, not a 30-day JWT in the Shortcut. The cheap option stops
   capturing silently when the token expires, which lands straight on the anti-goal "the weekly number lies".
   Cost: a filter, a matcher, secret handling, rate limiting and owner resolution for `created_by` in L4.
8. **A holding's "change since the last look" separates currency movement from price movement.** Blending them
   reads as performance the instrument did not deliver.
9. **Strings are Hungarian**, but every new error code goes into both `messages_hu` and `messages_en`, as the
   repo requires.

### 10.2 Still the owner's to answer

Four questions survived the builder check that only he can settle; they are in front of him and this document is
not final until they are answered. **My recommendation is recorded with each.**

1. **May Boop name products it researched itself, or only from a list that is kept current?** The old app used a
   hand-checked catalog of eight products with dated figures. Decision 12 wants two or three concrete options per
   sleeve — three options across four sleeves is a much larger catalog, and someone must keep it true; free
   research instead means the fee and cost figures have no verified source for the amount guard to check.
   *Recommendation:* a curated list that Boop may propose from, plus research that may **suggest an addition** the
   owner approves once — so every named figure always has a dated, checked source.
2. **What does "years of coverage" mean on the long sleeve's card?** It needs a spending baseline and a
   withdrawal assumption, and any assumed growth brushes boundary 3 ("never promises a return").
   *Recommendation:* *"as it stands today, with no growth assumed, this sleeve covers N years of your current
   fixed costs"* — honest, needs no forecast, and the fixed costs already exist in the allowance engine.
3. **Does the Pénz area have a score in its orb?** Every other area page carries one. A 0–100 money score sits
   badly next to boundary 2 and the anti-goal about streaks. *Recommendation:* **no number** — the orb fills with
   how much of the week's money is left, with no score inside it. Consequence: the shared area kit (slice L0)
   needs a scoreless variant.
4. **Does the daily digest push a notification, and does a news item open into anything?** The old app pushed a
   morning brief at a chosen time and let an item open into an on-demand analysis with a `buy | wait | none`
   verdict — the verdict is dead under boundaries 1 and 4. *Recommendation:* **no push** (the digest is for when
   he opens the app; a push about money he must not act on works against decision 6), and an item **does** open,
   into the sources and what it touches — but with no verdict and no action. Consequence: the per-item article
   fetch and its adversarial-text handling (§6, §9) are in scope for L6.

## 11. Slices — reshaping L4/L5

The life-dashboard slice map had two Pénz slices (`L4` adatalap, `L5` a szoba, both after B6 and L0) built around
tabs *Ma · Keretek · Előzmények · Tervezett* and no investing. Today's decisions replace them with four, in this
order. Earliest start is unchanged: **after B6 ships**, and after `L0` (which builds the shared area kit and the
per-area bar this design needs).

| Slice | What | Depends on |
|---|---|---|
| **L4** Pénz · adatalap | The money value type and conversion policy (§7); accounts, categories, transactions, recurring items, month close; the **allowance engine** ported as pure functions (TDD, the old app's 604 tests as the oracle); the **bank-SMS ingest** with its auth decision (§9) and Shortcut contract; the **amount guard**. Backend + data only. | B6, L0 |
| **L5** Pénz · a terület | The area page and its five-item bar; **Költés** (weekly remainder hero, the derivation page, month close, breakdown, "mire gyűjtök" with savings goals and purchase plans) and **Ma** (verdict, month standing); manual cash capture in `+` as a new `OutboxKind`; the Pénz card on Terv. | L4 |
| **L6** Pénz · a portfólió és a hírek | Holdings with sleeves, investment transactions, the quote cache and its SSRF-guarded fetcher; **Pénzem** (sleeve cards, years-of-coverage for the long sleeve, the event timeline); the news poller, the relevance filter and the **daily digest** at the bottom of Ma, with the figures computed and passed through verbatim; the admin alert rule that notices the poller stopping. | L5 |
| **L7** Pénz · Gyakorlás és a javaslatok | The paper-trading loop (plan · journal with the fixed tag set and mistake flag · R-multiple · weekly review) and the hard cap; the **proposal flow** on the shared proposal desk — per-horizon splits and purchase advice, two or three concrete products with the why; the monthly recurring strategy. | L6 |
| *(L8)* | Money facts enter the memory corpus and become "miért?" contributors — this is the existing **L6 Az egy AI** slice of the life-dashboard map, renumbered; no new work here. | L7, B8 |

Slicing is the builder's call and may change in the plan; what must not change is that **L4 ships no screen** and
**the digest cannot ship before the portfolio it talks about**.

## 12. Next steps

1. Owner approves this document.
2. **Simulator spike** of the five pages (Xcode + the iOS Simulator; no HTML artifacts for Boop) → owner's OK on
   the look. This is the only place for visual iteration.
3. `superpowers:writing-plans` → a plan in `docs/superpowers/plans/` with the *Kész, ha…* checklist, per slice.
4. Build → gates → merge → deploy → live check → Hungarian report.
