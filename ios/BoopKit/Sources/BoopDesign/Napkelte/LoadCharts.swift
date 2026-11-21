import SwiftUI

// Load against what he can carry (B7 K2, `mezo-r36n9.17`): the season's weekly chart and the next week's day strip.
// Plain value types in, so the kit knows nothing of the server; every figure arrives from the engines and is only
// scaled to the chart's height here. Colour per Napkelte: white type, the hue only for the recovery line / capacity
// tick, `NK.under` for what outgrew recovery. Still by construction (no animation, so reduced motion is the same).

// MARK: - The season: weekly load as bars, recovery as a line

public struct NKLoadWeek: Equatable, Sendable {
    public let label: String
    /// nil = no figure for the week: no bar.
    public let load: Double?
    /// nil = none (a planned week): the line stops.
    public let recovery: Double?
    /// Load outgrew recovery.
    public let over: Bool
    /// Drawn faint: a planned week, or a week whose load counts only the planned training.
    public let faint: Bool

    public init(label: String, load: Double?, recovery: Double?, over: Bool, faint: Bool) {
        self.label = label; self.load = load; self.recovery = recovery; self.over = over; self.faint = faint
    }

    /// The VoiceOver sentence of one week.
    public var spoken: String {
        let n = label.hasSuffix(".") ? String(label.dropLast()) : label
        if faint { return "\(n). hét: terv" }
        if load == nil { return "\(n). hét: nincs adat" }
        return over ? "\(n). hét: több, mint amit pihentél" : "\(n). hét: teher rendben"
    }
}

/// Season weeks: load as bars, recovery as a line; faint weeks (the plan) pale, the current one bright.
public struct NKSeasonLoadChart: View {
    let weeks: [NKLoadWeek], nowIndex: Int?, hue: Hue

    public init(weeks: [NKLoadWeek], nowIndex: Int?, hue: Hue) {
        self.weeks = weeks; self.nowIndex = nowIndex; self.hue = hue
    }

    /// The tallest figure sets the scale (with a little headroom), so the bars and the line share one axis.
    private var top: Double {
        let m = weeks.flatMap { [$0.load ?? 0, $0.recovery ?? 0] }.max() ?? 0
        return m > 0 ? m * 1.08 : 1
    }

    /// The runs of consecutive weeks that carry a recovery figure; the line breaks where a week has none. A run of one
    /// week is drawn as a short tick (a line needs two points).
    static func recoveryRuns(_ weeks: [NKLoadWeek]) -> [ClosedRange<Int>] {
        var runs: [ClosedRange<Int>] = []
        var start: Int?
        for i in weeks.indices {
            if weeks[i].recovery != nil {
                if start == nil { start = i }
            } else if let s = start {
                runs.append(s...(i - 1)); start = nil
            }
        }
        if let s = start { runs.append(s...(weeks.count - 1)) }
        return runs
    }

    private func barFill(_ i: Int) -> Color {
        let w = weeks[i]
        if w.faint { return .white.opacity(0.14) }
        if w.over { return NK.under.opacity(0.8) }
        return .white.opacity(i == nowIndex ? 0.7 : 0.4)
    }

    public var body: some View {
        VStack(spacing: 8) {
            GeometryReader { g in
                let w = g.size.width, h = g.size.height
                let step = w / CGFloat(max(1, weeks.count))
                ZStack(alignment: .bottomLeading) {
                    ForEach(weeks.indices, id: \.self) { i in
                        if let load = weeks[i].load {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(barFill(i))
                                .frame(width: step * 0.58, height: max(2, h * CGFloat(load / top)))
                                .offset(x: step * CGFloat(i) + step * 0.21)
                        }
                    }
                    Path { p in
                        for run in Self.recoveryRuns(weeks) {
                            let y = { (i: Int) in h * (1 - CGFloat((weeks[i].recovery ?? 0) / top)) }
                            if run.count == 1 {
                                // a lone week (his first lived one) has no neighbour to join: a short level tick
                                // across its bar slot, so the recovery still shows
                                let i = run.lowerBound
                                p.move(to: CGPoint(x: step * (CGFloat(i) + 0.21), y: y(i)))
                                p.addLine(to: CGPoint(x: step * (CGFloat(i) + 0.79), y: y(i)))
                            } else {
                                for i in run {
                                    let pt = CGPoint(x: step * (CGFloat(i) + 0.5), y: y(i))
                                    if i == run.lowerBound { p.move(to: pt) } else { p.addLine(to: pt) }
                                }
                            }
                        }
                    }
                    .stroke(hue.glow, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                }
            }
            .frame(height: 120)
            HStack(spacing: 0) {
                ForEach(weeks.indices, id: \.self) { i in
                    Text(weeks[i].label).font(.nkNumber(10.5))
                        .foregroundStyle(.white.opacity(i == nowIndex ? 1 : 0.45)).frame(maxWidth: .infinity)
                }
            }
            HStack(spacing: 14) {
                legend { RoundedRectangle(cornerRadius: 3).fill(.white.opacity(0.5)).frame(width: 10, height: 10) } text: { "teher" }
                legend { Rectangle().fill(hue.glow).frame(width: 14, height: 2) } text: { "pihenés" }
                legend { RoundedRectangle(cornerRadius: 3).fill(NK.under.opacity(0.8)).frame(width: 10, height: 10) }
                    text: { "több, mint amit pihentél" }
                Spacer(minLength: 0)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Heti teher és pihenés")
        .accessibilityValue(weeks.map(\.spoken).joined(separator: ". "))
    }

    private func legend<Mark: View>(@ViewBuilder _ mark: () -> Mark, text: () -> String) -> some View {
        HStack(spacing: 6) { mark(); Text(text()).nkFont(11.5).foregroundStyle(.white.opacity(0.55)) }
    }
}

// MARK: - The week: each day's load against what he can carry that day

public struct NKLoadDay: Equatable, Sendable {
    /// "H", "K" …
    public let weekday: String
    /// "24."
    public let date: String
    /// The day's load as a fraction of the day's own capacity ratio scale (1.2 = a full bar), straight from the server.
    public let demand: Double
    /// The day's capacity on the same scale (the tick).
    public let capacity: Double
    /// The server's verdict word of the day ("laza", "rendben", "szoros", "túl sok").
    public let word: String

    public init(weekday: String, date: String, demand: Double, capacity: Double, word: String) {
        self.weekday = weekday; self.date = date; self.demand = demand; self.capacity = capacity; self.word = word
    }

    var over: Bool { demand > capacity }
}

/// Seven columns: the verdict word, the day's load bar with its capacity tick, the weekday and the date.
public struct NKWeekLoadStrip: View {
    let days: [NKLoadDay], lit: Int?, hue: Hue

    public init(days: [NKLoadDay], lit: Int?, hue: Hue) { self.days = days; self.lit = lit; self.hue = hue }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(days.indices, id: \.self) { i in
                    let d = days[i]
                    VStack(spacing: 7) {
                        Text(d.word).nkFont(10.5, .medium)
                            .foregroundStyle(d.over ? NK.under : .white.opacity(0.55))
                            .lineLimit(1).minimumScaleFactor(0.7)
                        GeometryReader { g in
                            let h = g.size.height
                            ZStack(alignment: .bottom) {
                                RoundedRectangle(cornerRadius: 7).fill(.white.opacity(0.06))
                                RoundedRectangle(cornerRadius: 7)
                                    .fill(d.over ? NK.under.opacity(0.85) : .white.opacity(i == lit ? 0.75 : 0.42))
                                    .frame(height: min(h, h * CGFloat(d.demand / 1.2)))
                                Rectangle().fill(hue.glow).frame(height: 2)
                                    .offset(y: -h * CGFloat(d.capacity / 1.2) + 1)
                            }
                        }
                        .frame(height: 96)
                        Text(d.weekday).nkFont(13, i == lit ? .semibold : .regular)
                            .foregroundStyle(.white.opacity(i == lit ? 1 : 0.7))
                        Text(d.date).font(.nkNumber(11)).foregroundStyle(.white.opacity(0.45))
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(d.weekday) \(d.date): \(d.word)")
                }
            }
            HStack(spacing: 14) {
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 3).fill(.white.opacity(0.6)).frame(width: 10, height: 10)
                    Text("a nap terhe").nkFont(11.5).foregroundStyle(.white.opacity(0.55))
                }
                HStack(spacing: 6) {
                    Rectangle().fill(hue.glow).frame(width: 14, height: 2)
                    Text("amennyit aznap bírsz").nkFont(11.5).foregroundStyle(.white.opacity(0.55))
                }
            }
        }
    }
}
