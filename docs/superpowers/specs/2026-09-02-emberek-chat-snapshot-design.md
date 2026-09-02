# Emberek a chat kontextus-pillanatképben — design spec (mezo-x6oa)

*2026-09-02 · brainstorming-eredmény. Külön kör, NEM része a `mezo-06o0` epicnek — az
Emberek spec (`2026-08-31-emberek-section-design.md` §3) kifejezetten kizárta.*

## 1. Probléma és cél

A companion chat rendszerpromptja (`ChatService.assembleSystemPrompt` →
`ContextSnapshotAssembler.render`) ma semmit sem tud a felhasználó emberi köréről.
A `docs/features/me.md` §9 (4) kimondja: „mentions do NOT feed the companion snapshot".
Személynevek csak a `[Összefüggések]` gráf-blokkon át szivárognak be — opportunisztikusan,
csak a gráfba promótált (aktív) személyekre, heti irány nélkül, és a gráf-kapcsoló nélkül
sehogy.

Cél: **felismerés + óvatos utalás.** Ha Daniel egy nevet említ, a companion tudja, ki az
(kapcsolat) és hogyan áll most (e heti említésszám, hangulat-irány + indok). Magától nem
hozza szóba az embereket, harmadik félről a snapshoton túl semmit nem állít.

**Jóváhagyott döntések** (brainstorming): cél = felismerés + óvatos utalás (nem
proaktív); kör = minden aktív személy felső korláttal (12), jelölt és archivált SOHA;
sor = név · kapcsolat · heti említésszám · irány (indok); nyers idézet, `knownFacts`,
`notes` sosem; a reggeli üzenet variánsa nem kapja meg a blokkot.

## 2. Prior art

Researcher-recon (5 forrás), szűrve:

- **Átvéve — „csak számított mezők, soronként egy entitás"** — LangChain
  `ConversationEntityMemory` (https://python.langchain.com/v0.1/docs/modules/memory/types/entity_summary_memory/):
  entitásonként egy rövid tény-sor, sosem a teljes történet. Nálunk: soronként név,
  kapcsolat, heti szám, irány.
- **Átvéve — grounding-utasítás a fabrikáció ellen** — Mem0 grounded-memory
  (https://mem0.ai/blog/reducing-hallucinations-llms-with-grounded-memory) és a
  Safety4ConvAI áttekintés (https://aclanthology.org/2024.safety4convai-1.1/): a kontextusba
  csak ellenőrzött mezők kerülnek, és a prompt explicit tiltja a rajtuk túli állítást.
  Nálunk: `[Mit szabad állítani]` bekezdés-bővítés.
- **Átvéve — „jelenlegi állapot, nem halmozott történet"** — Zep/Graphiti bitemporális
  tény-ablak (https://arxiv.org/abs/2501.13956): a heti irány a mostani állapot, nem
  említés-lista. A **gráf-DB infrastruktúra elvetve** — kis kardinalitású, már strukturált
  Postgres-domain.
- **Átvéve — kis, inspektálható injektált réteg** — OpenAI ChatGPT memory
  (https://openai.com/index/memory-and-new-controls-for-chatgpt/): az injektált réteg
  rövid és olvasható marad. Nálunk a blokk szó szerint megjelenik a mentett rendszerpromptban.
- **Elvetve — LLM-mediált ADD/UPDATE/DELETE tény-pipeline** — Mem0
  (https://arxiv.org/pdf/2504.19413): nálunk a mezők determinisztikusan számítottak
  (`PersonAffectTrendCalculator`), nincs mit dedupolni.

## 3. Codebase terrain

Investigator-recon, szűrve:

- **Érintett feature-ök:** `feature/companion` (snapshot-tulajdonos), `feature/people`
  (adatforrás). FE nem érintett.
- **Kulcsfájlok:** `ChatService.java` (`SYSTEM_PROMPT` ~L66, `assembleSystemPrompt` ~L335);
  `ContextSnapshotAssembler.java` (`render` L123, `renderWithoutBiometrics` L141, blokk-
  idióma `profileBlock`…); `CompanionProperties.Snapshot` (L56, a csonkolási-budget
  precedens); `PeopleService.getBootstrap` (L62 — a heti szám + irány számítás mintája);
  `PersonAffectTrendCalculator`; `PersonEntity` (`relationshipHu`, `status`);
  `ContextSnapshotAssemblerIT` (assertion-stílus: `@Transactional`,
  `companion-fake` profil, a renderelt stringre állít).
- **Követendő minták:** (1) a `companion → people` él MÁR létezik (`ChatMentionListener`,
  `PersonGraphEdgeAdapter`), ezért közvetlen import, nincs új port (ADR 0012 csak fordított
  irányra kell); (2) a `PEOPLE_SWITCH` független a `COMPANION_SWITCH`-től →
  `ObjectProvider<PeopleService>` + `getIfAvailable`, a `HabitService`/`TodayQuestSource`
  precedens; (3) hiányzó adat → magyar `nincs adat`, sosem kitalált tartalom (ADR 0010);
  (4) a szabad szöveg csonkolási budgetje `CompanionProperties.Snapshot` mezőként él;
  (5) `renderWithoutBiometrics`: a struktúrális kihagyás precedense (nem prompt-tiltás,
  hanem a forrásnál elmarad).
- **Csapdák:** `feature_slices_are_cycle_free` FreezingArchRule — `people → companion`
  import azonnal bukik; CODEMAP-frissesség (új osztály → `node scripts/gen-codemap.mjs`
  ugyanabban a commitban, az origin/main merge UTÁN); IDENT-3 — a snapshot a `prepareTurn`
  tranzakciójában épül, a blokk sosem dobhat és sosem teheti rollback-only-vá;
  `person.affect_trend` oszlop halott (nem olvasható, a kalkulátor számol);
  csak `status='active'`; a `userId` a JWT-ből jön, sosem a modell-szövegből.
- **Elavult doc:** `me.md` §9 (4) — ez a kör frissíti.

## 4. Architektúra

```
ChatService.assembleSystemPrompt
  └─ ContextSnapshotAssembler.render(userId, today)            (chat-variáns)
       ├─ [Profil] … [Gyakorlat]
       ├─ PeopleSnapshotBlock.render(userId, today)   ← ÚJ     → "[Emberek] …"
       └─ [Táplálkozás] [Gyógyszer] [Regeneráció]
     ContextSnapshotAssembler.renderWithoutBiometrics(...)      (reggeli üzenet) — NEM hívja

PeopleSnapshotBlock (companion/service, @Service, COMPANION_SWITCH)
  └─ ObjectProvider<PeopleService>.getIfAvailable()
       └─ PeopleService.chatContext(userId, today) → List<PersonChatContext>   ← ÚJ
            ├─ PersonRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc (status='active' szűrő)
            ├─ MentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc
            └─ PersonAffectTrendCalculator.calculate(own, today)
```

### 4.1 People oldal — `PeopleService.chatContext`

- Új rekord `feature/people/service/PersonChatContext(String name, String relationshipHu,
  int mentionsThisWeek, Instant lastMentionAt /*nullable*/, String direction, String
  directionReason /*nullable*/)`.
- `@Transactional(readOnly = true) List<PersonChatContext> chatContext(UUID userId,
  LocalDate today)`: csak `status = "active"`, nem törölt. Heti szám: `ts >= now − 7 nap`
  (ugyanaz a `WEEK` konstans, mint a bootstrapnél). Irány/indok:
  `affectTrendCalculator.calculate(own, today)`. Rendezés: `lastMentionAt` csökkenő,
  a `null` (soha nem említett) a végén, azon belül név szerint. **Nincs limit** — a cap a
  fogyasztó (companion) döntése.
- A bootstrap számítása változatlan; a két hely ugyanazt a képletet használja (a heti
  szám és a trend egy privát segédfüggvénybe kerül, hogy ne kettőzzön).

### 4.2 Companion oldal — `PeopleSnapshotBlock`

- `feature/companion/service/PeopleSnapshotBlock` — `@Service`,
  `@ConditionalOnProperty(COMPANION_SWITCH)`, mezők: `ObjectProvider<PeopleService>`,
  `CompanionProperties`.
- `String render(UUID userId, LocalDate today)`:
  1. `max = properties.snapshot().peopleMaxPersons()`; ha `0` → **üres string** (a blokk
     teljesen elmarad, az assembler ekkor a sorát sem fűzi be).
  2. `PeopleService` hiányzik (PEOPLE_SWITCH ki) → `[Emberek] nincs adat`.
  3. `chatContext` üres → `[Emberek] nincs adat`.
  4. Egyébként fejléc + legfeljebb `max` sor (a lista már rendezett).
  5. Bármely `RuntimeException` → `log.warn` + `[Emberek] nincs adat` (IDENT-3, sosem
     szökik ki a `prepareTurn` tranzakciójába).
- `ContextSnapshotAssembler.render`: a `practiceBlock` után `+ peopleLine`, ahol a
  `peopleLine` az üres blokknál nem ad plusz sortörést. `renderWithoutBiometrics`
  változatlan.

### 4.3 Formátum

```
[Emberek] (aktív kör, utolsó említés szerint, max 12)
Bence — barát · 3× e héten · lefelé (többször nehéz tónus, mint korábban)
Réka — partner · 1× e héten · kiegyensúlyozott hetek
Ádám — mentorált · e héten nem került szóba · még kevés hét az irányhoz
```

- Fejléc: `[Emberek] (aktív kör, utolsó említés szerint, max N)` — az `N` a konfigból.
- Sor: `<név> — <relationshipHu> · <heti> · <irány>`.
  - `<heti>`: `k× e héten` ha `k > 0`, különben `e héten nem került szóba`.
  - `<irány>`: `up` → `felfelé (<indok>)`; `down` → `lefelé (<indok>)`; `flat` → az
    `<indok>` önmagában; `null` indok mellett (nem fordulhat elő a kalkulátornál, de
    védve) → `up`/`down`/`flat` → `felfelé`/`lefelé`/`kiegyensúlyozott`.
- Nyers idézet, `knownFacts`, `notes`, `contactCadenceLabel` **sosem** kerül a blokkba.

### 4.4 Prompt-szabály (`ChatService.SYSTEM_PROMPT`, `[Mit szabad állítani]` szakasz vége)

```
Az [Emberek] sorai Daniel emberi köre: ha egy nevet említ, onnan tudod, ki ő (kapcsolat) \
és hogyan áll most (e heti említés, hangulat-irány). Ennyit mondhatsz róluk, mást nem: \
harmadik félről eseményt, tulajdonságot, véleményt nem találsz ki. Magadtól ne hozd szóba \
őket — csak ha Daniel említi, vagy a téma egyértelműen róluk szól.
```

### 4.5 Konfig

`CompanionProperties.Snapshot.peopleMaxPersons` — `@Min(0) @Max(30)`, alap **12**;
`application.yml` `mezo.companion.snapshot.people-max-persons: 12` kommenttel
(„0 = az [Emberek] blokk elmarad"). Teszt-yml-ek, ha a `Snapshot` rekord bővítése miatt
kell, ugyanezt az értéket kapják.

## 5. Becsületes állapotok, hibadoktrína

| Helyzet | Blokk |
|---|---|
| `peopleMaxPersons = 0` | elmarad (üres string) |
| PEOPLE_SWITCH ki | `[Emberek] nincs adat` |
| nincs aktív személy | `[Emberek] nincs adat` |
| aktív személy említés nélkül | sor `e héten nem került szóba · még kevés hét az irányhoz` |
| forrás kivételt dob | `[Emberek] nincs adat` + warn (IDENT-3) |
| több személy, mint a cap | az első `max` sor a rendezés szerint, a többi elmarad, a fejléc jelzi a capet |

Jelölt (`candidate`) és archivált személy egyetlen ágon sem jelenik meg.

## 6. Tesztelés

- **`PeopleChatContextIT`** (`feature/people`, Testcontainers): (1) csak aktív — jelölt és
  archivált kimarad; (2) rendezés utolsó említés szerint, említetlenek a végén névsorban;
  (3) heti szám csak a 7 napon belüli említéseket számolja; (4) irány/indok megegyezik a
  bootstrap `PersonResponse.direction`/`directionReason` értékével ugyanarra az adatra;
  (5) törölt említés nem számít.
- **`PeopleSnapshotBlockIT`** (`feature/companion`, `companion-fake`): (1) fejléc + sorok a
  4.3 formátumban, egy `down`, egy `flat`, egy említetlen személy; (2) cap: 3 személy,
  `max = 2` → 2 sor; (3) üres kör → `nincs adat`; (4) `PeopleService` hiányzik
  (`ObjectProvider` üres, mockolt) → `nincs adat`; (5) a forrás `RuntimeException`-t dob →
  `nincs adat`, nem szökik ki; (6) `max = 0` → üres string.
- **`ContextSnapshotAssemblerIT`** +2: `render` tartalmazza az `[Emberek]` blokkot a
  `[Gyakorlat]` után; `renderWithoutBiometrics` NEM tartalmazza.
- **`ArchitectureTest`** a fókuszált kapuban (új osztály a companion-ban; `people →
  companion` import tilos).
- Chat-szintű szentinel-teszt nem kell: a prompt-szabály statikus szöveg, a blokk-beépülést
  az assembler IT-je fedi.

## 7. Docs

- `docs/features/companion.md`: snapshot-blokklista + `PeopleSnapshotBlock` + a
  prompt-szabály + `peopleMaxPersons`.
- `docs/features/me.md`: §9 (4) átírása („mentions feed the chat snapshot via
  `PeopleService.chatContext` since mezo-x6oa; the morning-message variant stays without").
- `docs/CODEMAP.md` regen.
- ADR nem kell: nincs új port, nincs új él; a döntés ez a spec.

## 8. Szeletelés

Egyetlen szelet, egy plan (`docs/superpowers/plans/2026-09-02-emberek-chat-snapshot.md`),
várhatóan 4 task: (1) `PersonChatContext` + `PeopleService.chatContext` + IT; (2)
`CompanionProperties.Snapshot.peopleMaxPersons` + `PeopleSnapshotBlock` + IT; (3)
assembler-bekötés + `SYSTEM_PROMPT` bekezdés + assembler IT; (4) docs + CODEMAP.
