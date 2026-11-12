---
cim: Napközben — az idővonal
szint: Funkció
terulet: Ma
allapot: Élesben
hol: [iPhone app, Háttérrendszer, Naptár]
szulo: 00-attekintes
szakasz: [S3, B2, B3]
osszefoglalo: Az egész nap egyetlen csendes ösvényen, időrendben — a „MOST” pontnál Boop javaslataival, a B3 óta az energiagörbével a tetején.
---

## Mit csinál
A Napközben részben a nap állomásai sorakoznak egy ösvényen, óra szerint: a check-inek, az étkezések, az edzés, a
naptár blokkjai, a légzés a legsűrűbb megbeszélés előtt, a lefekvés. A „MOST” jelölés mutatja, hol tartasz; Boop
javaslatai itt, beágyazva jelennek meg (nem egy külön listában).

A B3 óta *(ellenőrzés alatt)*:
- a rész tetején **„AZ ENERGIÁD MA · n / 3 kitöltés”** kártya — lásd *Energiagörbe a pöttyeiddel* (Napló szekció);
- a kitöltött check-in sorok a rögzítés idejét és az első három választ mutatják (például „Energia 7 · hangulat 8 ·
  feszültség 3”), és a görbén kijelölik a pöttyüket;
- az aktuális napszak üres során **„Kitöltöm”** áll; egy elmulasztott korábbi soron nem.

Itt jelennek meg a **„Boop észrevette”** kártyák is (lásd külön oldal).

## Hogyan működik
Az állomások a reggeli összefoglalóból és a telefon saját tudásából (például egy még el nem küldött check-in)
állnak össze. Egy elemre koppintva a hozzá tartozó szoba nyílik.

## Miért így
A spec szerint a nap egy idővonal a felkelő gömb alatt. A javaslatok a „most”-hoz tartoznak, ezért nem egy
gyűjtőlistában, hanem az idővonalon vannak.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `boop_brief` | Az idővonal adatai (étkezések, edzés, naptár 15 perces sávokban) |
| `calendar_event` | A naptár eseményei |
| `check_in` | A napi kitöltések |

## Mi jön még
Élő újratervezés: ha történik valami (kitöltés, étkezés, edzés vége), Boop új javaslatot tehet — B7.

## Mi marad ki
Naptárba írás — a naptár csak olvasható.
