import SwiftUI
import BoopDesign

/// **The weeks' arc** — the Mezociklus hero's dominant graphic (Edzés redesign, spec 2026-11-27 §5.2, mezo-r36n9.197.2;
/// grown from `NKBlockTimeline`, look from the spike's `SpikeWeeksArc`). One bar per week: its height is what the week
/// asks, the current one lit, glowing and named, past weeks ticked, the deload drawn hollow so it reads as planned rest.
/// `compact` is the Ma tab's small version (step 3): lower, no phase name, no ticks.
struct EdzesWeeksArc: View {
    let weeks: [NKBlockWeek]
    let hue: Hue
    var compact: Bool = false

    private var height: CGFloat { compact ? 64 : 132 }

    var body: some View {
        HStack(alignment: .bottom, spacing: compact ? 5 : 8) {
            ForEach(weeks) { column($0) }
        }
        .frame(height: height, alignment: .bottom)
        // A graphic: its labels grow with the text size only so far, or a phase name runs over its neighbours.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Self.accessibilityText(weeks))
    }

    private func column(_ w: NKBlockWeek) -> some View {
        VStack(spacing: compact ? 4 : 6) {
            if w.state == .current, !compact {
                Text(w.phase.uppercased()).nkFont(9.5, .semibold, design: .monospaced).tracking(1.2)
                    .foregroundStyle(hue.glow).lineLimit(1).fixedSize()
            }
            ZStack(alignment: .top) {
                RoundedRectangle(cornerRadius: compact ? 4 : 7)
                    .fill(fill(w))
                    .overlay {
                        if w.isDeload {
                            RoundedRectangle(cornerRadius: compact ? 4 : 7)
                                .strokeBorder(hue.glow.opacity(w.state == .future ? 0.45 : 0.7),
                                              style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                        }
                    }
                    .shadow(color: w.state == .current ? hue.glow.opacity(0.55) : .clear, radius: compact ? 6 : 10)
                if w.state == .past, !compact {
                    Image(systemName: "checkmark").font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white.opacity(0.8)).padding(.top, 6)
                }
            }
            .frame(height: max(compact ? 8 : 14, (height - (compact ? 20 : 34)) * w.load))
            Text("\(w.week)").nkFont(compact ? 10.5 : 12, w.state == .current ? .semibold : .regular, design: .monospaced)
                .foregroundStyle(.white.opacity(w.state == .current ? 0.95 : 0.45))
                .lineLimit(1).fixedSize()
        }
        .frame(maxWidth: .infinity)
    }

    private func fill(_ w: NKBlockWeek) -> Color {
        if w.isDeload { return .clear }
        switch w.state {
        case .past: return .white.opacity(0.28)
        case .current: return hue.glow
        case .future: return .white.opacity(0.10)
        }
    }

    /// What VoiceOver reads for the whole arc.
    static func accessibilityText(_ weeks: [NKBlockWeek]) -> String {
        guard let c = weeks.first(where: { $0.state == .current }) else { return "A mezociklus hetei" }
        return "\(weeks.count) hetes mezociklus, a \(c.week). héten jársz: \(c.phase)"
    }
}
