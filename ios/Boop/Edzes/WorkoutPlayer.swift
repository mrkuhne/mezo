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
    /// A set he corrected, once the correction sheet closes — the room queues it for the server.
    let onEdited: (UUID, SessionSet) -> Void
    /// The exercise's own durable note, once the note sheet closes with a change — the room queues it.
    let onNote: (UUID, String?) -> Void
    let onExerciseDone: (UUID, ExerciseFeedback) -> Void
    let onSkipped: (UUID) -> Void
    /// The swap, which needs a connection. Returns the sentence to show when it could not be done.
    let onSwap: (UUID, CatalogExercise, Bool) async -> String?
    /// Look at today's briefing again — the room puts it over the player and the player stays running.
    let onBriefing: () -> Void
    /// The reasoned swap's reads and writes: suggestions, the gym, „nem esik jól" (mezo-r36n9.66).
    var swap = SwapActions()
    /// *Mi van a termemben ›* on the swap sheet opens this page. It is presented **here**, over the workout: the room
    /// cannot present anything while the player's cover is up (boop-ios.md §9). Nil: the link says „hamarosan".
    var gymSheet: (() -> AnyView)? = nil

    @State private var kg: Double = 0
    @State private var reps: Int = 0
    @State private var rir: Int = 2
    @State private var touched = false
    /// Where the pads' numbers came from (the plan, the previous set, nowhere) — the small word beside the label.
    @State private var source: WorkoutSession.PrefillSource = .none
    /// The note sheet's text and which exercise it is about; committed when the sheet closes, however it closed.
    @State private var noteDraft = ""
    @State private var noteOpen: UUID?
    @FocusState private var noteFocused: Bool
    /// The half reps he has counted so far in the partials moment.
    @State private var partials = 0
    /// Sets corrected while the correction sheet is open; sent once, when it closes, not on every tap.
    @State private var edited: Set<UUID> = []
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
                        case .techniqueRest, .leg: techniqueStep
                        case .partials: partialsMoment
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
        .onAppear {
            loadCurrent()
            #if DEBUG
            // `-previewEdzesSwap YES`: the review opens straight on the swap sheet of the first exercise
            // (`-previewEdzesSwapAt N`: of the N-th, counted from 0).
            let at = UserDefaults.standard.integer(forKey: "previewEdzesSwapAt")
            if UserDefaults.standard.bool(forKey: "previewEdzesSwap"), sheet == nil,
               session.all.indices.contains(at) {
                sheet = .swap(session.all[at].id, false)
            }
            // `-previewEdzesSheet note|menu|swapBlock` (mezo-r36n9.147): the review opens that sheet of the first exercise.
            // `-previewEdzesAt N` (mezo-r36n9.195): the player opens on the N-th exercise, counted from 0.
            let jump = UserDefaults.standard.integer(forKey: "previewEdzesAt")
            if jump > 0, session.all.indices.contains(jump) { session.switchTo(session.all[jump].id) }
            if let which = UserDefaults.standard.string(forKey: "previewEdzesSheet"), sheet == nil, let first = session.all.first {
                switch which {
                case "note": sheet = .note(first.id)
                case "menu": sheet = .exerciseMenu(first.id)
                case "swapBlock": sheet = .swap(first.id, true)
                default: break
                }
            }
            #endif
        }
        .onReceive(tick) { now = $0 }
        .onChange(of: session.currentExerciseId) { loadCurrent() }
        // Every set has its own plan — a warm-up and the working sets after it are different weights. Without
        // this the big number kept the previous set's value and he would have logged the warm-up weight three
        // more times under „a terv szerint".
        .onChange(of: session.progress.done) { loadCurrent() }
        // Each step of a technique set has its own numbers: the drop's lighter weight, a mini-set's few reps.
        .onChange(of: session.technique?.legs.count) { loadCurrent() }
        .onChange(of: session.technique == nil) { loadCurrent() }
        .sheet(item: $sheet, onDismiss: sheetClosed) { sheet(for: $0) }
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

                // **The one „…" of the player**, top right, level with the minimise chevron (owner,
                // 2026-11-17). It lived beside the exercise for a round, which put it out of reach on the
                // rest screen — the exercise head is not on that screen at all. It still acts on the
                // exercise he is on, rest or no rest.
                Button { if let id = session.currentExerciseId { sheet = .exerciseMenu(id) } } label: {
                    Image(systemName: "ellipsis").nkFont(16, .semibold).foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                }
                .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                .accessibilityLabel("Mit csinálunk ezzel a gyakorlattal?")
                .disabled(session.currentExerciseId == nil)
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

            // The technique set is next: the card shows every step before he starts, the first one lit.
            if let plan = techniquePlan(e), let t = plan.technique, t != .partials {
                let card = TechniqueLines.lines(plan: plan, run: nil)
                TechniqueStepCard(technique: t, lines: card.lines, current: 0, remaining: nil, total: nil, hue: hue)
            }

            if e.planned.indices.contains(e.logged.count),
               e.planned[e.logged.count].technique == .topPause,
               let seconds = e.planned[e.logged.count].topHoldSec {
                HStack(alignment: .top, spacing: 10) {
                    PlanMark(.timer, color: hue.glow, size: 20)
                    Text("Minden ismétlés tetején tartsd meg \(seconds) másodpercig.")
                        .nkFont(15, .medium).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
                .padding(14)
                .nkGlass()
                .accessibilityLabel("Minden ismétlés tetején tartsd meg \(seconds) másodpercig.")
            }

            numberPads
            planLine(e)
            setList(e)

            primary(liftLabel(e)) { logSet() }
        }
    }

    /// The exercise: its photograph, the muscle group above its name, and the one „…" that holds everything
    /// else he can do with it.
    private func exerciseHead(_ e: SessionExercise) -> some View {
        HStack(alignment: .top, spacing: 13) {
            NKRemoteThumb(BoopConfig.mediaURL(photo(for: e)), size: 58)
            VStack(alignment: .leading, spacing: 3) {
                // The muscle group is gone from here (owner, 2026-11-17): standing in front of the machine
                // he knows what he is working, and the name is the only thing worth the top of the screen.
                Text(e.name).nkFont(26, design: .serif).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                // What is special about this exercise today, said up front (owner decision 2026-11-17 #3) — in
                // words, not bare pills, and also on a day that leaves it out (owner 2026-11-27, mezo-r36n9.195).
                if let line = TechniqueHeadline.today(technique: e.liveTechnique, challenge: e.liveChallenge,
                                                      best: e.challengeBest) {
                    TechniqueHeadlineRow(text: line, challenge: e.liveChallenge,
                                         technique: techniqueToShow(e), hue: hue)
                        .padding(.top, 3)
                }
                if let line = TechniqueHeadline.skipped(e.skippedToday, keptTechnique: e.liveTechnique) {
                    TechniqueSkippedRow(text: line, challenge: e.skippedToday?.challenge == true)
                        .padding(.top, 2)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The technique to put on the head: the exercise's own, unless the challenge already says it (the challenge's
    /// technique is always the half reps).
    private func techniqueToShow(_ e: SessionExercise) -> SetTechnique? {
        // From today's prescription, not the stored pick: with the block's switch off the server still echoes it.
        let t = e.liveTechnique
        return t == .partials && e.liveChallenge ? nil : t
    }

    /// The plan of the set he is on, when it is a technique set the player walks through.
    private func techniquePlan(_ e: SessionExercise) -> PrescribedSet? {
        let i = e.logged.count
        guard e.planned.indices.contains(i), e.planned[i].isTechnique else { return nil }
        return e.planned[i]
    }

    private func liftLabel(_ e: SessionExercise) -> String {
        if let plan = techniquePlan(e) {
            if plan.technique == .partials { return e.liveChallenge ? "Megvan · jöhet a kihívás" : "Megvan · jöhetnek a félismétlések" }
            let rest = plan.legs.first?.restBeforeSec ?? 0
            return rest > 0 ? "Megvan a főrész · jöhet a pihenő" : "Megvan a főrész · tovább"
        }
        return touched ? "Kész \(Self.article(e.logged.count + 1)) \(e.logged.count + 1). szett" : "Kész · a terv szerint"
    }

    /// The server's own demo still for the exercise. The session model keeps only what the player needs, so
    /// the picture is looked up by name — which also survives a swap, because the new row brings its own name.
    private func photo(for e: SessionExercise) -> String? { photos[e.name.lowercased()] }

    /// Weight and reps side by side, **the reserve directly under them** — the owner's own layout from round 4,
    /// with the stepper swapped for **a scale he drags with a finger** (owner, 2026-11-23: „súly és ismétlés legyen
    /// görgetős / tekerős", the weight in 0,5 kg steps). Typing stays: a tap on the number opens the keyboard.
    private var numberPads: some View {
        let plan = session.current.flatMap { $0.plan(at: $0.logged.count) }
        return VStack(spacing: 10) {
            HStack(spacing: 10) {
                NKScale(label: "Súly · kg", value: kg, step: 0.5, range: 0...300, hue: hue, tag: tag,
                        plan: plan?.targetKg, format: { $0 > 0 ? Self.plain($0) : "–" },
                        onChange: { kg = $0; touched = true },
                        onSet: { typed in if let v = Self.decimal(typed) { kg = max(0, v); touched = true } })
                NKScale(label: "Ismétlés", value: Double(reps), step: 1, range: 1...60, hue: hue, tag: tag,
                        plan: plan?.targetReps.map(Double.init), format: { "\(Int($0))" },
                        onChange: { reps = max(1, Int($0)); touched = true },
                        onSet: { typed in if let v = Int(typed.filter(\.isNumber)), v > 0 { reps = v; touched = true } })
            }
            NKInlineStepper(label: "Tartalék · ismétlés", value: rir >= 5 ? "5+" : "\(rir)", hue: hue,
                            onDown: { rir = max(0, rir - 1) },
                            onUp: { rir = min(5, rir + 1) })
        }
    }

    /// The small word beside the pad's label — where its number came from — until he changes it.
    private var tag: String? {
        guard !touched else { return nil }
        switch source {
        case .plan: return "TERV"
        case .previous: return "ELŐZŐ"
        case .none: return nil
        }
    }

    /// **The plan's own line, which stays** (owner, 2026-11-23: „nem mutatja, hogy mennyi a recommended súly").
    /// The pads start from it, but once he changed a number the plan was gone from the screen — now it is here,
    /// under them, whatever the pads say. With no weight from the server it says so instead of a dash.
    private func planLine(_ e: SessionExercise) -> some View {
        let plan = e.plan(at: e.logged.count)
        let repsText = plan?.targetReps.map { "\($0) ismétlés" }
        let rirText = plan?.targetRIR.map { "\($0) tartalék" }
        let known = plan?.targetKg.map { nkKg($0) }
        let line = [known ?? "ehhez még nincs ajánlott súly, az első alkalom után lesz", repsText, rirText]
            .compactMap { $0 }.joined(separator: " · ")
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("TERV").nkFont(9, .semibold, design: .monospaced).tracking(1.2).foregroundStyle(hue.glow)
            Text(line).nkFont(13, known == nil ? .regular : .medium)
                .foregroundStyle(.white.opacity(known == nil ? 0.6 : 0.85))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4)
        .accessibilityElement(children: .combine)
    }

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
                if let note = TechniqueLines.rowNote(plan: nil, logged: set) { techniqueNote(note, set.technique) }
            }
            ForEach(e.logged.count..<max(e.logged.count, e.setCount), id: \.self) { i in
                let plan = e.plan(at: i)
                NKSetRow(index: i + 1, kg: plan?.targetKg.map(Self.plain) ?? "–",
                         reps: plan?.targetReps.map { "\($0)" } ?? "–",
                         reserve: plan?.targetRIR.map { "\($0)" } ?? "–",
                         mark: i == e.logged.count ? .now : .planned, hue: hue)
                // The technique set is marked in the list, so he sees it coming.
                if e.planned.indices.contains(i),
                   let note = TechniqueLines.rowNote(plan: e.planned[i], logged: nil) {
                    techniqueNote(note, e.planned[i].technique)
                }
            }
        }
    }

    /// The line under a technique set's row: its mark and what it adds (planned) or what was done (logged).
    private func techniqueNote(_ text: String, _ t: SetTechnique?) -> some View {
        // The challenge's half reps wear the challenge's flag and yellow, like its pill in the head.
        let challenge = t == .partials && session.current?.liveChallenge == true
        let tint = challenge ? planWarn : hue.glow
        return HStack(spacing: 6) {
            if let t { PlanMark(challenge ? .flag : techniqueMark(t), color: tint, size: 12) }
            Text(challenge ? "kihívás · \(text)" : text).nkFont(11, .medium).foregroundStyle(tint.opacity(0.9))
                .lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 0)
        }
        .padding(.leading, 38)
        .padding(.top, -2)
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
        if let current = session.current {
            NKRestBar(remaining: remaining, total: session.restTotal ?? WorkoutSession.restSeconds, hue: hue)
                .padding(.vertical, 6)
            // **The set just done, wherever it was.** Answering the three questions moves the session to the
            // next exercise while the rest runs on, so asking the *current* exercise for its last set left
            // this screen with nothing on it — a black screen he could not get out of.
            if let done = session.lastLogged { verdictCard(done.set, exercise: done.exercise) }
            setList(current)
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

    /// Read from the rest's own end instant, not from `step`: during the three questions the step is
    /// `.debrief` while the clock is still running behind them, and asking `step` showed a frozen 0:00.
    private var remaining: TimeInterval {
        _ = now     // the view redraws every second through this
        guard let ends = session.restEndsAt else { return 0 }
        return max(0, ends.timeIntervalSince(now))
    }

    /// **The verdict of the set just done** — the reason the rest screen exists at all.
    private func verdictCard(_ set: SessionSet, exercise: SessionExercise) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // The same mark as the set table's, so the card and the row agree at a glance.
            Group {
                switch set.verdict {
                case .record: NKGlyph("medal-sun", NK.gold, size: 26)
                case .below: Image(systemName: "arrow.down.right")
                        .font(.system(size: 20, weight: .bold)).foregroundStyle(NK.under)
                default: Image(systemName: "arrow.up.right")
                        .font(.system(size: 20, weight: .bold)).foregroundStyle(NK.good)
                }
            }
            .frame(width: 26)
            VStack(alignment: .leading, spacing: 3) {
                Text(verdictEyebrow(set, exercise))
                    .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1).minimumScaleFactor(0.8)
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

    /// „3. szett · 80 × 8", and the exercise's name too when the set belongs to the one he has just finished
    /// rather than the one in front of him.
    private func verdictEyebrow(_ set: SessionSet, _ e: SessionExercise) -> String {
        let index = (e.logged.firstIndex { $0.id == set.id } ?? e.logged.count - 1) + 1
        let head = e.id == session.currentExerciseId ? "" : "\(e.name) · "
        return "\(head)\(index). szett · \(setText(set))"
    }

    private func verdictLine(_ set: SessionSet, _ e: SessionExercise) -> String {
        if set.verdict == .record, let bestKg = e.bestKg, let bestReps = e.bestReps {
            return "Az eddigi legjobb \(nkKg(bestKg)) × \(bestReps) volt."
        }
        let index = e.logged.firstIndex { $0.id == set.id } ?? max(0, e.logged.count - 1)
        guard let plan = e.plan(at: index), let target = plan.targetReps else { return "Rögzítve." }
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

    // MARK: - Inside a technique set

    /// The short rest and the next step of a technique set: the step card with the countdown in it, and — when it
    /// is time to lift — the step's own numbers.
    @ViewBuilder private var techniqueStep: some View {
        if let e = session.current, let run = session.technique, let plan = techniquePlanOfRun(e) {
            exerciseHead(e)
            let card = TechniqueLines.lines(plan: plan, run: run)
            let resting: Bool = { if case .techniqueRest = session.step { return true } else { return false } }()
            TechniqueStepCard(technique: run.technique, lines: card.lines, current: card.current,
                              remaining: resting ? techniqueRemaining : nil, total: run.restTotal, hue: hue)
            if resting {
                HStack(spacing: 10) {
                    secondary("Elég volt · befejezem") { stopSteps() }
                    Button { session.skipTechniqueRest() } label: {
                        HStack(spacing: 6) {
                            Text("Kezdem").nkFont(16, .semibold)
                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold))
                        }
                        .foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(Capsule().fill(hue.glow))
                    }
                    .buttonStyle(.plain)
                }
            } else {
                legPads(run)
                primary(legLabel(run)) { logLeg() }
                secondary("Elég volt · befejezem a sorozatot") { stopSteps() }
            }
        }
    }

    private func techniquePlanOfRun(_ e: SessionExercise) -> PrescribedSet? {
        e.planned.indices.contains(e.logged.count) ? e.planned[e.logged.count] : nil
    }

    private var techniqueRemaining: TimeInterval {
        _ = now
        guard let ends = session.technique?.restEndsAt else { return 0 }
        // `now` ticks once a second, so right after the tap it can be up to a second old: never show more than the
        // rest itself („0:21" of a 20 s rest).
        return min(session.technique?.restTotal ?? .infinity, max(0, ends.timeIntervalSince(now)))
    }

    /// The step's weight and reps. A drop says what it came off; „ugyanannyi" is prefilled with the reps he did.
    private func legPads(_ run: TechniqueRun) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 10) {
                NKScale(label: "Súly · kg", value: kg, step: 0.5, range: 0...300, hue: hue,
                        format: { $0 > 0 ? Self.plain($0) : "–" },
                        onChange: { kg = $0; touched = true },
                        onSet: { typed in if let v = Self.decimal(typed) { kg = max(0, v); touched = true } })
                NKScale(label: "Ismétlés", value: Double(reps), step: 1, range: 0...60, hue: hue,
                        format: { "\(Int($0))" },
                        onChange: { reps = max(0, Int($0)); touched = true },
                        onSet: { typed in if let v = Int(typed.filter(\.isNumber)), v >= 0 { reps = v; touched = true } })
            }
            if run.next?.kind == .drop, let main = run.main.kg {
                Text("\(run.next?.dropPercent ?? 30)%-kal kevesebb, mint \(nkKg(main))")
                    .nkFont(12, .medium).foregroundStyle(hue.glow)
            } else if run.next?.kind == .mini, let min = run.next?.minReps {
                Text("Ha \(min)-nál kevesebb jön ki, ott a vége.").nkFont(12).foregroundStyle(.white.opacity(0.55))
            }
        }
    }

    private func legLabel(_ run: TechniqueRun) -> String {
        switch run.next?.kind {
        case .mini?: return "Megvan a mini szett"
        default: return "Megvan a drop"
        }
    }

    /// The half reps — the challenge's own moment after the last full set.
    @ViewBuilder private var partialsMoment: some View {
        if let e = session.current {
            PartialsCounter(count: $partials, best: e.liveChallenge ? e.challengeBest : nil, challenge: e.liveChallenge)
            primary(partials == 0 ? "Most nem megy · kihagyom" : "Megvan: \(partials) félismétlés") {
                let before = sentIds
                let step = partials == 0 ? session.endTechnique() : session.logLeg(kg: nil, reps: partials)
                partials = 0
                sendNew(since: before)
                if step == .finish { onFinish() }
            }
        }
    }

    private func secondary(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).nkFont(15, .medium).foregroundStyle(.white.opacity(0.8))
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(Capsule().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
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
                if let line = partialsLine(e) {
                    HStack(spacing: 6) {
                        PlanMark(.flag, color: line.beaten ? NK.gold : planWarn, size: 13)
                        Text(line.text).nkFont(13, .medium).foregroundStyle(line.beaten ? NK.gold : .white.opacity(0.75))
                    }
                    .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if case .rest = session.step {} else if nextUp != nil {
                NKRestBar(remaining: remaining, total: session.restTotal ?? WorkoutSession.restSeconds, hue: hue)
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

    /// „Új csúcs: 9 félismétlés" — a beaten half-rep best is a record, so it is gold; otherwise the plain count.
    private func partialsLine(_ e: SessionExercise) -> (text: String, beaten: Bool)? {
        guard let today = e.partialsToday else { return nil }
        if e.isChallenge, let best = e.challengeBest, today > best {
            return ("Új csúcs: \(today) félismétlés · eddig \(best)", true)
        }
        if e.isChallenge, e.challengeBest == nil, today > 0 { return ("Az első csúcsod: \(today) félismétlés", true) }
        return ("\(today) félismétlés", false)
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
        if let run = session.technique, run.exerciseId == e.id, let leg = run.next {
            let d = WorkoutSession.legDefaults(leg, main: run.main, plannedKg: techniquePlanOfRun(e)?.targetKg)
            kg = d.kg ?? run.main.kg ?? 0
            reps = d.reps
            touched = false
            return
        }
        // The plan for warm-ups and the first working set, the previous working set's weight after that
        // (`WorkoutSession.prefill`, owner 2026-11-23).
        let p = WorkoutSession.prefill(for: e)
        kg = p.kg ?? 0
        reps = p.reps
        rir = p.rir
        source = p.source
        touched = false
        feedback = e.feedback ?? ExerciseFeedback()
    }

    private func logSet() {
        guard session.currentExerciseId != nil else { return }
        let before = sentIds
        let step = session.log(kg: kg > 0 ? kg : nil, reps: reps, rir: rir)
        // A technique set's main part is not a write yet — the set goes out with its steps, as one.
        sendNew(since: before)
        touched = false
        if step == .finish { onFinish() }
    }

    private func logLeg() {
        let before = sentIds
        let step = session.logLeg(kg: kg > 0 ? kg : nil, reps: reps)
        sendNew(since: before)
        touched = false
        if step == .finish { onFinish() }
    }

    /// „Elég volt": the technique's steps stop; the challenge after them, if any, still comes.
    private func stopSteps() {
        let before = sentIds
        let step = session.stopTechniqueSteps()
        sendNew(since: before)
        if step == .finish { onFinish() }
    }


    /// A technique set that was the exercise's last one ends the exercise: its three questions come before
    /// whatever he asked for.
    static func questionsFirst(_ step: WorkoutStep) -> Bool { if case .debrief = step { true } else { false } }
    static let questionsFirstLine = "A sorozat mentve — előbb a három kérdés"

    /// A correction of a logged set: applied on the phone at once, sent when the sheet closes.
    private func correct(_ setId: UUID, kg: Double?, reps: Int, rir: Int?) {
        session.edit(setId: setId, kg: kg, reps: reps, rir: rir)
        edited.insert(setId)
    }

    private func sendEdits() {
        guard !edited.isEmpty else { return }
        for e in session.all {
            for set in e.logged where edited.contains(set.id) { onEdited(e.id, set) }
        }
        edited = []
    }

    /// Every logged set's id — the player sends whatever is new after a tap, whichever way it was finished (a
    /// step, „elég volt", or a skip or switch that closes a technique set half done).
    private var sentIds: Set<UUID> { Set(session.loggedSets.map(\.id)) }

    private func sendNew(since before: Set<UUID>) {
        for e in session.all {
            for set in e.logged where !before.contains(set.id) { onLogged(e.id, set) }
        }
    }

    // MARK: - Sheets

    private enum PlayerSheet: Identifiable {
        /// The swap's flag: true = the block's remaining days too, false = today only.
        case note(UUID), swap(UUID, Bool), exerciseMenu(UUID), editSet(UUID), pick, records(UUID), technique(UUID), gym
        var id: String {
            switch self {
            case .note(let id): "note-\(id)"
            case .swap(let id, let whole): "swap-\(whole ? "block" : "today")-\(id)"
            case .exerciseMenu(let id): "menu-\(id)"
            case .editSet(let id): "set-\(id)"
            case .records(let id): "rec-\(id)"
            case .technique(let id): "tech-\(id)"
            case .pick: "pick"
            case .gym: "gym"
            }
        }
        /// The swap is a long list with cards: it opens full height, as on the approved spike.
        var isSwap: Bool { if case .swap = self { true } else { false } }
        var isGym: Bool { if case .gym = self { true } else { false } }
    }

    @ViewBuilder private func sheet(for sheet: PlayerSheet) -> some View {
        Group {
            switch sheet {
            case .note(let id): noteSheet(id)
            case .editSet(let id): editSheet(id)
            case .exerciseMenu(let id): exerciseMenuSheet(id)
            case .swap(let id, let whole): swapSheet(id, wholeBlock: whole)
            case .records(let id): recordsSheet(id)
            case .technique(let id): techniqueSheet(id)
            case .pick: pickSheet
            case .gym: gymSheet?()
            }
        }
        .presentationDetents(sheet.isSwap || sheet.isGym ? [.large] : [.medium, .large])
        .presentationBackground(NK.ground)
        .presentationCornerRadius(34)
        .presentationDragIndicator(.visible)
    }

    /// The note, with a way out (owner, 2026-11-23: „nem tűnik el a klaviatúra… és nem tudok menteni jegyzetet"):
    /// a Kész over the keyboard, a Mentés under the field, and the note goes to the server as the exercise's own
    /// when the sheet closes — however it closed. Before this it was written to the session only, and the session
    /// is thrown away with the workout.
    private func noteSheet(_ id: UUID) -> some View {
        NKSheetFrame(hue: hue, eyebrow: session.exercises[id]?.name ?? "Gyakorlat", title: "Jegyzet") {
            VStack(alignment: .leading, spacing: 14) {
                TextField("Például: a váll végig nyugton volt", text: $noteDraft, axis: .vertical)
                    .lineLimit(3...6)
                    .nkFont(15).foregroundStyle(.white)
                    .focused($noteFocused)
                    .padding(14).nkGlass()
                    .onAppear {
                        noteOpen = id
                        noteDraft = session.exercises[id]?.note ?? ""
                        noteFocused = true
                    }
                Text("A jegyzet a gyakorlatnál marad: edzés közben végig látod, és a következő alkalommal is itt lesz.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.5))
                    .fixedSize(horizontal: false, vertical: true)
                Button { sheet = nil } label: {
                    Text("Mentés").nkFont(16, .semibold).foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(Capsule().fill(hue.glow))
                }
                .buttonStyle(.plain)
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Kész") { noteFocused = false }
            }
        }
    }

    /// The sheet is gone, whichever way: corrections go out, and the note is kept and queued if it changed.
    private func sheetClosed() {
        sendEdits()
        commitNote()
    }

    private func commitNote() {
        guard let id = noteOpen else { return }
        noteOpen = nil
        noteFocused = false
        let text = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let note: String? = text.isEmpty ? nil : text
        guard note != session.exercises[id]?.note else { return }
        session.setNote(note, for: id)
        onNote(id, note)
    }

    private func editSheet(_ setId: UUID) -> some View {
        let found = session.all.compactMap { e in e.logged.first { $0.id == setId }.map { (e, $0) } }.first
        return NKSheetFrame(hue: hue, eyebrow: found?.0.name ?? "Szett", title: "Szett javítása") {
            if let (e, set) = found {
                let plan = e.plan(at: e.logged.firstIndex { $0.id == setId } ?? 0)
                VStack(spacing: 12) {
                    HStack(spacing: 10) {
                        NKScale(label: "Súly · kg", value: set.kg ?? 0, step: 0.5, range: 0...300, hue: hue,
                                plan: plan?.targetKg, format: { $0 > 0 ? Self.plain($0) : "–" },
                                onChange: { correct(setId, kg: $0 > 0 ? $0 : nil, reps: set.reps, rir: set.rir) },
                                onSet: { typed in
                                    if let v = Self.decimal(typed) {
                                        correct(setId, kg: v > 0 ? v : nil, reps: set.reps, rir: set.rir)
                                    }
                                })
                        NKScale(label: "Ismétlés", value: Double(set.reps), step: 1, range: 1...60, hue: hue,
                                plan: plan?.targetReps.map(Double.init), format: { "\(Int($0))" },
                                onChange: { correct(setId, kg: set.kg, reps: max(1, Int($0)), rir: set.rir) },
                                onSet: { typed in
                                    if let v = Int(typed.filter(\.isNumber)), v > 0 {
                                        correct(setId, kg: set.kg, reps: v, rir: set.rir)
                                    }
                                })
                    }
                    // The reserve too (owner, 2026-11-23: „RIR állítás nincs utólagos szett korrekciónál").
                    NKInlineStepper(label: "Tartalék · ismétlés",
                                    value: set.rir.map { $0 >= 5 ? "5+" : "\($0)" } ?? "–", hue: hue,
                                    onDown: { correct(setId, kg: set.kg, reps: set.reps, rir: max(0, (set.rir ?? 2) - 1)) },
                                    onUp: { correct(setId, kg: set.kg, reps: set.reps, rir: min(5, (set.rir ?? 2) + 1)) })
                    Text("A javítás azonnal érvényes, és amint van net, a szerverre is felmegy — ugyanazt a sorozatot írja át, nem vesz fel újat.")
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
                menuRow("bolt-sun", "Eligazítás — a mai edzés") { sheet = nil; onBriefing() }
                // Two swaps, said apart (owner, 2026-11-23): the old „Végleg lecserélem" was in fact today's swap,
                // and read as the opposite of what he wanted — a change for today, not just „később".
                menuRow("repeat-deep", "Ma mást csinálok helyette") { sheet = .swap(id, false) }
                menuRow("repeat-deep", "Lecserélem a mezociklusban is") { sheet = .swap(id, true) }
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
                    let before = sentIds
                    let step = session.postpone(id); sendNew(since: before); sheet = nil
                    say(Self.questionsFirst(step) ? Self.questionsFirstLine : "A gyakorlat a sor végére került")
                }
                menuRow("moon-sky", "Kihagyom ezt a gyakorlatot") {
                    let before = sentIds
                    let step = session.skip(id); sendNew(since: before); sheet = nil
                    if Self.questionsFirst(step) {
                        // The technique set was the last one: the exercise is done, not skipped.
                        say(Self.questionsFirstLine)
                        return
                    }
                    onSkipped(id)
                    say("Kihagyva — az összegzés nem büntet érte")
                    if step == .finish { onFinish() }
                }
                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.vertical, 4)
                menuRow("star-sun", left > 0 ? "Befejezem az edzést · \(left) szett hátra"
                                             : "Lezárom az edzést") {
                    // A technique set half done is still a set he did.
                    let before = sentIds
                    _ = session.endTechnique(); sendNew(since: before)
                    sheet = nil; onFinish()
                }
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
                            let before = sentIds
                            let step = session.switchTo(e.id)
                            sendNew(since: before)
                            sheet = nil
                            say(Self.questionsFirst(step) ? Self.questionsFirstLine : "\(e.name) következik")
                        } label: {
                            HStack(spacing: 11) {
                                NKRemoteThumb(BoopConfig.mediaURL(photo(for: e)), size: 42)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(SubMuscles.name(e.muscle).uppercased())
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

    /// The swap (mezo-r36n9.66): the server's reasoned suggestions over the full catalogue, and **the one write
    /// in the player that needs a connection** — the server mints the replacement row's id and every set after it
    /// is addressed by that id. The sheet itself lives in `SwapSheet.swift`.
    private func swapSheet(_ id: UUID, wholeBlock: Bool) -> some View {
        SwapSheet(exerciseId: id, outgoing: session.exercises[id], catalog: catalog,
                  today: session.all.map(\.name), hue: hue, actions: swap,
                  swapping: swapping, problem: swapProblem, wholeBlock: wholeBlock,
                  onPick: { c in pickSwap(id, c, wholeBlock: wholeBlock) },
                  openGym: {
                      if gymSheet != nil { sheet = .gym } else { sheet = nil; say(soonToast("Mi van a termemben")) }
                  })
    }

    private func pickSwap(_ id: UUID, _ c: CatalogExercise, wholeBlock: Bool) {
        guard !swapping else { return }
        swapping = true
        swapProblem = nil
        // A technique set in progress is a set he did: it goes out on the old row first.
        if session.technique?.exerciseId == id {
            let before = sentIds
            _ = session.endTechnique()
            sendNew(since: before)
        }
        Task {
            let problem = await onSwap(id, c, wholeBlock)
            swapping = false
            swapProblem = problem
            if problem == nil {
                sheet = nil
                say(wholeBlock ? "\(c.name) — lecserélve, a mezociklus végéig" : "\(c.name) — ma ezt csinálod helyette")
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
