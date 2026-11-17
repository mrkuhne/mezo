import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The player (B5, the active workout)

// **The design is the owner's own Lágy player** (`IRANY.md` §11b, and the „Mezo · Lágy irány" artifact's
// `jatszo()`), dressed in Napkelte: a dark screen with one vivid accent — here the Mozgás hue — and **gold kept
// for records alone**.
//
// Three screens and one rule between them:
//
//   • **lifting** — the exercise with its photograph, its note VISIBLE (not behind a button), the two big
//     numbers with the reserve directly under them, the sets so far with how each one went, one primary button;
//   • **rest** — the countdown as a BAR (never a ring) and, above all, **the verdict of the set just done**;
//   • **the three questions** — Pumpa · érzed? / Ízületi fájdalom / Akarunk még? — asked **once per exercise,
//     after its last set**, never between sets.
//
// Round 4 (owner, 2026-11-17) rewrote the lifting screen's furniture, and every line of it is his:
//   – the „2. szett / 6 · 1. gyakorlat / 2" counter and the „legutóbb…" line are **gone** (the strip above and
//     the set list below already say both, and he reads neither mid-set);
//   – **the reserve is a third stepper directly under the weight and the reps**, and all three are a couple of
//     points smaller;
//   – the sets are a **list**, each with the mark of how it went against the plan on its right;
//   – **everything else lives behind one „…"** — the note, the swap, the order, a set more or fewer, the
//     records and the technique. No row of buttons under the numbers.
//
// Typing is new too: the numbers are fields, because a stepper alone cannot enter 62,5 kg on a machine he has
// never used before.
//
// The player is a **full-screen cover at page level, outside the area-page system** — it has to survive the
// phone locking, and a room opened from the home ring has no navigation stack under it.

struct WorkoutPlayer: View {
    @Binding var session: WorkoutSession
    let hue: Hue
    /// Exercise name (lowercased) → the server's demo still. Built by the room from today's plan and the
    /// catalog, so a swapped-in exercise brings its own picture with it.
    let photos: [String: String]
    /// Everything he can swap to, and everything he has ever lifted. Loaded by the room, lazily.
    let catalog: [CatalogExercise]
    let records: [ExerciseRecord]
    /// Closing the player without finishing: the workout keeps running.
    let onMinimise: () -> Void
    /// Everything is logged: go to the ceremony.
    let onFinish: () -> Void
    /// The writes that must reach the server. The player does not know what an outbox is; the room turns these
    /// into queued items.
    let onLogged: (UUID, SessionSet) -> Void
    let onExerciseDone: (UUID, ExerciseFeedback) -> Void
    let onSkipped: (UUID) -> Void
    /// The swap, which needs a connection. Returns the sentence to show when it could not be done.
    let onSwap: (UUID, CatalogExercise, Bool) async -> String?

    @State private var kg: Double = 0
    @State private var reps: Int = 0
    @State private var rir: Int = 2
    @State private var touched = false
    @State private var feedback = ExerciseFeedback()
    @State private var sheet: PlayerSheet?
    @State private var swapping = false
    /// Why the last swap could not be done. It stays **in the sheet**, not in a toast: a message that explains
    /// why nothing happened has to be where he is still looking.
    @State private var swapProblem: String?
    /// The player's own toast. The room's lives **behind** this full-screen cover, so a message raised here
    /// was never seen — the swap's „nincs net" among them.
    @State private var toast: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Ticks once a second so the countdown moves; nothing else depends on it.
    @State private var now = Date()
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            // **The player is dark.** Not the page's painted sky: the owner's own rule for this surface is a
            // dark screen with one vivid accent, and a bright sunrise behind a weight number is the opposite of
            // a gym at 7 p.m. The hue is here as a single glow behind the head, nothing more.
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
        .nkToast($toast)
        .onAppear(perform: loadCurrent)
        .onReceive(tick) { now = $0 }
        .onChange(of: session.currentExerciseId) { loadCurrent() }
        // Every set has its own plan — a warm-up and the working sets after it are different weights. Without
        // this the big number kept the previous set's value and he would have logged the warm-up weight three
        // more times under „a terv szerint".
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

                // **One „…" on the screen, not two** (owner, 2026-11-17). It sits by the exercise, where the
                // actions are; finishing the workout is the last row of that same menu.
                Color.clear.frame(width: 42, height: 42).accessibilityHidden(true)
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
            exerciseHead(e)

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

            numberPads
            setList(e)

            primary(touched ? "Kész \(Self.article(e.logged.count + 1)) \(e.logged.count + 1). szett"
                            : "Kész · a terv szerint") {
                logSet()
            }
        }
    }

    /// The exercise: its photograph, the muscle group above its name, and the one „…" that holds everything
    /// else he can do with it.
    private func exerciseHead(_ e: SessionExercise) -> some View {
        HStack(alignment: .top, spacing: 13) {
            NKRemoteThumb(BoopConfig.mediaURL(photo(for: e)), size: 58)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text(muscleName(e.muscle).uppercased())
                        .nkFont(10, .medium, design: .monospaced).tracking(1.2)
                        .foregroundStyle(hue.glow)
                    if e.plan(at: e.logged.count)?.kind == .warmup {
                        Text("BEMELEGÍTŐ").nkFont(9, .semibold, design: .monospaced).tracking(1)
                            .foregroundStyle(.white.opacity(0.75))
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(Capsule().fill(.white.opacity(0.12)))
                    }
                }
                Text(e.name).nkFont(26, design: .serif).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Button { sheet = .exerciseMenu(e.id) } label: {
                Image(systemName: "ellipsis").nkFont(15, .semibold).foregroundStyle(.white.opacity(0.85))
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(.white.opacity(0.1)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Mit csinálunk ezzel a gyakorlattal?")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The server's own demo still for the exercise. The session model keeps only what the player needs, so
    /// the picture is looked up by name — which also survives a swap, because the new row brings its own name.
    private func photo(for e: SessionExercise) -> String? { photos[e.name.lowercased()] }

    /// Weight and reps side by side, **the reserve directly under them** — the owner's own layout from round 4.
    /// All three take typing as well as tapping.
    private var numberPads: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                NKStepper(label: "Súly · kg", value: kgText, planned: !touched, hue: hue,
                          onSet: { typed in
                              if let v = Self.decimal(typed) { kg = max(0, v); touched = true }
                          },
                          onDown: { kg = max(0, kg - 2.5); touched = true },
                          onUp: { kg += 2.5; touched = true })
                NKStepper(label: "Ismétlés", value: "\(reps)", planned: !touched, hue: hue,
                          onSet: { typed in
                              if let v = Int(typed.filter(\.isNumber)), v > 0 { reps = v; touched = true }
                          },
                          onDown: { reps = max(1, reps - 1); touched = true },
                          onUp: { reps += 1; touched = true })
            }
            NKInlineStepper(label: "Tartalék · ismétlés", value: rir >= 5 ? "5+" : "\(rir)", hue: hue,
                            onDown: { rir = max(0, rir - 1) },
                            onUp: { rir = min(5, rir + 1) })
        }
    }

    private var kgText: String { kg > 0 ? nkKg(kg).replacingOccurrences(of: " kg", with: "") : "–" }

    /// „az 1. szett", „a 2. szett" — Hungarian takes `az` before a vowel sound, and 1 and 5 are the two set
    /// numbers a player ever reaches that begin with one.
    static func article(_ n: Int) -> String { (n == 1 || n == 5) ? "az" : "a" }

    /// „62,5" and „62.5" both mean the same thing on a Hungarian phone.
    static func decimal(_ text: String) -> Double? {
        let cleaned = text.replacingOccurrences(of: ",", with: ".")
            .filter { $0.isNumber || $0 == "." }
        return cleaned.isEmpty ? nil : Double(cleaned)
    }

    /// The exercise's sets as a list: what was lifted, the reserve, and **how it went against the plan** on the
    /// right. A done set opens for correction; the waiting ones show what the plan asks.
    private func setList(_ e: SessionExercise) -> some View {
        NKSetTable(hue: hue) {
            ForEach(Array(e.logged.enumerated()), id: \.element.id) { i, set in
                NKSetRow(index: i + 1, kg: set.kg.map(Self.plain) ?? "–", reps: "\(set.reps)",
                         reserve: set.rir.map { "\($0)" } ?? "–",
                         mark: mark(set.verdict), hue: hue) { sheet = .editSet(set.id) }
            }
            ForEach(e.logged.count..<max(e.logged.count, e.setCount), id: \.self) { i in
                let plan = e.plan(at: i)
                NKSetRow(index: i + 1, kg: plan?.targetKg.map(Self.plain) ?? "–",
                         reps: plan?.targetReps.map { "\($0)" } ?? "–",
                         reserve: plan?.targetRIR.map { "\($0)" } ?? "–",
                         mark: i == e.logged.count ? .now : .planned, hue: hue)
            }
        }
    }

    /// A weight without its unit — the column header already says „KG".
    static func plain(_ kg: Double) -> String { nkKg(kg).replacingOccurrences(of: " kg", with: "") }

    private func mark(_ verdict: SetVerdict) -> NKSetMark {
        switch verdict {
        case .record: .record
        case .above: .above
        case .onTarget: .onTarget
        case .below: .below
        }
    }

    private func setText(_ set: SessionSet) -> String {
        [set.kg.map { nkKg($0).replacingOccurrences(of: " kg", with: "") }, "\(set.reps)"]
            .compactMap { $0 }.joined(separator: " × ")
    }

    private func planText(_ e: SessionExercise, _ i: Int) -> String {
        guard let plan = e.plan(at: i) else { return "–" }
        let w = plan.targetKg.map { nkKg($0).replacingOccurrences(of: " kg", with: "") } ?? "–"
        guard let reps = plan.targetReps else { return w }
        return "\(w) × \(reps)"
    }

    private var index: Int { session.all.firstIndex { $0.id == session.currentExerciseId } ?? 0 }

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
                    set.verdict == .record ? NK.gold : hue.glow, size: 20)
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
            NKRemoteThumb(BoopConfig.mediaURL(photo(for: next.exercise)), size: 40)
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
                            NKGlyph("medal-sun", NK.gold, size: 12)
                            Text("\(records(e)) rekord").nkFont(10, .semibold, design: .monospaced)
                                .foregroundStyle(NK.gold)
                        }
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(Capsule().fill(NK.gold.opacity(0.14)))
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

    private func say(_ text: String) { toast = text }

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
        case note(UUID), swap(UUID), exerciseMenu(UUID), editSet(UUID), pick, records(UUID), technique(UUID)
        var id: String {
            switch self {
            case .note(let id): "note-\(id)"
            case .swap(let id): "swap-\(id)"
            case .exerciseMenu(let id): "menu-\(id)"
            case .editSet(let id): "set-\(id)"
            case .records(let id): "rec-\(id)"
            case .technique(let id): "tech-\(id)"
            case .pick: "pick"
            }
        }
    }

    @ViewBuilder private func sheet(for sheet: PlayerSheet) -> some View {
        Group {
            switch sheet {
            case .note(let id): noteSheet(id)
            case .editSet(let id): editSheet(id)
            case .exerciseMenu(let id): exerciseMenuSheet(id)
            case .swap(let id): swapSheet(id)
            case .records(let id): recordsSheet(id)
            case .technique(let id): techniqueSheet(id)
            case .pick: pickSheet
            }
        }
        .presentationDetents([.medium, .large])
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
                VStack(spacing: 12) {
                    HStack(spacing: 10) {
                        NKStepper(label: "Súly · kg",
                                  value: set.kg.map { nkKg($0).replacingOccurrences(of: " kg", with: "") } ?? "–",
                                  hue: hue,
                                  onSet: { typed in
                                      if let v = Self.decimal(typed) {
                                          session.edit(setId: setId, kg: max(0, v), reps: set.reps, rir: set.rir)
                                      }
                                  },
                                  onDown: { session.edit(setId: setId, kg: max(0, (set.kg ?? 0) - 2.5), reps: set.reps, rir: set.rir) },
                                  onUp: { session.edit(setId: setId, kg: (set.kg ?? 0) + 2.5, reps: set.reps, rir: set.rir) })
                        NKStepper(label: "Ismétlés", value: "\(set.reps)", hue: hue,
                                  onSet: { typed in
                                      if let v = Int(typed.filter(\.isNumber)), v > 0 {
                                          session.edit(setId: setId, kg: set.kg, reps: v, rir: set.rir)
                                      }
                                  },
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

    /// **Everything that is not lifting** lives here (owner, round 4). The order follows how often he reaches
    /// for it in a gym, not how the code is organised.
    private func exerciseMenuSheet(_ id: UUID) -> some View {
        let e = session.exercises[id]
        let left = session.progress.total - session.progress.done
        return NKSheetFrame(hue: hue, eyebrow: e?.name ?? "Gyakorlat", title: "Mit csinálunk vele?") {
            VStack(spacing: 0) {
                menuRow("book-sage", "Jegyzet a gyakorlathoz") { sheet = .note(id) }
                menuRow("repeat-deep", "Végleg lecserélem másikra") { sheet = .swap(id) }
                menuRow("medal-sun", "Rekordok") { sheet = .records(id) }
                menuRow("camera-ink", "Technika") { sheet = .technique(id) }
                menuRow("plus-ink", "Egy szettel több") {
                    session.addSet(to: id); sheet = nil; say("Egy szettel több")
                }
                if let e, e.setCount - 1 >= max(1, e.logged.count) {
                    menuRow("scale-ink", "Egy szettel kevesebb") {
                        session.dropSet(from: id); sheet = nil; say("Egy szettel kevesebb")
                    }
                }
                menuRow("shoe-cream", "Foglalt a gép — mást csinálok most") { sheet = .pick }
                menuRow("clock-ink", "Később csinálom meg") {
                    session.postpone(id); sheet = nil; say("A gyakorlat a sor végére került")
                }
                menuRow("moon-sky", "Kihagyom ezt a gyakorlatot") {
                    let step = session.skip(id); sheet = nil
                    onSkipped(id)
                    say("Kihagyva — az összegzés nem büntet érte")
                    if step == .finish { onFinish() }
                }
                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.vertical, 4)
                menuRow("star-sun", left > 0 ? "Befejezem az edzést · \(left) szett hátra"
                                             : "Lezárom az edzést") { sheet = nil; onFinish() }
            }
        }
    }

    /// **„Most másik gyakorlatot csinálok"** — the machine is taken, so he picks another one off today's list
    /// and carries on with it. It is deliberately not a reorder: the plan's order stands, and when this one is
    /// finished the session goes back to the first unfinished exercise after it, exactly as it would have.
    private var pickSheet: some View {
        let others = session.all.filter { !$0.isDone && $0.id != session.currentExerciseId }
        return NKSheetFrame(hue: hue, eyebrow: "Edzés", title: "Mit csinálsz helyette?") {
            if others.isEmpty {
                NKNotLiveYet(hue: hue, title: "Nincs mire váltani",
                             line: "A mai sorból ez az egyetlen gyakorlat, ami még hátravan.")
            } else {
                VStack(spacing: 7) {
                    ForEach(others) { e in
                        Button {
                            session.switchTo(e.id)
                            sheet = nil
                            say("\(e.name) következik")
                        } label: {
                            HStack(spacing: 11) {
                                NKRemoteThumb(BoopConfig.mediaURL(photo(for: e)), size: 42)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(muscleName(e.muscle).uppercased())
                                        .nkFont(9, .medium, design: .monospaced).tracking(1.1)
                                        .foregroundStyle(hue.glow.opacity(0.85))
                                    Text(e.name).nkFont(15).foregroundStyle(.white).lineLimit(1)
                                    Text("\(e.logged.count) / \(e.setCount) szett · \(planText(e, e.logged.count))")
                                        .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.35))
                            }
                            .padding(.horizontal, 11).padding(.vertical, 9)
                            .frame(maxWidth: .infinity)
                            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
                            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                    Text("A terved sorrendje nem változik — ha ezzel megvagy, ott folytatod, ahol tartottál.")
                        .nkFont(12).foregroundStyle(.white.opacity(0.45))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)
                }
            }
        }
    }

    /// The swap: the catalog filtered to the same muscle first, and **the one write in the player that needs a
    /// connection** — the server mints the replacement row's id and every set after it is addressed by that id.
    private func swapSheet(_ id: UUID) -> some View {
        let e = session.exercises[id]
        let muscle = e?.muscle ?? ""
        let same = catalog.filter { $0.muscle == muscle && $0.id != id }
        let rest = catalog.filter { $0.muscle != muscle && $0.id != id }
        return NKSheetFrame(hue: hue, eyebrow: e?.name ?? "Gyakorlat", title: "Mire cseréljük?") {
            if catalog.isEmpty {
                NKNoFreshData("A gyakorlatlistát most nem érem el")
            } else {
                VStack(spacing: 7) {
                    if swapping {
                        Text("Cserélem…").nkFont(13).foregroundStyle(.white.opacity(0.6))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if let swapProblem {
                        HStack(alignment: .top, spacing: 9) {
                            NKGlyph("bolt-peach", Color(hex: 0xE8A07A), size: 16)
                            Text(swapProblem).nkFont(13).foregroundStyle(.white.opacity(0.85))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
                    }
                    ForEach(same + rest.prefix(30)) { c in
                        Button {
                            swapping = true
                            swapProblem = nil
                            Task {
                                let problem = await onSwap(id, c, false)
                                swapping = false
                                swapProblem = problem
                                if problem == nil { sheet = nil; say("\(c.name) — lecserélve") }
                            }
                        } label: {
                            HStack(spacing: 11) {
                                NKRemoteThumb(BoopConfig.mediaURL(c.imageStartURL), size: 40)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(c.name).nkFont(14).foregroundStyle(.white).lineLimit(1)
                                    Text(muscleName(c.muscle)).nkFont(11, design: .monospaced)
                                        .foregroundStyle(.white.opacity(0.45))
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.35))
                            }
                            .padding(.horizontal, 11).padding(.vertical, 8)
                            .frame(maxWidth: .infinity)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.06)))
                            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(swapping)
                    }
                    Text("A csere a mai edzésre szól, és internetet kér — a szerver adja a cserélt sor azonosítóját.")
                        .nkFont(12).foregroundStyle(.white.opacity(0.45))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    /// What he has ever done on this exercise — his own history, nothing computed here.
    private func recordsSheet(_ id: UUID) -> some View {
        let e = session.exercises[id]
        let record = records.first { $0.name.caseInsensitiveCompare(e?.name ?? "") == .orderedSame }
        return NKSheetFrame(hue: hue, eyebrow: e?.name ?? "Gyakorlat", title: "Rekordok") {
            if let r = record {
                VStack(alignment: .leading, spacing: 12) {
                    if let best = r.bestSet {
                        recordRow("A legnehezebb szett",
                                  [best.weightKg.map { nkKg($0) }, "\(best.reps) ismétlés"].compactMap { $0 }.joined(separator: " × "),
                                  best.date, gold: true)
                    }
                    if let e1rm = r.bestE1rm {
                        recordRow("Becsült egyismétléses maximum", nkKg(e1rm), r.bestE1rmSet?.date, gold: false)
                    }
                    if let vol = r.bestSessionVolumeKg {
                        recordRow("A legtöbb egy edzésen", nkKg(vol), r.bestSessionVolumeDate, gold: false)
                    }
                    recordRow("Eddig összesen", "\(r.sessionCount) alkalom · \(r.totalSets) szett", nil, gold: false)
                }
            } else {
                NKNotLiveYet(hue: hue, title: "Ezzel még nincs előzményed",
                             line: "Amint néhány szettet rögzítesz ebből a gyakorlatból, itt fognak állni a rekordjaid.")
            }
        }
    }

    private func recordRow(_ label: String, _ value: String, _ date: String?, gold: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).nkFont(13).foregroundStyle(.white.opacity(0.65))
                if let date { Text(date).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.35)) }
            }
            Spacer(minLength: 8)
            Text(value).nkFont(17, .medium).foregroundStyle(gold ? NK.gold : .white)
        }
        .padding(.vertical, 9)
        .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
        .accessibilityElement(children: .combine)
    }

    /// The two demo stills the catalog has for the exercise — the start and the end of the movement — plus the
    /// rep range the plan is working in. With no pictures it says so instead of showing an empty frame.
    private func techniqueSheet(_ id: UUID) -> some View {
        let e = session.exercises[id]
        let c = catalog.first { $0.name.caseInsensitiveCompare(e?.name ?? "") == .orderedSame }
        return NKSheetFrame(hue: hue, eyebrow: e?.name ?? "Gyakorlat", title: "Technika") {
            VStack(alignment: .leading, spacing: 12) {
                if c?.imageStartURL != nil || c?.imageEndURL != nil {
                    HStack(spacing: 10) {
                        techniqueFrame("Kiinduló", BoopConfig.mediaURL(c?.imageStartURL))
                        techniqueFrame("Végpont", BoopConfig.mediaURL(c?.imageEndURL))
                    }
                } else {
                    NKNoFreshData("Ehhez a gyakorlathoz nincs bemutató kép")
                }
                if let note = e?.note, !note.isEmpty {
                    Text(note).nkFont(14).foregroundStyle(.white.opacity(0.8))
                }
                Text("A képek a gyakorlattárból jönnek. Videót a weben tudsz hozzárakni.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45))
            }
        }
    }

    private func techniqueFrame(_ label: String, _ url: URL?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            NKRemoteBanner(url, hue: hue, height: 128)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            Text(label.uppercased()).nkFont(9, .medium, design: .monospaced).tracking(1.1)
                .foregroundStyle(.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
    }

    private func menuRow(_ glyph: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                NKGlyph(glyph, glyph.hasSuffix("-sun") ? NK.gold : .white.opacity(0.8), size: 17)
                Text(label).nkFont(15).foregroundStyle(.white.opacity(0.9))
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.35))
            }
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
