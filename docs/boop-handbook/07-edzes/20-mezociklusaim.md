---
cim: Mezociklusaim
szint: Funkció
terulet: Edzés
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Minden mezociklusodnak saját oldala van — a futó, a tervezett, a sablonjaid és a lezártak —, onnan indítod, újraindítod, zárod le és mented sablonba.
---

## Mit csinál

**A Mezociklus fül.** Az Edzés szoba negyedik füle mostantól „Mezociklus” (régen „Blokk”). Felül a **futó mezociklusod kártyája**:
a címe, „N. hét / M”, egy haladássáv, és három gomb: **Szerkesztés**, **Újraindítás**, **Lezárás**. A „…” menüben van a
**Mentés a sablonba**. A heti átnézés kártyáján a másodlagos „szerkesztés” gomb megszűnt, mert a futó kártyán már ott van.
Legalul két csempe: **Mezociklusaim** és **Éves terv** (a régi éves terv sor helyett).

**A Mezociklusaim oldal.** Négy rész:
- **MOST FUT** — nagy kártya: a hetek sora (a mai hét kiemelve), egy gyűrű és a test, amelyen látszik, mely izmok kapnak munkát.
- **KÖVETKEZIK** — a tervezett (még el nem indult) mezociklusok kártyái.
- **SABLONJAIM** — vízszintesen lapozható kártyák: a test, egy kis terhelés-görbe és az „N×” szám, hányszor futtattad le.
- **LEZÁRTAK** — gyűrűs kártyák a befejezett mezociklusokról.

Ha még nincs semmid: „Még nincs mezociklusod — indíts egyet”. Betöltés közben vázlat látszik, hibánál újrapróbálható üzenet.
Ha nincs hálózat, a legutóbb mentett lista jelenik meg a korával, a gombok pedig ki vannak kapcsolva, és megmondják, miért.

**A részletoldal.** Bármelyik kártyára koppintva megnyílik: a hetek terhelés-görbéje, lezártaknál a zárójelentés előzetese,
a napok lapozható kártyái és az izomtérkép. **A koppintás sosem indít el semmit.** Indítani csak az alsó sáv gombjaival lehet:
**Indítás** (sablonnál és tervezettnél) vagy **Újrafuttatás** (lezártnál), mellette **Szerkesztés**. Ha éppen fut egy mezociklusod,
előtte megerősítést kérsz: „A most futó „X” lezárul.” — a futó mezociklus előbb lezárul, a zárójelentésével együtt, és csak utána indul az új.

**Újraindítás.** A futó kártyán: „Újrakezded ma az 1. héttől?”, és egy kapcsoló: **„A sablont is frissítem”**. Egyetlen lépésben
létrejön egy új, mai kezdésű mezociklus az 1. héttől, **minden eddigi telefonos módosításoddal**, a régi lezárul a zárójelentésével,
és az éves tervben megmarad a helye. Ha bármi elromlik, **semmi sem változik**.

**Lezárás és zárójelentés.** A lezárás előtt egy lap kérdezi: „Hogy sikerült? (nem kötelező)” — egy saját megjegyzést írhatsz.
Utána grafikus zárójelentés: a hetek terve és a valóság egymás mellett, a teljesítés gyűrűje, az erőnléti sorok a rekordokkal,
a saját megjegyzésed és **Boop értékelése** (készül · kész · ki van kapcsolva).

**Mentés a sablonba.** Felülírja a sablont a mezociklus mostani állapotával. Ha a mezociklus régi, és nem volt sablonja, most kap egyet.

**Sablon szerkesztése.** A szerkesztő sablon módban „SABLON SZERKESZTÉSE” feliratot kap; a mentés csak a sablont írja, a futó
mezociklust sosem érinti.

**Átnevezés.** Az appban minden látható „blokk” szó „mezociklus” lett.

## Hogyan működik
1. A fül megnyitásakor a telefon lekéri a mezociklusok listáját, és a háttérben frissíti; közben az utoljára látott lista azonnal ott van.
2. Az Indítás, Újrafuttatás, Újraindítás és Lezárás mind a háttérrendszerben fut le egyetlen lépésként; a telefon csak az eredményt mutatja.
3. A zárójelentést a szerver a lezáráskor **befagyasztja**; Boop szöveges értékelése **néhány perccel később** érkezik, addig „készül” látszik.
4. A hiányzó edzések száma csak akkor jelenik meg, ha a naplózott adatokból kiszámolható.

## Miért így
- Az újraindítás egy lépés, hogy félúton ne maradhass két mezociklus vagy semmi között.
- A koppintás sosem indít: egy véletlen érintés ne zárjon le egy futó mezociklust.
- A sablon külön van a futótól, hogy egy kísérletezés ne rontsa el a bevált tervet.

## Beállítások
Nincs.

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `mesocycle` | A futam: állapot, kezdés, lezárás, befagyasztott zárójelentés |
| `meso_template` | A sablon; a mentés és az újraindítás ezt írja felül |

## Mi jön még
Nincs betervezve.

## Mi marad ki
- A hiányzó edzések száma nem jelenik meg, ha nem számolható ki naplózott adatból — nem találunk ki számot.
- Boop értékelése percekkel később jön, nem a lezárás pillanatában.
