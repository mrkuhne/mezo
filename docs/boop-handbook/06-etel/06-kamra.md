---
cim: Kamra, termék-behúzás és a tételek pontszáma
szint: Funkció
terulet: Étel
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Az alapanyagaid saját pontszámmal; újat vonalkóddal, linkből, címkefotóból, kézzel vagy egy koppintással veszel fel, a becsült tételt később pontosítod.
---

## Mit csinál
**A Kamra fül** (2026-11-28 óta kártyás rendben, mint a Ma és a Hét):

- **felül a kiemelt kártya** („A polcod”): tételek, alig feldolgozottak, jelzéssel neked, alatta egy kis sáv arról,
  mennyire feldolgozott, ami a polcon van (alig feldolgozott · feldolgozott · ultra-feldolgozott · nincs adat);
- **„Felveszek egyet” kártya**: Vonalkód · Link · Címkefotó · Kézzel (a legnagyobb betűméretnél kettő-kettő egymás alatt);
- **„A kamrád” kártya**: keresés a kamrában és a közös katalógusban, szűrés kategóriára. Tételenként egy sor:
  kategória-ikon, név, címkék (kalória egységre, fehérje, feldolgozottság, érzékenység), és a tétel **saját
  pontszáma** gyűrűben;
- **„Beállítások” kártya** a fül alján.

**A tétel lapja:** címkék, négy makró-csempe, „Megeszem belőle”; **Boop értékelése** (a pontszám és az öt szempont,
koppintásra magyarázat); a címke többi sora (rost, cukor, só, telített zsír — hiány esetén „nincs adat”);
feldolgozottsági skála; a figyelt allergének soronként; honnan van.

**Becsült tétel:** amit az „Ezt főztem” átnézőjéből „+ Kamrába” gombbal veszel fel, és nincs a közös listában, azt
Boop becsüli meg. Ez **„becsült”** jelzést kap a soron és a lapon, és a lapon a **„Pontosítom”** kártyával vonalkóddal,
címkefotóval vagy kézzel pontos számokra cseréled; a receptjeid onnantól a pontos számokkal számolnak (a már rögzített
étkezések nem változnak).

## Hogyan működik
1. Két réteg: a közös katalógus és a saját kamrád.
2. A tétel pontszáma szabályokból jön, öt szempont szerint, ami egy önálló alapanyagot értelmesen jellemez:
   feldolgozottság, WHO (cukor, só, telített zsír), rost, zsírminőség, energiasűrűség — 100 grammra (milliliterre)
   számolva. Ami hiányzik, az kimarad a számításból, soha nem nullát kap; adat nélkül nincs pontszám.
3. A „+ Kamrába” előbb a közös listát nézi; ha ott nincs, az AI becsül, egy ellenőrző pedig megnézi, hogy a kalória
   összhangban van-e a makrókkal. Becsült tétel soha nem kap feldolgozottsági osztályt. Kétszer koppintva sem lesz két
   tétel.
4. Link, címkefotó és vonalkód (OpenFoodFacts) mint eddig; minden behúzás naplózódik.

## Miért így
A tulajdonos 2026-11-19-én kérte, hogy minden kamra-tétel mutassa a saját pontszámát és a szempontokat, amelyek
szerint értékeljük. A „+” gomb működése („okos lépcső”: előbb a közös lista, aztán becslés) 2026-11-17-i döntés.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.pantry-quick-add.enabled` | Be/ki kapcsolja az egy koppintásos felvételt | be |
| `mezo.feature.pantry-scrape.enabled` | Be/ki kapcsolja a link-behúzást | be |
| `mezo.feature.pantry-photo.enabled` | Be/ki kapcsolja a címkefotós behúzást | be |
| `mezo.feature.pantry-import.enabled` | Be/ki kapcsolja az OpenFoodFacts (vonalkód) keresést | be |
| `mezo.pantry-scrape.allow-private-hosts` | Belső hálózati címek engedése (biztonsági kapcsoló) | ki |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `pantry_catalog` | Közös termékkatalógus: fajta, név, márka, forrás (köztük „Boop becslése”), kategória, adag, tápérték, NOVA |
| `pantry_item` | A saját kamrád tételei |
| `pantry_import` | A behúzások naplója |
| `pantry_item_definition_archive` | Archivált tétel-definíciók |

## Mi jön még
Nincs tervezett bővítés.

## Mi marad ki
Kamra árak, készlet, lejárat és az „olcsóbb alternatíva” javaslatok — lásd [Ami kimarad](10-ami-kimarad.md).
