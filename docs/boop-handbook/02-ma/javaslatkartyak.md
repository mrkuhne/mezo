---
cim: Javaslatkártyák és a „miért?”
szint: Funkció
terulet: Ma
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S3, B2]
osszefoglalo: Boop egy mondatban javasol valamit, te elfogadod vagy elhalasztod — és a „miért?” megmutatja, mire alapozza.
---

## Mit csinál
Egy javaslatkártya: egy mondat, egy fő gomb (**Elfogadom**), egy másodlagos (**Most nem**) és egy **„miért?”**
link. Ma egyetlen fajta javaslat él: ha az utolsó megbeszélés túl közel ér véget az edzéshez, Boop javasolja,
hogy told el (például „Áttolom 18:30-ra”).

- **Elfogadom** — az edzés időpontja átkerül, egy felugró üzenet visszavonást kínál; a kártya „Elfogadtad” lesz.
  A „Vissza 17:30-ra” gomb a Mozgás szoba edzéskártyáján él.
- **Most nem** — aznapra eltűnik.
- **miért?** — egy lap a tényekkel (például: meddig tart a megbeszélés, mikor kezdődik az edzés).
- Naponta legfeljebb **3** javaslat.

## Hogyan működik
1. A szerver szabállyal ismeri fel az ütközést: ha az edzés előtti utolsó megbeszélés 45 percnél közelebb ér véget
   (vagy még tart), javaslat: a megbeszélés vége + 60 perc, félórára kerekítve.
2. Elfogadáskor csak a mai edzés **időpontja** módosul; az edzésterv maga nem változik.
3. A Ma és a szobák ugyanazt a javaslatlistát látják: ha egy szobában fogadod el, a Ma oldalon is látszik.

## Miért így
Spec és Döntések napló, 5. pont: **semmi sem változik a tulajdonos koppintása nélkül**, és a szakértők (Alvás,
Mozgás, Étkezés, Közérzet, Szkeptikus) csak a „miért?” mögött szólalnak meg, rövid feliratos sorokban.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| (kódban rögzítve) | Napi javaslatplafon | 3 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `workout_time_override` | A mai edzés áttolt időpontja (napi egy, visszavonható) |

## Mi jön még
- Szakértői sorok (Közérzet, Szkeptikus) a „miért?” lapon — B8.
- Új javaslatfajták (étel ±, rövidebb/hosszabb edzés, más mozgás) és értesítés róluk — B7.

## Mi marad ki
Automatikus alkalmazás — soha.
