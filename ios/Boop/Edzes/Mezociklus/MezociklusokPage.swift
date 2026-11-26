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
                NKBare("MEZOCIKLUSAIM", hue: hue) {
                    HStack(spacing: 10) {
                        ProgressView().tint(.white)
                        Text("Betöltöm a mezociklusaidat…").nkFont(14).foregroundStyle(.white.opacity(0.7))
                    }
                    .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
                }
            case .failed(let e):
                NKBare("MEZOCIKLUSAIM", hue: hue) {
                    VStack(alignment: .leading, spacing: 12) {
                        NKNoFreshData(MezociklusokModel.message(e))
                        MezoButton(title: "Újra", style: .secondary) { Task { await model.load() } }
                    }
                }
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
        .refreshable { await model.load() }
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

    @ViewBuilder private var sections: some View {
        if let running = g.running { hero(running) }
        if !g.upcoming.isEmpty {
            NKBare("KÖVETKEZIK", hue: hue, glyph: "clock-ink") {
                VStack(spacing: 12) { ForEach(g.upcoming) { plannedCard($0) } }
            }
        }
        if !g.templates.isEmpty {
            NKBare("SABLONJAIM", hue: hue, glyph: "book-sage", trailing: "\(g.templates.count)") {
                NKCarousel(g.templates, hue: hue, height: min(templateCardHeight, 480), widthFraction: 0.62) { templateCard($0) }
            }
        }
        if !g.closed.isEmpty {
            NKBare("LEZÁRTAK", hue: hue, glyph: "check-ink") {
                VStack(spacing: 12) { ForEach(g.closed) { closedCard($0) } }
            }
        }
    }

    /// The running one, big: the weeks with today lit, the body it trains. Tapping it goes back to the tab, where it lives.
    private func hero(_ m: MezoCard) -> some View {
        Button(action: onBack) {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("MOST FUT").nkFont(10.5, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
                    Text(m.title).nkFont(26, design: .serif).foregroundStyle(.white)
                    Text("\(m.currentWeek). hét \(mezoOf(m.weeks))\(m.split.map { " · \($0)" } ?? "")")
                        .nkFont(13).foregroundStyle(.white.opacity(0.65))
                }
                HStack(alignment: .bottom, spacing: 14) {
                    NKBlockTimeline(mezoTimeline(m), hue: hue).frame(maxWidth: .infinity)
                    if !m.heat.isEmpty {
                        NKBodyMap(mezoHeat(m), hue: hue, views: .front).frame(width: 64, height: 110).accessibilityHidden(true)
                    }
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(LinearGradient(colors: [hue.glow.opacity(0.28), .clear], startPoint: .topTrailing, endPoint: .bottomLeading))
            }
            .nkGlass(28)
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
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
                VStack(alignment: .leading, spacing: 4) {
                    Text(m.title).nkFont(18, design: .serif).foregroundStyle(.white)
                    Text(mezoLine(m)).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                MezoMiniCurve(loads: m.loads).frame(width: 64)
            }
            .padding(14).nkGlass(22).contentShape(RoundedRectangle(cornerRadius: 22))
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
            .nkGlass(24)
            .contentShape(RoundedRectangle(cornerRadius: 24))
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
            .padding(14).nkGlass(22).contentShape(RoundedRectangle(cornerRadius: 22))
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
