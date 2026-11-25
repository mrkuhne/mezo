import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The closing ceremony (B5)

// The owner asked for the Lágy closing taken over almost as it is (`cer()` in the „Mezo ·
// Lágy irány" artifact), in Napkelte's clothes. What came over, and what did not:
//
//   • **One pass drives everything.** The repo's own ceremony pattern
//     (`docs/design_2.0/2026-09-15-ceremony-pattern.md`): a single progress value, cubic
//     ease-out, 2400 ms for a training ceremony — the orb rises, the counters count up and
//     the sections arrive off that one number, never off separate timers that drift apart.
//     Reduce Motion paints the finished state at once: no pass, no pops.
//   • **The counters count up from zero** — the Lágy ceremony's own move, and the reason the
//     screen feels like an ending rather than a receipt.
//   • **Records are gold**, and gold is used for nothing else.
//   • **The verdict never shames** (the pattern's copy rule): the ladder celebrates or stays
//     constructive, down to „Rögzítve — minden adat segít."
//
// What was deliberately left out of the Lágy version: the **five stars and the score**, the
// **points** and the **quests**. Boop hides gamification by the standalone decision
// (2026-11-11) — a workout is not graded out of five here. The verdict sentence and the orb
// carry the same meaning without scoring him.

struct WorkoutCeremony: View {
    let session: WorkoutSession
    let hue: Hue
    /// What the workout burned, from the server (mezo-r36n9.170): its estimate first, the watch's figure once the
    /// watch's workout has synced. `nil` until it arrives — offline, or no body data yet — and then the line is
    /// simply not there; nothing is guessed on the phone.
    var energy: WorkoutEnergy? = nil
    let onDone: () -> Void
    let onNote: () -> Void
    /// Looking at the day's result again, after the fact (mezo-r36n9.147): the numbers are the same, the clock is
    /// the one that stopped when he finished, and the note row is gone — the note's moment was the ceremony.
    var finishedAt: Date? = nil
    private var review: Bool { finishedAt != nil }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    /// The one pass. Everything on the screen is a function of this number.
    private static let pass: TimeInterval = 2.4

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { timeline in
            let p = progress(at: timeline.date)
            ZStack(alignment: .top) {
                // The sunrise is the celebration — but only behind the head. Below it the page
                // is the dark ground, or the numbers and the body wash out on the bright band.
                NK.ground.ignoresSafeArea()
                NKPhotoSky(hue: hue, photo: nil)
                    .frame(height: 430)
                    .mask(LinearGradient(stops: [.init(color: .black, location: 0.55),
                                                 .init(color: .clear, location: 1)],
                                         startPoint: .top, endPoint: .bottom))
                    .ignoresSafeArea(edges: .top)
                ScrollView {
                    VStack(spacing: 26) {
                        head(p)
                        VStack(spacing: 10) {
                            counters(p)
                            if let energy { energyLine(energy, p: p).transition(.opacity) }
                        }
                        .animation(reduceMotion ? nil : .easeOut(duration: 0.6), value: energy)
                        if !records.isEmpty { recordSection(p) }
                        // Nothing logged, nothing worked: an empty body would be a picture of
                        // a workout that did not happen.
                        if !heat.isEmpty { bodySection(p) }
                        if !review { noteRow(p) }
                        doneButton(p)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 26)
                    .padding(.bottom, 44)
                }
                .scrollIndicators(.hidden)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { start = Date() }
    }

    /// Cubic ease-out over the pass; 1 at once when he has asked for less motion.
    private func progress(at date: Date) -> Double {
        if reduceMotion { return 1 }
        let t = min(1, max(0, date.timeIntervalSince(start) / Self.pass))
        return 1 - pow(1 - t, 3)
    }

    // MARK: - The head: the orb rises, then the verdict

    private func head(_ p: Double) -> some View {
        VStack(spacing: 18) {
            StillOrb(palette: hue.orb, size: 132, level: min(1, completion * p))
                .opacity(0.35 + 0.65 * p)
                .offset(y: (1 - p) * 26)
            VStack(spacing: 8) {
                Text(eyebrow.uppercased())
                    .nkFont(10, .medium, design: .monospaced).tracking(1.6)
                    .foregroundStyle(.white.opacity(0.55))
                Text(verdict)
                    .nkFont(34, design: .serif).foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Text(subtitle)
                    .nkFont(15).foregroundStyle(.white.opacity(0.72))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .opacity(reveal(p, from: 0.15))
            .offset(y: (1 - reveal(p, from: 0.15)) * 10)
        }
        .frame(maxWidth: .infinity)
    }

    /// A section arrives once the pass is past `from` — the staggered rise of the Lágy
    /// ceremony, driven off the same single number.
    private func reveal(_ p: Double, from: Double) -> Double {
        min(1, max(0, (p - from) / 0.35))
    }

    // MARK: - The three numbers, counting up

    private func counters(_ p: Double) -> some View {
        HStack(spacing: 0) {
            counter(Int(Double(totals.sets) * p), "szett", p: p)
            divider
            counter(Int(Double(totals.reps) * p), "ismétlés", p: p)
            divider
            counter(Int(Double(totals.volume) * p), "kg megmozgatva", p: p)
        }
        .padding(.vertical, 18)
        .nkGlass()
        .opacity(reveal(p, from: 0.1))
    }

    /// The kcal, under the three numbers (owner, 2026-11-25: „írjuk ki edzés végén kcal"). It says plainly whether it
    /// is the estimate or the watch's own measurement — the estimate is replaced once the watch's workout syncs.
    private func energyLine(_ e: WorkoutEnergy, p: Double) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(e.source == .estimate ? "kb. \(Int(Double(e.kcal) * p))" : "\(Int(Double(e.kcal) * p))")
                    .nkFont(24, .medium).foregroundStyle(hue.glow)
                    .contentTransition(.numericText())
                Text("kcal").nkFont(13).foregroundStyle(.white.opacity(0.7))
            }
            Spacer(minLength: 8)
            Text(e.source == .estimate ? "becslés · az órád pontosítja" : "az órád mérte")
                .nkFont(12).foregroundStyle(.white.opacity(0.55))
                .multilineTextAlignment(.trailing)
                .lineLimit(2).minimumScaleFactor(0.85)
        }
        .padding(.horizontal, 18).padding(.vertical, 14)
        .nkGlass()
        .opacity(reveal(p, from: 0.1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(e.source == .estimate
                            ? "Körülbelül \(e.kcal) kilokalória, becslés"
                            : "\(e.kcal) kilokalória, az órád mérte")
    }

    private var divider: some View {
        Rectangle().fill(.white.opacity(0.1)).frame(width: 0.5, height: 44)
    }

    private func counter(_ value: Int, _ label: String, p: Double) -> some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .nkFont(30, .medium).foregroundStyle(hue.glow)
                .contentTransition(.numericText())
                .lineLimit(1).minimumScaleFactor(0.6)
            Text(label).nkFont(11).foregroundStyle(.white.opacity(0.55))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - What is his from now on

    private func recordSection(_ p: Double) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("EZ A TIÉD MOSTANTÓL", trailing: "\(records.count) új rekord")
            VStack(spacing: 0) {
                ForEach(Array(records.enumerated()), id: \.offset) { i, record in
                    if i > 0 { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5) }
                    HStack(spacing: 12) {
                        NKGlyph("medal-sun", Color(hex: 0xF2C94C), size: 20)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(record.name).nkFont(15, .medium).foregroundStyle(.white)
                            if let before = record.before {
                                Text("előtte \(before)").nkFont(12, design: .monospaced)
                                    .foregroundStyle(.white.opacity(0.45))
                            }
                        }
                        Spacer(minLength: 0)
                        Text(record.value).nkFont(16, .medium).foregroundStyle(Color(hex: 0xF2C94C))
                    }
                    .padding(.vertical, 12)
                }
            }
            .padding(.horizontal, 15)
            .nkGlass()
        }
        .opacity(reveal(p, from: 0.35))
        .offset(y: (1 - reveal(p, from: 0.35)) * 12)
    }

    // MARK: - What he worked

    private func bodySection(_ p: Double) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("AMIT MA MEGDOLGOZTATTÁL", trailing: nil)
            HStack(alignment: .top, spacing: 16) {
                NKBodyMap(heat, hue: hue).frame(maxHeight: 176)
                VStack(spacing: 10) {
                    ForEach(muscleRows, id: \.muscle) { row in
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(muscleName(row.muscle).capitalizedFirst)
                                    .nkFont(13).foregroundStyle(.white.opacity(0.85))
                                NKLevelBar(level: row.level, hue: hue)
                            }
                            Text("\(row.sets)").nkFont(15, .medium, design: .monospaced)
                                .foregroundStyle(.white.opacity(0.7))
                                .frame(width: 22, alignment: .trailing)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .opacity(reveal(p, from: 0.5))
        .offset(y: (1 - reveal(p, from: 0.5)) * 12)
    }

    private func sectionTitle(_ title: String, trailing: String?) -> some View {
        HStack(spacing: 8) {
            Rectangle().fill(hue.glow).frame(width: 3, height: 13).clipShape(Capsule())
            Text(title).nkFont(10, .medium, design: .monospaced).tracking(1.6)
                .foregroundStyle(.white.opacity(0.6))
            Spacer(minLength: 0)
            if let trailing {
                Text(trailing).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
            }
        }
    }

    // MARK: - The last two rows

    private func noteRow(_ p: Double) -> some View {
        Button(action: onNote) {
            HStack(spacing: 11) {
                NKGlyph("book-sage", .white.opacity(0.7), size: 16)
                Text("Hogy ment? Írd ide, ha van mit.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.7))
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.35))
            }
            .padding(14)
            .nkGlass()
        }
        .buttonStyle(.plain)
        .opacity(reveal(p, from: 0.6))
    }

    private func doneButton(_ p: Double) -> some View {
        Button(action: onDone) {
            Text(review ? "Vissza" : "Vissza a mai napra")
                .nkFont(17, .semibold).foregroundStyle(NK.ground)
                .frame(maxWidth: .infinity, minHeight: 58)
                .background(Capsule().fill(hue.glow))
        }
        .buttonStyle(.plain)
        .opacity(reveal(p, from: 0.65))
    }

    // MARK: - What the numbers are

    private var done: [SessionExercise] { session.all.filter { !$0.skipped } }

    private var totals: (sets: Int, reps: Int, volume: Int) {
        let sets = session.loggedSets
        return (sets.count,
                sets.reduce(0) { $0 + $1.reps },
                Int(sets.reduce(0.0) { $0 + ($1.kg ?? 0) * Double($1.reps) }.rounded()))
    }

    /// How much of the plan he actually did — what the orb fills to.
    private var completion: Double {
        let p = session.progress
        guard p.total > 0 else { return 0.12 }
        return max(0.12, min(1, Double(p.done) / Double(p.total)))
    }

    /// The ladder. It celebrates or stays constructive — it never shames, which the ceremony
    /// pattern makes a rule and the repo's own tests enforce elsewhere.
    private var verdict: String {
        let p = session.progress
        if p.done == 0 { return "Rögzítve." }
        if !records.isEmpty && p.done >= p.total { return "Erős nap." }
        if p.done >= p.total { return "Megvolt, hiánytalanul." }
        if Double(p.done) / Double(max(1, p.total)) >= 0.7 { return "Jó munka volt." }
        return "Ez is számít."
    }

    private var eyebrow: String {
        let end = finishedAt ?? Date()
        let minutes = max(1, Int(end.timeIntervalSince(session.startedAt) / 60))
        return review ? "A mai edzésed · \(minutes) perc" : "Edzés lezárva · \(minutes) perc"
    }

    private var subtitle: String {
        let p = session.progress
        let sets = p.done >= p.total
            ? "Mind a \(p.total) szett megvan"
            : "\(p.done) szett a \(p.total)-ból"
        return records.isEmpty ? "\(sets)." : "\(sets), és \(records.count) új rekord."
    }

    /// A record is a set that beat his own best — not a badge the app hands out.
    private var records: [(name: String, value: String, before: String?)] {
        done.flatMap { e in
            e.logged.filter { $0.verdict == .record }.map { set in
                (name: e.name,
                 value: [set.kg.map { nkKg($0) }, "\(set.reps)"].compactMap { $0 }.joined(separator: " × "),
                 before: e.bestKg.map { "\(nkKg($0)) × \(e.bestReps ?? 0)" })
            }
        }
    }

    private var muscleSets: [String: Int] {
        var out: [String: Int] = [:]
        for e in done { out[e.muscle, default: 0] += e.logged.count }
        return out.filter { $0.value > 0 }
    }

    private var heat: [NKBodyHeat] {
        guard let top = muscleSets.values.max(), top > 0 else { return [] }
        return muscleSets.map { NKBodyHeat(muscle: $0.key, level: Double($0.value) / Double(top)) }
    }

    private var muscleRows: [(muscle: String, sets: Int, level: Double)] {
        guard let top = muscleSets.values.max(), top > 0 else { return [] }
        return muscleSets.sorted { ($0.value, $1.key) > ($1.value, $0.key) }
            .prefix(5)
            .map { (muscle: $0.key, sets: $0.value, level: Double($0.value) / Double(top)) }
    }
}
