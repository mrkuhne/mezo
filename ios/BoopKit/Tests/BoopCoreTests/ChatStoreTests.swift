import Foundation
import Testing
@testable import BoopCore

/// Lets the outbox's delivery listener reach the store created after it.
final class ChatStoreRef: @unchecked Sendable { weak var store: ChatStore? }

/// The Boop tab's chat (B3 Task 12, spec §5.5, §7.6): today's boop conversation, the day-context strip, ready
/// questions, and the offline question that waits in the outbox.
@MainActor
final class ChatStoreTests {
    let stub = StubTransport()
    let dir = temporaryDirectory()
    let time = TestClock(at(16, 2))   // 2026-11-10 16:02, Budapest
    let ref = ChatStoreRef()
    lazy var ritmus = RitmusClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub),
                                   audioDirectory: dir.appendingPathComponent("outbox"))
    lazy var outbox: Outbox = {
        let c = time, ref = ref
        return Outbox(directory: dir.appendingPathComponent("outbox"), sender: ritmus, clock: { c.now }, calendar: budapest) {
            item, body in await ref.store?.delivered(item, body: body)
        }
    }()
    deinit { try? FileManager.default.removeItem(at: dir) }

    func store() -> ChatStore {
        let c = time
        let s = ChatStore(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), sender: ritmus, outbox: outbox,
                          directory: dir, clock: { c.now }, calendar: budapest)
        ref.store = s
        return s
    }

    static let context = #"{"chips":[{"key":"sleep","label":"Alvás","value":"6ó 10p","sub":"előző éjjel 7ó 40p"},{"key":"session","label":"Röpi","value":"19:00","sub":"90 perc"},{"key":"goal","label":"A nap célja","value":"Ügyfélprezentáció","sub":null}],"questions":["Mennyit egyek a röpi előtt?","Mire figyeljek ma az edzésen?","Miért vagyok fáradtabb, mint tegnap?"],"generatedAt":"2026-11-10T15:02:00Z"}"#

    static func conversation(_ id: UUID, title: String?) -> String {
        let t = title.map { "\"\($0)\"" } ?? "null"
        return #"{"id":"\#(id.uuidString.lowercased())","title":\#(t),"startedAt":"2026-11-10T08:00:00Z"}"#
    }

    static func message(_ role: String, _ content: String, id: UUID = UUID()) -> String {
        #"{"id":"\#(id.uuidString.lowercased())","role":"\#(role)","content":"\#(content)","createdAt":"2026-11-10T15:02:05Z","tools":[],"refs":[],"recalled":[],"degraded":false}"#
    }

    func body(_ n: Int = 0, op: String) throws -> [String: Any] {
        let text = try #require(stub.sent.filter { $0.op == op }[n].body)
        return try #require(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
    }

    func paths(_ op: String) -> [String] { stub.sent.filter { $0.op == op }.map(\.path) }

    // MARK: -

    @Test func firstQuestionCreatesTodaysBoopConversation() async throws {
        let yesterday = UUID(), made = UUID()
        stub.on("getDayContext", .json(200, Self.context))
        stub.on("listConversations", .json(200, "[\(Self.conversation(yesterday, title: "2026. november 9."))]"))
        let chat = store()
        await chat.refresh()
        #expect(chat.lines.isEmpty)
        #expect(!stub.ops.contains("listMessages"))   // yesterday's conversation is not today's

        stub.on("createConversation", .json(201, Self.conversation(made, title: "2026. november 10.")))
        stub.on("sendMessage", .json(200, Self.message("assistant", "Az éjjel 6ó 10 percet aludtál.")))
        await chat.ask("Miért vagyok fáradt?", online: true)

        #expect(try body(op: "createConversation")["channel"] as? String == "boop")
        #expect(paths("sendMessage").first?.contains(made.uuidString.lowercased()) == true)
        #expect(chat.lines.map(\.who) == [.owner, .boop])
        #expect(chat.lines.map(\.text) == ["Miért vagyok fáradt?", "Az éjjel 6ó 10 percet aludtál."])
        #expect(chat.lines.allSatisfy { $0.state == .shown })
        #expect(chat.conversationId(on: "2026-11-10") == made)

        // The day's conversation is kept on the phone: a later question (even after a relaunch) goes to the same one.
        stub.on("sendMessage", .json(200, Self.message("assistant", "Igen.")))
        let again = store()
        #expect(again.conversationId(on: "2026-11-10") == made)
        await again.ask("És most?", online: true)
        #expect(stub.ops.filter { $0 == "createConversation" }.count == 1)
        #expect(paths("sendMessage").last?.contains(made.uuidString.lowercased()) == true)
    }

    @Test func refreshShowsTodaysConversationFoundByItsDateTitle() async throws {
        let yesterday = UUID(), today = UUID()
        stub.on("getDayContext", .json(200, Self.context))
        stub.on("listConversations", .json(200, "[\(Self.conversation(today, title: "2026. november 10.")),\(Self.conversation(yesterday, title: "2026. november 9."))]"))
        stub.on("listMessages", .json(200, "[\(Self.message("user", "Hogy alakul a napom?")),\(Self.message("assistant", "Jól."))]"))
        let chat = store()
        await chat.refresh()
        #expect(paths("listMessages").first?.contains(today.uuidString.lowercased()) == true)
        #expect(chat.lines.map(\.who) == [.owner, .boop])
        #expect(chat.lines.map(\.text) == ["Hogy alakul a napom?", "Jól."])
        #expect(chat.conversationId(on: "2026-11-10") == today)
    }

    @Test func newDayStartsNewConversation() async throws {
        let first = UUID(), second = UUID()
        stub.on("createConversation", .json(201, Self.conversation(first, title: "2026. november 10.")))
        stub.on("sendMessage", .json(200, Self.message("assistant", "Tegnapi válasz.")))
        let chat = store()
        await chat.ask("Első kérdés", online: true)
        #expect(chat.lines.count == 2)

        time.advance(24 * 3600)   // 2026-11-11
        stub.on("getDayContext", .json(200, Self.context))
        stub.on("listConversations", .json(200, "[\(Self.conversation(first, title: "2026. november 10."))]"))
        await chat.refresh()
        #expect(chat.day == "2026-11-11")
        #expect(chat.lines.isEmpty)   // yesterday's turns are not shown

        stub.on("createConversation", .json(201, Self.conversation(second, title: "2026. november 11.")))
        stub.on("sendMessage", .json(200, Self.message("assistant", "Mai válasz.")))
        await chat.ask("Mai kérdés", online: true)
        #expect(stub.ops.filter { $0 == "createConversation" }.count == 2)
        #expect(paths("sendMessage").last?.contains(second.uuidString.lowercased()) == true)
        #expect(chat.conversationId(on: "2026-11-10") == first)
        #expect(chat.conversationId(on: "2026-11-11") == second)
        #expect(chat.lines.map(\.text) == ["Mai kérdés", "Mai válasz."])
    }

    @Test func offlineQuestionQueuedThenSent() async throws {
        let made = UUID()
        let chat = store()
        await chat.ask("Mit egyek a röpi előtt?", online: false)
        await chat.ask("És holnap?", online: false)
        #expect(stub.ops.isEmpty)   // nothing goes out without the net
        #expect(chat.lines.map(\.state) == [.queued, .queued])
        #expect(chat.lines.map(\.who) == [.owner, .owner])
        let queued = await outbox.pending
        #expect(queued.map(\.kind) == [.chatQuestion, .chatQuestion])
        #expect(queued.map(\.id) == chat.lines.map(\.id))   // the bubble is the outbox item
        let first = try #require(RitmusPayload.decode(ChatQuestionPayload.self, from: queued[0].payload))
        #expect(first.conversationId == nil && first.text == "Mit egyek a röpi előtt?")

        // The net is back: the first question creates today's conversation, the second follows into the same one,
        // and Boop's answers are fetched and shown.
        stub.on("createConversation", .json(201, Self.conversation(made, title: "2026. november 10.")))
        stub.on("sendMessage", .json(200, Self.message("assistant", "Egy banánt 17:30-kor.")))
        stub.on("listMessages", .json(200, "[\(Self.message("user", "Mit egyek a röpi előtt?")),\(Self.message("assistant", "Egy banánt 17:30-kor."))]"))
        stub.on("sendMessage", .json(200, Self.message("assistant", "Holnap pihenőnap.")))
        stub.on("listMessages", .json(200, "[\(Self.message("user", "Mit egyek a röpi előtt?")),\(Self.message("assistant", "Egy banánt 17:30-kor.")),\(Self.message("user", "És holnap?")),\(Self.message("assistant", "Holnap pihenőnap."))]"))
        await outbox.flush(ignoringBackoff: true)

        #expect(stub.ops.filter { $0 == "createConversation" }.count == 1)
        #expect(paths("sendMessage").count == 2)
        #expect(paths("sendMessage").allSatisfy { $0.contains(made.uuidString.lowercased()) })
        #expect(try body(0, op: "sendMessage")["content"] as? String == "Mit egyek a röpi előtt?")
        #expect(try body(1, op: "sendMessage")["content"] as? String == "És holnap?")
        #expect(await outbox.pending.isEmpty)
        #expect(chat.lines.map(\.text) == ["Mit egyek a röpi előtt?", "Egy banánt 17:30-kor.", "És holnap?", "Holnap pihenőnap."])
        #expect(chat.lines.allSatisfy { $0.state == .shown })
        #expect(chat.conversationId(on: "2026-11-10") == made)
    }

    @Test func queuedQuestionSurvivesARelaunch() async throws {
        let chat = store()
        await chat.ask("Mit egyek?", online: false)
        stub.on("getDayContext", .status(500))
        stub.on("listConversations", .json(200, "[]"))
        let again = store()
        await again.refresh()
        #expect(again.lines.map(\.text) == ["Mit egyek?"])
        #expect(again.lines.map(\.state) == [.queued])
    }

    @Test func readyQuestionSendsItsText() async throws {
        let made = UUID()
        stub.on("getDayContext", .json(200, Self.context))
        stub.on("listConversations", .json(200, "[]"))
        let chat = store()
        await chat.refresh()
        #expect(chat.questions == ["Mennyit egyek a röpi előtt?", "Mire figyeljek ma az edzésen?", "Miért vagyok fáradtabb, mint tegnap?"])
        // The strip shows exactly the server's chips.
        #expect(chat.chips == [
            DayChip(key: "sleep", label: "Alvás", value: "6ó 10p", sub: "előző éjjel 7ó 40p"),
            DayChip(key: "session", label: "Röpi", value: "19:00", sub: "90 perc"),
            DayChip(key: "goal", label: "A nap célja", value: "Ügyfélprezentáció", sub: nil),
        ])

        stub.on("createConversation", .json(201, Self.conversation(made, title: "2026. november 10.")))
        stub.on("sendMessage", .json(200, Self.message("assistant", "A HRV-d 41.")))
        await chat.ask(chat.questions[1], online: true)
        #expect(try body(op: "sendMessage")["content"] as? String == "Mire figyeljek ma az edzésen?")
        #expect(chat.lines.first?.text == "Mire figyeljek ma az edzésen?")
    }

    @Test func onlineSendThatLosesTheNetIsQueuedOnce() async throws {
        let made = UUID()
        stub.on("createConversation", .json(201, Self.conversation(made, title: "2026. november 10.")))
        stub.on("sendMessage", .fail(URLError(.networkConnectionLost)))
        let chat = store()
        await chat.ask("Mi legyen a vacsora?", online: true)
        #expect(chat.answering == false)
        #expect(chat.lines.map(\.state) == [.queued])
        let queued = await outbox.pending
        #expect(queued.count == 1)
        #expect(queued.first?.id == chat.lines.first?.id)   // same client id, never a second copy
        let payload = try #require(RitmusPayload.decode(ChatQuestionPayload.self, from: queued[0].payload))
        #expect(payload.conversationId == made && payload.text == "Mi legyen a vacsora?")

        stub.on("sendMessage", .json(200, Self.message("assistant", "Lazac.")))
        stub.on("listMessages", .json(200, "[\(Self.message("user", "Mi legyen a vacsora?")),\(Self.message("assistant", "Lazac."))]"))
        await outbox.flush(ignoringBackoff: true)
        #expect(stub.ops.filter { $0 == "createConversation" }.count == 1)
        #expect(paths("sendMessage").count == 2)
        #expect(chat.lines.map(\.text) == ["Mi legyen a vacsora?", "Lazac."])
    }

    @Test func refusedQuestionIsMarkedNotSent() async throws {
        let made = UUID()
        stub.on("createConversation", .json(201, Self.conversation(made, title: "2026. november 10.")))
        stub.on("sendMessage", .status(400))
        let chat = store()
        await chat.ask("x", online: true)
        #expect(chat.lines.map(\.state) == [.failed])
        #expect(await outbox.pending.isEmpty)
    }
}
