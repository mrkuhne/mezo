import AuthenticationServices
import UIKit
import BoopCore

/// The browser step of "Belépés Google-lel" (mezo-r36n9.39, spec §12.2): an `ASWebAuthenticationSession` with PKCE
/// against the server's iOS OAuth client. `ASWebAuthenticationSession` catches the custom redirect scheme itself, so
/// no URL type is registered in the project. No Google SDK. What comes back is a one-time code and its verifier —
/// both go to the server at once and are forgotten; no token ever exists on the phone.
@MainActor
final class GoogleSignIn: NSObject, ASWebAuthenticationPresentationContextProviding {
    enum Result: Equatable {
        case code(String, verifier: String, redirectUri: String)
        /// He closed the sheet or said no on Google's screen — not an error line.
        case cancelled
        /// The redirect was wrong (state mismatch, no code) or the sheet could not open.
        case failed
    }

    private var session: ASWebAuthenticationSession?

    func signIn(clientId: String) async -> Result {
        guard let scheme = GoogleAuth.redirectScheme(clientId: clientId),
              let redirectUri = GoogleAuth.redirectURI(clientId: clientId) else { return .failed }
        let verifier = GooglePKCE.makeVerifier()
        let state = GooglePKCE.makeState()
        guard let url = GoogleAuth.authURL(clientId: clientId, challenge: GooglePKCE.challenge(for: verifier), state: state)
        else { return .failed }
        return await withCheckedContinuation { (cont: CheckedContinuation<Result, Never>) in
            let s = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callback, error in
                guard let callback else {
                    let cancelled = (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin
                    cont.resume(returning: cancelled ? .cancelled : .failed)
                    return
                }
                switch GoogleAuth.parseCallback(url: callback, expectedState: state) {
                case .success(let code): cont.resume(returning: .code(code, verifier: verifier, redirectUri: redirectUri))
                case .failure(.denied): cont.resume(returning: .cancelled)
                case .failure: cont.resume(returning: .failed)
                }
            }
            s.presentationContextProvider = self
            s.prefersEphemeralWebBrowserSession = false
            self.session = s
            if !s.start() { cont.resume(returning: .failed) }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap(\.windows)
        return windows.first(where: \.isKeyWindow) ?? windows.first ?? ASPresentationAnchor()
    }
}
