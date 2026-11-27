import SwiftUI
import BoopCore
import BoopDesign

/// One judged day as a line: "2410 / 2440 kcal · edzés megvolt · 7 ó 20 p alvás"; a day off reads its reason.
func evadDayLine(_ d: EvadAdherenceDay) -> String {
    if d.excused { return "kímélő nap\(d.excuse.map { " — \($0)" } ?? "")" }
    if !d.judged { return "nincs adat" }
    var parts: [String] = []
    if let k = d.kcal { parts.append(d.targetKcal.map { "\(k) / \($0) kcal" } ?? "\(k) kcal") }
    if d.sessionPlanned { parts.append(d.sessionDone == true ? "edzés megvolt" : "edzés kimaradt") }
    if let s = d.sleepMin { parts.append("\(evadHM(s)) alvás") }
    return parts.isEmpty ? "nincs adat" : parts.joined(separator: " · ")
}

/// Évad › Most › **A hét napról napra**: each lived day of the week with what was judged on it. A tap opens the day in
/// Nap › Napok.
struct EvadDaysPage: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?
    @Environment(\.openDestination) private var openDestination

    var body: some View {
        let monday = kapacitasMonday(for: BoopClock.now())
        let days = store?.week?.days ?? []
        let dots = evadDayDots(monday: monday, days: days, today: evadYMD(BoopClock.now()))
        NKAreaSubPage(hue: evadHue, crumb: "Évad › Most", eyebrow: "A hét napról napra", title: "Melyik nap hogy ment",
                      sentence: "Hétfőtől tegnapig: az étel a kereten belül, az edzés, és az alvás.", onBack: close) {
            EvadCard("A hét napjai", glyph: "het-ink") {
                VStack(spacing: 14) {
                    ForEach(Array(dots.enumerated()).filter { ![.today, .future].contains($0.element.state) }, id: \.element.date) { i, dot in
                        let d = days.first { $0.date == dot.date }
                        EvadRow(glyph: glyph(dot.state), title: evadDayNames[i].capitalized,
                                sub: d.map(evadDayLine) ?? "nincs adat",
                                action: { close(); openDestination(.nap(.napok)) })
                    }
                    if dots.allSatisfy({ [.today, .future].contains($0.state) }) {
                        EvadText("A hét most kezdődött — holnap már látod, hogy indult.")
                    }
                }
            }
            if let a = store?.week?.summary, a.excusedDays > 0 { EvadText(evadExcusedLine(a.excusedDays), size: 12.5, opacity: 0.55) }
        }
    }

    private func glyph(_ s: EvadDayState) -> String {
        switch s {
        case .inPlan: "check-ink"
        case .kimelo: "moon-cream"
        default: "clock-ink"
        }
    }
}
