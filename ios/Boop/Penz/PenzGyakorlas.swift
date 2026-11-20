import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Pénz L7 (`mezo-r36n9.105`): Gyakorlás — day trading as learning, on paper

// The build target is the approved Élet spike round 11 (`EletContent.swift` Pénz `Gyakorlás`, screenshot
// `penz-5-gyakorlas.png`; spec §5.4/§5.6; build notes §4). The order of the blocks is the spike's: the weekly review
// as the highlight · *Új kereskedés · A teljes napló* · three numbers · the week's curve · the week's trades (open ones
// first) · what Boop noticed · the noise line · one info row · the menu · the ask row. Every state is honest: loading,
// failed / offline (the cached copy with its age), never traded, no closed trade this week.
//
// Copy rules (§6): never urge, never promise a return, never say sell; a negative figure is never lit.

/// The section glyphs of the L7 screens (every section head carries one — owner round 11).
func penzL7SectionGlyph(_ label: String) -> String? {
    switch label {
    case "A JÁTÉKPÉNZ ALAKULÁSA": "chart-deep"
    case "A HÉT KERESKEDÉSEI", "GYAKORLÁS": "bolt-ink"
    case "AMIT A HÉTEN LÁTOK": "spark-cream"
    case "A GYAKORLÁS": "plate-deep"
    case "A TERV": "pen-sun"
    case "BELÉPEK", "LEZÁROM", "ZÁRÓÁR": "clock-ink"
    case "AZ EREDMÉNY": "check-ink"
    case "A TERVED", "A TERVEID": "check-ink"
    case "A FELOSZTÁS", "HONNAN JÖN EZ A SZÁM": "scale-ink"
    case "TERMÉKJEGYZÉK", "JÓVÁHAGYOTT": "book-sage"
    case "JAVASLATOK", "BOOP JAVASLATAI": "spark-cream"
    case "ELUTASÍTOTT": "clock-ink"
    case "1–3 ÉV · BIZTONSÁG": "scale-ink"
    case "5–10 ÉV · KÖZÉPTÁV": "chart-deep"
    case "10+ ÉV · HOSSZÚ TÁV": "star-sun"
    default:
        // a journal month ("NOVEMBER")
        penzL6SectionGlyph(label) ?? "book-sage"
    }
}

/// A section with the L7 glyphs.
struct PenzL7Section<Content: View>: View {
    let label: String
    var trailing: String? = nil
    var state: NKBlockState = .ready
    @ViewBuilder let content: () -> Content
    var body: some View {
        NKBare(label, hue: penzHue, glyph: penzL7SectionGlyph(label), trailing: trailing, state: state, content: content)
    }
}

/// A trade row model as a kit row (a loss is never `hot`; nothing here is).
func penzTradeAreaRow(_ r: PenzTradeRowModel, action: (@MainActor @Sendable () -> Void)?) -> NKAreaRow {
    NKAreaRow(id: r.id, glyph: r.glyph, title: r.title, sub: r.sub, value: penzOutfit(r.value), valueSub: r.valueSub,
              badge: r.badge, state: r.kind == .cancelled ? .skipped : .normal, action: action)
}

struct PenzGyakorlas: View {
    let store: PenzStore?
    let open: (PenzSheet) -> Void
    let openJournal: () -> Void
    let ask: () -> Void
    private let hue = penzHue

    var body: some View {
        if let store, let o = store.practice?.value {
            let empty = penzPracticeIsEmpty(o)
            let h = penzPracticeHighlight(o)
            NKHighlight(hue: hue, label: h.label, text: h.text, sub: h.sub)
                .nkStale(store.practiceOffline ? store.practiceAgeText.map { NKStale(age: $0, loud: true) } : nil)
            actions
            if !empty {
                VStack(alignment: .leading, spacing: 10) {
                    NKStatRow(penzPracticeStats(o).map { s in
                        NKStat(value: s.value.map(penzOutfit), target: s.target.map(penzOutfit), unit: s.unit, label: s.label,
                               hot: s.hot)
                    }, hue: hue)
                    noise(o)
                }
                curve(o.week)
                trades(o)
                if !o.week.observations.isEmpty {
                    PenzL7Section(label: "AMIT A HÉTEN LÁTOK") {
                        NKList(o.week.observations.map { (title: $0.title, body: penzUnlitNegatives($0.body)) }, hue: hue)
                    }
                }
            } else {
                noise(o)
            }
            NKInfoRow("Mit jelent az R, és miért papíron megy?", hue: hue) {
                open(.info(title: "Mit jelent az R, és miért papíron megy?", body: penzPracticeInfoText))
            }
            menu(o.cap)
        } else {
            PenzL7Section(label: "GYAKORLÁS", state: blockState) { EmptyView() }
            actions
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a hetedről") { ask() }
    }

    private var blockState: NKBlockState {
        guard let store else { return .loading }
        if let p = store.practiceProblem {
            let line = p == .offline ? "Nincs net, és még nincs elmentett adatom a gyakorlásodról." : penzErrorText(p)
            return .failed(line) { Task { await store.loadPractice(force: true) } }
        }
        return .loading
    }

    private var actions: some View {
        PenzActionRow(actions: [
            PenzAction(glyph: "pen-sun", title: "Új kereskedés", primary: true) { open(.newTrade) },
            PenzAction(glyph: "book-sage", title: "A teljes napló") { openJournal() },
        ])
    }

    /// Under 50 tagged trades the numbers are noise — said every time, never hidden.
    @ViewBuilder private func noise(_ o: PenzPracticeOverview) -> some View {
        if let line = penzNoiseLine(o) {
            HStack(alignment: .top, spacing: 8) {
                NKGlyph("scale-ink", .white.opacity(0.5), size: 13).padding(.top, 2)
                NKHueText(line, hue: hue, size: 12.5, opacity: 0.6)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 10)
        }
    }

    @ViewBuilder private func curve(_ w: PenzPracticeWeek) -> some View {
        PenzL7Section(label: "A JÁTÉKPÉNZ ALAKULÁSA") {
            VStack(alignment: .leading, spacing: 12) {
                if let c = penzPracticeCurve(w) {
                    NKCurve(values: c.values, labels: c.labels, hue: hue, target: c.baseline, nowIndex: c.now)
                    NKHueText(penzPracticeCurveNote(w), hue: hue, size: 13, opacity: 0.65)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    NKHueText("A görbéhez legalább két nap kell ezen a héten. Ha lezársz egy kereskedést, itt látod, hogyan alakul a játékpénz — *a szaggatott vonal lesz a kiindulás.*",
                              hue: hue, size: 13.5, opacity: 0.6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    @ViewBuilder private func trades(_ o: PenzPracticeOverview) -> some View {
        let rows = penzWeekTradeRows(o)
        PenzL7Section(label: "A HÉT KERESKEDÉSEI") {
            VStack(alignment: .leading, spacing: 0) {
                if rows.isEmpty {
                    NKHueText("Ezen a héten még nincs kereskedésed. Az *Új kereskedés* gombbal egy tervvel kezded.",
                              hue: hue, size: 13.5, opacity: 0.6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                NKRowList(rows.map { r in penzTradeAreaRow(r) { open(.trade(r.id)) } }, hue: hue)
                PenzMoreLink(title: "A teljes napló") { openJournal() }
            }
        }
    }

    private func menu(_ cap: PenzPracticeCap) -> some View {
        PenzL7Section(label: "A GYAKORLÁS") {
            NKMenuGrid([
                NKMenuItem(glyph: "pen-sun", name: "Új terv", sub: "Mit, miért, hol lépek ki") { open(.newTrade) },
                NKMenuItem(glyph: "leaf-sage", name: "Címkék", sub: "Nyolc, szándékosan nem húsz") { open(.practiceTags) },
                NKMenuItem(glyph: "scale-ink", name: "A keret", sub: penzCapMenuSub(cap)) { open(.practiceCap) },
                NKMenuItem(glyph: "star-sun", name: "Élesre fordítás", sub: "Amikor te úgy döntesz") { open(.practiceLive) },
            ], hue: hue)
        }
    }
}

let penzPracticeInfoText = """
Most *papíron* megy: valódi árakkal, de valódi pénz nélkül — ezt te fordítod élesre, amikor készen állsz.

Az *R* azt jelenti, hogy a kockáztatott összeghez képest mennyit hozott egy kereskedés. Ha 2 000 Ft-ot kockáztattál és 3 800-at hozott, az +1,9R. Így a pozíció mérete nem tudja elrejteni az igazságot: egy nagy nyereség kis kockázattal többet ér, mint egy nagy nyereség óriási kockázattal.

Minden adat a te beírt belépő, kilépő és kilépési szintedből számol: *élő árfolyamot nem figyelek, és a stopodat sem én őrzöm.* Ötven jelölt kereskedés alatt a százalékok még zajnak számítanak, és ezt mindig kiírom.
"""

// MARK: - The full journal

struct PenzJournalPage: View {
    let store: PenzStore
    let onBack: @MainActor @Sendable () -> Void
    @State private var trade: String?
    private let hue = penzHue

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Pénz · Gyakorlás", eyebrow: "Gyakorlás", title: "A teljes napló",
                      sentence: "Minden kereskedésed, a tervtől a zárásig — papíron.", onBack: onBack) {
            if let trades = store.journal {
                let groups = penzJournalGroups(trades.filter { $0.status != "cancelled" } + trades.filter { $0.status == "cancelled" })
                if groups.isEmpty {
                    NKHighlight(hue: hue, label: "A napló", text: "A napló még üres",
                                sub: "Az első terved után itt gyűlik minden kereskedésed: a terv, a belépő, a zárás és az egy sor, amit utána írtál.")
                }
                ForEach(groups, id: \.month) { g in
                    PenzL7Section(label: g.title.uppercased(), trailing: "\(g.trades.count) db") {
                        NKRowList(g.trades.map { t in
                            penzTradeAreaRow(penzTradeRow(t, tags: store.practice?.value.tags ?? penzPracticeDefaultTags)) {
                                trade = t.id
                            }
                        }, hue: hue)
                    }
                }
            } else {
                PenzL7Section(label: "A HÉT KERESKEDÉSEI", state: state) { EmptyView() }
            }
        }
        .task { await store.loadJournal() }
        .sheet(item: Binding(get: { trade.map(PenzTradeID.init) }, set: { trade = $0?.id })) { t in
            PenzTradeSheet(store: store, tradeId: t.id) { _ in trade = nil }
                .penzSheetStyle([.large])
        }
    }

    private var state: NKBlockState {
        if let p = store.journalProblem {
            return .failed(p == .offline ? "A naplót most nem érem el — ha lesz net, itt lesz." : penzErrorText(p)) {
                Task { await store.loadJournal() }
            }
        }
        return .loading
    }
}

/// A trade id as a sheet item.
struct PenzTradeID: Identifiable { let id: String }

// MARK: - Címkék · A keret · Élesre fordítás

struct PenzPracticeTagsSheet: View {
    let store: PenzStore
    var body: some View {
        let o = store.practice?.value
        let tags = (o?.tags.isEmpty == false ? o?.tags : nil) ?? penzPracticeDefaultTags
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Gyakorlás", title: "Címkék") {
            NKHueText("Nyolc címke, szándékosan nem húsz: egy kis szótárral a heti visszanézés tényleg mutat valamit. Zárásnál legalább egyet választasz, és külön jelölheted, ha *hibának* tartod.",
                      hue: penzHue, size: 14, opacity: 0.75)
                .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 0) {
                NKRowList(tags.map { t in
                    let s = o?.week.bySetup.first { $0.tag == t.key }
                    return NKAreaRow(id: t.key, glyph: "leaf-sage", title: t.label,
                                     sub: s.map { "A héten \($0.count) kereskedés · \($0.wins) nyerő" } ?? "A héten nem volt ilyen",
                                     value: s?.avgR.map { penzOutfit(penzR($0)) } ?? "", valueSub: s?.avgR == nil ? "" : "R átlag")
                }, hue: penzHue)
            }
            .padding(.horizontal, 6)
            if let m = o?.week.commonMistake {
                NKHueText("A hét leggyakoribb hibája: *\(m.label.lowercased())* (\(m.count) kereskedés)\(m.costHufMinor > 0 ? ", \(penzFtUnit(m.costHufMinor))-ba került" : "").",
                          hue: penzHue, size: 13.5, opacity: 0.7)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

struct PenzPracticeCapSheet: View {
    let store: PenzStore
    let edit: () -> Void
    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Gyakorlás", title: "A keret") {
            if let cap = store.practice?.value.cap {
                VStack(alignment: .leading, spacing: 0) {
                    NKMono("EBBEN A HÓNAPBAN MÉG FÉR BELE")
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(penzOutfit(penzFt(max(0, cap.leftHufMinor)))).font(.custom(Lagy.outfitFamily, size: 38).weight(.light))
                            .foregroundStyle(.white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                        Text("Ft").nkFont(15).foregroundStyle(.white.opacity(0.6))
                        Spacer(minLength: 6)
                        Text("a \(penzOutfit(penzFt(cap.capHufMinor)))-\(penzFromSuffix(cap.capHufMinor))").nkFont(13)
                            .foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .padding(.top, 10)
                    PenzLevelBar(level: penzCapLevel(cap)).padding(.top, 10)
                    Text("Elkelt: \(penzFtUnit(cap.usedHufMinor)) — a nyitott kereskedések és a hónap vesztesége.")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.6)).padding(.top, 8)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass(28)
            } else {
                NKNotLiveYet(hue: penzHue, title: "A keretet most nem érem el", line: "Ha lesz net, itt látod, mennyi fér még bele ebben a hónapban.")
            }
            NKHueText(penzCapText, hue: penzHue, size: 14, opacity: 0.78)
                .frame(maxWidth: .infinity, alignment: .leading)
            NKPill("A keret átírása", glyph: "repeat-deep", primary: false) { edit() }
        }
    }
}

let penzCapText = """
A gyakorlás keretét a *Költés* oldalon külön sorként vonom le a költhető pénzből, így *nem nyúl a többi pénzedhez*: nem a befektetéseidből, nem a tartalékodból és nem a heti keretedből megy.

Egy új belépő akkor fér bele, ha az ára nem nagyobb annál, ami a hónapból még megmaradt. A nyereség nem növeli a keretet; a veszteség a hónap végéig fogyasztja. A következő hónap újra a teljes kerettel indul.
"""

struct PenzPracticeLiveSheet: View {
    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Gyakorlás", title: "Élesre fordítás") {
            NKNotLiveYet(hue: penzHue, title: "Ezt a kapcsolót te fordítod át — és még nincs megépítve",
                         line: "Most minden kereskedés papíron megy: valódi árakkal, valódi pénz nélkül. Az éles mód a következő szakasz, és csak akkor indul, ha te úgy döntesz.")
            NKHueText("Amikor élesre fordítod, *akkor sem* Boop kereskedik: a megbízást te adod a saját platformodon, itt csak a tervet, a belépőt és a zárást írod be, ugyanígy. A havi keret akkor is ugyanaz marad, és nem nyúl a többi pénzedhez.\n\nAddig érdemes legalább ötven jelölt kereskedést összegyűjteni papíron — az alatt a számok még zajnak számítanak.",
                      hue: penzHue, size: 14, opacity: 0.78)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
