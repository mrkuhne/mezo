import Foundation
import Testing
import BoopCore
@testable import Boop

fileprivate final class CancelCenter: ReminderCenter, @unchecked Sendable {
    var cancelled: [String] = []
    func status() async -> ReminderPermission { .allowed }
    func request() async -> Bool { true }
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws {}
    func scheduleOnce(id: String, on day: DateComponents, hour: Int, minute: Int, title: String, body: String, route: String) async throws {}
    func cancel(id: String) { cancelled.append(id) }
    func isPending(id: String) async -> Bool { false }
    func pendingIds(withPrefix prefix: String) async -> [String] { [] }
    func removeDelivered(ids: [String]) {}
}

@MainActor
struct ReminderPresentationTests {
    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Budapest")!
        return c
    }
    /// 2026-11-26 (a Thursday), 10:00 in Budapest.
    private var now: Date { cal.date(from: DateComponents(year: 2026, month: 11, day: 26, hour: 10))! }
    private let day = "2026-11-26"

    @Test func todayOpenFirstDoneLast() {
        let a = Reminder(title: "Reggel", hour: 7, minute: 0, repeats: .daily)
        let b = Reminder(title: "Dél", hour: 12, minute: 0, repeats: .daily)
        let c = Reminder(title: "Este", hour: 21, minute: 0, repeats: .daily)
        let file = ReminderFile(reminders: [c, a, b], done: ["\(a.id.uuidString)|\(day)"])
        let s = reminderSections(file, now: now, calendar: cal)
        #expect(s.today.map(\.reminder.title) == ["Dél", "Este", "Reggel"])
        #expect(s.today.map(\.done) == [false, false, true])
        #expect(s.doneCount == 1)
    }

    @Test func repeatLabelsInHungarian() {
        #expect(repeatLabel(.weekdays([1, 2, 3, 4, 5])) == "H K Sz Cs P")
        #expect(repeatLabel(.weekdays([2, 4])) == "K Cs")
        #expect(repeatLabel(.weekdays([6, 7])) == "Szo V")
        #expect(repeatLabel(.weekdays(Set(1...7))) == "minden nap")
        #expect(repeatLabel(.daily) == "minden nap")
        #expect(repeatLabel(.once("2026-12-02")) == "dec. 2., szerda")
    }

    @Test func onceSectionOnlyFuture() {
        let past = Reminder(title: "Régi", hour: 9, minute: 0, repeats: .once("2026-11-20"))
        let todayOnce = Reminder(title: "Ma", hour: 13, minute: 0, repeats: .once(day))
        let later = Reminder(title: "Később", hour: 9, minute: 30, repeats: .once("2026-12-02"))
        let daily = Reminder(title: "Napi", hour: 8, minute: 0, repeats: .daily)
        let s = reminderSections(ReminderFile(reminders: [later, past, daily, todayOnce]), now: now, calendar: cal)
        #expect(s.once.map(\.title) == ["Ma", "Később"])
        #expect(s.repeating.map(\.title) == ["Napi"])
        #expect(s.today.map(\.reminder.title) == ["Napi", "Ma"])
    }

    @Test func switchedOffRepeatingStaysListedButDoesNotRingToday() {
        let off = Reminder(title: "Nyújtás", hour: 18, minute: 30, repeats: .daily, enabled: false)
        let s = reminderSections(ReminderFile(reminders: [off]), now: now, calendar: cal)
        #expect(s.repeating.map(\.title) == ["Nyújtás"])
        #expect(s.today.isEmpty)
    }

    @Test func foldHiddenWhenNothingToday() {
        let tuesdayOnly = Reminder(title: "Kedd", hour: 8, minute: 0, repeats: .weekdays([2]))
        #expect(reminderSections(ReminderFile(reminders: [tuesdayOnly]), now: now, calendar: cal).foldVisible == false)
        #expect(reminderSections(ReminderFile(), now: now, calendar: cal).foldVisible == false)
        let daily = Reminder(title: "Napi", hour: 8, minute: 0, repeats: .daily)
        #expect(reminderSections(ReminderFile(reminders: [daily]), now: now, calendar: cal).foldVisible)
    }

    @Test func expiryParsedFromProfilePlist() throws {
        let expires = Date(timeIntervalSince1970: 1_796_000_000)
        let plist: [String: Any] = ["Name": "x", "ExpirationDate": expires, "Entitlements": ["a": 1]]
        let xml = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        // the profile is a signed blob: binary junk before and after the plist
        var blob = Data([0x30, 0x82, 0x0a, 0xff, 0x00, 0x06])
        blob.append(xml)
        blob.append(Data([0x00, 0x31, 0x82, 0xfe]))
        #expect(InstallExpiry.expirationDate(inProfile: blob) == expires)
        #expect(InstallExpiry.expirationDate(inProfile: Data([1, 2, 3])) == nil)
    }

    @Test func expiryReminderIsTenTheDayBefore() throws {
        let expiry = cal.date(from: DateComponents(year: 2026, month: 12, day: 3, hour: 14))!
        let at = try #require(InstallExpiry.reminderTime(expiry: expiry, now: now, calendar: cal))
        let c = cal.dateComponents([.month, .day, .hour, .minute], from: at)
        #expect(c.month == 12 && c.day == 2 && c.hour == 10 && c.minute == 0)
        // already past: nothing to schedule
        let soon = cal.date(from: DateComponents(year: 2026, month: 11, day: 26, hour: 20))!
        #expect(InstallExpiry.reminderTime(expiry: soon, now: now, calendar: cal) == nil)
    }

    @Test func dateSuffixesFollowTheOrdinal() {
        func s(_ d: Int) -> String { dateWithSuffix(cal.date(from: DateComponents(year: 2026, month: 12, day: d, hour: 12))!, calendar: cal) }
        #expect(s(1) == "dec. 1-jén" && s(2) == "dec. 2-án" && s(3) == "dec. 3-án" && s(4) == "dec. 4-én")
        #expect(s(10) == "dec. 10-én" && s(20) == "dec. 20-án" && s(22) == "dec. 22-én" && s(23) == "dec. 23-án")
    }

    @Test func footerLines() {
        let expiry = cal.date(from: DateComponents(year: 2026, month: 12, day: 3, hour: 14))!
        let until = cal.date(from: DateComponents(year: 2026, month: 12, day: 2, hour: 9))!
        let f = ReminderFooter.build(expiry: expiry, horizon: ArmHorizon(alarms: until, notifications: nil), now: now, calendar: cal)
        #expect(f.lines == ["Az ébresztők néma módban és fókuszban is szólnak.",
                            "A telepítés dec. 3-án lejár — előtte egy nappal szólok.",
                            "Előre beállítva: dec. 2-ig"])
        #expect(ReminderFooter.build(expiry: nil, horizon: ArmHorizon(), now: now, calendar: cal).lines.count == 1)
    }

    // MARK: an honest horizon and the cap (final review I5)

    @Test func alarmsAndNotificationsTellTheirOwnHorizon() {
        let alarms = cal.date(from: DateComponents(year: 2026, month: 12, day: 2, hour: 8))!
        let notes = cal.date(from: DateComponents(year: 2026, month: 11, day: 28, hour: 9))!
        let f = ReminderFooter.build(expiry: nil, horizon: ArmHorizon(alarms: alarms, notifications: notes), now: now, calendar: cal)
        #expect(f.lines.last == "Előre beállítva: az ébresztők dec. 2-ig, az értesítések nov. 28-ig")
        let onlyNotes = ReminderFooter.build(expiry: nil, horizon: ArmHorizon(alarms: nil, notifications: notes), now: now, calendar: cal)
        #expect(onlyNotes.lines.last == "Előre beállítva: nov. 28-ig")
    }

    @Test func aRemovedGroupsReminderIsSaid() {
        #expect(removedNotice(["Este"]) == "Töröltem az emlékeztetőt: „Este” — ez a kiegészítő-csoport már nincs meg.")
        #expect(removedNotice(["Este", "Reggel"]) == "Töröltem ezeket az emlékeztetőket: „Este”, „Reggel” — a kiegészítő-csoportjuk már nincs meg.")
    }

    @Test func todaysOverflowIsSaidOnThePage() {
        let f = ReminderFooter.build(expiry: nil, horizon: ArmHorizon(), todayOverflow: true, now: now, calendar: cal)
        #expect(f.warning == ReminderFooter.overflowWarning)
        #expect(ReminderFooter.build(expiry: nil, horizon: ArmHorizon(), now: now, calendar: cal).warning == nil)
    }

    @Test func draftRoundTripsAndValidates() {
        var d = ReminderDraft()
        #expect(!d.canSave)
        d.title = "  Esti magnézium "
        d.hour = 21; d.minute = 0
        #expect(d.canSave)
        // a day chip on „Minden nap" turns it into a weekday set without that day
        d.toggle(day: 3)
        #expect(d.mode == .weekdays && d.days == [1, 2, 4, 5, 6, 7])
        d.toggle(day: 3)
        #expect(d.mode == .daily)
        d.mode = .weekdays; d.days = []
        #expect(!d.canSave)
        d.mode = .once
        d.onceDate = cal.date(from: DateComponents(year: 2026, month: 12, day: 2, hour: 12))!
        let r = d.reminder(calendar: cal)
        #expect(r.title == "Esti magnézium" && r.repeats == .once("2026-12-02") && r.strength == .alarm && r.note == nil)
        #expect(ReminderDraft(r, calendar: cal).reminder(calendar: cal) == r)
    }

    @Test func linkedDraftNeedsNoTitle() {
        let r = Reminder(title: "Reggel", hour: 8, minute: 0, repeats: .daily, strength: .alarm, link: .supplement(daypart: "breakfast"))
        var d = ReminderDraft(r, calendar: cal)
        d.title = ""
        #expect(d.isLinked && d.canSave)
    }

    @Test func routeIgnoresTheQuery() {
        #expect(ReminderRoute(route: "boop://emlekeztetok") == .page)
        #expect(ReminderRoute(route: "boop://emlekeztetok?key=abc|2026-11-26") == .page)
        #expect(ReminderRoute(route: "boop://este") == nil)
    }

    @Test func pageTickOfALinkedReminderAlsoTakesTheSupplement() async {
        let store = ReminderStore(fileURL: FileManager.default.temporaryDirectory.appendingPathComponent("rpt-\(UUID().uuidString)/r.json"))
        let r = Reminder(title: "Reggel", hour: 8, minute: 0, repeats: .daily, strength: .alarm, link: .supplement(daypart: "breakfast"))
        store.upsert(r)
        let center = CancelCenter()
        var taken: [String] = []
        var refreshed = 0
        // the page's tick runs `ReminderActions.done` (the alarm button's path): tick + supplement + snooze cancel + re-arm
        await ReminderActions.done(key: "\(r.id.uuidString)|2026-11-26", store: store, supplement: { taken.append($0.daypart) },
                                   center: center, refresh: { refreshed += 1 })
        #expect(store.file.done.contains("\(r.id.uuidString)|2026-11-26"))
        #expect(taken == ["breakfast"])
        #expect(center.cancelled == ["\(ReminderActions.snoozePrefix)\(r.id.uuidString)"])
        #expect(refreshed == 1)
        // an open-again tap stays reminder-only
        let row = TodayRow(reminder: r, key: "\(r.id.uuidString)|2026-11-26", done: true)
        ReminderActions.toggleTick(row, store: store)
        #expect(store.file.done.isEmpty && taken.count == 1)
    }

    @Test func onlyAReminderChangeMayAskForPermission() {
        let a = Reminder(title: "A", hour: 8, minute: 0, repeats: .daily)
        var b = a
        b.strength = .alarm
        #expect(shouldAskPermission(previous: [a], now: [a]) == false)   // a tick or a built-in setting
        #expect(shouldAskPermission(previous: [a], now: [b]))
        #expect(shouldAskPermission(previous: [], now: [a]))
        #expect(shouldAskPermission(previous: nil, now: [a]) == false)
    }
}
