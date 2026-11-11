import UIKit
import OSLog
import BoopCore

/// Background plumbing (B1, mezo-r36n9.11): Health observers that wake the app, and the APNs token.
/// No UI. A background launch (Health woke the app) runs this too, before any scene exists.
final class BoopAppDelegate: NSObject, UIApplicationDelegate {
    private let log = Logger(subsystem: "io.mrkuhne.boop", category: "app-delegate")
    /// This slice's installs are development-signed; switch to .production for TestFlight / App Store builds.
    private static let apnsEnvironment: PushRegistrar.Environment = .sandbox

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        if HealthKitReader.isAvailable {
            Task { await HealthBackground.shared.registerObservers { await BackgroundSyncHost.syncIncremental() } }
        }
        let nc = NotificationCenter.default
        nc.addObserver(forName: .boopSignedIn, object: nil, queue: .main) { n in
            let id = n.userInfo?["userId"] as? UUID
            MainActor.assumeIsolated {
                if let id { BackgroundSyncHost.remember(userId: id) }
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
        nc.addObserver(forName: .boopSignedOut, object: nil, queue: .main) { n in
            let token = n.userInfo?["token"] as? String
            MainActor.assumeIsolated { BackgroundSyncHost.forget() }
            guard let token else { return }
            // The session already cleared its token, so the DELETE carries the one that was just cleared.
            let client = makeClient(tokens: MemoryTokenStore(token))
            Task { await PushRegistrar(client: client, environment: Self.apnsEnvironment).unregister() }
        }
        // Already signed in (token in the keychain): ask for the APNs token on every launch (it can change).
        if KeychainTokenStore().read() != nil { application.registerForRemoteNotifications() }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard KeychainTokenStore().read() != nil else { return }
        let client = makeClient(tokens: KeychainTokenStore())
        Task { await PushRegistrar(client: client, environment: Self.apnsEnvironment).register(token: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        log.error("remote notification registration failed: \(error.localizedDescription)")
    }
}
