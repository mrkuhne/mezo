import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Eligazítás — the screen before the first set (B5, owner round 4)

// The owner asked for the Lágy briefing by name on 2026-11-17 („hiányzik az indítás előtti rész"), and named
// what he liked about it: the big title, the time estimate, the mission carousel with the exercise photographs,
// and the day's line-up under it — „csak a mi színvilágunkban".
//
// So this is that screen in Napkelte: the player's own dark ground with one vivid accent, not the bright sunrise
// (the same reasoning as the player — a gym at 7 p.m. is not a sunrise), gold kept for records alone, and every
// number from the server. Two things the Lágy version had are deliberately missing because nothing real stands
// behind them: the per-mission **confidence percentage** (the engine computes nothing of the sort) and the
// „3 küldetés" scoring language of the web app's quests. A mission here is a step the engine actually took.
//
// It is a full-screen cover at page level, outside the area-page system, like the player it leads into.

struct WorkoutBriefing: View {
    let workout: TodayWorkout
    let missions: [TrainMission]
    let hue: Hue
    let dayLine: String?
    /// The missions he has let go of. Owned by the room, so the choice survives this screen closing.
    @Binding var released: Set<UUID>
    /// True when the workout is already running and he is only looking at the day again: the button then
    /// takes him back to the player instead of starting anything, and the missions are already decided.
    var running: Bool = false
    let onClose: () -> Void
    let onStart: () -> Void

    @State private var why: TrainMission?

    private var taken: [TrainMission] { missions.filter { !released.contains($0.exerciseId) } }

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            RadialGradient(colors: [hue.glow.opacity(0.22), .clear], center: .top, startRadius: 0, endRadius: 420)
                .ignoresSafeArea()
            VStack(spacing: 0) {
                header
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // **The hero** (spec §5.5): the day's title and its three numbers, one card drawn behind them
                        // with the page's own 20 spacing inside — the start button stays exactly where it was.
                        VStack(alignment: .leading, spacing: 20) {
                            title
                            if let minutes = workout.durationEst { NKTimeRange(minutes: minutes, hue: hue, inner: true) }
                            numbers
                        }
                        .workoutCard(.hero, v: 10, hue: hue)
                        if let warning { warningCard(warning) }
                        if !missions.isEmpty { missionSection }
                        lineUp
                        if let sentence { boopCard(sentence) }
                        startButton
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 10)
                    .padding(.bottom, 44)
                }
                .scrollIndicators(.hidden)
            }
        }
        .preferredColorScheme(.dark)
        .sheet(item: $why) { mission in
            NKSheetFrame(hue: hue, eyebrow: mission.exerciseName, title: mission.kind.hungarian) {
                VStack(alignment: .leading, spacing: 14) {
                    Text(mission.why).nkFont(15).foregroundStyle(.white.opacity(0.85)).lineSpacing(3)
                    Text("Ezt a mondatot az edzésmotor írta, nem Boop fogalmazta újra.")
                        .nkFont(12).foregroundStyle(.white.opacity(0.45))
                }
                .workoutCard(h: 8, v: 8)
            }
            .presentationDetents([.medium])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: Head

    private var header: some View {
        HStack(spacing: 12) {
            Button(action: onClose) {
                Image(systemName: "chevron.down").nkFont(16, .semibold).foregroundStyle(.white)
                    .frame(width: 42, height: 42)
            }
            .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
            .accessibilityLabel("Vissza")
            .frameProbe("brief.close")
            VStack(spacing: 1) {
                Text("Eligazítás").nkFont(15, .medium).foregroundStyle(.white)
                if let dayLine {
                    Text(dayLine).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)
            Color.clear.frame(width: 42, height: 42)
        }
        .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 6)
    }

    /// „Pull Day." — the day's own name, big, with the full stop in the hue. The title is the server's.
    private var title: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text(workout.title ?? "A mai edzés")
                    .nkFont(40, design: .serif).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                Text(".").nkFont(40, design: .serif).foregroundStyle(hue.glow)
            }
            Text(lede).nkFont(15).foregroundStyle(.white.opacity(0.72)).lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 6)
    }

    /// „5 gyakorlat, 16 éles sorozat. Hát, bicepsz." — counted from the plan, never rounded up.
    private var lede: String {
        var parts: [String] = []
        let sets = workingSets
        parts.append("\(workout.exercises.count) gyakorlat\(sets > 0 ? ", \(sets) éles sorozat" : "")")
        let muscles = orderedMuscles.prefix(3).map { $0.capitalizedFirst }
        var line = parts.joined() + "."
        if !muscles.isEmpty { line += " " + muscles.joined(separator: ", ") + "." }
        return line
    }

    private var workingSets: Int {
        workout.exercises.reduce(0) { sum, e in
            let w = e.sets.filter { $0.kind == .working }.count
            return sum + (w > 0 ? w : e.workingCount)
        }
    }

    /// The muscles today loads, hardest first, grouped by **the name he reads** — the catalog splits a muscle
    /// into parts (`back-wide`, `back-mid`), and „Hát, Hát, Bicepsz" is how that looked on screen.
    private var orderedMuscles: [String] {
        var sets: [String: Int] = [:]
        for e in workout.exercises {
            let w = e.sets.filter { $0.kind == .working }.count
            sets[muscleName(e.muscle), default: 0] += w > 0 ? w : e.workingCount
        }
        return sets.sorted { ($0.value, $1.key) > ($1.value, $0.key) }.map(\.key)
    }

    private var numbers: some View {
        NKStatRow([
            NKStat(value: "\(workout.exercises.count)", label: "gyakorlat", hot: true),
            NKStat(value: workingSets > 0 ? "\(workingSets)" : nil, label: "éles sorozat"),
            NKStat(value: missions.isEmpty ? nil : "\(taken.count)", label: "küldetés"),
        ], hue: hue)
    }

    // MARK: Watch out

    /// The one thing worth a warning today: a kímélő-mód comeback, or an exercise the server marked.
    private var warning: (title: String, line: String)? {
        if let c = workout.comeback {
            return ("Kímélő mód · \(c.index) / \(c.total)",
                    "Visszatérés után vagy: a mai terhelés szándékosan könnyebb. Ha jól megy, a következő alkalom már többet kér.")
        }
        if let e = workout.exercises.first(where: { ($0.warning ?? "").isEmpty == false }) {
            return (e.name, e.warning ?? "")
        }
        return nil
    }

    private func warningCard(_ w: (title: String, line: String)) -> some View {
        HStack(alignment: .top, spacing: 11) {
            NKGlyph("bolt-peach", Color(hex: 0xE8A07A), size: 19)
            VStack(alignment: .leading, spacing: 3) {
                Text(w.title).nkFont(15, .medium).foregroundStyle(.white)
                Text(w.line).nkFont(13).foregroundStyle(.white.opacity(0.72))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .workoutCard(v: 0)
        .accessibilityElement(children: .combine)
    }

    // MARK: Missions

    private var missionSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Mit vállalsz ma?").nkFont(21, design: .serif).foregroundStyle(.white)
                Spacer(minLength: 8)
                Text("passzolni ér").nkFont(12).foregroundStyle(.white.opacity(0.45))
            }
            NKCarousel(missions, hue: hue, height: 276, widthFraction: 0.74) { m in
                NKMissionCard(kicker: m.kind.hungarian, glyph: m.kind.glyph, exercise: m.exerciseName,
                              target: targetText(m), from: fromText(m),
                              taken: !released.contains(m.exerciseId), hue: hue,
                              photo: { NKRemoteBanner(BoopConfig.mediaURL(m.photo), hue: hue, height: 118) },
                              onWhy: { why = m },
                              onToggle: {
                                  guard !running else { return }
                                  if released.contains(m.exerciseId) { released.remove(m.exerciseId) }
                                  else { released.insert(m.exerciseId) }
                              })
            }
            .frameProbe("brief.carousel")
            Text(running ? "Az edzés már fut, ezek a döntések megvannak — a súlyokat a lejátszóban írod át."
                         : "Amit elengedsz, a múlt heti számaival megy — a gyakorlat marad.")
                .nkFont(12).foregroundStyle(.white.opacity(0.45))
        }
    }

    private func targetText(_ m: TrainMission) -> String {
        [m.targetKg.map { nkKg($0) }, m.targetReps.map { "\($0)" }]
            .compactMap { $0 }.joined(separator: " × ")
    }

    private func fromText(_ m: TrainMission) -> String? {
        guard let kg = m.fromKg, let reps = m.fromReps else { return nil }
        return "múlt héten \(nkKg(kg)) × \(reps)"
    }

    // MARK: The line-up

    private var lineUp: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("A mai sor").nkFont(21, design: .serif).foregroundStyle(.white)
                Spacer(minLength: 8)
                if workingSets > 0 {
                    Text("\(workingSets) sorozat").nkFont(12, design: .monospaced)
                        .foregroundStyle(.white.opacity(0.45))
                }
            }
            VStack(spacing: 8) {
                ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { i, e in
                    lineUpRow(i + 1, e)
                }
            }
        }
        .workoutCard(v: 10)
    }

    private func lineUpRow(_ number: Int, _ e: PlannedExercise) -> some View {
        HStack(spacing: 12) {
            Text(String(format: "%02d", number))
                .nkFont(13, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.35))
            NKRemoteThumb(BoopConfig.mediaURL(e.imageStartURL), size: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(SubMuscles.name(e.muscle).uppercased())
                    .nkFont(9, .medium, design: .monospaced).tracking(1.1)
                    .foregroundStyle(hue.glow.opacity(0.85))
                Text(e.name).nkFont(15).foregroundStyle(.white).lineLimit(2)
            }
            Spacer(minLength: 0)
            if missions.contains(where: { $0.exerciseId == e.id && !released.contains($0.exerciseId) }) {
                NKGlyph("star-sun", NK.gold, size: 15)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
        .accessibilityElement(children: .combine)
    }

    // MARK: Boop

    /// Boop's one line before the first set — **the engine's own sentence about the first mission**, not a new
    /// one written here. With no mission at all there is nothing to say and the card does not appear.
    private var sentence: String? {
        taken.first?.why ?? workout.exercises.compactMap { $0.rationale }.first
    }

    private func boopCard(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 11) {
            NKGlyph("spark-sage", .white.opacity(0.8), size: 18)
            VStack(alignment: .leading, spacing: 3) {
                Text("Boop").nkFont(12, .semibold, design: .monospaced).tracking(0.8)
                    .foregroundStyle(.white.opacity(0.55))
                Text(text).nkFont(14).foregroundStyle(.white.opacity(0.85)).lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .workoutCard(.quiet, v: 0)
        .accessibilityElement(children: .combine)
    }

    private var startButton: some View {
        Button(action: onStart) {
            HStack(spacing: 9) {
                NKGlyph("bolt-ink", NK.ground, size: 17)
                Text(startLabel).nkFont(17, .semibold).foregroundStyle(NK.ground)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(Capsule().fill(hue.glow))
        }
        .buttonStyle(.plain)
        .padding(.top, 4)
        .frameProbe("brief.start")
    }

    private var startLabel: String {
        if running { return "Vissza az edzéshez" }
        guard !missions.isEmpty else { return "Indulás" }
        return taken.isEmpty ? "Indulás küldetés nélkül" : "Indulás · \(taken.count) küldetéssel"
    }
}
