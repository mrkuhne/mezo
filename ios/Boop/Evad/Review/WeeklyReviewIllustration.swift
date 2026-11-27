import SwiftUI
import BoopCore
import BoopDesign

/// One illustration per review page (0 = the review itself, for the Hét hero), drawn in the Napkelte line family:
/// round caps, the hue's orb colours, white lines.
struct WeeklyReviewIllustration: View {
    let page: Int
    var hue: Hue = evadHue
    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            let s = min(w, h)
            let c = CGPoint(x: w / 2, y: h / 2)
            let line = StrokeStyle(lineWidth: max(2, s * 0.022), lineCap: .round, lineJoin: .round)
            func glowDisc(_ p: CGPoint, _ r: CGFloat, _ cols: [Color]) {
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - r * 1.6, y: p.y - r * 1.6, width: r * 3.2, height: r * 3.2)),
                         with: .radialGradient(Gradient(colors: [cols[1].opacity(0.45), .clear]), center: p, startRadius: r * 0.6, endRadius: r * 1.6))
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                         with: .linearGradient(Gradient(colors: [cols[2], cols[1], cols[0]]), startPoint: CGPoint(x: p.x, y: p.y - r), endPoint: CGPoint(x: p.x, y: p.y + r)))
            }
            switch page {
            case 1:
                // Seven days on a hill, the sun behind the middle.
                glowDisc(CGPoint(x: c.x, y: h * 0.5), s * 0.2, hue.orb)
                ctx.fill(Path { p in
                    p.move(to: CGPoint(x: 0, y: h * 0.78))
                    p.addQuadCurve(to: CGPoint(x: w, y: h * 0.78), control: CGPoint(x: c.x, y: h * 0.38))
                    p.addLine(to: CGPoint(x: w, y: h)); p.addLine(to: CGPoint(x: 0, y: h)); p.closeSubpath()
                }, with: .linearGradient(Gradient(colors: [hue.orb[0], hue.orb[0].opacity(0)]), startPoint: CGPoint(x: 0, y: h * 0.5), endPoint: CGPoint(x: 0, y: h)))
                for i in 0..<7 {
                    let t = CGFloat(i) / 6
                    let x = w * (0.1 + t * 0.8)
                    let y = h * 0.78 - (1 - pow(2 * t - 1, 2)) * h * 0.2 - 8
                    let r: CGFloat = 7
                    let rect = CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)
                    if i == 2 { ctx.stroke(Path(ellipseIn: rect), with: .color(NK.under), style: line) }
                    else if i == 3 { ctx.fill(Path(ellipseIn: rect), with: .color(Color(hex: 0x9FC7D6).opacity(0.8))) }
                    else { ctx.fill(Path(ellipseIn: rect), with: .color(.white)) }
                }
            case 2:
                // Boop's pearl with three things it learned around it.
                let pearl = [Color(hex: 0x264663), Color(hex: 0x8FB8CE), Color(hex: 0xDCEEF8)]
                glowDisc(c, s * 0.2, pearl)
                let pts = [CGPoint(x: c.x - s * 0.38, y: c.y - s * 0.22), CGPoint(x: c.x + s * 0.4, y: c.y - s * 0.12), CGPoint(x: c.x + s * 0.05, y: c.y + s * 0.4)]
                for (i, p) in pts.enumerated() {
                    ctx.stroke(Path { q in q.move(to: c); q.addLine(to: p) }, with: .color(.white.opacity(0.4)), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [4, 4]))
                    glowDisc(p, s * 0.07, i == 0 ? Hue.alvas.orb : (i == 1 ? Hue.fuel.orb : Hue.mozgas.orb))
                }
                for a in stride(from: 0.0, to: 360, by: 45) {
                    let r1 = s * 0.27, r2 = s * 0.31
                    let rad = a * .pi / 180
                    ctx.stroke(Path { q in q.move(to: CGPoint(x: c.x + cos(rad) * r1, y: c.y + sin(rad) * r1)); q.addLine(to: CGPoint(x: c.x + cos(rad) * r2, y: c.y + sin(rad) * r2)) },
                               with: .color(.white.opacity(0.55)), style: line)
                }
            case 3:
                // Next week: seven bars against a dashed line of what you can carry; one bar lowered.
                let base = h * 0.82
                let heights: [CGFloat] = [0.35, 0.62, 0.4, 0.58, 0.38, 0.25, 0.15]
                let cap = base - h * 0.48
                let bw = w * 0.08
                for (i, v) in heights.enumerated() {
                    let x = w * 0.12 + CGFloat(i) * w * 0.115
                    let top = base - v * h * 0.7
                    let r = CGRect(x: x, y: top, width: bw, height: base - top)
                    let over = top < cap
                    ctx.fill(Path(roundedRect: r, cornerRadius: bw / 2),
                             with: over ? .color(NK.under.opacity(0.85)) : .linearGradient(Gradient(colors: [hue.orb[2], hue.orb[1]]), startPoint: CGPoint(x: 0, y: top), endPoint: CGPoint(x: 0, y: base)))
                    if i == 3 {
                        ctx.stroke(Path { p in p.move(to: CGPoint(x: x + bw / 2, y: top - 6)); p.addLine(to: CGPoint(x: x + bw * 1.8, y: top - 22)) },
                                   with: .color(.white), style: line)
                    }
                }
                ctx.stroke(Path { p in p.move(to: CGPoint(x: w * 0.06, y: cap)); p.addLine(to: CGPoint(x: w * 0.94, y: cap)) },
                           with: .color(.white.opacity(0.8)), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [6, 5]))
                ctx.stroke(Path { p in p.move(to: CGPoint(x: w * 0.04, y: base)); p.addLine(to: CGPoint(x: w * 0.96, y: base)) },
                           with: .color(.white.opacity(0.5)), style: line)
            case 4:
                // A plate with the week's seven meals around its rim.
                let fuel = Hue.fuel.orb
                let r = s * 0.34
                ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)), with: .color(.white.opacity(0.85)), style: line)
                ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r * 0.62, y: c.y - r * 0.62, width: r * 1.24, height: r * 1.24)), with: .color(.white.opacity(0.4)), style: line)
                glowDisc(c, r * 0.32, fuel)
                for i in 0..<7 {
                    let a = -Double.pi / 2 + Double(i) / 7 * 2 * .pi
                    let p = CGPoint(x: c.x + cos(a) * r * 0.82, y: c.y + sin(a) * r * 0.82)
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - 5, y: p.y - 5, width: 10, height: 10)), with: .color(i < 5 ? fuel[2] : .white.opacity(0.35)))
                }
            case 5:
                // The sun fully up over the horizon, a tick inside it.
                let sun = CGPoint(x: c.x, y: h * 0.44)
                glowDisc(sun, s * 0.24, [hue.orb[1], hue.orb[3], Color(hex: 0xFFE7C9)])
                ctx.stroke(Path { p in
                    p.move(to: CGPoint(x: sun.x - s * 0.1, y: sun.y)); p.addLine(to: CGPoint(x: sun.x - s * 0.02, y: sun.y + s * 0.08))
                    p.addLine(to: CGPoint(x: sun.x + s * 0.12, y: sun.y - s * 0.08))
                }, with: .color(hue.orb[0]), style: StrokeStyle(lineWidth: s * 0.04, lineCap: .round, lineJoin: .round))
                ctx.stroke(Path { p in p.move(to: CGPoint(x: w * 0.05, y: h * 0.84)); p.addLine(to: CGPoint(x: w * 0.95, y: h * 0.84)) }, with: .color(.white.opacity(0.6)), style: line)
                for i in 0..<5 {
                    let a = Double.pi + Double(i + 1) / 6 * .pi
                    let r1 = s * 0.33, r2 = s * 0.42
                    ctx.stroke(Path { p in p.move(to: CGPoint(x: sun.x + cos(a) * r1, y: sun.y + sin(a) * r1)); p.addLine(to: CGPoint(x: sun.x + cos(a) * r2, y: sun.y + sin(a) * r2)) },
                               with: .color(.white.opacity(0.7)), style: line)
                }
            default:
                // The review itself: a week turning back on itself, seven dots on its ring, a tick in the middle.
                let r = s * 0.38
                glowDisc(c, s * 0.2, hue.orb)
                ctx.stroke(Path { p in p.addArc(center: c, radius: r, startAngle: .degrees(-60), endAngle: .degrees(250), clockwise: false) },
                           with: .color(.white.opacity(0.85)), style: line)
                let tip = CGPoint(x: c.x + cos(-60 * .pi / 180) * r, y: c.y + sin(-60 * .pi / 180) * r)
                ctx.stroke(Path { p in p.move(to: CGPoint(x: tip.x - 1, y: tip.y - s * 0.1)); p.addLine(to: tip); p.addLine(to: CGPoint(x: tip.x - s * 0.1, y: tip.y + 1)) },
                           with: .color(.white.opacity(0.85)), style: line)
                ctx.stroke(Path { p in
                    p.move(to: CGPoint(x: c.x - s * 0.08, y: c.y)); p.addLine(to: CGPoint(x: c.x - s * 0.01, y: c.y + s * 0.07))
                    p.addLine(to: CGPoint(x: c.x + s * 0.1, y: c.y - s * 0.07))
                }, with: .color(.white), style: StrokeStyle(lineWidth: s * 0.04, lineCap: .round, lineJoin: .round))
            }
        }
        .accessibilityHidden(true)
    }
}
