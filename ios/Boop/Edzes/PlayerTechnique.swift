import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The technique and the challenge in the player (mezo-r36n9.84)

// The pieces the active workout adds for an intensity technique (spec 2026-11-17 §6.10, the round-7 simulator spike
// on `spike/boop-blokk-epito`, dressed in the player's dark look):
//
//   • the exercise head says up front what is special about it today — a technique pill, a „KIHÍVÁS" pill;
//   • when the technique set is current, a **step card** says what to do, one line per step („1 · bukásig",
//     „2 · 30 mp pihenő", „3 · 42,5 kg, ugyanannyi"), the current one lit, the short rest counting down in it;
//   • the half reps are **their own moment** after the last full set: a counter, the number to beat, done.
//
// The marks and the challenge's yellow are the block builder's own (`PlanMark`, `planWarn`), so a technique looks the
// same where it is set and where it is lifted. Gold stays the record's: a beaten half-rep best is a record.

/// The mark of a technique, the same as in the builder.
func techniqueMark(_ t: SetTechnique) -> PlanMark.Kind {
    switch t {
    case .none: .keep
    case .restDrop: .timer
    case .drop: .drop
    case .myo: .myo
    case .partials: .partials
    }
}

/// What the step card says, line by line, for one technique set. Built from the server's own prescription, so a
/// different drop percent or rest in the config reads right without a client change.
enum TechniqueLines {
    /// The lines, and which one is current. `run` is nil before the main part is done.
    static func lines(plan: PrescribedSet, run: TechniqueRun?) -> (lines: [String], current: Int) {
        guard let technique = plan.technique else { return ([], 0) }
        var lines = [mainLine(plan)]
        var current = 0
        switch technique {
        case .myo:
            // Four identical mini-sets would be eight lines; they read as one rest and one repeating step.
            let minis = plan.legs.filter { $0.kind == .mini }
            guard let mini = minis.first else { break }
            if mini.restBeforeSec > 0 { lines.append("\(mini.restBeforeSec) mp pihenő") }
            let range = mini.minReps.map { "\($0)–\(mini.reps ?? $0)" } ?? "\(mini.reps ?? 4)"
            let done = run.map { $0.legs.filter { $0.kind == .mini }.count } ?? 0
            lines.append("\(range) ismétlés · \(min(done + 1, minis.count)). / \(minis.count) mini szett")
            // The challenge after the myo set (owner 2026-11-19: a technique and the challenge on one exercise).
            if plan.legs.last?.kind == .partials { lines.append(legLine(plan.legs.last!, main: nil)) }
            if let run {
                let resting = run.restEndsAt.map { $0 > Date() } ?? false
                if run.next?.kind == .partials { current = lines.count - 1 }
                else { current = mini.restBeforeSec > 0 ? (resting ? 1 : 2) : 1 }
            }
        default:
            var stepIndex: [Int] = []          // the line each leg's own step sits on
            var restIndex: [Int] = []
            for leg in plan.legs {
                if leg.restBeforeSec > 0 { restIndex.append(lines.count); lines.append("\(leg.restBeforeSec) mp pihenő") }
                else { restIndex.append(-1) }
                stepIndex.append(lines.count)
                lines.append(legLine(leg, main: run?.main))
            }
            if let run, plan.legs.indices.contains(run.at) {
                let i = run.at
                let resting = run.restEndsAt.map { $0 > Date() } ?? false
                current = resting && restIndex[i] >= 0 ? restIndex[i] : stepIndex[i]
            }
        }
        return (lines, current)
    }

    static func mainLine(_ plan: PrescribedSet) -> String {
        if plan.technique == .partials { return "Az utolsó teljes sorozat" }
        switch plan.targetRIR {
        case 0?: return "Bukásig"
        case let r?: return "Majdnem bukásig · \(r) tartalék"
        case nil: return "Bukásig"
        }
    }

    static func legLine(_ leg: PrescribedLeg, main: SessionSet?) -> String {
        switch leg.kind {
        case .drop:
            let kg = main.map { WorkoutSession.legDefaults(leg, main: $0, plannedKg: nil).kg } ?? leg.weightKg
            let weight = kg.map { nkKg($0) } ?? "\(leg.dropPercent ?? 30)%-kal kevesebb súly"
            return leg.toFailure ? "\(weight), újra bukásig" : "\(weight), ugyanannyi"
        case .mini:
            return "\(leg.reps ?? 4) ismétlés"
        case .partials:
            return "Kihívás: félismétlések, amennyi megy"
        }
    }

    /// The one line under a set row that says what the technique adds — planned or done.
    static func rowNote(plan: PrescribedSet?, logged: SessionSet?) -> String? {
        if let logged, let t = logged.technique {
            let legs = logged.legs ?? []
            if t == .partials { return "+ \(logged.partials ?? 0) félismétlés" }
            let steps = legs.filter { $0.kind != .partials }
            let half = logged.partials.map { " · + \($0) félismétlés" } ?? ""
            if steps.isEmpty { return "\(t.name.lowercased()) · megállt a főrész után\(half)" }
            let parts = steps.map { leg in
                [leg.weightKg.map { WorkoutPlayer.plain($0) }, leg.reps.map { "\($0)" }]
                    .compactMap { $0 }.joined(separator: " × ")
            }
            return "\(t.name.lowercased()) · \(parts.joined(separator: " · "))\(half)"
        }
        guard let plan, plan.isTechnique, let t = plan.technique else { return nil }
        if t == .partials { return "utána félismétlések, amennyi megy" }
        let then = plan.legs.last?.kind == .partials ? ", utána a kihívás" : ""
        return "\(t.name.lowercased()) az utolsó sorozaton\(then)"
    }
}

/// „PIHENŐS DROP" in the head, with its mark.
struct TechniquePill: View {
    let technique: SetTechnique
    let hue: Hue
    var body: some View {
        PlanPill(technique.name.uppercased(), mono: true, color: hue.glow, mark: techniqueMark(technique))
            .accessibilityLabel("Ma: \(technique.name) az utolsó sorozaton")
    }
}

struct ChallengePill: View {
    var body: some View {
        PlanPill("KIHÍVÁS", mono: true, color: planWarn, mark: .flag)
            .accessibilityLabel("Ma ez a nap kihívása: félismétlések az utolsó sorozat után")
    }
}

/// The step card: what the technique set asks for, step by step, the current one lit and the rest counting down in
/// it. Before the main part is done every line is still ahead, the first one lit.
struct TechniqueStepCard: View {
    let technique: SetTechnique
    let lines: [String]
    let current: Int
    /// The short rest inside the set, when it is running.
    let remaining: TimeInterval?
    let total: TimeInterval?
    let hue: Hue

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                PlanMark(techniqueMark(technique), color: hue.glow, size: 17)
                Text("\(technique.name.uppercased()) · EZ AZ UTOLSÓ SOROZAT")
                    .nkFont(10, .semibold, design: .monospaced).tracking(1.2)
                    .foregroundStyle(hue.glow)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            ForEach(Array(lines.enumerated()), id: \.offset) { i, text in
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(i < current ? AnyShapeStyle(NK.good)
                                      : (i == current ? AnyShapeStyle(hue.glow) : AnyShapeStyle(.white.opacity(0.1))))
                            .frame(width: 26, height: 26)
                        if i < current {
                            PlanMark(.check, color: NK.ground, size: 13)
                        } else {
                            Text("\(i + 1)").nkFont(13, .bold)
                                .foregroundStyle(i == current ? NK.ground : .white.opacity(0.6))
                        }
                    }
                    Text(text).nkFont(15, i == current ? .semibold : .regular)
                        .foregroundStyle(.white.opacity(i == current ? 1 : (i < current ? 0.5 : 0.6)))
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    if i == current, let remaining {
                        Text(clock(remaining)).nkFont(20, .semibold, design: .monospaced)
                            .foregroundStyle(hue.glow)
                            .contentTransition(.numericText(countsDown: true))
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityValue(i < current ? "kész" : (i == current ? "most" : "hátra"))
            }
            if let remaining, let total, total > 0 {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.1))
                        Capsule().fill(hue.glow).frame(width: max(2, geo.size.width * CGFloat(min(1, remaining / total))))
                    }
                }
                .frame(height: 5)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(hue.glow.opacity(0.1)))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(hue.glow.opacity(0.35), lineWidth: 1))
    }

    private func clock(_ t: TimeInterval) -> String {
        let s = Int(max(0, t.rounded()))
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}

/// The half reps: one big ring he taps for every rep, the number to beat beside it. With no best yet it simply
/// counts — the app does not invent a number for him to chase.
struct PartialsCounter: View {
    @Binding var count: Int
    let best: Int?
    let challenge: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var beaten: Bool { best.map { count > $0 } ?? false }
    private var accent: Color { challenge ? planWarn : .white }

    var body: some View {
        VStack(spacing: 14) {
            HStack(spacing: 8) {
                PlanMark(challenge ? .flag : .partials, color: accent, size: 18)
                Text(challenge ? "KIHÍVÁS · AZONNAL, PIHENŐ NÉLKÜL" : "FÉLISMÉTLÉSEK · AZONNAL")
                    .nkFont(11, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(accent)
            }
            Text("Félismétlések, amennyi megy").nkFont(26, design: .serif).foregroundStyle(.white)
                .multilineTextAlignment(.center)
            Text("Csak az alsó, nyújtott fele a mozgásnak. Számold, és állj meg, amikor már nem megy tisztán.")
                .nkFont(14).foregroundStyle(.white.opacity(0.65)).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            ZStack {
                Circle().stroke(.white.opacity(0.1), lineWidth: 12)
                Circle().trim(from: 0, to: min(1, CGFloat(count) / CGFloat(max(1, (best ?? max(count, 9)) + 1))))
                    .stroke(beaten ? NK.gold : accent, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(reduceMotion ? nil : .snappy, value: count)
                VStack(spacing: 0) {
                    Text("\(count)").nkFont(64, .medium).foregroundStyle(beaten ? NK.gold : .white)
                        .contentTransition(.numericText())
                    Text(caption).nkFont(13, .medium)
                        .foregroundStyle(beaten ? NK.gold : .white.opacity(0.55))
                }
            }
            .frame(width: 200, height: 200)
            .contentShape(Circle())
            .onTapGesture { count += 1 }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Félismétlések: \(count). \(caption)")
            .accessibilityAdjustableAction { dir in
                switch dir {
                case .increment: count += 1
                case .decrement: count = max(0, count - 1)
                @unknown default: break
                }
            }

            HStack(spacing: 14) {
                round("−") { count = max(0, count - 1) }
                Text("koppints a körre minden ismétlésnél").nkFont(12).foregroundStyle(.white.opacity(0.5))
                    .multilineTextAlignment(.center)
                round("+") { count += 1 }
            }
        }
        .padding(.top, 4)
        .sensoryFeedback(.impact(weight: .medium), trigger: count)
    }

    private var caption: String {
        if beaten { return "új csúcs" }
        if let best { return "a csúcsod \(best)" }
        return "még nincs csúcsod"
    }

    private func round(_ symbol: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(symbol).nkFont(24, .medium).foregroundStyle(.white)
                .frame(width: 56, height: 56).background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(symbol == "+" ? "Eggyel több" : "Eggyel kevesebb")
    }
}
