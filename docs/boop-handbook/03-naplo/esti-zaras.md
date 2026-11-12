---
cim: Esti zárás egy perc alatt
szint: Funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: Négy rövid lépés alkonyi égbolt alatt — hogy vagy, sikerült-e a cél, milyen volt a nap, és ha van kedved, mesélj.
---

## Mit csinál
**„ESTI ZÁRÁS · EGY PERC / Zárjuk le a napot”** — egy oldal, négy számozott lépés, mindegyik kipipálódik:

1. **Hogy vagy most?** — energia 1–10, tíz kis élő gömb közül egy koppintás (ez az esti kitöltés energiája).
2. **A nap célja** — Sikerült · Részben · Nem; alatta **„BOOP CÉLJAI · MAGUKTÓL”** az adatokból kipipálva.
3. **Milyen volt a nap?** — öt élő gömb: *Nehéz … Rendben … Remek*.
4. **Mesélj** (ha van kedved) — hangnapló vagy begépelt szöveg.

A **„Lezárom a napot”** a 3. lépés után aktív („A napot az értékelés zárja le, a többi elhagyható.”). Utána: Boop
egy mondata a napról, **„A MAI NAPOD”** összegzés (értékelés, a cél, esti energia, Boop céljai például 2/3, a napló
idézete) és a lefekvési emlékeztető sora (például „22:15-kor szólok a lefekvés miatt”). Összesen **5 koppintás**.
Ha a nap már a webes appban le lett zárva, a Boop lezártként mutatja, a „Módosítom” újranyitja.

## Hogyan működik
1. A zárás a telefonra mentődik, és a kimenő sorból megy fel (net nélkül is). Legfeljebb 7 nappal korábbi nap zárható.
2. A szerver egy **egységes zárási rekordot** ír, és — hogy minden régi rész tovább működjön — beírja a régi helyekre
   is: a nap értékelését a szándékhoz, a lezárás tényét a régi esti rituáléhoz, és az esti (20:00) kitöltésbe az energiát
   és az értékelést (az 1–5-ös skála kétszereseként az 1–10-esre).
3. A mesélés szövege **egyetlen helyen** él: a naplóban; a zárás csak hivatkozik rá. Előbb a zárás megy fel szöveg nélkül,
   a szöveg később.
4. Boop mondatát egy olcsó AI-modell írja, csak ha van net; ugyanarra a bemenetre nem hívja kétszer.

## Miért így
- A tulajdonos döntése (B3 spec, D3): az esti kitöltés **maga** a zárás — egy pillanat kettő helyett.
- A régi helyekre írás (a régi olvasók átírása helyett) gyorsabb és biztonságosabb; a régiek kivezetése egy későbbi takarítás.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.dayclose.max-past-days` | Legfeljebb hány napja lévő nap zárható le utólag | 7 |
| `mezo.dayclose.max-range-days` | A Napló listája legfeljebb ennyi napot kér egyszerre | 92 |
| `mezo.dayclose.line-max-chars` | Boop mondata legfeljebb ennyi karakter | 300 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `day_close` | Naponta egy zárás: esti energia, értékelés 1–5, a cél és eredménye, Boop céljai a záráskor, a napló hivatkozása, Boop mondata |
| `day_close_line_cache` | Boop egysoros mondatai, amelyeknek nincs zárási soruk (például egy kitöltés utáni mondat) |
| `daily_intention` | A nap értékelése a régi helyen (sikerült / részben / nem) |
| `ritual_day` | A régi esti rituálé „lezárva” jelzése |
| `check_in` | A 20:00-s esti kitöltés energiával és értékeléssel |

## Mi jön még
- A régi esti helyek kivezetése — későbbi takarítás.
- A zárásokból Boop következtetéseket von le — B8.

## Mi marad ki
A webes app hatlépéses napzárása — nem jön át; a webes app maga továbbra is működik.
