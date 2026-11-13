import SwiftUI

// The content of the seven areas. Each one is written as if it were its own product: a highlight worth
// reading, numbers you can act on, a real chart, a composition, detailed rows, and a menu of what else
// the area can do. Invented but realistic data — never the owner's real values.

enum EAreaContent {
    static func tabs(_ metric: Int) -> [ETab] {
        switch metric {
        case 5: return penz
        case 6: return level
        case 1: return alvas
        case 2: return edzes
        case 3: return etel
        case 4: return energia
        default: return forma
        }
    }
    /// How much there is to look at in this area right now — the badge on its card.
    static func badge(_ metric: Int) -> Int { tabs(metric).reduce(0) { $0 + $1.badge } }

    private static let warm = Color(hex: 0xF2994A)

    // ───────────────────────────────────────────── Pénz
    static let penz: [ETab] = [
        ETab(name: "Ma", badge: 2, blocks: [
            .highlight(label: "AMI MA SZÁMÍT", text: "Az éttermek kerete szinte elfogyott",
                       sub: "24 000 Ft a 25 000-ből, és még négy nap van a hétből. A ma esti vacsora otthon 14 500 Ft-ot hagyna a keretben."),
            .stats([EStat(value: "281 600", unit: "Ft", label: "elköltve a hónapban"),
                    EStat(value: "328 400", unit: "Ft", label: "ami még maradt", hot: true),
                    EStat(value: "19 300", unit: "Ft/nap", label: "a mostani tempód", trend: 1)]),
            .curve(label: "A HÓNAP MENETE", values: [0.04, 0.09, 0.12, 0.19, 0.23, 0.26, 0.33, 0.35, 0.37, 0.4, 0.43, 0.44, 0.46],
                   labels: ["1", "", "", "4", "", "", "7", "", "", "10", "", "", "13"],
                   target: 0.43, now: 12,
                   note: "A szaggatott vonal az egyenletes tempó. Három napja fölötte vagy, de még belefér."),
            .composition(label: "MIRE MEGY EL", parts: [
                EPart(name: "Lakás", value: 118_000, color: Color(hex: 0x2E8B57)),
                EPart(name: "Élelmiszer", value: 96_400, color: Color(hex: 0x4FBF86)),
                EPart(name: "Minden más", value: 31_200, color: Color(hex: 0x8FDCB4)),
                EPart(name: "Éttermek", value: 24_000, color: warm),
                EPart(name: "Sport", value: 12_000, color: Color(hex: 0xC9EFD9))],
                note: "A lakás fix. A változó részed 63%-a élelmiszer és étterem."),
            .rowlist(label: "A MAI TÉTELEK", rows: [
                ERow(glyph: "bowl-cream", title: "Spar", sub: "Bevásárlás · 12:06 · a banki üzenetből", right: "8 240", rightSub: "Ft"),
                ERow(glyph: "clock-ink", title: "BKK bérlet", sub: "Közlekedés · 08:14 · ismétlődő", right: "9 500", rightSub: "Ft"),
                ERow(glyph: "honey-sun", title: "Kávézó", sub: "Éttermek · 10:40 · kézzel", right: "1 890", rightSub: "Ft", hot: true)],
                more: "A hónap összes tétele · 84 db"),
            .menu(label: "A PÉNZ TERÜLET", items: [
                EMenuItem(glyph: "plus-ink", name: "Kiadás", sub: "Kézzel, ha nem jött banki üzenet"),
                EMenuItem(glyph: "chart-deep", name: "Keretek", sub: "Havi keretek kategóriánként", badge: 1),
                EMenuItem(glyph: "repeat-deep", name: "Ismétlődők", sub: "Bérlet, biztosítás, előfizetés", badge: 1),
                EMenuItem(glyph: "star-sun", name: "Megtakarítás", sub: "A nyári útra félretett pénz"),
                EMenuItem(glyph: "leaf-sage", name: "Kategóriák", sub: "Mi hova tartozik"),
                EMenuItem(glyph: "book-sage", name: "Kimutatás", sub: "Hónapok, évek, letöltés")]),
            .ask("Kérdezd meg Boopot a költésedről"),
        ]),
        ETab(name: "Keretek", badge: 1, blocks: [
            .highlight(label: "FIGYELEM", text: "Egy keret fut ki a hónap vége előtt",
                       sub: "Az éttermek 96%-on állnak. A lakás is 98%-on, de az fix, azzal nincs teendő."),
            .rowlist(label: "A KERETEID", rows: [
                ERow(glyph: "bowl-cream", title: "Élelmiszer", sub: "96 400 elköltve", right: "150 000", rightSub: "Ft / hó", level: 0.64),
                ERow(glyph: "honey-sun", title: "Éttermek", sub: "24 000 elköltve · szinte elfogyott", right: "25 000", rightSub: "Ft / hó", level: 0.96, badge: 1, hot: true),
                ERow(glyph: "dumbbell-ink", title: "Edzés, sport", sub: "12 000 elköltve", right: "30 000", rightSub: "Ft / hó", level: 0.4),
                ERow(glyph: "clock-ink", title: "Lakás, rezsi", sub: "118 000 elköltve · fix", right: "120 000", rightSub: "Ft / hó", level: 0.98),
                ERow(glyph: "spark-cream", title: "Minden más", sub: "31 200 elköltve", right: "75 000", rightSub: "Ft / hó", level: 0.42)],
                more: "Keret hozzáadása"),
            .note(label: "HOGYAN MŰKÖDIK", body: "Minden hónap elején megkapod a keretet, és naponta látod, hol tartasz hozzá képest. Ha kevesebbet költesz, a maradék átvihető a következő hónapra; ha többet, a hiány levonódik. Semmi nem történik magától — csak látod."),
            .ask("Kérdezd meg Boopot, reálisak-e a keretek"),
        ]),
        ETab(name: "Előzmények", blocks: [
            .stats([EStat(value: "476 000", unit: "Ft", label: "a hat hónap átlaga"),
                    EStat(value: "574 000", unit: "Ft", label: "a legdrágább · október", hot: true),
                    EStat(value: "-18", unit: "%", label: "a novemberi tempó", trend: -1)]),
            .curve(label: "AZ UTOLSÓ HAT HÓNAP", values: [0.71, 0.88, 0.62, 0.79, 0.94, 0.46],
                   labels: ["Jún", "Júl", "Aug", "Szep", "Okt", "Nov"], target: nil, now: 5,
                   note: "A novemberi pont még csak a hónap feléig tart, ezért alacsony."),
            .list(label: "AMIT ÉSZREVETTEM", items: [
                ("Az éttermek a csütörtökök", "A havi étteremköltés 61%-a csütörtökön és pénteken keletkezik."),
                ("A nagy hónapok együtt járnak", "Amikor sokat utaztál, az élelmiszer is 20%-kal nőtt."),
                ("A kis tételek viszik a felét", "A 2 000 Ft alatti vásárlások adják a változó költésed 43%-át.")]),
            .menu(label: "TOVÁBB", items: [
                EMenuItem(glyph: "check-ink", name: "Hónap lezárása", sub: "Novembert 30-án"),
                EMenuItem(glyph: "book-sage", name: "Kimutatás", sub: "Év, kategória, bolt")]),
            .ask("Kérdezd meg Boopot a hónapjaidról"),
        ]),
        ETab(name: "Tervezett", badge: 1, blocks: [
            .level(label: "AMI SZABADON MARAD", big: "54 000", unit: "Ft", right: "17 nap van hátra",
                   note: "A lenti három tétel már le van vonva. Napi 3 100 Ft.", value: 0.3, marker: nil),
            .rowlist(label: "AMI MÉG JÖN", rows: [
                ERow(glyph: "repeat-deep", title: "Biztosítás", sub: "21-én · automatikus", right: "18 000", rightSub: "Ft"),
                ERow(glyph: "dumbbell-ink", title: "Edzőbérlet", sub: "25-én · automatikus", right: "12 000", rightSub: "Ft"),
                ERow(glyph: "shoe-cream", title: "Futócipő", sub: "Még nem döntöttél · a reggeli levélből", right: "30 590", rightSub: "Ft", badge: 1, hot: true)],
                more: "Tétel hozzáadása"),
            .note(label: "HA MEGVESZED A CIPŐT", body: "5 400 Ft marad a hónapból. Ha a hétvégi éttermet kihagyod, az 12 000 Ft, és akkor kényelmes."),
            .ask("Kérdezd meg Boopot, belefér-e"),
        ]),
    ]

    // ───────────────────────────────────────────── Levél
    static let level: [ETab] = [
        ETab(name: "Ma", badge: 2, blocks: [
            .highlight(label: "MEGÉR EGY PERCET", text: "A futócipő, amit figyelsz, ma tényleg olcsó",
                       sub: "30 590 Ft. Négy boltot néztem meg: a szokásos ára 38 400, a legolcsóbb másik 36 900. Ez az eddigi legjobb ár, amit láttam rá."),
            .stats([EStat(value: "34", unit: "levél", label: "érkezett reggel óta"),
                    EStat(value: "31", unit: "", label: "elintéztem helyetted"),
                    EStat(value: "2", unit: "", label: "megér egy percet", hot: true)]),
            .heat(label: "MIKOR ÉRKEZIK", cells: [("6", 0.1), ("8", 0.9), ("10", 0.45), ("12", 0.3), ("14", 0.6), ("16", 0.25), ("18", 0.15), ("20", 0.05)],
                  note: "A legtöbb reklám 8 és 9 között jön — ezért nézek bele 08:00-kor. A második futás 15:00-kor."),
            .mail(label: "AMIT NÉZZ MEG", items: [
                MailItem(from: "Futóbolt", what: "A kinézett futócipő 32%-kal olcsóbb", score: 9,
                         price: "30 590 Ft. Négy boltban néztem meg: a szokásos ára 38 400 Ft, a legolcsóbb máshol most 36 900 Ft.",
                         goal: "A mostani cipőd 780 km-nél jár, és a nyári célodhoz heti három futás kell.", verdict: 0),
                MailItem(from: "Fehérjebolt", what: "Akció a szokásos fehérjeporodra", score: 6,
                         price: "12 990 Ft 2 kg-ra. Pontosan ugyanannyi, mint amennyiért márciusban vetted — ez nem akció.",
                         goal: "Van még kb. három heted a jelenlegi zacskóból, nem sürgős.", verdict: 1)]),
            .rowlist(label: "AMIT ELINTÉZTEM HELYETTED", rows: [
                ERow(glyph: "e-level", title: "Hírlevelek", sub: "Elolvastam, egyik sem kötődik a céljaidhoz", right: "14", rightSub: ""),
                ERow(glyph: "honey-sun", title: "Reklám", sub: "Márkák, amiket sosem nyitsz meg", right: "11", rightSub: ""),
                ERow(glyph: "check-ink", title: "Számlák, értesítők", sub: "Rendben vannak, semmi teendő", right: "4", rightSub: ""),
                ERow(glyph: "scale-ink", title: "Belépési kódok", sub: "Ezekbe nem néztem bele, és nem is küldtem sehova", right: "2", rightSub: "")],
                more: "A mai posta teljes listája"),
            .menu(label: "A LEVÉL TERÜLET", items: [
                EMenuItem(glyph: "star-sun", name: "Figyelt", sub: "Termékek, amikre szólok", badge: 3),
                EMenuItem(glyph: "scale-ink", name: "Szabályok", sub: "Mibe nézhet bele és mibe nem"),
                EMenuItem(glyph: "person-sage", name: "Fiókok", sub: "Gmail és iCloud"),
                EMenuItem(glyph: "clock-ink", name: "Időzítés", sub: "Mikor fusson, mikor szóljon"),
                EMenuItem(glyph: "search-ink", name: "Keresés", sub: "Az eddigi összefoglalókban"),
                EMenuItem(glyph: "chart-deep", name: "Árnapló", sub: "Amit a Boop eddig látott")]),
            .ask("Kérdezd meg Boopot a mai postáról"),
        ]),
        ETab(name: "Figyelt", badge: 3, blocks: [
            .note(label: "MIT FIGYELEK", body: "Megmondod, mi érdekel, és csak akkor szólok, ha az ár tényleg alacsonyabb, mint amit máshol látok — nem akkor, ha csak rá van írva, hogy akció."),
            .rowlist(label: "AMIKET FIGYELEK", rows: [
                ERow(glyph: "shoe-cream", title: "Futócipő · 42-es", sub: "Ma jött rá a legjobb ár", right: "30 590", rightSub: "Ft · ma", badge: 1, hot: true),
                ERow(glyph: "bowl-cream", title: "Fehérjepor · vanília 2 kg", sub: "Idei legolcsóbb: augusztus", right: "11 400", rightSub: "Ft"),
                ERow(glyph: "scale-ink", title: "Okosmérleg", sub: "Hat hete figyelem, még nem volt olcsó", right: "—", rightSub: "")],
                more: "Új figyelés"),
            .curve(label: "A FUTÓCIPŐ ÁRA, AMIÓTA FIGYELEM", values: [0.95, 0.92, 0.98, 0.9, 0.93, 0.88, 0.95, 0.62],
                   labels: ["Szep", "", "Okt", "", "", "Nov", "", "ma"], target: nil, now: 7,
                   note: "Ezt a Boop a hozzád érkező levelekből gyűjti. Pár hónap alatt saját áremlékezete lesz a te termékeidről."),
            .ask("Kérdezd meg Boopot, mikor érdemes venni"),
        ]),
        ETab(name: "Szabályok", blocks: [
            .highlight(label: "A LÉNYEG", text: "A személyes leveleidbe gép nem néz bele",
                       sub: "Bank, biztosító, hivatal, orvosi levél és belépési kód sosem kerül gépi elemzésbe. Csak annyit mondok róluk, hogy megérkeztek."),
            .rowlist(label: "AMIBE SOSEM NÉZEK BELE", rows: [
                ERow(glyph: "scale-ink", title: "Bank, biztosító, hivatal", sub: "Csak jelzem, hogy jött", right: "", rightSub: ""),
                ERow(glyph: "check-ink", title: "Belépési kódok", sub: "Felismerem a feladóról, azonnal félreteszem", right: "", rightSub: ""),
                ERow(glyph: "heart-cream", title: "Orvosi, egészségügyi", sub: "Csak ha külön megkéred", right: "", rightSub: "")],
                more: ""),
            .note(label: "AMIT TÖRLÖK, MIELŐTT BÁRMI TÖRTÉNNE", body: "A nyomkövető képeket, a téged azonosító linkeket, a rendelési számokat és a saját e-mail-címedet. Ami a gépi elemzéshez eljut, az a reklámszöveg, a terméknév és az ár — vagyis az, amit több millió másik embernek is kiküldtek."),
            .menu(label: "BEÁLLÍTÁSOK", items: [
                EMenuItem(glyph: "person-sage", name: "Feladó tiltása", sub: "Akitől sosem akarsz hallani"),
                EMenuItem(glyph: "plus-ink", name: "Új szabály", sub: "Téma, feladó vagy kulcsszó")]),
            .ask("Kérdezd meg Boopot, mit lát a leveleidből"),
        ]),
        ETab(name: "Fiókok", blocks: [
            .rowlist(label: "A POSTAFIÓKJAID", rows: [
                ERow(glyph: "e-level", title: "Gmail", sub: "Csak olvasás · utoljára 08:00-kor", right: "aktív", rightSub: ""),
                ERow(glyph: "e-level", title: "iCloud", sub: "Csak olvasás · utoljára 08:00-kor", right: "aktív", rightSub: "")],
                more: "Fiók hozzáadása"),
            .note(label: "HOGYAN KAPCSOLÓDIK", body: "Mindkét fiókhoz te hozol létre egy külön kulcsot a saját fiókod beállításaiban, és te írod be — a jelszavadat soha nem kérem és nem látom. A kulcs bármikor visszavonható, és akkor a Boop azonnal elveszti a hozzáférést."),
            .heat(label: "MENNYI JÖN NAPONTA", cells: [("H", 0.6), ("K", 0.74), ("Sze", 0.52), ("Cs", 0.91), ("P", 0.68), ("Szo", 0.3), ("V", 0.22)],
                  note: "Hetente átlagosan 212 levél. Ebből 14 volt az, amit tényleg megnyitottál."),
            .ask("Kérdezd meg Boopot a postafiókjaidról"),
        ]),
    ]

    // ───────────────────────────────────────────── Étel
    static let etel: [ETab] = [
        ETab(name: "Ma", badge: 1, blocks: [
            .highlight(label: "AMI MA SZÁMÍT", text: "A fehérje megint elmarad",
                       sub: "38 g a 165-ből, ebéd után. A vacsoránál legalább 50 grammra lesz szükség — egy csirkés tál pont ennyit hoz."),
            .stats([EStat(value: "1 180", unit: "kcal", label: "a 2 350-ből"),
                    EStat(value: "38", unit: "g", label: "fehérje a 165-ből", trend: -1, hot: true),
                    EStat(value: "2", unit: "étkezés", label: "eddig, a négyből")]),
            .curve(label: "A NAP MENETE", values: [0, 0.04, 0.17, 0.18, 0.2, 0.5, 0.5, 0.52, 0.72, 0.95],
                   labels: ["6", "8", "", "10", "12", "", "14", "16", "18", "20"],
                   target: 1.0, now: 4,
                   note: "A görbe vége a mai terv: a vacsora után éred el a keretet."),
            .composition(label: "MAKRÓK MA", parts: [
                EPart(name: "Fehérje", value: 38, color: Color(hex: 0x4FBF86)),
                EPart(name: "Szénhidrát", value: 142, color: Color(hex: 0xA6E8C8)),
                EPart(name: "Zsír", value: 41, color: Color(hex: 0xF4C860))],
                note: "A fehérje aránya ma 16% — a célod 28% körül van."),
            .rowlist(label: "AMIT MA ETTÉL", rows: [
                ERow(glyph: "bowl-cream", title: "Zabkása áfonyával", sub: "Reggeli · 08:20 · fotóval", right: "410", rightSub: "kcal · 32 g"),
                ERow(glyph: "honey-sun", title: "Kávé tejjel", sub: "Nasi · 10:40", right: "150", rightSub: "kcal · 4 g"),
                ERow(glyph: "plate-deep", title: "Csirke rizzsel, salátával", sub: "Ebéd · 12:40 · fotóval", right: "620", rightSub: "kcal · 46 g"),
                ERow(glyph: "fish-peach", title: "Vacsora", sub: "19:45 · még nincs · Boop: 50 g fehérje", right: "—", rightSub: "", hot: true)],
                more: "A hét összes étkezése"),
            .menu(label: "AZ ÉTEL TERÜLET", items: [
                EMenuItem(glyph: "camera-ink", name: "Fotóval", sub: "Lefotózod, a Boop felismeri"),
                EMenuItem(glyph: "search-ink", name: "Vonalkód", sub: "Bolti termék egy pillanat alatt"),
                EMenuItem(glyph: "book-sage", name: "Receptek", sub: "A sajátjaid és amit ajánlok", badge: 3),
                EMenuItem(glyph: "leaf-sage", name: "Kamra", sub: "Mi van itthon", badge: 4),
                EMenuItem(glyph: "drop-sky", name: "Víz", sub: "1,4 l a 2,5-ből ma"),
                EMenuItem(glyph: "flame-peach", name: "Kiegészítők", sub: "A napi stackod · 2 maradt", badge: 2)]),
            .ask("Kérdezd meg Boopot az étkezésedről"),
        ]),
        ETab(name: "Receptek", badge: 3, blocks: [
            .highlight(label: "AMI MA BEFÉRNE", text: "Három recept, ami pont a hiányzó fehérjét hozza",
                       sub: "Mindhárom belefér a mai maradék keretbe, és kettőhöz minden megvan a kamrádban."),
            .rowlist(label: "VACSORÁRA", rows: [
                ERow(glyph: "plate-deep", title: "Csirkés tál édesburgonyával", sub: "25 perc · minden megvan itthon", right: "640", rightSub: "kcal · 52 g", badge: 1, hot: true),
                ERow(glyph: "fish-peach", title: "Tonhalas tészta", sub: "18 perc · a tonhal hiányzik", right: "580", rightSub: "kcal · 46 g"),
                ERow(glyph: "bowl-cream", title: "Túrós-tojásos rakott", sub: "30 perc · minden megvan itthon", right: "520", rightSub: "kcal · 48 g")],
                more: "Az összes recepted · 42 db"),
            .menu(label: "TOVÁBB", items: [
                EMenuItem(glyph: "plus-ink", name: "Új recept", sub: "Kézzel vagy linkből"),
                EMenuItem(glyph: "star-sun", name: "Kedvencek", sub: "Amit sűrűn főzöl"),
                EMenuItem(glyph: "leaf-sage", name: "Bevásárlólista", sub: "A hét receptjeiből", badge: 1),
                EMenuItem(glyph: "scale-ink", name: "Allergének", sub: "Amit kerülsz")]),
            .ask("Kérdezd meg Boopot, mit főzz"),
        ]),
        ETab(name: "Kamra", badge: 4, blocks: [
            .stats([EStat(value: "34", unit: "tétel", label: "van itthon"),
                    EStat(value: "4", unit: "", label: "a héten lejár", hot: true),
                    EStat(value: "9", unit: "", label: "a bevásárlólistán")]),
            .rowlist(label: "AMI HAMAROSAN LEJÁR", rows: [
                ERow(glyph: "bowl-cream", title: "Görög joghurt", sub: "2 pohár", right: "2", rightSub: "nap", badge: 1, hot: true),
                ERow(glyph: "leaf-sage", title: "Spenót", sub: "1 zacskó", right: "3", rightSub: "nap"),
                ERow(glyph: "fish-peach", title: "Csirkemell", sub: "Fagyasztóban · 400 g", right: "—", rightSub: "")],
                more: "A teljes kamra · 34 tétel"),
            .ask("Kérdezd meg Boopot, mit főzz abból, ami itthon van"),
        ]),
        ETab(name: "Hét", blocks: [
            .curve(label: "FEHÉRJE A HÉTEN", values: [0.9, 0.72, 0.55, 0.23, 0.8, 0.66, 0.5],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: 1.0, now: 3,
                   note: "14 napból 9-en maradtál a cél alatt, átlagosan 22 grammal. Ez a nyári célod legnagyobb fékje."),
            .heat(label: "MIKOR ESZEL", cells: [("H", 0.6), ("K", 0.7), ("Sze", 0.5), ("Cs", 0.8), ("P", 0.4), ("Szo", 0.9), ("V", 0.3)],
                  note: "A sötétebb nap azt jelenti, hogy későbbre csúsztak az étkezések. A késői vacsorák után 24 perccel kevesebbet alszol."),
            .ask("Kérdezd meg Boopot a heti étkezésedről"),
        ]),
    ]

    // ───────────────────────────────────────────── Edzés
    static let edzes: [ETab] = [
        ETab(name: "Ma", badge: 1, blocks: [
            .highlight(label: "MA ESTE", text: "Felsőtest · a mezociklus 3. hete",
                       sub: "75 perc, öt gyakorlat. A fekvenyomásnál 2,5 kg-mal többet javaslok, mert múlt héten mindhárom sorozat könnyen ment."),
            .stats([EStat(value: "1 240", unit: "lépés", label: "a napi 8 000-ből", trend: -1),
                    EStat(value: "75", unit: "perc", label: "a mai edzés", hot: true),
                    EStat(value: "3/6", unit: "", label: "a mezociklus hete")]),
            .rowlist(label: "A MAI EDZÉS", rows: [
                ERow(glyph: "dumbbell-ink", title: "Fekvenyomás", sub: "3 sorozat · 8 ismétlés", right: "72,5", rightSub: "kg · +2,5", badge: 1, hot: true),
                ERow(glyph: "dumbbell-ink", title: "Evezés", sub: "3 sorozat · 10 ismétlés", right: "60", rightSub: "kg"),
                ERow(glyph: "dumbbell-ink", title: "Vállból nyomás", sub: "3 sorozat · 10 ismétlés", right: "32,5", rightSub: "kg"),
                ERow(glyph: "dumbbell-ink", title: "Húzódzkodás", sub: "3 sorozat · amennyi megy", right: "+5", rightSub: "kg"),
                ERow(glyph: "dumbbell-ink", title: "Bicepsz", sub: "2 sorozat · 12 ismétlés", right: "14", rightSub: "kg")],
                more: "Edzés indítása"),
            .curve(label: "HETI TERHELÉS", values: [0.8, 0.05, 0.62, 0.75, 0.05, 0.9, 0.05],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: nil, now: 3,
                   note: "Heti három edzés és egy hosszú futás — ez a nyári célod alapterhelése."),
            .menu(label: "AZ EDZÉS TERÜLET", items: [
                EMenuItem(glyph: "bolt-sun", name: "Indítás", sub: "A mai edzés, sorozatról sorozatra"),
                EMenuItem(glyph: "chart-deep", name: "Edzésterv", sub: "A mezociklusod · 3. hét", badge: 1),
                EMenuItem(glyph: "ball-sun", name: "Gyakorlatok", sub: "128 gyakorlat, saját súlyokkal"),
                EMenuItem(glyph: "shoe-cream", name: "Futás", sub: "A heti futóblokkod"),
                EMenuItem(glyph: "medal-sun", name: "Rekordok", sub: "A legjobbjaid"),
                EMenuItem(glyph: "book-sage", name: "Előzmények", sub: "Minden eddigi edzés")]),
            .ask("Kérdezd meg Boopot a mai edzésről"),
        ]),
        ETab(name: "Terv", badge: 1, blocks: [
            .level(label: "A MEZOCIKLUSOD", big: "3", unit: "/ 6 hét", right: "Felsőtest-alsótest · 4 nap",
                   note: "A negyedik hét a legnehezebb, az ötödik a csúcs, a hatodik könnyű. Utána méred magad.",
                   value: 0.5, marker: nil),
            .rowlist(label: "A HÉT NAPJAI", rows: [
                ERow(glyph: "dumbbell-ink", title: "Hétfő · Láb", sub: "68 perc · kész", right: "✓", rightSub: ""),
                ERow(glyph: "shoe-cream", title: "Szerda · Futás", sub: "6,4 km · 5:48 / km", right: "✓", rightSub: ""),
                ERow(glyph: "dumbbell-ink", title: "Csütörtök · Felsőtest", sub: "Ma 18:30-kor", right: "ma", rightSub: "", badge: 1, hot: true),
                ERow(glyph: "shoe-cream", title: "Szombat · Hosszú futás", sub: "10 km · tervezett", right: "", rightSub: "")],
                more: "A teljes mezociklus"),
            .ask("Kérdezd meg Boopot az edzéstervedről"),
        ]),
        ETab(name: "Gyakorlatok", blocks: [
            .rowlist(label: "A LEGTÖBBET HASZNÁLTAK", rows: [
                ERow(glyph: "dumbbell-ink", title: "Fekvenyomás", sub: "48 alkalom · utoljára múlt csütörtök", right: "70", rightSub: "kg · rekord 75"),
                ERow(glyph: "dumbbell-ink", title: "Guggolás", sub: "44 alkalom · utoljára hétfő", right: "95", rightSub: "kg · rekord 100"),
                ERow(glyph: "dumbbell-ink", title: "Felhúzás", sub: "31 alkalom", right: "110", rightSub: "kg · rekord 115")],
                more: "Mind a 128 gyakorlat"),
            .ask("Kérdezd meg Boopot egy gyakorlatról"),
        ]),
        ETab(name: "Előzmények", blocks: [
            .curve(label: "A FUTÓIDŐD ALAKULÁSA", values: [0.8, 0.82, 0.78, 0.7, 0.66, 0.6],
                   labels: ["6 hete", "", "4 hete", "", "2 hete", "most"], target: nil, now: 5,
                   note: "Három hete lassulsz, átlagosan 14 másodperccel kilométerenként. A cipőd 780 km-nél jár."),
            .list(label: "AMIT ÉSZREVETTEM", items: [
                ("A lábnapok stabilak", "Nyolc hete nem hagytál ki egyet sem."),
                ("Az esti edzés nem rontja az alvásod", "A 20:00 után végzett edzések után is 7 óra fölött alszol."),
                ("A rossz alvás utáni napon gyengébb vagy", "Hat óra alatti alvás után átlagosan 8%-kal kevesebbet emelsz.")]),
            .ask("Kérdezd meg Boopot a fejlődésedről"),
        ]),
    ]

    // ───────────────────────────────────────────── Alvás
    static let alvas: [ETab] = [
        ETab(name: "Ma", blocks: [
            .highlight(label: "AZ ÉJSZAKA", text: "Kipihented magad",
                       sub: "7 óra 12 perc, ebből 1 óra 36 perc mély. 22:48-kor aludtál el, 12 perccel korábban, mint szoktál."),
            .stats([EStat(value: "7ó 12p", unit: "", label: "a 7,5 órás célból", hot: true),
                    EStat(value: "1ó 36p", unit: "", label: "mély alvás", trend: 1),
                    EStat(value: "52", unit: "", label: "nyugalmi pulzus", trend: -1)]),
            .curve(label: "AZ ÉJSZAKA MENETE", values: [0.3, 0.85, 0.9, 0.5, 0.75, 0.4, 0.6, 0.25, 0.15],
                   labels: ["23", "", "1", "", "3", "", "5", "", "7"], target: nil, now: nil,
                   note: "A magasabb szakaszok a mély alvás. A második és harmadik óra volt a legmélyebb."),
            .menu(label: "AZ ALVÁS TERÜLET", items: [
                EMenuItem(glyph: "bell-cream", name: "Lefekvés", sub: "Emlékeztető 22:15-kor"),
                EMenuItem(glyph: "chart-deep", name: "Előzmények", sub: "Hetek, hónapok"),
                EMenuItem(glyph: "heart-cream", name: "Pulzus", sub: "Éjszakai pulzus és HRV"),
                EMenuItem(glyph: "moon-cream", name: "Mi hat rá", sub: "Vacsora, naptár, edzés")]),
            .ask("Kérdezd meg Boopot az alvásodról"),
        ]),
        ETab(name: "Hét", blocks: [
            .curve(label: "A HÉT ÉJSZAKÁI", values: [0.7, 0.75, 0.6, 0.8, 0.72, 0.9, 0.82],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: 0.85, now: 3,
                   note: "A heti átlagod 7 óra 4 perc. A legrövidebb szerda volt, a sűrű naptárú nap után."),
            .list(label: "AMI HATOTT RÁ", items: [
                ("A késői vacsora", "A 20:30 utáni vacsorák után átlagosan 24 perccel kevesebbet alszol."),
                ("A sűrű naptár", "A hat eseménynél zsúfoltabb napok után a mély alvásod 18 perccel rövidebb."),
                ("Az esti edzés", "A 20:00 után befejezett edzések nem rontották el — ez nálad nem gond.")]),
            .ask("Kérdezd meg Boopot, mitől alszol jobban"),
        ]),
        ETab(name: "Előzmények", blocks: [
            .curve(label: "AZ UTOLSÓ HAT HÉT", values: [0.62, 0.7, 0.58, 0.75, 0.8, 0.84],
                   labels: ["41", "42", "43", "44", "45", "46"], target: 0.85, now: 5,
                   note: "Hat hét alatt az átlagod 6 óra 38 percről 7 óra 4 percre nőtt."),
            .ask("Kérdezd meg Boopot a hosszú távú alvásodról"),
        ]),
    ]

    // ───────────────────────────────────────────── Energia
    static let energia: [ETab] = [
        ETab(name: "Ma", badge: 1, blocks: [
            .highlight(label: "AMI MA SZÁMÍT", text: "Kicsit feszült vagy",
                       sub: "A délelőtti check-inben 4-es feszültséget jelöltél, és hat megbeszélés van a naptáradban. A délutáni check-in 16:00-kor jön."),
            .stats([EStat(value: "7", unit: "/10", label: "energia"),
                    EStat(value: "8", unit: "/10", label: "hangulat"),
                    EStat(value: "4", unit: "/10", label: "feszültség", trend: 1, hot: true)]),
            .curve(label: "A NAP ENERGIÁJA", values: [0.5, 0.7, 0.8, 0.72, 0.55, 0.45, 0.6, 0.7, 0.5],
                   labels: ["6", "8", "10", "12", "14", "16", "18", "20", "22"], target: nil, now: 4,
                   note: "A 14 óra körüli gödör minden sűrű napon megjelenik nálad. Egy rövid séta ebéd után szokta átvinni."),
            .heat(label: "A NAPTÁRAD SŰRŰSÉGE", cells: [("9", 0.8), ("10", 0.95), ("11", 0.6), ("12", 0.1), ("13", 0.0), ("14", 0.7), ("15", 0.75), ("16", 0.5), ("17", 0.3)],
                  note: "Hat esemény 9 és 17:30 között. A 10:30-as blokk a legsűrűbb."),
            .menu(label: "AZ ENERGIA TERÜLET", items: [
                EMenuItem(glyph: "pen-sun", name: "Check-in", sub: "Három kérdés, fél perc", badge: 1),
                EMenuItem(glyph: "chart-deep", name: "Előzmények", sub: "Napok, hetek"),
                EMenuItem(glyph: "spark-cream", name: "Minták", sub: "Mi hoz le és mi emel"),
                EMenuItem(glyph: "bell-cream", name: "Emlékeztetők", sub: "Mikor kérdezzen")]),
            .ask("Kérdezd meg Boopot a közérzetedről"),
        ]),
        ETab(name: "Check-inek", blocks: [
            .curve(label: "ENERGIA A HÉTEN", values: [0.7, 0.6, 0.45, 0.7, 0.55, 0.85, 0.8],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: nil, now: 3,
                   note: "Szerda volt a mélypont — a legzsúfoltabb nap, a legrövidebb alvás után."),
            .ask("Kérdezd meg Boopot az energiádról"),
        ]),
        ETab(name: "Minták", blocks: [
            .list(label: "AMIT ÉSZREVETTEM", items: [
                ("A zsúfolt napok ára", "A hat eseménynél sűrűbb napokon a feszültséged átlagosan 2 ponttal magasabb."),
                ("Az edzés utáni nap", "Edzés utáni reggeleken az energiád átlagosan 1,4 ponttal jobb."),
                ("A hétvége", "Szombaton a legjobb a közérzeted — nyolc hete minden alkalommal.")]),
            .ask("Kérdezd meg Boopot a mintáidról"),
        ]),
    ]

    // ───────────────────────────────────────────── Forma
    static let forma: [ETab] = [
        ETab(name: "Ma", blocks: [
            .highlight(label: "A MAI FORMÁD", text: "Jó napod lesz",
                       sub: "A mélyalvásod 18 perccel a heti átlag felett volt, a pulzusváltozékonyságod rendben. A 18:30-as edzés belefér."),
            .stats([EStat(value: "78", unit: "/100", label: "ma", hot: true),
                    EStat(value: "74", unit: "", label: "a heti átlagod", trend: 1),
                    EStat(value: "+4", unit: "", label: "a tegnapihoz képest", trend: 1)]),
            .rowlist(label: "MI HAT RÁ MA", rows: [
                ERow(glyph: "moon-cream", title: "Alvás", sub: "7ó 12p, ebből 1ó 36p mély — ez emeli", right: "84", rightSub: "", level: 0.84),
                ERow(glyph: "heart-cream", title: "Energia", sub: "A délelőtti feszültség 4 volt — ez húzza le", right: "69", rightSub: "", level: 0.69),
                ERow(glyph: "dumbbell-ink", title: "Edzés", sub: "1 240 lépés eddig — ez húzza le", right: "62", rightSub: "", level: 0.62),
                ERow(glyph: "e-penz", title: "Pénz", sub: "A kereten belül vagy — nem terhel", right: "74", rightSub: "", level: 0.74)],
                more: ""),
            .ask("Kérdezd meg Boopot a formádról"),
        ]),
        ETab(name: "Mi hat rá", blocks: [
            .curve(label: "A FORMÁD A HÉTEN", values: [0.72, 0.7, 0.58, 0.78, 0.68, 0.82, 0.8],
                   labels: ["H", "K", "Sze", "Cs", "P", "Szo", "V"], target: 0.75, now: 3,
                   note: "Szerda volt a leggyengébb nap: rövid alvás és zsúfolt naptár együtt."),
            .note(label: "HOGYAN SZÁMOLOM", body: "A Forma nem orvosi mérőszám, hanem a te saját előzményeidhez képest mutatja, mire vagy ma képes: az alvásodból, a pulzusváltozékonyságodból, az elmúlt napok terheléséből és abból, amit a check-inekben mondtál."),
            .ask("Kérdezd meg Boopot, mi befolyásolja"),
        ]),
    ]
}
