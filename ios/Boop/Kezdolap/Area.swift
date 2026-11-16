import SwiftUI
import BoopCore
import BoopDesign

/// The seven life areas of the home screen's ring, clockwise from the top (owner decision 2026-11-13). Five of them
/// are the metrics Boop already carries; **Pénz** and **Levél** are planned (life-dashboard slices L4–L6) and have no
/// room yet — they sit faint in the ring and say so on tap.
enum Area: Int, CaseIterable, Identifiable {
    /// The day itself, at the top of the ring: the owner gave it its own orb on 2026-11-16 (decision #41), so
    /// the ring is eight. It is the whole day, so it leads rather than following the parts of it.
    case nap, alvas, etel, edzes, energia, forma, penz, level

    var id: Int { rawValue }

    /// The area's name in the spine vocabulary (Fuel → Étel, Mozgás → Edzés, Pulzus → Energia).
    var name: String { ["Nap", "Alvás", "Étel", "Edzés", "Energia", "Forma", "Pénz", "Levél"][rawValue] }

    /// The metric whose room this area opens; nil for the two that are not built yet.
    var hue: Hue? {
        switch self {
        case .alvas: .alvas
        case .etel: .fuel
        case .edzes: .mozgas
        case .energia: .pulzus
        case .forma: .forma
        case .nap, .penz, .level: nil
        }
    }

    /// The colour world the area's page is painted in. Pénz and Levél have one (the ring already paints their
    /// orbs) without having a metric, so their pages exist before their data does (`mezo-r36n9.57`).
    var world: Hue? {
        switch self {
        case .penz: .penz
        case .level: .level
        default: hue
        }
    }

    /// The day is live but has no metric room: it opens the day's own page instead of a drill-down.
    var live: Bool { hue != nil || self == .nap }

    /// The orb's four colours. The two planned areas borrow the palettes drawn for them in the life-dashboard
    /// design (`2026-11-13-boop-life-dashboard-design.md`): a green coin and an indigo envelope.
    var orb: [Color] {
        if let hue { return hue.orb }
        switch self {
        case .nap: return [Color(hex: 0x0A2C38), Color(hex: 0x1F7A8C), Color(hex: 0x8FD9E8), Color(hex: 0xC9F0E2)]
        case .penz: return [Color(hex: 0x0C2B1A), Color(hex: 0x2E8B57), Color(hex: 0xBFE8A8), Color(hex: 0xF2C94C)]
        default: return [Color(hex: 0x1E1A4A), Color(hex: 0x5B4BC4), Color(hex: 0xB3A8F5), Color(hex: 0x7FD8E8)]
        }
    }

    var glow: Color {
        if let hue { return hue.glow }
        switch self {
        case .nap: return Color(hex: 0x4FC3D9)
        case .penz: return Color(hex: 0x5FD08A)
        default: return Color(hex: 0x8E82F0)
        }
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

/// One ring orb from the day's brief: the area's score inside it, the liquid filled to it. An area without data (or
/// one still to be built) shows "–" and an almost empty orb.
func ringItem(_ area: Area, brief: Brief?) -> NKRingItem {
    var display = "–"
    var level = 0.12
    if area == .nap {
        // The day's orb fills with how full the day is, not with a score — there is no score for a day.
        if let full = dayFullness(brief) {
            display = "\(full)"
            level = min(1, max(0.08, Double(full) / 100))
        }
    } else if let hue = area.hue, let brief {
        let copy = maiCopy(brief, metricKey(for: hue))
        display = copy.miniValue
        level = copy.score.map { min(1, max(0.08, Double($0) / 100)) } ?? 0.12
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
