---
cim: Allergének és érzékenységek
szint: Funkció
terulet: Étel
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Megadod, mire vagy érzékeny, és Boop jelzi az alapanyagokon, a recepteken és a javaslatokban — de csak azt állítja, amit tényleg tud.
---

## Mit csinál

- A **profilodban** megadod, mire vagy érzékeny, és milyen szinten: *allergia*, *intolerancia* vagy
  *kerülöm*. Ugyanitt állítható, hogy a feldolgozottság meddig mehet el.
- A **kamra tételein** ott van, mit tartalmaznak a 14 kötelezően jelölt allergénből.
- A **recept** a hozzávalóiból magától összesíti ezt — kézzel nem kell beírni.
- Boop a **javaslatoknál** figyelembe veszi: nem ajánl olyat, amit a szabályaid kizárnak.

**A legfontosabb szabály:** ha egy ételről nincs adatunk, Boop azt mondja, hogy *nincs adat* — soha nem azt,
hogy „nem tartalmazza". Egy allergiánál a „nincs adat" ugyanúgy kizárja az ételt, mint a „tartalmazza".

## Hogyan működik

1. **Az alapanyag.** Egy vonalkódról beolvasott termék a bolti adatbázisból hozza az allergéneket. Ami
   kézzel került fel, ott a **polca** mondja meg, amit biztosan tudni lehet: a halpolcon halat, a tojáspolcon
   tojást, a tejtermék- és sajtpolcon tejet, a magvaknál a név szerinti helyes allergént (mogyoróvaj →
   földimogyoró, szezámmag → szezám, kesu és pekán → csonthéjas).
2. **Ami vegyes polc, azt a neve dönti el.** A tejtermékek közt ott vannak a növényi italok is: a mandulaital
   csonthéjas, a szójaital szója, a kókusztej pedig egyik főallergént sem tartalmazza. Ezek sosem kapnak
   „tejet". A magkeverékek és a chia „nincs adat" maradnak — a „mag" szó nem mondja meg, melyik magról van szó.
3. **A recept** a hozzávalói közül a legerősebb állítást veszi át minden allergénre: a „tartalmazza" erősebb a
   „nyomokban"-nál, az pedig a „nincs adat"-nál. Egyetlen bizonytalan hozzávaló is bizonytalanná teszi az
   egészet — ez szándékos.
4. **A laktózmentes termékek.** A „Laktózmentes" (vagy „LM") nevű tejtermékeid továbbra is tejterméknek
   számítanak, mert a kötelező jelölés a tejproteinről szól, nem a laktózról — viszont Boop felismeri őket, és
   **laktóz-intoleranciánál nem szól rájuk**. Egy allergia-szintű tej-szabályt ez nem lazít fel. Egy recept
   csak akkor számít laktózmentesnek, ha **minden** tejes hozzávalója laktózmentes.
5. **Egy valódi címke mindig erősebb** annál, amit a polc sejt: ha egy terméken már van beolvasott vagy kézzel
   megadott allergén-adat, azt semmi nem írja át.

## Miért így

- Te kérted, és az étkezés-értékelő AI korábbi, ételérzékenységet **tiltó** szabályát a B4
  szándékosan megfordította (B4 spec §7).
- **Döntés, 2026-11-13** („Kitöltjük, amit biztosan tudunk"): a kamrában minden alapanyagnál üres volt az
  allergén-rovat, ezért a halas és tojásos receptek allergénmentesnek számoltak. A két lehetőség közül — a polc
  alapján kitölteni, vagy mindenhova „nem tudjuk"-ot írni — a kitöltést választottad: egy sima tojáson a „nem
  tudjuk" csak zaj lenne, amit megtanulsz nem észrevenni. A laktózmentes felismerés ugyanebbe a körbe tartozik,
  különben a saját reggelid tűnne veszélyesnek.

## Beállítások

| Beállítás | Mit állít | Alapérték |
|---|---|---|
| profil: érzékenységek | Mire és milyen szinten vagy érzékeny | üres lista |
| profil: feldolgozottsági korlát | Meddig mehet el egy étel feldolgozottsága | be, 2. szintig |

## Adattáblák

| Tábla | Mit tárol |
|---|---|
| `pantry_catalog.allergens` | Alapanyagonként: melyik allergént *tartalmazza*, melyiket *nyomokban*, melyikről *nincs adat* |
| `pantry_catalog.lactose_free` | Igaz, ha a termék felismerten laktózmentes (a hamis azt jelenti: nem tudjuk, nem azt, hogy van benne laktóz) |
| `recipe.allergens` | A recept hozzávalóiból **számolt** összesítés — kézzel nem írható |
| `recipe.lactose_free` | Igaz, ha minden tejes hozzávaló laktózmentes; üres, ha egyáltalán nincs tejes hozzávaló |
| `sensitivity_profile` | Felhasználónként egy érzékenység-profil + a feldolgozottsági szabály |

## Mi jön még

- A vonalkódos termékek saját címkéjéről is olvassuk ki a laktózmentes jelölést, ne csak a névből (`mezo-6ebdi`).
- B6: az étrendi terv szűrője is használja („ne javasolj laktózt tartalmazó receptet").
- A boltból behúzott, feldolgozott termékek (snack, szósz) többsége továbbra is „nincs adat" — ezeket csak a
  vonalkód tudja feltölteni.

## Mi marad ki

- **A „nem tartalmazza" állítás.** A rendszer sehol nem tud és nem is fog kimondani, hogy egy étel mentes
  valamitől — csak azt, hogy tartalmazza, nyomokban tartalmazhatja, vagy nincs róla adat.
- Allergén kézi szerkesztése a weben: nincs rá felület.
