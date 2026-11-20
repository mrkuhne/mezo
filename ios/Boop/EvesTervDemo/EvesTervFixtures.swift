#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike (mezo-r36n9.113): invented, real-looking fixtures. Never anyone's real data.

// MARK: - The intake (S2 Alapok)

struct ETIntake: Equatable {
    var weeks: Int
    var minutes: Int
    var tiers: [String: MuscleTier]
    var fromMap: Bool

    static let muscles = ["back", "chest", "shoulder", "biceps", "triceps", "quad", "ham", "glute", "calf", "core"]

    static let fresh = ETIntake(weeks: 6, minutes: 60, tiers: [
        "back": .emphasize, "chest": .grow, "shoulder": .grow, "biceps": .grow, "triceps": .grow,
        "quad": .grow, "ham": .grow, "glute": .grow, "calf": .maintain, "core": .maintain,
    ], fromMap: false)

    /// The budget full on both counts: two muscles at Hangsúly, 71 of 72 sets at the heaviest week.
    static let full: ETIntake = {
        var i = ETIntake.fresh
        i.tiers["chest"] = .emphasize
        return i
    }()

    /// The year map's block 3 (Mell + váll): its focus at Hangsúly, the rest at Tartás.
    static let fromMap = ETIntake(weeks: 6, minutes: 60, tiers: Dictionary(uniqueKeysWithValues: muscles.map {
        ($0, ["chest", "shoulder"].contains($0) ? MuscleTier.emphasize : .maintain)
    }), fromMap: true)
}

// MARK: - The weekly budget (S1 item 7, „Heti keret")

/// Approximate weekly working sets at the heaviest loading week, per muscle, for Tartás · Építés · Hangsúly
/// (spike only: the real numbers are the server's evaluator).
let etTierCost: [String: (Int, Int, Int)] = [
    "back": (4, 9, 14), "chest": (4, 8, 13), "shoulder": (3, 8, 13), "biceps": (2, 6, 10), "triceps": (2, 6, 10),
    "quad": (4, 8, 13), "ham": (3, 6, 10), "glute": (2, 5, 9), "calf": (3, 6, 10), "core": (2, 4, 6),
]
let etTrainingDays = 4
let etEmphasizeMax = 2

func etCost(_ muscle: String, _ tier: MuscleTier) -> Int {
    let c = etTierCost[muscle] ?? (2, 5, 8)
    switch tier {
    case .maintain: return c.0
    case .grow: return c.1
    case .emphasize: return c.2
    }
}

func etRank(_ tier: MuscleTier) -> Int {
    switch tier {
    case .maintain: 0
    case .grow: 1
    case .emphasize: 2
    }
}

/// How many working sets fit in a week of four sessions of this length (minutes model v2, rest included).
func etCapacity(minutes: Int) -> Int {
    let perSession: Int = switch minutes {
    case ..<50: 13
    case ..<65: 18
    case ..<80: 23
    default: 28
    }
    return etTrainingDays * perSession
}

extension ETIntake {
    var used: Int { ETIntake.muscles.reduce(0) { $0 + etCost($1, tiers[$1] ?? .grow) } }
    var capacity: Int { etCapacity(minutes: minutes) }
    var emphasizeCount: Int { tiers.values.filter { $0 == .emphasize }.count }
    func sets(_ tier: MuscleTier) -> Int {
        ETIntake.muscles.filter { (tiers[$0] ?? .grow) == tier }.reduce(0) { $0 + etCost($1, tier) }
    }

    /// Why raising this muscle to this tier is not allowed now; nil = allowed. Lowering is always allowed.
    func blockReason(_ muscle: String, to tier: MuscleTier) -> String? {
        let current = tiers[muscle] ?? .grow
        guard etRank(tier) > etRank(current) else { return nil }
        if tier == .emphasize && emphasizeCount >= etEmphasizeMax {
            return "Már \(etEmphasizeMax) izom van Hangsúlyon — előbb vegyél le egyet."
        }
        if used - etCost(muscle, current) + etCost(muscle, tier) > capacity {
            return "Ez már nem fér a heti \(etTrainingDays) × \(minutes) percbe. Vegyél le egy izmot Tartásra, vagy adj hozzá időt."
        }
        return nil
    }
}

struct ETBlocked: Equatable {
    let muscle: String
    let text: String
}

// MARK: - The candidates (S1/S2 Jelöltek)

enum ETTone: Equatable {
    case good, neutral, warn
    var color: Color {
        switch self {
        case .good: planGood
        case .neutral: .white.opacity(0.6)
        case .warn: planWarn
        }
    }
    var mark: PlanMark.Kind {
        switch self {
        case .good: .check
        case .neutral: .keep
        case .warn: .flame
        }
    }
}

struct ETWhy: Equatable, Hashable {
    let tone: ETTone
    let text: String
}

struct ETCandidate: Identifiable {
    let id: Int
    let name: String
    let sub: String
    /// Minutes per weekday (H…V), nil = rest day.
    let minutes: [Int?]
    let recommended: Bool
    let why: [ETWhy]
    var longest: Int { minutes.compactMap { $0 }.max() ?? 0 }
}

let etWeekdays = ["H", "K", "Sze", "Cs", "P", "Szo", "V"]

let etCandidates: [ETCandidate] = [
    ETCandidate(id: 0, name: "Felső / Alsó", sub: "felső · alsó · felső · alsó",
                minutes: [58, 55, nil, 57, 54, nil, nil], recommended: true,
                why: [ETWhy(tone: .good, text: "Belefér a 60 percbe: a leghosszabb nap kb. 58 perc."),
                      ETWhy(tone: .good, text: "Minden izom hetente kétszer kap kemény sorozatot."),
                      ETWhy(tone: .neutral, text: "Hétfő és kedd egymás után jön, de más izmok dolgoznak.")]),
    ETCandidate(id: 1, name: "Teljes test ×4", sub: "minden nap az egész test",
                minutes: [49, 47, nil, 49, 46, nil, nil], recommended: false,
                why: [ETWhy(tone: .good, text: "A legrövidebb edzések: kb. 49 perc."),
                      ETWhy(tone: .good, text: "Minden izom hetente négyszer, naponta kevés sorozattal."),
                      ETWhy(tone: .neutral, text: "Minden nap mindenre bemelegítesz: hetente kb. 12 bemelegítő sorozattal több.")]),
]

/// Screen 3b: 3 days × 45 minutes with two muscles at Hangsúly — no split passes; the closest one, kept apart.
let etClosest = ETCandidate(id: 9, name: "Teljes test ×3", sub: "minden nap az egész test",
                            minutes: [58, nil, 57, nil, 58, nil, nil], recommended: false, why: [])

// MARK: - The chosen block's muscles (S1 „miért?")

struct ETMuscleRow: Identifiable {
    let muscle: String
    let tier: MuscleTier
    let sets: Int
    let low: Int
    let high: Int
    /// Sets per day („Hétfő 7").
    let spread: [(String, Int)]
    let hint: String?
    var id: String { muscle }
    var inside: Bool { sets >= low && sets <= high }
}

let etMuscles: [ETMuscleRow] = [
    ETMuscleRow(muscle: "back", tier: .emphasize, sets: 14, low: 14, high: 22, spread: [("Hétfő", 7), ("Kedd", 4), ("Csütörtök", 3)],
                hint: "A hát két egymást követő napon kap nehéz adagot: hétfőn 7, kedden 4 kemény sorozatot (kedden a román felhúzás is dolgoztatja). Ha a keddiből egyet csütörtökre teszel, rendben lesz."),
    ETMuscleRow(muscle: "chest", tier: .grow, sets: 8, low: 8, high: 14, spread: [("Hétfő", 4), ("Csütörtök", 4)], hint: nil),
    ETMuscleRow(muscle: "shoulder", tier: .grow, sets: 8, low: 8, high: 14, spread: [("Hétfő", 4), ("Csütörtök", 4)], hint: nil),
    ETMuscleRow(muscle: "biceps", tier: .grow, sets: 6, low: 6, high: 12, spread: [("Hétfő", 3), ("Csütörtök", 3)], hint: nil),
    ETMuscleRow(muscle: "triceps", tier: .grow, sets: 6, low: 6, high: 12, spread: [("Hétfő", 3), ("Csütörtök", 3)], hint: nil),
    ETMuscleRow(muscle: "quad", tier: .grow, sets: 8, low: 8, high: 14, spread: [("Kedd", 4), ("Péntek", 4)], hint: nil),
    ETMuscleRow(muscle: "ham", tier: .grow, sets: 6, low: 6, high: 12, spread: [("Kedd", 3), ("Péntek", 3)], hint: nil),
    ETMuscleRow(muscle: "glute", tier: .grow, sets: 5, low: 5, high: 10, spread: [("Kedd", 2), ("Péntek", 3)], hint: nil),
    ETMuscleRow(muscle: "calf", tier: .maintain, sets: 3, low: 3, high: 7, spread: [("Kedd", 3)], hint: nil),
    ETMuscleRow(muscle: "core", tier: .maintain, sets: 2, low: 2, high: 5, spread: [("Péntek", 2)], hint: nil),
]

/// The builder's arc wants the server's band type, which only decodes (spike only).
func etBand(_ low: Int, _ high: Int) -> WireBand {
    let json = #"{"low":\#(low),"high":\#(high),"limit":\#(high + 4),"sportAdjusted":false}"#
    return try! JSONDecoder().decode(WireBand.self, from: Data(json.utf8))
}

// MARK: - The year (S3)

enum ETBlockKind { case felso, lab, tartalek, lezaras }
enum ETBlockStatus: Equatable {
    case done, running(week: Int), next, planned
    var text: String {
        switch self {
        case .done: "kész"
        case .running(let w): "fut · \(w). hét"
        case .next: "következik"
        case .planned: "tervezett"
        }
    }
}

struct ETYearBlock: Identifiable {
    let id: Int
    let ordinal: Int?
    let focus: String
    let kind: ETBlockKind
    let firstWeek: Int
    let weeks: Int
    let status: ETBlockStatus
    var lastWeek: Int { firstWeek + weeks - 1 }
    var kindText: String {
        switch kind {
        case .felso: "FELSŐ"
        case .lab: "LÁB"
        case .tartalek: "TARTALÉK"
        case .lezaras: "LEZÁRÁS"
        }
    }
}

/// Week 1 starts Monday 21 September 2026; today (20 November) is in week 9.
let etYearStart: Date = {
    var c = DateComponents(); c.year = 2026; c.month = 9; c.day = 21; c.hour = 12
    return Calendar(identifier: .gregorian).date(from: c)!
}()
let etCurrentWeek = 9

let etYear: [ETYearBlock] = {
    let focus: [(String, ETBlockKind)] = [
        ("Hát + bicepsz", .felso), ("Comb + farizom", .lab), ("Mell + váll", .felso), ("Combhajlító + farizom", .lab),
        ("Hát + váll", .felso), ("Comb + vádli", .lab), ("Mell + tricepsz", .felso), ("Combhajlító + bicepsz", .lab),
    ]
    var out: [ETYearBlock] = []
    for (i, f) in focus.enumerated() {
        let first = i * 6 + 1
        let status: ETBlockStatus = first + 5 < etCurrentWeek ? .done
            : (first <= etCurrentWeek ? .running(week: etCurrentWeek - first + 1)
               : (out.last.map { if case .running = $0.status { true } else { false } } == true ? .next : .planned))
        out.append(ETYearBlock(id: i, ordinal: i + 1, focus: f.0, kind: f.1, firstWeek: first, weeks: 6, status: status))
    }
    out.append(ETYearBlock(id: 8, ordinal: nil, focus: "Tartalék hetek", kind: .tartalek, firstWeek: 49, weeks: 2, status: .planned))
    out.append(ETYearBlock(id: 9, ordinal: nil, focus: "Lezárás · könnyű szinten tartás", kind: .lezaras, firstWeek: 51, weeks: 2, status: .planned))
    return out
}()

private let etMonths = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]

/// „szept. 21." — the Monday of a plan week (or its Sunday with `end`).
func etDate(week: Int, end: Bool = false) -> String {
    let cal = Calendar(identifier: .gregorian)
    let d = cal.date(byAdding: .day, value: (week - 1) * 7 + (end ? 6 : 0), to: etYearStart)!
    let c = cal.dateComponents([.month, .day], from: d)
    return "\(etMonths[c.month! - 1]) \(c.day!)."
}

/// „dec. 14" — for a suffix („dec. 14-től").
func etDateBare(week: Int) -> String { String(etDate(week: week).dropLast()) }

func etRange(_ b: ETYearBlock) -> String { "\(etDate(week: b.firstWeek)) – \(etDate(week: b.lastWeek, end: true))" }
#endif
