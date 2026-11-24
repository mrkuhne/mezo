import Foundation

/// What a day's sheet offers to catch up (`mezo-r36n9.159`, spec §3.4): on today only the check-in moments already
/// passed and not done (the morning forgotten at eleven); on a past day inside the week every missing moment, the
/// close when the day has none, and the gym day when the weekday has a template day with no completed instance that
/// date. Outside the week — or in the future — nothing.
public struct NaploCatchUps: Equatable, Sendable {
    public let missingMoments: [CheckInMoment]
    public let canClose: Bool
    public let gymTemplateId: UUID?
    public let gymTitle: String?

    public static let nothing = NaploCatchUps(missingMoments: [], canClose: false, gymTemplateId: nil, gymTitle: nil)

    public var isEmpty: Bool { missingMoments.isEmpty && !canClose && gymTemplateId == nil }

    public static func compute(date: String, today: String, now: Date, checkIns: [LedgerCheckIn], closed: Bool,
                               templateDay: (id: UUID, title: String)?, completedThatDay: Bool,
                               calendar: Calendar) -> NaploCatchUps {
        let earliest = NaploDays.range(endingOn: today, count: 7).from
        guard date >= earliest, date <= today else { return .nothing }
        let done = Set(checkIns.map(\.slot))
        let all = CheckInMoment.allCases
        let candidates: [CheckInMoment]
        if date == today {
            // The same boundaries as the live flow (`moment(at:)`): a moment is passed once the clock is in a later one.
            let current = CheckInMoment.moment(at: now, calendar: calendar)
            let index = all.firstIndex(of: current) ?? 0
            candidates = Array(all.prefix(index))
        } else {
            candidates = all
        }
        let missing = candidates.filter { !done.contains($0.slotId) }
        if date == today {
            return NaploCatchUps(missingMoments: missing, canClose: false, gymTemplateId: nil, gymTitle: nil)
        }
        let gym = (templateDay != nil && !completedThatDay) ? templateDay : nil
        return NaploCatchUps(missingMoments: missing, canClose: !closed, gymTemplateId: gym?.id, gymTitle: gym?.title)
    }
}

/// `yyyy-MM-dd` → that day at noon in the calendar's zone; nil for anything else.
func naploNoon(_ day: String, calendar: Calendar) -> Date? {
    let p = day.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return nil }
    return calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12))
}

/// The catch-up's eyebrow (spec §3.5): „PÓTLÁS · TEGNAP · DÉL" · „PÓTLÁS · MA · REGGEL" · „PÓTLÁS · NOV. 22. · DÉLUTÁN".
public func catchUpLabel(date: String, moment: CheckInMoment, today: String, calendar: Calendar,
                         locale: Locale = Locale(identifier: "hu_HU")) -> String {
    let dayWord: String
    if date == today {
        dayWord = "MA"
    } else if let t = naploNoon(today, calendar: calendar), let d = naploNoon(date, calendar: calendar),
              let y = calendar.date(byAdding: .day, value: -1, to: t), calendar.isDate(d, inSameDayAs: y) {
        dayWord = "TEGNAP"
    } else if let d = naploNoon(date, calendar: calendar) {
        let f = DateFormatter()
        f.calendar = calendar; f.timeZone = calendar.timeZone; f.locale = locale; f.dateFormat = "MMM d."
        dayWord = f.string(from: d).uppercased(with: locale)
    } else {
        dayWord = date
    }
    return "PÓTLÁS · \(dayWord) · \(moment.catchUpName)"
}

/// A past day's close is stamped at nine in the evening (spec §3.5), so the evening energy dot sits in the evening.
public func esteCatchUpInstant(on day: String, calendar: Calendar) -> Date? {
    let p = day.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return nil }
    return calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 21, minute: 0))
}
