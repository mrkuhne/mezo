import Foundation
import Observation
import OpenAPIRuntime
import OpenAPIURLSession
import BoopAPI

public struct Me: Equatable, Sendable {
    public let id: UUID
    public let name: String
    public let email: String
    public let onboarded: Bool
    public let timezone: String
}

/// Who is signed in and what the app should show: sign-in, offline, onboarding or the shell.
@MainActor @Observable
public final class Session {
    public enum State: Equatable { case loading, signedOut, offline, needsOnboarding(Me), ready(Me) }

    public private(set) var state: State = .loading
    /// The authenticated client (token middleware attached); screens share it.
    public let client: Client
    @ObservationIgnored let tokens: TokenStore

    public init(tokens: TokenStore = KeychainTokenStore(), transport: any ClientTransport = makeTransport(), baseURL: URL = BoopConfig.apiBaseURL) {
        self.tokens = tokens
        self.client = makeClient(baseURL: baseURL, tokens: tokens, transport: transport)
    }

    public func bootstrap() async {
        guard tokens.read() != nil else { state = .signedOut; return }
        await loadMe()
    }

    public func retry() async {
        state = .loading
        await bootstrap()
    }

    /// Reloads the account after onboarding finished on the server.
    public func markOnboarded() async { await loadMe() }

    #if DEBUG
    /// Simulator review only (launch argument `-preview onboarding|shell`); not compiled into release builds.
    public func debugPreview(_ name: String) {
        let me = Me(id: UUID(), name: "Dani", email: "dani@pelda.hu", onboarded: name == "shell", timezone: "Europe/Budapest")
        state = name == "shell" ? .ready(me) : .needsOnboarding(me)
    }
    #endif

    public func signOut() {
        tokens.clear()
        state = .signedOut
    }

    public func signIn(email: String, password: String) async throws(AuthError) {
        let token: String
        do {
            switch try await client.login(body: .json(.init(email: email, password: password))) {
            case .ok(let ok): token = try ok.body.json.token
            case .unauthorized: throw AuthError.badCredentials
            case .badRequest(let r): throw authError(status: 400, messages: (try? r.body.json) ?? [])
            default: throw AuthError.server
            }
        } catch let e as AuthError { throw e } catch { throw isNetworkFailure(error) ? .offline : .server }
        try store(token)
        await loadMe()
    }

    public func register(invite: String, email: String, password: String, name: String) async throws(AuthError) {
        let token: String
        do {
            let body = Components.Schemas.RegisterRequest(inviteCode: invite, email: email, password: password, name: name, language: .hu)
            switch try await client.register(body: .json(body)) {
            case .ok(let ok): token = try ok.body.json.token
            case .conflict(let r): throw authError(status: 409, messages: (try? r.body.json) ?? [])
            case .badRequest(let r): throw authError(status: 400, messages: (try? r.body.json) ?? [])
            default: throw AuthError.server
            }
        } catch let e as AuthError { throw e } catch { throw isNetworkFailure(error) ? .offline : .server }
        try store(token)
        await loadMe()
    }

    private func store(_ token: String) throws(AuthError) {
        do { try tokens.write(token) } catch { throw .server }
    }

    private func loadMe() async {
        do {
            switch try await client.me() {
            case .ok(let ok):
                let m = try ok.body.json
                let me = Me(id: UUID(uuidString: m.id) ?? UUID(), name: m.name, email: m.email, onboarded: m.onboarded, timezone: m.timezone)
                state = me.onboarded ? .ready(me) : .needsOnboarding(me)
            case .unauthorized:
                signOut()
            default:
                state = .offline
            }
        } catch {
            state = .offline
        }
    }
}
