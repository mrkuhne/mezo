---
title: Language (Hungarian + English)
type: feature-platform
status: mixed
updated: 2026-10-11
tags: [platform, frontend, backend, auth, ai]
key_files:
  - frontend/src/shared/i18n
  - frontend/src/shared/lib/format.ts
  - frontend/src/shared/i18n/LanguageBoundary.tsx
  - frontend/src/data/auth/languageHooks.ts
  - backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/UserLanguage.java
  - backend/src/main/java/io/mrkuhne/mezo/techcore/message
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OutputLanguageDirective.java
  - backend/src/main/resources/messages_hu.properties
  - backend/src/main/resources/messages_en.properties
related: [_platform-auth-security, _platform-design-system, companion, settings, _platform-api-backend]
---

# Language — Feature Documentation

> One-line: the app speaks Hungarian (source, default) and English (second). The choice is stored with the account (`app_user.language`), switched in Settings → Nyelv, and drives the client message catalog, the date/number formats, the server-written error sentences and the language of every LLM answer. **Status: ✅ the mechanism is done (slice N1, `mezo-n4wf5.11`, 2026-10-11); 🔶 coverage is partial** — the frame, the Folyadék kit and the Settings pages are bilingual; every other screen still shows Hungarian in English mode until its slice (N2 Nap/Edzés/Edzés közben, F5–F8 the rest, N3 the prompts and catalogs, F9 the full audit). This is a *platform* feature — no route of its own; its one control is the Nyelv block on `/settings/general`.

---

## 1. Summary

Owner decision 2026-10-11: the app must be usable in English; Hungarian stays. N1 built what every later slice stands on, and nothing else:

- **A stored preference** — `app_user.language` (`hu` | `en`), `MeResponse.language`, `PUT /api/auth/me/language`, `RegisterRequest.language`.
- **A typed client catalog, no library** — `frontend/src/shared/i18n`: Hungarian is the source object, English is typed `Shape<typeof hu>`, so a missing or mis-shaped English entry is a compile error.
- **A switch without a reload** — `LanguageProvider` aligns the store with the account and remounts nothing; `LanguageBoundary`, inside each shell just above the routed screens, remounts the screens (the title bar, top tabs, page and bottom bar) while everything with app-root lifetime (splash, toasts, ceremony / tutorial / arrival providers, theme, router) stays mounted.
- **One formatting module** — `shared/lib/format.ts` (`hu-HU` / `en-GB`), with a ratchet that stops new hand-rolled formats.
- **Server sentences in the user's language** — two message bundles, `UserMessages`, `Accept-Language` for requests with no account.
- **The LLM answers in the user's language** — an output-language directive appended to the system prompt of every call that a person reads.
- **Six guards** that keep all of this from rotting.

Owner decisions (spec §2, 2026-10-11, not to be re-litigated): history is never translated; a new account takes the device language (Hungarian device → `hu`, anything else → `en`) and existing accounts stay `hu`; English names are Today · Training · Fuel · Mezo · Me and Sleep · Movement · Food · Mood · Mezo · Skeptic; built-in catalogs (exercises, habits, quests, titles, pantry) are translated in N3 and user-created items stay as written; units do not change (kg, km, 24-hour clock); the Settings note „Az angol változat készül, egyes oldalak még magyarul jelennek meg." / "English is in progress — some pages still appear in Hungarian." stays until F9.

Driving design: [`docs/superpowers/specs/2026-10-11-nyelv-alap-design.md`](../superpowers/specs/2026-10-11-nyelv-alap-design.md) (the authority on the mechanism; §4 is the design, §4.7 the guards); plan [`docs/superpowers/plans/2026-10-11-nyelv-alap.md`](../superpowers/plans/2026-10-11-nyelv-alap.md). English copy rules: [style bible §2.5](../design_2.0/2026-10-09-folyadek-style-bible.md). Driver skill: `.claude/skills/folyadek/SKILL.md` (*Language*).

| Layer | State |
|---|---|
| Backend: preference, bundles, `UserMessages`, LLM directive | ✅ |
| FE core: store, catalog, provider, formatting, guards | ✅ |
| FE coverage: frame (title bar, tabs, bottom bar, splash, return bar), kit strings, Settings | ✅ |
| FE coverage: Nap, Edzés, Edzés közben | ⬜ Hungarian in English mode — N2 |
| FE coverage: Fuel, Én, Mezo, overlays, login | ⬜ F5–F8, bilingual from their first line |
| Prompts, team voice, notifications, built-in catalogs | ⬜ N3 |
| Mock mode | ✅ the mock account's language follows the device cache |

---

## 2. User-facing behavior

- **Settings → Beállítások (`/settings/general`) → first section „Nyelv" / "Language".** Two buttons, *Magyar* and *English* (`aria-pressed`, ≥ 44 px, one row at 320 px), a one-sentence body and the „in progress" note (both in the language that is active). Pressing the other language changes the whole app at once, with no reload and without losing the URL or the query cache. Pressing the current one does nothing. The choice survives a restart and a second device (stored with the account); if the save fails the app returns to the previous language and then shows the save-failed toast, in that previous language. Two quick taps (Magyar → English → Magyar) end on the last choice, whatever order the server answers in.
- **First start.** A fresh device with no cache resolves from `navigator.language` (starts with `hu` → Hungarian, else English). The login and register screens read the same value; registration sends it, so a new account starts in the language its first screen was in.
- **What is English today:** the title bar (labels, notification panel and its day headings), the top tabs, the bottom bar, the splash, the floating „back to your workout" bar, the kit's own strings (Back, Close, Cancel, Loading…, Retry, steppers), the team field names, the frame date, every Settings page, the frame-level server errors (`AUTH_*`, `VALIDATION_*`, `RESOURCE_NOT_FOUND`, `INTERNAL_ERROR`, `METHOD_NOT_ALLOWED`, account settings) and every new LLM answer.
- **What stays Hungarian in English mode (known, by design until its slice):** all other screens; 94 of the 117 `PAGE_INDEX` page labels (they fall back to the Hungarian label); the Settings-reachable Fuel settings pages, the goal settings page, the gym / sport / biometric / sleep-goal / change-password sheets and the learned-profile card; server-provided text (assembled context, what the user wrote); everything already stored (old AI messages, memories, summaries, journal, meal and exercise names).
- **Formats.** English dates are day-first with the month written out and no ordinal („Wednesday, 7 October", „2 Nov"), the 24-hour clock, metric units, `.` decimal and `,` thousands; Hungarian is unchanged word for word.

---

## 3. Architecture & data flow

### Resolution order — who writes what

```
account (me.language)  →  device cache (localStorage 'mezo-lang')  →  device language (navigator.language)
```

| Source | Written by | Read by |
|---|---|---|
| Account `app_user.language` | `PUT /api/auth/me/language` (targeted `@Modifying` update, never a whole-entity save); registration | `GET /api/auth/me` → `useMe()` → `LanguageProvider` |
| Device cache `mezo-lang` | `setLang()` (a switch), `announceLang()` (whenever the account value is known, also when it already equals the store) | `resolveInitialLang()` at module load, the login/register screens, everything outside the query provider, the mock account |
| Device language | the browser | `deviceLang()` only when the cache is empty or garbage |

The store (`lang.ts`) is a module-level value with subscribers (`useSyncExternalStore`), so code outside React (`m()`, `format.ts`, label maps) reads the same language as components. `<html lang>` follows it. `src/test/setup.ts` pins `hu` before every test (jsdom reports `en-US`).

### The switch

```
Nyelv button → useLanguageSetting().setLanguage(next)            data/auth/languageHooks.ts
  onMutate (synchronous): cancel in-flight `me` reads; remember the rollback point (first write of a chain only);
                          patch cached `me.language`; setLang(next) → store + device cache + <html lang>
  mutationFn: PUT /api/auth/me/language  (mock mode: resolves locally, nothing fetched)   — serialised: scope { id: 'language' }
  onSuccess: the rollback point moves to what the server confirmed; only the NEWEST write may cache the server's `me`
  onError:   only the newest write acts: restore `me` and setLang(rollback point), THEN emitSaveFailedToast(error)
→ the store notifies → LanguageBoundary remounts the screens (below)
```

- **Everything is in mutation-level options** because the caller unmounts mid-mutation (the boundary remounts the screen that holds the button); per-call callbacks would never run.
- **Quick double switches.** Writes are serialised (`scope`), so the server sees them in tap order. `latest` (a module counter) names the newest write: a response to an older tap is confirmed silently and never flips the app back. `base` (module state, not component state, because every tap gets a fresh hook instance) is the rollback point of the whole chain: taken when the first write starts, moved forward by every write the server confirms. If both fail the app returns to where the chain began; if the first lands and the second fails it returns to what the server holds.
- **The failed-switch toast is emitted by the hook, after the rollback.** The default mutation-error toast (`QueryProvider`'s mutation cache) fires before any `onError`, i.e. in the language the user just left. This mutation therefore opts out with `meta: { ownErrorToast: true }` (`OWN_ERROR_TOAST`) and calls `emitSaveFailedToast(error)` (`data/_client/saveFailedToast.ts`) itself once the store is back, so the words are in the language the app now shows. The toast host (`ToastProvider`) is above the boundary and survives the switch; a toast keeps the words it was emitted with.

### `LanguageProvider` — the contract

Mounted in `AppProviders` (`app/providers/AppProviders.tsx`, the one provider stack `main.tsx` renders; tests mount the same component) inside `QueryProvider`, above `ThemeProvider`, the splash, the router and `Suspense` (`ErrorBoundary` is outside it and builds its fallback lazily, so it reads the language when it crashes). It **only aligns the language store with the account and remounts nothing**:

- **Store aligned before children render.** When the account language is already known at render (cached `me`, mock `initialData`), the provider writes it to the store *during render* (`alignLang`, silent — no subscriber is notified mid-render) and announces it from an effect (`announceLang`: device cache, `<html lang>`, subscribers). The first paint is already right. Without this the store starts on the device language, the account value flips it a moment later, and the whole tree mounts twice. The device cache is written whenever the account language is known, also when it already equals the store.
- Signing out keeps the last language, so the login screen stays in the language last used.

### `LanguageBoundary` — the remount, and what lives on either side

The remount exists because some code reads the catalog with the non-hook `m()` (label maps, logic files, values captured in state) and cannot re-render by itself. `LanguageBoundary` (`shared/i18n/LanguageBoundary.tsx`) is mounted in `AppLayout` and `AdminLayout`, around the title bar / top tabs / routed page / bottom bar / floating layers. It is **two-phase**: on a change it first commits its children as unmounted (`null`), then a layout effect mounts the new tree under `<Fragment key={lang}>` (no painted blank frame). **Why two phases:** fourteen source files create a portal whose target is resolved *during render* with `document.querySelector('.phone-screen') ?? document.body`. With a plain keyed remount the new tree's render runs while the old nodes are still in the DOM, so a target inside the old tree is found and the portal's content lands in a detached node (Fuel settings' save bar disappeared). With two phases the new tree renders against a DOM without the old nodes, like a cold start; and because `.phone-screen` itself sits above the boundary and stays mounted, the lookup finds the LIVE node. Cost: one extra synchronous commit per switch.

The boundary used to sit at the app root. That reset everything with app-root lifetime on every switch: the startup splash replayed (three seconds, the app inert) and a toast that was just shown was wiped. Placing it just above the routed screens fixed that; the reviewed list is the header comment of `LanguageBoundary.tsx`.

| Above the boundary — survives a switch | Below the boundary — remounted |
|---|---|
| `QueryProvider` / `AuthGate` (query cache, session) | `MezoThreadProvider` (its state is in localStorage, re-read on mount) |
| `LanguageProvider` (account sync) | `FrameProvider` (the mounted page re-registers title / back) |
| `ThemeProvider`, `CircadianTheme`, `PhoneFrame` / `.phone-screen`, `ClaySprites` | `ScreenContent` (remembered scroll offsets — a switch lands at the top) |
| `StartupSplash` (its intro plays once) | `TitleBar`, `TopTabs`, the routed page (`Outlet`), `BottomBar`, `QuickLogFab`, `FloatingReturnLayer` |
| the router and the Suspense fallback | the admin rail and the admin page |
| `AppLayout` itself (once-per-session effects: schedule snapshot, screen telemetry) | |
| `ToastProvider` (visible toasts are state) | |
| `ArrivalProvider`, `MealCeremonyProvider`, `LevelUpProvider`, `TutorialProvider` (refs / open ceremony / once-per-session guards) | |
| `AdminLayout`'s `ToastProvider`, `ArrivalProvider` and owner check | |

**Authoring rule.** Whatever sits ABOVE the boundary renders its words through `useM()` / `useLang()` (hooks), because nothing remounts it — the splash label, the toast close label, the auth pages and the Suspense fallback do. The non-hook `m()` is safe only BELOW the boundary, or in code called at render of a component that subscribes. Before moving or adding a provider, check which side its state belongs on: anything that must live through a switch goes above, and a component below the boundary must be fine being unmounted mid-gesture.

### Message catalog

```
frontend/src/shared/i18n/messages/<area>.hu.ts   the SOURCE: a nested plain object, string or function leaves
frontend/src/shared/i18n/messages/<area>.en.ts   export const xEn: Shape<typeof xHu> = { … }
frontend/src/shared/i18n/messages/index.ts       registers each area in `catalogs: Record<Lang, Messages>`
```

- **Leaves** are strings or functions for slots: `decrease: (who: string) => \`${who} csökkentése\``. `Shape<T>` widens string leaves to `string` and keeps function parameter lists, so a missing key, a wrong leaf kind or a wrong arity does not compile.
- **One sentence = one message with slots.** Never concatenate halves; word order differs between the languages.
- **Plurals:** `plural(n, { one, other })` (`plural.ts`) picks the form with `Intl.PluralRules` of the current language. Use it inside a function leaf: `setsDone: (n) => \`${n} ${plural(n, { one: 'set', other: 'sets' })} done\``.
- **Areas today:** `frame` (title bar, tabs, bottom bar, splash, return bar, page names, crash/loading), `kit` (the Folyadék kit's own strings), `settings` (nine page sections + `general`, `notifications`, `language`).
- **Reading:** `useM()` in a component (re-renders on a switch), `m()` anywhere else (label maps, logic files, `navModel`). Both return the current language's catalog and never throw.

### `useM()` vs `m()` — and the cache-key rule

`m()` is a plain read: it does not re-render anything. It is correct inside a function that runs at render or event time (it will see the language of that moment) and wrong in a module-level constant (evaluated once at import). The rule that follows:

> **No translated text is cached without the language in the cache key.** A `useMemo`, a `useState` initialiser, a `useRef`, a module constant or a query-selected value that holds *text* must either list the language in its dependencies/key or hold *data* (ids, numbers, `{ sent, attempted }`) and build the sentence at render time.

The boundary's remount hides this today — it resets every memo below it — but it is the contract: two reviewed bugs (`useDayOrbFill` label and the title bar's notification day headings) memoised translated text with the language missing from the deps and would have gone stale the day the remount is narrowed (and anything above the boundary is not reset at all). Module-level label maps (`navModel.DOMAINS` labels, `MEMBER_LABEL`, `PUSH_ERROR_COPY`, `WEEKDAY_HU`) are turned into lookup functions that read `m()` when called (`domainName`, `tabLabel`, `tabTitle`, `pageLabel`, `memberLabel`, `memberMeta`). `DOMAINS` itself keeps the Hungarian values as **source ids** (tests, `pageIndex` and the leltár key on them); only display goes through the lookups.

### Formatting — `shared/lib/format.ts`

The locale is **always the app language** (`locale()` → `hu-HU` | `en-GB`), never the device. `fmtDate(d, style)` (`weekdayLong | weekdayShort | monthDay | monthDayWeekday | full | frame`), `fmtNum`, `fmtGrouped`, `fmtInt`, `isoDay` (machine format, not display; built from the date's own local year / month / day, never from a cached `Intl` formatter, which would keep the time zone of its first use). Hungarian keeps the hand-rolled strings the app always showed (verified characterisation tests); English is built from `Intl.DateTimeFormat('en-GB')` parts (day first, no ordinal, no dots). Display `Intl` formatters are cached per locale + options. A date-only string (`'2026-10-07'`) is read by its parts, never parsed as UTC, so it is the 7th in every time zone (the time-zone test runs the module in several zones and was shown red against `new Date(d)`).

`shared/lib/dates.ts` and `huNum.ts` keep their exported names and delegate to `format.ts`, so their ~300 importers follow the language without edits. The Hungarian grammar helpers (`huFrom`, `huArticle`, `article`, `azA`, `outOf`) have an English branch that returns the plain form („the", „of 5"); sentences built on them are rewritten as messages by the slice that owns the screen.

**Import rule.** The leaf utilities `format.ts`, `dates.ts`, `huNum.ts` and `huText.ts` (hundreds of importers) import the store and the plural rule from `@/shared/i18n/lang` / `@/shared/i18n/plural`, never from the `@/shared/i18n` barrel: the barrel re-exports `LanguageProvider`, which would drag the auth data hooks and react-query in behind every formatter. `shared/lib/i18nLeafImports.guard.test.ts` enforces it.

**What does not change with the language:** kg, km, cm, the 24-hour clock, machine formats (`isoDay`, wire dates), ids and enum values.

**Ratchet.** `format.ratchet.test.ts` scans non-test sources for `hu-HU`, `toLocale(Date|Time)?String(` and `new Intl.` outside `format.ts`; the files that still do are in a sorted allowlist that may only shrink (about a hundred sites across train, fuel, insights, character, me, admin). A slice that converts a file removes its line.

### Server side

```
request → (JWT) → LlmActorContext.capture()  ──►  UserLanguage.of(userId)  ──►  'hu' | 'en'
                                                         ▲ app_user.language, unknown/missing → 'hu'
UserMessages.text(key, args…) → MessageSource (messages_hu / messages_en) → text
```

- **`UserLanguage`** (`feature/auth/service`): `of(userId)`, `current()` (through `LlmActorContext.capture()`, the same actor resolution the LLM audit uses, so request, SSE and cron threads all work without signature changes), `normalize(raw)`, `DEFAULT = "hu"`, `SUPPORTED`. It takes a user id and never reads `CurrentUser`, so it is safe on a cron or a pool thread that re-bound an actor.
- **Bundles.** `messages_hu.properties` and `messages_en.properties`, 184 keys each; there is **no** base `messages.properties` — Hungarian is a bundle like English and the host locale must never pick a language. `MessageSourceConfiguration` declares the `MessageSource` bean (`ResourceBundleMessageSource`, UTF-8, `fallbackToSystemLocale=false`); `spring.messages.*` would stay inert without a base bundle. `MessageBundleParityTest` fails on a key present in one bundle only.
- **`UserMessages`** (`techcore/message`): `text(key, args…)` resolves with the acting account's language; with no account (login, register, a missing token) it takes the first two letters of the `Accept-Language` header, which the client sends on every request and SSE call (`data/_client/api.ts`); else Hungarian. If loading the account fails (the database is the failure being reported) it falls back to Hungarian rather than mask the error. `GlobalExceptionHandler` resolves every `SystemMessage` through it.
- **The stable `code` stays the contract.** Where the client maps codes to its own copy (`authErrorText.ts`) it keeps doing so — through the catalog now.
- **Pattern for domain sentences** (applied by each slice, not yet by N1): a rule-based sentence a service produces is a bundle key with arguments rendered by `UserMessages`. Text that is **persisted** (feed rows, push bodies, summaries) is rendered once, in the user's language at that moment, and stays as written; it is never re-translated on a later switch.
- **Formerly English server messages are Hungarian in Hungarian mode now** (`INTERNAL_ERROR`, `AUTH_LOGIN_INVALID_CREDENTIALS`, …): an English sentence shown to a Hungarian user was a defect, not a parity target. "Gentle mode" is the provisional English of „kímélő mód" in the `TRAIN_RECOVERY_*` keys until N2 settles the term.

### The LLM directive

`OutputLanguageDirective.apply(prompt, language, slug)` (`feature/companion/llm`), called through `SpringAiCompanionLlm.withLanguage(...)`:

- **Hungarian → nothing.** The method returns the same instance, so every prompt is byte-identical: golden prompt tests, the fake LLM's `startsWith` dispatch and the OpenAI prompt-cache prefix are untouched.
- **English → a `[OUTPUT LANGUAGE]` block appended to the end** (never prepended): the instructions and data above are Hungarian; write every sentence a person reads in natural English; keep JSON keys, enum values, tool names, ids and fixed options exactly as specified; do not translate names or quoted user text.
- **Where it rides.** When the call has a turn context (the volatile second system message), the directive goes on the *turn context* so the cacheable system prefix stays untouched; otherwise on the system prompt. It is applied exactly once per call, on the caller's thread, at the entry point that first receives the prompt — the result is both what is sent and what the audit row stores — and never by an overload that merely delegates (the 5-arg overloads, the OpenAI → Gemini media hand-off).
- **Exempt** by feature slug (`LlmCallContextHolder`): `embed_memory` (embeddings), `companion_recall` (the recall query embedding, rewriter and reranker, internal, never shown) and `admin_replay` (the admin dry-run replay re-runs the recall rewriter / reranker under its own slug with the *inspected user* as actor; without the exemption a replay for an English account would send a prompt production never sends and stop being a replay). The audio transcription overload (`complete(..., InlineAudio)`) is exempt by overload: a transcript is the user's own words. The slugs are the shared constants `LlmCallContext.FEATURE_EMBED_MEMORY` / `FEATURE_COMPANION_RECALL` / `FEATURE_ADMIN_REPLAY`, used by every call site and by `OutputLanguageDirective.EXEMPT_SLUGS`, so a renamed slug cannot silently drop out of the set. A call with no slug (null) is simply not exempt.
- **Known limit until N3:** prompts and the context fed to the model are Hungarian, so an English answer can drift back to Hungarian, especially in long chats with Hungarian history. N1 does not translate prompts.

### Mock mode

`mockMe.language` is a getter: the device cache `mezo-lang` if it holds `hu`/`en`, else `hu` — never `navigator.language`, so a fresh mock session and every unit test stay Hungarian. A layout spec loads any route in English by seeding `mezo-lang`. The mock switch resolves locally (pattern: `useAccountSettings`); mock data decides what a runtime pass can see, so a mock-mode English pass shows English only where the screen reads the catalog, never the server.

---

## 4. Data model & API

- **Table:** `app_user.language varchar(2) NOT NULL DEFAULT 'hu'`, `ck_app_user_language CHECK (language IN ('hu','en'))` — `backend/src/main/resources/db/changelog/1.1.0/script/202610111200_mezo-n4wf5.11_app_user_language.sql`. Every existing account is `hu`.
- **Contract:** [`api/feature/auth/auth.yml`](../../api/feature/auth/auth.yml) — `Language` enum (`hu` | `en`); `MeResponse.language` (required); `RegisterRequest.language` (optional, default `hu`); `PUT /api/auth/me/language` `{ language }` → `MeResponse` (400 `VALIDATION_INVALID_VALUE` for anything else). DTOs are generated.
- **Entity / repository:** `AppUserEntity.language`; `AppUserRepository.updateLanguage(id, language)` (targeted `@Modifying`, like `updateAccount`). `AuthService.updateLanguage` / `register` normalise through `UserLanguage.normalize`.
- **FE:** `authApi.updateLanguage`, `authApi.register` (always sends `language: getLang()`), `useLanguageSetting()` → `{ lang, setLanguage, pending }`; `Accept-Language` is set by `data/_client/api.ts` on `apiFetch` and `apiSse`.

---

## 5. Integrations

- **Auth & account** ([`_platform-auth-security.md`](_platform-auth-security.md)). *Contract:* `me.language` is the account value of the resolution order; `LanguageProvider` is the only place that aligns the store with it (and it remounts nothing — `LanguageBoundary` does). Registration sends the resolved language.
- **Design system / kit** ([`_platform-design-system.md`](_platform-design-system.md)). *Contract:* the Folyadék kit's own strings (`kit` catalog), the frame (`frame` catalog) and `FrameProvider` titles read the catalog; a kit piece takes text as props and owns only its fixed words (Back, Close, …). `memberLabel` / `memberMeta` give the team field names.
- **Settings** ([`settings.md`](settings.md)). *Contract:* the Nyelv block is the one writer of the preference (`useLanguageSetting`); the Settings pages read the `settings` catalog.
- **Companion / every LLM call** ([`companion.md`](companion.md) §5.3). *Contract:* the `CompanionLlm` port adapter (`SpringAiCompanionLlm`) applies the directive from `UserLanguage.current()`; call sites change nothing.
- **Error contract** ([`_platform-api-backend.md`](_platform-api-backend.md)). *Contract:* `SystemMessage.code` is stable; `message` text follows the user's language through `UserMessages`.
- **Notifications** ([`_platform-notifications.md`](_platform-notifications.md)). Push and feed copy written server-side or by the client schedule writer is still Hungarian — N3. Persisted text is rendered once (see §3).
- **Docs / skills:** the `/folyadek` skill's *Language* section and the bible §2.5 (English copy) point here for the recipe.

---

## 6. How to use it (consume)

```tsx
import { useM, plural } from '@/shared/i18n'
import { fmtDate, fmtNum } from '@/shared/lib/format'

function SetsDone({ n, day }: { n: number; day: Date }) {
  const M = useM()                                   // re-renders on a switch
  return <p>{M.frame.returnBar.setsDone(n)} · {fmtDate(day, 'monthDay')} · {fmtNum(78.6)}</p>
}
```

```ts
// outside React (label maps, logic): read when called, never at import
import { m } from '@/shared/i18n'
export const domainName = (d: NavDomain) => (m().frame.domains as Record<string, string>)[d.id] ?? d.name
```

- Reading the language itself: `useLang()` / `getLang()`; switching: only `useLanguageSetting().setLanguage` (it also writes the server) — never call `setLang` from a feature.
- Server side, a sentence for the acting user: inject `UserMessages` and call `text("SOME_KEY", arg)`; add the key to **both** bundles.
- A backend job that has a user id but no request: `userLanguage.of(userId)`.

---

## 7. How to extend it — how a slice translates its area

1. **Prototype first.** Write the English next to the Hungarian with `F.L(hu, en)` (the kit's frame words go in `FR_EN`), by the bible §2.5 — written, not converted. The owner approves it on the Artifact with the look. Toggle with the side-panel checkbox „English (angol szöveg)" or `?lang=en`.
2. **Add the catalog area.** `messages/<area>.hu.ts` (move the literals out of the components verbatim — Hungarian must stay word for word identical), `messages/<area>.en.ts` typed `Shape<typeof areaHu>`, and register both in `messages/index.ts` (`Messages` type + `catalogs`). Slots become function leaves; plurals use `plural`; one sentence is one message.
3. **Wire the components.** `const M = useM()`; label maps and logic files become lookups on `m()`; text that was cached (memo, state, query data) either carries the language in its key or is stored as data and rendered at render time. Text hides in `aria-label`s, placeholders, `title`s, toasts, chart axes, error maps and mock fixtures — grep for all of it.
4. **Format through `format.ts`.** Replace `hu-HU`, `toLocale*`, private month arrays and `new Intl.*` with `fmtDate` / `fmtNum` / `fmtGrouped` / `fmtInt` (add a style there if one is missing); delete the file's line from the ratchet allowlist.
5. **Server sentences.** Move the domain's rule-based sentences into both bundles with arguments and render them with `UserMessages` (persisted text: once, as written). Keep `code`s stable.
6. **Extend the guards** (below): add the directories to `TRANSLATED`, shrink the allowlists, add the routes to the English layout spec.
7. **Tests.** Existing Hungarian assertions stay (never mass-rewrite); add English cases (`*.en.test.tsx`) and a runtime-switch case where state is cached. Run the FE suite in both data modes (`CI=true`, mock and `VITE_USE_MOCK=false`), the affected layout specs, backend focused tests + `ArchitectureTest`, `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs`.
8. **Runtime pass in both languages** at 390 and 320 px, reduced motion: no Hungarian word on any route, state or sheet of the slice; read one real AI answer per AI surface in each language.

### The guards

| Guard | File | A slice… |
|---|---|---|
| Catalog completeness | `shared/i18n/catalog.completeness.test.ts` | does nothing: it walks every registered area — same keys, same leaf kind, same arity, no empty English leaf (the walker is itself tested against a broken twin) |
| No hard-coded Hungarian | `shared/i18n/hardcodedHungarian.guard.test.ts` | adds its directories to `TRANSLATED` (relative to `src/`, a directory ends in `/`); moves every hit into the catalog; deletes the `ALLOWLIST` entries it made obsolete. The guard fails on an allowlist entry that no longer matches anything (rot check) and on one pointing outside `TRANSLATED`. It tokenises source (comments, quote strings, template chunks, regex literals, JSX text) and flags any accented Hungarian letter |
| Formatting ratchet | `shared/lib/format.ratchet.test.ts` | removes the lines of the files it converted; the list is asserted sorted and may only shrink |
| Backend bundle parity | `backend/src/test/.../techcore/message/MessageBundleParityTest.java` | adds keys to both bundles or the test fails; a value with a `{n}` placeholder may not hold a lone apostrophe (`MessageFormat` would swallow it and the placeholders), checked in both bundles |
| Leaf imports | `shared/lib/i18nLeafImports.guard.test.ts` | does nothing: `format.ts`, `dates.ts`, `huNum.ts`, `huText.ts` may import only `@/shared/i18n/lang` or `/plural`, never the barrel (the scan is itself tested on every import form) |
| English layout | `frontend/tests/layout/language-en.spec.ts` | adds its routes: no sideways scroll, one-line bottom-bar labels, whole top-tab words, no wrapped button at 390 and 320 px; every check asserts a non-empty set first (a layout check over an empty set passes) |

---

## 8. Testing

**Frontend** (both data modes must stay green):
- `shared/i18n/lang.test.tsx` — resolution order, cache, `alignLang`/`announceLang`. `LanguageProvider.test.tsx` — children render once with a known account language (no flip); the provider alone remounts nothing; the device cache is written when the account language equals the store and left alone while it is unknown; with the boundary: a render-time portal stays attached across a switch, every unmount precedes every mount, and a host above the boundary stays mounted with the portal landing in that live node. `app/providers/AppProviders.language.test.tsx` mounts the real provider stack (`AppProviders`): the intro plays once (also when the switch comes while it is still playing), and a failed save shows the toast in the rolled-back language, asserted on the rendered toast.
- `data/auth/languageHooks.test.tsx` — optimistic switch, rollback on 500 and on a network error, the in-flight write not overwritten by a stale account value, two quick taps (a late answer never flips the app back; both fail → back to the start with one toast; first lands, second fails → back to what the server holds); `afterEach` awaits `client.isMutating() === 0` so a leaked write cannot reach a later case. `data/auth/authMock.test.ts` — the mock account follows the cache.
- `shared/lib/format.test.ts` (+ `huFormat.characterization.test.ts`) — both languages, the time-zone case run per zone, `isoDay` following a zone change; `format.ratchet.test.ts`; `i18nLeafImports.guard.test.ts`. `shared/ui/ToastProvider.test.tsx` — the close label follows the language.
- `app/frame.en.test.tsx`, `app/TitleBar.en.test.tsx`, `shared/ui/folyadek/kit.i18n.test.tsx`, `features/settings/pages/SettingsPages.en.test.tsx`, `features/me/pages/BeallitasokPage.language.test.tsx`, `features/me/pages/NotificationsPage.en.test.tsx` — English rendering plus a runtime switch on one DOM node.
- Layout: `tests/layout/language-en.spec.ts` (hubs and Settings at 390/320, the switch pressed in Settings, `/fuel/settings` save bar after a switch, and the startup intro NOT replaying on a switch — that case deliberately does not seed the splash skip), `tests/layout/settings-language.spec.ts` (the Nyelv block).

**Backend:** `feature/auth/LanguageIT` (register with a language, the PUT, `me.language`, an English error for an English account, `Accept-Language` for an unauthenticated request), `techcore/message/MessageBundleParityTest`, `feature/companion/llm/OutputLanguageDirectiveTest` and `SpringAiCompanionLlmLanguageTest` (directive appended once, on the turn context when present, absent for `hu`, exempt slugs (including `admin_replay`) and the audio overload untouched, a null slug safe, the audited prompt equals the sent one). Focused tests miss ArchUnit and the codemap — run `ArchitectureTest` and `node scripts/gen-codemap.mjs` too.

**Commands:** `cd frontend && CI=true pnpm test` and `CI=true VITE_USE_MOCK=false pnpm test` (file filters after `--` are ignored; unset `VITE_USE_MOCK` means mock mode), `pnpm test:layout`, `pnpm build`; `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true`.

---

## 9. Decisions, gotchas & deferred

**Decisions:** typed catalog over a library (react-i18next typed keys are costly at this size, react-intl has no key safety, Lingui/Paraglide add a build step for two languages); Hungarian as a bundle, not a base file; directive appended, never prepended; English-only locale `en-GB` for day-first, 24-hour output; the Hungarian output of `format.ts` stays hand-rolled so it is byte-for-byte the old text.

**Gotchas and traps:**
- **Unaccented Hungarian is invisible to the hard-coded-Hungarian guard** („Vissza", „Mai", „Terv", „Fuel" have no accent). Completeness and review cover those; the guard is an accent detector. A second false negative: a `//` inside JSX text hides the rest of its line from the comment stripper.
- **`pageIndex` labels fall back.** `app/pageIndex.ts` (the Hungarian page inventory, 117 routes) is allowlisted wholesale (a test pins its exports to data only); `pageLabel()` swaps in catalog names for the 23 translated pages and every other label shows Hungarian in English mode until its slice. Delete the allowlist entry when the inventory moves into the catalog.
- **Still Hungarian but reachable from Settings:** Fuel settings, `GoalSettingsPage`, the gym / sport / biometric / energy-breakdown / sleep-goal / change-password sheets, the learned-profile card, `VoiceField`, the sheet close labels, the kalauz text, the admin pages behind Settings rows. Converting another feature's component ad hoc from a Settings link is refused (bible F2.12): list it, the owning slice converts it.
- **English short month and ICU.** `stamp.ts` in the notification logic formats an English short month through `Intl` directly; ICU can render „Sept". Route such formats through `format.ts`, which builds month names from parts and slices them.
- **The LLM can drift back to Hungarian** until the prompts and the context are translated (N3). Verify with a real answer; do not assert it in a test.
- **History is never translated.** Old AI messages, memories, summaries, the user's journal and names stay as written; there is no language marker on stored AI text yet (N3). Persisted server text is rendered once.
- **Portals and the remount.** Any code that resolves a portal target during render with `document.querySelector('.phone-screen')` is sensitive to a keyed remount; the two-phase `LanguageBoundary` is what keeps it correct. Do not "simplify" it back to a single `key`, and do not narrow the remount without fixing the memo rule first.
- **A remount boundary resets everything with app-root lifetime beneath it.** Placed at the app root it replayed the startup splash on every switch and wiped a just-shown toast. List what lives under a boundary before placing or moving it (table in §3); no spec noticed the splash because every spec seeds the splash skip.
- **Time zone.** A cached `Intl.DateTimeFormat` keeps the zone it was created in; `isoDay` is built from the date's own parts for that reason. Do not reintroduce a module-level formatter for a machine format.
- **`Msg` / `memberLabel` read `m()` (non-hook)** and rely on the boundary's remount (they sit below it); prefer `useM()` in the component, and never use them above the boundary.
- **Hungarian copy changes shipped with N1** (prototype is the build target): Settings hub row „Nyelv, kalauzok, fiók, jelszó"; `/settings/general` intro „Ugyanaz a világ. A saját nyelveden és szokásaiddal."
- **Deferred (minor, from review):** `UserMessages` reads the actor's language once per message; `UserLanguage.current()` is one `findById` per LLM call; `NOTIFICATION_CATEGORY_META.label/description` are dead duplicates of the catalog; `Lines`/`Marked` (catalog text renderers) live in `features/settings` and are imported by `features/me`; `frame.tag` / `frame.kicker` uppercase English literals; some short English server texts lack the next step their Hungarian twin has; `AUTH_ACCOUNT_DISABLED` English adds a sentence with no Hungarian counterpart.
- **Later slices:** N2 (Nap, Edzés, Edzés közben into both languages; owner approves the "Gentle mode" term), N3 (prompts, team voice, notifications, built-in catalogs, cross-language memory recall, a language marker on stored AI text), F5–F8 bilingual from the first line, F9 the full English audit and removal of the Settings note.

---

## 10. Key files

**Frontend core** (`frontend/src/shared/i18n/`):
- `lang.ts` — the store: `Lang`, `getLang`/`setLang`/`subscribe`/`useLang`, `resolveInitialLang`, `deviceLang`, `alignLang`/`announceLang`, `LANG_KEY = 'mezo-lang'`.
- `LanguageProvider.tsx` — account alignment before children; remounts nothing. `LanguageBoundary.tsx` — the two-phase keyed remount inside each shell, with the reviewed above / below list in its header. `LoadingFallback.tsx` — the Suspense fallback that re-renders in the current language.
- `index.ts` — `m()`, `useM()`, re-exports. `shape.ts` — `Shape<T>`. `plural.ts` — `plural(n, forms)`.
- `messages/{index,frame.hu,frame.en,kit.hu,kit.en,settings.hu,settings.en}.ts` — the catalogs.
- `catalog.completeness.test.ts`, `hardcodedHungarian.guard.test.ts`, `lang.test.tsx`, `LanguageProvider.test.tsx` — the guards and core tests; `frontend/src/shared/lib/i18nLeafImports.guard.test.ts` — the leaf-import guard.
- `frontend/src/shared/lib/format.ts` (+ `format.test.ts`, `format.ratchet.test.ts`), `shared/lib/dates.ts`, `shared/lib/huNum.ts`, `shared/lib/huText.ts` — formatting and grammar helpers.

**Frontend data / UI:**
- `frontend/src/data/auth/languageHooks.ts` — `useLanguageSetting()`; `data/_client/saveFailedToast.ts` — `emitSaveFailedToast`, `OWN_ERROR_TOAST`; `app/providers/AppProviders.tsx` — the app-root provider stack; `authApi.ts` (`updateLanguage`, `register`); `authMock.ts` (language getter); `data/_client/api.ts` (`Accept-Language`).
- `frontend/src/app/navModel.ts` — `domainName`, `tabLabel`, `tabTitle`, `pageLabel`, `frameDate`; `app/pageIndex.ts`; `app/FloatingReturnLayer.tsx`.
- `frontend/src/shared/ui/folyadek/Msg.tsx` — `memberLabel`, `memberMeta`.
- `frontend/src/features/me/pages/BeallitasokPage.tsx` — the Nyelv block; `frontend/src/app/AppLayout.tsx`, `frontend/src/features/admin/AdminLayout.tsx` — where the boundary is mounted.
- `frontend/tests/layout/language-en.spec.ts`, `frontend/tests/layout/settings-language.spec.ts`.

**Backend:**
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/UserLanguage.java` — the account language lookup.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/message/UserMessages.java` — message resolution for the acting user / `Accept-Language`.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/MessageSourceConfiguration.java` — the `MessageSource` bean.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/OutputLanguageDirective.java`, `SpringAiCompanionLlm.java` — the directive and where it is applied.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/exception/GlobalExceptionHandler.java` — resolves through `UserMessages`.
- `backend/src/main/resources/messages_hu.properties`, `messages_en.properties` — the bundles.
- `backend/src/main/resources/db/changelog/1.1.0/script/202610111200_mezo-n4wf5.11_app_user_language.sql`; `api/feature/auth/auth.yml`.
- Tests: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/LanguageIT.java`, `…/techcore/message/MessageBundleParityTest.java`, `…/feature/companion/llm/OutputLanguageDirectiveTest.java`, `…/SpringAiCompanionLlmLanguageTest.java`.

**Design / process:** [`docs/superpowers/specs/2026-10-11-nyelv-alap-design.md`](../superpowers/specs/2026-10-11-nyelv-alap-design.md), [`docs/superpowers/plans/2026-10-11-nyelv-alap.md`](../superpowers/plans/2026-10-11-nyelv-alap.md), style bible §2.5 and the N1 lessons in its appendix, `docs/design_2.0/prototypes/vilagos/HANDOFF.md`, `.claude/skills/folyadek/SKILL.md`.
