---
cim: Allergének és érzékenységek
szint: Funkció
terulet: Étel
allapot: Tervezve
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Boop tudni fogja, mire vagy érzékeny, és jelzi az alapanyagokon, a recepteken és az étkezéseken.
---

## Mit csinál
Új funkció — ma sehol nincs meg a rendszerben. A B4 után:

- a **profilodban** megadod, mire vagy allergiás vagy érzékeny (például laktóz, glutén);
- a **kamra tételein** jelölés van, mit tartalmaznak;
- a **recept** a hozzávalókból automatikusan összesíti az allergéneket;
- Boop az **étkezés-vázlatnál, az értékelésnél és a javaslatoknál** figyelembe veszi és ki is mondja.

## Hogyan működik (terv)
A pontos modellt a B4 indító ötletelése dönti el. A kutatás javaslata:

1. Allergén-készlet a termékkatalógus soraira (az EU 14 főallergénje plusz érzékenységek, például laktóz).
2. Recept-szintű összesítés a hozzávalókból, nem kézzel.
3. Felhasználónkénti érzékenység-profil.
4. Felhasználás négy helyen: az étkezés-vázlat párosításánál, a pontozásnál és az AI értékelésnél, a későbbi étrendi terv
   szűrőjénél, és a behúzásoknál (az OpenFoodFacts allergén-adatot ad; az AI-behúzások új mezőt kapnak, átnézés-jelzéssel).

## Miért így
- Ma a recepteken csak szabad szöveges címke van, és az AI étkezés-értékelő kifejezetten **tiltja**, hogy ételérzékenységet
  nevezzen meg. A B4 ezt a szabályt **szándékosan megfordítja** (spec §7 kockázatok: „Allergén-szabály megfordítása”).
- A tulajdonos kérte (spec §3.1 „Új”).

## Beállítások
Nincs még — a B4 tervezésekor dől el.

## Adattáblák
Nincs még. Ma egyik étel-táblában sincs allergén-oszlop; a B4 hozza létre (a háttérben `pantry_catalog`, `recipe` és a profil bővítése várható).

## Mi jön még
- B4: a teljes modell és a négy felhasználási hely.
- B6: az étrendi terv szűrője is használja („ne javasolj laktózt tartalmazó receptet”).

## Mi marad ki
Nincs.
