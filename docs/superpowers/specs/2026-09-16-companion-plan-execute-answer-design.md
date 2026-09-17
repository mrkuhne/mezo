# Companion chat — `terv → végrehajtás → válasz` architektúra

- **Dátum:** 2026-09-16
- **Driving issue:** `mezo-rj214` (epic) — ez a spec a `mezo-rj214.7` (S9) szelet terve,
  és előfeltétele/átfedésben van `mezo-rj214.3` (S6, prompt), `mezo-rj214.5` (S8, advisor),
  `mezo-rj214.4` (S7, model-tier mérés), `mezo-prb9` (látható fázisok) szeletekkel
- **Státusz:** design approved in brainstorm (2026-09-16), awaiting plan
- **Kiváltó panasz:** a repo tulajdonosa, 2026-09-15/16 chat-munkamenet — „MINDENT, ami a db-ben
  van, látnia kéne és elérnie kérésre… este megkérdezem mit ettem és lássa grammra pontosan…"
  és „sokkal szabadabban tudok beszélgetni egy üres ChatGPT ablakkal, mint Mezóval"
- **Kapcsolódó:** ADR 0008 (companion LLM / Spring AI 2 — amendelendő), `mezo-ozri` epic
  (OpenAI migráció, §5 prompt-caching invariáns), `docs/features/companion.md`,
  `docs/references/companion_tool_conventions.md`, `mezo-ojm7` (`[Két mód]`),
  `mezo-nqnj` (COMPANION_EMPTY_ANSWER), `mezo-4qyt.8` (`run_id` a `llm_log`-ban)

---

## 1. Cél

Egy chat-kör ma **egyetlen olcsó, gondolkodás nélküli modellhívás**, amire a 18 tool-séma rá van
akasztva, és amit utána egy 0.60 precizitású bíráló osztályoz. Ez a spec ezt három, egymástól
elkülönülő lépésre bontja, úgy, hogy **egyetlen modellhíváshoz sem csatolunk tool-sémát**:

1. **Fokozatválasztás** — determinisztikus elemző (+ szükség esetén egy olcsó osztályozó)
   eldönti, hogy a kör `CHAT`, `LOOKUP` vagy `ANALYSIS`.
2. **Tervezés** — az **okos** modell, gondolkodással, tool-sémák nélkül **kimondja**, milyen
   adatot kér (strukturált terv), ahelyett hogy tool-t hívna.
3. **Végrehajtás** — a tervet **tiszta Java kód** futtatja, modell nélkül, **párhuzamosan**.
4. **Válasz** — az okos modell, gondolkodással, tool-sémák nélkül, a **nyers** eszköz-kimenetből
   fogalmaz, és streamel.

A központi felismerés: **ha soha egyetlen hívás sem carries tools, akkor az OpenAI
`tools + reasoning_effort` tiltása nem megkerülve lesz, hanem megszűnik releváns lenni** — és
ez igaz marad a GPT-6 Astra-ra is, ahol a Chat Completions **egyáltalán** nem enged function
callingot (§3). Az architektúra ezzel provider-semlegessé válik: sem az OpenAI Responses API-ra
állásra, sem a Gemini thinking+tools képességére nem épül rá.

**Nem cél:** per-turn tool-subsetting (§9 N1); a Responses API bevezetése; a memória-platform
átalakítása; a tool-ok tartalmi bővítése (az `mezo-rj214.1`/`mezo-ta62c` külön szelet, de ez a
spec a *hordozóját* építi meg hozzá); provider-váltás (a `mezo-rj214.4` mérése külön fut, és
ennek az architektúrának mindkét providerrel működnie kell).

**Minden hangolható szám `application.yml`-be kerül** `@ConfigurationProperties` recordokon
(ArchUnit `no_spring_value_annotation`).

---

## 2. Döntések (a brainstorm eredménye)

| Kód | Döntés | Elutasítva |
|---|---|---|
| **G1** | Három fokozat: `CHAT` (nem kell adat), `LOOKUP` (egyszerű kikeresés), `ANALYSIS` (elemzés). A fokozat **nem azt dönti el, ki tervez** — mindig az okos modell —, hanem a reasoning effortot és azt, hogy engedélyezett-e a replan-kör. | Fokozatonként más modell-tier (visszahozná a „gyenge modell választ adatot" hibát) |
| **G2** | A fokozatválasztás **determinisztikus elemzővel** kezdődik (`MemoryQueryAnalyzer` mintájára), és csak `UNSURE` esetén hív egy olcsó osztályozót. | Mindig LLM-osztályozó (felesleges latency a triviális esetekre); mindig szabály (törékeny a fogalmazásra) |
| **G3** | Explicit felhasználói felülbírálás (`„nézd meg alaposabban"` és társai) → `ANALYSIS`, osztályozó nélkül. | — |
| **P1** | **Egyetlen modellhíváshoz sem csatolunk tool-sémát.** A tool-katalógus a tervező promptjába **szövegként** kerül. | Tool-sémák a tervezőn (visszahozza a tiltást); Responses API (Spring AI 2.1.0-M1, due date nélkül — §3) |
| **P2** | **Az okos modell tervez** (a szakirodalom orientációja), a végrehajtó buta kód. | A PO eredeti javaslata (olcsó választ, okos fogalmaz) — a dokumentált planner-executor ennek a fordítottja, és a mi mért hibánk (`mezo-nqnj`) épp a gyenge szelektorból jön |
| **P3** | A terv **validálva** fut: tool-név, paraméter-nevek, enumerált értékek, window-clampek a **élő registry** ellen. Érvénytelen lépés eldobva, indoklással; legfeljebb **egy** javító kör. | Vak végrehajtás; korlátlan javító kör |
| **X1** | A végrehajtó **tiszta Java, modell nélkül**, és a független lépéseket **párhuzamosan** futtatja. A `RecordingToolCallback` + `ToolCallAudit` útvonalat változatlanul használja (audit, refs, budget megmarad). | Spring AI tool-loop megtartása (az csatolt sémát igényel); soros végrehajtás (felesleges latency) |
| **A1** | A válaszoló a **nyers** eszköz-kimenetet kapja. **Nincs összegző/kivonatoló lépés.** | A PO eredeti 3. lépése („egy másik összegyűjti a választ") — pontosan ez a defekt, amit az epic javít (`mezo-ta62c`: egy összegző döntötte el, hogy 3 étkezés-cím elég) |
| **A2** | A válaszoló jelezhet **adathiányt** → legfeljebb `replan.max-laps` (default **1**) újratervezési kör, csak `ANALYSIS` fokozatban. | Korlátlan agentic loop (3–10× token, §3); bőkezű pre-fetch |
| **V1** | Az SSE `phase` eseménnyel bővül (`planning` / `retrieving` / `answering`). Ez `mezo-prb9` **előfeltétele, nem utómunkája**: a 2-fázisú kör first-token latenciája ~9 s, ami látható fázisok nélkül elakadásnak olvasódik. | Néma várakozás |
| **R1** | A **tervet és az eszköz-kimeneteket perzisztáljuk**, és a chat-felületen lekérdezésenként, strukturáltan megnézhetők. Megőrzés: **90 nap**, utána a kimenet ürül, a *mit kértünk* megmarad. | Nem perzisztálni (ma ez a helyzet — `ToolCallAudit.java:130-131`); örök megőrzés (PO döntés 2026-09-16) |
| **D1** | A **LLM-es verdict-bíráló kikerül az élő válaszútból.** A determinisztikus `ClinicalOutputCheck` **marad**. | Log-only fokozat — a PO explicit steerje: „ha ez eddig gyakran alaptalan volt, akkor jobb is ha kivesszük". A bíráló az **eval-harnessben** megmarad offline mérésre. |
| **D2** | A prompt **előírt bizonytalankodó szótára kikerül**, a few-shot példa lecserélődik egy elkötelezett válaszra. A „számot kitalálni tilos" szabály marad; új szabály: **cselekvést állítani tilos** (`mezo-q0p5a`). | Hedging-nyelv megtartása (a D1 nélkül a retry-hurok úgyis visszatanítaná) |
| **N1** | **Nincs per-turn tool-subsetting.** 18 tool < a vendorok által jelzett 30–50-es degradációs küszöb, és a `[Eszköz-útmutató]` a **cache-elt** prompt-félben él — per-turn változtatása minden körben eldobná a cached prefixet (`mezo-ozri.5` ezt építette meg). | Intent-alapú tool-szűrés |

---

## 3. Prior art

*(A `researcher` recon szűrt eredménye, 2026-09-16. Minden állítás forrással és dátummal.)*

**OpenAI — a tiltás policy, nem bug, és szigorodik.**
A [migrate-to-responses guide](https://developers.openai.com/api/docs/guides/migrate-to-responses)
szó szerint: *„Starting with GPT-5.4, Chat Completions does not support tool calling with
`reasoning_effort` values other than `none`."* Tehát 5.4-től családszintű szabály, nem a
`gpt-5.6-luna` hibája. Az OpenAI Support a
[community threadben](https://community.openai.com/t/gpt-5-6-chat-completion-reasoning-effort-bug-behavior-change/1386454)
**2026-09-07-én** közölte, hogy erre a kombinációra nincs megerősített javítás. A
[reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) szerint pedig
*„Chat Completions does not support function calling with GPT-6 Astra"* — vagyis a mai
`reasoning_effort=none` kerülőút a következő generációban **teljesen megszűnik**. Ez a spec
P1 döntésének fő indoka: a `none`-ra pinelés lejárati idővel bíró plató, nem nyugvópont.
Ökoszisztéma-jel: a [LiteLLM #33221](https://github.com/BerriAI/litellm/issues/33221) fixe a
`gpt-5.6 + tools` forgalom `/v1/responses`-re routolása.

**Spring AI — a Responses API nem ütemezhető.**
[#2962](https://github.com/spring-projects/spring-ai/issues/2962) nyitva, milestone **2.1.0-M1**,
nulla komment; [PR #5037](https://github.com/spring-projects/spring-ai/pull/5037) csak
*low-level* `OpenAiApi` támogatást ad, a `ChatModel` absztrakcióba kifejezetten **nem** köti be,
és 2026-02-06 óta áll. A [milestones lap](https://github.com/spring-projects/spring-ai/milestones)
szerint 2.1.0-M1 **due date nélkül** áll. „Megvárjuk a Spring AI-t" nem terv.

**Gemini — nála nincs ilyen tiltás (de nem erre építünk).**
A [thinking doc](https://ai.google.dev/gemini-api/docs/generate-content/thinking) (frissítve
2026-09-09) szerint a thinking modellek *„work with all of Gemini's tools and capabilities"*, és
a 2.5 thought signature-t ad vissza *„when thinking is enabled and the request includes function
calling"*. `thinkingBudget`: Flash 0–24576 (0 = kikapcs), Pro 128–32768 (nem kapcsolható ki),
`-1` = dinamikus. A repo **már a jó modulon van** (`spring-ai-starter-model-google-genai`,
`backend/pom.xml:127`, Spring AI `2.0.1`), ami a
[google-genai doc](https://docs.spring.io/spring-ai/reference/api/chat/google-genai-chat.html)
szerint exponálja a budgetet és a `ToolCallingAdvisor`-on át **automatikusan kezeli a thought
signature-öket**. Ez a spec ezt **nem** teszi kritikus útvonallá (P1), de rögzíti: ha a
`mezo-rj214.4` mérése Geminit hoz ki, az architektúra ott is változatlanul működik, sőt a
tervező+végrehajtó fázis opcionálisan egy hívásba vonható össze.

**Planner-executor — a fordított orientáció.**
A [LangChain planning-agents](https://www.langchain.com/blog/planning-agents) írás a
Plan-and-Execute / **ReWOO** / LLMCompiler családot írja le. A ReWOO a legközelebbi ős: a terv
változó-hivatkozásokkal (`#E1`, `#E2`) hivatkozik korábbi lépések kimenetére, így a végrehajtás
nem igényel újabb planner-hívást. **Mindegyikben az erős modell tervez, olcsó executorok
hajtanak végre** — ezért fordítja meg ez a spec a PO eredeti sorrendjét (P2). Az LLMCompiler
DAG-ként tervez, hogy a független lekérések **párhuzamosan** fussanak (X1). A multi-hop esetet
mindkettő **bounded replan / „Joiner"** körrel kezeli, nem bőkezű pre-fetchcsel (A2).

**Agentic RAG — miért nem ez a default út.**
Az [Agentic RAG áttekintés](https://neo4j.com/blog/agentic-ai/what-is-agentic-rag/) alapján az
iteratív retrieve-then-reason hurok tipikusan a klasszikus RAG **3–10×-es** token-költségén fut.
Ezért a replan kör szigorúan korlátos és csak `ANALYSIS`-ben engedett.

**Olcsó elő-kapu.**
A [tool selection guide](https://machinelearningmastery.com/the-complete-guide-to-tool-selection-in-ai-agents/)
szerint egy gyors, olcsó „kell-e egyáltalán tool" osztályozó azonnal megtérül, ha a körök
20–30%-a beszélgetés. *(Gyakorlati forrás, nem tanulmány — a 20–30% illusztratív.)* Ugyanez a
forrás mondja ki az ellenérvet is, amit P2 kezel: a reasoning modellek **pontosabban** választanak
toolt, mint a nem-reasoning modellek.

**Tool-darabszám.**
Az [Anthropic tool-search doc](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
a degradációt **30–50** tool fölé teszi; az [arXiv 2605.24660](https://arxiv.org/abs/2605.24660)
(Bits-over-Random) adaptív shortlistje 370–3251 tool-os katalógusokon mér. A mi 18 toolunk
ezek alatt van → N1.

---

## 4. Codebase terrain

*(Az `investigator` recon szűrt eredménye, 2026-09-16. Minden `path:line` ellenőrizve.)*

**A mai kör.** `ChatService.sendMessage:253` egyetlen `@Transactional` metódus; a modellhívás
`:282` (advisorral) vagy `:288` (közvetlen), `llmCallContextHolder.runWith(...)` scope-ban
(`:277`). A streamelt iker két tranzakció: `prepareTurn:215` → `ChatStreamService.streamMessage:63`
→ `completeTurn:239`. Prompt-felek: `stableSystemPrompt:368` (cache-elhető) és `turnContext:378`
(volatilis) — a `mezo-ozri.5` szerinti szétvágás, amit a `SpringAiCompanionLlm.request:358-389`
kommentje indokol.

**A kritikus jó hír — a fázis-2 adata már megvan.** `ToolCallAudit.results:44`,
`recordResult:92`, **`toolOutcomes():132`** → `List<ToolOutcome(name,args,result)>`, amit a
`RecordingToolCallback:44-61` tölt. Csak a **perzisztencia** hiányzik (`:130-131` javadoc).
`ToolOutcomeDigest.render:50` (package-private az `advisor`-ban) **már ma is pontosan azt a
blokkot állítja elő**, amire egy tool-mentes válaszhívásnak szüksége van, per-result és total
budgettel és három explicit lossy markerrel. `TurnVerdictCheck:57-72` a működő minta egy
history-mentes „kontextus + tool-kimenet + kérdés" payloadra.
→ Következmény: **`mezo-imga` és `mezo-aneg` valószínűleg már kész** (`mezo-indo` alatt szállt,
`docs/features/companion.md:1984-2013` dokumentálja) — ellenőrizni és zárni kell.

**A varrat félig kész.** `SpringAiCompanionLlm.optionsFor:111` már hordozza a `carriesTools`
flaget, és `OpenAiCompanionLlm.optionsFor:110` ezen kapuzza az effortot
(`effort = carriesTools ? "none" : reasoningEffortFor(OPENAI, tier)`). **Vagyis egy tool nélküli
SMART hívás ma, változtatás nélkül megkapja a reasoningot.** Amit hozzá kell tenni:

- `ModelTier.CHEAP` **hardcode** a beszélgetős utakon: `SpringAiCompanionLlm:147`, `:229`, `:379`.
- `CompanionLlm.completeSmart:120` az egyetlen smart belépő, de `(system, user)` — **nincs
  history, nincs turnContext, nincs stream**. Bővítendő **default metódusként**, hogy a 13
  adapter és a `FakeCompanionLlm` érintetlen maradjon (minta: `CompanionLlm:53-62`, ahogy a
  `turnContext` bekerült). Az OpenAI spec §8.3 figyelmeztetése áll: egy smart belépőt nem
  overrideoló adapter **némán** a cheap tierre küld — `OpenAiProviderWiringIT` testvér-assertet kap.
- `CallKind` **alakot és tiert kever**; egy streamelt, tool-mentes, smart válasz egyszerre
  `CHAT_STREAM` és `SMART`. Három olvasó: `LlmModelRouter.modelFor:58` (`call-kind-models`),
  `ToolSelectionEvalIT.GENERATION_KINDS:98`, admin költség-mátrix.
- `GeminiCompanionLlm.optionsFor:60-62` generikus `ChatOptions.builder()`-t ad vissza, nem
  `GoogleGenAiChatOptions`-t → thinking budget ma nem kifejezhető. (Nem blokkolja ezt a specet.)

**Mérés.** `LlmLogEntity:50-216` per hívás: `callKind`, `feature`, `operation`, `latencyMs`,
`streamed`, `toolRounds`, `finishReason`, prompt/candidates/**thoughts**/cached/total token,
`costUsd`, `pricingSnapshot`. **Nincs `run_id`** (`mezo-4qyt.8` nyitva) — a 2-fázisú kör ennek a
második use case-e. `ToolSelectionEvalIT:133-145` az egyetlen per-turn költség/latencia mérés
(42 eset, `tool-selection-cases.json`), `llmLogRepository.deleteAll()` per eset.
Mért bázis (`docs/research/comparisons/companion-chat-model-rebaseline-2026-09.md:62-84`):
luna 90.5% exact match, p50 **4090 ms**, **$0.000465**/sikeres akció; terra 95.2%, p50 4779 ms,
**$0.004670** (~10×), p95 8092 ms (+29%, bukott kapu).

**Minták, amiket követni kell.** Consumer-neutral port + provider adapterek (ADR 0008/0012);
a stable/volatile prompt-szétvágás **a caching szerződése** — új per-fázis szöveg a volatilis
félbe megy (minta: `CompanionAdvisorChain:63-65`); ambient tagging `LlmCallContextHolder.runWith`
(különben `feature='unknown'` és megkerüli a budget-kaput — ez volt a `mezo-ozri.8` bug);
egy `ToolCallAudit` per kör; determinisztikus elemző az opcionális LLM-lépés előtt
(`MemoryQueryAnalyzer`, `docs/features/companion.md:1531-1548`: *„The analyzer, not the model,
decides whether rewriting is warranted"*) — ez G2 precedense.

**Ami törik (a legnagyobb tétel: a tesztek).**
~12 prompt-sorrend IT a `FakeCompanionLlm` **végső válasz**-echójából vágja ki a
`system=[…] history=[…] user=[…]` darabokat: `ChatServiceIT:182-260`, `:379-435`,
`ChatServiceGraphBlockIT`, `…FailureIT`, `ChatServiceAmbientRecallIT`, `ChatMemoryRolloutIT`,
`CompanionLlmFakeIT`. Ha a **válaszoló** fázis írja a választ, ezek némán a fázis-2 promptját
kezdik állítani. A `FakeCompanionLlm` **prompt-prefix alapján dispatchel** (`:608-958`,
fallthrough `:954-957`) → minden új fázis saját MARKER konstanst kap; a
`TOOL_RESULT_SEEN_SENTINEL:113` a minta arra, hogyan bizonyítjuk, hogy egy új payload-blokk
megérkezett. Az OpenAI spec maga is ezt jelöli meg fő kockázatként
(`2026-09-06-openai-migration-design.md:251-253`).
SSE: `ChatStreamServiceIT:106-110` azt állítja, hogy az utolsó előtti minden esemény `delta` →
a `phase` esemény ezt töri; a szerződés `api/feature/companion/companion.yml:533-567` →
contract-drift kapu. FE: `chatApi.ts:88-100` if/else lánc `else` ág nélkül → ismeretlen eseményt
csendben eldob (visszafelé biztonságos), de `done` nélkül végződő stream
`COMPANION_STREAM_INCOMPLETE`-tel elszáll.
`llm_log` sorszám chat-körönként **duplázódik** — semmi nem törik (minden aggregáció count/sum),
de a `companion_chat` cost-per-call ~2×-ére ugrik; `feature` maradjon `companion_chat`, a fázis
az `operation` mezőben különüljön el.
Kapuk: ArchUnit (`feature_slices_are_cycle_free` fagyasztva, `companion_tools_are_internal_sphere_only:109`,
`no_spring_value_annotation:93`), CODEMAP frissesség, contract-drift, backend Testcontainers,
FE mindkét mód.

---

## 5. Architektúra — a kör

```
felhasználói üzenet
   │
   ├─ 0. TurnGearAnalyzer (determinisztikus)  ──► CHAT | LOOKUP | ANALYSIS | UNSURE
   │        └─ UNSURE ──► olcsó osztályozó (1 hívás, ~fél mp) ──► fokozat
   │        └─ explicit felülbírálás ──► ANALYSIS
   │
   ├─ CHAT ─────────────────────────────────────────────┐
   │                                                     │
   ├─ 1. Planner  (SMART, reasoning, TOOL NÉLKÜL)        │
   │        └─ strukturált terv: [{tool, args, why}]     │
   │        └─ PlanValidator (registry ellen)            │
   │                                                     │
   ├─ 2. Executor (TISZTA KÓD, párhuzamos)               │
   │        └─ RecordingToolCallback → ToolCallAudit     │
   │        └─ ToolOutcome[]  (nyers, NEM összegzett)    │
   │                                                     │
   └─ 3. Answerer (SMART, reasoning, TOOL NÉLKÜL) ◄──────┘
            └─ streamel; jelezhet adathiányt → (A2) ≤1 replan kör
```

Fázisonkénti `phase` SSE esemény: `planning` → `retrieving` → `answering`.

### Fokozatok hatása

| Fokozat | Planner | Executor | Answerer | Replan |
|---|---|---|---|---|
| `CHAT` | — (kihagyva) | — | SMART, effort `high`, **könnyített** kontextus | — |
| `LOOKUP` | SMART, effort `low` | igen | SMART, effort `medium` | nem |
| `ANALYSIS` | SMART, effort `high` | igen | SMART, effort `high` | ≤ `max-laps` |

A tier **minden fokozatban SMART** — a fokozat csak az effortot és a replan-engedélyt hangolja.
Ez tartja fenn P2-t (soha nem gyenge modell választ adatot).

---

## 6. Komponensek

### 6.1 `TurnGearAnalyzer` (új, `companion/service/`)

Tiszta függvény: `(userMessage, history) → Gear`. Két jel:

1. **Adat-utalás**: domain-szó (`aludtam`, `ettem`, `súly`, `edzés`, `protokoll`, …) **vagy**
   időkifejezés (`ma`, `kedden`, `múlt héten`, ISO dátum). A szótár a meglévő
   `eval/ToolDomains.java:20-38` domain-térképből származtatható, hogy egy helyen éljen.
2. **Kérdés-alak**: `mennyi / mikor / mit / hány` → `LOOKUP`; `miért / mi változott / mit
   csináljak / mit gondolsz` → `ANALYSIS`.

Nincs adat-utalás → `CHAT`. Ütköző jelek → `UNSURE`. Felülbírálás-minta (`alaposabban`,
`nézd meg jobban`, `gondold át`) → `ANALYSIS`.
`UNSURE` → `GearClassifier` (cheap tier, tool nélkül, enumerált egy-szavas kimenet).
Fail-open: osztályozó-hiba → `ANALYSIS` (inkább lassabb, mint rosszabb).

### 6.2 `TurnPlanner` (új)

- **Prompt**: rövid, planner-specifikus rendszerszöveg + a **tool-katalógus szövegként**
  + minimális pillanatkép (mai dátum, milyen domainek léteznek) + history + a felhasználói üzenet.
- **A katalógus futásidőben, az élő registryből generálódik** (`CompanionToolRegistry` +
  a `@Tool`/`@ToolParam` description-ök), nem kézzel karbantartott lista. Ez az egyetlen módja,
  hogy ne drifteljen szét úgy, ahogy a mai `[Eszköz-útmutató]` (`ChatService:131-148`) tette:
  a `companion_tool_conventions.md` 4. szabálya (leírni csak azt, amit renderel) így
  automatikusan öröklődik a plannerbe. A katalógus a **stabil**, cache-elhető prompt-félbe megy.
- **Kimenet**: `TurnPlan { needsData: bool, steps: [{ tool, args, why }] }` strukturált
  kimenetként. `needsData=false` → a fokozat visszaesik `CHAT`-re (a tervező felülbírálhatja
  az elemzőt lefelé).
- **Nincs tool csatolva** → `carriesTools=false` → reasoning legális mindkét provideren.

### 6.3 `PlanValidator` (új)

A **élő registry** ellen validál (nem egy másolt listával): létezik-e a tool, ismertek-e a
paraméter-nevek, enumerált értékek legálisak-e, window-ok a clampen belül vannak-e
(`ToolText.clamp` határai). Érvénytelen lépés → eldobva, indoklás a kimenetbe.
Ha **minden** lépés érvénytelen → **egy** javító kör a plannerhez a hibalistával; ha az is
elbukik → fallback (§8).

### 6.4 `PlanExecutor` (új)

Tiszta Java. A validált lépéseket a **meglévő** `RecordingToolCallback` példányokon futtatja
(tehát az audit, a `addRef`, a `max-calls-per-turn` budget és az ArchUnit internal-sphere
garancia mind változatlanul érvényes). Független lépések **párhuzamosan** futnak
(`CompletableFuture`, bounded pool). Lépés-hiba **nem** exception: rögzített `ToolOutcome`
hibaüzenettel.

### 6.5 `TurnAnswerer` (új)

- **Prompt (`LOOKUP` / `ANALYSIS`)**: hang (voice) + volatilis kontextusblokkok + history +
  a felhasználói üzenet + **a nyers `ToolOutcome`-ok** `ToolOutcomeDigest`-en át, **jelentősen
  megemelt budgettel** (ma 700/3000 karakter a bírálónak; itt ez a válasz **teljes alapja**,
  tehát a budgetnek a fokozathoz és a modell context-ablakához kell igazodnia, nem egy bíráló
  igényéhez).
- **Prompt (`CHAT`)**: hang + history + a felhasználói üzenet + **könnyített** kontextus —
  **nincs** `ToolOutcome` blokk (nem is futott lekérés), és a nehéz volatilis blokkok
  (`[Emlékek]`, `[Összefüggések]`, `[Karakter]`, `[Heti adatok]`) kimaradnak. Ami marad: a
  hang, a `[Rólad tanultam]` és egy minimális pillanatkép. Ez a fokozat így **kevesebb**
  tokent költ a mainál, miközben reasoninggal fut.
- **Nincs tool csatolva** → reasoning legális; SMART tier; streamel.
- **Adathiány-jelzés**: enumerált szignál (nem szabad szöveg) → A2 replan kör.

### 6.6 Provenance UI (R1)

- **Perzisztencia**: **két külön oszlop**, nem egy bővített envelope. A **terv** az
  `ai_message.tool_calls` jsonb envelope-ba kerül (a mai `{type,name,args}` mellé a `why` és a
  lépés-sorrend); a **kimenetek** **saját jsonb oszlopba** (`tool_outcomes`). A szétválasztás
  nem ízlés kérdése: a megőrzési szabály (lent) a kimeneteket üríti, a tervet megtartja, tehát
  külön kell tudni nullázni őket. Liquibase migráció a házirend szerint
  (`{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`).
- **Megőrzés**: a kimenet-mezők **90 nap** után ürülnek, a `mit kértünk` rész marad. Minta és
  precedens: `mezo.llm-log.retention.payload-days: 90` (`application.yml:632`). Új kulcs:
  `mezo.companion.provenance.retention-days: 90`.
- **Megjelenítés**: a mai `RefChips` csík (`ChatMessage.tsx:80`, eyebrow `„Amire épült · L3"`)
  mellé/helyére a **terv** kerül olvasható magyar címkékkel (`„Mai étkezés · Alvás kedd óta"`);
  koppintásra panel, lekérdezésenként egy kártya: mit kértünk (magyarul) + mi jött vissza.
  **A tool-ok már ma is magyar, olvasható szöveget adnak vissza** — nincs JSON-fordítási feladat,
  csak tipográfia. Sikertelen lépés őszintén jelölve.
  Vizuális nyelv: `docs/design_2.0/` Titanium (CLAUDE.md kötelezés), a meglévő
  `mozaik`/`clay` UI kit újrafelhasználásával — új look nem készül.

---

## 7. Ami kikerül

**D1 — LLM verdict-bíráló az élő útból.** `CompanionAdvisorChain` megmarad, de a láncból a
`TurnVerdictCheck` kikerül; a determinisztikus `ClinicalOutputCheck` (Rx dózis-változtatás)
**marad**. Ezzel megszűnik a retry-hurok és a streamelt úton a **néma válasz-csere**
(`ChatStreamService:96-123`). A bíráló osztály **nem törlődik**: az eval-harnessben offline
mérőműszerként megmarad, hogy a regressziót továbbra is lássuk.
Indok: self-dokumentált precizitás **0.60 at best** (`application.yml:738-747`), és az új
felépítésben a válaszoló modell előtt ott a nyers adat, amiből dolgozik.

**D2 — hedging-nyelv.** Kikerül `ChatService.java:86-87` előírt bizonytalankodó szótára, és
`:99-105` few-shotja **elkötelezett** példára cserélődik. Megmarad: „számot kitalálni tilos".
Új szabály (`mezo-q0p5a`): **cselekvést állítani tilos** — a companion nem naplóz, nem ment,
nem módosít; ha ilyet kérnek, mondja meg és irányítson a megfelelő felületre.
Feloldandó ellentmondás: a `[Két mód]` szabad-beszélgetés ága vs `[Eszközhasználat]` /
`[Mit szabad állítani]` „tool nélkül ne találgass" — az új felépítésben ezt a **fokozat** dönti
el kódból, tehát a promptból kivehető.

---

## 8. Hibakezelés

| Eset | Viselkedés |
|---|---|
| `GearClassifier` hiba/timeout | fail-open → `ANALYSIS` |
| Planner hiba / parse-hiba / üres terv | **egy** javító kör, majd **fallback a mai útra** (csatolt tool, cheap, reasoning nélkül). Degradált, de van válasz. `degraded=true`. |
| Minden lépés érvénytelen | mint fent |
| Egyedi lépés hibázik | rögzített hibás `ToolOutcome`; a válaszoló őszintén megmondja; a provenance-kártyán látszik |
| Válaszoló adathiányt jelez | ≤ `replan.max-laps` (default 1), csak `ANALYSIS`; utána a meglévő adatból válaszol |
| Per-user USD cap | **a kör elején**, a fázis-1 előtt egyszer ellenőrizve. Kör **közbeni** elutasítás tilos: az árva user-sor + audit válasz nélkül a `COMPANION_STREAM_FAILED` állapot (`mezo-ozri.6` tanulsága). |
| Üres válasz | a meglévő blank-answer guard (`ChatStreamService:115`) marad — `mezo-nqnj` várhatóan megszűnik, mert a tervezés és a válaszadás szétválik |

---

## 9. Konfiguráció

Minden kulcs `mezo.companion.turn.*` alatt, `@ConfigurationProperties` recordon:

```yaml
mezo:
  companion:
    turn:
      gear:
        classifier-enabled: true        # UNSURE esetén hívjunk-e olcsó osztályozót
      planner:
        effort: { lookup: low, analysis: high }
        repair-attempts: 1
      executor:
        parallelism: 4
        # a lépésszám a meglévő tools.max-calls-per-turn (15) alatt marad
      answerer:
        effort: { chat: high, lookup: medium, analysis: high }
        outcome-max-chars: { per-result: 8000, total: 40000 }   # NEM a bíráló 700/3000-e
        # ^ KIINDULÓ értékek, nem mértek. Az S9.5 szelet feladata a tényleges context-ablakhoz
        #   és a kibővített tool-kimenetekhez (mezo-rj214.1) hangolni őket; a lossy markerek
        #   miatt a túl szűk budget látható marad a modellnek, tehát a hiba nem néma.
      replan:
        max-laps: 1
      provenance:
        retention-days: 90
```

---

## 10. Mérés

1. **Terv-minőség** — `ToolSelectionEvalIT`, 42 eset. Az eddigi „hívta-e a jó toolt" mostantól
   **„a jó adatot kérte-e le a terv"**, ami tisztább célfüggvény. `assertServedModel:176-180`
   bővítendő: ma **egy** modellt vár minden generációs sorban, a 2-fázisú kör kettőt ad
   (`EvalTarget:20-34` egy rendszer-propertyből egy modellt származtat).
2. **Válasz-minőség** — **új** eval. A meglévő `ToneJudgeEvalIT:58-65` rubrikája kimondja:
   *„A tartalmi helyesség NEM számít"* — tehát a hedginget és a használhatóságot **nem** méri.
   Új rubrika kell: elkötelezettség, adatfedettség, felesleges köntörfalazás hiánya.
3. **Éles jel** — a `Segített / Nem talált` visszajelzés (`FeedbackChips.tsx:99,108`,
   négy down-reason) → `feedback_rollup` (`FeedbackLearningJob`), ami már ma visszacsatol a
   `[Rólad tanultam]` blokkba.
4. **Költség/latencia** — `llm_log` per fázis (`operation` bontásban). Bázis: §4 táblázat.
   Elvárás: `CHAT` kör **olcsóbb és gyorsabb** a mainál (1 hívás, bíráló nélkül);
   `LOOKUP`/`ANALYSIS` drágább és lassabb — ez a PO által vállalt ár.
5. `mezo-4qyt.8` (`run_id`) ennek a specnek a második use case-e: nélküle a két fázis sora
   csak idő-ablakkal köthető össze.

---

## 11. Kockázatok

| # | Kockázat | Kezelés |
|---|---|---|
| R1 | **First-token latencia ~9 s** (§4 bázis: 4090 + 4779 ms, plusz reasoning) | V1 látható fázisok **kötelező** része a szeletnek, nem utómunka; X1 párhuzamos végrehajtás; fokozatonkénti effort |
| R2 | **~12 prompt-sorrend IT némán a rossz fázist kezdi állítani** | A szeletnek **először** a fake MARKER-eket és a teszt-átirányítást kell megcsinálnia, mielőtt a fázisok élnek |
| R3 | A planner tool-nevet/argot hallucinál | P3 validátor a **élő registry** ellen + egy javító kör + fallback |
| R4 | Prompt-cache gazdaságosság romlik: a fázis-2 prefixe (voice, tool nélkül) **más**, mint a maié, de a `promptCacheKey()` ma `feature[:actor]` — azonos kulcs, eltérő prefix | A cache-kulcs fázis-komponenst kap. **Nem igazolt**, hogy egy voice-only prefix egyáltalán eléri az OpenAI minimum cache-elhető hosszát — a szeletben mérendő |
| R5 | `llm_log` sorszám duplázódik → `companion_chat` cost-per-call ~2× | `feature` marad, fázis az `operation`-ben; az admin trendhez jegyzet |
| R6 | A fokozatválasztó rendszeresen alábecsül | A2 replan + G3 felhasználói felülbírálás + a 42 esetes korpuszon előre mérhető |
| R7 | A nyers kimenet elfogyasztja a context-ablakot, ha a tool-ok kibővülnek (`mezo-rj214.1`) | §9 `outcome-max-chars` fokozathoz kötve; a `ToolOutcomeDigest` lossy markerei megmaradnak, tehát a csonkolás **látható** marad a modellnek |

---

## 12. Szeletelés (a plan-fázis bemenete)

1. **S9.1 — varrat**: `CompanionLlm` smart+history+stream default metódus; `ModelTier`
   átfűzése a beszélgetős utakon; `CallKind` döntés; `OpenAiProviderWiringIT` testvér-assert.
   `ToolOutcomeDigest` láthatóvá tétele.
2. **S9.2 — teszt-előkészítés**: `FakeCompanionLlm` fázis-MARKER-ek; a ~12 prompt-sorrend IT
   átirányítása. (R2 — **ez megy előre**.)
3. **S9.3 — fokozat**: `TurnGearAnalyzer` + `GearClassifier` + `CHAT` ág (tool-mentes, smart,
   reasoning). **Önmagában szállítható érték**: ez már ma megadja a „szabadabb beszélgetést".
4. **S9.4 — terv+végrehajtás**: `TurnPlanner`, `PlanValidator`, `PlanExecutor`, fallback.
5. **S9.5 — válasz**: `TurnAnswerer`, replan-kör, budgetek.
6. **S9.6 — fázis-események**: SSE `phase` + contract + FE (`mezo-prb9` itt szívódik fel).
7. **S9.7 — provenance**: perzisztencia + migráció + retention + Titanium UI.
8. **S9.8 — takarítás**: D1 (bíráló ki), D2 (prompt), `docs/features/companion.md` frissítés
   (`mezo-rj214.8` avultságai), ADR 0008 amendment.

S9.3 az első önállóan értékes szelet; S9.1–S9.2 tisztán előkészítés.
