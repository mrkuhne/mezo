import Foundation
import Testing
@testable import BoopCore

/// A settable clock the outbox reads through its injected closure.
final class TestClock: @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date
    init(_ start: Date) { current = start }
    var now: Date { lock.withLock { current } }
    func advance(_ seconds: TimeInterval) { lock.withLock { current = current.addingTimeInterval(seconds) } }
}

/// Answers each send from a script (default `.sent`) and records what was sent.
actor FakeSender: OutboxSender {
    private var script: [OutboxSendResult]
    private(set) var sent: [OutboxItem] = []
    /// Items that always answer `retryLater` (a poison item).
    private var stuck: Set<UUID> = []
    init(_ script: [OutboxSendResult] = []) { self.script = script }
    func send(_ item: OutboxItem) async -> OutboxSendResult {
        sent.append(item)
        if noNetwork { return .offline }
        if stuck.contains(item.id) { return .retryLater }
        if refusedIds.contains(item.id) { return .failed("HTTP 400") }
        return script.isEmpty ? .sent(nil) : script.removeFirst()
    }
    /// Items that always answer `failed("HTTP 400")`.
    private var refusedIds: Set<UUID> = []
    func stick(_ id: UUID) { stuck.insert(id) }
    func unstick(_ id: UUID) { stuck.remove(id) }
    func refuse(_ id: UUID) { refusedIds.insert(id) }
    func clear() { sent = [] }
    /// While set, every send answers `offline` (no network).
    private var noNetwork = false
    func setOffline(_ on: Bool) { noNetwork = on }
}

final class OutboxTests {
    let dir = temporaryDirectory()
    let time = TestClock(at(16, 2))
    deinit { try? FileManager.default.removeItem(at: dir) }

    func item(_ kind: OutboxKind = .checkIn, date: String = "2026-11-10", text: String = "x") -> OutboxItem {
        OutboxItem(kind: kind, date: date, capturedAt: time.now, payload: Data(text.utf8))
    }
    func outbox(_ sender: FakeSender) -> Outbox {
        let c = time
        return Outbox(directory: dir, sender: sender, clock: { c.now }, calendar: budapest)
    }

    @Test func survivesRelaunch() async throws {
        let first = outbox(FakeSender())
        let queued = item(text: "energy 6")
        try await first.enqueue(queued)
        let second = outbox(FakeSender())
        let pending = await second.pending
        #expect(pending == [queued])
    }

    @Test func flushSendsInOrder() async throws {
        let sender = FakeSender()
        let box = outbox(sender)
        let a = item(.journal), b = item(.dayClose), c = item(.goal)
        try await box.enqueue(a); try await box.enqueue(b); try await box.enqueue(c)
        await box.flush()
        #expect(await sender.sent.map(\.id) == [a.id, b.id, c.id])
        #expect(await box.pending.isEmpty)
        #expect(await outbox(FakeSender()).pending.isEmpty) // sent items leave the persisted queue too
    }

    @Test func retryAfterLostResponseSendsSameClientRef() async throws {
        let sender = FakeSender([.retryLater])
        let box = outbox(sender)
        let queued = item()
        try await box.enqueue(queued)
        await box.flush()
        #expect(await box.pending.map(\.id) == [queued.id])
        time.advance(31)
        await box.flush()
        let sent = await sender.sent
        #expect(sent.count == 2)
        #expect(sent.map(\.id) == [queued.id, queued.id])
        #expect(sent[1].payload == queued.payload)
        #expect(await box.pending.isEmpty)
    }

    @Test func fourHundredMarksFailedNotDropped() async throws {
        let sender = FakeSender([.failed("400 date")])
        let box = outbox(sender)
        let bad = item(text: "bad"), good = item(text: "good")
        try await box.enqueue(bad); try await box.enqueue(good)
        await box.flush()
        let failed = await box.failed
        #expect(failed.map(\.id) == [bad.id])
        #expect(failed.first?.failure == "400 date")
        #expect(failed.first?.payload == bad.payload)
        #expect(await box.pending.isEmpty) // a failed item does not block the ones behind it
        #expect(await sender.sent.map(\.id) == [bad.id, good.id])
        // Failed survives a relaunch, and "Újra" sends it again.
        let reopened = outbox(sender)
        #expect(await reopened.failed.map(\.id) == [bad.id])
        await reopened.retry(bad.id)
        #expect(await reopened.failed.isEmpty)
        #expect(await sender.sent.map(\.id) == [bad.id, good.id, bad.id])
    }

    @Test func conflictAndRateLimitRetryWithBackoff() async throws {
        let sender = FakeSender([.retryLater, .retryLater])
        let box = outbox(sender)
        let first = item(.journal), behind = item(.dayClose) // the close relinks the journal: it waits
        try await box.enqueue(first); try await box.enqueue(behind)
        await box.flush()
        var head = await box.pending.first
        #expect(head?.attempts == 1)
        #expect(head?.nextAttempt == time.now.addingTimeInterval(30))
        #expect(await sender.sent.map(\.id) == [first.id]) // the queue keeps its order behind a retry

        time.advance(10)
        await box.flush()
        #expect(await sender.sent.count == 1) // not due yet

        time.advance(25)
        await box.flush()
        head = await box.pending.first
        #expect(head?.attempts == 2)
        #expect(head?.nextAttempt == time.now.addingTimeInterval(60))

        time.advance(60)
        await box.flush()
        #expect(await sender.sent.map(\.id) == [first.id, first.id, first.id, behind.id])
        #expect(await box.pending.isEmpty)
    }

    @Test func backoffCapsAtThirtyMinutes() {
        #expect(Outbox.backoff(attempts: 1) == 30)
        #expect(Outbox.backoff(attempts: 2) == 60)
        #expect(Outbox.backoff(attempts: 6) == 960)
        #expect(Outbox.backoff(attempts: 7) == 1800)
        #expect(Outbox.backoff(attempts: 40) == 1800)
    }

    @Test func olderThanSevenDaysMarkedFailed() async throws {
        let sender = FakeSender()
        let box = outbox(sender)
        let old = item(date: "2026-11-02"), edge = item(date: "2026-11-03")
        try await box.enqueue(old); try await box.enqueue(edge)
        await box.flush()
        let failed = await box.failed
        #expect(failed.map(\.id) == [old.id])
        #expect(failed.first?.payload == old.payload) // values kept
        #expect(failed.first?.failure != nil)
        #expect(await sender.sent.map(\.id) == [edge.id]) // today − 7 is still sent
    }

    @Test func enqueueingTheSameIdReplacesInPlace() async throws {
        let sender = FakeSender()
        let box = outbox(sender)
        var a = item(text: "v1")
        let b = item()
        try await box.enqueue(a); try await box.enqueue(b)
        a.payload = Data("v2".utf8)
        try await box.enqueue(a)
        #expect(await box.pending.map(\.id) == [a.id, b.id])
        #expect(await box.pending.first?.payload == Data("v2".utf8))
    }

    @Test func deliveredItemsAreReported() async throws {
        actor Heard { var ids: [UUID] = []; func add(_ id: UUID) { ids.append(id) } }
        let heard = Heard()
        let c = time
        let box = Outbox(directory: dir, sender: FakeSender([.sent(nil), .failed("400")]), clock: { c.now },
                         calendar: budapest, onSent: { item, _ in await heard.add(item.id) })
        let ok = item(), bad = item()
        try await box.enqueue(ok); try await box.enqueue(bad)
        await box.flush()
        #expect(await heard.ids == [ok.id])
    }

    @Test func waitingItemHoldsOnlyItsDependents() async throws {
        let sender = FakeSender([.retryLater])
        let box = outbox(sender)
        let checkIn = item(.checkIn), note = item(.checkInNote), close = item(.dayClose)
        let otherSlot = item(.checkIn), goal = item(.goal), chat = item(.chatQuestion)
        let otherDay = item(.checkInNote, date: "2026-11-09")
        for i in [checkIn, note, otherSlot, goal, chat, close, otherDay] { try await box.enqueue(i) }
        await box.flush()
        #expect(await sender.sent.map(\.id) == [checkIn.id, otherSlot.id, goal.id, chat.id, otherDay.id])
        #expect(await box.pending.map(\.id) == [checkIn.id, note.id, close.id])
        time.advance(31)
        await box.flush()
        #expect(await sender.sent.map(\.id).suffix(3) == [checkIn.id, note.id, close.id])
        #expect(await box.pending.isEmpty)
    }

    @Test func poisonItemFailsAfterEightAttempts() async throws {
        let sender = FakeSender()
        let box = outbox(sender)
        let poison = item(.chatQuestion), unrelated = item(.goal)
        await sender.stick(poison.id)
        try await box.enqueue(poison); try await box.enqueue(unrelated)
        await box.flush()
        #expect(await sender.sent.map(\.id) == [poison.id, unrelated.id]) // not held behind the poison item
        for _ in 1..<Outbox.maxAttempts {
            #expect(await box.failed.isEmpty)
            time.advance(31 * 60)
            await box.flush()
        }
        let failed = await box.failed
        #expect(failed.map(\.id) == [poison.id])
        #expect(failed.first?.attempts == Outbox.maxAttempts)
        #expect(failed.first?.payload == poison.payload)
        let sent = await sender.sent.map(\.id)
        #expect(sent.filter { $0 == poison.id }.count == Outbox.maxAttempts)
        #expect(sent.contains(unrelated.id))
    }

    @Test func flushIgnoringBackoffSendsNow() async throws {
        let sender = FakeSender([.retryLater])
        let box = outbox(sender)
        let queued = item()
        try await box.enqueue(queued)
        await box.flush()
        await box.flush()
        #expect(await sender.sent.count == 1) // in backoff
        await box.flush(ignoringBackoff: true)
        #expect(await sender.sent.count == 2)
        #expect(await box.pending.isEmpty)
    }

    @Test func unreadableQueueIsMovedAsideNotOverwritten() async throws {
        let garbage = Data("{ not json".utf8)
        try garbage.write(to: dir.appendingPathComponent("queue.json"))
        let box = outbox(FakeSender())
        #expect(await box.pending.isEmpty)
        try await box.enqueue(item())
        let aside = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasPrefix("queue.corrupt-") }
        #expect(aside.count == 1)
        #expect(try Data(contentsOf: dir.appendingPathComponent(aside[0])) == garbage)
        #expect(await outbox(FakeSender()).pending.count == 1)
    }

    @Test func oneUndecodableItemDoesNotTakeDownTheRest() async throws {
        let good = item(text: "good")
        let goodJSON = String(decoding: try JSONEncoder().encode(good), as: UTF8.self)
        let file = "[\(goodJSON), {\"id\": \"broken\", \"kind\": \"telepathy\"}]"
        try Data(file.utf8).write(to: dir.appendingPathComponent("queue.json"))
        let box = outbox(FakeSender())
        #expect(await box.pending == [good])
        let aside = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasPrefix("queue.unreadable-") }
        #expect(aside.count == 1)
        let kept = try String(contentsOf: dir.appendingPathComponent(aside[0]), encoding: .utf8)
        #expect(kept.contains("telepathy"))
    }

    /// B3 Task 8 fix: a delivery whose id was re-queued meanwhile (a note on an in-flight check-in) must not clear
    /// the ledger's pending flag — `isQueued` tells the listener a newer version is still waiting.
    @Test func newerVersionStillQueuedAtDelivery() async throws {
        final class Ref: @unchecked Sendable { var box: Outbox? }
        actor Seen { var queued: [Bool] = []; func add(_ b: Bool) { queued.append(b) } }
        actor HookSender: OutboxSender {
            var hook: (@Sendable () async -> Void)?
            func set(_ h: @escaping @Sendable () async -> Void) { hook = h }
            func send(_ item: OutboxItem) async -> OutboxSendResult {
                if let h = hook { hook = nil; await h() }
                return .sent(nil)
            }
        }
        let ref = Ref(), seen = Seen(), sender = HookSender()
        let c = time
        let box = Outbox(directory: dir, sender: sender, clock: { c.now }, calendar: budapest,
                         onSent: { item, _ in await seen.add(await ref.box?.isQueued(item.id) ?? false) })
        ref.box = box
        var first = item(.checkIn, text: "v1")
        try await box.enqueue(first)
        #expect(await box.isQueued(first.id))
        first.kind = .checkInNote; first.payload = Data("v2".utf8)
        let newer = first
        await sender.set { try? await box.enqueue(newer) }
        await box.flush()
        #expect(await seen.queued == [true, false])
        #expect(await !box.isQueued(first.id))
    }

    // MARK: - Final review C1: an offline day never burns the attempt cap

    /// A travel day: every flush trigger finds no network. Nothing counts as an attempt, nothing fails, and when the
    /// net comes back everything goes out.
    @Test func offlineFlushesNeverBurnTheAttemptCap() async throws {
        let sender = FakeSender()
        await sender.setOffline(true)
        let box = outbox(sender)
        let checkIn = item(.checkIn), close = item(.dayClose)
        try await box.enqueue(checkIn); try await box.enqueue(close)
        for _ in 0..<20 {
            time.advance(60)
            await box.flush(ignoringBackoff: true)
        }
        #expect(await box.failed.isEmpty)
        #expect(await box.pending.map(\.attempts) == [0, 0])
        // no network: the drain stopped at the first item instead of trying the rest
        #expect(await sender.sent.allSatisfy { $0.id == checkIn.id })
        await sender.clear()
        await sender.setOffline(false)
        await box.networkReturned()
        #expect(await sender.sent.map(\.id) == [checkIn.id, close.id])
        #expect(await box.pending.isEmpty)
    }

    /// The net coming back clears what ran out of tries (a server down for hours), never a refusal (a 4xx).
    @Test func networkReturnRevivesExhaustedButNotRefused() async throws {
        let sender = FakeSender()
        let box = outbox(sender)
        let poison = item(.goal), refused = item(.checkIn)
        await sender.stick(poison.id)
        await sender.refuse(refused.id)
        try await box.enqueue(poison); try await box.enqueue(refused)
        for _ in 0..<Outbox.maxAttempts {
            await box.flush()
            time.advance(31 * 60)
        }
        #expect(Set(await box.failed.map(\.id)) == [poison.id, refused.id])
        await sender.unstick(poison.id)
        await box.networkReturned()
        #expect(await box.failed.map(\.id) == [refused.id])
        #expect(await box.pending.isEmpty)
    }

    /// The attempt counts against the version that was sent: a newer version enqueued while it was out starts fresh.
    @Test func retryLaterOnAReplacedItemDoesNotCountAgainstTheNewVersion() async throws {
        actor HookSender: OutboxSender {
            var hook: (@Sendable () async -> Void)?
            func set(_ h: @escaping @Sendable () async -> Void) { hook = h }
            func send(_ item: OutboxItem) async -> OutboxSendResult {
                if let h = hook { hook = nil; await h() }
                return .retryLater
            }
        }
        let sender = HookSender()
        let c = time
        let box = Outbox(directory: dir, sender: sender, clock: { c.now }, calendar: budapest)
        var first = item(.checkIn, text: "v1")
        try await box.enqueue(first)
        first.payload = Data("v2".utf8)
        let newer = first
        await sender.set { try? await box.enqueue(newer) }
        await box.flush()
        let queued = await box.pending
        #expect(queued.map(\.payload) == [newer.payload])
        #expect(queued.first?.attempts == 0)
        #expect(queued.first?.nextAttempt == nil)
    }

    /// Final review I1: the UI hears which items stopped (refused or out of tries), and when that changes.
    @Test func failureObserverHearsChanges() async throws {
        actor Heard { var lists: [[UUID]] = []; func add(_ l: [UUID]) { lists.append(l) } }
        let heard = Heard()
        let sender = FakeSender([.failed("HTTP 400")])
        let box = outbox(sender)
        await box.observeFailures { failed in await heard.add(failed.map(\.id)) }
        let refused = item(.checkIn)
        try await box.enqueue(refused)
        await box.flush()
        await box.retry(refused.id)
        #expect(await heard.lists == [[], [refused.id], []])
    }

    /// Re-review item 4: the outbox says which item is out right now, so a redo never moves a recording mid-send.
    @Test func inFlightNamesTheItemBeingSent() async throws {
        final class Ref: @unchecked Sendable { var box: Outbox? }
        actor Seen { var ids: [UUID?] = []; func add(_ i: UUID?) { ids.append(i) } }
        actor PeekSender: OutboxSender {
            let ref: Ref, seen: Seen
            init(_ r: Ref, _ s: Seen) { ref = r; seen = s }
            func send(_ item: OutboxItem) async -> OutboxSendResult { await seen.add(await ref.box?.inFlight); return .sent(nil) }
        }
        let ref = Ref(), seen = Seen()
        let c = time
        let box = Outbox(directory: dir, sender: PeekSender(ref, seen), clock: { c.now }, calendar: budapest)
        ref.box = box
        let a = item(.checkIn)
        try await box.enqueue(a)
        await box.flush()
        #expect(await seen.ids == [a.id])
        #expect(await box.inFlight == nil)
    }
}
