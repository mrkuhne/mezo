import ActivityKit
import AppIntents
import BoopDesign
import SwiftUI
import WidgetKit

/// The running workout on the Lock Screen and in the Dynamic Island, as spike shot 10 (`ebreszto-10-zarolt-edzes`):
/// dark glass card, the Mozgás glow for the countdown and the main button, serif exercise, Outfit numbers, mono labels.
struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            WorkoutCard(attributes: context.attributes, state: context.state, stale: context.isStale)
                .padding(.horizontal, 16).padding(.vertical, 12)
                .activityBackgroundTint(Color.black.opacity(0.55))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.bottom) {
                    WorkoutCard(attributes: context.attributes, state: context.state, stale: context.isStale)
                }
            } compactLeading: {
                OrbDot(size: 18)
            } compactTrailing: {
                CompactTrailing(state: context.state, stale: context.isStale)
            } minimal: {
                OrbDot(size: 18)
            }
            .keylineTint(WorkoutCard.glow)
        }
    }
}

/// The small Mozgás orb.
private struct OrbDot: View {
    let size: CGFloat
    var body: some View {
        Circle()
            .fill(RadialGradient(colors: Hue.mozgas.orb.reversed(), center: UnitPoint(x: 0.35, y: 0.3),
                                 startRadius: 0, endRadius: size * 0.7))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

private struct CompactTrailing: View {
    let state: WorkoutActivityAttributes.ContentState
    let stale: Bool
    var body: some View {
        if let ends = state.restEndsAt, !stale {
            Text(timerInterval: Date.now...max(ends, Date.now), countsDown: true)
                .font(.nkNumber(15)).monospacedDigit()
                .foregroundStyle(WorkoutCard.glow)
                .frame(maxWidth: 44)
        } else {
            Text("\(state.setIndex)/\(state.setCount)")
                .font(.nkNumber(15)).monospacedDigit()
                .foregroundStyle(.white)
        }
    }
}

struct WorkoutCard: View {
    static let glow = Hue.mozgas.glow
    let attributes: WorkoutActivityAttributes
    let state: WorkoutActivityAttributes.ContentState
    let stale: Bool

    private var resting: Bool { state.restEndsAt != nil && !stale }
    /// The rest ran out with nobody touching the phone: the next set is up.
    private var restOver: Bool { state.phase == .rest && stale }

    var body: some View {
        // The Lock Screen gives a card at most 160 pt: every size here is budgeted to fit it with the buttons.
        VStack(alignment: .leading, spacing: 5) {
            header
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(state.exercise)
                        .font(.nkSerif(20)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
                    Text(subline).font(.system(size: 12)).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
                }
                Spacer(minLength: 8)
                if let target {
                    VStack(alignment: .trailing, spacing: 0) {
                        Text(target).font(.nkNumber(21)).foregroundStyle(.white).lineLimit(1)
                        Text("cél").font(.system(size: 10)).foregroundStyle(.white.opacity(0.55))
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("Cél: \(target)")
                }
            }
            if let ends = state.restEndsAt, resting { restRow(ends) }
            if restOver {
                Text("Lejárt a pihenő").font(.nkMono(11)).tracking(1.5).foregroundStyle(Self.glow)
            }
            buttons
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            OrbDot(size: 13)
            Text("EDZÉS · \(state.done) / \(state.total) SOROZAT")
                .font(.nkMono(10)).tracking(1.5).foregroundStyle(.white.opacity(0.8))
            Spacer(minLength: 4)
            if !attributes.dayName.isEmpty {
                Text(attributes.dayName).font(.system(size: 11)).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Edzés, \(state.done) sorozat kész a \(state.total)-ból")
    }

    private var subline: String {
        let set = "\(state.setIndex). sorozat a \(state.setCount)-ből"
        switch state.phase {
        case .rest: return restOver ? set : "Következik: \(set)"
        case .set: return set
        case .technique: return "Technikás sorozat — a Boopban folytatod"
        case .debrief: return "Három gyors kérdés a Boopban"
        }
    }

    private var target: String? {
        guard state.phase == .set || state.phase == .rest, let reps = state.targetReps else { return nil }
        guard let kg = state.targetKg else { return "\(reps) ism." }
        return "\(Self.kg(kg)) kg × \(reps)"
    }

    static func kg(_ v: Double) -> String {
        v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
    }

    private func restRow(_ ends: Date) -> some View {
        let start = ends.addingTimeInterval(-(state.restTotal ?? 90))
        return HStack(spacing: 14) {
            Text("PIHENŐ").font(.nkMono(10)).tracking(1.5).foregroundStyle(.white.opacity(0.7))
            Text(timerInterval: start...ends, countsDown: true)
                .font(.nkNumber(26)).monospacedDigit().foregroundStyle(Self.glow)
                .frame(width: 72, alignment: .leading)
            ProgressView(timerInterval: start...ends, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                .progressViewStyle(.linear).tint(Self.glow)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Pihenő")
    }

    @ViewBuilder private var buttons: some View {
        if state.phase == .rest && resting {
            HStack(spacing: 10) {
                Button(intent: AddRestIntent()) { pill("+15 mp", filled: false) }
                    .buttonStyle(.plain).accessibilityLabel("Még 15 másodperc pihenő")
                Button(intent: SkipRestIntent()) { pill("Tovább", filled: true) }
                    .buttonStyle(.plain).accessibilityLabel("Pihenő vége, tovább")
            }
        } else if state.phase == .technique && resting {
            Button(intent: SkipRestIntent()) { pill("Tovább", filled: true) }
                .buttonStyle(.plain).accessibilityLabel("Pihenő vége, tovább")
        } else if (state.phase == .set || restOver) && state.canLogHere, let target {
            Button(intent: LogPlannedSetIntent()) { pill("Kész · \(target)", filled: true) }
                .buttonStyle(.plain).accessibilityLabel("Kész, \(target) rögzítése")
        }
    }

    private func pill(_ text: String, filled: Bool) -> some View {
        Text(text)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(filled ? Color.black.opacity(0.85) : .white)
            .lineLimit(1).minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity, minHeight: 36)
            .background(Capsule().fill(filled ? Self.glow : Color.white.opacity(0.14)))
    }
}
