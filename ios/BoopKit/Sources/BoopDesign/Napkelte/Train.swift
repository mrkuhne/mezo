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

// MARK: - The player's own pieces

/// One number he changes with his thumb, mid-set, with a sweaty hand: the value big enough to
/// read at arm's length and the two taps either side of it big enough to hit without looking.
///
/// `planned` dims the value until he touches it, so a number that is still the plan's looks
/// different from one he has decided — the Lágy player's „· terv" mark.
public struct NKStepper: View {
    let label: String
    let value: String
    let planned: Bool
    let hue: Hue
    let onDown: @MainActor @Sendable () -> Void
    let onUp: @MainActor @Sendable () -> Void

    public init(label: String, value: String, planned: Bool = false, hue: Hue,
                onDown: @escaping @MainActor @Sendable () -> Void,
                onUp: @escaping @MainActor @Sendable () -> Void) {
        self.label = label; self.value = value; self.planned = planned; self.hue = hue
        self.onDown = onDown; self.onUp = onUp
    }

    public var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 5) {
                Text(label.uppercased()).nkFont(10, .medium, design: .monospaced).tracking(1.2)
                if planned {
                    Text("· TERV").nkFont(10, design: .monospaced).tracking(1.2)
                        .foregroundStyle(.white.opacity(0.35))
                }
            }
            .foregroundStyle(.white.opacity(0.5))

            Text(value)
                .nkFont(44, .medium)
                .foregroundStyle(planned ? .white.opacity(0.62) : hue.glow)
                .contentTransition(.numericText())
                .lineLimit(1).minimumScaleFactor(0.6)

            HStack(spacing: 10) {
                stepButton("minus", action: onDown)
                stepButton("plus", action: onUp)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .nkGlass()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: onUp()
            case .decrement: onDown()
            default: break
            }
        }
    }

    private func stepButton(_ symbol: String, action: @escaping @MainActor @Sendable () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))
                .frame(width: 54, height: 40)
                .background(Capsule().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityHidden(true)
    }
}

/// The rest countdown: the time big, and a bar that drains under it.
///
/// **A bar, not a ring** — the owner's own rule for this screen (`IRANY.md` §11b: "No ring for
/// the countdown: a horizontal fill bar"), and the Napkelte canon says the same thing from the
/// other side: a circle in this app is a real clock, never a progress meter.
public struct NKRestBar: View {
    let remaining: TimeInterval
    let total: TimeInterval
    let hue: Hue

    public init(remaining: TimeInterval, total: TimeInterval, hue: Hue) {
        self.remaining = remaining; self.total = total; self.hue = hue
    }

    /// Under ten seconds the whole thing warms up — the one moment the player raises its voice.
    private var soon: Bool { remaining <= 10 }

    public var body: some View {
        VStack(spacing: 10) {
            Text("PIHENŐ").nkFont(10, .medium, design: .monospaced).tracking(1.4)
                .foregroundStyle(.white.opacity(0.5))
            Text(clock)
                .nkFont(54, .medium, design: .monospaced)
                .foregroundStyle(soon ? Color(hex: 0xF0A868) : .white)
                .contentTransition(.numericText(countsDown: true))
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.12))
                    Capsule().fill(soon ? Color(hex: 0xF0A868) : hue.glow)
                        .frame(width: max(2, g.size.width * level))
                }
            }
            .frame(height: 5)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pihenő, \(Int(max(0, remaining))) másodperc van hátra")
    }

    private var level: Double {
        guard total > 0 else { return 0 }
        return min(1, max(0, remaining / total))
    }

    /// „1:30" · „0:08".
    private var clock: String {
        let s = Int(max(0, remaining.rounded()))
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}

/// The strip across the top of the player: every set of the whole workout as one tick, grouped
/// by exercise and weighted by how many sets each has. It is the only place he can see the
/// whole session at once while lifting.
public struct NKSetStrip: View {
    /// One exercise: how many sets, how many are done, which are records, and whether it was
    /// skipped.
    public struct Group: Identifiable, Equatable, Sendable {
        public let id: String
        public let sets: Int
        public let done: Int
        public let records: Set<Int>
        public let skipped: Bool
        /// The set he is on right now, when it is in this group.
        public let current: Int?
        public init(id: String, sets: Int, done: Int, records: Set<Int> = [], skipped: Bool = false,
                    current: Int? = nil) {
            self.id = id; self.sets = sets; self.done = done; self.records = records
            self.skipped = skipped; self.current = current
        }
    }

    let groups: [Group]
    let hue: Hue
    public init(_ groups: [Group], hue: Hue) { self.groups = groups; self.hue = hue }

    public var body: some View {
        HStack(spacing: 7) {
            ForEach(groups) { group in
                HStack(spacing: 2) {
                    ForEach(0..<max(1, group.sets), id: \.self) { i in
                        Capsule().fill(colour(group, i)).frame(height: 3)
                    }
                }
                .frame(maxWidth: .infinity)
                .layoutPriority(Double(max(1, group.sets)))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    private func colour(_ group: Group, _ i: Int) -> Color {
        if group.skipped { return .white.opacity(0.07) }
        if group.records.contains(i) { return Color(hex: 0xF2C94C) }   // gold, and only for a record
        if i < group.done { return hue.glow }
        if group.current == i { return .white.opacity(0.55) }
        return .white.opacity(0.14)
    }

    private var label: String {
        let done = groups.filter { !$0.skipped }.reduce(0) { $0 + $1.done }
        let total = groups.filter { !$0.skipped }.reduce(0) { $0 + $1.sets }
        return "\(done) / \(total) szett kész"
    }
}
