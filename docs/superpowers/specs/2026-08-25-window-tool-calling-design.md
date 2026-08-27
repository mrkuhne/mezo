# Window-jegyzet tool-calling generálás — a napközi/napzárás jegyzet konkrétabbá tétele

**Dátum:** 2026-08-25 · **Státusz:** jóváhagyott design · **Előzmény:**
[2026-08-15-companion-feed-design.md](2026-08-15-companion-feed-design.md) (a companion feed
`midday`/`evening` kindok eredeti formája)

## 1. Probléma

A `midday` („Napközi jegyzet”) és `evening` („Napzárás”) kindok ma **szegényes, általános
üzenetet** adnak. Példa tényleges kimenet:

> „Szia Daniel! A reggeli edzés jól sikerült, de délután még egy intenzív röplabda vár rád.
> Fontos, hogy a hátralévő időben tudatosan pótold a kalóriákat és a fehérjét, különösen
> odafigyelve arra, hogy minőségi ételekből táplálkozz…”

Három gyökérok, mind a `generateWindow`-ban
(`backend/.../feature/proactive/service/CompanionMessageGenerator.java:314`):

1. **A prompt maga kér 2–3 mondatot** — `„Írj rövid (2-3 mondatos), magyar napközbeni jegyzetet…
   gyengéd fókuszt”` (`CompanionMessageGenerator.java:120-127`). A modell a prompt szerint
   viselkedik, nem hibázik.
2. **A prompt soha nem parancsolja meg a konkrét számok idézését** — csak tiltja a kitalálást.
   A pillanatkép (kcal, makró, edzésterv, alvás) ugyan benne van a payloadban, de a modell a
   tiltást konzervatívan kezeli → általánosság.
3. **Nincs tool-hívás** — a window generálás a `complete(WINDOW_PROMPT, payload)` kétstringes,
   tool-mentes overloadot használ (`CompanionMessageGenerator.java:339-341`), míg a chat a
   teljes tool-állományt regisztrálja (`CompanionToolRegistry.callbacks` +
   `RecordingToolCallback` + per-turn budget).

## 2. Döntés (a brainstorm kimenete)

- **Tool-calling window generálás** — a `midday`/`evening` LLM hívás ugyanúgy megy, mint a
  chat: a `CompanionToolRegistry`-ből a teljes tool-állomány (a 14 tool) be van regisztrálva,
  a modell maga dönt, mit húz be (pl. `get_training_plan` a mai/holnapi edzésre,
  `get_fuel_log` a makró-maradékra, `get_recovery` az alvásra). **Csak a window kindok** —
  a `morning`/`sleep`/`weight` kindok érintetlenek (másként formáznak: JSON + index-refek).
- **Hosszabb, konkrétabb prompt** — 2–4 rövid bekezdés, a konkrét számok idézése a megadott
  adatokból és a tool-válaszokból **kötelező**, ha van adat.
- **Refek bekerülnek az envelope-ba** — a window kindok eddig `refs=[]`-t kaptak; mostantól a
  tool-audit refjei landolnak a `CompanionMessageEnvelope.refs`-ben. FE-változás NEM kell
  (a feed-buborék már generikusan rendereli a refeket).
- **A determinisztikus váz marad** — pillanatkép + tudásfaktumok + utolsó napi összefoglaló +
  „MAI KORÁBBI ÜZENETEK (ne ismételd)” + „ABLAK” blokk; kód-állított eyebrow; sima próza
  (nincs JSON); summary-üresség-kapu; idempotencia. A toolok ezt **kiegészítik**, nem
  helyettesítik.

## 3. Architektúra / integrációs varrás

- `CompanionMessageGenerator`-be beinjektálom a `CompanionToolRegistry`-t. Az irány
  `proactive → companion` **már létező függőség** (a generátor már a
  `ContextSnapshotAssembler`-t és a `KnowledgeFactService`-t is onnét hívja) — nincs új
  package-cycle.
- A `generateWindow` LLM hívása változik
  (`CompanionMessageGenerator.java:339-341`):

  ```java
  // ELŐTT
  String answer = llmCallContextHolder.runWith(
          new LlmCallContext("proactive_feed", kind, null, null),
          () -> companionLlm.complete(WINDOW_PROMPT, payload));
  // UTÁNT
  ToolCallAudit audit = toolRegistry.newTurnAudit();
  String answer = llmCallContextHolder.runWith(
          new LlmCallContext("proactive_feed", kind, null, null),
          () -> companionLlm.complete(WINDOW_PROMPT, payload,
                  toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)));
  ```

  (a `CompanionLlm` 4-arg overloadja — `CompanionLlm.java:41-44` — a tool-mentes pipeline
  hívóknak maradt; a chat `ChatService.java:242-250` ugyanígy használja).
- **Budget a meglévő chat-é** (`mezo.companion.tools`, `application.yml:396-401`):
  `max-calls-per-turn: 15`, `max-refs-per-turn: 10`. Nincs új config.
- **Marker és fake-LLM dispatch változatlan** — a `NAPKOZBENI-JEGYZET-FELADAT`
  (`CompanionMessageGenerator.java:118`) és a `FakeCompanionLlm` dispatch azonos marad. A
  `FakeCompanionLlm` amúgy is meghívja a valódi tool callbackeket, így az IT determinisztikusan
  lefedi a tool-utat (a chat IT-jei ezt már ma is teszik).
- **A többi kind érintetlen** — `generateMorning`/`generateSleepReaction`/
  `generateWeightReaction` a kétstringes, tool-mentes overloadot tartják; a
  `MORNING_CANDIDATES`/`SLEEP_CANDIDATES`/`WEIGHT_CANDIDATES` index-ref-mechanika változatlan.

## 4. Prompt (új `WINDOW_PROMPT`)

A `CompanionMessageGenerator.java:120-127` helyett (a marker sor, `NAPKOZBENI-JEGYZET-FELADAT`,
marad az első sorban):

```
Írj magyar napközbeni jegyzetet Danielnek társ-szemszögből, 2-4 rövid bekezdésben,
kizárólag a megadott tényadatokból és a te eszközeidből (tool-hívások) származó adatokból.
Az ABLAK blokk mondja meg a jegyzet fajtáját:
- déli (nudge): (1) a nap EDDIGI állapota konkrét számokkal (ami már történt: edzés,
  bevitel a célhoz képest, alvás ha van); (2) mi JÖN MÉG MA (edzés, étkezési keret);
  (3) 1-2 konkrét, cselekvési szintű fókuszpont a hátralévő időre.
- esti (closing): zárd a napot 1-2 konkrét megfigyeléssel a mai tényleges adataiból (mit
  sikerült, miben maradt el a célhoz képest) + egy rövid tanulság a holnapi napra.
Szabályok:
- Konkrét számot CSAK akkor idézhetsz, ha az a megadott pillanatképből vagy egy tool-válaszból
  származik; kitalálni tilos.
- Ha a pillanatkép egy adatpontot nem ad meg pontosan (pl. mai edzésterv, makró-maradék,
  alvási fázisok), hívd meg a megfelelő eszközt, mielőtt írsz.
- Ha van MAI KORÁBBI ÜZENETEK blokk, annak tartalmát NE ismételd.
- Gyógyszer adagolására vonatkozó változtatást SOHA ne javasolj — az orvosi döntés.
- Sima folyószöveg, markdown és felsorolás nélkül.
```

A routingot a toolok saját `Használd, amikor …` leírása veszi át
(`docs/references/companion_tool_conventions.md`); a `ChatService.SYSTEM_PROMPT`
`[Eszköz-útmutató]` blokkja **nem érintett**, mert a window prompt a saját system promptja, nem
a chaté.

## 5. Refek

A window kindok eddig `new CompanionMessageEnvelope(eyebrow, List.of(answer), List.of())`
(`CompanionMessageGenerator.java:350`). Mostantól a tool-audit refjei bekerülnek:

- `audit.toRefsEnvelope()` → `List<RefsEnvelope.Ref>` (mind `(kind, id)`),
- konvertálás `List<CompanionMessageEnvelope.Ref>`-re: `new Ref(kind, label=id)`.
- A `CompanionMessageEnvelope(eyebrow, body, refs)` 3-arg konstruktort használom
  (`CompanionMessageEnvelope.java:16`) — az `interventionKey`-es 4-arg forma csak az
  `intervention` kindé, a window kindra nem vonatkozik.

**FE-változás nem kell**: `mezoMessages.ts:48-57` a `m.refs`-t pass-through-olja a
`MezoMessageItem`-re, és `MezoMessagesSheet.tsx:44-48` generikusan rendereli
(`RefTag kind label`). A `morning` kind ma már így ad refeket, tehát a buborék a ref-chipek
renderelését a window kindokon is lekezeli.

**Plan-fázisban ellenőrizendő:** a tool ref-identifikátorok alakja (dátum vs UUID vs
`kind:label`) és hogy a `RefTag` chip hogyan mutatja a `label`-t — ha egy nyers UUID vagy
dátum kerülne a chipre, akkor a konvertálásnál egy emberbarát labelt állítunk be (pl. a
`get_fuel_log` refjéből a dátumot). Ez a konvertálás egy helyen, a `generateWindow`-ban marad.

## 6. Hiba_kezelés

- **LLM- vagy tool-hiba → nincs sor** (honest absence): a `complete` kivétel vagy üres válasz
  esetén a `generateWindow` `null`-t ad vissza, warn-log (`CompanionMessageGenerator.java:342-345`
  mintájára). A lazy `GET /api/proactive/feed` a kimaradást pótolja, a cron per-user
  `try/catch`-tel fut (`CompanionMessageJob.java:67-75`) — mindkettő ma is így van, nem
  változik.
- **Idempotencia és summary-üresség-kapu változatlan** — user+dátum+kind sor már van → azt adja
  vissza; 0 daily summary az elmúlt `feed.past-days: 7` napban
  (`application.yml:1075`) → nincs üzenet.
- **Tool-hiba a loop belsejében** a Spring AI adapterben keletkezik (a chatnél is így van) —
  a modell a tool-válasz nélkül is fejezheti be a jegyzetet a pillanatképből; a hívás nem
  dől meg egyetlen sikertelen tool-calltől.

## 7. Tesztelés

- `CompanionMessageGeneratorIT` (a window kindok): az envelope refjei mostantól **nem üresek**
  — a `FakeCompanionLlm` a valódi tool callbackeket hívja, így audit refek landolnak; új
  assertion, hogy a `midday`/`evening` sor `refs`-e nem `[]`. A többi window-scenario (eyebrow
  `Napközi jegyzet`/`Napzárás`, üresség-kapu, idempotencia, „ne ismételd” blokk) marad.
- A többi kind (morning/sleep/weight) IT-jei **változatlanak** maradnak — a tool-mentes
  overloadot tartják, ref-mechanikájuk (index-candidates) érintetlen.
- Háztartási kapuk: `./mvnw clean test`; FE mindkét módban (`pnpm test` +
  `VITE_USE_MOCK=true pnpm test`) — FE-változás nem várható, de a kapu kötelező;
  `node scripts/lint-docs.mjs`.
- `docs/features/proactive.md` frissítése **ugyanabban a change-ben** — a `generateWindow`
  leírása (a `~129` sor környéke): tool-calling + a refek bekerülése az envelope-ba.

## 8. Nem cél (YAGNI)

- A `morning`/`sleep`/`weight` kindok tool-callingra nem mennek át (a scope a window kindokra
  szűkült).
- Nincs új tool — a meglévő 14 tool-állomány regisztrálódik, újdonság nem születik.
- Nincs új config (a budget a chat-é).
- Nincs FE-változás (a ref-renderelés már generikus).
- Nincs push- vagy API-kontrakt-változás (a `companion_message.content` jsonb alakja, a
  `CompanionMessageEnvelope`, és a `GET /api/proactive/feed` endpoint változatlan).
