---
cim: Gyakorlatok, rekordok és előzmények
szint: Funkció
terulet: Edzés
allapot: Tervezve
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: A gyakorlat-katalógus videóval, a rekordjaid, a lezárt edzések, a mezociklus-zárójelentés AI-értékeléssel és két futam összehasonlítása.
---

## Mit csinál
*A telefonon ma mindkét fül egyetlen kártya („Gyakorlatok”, illetve „Előzmények” fejjel), benne a „Még nem él” üzenet és hogy
mikor érkezik; alatta a „Kérdezd meg Boopot” sor (2026-11-28, az Edzés újratervezése). Az alábbi a teljes, tervezett tartalom.*

**Gyakorlatok fül:**
- gyakorlat-katalógus videóval és képekkel, izomcsoport szerint;
- rekordok gyakorlatonként (legjobb súly, becsült egyismétléses maximum).

**Előzmények fül:**
- az elvégzett edzések visszanézése;
- **mezociklus-zárójelentés:** teljesítés, a volumen íve a hetek során, kiemelt rekordok, önértékelés, és egy **AI-értékelés**,
  ami az edzést az életmód hátterével (kalória, testsúly, alvás) együtt nézi;
- **két futam összehasonlítása** (például ugyanaz a sablon két egymás utáni lefutása);
- **izomterhelés-térkép:** melyik izomcsoport mennyit dolgozott a héten.

## Hogyan működik
1. A katalógus egy beépített gyakorlatlistából töltődik, és saját gyakorlattal bővíthető. **Minden beépített gyakorlatról
   hat dolgot tudunk (2026-11-19 óta)**, ezekből áll össze a gyakorlatcsere ajánlása: **mivel csinálják** (rúd, gép, kéziszer,
   saját testsúly…), **milyen mozdulat** (nyomás, húzás, hajlítás…), **mely más izmok dolgoznak mellette**, **mely ízületeket
   terheli**, **nyújtott helyzetben terhel-e**, és **mennyire igényes** (kicsi, közepes, nagy). A saját gyakorlataidnál ezek
   üresek: azokat az ajánlás sosem szűri ki eszköz miatt, és a mondatuk mindig ugyanaz: „Saját gyakorlat — erről még keveset tudok.”
2. A rekordok az elvégzett sorozatokból számolódnak.
3. **Lezáráskor** a jelentés ugyanabban a lépésben „befagy”, így később nem változik. Utána a háttérben az AI megírja az
   értékelést, és visszaírja a jelentésbe.
4. Két futam összehasonlítása a webes appban a böngészőben számolódik; a Boop ezt Swiftben vagy a szerveren újraépíti.

## Miért így
A befagyasztott jelentés őszinte összehasonlítást ad két blokk között. Az AI itt is csak magyaráz, a számok a naplóból jönnek.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.meso-review.enabled` | Be/ki kapcsolja a mezociklus végi AI-értékelést | be |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `exercise_catalog` | A gyakorlat-katalógus (név, izomcsoport, típus, videó, képek, és a hat tulajdonság: eszközök, mozdulat, mellékizmok, ízületek, nyújtott helyzet, igényesség) |
| `mesocycle_report` | A befagyasztott zárójelentés és az AI-értékelés |
| `muscle_group_volume_log` | A heti volumen, a volumen-ívhez |
| `exercise_set` | Az elvégzett sorozatok, a rekordokhoz |

## Mi jön még
B5: a két fül natívan.

## Mi marad ki
Érmek (díszítő jutalmak) — lásd [Ami kimarad](12-ami-kimarad.md).
