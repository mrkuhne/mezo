import Foundation
import HTTPTypes
import OpenAPIRuntime
import OpenAPIURLSession
import BoopAPI

/// Adds `Authorization: Bearer <token>` to every request when a token is stored.
struct AuthMiddleware: ClientMiddleware {
    let tokens: TokenStore
    func intercept(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
                   next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)) async throws -> (HTTPResponse, HTTPBody?) {
        var r = request
        if let t = tokens.read() { r.headerFields[.authorization] = "Bearer \(t)" }
        return try await next(r, body, baseURL)
    }
}

/// The app's transport: its own ephemeral session (no shared connection/Alt-Svc cache) and a 20 s request limit,
/// so a stalled connection ends in the offline message instead of an endless spinner.
public func makeTransport() -> URLSessionTransport {
    let cfg = URLSessionConfiguration.ephemeral
    cfg.timeoutIntervalForRequest = 20
    cfg.timeoutIntervalForResource = 40
    cfg.waitsForConnectivity = false
    return URLSessionTransport(configuration: .init(session: URLSession(configuration: cfg)))
}

/// `timeZone`: the zone timestamps are written in (the device's, following it when it changes) — see the transcoder.
public func makeClient(baseURL: URL = BoopConfig.apiBaseURL, tokens: TokenStore, transport: any ClientTransport = makeTransport(),
                       timeZone: TimeZone = .autoupdatingCurrent) -> Client {
    Client(serverURL: baseURL, configuration: .init(dateTranscoder: FlexibleISO8601Transcoder(timeZone: timeZone)),
           transport: transport, middlewares: [AuthMiddleware(tokens: tokens)])
}

/// ISO-8601 dates with or without fractional seconds. The backend writes Java `Instant`s, which carry
/// microseconds when they have them (the Boop brief's `generatedAt`); the runtime's default transcoder
/// rejects those, and every live brief failed to decode. Encodes without fractions, carrying the phone's own UTC offset
/// ("2026-11-13T00:30:00+01:00", never "…Z"): the server takes the local date of a `capturedAt` as the record's day, so a
/// 00:30 Budapest meal sent as UTC would land on the previous day. The instant is the same either way.
struct FlexibleISO8601Transcoder: DateTranscoder {
    var timeZone: TimeZone = .autoupdatingCurrent
    func encode(_ date: Date) throws -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withColonSeparatorInTimeZone]
        f.timeZone = timeZone
        return f.string(from: date)
    }
    func decode(_ string: String) throws -> Date {
        if let date = try? ISO8601DateTranscoder.iso8601WithFractionalSeconds.decode(string) { return date }
        return try ISO8601DateTranscoder.iso8601.decode(string)
    }
}

/// True when the failure is the network (no connection, timeout, DNS…), not the server.
func isNetworkFailure(_ error: Error) -> Bool {
    if error is URLError { return true }
    if let c = error as? ClientError { return c.underlyingError is URLError }
    return false
}
