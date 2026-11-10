import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The sheet (spec §5.4 Nyugalmi pulzus, §9.3)

/// Resting pulse: the week's average and today's change against it, seven days of resting pulse, today's
/// min · avg · max, Boop's sentence. No per-night pulse line and no HRV: v1 stores neither (spec §9.3).
struct PulseSheet: View {
    let brief: Brief

    private var today: Int? { brief.day.restingHrWeek.last ?? nil }

    var body: some View {
        let week = weekSeries(brief.day.restingHrWeek)
        NKSheetFrame(hue: .pulzus, eyebrow: "Nyugalmi pulzus", title: today.map { "\($0) ütés / perc" } ?? "Ma még nincs mérés") {
            if let week { tiles(week.average) }
            SheetCard(title: "NYUGALMI PULZUS · 7 NAP") {
                if let week {
                    WeekBars(values: week.values, average: week.average, unit: "",
                             labels: weekLabels(endingOn: brief.date, count: week.values.count))
                        .frame(height: 140).padding(.top, 12)
                } else {
                    SheetEmptyLine(text: "Ezen a héten még nincs nyugalmipulzus-adatom.")
                }
            }
            todayCard
            boopVerdict(brief.metric(.pulzus))
        }
    }

    private func tiles(_ avg: Double) -> some View {
        let n = brief.day.restingHrWeek.compactMap { $0 }.count
        let change = today.map { Int((Double($0) - avg).rounded()) }
        return HStack(spacing: 12) {
            SheetTile(label: "HETI ÁTLAG", value: "\(Int(avg.rounded()))", note: "\(n) nap alapján")
            // lower than usual = rested: the triangle points up (better)
            SheetTile(label: "MA", value: change.map { $0 == 0 ? "±0" : signed($0) } ?? "–",
                      note: change == nil ? "ma még nincs mérés" : "a heti átlaghoz",
                      up: change.flatMap { $0 == 0 ? nil : $0 < 0 })
        }
    }

    private var todayCard: some View {
        let hr = brief.day.hrToday
        let values = [hr?.min, hr?.avg, hr?.max]
        return SheetCard(title: "PULZUS MA") {
            if values.allSatisfy({ $0 == nil }) {
                SheetEmptyLine(text: "Ma még nincs pulzusadatom.")
            } else {
                HStack(alignment: .firstTextBaseline) {
                    ForEach(0..<3, id: \.self) { i in
                        VStack(alignment: i == 0 ? .leading : i == 1 ? .center : .trailing, spacing: 2) {
                            Text(values[i].map(String.init) ?? "–").font(.nkNumber(30)).foregroundStyle(.white)
                            Text(["legalacsonyabb", "átlag", "legmagasabb"][i]).nkFont(12).foregroundStyle(.white.opacity(0.6))
                        }
                        .frame(maxWidth: .infinity, alignment: i == 0 ? .leading : i == 1 ? .center : .trailing)
                        .accessibilityElement(children: .combine)
                    }
                }
                .padding(.top, 12)
                if let mn = hr?.min, let mx = hr?.max, mx > mn { range(mn, hr?.avg, mx).padding(.top, 14) }
            }
        }
    }

    /// The day's span as a soft bar, the average as a white dot on it.
    private func range(_ mn: Int, _ avg: Int?, _ mx: Int) -> some View {
        GeometryReader { g in
            let w = g.size.width
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.1))
                Capsule().fill(LinearGradient(colors: [.white.opacity(0.35), .white.opacity(0.75)], startPoint: .leading, endPoint: .trailing))
                if let avg {
                    Circle().fill(.white).frame(width: 12, height: 12)
                        .shadow(color: Hue.pulzus.glow, radius: 6)
                        .offset(x: w * Double(avg - mn) / Double(mx - mn) - 6)
                }
            }
        }
        .frame(height: 8)
        .accessibilityHidden(true)
    }
}
