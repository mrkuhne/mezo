# Fotók forrása — a Boop szimulátoros mintákhoz

A képek a `docs/design_2.0/prototypes/kepes/foto/` könyvtárból származnak, amely azóta törlődött a fáról;
ez a fájl a `9d70189f9` commit `CREDITS.md`-jéből állítja vissza a forrásokat azokra a képekre, amelyeket a
minták ténylegesen használnak. 960×720 és 480×480 vágás, tömörítve.

> **A szabály (Képek-irányelv §3.2):** az appba **csak CC0 / közkincs** kép kerülhet. A CC BY és CC BY-SA
> képeknél a szerző nevét meg kellene jeleníteni a felületen — ezt elkerüljük. Az alábbi tábla utolsó
> oszlopa mondja meg, melyik mehet be az appba.

## Hangulatképek (oldal- és szobafejek)

| Fájl | Eredeti | Licenc | Appba mehet |
|---|---|---|---|
| `aura-hegy.jpg` | Wikimedia Commons (Unsplash) | CC0 | igen |
| `aura-to.jpg`, `taj.jpg`, `taj-sq.jpg` | https://commons.wikimedia.org/wiki/File:Hiker_standing_on_a_log_at_the_Alouette_Lake_near_Maple_Ridge,_British_Columbia | CC0 | igen, de **alak van rajta** — fejnek nem jó (az orb a fejére esik) |
| `aura-erdo.jpg` | Wikimedia Commons (Unsplash) | CC0 | igen, de alak van rajta |
| `kod.jpg` | https://commons.wikimedia.org/wiki/File:Foggy_glass_unsplash_1.jpg | CC0 | igen (kímélő mód) |
| `konyha.jpg`, `deszka.jpg` | Pasta Sauce Ingredients / Onion and a group of vegetables on a cutting board | CC0 | igen (Fuel) |

## Edzés

| Fájl | Eredeti | Licenc | Appba mehet |
|---|---|---|---|
| `edz-sulyzo.jpg` | https://commons.wikimedia.org/wiki/File:Pair_of_8kg_dumbbells_(Unsplash).jpg | CC0 | **igen** |
| `edz-oltozo.jpg` | https://commons.wikimedia.org/wiki/File:The_box_room_at_the_gym_Repeat_Fitness.jpg | CC0 · Jan Laugesen | **igen** |
| `edz-sulyzotarto.jpg` | https://commons.wikimedia.org/wiki/File:Strength_training_(Unsplash).jpg | CC0 | igen, de arc/alak van rajta |
| `edz-huzodzkodas.jpg` | https://commons.wikimedia.org/wiki/File:Scott_Webb_2015-06-18_(Unsplash_KblIFRq1jkg).jpg | CC0 | igen, de alak van rajta |
| `edz-korlat.jpg` | https://commons.wikimedia.org/wiki/File:Dubai_workout_(Unsplash).jpg | CC0 | igen, de alak van rajta |
| `edz-nyujtas.jpg` | https://commons.wikimedia.org/wiki/File:Stretching_before_a_run_(Unsplash).jpg | CC0 | igen, de alak van rajta |
| `edz-ropi-terem-sq.jpg` | https://commons.wikimedia.org/wiki/File:Beach_volleyball_ball.jpg | közkincs | igen |
| `edz-izom-sq.jpg` | https://commons.wikimedia.org/wiki/File:Fit_man_(Unsplash).jpg | CC0 · Cristian Baron | igen, de torzó — a Képek-irányelv „no gym-poster energy" szabálya tiltja |
| `edz-tarcsa.jpg` | https://commons.wikimedia.org/wiki/File:Bench_Press.jpg | **CC BY-SA 4.0** · Aditya Oberai | **nem** |
| `edz-felhuzas.jpg` | https://commons.wikimedia.org/wiki/File:Fit_young_man_doing_deadlift_exercise_in_gym.jpg | **CC BY 2.0** · Nenad Stojkovic | **nem** |
| `edz-crossfit.jpg` | https://commons.wikimedia.org/wiki/File:Kathy_Nguyen_performing_a_deadlift.jpg | **CC BY-SA 2.0** · Mark Sebastian | **nem** |
| `edz-kettlebell.jpg` | https://commons.wikimedia.org/wiki/File:Pair_of_kettlebells_on_a_shelf,_Results_Gym.jpg | **CC BY-SA 4.0** · Ser Amantio di Nicolao | **nem** |

## Gyakorlatképek (`gyak-*.jpg`)

A webes app `frontend/public/exercises` könyvtárából származó oktatóképek. A Képek-irányelv §3.2 szerint
**kizárólag egy gyakorlaton belül** használhatók, fejként soha.

## Amit a B5 Edzés minta használ

Fej: `aura-hegy.jpg` · kártyák: `edz-sulyzo.jpg`, `edz-oltozo.jpg`, `edz-ropi-terem-sq.jpg` ·
gyakorlatok: `gyak-*.jpg`. Mind CC0 vagy közkincs, és egyiken sincs arc.

## Nyitott pont

A Mozgás világ hangulatképe a Képek-irányelv szerint „tó / ösvény" volna, de a könyvtár mindkét ilyen
képén ember van, és az orb pont a fejére esik. A minta addig a `aura-hegy.jpg` hegygerincet használja.
Saját Edzés-hangulatkép beszerzése: `mezo-r36n9.44`.
