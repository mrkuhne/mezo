---
cim: Blokképítő és heti átnézés
szint: Funkció
terulet: Edzés
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: A futó blokkodat a telefonon igazítod izmonként, naponként és a teljes blokkra (edzésmód, technikák), a szerver azonnal megméri; hétfőn pedig egy kártyapakliban gyakorlatonként elfogadod vagy megtartod, mi változzon — vagy egy gombbal átnézés nélkül elfogadod.
---

## Mit csinál
**Az Edzés → Blokk fülön** két új dolog van.

**A heti átnézés kártyája.** Hétfőn, amikor a szerver összerakja a hét javaslatát, a Blokk fül tetején megjelenik: „Új hét ·
jóváhagyásra vár — 4 izomnál változna valami” (például). Két gomb van rajta:
- **Átnézem** — megnyílik a pakli: izmonként egy kártya, rajta gyakorlatonként egy csempe (például „Hétfő · Evezés: 2 → 3
  sorozat”, alatta az okok kis címkéken: „minden sorozat megvolt”, „könnyen ment”). Minden csempének saját **elfogadom** és
  **marad** gombja van; a kártya alján „Elfogadom mind” / „A többi marad”. Utána jön egy kártya azokról az izmokról, amelyek nem
  változnak, és egy **összegzés**: hány sorozat lesz a héten, hány emelés lett elfogadva, és melyik napon érzed majd a változást.
  Az összegzés gombja („Indulhat a hét”, vagy ha maradt eldöntetlen: „Így is indulhat, a többi marad”) egyszerre küldi el a
  döntéseidet; ami eldöntetlen maradt, az a múlt heti számon marad.
- **Elfogadom átnézés nélkül** — mindent elfogad egy koppintással.

Ha a hét már életbe lépett, a kártya azt mutatja: „Indulhat, a hét számai élnek”, és a pakli csak visszanézhető.

**A blokképítő** („Blokk szerkesztése”) egy teljes képernyő saját, háromgombos sávval:
- **Izmok** — a test képe, alatta izmonként egy kártya: a szint (Tartás · Építés · Hangsúly) egy kapcsolón, egy félköríves mérőn
  a sáv és a te heti számod, hol vannak a sorozatok a héten, és ha az izom kilóg a sávjából, egy **konkrét javaslat** („+1 Lehúzás
  (hétfő)”) **Elfogadom** és **miért?** gombbal.
- **Napok** — naponként egy lap: becsült edzéshossz, aznap van-e sport, izomcsoportonkénti sorozatszám, gyakorlatonként egy
  léptető (1–8 sorozat), a gyakorlat technikája egy címkén (koppintásra vált), és a nap **kihívása** egy zászlóval. Ha egy izomra
  egy napon túl sok jut, sárgán szól.
- **Blokk** — az **edzésmód** négy közül (Kiegyensúlyozott · Sok ismétlés · Nagyobb súly · Két sorozat bukásig), két kapcsoló
  (**Technikák** be/ki, **A heti javaslatot én hagyom jóvá**), a blokk heteinek sorozatszáma és izmonként az út hétről hétre.

Egyetlen fő gomb van: amíg valamelyik izom kilóg, **„Igazítsd a sávba”** (minden kilógó izomra alkalmazza a javaslatot), utána
**„Mentés”**.

## Hogyan működik
1. A telefon lekéri a futó blokkot és a gyakorlatok adatait (melyik stabil, melyiknél biztonságos a félismétlés).
2. Minden koppintás után (fél másodpercen belül) elküldi a **piszkozatot a szerver tervmérőjének**, és azt rajzolja ki, amit az
   mond — a sávot, hol állsz, a javaslatot, az edzéshosszt, a heti utat. A telefon maga nem számol sávot. Ha a mérés nem sikerül,
   a legutóbbi számok maradnak a képernyőn, „frissül…” jelzéssel.
3. **Mentéskor** csak azt küldi, ami változott, ebben a sorrendben: a blokk beállításai (edzésmód, technikák, jóváhagyás módja) →
   az izmok szintje → a megváltozott napok. Ha félúton elakad, megmondja, mi mentődött el és mi nem.
4. A heti javaslatot a szerver hétfőn, az első megnyitáskor rakja össze. **Ha a blokkon be van kapcsolva a jóváhagyás**, a javaslat
   megvárja a döntésedet; amit a hét végéig nem döntesz el, az nem lép életbe. Kikapcsolva magától életbe lép, és csak
   visszanézheted.
5. Ha egy új szerver-oldali változás olyan javaslat-fajtát vagy okot küld, amit a telefon még nem ismer, a csempe akkor is
   megjelenik (egyszerű „mennyiről mennyire” formában), csak címke nélkül — sosem tűnik el a pakli miatta.

## Miért így
- A tulajdonos döntései: az app **javasol, te döntesz**; a heti átnézés gyakorlatonként, „Elfogadom átnézés nélkül” gombbal; a
  képernyők csak a telefonon készülnek; a kinézet a szimulátorban jóváhagyott (7 kör, 2026-11-17).
- A futó blokkon is menthető az edzésmód, a technikák és a jóváhagyás módja — a tulajdonos döntése, 2026-11-19 („Igen, A változat”),
  különben az átnézés csak visszanézés lenne.
- Az automatikus mód addig maradt bekapcsolva, amíg ez a képernyő elkészült (a tulajdonos szabálya).

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| A blokk „A heti javaslatot én hagyom jóvá” kapcsolója (`mesocycle.weekly_review_mode`) | Blokkonként: a heti javaslat jóváhagyásra vár-e | a szerver alapértéke |
| `mezo.volume.weekly-review.mode` | A szerver alapértéke azoknak a blokkoknak, ahol nincs saját beállítás | magától |
| A blokk „Technikák” kapcsolója (`mesocycle.techniques_enabled`) | Kerülhet-e technika és kihívás a gyakorlatokra | ki |
| A blokk edzésmódja (`mesocycle.training_style`) | Ismétléstartomány, tartalék és pihenő a blokk gyakorlatain | nincs |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `mesocycle` | A blokk; új oszlop: `weekly_review_mode` (magától / jóváhagyásra vár, üres = a szerver alapértéke) |
| `exercise` | A blokk gyakorlatai sorozatszámmal, technikával, kihívással — a mentés ezt írja |
| `meso_week_proposal` | A heti javaslat soronként a döntéseiddel |

## Mi jön még
- A technika és a kihívás edzés közben (lépésenként mit csinálj, a legyőzendő szám) — külön jegy, a technika-tervező után.
- Új blokk összerakása a semmiből a telefonon (időkeret, tapasztalat, 2–3 felosztás-javaslat — a tulajdonos 49. döntése).

## Mi marad ki
- Gyakorlat hozzáadása, törlése vagy cseréje az építőben (a cserét edzés közben a lejátszó tudja).
- A régi „A blokk terhelése” oldal saját számolása egyelőre marad; később beolvad az építőbe.
