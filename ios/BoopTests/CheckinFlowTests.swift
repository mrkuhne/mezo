import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// A settable clock the environment reads through its injected closure.
private final class FlowClock: @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date
    init(_ start: Date) { current = start }
    var now: Date { lock.withLock { current } }
    func set(_ d: Date) { lock.withLock { current = d } }
}

/// Records every sent item; `.retryLater` for all when offline.
private actor RecordingSender: OutboxSender {
    private(set) var sent: [OutboxItem] = []
    var offline = false
    func send(_ item: OutboxItem) async -> OutboxSendResult {
        if offline { return .retryLater }
        sent.append(item)
        return .sent(nil)
    }
    func goOffline() { offline = true }
}

/// Delivers everything; a `voice` item comes back with its transcript, as the server's transcription would answer.
private actor TranscribingSender: OutboxSender {
    func send(_ item: OutboxItem) async -> OutboxSendResult {
        item.kind == .voice ? .sent(RitmusPayload.encode(VoiceTranscript(text: "Leeresztettem."))) : .sent(nil)
    }
}

/// Holds every send until the test lets it go (one at a time).
private actor GatedSender: OutboxSender {
    private(set) var started = 0
    private var gates: [CheckedContinuation<Void, Never>] = []
    func send(_ item: OutboxItem) async -> OutboxSendResult {
        started += 1
        await withCheckedContinuation { gates.append($0) }
        return .sent(nil)
    }
    func releaseOne() { if !gates.isEmpty { gates.removeFirst().resume() } }
}

/// The check-in flow (B3 Task 8, spec §5.2/§6/§7.2) at view-model level: what is asked, what is sent, what is shown.
@MainActor
final class CheckinFlowTests {
    private static let budapest: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    private static func at(_ h: Int, _ m: Int = 0) -> Date {
        budapest.date(from: DateComponents(year: 2026, month: 11, day: 12, hour: h, minute: m))!
    }

    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("checkin-flow-\(UUID().uuidString)")
    private let clock = FlowClock(at(16, 2))
    private let sender = RecordingSender()
    deinit { try? FileManager.default.removeItem(at: root) }

    private func environment(line: String = "Délben még 6 voltál, most 5.", sender custom: OutboxSender? = nil,
                             user: String = "ledger") -> RitmusEnvironment {
        let c = clock
        return RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent(user), outboxDirectory: root.appendingPathComponent("outbox-\(user)"),
            sender: custom ?? sender, line: { _, _ in line }, snapshot: { _ in CheckInSnapshotValue(hrBpm: 78, hrvMs: 38, hrvUsualMs: 50) },
            plans: nil, clock: { c.now }, calendar: Self.budapest)
    }

    private func payloads() async -> [CheckInPayload] {
        await sender.sent.compactMap { try? JSONDecoder.iso.decode(CheckInPayload.self, from: $0.payload) }
    }

    // MARK: - Tap budget (spec §6)

    @Test func rushedCheckInSavesEnergyOnlyWithQuickExit() async throws {
        let flow = CheckinFlow(env: environment())
        #expect(flow.current.key == "energy")
        #expect(!flow.canQuickExit)                 // "Most csak ennyi" only from the second item
        flow.beginSwipe(); _ = flow.swipe(dy: -26); flow.endSwipe()   // one step up: 6
        await flow.next()                           // Tovább
        #expect(flow.current.key == "mood")
        #expect(flow.canQuickExit)
        await flow.quickExit()                      // Most csak ennyi

        let sent = await payloads()
        #expect(sent.count == 1)
        let p = try #require(sent.first)
        #expect(p.values == ["energy": 6])
        #expect(p.askedItems == ["energy", "mood"])
        #expect(p.quickExit)
        #expect(p.slot == "14:00")
        #expect(p.snapshot?.hrBpm == 78)
        #expect(flow.saved != nil)
    }

    @Test func unchangedItemNeedsNoSwipe() async throws {
        let env = environment()
        try env.ledger.saveCheckIn(LedgerCheckIn(id: UUID(), slot: "10:00", capturedAt: Self.at(12, 40),
                                                 values: ["energy": 6, "mood": 7]), date: "2026-11-12")
        let flow = CheckinFlow(env: env)
        #expect(flow.value == 6)                    // starts from the last answer of the day
        await flow.next()
        #expect(flow.value == 7)
        await flow.next()
        #expect(flow.value == 5)                    // never answered today: 5
        await flow.quickExit()
        let p = try #require(await payloads().first)
        #expect(p.values == ["energy": 6, "mood": 7])
        #expect(p.askedItems == ["energy", "mood", "stress"])
    }

    @Test func skippedItemNotSent() async throws {
        let flow = CheckinFlow(env: environment())
        await flow.next()                           // energy 5
        flow.beginSwipe(); _ = flow.swipe(dy: 52); flow.endSwipe()    // mood swiped to 3 …
        #expect(flow.value == 3)
        await flow.skip()                           // … then Kihagyom
        while flow.saved == nil { await flow.next() }
        let p = try #require(await payloads().first)
        #expect(p.values["mood"] == nil)
        #expect(p.values["energy"] == 5)
        #expect(p.askedItems.contains("mood"))      // shown, so asked
        #expect(!p.quickExit)
    }

    @Test func swipeIsClampedAndCountsSteps() {
        let flow = CheckinFlow(env: environment())
        flow.beginSwipe()
        #expect(flow.swipe(dy: -12) == false)       // under half a step: no change, no haptic
        #expect(flow.swipe(dy: -40) == true)        // 1.5 steps rounds to 2: 7
        #expect(flow.value == 7)
        _ = flow.swipe(dy: -400)
        #expect(flow.value == 10)
        _ = flow.swipe(dy: 400)
        #expect(flow.value == 1)
        flow.endSwipe()
    }

    // MARK: - Slots (spec §7.2)

    @Test func secondCheckInSameMomentAsksBeforeOverwrite() async throws {
        let env = environment()
        clock.set(Self.at(12, 40))
        let first = CheckinFlow(env: env)
        #expect(first.overwriteNotice == nil)
        await first.next(); await first.quickExit()

        clock.set(Self.at(13, 10))
        let second = CheckinFlow(env: env)
        #expect(second.overwriteNotice == "A délit már kitöltötted 12:40-kor — felülírod?")
        second.beginSwipe(); _ = second.swipe(dy: 78); second.endSwipe()  // 5 → 2
        await second.next(); await second.quickExit()

        let day = env.ledger.ledger(for: "2026-11-12")
        #expect(day.checkIns.count == 1)
        #expect(day.checkIns.first?.slot == "10:00")
        #expect(day.checkIns.first?.values["energy"] == 2)
    }

    // MARK: - Item kinds (spec §5.2)

    @Test func painQuestionShowsGateThenRegions() async throws {
        let env = environment()
        env.ledger.cachePlans([CheckInPlanLite(slot: "14:00", adaptiveItem: "pain", adaptiveWhy: "Tegnap fájt a térded.")],
                              date: "2026-11-12")
        let flow = CheckinFlow(env: env)
        for _ in 0..<5 { await flow.next() }
        #expect(flow.current.key == "pain")
        #expect(flow.current.why == "Tegnap fájt a térded.")
        #expect(flow.painStage == .gate)
        await flow.answerPain(true)
        #expect(flow.painStage == .details)
        #expect(flow.current.options.map(\.id).contains("TERD"))
        flow.toggleOption("TERD")
        flow.beginSwipe(); _ = flow.swipe(dy: -52); flow.endSwipe()   // intensity 7
        #expect(flow.isLast)
        await flow.next()                                             // Kész

        let p = try #require(await payloads().first)
        #expect(p.pain == true)
        #expect(p.painRegions == ["TERD"])
        #expect(p.painIntensity == 7)
        #expect(p.values["pain"] == nil)
        #expect(p.adaptiveItem == "pain")
        #expect(p.askedItems.last == "pain")
    }

    @Test func painNoMovesOnWithoutDetails() async throws {
        let env = environment()
        env.ledger.cachePlans([CheckInPlanLite(slot: "14:00", adaptiveItem: "pain", adaptiveWhy: nil)], date: "2026-11-12")
        let flow = CheckinFlow(env: env)
        for _ in 0..<5 { await flow.next() }
        await flow.answerPain(false)                // last item: "Nem" saves
        let p = try #require(await payloads().first)
        #expect(p.pain == false)
        #expect(p.painRegions.isEmpty)
        #expect(p.painIntensity == nil)
    }

    @Test func cravingKeepsScaleAndKinds() async throws {
        let env = environment()
        env.ledger.cachePlans([CheckInPlanLite(slot: "14:00", adaptiveItem: "craving", adaptiveWhy: nil)], date: "2026-11-12")
        let flow = CheckinFlow(env: env)
        for _ in 0..<5 { await flow.next() }
        #expect(flow.current.kind == .craving)
        flow.toggleOption("EDES"); flow.toggleOption("SOS"); flow.toggleOption("SOS")
        await flow.next()
        let p = try #require(await payloads().first)
        #expect(p.values["craving"] == 5)
        #expect(p.cravingKinds == ["EDES"])
    }

    // MARK: - After saving (spec §5.2, §7.1, §7.2)

    @Test func onlineSaveClearsPendingAndBringsBoopsLine() async throws {
        let env = environment(line: "Egyél egy banánt.")
        let flow = CheckinFlow(env: env)
        await flow.next(); await flow.quickExit()
        #expect(flow.line == .line("Egyél egy banánt."))
        #expect(!flow.offline)
        #expect(env.ledger.ledger(for: "2026-11-12").checkIns.first?.pending == false)
        #expect(flow.savedTimeLabel == "MENTVE · 16:02")
    }

    @Test func offlineSaveStaysPendingWithCalmLine() async throws {
        await sender.goOffline()
        let env = environment()
        let flow = CheckinFlow(env: env)
        await flow.next(); await flow.quickExit()
        #expect(flow.offline)
        #expect(flow.line == .offline("Megvan. Amint lesz net, megnézem a délutánodat, és szólok."))
        #expect(env.ledger.ledger(for: "2026-11-12").checkIns.first?.pending == true)
        #expect(env.ledger.ledger(for: "2026-11-12").curvePoints.first?.pending == true)
    }

    @Test func noteIsAFollowUpOfTheSameSlot() async throws {
        let env = environment()
        let flow = CheckinFlow(env: env)
        await flow.next(); await flow.quickExit()
        let id = try #require(flow.saved?.checkIn.id)
        await flow.addNote("  A workshop után leeresztettem.  ")
        let sent = await sender.sent
        #expect(sent.count == 2)
        #expect(sent.last?.kind == .checkInNote)
        #expect(sent.last?.id == id)                                // same client ref: clears the same pending row
        #expect(sent.last?.capturedAt == sent.first?.capturedAt)    // the dot does not move on the curve
        let p = try #require(await payloads().last)
        #expect(p.note == "A workshop után leeresztettem.")
        #expect(p.values == ["energy": 5])                          // every value again
        #expect(p.snapshot?.hrBpm == 78)
        #expect(env.ledger.ledger(for: "2026-11-12").checkIns.first?.note == "A workshop után leeresztettem.")
        #expect(flow.saved?.checkIn.note == "A workshop után leeresztettem.")
    }

    // B3 Task 10 ruling: a recording the phone could not write down waits as a `voice` item aimed at this check-in's note.
    @Test func recordedNoteWaitsAsVoiceForTheCheckIn() async throws {
        let env = environment()
        let flow = CheckinFlow(env: env)
        await sender.goOffline()
        await flow.next(); await flow.quickExit()
        let saved = try #require(flow.saved)
        #expect(await flow.addVoiceNote(fileName: "voice-1.m4a") == .waiting)
        let queued = try #require(await env.outbox.pending.last)
        #expect(queued.kind == .voice)
        #expect(queued.id != saved.checkIn.id)                      // the check-in itself stays queued in front
        #expect(queued.capturedAt == saved.checkIn.capturedAt && queued.date == saved.date)
        let voice = try JSONDecoder.iso.decode(VoicePayload.self, from: queued.payload)
        #expect(voice.fileName == "voice-1.m4a")
        #expect(voice.target == .checkInNote(saved.payload))
        #expect(await env.outbox.pending.map(\.kind) == [.checkIn, .voice])
    }

    @Test func recordedNoteOnlineComesBackAsTheNote() async throws {
        let env = environment(sender: TranscribingSender())
        let flow = CheckinFlow(env: env)
        await flow.next(); await flow.quickExit()
        #expect(await flow.addVoiceNote(fileName: "voice-1.m4a") == .transcribed("Leeresztettem."))
        #expect(env.ledger.ledger(for: "2026-11-12").checkIns.first?.note == "Leeresztettem.")
        #expect(flow.saved?.checkIn.note == "Leeresztettem.")
    }

    @Test func verdictComparesWithPrediction() {
        let hourly = Array(repeating: 0.7, count: 19)
        #expect(CheckinFlow.verdict(energy: 5, hour: 16, predicted: hourly, moment: .delutan) == "Délutánra lejjebb mentél, mint jósoltam.")
        #expect(CheckinFlow.verdict(energy: 9, hour: 12.5, predicted: hourly, moment: .delben) == "Délre feljebb jöttél, mint jósoltam.")
        #expect(CheckinFlow.verdict(energy: 7, hour: 8, predicted: hourly, moment: .reggel) == "Pont ott vagy, ahol jósoltam.")
        #expect(CheckinFlow.verdict(energy: 7, hour: 8, predicted: [], moment: .reggel) == nil)
    }

    // MARK: - Review fix round 1

    @Test func savedCheckInKeepsItsSnapshotInTheLedger() async throws {
        let env = environment()
        let flow = CheckinFlow(env: env)
        await flow.next(); await flow.quickExit()
        await flow.addNote("Fáradt vagyok.")
        let c = try #require(env.ledger.ledger(for: "2026-11-12").checkIns.first)
        #expect(c.snapshot?.hrBpm == 78 && c.snapshot?.hrvMs == 38)
    }

    @Test func olderDotShowsItsWatchFigures() {
        let older = LedgerCheckIn(id: UUID(), slot: "10:00", capturedAt: Self.at(12, 40), values: ["energy": 6],
                                  snapshot: CheckInSnapshotValue(hrBpm: 74, hrvMs: 41, hrvUsualMs: 50, steps: 4_860, sleepMinutes: 432))
        let f = CheckinDone.figures(older)
        #expect(f.hr == 74 && f.hrv == 41 && f.hrvUsual == 50 && f.sleepMinutes == 432)
        #expect(f.steps == "4\u{00A0}860")   // always grouped, like everywhere in Boop
        #expect(CheckinDone.figures(LedgerCheckIn(id: UUID(), slot: "06:30", capturedAt: Self.at(7), values: [:])) == CheckInSnapshotFigures())
    }

    @Test func detailShowsCravingKindsAndPainRegions() {
        let craving = LedgerCheckIn(id: UUID(), slot: "14:00", capturedAt: Self.at(16), values: ["energy": 5, "craving": 7],
                                    cravingKinds: ["EDES", "SOS"], askedItems: ["energy", "craving"])
        #expect(CheckinDone.answers(craving).last == CheckInDetailAnswer(label: "A nap kérdése", value: "7", detail: "Édes, Sós"))
        let pain = LedgerCheckIn(id: UUID(), slot: "14:00", capturedAt: Self.at(16), values: ["energy": 5], pain: true,
                                 painRegions: ["TERD"], painIntensity: 6, askedItems: ["energy", "pain"])
        #expect(CheckinDone.answers(pain).last == CheckInDetailAnswer(label: "A nap kérdése", value: "6", detail: "Térd"))
        #expect(CheckinDone.answers(pain).first?.detail == nil)
    }

    @Test func failedNoteSaveIsNotShownAsSaved() async throws {
        let env = environment()
        let flow = CheckinFlow(env: env)
        await flow.next(); await flow.quickExit()
        // the phone's disk refuses the next write
        let ledgerDir = root.appendingPathComponent("ledger")
        try FileManager.default.removeItem(at: ledgerDir)
        try Data("x".utf8).write(to: ledgerDir)
        let ok = await flow.addNote("Ez nem fér el.")
        #expect(!ok)
        #expect(flow.saveProblem != nil)
        #expect(flow.saved?.checkIn.note == nil)
    }

    @Test func slotIsDecidedAtCapture() async throws {
        clock.set(Self.at(14, 29))
        let flow = CheckinFlow(env: environment())
        #expect(flow.moment == .delben)
        await flow.next()
        clock.set(Self.at(14, 31))
        await flow.quickExit()
        let p = try #require(await payloads().first)
        #expect(p.slot == "14:00")
        #expect(flow.saved?.date == "2026-11-12")
    }

    @Test func dateIsDecidedAtCapture() async throws {
        clock.set(Self.at(23, 59))
        let env = environment()
        let flow = CheckinFlow(env: env)
        await flow.next()
        clock.set(Self.budapest.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 0, minute: 1))!)
        await flow.quickExit()
        #expect(flow.saved?.date == "2026-11-13")
        #expect(await sender.sent.first?.date == "2026-11-13")
        #expect(await payloads().first?.slot == "06:30")
        #expect(env.ledger.ledger(for: "2026-11-13").checkIns.count == 1)
        #expect(flow.savedTimeLabel == "MENTVE · 00:01")
    }

    @Test func noteOnAnInFlightCheckInKeepsItPending() async throws {
        let gated = GatedSender()
        let env = environment(sender: gated)
        let flow = CheckinFlow(env: env)
        await flow.next()
        let saving = Task { await flow.quickExit() }
        await until { await gated.started >= 1 }
        #expect(await flow.addNote("Közben eszembe jutott."))
        await gated.releaseOne()                    // the old version arrives; the note version is still queued
        await until { await gated.started >= 2 }
        #expect(env.ledger.ledger(for: "2026-11-12").checkIns.first?.pending == true)
        await gated.releaseOne()
        await saving.value
        #expect(env.ledger.ledger(for: "2026-11-12").checkIns.first?.pending == false)
    }

    @Test func storageIsPerUser() throws {
        let a = UUID(), b = UUID()
        let dirsA = RitmusEnvironment.directories(for: a, base: root), dirsB = RitmusEnvironment.directories(for: b, base: root)
        #expect(dirsA.ledger != dirsB.ledger && dirsA.outbox != dirsB.outbox)
        #expect(dirsA.ledger.path.contains(a.uuidString))
        let c = clock
        func env(_ d: (ledger: URL, outbox: URL)) -> RitmusEnvironment {
            RitmusEnvironment(ledgerDirectory: d.ledger, outboxDirectory: d.outbox, sender: sender, line: { _, _ in "" },
                              snapshot: { _ in CheckInSnapshotValue() }, plans: nil, clock: { c.now }, calendar: Self.budapest)
        }
        try env(dirsA).ledger.saveCheckIn(LedgerCheckIn(id: UUID(), slot: "06:30", capturedAt: Self.at(7), values: ["energy": 7]),
                                          date: "2026-11-12")
        #expect(env(dirsB).ledger.ledger(for: "2026-11-12").checkIns.isEmpty)
        #expect(env(dirsA).ledger.ledger(for: "2026-11-12").checkIns.count == 1)
    }

    /// Waits (bounded) until the condition holds.
    private func until(_ condition: () async -> Bool) async {
        for _ in 0..<2_000 {
            if await condition() { return }
            try? await Task.sleep(for: .milliseconds(2))
        }
    }

    @Test func momentLabelShowsTheClock() {
        let flow = CheckinFlow(env: environment())
        #expect(flow.momentLabel == "Délután · 16:02")
    }
}

private extension JSONDecoder {
    static var iso: JSONDecoder { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }
}
