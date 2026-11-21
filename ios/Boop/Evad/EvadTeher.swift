import SwiftUI
import BoopCore
import BoopDesign

/// The Évad tab's *Teher és pihenés* block and *Mennyit bírsz az évadban* stats (B7 K2, `mezo-r36n9.17`): the season's
/// weekly load against recovery, from `GET /api/capacity/season`. A season with no data (404), or no net and nothing
/// cached, leaves both blocks out — they are an extra, never an error. Weeks after today (the plan) are drawn faint.
struct EvadTeher: View {
    @Environment(KapacitasStore.self) private var store: KapacitasStore?

    var body: some View {
        Group {
            if let s = store?.season, !s.weeks.isEmpty {
                NKBare("Teher és pihenés", hue: evadHue, glyph: "chart-deep", trailing: "hetente") {
                    NKSeasonLoadChart(weeks: evadLoadWeeks(s), nowIndex: s.weeks.firstIndex { $0.week == s.nowWeek }, hue: evadHue)
                    if let headline = s.headline {
                        Text(headline).nkFont(13.5).foregroundStyle(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Text("A teher az edzés és a naptárad együtt. A pihenés az alvásodból és a pulzusodból jön. A \(s.nowWeek). hét után a terv, halványan.")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                }
                .nkStale(store?.ageText.map { NKStale(age: $0) })
                // first read happens when the store is made (RootView); opening the tab refreshes it
                .task { await store?.load(force: true) }
                NKBare("Mennyit bírsz az évadban", hue: evadHue, glyph: "bolt-ink") {
                    NKStatRow([NKStat(value: "\(s.stats.overloadedDays4w)", label: "túl sok nap az elmúlt 4 hétben"),
                               NKStat(value: "\(s.stats.moves)", label: "mozgatás az évadban", hot: true),
                               NKStat(value: "\(s.stats.movesGood)", target: "\(s.stats.moves)", label: "sült el jól")],
                              hue: evadHue)
                }
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
