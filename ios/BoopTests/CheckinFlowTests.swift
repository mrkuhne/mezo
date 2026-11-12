import Foundation
import Testing
import BoopCore
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

    private func environment(line: String = "Délben még 6 voltál, most 5.") -> RitmusEnvironment {
        let c = clock
        return RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
            sender: sender, line: { _, _ in line }, snapshot: { _ in CheckInSnapshotValue(hrBpm: 78, hrvMs: 38, hrvUsualMs: 50) },
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

    @Test func verdictComparesWithPrediction() {
        let hourly = Array(repeating: 0.7, count: 19)
        #expect(CheckinFlow.verdict(energy: 5, hour: 16, predicted: hourly, moment: .delutan) == "Délutánra lejjebb mentél, mint jósoltam.")
        #expect(CheckinFlow.verdict(energy: 9, hour: 12.5, predicted: hourly, moment: .delben) == "Délre feljebb jöttél, mint jósoltam.")
        #expect(CheckinFlow.verdict(energy: 7, hour: 8, predicted: hourly, moment: .reggel) == "Pont ott vagy, ahol jósoltam.")
        #expect(CheckinFlow.verdict(energy: 7, hour: 8, predicted: [], moment: .reggel) == nil)
    }

    @Test func momentLabelShowsTheClock() {
        let flow = CheckinFlow(env: environment())
        #expect(flow.momentLabel == "Délután · 16:02")
    }
}

extension JSONDecoder {
    static var iso: JSONDecoder { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }
}
