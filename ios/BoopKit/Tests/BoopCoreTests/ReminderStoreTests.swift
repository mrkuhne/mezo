import Foundation
import Testing
@testable import BoopCore

@MainActor
struct ReminderStoreTests {
    func tempURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("rs-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("reminders.json")
    }

    func dayString(_ offset: Int) -> String {
        let cal = Calendar.current
        let d = cal.date(byAdding: .day, value: offset, to: cal.startOfDay(for: Date()))!
        let c = cal.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    func sample() -> Reminder { Reminder(title: "Vitamin", hour: 8, minute: 0, repeats: .daily) }

    @Test func roundTripsThroughTheFile() {
        let url = tempURL()
        let r = sample()
        let a = ReminderStore(fileURL: url)
        a.upsert(r)
        a.tick("\(r.id.uuidString)|\(dayString(0))")
        var s = a.file.builtIn
        s.morning.hour = 6
        a.setBuiltIn(s)
        let b = ReminderStore(fileURL: url)
        #expect(b.file == a.file)
        #expect(b.file.reminders == [r])
        #expect(b.file.builtIn.morning.hour == 6)
    }

    @Test func tickIsIdempotent() {
        let store = ReminderStore(fileURL: tempURL())
        let key = "\(UUID().uuidString)|\(dayString(0))"
        store.tick(key)
        store.tick(key)
        #expect(store.file.done == [key])
        store.untick(key)
        #expect(store.file.done.isEmpty)
    }

    @Test func oldDoneKeysArePruned() {
        let store = ReminderStore(fileURL: tempURL())
        let id = UUID().uuidString
        store.tick("\(id)|\(dayString(-15))")
        store.tick("garbage")
        store.tick("\(id)|\(dayString(-1))")
        #expect(store.file.done == ["\(id)|\(dayString(-1))"])
    }

    @Test func missingFileStartsEmptyWithDefaults() {
        let f = ReminderStore(fileURL: tempURL()).file
        #expect(f.reminders.isEmpty && f.done.isEmpty)
        #expect(f.builtIn.morning == .init(enabled: true, hour: 7, minute: 30))
        #expect(f.builtIn.noon == .init(enabled: true, hour: 12, minute: 30))
        #expect(f.builtIn.afternoon == .init(enabled: true, hour: 16, minute: 0))
        #expect(f.builtIn.closeMinutesBeforeBed == 75)
        #expect(f.builtIn.bedtimeMinutesBefore == 30)
    }

    @Test func corruptFileStartsFromDefaults() throws {
        let url = tempURL()
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("not json".utf8).write(to: url)
        let store = ReminderStore(fileURL: url)
        #expect(store.file == ReminderFile())
        #expect(try Data(contentsOf: url) == Data("not json".utf8))
    }

    @Test func reloadSeesAnotherWriter() {
        let url = tempURL()
        let a = ReminderStore(fileURL: url)
        let b = ReminderStore(fileURL: url)
        let key = "\(UUID().uuidString)|\(dayString(0))"
        a.tick(key)
        #expect(b.file.done.isEmpty)
        b.reload()
        #expect(b.file.done == [key])
    }

    @Test func twoUsersNeverShareAFile() {
        let a = ReminderStore(fileURL: tempURL())
        let b = ReminderStore(fileURL: tempURL())
        a.upsert(sample())
        #expect(a.file.reminders.count == 1)
        #expect(b.file.reminders.isEmpty)
    }

    @Test func deleteAndLinkedLookup() {
        let store = ReminderStore(fileURL: tempURL())
        let r = Reminder(title: "Reggeli", hour: 7, minute: 30, repeats: .daily, link: .supplement(daypart: "breakfast"))
        store.upsert(r)
        #expect(store.reminder(linkedTo: "breakfast")?.id == r.id)
        #expect(store.reminder(linkedTo: "dinner") == nil)
        let before = store.changes
        store.delete(r.id)
        #expect(store.file.reminders.isEmpty)
        #expect(store.changes > before)
    }

    @Test func codableRoundTripCoversEveryCase() throws {
        let rs = [
            Reminder(title: "a", hour: 1, minute: 2, repeats: .weekdays([1, 3])),
            Reminder(title: "b", hour: 3, minute: 4, repeats: .once("2026-12-02")),
            Reminder(title: "c", hour: 5, minute: 6, repeats: .daily, link: .supplement(daypart: "breakfast")),
        ]
        let data = try JSONEncoder().encode(rs)
        #expect(try JSONDecoder().decode([Reminder].self, from: data) == rs)
    }
}
