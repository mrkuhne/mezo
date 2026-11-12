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

/// The contract types the voice upload's `audio` part as a bare binary, so the generated client labels it
/// `application/octet-stream` — which the backend refuses (it matches the part's mime against audio/mp4 & co.).
/// The recording is an m4a (AAC in MP4), so its part is relabelled `audio/mp4`.
struct AudioPartMiddleware: ClientMiddleware {
    static let operationID = "transcribeVoiceNote"
    func intercept(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String,
                   next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)) async throws -> (HTTPResponse, HTTPBody?) {
        guard operationID == Self.operationID, let body else { return try await next(request, body, baseURL) }
        let bytes = try await Data(collecting: body, upTo: 32 << 20)
        let from = Data("content-type: application/octet-stream".utf8), to = Data("content-type: audio/mp4".utf8)
        var patched = bytes
        if let range = bytes.range(of: from) { patched.replaceSubrange(range, with: to) }
        var r = request
        if r.headerFields[.contentLength] != nil { r.headerFields[.contentLength] = String(patched.count) }
        return try await next(r, HTTPBody(patched), baseURL)
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

public func makeClient(baseURL: URL = BoopConfig.apiBaseURL, tokens: TokenStore, transport: any ClientTransport = makeTransport()) -> Client {
    Client(serverURL: baseURL, configuration: .init(dateTranscoder: FlexibleISO8601Transcoder()),
           transport: transport, middlewares: [AuthMiddleware(tokens: tokens), AudioPartMiddleware()])
}

/// ISO-8601 dates with or without fractional seconds. The backend writes Java `Instant`s, which carry
/// microseconds when they have them (the Boop brief's `generatedAt`); the runtime's default transcoder
/// rejects those, and every live brief failed to decode. Encodes without fractions, as before.
struct FlexibleISO8601Transcoder: DateTranscoder {
    func encode(_ date: Date) throws -> String { try ISO8601DateTranscoder.iso8601.encode(date) }
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
