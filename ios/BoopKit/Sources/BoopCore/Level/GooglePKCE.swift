import Foundation
import CryptoKit

/// Google sign-in on the phone (mezo-r36n9.39, spec §12.2): the pure parts. PKCE (RFC 7636, S256), the authorisation
/// URL, the redirect scheme derived from the iOS client id, and the callback parser. The browser session itself is
/// `Boop/Level/GoogleSignIn.swift`; the one-time code goes to the server, which keeps the refresh token — **nothing
/// from Google is ever stored on the phone**.
public enum GooglePKCE {
    /// 64 random bytes → 86 URL-safe characters (the RFC allows 43–128).
    public static func makeVerifier() -> String {
        var rng = SystemRandomNumberGenerator()
        let bytes = (0..<64).map { _ in UInt8.random(in: .min ... .max, using: &rng) }
        return base64URL(Data(bytes))
    }

    /// `BASE64URL(SHA256(verifier))`, no padding.
    public static func challenge(for verifier: String) -> String {
        base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
    }

    /// The anti-forgery `state`: 16 random bytes, URL-safe.
    public static func makeState() -> String {
        var rng = SystemRandomNumberGenerator()
        return base64URL(Data((0..<16).map { _ in UInt8.random(in: .min ... .max, using: &rng) }))
    }

    static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

public enum GoogleAuth {
    public static let authEndpoint = "https://accounts.google.com/o/oauth2/v2/auth"
    public static let scope = "openid email https://www.googleapis.com/auth/gmail.readonly"
    public static let redirectPath = "/oauth2redirect"

    /// `NNN-xxx.apps.googleusercontent.com` → `com.googleusercontent.apps.NNN-xxx`; nil for anything else.
    public static func redirectScheme(clientId: String) -> String? {
        let suffix = ".apps.googleusercontent.com"
        guard clientId.hasSuffix(suffix) else { return nil }
        let prefix = String(clientId.dropLast(suffix.count))
        guard !prefix.isEmpty, prefix.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else { return nil }
        return "com.googleusercontent.apps.\(prefix)"
    }

    public static func redirectURI(clientId: String) -> String? {
        redirectScheme(clientId: clientId).map { "\($0):\(redirectPath)" }
    }

    public static func authURL(clientId: String, challenge: String, state: String) -> URL? {
        guard let redirect = redirectURI(clientId: clientId), var c = URLComponents(string: authEndpoint) else { return nil }
        c.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirect),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: scope),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "prompt", value: "consent"),
            URLQueryItem(name: "access_type", value: "offline"),
        ]
        // URLComponents leaves "+" and ":" alone in values; Google reads "+" as a space, so encode it explicitly.
        c.percentEncodedQuery = c.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
        return c.url
    }

    public enum CallbackError: Error, Equatable, Sendable {
        /// He said no on Google's screen (`error=access_denied`) or closed it.
        case denied
        case stateMismatch
        case missingCode
        /// Google answered with some other `error=`.
        case other(String)
    }

    /// The code from the redirect, or why there is none.
    public static func parseCallback(url: URL, expectedState: String) -> Result<String, CallbackError> {
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func value(_ n: String) -> String? { items.first { $0.name == n }?.value }
        if let error = value("error") { return .failure(error == "access_denied" ? .denied : .other(error)) }
        guard value("state") == expectedState else { return .failure(.stateMismatch) }
        guard let code = value("code"), !code.isEmpty else { return .failure(.missingCode) }
        return .success(code)
    }
}
