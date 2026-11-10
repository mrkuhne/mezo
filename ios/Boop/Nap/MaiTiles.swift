import SwiftUI
import BoopCore
import BoopDesign

// MARK: - What the tiles are built from (spec §5.1a, §5.1b)

/// The brief's numbers the tiles read. Optional = the server said "no data": that tile is left out, never shown as 0.
struct TileInputs: Equatable {
    var sleepTotalMin: Int?, bedtime: String?, wakeup: String?, deepMin: Int?
    var deepWeek: [Int?], restingHrWeek: [Int?]
    var hrMin: Int?, hrAvg: Int?, hrMax: Int?
    var steps: Int, stepsGoal: Int, activeKcal: Int
    var kcalSoFar: Int, kcalTarget: Int, proteinG: Int, proteinTarget: Int, carbsG: Int, fatG: Int
}

extension TileInputs {
    init(_ b: Brief) {
        let d = b.day
        self.init(sleepTotalMin: d.sleep?.totalMin, bedtime: d.sleep?.bedtime, wakeup: d.sleep?.wakeup, deepMin: d.sleep?.deepMin,
                  deepWeek: d.deepSleepWeek, restingHrWeek: d.restingHrWeek,
                  hrMin: d.hrToday?.min, hrAvg: d.hrToday?.avg, hrMax: d.hrToday?.max,
                  steps: d.steps, stepsGoal: d.stepsGoal, activeKcal: d.activeKcal,
                  kcalSoFar: d.kcalSoFar, kcalTarget: d.kcalTarget, proteinG: d.proteinG, proteinTarget: d.proteinTarget,
                  carbsG: d.carbsG, fatG: d.fatG)
    }
}

/// The drawing inside a tile (kit pieces).
enum TileGraphic: Equatable {
    case nightArc, latency, water
    case orb(Hue, level: Double)
    case trail(Double)
    case bars([Double], wide: Bool)
    case line([Double])
}

struct TileModel: Equatable, Identifiable {
    let label: String, value: String, sub: String
    let graphic: TileGraphic
    var id: String { label }
}

/// "7ó 12p" — the same shape the hero's Alvás display uses.
func hoursMinutes(_ minutes: Int) -> String { "\(minutes / 60)ó \(minutes % 60)p" }

/// "3 240" with a non-breaking space between thousands.
func grouped(_ n: Int) -> String {
    let s = String(abs(n))
    var out = ""
    for (i, ch) in s.enumerated() {
        if i > 0 && (s.count - i) % 3 == 0 { out.append("\u{00A0}") }
        out.append(ch)
    }
    return n < 0 ? "-" + out : out
}

private func share(_ v: Int, of goal: Double) -> Double { goal > 0 ? min(1, max(0, Double(v) / goal)) : 0 }

/// The tiles of one orb (spec §5.1a). Forma has none. Every tile whose number is missing is left out.
/// Deviations from the spike (no data for them in the v1 brief, spec §9.3): Elalvás shows the time you fell asleep
/// (no latency field); Pulzus shows today's min · avg · max in place of Feszültség (no tension field); the water tile
/// has no intake yet (logging is S4) and says "–".
func maiTiles(_ key: MetricKey, _ x: TileInputs) -> [TileModel] {
    var out: [TileModel] = []
    switch key {
    case .forma:
        break
    case .alvas:
        if let total = x.sleepTotalMin {
            let span = [x.bedtime, x.wakeup].compactMap { $0 }.joined(separator: " – ")
            out.append(TileModel(label: "ALVÁSIDŐ", value: hoursMinutes(total), sub: span, graphic: .nightArc))
        }
        if let deep = x.deepMin {
            let prior = x.deepWeek.dropLast().compactMap { $0 }
            var sub = "a legpihentetőbb szakasz"
            if !prior.isEmpty {
                let delta = Int((Double(deep) - Double(prior.reduce(0, +)) / Double(prior.count)).rounded())
                sub = delta == 0 ? "mint általában" : "\(delta > 0 ? "+" : "−")\(abs(delta)) p az átlaghoz"
            }
            out.append(TileModel(label: "MÉLYALVÁS", value: hoursMinutes(deep), sub: sub,
                                 graphic: .orb(.alvas, level: share(deep, of: 120))))
        }
        if let bed = x.bedtime {
            out.append(TileModel(label: "ELALVÁS", value: bed, sub: "ekkor aludtál el", graphic: .latency))
        }
    case .mozgas:
        out.append(TileModel(label: "LÉPÉSEK", value: grouped(x.steps),
                             sub: x.stepsGoal > 0 ? "/ \(grouped(x.stepsGoal))" : "lépés ma",
                             graphic: .trail(share(x.steps, of: Double(x.stepsGoal)))))
        // No active-energy goal in the brief: the bar fills against 500 kcal, a typical active day.
        out.append(TileModel(label: "AKTÍV KALÓRIA", value: "\(grouped(x.activeKcal)) kcal", sub: "mozgással ma",
                             graphic: .bars([share(x.activeKcal, of: 500)], wide: true)))
    case .fuel:
        out.append(TileModel(label: "VÍZ", value: "–", sub: "koppints: +250 ml", graphic: .water))
        if x.kcalTarget > 0 {
            out.append(TileModel(label: "KALÓRIA", value: grouped(x.kcalSoFar), sub: "/ \(grouped(x.kcalTarget)) kcal",
                                 graphic: .orb(.fuel, level: share(x.kcalSoFar, of: Double(x.kcalTarget)))))
        }
        if x.kcalTarget > 0 || x.proteinTarget > 0 {
            // carbs and fat have no own target in the brief: 45 % and 30 % of the calorie target
            let kcal = Double(x.kcalTarget)
            out.append(TileModel(label: "MAKRÓK", value: "\(x.proteinG) · \(x.carbsG) · \(x.fatG)", sub: "fehérje · szénh. · zsír",
                                 graphic: .bars([share(x.proteinG, of: Double(x.proteinTarget)), share(x.carbsG, of: kcal * 0.45 / 4),
                                                 share(x.fatG, of: kcal * 0.30 / 9)], wide: false)))
        }
    case .pulzus:
        let week = x.restingHrWeek.compactMap { $0 }
        if let today = week.last {
            let avg = Int((Double(week.reduce(0, +)) / Double(week.count)).rounded())
            let lo = Double(week.min() ?? today) - 2, hi = Double(week.max() ?? today) + 2
            // lower resting pulse = calmer = higher on the line
            let points = week.map { hi > lo ? (hi - Double($0)) / (hi - lo) : 0.5 }
            out.append(TileModel(label: "NYUGALMI PULZUS", value: "\(today)", sub: "heti átlag \(avg)", graphic: .line(points)))
        }
        if let mn = x.hrMin, let av = x.hrAvg, let mx = x.hrMax {
            let top = Double(mx) * 1.1
            out.append(TileModel(label: "PULZUS MA", value: "\(mn) · \(av) · \(mx)", sub: "min · átlag · max",
                                 graphic: .bars([Double(mn) / top, Double(av) / top, Double(mx) / top], wide: false)))
        }
    }
    return out
}

// MARK: - The row of tiles

/// One orb's tiles in one row of equal glass tiles. The water tile is tactile: a drop falls in, soft haptic.
struct MaiTiles: View {
    let tiles: [TileModel]
    let onWater: () -> Void
    @State private var dropping = false
    @State private var pours = 0

    var body: some View {
        if !tiles.isEmpty {
            HStack(alignment: .top, spacing: 10) {
                ForEach(tiles) { t in
                    if t.graphic == .water {
                        NKTile(label: t.label, value: t.value, sub: t.sub) { WaterGlass(level: 0.08, dropping: dropping) }
                            .onTapGesture { pour() }
                            .accessibilityAddTraits(.isButton)
                            .accessibilityAction { pour() }
                    } else {
                        NKTile(label: t.label, value: t.value, sub: t.sub) { graphic(t.graphic) }
                    }
                }
            }
            .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: pours)
        }
    }

    @ViewBuilder private func graphic(_ g: TileGraphic) -> some View {
        switch g {
        case .nightArc: NightArc()
        case .latency: SleepLatency()
        case .water: WaterGlass(level: 0.08)
        case .orb(let h, let level): StillOrb(palette: h.orb, size: 46, level: level)
        case .trail(let p): StepTrail(progress: p)
        case .bars(let v, let wide):
            LevelBars(values: v, tints: wide ? [Hue.mozgas.glow] : [.white, .white.opacity(0.7), .white.opacity(0.45)], wide: wide)
        case .line(let p): GlowLine(points: p)
        }
    }

    private func pour() {
        dropping = false
        withAnimation(.easeIn(duration: 0.45)) { dropping = true }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(450))
            pours += 1
            dropping = false
            onWater()
        }
    }
}
