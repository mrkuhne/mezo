import Foundation
import Observation
import OSLog

/// A check-in as the phone knows it: an answered slot of the day, pending until its outbox item is sent.
public struct LedgerCheckIn: Codable, Equatable, Identifiable, Sendable {
    /// The client ref of the write (server rows: any stable id).
    public var id: UUID
    public var slot: String
    public var capturedAt: Date
    /// Scale answers by item id (`energy`, `mood`, … `craving`, `day`); an absent key = not answered.
    public var values: [String: Int]
    public var pain: Bool?
    public var painRegions: [String]
    public var painIntensity: Int?
    public var cravingKinds: [String]
    public var askedItems: [String]
    public var quickExit: Bool
    public var note: String?
    public var pending: Bool

    public init(id: UUID, slot: String, capturedAt: Date, values: [String: Int], pain: Bool? = nil,
                painRegions: [String] = [], painIntensity: Int? = nil, cravingKinds: [String] = [],
                askedItems: [String] = [], quickExit: Bool = false, note: String? = nil, pending: Bool = false) {
        self.id = id; self.slot = slot; self.capturedAt = capturedAt; self.values = values; self.pain = pain
        self.painRegions = painRegions; self.painIntensity = painIntensity; self.cravingKinds = cravingKinds
        self.askedItems = askedItems; self.quickExit = quickExit; self.note = note; self.pending = pending
    }
}

/// The goal of the day (one per day). `removed` marks a removal still on its way, so the server's old goal stays hidden.
public struct LedgerGoal: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var text: String
    public var setAt: Date
    public var pending: Bool
    public var removed: Bool

    public init(id: UUID, text: String, setAt: Date, pending: Bool = false, removed: Bool = false) {
        self.id = id; self.text = text; self.setAt = setAt; self.pending = pending; self.removed = removed
    }
}

/// The evening close (one per day).
public struct LedgerClose: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var capturedAt: Date
    public var eveningEnergy: Int?
    /// 1–5; nil only for a day closed on the web without a rating.
    public var dayRating: Int?
    public var goalText: String?
    /// `done` / `partial` / `no`.
    public var goalOutcome: String?
    public var journalId: UUID?
    public var pending: Bool

    public init(id: UUID, capturedAt: Date, eveningEnergy: Int?, dayRating: Int?, goalText: String? = nil,
                goalOutcome: String? = nil, journalId: UUID? = nil, pending: Bool = false) {
        self.id = id; self.capturedAt = capturedAt; self.eveningEnergy = eveningEnergy; self.dayRating = dayRating
        self.goalText = goalText; self.goalOutcome = goalOutcome; self.journalId = journalId; self.pending = pending
    }
}

/// A journal line of the day; `text` is nil while a voice note waits for its transcript.
public struct LedgerJournal: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var capturedAt: Date
    public var text: String?
    public var pending: Bool

    public init(id: UUID, capturedAt: Date, text: String?, pending: Bool = false) {
        self.id = id; self.capturedAt = capturedAt; self.text = text; self.pending = pending
    }
}

/// A dot on the energy-of-the-day curve.
public struct CurvePoint: Equatable, Sendable {
    public let capturedAt: Date
    public let energy: Int
    /// Not on the server yet (drawn with a dashed ring).
    public let pending: Bool
}

/// Everything the phone knows about one local day (spec §7.1): the UI reads this first, so the curve and the summary
/// never wait for the network.
public struct DayLedger: Codable, Equatable, Sendable {
    public var date: String
    public var checkIns: [LedgerCheckIn]
    public var goal: LedgerGoal?
    public var close: LedgerClose?
    public var journal: [LedgerJournal]
    /// The day's cached check-in plans by slot id, so an offline check-in still has its question of the day.
    public var plans: [String: CheckInPlanLite]

    public init(date: String, checkIns: [LedgerCheckIn] = [], goal: LedgerGoal? = nil, close: LedgerClose? = nil,
                journal: [LedgerJournal] = [], plans: [String: CheckInPlanLite] = [:]) {
        self.date = date; self.checkIns = checkIns; self.goal = goal; self.close = close; self.journal = journal
        self.plans = plans
    }

    /// The goal to show (a pending removal hides it).
    public var currentGoal: LedgerGoal? { goal?.removed == true ? nil : goal }

    /// The owner's energy answers in capture order.
    public var curvePoints: [CurvePoint] {
        checkIns.compactMap { c in c.values["energy"].map { CurvePoint(capturedAt: c.capturedAt, energy: $0, pending: c.pending) } }
            .sorted { $0.capturedAt < $1.capturedAt }
    }

    /// The server's day (fetched at `fetchedAt`) merged in: anything still pending locally wins (check-ins by slot,
    /// journal lines by id, the goal and the close as a whole); a sent local entry the server day lacks stays only
    /// when it was captured after the fetch left (the fetch could not have seen it); everything else is the
    /// server's. The cached plans stay.
    public func merged(with server: DayLedger, fetchedAt: Date) -> DayLedger {
        let serverSlots = Set(server.checkIns.map(\.slot))
        let serverJournalIds = Set(server.journal.map(\.id))
        let keptCheckIns = checkIns.filter { $0.pending || (!serverSlots.contains($0.slot) && $0.capturedAt > fetchedAt) }
        let keptSlots = Set(keptCheckIns.map(\.slot))
        let keptJournal = journal.filter { $0.pending || (!serverJournalIds.contains($0.id) && $0.capturedAt > fetchedAt) }
        let keptJournalIds = Set(keptJournal.map(\.id))
        var out = DayLedger(date: date)
        out.checkIns = (keptCheckIns + server.checkIns.filter { !keptSlots.contains($0.slot) })
            .sorted { $0.capturedAt < $1.capturedAt }
        out.goal = goal.map { $0.pending || (server.goal == nil && $0.setAt > fetchedAt) } == true ? goal : server.goal
        out.close = close.map { $0.pending || (server.close == nil && $0.capturedAt > fetchedAt) } == true ? close : server.close
        out.journal = (server.journal.filter { !keptJournalIds.contains($0.id) } + keptJournal)
            .sorted { $0.capturedAt < $1.capturedAt }
        out.plans = plans.merging(server.plans) { _, fresh in fresh }
        return out
    }

    /// Clears the pending flag of whatever carries this client ref.
    mutating func markSent(_ id: UUID) {
        for i in checkIns.indices where checkIns[i].id == id { checkIns[i].pending = false }
        for i in journal.indices where journal[i].id == id { journal[i].pending = false }
        if goal?.id == id { goal?.pending = false }
        if close?.id == id { close?.pending = false }
    }
}

/// The per-date ledgers, persisted as one JSON file per day in its directory (all loaded at start; an unreadable day
/// file is moved aside as `<date>.corrupt-<ts>.json`, never overwritten). Every capture writes here first (pending)
/// and throws when the disk write fails, so the capture flow can react; the outbox's delivery clears the flag, and
/// server days merge in by slot / client ref.
@MainActor @Observable
public final class LedgerStore {
    public private(set) var days: [String: DayLedger] = [:]
    @ObservationIgnored private let directory: URL
    @ObservationIgnored private let log = Logger(subsystem: "io.mrkuhne.boop", category: "ledger")

    public init(directory: URL) {
        self.directory = directory
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        // Day files only: `yyyy-MM-dd.json` (aside copies carry a longer name).
        for file in files where file.pathExtension == "json" && file.deletingPathExtension().lastPathComponent.count == 10 {
            guard let data = try? Data(contentsOf: file) else { continue }
            if let day = try? JSONDecoder().decode(DayLedger.self, from: data) {
                days[day.date] = day
            } else {
                log.error("ledger day file unreadable, moved aside")
                RitmusFiles.moveAside(file, as: "\(file.deletingPathExtension().lastPathComponent).corrupt", stamp: Date())
            }
        }
    }

    /// Application Support/boop-ledger.
    public static func defaultDirectory() -> URL {
        URL.applicationSupportDirectory.appendingPathComponent("boop-ledger", isDirectory: true)
    }

    public func ledger(for date: String) -> DayLedger { days[date] ?? DayLedger(date: date) }

    /// A check-in replaces whatever its slot held that day (full replace, as on the server).
    public func saveCheckIn(_ checkIn: LedgerCheckIn, date: String) throws {
        try update(date) { day in
            day.checkIns.removeAll { $0.slot == checkIn.slot }
            day.checkIns.append(checkIn)
            day.checkIns.sort { $0.capturedAt < $1.capturedAt }
        }
    }

    public func setGoal(_ goal: LedgerGoal?, date: String) throws { try update(date) { $0.goal = goal } }

    public func setClose(_ close: LedgerClose?, date: String) throws { try update(date) { $0.close = close } }

    /// Adds a journal line, or replaces the one with the same id (e.g. a voice note getting its transcript).
    public func addJournal(_ entry: LedgerJournal, date: String) throws {
        try update(date) { day in
            if let i = day.journal.firstIndex(where: { $0.id == entry.id }) { day.journal[i] = entry }
            else { day.journal.append(entry) }
            day.journal.sort { $0.capturedAt < $1.capturedAt }
        }
    }

    // Background updates: nobody can react to a write failure here; it is logged and the state stays in memory.

    public func cachePlans(_ plans: [CheckInPlanLite], date: String) {
        try? update(date) { day in for plan in plans { day.plans[plan.slot] = plan } }
    }

    public func markSent(_ id: UUID, date: String) { try? update(date) { $0.markSent(id) } }

    /// `fetchedAt`: when the server fetch left (see `DayLedger.merged`).
    public func merge(server: DayLedger, fetchedAt: Date) {
        try? update(server.date) { day in day = day.merged(with: server, fetchedAt: fetchedAt) }
    }

    /// Applies the change in memory, then writes the day (throws when the write fails).
    private func update(_ date: String, _ change: (inout DayLedger) -> Void) throws {
        var day = ledger(for: date)
        change(&day)
        days[date] = day
        do {
            try RitmusFiles.write(try JSONEncoder().encode(day), to: directory.appendingPathComponent("\(date).json"))
        } catch {
            log.error("ledger write failed: \(error.localizedDescription, privacy: .public)")
            throw error
        }
    }
}
