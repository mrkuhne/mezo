---
cim: Check-in (kitöltés)
szint: Funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, Apple Health]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: Fél perc, öt kérdés és egy napi kérdés — a gömb húzásával válaszolsz, és net nélkül is menthető.
---

## Mit csinál
Teljes képernyős kitöltés az adott kérdés színében. Öt alapkérdés minden alkalommal: **energia, hangulat,
feszültség, test, fejtisztaság**, majd **a nap kérdése** (lásd külön oldal).

- A válasz 1–10: **a gömböt felfelé vagy lefelé húzod**, lépésenként egy finom rezgéssel; a gömb „folyadéka” mutatja
  az értéket. Alatta: „Húzd fel vagy le · legutóbb 6 volt” (például).
- Minden kérdés a mai utolsó válaszodról indul, így ami nem változott, az egyetlen „Tovább” koppintás.
- **Kihagyom** átugrik egy kérdést; a második kérdéstől jobb felül **„Most csak ennyi”** menti, amit eddig megadtál.
- Mentés után: „MENTVE · 16:02 / Ráesett a görbére”, az energiagörbe az új pöttyel, a válaszok, „AZ ÓRÁD EKKOR”
  (pulzus, HRV, lépés, alvás), egy opcionális mondat hanggal vagy írva, és Boop egy mondata.

Megnyitható: az idővonal „Kitöltöm” gombjáról, a Forma gombról, a „+” lapról vagy egy értesítésből.

## Hogyan működik
1. A telefon dönti el a napszakot a saját órája szerint: 10 előtt reggel, 10:00–14:30 dél, utána délután.
2. Ha az adott napszak már ki van töltve, egy csendes sor kérdez: „A délit már kitöltötted 12:40-kor — felülírod?”.
   Egy kitöltés sosem csúszik át másik napszakba.
3. Mentéskor a telefon kiszámolja a **biomarker-pillanatképet** (lásd külön oldal), és mindent a kimenő sorba tesz.
4. A szerver a meglévő check-in rendszerbe ír (napszakonként egy sor, felülírva), a rögzítés idejével. Legfeljebb 7
   nappal korábbi nap fogadható el; jövőbeli nem.
5. Az utólagos mondat a kitöltés megjegyzéseként kerül mellé.

## Miért így
- Öt állandó kérdés + egy változó (a tulajdonos választotta a 3 kérdéses forgatás helyett): folytonos görbék, kb. 30 mp.
  Augusztus–októberben is mindig kitöltötte az alapkérdéseket.
- Húzás koppintás helyett: a Napkelte gömb mozdulata, a tulajdonos a mintán választotta.
- A webes app és minden meglévő olvasó tovább működik, mert ugyanabba a táblába írunk.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.checkin.plan.slots` | Napszakonként milyen kérdések tartoznak hozzá (a négy fix napszak: 06:30, 10:00, 14:00, 20:00) | lásd a konfigurációt |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `check_in` | A kitöltések: napszak, a 14 lehetséges kérdés válaszai, mi lett megkérdezve, „Most csak ennyi” volt-e, a rögzítés ideje, megjegyzés |

## Mi jön még
- Kitöltés widgetből és értesítésből az app megnyitása nélkül — fizetős fiókkal.
- Kitöltés az Apple Watch-ról — B5.

## Mi marad ki
A napszakok kézi kiválasztása — a telefon órája dönt.
