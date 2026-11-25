---
cim: Fiókok és szabályok — a tükörfiók beállítása, és amit gép sosem olvas
szint: Funkció
terulet: Levél
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [Életpanel]
osszefoglalo: A Fiókok oldalon hat lépésben összekötöd a Boop saját Gmail-fiókját; a Szabályok oldalon megmondod, kit ne olvasson gép, kit mutasson mindig, és kit tegyen csendben el.
---

## Mit csinál
- **Fiókok — a tükörfiók beállítása hat lépésben.** Amíg nincs összekötve, ez az útmutató látszik:
  1. **Új Gmail-fiók csak Boopnak.** Hozz létre egy teljesen új Gmail-fiókot; a sajátodhoz ne nyúlj.
  2. **Kétlépcsős azonosítás.** A Google-fiók biztonsági beállításaiban kapcsold be.
  3. **Alkalmazásjelszó.** Ugyanott kérj egy alkalmazásjelszót — ezt írod be lent, nem a fiók jelszavát.
  4. **Továbbítás a Gmailből.** A saját Gmailedben állítsd be, hogy a levelek az új fiókba is menjenek.
  5. **Továbbítás az iCloudból.** Az iCloud-levelezésnél ugyanez, ha használod.
  6. **A Boop-fiók hozzáadása a Gmail-apphoz.** Így a „Megnyitás a Gmailben” gomb egyenesen a levelet nyitja meg.

  Alatta két mező: a **tükörfiók címe** és az **alkalmazásjelszó** — ezt te gépeled be, és Boop **a valódi
  jelszavadat soha nem kéri**. Mentés előtt Boop kipróbálja a belépést; ha nem sikerül, a mező mellett pirosan
  kiírja, és a jelszómező kiürül. Az alkalmazásjelszót bármikor visszavonhatod a Google-fiókban, és Boop azonnal
  elveszíti a hozzáférést.
- **Összekötve:** látod a címet, az utolsó átnézés idejét, hány levelet látott, és az állapotot szavakkal —
  „Rendben”, vagy „Két futás óta nem jött levél — lehet, hogy a továbbítás leállt” (ilyenkor nézd meg a Gmailben, be
  van-e még kapcsolva), vagy „A postafiók nem fogadja el az alkalmazásjelszót”. Egy **Frissítés most** gomb, ha nem
  akarsz a következő átnézésig várni (ha nemrég volt: „Most néztem át — pár perc múlva újra próbálhatod.”).
- **Lecsatolás.** Megerősítés után törli a tárolt alkalmazásjelszót, és Boop többé nem lát leveleket. A már átnézett
  levelek összefoglalói megmaradnak.
- **Szabályok — egyszerű szavakkal.**
  - **Amit gép soha nem olvas:** a beépített lista (magyar bankok, biztosítók, hivatalok, egészségügyi
    szolgáltatók, belépési kódok) és az általad hozzáadott feladók. Hozzáadhatsz egy feladót („Ezt se olvasd”),
    és a sajátodat el is távolíthatod; a beépítettet nem.
  - **Amit mindig megmutatok** és **Amit csendben eltészek:** a koppintásaidból összejött feladók; mindegyik törölhető.
    Ha egy feladóra háromszor mondtál „nem érdekel”-t, itt jelenik meg a javaslat: „Igen, tedd félre”.
  - Egy mondat arról, mikor csörög a telefon: csak ha valami ma vagy holnap lejár, naponta legfeljebb egyszer-kétszer,
    és ezen a Boop többi része is osztozik.

## Hogyan működik
A mentéskor a háttérrendszer megpróbál belépni a tükörfiókba az alkalmazásjelszóval; csak siker után tárolja, és
**titkosítva** (a kulcs a szerver titka, nincs a kódban, és az alkalmazásjelszót sehol nem írja ki és nem adja
vissza). A Lecsatolás ezt törli. Ha másik címet adsz meg, az előző fiók átvételi helye is elfelejtődik.

## Miért így
A saját jelszavad sosem kerülhet Boophoz — ezért tükörfiók, ezért alkalmazásjelszó, amit egy kattintással
visszavonhatsz. Az érzékeny feladók szabálya (gép soha nem olvassa) alapértelmezett és te bővítheted, de a
beépített szűkebb nem lehet. **A tükörfiókot te állítod be** (2026-11-21), Boop csak az útmutatót adja.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.mail.enabled` | A levélrész be/ki kapcsolása | ki |
| `MEZO_MAIL_SECRET_KEY` | A tárolt alkalmazásjelszó kulcsa | titok, a szerveren |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `mail_mailbox` | A tükörfiók címe és a titkosított alkalmazásjelszó (Lecsatolásnál törlődik) |
| `mail_sender_rule` | A saját feladó-szabályaid |

## Mi jön még
Ha a szerveroldali értesítés megjön (fizetős Apple-fiók), a csengetés pontosabb lesz. Egy közvetlen ugrás a
csörgő értesítésből a Levélre.

## Mi marad ki
A saját Gmail- vagy iCloud-fiókod jelszava — soha. Harmadik postafiók. A továbbítás előtti levelek.
