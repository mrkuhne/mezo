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

    /// A conversation as the server lists it; it started on its title's day (08:00 UTC) unless told otherwise.
    static func conversation(_ id: UUID, title: String?) -> String {
        let t = title.map { "\"\($0)\"" } ?? "null"
        let day = title.flatMap { $0.split(separator: " ").last.flatMap { Int($0.dropLast()) } } ?? 10
        let started = String(format: "2026-11-%02dT08:00:00Z", day)
        return #"{"id":"\#(id.uuidString.lowercased())","title":\#(t),"startedAt":"\#(started)"}"#
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
        #expect(chat.hasQueued)   // the "Nincs net" line shows
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
        #expect(queued[0].attempts == 1)   // the resend first checks whether the question arrived

        stub.on("listMessages", .json(200, "[]"))

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

        // Újra: asked again, but first the turns are read in case the refused send was stored after all.
        stub.on("listMessages", .json(200, "[]"))
        stub.on("sendMessage", .json(200, Self.message("assistant", "Most sikerült.")))
        let id = try #require(chat.lines.first?.id)
        await chat.retry(id, online: true)
        #expect(stub.ops.suffix(2) == ["listMessages", "sendMessage"])
        #expect(chat.lines.map(\.text) == ["x", "Most sikerült."])
        #expect(chat.lines.allSatisfy { $0.state == .shown })
    }

    /// Waits (yielding) until the store shows a line.
    func firstLine(_ chat: ChatStore) async -> ChatLine? {
        for _ in 0..<2_000 where chat.lines.isEmpty { try? await Task.sleep(for: .milliseconds(1)) }
        return chat.lines.first
    }

    @Test func onlineAskWaitsQuietlyNotAsOffline() async throws {
        let made = UUID()
        stub.on("createConversation", .json(201, Self.conversation(made, title: "2026. november 10.")))
        stub.on("sendMessage", .slowJson(200, Self.message("assistant", "Válasz."), ms: 300))
        let chat = store()
        let asking = Task { await chat.ask("Kérdés", online: true) }
        let line = await firstLine(chat)
        #expect(line?.state == .sending)
        #expect(chat.answering)
        #expect(!chat.hasQueued)   // no "Nincs net" while Boop answers
        _ = await asking.value
        #expect(chat.lines.map(\.state) == [.shown, .shown])
        #expect(!chat.answering)
    }

    @Test func secondQuestionWhileAnsweringIsNotTakenAndCreatesNothing() async throws {
        let made = UUID()
        stub.on("createConversation", .slowJson(201, Self.conversation(made, title: "2026. november 10."), ms: 200))
        stub.on("sendMessage", .json(200, Self.message("assistant", "Válasz.")))
        let chat = store()
        let first = Task { await chat.ask("Egy", online: true) }
        let second = Task { await chat.ask("Kettő", online: true) }
        let (a, b) = (await first.value, await second.value)
        #expect([a, b].filter { $0 }.count == 1)   // the other one tells the caller to keep the text
        #expect(stub.ops.filter { $0 == "createConversation" }.count == 1)
        #expect(chat.lines.filter { $0.who == .owner }.count == 1)
    }

    @Test func refreshDuringAnAskKeepsTheQuestion() async throws {
        let made = UUID()
        stub.on("createConversation", .json(201, Self.conversation(made, title: "2026. november 10.")))
        stub.on("sendMessage", .slowJson(200, Self.message("assistant", "Válasz."), ms: 400))
        let chat = store()
        let asking = Task { await chat.ask("Kérdés", online: true) }
        _ = await firstLine(chat)
        for _ in 0..<2_000 where chat.conversationId(on: "2026-11-10") == nil { try? await Task.sleep(for: .milliseconds(1)) }
        stub.on("getDayContext", .json(200, Self.context))
        stub.on("listMessages", .json(200, "[]"))   // the server has not stored it yet
        await chat.refresh()
        #expect(chat.lines.map(\.text) == ["Kérdés"])
        #expect(chat.lines.first?.state == .sending)
        _ = await asking.value
        #expect(chat.lines.map(\.text) == ["Kérdés", "Válasz."])
    }

    @Test func deliveredWithoutAnAnswerBodyStillShowsTheTurns() async throws {
        let made = UUID()
        stub.on("createConversation", .json(201, Self.conversation(made, title: "2026. november 10.")))
        stub.on("sendMessage", .json(200, Self.message("assistant", "Első válasz.")))
        let chat = store()
        await chat.ask("Első", online: true)
        await chat.ask("Második", online: false)
        let item = try #require(await outbox.pending.first)
        await outbox.remove(item.id)
        stub.on("listMessages", .json(200, "[\(Self.message("user", "Első")),\(Self.message("assistant", "Első válasz.")),\(Self.message("user", "Második")),\(Self.message("assistant", "Második válasz."))]"))
        await chat.delivered(item, body: nil)
        #expect(chat.lines.map(\.text) == ["Első", "Első válasz.", "Második", "Második válasz."])
        #expect(chat.lines.allSatisfy { $0.state == .shown })
    }

    /// Final review M4: the server titles a Boop conversation with the OWNER's day; a phone east of the owner zone lives
    /// in the next day already. Today's conversation is the newest one started within the phone's day, whatever its
    /// title says — so the phone finds it and never makes a second one.
    @Test func todaysConversationIsFoundByWhenItStartedNotOnlyByTitle() async throws {
        var tokyo = Calendar(identifier: .gregorian)
        tokyo.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        let phoneMorning = ISO8601DateFormatter().date(from: "2026-11-11T22:30:00Z")!   // Tokyo: 11-12 07:30
        let clock = TestClock(phoneMorning)
        let todays = UUID(), yesterdays = UUID()
        func conv(_ id: UUID, _ started: String) -> String {
            #"{"id":"\#(id.uuidString.lowercased())","title":"2026. november 11.","startedAt":"\#(started)"}"#
        }
        stub.on("getDayContext", .json(200, Self.context))
        // both carry the owner's (Budapest) date; only one started on the phone's 12th
        stub.on("listConversations", .json(200, "[\(conv(yesterdays, "2026-11-11T08:00:00Z")),\(conv(todays, "2026-11-11T22:10:00Z"))]"))
        stub.on("listMessages", .json(200, "[\(Self.message("user", "Reggeli kérdés")),\(Self.message("assistant", "Válasz."))]"))
        let c = clock
        let chat = ChatStore(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), sender: ritmus, outbox: outbox,
                             directory: dir, clock: { c.now }, calendar: tokyo)
        await chat.refresh()
        #expect(chat.day == "2026-11-12")
        #expect(chat.conversationId(on: "2026-11-12") == todays)
        #expect(chat.lines.map(\.text) == ["Reggeli kérdés", "Válasz."])
        stub.on("sendMessage", .json(200, Self.message("assistant", "Igen.")))
        await chat.ask("És most?", online: true)
        #expect(!stub.ops.contains("createConversation"))
    }
}
