import SwiftUI
import BoopCore
import BoopDesign

/// The muscles the „Izmok ezen a héten" card lists: the hardest-worked `top` this week, and how many more there are.
func muscleRows(_ bands: [MuscleBand], top: Int = 5) -> (rows: [MuscleBand], more: Int) {
    let sorted = bands.sorted { $0.current != $1.current ? $0.current > $1.current : $0.muscle < $1.muscle }
    let rows = Array(sorted.prefix(top))
    return (rows, bands.count - rows.count)
}

/// **Izmok ezen a héten** — this week's top muscles as slim bars with their set counts (Edzés redesign, spec
/// 2026-11-27 §5.2, mezo-r36n9.197.2; spike `SpikeMuscleBars`). Each bar is this week's sets against the plan's
/// ceiling, all on one scale. At the accessibility text sizes the name goes above its bar, so name and number never
/// collide.
struct EdzesMuscleBars: View {
    let bands: [MuscleBand]
    let hue: Hue
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let (rows, more) = muscleRows(bands)
        let most = max(1, rows.map { max($0.ceiling, $0.current) }.max() ?? 1)
        VStack(alignment: .leading, spacing: 11) {
            ForEach(rows) { b in
                row(b, most: most)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(muscleName(b.muscle).capitalizedFirst): \(b.current) szett ezen a héten")
            }
            if more > 0 {
                Text("+\(more) további izomcsoport").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
            }
        }
    }

    @ViewBuilder private func row(_ b: MuscleBand, most: Int) -> some View {
        let name = Text(muscleName(b.muscle).capitalizedFirst).nkFont(14).foregroundStyle(.white.opacity(0.85))
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 6) {
                name.fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 10) { bar(b, most: most); number(b) }
            }
        } else {
            HStack(spacing: 10) {
                name.frame(width: 92, alignment: .leading).lineLimit(1).minimumScaleFactor(0.7)
                bar(b, most: most)
                number(b).frame(width: 28, alignment: .trailing)
            }
        }
    }

    private func bar(_ b: MuscleBand, most: Int) -> some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.08))
                    .frame(width: g.size.width * CGFloat(b.ceiling) / CGFloat(most))
                Capsule().fill(hue.glow.opacity(0.9))
                    .frame(width: g.size.width * CGFloat(min(b.current, most)) / CGFloat(most))
            }
        }
        .frame(height: 8)
    }

    private func number(_ b: MuscleBand) -> some View {
        Text("\(b.current)").font(.nkNumber(18)).foregroundStyle(.white).monospacedDigit().fixedSize()
    }
}
