import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The words and numbers of the sleep sheet

/// One legend row: stage 0 awake · 1 REM · 2 light · 3 deep.
struct SleepLegendRow: Equatable { let stage: Int, label: String, time: String, share: Double }

private let stageLabels = ["Ébren", "REM", "Könnyű", "Mély"]

/// "30p" / "1ó 30p".
func shortDuration(_ minutes: Int) -> String { minutes < 60 ? "\(minutes)p" : hoursMinutes(minutes) }

/// The legend from the stage minutes the server sent; where all of them are missing, from the hypnogram. A stage with
/// no minutes is left out; shares are of the stages shown.
func sleepLegend(deep: Int?, rem: Int?, light: Int?, awake: Int?, hypnogram: [(stage: Int, minutes: Int)]) -> [SleepLegendRow] {
    var minutes: [Int?] = [awake, rem, light, deep]
    if minutes.allSatisfy({ $0 == nil }) {
        let sums = Dictionary(grouping: hypnogram, by: \.stage).mapValues { $0.map(\.minutes).reduce(0, +) }
        minutes = (0..<4).map { sums[$0] }
    }
    let total = minutes.compactMap { $0 }.reduce(0, +)
    guard total > 0 else { return [] }
    return (0..<4).compactMap { st in
        guard let m = minutes[st], m > 0 else { return nil }
        return SleepLegendRow(stage: st, label: stageLabels[st], time: shortDuration(m), share: Double(m) / Double(total))
    }
}

/// `count` evenly spaced clock times across a span starting at `start` ("HH:mm"); empty when `start` is unreadable.
func axisTimes(start: String, minutes: Int, count: Int) -> [String] {
    let p = start.split(separator: ":")
    guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]), count > 1 else { return [] }
    return (0..<count).map { k in
        let t = ((h * 60 + m + minutes * k / (count - 1)) % 1440 + 1440) % 1440
        return String(format: "%02d:%02d", t / 60, t % 60)
    }
}

// MARK: - The sheet (spec §5.4 Alvás, spike AuraSheets)

/// Last night: Mély / Elalvás tiles, the hypnogram with its legend, seven days of deep sleep, Boop's sentence.
struct SleepSheet: View {
    let brief: Brief

    var body: some View {
        let s = brief.day.sleep
        NKSheetFrame(hue: .alvas, eyebrow: "Alvás · ma éjjel", title: s.map { "\(hoursMinutes($0.totalMin)) alvás" } ?? "Nincs adat") {
            if let s {
                tiles(s)
                stages(s)
            } else {
                SheetCard(title: "AZ ÉJSZAKA") {
                    SheetEmptyLine(text: "Erről az éjszakáról nincs alvásadatom. Ha az órád rögzítette, a következő frissítés után itt lesz.")
                }
            }
            week
            boopVerdict(brief.metric(.alvas))
        }
    }

    private func tiles(_ s: Brief.Sleep) -> some View {
        HStack(spacing: 12) {
            if let deep = s.deepMin {
                let delta = deepDelta(deep: deep, week: brief.day.deepSleepWeek)
                SheetTile(label: "MÉLY", value: hoursMinutes(deep),
                          note: delta.map { $0 == 0 ? "mint a heti átlag" : "\(signed($0, unit: " p")) a heti átlaghoz" } ?? "a legpihentetőbb szakasz",
                          up: delta.flatMap { $0 == 0 ? nil : $0 > 0 })
            } else {
                SheetTile(label: "MÉLY", value: "–", note: "nincs szakaszadat")
            }
            SheetTile(label: "ELALVÁS", value: s.bedtime, note: "ébredés \(s.wakeup)")
        }
    }

    private func stages(_ s: Brief.Sleep) -> some View {
        let segs = s.hypnogram.map { (stage: $0.stage, minutes: $0.minutes) }
        let legend = sleepLegend(deep: s.deepMin, rem: s.remMin, light: s.lightMin, awake: s.awakeMin, hypnogram: segs)
        let span = segs.map(\.minutes).reduce(0, +)
        return SheetCard(title: "SZAKASZOK") {
            if segs.isEmpty {
                SheetEmptyLine(text: "Az alvásszakaszaidat erről az éjszakáról nem látom, csak a teljes időt.")
            } else {
                Hypnogram(segments: segs.map { (stage: $0.stage, minutes: Double($0.minutes)) }).frame(height: 110).padding(.top, 14)
                    .accessibilityLabel("Alvásszakaszok")
                HStack {
                    ForEach(Array(axisTimes(start: s.bedtime, minutes: span, count: 4).enumerated()), id: \.offset) { i, t in
                        if i > 0 { Spacer() }
                        Text(t)
                    }
                }
                .nkFont(11, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.45)).padding(.top, 6)
            }
            if !legend.isEmpty {
                HypnogramLegend(rows: legend.map { .init(stage: $0.stage, label: $0.label, time: $0.time, share: $0.share) })
                    .padding(.top, 16)
            }
        }
    }

    private var week: some View {
        SheetCard(title: "MÉLYALVÁS · 7 NAP") {
            if let w = weekSeries(brief.day.deepSleepWeek) {
                WeekBars(values: w.values, average: w.average, unit: "p",
                         labels: weekLabels(endingOn: brief.date, count: w.values.count))
                    .frame(height: 140).padding(.top, 12)
            } else {
                SheetEmptyLine(text: "Ezen a héten még nincs mélyalvás-adatom.")
            }
        }
    }
}
