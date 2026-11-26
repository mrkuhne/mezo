import BoopCore
import Foundation

/// Az bejelentkezett felhasználó emlékeztető-tárának és ütemezőjének app-szintű elérési pontja (a RootView állítja be és
/// törli be-/kijelentkezéskor). Amíg nincs tár, a beépített emlékeztetők az alapértékekkel dolgoznak.
@MainActor
enum ReminderHub {
    static var store: ReminderStore?
    static var scheduler: ReminderScheduler?
    private static var userId: UUID?

    /// Builds this user's store and scheduler (once per user; a switch first cancels the previous user's family).
    /// Called before the user's view tree is built: `BedtimeReminder` reads the store when it is created.
    static func activate(for id: UUID) {
        if userId == id, store != nil { return }
        if let old = scheduler { Task { await old.signedOut() } }
        let url: URL
        let alarms: AlarmScheduling
        #if DEBUG
        if UserDefaults.standard.string(forKey: "preview") != nil {
            url = FileManager.default.temporaryDirectory.appendingPathComponent("boop-preview-reminders-\(id.uuidString)/reminders.json")
            alarms = NoAlarmScheduler()
        } else {
            url = RitmusEnvironment.userRoot(for: id).appendingPathComponent("reminders.json")
            alarms = SystemAlarmScheduler(userKey: id.uuidString)
        }
        #else
        url = RitmusEnvironment.userRoot(for: id).appendingPathComponent("reminders.json")
        alarms = SystemAlarmScheduler(userKey: id.uuidString)
        #endif
        let s = ReminderStore(fileURL: url)
        store = s
        scheduler = ReminderScheduler(store: s, alarms: alarms, center: SystemReminderCenter())
        userId = id
    }

    /// Sign-out: cancels the family and forgets the store.
    static func deactivate() {
        if let old = scheduler { Task { await old.signedOut() } }
        store = nil
        scheduler = nil
        userId = nil
    }
}
