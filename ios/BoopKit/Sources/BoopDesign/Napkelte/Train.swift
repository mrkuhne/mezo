import SwiftUI

// MARK: - Where you are in the block

/// One week of a training block on the timeline: how hard it asks you to work, and whether it
/// is behind you, the one you are in, or still to come.
public struct NKBlockWeek: Identifiable, Equatable, Sendable {
    public enum State: Sendable { case past, current, future }
    /// 1…n.
    public let week: Int
    /// What the week asks of you, 0…1 — the phase's own height on the curve.
    public let load: Double
    /// „Alap" · „Építés" · „Csúcs" · „Pihenőhét".
    public let phase: String
    public let state: State
    /// A deload is the one week that is deliberately *easier*, and it is drawn apart so a dip
    /// never reads as a week you missed.
    public let isDeload: Bool
    public var id: Int { week }

    public init(week: Int, load: Double, phase: String, state: State, isDeload: Bool = false) {
        self.week = week; self.load = max(0, min(1, load)); self.phase = phase
        self.state = state; self.isDeload = isDeload
    }
}

/// **Where you are in the block, in time and in difficulty** (owner, 2026-11-17). One row:
/// the weeks left to right as time, their height as how hard they ask you to work, and the
/// week you are in lit and named.
///
/// It is a rising line, not a progress ring: a block is not a thing you fill up, it is a climb
/// that gets steeper and then deliberately drops for the easy week. The drop is drawn hollow
/// rather than short-and-dim, so a deload reads as *planned rest* and never as a week you lost.
public struct NKBlockTimeline: View {
    let weeks: [NKBlockWeek]
    let hue: Hue
    /// What the whole row is about, e.g. „8 hetes blokk · 3. hét".
    let caption: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(_ weeks: [NKBlockWeek], hue: Hue, caption: String? = nil) {
        self.weeks = weeks; self.hue = hue; self.caption = caption
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(weeks) { week in
                    column(week)
                }
            }
            .frame(height: 96)
            if let caption {
                Text(caption)
                    .nkFont(12, design: .monospaced)
                    .foregroundStyle(.white.opacity(0.5))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    private func column(_ week: NKBlockWeek) -> some View {
        VStack(spacing: 6) {
            Spacer(minLength: 0)
            ZStack(alignment: .bottom) {
                // The week's own bar. A deload is an outline: easier on purpose, not missing.
                RoundedRectangle(cornerRadius: 5)
                    .fill(fill(week))
                    .overlay {
                        if week.isDeload {
                            RoundedRectangle(cornerRadius: 5)
                                .strokeBorder(hue.glow.opacity(week.state == .future ? 0.35 : 0.7),
                                              style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                        }
                    }
                    .frame(height: max(8, 76 * week.load))
            }
            Text("\(week.week)")
                .nkFont(11, week.state == .current ? .semibold : .regular, design: .monospaced)
                .foregroundStyle(.white.opacity(week.state == .current ? 0.95 : 0.4))
        }
        .frame(maxWidth: .infinity)
        .overlay(alignment: .top) {
            // Only the week he is in is named: eight labels would be a table, not a picture.
            if week.state == .current {
                Text(week.phase.uppercased())
                    .nkFont(9, .medium, design: .monospaced)
                    .tracking(1.2)
                    .foregroundStyle(hue.glow)
                    .fixedSize()
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: week.state)
    }

    private func fill(_ week: NKBlockWeek) -> Color {
        if week.isDeload { return .clear }
        switch week.state {
        case .past: return .white.opacity(0.2)
        case .current: return hue.glow
        case .future: return .white.opacity(0.1)
        }
    }

    private var label: String {
        guard let current = weeks.first(where: { $0.state == .current }) else {
            return "A blokk hetei"
        }
        return "\(weeks.count) hetes blokk, a \(current.week). héten jársz: \(current.phase)"
    }
}

// MARK: - One muscle's load across the block

/// One muscle's weekly volume against its own landmarks, for the block's load page.
public struct NKMuscleLoad: Identifiable, Equatable, Sendable {
    public let muscle: String
    /// Weekly working sets, oldest week first. `nil` is a week that has not happened — a gap,
    /// never a zero.
    public let weeks: [Int?]
    /// The planned scaffold for the same weeks, so a missed week is visibly below its plan.
    public let planned: [Int]
    /// Where the lines sit: the least that maintains, the productive middle, the most it can take.
    public let mev: Int?
    public let mav: Int?
    public let mrv: Int
    public var id: String { muscle }

    public init(muscle: String, weeks: [Int?], planned: [Int], mev: Int? = nil, mav: Int? = nil, mrv: Int) {
        self.muscle = muscle; self.weeks = weeks; self.planned = planned
        self.mev = mev; self.mav = mav; self.mrv = mrv
    }
}

/// One muscle's whole block in a row: the planned climb as a faint scaffold, what was actually
/// logged on top of it, and the MRV line across the top. A week with no data draws **nothing**
/// — a gap in the row is "we do not know", and a zero-height bar would be "you did nothing".
public struct NKMuscleLoadRow: View {
    let load: NKMuscleLoad
    let hue: Hue
    let title: String

    public init(_ load: NKMuscleLoad, hue: Hue, title: String) {
        self.load = load; self.hue = hue; self.title = title
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title).nkFont(14, .medium).foregroundStyle(.white.opacity(0.9))
                Spacer()
                Text(summary).nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5))
            }
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(Array(load.planned.enumerated()), id: \.offset) { i, planned in
                    bar(week: i, planned: planned)
                }
            }
            .frame(height: 54)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title): \(summary)")
    }

    private func bar(week i: Int, planned: Int) -> some View {
        let top = max(load.mrv, load.planned.max() ?? 1)
        let actual = i < load.weeks.count ? load.weeks[i] : nil
        return ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 3)
                .fill(.white.opacity(0.09))
                .frame(height: max(3, 50 * Double(planned) / Double(max(1, top))))
            if let actual {
                RoundedRectangle(cornerRadius: 3)
                    .fill(actual > load.mrv ? Color(hex: 0xE2765B) : hue.glow.opacity(0.85))
                    .frame(height: max(3, 50 * Double(actual) / Double(max(1, top))))
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// „14 / 16 sorozat" — this week against what the muscle can take.
    private var summary: String {
        guard let latest = load.weeks.compactMap({ $0 }).last else { return "még nincs adat" }
        return "\(latest) / \(load.mrv) sorozat"
    }
}
