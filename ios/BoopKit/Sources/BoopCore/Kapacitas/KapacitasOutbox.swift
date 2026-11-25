import Foundation

/// Sends an Átrendezés accept queued without the net (`OutboxKind.dayAdjustment`, B7 K3):
/// `POST /api/capacity/proposals/{id}/accept` with the payload's `clientRef`. The server keys the accept on it, so a
/// resend after a lost answer returns the rows already written and never moves a session twice.
///
/// Status mapping (the outbox's vocabulary): 2xx → `.sent`; no connection → `.offline` (not an attempt); 401, 429, 5xx
/// and a timeout → `.retryLater`; a 409 (the proposal went stale, its day started, the key was used elsewhere), a 404
/// or a 4xx refusal → `.failed(code)` — retrying would never help; the Átrendezés page drops the item, refreshes the
/// week and says so in one quiet line.
public struct KapacitasOutboxSender: OutboxSender {
    let client: KapacitasClient

    public init(raw: RawJSONClient) { client = KapacitasClient(raw: raw) }

    public func send(_ item: OutboxItem) async -> OutboxSendResult {
        guard item.kind == .dayAdjustment, let p = Self.decode(item.payload) else { return .failed("unreadable dayAdjustment payload") }
        do throws(PlanFetchError) {
            try await client.accept(proposalId: p.proposalId, clientRef: p.clientRef)
            return .sent(nil)
        } catch {
            switch error {
            case .offline: return .offline
            case .unauthorized, .server: return .retryLater
            case .conflict(let code): return .failed(code ?? "HTTP 409")
            case .rejected(let code): return .failed(code ?? "HTTP 400")
            case .notFound: return .failed("HTTP 404")
            case .dayWorkoutRunning: return .failed("TRAIN_DAY_WORKOUT_RUNNING")
            }
        }
    }

    public static func decode(_ data: Data) -> DayAdjustmentPayload? {
        try? JSONDecoder().decode(DayAdjustmentPayload.self, from: data)
    }
}
