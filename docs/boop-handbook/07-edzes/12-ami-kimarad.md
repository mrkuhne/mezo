---
cim: Ami kimarad az Edzés szobából
szint: Kis funkció
terulet: Edzés
allapot: Kihagyva
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Az XP, a szintlépés-ceremónia, az érmek és az „életkészség” napló nem kerül a Boopba.
---

## Mit csinál
Ezek **nem** lesznek a Boopban (spec §3.1 „Nem kerül át”, §6):

| Mi | Miért marad ki |
|---|---|
| **XP és szintlépés-ceremónia** edzés után | Játékosítás; a Boopban nincs se játékosítás, se haladás-gyűrű. |
| **Érmek** (díszítő jutalmak sorozatokért, edzésekért) | Ugyanez; a valódi rekordok megmaradnak. |
| **„Életkészség” napló** (szabad szöveges tevékenységek XP-re váltva) | Szinte használatlan, és a neve ellenére nem testmozgás. |

## Hogyan működik
A háttérrendszer továbbra is számolja ezeket a webes appnak (például edzés végén XP-t ad), de a Boop nem kéri le és nem mutatja.
Kitépni őket külön, kockázatos munka lenne, mert sok helyről hívják őket — ezért elrejtjük, nem töröljük.

## Miért így
Tulajdonosi irány: tiszta, célzott edző, játékelemek nélkül. A webes használat is ezt mutatta: a játékosítás-oldalakat szinte
senki nem nyitotta meg (kutatás 10).

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.progression.enabled` | A játékosított XP/szint motor (a Boop nem használja) | be |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `skill_progress`, `level_up_event` | XP és szintlépések (Boop nem használja) |
| `activity_log` | Életkészség-bejegyzések (Boop nem használja) |

## Mi jön még
Nincs.

## Mi marad ki
Lásd fent.
