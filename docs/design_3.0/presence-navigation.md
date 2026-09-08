# Boop — egy társ, több tér

Az alapfunkciók részletes munkafelületei és aloldalai is ebben a shellben működnek: [aktuális lefedés, kipróbálás és mock határok](boop-core-coverage.md).

2026-09-08 · `mezo-88jw.4` · navigációs és kommunikációs prototípus. [Megnyitás](http://127.0.0.1:5193/?v=presence).

## Boop vizuális irány

Daniel az alkalmazást és a karaktert Boopnak nevezte el. A jelenlegi irány visszatér az editorial címsorokhoz: Newsreader, dőlt kiemelések, meleg papírháttér, puha navigáció. A feliratok továbbra is sans betűsek.

Boop az eredeti Avatar Lab definíciót használja, változatlan szemmérettel: nincs szemöldök, pír, száj vagy extra arcréteg. A pislogás és a rövid simogatási reakció megmaradt, a dekoratív szív eltűnt. A Clay sprite helyett 32 saját, vékony vonalas SVG ikon szolgálja a területi és segédnavigációt. Forrásuk `prototypes/src/boop-icon-paths.mjs`: 24-es koordinátarács, 1,5-ös vonalvastagság, kerek végek, közös `currentColor`. [A korrekció specifikációja](../superpowers/specs/2026-09-09-boop-editorial-design.md).

Belépés: [Boop](http://127.0.0.1:5193/?v=boop). A korábbi `?v=presence` cím továbbra is működik, a mentett mintanap megmarad. A két régebbi összehasonlító irány változatlan. [Vizuális specifikáció](../superpowers/specs/2026-09-08-boop-visual-design.md).

## Ritmus és kapcsolódás

A `SignatureVisuals.jsx` újrahasználható elemei a közös ív–pont–szál nyelvet használják. A kezdőlapi `RhythmArc` a tényleges check-in darabszámból jelöli a négy állomást, extra check-in után is mind a négy kész marad. Mentéskor az új pont egyszeri átmenetet kap. A `CycleSignature` ugyanezt az ívet a program heteire alkalmazza; a hétgomb rövid, szándékosan általános összegzést választ, nem módosítja az edzéstervet.

A `FuelSignature` bemetszett SVG felületén az alapkeret és sport szála a napi célnál találkozik. A naplózott mennyiség alatti sáv a célhoz viszonyít, a maradék számmal is szerepel. A sport forrása megnyitható, a kapcsolat magyarázata lenyitható, onnan a meglévő mintachat elérhető. A sport törlését továbbra is az eredeti chattool végzi; a grafika ugyanazt az állapotot követi. A kezdőlap `DayConnection` eleme közvetlenül összekapcsolja az edzés és táplálás bejáratát.

A mozgás rögzítéshez és értékváltozáshoz kapcsolódik, a reduced-motion szabály kikapcsolja az új animációkat. A Minták összefüggés-ábrája még nincs kidolgozva ebben a körben. [Specifikáció](../superpowers/specs/2026-09-09-boop-signature-design.md).

## Kontúrcsalád és napi lenyomat

A `ContourSurface.jsx` három rokon SVG kontúrt ad: kapcsolat (étkezési keret, középen két bemetszés), előrehaladás (mezociklus, nagyobb felső ív), visszatekintés (napi lenyomat, puha alsó ív és visszahajló vonal). Mindhárom a tartalom magasságát követi és a terület színét örökli; az egyszerű listák keret nélkül maradnak.

A `DailyImprint.jsx` teljes nézete az Életem/Ma oldalon található; a kezdőlapon és a naplóban kompakt, kattintható előnézet vezet ide. A hét hét napja választható, a nagy lenyomat mellett kategória-jelmagyarázat és kibontató forrásesemények szerepelnek. A pont check-in, az ív mozgás, a hosszúkás jel napló, a csillagszerű jel hála. A tervezett mozgás szaggatott és szöveggel is jelölt.

Az `imprint-model.mjs` a keddi mintanap check-injeiből, szabad naplójából, hálájából és tervezett edzéséből/sportjából származtatja a kompozíciót; nincs véletlen rajzolás vagy kitalált egészségpontszám. A hétfő jelölt történeti fixture, a későbbi napok üresek. A jelenlegi mintanap továbbra is 2026. szeptember 8., nem a futtatás valós dátuma. A grafika egyelőre az itt rendelkezésre álló eseményeket mutatja, étkezési és alvásnapló-események még nincsenek bekötve.

[Specifikáció](../superpowers/specs/2026-09-09-boop-imprints-design.md). Ellenőrzés: 59 teszt és build sikeres; böngészőben napválasztás, hétfői forrás kibontása, üres jövőbeli nap, hét nap és vízszintes kilógás nélküli 360 px-es keret ellenőrizve.

## Termékértelmezés

Daniel a Mezo veled irányt választotta. A társ a teljes meglévő alkalmazást ismeri: hypertrophy mezociklus és sport; sporttal együtt változó étkezési célok és teljes ételnapló; súly/alvás; mentális jóllét szabad naplóval, napi legalább négy check-innel, hálával és életcélokkal. Az AI folyamatos megfigyelésből, visszajelzésből és rétegzett memóriából építi a személy fizikai, mentális, szociális, egészségi és lelki képét. A toolokkal működő chat ezt a kontextust viszi tovább. Az ad-hoc edzésjavaslat-generálás nem a termék szervezőelve.

Ez a tanulmány ennek az elképzelésnek csak a navigációját és kommunikációját vizsgálja. A korábbi 94-nézetes prototípust nem alakítja át; külön állapotot és saját `?v=presence` belépést kapott. A [jóváhagyott specifikáció](../superpowers/specs/2026-09-08-mezo-presence-navigation-design.md) rögzíti a határt.

## Kipróbálható interakciók

A kezdőképernyőn Boop és négy napi bejelentkezési pont vár. Két korábbi példa már szerepel, a délutáni közérzet és opcionális mondat rögzíthető. A negyedik után további bejelentkezést is lehet hozzáadni. A chat a legutóbbi közérzetből indul ki.

Az alsó Boop-buborék kinyitja a területválasztót. Ugyanaz a karakter öt szerepben jelenik meg: Otthon, Mozgás, Táplálás, Életem, A közös kép. A helyi menü váltáskor átmenettel cserélődik; a szerepek és fülek nem rendeződnek át AI-javaslatok hatására. A kiválasztott fül és görgetési hely területenként megmarad.

| Tér | Helyi fülek |
| --- | --- |
| Otthon | Ma; Beszélgetés és Rögzítés felületnyitó akció |
| Mozgás | Ma, Terem, Sport, Futás |
| Táplálás | Ma, Napló, Receptek, Kamra |
| Életem | Ma, Napló, Testem, Célok |
| A közös kép | Minták, Tudástár, Karakter, Kilátás |

A kezdő munkafelületek a kapcsolódásokat és a helyi menüt mutatják; belőlük a 103 részletes funkciónézet érhető el. Az Életem Napló fülén a szabad szöveg és a hála szerkeszthető, helyben megmarad, és bekerül a mintabeszélgetés kontextusába. A Testem áttekintésből a súly- és alvásnapló, a rögzítő és szerkesztő űrlap is elérhető.

A felső Beszélgessünk gomb ugyanazt a chatet nyitja minden térből. A korábbi üzenetek és a be nem küldött vázlat megmaradnak. A chat bezárásakor visszakapjuk az alatta lévő munkafelületet. Az egyes válaszokból az eredeti program vagy másik releváns tér megnyitható; a „Miből indulok ki?” lenyitás a kontextus forrásait külön mutatja.

Konkrét tool-példa: „Mi lenne, ha elmaradna ma a röplabda?” csak átbeszéli a hatást. „A mai röplabda elmarad, vezesd át.” a mintanap sportállapotát módosítja, így a szemléltető étkezési cél 2750-ről 2400 kcal-ra változik. Az alapkeret és a sporthoz rendelt rész külön látszik. A mezociklus nem változik, ismételt végrehajtás nem von le újabb energiát. Ez sem AI-számítás, sem táplálkozási előírás; a navigációs kapcsolat szemléltetése.

## Forma, navigáció és hozzáférés

Meleg, világos alap, személyes antikva címek, saját Clay-orbitális motívum. A munkaterek kék, arany, levendula és rózsás színe a karakteren és a helyi hangsúlyokon jelenik meg. A választó az alsó Mezo-buborék helyéről körben kitágulva nyílik, a dock elemei rövid alak- és pozícióátmenettel cserélődnek. Csökkentett mozgásnál a CSS-animációk kikapcsolnak; az Avatar Lab a saját beállításkezelését használja.

A területválasztó, a gyors rögzítő és a chat natív `dialog`. Escape bezárja, a fókusz visszatér a nyitó vezérlőre vagy az állandó Mezo-buborékra. A hash és a böngészőelőzmény őrzi az aktuális területet, fület és nyitott panelt. Közvetlen új belépés a kezdőképernyőre visz; teljes hash-link megőrzi a választott munkafelületet.

## Forrás és validáció

`prototypes/src/PresenceStudy.jsx`: shell, kezdés, négy munkatér, dialógusok, history és fókusz.
`presence-model.mjs`: külön mintanap, szerep/fül állapot, check-in, keret és determinisztikus chat/tool példák.
`presence.css`: a tanulmány saját scoped stílusai.
`main.jsx`: külön belépési ág; az előző labor a kezdőlapon változatlanul elérhető, új tanulmánylinkkel.

A teljes laborban **53/53 node-teszt sikeres**, a Vite build sikeres (a meglévő nagy-chunk figyelmeztetéssel). Hét új node-teszt: fül- és beszélgetésmegőrzés, check-in ritmus/kontextus, feltételes kérdés és explicit módosítás különbsége, idempotencia, változatlan mezociklus, napló/hála felhasználása és a már elmaradt sport helyes kezelése. Böngészőben 17 tartalmi nézet 360 px külső kereten, vízszintes túlcsordulás nélkül; további ellenőrzések: területválasztó, fülmegőrzés, chatvázlat, check-in → chat → mezociklus, tool → keret, Escape és fókuszvisszaadás. A keskeny asztali keret nem natív iOS készülékteszt.

A prototípus nem kapcsolódik valódi AI-hoz vagy személyes adatokhoz. Nem fut tényleges folyamatos háttértanulás, diagnosztika vagy új edzésprogram-generálás. A helyi állapot újraindítható az asztali tanulmány melletti Mintanap újraindítása gombbal.

## Boop ellenőrzés

Az editorial körben a kezdőoldalt és a Kamrát böngészőben ellenőriztük; a karakter ismét csak két szemből áll, a területi menü saját vonalas ikonokat használ. A prototípus 59 viselkedési és geometriai tesztje és Vite buildje sikeres. Böngészőben ellenőrizve: simogatás kattintással és Enterrel, visszaállás nyugalmi állapotba, területválasztás, Táplálás összegző és kontextust megőrző chat, Escape bezárás. A 360 px-es próbakeretben nincs vízszintes kilógás, a közérzetgombok az alsó menü fölött elférnek (asztali viewportban vizsgálva). A build nagy chunkra figyelmeztet; a teljes dokumentációlint korábban is jelzett 14 elavult dokumentumot, az errors-only ellenőrzés 0 hibával átmegy.

Az új elemeknél böngészőben ellenőrizve: hétválasztás, étkezési magyarázat/chat, a sport átvezetése után 2750 → 2400 kcal és inaktív forrásszál, check-in mentés. A 360 px-es keretben nincs vízszintes kilógás, a közérzetgombok láthatóak.
