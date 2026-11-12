---
cim: Riasztások az AI-ról
szint: Kis funkció
terulet: AI és memória
allapot: Élesben
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: [B0]
osszefoglalo: Az admin oldal állapotsávja B0 óta jelez, ha az emlékezet nem tud új emléket felvenni vagy elmaradnak a feldolgozások.
---

## Mit csinál
A webes admin oldal tetején egy állapotsáv magyar nyelvű figyelmeztetéseket mutat. Az AI-hoz tartozók:
- **Költség-ugrás** — a napi költség szokatlanul megugrott.
- **AI-hibák** — sok AI-hívás hibázik.
- **„Nem működik az emlékek beágyazása”** (B0-ban új) — az elmúlt 24 órában legalább 3 beágyazási hívásból több mint a fele
  hibázott; megmondja az utolsó hibakódot is.
- **„Hiányzó emlékek”** (B0-ban bővítve) — van olyan korábbi bejegyzés, ami még nincs az emlékezetben.
- **Elmaradt feladat** — egy éjjeli munka 26 órája nem futott le.

## Hogyan működik
- A szabályok az AI-naplóból és az emlékezet tábláiból számolnak, megnyitáskor.
- A beágyazási riasztás mindig a beállított modellt figyeli, így szolgáltatóváltás után nem marad pirosan a régi miatt.

## Miért így
A beágyazás három hétig hibázott, és **semmi nem jelzett**: a régi szabály csak a „hibásnak jelölt” emlékeket számolta,
de a hiba még azelőtt történt, hogy emlék-sor keletkezett volna. A B0 ezt a vakfoltot zárta be.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.admin.alerts.llm-error-rate-pct` | Hány százalék hiba felett riaszt | 20% |
| `mezo.admin.alerts.llm-error-min-calls` | Legalább ennyi hívás kell a riasztáshoz | 5 |
| `mezo.admin.alerts.cost-spike-factor` | Hányszoros költség-ugrás riaszt | 2× |
| `mezo.admin.alerts.job-missed-after-hours` | Ennyi óra után elmaradt egy éjjeli munka | 26 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `llm_log_history` | Ebből számolja a hibákat és a beágyazási hívásokat |
| `memory_item` / `memory_vector` | Ebből számolja a hiányzó vagy hibás emlékeket |

## Mi jön még
Nincs tervezve. (Értesítés telefonra a riasztásról nincs.)

## Mi marad ki
Riasztás Boopban — ez üzemeltetői jelzés, a webes admin oldalon marad.
