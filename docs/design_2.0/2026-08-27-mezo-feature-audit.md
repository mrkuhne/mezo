# Mezo tab (companion) — feature audit, part 1: the chat surface (2026-08-27)

Ground-truth inventory for the Mezo-tab redesign (bd mezo-88jw). **Scope note:** the real app
has **no bottom tab named "Mezo"** — the tab bar is `Ma · Edzés · (+FAB) · Fuel · Én`
(`frontend/src/app/TabBar.tsx:9-15`). The companion surface (header eyebrow **"Mezo · társ"**)
is the **Chat sub-tab of the Insights section** at `/insights/chat` (`ChatPage`). The redesign
promotes this section to a first-class **Mezo tab** (the prototype tab bars already carry it).
Part 2 (the other 7 Insights sub-tabs) is appended below when audited.

---

## 1. IA map

| Path | Element | File |
|---|---|---|
| `/insights` (shell) | `InsightsSection` | `frontend/src/app/router.tsx:126-152`; `features/insights/pages/InsightsSection.tsx:1-25` |
| `/insights/chat` | `ChatPage` | `router.tsx:133`; `features/insights/pages/ChatPage.tsx:42-274` |
| `?c=<uuid>` / `?c=new` / absent | same page, thread selection via search param (not a route) | `ChatPage.tsx:43-52`, `chatHooks.ts:28-34` |

No child routes under the chat — one screen + one sheet.

**Chrome stack** (top → bottom): `CircadianTheme`+`PhoneFrame`+`ScreenContent`+`ErrorBoundary`
(`AppLayout.tsx:28-45`; tab bar IS shown here); `AppHero` sticky identity row (avatar+XP ring →
`/me`, level badge → `/me/growth`, name, equipped title → TitleShopSheet, 🔥 streak →
StreakSheet, ⚡ quests, 🪙 coins, NotificationBell — `features/progression/components/AppHero.tsx:16-90`);
`SubNavDropdown` labeled `"Insights alnavigáció"`, accent `var(--lav-deep)`
(`InsightsSection.tsx:11-16`) listing the 8 tabs: **Minták · Heti · Memoár · Tudástár · Chat ·
Előrejelzések · Kísérletek · Memória** (`features/insights/pages/tabs.ts:10-19`); section padding
`8px 24px 24px`; then ChatPage; then `FloatingReturnLayer` (on this path: coral **"Vissza az
edzéshez"** bar only while a gym workout is open — `FloatingReturnLayer.tsx:34-47`).

**Navigation in:** Today AppHero sparkle → `/insights` → dropdown → Chat (`TodayPage.tsx:321`);
lavender chat FAB `float-fab-chat` (aria **"Beszélgetés a társsal"**) on every route except
`/insights/chat`, `/me/sleep/night`, `/ritual` (`FloatingReturnLayer.tsx:63-70`); QuickInputSheet
row **"Beszélgetés a társtal"** / hint **"kérdezz, mesélj, tervezz"**
(`features/quickinput/sheets/QuickInputSheet.tsx:105-119`). `/insights/motor` → redirects to `/insights`.

**Sheets reachable:** `ConversationPickerSheet` (bookmark chip, aria **"Beszélgetések"** —
`ChatPage.tsx:118-127`); from shared chrome: TitleShopSheet, StreakSheet, QuickInputSheet.
No settings sheet, no rename/delete, no message-level menu. Sheet mechanics: portal into
`.phone-screen`, drag-dismiss 120px / 0.5px·ms⁻¹, 300ms exit (`shared/ui/Sheet.tsx:14-40`).

---

## 2. Per-screen inventory

### 2.1 ChatPage (`features/insights/pages/ChatPage.tsx`)

Root `div.col.gap-md.chat-page` (:109).

**A. Header row** (:110-139): eyebrow **`Mezo · társ`** (`var(--lav-deep)`); subtitle (11px,
tertiary) — exactly one of, in precedence: degraded → **`a társ most nem elérhető`**; `?c=new` →
**`új beszélgetés`**; mock → **`demo beszélgetés`**; real → **`Gemini · élő`** (:113-115, :11).
Two icon chips: `bookmark` 14px aria **`Beszélgetések`** (disabled when degraded) → picker;
`plus` 14px aria **`Új beszélgetés`** (disabled when degraded or already new) → `?c=new`.

**B. Degraded banner** (:151-158), only when degraded — `.card` p14, one 13px paragraph:
> `A társ jelenleg nincs bekapcsolva — a beszélgetés nem elérhető. A napló, az edzés és a Fuel változatlanul működik.`

**C. Thread** `div.col.gap-md.chat-thread` (:160-209), in order:
1. **Loading** — `ThinkingDots` when pending ∧ ¬degraded ∧ ¬new ∧ 0 messages ∧ no turn (:161).
   ThinkingDots = eyebrow `Mezo` + card with three 6px lav dots, `np-pulse` staggered 0/0.2/0.4s
   (disabled under `prefers-reduced-motion`; `styles/prototype.css:1186-1187`).
2. **Empty state** (:162-168): left card, maxWidth 85%:
   > `Új beszélgetés — kérdezz bármit, vagy mondd fel a mikrofonnal.`
3. **History bubbles** — `ChatMessage` per message; feedback prop only when
   `role==='assistant' && m.id` (:173-186).
4. **Optimistic user bubble** — `ts:'most'`, `text: turn.userText` (:187).
5. **Thinking dots during a turn** — gated on `!turn.draft` (not `thinking`) so dots coexist
   with live tool chips (:191).
6. **Streaming draft** — when `!turn.thinking && (draft || tools.length)`; no `id` ⇒ no feedback
   chips and the empty-answer fallback is suppressed (:192-201).
7. **Inline error bubble** (:202-206): `A társ nem adott választ erre a körre — próbáld újra.`
   (code `COMPANION_EMPTY_ANSWER`) or `Nem sikerült válaszolni — próbáld újra.` (else)
   (`chatHooks.ts:244-246`).
8. Scroll anchor div h1 aria-hidden.

**D. Voice error line** (:211-213), 11px centered tertiary; strings from `useVoiceInput.ts`:
`Túl rövid felvétel — tartsd nyomva, amíg beszélsz.` (:43) · `Nem hallottam semmit — próbáld
újra.` (:50) · `A leiratozás nem sikerült — próbáld újra.` (:52) · `Nem érem el a mikrofont —
engedélyezd a böngészőben.` (:73).

**E. Composer** `div.card.chat-composer` (:215-271), p8 flex align-end gap8:
- **Mic chip**: `chip` + `chat-mic-live` while recording (`background var(--wash-amber)`,
  coral border/color); icon `voice-wave`/`mic` 14px; aria `Felvétel leállítása` / `Hangbevitel`;
  `aria-pressed`; disabled when degraded / unsupported / transcribing.
- **Textarea**: rows=1, auto-grow to `COMPOSER_MAX_HEIGHT=104` px then internal scroll; 13px,
  `enterKeyHint="send"`; placeholders: `Hallgatlak…` (recording) / `Leiratozom…` (transcribing) /
  **`Mondj valamit...`** (idle). **Enter sends, Shift+Enter newline**, IME-safe (:238-242).
- **Send chip**: icon `send` 14px, aria **`Küldés`**, `wash-lav` bg + `lav-deep` border/color;
  disabled only when degraded (empty draft no-ops in `submit()`, :102-106).
- CSS: `.chat-composer` `position:sticky; bottom:var(--screen-bottom-pad); z-index:20`; while
  mounted the app scroller's bottom pad is zeroed so short threads keep the bar at the bottom
  (`prototype.css:3685-3716`).

**Scroll** (`logic/useStickToBottom.ts`): rides `.screen-content`, always `behavior:'instant'`
in rAF; parks at bottom on open and per new message; streaming only pulls the view within
**96px** of bottom; 500ms settle; ResizeObserver re-anchor.

### 2.2 ChatMessage (`features/insights/components/ChatMessage.tsx`)

**User bubble** (:17-40): right-aligned, maxWidth 80%, `.card` `10px 14px`,
`background var(--surface-2)`, 13px pre-line text; timestamp below right, 9px tabular-nums.
Never carries tools/refs/chips/recall.

**Assistant bubble** (:41-96): left, width 92%:
- Meta row: eyebrow **`Mezo`** (lav-deep) + timestamp + degraded badge when `m.degraded`:
  9px `var(--color-warning)` **`nem ellenőrzött`**,
  `title="Ez a válasz nem ment át az önellenőrzésen — kezeld fenntartással."` (:48-56).
- `ToolChipRow` above the card only when `m.tools` (:58). Chip = `.toolchip.<type>` with `tool`
  icon 10px + name (+ `(args)` at 0.7 opacity if set) (`shared/ui/ToolChip.tsx`).
- Answer `.card` p14: `Markdown` in `.md-prose` (paragraphs pre-line, `##` headings, `-`/`1.`
  lists, inline bold/italic/`code`; no links/images/HTML — `shared/lib/markdown.tsx`); a
  persisted row with blank text → italic 12.5px **`Erre a körre nem érkezett válasz.`** (:64-71);
  refs footer only when `m.refs` (:72-84): top hairline, eyebrow 9px **`Hivatkozott · L3`**,
  `RefTag`s `[kind] id` in `.toolchip` 9px (`shared/ui/RefTag.tsx`).
- `RecalledMemoriesRow` only when `m.recalled` (:87); `FeedbackChips label="a válaszról"` only
  when feedback prop present (:92-94).

### 2.3 RecalledMemoriesRow (`components/RecalledMemoriesRow.tsx`)
`null` on empty array (:10). Collapsed by default; toggle: eyebrow 9px **`Emlékek · {N}`** +
chevron, `title="Ezekre emlékezett a társ a válasz előtt (W3.1 ambient recall)"`,
`aria-expanded`. Expanded `ul`: line1 9px tabular `{occurredOn} · {label} ·
{round(similarity*100)}%`, line2 11px = `gist`.

### 2.4 FeedbackChips (`components/FeedbackChips.tsx`) — SHARED by 5 surfaces
Group aria `Visszajelzés a válaszról`. Chips `6px 12px`, `.brand` when active, `aria-pressed`:
**`👍 Segített`** / **`👎 Nem talált`**. Reason row when verdict down or 👎 tapped this session:
**`pontatlan`** · **`túl sok`** · **`rossz időzítés`** · **`nem rólam szól`**
(`inaccurate | too_much | bad_timing | not_about_me`). 👍 = vote up + close; 👎 on non-down =
open reasons WITHOUT voting; 👎 while down = retraction; reason tap = upsert (:56-76).

### 2.5 ConversationPickerSheet (`sheets/ConversationPickerSheet.tsx`)
Header: lav eyebrow **`Beszélgetések`** + subtitle **`{N} korábbi beszélgetés`** (0 reads
"0 korábbi beszélgetés" — no special-case). Dashed row `＋ Új beszélgetés`. List maxHeight 320
scroll; row: title 13px ellipsis (**fallback `Névtelen beszélgetés`** when title null, :83);
sub-line 10px via `whenLabel(lastMessageAt ?? startedAt)`: `ma HH:MM` / `tegnap HH:MM` /
hu-HU `{hónap} {nap}.`; null → **`üres`** (:14-24). Active row: lav border + wash,
`aria-current`, trailing check. No empty-state card, no scroll affordance.

---

## 3. Data model

FE types (`data/types.ts:895-922`):
```ts
type ChatRole = 'user' | 'assistant'
interface ChatRef { kind: string; id: string }
interface ChatRecalledMemory { occurredOn: string; kind: string; label: string; gist: string; similarity: number } // raw cosine 0..1
interface ChatMessage {
  id?: string      // persisted ai_message row id = feedback artifactId; absent while streaming + optimistic user bubble
  role: ChatRole
  ts: string       // pre-formatted HU 'HH:MM' or literal 'most'
  text: string
  tools?: Tool[]; refs?: ChatRef[]; degraded?: boolean; recalled?: ChatRecalledMemory[]
}
```
`Tool` = `{ type:'read'|'compute'|'write'; name; args? }` (`shared/ui/ToolChip.tsx`).

Hook shapes (`data/insights/chatHooks.ts`): `ChatBootstrap{conversationId, messages, degraded,
mode:'mock'|'live'}` (:11-16); `ChatConversations` (:18-22); `ChatTurn{userText, draft,
thinking, tools}` (:25); `NEW_CHAT='new'` (:31-34). Cache keys `['chat', selection??'newest']`,
`['chat','conversations']`, feedback `['feedback','chat_message'(,fingerprint)]`.

Feedback types (`data/feedback/feedbackTypes.ts`): artifact kinds `chat_message | feed_message |
weekly_suggestion | memoir | prediction`; verdict up/down; 4 reasons; `FeedbackHandle{get, vote, pending}`.

**Mock seed** (`data/insights/chat.ts:17-58`): 3 messages (assistant 06:32 with 2 tools
`get_recent_workouts(days=3)` read + `recallSharedMemory(theme='pull-day pr')` compute, refs
`[Workout w-2026-05-21]` `[PR pr-2026-03-04]`, 2 recalled items at 92%/71%; user 06:34
`"Aludtam 7h-t…"` — no id, not votable; assistant 06:34 with 3 tools, 2 refs, NO recalled).
`cannedReply(text)` (:5-12): prefix `"Értem — és köszönöm hogy megosztottad. "` + fáradt-branch
vs kalória-pacing branch; reused by MSW so both modes assert identical strings.
`MOCK_CONVERSATION_ID='mock-conversation'`; mock list = one row `Demo beszélgetés`.
`mockThread(selection)`: NEW_CHAT → empty; non-seed id → empty; seed/undefined → transcript.
Mock reply: 1200ms timer, `crypto.randomUUID()` id, fabricated tools/ref/1 recalled (0.66);
auto-title = `text.slice(0,80)`. Mock feedback seed deliberately empty.

**Key derivations:** page `degraded = data.degraded || companionOff` (:64); `ts` via
`toLocaleTimeString('hu-HU', 2-digit)` (`chatApi.ts:22`); empty wire arrays → `undefined` so
sections disappear (`chatApi.ts:25-30`); similarity → `round(*100)`; feedback batch keeps LAST
200 ids (`FEEDBACK_MAX_IDS`, `feedbackApi.ts:14`); composer height `min(scrollHeight,104)`.

---

## 4. Write paths & API

Reads: `GET /api/companion/conversation` (list; **the single degraded detector** — 404 →
degraded, `chatHooks.ts:85-100`); `GET /api/companion/conversation/{id}/messages`
(selection 'new' skips network; no selection → newest; `chatHooks.ts:108-128`);
`GET /api/companion/feedback?kind=chat_message&ids=a,b,c` (batch, max 200, skipped when empty,
failure → "no verdicts").

Writes:
1. **Create conversation (lazy)** — `POST /api/companion/conversation` → 201; only on first
   send of a `?c=new` draft; then `?c=` moves to the real id (`ChatPage.tsx:50-56`).
2. **Streamed turn (the only send path)** — `POST …/message/stream`, body `{content}`
   (min 1 / max 4000). SSE: 0..n `delta{text}` + 0..n `tool{type,name}` interleaved, then exactly
   one `done` (persisted MessageResponse) or `error{code}` (user row persists, assistant does
   not) (`api/feature/companion/companion.yml:356-405`). Client throws
   `COMPANION_STREAM_INCOMPLETE` if no terminal event. Optimistic overlay `setTurn(...)`; deltas
   append draft, tools append chips, both clear `thinking`. On done: append user+assistant rows
   into `['chat',selection]` AND `['chat',conversationId]`, invalidate conversations (auto-title).
   On failure: error string + invalidate both thread keys + conversations; `finally setTurn(null)`.
   `send()` no-ops on empty text or while a turn is in flight.
3. **Voice** — `POST /api/companion/transcribe` multipart part `audio` (`note.wav`/`note.bin`);
   stateless; transcript is **appended to the draft**, never auto-sent (`ChatPage.tsx:60`).
   Pipeline: getUserMedia → MediaRecorder → `blobToWav` (16kHz mono, raw fallback) → min 512 B.
4. **Feedback upsert** — `PUT /api/companion/feedback` `{artifactKind:'chat_message',
   artifactId, verdict, reason?}` (reason legal only with down); optimistic into every cached
   feedback entry, rollback on error, invalidate on settle (real only).
5. **Feedback retraction** — `DELETE /api/companion/feedback/chat_message/{id}` → 204,
   idempotent; bare re-tap of set verdict.

The contract also defines sync `POST …/message` → MessageResponse — **the FE never calls it**.

Wire schemas (`companion.yml:593-724`): `ConversationResponse{id, title?(null until first user
message, then truncated to 120), startedAt, lastMessageAt?}`; `MessageResponse{id, role,
content, createdAt, degraded, tools[], refs[], recalled[]}` (arrays required, possibly empty);
`MessageTool{type('read'|'compute' — V0.5 emits only 'read'), name(args baked in)}`;
`RecalledMemory{occurredOn, kind, label, gist, similarity}`. MSW fixtures:
`test/msw/handlers.ts:1085-1250`, feedback `:1325-1335`.

---

## 5. Cross-links

**In:** chat FAB everywhere (incl. `/train/session`); QuickInputSheet row; Today sparkle →
dropdown. **No context passing anywhere** — no prefilled prompt, no `?q=`; only `?c=` is read.
**Out:** during an open gym workout the shell renders `Vissza az edzéshez` + `"{title} · {N}
szett kész"` (clause dropped at 0) → `/train/session`. Refs footer tags are **not clickable**.

**The other "Mezo" surface (do not conflate):** Today's `MezoChip`
(`features/today/components/MezoChip.tsx`) — 44px row `✦ | Mezo | <latest first paragraph> |
<count> | ›`, aria `Mezo üzenetei, N üzenet[, olvasatlan]`, **renders nothing at 0 messages**;
unread via `shared/lib/seenMessages`. Opens `MezoMessagesSheet` (header `Mezo üzenetei` + `Kész`,
day separator `Ma`, ✦ bubbles, RefTags, FeedbackChips kind `feed_message` with `Segített?`
micro-label on interventions). This is the proactive **feed**, not chat turns — the redesigned
Fuel hub's "Mezo · 2 új Fuel-üzenet" tile maps to this feed, filtered by context.

Shared components a redesign ripples through: `FeedbackChips` (5 consumers), `useVoiceInput`
(also Me/JournalSheet), ToolChip/RefTag/Sheet/markdown.

---

## 6. Honest-state rules

- **Switched-off (404) ⇒ degraded, never an error**: subtitle + banner + disabled chips/composer;
  composer stays visible (no dead end, IDENT-3).
- **No mock seed in real mode** (`useDualQuery` realEmpty during load; mock seeds synchronously,
  staleTime Infinity).
- **Hidden-when-empty**: empty tools/refs/recalled → `undefined` → row/footer/disclosure absent,
  not empty. MezoChip null at 0.
- **Empty answer named, not blank**: persisted blank row → `Erre a körre nem érkezett válasz.`;
  in-flight draft legitimately blank, must not say it.
- **Degraded answer flagged**: `nem ellenőrzött` + tooltip.
- **Votable only when persisted** (assistant ∧ id).
- **Feedback read failure ≠ page failure**; optimistic rollback on error; mock never invalidates.
- **Send-failure honesty**: history refetched because the user row may have persisted.
- Voice: named errors; unsupported browser → mic disabled silently.
- No numeric readouts here → no `—` glyphs; sentinels: `üres` (picker), `Névtelen beszélgetés`.

---

## 7. Latent gaps

1. Sync `POST …/message` contract-complete, unused.
2. `Tool.args` never populated (args baked into name).
3. `ToolType 'write'` exists in type+CSS, never emitted (contract: only 'read' today).
4. `startedAt` only a fallback; no "started" line, no message count, no thread preview text.
5. **No conversation rename/delete/archive** — no endpoint, no UI; titles can never be corrected.
6. Picker: no empty state, silent clip at maxHeight 320.
7. **`refs` are inert** — raw ids, no label lookup, no navigation, no tooltip. The most obviously
   unfinished element on the screen.
8. `recalled[].kind` carried but never rendered (only `label`).
9. Send button not disabled on empty draft (looks tappable, no-ops).
10. `useFeedback.pending` never consumed — no in-flight state on chips.
11. **No retry on the error bubble** — copy says "próbáld újra" but the draft was already
    cleared; user must retype.
12. No message actions (copy/share/regenerate/edit), no date separators (Today sheet has `Ma`,
    chat has none), no unread markers, no search.
13. Tools-but-no-text turns show dots AND chips simultaneously (intentional, mezo-280 F3).
14. `mode` only drives the subtitle.
15. `message_feedback` is capture-only backend-side — nothing reads it yet
    (`docs/features/companion.md:4400-4402`).
16. **Deployed reality: `MEZO_FEATURE_COMPANION_ENABLED=false`** until a real GEMINI_API_KEY —
    the degraded state is the current production appearance (`companion.md:774-777`).
17. No TODO/FIXME comments — gaps live in `companion.md` §9 prose.

---

## 8. Dual-mode differences (`VITE_USE_MOCK`, default mock)

| Aspect | Mock | Real |
|---|---|---|
| Subtitle | `demo beszélgetés` | `Gemini · élő` |
| History | seeded synchronously, no loading frame | GET; ThinkingDots on cold load |
| List | one hardcoded `Demo beszélgetés` row | GET conversations |
| Thread per selection | only seed id carries transcript; new/other ids open empty | server truth |
| Send | 1200ms timer → `cannedReply`, no network | lazy create + SSE stream |
| Streaming | none — atomic reveal; draft stays `''` (only dots show) | true deltas + live tool chips |
| Voice | fixed transcript `Ma reggel fáradtan keltem, mit gondolsz, menjek edzeni?` after 600ms | multipart POST |
| Degraded banner | unreachable | via switch-off |
| `nem ellenőrzött` | never | when `done.degraded` |
| `Emlékek · N` | 2 on first seed answer, 1 per canned reply, 0 on second seed | as carried |
| Feedback | session-only cache votes, lost on reload | batch GET + optimistic PUT/DELETE |
| Errors | no failure path | empty-answer vs transport split |

---

## 9. Files a redesign must touch

```
features/insights/pages/ChatPage.tsx (274) · InsightsSection.tsx · tabs.ts
features/insights/components/ChatMessage.tsx · FeedbackChips.tsx (SHARED×5) · RecalledMemoriesRow.tsx
features/insights/sheets/ConversationPickerSheet.tsx
features/insights/logic/useStickToBottom.ts · useVoiceInput.ts (SHARED with Me/JournalSheet)
shared/ui/ToolChip.tsx · ToolChipRow.tsx · RefTag.tsx · Sheet.tsx · Icon.tsx
shared/lib/markdown.tsx · audio.ts
styles/prototype.css:3668-3716 (.md-prose, .chat-composer, .chat-mic-live; .np-pulse :1186)
data/insights/chat.ts · chatApi.ts · chatHooks.ts · data/feedback/* · data/types.ts:895-922
app/FloatingReturnLayer.tsx
api/feature/companion/companion.yml · companion-feedback.yml
docs/features/companion.md §2 UX contract §5.1 · docs/features/insights.md §2.5
Copy-pinning tests: ChatPage.test.tsx (24 exact-string asserts), ChatMessage.test.tsx,
  FeedbackChips.test.tsx, useVoiceInput.test.tsx, chatApi/chatHooks/chatData tests,
  test/msw/handlers.ts:1085-1250
```

---

# Part 2: the 7 non-chat Insights sub-tabs (hub-tile depth)

Canonical tab order (`features/insights/pages/tabs.ts:10-19`): **Minták** `/insights` (index) ·
**Heti** `/insights/weekly` · **Memoár** `/insights/memoir` · **Tudástár** `/insights/knowledge` ·
**Chat** `/insights/chat` · **Előrejelzések** `/insights/predictions` · **Kísérletek**
`/insights/experiments` · **Memória** `/insights/memoria`. `PHASE3_TAB_IDS` is empty → all 8 in
both modes. Motor retired: `/insights/motor` → Navigate `/insights` (`router.tsx:145`).
Shell = AppHero + SubNavDropdown only — no per-tab header, no badges. **No sheets** outside chat.
`insights/patterns/:pairKey` is a sibling full-page leaf outside the shell (`router.tsx:129`).

## 1. Minták (PatternsPage.tsx, 258 lines — densest)

- `MotorStateHero`: eyebrow "A motor állapota", right `ma HH:mm · {lookbackDays} nap`; prose with
  three bolded numbers: "**N kérdést** figyelek a naplóidból. **N megerősített** összefüggés
  dolgozik a társban, **N vár a döntésedre**." Then a **3×2 lifecycle-tile grid**: döntésre vár /
  megfigyelés alatt / megerősítve / még gyűlik / nincs kapcsolat / elvetve. Domain filter chips
  ("Mind" + present domains).
- "🔔 Döntésre vár · N" + `PatternDecisionCard`s (domain chip, tone-colored confidence chip —
  human words, never raw r/p —, question title, pairLine, recessed "📈 Amit eddig látunk",
  first-card "Mi történik a döntéseddel" explainer, buttons **Megerősítem / Figyeljük / Elvetem**,
  "Részletek és előzmények →"). Five `LifecycleSection` collapsibles: "✓ Megerősítve — él a
  tudásban" (defaultOpen, footnote "Ez a N összefüggés benne van a társ fejében…"),
  "👁 Megfigyelés alatt", "⏳ Még gyűlik az adat" ("Ezek nem hibák — csak nincs elég közös nap…"),
  "○ Megnéztük — nincs összefüggés", "✕ Elvetve". Collapsed "Adat-egészség" card of
  `MetricCoverageRing` rows (conic ring, `{covered}/{window} nap · utoljára: …`).
- Data: `insights.ts` patterns (3 rows: pairKey, confidence, title, mechanism, evidence[],
  critique{4 sub-scores}, thinking, status) + patternMonitor (lookbackDays 60, minN 8, 8 pairs
  with verdict live|few_days|no_data|degenerate, r/n/p). Bucketing client-side
  (`logic/lifecycle.ts`; STRONG_SIGNAL minAbsR 0.3 maxP 0.15; MIN_PATTERN_CONFIDENCE 0.65).
- Honest: GhostState "A minták betöltése…"; error + Újra; degraded "A minta-motor most nem
  elérhető…"; empty "Még nincs felismert minta — az éjszakai elemzés magától tölti…";
  sections null at 0.
- Gaps: evidence/critique/thinking seeded, never rendered here; domain filter drops pair-less
  patterns; hero "N kérdést" (pairs) vs tile counts (patterns) = two denominators side by side.

## 2. Heti (WeeklyPage.tsx, 106 lines)

- Score card: eyebrow `weekly.title` ("Hét 21 áttekintés · Máj 18-24"), **56px hero /100**,
  delta chip (`+4` · "vs előző hét"); divider; label→value→arrow rows (↗/→/↘). Card 2:
  "Mezo · heti tervjavaslat" prose + mock-only inert **Elfogad / Hangoljuk** + FeedbackChips
  "a heti tervjavaslatról". Card 3: `GrowthWeekCard` "Growth — heti": Küldetések 9/14,
  LIFE XP +120, Tevékenységek 6, Megtakarítás 50 000 Ft.
- Data: mock seed score 82 delta 4 (items: Edzés volumen/Alvás átlag/Kcal pacing/Niggle-mentes
  napok); live composed client-side from fuel/sleep/weight/workouts (`weeklyHooks.ts:66-155`,
  **different item labels than mock**: Edzés, Alvás átlag, Kcal pacing, Fehérje-napok, Súly trend).
- Honest: score null → 34px "tanulom" + "még gyűjtöm az adatokat a heti értékeléshez"; delta
  hidden when null; suggestion null → "A társ heti tervjavaslata hamarosan."; growth empty →
  "Még nincs growth-adat ezen a héten."; savings row hidden at 0.
- Gaps: mock/live item sets differ; Elfogad/Hangoljuk inert; no score breakdown surfaced.

## 3. Memoár (MemoirPage.tsx, 83 lines)

- One memoir-card with lav radial glow: bookmark + "Heti memoár · {week}", 22px display title,
  long body prose, Anchors row of RefTags (PR / Medication / Identity), FeedbackChips "a heti
  memoárról". Mock-only: "Évforduló · 1 hónap" wash-lav card + decorative dead
  "Memoir archive · 17 darab →".
- Honest: null → "Az első memoár a hét zárásakor készül el."
- Gaps: archive row dead with hardcoded count; anniversary mock-only; single memoir, no history.

## 4. Tudástár (KnowledgeListPage.tsx, 246 lines — 2nd densest)

- Header "Tudástár · N tény" + right "N megy a chatbe"; `KnowledgeExplainer` collapsible
  "Hogyan működik a tudástár?" (5 Q&A, localStorage-persisted); cross-link "A kapcsolatok és
  életesemények a Tudásgráfon élnek."
- Inboxes: "Jóváhagyásra vár · N" `FactCandidateCard` (Elfogad / Pontosít inline+Mentés / Elvet +
  explainer line); "Életesemény-jelöltek · N" / "Szezon-jelöltek · N" cards; accepted →
  "Bekerült a gráfba · N kapcsolattal".
- List: search ("Keresés · pl. alvás, kávé, váll") + chips Mind/Edzés/Étkezés/Egészség/Élet;
  sections "Most ezeket kapja meg a társ · N" (sage; footnote: top-10 bekapcsolt + friss
  megerősített minták), "Bekapcsolva, de most kimarad", "Kikapcsolva" ("Megőrzöm őket, de a társ
  nem használja."). Row: category rail+chip, origin chip, humanized text, reinforcement sentence,
  prompt-status + Toggle. Footer "A graph nézethez · Me → Knowledge."
- Data: `knowledge.ts` — PROMPT_TOP_N 10, PATTERN_ACK_DAYS 3, 15 facts (source
  chat|pattern|manual), 2 candidates, 13 edges; bucketing `logic/factCopy.ts:121-130`.
- Honest: pending/error+Újra/degraded strings; no facts → "Még egy tényt sem tanultam rólad —
  ahogy beszélgettek, itt fognak megjelenni."; no match → "Nincs találat a keresésre." +
  "Szűrők törlése"; inbox blocks hidden when empty.
- Gaps: edges seeded but only shown on /me/knowledge (page links out twice); accepted life-event
  confirmation page-local, lost on nav; createdAt drives ranking, never displayed.

## 5. Előrejelzések (PredictionsPage.tsx, 94 lines)

- Header "Aktív predikciók" + accuracy (mock literal `'2 validated · 60-day acc 68%'`; live
  derived). Cards: status chip **✓ Validated / ✗ Missed / ◐ Pending (English!)**, mono date,
  title, confidence bar+%, basis prose, actual row in success green, FeedbackChips
  "az előrejelzésről".
- Data: 4 seeded predictions (2 pending, 2 validated, 0 missed); confidence nullable.
- Honest: empty → "tanulom" + "Az első predikciók a megerősített mintákból készülnek…";
  confidence null → "tanulom"; accuracy hidden without closed rows.
- Gaps: English status labels; hardcoded mock accuracy; free-form date; no pending/closed
  grouping; no link back to the source pattern.

## 6. Kísérletek (ExperimentsPage.tsx, 91 lines)

- "N=1 kísérletek · N"; cards: status chip ◇ Javaslat / ◐ Aktív / ✓ Megerősítve / ◯ Nem
  igazolódott / ◌ Nem értékelhető, right "{day}/{total} nap", title, hypothesis, progress bar,
  outcome in success green, live-only Elfogadom/Elvetem on proposed, bottom cta-ghost
  "+ Új kísérlet javasol Mezo".
- Data: 2 seeded (1 active 4/7, 1 completed 14/14 "Megerősítve · 3/4 mérés").
- Honest: empty → "tanulom" + "Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.";
  actions gated on live, disabled while pending.
- Gaps: propose CTA inert in mock (the demo's only dead button); no proposed row in seed →
  Javaslat chip unreachable; 'dismissed' status has no label branch; no feedback chips here.

## 7. Memória (MemoryPage.tsx, 87 lines) — 4-way segmented: Áttekintés / Napló / Kereső / Audit

- **Áttekintés** (`MemoryLayersPanel`): four `MemoryLayerCard`s with pulsing dashed
  `FlowConnector`s carrying crons: **L0 · Nyers adat** 47/60 nap → "napi összefoglaló ·
  0 20 2 * * *" → **L1 · Epizodikus napló** 38 nap (chips: 38 nap-vektor / 112 chat-vektor /
  dátumtartomány; taps to Napló) → "minta-felismerés · 0 40 2 * * *" → **L2 · Ítélet-inbox**
  6 minta (+ "2 függő tényjelölt"; taps to /insights) → "hipotézis + tudás-promóció ·
  0 0 3 * * SUN" → **L3 · Tartós tudás** 15 tény (+ "168× megerősítés / 14 a promptban";
  taps to Tudástár). Footer "Miért nem lát még mintát a motor? →".
- **Napló** (`MemoryJournalPanel`): memoir-typography day cards, HU month separators, dayLabel
  "augusztus 12., szerda", corner dot = embedded/not, focus-scroll from search.
- **Kereső** (`MemorySearchPanel`): lazy submit search ("Milyen napot keresel? (pl. rossz alvás
  edzés után)"), "N hasonló nap a memóriából", `SimilarDayCard`: 52px match ring %+"EGYEZÉS",
  "N napja", similarity bar, memoir excerpt, score-math chips **egyezés 0.81 × frissesség 0.96 =
  végső 0.78** + "Napló →".
- **Audit** (`MemoryAuditPanel`): "LLM-használat · 30 nap" hero cost ($0.125, <$0.001 guard),
  `TokenColumns` stacked bars + "54 hívás · bemenet 248.3k · kimenet 38.7k"; fact provenance
  groups "Chatből tanulta / Mintából promótálva / Kézzel rögzítve" with "×N megerősítve",
  "utoljára: …", "⧉ minta: {patternTitle}".
- Honest: degraded / pending / error+Újra; overview null → blank return null; journal empty →
  "Az első éjszakai összefoglaló még nem készült el — a napló éjjelente, magától íródik.";
  search empty → "Nincs elég hasonló nap a memóriában."; audit disabled → "Az LLM-hívás
  audit-napló ki van kapcsolva — nincs mit auditálni."
- Gaps: two links point at the retired Motor route (bounce to /insights); jobs.lastSummaryDate
  fetched, unused; "30 nap" label vs 7-day seed window mismatch; mock search query-independent.

## Cross-page notes for hub-tile design

- Hero numbers exist only on: Minták (bucket tiles + prose counts), Heti (score/100), Memória
  Áttekintés (4 layer bigs) + Audit (cost). Memoár/Tudástár/Előrejelzések/Kísérletek lead with
  counts-in-eyebrows ("Tudástár · 15 tény", "N=1 kísérletek · 2").
- Shared honest-null vocabulary: **"tanulom"** (Heti, Előrejelzések, Kísérletek, confidence),
  GhostState cold loads, "…most nem elérhető" degraded.
- FeedbackChips mounts on: Heti suggestion, Memoár, every Prediction — NOT experiments/patterns.
- Dead/inert elements not to promote into tiles: memoir archive row, weekly Elfogad/Hangoljuk,
  mock experiment propose CTA, the two Motor links.
