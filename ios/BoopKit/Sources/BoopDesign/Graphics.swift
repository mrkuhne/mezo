import SwiftUI

/// Ring with a value in the middle (Lágy `ring`), for the deep card.
public struct LagyRing: View {
    let d: CGFloat, sw: CGFloat, p: Double, color: Color, val: String, unit: String
    @State private var shown = false
    public init(d: CGFloat = 104, sw: CGFloat = 10, p: Double, color: Color = Lagy.sage2, val: String, unit: String) {
        self.d = d; self.sw = sw; self.p = p; self.color = color; self.val = val; self.unit = unit
    }
    public var body: some View {
        ZStack {
            Circle().stroke(.white.opacity(0.14), lineWidth: sw)
            Circle().trim(from: 0, to: shown ? min(1, max(0, p)) : 0)
                .stroke(color, style: StrokeStyle(lineWidth: sw, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text(val).font(.outfit(24)).monospacedDigit()
                Text(unit).font(.manrope(12, .bold)).opacity(0.7)
            }
            .foregroundStyle(.white)
        }
        .frame(width: d, height: d)
        .onAppear { withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 1.1).delay(0.3)) { shown = true } }
    }
}

/// Small level tube (Lágy `.jar .tb`); peach when `warm`.
public struct JarTube: View {
    let frac: Double, w: CGFloat, h: CGFloat, warm: Bool
    public init(frac: Double, w: CGFloat = 46, h: CGFloat = 120, warm: Bool = false) { self.frac = frac; self.w = w; self.h = h; self.warm = warm }
    public var body: some View {
        ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Lagy.paper)
            Rectangle()
                .fill(LinearGradient(colors: warm ? [Lagy.peach2, Lagy.peach] : [Lagy.sage2, Lagy.sage], startPoint: .top, endPoint: .bottom))
                .frame(height: h * min(1, max(0, frac)))
                .animation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.35), value: frac)
        }
        .frame(width: w, height: h)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

/// Day level tube for "Mai szintek": peach under 50 %, deep at 100 %.
public struct LevelTube: View {
    let frac: Double
    @State private var shown = false
    public init(frac: Double) { self.frac = frac }
    public var body: some View {
        ZStack(alignment: .bottom) {
            Capsule().fill(.white)
            Capsule()
                .fill(LinearGradient(colors: frac < 0.5 ? [Lagy.peach2, Lagy.peach] : [Lagy.sage2, frac >= 1 ? Lagy.deep : Lagy.sage], startPoint: .top, endPoint: .bottom))
                .frame(height: shown ? max(8, 72 * min(1, frac)) : 0)
        }
        .frame(width: 26, height: 72)
        .clipShape(Capsule())
        .shadow(color: Lagy.ink.opacity(0.08), radius: 6, y: 4)
        .onAppear { withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 1.1).delay(0.4)) { shown = true } }
    }
}

/// Boop's figure: the living glass orb (Metal shader `orb` in Orb.metal), sage liquid at `level`,
/// idle waves, a ripple where tapped. Tilt, speech surges and readiness binding arrive in S3.
public struct BoopFigure: View {
    let size: CGFloat, level: Double
    @State private var start = Date()
    @State private var rippleX = 0.0
    @State private var rippleDate = Date.distantPast
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    public init(size: CGFloat = 88, level: Double = 0.92) { self.size = size; self.level = level }

    public var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { tl in
            let e = tl.date.timeIntervalSince(start)
            let p = reduceMotion ? 1 : min(1.0, e / 1.8)
            let c = Lagy.orbColors
            Rectangle()
                .frame(width: size, height: size)
                .colorEffect(ShaderLibrary.bundle(.module).orb(
                    .float2(size, size), .float(Float(e)),
                    .color(c[0]), .color(c[1]), .color(c[2]), .color(c[3]),
                    .float(Float(level * (1 - pow(1 - p, 3)))), .float(0),
                    .float(Float(rippleX)), .float(Float(tl.date.timeIntervalSince(rippleDate))), .float(0)))
                .scaleEffect(1 + 0.012 * sin(e * 1.9))
        }
        .frame(width: size, height: size)
        .contentShape(Circle())
        .onTapGesture(coordinateSpace: .local) { pt in rippleX = Double(pt.x / size) * 2 - 1; rippleDate = Date() }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: rippleDate)
        .accessibilityHidden(true)
    }
}
