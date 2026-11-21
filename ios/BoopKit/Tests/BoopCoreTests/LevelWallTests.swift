import Foundation
import Testing
@testable import BoopCore

@Suite("Levél — the wall source")
struct LevelWallTests {
    static let now = LevelLogicTests.at(2026, 11, 21, 9)

    static func deal(_ id: String, score: Int, hours: Double, notifiable: Bool, screen: LevelScreen = .clean, flagged: Bool = false) -> LevelItem {
        LevelItem(id: id, group: .deal, title: "Akció", summary: "Kedvezmény.", why: "Ismert bolt.", score: score,
                  validUntil: now.addingTimeInterval(hours * 3600), screen: screen, flagged: flagged, notifiable: notifiable)
    }

    @Test func nilDigestNoCandidates() {
        #expect(levelWallCandidates(nil, now: Self.now).isEmpty)
    }

    @Test func notifiableDealExpiresAtItsValidUntil() throws {
        let d = LevelDigest(lastRunAt: nil, deals: [Self.deal("x", score: 8, hours: 20, notifiable: true)])
        let c = try #require(levelWallCandidates(d, now: Self.now).first)
        #expect(c.role == .expires && c.notifiable && c.area == WallSources.level && c.id == "level-expires-x")
        #expect(c.expiresAt == d.deals[0].validUntil)
    }

    @Test func flaggedDealNeverEvenWithStaleNotifiable() {
        let d = LevelDigest(deals: [Self.deal("f", score: 9, hours: 5, notifiable: true, screen: .flagged, flagged: true),
                                    Self.deal("u", score: 9, hours: 5, notifiable: true, screen: .unknown)])
        #expect(levelWallCandidates(d, now: Self.now).isEmpty)
    }

    @Test func scoreSevenIsNotNotifiableSoNoExpires() {
        let d = LevelDigest(deals: [Self.deal("s7", score: 7, hours: 5, notifiable: false)])
        #expect(levelWallCandidates(d, now: Self.now).allSatisfy { $0.role != .expires })
    }

    @Test func expiredDealIsDropped() {
        let d = LevelDigest(deals: [Self.deal("old", score: 9, hours: -1, notifiable: true)])
        #expect(levelWallCandidates(d, now: Self.now).isEmpty)
    }

    @Test func deadlineTomorrowExpiresAtDue() throws {
        let due = LevelLogicTests.at(2026, 11, 22, 10)
        let d = LevelDigest(deadlines: [LevelItem(id: "d", group: .deadline, title: "Számla", why: "Határidő.", dueAt: due, notifiable: true),
                                        LevelItem(id: "n", group: .deadline, title: "Később", dueAt: due, notifiable: false)])
        let cs = levelWallCandidates(d, now: Self.now)
        #expect(cs.count == 1 && cs[0].expiresAt == due && cs[0].id == "level-expires-d" && cs[0].why == "Határidő.")
    }

    @Test func flaggedDeadlineNeverNotifies() {
        let d = LevelDigest(deadlines: [LevelItem(id: "d", group: .deadline, title: "T", dueAt: LevelLogicTests.at(2026, 11, 22, 10),
                                                  screen: .flagged, flagged: true, notifiable: true)])
        #expect(levelWallCandidates(d, now: Self.now).isEmpty)
    }

    @Test func happenedWhenWorthAMinuteAndRanToday() throws {
        let ran = LevelLogicTests.at(2026, 11, 21, 8)
        let c = try #require(levelWallCandidates(LevelDigest(lastRunAt: ran, worthAMinute: 3), now: Self.now).first)
        #expect(c.role == .happened && c.text == "Megjött a reggeli posta · 3 érdekes" && c.happenedAt == ran && !c.notifiable)
        #expect(!c.text.contains("Mezo") && c.id.hasPrefix("level-"))
    }

    @Test func noHappenedForZeroWorthOrAnOldRunOrNoRun() {
        #expect(levelWallCandidates(LevelDigest(lastRunAt: LevelLogicTests.at(2026, 11, 21, 8), worthAMinute: 0), now: Self.now).isEmpty)
        #expect(levelWallCandidates(LevelDigest(lastRunAt: LevelLogicTests.at(2026, 11, 20, 15), worthAMinute: 2), now: Self.now).isEmpty)
        #expect(levelWallCandidates(LevelDigest(lastRunAt: nil, worthAMinute: 2), now: Self.now).isEmpty)
    }

    @Test func theWallChoosesAnExpiringDealAsHero() throws {
        let d = LevelDigest(lastRunAt: LevelLogicTests.at(2026, 11, 21, 8), worthAMinute: 1,
                            deals: [Self.deal("x", score: 8, hours: 10, notifiable: true)])
        let wall = buildWall(levelWallCandidates(d, now: Self.now), now: Self.now)
        #expect(wall.hero?.id == "level-expires-x" && wall.rows.first?.role == .happened)
    }
}
