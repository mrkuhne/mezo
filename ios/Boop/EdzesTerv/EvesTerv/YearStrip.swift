import SwiftUI
import BoopCore
import BoopDesign

// The year as thin columns on one line (mezo-r36n9.113, the spike's `ETYearStrip`): upper-body blocks rise above it,
// leg blocks hang below it, so the alternation reads without a second colour. Each block climbs to its last, light
// week, drawn hollow; the buffer weeks are dots on the line; the consolidation is short marks on both sides. Every week
// is placed from the server's dates, and the strip has `52 + overrunWeeks` columns [RF 4]. No animation of its own: a
// re-dated plan simply redraws (reduced motion has nothing to switch off here).

struct YearStrip: View {
    let plan: WireYearPlan
    /// false on the create screen's preview: nothing is behind him yet, no „itt tartasz".
    var showsCurrent = true
    private let half: CGFloat = 34

    private var weeks: [EvesStripWeek] { evesStripWeeks(plan) }
    private var total: Int { weeks.count }
    /// Today's week, clamped onto the strip (a year past its end marks the last column).
    private var current: Int? {
        guard showsCurrent, let w = plan.currentWeek else { return nil }
        return min(max(w, 1), total)
    }

    var body: some View {
        let weeks = self.weeks
        VStack(alignment: .leading, spacing: 8) {
            if let current {
                GeometryReader { geo in
                    let x = geo.size.width * (CGFloat(current) - 0.5) / CGFloat(total)
                    Text("ITT TARTASZ · \(plan.currentWeek ?? current). HÉT").nkFont(9, .semibold, design: .monospaced).tracking(1.1)
                        .foregroundStyle(planHue.glow).fixedSize()
                        .position(x: min(max(x, 60), geo.size.width - 60), y: 6)
                }
                .frame(height: 12)
            }
            HStack(spacing: total > 56 ? 1 : 1.5) {
                ForEach(Array(weeks.enumerated()), id: \.offset) { i, w in column(i + 1, w) }
            }
            .frame(height: half * 2)
            .overlay { Rectangle().fill(.white.opacity(0.18)).frame(height: 1) }
            .overlay {
                if let current {
                    GeometryReader { geo in
                        let x = geo.size.width * (CGFloat(current) - 0.5) / CGFloat(total)
                        Rectangle().fill(planHue.glow).frame(width: 1.5, height: half * 2 + 10).position(x: x, y: half)
                    }
                }
            }
            GeometryReader { geo in
                ForEach([1, 14, 27, 40], id: \.self) { w in
                    Text(evesMonth(evesMonday(week: w, start: plan.startDate)))
                        .nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.45)).fixedSize()
                        .position(x: geo.size.width * (CGFloat(w) - 1) / CGFloat(total) + 14, y: 6)
                }
                Text("\(total)").nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.45)).fixedSize()
                    .position(x: geo.size.width - 7, y: 6)
            }
            .frame(height: 12)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(current.map { _ in "Az év \(total) hete, a \(plan.currentWeek ?? 0). héten tartasz" } ?? "Az év \(total) hete")
    }

    @ViewBuilder private func column(_ w: Int, _ week: EvesStripWeek) -> some View {
        let style = fill(w, week)
        VStack(spacing: 0) {
            switch week.kind {
            case .upper:
                Spacer(minLength: 0)
                bar(week.load, light: week.light, style)
                Color.clear.frame(height: half)
            case .lower:
                Color.clear.frame(height: half)
                bar(week.load, light: week.light, style)
                Spacer(minLength: 0)
            case .consolidation:
                Spacer(minLength: 0)
                bar(week.load, light: false, style)
                bar(week.load, light: false, style)
                Spacer(minLength: 0)
            case .empty:
                Spacer(minLength: 0)
                Circle().fill(style).frame(width: 3.5, height: 3.5)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func bar(_ load: Double, light: Bool, _ style: Color) -> some View {
        RoundedRectangle(cornerRadius: 1.5)
            .fill(light ? .clear : style)
            .overlay { if light { RoundedRectangle(cornerRadius: 1.5).strokeBorder(style, lineWidth: 1) } }
            .frame(height: half * load)
    }

    private func fill(_ w: Int, _ week: EvesStripWeek) -> Color {
        guard let current else { return .white.opacity(0.5) }
        if w == current { return planHue.glow }
        if w < current { return .white.opacity(0.32) }
        if week.running { return planHue.glow.opacity(0.4) }
        return .white.opacity(0.16)
    }
}
