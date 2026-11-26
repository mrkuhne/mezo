# Boop Levél · a reggeli posta — L1 + L2 in one release (design)

- **Status:** **approved by the owner 2026-11-21** · **Date:** 2026-11-21 · **Issues:** `mezo-r36n9.38` (L1) +
  `mezo-r36n9.39` (L2), shipped together · **Epic:** `mezo-r36n9` · **Session:** `level-area-development-afe3fa`
- **Extends:** `2026-11-13-boop-life-dashboard-design.md` §3.5, §4.1–§4.3, §5 (L1, L2), §8. Where this
  document and that one disagree, this one is newer and wins.
- **Evidence:** `docs/superpowers/research/boop-life/01-mail-digest-research.md` (feasibility, privacy, cost,
  prior art), `03-ui-direction.md` §3.3 (the mail room), the Élet spike screenshot `elet-7-level.png`.

## 1. Intent

In the owner's words (2026-11-21): *"szinte mindenről kb lemaradok. akciók, promóciók, csomagok, számlák, jó
lehetőségek, időzített programok, stb. ezek fontosak"*. Two inboxes (Gmail and iCloud) bury what matters under
noise. Boop reads the post for him twice a day, throws the noise into one folded row, and keeps only what is
worth a minute — with a ring of the phone when something good is about to expire.

**Success:** he stops missing deadlines (a bill, a booked programme, an expiring offer), knows where his parcels
are without opening a carrier mail, and sees the one or two genuinely good deals of the day — in under a minute,
from the Levél area and the Ma wall.

## 2. Owner decisions (2026-11-21) — do not re-litigate

| # | Question | Decision |
|---|---|---|
| 1 | Consumer Gmail or a Workspace domain? (life spec §8.1) | **Consumer Gmail.** So no Internal OAuth client: IMAP + app password (research §1.5). |
| 2 | Real inboxes or a forwarded mirror? (§8.2) | **A mirror mailbox.** He has **both Gmail and iCloud Mail** (the 2026-11-13 spec assumed it; he confirmed). Both auto-forward everything into **one new Gmail account created only for Boop**; Boop reads only that account, with **one** app password. The iCloud app-password trap (an Apple password change revokes them all) no longer applies — Boop holds no iCloud credential. Cost accepted: only mail arriving after forwarding is set up is ever seen. |
| 3 | Push for a high score? (§8.3) | **Yes, for a good deal/promotion** — within decision #35 (only the wall's `.expires` role rings, capped at 1–2 a day app-wide). See §5.6. |
| 4 | Price-check budget (§8.4) | **10 checks a day** (≈ €3/month). Applies to L3, which builds the check; recorded here so L3 does not re-ask. |
| 5 | Ship L1 alone (counts only) or with L2? | **One release.** The first thing he sees on the phone is the scored digest. |
| 6 | What counts as worth a minute | **The four groups of §4**, proposed by Claude and accepted as proposed ("Igen, így jó"). |
| 7 | How it is built | **The mirror Gmail read by the server twice a day** (§3, approach A). |
| 8 | Does the mirror exist yet? | **No — he sets it up on 2026-11-21** from Claude's guide (new Gmail, 2-step verification, forwarding from Gmail and iCloud; the app password waits for the Fiókok screen). Real mail accumulates while the backend is built; the day-one header check and the carrier rules use it. |

## 3. Approaches

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| **A** | **Mirror Gmail, server polls IMAP at 08:00 and 15:00** | One app password stored; mail after 15:00 waits for the morning | **Chosen** — already-accepted mirror, no new infrastructure, a digest batches by nature |
| B | Own inbound address (a domain + an inbound-mail router posting to the backend) | No password at all, real time; but a domain (~€10–15/yr), a third-party router, a public webhook, more parts to fail | Rejected by the owner |
| C | The phone reads mail | iOS gives no app access to Mail; IMAP from the phone runs only while the app is open | Dropped — does not work |
| — | Gmail API OAuth / Pub/Sub push | Restricted scope: 7-day token expiry in Testing, CASA for Production (research §1.2–1.3, §3) | Ruled out by decision 1 |

## 4. What the owner sees

### 4.1 The four groups (decision 6)

| Group | What lands here | How it shows |
|---|---|---|
| **Határidős** | bills with a due date, timed programmes and events, bookings, appointments, expiring offers | sorted by **date**, with "holnap lejár" / "ma" marks; **no score** — what matters is when |
| **Csomagok** | shipping notifications | one row **per parcel**, its latest state: *úton · ma érkezik · átvehető · átvetted* |
| **Akciók és lehetőségek** | promotions, discounts, good offers, invitations | a **1–10 score**: how much it interests him × how good the offer looks |
| **A többi** | newsletters, notices, noise | one **collapsed row per category** with a count |

Two kinds always rise to the top regardless of group:
- **a mail from a real person** (not a bulk sender), and
- **a sensitive sender** — bank, insurer, government office, health provider, login/2FA codes. These are **never
  read by a model** (§5.3); the row says only who wrote ("A bankod írt") and opens the mail in Gmail.

### 4.2 The Levél area (the page already exists, `AreaRoom.swift` `.level`; this release fills it)

Tabs stay **Ma · Figyelt · Szabályok · Fiókok** (life spec §3.5), on the shared L0 kit (`NKAreaPage`), warm
treatment, `Hue.level`. Every number on the page is measured — no invented figure (`.58` rule).

**Ma** — the head verdict + sentence (e.g. *"Két dolgot nézz meg"* / *"34 levél jött reggel óta. 31-et
elintéztem helyetted, kettő megér egy percet."*), then:
- **highlight**: the top item of the day (the best deal, or the nearest deadline if it is due tomorrow);
- **stat tiles**: arrived · handled · worth a minute;
- **heat strip**: when mail arrives, by two-hour slot (as `elet-7-level.png`);
- **people + sensitive** rows (if any) — always first;
- **Határidős** row list (date-sorted), **Csomagok** row list, **Akciók és lehetőségek** cards with the
  score chip, each with **"érdekel / nem érdekel"** (§5.5) and **"Megnyitás a Gmailben"**;
- **A többi**: one folded row per category, expandable;
- the ask row (existing).

```
LEVÉL                                   (photo head, Hue.level)
Két dolgot nézz meg
34 levél jött reggel óta. 31-et elintéztem, kettő megér egy percet.
[ Ma 2 ][ Figyelt ][ Szabályok ][ Fiókok ]
┌ MEGÉR EGY PERCET ─────────────────────┐
│ Futócipő −32% · ma éjfélig      9/10  │
│ Egy sor, miért érdekes neked.          │
└────────────────────────────────────────┘
34 érkezett   31 elintéztem   2 megér egy percet
MIKOR ÉRKEZIK  ▁▆▃▂▅▂▁▁
HATÁRIDŐS   Áramszámla · holnap esedékes
            Koncert · szombat 20:00
CSOMAGOK    GLS · ma érkezik
AKCIÓK      [kártyák pontszámmal · érdekel / nem érdekel]
A TÖBBI     Hírlevelek 12 ›  Értesítők 9 ›  Közösségi 6 ›
```

**Figyelt** — stays `NKNotLiveYet` with its existing line; L3 fills it.

**Szabályok** — plain words, no settings jargon:
- **"Amit gép soha nem olvas"**: the sensitive categories, and the senders Boop has put there; he can add a sender
  ("ezt se olvasd") or move one out.
- **"Amit mindig megmutatok" / "Amit csendben elteszek"**: senders he marked, from his érdekel/nem érdekel taps;
  each removable.
- one sentence on notifications: when the phone rings (§5.6) and that the cap is shared with the rest of Boop.

**Fiókok** — the mirror account:
- not connected: a **step-by-step guide** (create the Boop Gmail; turn on 2-step verification; create an app
  password; turn on IMAP; set forwarding in Gmail; set forwarding in iCloud) with a field for the address and the
  app password he types himself (life spec §2.7 — Boop never asks for his real passwords);
- connected: the address, last run time, how many mails it saw, the run state in words ("Rendben" / "Két
  futás óta nem jött levél — lehet, hogy a továbbítás leállt"), **"Lecsatolás"** (deletes the stored credential).

### 4.3 The Ma wall
The mail area joins the wall by registering a **`WallSource`** — not a card surface of its own (`.58` rule):
- `.expires` role: a deadline due today/tomorrow, or a deal scoring ≥ 8 that expires within ~36 h;
- the "happened" role: *"Megjött a reggeli posta · 2 érdekes"*;
- no "improves today" candidate from mail.

## 5. How it works

### 5.1 Intake
- One mailbox row: address, the **app password encrypted at rest** (§5.8), state, last run. Single user, but the
  table keys on user id like every feature table.
- IMAP over TLS to `imap.gmail.com:993`, one short-lived connection per run, sending the RFC 2971 `ID`
  command. Folders: the mirror's **INBOX** and **`[Gmail]/Spam`** — iCloud forwards without SRS, so its mail can
  fail SPF at the mirror and land in Spam (prior art §8). A per-folder cursor `(UIDVALIDITY, lastUid)`;
  `UID FETCH lastUid+1:*` is the fast path; a UIDVALIDITY change triggers a bounded re-scan (last 7 days).
- Idempotency: unique **`X-GM-MSGID`** per mailbox (Gmail's stable id, the same in every folder, so a move
  between Spam and INBOX never duplicates), plus `(mailbox_id, folder, uidvalidity, uid)` for the cursor and a
  content hash (Message-ID + normalized body). A re-delivered mail is never re-classified (re-classification is
  where money leaks).
- Boop **never writes** to the mailbox: no flags, no moves, no deletes, no SMTP. The IMAP session opens the
  folder read-only.
- Schedule: Spring `@Scheduled` at **08:00 and 15:00 Europe/Budapest**, plus a manual "frissítés" from the
  Fiókok tab (rate-limited). A run records start/end, counts and failure in a run table.
- **Health**: a connection/auth failure, or **two runs in a row with zero new mail**, sets the mailbox state the
  Fiókok tab shows, and raises an admin alert (the Pénz provider fail-streak → vmalert pattern).
- Original sender/recipient: Gmail and iCloud forwarding are redirect-style — the original `From:`, `To:`,
  `Subject:` and body arrive unchanged, so no "Fwd:" unwrapping. Which account it came from is read from
  `X-Forwarded-To` / `X-Forwarded-For` / `To:` — best effort, shown as "Gmail" / "iCloud" when known, unknown
  otherwise. SPF/DKIM results in the mirror are **not** used as a trust signal (forwarding breaks them).
- **Day-one header check** (build step, before parser code is final): send test mail through both forward paths
  and record the real headers in the build notes; the iCloud behaviour is only forum-documented.

### 5.2 Storage and retention
- Raw message (headers + chosen body part) in Postgres — it is on his own cluster. **Kept 30 days**, then the raw
  body is purged; the classified item (group, fields, score, his feedback) is kept for learning and history.
  Sensitive-sender mail stores headers only (§10.3).
- Attachments are never downloaded.

### 5.3 Redaction — before a single token is spent (life spec §4.2, research §4.2)
1. Prefer `text/plain`; otherwise sanitize `text/html` (strip style, script, head, comments, all attributes).
2. Drop images; links become anchor text + **bare host**.
3. Mask e-mail addresses, long digit runs, IBAN- and card-shaped strings, order/booking/invoice references,
   phone numbers, postal addresses where pattern-detectable. **Exception kept for the user**: due dates, amounts
   due, carrier names and parcel status words are not masked — the model needs them to fill §4.1 fields.
4. Truncate to a cap (~1 500 tokens).
5. **Sensitive-sender rules run first** (deterministic: sender domain list + subject/body patterns for login
   codes). A match is classified by rule (`sensitive`), counted, shown by sender only, and **never** reaches a
   model. The list is seeded (Hungarian banks, insurers, `gov.hu`/ügyfélkapu, health providers, generic 2FA
   patterns) and editable from Szabályok.

### 5.4 Classification and scoring (the rules-then-LLM funnel)
1. **Rules** (no model): sensitive; bulk vs person (List-Unsubscribe / Precedence / known bulk domains);
   **schema.org JSON-LD** in the HTML (extracted before sanitizing) — `ParcelDelivery`, `Invoice`
   (`paymentDueDate`), `EventReservation`, deal annotations — fills the fields directly; **per-carrier rules**
   for GLS, Foxpost, Packeta, MPL, DPD (sender domain → tracking pattern → status words), built from real mails
   in the mirror, so parcel mail never reaches a model; known newsletter/social senders → *A többi* with
   category; senders he marked "csendben elteszek" → *A többi*. Most mail stops here.
2. **Classify + extract** (cheap model, one call per remaining mail, structured output): group, a one-line
   summary in Hungarian, and the group's fields — deadline: kind, date/time, amount if a bill; parcel: carrier,
   state, expected day; deal: product/offer, price/discount if stated, valid-until. Body is delimited as data.
3. **Relevance + score** (one batched call per run over the deal candidates, with his goal/plan context and his
   recent feedback examples): a 1–10 score and one line "miért érdekes neked". Cacheable context.
4. **Screen** (cheap model, only for items that will be shown as a deal/opportunity or that ask him to act):
   phishing / injection check; a flagged item is shown with a warning and never notifies.
5. Validation: any model output that names a date, amount or link not present in the redacted text is dropped
   (no invented number). A failed run falls back to rules-only grouping, and the page says so.

### 5.5 Learning from "érdekel / nem érdekel"
- Each tap is stored per item. Two effects, both explainable in Szabályok:
  1. **per-sender prior**, applied *outside* the model: a smoothed share of "érdekel" taps per sender shifts the
     score; three "nem érdekel" in a row → Boop proposes "csendben elteszem" (one tap). Old taps decay (e.g.
     90-day half-life) so taste can drift;
  2. **examples**: ~6–10 recent tapped deals (redacted one-line summary + verdict) go into step 3's prompt as
     few-shot examples. Similarity selection by embedding only once there are > ~50 examples.
- Nothing changes without his tap (spine rule): the silent-sender rule is proposed, not applied.

### 5.6 Notifications (decision 3, within #35)
- Only via the wall's `.expires` role, so the shared cap (1–2 a day on top of check-in and bedtime) holds. The
  scheduler that turns `.expires` candidates into local notifications does not exist yet (§9); this release
  builds it once for every area.
- Candidates: a deal with score ≥ 8 expiring within ~36 h; a bill or programme due tomorrow (morning run) or
  today (if first seen in the morning run).
- **Until the paid Apple team is active** (`mezo-r36n9.19`): the phone raises a local notification when it
  refreshes (foreground or background refresh), so timing is not exact. After it: server-sent push at the end of
  the run. The spec does not wait for the paid team.

### 5.7 Cost cap
- Target ≈ €1–3/month for L1+L2. A **per-day token budget** on the mail feature; when hit, remaining mail falls
  back to rules-only and the page says "ma már nem pontoztam tovább".
- Model tier: the cheap chat model for steps 2–4; no web search in this release (L3).

### 5.8 The credential
- Typed by him on the Fiókok tab, sent once over TLS, stored **encrypted** (key from a k8s Secret, never in git,
  never logged, never returned by the API). Lecsatolás deletes it. Mechanism: AES-GCM, new code (§9).

### 5.9 API (contract-first, `api/openapi.yml`)
- `GET/PUT/DELETE /api/mail/mailbox` — address + state; PUT takes the app password, verifies an IMAP login before
  saving.
- `POST /api/mail/mailbox/run` — manual run (rate-limited).
- `GET /api/mail/digest?date=` — the day's digest: counts, heat strip slots, the four groups, people/sensitive.
- `POST /api/mail/items/{id}/feedback` — érdekel / nem érdekel.
- `GET/PUT /api/mail/rules` — sensitive and silent senders.

## 6. Goals, non-goals, anti-goals

**Goals:** the four groups twice a day; never miss a deadline; parcels at a glance; the good deals scored; one
ring for what expires; a guided setup he does alone.

**Non-goals (this release):** price check and Figyelt (L3); AI threads / "miért?" contributions from mail (L6);
replying, sending, archiving or deleting mail; reading mail from before forwarding; a third mailbox; attachments.

**Anti-goals:** phone noise he switches off; a model reading a bank or health mail; a model steered by mail text
into saying or doing something; a digest that dies silently; any invented figure on the page.

## 7. Constraints
- Privacy (life spec §6): no real mail content in commits, docs, prototypes or Notion; examples are invented.
- The four bindings from `.58`: no second card surface, no second notification policy, no second explanation, no
  invented number.
- Napkelte look and the L0 kit; never emoji; never "Mezo".
- Paid Apple team still pending (§5.6).

## 8. Prior art
Earlier research (`01-mail-digest-research.md` §6: Shortwave, Meco, MailGester, SummerMail, MailDigest) gave the
rules-then-LLM funnel, the redaction pipeline and the notification-policy warning. The 2026-11-21 recon added:

| Pattern | Source | Verdict |
|---|---|---|
| Gmail forwards all new mail except spam (Promotions included); forwarding address verified by a link | [Gmail help 10957](https://support.google.com/mail/answer/10957) | **Adopted** — the setup guide's Gmail step |
| Redirect-style forwarding keeps original headers; iCloud does no SRS, so its forwards can fail SPF and land in the mirror's Spam | [Gmail help 175365](https://support.google.com/mail/answer/175365), [Cloudron forum](https://forum.cloudron.io/post/4876) (forum, not Apple) | **Adopted** — read `[Gmail]/Spam` too; no SPF/DKIM trust; day-one header check |
| Gmail IMAP extensions: `X-GM-MSGID`, `X-GM-RAW`, `ID` command | [Gmail IMAP extensions](https://developers.google.com/workspace/gmail/imap/imap-extensions) | **Adopted** `X-GM-MSGID` as dedupe key + `ID`. **Rejected** storing a "processed" label: Boop never writes to the mailbox; the DB cursor is enough. **Rejected** IDLE |
| schema.org email markup (ParcelDelivery, Invoice, EventReservation, deals) | [Gmail markup](https://developers.google.com/workspace/gmail/markup/overview), [ParcelDelivery](https://developers.google.com/workspace/gmail/markup/reference/parcel-delivery) | **Adopted as a fast path**, not the main path — no evidence Hungarian carriers embed it; per-carrier rules cover them |
| Classifier tuned by feedback: corrected examples as few-shot, top-k by similarity once large | [LangSmith optimize-classifier](https://docs.langchain.com/langsmith/optimize-classifier) | **Adopted** as a hybrid with a per-sender prior outside the model and decay. **Rejected** fine-tuning and unbounded example lists |

## 9. Codebase terrain
The closest analogue is **Pénz** (`backend/.../feature/penz`, `docs/features/penz.md`, iOS `ios/Boop/Penz/` +
`BoopCore/Penz/`). Levél copies its shape; anchors as of `43de99df5`.

**Backend — new package `feature/mail`** (`controller, service, repository, entity, mapper, config`; pure no-Spring
cores in `service/<sub>`: `service/imap`, `service/redact`, `service/rules`, `service/classify`).
- **Schedule:** copy `PenzNewsJob` (`feature/penz/service/PenzNewsJob.java:19-33`) + `PenzNewsAsyncConfig`
  (single-thread executor, `defaultCandidate=false`) + `PenzNewsRunner` (`runAsync` `@Async`, in-memory refresh
  cooldown `:76`). Two switches in `FeaturesConfiguration` (`mezo.mail.enabled`,
  `mezo.techcore.cron.mail-job.enabled`), both off in the test profile; fan out with `UserFanOut.forEachActiveUser`.
- **LLM:** a feature-owned port (`MailClassifierLlm`, like `PenzDigestLlm`) with the adapter in
  `feature/companion/llm/` (like `PenzDigestLlmAdapter`, wrapped in `LlmCallContext`); a scripting hook in
  `FakeCompanionLlm`. Cheap tier `chat-model` (prod provider openai). Fence untrusted text like
  `DigestPrompt.sanitizeUntrusted`; validator + fallback like `DigestValidator`/`DigestFallbackCopy`; injection
  tests like `PenzDigestInjectionTest`.
- **Must:** add the mail slugs to `LlmCallContext.keepsPayload()`'s deny list
  (`feature/llmlog/context/LlmCallContext.java:45-67`) — otherwise mail bodies persist in `llm_log_history`.
- **Per-day cost cap:** reuse `LlmLogRepository.costForOwnerFeatureSince(owner, feature, since)` (`:171`) with
  `since` = start of the Budapest day (precedent `TeamChatBudget`). DB-backed, survives restarts. The account-wide
  `LlmBudgetService` still applies on top.
- **Health:** a provider-status row + Micrometer gauge + vmrule, as `PenzProviderHealth` (`:41-83`) and
  `k8s/monitoring/vmrule-mezo.yaml:55-64` (`fail_streak >= 2` for "zero mail twice", plus auth failure). There is
  no admin screen any more (#52); the Fiókok tab is the owner-facing surface.
- **Idempotency:** native `INSERT … ON CONFLICT DO NOTHING` + read-back, as `PenzSmsStore`.
- **Credential encryption is new work:** nothing in the codebase encrypts a reversible secret. AES-GCM with a key
  from a new env var on the `mezo-app` SealedSecret (`k8s/backend/sealedsecret.yaml`,
  `deployment.yaml:60-105`), dummy default in yml for tests. Deploy note: env lands before image — check the pod
  tag after the push.
- **New dependency:** Jakarta/Angus Mail (none in `pom.xml`). ArchUnit forbids `jakarta.mail` in
  `companion.tools` (`ArchitectureTest.java:110-115`) — IMAP stays inside `feature/mail`.
- **Contract:** `api/feature/mail/mail.yml`, appended to `api/generate/merge.yml` (forgetting the append drops it
  silently), regenerate, new tag, 401 on every op, error codes in `messages_hu/en.properties`.
- **Liquibase:** one SQL per change in `1.1.0/script/`, changeSet in `1.1.0_master.yml`, named constraints, no
  seed rows (the sensitive/carrier seed lists live in code, not in INSERTs); every new table into
  `ResetDatabase.java:47-60` + a populator.
- **Focused gate:** `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='Mail*IT,Mail*Test,ArchitectureTest'`.

**iOS**
- A **`LevelRoom`** in its own folder `ios/Boop/Level/`, routed from `NapView.swift:59-71` the way `PenzRoom` is
  — not grown inside `AreaRoom.swift` (whose `.level` planned-tab code then becomes dead, like `.penz` already is).
- Client: hand-written lenient wire types + a client over `RawJSONClient`
  (`BoopCore/Train/PlanTransport.swift:29`), as `PenzClient`/`PenzWire` — **not** the generator (strict enums
  would break on a new category). Store `@Observable` with `ServerCache` key `level/digest` by day, as
  `PenzStore.swift:88-93`; created per user in `RootView.swift:~120`; preview transport like `PenzPreview.swift`.
- Kit blocks: `NKAreaPage`, `NKAreaBar`, `NKHighlight`, `NKStatRow`, `NKRowList`, `NKHeatStrip`, `NKBare`,
  `NKInfoRow`, `NKNotLiveYet`, `NKAskRow`, `NKAreaSubPage`, `.nkStale`; `NKNewsCard`/`NKConfidenceDots`
  (`Napkelte/News.swift`) as a starting point for the scored deal card. Levél has no glyph of its own yet
  (`book-sage` placeholder) — the spike decides.
- **Wall:** add a `level` key to `BoopCore/Morning/WallSources.swift:12-14`, a pure `levelWallCandidates(...)`
  with tests, one `register` line in `ios/Boop/Nap/MaWall.swift:40-53`, tap routing in its `act()`. **Levél is the
  first life area on the wall** (Pénz never registered).
- **Notifications are new work, not a registration:** `wallNotifications(…, cap: 2)` (`Wall.swift:181`) exists but
  nothing calls it. This release builds the wall's local-notification scheduler once, for every `.expires`
  source: authorization, pending add/remove, the per-day "already rang" persistence (pattern
  `Nap/BedtimeReminder.swift`). It serves Étel/Edzés `.expires` candidates too, so their ringing starts with this
  release — the owner must hear that in the report.

**Traps:** jsonb `?` in Liquibase SQL (use `jsonb_exists()`); midnight-fragile fixtures around the 08:00/15:00
day; scheduling is off in tests (ITs call the runner, assert the job bean absent when switched off); CODEMAP
regeneration after every merge; restart-sensitive counters belong in the DB, not memory.

**Stale docs found (fix in this release):** `boop-ios.md:231` presents the ring as shipped; `boop-ios.md:233-235`
says Pénz joined the wall; `CODEMAP.md` lists one ResetDatabase table (generator parses only the first TRUNCATE —
file a bug).

## 10. Calls made by Claude after the builder check (owner to confirm while reading)

1. **A run, not a day, is the unit of arrival; open items roll.** Counts, the heat strip and "A többi" cover the
   mail that arrived since the previous run's day boundary (mail after 15:00 is fetched next morning and counted
   on the day it is fetched). **Határidős and Csomagok are rolling lists of open items** built from mail of any
   day: a deadline stays until its date has passed (then one more day as "lejárt"); a parcel stays until
   *átvetted* + 1 day. Deals stay until their valid-until (or 3 days when none is stated). So items carry a
   lifecycle; `GET /api/mail/digest` returns today's arrivals **plus** the open items, and wall `.expires`
   candidates may come from older mail.
2. **"Megér egy percet"** = people + sensitive + deadlines first seen today + parcels whose state changed today +
   deals scoring ≥ 7. **"Elintéztem"** = arrived − that. Both are counted from stored rows, never estimated.
3. **Sensitive mail: headers only.** For a sensitive-sender match the body is never stored — only sender, subject
   line length, date and the rule that matched. The subject is not shown either (it can carry an amount or a
   code); the row says who wrote.
4. **"Megnyitás a Gmailben"** opens the message in the Gmail app by its Gmail message id in the **Boop mirror
   account**; the Fiókok guide therefore has a step "add the Boop account to the Gmail app". Without it the
   button falls back to gmail.com in the browser.
5. **Server-sent push is out of scope.** This release builds only the phone's local scheduler (one cap, on the
   phone). Server push comes after the paid team as a follow-up under `mezo-r36n9.19`.
6. **Simulator spike before the iOS build.** The Élet spike covers the Ma tab's look; the deal card with
   érdekel / nem érdekel, Szabályok, the Fiókok guide and its connected state, and the Levél glyph get a
   throwaway simulator spike and the owner's OK before they are built. The backend may start in parallel.
7. **Turning on the wall's ringing affects every area.** The `.expires` scheduler built here also lets Étel and
   Edzés expiring items ring (decision #35 already allows it; nothing rang so far because the scheduler was
   never built).

## 11. Left to the builder
- Exact seed lists (sensitive domains, carriers, bulk senders), prompt wording, thresholds (score 8, 36 h,
  three taps) as tunable constants.
- The heat-strip slot width; the folded-category names.
- Whether manual refresh is limited to once per 10 minutes or similar.

## 12. Change 2026-11-25 — Google sign-in to his own Gmail (supersedes decisions 2, 7 and 8)

**Owner decision (2026-11-25):** no mirror mailbox — *"nem gyűjtőfiókot szeretnék, adok hozzáférést a gmailemhez"* —
and, offered an app password for his real Gmail vs a **„Belépés Google-lel”** button, he chose **Google sign-in**.
The shipped L1+L2 release (v3.33.0, merge `004f571c1`) stays; only how the mailbox is reached changes.

**What made it painless (recon 2026-11-25):** Google Cloud's **Personal user type** — an OAuth app that only the
account that created it can authorise is *"not subject to the OAuth user cap or 7-day test user token expiration, and
do not display the unverified app screen"*, and needs no verification
([Google Cloud help 15549945](https://support.google.com/cloud/answer/15549945#user-type-personal)). So no weekly
re-login and no CASA. Chosen only at project creation; another account gets `client_user_mismatch`.

### 12.1 What he sees
- **Fiókok, not connected:** one button **„Belépés Google-lel”** and two lines: what Boop will see (Beérkezett + Spam,
  read-only) and what it never does (send, delete, mark read). Google's consent screen says *"View your email messages
  and settings"* (`gmail.readonly`).
- **Connected:** his address, last run, state in words; **„Lecsatolás”** revokes the token at Google and deletes it.
- **When Google withdraws access** (he revokes it, changes his Google password, or 6 months unused): state
  `auth_failed` → Fiókok says „A Google visszavonta a hozzáférést — lépj be újra” with the button; the Levél head points
  there. No ring for it (not a deadline).
- **iCloud:** not read directly any more. Fiókok carries one optional line: „Ha az iCloud-leveleidet is látni
  szeretnéd, állítsd be az iCloudban, hogy továbbítson a Gmailedbe.”
- **One-time setup he does himself** (guided in Fiókok and in chat, ~10 minutes): create a Google Cloud project in
  **Personal** mode, enable the Gmail API, create an **iOS OAuth client** for Boop's bundle id, and tell Claude the
  client id (a public identifier, not a secret).

### 12.2 How it works
- **Gmail REST API with `gmail.readonly`, not IMAP** — IMAP over OAuth needs `https://mail.google.com/` (read, send,
  permanently delete); the REST API gives read-only by Google's guarantee.
- **Sign-in on the phone:** `ASWebAuthenticationSession` + PKCE against the iOS client (redirect
  `com.googleusercontent.apps.<id>:/oauth2redirect`), scopes `gmail.readonly` + `openid email`. No Google SDK, no new
  package, no project-file edit. The phone sends `{code, codeVerifier, redirectUri}` once to
  `POST /api/mail/mailbox/google`; the **server** exchanges it (iOS client id, no secret), seals the **refresh token**
  with the existing AES-GCM cipher (same columns as the app password), reads his address from the ID token, and never
  returns the token. The phone never stores it.
  *Call (Claude): server-side refresh with the iOS client id. Google documents the serverAuthCode + Web-client pattern
  instead, which needs a client secret in the cluster; with a Personal app only his account can ever authorise, so the
  public-client refresh adds no exposure beyond the sealed refresh token itself. Fallback if Google refuses the
  exchange: Web client + sealed secret.*
- **New reader `GmailApiReader`** beside the IMAP one, chosen by `mail_mailbox.kind` (`imap|google`, new changeset —
  the v3.33.0 changeset is in production and is never edited). Each run: refresh the access token; first run
  `messages.list q="newer_than:7d" labelIds INBOX / SPAM`; later runs `history.list startHistoryId` (`messageAdded`),
  **404 → bounded full sync** (last 7 days). The cursor stores the `historyId`. `messages.get format=raw` → the same
  MIME parsing as IMAP, so redaction, rules, pipeline, digest and screens are untouched. `gm_msgid` = the API id.
- Revoke on Lecsatolás: `POST https://oauth2.googleapis.com/revoke`. `invalid_grant` on refresh → `auth_failed` (the
  existing health gauge and alert cover it).
- Outbound calls only to `oauth2.googleapis.com` and `gmail.googleapis.com` (allow-listed). The IMAP path stays in the
  code, unused by the app.

### 12.3 Kész, ha…
- He connects with the Google button on his phone; a manual run fills the four groups from his real Gmail; the
  prod DB shows `mail_message` / `mail_item` rows (counts only).
- Lecsatolás revokes at Google and nulls the token; a revoked token shows the re-login state.
- Tests: token exchange + refresh + `invalid_grant` + revoke against a stub Google; history sync + 404 fallback +
  INBOX/SPAM labels; PKCE + callback parsing on iOS; Fiókok states. Gates as §11 / the plan.
- Docs, handbook, `_dontesek.json`, Notion, release row updated; the six-step mirror guide removed from Fiókok.
