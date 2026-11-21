---
cim: Étkezés rögzítése
szint: Funkció
terulet: Étel
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Fotó és szöveg együtt, utána bármi hozzátehető (recept, kamra-tétel, vonalkód), az időpont visszamenőleg is megadható, és jóváhagyás nélkül semmi nem mentődik.
---

## Mit csinál
A rögzítő egy oldalon mindent egyszerre fogad:

- **Mikor etted:** alapból most; egy koppintással fél, egy vagy két órája, vagy bármely időpont az elmúlt hétből.
  Az étkezés a megadott időponthoz tartozó napszakhoz kerül.
- **Fotó** (kamera vagy képtár) **és szöveg együtt:** fotó mellett a szövegmező „Segíts Boopnak a fotóhoz” lesz
  (például „másfél adag, olívaolajjal sütve”). A gomb ilyenkor „Kiszámolom a fotóból és a leírásból”.
- **Leírás nélkül:** Recept · Kamra · Vonalkód · Szokásos. A recept- és a kamraválasztóban **keresőmező és szűrő** van (2026-11-21): beírhatod a nevét (ékezet nélkül is megtalálja), a recepteket étkezés szerint (reggeli, ebéd, vacsora, nassolás), a kamrát kategória szerint szűrheted — ugyanúgy, mint a Receptek és a Kamra fülön.

Számolás közben a fotón fénycsík megy végig sarokjelekkel, a felirat lépésenként mondja, mit csinál Boop
(fotó nélkül a gömb lüktet). Utána jön a **vázlat**: fotó, időpont, négy makró-csempe, és a tányér tételei külön
csempékben — név, forrás (kamra / recept / becslés), kalória; mennyiség léptetővel (átírható); makrók;
„Leveszem”. Ami átnézést kér, sárga keretet kap. A **„Hozzáteszek még”** blokkban ugyanahhoz az étkezéshez fotót,
receptet, kamra-tételt, vonalkódos terméket vagy további szöveget adhatsz. **Jóváhagyás nélkül semmi nem mentődik.**
Net nélkül a fotó és a szöveg a telefonon vár, és egy kártya kéri a jóváhagyást, amint van net.

## Hogyan működik
1. A telefon a fotót és/vagy a szöveget egyszerre küldi a háttérrendszernek; az AI a te kamrádhoz és receptjeidhez
   köti a felismert ételeket. Ahol talál egyezést, a tápérték **az adatbázisból** jön, ahol nem, „becslés” lesz.
2. A „Hozzáteszek még” újabb fotója vagy szövege ugyanígy megy fel, és a talált tételek a meglévők mellé kerülnek;
   a recept, a kamra-tétel és a vonalkódos termék AI nélkül, egyenesen a tányérra kerül.
3. Mentéskor minden tétel tápértéke befagyasztva kerül el, és az étkezés azonnal pontszámot kap.

## Miért így
A tulajdonos 2026-11-19-én kérte vissza a régi tudást: egyszerre kép, recept, szöveg és kamra-tétel; visszamenőleges
időpont; a szkennelés-animáció; és egy élőbb, színesebb rögzítő. A tányér tételeit ugyanaznap kérte tagoltabbra.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.meal-ai-log.enabled` | Be/ki kapcsolja az AI-vázlatot (fotó/szöveg) | be |
| `mezo.meal-ai-log.max-photo-bytes` | A feltölthető fotó legnagyobb mérete | 5 MB |
| `mezo.meal-ai-log.confidence-threshold` | Ez alatti biztonságnál a tétel „nézd át” | 0,6 |
| `mezo.meal-ai-log.max-items` | Legfeljebb ennyi tétel egy vázlatban | 12 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meal` | Az étkezés feje: időpont, nap, étkezési alkalom, eredet, pontszám |
| `meal_item` | A tételek (recept, kamra-tétel vagy becslés), befagyasztott tápértékkel |
| `ai_draft_outcome` | Mi lett az AI-vázlatokkal: elfogadva, átírva, elvetve |

## Mi jön még
Siri („rögzítsd: ebéd…”) abban a szakaszban, amelyik először igényli.

## Mi marad ki
Több fotó egy vázlatba egyszerre: a rögzítő egy fotót visz, a többit a „Hozzáteszek még” adja hozzá.
