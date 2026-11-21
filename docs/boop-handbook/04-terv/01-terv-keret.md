---
cim: Az Évad oldal
szint: Funkció
terulet: Terv
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B2, B6]
osszefoglalo: Az alsó sáv második helye — egy pillantással látod, hol tartasz az évadban, mi mire hat, és innen módosítod a tervet.
---

## Mit csinál
Az **Évad** oldal váltotta a régi Terv keretet (a régi oldal a mai súlyt, a mai edzést és egy pénz-kártyát mutatott; ezek
helyett most az évad látszik, a pénz pedig a saját Pénz oldalán van). Az oldal tetején négy fül: **Évad · Menü · Lista ·
Hatás**, a jobb felső sarokban a **Szabályok**.

**A fej:** a gömb annyira telt, ahányadik hétnél tartasz (például „Őszi fogyás · 12 hétből a 7.”), alatta egy rövid ítélet:
„Jó úton vagy”, „Lassabban megy a tervezettnél”, „Gyorsabban megy”, súlytartásnál „Tartod a súlyod” vagy „Kicsit kijjebb
mentél a sávból”, kevés mérlegelésnél pedig az, hogy még nincs elég adat.

**Az Évad fül blokkjai:**
1. **Mi mire hat** — négy gömb (Edzés, Étel, Alvás, Súly) és a köztük futó kapcsolatok. Egy gömbre koppintva kiemelődik, és
   kiírja, mire hat (például „Edzés → Étel · edzésnapon +170 kcal”). Ahol még nincs számolt érték, azt mondja, nem talál ki számot.
2. **Súly** — a súlytrend görbéje a célvonallal, a mostani naptól szaggatottan a terv; súlytartásnál egy sáv (például ±1 kg).
3. **Az évad terve** — négy sor: edzésblokk és sportnapok · edzésnapi és pihenőnapi kalória + fehérje · alvásigény és lefekvés
   · cél és céldátum.
4. **Hogy megy** (2026-11-21 óta) — az elmúlt hét, tegnapig, egyszerű számokkal, pontszám nélkül: például „4 / 5 napon
   belefértél a keretbe”, „3 / 4 edzés megvolt”, „4 / 7 éjjel aludtál eleget”. Amit nincs mivel mérni (például nem volt
   tervezett edzés), az a sor kimarad — sosem ír „0 / 0”-t. Alatta egy sor megmondja, hány kímélő nap maradt ki („1 kímélő nap nem
   számít bele.”, például). Ha még semmit nem lehet értékelni, a blokk nem jelenik meg.
5. **Amit Boop észrevett** (2026-11-21 óta) — legfeljebb három észrevétel, mindegyik csak elég adat után:
   - ha a valódi égetésed legalább 50 kalóriával eltér attól, amivel a terv számolt („Kevesebbet égetsz, mint gondoltuk”,
     például);
   - ha az elmúlt két hónapban a 7 óránál rövidebb éjszakák után érezhetően többet (vagy kevesebbet) ettél („Ha 7 óránál
     kevesebbet alszol, másnap átlagosan 280 kcal-lal többet eszel.”, például) — fogyásnál hozzáteszi, hogy a jobb alvás is
     segít fogyni;
   - „Erre figyelek”: amire a terv figyelmeztet (például az erő megtartása vagy egy izom heti munkája).
   Ugyanez a rövid éjszakás szám jelenik meg a „Mi mire hat” térképen az Alvás → Étel kapcsolatnál.
6. **Következik** — a könnyebb edzéshetek és az évad vége.
7. Gombok: **Módosítás** és **Új évad**.

**Menü, Lista, Hatás:** egyelőre egy „hamarosan” lap mondja el, mi lesz ott.

**Szabályok:** kapcsolók — „Csak kevéssé feldolgozott ételek”, „Vasárnap este kérem a jövő heti menüt”, „Könnyebb edzéshéten
ne fogyjak”, „A valódi égetésemmel számoljon”, „Ajánljon kísérletet, ha valami újat kezdek” —, alattuk a kiválasztott receptek
száma, a blokk, az alvásigény („az edzésből számolva”) és a súlycél.

**Új évad:** öt lépés — a cél (Fogyás / Súlytartás / Izomépítés), az edzés, az étel, az alvás, összesítve —, előre kitöltve a
mostani célodból, edzésblokkodból, heti napjaidból és alvásodból. „Indulhat az évad” indítja, „Később” bezárja.

**Ha még nincs évadod:** „Indítsunk egy évadot” — Boop elmondja, mi az évad, és hogy már összeállított egy javaslatot; a
„Megnézem” gomb az Új évadra visz.

## Hogyan működik
1. Az oldal egyetlen összesítést kér a háttérrendszertől, ami minden számot kiszámol (fej, térkép, súly, terv, következő események).
2. Az utolsó összesítést a telefon megjegyzi. Internet nélkül azt mutatja, az adat korával (például „5 órás adat”); módosítani
   ilyenkor nem lehet, a gomb jelzi, hogy internet kell. Két hétnél régebbi mentett adatot nem mutat.
3. Ha nincs aktív évad, az üres állapot jelenik meg — ez nem hiba.
4. Az Új évad lépései alatt Boop folyamatosan kiszámolja, mivel járna az évad; semmi nem mentődik, amíg meg nem nyomod az
   „Indulhat az évad” gombot.
5. **A „Hogy megy” számai** a háttérrendszer egyetlen napi ítéletéből jönnek. Egy nap étele akkor számít, ha már elmúlt,
   nem kímélő nap, és rögzítettél aznap ételt; akkor „fért bele”, ha legfeljebb 10%-kal tér el az aznapi kerettől (felfelé
   vagy lefelé). Az edzésnél a heti edzés- és sportnapokat és a blokk futásait nézi; az alvásnál az évad alvásigényét (15 perc
   türelemmel); a mai éjszakát sosem értékeli. A kímélő nap minden számból kimarad; egy indokkal kihagyott edzés csak az
   edzések közül marad ki, annak a napnak az étele és az éjszakája számít.

## Miért így
- Az Évad az alsó sáv egyik helye, nem egy a gyűrűből nyíló szoba, ezért nincs saját alsó sávja (két sáv egymás fölött zavaró
  lenne); a fülek felül vannak.
- Minden szám a szerverről jön, és ahol nincs mögötte számolás, ott nem írunk ki semmit (szabály: nincs kitalált szám).
- A színvilág az „esti lila ég” — az évad a test útjáról szól.
- A „Hogy megy” összesítés, nem pontszám: nem minősít, csak megmutatja, mi történt; a betegség nem rontja, és egy indokolt
  kihagyás sem számít elmaradt edzésnek.
- Egy észrevétel csak akkor jelenik meg, ha van mögötte valódi számolás — nincs kitöltő szöveg.

## Beállítások
Nincs külön beállítása; a szabályokat lásd [Az évad](06-terv-csomag.md) oldalon.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `season` | Az aktív évad, amit az oldal mutat |
| `goal` | A súlycél és a motor számai |
| `weight_log` | A súlygörbe mérései |

## Mi jön még
- 3. szakasz: Menü és Lista fül; 4. szakasz: Hatás fül.
- Korábbi évadok oldal, és a mostani súlyod az Új évad első lépésében.

## Mi marad ki
Egy ismert korlát: a „Hogy megy” a tervezett edzésnapokat a **mai** heti beosztásból olvassa, így ha átírod a heti napokat,
az elmúlt napok is az új beosztás szerint látszanak. Egy napra egy tervezett edzést számol: ha ugyanazon a napon edzőterem
és sport is van, az egynek számít. A régi Terv oldal pénz-kártyája (a pénz a Pénz oldalon van) és a „mai edzés” kártya (az a Ma oldalon és az Edzés szobában látszik).
