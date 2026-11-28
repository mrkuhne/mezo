import SwiftUI
import BoopCore
import BoopDesign

/// Mezociklusaim (mezo-r36n9.177, spike `MezociklusokPageSpike` round 2): the running one big, the planned ones by
/// date, the templates as a carousel, the closed ones with their rings. Every card opens its detail page — nothing
/// here starts anything.
struct MezociklusokPage: View {
    let model: MezociklusokModel
    let plan: PlanClient
    let hue: Hue
    let onBack: () -> Void
    /// A mezociklus started from a detail page: the whole stack closes back to the tab with this line.
    let onStarted: (String) -> Void
    @State private var open: MezoCard?
    @ScaledMetric(relativeTo: .body) private var templateCardHeight: CGFloat = 236

    private var g: MezoGroups { model.groups }

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Edzés · Mezociklus", eyebrow: "Mezociklusaim", title: headline,
                      sentence: "Koppints bármelyikre: előbb megnézed, utána döntesz, hogy indítod, szerkeszted vagy csak átnézed.",
                      onBack: onBack) {
            switch model.phase {
            case .loading:
                NKSectionCard("Mezociklusaim", hue: hue, state: .loading) { EmptyView() }
            case .failed(let e):
                NKSectionCard("Mezociklusaim", hue: hue,
                              state: .failed(MezociklusokModel.message(e), { Task { await model.load() } })) { EmptyView() }
            case .ready:
                if let age = model.ageText {
                    NKNote("Most nem érem el a szervert: ez a \(age) mentett lista. Net nélkül csak nézni tudod, indítani és szerkeszteni nem.", hue: hue)
                }
                if g.isEmpty {
                    NKNotLiveYet(hue: hue, title: "Még nincs mezociklusod — indíts egyet",
                                 line: "Az Új mezociklus gombbal a Mezociklus fülön indíthatsz egyet; utána itt lesz minden futó, lezárt és sablon.", eyebrow: "MÉG ÜRES")
                } else {
                    sections
                }
            }
        }
        .task { await model.load() }
        .fullScreenCover(item: $open) { card in
            MezoDetailPage(card: card, model: model, plan: plan, hue: hue,
                           onBack: { open = nil },
                           onStarted: { message in open = nil; onStarted(message) })
        }
    }

    private var headline: String {
        let runs = (g.running == nil ? 0 : 1) + g.closed.count
        guard runs > 0 else { return "Mezociklusaim" }
        let weeks = g.closed.reduce(0) { $0 + $1.weeks } + (g.running?.currentWeek ?? 0)
        return "Eddig \(runs) mezociklus, \(weeks) hét edzés"
    }

    /// Edzés redesign (spec 2026-11-27 §5.4, mezo-r36n9.197.4): the running one as the hero, then one glass card per
    /// group — the planned and the closed ones as rows inside their card, the templates as a card row.
    @ViewBuilder private var sections: some View {
        if let running = g.running { hero(running) }
        if !g.upcoming.isEmpty {
            NKSectionCard("Következik", hue: hue, glyph: "clock-ink") {
                rows(g.upcoming) { plannedCard($0) }
            }
        }
        if !g.templates.isEmpty {
            NKSectionCard("Sablonjaim", hue: hue, glyph: "book-sage", trailing: .text("\(g.templates.count)")) {
                NKCarousel(g.templates, hue: hue, height: min(templateCardHeight, 480), widthFraction: 0.62) { templateCard($0) }
            }
        }
        if !g.closed.isEmpty {
            // Newest first (`mezoCards` sorts them by their close).
            NKSectionCard("Lezártak", hue: hue, glyph: "check-ink", trailing: .text("\(g.closed.count)")) {
                rows(g.closed) { closedCard($0) }
            }
        }
    }

    /// Rows inside one card, a hairline between them.
    private func rows<Row: View>(_ cards: [MezoCard], @ViewBuilder row: @escaping (MezoCard) -> Row) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(cards.enumerated()), id: \.element.id) { i, m in
                if i > 0 { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5) }
                row(m)
            }
        }
    }

    /// The running one, big: the weeks with today lit, the body it trains. Tapping it goes back to the tab, where it lives.
    private func hero(_ m: MezoCard) -> some View {
        Button(action: onBack) {
            MezoPageHero(label: "Most fut", hue: hue, glyph: "cycle-ink") {
                VStack(alignment: .leading, spacing: 6) {
                    MezoHeroTitle(text: m.title)
                    Text("\(m.currentWeek). hét \(mezoOf(m.weeks))\(m.split.map { " · \($0)" } ?? "")")
                        .nkFont(13.5).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
                }
                HStack(alignment: .bottom, spacing: 14) {
                    EdzesWeeksArc(weeks: mezoTimeline(m), hue: hue).frame(maxWidth: .infinity)
                    if !m.heat.isEmpty {
                        NKBodyMap(mezoHeat(m), hue: hue, views: .front).frame(width: 56, height: 96).accessibilityHidden(true)
                    }
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: 28))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Most fut: \(m.title), \(m.currentWeek). hét \(mezoOf(m.weeks))")
        .accessibilityHint("Vissza a Mezociklus fülre")
        .accessibilityAddTraits(.isButton)
    }

    private func plannedCard(_ m: MezoCard) -> some View {
        Button { open = m } label: {
            HStack(spacing: 14) {
                let date = mezoDateParts(m.dateText)
                VStack(spacing: 2) {
                    Text(date.month).nkFont(11, .semibold, design: .monospaced).foregroundStyle(hue.glow)
                    Text(date.day).nkFont(26, .semibold).foregroundStyle(.white)
                }
                .frame(width: 58, height: 64)
                .nkInnerCard(radius: 16)
                VStack(alignment: .leading, spacing: 4) {
                    Text(m.title).nkFont(18, design: .serif).foregroundStyle(.white)
                    Text(mezoLine(m)).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                MezoMiniCurve(loads: m.loads).frame(width: 64)
            }
            .padding(.vertical, 12).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Következik: \(m.title), \(m.dateText), \(mezoLine(m))")
        .accessibilityHint("Megnyitja; innen indíthatod")
        .accessibilityAddTraits(.isButton)
    }

    private func templateCard(_ m: MezoCard) -> some View {
        Button { open = m } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    if !m.heat.isEmpty {
                        NKBodyMap(mezoHeat(m), hue: hue, views: .front).frame(width: 52, height: 88)
                    }
                    Spacer()
                    Text(m.runCount == 0 ? "ÚJ" : "\(m.runCount)×")
                        .nkFont(11, .semibold, design: .monospaced).foregroundStyle(m.runCount == 0 ? NK.ground : .white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Capsule().fill(m.runCount == 0 ? AnyShapeStyle(hue.glow) : AnyShapeStyle(.white.opacity(0.12))))
                }
                Spacer(minLength: 0)
                MezoMiniCurve(loads: m.loads, lit: true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.title).nkFont(18, design: .serif).foregroundStyle(.white).lineLimit(1)
                    Text(mezoLine(m)).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .nkInnerCard(radius: 20)
            .contentShape(RoundedRectangle(cornerRadius: 20))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Sablon: \(m.title), \(mezoLine(m)), \(m.runCount == 0 ? "még nem futott" : "\(m.runCount)-szor futott")")
        .accessibilityHint("Megnyitja; semmi nem indul el")
        .accessibilityAddTraits(.isButton)
    }

    private func closedCard(_ m: MezoCard) -> some View {
        Button { open = m } label: {
            HStack(spacing: 14) {
                MezoRing(value: m.adherence, hue: hue, size: 54)
                VStack(alignment: .leading, spacing: 4) {
                    Text(m.title).nkFont(17, design: .serif).foregroundStyle(.white)
                    Text(m.dateText).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                    HStack(spacing: 6) {
                        if let split = m.split { MezoTag(text: split, hue: hue) }
                        MezoTag(text: "\(m.weeks) hét", hue: hue)
                        MezoTag(text: m.hasReport ? "jelentés" : "nincs jelentés", lit: m.hasReport, hue: hue)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                MezoMiniCurve(loads: m.loads).frame(width: 52).opacity(0.8)
            }
            .padding(.vertical, 12).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Lezárt: \(m.title), \(m.dateText)\(m.adherence.map { ", \(Int(($0 * 100).rounded())) százalék kész" } ?? "")\(m.hasReport ? ", van zárójelentés" : "")")
        .accessibilityHint("Megnyitja")
        .accessibilityAddTraits(.isButton)
    }
}

/// „jan. 5-től" → („JAN", „5") for the date card.
func mezoDateParts(_ text: String) -> (month: String, day: String) {
    let parts = text.split(separator: " ")
    guard parts.count >= 2 else { return ("", "–") }
    let month = parts[0].replacingOccurrences(of: ".", with: "").uppercased()
    let day = parts[1].prefix { $0.isNumber }
    return (month, day.isEmpty ? "–" : String(day))
}

/// The hero card of a Mezociklus sub-page (Edzés redesign, spec 2026-11-27 §5.4, mezo-r36n9.197.4): the page's one
/// point, a larger glass card than the section cards below it, with the same hue-tick head and an optional trailing
/// slot (a „…" menu, an age).
struct MezoPageHero<Content: View>: View {
    let label: String
    let hue: Hue
    var glyph: String? = nil
    var trailing: AnyView? = nil
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Capsule().fill(hue.glow).frame(width: 3, height: 13)
                if let glyph { NKGlyph(glyph, hue.glow.opacity(0.9), size: 14) }
                Text(label.uppercased()).nkFont(12, .medium, design: .monospaced).tracking(1.4)
                    .foregroundStyle(.white.opacity(0.6))
                    .dynamicTypeSize(...DynamicTypeSize.accessibility2)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 8)
                if let trailing { trailing }
            }
            .frame(minHeight: 28)
            content()
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(28)
    }
}

/// A hero's title: wraps between words, shrinks a little before it would break inside one, stops growing past the
/// first accessibility size (spike glitch „Hypertrop / hy").
struct MezoHeroTitle: View {
    let text: String
    var body: some View {
        Text(text).nkFont(24, .semibold).foregroundStyle(.white)
            .lineLimit(3).minimumScaleFactor(0.8)
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
            .fixedSize(horizontal: false, vertical: true)
    }
}
