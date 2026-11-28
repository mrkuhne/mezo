---
cim: Receptek, „Ezt főztem” és receptműhely
szint: Funkció
terulet: Étel
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: A saját receptjeid pontszámmal és címkékkel; új receptet elmondod, lefotózod vagy linkből húzol be, és Boop a kamrádhoz köti a hozzávalókat.
---

## Mit csinál
**A Receptek fül:**

- fent négy út egy új recepthez: **Ezt főztem** · Linkből · Fotóból · Receptműhely;
- „A könyvtárad számokban”: hány recept, átlagos pontszám, hány hordoz jelzést neked;
- a könyvtár: keresés, szűrés étkezés szerint, receptenként egy sor — név, címkék (kalória, fehérje, idő), külön
  sorban a sárga érzékenység-jelzés, jobbra a recept saját pontszáma gyűrűben.

**A receptlap:** címkék (étkezés, idő, adag, feldolgozottság), négy makró-csempe egy adagra, „Megeszem 1 adagot”;
„Amire figyelsz” soronként a figyelt allergénekkel; hozzávalók, számozott lépések, és hogy eddig mikor etted.

**Boop értékelése** (2026-11-28 óta, az Étel színeivel: zöld, méz, korall):

- **rozetta** — a pontszám középen, körülötte szempontonként egy szirom, minél hosszabb, annál jobb; mellette egy
  címsor, ami erre az ételre szól (például „Fehérjében erős reggeli, a só húzza le”), a megbízhatóság, mire jó, és egy
  rövid összefoglaló;
- **Ha ma megennéd** — a mai napod eddigi kalóriája és makrói, és hová jutnál ezzel az adaggal; ha túllépnéd a keretet,
  azt is megmondja („120 kcal felett”), kímélő napon keret nélkül;
- **Miből áll össze** — nyolc csempe, a leggyengébb sárga ponttal; egy csempére koppintva az oldal elhomályosul, és
  egy részletes lap jön fel: mit mér, miért ennyi, a számok, **honnan jön** (melyik hozzávaló hozza a sót, a cukrot, a
  telített zsírt, a rostot) és hogyan javítható; koppintás mellé bezárja;
- **A receptjeid között** — hányadik a pontszáma a receptjeid közül, miben a legjobb, és hányszor etted;
- **Így lenne jobb** — konkrét csere mennyiséggel, mellette, melyik szemponton javít;
- **Hasznos volt?** — Igen / Nem, Boop ebből tanul.

**„Ezt főztem”:** elmondod (diktálva), beírod és/vagy lefotózod (legfeljebb 6 kép), miből és mennyit főztél. Boop
kiolvassa a hozzávalókat, és az **átnézőben** minden sor egyike:

- **megvan** — a kamrádból; „Másik” gombbal cserélhető;
- **erősítsd meg** (sárga) — „Ez az” vagy „Másik”; ide kerül a bizonytalan mennyiség is („2 evőkanál olaj”);
- **hiányzik** — „+ Kamrába” egy koppintással.

Minden soron ott van, amit eredetileg mondtál, a mennyiség átírható, az egység a kamra-tétel saját egysége.
„Mind rendben” egyszerre jóváhagy mindent, „Kiveszem” kiveszi a sort. Amíg van bizonytalan sor vagy hiányzó
mennyiség, a mentés vár. „Mentem” vagy „Mentem, és rögzítem mára” (egy adagot rögtön rögzít is). A link-, fotó- és
műhely-behúzás átnézője ugyanezt tudja.

## Hogyan működik
1. A szöveg és a fotók az AI-hoz mennek, ami a hozzávaló-sorokat olvassa ki; **a fotókat nem tároljuk**, a diktálás
   a telefonon marad (hang nem megy fel).
2. A párosítás: előbb pontos név a kamrádban és a közös listában; ha nincs, egy rövid jelöltlistából az AI választhat,
   de **csak a listán szereplőt**, és az mindig „erősítsd meg” lesz. Nem pontos egyezés soha nem kötődik a koppintásod
   nélkül.
3. A mennyiséget a háttérrendszer a kamra-tétel egységébe váltja (30 deka → 300 g, 2 dl → 200 ml); amit nem lehet
   biztosan, azt megjelöli.
4. A recept pontszámát szabályok adják (nyolc szempont), a szöveget (címsor, összefoglaló, szempontonként 3–4 mondat,
   tippek) az AI írja — csak a szabályok számait magyarázza, saját számot nem talál ki. A „honnan jön” sorokat nem az
   AI, hanem a hozzávalók tápértéke adja, minden megnyitáskor frissen. A régi, sablonos szövegek a recept következő
   megnyitásakor újraíródnak. A „Ha ma megennéd” a telefonon számolódik a mai étkezéseidből, ugyanúgy, mint az Étel
   „Ma” fülén.
5. Egy dupla koppintás sem hoz létre két receptet.

## Miért így
A tulajdonos 2026-11-17-én kérte az „Ezt főztem”-et (spec `2026-11-17-boop-ezt-foztem-design.md`), 2026-11-19-én pedig
a recept- és kamraoldalak átrendezését: tagolás, ikonok, címkék, látható pontszám és a szempontok, és hogy az
érzékenység ne törje szét a sort. 2026-11-27-én azt jelezte, hogy a webes appban gazdagabb volt a receptértékelés;
a 2026-11-28-i újratervezés (döntések #124–#125) ezt hozta vissza és tette túl: napi hatás, rangsor, részletlap,
ételre szabott szöveg.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.recipe-cooked.enabled` | Be/ki kapcsolja az „Ezt főztem”-et | be |
| `mezo.recipe-cooked.max-photos` | Legfeljebb ennyi fotó egy rögzítésben | 6 |
| `mezo.recipe-cooked.max-total-bytes` | A fotók együttes legnagyobb mérete | 24 MB |
| `mezo.recipe-cooked.shortlist-size` | Ennyi kamra-jelöltet kap az AI soronként | 8 |
| `mezo.feature.recipe-workshop.enabled` | Be/ki kapcsolja a receptműhelyt | be |
| `mezo.feature.recipe-ai-score.enabled` | Be/ki kapcsolja a recept szöveges értékelését (a szám marad) | be |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `recipe` | A recept: név, kategória, adagszám, idők, címkék, kedvenc, szerep, és a mentés azonosítója a dupla mentés ellen |
| `recipe_ingredient` | A hozzávalók, kamra-tételhez kötve, tápérték-pillanatképpel |
| `message_feedback` | A „Hasznos volt?” válasz receptenként (Igen / Nem), a visszajelzések közös táblájában |

## Mi jön még
- B6: „csak ezek a receptek N hétig” étrendi terv és bevásárlólista.
- A kész étel súlya a recepten, és rögzítés főtt grammra.

## Mi marad ki
Szabadon választható mértékegység egy kamrához kötött soron: az egység a kamra-tételé, hogy a kalória ne lehessen
hamis.
