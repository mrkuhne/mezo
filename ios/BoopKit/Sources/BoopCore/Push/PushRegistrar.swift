import Foundation
import Security
import OSLog
import OpenAPIRuntime
import BoopAPI

/// A stable per-install id for this device (kept across sign-ins; sent with the APNs token).
public protocol DeviceIdStore: Sendable {
    func deviceId() -> UUID
}

/// The id in the Keychain, readable after the first unlock (a background launch needs it).
public struct KeychainDeviceIdStore: DeviceIdStore {
    let service = "io.mrkuhne.boop"
    let account = "apns-device-id"
    public init() {}

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }
    public func deviceId() -> UUID {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        if SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data,
           let s = String(data: d, encoding: .utf8), let id = UUID(uuidString: s) { return id }
        let id = UUID()
        var add = query
        add[kSecValueData as String] = Data(id.uuidString.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
        return id
    }
}

/// In-memory fake for tests; share one instance between registrars to model "the same keychain".
public final class MemoryDeviceIdStore: DeviceIdStore, @unchecked Sendable {
    private let lock = NSLock()
    private var id: UUID?
    public init(_ id: UUID? = nil) { self.id = id }
    public func deviceId() -> UUID { lock.withLock { if let id { return id }; let n = UUID(); id = n; return n } }
}

/// Tells the backend this device's APNs token (B1 plumbing — nothing is sent to the phone yet).
/// Failures are swallowed with a log: push must never block sign-in or sign-out.
public struct PushRegistrar: Sendable {
    /// The APNs environment of the build. This slice's installs are development-signed, so the app passes
    /// "sandbox"; an App Store / TestFlight build must pass "production" (the entitlement's
    /// `aps-environment` is not readable at runtime in a simple way).
    public enum Environment: String, Sendable { case sandbox, production }

    private let client: Client
    private let ids: any DeviceIdStore
    private let environment: Environment
    private let bundleId: String
    private let appVersion: String?
    private let log = Logger(subsystem: "io.mrkuhne.boop", category: "push")

    public init(client: Client, ids: any DeviceIdStore = KeychainDeviceIdStore(), environment: Environment = .sandbox,
                bundleId: String = Bundle.main.bundleIdentifier ?? "io.mrkuhne.boop",
                appVersion: String? = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) {
        self.client = client; self.ids = ids; self.environment = environment
        self.bundleId = bundleId; self.appVersion = appVersion
    }

    public static func hex(_ token: Data) -> String { token.map { String(format: "%02x", $0) }.joined() }

    @discardableResult
    public func register(token: Data) async -> Bool {
        let body = Components.Schemas.ApnsDeviceIn(
            deviceId: ids.deviceId().uuidString, token: Self.hex(token),
            environment: environment == .sandbox ? .sandbox : .production,
            bundleId: bundleId, appVersion: appVersion.map { String($0.prefix(20)) })
        do {
            switch try await client.registerApnsDevice(body: .json(body)) {
            case .noContent: return true
            default: log.error("APNs registration was refused"); return false
            }
        } catch {
            log.error("APNs registration failed: \(String(describing: type(of: error)))")
            return false
        }
    }

    /// On sign-out (the client must still carry the old token).
    @discardableResult
    public func unregister() async -> Bool {
        do {
            switch try await client.unregisterApnsDevice(path: .init(deviceId: ids.deviceId().uuidString)) {
            case .noContent: return true
            default: log.error("APNs unregistration was refused"); return false
            }
        } catch {
            log.error("APNs unregistration failed: \(String(describing: type(of: error)))")
            return false
        }
    }
}
