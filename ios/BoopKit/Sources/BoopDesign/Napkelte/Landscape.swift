import SwiftUI

/// Boop's own painted landscape (spec §4.2): a vivid sky in the hue over four hazy ridges with aerial perspective.
/// Ridge shapes are seeded per hue, so a page always looks the same.
public struct PaintedLandscape: View {
    let hue: Hue
    public init(hue: Hue) { self.hue = hue }

    public var body: some View {
        let sky = hue.sky
        let seed = Double(hue.rawValue) * 0.9
        Canvas { ctx, s in
            let w = s.width, h = s.height
            ctx.fill(Path(CGRect(origin: .zero, size: s)),
                     with: .linearGradient(Gradient(stops: [.init(color: sky[0], location: 0), .init(color: sky[1], location: 0.45),
                                                            .init(color: sky[2], location: 0.66)]),
                                           startPoint: .zero, endPoint: CGPoint(x: 0, y: h)))
            var glow = ctx
            glow.addFilter(.blur(radius: 60))
            glow.fill(Path(ellipseIn: CGRect(x: w * 0.1, y: h * 0.42, width: w * 0.8, height: h * 0.22)), with: .color(sky[2].opacity(0.9)))
            // base y, amplitude, frequency, phase, darkness
            let layers: [(Double, Double, Double, Double, Double)] = [
                (0.60, 0.05, 2.1, 0.4, 0.18), (0.66, 0.06, 3.3, 1.9, 0.34), (0.73, 0.05, 2.6, 3.1, 0.52), (0.82, 0.04, 4.2, 0.7, 0.72)]
            for (k, l) in layers.enumerated() {
                var p = Path()
                p.move(to: CGPoint(x: 0, y: h))
                for xi in stride(from: 0.0, through: w, by: 3) {
                    let t = xi / w * .pi * 2
                    let ph = l.3 + seed
                    let y = h * (l.0 - l.1 * (0.65 * sin(t * l.2 + ph) + 0.3 * sin(t * l.2 * 2.1 + ph * 1.7) + 0.05 * sin(t * l.2 * 4.7)))
                    p.addLine(to: CGPoint(x: xi, y: y))
                }
                p.addLine(to: CGPoint(x: w, y: h)); p.closeSubpath()
                // far ridges melt into the sky, near ones are deep and dark
                var c = ctx
                c.addFilter(.blur(radius: CGFloat(3 - k) * 0.8))
                c.fill(p, with: .color(sky[1]))
                c.fill(p, with: .color(Color.black.opacity(l.4 * 0.95)))
                c.fill(p, with: .linearGradient(Gradient(colors: [sky[2].opacity(0.45 * (1 - l.4)), .clear]),
                                                startPoint: CGPoint(x: 0, y: h * (l.0 - l.1)), endPoint: CGPoint(x: 0, y: h * (l.0 + 0.08))))
                var hz = ctx
                hz.addFilter(.blur(radius: 22))
                hz.fill(Path(CGRect(x: 0, y: h * (l.0 + 0.02), width: w, height: h * 0.03)), with: .color(sky[2].opacity(0.18)))
            }
        }
        .accessibilityHidden(true)
    }
}

/// The landscape again at the very bottom of a page, mirrored and faint, like a lake closing it (spec §5.1b).
public struct MirroredLand: View {
    let hue: Hue
    public init(hue: Hue) { self.hue = hue }
    public var body: some View {
        PaintedLandscape(hue: hue)
            .frame(height: 300)
            .scaleEffect(x: 1, y: -1)
            .opacity(0.28)
            .mask(LinearGradient(colors: [.clear, .black.opacity(0.9)], startPoint: .top, endPoint: .bottom))
            .allowsHitTesting(false)
    }
}
