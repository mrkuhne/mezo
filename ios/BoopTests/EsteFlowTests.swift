import Foundation
import Testing
import BoopCore
@testable import Boop

/// Records every sent item; everything waits for the net while offline.
private actor CloseSender: OutboxSender {
    private(set) var sent: [OutboxItem] = []
    private var offline = false
    private var voiceFails = false
    func send(_ item: OutboxItem) async -> OutboxSendResult {
        if offline { return .retryLater }
        if item.kind == .voice {
            if voiceFails { return .failed("no speech in the recording") }
            sent.append(item)
            return .sent(RitmusPayload.encode(VoiceTranscript(text: "Jól ment a nap.")))
        }
        sent.append(item)
        return .sent(nil)
    }
    func set(offline: Bool) { self.offline = offline }
    func set(voiceFails: Bool) { self.voiceFails = voiceFails }
}

/// Remembers which kept recordings were thrown away.
@MainActor
private final class DiscardingRecorder: VoiceNoteRecorder {
    var transcribesOnDevice = false
    var speechDenied = false
    private(set) var discarded: [String] = []
    func start() async throws {}
    func stop() async -> VoiceCapture? { nil }
    func discard(_ capture: VoiceCapture) { if case .recording(let n) = capture { discarded.append(n) } }
}

/// The one-minute evening close (B3 Task 10, spec §5.4, §6, §7.4) at view-model level.
@MainActor
final class EsteFlowTests {
    private static let budapest: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    private static func at(_ h: Int, _ m: Int = 0) -> Date {
        budapest.date(from: DateComponents(year: 2026, month: 11, day: 12, hour: h, minute: m))!
    }
    private let date = "2026-11-12"
    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("este-flow-\(UUID().uuidString)")
    private let sender = CloseSender()
    deinit { try? FileManager.default.removeItem(at: root) }

    private func environment(line: String? = "Jó nap volt: a prezentáció sikerült.", now: Date = at(21, 32)) -> RitmusEnvironment {
        RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
            sender: sender, line: { _, _ in "" }, snapshot: { _ in CheckInSnapshotValue() }, plans: nil,
            closeLine: { _ in guard let line else { throw RitmusFetchError.unavailable }; return line },
            clock: { now }, calendar: Self.budapest)
    }

    private func brief(session: String = "null", bedtime: String = #""22:45""#, protein: Int = 146) throws -> Brief {
        let hourly = Array(repeating: "0.6", count: 19).joined(separator: ",")
        let metrics = ["forma", "alvas", "mozgas", "fuel", "pulzus"].map {
            #"{"key":"\#($0)","score":70,"display":"70","headline":"h","sentence":"s"}"#
        }.joined(separator: ",")
        let slots = Array(repeating: "false", count: 72).joined(separator: ",")
        let json = #"""
        {"date":"2026-11-12","generatedAt":"2026-11-12T05:30:00Z","state":"okay","nightsKnown":12,
         "metrics":[\#(metrics)],"brief":[],"energy":{"hourly":[\#(hourly)],"dipHour":15},"tonightTip":"t","nextMealTip":null,"conflict":null,
         "day":{"sleep":null,"bedtimeTarget":\#(bedtime),"deepSleepWeek":[],"restingHrWeek":[],"steps":0,"stepsGoal":10000,"activeKcal":0,
           "session":\#(session),"meals":[],"kcalSoFar":0,"kcalTarget":2400,"proteinG":\#(protein),"proteinTarget":140,"carbsG":0,"fatG":0,
           "checkins":[{"slot":"evening","time":"21:30","done":false}],
           "intention":{"creed":null,"foci":[]},"observations":[],"calendar":{"count":0,"busySlots":[\#(slots)]},"recovery":null}}
        """#
        return try Brief(json: Data(json.utf8))
    }

    private static let doneSession = #"{"title":"Röpi","time":"19:00","plannedTime":"19:00","minutes":90,"exercises":[],"done":true,"doneMinutes":90,"avgHr":128}"#

    private func closes() async -> [DayClosePayload] {
        await sender.sent.filter { $0.kind == .dayClose }.compactMap { try? JSONDecoder.isoDates.decode(DayClosePayload.self, from: $0.payload) }
    }

    /// A flow whose day has a goal already set (as on Ma in the morning).
    private func flow(_ env: RitmusEnvironment, brief: Brief? = nil, goal: String? = "Ügyfélprezentáció 14:00") async throws -> EsteFlow {
        if let goal {
            try await env.setGoal(goal, date: date)
            // the goal's own send runs in the background; let it land so the close's delivery is its own round
            var tries = 0
            while await !env.outbox.pending.isEmpty, tries < 2_000 { tries += 1; try? await Task.sleep(for: .milliseconds(2)) }
        }
        return EsteFlow(env: env, brief: brief)
    }

    // MARK: - Steps and the close button

    @Test func closeDisabledUntilRating() async throws {
        let f = try await flow(environment())
        #expect(!f.canClose)
        f.pickEnergy(4)
        f.pickOutcome("done")
        #expect(!f.canClose)                      // energy and goal are optional; the rating closes the day
        await f.closeDay()
        #expect(await closes().isEmpty)
        f.pickRating(4)
        #expect(f.canClose)
        #expect(f.stepsDone == [true, true, true, false])
    }

    @Test func fiveTapsCloseTheDay() async throws {
        let env = environment()
        let f = try await flow(env)               // tap 1: the door opens the close
        f.pickEnergy(4)                           // tap 2
        f.pickOutcome("done")                     // tap 3
        f.pickRating(4)                           // tap 4
        await f.closeDay()                        // tap 5
        #expect(f.showsSummary)
        #expect(env.ledger.ledger(for: date).close?.dayRating == 4)
    }

    // MARK: - What is sent (spec §7.4 sync order)

    @Test func closeSendsDayCloseThenJournalRelink() async throws {
        let env = environment()
        let f = try await flow(env)
        f.pickEnergy(4); f.pickOutcome("done"); f.pickRating(4)
        f.typed("Jól ment a prezentáció.")
        await f.closeDay()

        let sent = await sender.sent.filter { $0.kind != .goal }
        #expect(sent.map(\.kind) == [.dayClose, .journal, .dayClose])
        let first = try JSONDecoder.isoDates.decode(DayClosePayload.self, from: sent[0].payload)
        let relink = try JSONDecoder.isoDates.decode(DayClosePayload.self, from: sent[2].payload)
        #expect(first.journalClientRef == nil && first.clientRef == nil)
        #expect(first.eveningEnergy == 4 && first.dayRating == 4 && first.goalOutcome == "done")
        #expect(first.goalText == "Ügyfélprezentáció 14:00")
        #expect(relink.clientRef == sent[0].id && relink.journalClientRef == sent[1].id)
        #expect(sent.allSatisfy { $0.date == date && $0.capturedAt == Self.at(21, 32) })

        let close = try #require(env.ledger.ledger(for: date).close)
        #expect(close.id == sent[0].id && !close.pending && close.journalId == sent[1].id)
        #expect(!f.offline)
        #expect(f.boopText == "Jó nap volt: a prezentáció sikerült.")
    }

    @Test func closeOfflineShowsSavedAndLaterLine() async throws {
        let env = environment()
        let f = try await flow(env, goal: nil)
        await sender.set(offline: true)
        f.pickRating(3)
        await f.closeDay()
        #expect(f.showsSummary)
        #expect(f.offline)
        #expect(env.ledger.ledger(for: date).close?.pending == true)
        #expect(f.boopText == EsteFlow.offlineLine)

        // the net comes back: the close goes, then Boop's sentence arrives
        await sender.set(offline: false)
        await env.outbox.flush(ignoringBackoff: true)
        await env.refreshCloseLine(date)
        #expect(!f.offline)
        #expect(f.boopText == "Jó nap volt: a prezentáció sikerült.")
    }

    @Test func planGoalsCopiedWithMet() async throws {
        let f = try await flow(environment(), brief: try brief(session: Self.doneSession, protein: 146))
        f.pickRating(5)
        await f.closeDay()
        let goals = try #require(await closes().first).planGoals
        #expect(goals == [
            PlanGoalPayload(id: "protein", title: "140 g fehérje", result: "146 g", met: true),
            PlanGoalPayload(id: "session", title: "Röpi · 19:00", result: "90 perc · pulzus átl. 128", met: true),
            PlanGoalPayload(id: "bedtime", title: "Lefekvés 22:45", result: "", met: nil),
        ])
        #expect(f.summaryRows.first { $0.label == "Boop céljai" }?.value == "2 / 3")
    }

    @Test func typedJournalSentWithoutTranscription() async throws {
        let env = environment()
        let f = try await flow(env)
        f.pickRating(4)
        f.typed("  Este fáradt voltam.  ")
        #expect(f.stepsDone[3])
        await f.closeDay()
        let journal = try #require(await sender.sent.first { $0.kind == .journal })
        #expect(await !sender.sent.contains { $0.kind == .voice })
        #expect(try JSONDecoder().decode(JournalPayload.self, from: journal.payload).text == "Este fáradt voltam.")
        #expect(env.ledger.ledger(for: date).journal.first?.text == "Este fáradt voltam.")
        #expect(f.journalQuote == .text("Este fáradt voltam."))
    }

    @Test func heardOnThePhoneIsSentAsText() async throws {
        let f = try await flow(environment())
        f.pickRating(4)
        f.recorded(.transcript("Jól ment a nap."))
        await f.closeDay()
        #expect(await sender.sent.filter { $0.kind != .goal }.map(\.kind) == [.dayClose, .journal, .dayClose])
    }

    @Test func recordingWaitsAsVoiceForTheJournal() async throws {
        let env = environment()
        let f = try await flow(env)
        await sender.set(offline: true)
        f.pickRating(4)
        f.recorded(.recording(fileName: "voice-1.m4a"))
        await f.closeDay()
        let queued = await env.outbox.pending.filter { $0.kind != .goal }
        #expect(queued.map(\.kind) == [.dayClose, .voice, .dayClose])
        let voice = try JSONDecoder().decode(VoicePayload.self, from: queued[1].payload)
        #expect(voice == VoicePayload(fileName: "voice-1.m4a", target: .journal))
        #expect(env.ledger.ledger(for: date).journal.first?.text == nil)
        #expect(f.journalQuote == .waitingForTranscript)
    }

    // MARK: - A day already closed

    @Test func closedDayShowsSummaryAndModositomReopens() async throws {
        let env = environment()
        let closeId = UUID()
        try env.ledger.setClose(LedgerClose(id: closeId, capturedAt: Self.at(21, 33), eveningEnergy: 4, dayRating: 4,
                                            goalText: "Séta", goalOutcome: "partial"), date: date)
        let f = EsteFlow(env: env, brief: nil)
        #expect(f.showsSummary)
        #expect(f.closedLabel == "LEZÁRVA · 21:33")
        #expect(f.summaryRows.map(\.value).prefix(3) == ["Jó", "Részben", "4"])
        f.reopen()
        #expect(!f.showsSummary)
        #expect(f.energy == 4 && f.outcome == "partial" && f.rating == 4 && f.canClose)
        await f.closeDay()
        let item = try #require(await sender.sent.first { $0.kind == .dayClose })
        #expect(item.id == closeId)               // the same close, upserted
    }

    @Test func webDayWithoutRatingShowsNoRatingWord() async throws {
        let env = environment()
        try env.ledger.setClose(LedgerClose(id: UUID(), capturedAt: Self.at(21, 0), eveningEnergy: nil, dayRating: nil,
                                            journalText: "Fáradt vagyok.", web: true), date: date)
        let f = EsteFlow(env: env, brief: nil)
        #expect(f.showsSummary)
        #expect(f.summaryRows.first?.label == "Értékelés" && f.summaryRows.first?.value == "–")
        #expect(f.journalQuote == .text("Fáradt vagyok."))
    }

    // MARK: - Review round 1

    @Test func closeOpenedAfterMidnightBelongsToTheDayBefore() async throws {
        let late = Self.budapest.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 0, minute: 30))!
        let env = environment(now: late)
        let f = EsteFlow(env: env, brief: nil)
        #expect(f.date == "2026-11-12")
        f.pickRating(3)
        await f.closeDay()
        #expect(env.ledger.ledger(for: "2026-11-12").close != nil)
        #expect(await sender.sent.first { $0.kind == .dayClose }?.date == "2026-11-12")
        let early = Self.budapest.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 4, minute: 0))!
        #expect(EsteFlow(env: environment(now: early), brief: nil).date == "2026-11-13")
    }

    @Test func failedSaveLeavesTheDayAsItWas() async throws {
        // the queue file cannot be written (a folder sits where it would go)
        try FileManager.default.createDirectory(at: root.appendingPathComponent("outbox/queue.json"), withIntermediateDirectories: true)
        let env = environment()
        let f = EsteFlow(env: env, brief: nil)
        f.pickRating(4)
        f.typed("Fáradt vagyok.")
        await f.closeDay()
        let day = env.ledger.ledger(for: date)
        #expect(day.close == nil && day.journal.isEmpty)
        #expect(f.saveProblem != nil)
        #expect(!f.showsSummary)
        #expect(await env.outbox.pending.isEmpty)
        #expect(f.journal == .typed("Fáradt vagyok.") && f.rating == 4)   // the answers stay for another try
    }

    @Test func reCloseForgetsTheOldSentenceEvenOffline() async throws {
        let env = environment()
        let f = try await flow(env, goal: nil)
        f.pickRating(4)
        await f.closeDay()
        #expect(env.closeLines[date] != nil)
        f.reopen()
        await sender.set(offline: true)
        f.pickRating(2)
        await f.closeDay()
        #expect(env.closeLines[date] == nil)
        #expect(f.boopText == EsteFlow.offlineLine)
    }

    @Test func waitingLineIsBoopsOwn() async throws {
        let f = try await flow(environment(line: nil), goal: nil)
        f.pickRating(4)
        await f.closeDay()
        #expect(f.boopText == "Mindjárt írok egy mondatot a napodról.")
    }

    @Test func replacedOrAbandonedRecordingIsDiscarded() async throws {
        let env = environment()
        let recorder = DiscardingRecorder()
        env.recorder = recorder
        let f = EsteFlow(env: env, brief: nil)
        f.recorded(.recording(fileName: "a.m4a"))
        f.recorded(.recording(fileName: "b.m4a"))       // re-recorded
        f.typed("Inkább leírom.")                      // typed instead
        #expect(recorder.discarded == ["a.m4a", "b.m4a"])
        f.recorded(.recording(fileName: "c.m4a"))
        f.abandon()                                    // the cover closed without closing the day
        #expect(recorder.discarded == ["a.m4a", "b.m4a", "c.m4a"])
        f.recorded(.recording(fileName: "d.m4a"))
        f.pickRating(4)
        await f.closeDay()
        f.abandon()                                    // now the queue owns it
        #expect(!recorder.discarded.contains("d.m4a"))
    }

    @Test func failedRecordingShowsRetry() async throws {
        let env = environment()
        let f = EsteFlow(env: env, brief: nil)
        await sender.set(voiceFails: true)
        f.pickRating(4)
        f.recorded(.recording(fileName: "v.m4a"))
        await f.closeDay()
        #expect(f.journalQuote == .transcriptFailed)
        await sender.set(voiceFails: false)
        await f.retryVoice()
        #expect(f.journalQuote == .text("Jól ment a nap."))
    }

    @Test func emptyTypedTextIsNotSaved() async throws {
        let f = EsteFlow(env: environment(), brief: nil)
        #expect(!f.typed("   "))
        #expect(f.journal == nil && !f.stepsDone[3])
    }

    @Test func bedtimeLineFollowsTheTarget() async throws {
        #expect(EsteFlow(env: environment(), brief: try brief(bedtime: #""22:45""#)).bedtimeLine == "22:15-kor szólok a lefekvés miatt")
        #expect(EsteFlow(env: environment(), brief: try brief(bedtime: "null")).bedtimeLine == nil)
    }
}

private extension JSONDecoder {
    static var isoDates: JSONDecoder { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }
}
