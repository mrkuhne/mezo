# Csapatoldalak és visszakereshető üzenőfal

Driver: `mezo-0vs3m` · 2026-09-29

## Jóváhagyott irány

A tulajdonos a beszélgetésben jóváhagyta a témaközpontú csapattagoldalakat,
a külön gyűjteményeket és a húszas lapozást. A kattintható prototípus és a
megvalósítási terv jóváhagyása még hátravan. Az élő alkalmazás még változatlan.

## Probléma és cél

Az üzenőfalon látott bejegyzés egy állapotváltás után kieshet az esti válogatás
kivételei közül. A szobák öt elemes előnézetéből nincs út a teljes listához;
a számlálók több elemet ígérnek, mint amennyit meg lehet nyitni. A minta és a
személyes észrevétel azonos címkét kap. A cél: minden megjelent bejegyzéshez
legyen tartós visszaút, és a felhasználó tudja, mit és hol talál.

## Felépítés

- Üzenőfal: időrend, új/olvasott megkülönböztetés, olvasatlan szűrő, húszas
  lapozás. Olvasás, válasz vagy esti válogatás nem tünteti el az előzményt.
- A csapat: öt témaközpont és közvetlen Összes minta / Összes gyűjtemény ajtó.
- Csapattag: rövid szerepleírás, elsődleges gyűjteménybejáratok, legfeljebb
  három friss elem. A prototípus egy kiemelt friss elemet mutat. Az érettség és
  korábbi karakterfunkciók másodlagos, elérhető háttérként maradnak.
- Öt gyűjtemény: Minták és összefüggések; Személyes észrevételek; Kísérletek;
  Előrejelzések; Amit rólad megtanult. Minden gyűjtemény saját oldal, kereséssel,
  értelmes állapotszűrőkkel és legfeljebb húsz bejegyzéssel oldalanként.
- Közös ügy mindkét témából megnyitható, ugyanazt a rekordot jelenti.
- Mezo szobája: személyes és több témát összekötő felismerések. A teljes
  csapat keresője külön bejárat, nem Mezo szobájába ömlesztett tartalom.
- Részlet: típus, eredeti időpont, állapot, eredeti szöveg, időszakkal ellátott
  források, válasz és tartós Beszélgessünk erről. A chat megkapja a forrást és
  a szöveget. A felhasználói válasz nem jelent automatikus statisztikai igazolást.
- Visszalépés megtartja a keresést, szűrést és lapszámot.

A típus, a feldolgozási állapot és az olvasottság három külön fogalom. A
személyes észrevétel nem bizonyított minta. Időszakos megállapítás nem örök
tulajdonság; a forrás és az időszak olvasható.

## Design és prior art

Az irány belső referenciái az élő öt csapattagoldal, a meglévő Minták oldalak,
a csapatfal és az [Üveg kánon](../../design_2.0/README.md). Külső termékből nem
veszünk át új vizuális rendszert. Meleg grafit alap, meglévő Mozaik színek,
eredeti üveganyag, Boop figurák, közös 3D sprite és változatlan alsó menü.
A bejáratok elsődleges üvegobjektumok, a listák csendes sorok. Nincs üveg az
üvegben; a hosszú szöveg álló Geist. Új ikon nem szükséges.

Élő prototípus: [mezo.html](../../design_2.0/prototypes/elo/mezo.html).
Belépők: `#csapat`, `#szoba/mezo`, `#szoba/szunya`,
`#gyujtemeny/szunya.mintak`, `#fal`. Kizárólag fiktív adatokkal működik.
A helyi chat bemutató válasz, nem élő AI-hívás. A fix Claude Artifact még
nem frissült; a jóváhagyás útja az alkalmazásban megnyitott helyi HTTP-előnézet.

## Codebase terrain

- `frontend/src/features/insights/pages/{TeamPage,CharacterRoomPage,TeamFeedPage}.tsx`
  a mostani oldalak; a `CharacterRoomPage` öt elemre vágja az ügyeket.
- `frontend/src/features/insights/logic/{teamFeed,teamEdition,teamRooms}.ts`
  a több forrásból képzett fal, a válogatás és a szobák rendezése.
- `frontend/src/features/insights/components/feed/{useTeamFeed,FeedTrio,FeedReplySheet}.tsx`
  a jelenlegi olvasási és válaszutak (a hook fájlja `.ts`).
- A szerver eredeti észrevételei és eseményei megmaradnak. A tartós üzenetlista,
  olvasottság, stabil részlet- és chatkapcsolat szerződését a megvalósítási terv
  rögzíti, a prototípus jóváhagyása után, contract-first módon.

## Kész, ha

Mind az öt témaközpontból elérhető az öt teljes gyűjtemény; a közös ügyek két
helyről ugyanoda visznek. A megnyitott elem olvasottá válik és megmarad, a
visszalépés megtartja a lista állapotát. A lapozás legfeljebb húsz rekordot ad.
A részlet és chat az eredeti témát őrzi, olvasottság és válasz nem keveredik.
Üres, betöltési és hibaállapot; 320 px; csökkentett mozgás; meglévő háttérutak
elérhetősége mind ellenőrzendő. Az app implementálása, helyi kapui, kiadása és
éles ellenőrzése a további jóváhagyott munka része, nem e prototípus teljesítése.
