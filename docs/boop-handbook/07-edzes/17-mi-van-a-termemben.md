---
cim: Mi van a termemben
szint: Kis funkció
terulet: Edzés
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 03-edzeslejatszo
szakasz: [B5]
osszefoglalo: Kilenc kapcsolóval megmondod, milyen eszköz hiányzik a termedből, és külön azt is, melyik gyakorlatot nem tudod megcsinálni — a gyakorlatcsere ehhez igazodik.
---

## Mit csinál
A „Mi van a termemben” oldalon egy rövid bevezető alatt **kilenc kapcsoló** áll — egy-egy eszközfajta (például rúd, gép, kábel,
kéziszer…). Amit kikapcsolsz, az nincs a termedben, ezért a gyakorlatcsere nem ajánl olyan gyakorlatot, ami azt igényli.
Alatta az **„Ami konkrétan hiányzik”** lista: azok a gyakorlatok, amelyeket külön jelöltél meg, hogy nem tudod megcsinálni
(például egy bizonyos gép). Mindegyik mellett ott a **„mégis van”** gomb, amivel visszavonod.

Az oldal két helyről nyílik: az **Edzés szoba „Beállítások”** gombjáról, és az edzés közbeni **csere lap „Mi van a
termemben ›”** soráról (ilyenkor a csere lap helyére lép).

## Hogyan működik
1. Az oldal megnyitáskor elkéri a szerverről a termed beállításait. Ha nem éri el, **nem mutat kapcsolókat** (különben egy
   üres lapot mentenél rá a valódi helyére), hanem ezt írja: „Most nem érem el a termed beállításait · Újra”.
2. Minden kapcsoló **azonnal ment**. Ha a mentés nem sikerül, a kapcsoló visszaáll, és ez áll a lapon: „Nem sikerült
   elmenteni · Újra”.
3. Mentés előtt a telefon **újra beolvassa a szerver állapotát**, és arra rakja rá a változtatást — így egy másik
   eszközön vagy korábban tett módosítást soha nem ír felül.
4. A csere lapon az „ehhez nincs eszközöm” gomb is ide ír: hordozható eszköznél (például kéziszer) az egész fajtát kikapcsolja,
   gépnél csak azt az egy gyakorlatot jelöli meg, és ha több eszköz is szóba jön, megkérdezi, melyik hiányzik. Mindegyik
   visszavonható — a „mégis van” gombbal vagy a gomb újabb megnyomásával.
5. Ha egy megjelölt gyakorlatot később kivesznek a katalógusból, a neve „Törölt gyakorlat”, de a jelölést akkor is vissza lehet vonni.

## Miért így
A „nincs eszközöm” nem lehet általános szabály egyetlen gyakorlat miatt, és fordítva is: ha az egész kéziszer-készlet hiányzik,
nem akarjuk gyakorlatonként végigkattintani. Ezért kétféle jelölés van, és mind visszavonható. Az alapállapot az, hogy
**minden elérhető**, amíg nem mondod mást — így az ajánlás sosem szűkít a te tudtod nélkül. A kiszűrt gyakorlat a teljes listában
mindig megmarad, halk címkével, és választható.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `gym_profile.off_kinds` | Mely eszközfajták hiányoznak a teremből (a kilenc kapcsoló) | egyik sem hiányzik |
| `gym_profile.missing_exercise_ids` | Mely gyakorlatokat jelölted meg külön, hogy nem tudod megcsinálni | üres |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `gym_profile` | Felhasználónként egy sor: a hiányzó eszközfajták és a külön megjelölt gyakorlatok |

## Mi jön még
A „Miért pont ez a gyakorlat?” magyarázat a tervben, és a hiányzó kiegészítő mozgások jelzése — ezek a gyakorlatválasztás
következő szeleteiben jönnek.

## Mi marad ki
Edzőterem-sablonok (például „otthoni” és „terem” közti váltás egy mozdulattal) — egyelőre egy termed van.
