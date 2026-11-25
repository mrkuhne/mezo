import Foundation

/// Boop's three check-in moments and the configured slot ids they write (spec §7.2), so the plan engine and the web
/// keep their keys: a capture before 10:00 is reggel (`06:30`), 10:00–14:30 délben (`10:00`), after 14:30 délután
/// (`14:00`). The phone decides by its local clock at capture. A Boop check-in never moves slot and never writes
/// `20:00` — only the evening close merge-writes that slot.
public enum CheckInMoment: String, CaseIterable, Codable, Sendable {
    case reggel, delben, delutan

    public static func moment(at date: Date, calendar: Calendar = .current) -> CheckInMoment {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        let minutes = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        if minutes < 10 * 60 { return .reggel }
        if minutes <= 14 * 60 + 30 { return .delben }
        return .delutan
    }

    /// The slot id the check-in is stored under.
    public var slotId: String {
        switch self {
        case .reggel: "06:30"
        case .delben: "10:00"
        case .delutan: "14:00"
        }
    }
}

public extension CheckInMoment {
    /// The moment's own time on a day (`yyyy-MM-dd`) — the slot's configured clock, the instant a catch-up is
    /// stamped with (`mezo-r36n9.159`, spec §3.5). nil for a malformed day.
    func time(on day: String, calendar: Calendar) -> Date? {
        let p = day.split(separator: "-").compactMap { Int($0) }
        let t = slotId.split(separator: ":").compactMap { Int($0) }
        guard p.count == 3, t.count == 2 else { return nil }
        return calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: t[0], minute: t[1]))
    }

    /// The moment's name in the catch-up eyebrow: REGGEL · DÉL · DÉLUTÁN.
    var catchUpName: String {
        switch self {
        case .reggel: "REGGEL"
        case .delben: "DÉL"
        case .delutan: "DÉLUTÁN"
        }
    }
}

