# Cél oldal újratervezése — állapotközpontú Mozaik hub, ellenőrzött javaslatok és tervkapcsolatok

- **bd:** `mezo-ricj`
- **Kapcsolódó sürgős hiba:** `mezo-szsj` (P0)
- **Dátum:** 2026-09-04
- **Prototípus:** [`assets/2026-09-04-goal-hub-redesign-mockup.html`](assets/2026-09-04-goal-hub-redesign-mockup.html) (jóváhagyva)
- **Érintett living docs:** `docs/features/goal-engine.md`, `docs/features/me.md`,
  `docs/features/_platform-notifications.md`, `docs/features/_platform-design-system.md`

## 1. A probléma

A `/me/goals/weight` oldal egyszerre próbál összefoglaló, recept, figyelmeztetéslista,
idővonal és tervcsatoló felület lenni. Emiatt a felhasználó első kérdésére — **„jó úton
haladok?”** — nem ad közvetlen választ. A nagy `29%` progress önmagában nem mondja meg, hogy az
aktuális súlytrend eléri-e a célt; a receptszakaszok, guardok és tervkapcsolatok hosszú, ismétlődő
folyamban jelennek meg.

A backend audit három külön problémát talált:

1. **Kritikus cél-invariáns hiba (`mezo-szsj`).** A Diet Plan `phase_change` javaslatának
   elfogadása átírhatja a trajektóriát (`cut` → `bulk`), de megtartja az ellentétes irányú
   célsúlyt. A rate abszolút magnitúdóként tárolódik, majd az új trajektória előjelével kerül a
   kalóriaképletbe. A képernyőn látható `Hízás · 84,2 → 78 kg · 3878 kcal` ennek a hibának a
   konzisztens tünete. A jelenlegi teszt-fixture maga is enged bulk célt alacsonyabb célsúllyal.
2. **A Diet Plan értékének nagy része rejtve marad.** A `mezo-1npf` epic már szállította a
   training/rest-day kcal mezőket, a szénhidrát- és zsírcélt, a deload-javaslatot és a heti adaptív
   korrekciót, de a Cél oldal főként kcal/fehérje/alvás/ütem négyest mutat.
3. **A tervkapcsolat nem magyarázza el a hatását.** A mezociklus fázisa ma szakaszhatár, de
   önmagában szándékosan nulla TDEE-delta; a gym és sport a heti schedule-ből, a futóblokk a
   linkelt tervből kerül a számításba. A felület ezt nem teszi érthetővé, miközben a linkeknél
   hiányzik a duplikáció-, átfedés-, státusz- és célablak-validáció egy része.

## 2. Célok

- A főoldal első pillantásra válaszolja meg: **jó úton haladok-e, és mi a következő teendő?**
- A jelenlegi hosszú oldal helyett egy Huawei Health ihletésű, Design 2.0-kompatibilis Mozaik hub
  készüljön egy széles heróval és kétoszlopos, élő csempékkel.
- Minden csempe valódi, saját részletoldalra vigyen; ne legyen inert vagy dekoratív CTA.
- A már szállított Diet Plan mezői legyenek láthatók és magyarázhatók.
- A mezociklus, futóblokk és sportkapcsolat kerüljön egy `Tervkapcsolatok` csempe mögé.
- Egy javaslat megnyitása mindig teljes, szerver által számított **előtte–utána előnézetre**
  vezessen. Az első gombnyomás nem fogadhat el semmit.
- Új javaslatról a meglévő harang/in-app notification rendszer értesítsen, duplikáció nélkül.
- A célirány, célsúly és energiamérleg legyen szerveroldali invariáns; hibás állapotból ne
  készülhessen kcal-előírás.
- A tervkapcsolatok backendje legyen determinisztikus, tulajdonoshoz kötött és validált.

## 3. Nem célok

- Nem építjük újra a `mezo-1npf` Diet Plan motort, hanem annak meglévő mezőire és suggest + approve
  gerincére építünk.
- Nem becsülünk plusz energiafelhasználást pusztán a `MEV`/`MAV`/`MRV` címkéből. A súlyzós fázis
  edzésvolument jelez, nem megbízható kalóriaégetési mérést.
- Nem fogadunk el automatikusan javaslatot fázisváltáskor, mérlegeléskor vagy notification tapre.
- Nem küldünk külön készülékes Web Push-t a céljavaslatról ebben a körben; az értesítés a harang
  in-app feedjében jelenik meg. Így nem jön létre dupla értesítési út.
- Nem hozunk létre új, párhuzamos notification táblát vagy feedet.
- Nem változtatjuk meg a globális app shell, header vagy alsó tabbar szerződését.

## 4. Választott architektúra

### 4.1 Vékony, szerver által összeállított Goal Overview read model

A hub ne hat külön hook eredményéből próbálja kliensoldalon újraalkotni a cél állapotát. Új,
read-only végpont készül:

`GET /api/goals/{goalId}/overview`

A `GoalOverviewResponse` a meglévő goal engine eredményeit komponálja; nem lesz második számítási
motor. A válasz tartalmazza:

- `goalId`, `title`, `trajectory`, `status`;
- `currentWeek`, `totalWeeks`, `completionPct`;
- `currentWeightKg`, `targetWeightKg`, `remainingKg`;
- előjeles `observedRateKgPerWeek` és `targetRateKgPerWeek`;
- `dataSufficiency`, `projectedTargetDate`;
- `courseStatus`: `on_track | watch | learning | invalid`;
- rövid, adatból képzett `courseReasonCode`, amelyhez a HU szöveg a frontenden tartozik;
- az aktuális prescription segment összes Diet Plan mezője: heti átlag, mai nap típusa,
  `todayKcal`, `trainingDayKcal`, `restDayKcal`, protein/carbs/fat, `basis`;
- aktuális fázis, következő szakasz és váltási dátum;
- tervkapcsolat-összegzés: aktív linkek, heti sport schedule, uncovered/invalid hetek;
- guard összegzés és a legsürgősebb eltérés;
- nyitott javaslatok száma és legújabb javaslat azonosítója.

A státusz meghatározásának sorrendje:

1. sérült cél-invariáns → `invalid`;
2. elégtelen súlytrend → `learning`;
3. elegendő trend és a signed célütem körüli konfigurált toleranciasáv → `on_track`;
4. minden más elegendő-adatos eset → `watch`.

A tolerancia konfiguráció a `mezo.goal.overview` ág alatt él; nem frontend konstans. Alapértéke
`rate-tolerance-percent: 20` és `rate-tolerance-floor-kg-per-week: 0.10`: cut/bulk esetén az
eltérés akkor fér a sávba, ha az observed ütem előjele helyes és
`abs(observed-target) <= max(abs(target) × 20%, 0,10 kg/hét)`; maintain esetén
`abs(observed) <= 0,10 kg/hét`. `dataSufficiency=none` mindig `learning`; provisional és full már
besorolható, de a frontend az adatelégséget külön is kiírja. A megjelenített státusz ugyanazt a
szervereredményt használja mock és real módban.

### 4.2 Meglévő részletes olvasatok újrafelhasználása

A csempeoldalak az overview mellett a már létező cél-, prescription-, timeline- és plan-link
olvasatokat használják. Nem készül oldalanként új aggregáló endpoint. Egy új végpont csak ott
indokolt, ahol biztonsági okból ugyanazt a szerveroldali számítást kell előnézni és később
alkalmazni: a javaslat-diffnél.

## 5. Felhasználói felület és információs architektúra

### 5.1 A hub: `/me/goals/weight`

Az oldal egyetlen széles herót és alatta kétoszlopos Mozaikot használ.

**Hero — „jó úton haladok?”**

- Nem a százalék a fő üzenet, hanem a `courseStatus`:
  `Jó úton haladsz`, `Figyelmet kér`, `Még tanulom az ütemed`, vagy
  `A cél beállítása hibás`.
- Másodlagos adatok: jelenlegi → célsúly, tényleges és tervezett ütem, várható céldátum,
  adatelégség.
- A completion ring marad kísérő vizuálként, nem fő KPI-ként.
- Tap: a meglévő súlytrend/haladás oldal.

**Hat csempe:**

| Csempe | Hub-adat | Tap cél |
|---|---|---|
| Mai étrendi keret | mai nap típusa, kcal, P/C/F | `/me/goals/weight/diet` |
| Aktuális szakasz | fázis, hetek, hátralévő nap | `/me/goals/weight/segment` |
| Tervkapcsolatok | aktív kapcsolatok + legfontosabb rés | `/me/goals/weight/plans` |
| Védőkorlátok | rendben/összes + legfontosabb eltérés | `/me/goals/weight/guards` |
| Javaslat | legújabb nyitott javaslat rövid hatása | `/me/goals/weight/suggestions/{id}` |
| Cél beállításai | irány, célsúly, dátum | `/me/goals/weight/settings` |

A `Javaslat` csempe csak nyitott javaslat esetén jelenik meg. Eltűnése után a Mozaik természetesen
újratördeli az öt megmaradt csempét; nem marad üres lyuk.

### 5.2 Részletoldalak

Minden részletoldal megtartja az app shellt, saját színes herót és Mozaik 2.0 felületeket kap.

- **Diet:** mai training/rest nap hero, P/C/F csempék, heti training/rest ritmus, a keret forrása.
- **Segment:** aktuális fázis hero, teljes fázisfolyam, aktuális kcal/guard hatás, következő döntés.
- **Plans:** aktív kapcsolat hero, nyolchetes lane timeline, mezociklus/futás/sport szétválasztva,
  kapcsolatkezelés.
- **Guards:** összesített pajzs hero, minden guard saját státuszkártyán, a warning magyarázatával.
- **Settings:** célösszegző hero, irány, ablak, célütem és guardok; innen nyílik a meglévő edit flow.

A jelenlegi főoldalról kikerül a teljes prescription-kártyafolyam, a bullet warning lista, a teljes
timeline és a két attach-box. Ezek nem törlődnek, hanem a megfelelő részletoldalra költöznek.

### 5.3 Vizuális szerződés

- Design 2.0/Mozaik 2.0: egy hosszú hero, kétoszlopos csempék, eyebrow + egy fő adat + egy rövid
  magyarázat.
- Sage/coral/gold/sky/lavender washok és színhez igazított, rétegzett árnyékok.
- Clay spot/SVG grafika; emoji nem kerül a termékfelületre.
- Egyetlen belépő rise, ring sweep és indokolt count-up; utána nyugalom.
- `prefers-reduced-motion` alatt minden nem szükséges mozgás kikapcsol.
- A változáskártyák három fix rácssort használnak: címke, érték, delta. A `Most` és `Javasolt`
  címke és érték minden kártyán pixelazonos baseline-on áll; a jobb oldali delta nem tolhatja el
  a teljes oszlopot.
- 320, 390 és 430 px szélességen nincs vízszintes overflow, levágott érték vagy CTA-átfedés.

## 6. Javaslat-előnézet és alkalmazás

### 6.1 Új oldal, nem közvetlen accept

A hub és a harang elsődleges akciója **„Változások áttekintése”**. Ez a
`/me/goals/weight/suggestions/{suggestionId}` oldalra visz. Oldalnyitáskor semmilyen goal write nem
történik.

Új contract-first végpont:

`GET /api/goals/{goalId}/suggestions/{suggestionId}/preview`

A `GoalSuggestionPreviewResponse` tartalmazza:

- a javaslat okát, státuszát és érintett goal-heteit;
- `current` és `proposed` projectiont ugyanazzal a struktúrával;
- trajectory, célsúly, céldátum és célütem változását;
- heti átlag, training-day/rest-day kcal, P/C/F és prescription segment változását;
- guard- és tervkapcsolati hatásokat;
- explicit `unchangedFields` kulcsokat;
- `warnings` és `blockers` kódokat;
- egy `previewFingerprint` értéket.

A frontend a strukturált mezőkből építi a HU copyt. A backend nem küld HTML-t vagy vizuális
mondatokat.

### 6.2 Azonos számítás preview és accept alatt

A preview a javaslatot egy nem perzisztált goal-draftra alkalmazza, majd ugyanazt a projection és
evaluation kódot futtatja, mint az accept. Nem lehet külön „előnézeti képlet”.

A végső gomb felirata: **„Módosítások alkalmazása”**. Az accept request kötelezően elküldi a
preview fingerprintet:

`POST /api/goals/{goalId}/suggestions/{suggestionId}/accept`

`GoalSuggestionAcceptRequest { previewFingerprint }`

Accept előtt a backend újraképezi a szemantikus inputok fingerprintjét. Ha közben megváltozott a
cél, diet settings, plan-link, releváns schedule vagy a javaslat állapota, akkor
`409 GOAL_SUGGESTION_STALE`; semmi nem kerül részlegesen alkalmazásra. A frontend friss previewt
kínál fel.

A fingerprint kanonikus inputja: a suggestion id/kind/status/payload; a goal trajectory,
start/target súly és dátum, rate, balance adjustment és segment override-ok; a diet settings; az
aktív plan-link id/típus/héttartomány és a linkelt terv releváns phase/structure verziója; valamint
a számításban használt heti schedule napok és időtartamok. `prescription.generatedAt`, `createdAt`
és más technikai időbélyeg nem része: egy szemantikailag változatlan recompute nem teheti tévesen
stale-lé az előnézetet.

Az oldal két döntési művelete:

- `Módosítások alkalmazása` — csak blocker nélküli, friss preview esetén;
- `Most nem` — visszanavigál, de nem dismiss. A végleges elutasítás külön, alacsonyabb hangsúlyú
  műveletként marad elérhető.

Elfogadott, dismisselt vagy superseded deeplink történeti nézetet mutat; újraalkalmazni nem lehet.

## 7. Cél-invariáns és fail-safe működés (`mezo-szsj`)

A P0 javítás minden más slice előtt készül el.

Szerveroldali invariáns:

- `cut` esetén `targetWeightKg < startWeightKg`;
- `bulk` esetén `targetWeightKg > startWeightKg`;
- `maintain` esetén `targetWeightKg` nincs megadva;
- a célablak legalább egy teljes hét és `targetDate > startDate`.

Az invariáns ugyanazon domain validatoron fut:

- goal create/update;
- feasibility preview;
- phase suggestion preview;
- suggestion accept;
- engine evaluate belépési pont.

Egy preset-mismatch nem írhatja át önmagában a trajektóriát úgy, hogy a célsúly ellentétes marad.
Ilyenkor a suggestion preview `GOAL_DIRECTION_TARGET_CONFLICT` blockert ad, az apply gomb letilt,
és a felhasználó a cél szerkesztésére navigálhat. A rendszer nem talál ki új célsúlyt.

Már létező inkonzisztens rekordnál az engine fail-safe módon nem ad ki új kcal prescriptiont. Az
overview `invalid`, a hub coral hibaherót mutat, a Diet részletoldal pedig az érték helyén
„Céljavítás szükséges” állapotot jelenít meg. Nincs automatikus adatjavítás vagy iránytalálgatás.

## 8. Fázis, heti kalória és nap-típus

A coupling három külön fogalmat tesz láthatóvá:

1. **Heti energiaigény:** a recurring gym/sport schedule és a linkelt futóblokk ismert
   időtartamaiból számolódik. A puszta MEV/MAV/MRV címke nem talál ki égetést.
2. **Nap-típus elosztás:** az elfogadott heti keretet az existing `dayTypeShiftKcal` osztja
   training és rest napokra, a heti budget megtartásával. A Diet részletoldal mindkettőt és a heti
   átlagot egyszerre mutatja.
3. **Fázis miatti döntés:** minden releváns fázis/lifecycle esemény újraértékeli a goal engine-t.
   Az observed trend alapján az existing bounded adaptive correction javasolhat heti korrekciót;
   deload esetén továbbra is explicit tartási hét javasolható. Minden változás preview + végső
   megerősítés mögött marad.

Ha egy mezociklus csatolása után a heti kcal nem változik, a Plan/Diet részletoldalnak meg kell
mondania az okot: például „a mezociklus a heti gym schedule-t használja; a fázis most a
védőkorlátokat változtatja, nem az energiaégetés becslését”. Így a változatlanság is érthető
eredmény, nem néma hibának látszik.

## 9. Tervkapcsolatok hardening

A `Tervkapcsolatok` oldal vizuálisan és szemantikailag külön kezeli:

- **kapcsolt tervek:** mesocycle és running block;
- **heti ritmus:** gym/sport schedule, amely nem `goal_plan_link`;
- **lefedettség:** uncovered goal-hetek plan-típusonként.

Attach szabályok:

- csak ownerhez tartozó, nem archived terv csatolható;
- ugyanaz a plan egy goalhoz egyszer csatolható;
- azonos plan-típus intervallumai nem fedhetik egymást;
- `startWeek` a goal ablakán belül van;
- az `endWeek` szerveroldalon a plan hossza és a goal vége alapján képződik;
- ha a plan túlnyúlik a célablakon, a preview és response explicit `clippedAtGoalEnd=true`
  állapotot mutat; nincs rejtett vagy félreérthető truncation;
- detach/attach után az engine ugyanabban a tranzakciós flowban újraértékel, és az overview query
  invalidálódik.

A hardcoded `BVSC · végig` megszűnik. A sport lane a valódi `sport_schedule_slot` ritmust és
időtartamot mutatja. Ez a meglévő `mezo-m1l` follow-upot is lezárja.

## 10. Notification integráció

Új `AppNotificationKind`: `GOAL_SUGGESTION`.

- wire key: `goal_suggestion`;
- `familyKey = null`, tehát ebben a körben feed-only;
- deeplink: `/me/goals/weight/suggestions/{suggestionId}`;
- title: „Új javaslat a célodhoz”;
- body röviden megnevezi a javaslat típusát, de nem ígér olyan számot, amelyet a preview még nem
  ellenőrzött.

Csak valóban új `GoalSuggestionEntity` után emittálunk. Az existing open suggestion idempotens
újraértékelése nem küld új értesítést. A domain mentés `GoalSuggestionProposedEvent` eseményt ad ki;
egy `AFTER_COMMIT` listener hívja az always-on `AppNotificationEmitter` facade-ot. Így rollbackelt
javaslathoz nem marad ghost notification, és notification hiba nem törheti el a goal write-ot.

Dedup key: `goal_suggestion:{suggestionId}`.

A notification történeti feed-sor marad elfogadás/dismiss/supersede után. Tapre a review oldal az
aktuális státuszt mutatja. A harang unread badge és a feed `markAllRead` szemantikája változatlan.

## 11. Frontend állapotok és hibakezelés

- **Overview loading:** hero + hat csempe alakját követő skeleton; nincs mock seed real fallbackként.
- **Overview error:** egyértelmű retry felület; nem jelenítünk meg részleges, potenciálisan
  ellentmondó kcal-adatot.
- **No active goal:** üres Mozaik hero „Tervezz célt” CTA-val; planned célt nem címkézünk aktívnak.
- **Invalid goal:** coral fail-safe hero, nutrition értékek elrejtve, közvetlen „Cél javítása” CTA.
- **Learning:** progress és cél látszik, de on-track ítélet helyett adatelégségi copy.
- **No suggestion:** a suggestion tile nincs a DOM-ban.
- **Stale preview:** 409 után a CTA „Előnézet frissítése”; a régi diff nem alkalmazható.
- **Blocked preview:** blocker magyarázat + javító route, disabled apply.
- **Apply success:** overview/goal/suggestion/feed cache invalidation, hubra vissza, rövid success
  toast; a javaslat csempe eltűnik és az új kcal jelenik meg.

## 12. Adatfolyam

```text
goal / weight trend / prescription / plan links / schedules / guards
                         │
                         ▼
              GoalOverviewService (read-only)
                         │
                  GoalOverviewResponse
                         │
                         ▼
                Cél hub + detail pages

GoalEngine evaluate / meso lifecycle / weekly adaptive review
                         │
                         ▼
                GoalSuggestionEntity (new)
                  │                    │
                  │                    └─ AFTER_COMMIT event
                  │                              │
                  │                              ▼
                  │                    AppNotificationEmitter
                  │                              │
                  ▼                              ▼
        suggestion preview endpoint       harang + feed deeplink
                  │
        same pure draft/projection path
                  │
      final accept + fingerprint recheck
                  │
                  ▼
       persist change → evaluate → cache refresh
```

## 13. Tesztelési stratégia

### Backend integration-first

- HTTP create/update elutasítja a cut/bulk/maintain irányhibákat typed 400-zal.
- Regresszió: `84,2 → 78 kg` + `bulk` nem adhat 3878 kcal-t és nem alkalmazható suggestionből.
- Már tárolt inkonzisztens goal evaluate fail-safe, prescription nélkül/invalid overviewval.
- Overview státusz mind a négy állapotra, B-user 404-gyel.
- Overview current segment, today day-type és P/C/F mezők egyeznek a goal engine eredményével.
- Preview és accept ugyanazt a proposed projectiont adja.
- Goal/diet/link/schedule módosítás után a régi fingerprint 409.
- Blockeres preview nem acceptálható.
- Új suggestion pontosan egy feed sort emittál; idempotens re-evaluate nem duplikál; rollback nem
  hagy ghost sort; más user nem látja.
- Attach reject: foreign, archived, duplicate, overlapping, out-of-window; clipped response külön.
- Attach/detach után prescription és overview újraszámolódik.

### Frontend

- Hub mind a négy course státuszra és active/no-active goalra.
- Mind a hat csempe route-ja valódi oldalra navigál.
- Diet/segment/plans/guards/settings oldalak real és mock módban.
- Suggestion review current/proposed/unchanged/blocker/stale/accepted/dismissed állapotokra.
- A diffkártyák címke- és érték-baseline-ja azonos; delta nem tolja el az oszlopot.
- Harang deeplink közvetlenül a review oldalra visz.
- Apply csak a végső CTA-n történik, majd minden érintett query invalidálódik.
- Reduced motion és billentyűzetes fókuszút.
- 320/390/430 px Playwright layout ellenőrzés; nincs horizontal overflow vagy tabbar/CTA átfedés.
- Kötelező kapu: `pnpm build`, real `pnpm test`, mock `VITE_USE_MOCK=true pnpm test`.

### Dokumentáció és contract drift

- OpenAPI módosítás az implementáció előtt; backend és FE generált típusok frissítése.
- `goal-engine.md`, `me.md`, `_platform-notifications.md`, `_platform-design-system.md` ugyanabban
  a change-ben frissül.
- `node scripts/lint-docs.mjs` és contract-drift gate zöld.
- A teljes backend suite CI-ben az autoritatív kapu; lokálisan fókuszált integration tesztek.

## 14. Implementációs sorrend

1. **P0 invariáns és fail-safe** (`mezo-szsj`).
2. **Contract + Goal Overview read model.**
3. **Mozaik hub és az öt állandó részletoldal.**
4. **Suggestion preview/fingerprint/accept flow és a javaslat részletoldal.**
5. **In-app notification emit + deeplink.**
6. **Plan-link validáció, valódi sport lane és kapcsolatkezelés.**
7. **Vizuális/a11y hardening, teljes gate és living docs.**

Minden slice saját bd issue + `feat/<topic>` branch + self-PR/CI kapu szerint készül. A P0 után a
contract/read model és a vizuális frontend részben párhuzamosítható, de a suggestion UI csak a
preview contract véglegesítése után indulhat.

## 15. Elvetett alternatívák

### A. Csak frontend átrendezés

Gyorsabb lenne, de a hibás goal-invariáns, a suggestion preview hiánya és a plan-link validáció
érintetlen maradna. A frontend továbbra is több endpointból próbálná kitalálni a hero státuszát.

### B. Minden mezociklus-fázis automatikusan módosítja a kcal-t

Látványosabb változást adna, de a fáziscímke önmagában nem megbízható energiafelhasználási adat, és
ellentmondana a Diet Plan jóváhagyott suggest + approve biztonsági modelljének.

### C. Teljes goal/diet engine újraírás

Nem indokolt: a `mezo-1npf` már szállította a szükséges makró-, day-type-, adaptív- és suggestion
gerincet. A probléma az invariáns, a komponált read model és a felület, nem a teljes motor hiánya.
