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
**A Receptek fül** (2026-11-28 óta kártyás rendben, mint a Ma és a Hét):

- **felül a kiemelt kártya** („A receptkönyved”): hány recept, átlagos pontszám, hány hordoz jelzést neked, alatta egy
  kis sáv, ami megmutatja, mire valók a receptjeid (reggeli, ebéd, vacsora, nasi — darabszámmal);
- **„Új recept” kártya**: négy út egy új recepthez — **Ezt főztem** · Linkből · Fotóból · Receptműhely;
- **„A legjobbak neked”**: oldalra lapozható sor a legjobb pontszámú (legfeljebb öt) receptedből, mindegyik saját
  kártyán fotóval, pontgyűrűvel, étkezéssel, kalóriával és fehérjével; koppintásra nyílik a receptlap. A sor nincs
  kártyába zárva, és csak akkor látszik, ha legalább három receptednek van pontszáma;
- **„A könyvtárad” kártya**: keresés, szűrés étkezés szerint, receptenként egy sor — név, címkék (kalória, fehérje,
  idő), külön sorban a sárga érzékenység-jelzés, jobbra a recept saját pontszáma gyűrűben.

**A receptlap:** címkék (étkezés, idő, adag, feldolgozottság), négy makró-csempe egy adagra, „Megeszem 1 adagot”;
**Boop értékelése**: a pontszám, mire jó („edzés után jó”), egymondatos ítélet, összefoglaló, a szempontok csempéi
(koppintásra magyarázat) és „Így lenne jobb” tippek; „Amire figyelsz” soronként a figyelt allergénekkel; hozzávalók,
számozott lépések, és hogy eddig mikor etted.

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
4. A recept pontszámát szabályok adják (nyolc szempont), a szöveget (ítélet, összefoglaló, tippek) az AI írja.
5. Egy dupla koppintás sem hoz létre két receptet.

## Miért így
A tulajdonos 2026-11-17-én kérte az „Ezt főztem”-et (spec `2026-11-17-boop-ezt-foztem-design.md`), 2026-11-19-én pedig
a recept- és kamraoldalak átrendezését: tagolás, ikonok, címkék, látható pontszám és a szempontok, és hogy az
érzékenység ne törje szét a sort.

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

## Mi jön még
- B6: „csak ezek a receptek N hétig” étrendi terv és bevásárlólista.
- A kész étel súlya a recepten, és rögzítés főtt grammra.

## Mi marad ki
Szabadon választható mértékegység egy kamrához kötött soron: az egység a kamra-tételé, hogy a kalória ne lehessen
hamis.
