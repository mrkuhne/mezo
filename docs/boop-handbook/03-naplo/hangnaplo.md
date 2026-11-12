---
cim: Hangnapló
szint: Funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: Este egy koppintással elmondod, milyen volt a napod, és a Boop leírja — vagy egyszerűen begépeled.
---

## Mit csinál
Az esti zárás 4. lépése, **„Mesélj”**: egy koppintás indítja, egy leállítja; „Leírom…” után megjelenik a leirat.
Alatta **„Vagy írd be…”** mező a gépeléshez. Ugyanez a hang-vagy-írás sor jelenik meg minden kitöltés után is
(„Mondj hozzá egy mondatot”, nem kötelező).

## Hogyan működik
1. A felvétel a telefonon marad, a kimenő sorban.
2. Ha a telefon tud magyarul a gépen belül leírni, ott történik (net nélkül is). Ha nem, netkor a felvétel a
   háttérrendszer leíró szolgáltatásához megy, és a leirat lesz a naplóbejegyzés.
3. A sikeres leirat után a hangfájl törlődik; máshová nem kerül.
4. Az esti szöveg a naplóba kerül (a zárás napjára, „boop” forrással); a kitöltés utáni mondat a kitöltés megjegyzése lesz.

## Miért így
A tulajdonos döntése (B3 spec, D7): a napló **este, hanggal**. A begépelés a minta kipróbálása után került mellé
(2026-11-12). Augusztus–októberben a kitöltések többségéhez írt megjegyzést — ezért a kitöltés utáni mondat is megmaradt.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| Mikrofon-engedély | „A Boop a hangodat csak arra használja, hogy leírja, amit mondasz.” | első használatkor kéri |
| Beszédfelismerés-engedély | „A Boop a telefonon írja le, amit mondasz…” | első használatkor kéri |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `journal_entry` | A naplóbejegyzések: nap, szöveg, forrás (`boop`), saját azonosító a duplikáció ellen |

## Mi jön még
A naplóból Boop emlékezete és következtetései — B8.

## Mi marad ki
A hangfelvétel megőrzése — szándékosan törlődik a leirat után.
