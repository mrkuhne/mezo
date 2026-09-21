# Boop AI-világ V2 — navigáció, designhűség és funkciólefedettség

Dátum: 2026-09-21. Driver: **mezo-7fduk**. Állapot: **vizuális egyeztetésre váró terv**.
Előzmény: [route- és adataudit](2026-09-21-boop-social-ai-audit.md),
[Proposed ADR 0049](../../decisions/0049-boop-shared-social-ai-world.md).
Prototípus: [V2](assets/boop-social-world-v2.html).

## Mi változott a V1 után?

A felhasználó az üzenőfalat és a tagelést kedvelte, de hiányolta az alsó navigációt,
a többi oldal tartalmát és a valós app designját. V2 az app saját agyagikonjait,
öt Boop-alakját, napi fejlécjelzőjét, kék fejlécét és alsó dokkját használja.
A négy javasolt fül: Üzenőfal, Folyamatban, Rólad, Emlékek. Ezek továbbra is
tervezett menücímkék; az éles menü nem változott.

A Folyamatban egy nyitott kérdés köré szervezi a mintákat, próbákat és előrejelzéseket.
A Rólad karakterportrét, hét dimenziót, kezelhető tudástárat és kapcsolati nézetet ad.
Az Emlékek heti könyvfejezetet, napválasztót, napi részletet és keresést mutat.
Az üzenőfal megőrizte a hozzászólásokat, szereplőket, tagelést és külön tudásjóváhagyást.

## Designforrások és a hűség határa

- `frontend/src/app/TabBar.tsx`, `navModel.ts`: öt terület közötti váltó, négy helyi fül.
- `frontend/src/app/AppHeader.tsx`, `frontend/src/shared/ui/DayOrb.tsx`: fejléc és napi jelző.
- `frontend/src/shared/ui/clay/clay-icons.svg`, `clay-spots.svg`, `boop/boop.svg`: tényleges assetek.
- `frontend/src/styles/prototype.css` dokk-, fejléc- és felületi szabályai; a
  [Restored World style bible](../../design_2.0/2026-09-17-restored-world-style-bible.md).

A 416 px széles mobilkeretben 88 px magas dokk, 56 px-es világváltó-oszlop,
27 px-es menüikonok, 40 px-es Boop-váltó és 52 px-es gyorsrögzítés szerepel.
A sand/cream felület, lágy színezett árnyékok, Geist/Fraunces tipográfia és a
meglévő ikonok adják a folytonosságot. Az olvasófelület belül görgethető, a dokk marad.
A 680 px-es bemutatóablak a prototípus kerete, nem új termékbeli viewport-előírás.

Ez önálló, szemléltetett adatokkal működő prototípus; nem a futó React-komponensek
beágyazása és nem teljes pixelazonossági tanúsítás. A tartalom, új elrendezések,
kapcsolati rajz és animációs részletek javaslatok. Valós adatok, API-hívások, AI-futások
és tartós mentés nincsenek benne. Az alkalmazás adatain semmit nem módosít.

## Lefedettségi leltár

Az előző audit route-családokat vett számba; itt a fő műveletcsoport az egység.
A „24 felület” ezért nem összevethető közvetlenül az alábbi sorok számával.
A route-ok és fő műveletek kódját átnéztük; minden történeti rekord és minden
hibakombináció éles végigtesztelését nem állítjuk.

**Interaktív**: a reprezentatív művelet a helyi példában kipróbálható.
**Részleges**: a helye/részlete látszik, összetett futása vagy valamennyi állapota nem.
**Átjáró**: a meglévő külön felület megmarad; a prototípus csak a kapcsolódást jelzi.

| Meglévő képesség / művelet | Tervezett hely | V2 mélysége |
|---|---|---|
| Belépő, új eredmények, válaszra váró témák | Üzenőfal | Interaktív szűrés |
| Karakter feed, tagelt szakértői párbeszéd | Üzenőfal + beszélgetés | Interaktív reprezentatív szál |
| Felhasználói válasz, feldolgozás és visszajelzés | Bejegyzés alatt | Interaktív helyi válasz; az AI-feldolgozás szemléltetés |
| Hasznos / nem talál visszajelzés | Bejegyzés alatt | Interaktív, elkülönítve a tényjóváhagyástól |
| Válaszfeldolgozási hiba és újrapróbálás | Szálrészlet / működés | Részleges hiba- és újrapróbálási példa |
| Tényjelölt elfogadás, pontosítás, elvetés | Közös döntési sor, feed és Rólad belépéssel | Interaktív; mentés megjelenik a Tudástárban, visszavonható |
| Életesemény-jelöltek döntése | Ugyanaz a postaláda, külön típus | Részleges helyi döntéspélda |
| Minták hat életciklusállapota és szűrése | Folyamatban / Minták | Interaktív szűrő, csak reprezentatív állapotnak van példarekordja |
| Minta bizonyítéka, története, laborfüzete | Közös témarészlet | Részleges példarészletek; teljes lista/lapozás nincs szimulálva |
| Minta megerősítése, figyelése, elvetése | Témarészlet | Interaktív döntéspélda |
| Előrejelzés állapota, beválása, pontosság | Folyamatban / Előrejelzések | Részleges, saját részlet és nem értékelhető állapot példával |
| Próba javaslata, elfogadása, elvetése | Folyamatban / Próbák | Részleges műveletpéldák; nincs futó kísérleti motor |
| Aktív és lezárt próba, eredmény | Téma története és próbarészlet | Részleges hétnapos példa és értékelési nézet |
| Diagnózis három kérdése, indítás, történet | Folyamatban / Járjunk utána | Részleges; indítás kimondottan demó |
| Diagnózis jelentése, bizonyíték és próbaindítás | Vizsgálati téma | Részleges jelentés és próbaátjáró |
| Napi coaching és indoklás | Feed / Folyamatban | Részleges; eredeti Nap-kártyára hivatkozás |
| Coaching szabályok, trace, cooldown | Közös Gépterem / Megfigyelők | Részleges működési példa |
| Karakter hét dimenziója | Rólad / Karakter | Interaktív belépők, reprezentatív állításrészlet |
| Talál / nem igaz / pontosítás; változástörténet, visszavonás | Karakter részlete | Részleges visszajelzési és történetpélda |
| Kilenc szakértő, öt avatar | Avatarprofilok és csapat | Részleges profilnézet; szerepjelvény különböztet meg |
| Konzílium és archív ülések | Témákból, Karakterből | Részleges ülés és archív példa |
| Hiteles ténylista, keresés, aktív/kikapcsolt állapot | Rólad / Tudástár | Interaktív keresés, szűrés, kapcsoló |
| Tényeredet, promptválogatás és kontextus | Tényrészlet, Rólad | Részleges eredet- és felhasználási nézet |
| Gráfkategóriák, csomópont és archiválás | Rólad / Kapcsolatok | Részleges csillagkép + kategóriák; teljes gráfhoz API-bővítés kell |
| Explicit kommunikációs instrukció, tanult profil | Rólad → központi beállítás | Részleges szerkesztési példa; jelenleg is létező képesség |
| Heti memoár, archívum, fejezet és forrás | Emlékek / Hetek | Interaktív két példafejezet, részleges források |
| Napi AI-emlék, napi lefúrás | Emlékek / Napok | Két példanap részlete, többi nap üres demóállapot |
| Hasonló emlékek keresése | Emlékek kereső | Részleges, egyértelműen példaeredmény |
| Memóriarétegek, tömörítés, költség | Közös Gépterem / Memória | Részleges; kitalált éles költség nélkül |
| Futások, részlet, hibák | Közös Gépterem / Futások | Részleges reprezentatív nézetek |
| Bekötött és tervezett adatforrások, forráskörök | Közös Gépterem / Adatforrások | Részleges; terv nem aktív képességként jelenik meg |
| Detektorok és megfigyelők | Közös Gépterem | Részleges katalógus |
| Önálló chat, beszélgetéslista, hang, emlékvisszajelzés | Meglévő Beszélgetés | Átjáró; nem építettük újra a chatet |
| Heti elemzés, pontszám, naplista és tényleges napadat | Meglévő Én / Heti | Átjáró; nem költözik a Boop-főmenübe |
| Heti tanulságok döntései | Közös postaláda heti szűréssel | Célhely rögzítve; heti szűrő még nincs szimulálva |
| Heti felfedezések kivonata | Eredeti témákra mutató heti linkek | Célhely rögzítve, részleges példa |
| Nap észrevételei és napi javaslata | Nap + közös téma | Átjáró; ugyanazt az objektumot kell használnia |
| Fejléc napi jelzője | Változatlan fejléc | Saját DayOrb rajza; teljes napi lap részleges |
| Öt terület közötti navigáció és gyors naplózás | Alsó dokk + gyorsgomb | Interaktív váltó; más területek és rögzítők átjárók |

## Megőrzési feltételek a későbbi fejlesztéshez

Az új menü nem jogosít működő képesség eltávolítására. Régi mélylinkeket átirányítással
meg kell őrizni. Tény, karakterállítás, életesemény, hipotézis és előrejelzés külön
objektumtípus marad; a közös feed ezek eseményeit vetíti ki. A felületi duplikáció
megszüntetése nem táblák vak törlése. A like nem igazságállítás és nem tudásmentés.

A négy különböző emlékszöveg szerepét az előző audit elkülönítette: a visszakereséshez
használt tömörítés háttérben marad, a napi emlék és heti memoár olvasófelületet kap,
a heti értékelés az Én területén marad. Az ütemezett napi konzílium létezik;
a tervezés arra épít, nem egy második párhuzamos napi motorra.

## Ellenőrzés

A JavaScript szintaxisa `node --check` ellenőrzéssel rendben. Böngészőben ellenőrizve:
a négy alsó fül, Rólad és Emlékek vizuális képe, 320 px-en mind a négy nézet
vízszintes túlcsordulás nélkül; tudásjóváhagyás → Tudástár, aktív kapcsoló →
kikapcsolt szűrő, visszavonás, öt területet mutató üveglap. A vizsgált böngészőnapló
nem tartalmazott JavaScript-hibát. Ez prototípus-ellenőrzés, nem termék-E2E teszt.

Dokumentáció-lint: 73 dokumentum, 62 tiszta, 2 figyelmeztetés, 9 elavult, 0 hiba.
A lint FAIL eredménye változatlan: a V2 kimenete byte-azonos a V1 előtti
baseline kimenettel (`diff` üres). A meglévő elavultsági jelzések nem ebben a
tervezési változásban keletkeztek.
