import SwiftUI
import BoopCore
import BoopDesign

/// The Évad room's tabs (decision #132): Most · Hét · Terv · Kísérlet, each with its own drawn glyph.
enum EvadRoomTab: String, CaseIterable {
    case most = "Most", het = "Hét", terv = "Terv", kiserlet = "Kísérlet"
    var glyph: String {
        switch self {
        case .most: "most-ink"
        case .het: "het-ink"
        case .terv: "terv-ink"
        case .kiserlet: "kiserlet-ink"
        }
    }
}

/// The room's sub-pages, one page-level cover (boop-ios.md §9).
enum EvadRoomSub: Identifiable, Equatable {
    case days, load, learned, map, rules, whatIf, newSeason, atrendezes
    /// A finished experiment's result (nil = the newest).
    case experiment(String?)
    case newExperiment
    var id: String {
        switch self {
        case .days: "days"
        case .load: "load"
        case .learned: "learned"
        case .map: "map"
        case .rules: "rules"
        case .whatIf: "whatIf"
        case .newSeason: "newSeason"
        case .atrendezes: "atrendezes"
        case .experiment(let id): "experiment:\(id ?? "")"
        case .newExperiment: "newExperiment"
        }
    }
}

/// A wall card's / an old link's sub string as a sub-page: "modositas" → Módosítás, "szabalyok" → Szabályok, "uj" →
/// Új évad, "kiserlet:<id>" → that result, "atrendezes" → next week's Átrendezés; anything else → nil.
func evadRoomSub(_ raw: String?) -> EvadRoomSub? {
    guard let raw else { return nil }
    switch raw {
    case "modositas": return .whatIf
    case "szabalyok": return .rules
    case "uj": return .newSeason
    case "atrendezes": return .atrendezes
    default:
        if raw.hasPrefix("kiserlet:") {
            let id = String(raw.dropFirst("kiserlet:".count))
            return .experiment(id.isEmpty ? nil : id)
        }
        return nil
    }
}

/// The room's head per tab: the eyebrow (season · week), the headline, and the fixed „what you see here" sentence.
func evadRoomHead(_ o: EvadOverview, tab: EvadRoomTab, week: EvadAdherence?) -> (eyebrow: String, headline: String, sentence: String) {
    let eyebrow = "\(o.head.title) · \(o.head.weeks) hétből a \(o.head.week)."
    switch tab {
    case .most: return (eyebrow, evadMostSentence(week), "Egy pillantás a hetedre: mennyire tartod, és mi jön.")
    case .het: return (eyebrow, "Hogy ment, és mi jön?", "Itt nézed át vasárnap a hetet: a terhelést, a jövő hetet és amit Boop tanult.")
    case .terv: return (eyebrow, "Mi a nagy terv?", "Az évad egészben: hol tartasz az évben, mi a cél, és mi mire hat.")
    case .kiserlet: return (eyebrow, "Kipróbálok valamit", "Egyszerre egy kísérlet fut; Boop őszintén megmondja, hatott-e.")
    }
}

/// **Évad** — the room of the violet orb (`mezo-r36n9.196` step 2, decisions #132–#138): one N-week season, read on
/// four tabs. Most: how this week is going. Hét: the Sunday look back and ahead. Terv: the year, the season, the goal and
/// what drives what. Kísérlet: one experiment at a time. No season yet → the empty state with no bar.
struct EvadRoom: View {
    let entry: RoomEntry
    @Environment(EvadStore.self) private var store: EvadStore?
    @Environment(KapacitasStore.self) private var kapacitas: KapacitasStore?
    @Environment(RitmusRouter.self) private var router: RitmusRouter?
    @Environment(\.openDestination) private var openDestination
    @Environment(\.closeRoom) private var closeRoom
    @Environment(\.dismiss) private var dismiss
    @Environment(\.planClient) private var planClient
    @Environment(\.serverCache) private var cache
    @State private var tab: String
    @State private var open: EvadRoomSub?
    /// The year plan for Terv's strip, made and read on Terv's first appearance.
    @State private var year: YearPlanModel?
    /// The entry's sub is taken once, when the season is on screen.
    @State private var tookEntry = false

    init(entry: RoomEntry = RoomEntry(.evad)) {
        self.entry = entry
        var t = entry.tab.flatMap(EvadRoomTab.init(rawValue:)) ?? .most
        #if DEBUG
        if let p = UserDefaults.standard.string(forKey: "evadTab").flatMap(EvadRoomTab.init(rawValue:)) { t = p }
        #endif
        _tab = State(initialValue: t.rawValue)
    }

    private var back: @MainActor @Sendable () -> Void { closeRoom ?? { dismiss() } }
    private var current: EvadRoomTab { EvadRoomTab(rawValue: tab) ?? .most }

    var body: some View {
        Group {
            if let store, let o = store.overview {
                season(o, store: store)
            } else if let store, store.empty {
                EvadNoSeason(start: { open = .newSeason }, onBack: back)
            } else if let problem = store?.problem {
                waiting(headline: "Most nem érem el az évadodat", state: .failed(evadErrorText(problem), {
                    Task { await store?.load(force: true) }
                }))
            } else {
                waiting(headline: "Töltöm az évadodat", state: .loading)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task(id: store.map(ObjectIdentifier.init)) {
            await store?.load()
            await store?.loadWeek()
        }
        .onChange(of: store?.overview == nil, initial: true) { takeEntry() }
        .fullScreenCover(item: $open) { sub in
            Group {
                switch sub {
                case .days: EvadDaysPage(close: { open = nil })
                case .load: EvadLoadPage(close: { open = nil })
                case .learned: EvadLearnedPage(close: { open = nil })
                case .map: EvadMapPage(close: { open = nil })
                case .rules: EvadRulesPage(close: { open = nil })
                case .whatIf: EvadWhatIf(close: { open = nil })
                case .newSeason: EvadNewSeason(close: { open = nil })
                case .atrendezes:
                    AtrendezesPage(monday: kapacitasNextMonday(after: kapacitasMonday(for: Date())), crumb: "Évad",
                                   close: { open = nil }, ask: { open = nil; openDestination(.chat) })
                case .experiment(let id): EvadExperimentPage(id: id, close: { open = nil })
                case .newExperiment: EvadNewExperimentPage(close: { open = nil })
                }
            }
            .environment(store)
            .environment(kapacitas)
        }
        .onAppear {
            #if DEBUG
            // Simulator review: `-evadOpen days|load|learned|map|modositas|szabalyok|uj|atrendezes|kiserlet:<id>|ujkiserlet`.
            if let raw = UserDefaults.standard.string(forKey: "evadOpen") {
                let sub: EvadRoomSub? = switch raw {
                case "days": .days
                case "load": .load
                case "learned": .learned
                case "map": .map
                case "kiserlet": .experiment(UserDefaults.standard.string(forKey: "evadExperiment"))
                case "ujkiserlet": .newExperiment
                default: evadRoomSub(raw)
                }
                Task { try? await Task.sleep(for: .seconds(1.2)); open = sub }
            }
            #endif
        }
    }

    private func takeEntry() {
        guard !tookEntry, store?.overview != nil else { return }
        tookEntry = true
        if let sub = evadRoomSub(entry.sub) { open = sub }
    }

    private func season(_ o: EvadOverview, store: EvadStore) -> some View {
        let head = evadRoomHead(o, tab: current, week: store.week?.summary)
        let score = store.weekScore
        return NKAreaPage(hue: evadHue, name: "Évad", eyebrow: head.eyebrow, level: score.map { Double($0) / 100 },
                          display: score.map { "\($0)" } ?? "–",
                          headline: head.headline, sentence: head.sentence, glyph: "evad-ink",
                          tabs: EvadRoomTab.allCases.map { NKAreaTab($0.rawValue, glyph: $0.glyph) }, selectedTab: $tab,
                          actions: [NKAreaAction(glyph: "repeat-deep", label: "Frissítés") {
                              Task { await store.load(force: true); await store.loadWeek(force: true); await kapacitas?.load(force: true) }
                          }],
                          onBack: back, onAsk: { openDestination(.chat) }) {
            switch current {
            case .most:
                EvadMost(o: o, store: store, open: { open = $0 }, openReview: { router?.openReview() },
                         openDay: { _ in openDestination(.nap(.napok)) })
            case .het:
                EvadHet(o: o, store: store, open: { open = $0 }, openReview: { router?.openReview() })
            case .terv:
                EvadTerv(o: o, store: store, year: year, open: { open = $0 })
                    .task {
                        if year == nil, let planClient { year = YearPlanModel(client: planClient, cache: cache) }
                        await year?.load()
                    }
            case .kiserlet:
                EvadKiserlet(exp: store.experiments, open: { open = $0 })
            }
            Color.clear.frame(height: 30)
        }
        .nkStale(store.ageText.map { NKStale(age: $0, loud: true) })
    }

    /// Loading or failed before any overview: the head with one block saying which.
    private func waiting(headline: String, state: NKBlockState) -> some View {
        NKAreaPage(hue: evadHue, name: "Évad", eyebrow: "Évad", level: nil, display: "–", headline: headline, sentence: "",
                   glyph: "evad-ink", onBack: back) {
            NKBare("Az évadod", hue: evadHue, glyph: "evad-ink", state: state) { EmptyView() }
        }
    }
}

/// No season yet: what a season is and the way into the first draft. No bar, the orb reads „–". Nothing starts without
/// his OK.
struct EvadNoSeason: View {
    let start: @MainActor @Sendable () -> Void
    var onBack: (@MainActor @Sendable () -> Void)? = nil
    var body: some View {
        NKAreaPage(hue: evadHue, name: "Évad", eyebrow: "Évad · még nincs", level: nil, display: "–",
                   headline: "Indítsunk egy évadot",
                   sentence: "Egy évad néhány hét egy céllal: mennyit eszel, mennyit edzel, mennyit alszol — és miért.",
                   glyph: "evad-ink", onBack: onBack) {
            VStack(spacing: 18) {
                EvadEmptyIllustration().frame(height: 170)
                VStack(alignment: .leading, spacing: 10) {
                    Text("Öt lépés, kb. két perc").nkFont(20, design: .serif).foregroundStyle(.white)
                    EvadText("A mostani súlycélodból és mezociklusodból már összeállítottam egy javaslatot. Megadod a célt és a heteket; Boop kiszámolja a kereteket. Csak akkor indul el, ha jóváhagyod.")
                    NKActions([NKAction(glyph: "plus-ink", title: "Megnézem", primary: true, action: start)], hue: evadHue)
                }
            }
            .padding(18)
            .nkGlass()
        }
    }
}
