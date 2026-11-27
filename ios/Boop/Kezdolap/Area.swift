import SwiftUI
import BoopCore
import BoopDesign

/// The ten life areas of the home screen's ring, clockwise from the top (owner decision 2026-11-13; the ninth,
/// **Súly**, on 2026-11-24 — `mezo-r36n9.158`; the tenth, **Évad**, between Energia and Súly on 2026-11-27 —
/// `mezo-r36n9.196`, decision #132). Five of them are the metrics Boop carries in the brief; **Pénz**
/// (live since L5, its number from the week's budget — `mezo-r36n9.153`), **Levél** and **Súly** have a page and a
/// colour world of their own without a metric.
enum Area: Int, CaseIterable, Identifiable {
    /// The day itself, at the top of the ring: the owner gave it its own orb on 2026-11-16 (decision #41). It is
    /// the whole day, so it leads rather than following the parts of it.
    case nap, alvas, etel, edzes, energia, evad, suly, forma, penz, level

    var id: Int { rawValue }

    /// The area's name in the spine vocabulary (Fuel → Étel, Mozgás → Edzés, Pulzus → Energia).
    var name: String {
        switch self {
        case .nap: "Nap"
        case .alvas: "Alvás"
        case .etel: "Étel"
        case .edzes: "Edzés"
        case .energia: "Energia"
        case .evad: "Évad"
        case .suly: "Súly"
        case .forma: "Forma"
        case .penz: "Pénz"
        case .level: "Levél"
        }
    }

    /// The metric whose room this area opens; nil for the areas that have no metric in the brief.
    var hue: Hue? {
        switch self {
        case .alvas: .alvas
        case .etel: .fuel
        case .edzes: .mozgas
        case .energia: .pulzus
        case .forma: .forma
        case .nap, .penz, .level, .suly, .evad: nil
        }
    }

    /// The colour world the area's page is painted in. Pénz, Levél and Súly have one without having a metric
    /// (`mezo-r36n9.57`, `.158`).
    var world: Hue? {
        switch self {
        case .penz: .penz
        case .level: .level
        case .suly: .suly
        case .evad: .evad
        default: hue
        }
    }

    /// The day is live but has no metric room: it opens the day's own page instead of a drill-down. Pénz and Súly
    /// are live without a metric: their orbs read their own stores, not the brief (`mezo-r36n9.153`, `.158`).
    var live: Bool { hue != nil || self == .nap || self == .penz || self == .suly || self == .evad }

    /// The orb's four colours. The world's own where there is one; the day's is Boop's cool teal.
    var orb: [Color] {
        if let world { return world.orb }
        return [Color(hex: 0x0A2C38), Color(hex: 0x1F7A8C), Color(hex: 0x8FD9E8), Color(hex: 0xC9F0E2)]
    }

    var glow: Color {
        if let world { return world.glow }
        return Color(hex: 0x4FC3D9)
    }

    /// What a tap used to say while an area had no page at all. Kept for the ring's accessibility line.
    var soonLine: String {
        switch self {
        case .penz: "A Pénz még nem él — a költéseid és a kereteid később kerülnek be."
        default: "A Levél még nem él — a reggeli postád összefoglalója később kerül be."
        }
    }
}

/// How full the day is, 0–100, from the calendar's own busy slots — the day's orb shows this rather than a score
/// nobody computes. nil when there is no calendar day yet (never a fake 0).
func dayFullness(_ brief: Brief?) -> Int? {
    guard let slots = brief?.day.calendar.busySlots, !slots.isEmpty else { return nil }
    return Int(round(Double(slots.filter { $0 }.count) / Double(slots.count) * 100))
}

/// One ring orb: the area's number inside it, the liquid filled to it. An area without data shows "–" and an almost
/// empty orb — never 0. Four orbs do not read the brief's score: the day's (how full the day is), **Étel** (the same
/// number the Étel room shows — the day's meal points; owner 2026-11-24, "egy szám", `mezo-r36n9.152`), **Pénz**
/// (the week's remaining as a share of its budget; owner 2026-11-24, "százalék", `mezo-r36n9.153`) and **Súly**
/// (how well the weight course follows the season's plan, `sulyPaceScore`; `mezo-r36n9.158`).
/// **Évad** shows this week's adherence (`evadWeekScore`, `mezo-r36n9.196`).
func ringItem(_ area: Area, brief: Brief?, foodDay: FoodDay? = nil, penz: PenzAllowance? = nil, suly: Int? = nil,
              evad: Int? = nil) -> NKRingItem {
    var display = "–"
    var level = 0.12
    func fill(_ n: Int) -> Double { min(1, max(0.08, Double(n) / 100)) }
    switch area {
    case .nap:
        // The day's orb fills with how full the day is, not with a score — there is no score for a day.
        if let full = dayFullness(brief) { display = "\(full)"; level = fill(full) }
    case .etel:
        if let points = etelDayPoints(foodDay) { display = "\(points)"; level = fill(points) }
    case .penz:
        if let penz, let share = penzWeekShare(penz) { display = "\(share)"; level = fill(share) }
    case .suly:
        if let suly { display = "\(suly)"; level = fill(suly) }
    case .evad:
        if let evad { display = "\(evad)"; level = fill(evad) }
    default:
        if let hue = area.hue, let brief {
            let copy = maiCopy(brief, metricKey(for: hue))
            display = copy.miniValue
            level = copy.score.map(fill) ?? 0.12
        }
    }
    return NKRingItem(id: "\(area.rawValue)", name: area.name, palette: area.orb, glow: area.glow,
                      display: display, level: level, live: area.live)
}

/// Boop's line in the middle of the ring: the day's verdict in a few words, or an honest stand-in while there is
/// nothing to say yet.
func kezdolapLine(_ brief: Brief?) -> String {
    guard let brief else { return "Még gyűjtöm a mai képet" }
    let headline = maiCopy(brief, .forma).headline
    return headline.isEmpty ? "Még gyűjtöm a mai képet" : headline
}
