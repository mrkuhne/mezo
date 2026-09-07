# Karakter konzílium: szál-nézet + valódi kereszt-vita kör

**bd:** mezo-xlvr · **Dátum:** 2026-09-06 · **Státusz:** jóváhagyott terv

## 1. A probléma

A heti konzílium átirata ma egyetlen lineáris próza-folyam: minden szakértő kap egy
buborékot a javaslataival, a Szkeptikus egy buborékot `P0: KILL — …` sorokkal, Mezo egy
buborékot `P0: ELUTASÍTVA (0.9) — …` sorokkal, majd egy `Új fejezet: …` sor. Aki elolvassa,
nem látja, ki mire reagált: a kapcsolatot csak a `P` sorszám hordozza, három külön buborékban,
egymástól több képernyőnyi görgetésre.

A tanácskozás szerkezete **már létezik** a futás memóriájában
(`KonziliumVerdictRound.SkepticVerdictDraft{index,verdict,argument}`,
`ClaimRuling{accepted,ruledConfidence,reason}`, mindkettő ugyanazzal a javaslat-indexszel),
csak két `StringBuilder` prózává lapítja mentés előtt
(`KonziliumVerdictRound.java:189-200` és `:241-255`), és a `refIds` mezőt mindkét turn
üresen hagyja. A szerkezet eldobása a hiba, nem a hiánya.

Két további, ugyanitt jelentkező hiba tartozik a csomaghoz:

- A felhasználói visszajelzésből született megfigyelés szövege géppel olvasható előtaggal
  kezdődik (`CharacterFeedbackService.java:123`), és a feed ezt szó szerint kiírja, így a
  Feed oldalon `[ac2179ef-…] A felhasználó megerősítette: "…"` jelenik meg.
- A Feed oldal egyetlen lekérés összes tételét kirendereli nap szerint csoportosítva, vége
  nélküli görgetés érzetét keltve.

## 2. Prior art (recon: researcher)

- **GitHub PR review threadek** ([docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request)) —
  minden szál egy konkrét tételhez horgonyzott, saját lokális sorrenddel és lezáró
  művelettel. **Átvéve:** tétel-első rendezés beszélő-első helyett. **Elkerülve:** a szabad
  mélységű válasz-fűzés, ami keskeny kijelzőn függőlegesen szétesik; a mi mélységünk fix.
- **Microsoft Engineering Playbook Design Decision Log**
  ([forrás](https://microsoft.github.io/code-with-engineering-playbook/design/design-reviews/decision-log/)) —
  dátumozott döntés-rekord: javaslat, ki nézte át, kimenet, indoklás; nem chat-átirat.
  **Átvéve:** a kimenet a szál fejlécén látszik, mielőtt a vitát kinyitnád.
  **Elkerülve:** hogy ez legyen az EGYETLEN nézet, mert akkor a deliberáció tűnik el.
- **Kialo pro/kontra fák** ([forrás](https://en.wikipedia.org/wiki/Kialo)) — **átvéve:**
  a támogat/vitat színkódolás. **Elkerülve:** a rekurzív, tetszőleges mélységű fa; a mi
  láncunk fix mélységű (felvetés → társak → Szkeptikus → Mezo).
- **AutoGen GroupChat** ([forrás](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/group-chat.html)) —
  negatív minta: a beszélő-rendezett broadcast log az ágens-végrehajtásra van optimalizálva,
  nem emberi olvasásra. Pontosan ez a mai állapotunk.
- **LangGraph trace nézet Langfuse-ban**
  ([forrás](https://langfuse.com/docs/observability/features/agent-graphs)) — a reakció-élek
  explicitté tétele a bevett megoldás. **Elkerülve:** a tényleges gráf-widget; telefonon a
  pásztázás és a kis célfelületek használhatatlanok. Az élt kártya-szerkezetként rajzoljuk meg.

## 3. Codebase terrain (recon: investigator)

- **Tárolás:** `CharacterConferenceEntity` (`entity/CharacterConferenceEntity.java:35-60`) —
  `transcript` jsonb (`ConferenceTranscriptEnvelope{List<Turn{persona,text,refIds}>}`) és
  `outcome` jsonb (`ConferenceOutcomeEnvelope{List<Change{kind,dimensionKey,claimId,summary}>}`).
  A kimenet-oldal **már strukturált**, az átirat-oldal nem. Ez a követendő minta.
- **Kör-vezénylés:** `CharacterConferenceService.java:92-101` — javaslat-kör, verdikt-kör,
  a turnök összefűzése, mentés.
- **Szerződés:** `api/feature/character/character.yml:201-228` (`ConferenceTurn`,
  `CharacterConferenceResponse`), `:52-70` (`GET /api/character/feed`, csak `limit` paraméter).
- **Felület:** `frontend/src/features/character/pages/KonziliumPage.tsx` (`buildBlocks`
  fázis-csoportosítás), `components/TranscriptTurn.tsx`,
  `pages/CharacterFeedPage.tsx` (`groupByDay`), `data/character/characterHooks.ts`.
- **Követendő minták:** `SignalChainCard.tsx` a lánc-vizualizációra; `confidenceWord()`
  (`characterApi.ts:22-31`) — a magabiztosság sosem nyers szám a felületen; `useDualQuery`
  minden hookban, hozzá kézzel karbantartott `characterMock.ts`.
- **Csapdák:** `feature/character` ArchUnit-ciklusok (a `character → people` és
  `character → quest` él egyirányú, a freeze store nem nyúlható); a `CHARACTER_SWITCH` /
  `COMPANION_SWITCH` szétválasztás (a generálás companion-t igényel, az olvasás nem);
  a `docs/CODEMAP.md` frissesség-kapu; a `-Dtest` szűrő kihagyja a `@Nested` osztályokat.

## 4. Döntések

| Kérdés | Döntés | Miért |
|---|---|---|
| Adatforrás | Új strukturált jsonb, a próza-átirat megmarad | A szerkezet már megvan a futásban, csak ne dobjuk el |
| Régi konzíliumok | Olvasáskori visszafejtés, nincs adatmigráció | A verdikt-sorok gépi formátumúak, determinisztikusan bonthatók |
| Több szakértő egy témán | Valódi kereszt-vita kör | A puszta csoportosítás azt sugallná, hogy reagáltak egymásra, holott nem |
| Kereszt-vita hatóköre | Csak ahol 2+ szakértő érintett egy fejezetet | A költség így a vitás fejezetekre korlátozódik |
| A reakció ereje | Állásfoglalás + indoklás, Mezo prompt-ja látja | Valódi súlya van, de a döntés egy kézben marad |
| Szál alapállapota | Minden összecsukva | A lap egy képernyőre fér, a részlet koppintásra jön |
| `P0`/`P1` jelölés | Eltűnik | Csak a próza-átirat összekötésére kellett |

## 5. Adatmodell

Új jsonb oszlop a `character_conference` táblán, Liquibase changeSettel:

```java
/** A tanácskozás szerkezete, ahogy lezajlott — szálakra bontva (mezo-xlvr). */
public record ConferenceDeliberationEnvelope(List<Thread> threads) {

    /** Egy szál = a dosszié egy fejezete, amiről szó volt. */
    public record Thread(String dimensionKey, String title, List<Item> items) {}

    /** Egy javaslat a teljes láncával. */
    public record Item(int index, String expertKey, String text, String kind, String claimId,
                       boolean sensitive, List<PeerReaction> reactions,
                       SkepticVerdict skeptic, ChairRuling chair) {}

    /** Egy társ-szakértő állásfoglalása. stance: SUPPORT | CHALLENGE | NUANCE. */
    public record PeerReaction(String expertKey, String stance, String argument) {}

    /** verdict: KEEP | KILL. */
    public record SkepticVerdict(String verdict, String argument) {}

    public record ChairRuling(boolean accepted, BigDecimal confidence, String reason) {}
}
```

`title` a fejezet saját neve: az adott felhasználó `character_dimension` sorának `title`
mezője, ha létezik, különben a katalógus címe (`CharacterCoreCatalog.CoreDimension.title`),
végső esetben maga a kulcs. Nem generálunk címet.

A `skeptic` és a `chair` lehet `null`, ha az adott kör válasza nem volt értelmezhető.
A felület ilyenkor nem talál ki lezárást, hanem kiírja, hogy az a kör nem adott választ.

## 6. Kereszt-vita kör

Új osztály, `KonziliumCrossTalkRound`, a javaslat-kör és a verdikt-kör közé illesztve
(`CharacterConferenceService.java:92-93`).

1. A javaslatokat `dimensionKey` szerint csoportosítja. `NEW` javaslatnál ez a mezője,
   `UP`/`DOWN`/`RETIRE` esetén a hivatkozott claim dimenziója.
2. Csak azok a csoportok maradnak, ahol legalább két **különböző** `expertKey` szerepel.
3. Minden ilyen csoportban minden érintett szakértő kap egy hívást, a saját personájával.
   A hívás bemenete a csoport összes javaslata, sorszámmal; a sajátjai jelölve, hogy azokra
   ne szóljon hozzá.
4. Kimeneti szerződés, a ház mintája szerint:
   `[{"index":0,"stance":"SUPPORT|CHALLENGE|NUANCE","argument":"..."}]`.
5. Hívás-korlát konferenciánként (`MAX_CROSS_TALK_CALLS = 6`), a legtöbb szakértőt érintő
   csoportoktól lefelé. A korlát fölötti csoportok reakció nélkül maradnak, ez nem hiba.
6. Nem értelmezhető válasz esetén az adott szakértő nem ad reakciót, és a kör fut tovább.
   Ugyanaz a `parsed` jelzés-mintázat, ami a Szkeptikusnál már működik.

**Ami nem változik:** a Szkeptikus köre. Ő ma is minden javaslatot lát, és a reakciókat nem
kapja meg. Így pontosan egy ponton változik a bírálati lánc.

**Ami változik:** Mezo prompt-ja a Szkeptikus verdiktjei mellé megkapja a társak
állásfoglalásait, javaslatonként csoportosítva.

## 7. Szerződés

`CharacterConferenceResponse` új, nem kötelező `deliberation` mezőt kap, a `transcript`
megmarad mellette. Új sémák: `ConferenceThread`, `ConferenceItem`, `ConferencePeerReaction`,
`ConferenceSkepticVerdict`, `ConferenceChairRuling`. A `stance` és a `verdict` zárt enum.

A `GET /api/character/conference/{id}` mindig kitölti a `deliberation` mezőt, ha a sor
hordozza vagy visszafejthető, különben elhagyja.

## 8. Régi konzíliumok visszafejtése

Olvasáskor, a szolgáltatásban, mentés nélkül. A visszafejtő új osztály:
`service/LegacyTranscriptParser`.

- A javaslat-indexek sorrendje a szakértő-turnök sorrendjéből áll össze: a turn első sora a
  fejléc, minden további sora egy javaslat szövege, a globális index pedig a turnökön
  végigfutó számláló. Pontosan így épül ma is a lista (`KonziliumProposalRound.run`).
- A Szkeptikus turn `P<index>: KEEP|KILL — <indoklás>` soraiból jön a verdikt.
- A Mezo turn `P<index>: ELFOGADVA|ELUTASÍTVA (<szám>) — <indoklás>` soraiból a döntés.
- Régi soroknál **szakértő szerint** áll össze a szál, címe a szakértő neve, mert a fejezet
  hovatartozás nincs az átiratban, és nem találjuk ki. A `dimensionKey` ilyenkor `null`.
- Reakció nincs, mert nem is volt.
- Ha bármelyik lépés nem illeszkedik, a visszafejtés `null`-t ad, és a felület a mai lineáris
  átirat-nézetet mutatja.

## 9. Felület

**Konzílium oldal.** A `deliberation` jelenlétében szál-nézet, különben a mai
`TranscriptTurn` nézet. Változatlanul marad a kimenet-csempe blokk és a záró
őszinteség-mondat.

- Új komponens `ConferenceThreadCard`: fejléc a hozzászólók orbjaival, a fejezet nevével és
  egy összefoglaló sorral („N állítás · M maradt meg"), alapból összecsukva.
- Összecsukott állapotban tételenként egy sor: kimenet-jelvény és az állítás szövege, az
  elvetettek halványan.
- Nyitva a lánc időrendben: felvetés, társak állásfoglalásai, Szkeptikus, Mezo. Minden lépés
  a szakértő orbjával és a saját színével.
- A magabiztosság `confidenceWord()`-del, sosem nyers számmal.
- Az állásfoglalás színe: támogatom zöld, vitatom vörös, árnyalom semleges.

**Feed oldal.** A legfrissebb nap nyitva, a korábbi napok összecsukva, a nap fejlécén a
tételszámmal. A nyitás per-nap állapot a komponensben, nem tárolt beállítás.

## 10. A két hiba

**Azonosító a megfigyelés szövegében.** A `CharacterFeedbackService` a szöveget előtag
nélkül menti. A claim azonosítója ma is ott van a megfigyelés jel-hivatkozásában
(`ObservationSignalsEnvelope.Signal.refIds`, `CharacterFeedbackService.java:230`), tehát nem
vész el. A konzílium bizonyíték-sorát építő `KonziliumProposalRound` innen oldja fel, és ő
teszi elé a `[claimId] ` előtagot, amire a prompt-szerződése hivatkozik. A már mentett sorok
szövegéből a feed és a futás-nézet olvasáskor levágja az előtagot, hogy a régi sorok is
tisztán jelenjenek meg.

**Feed hossza.** Lásd a 9. szakasz Feed bekezdését.

## 11. Tesztek

- `KonziliumCrossTalkRoundIT`: csoportosítás dimenzió szerint; egy szakértős csoport nem hív;
  a saját javaslatára nem szólhat hozzá; nem értelmezhető válasz esetén nincs reakció és a
  konzílium lefut; hívás-korlát betartása.
- `CharacterConferenceServiceIT` bővítés: a mentett `deliberation` szálai a javaslatok
  dimenzióit tükrözik; minden tétel hordozza a verdiktjét és a döntését.
- `LegacyTranscriptParserTest`: valódi régi átirat visszafejtése; hiányzó Szkeptikus-turn;
  formátumtól eltérő sor esetén `null`.
- `CharacterFeedbackServiceIT` / `KonziliumUserFeedbackIT`: a mentett szöveg nem tartalmaz
  azonosítót; a claim azonosítója a jel-hivatkozásban megvan; a konzílium bizonyíték-sora
  továbbra is hordozza az előtagot.
- FE: `KonziliumPage` szál-nézet mindkét módban, összecsukott alapállapot, legacy fallback;
  `CharacterFeedPage` nap-összecsukás.

## 12. Kapuk

Fókuszált backend:
`./mvnw test -Dtest='*Character*,DetectorTest,Konzilium*,ClaimLifecycleIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`.
Frontend mindkét módban plusz build. Szerződés-újragenerálás mindkét oldalon, egy commitban.
`node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs --errors-only`,
`node scripts/lint-liquibase.mjs`. A teljes sorozat a self-PR CI-ja.

## 13. Amit szándékosan nem csinálunk

- Nincs adatmigráció a régi konzíliumokra.
- A Szkeptikus nem látja a társak reakcióit.
- A reakció nem módosít és nem vált ki javaslatot.
- Nincs gráf-vizualizáció.
- A Feed lapozása marad egyetlen lekérés; csak a megjelenítés csukódik össze.

## 14. Követő ötletek

- A kereszt-vita kiterjesztése ellenjavaslatra, ha a szál-nézet beélesedett.
- A megfigyelés saját napjának kiszolgálása a feed tételén, hogy a futás-feloldás ne
  dátumból következtessen (`CharacterFeedPage` fejléc-megjegyzése, mezo-1gim.14).
