# Companion-feed — az esemény-vezérelt reggeli briefing újragondolása

**Dátum:** 2026-08-15 · **Státusz:** jóváhagyott design · **Előzmény:**
[2026-07-06-proactive-layer-design.md](2026-07-06-proactive-layer-design.md) (B/H stage)

## 1. Probléma

A mai reggeli briefing (B1.2) három ponton pontatlan, és a gyökérok közös: **a generálás
időpontjában még nincsenek meg a reggeli adatok, a bemenetei pedig részben elavult forrásból
jönnek.**

1. **Alvás** — a 05:45-ös `BriefingJob` cron a reggeli alvásnapló-rögzítés ELŐTT fut, így a
   snapshot a legutóbbi (= előző éjszakai) alvást adja a modellnek, ami azt „ma éjjelként"
   fogalmazza meg. A sleep-triggered regen (szerver-oldali `refreshIfStale`) létezik, de a FE
   TanStack Query cache-e alvásrögzítéskor nem invalidálódik — a Today kártya a reggeli
   cache-elt verziót mutatja app-újratöltésig.
2. **Súly** — a snapshot `[Profil]` blokkja az EWMA-simított trendértéket adja („súlytrend: X
   kg"), nem a legutóbbi mérést; a modell aktuális súlyként idézi. A regen-trigger ráadásul
   csak alvásnaplóra reagál — a reggeli mérés soha nem frissíti a briefinget.
3. **kcal** — a `[Mai üzemanyag]` blokk a `FuelDayService` targetjeit idézi, amik a statikus
   configból jönnek (`mezo.nutrition.targets.kcal: 3100`), miközben a goal engine
   (`TdeeBootstrapService` + `GoalProjectionService` + prescription-szegmensek) kiszámolja a
   valós napi keretet (TDEE − deficit, hetente lépcsőzve).

## 2. Döntés (a brainstorm kimenete)

- **Többfokozatú, esemény-vezérelt üzenetek** egyetlen briefing helyett: a hajnali eligazítóban
  NINCS alvás/súly; az alvás-üzenet az alvásnapló rögzítésekor, a súly-üzenet a méréskor
  születik — minden üzenet friss adatból.
- **Chat-szerű feed** a Today oldalon, a mostani briefing-kártya helyén; a napközbeni
  heartbeat-üzenetek (déli nudge, esti zárás) ugyanebbe a feedbe olvadnak.
- **Push minden üzenetről** a meglévő N1–N3 web-push spine-on.
- **kcal-forrás mindenhol a goal engine**: a `FuelDayService` céljai az aktív cél
  prescription-szegmenséből; a fix config csak fallback.
- **Új általános `companion_message` tábla**; a régi `briefing` + `heartbeat_note` tábla és
  endpointjaik kivezetve, **adatmigráció nélkül** (a régi generált sorok eldobhatók).

## 3. Üzenetfajták

| Kind | Trigger | Tartalom |
|---|---|---|
| `morning` | cron ~05:45 (marad) | Napi eligazítás: mai edzés/terv, valós kcal-keret a goal engine-ből, gyógyszer-ciklus, hét-trend, 2-3 fókusz. **Alvás és súly témája a promptban tiltva.** |
| `sleep` | alvásnapló rögzítése | A ma éjjeli alvás kiértékelése + mit jelent a napra. Ha a cron előtt logolt, a cron a morning után ezt is legyártja. |
| `weight` | súlymérés rögzítése | Reakció a friss mérésre trend-kontextusban (mérés + EWMA-trend megkülönböztetve). |
| `midday` | cron 12:30 | Napközbeni nudge (a heartbeat-nudge utódja). |
| `evening` | cron 20:30 | Esti zárás (a heartbeat-closing utódja). |

Minden későbbi üzenet promptja megkapja a nap korábbi üzeneteit „ne ismételd" blokkban (a
heartbeat `MAI BRIEFING (ne ismételd):` idiómája általánosítva).

## 4. Adatmodell

Új `companion_message` tábla: UUID PK, `created_by`, soft-delete, `message_date date`,
`kind varchar(16)` (CHECK: a fenti 5 érték), `content jsonb` (a meglévő
`BriefingContentEnvelope` idióma: `{eyebrow, body[], refs[]}`), `generated_at`.
**Partial unique: egy LIVE üzenet / user+nap+kind** — aznapi második súlymérés nem szül új
üzenetet (idempotens). A `briefing` és `heartbeat_note` tábla külön changesetben drop-olva
(kiadott changesetek érintetlenek — a drop új changeset).

## 5. Generálás és triggerek

- **Cron-fajták** (`morning`/`midday`/`evening`): a `BriefingJob` + `HeartbeatJob` egy közös
  `CompanionMessageJob`-ba olvad, kind-enkénti cron-configgal, a meglévő hármas-kapcsoló
  mintával (companion + proactive + job switch).
- **Esemény-fajták** (`sleep`/`weight`): a sleep-log és weight-log írási útja Spring
  application eventet publikál; `@TransactionalEventListener(AFTER_COMMIT)` + `@Async`
  generál (a mentés latencyjét nem terheli LLM-hívás). Csak friss logra triggerel (súly:
  aznapi; alvás: `date >= tegnap`); múltbeli pótlás nem szül üzenetet.
- **Lazy read fallback**: a feed-GET a cron-fajták már-elapsed ablakát legyártja, ha hiányzik
  (miss-recovery, a heartbeat `CronExpression`-ből derivált ablak-idióma).
- **Honest absence**: nincs alvásnapló → nincs sleep-üzenet; üres narratív-ablak → nincs
  morning (a 404/üres-szabály marad). Soha placeholder-fikció.
- **A sleep-triggered regen (`refreshIfStale`, `regen_count`) törölve** — az esemény-trigger
  kiváltja.

## 6. kcal-forrás egységesítés

`FuelDayService.targetSet()`: aktív cél esetén kcal + fehérje az aktuális
prescription-szegmensből (`GoalPrescriptionJson.currentSegment` — ez már a TDEE − deficit
eredménye); szénhidrát/zsír/víz configból marad (a goal engine ma csak kcal+protein-t ír
elő). Nincs aktív cél → a mai fix config a fallback. Ezzel a Fuel oldal, a snapshot, a chat
és a feed ugyanazt látja; a fix 3100 eltűnik minden AI-promptból.

A snapshot `[Profil]` blokkja bővül: a trend mellé a **legutóbbi tényleges mérés + dátuma**
(„mérés: 96,4 kg (2026-08-15); trend: 97,1 kg") — a modell ne a simított trendet mondja
aktuális súlynak.

## 7. API + frontend

- **Új endpoint:** `GET /api/proactive/feed?date=` → a nap üzenetei időrendben (`200 []` =
  honest üres). Contract-first: `api/feature/proactive/proactive.yml`; a régi
  `GET …/briefing` + `GET …/heartbeat` műveletek törölve.
- **Today UI:** a briefing-kártya helyén a feed — üzenetenként kis kártya (kind-ikon,
  időbélyeg, próza, ref-chipek); a `CompanionNoteCard` mint külön kártya megszűnik. Mock
  mód: a Phase-1 statikus demo-kártya marad (byte-parity elv).
- **Invalidálás:** az alvás- és súly-mutation `onSuccess` invalidálja a feed query-t; mivel a
  generálás async, a FE rövid újrapollozással (pl. 3×5 mp) várja be az új üzenetet.

## 8. Push

- Cron-fajták a meglévő anchor-modellben: `BRIEFING` (morning), `MIDDAY` (midday) + új
  `EVENING` kategória.
- Esemény-fajták: a generálás után **közvetlen dispatch** (`PushDispatchExecutor` +
  `push_log` dedup) — időpontjuk nem horgonyozható. Két új preferencia-kategória:
  `sleep_reaction`, `weight_reaction`.

## 9. Tesztelés

- `ApiIntegrationTest` a feed-GET-re: üres nap, cron-kind lazy generálás, event-kind trigger
  sleep/weight POST után, idempotencia (második mérés), honest absence, múltbeli-pótlás nem
  triggerel.
- `FakeCompanionLlm`: kind-enkénti új sentinel-markerek (a literal-mirror szabály marad).
- `FuelDayService`: goal-engine target aktív céllal + config-fallback cél nélkül.
- FE: mindkét mód zöld (`pnpm test` + `VITE_USE_MOCK=true pnpm test`), mock byte-parity.

## 10. Nem cél (YAGNI)

- Nincs üzenet-archívum/history-nézet (a feed mindig egy nap).
- Nincs üzenet-reakció/interakció (olvasó felület).
- Nincs multi-day backfill (a múlt reggeli üzenete sosem kell — a lazy GET a miss-recovery).
- A weekly/memoir/prediction/experiment felületek érintetlenek.
