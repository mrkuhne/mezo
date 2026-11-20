#if DEBUG
import SwiftUI
import Observation

// THROWAWAY simulator spike (mezo-r36n9.116, spec 2026-11-20-boop-blokk-szerkeszto-design.md §6). The block
// builder's Napok day card turned into an editor, on invented local data — no server, no real draft. Nothing here
// ships; the production build lands after the owner's OK.
//
//   -previewSzerkeszto YES
//   -previewSzerkesztoState default|menu|settings|add|swap|undo|empty|locked|confirm|dragging
//   -previewSzerkesztoDay N

enum SzState: String {
    case `default`, menu, settings, add, swap, undo, empty, locked, confirm, dragging

    static var launch: SzState {
        SzState(rawValue: UserDefaults.standard.string(forKey: "previewSzerkesztoState") ?? "") ?? .default
    }
}

struct SzRow: Identifiable, Equatable {
    var id = UUID()
    var name: String
    /// The catalogue's fine muscle key (`back-mid`, `chest-upper`…).
    var muscle: String
    var isolation: Bool
    var sets: Int
    var repMin: Int
    var repMax: Int
    var reserve: Int
    var startKg: Double? = nil
    var warmups: Int = 1
    var technique: String? = nil
    /// A machine or cable: a technique can be picked. Free weights say so instead.
    var stable: Bool = true
    /// The server's override keys he owns: `repRange`, `targetRir`, `workingSets`.
    var overrides: Set<String> = []

    var coarse: String { szCoarse(muscle) }
}

struct SzDay: Identifiable, Equatable {
    let id: Int
    let name: String
    var title: String
    var rows: [SzRow]
}

/// The coarse group the evaluator bands.
func szCoarse(_ muscle: String) -> String {
    let head = muscle.split(separator: "-").first.map(String.init) ?? muscle
    return head
}

enum SzSheet: Identifiable, Equatable {
    case settings(UUID), add(Int), swap(UUID)
    var id: String {
        switch self {
        case .settings(let id): "s\(id)"
        case .add(let d): "a\(d)"
        case .swap(let id): "w\(id)"
        }
    }
}

@Observable final class SzModel {
    var days: [SzDay]
    private(set) var saved: [SzDay]
    /// Péntek: 2026-11-20 is a Friday.
    let todayIndex = 4
    /// A workout of today is started and not finished (spec §6.4).
    var workoutRunning = false
    /// Days with lines in the weekly proposal waiting for his approval.
    let pendingReviewDays: Set<Int> = [0, 3]

    // The editor's transient UI, here so the launch flags can set it.
    var menuRow: UUID?
    var sheet: SzSheet?
    var confirm = false
    var dragging: UUID?
    var dragOffset: CGFloat = 0
    var deleted: (row: SzRow, day: Int, index: Int)?
    var savedFlash = false

    init() {
        let d = SzModel.week()
        days = d
        saved = d
    }

    var hasChanges: Bool { days != saved }

    func save() {
        saved = days
        deleted = nil
        savedFlash = true
    }

    /// Identities or order changed against what is saved: the save needs a structural replace.
    func structurallyChanged(_ day: Int) -> Bool {
        days[day].rows.map(\.id) != saved[day].rows.map(\.id)
    }

    var needsReviewConfirm: Bool {
        pendingReviewDays.contains { structurallyChanged($0) }
    }

    func locked(_ day: Int) -> Bool { workoutRunning && day == todayIndex }

    // MARK: numbers (FIXTURE: the app asks the server's evaluator)

    static let bands: [(muscle: String, low: Int, high: Int)] = [
        ("back", 14, 20), ("chest", 10, 16), ("biceps", 8, 14), ("shoulder", 10, 18),
        ("triceps", 6, 10), ("quad", 4, 8), ("ham", 4, 8), ("glute", 4, 8)]

    func weekly(_ coarse: String) -> Int {
        days.flatMap(\.rows).filter { $0.coarse == coarse }.map(\.sets).reduce(0, +)
    }

    func daySets(_ coarse: String, day: Int) -> Int {
        days[day].rows.filter { $0.coarse == coarse }.map(\.sets).reduce(0, +)
    }

    /// Banded muscles under their band this week.
    var under: [String] { Self.bands.filter { weekly($0.muscle) < $0.low }.map(\.muscle) }
    var outsideCount: Int { Self.bands.filter { let w = weekly($0.muscle); return w < $0.low || w > $0.high }.count }

    func minutes(_ day: Int) -> Int {
        let sets = days[day].rows.map(\.sets).reduce(0, +)
        return sets == 0 ? 0 : Int((Double(sets) * 2.6 + 6).rounded())
    }

    // MARK: edits

    func row(_ id: UUID) -> (day: Int, index: Int)? {
        for (d, day) in days.enumerated() {
            if let i = day.rows.firstIndex(where: { $0.id == id }) { return (d, i) }
        }
        return nil
    }

    func update(_ id: UUID, _ change: (inout SzRow) -> Void) {
        guard let at = row(id) else { return }
        change(&days[at.day].rows[at.index])
        savedFlash = false
    }

    func step(_ id: UUID, by delta: Int) {
        update(id) { $0.sets = max(1, min(8, $0.sets + delta)) }
    }

    func delete(_ id: UUID) {
        guard let at = row(id) else { return }
        let r = days[at.day].rows.remove(at: at.index)
        deleted = (r, at.day, at.index)
        menuRow = nil
        savedFlash = false
    }

    func undoDelete() {
        guard let d = deleted else { return }
        days[d.day].rows.insert(d.row, at: min(d.index, days[d.day].rows.count))
        deleted = nil
    }

    func add(_ pick: SzPick, day: Int) {
        // The style's prescription for it, as the server returns it with the suggestion (unstyled: 3 × 8–12 · 2).
        let r = SzRow(name: pick.name, muscle: pick.muscle, isolation: pick.isolation, sets: 3,
                      repMin: pick.isolation ? 10 : 8, repMax: pick.isolation ? 15 : 12, reserve: 2,
                      stable: pick.stable)
        days[day].rows.append(r)
        deleted = nil
        savedFlash = false
    }

    /// The replacement keeps the row's technique and his own values; the rest comes from the suggestion.
    func swap(_ id: UUID, to pick: SzPick) {
        update(id) { r in
            let keepRange = r.overrides.contains("repRange")
            let keepRir = r.overrides.contains("targetRir")
            r.id = UUID()
            r.name = pick.name; r.muscle = pick.muscle; r.isolation = pick.isolation; r.stable = pick.stable
            if !keepRange { r.repMin = pick.isolation ? 10 : 8; r.repMax = pick.isolation ? 15 : 12 }
            if !keepRir { r.reserve = 2 }
            if !pick.stable { r.technique = nil }
            r.startKg = nil
        }
        deleted = nil
    }

    /// Visszaállítom az edzésmódra: every key of the row at once.
    func resetToStyle(_ id: UUID) {
        update(id) { r in
            r.repMin = r.isolation ? 12 : 8
            r.repMax = r.isolation ? 15 : 10
            r.reserve = 1
            r.overrides = []
        }
    }

    // MARK: fixture week — the owner's shape, real catalogue names, invented numbers

    private static func r(_ name: String, _ muscle: String, _ sets: Int, iso: Bool = false, range: (Int, Int)? = nil,
                          rir: Int = 1, technique: String? = nil, stable: Bool = true, kg: Double? = nil,
                          overrides: Set<String> = []) -> SzRow {
        let rr = range ?? (iso ? (12, 15) : (8, 10))
        return SzRow(name: name, muscle: muscle, isolation: iso, sets: sets, repMin: rr.0, repMax: rr.1, reserve: rir,
                     startKg: kg, technique: technique, stable: stable, overrides: overrides)
    }

    static func week() -> [SzDay] {
        [
            SzDay(id: 0, name: "Hétfő", title: "Hát és bicepsz", rows: [
                r("Chest Supported Row", "back-mid", 3, range: (6, 8), kg: 62.5, overrides: ["repRange"]),
                r("Lat Pulldown · Neutral", "back-wide", 3, range: (10, 12), technique: "Pihenős drop"),
                r("Cable Fly", "chest-mid", 2, iso: true),
                r("Preacher Curl", "biceps-short", 3, iso: true, range: (10, 12)),
                r("Hammer Curl", "biceps-brachialis", 2, iso: true, range: (10, 12), stable: false),
                r("Cable Lateral Raise", "shoulder-side", 3, iso: true)]),
            SzDay(id: 1, name: "Kedd", title: "Láb", rows: [
                r("Leg Press", "quad", 3, rir: 2),
                r("Romanian Deadlift", "ham", 3, rir: 2, stable: false),
                r("Leg Extension", "quad", 2, iso: true),
                r("Seated Leg Curl", "ham", 3, iso: true, range: (10, 12)),
                r("Hip Thrust", "glute", 2, rir: 2, stable: false),
                r("Standing Calf Raise", "calf", 3, iso: true)]),
            SzDay(id: 2, name: "Szerda", title: "Mell és váll", rows: [
                r("Incline DB Press", "chest-upper", 3, stable: false),
                r("Machine Chest Press", "chest-mid", 3, technique: "Pihenős drop"),
                r("Machine Shoulder Press", "shoulder-front", 2),
                r("Lateral Raise", "shoulder-side", 3, iso: true, stable: false),
                r("Face Pull", "shoulder-rear", 2, iso: true)]),
            SzDay(id: 3, name: "Csütörtök", title: "Hát és kar", rows: [
                r("One-Arm Cable Row", "back-mid", 3, range: (10, 12)),
                r("Pull-Up", "back-wide", 3, rir: 2, stable: false),
                r("Incline DB Curl", "biceps-long", 3, iso: true, range: (10, 12), stable: false),
                r("Tricep Pushdown", "triceps-medial", 3, iso: true),
                r("Cable Overhead Extension", "triceps-long", 2, iso: true),
                r("Reverse Pec Deck", "shoulder-rear", 2, iso: true)]),
            SzDay(id: 4, name: "Péntek", title: "Könnyű kar és törzs", rows: [
                r("EZ-Bar Curl", "biceps-short", 2, iso: true, range: (10, 12), stable: false),
                r("Skullcrusher", "triceps-medial", 2, iso: true, range: (10, 12), stable: false),
                r("Cable Crunch", "core", 3, iso: true),
                r("Pallof Press", "core", 2, iso: true)]),
            SzDay(id: 5, name: "Szombat", title: "Pihenőnap", rows: []),
            SzDay(id: 6, name: "Vasárnap", title: "Pihenőnap", rows: []),
        ]
    }
}

// MARK: - The catalogue and the suggestions (FIXTURE: the app gets them from the server's ranker)

struct SzPick: Identifiable, Equatable {
    var id: String { name }
    let name: String
    let muscle: String
    var isolation = false
    var stable = true
}

struct SzSuggestion: Identifiable {
    var id: String { pick.name }
    let pick: SzPick
    let reason: String
    /// „Legutóbb: …" — nil when he has never done it.
    let last: String?
}

enum SzCatalog {
    static let all: [SzPick] = [
        // back
        .init(name: "Seated Cable Row · Neutral", muscle: "back-mid"), .init(name: "Machine High Row", muscle: "back-mid"),
        .init(name: "Chest-Supported T-Bar Row", muscle: "back-mid"), .init(name: "Single-Arm DB Row", muscle: "back-mid", stable: false),
        .init(name: "T-Bar Row", muscle: "back-mid", stable: false), .init(name: "Barbell Row", muscle: "back-mid", stable: false),
        .init(name: "Pendlay Row", muscle: "back-mid", stable: false), .init(name: "Seal Row", muscle: "back-mid", stable: false),
        .init(name: "Meadows Row", muscle: "back-mid", stable: false), .init(name: "Cable Pull-Around", muscle: "back-mid"),
        .init(name: "Chest Supported Row", muscle: "back-mid"), .init(name: "One-Arm Cable Row", muscle: "back-mid"),
        .init(name: "Lat Pulldown · Pronated", muscle: "back-wide"), .init(name: "Lat Pulldown · Neutral", muscle: "back-wide"),
        .init(name: "Single-Arm Lat Pulldown", muscle: "back-wide"), .init(name: "Straight-Arm Pulldown", muscle: "back-wide", isolation: true),
        .init(name: "Pull-Up", muscle: "back-wide", stable: false), .init(name: "Chin-Up", muscle: "back-wide", stable: false),
        .init(name: "Machine Pullover", muscle: "back-wide", isolation: true),
        // chest
        .init(name: "Pec Deck", muscle: "chest-mid", isolation: true), .init(name: "Incline Machine Press", muscle: "chest-upper"),
        .init(name: "Low-to-High Cable Fly", muscle: "chest-upper", isolation: true), .init(name: "DB Bench Press", muscle: "chest-mid", stable: false),
        .init(name: "Deficit Push-Up", muscle: "chest-mid", stable: false), .init(name: "Barbell Bench Press", muscle: "chest-mid", stable: false),
        .init(name: "Cable Fly", muscle: "chest-mid", isolation: true), .init(name: "Machine Chest Press", muscle: "chest-mid"),
        .init(name: "Incline DB Press", muscle: "chest-upper", stable: false), .init(name: "High-to-Low Cable Fly", muscle: "chest-lower", isolation: true),
        // shoulder
        .init(name: "Machine Lateral Raise", muscle: "shoulder-side", isolation: true),
        .init(name: "Leaning Cable Lateral Raise", muscle: "shoulder-side", isolation: true),
        .init(name: "Cable Lateral Raise", muscle: "shoulder-side", isolation: true),
        .init(name: "Lateral Raise", muscle: "shoulder-side", isolation: true, stable: false),
        .init(name: "Reverse Pec Deck", muscle: "shoulder-rear", isolation: true), .init(name: "Face Pull", muscle: "shoulder-rear", isolation: true),
        .init(name: "Cable Rear-Delt Fly", muscle: "shoulder-rear", isolation: true),
        .init(name: "Machine Shoulder Press", muscle: "shoulder-front"), .init(name: "Seated DB Shoulder Press", muscle: "shoulder-front", stable: false),
        // biceps
        .init(name: "Cable Curl", muscle: "biceps-long", isolation: true), .init(name: "Spider Curl", muscle: "biceps-short", isolation: true, stable: false),
        .init(name: "Concentration Curl", muscle: "biceps-short", isolation: true, stable: false),
        .init(name: "Incline DB Curl", muscle: "biceps-long", isolation: true, stable: false),
        .init(name: "Drag Curl", muscle: "biceps-long", isolation: true, stable: false),
        .init(name: "Preacher Curl", muscle: "biceps-short", isolation: true), .init(name: "Hammer Curl", muscle: "biceps-brachialis", isolation: true, stable: false),
        .init(name: "EZ-Bar Curl", muscle: "biceps-short", isolation: true, stable: false),
        // triceps
        .init(name: "Tricep Pushdown", muscle: "triceps-medial", isolation: true), .init(name: "Single-Arm Pushdown", muscle: "triceps-medial", isolation: true),
        .init(name: "Cable Overhead Extension", muscle: "triceps-long", isolation: true), .init(name: "Skullcrusher", muscle: "triceps-medial", isolation: true, stable: false),
        .init(name: "JM Press", muscle: "triceps-lateral", stable: false),
        // legs
        .init(name: "Leg Press", muscle: "quad"), .init(name: "Hack Squat", muscle: "quad"), .init(name: "Leg Extension", muscle: "quad", isolation: true),
        .init(name: "Smith Machine Squat", muscle: "quad"), .init(name: "Bulgarian Split Squat", muscle: "quad", stable: false),
        .init(name: "Seated Leg Curl", muscle: "ham", isolation: true), .init(name: "Leg Curl", muscle: "ham", isolation: true),
        .init(name: "Romanian Deadlift", muscle: "ham", stable: false), .init(name: "Nordic Ham Curl", muscle: "ham", stable: false),
        .init(name: "Hip Thrust", muscle: "glute", stable: false), .init(name: "Glute Bridge", muscle: "glute", stable: false),
        .init(name: "Cable Kickback", muscle: "glute", isolation: true), .init(name: "Machine Hip Abduction", muscle: "glute", isolation: true),
        .init(name: "Standing Calf Raise", muscle: "calf", isolation: true), .init(name: "Seated Calf Raise", muscle: "calf", isolation: true),
        .init(name: "Cable Crunch", muscle: "core", isolation: true), .init(name: "Pallof Press", muscle: "core", isolation: true),
        .init(name: "Hanging Leg Raise", muscle: "core", isolation: true, stable: false),
    ]

    /// The quiet labels of the full list (FIXTURE: the server's `labels`).
    static let quiet: [String: String] = [
        "T-Bar Row": "nincs hozzá eszközöd", "Meadows Row": "nincs hozzá eszközöd", "Barbell Row": "legutóbb fájt",
        "Nordic Ham Curl": "nincs hozzá eszközöd", "Barbell Bench Press": "legutóbb fájt", "Chin-Up": "legutóbb fájt"]

    static func pick(_ name: String) -> SzPick { all.first { $0.name == name } ?? SzPick(name: name, muscle: "back-mid") }

    /// Up to five for a muscle (add) — no digits, no names, never „legjobb".
    static func forMuscle(_ coarse: String, under: Bool, excluding: Set<String>) -> [SzSuggestion] {
        let low = "ezen a héten kevés jut erre az izomra"
        let list: [SzSuggestion]
        switch coarse {
        case "back": list = [
            .init(pick: pick("Seated Cable Row · Neutral"), reason: "Ugyanazt a munkát végzi a tervben, ezt már csináltad, így látod, hol tartasz.", last: "55 kg × 10"),
            .init(pick: pick("Machine High Row"), reason: "Ezen a héten kevés jut erre az izomra, vezetett mozgás, kíméletesebb az ízületnek.", last: nil),
            .init(pick: pick("Single-Arm Lat Pulldown"), reason: "Egy karral dolgozol, így a gyengébb oldal is utoléri a másikat.", last: "32,5 kg × 12"),
            .init(pick: pick("Chest-Supported T-Bar Row"), reason: "A mellkasod meg van támasztva, a hát dolgozik, nem a lendület.", last: nil),
            .init(pick: pick("Straight-Arm Pulldown"), reason: "Izolált mozgás, a széles hátizmot külön is eléri, a kar közben pihen.", last: "25 kg × 15")]
        case "chest": list = [
            .init(pick: pick("Pec Deck"), reason: "Ezen a héten kevés jut erre az izomra, a gép tartja a pályát, a váll kíméletesebb.", last: "45 kg × 12"),
            .init(pick: pick("Incline Machine Press"), reason: "A mellkas felső részét éri el, ami a tervben eddig kevesebbet kapott.", last: nil),
            .init(pick: pick("Low-to-High Cable Fly"), reason: "Csigán végig egyenletes a terhelés, nyújtott helyzetben is dolgozik az izom.", last: nil),
            .init(pick: pick("DB Bench Press"), reason: "Ezt már csináltad, így látod, hol tartasz.", last: "26 kg × 8")]
        case "glute": list = [
            .init(pick: pick("Machine Hip Abduction"), reason: "Ezen a héten kevés jut erre az izomra, vezetett mozgás, a derekat nem terheli.", last: nil),
            .init(pick: pick("Cable Kickback"), reason: "Egy lábbal dolgozol, csigán, kíméletes a térdnek.", last: nil),
            .init(pick: pick("Glute Bridge"), reason: "Ugyanazt a mozgást végzi, mint a tervben lévő, csak könnyebb beállni.", last: "60 kg × 12")]
        case "biceps": list = [
            .init(pick: pick("Cable Curl"), reason: "Csigán végig egyenletes a terhelés, a könyöknek kíméletesebb.", last: "20 kg × 12"),
            .init(pick: pick("Spider Curl"), reason: "Rövidített helyzetben dolgoztatja az izmot, ez a tervből most hiányzik.", last: nil),
            .init(pick: pick("Incline DB Curl"), reason: "Nyújtott helyzetben dolgozik az izom, ezt már csináltad, így látod, hol tartasz.", last: "12 kg × 10")]
        case "shoulder": list = [
            .init(pick: pick("Machine Lateral Raise"), reason: "Vezetett mozgás, az oldalsó vállat külön éri el, kíméletes az ízületnek.", last: nil),
            .init(pick: pick("Leaning Cable Lateral Raise"), reason: "Csigán, dőlve végig dolgozik az izom, a mozgás alján is.", last: "7,5 kg × 15"),
            .init(pick: pick("Cable Rear-Delt Fly"), reason: "A hátsó vállat éri el, ami a tervben kevesebbet kap.", last: nil)]
        default:
            let all = Self.all.filter { szCoarse($0.muscle) == coarse }
            list = all.prefix(3).map { .init(pick: $0, reason: "Ugyanerre az izomra dolgozik, és nincs még ezen a napon.", last: nil) }
        }
        _ = low; _ = under
        return Array(list.filter { !excluding.contains($0.pick.name) }.prefix(5))
    }

    /// Up to five replacements for a row (swap) — the ranker with the row as the outgoing exercise.
    static func replacements(for row: SzRow, excluding: Set<String>) -> [SzSuggestion] {
        let list: [SzSuggestion]
        switch row.coarse {
        case "back": list = [
            .init(pick: pick("Seated Cable Row · Neutral"), reason: "Ugyanazt a munkát végzi a tervben, ezt már csináltad, így látod, hol tartasz.", last: "55 kg × 10"),
            .init(pick: pick("Chest-Supported T-Bar Row"), reason: "Ugyanúgy meg van támasztva a mellkasod, a hát dolgozik, nem a derék.", last: nil),
            .init(pick: pick("Machine High Row"), reason: "Vezetett mozgás, a gép tartja a pályát, kíméletesebb az ízületnek.", last: nil),
            .init(pick: pick("Single-Arm DB Row"), reason: "Egy karral dolgozol, így a gyengébb oldal is utoléri a másikat.", last: "30 kg × 10"),
            .init(pick: pick("Cable Pull-Around"), reason: "Csigán végig egyenletes a terhelés, a hát közepét éri el.", last: nil)]
        default:
            list = forMuscle(row.coarse, under: false, excluding: [])
        }
        return Array(list.filter { !excluding.contains($0.pick.name) && $0.pick.name != row.name }.prefix(5))
    }
}
#endif
