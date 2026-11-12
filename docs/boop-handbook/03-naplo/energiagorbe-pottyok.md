---
cim: Energiagörbe a pöttyeiddel
szint: Funkció
terulet: Napló
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S3, B3]
osszefoglalo: A nap energiagörbéjén Boop jóslata mellett ott vannak a saját kitöltéseid pöttyei — így látod, hogyan változik az energiád napközben.
---

## Mit csinál
Az **„AZ ENERGIÁD MA · 2 / 3 kitöltés”** (például) kártya a Ma oldal Napközben részének tetején, a kitöltés után és
a Napló napjaiban:

- 06–24 óra; Boop **szaggatott jóslata** halvány kitöltéssel;
- a **te vonalad** fehér, számozott pöttyökkel — minden pötty egy kitöltés energiája;
- egy „most” vonal, óraosztás, jelmagyarázat;
- egy pöttyre koppintva megnyílik az a kitöltés: a válaszok és az órád mérései.

Net nélkül a még el nem küldött pötty körül szaggatott gyűrű van.

## Hogyan működik
A jóslat a reggeli összefoglaló meglévő energiagörbéje (nincs új modell). A pöttyök a telefon saját napi
nyilvántartásából jönnek, így a görbe sosem vár a netre. Az esti zárás energiája is rákerül.

## Miért így
A tulajdonos szavai (B3 spec, D2): azért naplóz, **„hogy lássam, hogyan változik az energiám a nap során”**. A görbe
a jutalom a kitöltésért.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | A jósolt görbe |
| `check_in` | A pöttyök (energia + rögzítés ideje) |
| `check_in_snapshot` | A pöttyök mögötti órás mérések |

## Mi jön még
A jóslat a nap terhelését (naptár, edzés) is figyelembe veszi, és a pöttyeidből tanul — B7.

## Mi marad ki
Nincs.
