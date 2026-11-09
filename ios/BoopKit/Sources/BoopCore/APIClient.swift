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

public func makeClient(baseURL: URL = BoopConfig.apiBaseURL, tokens: TokenStore, transport: any ClientTransport = makeTransport()) -> Client {
    Client(serverURL: baseURL, transport: transport, middlewares: [AuthMiddleware(tokens: tokens)])
}

/// True when the failure is the network (no connection, timeout, DNS…), not the server.
func isNetworkFailure(_ error: Error) -> Bool {
    if error is URLError { return true }
    if let c = error as? ClientError { return c.underlyingError is URLError }
    return false
}
