# Nyelv alap (N1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-account language (`hu` | `en`) with a switch in Settings, and the foundation that makes screen text, formatting, server-written sentences and every AI answer follow it — applied to the frame, the shared kit and the Settings pages.

**Architecture:** The language lives on `app_user` and travels in `MeResponse`. The client keeps it in a tiny external store (account → device cache → device language), reads all visible text from a typed two-language catalog (`hu` is the source, `en` is typed as `typeof hu`), and formats dates and numbers through one module keyed by the language. The server resolves the acting user's language once (`UserLanguage`), appends an output-language directive to the system prompt inside the single LLM adapter, and renders its own sentences from two message bundles.

**Tech Stack:** Spring Boot + Liquibase + OpenAPI-generated DTOs (backend); React 18 + Vite + TypeScript + TanStack Query + vitest + Playwright (frontend). No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-11-nyelv-alap-design.md`. Approved prototype: `docs/design_2.0/prototypes/klinikai-iranyok.html` + `vilagos/kit.js` (`FR_EN`, `L`, `tr`) + `vilagos/en.js` (Settings, `balt()` holds the Nyelv block). English copy rules: bible §2.5.

## Global Constraints

- Hungarian is the source language and the default. **No existing test is rewritten to English**; `src/test/setup.ts` pins `hu`. English is covered by added tests.
- Hungarian mode must be **word-for-word unchanged** on every touched screen, and **byte-identical** for every LLM system prompt.
- English names: domains **Today · Training · Fuel · Mezo · Me**; team fields **Sleep · Movement · Food · Mood · Mezo · Skeptic**; top tabs exactly as `FR_EN` in `vilagos/kit.js`; the Today domain's first tab is **Now**.
- Formats: locale `hu-HU` / `en-GB`; kg, km, cm, 24-hour clock in both; English dates day-first without ordinal ("Wednesday, 7 October", "2 Nov"); decimal point in English, comma in Hungarian.
- Never translate what the user wrote or what is already stored.
- A sentence is one message with slots; no concatenated halves.
- The Nyelv note, verbatim: „Az angol változat készül, egyes oldalak még magyarul jelennek meg." / "English is in progress — some pages still appear in Hungarian."
- Contract-first: edit `api/feature/auth/auth.yml`, then `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. DTOs are never hand-written.
- Dual-mode data rule: mock mode never fetches; real mode never falls back to mock.
- The LLM directive is **appended** (the fake LLM dispatches on the prompt's start; the OpenAI cache keys on the prefix).
- Settings pages keep their current look (conversion is F8). Only words and the new block change.
- FE gates run with `CI=true`, once with `VITE_USE_MOCK` unset and once with `VITE_USE_MOCK=false`; file filters after `--` are ignored. Backend full suite needs `-Dmezo.test.use-testcontainers=true`.
- All commands use absolute paths under the worktree; never `cd` to the primary checkout.

## Review Focus

1. **A device or account value that is neither `hu` nor `en`** (stale cache `"de"`, `navigator.language = "en-US"`, a server row edited by hand) → the app shows a supported language, never a blank screen or raw keys. *(Test in Task 3.)*
2. **Switching while the write fails** (offline, 500) → the screen returns to the previous language and says saving failed; the device cache is not left on the unsaved value. *(Task 5.)*
3. **An LLM call with no acting user** (startup runner, unauthenticated thread) → no directive, no exception, the call proceeds in Hungarian. *(Task 2.)*
4. **A structured-output call in English mode** → the directive is present but tells the model to keep keys, enum values and tool names verbatim; exempt slugs get nothing. *(Task 2.)*
5. **A message key missing from one bundle, or a `{0}` argument count that differs between languages** → caught by a test, not by a user reading a raw code. *(Task 1.)*

## File Structure

Backend (`backend/src/main/java/io/mrkuhne/mezo/`):
- `feature/auth/entity/AppUserEntity.java` — + `language`.
- `feature/auth/service/UserLanguage.java` — **new**; resolves a user's language (`of(userId)`, `current()`).
- `feature/auth/service/AuthService.java`, `repository/AppUserRepository.java`, controller — language on register / me / update.
- `feature/companion/llm/OutputLanguageDirective.java` — **new**; the directive text and the exempt slugs.
- `feature/companion/llm/SpringAiCompanionLlm.java` — appends it at the four `.system(...)` sites.
- `techcore/message/UserMessages.java` — **new**; bundle text in the acting user's language.
- `techcore/exception/GlobalExceptionHandler.java` — resolves through `UserMessages`.
- `resources/messages_hu.properties`, `messages_en.properties` (split from `messages.properties`).
- `resources/db/changelog/1.1.0/script/202610111200_mezo-n4wf5.11_app_user_language.sql`.

Frontend (`frontend/src/`):
- `shared/i18n/lang.ts` (store), `index.ts` (`useM`, `m`), `plural.ts`, `LanguageProvider.tsx`, `messages/{frame,kit,settings}.{hu,en}.ts`, `messages/index.ts`.
- `shared/lib/format.ts` — **new**; `dates.ts`, `huNum.ts`, `huText.ts` delegate.
- `data/auth/languageHooks.ts` — **new**; `useLanguageSetting()`.
- `app/` — `navModel.ts`, `TitleBar.tsx`, `TopTabs.tsx`, `BottomBar.tsx`, `StartupSplash.tsx`, `pageIndex.ts` (hub + settings entries), `main.tsx`, `auth/AuthGate.tsx`, `providers/QueryProvider.tsx`.
- `shared/ui/folyadek/` — `Controls.tsx`, `FoSheetHead.tsx`, `Page.tsx`, `frame.tsx`, `Liquids.tsx`, `Text.tsx`, `Msg.tsx`, `Ceremony.tsx`.
- `features/settings/**`, `features/me/pages/{BeallitasokPage,NotificationsPage}.tsx` — words + the Nyelv block.
- Guards: `shared/i18n/catalog.completeness.test.ts`, `shared/i18n/hardcodedHungarian.guard.test.ts`, `shared/lib/format.ratchet.test.ts`, `tests/layout/language-en.spec.ts`.

Order: Task 1 → 2 (backend, sequential). Task 3 first on the frontend; then 4, 5 in either order; then 6, 7, 8a, 8b **in parallel** (disjoint files; the catalog files for each area are created empty in Task 3 so no two builders create the same file); then 9, 10.

---

### Task 1: The stored preference, the contract and the bundles (backend)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202610111200_mezo-n4wf5.11_app_user_language.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append the changeSet), `api/feature/auth/auth.yml`, `AppUserEntity.java:52`, `AppUserRepository.java:19`, `AuthService.java:55-100`, the auth controller, `GlobalExceptionHandler.java:259`
- Create: `feature/auth/service/UserLanguage.java`, `techcore/message/UserMessages.java`, `messages_hu.properties`, `messages_en.properties` (and delete `messages.properties`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/LanguageIT.java`, `techcore/message/MessageBundleParityTest.java`

**Interfaces:**
- Produces: `UserLanguage.of(UUID userId): String` (`"hu"`/`"en"`, `"hu"` for null/unknown), `UserLanguage.current(): String` (via `LlmActorContext.capture()`); `UserMessages.text(String key, Object... args): String`; REST `PUT /api/auth/me/language {language}` → `MeResponse`; `MeResponse.language`; `RegisterRequest.language` (optional).

- [ ] **Step 1: Write the failing tests**

```java
// LanguageIT (follow the existing auth IT base class and helpers in feature/auth tests)
@Test void me_returns_hu_for_an_existing_account() { /* GET /api/auth/me → $.language == "hu" */ }
@Test void put_language_switches_and_me_reflects_it() { /* PUT {language:"en"} → 200, $.language=="en"; GET me → "en" */ }
@Test void put_language_rejects_an_unsupported_value() { /* {language:"de"} → 400, code VALIDATION_* */ }
@Test void put_language_leaves_name_email_role_untouched() { /* compare row before/after */ }
@Test void register_with_language_en_creates_an_english_account() { /* body.language="en" → me.language=="en" */ }
@Test void register_without_language_defaults_to_hu() {}
@Test void error_message_follows_the_account_language() { /* en account → wrong-password error message equals messages_en AUTH_* text */ }
@Test void unauthenticated_error_follows_accept_language() { /* login with bad credentials, Accept-Language: en → English text; no header → Hungarian */ }

// MessageBundleParityTest (plain JUnit, no Spring)
@Test void both_bundles_hold_the_same_keys() { /* load both .properties; assertEquals(keySet) */ }
@Test void placeholders_match_per_key() { /* regex \{(\d+)\} sets equal for every key */ }
@Test void no_value_is_blank() {}
```

- [ ] **Step 2: Run them — expect compile failure / FAIL**

Run: `cd backend && ./mvnw -q test -Dtest='LanguageIT,MessageBundleParityTest' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Migration**

```sql
-- 202610111200_mezo-n4wf5.11_app_user_language.sql
ALTER TABLE app_user ADD COLUMN language varchar(2) NOT NULL DEFAULT 'hu';
ALTER TABLE app_user ADD CONSTRAINT ck_app_user_language CHECK (language IN ('hu', 'en'));
```
changeSet id `"1.1.0:202610111200_mezo-n4wf5.11_app_user_language"`, author `daniel.kuhne`, `sqlFile relativeToChangelogFile: true`. Run `node scripts/lint-liquibase.mjs`.

- [ ] **Step 4: Contract** — in `auth.yml`: a `Language` schema (`type: string, enum: [hu, en]`); `MeResponse.language` (required); `RegisterRequest.language` (optional); `UpdateLanguageRequest {language}` (required); path `/api/auth/me/language`, `put`, `operationId: updateLanguage`, 200 → `MeResponse`. Regenerate both sides.

- [ ] **Step 5: Implement** — entity field `private String language = "hu";` (`@NotNull @Size(max = 2) @Column(nullable = false, length = 2)`); repository:

```java
@Modifying(clearAutomatically = true, flushAutomatically = true)
@Query("update AppUserEntity u set u.language = :language where u.id = :id")
void updateLanguage(@Param("id") UUID id, @Param("language") String language);
```

`AuthService.updateLanguage(user, request)` (`@Transactional`, validates against `UserLanguage.SUPPORTED`, targeted update, returns `me(reloaded)`); `register` sets `user.setLanguage(UserLanguage.normalize(req.getLanguage()))`; `me()` passes `user.getLanguage()`.

```java
@Component
public class UserLanguage {
    public static final String DEFAULT = "hu";
    public static final Set<String> SUPPORTED = Set.of("hu", "en");
    private final AppUserRepository users;
    public static String normalize(String raw) { return raw != null && SUPPORTED.contains(raw) ? raw : DEFAULT; }
    public String of(UUID userId) {
        if (userId == null) return DEFAULT;
        return users.findById(userId).map(u -> normalize(u.getLanguage())).orElse(DEFAULT);
    }
    public String current() { return of(LlmActorContext.capture()); }
}
```
(Read-only lookup; it must not be called inside an open read-only `@Transactional` that already holds `CurrentUser` — it takes a user id, not `CurrentUser.get()`.)

- [ ] **Step 6: Bundles** — split `messages.properties` into `messages_hu.properties` and `messages_en.properties`, **every** key in both; write the missing side by the bible §2.5 rules (errors: what happened + what to do, no blame). Configure the basename so both resolve (`spring.messages.basename=messages`, `fallback-to-system-locale=false`). `UserMessages`:

```java
@Component
public class UserMessages {
    private final MessageSource source; private final UserLanguage language;
    public String text(String key, Object... args) { return source.getMessage(key, args, key, locale()); }
    Locale locale() {
        UUID actor = LlmActorContext.capture();
        if (actor != null) return Locale.forLanguageTag(language.of(actor));
        return Locale.forLanguageTag(UserLanguage.normalize(headerLanguage())); // first 2 letters of Accept-Language, via RequestContextHolder; null outside a request
    }
}
```
`GlobalExceptionHandler.resolve` → `userMessages.text(m.getCode(), params)`.

- [ ] **Step 7: Run the tests — PASS**; then `./mvnw -q test -Dtest='ArchitectureTest,*Auth*' -Dmezo.test.use-testcontainers=true` (ArchUnit layer packages; `techcore` must not depend on a feature — if `UserMessages` → `UserLanguage` violates a rule, move the language lookup behind an interface declared in `techcore` and implemented in `feature/auth`).

- [ ] **Step 8: Commit** — `feat(api): per-account language, bilingual message bundles (mezo-n4wf5.11)`

### Task 2: The AI answers in the user's language (backend)

**Files:**
- Create: `feature/companion/llm/OutputLanguageDirective.java`
- Modify: `feature/companion/llm/SpringAiCompanionLlm.java` (`.system(...)` at `:130,199,224,427` and every `CallSpec` that records the prompt)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/OutputLanguageDirectiveTest.java`, plus one adapter-level test next to the existing `SpringAiCompanionLlm` tests

**Interfaces:**
- Consumes: `UserLanguage.current()`; the current feature slug from `LlmCallContextHolder`.
- Produces: `OutputLanguageDirective.apply(String systemPrompt, String language, String slug): String`.

- [ ] **Step 1: Failing tests**

```java
@Test void hungarian_leaves_the_prompt_byte_identical() { assertSame(p, OutputLanguageDirective.apply(p, "hu", "companion_chat")); }
@Test void english_appends_and_never_prepends() { String r = apply(p, "en", "companion_chat"); assertTrue(r.startsWith(p)); assertTrue(r.length() > p.length()); }
@Test void english_text_pins_keys_enums_and_user_words() { /* contains "English", "JSON keys", "enum", "exactly", "do not translate" */ }
@Test void exempt_slugs_get_nothing() { for (s : List.of("embed_memory", "transcription", "companion_recall")) assertSame(p, apply(p, "en", s)); }
@Test void null_language_or_null_prompt_is_safe() { assertSame(p, apply(p, null, "x")); assertNull(apply(null, "en", "x")); }
// adapter: with an English acting user (LlmActorContext.runAs), each public method — complete, completeSmart,
// stream, streamSmart, the vision and audio overloads — sends a system prompt ending with the directive;
// with no actor it sends the prompt unchanged.
```
Confirm the three exempt slug strings against the real constants (`grep -rn "embed_memory\|recall" feature/llmlog feature/companion | head`) and use the constants, not literals.

- [ ] **Step 2: Run — FAIL.** `./mvnw -q test -Dtest='OutputLanguageDirectiveTest'`

- [ ] **Step 3: Implement**

```java
public final class OutputLanguageDirective {
    static final String EN = """


        [OUTPUT LANGUAGE]
        The instructions and the data above are written in Hungarian. Write every sentence that a person will read in natural, idiomatic English, as a native speaker would.
        Keep JSON keys, enum values, tool names, ids and any value listed as a fixed option exactly as specified above — never translate them.
        Do not translate names, or text quoted from what the user wrote.""";
    public static String apply(String systemPrompt, String language, String slug) {
        if (systemPrompt == null || !"en".equals(language) || EXEMPT.contains(slug)) return systemPrompt;
        return systemPrompt + EN;
    }
}
```
In the adapter add one private `withLanguage(String systemPrompt)` (`OutputLanguageDirective.apply(systemPrompt, userLanguage.current(), LlmCallContextHolder.<current slug accessor>)`) and call it where each public entry point first receives `systemPrompt`, so the audited prompt (`llm_log_history.system_prompt`) is the one sent. For streams, resolve on the submitting thread, before the pool hand-off.

- [ ] **Step 4: Run — PASS**, then the companion/proactive/character focused suites with the fake LLM (`-Dtest='*Companion*,*Proactive*,*Character*'`): all green, proving Hungarian prompts are untouched.

- [ ] **Step 5: Commit** — `feat(ai): output-language directive on every LLM call (mezo-n4wf5.11)`

### Task 3: The client language core

**Files:**
- Create: `frontend/src/shared/i18n/{lang.ts,index.ts,plural.ts,LanguageProvider.tsx}`, `messages/index.ts`, `messages/{frame,kit,settings}.{hu,en}.ts` (each exporting an empty-but-typed object to be filled by Tasks 6–8), `catalog.completeness.test.ts`, `lang.test.ts`
- Modify: `frontend/src/test/setup.ts`, `frontend/src/main.tsx`, `frontend/index.html`

**Interfaces — Produces:**

```ts
// lang.ts
export type Lang = 'hu' | 'en'
export const LANGS: readonly Lang[]
export const LANG_KEY = 'mezo-lang'
export function normalizeLang(raw: unknown): Lang | null        // 'hu' | 'en' | null
export function deviceLang(): Lang                              // navigator.language startsWith 'hu' → 'hu', else 'en'
export function resolveInitialLang(): Lang                      // cache → device
export function getLang(): Lang
export function setLang(l: Lang, opts?: { persist?: boolean }): void   // notifies, writes cache, sets <html lang>
export function subscribe(fn: () => void): () => void
export function useLang(): Lang
// index.ts
export function m(): Messages          // current language's catalog, callable anywhere at render/call time
export function useM(): Messages       // re-renders on change
// plural.ts
export function plural(n: number, forms: { one: string; other: string }): string
// messages/index.ts
export type Messages = { frame: typeof frameHu; kit: typeof kitHu; settings: typeof settingsHu }
```

- [ ] **Step 1: Failing tests** (`lang.test.ts`)

```ts
it('falls back to a supported language for a stale cache value', () => { localStorage.setItem(LANG_KEY, 'de'); expect(resolveInitialLang()).toMatch(/^(hu|en)$/) })
it('maps the device language: hu-HU → hu, en-US → en, de → en', () => { /* stub navigator.language */ })
it('survives a throwing localStorage', () => { /* getItem throws → deviceLang() */ })
it('setLang notifies subscribers, writes the cache and <html lang>', () => {})
it('m() follows the store; useM re-renders', () => {})
it('plural picks by the language rule', () => { setLang('en'); expect(plural(1, {one:'day', other:'days'})).toBe('day') })
```
`catalog.completeness.test.ts`: walk `hu` and `en` recursively — same key paths, same leaf kind (string/function), no empty English string, and every function leaf has the same `length`.

- [ ] **Step 2: Run — FAIL.** `cd frontend && CI=true pnpm test` (the whole suite runs; read only these two files' results)

- [ ] **Step 3: Implement** the store with `useSyncExternalStore`; all storage access in try/catch. `LanguageProvider` renders `<Fragment key={lang}>{children}</Fragment>` so a switch remounts everything beneath it. In `main.tsx` wrap the content of `QueryProvider` (`<QueryProvider><LanguageProvider>…`), and translate the two ErrorBoundary literals, the Suspense fallback through `m()` (`Valami elromlott.` / `Something went wrong.`, `Újratöltés` / `Reload`, `Betöltés…` / `Loading…`). `setup.ts`: `setLang('hu', { persist: false })` in a global `beforeEach`.

- [ ] **Step 4: Run — PASS** in both modes. **Step 5: Commit** — `feat(ui): language store and typed message catalog (mezo-n4wf5.11)`

### Task 4: Formatting follows the language

**Files:** Create `frontend/src/shared/lib/format.ts`, `format.test.ts`, `format.ratchet.test.ts`. Modify `shared/lib/dates.ts`, `huNum.ts`, `huText.ts`, `app/navModel.ts:245-253`, `shared/ui/folyadek/Ceremony.tsx:26`.

**Interfaces — Produces:** `locale(): 'hu-HU' | 'en-GB'`; `fmtDate(d: Date | string, style: 'weekdayLong' | 'weekdayShort' | 'monthDay' | 'monthDayWeekday' | 'full' | 'frame'): string`; `fmtNum(v: number, digits?: 0 | 1 | 2): string`; `fmtInt(v: number): string`. Existing exports of `dates.ts` / `huNum.ts` keep their names and Hungarian output.

- [ ] **Step 1: Failing tests** — pin the Hungarian output of every existing export first (snapshot the current return values for a fixed date `2026-10-07` and numbers `78.4`, `1200`, `0`), then English:

```ts
it('frame date', () => { expect(fmtDate(new Date(2026, 9, 7), 'frame')).toBe('Szerda, október 7.'); setLang('en'); expect(fmtDate(new Date(2026, 9, 7), 'frame')).toBe('Wednesday, 7 October') })
it('month-day', () => { setLang('en'); expect(huMonthDay('2026-11-02')).toBe('2 Nov') })
it('decimal', () => { expect(hu1(78.4)).toBe('78,4'); setLang('en'); expect(hu1(78.4)).toBe('78.4') })
it('grammar helpers return the plain form in English', () => { setLang('en'); expect(huFrom(5)).toBe('5'); expect(huArticle(5)).toBe('the') })
it('a date string is not shifted by the time zone', () => { /* '2026-10-07' formats as the 7th under TZ=America/Los_Angeles and Asia/Tokyo */ })
```
`format.ratchet.test.ts`: read every non-test file under `src`, collect those matching `/hu-HU|toLocale(Date|Time)?String\(|new Intl\./` outside `shared/lib/format.ts`; assert the set **equals** the written allowlist (generated once now, sorted). A file leaving the list must be removed from it; a new file fails.

- [ ] **Step 2–4:** FAIL → implement (formatter cache `Map<string, Intl.DateTimeFormat>` keyed `${locale}|${JSON.stringify(opts)}`; Hungarian branches return the current hand-rolled strings unchanged; English uses `en-GB`) → PASS in both modes.
- [ ] **Step 5: Commit** — `feat(ui): one formatting module driven by the language (mezo-n4wf5.11)`

### Task 5: The preference on the client

**Files:** Create `frontend/src/data/auth/languageHooks.ts` + test. Modify `data/auth/authApi.ts`, `authHooks.ts`, `authMock.ts`, `test/msw/handlers.ts:396`, `data/_client/*` (the fetch wrapper: `Accept-Language`), `shared/i18n/LanguageProvider.tsx`, the register form's submit.

**Interfaces — Produces:** `useLanguageSetting(): { lang: Lang; setLanguage(l: Lang): void; pending: boolean }`.

- [ ] **Step 1: Failing tests**

```ts
it('adopts the account language when me loads and writes the device cache', () => {})
it('mock mode: switches locally, never fetches', () => {})
it('real mode: PUT /api/auth/me/language, then me in the cache carries it', () => {})
it('real mode failure: rolls back the store AND the device cache, and shows the save-failed toast', () => {})
it('every request carries Accept-Language of the current language', () => {})
it('registration sends the resolved language', () => {})
```
- [ ] **Step 2–4:** FAIL → implement (optimistic `setLang`, `onError` restores the previous value; `LanguageProvider` syncs `me.language` → store in an effect, account wins over cache) → PASS in both modes.
- [ ] **Step 5: Commit** — `feat(ui): language preference stored with the account (mezo-n4wf5.11)`

### Task 6: The frame in two languages *(parallel with 7, 8a, 8b)*

**Files:** `messages/frame.{hu,en}.ts`; `app/navModel.ts`, `TitleBar.tsx`, `TopTabs.tsx`, `BottomBar.tsx`, `StartupSplash.tsx`, `pageIndex.ts` (domain, tab, hub and Settings entries only — other sub-page labels stay for their slices), `MindenOldalPage.tsx`, `auth/AuthGate.tsx`, `providers/QueryProvider.tsx:20`; tests beside each.

- [ ] **Step 1:** Add English-mode tests (new `it`s, existing ones untouched): bottom bar reads `Today Training Fuel Mezo Me`; Nap tabs read `Now · My day · Chat · Routine` (all five domains per `FR_EN`); `frameDate` in both; title-bar aria-labels (`All pages`, `Messages from Mezo, 2 unread`, `Notifications`, `Settings`, `Back`, `Guide to this page`); the notification panel's strings; the generic toast (`Mentés sikertelen — próbáld újra` / `Couldn't save — try again`).
- [ ] **Step 2:** FAIL. **Step 3:** `DOMAINS` keeps its Hungarian `name` / `label` / `title` as the **source ids** (tests and `pageIndex` key on them); add `domainName(d)`, `tabLabel(domainId, tab)`, `tabTitle(...)` that read `m().frame` — the components render through these. The Now exception lives in the catalog (`frame.tabs.nap.mai`), not in a condition. Grep `src` and `tests` for each changed string before touching it (lesson F2.6).
- [ ] **Step 4:** PASS in both modes + `pnpm test:layout` for the navigation specs. **Step 5: Commit** — `feat(ui): the frame in Hungarian and English (mezo-n4wf5.11)`

### Task 7: The kit's own strings *(parallel)*

**Files:** `messages/kit.{hu,en}.ts`; `shared/ui/folyadek/{Controls,FoSheetHead,Page,frame,Liquids,Text,Msg,Ceremony}.tsx` + tests.

- [ ] Prop defaults become catalog reads at render (`backLabel ?? M.kit.back`); the prop override stays. `MEMBER_LABEL` / `MEMBER_META` become `memberLabel(key)` / `memberMeta(key)` (Sleep · rest, Movement · load, Food · diet, Mood · mood, Mezo · the whole picture, Skeptic). `REPEATS` (dedupe word list) gets the English words added, not swapped. English tests: `Back`, `Close`, `Cancel`, `Loading…`, `Retry`, `Decrease ${who}` / `Increase ${who}`.
- [ ] FAIL → implement → PASS in both modes. Commit — `feat(ui): the Folyadék kit's own strings in two languages (mezo-n4wf5.11)`

### Task 8a: Settings — hub, frame, account, Mezo pages *(parallel)* · Task 8b: Settings — general page with the Nyelv block, notifications *(parallel)*

**Files 8a:** `messages/settings.{hu,en}.ts` (sections `hub`, `train`, `me`, `goal`, `mezo`, `nap`, `account`, `personal`) and everything under `features/settings/` except what 8b owns. **Files 8b:** sections `general`, `notifications`, `language` of the same catalog files (8a creates the files with all section keys as empty objects first and commits; 8b rebases on that commit), `features/me/pages/BeallitasokPage.tsx`, `NotificationsPage.tsx`, `styles/` (the Nyelv block's rules in the existing Settings CSS block), their tests.

- [ ] **English wording = the approved prototype**, sentence for sentence: `vilagos/en.js` functions `beall`, `btrain`, `bme`, `bcel`, `bmezo`, `bnap`, `bszemely` (8a) and `balt`, `bert`, `bfiok` (8b). Where the live page has a string the prototype lacks (states, errors, sheets: password change, kalauz reset lines, permission states of push), write it by bible §2.5 and list it in the task report for the owner's report.
- [ ] **The Nyelv block (8b)** — first section of `/settings/general`, above „Fiók": heading `Nyelv` / `Language`; a two-button group (`role="group"`, `aria-label` `Az app nyelve` / `App language`; buttons `Magyar`, `English` with `aria-pressed`, ≥44 px targets) built from the page's existing choice styling (the parked theme picker's classes are the precedent); the body sentence and the note verbatim from `balt()`. It calls `useLanguageSetting().setLanguage`. The hub row's sub-line becomes `Nyelv, kalauzok, fiók, jelszó` / `Language, guides, account, password`.

```ts
it('shows Magyar pressed by default', ...)
it('pressing English switches the page heading to "Language" and stores en', ...)
it('shows the in-progress note in both languages', ...)
it('Hungarian mode: the page text is unchanged', /* existing assertions stay green */)
```
- [ ] FAIL → implement → PASS in both modes. Commits — `feat(ui): Settings in two languages (mezo-n4wf5.11)`, `feat(ui): the language switch in Settings (mezo-n4wf5.11)`

### Task 9: Guards and the English layout check

**Files:** `shared/i18n/hardcodedHungarian.guard.test.ts`, `frontend/tests/layout/language-en.spec.ts`.

- [ ] Guard: a written list `TRANSLATED = ['app/', 'shared/ui/folyadek/', 'features/settings/', 'features/me/pages/BeallitasokPage.tsx', 'features/me/pages/NotificationsPage.tsx']`; for each non-test source file under them, strip comments, then fail on any string literal, template chunk or JSX text containing `[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]`. A written allowlist with a reason per entry covers what must stay (the source ids in `navModel.DOMAINS`, non-Settings `pageIndex` labels, the kalauz registry if it sits under a listed path, `Magyar`).
- [ ] Layout spec: with the language set to `en`, at 390 and 320 px — the five hubs (frame only), `/settings`, `/settings/general`, `/settings/notifications`, `/settings/account`: no horizontal overflow, bottom-bar labels on one line, no wrapped `.btn`, top tabs scrollable not clipped, ≥20 px slack on the Nyelv buttons at 320 (lesson F4.1). One test switches language by pressing `English` and asserts the bottom bar changed without a navigation.
- [ ] Run both; commit — `test: language guards and the English layout check (mezo-n4wf5.11)`

### Task 10: Docs, gates, the live AI check, ship

- [ ] `docs/features/_platform-language.md` (new, 10-section feature doc via the `knowledge-base` skill): mechanism, resolution order, how a slice adds an area, the server pattern, traps. Update `settings.md` (the Nyelv block; fix the stale CSS anchor and icon wording), `_platform-auth-security.md` (language, bundles), `_platform-design-system.md:321` (kit consumers), `docs/features/README.md` row, `docs/milestones/roadmap.md` entry, `vilagos/HANDOFF.md` (slices started; the language switch), bible appendix `N1.x` lessons.
- [ ] Gates: `CI=true pnpm test` (mock) and `CI=true VITE_USE_MOCK=false pnpm test`; `pnpm test:layout`; `pnpm build`; backend `./mvnw test -Dmezo.test.use-testcontainers=true`; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs --errors-only`; `node scripts/lint-liquibase.mjs`.
- [ ] Runtime pass (`verify` skill) in both languages at 390 / 320, reduced motion; side by side with the prototype.
- [ ] Merge + deploy per AGENTS.md §Git Workflow; regenerate the codemap after the merge.
- [ ] Live: production `SELECT language, count(*) FROM app_user GROUP BY 1` → only `hu`. Then, **with the owner's account left untouched**, verify English AI answers on a non-owner test account if one exists; if none exists, ask the owner to switch once and read: one chat answer, one wall message, one day review, one meal evaluation — English, enums intact — and switch back if he wants. Report what was read, including any Hungarian drift.
- [ ] Close: prototype republished if it changed, bead closed with the reverse parity list, `node scripts/check-beads-backup.mjs --fix`, push, Hungarian report walking *Kész, ha…*.
