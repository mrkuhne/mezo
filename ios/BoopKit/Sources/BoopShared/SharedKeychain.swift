import Foundation
import Security

/// The one place the app and the widget extension both reach on the free Apple team (`mezo-r36n9.172` probe,
/// 2026-11-27): the shared Keychain access group `<team>.io.mrkuhne.boop.shared`. The free team refuses App Groups, so
/// small data (the widget snapshot) travels as a Keychain item. Items go to the default access group — the first one in
/// each target's `keychain-access-groups`, which is the shared group in both — so no team id is needed in code.
public enum SharedKeychain {
    static let service = "io.mrkuhne.boop.shared"

    private static func query(_ account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }

    @discardableResult
    public static func write(_ data: Data, account: String) -> Bool {
        let q = query(account)
        // readable while the phone is locked (after the first unlock), as the widgets and the Lock Screen need
        let attrs: [String: Any] = [kSecValueData as String: data,
                                    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemUpdate(q as CFDictionary, attrs as CFDictionary)
        if status == errSecSuccess { return true }
        guard status == errSecItemNotFound else { return false }
        return SecItemAdd(q.merging(attrs) { $1 } as CFDictionary, nil) == errSecSuccess
    }

    public static func read(account: String) -> Data? {
        var q = query(account)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess else { return nil }
        return out as? Data
    }

    public static func delete(account: String) {
        SecItemDelete(query(account) as CFDictionary)
    }
}

/// The widget snapshot in the shared Keychain: one item, the signed-in user's (sign-out deletes it).
public enum WidgetSnapshotStore {
    static let account = "widget.snapshot"

    public static func save(_ s: WidgetSnapshot) {
        guard let data = try? WidgetSnapshot.encode(s) else { return }
        SharedKeychain.write(data, account: account)
    }

    public static func load() -> WidgetSnapshot? {
        SharedKeychain.read(account: account).flatMap { try? WidgetSnapshot.decode($0) }
    }

    public static func clear() { SharedKeychain.delete(account: account) }
}
