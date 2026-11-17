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
    /// The size of the number. The owner asked for the three buttons a touch smaller on 2026-11-17 — a couple of
    /// points, not a redesign — so the default came down from 44 and the row of three fits a 320 pt phone.
    let numberSize: CGFloat
    /// Typing instead of tapping. When it is given, the number itself is a field: the owner's catch was that a
    /// stepper alone cannot enter 62,5 kg on a machine he has never used. `nil` keeps it read-only.
    let onSet: (@MainActor @Sendable (String) -> Void)?
    let onDown: @MainActor @Sendable () -> Void
    let onUp: @MainActor @Sendable () -> Void

    @State private var draft = ""
    @FocusState private var editing: Bool

    public init(label: String, value: String, planned: Bool = false, hue: Hue, numberSize: CGFloat = 40,
                onSet: (@MainActor @Sendable (String) -> Void)? = nil,
                onDown: @escaping @MainActor @Sendable () -> Void,
                onUp: @escaping @MainActor @Sendable () -> Void) {
        self.label = label; self.value = value; self.planned = planned; self.hue = hue
        self.numberSize = numberSize; self.onSet = onSet; self.onDown = onDown; self.onUp = onUp
    }

    public var body: some View {
        VStack(spacing: 7) {
            HStack(spacing: 5) {
                Text(label.uppercased()).nkFont(10, .medium, design: .monospaced).tracking(1.2)
                if planned {
                    Text("· TERV").nkFont(10, design: .monospaced).tracking(1.2)
                        .foregroundStyle(.white.opacity(0.35))
                }
            }
            .foregroundStyle(.white.opacity(0.5))

            number

            HStack(spacing: 9) {
                stepButton("minus", action: onDown)
                stepButton("plus", action: onUp)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .nkGlass()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(label): \(value)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: onUp()
            case .decrement: onDown()
            default: break
            }
        }
    }

    @ViewBuilder private var number: some View {
        if let onSet {
            TextField("", text: $draft)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.center)
                .focused($editing)
                .nkFont(numberSize, .medium)
                .foregroundStyle(editing ? hue.glow : (planned ? .white.opacity(0.62) : hue.glow))
                .lineLimit(1).minimumScaleFactor(0.6)
                .frame(height: numberSize * 1.18)
                .accessibilityLabel("\(label), beírható")
                .onAppear { draft = value }
                // While he types, the field is his; the moment he leaves it the typed value is committed and the
                // page's own text takes over again — so a tap on „+" after typing still steps from what he typed.
                .onChange(of: value) { if !editing { draft = value } }
                .onChange(of: editing) { _, now in if now { draft = value } else { onSet(draft); draft = value } }
                .toolbar {
                    if editing {
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button("Kész") { editing = false }
                        }
                    }
                }
        } else {
            Text(value)
                .nkFont(numberSize, .medium)
                .foregroundStyle(planned ? .white.opacity(0.62) : hue.glow)
                .contentTransition(.numericText())
                .lineLimit(1).minimumScaleFactor(0.6)
                .frame(height: numberSize * 1.18)
        }
    }

    private func stepButton(_ symbol: String, action: @escaping @MainActor @Sendable () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))
                .frame(width: 50, height: 37)
                .background(Capsule().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(symbol == "plus" ? "Több" : "Kevesebb")
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
        if group.records.contains(i) { return NK.gold }   // gold, and only for a record
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

// MARK: - The briefing and the set list (owner round 4, 2026-11-17)

/// The player's set table: a header line and one row per set, the values **in their own cells** rather than
/// written into a sentence (owner, 2026-11-17 — *„a szett jelző sorok legyenek már designolva […] szépen
/// legyenek boxolva, tagolva"*). Four columns he can read without stopping: which set, the weight, the reps,
/// the reserve — and on the right how it went **against what the plan asked**.
public struct NKSetTable<Row: View>: View {
    let hue: Hue
    let rows: Row
    public init(hue: Hue, @ViewBuilder rows: () -> Row) { self.hue = hue; self.rows = rows() }

    public var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                head("#", width: NKSetRow.indexWidth, align: .center)
                head("KG")
                head("ISM.", width: NKSetRow.repsWidth)
                head("TART.", width: NKSetRow.reserveWidth)
                head("", width: NKSetRow.verdictWidth, align: .trailing)
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 7)
            VStack(spacing: 6) { rows }
        }
    }

    private func head(_ text: String, width: CGFloat? = nil,
                      align: Alignment = .leading) -> some View {
        Text(text)
            .nkFont(9, .medium, design: .monospaced).tracking(1.1)
            .foregroundStyle(.white.opacity(0.35))
            .frame(width: width, alignment: align)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: align)
            .accessibilityHidden(true)
    }
}

/// How one set turned out, as the set table marks it on the right. It is the kit's own small vocabulary rather
/// than `BoopCore`'s `SetVerdict`, because the design package knows nothing about the training models.
public enum NKSetMark: Equatable, Sendable {
    /// Beat his own best — the one place gold is allowed.
    case record
    case above, onTarget, below
    /// Not done yet: the plan's own numbers, waiting.
    case planned
    /// The set he is on.
    case now

    var glyph: String? {
        switch self {
        case .record: "medal-sun"
        case .above: "chart-deep"
        case .onTarget: "check-ink"
        case .below: "back-cream"
        case .planned, .now: nil
        }
    }

    /// Short enough for the column; the full sentence is the row's accessibility label.
    var word: String {
        switch self {
        case .record: "rekord"
        case .above: "terv fölött"
        case .onTarget: "terv szerint"
        case .below: "terv alatt"
        case .planned: "hátra"
        case .now: "most"
        }
    }

    var spoken: String {
        switch self {
        case .record: "rekord"
        case .above: "a terv fölött"
        case .onTarget: "a terv szerint"
        case .below: "a terv alatt"
        case .planned: "még hátra"
        case .now: "most jön"
        }
    }
}

/// One row of `NKSetTable`. Every cell is its own box-width, so the columns line up down the whole list even
/// when a weight is „77,5" and the next is „10".
public struct NKSetRow: View {
    static let indexWidth: CGFloat = 26
    static let repsWidth: CGFloat = 46
    static let reserveWidth: CGFloat = 50
    static let verdictWidth: CGFloat = 96

    let index: Int
    let kg: String
    let reps: String
    let reserve: String
    let mark: NKSetMark
    let hue: Hue
    let onTap: (@MainActor @Sendable () -> Void)?

    public init(index: Int, kg: String, reps: String, reserve: String = "–", mark: NKSetMark, hue: Hue,
                onTap: (@MainActor @Sendable () -> Void)? = nil) {
        self.index = index; self.kg = kg; self.reps = reps; self.reserve = reserve
        self.mark = mark; self.hue = hue; self.onTap = onTap
    }

    private var waiting: Bool { mark == .planned }
    private var live: Bool { mark == .now }

    public var body: some View {
        let row = HStack(spacing: 0) {
            Text("\(index)")
                .nkFont(12, .medium, design: .monospaced)
                .foregroundStyle(live ? NK.ground : .white.opacity(waiting ? 0.35 : 0.55))
                .frame(width: Self.indexWidth - 8, height: 24)
                .background(Capsule().fill(live ? hue.glow : .white.opacity(0.08)))
                .frame(width: Self.indexWidth)
            cell(kg, size: 16, weight: .medium)
                .frame(maxWidth: .infinity, alignment: .leading)
            divider
            cell(reps, size: 15).frame(width: Self.repsWidth, alignment: .center)
            divider
            cell(reserve, size: 13, dim: true).frame(width: Self.reserveWidth, alignment: .center)
            verdict.frame(width: Self.verdictWidth, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 46)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.white.opacity(live ? 0.13 : waiting ? 0.035 : 0.075))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(live ? hue.glow.opacity(0.55) : .white.opacity(0.07), lineWidth: 1)
                }
        )
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

        Group {
            if let onTap {
                Button(action: onTap) { row }.buttonStyle(.plain)
            } else {
                row
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(index). szett, \(kg) kiló, \(reps) ismétlés, \(reserve) tartalék, \(mark.spoken)")
        .accessibilityAddTraits(onTap == nil ? [] : .isButton)
        .accessibilityHint(onTap == nil ? "" : "Javítom")
    }

    private var divider: some View {
        Rectangle().fill(.white.opacity(0.07)).frame(width: 1, height: 20).padding(.horizontal, 2)
    }

    private func cell(_ text: String, size: CGFloat, weight: Font.Weight = .regular,
                      dim: Bool = false) -> some View {
        Text(text)
            .nkFont(size, weight)
            .foregroundStyle(.white.opacity(waiting ? 0.4 : dim ? 0.55 : 0.95))
            .lineLimit(1).minimumScaleFactor(0.7)
    }

    @ViewBuilder private var verdict: some View {
        if let glyph = mark.glyph {
            HStack(spacing: 5) {
                NKGlyph(glyph, mark == .record ? NK.gold : .white.opacity(0.7), size: 13)
                Text(mark.word)
                    .nkFont(10, .medium, design: .monospaced)
                    .foregroundStyle(mark == .record ? NK.gold : .white.opacity(0.5))
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
        } else {
            Text(mark.word)
                .nkFont(10, .medium, design: .monospaced)
                .foregroundStyle(live ? hue.glow : .white.opacity(0.28))
        }
    }
}

/// A stepper on **one line** — a label, minus, the number, plus. The tall card is right for the weight and the
/// reps, which he looks at while the bar is on his back; the reserve is a small answer afterwards and was
/// taking a third of the screen for it (owner, 2026-11-17).
public struct NKInlineStepper: View {
    let label: String
    let value: String
    let hue: Hue
    let onDown: @MainActor @Sendable () -> Void
    let onUp: @MainActor @Sendable () -> Void

    public init(label: String, value: String, hue: Hue,
                onDown: @escaping @MainActor @Sendable () -> Void,
                onUp: @escaping @MainActor @Sendable () -> Void) {
        self.label = label; self.value = value; self.hue = hue; self.onDown = onDown; self.onUp = onUp
    }

    public var body: some View {
        HStack(spacing: 10) {
            Text(label.uppercased())
                .nkFont(10, .medium, design: .monospaced).tracking(1.2)
                .foregroundStyle(.white.opacity(0.5))
            Spacer(minLength: 8)
            button("minus", action: onDown)
            Text(value)
                .nkFont(22, .medium).foregroundStyle(hue.glow)
                .contentTransition(.numericText())
                .frame(minWidth: 42)
            button("plus", action: onUp)
        }
        .padding(.horizontal, 14).padding(.vertical, 9)
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

    private func button(_ symbol: String, action: @escaping @MainActor @Sendable () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))
                .frame(width: 44, height: 34)
                .background(Capsule().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityHidden(true)
    }
}

/// „70–85 perc" against a 0–90 minute axis: the one number the briefing leads with. The estimate is the
/// server's own `durationEst`; the band around it is the ±10 % the page says out loud, never a guess the page
/// invents on its own.
public struct NKTimeRange: View {
    let minutes: Int
    let hue: Hue
    let caption: String
    private let axis = 90.0

    public init(minutes: Int, hue: Hue, caption: String = "a saját tempód alapján") {
        self.minutes = minutes; self.hue = hue; self.caption = caption
    }

    private var low: Int { max(1, Int((Double(minutes) * 0.9).rounded())) }
    private var high: Int { Int((Double(minutes) * 1.1).rounded()) }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text("\(low)–\(high)").nkFont(38, .medium).foregroundStyle(.white)
                    Text("perc").nkFont(14).foregroundStyle(.white.opacity(0.6))
                }
                Spacer(minLength: 8)
                Text(caption)
                    .nkFont(12).foregroundStyle(.white.opacity(0.5))
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 110)
            }
            GeometryReader { geo in
                let w = geo.size.width
                let a = min(1, Double(low) / axis), b = min(1, Double(high) / axis)
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.1))
                    Capsule().fill(hue.glow)
                        .frame(width: max(6, w * (b - a)))
                        .offset(x: w * a)
                }
            }
            .frame(height: 8)
            HStack {
                ForEach([0, 30, 60], id: \.self) { m in
                    Text("\(m)").nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.35))
                    Spacer(minLength: 0)
                }
                Text("90 perc").nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.35))
            }
        }
        .padding(16)
        .nkGlass()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Várható idő \(low)–\(high) perc, \(caption)")
    }
}

/// One card of „Mit vállalsz ma?": the exercise's own photo, what the engine is asking for, and the two taps —
/// *miért ez?* and *vállalom / elengedtem*.
public struct NKMissionCard<Photo: View>: View {
    let kicker: String
    let glyph: String
    let exercise: String
    let target: String
    let from: String?
    let taken: Bool
    let hue: Hue
    let photo: Photo
    let onWhy: @MainActor @Sendable () -> Void
    let onToggle: @MainActor @Sendable () -> Void

    public init(kicker: String, glyph: String, exercise: String, target: String, from: String? = nil,
                taken: Bool, hue: Hue, @ViewBuilder photo: () -> Photo,
                onWhy: @escaping @MainActor @Sendable () -> Void,
                onToggle: @escaping @MainActor @Sendable () -> Void) {
        self.kicker = kicker; self.glyph = glyph; self.exercise = exercise; self.target = target
        self.from = from; self.taken = taken; self.hue = hue; self.photo = photo()
        self.onWhy = onWhy; self.onToggle = onToggle
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topLeading) {
                photo
                HStack(spacing: 6) {
                    NKGlyph(glyph, glyph.hasSuffix("-sun") ? NK.gold : .white, size: 13)
                    Text(kicker.uppercased()).nkFont(10, .semibold, design: .monospaced).tracking(1.1)
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(Capsule().fill(.black.opacity(0.42)))
                .padding(11)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(exercise).nkFont(13).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
                Text(target).nkFont(24, .medium).foregroundStyle(taken ? hue.glow : .white.opacity(0.5))
                    .lineLimit(1).minimumScaleFactor(0.7)
                if let from {
                    Text(from).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45)).lineLimit(1)
                }
            }
            .padding(.horizontal, 14).padding(.top, 10)
            Spacer(minLength: 8)
            HStack(spacing: 8) {
                Button(action: onWhy) {
                    Text("Miért ez?").nkFont(13).foregroundStyle(.white.opacity(0.85))
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(Capsule().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
                Button(action: onToggle) {
                    Text(taken ? "Vállalom" : "Elengedtem")
                        .nkFont(13, .semibold)
                        .foregroundStyle(taken ? NK.ground : .white.opacity(0.8))
                        .lineLimit(1).minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(Capsule().fill(taken ? hue.glow : .white.opacity(0.1)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(taken ? "Elengedem: \(target)" : "Vállalom: \(target)")
            }
            .padding(.horizontal, 12).padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .nkGlass()
        .opacity(taken ? 1 : 0.62)
    }
}
