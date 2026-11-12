---
cim: A reggeli összefoglaló szövege
szint: Funkció
terulet: AI és memória
allapot: Élesben
hol: [Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [S3, B3]
osszefoglalo: A reggeli számokat a háttérrendszer számolja, az AI csak Boop hangján megfogalmazza őket — ha késik, szabály alapú szöveg áll be.
---

## Mit csinál
A Ma oldal reggeli részének minden mondata — a gömbök címe és mondata, a felolvasható összefoglaló, az esti tipp és a
következő étkezés tippje — egy AI-hívásból születik, magyarul, Boop hangján. A képernyőt a **Ma › Reggeli ítélet és az
öt gömb** oldal írja le; ez az oldal az AI-részt.

## Hogyan működik
1. A telefon elküldi a saját napját (dátum).
2. A háttérrendszer **maga számolja** a pontszámokat (Forma, Alvás, Mozgás, Étel, Pulzus), az energiagörbét és az edzés–
   megbeszélés ütközést.
3. Egy **olcsó modellű** AI-hívás ezekből a számokból szöveget ír. A naptárból csak darabszám, időtartam és foglalt percek
   mennek — **eseménycímek soha**.
4. Ha az AI 8 másodpercen belül nem válaszol, vagy hibás a válasza, mezőnként a **szabály alapú szöveg** áll be — az
   összefoglaló sosem bukik el. A későn megérkező AI-szöveg utólag beíródik.
5. Az eredmény naponta egyszer tárolódik; amíg a bemenet (éjszaka, naptár, edzés, cél, napszak) nem változik, nem készül új,
   így nincs felesleges költség. Kézzel naponta legfeljebb 3-szor kérhető újra.
6. B3-ban (ellenőrzés alatt) a nap céljai is bekerülnek az AI elé.

## Miért így
„A kód számol, a modell fogalmaz”: a számok ellenőrizhetők és nem hallucináltak; az AI csak a hangot adja. A naptárcímek
magánszféra-ok miatt maradnak ki.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.boop.llm-timeout` | Meddig vár az AI szövegére, mielőtt a szabály alapú áll be | 8 másodperc |
| `mezo.boop.regen-per-day` | Napi kézi újragenerálások száma | 3 |
| `mezo.boop.nights-needed` | Hány éjszaka kell, mielőtt pontszámot mutat („még tanulom”) | 14 |
| `mezo.boop.steps-goal` | A lépéscél a Mozgás pontszámhoz | 9 000 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | Napi egy összefoglaló felhasználónként, a bemenet lenyomatával és azzal, hogy AI vagy szabály írta-e a szöveget |
| `llm_log_history` | Az AI-hívás naplója és költsége |

## Mi jön még
- **B6:** a Terv szabályai is bekerülnek.
- **B8:** emlékezetből vett háttér (ma a reggeli összefoglaló nem használ emlékezetet).

## Mi marad ki
A pontszámok AI-val való kiszámolása — szándékosan nem.
