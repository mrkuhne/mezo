---
title: Mail — Boop Levél, the morning post (his own Gmail → scored digest)
type: feature-domain
status: done
updated: 2026-11-25
tags: [backend, boop, level, mail, imap, google, gmail-api, oauth, llm, privacy]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/mail
  - backend/src/main/java/io/mrkuhne/mezo/feature/mail/service/google
  - backend/src/main/resources/db/changelog/1.1.0/script/202611251200_mezo-r36n9.38_mail_google.sql
  - api/feature/mail/mail.yml
  - backend/src/main/resources/db/changelog/1.1.0/script/202611211200_mezo-r36n9.38_mail.sql
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/MailClassifierLlmAdapter.java
  - backend/src/test/java/io/mrkuhne/mezo/feature/mail
related: [boop-ios, penz, companion, _platform-api-backend, _platform-auth-security]
---

# Mail — Boop Levél, the morning post (L1 + L2) — Feature Documentation

> **Change 2026-11-25 (owner decision, spec §12, `mezo-r36n9.38`/`.39`): Google sign-in to his own Gmail, no mirror
> mailbox.** The mailbox is reached through a **„Belépés Google-lel”** button (OAuth, `gmail.readonly`, Gmail REST API)
> instead of a Boop-only mirror Gmail over IMAP + app password; see §3.10. The IMAP reader, the mirror/app-password
> connect (`PUT /api/mail/mailbox`) and everything below that talks about the *mirror* are **kept in the code but unused
> by the app**; redaction, rules, pipeline, digest and screens are unchanged and shared by both kinds.

> Backend feature with an iPhone client: **Boop**'s *Levél* area (`ios/Boop/Level/`, §6, and
> [`boop-ios.md`](boop-ios.md) §2 *Levél*). Built 2026-11-21 in **one release** — L1 `mezo-r36n9.38` (intake, redaction,
> rules) + L2 `mezo-r36n9.39` (scoring, learning, the area, the wall ring). **Built and merged-ready on branch
> `feat/level-posta`; deploy and the phone install are pending at the time of writing** (the controller's task 14).
> One API tag: `Mail` (JWT, 401 on every operation). Spec
> [`2026-11-21-boop-level-posta-design.md`](../superpowers/specs/2026-11-21-boop-level-posta-design.md), plan
> [`2026-11-21-boop-level-posta.md`](../superpowers/plans/2026-11-21-boop-level-posta.md). L3 (price check, *Figyelt*)
> is **not** built (§9).

## 1. Summary

The owner's mail lives in two inboxes (Gmail, iCloud) that bury what matters. Since 2026-11-25 the server reads **his own
Gmail** (signed in with Google; iCloud can optionally forward into it) — originally a Boop-only *mirror* account over
IMAP, kept as the unused `imap` kind — at **08:00 and 15:00
Europe/Budapest**, strips every mail down to redacted text, sorts it with deterministic rules first and a cheap model
second, and keeps a rolling digest in **four groups** (spec §4.1): **Határidős** (deadlines), **Csomagok** (one row per
parcel), **Akciók és lehetőségek** (deals, scored 1–10), **A többi** (folded by category) — plus two kinds that always
rise to the top: **a real person** and **a sensitive sender** (bank, insurer, government, health, login codes — whose
mail is **never read by a model**). Taps on *érdekel / nem érdekel* teach a per-sender prior and a few-shot example
list. A deal or a due date that is about to lapse can **ring the phone** through the Ma wall's `.expires` role.

What it never does: write to the mailbox (read-only access, no flags/moves/deletes/SMTP; Gmail scope is `gmail.readonly`), download attachments, let a
model see a sensitive mail, trust a model's date/amount/link that the mail text does not contain, or spend more than a
fixed cost a day.

## 2. User-facing behavior

All on the iPhone (§6); the server has no UI.

- **Fiókok (connect).** Not connected: the **„Belépés Google-lel”** button plus two lines (what Boop sees — Beérkezett +
  Spam, read-only — and what it never does) and an optional iCloud-forwarding line. States: *not connected*,
  *unconfigured* (server has no client id → the screen says setup is pending), *connected* (address, last run, mails
  seen, run state in words) and *auth_failed* („A Google visszavonta a hozzáférést — lépj be újra” + the button).
  **Lecsatolás** revokes the token at Google (best effort) and deletes it (the classified items stay). The old
  six-step mirror guide and the app-password fields are gone from the app (the legacy `PUT` path remains, §4.2).
- **Ma.** Head verdict + sentence, the highlight (best deal or the nearest due date), stat tiles (arrived · handled ·
  worth a minute), a heat strip of arrival by two-hour slot, people and sensitive rows first, then the four groups.
  Every number is measured from stored rows.
- **Szabályok.** *Amit gép soha nem olvas* (the seeded sensitive list + senders he adds), *Amit mindig megmutatok*,
  *Amit csendben eltészek*, and Boop's one-tap proposal to silence a sender after three *nem érdekel* in a row.
- **The wall.** Levél is the first life area on the Ma wall (`.expires`: a due-today/tomorrow deadline or a deal ≥ 8
  expiring within ~36 h; `.happened`: *Megjött a reggeli posta · N érdekes*).
- **When mail is not read:** a run with no model (cost cap hit or model down) falls back to rules-only grouping and the
  digest says so (`rulesOnly` + `rulesOnlyReason` `cap|failure`, taken from the **latest run of the day that did
model-relevant work** — classified mail or was rules-only — so an empty or failed 15:00 run never hides a morning cap); two runs in a row with zero new mail turn the mailbox
  state `silent` ("lehet, hogy a továbbítás leállt").

## 3. Architecture & data flow

```
MailJob (cron 08:00 / 15:00)  ──►  MailRunner.runAsync ──► per user with a connected mailbox:
   or POST /api/mail/mailbox/run       MailIntakeService.intake   (IMAP → redact → rules → store)
   (manual, cooldown)                  MailDigestService.process  (classify → score → screen → items)
                                       MailPurgeService.purge     (raw bodies > 30 d)
GET /api/mail/digest ──► MailDigestQuery.digest (reads items + messages; no model, no IMAP)
```

### 3.1 Schedule and runner

- **Two switches** (`FeaturesConfiguration.java:18-21`): `mezo.mail.enabled` (every mail bean) and
  `mezo.techcore.cron.mail-job.enabled` (only `MailJob`). Both **off** in `application.yml:474-476` and the test
  profile, so the feature ships dark; the job needs both. Env **`MEZO_MAIL_SECRET_KEY`** (base64 of 32 bytes) seals the
  mailbox password; `application.yml:476` carries a dev-only dummy default, the deploy supplies the real one from the
  `mezo-app` SealedSecret — **env lands before image** (check the pod tag after a deploy).
- `MailJob.java:22-27` — `@Scheduled(cron = ${mezo.mail.cron:0 0 8,15 * * *}, zone = ${mezo.mail.zone:Europe/Budapest})`,
  body = `MailRunner.runAsync()` only (the `PenzNewsJob` shape). `MailAsyncConfig.java:21` — one-thread `mailExecutor`,
  queue 8, `defaultCandidate=false`.
- `MailRunner.java:27` — `runAsync()` (`:51`) fans out over users with a connected mailbox
  (`UserFanOut.forEachActiveUser`), each user in its own try/catch (intake → digest), one purge after the fan-out.
  `runManualAsync(owner)` (`:66`) runs the same for one user, behind a DB cooldown (§3.9).

### 3.2 Intake — IMAP (legacy `imap` kind), cursors, idempotency

> Since 2026-11-25 the app connects only `google` mailboxes (§3.10); this IMAP path is intact but unused by the app.

`service/imap/ImapMailReader.java:58` (Angus Mail, IMAPS `imap.gmail.com:993`, one short-lived connection per run,
RFC 2971 `ID` when supported, 20 s timeouts). Folders **INBOX** then **`[Gmail]/Spam`** (iCloud forwards without SRS, so
its mail can fail SPF and land in Spam), at most **200 mails per folder per run** (`MailIntakeService.java:51`). The
folder is opened **read-only with `peek`** — no `\Seen` flag is set; attachments are never opened. A per-folder cursor
`(UIDVALIDITY, lastUid)` is the fast path; **the first run and a UIDVALIDITY change rescan only the last 7 days**.
Failures carry no cause or server text (password-safe) and nothing is logged beyond UID + exception class.

`MailIntakeService.java:48` — `intake(userId, trigger)` returns `IntakeResult(runId, List<IntakedMail>, failed)`:
- **Single flight** per mailbox (`:54` static `ReentrantLock`; a concurrent call returns `runId=null`, no-op).
- **Idempotency:** native `INSERT … ON CONFLICT DO NOTHING` + read-back in `MailIntakeStore.java:33`; unique
  `(mailbox_id, gm_msgid)` (Gmail's `X-GM-MSGID`, same in every folder — a Spam→INBOX move never duplicates) and
  `(mailbox_id, content_hash)`; a mail already stored is never re-classified (re-classification is where money leaks).
  A mail without a Message-ID gets a synthetic id from folder + uid.
- **Rules run once per message** and the redacted text, headers and verdict ride in memory (`IntakedMail`); the **raw
  text is never persisted**. One malformed mail is skipped (UID logged only) and the cursor still advances past it.
- **State machine** (`MailIntakeStore.recordRun`): auth failure (or an unreadable stored secret) → `auth_failed`, no
  cursor change; unreachable → state kept, run outcome `unreachable`; ok with 0 new → streak + 1 (`silent` at ≥ 2); ok
  with ≥ 1 new → streak 0, `connected`. Any other exception → run outcome `error` / `MAIL_INTAKE_ERROR`.

### 3.3 Redaction — before a single token is spent

`service/redact/MailRedactor.java:23` (pure, no Spring): prefer `text/plain`, else sanitize HTML (jsoup — drop head,
style, script, images, comments, all attributes); links become anchor text + **bare host** (visible bare URLs too);
**mask** e-mail addresses, IBAN/card/Hungarian account shapes, labelled references (order/booking/invoice), phone
numbers and digit runs ≥ 8; **keep** due dates, amounts, carrier names and parcel status words; truncate to
`bodyMaxChars` (default 6000, ≈ 1 500 tokens). The schema.org JSON-LD block is lifted out **before** sanitizing and
stays raw — it never goes to a model (`RedactedMail.jsonLd`). `MailRedactor.plainText` gives the rules the *unmasked*
text (tracking numbers and login codes are masked in the redacted body but must be matched in the raw).

### 3.4 Rules before any model

`service/rules/MailRules.java:26` `decide(headers, rawText, redactedBody, ownerRules)` → `RuleVerdict`, in this order:
1. **Sensitive** (`SensitiveSeed` seeded domains — Hungarian banks, insurers, `gov.hu`/ügyfélkapu, health providers —
   plus explicit login-code wording, plus owner `sensitive` rules). A match is classified by rule, **subject and body
   are not stored** (only sender, date, the matching rule), and the mail is **never sent to a model**.
2. Owner `always` rule → *Person* (the only rule that says person); owner `silent` rule → *A többi* (`csendben`);
   bulk detection (`BulkDetector`: List-Unsubscribe / Precedence / known bulk domains) only marks the mail bulk —
   **every non-bulk mail without another verdict goes to the model as `NeedsModel(false)`** (final review, so a bill
   from `szamla@…` or `info@…` is classified, not filed as a person). Mail fetched from **`[Gmail]/Spam` is never a
   person by rule**: it reaches the people block only if the screen answers CLEAN, otherwise (model down, cap hit, or
   flagged) it is filed under *A többi* as **„Gyanús”**.
3. **JSON-LD** (`JsonLdReader`): `ParcelDelivery`, `Invoice`, `EventReservation`, deal annotations fill the fields.
4. **Carrier rules** (`CarrierRules`: GLS, Foxpost, Packeta, MPL, DPD → tracking pattern → status words): parcel
   mail never reaches a model. **The carrier patterns and status words are `// provisional`** (§9).
5. Known newsletter/social senders → *A többi* with a category.
6. Whatever remains is `NeedsModel`. `via()` (`:74`) reads `X-Forwarded-For` / `X-Forwarded-To` / `To:` to say
   `gmail` / `icloud` / `unknown` (best effort; SPF/DKIM results are **not** a trust signal — forwarding breaks them).
The owner's rules reach the pure core as `SenderRule(pattern, Kind)` (`SENSITIVE | SILENT | ALWAYS`).

### 3.5 The model funnel (cheap tier, three slugs)

`MailDigestService.java:68` — `process(userId, IntakeResult)`, the whole pass under `LlmActorContext.runAs(owner)` (else
`llm_log.created_by` is null and the cost cap never trips). It never throws (per-item and per-step catches, a `finally`
closing the run row) and also picks up messages with no item (a crash window), from their stored redacted text.

| Step | Slug (`LlmCallContext`) | Input | Output |
|---|---|---|---|
| classify + extract | `mail_classify` | one call per `NeedsModel` mail: subject, sender domain, redacted body, fenced as data (`ClassifyPrompt.java:23`) | group, one-line Hungarian summary, the group's fields |
| relevance + score | `mail_score` | **one batched call per run** over deal candidates + up to 8 recent feedback examples (`ScorePrompt.java:25`); **no goal context in v1** (ruling R5) | 1–10 score + "miért érdekes" |
| screen | `mail_screen` | each shown deal ≥ 7, every model deadline, and every JSON-LD deadline/deal (`ScreenPrompt.java:14`) | `CLEAN / FLAGGED / UNKNOWN` |

The port is `MailClassifierLlm` (`service/MailClassifierLlm.java:13`), the adapter
`feature/companion/llm/MailClassifierLlmAdapter.java:25` (`runWith(new LlmCallContext(...))`, empty on any
`RuntimeException`, logs the class name only). `LlmCallContext.keepsPayload()` is **false for all three slugs** so
mail text never lands in `llm_log_history`. `FakeCompanionLlm` has a `[fake-mail:<base64>]` script hook.

**Validation** (`classify/MailOutputValidator.java:44`, static, injectable `Clock`): a date is kept only if the same
calendar date is parseable from the mail text (year-less → next occurrence; kept → 23:59 local that day); an amount
only if the same value stands next to Ft/HUF/€/EUR in the model's currency; strings are NFKC-normalised, stripped of
invisible characters and **blanked if they carry a link or phone shape** (a title with a link rejects the item);
scores only for asked ids, integer 1–10; unknown group **and** `sensitive` → empty. `MailFence` fences untrusted text
(copy of Pénz's `sanitizeUntrusted`; mail must not import `penz`). **Fail-closed screen** (rulings R9/R10): only a
`clean` screen lets a model- or JSON-LD-sourced item notify; unscreened or `unknown` never notifies and shows no warning;
`flagged` shows the warning. `mail_item.screen` is `none|clean|flagged|unknown`.

**Cost cap.** `MailCostCap.java:26` sums the three slugs' cost since the Budapest day start through
`LlmLogRepository.costForOwnerFeatureSince` (DB-backed, survives restarts); `allows` = sum < `daily-usd-cap`
(**0.15 USD/day**, ≈ €3/month). Hit → remaining mail falls back to rules-only (`rules_only_reason = cap`). The three slugs
are also in `application.yml:746-749` throttled features, and the account-wide `LlmBudgetService` still applies.
A first model failure stops the model step for the pass (`rules_only_reason = failure`).

### 3.6 Items, lifecycle and the digest

`MailItemStore.java:34` writes `mail_item` rows. Lifecycle (`open_until`): a deadline stays until due + 1 day; a parcel
until *átvetted* + 1 day, else 14 days (`delivered` never regresses); a deal until `valid_until` or 3 days; rest /
person / sensitive 1 day. A parcel is **one row per `(created_by, carrier, parcel_key)`** (upsert; `state_changed_at`
moves only on a real change; a model-only parcel's key is `m<messageId>` so it never merges with a rule parcel).

`MailDigestQuery.java:41` `digest(user, day, now)` returns today's arrivals **plus** the open items from any day:
`arrived` / heat slots (12 two-hour slots, by received hour) / rest groups count mail **ingested** on the Budapest day
(`mail_message.created_at`); **worthAMinute** = people + sensitive + deadlines first seen today + parcels whose state
changed today + unflagged deals ≥ 7; **handled** = max(0, arrived − worth). Sensitive cards carry only the sender.
`rest[].items` holds up to 20 newest non-sensitive lines for the folding row. **Notifiable** (the wall's gate, computed
here): not flagged AND (deal: `screen = clean`, score ≥ 8, `valid_until` in (now, now + 36 h]) or (deadline: due today
or tomorrow Budapest, due time not passed; rule-sourced deadlines need no screen).

### 3.7 Learning

`MailLearning.java:41` + `classify/SenderPrior.java:8`: each tap is a `mail_feedback` row (a second tap on the same item
replaces the first, `updated_at`). `SenderPrior.shift` = a Laplace-smoothed share of *érdekel* per sender, scaled by
freshness (half-life 90 days), clamped to **−2..+2** and applied to the model score **outside the model**; the clamp to
1..10 follows. `proposals()` returns senders with ≥ 3 consecutive *nem érdekel* (`silentAfterNopes`); nothing changes
without his tap. `examples()` feeds the last 8 tapped deals (redacted one-liner + verdict) into the score prompt.

**Subjects are masked too** (`MailRedactor.mask`, final review): the classify, score and screen prompts and the
JSON-LD title fallback carry the masked subject, and the validator checks model dates/amounts against
masked subject + redacted body. Bare `www.host/path?query` links (no scheme) are cut to the bare host like `https://`.

### 3.8 Credential

`MailCredentialCipher.java:21` — **AES-256-GCM**, 12-byte nonce, 128-bit tag, key from `mezo.mail.secret-key` validated
in the constructor (`MAIL_SECRET_UNREADABLE` if a stored secret can no longer be opened). **No default key ships in
`application.yml`** (`${MEZO_MAIL_SECRET_KEY:}`): with mail enabled the cipher refuses a blank key, and refuses the
test dummy whenever `mezo.auth.strict=true` (prod, `MEZO_AUTH_STRICT`), so a forgotten secret fails startup instead of
sealing his password with a public key. The dummy lives only in the test `application.properties`. `MailMailboxService.java:30`:
connect = verify IMAP login **first** (422 `MAIL_AUTH_FAILED`, 503 `MAIL_UNREACHABLE`), strip whitespace, seal, store;
the password is never logged, never echoed, never returned; disconnect nulls both secret columns (the address stays).
Changing the address drops the old folder cursors.

### 3.10 Google sign-in and the Gmail API reader (2026-11-25, spec §12)

- **Mailbox kinds.** `mail_mailbox.kind` is `imap | google` (changeset
  `1.1.0/script/202611251200_mezo-r36n9.38_mail_google.sql`, `varchar(8) not null default 'imap'`, check constraint,
  appended last in `1.1.0_master.yml`; the v3.33.0 changeset is untouched). `MailIntakeService` branches on `kind`; both
  go through the same `persist(...)` (same store, rules, redaction).
- **Personal-mode OAuth app.** The owner creates a Google Cloud project in **Personal** user type (an app only its
  creator can authorise: no 100-user cap, no 7-day test-token expiry, no unverified-app screen, no verification/CASA),
  enables the Gmail API and creates an **iOS OAuth client** for Boop's bundle id. The client id is **public**.
- **Sign-in on the phone.** `ASWebAuthenticationSession` + **PKCE** (`GooglePKCE.swift`), redirect
  `com.googleusercontent.apps.<id-prefix>:/oauth2redirect`, scopes `gmail.readonly openid email`; no Google SDK. The
  phone posts `{code, codeVerifier, redirectUri}` once to `POST /api/mail/mailbox/google`; the redirect must equal the
  reversed client id scheme (else 400 `MAIL_GOOGLE_REDIRECT_INVALID`).
- **Server exchange + refresh** (`service/google/GoogleOAuthClient`, RestClient 10 s, **no client secret** — the iOS
  client id is used for the exchange and for every refresh; with a Personal app only his account can authorise). The
  **refresh token is sealed with the same AES-GCM cipher in the same columns as the app password** and never returned
  or logged. The **id_token** is checked (`aud` = client id, `iss` Google, `email_verified`) and gives the address. A
  missing refresh token is `MAIL_AUTH_FAILED`.
- **Revoke.** `DELETE /api/mail/mailbox` on a google mailbox calls Google's revoke endpoint first (best effort, a failure
  never blocks). Replacing the account also revokes the old grant (google → imap, account A → account B); re-consenting
  with the **same** account does **not** revoke (Google may treat old and new refresh tokens as one grant).
- **`GmailApiReader`** (`service/google/GmailApiReader`): the **first run** lists `newer_than:7d` for labels **INBOX +
  SPAM**; later runs use `users.history.list` from the stored `historyId` (`messageAdded`, paginated); a **404** (history
  expired) falls back to a **bounded full sync** of the last 7 days. **200-per-label cap:** the list is capped per label
  and a full sync over the cap skips the oldest mails; when the cap is hit inside history the cursor advances to that
  record (overflow skipped, never a stall). Each mail is `messages.get format=raw` → the shared **`MimeMailExtractor`**
  (`service/imap/`, extracted from the IMAP reader) so redaction/rules/pipeline are identical. Folder `INBOX` /
  `[Gmail]/Spam`, `uid = uidvalidity = 0`, `gm_msgid` = the hex API id, `receivedAt` = `internalDate`. The cursor row is
  folder `gmail-api`, `last_uid` = `historyId` (read before listing, advances even on an empty run).
- **Error classification.** Gmail API: **401** and 403 `insufficientPermissions` / `PERMISSION_DENIED` →
  `MAIL_AUTH_FAILED` (re-login state); **429**, **5xx**, `rateLimitExceeded` / `userRateLimitExceeded` /
  `dailyLimitExceeded`, `accessNotConfigured` / `SERVICE_DISABLED` and any unknown 403 → `MAIL_UNREACHABLE`. Token
  endpoint: `invalid_grant` (revoked / expired) and other 4xx → `MAIL_AUTH_FAILED`; `invalid_client` /
  `unauthorized_client` / `invalid_request` (a configuration problem, not his login) → `MAIL_UNREACHABLE` + a WARN;
  5xx/IO/429 → `MAIL_UNREACHABLE`. Logs name status + reason, never a token.
- **Host allow-list.** `MailProperties.Google.isEndpointsAllowed()` (`@AssertTrue`) fails startup of an enabled mail
  feature unless token/revoke URLs are https on exactly `oauth2.googleapis.com` and the API URL on
  `gmail.googleapis.com` (no userinfo; loopback hosts exempt for tests). The client id and redirect override are
  stripped once in the record's compact constructor (blank → null).
- **Config.** New env **`MEZO_MAIL_GOOGLE_CLIENT_ID`** → `mezo.mail.google.client-id` (a **public** identifier, not a
  secret). Blank ⇒ `GET` returns `googleClientId: null` and connect is 409 `MAIL_GOOGLE_NOT_CONFIGURED`.

### 3.9 Health and manual runs

`MailHealth.java:23` — gauges `mezo.mail.zero.run.streak` (max) and `mezo.mail.auth.failed` (0/1), recomputed from the
table at startup and after every run (disconnected mailboxes excluded); vmalert rules `MailMailboxSilent`
(`streak ≥ 2`) and `MailMailboxAuthFailed` in `k8s/monitoring/vmrule-mezo.yaml:65-74`. A manual run
(`POST /api/mail/mailbox/run`) answers 202 (async); a DB cooldown on `mail_mailbox.last_run_at` (fallback: latest run's
`started_at`) of `manual-run-cooldown-minutes` (10) answers 429 `MAIL_RUN_COOLDOWN`; no mailbox → 409 `MAIL_NOT_CONNECTED`.

### 3.10 Retention

`MailPurgeService.java:15` runs after each fan-out: `body_redacted` is dropped (and `body_purged` set) on rows older
than `raw-retention-days` (**30**), including soft-deleted rows. The classified item (group, fields, score, feedback)
is kept for learning and history; sensitive mail has no body to purge.

## 4. Data model & API

### 4.1 Configuration (`MailProperties.java:33`, prefix `mezo.mail`)

| Key | Default | Meaning |
|---|---|---|
| `enabled` | false | all mail beans |
| `techcore.cron.mail-job.enabled` | false | the scheduled `MailJob` |
| `secret-key` (env `MEZO_MAIL_SECRET_KEY`) | none (test dummy only in test properties) | base64 AES key for the app password |
| `cron` / `zone` | `0 0 8,15 * * *` / Europe/Budapest | schedule and the "day" of the cap |
| `daily-usd-cap` | 0.15 | per Budapest day, the three mail slugs |
| `deal-worth-threshold` / `notify-threshold` / `notify-window-hours` | 7 / 8 / 36 | worth-a-minute, ring score, ring window |
| `silent-after-nopes` / `feedback-half-life-days` / `few-shot-examples` | 3 / 90 / 8 | learning |
| `body-max-chars` / `raw-retention-days` / `manual-run-cooldown-minutes` | 6000 / 30 / 10 | |
| `imap-host` / `imap-port` | `imap.gmail.com` / 993 | legacy IMAP kind; the ITs point them at GreenMail |
| `google.client-id` (env `MEZO_MAIL_GOOGLE_CLIENT_ID`) | blank | public iOS OAuth client id; blank = Google sign-in unconfigured |
| `google.redirect-uri` / `token-url` / `revoke-url` / `api-url` | derived / Google hosts | overrides for tests; host allow-list applies (§3.10) |

### 4.2 Endpoints (contract `api/feature/mail/mail.yml`, tag `Mail`, `MailController.java:33`)

| Method + path | operationId | Notes |
|---|---|---|
| `GET /api/mail/mailbox` | `getMailMailbox` | `{kind imap|google|null, googleClientId, address, state none|connected|silent|auth_failed|disconnected, lastRunAt, lastFetched}` |
| `POST /api/mail/mailbox/google` | `postMailMailboxGoogle` | body `{code, codeVerifier, redirectUri}`; server exchanges, seals the refresh token; 400 `MAIL_GOOGLE_REDIRECT_INVALID`, 409 `MAIL_GOOGLE_NOT_CONFIGURED`, 422 `MAIL_AUTH_FAILED`, 502 `MAIL_UNREACHABLE` |
| `PUT /api/mail/mailbox` | `putMailMailbox` | legacy IMAP/app-password connect, unused by the app; body `{address, appPassword}`; verifies IMAP first; 422 `MAIL_AUTH_FAILED`, 503 `MAIL_UNREACHABLE` |
| `DELETE /api/mail/mailbox` | `deleteMailMailbox` | Lecsatolás: google token revoked at Google first (best effort); state `disconnected`, secrets nulled |
| `POST /api/mail/mailbox/run` | `runMailMailbox` | 202; 409 `MAIL_NOT_CONNECTED`; 429 `MAIL_RUN_COOLDOWN` |
| `GET /api/mail/digest?date=` | `getMailDigest` | counts, 12 heat slots, `people / sensitive / deadlines / parcels / deals`, `rest[{category,count,items}]`, `rulesOnly(+Reason)`; item `screen`, `flagged`, `notifiable`, `gmailMessageId` (decimal string) |
| `POST /api/mail/items/{id}/feedback` | `postMailFeedback` | `{verdict: interest|nope}`; 204; 404 `MAIL_ITEM_NOT_FOUND` for a foreign item |
| `GET/PUT /api/mail/rules` | `getMailRules` / `putMailRules` | `{sensitive, silent, always, proposals}`; seed rows read-only; PUT replaces the owner's lists (`@domain` or full address, ≤ 200 per list) |

Wire shapes are lenient on the phone (hand-written client, not the generator): a new enum string must not break a
digest. The contract is appended **last** in `api/generate/merge.yml` (forgetting the append drops it silently).

### 4.3 Tables

One changelog, [`202611211200_mezo-r36n9.38_mail.sql`](../../backend/src/main/resources/db/changelog/1.1.0/script/202611211200_mezo-r36n9.38_mail.sql)
(named constraints, partial unique indexes, **no seed rows** — the seed sender lists live in code):

| Table | Holds |
|---|---|
| `mail_mailbox` | one live per owner: `address`, `secret_cipher` / `secret_nonce` (nullable after Lecsatolás), `state`, `zero_run_streak`, `last_run_at` |
| `mail_folder_cursor` | per mailbox + folder: `uidvalidity`, `last_uid` |
| `mail_run` | one per pipeline run: `trigger cron|manual`, `fetched`, `classified`, `rules_only` + `rules_only_reason cap|failure`, `outcome`, `error_code` |
| `mail_message` | the stored mail: `gm_msgid`, `message_id`, `content_hash`, folder + uid + uidvalidity, sender, `via`, `subject`, `body_redacted` (+ `body_purged`), `sensitive` (headers only), `processed_at` |
| `mail_item` | the classified item: `grp deadline|parcel|deal|rest|person|sensitive`, `category`, `title`, `summary`, `why`, `score`, `due_at`, `valid_until`, amount + currency, carrier + `parcel_key` + `parcel_state in_transit|today|pickup|delivered`, `state_changed_at`, `open_until`, `screen`, `source rule|jsonld|model` |
| `mail_feedback` | `verdict interest|nope`, sender, one-line summary, `updated_at` |
| `mail_sender_rule` | owner rules: `pattern` (address or `@domain`), `kind sensitive|silent|always`, `origin` |

All seven are in `support/ResetDatabase.java:57` and `MailPopulator`.

## 5. Integrations

- **Gmail IMAP** (the only mail door) — Angus Mail `2.0.5` (BOM-managed); ArchUnit forbids `jakarta.mail` outside
  `feature/mail` (`ArchitectureTest.java:110-115`). Tests use GreenMail `2.1.3` over IMAPS.
- **Companion → LLM** — port `MailClassifierLlm` in `feature/mail`, adapter in `feature/companion/llm`, cheap tier
  `chat-model`; usage rows in `llm_log` under the three slugs (payload not kept).
- **Monitoring** — Micrometer gauges + two vmalert rules (§3.9); there is no admin screen (#52), the Fiókok tab is the
  owner-facing surface.
- **The iPhone** — [`boop-ios.md`](boop-ios.md) §2 *Levél*: `ios/BoopKit/Sources/BoopCore/Level/*` (client, store, wire),
  `ios/Boop/Level/*` (screens), the wall source and `ios/Boop/Nap/WallNotifier.swift`.

## 6. How to use it (consume)

The phone is the only client. `LevelClient` calls the eight operations above (operation ids in
`ios/BoopKit/Sources/BoopCore/Level/LevelClient.swift`); `LevelStore` caches the digest per Budapest day under
`ServerCache` key `level/digest` (offline → the last cached day, marked stale) and the mailbox under `level/mailbox`.
To read the digest from anything else, `GET /api/mail/digest` with the user's JWT; never expect a body for a
`sensitive` item — the card is sender-only by design.

## 7. How to extend it

- **A new carrier:** add its sender domain, tracking pattern and status words to `CarrierRules` with a test in
  `CarrierRulesTest`; carrier **and** `parcel_key` must always be set together (the unique index needs a non-null
  carrier).
- **A new sensitive sender:** `SensitiveSeed` (code, not a migration).
- **A new group or field:** extend `Group`/`RuleVerdict`, the validator, `MailDigestQuery.ItemView`, `mail.yml`
  (+ regenerate `api/openapi.yml`), the lenient wire on the phone, and `ck_mail_item_grp`. Add the slug to
  `LlmCallContext.keepsPayload()`'s deny list if a new model call is added — otherwise mail text persists.
- **L3 (price check, *Figyelt*):** builds on `mail_item` deals and `PenzHttpFetcher`'s SSRF-guarded fetcher
  ([`penz.md`](penz.md) §3.8); budget 10 checks/day (decision 2026-11-21).

## 8. Testing

Focused gate: `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='Mail*Test,Mail*IT,SenderPriorTest,LlmCallContextTest,ArchitectureTest'`
(113–126 tests at the last task commits, 0 failures). Real Postgres via Testcontainers; IMAP via GreenMail.

- `MailSchemaIT` (schema + constraints), `ImapMailReaderIT` (read-only/peek, cursors, 7-day window, malformed mail,
  charsets), `MailIntakeIT` (idempotency, run state machine, single flight, purge), `MailDigestPipelineIT` (parcel
  rules without a model, sensitive never reaches the model, cap trips through the real adapter, rules-only fallback,
  injection cannot raise a score or invent a date, deadline rolling, learning), `MailCostCapIT`, `MailApiIT` (every
  endpoint, password never echoed, 401), `MailJobSwitchIT` / `MailJobEnabledIT` (the job bean exists only with both
  switches), pure `MailRedactorTest`, `MailRulesTest`, `CarrierRulesTest`, `JsonLdReaderTest`,
  `MailOutputValidatorTest`, `MailPromptInjectionTest`, `SenderPriorTest`, `MailCredentialCipherTest`.
- Traps: scheduling is off in tests (ITs call the runner); fixtures are anchored to the queried Budapest day (the
  08:00/15:00 split is midnight-fragile); jsonb `?` in Liquibase SQL must be `jsonb_exists()`.
- iOS: BoopKit `Level*Tests` + `LevelWallTests`, app `LevelRoomTests` and `WallNotifierTests` (see
  [`boop-ios.md`](boop-ios.md) §8).

## 9. Decisions, gotchas & deferred

- **Owner decisions 2026-11-21** (spec §2, handbook `_dontesek.json`, `14-decisions.md` #85–#93): consumer Gmail → IMAP
  + app password (no OAuth); a **mirror** Gmail fed by Gmail and iCloud; ring for a good deal within decision #35's
  cap; 10 price checks a day for L3; L1 + L2 in one release; the four groups; approach A (server polls twice a day);
  he sets the mirror up himself.
- **Owner decision 2026-11-25** (spec §12, `14-decisions.md` #112, supersedes the mirror decisions): no mirror mailbox —
  Google sign-in to his own Gmail (Personal-mode OAuth app, so no weekly re-login); iCloud may forward into the Gmail.
- **Privacy:** sensitive mail is headers-only and never modelled; redaction before any token; no real mail content in
  commits, docs or Notion; nothing leaves the owner's cluster except the redacted text sent to the cheap model.
- **Known limitations** (said out loud):
  1. **Rings are scheduled only when the app is opened** — no background refresh and no server push until the paid
     Apple team (`mezo-r36n9.19`); server push is the follow-up. Timing is therefore not exact.
  2. **The carrier patterns and status words are provisional** (built without real carrier mail; ruling R3) — a parcel
     mail that matches no pattern falls through to the model (a small cost) or to *A többi*. They are to be confirmed
     against real mail in the mirror; the same goes for the iCloud `X-Forwarded-*` headers behind `via`.
  3. **The Gmail deep link** (`googlegmail:///cv=<hex id>`, fallback the app, then gmail.com) is **untested on a
     device**.
  4. **A tap on a ring only opens the app**, not the Levél room (no notification deep route).
  5. Only mail arriving after forwarding was set up is ever seen; mail after 15:00 waits for the next morning.
  6. `MailRunner.run()` fan-out over several users has no direct test; a full executor answers 429
     `MAIL_RUN_COOLDOWN`; two manual requests in the first seconds of a long run both pass (the single-flight lock makes
     the second a no-op); a newsletter orphan picked up by the crash-window path is classified *Person* (no stored
     headers); bare 4–5 digit login codes slip past the rules without explicit login wording (parked minor).
  7. Gmail's `X-GM-MSGID` live path is covered by a parse unit test only (GreenMail has no such extension).
- **Rejected:** Gmail API OAuth / Pub/Sub (restricted scope: 7-day tokens in Testing, CASA in Production), an own inbound
  domain (approach B), the phone reading mail (approach C), IMAP IDLE, a "processed" label in the mailbox.
- **Deferred:** L3 price check + *Figyelt*; AI threads / "miért?" from mail (L6); server push; a goal-sentence context
  for scoring (ruling R5).

## 10. Key files

`backend/…/feature/mail/service/{MailRunner,MailJob,MailIntakeService,MailIntakeStore,MailDigestService,MailItemStore,MailDigestQuery,MailLearning,MailCostCap,MailMailboxService,MailMailboxStore,MailRulesService,MailPurgeService,MailHealth,MailCredentialCipher,MailClassifierLlm}.java` ·
`…/mail/service/{imap,redact,rules,classify}/*` · `…/mail/{controller/MailController,config/{MailProperties,MailAsyncConfig},mapper/MailMapper}.java` ·
`backend/…/feature/companion/llm/MailClassifierLlmAdapter.java` · `backend/…/feature/llmlog/context/LlmCallContext.java` ·
`api/feature/mail/mail.yml` · `backend/src/main/resources/db/changelog/1.1.0/script/202611211200_mezo-r36n9.38_mail.sql` ·
`k8s/monitoring/vmrule-mezo.yaml` · tests under `backend/src/test/java/io/mrkuhne/mezo/feature/mail/`.
iPhone: `ios/BoopKit/Sources/BoopCore/Level/{LevelWire,LevelClient,LevelStore,LevelLogic}.swift` ·
`ios/BoopKit/Sources/BoopCore/Morning/WallSources.swift` (`levelWallCandidates`) ·
`ios/Boop/Level/{LevelRoom,LevelMa,LevelSzabalyok,LevelFiokok,LevelDealCard,LevelModel,LevelPreview}.swift` ·
`ios/Boop/Nap/{WallNotifier,MaWall}.swift`.
