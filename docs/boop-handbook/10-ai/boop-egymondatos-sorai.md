---
cim: Boop egymondatos sorai
szint: Kis funkció
terulet: AI és memória
allapot: Ellenőrzés
hol: [Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B3]
osszefoglalo: Kitöltés után és az esti záráskor Boop egyetlen mondattal reagál, ami a napodra hivatkozik.
---

## Mit csinál
- **Kitöltés után:** „Mentve”, a görbe, és Boop egy mondata arról, amit most látott.
- **Esti zárás után:** Boop egy mondata a napról (például: „Ma a kitűzött edzés megvolt, és a délutáni mélypontot is
  kibírtad sétával.” — például).
- Net nélkül egy nyugodt helyettesítő sor áll ott, a valódi mondat később érkezik.

## Hogyan működik
- Egy **olcsó modellű** AI-hívás írja, magyarul, egy mondatban, a nap adatára hivatkozva.
- A mondat a bemenet lenyomatával tárolódik: ugyanarra a bemenetre nem hív újra AI-t.
- Ha az AI nem elérhető, a telefon később újrapróbálja.
- Az esti mondat a napzárás rekordjába is beíródik.

## Miért így
A visszajelzés megéri a naplózást — de egy mondat, nem esszé. A gyorsítótár miatt olcsó.

## Beállítások
Nincs önálló, a tulajdonosnak érdekes beállítás.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `day_close` | Napi egy esti zárás: értékelés, cél teljesülése, Boop mondata, a beszélt napló hivatkozása |
| `day_close_line_cache` | A legenerált mondatok, bemenet szerint, hogy ne kelljen újra kérni |

## Mi jön még
Nincs külön tervezve.

## Mi marad ki
Hosszabb esti értékelés — a webes napzárás hatlépéses folyamata nem jön át.
