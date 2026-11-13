import SwiftUI

// MARK: - Sleep stages

/// Stage 0 = awake, 1 = REM, 2 = light, 3 = deep. The share of each stage in the night.
public func stageShares(_ segments: [(stage: Int, minutes: Double)]) -> [Int: Double] {
    let total = segments.map(\.minutes).reduce(0, +)
    guard total > 0 else { return [:] }
    return Dictionary(grouping: segments, by: \.stage).mapValues { $0.map(\.minutes).reduce(0, +) / total }
}

/// The sleep-stage colours (data colours, allowed inside charts — spec §5.5).
public let stageColors: [Color] = [Color(hex: 0xF4E9E2), Color(hex: 0x9ED4F5), Color(hex: 0x4BA8E6), Color(hex: 0x2A6E96)]

/// Stepped bars, awake on top and deep at the bottom.
public struct Hypnogram: View {
    let segments: [(stage: Int, minutes: Double)]
    public init(segments: [(stage: Int, minutes: Double)]) { self.segments = segments }
    public var body: some View {
        Canvas { ctx, s in
            let total = segments.map(\.minutes).reduce(0, +)
            guard total > 0 else { return }
            let row = s.height / 4
            var x: CGFloat = 0
            var prevMid: CGFloat?
            for seg in segments {
                let st = min(3, max(0, seg.stage))
                let w = s.width * seg.minutes / total
                let r = CGRect(x: x, y: CGFloat(st) * row + row * 0.18, width: w, height: row * 0.64)
                if let pm = prevMid {
                    var l = Path(); l.move(to: CGPoint(x: x, y: pm)); l.addLine(to: CGPoint(x: x, y: r.midY))
                    ctx.stroke(l, with: .color(.white.opacity(0.25)), lineWidth: 1)
                }
                ctx.fill(Path(roundedRect: r, cornerRadius: 2), with: .color(stageColors[st]))
                prevMid = r.midY
                x += w
            }
        }
        .accessibilityHidden(true)
    }
}

/// The legend: a bar as long as the share, the stage name, its time, its percent.
public struct HypnogramLegend: View {
    public struct Row { public let stage: Int, label: String, time: String, share: Double
        public init(stage: Int, label: String, time: String, share: Double) { self.stage = stage; self.label = label; self.time = time; self.share = share } }
    let rows: [Row]
    public init(rows: [Row]) { self.rows = rows }
    public var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ForEach(rows.indices, id: \.self) { i in
                let r = rows[i]
                HStack(spacing: 10) {
                    Capsule().fill(stageColors[min(3, max(0, r.stage))]).frame(width: 14 + 80 * r.share, height: 7).frame(width: 96, alignment: .leading)
                    Text(r.label).nkFont(15).foregroundStyle(.white)
                    Text(r.time).nkFont(15).foregroundStyle(.white.opacity(0.75))
                    Spacer()
                    Text("\(Int((r.share * 100).rounded()))%").nkFont(12, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

// MARK: - Lines and bars

/// A smooth glowing white line with a soft fill and an optional "MOST" marker (0…1 across).
public struct GlowLine: View {
    let points: [Double], nowAt: Double?, glow: Color
    public init(points: [Double], nowAt: Double? = nil, glow: Color = .white) { self.points = points; self.nowAt = nowAt; self.glow = glow }
    public var body: some View {
        Canvas { ctx, s in
            guard points.count > 1 else { return }
            func p(_ i: Int) -> CGPoint { CGPoint(x: s.width * Double(i) / Double(points.count - 1), y: s.height * (1 - min(1, max(0, points[i]))) * 0.9 + 6) }
            var line = Path(); line.move(to: p(0))
            for i in 1..<points.count {
                let a = p(i - 1), b = p(i)
                line.addCurve(to: b, control1: CGPoint(x: (a.x + b.x) / 2, y: a.y), control2: CGPoint(x: (a.x + b.x) / 2, y: b.y))
            }
            var fill = line; fill.addLine(to: CGPoint(x: s.width, y: s.height)); fill.addLine(to: CGPoint(x: 0, y: s.height)); fill.closeSubpath()
            ctx.fill(fill, with: .linearGradient(Gradient(colors: [glow.opacity(0.35), glow.opacity(0)]), startPoint: .zero, endPoint: CGPoint(x: 0, y: s.height)))
            var g = ctx; g.addFilter(.blur(radius: 6)); g.stroke(line, with: .color(glow), lineWidth: 5)
            ctx.stroke(line, with: .color(.white), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            if let n = nowAt {
                let nx = s.width * n
                var now = Path(); now.move(to: CGPoint(x: nx, y: 0)); now.addLine(to: CGPoint(x: nx, y: s.height))
                ctx.stroke(now, with: .color(Color.white.opacity(0.5)), style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
                ctx.draw(Text("MOST").font(.nkMono(10, .bold)).foregroundColor(Color.white.opacity(0.8)), at: CGPoint(x: nx + 22, y: 8))
            }
        }
        .accessibilityHidden(true)
    }
}

/// The value `GlowLine` draws at a fractional point index (0 … count − 1): the same cubic it strokes between two points
/// (control points at the horizontal midpoint), solved for x by bisection. Clamped to the ends.
public func glowLineValue(_ points: [Double], at index: Double) -> Double {
    guard let first = points.first else { return 0 }
    guard points.count > 1 else { return first }
    let f = min(Double(points.count - 1), max(0, index))
    let i = min(points.count - 2, Int(f)), u = f - Double(i)
    let a = points[i], b = points[i + 1]
    // x(t) = 1.5(1−t)²t + 1.5(1−t)t² + t³ over the segment (0…1), monotonic
    func x(_ t: Double) -> Double { 1.5 * (1 - t) * (1 - t) * t + 1.5 * (1 - t) * t * t + t * t * t }
    var lo = 0.0, hi = 1.0
    for _ in 0..<40 { let m = (lo + hi) / 2; if x(m) < u { lo = m } else { hi = m } }
    let t = (lo + hi) / 2
    let wa = (1 - t) * (1 - t) * (1 - t) + 3 * (1 - t) * (1 - t) * t
    return a * wa + b * (1 - wa)
}

/// The value range seven week bars are drawn against: always finite with lo < hi, even for flat, empty or all-missing
/// data. Missing days (nil) do not count.
public func weekBarScale(values: [Double?]) -> (Double, Double) {
    let present = values.compactMap { $0 }
    guard let mn = present.min(), let mx = present.max() else { return (0, 1) }
    let lo = mn * 0.85, hi = mx * 1.04
    return hi > lo ? (lo, hi) : (lo - 1, lo + 1)
}

/// The number over a bar: rounded, with its unit; a missing day says "–", never 0.
public func weekBarValueLabel(_ value: Double?, unit: String) -> String {
    value.map { "\(Int($0.rounded()))\(unit)" } ?? "–"
}

/// Seven days as soft white bars, the average as a dashed waterline, today (the last) lit. A missing day (nil) is a
/// faint dashed stub; with no average (no data at all) the waterline is left out.
public struct WeekBars: View {
    let values: [Double?], average: Double?, unit: String, labels: [String]
    /// What the waterline is called ("átlag" by default; the food week draws a target: "cél").
    let lineLabel: String
    /// Bars drawn as an outline instead of filled: a day the chart must not read as a miss (a kímélő day).
    let marked: Set<Int>
    public init(values: [Double?], average: Double?, unit: String, labels: [String], lineLabel: String = "átlag", marked: Set<Int> = []) {
        self.values = values; self.average = average; self.unit = unit; self.labels = labels
        self.lineLabel = lineLabel; self.marked = marked
    }
    public var body: some View {
        GeometryReader { g in
            // the waterline is part of the scale: a target above the tallest bar must still be on the chart
            let (lo, hi) = weekBarScale(values: values + [average])
            let H = g.size.height - 22
            let y: (Double) -> CGFloat = { H * (1 - ($0 - lo) / (hi - lo)) }
            ZStack(alignment: .topLeading) {
                HStack(alignment: .bottom, spacing: 0) {
                    ForEach(values.indices, id: \.self) { i in
                        let last = i == values.count - 1
                        VStack(spacing: 6) {
                            Spacer(minLength: 0)
                            if last { Text(weekBarValueLabel(values[i], unit: unit)).nkFont(11, .bold, design: .monospaced).foregroundStyle(.white) }
                            if let v = values[i], marked.contains(i) {
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .stroke(.white.opacity(last ? 0.95 : 0.45), style: StrokeStyle(lineWidth: 1.5))
                                    .frame(width: 22, height: max(6, H - y(v)))
                            } else if let v = values[i] {
                                RoundedRectangle(cornerRadius: 6, style: .continuous).fill(.white.opacity(last ? 0.95 : 0.28))
                                    .frame(width: 22, height: max(6, H - y(v)))
                            } else {
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .stroke(.white.opacity(0.25), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                                    .frame(width: 22, height: 10)
                            }
                            Text(i < labels.count ? labels[i] : "").nkFont(11, last ? .semibold : .regular)
                                .foregroundStyle(.white.opacity(last ? 1 : 0.5))
                        }
                        .frame(maxWidth: .infinity)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(i < labels.count ? labels[i] : ""): \(values[i] == nil ? "nincs adat" : weekBarValueLabel(values[i], unit: unit))\(marked.contains(i) ? " · kímélő nap" : "")")
                    }
                }
                if let average {
                    Path { p in p.move(to: CGPoint(x: 0, y: y(average))); p.addLine(to: CGPoint(x: g.size.width, y: y(average))) }
                        .stroke(.white.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        .accessibilityHidden(true)
                    Text("\(lineLabel) \(Int(average.rounded()))\(unit)").nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.7))
                        .offset(y: y(average) - 16)
                }
            }
        }
    }
}

/// The calendar melted into 15-minute slots (06:00–24:00, 72 slots, 0…1 busy); the training slot in amber.
public struct BusyRibbon: View {
    let slots: [Double], trainingSlot: Int?
    public init(slots: [Double], trainingSlot: Int? = nil) { self.slots = slots; self.trainingSlot = trainingSlot }
    public var body: some View {
        Canvas { ctx, s in
            guard !slots.isEmpty else { return }
            let w = s.width / CGFloat(slots.count)
            for (k, busy) in slots.enumerated() where busy > 0 {
                ctx.fill(Path(roundedRect: CGRect(x: CGFloat(k) * w + 0.5, y: 0, width: max(1, w - 1), height: s.height), cornerRadius: 2),
                         with: .color(.white.opacity(min(1, busy) * 0.7)))
            }
            if let t = trainingSlot {
                ctx.fill(Path(roundedRect: CGRect(x: CGFloat(t) * w, y: -2, width: w * 4, height: s.height + 4), cornerRadius: 3), with: .color(Color(hex: 0xF7C27A)))
            }
        }
        .accessibilityHidden(true)
    }
}
