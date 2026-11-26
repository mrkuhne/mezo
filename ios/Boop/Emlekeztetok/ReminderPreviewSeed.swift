#if DEBUG
import BoopCore
import Foundation

/// Simulator review only: `-reminders page|edit|edit-linked|denied` and `-previewMaReminders YES` fill the preview user's
/// reminder store with the spike's sample reminders (invented ones; nothing reaches AlarmKit or the notification centre).
@MainActor
enum ReminderPreviewSeed {
    static var flag: String? { UserDefaults.standard.string(forKey: "reminders") }
    static var wanted: Bool { flag != nil || UserDefaults.standard.bool(forKey: "previewMaReminders") }
    /// The flags that open the page itself (the Ma one only seeds).
    static var opensPage: Bool { flag != nil }

    static func seed(now: Date = Date(), calendar: Calendar = .current) {
        guard let store = ReminderHub.store else { return }
        for r in store.file.reminders { store.delete(r.id) }
        let today = ReminderPlanner.dayString(now, calendar: calendar)
        let later = ReminderPlanner.dayString(calendar.date(byAdding: .day, value: 6, to: now) ?? now, calendar: calendar)
        let vitamin = Reminder(title: "Vitamin", hour: 8, minute: 0, repeats: .daily, strength: .alarm, link: .supplement(daypart: "breakfast"))
        let magnesium = Reminder(title: "Esti magnézium", hour: 21, minute: 0, repeats: .daily, strength: .alarm)
        let water = Reminder(title: "Igyál egy pohár vizet", hour: 7, minute: 0, repeats: .weekdays([1, 2, 3, 4, 5]), strength: .notification)
        let stretch = Reminder(title: "Nyújtás", hour: 18, minute: 30, repeats: .weekdays([2, 4]), strength: .notification, enabled: false)
        let dentist = Reminder(title: "Hívd fel a fogorvost", hour: 13, minute: 0, repeats: .once(today), strength: .notification)
        let blood = Reminder(title: "Vérvétel — éhgyomorra", hour: 9, minute: 30, repeats: .once(later), strength: .alarm)
        for r in [vitamin, magnesium, water, stretch, dentist, blood] { store.upsert(r) }
        store.tick("\(water.id.uuidString)|\(today)")
    }
}
#endif
