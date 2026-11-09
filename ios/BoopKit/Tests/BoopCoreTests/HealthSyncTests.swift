import Foundation
import Testing
@testable import BoopCore

final class FakeHealth: HealthReader, @unchecked Sendable {
    var nights: [SleepSample] = []
    var days: [DayTotals] = []
    var workoutList: [WorkoutSample] = []
    private(set) var froms: [Date] = []
    func sleepSamples(from: Date, to: Date) async throws -> [SleepSample] { froms.append(from); return nights }
    func dayTotals(from: Date, to: Date, calendar: Calendar) async throws -> [DayTotals] { days }
    func workouts(from: Date, to: Date) async throws -> [WorkoutSample] { workoutList }
}

final class FakeCalendar: CalendarReader, @unchecked Sendable {
    var state: CalendarAccess = .granted
    var list: [CalendarItem] = []
    func access() async -> CalendarAccess { state }
    func requestAccess() async -> CalendarAccess { state }
    func items(from: Date, to: Date) async throws -> [CalendarItem] { list }
}

@MainActor
struct HealthSyncTests {
    let stub = StubTransport()
    let health = FakeHealth()
    let calendarReader = FakeCalendar()
    let store = UserDefaults(suiteName: "HealthSyncTests-\(UUID().uuidString)")!
    let user = UUID()
    var cal: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "Europe/Budapest")!; return c }
    var now: Date { cal.date(from: DateComponents(year: 2026, month: 11, day: 9, hour: 6, minute: 50))! }

    func sync() -> HealthSync {
        let n = now
        return HealthSync(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub), health: health,
                          calendar: calendarReader, store: store, userId: user, now: { n }, cal: cal)
    }
    /// One staged night ending on `day` of November.
    func night(_ day: Int) -> [SleepSample] {
        let start = cal.date(from: DateComponents(year: 2026, month: 11, day: day, hour: 0, minute: 0))!
            .addingTimeInterval(-20 * 60)
        return [SleepSample(start: start, end: start.addingTimeInterval(7 * 3600), stage: .core, source: "Sleep Cycle")]
    }
    func nightsBack(_ count: Int) -> [SleepSample] {
        (0..<count).flatMap { i -> [SleepSample] in
            let wake = cal.date(byAdding: .day, value: -i, to: cal.date(from: DateComponents(year: 2026, month: 11, day: 9, hour: 6))!)!
            let start = wake.addingTimeInterval(-7 * 3600)
            return [SleepSample(start: start, end: wake, stage: .core, source: "Sleep Cycle")]
        }
    }
    let ok = #"{"inserted":1,"updated":0}"#
    func okEverything() { for _ in 0..<5 { stub.on("ingestSleepNights", .json(200, ok)); stub.on("ingestDailyMetrics", .json(200, ok)); stub.on("ingestWorkouts", .json(200, ok)) }; stub.on("replaceCalendarDays", .status(204)) }

    @Test func firstRunReadsSixtyDays() async {
        okEverything()
        await sync().syncAll()
        let expected = cal.date(byAdding: .day, value: -60, to: cal.startOfDay(for: now))!
        #expect(health.froms.first == expected)
    }

    @Test func laterRunOverlapsTwoDays() async {
        store.set("2026-11-08", forKey: "boop.health.syncedThrough.\(user)")
        okEverything()
        await sync().syncAll()
        #expect(health.froms.first == cal.date(from: DateComponents(year: 2026, month: 11, day: 6)))
    }

    @Test func batchesAndProgress() async {
        health.nights = nightsBack(61)
        okEverything()
        let s = sync()
        await s.syncAll()
        #expect(stub.ops.filter { $0 == "ingestSleepNights" }.count == 3)
        #expect(s.phase == .done(.init(nights: 61, days: 0, workouts: 0, events: 0)))
        #expect(s.pending == .init(nights: 61, days: 0, workouts: 0, events: 0))
        #expect(s.lastSummary == .init(nights: 61, days: 0, workouts: 0, events: 0))
        #expect(store.string(forKey: "boop.health.syncedThrough.\(user)") == "2026-11-09")
    }

    @Test func interruptedBackfillStartsOverSafely() async {
        health.nights = nightsBack(61)
        stub.on("ingestSleepNights", .json(200, ok))
        stub.on("ingestSleepNights", .fail(URLError(.notConnectedToInternet)))
        let s = sync()
        await s.syncAll()
        #expect(s.phase == .failed(.offline))
        #expect(store.string(forKey: "boop.health.syncedThrough.\(user)") == nil)
        okEverything()
        await sync().syncAll()
        let expected = cal.date(byAdding: .day, value: -60, to: cal.startOfDay(for: now))!
        #expect(health.froms.last == expected)
    }

    @Test func rerunSendsSameIdsAgain() async {
        health.nights = night(9)
        okEverything(); okEverything()
        await sync().syncAll()
        await sync().syncAll()
        let bodies = stub.sent.filter { $0.op == "ingestSleepNights" }.compactMap(\.body)
        #expect(bodies.count == 2)
        #expect(bodies[0].contains("hk-night-2026-11-09"))
        #expect(bodies[0] == bodies[1])
    }

    @Test func calendarDeniedStillSyncsHealth() async {
        calendarReader.state = .denied
        health.nights = night(9)
        okEverything()
        let s = sync()
        await s.syncAll()
        #expect(!stub.ops.contains("replaceCalendarDays"))
        #expect(stub.ops.contains("ingestSleepNights"))
        guard case .done = s.phase else { Issue.record("phase \(s.phase)"); return }
    }

    @Test func calendarGrantedSendsTwoDays() async {
        calendarReader.list = [CalendarItem(title: "Egyeztetés", start: now.addingTimeInterval(3600), end: now.addingTimeInterval(5400), allDay: false, calendar: "Munka")]
        okEverything()
        let s = sync()
        await s.syncAll()
        let body = stub.sent.first { $0.op == "replaceCalendarDays" }?.body ?? ""
        #expect(body.contains("2026-11-09") && body.contains("2026-11-10"))
        #expect(s.phase == .done(.init(nights: 0, days: 0, workouts: 0, events: 1)))
    }

    @Test func unauthorizedStops() async {
        health.nights = night(9)
        stub.on("ingestSleepNights", .json(401, #"[{"code":"AUTH_UNAUTHORIZED","type":"REQUEST"}]"#))
        let s = sync()
        await s.syncAll()
        #expect(s.phase == .failed(.unauthorized))
        #expect(stub.ops == ["ingestSleepNights"])
    }
}
