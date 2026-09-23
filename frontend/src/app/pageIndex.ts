// ============================================================
// Mezo · Oldal-leltár (mezo-ju4j6.17)
//
// WHY THIS EXISTS — the four tabs per domain are about to be restructured
// (`mezo-ju4j6` phases 5–7). The owner's stated risk: "félek, hogy elveszítem a
// funkciókat fejben útközben, annyi minden van benne". This module is the safety
// net: ONE hand-written line per page, in his language, so a surface cannot be
// quietly dropped while the menu around it is redrawn.
//
// The grouping is NOT stored here. `MindenOldalPage` derives each page's group by
// running `activeTabRoute()` — the very rule the TabBar uses — so when a tab's
// route or `owns` list changes, the leltár regroups itself and can never disagree
// with the bar. A page under no tab lands in "Máshonnan elérhető", which is the
// honest answer, not a bug.
//
// COMPLETENESS IS ENFORCED, NOT TRUSTED: `pageIndex.coverage.test.ts` walks
// `router.tsx` and fails if any concrete route is neither listed here nor given a
// written reason in `NOT_INDEXED`. Adding a page without a line here breaks the
// build — which is the entire point of the inventory.
// ============================================================

export interface IndexedPage {
  /** The route exactly as `router.tsx` declares it, with a leading slash. */
  route: string
  /** The page's name in the owner's language — what he would call it out loud. */
  label: string
  /** One short line: what you can DO here. This is the part that protects a function. */
  hint: string
}

/**
 * Every listable page, in the order it appears in `router.tsx` per domain.
 *
 * "Listable" = a real surface a person can stand on. Parameterised detail routes
 * (`/fuel/recipes/:id` — one specific recipe) are represented by their list page,
 * not enumerated; see `NOT_INDEXED` for the rule and every named exception.
 */
export const PAGE_INDEX: IndexedPage[] = [
  { route: '/settings', label: 'Beállítások', hint: 'Minden terület és a fiókod egy helyen.' },
  { route: '/settings/fuel', label: 'Fuel beállítások', hint: 'Táplálkozási célok, makrók és ritmus.' },
  { route: '/settings/fuel/slots', label: 'Étkezési ablakok', hint: 'A három naptípus étkezési sablonjai.' },
  { route: '/settings/train', label: 'Edzés beállításai', hint: 'A rendszeres mozgás időpontjai.' },
  { route: '/settings/train/gym', label: 'Gym időpontok', hint: 'Heti edzőtermi rend.' },
  { route: '/settings/train/sport', label: 'Sport időpontok', hint: 'Sportágak és rendszeres alkalmak.' },
  { route: '/settings/me', label: 'Személyes alapadatok', hint: 'Testadatok, súlycél és alvás.' },
  { route: '/settings/me/biometrics', label: 'Testprofil', hint: 'Mért testadatok és aktivitás.' },
  { route: '/settings/me/sleep', label: 'Alváscél', hint: 'Alvásidő és napi horgony.' },
  { route: '/settings/me/goal', label: 'Súlycél beállításai', hint: 'Célsúly és tempó, számított céldátummal.' },
  { route: '/settings/mezo', label: 'Mezo beállításai', hint: 'Személyes háttér és kommunikáció.' },
  { route: '/settings/mezo/about', label: 'Rólam', hint: 'Saját bemutatkozás és javítható források.' },
  { route: '/settings/mezo/communication', label: 'Így beszélj velem', hint: 'Saját instrukció és tanult profil.' },
  { route: '/settings/mezo/context', label: 'Személyes prompt', hint: 'A ténylegesen összeállított személyes blokkok.' },
  { route: '/settings/nap', label: 'Napi ritmus', hint: 'Megosztott alvás- és étkezési horgonyok.' },
  { route: '/settings/general', label: 'Megjelenés és alkalmazás', hint: 'Téma, fiók, kalauz és tulajdonosi funkciók.' },
  { route: '/settings/notifications', label: 'Értesítés-beállítások', hint: 'Kategóriák, időpontok és csendes órák.' },
  { route: '/settings/account', label: 'Fiókadatok', hint: 'A neved és az e-mail-címed javítása.' },
  // ── Nap ──────────────────────────────────────────────────────────────────
  { route: '/nap', label: 'Mai', hint: 'A napod központja: mit csináltál, mi van hátra, hogy vagy.' },
  { route: '/nap/uzenetek', label: 'Beszélgetés', hint: 'Boop üzenetei és a válaszaid egy szálon.' },
  { route: '/nap/rutin', label: 'Rutin', hint: 'A mai szokásaid: mit pipáltál ki, mi maradt.' },
  { route: '/nap/kuldetesek', label: 'Napi küldetések', hint: 'A mai apró feladatok és a jutalmuk.' },
  { route: '/nap/checkin', label: 'Check-in', hint: 'Hogy vagy most — négy lépés, fél perc.' },
  { route: '/nap/gyors', label: 'Gyors logolás', hint: 'Egy mozdulattal rögzíthető dolgok rácsa.' },
  { route: '/nap/eletjel', label: 'Életjel', hint: 'A mai alapjeleid egy helyen.' },
  { route: '/ritual', label: 'Napzárás', hint: 'Az esti zárókör: mit hoztál ma, mi jön holnap.' },

  // ── Edzés ────────────────────────────────────────────────────────────────
  { route: '/train/mai', label: 'Mai edzés', hint: 'A mai nap edzésképe és az indítás.' },
  { route: '/train/session', label: 'Edzés közben', hint: 'A teljes képernyős edzésmód. Csak futó edzés közben nyílik meg.' },
  { route: '/train/week', label: 'Terhelés', hint: 'A heti terhelésed izmonként.' },
  { route: '/train/week/terkep', label: 'Izomtérkép', hint: 'A terhelés testre rajzolva.' },
  { route: '/train/week/mozgas', label: 'Minden mozgásod', hint: 'A hét összes mozgása egy listán.' },
  { route: '/train/week/jelek', label: 'Minden izomjel', hint: 'Amit az izmaid jeleznek — fáradás, elmaradás, túlterhelés.' },
  { route: '/train/sport', label: 'Sport', hint: 'A nem-súlyzós mozgásaid.' },
  { route: '/train/sport/log', label: 'Sport rögzítése', hint: 'Egy sportmozgás felvitele lépésről lépésre.' },
  { route: '/train/futas', label: 'Futás', hint: 'A futásaid és a futóterved.' },
  { route: '/train/exercises', label: 'Gyakorlatok', hint: 'A teljes gyakorlat-katalógus.' },
  { route: '/train/medals', label: 'Medálok', hint: 'Az edzésben szerzett elismeréseid.' },
  { route: '/train/mesocycles', label: 'Terv', hint: 'A futó edzésterved áttekintése.' },
  { route: '/train/mesocycles/new', label: 'Új edzésterv', hint: 'Tervkészítő varázsló, lépésről lépésre.' },
  { route: '/train/mesocycles/konyvtar', label: 'Edzéstervek', hint: 'Minden terved egy könyvtárban.' },
  { route: '/train/mesocycles/futamok', label: 'Lezárt futamaid', hint: 'A befejezett tervek és az eredményük.' },
  { route: '/train/mesocycles/compare', label: 'Két futam összevetése', hint: 'Két lezárt terv egymás mellett.' },
  { route: '/train/templates', label: 'Sablonjaid', hint: 'A mentett edzés-sablonjaid.' },
  { route: '/train/custom/new', label: 'Saját edzés', hint: 'Egyedi edzés összeállítása terv nélkül.' },

  // ── Fuel ─────────────────────────────────────────────────────────────────
  { route: '/fuel', label: 'Mai', hint: 'A mai napod tápértéke és étkezései.' },
  { route: '/fuel/log/uj', label: 'Étel rögzítése', hint: 'Új étkezés felvitele.' },
  { route: '/fuel/trendek', label: 'Trendek', hint: 'Hogyan alakult az étkezésed hetek alatt.' },
  { route: '/fuel/konyha', label: 'Konyha', hint: 'A receptek, a kamra és a műhely bejárata.' },
  { route: '/fuel/recipes', label: 'Receptek', hint: 'A recept-könyvtárad.' },
  { route: '/fuel/recipes/new', label: 'Új recept', hint: 'Recept felvitele kézzel.' },
  { route: '/fuel/recipes/muhely', label: 'Receptműhely', hint: 'Recept építése segítséggel, alapanyagokból.' },
  { route: '/fuel/kamra', label: 'Kamra', hint: 'Ami itthon van — a polcod.' },
  { route: '/fuel/stack', label: 'Kiegészítők', hint: 'A kiegészítőid és a mai adagjaid.' },
  { route: '/fuel/stack/protocol', label: 'Protokoll', hint: 'Mit mikor és mihez veszel be.' },
  { route: '/fuel/stack/manage/add', label: 'Új kiegészítő', hint: 'Termék felvitele és az adagja beállítása.' },
  { route: '/fuel/gyogyszer', label: 'Gyógyszer', hint: 'A gyógyszereid külön nyilvántartva.' },

  // ── Mezo ─────────────────────────────────────────────────────────────────
  { route: '/mezo/rolad', label: 'Rólad', hint: 'Karakter, tudástár és saját kommunikációs kérések.' },
  { route: '/mezo', label: 'Üzenőfal', hint: 'Az öt karakter posztjai: mit vettek észre, és mit kérdeznek tőled.' },
  { route: '/mezo/csapat', label: 'A csapat', hint: 'Az öt karakter szobája: mit figyelnek most, és mennyit tudnak rólad.' },
  { route: '/mezo/emlekek', label: 'Emlékek', hint: 'Napi emlékek, heti memoár és hasonló napok keresése.' },
  { route: '/mezo/patterns', label: 'Minták', hint: 'Az ismétlődő összefüggések a napjaidban.' },
  { route: '/mezo/predictions', label: 'Előrejelzések', hint: 'Mire számíthatsz a jelenlegi irány mellett.' },
  { route: '/mezo/karakter', label: 'Karakter', hint: 'Amit Boop rólad összerakott — a dosszié.' },
  { route: '/mezo/karakter/dimenziok', label: 'Dimenziók', hint: 'A karaktered tengelyei egyenként.' },
  { route: '/mezo/karakter/feed', label: 'Karakter-napló', hint: 'Mikor és mitől változott a képed.' },
  { route: '/mezo/karakter/csapat', label: 'A csapat', hint: 'A belső hangok, akik tanácsot adnak.' },
  { route: '/mezo/karakter/konzilium', label: 'Konzílium', hint: 'A csapat együtt beszéli meg az ügyedet.' },
  { route: '/mezo/karakter/gepterem', label: 'Gépterem', hint: 'Ami a motorháztető alatt történik.' },
  { route: '/mezo/karakter/gepterem/osszes', label: 'Összes funkció', hint: 'A régi teljes menü — minden Boop-eszköz a saját nevén.' },
  { route: '/mezo/karakter/gepterem/futasok', label: 'Futások', hint: 'Az elemzési körök naplója.' },
  { route: '/mezo/karakter/gepterem/adatforrasok', label: 'Adatforrások', hint: 'Miből dolgozik az elemzés.' },
  { route: '/mezo/karakter/gepterem/detektorok', label: 'Detektorok', hint: 'A szabályok, amik a jeleket keresik.' },
  { route: '/mezo/knowledge', label: 'Tudástár', hint: 'Amit Boop tud — és honnan.' },
  { route: '/mezo/memoria', label: 'Memória', hint: 'Mire emlékszik rólad, rétegenként.' },
  { route: '/mezo/memoir', label: 'Memoár', hint: 'A heted története, megírva.' },
  { route: '/mezo/memoir/archivum', label: 'Memoár-archívum', hint: 'A korábbi fejezetek polca.' },
  { route: '/mezo/chat', label: 'Chat', hint: 'Szabad beszélgetés Booppal.' },
  { route: '/mezo/experiments', label: 'N=1 kísérletek', hint: 'Saját kísérletek magadon, mérhető végponttal.' },
  { route: '/mezo/diagnozis', label: 'Diagnózis', hint: 'Kérésre készülő mélyebb jelentések.' },
  { route: '/mezo/coaching', label: 'Proaktív coaching', hint: 'Mit javasol magától, és miért.' },
  { route: '/mezo/coaching/megfigyelo', label: 'Megfigyelő', hint: 'Minden szabály döntése egy napra lebontva.' },
  { route: '/mezo/coaching/kartya', label: 'A napi kártya', hint: 'A mai javaslat — és amit legyőzött.' },

  // ── Én ───────────────────────────────────────────────────────────────────
  { route: '/me', label: 'Áttekintés', hint: 'Az Én-oldal központja.' },
  { route: '/me/weight', label: 'Súly', hint: 'A súlyod alakulása és a naplózás.' },
  { route: '/me/sleep', label: 'Alvás', hint: 'Az alvásod hossza és minősége.' },
  { route: '/me/sleep/night', label: 'Éjszakai mód', hint: 'Sötét, teljes képernyős felület lefekvéshez.' },
  { route: '/me/naplo', label: 'Napló', hint: 'Amit leírsz magadról — döntések, gondolatok.' },
  { route: '/me/week', label: 'A heted', hint: 'A hét pontszáma és a négy részletnézet.' },
  { route: '/me/week/elemzes', label: 'Heti elemzés', hint: 'Mi történt a héten, napról napra.' },
  { route: '/me/week/napok', label: 'A hét napjai', hint: 'A hét hét napja mozaikban.' },
  { route: '/me/week/tanulsagok', label: 'A hét tanulságai', hint: 'Amit érdemes megjegyezni a hétből.' },
  { route: '/me/week/felfedezesek', label: 'Heti felfedezések', hint: 'Az e héten talált új összefüggések.' },
  { route: '/me/goals', label: 'Célok', hint: 'A futó és lezárt céljaid.' },
  { route: '/me/goals/new', label: 'Új cél', hint: 'Célkitűzés varázsló, öt lépésben.' },
  { route: '/me/goals/signals', label: 'Jelek', hint: 'Mi mozdítja a céljaidat — a jelzőszámok.' },
  { route: '/me/goals/weight', label: 'A célod ma', hint: 'A súlycélod mai állása.' },
  { route: '/me/goals/weight/new', label: 'Új súlycél', hint: 'Súlycél tervezése.' },
  { route: '/me/goals/weight/diet', label: 'Mai étrendi keret', hint: 'Mennyit ehetsz ma a célod szerint.' },
  { route: '/me/goals/weight/segment', label: 'Aktuális szakasz', hint: 'A célod jelenlegi szakasza és a tempó.' },
  { route: '/me/goals/weight/plans', label: 'Tervkapcsolatok', hint: 'Hogyan kapcsolódik a célod az edzés- és étrendtervhez.' },
  { route: '/me/goals/weight/guards', label: 'Védőkorlátok', hint: 'A határok, amiket a cél nem léphet át.' },
  { route: '/me/rutin', label: 'Rutinok', hint: 'A szokás-láncaid központja.' },
  { route: '/me/rutin/uj', label: 'Új rutin', hint: 'Szokás-lánc összeállítása.' },
  { route: '/me/rutin/szokasok', label: 'Szokásaid', hint: 'Minden szokásod egy listán.' },
  { route: '/me/growth', label: 'Fejlődés', hint: 'A hosszú távú ívek egy helyen.' },
  { route: '/me/growth/skillek', label: 'Skillek', hint: 'Amiben fejlődsz, szintekkel.' },
  { route: '/me/growth/naplo', label: 'Fejlődés-napló', hint: 'A fejlődésed mérföldkövei.' },
  { route: '/me/growth/kituntetesek', label: 'Kitüntetések', hint: 'Amit eddig kiérdemeltél.' },
  { route: '/me/people', label: 'Emberek', hint: 'Akik számítanak — a köröd.' },
  { route: '/me/people/kor', label: 'A köröm', hint: 'A közeli embereid és a kapcsolat állapota.' },
  { route: '/me/people/jeloltek', label: 'Jelöltek', hint: 'Akiket Boop javasol felvenni a körödbe.' },
  { route: '/me/people/emlitesek', label: 'Említések', hint: 'Kit mikor említettél.' },
  { route: '/me/people/heti', label: 'Heti kép', hint: 'A kapcsolataid heti pillanatképe.' },
  { route: '/me/ertesitesek', label: 'Értesítések', hint: 'Minden értesítésed egy helyen.' },
]

/**
 * Routes deliberately absent from the leltár, each with the reason it is absent.
 *
 * The coverage test reads this: a route may be missing from `PAGE_INDEX` ONLY if it
 * has a written reason here. That is what makes "we forgot one" impossible to
 * confuse with "we decided not to list it".
 */
export const NOT_INDEXED: Record<string, string> = {
  '/train/gym': 'Nyugdíjazott oldal, csak vékony átirányítás maradt belőle (mezo-d20.3.2).',
  '/me/beallitasok/admin': 'Tulajdonosi admin-felület átirányítása, nem felhasználói oldal.',
  '/minden': 'Maga a leltár. Nem listázza önmagát — a területváltó alsó sorából nyílik.',
}

/**
 * Parameterised routes (`/fuel/recipes/:id`) are one INSTANCE of something — one
 * recipe, one exercise, one person — not a distinct surface. They are represented by
 * the list page that opens them, so the leltár stays a map of the app rather than a
 * dump of the database.
 */
export const PARAM_ROUTES_ARE_INSTANCES = true
