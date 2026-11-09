import SwiftUI
import BoopDesign

/// A bathroom-scale ruler: drag sideways to set; one tick per `step`, a major tick (with label) every `major` ticks.
struct RulerDial: View {
    @Binding var value: Double
    let step: Double
    let range: ClosedRange<Double>
    let major: Int
    let label: (Double) -> String
    @State private var base: Double?
    private let spacing: CGFloat = 12

    var body: some View {
        Canvas { ctx, size in
            let mid = size.width / 2
            let ticks = Int(size.width / spacing) / 2 + 2
            let center = (value / step).rounded()
            for k in -ticks...ticks {
                let n = center + Double(k), x = mid + CGFloat(k) * spacing
                let isMajor = Int(n) % major == 0, isHalf = Int(n) % max(1, major / 2) == 0
                let len: CGFloat = isMajor ? 30 : (isHalf ? 20 : 12)
                let fade = max(0.12, 1 - abs(Double(k)) / Double(ticks))
                var p = Path(); p.move(to: CGPoint(x: x, y: 6)); p.addLine(to: CGPoint(x: x, y: 6 + len))
                ctx.stroke(p, with: .color(Lagy.ink.opacity(0.45 * fade)), lineWidth: isMajor ? 2 : 1)
                if isMajor {
                    ctx.draw(Text(label(n * step)).font(.manrope(12, .bold)).foregroundColor(Lagy.ink2.opacity(fade)), at: CGPoint(x: x, y: 52))
                }
            }
        }
        .frame(height: 64)
        .overlay { Capsule().fill(Lagy.sage).frame(width: 4, height: 46).offset(y: -6) }
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance: 0)
            .onChanged { g in
                if base == nil { base = value }
                let v = (base ?? value) - Double(g.translation.width / spacing) * step
                value = min(range.upperBound, max(range.lowerBound, (v / step).rounded() * step))
            }
            .onEnded { _ in base = nil })
        .sensoryFeedback(.selection, trigger: value)
        .accessibilityElement()
        .accessibilityValue(label(value))
        .accessibilityAdjustableAction { d in
            value = min(range.upperBound, max(range.lowerBound, value + (d == .increment ? step : -step)))
        }
    }
}
