import SwiftUI

// Round 2: every area gets its OWN full dashboard page with inner top tabs — "as if that area were its own app"
// (owner, 2026-11-13). One page component, data-driven, so all seven areas are real rather than placeholders.

// MARK: - The content language of an area page

enum EBlock {
    /// the headline number with a level bar; `marker` draws the white "where you should be" waterline
    case level(label: String, big: String, unit: String, right: String, note: String, value: Double, marker: Double?)
    /// seven (or n) days as bars
    case week(label: String, days: [(String, Double, Bool)], note: String)
    /// named rows with their own small level bars
    case rows(label: String, items: [(String, String, String, Double)])
    /// plain list rows without bars
    case list(label: String, items: [(String, String)])
    /// a paragraph
    case note(label: String, body: String)
    /// the mail digest items
    case mail(label: String, items: [MailItem])
    /// pills + the thread door
    case actions(primary: String, secondary: String, ask: String)
}

struct ETab { let name: String; let blocks: [EBlock] }

struct MailItem: Identifiable {
    let id = UUID()
    let from: String, what: String, score: Int
    let price: String, goal: String
    let verdict: Int          // 0 cheaper · 1 usual · 2 unknown
    var verdictText: String { ["Olcsóbb, mint máshol", "A szokásos ára", "Nem tudtam ellenőrizni"][verdict] }
    var verdictHue: Color { [Color(hex: 0x5FD08A), Color(hex: 0xE8C25A), Color(hex: 0x9AA3AE)][verdict] }
}

// MARK: - The page

struct EletAreaPage: View {
    var metric: Int
    var onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var tab = 0

    private var m: EMetric { EMetric.all[min(metric, 6)] }
    private var tabs: [ETab] { EAreaContent.tabs(metric) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                head
                tabBar.padding(.top, 14)
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(Array(tabs[min(tab, tabs.count - 1)].blocks.enumerated()), id: \.offset) { _, b in
                        block(b)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 70)
                .id(tab)
                .transition(.opacity)
            }
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(m.top).ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
        .toolbar(.hidden, for: .navigationBar)
        .overlay(alignment: .topLeading) { backButton { dismiss() } }
    }

    private var head: some View {
        GHead(sky: m.sky, height: 290)
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        EGlyph(m.glyph, .white, size: 20)
                        Text(m.name.uppercased()).font(AuraFont.mono(12, .bold)).tracking(2).foregroundStyle(.white.opacity(0.8))
                        Spacer()
                        StillOrb(colors: m.orb, size: 34, level: Double(m.value) / 100)
                    }
                    Text(m.headline).font(AuraFont.serif(34)).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(m.sentence).font(.system(size: 15.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 20).padding(.bottom, 6)
            }
    }

    /// The area's own top tabs — the thing that makes it feel like its own app.
    private var tabBar: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(tabs.indices, id: \.self) { i in
                    let on = i == tab
                    Text(tabs[i].name)
                        .font(.system(size: 14.5, weight: on ? .semibold : .regular))
                        .foregroundStyle(on ? gBase : .white.opacity(0.75))
                        .padding(.horizontal, 15).frame(height: 38)
                        .background(Capsule().fill(on ? .white : .white.opacity(0.1)))
                        .contentShape(Capsule())
                        .onTapGesture { withAnimation(.easeInOut(duration: 0.22)) { tab = i } }
                }
            }
            .padding(.horizontal, 16)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: Blocks

    @ViewBuilder private func block(_ b: EBlock) -> some View {
        switch b {
        case let .level(label, big, unit, right, note, value, marker):
            card {
                GLabel(label)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(big).font(.custom("Outfit", size: 38).weight(.light)).foregroundStyle(.white)
                    Text(unit).font(.system(size: 15)).foregroundStyle(.white.opacity(0.6))
                    Spacer()
                    Text(right).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                }
                .padding(.top, 10)
                ELevelBar(level: value, hue: m.glow, marker: marker).padding(.top, 10)
                if !note.isEmpty {
                    Text(note).font(.system(size: 12.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.55))
                        .fixedSize(horizontal: false, vertical: true).padding(.top, 8)
                }
            }
        case let .week(label, days, note):
            card {
                GLabel(label)
                HStack(alignment: .bottom, spacing: 9) {
                    ForEach(Array(days.enumerated()), id: \.offset) { _, d in
                        VStack(spacing: 8) {
                            ZStack(alignment: .bottom) {
                                RoundedRectangle(cornerRadius: 7).fill(.white.opacity(0.08)).frame(height: 100)
                                RoundedRectangle(cornerRadius: 7)
                                    .fill(LinearGradient(colors: [m.glow.opacity(0.55), m.glow], startPoint: .bottom, endPoint: .top))
                                    .frame(height: max(8, 100 * d.1))
                                    .shadow(color: d.2 ? m.glow.opacity(0.8) : .clear, radius: 10)
                            }
                            Text(d.0).font(.system(size: 11.5, weight: d.2 ? .bold : .regular))
                                .foregroundStyle(.white.opacity(d.2 ? 1 : 0.6))
                        }
                    }
                }
                .padding(.top, 12)
                if !note.isEmpty {
                    Text(note).font(.system(size: 13)).lineSpacing(3).foregroundStyle(.white.opacity(0.65))
                        .fixedSize(horizontal: false, vertical: true).padding(.top, 12)
                }
            }
        case let .rows(label, items):
            card {
                GLabel(label)
                VStack(alignment: .leading, spacing: 15) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                        VStack(alignment: .leading, spacing: 7) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(it.0).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                                Spacer()
                                Text(it.1).font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.65))
                            }
                            ELevelBar(level: min(1, it.3), hue: it.3 > 0.85 ? Color(hex: 0xF2994A) : m.glow)
                            if !it.2.isEmpty {
                                Text(it.2).font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                            }
                        }
                    }
                }
                .padding(.top, 14)
            }
        case let .list(label, items):
            card {
                GLabel(label)
                VStack(alignment: .leading, spacing: 13) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                        HStack(alignment: .top, spacing: 12) {
                            Circle().fill(m.glow.opacity(0.7)).frame(width: 6, height: 6).padding(.top, 6)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(it.0).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white.opacity(0.95))
                                Text(it.1).font(.system(size: 13)).lineSpacing(3).foregroundStyle(.white.opacity(0.6))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
                .padding(.top, 14)
            }
        case let .note(label, body):
            card {
                GLabel(label)
                Text(body).font(.system(size: 14.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 10)
            }
        case let .mail(label, items):
            VStack(alignment: .leading, spacing: 12) {
                GLabel(label)
                ForEach(items) { mailCard($0) }
            }
        case let .actions(primary, secondary, ask):
            card {
                GLabel("AMIT TEHETSZ")
                HStack(spacing: 10) {
                    EPill(title: primary) { onToast(primary + " · megnyílik") }
                    EPill(title: secondary, primary: false) { onToast(secondary + " · megnyílik") }
                    Spacer(minLength: 0)
                }
                .padding(.top, 12)
                EAskRow(text: ask) { onToast("Új szál nyílik · a terület adataival") }
                    .padding(.top, 12)
            }
        }
    }

    @ViewBuilder private func card<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 0) { c() }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
    }

    private func mailCard(_ it: MailItem) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(it.from.uppercased()).font(AuraFont.mono(11, .bold)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                    Text(it.what).font(AuraFont.serif(20)).lineSpacing(3).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 10)
                EScore(n: it.score, hue: m.glow)
            }
            HStack(spacing: 7) {
                Circle().fill(it.verdictHue).frame(width: 7, height: 7)
                Text(it.verdictText).font(.system(size: 13, weight: .semibold)).foregroundStyle(it.verdictHue)
            }
            .padding(.top, 12)
            Text(it.price).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.75))
                .fixedSize(horizontal: false, vertical: true).padding(.top, 5)
            HStack(alignment: .top, spacing: 10) {
                StillOrb(colors: EMetric.all[0].orb, size: 20, level: 0.85)
                Text(it.goal).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 12)
            HStack(spacing: 8) {
                EPill(title: "Megnyitom") { onToast("A levél megnyílik") }
                EPill(title: "Nem érdekel", primary: false) { onToast("Megjegyeztem — a márkát ezentúl szűröm") }
                Spacer(minLength: 0)
            }
            .padding(.top, 14)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
    }
}

func backButton(_ action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
            .frame(width: 44, height: 44)
    }
    .buttonStyle(.plain)
    .glassEffect(.clear.interactive(), in: .circle)
    .padding(.leading, 14)
    .padding(.top, 54)
}

// MARK: - What each area's own app contains

enum EAreaContent {
    static func tabs(_ metric: Int) -> [ETab] {
        switch metric {
        case 5: return penz
        case 6: return level
        case 1: return alvas
        case 2: return mozgas
        case 3: return fuel
        case 4: return kozerzet
        default: return forma
        }
    }

    // Pénz — the finance app, rebuilt inside Boop
    static let penz: [ETab] = [
        ETab(name: "Ma", blocks: [
            .level(label: "A HAVI KERET", big: "281 600", unit: "Ft", right: "a 610 000-ből",
                   note: "A fehér vonal az, ahol a hónap 13. napján tartanod kéne. Két nagyobb tétel jön még: biztosítás 21-én, bérlet 25-én.",
                   value: 0.46, marker: 0.43),
            .rows(label: "MIRE MEGY EL", items: [
                ("Élelmiszer", "96 400 / 150 000 Ft", "a keret kétharmadánál, a hónap felénél", 0.64),
                ("Éttermek", "24 000 / 25 000 Ft", "szinte elfogyott", 0.96),
                ("Edzés, sport", "12 000 / 30 000 Ft", "a bérlet megvan", 0.4),
                ("Lakás, rezsi", "118 000 / 120 000 Ft", "fix", 0.98),
                ("Minden más", "31 200 / 75 000 Ft", "", 0.42)]),
            .week(label: "EZ A HÉT", days: [("H", 0.32, false), ("K", 0.58, false), ("Sze", 0.21, false), ("Cs", 0.9, true),
                                            ("P", 0.44, false), ("Szo", 0.76, false), ("V", 0.18, false)],
                  note: "Csütörtökön ment el a legtöbb: 31 400 Ft, ebből 18 900 Ft étterem."),
            .actions(primary: "Kiadás rögzítése", secondary: "Keretek", ask: "Kérdezd meg Boopot a költésedről"),
        ]),
        ETab(name: "Keretek", blocks: [
            .note(label: "HOGYAN MŰKÖDIK", body: "Minden hónap elején megkapod a keretet, és a Boop naponta mutatja, hol tartasz hozzá képest. Ha egy hónapban kevesebbet költesz, a maradék átvihető a következőre; ha többet, a hiány levonódik. Semmi nem történik magától — csak látod."),
            .rows(label: "A KERETEID", items: [
                ("Élelmiszer", "150 000 Ft / hó", "a legutóbbi három hónap átlaga 141 000 Ft", 0.0),
                ("Éttermek", "25 000 Ft / hó", "szándékosan szoros — ez a legnagyobb változó tételed", 0.0),
                ("Edzés, sport", "30 000 Ft / hó", "bérlet + felszerelés", 0.0),
                ("Lakás, rezsi", "120 000 Ft / hó", "fix, nem számít bele a napi keretbe", 0.0),
                ("Minden más", "75 000 Ft / hó", "", 0.0)]),
            .actions(primary: "Keret módosítása", secondary: "Új keret", ask: "Kérdezd meg Boopot, reális-e a keret"),
        ]),
        ETab(name: "Előzmények", blocks: [
            .week(label: "AZ UTOLSÓ HAT HÓNAP", days: [("Jún", 0.71, false), ("Júl", 0.88, false), ("Aug", 0.62, false),
                                                       ("Szep", 0.79, false), ("Okt", 0.94, true), ("Nov", 0.46, false)],
                  note: "Október volt a legdrágább hónapod: 574 000 Ft. A novemberi oszlop még csak félig telt, mert a hónap felénél járunk."),
            .list(label: "AMIT ÉSZREVETTEM", items: [
                ("Az éttermek a csütörtökök", "A havi étteremköltés 61%-a csütörtökön és pénteken keletkezik."),
                ("A nagy hónapok együtt járnak", "Azokban a hónapokban, amikor sokat utaztál, az élelmiszer is 20%-kal nőtt."),
                ("A kis tételek a felét viszik", "A 2 000 Ft alatti vásárlások adják a változó költésed 43%-át.")]),
            .actions(primary: "Hónap lezárása", secondary: "Kimutatás", ask: "Kérdezd meg Boopot a hónapjaidról"),
        ]),
        ETab(name: "Tervezett", blocks: [
            .list(label: "AMI MÉG JÖN EBBEN A HÓNAPBAN", items: [
                ("Biztosítás · 21-én · 18 000 Ft", "Minden hónapban, automatikus"),
                ("Edzőbérlet · 25-én · 12 000 Ft", "Minden hónapban, automatikus"),
                ("Futócipő · még nem döntöttél · 30 590 Ft", "A reggeli levélből. Ha megveszed, 5 400 Ft marad a hónapból.")]),
            .level(label: "AMI SZABADON MARAD", big: "54 000", unit: "Ft", right: "a hónap végéig",
                   note: "Ez már a fenti három tétel nélkül értendő. 17 nap van hátra, vagyis napi 3 100 Ft.",
                   value: 0.3, marker: nil),
            .actions(primary: "Tétel hozzáadása", secondary: "Megtakarítás", ask: "Kérdezd meg Boopot, belefér-e"),
        ]),
    ]

    // Levél — the daily digest
    static let level: [ETab] = [
        ETab(name: "Ma", blocks: [
            .level(label: "A MAI POSTA", big: "34", unit: "levél", right: "31 elintézve",
                   note: "Reggel 08:00-kor és délután 15:00-kor nézek bele. A következő futás 15:00-kor.",
                   value: 0.91, marker: nil),
            .mail(label: "MEGÉR EGY PERCET", items: [
                MailItem(from: "Futóbolt", what: "A kinézett futócipő 32%-kal olcsóbb", score: 9,
                         price: "30 590 Ft. Négy boltban néztem meg: a szokásos ára 38 400 Ft, a legolcsóbb máshol most 36 900 Ft.",
                         goal: "A mostani cipőd 780 km-nél jár, és a nyári célodhoz heti három futás kell.", verdict: 0),
                MailItem(from: "Fehérjebolt", what: "Akció a szokásos fehérjeporodra", score: 6,
                         price: "12 990 Ft 2 kg-ra. Ez pontosan ugyanannyi, mint amennyiért márciusban vetted — ez nem akció.",
                         goal: "Van még kb. három heted a jelenlegi zacskóból, nem sürgős.", verdict: 1)]),
            .list(label: "AMIT ELINTÉZTEM HELYETTED · 31", items: [
                ("Hírlevelek · 14", "Elolvastam, semmi nem kötődik a céljaidhoz"),
                ("Reklám · 11", "Olyan termékek, amiket sosem nyitottál meg"),
                ("Számlák, értesítők · 4", "Rendben vannak, semmi teendő"),
                ("Belépési kódok · 2", "Ezekbe nem néztem bele, és nem is küldtem sehova")]),
            .actions(primary: "Postafiókok", secondary: "Mit nézzen", ask: "Kérdezd meg Boopot a mai postáról"),
        ]),
        ETab(name: "Figyelt", blocks: [
            .note(label: "MIT FIGYELEK", body: "Megmondod, mi érdekel, és szólok, ha tényleg jó áron jön. Nem csak akkor, ha „akció” van ráírva — csak akkor, ha az ár valóban alacsonyabb, mint amit máshol látok."),
            .list(label: "AMIKET MOST FIGYELEK", items: [
                ("Futócipő · 42-es · semleges", "Ma jött rá a legjobb ár: 30 590 Ft. Eddig 11-szer hallgattam el egy drágább ajánlatot."),
                ("Fehérjepor · vanília · 2 kg", "A legolcsóbb, amit idén láttam: 11 400 Ft, augusztusban."),
                ("Okosmérleg", "Hat hete figyelem, még nem volt igazán olcsó.")]),
            .actions(primary: "Új figyelés", secondary: "Árelőzmények", ask: "Kérdezd meg Boopot, mikor érdemes venni"),
        ]),
        ETab(name: "Szabályok", blocks: [
            .list(label: "AMIBE SOSEM NÉZEK BELE", items: [
                ("Bank, biztosító, hivatal", "Ezek sosem kerülnek a gépi elemzésbe. Csak annyit mondok, hogy jött."),
                ("Belépési kódok, jelszó-levelek", "Felismerem a feladóról, és azonnal félreteszem."),
                ("Orvosi, egészségügyi levelek", "Csak akkor nézem meg, ha külön megkéred.")]),
            .note(label: "AMIT TÖRLÖK A LEVÉLBŐL, MIELŐTT BÁRMI TÖRTÉNNE", body: "A nyomkövető képeket, a téged azonosító linkeket, a rendelési számokat és a saját e-mail-címedet. Ami a gépi elemzéshez eljut, az a reklámszöveg, a terméknév és az ár — vagyis az, amit több millió másik embernek is kiküldtek."),
            .actions(primary: "Feladó tiltása", secondary: "Szabály hozzáadása", ask: "Kérdezd meg Boopot, mit lát a leveleidből"),
        ]),
        ETab(name: "Fiókok", blocks: [
            .list(label: "A POSTAFIÓKJAID", items: [
                ("Gmail", "Csatlakoztatva · utoljára 08:00-kor olvasta · csak olvasás"),
                ("iCloud", "Csatlakoztatva · utoljára 08:00-kor olvasta · csak olvasás")]),
            .note(label: "HOGYAN KAPCSOLÓDIK", body: "Mindkét fiókhoz te hozol létre egy külön kulcsot a saját fiókod beállításaiban, és te írod be — a jelszavadat soha nem kérem és nem látom. A kulcs bármikor visszavonható, és akkor a Boop azonnal elveszti a hozzáférést."),
            .week(label: "MENNYI JÖN NAPONTA", days: [("H", 0.6, false), ("K", 0.74, false), ("Sze", 0.52, false), ("Cs", 0.91, true),
                                                      ("P", 0.68, false), ("Szo", 0.3, false), ("V", 0.22, false)],
                  note: "Hetente átlagosan 212 levél. Ebből 14 volt az, amit tényleg megnyitottál."),
            .actions(primary: "Fiók hozzáadása", secondary: "Időzítés", ask: "Kérdezd meg Boopot a postafiókjaidról"),
        ]),
    ]

    static let alvas: [ETab] = [
        ETab(name: "Ma", blocks: [
            .level(label: "AZ ÉJSZAKA", big: "7ó 12p", unit: "", right: "a 7,5 órás célból",
                   note: "22:48-kor aludtál el, 12 perccel korábban, mint szoktál. Ebből 1 óra 36 perc volt mély alvás.",
                   value: 0.96, marker: 1.0),
            .week(label: "A HÉT ÉJSZAKÁI", days: [("H", 0.7, false), ("K", 0.75, false), ("Sze", 0.6, false), ("Cs", 0.8, false),
                                                  ("P", 0.72, false), ("Szo", 0.9, false), ("V", 0.82, true)],
                  note: "A heti átlagod 7 óra 4 perc. A legrövidebb szerda volt, a sűrű naptárú nap után."),
            .actions(primary: "Lefekvés emlékeztető", secondary: "Részletek", ask: "Kérdezd meg Boopot az alvásodról"),
        ]),
        ETab(name: "Hét", blocks: [
            .list(label: "AMI HATOTT RÁ", items: [
                ("A késői vacsora", "A 20:30 utáni vacsorák után átlagosan 24 perccel kevesebbet alszol."),
                ("A sűrű naptár", "A hat eseménynél zsúfoltabb napok után a mély alvásod 18 perccel rövidebb."),
                ("Az esti edzés", "A 20:00 után befejezett edzések nem rontották el — ez nálad nem gond.")]),
            .actions(primary: "Napló", secondary: "Célok", ask: "Kérdezd meg Boopot, mitől alszol jobban"),
        ]),
        ETab(name: "Előzmények", blocks: [
            .week(label: "AZ UTOLSÓ HAT HÉT", days: [("41", 0.62, false), ("42", 0.7, false), ("43", 0.58, false),
                                                     ("44", 0.75, false), ("45", 0.8, false), ("46", 0.84, true)],
                  note: "Hat hét alatt az átlagod 6 óra 38 percről 7 óra 4 percre nőtt."),
            .actions(primary: "Teljes előzmény", secondary: "Kivitel", ask: "Kérdezd meg Boopot a hosszú távú alvásodról"),
        ]),
    ]

    static let mozgas: [ETab] = [
        ETab(name: "Ma", blocks: [
            .level(label: "LÉPÉSEK", big: "1 240", unit: "lépés", right: "a napi 8 000-ből",
                   note: "Egy 20 perces séta ebéd után a napi cél felét hozza. Este 18:30-kor jön a felsőtest edzés.",
                   value: 0.16, marker: 0.55),
            .list(label: "A MAI MOZGÁSOD", items: [
                ("Felsőtest edzés · 18:30 · 75 perc", "5 gyakorlat · a mezociklus 3. hete"),
                ("Séta · még nincs", "Boop javasolja ebéd után")]),
            .actions(primary: "Edzés indítása", secondary: "Séta rögzítése", ask: "Kérdezd meg Boopot a mai mozgásodról"),
        ]),
        ETab(name: "Edzések", blocks: [
            .list(label: "A HÉT EDZÉSEI", items: [
                ("Hétfő · Láb · 68 perc", "Kész · minden sorozat megvolt"),
                ("Szerda · Futás · 6,4 km", "Kész · 5:48 / km, három hete a leglassabb"),
                ("Csütörtök · Felsőtest · 75 perc", "Ma 18:30-kor"),
                ("Szombat · Futás · 10 km", "Tervezett")]),
            .week(label: "HETI TERHELÉS", days: [("H", 0.8, false), ("K", 0.0, false), ("Sze", 0.62, false), ("Cs", 0.75, true),
                                                 ("P", 0.0, false), ("Szo", 0.9, false), ("V", 0.0, false)],
                  note: "Heti három edzés és egy hosszú futás — ez a nyári célod alapterhelése."),
            .actions(primary: "Edzésterv", secondary: "Gyakorlatok", ask: "Kérdezd meg Boopot az edzéseidről"),
        ]),
        ETab(name: "Előzmények", blocks: [
            .list(label: "AMIT ÉSZREVETTEM", items: [
                ("A futóidőid lassulnak", "Három hete, átlagosan 14 másodperccel kilométerenként."),
                ("A cipőd 780 km-nél jár", "A legtöbb futócipő 600–800 km után veszít a párnázásából."),
                ("A lábnapok stabilak", "Nyolc hete nem hagytál ki egyet sem.")]),
            .actions(primary: "Teljes előzmény", secondary: "Rekordok", ask: "Kérdezd meg Boopot a fejlődésedről"),
        ]),
    ]

    static let fuel: [ETab] = [
        ETab(name: "Ma", blocks: [
            .level(label: "FEHÉRJE", big: "38", unit: "g", right: "a napi 165-ből",
                   note: "Ebéd után vagy. A vacsoránál legalább 50 grammra lesz szükség, hogy összejöjjön.",
                   value: 0.23, marker: 0.5),
            .rows(label: "A MAI KERET", items: [
                ("Kalória", "1 180 / 2 350 kcal", "", 0.5),
                ("Fehérje", "38 / 165 g", "ez marad el leginkább", 0.23),
                ("Szénhidrát", "142 / 240 g", "", 0.59),
                ("Zsír", "41 / 78 g", "", 0.53)]),
            .list(label: "AMIT MA ETTÉL", items: [
                ("Reggeli · 08:20 · Zabkása áfonyával", "32 g fehérje · 410 kcal"),
                ("Ebéd · 12:40 · Csirke rizzsel, salátával", "46 g fehérje · 620 kcal"),
                ("Vacsora · 19:45 · még nincs", "Boop: legalább 50 g fehérje")]),
            .actions(primary: "Étkezés rögzítése", secondary: "Receptek", ask: "Kérdezd meg Boopot az étkezésedről"),
        ]),
        ETab(name: "Receptek", blocks: [
            .list(label: "AMI MA BEFÉRNE A VACSORÁBA", items: [
                ("Csirkés tál édesburgonyával", "52 g fehérje · 640 kcal · 25 perc"),
                ("Tonhalas tészta", "46 g fehérje · 580 kcal · 18 perc"),
                ("Túrós-tojásos rakott", "48 g fehérje · 520 kcal · 30 perc")]),
            .actions(primary: "Recept hozzáadása", secondary: "Kamra", ask: "Kérdezd meg Boopot, mit főzz"),
        ]),
        ETab(name: "Hét", blocks: [
            .week(label: "FEHÉRJE A HÉTEN", days: [("H", 0.9, false), ("K", 0.72, false), ("Sze", 0.55, false), ("Cs", 0.23, true),
                                                   ("P", 0.8, false), ("Szo", 0.66, false), ("V", 0.5, false)],
                  note: "14 napból 9-en maradtál a cél alatt, átlagosan 22 grammal. Ez a nyári célod legnagyobb fékje."),
            .actions(primary: "Heti terv", secondary: "Bevásárlólista", ask: "Kérdezd meg Boopot a fehérjéről"),
        ]),
    ]

    static let kozerzet: [ETab] = [
        ETab(name: "Ma", blocks: [
            .level(label: "FESZÜLTSÉG", big: "4", unit: "/10", right: "a délelőtti check-inből",
                   note: "Energia 7, hangulat 8. Hat megbeszélés van ma a naptáradban — ez a te mércéd szerint zsúfolt nap.",
                   value: 0.4, marker: nil),
            .list(label: "A MAI CHECK-INEK", items: [
                ("07:20 · Reggeli", "Energia 7 · hangulat 8 · feszültség 4"),
                ("16:00 · Délutáni", "Még nem töltötted ki · 3 kérdés, fél perc")]),
            .actions(primary: "Check-in", secondary: "Napló", ask: "Kérdezd meg Boopot a közérzetedről"),
        ]),
        ETab(name: "Check-inek", blocks: [
            .week(label: "ENERGIA A HÉTEN", days: [("H", 0.7, false), ("K", 0.6, false), ("Sze", 0.45, false), ("Cs", 0.7, true),
                                                   ("P", 0.55, false), ("Szo", 0.85, false), ("V", 0.8, false)],
                  note: "Szerda volt a mélypont — a legzsúfoltabb nap, a legrövidebb alvás után."),
            .actions(primary: "Kérdések", secondary: "Emlékeztetők", ask: "Kérdezd meg Boopot az energiádról"),
        ]),
        ETab(name: "Minták", blocks: [
            .list(label: "AMIT ÉSZREVETTEM", items: [
                ("A zsúfolt napok ára", "A hat eseménynél sűrűbb napokon a feszültséged átlagosan 2 ponttal magasabb."),
                ("Az edzés utáni nap", "Edzés utáni reggeleken az energiád átlagosan 1,4 ponttal jobb."),
                ("A hétvége", "Szombaton a legjobb a közérzeted — nyolc hete minden alkalommal.")]),
            .actions(primary: "Teljes előzmény", secondary: "Minták", ask: "Kérdezd meg Boopot a mintáidról"),
        ]),
    ]

    static let forma: [ETab] = [
        ETab(name: "Ma", blocks: [
            .level(label: "A MAI FORMÁD", big: "78", unit: "/100", right: "a heti átlagod 74",
                   note: "A mélyalvásod 18 perccel a heti átlag felett volt, a pulzusváltozékonyságod rendben. A 18:30-as edzés belefér.",
                   value: 0.78, marker: 0.74),
            .list(label: "MI HAT RÁ MA", items: [
                ("Alvás · 84", "7 óra 12 perc, ebből 1 óra 36 perc mély — ez emeli"),
                ("Közérzet · 69", "A délelőtti feszültség 4 volt — ez húzza le"),
                ("Mozgás · 62", "1 240 lépés eddig — ez húzza le"),
                ("Pénz · 74", "A kereten belül vagy — nem terhel")]),
            .actions(primary: "A nap terve", secondary: "Részletek", ask: "Kérdezd meg Boopot a formádról"),
        ]),
        ETab(name: "Mi hat rá", blocks: [
            .week(label: "A FORMÁD A HÉTEN", days: [("H", 0.72, false), ("K", 0.7, false), ("Sze", 0.58, false), ("Cs", 0.78, true),
                                                    ("P", 0.68, false), ("Szo", 0.82, false), ("V", 0.8, false)],
                  note: "Szerda volt a leggyengébb nap: rövid alvás és zsúfolt naptár együtt."),
            .note(label: "HOGYAN SZÁMOLOM", body: "A Forma nem egy orvosi mérőszám, hanem a te saját előzményeidhez képest mutatja, mire vagy ma képes: az alvásodból, a pulzusváltozékonyságodból, az elmúlt napok terheléséből és abból, amit a check-inekben mondtál."),
            .actions(primary: "Teljes előzmény", secondary: "Beállítások", ask: "Kérdezd meg Boopot, mi befolyásolja"),
        ]),
    ]
}
