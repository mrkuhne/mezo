---
cim: A Mozgás szoba ma és az edzés áthelyezése
szint: Funkció
terulet: Edzés
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S3, B2, B5]
osszefoglalo: Az Edzés gömbről nyíló szoba mutatja a mai edzést a valódi sorozataiddal és súlyaiddal, elmondja, mit változtatott Boop és miért, és hálózat nélkül is megmutatja a legutóbb látott tervet — megírva, hogy hány órás.
---

## Mit csinál
- **A mai edzés** a reggeli összefoglalóban és az Edzés szobában: cím, időpont, becsült hossz, a gyakorlatok és a sorozatszám
  (ha aznap könnyítés van, már a könnyített sorozatszámmal).
- **A gyakorlatok valódi sorozatai (B5):** minden gyakorlat sora megmutatja, hány bemelegítő és hány éles sorozat van, milyen
  ismétlésszámra, és **milyen súllyal** — pontosan azzal, amit a motor előírt. Ha egy sorozatot már rögzítettél, a sor kipipálva
  áll. **Ha a motor nem írt elő súlyt, nem is látsz súlyt** — csak a darabszámokat: a terv „kiindulási súlya" nem egy adott
  sorozatra szóló előírás, és nem írjuk ki annak.
- **„Az eligazítás" (B5):** gyakorlatonként egy mondat arról, mit változtatott a motor a múlt héthez képest és miért
  (például „Múlt hét 8 × 77,5 kg (RIR 3) → +2,5 kg"). **Ezt a mondatot a motor írja**, az app nem fogalmaz hozzá semmit; ha a
  motor ki van kapcsolva, a blokk egyszerűen nincs ott.
- **„A heted" (B5):** hétfőtől vasárnapig, melyik napon volt már befejezett edzés. Egy még hátralévő nap üresen áll — arról
  semmit nem állítunk.
- **Hálózat nélkül (B5):** a szoba a legutóbb látott tervet mutatja, **kiírva, hogy hány órás vagy hány napos**. Ha még soha nem
  láttuk, azt mondja, hogy nincs friss adat — sosem ír ki nullát. Ha a szerver elutasít vagy hibázik, azt elmondja; olyankor nem
  ad helyette régi választ.
- **Az edzés megszólal a kezdőlapon (B5):** a tervezett edzés „ezt mozdítja ma a legtöbbet" kártyaként, a mindjárt lekéső edzés
  olyanként, ami magától elromlik — ez utóbbi szólhat is a telefonon (napi legfeljebb kettő), a megvolt edzés pedig
  „megtörtént" sorként. Mindig egy koppintással elutasítható, és aznap nem jön vissza.
- **Ütközés-javaslat:** ha az utolsó naptári megbeszélés kevesebb mint 45 perccel az edzés előtt ér véget, Boop egy javaslatkártyát
  tesz ki: az edzés kezdését egész vagy fél órára kerekítve későbbre tenné. **Elfogadom** = áthelyezi (visszavonható a szoba
  edzéskártyáján a „Vissza…” gombbal), **Most nem** = aznapra elrejti, **miért?** = megmutatja a tényeket.
- A „+” lap „Edzés indítása · a mai terv szerint” csempéje és a szoba „Indítás” csempéje még csak keret („hamarosan”) — az
  edzéslejátszó a következő szakaszban érkezik.

## Hogyan működik
1. A reggeli összefoglalót a háttérrendszer állítja össze: a mai tervezett edzésnap a futó mezociklusból jön, az időpont az
   áthelyezésből, ha van, különben a heti beosztás aznapi idejéből.
2. A szoba ezen felül **külön lekéri a mai edzést** a háttérrendszertől: innen jönnek a sorozatok, a súlyok és az eligazítás
   mondatai. Ami megjön, azt a telefon el is teszi magának, hogy hálózat nélkül is legyen mit mutatnia — de mindig megírja, mikori.
3. Az ütközést **szabály** számolja (a naptár és az edzés időpontja alapján), az AI sosem dönti el.
4. Elfogadáskor a telefon elmenti az aznapi új időpontot; az összefoglaló ettől újragenerálódik.
5. Naponta legfeljebb 3 javaslat jelenik meg, és semmi nem változik koppintás nélkül.

## Miért így
A javaslatkártya a Boop „élő igazítás” egysége (spec §3.1): egy mondat, egy fő gomb, egy másodlagos, és „miért?”. Az edzés
áthelyezése volt az első valódi forrása.

A B5 szabálya ezen felül: **kitalált szám nem kerül a képernyőre.** Ahol a háttérrendszer nem mondott semmit, ott a szoba azt
mondja, hogy nem tudja — nem tesz a helyére nullát és nem ír oda súlyt, amit senki nem írt elő.

**Ismert korlát:** az áthelyezést ma csak a reggeli összefoglaló látja; az étkezési ablakok (edzés előtti/utáni) és az értesítések
még a heti beosztás eredeti idejével számolnak (kutatás 03 §2.7).

## Beállítások
Nincs külön kapcsoló; a 45 perces ütközési határ és a napi 3 javaslat a kódban rögzített. A mentett terv másfél napig
használható offline, utána a szoba inkább azt mondja, hogy nincs friss adat.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `workout_time_override` | Egy napra áthelyezett edzésidő (az utolsó írás érvényes; törlés = visszavonás) |
| `gym_schedule_slot` | A heti beosztás: hétköznaponként egy edzésidő |
| `boop_brief` | A reggeli összefoglaló, benne a mai edzés |
| `workout_instance` · `exercise_set` | A megkezdett és a befejezett edzés, és a benne rögzített sorozatok (a kipipált sorokhoz) |
| `mesocycle` · `workout_session` | A futó blokk és a napjai: innen jön a mai nap és a gyakorlatai |

## Mi jön még
- B5 következő szakasza: az **edzéslejátszó** („Indítás”), majd a **Blokk**, a **Gyakorlatok** és az **Előzmények** fül — ma
  mindhárom megmondja, hogy még nem él.
- B7: több fajta javaslat (rövidebb/hosszabb edzés, más mozgás).

## Mi marad ki
Nincs.
