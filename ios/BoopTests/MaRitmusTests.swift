import Foundation
import Testing
import BoopCore
import BoopDesign
@testable import Boop

/// Records every sent item.
private actor GoalSender: OutboxSender {
    private(set) var sent: [OutboxItem] = []
    func send(_ item: OutboxItem) async -> OutboxSendResult { sent.append(item); return .sent(nil) }
}

/// Counts the past-goal fetches and answers fixed days.
private final class GoalsSource: @unchecked Sendable {
    private let lock = NSLock()
    private var asked: [[String]] = []
    let answer: [String: [String]]
    init(_ answer: [String: [String]]) { self.answer = answer }
    var calls: [[String]] { lock.withLock { asked } }
    func fetch(_ dates: [String]) -> [String: [String]] {
        lock.withLock { asked.append(dates) }
        return Dictionary(uniqueKeysWithValues: dates.map { ($0, answer[$0] ?? []) })
    }
}

/// B3 Task 9 on Ma (spec §5.1, §5.3, §7.5): the goal of the day, the check-in rows on the timeline, the collapsed plan line.
@MainActor
final class MaRitmusTests {
    private static let budapest: Calendar = {
        var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c
    }()
    private static func at(_ h: Int, _ m: Int = 0, day: Int = 10) -> Date {
        budapest.date(from: DateComponents(year: 2026, month: 11, day: day, hour: h, minute: m))!
    }
    private let date = "2026-11-10"
    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("ma-ritmus-\(UUID().uuidString)")
    private let sender = GoalSender()
    deinit { try? FileManager.default.removeItem(at: root) }

    private func environment(goals: GoalsSource? = nil, events: [CalendarEventLite] = []) -> RitmusEnvironment {
        let now = Self.at(8, 10)
        return RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
            sender: sender, line: { _, _ in "" }, snapshot: { _ in CheckInSnapshotValue() }, plans: nil,
            goals: goals.map { g in { @Sendable dates in g.fetch(dates) } }, events: { _ in events },
            clock: { now }, calendar: Self.budapest)
    }

    private func brief(session: String = "null") throws -> Brief {
        let hourly = Array(repeating: "0.6", count: 19).joined(separator: ",")
        let metrics = ["forma", "alvas", "mozgas", "fuel", "pulzus"].map {
            #"{"key":"\#($0)","score":70,"display":"70","headline":"h","sentence":"s"}"#
        }.joined(separator: ",")
        let slots = Array(repeating: "false", count: 72).joined(separator: ",")
        let json = #"""
        {"date":"2026-11-10","generatedAt":"2026-11-10T05:30:00Z","state":"okay","nightsKnown":12,
         "metrics":[\#(metrics)],"brief":[],"energy":{"hourly":[\#(hourly)],"dipHour":15},"tonightTip":"t","nextMealTip":null,"conflict":null,
         "day":{"sleep":null,"bedtimeTarget":"22:30","deepSleepWeek":[],"restingHrWeek":[],"steps":0,"stepsGoal":10000,"activeKcal":0,
           "session":\#(session),"meals":[],"kcalSoFar":0,"kcalTarget":2400,"proteinG":0,"proteinTarget":150,"carbsG":0,"fatG":0,
           "checkins":[{"slot":"morning","time":"08:00","done":false},{"slot":"midday","time":"13:00","done":false},
                       {"slot":"afternoon","time":"16:00","done":false},{"slot":"evening","time":"21:30","done":false}],
           "intention":{"creed":null,"foci":[]},"observations":[],"calendar":{"count":0,"busySlots":[\#(slots)]},"recovery":null}}
        """#
        return try Brief(json: Data(json.utf8))
    }

    private func sentKinds() async -> [OutboxKind] { await sender.sent.map(\.kind) }

    private func until(_ condition: () async -> Bool) async {
        for _ in 0..<2_000 {
            if await condition() { return }
            try? await Task.sleep(for: .milliseconds(2))
        }
    }

    // MARK: - The goal field's voice (Task 10 review round 1)

    @MainActor private final class GoalRecorder: VoiceNoteRecorder {
        var transcribesOnDevice: Bool
        var speechDenied = false
        init(onDevice: Bool) { transcribesOnDevice = onDevice }
        func start() async throws {}
        func stop() async -> VoiceCapture? { nil }
        func discard(_ capture: VoiceCapture) {}
    }

    private func voiceEnvironment(transcribe: (@Sendable (URL) async throws -> String)?) -> RitmusEnvironment {
        let now = Self.at(8, 10)
        return RitmusEnvironment(
            ledgerDirectory: root.appendingPathComponent("ledger"), outboxDirectory: root.appendingPathComponent("outbox"),
            sender: sender, line: { _, _ in "" }, snapshot: { _ in CheckInSnapshotValue() }, plans: nil,
            transcribe: transcribe, clock: { now }, calendar: Self.budapest)
    }

    private func keptRecording(in env: RitmusEnvironment) throws -> (VoiceCapture, URL) {
        try FileManager.default.createDirectory(at: env.outboxDirectory, withIntermediateDirectories: true)
        let url = env.outboxDirectory.appendingPathComponent("voice-goal.m4a")
        try Data("audio".utf8).write(to: url)
        return (.recording(fileName: "voice-goal.m4a"), url)
    }

    @Test func goalVoiceOnDeviceFillsTheField() async {
        let env = voiceEnvironment(transcribe: nil)
        #expect(env.voiceInputAvailable(GoalRecorder(onDevice: true)))
        #expect(await env.heardSpeech(.transcript("Séta ebéd után"), speechDenied: false) == .text("Séta ebéd után"))
    }

    @Test func goalVoiceOnlineWithoutOnDeviceAsksTheServerDirectly() async throws {
        let env = voiceEnvironment(transcribe: { _ in " Ügyfélprezentáció " })
        #expect(env.voiceInputAvailable(GoalRecorder(onDevice: false)))
        let (capture, url) = try keptRecording(in: env)
        #expect(await env.heardSpeech(capture, speechDenied: false) == .text("Ügyfélprezentáció"))
        #expect(!FileManager.default.fileExists(atPath: url.path))       // nothing kept,
        #expect(await env.outbox.pending.isEmpty)                         // nothing queued
    }

    @Test func goalVoiceOfflineWithoutOnDeviceIsDimmedWithAHint() async throws {
        let env = voiceEnvironment(transcribe: { _ in throw RitmusFetchError.offline })
        env.online = false
        #expect(!env.voiceInputAvailable(GoalRecorder(onDevice: false)))
        #expect(env.voiceInputAvailable(GoalRecorder(onDevice: true)))
        env.online = true                                                 // the path said yes, the request found no net
        let (capture, url) = try keptRecording(in: env)
        #expect(await env.heardSpeech(capture, speechDenied: false) == .problem(RitmusEnvironment.voiceOfflineHint))
        #expect(!FileManager.default.fileExists(atPath: url.path))
    }

    @Test func goalVoiceSpeechDeniedOfflineSaysSo() async throws {
        let env = voiceEnvironment(transcribe: nil)
        let (capture, _) = try keptRecording(in: env)
        #expect(await env.heardSpeech(capture, speechDenied: true) == .problem(RitmusEnvironment.speechDenied))
    }

    @Test func micCopyTellsDenialFromFailure() {
        struct Boom: Error {}
        #expect(MicCopy.line(for: VoiceJournalError.microphoneDenied) == MicCopy.denied)
        #expect(MicCopy.line(for: Boom()) == "Most nem sikerült elindítani a felvételt.")
    }

    // MARK: - The goal of the day

    @Test func goalIsKeptOnThePhoneAndQueuedWithItsClientRef() async throws {
        let env = environment()
        try await env.setGoal("  Ügyfélprezentáció 14:00 ", date: date)
        let goal = try #require(env.goal(on: date))
        #expect(goal.text == "Ügyfélprezentáció 14:00")
        await until { await self.sender.sent.count == 1 }
        let item = try #require(await sender.sent.first)
        #expect(item.kind == .goal && item.id == goal.id && item.date == date)
        #expect(try JSONDecoder().decode(GoalPayload.self, from: item.payload).text == "Ügyfélprezentáció 14:00")
        await until { env.goal(on: self.date)?.pending == false }
        #expect(env.goal(on: date)?.pending == false)
    }

    @Test func emptyGoalIsNotSet() async throws {
        let env = environment()
        try await env.setGoal("   ", date: date)
        #expect(env.goal(on: date) == nil)
        #expect(await sender.sent.isEmpty)
    }

    @Test func csereRemovesTheOldGoalThenAddsTheNew() async throws {
        let env = environment()
        try await env.setGoal("Ügyfélprezentáció 14:00", date: date)
        let old = try #require(env.goal(on: date))
        try await env.removeGoal(date: date)                 // "csere": the field and the chips come back
        #expect(env.goal(on: date) == nil)
        try await env.setGoal("Meal prep a hétre", date: date)
        #expect(env.goal(on: date)?.text == "Meal prep a hétre")
        await until { await self.sender.sent.count == 3 }
        #expect(await sentKinds() == [.goal, .goalRemove, .goal])
        let removal = try JSONDecoder().decode(GoalRemovePayload.self, from: try #require(await sender.sent.dropFirst().first).payload)
        #expect(removal.goalRef == old.id && removal.text == "Ügyfélprezentáció 14:00" && removal.focusId == nil)
    }

    @Test func settingAnotherGoalReplacesTheShownOne() async throws {
        let env = environment()
        let focus = UUID()
        try env.ledger.setGoal(LedgerGoal(id: focus, text: "A webről", setAt: .distantPast, focusId: focus), date: date)
        try await env.setGoal("Döntés a beszállítóról", date: date)
        await until { await self.sender.sent.count == 2 }
        #expect(await sentKinds() == [.goalRemove, .goal])
        let removal = try JSONDecoder().decode(GoalRemovePayload.self, from: try #require(await sender.sent.first).payload)
        #expect(removal.focusId == focus)                    // a server goal goes by its focus id
    }

    @Test func suggestionsComeFromCalendarSessionAndPastGoals() async throws {
        let source = GoalsSource(["2026-11-02": ["Meal prep a hétre"], "2026-10-26": ["Meal prep a hétre"]])
        let event = CalendarEventLite(title: "Ügyfélprezentáció", start: Self.at(14), end: Self.at(15, 30), attendees: 4)
        let env = environment(goals: source, events: [event])
        await env.refreshCalendar()
        await env.refreshPastGoals(today: date)
        let b = try brief(session: #"{"title":"Röpi","time":"19:00","plannedTime":"19:00","minutes":90,"exercises":[]}"#)
        let s = env.goalSuggestions(brief: b, date: date)
        #expect(s.map(\.text) == ["Ügyfélprezentáció 14:00", "Röpi 19:00", "Meal prep a hétre"])
        #expect(s.map(\.why) == ["a naptárból", "a heti terv", "8 napja nem volt"])
    }

    @Test func pastGoalsAreFetchedOnceThenCached() async throws {
        let source = GoalsSource(["2026-11-02": ["Meal prep a hétre"]])
        let env = environment(goals: source)
        await env.refreshPastGoals(today: date)
        #expect(source.calls.count == 1 && source.calls[0].count == 30)
        #expect(source.calls[0].first == "2026-11-09" && source.calls[0].last == "2026-10-11")
        #expect(env.pastGoals == [PastGoal(date: "2026-11-02", text: "Meal prep a hétre")])
        let again = environment(goals: source)               // a relaunch: the file remembers the past days
        await again.refreshPastGoals(today: date)
        #expect(source.calls.count == 1)
        #expect(again.pastGoals == env.pastGoals)
    }

    @Test func thePhonesOwnPastGoalsCountWithoutTheNet() async throws {
        let env = environment()
        try env.ledger.setGoal(LedgerGoal(id: UUID(), text: "Számlák", setAt: Self.at(8, day: 1)), date: "2026-11-01")
        await env.refreshPastGoals(today: date)
        #expect(env.pastGoals == [PastGoal(date: "2026-11-01", text: "Számlák")])
    }

    // MARK: - The plan card's collapsed line

    @Test func acceptedPlanLineCarriesTheTimeAndTheGoal() {
        let s = planSummary(accepted: true, acceptedAt: Self.at(7, 42), rows: 5, goal: "Ügyfélprezentáció 14:00", calendar: Self.budapest)
        #expect(s.title == "A nap terve elfogadva")
        #expect(s.sub == "07:42 · a nap célja: Ügyfélprezentáció 14:00")
        let noGoal = planSummary(accepted: true, acceptedAt: Self.at(7, 42), rows: 5, goal: nil, calendar: Self.budapest)
        #expect(noGoal.sub == "07:42 · 5 pont")
        let past = planSummary(accepted: false, acceptedAt: nil, rows: 5, goal: "Séta", calendar: Self.budapest)
        #expect(past.title == "A reggeli terv · 5 pont" && past.sub == "a nap célja: Séta")
        #expect(planSummary(accepted: false, acceptedAt: nil, rows: 5, goal: nil, calendar: Self.budapest).sub == nil)
    }

    // MARK: - Check-in rows on the timeline

    private func stations() throws -> [PathStation] {
        napkozbenStations(try brief(), now: Self.at(13, 40), evening: false, hasProposals: false, calendar: Self.budapest)
    }

    @Test func doneCheckInRowsComeFromThePhoneAndTheNextOneOffersKitoltom() throws {
        var day = DayLedger(date: date)
        let morning = LedgerCheckIn(id: UUID(), slot: "06:30", capturedAt: Self.at(7, 20),
                                    values: ["energy": 7, "mood": 8, "stress": 3, "body": 7])
        day.checkIns = [morning]
        let st = ritmusStations(try stations(), day: day, now: Self.at(13, 40), calendar: Self.budapest)
        let m = try #require(st.first { $0.id == "checkin-morning" })
        #expect(m.done && m.time == "07:20" && m.sub == "Energia 7 · hangulat 8 · feszültség 3" && m.action == nil)
        #expect(st.first { $0.id == "checkin-midday" }?.action == "Kitöltöm")
        #expect(st.first { $0.id == "checkin-afternoon" }?.action == nil)   // only the next one
        #expect(st.first { $0.id == "checkin-evening" }?.action == nil)     // the evening is the close
        #expect(st.filter { !$0.id.hasPrefix("checkin-") }.allSatisfy { $0.action == nil })
    }

    @Test func checkInRowTapsSelectTheirDotOrOpenTheCover() throws {
        var day = DayLedger(date: date)
        let morning = LedgerCheckIn(id: UUID(), slot: "06:30", capturedAt: Self.at(7, 20), values: ["energy": 7])
        day.checkIns = [morning]
        let st = ritmusStations(try stations(), day: day, now: Self.at(13, 40), calendar: Self.budapest)
        func tap(_ id: String) throws -> RitmusStationTap? {
            ritmusTap(try #require(st.first { $0.id == id }), day: day, now: Self.at(13, 40), calendar: Self.budapest)
        }
        #expect(try tap("checkin-morning") == .selectDot(morning.id))
        #expect(try tap("checkin-midday") == .open(.checkin))
        #expect(try tap("checkin-evening") == .open(.este))
        #expect(try tap("bedtime") == nil)
        #expect(try tap("checkin-afternoon") == nil)        // a later moment: B2's drill-down
    }

    private func stations(at now: Date) throws -> [PathStation] {
        napkozbenStations(try brief(), now: now, evening: false, hasProposals: false, calendar: Self.budapest)
    }

    @Test func aMissedEarlierMomentNeverOffersKitoltom() throws {
        let now = Self.at(16)
        var day = DayLedger(date: date)
        day.checkIns = [LedgerCheckIn(id: UUID(), slot: "14:00", capturedAt: Self.at(15, 50), values: ["energy": 5])]
        let st = ritmusStations(try stations(at: now), day: day, now: now, calendar: Self.budapest)
        #expect(st.allSatisfy { $0.action == nil })         // morning missed, afternoon already in
        let morning = try #require(st.first { $0.id == "checkin-morning" })
        #expect(ritmusTap(morning, day: day, now: now, calendar: Self.budapest) == nil)
    }

    @Test func onlyTheCurrentMomentsRowOffersKitoltom() throws {
        let now = Self.at(16)
        let day = DayLedger(date: date)
        let st = ritmusStations(try stations(at: now), day: day, now: now, calendar: Self.budapest)
        #expect(st.filter { $0.action != nil }.map(\.id) == ["checkin-afternoon"])
        let afternoon = try #require(st.first { $0.id == "checkin-afternoon" })
        #expect(ritmusTap(afternoon, day: day, now: now, calendar: Self.budapest) == .open(.checkin))
        let midday = try #require(st.first { $0.id == "checkin-midday" })
        #expect(ritmusTap(midday, day: day, now: now, calendar: Self.budapest) == nil)
    }

    @Test func heroPillStopsOfferingKitoltomOnceThePhoneHasTheMoment() {
        let pill = LensAction(glyph: "pen-sun", title: "Kitöltöm", kind: .checkin)
        var day = DayLedger(date: date)
        #expect(heroAction(pill, day: day, now: Self.at(8, 10), calendar: Self.budapest) == pill)
        day.checkIns = [LedgerCheckIn(id: UUID(), slot: "06:30", capturedAt: Self.at(7, 20), values: ["energy": 7])]
        #expect(heroAction(pill, day: day, now: Self.at(8, 10), calendar: Self.budapest) == nil)
        #expect(heroAction(pill, day: day, now: Self.at(16), calendar: Self.budapest) == pill)   // the afternoon is still open
        let walk = LensAction(glyph: "shoe-cream", title: "Séta indítása", kind: .workout)
        #expect(heroAction(walk, day: day, now: Self.at(8, 10), calendar: Self.budapest) == walk)
        #expect(heroAction(pill, day: nil, now: Self.at(8, 10), calendar: Self.budapest) == pill)
    }

    @Test func pastGoalsAreEachDaysFirstFocusOnly() async throws {
        let source = GoalsSource(["2026-11-02": ["Meal prep a hétre", "Vizet inni"], "2026-10-26": ["Meal prep a hétre", "Vizet inni"]])
        let env = environment(goals: source)
        await env.refreshPastGoals(today: date)
        #expect(env.pastGoals.map(\.text) == ["Meal prep a hétre", "Meal prep a hétre"])
    }

    @Test func pastGoalsFollowTheAskedDay() async throws {
        let source = GoalsSource([:])
        let env = environment(goals: source)
        await env.refreshPastGoals(today: "2026-11-20")
        #expect(source.calls.first?.first == "2026-11-19" && source.calls.first?.last == "2026-10-21")
    }

    @Test func filledCountIsTheDaysThreeMoments() {
        var day = DayLedger(date: date)
        day.checkIns = [LedgerCheckIn(id: UUID(), slot: "06:30", capturedAt: Self.at(7), values: ["energy": 7]),
                        LedgerCheckIn(id: UUID(), slot: "10:00", capturedAt: Self.at(12, 40), values: ["energy": 6]),
                        LedgerCheckIn(id: UUID(), slot: "20:00", capturedAt: Self.at(21), values: ["energy": 5])]
        #expect(filledCount(day) == 2)
        #expect(filledLabel(day) == "2 / 3 kitöltés")
    }

    @Test func routerOpensAndClosesTheCovers() {
        let router = RitmusRouter()
        router.open(.checkin)
        #expect(router.cover == .checkin)
        router.close()
        #expect(router.cover == nil)
        #expect(RitmusCover(route: "boop://este") == .este && RitmusCover(route: "boop://checkin") == .checkin)
        #expect(RitmusCover(route: "boop://x") == nil)
    }
}
