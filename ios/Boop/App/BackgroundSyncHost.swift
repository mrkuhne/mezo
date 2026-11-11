import Foundation
import BoopCore

/// One `HealthSync` per signed-in user, shared by the UI (`HealthLink`) and a background launch, so a wake
/// and a foreground refresh never run two pipelines side by side (HealthSync joins an in-flight run).
/// Also remembers the last signed-in user id: a background launch has no `Session`, only the keychain
/// token and this id.
@MainActor
enum BackgroundSyncHost {
    private static let userKey = "boop.lastUserId"
    private static var cached: (userId: UUID, sync: HealthSync)?

    static var lastUserId: UUID? { UserDefaults.standard.string(forKey: userKey).flatMap(UUID.init(uuidString:)) }
    static func remember(userId: UUID) { UserDefaults.standard.set(userId.uuidString, forKey: userKey) }
    static func forget() { UserDefaults.standard.removeObject(forKey: userKey); cached = nil }

    /// The user's sync engine; `make` builds it the first time.
    static func sync(userId: UUID, make: () -> HealthSync) -> HealthSync {
        if let cached, cached.userId == userId { return cached.sync }
        let s = make()
        cached = (userId, s)
        return s
    }

    /// The wake-up work: sync as the remembered user with the keychain token, or false when nobody is signed in.
    static func syncIncremental() async -> Bool {
        let tokens = KeychainTokenStore()
        guard tokens.read() != nil, let userId = lastUserId else { return false }
        let sync = sync(userId: userId) {
            HealthSync(client: makeClient(tokens: tokens), health: HealthKitReader(), calendar: CalendarKitReader(), userId: userId)
        }
        return await sync.syncIncremental()
    }
}
