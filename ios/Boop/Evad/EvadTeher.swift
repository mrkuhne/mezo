import SwiftUI
import BoopCore
import BoopDesign

/// The Évad tab's *Teher és pihenés* block and *Mennyit bírsz az évadban* stats (B7 K2, `mezo-r36n9.17`): the season's
/// weekly load against recovery, from `GET /api/capacity/season`. A season with no data (404), or no net and nothing
/// cached, leaves both blocks out — they are an extra, never an error. Weeks after today (the plan) are drawn faint.
///
/// K4: under the chart the advisory lighter-week card (owner decision #121 „Csak szóljon": it only tells — its one action
/// opens the Boop chat, nothing is written), and at the bottom *Amit a mozgatásokból tanultam*, the server's shown
/// patterns.
struct EvadTeher: View {
    /// B7 K3: *A jövő heted* opens the next week's Átrendezés page (EvadPage presents it).
    var openAtrendezes: @MainActor @Sendable () -> Void = {}
    @Environment(KapacitasStore.self) private var store: KapacitasStore?
    @Environment(\.openDestination) private var openDestination

    private var nextMonday: String { kapacitasNextMonday(after: kapacitasMonday(for: Date())) }

    var body: some View {
        Group {
            if let s = store?.season, !s.weeks.isEmpty {
                NKBare("Teher és pihenés", hue: evadHue, glyph: "chart-deep", trailing: "hetente") {
                    NKSeasonLoadChart(weeks: evadLoadWeeks(s), nowIndex: s.weeks.firstIndex { $0.week == s.nowWeek }, hue: evadHue)
                    if let headline = s.headline {
                        Text(headline).nkFont(13.5).foregroundStyle(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Text(evadLoadFootnote(nowWeek: s.nowWeek))
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                }
                .nkStale(store?.ageText.map { NKStale(age: $0) })
                // first read happens when the store is made (RootView); opening the tab refreshes it
                .task { await store?.load(force: true) }
                if let hint = s.deloadForward {
                    NKHighlight(hue: evadHue, label: "Boop javaslata", text: hint.title, sub: hint.body,
                                actions: [NKHighlightAction("Megbeszélem Boop-pal", action: { openDestination(.chat) })])
                }
            }
            nextWeek
            if let s = store?.season, !s.weeks.isEmpty {
                NKBare("Mennyit bírsz az évadban", hue: evadHue, glyph: "bolt-ink") {
                    NKStatRow(kapacitasSeasonStats(s.stats).map {
                        NKStat(value: $0.value, target: $0.target, label: $0.label, hot: $0.hot)
                    }, hue: evadHue)
                }
                if !s.patterns.isEmpty {
                    NKBare("Amit a mozgatásokból tanultam", hue: evadHue, glyph: "spark-cream") {
                        NKList(kapacitasPatternRows(s.patterns), hue: evadHue)
                    }
                }
            }
        }
    }

    /// *A jövő heted* (spike KapSeasonPage): the next week's strip and the way into its proposals — only while it has
    /// open proposals.
    @ViewBuilder private var nextWeek: some View {
        let m = nextMonday
        if let week = store?.weeks[m], let n = store?.openCount(monday: m), n > 0 {
            NKBare("A jövő heted", hue: evadHue, glyph: "clock-ink", trailing: kapacitasWeekLabel(monday: m)) {
                KapWeekStrip(week: week, hue: evadHue)
                NKInfoRow("\(n) javaslatom van rá · Átrendezés", hue: evadHue, action: openAtrendezes)
            }
            .nkStale(store?.weekAgeText(m).map { NKStale(age: $0) })
        }
    }
}

/// The server's weeks as the chart's: a planned week or a training-only one is faint, and "over" counts only for a
/// week that has really been lived.
func evadLoadWeeks(_ s: KapacitasSeasonLoad) -> [NKLoadWeek] {
    s.weeks.map { w in
        let faint = w.planned || w.trainingOnly
        return NKLoadWeek(label: "\(w.week).", load: w.load, recovery: w.recovery, over: w.over && !faint, faint: faint)
    }
}
