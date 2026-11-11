import Foundation
import Observation
import OpenAPIRuntime
import BoopAPI

/// Apple Health + calendar → backend (Boop S2 mezo-r36n9.2, B1 "Adatalap" mezo-r36n9.11).
///
/// **What is read how**
/// - *Day rollups* (statistics collections, the full `daily_metric` row): re-read window — first run the
///   last **60 days**, afterwards from the last completed day (the mark) minus **2 days**.
/// - *Nights*: an anchored read of sleep analysis decides. No change → nights are skipped; added samples →
///   rebuild from the regular window (earlier when an added sample is older, capped at 60 days); **any
///   deletion** → rebuild the whole 60-day window and send it with `windowFrom/windowTo`, so the server
///   drops Health nights that are gone. A deletion that leaves the window with no night at all cannot be
///   sent (the contract needs ≥ 1 night) — documented limitation. Each night carries the winning app
///   (`sourceApp`) and the average heart rate over its asleep intervals (`sleepingHr`).
/// - *Workouts* and the *discrete samples* (HRV, breathing, SpO2, wrist temperature, VO2max, HR recovery,
///   walking HR, body mass/fat/lean, mindful, State of Mind, breathing disturbances): anchored reads, the
///   first one (no anchor) from 60 days back. Added → ingest; deleted uuids → `deleteHealthRecords`.
///   A workout without writer-attached heart rate (Huawei) gets avg/max from Health over its time range.
/// - *Heart rate*: never raw — 5-minute buckets (avg/min/max), recomputed each run over a window (first
///   run 14 days, afterwards its own mark minus 2 days). No anchored query: the window recompute already
///   covers late writes, and the server ignores unchanged re-sends. Buckets are never deleted.
///
/// **Anchors** live in `UserDefaults` per user and kind, and move only after every batch of that kind
/// was acknowledged (2xx). A 5xx, offline or a locked phone leaves the old anchor, so the next run
/// re-sends (the server is idempotent). The day mark (and the "v2 backfill done" flag that makes phones
/// synced before B1 re-read the 60 days once for the new day fields) moves only when a whole run succeeds.
///
/// **Order**: nights → days → workouts (+ deletions) → samples per metric (+ deletions) → HR buckets →
/// calendar. Batches: nights 30, days 60, workouts 100, samples 500, deletions 500, calendar 14 days.
///
/// **Calendar**: the first run backfills 60 past days + today + tomorrow (≤ 14 days per call); afterwards
/// yesterday…tomorrow. Its failure is reported apart and never undoes the Health upload.
///
/// **Entry points**: `syncAll()` (UI: phase/progress) and `syncIncremental()` (a background wake: the
/// same pipeline without progress churn; returns success). Runs never overlap — a call made while one
/// is in flight waits for it and shares its result.
@MainActor @Observable
public final class HealthSync {
    public struct Summary: Equatable, Codable, Sendable {
        public var nights, days, workouts, events: Int
        /// Discrete samples + heart-rate buckets sent (B1; 0 in summaries stored before it).
        public var samples: Int
        public init(nights: Int, days: Int, workouts: Int, events: Int, samples: Int = 0) {
            self.nights = nights; self.days = days; self.workouts = workouts; self.events = events
            self.samples = samples
        }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            nights = try c.decode(Int.self, forKey: .nights)
            days = try c.decode(Int.self, forKey: .days)
            workouts = try c.decode(Int.self, forKey: .workouts)
            events = try c.decode(Int.self, forKey: .events)
            samples = try c.decodeIfPresent(Int.self, forKey: .samples) ?? 0
        }
    }
    public enum SyncError: Equatable, Sendable { case offline, server, unauthorized }
    public enum Phase: Equatable { case idle, running(progress: Double), done(Summary), failed(SyncError) }

    public private(set) var phase: Phase = .idle
    /// What this run read from Health (known before sending), for the live counts on the backfill page.
    public private(set) var pending: Summary?
    /// The last run uploaded Health but the calendar step failed (shown on its own; Health is kept).
    public private(set) var calendarFailed = false

    @ObservationIgnored private let client: Client
    @ObservationIgnored private let health: HealthReader
    @ObservationIgnored private let calendarReader: CalendarReader
    @ObservationIgnored private let store: UserDefaults
    @ObservationIgnored private let userId: UUID
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let cal: Calendar
    @ObservationIgnored private var inFlight: Task<Bool, Never>?

    public init(client: Client, health: HealthReader, calendar: CalendarReader, store: UserDefaults = .standard,
                userId: UUID, now: @escaping () -> Date = Date.init, cal: Calendar = .current) {
        self.client = client; self.health = health; self.calendarReader = calendar; self.store = store
        self.userId = userId; self.now = now; self.cal = cal
    }

    static let backfillDays = 60
    static let heartRateBackfillDays = 14
    static let calendarBatchDays = 14

    private var markKey: String { "boop.health.syncedThrough.\(userId)" }
    private var summaryKey: String { "boop.health.summary.\(userId)" }
    private var syncedAtKey: String { "boop.health.syncedAt.\(userId)" }
    private var idsKey: String { "boop.health.syncedIds.\(userId)" }
    private var v2Key: String { "boop.health.v2.\(userId)" }
    private var hrMarkKey: String { "boop.health.hrThrough.\(userId)" }
    private var calendarBackfilledKey: String { "boop.calendar.backfilled.\(userId)" }
    private func anchorKey(_ kind: String) -> String { "boop.health.anchor.\(userId).\(kind)" }

    /// Everything synced so far (distinct nights, days, workouts; events = the last calendar snapshot;
    /// samples = the last run's), for the Nap card. Kept as id sets so re-sent records are not counted
    /// twice. Nil before the first run.
    public var totals: Summary? {
        guard let ids = storedIds else { return nil }
        return Summary(nights: ids.nights.count, days: ids.days.count, workouts: ids.workouts.count,
                       events: lastSummary?.events ?? 0, samples: lastSummary?.samples ?? 0)
    }
    private struct SyncedIds: Codable { var nights: Set<String> = [], days: Set<String> = [], workouts: Set<String> = [] }
    private var storedIds: SyncedIds? { store.data(forKey: idsKey).flatMap { try? JSONDecoder().decode(SyncedIds.self, from: $0) } }

    /// The last successful run's counts and time (for the Nap card).
    public var lastSummary: Summary? {
        store.data(forKey: summaryKey).flatMap { try? JSONDecoder().decode(Summary.self, from: $0) }
    }
    public var lastSyncedAt: Date? { store.object(forKey: syncedAtKey) as? Date }

    /// Foreground sync with phase/progress for the UI.
    public func syncAll() async { _ = await perform(visible: true) }

    /// Background-wake sync: the same pipeline, no progress churn; a non-auth failure leaves the phase
    /// as it was (no error banner from a wake). Returns true when the run succeeded.
    public func syncIncremental() async -> Bool { await perform(visible: false) }

    private func perform(visible: Bool) async -> Bool {
        if let inFlight { return await inFlight.value }
        let task = Task { await self.run(visible: visible) }
        inFlight = task
        let ok = await task.value
        inFlight = nil
        return ok
    }

    private func run(visible: Bool) async -> Bool {
        if visible { phase = .running(progress: 0) }
        do {
            let summary = try await pipeline(visible: visible)
            phase = .done(summary)
            return true
        } catch {
            let e = map(error)
            if visible || e == .unauthorized { phase = .failed(e) }
            return false
        }
    }

    // MARK: - Pipeline

    private struct SampleWork {
        let metric: HealthMetric
        let added: [Components.Schemas.HealthSampleIn]
        let deleted: [String]
        let anchor: Data
    }

    private func pipeline(visible: Bool) async throws -> Summary {
        let end = now()
        let today = cal.startOfDay(for: end)
        let backfillStart = cal.date(byAdding: .day, value: -Self.backfillDays, to: today)!
        let regular = regularWindowStart(today: today, backfillStart: backfillStart)

        // 1. Read everything first (the backfill page shows the counts before sending).
        let sleepAnchor = anchor("sleep")
        let sleepChange = try await health.sleepChanges(anchor: sleepAnchor, from: backfillStart.addingTimeInterval(-18 * 3600))
        var nightFrom: Date?
        var nightWindow: (from: String, to: String)?
        if sleepAnchor == nil {
            nightFrom = regular
        } else if !sleepChange.deletedIds.isEmpty {
            nightFrom = backfillStart
            nightWindow = (dayString(backfillStart, cal), dayString(end, cal))
        } else if let earliest = sleepChange.added.map(\.end).min() {
            nightFrom = max(backfillStart, min(regular, cal.startOfDay(for: earliest)))
        }
        var nights: [Components.Schemas.SleepNightIn] = []
        if let nightFrom {
            // Sleep is read from 18 h before the window so the night waking on its first day keeps its
            // evening part; nights waking before the window are not re-sent (they would be half-read).
            let firstDay = dayString(nightFrom, cal)
            let drafts = buildNightDrafts(try await health.sleepSamples(from: nightFrom.addingTimeInterval(-18 * 3600), to: end),
                                          calendar: cal).filter { $0.night.date >= firstDay }
            for d in drafts {
                var night = d.night
                if !d.asleep.isEmpty, let avg = try await health.heartRate(during: d.asleep)?.avg {
                    night.sleepingHr = Int(avg.rounded())
                }
                nights.append(night)
            }
        }

        let days = mapDays(try await health.dayTotals(from: regular, to: end, calendar: cal))

        let workoutAnchor = anchor("workouts")
        let workoutChange = try await health.workoutChanges(anchor: workoutAnchor, from: backfillStart)
        var workouts: [Components.Schemas.WorkoutIn] = []
        for var w in workoutChange.added {
            if w.avgHr == nil || w.maxHr == nil, w.end > w.start,
               let hr = try await health.heartRate(during: [DateInterval(start: w.start, end: w.end)]) {
                if w.avgHr == nil { w.avgHr = hr.avg.map { Int($0.rounded()) } }
                if w.maxHr == nil { w.maxHr = hr.max.map { Int($0.rounded()) } }
            }
            workouts.append(mapWorkout(w))
        }
        let workoutDeletions = workoutChange.deletedIds.map(workoutExternalId)

        var sampleWork: [SampleWork] = []
        for metric in HealthMetric.anchored {
            let change = try await health.sampleChanges(metric, anchor: anchor(metric.rawValue), from: backfillStart)
            sampleWork.append(SampleWork(metric: metric, added: change.added.map(mapSample),
                                         deleted: change.deletedIds.map(sampleExternalId), anchor: change.anchor))
        }

        let hrFrom = store.string(forKey: hrMarkKey).flatMap(parseDay).map { cal.date(byAdding: .day, value: -2, to: $0)! }
            ?? cal.date(byAdding: .day, value: -Self.heartRateBackfillDays, to: today)!
        let buckets = try await health.heartRateBuckets(from: hrFrom, to: end).map(mapBucket)

        let sampleCount = sampleWork.reduce(0) { $0 + $1.added.count } + buckets.count
        pending = Summary(nights: nights.count, days: days.count, workouts: workouts.count, events: 0, samples: sampleCount)

        // 2. Send, kind by kind; an anchor moves only after all of its batches were acknowledged.
        var batches = chunks(nights, 30).count + chunks(days, 60).count + chunks(workouts, 100).count
            + chunks(workoutDeletions, 500).count + chunks(buckets, 500).count + 1
        for w in sampleWork { batches += chunks(w.added, 500).count + chunks(w.deleted, 500).count }
        var sent = 0
        func step() {
            sent += 1
            if visible { phase = .running(progress: Double(sent) / Double(batches)) }
        }

        for batch in chunks(nights, 30) {
            try check(try await client.ingestSleepNights(body: .json(.init(
                windowFrom: nightWindow?.from, windowTo: nightWindow?.to, nights: batch))))
            step()
        }
        saveAnchor(sleepChange.anchor, "sleep")

        for batch in chunks(days, 60) {
            try check(try await client.ingestDailyMetrics(body: .json(.init(days: batch))))
            step()
        }

        for batch in chunks(workouts, 100) {
            try check(try await client.ingestWorkouts(body: .json(.init(workouts: batch))))
            step()
        }
        for batch in chunks(workoutDeletions, 500) {
            try check(try await client.deleteHealthRecords(body: .json(.init(externalIds: batch))))
            step()
        }
        saveAnchor(workoutChange.anchor, "workouts")

        for work in sampleWork {
            for batch in chunks(work.added, 500) {
                try check(try await client.ingestHealthSamples(body: .json(.init(samples: batch))))
                step()
            }
            for batch in chunks(work.deleted, 500) {
                try check(try await client.deleteHealthRecords(body: .json(.init(externalIds: batch))))
                step()
            }
            saveAnchor(work.anchor, work.metric.rawValue)
        }

        for batch in chunks(buckets, 500) {
            try check(try await client.ingestHealthSamples(body: .json(.init(samples: batch))))
            step()
        }
        if !buckets.isEmpty { store.set(dayString(end, cal), forKey: hrMarkKey) }

        // 3. The calendar is its own step: its failure is reported apart and never undoes the Health upload.
        var events = 0
        calendarFailed = false
        do { events = try await sendCalendar() }
        catch HealthSyncFailure.unauthorized { throw HealthSyncFailure.unauthorized }
        catch { calendarFailed = true }
        step()

        let summary = Summary(nights: nights.count, days: days.count, workouts: workouts.count, events: events,
                              samples: sampleCount)
        // A run that read nothing (Health refused, or not yet switched on) keeps the 60-day window open.
        if nights.count + days.count + workouts.count + sampleCount > 0 {
            store.set(dayString(end, cal), forKey: markKey)
            store.set(true, forKey: v2Key)
            var ids = storedIds ?? SyncedIds()
            ids.nights.formUnion(nights.map(\.date))
            ids.days.formUnion(days.map(\.date))
            ids.workouts.formUnion(workouts.map(\.externalId))
            store.set(try? JSONEncoder().encode(ids), forKey: idsKey)
        }
        store.set(try? JSONEncoder().encode(summary), forKey: summaryKey)
        store.set(end, forKey: syncedAtKey)
        return summary
    }

    // MARK: - Calendar

    /// Calendar only (on an EventKit change notification).
    public func syncCalendar() async {
        _ = try? await sendCalendar()
    }

    /// Sends the calendar days when access is granted — the first time 60 past days + today + tomorrow
    /// in ≤ 14-day batches, afterwards yesterday…tomorrow. Returns the number of events of today + tomorrow.
    private func sendCalendar() async throws -> Int {
        guard await calendarReader.access() == .granted else { return 0 }
        let today = cal.startOfDay(for: now())
        let tomorrow = cal.date(byAdding: .day, value: 1, to: today)!
        let backfilled = store.bool(forKey: calendarBackfilledKey)
        let first = cal.date(byAdding: .day, value: backfilled ? -1 : -Self.backfillDays, to: today)!
        let items = try await calendarReader.items(from: first, to: cal.date(byAdding: .day, value: 2, to: today)!)
        let days = buildCalendarDays(items, from: first, through: tomorrow, calendar: cal)
        for batch in chunks(days, Self.calendarBatchDays) {
            switch try await client.replaceCalendarDays(body: .json(.init(days: batch))) {
            case .noContent: continue
            case .unauthorized: throw HealthSyncFailure.unauthorized
            default: throw HealthSyncFailure.server
            }
        }
        if !backfilled { store.set(true, forKey: calendarBackfilledKey) }
        let upcoming = Set([dayString(today, cal), dayString(tomorrow, cal)])
        return days.filter { upcoming.contains($0.date) }.reduce(0) { $0 + $1.events.count }
    }

    // MARK: - Windows, anchors

    /// First run (or a phone synced before B1 / before totals existed): 60 days; else the mark − 2 days.
    private func regularWindowStart(today: Date, backfillStart: Date) -> Date {
        if storedIds != nil, store.bool(forKey: v2Key), let mark = store.string(forKey: markKey), let markDay = parseDay(mark) {
            return max(backfillStart, cal.date(byAdding: .day, value: -2, to: markDay)!)
        }
        return backfillStart
    }

    private func anchor(_ kind: String) -> Data? { store.data(forKey: anchorKey(kind)) }
    private func saveAnchor(_ data: Data, _ kind: String) { store.set(data, forKey: anchorKey(kind)) }

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
