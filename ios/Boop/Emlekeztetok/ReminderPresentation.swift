import BoopCore
import Foundation
import SwiftUI
import BoopDesign

// What the reminder screens show, built from the file: the page's sections, the Hungarian labels, the edit sheet's
// draft. Pure (no views), so it is unit-tested (`ReminderPresentationTests`).

/// One occurrence of today on the page / the Ma fold.
struct TodayRow: Equatable, Identifiable {
    let reminder: Reminder
    /// `<uuid>|<yyyy-MM-dd>`, the key a tick is stored under.
    let key: String
    let done: Bool
    var id: String { key }
}

struct ReminderSections: Equatable {
    var today: [TodayRow]
    var repeating: [Reminder]
    var once: [Reminder]

    /// The Ma fold shows only when something rings today.
    var foldVisible: Bool { !today.isEmpty }
    var doneCount: Int { today.filter(\.done).count }
    var alarmCount: Int { today.filter { $0.reminder.strength == .alarm }.count }
}

/// Today's rows (open ones by time, then the done ones by time), the repeating reminders (switched off ones too) and
/// the one-offs that have not passed their day.
func reminderSections(_ file: ReminderFile, now: Date, calendar: Calendar) -> ReminderSections {
    let day = ReminderPlanner.dayString(now, calendar: calendar)
    let byId = Dictionary(file.reminders.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    let rows = ReminderPlanner.occurrences(on: day, file.reminders, calendar: calendar).compactMap { occ -> TodayRow? in
        byId[occ.reminderId].map { TodayRow(reminder: $0, key: occ.key, done: file.done.contains(occ.key)) }
    }
    func order(_ a: Reminder, _ b: Reminder) -> Bool {
        (a.hour, a.minute, a.title) < (b.hour, b.minute, b.title)
    }
    let open = rows.filter { !$0.done }.sorted { order($0.reminder, $1.reminder) }
    let done = rows.filter(\.done).sorted { order($0.reminder, $1.reminder) }

    let repeating = file.reminders.filter {
        switch $0.repeats { case .once: false; default: true }
    }.sorted(by: order)
    let once = file.reminders.compactMap { r -> (String, Reminder)? in
        if case .once(let d) = r.repeats, d >= day { return (d, r) } else { return nil }
    }.sorted { ($0.0, $0.1.hour, $0.1.minute, $0.1.title) < ($1.0, $1.1.hour, $1.1.minute, $1.1.title) }.map(\.1)
    return ReminderSections(today: open + done, repeating: repeating, once: once)
}

// MARK: - Hungarian words

private let weekdayLetters = ["H", "K", "Sz", "Cs", "P", "Szo", "V"]
private let weekdayNames = ["hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat", "vasárnap"]
private let monthShort = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]
/// The suffix of a date by its day of the month ("2-án", "4-én", "10-én"): the ordinal's vowel harmony.
private let daySuffix = ["", "-jén", "-án", "-án", "-én", "-én", "-án", "-én", "-án", "-én", "-én",
                         "-én", "-én", "-án", "-én", "-én", "-án", "-én", "-án", "-én", "-án",
                         "-én", "-én", "-án", "-én", "-én", "-án", "-én", "-án", "-én", "-án", "-én"]

/// "minden nap", "H K Sz Cs P", "dec. 2., kedd".
func repeatLabel(_ r: ReminderRepeat) -> String {
    switch r {
    case .daily: return "minden nap"
    case .weekdays(let set):
        if set.count == 7 { return "minden nap" }
        let days = set.sorted().filter { (1...7).contains($0) }.map { weekdayLetters[$0 - 1] }
        return days.isEmpty ? "nincs nap kijelölve" : days.joined(separator: " ")
    case .once(let day): return onceLabel(day) ?? day
    }
}

private func ymd(_ day: String) -> (y: Int, m: Int, d: Int)? {
    let p = day.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3, (1...12).contains(p[1]), (1...31).contains(p[2]) else { return nil }
    return (p[0], p[1], p[2])
}

/// ISO weekday (1 = Monday) of a `yyyy-MM-dd` calendar day, independent of the device zone.
private func isoWeekday(_ t: (y: Int, m: Int, d: Int)) -> Int {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "UTC")!
    guard let date = cal.date(from: DateComponents(year: t.y, month: t.m, day: t.d, hour: 12)) else { return 1 }
    return (cal.component(.weekday, from: date) + 5) % 7 + 1
}

/// "dec. 2., kedd"
func onceLabel(_ day: String) -> String? {
    guard let t = ymd(day) else { return nil }
    return "\(monthShort[t.m - 1]) \(t.d)., \(weekdayNames[isoWeekday(t) - 1])"
}

/// "dec. 3." (no weekday)
func shortDateLabel(_ date: Date, calendar: Calendar) -> String {
    let c = calendar.dateComponents([.month, .day], from: date)
    return "\(monthShort[(c.month ?? 1) - 1]) \(c.day ?? 1)."
}

/// "dec. 3-án" — a date with its Hungarian suffix.
func dateWithSuffix(_ date: Date, calendar: Calendar) -> String {
    let c = calendar.dateComponents([.month, .day], from: date)
    let d = min(max(c.day ?? 1, 1), 31)
    return "\(monthShort[(c.month ?? 1) - 1]) \(d)\(daySuffix[d])"
}

/// "8:00", "21:05"
func clockLabel(hour: Int, minute: Int) -> String { String(format: "%d:%02d", hour, minute) }

/// The second line of a row: what it repeats on, or where it is edited.
func reminderSubtitle(_ r: Reminder, today: String, inToday: Bool = false) -> String {
    if case .supplement = r.link { return inToday ? "kiegészítők" : "\(repeatLabel(r.repeats)) · a kiegészítőknél szerkeszted" }
    if case .once(let d) = r.repeats { return inToday ? "egyszeri" : (d == today ? "ma" : repeatLabel(r.repeats)) }
    return repeatLabel(r.repeats)
}

/// The page's second line: „Ma 3 emlékeztető, ebből 1 ébresztő.” (the hue marks the numbers).
func reminderSentence(_ s: ReminderSections) -> String {
    if s.today.isEmpty { return "Mára nincs emlékeztetőd." }
    let alarms = s.alarmCount
    return alarms == 0 ? "Ma *\(s.today.count)* emlékeztető." : "Ma *\(s.today.count)* emlékeztető, ebből *\(alarms)* ébresztő."
}

// MARK: - The page's footers

/// The lines under the sections: alarms ring through silent, the install's expiry, how far ahead everything is set.
struct ReminderFooter: Equatable {
    var lines: [String]

    static func build(expiry: Date?, armedUntil: Date?, now: Date, calendar: Calendar) -> ReminderFooter {
        var lines = ["Az ébresztők néma módban és fókuszban is szólnak."]
        if let expiry, expiry > now {
            lines.append("A telepítés \(dateWithSuffix(expiry, calendar: calendar)) lejár — előtte egy nappal szólok.")
        }
        if let armedUntil { lines.append("Előre beállítva: \(shortDateLabel(armedUntil, calendar: calendar).dropLast())-ig") }
        return ReminderFooter(lines: lines)
    }
}

// MARK: - Hue and defaults

enum ReminderLook {
    /// The reminder's colour: supplements are Fuel's, everything else the page's own.
    static func hue(_ r: Reminder) -> Hue {
        if case .supplement = r.link { .fuel } else { .forma }
    }

    /// The time a new supplement reminder starts at, by daypart.
    static func defaultTime(daypart: String) -> (hour: Int, minute: Int) {
        switch daypart {
        case "wake": (7, 0)
        case "breakfast", "morning": (8, 0)
        case "pre_workout": (17, 0)
        case "lunch", "midday": (12, 30)
        case "post_workout": (19, 0)
        case "dinner": (19, 30)
        case "evening": (21, 0)
        case "bedtime": (22, 0)
        case "afternoon": (15, 0)
        default: (9, 0)
        }
    }
}

// MARK: - The edit sheet's draft

/// What the edit sheet edits: a copy of a reminder (or a new one), validated and turned back into a `Reminder`.
struct ReminderDraft: Equatable {
    enum Mode: Equatable { case once, daily, weekdays }

    var id = UUID()
    var title = ""
    var note = ""
    var hour = 9
    var minute = 0
    var mode: Mode = .daily
    var days: Set<Int> = [1, 2, 3, 4, 5, 6, 7]
    var onceDate = Date()
    var strength: ReminderStrength = .alarm
    var enabled = true
    var link: ReminderLink = .none
    var isNew = true

    init() {}

    init(_ r: Reminder, calendar: Calendar) {
        id = r.id; title = r.title; note = r.note ?? ""; hour = r.hour; minute = r.minute
        strength = r.strength; enabled = r.enabled; link = r.link; isNew = false
        switch r.repeats {
        case .daily: mode = .daily
        case .weekdays(let set): mode = .weekdays; days = set
        case .once(let d):
            mode = .once
            let p = d.split(separator: "-").compactMap { Int($0) }
            if p.count == 3, let date = calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) { onceDate = date }
        }
    }

    var isLinked: Bool { if case .supplement = link { true } else { false } }
    /// Mentem works with a title (a linked reminder's title is its group's) and, on „Ezeken a napokon”, at least one day.
    var canSave: Bool {
        guard isLinked || !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        return mode != .weekdays || !days.isEmpty
    }

    /// A day chip tapped: on „Minden nap” it turns into „Ezeken a napokon” with that day off.
    mutating func toggle(day: Int) {
        if mode != .weekdays { mode = .weekdays }
        if days.contains(day) { days.remove(day) } else { days.insert(day) }
        if days.count == 7 { mode = .daily }
    }

    func reminder(calendar: Calendar) -> Reminder {
        let repeats: ReminderRepeat
        switch mode {
        case .daily: repeats = .daily
        case .weekdays: repeats = .weekdays(days)
        case .once: repeats = .once(ReminderPlanner.dayString(onceDate, calendar: calendar))
        }
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        return Reminder(id: id, title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                        note: trimmedNote.isEmpty ? nil : trimmedNote, hour: hour, minute: minute,
                        repeats: repeats, strength: strength, enabled: enabled, link: link)
    }
}

/// The page opens one of these over the shell (the notification tap, the Ma fold's „Mind”, the "+" door).
enum ReminderRoute: Identifiable, Equatable {
    case page
    /// The edit sheet for a new reminder (the "+" door).
    case new
    var id: String { self == .page ? "page" : "new" }

    /// `boop://emlekeztetok` — any query (a snooze's occurrence key) is ignored.
    init?(route: String) {
        let bare = route.split(separator: "?", maxSplits: 1).first.map(String.init) ?? route
        guard bare == ReminderScheduler.route else { return nil }
        self = .page
    }
}

/// The system's permission prompts may appear only when the owner changed a reminder (a save, a switch, a delete) —
/// never for a tick or a built-in setting.
func shouldAskPermission(previous: [Reminder]?, now: [Reminder]) -> Bool {
    guard let previous else { return false }
    return previous != now
}
