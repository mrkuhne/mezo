import BoopCore
import Foundation

/// Az bejelentkezett felhasználó emlékeztető-tárának és ütemezőjének app-szintű elérési pontja (a RootView állítja be és
/// törli be-/kijelentkezéskor). Amíg nincs tár, a beépített emlékeztetők az alapértékekkel dolgoznak.
@MainActor
enum ReminderHub {
    static var store: ReminderStore?
    static var scheduler: ReminderScheduler?
    /// The workout's "rest is over" signal (vibrate or alarm), built with the scheduler and cleared with it.
    static var restEnd: RestEndSignal?
    private static var userId: UUID?
    /// The key the per-user settings that live outside the reminders file hang on (`boop.restEnd.<userKey>`).
    static var userKey: String? { userId?.uuidString }

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

    /// What one user's reminders are made of.
    struct Parts {
        let store: ReminderStore
        let alarms: AlarmScheduling
        let center: ReminderCenter
        let book: AlarmIdBook
    }

    /// Test seam: the parts of one user's reminders.
    static func activate(for id: UUID, make: (UUID) -> Parts) {
        if userId == id, store != nil { return }
        // A headless scheduler (an alarm button pressed before the UI came up, a cold background wake) may still be
        // re-arming: it is retired, and everything below starts after its queued work.
        let headless = HeadlessContext.handOver()
        // A switch: the old family is cleared first; the new scheduler's first refresh queues behind that clear.
        scheduler?.retire()
        let handoff: Task<Void, Never>? = scheduler.map { old in Task { await headless?.value; await old.signedOut() } } ?? headless
        let p = make(id)
        let (s, alarms, center) = (p.store, p.alarms, p.center)
        store = s
        scheduler = ReminderScheduler(store: s, alarms: alarms, center: center, book: p.book, startingAfter: handoff)
        let key = id.uuidString
        if let old = restEnd { Task { await old.signedOut() } }
        restEnd = RestEndSignal(alarms: alarms, center: center, mode: { RestEndMode.load(userKey: key) })
        userId = id
    }

    private static func liveParts(_ id: UUID) -> Parts {
        let url: URL
        let alarms: AlarmScheduling
        #if DEBUG
        if UserDefaults.standard.string(forKey: "preview") != nil {
            url = FileManager.default.temporaryDirectory.appendingPathComponent("boop-preview-reminders-\(id.uuidString)/reminders.json")
            alarms = NoAlarmScheduler()
        } else {
            url = RitmusEnvironment.userRoot(for: id).appendingPathComponent("reminders.json")
            alarms = SystemAlarmScheduler()
        }
        #else
        url = RitmusEnvironment.userRoot(for: id).appendingPathComponent("reminders.json")
        alarms = SystemAlarmScheduler()
        #endif
        return Parts(store: ReminderStore(fileURL: url), alarms: alarms, center: SystemReminderCenter(),
                     book: AlarmIdBook(userKey: id.uuidString))
    }

    /// Sign-out: cancels the family and forgets the store.
    static func deactivate() {
        let headless = HeadlessContext.invalidate()
        // retired at once: a refresh queued later by anyone still holding it (a press, a trigger) arms nothing
        scheduler?.retire()
        if let old = scheduler { Task { await headless?.value; await old.signedOut() } }
        if let old = restEnd { Task { await old.signedOut() } }
        restEnd = nil
        WidgetSnapshotWriter.clear()     // nothing of the account stays on the Home or Lock Screen
        store = nil
        scheduler = nil
        userId = nil
    }
}
