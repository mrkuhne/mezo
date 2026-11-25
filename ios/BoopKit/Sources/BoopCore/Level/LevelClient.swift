import Foundation
import HTTPTypes

/// The Levél area's server calls (mezo-r36n9.39) over the hand-written lenient caller (`RawJSONClient`). Paths and
/// operation ids are the contract's own (`api/feature/mail/mail.yml`). The mail operations are deliberately **not**
/// in the generator filter: BoopAPI is not touched.
///
/// Errors map like the other hand-written areas: 400/422 with a code → `.rejected(code)` (a refused password is
/// `MAIL_AUTH_FAILED`), 409/429/503 with a code → `.conflict(code)` (the manual-run cooldown is
/// `.conflict("MAIL_RUN_COOLDOWN")`, a mailbox that is not connected `.conflict("MAIL_NOT_CONNECTED")`).
public struct LevelClient: Sendable {
    let raw: RawJSONClient

    public init(raw: RawJSONClient) { self.raw = raw }

    public func mailbox() async throws(PlanFetchError) -> LevelMailbox {
        try await raw.get("/api/mail/mailbox", operationID: "getMailMailbox")
    }

    /// Verifies the app password against the mailbox before the server stores it. The password is only ever in this
    /// call's request body — it is never logged, cached or echoed back.
    public func connect(address: String, appPassword: String) async throws(PlanFetchError) -> LevelMailbox {
        try await raw.send(.put, "/api/mail/mailbox", operationID: "putMailMailbox",
                           body: LevelConnectRequest(address: address, appPassword: appPassword))
    }

    /// Hands the server the one-time Google code (PKCE) — it exchanges it and seals the refresh token; none comes back.
    /// 400 `MAIL_GOOGLE_REDIRECT_INVALID`, 409 `MAIL_GOOGLE_NOT_CONFIGURED`, 422 `MAIL_AUTH_FAILED`.
    public func connectGoogle(code: String, codeVerifier: String, redirectUri: String) async throws(PlanFetchError) -> LevelMailbox {
        try await raw.send(.post, "/api/mail/mailbox/google", operationID: "postMailMailboxGoogle",
                           body: LevelGoogleConnectRequest(code: code, codeVerifier: codeVerifier, redirectUri: redirectUri))
    }

    public func disconnect() async throws(PlanFetchError) -> LevelMailbox {
        try await raw.get(method: .delete, "/api/mail/mailbox", operationID: "deleteMailMailbox")
    }

    /// Asks for a run now (202, empty). 409 `MAIL_NOT_CONNECTED`, 429 `MAIL_RUN_COOLDOWN`.
    public func run() async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.post, "/api/mail/mailbox/run", operationID: "runMailMailbox")
    }

    /// One day's post (`YYYY-MM-DD`, Budapest); nil = today on the server.
    public func digest(day: String? = nil) async throws(PlanFetchError) -> LevelDigest {
        try await raw.get("/api/mail/digest" + (day.map { "?date=\($0)" } ?? ""), operationID: "getMailDigest")
    }

    public func feedback(item: String, verdict: LevelVerdict) async throws(PlanFetchError) {
        let body: Data
        do { body = try PlanJSON.encoder.encode(LevelFeedbackRequest(verdict: verdict.rawValue)) } catch { throw .server }
        _ = try await raw.sendRaw(.post, "/api/mail/items/\(item)/feedback", operationID: "postMailFeedback", body: body)
    }

    public func rules() async throws(PlanFetchError) -> LevelRules {
        try await raw.get("/api/mail/rules", operationID: "getMailRules")
    }

    public func saveRules(_ request: LevelRulesRequest) async throws(PlanFetchError) -> LevelRules {
        try await raw.send(.put, "/api/mail/rules", operationID: "putMailRules", body: request)
    }
}
