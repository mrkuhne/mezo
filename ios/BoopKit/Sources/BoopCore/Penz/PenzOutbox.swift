import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Sends a queued cash expense (`OutboxKind.penzExpense`, Pénz L5): `POST /api/penz/transactions` with the item id as
/// `clientRef`, so a resend after a lost answer returns the stored row and never makes a second one.
///
/// Status mapping (the outbox's shared vocabulary, `RitmusClient.map`): 2xx → `.sent`; no connection → `.offline`
/// (not an attempt); 401, 409, 429, 5xx (a 503 is the exchange rate being unreachable) and a timeout → `.retryLater`;
/// any other 4xx (400 a bad amount, 404 an account or category that is gone) → `.failed`, kept with its values for
/// his "Újra".
public struct PenzOutboxSender: OutboxSender {
    let raw: RawJSONClient

    public init(raw: RawJSONClient) { self.raw = raw }

    public func send(_ item: OutboxItem) async -> OutboxSendResult {
        guard item.kind == .penzExpense, let payload = RitmusPayload.decodePenzExpense(item.payload)
        else { return .failed("unreadable penzExpense payload") }
        let body: Data
        do { body = try PlanJSON.encoder.encode(payload.request(clientRef: item.id)) } catch { return .failed("unencodable penzExpense") }
        var request = HTTPRequest(method: .post, scheme: nil, authority: nil, path: "/api/penz/transactions")
        request.headerFields[.accept] = "application/json"
        request.headerFields[.contentType] = "application/json"
        if let t = raw.token() { request.headerFields[.authorization] = "Bearer \(t)" }
        do {
            let (response, responseBody) = try await raw.transport.send(request, body: HTTPBody(body), baseURL: raw.baseURL,
                                                                         operationID: "createPenzTransaction")
            let code = response.status.code
            guard (200..<300).contains(code) else { return RitmusClient.map(code) }
            var data: Data?
            if let responseBody { data = try? await Data(collecting: responseBody, upTo: 1 << 20) }
            return .sent(data)
        } catch {
            // No connection is not an attempt; a timeout or anything else is a real try (the write is idempotent).
            return RitmusClient.isNoConnection(error) ? .offline : .retryLater
        }
    }
}
