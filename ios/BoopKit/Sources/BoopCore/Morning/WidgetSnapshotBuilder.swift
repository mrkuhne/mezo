import BoopShared
import Foundation

/// Builds what the widgets show (`mezo-r36n9.172`, spec §7.2) from the day's plan rows (`DayPlan.rows`) and the
/// user's reminders: today's timed plan rows, today's and tomorrow's reminder occurrences with their done state.
public enum WidgetSnapshotBuilder {
    /// `rows == nil`: the day's plan is not loaded — the widgets then show the reminders only.
    public static func make(rows: [PlanRow]?, reminders: ReminderFile, owner: String? = nil, now: Date, calendar: Calendar) -> WidgetSnapshot {
        let today = ReminderPlanner.dayString(now, calendar: calendar)
        let start = calendar.startOfDay(for: now)
        let items: [WidgetSnapshot.Item] = (rows ?? []).compactMap { row in
            guard let at = time(row.time, on: start, calendar: calendar) else { return nil }
            return WidgetSnapshot.Item(at: at, title: title(row), hue: hue(row))
        }.sorted { $0.at < $1.at }
        var occurrences: [WidgetSnapshot.ReminderRow] = []
        for offset in 0...1 {
            guard let date = calendar.date(byAdding: .day, value: offset, to: start) else { continue }
            let day = ReminderPlanner.dayString(date, calendar: calendar)
            for o in ReminderPlanner.occurrences(on: day, reminders.reminders, calendar: calendar) {
                guard let r = reminders.reminders.first(where: { $0.id == o.reminderId }) else { continue }
                let supplement: Bool = if case .supplement = r.link { true } else { false }
                occurrences.append(WidgetSnapshot.ReminderRow(key: o.key, day: day, at: o.fireAt, title: r.title,
                                                              done: reminders.done.contains(o.key), supplement: supplement))
            }
        }
        return WidgetSnapshot(writtenAt: now, owner: owner, day: today, hasPlan: rows != nil, items: items,
                              reminders: occurrences.sorted { $0.at < $1.at })
    }

    /// The short title a widget line has room for: "Ebéd · legalább 40 g fehérje" → "Ebéd".
    static func title(_ row: PlanRow) -> String {
        row.id.hasPrefix("meal-") ? String(row.title.split(separator: " · ").first ?? Substring(row.title)) : row.title
    }

    /// The sky behind the row (`BoopDesign.Hue` raw values): meals Fuel, the session Mozgás, bedtime Alvás, the
    /// evening close Pulzus, the rest Forma.
    static func hue(_ row: PlanRow) -> Int {
        if row.id.hasPrefix("meal-") { return 3 }
        switch row.id {
        case "session": return 2
        case "bedtime": return 1
        case "checkin-evening": return 4
        default: return 0
        }
    }

    static func time(_ hhmm: String, on start: Date, calendar: Calendar) -> Date? {
        let p = hhmm.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2, (0..<24).contains(p[0]), (0..<60).contains(p[1]) else { return nil }
        return calendar.date(bySettingHour: p[0], minute: p[1], second: 0, of: start)
    }
}
