import SwiftUI
import BoopCore
import BoopDesign

/// Terv's hero: the year plan's weeks (52 + overrun) as a strip, the season as a bracket over them and „itt tartasz".
/// No year plan → the season alone, its weeks as the strip.
struct EvadYearStrip: View {
    let o: EvadOverview
    let plan: WireYearPlan?
    let today: String

    var body: some View {
        if let plan {
            let weeks = evesStripWeeks(plan)
            let bracket = evadSeasonBracket(plan: plan, seasonStart: o.season.startDate, seasonEnd: o.season.endDate)
            let now = evesWeek(of: today, start: plan.startDate)
            canvas(weeks: weeks, bracket: bracket, now: now)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(evadYearStripSpoken(total: weeks.count, bracket: bracket, now: now))
        } else {
            let n = max(1, o.head.weeks)
            canvas(weeks: (1...n).map { w in
                EvesStripWeek(kind: w <= o.head.week ? .upper : .empty, load: 0.6, light: false, running: w == o.head.week)
            }, bracket: 1...n, now: o.head.week)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Az évad \(n) hete, most a \(o.head.week). hétnél tartasz")
        }
    }

    private func canvas(weeks: [EvesStripWeek], bracket: ClosedRange<Int>?, now: Int?) -> some View {
        Canvas { ctx, size in
            let hue = evadHue
            let w = size.width
            let cell = w / CGFloat(max(1, weeks.count))
            let barY: CGFloat = 40, barH: CGFloat = 30
            for (i, wk) in weeks.enumerated() {
                let x = CGFloat(i) * cell
                let h = wk.kind == .empty ? 3 : max(4, barH * CGFloat(wk.load))
                let r = CGRect(x: x + 0.6, y: barY + barH - h, width: max(1, cell - 1.2), height: h)
                let inSeason = bracket?.contains(i + 1) ?? false
                let path = Path(roundedRect: r, cornerRadius: min(2, cell / 3))
                if wk.kind == .empty {
                    ctx.fill(path, with: .color(.white.opacity(0.14)))
                } else if inSeason {
                    ctx.fill(path, with: .linearGradient(Gradient(colors: [hue.glow, hue.orb[1]]),
                                                          startPoint: CGPoint(x: 0, y: r.minY), endPoint: CGPoint(x: 0, y: r.maxY)))
                } else {
                    ctx.fill(path, with: .color(.white.opacity(wk.kind == .consolidation ? 0.22 : 0.38)))
                }
            }
            if let b = bracket {
                let sx = CGFloat(b.lowerBound - 1) * cell, ex = CGFloat(b.upperBound) * cell
                ctx.stroke(Path { p in
                    p.move(to: CGPoint(x: sx, y: barY - 4)); p.addLine(to: CGPoint(x: sx, y: barY - 12))
                    p.addLine(to: CGPoint(x: ex, y: barY - 12)); p.addLine(to: CGPoint(x: ex, y: barY - 4))
                }, with: .color(hue.glow), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                ctx.draw(Text("ÉVAD").font(.system(size: 10, weight: .semibold, design: .monospaced)).foregroundStyle(hue.glow),
                         at: CGPoint(x: min(max((sx + ex) / 2, 18), w - 18), y: barY - 22))
            }
            if let now, now >= 1, now <= weeks.count {
                let nx = (CGFloat(now) - 0.5) * cell
                ctx.stroke(Path { p in p.move(to: CGPoint(x: nx, y: barY - 2)); p.addLine(to: CGPoint(x: nx, y: barY + barH + 12)) },
                           with: .color(.white), lineWidth: 2)
                ctx.fill(Path(ellipseIn: CGRect(x: nx - 4, y: barY + barH + 10, width: 8, height: 8)), with: .color(.white))
                ctx.draw(Text("itt tartasz").font(.system(size: 11, weight: .medium)).foregroundStyle(.white),
                         at: CGPoint(x: min(max(nx, 32), w - 32), y: barY + barH + 28))
            }
        }
        .frame(height: 108)
    }
}

/// "Az év 52 hete, az évad a 31–42. hét, most a 37." — the strip read aloud.
func evadYearStripSpoken(total: Int, bracket: ClosedRange<Int>?, now: Int?) -> String {
    var parts = ["Az év \(total) hete"]
    if let b = bracket { parts.append("az évad a \(b.lowerBound)–\(b.upperBound). hét") }
    if let now { parts.append("most a \(now).") }
    return parts.joined(separator: ", ")
}
