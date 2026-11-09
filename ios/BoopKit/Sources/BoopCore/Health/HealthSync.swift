import Foundation
import Observation
import OpenAPIRuntime
import BoopAPI

/// Apple Health + calendar → backend (Boop S2, mezo-r36n9.2).
///
/// Window: first run the last **60 days**; afterwards from the last completed day minus **2 days**
/// (late Health writes still land). The mark moves only when a whole run succeeds — an interrupted
/// backfill simply starts over next time; the server's idempotent upserts make the repeat harmless.
/// Order: nights → days → workouts → calendar (today + tomorrow, only with calendar access).
@MainActor @Observable
public final class HealthSync {
    public struct Summary: Equatable, Codable, Sendable {
        public var nights, days, workouts, events: Int
        public init(nights: Int, days: Int, workouts: Int, events: Int) {
            self.nights = nights; self.days = days; self.workouts = workouts; self.events = events
        }
    }
    public enum SyncError: Equatable, Sendable { case offline, server, unauthorized }
    public enum Phase: Equatable { case idle, running(progress: Double), done(Summary), failed(SyncError) }

    public private(set) var phase: Phase = .idle

    @ObservationIgnored private let client: Client
    @ObservationIgnored private let health: HealthReader
    @ObservationIgnored private let calendarReader: CalendarReader
    @ObservationIgnored private let store: UserDefaults
    @ObservationIgnored private let userId: UUID
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let cal: Calendar

    public init(client: Client, health: HealthReader, calendar: CalendarReader, store: UserDefaults = .standard,
                userId: UUID, now: @escaping () -> Date = Date.init, cal: Calendar = .current) {
        self.client = client; self.health = health; self.calendarReader = calendar; self.store = store
        self.userId = userId; self.now = now; self.cal = cal
    }

    private var markKey: String { "boop.health.syncedThrough.\(userId)" }
    private var summaryKey: String { "boop.health.summary.\(userId)" }
    private var syncedAtKey: String { "boop.health.syncedAt.\(userId)" }

    /// The last successful run's counts and time (for the Nap card).
    public var lastSummary: Summary? {
        store.data(forKey: summaryKey).flatMap { try? JSONDecoder().decode(Summary.self, from: $0) }
    }
    public var lastSyncedAt: Date? { store.object(forKey: syncedAtKey) as? Date }

    public func syncAll() async {
        if case .running = phase { return }
        phase = .running(progress: 0)
        do {
            let end = now()
            let from = windowStart()
            let nights = buildNights(try await health.sleepSamples(from: from, to: end), calendar: cal)
            let days = mapDays(try await health.dayTotals(from: from, to: end, calendar: cal))
            let workouts = try await health.workouts(from: from, to: end).map(mapWorkout)
            let batches = chunks(nights, 30).count + chunks(days, 60).count + chunks(workouts, 100).count + 1
            var sent = 0
            func step() { sent += 1; phase = .running(progress: Double(sent) / Double(batches)) }

            for batch in chunks(nights, 30) {
                try check(try await client.ingestSleepNights(body: .json(.init(nights: batch))))
                step()
            }
            for batch in chunks(days, 60) {
                try check(try await client.ingestDailyMetrics(body: .json(.init(days: batch))))
                step()
            }
            for batch in chunks(workouts, 100) {
                try check(try await client.ingestWorkouts(body: .json(.init(workouts: batch))))
                step()
            }
            let events = try await sendCalendar()
            step()

            let summary = Summary(nights: nights.count, days: days.count, workouts: workouts.count, events: events)
            store.set(dayString(end, cal), forKey: markKey)
            store.set(try? JSONEncoder().encode(summary), forKey: summaryKey)
            store.set(end, forKey: syncedAtKey)
            phase = .done(summary)
        } catch {
            phase = .failed(map(error))
        }
    }

    /// Calendar only (on an EventKit change notification).
    public func syncCalendar() async {
        _ = try? await sendCalendar()
    }

    /// Sends today + tomorrow when calendar access is granted; returns the number of events sent.
    private func sendCalendar() async throws -> Int {
        guard await calendarReader.access() == .granted else { return 0 }
        let today = cal.startOfDay(for: now())
        let items = try await calendarReader.items(from: today, to: cal.date(byAdding: .day, value: 2, to: today)!)
        let days = buildCalendarDays(items, today: now(), calendar: cal)
        switch try await client.replaceCalendarDays(body: .json(.init(days: days))) {
        case .noContent: return days.reduce(0) { $0 + $1.events.count }
        case .unauthorized: throw HealthSyncFailure.unauthorized
        default: throw HealthSyncFailure.server
        }
    }

    private func windowStart() -> Date {
        let today = cal.startOfDay(for: now())
        if let mark = store.string(forKey: markKey), let markDay = parseDay(mark) {
            return cal.date(byAdding: .day, value: -2, to: markDay)!
        }
        return cal.date(byAdding: .day, value: -60, to: today)!
    }

    private func parseDay(_ s: String) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }

    private func check<T>(_ output: T) throws {
        let label = String(describing: output)
        if label.hasPrefix("ok(") { return }
        if label.hasPrefix("unauthorized") { throw HealthSyncFailure.unauthorized }
        throw HealthSyncFailure.server
    }

    private func map(_ error: Error) -> SyncError {
        switch error {
        case HealthSyncFailure.unauthorized: .unauthorized
        case HealthSyncFailure.server: .server
        default: isNetworkFailure(error) ? .offline : .server
        }
    }
}

private enum HealthSyncFailure: Error { case unauthorized, server }

private func chunks<T>(_ list: [T], _ size: Int) -> [[T]] {
    stride(from: 0, to: list.count, by: size).map { Array(list[$0..<min($0 + size, list.count)]) }
}
