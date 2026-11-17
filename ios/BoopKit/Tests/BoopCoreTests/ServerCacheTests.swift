import Foundation
import Testing
@testable import BoopCore

private struct Payload: Codable, Equatable, Sendable {
    var title: String
    var sets: Int
}

private func tempDirectory() -> URL {
    let url = URL.temporaryDirectory.appendingPathComponent("server-cache-\(UUID().uuidString)", isDirectory: true)
    try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}

/// A clock the test moves by hand, so nothing here waits on real time.
private final class Ticker: @unchecked Sendable {
    private let lock = NSLock()
    private var now: Date
    init(_ start: Date) { now = start }
    var date: Date { lock.withLock { now } }
    func advance(_ seconds: TimeInterval) { lock.withLock { now += seconds } }
}

struct ServerCacheTests {
    let day = "2026-11-16"

    @Test func roundTripsAValueWithItsFetchInstant() async throws {
        let dir = tempDirectory()
        let stamp = Date(timeIntervalSince1970: 1_800_000_000)
        let cache = ServerCache(directory: dir, clock: { stamp })

        try await cache.put(Payload(title: "Pull Day", sets: 18), endpoint: "train/today", date: day)
        let hit = await cache.get(Payload.self, endpoint: "train/today", date: day, maxAge: 3600)

        #expect(hit?.value == Payload(title: "Pull Day", sets: 18))
        #expect(hit?.fetchedAt == stamp)
        #expect(hit?.age == 0)
    }

    @Test func returnsNilPastMaxAge() async throws {
        let dir = tempDirectory()
        let clock = Ticker(Date(timeIntervalSince1970: 1_800_000_000))
        let cache = ServerCache(directory: dir, clock: { clock.date })

        try await cache.put(Payload(title: "Pull Day", sets: 18), endpoint: "train/today", date: day)
        clock.advance(7200)
        let hit = await cache.get(Payload.self, endpoint: "train/today", date: day, maxAge: 3600)

        // The caller must say „nincs friss adat" rather than quietly show a two-hour-old plan as today's.
        #expect(hit == nil)
    }

    @Test func returnsNilWhenNothingWasEverStored() async {
        let cache = ServerCache(directory: tempDirectory(), clock: { Date() })
        let hit = await cache.get(Payload.self, endpoint: "train/today", date: day, maxAge: 3600)
        #expect(hit == nil)
    }

    @Test func keysByEndpointAndDate() async throws {
        let dir = tempDirectory()
        let cache = ServerCache(directory: dir, clock: { Date() })

        try await cache.put(Payload(title: "Pull Day", sets: 18), endpoint: "train/today", date: "2026-11-16")
        try await cache.put(Payload(title: "Push Day", sets: 21), endpoint: "train/today", date: "2026-11-17")

        let first = await cache.get(Payload.self, endpoint: "train/today", date: "2026-11-16", maxAge: 3600)
        let second = await cache.get(Payload.self, endpoint: "train/today", date: "2026-11-17", maxAge: 3600)
        #expect(first?.value.title == "Pull Day")
        #expect(second?.value.title == "Push Day")
    }

    @Test func survivesAProcessRestart() async throws {
        let dir = tempDirectory()
        let stamp = Date(timeIntervalSince1970: 1_800_000_000)
        try await ServerCache(directory: dir, clock: { stamp })
            .put(Payload(title: "Pull Day", sets: 18), endpoint: "train/today", date: day)

        // A second cache over the same folder is what the next launch of the app has.
        let next = ServerCache(directory: dir, clock: { stamp + 60 })
        let hit = await next.get(Payload.self, endpoint: "train/today", date: day, maxAge: 3600)

        #expect(hit?.value.title == "Pull Day")
        #expect(hit?.age == 60)
    }

    @Test func purgeDropsOldEntriesOnly() async throws {
        let dir = tempDirectory()
        let clock = Ticker(Date(timeIntervalSince1970: 1_800_000_000))
        let cache = ServerCache(directory: dir, clock: { clock.date })

        try await cache.put(Payload(title: "Régi", sets: 1), endpoint: "train/today", date: "2026-11-10")
        clock.advance(86_400 * 3)
        try await cache.put(Payload(title: "Friss", sets: 2), endpoint: "train/today", date: "2026-11-13")

        await cache.purge(olderThan: 86_400 * 2)

        let old = await cache.get(Payload.self, endpoint: "train/today", date: "2026-11-10", maxAge: .infinity)
        let fresh = await cache.get(Payload.self, endpoint: "train/today", date: "2026-11-13", maxAge: .infinity)
        #expect(old == nil)
        #expect(fresh?.value.title == "Friss")
    }

    @Test func aCorruptEntryReadsAsAbsent() async throws {
        let dir = tempDirectory()
        let cache = ServerCache(directory: dir, clock: { Date() })
        try await cache.put(Payload(title: "Pull Day", sets: 18), endpoint: "train/today", date: day)

        // Half a file: a write interrupted by the phone being killed mid-save.
        let file = try #require(try FileManager.default.contentsOfDirectory(atPath: dir.path()).first)
        try Data("{\"fetchedAt\":".utf8).write(to: dir.appendingPathComponent(file))

        let hit = await cache.get(Payload.self, endpoint: "train/today", date: day, maxAge: 3600)
        #expect(hit == nil)
        // And it does not sit there failing forever.
        #expect(FileManager.default.fileExists(atPath: dir.appendingPathComponent(file).path()) == false)
    }
}
