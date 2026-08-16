# Companion chat — beszélgetős hangnem (persona + multi-turn + advisor-egyensúly)

- **Dátum:** 2026-08-16
- **bd issue:** `mezo-q71s`
- **Státusz:** elfogadott design, implementációra vár
- **Érintett feature-doc:** [`docs/features/companion.md`](../../features/companion.md)

## 1. A probléma

A companion chat generikus, adat-terminál jellegű. A 2026-08-15-i session-vizsgálat négy okot
azonosított; a kód átnézése mind a négyet megerősítette, és Daniel mind a négy tünetet élőnek
jelölte:

1. **Nem emlékszik a beszélgetésre.** A history nem valódi multi-turn üzenetlistaként megy a
   modellnek, hanem *transcriptként a system promptba renderelve*
   (`ChatService.renderHistory`, „Daniel: … / Mezo: …", 20 üzenet). A `CompanionLlm` port
   szignatúrája `(systemPrompt, userMessage, tools, toolContext)` — message-lista sehol.
2. **Nincs saját hangja.** A `SYSTEM_PROMPT` 25 sorából 6 a persona; a maradék tiltás és
   `[Eszköz-útmutató]` routing. Futásidőben ehhez jön a context-snapshot, a top-10 fact-blokk és a
   pattern-ack blokk, így a persona aránya a teljes promptban pár százalék.
3. **Nem kérdez vissza.** Semmi nem bátorít kíváncsiságra; az advisor-lánc kifejezetten a
   visszakérdezés *ellen* dolgozik.
4. **Lélektelenül tömör.** A persona utolsó mondata: „Válaszolj magyarul, tömören."

Járulékos ok, amit a kódátnézés talált: az advisor-lánc (`CompanionAdvisorChain`) csak vétót
ismer (klinikai guárd / `redundantQuestion` / `ungroundedClaim` → korrekciós újrapromptolás →
`degraded`), és a korrekciós blokk (`AdvisorRetry.block`) **kizárólag tiltásokat sorol**, ezért
minden retry-válasz szerkezetileg semlegesebb az elsőnél.

## 2. Döntések

| Kérdés | Döntés |
|---|---|
| Hangnem vs. grounding-fegyelem | **Jelölt spekuláció szabad.** Sejtés, vélemény, hipotézis megengedett, ha nyelvileg meg van jelölve. Az advisor a *jelölés hiányát* bünteti, nem a spekulációt. Kitalált konkrét szám jelöléssel is tilos. |
| Modell-tier | **Marad `gemini-2.5-flash`.** Előbb prompt + architektúra, utána mérés. A 2.5-pro kísérlet külön bd issue, tiszta összehasonlítási alapon. |
| Advisor „bátorítás" | **Nem épül laposság-bíráló.** Az advisor vétó-kapu; bátorítani csak retry-jal tudna, a retry viszont maga laposít. A bátorítás helye a persona-prompt; az advisor dolga annyi, hogy ne dolgozzon a beszélgetés ellen. |
| llm-log a history után | **Új `history_text` oszlop.** Az audit teljes és őszinte marad: minden oszlop azt tartalmazza, ami valóban az. |

## 3. Architektúra — multi-turn a portban

A `CompanionLlm` kap history-paramétert, **megfordítva a jelenlegi absztrakt/default viszonyt**:

```java
public interface CompanionLlm {
    enum Role { USER, ASSISTANT }
    record Turn(Role role, String content) {}

    // ÚJ absztrakt alak — ezt implementálja a két adapter
    String complete(String systemPrompt, List<Turn> history, String userMessage,
                    List<ToolCallback> tools, Map<String, Object> toolContext);
    Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                        List<ToolCallback> tools, Map<String, Object> toolContext);

    // A MOSTANI 4-argumentumos alak default lesz, üres history-val
    default String complete(String sp, String um, List<ToolCallback> t, Map<String, Object> tc) {
        return complete(sp, List.of(), um, t, tc);
    }
}
```

A megfordítás a lényeg: **két adaptert kell átírni** (`GeminiCompanionLlm`, `FakeCompanionLlm`), és
**egyetlen hívót sem** a chaten kívül. A 10+ pipeline-adapter (meal, recipe, pantry, sleep, habit,
slot-plan, scrape, transcription, extraction, summary, verdict) a default overloadokon ül, és soha
nem lát history-t — ami helyes is: azok egylövetű hívások.

**Elmozduló felületek:**

- `ChatService.PreparedTurn` kap egy `List<Turn> history` mezőt; a `loadWindow` eredménye
  `Turn`-ökre képződik `renderHistory` helyett. A `historyWindow` property változatlan.
- `ChatStreamService` továbbadja (`turn.history()`) a `stream(...)`-nek és az advisor
  `review(...)`-nak.
- `CompanionAdvisorChain.complete/review` átveszi és továbbadja a history-t a korrekciós
  köröknek és a `TurnVerdictCheck`-nek.
- `GeminiCompanionLlm`: `.system(sp).messages(toMessages(history)).user(um)`.

**`renderHistory` nem hal meg, hanem átköltözik** `ChatHistory.render(List<Turn>)`-né. Három helyen
továbbra is *szöveg* kell belőle: (a) a verdict-bíráló payloadja, (b) a fake LLM echója, (c) az
llm-log `history_text` oszlopa. A „Daniel: / Mezo:" formátum megmarad — csak már nem az, amit a
modell kap.

> ⚠️ **Implementációkor ellenőrizni, nem feltételezni:** a Spring AI 2.0 `ChatClient`-nél a
> `.messages(...)` + `.user(...)` sorrendje — hogy a user-üzenet tényleg a history *után* kerül a
> prompt-listába.
>
> Ezt **nem IT fedi le**: az ITs a `companion-fake` profilon futnak, ahol a `GeminiCompanionLlm`
> bean nem is létezik, a fake echója pedig a *hívó* összeállítását bizonyítja, nem a Spring AI
> prompt-sorrendjét. A helyes eszköz egy **plain unit teszt egy `Prompt`-ot rögzítő `ChatModel`
> stubbal** (kézzel írt stub, nem Mockito — ugyanaz a filozófia, mint a fake bean). Ez az egyetlen
> hely, ahol a valódi adapter viselkedése hálózat nélkül megfogható.
>
> A verifikált API-alak (spring-ai 2.0.0 jar ellenőrizve): `ChatClientRequestSpec.messages(List<Message>)`
> és `messages(Message...)` létezik; `new UserMessage(String)` és `new AssistantMessage(String)`
> publikus konstruktorok.

### 3.1 Csatolások, amiket a portváltás megbont

1. **A bíráló a system promptból olvassa a beszélgetést.** `TurnVerdictCheck.check(...)` a
   `turnSystemPrompt`-ot adja át kontextusként, és a history jelenleg abban van. A portváltás után
   a bíráló megvakulna a beszélgetésre, és hamis `redundantQuestion` / `unmarkedClaim` ítéleteket
   hozna. **Megoldás:** a payload külön rendereli a history-t (`ChatHistory.render`).
2. **Az llm-log ugyanígy.** `GeminiCompanionLlm` a `systemPrompt`-ot és a `userMessage`-et logolja.
   **Megoldás:** új `history_text` oszlop (§5).
3. **A korrekciós újrapromptolás strukturálisan laposít.** `AdvisorRetry.block` csak tiltásokat
   sorol. **Megoldás:** hangnem-megőrző záró mondat (§4.3).

## 4. A viselkedés

### 4.1 A `SYSTEM_PROMPT` átépítése

Nevesített blokkok; a hangnem-blokk **konkrét viselkedést ír le, nem jelzőket** — a „legyél
barátságos" típusú instrukció flash-en gyakorlatilag hatástalan, a „listát csak akkor használj,
ha…" viszont működik.

```
[Ki vagy]            → változatlan tartalom, 3 sor (társ, T/1, nem osztályoz, nem moralizál)

[Hogyan beszélsz]    → ÚJ:
  · Beszélgetsz, nem jelentést írsz. Élő mondatok; listát csak akkor, ha Daniel
    listát kért, vagy 4-nél több egyenrangú tétel van.
  · A hossz kövesse a kérdést: konkrét tényre egy-két mondat, nyitott kérdésre
    valódi bekezdés. Ne told fel, de ne is csonkold le.
  · Van véleményed. Ha feltűnik valami az adatban, mondd ki, hogy feltűnt, és
    hogy szerinted mit jelent.
  · Ha tényleg érdekel valami, kérdezz vissza — de csak valódi kérdést;
    udvariassági záró kérdést soha.
  · Építs arra, ami már elhangzott; ne kezdd újra minden körben.

[Mit szabad állítani] → ÚJ:
  · Sejtésed lehet, és ki is mondhatod — de jelöld: „tippelek", „erős a gyanúm",
    „ezt csak sejtem".
  · Konkrét számot, dátumot vagy múltbeli adatot CSAK a kontextusból, egy
    eszközhívásból vagy Daniel üzenetéből mondj. Adatot kitalálni akkor is
    tilos, ha megjelölöd.
  · Ha nem tudsz valamit, mondd ki, hogy nem tudod.

[Tiltás]             → Rx-adagolás (retatrutid), változatlanul
[Eszközhasználat]    → a két tool-fegyelem mondat, változatlanul
[Eszköz-útmutató]    → változatlanul
```

**A `Válaszolj magyarul, tömören.` eltűnik** — ez a mondat egymaga felelős a 4. tünetért; a helyére
a `[Hogyan beszélsz]` hossz-szabálya lép.

### 4.2 Hangnem-emlékeztető és példapár

**(a) Záró emlékeztető a *teljes összeállított* prompt végén** (a `knowledgeFactService` blokkjai
után, közvetlenül a hívás előtt), ~2 sor:

> `[Emlékeztető] Ez beszélgetés Daniellel, nem adatlekérdezés. A fenti adatblokk nyersanyag, nem a válasz formája.`

Indok: a persona a prompt tetején van, alatta a futásidejű adatblokkok. A history kiköltözése ezt
javítja, de nem szünteti meg; a recency-pozíció olcsó és hatásos ellensúly.

**(b) Egy kontraszt-példapár** (ugyanarra a kérdésre egy „adat-terminál" és egy „beszélgetős"
válasz, ~6 sor). Flash az a tier, ahol a demonstráció nagyságrenddel többet ér a leírásnál.

> ⚠️ **Kockázat:** a konkrét számokat tartalmazó példa bátoríthatja a számkitalálást. Ezért a
> példában a számok forrása explicit, és a `unmarkedClaim` advisor a védőháló — de az első napokban
> ezt figyelni kell. Ha a jelenség megjelenik, a példapár az első, amit vissza kell venni.

**Költség-flag:** a `tömören` kivezetése + a bekezdéses válaszok minden körben több output-tokent
és hosszabb generálást jelentenek. Ez a hangnem ára flash-en is. Ha nem fér bele, a hossz-szabály
konzervatívabbra húzható a promptban, kódváltozás nélkül.

### 4.3 Advisor — vétóból korlát

Három sebészi vágás, **nulla új LLM-hívás**:

1. **`ungroundedClaim` → `unmarkedClaim`, átdefiniált kritériummal.** A `VERDICT_PROMPT` 2. pontja:

   > *most:* „állít-e a válasz konkrét múltbeli adatot vagy számot, amit sem a kontextus, sem a
   > felsorolt eszközhívások, sem Daniel üzenete nem támaszt alá?"
   >
   > *új:* „állít-e a válasz **magabiztosan, jelölés nélkül** konkrét múltbeli adatot vagy számot,
   > amit sem a kontextus, sem a felsorolt eszközhívások, sem Daniel üzenete nem támaszt alá? Ha a
   > válasz nyelvileg jelöli a bizonytalanságot (*tippelek / gyanítom / lehet, hogy / ezt csak
   > sejtem*), az **nem sértés**. Kitalált konkrét szám viszont jelöléssel is sértés."

   A JSON-kulcs átnevezése szándékos: az `ungroundedClaim` név a továbbiakban hazudna arról, mit
   mér. Érintett felület: `TurnVerdictCheck.TurnVerdict` record, a fake verdict-generátor és 2-3 IT.

2. **`redundantQuestion` érintetlen.** A never-ask-twice és a kíváncsi visszakérdezés nem ugyanaz:
   az előbbi *megerősített tényre* kérdez rá, az utóbbi újat kérdez. A jelenlegi megfogalmazás ezt
   már helyesen különbözteti.

3. **A korrekciós blokk megvédi a hangnemet.** `AdvisorRetry.block` záró mondata kiegészül:

   > `A hangnem NE változzon — ugyanaz az élő, beszélgetős stílus; a javítás kizárólag a fent megjelölt problémára vonatkozzon.`

## 5. Adatmodell — `conversation_history`

Egy Liquibase changeset az **`llm_log_history`** táblára (`LlmLogEntity`): nullable
**`conversation_history text`** oszlop.

> Az oszlopnév szándékosan nem `history_text`: a tábla neve már `llm_log_history`, ahol a „history"
> a *hívásnaplót* jelenti. Egy `llm_log_history.history_text` oszlop két különböző dolgot hívna
> ugyanúgy. A `conversation_history` egyértelmű: a **beszélgetés** előzménye, amit a modell
> message-listaként kapott.

A `LlmLogEntity`, a `LlmCallRecord` és a `GeminiCompanionLlm` `CallSpec`-je egy-egy mezővel bővül; a
chat-utak (`CHAT`, `TOOL`, `CHAT_STREAM`) kitöltik `ChatHistory.render(history)`-val, minden más út
`null`-t hagy benne.

A `system_prompt` oszlop szemantikája **nem változik**: továbbra is pontosan azt tartalmazza, amit a
modell system promptként kapott. Ez az oka annak, hogy nem a beleragasztás a megoldás — egy
audit-logban a félig igaz oszlop rosszabb, mint a hiányzó.

Changeset-név a house standard szerint:
`{YYYYMMDDHHMM}_mezo-q71s_add_llm_log_history_conversation_history.sql`.

Ha az llm-audit observatory UI megjeleníti a system promptot, a beszélgetés-előzmény ott is
megjeleníthető — de ez opcionális, és nem feltétele az issue lezárásának.

## 6. Tesztelés

- **`FakeCompanionLlm`** echója kibővül a history-val — enélkül az ITs elvesztik a képességet, hogy
  assertálják, *mit állított össze a hívó*. A `systemPrompt.startsWith(MARKER)` dispatch változatlan.
- **`ChatServiceIT`** meglévő assertionjei (154, 176, 236, 248–252) átállnak a system-prompt-echóról
  a history-echóra.
- **Új IT — a lényegi bizonyíték:** a system prompt **nem tartalmazza** a korábbi üzeneteket, a
  history-felület viszont igen. Ez az egyetlen teszt, ami elbukik, ha valaki később visszacsempészi
  a transcriptet a system promptba.
- **Új unit teszt — sorrend:** `GeminiCompanionLlmPromptOrderTest` egy `Prompt`-ot rögzítő
  `ChatModel` stubbal: a küldött üzenetlista `[system, history…, user]` sorrendű. Nem IT — lásd §3.
- **`CompanionAdvisorChainIT`:** az átnevezett `unmarkedClaim`, plusz egy ma hiányzó eset —
  *„tippelem, hogy az alvás miatt" NEM vált ki retry-t*.
- **`ChatStreamAdvisorIT`:** a history a streamelt úton is átmegy az advisornak.
- **Az llm-log oldala:** egy chat-kör után a `conversation_history` kitöltött, egy pipeline-hívás
  után `null` — ez zárja le, hogy az audit tényleg nem vesztett fidelitást.

Gate: `./mvnw clean test -Dmezo.test.use-testcontainers=true` (a fixed-DB mód versenyez), majd a
self-PR CI a teljes suite-ra.

## 7. Dokumentáció

- **`docs/features/companion.md`** — a prompt-összeállítás (§4) és az advisor (§4.5) szekciók, a
  `CompanionLlm` port alakja, és az llm-log `history_text` mező.
- **ADR — „jelölt spekuláció szabad"** a következő szabad sorszámon. Ez valódi ADR-anyag:
  megváltoztatja, mit mond ki magáról a rendszer, és bármelyik jövőbeli AI-felület (Insights, napi
  összefoglaló, proaktív briefing) fel fogja tenni a kérdést, hogy ott is érvényes-e. Az ADR
  hatóköre ezért explicit: **a chat felületre vonatkozik**, a nem-chat felületek fegyelme
  változatlan.
  *(Figyelem: a `docs/decisions/` mappában jelenleg két 0026-os ADR van — az új sorszám
  kiosztásakor ezt ellenőrizni kell.)*
- A portváltás **nem igényel új ADR-t**: az ADR 0008-nak (modell-tierek, LLM-seam) nem mond ellent,
  csak bővíti a seam alakját. A companion feature-docban rögzítendő.

## 8. Hatókör

**Benne:** a `CompanionLlm` port multi-turn alakja, a két adapter, a chat/stream/advisor hívólánc,
a `SYSTEM_PROMPT` átépítése, a záró emlékeztető, a példapár, a három advisor-vágás, a `history_text`
oszlop, a tesztek és a dokumentáció.

**Kívül (külön bd issue):**

- **A 2.5-pro kísérlet.** Egysoros konfigváltás (`mezo.companion.llm.chat-model`), de csak ezután
  értelmes: így tudjuk, mi a prompt/architektúra érdeme és mi a modellé.
- **Hibrid modell-routing** (tool-vezérelt kör flash-en, beszélgetős kör pro-n).
- **Laposság-bíráló advisor-dimenzió** — tudatosan elvetve (§2).
- **A nem-chat AI-felületek hangneme** (Insights, napi összefoglaló, proaktív briefing).

## 9. Mérés

Nincs automatizált hangnem-metrika, és nem is találunk ki egyet. Amit kapunk:

- **Kvantitatív:** az llm-log token- és latencia-adatai before/after — ez a *költséget* méri, nem a
  minőséget. Konkrétan figyelendő: az átlagos output-token/kör (a `tömören` kivezetésének ára) és a
  `degraded` arány (nem szabad megugrania — ha megugrik, a példapár vagy a hossz-szabály túl messze
  ment).
- **Kvalitatív:** Daniel olvasata. Ez a valódi elfogadási kritérium, és nyíltan az.
