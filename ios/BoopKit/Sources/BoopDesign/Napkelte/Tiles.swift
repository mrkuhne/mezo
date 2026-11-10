import SwiftUI

/// One tile of a per-orb row: mono label, a drawn mini graphic, value + sub-line. Text shrinks instead of clipping.
public struct NKTile<G: View>: View {
    let label: String, value: String, sub: String, graphic: G
    public init(label: String, value: String, sub: String, @ViewBuilder graphic: () -> G) {
        self.label = label; self.value = value; self.sub = sub; self.graphic = graphic()
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).nkFont(10.5, .medium, design: .monospaced).tracking(1.2).foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.7)
            graphic.frame(height: 56).frame(maxWidth: .infinity)
            VStack(alignment: .leading, spacing: 1) {
                Text(value).font(.nkNumber(19)).foregroundStyle(.white).contentTransition(.numericText()).lineLimit(1).minimumScaleFactor(0.7)
                Text(sub).nkFont(11).foregroundStyle(.white.opacity(0.5)).lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(22)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label.capitalized): \(value), \(sub)")
    }
}

struct GlassShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX - r.width * 0.14, y: r.maxY - 4))
        p.addQuadCurve(to: CGPoint(x: r.minX + r.width * 0.14, y: r.maxY - 4), control: CGPoint(x: r.midX, y: r.maxY + 2))
        p.closeSubpath()
        return p
    }
}

/// A glass of water whose surface gently waves; `dropping` animates a drop falling in.
public struct WaterGlass: View {
    let level: Double, dropping: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    public init(level: Double, dropping: Bool = false) { self.level = level; self.dropping = dropping }
    public var body: some View {
        ZStack(alignment: .bottom) {
            GlassShape().fill(.white.opacity(0.06))
            TimelineView(.animation(paused: reduceMotion)) { tl in
                let t = reduceMotion ? 0 : tl.date.timeIntervalSinceReferenceDate
                Canvas { ctx, s in
                    let y = s.height * (1 - min(1, max(0, level)))
                    var p = Path(); p.move(to: CGPoint(x: 0, y: s.height))
                    for x in stride(from: 0.0, through: s.width, by: 2) { p.addLine(to: CGPoint(x: x, y: y + 2 * sin(x / 6 + t * 3))) }
                    p.addLine(to: CGPoint(x: s.width, y: s.height)); p.closeSubpath()
                    ctx.fill(p, with: .linearGradient(Gradient(colors: [Color(hex: 0x9ED4F5), Color(hex: 0x2A78C8)]),
                                                       startPoint: CGPoint(x: 0, y: y), endPoint: CGPoint(x: 0, y: s.height)))
                }
            }
            .clipShape(GlassShape())
            GlassShape().stroke(.white.opacity(0.55), lineWidth: 1.4)
            Circle().fill(Color(hex: 0x9ED4F5)).frame(width: 7, height: 7).offset(y: dropping ? -10 : -64).opacity(dropping ? 1 : 0)
        }
        .frame(width: 36, height: 52)
        .accessibilityHidden(true)
    }
}

/// A winding trail: the walked part lit with a warm glow, a dot where you are, the goal dot at the end.
public struct StepTrail: View {
    let progress: Double
    public init(progress: Double) { self.progress = progress }
    public var body: some View {
        Canvas { ctx, s in
            var p = Path()
            p.move(to: CGPoint(x: 4, y: s.height - 6))
            p.addCurve(to: CGPoint(x: s.width * 0.5, y: s.height * 0.45), control1: CGPoint(x: s.width * 0.35, y: s.height), control2: CGPoint(x: s.width * 0.1, y: s.height * 0.4))
            p.addCurve(to: CGPoint(x: s.width - 4, y: 6), control1: CGPoint(x: s.width * 0.9, y: s.height * 0.5), control2: CGPoint(x: s.width * 0.6, y: 0))
            ctx.stroke(p, with: .color(.white.opacity(0.18)), style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [1, 5]))
            let lit = p.trimmedPath(from: 0, to: min(1, max(0, progress)))
            var g = ctx; g.addFilter(.blur(radius: 4)); g.stroke(lit, with: .color(Hue.mozgas.glow), lineWidth: 4)
            ctx.stroke(lit, with: .color(.white), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            if let end = lit.currentPoint { ctx.fill(Path(ellipseIn: CGRect(x: end.x - 4.5, y: end.y - 4.5, width: 9, height: 9)), with: .color(.white)) }
            ctx.fill(Path(ellipseIn: CGRect(x: s.width - 8, y: 2, width: 8, height: 8)), with: .color(.white.opacity(0.35)))
        }
        .accessibilityHidden(true)
    }
}

/// The night as an arc from falling asleep to waking, a small moon at its top.
public struct NightArc: View {
    public init() {}
    public var body: some View {
        Canvas { ctx, s in
            let c = CGPoint(x: s.width / 2, y: s.height - 4)
            let r = min(s.width / 2 - 6, s.height - 8)
            var arc = Path(); arc.addArc(center: c, radius: r, startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false)
            var g = ctx; g.addFilter(.blur(radius: 4)); g.stroke(arc, with: .color(Hue.alvas.glow), lineWidth: 4)
            ctx.stroke(arc, with: .color(.white), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            for a in [180.0, 360.0] {
                let p = CGPoint(x: c.x + r * cos(a * .pi / 180), y: c.y + r * sin(a * .pi / 180))
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 3.5, y: p.y - 3.5, width: 7, height: 7)), with: .color(.white))
            }
            let top = CGPoint(x: c.x, y: c.y - r)
            ctx.fill(Path(ellipseIn: CGRect(x: top.x - 7, y: top.y - 7, width: 14, height: 14)), with: .color(Color(hex: 0xF4E9E2)))
            ctx.fill(Path(ellipseIn: CGRect(x: top.x - 3, y: top.y - 9, width: 13, height: 13)), with: .color(Color(hex: 0x1A2A3C)))
        }
        .accessibilityHidden(true)
    }
}

/// How fast you fell asleep: a short descent from awake into sleep.
public struct SleepLatency: View {
    public init() {}
    public var body: some View {
        Canvas { ctx, s in
            var p = Path()
            p.move(to: CGPoint(x: 4, y: 8)); p.addLine(to: CGPoint(x: s.width * 0.3, y: 8))
            p.addCurve(to: CGPoint(x: s.width - 4, y: s.height - 6), control1: CGPoint(x: s.width * 0.5, y: 8), control2: CGPoint(x: s.width * 0.55, y: s.height - 6))
            ctx.stroke(p, with: .color(.white), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            ctx.fill(Path(ellipseIn: CGRect(x: 0, y: 4, width: 8, height: 8)), with: .color(Color(hex: 0xF4E9E2)))
            ctx.fill(Path(ellipseIn: CGRect(x: s.width - 8, y: s.height - 10, width: 8, height: 8)), with: .color(Hue.alvas.glow))
        }
        .accessibilityHidden(true)
    }
}

/// Upright level bars, each filled to its share: one wide bar or a small group (macros).
public struct LevelBars: View {
    let values: [Double], tints: [Color], wide: Bool
    public init(values: [Double], tints: [Color], wide: Bool) { self.values = values; self.tints = tints; self.wide = wide }
    public var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            ForEach(values.indices, id: \.self) { i in
                ZStack(alignment: .bottom) {
                    Capsule().fill(.white.opacity(0.1))
                    Capsule().fill(i < tints.count ? tints[i] : .white).frame(height: 52 * min(1, max(0, values[i])))
                }
                .frame(width: wide ? 22 : 12, height: 52)
            }
        }
        .accessibilityHidden(true)
    }
}
