---
cim: A vagyonod és a napi hírek — Pénzem oldal és hírösszefoglaló
szint: Funkció
terulet: Pénz
allapot: Élesben
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [Életpanel]
osszefoglalo: A Pénzem oldalon látod a befektetéseidet három időtáv szerint, és hogy a hosszú rekesz hány évnyi fix kiadásodat fedezi. A Ma oldal alján minden nap ott van, mi mozdult meg abból, ami téged érint — forintban, forrásokkal, és megnyitható elemzéssel.
---

## Mit csinál
- **Pénzem — a vagyonod időtávok szerint.** Fent: mennyid van most összesen, mennyit mozdultak a befektetések az
  előző záróárhoz képest, és ebből mennyi volt az árfolyam (a kettőt mindig külön mutatja). Ha az árak régiek,
  kiírja, mikoriak. Alatta a **három rekesz** — 1–3 év, 5–10 év, 10+ év —, mindegyik értéke és aránya; egy rekeszt
  megnyitva a benne lévő befektetéseid: név, hol van (MBH, Revolut, más), mennyit ér, mekkora része a rekesznek.
  A **10+ éves rekesz** nem százalékot mutat, hanem azt, hogy *ahogy most áll, növekedést nem feltételezve, hány
  év és hány hónap fix kiadásodat fedezi* — például „4 év 7 hónapnyi fix kiadásod”. Utána **mi van benne** egy
  sávban, **ami jön a következő hónapokban** (lejárat, kamatforduló, osztalék — amit te rögzítesz), és legalul
  egy csendes sor a **Gyakorlásról**, ami nem számít bele a fenti összegbe.
- **Befektetés rögzítése** (*Befektetést rögzítek*): amit a saját platformodon már megvettél vagy eladtál, azt
  itt felírod — melyik befektetés (vagy egy új: név, fajta, tőzsdei jel ha van, platform, rekesz, pénznem),
  vétel vagy eladás, darabszám ha van, mennyi volt összesen, mikor. Ugyanaz a termék lehet két rekeszben is,
  külön darabszámmal. Eseményt (lejáratot, kamatfordulót) is itt adsz hozzá.
- **A napi hírösszefoglaló a Ma oldal alján.** Csak az a hír kerül ide, ami a **te meglévő befektetéseidet**
  érinti, és csak akkor, ha tartósan számít (szabályozás, technológia, iparági szerkezet, hosszú távú számok) — a
  napon belüli hullámzás kimarad. Az ugyanarról szóló cikkek egy hírbe kerülnek, odaírva, hány forrásból.
  Minden hír egy kártya: melyik befektetésedet érinti és melyik rekeszben van · mi történt · **mit jelent neked
  forintban** · Boop egysoros olvasata · mennyire biztos (három pötty) · hány forrás · *Elemzés*.
- **Az elemzés** (a kártyára koppintva) öt részből áll, mindig mind az öt: *Mit jelent neked* (a forintösszeg,
  azzal a mondattal, hogy ezt a rendszer számolta, nem az AI írta) · *Amit Boop gondol róla* · *Mennyire biztos* —
  és hol tévedhet · *Honnan van* (a források név szerint, megnyithatók) · *Nincs teendőd* — hírenként a saját
  okával (egy 10+ éves befektetés és egy árfolyammozgás más-más okból nem igényel lépést).

## Hogyan működik
- **Az árak** naponta egyszer frissülnek, a tőzsdék előző napi záróárából (a budapesti részvények forintban, a
  külföldi alapok euróban vagy dollárban); a deviza a napi záró árfolyamon számít forintra. Az állampapír nem
  tőzsdei: a kamatából számolódik, vagy ha nincs megadva kamat, a vételi áron, és ezt ki is írja.
- **Bekerülési érték:** minden vétel külön „tétel”; eladáskor a legrégebbi tétel fogy el először, így minden
  eladásnál látszik, mennyi volt rajta a nyereség vagy a veszteség.
- **A hírek** naponta kétszer (reggel fél hétkor és délután fél kettőkor) gyűlnek nyilvános hírforrásokból és
  célzott keresésből a befektetéseid nevére. A rendszer választja ki, mi érinti a befektetéseidet, és **ő számolja
  ki a forintösszeget** a te tételeidből. Az AI csak a szöveget írja — utána egy ellenőr minden mondatot átnéz:
  nem szerepelhet benne olyan szám, amit a rendszer nem számolt ki; nem keverhet össze két befektetést; nem
  mondhat emelkedést, ha esett (és fordítva); nem írhat dátumot, amit nem kapott; és soha nem írhatja, hogy
  vegyél, adj el vagy siess. Ha bármelyik nem stimmel, az a hír egy egyszerű, őszinte szöveget kap helyette.
- **A cikkek szövege idegen szöveg**: elkülönítve kerül az AI elé, azzal, hogy semmilyen benne lévő utasítást nem
  követhet — és ha mégis megpróbálná, az ellenőr megfogja.
- **Ha egy hírforrás tartósan nem elérhető**, a rendszerfigyelő riaszt, a Ma oldal pedig kiírja, hogy ma nincs
  friss hír.
- Értesítést nem küld: a hírek akkor várnak rád, amikor megnyitod az appot.

Például: ha a világ-ETF-ed (10+ év) ára 1,1%-ot esett, és nálad 1 670 000 Ft van belőle, a kártyán „−18 400 Ft ·
a te részeden” áll — ezt a rendszer számolta, nem az AI.

## Miért így
- A tulajdonos jóváhagyta a látványtervet (2026-11-19): a hír kártya, amit meg lehet nyitni; az elemzésnek öt
  része van; nincs „vedd meg / add el” gomb sehol.
- A hosszú rekesz száma azért évek és nem százalék, mert egy tizenöt éves pénznél egy rossz hét „−1,1%”-a csak
  pánikot kelt (tulajdonosi döntés, 2026-11-19).
- A számokat a rendszer számolja, a szöveget az AI írja — a pénzügyi hírösszefoglalók leggyakoribb hibája a
  kitalált szám.
- Az árak ingyenes forrásból jönnek; ellenőrizve, hogy a budapesti részvényeket és a forintot is ismeri, így nem
  kell fizetős szolgáltatás.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| Rekesz (befektetésenként) | 1–3 év, 5–10 év vagy 10+ év | — |
| Platform (befektetésenként) | MBH, Revolut vagy más | — |
| Kamat (állampapírnál) | ebből számolja az értékét | nincs (vételi áron) |
| Kulcsszavak (befektetésenként) | milyen szavak kössenek hozzá egy hírt | a név és a tőzsdei jel |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `penz_holding` | a befektetéseid: név, fajta, tőzsdei jel, platform, rekesz, pénznem, kamat |
| `penz_invest_txn` | a vételek és eladások: mennyi, hány darab, mikor, forintban is |
| `penz_holding_event` | a jövőbeli események: lejárat, kamatforduló, osztalék |
| `penz_quote` | a legutóbbi záróárak és árfolyamok (közös, nem személyes) |
| `penz_news_article` | a begyűjtött hírek címe és rövid kivonata, 30 napig |
| `penz_digest` | a napi összefoglalód: a hírek, a kiszámolt összegek és Boop szövege |
| `penz_provider_status` | melyik hírforrás és árforrás működik, és mióta nem |

## Mi jön még
- A Gyakorlás oldal és Boop javaslatai (*Felosztást kérek*, *Befektetnék*, *Nagyobb összeg*, *Havi stratégia*) — 4.
  lépés. Akkor kerül a Ma oldalra az „ennyit tudsz befektetni” szám is.
- A heti áttekintés: mi az, ami hosszú távon tényleg számít.
- Egy vásárlást összekötni a bankszámlád tételével, hogy a havi keretben is látsszon.

## Mi marad ki
- Napon belüli árfolyam — szándékosan: a te időtávjaidon nem mond semmit, csak nézegetésre csábít.
- Brókerkapcsolat, automatikus vásárlás vagy eladás — soha.
- Értesítés a hírekről — nem lesz.
