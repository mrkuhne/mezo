# F7.5 · Mezo mély kör — chat-műveletek, retry, Memoár-archívum

**Driving issues:** mezo-d20.8.5 (design round) + mezo-d20.8.5.1 (dev) · **Date:** 2026-09-01
**Prototypes:** `docs/design_2.0/prototypes/mezo-chat.html` (F7.5 bővítés, artifact ae02e856) ·
`docs/design_2.0/prototypes/mezo-memoar.html` (ÚJ, artifact 95759be5)
**Approved by Daniel:** timeline archive + chapter-page navigation (no modal); chat ⋯/kebab
actions + error-bubble retry. Full ride to deploy.

## Goal

Three gaps in the Mezo tab close in one round:

1. **Conversation rename + delete** — today no endpoint and no UI affordance exists at any layer.
2. **Retry on the error bubble** — today a failed send loses the composer text; "retry" = retype.
3. **Memoir archive** — today only the latest memoir is readable; the repository comment
   ("archive is a later slice") and mezo-uajy's backend flags anticipated this exact slice.

## Prior art (researcher recon)

- **ChatGPT mobile** ([iOS](https://help.openai.com/en/articles/8980316-how-can-i-delete-a-conversation-in-the-chatgpt-ios-app), [Android](https://help.openai.com/en/articles/8167835-how-can-i-delete-a-chat-conversation-in-the-chatgpt-android-app)):
  long-press/kebab → menu with Rename / Delete; delete is destructive-styled and **confirmed**,
  rename is **not** (trivially reversible). ADOPTED: kebab + bottom sheet, two-step delete,
  no-confirm rename. REJECTED: swipe actions — they fight PWA scroll/back gestures.
- **[uxpatterns.dev AI error states](https://uxpatterns.dev/patterns/ai-intelligence/ai-error-states)**:
  inline system-styled error bubble; the failed user prompt stays visible; retry control in a
  stable position. ADOPTED wholesale. Category taxonomy REJECTED (v1 keeps the two existing
  message variants).
- **[Vercel AI SDK error handling](https://ai-sdk.dev/docs/ai-sdk-ui/error-handling)**:
  `regenerate()` state model — **replace, don't append**: retry removes the error (and any
  partial assistant output) and re-submits the same payload; no duplicated user message. ADOPTED
  as the retry state machine.
- **Day One Timeline** ([guide](https://dayoneapp.com/guides/tips-and-tutorials/)): month-grouped
  reverse-chronological entry cards. ADOPTED for the archive. Calendar view / search REJECTED
  (weekly cadence, ~52 records/year).
- **Apple Journal** ([MacStories review](https://www.macstories.net/reviews/apples-journal-app-journaling-for-all/)):
  cautionary tale — ambiguous tap zones. ADOPTED rule: the whole entry card is one tap target.

## Codebase terrain (investigator recon)

- **Chat FE:** `frontend/src/features/insights/pages/ChatPage.tsx` (selection in `?c=`;
  `selectConversation` :61; error bubble :254-258 today has no CTA and the failed text is
  cleared in `finally`), `frontend/src/data/insights/chatHooks.ts` (`useConversations` :87,
  `useChatActions` :159, `sendReal` :225, failure handling :242-252),
  `frontend/src/data/insights/chatApi.ts` (no rename/delete),
  `frontend/src/features/insights/sheets/ConversationPickerSheet.tsx` (presentational list).
- **Chat BE:** `api/feature/companion/companion.yml` — GET/POST conversation, messages, stream;
  **no PATCH/DELETE**. `AiConversationEntity` already carries `@SQLDelete`/`@SQLRestriction`
  soft delete + `title` (120); `ConversationService.getOwned` gives the ownership-404 idiom.
- **Memoir BE:** proactive-owned; `GET /api/proactive/memoir` latest-only (404 = "készül");
  `MemoirRepository` has only `findFirstByCreatedByOrderByWeekStartDesc` and a comment
  anticipating the archive. `MemoirResponse {id, weekStart, title, body, anchors[], generatedAt}`.
  Prompt v2 (mezo-uajy) writes a chronicler-voice body with `\n\n` paragraph breaks and
  humanized anchors.
- **Memoir FE:** `MemoirPage.tsx` (Mozaik lav face, `useMemoir()` plain useQuery, mock seed via
  initialData); the "Memoir archive" footer was retired at mezo-d20.5.5 as a dead affordance.
- **Patterns to follow:** MozaikPage/PageHead/PageBody + EntranceGroup; F7.3 sheet family CSS;
  `useDualQuery` for reads; mock mutations mutate the TanStack cache; hooks exported through
  `frontend/src/data/hooks.ts`; contract fragments + codegen types; ITs with populators +
  switch-off tests; ownership 404 via getOwned.
- **Traps:** `chatKey('newest')` vs id-keyed cache on delete (invalidate both, move `?c=` off
  the dead id); mezo-vdf4 header status precedence + `mzc-*`/sticky plumbing must not change;
  `useStickToBottom` rAF machinery — no smooth scrolls; visual goldens insights-chat-* and
  insights-memoar-* regenerate on both platforms; every new endpoint 404s honestly under
  switch-off; message feedback rows survive conversation soft-delete (messages soft-delete too —
  acceptable, feedback is keyed by artifactId and simply becomes unreachable).

## Design

### 1 · Conversation rename + delete

**Contract** (`api/feature/companion/companion.yml`):
- `PATCH /api/companion/conversation/{id}` — body `ConversationRenameRequest { title: string
  (1..120, required) }` → 200 `ConversationResponse`. 404 if not owned/absent.
- `DELETE /api/companion/conversation/{id}` — 204. Soft delete (entity wiring already exists);
  messages become unreachable through the existing `deletedFalse` finders. 404 if not owned.

**Backend:** `ConversationService.rename(user, id, title)` + `delete(user, id)` on the existing
`getOwned` idiom; `CompanionController` delegates. ITs: rename happy + 404-not-owned + 404-absent;
delete happy (list no longer contains it; messages 404) + 404s; switch-off IT for both.

**FE:** `chatApi.renameConversation/deleteConversation`; `useConversationActions` (new, in
chatHooks.ts) with mock legs mutating the `CONVERSATIONS_KEY` cache; ChatPage header gains a ⋯
disc (after the new-chat disc; status precedence untouched) and the picker rows gain a kebab —
both open **ConversationActionsSheet** (new): Átnevezés (inline input, Enter/Mentés, no confirm)
· Törlés (two-step inline confirm, warm tone — "a belőlük tanult emlékeket ez nem érinti").
On deleting the current conversation: `?c=` moves to newest (or `new` if none); both
`['chat','newest']` and the id key invalidate.

### 2 · Retry on the error bubble (FE-only)

`useChatActions` keeps the failed turn: on catch, `failedTurn = { text }` is retained in state
(today `turn` is nulled in `finally`); expose `retry()` (re-sends the same text — replace,
don't append: the error bubble unmounts, the user message stays) and `editFailed()` (returns
text for the composer and clears the failed state; ChatPage removes the pending user bubble).
The error bubble gains two buttons: **Újra** (primary) · **Szerkesztés** (ghost). Amber tone
per prototype; no smooth scroll.

### 3 · Memoir archive

**Contract** (`api/feature/proactive/proactive.yml`):
- `GET /api/proactive/memoir/archive` → 200 `MemoirArchiveResponse { entries: MemoirResponse[] }`
  (weekStart desc, full bodies — a year is ~52 small records). Empty list is honest (no 404).
  Latest endpoint untouched. Switch-off → 404.

**Backend:** `MemoirRepository.findByCreatedByOrderByWeekStartDesc` (deletedFalse via
@SQLRestriction); `ProactiveMemoirService.archive(user)`; controller op. ITs: ordering,
ownership isolation, empty list, switch-off.

**FE:**
- `memoirApi.archive()` + `useMemoirArchive()` (useDualQuery; mock seed: ~6 entries across 3
  months matching the prototype's tone); exported via hooks barrel.
- **MemoirArchivePage** (`/mezo/memoar/archivum`): MozaikPage(lav) + PageHead (‹ Memoár) + hero
  (i-memoar + count + "N fejezet · M hónap"); month-grouped timeline of full-card buttons (week
  chip + date range + anchor count + Fraunces title + 2-line excerpt). Month grouping is
  client-derived from weekStart (hu-HU month names).
- **MemoirChapterPage** (`/mezo/memoar/:weekStart`): the mezo-uajy chapter language — PageHead
  (‹ Archívum), hero (Hét N + date range), memoir card with drop-cap first paragraph (body split
  on `\n\n`), "Miből íródott" anchor chips (static chips from `anchors[]` — deep-linking waits
  for the MemoirAnchor target-ref backend flag from mezo-uajy), FeedbackChips
  (`useFeedback('memoir', id)`), and an előző/következő pager walking the archive order.
  Data comes from the archive query (find by weekStart); direct deep-link with a cold cache
  just loads the archive query first.
- **MemoirPage**: gains an "Archívum" CTA (the un-retired footer), navigating to the archive.
  Face otherwise untouched (the full book-hub reface of MemoirPage itself stays deferred with
  mezo-uajy's backend flags).

### Testing

TDD per slice. FE: component tests for the actions sheet (rename flow, two-step delete, cache
moves), retry (replace-don't-append, edit restores composer), archive page (month groups, card
→ navigate), chapter page (paragraph split, pager ends, feedback); both vitest modes. BE:
focused ITs above + ArchUnit untouched-layout. Visual: +3 goldens ×2 themes (mezo-memoar-archiv,
mezo-memoar-fejezet, chat picker with kebab is covered by existing insights-chat goldens
regenerating) on darwin + linux. Docs: insights.md, companion.md, proactive.md, CODEMAP regen.

### Out of scope

MemoirPage book-hub reface (latest + chapter grid on the page itself); MemoirAnchor target-refs
and tappable anchor deep-links; code-computed milestone card; structured multi-paragraph
contract field (FE splits on `\n\n`); automatic background retry.
