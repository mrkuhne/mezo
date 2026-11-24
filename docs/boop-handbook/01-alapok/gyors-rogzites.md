---
cim: Gyors rögzítés („+”)
szint: Funkció
terulet: Alapok
allapot: Élesben
hol: [iPhone app]
szulo: 00-attekintes
szakasz: [B2, B3, B4, B5, Kezdőlap]
osszefoglalo: Egy lap, ahonnan bármit rögzíthetsz, ami a webes gyors logolásban volt — étkezés, víz, kiegészítők, edzés indítása, sport, súly, check-in, napló, alvás, kiadás —, a menüsor „+” gombjáról; a kezdőlapon öt gyorsajtó a leggyakoribb ötre.
---

## Mit csinál
A „+” gomb (a menüsor jobb szélén) egy lapot nyit „Mit rögzítesz?” címmel. A kezdőlapon Boop mondata alatt
**öt gyorsajtó** áll — **Étkezés · Víz · Súly · Check-in · Napló** —, mindegyik rögtön a saját lapját nyitja, a
„Mit rögzítesz?” lap nélkül (2026-11-24; a korábbi „Rögzítés” kapszula helyett, amely csak ezt a lapot nyitotta). Rajta minden, ami a régi webes gyors logolásban volt (a tulajdonos döntése, 2026-11-24):

- **Étkezés** — Fotó · Szöveg · Vonalkód · Recept · Kamra: megnyitja az étkezés rögzítését a választott bejárattal;
- **Víz** — öt gomb (1 · 2 · 3 · 5 · 7,5 dl), egy koppintás, és az Étel szoba vízszámlálója lép;
- **Kiegészítők** — a csoportjaid (reggel, napközben, este…) egy-egy „Bevettem” gombbal; még egy koppintás visszavonja;
- **Edzés indítása** — a Ma helyre visz, és megnyitja az Edzés szobát a mai tervvel;
- **Sport** — a terven kívüli mozgás: mi volt (röpi, cross, TRX, kerékpár, úszás, foci, kosár, tenisz, túra, egyéb),
  hány perc (húzható skála), mennyire volt nehéz (1–10);
- **Súly** — a mérleg száma egy húzható skálán, tized kilónként; onnan indul, ahol legutóbb hagytad;
- **Check-in** — „fél perc”: megnyitja a kitöltést;
- **Napló** — egy sor a napról, bármikor (nem csak az esti zárásban); a Napló oldalon jelenik meg;
- **Alvás** — egy éjszaka kézzel: lefekvés és ébredés, az app kiszámolja a hosszát, és megkérdezi, milyen volt (1–10).
  Az órád mérte éjszakáit nem kell beírni, ez a kézi út (óra nélkül, vagy egy délutáni alváshoz);
- **Kiadás** — készpénz pár másodperc alatt (lásd a Pénz területet);
- alul egy mező: „Mondd vagy írd: ebéd, csirke rizzsel…” — szöveges étkezés.

## Hogyan működik
- A víz és a kiegészítők azonnal a szerverre mennek (net kell; net nélkül megmondja).
- A súly, az alvás, a sport és a naplósor **net nélkül is rögzül**: a telefon elteszi, és amint van net, magától
  elküldi — ugyanaz az út, mint a check-innél vagy a készpénzes kiadásnál.
- Egy lapon egy dolog: a gomb a billentyűzet fölött marad, a hiba a gomb fölött, a beírtak nem vesznek el.
- Minden rögzítés végén egy rövid üzenet mondja, mi történt („Víz +300 ml”, „Súly 81,4 kg rögzítve”,
  „Alvás 7 ó 35 p rögzítve”, „Naplóba írva”).
- A súlyból egy napra egy mérés számít: a második ugyanazon a napon felülírja az elsőt.

## Miért így
A spec szerint egyetlen gyűjtőlap van minden gyors rögzítésre, hogy ne kelljen keresgélni, melyik helyen kell valamit
felvinni. A tulajdonos 2026-11-24-én kérte, hogy a lap a webes kilenc ajtót mind tudja, és a kezdőlapon is legyen
gombja (lásd a döntést: *Gyors rögzítés: a webes kilenc ajtó a „+” lapon, és egy gomb a kezdőlapon*).

## Beállítások
Nincs. A kiegészítők listáját az Étel szoba beállításaiban állítod össze.

## Adattáblák
Nincs saját tábla — minden ajtó a saját területének tábláiba ír: étkezés és víz (Étel), kiegészítő-bevétel (Étel),
sportedzés (Edzés), súly (Testadatok), alvás (Alvás), naplósor és check-in (Napló), készpénzes kiadás (Pénz).

## Mi jön még
- Hang a naplósorhoz innen is (az esti zárásban már van).
- „Visszavonom az utolsót” a víznél (a weben volt).

## Mi marad ki
- Aktivitás és hála külön ajtóként (a web „Mit naplózol?” hármasa): a gamifikáció és az aktivitás a Boopban
  nincs, a hála egy naplósor.
