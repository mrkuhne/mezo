# Nyelv alap — the bilingual foundation (design spec, slice N1)

> Slice **N1** of the Folyadék programme (epic `mezo-n4wf5`, bead `mezo-n4wf5.11`, driver skill
> `/folyadek`). Owner decision 2026-10-11: the app must be usable in English; Hungarian stays.
> This spec is the authority on the language mechanism for every later slice (F5–F9, N2, N3).

## 1. Why

The owner wants the whole app in English as well: *"a beállításokban egy nyelvválasztó …
mindennek angolul kéne mennie, szövegek, promptok, válaszok, chat, értékelések."* There is no
i18n today. The remaining Folyadék slices re-read every sentence of their screens anyway, so
the language work rides on them; this slice builds what they all stand on.

## 2. Owner decisions (2026-10-11, do not re-litigate)

1. **History stays as written.** What the user wrote (journal, meal / exercise / habit names)
   and what was already said or stored (old AI messages, memories, summaries) is never
   translated. Only new output follows the switch.
2. **The default follows the device.** A Hungarian device starts in Hungarian, anything else in
   English. A new account is created with that language. Existing accounts stay Hungarian. A
   switch on the login screen is an F8 question.
3. **English names.** Domains: **Today · Training · Fuel · Mezo · Me**. Team fields:
   **Sleep · Movement · Food · Mood · Mezo · Skeptic**. Internal keys do not change.
4. **Built-in catalogs** (exercises, habits, quests, titles, pantry) are translated in **N3**;
   items the user created or renamed stay as written.
5. **Units do not change.** English mode keeps kg, km and the 24-hour clock; only the notation
   of dates and numbers follows the language.
6. **The switch is visible from N1**, in Settings, with one line under it: „Az angol változat
   készül, egyes oldalak még magyarul jelennek meg." / "English is in progress — some pages
   still appear in Hungarian." The line is removed in F9.

## 3. Scope of N1

In: the stored preference and the switch; the client message mechanism; language-driven
formatting; the output-language directive on every LLM call; the pattern for server-written
sentences, applied to frame-level errors; English for what F1 owns (title bar, top tabs,
bottom bar, splash, the shared kit's own strings) and for the Settings pages; the prototype's
language switch; English copy rules in the bible; the guards; docs.

Out (owned elsewhere): the pages of Nap / Edzés / Edzés közben (**N2**); Fuel, Én, Mezo,
Átfedők incl. login, kalauz, quick input (**F5–F8**, bilingual from their first line); the
prompts themselves, the team's voice, notification copy, built-in catalogs, cross-language
memory recall, a language marker on stored AI text (**N3**); the full English audit (**F9**).

## 4. Design

### 4.1 The preference

- `app_user.language varchar(2) NOT NULL DEFAULT 'hu'`, `CHECK (language IN ('hu','en'))` —
  the `timezone` column is the precedent (`AppUserEntity.java:52`). Liquibase script in
  `db/changelog/1.1.0/script/`.
- Contract (`api/feature/auth/auth.yml`): `MeResponse.language` (required, enum `hu|en`);
  `RegisterRequest.language` (optional, default `hu`); a new `PUT /api/auth/me/language`
  `{language}` → `MeResponse`. Written with a targeted `@Modifying` update like
  `AppUserRepository.updateAccount` (never a whole-entity save).
- Client resolution order: **account** (`me.language`) → **device cache** (`localStorage
  mezo-lang`, written whenever the account value is known or the user switches) → **device
  language** (`navigator.language` starts with `hu` → `hu`, else `en`). Pre-auth surfaces and
  everything outside the query provider read the last two. Registration sends the resolved
  value.
- The switch writes optimistically (store + device cache), then the server; on failure it
  rolls back with the generic save-failed toast.
- Mock mode: `mockMe.language = 'hu'`; the mock write resolves locally (pattern:
  `useAccountSettings`).

### 4.2 Client messages — a typed catalog, no library

`frontend/src/shared/i18n/`:

- `lang.ts` — the store: `type Lang = 'hu' | 'en'`, `getLang()`, `setLang()`, `subscribe()`,
  `useLang()` (`useSyncExternalStore`), `resolveInitialLang()`; keeps `<html lang>` in sync.
- `messages/<area>.hu.ts` — the **source**: a plain nested object per area (`frame`, `kit`,
  `settings`, later one per slice). A leaf is a string or a function for slots and plurals:
  `decrease: (who: string) => \`${who} csökkentése\``.
- `messages/<area>.en.ts` — typed as `typeof hu` of the same area, so a missing or mis-shaped
  English entry is a **compile error**.
- `index.ts` — `useM()` (hook) and `m()` (non-React, for label maps and logic files) return the
  current language's catalog; usage is `const M = useM(); M.frame.back`.
- `plural.ts` — `plural(n, {one, other})` on `Intl.PluralRules` of the current language.
- A sentence is **one message with slots**, never concatenated halves.

Rejected: react-i18next (typed keys get expensive at this catalog size, ICU is an add-on),
react-intl (no key safety), Lingui / Paraglide (a build step and macros for two languages).
See §6.

**Switching without a reload.** Module-level constants evaluated at import (`navModel.DOMAINS`
labels, `pageIndex`, `MEMBER_LABEL`, the `*Labels.ts` / `*Copy.ts` maps) are turned into
lookups that read `m()` when called. The subtree under the query provider is keyed by the
language, so a switch remounts the router and every screen re-renders in the new language; the
URL and the query cache survive.

**Tests.** `src/test/setup.ts` pins `hu` (jsdom reports `en-US`). Existing tests keep asserting
Hungarian; English is covered by added tests, never by rewriting.

### 4.3 Formatting

- `shared/lib/format.ts` — one module: dates (weekday, month-day, full date, ranges), numbers
  (1 decimal, integer, percent), built on `Intl.*` with a formatter cache keyed on
  (language, options). The locale is **always** the app language (`hu-HU` / `en-GB` — day-first,
  24-hour, metric), never the device.
- `shared/lib/dates.ts` (243 importers) and `huNum.ts` (79) **keep their exported names** and
  delegate to it, so their callers follow the language without being touched. The Hungarian
  grammar helpers (`huFrom`, `huArticle`, `article`, `azA`, `outOf`) get an English branch that
  returns the plain form; sentences built on them are rewritten as messages by the slice that
  owns the screen.
- `navModel.frameDate` drops its Hungarian-only string surgery for a format per language.
- The ~100 scattered `hu-HU` / `toLocale*` / private month-array sites move with their slices;
  N1 converts the frame's and the kit's. A ratchet guard (§4.7) stops new ones.

### 4.4 The AI answers in the user's language

- `UserLanguage` in `feature/auth/service` (next to `PromptPersona`): `of(userId)` and
  `current()` through `LlmActorContext.capture()`, which already resolves the acting user on
  request, stream and cron paths — no signature changes at the 84 call sites.
- `OutputLanguageDirective` — one text, **appended to the end** of the system prompt inside
  the port adapter (`SpringAiCompanionLlm`, the four `.system(...)` sites):
  - `hu` → nothing. Prompts stay byte-identical: golden prompt tests, the fake LLM's
    `startsWith` dispatch and the OpenAI cache prefix are untouched.
  - `en` → instructions and data above are Hungarian; every user-facing sentence must be
    written in natural English; JSON keys, enum values, tool names and ids stay exactly as
    specified; names and quotes the user wrote are not translated.
- Exempt by slug (via `LlmCallContextHolder`): embeddings, transcription (keeps the speaker's
  language), and the recall rewriter / reranker (internal, never shown).
- Known limit until N3: with Hungarian prompts and Hungarian context an answer can drift back.
  N1 verifies by reading one real answer per major path in English and reports what it saw.

### 4.5 Server-written sentences

- `messages.properties` (184 keys, mixed languages, resolved with a hard-coded
  `Locale.ENGLISH`) is split into `messages_hu.properties` and `messages_en.properties`, every
  key in both.
- `UserMessages` (techcore): `text(key, args…)` resolves with the acting user's language;
  unauthenticated requests use the `Accept-Language` header, which the client sends on every
  call. `GlobalExceptionHandler.resolve` goes through it.
- **The stable `code` stays the contract.** Where the client already maps codes to its own copy
  (`authErrorText.ts`), it keeps doing so through the catalog.
- **The pattern for domain sentences** (applied by each slice, not here): a rule-based sentence
  produced by a service is a bundle key with arguments, rendered with `UserMessages`; text that
  is **persisted** (feed rows, push bodies) is rendered once, in the user's language at the
  time, and stays as written (decision 1).
- N1 applies it to the frame-level keys: `AUTH_*`, `VALIDATION_*`, `RESOURCE_NOT_FOUND`,
  `INTERNAL_ERROR`, `METHOD_NOT_ALLOWED`, account settings.

### 4.6 What the user sees in N1

- **Settings → Megjelenés és alkalmazás:** a „Nyelv / Language" block with two choices,
  *Magyar* and *English*, and the note of decision 6. The switch applies at once.
- English everywhere F1 owns it: title bar (labels, notification panel), top tabs, bottom bar,
  splash, the kit's own strings (Back, Close, Cancel, Loading…, Retry, decrease / increase),
  team field names, the frame date; and all Settings pages (hub, general, account,
  notifications, the Mezo and domain settings pages).
- The Settings pages keep their current look (their conversion is F8); only their words and the
  new block change. The prototype shows the Folyadék target of the block.
- Everything else stays Hungarian in English mode until its slice.

### 4.7 Guards

1. **Completeness** — compile-time (`typeof hu`) plus a test: same key set, no empty English
   leaf, functions on both sides.
2. **No hard-coded Hungarian in translated areas** — a text-reading vitest guard (shape of
   `sheetGlassGuard.test.ts`) over a written list of translated directories; it fails on an
   accented literal outside `messages/`. Each slice adds its directories.
3. **Formatting ratchet** — the list of files that still hard-code `hu-HU` / `toLocale*` may
   only shrink.
4. **Backend bundles** — a test that both property files hold the same keys.
5. **English layout** — a Playwright layout spec: frame + Settings in English at 390 and
   320 px, no overflow, no wrapped button (bible trap 5, lesson F4.1).

### 4.8 Prototype and bible

- The prototype gets a language switch in the side panel (pattern of `#still`, with a
  `?lang=en` preset) and a helper for two-language strings in the kit; the frame and the
  Settings routes (`#w-en-beall`, `#w-en-b-*`) carry both languages. Untranslated screens stay
  Hungarian — the same mixed state as the app.
- The bible gains **§2.5 English copy**: written, not converted; verdict first; the names of
  decision 3; sentence case; a field name is a label ("Sleep says…" is wrong, "Your sleep…" or
  "we" is right); units and formats of decision 5.

## 5. Codebase terrain (recon 2026-10-11)

- **Preference:** `feature/auth` — `AppUserEntity.java:52` (timezone precedent),
  `auth.yml:225` (`MeResponse`), `AppUserRepository.java:19` (targeted update),
  `frontend/src/data/auth/authHooks.ts:8-50` (`useMe`, `seedMe`), `authMock.ts:5`,
  `test/msw/handlers.ts:396`, `data/companion/preferencesHooks.ts:40` (write pattern).
- **Settings UI:** `features/settings/` (routes, `SettingsFrame`), `features/me/pages/
  BeallitasokPage.tsx` (`/settings/general`, the home of the block), `NotificationsPage.tsx`;
  CSS block `prototype.css` "uveg en2 beallitasok". Not converted to Folyadék.
- **Frame:** `main.tsx:18-70` (provider order), `app/navModel.ts:57-143,245-293`,
  `app/TitleBar.tsx`, `TopTabs.tsx`, `BottomBar.tsx`, `StartupSplash.tsx`, `pageIndex.ts`
  (119 label lines), `shared/ui/folyadek/` (~20 baked-in literals: `Controls`, `FoSheetHead`,
  `Page`, `frame`, `Liquids`, `Text`, `Msg`, `Ceremony`).
- **Formatting:** central `shared/lib/dates.ts`, `huNum.ts`, `huText.ts`; ~103 scattered lines
  (train 42, fuel 25, insights 23, character 18, me 17) and 24 files with private month arrays.
- **LLM:** one port — `feature/companion/CompanionLlm.java`, adapter
  `llm/SpringAiCompanionLlm.java:130,199,224,427`; ambient context `LlmCallContextHolder`,
  `LlmActorContext.java:75`; per-user seam `PromptPersona.java:59`.
- **Server text:** `techcore/exception/GlobalExceptionHandler.java:259`, `SystemMessage`,
  `messages.properties`; domain sentences are literals in services (companion 1291 lines,
  character 565, proactive 462 …); push copy from `AnchorResolver.java:213` **and** from the
  client (`notificationScheduleWriter.ts:57`).
- **Traps:** the fake LLM dispatches on the prompt's start and substrings — append, never
  prepend; golden prompt tests and `llm_log_history.system_prompt`; structured outputs with
  enums; `CurrentUser.get()` not inside a read-only transaction; ~482 FE test files and 19
  layout specs assert Hungarian; jsdom's `en-US`; filter-level 401s have no body (`mezo-aus`);
  Liquibase: a bare `?` is a JDBC placeholder; CODEMAP regeneration; ArchUnit layer packages.
- **Stale docs to fix in this slice:** `settings.md` (CSS anchor, icon wording),
  `_platform-design-system.md:321` (kit consumers), `_platform-auth-security.md` §10 (bundle),
  `vilagos/HANDOFF.md:1` (slices started).

## 6. Prior art (recon 2026-10-11)

- **Catalog choice.** i18next documents that typed keys are costly with thousands of keys and
  need `.ts` catalogs for typed interpolation (https://www.i18next.com/overview/typescript);
  Paraglide's compiled, tree-shaken message functions give type safety by construction
  (https://paraglidejs.com/comparison — vendor-authored). **Adopted:** the idea (messages as
  typed functions, completeness at compile time); **rejected:** the dependency and build step —
  two languages do not need them.
- **Formatting.** Build formatters once and cache them with every option in the key; let the
  locale decide order via styles; never parse formatted output
  (https://intlayer.org/blog/date-time-number-formatting-locales). **Adopted.**
- **Server text.** FCM documents the code + arguments payload for native apps only
  (https://firebase.google.com/docs/cloud-messaging/customize-messages/localize-messages); a
  PWA has no OS lookup. **Adopted:** codes stay the contract for errors; persisted and push
  text is rendered server-side from the **stored** language.
- **LLM language.** Anthropic: state the target language explicitly, in the system prompt,
  interpolated from the user's choice; Hungarian is not in the benchmark table, so test it
  (https://platform.claude.com/docs/en/build-with-claude/multilingual-support). **Adopted**,
  with the verbatim-enum clause from practice (unsourced).
- **Stored content.** No source found; the convention (leave as written) matches decision 1.

## 7. Kész, ha…

- **Owner sees:** the Nyelv block in Settings exactly as approved on the Artifact; switching
  changes the frame and Settings at once, without a reload, and survives a restart and a second
  device; English at 320 px without overflow; reduced motion unchanged.
- **AI:** in English mode one real answer read on chat, the wall, a day review and a meal
  evaluation — in English, enums intact; in Hungarian mode prompts byte-identical.
- **Parity:** every control, state and field of the touched Settings pages and the frame still
  present; Hungarian mode pixel-for-word unchanged.
- **Gates:** FE tests in both modes; the five guards green; layout specs; `pnpm build`;
  backend focused tests + `ArchitectureTest` + contract regeneration; codemap; docs lint.
- **Docs:** `docs/features/_platform-language.md` (new), `settings.md`,
  `_platform-auth-security.md`, the feature index, a milestone entry, the bible §2.5, the
  skill's *Language* section linked to this spec.
- **Shipped:** merged, `deploy` green, live check in both languages; production shows
  `language = 'hu'` on existing accounts.
- **Prototype** in sync and republished.
