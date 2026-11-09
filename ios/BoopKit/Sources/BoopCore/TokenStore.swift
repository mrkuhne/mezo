import Foundation
import Security

public protocol TokenStore: Sendable {
    func read() -> String?
    func write(_ token: String) throws
    func clear()
}

/// The JWT in the Keychain (generic password, this device only).
public struct KeychainTokenStore: TokenStore {
    let service = "io.mrkuhne.boop"
    let account = "jwt"
    public init() {}

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }
    public func read() -> String? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
    public func write(_ token: String) throws {
        clear()
        var q = query
        q[kSecValueData as String] = Data(token.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(q as CFDictionary, nil)
        guard status == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
    }
    public func clear() { SecItemDelete(query as CFDictionary) }
}

/// In-memory store for tests and previews.
public final class MemoryTokenStore: TokenStore, @unchecked Sendable {
    private let lock = NSLock()
    private var token: String?
    public init(_ token: String? = nil) { self.token = token }
    public func read() -> String? { lock.withLock { token } }
    public func write(_ token: String) throws { lock.withLock { self.token = token } }
    public func clear() { lock.withLock { token = nil } }
}
