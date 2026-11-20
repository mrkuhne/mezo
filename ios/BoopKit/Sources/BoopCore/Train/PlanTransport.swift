import Foundation
import HTTPTypes
import OpenAPIRuntime

// The block builder and the weekly review (mezo-r36n9.83) talk to the server through this small JSON caller instead
// of the generated client. The reason is one rule of the generated code: it decodes every enum **strictly**, so a
// single value the server adds later (the technique planner adds proposal line kinds and reason codes in parallel)
// would fail the whole response and the deck would vanish. Here the wire types decode enums as plain strings and the
// screens map what they know — an unknown line kind becomes a plain "from → to" tile, an unknown reason no pill.
//
// It rides the same transport, base URL and token as the generated client, so it is the same network to the server.

/// Why a builder/review call did not give an answer, in the shape the screens turn into Hungarian.
public enum PlanFetchError: Error, Equatable, Sendable {
    /// No connection; the screen keeps what it had and says it is offline.
    case offline
    case unauthorized
    case notFound
    /// The server refused the content (400) — an unsafe technique, an invalid decision.
    case rejected(String?)
    /// The server refused the state (409) — the week has closed, the block is archived, techniques are off.
    case conflict(String?)
    case server
}

/// A JSON request/response caller over the app's `ClientTransport` with the bearer token attached.
public struct RawJSONClient: Sendable {
    let transport: any ClientTransport
    let baseURL: URL
    let token: @Sendable () -> String?

    public init(transport: any ClientTransport, baseURL: URL, token: @escaping @Sendable () -> String?) {
        self.transport = transport; self.baseURL = baseURL; self.token = token
    }

    /// `operationID` is the contract's own id: the DEBUG preview transport routes on it, and it names the call in logs.
    func sendRaw(_ method: HTTPRequest.Method, _ path: String, operationID: String, body: Data? = nil) async throws(PlanFetchError) -> Data {
        var request = HTTPRequest(method: method, scheme: nil, authority: nil, path: path)
        request.headerFields[.accept] = "application/json"
        if body != nil { request.headerFields[.contentType] = "application/json" }
        if let t = token() { request.headerFields[.authorization] = "Bearer \(t)" }
        let response: HTTPResponse
        let responseBody: HTTPBody?
        do {
            (response, responseBody) = try await transport.send(request, body: body.map { HTTPBody($0) }, baseURL: baseURL,
                                                                operationID: operationID)
        } catch {
            throw isNetworkFailure(error) ? .offline : .server
        }
        let data: Data
        if let responseBody {
            do { data = try await Data(collecting: responseBody, upTo: 4 << 20) } catch { throw .server }
        } else {
            data = Data()
        }
        switch response.status.code {
        case 200..<300: return data
        case 401: throw .unauthorized
        case 404: throw .notFound
        case 400: throw .rejected(Self.messageCode(data))
        // A 422 that names its rule (Pénz's PENZ_PRACTICE_CAP_EXCEEDED) is a content refusal he can read.
        case 422 where Self.messageCode(data) != nil: throw .rejected(Self.messageCode(data))
        case 409: throw .conflict(Self.messageCode(data))
        // A 503 that names its reason (Pénz's PENZ_FX_UNAVAILABLE) is a refusal he can read, not a bare fault.
        case 503 where Self.messageCode(data) != nil: throw .conflict(Self.messageCode(data))
        // A rate limit that names itself (Pénz's PENZ_DIGEST_REFRESH_LIMITED) is a state answer, not a fault.
        case 429 where Self.messageCode(data) != nil: throw .conflict(Self.messageCode(data))
        default: throw .server
        }
    }

    func get<T: Decodable>(_ path: String, operationID: String, as: T.Type = T.self) async throws(PlanFetchError) -> T {
        try decode(try await sendRaw(.get, path, operationID: operationID))
    }

    func send<B: Encodable, T: Decodable>(_ method: HTTPRequest.Method, _ path: String, operationID: String, body: B,
                                          as: T.Type = T.self) async throws(PlanFetchError) -> T {
        let data: Data
        do { data = try PlanJSON.encoder.encode(body) } catch { throw .server }
        return try decode(try await sendRaw(method, path, operationID: operationID, body: data))
    }

    private func decode<T: Decodable>(_ data: Data) throws(PlanFetchError) -> T {
        do { return try PlanJSON.decoder.decode(T.self, from: data) } catch { throw .server }
    }

    /// The first message code of a `SystemMessageList` error body, if the server sent one.
    static func messageCode(_ data: Data) -> String? {
        struct Message: Decodable { let code: String? }
        struct List: Decodable { let messages: [Message]? }
        if let list = try? JSONDecoder().decode(List.self, from: data) { return list.messages?.first?.code }
        if let array = try? JSONDecoder().decode([Message].self, from: data) { return array.first?.code }
        return nil
    }
}

enum PlanJSON {
    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys]
        return e
    }()
    static let decoder = JSONDecoder()
}
