import Foundation
import Security

/// TEMPORARY free-team probe (`mezo-r36n9.172` Task 11, spec §7.1): can the app and the widget extension share the
/// App Group container and a Keychain item? The app writes both on launch; the probe widget reads them and also
/// writes its verdict into the container, so `devicectl device copy from` can read the result off the phone.
/// Removed once the probe is recorded.
enum SharedProbe {
    static let group = "group.io.mrkuhne.boop"
    private static let service = "io.mrkuhne.boop.probe"

    /// The app side.
    static func write() {
        let stamp = ISO8601DateFormatter().string(from: Date())
        var lines = ["app \(stamp)"]
        let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                   kSecAttrService as String: service, kSecAttrAccount as String: "probe"]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = Data(stamp.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        add[kSecReturnAttributes as String] = true
        var out: CFTypeRef?
        let status = SecItemAdd(add as CFDictionary, &out)
        let agroup = (out as? [String: Any])?[kSecAttrAccessGroup as String] as? String ?? "-"
        lines.append("keychain add \(status) group \(agroup)")
        lines.append("container \(dir == nil ? "nil" : "ok")")
        if let dir { try? Data(lines.joined(separator: "\n").utf8).write(to: dir.appending(path: "probe.txt"), options: .atomic) }
    }

    /// The extension side: one short line per check, also written to `probe-widget.txt` in the container.
    static func read() -> [String] {
        var lines: [String] = []
        let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
        if let dir {
            let file = (try? String(contentsOf: dir.appending(path: "probe.txt"), encoding: .utf8)) ?? "nincs fájl"
            lines.append("CSOPORT ok · " + (file.split(separator: "\n").first.map(String.init) ?? file))
        } else {
            lines.append("CSOPORT nincs")
        }
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecAttrAccount as String: "probe", kSecReturnData as String: true,
                                kSecMatchLimit as String: kSecMatchLimitOne]
        var out: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &out)
        if status == errSecSuccess, let d = out as? Data {
            lines.append("KULCS ok · " + String(decoding: d, as: UTF8.self))
        } else {
            lines.append("KULCS hiba \(status)")
        }
        if let dir {
            let stamp = ISO8601DateFormatter().string(from: Date())
            try? Data((["widget \(stamp)"] + lines).joined(separator: "\n").utf8)
                .write(to: dir.appending(path: "probe-widget.txt"), options: .atomic)
        }
        return lines
    }
}
