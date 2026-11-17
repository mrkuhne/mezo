#if DEBUG
import SwiftUI
import BoopCore

// THROWAWAY SIMULATOR DEMO (owner request, 2026-11-17) — the block builder and the weekly review.
// Nothing here ships: made-up data, no network, rules written inline so the owner can react to them.
// Launch: `-previewBlokk YES` (+ `-previewBlokkOpen epito|het`).

struct DemoExercise: Identifiable, Equatable {
    let id: String
    let name: String
    /// Coarse group key (`back`, `biceps`, …); `core` and `-` carry no band.
    let muscle: String
    var sets: Int
    /// Plyo, mobility and forearm work is listed but never counted.
    var counts: Bool = true
}

struct DemoDay: Identifiable, Equatable {
    let id: String
    let name: String
    let title: String
    let note: String?
    var exercises: [DemoExercise]
}

/// The range one tier asks of one muscle, in weekly direct sets.
struct DemoBand: Equatable {
    let low: Int
    let high: Int
    /// The muscle's own ceiling — only used to scale the picture.
    let limit: Int
    /// Lowered because the sport already loads it.
    let sport: Bool
}

enum DemoFit: Equatable {
    case below(Int), inside, above(Int)
}

/// One proposed edit: this exercise on this day gets `delta` sets.
struct DemoEdit: Equatable {
    let day: Int
    let exercise: Int
    let delta: Int
}

/// One line of the weekly review.
struct DemoChange: Identifiable, Equatable {
    enum Kind: Equatable {
        case sets(from: Int, to: Int)
        case weight(from: Double, to: Double)
        case reps(from: Int, to: Int)
    }
    let id: String
    let day: Int
    let exercise: String
    let muscle: String
    let kind: Kind
    /// The reasons as short labels — the owner found the running text under each exercise a blur.
    let tags: [String]
    /// nil until he has said yes or no to this one line.
    var decided: Bool? = nil
    var accepted: Bool { decided ?? true }
}

@MainActor @Observable
final class BlokkDemoModel {
    static let muscles = ["back", "biceps", "shoulder", "chest", "triceps", "quad", "ham", "glute"]
    /// The lowest useful level · the middle · the body's limit, in weekly direct sets.
    static let landmarks: [String: (Int, Int, Int)] = [
        "back": (10, 16, 22), "biceps": (6, 10, 14), "shoulder": (8, 12, 18), "chest": (8, 14, 20),
        "triceps": (6, 10, 14), "quad": (8, 12, 18), "ham": (6, 10, 14), "glute": (8, 12, 18),
    ]
    static let legs: Set<String> = ["quad", "ham", "glute"]
    /// More than this for one muscle in one session stops adding anything.
    static let sessionCap = 8
    static let exerciseCap = 5

    var tiers: [String: MuscleTier] = [
        "back": .emphasize, "biceps": .emphasize, "shoulder": .maintain, "chest": .maintain,
        "triceps": .maintain, "quad": .maintain, "ham": .maintain, "glute": .maintain,
    ]
    var volleyball = true
    var days: [DemoDay] = [
        DemoDay(id: "h", name: "Hétfő", title: "Hát és bicepsz", note: "este röplabda", exercises: [
            DemoExercise(id: "h1", name: "Chest Supported Row", muscle: "back", sets: 4),
            DemoExercise(id: "h2", name: "Lat Pulldown · Neutral", muscle: "back", sets: 2),
            DemoExercise(id: "h3", name: "Preacher Curl", muscle: "biceps", sets: 3),
            DemoExercise(id: "h4", name: "Hammer Curl", muscle: "biceps", sets: 3),
            DemoExercise(id: "h5", name: "Cable Lateral Raise", muscle: "shoulder", sets: 2),
            DemoExercise(id: "h6", name: "Pallof Press", muscle: "core", sets: 2),
        ]),
        DemoDay(id: "k", name: "Kedd", title: "Láb és kar", note: nil, exercises: [
            DemoExercise(id: "k1", name: "Leg Press", muscle: "quad", sets: 3),
            DemoExercise(id: "k2", name: "Seated Leg Curl", muscle: "ham", sets: 2),
            DemoExercise(id: "k3", name: "Hip Thrust", muscle: "glute", sets: 2),
            DemoExercise(id: "k4", name: "Cable Lateral Raise", muscle: "shoulder", sets: 2),
            DemoExercise(id: "k5", name: "Tricep Pushdown", muscle: "triceps", sets: 2),
            DemoExercise(id: "k6", name: "Dead Bug", muscle: "core", sets: 2),
        ]),
        DemoDay(id: "s", name: "Szerda", title: "Ugrás és stabilitás", note: "este röplabda", exercises: [
            DemoExercise(id: "s1", name: "Side Plank", muscle: "core", sets: 2),
            DemoExercise(id: "s2", name: "Pogo Hops", muscle: "-", sets: 2, counts: false),
            DemoExercise(id: "s3", name: "Approach Jump", muscle: "-", sets: 2, counts: false),
        ]),
        DemoDay(id: "c", name: "Csütörtök", title: "Bicepsz és hát", note: nil, exercises: [
            DemoExercise(id: "c1", name: "One-Arm Cable Row", muscle: "back", sets: 3),
            DemoExercise(id: "c2", name: "Chest Supported Row", muscle: "back", sets: 2),
            DemoExercise(id: "c3", name: "Incline DB Curl", muscle: "biceps", sets: 3),
            DemoExercise(id: "c4", name: "Hammer Curl", muscle: "biceps", sets: 2),
            DemoExercise(id: "c5", name: "Machine Chest Press", muscle: "chest", sets: 2),
            DemoExercise(id: "c6", name: "Cable Crunch", muscle: "core", sets: 2),
        ]),
        DemoDay(id: "p", name: "Péntek", title: "Könnyű kar és futás", note: "este röplabda · szombaton verseny", exercises: [
            DemoExercise(id: "p1", name: "Cable Overhead Extension", muscle: "triceps", sets: 2),
            DemoExercise(id: "p2", name: "Bird Dog", muscle: "core", sets: 2),
        ]),
    ]

    // MARK: the weekly review (week 3)

    var changes: [DemoChange] = [
        DemoChange(id: "a", day: 0, exercise: "Lat Pulldown · Neutral", muscle: "back", kind: .sets(from: 2, to: 3),
                   tags: ["minden sorozat megvolt", "könnyen ment", "fogyás alatt csak +1"]),
        DemoChange(id: "b", day: 0, exercise: "Chest Supported Row", muscle: "back", kind: .weight(from: 62.5, to: 65),
                   tags: ["4 × 10 ismétlés megvolt", "2 maradt tartalékban"]),
        DemoChange(id: "f", day: 3, exercise: "One-Arm Cable Row", muscle: "back", kind: .weight(from: 27.5, to: 30),
                   tags: ["3 sorozat a tartomány tetején", "következő tárcsa 30 kg"]),
        DemoChange(id: "e", day: 3, exercise: "Incline DB Curl", muscle: "biceps", kind: .sets(from: 3, to: 4),
                   tags: ["a sávban van hely", "az izomláz másnapra elmúlt"]),
        DemoChange(id: "c", day: 1, exercise: "Leg Press", muscle: "quad", kind: .reps(from: 10, to: 11),
                   tags: ["a súly marad", "Tartás: a sorozat nem nő"]),
        DemoChange(id: "d", day: 1, exercise: "Tricep Pushdown", muscle: "triceps", kind: .reps(from: 13, to: 12),
                   tags: ["kétszer az utolsó ismétlésig", "a súly marad"]),
    ]
    var weekAccepted = false

    // MARK: rules

    func weekly(_ muscle: String) -> Int {
        days.flatMap(\.exercises).filter { $0.counts && $0.muscle == muscle }.map(\.sets).reduce(0, +)
    }

    func total() -> Int { days.flatMap(\.exercises).filter(\.counts).map(\.sets).reduce(0, +) }

    func band(_ muscle: String) -> DemoBand? {
        guard let (mev, mav, mrv) = Self.landmarks[muscle] else { return nil }
        var low: Int, high: Int
        switch tiers[muscle] ?? .grow {
        case .maintain: low = Int((Double(mev) / 3).rounded(.up)); high = mev - 1
        case .grow: low = mev; high = mav
        case .emphasize: low = mav - 2; high = mrv
        }
        let sport = volleyball && Self.legs.contains(muscle)
        if sport { low = max(1, low - 1); high = max(low + 1, high - 2) }
        return DemoBand(low: low, high: high, limit: mrv, sport: sport)
    }

    func fit(_ muscle: String) -> DemoFit {
        guard let band = band(muscle) else { return .inside }
        let sets = weekly(muscle)
        if sets < band.low { return .below(band.low - sets) }
        if sets > band.high { return .above(sets - band.high) }
        return .inside
    }

    var outside: [String] { Self.muscles.filter { fit($0) != .inside } }

    func daySets(_ day: Int, muscle: String) -> Int {
        days[day].exercises.filter { $0.counts && $0.muscle == muscle }.map(\.sets).reduce(0, +)
    }

    /// The muscles that get more than a session's worth on one day.
    func overCap(_ day: Int) -> [(String, Int)] {
        Self.muscles.compactMap { m in
            let sets = daySets(day, muscle: m)
            return sets > Self.sessionCap ? (m, sets) : nil
        }
    }

    func minutes(_ day: Int) -> Int {
        let sets = days[day].exercises.map(\.sets).reduce(0, +)
        return Int((Double(sets) * 2.4 + 6).rounded())
    }

    /// Bring one muscle into its band: one set at a time, to the exercise with the fewest (or, going down, the
    /// most) sets — never past five sets an exercise or eight a session for the muscle.
    func proposal(_ muscle: String) -> [DemoEdit] {
        guard let band = band(muscle) else { return [] }
        var sets: [[Int]] = days.map { $0.exercises.map(\.sets) }
        var edits: [String: Int] = [:]
        func slots() -> [(Int, Int)] {
            days.indices.flatMap { d in
                days[d].exercises.indices.filter { days[d].exercises[$0].counts && days[d].exercises[$0].muscle == muscle }.map { (d, $0) }
            }
        }
        func week() -> Int { slots().map { sets[$0.0][$0.1] }.reduce(0, +) }
        func dayTotal(_ d: Int) -> Int { slots().filter { $0.0 == d }.map { sets[$0.0][$0.1] }.reduce(0, +) }
        var guardRail = 0
        while week() < band.low, guardRail < 30 {
            guardRail += 1
            let open = slots().filter { sets[$0.0][$0.1] < Self.exerciseCap && dayTotal($0.0) < Self.sessionCap }
            guard let pick = open.min(by: { (sets[$0.0][$0.1], dayTotal($0.0)) < (sets[$1.0][$1.1], dayTotal($1.0)) }) else { break }
            sets[pick.0][pick.1] += 1
            edits["\(pick.0)-\(pick.1)", default: 0] += 1
        }
        while week() > band.high, guardRail < 60 {
            guardRail += 1
            let open = slots().filter { sets[$0.0][$0.1] > 1 }
            guard let pick = open.max(by: { sets[$0.0][$0.1] < sets[$1.0][$1.1] }) else { break }
            sets[pick.0][pick.1] -= 1
            edits["\(pick.0)-\(pick.1)", default: 0] -= 1
        }
        return edits.keys.sorted().compactMap { key in
            let parts = key.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 2, let delta = edits[key], delta != 0 else { return nil }
            return DemoEdit(day: parts[0], exercise: parts[1], delta: delta)
        }
    }

    func proposalText(_ muscle: String) -> String {
        let edits = proposal(muscle)
        guard !edits.isEmpty else { return "Ehhez új gyakorlat kell: a meglévők már tele vannak." }
        return edits.map { e in
            let ex = days[e.day].exercises[e.exercise]
            return "\(e.delta > 0 ? "+" : "−")\(abs(e.delta)) \(ex.name) (\(days[e.day].name.lowercased()))"
        }.joined(separator: " · ")
    }

    func apply(_ muscle: String) {
        for e in proposal(muscle) { days[e.day].exercises[e.exercise].sets += e.delta }
    }

    func applyAll() { for m in outside { apply(m) } }

    func step(day: Int, exercise: Int, by delta: Int) {
        let next = days[day].exercises[exercise].sets + delta
        days[day].exercises[exercise].sets = min(8, max(1, next))
    }


    // MARK: the whole block (six weeks)

    static let phases = ["Alap", "Építés", "Építés", "Építés", "Csúcs", "Pihenő"]

    /// One muscle across the six weeks: the plan is week 1, Hangsúly climbs a set a week, Építés one every
    /// second week, Tartás stays; nothing passes the top of its band, and the last week is half.
    func path(_ muscle: String) -> [Int] {
        let start = weekly(muscle)
        guard let band = band(muscle), start > 0 else { return Array(repeating: start, count: 6) }
        var out: [Int] = []
        for week in 0..<5 {
            let climb: Int
            switch tiers[muscle] ?? .grow {
            case .emphasize: climb = week
            case .grow: climb = week / 2
            case .maintain: climb = 0
            }
            out.append(max(start, min(band.high, start + climb)))
        }
        out.append(Int((Double(out[4]) / 2).rounded(.up)))
        return out
    }

    func weekTotals() -> [Int] {
        let other = total() - Self.muscles.map(weekly).reduce(0, +)
        return (0..<6).map { w in
            Self.muscles.map { path($0)[w] }.reduce(0, +) + (w == 5 ? (other + 1) / 2 : other)
        }
    }

    /// „hétfő 6 · csütörtök 5" — where this muscle's sets sit in the week.
    func spread(_ muscle: String) -> String {
        days.indices.compactMap { d in
            let sets = daySets(d, muscle: muscle)
            return sets > 0 ? "\(days[d].name.lowercased()) \(sets)" : nil
        }.joined(separator: " · ")
    }

    /// The muscles the review has something to say about, in the order of the body.
    var reviewMuscles: [String] { Self.muscles.filter { m in changes.contains { $0.muscle == m } } }
    var quietMuscles: [String] { Self.muscles.filter { m in !changes.contains { $0.muscle == m } } }
    func lines(_ muscle: String) -> [DemoChange] { changes.filter { $0.muscle == muscle } }

    func decide(_ id: String, accept: Bool?) {
        if let i = changes.firstIndex(where: { $0.id == id }) { changes[i].decided = accept }
    }

    func decideAll(_ muscle: String, accept: Bool, onlyOpen: Bool = false) {
        for i in changes.indices where changes[i].muscle == muscle && (!onlyOpen || changes[i].decided == nil) {
            changes[i].decided = accept
        }
    }

    func isSettled(_ muscle: String) -> Bool { lines(muscle).allSatisfy { $0.decided != nil } }

    /// The set change of the lines he has not turned down.
    func setDelta(_ muscle: String) -> Int {
        lines(muscle).filter { $0.decided != false }.reduce(0) { sum, c in
            if case .sets(let from, let to) = c.kind { return sum + (to - from) }
            return sum
        }
    }

    func cycle(_ muscle: String) {
        switch tiers[muscle] ?? .grow {
        case .maintain: tiers[muscle] = .grow
        case .grow: tiers[muscle] = .emphasize
        case .emphasize: tiers[muscle] = .maintain
        }
    }
}

func demoMuscleName(_ key: String) -> String {
    switch key {
    case "back": "Hát"
    case "biceps": "Bicepsz"
    case "shoulder": "Váll"
    case "chest": "Mellkas"
    case "triceps": "Tricepsz"
    case "quad": "Comb eleje"
    case "ham": "Comb hátulja"
    case "glute": "Fenék"
    case "core": "Törzs"
    default: "Nem számít bele"
    }
}

func demoKg(_ kg: Double) -> String {
    let whole = kg.rounded() == kg
    return (whole ? String(Int(kg)) : String(format: "%.1f", kg).replacingOccurrences(of: ".", with: ",")) + " kg"
}
#endif
