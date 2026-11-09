import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Scripted transport: answers each operation from a queue, records every request.
final class StubTransport: ClientTransport, @unchecked Sendable {
    enum Reply { case json(Int, String), status(Int), fail(Error) }
    struct Sent { let op: String; let path: String; let auth: String?; let body: String? }
    private let lock = NSLock()
    private var replies: [String: [Reply]] = [:]
    private(set) var sent: [Sent] = []

    func on(_ op: String, _ r: Reply) { lock.withLock { replies[op, default: []].append(r) } }
    var ops: [String] { lock.withLock { sent.map(\.op) } }

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        var text: String?
        if let body { text = String(decoding: try await Data(collecting: body, upTo: 1 << 20), as: UTF8.self) }
        let reply: Reply? = lock.withLock {
            sent.append(Sent(op: operationID, path: request.path ?? "", auth: request.headerFields[.authorization], body: text))
            return replies[operationID]?.isEmpty == false ? replies[operationID]!.removeFirst() : nil
        }
        switch reply {
        case .json(let code, let json)?:
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .init(code: code), headerFields: h), HTTPBody(json))
        case .status(let code)?: return (HTTPResponse(status: .init(code: code)), nil)
        case .fail(let e)?: throw e
        case nil: Issue.recordUnscripted(operationID); return (HTTPResponse(status: .init(code: 500)), nil)
        }
    }
}

import Testing
extension Issue { static func recordUnscripted(_ op: String) { Issue.record("unscripted call \(op)") } }

func meJSON(_ onboarded: Bool) -> String {
    #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444","email":"teszt@pelda.hu","name":"Teszt","role":"USER","onboarded":\#(onboarded),"mustChangePassword":false,"timezone":"Europe/Budapest","language":"hu"}"#
}
