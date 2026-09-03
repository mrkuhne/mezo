# The intervention push actually lands on its card — Implementation Plan (`mezo-b3pp.36`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tapping an intervention push should open the card it announces, with its „Segített?" verdict chips reachable — including when the card was deferred across midnight.

**The bd describes one defect; there are four.** It says the deep-linked `/today?n=` push cannot surface a cross-midnight card because the feed only returns local-today rows. That last part is true, but it is the *fourth* thing wrong, and the first three mean the deeplink has never worked at all, for any card:

1. **Wrong target route.** The URL is `/today?n=…`, but `/today` is a legacy path: `router.tsx` redirects `today/*` → `/nap`, the Nap **hub**. The companion thread — and the `useFeedback` chips — live on `NapMezoPage` at **`/nap/uzenetek`**. So the push lands on a page that does not render the card.
2. **No consumer.** Nothing in `frontend/src` reads `?n=` — zero occurrences. The parameter has never been handled.
3. **Truncated id.** `AnchorResolver` puts `msg.getId().toString().substring(0, 8)` in the URL, so even a consumer could only prefix-match.
4. **The date boundary** — the bd's own complaint. A card generated between quiet-hours start and midnight defers its push to the next morning, but its `message_date` stays the generation day, and the feed reads local-today.

**One thing that already works in our favour:** `LegacyPathRedirect` is `location.pathname.replace(prefix, to) + location.search`, so it preserves the query string. Pushes already sent with the old URL keep landing somewhere sane.

**And one constraint that is easy to miss:** `idFragment` is *also* half of the `AnchoredEvent` dedup key (`hhmm(minute) + ":" + idFragment`), which backs `push_log` day-scoped dedup. **The key must not change** — changing it could re-send pushes already delivered. The full id goes in the URL only.

**No contract change.** `GET /api/proactive/feed` already takes a `date` query parameter, so crossing the boundary is a client-side concern.

**Tech Stack:** Java 21 / Spring Boot (URL construction), React 19 + TypeScript + Vitest (consumption).

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.36)`. Conventional-commit subjects.
- **No contract change, no generator run.** Do not touch `api/**` or `frontend/src/data/_client/api.gen.ts`.
- **Never change the dedup key.** `AnchoredEvent`'s second argument stays exactly `hhmm(minute) + ":" + idFragment`.
- `docs/references/frontend_conventions.md`: deep absolute `@/*` imports only, no barrels, hooks via `@/data/hooks`, `var(--token)` colors only.
- **Both FE test modes green, explicitly** (`VITE_USE_MOCK=false` and `=true`) — a bare `pnpm test` is a mock run. Note mock mode's feed is always `[]`, so a mock-only test of this feature would be vacuous; put the behaviour tests in real mode and say so.
- **Backend gate:** focused ITs (`./mvnw clean test -Dtest='...' -Dmezo.test.use-testcontainers=true`, Docker up).
- **Docs in the same change:** `docs/features/_platform-notifications.md` §3d (where the bd says the finding is recorded) and the Today/Nap feature doc if it describes the thread page.

---

### Task 1: The push points at the card

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java` (~:303-318)
- Test: the existing `AnchorResolver`/intervention notification IT (grep `interventionFireMinute` or `AnchorResolver` under `backend/src/test`)

- [ ] **Step 1: Write the failing tests**

Read the existing anchor/intervention tests first and mirror their harness. Cases:

```
testInterventionEvent_shouldDeepLinkToTheThreadPage_whenACardPushes
  => the event's url starts with "/nap/uzenetek", NOT "/today"

testInterventionEvent_shouldCarryTheFullCardId_whenACardPushes
  => the url's n= parameter is the card's FULL uuid, not an 8-char prefix

testInterventionEvent_shouldCarryTheCardsOwnDate_whenTheCardIsDeferredAcrossMidnight
  a card generated inside quiet hours on day D, pushing on D+1
  => the url's d= parameter is D (the card's message_date), NOT D+1
  — this is the whole point: the next morning's push must name the day whose feed holds the card

testInterventionEvent_shouldKeepTheDedupKeyUnchanged_whenTheUrlGainsTheFullId
  => the AnchoredEvent's key is still hhmm + ":" + the 8-char fragment
  — pins the constraint that the URL change must not disturb push_log dedup
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd backend && ./mvnw clean test -Dtest='Anchor*,Intervention*' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Build the URL**

Add the thread route next to the other URL constants and construct the deeplink with the full id and the card's own date:

```java
    /** The companion thread page — where the feed cards and their „Segített?" chips actually
     *  render (`NapMezoPage`). NOT `/today`: that is a legacy path the router redirects to the
     *  Nap HUB, which does not render the thread, so the push landed a page away from its card
     *  (mezo-b3pp.36). */
    private static final String URL_THREAD = "/nap/uzenetek";
```

and at the intervention site:

```java
                            String idFragment = msg.getId().toString().substring(0, 8);
                            // The FULL id goes in the URL so the page can match a card exactly;
                            // the 8-char fragment stays the dedup key, because that key backs
                            // push_log's day-scoped dedup and changing its shape could re-send a
                            // push already delivered (mezo-b3pp.36).
                            // `d` is the CARD's own day, not the push day: a card generated inside
                            // quiet hours pushes the next morning, and only its generation day's
                            // feed holds it.
                            String url = URL_THREAD + "?n=" + msg.getId()
                                    + "&d=" + <the card's own message date>;
```

Find the card's date field on the entity yourself (`msg` is the companion-message row; grep for its date accessor — do **not** use the loop's `date`, which is the push target day). Say in your report which field you used and how you confirmed it is the generation day.

Leave the OTHER `?n=` producer (the app-notification deeplink around `:408`) alone: it appends `n=` to arbitrary per-row deeplinks, so a thread-page consumer would not serve it. Note it in your report — it is equally unconsumed, and worth its own issue.

- [ ] **Step 4: Run the tests, then commit**

```bash
cd backend && ./mvnw clean test -Dtest='Anchor*,Intervention*' -Dmezo.test.use-testcontainers=true
git add backend && git commit -m "fix(notification): the intervention push deep-links to the card's own page and day (mezo-b3pp.36)"
```

---

### Task 2: The page consumes the deeplink

**Files:**
- Modify: `frontend/src/data/today/feedHooks.ts` (`useCompanionFeed`)
- Modify: `frontend/src/features/today/pages/NapMezoPage.tsx`
- Test: the existing `NapMezoPage` test (grep) + `feedHooks.test.tsx`

**Interfaces:**
- Consumes from Task 1: `?n=<full uuid>&d=<YYYY-MM-DD>` on `/nap/uzenetek`.

- [ ] **Step 1: Write the failing tests**

Read `NapMezoPage.tsx` and its test, plus `feedHooks.test.tsx`, and mirror their harness. **Mock mode's feed is always `[]`** (`useCompanionFeed` returns `[]` synchronously there), so the behaviour cases must run in REAL mode with MSW; a mock-mode assertion would pass vacuously. Cases:

```
useCompanionFeed (feedHooks.test.tsx):
  fetches the requested day when a date is passed
    => the request URL carries that date, and the cache key is per-date
  defaults to the local day when no date is passed
    => unchanged behaviour, same key as today

NapMezoPage (real mode):
  surfaces the deep-linked card when d names an earlier day
    render at /nap/uzenetek?n=<id>&d=<yesterday>, with MSW serving that card ONLY on yesterday's
    feed and something else on today's
    => the deep-linked card's body is in the document
    => today's own cards are still rendered (the deeplink ADDS the card, it does not replace the day)

  renders normally when the deeplink names today
    ?n=<id>&d=<today> => one fetch, no duplicate card

  renders normally when there is no deeplink
    no params => unchanged

  ignores a deeplink whose card is not in that day's feed
    ?n=<unknown-id>&d=<yesterday> => no crash, no empty placeholder card, today's feed intact
    — an id can be stale (the card was deleted, or the push is days old)
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/today src/data/today
```

- [ ] **Step 3: Let the hook take a date**

Give `useCompanionFeed` an optional date, defaulting to the local day. The query key already includes the date, so per-date caching comes free:

```ts
export function useCompanionFeed(date: string = localDateString()): FeedMessage[] {
```
Keep everything else — the mock branch, the 60s poll, the degrade-to-`[]` catch — exactly as it is, and keep the existing call sites working unchanged (they pass nothing).

- [ ] **Step 4: Consume the deeplink on the thread page**

In `NapMezoPage`, read both params, and when `d` names a different day than today, fetch that day too and merge the single matching card in. Sketch — adapt to the page's actual structure:

```tsx
  const [params] = useSearchParams()
  const deepLinkId = params.get('n')
  const deepLinkDay = params.get('d')
  const today = localDateString()
  // A card deferred across midnight keeps its GENERATION day, but the push announcing it arrives
  // the next morning — so the thread must reach back one day to show the card the user just
  // tapped (mezo-b3pp.36). Only the matching card is pulled in; the day's own thread is unchanged.
  const crossDay = deepLinkDay && deepLinkDay !== today ? deepLinkDay : undefined
  const linkedFeed = useCompanionFeed(crossDay ?? today)
  const linkedCard = crossDay && deepLinkId
    ? linkedFeed.find((m) => m.id === deepLinkId)
    : undefined
```
Then render `linkedCard` alongside the day's own thread (prepended is the natural place — it is what the user tapped), and scroll it into view. Keep the feedback chips wired for it exactly as for any other persisted feed row, since that is the entire point of the fix.

**Do not** swap the whole thread to the other day — the user is on today's page and expects today's thread; the deep-linked card is an addition.

Note `useCompanionFeed(today)` is already called by the page, so calling it again with the same argument is a cache hit, not a second request.

- [ ] **Step 5: Run both modes, then commit**

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/today src/data/today
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/today src/data/today
git add frontend/src && git commit -m "feat(today): the thread surfaces a deep-linked card from its own day (mezo-b3pp.36)"
```

---

### Task 3: Docs + gates

- [ ] **Step 1: Docs**

`docs/features/_platform-notifications.md` §3d (where the bd says the finding lives) must now describe the shipped path: the intervention push deep-links to `/nap/uzenetek` with the card's **full id** and its **own day**; the thread page pulls that day's feed and surfaces the single matching card alongside today's, so the „Segített?" chips are reachable. Record the three defects the bd did not name — the stale `/today` target, the absent consumer, the truncated id — so the history is honest about why this never worked rather than implying it was only a date bug. State plainly that the 8-char fragment remains the push dedup key and why it must not change. Cross-reference the Today/Nap feature doc if it describes the thread page, and note the app-notification `?n=` producer is still unconsumed (its own issue).

Bump `updated:` on every doc you edit.

- [ ] **Step 2: Gates**

```bash
cd backend && ./mvnw clean test -Dtest='Anchor*,Intervention*,Notification*' -Dmezo.test.use-testcontainers=true
cd frontend && pnpm build
cd frontend && VITE_USE_MOCK=false pnpm test
cd frontend && VITE_USE_MOCK=true pnpm test
node scripts/lint-docs.mjs
node scripts/gen-codemap.mjs --check
grep -c '<<<<<<<\|>>>>>>>' docs/CODEMAP.md
```
The last MUST print `0` (`mezo-ag1b`: `gen-codemap --check` only reads the `CODEMAP:BODY` region, so a corrupted header slips past it).

- [ ] **Step 3: Commit**

```bash
git add docs && git commit -m "docs(platform): the intervention deeplink lands on the card's page and day (mezo-b3pp.36)"
```

---

## Self-Review

- **bd coverage.** The bd's stated defect (the cross-midnight date) is Task 1 Step 3's `d=` parameter plus Task 2's cross-day fetch. Its suggested options were "resolve by card id directly, or have /today accept a date param" — the second, essentially, but via the feed endpoint's **existing** `date` parameter, so no contract change was needed.
- **What this plan adds beyond the bd, and why it had to:** the bd assumes the deeplink works. It does not — wrong route, no consumer, truncated id. Fixing only the date would have shipped a still-broken path and closed the issue on a false premise.
- **The trap it avoids:** `idFragment` is also the push dedup key. Replacing it wholesale with the full id would look like a tidy one-line change and could re-send already-delivered pushes. Called out in the code comment and pinned by its own test.
- **The mock-mode trap:** `useCompanionFeed` returns `[]` in mock mode, so every behaviour test here must run in real mode or pass vacuously. Stated in the constraints and in Task 2 Step 1.
- **Placeholders.** The card's own date field is deliberately left to be discovered (`grep` the entity) rather than guessed, because using the loop's `date` — the push day — would silently reintroduce the exact bug being fixed.
