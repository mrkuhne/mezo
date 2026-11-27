import BoopShared
import Foundation
import Testing
@testable import BoopCore

struct WidgetSnapshotBuilderTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Budapest")!
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }()
    var now: Date { cal.date(from: DateComponents(year: 2026, month: 11, day: 26, hour: 11, minute: 10))! }

    let rows = [
        PlanRow(id: "checkin-morning", time: "08:00", glyph: "", title: "Reggeli check-in", sub: ""),
        PlanRow(id: "meal-1", time: "12:30", glyph: "", title: "Ebéd · legalább 40 g fehérje", sub: ""),
        PlanRow(id: "session", time: "", glyph: "", title: "Push nap", sub: ""),
        PlanRow(id: "bedtime", time: "22:30", glyph: "", title: "Lefekvés", sub: ""),
    ]

    @Test func timedRowsBecomeItemsWithShortTitlesAndHues() {
        let s = WidgetSnapshotBuilder.make(rows: rows, reminders: ReminderFile(), now: now, calendar: cal)
        #expect(s.day == "2026-11-26")
        #expect(s.hasPlan)
        #expect(s.items.map(\.title) == ["Reggeli check-in", "Ebéd", "Lefekvés"])   // the untimed session is left out
        #expect(s.items.map(\.hue) == [0, 3, 1])
    }

    @Test func remindersCarryDoneStateForTodayAndTomorrow() {
        let vit = Reminder(title: "Vitamin", hour: 8, minute: 0, repeats: .daily, strength: .alarm, enabled: true,
                           link: .supplement(daypart: "morning"))
        let dent = Reminder(title: "Fogorvos", hour: 13, minute: 0, repeats: .once("2026-11-26"), strength: .notification,
                            enabled: true, link: .none)
        let todayKey = "\(vit.id.uuidString)|2026-11-26"
        let file = ReminderFile(reminders: [vit, dent], done: [todayKey])
        let s = WidgetSnapshotBuilder.make(rows: nil, reminders: file, now: now, calendar: cal)
        #expect(!s.hasPlan)
        #expect(s.reminders.map(\.title) == ["Vitamin", "Fogorvos", "Vitamin"])
        #expect(s.reminders.map(\.day) == ["2026-11-26", "2026-11-26", "2026-11-27"])
        #expect(s.reminders.map(\.done) == [true, false, false])
        #expect(s.reminders[0].supplement && !s.reminders[1].supplement)
        #expect(s.reminders[0].key == todayKey)
    }
}
