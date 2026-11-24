---
cim: A terület — Ma, Test és Napló oldal
szint: Funkció
terulet: Súly
allapot: Élesben
hol: [iPhone app, Háttérrendszer, Apple Health]
szulo: 00-attekintes
szakasz: [Kezdőlap]
osszefoglalo: A kezdőlap arany Súly gömbje egy élő oldalt nyit — a Ma oldal megmondja, tartod-e az évad ütemét, a Test oldal a mérleg testzsírját és izomtömegét mutatja, a Napló minden mérésedet hetenként.
---

## Mit csinál
A kör **Súly** gömbje (az Energia és a Forma között) egy saját oldalt nyit, saját alsó sávval: **Ma · Test · Napló ·
Boop**. A fej gömbjében ugyanaz a szám áll, mint a kezdőlapon: **mennyire tartod az évad tervezett ütemét**.

- **Ma — „jól megy-e?”** Fent egy mondat: *„Pályán vagy a súlycélhoz”*, *„Lassabb a tervnél”*, *„Gyorsabb a
  tervnél”* (tartó évadnál *„A sávban vagy”* / *„Kint a sávból”*), alatta a számok mondatban (például „A trended
  heti 0,4 kg-ot megy lefelé, a terv 0,5. Így február 14. körül éred el a 82 kg-ot.”). Aztán:
  - **Ami ma számít:** a mai mérés és a trend („Ma 84,3 kg — a trend 84,6.”), vagy hogy ma még nem mértél; a
    *Súly rögzítése* gombbal.
  - Három szám: **most (trend)** · **a cél** a dátumával · **heti fogyás** (vagy hízás) a terv ütemével.
  - **A súlyod:** az évad görbéje a kezdéstől máig, utána a terv szaggatott vonala a célig, a cél vonalával; alatta
    mennyi ment le eddig, mennyi van hátra, és hány hét kell még ezen az ütemen. Évad nélkül a trend utolsó nyolc hete.
  - **A hét mérései:** a heti mérések napja, forrása és száma.
  - **A cél:** egy sor az Évadba (ott módosítod).
  - *„Honnan tudom, hogy pályán vagy?”* — a szám szabálya emberi nyelven.
- **Test — a mérleg szerint.** **Testzsír %**, **izomtömeg** és **BMI** (a trend súlyából és a profilod
  magasságából); alattuk a 90 napos vonalak. Egy harminc napnál régebbi mérés már nem „mostani”: akkor „–” áll. A
  Feelfit mérleg az Apple Egészségbe ír, Boop onnan olvassa, a telefonon.
- **Napló — minden mérés.** Hetenként (*ez a hét*, *múlt hét*, aztán a dátumok), a hét átlagával; a mérés napja,
  forrása (mérés vagy kézzel) és a kilók. Tizenkét hétre visszamenőleg; a régebbiek a trendben élnek tovább.

**A szám szabálya** (0–100):
- fogyó vagy hízó évadnál a trended elmúlt négy hetének heti változását mérem a terv heti üteméhez: pont a terven
  **100**, fele ütemnél **50**, ha áll a súlyod vagy rossz irányba megy **0**; a gyorsabb fogyás feleannyit von le,
  mint a lassabb (hogy ne legyen túl gyors, azt az évad erő-őre figyeli);
- tartó évadnál a sáv közepétől mért távolság: a sávban 80–100, kívül egyre kevesebb, egy sávszélességgel kijjebb 0;
- **évad nélkül, trend nélkül vagy kevés mérésnél „–”** — kitalált szám sosem áll a gömbön.

## Hogyan működik
1. A terület egyszerre olvassa az évad áttekintését (a cél, a tervezett ütem, a görbe), a szerver súlytrendjét
   (a kisimított vonal és a heti ütemek), a súlynaplót és — a telefonon — az Apple Egészség testzsír- és
   izomtömeg-méréseit az elmúlt 90 napból, és a profilod magasságát a BMI-hez.
2. Mindezt egyben elmenti a telefonra: **net nélkül** az utolsó képet mutatja a korával („5 órás adat”); ha még
   nincs elmentett kép, őszintén megmondja.
3. Egy új mérés (a gyors rögzítés *Súly* lapja, vagy a mérleg az Egészségen át) után a gömb és az oldal újraolvas.
4. A *Súly rögzítése* ugyanazt a lapot nyitja, mint a „+” Súly ajtaja; a mérés net nélkül is rögzül, és magától elmegy.

## Miért így
A tulajdonos döntései (2026-11-24): a kilencedik gömb, a Pénz-minta saját színben, a szám az ütem tartása (nem a
célig megtett út, ami hónapokig alig mozdulna), és a Test oldal a régi „Testösszetétel” terv helyett.

## Beállítások
Nincs saját beállítása. A célt és az ütemet az Évadban állítod; a magasságot a profilodban.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `weight_log` | A mérlegeléseid (kézi és az Egészségből átvett), napra |
| `season` | Az aktív évad a súlycéllal és a tervezett ütemmel |
| `biometric_profile` | A magasságod a BMI-hez |

## Mi jön még
- A testzsír a cél energiaszámításába (szerver, külön lépés).

## Mi marad ki
- Heti súly-ajánlás itt: az évad heti korrekciója az Évad dolga.
