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

    /// The year map's block 3 (Mell + váll): its focus at Hangsúly, the rest at Tartás.
    static let fromMap = ETIntake(weeks: 6, minutes: 60, tiers: Dictionary(uniqueKeysWithValues: muscles.map {
        ($0, ["chest", "shoulder"].contains($0) ? MuscleTier.emphasize : .maintain)
    }), fromMap: true)
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
                      ETWhy(tone: .neutral, text: "Minden nap mindenre bemelegítesz: hetente kb. 12 bemelegítő sorozattal több."),
                      ETWhy(tone: .warn, text: "A comb két egymást követő napon kap kemény sorozatot (H, K).")]),
    ETCandidate(id: 2, name: "Toló / Húzó / Láb / Kar", sub: "izomcsoportonként",
                minutes: [71, 66, nil, 63, 52, nil, nil], recommended: false,
                why: [ETWhy(tone: .warn, text: "Túllépi a 60 percet: a toló nap kb. 71 perc."),
                      ETWhy(tone: .warn, text: "A váll és a kar hetente csak egyszer kap kemény sorozatot."),
                      ETWhy(tone: .neutral, text: "A heti sorozatszám ugyanannyi, csak kevesebb napra jut.")]),
]

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
    ETMuscleRow(muscle: "back", tier: .emphasize, sets: 14, low: 14, high: 22, spread: [("Hétfő", 7), ("Kedd", 3), ("Csütörtök", 4)],
                hint: "A hát két egymást követő napon kap kemény sorozatot (H, K): kedden a román felhúzás is dolgoztatja. Ha teheted, a csütörtöki húzásból tegyél át egy sorozatot péntekre."),
    ETMuscleRow(muscle: "chest", tier: .grow, sets: 11, low: 10, high: 16, spread: [("Hétfő", 6), ("Csütörtök", 5)], hint: nil),
    ETMuscleRow(muscle: "shoulder", tier: .grow, sets: 10, low: 10, high: 16, spread: [("Hétfő", 4), ("Csütörtök", 6)], hint: nil),
    ETMuscleRow(muscle: "biceps", tier: .grow, sets: 9, low: 8, high: 14, spread: [("Hétfő", 4), ("Csütörtök", 5)], hint: nil),
    ETMuscleRow(muscle: "triceps", tier: .grow, sets: 8, low: 8, high: 14, spread: [("Hétfő", 4), ("Csütörtök", 4)], hint: nil),
    ETMuscleRow(muscle: "quad", tier: .grow, sets: 12, low: 10, high: 16, spread: [("Kedd", 6), ("Péntek", 6)], hint: nil),
    ETMuscleRow(muscle: "ham", tier: .grow, sets: 9, low: 8, high: 14, spread: [("Kedd", 4), ("Péntek", 5)], hint: nil),
    ETMuscleRow(muscle: "glute", tier: .grow, sets: 8, low: 6, high: 12, spread: [("Kedd", 4), ("Péntek", 4)], hint: nil),
    ETMuscleRow(muscle: "calf", tier: .maintain, sets: 3, low: 3, high: 7, spread: [("Kedd", 3)], hint: nil),
    ETMuscleRow(muscle: "core", tier: .maintain, sets: 4, low: 2, high: 5, spread: [("Péntek", 4)], hint: nil),
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
