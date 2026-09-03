# Boop rename S1 — persona és látható copy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A felhasználóhoz beszélő persona és minden látható felirat `Mezo`-ról `Boop`-ra vált, egyetlen perzisztált kulcs érintése nélkül.

**Architecture:** Tisztán szövegcsere két rétegben — backend (LLM rendszerpromptok, renderelt címkék, push-értesítés címek) és frontend (JSX copy, aria-label, mock adat, tutorial szövegek), plusz az app-identitás (`<title>`, PWA manifest) és az OpenAPI leírások. Minden érintett tesztet ugyanabban a lépésben igazítunk, mint a forrást — a tesztek itt a copy szerződései, nem utólagos ellenőrzés.

**Tech Stack:** Spring Boot 4 (Java 21), React 19 + TypeScript + Vite, Vitest, JUnit 5 + Testcontainers, Playwright (vizuális regresszió).

**bd:** mezo-4dld (szülő epic: mezo-r89o) · **Spec:** [`docs/superpowers/specs/2026-09-03-mezo-to-boop-rename-design.md`](../specs/2026-09-03-mezo-to-boop-rename-design.md)

## Global Constraints

- A név mindig **`Boop`**, nagy kezdőbetűvel, tulajdonnévként. Magyar szövegben **névelő nélkül**: `Te vagy Boop`, nem `Te vagy a Boop`. Ahol a régi mondat `a Mezo` alakú volt (`a Mezo nem tippel`), ott a névelő eltűnik: `Boop nem tippel`.
- **Nincs magyar toldalék a néven.** A repóban ma sincs (`Mezot`, `Mezoval` sehol nem fordul elő), és ez így is marad — ha egy mondat toldalékot kívánna, a mondatot kell átfogalmazni.
- **Perzisztált kulcshoz nem nyúlunk.** Ebben a szeletben konkrétan: `CharacterService.key("mezo")`, `ConferenceTranscriptEnvelope.Turn("mezo", …)`, `id="mezo-msgs-title"`, `icon: 'i-mezo'`, `{ id: 'mezo', … }` a TabBarban, és minden `mezo`-val kezdődő localStorage-kulcs.
- **Azonosítóhoz nem nyúlunk.** A `MezoChip`, `MezoHubPage`, `mezoFit`, `buildMezoMessages` és társaik **az S2 dolga**. Ha egy sorban a copy és az azonosító együtt van, csak a copy változik.
- **A kódkommentek nem copy.** A `// Mezo · FloatingReturnLayer — …` típusú fejlécek maradnak; a rájuk vonatkozó átnevezés az S2/S4 szelet dolga. Kivétel: ahol a komment egy most megváltozó felirat idézete (`{/* „Mezo · a következő heted" … */}`), ott a komment is követi.
- **Nem regeneráljuk feleslegesen a vizuális baselineket.** A Playwright pillanatképek szövege változik, tehát a baseline-frissítés a terv záró lépése, egyetlen ellenőrzött futással.

---

## Amit ez a szelet felfedett — olvasd el, mielőtt kódolsz

**1. A backend push-értesítés-címeket gyárt.** Az `AnchorResolver.java` nyolc helyen állít elő `"Mezo · …"` alakú címet, és ezek a `app_notification.title` oszlopba **perzisztálódnak**, valamint push-ként már ki is mentek. A régi sorok „Mezo ·" címmel maradnak, az újak „Boop ·" címmel születnek. Ez helyes: a régi értesítés akkor tényleg azt mondta. **Nem írunk adatmigrációt.**

**2. Egy mondat a rename után hazuggá válik.** A `frontend/src/features/tutorial/registry/fogalmak.ts:31` a *mezociklus* fogalmát így zárja: „A Mezo innen kapta a nevét." Boop **nem** innen kapta a nevét. Ez az egyetlen pont a szeletben, ahol nem csere kell, hanem döntés — lásd Task 8, ahol a mondat törlése a rögzített megoldás.

---

## File Structure

| Fájl | Felelősség ebben a szeletben |
|---|---|
| `backend/…/companion/service/ChatService.java` | fő chat rendszerprompt — persona önmegnevezés |
| `backend/…/proactive/service/MemoirGenerator.java` | memoár-prompt persona |
| `backend/…/character/service/KonziliumVerdictRound.java` | konzílium integrátor-persona + transzkript-címke |
| `backend/…/character/service/PortraitWriter.java` | portré-prompt persona |
| `backend/…/companion/llm/CompanionHelloRunner.java` | smoke-runner prompt |
| `backend/…/companion/ChatHistory.java` | előzmény-render címke |
| `backend/…/companion/embedding/MemoryEmbeddingWriter.java` | embedding-szöveg címke |
| `backend/…/companion/service/FactExtractionService.java` | tényfeltáró transzkript-címke |
| `backend/…/character/service/CharacterService.java` | a CHAIR szakértő `displayName`-je |
| `backend/…/notification/service/AnchorResolver.java` | nyolc push-cím |
| `backend/…/proactive/service/InterventionService.java` | `EYEBROW` konstans értéke |
| `backend/…/notification/controller/NotificationController.java` | teszt-push cím és törzs |
| `frontend/src/**` | ~110 látható felirat (Task 4–8 bontásban) |
| `frontend/index.html`, `frontend/vite.config.ts` | app-identitás: `<title>`, PWA `name`/`short_name` |
| `api/openapi.yml` | négy leíró szöveg + a generált kliens újragenerálása |

---

## Task 1: Backend — persona önmegnevezés az LLM promptokban

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:68`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirGenerator.java:74`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java:257`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/PortraitWriter.java:48`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/CompanionHelloRunner.java:38`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/MemoirPromptTest.java`

**Interfaces:**
- Consumes: semmit (első task).
- Produces: a `Boop` név mint persona-önmegnevezés. A Task 2 renderelt címkéi (`"Boop: "`) ugyanezt a nevet használják — a kettőnek egyeznie kell, különben a modell két néven látja magát ugyanabban a promptban.

- [ ] **Step 1: Írd meg a bukó tesztet**

A `MemoirGenerator.PROMPT` package-visible, épp azért, hogy tesztelhető legyen. Add hozzá a `MemoirPromptTest`-hez:

```java
@Test
void promptIntroducesTheAssistantAsBoop() {
    assertThat(MemoirGenerator.PROMPT)
            .contains("Te vagy Boop, Daniel egészség- és teljesítmény-társa.")
            .doesNotContain("Mezo")
            .doesNotContain("a mezo");
}
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

```bash
cd backend && ./mvnw test -Dtest=MemoirPromptTest#promptIntroducesTheAssistantAsBoop
```

Várt: FAIL — `Expecting actual to contain "Te vagy Boop, …"`.

- [ ] **Step 3: Írd át az öt promptot**

`ChatService.java:68` — a `SYSTEM_PROMPT` text block `[Ki vagy]` szakasza:

```java
            Te vagy Boop, Daniel személyes egészség- és teljesítmény-társa.
```

`MemoirGenerator.java:74`:

```java
            + "Te vagy Boop, Daniel egészség- és teljesítmény-társa. A közös hetetek "
```

`KonziliumVerdictRound.java:257` (az `integratorPersona()` text blockjának első sora):

```java
                Te vagy Boop, Daniel személyes egészség- és teljesítmény-társa, most integrátor \
```

`PortraitWriter.java:48` (a `MEZO_INTEGRATOR_PERSONA` konstans **értéke**; a konstans **neve** marad, azt az S3 nevezi át):

```java
            Te vagy Boop, Daniel személyes egészség- és teljesítmény-társa, most integrátor \
```

`CompanionHelloRunner.java:38` — figyelj: ez a mondat ékezet nélküli, mert smoke-log:

```java
                    "Te vagy Boop, a companion. Valaszolj magyarul, egyetlen rovid mondatban.",
```

- [ ] **Step 4: Futtasd a tesztet**

```bash
cd backend && ./mvnw test -Dtest=MemoirPromptTest
```

Várt: PASS.

- [ ] **Step 5: Ellenőrizd, hogy nem maradt persona-önmegnevezés**

```bash
git grep -n 'Te vagy a mezo\|Te vagy Mezo\|a mezo companion' -- backend/src/main/java
```

Várt: nincs találat.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(companion): a persona Boop néven mutatkozik be a promptokban (mezo-4dld)"
```

---

## Task 2: Backend — renderelt címkék és a megjelenített név

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/ChatHistory.java:27`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java:99`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/FactExtractionService.java:70`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java:242`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java:140`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatHistoryTest.java:26,28`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java:287,301,375,377`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriterIT.java:66`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/PromptMemoryAssemblerIT.java:60,132,133,247,249`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PromptMemoryAssemblerTest.java:94`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/AmbientRecallEvalIT.java:169`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmRecordingTest.java:109`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterApiIT.java:170`

**Interfaces:**
- Consumes: a Task 1-ben rögzített `Boop` név.
- Produces: `ChatHistory.render()` `"Boop: "` előtagot ad az asszisztens-fordulókra; `CharacterService.experts()` a CHAIR elemre `displayName = "Boop"`, `key = "mezo"` párost szolgál ki. Az S2 frontendje erre a `displayName`-re támaszkodik a `KonziliumPage` fallbackjénél.

> **Figyelem:** a `KonziliumVerdictRound.java:252` `new ConferenceTranscriptEnvelope.Turn("mezo", …)` sora és a `CharacterService.java:139` `.key("mezo")` sora **NEM változik**. Ezek éles konzílium-transzkriptekben szereplő kulcsok. Ha átírod, a régi transzkriptek szakértő nélkül maradnak.

- [ ] **Step 1: Írd át a bukó teszteket**

`ChatHistoryTest.java:26,28`:

```java
        assertThat(rendered).contains("Boop: korábbi válasz\n");
        assertThat(rendered.indexOf("Daniel: korábbi kérdés"))
                .isLessThan(rendered.indexOf("Boop: korábbi válasz"));
```

`CharacterApiIT.java:170` — és mellé egy új sor, amely a kulcsot is lerögzíti:

```java
        assertThat(mezo.getDisplayName()).isEqualTo("Boop");
        assertThat(mezo.getKey()).isEqualTo("mezo"); // perzisztált kulcs — sosem változik
```

`MemoryEmbeddingWriterIT.java:66`:

```java
        assertThat(row.getContent()).isEqualTo("Daniel: mit egyek?\nBoop: fehérjét");
```

`ChatServiceIT.java` 287/301/375/377, `PromptMemoryAssemblerIT.java` 60/132/133/247/249, `PromptMemoryAssemblerTest.java:94`, `AmbientRecallEvalIT.java:169`, `GeminiCompanionLlmRecordingTest.java:109`: minden `"Mezo: "` / `"\nMezo: "` literál `"Boop: "` / `"\nBoop: "` alakra.

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

```bash
cd backend && ./mvnw test -Dtest=ChatHistoryTest
```

Várt: FAIL — a render még `Mezo: ` előtagot ad.

- [ ] **Step 3: Írd át az öt forráshelyet**

`ChatHistory.java:27`:

```java
            rendered.append(turn.role() == Role.USER ? "Daniel: " : "Boop: ")
```

`MemoryEmbeddingWriter.java:99`:

```java
                "Daniel: " + userContent + "\nBoop: " + assistant.getContent(),
```

`FactExtractionService.java:70`:

```java
        String transcript = "Daniel: " + userContent + "\nBoop: " + assistantContent;
```

`KonziliumVerdictRound.java:242`:

```java
        StringBuilder sb = new StringBuilder("Boop: ").append(accepted).append('/').append(rulings.size())
```

`CharacterService.java:140`:

```java
                .displayName("Boop")
```

- [ ] **Step 4: Futtasd a fókuszált teszteket**

```bash
cd backend && ./mvnw test -Dtest='ChatHistoryTest,PromptMemoryAssemblerTest'
cd backend && ./mvnw test -Dtest='ChatServiceIT,MemoryEmbeddingWriterIT,PromptMemoryAssemblerIT,CharacterApiIT' -Dmezo.test.use-testcontainers=true
```

Várt: mind PASS.

- [ ] **Step 5: Ellenőrizd, hogy a kulcsok megmaradtak**

```bash
git grep -n '"mezo"' -- backend/src/main/java
```

Várt: pontosan két találat — `CharacterService.java:139` és `KonziliumVerdictRound.java:252`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(companion): a renderelt persona-címke Boop lesz, a kulcs marad mezo (mezo-4dld)"
```

---

## Task 3: Backend — push-értesítések címei

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/AnchorResolver.java:332,449,461,473,488,502,521,534`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/InterventionService.java:58`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/controller/NotificationController.java:55`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AnchorResolverIT.java:224`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageInterventionPersistenceIT.java:42`

**Interfaces:**
- Consumes: a Task 1–2 `Boop` neve.
- Produces: `InterventionService.EYEBROW == "Boop · észrevétel"` — a frontend `PeoplePage` és `NapMezoPage` erre a szövegre szűr, ezért a Task 7 ugyanezt a literált várja.

> **Ezek a címek a `app_notification.title` oszlopba perzisztálódnak.** A már kiment értesítések „Mezo ·" címmel maradnak — ez szándékos, nem írunk migrációt. Az értesítés-lista tehát egy ideig kevert címeket mutat, és ez így igaz.

- [ ] **Step 1: Írd át a bukó teszteket**

`AnchorResolverIT.java:224`:

```java
        assertThat(review.title()).isEqualTo("Boop · heti elemzés");
```

`CompanionMessageInterventionPersistenceIT.java:42`:

```java
            owner, LocalDate.parse("2026-08-24"), CompanionMessageEntity.KIND_MORNING, "Boop", List.of("Szia"));
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

```bash
cd backend && ./mvnw test -Dtest=AnchorResolverIT -Dmezo.test.use-testcontainers=true
```

Várt: FAIL — `expected: "Boop · heti elemzés" but was: "Mezo · heti elemzés"`.

- [ ] **Step 3: Írd át a nyolc címet és a két egyéb helyet**

`AnchorResolver.java` — soronként, a `Mezo` szó helyére `Boop`:

```java
// :332
                                hhmm(minute) + ":" + idFragment, "Boop · észrevétel",
// :449
                            "Boop · reggeli eligazítás", body, URL_TODAY);
// :461
                            "Boop", body, URL_TODAY);
// :473
                            "Boop · napzárás", body, URL_TODAY);
// :488
                            "Boop · alvás", body, URL_TODAY);
// :502
                            "Boop · testsúly", body, URL_TODAY);
// :521
                        hhmm(WEEKLY_REVIEW_MINUTE), "Boop · heti elemzés", excerptProse(review.getSummary()),
// :534
                    "Boop · a heted története", excerptProse(memoir.getBody()), URL_INSIGHTS_MEMOIR);
```

`InterventionService.java:58`:

```java
    public static final String EYEBROW = "Boop · észrevétel";
```

`NotificationController.java:55` — itt a törzs is tartalmazza a nevet, kisbetűvel, névelővel:

```java
                "Boop · teszt", "A push működik. Ezt Boop küldte.", "/today");
```

- [ ] **Step 4: Futtasd a teszteket**

```bash
cd backend && ./mvnw test -Dtest='AnchorResolverIT,CompanionMessageInterventionPersistenceIT' -Dmezo.test.use-testcontainers=true
```

Várt: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(notification): a push-címek Boop néven szólalnak meg (mezo-4dld)"
```

---

## Task 4: Frontend — app-héj, tab és chat

**Files:**
- Modify: `frontend/src/app/AppHeader.tsx:121`
- Modify: `frontend/src/app/TabBar.tsx:14`
- Modify: `frontend/src/features/insights/components/ChatMessage.tsx:46`
- Modify: `frontend/src/features/insights/pages/ChatPage.tsx:33,137`
- Modify: `frontend/src/features/insights/pages/MezoHubPage.tsx:154`
- Modify: `frontend/src/features/today/pages/NapMezoPage.tsx:247,254`
- Modify: `frontend/src/features/today/components/MezoMessagesSheet.tsx:28`
- Modify: `frontend/src/features/today/logic/mezoMessages.test.ts:6,34`
- Test: `frontend/src/app/AppHeader.test.tsx:66,139,151,159,285,289,291,292,296,297`
- Test: `frontend/src/app/TabBar.test.tsx:17,19,35`
- Test: `frontend/src/app/hubHeaders.test.tsx:40`
- Test: `frontend/src/features/insights/pages/ChatPage.test.tsx:210,255`
- Test: `frontend/src/features/insights/pages/insights.nav.test.tsx:96`
- Test: `frontend/src/features/today/pages/NapHubPage.test.tsx:310`
- Test: `frontend/src/shared/ui/mozaik/Mozaik.test.tsx:46,48`

**Interfaces:**
- Consumes: semmit a backendtől — ezek statikus feliratok.
- Produces: a `Boop üzenetei` aria-label és a `Boop` tab-felirat. A Task 5–8 tesztjei ugyanezt a helyesírást feltételezik.

> A `TabBar.tsx:14` sorban **csak a `label` változik**. Az `id: 'mezo'` és az `icon: 'i-mezo'` marad — az id a localStorage `mezo-tab:` kulcsába megy, az ikon a sprite azonosítója.
> A `MezoMessagesSheet.tsx:28` sorban **csak a `<h2>` szövege** változik; az `id="mezo-msgs-title"` marad, mert egy `aria-labelledby` hivatkozik rá.

- [ ] **Step 1: Írd át a bukó teszteket**

`TabBar.test.tsx`:

```tsx
test('renders the five tab labels — Nap · Edzés · Fuel · Boop · Én', () => {
  // …
  for (const label of ['Nap', 'Edzés', 'Fuel', 'Boop', 'Én']) {
```

és `:35`:

```tsx
  expect(screen.getByText('Boop').closest('a')!.className).toContain('active')
```

`AppHeader.test.tsx` — minden `Mezo üzenetei` → `Boop üzenetei` (a `/^Mezo üzenetei/` regexek `/^Boop üzenetei/` alakra), és `:159`, `:289` a `'Mezo · ma'` → `'Boop · ma'`.

`hubHeaders.test.tsx:40`: `expect.stringMatching(/^Boop üzenetei/)`.

`ChatPage.test.tsx:210,255` és `insights.nav.test.tsx:96`: `'Mezo'` → `'Boop'` a `.mzc-eb` / `.mzc-hnm` szelektorokkal (a **szelektorok maradnak**, csak a keresett szöveg változik).

`NapHubPage.test.tsx:310`: `{ name: /Boop üzenetei/ }`.

`Mozaik.test.tsx:46,48`: `eyebrow="Boop"` — az `icon="i-mezo"` marad.

`mezoMessages.test.ts:6,34`: `eyebrow: 'Boop · reggeli briefing · 06:30'` és `eyebrow: 'Boop · észrevétel'`.

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

```bash
cd frontend && pnpm vitest run src/app/TabBar.test.tsx src/app/AppHeader.test.tsx
```

Várt: FAIL — a tab még `Mezo` feliratú.

- [ ] **Step 3: Írd át a forrásokat**

```tsx
// TabBar.tsx:14 — csak a label!
  { id: 'mezo', label: 'Boop', icon: 'i-mezo' },

// AppHeader.tsx:121
        aria-label={unreadMsgs > 0 ? `Boop üzenetei, ${unreadMsgs} olvasatlan` : 'Boop üzenetei'}

// ChatMessage.tsx:46
        <span className="mzc-eb">Boop</span>

// ChatPage.tsx:33
        <span className="mzc-eb">Boop</span>
// ChatPage.tsx:137
          <span className="mzc-hnm">Boop</span>

// MezoHubPage.tsx:154
          <div className="mzh-nm">Boop</div>

// NapMezoPage.tsx:247
        <div className="mz-hero-nm">Boop · ma</div>
// NapMezoPage.tsx:254
        <div className="nap-mzseg" role="tablist" aria-label="Boop tartalom">

// MezoMessagesSheet.tsx:28 — az id marad!
            <h2 id="mezo-msgs-title">Boop üzenetei</h2>
```

- [ ] **Step 4: Futtasd a fókuszált teszteket mindkét módban**

```bash
cd frontend && pnpm vitest run src/app src/features/insights/pages/ChatPage.test.tsx src/features/today src/shared/ui/mozaik
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/app src/features/insights/pages/ChatPage.test.tsx src/features/today src/shared/ui/mozaik
```

Várt: minden PASS. *(A `navigation.test.tsx:107` a `CsapatPage` feliratára asszertál — az a Task 7 hatóköre, és a teszt is ott változik, hogy ez a task önmagában zöld maradjon.)*

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): az app-héj, a tab és a chat Boop néven szólal meg (mezo-4dld)"
```

---

## Task 5: Frontend — Boop hub aloldalai

**Files:**
- Modify: `frontend/src/features/insights/logic/diagnosisCatalog.ts:17,23,30`
- Modify: `frontend/src/features/insights/pages/DiagnosisListPage.tsx:23,43,85`
- Modify: `frontend/src/features/insights/pages/ExperimentsPage.tsx:28,68,133`
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx:62`
- Modify: `frontend/src/features/insights/pages/MemoirPage.tsx:32`
- Modify: `frontend/src/features/insights/pages/MemoryPage.tsx:22`
- Modify: `frontend/src/features/insights/pages/PatternsPage.tsx:145`
- Modify: `frontend/src/features/insights/pages/PredictionsPage.tsx:52`
- Test: `frontend/src/features/insights/pages/DiagnosisListPage.test.tsx:33,46`
- Test: `frontend/src/features/insights/pages/ExperimentsPage.test.tsx:32,110`
- Test: `frontend/src/features/insights/pages/KnowledgeListPage.test.tsx:624`
- Test: `frontend/src/features/insights/pages/insights.nav.test.tsx:62,76,77,78,79,80,81`

**Interfaces:**
- Consumes: a Task 4 `Boop` helyesírását.
- Produces: a `‹ Boop` vissza-címke, amelyet az `insights.nav.test.tsx` hat útvonalon ellenőriz.

> A `navigate('/mezo')` hívások **változatlanok** — az útvonal az S2 dolga. Itt csak a `label` szöveg vált.

- [ ] **Step 1: Írd át a bukó teszteket**

`insights.nav.test.tsx:76–81` — a hat sor második eleme `'‹ Boop'`; **az útvonalak maradnak `/mezo/*`**:

```tsx
    ['/mezo/patterns', '‹ Boop'],
    ['/mezo/memoir', '‹ Boop'],
    ['/mezo/knowledge', '‹ Boop'],
    ['/mezo/predictions', '‹ Boop'],
    ['/mezo/experiments', '‹ Boop'],
    ['/mezo/memoria', '‹ Boop'],
```

`insights.nav.test.tsx:62` és `ExperimentsPage.test.tsx:110`:

```tsx
      await screen.findByText('Az első N=1 kísérletet a megerősített mintákból javasolja Boop.'),
```

`ExperimentsPage.test.tsx:32`:

```tsx
    expect(screen.getByText('＋ Új kísérletet javasol Boop')).toBeInTheDocument()
```

`DiagnosisListPage.test.tsx:33,46`:

```tsx
    expect(screen.getByText('Havi Boop Riport')).toBeInTheDocument()
      expect(screen.getByText('Még nem kérdezted meg. Boop az elmúlt két hét adataiból keres okokat.')).toBeInTheDocument(),
```

`KnowledgeListPage.test.tsx:624`:

```tsx
    expect(screen.getByText('‹ Boop')).toBeInTheDocument()
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

```bash
cd frontend && pnpm vitest run src/features/insights
```

Várt: FAIL a fenti asszerciókon.

- [ ] **Step 3: Írd át a forrásokat**

```ts
// diagnosisCatalog.ts:17
      'Boop az utolsó 14 nap adatait veti össze az előző négy héttel — alvás, energia, terhelés, fuel —, és rangsorolt gyanúsítottakat ad, mindet mért evidenciával.',
// diagnosisCatalog.ts:23
      'Az alvásod két hete a viselkedési oldal ellen fut: késői étkezés, esti stressz, terhelés, lefekvés-szórás — Boop megnézi, melyik viszi el.',
// diagnosisCatalog.ts:30
  'Havi Boop Riport',
```

```tsx
// DiagnosisListPage.tsx:23
  insufficient: 'Kettőnél kevesebb területről van adat az elmúlt két hétben — Boop nem tippel.',
// DiagnosisListPage.tsx:43
      <PageHead onBack={() => navigate('/mezo')} label="‹ Boop" />
// DiagnosisListPage.tsx:85
                Még nem kérdezted meg. Boop az elmúlt két hét adataiból keres okokat.

// ExperimentsPage.tsx:28
      <PageHead onBack={() => navigate('/mezo')} label="‹ Boop" />
// ExperimentsPage.tsx:68
            Az első N=1 kísérletet a megerősített mintákból javasolja Boop.
// ExperimentsPage.tsx:133
        ＋ Új kísérletet javasol Boop

// KnowledgeListPage.tsx:62
  const label = isBase ? '‹ Boop' : inKindDrill ? '‹ Kategóriák' : '‹ Tudástár'

// MemoirPage.tsx:32, MemoryPage.tsx:22, PatternsPage.tsx:145, PredictionsPage.tsx:52
      <PageHead onBack={() => navigate('/mezo')} label="‹ Boop" />
```

- [ ] **Step 4: Futtasd mindkét módban**

```bash
cd frontend && pnpm vitest run src/features/insights
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/insights
```

Várt: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights
git commit -m "feat(ui): a Boop hub aloldalai Boop néven hivatkoznak a társra (mezo-4dld)"
```

---

## Task 6: Frontend — Fuel felületek

**Files:**
- Modify: `frontend/src/features/fuel/components/RecipeCard.tsx:59`
- Modify: `frontend/src/features/fuel/components/RecipeFitBadge.tsx:34`
- Modify: `frontend/src/features/fuel/components/RecipeLogsList.tsx:15`
- Modify: `frontend/src/features/fuel/pages/FuelKamraPage.tsx:264`
- Modify: `frontend/src/features/fuel/pages/FuelPlanPage.tsx:117`
- Modify: `frontend/src/features/fuel/pages/FuelRecipesPage.tsx:76`
- Modify: `frontend/src/features/fuel/pages/FuelSlotsPage.tsx:500,505,510,518`
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.tsx:245,270,282`
- Modify: `frontend/src/features/fuel/sheets/MealScoreSheet.tsx:64,77`
- Modify: `frontend/src/features/fuel/sheets/ReplanSheet.tsx:49`
- Test: `frontend/src/features/fuel/components/RecipeCard.test.tsx:25,36`
- Test: `frontend/src/features/fuel/components/RecipeFitBadge.test.tsx:6`
- Test: `frontend/src/features/fuel/pages/FuelPlanPage.test.tsx:78`
- Test: `frontend/src/features/fuel/pages/FuelSlotsPage.test.tsx:322,335,345`
- Test: `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx:334,340,346,347,364,365`
- Test: `frontend/src/features/fuel/sheets/MealScoreSheet.test.tsx:52`
- Test: `frontend/src/features/fuel/sheets/ReplanSheet.test.tsx:14`

**Interfaces:**
- Consumes: a Task 4 helyesírását.
- Produces: a `Boop értékelése` gombnév, amelyre a Playwright vizuális teszt (`frontend/tests/visual/visual.spec.ts:242`) vár — azt a Task 9 igazítja.

> A `RecipeCard.tsx:59` sorban a `recipe.mezoFit.score` **mezőnév marad** — az az API-szerződés, az S2 nevezi át. Csak a `'✨ Mezo'` felirat változik.

- [ ] **Step 1: Írd át a bukó teszteket**

```tsx
// RecipeCard.test.tsx:25,36
  expect(screen.getByText('✨ Boop')).toBeInTheDocument()
  expect(screen.queryByText('✨ Boop')).not.toBeInTheDocument()
// RecipeFitBadge.test.tsx:6
  expect(screen.getByText('Boop')).toBeInTheDocument()
// FuelPlanPage.test.tsx:78
    expect(screen.queryByText('Visszatérő minták · Boop')).not.toBeInTheDocument()
// FuelSlotsPage.test.tsx:322,335,345
  await userEvent.click(screen.getByRole('button', { name: 'Boop értékelése' }))
// RecipeDetailPage.test.tsx:334,346 (és a 340,347,364,365 queryByText párjaik)
    expect(await screen.findByText('Boop újraértékeli…')).toBeInTheDocument()
    expect(await screen.findByText('Boop értékeli…')).toBeInTheDocument()
// MealScoreSheet.test.tsx:52
  expect(screen.getByText('Boop · olvasat')).toBeInTheDocument()
// ReplanSheet.test.tsx:14
  expect(screen.getByText(/Replan · Boop/)).toBeInTheDocument()
```

Emellett a `FuelSlotsPage.test.tsx:318` teszt-neve is: `'mock mode: Boop értékelése shows the canned verdict card'`.

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

```bash
cd frontend && pnpm vitest run src/features/fuel
```

Várt: FAIL.

- [ ] **Step 3: Írd át a forrásokat**

```tsx
// RecipeCard.tsx:59 — a mezoFit mezőnév marad!
          {pending ? '✨ Boop' : `${Math.round(recipe.mezoFit.score! * 100)} fit`}
// RecipeFitBadge.tsx:34
            Boop
// RecipeLogsList.tsx:15
          Amint logolod a mai étkezésekbe, Boop kontextusra futtatja és látod itt a tényleges score-okat.
// FuelKamraPage.tsx:264
                  <span className="mz-eyebrow">Boop javaslatok</span>
// FuelPlanPage.tsx:117
                Visszatérő minták · Boop
// FuelRecipesPage.tsx:76
        <PageBody principle="A fit-jelvény ✨, amíg Boop még nem pontozta — a szám csak akkor kerül ki, ha valóban megszületett.">
// FuelSlotsPage.tsx:500
              aria-label="Boop értékelése"
// FuelSlotsPage.tsx:505
              <Icon name="sparkle" size={14} /> Boop értékelése
// FuelSlotsPage.tsx:510
                ✨ Boop értékeli a felosztást…
// FuelSlotsPage.tsx:518
                  <Eyebrow brand>Boop · olvasat</Eyebrow>
// RecipeDetailPage.tsx:245
                  {breakdownRefreshing ? 'Boop újraértékeli…' : 'Boop értékeli…'}
// RecipeDetailPage.tsx:270
              <div className="mz-tile-top"><span className="mz-eyebrow">Boop · olvasat</span></div>
// RecipeDetailPage.tsx:282
                  {breakdownBusy ? 'Boop olvasata készül…' : 'Még nincs olvasat.'}
// MealScoreSheet.tsx:64
                <Eyebrow className="text-tertiary">Boop olvasata készül…</Eyebrow>
// MealScoreSheet.tsx:77
                  <Eyebrow brand>Boop · olvasat</Eyebrow>
// ReplanSheet.tsx:49
              <Eyebrow brand>Replan · Boop</Eyebrow>
```

- [ ] **Step 4: Futtasd mindkét módban**

```bash
cd frontend && pnpm vitest run src/features/fuel
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/fuel
```

Várt: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel
git commit -m "feat(ui): a Fuel felületek Boop néven hivatkoznak a társra (mezo-4dld)"
```

---

## Task 7: Frontend — Én, Heti, Célok, Emberek, Karakter

**Files:**
- Modify: `frontend/src/features/character/pages/CsapatPage.tsx:47`
- Modify: `frontend/src/features/character/pages/KarakterHubPage.tsx:45`
- Modify: `frontend/src/features/character/pages/KonziliumPage.tsx:181`
- Modify: `frontend/src/features/me/components/WeekNextCard.tsx:18`
- Modify: `frontend/src/features/me/components/WeekReviewCard.tsx:31,64`
- Modify: `frontend/src/features/me/logic/dayScoreState.ts:62`
- Modify: `frontend/src/features/me/logic/peopleVisuals.ts:40`
- Modify: `frontend/src/features/me/logic/weekDay.ts:69,75`
- Modify: `frontend/src/features/me/logic/weekHub.ts:68,103`
- Modify: `frontend/src/features/me/pages/CelPage.tsx:107`
- Modify: `frontend/src/features/me/pages/CelWizardPage.tsx:113,116,117,128,150,161,179,182`
- Modify: `frontend/src/features/me/pages/CelokPage.tsx:74`
- Modify: `frontend/src/features/me/pages/GoalsPage.tsx:80`
- Modify: `frontend/src/features/me/pages/NotificationsPage.tsx:289`
- Modify: `frontend/src/features/me/pages/PeoplePage.tsx:180`
- Modify: `frontend/src/features/me/pages/PersonDetailPage.tsx:194`
- Modify: `frontend/src/features/me/pages/WeekAnalysisPage.tsx:70,99,159`
- Modify: `frontend/src/features/me/pages/WeekDayPage.tsx:224`
- Modify: `frontend/src/features/me/pages/WeekDiscoveriesPage.tsx:91,92`
- Modify: `frontend/src/features/me/pages/WeekHubPage.tsx:218,301,306`
- Modify: `frontend/src/features/me/pages/WeekLessonsPage.tsx:28,121`
- Modify: `frontend/src/features/me/sheets/PersonLogSheet.tsx:55`
- Modify: `frontend/src/data/character/characterMock.ts:115`
- Modify: `frontend/src/data/me/llmUsageHooks.ts:157`
- Modify: `frontend/src/data/me/people.ts:141`
- Test: `frontend/src/features/character/pages/KarakterHubPage.test.tsx:111`
- Test: `frontend/src/features/me/logic/dayScoreState.test.ts:47`
- Test: `frontend/src/features/me/logic/weekHub.test.ts:47,75,76,105`
- Test: `frontend/src/features/me/pages/NotificationsPage.test.tsx:186,220,240`
- Test: `frontend/src/features/me/pages/PeoplePage.test.tsx:128,197`
- Test: `frontend/src/features/me/pages/PersonDetailPage.test.tsx:204`
- Test: `frontend/src/features/me/pages/WeekAnalysisPage.test.tsx:62`
- Test: `frontend/src/features/me/pages/WeekDayPage.test.tsx:82,93,95,106`
- Test: `frontend/src/features/me/pages/WeekDiscoveriesPage.test.tsx:31`
- Test: `frontend/src/features/me/pages/WeekHubPage.test.tsx:117,127,150,158,186,188,190,195`
- Test: `frontend/src/features/me/pages/WeekLessonsPage.test.tsx:44`
- Test: `frontend/src/app/navigation.test.tsx:107`

**Interfaces:**
- Consumes: a Task 3 `InterventionService.EYEBROW == "Boop · észrevétel"` értékét — a `PeoplePage` erre a szövegre szűr valós módban.
- Produces: semmit további taskoknak.

> A `characterMock.ts:115` `name: 'Mezo'` a mock **megjelenítendő neve**, nem kulcs — változik. A `characterMock.ts:159` `key: 'mezo'` és `:440,473` `persona: 'mezo'` **nem változik**.

- [ ] **Step 1: Írd át a bukó teszteket**

```ts
// dayScoreState.test.ts:47 és weekHub.test.ts:47
      .toBe('Kettőnél kevesebb területről van adat, ezért Boop nem ad pontszámot: kitalálni nem fog.')
// weekHub.test.ts:75,76
  test('a closed week without a review does NOT claim „Boop elemzésével"', () => {
    expect(weekSubline('closed', true, 78)).toBe('lezárt hét · Boop elemzésével')
// weekHub.test.ts:105
      .toContain('Hétfő reggel érkezik — Boop a lezárt hét adataiból írja meg.')
```

```tsx
// KarakterHubPage.test.tsx:111
    expect(screen.getByText('Boop összegzi a portrékat…')).toBeInTheDocument()
// NotificationsPage.test.tsx:186,220,240 — 'Mezo megszólal' → 'Boop megszólal'
// PeoplePage.test.tsx:128,197 — /Mezo · észrevétel/ → /Boop · észrevétel/
// PersonDetailPage.test.tsx:204
  expect(screen.queryByText('Amit Boop tud')).toBeNull()
// WeekAnalysisPage.test.tsx:62
    expect(screen.getByText('napi pontszámok · Boop olvasata')).toBeInTheDocument()
// WeekDayPage.test.tsx:82,95
    expect(screen.getByText('Boop · erről a napról')).toBeInTheDocument()
// WeekDayPage.test.tsx:93
      'A heti elemzés nem írt külön ehhez a naphoz — Boop csak azokhoz a napokhoz ír, ahol volt mit mondani.',
// WeekDayPage.test.tsx:106
      'Kettőnél kevesebb területről van adat, ezért Boop nem ad pontszámot: kitalálni nem fog.',
// WeekDiscoveriesPage.test.tsx:31
    expect(head).toMatch(/Amit Boop a héten .*magától.* tett a memóriába/s)
// WeekHubPage.test.tsx:117
    expect(screen.getByText(/Hétfő reggel érkezik — Boop a lezárt hét adataiból írja meg\./)).toBeInTheDocument()
// WeekHubPage.test.tsx:127
    expect(screen.getByText('lezárt hét · Boop elemzésével')).toBeInTheDocument()
// WeekHubPage.test.tsx:150 — mint a dayScoreState fenti sora
// WeekHubPage.test.tsx:158
      [/Boop · heti elemzés/, `/me/week/elemzes?start=${mockMeWeekStart}`],
// WeekHubPage.test.tsx:186,188,190
  test('„Boop · a következő heted" sits at the bottom of the running week only', () => {
    expect(screen.getByText('Boop · a következő heted')).toBeInTheDocument()
    expect(screen.getAllByText('Boop · a következő heted')).toHaveLength(1)
// WeekHubPage.test.tsx:195
    expect(screen.getByText(/Boop sosem talál ki számot/)).toBeInTheDocument()
// WeekLessonsPage.test.tsx:44
    expect(foot).toContain('Boop nem ír a tudásba magától: a heti elemzés jelöltet állít, a döntés a tiéd.')
// navigation.test.tsx:107 — a CsapatPage felirata ebben a taskban változik
    expect(await screen.findByText('Boop belső tanácsa — ők dolgoznak a karakteren')).toBeInTheDocument()
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

```bash
cd frontend && pnpm vitest run src/features/me src/features/character
```

Várt: FAIL.

- [ ] **Step 3: Írd át a forrásokat**

Karakter:

```tsx
// CsapatPage.tsx:47
        <div className="mz-hero-sb">Boop belső tanácsa — ők dolgoznak a karakteren</div>
// KarakterHubPage.tsx:45
  'Boop összegzi a portrékat…',
// KonziliumPage.tsx:181 — a fallback displayName
                  displayName={experts.find((e) => e.key === b.turn.persona)?.displayName ?? 'Boop'}
```

Mock adat:

```ts
// characterMock.ts:115 — a key/persona sorokhoz NE nyúlj
    name: 'Boop',
// llmUsageHooks.ts:157
  systemPrompt: 'Te vagy Boop, Daniel személyes egészség- és teljesítmény-társa.',
// people.ts:141
      'Saját kis Boop-szerű naplót épít magának',
```

Logika (a névelő minden esetben eltűnik):

```ts
// dayScoreState.ts:62 és weekDay.ts:69
  learning: 'Kettőnél kevesebb területről van adat, ezért Boop nem ad pontszámot: kitalálni nem fog.',
// weekDay.ts:75
  noNote: 'A heti elemzés nem írt külön ehhez a naphoz — Boop csak azokhoz a napokhoz ír, ahol volt mit mondani.',
// weekHub.ts:68
  return hasReview ? 'lezárt hét · Boop elemzésével' : 'lezárt hét · elemzés nélkül'
// weekHub.ts:103
  return 'Hétfő reggel érkezik — Boop a lezárt hét adataiból írja meg. Addig gyűlnek a napok.'
// peopleVisuals.ts:40 — az i-mezo ikonkulcs marad!
  chat: { label: 'Boop-chat', clay: 'i-mezo' },
```

Oldalak — minden `Mezo` → `Boop`, és ahol `a Mezo` állt, ott a névelő eltűnik:

```tsx
// WeekNextCard.tsx:18      → Boop · a következő heted
// WeekReviewCard.tsx:31    → Boop · heti elemzés
// WeekReviewCard.tsx:64    → Hétfő reggel érkezik — Boop a lezárt hét adataiból írja meg.
// CelPage.tsx:107          →  · Boop figyeli ({pl.trigger.source})
// CelWizardPage.tsx:113    → Boop most nem tudta elolvasni a célt.
// CelWizardPage.tsx:116    → Boop olvassa a célt…
// CelWizardPage.tsx:117    → Boop olvasata
// CelWizardPage.tsx:128    → Életterület · Boop javaslata, átírhatod
// CelWizardPage.tsx:150    → Akadály · Boop javaslatai vagy a sajátod
// CelWizardPage.tsx:161    → 'Boop javaslata'
// CelWizardPage.tsx:179    → Amire Boop figyel · {…} szabály
// CelWizardPage.tsx:182    → …ha kettő ugyanazt a pihenőt kéri, Boop szól.
// CelokPage.tsx:74         → Boop pilléreket javasol
// GoalsPage.tsx:80         → Még nincs aktív célod — hozz létre egyet, és Boop köré szervezi a terveket.
// NotificationsPage.tsx:289→ Boop megszólal
// PeoplePage.tsx:180       → Boop · észrevétel
// PersonDetailPage.tsx:194 → Amit Boop tud
// WeekAnalysisPage.tsx:70  → 'napi pontszámok · Boop olvasata'
// WeekAnalysisPage.tsx:99  → Boop · heti elemzés
// WeekAnalysisPage.tsx:159 → Hétfő reggel érkezik — Boop a lezárt hét adataiból írja meg. Addig a napok adatai
// WeekDayPage.tsx:224      → Boop · erről a napról
// WeekDiscoveriesPage.tsx:91 → Amit Boop a héten <b>magától</b> tett a memóriába — ezek nem javaslatok, hanem
// WeekDiscoveriesPage.tsx:92 → megtörtént nyomok. Koppints, és a Boop tabon nyílnak ki.
// WeekHubPage.tsx:218      → Boop · heti elemzés
// WeekHubPage.tsx:301      → {/* „Boop · a következő heted" — running week only, gating unchanged. */}
// WeekHubPage.tsx:306      → helyén. Boop sosem talál ki számot: az elemzés csak a logolt adatokból dolgozik.
// WeekLessonsPage.tsx:28   → 'Boop nem ír a tudásba magától: a heti elemzés jelöltet állít, a döntés a tiéd. '
// WeekLessonsPage.tsx:121  → 'Nincs javaslat ehhez a héthez. Ha elkészül az elemzés, Boop ide teszi, amit megtanult.'
// PersonLogSheet.tsx:55    → Boop kihallja a nevet, a hangulatot, és magától beköti.
```

- [ ] **Step 4: Futtasd mindkét módban, a Task 4 maradékával együtt**

```bash
cd frontend && pnpm vitest run src/features/me src/features/character src/app/navigation.test.tsx
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/me src/features/character src/app/navigation.test.tsx
```

Várt: minden PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): az Én, Heti, Célok, Emberek és Karakter felületek Boop néven szólnak (mezo-4dld)"
```

---

## Task 8: Frontend — Edzés, rituálé, gyorsbevitel és a tutorial-szövegek

**Files:**
- Modify: `frontend/src/features/train/pages/SportPage.tsx:290,430`
- Modify: `frontend/src/features/train/wizard/StepProgram.tsx:54`
- Modify: `frontend/src/features/train/wizard/StepWhen.tsx:37`
- Modify: `frontend/src/features/ritual/components/ReleaseStep.tsx:32`
- Modify: `frontend/src/features/today/sheets/CheckInSheet.tsx:338`
- Modify: `frontend/src/features/tutorial/registry/fogalmak.ts:31,43`
- Modify: `frontend/src/features/tutorial/registry/fuel.ts:26,36,41`
- Modify: `frontend/src/features/tutorial/registry/mezo.ts:17,21,27,33`
- Modify: `frontend/src/features/tutorial/registry/train.ts:44`
- Test: `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx:97`

**Interfaces:**
- Consumes: a Task 4 helyesírását.
- Produces: semmit további taskoknak.

> **A `mezo.ts` fájlnév és a benne lévő `id: 'mezo'` marad** — a tutorial-azonosító a `mezo.kalauz.v1` localStorage-kulcs alá megy „látott" jelként. Csak a `label` és a `voice` szövegek változnak. A fájl átnevezése az S2 dolga.

- [ ] **Step 1: Írd át a bukó tesztet**

```tsx
// MesocyclePlannerPage.test.tsx:97
  expect(screen.getByText('Boop összerakja a blokkod…')).toBeInTheDocument()
```

- [ ] **Step 2: Futtasd, és győződj meg róla, hogy bukik**

```bash
cd frontend && pnpm vitest run src/features/train/pages/MesocyclePlannerPage.test.tsx
```

Várt: FAIL.

- [ ] **Step 3: Írd át a forrásokat**

```tsx
// SportPage.tsx:290 — figyelj: a "mesociklustól" szakszó MARAD
              A röplabda recurring · független a gym mesociklustól. Új meso indításakor Boop automatikusan beleépíti a
// SportPage.tsx:430
            <span className="eyebrow brand">Boop · keresztrendszer hatások</span>
// StepProgram.tsx:54
        <b>Boop összerakja a blokkod…</b>
// StepWhen.tsx:37
      <p className="mz-steplead">Csak ennyit kérdezünk — a többit a modell és Boop rakja össze.</p>
// ReleaseStep.tsx:32
          <span className="rz-note-eyebrow">Boop · napzárás</span>
// CheckInSheet.tsx:338
          <span className="label-mono" style={{ color: accent }}>Boop · azonnali olvasat</span>
```

- [ ] **Step 4: Írd át a tutorial-szövegeket — és töröld a hazuggá vált mondatot**

`fogalmak.ts:31` a *mezociklus* fogalmát definiálja. A záró mondat — „A Mezo innen kapta a nevét." — a rename után **nem igaz**, ezért **törlendő**, nem cserélendő. A definíció önmagában megáll:

```ts
    def: 'Több hetes edzésblokk: a terhelés hétről hétre nő, a végén egy könnyebb hét pihentet.',
```

A többi tutorial-szöveg sima csere:

```ts
// fogalmak.ts:43
    def: 'Egy ismétlődő összefüggés a saját adataidban, amit Boop vesz észre — például „kevés alvás után több szénhidrát".',
// fuel.ts:26
        voice: 'A **+** gombbal vagy a Logolás-csempéből. Elég egy fotó vagy egy mondat — „egy tál zabkása banánnal" — a többit Boop kitalálja.',
// fuel.ts:36
        voice: 'Edzésnapon több keret jár. A súlyod és az alvásod is innen kap adatot — és a chatben Boop ebből tud tanácsot adni.',
// fuel.ts:41 — az útvonal és az ikonkulcs marad!
          { to: '/mezo/chat', label: 'Boop chat', icon: 'i-mezo' },
// mezo.ts:17
    label: 'Boop',
// mezo.ts:21
        title: 'Ez Boop.',
// mezo.ts:27
        voice: 'Boop nem a semmiből tanácsol — a saját napjaidból olvas ki ismétlődő összefüggéseket, és megmutatja őket.',
// mezo.ts:33
        voice: 'A felső sáv egy sima beszélgetés-indító: írd be, ami eszedbe jut, vagy mondd fel hangosan. Boop ismeri a mai napodat, nem a nulláról indul.',
// train.ts:44
        voice: 'Egy edzésnapon több energia jár, és a súlyod is másképp mozog. Boop ezeket összeköti.',
```

- [ ] **Step 5: Futtasd mindkét módban**

```bash
cd frontend && pnpm vitest run src/features/train src/features/ritual src/features/today src/features/tutorial
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/train src/features/ritual src/features/today src/features/tutorial
```

Várt: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): az Edzés, rituálé és tutorial szövegek Boop néven szólnak (mezo-4dld)"
```

---

## Task 9: App-identitás, OpenAPI-leírások és a teljes zöld

**Files:**
- Modify: `frontend/index.html:17`
- Modify: `frontend/vite.config.ts:44,45`
- Modify: `api/openapi.yml:106,5625,8262,16290,20456`
- Modify: `frontend/src/data/_client/api.gen.ts` *(generált — ne kézzel írd)*
- Modify: `frontend/tests/visual/visual.spec.ts:242`

**Interfaces:**
- Consumes: a Task 6 `Boop értékelése` gombnevét (a Playwright teszt erre vár).
- Produces: a kész szelet.

> Az `api/openapi.yml` a szerződés forrása, a `api.gen.ts` **generált** — a CI contract-drift ellenőrzése bukik, ha kézzel írod. Mindig a generátort futtasd.
> A `RecipeMezoFit` sémanév és a `mezoFit` mezőnév **NEM változik** ebben a szeletben — az S2/S3 közös szerződés-változása, mert backend DTO-t is érint.

- [ ] **Step 1: App-identitás**

```html
<!-- frontend/index.html:17 -->
    <title>Boop</title>
```

A `frontend/index.html:22` `localStorage.getItem('mezo-theme')` **marad** — perzisztált kulcs.

```ts
// frontend/vite.config.ts:44,45
      manifest: {
        name: 'Boop',
        short_name: 'Boop',
```

- [ ] **Step 2: OpenAPI leírások**

```yaml
# :106
    description: 'Per-user "seen" store of the in-app page guides (Boop-kalauz, mezo-gb1s)'
# :5625
      summary: On-demand experiment proposal ("+ Új kísérlet javasol Boop") (P2)
# :8262
        The profiling team catalog — 7 domain experts + Szkeptikus + Boop, in
# :16290
            Az Emberek hub Boop-észrevétel sávjának mondata. A mai 'people'
# :20456
          description: Boop's one-sentence reading of the why (Hungarian)
```

- [ ] **Step 3: Generáld újra a klienst**

```bash
cd frontend && pnpm generate:api
```

Ellenőrizd, hogy a diff csak a leírásokat érinti:

```bash
git diff --stat frontend/src/data/_client/api.gen.ts
```

- [ ] **Step 4: Igazítsd a vizuális tesztet**

```ts
// frontend/tests/visual/visual.spec.ts:242
      await page.getByRole('button', { name: /Boop értékelése/ }).waitFor()
```

- [ ] **Step 5: Teljes frontend zöld, mindkét módban + build**

```bash
cd frontend && pnpm vitest run && VITE_USE_MOCK=false pnpm vitest run && pnpm build
```

Várt: minden PASS, a build sikeres.

- [ ] **Step 6: Ellenőrizd, hogy nem maradt látható „Mezo"**

```bash
git grep -n 'Mezo' -- 'frontend/src/**/*.tsx' 'frontend/src/**/*.ts' | grep -v '\.test\.' | grep -viE ':[0-9]+:\s*(//|\*|/\*)' | grep -viE 'Mezociklus|MezoHubPage|MezoThread|NapMezoPage|MezoMessage|MezoChip|MezoTab|MezoData|mezoFit|mezoNote|mezoMessages|buildMezoMessages|partitionMezoThread|checkMezoContext|useMezoThread|import '
```

Várt: **nincs találat.** Ami maradna, az vagy azonosító (S2), vagy komment (S2/S4) — ha bármi más jön elő, az kimaradt copy.

- [ ] **Step 7: Frissítsd a vizuális baselineket**

A pillanatképek szövege megváltozott, tehát a baseline-frissítés szándékos:

```bash
cd frontend && pnpm test:visual:update
```

Nézd át a diffet: **csak** a „Mezo" → „Boop" feliratok változhattak. Ha bármelyik képen elmozdult a layout, az nem a rename műve — állj meg és vizsgáld ki.

- [ ] **Step 8: Backend teljes zöld**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
```

Várt: PASS.

- [ ] **Step 9: Commit és PR**

```bash
git add -A
git commit -m "feat(brand): az app-identitás és az OpenAPI leírások Boop néven (mezo-4dld)"
git push -u origin feat/boop-rename-s1
gh pr create --title "feat(brand): Mezo → Boop — persona és látható copy (mezo-4dld)" --body "$(cat <<'EOF'
Az S1 szelet a mezo-r89o epicből: a felhasználóhoz beszélő persona és minden
látható felirat Boop lesz. Kulcs, azonosító és perzisztált sor nem változik.

- Backend: LLM rendszerpromptok, renderelt címkék, nyolc push-értesítés cím
- Frontend: ~110 felirat, app-identitás (title, PWA manifest)
- OpenAPI leírások + generált kliens

Változatlan: CharacterService.key("mezo"), a konzílium-transzkript persona
kulcsa, az i-mezo ikonkulcs, a mz- CSS prefix, minden localStorage-kulcs és
minden Mezo* kódazonosító (azok az S2/S3 dolga).

Egy mondat nem cserélve, hanem törölve lett: a mezociklus-fogalom „A Mezo
innen kapta a nevét." zárómondata a rename után nem igaz.

Spec: docs/superpowers/specs/2026-09-03-mezo-to-boop-rename-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 10: Várd meg a zöld CI-t, majd merge-elj lokálisan**

```bash
gh pr checks --watch
```

Zöld után:

```bash
git checkout main && git pull --rebase && git merge --no-ff feat/boop-rename-s1 && git push && git branch -d feat/boop-rename-s1
```

- [ ] **Step 11: Zárd a bd issue-t**

```bash
bd close mezo-4dld
bd dolt push && git push
```
