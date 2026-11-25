---
cim: Fiókok és szabályok — belépés Google-lel, és amit gép sosem olvas
szint: Funkció
terulet: Levél
allapot: Ellenőrzés
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [Életpanel]
osszefoglalo: A Fiókok oldalon egyetlen gombbal, Google-lel belépve engedélyezed, hogy Boop olvasni tudja a saját Gmailedet; a Szabályok oldalon megmondod, kit ne olvasson gép, kit mutasson mindig, és kit tegyen csendben el.
---

## Mit csinál
- **Fiókok — belépés Google-lel.** Amíg nincs összekötve, egy gomb látszik: **„Belépés Google-lel”**. Alatta két sor:
  mit lát Boop (a Beérkezett és a Spam levelek, kizárólag olvasásra), és mit nem tesz soha (nem küld, nem töröl, nem
  jelöl olvasottnak). A Google saját oldalán engedélyezed; a jelszavadat Boop sosem látja. Ha a szerver még nincs
  beállítva a belépésre, az oldal ezt kimondja, és nincs gomb.
- **Összekötve:** látod a címet, az utolsó átnézés idejét, hány levelet látott, és az állapotot szavakkal —
  „Rendben”, vagy „Két futás óta nem jött levél”. Egy **Frissítés most** gomb, ha nem akarsz a következő átnézésig
  várni (ha nemrég volt: „Most néztem át — pár perc múlva újra próbálhatod.”).
- **Ha a Google visszavonja a hozzáférést** (te vontad vissza, megváltoztattad a Google-jelszavad, vagy fél éve nem
  használtad): az oldalon ez áll: „A Google visszavonta a hozzáférést — lépj be újra”, és ott a gomb. A Levél tetején
  is erre mutat egy sor; csengetés nincs rá.
- **Lecsatolás.** Megerősítés után a Google-nál is visszavonja a hozzáférést, törli a tárolt kulcsot, és Boop többé
  nem lát leveleket. A már átnézett levelek összefoglalói megmaradnak. Másik Google-fiókra váltáskor a régi
  hozzáférés is visszavonódik.
- **iCloud (nem kötelező).** Boop az iCloud-levelezést nem olvassa közvetlenül. Ha azt is látni szeretnéd, állítsd be az
  iCloudban, hogy továbbítson a Gmailedbe.
- **Egyszeri beállítás, amit te csinálsz (kb. 10 perc, Claude végigvezet).** Létrehozol egy Google-projektet
  **„személyes”** módban, bekapcsolod benne a Gmail-szolgáltatást, készítesz a Boop-appnak egy iPhone-os
  hozzáférést, és megadod Claude-nak az azonosítóját (ez nem titok). Ez a „személyes” mód a lényeg: csak a te
  fiókod léphet be vele, ezért nem jár le hetente a belépés, és a Google nem kér ellenőrzést.
- **Szabályok — egyszerű szavakkal.**
  - **Amit gép soha nem olvas:** a beépített lista (magyar bankok, biztosítók, hivatalok, egészségügyi
    szolgáltatók, belépési kódok) és az általad hozzáadott feladók. Hozzáadhatsz egy feladót („Ezt se olvasd”),
    és a sajátodat el is távolíthatod; a beépítettet nem.
  - **Amit mindig megmutatok** és **Amit csendben eltészek:** a koppintásaidból összejött feladók; mindegyik törölhető.
    Ha egy feladóra háromszor mondtál „nem érdekel”-t, itt jelenik meg a javaslat: „Igen, tedd félre”.
  - Egy mondat arról, mikor csörög a telefon: csak ha valami ma vagy holnap lejár, naponta legfeljebb egyszer-kétszer,
    és ezen a Boop többi része is osztozik.

## Hogyan működik
A gomb a Google saját belépőoldalát nyitja meg; a végén a telefon egyszeri kódot kap, és ezt átadja a szervernek. A
szerver ezzel kér hosszú életű hozzáférési kulcsot, **titkosítva** tárolja (a titkosítás kulcsa a szerver titka, nincs a
kódban), és sehol nem írja ki, nem adja vissza, a telefon sem tárolja. A Lecsatolás ezt visszavonja és törli. Ha
a Google visszavonja a hozzáférést, a következő átnézés ezt észreveszi, és újra belépést kér.

## Miért így
A jelszavadat Boop sosem kapja meg, a hozzáférés a Google-fiókodban bármikor visszavonható, és Boop csak olvasni tud.
**Nincs külön gyűjtőfiók** (2026-11-25): a korábbi tükörfiókos terv helyett a saját Gmailedhez adsz hozzáférést. Az
érzékeny feladók szabálya (gép soha nem olvassa) alapértelmezett és te bővítheted, de a beépített szűkebb nem lehet.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.mail.enabled` | A levélrész be/ki kapcsolása | ki |
| `MEZO_MAIL_SECRET_KEY` | A tárolt hozzáférési kulcs titkosításának kulcsa | titok, a szerveren |
| `MEZO_MAIL_GOOGLE_CLIENT_ID` | A Google-projekt azonosítója a belépéshez (nem titok); nélküle a gomb nem működik | üres |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `mail_mailbox` | A Gmail-cím, a fiók fajtája és a titkosított hozzáférési kulcs (Lecsatolásnál törlődik) |
| `mail_sender_rule` | A saját feladó-szabályaid |

## Mi jön még
Ha a szerveroldali értesítés megjön (fizetős Apple-fiók), a csengetés pontosabb lesz. Egy közvetlen ugrás a
csörgő értesítésből a Levélre.

## Mi marad ki
A Google-jelszavad — soha. Levél küldése, törlése, olvasottnak jelölése — soha. Az iCloud közvetlen olvasása. Harmadik postafiók.
