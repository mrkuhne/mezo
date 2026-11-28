---
cim: Heti menü
szint: Kis funkció
terulet: Terv
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI]
szulo: 06-terv-csomag
szakasz: [B6]
osszefoglalo: Vasárnap este Boop összeállítja a jövő heti menüt a kiválasztott receptjeidből, edzésnapon többet, pihenőnapon kevesebbet; te jóváhagyod, és ezek lesznek a napi terved ételei.
---

## Mit csinál
Az **Étel szoba Hét fülén** (2026-11-28 óta; régen az Évad Menü füle volt, döntés #133) a jövő heti menü látszik: hét napkártya (lapozható), mindegyiken a nap teljes kalóriája,
hogy edzésnap, sportnap (például röplabda) vagy pihenőnap, és az étkezések ablakonként (reggeli, ebéd, uzsonna,
vacsora) a kalóriájukkal.
- **Jóváhagyom** — a menü élesedik: az Étel szoba napi tervében ezek az ételek jönnek javaslatként, és elkészül a
  bevásárlólista.
- **Koppints egy ételre** — Boop felajánl más kiválasztott recepteket, amelyek ugyanabba az ablakba férnek (az adagot az
  ablak kalóriájához igazítja). Amit te választasz, azt később sem cseréli le magától.
- **Kérek másikat** — egy másik összeállítás ugyanarra a hétre (amíg nincs jóváhagyva).
- **Menübe jöhet** — hogy mely receptjeidből állhat össze a menü, azt 2026-11-28 óta a recepteknél jelölöd (Étel ›
  Receptek: minden receptnél egy „Menübe jöhet” kapcsoló, és egy „Menübe jöhet · N” szűrő; döntés #137). A menü lapján
  egy sor („12 recept a menüben”) a szűrt listára visz. Ami ütközik az érzékenységeiddel vagy feldolgozottabb, mint az
  évad szabálya engedi, ott a kapcsoló helyett az ok látszik. Évad nélkül a kapcsoló rejtve van; internet nélkül a
  koppintás azt mondja: „Ehhez internet kell.”
- Ha **még egy receptet sem jelöltél meg**, a menü ezt kéri először („Válaszd ki, melyik receptjeidből álljon a menü”).
- Ha **kevés a recept** a héthez, a menü ismétel, és ezt meg is mondja.
- Ha egy ablakba egyik recepted sem fér bele, ott egy egyszerű alapanyag-javaslat áll (például „kb. 150 g csirkemell
  és 200 g rizs belefér”), soha nem üres sor.
- **A Ma falon** vasárnap este (a menü napján) megjelenik egy kártya: „Elkészült a jövő heti menü — Átnézem”. Ez
  értesítést is küldhet, de csak a napi két értesítéses kereten belül; hétfőn reggel, ha nem hagytad jóvá, eltűnik.

## Hogyan működik
- **Mikor:** az évad szabályaiban beállított napon és időpontban (alapból vasárnap 18:00) a háttérrendszer percenként
  ellenőrzi, kell-e menüt készíteni, és hetente egyszer elkészíti. Ha a szerver épp nem futott, aznap később pótolja.
- **Mennyit:** minden nap kerete az évad számaiból jön — ugyanabból, amit az Étel szoba is mutat: az edzés- és sportnapok
  többet kapnak, a pihenőnapok kevesebbet. A nap étkezési ablakai is ugyanazok, mint az Étel napi tervében (ébredés,
  lefekvés, edzés ideje alapján), ezért a jóváhagyott étel pontosan a saját ablakában jelenik meg ott.
- **Adag:** minden recept adagját az ablak kalóriájához igazítja (fél adagtól dupla adagig, negyed adagos lépésekben).
- **Változatosság:** ugyanaz a vacsora három napon belül nem ismétlődik, amíg van más választás; amiből kevesebbet
  használt a héten, az előnyt kap.
- **Sportnap:** a sport előtti uzsonna „Röplabda előtt” néven jelenik meg, és inkább szénhidrátos ételt kap. Ha egy
  napon több sportalkalom van (például reggel futás, este röpi), mindegyik elé jár egy saját uzsonna (2026-11-27-től).
- **Hét közbeni módosítás:** ha szerdán elfogadsz egy változtatást az évadban, a jóváhagyott hét hátralévő napjai
  (csütörtöktől) igazodnak az új keretekhez: ami még belefér, marad (új adaggal), ami nem, lecserélődik. A már elmúlt
  napokhoz nem nyúl. A Módosítás oldal ezt előre jelzi („A hét hátralévő napjai”), a bevásárlólista pedig egy rövid
  „változott” részben mutatja a különbséget.
- **Boop tudja:** ha a beszélgetésben a menüről kérdezel, Boop látja az e heti és a jövő heti menüt.

## Miért így
A „csak ezek a receptek N hétig” étrend akkor működik, ha nem kell minden nap kitalálni, mit eszel: a menü egyszer, hét
elején eldől, és a napi javaslatok, a bevásárlás és a kalóriakeret ugyanazt mondja. Semmi sem élesedik a jóváhagyásod
nélkül (#61–#64).

## Beállítások
- Szabályok → „Vasárnap este kérem a jövő heti menüt” (ki is kapcsolható; ekkor a fülön kézzel kérhetsz menüt).
- Szabályok → feldolgozottsági szabály (ami feldolgozottabb, nem kerül a menübe).
- „Menübe jöhet” jelölés a recepteknél.

## Adattáblák
`season_menu_week` (a hét: javaslat vagy jóváhagyva), `season_menu_meal` (az étkezések: ablak, recept, adag, kalória),
`season_allowed_recipe` (a kiválasztott receptek).

## Mi jön még
A kiválasztott receptek bővítése egy vezetett „receptgyűjtő” beszélgetéssel (#23).

## Mi marad ki
Árak, készlet, a hűtő tartalmának figyelembe vétele.
