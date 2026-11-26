import CryptoKit
import Foundation
import OSLog

/// `supplementTick`: one daypart group of the supplement protocol taken on `day` (`yyyy-MM-dd`) — a one-way write the
/// phone queues (the room's "Bevettem", the quick sheet, the alarm's "Bevettem"), sent through the outbox.
public struct SupplementTickPayload: Codable, Equatable, Sendable {
    public let day: String
    public let daypart: String
    public init(day: String, daypart: String) { self.day = day; self.daypart = daypart }
}

/// A stable key for "this day's group of this daypart": replaying the tap (after a lost answer, or after a relaunch
/// that forgot it was done) repeats the same key, and the server dedupes.
public func supplementRef(day: String, daypart: String) -> UUID {
    let d = Array(SHA256.hash(data: Data("etel-supplements|\(day)|\(daypart)".utf8)))
    return UUID(uuid: (d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[10], d[11], d[12], d[13], d[14], d[15]))
}

/// Which supplement groups were taken on which day, per user (`<folder>/supplements-taken.json`). A tick is "taken" the
/// moment it is queued (ids unknown, `[]`); the sender fills the intake ids in once the server answers, which is what
/// the room's undo needs. Only the room's explicit `undo` ever removes a group. Days older than 14 are pruned on write.
public final class SupplementTakenStore: @unchecked Sendable {
    private let fileURL: URL
    private let lock = NSLock()
    private var days: [String: [String: [String]]]
    private static let log = Logger(subsystem: "hu.mezo.boop", category: "SupplementTakenStore")
    static let keepDays = 14

    public init(fileURL: URL) {
        self.fileURL = fileURL
        let data = try? Data(contentsOf: fileURL)
        days = data.flatMap { try? JSONDecoder().decode([String: [String: [String]]].self, from: $0) } ?? [:]
    }

    /// daypart → intake ids of `day` (`[]` = queued or sent, ids unknown).
    public func taken(day: String) -> [String: [UUID]] {
        // another process or instance may have written since: always read through the file
        lock.withLock {
            reread()
            return (days[day] ?? [:]).mapValues { $0.compactMap(UUID.init(uuidString:)) }
        }
    }

    /// `ids == nil`: queued — marks the group taken and never touches ids already known. `ids` given: those are the
    /// server's intake entries now. Never removes a group.
    public func markTaken(day: String, daypart: String, ids: [UUID]?) {
        lock.withLock {
            reread()
            var d = days[day] ?? [:]
            if let ids {
                d[daypart] = ids.map(\.uuidString)
            } else if d[daypart] == nil {
                d[daypart] = []
            }
            days[day] = d
            write(around: day)
        }
    }

    /// The room's explicit undo (and nothing else): the group is no longer taken.
    public func undo(day: String, daypart: String) {
        lock.withLock {
            reread()
            guard var d = days[day], d[daypart] != nil else { return }
            d[daypart] = nil
            days[day] = d.isEmpty ? nil : d
            write(around: day)
        }
    }

    /// One-time migration of the old per-phone key (`etel.takenIds.<day>` in `UserDefaults`): read in, then removed.
    public func migrateLegacy(day: String, defaults: UserDefaults = .standard) {
        let key = "etel.takenIds.\(day)"
        guard let saved = defaults.dictionary(forKey: key) as? [String: [String]] else { return }
        for (daypart, ids) in saved {
            markTaken(day: day, daypart: daypart, ids: ids.compactMap(UUID.init(uuidString:)))
        }
        defaults.removeObject(forKey: key)
    }

    private func reread() {
        guard let data = try? Data(contentsOf: fileURL),
              let d = try? JSONDecoder().decode([String: [String: [String]]].self, from: data) else { return }
        days = d
    }

    private func write(around day: String) {
        prune(around: day)
        do {
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let enc = JSONEncoder()
            enc.outputFormatting = [.sortedKeys]
            let data = try enc.encode(days)
            #if os(iOS)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            #else
            try data.write(to: fileURL, options: [.atomic])
            #endif
        } catch {
            Self.log.error("could not write supplements-taken: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Drops days more than 14 days before the day just written (and unparseable keys).
    private func prune(around day: String) {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        func date(_ s: String) -> Date? {
            let p = s.split(separator: "-").compactMap { Int($0) }
            guard p.count == 3 else { return nil }
            return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
        }
        guard let anchor = date(day), let cutoff = cal.date(byAdding: .day, value: -Self.keepDays, to: anchor) else { return }
        days = days.filter { key, _ in date(key).map { $0 >= cutoff } ?? false }
    }
}
