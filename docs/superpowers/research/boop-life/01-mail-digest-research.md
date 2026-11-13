# Mail digest for a single-owner personal app — research

Source: web research, 2026-11-13

Context: one user (the app owner), Spring Boot on k3s, Postgres, OpenAI API with a cheap
model tier and a web-search capability. Never published, never multi-tenant.

---

## 1. Gmail read access

### 1.1 What class of scope is `gmail.readonly`?

Google classes Gmail scopes explicitly. Per
[Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes):

| Scope | Class |
|---|---|
| `gmail.readonly` | **Restricted** |
| `gmail.metadata` | **Restricted** |
| `gmail.modify`, `gmail.compose`, `gmail.insert`, `mail.google.com` | **Restricted** |
| `gmail.send` | Sensitive |
| `gmail.labels` | Non-sensitive |

So there is no "read-only is lighter" escape hatch: **any** scope that lets you see message
bodies or even headers is restricted. Restricted-scope apps must complete OAuth verification
**and** re-verify annually
([OAuth app verification overview](https://support.google.com/cloud/answer/13463073)).

### 1.2 Testing mode — the actual limits

[Google's OAuth 2.0 docs](https://developers.google.com/identity/protocols/oauth2) state
plainly: projects with an **External** user type and **Testing** publishing status are
"issued a refresh token expiring in 7 days", and the exception applies only to apps whose
sole scopes are `userinfo.email`, `userinfo.profile`, `openid`. A Gmail scope therefore
guarantees the 7-day expiry.

Other refresh-token killers on the same page, all relevant to us:
- six months of inactivity;
- **the user changing their Google password revokes refresh tokens that carry Gmail scopes**;
- 100 live refresh tokens per Google Account per OAuth client ID (oldest silently invalidated);
- admin / session-control policies.

Test-user cap: the "100 test users" figure is widely repeated by third parties
([unipile](https://www.unipile.com/google-oauth-100-user-limit/)) but could not be confirmed
on a current Google page in this sweep — **UNVERIFIED**. It is irrelevant for us anyway
(one user).

Practical consequence of 7-day expiry for a server job: the owner must re-consent in a browser
roughly weekly, or the digest silently dies. That is the single biggest operational objection
to testing mode. Several 2026 write-ups describe exactly this failure mode and "fix it by going
to production"
([Queen of San Diego, 2026-05-06](https://tech.queenofsandiego.com/posts/2026-05-06-1850.html)).

Note: **an Internal (Workspace) app is not subject to the 7-day rule.** If the owner's mail were
on a Google Workspace domain he controls, an Internal OAuth client with `gmail.readonly` needs
no verification and no CASA at all. This is the clean path *if* Workspace is in play —
**UNVERIFIED** whether the owner's mailbox is Workspace or consumer Gmail.

### 1.3 Full verification + CASA — money and weeks

- Google charges nothing for the assessment itself; you pay an ADA-authorised lab.
- Reported 2026 list prices: CASA **AL1** (formerly Tier 2) roughly **$500–$900** one-off,
  managed/enterprise variants $3,000–$4,500; **AL2** (Tier 3) around **$5,400**
  ([secusy.ai, 2026](https://www.secusy.ai/blog/google-casa-assessment-cost)).
- The oft-quoted "$50,000" figure is contested and appears to be outdated or premium-vendor
  pricing ([bright-softwares](https://bright-softwares.com/blog/en/google-workspace/the-50000-gmail-add-on-myth-what-google-s-casa-certification-really-costs)).
- Timeline: sources give only rough figures, commonly **4–6 weeks** for the Google security
  review on top of the lab work, and it must be **redone every year**.
- A developer report says restricted-scope OAuth review will require an ADA-CASA **AL1** by
  **2026-02-01 → 2027-02-01** ([GitHub issue](https://github.com/YehudaBriskman/WindoM/issues/321))
  — **UNVERIFIED**, one developer's paraphrase, not a Google statement.

Verification also requires a published privacy policy, a homepage on a verified domain, and a
demo video. For an app that will never have a second user, all of this is pure overhead.

### 1.4 App password + IMAP

Google retired "less secure app" password auth in 2022 for consumer Gmail and 2025 for
Workspace, so the account password no longer works over IMAP; the supported replacement for
non-OAuth clients is a **16-character app password**, available only when 2-Step Verification
is on, from `myaccount.google.com/apppasswords`. IMAP must additionally be switched on in
Gmail Settings → Forwarding and POP/IMAP. Server: `imap.gmail.com:993`, SSL, full address as
username.
(Multiple 2026 third-party guides agree:
[mailmeteor](https://mailmeteor.com/blog/gmail-smtp-settings),
[univik](https://univik.com/email-settings/gmail.html),
[clean.email](https://clean.email/blog/email-settings/gmail-email-settings).
Google's own Help Center page was not reached in this sweep — the *existence* of app passwords
in 2026 is well-corroborated but **officially UNVERIFIED here**.)

Caveats: an app password is a **full-mailbox bearer credential** (read *and*, via SMTP, send);
there is no read-only variant. It must live in a k8s Secret, never in git. A Workspace admin can
block IMAP org-wide.

### 1.5 Recommendation for Gmail

**App password + IMAP** is the pragmatic path for a never-published single-user app:
zero verification, zero CASA, no 7-day token dance, ~5 minutes of setup, and no dependency on
Google's app-review moods. The costs are a long-lived full-access secret and no Gmail-specific
niceties (History API, server-side search operators are partly replaced by IMAP SEARCH).

Fallback order: (1) **Internal Workspace OAuth client** if the mailbox is on a Workspace domain
(best of both worlds); (2) app password + IMAP; (3) testing-mode OAuth only if you accept a
weekly manual re-consent; (4) full verification + CASA — not justified here.

---

## 2. iCloud mail

- IMAP with an **app-specific password** is the only third-party route. Apple requires
  two-factor authentication on the account; the password is created in the Apple Account
  "Sign-In and Security" section
  ([Apple HT102654](https://support.apple.com/en-us/102654)).
- **Limit: 25 active app-specific passwords**; changing/resetting the Apple Account password
  **revokes all of them at once** (same Apple page). That is a real operational hazard: a
  password change silently kills the digest.
- Server settings (third-party, consistent): `imap.mail.me.com:993` SSL, username = the full
  iCloud address, often the part before `@` for legacy accounts
  ([skymigrate](https://skymigrate.com/icloud-mail-settings-for-outlook/),
  [univik](https://univik.com/email-settings/icloud.html)).
- **Custom domains** (iCloud+): sources conflict — "5 domains × 10 addresses" vs
  "5 domains × 3 addresses"; mail for custom domains lands in the same mailbox and is reachable
  over the same IMAP connection. The per-domain address count is **UNVERIFIED**.
- **Hide My Email** aliases (iCloud+) forward into the same inbox, so they are visible over
  IMAP. A June 2026 report says Apple is moving aliases to a single `private.icloud.com` domain
  ([closednetwork.io](https://closednetwork.io/apple-is-putting-a-uniform-on-your-private-email-heres-how-to-take-back-control/))
  — **UNVERIFIED**. Design implication: do not key sender-trust rules on the alias domain.
- **No public API.** Apple ships no iCloud Mail REST API; IMAP/SMTP is it.
- **Rate limits:** Apple publishes none for IMAP. Community lore says aggressive connection
  churn gets throttled. **UNVERIFIED** — treat "one long-lived connection, poll politely" as
  the safe assumption.

---

## 3. Server-side scheduling

Nothing exotic is required: a Spring `@Scheduled` cron (or Quartz with a Postgres job store if
you want missed-run recovery across pod restarts) running the digest at, say, 06:30 and a
second intraday pass at 14:00, both in the owner's timezone, with a Postgres table recording
last-processed UID/date so a restart cannot double-send or skip.

Mail-polling specifics worth knowing:

- **IMAP IDLE** gives near-real-time push but needs a persistently held connection and
  reconnect logic (servers drop IDLE every ~29 min by convention). For a *digest* — which by
  definition batches — IDLE buys nothing. Poll on the schedule.
- **Gmail `watch` + Pub/Sub push**: the notification payload carries only
  `{emailAddress, historyId}`; you still call `users.history.list` to learn what changed, and
  the **watch must be renewed at least every 7 days**
  ([Google push guide](https://developers.google.cn/workspace/gmail/api/guides/push)).
  Practitioners report push is unreliable enough that the standard pattern is push **plus** a
  periodic `history.list` fallback
  ([Hiver engineering](https://medium.com/hiver-engineering/gmail-apis-push-notifications-bug-and-how-we-worked-around-it-at-hiver-a0a114df47b4),
  [unipile](https://www.unipile.com/gmail-api-push-notifications/)).
- **Verdict for one user: Pub/Sub push is not worth it.** It adds a Cloud topic, an IAM grant,
  a public HTTPS endpoint on the k3s cluster, a renewal job, and a reliability caveat — to save
  two IMAP polls a day. Quota pressure, the actual reason push exists, does not apply at one
  user.

Idempotency notes: store `(mailbox, uidvalidity, uid)` — IMAP UIDs are only unique within a
`UIDVALIDITY` epoch, and a server-side mailbox rebuild resets it. Also store a content hash so a
re-delivered message is not re-summarised (re-summarising is where money leaks).

---

## 4. Privacy — what may go to a hosted LLM

### 4.1 Provider terms (2026)

**OpenAI:** API inputs/outputs retained up to **30 days** for abuse monitoring, then deleted
unless legally required; **API data is not used for training by default**. **Zero Data
Retention** is not a self-serve toggle — it requires a qualifying use case and sales approval,
excludes some stateful endpoints (conversations/threads/assistants), and metadata is still
stored. (Corroborated across
[meetily](https://meetily.ai/llm-privacy/openai),
[privedge](https://privedge.io/blog/what-data-openai-stores-api/),
[hardshell](https://hardshell.ai/zero-data-retention-explained); `openai.com/policies/api-data-usage-policies`
returned 403 and could not be fetched directly — the *exact* current wording is **UNVERIFIED**.)

**Anthropic:** API content is not retained by default and is never used for training without
express permission; however, effective **2026-06-09** certain "Covered Models" carry a mandatory
**30-day retention** and cannot be used under a ZDR agreement; other models remain ZDR-eligible.
ZDR requires a signed addendum, not a dashboard switch.
([Anthropic API & data retention docs](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention.md),
[privacy.claude.com](https://privacy.claude.com/en/articles/15425996-data-retention-practices-for-covered-models).)

For a one-person personal app, ZDR is unobtainable (no enterprise contract) and unnecessary:
30-day abuse-monitoring retention with no training is the realistic baseline. The real control
is **what you send**, not what they promise.

### 4.2 What is genuinely risky vs. not

**Low risk — send it:** subject lines, sender display name and domain, promotional body copy,
product names, prices, discount percentages, validity dates, category text. This is marketing
material that was blasted to millions of recipients; it is not personal data about the owner
beyond the fact that he is on a list.

**High risk — strip before sending:** anything that is a *credential or an identifier of him*:
- unsubscribe / tracking URLs (they embed a per-recipient token that identifies the mailbox and
  is often a one-click-unsubscribe capability — an LLM echoing it into a log is a real leak);
- tracking pixels and all `<img>` URLs with query strings;
- his own e-mail address and any hashed form of it;
- order numbers, booking references, invoice numbers, loyalty numbers;
- partial card numbers, IBANs, amounts tied to *his* account (bank/utility mail);
- postal address, phone, date of birth;
- any 2FA code / magic-link mail (never send these to an LLM at all — classify them by sender
  rule and drop them).

**Practical redaction pipeline** (all before the first token is spent):
1. Parse MIME; take `text/plain` if present, else convert `text/html` with a sanitizer
   (jsoup) — strip `<style>`, `<script>`, `<head>`, comments, and all attributes.
2. Drop every image; replace links with their visible anchor text plus the **bare host**
   (`example.com`), discarding path and query entirely. This kills tracking tokens and saves a
   lot of tokens at the same time.
3. Regex-mask: e-mail addresses, long digit runs (≥8), IBAN-shaped strings, card-shaped strings,
   `order|rendelés|azonosító|booking` followed by an alphanumeric token.
4. Collapse whitespace; truncate to a sane cap (e.g. 1,500 tokens) — promo mail repeats itself.
5. Maintain a **sender allow/deny list in Postgres**: bank, employer, health, government senders
   never reach the LLM; they are surfaced by rule only.

Keep the raw message in Postgres (it is already on the owner's own cluster) and send only the
redacted projection. That way a prompt-injection or a retention surprise costs you marketing
copy, not his identity.

**Prompt injection is the under-rated risk here.** Promotional mail is attacker-controlled text
flowing into an LLM that then produces output the owner trusts. Treat message bodies as data:
put them in a clearly delimited block, instruct the model that nothing inside is an
instruction, never let the mail-reading model call tools that write or send, and never execute
URLs it emits.

---

## 5. Cost

Prices used, from [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
(Standard tier, per 1M tokens, fetched 2026-11-13):

| Model | Input | Cached in | Output |
|---|---|---|---|
| gpt-5-nano | $0.05 | $0.005 | $0.40 |
| gpt-5-mini | $0.25 | $0.025 | $2.00 |
| gpt-6-luna | $0.10 | $0.01 | $0.50 |
| gpt-6.1-terra (frontier) | $1.00 | $0.05 | $5.00 |
| gpt-6-sol (frontier) | $2.00 | $0.20 | $10.00 |

Web search tool: **$10.00 per 1,000 calls**, plus search-content tokens billed at the model's
rate (same page).

### 5.1 The HTML bloat driver

A typical promotional HTML mail is 50–150 KB of markup. Tokenised raw, that is roughly
**15,000–40,000 tokens** per message. After the sanitize-to-text + strip-links pipeline above,
the same message is typically **400–900 tokens**. Call it **~600 tokens stripped vs ~25,000
raw: a 30–40× reduction.** This is by far the biggest single cost lever in the whole system —
bigger than the choice of model tier.

Worked: 50 mails/day on gpt-5-nano, pass 1 only:
- raw HTML: 50 × 25,000 = 1.25M input → **$0.063/day**
- stripped: 50 × 600 = 30k input → **$0.0015/day**

Stripping HTML saves ~97% of pass-1 cost. (And it also removes the tracking tokens — the
privacy fix and the cost fix are the same code.)

### 5.2 Per-day totals, 50 mails, 10 interesting items, 10 price checks

Assumptions: 50 mails/day at 600 stripped input tokens each, ~150 output tokens each (label +
2-sentence summary). Pass 2 = one call, ~3,500 input (10 item summaries + ~1,500 tokens of goal
context, cacheable) and ~800 output. Pass 3 = 10 web-search calls, ~8,000 search-content input
tokens and ~300 output tokens each.

**Cheap tier (pass 1+2 on gpt-5-nano / gpt-6-luna, web pass on gpt-6-luna):**

| Stage | Cost/day |
|---|---|
| Pass 1 — classify + summarise 50 mails (nano) | $0.0045 |
| Pass 2 — relate 10 items to goals (luna) | $0.0008 |
| Pass 3 — 10 web-search calls (tool fee) | $0.1000 |
| Pass 3 — search content tokens (luna) | $0.0095 |
| **Total** | **≈ $0.115/day ≈ €0.105/day ≈ €3.2/month** |

**Frontier tier (gpt-6.1-terra for passes 2–3, gpt-5-mini for pass 1):**

| Stage | Cost/day |
|---|---|
| Pass 1 (gpt-5-mini) | $0.0225 |
| Pass 2 (terra) | $0.0075 |
| Pass 3 tool fee (10 calls) | $0.1000 |
| Pass 3 search content (terra) | $0.0950 |
| **Total** | **≈ $0.225/day ≈ €0.21/day ≈ €6.3/month** |

**All-frontier (gpt-6-sol everywhere):** ≈ **$0.44/day ≈ €0.40/day ≈ €12/month**.

### 5.3 Per-item figures and the real driver

- Classify + summarise one mail: **$0.00009 (nano)** to **$0.0006 (gpt-6-sol)**.
- One price check with web search: **$0.011 (cheap)** to **$0.030 (frontier)** — of which
  **$0.010 is the flat tool fee, independent of model.**

**The dominant cost is the web-search tool fee, not the LLM.** At 10 checks/day it is 85–90% of
the cheap-tier bill. Levers, in order of effect:
1. Strip HTML (97% off pass 1).
2. **Cap and dedupe price checks** — check only items above a price threshold, and cache the
   result per product for 7–14 days. Cutting 10 checks/day to 3 takes the cheap tier from
   ~€3.2/month to **~€1.2/month**.
3. Use a cheap tier for pass 1 and spend the quality budget only on pass 2.
4. Prompt caching on the goal/profile block ($0.005–0.05/1M vs $0.05–1.00) — small absolute
   saving at this volume, but free to switch on.
5. **Batch API** (listed as cheaper on the same pricing page) suits a 06:30 digest that can
   tolerate latency — **UNVERIFIED** discount percentage for the specific models above.

**Bottom line: €1–€6 a month, realistically ~€3.** This is not a cost-constrained problem; it is
a quality- and privacy-constrained one.

---

## 6. Prior art

### Shortwave — AI e-mail client (commercial, Gmail-only)
- Does well: AI summary per thread, AI search, AI filters; reviewers say the time saving is
  real ([email-tools.me](https://email-tools.me/posts/shortwave-review/)).
- The digest: **there isn't one by default.** A 2026 review states flatly "There is no daily
  briefing" — no overnight summary, no "what needs attention", no overdue follow-ups. A daily
  digest has to be hand-built as a scheduled "Tasklet" on a paid plan, and takes iteration
  ([get-alfred.ai](https://get-alfred.ai/blog/is-shortwave-worth-it)).
- Complaints: price; **AI request caps** (150–300/day) that bite once summaries are on by
  default; Gmail-only.
- **Lesson:** per-thread summarisation is the easy half and the less valuable half. The product
  people actually want — one scheduled briefing with a verdict — is the thing even the best-
  funded AI client failed to ship. Build the briefing, not the thread summaries.

### Meco — newsletter reader (commercial, iOS/Android)
- Does well: pulls newsletters out of the main inbox into a dedicated reader; clean design;
  responsive team; its *added* summary feature is what users single out as finally letting them
  catch up ([Product Hunt reviews](https://www.producthunt.com/products/meco/reviews)).
- Complaints: bugs; paywalled Gmail/Outlook sync; pricing inconsistently reported
  ($3.99–$4.99/mo).
- **Lesson:** separating newsletter/promo mail from "real" mail is itself most of the value,
  and it is a routing problem solvable with sender rules before any LLM runs. Classify first,
  summarise second — cheaper and more reliable.

### MailGester — open source, self-hosted (Ollama + Discord)
- [github.com/KBorupH/MailGester](https://github.com/KBorupH/MailGester). A local model reads
  Gmail and Outlook, junk folder included, posts a digest to Discord and **pings only when the
  model judges something important**. README's design stance: mail never leaves the machine,
  only the digest does.
- **Lesson:** the notification policy is a first-class design decision. A digest that always
  arrives is ignorable; a digest that arrives daily but *pings* rarely is read. Separate
  "published" from "interrupting".

### SummerMail — open source, self-hosted Gmail digest
- [github.com/wanleung/summermail](https://github.com/wanleung/summermail). Scores each mail
  with a **VIP list + keyword rules first**, then an LLM score, then summarises only the top
  items; pluggable across Ollama / OpenAI / Anthropic via a LiteLLM proxy; one docker-compose.
- **Lesson:** the hybrid rules-then-LLM funnel. Deterministic cheap filters do the bulk
  rejection; the model only sees candidates. This is exactly the architecture that makes our
  cost model come out at cents.

### MailDigest (PyPI 0.3.0, 2026-09-19)
- [pypi.org/project/maildigest/0.3.0](https://pypi.org/project/maildigest/0.3.0/). Reads a
  **mirror mailbox over IMAP** (not the primary account), summarises, runs a **second model as a
  phishing check**, delivers plain text to Telegram/Discord/Signal.
- **Lesson (two):** (a) point the reader at a *forwarded mirror mailbox* so the credential can
  never touch the real inbox — a cheap, strong blast-radius control we should copy; (b) a
  separate adversarial pass over untrusted mail content is cheap insurance against both phishing
  and prompt injection.

### Keepa / camelcamelcamel — deal credibility (the price-check half)
- Both exist because "50% off!" is meaningless without price history. Keepa's whole product is
  the chart; camelcamelcamel's is the alert on a real historical low.
- **Lesson:** a deal verdict without a price *history* is just restating the marketing claim.
  If we cannot get history, say so in the digest ("nem tudtam ellenőrizni") rather than inventing
  confidence. See §7 — this is the weakest leg of the whole feature.

---

## 7. Market / price-check feasibility (Europe, Hungary)

- **Keepa (Amazon only).** Real price history, the gold standard — but **no free API tier**;
  entry plan reported at **€49/month for 20 tokens/minute**, next tier ~€459/month; Keepa Pro
  (€29/mo) is the web UI, *not* API access
  ([revenuegeeks](https://revenuegeeks.com/software/keepa/api),
  [amzfinder](https://www.amzfinder.com/blog/keepa-api/)). €49/month to enrich a €3/month
  digest is wildly out of proportion, and Amazon.de/.hu coverage only helps for a slice of
  Hungarian promo mail.
- **Google Shopping.** The **Content API for Shopping was sunset 2026-08-18**, replaced by the
  **Merchant API v1**
  ([Google migration guide](https://developers.google.com/merchant/api/guides/compatibility/overview),
  [Productsup](https://www.productsup.com/blog/google-merchant-api-migration-what-changes-before-the-august-2026-deadline-and-how-to-prepare/)).
  Crucially, **the Merchant API is a merchant-side feed/inventory API, not a consumer price-
  comparison search API.** There is no public Google API that answers "what do other shops charge
  for this product" — that capability exists only inside the Shopping UI. Dead end.
- **Árukereső (HU).** No official public developer API was found. What exists is the
  merchant-side flow: you host an XML/CSV product feed and register its URL in the Partner Portal
  ([feed requirements](https://www.arukereso.hu/static/feed-requirements.html)). A commercial
  integrator advertises an "Árukereső Marketplace API" for sellers
  ([Zunapro](https://www.zunapro.com/hungary/en/marketplace/arukereso)) — seller-side, gated on
  a Hungarian VAT registration, and **UNVERIFIED**. Not usable for a private buyer-side lookup.
- **Scraping Árukereső / Alza / eMAG** is technically trivial and legally/ToS-wise the usual
  grey zone; it also breaks on every layout change. Not recommended as a dependency for a
  feature the owner is supposed to trust.

### What web-search-only realistically gets us
A web-search call can reliably establish **the current asking price at a handful of named
Hungarian retailers** and sometimes a recent review or forum mention. It can **not** reliably
establish price *history* — "is 29,990 Ft actually low for this?" — because the history lives
in Keepa-style datasets and in Árukereső's chart, neither of which a search snippet exposes.

So the honest product shape is a **three-level verdict**:
1. **"Olcsóbb máshol"** — search found the same product cheaper at a named shop today. High
   confidence, genuinely useful, achievable.
2. **"Szokásos ár"** — search found comparable listings at a similar price, so the "akció" is
   not special. Medium confidence, achievable.
3. **"Nem tudom ellenőrizni"** — no comparable listing found. Say this out loud.

Do **not** promise a "best price in 6 months" claim; we have no data source for it in Hungary at
this budget. A cheap, owner-specific alternative that *does* build history: **record every price
we ever see in our own Postgres**, keyed by normalised product name + retailer. After a few
months of promo mail the app owns a small private price history for exactly the products he is
marketed, which is worth more to him than Keepa's Amazon catalogue.

---

## 8. Open questions for the owner

1. Is the Gmail mailbox a **consumer Gmail** account or on a **Google Workspace domain he
   controls**? (Workspace → Internal OAuth client, no CASA, no 7-day expiry — the clean path.)
2. Does he accept a **forwarded mirror mailbox** (both accounts auto-forward into one mailbox
   Boop reads) as the blast-radius control, or must Boop read the real inboxes directly?
3. The **second daytime run** time: 14:00 is the research assumption; his call.
4. **Price-check budget:** 3 checks/day (~€1.2/month) or 10 (~€3.2/month).
