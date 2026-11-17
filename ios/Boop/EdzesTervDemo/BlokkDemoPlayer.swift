#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY SIMULATOR DEMO, round 7 — how a technique and the challenge show up DURING the workout.
// This is not the player (B5 owns that, `ios/Boop/Edzes/WorkoutPlayer.swift`); it borrows its layout so the
// owner can judge the new parts in place: the technique pill on the exercise, the marked set in the strip,
// the step card that walks him through the technique, and the challenge after the last set.

/// Where he is inside one exercise.
private enum PlayerStep: Equatable {
    /// A normal working set (1-based).
    case set(Int)
    /// The technique's rest, counting down.
    case rest
    /// The technique's second part.
    case leg
    /// The challenge: half reps, as many as he can.
    case challenge
    case done
}

private struct PlayerExercise {
    let name: String
    let muscle: String
    let sets: Int
    let weight: Double
    let reps: Int
    let range: String
    let technique: DemoTechnique
    let challenge: Bool
    /// The number to beat in the challenge.
    let best: Int
}

struct BlokkDemoPlayer: View {
    let model: BlokkDemoModel
    let onBack: () -> Void

    private let exercises = [
        PlayerExercise(name: "Lat Pulldown · Neutral", muscle: "back", sets: 3, weight: 60, reps: 10, range: "8–12",
                       technique: .restDrop, challenge: false, best: 0),
        PlayerExercise(name: "Preacher Curl", muscle: "biceps", sets: 3, weight: 30, reps: 11, range: "10–15",
                       technique: .none, challenge: true, best: 7),
    ]

    @State private var index = UserDefaults.standard.string(forKey: "previewBlokkStep") == "kihivas" ? 1 : 0
    @State private var step: PlayerStep = {
        switch UserDefaults.standard.string(forKey: "previewBlokkStep") {
        case "pihi": .rest
        case "drop": .leg
        case "kihivas": .challenge
        case "utolso": .set(3)
        default: .set(2)
        }
    }()
    @State private var remaining = 30.0
    @State private var partials = UserDefaults.standard.string(forKey: "previewBlokkStep") == "kihivas" ? 5 : 0
    @State private var beaten = false

    private var exercise: PlayerExercise { exercises[index] }
    private let tick = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            DemoSky(height: 150)
            VStack(spacing: 14) {
                head
                exerciseHead
                strip
                if step == .challenge {
                    challenge
                } else if step == .done {
                    done
                } else {
                    if exercise.technique != .none, onTechniqueSet || step == .rest || step == .leg { stepCard }
                    numbers
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
        }
        .safeAreaInset(edge: .bottom) { action }
        .onReceive(tick) { _ in
            guard step == .rest, remaining > 0 else { return }
            remaining = max(0, remaining - 0.1)
            if remaining == 0 { withAnimation(.snappy) { step = .leg } }
        }
        .sensoryFeedback(.success, trigger: step)
    }

    private var onTechniqueSet: Bool {
        if case .set(let n) = step { return n == exercise.sets }
        return false
    }

    // MARK: chrome

    private var head: some View {
        HStack(spacing: 12) {
            Button(action: onBack) {
                Image(systemName: "chevron.down").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.14)))
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 1) {
                Text("EDZÉS · 18 PERC").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.7))
                Text("Hát és bicepsz").nkFont(20, design: .serif).foregroundStyle(.white)
            }
            Spacer()
            DemoPill("\(index + 1) / \(exercises.count) gyakorlat")
        }
        .padding(.top, 6)
    }

    private var exerciseHead: some View {
        HStack(alignment: .center, spacing: 14) {
            NKBodyMap([NKBodyHeat(muscle: exercise.muscle, level: 1)], hue: demoHue, views: .auto)
                .frame(width: 62, height: 92)
                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.black.opacity(0.4)))
            VStack(alignment: .leading, spacing: 7) {
                Text(demoMuscleName(exercise.muscle).uppercased()).nkFont(11, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(demoHue.glow)
                Text(exercise.name).nkFont(27, design: .serif).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
                // The exercise says up front what is special about it today.
                HStack(spacing: 6) {
                    DemoPill("\(exercise.range) ism.", icon: .reps)
                    if exercise.technique != .none {
                        DemoPill(exercise.technique.name.uppercased(), mono: true, color: demoHue.glow, icon: TechniqueChip.icon(exercise.technique))
                    }
                    if exercise.challenge {
                        DemoPill("KIHÍVÁS", mono: true, color: demoWarn, icon: .flag)
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }

    /// The sets as a strip: done, now, to come — and the special ones marked, so he sees it coming.
    private var strip: some View {
        HStack(spacing: 8) {
            ForEach(1...exercise.sets, id: \.self) { n in
                let state = setState(n)
                let special = n == exercise.sets && exercise.technique != .none
                VStack(spacing: 5) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(state == 2 ? AnyShapeStyle(demoHue.glow) : AnyShapeStyle(.white.opacity(state == 1 ? 0.16 : 0.07)))
                        if state == 1 {
                            DemoIcon(.check, color: demoGood, size: 18)
                        } else if special {
                            DemoIcon(TechniqueChip.icon(exercise.technique), color: state == 2 ? NK.ground : demoHue.glow, size: 20)
                        } else {
                            Text("\(n)").nkFont(17, .semibold).foregroundStyle(state == 2 ? NK.ground : .white.opacity(0.6))
                        }
                    }
                    .frame(height: 46)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(special && state != 2 ? demoHue.glow.opacity(0.7) : .clear, style: StrokeStyle(lineWidth: 1.2, dash: [4, 3])))
                    Text(special ? exercise.technique.name.lowercased() : "\(n). sorozat")
                        .nkFont(10, .medium).foregroundStyle(special ? demoHue.glow : .white.opacity(0.5))
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity)
            }
            if exercise.challenge {
                let on = step == .challenge
                VStack(spacing: 5) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(on ? AnyShapeStyle(demoWarn) : AnyShapeStyle(demoWarn.opacity(step == .done ? 0.3 : 0.12)))
                        DemoIcon(step == .done ? .check : .flag, color: on ? NK.ground : demoWarn, size: 20)
                    }
                    .frame(height: 46)
                    Text("kihívás").nkFont(10, .medium).foregroundStyle(demoWarn)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    /// 0 to come · 1 done · 2 now.
    private func setState(_ n: Int) -> Int {
        switch step {
        case .set(let current): n < current ? 1 : (n == current ? 2 : 0)
        case .rest, .leg: n < exercise.sets ? 1 : 2
        case .challenge, .done: 1
        }
    }

    // MARK: the technique, step by step

    private var stepCard: some View {
        let steps = exercise.technique.steps
        let now: Int = { switch step { case .rest: 1; case .leg: 2; default: 0 } }()
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                DemoIcon(TechniqueChip.icon(exercise.technique), color: demoHue.glow, size: 18)
                Text("\(exercise.technique.name.uppercased()) · EZ AZ UTOLSÓ SOROZAT").nkFont(10, .semibold, design: .monospaced).tracking(1.2).foregroundStyle(demoHue.glow)
            }
            ForEach(Array(steps.enumerated()), id: \.offset) { i, text in
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(i < now ? AnyShapeStyle(demoGood) : (i == now ? AnyShapeStyle(demoHue.glow) : AnyShapeStyle(.white.opacity(0.1))))
                            .frame(width: 26, height: 26)
                        if i < now {
                            DemoIcon(.check, color: NK.ground, size: 13)
                        } else {
                            Text("\(i + 1)").nkFont(13, .bold).foregroundStyle(i == now ? NK.ground : .white.opacity(0.6))
                        }
                    }
                    Text(text).nkFont(15, i == now ? .semibold : .regular).foregroundStyle(.white.opacity(i == now ? 1 : 0.55))
                    Spacer()
                    if i == 1, step == .rest {
                        Text(String(format: "0:%02d", Int(remaining.rounded(.up)))).nkFont(20, .semibold).foregroundStyle(demoHue.glow)
                            .contentTransition(.numericText())
                    }
                }
            }
            if step == .rest {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.1))
                        Capsule().fill(demoHue.glow).frame(width: geo.size.width * CGFloat(remaining / 30))
                    }
                }
                .frame(height: 5)
                .animation(.linear(duration: 0.1), value: remaining)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(demoHue.glow.opacity(0.1)))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(demoHue.glow.opacity(0.35), lineWidth: 1))
    }

    private var numbers: some View {
        let dropped = (exercise.weight * 0.7 / 2.5).rounded() * 2.5
        let weight = step == .leg ? dropped : exercise.weight
        return HStack(spacing: 12) {
            tile("SÚLY", demoKg(weight).replacingOccurrences(of: " kg", with: ""), "kg",
                 note: step == .leg ? "30%-kal kevesebb, mint \(demoKg(exercise.weight))" : nil)
            tile("ISMÉTLÉS", step == .rest ? "–" : "\(exercise.reps)", step == .leg ? "ugyanannyi" : "terv \(exercise.reps)", note: nil)
        }
        .opacity(step == .rest ? 0.45 : 1)
    }

    private func tile(_ label: String, _ value: String, _ unit: String, note: String?) -> some View {
        VStack(spacing: 4) {
            Text(label).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.5))
            Text(value).nkFont(46, .medium).foregroundStyle(.white).contentTransition(.numericText())
            Text(unit).nkFont(12).foregroundStyle(.white.opacity(0.5))
            if let note { Text(note).nkFont(11, .medium).foregroundStyle(demoHue.glow).multilineTextAlignment(.center) }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 16)
        .nkGlass(26)
    }

    // MARK: the challenge

    private var challenge: some View {
        VStack(spacing: 14) {
            HStack(spacing: 8) {
                DemoIcon(.flag, color: demoWarn, size: 20)
                Text("KIHÍVÁS · AZONNAL, PIHENŐ NÉLKÜL").nkFont(11, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(demoWarn)
            }
            Text("Félismétlések, amennyi megy").nkFont(27, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center)
            Text("Csak az alsó, nyújtott fele a mozgásnak. Számold, és állj meg, amikor már nem megy tisztán.")
                .nkFont(14).foregroundStyle(.white.opacity(0.65)).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)

            ZStack {
                Circle().stroke(.white.opacity(0.1), lineWidth: 12)
                Circle().trim(from: 0, to: min(1, CGFloat(partials) / CGFloat(max(1, exercise.best + 1))))
                    .stroke(AngularGradient(colors: [demoWarn, demoHue.glow, demoWarn], center: .center), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.snappy, value: partials)
                VStack(spacing: 0) {
                    Text("\(partials)").nkFont(64, .medium).foregroundStyle(partials > exercise.best ? demoWarn : .white)
                        .contentTransition(.numericText())
                    Text(partials > exercise.best ? "új csúcs" : "legutóbb \(exercise.best)").nkFont(13, .medium)
                        .foregroundStyle(partials > exercise.best ? demoWarn : .white.opacity(0.55))
                }
            }
            .frame(width: 200, height: 200)
            .contentShape(Circle())
            .onTapGesture { withAnimation(.snappy) { partials += 1 } }

            HStack(spacing: 14) {
                Button { withAnimation(.snappy) { partials = max(0, partials - 1) } } label: {
                    Text("−").nkFont(24, .medium).foregroundStyle(.white).frame(width: 56, height: 56).background(Circle().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
                Text("koppints a körre minden ismétlésnél").nkFont(12).foregroundStyle(.white.opacity(0.5))
                    .multilineTextAlignment(.center)
                Button { withAnimation(.snappy) { partials += 1 } } label: {
                    Text("+").nkFont(24, .medium).foregroundStyle(.white).frame(width: 56, height: 56).background(Circle().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 4)
        .sensoryFeedback(.impact(weight: .medium), trigger: partials)
    }

    private var done: some View {
        VStack(spacing: 14) {
            DemoIcon(beaten ? .flag : .check, color: beaten ? demoWarn : demoGood, size: 54).padding(.top, 20)
            Text(beaten ? "Új csúcs: \(partials) félismétlés" : "Kész ez a gyakorlat").nkFont(28, design: .serif).foregroundStyle(.white)
                .multilineTextAlignment(.center)
            HStack(spacing: 8) {
                DemoPill("\(exercise.sets) sorozat", icon: .sets)
                if exercise.technique != .none { DemoPill(exercise.technique.name, color: demoHue.glow, icon: TechniqueChip.icon(exercise.technique)) }
                if exercise.challenge { DemoPill("\(partials) félismétlés", color: demoWarn, icon: .flag) }
            }
            Text("A technika és a kihívás külön van rögzítve: nem számít bele a rekordjaidba és a következő edzés súlyába.")
                .nkFont(13).foregroundStyle(.white.opacity(0.55)).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: the one button

    private var action: some View {
        Button { withAnimation(.snappy) { advance() } } label: {
            Text(label).nkFont(17, .semibold).foregroundStyle(NK.ground)
                .frame(maxWidth: .infinity, minHeight: 58)
                .background(Capsule().fill(step == .challenge ? demoWarn : (step == .rest ? Color.white.opacity(0.85) : .white)))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 6)
        .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }

    private var label: String {
        switch step {
        case .set(let n):
            if n == exercise.sets, exercise.technique != .none { return "Megvan a bukás · jöhet a pihenő" }
            if n == exercise.sets, exercise.challenge { return "Megvan · jöhet a kihívás" }
            return "Megvan a \(n). sorozat"
        case .rest: return "Kihagyom a pihenőt"
        case .leg: return "Megvan a drop"
        case .challenge: return partials == 0 ? "Most nem megy · kihagyom" : "Megvan: \(partials) félismétlés"
        case .done: return index + 1 < exercises.count ? "Következő gyakorlat" : "Vissza"
        }
    }

    private func advance() {
        switch step {
        case .set(let n):
            if n < exercise.sets { step = .set(n + 1) }
            else if exercise.technique != .none { remaining = 30; step = .rest }
            else if exercise.challenge { partials = 0; step = .challenge }
            else { step = .done }
        case .rest: step = .leg
        case .leg: step = exercise.challenge ? .challenge : .done
        case .challenge: beaten = partials > exercise.best; step = .done
        case .done:
            if index + 1 < exercises.count {
                index += 1; step = .set(1); partials = 0; beaten = false
            } else {
                onBack()
            }
        }
    }
}
#endif
