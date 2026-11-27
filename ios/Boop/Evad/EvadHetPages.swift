import SwiftUI
import BoopCore
import BoopDesign

/// Évad › Hét › **Teher és pihenés**: the season's weekly load against recovery, large, with the footnote. A season with
/// no load data says so instead of drawing an empty chart.
struct EvadLoadPage: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(KapacitasStore.self) private var store: KapacitasStore?

    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad › Hét", eyebrow: "Teher és pihenés", title: "Hogyan bírod az évadot",
                      sentence: "Hétről hétre a teher (edzés és naptár) és a pihenés (alvás és pulzus).", onBack: close) {
            if let s = store?.season, !s.weeks.isEmpty {
                EvadCard("Hetente", glyph: "bolt-ink", trailing: "\(s.weeks.count) hét") {
                    VStack(alignment: .leading, spacing: 12) {
                        NKSeasonLoadChart(weeks: evadLoadWeeks(s), nowIndex: s.weeks.firstIndex { $0.week == s.nowWeek }, hue: evadHue)
                            .frame(minHeight: 180)
                        if let h = s.headline { EvadText(h, size: 15, opacity: 0.88) }
                        EvadText(evadLoadFootnote(nowWeek: s.nowWeek), size: 12.5, opacity: 0.55)
                    }
                }
                .nkStale(store?.ageText.map { NKStale(age: $0) })
            } else {
                EvadText("Még nincs elég adat a teherhez — néhány nap edzés és alvás után megjelenik.")
            }
        }
        .task { await store?.load(force: true) }
    }
}

/// Évad › Hét › **Amit Boop tanult**: the numbers about him, the patterns of his moves, and at most three things Boop
/// noticed.
struct EvadLearnedPage: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(KapacitasStore.self) private var kapacitas: KapacitasStore?
    @Environment(EvadStore.self) private var store: EvadStore?

    var body: some View {
        let insights = Array((store?.overview?.insights ?? []).prefix(3))
        let n = evadLearnedCount(season: kapacitas?.season, insights: store?.overview?.insights ?? [])
        NKAreaSubPage(hue: evadHue, crumb: "Évad › Hét", eyebrow: "Amit Boop tanult",
                      title: n > 0 ? "\(n) dolog, amit már tudok rólad" : "Még tanulom, milyen vagy",
                      sentence: "Számok a hétköznapjaidról, minták a heteidből, és amit Boop észrevett.", onBack: close) {
            if let s = kapacitas?.season, !s.weeks.isEmpty {
                let stats = kapacitasSeasonStats(s.stats)
                EvadCard("Mennyit bírsz", glyph: "bolt-ink", trailing: "\(stats.count) szám") {
                    NKStatRow(stats.map { NKStat(value: $0.value, target: $0.target, label: $0.label, hot: $0.hot) }, hue: evadHue)
                }
                if !s.patterns.isEmpty {
                    EvadCard("Amit a mozgatásokból tanultam", glyph: "repeat-deep", trailing: "\(s.patterns.count) minta") {
                        NKList(kapacitasPatternRows(s.patterns), hue: evadHue)
                    }
                }
            }
            if !insights.isEmpty {
                EvadCard("Amit Boop észrevett", glyph: "spark-cream", trailing: "\(insights.count)") {
                    NKList(insights.map { (title: $0.title, body: $0.body) }, hue: evadHue)
                }
            }
            if n == 0 {
                EvadText("Pár hét adat kell, hogy mintákat lássak. Addig is minden nap számít.")
            }
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
