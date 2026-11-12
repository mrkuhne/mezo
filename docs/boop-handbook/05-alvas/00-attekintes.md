---
cim: Alvás
szint: Fő szekció
terulet: Alvás
allapot: Élesben
hol: [iPhone app, Háttérrendszer, Apple Health]
szulo:
szakasz: [S2, S3, B1, B2]
osszefoglalo: A Boop az Apple Egészségből olvassa ki az éjszakáidat, és egy saját alvás-szobában mutatja meg, hogyan aludtál és mikor érdemes lefeküdnöd.
---

## Mit csinál
Az alvás a Boop egyik „szobája”. Reggel a Ma oldal tetején álló öt kis gömb egyike az **Alvás**; ha rákoppintasz,
megnyílik az alvás-szoba: mennyit aludtál, mikor aludtál el, mennyi volt a mélyalvás, hogyan néztek ki az alvási
szakaszok (hipnogram), és hogyan alakult a mélyalvás az elmúlt héten. Az Alvás gömb gombjával esti
lefekvési emlékeztetőt kérhetsz.

Te nem írsz be semmit: az éjszakák maguktól jönnek az Apple Egészségből (oda pedig például a Sleep Cycle vagy
később egy óra / gyűrű írja be őket).

## Hogyan működik
1. A telefon az Apple Egészségből kiolvassa az alvásmintákat, és éjszakákká rakja össze őket (lásd *Éjszakák az Apple Egészségből*).
2. Az éjszakákat elküldi a háttérrendszernek; ott **egy dátumra egy éjszaka** él (lásd *Egy dátum, egy éjszaka*).
3. A reggeli összefoglaló ebből számolja az Alvás pontszámot, és ez a legnagyobb súllyal megy bele a Forma pontszámba.
4. A Ma oldal és az alvás-szoba ebből rajzol.

## Miért így
- A tulajdonos döntése (2026-11-11): a Boop egy kezdőlap + szobák felépítésű, nem öt külön fül — ezért az alvás egy szoba, nem egy külön alkalmazásrész.
- Az alvást nem kézzel naplózzuk, mert az Apple Egészség már tartalmazza; a kézi beírás felejtős és pontatlan.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.boop.nights-needed` | Hány rögzített éjszaka kell, mielőtt a Forma pontszám megjelenik | 14 |
| `mezo.feature.sleep-goal.enabled` | Az alváscél (célidő + ébredési/lefekvési horgony) funkció be/ki | be |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `sleep_log` | Egy sor egy éjszakáról (dátum = az ébredés reggele): lefekvés, ébredés, alvásidő, szakaszok, hipnogram, forrás |
| `sleep_goal` | Az alváscél: hány órát szeretnél aludni és mihez igazodik (ébredés vagy lefekvés) |

## Mi jön még
- **B3 (Ellenőrzés alatt):** a check-in mellé eltesszük, mennyit aludtál előző éjjel (pillanatkép).
- **B7:** a napi „kapacitás” számításában az alvás és az alvásadósság is szerepel majd.
- **B8:** az AI rövid/közép/hosszú távú következtetései az alvásról a Napló · Minták részben.

## Mi marad ki
- Kézi alvásnapló és Sleep Cycle képernyőkép-beolvasás a Boopban nincs — ezek a webes appban maradtak.
- A webes app részletes alvás-statisztikái (rendszeresség, alváshatékonyság, figyelmeztető kártya) még nincsenek átvéve; egyik szakasz sem vállalta még.
- A Sleep Cycle saját „minőség %”-a nem jut át az Apple Egészségen, ezért nem látjuk.
