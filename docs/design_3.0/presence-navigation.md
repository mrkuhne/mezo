# Mezo veled — egy társ, több tér

2026-09-08 · `mezo-88jw.4` · navigációs és kommunikációs prototípus. [Megnyitás](http://127.0.0.1:5193/?v=presence).

## Termékértelmezés

Daniel a Mezo veled irányt választotta. A társ a teljes meglévő alkalmazást ismeri: hypertrophy mezociklus és sport; sporttal együtt változó étkezési célok és teljes ételnapló; súly/alvás; mentális jóllét szabad naplóval, napi legalább négy check-innel, hálával és életcélokkal. Az AI folyamatos megfigyelésből, visszajelzésből és rétegzett memóriából építi a személy fizikai, mentális, szociális, egészségi és lelki képét. A toolokkal működő chat ezt a kontextust viszi tovább. Az ad-hoc edzésjavaslat-generálás nem a termék szervezőelve.

Ez a tanulmány ennek az elképzelésnek csak a navigációját és kommunikációját vizsgálja. A korábbi 94-nézetes prototípust nem alakítja át; külön állapotot és saját `?v=presence` belépést kapott. A [jóváhagyott specifikáció](../superpowers/specs/2026-09-08-mezo-presence-navigation-design.md) rögzíti a határt.

## Kipróbálható interakciók

A kezdőképernyőn Clay és négy napi bejelentkezési pont vár. Két korábbi példa már szerepel, a délutáni közérzet és opcionális mondat rögzíthető. A negyedik után további bejelentkezést is lehet hozzáadni. A chat a legutóbbi közérzetből indul ki.

Az alsó Mezo-buborék kinyitja a területválasztót. Ugyanaz a karakter öt szerepben jelenik meg: Otthon, Mozgás, Táplálás, Életem, A közös kép. A helyi menü váltáskor átmenettel cserélődik; a szerepek és fülek nem rendeződnek át AI-javaslatok hatására. A kiválasztott fül és görgetési hely területenként megmarad.

| Tér | Helyi fülek |
| --- | --- |
| Otthon | Ma; Beszélgetés és Rögzítés felületnyitó akció |
| Mozgás | Ma, Terem, Sport, Futás |
| Táplálás | Ma, Napló, Receptek, Kamra |
| Életem | Ma, Napló, Testem, Célok |
| A közös kép | Minták, Tudástár, Karakter, Kilátás |

A 17 tartalmi nézet szándékosan sekély: a kapcsolódásokat és a helyi menü működését mutatja. Az Életem Napló fülén a szabad szöveg és a hála szerkeszthető, helyben megmarad, és bekerül a mintabeszélgetés kontextusába. A Testem áttekintés a súlyt/alvást helyezi el, nem mérési űrlapot nyit.

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
