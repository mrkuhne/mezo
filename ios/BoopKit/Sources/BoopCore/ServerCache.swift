import Foundation
import OSLog

/// A cached read with the instant it was fetched — so a screen can say **how old** what it shows is instead of
/// presenting stale numbers as current.
public struct Cached<T: Sendable>: Sendable {
    public let value: T
    public let fetchedAt: Date
    public let age: TimeInterval
    public init(value: T, fetchedAt: Date, age: TimeInterval) {
        self.value = value; self.fetchedAt = fetchedAt; self.age = age
    }
}

/// The last-known-good **read** cache (`mezo-vxjj9`): one JSON file per endpoint-and-day, each wrapping the
/// payload and the moment it came from the server.
///
/// It is the sibling of `Outbox` and `DayLedger`, and deliberately the simplest of the three: **it is read-only
/// toward the server.** No sender, no retry, no ordering, no link to the outbox — nothing in here can ever cause
/// a write. That is what makes it safe to put in front of every read in the room.
///
/// Three rules it keeps:
/// - **Past `maxAge`, a hit is not a hit.** `get` returns nil rather than a value the caller might print as
///   today's. Showing nothing and saying so beats showing yesterday as today.
/// - **A corrupt or undecodable file is treated as absent and removed**, so a half-written file cannot fail
///   every launch from then on. (`Outbox` sets its bad elements *aside* because they are the owner's unsent
///   words; a cache entry is a copy of something the server still has, so there is nothing to preserve.)
/// - **Nothing here is a source of truth.** The server is; this is only what it last said.
public actor ServerCache {
    private let directory: URL
    private let clock: @Sendable () -> Date
    private static let log = Logger(subsystem: "io.mrkuhne.boop", category: "server-cache")

    public init(directory: URL, clock: @escaping @Sendable () -> Date = { Date() }) {
        self.directory = directory
        self.clock = clock
    }

    /// One stored read: the payload as the server sent it, plus when that was.
    private struct Entry<T: Codable>: Codable {
        var fetchedAt: Date
        var payload: T
    }

    /// Store a value as the last known good answer for `endpoint` on `date`. A later `put` of the same key
    /// replaces it — there is only ever one copy of each answer.
    public func put<T: Codable & Sendable>(_ value: T, endpoint: String, date: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(Entry(fetchedAt: clock(), payload: value))
        try RitmusFiles.write(data, to: file(endpoint: endpoint, date: date))
    }

    /// The last known good answer, when there is one and it is younger than `maxAge`. `maxAge: .infinity` asks
    /// for it whatever its age — only for a screen that shows the age itself.
    public func get<T: Codable & Sendable>(_ type: T.Type, endpoint: String, date: String,
                                           maxAge: TimeInterval) -> Cached<T>? {
        let url = file(endpoint: endpoint, date: date)
        guard let data = try? Data(contentsOf: url) else { return nil }
        guard let entry = try? JSONDecoder().decode(Entry<T>.self, from: data) else {
            // Unreadable: drop it so the next read is a clean miss rather than the same failure forever.
            Self.log.error("cache entry unreadable, removed: \(endpoint, privacy: .public)")
            try? FileManager.default.removeItem(at: url)
            return nil
        }
        let age = clock().timeIntervalSince(entry.fetchedAt)
        guard age <= maxAge else { return nil }
        return Cached(value: entry.payload, fetchedAt: entry.fetchedAt, age: max(0, age))
    }

    /// Drop every entry fetched longer than `age` ago. Called on launch so the folder cannot grow for ever; it is
    /// housekeeping, never correctness — `get` already refuses anything too old.
    public func purge(olderThan age: TimeInterval) {
        let cutoff = clock().addingTimeInterval(-age)
        guard let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        else { return }
        for url in files where url.pathExtension == "json" {
            guard let data = try? Data(contentsOf: url) else { continue }
            // Only `fetchedAt` is needed, so the payload's own type does not have to be known here.
            struct Stamp: Codable { var fetchedAt: Date }
            guard let stamp = try? JSONDecoder().decode(Stamp.self, from: data) else {
                try? FileManager.default.removeItem(at: url); continue
            }
            if stamp.fetchedAt < cutoff { try? FileManager.default.removeItem(at: url) }
        }
    }

    /// One file per endpoint-and-day. The endpoint's slashes are flattened, and anything that is not a plain
    /// character becomes `-`, so a key can never climb out of the folder or collide with another.
    private func file(endpoint: String, date: String) -> URL {
        directory.appendingPathComponent("\(Self.slug(endpoint))__\(Self.slug(date)).json")
    }

    static func slug(_ s: String) -> String {
        let safe = s.unicodeScalars.map { scalar -> Character in
            let c = Character(scalar)
            return c.isLetter || c.isNumber ? c : "-"
        }
        return String(safe)
    }
}
