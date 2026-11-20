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
4. **Következik** — a könnyebb edzéshetek és az évad vége.
5. Gombok: **Módosítás** és **Új évad**.

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

## Miért így
- Az Évad az alsó sáv egyik helye, nem egy a gyűrűből nyíló szoba, ezért nincs saját alsó sávja (két sáv egymás fölött zavaró
  lenne); a fülek felül vannak.
- Minden szám a szerverről jön, és ahol nincs mögötte számolás, ott nem írunk ki semmit (szabály: nincs kitalált szám).
- A színvilág az „esti lila ég” — az évad a test útjáról szól.

## Beállítások
Nincs külön beállítása; a szabályokat lásd [Az évad](06-terv-csomag.md) oldalon.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `season` | Az aktív évad, amit az oldal mutat |
| `goal` | A súlycél és a motor számai |
| `weight_log` | A súlygörbe mérései |

## Mi jön még
- 2. szakasz: „Hogy megy” és „Amit Boop észrevett” blokk.
- 3. szakasz: Menü és Lista fül; 4. szakasz: Hatás fül.
- Korábbi évadok oldal, és a mostani súlyod az Új évad első lépésében.

## Mi marad ki
A régi Terv oldal pénz-kártyája (a pénz a Pénz oldalon van) és a „mai edzés” kártya (az a Ma oldalon és az Edzés szobában látszik).
