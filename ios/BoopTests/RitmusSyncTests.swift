import Foundation
import Testing
import BoopCore
@testable import Boop

/// A server stand-in for the sync tests: no network, refusals by kind, a recording that cannot be written down.
private actor SyncSender: OutboxSender {
    private(set) var sent: [OutboxItem] = []
    private var offline = false
    private var refusing: Set<OutboxKind> = []
    private var voiceFails = false
    private var down = false
    func send(_ item: OutboxItem) async -> OutboxSendResult {
        if offline { return .offline }
        if down { return .retryLater }
        if refusing.contains(item.kind) { return .failed("HTTP 400") }
        if item.kind == .voice {
            if voiceFails { return .failed("no speech in the recording") }
            sent.append(item)
            return .sent(RitmusPayload.encode(VoiceTranscript(text: "Jól ment a nap.")))
        }
        sent.append(item)
        return .sent(nil)
    }
    func set(offline: Bool) { self.offline = offline }
    func refuse(_ kinds: Set<OutboxKind>) { refusing = kinds }
    func set(voiceFails: Bool) { self.voiceFails = voiceFails }
    /// The server answers 5xx to everything.
    func set(down: Bool) { self.down = down }
}

/// Holds a recording's send until released; its file is gone after the first delivery (as the real sender deletes it).
private actor VoiceGateSender: OutboxSender {
    private(set) var sent: [OutboxItem] = []
    private(set) var voiceStarted = false
    private var gate: CheckedContinuation<Void, Never>?
    private var delivered: Set<UUID> = []
    func send(_ item: OutboxItem) async -> OutboxSendResult {
        if item.kind == .voice {
            if delivered.contains(item.id) { return .failed("audio file missing") }
            voiceStarted = true
            await withCheckedContinuation { gate = $0 }
            delivered.insert(item.id)
            sent.append(item)
            return .sent(RitmusPayload.encode(VoiceTranscript(text: "Leeresztettem.")))
        }
        sent.append(item)
        return .sent(nil)
    }
    func release() { gate?.resume(); gate = nil }
}

/// Final review of B3: offline-first must hold end to end — travel offline, everything syncs later, nothing lost, and
/// what the server refuses is shown with *Újra* instead of a pending dot forever.
@MainActor
final class RitmusSyncTests {
    private static let budapest: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    private static func at(_ h: Int, _ m: Int = 0) -> Date {
        budapest.date(from: DateComponents(year: 2026, month: 11, day: 12, hour: h, minute: m))!
    }
    private let date = "2026-11-12"
    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("ritmus-sync-\(UUID().uuidString)")
    private let sender = SyncSender()
    deinit { try? FileManager.default.removeItem(at: root) }

    private func environment(now: Date = at(21, 32)) -> RitmusEnvironment {
        RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
            sender: sender, line: { _, _ in "Rendben." }, snapshot: { _ in CheckInSnapshotValue() }, plans: nil,
            closeLine: { _ in "Jó nap volt." }, clock: { now }, calendar: Self.budapest)
    }

    private func checkInFlow(_ env: RitmusEnvironment) async -> CheckinFlow {
        let flow = CheckinFlow(env: env)
        await flow.next(); await flow.quickExit()
        return flow
    }

    private func closes() async -> [DayClosePayload] {
        await sender.sent.filter { $0.kind == .dayClose }.compactMap { RitmusPayload.decodeForTests(DayClosePayload.self, $0.payload) }
    }

    /// Lets the observer's hop to the main actor land.
    private func settle(_ condition: () async -> Bool) async {
        for _ in 0..<500 where !(await condition()) { try? await Task.sleep(for: .milliseconds(2)) }
    }

    // MARK: - C1: the net coming back sends everything

    @Test func travelDayOfflineThenEverythingSyncs() async throws {
        let env = environment(now: Self.at(16, 2))
        await sender.set(offline: true)
        let flow = await checkInFlow(env)
        for _ in 0..<20 { await env.outbox.flush(ignoringBackoff: true) }   // every trigger of a long offline day
        #expect(flow.offline)
        #expect(await env.outbox.failed.isEmpty)
        await sender.set(offline: false)
        env.networkChanged(up: false)
        env.networkChanged(up: true)                                       // the path monitor: the net is back
        await settle { await env.outbox.pending.isEmpty }
        #expect(await sender.sent.map(\.kind) == [.checkIn])
        #expect(env.ledger.ledger(for: date).checkIns.first?.pending == false)
    }

    /// A flaky afternoon: the server kept answering "later" until the item ran out of tries. The net coming back gives
    /// it a fresh start — no Újra needed for something that was never refused.
    @Test func outOfTriesItemGoesWhenTheNetComesBack() async throws {
        let env = environment(now: Self.at(16, 2))
        await sender.set(down: true)
        let flow = await checkInFlow(env)
        for _ in 0..<Outbox.maxAttempts { await env.outbox.flush(ignoringBackoff: true) }
        #expect(await env.outbox.failed.count == 1)
        let c = try #require(flow.saved?.checkIn)
        await settle { env.refusal(forCheckIn: c, date: self.date) != nil }
        await sender.set(down: false)
        env.networkChanged(up: false)
        env.networkChanged(up: true)
        await settle { await env.outbox.queue.isEmpty }
        #expect(await env.outbox.queue.isEmpty)
        #expect(env.ledger.ledger(for: date).checkIns.first?.pending == false)
        await settle { env.refusal(forCheckIn: c, date: self.date) == nil }
        #expect(env.refusal(forCheckIn: c, date: date) == nil)
    }

    // MARK: - I1: a refusal is a row with Újra, not a pending dot forever

    @Test func refusedCheckInShowsRetryNotWaiting() async throws {
        let env = environment(now: Self.at(16, 2))
        await sender.refuse([.checkIn])
        let flow = await checkInFlow(env)
        let c = try #require(flow.saved?.checkIn)
        await settle { env.refusal(forCheckIn: c, date: self.date) != nil }
        #expect(!flow.offline)                                             // not "waiting for the net"
        #expect(!env.showsPending(try #require(env.ledger.ledger(for: date).checkIns.first), date: date))                          // no "még a telefonon" glyph next to the row
        let refused = try #require(env.refusal(forCheckIn: c, date: date))
        await sender.refuse([])
        await env.retry([refused])
        #expect(env.refusal(forCheckIn: c, date: date) == nil)
        #expect(env.ledger.ledger(for: date).checkIns.first?.pending == false)
    }

    @Test func refusedVoiceNoteIsTheCheckInsRow() async throws {
        let env = environment(now: Self.at(16, 2))
        let flow = await checkInFlow(env)
        let c = try #require(flow.saved?.checkIn)
        await sender.set(voiceFails: true)
        #expect(await flow.addVoiceNote(fileName: "note.m4a") == .failed)
        await settle { env.refusal(forCheckIn: c, date: self.date) != nil }
        #expect(env.refusal(forCheckIn: c, date: date) != nil)
    }

    @Test func refusedGoalShowsRetry() async throws {
        let env = environment(now: Self.at(8, 10))
        await sender.refuse([.goal])
        try await env.setGoal("Ügyfélprezentáció", date: date)
        await settle { env.goalRefusal(on: self.date) != nil }
        let refused = try #require(env.goalRefusal(on: date))
        await sender.refuse([])
        await env.retry([refused])
        #expect(env.goalRefusal(on: date) == nil)
        #expect(env.ledger.ledger(for: date).goal?.pending == false)
    }

    @Test func refusedCloseAndTypedJournalShowRetry() async throws {
        let env = environment()
        await sender.refuse([.dayClose, .journal])
        let f = EsteFlow(env: env, brief: nil)
        f.pickRating(4)
        f.typed("Fáradt vagyok.")
        await f.closeDay()
        await settle { f.sendFailed }
        #expect(f.sendFailed)
        #expect(!f.offline)
        #expect(f.boopText == EsteFlow.refusedLine)
        await sender.refuse([])
        await f.retrySend()
        #expect(!f.sendFailed)
        #expect(env.ledger.ledger(for: date).close?.pending == false)
        #expect(await closes().last?.journalClientRef != nil)              // the line is linked after all
    }

    // MARK: - I2: an offline re-close is not undone by the old relink

    @Test func offlineReCloseRewritesTheQueuedRelink() async throws {
        let env = environment()
        await sender.set(offline: true)
        let f = EsteFlow(env: env, brief: nil)
        f.pickEnergy(7); f.pickRating(4)
        f.typed("Első változat.")
        await f.closeDay()
        f.reopen()
        f.pickEnergy(3); f.pickRating(2)
        await f.closeDay()                                                // Módosítom, still offline, no new line
        await sender.set(offline: false)
        await env.outbox.flush(ignoringBackoff: true)
        let sent = await closes()
        #expect(sent.count == 2)                                          // the close, then its relink
        #expect(sent.allSatisfy { $0.dayRating == 2 && $0.eveningEnergy == 3 })
        #expect(sent.last?.journalClientRef != nil)
    }

    @Test func failedReCloseRestoresTheQueuedClose() async throws {
        let env = environment()
        await sender.set(offline: true)
        let f = EsteFlow(env: env, brief: nil)
        f.pickRating(4)
        await f.closeDay()
        let closeId = try #require(env.ledger.ledger(for: date).close?.id)
        // the queue can no longer be written (a folder sits where the file goes)
        let queue = root.appendingPathComponent("outbox/queue.json")
        try FileManager.default.removeItem(at: queue)
        try FileManager.default.createDirectory(at: queue.appendingPathComponent("blocked"), withIntermediateDirectories: true)
        f.reopen()
        f.pickRating(1)
        await f.closeDay()
        #expect(f.saveProblem != nil)
        let queued = try #require(await env.outbox.queued(closeId))
        #expect(RitmusPayload.decodeForTests(DayClosePayload.self, queued.payload)?.dayRating == 4)
        #expect(env.ledger.ledger(for: date).close?.dayRating == 4)
    }

    // MARK: - I3: a recording retried after its relink went out is linked again

    @Test func voiceRetriedAfterItsRelinkWentOutIsLinkedAgain() async throws {
        let env = environment()
        await sender.set(voiceFails: true)
        let f = EsteFlow(env: env, brief: nil)
        f.pickRating(4)
        f.recorded(.recording(fileName: "v.m4a"))
        await f.closeDay()
        await settle { f.journalQuote == .transcriptFailed }
        #expect(f.journalQuote == .transcriptFailed)
        let voiceId = try #require(env.ledger.ledger(for: date).close?.journalId)
        await sender.set(voiceFails: false)
        await env.outbox.retry(voiceId)                                   // not through the flow: the state follows anyway
        await settle { f.journalQuote == .text("Jól ment a nap.") }
        #expect(f.journalQuote == .text("Jól ment a nap."))
        // a fresh relink went out after the transcript (the first one left while the recording was failed)
        let sent = await sender.sent
        let voiceAt = try #require(sent.firstIndex { $0.id == voiceId })
        let relinkAfter = sent[(voiceAt + 1)...].first { $0.kind == .dayClose }
        #expect(relinkAfter.flatMap { RitmusPayload.decodeForTests(DayClosePayload.self, $0.payload) }?.journalClientRef == voiceId)
    }

    // MARK: - M1: a signed-out environment sends nothing more

    @Test func retiredEnvironmentSendsNothing() async throws {
        let env = environment(now: Self.at(16, 2))
        env.retire()
        _ = await checkInFlow(env)
        await env.outbox.flush(ignoringBackoff: true)
        #expect(await sender.sent.isEmpty)
        #expect(await env.outbox.pending.count == 1)                      // kept for when that user signs in again
    }

    // MARK: - M3: a queued voice note never brings back the old values of a redone slot

    @Test func redoneSlotCarriesTheQueuedVoiceNote() async throws {
        let env = environment(now: Self.at(16, 2))
        await sender.set(offline: true)
        let first = await checkInFlow(env)                                // energy 5
        #expect(await first.addVoiceNote(fileName: "note.m4a") == .waiting)
        let redo = CheckinFlow(env: env)
        redo.beginSwipe(); _ = redo.swipe(dy: -52); redo.endSwipe()       // energy 7
        await redo.next(); await redo.quickExit()
        await sender.set(offline: false)
        await env.outbox.flush(ignoringBackoff: true)
        let voice = try #require(await sender.sent.first { $0.kind == .voice })
        guard case .checkInNote(let p) = RitmusPayload.decodeForTests(VoicePayload.self, voice.payload)?.target else {
            Issue.record("voice should target the check-in note"); return
        }
        #expect(p.values["energy"] == 7)
        let lastCheckIn = await sender.sent.last { $0.kind == .checkIn || $0.kind == .voice }
        #expect(lastCheckIn?.kind == .voice)                              // the note rides on the redo, after it
    }

    /// Re-review item 4: a recording already on its way when the slot is redone is not moved (its moved copy would find
    /// the audio gone and end refused); it lands as it is, and the redo follows.
    @Test func recordingInFlightDuringARedoIsNotMoved() async throws {
        let gated = VoiceGateSender()
        let now = Self.at(16, 2)
        let env = RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
            sender: gated, line: { _, _ in "Rendben." }, snapshot: { _ in CheckInSnapshotValue() }, plans: nil,
            clock: { now }, calendar: Self.budapest)
        let first = await checkInFlow(env)
        let note = Task { await first.addVoiceNote(fileName: "note.m4a") }
        await settle { await gated.voiceStarted }
        let redo = CheckinFlow(env: env)
        await redo.next(); await redo.quickExit()
        await gated.release()
        _ = await note.value
        await env.outbox.flush(ignoringBackoff: true)
        #expect(await env.outbox.failed.isEmpty)
        #expect(await env.outbox.queue.isEmpty)
        #expect(await gated.sent.filter { $0.kind == .voice }.count == 1)
        #expect(await gated.sent.last?.kind == .checkIn)                 // the redo has the last word on the values
    }

    /// Re-review ruling: while the path monitor says the network is down, nothing is tried (and nothing counted).
    @Test func pathDownSendsNothing() async throws {
        let env = environment(now: Self.at(16, 2))
        env.networkChanged(up: false)
        let flow = await checkInFlow(env)
        #expect(flow.offline)
        #expect(await sender.sent.isEmpty)
        #expect(await env.outbox.pending.first?.attempts == 0)
        env.networkChanged(up: true)
        await settle { await env.outbox.pending.isEmpty }
        #expect(await sender.sent.map(\.kind) == [.checkIn])
    }
}

extension RitmusPayload {
    static func decodeForTests<T: Decodable>(_ type: T.Type, _ data: Data) -> T? {
        let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601
        return try? d.decode(type, from: data)
    }
}
