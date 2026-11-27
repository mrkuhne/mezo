---
cim: Gyors rögzítés („+”)
szint: Funkció
terulet: Alapok
allapot: Élesben
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [B2, B3, B4, B5, Kezdőlap]
osszefoglalo: Egy lap, ahonnan bármit rögzíthetsz, ami a webes gyors logolásban volt — étkezés, ital, víz, kiegészítők, edzés indítása, sport, súly, check-in, napló, alvás, kiadás —, a lebegő „+” gombról; a súly, az alvás, a sport és a naplósor egy hétre visszamenőleg is rögzíthető.
---

## Mit csinál
A lebegő üveg **„+”** gomb (jobb alsó sarok; a kör fölött és egy szoba sávja fölé följebb ülve, a beszélgetésen elrejtve; a képernyőolvasó „Rögzítés”-nek mondja) egy lapot nyit „Mit rögzítesz?” címmel. A kezdőlapon korábban Boop alatt álló **öt gyorsajtó** (Étkezés · Víz · Súly · Check-in · Napló) 2026-11-28 óta nincs — mind az öt ezen a lapon van. Rajta minden, ami a régi webes gyors logolásban volt (a tulajdonos döntése, 2026-11-24):

- **Étkezés** — Fotó · Szöveg · Vonalkód · Recept · Kamra · **Ital**: megnyitja az étkezés rögzítését a választott bejárattal
  (az Ital a hatodik, pont nélküli rekesz — lásd *Italok*);
- **Víz** — öt gomb (1 · 2 · 3 · 5 · 7,5 dl), egy koppintás, és az Étel szoba vízszámlálója lép;
- **Kiegészítők** — a csoportjaid (reggel, napközben, este…) egy-egy „Bevettem” gombbal; még egy koppintás visszavonja;
- **Edzés indítása** — a kezdőlapra visz, és megnyitja az Edzés szobát a mai tervvel;
- **Sport** — a terven kívüli mozgás: mi volt (röpi, cross, TRX, kerékpár, úszás, foci, kosár, tenisz, túra, egyéb),
  hány perc (húzható skála), mennyire volt nehéz (1–10), és **mikor** (Most · Tegnap · Más időpont);
- **Súly** — a mérleg száma egy húzható skálán, tized kilónként; onnan indul, ahol legutóbb hagytad; **melyik nap**
  (Ma · Tegnap · Más nap) — egy napra a legutóbb beírt mérés számít;
- **Check-in** — „fél perc”: megnyitja a kitöltést;
- **Napló** — egy sor a napról, bármikor (nem csak az esti zárásban), **melyik napra** (Ma · Tegnap · Más nap); a
  Napló oldalon a nap lapján jelenik meg;
- **Alvás** — egy éjszaka kézzel: lefekvés és ébredés, az app kiszámolja a hosszát, és megkérdezi, milyen volt (1–10),
  és **melyik reggel ébredtél** (Ma · Tegnap · Más nap). Az órád mérte éjszakáit nem kell beírni, ez a kézi út (óra
  nélkül, vagy egy délutáni alváshoz); ha az órád már mérte azt az éjszakát, csak a minősítésed kerül mellé;
- **Kiadás** — készpénz pár másodperc alatt (lásd a Pénz területet);
- alul egy mező: „Mondd vagy írd: ebéd, csirke rizzsel…” — szöveges étkezés.

## Hogyan működik
- A víz és a kiegészítők azonnal a szerverre mennek (net kell; net nélkül megmondja).
- A súly, az alvás, a sport és a naplósor **net nélkül is rögzül**: a telefon elteszi, és amint van net, magától
  elküldi — ugyanaz az út, mint a check-innél vagy a készpénzes kiadásnál.
- A **„Mikor”** sor minden lapon ugyanaz (2026-11-24): a választott nap olvashatóan a sor jobb szélén áll („tegnap”,
  „nov. 22. · vasárnap”), a „Más nap” a naptárat nyitja, egy hétre visszamenőleg, a jövőbe soha. A rövid üzenet is
  nevezi a napot, ha nem ma („Súly 81,4 kg rögzítve · tegnap”).
- Egy lapon egy dolog: a gomb a billentyűzet fölött marad, a hiba a gomb fölött, a beírtak nem vesznek el.
- Minden rögzítés végén egy rövid üzenet mondja, mi történt („Víz +300 ml”, „Súly 81,4 kg rögzítve”,
  „Alvás 7 ó 35 p rögzítve”, „Naplóba írva”).
- A súlyból egy napra a legutóbb beírt mérés számít (a szerver mellé teszi, a trend az utolsót veszi).

## Miért így
A spec szerint egyetlen gyűjtőlap van minden gyors rögzítésre, hogy ne kelljen keresgélni, melyik helyen kell valamit
felvinni. A tulajdonos 2026-11-24-én kérte, hogy a lap a webes kilenc ajtót mind tudja, és a kezdőlapon is legyen
gombja; 2026-11-28-án az alsó sáv eltűntével a „+” lebegő gombbá vált, a kezdőlapi gyorsajtók pedig megszűntek.

## Beállítások
Nincs. A kiegészítők listáját az Étel szoba beállításaiban állítod össze.

## Adattáblák
Nincs saját tábla — minden ajtó a saját területének tábláiba ír: étkezés és víz (Étel), kiegészítő-bevétel (Étel),
sportedzés (Edzés), súly (Testadatok), alvás (Alvás), naplósor és check-in (Napló), készpénzes kiadás (Pénz).

## Mi jön még
- Hang a naplósorhoz innen is (az esti zárásban már van).
- „Visszavonom az utolsót” a víznél (a weben volt).
- „Mikor” sor a víznél és a kiegészítőknél.

## Mi marad ki
- Aktivitás és hála külön ajtóként (a web „Mit naplózol?” hármasa): a gamifikáció és az aktivitás a Boopban
  nincs, a hála egy naplósor.
