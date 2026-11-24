import Foundation
import Testing
import BoopCore
@testable import Boop

/// A sender that keeps everything it is given.
private actor KeepingSender: OutboxSender {
    private(set) var sent: [OutboxItem] = []
    func send(_ item: OutboxItem) async -> OutboxSendResult { sent.append(item); return .sent(nil) }
}

/// The Súly orb and room re-read after a weigh-in (`mezo-r36n9.158`): the capture bumps the tick at once, and the
/// server's acceptance bumps it again.
struct RitmusTickTests {
    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("ritmus-tick-\(UUID().uuidString)")

    @MainActor @Test func captureWeightBumpsTheTick() async throws {
        let sender = KeepingSender()
        let env = RitmusEnvironment(ledgerDirectory: root.appendingPathComponent("ledger"),
                                    outboxDirectory: root.appendingPathComponent("outbox"),
                                    sender: sender, line: { _, _ in "" }, snapshot: { _ in CheckInSnapshotValue(hrBpm: 78, hrvMs: 38, hrvUsualMs: 50) }, plans: nil,
                                    clock: { Date(timeIntervalSince1970: 1_795_089_600) }, calendar: .current)
        #expect(env.weightTick == 0)
        try await env.captureWeight(kg: 84.63, at: Date(timeIntervalSince1970: 1_795_089_600))
        #expect(env.weightTick >= 1)
        let before = env.weightTick
        try await Task.sleep(for: .milliseconds(600))
        let items = await sender.sent
        #expect(items.map(\.kind) == [.weightLog])
        #expect(env.weightTick > before)
        env.retire()
        try? FileManager.default.removeItem(at: root)
    }
}
