import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing
import BoopCore
@testable import Boop

/// Delivers every chat question with a fixed answer; waits for the net while offline.
private actor ChatSender: OutboxSender {
    let conversation = UUID()
    private(set) var sent: [OutboxItem] = []
    func send(_ item: OutboxItem) async -> OutboxSendResult {
        sent.append(item)
        return .sent(RitmusPayload.encode(ChatReply(conversationId: conversation, content: "Egy banánt 17:30-kor.")))
    }
}

/// No server in these tests: every read fails like a lost connection.
private struct NoServer: ClientTransport {
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        throw URLError(.notConnectedToInternet)
    }
}

/// The Boop tab (B3 Task 12, spec §5.5): the environment's chat glue and how the server's chips read.
@MainActor
final class BoopChatTests {
    private static let budapest: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("boop-chat-\(UUID().uuidString)")
    private let sender = ChatSender()
    deinit { try? FileManager.default.removeItem(at: root) }

    private func environment() -> RitmusEnvironment {
        let now = Self.budapest.date(from: DateComponents(year: 2026, month: 11, day: 12, hour: 16, minute: 2))!
        let env = RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
            sender: sender, line: { _, _ in "" }, snapshot: { _ in CheckInSnapshotValue() }, plans: nil,
            clock: { now }, calendar: Self.budapest)
        env.attachChat(client: makeClient(tokens: MemoryTokenStore("t"), transport: NoServer()), sender: sender)
        return env
    }

    @Test func offlineQuestionIsAnsweredWhenTheOutboxDeliversIt() async throws {
        let env = environment()
        let chat = try #require(env.chat)
        await chat.ask("Mit egyek a röpi előtt?", online: false)
        #expect(chat.lines.map(\.state) == [.queued])
        #expect(await sender.sent.isEmpty)

        await env.outbox.flush(ignoringBackoff: true)
        // The turns cannot be fetched here, so the delivered answer itself is shown under the question.
        #expect(chat.lines.map(\.text) == ["Mit egyek a röpi előtt?", "Egy banánt 17:30-kor."])
        #expect(chat.lines.map(\.who) == [.owner, .boop])
        #expect(chat.lines.allSatisfy { $0.state == .shown })
        #expect(chat.conversationId(on: "2026-11-12") == sender.conversation)
    }

    @Test func eachUserKeepsTheirOwnConversations() async throws {
        let env = environment()
        await env.chat?.ask("Kérdés", online: false)
        await env.outbox.flush(ignoringBackoff: true)
        // The day → conversation file sits in the user's folder, beside the ledger and the outbox.
        #expect(FileManager.default.fileExists(atPath: root.appendingPathComponent("chat-conversations.json").path))
    }

    @Test func chipsShowEveryServerWordLabelFirst() {
        func face(_ key: String, _ label: String, _ value: String, _ sub: String?) -> ChipFace {
            ChipFace(DayChip(key: key, label: label, value: value, sub: sub))
        }
        #expect(face("sleep", "Alvás", "6ó 10p", "előző éjjel 7ó 40p") == ChipFace(glyph: "moon-cream", title: "Alvás 6ó 10p", sub: "előző éjjel 7ó 40p"))
        #expect(face("hrv", "HRV", "41", "szokott 50") == ChipFace(glyph: "spark-cream", title: "HRV 41", sub: "szokott 50"))
        #expect(face("session", "Röpi", "19:00", "90 perc") == ChipFace(glyph: "ball-sun", title: "Röpi 19:00", sub: "90 perc"))
        #expect(face("session", "Edzés", "ma", "60 perc") == ChipFace(glyph: "dumbbell-ink", title: "Edzés ma", sub: "60 perc"))
        #expect(face("checkins", "Kitöltés", "3 kitöltés", "energia 6") == ChipFace(glyph: "pen-sun", title: "Kitöltés", sub: "3 kitöltés · energia 6"))
        #expect(face("fuel", "Étkezés", "520 kcal", "cél 3 100") == ChipFace(glyph: "bowl-cream", title: "Étkezés 520 kcal", sub: "cél 3 100"))
        #expect(face("goal", "A nap célja", "Ügyfélprezentáció", nil) == ChipFace(glyph: "star-sun", title: "A nap célja", sub: "Ügyfélprezentáció"))
        #expect(face("calendar", "Naptár", "még 2 esemény", "következő 14:00")
                == ChipFace(glyph: "clock-ink", title: "Naptár", sub: "még 2 esemény · következő 14:00"))
        #expect(face("új", "Valami", "5", nil) == ChipFace(glyph: "spark-cream", title: "Valami 5", sub: ""))
    }
}
