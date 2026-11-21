---
cim: Évad
szint: Fő szekció
terulet: Terv
allapot: Részben kész
hol: [iPhone app, Háttérrendszer, Apple Health, AI]
szulo:
szakasz: [B2, Test, B6]
osszefoglalo: Az Évad néhány hetes terv, amiből minden más következik — a célod, az edzésed, az étkezésed és az alvásod együtt mozog, és minden változtatásnál élőben látod, mire hat.
---

## Mit csinál
Az Évad az alsó sáv második helye (Ma · **Évad** · Napló · Boop) — régen Terv volt a neve (döntés, 2026-11-20). Egy évad
néhány hétig tart (4–24 hét), és benne van a súlycélod, az edzésblokkod, a heti edzés- és sportnapjaid és az alvásigényed.
Ezekből számolja Boop, mennyit egyél edzésnapon és pihenőnapon, mennyit aludj, mikor feküdj le, és merre halad a súlyod.

**Ami ma élesben van (az évad első szakasza, 2026-11-20):**
- **Az Évad oldal** a fejjel (hányadik hétnél tartasz, jó úton vagy-e), a „Mi mire hat” térképpel, a súlygörbével, az évad
  tervével és a következő eseményekkel (könnyebb edzéshét, az évad vége) — lásd [Az Évad oldal](01-terv-keret.md).
- **Módosítás élő előnézettel:** ha átállítod, hány edzésed legyen, mely napokon sportolsz vagy milyen tempóban fogyj, Boop
  azonnal megmutatja, mi változna, és mit kell ehhez tenned. Amíg el nem fogadod, semmi sem változik — lásd
  [Az évad](06-terv-csomag.md).
- **Új évad** öt lépésben, a mostani célodból és edzésblokkodból előre kitöltve; és egy üres állapot, ha még nincs évadod.
- **Szabályok:** az évad kapcsolói (például csak kevéssé feldolgozott ételek, könnyebb edzéshéten ne fogyj).
- **Edzésblokk csak évaddal indulhat.** A már futó blokk fut tovább.
- A súlycél-motor számol mindent (lásd [Súlycél és célmotor](02-sulycel-celmotor.md)).

**A második szakasz óta (2026-11-21) élesben:**
- **„Hogy megy”** — az elmúlt hét tényei pontszám nélkül (például „4 / 5 napon belefértél a keretbe”); a kímélő napok
  egyáltalán nem számítanak bele, egy indokkal kihagyott edzés pedig csak az edzések közül marad ki.
- **„Amit Boop észrevett”** — legfeljebb három észrevétel, mindegyik csak akkor, ha már elég adat van mögötte.
- **Egy napi ítélet mindenhol:** azt, hogy egy nap belefért-e a keretbe, a háttérrendszer dönti el egy helyen — az Évad
  oldal, az Étel Hét füle és Boop ugyanazt mondja.
- **Boop ismeri az évad szabályait** a beszélgetésben, a reggeli összefoglalóban és az étkezések értékelésében, és ha
  kérdezed, elmondja, hogyan halad az évad.
- **Kártyák a Ma falán:** az égetés-javaslat és az évad vége — lásd [Az évad](06-terv-csomag.md).
- **Heti menü** (3. szakasz): vasárnap este a kiválasztott receptjeidből, az edzésnapjaidhoz igazítva — jóváhagyod, és
  ezek lesznek a napi terved ételei; lásd [Heti menü](09-heti-menu.md).
- **Bevásárlólista** (3. szakasz): a jóváhagyott menüből, polcok szerint, pipálható, megosztható; lásd
  [Bevásárlólista](07-bevasarlolista.md).

**Ami még jön:**
- **4. szakasz (élesben):** kísérletek — kipróbálsz valamit, és Boop megnézi, tényleg hat-e (lásd [Hatás — kísérletek](08-hataskovetes.md)).
- **Korábbi évadok** oldal és a mostani súlyod az Új évad első lépésében.

## Hogyan működik
A számok a háttérrendszer **súlycél-motorjából** jönnek: a célból, a testadataidból és a heti edzés- és sportnapjaidból
kiszámolja a napi kalória- és makrócélt. Az évad ezt a motort hívja meg — külön számolás nincs, így az Étel szoba, a reggeli
összefoglaló és az Évad oldal mindig ugyanazt a számot mondja. Az oldal a telefonon elmenti az utolsó állapotot, így internet
nélkül is látod (az adat korával), csak módosítani nem tudsz.

## Miért így
- A tulajdonos kérése: az edzés, az étel, az alvás és a súly **egy rendszer**, szinkronban; minden változtatásnál lássa a
  következményeket, és ne lehessen edzésblokkot terv nélkül indítani (döntések #61–#64).
- A webes app megszűnt (#52), így eddig sehol nem lehetett súlycélt vagy tervet állítani — az Évad ezt pótolja.
- A mérleg az Apple Health-en át jön, külön importálás nélkül (döntés #7).

## Beállítások
Az egyes funkcióoldalak tartalmazzák (`mezo.season.*`, `mezo.goal.*`).

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `season` | Az évad: név, állapot (tervezett / aktív / lezárt), kezdet, hossz hetekben, a hozzá tartozó súlycél, alvásigény, szabályok |
| `season_revision` | Minden elfogadott módosítás: mi változott, és a számok előtte és utána |
| `season_allowed_recipe` | Az évadban kiválasztott receptek (a heti menü ezekből áll majd össze) |
| `goal` | A súlycél és a motor kimenete (energiaigény, heti szakaszok, megvalósíthatóság) |
| `weight_log` | Mérlegelések (kézi vagy Apple Health) |
| `biometric_profile` | Testadatok: nem, magasság, születési dátum, testzsír, életmód |
| `goal_plan_link` | Az évad súlycéljához csatolt edzésblokk |

## Mi jön még
- Az évad 3–4. szakasza (lásd fent).
- Egy elfogadással az edzésblokk napjai is átrendeződnek, ha az edzésnapok változnak (addig futó blokk alatt az edzésnapok zárolva).
- **Testösszetétel:** a Test kártya és a Health-testzsír a motorban.

## Mi marad ki
A webes app szakasz-, tervsáv- és védőkorlát-oldalai nem kerülnek át külön oldalként. Életcélok (PERMAH-pillérek) termékként
kimaradnak. Napi szintű újratervezés („rosszul aludtál, ma könnyebb edzés”) nem az évad dolga — az a 7. szakaszé.
