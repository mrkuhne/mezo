---
cim: Éjszakai konzílium és napi tanács
szint: Funkció
terulet: AI és memória
allapot: Részben kész
hol: [Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B0, B8]
osszefoglalo: A háttérben szakterületi „szakértők” éjjel átnézik az adataidat és egyeztetnek egymással — ma ez Boopban még nem látszik, B8-ban kicsi, napra szabott formában tér vissza.
---

## Mit csinál
A webes appból örökölt rendszer: hét szakterületi szakértő (például orvosi, edzői, táplálkozási, alvás, lelki), egy
**Szkeptikus** és egy levezető elnök. Céljuk egy „ki vagy te” dosszié építése: állítások rólad, bizonyossággal, előzménnyel.
Boopban **ma semmi nem jelenik meg belőle közvetlenül** — a csapatfal és a szakértői oldalak rejtve maradnak.

## Hogyan működik
1. **Éjjeli megfigyelés (02:50):** 47 szabály alapú érzékelő kiszámolja a jeleket, minden szakértő egy rövid AI-hívással
   megfigyelést ír a saját területéről.
2. **Napi tanács (21:00-tól, 15 percenként újrapróbálva):** a szakértők javaslatot tesznek, mások támogatják vagy vitatják
   (legfeljebb 3 kör), a Szkeptikus csak bizonyíték alapján megtartja, gyengíti vagy elveti, az elnök dönt.
3. **Heti konzílium (vasárnap 19:30)** ugyanígy, a lezárt hétre.
4. Egy körben korlátozott számú AI-hívás és adatlekérés engedélyezett, naponta is van plafon.

**B0 javítás (2026-11-11):** az éjjeli megfigyelés szeptember 23. óta szinte minden éjjel elbukott egy törölt, de
árván maradt beszélgetés miatt — ez javítva, 2026-11-11 éjjel már sikeres volt. A Szkeptikus gyakran „kifogyott a keretből”,
mert az adatlekéréseket is AI-hívásnak számolták; ezt szétválasztották, a kör kerete 14-ről 20-ra nőtt.
**Ami még nem jó (2026-11-12-i ellenőrzés):** a fő fiók esti napi tanácsa továbbra is elbukik, mert a Szkeptikus az
adatlekérési keretbe ütközik. Ezért *Részben kész*.

## Miért így
A kutatás szerint a rendszer gazdag, de túlépített, drága, és nem a „mit tegyek ma?” kérdésre válaszol. A döntés: Boopban
egy hang (Döntések naplója #5); a gépezet adatoldala újrahasznosítható a B8 kis, napra szabott tanácsához.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.character.observation.cron` | Az éjjeli megfigyelés ideje | minden nap 02:50 |
| `mezo.character.council.ready-at` | A napi tanács legkorábbi indulása | 21:00 |
| `mezo.character.council.max-attempts` | Hányszor próbálja újra a napi tanácsot | 3 |
| `mezo.character.council-budget.cycle-calls` | AI-hívások egy tanácskörben (B0-ban emelve) | 20 |
| `mezo.character.council-budget.total-daily-calls` | Napi összes AI-hívás plafonja | 120 |
| `mezo.character.council-debate.max-tool-calls` | Adatlekérések egy körben | 8 |
| `mezo.character.conference.cron` | A heti konzílium ideje | vasárnap 19:30 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `character_observation` | A szakértők éjjeli megfigyelései |
| `character_claim` / `character_claim_revision` | Állítások rólad és azok változásai (visszavonhatóan) |
| `character_conference` | Napi/heti/havi konzíliumok menete és eredménye |
| `character_council_edition` | Napi tanács futása naponta (állapot, próbálkozások) |
| `character_council_quota` | A kör- és napi AI-keret felhasználása |
| `character_run` | Minden futás eredménye (siker/hiba) |

## Mi jön még
**B8:** kicsi, napra szabott tanács, ami a javaslatok „miért?” sorait adja; a konzílium lekarcsúsítva arra, amit Boop mutat.

## Mi marad ki
A webes csapatfal, esti kiadás, csapat-chat, szakértői oldalak és az érzékelők átláthatósági felülete — Boopban kihagyva.
