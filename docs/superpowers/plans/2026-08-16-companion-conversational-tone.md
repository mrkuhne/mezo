# Companion Conversational Tone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A companion chat beszélgetős hangnemet kapjon — valódi multi-turn history a `CompanionLlm` portban, átépített persona-prompt, és egy advisor, ami a jelöletlen állítást bünteti a spekuláció helyett.

**Architecture:** A `CompanionLlm` port kap egy `List<Turn> history` paramétert úgy, hogy az új 5-argumentumos alak lesz az absztrakt, a mostani 4-argumentumos pedig default — így csak a két adapter (`GeminiCompanionLlm`, `FakeCompanionLlm`) változik, a 10+ pipeline-hívó érintetlen marad. A history ezután valódi `Message` listaként megy a modellnek a system prompt helyett; a szöveges renderelése (`ChatHistory.render`) megmarad a verdict-bíráló payloadjának, a fake echójának és az llm-audit új `conversation_history` oszlopának.

**Tech Stack:** Java 21, Spring Boot 4.x, Spring AI 2.0.0 (google-genai starter), PostgreSQL 16 + Liquibase, JUnit 5 + AssertJ + Testcontainers.

**Spec:** [`docs/superpowers/specs/2026-08-16-companion-conversational-tone-design.md`](../specs/2026-08-16-companion-conversational-tone-design.md)
**bd issue:** `mezo-q71s`

## Global Constraints

- Base package `io.mrkuhne.mezo`; feature package `feature/companion/{service,advisor,llm,config,entity,repository}` + `techcore/`.
- Konstruktor-injektálás `@RequiredArgsConstructor`-ral, **soha nem mező-injektálás**. Tunable érték `application.yml`-ben a `mezo:` gyökér alatt, **soha `@Value`**.
- Teszt-elnevezés: `test{Method}_should{Result}_when{Condition}`. **Csak AssertJ.** Integrációs tesztben **nincs Mockito / `@MockBean` / H2** — az ITs a `companion-fake` profilon futnak és `AbstractIntegrationTest`-ből származnak.
- Liquibase: `{YYYYMMDDHHMM}_mezo-q71s_{leiras}.sql` a `backend/src/main/resources/db/changelog/1.0.0/script/` alatt, **plusz** egy `changeSet` bejegyzés az `1.0.0_master.yml` végén `id: "1.0.0:{fájlnév-kiterjesztés-nélkül}"`, `author: daniel.kuhne` alakban. Kiadott changeset soha nem módosul.
- Minden Maven-futás **`clean`-nel** (a Lombok+MapStruct inkrementális fordítás megbízhatatlan), és **`-Dmezo.test.use-testcontainers=true`** flaggel (a fix-DB mód versenyez és hamis hibát ad).
- Commit-alany conventional formában, a bd id-vel: `feat(companion): … (mezo-q71s)`. Minden commit végén:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- Minden felhasználónak szóló szöveg (prompt, hibaüzenet) **magyar**.

---

## File Structure

**Új fájlok:**

| Fájl | Felelősség |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/ChatHistory.java` | A `List<Turn>` → „Daniel: / Mezo:" szöveges renderelése. Egyetlen forrás a három szöveg-fogyasztónak (verdict payload, fake echo, llm-audit). |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatHistoryTest.java` | A renderer unit tesztje (tiszta függvény). |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmPromptOrderTest.java` | Az egyetlen hely, ahol a valódi adapter Spring AI prompt-sorrendje hálózat nélkül megfogható. |
| `backend/src/main/resources/db/changelog/1.0.0/script/202608161200_mezo-q71s_llm_log_conversation_history.sql` | Az audit-oszlop. |
| `docs/decisions/00NN-marked-speculation-in-chat.md` | A „jelölt spekuláció szabad" politika ADR-je. |

**Módosuló fájlok:**

| Fájl | Változás |
|---|---|
| `feature/companion/CompanionLlm.java` | `Role` enum + `Turn` record; az 5-arg `complete`/`stream` lesz absztrakt, a 4-arg default. |
| `feature/companion/llm/GeminiCompanionLlm.java` | `.messages(...)`; `CallSpec` + audit-mező. |
| `feature/companion/llm/FakeCompanionLlm.java` | Az 5-arg alak implementálása; echo `history=[…]`-val; `unmarkedClaim` a verdict JSON-ben. |
| `feature/companion/service/ChatService.java` | `SYSTEM_PROMPT` átépítés; `PreparedTurn.history`; `renderHistory` törlése. |
| `feature/companion/service/ChatStreamService.java` | `turn.history()` továbbadása a stream- és a review-hívásnak. |
| `feature/companion/advisor/CompanionAdvisorChain.java` | History átvétele és továbbadása. |
| `feature/companion/advisor/TurnVerdictCheck.java` | History a payloadban; `unmarkedClaim` kritérium. |
| `feature/companion/advisor/AdvisorRetry.java` | Hangnem-megőrző záró mondat. |
| `feature/llmlog/entity/LlmLogEntity.java`, `service/LlmCallRecord.java`, `service/LlmLogWriter.java` | `conversationHistory` mező + capping. |
| `backend/src/test/.../companion/ChatServiceIT.java`, `ChatStreamServiceIT.java`, `CompanionAdvisorChainIT.java`, `ChatStreamAdvisorIT.java` | Az echo-alak és a verdict-kulcs változásának követése + új tesztek. |
| `docs/features/companion.md` | Prompt-összeállítás, advisor, port, audit-mező. |

---

## Task 1: `ChatHistory` — a history értéktípusa és szöveges rendere

A `CompanionLlm` kapja a típusokat (a port sajátjai), a renderelés külön osztályba kerül, mert három **nem-modell** fogyasztója lesz.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/ChatHistory.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatHistoryTest.java`

**Interfaces:**
- Consumes: semmi (ez az első task).
- Produces:
  - `CompanionLlm.Role` — `enum { USER, ASSISTANT }`
  - `CompanionLlm.Turn` — `record Turn(Role role, String content)`
  - `ChatHistory.HEADER` — `String` (`"\n\nEddigi beszélgetés (legrégebbitől a legújabbig):\n"`)
  - `ChatHistory.render(List<CompanionLlm.Turn> history)` → `String` (üres listára `""`)

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatHistoryTest.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.CompanionLlm.Role;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChatHistoryTest {

    @Test
    void testRender_shouldReturnEmptyString_whenHistoryIsEmpty() {
        assertThat(ChatHistory.render(List.of())).isEmpty();
    }

    @Test
    void testRender_shouldLabelSpeakersOldestFirst_whenHistoryHasBothRoles() {
        String rendered = ChatHistory.render(List.of(
                new Turn(Role.USER, "korábbi kérdés"),
                new Turn(Role.ASSISTANT, "korábbi válasz")));

        assertThat(rendered).startsWith(ChatHistory.HEADER);
        assertThat(rendered).contains("Daniel: korábbi kérdés\n");
        assertThat(rendered).contains("Mezo: korábbi válasz\n");
        assertThat(rendered.indexOf("Daniel: korábbi kérdés"))
                .isLessThan(rendered.indexOf("Mezo: korábbi válasz"));
    }
}
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd backend && ./mvnw clean test -Dtest=ChatHistoryTest
```

Elvárt: fordítási hiba — `ChatHistory` és `CompanionLlm.Turn` nem létezik.

- [ ] **Step 3: Vedd fel a típusokat a portra**

`CompanionLlm.java` — az interfész **legelejére**, a meglévő metódusok elé:

```java
    /** Ki beszélt egy korábbi körben — a port provider-független szerepfogalma. */
    enum Role { USER, ASSISTANT }

    /** Egy lezárt korábbi üzenet. A history ezekből áll, legrégebbitől a legújabbig. */
    record Turn(Role role, String content) {}
```

- [ ] **Step 4: Írd meg a renderert**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/ChatHistory.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.CompanionLlm.Role;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;

import java.util.List;

/**
 * A beszélgetés-előzmény SZÖVEGES alakja (mezo-q71s). A modell a history-t valódi üzenetlistaként
 * kapja ({@code ChatClient.messages(..)}), ez a renderelés kizárólag a három NEM-modell fogyasztónak
 * szól, ahol egy string kell: a verdict-bíráló payloadja, a fake LLM echója és az llm-audit
 * {@code conversation_history} oszlopa. Ez a formátum korábban a system promptba került — ha valaha
 * újra ott landol, a {@code ChatServiceIT} history-szeparációs tesztje elbukik.
 */
public final class ChatHistory {

    public static final String HEADER = "\n\nEddigi beszélgetés (legrégebbitől a legújabbig):\n";

    private ChatHistory() {}

    public static String render(List<Turn> history) {
        if (history.isEmpty()) {
            return "";
        }
        StringBuilder rendered = new StringBuilder(HEADER);
        for (Turn turn : history) {
            rendered.append(turn.role() == Role.USER ? "Daniel: " : "Mezo: ")
                    .append(turn.content())
                    .append('\n');
        }
        return rendered.toString();
    }
}
```

- [ ] **Step 5: Futtasd — menjen át**

```bash
cd backend && ./mvnw clean test -Dtest=ChatHistoryTest
```

Elvárt: PASS, 2 teszt.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/ChatHistory.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatHistoryTest.java
git commit -m "feat(companion): ChatHistory value type + text renderer (mezo-q71s)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: A port multi-turn alakja + a két adapter

A lényeg a **megfordítás**: az 5-arg alak lesz absztrakt, a 4-arg default. Ez után minden fordul és minden zöld, mert a history még mindenhol üres.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java:93-103,162-208,287-297`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java:221-223,353-355,454-468`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmPromptOrderTest.java`

**Interfaces:**
- Consumes: `CompanionLlm.Role`, `CompanionLlm.Turn`, `ChatHistory.render` (Task 1).
- Produces:
  - `CompanionLlm.complete(String systemPrompt, List<Turn> history, String userMessage, List<ToolCallback> tools, Map<String,Object> toolContext)` → `String` (absztrakt)
  - `CompanionLlm.stream(String systemPrompt, List<Turn> history, String userMessage, List<ToolCallback> tools, Map<String,Object> toolContext)` → `Flux<String>` (absztrakt)
  - A 4-arg `complete`/`stream` default marad, `List.of()` history-val.
  - A fake echo alakja: `FAKE-LLM system=[…] history=[…] user=[…]` — `history=[]` üres history esetén.

- [ ] **Step 1: Írd meg a bukó prompt-sorrend tesztet**

Ez az egyetlen teszt, ami a **valódi** adapter Spring AI-viselkedését fogja meg. Kézzel írt `ChatModel` stub, nem Mockito.

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmPromptOrderTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm.Role;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.prompt.Prompt;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A Spring AI prompt-SORRENDJE nem fedhető le integrációs teszttel: az ITs a companion-fake
 * profilon futnak, ahol ez a bean nem is létezik, a fake echója pedig a HÍVÓ összeállítását
 * bizonyítja, nem a ChatClient üzenetlistáját. Egy Promptot rögzítő ChatModel stub az egyetlen
 * mód, hogy hálózat nélkül lássuk, mit küld ki az adapter (mezo-q71s).
 */
class GeminiCompanionLlmPromptOrderTest {

    /** Rögzíti a kimenő Promptot, és egy fix választ ad vissza. */
    private static final class CapturingChatModel implements ChatModel {
        private final AtomicReference<Prompt> captured = new AtomicReference<>();

        @Override
        public ChatResponse call(Prompt prompt) {
            captured.set(prompt);
            return new ChatResponse(List.of(new Generation(new AssistantMessage("ok"))));
        }
    }

    @Test
    void testComplete_shouldOrderSystemThenHistoryThenUser_whenHistoryIsGiven() {
        CapturingChatModel chatModel = new CapturingChatModel();
        GeminiCompanionLlm adapter = new GeminiCompanionLlm(
                chatModel,
                new CompanionPropertiesFixture().minimal(),
                LlmCallRecorder.NO_OP,
                new LlmCallContextHolder(),
                new GeminiUsageExtractor());

        adapter.complete("RENDSZER", List.of(
                new Turn(Role.USER, "korábbi kérdés"),
                new Turn(Role.ASSISTANT, "korábbi válasz")), "mostani kérdés", List.of(), Map.of());

        List<Message> sent = chatModel.captured.get().getInstructions();
        assertThat(sent).extracting(Message::getMessageType).containsExactly(
                MessageType.SYSTEM, MessageType.USER, MessageType.ASSISTANT, MessageType.USER);
        assertThat(sent.get(0).getText()).isEqualTo("RENDSZER");
        assertThat(sent.get(1).getText()).isEqualTo("korábbi kérdés");
        assertThat(sent.get(2).getText()).isEqualTo("korábbi válasz");
        assertThat(sent.get(3).getText()).isEqualTo("mostani kérdés");
    }
}
```

> **Megjegyzés az implementálónak:** a `CompanionPropertiesFixture` és a `LlmCallRecorder.NO_OP`
> **még nem biztos, hogy létezik ilyen néven.** Step 2 futtatása pontosan ezt fogja megmondani.
> A Step 3 első fele ezek felderítése és a teszt hozzáigazítása a valósághoz — a
> `CompanionProperties` egy record, tehát `new CompanionProperties(new Llm("gemini-2.5-flash",
> "gemini-2.5-pro"), …)` közvetlenül is példányosítható; ha a `LlmCallRecorder` no-op példánya más
> néven érhető el, használd azt. **A teszt lényegét — a négy üzenet sorrendjét — ne változtasd meg.**

- [ ] **Step 2: Futtasd — bukjon (és derítsd ki a segédtípusok valódi nevét)**

```bash
cd backend && ./mvnw clean test -Dtest=GeminiCompanionLlmPromptOrderTest
```

Elvárt: fordítási hiba (nincs 5-arg `complete`, és a fenti két segédnév közül vélhetően egyik sem stimmel).

- [ ] **Step 3: Fordítsd meg a port szignatúráit**

`CompanionLlm.java` — cseréld a mostani két absztrakt metódust erre (a Javadoc szövegét vidd át):

```java
    /**
     * One-shot completion on the cheap chat tier, with the turn's tools registered and the
     * conversation so far as REAL prior messages (mezo-q71s) — not a transcript inside the
     * system prompt. The 4-arg overload below stays for the one-shot pipeline callers.
     */
    String complete(String systemPrompt, List<Turn> history, String userMessage,
                    List<ToolCallback> tools, Map<String, Object> toolContext);

    /** Streamed twin of {@link #complete(String, List, String, List, Map)}. */
    Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                        List<ToolCallback> tools, Map<String, Object> toolContext);

    /** History-less completion — every one-shot pipeline (meal, recipe, pantry, sleep, …) rides this. */
    default String complete(String systemPrompt, String userMessage,
                            List<ToolCallback> tools, Map<String, Object> toolContext) {
        return complete(systemPrompt, List.of(), userMessage, tools, toolContext);
    }

    /** History-less stream. */
    default Flux<String> stream(String systemPrompt, String userMessage,
                                List<ToolCallback> tools, Map<String, Object> toolContext) {
        return stream(systemPrompt, List.of(), userMessage, tools, toolContext);
    }
```

A meglévő `default String complete(String, String)` és `default Flux<String> stream(String, String)` **változatlan marad** — azok a 4-arg defaultra delegálnak, ami most a 5-argra delegál.

- [ ] **Step 4: Írd át a Gemini-adaptert**

`GeminiCompanionLlm.java:93-103` — a `complete` és `stream` 5-argosra, plusz a `request(..)` helper:

```java
    @Override
    public String complete(String systemPrompt, List<Turn> history, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        CallKind kind = tools.isEmpty() ? CallKind.CHAT : CallKind.TOOL;
        CallSpec spec = CallSpec.of(kind, chatModel(), systemPrompt, userMessage);
        GeminiRoundUsage tally = new GeminiRoundUsage();
        return recorded(spec, tally,
            () -> request(systemPrompt, history, userMessage, tools, toolContext, tally)
                .call().chatResponse());
    }
```

`stream` ugyanígy kap egy `List<Turn> history` paramétert, és a belső `request(...)` hívás továbbadja.

A `request(...)` helper (`:287-297`):

```java
    private ChatClient.ChatClientRequestSpec request(String systemPrompt, List<Turn> history,
                                                     String userMessage, List<ToolCallback> tools,
                                                     Map<String, Object> toolContext,
                                                     GeminiRoundUsage tally) {
        ChatClient.ChatClientRequestSpec spec = chatClient.prompt()
            .system(systemPrompt)
            .messages(toMessages(history))
            .user(userMessage)
            .advisors(a -> a.param(GeminiRoundUsage.CONTEXT_KEY, tally));
        if (!tools.isEmpty()) {
            spec = spec.tools((Object[]) tools.toArray(ToolCallback[]::new)).toolContext(toolContext);
        }
        return spec;
    }

    /** A port provider-független Turn-jei -> spring-ai üzenetek. Üres history -> üres lista. */
    private static List<Message> toMessages(List<Turn> history) {
        return history.stream()
            .map(turn -> turn.role() == Role.USER
                ? (Message) new UserMessage(turn.content())
                : new AssistantMessage(turn.content()))
            .toList();
    }
```

Új importok: `org.springframework.ai.chat.messages.{AssistantMessage, Message, UserMessage}`,
`io.mrkuhne.mezo.feature.companion.CompanionLlm.{Role, Turn}`.

> A `spring-ai 2.0.0` jar ellenőrizve: `messages(List<Message>)` és a `new UserMessage(String)` /
> `new AssistantMessage(String)` publikus konstruktorok léteznek.

- [ ] **Step 5: Írd át a fake adaptert**

`FakeCompanionLlm.java:221` — a `complete` szignatúra 5-argos lesz, a **dispatch-lánc érintetlen**
(a `systemPrompt.startsWith(MARKER)` ágak mind maradnak), és csak a záró echo bővül (`:353`):

```java
    @Override
    public String complete(String systemPrompt, List<Turn> history, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        // ... a teljes meglévő marker-dispatch lánc VÁLTOZATLANUL ...
        return PREFIX + " system=[" + systemPrompt + "]"
                + " history=[" + ChatHistory.render(history) + "]"
                + " user=[" + userMessage + "]"
                + String.join("", toolEchoes(userMessage, tools, toolContext));
    }
```

`stream` (`:454`) ugyanígy — a `chunks` lista kap egy negyedik elemet a `system=` után:

```java
        List<String> chunks = new ArrayList<>(List.of(
            PREFIX,
            " system=[" + systemPrompt + "]",
            " history=[" + ChatHistory.render(history) + "]",
            " user=[" + userMessage + "]"));
```

- [ ] **Step 6: Futtasd a sorrend-tesztet — menjen át**

```bash
cd backend && ./mvnw clean test -Dtest=GeminiCompanionLlmPromptOrderTest
```

Elvárt: PASS. **Ha a sorrend nem `[SYSTEM, USER, ASSISTANT, USER]`** — például a `.user(..)` a
`.messages(..)` elé kerül —, akkor a spec §3 feltevése hamis volt: **ne igazítsd a tesztet a
valósághoz**, hanem építsd a history-t közvetlenül a `messages(..)` listába (a user-üzenetet is
utolsó `UserMessage`-ként, `.user(..)` nélkül), és jegyezd fel a felfedezést a task jelentésében.

- [ ] **Step 7: Futtasd a teljes companion IT-készletet**

```bash
cd backend && ./mvnw clean test -Dtest='Companion*IT,Chat*IT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS. A history mindenhol üres, de az echo már tartalmaz egy ` history=[]` szegmenst — ha
egy IT szigorú string-egyezést vár az echóra, javítsd azt az assertiont.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): multi-turn history in the CompanionLlm port (mezo-q71s)

The 5-arg form becomes abstract, the 4-arg one a default — the 10+ one-shot
pipeline adapters stay untouched. Gemini maps Turns onto ChatClient.messages().

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: A history kiköltözik a system promptból — chat, stream, advisor egyszerre

Ez a viselkedésváltás. Egy commitban kell mennie, mert a history-t a bíráló is a system promptból olvassa: ha csak a chat változna, az advisor megvakulna a beszélgetésre.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:75,92,101-113,134-178,180-198`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java:80,98`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/CompanionAdvisorChain.java:41-70`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/TurnVerdictCheck.java:48-53`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java:144-254`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceIT.java`

**Interfaces:**
- Consumes: `ChatHistory.render`, `CompanionLlm.Turn/Role` (Task 1), az 5-arg port (Task 2).
- Produces:
  - `ChatService.PreparedTurn(UUID conversationId, UUID userMessageId, String systemPrompt, List<Turn> history, String userContent)`
  - `CompanionAdvisorChain.complete(String systemPrompt, List<Turn> history, String userMessage, List<ToolCallback> tools, Map<String,Object> toolContext, ToolCallAudit audit)` → `AdvisedAnswer`
  - `CompanionAdvisorChain.review(String systemPrompt, List<Turn> history, String userMessage, String answer, List<ToolCallback> tools, Map<String,Object> toolContext, ToolCallAudit audit)` → `AdvisedAnswer`
  - `TurnVerdictCheck.check(String turnSystemPrompt, List<Turn> history, String userMessage, String answer, List<String> toolCallNames)` → `List<AdvisorViolation>`

- [ ] **Step 1: Írd meg az új szeparációs tesztet (a lényegi bizonyíték)**

`ChatServiceIT.java` — új teszt a fájl végére, a záró `}` elé:

```java
    @Test
    void testSendMessage_shouldKeepHistoryOutOfSystemPrompt_whenPriorTurnsExist() {
        UUID userId = databasePopulator.populateUser("chat-separation@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");
        messagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "korábbi válasz");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("és most?"));

        // A fake echója a hívó összeállítását tükrözi: system=[...] history=[...] user=[...]
        String echoed = answer.getContent();
        String systemBlock = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        String historyBlock = echoed.substring(echoed.indexOf("history=["), echoed.indexOf("] user=["));

        // Ez a teszt bukik el, ha valaki visszacsempészi a transcriptet a system promptba.
        assertThat(systemBlock).doesNotContain("Eddigi beszélgetés");
        assertThat(systemBlock).doesNotContain("Daniel: korábbi kérdés");
        assertThat(systemBlock).doesNotContain("Mezo: korábbi válasz");
        assertThat(historyBlock).contains("Daniel: korábbi kérdés");
        assertThat(historyBlock).contains("Mezo: korábbi válasz");
        // Az aktuális üzenet a user-paraméter, nem a history része.
        assertThat(historyBlock).doesNotContain("Daniel: és most?");
        assertThat(echoed).contains("user=[és most?]");
    }
```

- [ ] **Step 1b: Ugyanez a streamelt útra**

A streamelt út külön orchesztráció (`prepareTurn` → `stream` → `completeTurn`), saját hibalehetőséggel:
könnyű elfelejteni a `turn.history()`-t átadni ott, ahol a chunkolt echo úgyis „működni látszik".

`ChatStreamServiceIT.java` végére — **előbb olvasd el a fájl meglévő tesztjeit**, és a `delta`
eseményekből való szövegösszefűzést az ott már használt mintával csináld (a fake fix chunkokban
streamel: `FAKE-LLM`, ` system=[…]`, ` history=[…]`, ` user=[…]`):

```java
    @Test
    void testStreamMessage_shouldPassHistoryAsPriorMessages_whenPriorTurnsExist() {
        UUID userId = databasePopulator.populateUser("stream-history@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");

        // A delta-eseményekből összefűzött teljes szöveg — a fájl meglévő mintája szerint.
        String streamed = collectDeltas(userId, conversation.getId(), "és most?");

        String systemBlock = streamed.substring(streamed.indexOf("system=["), streamed.indexOf("] history=["));
        String historyBlock = streamed.substring(streamed.indexOf("history=["), streamed.indexOf("] user=["));
        assertThat(systemBlock).doesNotContain("Daniel: korábbi kérdés");
        assertThat(historyBlock).contains("Daniel: korábbi kérdés");
    }
```

> A `collectDeltas(...)` helyére a fájlban már meglévő delta-gyűjtő segédet használd; ha nincs
> ilyen, írj egy privát helpert a teszt fölé ugyanabból a `StepVerifier`/`Flux` mintából, amit a
> szomszédos tesztek használnak. **Ne találj ki új streamelési mintát.**

- [ ] **Step 2: Futtasd — bukjanak**

```bash
cd backend && ./mvnw clean test -Dtest='ChatServiceIT#testSendMessage_shouldKeepHistoryOutOfSystemPrompt_whenPriorTurnsExist,ChatStreamServiceIT#testStreamMessage_shouldPassHistoryAsPriorMessages_whenPriorTurnsExist' -Dmezo.test.use-testcontainers=true
```

Elvárt: FAIL — a `systemBlock` mindkettőben tartalmazza a beszélgetést.

- [ ] **Step 3: `ChatService` — history a `PreparedTurn`-be, ki a promptból**

Töröld a `HISTORY_HEADER` konstanst (`:75`) és a `renderHistory` metódust (`:187-198`).

`PreparedTurn` (`:92`):

```java
    /** One prepared chat turn — everything the LLM call needs, produced inside one transaction. */
    public record PreparedTurn(UUID conversationId, UUID userMessageId, String systemPrompt,
                               List<Turn> history, String userContent) {}
```

`prepareTurn` (`:101-113`) és `sendMessage` (`:134-145`) prompt-összeállítása — a `renderHistory(...)`
tag **eltűnik a láncból**, a window `Turn`-ökké képződik:

```java
        String systemPrompt = SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, LocalDate.now())
                + knowledgeFactService.renderPromptBlock(userId)
                + knowledgeFactService.renderNewPatternFactsBlock(userId);
        List<Turn> history = toTurns(loadWindow(userId, conversationId));
```

Új privát helper a `loadWindow` mellé:

```java
    /** Az ablak entitásai -> a port provider-független Turn-jei, legrégebbitől a legújabbig. */
    private static List<Turn> toTurns(List<AiMessageEntity> window) {
        return window.stream()
                .map(message -> new Turn(
                        AiMessageEntity.ROLE_USER.equals(message.getRole()) ? Role.USER : Role.ASSISTANT,
                        message.getContent()))
                .toList();
    }
```

`prepareTurn` visszatérése: `new PreparedTurn(conversationId, userRow.getId(), systemPrompt, history, request.getContent())`.

`sendMessage` LLM-hívásai (`:158-169`) a history-t is átadják:

```java
        if (chain != null) {
            AdvisedAnswer advised = llmCallContextHolder.runWith(turnContext,
                    () -> chain.complete(systemPrompt, history, request.getContent(),
                            toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit), audit));
            answer = advised.answer();
            degraded = advised.degraded();
        } else {
            answer = llmCallContextHolder.runWith(turnContext,
                    () -> companionLlm.complete(systemPrompt, history, request.getContent(),
                            toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)));
        }
```

Új importok: `io.mrkuhne.mezo.feature.companion.CompanionLlm.{Role, Turn}`.

- [ ] **Step 4: `ChatStreamService` — továbbadás**

`:80`:

```java
                        () -> companionLlm.stream(turn.systemPrompt(), turn.history(), turn.userContent(),
                                toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)))
```

`:98`:

```java
                        AdvisedAnswer advised = chain.review(turn.systemPrompt(), turn.history(),
                                turn.userContent(), finalAnswer, toolRegistry.callbacks(audit),
                                toolRegistry.toolContext(userId, audit), audit);
```

- [ ] **Step 5: `CompanionAdvisorChain` — history átvétel és továbbadás**

```java
    /** Sync path: first attempt + review in one call. */
    public AdvisedAnswer complete(String systemPrompt, List<Turn> history, String userMessage,
            List<ToolCallback> tools, Map<String, Object> toolContext, ToolCallAudit audit) {
        String answer = companionLlm.complete(systemPrompt, history, userMessage, tools, toolContext);
        return review(systemPrompt, history, userMessage, answer, tools, toolContext, audit);
    }

    /** Streamed path: attempt-1 already delivered as deltas — review it, retry non-streamed if needed. */
    public AdvisedAnswer review(String systemPrompt, List<Turn> history, String userMessage,
            String answer, List<ToolCallback> tools, Map<String, Object> toolContext, ToolCallAudit audit) {
        long startedAt = System.currentTimeMillis();
        List<AdvisorViolation> violations = runChecks(systemPrompt, history, userMessage, answer, audit);
        int retries = 0;
        while (!violations.isEmpty() && retries < properties.advisors().maxRetries()) {
            retries++;
            String retryPrompt = systemPrompt + AdvisorRetry.block(violations);
            answer = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_advisor", "retry", null, null),
                    // a korrekciós kör ugyanazt a beszélgetést látja, mint az eredeti
                    () -> companionLlm.complete(retryPrompt, history, userMessage, tools, toolContext));
            violations = runChecks(systemPrompt, history, userMessage, answer, audit);
        }
        // ... a degraded/log rész változatlan ...
    }

    private List<AdvisorViolation> runChecks(String systemPrompt, List<Turn> history,
            String userMessage, String answer, ToolCallAudit audit) {
        Optional<AdvisorViolation> clinical = clinicalOutputCheck.check(answer);
        if (clinical.isPresent()) {
            return List.of(clinical.get());
        }
        return turnVerdictCheck.check(systemPrompt, history, userMessage, answer, audit.callNames());
    }
```

- [ ] **Step 6: `TurnVerdictCheck` — a bíráló újra lássa a beszélgetést**

`:48-53`:

```java
    public List<AdvisorViolation> check(String turnSystemPrompt, List<Turn> history,
            String userMessage, String answer, List<String> toolCallNames) {
        // A history már NEM része a system promptnak (mezo-q71s) — külön kell renderelni, különben
        // a bíráló megvakul a beszélgetésre és hamis redundancia/grounding ítéleteket hoz.
        String payload = "KONTEXTUS:\n" + turnSystemPrompt
                + ChatHistory.render(history)
                + "\n\nESZKÖZHÍVÁSOK: " + (toolCallNames.isEmpty() ? "nincs" : String.join(", ", toolCallNames))
                + "\n\nDaniel üzenete: " + userMessage
                + "\n\nMEZO VÁLASZA:\n" + answer;
        // ... a hívás és a parse változatlan ...
    }
```

- [ ] **Step 7: Igazítsd a meglévő ChatServiceIT assertionöket**

Négy teszt hivatkozik a régi elrendezésre. A javítás mindegyikben ugyanaz a mozdulat: a
„Eddigi beszélgetés" pozíció-alapú assertionjeit a `history=[…]` blokkra kell irányítani.

- `:144` `testSendMessage_shouldInjectContextSnapshotBetweenVoiceAndHistory_whenSending` — nevezd át
  `…BetweenVoiceAndFacts_whenSending`-re; a `history` index-sort töröld, helyette:
  ```java
        assertThat(snapshot).isGreaterThan(voice);
        assertThat(echoed).contains("[Profil]").contains("[Regeneráció]");
        assertThat(echoed).contains("pillanatkép — " + java.time.LocalDate.now());
  ```
- `:164` `testSendMessage_shouldInjectFactsBetweenSnapshotAndHistory_whenConfirmedFactsExist` — nevezd át
  `…AfterSnapshot_whenConfirmedFactsExist`-re; a `history` index-sort és a rá vonatkozó
  `isGreaterThan(facts)` sort töröld, a `facts > snapshot` assertion marad.
- `:226` `testSendMessage_shouldIncludeCompanionVoiceAndUserMessageInPrompt_whenCalled` — az
  utolsó sor lecserélése:
  ```java
        assertThat(answer.getContent()).contains("history=[]");
  ```
- `:240` `testSendMessage_shouldWindowHistoryIntoPrompt_whenPriorTurnsExist` — a `contains("Eddigi
  beszélgetés")` marad (a renderelt history-blokkban van), a többi assertion változatlanul jó.

- [ ] **Step 8: Futtasd a companion IT-készletet**

```bash
cd backend && ./mvnw clean test -Dtest='Companion*IT,Chat*IT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS, benne az új szeparációs teszt.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): history travels as real prior messages, not a system-prompt transcript (mezo-q71s)

Chat, stream and the advisor chain move together — the verdict judge renders
the history into its own payload so it stays sighted on the conversation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: llm-audit — `conversation_history` oszlop

Az audit ne veszítsen fidelitást. A `system_prompt` oszlop szemantikája **nem változik**.

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608161200_mezo-q71s_llm_log_conversation_history.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (a fájl végére)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/entity/LlmLogEntity.java:160-166`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmCallRecord.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogWriter.java:116-133`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java` (`CallSpec` + a chat-utak)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlmRecordingTest.java` (új tesztek), `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmLogWriterIT.java` (új tesztek)

**Interfaces:**
- Consumes: `ChatHistory.render` (Task 1), az 5-arg adapter (Task 2), a history-t átadó `ChatService` (Task 3).
- Produces: `LlmCallRecord.conversationHistory()` → `String` (nullable); `LlmLogEntity.getConversationHistory()`.

> **Végrehajtás közben javítva (nem az eredeti terv):** ez a lépés eredetileg egy
> `ChatServiceIT`-be tett tesztet írt elő. Ez szerkezetileg lehetetlen: `ChatServiceIT` a
> `companion-fake` profilon fut, ahol `FakeCompanionLlm` van kiválasztva és `GeminiCompanionLlm`
> — az egyetlen hely, ahonnan `LlmCallRecorder` valaha meghívódik — **nem is létezik beanként**.
> Egy `ChatServiceIT`-beli assertion tehát soha nem tudná elérni azt a kódutat, amit bizonyítania
> kellene volna. A bizonyíték helyette két szinten fut: adapter-szinten
> (`GeminiCompanionLlmRecordingTest`, hálózat nélkül, egy `Prompt`-ot rögzítő `ChatModel` stubbal
> — a Task 2 verifikációjának ugyanaz az eszköze) és writer/DB-szinten (`LlmLogWriterIT`, a
> `persist(...)` közvetlen hívásával, a meglévő minta szerint). A lenti lépések ezt a helyes
> elhelyezést követik.

- [ ] **Step 1: Írd meg a bukó teszteket**

**(a) Adapter-szint — `GeminiCompanionLlmRecordingTest.java` végére**, a fájl meglévő
`CapturingRecorder`/`chatModel(...)` fixture-jeit felhasználva:

```java
    @Test
    void testComplete_shouldRecordConversationHistorySeparateFromSystemPrompt_whenPriorTurnsExist() {
        GeminiCompanionLlm llm = adapter(chatModel(cannedResponse("hello")));
        List<CompanionLlm.Turn> history = List.of(
            new CompanionLlm.Turn(CompanionLlm.Role.USER, "korábbi kérdés"),
            new CompanionLlm.Turn(CompanionLlm.Role.ASSISTANT, "korábbi válasz"));

        llm.complete("sys", history, "és most?", List.of(), Map.of());

        LlmCallRecord record = recorder.last();
        assertThat(record.conversationHistory()).contains("Daniel: korábbi kérdés");
        assertThat(record.systemPrompt()).doesNotContain("Daniel: korábbi kérdés");
    }
```

**(b) Writer/DB-szint — `LlmLogWriterIT.java` végére**, a fájl meglévő `ownerId()`/`LlmCallRecord.builder()`
mintáját követve:

```java
    @Test
    void testPersist_shouldMapConversationHistory_whenChatCallHasPriorTurns() {
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT).requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(10)
            .systemPrompt("sys").conversationHistory("Daniel: korábbi kérdés\n").userMessage("és most?")
            .context(new LlmCallContext("companion_chat", "chat_turn", null, null))
            .build();

        llmLogWriter.persist(new LlmCallEvent(rec, ownerId(), Instant.parse("2026-07-28T10:00:00Z")));

        LlmLogEntity row = llmLogRepository.findAll().getFirst();
        assertThat(row.getConversationHistory()).contains("Daniel: korábbi kérdés");
        assertThat(row.getSystemPrompt()).doesNotContain("Daniel: korábbi kérdés");
    }
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd backend && ./mvnw clean test -Dtest='GeminiCompanionLlmRecordingTest,LlmLogWriterIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: fordítási hiba — nincs `conversationHistory()`/`getConversationHistory()`.

- [ ] **Step 3: Liquibase changeset**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202608161200_mezo-q71s_llm_log_conversation_history.sql`:

```sql
-- mezo-q71s: a chat beszélgetés-előzménye valódi üzenetlistaként megy a modellnek, nem a system
-- promptba renderelve. Enélkül az audit elveszítené — a system_prompt oszlop szemantikája viszont
-- nem változhat (az pontosan azt tartalmazza, amit a modell system promptként kapott), ezért kap
-- a beszélgetés a saját oszlopát. Nullable: minden nem-chat hívás (pipeline-ok) null-t hagy benne.
-- Az oszlopnév szándékosan nem history_text: a tábla neve már llm_log_history, ahol a "history" a
-- hívásnaplót jelenti.

alter table llm_log_history add column conversation_history text;
```

Majd `1.0.0_master.yml` **végére**:

```yaml
  - changeSet:
      id: "1.0.0:202608161200_mezo-q71s_llm_log_conversation_history"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608161200_mezo-q71s_llm_log_conversation_history.sql
```

- [ ] **Step 4: Entitás + record + writer**

`LlmLogEntity.java`, a `system_prompt` mező mellé (a `// ── payload ──` blokkba):

```java
    /** mezo-q71s: a chat beszélgetés-előzménye, amit a modell PRIOR ÜZENETEKKÉNT kapott (nem a
     *  system prompt része). Nem-chat hívásokon null. */
    @Column(name = "conversation_history", columnDefinition = "text")
    private String conversationHistory;
```

`LlmCallRecord.java` — a `systemPrompt` mező után:

```java
    String conversationHistory,
```

`LlmLogWriter.java:121-133` — az új mező részt vesz a capping-ben és a `payload_bytes`-ban:

```java
        int cap = llmLogProperties.maxPayloadChars();
        long bytes = utf8Length(record.systemPrompt())
            + utf8Length(record.conversationHistory())
            + utf8Length(record.userMessage())
            + utf8Length(record.responseText());
        // ... a payloadBytes beállítás változatlan ...
        entity.setSystemPrompt(cap(record.systemPrompt(), cap));
        entity.setConversationHistory(cap(record.conversationHistory(), cap));
        entity.setUserMessage(cap(record.userMessage(), cap));
        entity.setResponseText(cap(record.responseText(), cap));
        entity.setTruncated(isOverCap(record.systemPrompt(), cap)
            || isOverCap(record.conversationHistory(), cap)
            || isOverCap(record.userMessage(), cap)
            || isOverCap(record.responseText(), cap));
```

> A `bytes` összeadás pontos meglévő alakját olvasd ki a fájlból (`:122-126`) és bővítsd —
> ne írd újra a környező sorokat.

- [ ] **Step 5: A Gemini-adapter töltse ki**

`GeminiCompanionLlm.java` — a `CallSpec` record kap egy `String conversationHistory` mezőt (a
`userMessage` után), a `CallSpec.of(...)` factory `null`-t ad neki, a `baseRecord(...)` pedig
átadja: `.conversationHistory(spec.conversationHistory())`.

A két chat-út (`complete` és `stream`) a `CallSpec.of(...)` helyett a teljes konstruktort hívja a
renderelt history-val:

```java
        CallSpec spec = new CallSpec(kind, chatModel(), systemPrompt,
            ChatHistory.render(history), userMessage, null, null, null, false);
```

Minden más út (`completeSmart`, vision, audio) `null`-t hagy a mezőben — a `CallSpec.of(...)`
factory intézi.

- [ ] **Step 6: Futtasd**

```bash
cd backend && ./mvnw clean test -Dtest='GeminiCompanionLlmRecordingTest,LlmLog*IT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/llmlog backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/llmlog
git commit -m "feat(llmlog): conversation_history column keeps the chat audit whole (mezo-q71s)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: A persona átépítése

Itt születik a hangnem. Kód alig — a prompt a termék.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:48-73` (`SYSTEM_PROMPT`), `:101-113`, `:134-145` (a záró emlékeztető)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`

**Interfaces:**
- Consumes: a Task 3 utáni `ChatService` prompt-összeállítás.
- Produces: `ChatService.TONE_REMINDER` — `public static final String`, a teljes összeállított
  prompt záró blokkja. **`public`, nem package-private:** a `ChatServiceIT` az
  `…feature.companion` csomagban van, a `ChatService` viszont `…feature.companion.service`-ben —
  ugyanezért `public` a `TurnVerdictCheck.VERDICT_MARKER` és az `AdvisorRetry.RETRY_MARKER` is.
  (A `SYSTEM_PROMPT` marad package-private: arra a tesztek string-literálokkal assertálnak.)

- [ ] **Step 1: Írd meg a bukó teszteket**

`ChatServiceIT.java` végére:

```java
    @Test
    void testSendMessage_shouldDropTerseInstructionAndCarryVoiceRules_whenAssemblingPrompt() {
        UUID userId = databasePopulator.populateUser("chat-voice-rules@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        String echoed = answer.getContent();
        // A "tömören" utasítás okozta a lélektelenül rövid válaszokat — nem térhet vissza.
        assertThat(echoed).doesNotContain("Válaszolj magyarul, tömören");
        assertThat(echoed).contains("[Hogyan beszélsz]");
        assertThat(echoed).contains("[Mit szabad állítani]");
        // A megőrzött guárdok
        assertThat(echoed).contains("retatrutid");
        assertThat(echoed).contains("[Eszköz-útmutató]");
    }

    @Test
    void testSendMessage_shouldEndPromptWithToneReminder_whenAssemblingPrompt() {
        UUID userId = databasePopulator.populateUser("chat-tone-tail@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        factPopulator.fact(userId, "Laktózérzékeny", "health", 2);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        String echoed = answer.getContent();
        String systemBlock = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        // A recency-pozíció a lényeg: az emlékeztető a futásidejű adatblokkok UTÁN áll.
        assertThat(systemBlock.indexOf(ChatService.TONE_REMINDER))
                .isGreaterThan(systemBlock.indexOf("MEGERŐSÍTETT TÉNYEK"));
        assertThat(systemBlock).endsWith(ChatService.TONE_REMINDER);
    }
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd backend && ./mvnw clean test -Dtest='ChatServiceIT#testSendMessage_shouldDropTerseInstructionAndCarryVoiceRules_whenAssemblingPrompt+testSendMessage_shouldEndPromptWithToneReminder_whenAssemblingPrompt' -Dmezo.test.use-testcontainers=true
```

Elvárt: fordítási hiba (`TONE_REMINDER` nincs), majd assertion-hiba.

- [ ] **Step 3: Írd át a `SYSTEM_PROMPT`-ot**

`ChatService.java:48-73` teljes cseréje. A Javadoc frissül, a `[Eszköz-útmutató]` blokk **betűre
változatlan** (a `companion_tool_conventions.md` szerint szinkronban kell maradnia a `@Tool`
leírásokkal):

```java
    /**
     * Static Hungarian companion voice — IDENT-1 (companion, not coach), the clinical guard and
     * grounding-lite from the design spec §6. V0.3 appends the context snapshot below; V1.1 adds
     * the knowledge facts. Ends with the {@code [Eszköz-útmutató]} question-type→tool routing hint
     * (mezo-xixu) — keep it in sync with the {@code @Tool} descriptions per
     * {@code docs/references/companion_tool_conventions.md}. Also carries a tool-call timing rule
     * (mezo-280): the routing hint says WHICH tool, this says WHEN.
     *
     * <p>mezo-q71s: named blocks instead of one instruction stream, and the voice block states
     * BEHAVIOUR, not adjectives — "legyél barátságos" is inert on the cheap tier, "listát csak
     * akkor, ha…" is not. {@code [Mit szabad állítani]} encodes the marked-speculation policy
     * (see the ADR): a hunch is allowed if it is linguistically marked; an invented number is not,
     * marked or otherwise. The advisor's {@code unmarkedClaim} check is the enforcement half —
     * keep the two in sync.
     */
    static final String SYSTEM_PROMPT = """
            [Ki vagy]
            Te vagy a mezo, Daniel személyes egészség- és teljesítmény-társa.
            Együtt dolgoztok: többes szám első személy („nézzük meg", „ezt visszük ma") — társ vagy, nem edző.
            Megfigyelsz és javasolsz, sosem osztályozol és sosem moralizálsz.

            [Hogyan beszélsz]
            Beszélgetsz, nem jelentést írsz. Élő mondatokban válaszolj; listát csak akkor használj, \
            ha Daniel listát kért, vagy ha négynél több egyenrangú tétel van.
            A válasz hossza kövesse a kérdést: egy konkrét tényre egy-két mondat, egy nyitott vagy \
            elgondolkodtató kérdésre valódi bekezdés. Ne told fel, de ne is csonkold le.
            Van véleményed. Ha feltűnik valami az adatban, mondd ki, hogy feltűnt, és hogy szerinted mit jelent.
            Ha a válasz után tényleg érdekel valami, kérdezz vissza — de csak valódi kérdést; \
            udvariassági záró kérdést soha ne tegyél fel.
            Építs arra, ami már elhangzott a beszélgetésben; ne kezdd újra minden körben.

            [Mit szabad állítani]
            Sejtésed, hipotézised lehet, és ki is mondhatod — de jelöld meg nyelvileg: \
            „tippelek", „erős a gyanúm", „lehet, hogy", „ezt csak sejtem".
            Konkrét számot, dátumot vagy múltbeli adatot viszont CSAK akkor mondj, ha a kontextusból, \
            egy eszközhívásból vagy Daniel üzenetéből származik. Adatot kitalálni akkor is tilos, ha megjelölöd.
            Ha valamit nem tudsz, mondd ki őszintén, hogy nem tudod.

            [Példa a hangnemre]
            Kérdés: „hogy állok a súllyal?"
            ROSSZ: „Aktuális: 88,4 kg. 7 napos trend: -0,6 kg. Cél: 85 kg."
            JÓ: „88,4 — a héten fél kilót lement, ami pont a tervezett ütem. Ami engem jobban érdekel: \
            múlt héten megállt, most meg simán viszi tovább. Tippelem, hogy az alvás a különbség, \
            de ezt tényleg csak sejtem.”
            (A példában minden szám a kontextusból jött volna — a formát másold, ne a számokat.)

            [Tiltás]
            Gyógyszer adagolására (pl. retatrutid) vonatkozó változtatást SOHA ne javasolj — az orvosi döntés.

            [Eszközhasználat]
            Múltbeli vagy összesítő kérdéshez (edzések, étkezés, súly, alvás, protokoll, gyógyszerciklus) \
            használd a kapott tool-okat — a pillanatkép csak a mai napot mutatja; tool nélkül ne találgass.
            Ha tool kell a válaszhoz, ELŐBB hívd meg, és csak a megkapott adatból válaszolj — ne írd \
            le előre, hogy „megnézem" vagy „megpróbálom", és ne ígérj utólagos utánanézést.
            Válaszolj magyarul.

            [Eszköz-útmutató] — kérdéstípus → tool (ne találgass, hívd meg a megfelelőt):
            - PR / rekord / „megdöntöm?" → get_exercise_records
            - mai/holnapi/heti edzésterv, mezociklus → get_training_plan
            - múltbeli edzés/sport/futás → get_training_log | súlytrend, fogyás ütem → get_weight_trend
            - alvás, alvási cél, közérzet (energia/stressz) → get_recovery
            - gyógyszer, reta-ciklus → get_medication
            - recept, mit főzzek → get_recipes | mi van a kamrában → get_pantry
            - napi/heti étkezés, makró, víz → get_fuel_log
            - supplement, protokoll → get_protocol
            - cél, kalóriacél, heti ütem → get_goal
            - XP, szint, skill, streak → get_growth | napi rutin, küldetés, szokás → get_daily_practice
            - minták, „mit vettél észre rólam" → get_insights (csak megerősített minták; predikció/kísérlet még nem elérhető)
            - hasonló korábbi nap → find_similar_past_days""";

    /**
     * mezo-q71s: a persona a prompt TETEJÉN áll, alatta a futásidejű adatblokkok (pillanatkép,
     * tények, felismerések). Ez a két sor a recency-ellensúly — az utolsó dolog, amit a modell a
     * saját válasza előtt olvas.
     */
    public static final String TONE_REMINDER = """

            [Emlékeztető] Ez beszélgetés Daniellel, nem adatlekérdezés. \
            A fenti adatblokk nyersanyag, nem a válasz formája.""";
```

- [ ] **Step 4: Fűzd a promptlánc végére**

`prepareTurn` és `sendMessage` prompt-összeállításában (mindkét helyen) a lánc utolsó tagja:

```java
        String systemPrompt = SYSTEM_PROMPT
                + contextSnapshotAssembler.render(userId, LocalDate.now())
                + knowledgeFactService.renderPromptBlock(userId)
                + knowledgeFactService.renderNewPatternFactsBlock(userId)
                + TONE_REMINDER;
```

- [ ] **Step 5: Futtasd a companion készletet**

```bash
cd backend && ./mvnw clean test -Dtest='Companion*IT,Chat*IT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS. A `testSendMessage_shouldIncludeCompanionVoiceAndUserMessageInPrompt_whenCalled`
a `"Te vagy a mezo"` szövegre assertál — az megmaradt a `[Ki vagy]` blokkban.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java
git commit -m "feat(companion): rebuild the persona prompt into named behaviour blocks (mezo-q71s)

Drops 'Válaszolj magyarul, tömören' (the direct cause of the skeletal answers),
adds voice rules stated as behaviour, the marked-speculation policy, a contrast
example, and a recency tone reminder after the runtime data blocks.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Advisor — jelöletlen állítás, és a hangnem védelme retry közben

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/TurnVerdictCheck.java:35-46,63-71`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/AdvisorRetry.java:19-22`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java:422-431`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionAdvisorChainIT.java`

**Interfaces:**
- Consumes: a Task 3 utáni `TurnVerdictCheck.check(...)` szignatúra.
- Produces:
  - `TurnVerdictCheck.TurnVerdict(boolean redundantQuestion, boolean unmarkedClaim, String reason)`
  - Az `AdvisorViolation` check-neve `"grounding"` helyett `"unmarked"`.
  - `FakeCompanionLlm.MARKED_SPECULATION` — `String` sentinel (`"[fake-marked-spec]"`), amire a fake verdict TISZTA ítéletet ad, hogy a „jelölt spekuláció nem sértés" eset IT-vel bizonyítható legyen.

- [ ] **Step 1: Írd meg a bukó tesztet**

`CompanionAdvisorChainIT.java` végére:

```java
    @Test
    void testSendMessage_shouldNotRetry_whenSpeculationIsLinguisticallyMarked() {
        UUID userId = databasePopulator.populateUser("advisor-marked@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(userId, conversation.getId(),
                request("kérdés " + FakeCompanionLlm.MARKED_SPECULATION));

        // A jelölt sejtés a mezo-q71s politika szerint MEGENGEDETT — nem indít korrekciós kört.
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
        assertThat(response.getDegraded()).isFalse();
    }
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd backend && ./mvnw clean test -Dtest=CompanionAdvisorChainIT#testSendMessage_shouldNotRetry_whenSpeculationIsLinguisticallyMarked -Dmezo.test.use-testcontainers=true
```

Elvárt: fordítási hiba — `MARKED_SPECULATION` nem létezik.

- [ ] **Step 3: Írd át a verdict-kritériumot**

`TurnVerdictCheck.java:35-46`:

```java
    static final String VERDICT_PROMPT = VERDICT_MARKER + """
            . Bíráld el a Mezo asszisztens válaszát az alábbi szempontok szerint.
            1) redundantQuestion: rákérdez-e a válasz olyasmire, amire a kontextus MEGERŐSÍTETT TÉNYEK blokkja már választ ad?
            2) unmarkedClaim: állít-e a válasz MAGABIZTOSAN, JELÖLÉS NÉLKÜL konkrét múltbeli adatot vagy számot, amit sem a kontextus, sem a felsorolt eszközhívások, sem Daniel üzenete nem támaszt alá? Ha a válasz nyelvileg jelöli a bizonytalanságot („tippelek", „gyanítom", „lehet, hogy", „ezt csak sejtem"), az NEM sértés — a jelölt sejtés megengedett. Kitalált konkrét szám viszont jelöléssel is sértés. A kontextusban szereplő adatokból számolt/becsült érték alátámasztottnak számít.
            Válaszolj KIZÁRÓLAG ezzel a JSON objektummal, magyarázat nélkül:
            {"redundantQuestion":true|false,"unmarkedClaim":true|false,"reason":"rövid indoklás"}""";
```

`record TurnVerdict(boolean redundantQuestion, boolean unmarkedClaim, String reason) {}`

`:63-71`:

```java
        if (verdict.unmarkedClaim()) {
            violations.add(new AdvisorViolation("unmarked", verdict.reason()));
        }
```

A fail-open ág `new TurnVerdict(false, false, "")` — változatlan.

- [ ] **Step 4: Védd meg a hangnemet a korrekciós körben**

`AdvisorRetry.java:19-22`:

```java
        return block.append("""
                Szabályok: ne kérdezz rá már megerősített tényre; konkrét adatot csak a kontextusból, \
                az eszközhívásokból vagy Daniel üzenetéből állíts — jelöletlen, magabiztos állítás \
                kitalált adatról nem megy (jelölt sejtés viszont igen); Rx gyógyszer adagolásának \
                módosítását soha ne javasold.
                A hangnem NE változzon — ugyanaz az élő, beszélgetős stílus; a javítás kizárólag a \
                fent megjelölt problémára vonatkozzon.""").toString();
```

- [ ] **Step 5: Igazítsd a fake verdict-generátort**

`FakeCompanionLlm.java` — új sentinel a `VERDICT_BROKEN` mellé:

```java
    /** Scripted verdicts (mezo-q71s): a MARKED speculation is clean — the policy's IT anchor. */
    public static final String MARKED_SPECULATION = "[fake-marked-spec]";
```

`verdictAnswer(...)` (`:422-431`) — a JSON kulcs átnevezése, és a jelölt-spekuláció ág:

```java
    private String verdictAnswer(String userMessage) {
        if (userMessage.contains(VERDICT_BROKEN)) {
            return "ez nem json";
        }
        // mezo-q71s: a jelölt sejtés kifejezetten TISZTA ítéletet kap — ez rögzíti a politikát
        // a fake oldalán is, nem csak a valódi bíráló promptjában.
        if (userMessage.contains(MARKED_SPECULATION)) {
            return "{\"redundantQuestion\":false,\"unmarkedClaim\":false,\"reason\":\"jelölt sejtés\"}";
        }
        boolean retryRound = userMessage.contains(AdvisorRetry.RETRY_MARKER);
        if (userMessage.contains(VIOLATE_ALWAYS) || (userMessage.contains(VIOLATE_ONCE) && !retryRound)) {
            return "{\"redundantQuestion\":true,\"unmarkedClaim\":false,\"reason\":\"ismert tényre kérdez rá\"}";
        }
        return "{\"redundantQuestion\":false,\"unmarkedClaim\":false,\"reason\":\"\"}";
    }
```

- [ ] **Step 6: Futtasd az advisor-készletet**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionAdvisor*IT,ChatStreamAdvisorIT,Chat*IT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): advisor punishes unmarked claims, not speculation (mezo-q71s)

ungroundedClaim -> unmarkedClaim: a linguistically marked hunch is allowed, an
invented number never is. The corrective re-prompt now defends the tone instead
of flattening every retried answer.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Dokumentáció + a teljes gate

A CLAUDE.md szerint a munka nem kész, amíg nem hagy nyomot a `docs/`-ban.

**Files:**
- Create: `docs/decisions/00NN-marked-speculation-in-chat.md`
- Modify: `docs/features/companion.md`

**Interfaces:**
- Consumes: minden korábbi task.
- Produces: semmi kód.

- [ ] **Step 1: Írd meg az ADR-t**

Előbb derítsd ki a következő szabad sorszámot:

```bash
ls docs/decisions/ | tail -5
```

> ⚠️ **A mappában jelenleg KÉT 0026-os ADR van** (`0026-freeze-nutrient-facts-per-line.md` és
> `0026-today-ios-list-language.md`). A következő szabad szám tehát **0027**, nem a „legnagyobb+1"
> naiv számolás eredménye — ellenőrizd. Az ütközést magát ne javítsd, az külön munka.

Az ADR sablonját a [`docs/README.md`](../../README.md) írja le — azt kövesd. Tartalmi magja:

- **Context:** a chat generikus volt; az egyik ok, hogy az advisor minden alátámasztatlan állítást
  büntetett, így a modellnek nem maradt módja sejtést megfogalmazni.
- **Decision:** a chat felületen a **jelölt** spekuláció megengedett. Az advisor a **jelölés
  hiányát** bünteti (`unmarkedClaim`), nem a spekulációt. Kitalált konkrét szám jelöléssel is tilos.
- **Scope — explicit:** ez **kizárólag a chat felületre** vonatkozik. Az Insights, a napi
  összefoglaló és a proaktív briefing fegyelme változatlan; ha valaha ott is kellene, az külön
  döntés.
- **Consequences:** a hangnem élőbbé válik, cserébe több „tippelek" típusú mondat jelenik meg; a
  `degraded` arány figyelendő; a persona `[Mit szabad állítani]` blokkja és a `unmarkedClaim`
  kritérium **egy pár** — külön módosítani őket regresszió.

- [ ] **Step 2: Frissítsd a feature-docot**

`docs/features/companion.md` — a `knowledge-base` skill konvenciói szerint, **helyben átírva**
(nincs changelog a dokumentumban, a git a történet). Amit érinteni kell:

- a prompt-összeállítás leírása: a lánc `SYSTEM_PROMPT → snapshot → tények → felismerések →
  TONE_REMINDER`, és hogy a **history már nem itt van**;
- a `CompanionLlm` port alakja: 5-arg absztrakt + 4-arg default, `Turn`/`Role`, `ChatHistory`;
- az advisor szekció: `unmarkedClaim` és a jelölt-spekuláció politika (linkkel az ADR-re);
- az llm-audit `conversation_history` mezője;
- `file:line` mutatókkal, kódmásolás nélkül.

- [ ] **Step 3: Futtasd a doc-lintet**

```bash
node scripts/lint-docs.mjs
```

Elvárt: nincs hiba, és a `companion.md` staleness-flagje eltűnt.

- [ ] **Step 4: Futtasd a TELJES backend-készletet**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS. Ez az utolsó lokális kapu a self-PR előtt.

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(companion): marked-speculation ADR + feature doc refresh (mezo-q71s)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Az integráció (a tervben csak jelölve — a `finishing-a-development-branch` skill viszi)

A CLAUDE.md git-workflow szerint: `git push` a feature branchre → self-PR → **CI zöld** → lokális
`--no-ff` merge (`git pull --rebase` a main-en **a merge ELŐTT**) → `git push` main → branch törlése
→ `bd close mezo-q71s`.

A self-PR nem review, hanem a CI-kapu: a 16 GB-os gép nem futtatja a teljes backend IT-suite-ot,
a `ci.yml` viszont igen, tiszta `ubuntu-latest`-en.

---

## Nyitott követő-issue-k (a task-ok után, külön bd-ként)

1. **A 2.5-pro kísérlet** — egysoros `mezo.companion.llm.chat-model` váltás, most már tiszta
   összehasonlítási alapon (mérendő: output-token/kör, első-token latencia, `degraded` arány).
2. **Az observatory UI mutassa a `conversation_history`-t** — contract-first munka
   (`api/feature/llm-usage/llm-usage.yml` már exponálja a `systemPrompt`-ot), a spec szerint
   opcionális.
3. **A `docs/decisions/` duplikált 0026-os sorszáma.**
