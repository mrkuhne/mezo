import Foundation
import Observation
import OpenAPIRuntime
import BoopAPI
import BoopCore

/// The signed-in user's link to Apple Health and the calendar: permission state, the sync engine,
/// and the on-open refresh (background wakes: `BoopAppDelegate` + `HealthBackground`).
@MainActor @Observable
final class HealthLink {
    let userId: UUID
    let sync: HealthSync
    private(set) var connected: Bool
    private(set) var calendarAccess: CalendarAccess = .notDetermined

    @ObservationIgnored private let health: HealthKitReader
    @ObservationIgnored private let calendar: CalendarKitReader
    @ObservationIgnored private let store: UserDefaults
    @ObservationIgnored private var lastRun: Date?
    @ObservationIgnored private var askedForNewTypes = false
    /// Foreground refreshes closer together than this are skipped.
    static let debounce: TimeInterval = 10 * 60

    init(client: Client, userId: UUID, store: UserDefaults = .standard) {
        let health = HealthKitReader(), calendar = CalendarKitReader()
        self.userId = userId; self.health = health; self.calendar = calendar; self.store = store
        self.sync = BackgroundSyncHost.sync(userId: userId) {
            HealthSync(client: client, health: health, calendar: calendar, store: store, userId: userId)
        }
        BackgroundSyncHost.remember(userId: userId)   // a background launch syncs as this user
        self.connected = store.bool(forKey: "boop.health.connected.\(userId)")
    }

    /// Asks once for Health, then for the calendar; either may be refused, the other still syncs.
    func requestPermissions() async {
        if HealthKitReader.isAvailable { try? await health.requestAuthorization() }
        calendarAccess = await calendar.requestAccess()
        connected = true
        store.set(true, forKey: "boop.health.connected.\(userId)")
    }

    /// Types added since the user connected: HealthKit says "should request" and the system sheet then lists
    /// only the new ones. Asked at most once per launch of the link.
    func requestNewTypesIfNeeded() async {
        guard connected, !askedForNewTypes, await health.needsAuthorizationRequest() else { return }
        askedForNewTypes = true
        try? await health.requestAuthorization()
    }

    func refreshCalendarAccess() async { calendarAccess = await calendar.access() }

    func syncNow() async {
        lastRun = Date()
        await sync.syncAll()
    }

    /// On app open / return to foreground.
    func syncIfStale(now: Date = Date()) async {
        guard connected else { return }
        if let lastRun, now.timeIntervalSince(lastRun) < Self.debounce { return }
        await requestNewTypesIfNeeded()
        await refreshCalendarAccess()
        lastRun = now
        await sync.syncAll()
    }

    func calendarChanged() async {
        guard connected else { return }
        await sync.syncCalendar()
    }
}

/// "Megvan: *58 éjszaka*, 60 nap mozgás és 21 edzés." — nil when Health gave nothing (no-data card).
func summaryLine(_ s: HealthSync.Summary) -> (String, String, String)? {
    guard s.nights + s.days + s.workouts > 0 else { return nil }
    return ("Megvan: ", "\(s.nights) éjszaka", ", \(s.days) nap mozgás és \(s.workouts) edzés.")
}

/// The counts as one chip for the Nap card (the row has room for two chips).
func countsChip(_ s: HealthSync.Summary) -> String {
    s.nights + s.days + s.workouts == 0 ? "nincs adat" : "\(s.nights) éjszaka · \(s.days) nap · \(s.workouts) edzés"
}

func syncErrorText(_ e: HealthSync.SyncError) -> String {
    switch e {
    case .offline: "Most nem érem el a szervert. Nézd meg a netet, és próbáld újra — amit már elküldtem, nem duplázódik."
    case .server: "Valami elakadt a szerveren. Próbáld újra egy kicsit később."
    case .unauthorized: "Lejárt a belépésed. Lépj be újra."
    }
}
