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

public func makeClient(baseURL: URL = BoopConfig.apiBaseURL, tokens: TokenStore, transport: any ClientTransport = URLSessionTransport()) -> Client {
    Client(serverURL: baseURL, transport: transport, middlewares: [AuthMiddleware(tokens: tokens)])
}

/// True when the failure is the network (no connection, timeout, DNS…), not the server.
func isNetworkFailure(_ error: Error) -> Bool {
    if error is URLError { return true }
    if let c = error as? ClientError { return c.underlyingError is URLError }
    return false
}
