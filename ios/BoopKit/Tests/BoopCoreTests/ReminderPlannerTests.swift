import Foundation
import Testing
@testable import BoopCore

struct ReminderPlannerTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Budapest")!
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }()

    /// 2026-11-25 is a Wednesday.
    func at(_ day: String, _ h: Int, _ m: Int = 0) -> Date {
        let p = day.split(separator: "-").compactMap { Int($0) }
        return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: h, minute: m))!
    }

    func reminder(_ h: Int = 8, _ m: Int = 0, _ r: ReminderRepeat = .daily, _ s: ReminderStrength = .alarm, enabled: Bool = true) -> Reminder {
        Reminder(title: "t", hour: h, minute: m, repeats: r, strength: s, enabled: enabled)
    }

    func plan(_ rs: [Reminder], now: Date, done: Set<String> = [], allowed: Bool = true) -> ReminderPlan {
        ReminderPlanner.plan(rs, done: done, now: now, calendar: cal, alarmsAllowed: allowed)
    }

    @Test func dailyExpandsSevenDaysOfAlarms() {
        let p = plan([reminder()], now: at("2026-11-25", 7))
        #expect(p.alarms.count == 7)
        #expect(p.alarms.first?.day == "2026-11-25")
        #expect(p.alarms.first?.fireAt == at("2026-11-25", 8))
    }

    @Test func pastTodayIsSkipped() {
        let p = plan([reminder()], now: at("2026-11-25", 8, 1))
        #expect(p.alarms.first?.day == "2026-11-26")
        #expect(p.alarms.count == 6)
    }

    @Test func doneOccurrenceIsSkipped() {
        let r = reminder()
        let p = plan([r], now: at("2026-11-25", 7), done: ["\(r.id.uuidString)|2026-11-25"])
        #expect(!p.alarms.contains { $0.day == "2026-11-25" })
        #expect(p.alarms.first?.day == "2026-11-26")
    }

    @Test func weekdaysOnlyOnChosenDays() {
        let p = plan([reminder(8, 0, .weekdays([1, 3]))], now: at("2026-11-25", 7))
        // Wed 25, Mon 30 within 7 days (25..Dec 1).
        #expect(p.alarms.map(\.day) == ["2026-11-25", "2026-11-30"])
    }

    @Test func onceInPastIsDropped() {
        let p = plan([reminder(8, 0, .once("2026-11-24"))], now: at("2026-11-25", 7))
        #expect(p.alarms.isEmpty && p.notifications.isEmpty)
    }

    @Test func disabledIsDropped() {
        let p = plan([reminder(enabled: false)], now: at("2026-11-25", 7))
        #expect(p.alarms.isEmpty)
    }

    @Test func notificationWindowIsThreeDaysAndCapped() {
        let ten = (0..<10).map { reminder(8 + $0 % 10, 0, .daily, .notification) }
        let p = plan(ten, now: at("2026-11-25", 0, 1))
        #expect(p.notifications.count == 24)
        #expect(!p.todayOverflow)
        #expect(p.notifications == p.notifications.sorted { $0.fireAt < $1.fireAt })
        #expect(p.notifications.first?.day == "2026-11-25")
        let thirty = (0..<30).map { _ in reminder(9, 0, .daily, .notification) }
        let q = plan(thirty, now: at("2026-11-25", 7))
        #expect(q.todayOverflow)
        #expect(q.notifications.count == 24)
    }

    @Test func alarmsFallBackToNotificationsWhenNotAllowed() {
        let p = plan([reminder()], now: at("2026-11-25", 7), allowed: false)
        #expect(p.alarms.isEmpty)
        #expect(p.notifications.count == 3)
    }

    @Test func dstWeekKeepsLocalTime() {
        let p = plan([reminder()], now: at("2027-03-25", 7))
        #expect(p.alarms.count == 7)
        #expect(Set(p.alarms.map(\.day)).count == 7)
        #expect(p.alarms.allSatisfy {
            let c = cal.dateComponents([.hour, .minute], from: $0.fireAt)
            return c.hour == 8 && c.minute == 0
        })
        #expect(p.alarms.map(\.day).contains("2027-03-28"))
    }

    @Test func midnightReminderBelongsToItsOwnDay() {
        let p = plan([reminder(0, 10)], now: at("2026-11-25", 23, 59))
        #expect(p.alarms.first?.day == "2026-11-26")
        #expect(p.alarms.first?.fireAt == at("2026-11-26", 0, 10))
    }
}
