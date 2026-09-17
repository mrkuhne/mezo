# Boop Play — színes, adatközpontú RPG irány

2026-09-09 · mezo-88jw.11 · [új változat](http://127.0.0.1:5193/?v=rpg#presence/home/today) · [megőrzött editorial változat](http://127.0.0.1:5193/?v=boop#presence/home/today)

Daniel kérésére önálló vizuális változat. A területváltó és a helyi alsó fülek maradnak, az alkalmazás fő nézetei számszerű, játékos felépítést kapnak. [Referencia-transzferek](../research/queries/boop-data-rpg.md), [design](../superpowers/specs/2026-09-09-boop-rpg-design.md).

## Nézetek

- **Bázis:** gyors edzés/étkezés/mérés, heti edzésszám, maradék kalória, XP és következő lépés.
- **Mozgás:** aktív mezociklus, kattintható hétállomások, célizom-SVG, heti edzés/sorozat/volumen, aktív edzés, saját rekordok. A rekordkártya a legnagyobb rögzített súlyt választja, azonos súlynál az ismétlés dönt; a demó előzmény forrása jelölt.
- **Táplálás:** elfogyasztott/cél/maradék kcal, sportból eredő keretrész, fehérje/szénhidrát/zsír, étellista, víz. A mentések frissítik az összegzést.
- **Életem:** Boop, check-in és beszélgetés; napló, hála, testadatok, célok, emberek és rutinok.
- **Elemzés:** rövid adatsáv, majd a minták, tudástár, profil és előrejelzések meglévő részletes folyamatai új tipográfiával és vezérlőkkel.

Mind a 103 részletes mock route megmarad. A fő munkafelületek új kompozíciók; az aloldalak a korábban kidolgozott működést használják a Play stílusrendszerrel és rövidebb funkciócímekkel. Az AI chat hívása az Életem térben nyílik meg; a többi fejléc értesítéseket kínál. A bezárás az előző munkafelülethez tér vissza.

## Saját vizuális nyelv

Manrope címsorok, DM Sans szövegek, nagy számok, mélykék modulok világos hideg háttéren. Kék–lime mozgás, korall/barack táplálás, lila Életem, türkiz elemzés. Saját SVG moduljelvények, hatszögű szintjel, szegmentált energiaműszer, stilizált célizom-térkép. A gombok lenyomásra reagáló alsó élt, a nézetek rövid belépési animációt kapnak. Reduced-motion esetén a mozgások kikapcsolnak. Boop eredeti két szeme és pislogása megmarad.

## Állapot és határok

Az új változat a `boop-rpg-v1` localStorage-kulcsot használja; a korábbi változat `mezo-presence-v1` mentése érintetlen. A közös domainmodellek mögött külön adatpéldány áll. XP = 10 pont egy egyedi étel-, edzés-, súly-, alvásbejegyzés vagy check-in után; a napi napló/hála kitöltése is egy-egy bejegyzés. A víz egy napi összesítő, külön XP nélkül. 100 XP egy szint. Szerkesztés és azonos ID duplázása nem ad több pontot; törlés után a megőrzött bejegyzésekből újraszámolunk. Ez szemléltető játékszabály, nem éles gamification-motor.

A számok a mentett mock adatokból számolódnak. A korábbi fixture volumenek szóközzel formázott értékei is helyesen összegeződnek. AI, ételfotó-értelmezés, score és mintafelismerés továbbra is szimulált. Az izomábra a tervben szereplő célcsoportokat jelöli, nem regenerációt mér. A [korábbi funkcionális határok](boop-core-coverage.md) érvényesek.

## Fájlok és ellenőrzés

`RpgStudy.jsx`: új munkafelületek és asztali bemutató. `RpgVisuals.jsx` / `RpgIcon.jsx`: saját kódalapú SVG-k. `rpg-model.mjs`: területi megjelenés, összegzések, rekordok és XP. `rpg.css`: a változatra szűkített stílusok. `PresenceStudy.jsx`: variánsparaméter, külön mentés, meglévő navigáció. `CompleteFlow.jsx` / `FlowUI.jsx`: megjelenítési kontextus az aloldalaknak.

Automatizált ellenőrzés: 71 modell/geometriai teszt; mind a 103 route minta- és hiányzó azonosítókkal, valamint a négy új munkafelület renderellenőrzése; Vite build. Böngészőben: területváltás, ételmentés → 1844 kcal / 906 kcal maradék, XP 230 → 240, check-in → 250 XP, beszélgetés az Életem térben; 360 px-es tartalom túlcsordulás nélkül; a Play próbaétel nincs jelen az editorial naplóban. Ez prototípus-ellenőrzés, nem production kiadás vagy natív iOS teszt.
