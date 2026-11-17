import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The player (B5, the active workout)

// **The design is the owner's own Lágy player, taken over almost as it is** (`IRANY.md` §11b,
// owner 2026-11-05, and the „Mezo · Lágy irány" artifact's `jatszo()`), dressed in Napkelte —
// which is the easy half, because that player was already dark with one vivid accent. Here the
// accent is the Mozgás hue, and **gold is kept for records alone**.
//
// Three screens and one rule between them:
//
//   • **lifting** — the exercise, its note VISIBLE (not behind a button), what the plan asks,
//     the two big numbers, the sets so far, the reserve, and one primary button;
//   • **rest** — the countdown as a BAR (never a ring) and, above all, **the verdict of the
//     set just done**;
//   • **the three questions** — Pumpa · érzed? / Ízületi fájdalom / Akarunk még? — asked
//     **once per exercise, after its last set**, never between sets.
//
// Parity was the owner's own catch on the first Lágy round, so it is the bar here too: add and
// drop a set, correct a set already logged, swap, skip, do it later, the note, the technique,
// the records, finish early. What is not in this slice says so plainly instead of pretending.
//
// The player is a **full-screen cover at page level, outside the area-page system** — it has
// to survive the phone locking, and a room opened from the home ring has no navigation stack
// under it.

struct WorkoutPlayer: View {
    @Binding var session: WorkoutSession
    let hue: Hue
    /// Closing the player without finishing: the workout keeps running.
    let onMinimise: () -> Void
    /// Everything is logged: go to the ceremony.
    let onFinish: () -> Void
    /// The three writes that must reach the server. The player does not know what an outbox
    /// is; the room turns these into queued items.
    let onLogged: (UUID, SessionSet) -> Void
    let onExerciseDone: (UUID, ExerciseFeedback) -> Void
    let onSkipped: (UUID) -> Void
    let onToast: (String) -> Void

    @State private var kg: Double = 0
    @State private var reps: Int = 0
    @State private var rir: Int = 2
    @State private var touched = false
    @State private var feedback = ExerciseFeedback()
    @State private var sheet: PlayerSheet?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Ticks once a second so the countdown moves; nothing else depends on it.
    @State private var now = Date()
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            // **The player is dark.** Not the page's painted sky: the owner's own rule for
            // this surface is a dark screen with one vivid accent, and a bright sunrise
            // behind a weight number is the opposite of a gym at 7 p.m. The hue is here as a
            // single glow behind the head, nothing more.
            NK.ground.ignoresSafeArea()
            RadialGradient(colors: [hue.glow.opacity(0.22), .clear], center: .top,
                           startRadius: 0, endRadius: 420)
                .ignoresSafeArea()
            VStack(spacing: 0) {
                header
                ScrollView {
                    VStack(spacing: 18) {
                        switch session.step {
                        case .set: lifting
                        case .rest: resting
                        case .debrief: debrief
                        case .finish: Color.clear.frame(height: 1)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 14)
                    .padding(.bottom, 40)
                }
                .scrollIndicators(.hidden)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear(perform: loadCurrent)
        .onReceive(tick) { now = $0 }
        .onChange(of: session.currentExerciseId) { loadCurrent() }
        // Every set has its own plan — a warm-up and the working sets after it are different
        // weights. Without this the big number kept the previous set's value and he would
        // have logged the warm-up weight three more times under „a terv szerint".
        .onChange(of: session.progress.done) { loadCurrent() }
        .sheet(item: $sheet) { sheet(for: $0) }
    }

    // MARK: - The top

    private var header: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                Button(action: onMinimise) {
                    Image(systemName: "chevron.down").nkFont(16, .semibold).foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                }
                .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                .accessibilityLabel("Kis méretre — az edzés tovább fut")

                VStack(spacing: 1) {
                    Text(title).nkFont(15, .medium).foregroundStyle(.white).lineLimit(1)
                    Text("\(minutes) perc · \(session.progress.done) / \(session.progress.total) szett")
                        .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                }
                .frame(maxWidth: .infinity)

                Button { sheet = .workoutMenu } label: {
                    Image(systemName: "ellipsis").nkFont(16, .semibold).foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                }
                .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                .accessibilityLabel("Az edzés menüje")
            }
            NKSetStrip(strip, hue: hue)
                .frame(height: 3)
                .padding(.horizontal, 4)
        }
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    private var title: String { "Edzés" }

    private var minutes: Int { max(0, Int(now.timeIntervalSince(session.startedAt) / 60)) }

    private var strip: [NKSetStrip.Group] {
        session.all.map { e in
            NKSetStrip.Group(
                id: e.id.uuidString, sets: e.setCount, done: e.logged.count,
                records: Set(e.logged.enumerated().filter { $0.element.verdict == .record }.map(\.offset)),
                skipped: e.skipped,
                current: e.id == session.currentExerciseId ? e.logged.count : nil)
        }
    }

    // MARK: - Lifting

    @ViewBuilder private var lifting: some View {
        if let e = session.current {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    Text("\(e.logged.count + 1). szett / \(e.setCount)")
                        .nkFont(11, .medium, design: .monospaced).tracking(1)
                        .foregroundStyle(hue.glow)
                    Text("\(index + 1). gyakorlat / \(session.all.count)")
                        .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                    Spacer(minLength: 0)
                    // A warm-up is not the work, and a light weight on the big number means
                    // something quite different depending on which this is.
                    if e.plan(at: e.logged.count)?.kind == .warmup {
                        Text("BEMELEGÍTŐ").nkFont(9, .semibold, design: .monospaced).tracking(1)
                            .foregroundStyle(.white.opacity(0.75))
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(Capsule().fill(.white.opacity(0.12)))
                    }
                }
                Text(e.name).nkFont(30, design: .serif).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)

                // The note is on the screen while he lifts — the owner caught its absence once.
                if let note = e.note, !note.isEmpty {
                    Button { sheet = .note(e.id) } label: {
                        HStack(alignment: .top, spacing: 9) {
                            NKGlyph("book-sage", .white.opacity(0.7), size: 15)
                            Text(note).nkFont(13).foregroundStyle(.white.opacity(0.8))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(12)
                        .nkGlass()
                    }
                    .buttonStyle(.plain)
                }

                Text(targetLine(e))
                    .nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.55))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 12) {
                NKStepper(label: "Súly · kg", value: kgText, planned: !touched, hue: hue,
                          onDown: { kg = max(0, kg - 2.5); touched = true },
                          onUp: { kg += 2.5; touched = true })
                NKStepper(label: "Ismétlés", value: "\(reps)", planned: !touched, hue: hue,
                          onDown: { reps = max(1, reps - 1); touched = true },
                          onUp: { reps += 1; touched = true })
            }

            setList(e)
            reserve

            HStack(spacing: 10) {
                secondary("book-sage", "Jegyzet") { sheet = .note(e.id) }
                secondary("repeat-deep", "Csere") { sheet = .swap(e.id) }
                // No glyph here on purpose: the kit has no "more" mark, and inventing one is a
                // new icon that needs the owner's eye first.
                secondary(nil, "Több") { sheet = .exerciseMenu(e.id) }
            }

            primary(touched ? "Kész a \(e.logged.count + 1). szett" : "Kész · a terv szerint") {
                logSet()
            }
        }
    }

    private var index: Int { session.all.firstIndex { $0.id == session.currentExerciseId } ?? 0 }

    private var kgText: String { kg > 0 ? nkKg(kg).replacingOccurrences(of: " kg", with: "") : "–" }

    private func targetLine(_ e: SessionExercise) -> String {
        var parts: [String] = []
        if let bestKg = e.bestKg, let bestReps = e.bestReps {
            parts.append("Legutóbb \(nkKg(bestKg)) × \(bestReps)")
        }
        if let plan = e.plan(at: e.logged.count) {
            let target = [plan.targetKg.map { nkKg($0) }, plan.targetReps.map { "\($0) ismétlés" }]
                .compactMap { $0 }.joined(separator: " × ")
            if !target.isEmpty { parts.append("ma a cél \(target)") }
        }
        return parts.isEmpty ? "Az első alkalom ezzel a gyakorlattal." : parts.joined(separator: " · ")
    }

    /// The sets of this exercise: done ones open for correction, the current one lit, the rest
    /// waiting — plus the − and + that change how many there are.
    private func setList(_ e: SessionExercise) -> some View {
        NKFlowRow(spacing: 8, rowSpacing: 8) {
            ForEach(Array(e.logged.enumerated()), id: \.element.id) { i, set in
                Button { sheet = .editSet(set.id) } label: {
                    VStack(spacing: 2) {
                        Text(set.verdict == .record ? "REKORD" : "\(i + 1).")
                            .nkFont(9, .medium, design: .monospaced).tracking(0.8)
                            .foregroundStyle(set.verdict == .record ? Color(hex: 0xF2C94C) : .white.opacity(0.45))
                        Text(setText(set)).nkFont(13, .medium).foregroundStyle(.white.opacity(0.9))
                    }
                    .padding(.horizontal, 11).padding(.vertical, 7)
                    .background(Capsule().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(i + 1). szett, \(setText(set)) — szerkesztés")
            }
            ForEach(e.logged.count..<max(e.logged.count, e.setCount), id: \.self) { i in
                VStack(spacing: 2) {
                    Text(i == e.logged.count ? "MOST" : "\(i + 1).")
                        .nkFont(9, .medium, design: .monospaced).tracking(0.8)
                        .foregroundStyle(i == e.logged.count ? hue.glow : .white.opacity(0.3))
                    Text(planText(e, i)).nkFont(13).foregroundStyle(.white.opacity(i == e.logged.count ? 0.9 : 0.4))
                }
                .padding(.horizontal, 11).padding(.vertical, 7)
                .background(Capsule().fill(.white.opacity(i == e.logged.count ? 0.14 : 0.05)))
            }
            setCountButton("minus", enabled: e.setCount - 1 >= max(1, e.logged.count)) { session.dropSet(from: e.id) }
            setCountButton("plus", enabled: true) { session.addSet(to: e.id) }
        }
    }

    private func setCountButton(_ symbol: String, enabled: Bool,
                                action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white.opacity(enabled ? 0.75 : 0.25))
                .frame(width: 36, height: 32)
                .background(Capsule().fill(.white.opacity(0.08)))
        }
        .buttonStyle(.plain).disabled(!enabled)
        .accessibilityLabel(symbol == "plus" ? "Egy szettel több" : "Egy szettel kevesebb")
    }

    private func setText(_ set: SessionSet) -> String {
        [set.kg.map { nkKg($0).replacingOccurrences(of: " kg", with: "") }, "\(set.reps)"]
            .compactMap { $0 }.joined(separator: " × ")
    }

    private func planText(_ e: SessionExercise, _ i: Int) -> String {
        guard let plan = e.plan(at: i) else { return "–" }
        let w = plan.targetKg.map { nkKg($0).replacingOccurrences(of: " kg", with: "") } ?? "–"
        return "\(w) × \(plan.targetReps ?? 0)"
    }

    /// „Tartalék" — how many reps he had left. 3 means three or more.
    private var reserve: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TARTALÉK").nkFont(10, .medium, design: .monospaced).tracking(1.2)
                .foregroundStyle(.white.opacity(0.5))
            HStack(spacing: 8) {
                ForEach(0...3, id: \.self) { v in
                    Button { rir = v } label: {
                        Text(v == 3 ? "3+" : "\(v)")
                            .nkFont(15, .medium)
                            .foregroundStyle(rir == v ? NK.ground : .white.opacity(0.8))
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(Capsule().fill(rir == v ? hue.glow : .white.opacity(0.08)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(v == 3 ? "három vagy több" : "\(v)") ismétlés tartalék")
                }
            }
        }
    }

    // MARK: - Rest

    @ViewBuilder private var resting: some View {
        if let e = session.current, let last = e.logged.last {
            NKRestBar(remaining: remaining, total: WorkoutSession.restSeconds, hue: hue)
                .padding(.vertical, 6)
            verdictCard(last, exercise: e)
            setList(e)
            if let next = nextUp { nextRow(next) }
            HStack(spacing: 10) {
                Button { session.addRest() } label: {
                    Text("+30 mp").nkFont(15, .medium).foregroundStyle(.white.opacity(0.85))
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(Capsule().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
                Button { session.skipRest() } label: {
                    HStack(spacing: 6) {
                        Text("Tovább").nkFont(16, .semibold)
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold))
                    }
                    .foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Capsule().fill(hue.glow))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var remaining: TimeInterval {
        guard case .rest(let seconds) = session.step else { return 0 }
        _ = now     // the view redraws every second through this
        return max(0, seconds)
    }

    /// **The verdict of the set just done** — the reason the rest screen exists at all.
    private func verdictCard(_ set: SessionSet, exercise: SessionExercise) -> some View {
        HStack(alignment: .top, spacing: 12) {
            NKGlyph(set.verdict == .record ? "medal-sun" : "check-ink",
                    set.verdict == .record ? Color(hex: 0xF2C94C) : hue.glow, size: 20)
            VStack(alignment: .leading, spacing: 3) {
                Text("\(exercise.logged.count). szett · \(setText(set))")
                    .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                Text(set.verdict.hungarian).nkFont(19, design: .serif).foregroundStyle(.white)
                Text(verdictLine(set, exercise))
                    .nkFont(13).foregroundStyle(.white.opacity(0.7))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(15)
        .nkGlass()
    }

    private func verdictLine(_ set: SessionSet, _ e: SessionExercise) -> String {
        if set.verdict == .record, let bestKg = e.bestKg, let bestReps = e.bestReps {
            return "Az eddigi legjobb \(nkKg(bestKg)) × \(bestReps) volt."
        }
        guard let plan = e.plan(at: max(0, e.logged.count - 1)), let target = plan.targetReps else {
            return "Rögzítve."
        }
        let diff = set.reps - target
        if diff > 0 { return "\(diff) ismétléssel több, mint amit a terv kért." }
        if diff < 0 { return "\(-diff) ismétléssel kevesebb, mint amit a terv kért." }
        return "Pontosan annyi, amennyit a terv kért."
    }

    private var nextUp: (exercise: SessionExercise, setIndex: Int)? {
        guard let current = session.current else { return nil }
        if !current.isDone { return (current, current.logged.count) }
        guard let next = session.all.first(where: { !$0.isDone && $0.id != current.id }) else { return nil }
        return (next, next.logged.count)
    }

    private func nextRow(_ next: (exercise: SessionExercise, setIndex: Int)) -> some View {
        HStack(spacing: 12) {
            if NKBodyMark.canDraw(next.exercise.muscle) {
                NKBodyMark(muscle: next.exercise.muscle, hue: hue, height: 38).frame(width: 24)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("KÖVETKEZIK · \(next.setIndex + 1). SZETT / \(next.exercise.setCount)")
                    .nkFont(9, .medium, design: .monospaced).tracking(1)
                    .foregroundStyle(.white.opacity(0.45))
                Text("\(next.exercise.name) · \(planText(next.exercise, next.setIndex))")
                    .nkFont(14, .medium).foregroundStyle(.white.opacity(0.9))
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(13)
        .nkGlass()
    }

    // MARK: - The three questions

    @ViewBuilder private var debrief: some View {
        if let e = session.current {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text("\(e.name) kész".uppercased())
                        .nkFont(10, .medium, design: .monospaced).tracking(1.2)
                        .foregroundStyle(.white.opacity(0.5))
                    if records(e) > 0 {
                        HStack(spacing: 4) {
                            NKGlyph("medal-sun", Color(hex: 0xF2C94C), size: 12)
                            Text("\(records(e)) rekord").nkFont(10, .semibold, design: .monospaced)
                                .foregroundStyle(Color(hex: 0xF2C94C))
                        }
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Capsule().fill(Color(hex: 0xF2C94C).opacity(0.14)))
                    }
                }
                Text("Hogy ment?").nkFont(28, design: .serif).foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if case .rest = session.step {} else if nextUp != nil {
                NKRestBar(remaining: remaining, total: WorkoutSession.restSeconds, hue: hue)
            }
            setList(e)

            question("Pumpa · érzed?", ["Semmi", "Enyhe", "Jó", "Brutális"], value: $feedback.pump)
            question("Ízületi fájdalom", ["Nincs", "Enyhe", "Erős"], value: $feedback.jointPain)
            question("Akarunk még?", ["Kevés volt", "Pont jó", "Sok volt"], value: $feedback.workload)

            Button { sheet = .note(e.id) } label: {
                HStack(spacing: 9) {
                    NKGlyph("book-sage", .white.opacity(0.7), size: 15)
                    Text(e.note?.isEmpty == false ? e.note! : "Jegyzet a következő alkalomra")
                        .nkFont(13).foregroundStyle(.white.opacity(e.note?.isEmpty == false ? 0.85 : 0.5))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(13)
                .nkGlass()
            }
            .buttonStyle(.plain)

            primary(nextUp == nil ? "Mentés · edzés vége" : "Mentés · tovább") {
                let id = e.id
                let step = session.finishExercise(feedback)
                onExerciseDone(id, feedback)
                feedback = ExerciseFeedback()
                if step == .finish { onFinish() }
            }
        }
    }

    private func records(_ e: SessionExercise) -> Int { e.logged.filter { $0.verdict == .record }.count }

    private func question(_ title: String, _ options: [String], value: Binding<Int>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).nkFont(13, .medium).foregroundStyle(.white.opacity(0.75))
            HStack(spacing: 7) {
                ForEach(Array(options.enumerated()), id: \.offset) { i, option in
                    Button { value.wrappedValue = i } label: {
                        Text(option)
                            .nkFont(13, value.wrappedValue == i ? .semibold : .regular)
                            .foregroundStyle(value.wrappedValue == i ? NK.ground : .white.opacity(0.75))
                            .lineLimit(1).minimumScaleFactor(0.75)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(Capsule().fill(value.wrappedValue == i ? hue.glow : .white.opacity(0.08)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Shared bits

    private func secondary(_ glyph: String?, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let glyph { NKGlyph(glyph, .white.opacity(0.8), size: 14) }
                Text(label).nkFont(13).foregroundStyle(.white.opacity(0.8))
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Capsule().fill(.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }

    private func primary(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark").font(.system(size: 15, weight: .bold))
                Text(label).nkFont(17, .semibold)
            }
            .foregroundStyle(NK.ground)
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(Capsule().fill(hue.glow))
        }
        .buttonStyle(.plain)
        .padding(.top, 2)
    }

    private func loadCurrent() {
        guard let e = session.current else { return }
        let plan = e.plan(at: e.logged.count)
        kg = plan?.targetKg ?? e.bestKg ?? 0
        reps = plan?.targetReps ?? 8
        rir = plan?.targetRIR ?? 2
        touched = false
        feedback = e.feedback ?? ExerciseFeedback()
    }

    private func logSet() {
        guard let id = session.currentExerciseId else { return }
        let step = session.log(kg: kg > 0 ? kg : nil, reps: reps, rir: rir)
        if let set = session.exercises[id]?.logged.last { onLogged(id, set) }
        touched = false
        if step == .finish { onFinish() }
    }

    // MARK: - Sheets

    private enum PlayerSheet: Identifiable {
        case note(UUID), swap(UUID), exerciseMenu(UUID), editSet(UUID), workoutMenu
        var id: String {
            switch self {
            case .note(let id): "note-\(id)"
            case .swap(let id): "swap-\(id)"
            case .exerciseMenu(let id): "menu-\(id)"
            case .editSet(let id): "set-\(id)"
            case .workoutMenu: "workout"
            }
        }
    }

    @ViewBuilder private func sheet(for sheet: PlayerSheet) -> some View {
        Group {
            switch sheet {
            case .note(let id): noteSheet(id)
            case .editSet(let id): editSheet(id)
            case .exerciseMenu(let id): exerciseMenuSheet(id)
            case .workoutMenu: workoutMenuSheet
            case .swap: NKSheetFrame(hue: hue, eyebrow: "Edzés", title: "Csere") {
                NKNotLiveYet(hue: hue, title: "A csere még nem él",
                             line: "A gyakorlat cseréje a következő körben érkezik. Addig hagyd ki, és a jegyzetbe írd oda, mit csináltál helyette.")
            }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground(NK.ground)
        .presentationCornerRadius(34)
        .presentationDragIndicator(.visible)
    }

    private func noteSheet(_ id: UUID) -> some View {
        NKSheetFrame(hue: hue, eyebrow: session.exercises[id]?.name ?? "Gyakorlat", title: "Jegyzet") {
            VStack(alignment: .leading, spacing: 14) {
                TextField("Például: a váll végig nyugton volt", text: Binding(
                    get: { session.exercises[id]?.note ?? "" },
                    set: { session.setNote($0.isEmpty ? nil : $0, for: id) }
                ), axis: .vertical)
                .lineLimit(3...6)
                .nkFont(15).foregroundStyle(.white)
                .padding(14).nkGlass()
                Text("A jegyzet a gyakorlatnál marad, és edzés közben végig látod.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.5))
            }
        }
    }

    private func editSheet(_ setId: UUID) -> some View {
        let found = session.all.compactMap { e in e.logged.first { $0.id == setId }.map { (e, $0) } }.first
        return NKSheetFrame(hue: hue, eyebrow: found?.0.name ?? "Szett", title: "Szett javítása") {
            if let (_, set) = found {
                VStack(spacing: 14) {
                    HStack(spacing: 12) {
                        NKStepper(label: "Súly · kg", value: set.kg.map { nkKg($0).replacingOccurrences(of: " kg", with: "") } ?? "–",
                                  hue: hue,
                                  onDown: { session.edit(setId: setId, kg: max(0, (set.kg ?? 0) - 2.5), reps: set.reps, rir: set.rir) },
                                  onUp: { session.edit(setId: setId, kg: (set.kg ?? 0) + 2.5, reps: set.reps, rir: set.rir) })
                        NKStepper(label: "Ismétlés", value: "\(set.reps)", hue: hue,
                                  onDown: { session.edit(setId: setId, kg: set.kg, reps: max(1, set.reps - 1), rir: set.rir) },
                                  onUp: { session.edit(setId: setId, kg: set.kg, reps: set.reps + 1, rir: set.rir) })
                    }
                    Text("A javítás azonnal érvényes — a szerver a sor saját azonosítóját frissíti, nem vesz fel újat.")
                        .nkFont(12).foregroundStyle(.white.opacity(0.5))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func exerciseMenuSheet(_ id: UUID) -> some View {
        NKSheetFrame(hue: hue, eyebrow: session.exercises[id]?.name ?? "Gyakorlat", title: "Mit csinálunk vele?") {
            VStack(spacing: 0) {
                menuRow("book-sage", "Jegyzet a gyakorlathoz") { sheet = .note(id) }
                menuRow("clock-ink", "Később csinálom meg") {
                    session.postpone(id); sheet = nil; onToast("A gyakorlat a sor végére került")
                }
                menuRow("moon-sky", "Kihagyom ezt a gyakorlatot") {
                    let step = session.skip(id); sheet = nil
                    onSkipped(id)
                    onToast("Kihagyva — az összegzés nem büntet érte")
                    if step == .finish { onFinish() }
                }
            }
        }
    }

    private var workoutMenuSheet: some View {
        let left = session.progress.total - session.progress.done
        return NKSheetFrame(hue: hue, eyebrow: "Edzés",
                            title: left > 0 ? "Van még \(left) szett hátra" : "Minden szett megvan") {
            VStack(alignment: .leading, spacing: 14) {
                if left > 0 {
                    Text("A kimaradt szettek kihagyottként zárulnak, és az összegzés nem büntet értük.")
                        .nkFont(13).foregroundStyle(.white.opacity(0.7))
                }
                Button { sheet = nil; onFinish() } label: {
                    Text(left > 0 ? "Befejezem így" : "Lezárom az edzést")
                        .nkFont(16, .semibold).foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(Capsule().fill(hue.glow))
                }
                .buttonStyle(.plain)
                Button { sheet = nil; onMinimise() } label: {
                    Text("Kis méretre — tovább fut")
                        .nkFont(15).foregroundStyle(.white.opacity(0.8))
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Capsule().fill(.white.opacity(0.08)))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func menuRow(_ glyph: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                NKGlyph(glyph, .white.opacity(0.8), size: 17)
                Text(label).nkFont(15).foregroundStyle(.white.opacity(0.9))
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.35))
            }
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
