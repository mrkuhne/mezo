---
cim: Költségkeret és AI-napló
szint: Funkció
terulet: AI és memória
allapot: Élesben
hol: [Háttérrendszer]
szulo: 00-attekintes
szakasz: [S3, B0]
osszefoglalo: Minden AI-hívás naplózva van költséggel együtt, és egy felhasználónkénti 30 napos keret lépcsőzetesen fékez, mielőtt elszaladna a kiadás.
---

## Mit csinál
- **Napló:** minden AI-hívásról feljegyzés készül — melyik funkció, melyik modell, mennyi ideig tartott, hány token, mennyibe
  került, sikerült-e.
- **Keret:** felhasználónként **30 dollár** a mindenkori elmúlt 30 napra.
  - **70%-nál** minden hívás az olcsó modellre vált.
  - **90%-nál** a drága, senki által nem várt háttérmunkák (például heti áttekintés, hipotézisek, előrejelzések, esti
    kiadás) szünetelnek.
  - **100%-nál** minden keretköteles hívás elutasítva, amíg az ablak tovább nem gördül.

## Hogyan működik
- A keretet a hívás **előtt** ellenőrzi, így a túllépés nem kerül pénzbe.
- Az ár a hívás pillanatában rögzül, a későbbi árváltozás nem írja át a múltat.
- A kérdés–válasz szövegek 90 nap után törlődnek, a költség és idő adatok megmaradnak.
- A Boop-funkcióknak saját kisebb fékjeik is vannak: a reggeli összefoglaló csak változáskor generál újra, a kézi újrakérés
  napi 3; a chat egy kérdésre legfeljebb 15 adatlekérést futtat.
- Nagyságrend (a kutatás idején): egy chat-kérdés kb. 3,5 cent és 12 másodperc (például).

## Miért így
A keret egyszerre költségvetés és vészfék egy elszabaduló ciklus ellen. 2026-09-16-án 5-ről 30 dollárra emelték, mert az
alacsony keret miatt a tulajdonos fiókja tartósan olcsó módban ragadt, és az okos háttérmunkák nem futottak.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.llm-log.budget.enabled` | A keret be/ki | be |
| `mezo.llm-log.budget.hard-cap-usd` | A keret összege | 30 dollár |
| `mezo.llm-log.budget.cycle-days` | Hány napra visszamenőleg számol | 30 |
| `mezo.llm-log.budget.degrade-at-percent` | Ettől olcsó modell mindenre | 70% |
| `mezo.llm-log.budget.throttle-cron-at-percent` | Ettől szünetelnek a drága háttérmunkák | 90% |
| `mezo.llm-log.budget.stop-at-percent` | Ettől minden elutasítva | 100% |
| `mezo.llm-log.budget.throttled-features` | Mely háttérmunkák szünetelnek 90%-nál | lista (például heti áttekintés, hipotézisek) |
| `mezo.llm-log.retention.payload-days` | Hány nap után törlődnek a szövegek | 90 |
| `mezo.llm-log.pricing.models` | Modellenkénti egységárak | táblázat |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `llm_log_history` | Minden AI-hívás: funkció, modell, idő, tokenek, költség, állapot; a szövegek 90 napig |

## Mi jön még
**B7:** az élő újratervezés AI-költségét ehhez a kerethez kell igazítani.

## Mi marad ki
Költség-kijelzés Boopban — a webes admin oldalon látható.
