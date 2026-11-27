import Foundation
import Testing
@testable import BoopShared

struct WidgetDayTests {
    let cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Budapest")!
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }()

    func at(_ day: String, _ hhmm: String) -> Date {
        let d = day.split(separator: "-").map { Int($0)! }, t = hhmm.split(separator: ":").map { Int($0)! }
        return cal.date(from: DateComponents(year: d[0], month: d[1], day: d[2], hour: t[0], minute: t[1]))!
    }

    func item(_ day: String, _ hhmm: String, _ title: String, hue: Int = 3) -> WidgetSnapshot.Item {
        WidgetSnapshot.Item(at: at(day, hhmm), title: title, hue: hue)
    }

    func reminder(_ day: String, _ hhmm: String, _ title: String, done: Bool = false, supplement: Bool = false) -> WidgetSnapshot.ReminderRow {
        WidgetSnapshot.ReminderRow(key: "\(title)|\(day)", day: day, at: at(day, hhmm), title: title, done: done, supplement: supplement)
    }

    var snapshot: WidgetSnapshot {
        WidgetSnapshot(writtenAt: at("2026-11-26", "07:00"), day: "2026-11-26", hasPlan: true,
                       items: [item("2026-11-26", "08:00", "Reggeli check-in"), item("2026-11-26", "12:30", "Ebéd"),
                               item("2026-11-26", "18:00", "Push nap")],
                       reminders: [reminder("2026-11-26", "08:00", "Vitamin", supplement: true),
                                   reminder("2026-11-26", "13:00", "Fogorvos"),
                                   reminder("2026-11-26", "09:00", "Víz", done: true),
                                   reminder("2026-11-27", "08:00", "Vitamin", supplement: true)])
    }

    @Test func snapshotRoundTrips() throws {
        let data = try WidgetSnapshot.encode(snapshot)
        #expect(try WidgetSnapshot.decode(data) == snapshot)
        #expect(data.count < 8_000)
    }

    @Test func pastItemsDroppedAndNextIsTheEarliestOpenThing() {
        let d = WidgetDay.make(snapshot, at: at("2026-11-26", "11:10"), calendar: cal)
        #expect(d.state == .normal)
        #expect(d.upcoming.map(\.title) == ["Ebéd", "Push nap"])
        #expect(d.next?.title == "Ebéd")
        #expect(d.nextReminder?.title == "Fogorvos")
        #expect(d.reminders.map(\.title) == ["Vitamin", "Víz", "Fogorvos"])   // today's only, clock order
    }

    @Test func anOpenReminderCanBeTheNextThing() {
        let d = WidgetDay.make(snapshot, at: at("2026-11-26", "12:45"), calendar: cal)
        #expect(d.next?.title == "Fogorvos")
        #expect(d.next?.isReminder == true)
    }

    @Test func yesterdaySnapshotIsStaleAndShowsTodaysRemindersOnly() {
        let d = WidgetDay.make(snapshot, at: at("2026-11-27", "07:30"), calendar: cal)
        #expect(d.state == .stale)
        #expect(d.upcoming.isEmpty)
        #expect(d.reminders.map(\.title) == ["Vitamin"])
        #expect(d.next?.title == "Vitamin")
    }

    @Test func snapshotWithoutPlanIsStale() {
        var s = snapshot
        s.hasPlan = false
        let d = WidgetDay.make(s, at: at("2026-11-26", "11:10"), calendar: cal)
        #expect(d.state == .stale)
        #expect(d.upcoming.isEmpty)
        #expect(d.nextReminder?.title == "Fogorvos")
    }

    @Test func noSnapshotIsStaleAndEmpty() {
        let d = WidgetDay.make(nil, at: at("2026-11-26", "11:10"), calendar: cal)
        #expect(d.state == .stale)
        #expect(d.reminders.isEmpty)
        #expect(d.next == nil)
    }

    @Test func emptyDayShowsTomorrowFirst() {
        let d = WidgetDay.make(snapshot, at: at("2026-11-26", "19:00"), calendar: cal)
        #expect(d.state == .empty)
        #expect(d.next == nil)
        #expect(d.tomorrowFirst?.title == "Vitamin")
    }

    @Test func timelineHasAnEntryPerItemAndEndsAtMidnight() {
        let now = at("2026-11-26", "11:10")
        let dates = WidgetDay.timeline(snapshot, now: now, calendar: cal)
        #expect(dates.first == now)
        #expect(dates.contains(at("2026-11-26", "12:30")))
        #expect(dates.contains(at("2026-11-26", "13:00")))
        #expect(dates.contains(at("2026-11-26", "18:00")))
        #expect(dates.last == at("2026-11-27", "00:00"))
        #expect(dates == dates.sorted())
        #expect(Set(dates).count == dates.count)
    }

    @Test func timeLeftReadsLikeTheSpike() {
        let now = at("2026-11-26", "11:10")
        #expect(WidgetDay.timeLeft(to: at("2026-11-26", "12:30"), from: now) == "még 1 ó 20 p")
        #expect(WidgetDay.timeLeft(to: at("2026-11-26", "11:35"), from: now) == "még 25 p")
        #expect(WidgetDay.timeLeft(to: at("2026-11-26", "13:10"), from: now) == "még 2 ó")
        #expect(WidgetDay.timeLeft(to: at("2026-11-26", "11:10"), from: now) == "most")
    }
}
