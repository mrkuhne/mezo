---
cim: A Boop fül - beszélgetés a mai napról
szint: Funkció
terulet: Boop
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B2, B3]
osszefoglalo: A Boop fülön bármit kérdezhetsz Booptól a mai napodról, és nem kell elmagyaráznod, mi történt — már tudja.
---

## Mit csinál
A Boop fül tetején a festett ég és a gömb, alatta: „Kérdezz bármit a mai napodról — tudom, mi történt.” Aztán:
1. **„Boop látja · most”** — kis tény-csíkok arról, amit Boop most lát (alvás, HRV, mai edzés, kitöltések, evés, a nap célja,
   hátralévő naptár).
2. **„Ma kérdezheted”** — legfeljebb három kész kérdés a mai naphoz.
3. **A beszélgetés** — a te kérdéseid jobbra, Boop válaszai balra, a gömbbel.
4. **Írómező** üveg-kapszulában, mikrofonnal.

Például ilyen kérdésekre számít: „Miért vagyok fáradtabb, mint tegnap?”, „Mire figyeljek ma az edzésen?”, „Mennyit egyek
edzés előtt?”. A válasz megnevezi, melyik adatból dolgozik (például: „a HRV-d ma 38, a szokásos 45 alatt”).

## Hogyan működik
- **Egy beszélgetés naponta:** az első kérdésnél jön létre a mai Boop-beszélgetés, a dátummal elnevezve; másnap új indul.
  A fül csak a mait mutatja.
- A telefon a meglévő beszélgető-szolgáltatást hívja (egyelőre egyben kapja meg a választ, nem szavanként csorogva).
- A háttérrendszer minden kérdéshez hozzáteszi a **mai nap tömör blokkját** (lásd: Mit tud a beszélgetés), és a korábbi
  napok beszélgetéseit nem keveri bele, hogy régi tények ne zavarjanak.
- Egy gondolkodó lépés eldönti, kell-e még adatot elővenni (edzésnapló, súly, étkezés, emlékek…), utána a válasz Boop
  hangján, magyarul készül.
- B2-ben a fül még csak becsületes „hamarosan” keret volt; a valódi chat a B3-mal jön.

## Miért így
- B3 tervezés, D8 döntés: a tulajdonos ne adjon kontextust újra meg újra.
- **Napi egy beszélgetés** (tervezői döntés, a tulajdonos ellenőrzésére jelölve): a mai blokk mindig a mai, nem keveredik
  tegnapi állapottal.
- A szavanként csorgó válasz külön kockázat a telefonon, ezért B3 az egyben érkező választ használja.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.companion.conversation.enabled` | Az „először gondolkodik, aztán válaszol” beszélgetési mód be/ki | be |
| `mezo.companion.conversation.max-read-rounds` | Hány körben kérhet elő adatot egy válasz előtt | 5 |
| `mezo.companion.tools.max-calls-per-turn` | Egy kérdésre legfeljebb hány adatlekérés fut | 15 |
| `mezo.companion.conversation.history-messages` | Hány korábbi üzenetet lát (webes csatornán; Boop csatornán csak a mait) | 80 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `ai_conversation` | Beszélgetések; B3-tól új jelölés: webes vagy Boop-csatorna |
| `ai_message` | Kérdések és válaszok, a válaszhoz használt adatok nyomával |

## Mi jön még
- Szavanként csorgó válasz (később).
- **B8:** a chat a Tervet és a teljes emlékezetet is látja.

## Mi marad ki
Régebbi napok beszélgetéseinek listája a fülön (B3-ban nem), a webes chat beszélgetés-kezelő, átnevező, visszajelző gombjai.
