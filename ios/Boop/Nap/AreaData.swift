import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The days behind a room (section 3)

/// One row of "A napok mögötte": the day's name, its value, how full its bar is (0–1), and whether it is today.
struct DrillDay: Equatable {
    let day: String, value: String, fill: Double, today: Bool
}

/// The week behind an orb, oldest first, today last. Alvás reads the deep-sleep week ("96 p"), Pulzus the resting
/// pulse ("57 bpm"); the bars are relative to the week's highest day. A missing day reads "–" with an empty bar; a
/// week with no value at all, and the other orbs, have no rows.
func drillDays(_ hue: Hue, _ brief: Brief) -> [DrillDay] {
    let week: [Int?], unit: String
    switch hue {
    case .alvas: week = brief.day.deepSleepWeek; unit = "p"
    case .pulzus: week = brief.day.restingHrWeek; unit = "bpm"
    default: return []
    }
    guard let top = week.compactMap({ $0 }).max() else { return [] }
    let names = weekdayNames(endingOn: brief.date, count: week.count)
    return week.enumerated().map { k, v in
        DrillDay(day: names[k], value: v.map { "\($0) \(unit)" } ?? "–",
                 fill: v.map { top > 0 ? Double($0) / Double(top) : 0 } ?? 0, today: k == week.count - 1)
    }
}

/// "ALVÁS · MA ÉJJEL" above the room's headline.
func drillEyebrow(_ hue: Hue) -> String {
    switch hue {
    case .alvas: "\(hue.name) · ma éjjel"
    case .pulzus: "\(hue.name) · nyugalmi"
    default: "\(hue.name) · ma"
    }
}

/// The label of a room's week section.
func drillWeekLabel(_ hue: Hue) -> String {
    switch hue {
    case .alvas: "MÉLYALVÁS · 7 NAP"
    case .pulzus: "NYUGALMI PULZUS · 7 NAP"
    case .forma: "AZ ENERGIÁD · MA"
    default: "A HÉT"
    }
}

enum DrillText {
    static let noWeek = "Ehhez még nem gyűjtök heti képet — hamarosan."
    static let noDays = "Ezen a héten még nincs mit sorba tennem."
    static let noEnergy = "A mai energiagörbédet még nem látom."
    static let sleepDetail = "Az éjszaka részletei"
    static let pulseDetail = "A pulzusod részletei"
}

// MARK: - The room

/// Alvás's room draws the night's hypnogram once, in section 1 (owner, 2026-11-12); the night card on the path
/// below then carries no second copy — it only speaks when there are no stages to draw.
func roomShowsHypnogram(_ sleep: Brief.Sleep) -> Bool { !sleep.hypnogram.isEmpty }

// The room itself (`MaDrill`: a painted head and four numbered sections) was replaced on 2026-11-16 by
// `AreaRoom` — every area is its own page on the shared kit now (`mezo-r36n9.57`). What stays in this file is
// what that page still reads: the days behind an area, its eyebrow, the week's label, and the rule that the
// hypnogram is drawn once. The old view is in git history.
