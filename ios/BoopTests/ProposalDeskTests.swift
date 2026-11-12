import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// Boop's proposals shared by Ma and the rooms (B2 Task 7): *Most nem* hides for today and persists.
@MainActor
struct ProposalDeskTests {
    /// A day whose 17:30 session clashes with a meeting: the brief proposes moving it to 18:30.
    private func conflictDay() throws -> Brief { try Brief(json: Data(Self.conflictJSON().utf8)) }

    nonisolated static func conflictJSON(date: String = "2026-11-10", time: String = "17:30", conflict: Bool = true) -> String {
        let metrics = ["forma", "alvas", "mozgas", "fuel", "pulzus"].map {
            #"{"key":"\#($0)","score":70,"display":"70","headline":"h","sentence":"s"}"#
        }.joined(separator: ",")
        let json = #"""
        {"date":"2026-11-10","generatedAt":"2026-11-10T05:30:00Z","state":"okay","nightsKnown":12,
         "metrics":[\#(metrics)],"brief":[],"energy":{"hourly":[],"dipHour":null},"tonightTip":"t","nextMealTip":null,
         "conflict":\#(conflict ? #"{"text":"Ütközik.","suggestedTime":"18:30"}"# : "null"),
         "day":{"sleep":null,"bedtimeTarget":null,"deepSleepWeek":[],"restingHrWeek":[],
           "steps":null,"stepsGoal":10000,"activeKcal":null,
           "session":{"title":"Vállak és hát","time":"\#(time)","plannedTime":"17:30","minutes":60,"exercises":[]},
           "meals":[],"kcalSoFar":0,"kcalTarget":2400,"proteinG":0,"proteinTarget":150,"carbsG":0,"fatG":0,
           "checkins":[],"intention":{"creed":null,"foci":[]},"observations":[],
           "calendar":{"count":2,"busySlots":[]},"recovery":null}}
        """#
        return json
    }

    private var morning: Date {
        Calendar.current.date(bySettingHour: 8, minute: 0, second: 0, of: Date())!
    }

    @Test func dismissHidesTheProposalAndPersists() throws {
        let suite = "ProposalDeskTests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let brief = try conflictDay()
        let desk = ProposalDesk(defaults: defaults)
        let p = try #require(desk.pending(brief, now: morning, conflictKept: false).first)

        var toasts: [String] = []
        desk.dismiss(p, brief: brief) { toasts.append($0) }

        #expect(desk.pending(brief, now: morning, conflictKept: false).isEmpty)
        #expect(toasts == [MaText.dismissed])
        #expect(desk.state(of: p, brief, now: morning, conflictKept: false) == .dismissed(p.text))
        let key = Proposals.dismissKey(date: brief.date, id: p.id)
        #expect(defaults.string(forKey: ProposalDesk.dismissedKey) == key)
        // a fresh desk on the same defaults reads it back
        let again = ProposalDesk(defaults: defaults)
        #expect(again.dismissedRaw == key)
        #expect(again.pending(brief, now: morning, conflictKept: false).isEmpty)
    }

    @Test func dismissPrunesOtherDaysKeys() throws {
        let suite = "ProposalDeskTests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let old = [Proposals.dismissKey(date: "2026-11-08", id: "move-session"),
                   Proposals.dismissKey(date: "2026-11-09", id: "move-session")]
        defaults.set(old.joined(separator: "\n"), forKey: ProposalDesk.dismissedKey)
        let brief = try conflictDay()
        let desk = ProposalDesk(defaults: defaults)
        let p = try #require(desk.pending(brief, now: morning, conflictKept: false).first)
        desk.dismiss(p, brief: brief) { _ in }
        // only today's key survives the write: yesterday's never matter again
        #expect(defaults.string(forKey: ProposalDesk.dismissedKey) == Proposals.dismissKey(date: brief.date, id: p.id))
    }

    @Test func aKeptConflictHidesTheProposal() throws {
        let brief = try conflictDay()
        let desk = ProposalDesk(defaults: try #require(UserDefaults(suiteName: "ProposalDeskTests-\(UUID().uuidString)")))
        #expect(desk.pending(brief, now: morning, conflictKept: true).isEmpty)
        #expect(desk.shown(brief, now: morning, conflictKept: true).isEmpty)
        #expect(desk.shown(brief, now: morning, conflictKept: false).count == 1)
    }

    // MARK: Elfogadom (Review Focus 1)

    private func loadedStore(_ transport: DeskTransport) async -> MorningStore {
        let store = MorningStore(client: makeClient(tokens: MemoryTokenStore("t"), transport: transport), onUnauthorized: {})
        await store.load(date: morning)
        return store
    }

    private func context(_ log: ToastLog) -> MaiContext {
        MaiContext(hue: .mozgas, motion: OrbMotion(), voice: nil, speak: {},
                   toast: { log.items.append($0) }, undoToast: { t, _ in log.items.append("undo:" + t) },
                   now: morning, evening: false,
                   reminder: BedtimeReminder(center: NullReminderCenter(),
                                             defaults: UserDefaults(suiteName: "ProposalDeskTests-\(UUID().uuidString)")!),
                   toggleReminder: {}, drill: { _ in })
    }

    private func freshDesk() throws -> ProposalDesk {
        ProposalDesk(defaults: try #require(UserDefaults(suiteName: "ProposalDeskTests-\(UUID().uuidString)")))
    }

    @Test func acceptMovesTheSessionAndSettlesWithUndo() async throws {
        let transport = DeskTransport(move: .ok)
        let store = await loadedStore(transport)
        let brief = try #require(store.brief)
        let desk = try freshDesk()
        let log = ToastLog()
        let p = try #require(desk.pending(brief, now: morning, conflictKept: false).first)

        let task = desk.accept(p, brief: brief, store: store, ctx: context(log))
        #expect(desk.busy)
        await task?.value

        #expect(!desk.busy)
        #expect(log.items == ["undo:Áttettem 18:30-ra"])
        #expect(store.brief?.day.session?.time == "18:30")
        // the brief no longer sends it; it stays as the quiet accepted row
        let after = try #require(store.brief)
        #expect(desk.pending(after, now: morning, conflictKept: false).isEmpty)
        #expect(desk.state(of: p, after, now: morning, conflictKept: false) == .accepted(p.acceptedLine))
        #expect(desk.shown(after, now: morning, conflictKept: false).map(\.state) == [.accepted(p.acceptedLine)])
    }

    @Test(arguments: [DeskTransport.Move.offline, .notFound])
    func aFailedAcceptStaysPending(_ move: DeskTransport.Move) async throws {
        let store = await loadedStore(DeskTransport(move: move))
        let brief = try #require(store.brief)
        let desk = try freshDesk()
        let log = ToastLog()
        let p = try #require(desk.pending(brief, now: morning, conflictKept: false).first)

        await desk.accept(p, brief: brief, store: store, ctx: context(log))?.value

        #expect(!desk.busy)
        let expected = move == .offline ? "Most nem érem el a szervert, próbáld újra" : "Ma nincs edzés, amit áttehetnék"
        #expect(log.items == [expected])
        #expect(desk.settled.isEmpty)
        #expect(desk.state(of: p, try #require(store.brief), now: morning, conflictKept: false) == .pending)
    }

    @Test func acceptWhileAMoveIsInFlightDoesNothing() async throws {
        let transport = DeskTransport(move: .slow)
        let store = await loadedStore(transport)
        let brief = try #require(store.brief)
        let desk = try freshDesk()
        let log = ToastLog()
        let p = try #require(desk.pending(brief, now: morning, conflictKept: false).first)

        let other = Task { await store.moveSession(to: "18:30") }
        while !store.moving { await Task.yield() }
        let task = desk.accept(p, brief: brief, store: store, ctx: context(log))
        #expect(task == nil)
        #expect(!desk.busy)
        await other.value
        #expect(log.items.isEmpty)
        #expect(desk.settled.isEmpty)
        #expect(transport.moves == 1)
    }
}

/// Scripted morning endpoints for the accept tests (no shared static state, unlike the preview transport).
final class DeskTransport: ClientTransport, @unchecked Sendable {
    enum Move: Sendable { case ok, offline, notFound, slow }
    private let move: Move
    private let lock = NSLock()
    private var moved = false
    private var moveCount = 0
    var moves: Int { lock.withLock { moveCount } }

    init(move: Move) { self.move = move }

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        switch operationID {
        case "getBoopBrief", "regenerateBoopBrief":
            let isMoved = lock.withLock { moved }
            return Self.json(ProposalDeskTests.conflictJSON(time: isMoved ? "18:30" : "17:30", conflict: !isMoved))
        case "setSessionTime":
            lock.withLock { moveCount += 1 }
            switch move {
            case .offline: throw URLError(.notConnectedToInternet)
            case .notFound:
                var h = HTTPFields(); h[.contentType] = "application/json"
                return (HTTPResponse(status: .notFound, headerFields: h),
                        HTTPBody(#"[{"code":"BOOP_NO_PLANNED_SESSION","type":"REQUEST"}]"#))
            case .slow: try await Task.sleep(for: .milliseconds(300)); fallthrough
            case .ok:
                lock.withLock { moved = true }
                return Self.json(#"{"date":"2026-11-10","time":"18:30","plannedTime":"17:30"}"#)
            }
        default:
            return (HTTPResponse(status: .internalServerError), nil)
        }
    }

    private static func json(_ text: String) -> (HTTPResponse, HTTPBody?) {
        var h = HTTPFields(); h[.contentType] = "application/json"
        return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(text))
    }
}

private struct NullReminderCenter: ReminderCenter {
    func status() async -> ReminderPermission { .notDetermined }
    func request() async -> Bool { false }
    func schedule(id: String, hour: Int, minute: Int, title: String, body: String) async throws {}
    func scheduleOnce(id: String, on day: DateComponents, hour: Int, minute: Int, title: String, body: String, route: String) async throws {}
    func cancel(id: String) {}
    func isPending(id: String) async -> Bool { false }
    func pendingIds(withPrefix prefix: String) async -> [String] { [] }
    func removeDelivered(ids: [String]) {}
}
