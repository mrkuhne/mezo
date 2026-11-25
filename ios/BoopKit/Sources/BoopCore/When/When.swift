import Foundation

// The "Mikor" row's pure rules (`mezo-r36n9.159`, spec §3.1): a capture can be dated today or any of the previous six
// days, never the future; the resolved day is said in the owner's words; a toast names the day when it is not today.

/// What the owner picked on the row: now (the default), yesterday, or a moment of his own.
public enum WhenChoice: Equatable, Sendable {
    case now
    case yesterday
    case other(Date)
}

/// The earliest moment a capture may be dated: the start of the day six days before `now`'s day.
public func whenEarliest(now: Date, calendar: Calendar) -> Date {
    let start = calendar.startOfDay(for: now)
    return calendar.date(byAdding: .day, value: -6, to: start) ?? start
}

/// `date` pulled into `earliest…now`.
public func whenClamp(_ date: Date, now: Date, calendar: Calendar) -> Date {
    min(now, max(whenEarliest(now: now, calendar: calendar), date))
}

/// The moment a choice stands for: now itself, yesterday at the same time, or the owner's moment — the last two clamped.
public func whenResolved(_ choice: WhenChoice, now: Date, calendar: Calendar) -> Date {
    switch choice {
    case .now: return now
    case .yesterday:
        let y = calendar.date(byAdding: .day, value: -1, to: now) ?? now
        return whenClamp(y, now: now, calendar: calendar)
    case .other(let date): return whenClamp(date, now: now, calendar: calendar)
    }
}

/// `yyyy-MM-dd` of a moment in the calendar's own zone — the day key the ledger and the outbox use.
public func whenDayString(_ date: Date, calendar: Calendar) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

/// The resolved moment in the owner's words. Day form: „ma" · „tegnap" · „nov. 22. · szombat". Time form: „most" ·
/// „tegnap · 13:11" · „ma · 08:15" · „nov. 22. · 08:15".
public func whenLabel(_ choice: WhenChoice, now: Date, withTime: Bool, calendar: Calendar,
                      locale: Locale = Locale(identifier: "hu_HU")) -> String {
    if case .now = choice { return withTime ? "most" : "ma" }
    let date = whenResolved(choice, now: now, calendar: calendar)
    let relative = whenRelativeDay(date, now: now, calendar: calendar)
    if withTime {
        let time = whenFormat("HH:mm", date, calendar: calendar, locale: locale)
        return "\(relative ?? whenFormat("MMM d.", date, calendar: calendar, locale: locale)) · \(time)"
    }
    if let relative { return relative }
    return "\(whenFormat("MMM d.", date, calendar: calendar, locale: locale)) · \(whenFormat("EEEE", date, calendar: calendar, locale: locale))"
}

/// The sheet's success line, naming the day when it is not today: „Súly 81,4 kg rögzítve · tegnap".
public func whenToast(_ base: String, choice: WhenChoice, now: Date, calendar: Calendar,
                      locale: Locale = Locale(identifier: "hu_HU")) -> String {
    if case .now = choice { return base }
    let date = whenResolved(choice, now: now, calendar: calendar)
    if calendar.isDate(date, inSameDayAs: now) { return base }
    if let relative = whenRelativeDay(date, now: now, calendar: calendar) { return "\(base) · \(relative)" }
    return "\(base) · \(whenFormat("MMM d.", date, calendar: calendar, locale: locale))"
}

/// „ma" / „tegnap" for a moment on today's or yesterday's day; nil otherwise.
private func whenRelativeDay(_ date: Date, now: Date, calendar: Calendar) -> String? {
    if calendar.isDate(date, inSameDayAs: now) { return "ma" }
    if let y = calendar.date(byAdding: .day, value: -1, to: now), calendar.isDate(date, inSameDayAs: y) { return "tegnap" }
    return nil
}

private func whenFormat(_ pattern: String, _ date: Date, calendar: Calendar, locale: Locale) -> String {
    let f = DateFormatter()
    f.calendar = calendar; f.timeZone = calendar.timeZone; f.locale = locale; f.dateFormat = pattern
    return f.string(from: date)
}

/// The Alvás sheet's line under the row when a past morning is chosen: the server keeps a night Health already
/// measured and takes only the owner's own rating (`SleepNightMerge`). nil for today's morning.
public func whenSleepNote(_ choice: WhenChoice) -> String? {
    if case .now = choice { return nil }
    return "Ha az órád már mérte ezt az éjszakát, csak a minősítésed kerül mellé."
}
