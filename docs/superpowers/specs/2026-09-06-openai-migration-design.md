# OpenAI migráció — provider-semleges LLM-varrat, model-router, prompt-caching és per-user USD cap

- **Dátum:** 2026-09-06
- **Driving issue:** `mezo-ozri` (epic) — szeletek `mezo-ozri.1` … `mezo-ozri.6`
- **Státusz:** design approved in brainstorm, awaiting plan
- **Kiváltó kutatás:** `Documents/Research/Modell választás.pdf` (Deep Research, 2026-09-03)
- **Kapcsolódó:** ADR 0008 (companion LLM / Spring AI 2 / Gemini — amendelendő), ADR 0035 §L1
  (multi-user, a havi kvóta = L2 elvetve — **megfordítandó**), `docs/features/companion.md`,
  `docs/features/proactive.md`, `mezo-koaq` (beolvad S3-ba), `mezo-cxr8` (előfeltétel-jellegű költség-bug)

## 1. Cél

A companion LLM-rétege a Gemini Developer API-ról **OpenAI-ra** áll át: `gpt-5.6-luna` a default
chat és minden nagy volumenű strukturált feladat, `gpt-5.6-terra` a smart tier. **Az embedding
(`gemini-embedding-001`, 768 dim) és az audio-transcribe Geminin marad**, a Gemini chat pedig
fallbackként megmarad. Ezen felül a cél a **config-vezérelt model-router**, a **prompt-caching**
kihasználása és a **per-user rolling USD cap** ($5/ciklus) fokozatos degradációval.

Nem cél: Mistral vagy Claude bevezetése; a Responses API-ra állás; az embedding provider cseréje;
a `memory_embedding` legacy tábla verziózása (külön munka, lásd §8 kockázatok).

**Minden hangolható szám `application.yml`-be kerül** — modell-azonosítók, per-feature és
per-call-kind routing, reasoning effort, a cap és a küszöbei. A repo ArchUnit szabálya
(`no_spring_value_annotation`) miatt ez `@ConfigurationProperties` recordokat jelent, nem `@Value`-t.

## 2. Döntések (a brainstorm eredménye)

| Kód | Döntés | Elutasítva |
|---|---|---|
| **P1** | Két provider: OpenAI a szöveges reasoningra és tool-use-ra, Google az embeddingre és az audióra. | OpenAI-only (nincs fallback, az audiónak nincs útja); mindkettő teljes párhuzamban |
| **M1** | `gpt-5.6-luna` a default chat, `gpt-5.6-terra` a smart tier. Sol nincs automatikus útvonalon. | Terra defaultként (§4: −19% marzs); Sol smart tierként |
| **M2** | A default modellt **a saját evalunk dönti el**, nem a publikus benchmark. Luna és Terra is mérve. | Döntés HealthBench/AA index alapján |
| **E1** | Embedding marad `gemini-embedding-001` @768. | `text-embedding-3-large@768` most (§3 indoklás) |
| **A1** | Audio + vision **per-call-kind** routinggal marad Geminin. | Feature-alapú routing (nem elég: a transcribe a chat-porton megy) |
| **R1** | Router az adapteren BELÜL, a már meglévő `feature` + `CallKind` kulcsokra. | Külön routing service a hívási helyeken (56 hívás átírása) |
| **C1** | Hard cap **$5/user/billing cycle**, minden küszöb configból. Fokozatok: 70% olcsóbb modell, 90% drága cronok ritkítása, 100% AI-szünet resetig. | A kutatás $4-os javaslata (a standard COGS $2,4–3,1, a $4 túl szűk sáv) |
| **C2** | A cap beépülési pontja `LlmCallContextHolder.runWith` — az egyetlen pre-flight fojtópont. | Post-flight ellenőrzés a recorderben (a pénz már elment) |
| **Q1** | A minőség-emelés első kara a **reasoning effort**, nem a tier-váltás. | 10% Terra-szórás a default forgalomra |
| **L1** | `mezo.feature.llm-log.enabled` alapértelmezése **`true`** lesz (S1). A cap és a router mérésre épül, mérés nélkül mindkettő vak; az adapterek instrumentálása rég megvolt, élesben úgyis be van kapcsolva. | Fail-closed cap kikapcsolt log mellett; a kapcsoló meghagyása `false`-on |

## 3. Prior art

*(A `researcher` recon szűrt eredménye, 2026-09-05.)*

- **OpenAI embedding-kínálat** — [embeddings guide](https://developers.openai.com/api/docs/guides/embeddings),
  [text-embedding-3-large](https://developers.openai.com/api/docs/models/text-embedding-3-large):
  2026 szeptemberében is a 2024-es harmadik generáció az aktuális: `text-embedding-3-small`
  (1536 dim, $0.02/M) és `-3-large` (3072 dim, $0.13/M). Mindkettő támogatja a `dimensions`
  paramétert, tehát **768 kérhető** és a `pgvector(768)` séma maradhatna.
  **Elutasítva most.** Indok: (a) multilingual bizonyíték csak MIRACL-átlag (ada-002 31,4% →
  3-large 54,9%), és a MIRACL 18 nyelve **nem tartalmaz magyart** — hiteles magyar szám sehol;
  (b) a `gemini-embedding-001` GA, 2028-05-14-ig él, és a nem-angol retrieval az erőssége;
  (c) a Gemini úgyis bent marad audióra és fallbacknek, tehát a `google-genai` starter és a
  `com.google.genai.Client` bean a buildben marad — az embedding megtartása **nulla extra felület**,
  a cseréje viszont adapter-újraírás + vektortér-migráció; (d) az árkülönbség havi ~1 cent/user.
  Ha később mégis: `3-large@768`, és csak 30–50 magyar kérdés + arany-chunk eval után.
- **GPT-5.6 család** — [model catalog](https://developers.openai.com/api/docs/models):
  a kutatás nevei helyesek, a **szereposztása nem**: `gpt-5.6-sol` a flagship ($4/$20),
  `gpt-5.6-terra` a köztes ($2/$0.2 cached/$12), `gpt-5.6-luna` az olcsó nagy volumenű
  ($0.20/$0.02/$1.20). Mind: 1,05M kontextus, streaming, structured output, function calling,
  prompt caching, reasoning effort `none…max`, cutoff 2026-02-16. **Audio endpoint egyiknek sincs**
  — ez önmagában eldönti, hogy a transcribe Geminin marad.
  **Kockázat, ami a kutatásban nincs benne:** a GPT-5.6 árazás **promóciós, 2026-11-21-ig
  garantált**; aggregátorok magasabb standard árat emlegetnek (elsődleges forrásból nem
  megerősíthető). A Batch 50%-os kedvezményét sem sikerült elsődleges forrásból igazolni.
- **Spring AI OpenAI** — [reference](https://docs.spring.io/spring-ai/reference/api/chat/openai-chat.html),
  [spring-ai#2962](https://github.com/spring-projects/spring-ai/issues/2962):
  a 2.0.0 GA óta a modul a hivatalos `openai-java` SDK-t használja; a doksi **kizárólag Chat
  Completions**-t dokumentál, a Responses API támogatás **nyitott issue, 2.1.x milestone**.
  Ez nem blokkoló (a GPT-5.6 mind megy Chat Completions-ön, a state/tool-orchestrációt a Mezo
  amúgy is maga kezeli). Ismert buktatók: reasoning modellen a `temperature` hibát dob;
  `maxCompletionTokens`, nem `maxTokens`; streaming usage csak `stream-usage=true` mellett.
  **Igazolt (2026-09-06):** a `reasoningEffort` **first-class opció**, és a 2.0-s SDK-úton
  helyesen megy ki. `OpenAiChatOptions` (main): `private final @Nullable String reasoningEffort;`
  + `builder.reasoningEffort(String)`; `OpenAiChatModel.createRequest` a **v2.0.1 tagen**:
  `if (requestOptions.getReasoningEffort() != null) { builder.reasoningEffort(ReasoningEffort.of(
  requestOptions.getReasoningEffort().toLowerCase(Locale.ROOT))); }` — a hivatalos `openai-java`
  SDK `ChatCompletionCreateParams`-ára képezve, `com.openai.models.ReasoningEffort` enummal.
  A régi [#4804](https://github.com/spring-projects/spring-ai/issues/4804) szerializációs bug
  (`"reasoning"` a `"reasoning_effort"` helyett) az 1.1.0-M4 saját Jackson-alapú request-recordját
  érintette, **nem ezt az utat**. Egyetlen maradék apróság: a `ReasoningEffort.of(...)` ismeretlen
  értéket is átenged, de ha az SDK enumja régebbi a GPT-5.6 `none`/`xhigh`/`max` szintjeinél, azt
  az S4 első hívása méri ki.
- **Spring AI 2.0.1** ([releases](https://github.com/spring-projects/spring-ai/releases), 2026-08-21)
  — a projekt 2.0.0-n van (`pom.xml:32`). Patch release, bugfixekkel; a verzióemelés S2 része.
- **Adatkezelés** — [data controls](https://developers.openai.com/api/docs/guides/your-data):
  API-adat alapból nem tanít; abuse-log max 30 nap; Modified Abuse Monitoring és ZDR egyaránt
  **előzetes OpenAI-jóváhagyáshoz kötött**, ahogy az EU data residency is. Beta előtt, valós
  felhasználói adat nélkül nem blokkoló; éles indulás előtt viszont hetekben mérhető folyamat,
  tehát előre indítandó. Promptba azonosítható személyes adat ne kerüljön (a `{{NÉV}}` token
  az ADR 0035 S6 szerint már így működik), `store=false` explicit.

## 4. Unit economics

A kutatás standard boríték-szcenáriója (havi 2,4M sync input + 0,30M output; 0,30M deep + 0,045M;
1,6M batch háttér + 0,20M; 12 perc audio; 0,5M embedding), 319,35 Ft/USD, 4990 Ft bruttó
→ 27% áfa és 15% store fee után **$10,46 nettó bevétel**:

| Felállás | default | deep | batch | audio+embed | Összesen | AI utáni marzs |
|---|---|---|---|---|---|---|
| Google-only 2026 intro | | | | | $3,94 | 62% |
| Google-only 2027 lista | | | | | $7,26 | 31% |
| **Luna default + Terra smart** | $0,84 | $1,14 | $0,28 | $0,14 | **$2,39** | **77%** |
| + prompt caching (60% hit) | $0,58 | $1,14 | $0,28 | $0,14 | **$2,13** | 80% |
| Luna `high` effort + Terra smart | ~$1,56 | $1,14 | $0,28 | $0,14 | **~$3,11** | 70% |
| Terra a default chat is | $8,40 | $1,14 | $2,80 | $0,14 | **$12,48** | **−19%** |
| Claude-led kontroll | | | | | $6,39 | 39% |

**Terra defaultként nem fér bele** — rosszabb, mint a Google-only 2027-es lista. A 70%-os
marzs-célhoz a plafon $3,14/hó, tehát a Luna-alaphoz képest **~$0,75 szabad keret** van;
ez pontosan egy dolgot vesz meg. A javaslat a **reasoning effort** (ugyanaz a token-ár, minden
turnre hat), nem a 10%-os Terra-szórás (ugyanaz a költség, minden tizedik turnre hat).

**A friss main hatása a modellre (v2.103 → v2.177, 284 commit):** elhanyagolható. Az utolsó
159 commit **nulla új LLM- és embedding-hívási helyet** adott — a ~11 500 új sor determinisztikus
motor-munka. Egyetlen új visszatérő költség a hidratációs checkpoint cron
(`CompanionMessageJob:90`, `0 0 15 * * *`, edzésnapokon, ~12–16 hívás/user/hó) plusz néhány
cooldown-korlátos advice-prose hívás → **+$0,05–0,10/user/hó**. A `SHADOW` memória-mód
(`memory-platform.serving-mode` alapértelmezése) chat-turnönként +1 olcsó hívást és +1 embedet
tesz hozzá — összegében kicsi, de **mindkettő tagolatlan**, tehát láthatatlan a költség-könyvelésben.

**Heavy user:** OpenAI-led $51,5/hó retry nélkül (~16 400 Ft) — ezért a cap nem opcionális.
**A cap $5-re kerül** (a kutatás $4-ot javasolt): a standard COGS $2,13–3,11, a $4 nem
biztonsági sáv hanem szűkösség; a $5 ~1,6–2,3x fejteret ad a valós p95 megméréséig.

## 5. Codebase terrain

*(Az `investigator` recon szűrt eredménye, 2026-09-05 és 2026-09-06, HEAD = `d6594431f`.)*

**A port-design tartott: a provider-specifikus kód két fájl.** A 13 `*LlmAdapter`, a `CompanionLlm`
port, a 24 JSON-fogyasztó service, a 19 `completeSmart` hívási hely, a `FakeCompanionLlm` és a
178 fake-profilos IT érintetlen marad. Modell-azonosító a Java kódban **nincs** — csak javadocban.

| Terület | Fájl | Munka |
|---|---|---|
| Port | `feature/companion/CompanionLlm.java:20` | változatlan |
| Chat adapter | `llm/GeminiCompanionLlm.java:66-86` | `@Qualifier`; a két konstruktorbeli `ChatClient` → `Map<String,ChatClient>` |
| Usage unwrap | `llm/GeminiUsageExtractor.java:3,9` | port + OpenAI testvér (az EGYETLEN Gemini-típusos chat-fájl) |
| Round usage | `llm/GeminiRoundUsageAdvisor.java` | provider-semleges, átnevezés |
| Embedding | `llm/GeminiEmbeddingAdapter.java:55,108` | **változatlan** (E1) |
| Audio | `service/TranscriptionService.java:51-53` | call-kind routing (a CHAT ChatModelen megy) |
| Költség | `llmlog/service/LlmLogWriter.java:154-177` | provider-tudatos reasoning-szemantika |
| Cap-fojtópont | `llmlog/context/LlmCallContextHolder.java:43` | spend-check (mind az 56 tagolt hívás itt megy át) |
| Cap-könyvelés | `llmlog/repository/LlmLogRepository.java:96-104` | `sumCostSince(userId, since)` a meglévő aggregáció mellé |
| Config | `application.yml:47-54, 496-506, 507-511, 556-568` | kulcs, pricing, tierek, router, cap |
| Eval-kapu | `eval/ToolSelectionEvalIT.java:53` | **42** eset, `GEMINI_API_KEY`-re gate-elt |

**A routing kulcsa már létezik minden hívási helyen:** a `feature` string az 56 tagolt
`new LlmCallContext(...)` első argumentuma, a `CallKind` pedig az adapter metódusfejein már
kiszámolódik. A router tehát **egyetlen hívási helyet sem érint**.

**A cap könyvelése is megvan** (ADR 0035 S3/S6): `aggregateByUserSince`, `LlmActorResolver`
(JWT principal → `LlmActorContext` → null), `UserFanOut` minden cron-iteráción. A cap egy olvasó
+ döntő réteg a meglévőre — de **megfordítja az ADR 0035 L1 döntését**, amely kimondottan
elvetette a havi per-account kvótát (L2) és csak költség-láthatóságot fogadott el. Az ADR amendelendő.

## 6. Felbontás

| Szelet | bd | Függ | Tartalom |
|---|---|---|---|
| S1 Provider-semleges varrat | `mezo-ozri.1` | — | `@Qualifier`, usage-extractor port, provider-tudatos cost-képlet, a 2 tagolatlan hívás betagolása |
| S2 OpenAI adapter | `mezo-ozri.2` | S1 | starter + kulcs + sealed secret, `OpenAiCompanionLlm`, `OpenAiUsageExtractor`, round-usage, `stream-usage`, pricing-kulcsok, call-kind routing (audio/vision Geminin) |
| S3 Eval re-baseline | `mezo-ozri.3` | S2 | 42 eset × {incumbent, luna, terra}, gate-átnevezés, **a default modell go/no-go kapuja** |
| S4 Model-router | `mezo-ozri.4` | S2 | `LlmModelRouter`, per-feature + per-call-kind config, reasoning-effort **spike** |
| S5 Prompt-caching | `mezo-ozri.5` | S2 | stabil prefix a 46 tool-séma köré, cache-hit mérése |
| S6 Per-user USD cap | `mezo-ozri.6` | S1, S4 | `sumCostSince`, döntés a `runWith`-ben, $5 + küszöbök configból, 3 fokozat, ADR 0035 amend |

S4 és S5 párhuzamosítható S2 után; S6 a degradációhoz S4 routerét használja.

## 7. Config-felület (`application.yml`)

Minden új kulcs egy blokkban, kommentelve, a repo mai stílusában. Vázlat:

```yaml
mezo:
  companion:
    llm:
      provider: gemini                # melyik adapter felel a chat-fordulóra
      gemini:
        chat-model: gemini-2.5-flash
        smart-model: gemini-2.5-pro
        feature-models: {}            # <feature> -> model id; üres = tier-alapú
        call-kind-models: {}          # CallKind -> model id; erősebb a feature-modelsnél
        reasoning-effort: { chat: , smart: }
      openai:
        chat-model: gpt-5.6-luna      # cheap/fast tier
        smart-model: gpt-5.6-terra    # smart tier (19 completeSmart hívás)
        feature-models: {}
        call-kind-models: {}
        reasoning-effort: { chat: , smart: }
      per-call-kind:                  # CallKind -> PROVIDER (nem model id)
        TRANSCRIBE: gemini            # audiónak nincs GPT-5.6 útja
        VISION: gemini                # amíg az A/B nem dönt
  llm-log:
    pricing:
      models:
        "[gpt-5.6-luna]":  { input-per-million: 0.20, output-per-million: 1.20, cached-per-million: 0.02 }
        "[gpt-5.6-terra]": { input-per-million: 2.00, output-per-million: 12.0, cached-per-million: 0.20 }
    budget:
      enabled: true
      hard-cap-usd: 5.00              # per user / billing cycle
      degrade-at-percent: 70          # olcsóbb modellre routolás
      throttle-cron-at-percent: 90    # drága proaktív cronok ritkítása
      stop-at-percent: 100            # AI-szünet resetig
      degrade-model: gpt-5.6-luna
```

**Amendment (S4, 2026-09-07).** A model-override táblák **szolgáltatónként** vannak, nem egy közös
`per-feature`/`per-call-kind` lapban, ahogy ez a vázlat írta. Ok: egy model-azonosító csak annál a
szolgáltatónál értelmes, aki ki tudja szolgálni, és a `gemini` blokk a `provider: openai` alatt is
terhelt (audio, vision, fallback) — egy közös tábla tehát egy delegált transcribe-híváson GPT-idt
adhatna a Gemini kliensnek, amit a config-review nem fogna meg, csak a futásidő. A §R1 döntés (a
router az adapteren belül, a meglévő `feature` + `CallKind` kulcsokra) változatlan. A
`per-call-kind` kulcs megmarad, de az továbbra is **szolgáltatót** választ, nem modellt; a modell-
szintű megfelelője a `<provider>.call-kind-models`. A `feature-models` kulcsait — a pricing-
kulcsokhoz hasonlóan — **szögletes zárójelbe** kell tenni (`"[companion_chat]"`).

A pricing-kulcsok **szögletes zárójelben** kötelezőek (a binder a pontot map-kulcs-határolóként
kezeli); a `mezo-2zyu` `LlmPricingPropertiesBindingTest` ezt őrzi. A Gemini pricing-sorok
maradnak (embedding, audio, fallback).

## 8. Kockázatok és csapdák

1. **Két `ChatModel` bean.** A `GeminiCompanionLlm` konstruktora bare `ChatModel`-t vesz
   (`:66`). Az OpenAI starter felkerülésével ez **minden** contextben boot-time
   `NoUniqueBeanDefinitionException` — a 178 fake-profilos IT-t is beleértve. Ezért van S1 külön
   szelet: a `@Qualifier` **a starter előtt** kell.
2. **A Google startert nem lehet elvenni.** A `GeminiEmbeddingAdapter` a starter által adott
   `com.google.genai.Client` beant injektálja (`:55`); az elvétele az embeddinget és a
   `GoogleGenAiUsage` unwrapet is megöli.
3. **`completeSmart` interface-default.** Ha az OpenAI adapter nem override-olja, mind a 19
   smart-tier hívás (heti/negyedéves review, hipotézis-kritika, memoir, konzílium, profil)
   **némán, hibaüzenet nélkül** a cheap tierre esik.
4. **Multi-round tool-usage.** A `GeminiRoundUsageAdvisor` azért létezik, mert a Spring AI
   kumulatív usage-e elejti a `thoughts`/`cached` mezőket a tool-loopban. Egy naiv, egyszeri
   `getUsage()`-t olvasó OpenAI adapter **alulkönyvelné a legnagyobb volumenű utat**, a chatet.
5. **Reasoning-token dupla számlázás.** A mai `applyCost` a `thinking`-et az `output` *mellé*
   számolja — Geminire helyes, OpenAI-ra hibás (a reasoning a completion része).
6. **Streaming usage.** `stream-usage=true` nélkül minden streamelt sor null tokennel és null
   költséggel íródik — csendben.
7. **Az `llm-log` alapértelmezés-flip (L1) egyetlen ITt tör el.** `application.yml:330` ma
   `false`; a `deployment.yaml:96` kapcsolja be élesben. A flag-re négy teszt hivatkozik, mind
   **explicit** property-vel — egy kivétellel: `CompanionMemoryLlmUsageDisabledIT` (`:16`) a
   *hallgatólagos* defaultra épül ("a teszt-default"), tehát kapnia kell egy explicit
   `mezo.feature.llm-log.enabled=false`-t. Stale javadoc két helyen: `LlmLogRecorderWiringIT:21`
   ("the shipped default") és `application.yml:327-328` ("DEFAULT OFF until the adapters are
   instrumented" — az instrumentálás 56 tagolt hívással rég kész).
8. **Két tagolatlan LLM-hívás.** `LlmMemoryReranker:83` (smart tier!) és `LlmMemoryQueryRewriter:28`
   megkerüli a `runWith`-et → sem a router, sem a cap nem látja őket, és `unknown` feature-ként
   könyvelődnek. S1 betagolja őket.
9. **A `FakeCompanionLlm` dispatch a prompt-prefixekre épül** (`CompanionMessageGenerator:75,100,
   114,139` konstansai szó szerint duplikálva). Bármely prompt-átrendezés (S5!) eltöri a fake
   dispatchét és vele az egész IT-felületet.
10. **`GEMINI_API_KEY` négy helyen** (`application.yml:54`, `deployment.yaml:80-84`,
    `sealedsecret.yaml`, `ToolSelectionEvalIT:53`) — **marad**, mellé jön az `OPENAI_API_KEY`.
    A sealed secret újrapecsételése all-or-nothing, a kulcs cluster-specifikus.
11. **A legacy `memory_embedding` táblának nincs verzió-oszlopa**, és minden író azt célozza;
    a `memory_vector` verziózott, de csak projekció. Amíg az embedding Geminin marad, ez nem
    aktív kockázat — de bármely jövőbeli embedding-csere előfeltétele.
12. **`spring-ai` 2.0.0 → 2.0.1** (S2). Ellenőrizni kell, hogy a `GeminiRoundUsageAdvisor.ORDER = 0`
    kalibrációja és a "usage csak az utolsó chunkon" streaming-feltevés a patch után is áll.
13. **Promóciós árazás 2026-11-21-ig.** A költségmodellt ekkor újra kell futtatni.
14. Standard kapuk: CODEMAP-frissesség, contract-drift, ArchUnit (`feature_slices_are_cycle_free`
    frozen rule, `no_spring_value_annotation`), Testcontainers a backend-suite-hoz.

## 9. Beolvadó és kapcsolódó bd issue-k

- **`mezo-koaq`** ("Companion chat-model tier kísérlet — 2.5-flash vs 2.5-pro") → beolvad S3-ba,
  már GPT-vel.
- **`mezo-cxr8`** (W2.3: egy csendes éjszaka minden újrafutáskor újra elkölti az LLM-et, mert
  nincs feldolgozott-nap marker) — valódi költség-szivárgás. A cap **elfedné** ahelyett, hogy
  megjavítanánk; érdemes S6 előtt zárni.
- **`mezo-x4nd`** (review advisor latency/cost valós kulcs után) — S3 mérése adja meg az adatot.

## 10. Nyitott kérdések

1. ~~Reasoning effort átadható-e a Spring AI 2.0.0 `OpenAiChatOptions`-ből?~~ **Eldöntve
   (2026-09-06): igen**, first-class opció, a v2.0.1 forrásában ellenőrizve (§3). A spike elmarad,
   S4 ennyivel kisebb: a reasoning effort egy config-kulcs, nem adapter-réteg.
2. ~~Fail-closed vagy bypass, ha az `llm-log` ki van kapcsolva?~~ **Eldöntve (L1):** a kapcsoló alapértelmezése `true` lesz S1-ben, tehát a cap mindig lát. Aki kikapcsolja, a capet is kikapcsolja — ez explicit, dokumentált következmény.
3. **Vision A/B**: a `meal_draft`/`sleep_shot`/`pantry_photo` képi útvonalak Lunán vagy Geminin?
   Amíg nincs mérés, a config Geminin hagyja. A `meal_draft` prompt közben szélesebb JSON-t kér
   (rost/cukor/só/telített zsír) — ezt a szerződést újra kell validálni az új providernél.
4. **ZDR / EU residency** kell-e a GDPR-narratívához éles indulás előtt? Ha igen, a sales-folyamat
   most indítandó, nem a launch hetében.
