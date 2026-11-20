import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Pénz L6 (`mezo-r36n9.104`): Pénzem, the digest at the bottom of Ma, the analysis page, the sleeve page

// The build target is the approved Élet spike round 11 (`EletContent.swift` Pénz `Ma` news + `Pénzem`,
// `EletPenzKit.swift` `ENewsCard` / `ENewsSheet`, screenshots `penz-1-ma`, `penz-2-hirek`, `penz-3-hirelemzes`,
// `penz-6-penzem`). The order of the blocks is the spike's; what the server cannot know yet is said, never drawn:
//   • the practice row has no trades until L7 — it shows the monthly cap and "még nincs kereskedés", not a P/L;
//   • the long sleeve's measure is the server's coverage months, or an honest line when no fixed cost is recorded;
//   • a move with no price behind it is "–", never 0.
// Copy rules (§6): no buy / sell, no urging, no verdict button. A negative figure is never lit in the hue.

/// The spike's colours for „Mi van benne": the greens with the one warm slice fourth.
let penzPortfolioColors: [Color] = [Color(hex: 0x2E8B57), Color(hex: 0x4FBF86), Color(hex: 0x8FDCB4), Color(hex: 0xF2994A),
                                    Color(hex: 0xC9EFD9)]

/// The spike's glyphs for the L6 section heads.
func penzL6SectionGlyph(_ label: String) -> String? {
    switch label {
    case "A MAI HÍREK · AMI TÉGED ÉRINT": "search-ink"
    case "A HÁROM REKESZ": "scale-ink"
    case "MI VAN BENNE": "chart-deep"
    case "AMI JÖN A KÖVETKEZŐ HÓNAPOKBAN": "clock-ink"
    case "GYAKORLÁS": "bolt-ink"
    case "PÉNZEM": "e-penz"
    case "AMI BENNE VAN": "chart-deep"
    default: penzSectionGlyph(label)
    }
}

/// A section with the L6 glyphs.
struct PenzL6Section<Content: View>: View {
    let label: String
    var state: NKBlockState = .ready
    @ViewBuilder let content: () -> Content
    var body: some View {
        NKBare(label, hue: penzHue, glyph: penzL6SectionGlyph(label), state: state, content: content)
    }
}

// MARK: - The digest (bottom of Ma)

struct PenzDigestBlock: View {
    let store: PenzStore?
    let open: (PenzSheet) -> Void
    let openNews: (PenzNewsCardModel) -> Void
    let openPenzem: () -> Void
    private let hue = penzHue

    var body: some View {
        let view = penzDigestView(digest: store?.digest?.value, problem: store?.digestProblem, portfolio: store?.portfolio?.value)
        let stale = store?.digestOffline == true ? store?.digestAgeText.map { NKStale(age: $0, loud: true) } : nil
        PenzL6Section(label: "A MAI HÍREK · AMI TÉGED ÉRINT", state: state(view)) {
            VStack(alignment: .leading, spacing: 12) {
                switch view {
                case .items(let cards):
                    ForEach(cards) { c in
                        NKNewsCard(hue: hue, holding: c.holding, sleeve: c.sleeve, holdingGlyph: c.holdingGlyph, title: c.title,
                                   effect: penzOutfit(c.effect), effectNote: c.effectNote, negative: c.negative, verdict: c.verdict,
                                   confidence: c.confidence, confidenceText: c.confidenceText, sourceCount: c.sourceCount) {
                            openNews(c)
                        }
                    }
                case .pending: quiet(penzDigestPendingText)
                case .quiet: quiet(penzDigestQuietText)
                case .unhealthy: NKNoFreshData(penzDigestUnhealthyText)
                case .buildFailed: quiet(penzDigestBuildFailedText)
                case .noHoldings:
                    Button(action: openPenzem) {
                        HStack(alignment: .center, spacing: 10) {
                            NKHueText(penzDigestNoHoldingsText, hue: hue, size: 13.5, opacity: 0.65)
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.4))
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                case .loading, .failed: EmptyView()
                }
            }
        }
        .nkStale(stale)
        NKInfoRow("Hogyan készül ez az összefoglaló?", hue: hue) {
            open(.info(title: "Hogyan készül ez az összefoglaló?", body: penzDigestInfoText))
        }
    }

    private func quiet(_ text: String) -> some View {
        NKHueText(text, hue: hue, size: 13.5, opacity: 0.65).frame(maxWidth: .infinity, alignment: .leading)
    }

    private func state(_ v: PenzDigestView) -> NKBlockState {
        switch v {
        case .loading: return .loading
        case .failed(let line):
            let store = store
            return .failed(line) { Task { await store?.reloadDigest() } }
        default: return .ready
        }
    }
}

// MARK: - The analysis page

/// The analysis behind a news card — the five parts of the spike's `ENewsSheet`, none dropped: what it means to his
/// money (the backend's figure), Boop's reading, how sure and where it could be wrong, the sources, and why there is
/// nothing to do. Two buttons only: ask Boop, or look at the investment. No verdict, no buy / sell.
struct PenzNewsPage: View {
    let item: PenzNewsCardModel
    let onBack: @MainActor @Sendable () -> Void
    let ask: @MainActor @Sendable () -> Void
    let openPenzem: @MainActor @Sendable () -> Void
    @Environment(\.openURL) private var openURL
    private let hue = penzHue

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Pénz · Ma",
                      eyebrow: [item.holding, item.sleeve].filter { !$0.isEmpty }.joined(separator: " · "),
                      title: item.title, sentence: item.when, onBack: onBack) {
            // 1 — what it does to his money. The number comes from the ledger, not from the model.
            NKNewsSection("Mit jelent neked", glyph: "e-penz", hue: hue) {
                NKNewsEffect(effect: penzOutfit(item.effect), note: item.effectNote, negative: item.negative, hue: hue)
                Text("Ezt a számot a rendszer számolta ki a te tételeidből — nem az AI írta.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45)).padding(.top, 8)
                    .fixedSize(horizontal: false, vertical: true)
            }
            // 2 — the reading
            NKNewsSection("Amit Boop gondol róla", glyph: "chat-ink", hue: hue) {
                NKHueText(item.body.isEmpty ? item.verdict : item.body, hue: hue, size: 15, opacity: 0.85)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            // 3 — how sure, and where it could be wrong
            NKNewsSection("Mennyire biztos", glyph: "scale-ink", hue: hue) {
                HStack(spacing: 9) {
                    NKConfidenceDots(level: item.confidence)
                    Text(item.confidenceText).nkFont(15, .semibold).foregroundStyle(NKNews.confidenceColor(item.confidence))
                    Spacer(minLength: 0)
                }
                NKHueText(item.uncertainty, hue: hue, size: 14, opacity: 0.72)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 9)
            }
            // 4 — the sources, named, each openable
            NKNewsSection("Honnan van", glyph: "book-sage", hue: hue) {
                if item.sources.isEmpty {
                    Text("Ehhez a hírhez nem maradt megnyitható forrás.").nkFont(13.5).foregroundStyle(.white.opacity(0.6))
                }
                ForEach(item.sources) { s in
                    Button { if let u = s.url { openURL(u) } } label: {
                        HStack(spacing: 10) {
                            Circle().fill(hue.glow.opacity(0.5)).frame(width: 5, height: 5)
                            Text(s.text).nkFont(14).foregroundStyle(.white.opacity(0.85))
                                .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 6)
                            if s.url != nil {
                                Image(systemName: "arrow.up.right").font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.4))
                            }
                        }
                        .frame(minHeight: 38).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(s.url == nil)
                    .accessibilityHint(s.url == nil ? "" : "Megnyitja a cikket")
                    if s.id < item.sources.count - 1 {
                        Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
                    }
                }
            }
            // 5 — the point of the whole area: most of the time, nothing
            NKNothingToDo(item.noAction, hue: hue)
            PenzActionRow(actions: [
                PenzAction(glyph: "chat-ink", title: "Kérdezek róla", primary: true) { ask() },
                PenzAction(glyph: "search-ink", title: "A befektetésem") { openPenzem() },
            ])
        }
    }
}

// MARK: - Pénzem

struct PenzPenzem: View {
    let store: PenzStore?
    let open: (PenzSheet) -> Void
    let openSleeve: (String) -> Void
    let openPractice: () -> Void
    let ask: () -> Void
    private let hue = penzHue

    var body: some View {
        if let store, let p = store.portfolio?.value {
            if p.isEmpty {
                NKHighlight(hue: hue, label: "Még üres", text: "Még nincs rögzített befektetésed",
                            sub: "Amit a saját platformodon — MBH-nál, Revolutnál vagy máshol — már megvettél, itt rögzítheted, és a *három rekeszbe* sorolom: biztonság (1–3 év), középtáv (5–10 év), hosszú táv (10+ év). Boop soha nem vesz és nem mozgat pénzt helyetted.",
                            actions: [NKHighlightAction("Befektetést rögzítek") { open(.record) }])
                NKInfoRow("Miért évek a hosszú rekesz mérőszáma?", hue: hue) {
                    open(.info(title: "Miért évek a hosszú rekesz mérőszáma?", body: penzCoverageInfoText(nil)))
                }
            } else {
                filled(store, p)
            }
        } else {
            PenzL6Section(label: "PÉNZEM", state: blockState) { EmptyView() }
            actions
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a rekeszeidről") { ask() }
    }

    private var blockState: NKBlockState {
        guard let store else { return .loading }
        if let problem = store.portfolioProblem {
            let line = problem == .offline ? "Nincs net, és még nincs elmentett adatom a befektetéseidről." : penzErrorText(problem)
            return .failed(line) { Task { await store.reloadPortfolio() } }
        }
        return .loading
    }

    private var actions: some View {
        PenzActionRow(actions: [
            PenzAction(glyph: "plus-ink", title: "Befektetést rögzítek", primary: true) { open(.record) },
            PenzAction(glyph: "star-sun", title: "Felosztást kérek") { open(penzAllocationLater) },
        ])
    }

    @ViewBuilder private func filled(_ store: PenzStore, _ p: PenzPortfolio) -> some View {
        let staleText = penzPricesStaleText(p, today: store.today)
        let ageText = store.portfolioOffline ? store.portfolioAgeText : nil
        let stale = (staleText ?? ageText).map { NKStale(age: $0, loud: true) }
        VStack(alignment: .leading, spacing: 10) {
            NKStatRow(penzHeroStats(p).map { s in
                NKStat(value: s.value.map(penzOutfit), unit: s.unit, label: s.label, trend: s.trend, hot: s.hot)
            }, hue: hue)
            if penzNothingPriced(p) {
                NKNoFreshData("Egyik tételedhez sincs friss ár — mindet a vételárán számolom.")
            } else if p.unpricedCount > 0 {
                Text(p.unpricedCount == 1 ? "Egy tételt a vételárán számolok, mert nincs hozzá ár."
                                          : "\(p.unpricedCount) tételt a vételárán számolok, mert nincs hozzájuk ár.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.5)).padding(.horizontal, 10)
            }
        }
        .nkStale(stale)
        actions
        NKInfoRow("Mikoriak ezek az árak?", hue: hue) {
            open(.info(title: "Mikoriak ezek az árak?", body: penzPricesInfoText(p)))
        }
        PenzL6Section(label: "A HÁROM REKESZ") {
            VStack(alignment: .leading, spacing: 0) {
                NKRowList(penzSleeveRows(p).map { r in
                    NKAreaRow(id: r.sleeve, glyph: r.glyph, title: r.title, sub: r.sub, value: penzOutfit(r.value),
                              valueSub: r.valueSub, level: r.level) { openSleeve(r.sleeve) }
                }, hue: hue)
                PenzMoreLink(title: "Egy rekesz megnyitása") { openSleeve(penzLargestSleeve(p)) }
            }
        }
        NKInfoRow("Miért évek a hosszú rekesz mérőszáma?", hue: hue) {
            open(.info(title: "Miért évek a hosszú rekesz mérőszáma?", body: penzCoverageInfoText(p)))
        }
        let parts = penzComposition(p)
        if !parts.isEmpty {
            PenzL6Section(label: "MI VAN BENNE") {
                VStack(alignment: .leading, spacing: 12) {
                    NKComposition(parts.enumerated().map { i, part in
                        NKPart(name: part.name, value: Double(part.valueHufMinor),
                               color: penzPortfolioColors[min(i, penzPortfolioColors.count - 1)])
                    })
                    if let note = penzCompositionNote(p) { NKHueText(note, hue: hue, size: 13, opacity: 0.65) }
                }
            }
        }
        PenzL6Section(label: "AMI JÖN A KÖVETKEZŐ HÓNAPOKBAN") {
            VStack(alignment: .leading, spacing: 0) {
                let rows = penzEventRows(p.events, today: store.today)
                if rows.isEmpty {
                    Text("Még nincs rögzített esemény. Ha egy állampapírod lejár, vagy osztalékot, kamatot vársz, írd be — itt látod majd időrendben.")
                        .nkFont(13.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
                NKRowList(rows.map { r in
                    NKAreaRow(id: r.id, glyph: r.glyph, title: r.title, sub: r.sub, value: penzOutfit(r.value), valueSub: r.valueSub,
                              badge: r.badge)
                }, hue: hue)
                PenzMoreLink(title: "Esemény hozzáadása") { open(.addEvent) }
            }
        }
        PenzL6Section(label: "GYAKORLÁS") {
            VStack(alignment: .leading, spacing: 0) {
                let line = penzPracticeLine(p.practice)
                NKRowList([NKAreaRow(id: "practice", glyph: "bolt-ink", title: line.title, sub: line.sub,
                                     value: penzOutfit(line.value), valueSub: line.valueSub,
                                     chips: line.chip.map { [$0] } ?? []) { openPractice() }],
                          hue: hue)
                PenzMoreLink(title: "Át a Gyakorlás oldalra") { openPractice() }
            }
        }
    }
}

/// The sleeve the "Egy rekesz megnyitása" link opens: the largest one.
func penzLargestSleeve(_ p: PenzPortfolio) -> String {
    penzSleeves(p).max { $0.valueHufMinor < $1.valueHufMinor }?.sleeve ?? "long"
}

let penzAllocationLater = PenzSheet.later(title: "Felosztást kérek", line: "Itt fogok felosztást javasolni: mennyi menjen a biztonsági, a közép- és a hosszú távú rekeszbe, két-három konkrét lehetőséggel és azzal, hogy miért. Ez egy későbbi lépésben érkezik — addig semmit nem javaslok, amit nem tudok alátámasztani.")

// MARK: - One sleeve

struct PenzSleevePage: View {
    let store: PenzStore
    let sleeve: String
    let onBack: @MainActor @Sendable () -> Void
    let record: @MainActor @Sendable () -> Void
    private let hue = penzHue

    var body: some View {
        let p = store.portfolio?.value
        let s = p.map { penzSleeves($0) }?.first { $0.sleeve == sleeve } ?? PenzSleeve(sleeve: sleeve, valueHufMinor: 0)
        let row = p.flatMap { penzSleeveRows($0).first { $0.sleeve == sleeve } }
        NKAreaSubPage(hue: hue, crumb: "Pénz · Pénzem", eyebrow: "A három rekesz", title: penzSleeveTitle(sleeve),
                      sentence: sentence(s), onBack: onBack) {
            if let row {
                NKStatRow([NKStat(value: penzOutfit(row.value), unit: "Ft", label: "ennyi van benne"),
                           NKStat(value: penzPct(s.sharePct, signed: false), unit: "%", label: "a teljes pénzedből")], hue: hue)
            }
            PenzL6Section(label: "AMI BENNE VAN") {
                VStack(alignment: .leading, spacing: 0) {
                    let rows = penzPositionRows(s)
                    if rows.isEmpty {
                        Text("Ebben a rekeszben még nincs semmi.").nkFont(13.5).foregroundStyle(.white.opacity(0.6))
                    }
                    NKRowList(rows.map { r in
                        NKAreaRow(id: r.id, glyph: r.glyph, title: r.title, sub: r.sub, value: penzOutfit(r.value),
                                  valueSub: r.valueSub, level: r.level, chips: r.atCost ? ["vételáron"] : [])
                    }, hue: hue)
                    PenzMoreLink(title: "Befektetést rögzítek") { record() }
                }
            }
        }
    }

    private func sentence(_ s: PenzSleeve) -> String {
        switch sleeve {
        case "short": return "Biztonság: ami egy-három éven belül kellhet."
        case "mid": return "Középtáv: öt-tíz évre félretett pénz."
        default: return s.holdings.isEmpty ? "Hosszú táv: tíz évnél tovább." : penzCoverageSentence(s.coverageMonths)
        }
    }
}
