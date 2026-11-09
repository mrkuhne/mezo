import Foundation

/// Sign-in / register input with the contract's rules (api/openapi.yml RegisterRequest, LoginRequest).
struct AuthForm: Equatable {
    enum Field: Int, Comparable { case invite, email, password, name
        static func < (a: Field, b: Field) -> Bool { a.rawValue < b.rawValue }
    }
    var invite = "", email = "", password = "", name = ""

    var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    var trimmedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }
    var trimmedInvite: String { invite.trimmingCharacters(in: .whitespacesAndNewlines) }

    func problems(register: Bool) -> [Field: String] {
        var p: [Field: String] = [:]
        if !Self.looksLikeEmail(trimmedEmail) { p[.email] = "Ez nem tűnik e-mail címnek." }
        if register {
            if trimmedInvite.isEmpty || trimmedInvite.count > 32 { p[.invite] = "Írd be a meghívókódot." }
            if password.count < 8 { p[.password] = "Legalább 8 karakter legyen." }
            else if password.count > 72 { p[.password] = "Legfeljebb 72 karakter lehet." }
            if trimmedName.isEmpty || trimmedName.count > 120 { p[.name] = "Írd be a neved." }
        } else if password.isEmpty {
            p[.password] = "Írd be a jelszavad."
        }
        return p
    }

    /// One `@`, something before it, and a dot after it with text on both sides.
    static func looksLikeEmail(_ s: String) -> Bool {
        let parts = s.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, !s.contains(" ") else { return false }
        let host = parts[1].split(separator: ".", omittingEmptySubsequences: false)
        return host.count >= 2 && host.allSatisfy { !$0.isEmpty }
    }
}
