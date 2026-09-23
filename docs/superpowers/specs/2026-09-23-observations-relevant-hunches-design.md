# Észrevételek — releváns sejtések és többféle személyes forrás

Dátum: 2026-09-23 · Driver: `mezo-hben1`
Állapot: az alapirány jóváhagyva; a forrásbővítéssel kiegészített terv review alatt.

## 1. Probléma és cél

Az éles DB auditjában 15 pattern mellett nulla observation esemény szerepelt.
Szeptember 6–23. között 17 hipotéziskör 34 javaslatából egy sem maradt meg;
a kritikák 0,259–0,514 közötti pontjai a csökkentett 0,55-ös küszöb alatt vannak.
A felhasználó a bemutatott eldobott sejtéseket relevánsnak találta.

A cél: konkrét adatra épülő, megválaszolható észrevétel már a statisztikai
igazolás előtt megjelenjen. A felhasználói ráismerés, a megfigyelt együttjárás és
az okság külön fogalmak maradnak. Az elfogadás nem állít automatikusan okságot.

## 2. Jelenlegi lefedettség és hiányok

- Napló, hála és napi chat: `TextSignalExtractor` hangulatot, energiát, stresszt,
  személyemlítéseket, 12 zárt témát és kulcsszavakat nyer ki.
- Check-in: strukturált stressz/energia/testérzet/mentális állapot metrikák.
- Check-in, alvás és futás szöveges megjegyzései: a `DailySummaryService` napi
  narratíváján keresztül is elérhetők, de nem önálló forrásai a text-signal ágnak.
- A hipotéziskör hét napi összefoglalót, metrikákat, ismert tényeket és mintákat
  kap; a tegnapi szöveges jel hiánya ma kikapcsolja a külön REFLECTION
  memóriakeresést. A személy/téma sorozatokhoz már van infrastruktúra.
- A gyors észrevételt csak napló/hála mentés indítja; a check-in és más események
  nem. A nightly `proposed` sor önmagában nem kerül az observation feedbe.

## 3. Megjelenítés és életciklus

Új, ellenőrzött forrásokra támaszkodó, releváns jelöltből kérdést tartalmazó
észrevétel készül. A statisztikai kritika az evidenciaszintet és megfogalmazást
szabályozza; a gyenge bizonyíték önmagában nem elutasítási ok.
Továbbra is kiesik a forrás nélküli, ellentmondó vagy ismétlődő állítás.
A hiányos naplózás alternatív magyarázat marad, nem bizonyíték alulevésre.

A kártya tartalma: óvatos állítás, konkrét dátumozott alap, egy rövid kérdés,
és a három válasz: „Igen, jellemző”, „Nem stimmel”, „Beszéljük meg”.
Az első személyes megerősítést rögzít; mérhető teszttervnél elindul a követés.
Tesztterv nélkül nem ígérünk számszerű későbbi igazolást. A beszélgetés megkapja
a sejtést és a forrásokat. A negatív válasz és a korábbi válaszok megmaradnak.

A megválaszolatlan észrevétel másnap is elérhető. Ugyanarról az összefüggésről
új adat ugyanazt a szálat frissíti; nem születik napi parafrázis-kártya.
A felhasználó által figyelésre állított statisztikai minták is láthatók,
a saját életciklusuk megtartásával. Nem vezetjük át őket a reflexió eltérő
refutálási szabályain. A jelenlegi napon megjelenő inbox és a történeti napi
lekérdezés jelentését a szerződésben külön kell rögzíteni.

## 4. Forrásbővítés és összefüggéskeresés

A meglévő `PersonalRecordSource`/`PersonalRecordService` forráskatalógusra és a
memória-platformra építünk; új, párhuzamos személyesadat-katalógus nem készül.
A kiválasztott bemenet napló, hála, felhasználói chat, check-in szöveg és szám,
alvás-, futás- és edzésmegjegyzés, valamint az ezekhez köthető tárolt események.
Az asszisztens saját korábbi sejtése nem válhat új, független bizonyítékká.

A keresés az aznapi és következő napok állapotait, eseményeit kapcsolja össze:
munka/kapcsolatok/társas program, hangulat/stressz/energia, mozgás, szokások,
étkezés és alvás. Személy említése nem bizonyít találkozást; témacímke nem
bizonyít eseményt. A szöveg jelentése és az eredeti részlet megmarad a jel mellett.

Friss forrásokból és nyitott sejtésekből képzünk keresést akkor is, ha tegnap
nem volt napló/chat jel. Alapablak 28 nap; kapcsolódó emlék legfeljebb 90 napig
kereshető vissza. Minden ablak és költségkeret konfigurálható.
A meglévő napi megjelenítési keret közös marad a gyors és az éjszakai úton.
A kiválasztás előnyben részesíti az új témát az ismétlődő étkezés/alvás
parafrázissal szemben, de nem gyárt tartalmat pusztán a témák változatosságáért.

## 5. Adatfolyam és hibakezelés

Owner-szűrt források → dátumozott bizonyítékcsomag → jelölt → forrásellenőrzés
és deduplikálás → evidenciaszint és kérdés → tartós kártya → felhasználói válasz
→ opcionális mérés és visszatérés. A meglévő pattern/event tárolást bővítjük,
a láthatóságot elkülönítve a statisztikai pontszámtól.

LLM-hiba nem érintheti a forrás mentését. Ismételt feldolgozás idempotens;
törölt vagy idegen forrás nem jelenhet meg. A jelölt döntési oka naplózott:
megjelenített, összevont, keret miatt halasztott, forráshibás vagy ellentmondó.
A napi keret nem dobja el végleg a még aktuális jelöltet.

## 6. Korábbi sejtések visszaállítása

Az auditnaplók javaslatait az eredeti forrásokkal újraellenőrizzük, témánként
összevonjuk, és csak az aktuálisakat emeljük át megválaszolatlan kártyának.
Az eredeti dátum és az utólagos feldolgozás dátuma külön marad. Nem keletkezik
hamis korábbi observation esemény, automatikus user-válasz vagy push-áradat.
A folyamat először dry-run kimutatást ad, majd ugyanazon jelöltazonosítókkal
idempotensen alkalmazható. Az owner ezt a visszahozást az alapiránnyal jóváhagyta.

## 7. Ellenőrzés és integráció

Integrációs teszt bizonyítja, hogy egy alacsony statisztikai pontú, de konkrét
forrású észrevétel megjelenik; forrás nélküli vagy idegen adatú jelölt nem.
Napló/check-in szöveg és másnapi esemény összekötése, tegnapi jel nélküli
memóriakeresés, duplikáció, ismételt backfill, törölt forrás és tulajdonosi
izoláció külön ellenőrzendő. FE mindkét módban: tartós megválaszolatlan kártya,
válaszok, tesztterv nélküli követés szövege, statisztikai minta helyes kezelése.

Az API-változás szerződésből indul. A megjelenítési megoldás illeszkedik a
párhuzamos [csapatfal-tervhez](2026-09-23-boop-team-feed-design.md): közös
észrevétel-forrás, közös válaszállapot; nem épül második, külön inbox.
A living companion dokumentációt a működés implementálásával frissítjük.

## 8. Megfontolt alternatívák

Csak a pontküszöb csökkentése nem oldja meg a megjelenítés és forráslefedettség
hiányait. Minden nyers AI-javaslat megjelenítése zajos és ismétlődő lenne.
A választott irány a forrással rendelkező, megválaszolható sejtés és a későbbi
igazolás elkülönítése, meglévő személyesadat-infrastruktúrára építve.
