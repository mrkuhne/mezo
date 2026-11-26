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
        activate(for: id, make: liveParts)
    }

    enum HubAction: Equatable { case keep, activate(UUID), deactivate }

    /// The rule: only a real sign-out stops the family. `.loading` and `.offline` (a flaky network mid-session) keep
    /// the user's alarms; another user's `.ready` switches.
    static func action(for state: Session.State, current: UUID?) -> HubAction {
        switch state {
        case .signedOut: return current == nil ? .keep : .deactivate
        case .loading, .offline: return .keep
        case .needsOnboarding(let me), .ready(let me): return current == me.id ? .keep : .activate(me.id)
        }
    }

    static func apply(_ state: Session.State) {
        switch action(for: state, current: store == nil ? nil : userId) {
        case .keep: break
        case .deactivate: deactivate()
        case .activate(let id): activate(for: id)
        }
    }

    /// Test seam: the parts of one user's reminders.
    static func activate(for id: UUID, make: (UUID) -> (ReminderStore, AlarmScheduling, ReminderCenter)) {
        if userId == id, store != nil { return }
        // A switch: the old family is cleared first; the new scheduler's first refresh queues behind that clear.
        let handoff = scheduler.map { old in Task { await old.signedOut() } }
        let (s, alarms, center) = make(id)
        store = s
        scheduler = ReminderScheduler(store: s, alarms: alarms, center: center, startingAfter: handoff)
        userId = id
    }

    private static func liveParts(_ id: UUID) -> (ReminderStore, AlarmScheduling, ReminderCenter) {
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
        return (ReminderStore(fileURL: url), alarms, SystemReminderCenter())
    }

    /// Sign-out: cancels the family and forgets the store.
    static func deactivate() {
        if let old = scheduler { Task { await old.signedOut() } }
        store = nil
        scheduler = nil
        userId = nil
    }
}
