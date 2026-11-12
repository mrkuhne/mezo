---
cim: Étkezés értékelése
szint: Funkció
terulet: Étel
allapot: Tervezve
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Minden étkezés pontszámot kap a mai célodhoz mérve, Boop pedig egy rövid, emberi mondatban elmondja, mi volt jó és min lehetne javítani.
---

## Mit csinál
Mentés után minden étkezés kap:

- egy **pontszámot** (0–100), nyolc szempont alapján, a **mai, súlycélból számolt keretedhez** mérve;
- egy **rövid szöveges értékelést** Boop hangján: egy jelmondat, egy összefoglaló, legfeljebb három javítási ötlet;
- 0–2 **vércukor-tippet** („legközelebb laposabb lesz, ha…”), és egy vércukor-sávot (alacsony / közepes / magas).

A webes appban ez egy részletes, szempontonkénti fa. A Boopban egyszerűbb lesz: pontszám, jelmondat és egy javítási sor,
a részletek egy koppintásra.

## Hogyan működik
1. **A szám szabályokból jön, nem AI-ból.** A háttérrendszer nyolc szempontot pontoz, súlyozva:
   makróarány a célhoz képest, feldolgozottság (NOVA-osztály), WHO-ajánlások (cukor, só), zsírminőség, rost,
   növényi változatosság, energiasűrűség és a „napi helyzet” (mennyi fér még bele a napba a hátralévő étkezésekre osztva).
2. **Edzés-tudatos:** ha az étkezés edzés előtt (2 órán belül) vagy után (1,5 órán belül) volt, más mérce érvényes —
   edzés előtt a gyors szénhidrát üzemanyag, nem hiba.
3. **Őszinte hiányok:** ha egy szemponthoz nincs adat, az „Nincs adat” lesz, kiesik a súlyozásból, és nem ad kitalált
   100 pontot. Kalória nélkül nincs pontszám.
4. **Utána az AI szöveget ír.** Mentés után, a háttérben, egy olcsó modell megkapja a pontszámot és a hátteret (tested,
   aktív célod, alvás, aznapi check-inek, a nap állása az étkezés időpontjában), és megírja a magyar, tegeződő értékelést.
   A számokon nem változtathat. Ha az AI hibázik, nem mentődik semmi, és a következő megnyitáskor újrapróbálja.

## Miért így
- A szám legyen mindig ugyanaz és ellenőrizhető; az AI csak magyaráz (ez a Mezo egyik alapszabálya).
- A pontszám már ma is a súlycélhoz mér, és figyel a kímélő módra és az edzés körüli étkezésekre — ezt a Boop változtatás
  nélkül átveszi.
- A tulajdonos egyszerűbb ítéletet szeretne a részletes fa helyett, ezért a Boop rövidebb formát kap (kutatás 02 §6).

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.fuel.scoring.weights.*` | A nyolc szempont súlya (makró 0,22; NOVA 0,18; WHO 0,14; napi helyzet 0,12; rost 0,10; zsírminőség 0,10; változatosság 0,08; energiasűrűség 0,06) | lásd zárójelben |
| `mezo.fuel.scoring.nova.group1–4` | Pontszám feldolgozottsági osztályonként (feldolgozatlantól az ultrafeldolgozottig) | 1,0 / 0,85 / 0,55 / 0,20 |
| `mezo.fuel.scoring.who.sugar-energy-share-limit` | Hozzáadott cukor felső határa az energiából | 10% |
| `mezo.fuel.scoring.who.salt-limit-g` | Napi sókeret (az étkezés arányában) | 5 g |
| `mezo.fuel.scoring.micro.fiber-g` | Napi rostcél a pontozáshoz | 38 g |
| `mezo.fuel.scoring.plant-diversity.target-categories` | Hány különböző növényi csoport ad teljes pontot | 3 |
| `mezo.fuel.scoring.pre-lead-min` / `post-trail-min` | Edzés előtti / utáni ablak, amelyben más mérce érvényes | 120 / 90 perc |
| `mezo.fuel.scoring.roles.pre/post.*` | Edzés előtti / utáni lazább cukor- és feldolgozottsági mérce | lásd konfiguráció |
| `mezo.feature.meal-coach.enabled` | Be/ki kapcsolja az AI szöveges értékelést (a pontszám marad) | be |
| `mezo.feature.meal-coach.eager` | Mentés után azonnal írja meg az értékelést (ki: első megnyitáskor) | be |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meal` | Az étkezés pontszáma és szempontonkénti bontása, valamint az AI értékelés szövege |

## Mi jön még
- B4: tömör „étkezés + ítélet” forma a Boopnak (pontszám, jelmondat, egy javítás).
- B4: allergének és érzékenységek az értékelésben — lásd [Allergének és érzékenységek](07-allergenek.md).
- B6: a Terv szabályai (például engedélyezett receptek) is bekerülnek az értékelés hátterébe.

## Mi marad ki
A webes, szempontonként kibontott részletes nézet nem kerül át egy az egyben; a Boop egyszerűbb formát mutat.
