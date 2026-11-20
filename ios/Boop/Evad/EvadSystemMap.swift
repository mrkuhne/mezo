import SwiftUI
import BoopCore
import BoopDesign

/// **Mi mire hat** — the Évad tab's hero (the approved spike's map): four orbs (Edzés, Étel, Alvás, Súly), the
/// server's links between them as dotted lines with a light running cause → effect, each orb's headline as the server
/// formatted it. A tap lights one pillar and lists what flows along its links, with one serif sentence. Under reduced
/// motion the light stands still.
struct EvadSystemMap: View {
    let o: EvadOverview
    @State private var lit: Int? = {
        #if DEBUG
        return Int(UserDefaults.standard.string(forKey: "evadLit") ?? "")
        #else
        return nil
        #endif
    }()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // 0 Edzés (top) · 1 Étel (left) · 2 Alvás (right) · 3 Súly (bottom)
    private let hues: [Hue] = [.mozgas, .fuel, .alvas, .forma]

    private func value(_ i: Int) -> String? {
        o.map.pillars.first { $0.key == evadPillarKeys[i] }?.value
    }
    private struct Link { let a: Int, b: Int }
    private var links: [Link] {
        o.map.links.compactMap { l in
            guard let a = evadPillarKeys.firstIndex(of: l.from), let b = evadPillarKeys.firstIndex(of: l.to),
                  evadLinkText(l, trajectory: o.head.trajectory) != nil else { return nil }
            return Link(a: a, b: b)
        }
    }
    private func pos(_ i: Int, _ s: CGSize) -> CGPoint {
        [CGPoint(x: s.width / 2, y: 44), CGPoint(x: 58, y: s.height / 2),
         CGPoint(x: s.width - 58, y: s.height / 2), CGPoint(x: s.width / 2, y: s.height - 54)][i]
    }
    private var litKey: String? { lit.map { evadPillarKeys[$0] } }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            TimelineView(.animation(paused: reduceMotion)) { tl in
                let t = reduceMotion ? 0.6 : tl.date.timeIntervalSinceReferenceDate
                Canvas { ctx, s in
                    for (k, l) in links.enumerated() {
                        let p = pos(l.a, s), q = pos(l.b, s)
                        let bend: CGFloat = l.a > l.b ? -22 : 22
                        let mid = CGPoint(x: (p.x + q.x) / 2 + (q.y - p.y) / 260 * bend, y: (p.y + q.y) / 2 - (q.x - p.x) / 260 * bend)
                        var path = Path(); path.move(to: p); path.addQuadCurve(to: q, control: mid)
                        let on = lit == nil || lit == l.a || lit == l.b
                        ctx.stroke(path, with: .color(.white.opacity(on ? 0.28 : 0.07)), style: StrokeStyle(lineWidth: 1.2, dash: [3, 4]))
                        guard on else { continue }
                        // a light running from cause to effect (still under reduced motion)
                        let u = CGFloat((t * 0.35 + Double(k) * 0.37).truncatingRemainder(dividingBy: 1))
                        let x = (1 - u) * (1 - u) * p.x + 2 * (1 - u) * u * mid.x + u * u * q.x
                        let y = (1 - u) * (1 - u) * p.y + 2 * (1 - u) * u * mid.y + u * u * q.y
                        ctx.fill(Path(ellipseIn: CGRect(x: x - 3, y: y - 3, width: 6, height: 6)), with: .color(hues[l.a].glow))
                    }
                }
            }
            .frame(height: 300)
            .overlay {
                GeometryReader { g in
                    ForEach(0..<4, id: \.self) { i in
                        let p = pos(i, g.size)
                        Button { withAnimation(reduceMotion ? nil : .spring(response: 0.35)) { lit = lit == i ? nil : i } } label: {
                            VStack(spacing: 5) {
                                StillOrb(palette: hues[i].orb, size: lit == i ? 62 : 52, level: 0.75)
                                    .shadow(color: hues[i].glow.opacity(lit == i ? 0.9 : 0.45), radius: lit == i ? 22 : 12)
                                Text(evadPillarName(evadPillarKeys[i])).nkFont(13, .semibold).foregroundStyle(.white)
                                if let v = value(i) {
                                    Text(v).font(.nkNumber(14)).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
                                        .minimumScaleFactor(0.8)
                                }
                            }
                            .frame(maxWidth: 150)
                            .opacity(lit == nil || lit == i ? 1 : 0.45)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel([evadPillarName(evadPillarKeys[i]), value(i)].compactMap { $0 }.joined(separator: ", "))
                        .accessibilityAddTraits(lit == i ? .isSelected : [])
                        .position(x: p.x, y: p.y + 14)
                    }
                }
            }
            NKHueText(evadPillarDetail(o, lit: litKey), hue: evadHue, size: 15, serif: true)
                .fixedSize(horizontal: false, vertical: true)
                .animation(reduceMotion ? nil : .easeInOut, value: lit)
            // what flows along each link of the lit pillar, cause → effect
            if let litKey {
                VStack(spacing: 0) {
                    ForEach(Array(mapLinkLines(o, lit: litKey).enumerated()), id: \.offset) { _, l in
                        let from = evadPillarKeys.firstIndex { evadPillarName($0) == l.from } ?? 0
                        HStack(spacing: 10) {
                            Circle().fill(hues[from].glow).frame(width: 8, height: 8)
                            Text("\(l.from) → \(l.to)").nkFont(13, .medium).foregroundStyle(.white.opacity(0.6))
                                .frame(width: 118, alignment: .leading)
                            Text(l.text).nkFont(14).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 8)
                        .accessibilityElement(children: .combine)
                    }
                }
                .transition(.opacity)
            }
        }
    }
}
