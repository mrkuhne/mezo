---
cim: Gyakorlás és javaslatok — gyakorló kereskedés papíron, termékjegyzék, felosztás nagyobb összegre
szint: Funkció
terulet: Pénz
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [Életpanel]
osszefoglalo: A Gyakorlás oldalon valódi pénz nélkül, papíron gyakorolhatod a kereskedést — előre megírt tervvel, utólag egy sorral, heti visszanézéssel. Ha nagyobb összeged van, vagy havonta jön a stratégia ideje, Boop időtávok szerint felosztja, és a te jóváhagyott termékeidből ad két-három lehetőséget — te döntesz, ő soha nem vásárol.
---

## Mit csinál
- **Gyakorlás — papíron, valódi pénz nélkül.** Itt azt gyakorlod, ahogy a napi kereskedést szeretnéd csinálni, de
  semmi nem valódi: nincs bróker, nincs élő ár — a belépő és a záró árat te írod be.
  - **Terv előbb (*Új kereskedés*).** Belépés előtt le kell írnod három dolgot: **mit** veszel vagy adsz el,
    **miért**, és **hol lépsz ki**, ha nem úgy alakul. Terv nélkül nincs kereskedés — a rendszer nem engedi
    megnyitni. Utána jön a belépő ára és napja, és ekkor ellenőrzi a keretet is.
  - **Egy sor utána.** Zárásnál beírod a záró árat, kiválasztasz legalább egy címkét a nyolc közül, és ha hibának
    érzed, megjelölöd; végül egy rövid sor arról, mi történt. A nyolc címke: *Kitörés · Visszateszt · Nyitási
    tartomány · Trend mentén · Fordulóra · Hírre ugrottam · Korán zártam · Eltértem a tervtől*. A hibajel külön
    dolog: egy jó címkéjű kereskedés is lehet hiba.
  - **Az R.** Az R azt mondja meg, hány „kockázatnyit" nyertél vagy veszítettél: ha a tervedben 1 000 Ft volt a
    kilépésig a veszteség, és 2 000 Ft-ot nyertél, az +2 R; ha a kilépő szinten kiszálltál, az −1 R. Így a kis és
    nagy tétek összehasonlíthatók.
  - **Heti visszanézés.** Minden héten Boop megmondja, mi működött, **melyik volt a hét leggyakoribb hibája** és
    **mennyibe került** forintban. Ezt a rendszer számolja fix szabályokkal, nem az AI találja ki.
  - **50 jelölt kereskedés alatt zaj.** Amíg nincs legalább 50 lezárt, címkézett kereskedésed, az átlagok és
    arányok még csak zajok — az oldal ezt ki is írja, hogy ne vonj le belőlük következtetést.
  - **Havi 20 000 Ft-os keret.** A gyakorlásra havonta legfeljebb ennyit „játszhatsz el" — ez ugyanaz a sor, mint
    a Költés oldalon a *Gyakorlás*. A keret a többi pénzedtől nem vesz el, és a nyereség sem növeli. Ha egy
    belépés túllépné, a rendszer nem engedi, és megmondja, mennyi fér még bele.
  - **Papíron = nincs valódi pénz.** Az *Élesre fordítás* oldal őszintén megmondja: ezt a kapcsolót később te
    fordítod át, és még nincs megépítve.
- **Termékjegyzék — amiből Boop javasolhat.** Boop csak azt javasolja, amit te jóváhagytál. A lista kutatásból
  indul (állampapír, pénzpiaci és kötvényalap, ETF-ek), időtávok szerint csoportosítva; mindegyiknél egy koppintás:
  *Jóváhagyom* vagy *Nem kell*. Te is felvehetsz egyet, és átírhatod a díjakat. **Minden díj mellett ott áll,
  mikor ellenőrizték és honnan származik.** Az AI soha nem tesz fel új terméket a listára.
- **Javaslatok — *Felosztást kérek*, *Nagyobb összeg*, *Havi stratégia*.** Megadsz egy összeget (vagy a havi
  stratégia kiszámolja a havonta befektethetőt), Boop pedig felosztja **időtávok szerint** — fix szabályokkal:
  - **először a tartalék** (1–3 év): addig tölti, amíg el nem éri az általad beállított számú hónapnyi fix
    kiadást;
  - **ami marad: 40% közép (5–10 év), 60% hosszú (10+ év).**
  Minden számot átírhatsz. Időtávonként **két-három, általad jóváhagyott terméket** kapsz: mi az, miben
  különbözik a másiktól, mennyi az **éves költsége** a javasolt összegre, és miért ez. Ha egy időtávra még kevés a
  jóváhagyott termék, Boop ezt őszintén kiírja, és a Termékjegyzékhez irányít.
- **Elfogadás = egy ellenőrzőlista.** Ha elfogadod, kapsz egy listát, amit **te pipálsz ki**. A pipálás nem
  rögzít semmit: a tényleges vásárlást a saját platformodon intézed, és utána a *Befektetést rögzítek* lappal
  írod fel a Pénzemben.
- **Amit Boop sosem tesz:** nem vásárol, nem mozgat pénzt, nem sürget, nem ígér hozamot, és soha nem mondja,
  hogy adj el.

## Hogyan működik
- **Minden számot a rendszer számol** — a felosztást, a költségeket, az R-t, a heti hibát és annak árát. Az AI
  csak a szöveget írja a javaslathoz, és utána egy ellenőr átnézi: nem szerepelhet benne olyan szám, amit a rendszer
  nem számolt ki, csak a rekesz jóváhagyott termékeit említheti, nem sürgethet, nem ígérhet hozamot, nem mondhat
  eladást. Ha bármi nem stimmel, a rendszer ugyanazokból a számokból írt egyszerű, őszinte szöveget használ.
- **A heti visszanézés nem AI**: rögzített mondatok, amik a számokból állnak össze — nem tud kitalálni semmit.
- **Az állapotváltás szigorú:** egy kereskedés csak tervként jöhet létre, csak tervből nyitható, csak nyitottból
  zárható. Ha mégis rossz sorrendben próbálsz valamit, egyértelmű magyar üzenetet kapsz, és amit beírtál, nem vész el.
- **Új javaslat** csak akkor készül, ha kéred (*Havi stratégia*: *Kérek javaslatot*). Értesítés nincs, kártya a Ma
  oldalon várja a válaszodat: *Elfogadom* vagy *Most nem*, és a *miért?* mögött minden szabály leírva.
- A javaslat nem a gyakorló pénzből dolgozik, és nem érinti a Pénzem összegeit, amíg te nem rögzítesz valamit.

Például: ha 500 000 Ft-ot adnál meg, és a tartalékod már teljes, a felosztás 200 000 Ft közép és 300 000 Ft
hosszú — a kártyán mindkét rekesznél két-három termék áll éves költséggel; ez csak kitalált példa.

## Miért így
- „Nincs terv, nincs kereskedés”: a gyakorlás célja a fegyelem, nem a nyereség — a tulajdonos döntése szerint
  papíron megy, és a valódi pénzre váltás később, az ő kapcsolója lesz.
- A keret ugyanaz a szám, mint a Költésben, hogy a két oldal ne mondhasson mást, és hogy a gyakorlás sose vegyen el a
  megélhetésből vagy a megtakarításból.
- A termékeket csak te hagyhatod jóvá, mert pénzügyi témában az AI-nak nem szabad új dolgot a listára tennie.
- Az R és a hibajel azért van, mert a kis kereskedések összehasonlíthatók, és a leggyakoribb hiba ára az, ami
  tanít.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| Havi gyakorlási keret | mennyit „játszhatsz el" havonta papíron; ugyanaz, mint a Költés *Gyakorlás* sora | 20 000 Ft |
| Tartalék hónapjai | hány hónapnyi fix kiadásig töltse előbb a tartalékot a javaslat | az általad beállított érték |
| Felosztás arányai | a közép és hosszú rekesz aránya a tartalék után | 40% / 60% (javaslatonként átírhatod) |
| Termékjegyzék | mely termékeket hagytad jóvá, és a díjaik | a kutatott lista, jóváhagyásra várva |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `penz_paper_trade` | a gyakorló kereskedéseid: terv, belépő, kilépő, címkék, hibajel, egy sor, az R és az eredmény |
| `penz_product` | a termékjegyzéked: mi az, díjak, forrás, mikor ellenőrizték, jóváhagyás |
| `penz_proposal` | a javaslatok: a felosztás, az opciók, a kiszámolt számok, az elfogadott lista és a pipák |

## Mi jön még
- A hosszú távú heti hírátnézés — külön jegy.
- Az „élesre fordítás”: valódi pénzzel, a te kapcsolóddal — később, külön döntés.
- Az „ennyit tudsz befektetni” szám a Ma oldalon, a Havi stratégia számából.

## Mi marad ki
- Brókerkapcsolat, automatikus vásárlás vagy eladás — soha.
- Élő árak — a gyakorlásban te írod be a záró árat.
- Valódi pénzes kereskedés — még nincs; az átváltás a te kapcsolód lesz, később.
- Értesítés új javaslatról — nem lesz; a Ma oldalon vár.
