A Boopban a kért alapfunkciók részletes, állapotot megőrző mockjai is elérhetők: [funkciótérkép és kipróbálás](boop-core-coverage.md).

A saját kontúrcsalád és a napi lenyomat is kipróbálható: [Életem · a napjaid lenyomata](http://127.0.0.1:5193/?v=boop#presence/life/today). Válassz napot, majd bontsd ki az eseményeit.

A Boop tanulmány most közös ritmusívet használ a kezdőlapon és a mezociklusnál; az étkezési keretet összefutó forrásszálak mutatják. [Kipróbálás](http://127.0.0.1:5193/?v=boop).

# Boop vizuális iteráció

A kiválasztott jelenlét-központú tanulmány új neve **Boop**. Meleg editorial UI, saját vonalas SVG ikonok és az eredeti kétszemű, érintésre reagáló karakter: [prototípus](http://127.0.0.1:5193/?v=boop), [működés és határok](presence-navigation.md).

# Mezo — Mérték és Mezo veled

**Aktuális továbbfejlesztés:** Daniel a Mezo veled irányt választotta. Az [egy társ, több tér navigációs tanulmány](presence-navigation.md) külön prototípusban vizsgálja a színes szerepváltót, az átalakuló helyi menüt és az állandó beszélgetést: [megnyitás](http://127.0.0.1:5193/?v=presence). A lenti két korábbi változat összehasonlításként megmarad.

2026. szeptember 8. · `mezo-88jw.3` · gazdag funkcionális UX-prototípus, vizuális döntés előtt.

Az első három irány túl kis alkalmazásszeletet mutatott. Daniel visszajelzése alapján az eredeti meleg, semleges palettát tartjuk meg; a Mérték formáit lágyítjuk, és külön, világos karakterközpontú alternatívát építünk. A zöld Liget nem szerepel az aktuális összehasonlítóban. A [kutatás](../research/queries/mezo-ux-direction.md) és a [jóváhagyott kibővített scope](../superpowers/specs/2026-09-08-complete-ux-exploration-design.md) rögzíti az előzményeket. Production irány még nincs kiválasztva.

## Kipróbálás

```sh
cd docs/design_3.0/prototypes
npm ci
npm run dev
```

[Összehasonlító](http://127.0.0.1:5193/) · [Mérték](http://127.0.0.1:5193/?v=measure#home) · [Mezo veled](http://127.0.0.1:5193/?v=companion#home)

A helyi szerver a 5193-as porton fut. A felső területválasztó mindkét beágyazott példányt átváltja, az önálló nézetben a teljes alkalmazás végigjárható. A `width=360` URL-paraméter asztali nézetben is 360 pixel széles alkalmazáskeretet ad vizuális ellenőrzéshez. Mobilon az alkalmazás a rendelkezésre álló szélességet használja.

| Irány | Szervezőelv | Saját megjelenés |
| --- | --- | --- |
| Mérték | Állapot → napi prioritás → közvetlen eszközök | Papírszín, szerkesztett sans tipográfia, finom elválasztók, puhább 15–23 px formák, sötét fókusz az aktuális edzésen |
| Mezo veled | Közérzet → megbeszélt következő lépés → kapcsolódó eszközök | Világos meleg háttér, Clay és saját orbitális motívum, antikva a részletes bevezetőkben, beszélgetőbb hang és helyi kísérőüzenetek |

A karakteres főoldalon a **Jól vagyok / Fáradtabban / Sűrű a nap** válasz módosítja a következő javaslatot. A pihenés előtérbe helyezése külön döntés; a teremi terv nem változik észrevétlenül. Naplózni és edzeni közvetlenül is lehet, nem kell minden feladatot chatben kezdeni.

## Mi került bele?

Öt stabil fül: **Nap, Edzés, Fuel, Mezo, Én**. A felső Clay minden oldalon a chatet nyitja, a csengő az értesítéseket. A Karakter a felhasználóról alakuló dosszié; a kis Clay ennek nem helyettesítője.

A közös útvonaltérkép 94 címezhető nézetet tartalmaz. A mennyiség nem kész production képernyők számát jelenti: közös munkafelületek, szerkesztők és részletek két eltérő megjelenésben, szemléltető adatokkal.

| Terület | Végigjárható munkafolyamat |
| --- | --- |
| Nap | Prioritás, legutóbbi alvás/súly, megmaradt étkezési keret, víz, rutin, emberek, heti történet; külön közérzetalapú karakteres kezdés |
| Mezo | Minták hat életciklusállapottal, bizonyíték/előzmény/visszajelzés; előrejelzések és kimenetelük; kereshető, javítható/kikapcsolható Tudástár és kategóriakapcsolatok |
| Karakter | Dimenziók, portrék, állítás elfogadása/pontosítása/elvetése, alakuló kép, szakértői csapat, konzílium, feldolgozás/adatforrás/detektor nézetek |
| Heti és mélyebb Mezo | Heti történet, napok, területi részletek, külön adatokkal rendelkező korábbi hét; memoár, kísérletek indítása/követése, memóriaeredet |
| Fuel | Szöveges/fotópéldás/kamrából induló ételnapló, hozzávaló- és adagjavítás, mentés, étkezési olvasat; Kamra/készlet, recept/hozzávaló/adag/főzés, hiánylista/bevásárlás/visszatöltés, étkezési terv és célok |
| Edzés | Aktív sorozatnapló szerkesztéssel/pihenővel, ténylegesen rögzített sorozatok összegzése; mezociklus építése/vázlat/szerkesztés/aktiválás/hetek/napok; sportnaptár és napló; futóterv és futásnapló/átlagtempó; gyakorlatkereső, képpárok, rekordok, medálok |
| Én | Alvásrögzítés éjfélkezeléssel, minőség/tényezők/előzmények; súlyrögzítés és trend; személyek, jegyzetek/fontos dátumok, kapcsolódási napló, külön közös tervek; rutinok, lépések, napok, kézi és naplóadatból következő teljesítés |
| Chat és értesítések | Állapotot olvasó előre megírt válaszok és konkrét részletre nyíló akciók; olvasott/olvasatlan és témaszűrés, pontos objektumra mutató értesítések, új jelzéseket szabályozó beállítások |

A részletes viselkedés- és forrástérképek: [Mezo](mezo-coverage.md), [Fuel](fuel-coverage.md), [Edzés](train-coverage.md), [Én és értesítések](personal-coverage.md).

## Mit használtunk a referenciákból?

A referenciák a működést és a hierarchiát adják; képernyőket nem másolunk át. A forrásokat és korábbi megfigyeléseket a [kutatási összefoglaló](../research/queries/mezo-ux-direction.md) őrzi.

| Referencia | Konkrét megjelenés ebben a prototípusban |
| --- | --- |
| Hevy | Az aktív edzésben előző érték, szerkeszthető kg/ismétlés, sorozatpipa és pihenő egy munkafelületen; lezáráskor csak az elvégzett sorozatok kerülnek a részletbe |
| Strava | Heti történetből napokra és konkrét mozgásnaplókra vezető út; a sport/futás a terheléssel együtt értelmezhető |
| Yazio | Fuel napló mint napi központ; a receptek, a Kamra és az olvasat külön feladat, köztük a tényleges étkezés/hozzávaló kapcsolja össze az utat |
| Huawei Health | Visszatérő gyűrűk, időívek, trendek és állapotjelzések; saját SVG-k, nem a Health Clovers másolata |
| Nike Training Club | Cél/idő/terhelés → szerkeszthető program → aktuális nap; út közben érkező támogatás, a következő lépés kimondása |
| Bevel | A közérzetet, alvást, mozgást és étkezést egy történetben olvasó Nap/Mezo/Heti felület; az adatból elérhető értelmezés és cselekvés |
| Tide Guide | Az orbitális vonal, körív, puha fény és Clay mozgás ismétlődő formai nyelve; nem külön témaszín minden funkciónak |
| Harvee | Az állapot értelmezéséhez kapcsolódó karakter: figyel a közérzetválaszra, gondolkodik a chatben, örül a mentésnek |
| Bears Gratitude | Saját étel- és tárgyillusztrációk, személyes hangú napló/memoár és csendesebb átvezetések |

## Állapot és navigáció

A két irány külön localStorage állapotot használ. A **Mintanap visszaállítása** csak az adott bemutatót kezdi újra. Mentés után az azonos objektum részlete nyílik meg: az AI ételnapló javítása például ugyanazt az étkezést módosítja. A teljesített edzés a naplóba és az értesítésekbe kerül. A Tudástárban kikapcsolt tényre a chat sem hivatkozik használható közös tudásként.

A fejléc az egyetlen globális visszalépési hely. A hash útvonal megőrzi a részletazonosítókat; a böngészőelőzmény és az oldalhoz tartozó görgetési pozíció működik. Közvetlen részletnyitásnál a szülőre lépés nem hoz létre oda-vissza hurkot. Teljes újratöltésen át a görgetési helyet nem mentjük. Az iOS PWA rendszer-swipe külön készülékes ellenőrzés tárgya; nincs rátelepedő saját gesztusfelismerő.

## Clay és média

A saját Clay-definíció a valódi Bible Strong Avatar Lab `0.1.0` React/core runtime-jában jelenik meg. Öt állapot: jelen van, figyel, gondolkodik, örül, pihen. A karakteroldalon választható korall/kék agyag/homok szín az alkalmazás minden Clay példányára vonatkozik. Az alkalmazás eredeti meleg palettája ettől külön marad.

A [letölthető karakterdefiníció](prototypes/public/mezo-clay.avatar.json) runtime JSON, nem Studio-projekt. A kezelőikonok Lucide-ból jönnek; az ételillusztrációk, súlyzó és orbitális motívumok saját SVG/CSS elemek. Csökkentett mozgásnál a dekoratív mozgás kikapcsol.

Hét gyakorlat 14 helyi képe a már vendorizált, public-domain exercise adatbázisból származik. A lejátszás **kétképes mozdulattanulmány**, nem videófelvétel. Források és licencek: [THIRD_PARTY.md](prototypes/THIRD_PARTY.md).

## Határok

Ez külön React/Vite labor, sem a production frontendbe, sem a backendbe nem importál. A fotóértelmezés előre megadott illusztráció és szerkeszthető minta; nincs valós felismerés, AI-hívás, GPS, eszközszinkron, valódi üzenetküldés vagy külső naptármódosítás. A receptek és gyakorlatok kis, bejárható készletet képviselnek. A tervezőből megnyitható aktív edzés egy megjelölt közös Pull Day mintamenet. A szakértői szövegek, következtetések és múltbeli háttéradatok előre megírt példák.

A két változat teljes információs szerkezete közös. A kezdőélmény, a tónus, a karakterjelenlét és a tipográfia különbözik; a sűrű naplóeszközök tudatosan hasonlóak. Ez lehetővé teszi annak eldöntését is, hogy egy hibrid irány működik-e jobban.

## Forrástérkép és ellenőrzés

`prototypes/src/main.jsx` az entry; `lab-app.jsx` a két irány, útvonalak, history és közös API; `exploration-model.mjs` a keresztfunkciós állapot; `flows/` a négy domain; `shared.jsx` a Clay/chat/grafika; `LegacyDetails.jsx` a továbbvitt aktív edzés, napló, célok és avatarlabor. Az előző három irány forrásai a `variants/` alatt megmaradtak, az aktuális launcher kettőt kínál. [Integrációs szerződés](prototypes/EXPANSION_CONTRACT.md).

Validáció: `npm test` — **46/46 pass**; `npm run build` — **pass**; a részletek mindkét témában renderelve, a fő és domainnézetek böngészőben 360 px kereten vízszintes túlcsordulás nélkül. Valódi kattintásokkal ellenőrizve az étel/adag/olvasat/javítás, alvás és súly, közös terv, mezociklus aktiválás, futásnapló, részleges edzés és pontos összegzése, minta → tudástár → értesítés, chat → heti nézet, egymás utáni visszalépések és a gyakorlatmédia. A build egy nagy prototípuschunkra figyelmeztet; production teljesítményhangolás nem történt.

A repo doc-lintben 14, a változtatás előtt is fennálló stale dokumentum van; ez külön baseline-ellenőrzéssel igazolt. A teljes doc-lint nem nevezhető zöldnek. A hibaszűrt lint és a CODEMAP-ellenőrzés eredményét a PR rögzíti. Production tesztcsomagot a külön labor miatt nem futtatunk.
