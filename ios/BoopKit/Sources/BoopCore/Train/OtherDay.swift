import Foundation

// „Másik napot csinálok ma" (`mezo-r36n9.163`, owner 2026-11-25): a missed gym day is done live on another day of the
// same Mon–Sun week, through the server's cross-day start (`GET /api/train/workouts/today?templateSessionId=`).

/// The block's weekday labels, Monday first. The server writes them short („Ke", „Pé") in some places and long
/// („Kedd", „Pén") in others, so a label is matched on its first letters.
public enum TrainWeekdays {
    static let prefixes = ["Hét", "Ke", "Sze", "Csü", "Pé", "Szo", "Vas"]
    static let names = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"]
    static let adjectives = ["hétfői", "keddi", "szerdai", "csütörtöki", "pénteki", "szombati", "vasárnapi"]

    /// 0 = Monday … 6 = Sunday; nil for a label that names no weekday.
    public static func index(of label: String) -> Int? {
        label.isEmpty ? nil : prefixes.firstIndex { label.hasPrefix($0) }
    }

    /// The weekday of a `yyyy-MM-dd` day, Monday = 0; nil for a malformed day.
    public static func index(ofDate day: String, calendar: Calendar) -> Int? {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3,
              let noon = calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) else { return nil }
        return (calendar.component(.weekday, from: noon) + 5) % 7
    }

    /// „Kedd".
    public static func name(_ index: Int) -> String { names.indices.contains(index) ? names[index] : "" }
    /// „keddi".
    public static func adjective(_ index: Int) -> String { adjectives.indices.contains(index) ? adjectives[index] : "" }
}

/// One row of the „Melyik napot csinálod ma?" sheet.
public struct OtherDayChoice: Equatable, Identifiable, Sendable {
    public enum When: Equatable, Sendable { case missed, later }
    /// The template day — what the cross-day start is asked for.
    public let id: UUID
    /// „Kedd".
    public let weekday: String
    public let title: String
    public let muscle: String
    public let when: When
}

/// The week's training days he can do today instead of today's own: not today's, not already done this week, and
/// startable (an id and at least one exercise — a „Pihenő" day is not a workout). The missed ones first, the most recent first — yesterday's is the one he means — then the
/// week's later days in order.
public func otherDayChoices(days: [BlockDay], todayIndex: Int, done: Set<UUID>) -> [OtherDayChoice] {
    let open = days.compactMap { d -> (Int, OtherDayChoice)? in
        guard let id = d.id, d.exerciseCount > 0, !done.contains(id), let i = TrainWeekdays.index(of: d.day), i != todayIndex else { return nil }
        return (i, OtherDayChoice(id: id, weekday: TrainWeekdays.name(i), title: d.type, muscle: d.muscle,
                                  when: i < todayIndex ? .missed : .later))
    }
    let missed = open.filter { $0.0 < todayIndex }.sorted { $0.0 > $1.0 }
    let later = open.filter { $0.0 > todayIndex }.sorted { $0.0 < $1.0 }
    return (missed + later).map(\.1)
}

/// The template days done in a Mon–Sun week: a completed instance dated in it (whatever day it was done on — a
/// Tuesday done on Wednesday is Tuesday's), or a Napló „Megvolt" booking for it still waiting in the queue.
public func weekDoneTemplates(history: [WorkoutHistoryDay], week: (from: String, to: String),
                              queued: [WorkoutAsPlannedPayload]) -> Set<UUID> {
    let inWeek = { (day: String) in day >= week.from && day <= week.to }
    let done = history.filter { $0.status == .completed && inWeek($0.date) }.compactMap(\.templateSessionId)
    return Set(done + queued.filter { inWeek($0.date) }.map(\.templateSessionId))
}

/// Whether the plan on the Ma card is another weekday's than today's — he picked it, or it is running since.
public func isAnotherDay(_ workout: TodayWorkout, todayIndex: Int) -> Bool {
    guard workout.templateSessionId != nil, let i = workout.dayLabel.flatMap(TrainWeekdays.index(of:)) else { return false }
    return i != todayIndex
}
