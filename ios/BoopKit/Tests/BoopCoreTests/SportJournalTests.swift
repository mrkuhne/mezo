import Foundation
import Testing
@testable import BoopCore

/// The Sport area's Napló and Test tabs (`mezo-r36n9.205`): the journal's correct / delete round-trip through the
/// server and the cache, the hero and card words, the body map's capped heat, the shoulder, the rest and the „miért?".
enum SportJournalFixtures {
    static let listJSON = #"""
    [{"id":"s1","sport":"volleyball","date":"2026-11-23","time":"18:00","duration":120,"setsPlayed":5,"rpe":7,"shoulderStrain":8,"kcal":640,"kcalIsEstimate":false,"notes":"sok ütés"},
     {"id":"s2","sport":"volleyball","date":"2026-11-25","time":"18:00","duration":90,"setsPlayed":4,"rpe":6,"shoulderStrain":5,"kcal":480,"kcalIsEstimate":true},
     {"id":"s3","sport":"running","date":"2026-10-20","time":"07:00","duration":40,"rpe":5,"future":"x"}]
    """#
    static func list() throws -> [SportSessionRecord] {
        try JSONDecoder().decode([SportSessionRecord].self, from: Data(listJSON.utf8))
    }
    static func tempDir() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("sport-naplo-\(UUID().uuidString)") }
}

@Suite("Sport Napló — client and store")
@MainActor
struct SportJournalStoreTests {
    @Test func theStoreReadsTwelveWeeksNewestFirst() async throws {
        let stub = StubTransport()
        stub.on("listSportSessions", .json(200, SportJournalFixtures.listJSON))
        let store = SportJournalStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: SportJournalFixtures.tempDir()))
        store.today = { "2026-11-28" }
        await store.load()
        #expect(stub.sent.first?.path == "/api/train/sport-sessions?from=2026-09-06&to=2026-11-28")
        #expect(store.sessions?.map(\.id) == ["s2", "s1", "s3"])
    }

    @Test func aCorrectionRoundTripsThroughTheServerAndTheCache() async throws {
        let dir = SportJournalFixtures.tempDir()
        let stub = StubTransport()
        stub.on("listSportSessions", .json(200, SportJournalFixtures.listJSON))
        let store = SportJournalStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: dir))
        await store.load()
        var changed = 0
        store.changed = { changed += 1 }
        let s1 = try #require(store.sessions?.first { $0.id == "s1" })
        let edit = SportSessionEdit.of(s1, kind: .volleyball, minutes: 120, rpe: 8, sets: 4, shoulder: 6, note: "  ")
        stub.on("updateSportSession", .json(200, #"{"id":"s1","sport":"volleyball","date":"2026-11-23","time":"18:00","duration":120,"setsPlayed":4,"rpe":8,"shoulderStrain":6,"kcal":640,"kcalIsEstimate":false}"#))
        try await store.update(s1, edit)

        let sent = try #require(stub.sent.last)
        #expect(sent.op == "updateSportSession" && sent.path == "/api/train/sport-sessions/s1")
        let body = try JSONSerialization.jsonObject(with: Data((sent.body ?? "{}").utf8)) as? [String: Any]
        #expect(body?["duration"] as? Int == 120 && body?["rpe"] as? Double == 8 && body?["setsPlayed"] as? Int == 4)
        #expect(body?["kcalOverride"] as? Int == 640)            // the measured number is kept
        #expect(body?["notes"] == nil && body?["date"] == nil)   // an empty note goes as none; the date stays
        #expect(store.sessions?.first { $0.id == "s1" }?.rpe == 8 && changed == 1)

        // The cache holds the corrected copy: a fresh store with no net shows it.
        let offline = StubTransport()
        offline.on("listSportSessions", .fail(URLError(.notConnectedToInternet)))
        let again = SportJournalStore(client: SportClient(raw: SportFixtures.raw(offline)), cache: ServerCache(directory: dir))
        await again.load()
        #expect(again.sessions?.first { $0.id == "s1" }?.shoulderStrain == 6 && again.offline && again.problem == nil)
    }

    @Test func aDeleteRoundTripsAndGoneCountsAsDeleted() async throws {
        let dir = SportJournalFixtures.tempDir()
        let stub = StubTransport()
        stub.on("listSportSessions", .json(200, SportJournalFixtures.listJSON))
        let store = SportJournalStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: dir))
        await store.load()
        stub.on("deleteSportSession", .status(204))
        try await store.delete(try #require(store.sessions?.first { $0.id == "s2" }))
        #expect(stub.sent.last?.path == "/api/train/sport-sessions/s2")
        #expect(store.sessions?.map(\.id) == ["s1", "s3"])
        stub.on("deleteSportSession", .json(404, #"[{"code":"NOT_FOUND"}]"#))
        try await store.delete(try #require(store.sessions?.first))
        #expect(store.sessions?.map(\.id) == ["s3"])

        let offline = StubTransport()
        offline.on("listSportSessions", .fail(URLError(.notConnectedToInternet)))
        let again = SportJournalStore(client: SportClient(raw: SportFixtures.raw(offline)), cache: ServerCache(directory: dir))
        await again.load()
        #expect(again.sessions?.map(\.id) == ["s3"])
    }

    @Test func aFailedCorrectionThrowsAndKeepsTheList() async throws {
        let stub = StubTransport()
        stub.on("listSportSessions", .json(200, SportJournalFixtures.listJSON))
        let store = SportJournalStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: SportJournalFixtures.tempDir()))
        await store.load()
        let before = store.sessions
        stub.on("deleteSportSession", .fail(URLError(.notConnectedToInternet)))
        await #expect(throws: PlanFetchError.offline) { try await store.delete(try #require(before?.first)) }
        #expect(store.sessions == before)
    }

    @Test func aDeletedSessionLeavesTheWeekCountRight() async throws {
        let stub = StubTransport()
        stub.on("getSportOverview", .json(200, SportFixtures.week(weekCount: #"{"done":2,"planned":4}"#)))
        stub.on("listSportSessions", .json(200, SportJournalFixtures.listJSON))
        let sport = SportStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: SportJournalFixtures.tempDir()))
        await sport.load()
        await sport.journal.load()
        #expect(sport.week?.weekCount?.done == 2)
        // after the delete the server's week counts one less; the store reads it again with the load and the body
        stub.on("deleteSportSession", .status(204))
        stub.on("getSportOverview", .json(200, SportFixtures.week(weekCount: #"{"done":1,"planned":4}"#)))
        SportScheduleStoreTests.scripted(stub)
        stub.on("getSportBody", .json(200, #"{"weekStart":"2026-11-23","muscles":[],"sharedMuscles":0,"sportUnknown":0}"#))
        stub.on("getSportShoulder", .json(200, #"{"weeks":[]}"#))
        stub.on("getSportGaps", .json(200, #"{"weekStart":"2026-11-23","days":[],"hints":[]}"#))
        try await sport.journal.delete(try #require(sport.journal.sessions?.first { $0.id == "s2" }))
        #expect(sport.week?.weekCount?.done == 1)
        #expect(stub.ops.contains("getSportLoad") && stub.ops.contains("getSportBody"))
    }
}

@Suite("Sport Napló — words")
struct SportJournalLogicTests {
    @Test func theHeroCountsFourWeeksAndAveragesWhatIsKnown() throws {
        let h = sportJournalHero(try SportJournalFixtures.list(), today: "2026-11-28")
        #expect(h.figures.map(\.value) == ["2", "6,5", "6,5"])
        #expect(h.figures.map(\.label) == ["alkalom · 4 hét", "átlag megterhelés", "váll átlag"])
        #expect(h.rpeLine == [5, 7, 6])
        #expect(h.sentence == "A vállad az utolsó két hétben 1 alkalommal ért el 7-et vagy többet.")
        #expect(h.lineLabel == "A megterhelés az utolsó 3 alkalomban 5 és 7 között, a legutóbbi 6.")
    }

    @Test func theHeroSaysNothingItCannotKnow() {
        let run = SportSessionRecord(id: "r", sport: "running", date: "2026-11-27", duration: 40)
        let h = sportJournalHero([run], today: "2026-11-28")
        #expect(h.figures.map(\.label) == ["alkalom · 4 hét"])          // no effort, no shoulder: no invented average
        #expect(h.rpeLine.isEmpty && h.lineLabel == nil)
        #expect(h.sentence?.hasPrefix("Az utolsó két hétben nem jelölted") == true)
        #expect(sportJournalHero([], today: "2026-11-28").sentence == nil)
    }

    @Test func aCardReadsLikeTheSpikeWithoutAWatchClaim() throws {
        let list = try SportJournalFixtures.list()
        let c1 = sportJournalCard(list[0])
        #expect(c1.eyebrow == "NOV 23 · HÉTFŐ · 18:00" && c1.title == "Röplabda" && c1.load == 840)
        #expect(c1.chips == ["2 óra", "megterhelés 7", "5 szett", "váll 8"])
        #expect(c1.kcalLine == "640 kcal" && c1.note == "sok ütés")
        #expect(sportJournalCard(list[1]).kcalLine == "kb. 480 kcal — becslés")
        #expect(sportJournalCard(list[2]).kcalLine == nil && sportJournalCard(list[2]).chips == ["40 perc", "megterhelés 5"])
        #expect(c1.accessibility.hasPrefix("Röplabda, november 23., hétfő, 18:00, 2 óra"))
    }

    @Test func aChangedLengthOrKindDropsTheMeasuredKcal() throws {
        let s1 = try SportJournalFixtures.list()[0]
        #expect(SportSessionEdit.of(s1, kind: .volleyball, minutes: 90, rpe: 7, sets: 5, shoulder: 8, note: "").kcalOverride == nil)
        let run = SportSessionEdit.of(s1, kind: .running, minutes: 120, rpe: 7, sets: 5, shoulder: 8, note: "x")
        #expect(run.kcalOverride == nil && run.setsPlayed == nil && run.shoulderStrain == nil && run.notes == "x")
        #expect(sportDecimal(6.44) == "6,4" && sportDecimal(6.0) == "6")
    }
}

@Suite("Sport Test — body, shoulder, rest")
struct SportBodyLogicTests {
    static let body = SportBodyWeek(weekStart: "2026-11-23", muscles: [
        SportMuscleHeat(muscle: "shoulder-side", gymLoad: 300, sportLoad: 500, gym: 0.6, sport: 1, together: 1.4),
        SportMuscleHeat(muscle: "quad", gymLoad: 500, sportLoad: 300, gym: 1, sport: 0.6, together: 0.9),
        SportMuscleHeat(muscle: "back-wide", gymLoad: 400, gym: 0.8, together: 0.4),
        SportMuscleHeat(muscle: "calf", sportLoad: 450, sport: 0.9, together: 0.45),
    ], sharedMuscles: 2, shoulderAverage: 5.8, sportUnknown: 0)

    @Test func togetherNeverExceedsFullHeat() {
        let heat = sportBodyHeat(Self.body, .together)
        #expect(heat.allSatisfy { $0.level <= 1 && $0.level > 0 })
        #expect(heat.first { $0.muscle == "shoulder-side" }?.level == 1)
        #expect(sportBodyHeat(Self.body, .gym).map(\.muscle) == ["shoulder-side", "quad", "back-wide"])   // zero heat left out
    }

    @Test func aKindWithNoMuscleTableShowsNoHeatAndSaysSo() {
        let unmapped = SportBodyWeek(weekStart: "2026-11-23", muscles: [SportMuscleHeat(muscle: "quad", gymLoad: 400, gym: 1, together: 1)],
                                     sharedMuscles: 0, sportUnknown: 1)
        #expect(sportBodyHeat(unmapped, .sport).isEmpty)
        #expect(sportUnknownNote(unmapped)?.contains("ehhez a sporthoz még nincs izomtérképem") == true)
        #expect(sportMapLine(unmapped, .sport, sportName: "Röpi") == "Ezen a héten még nincs olyan sportalkalom, ami terhelést adna a térképre.")
        #expect(sportUnknownNote(Self.body) == nil)
    }

    @Test func theMapLinesNameTheMuscles() {
        #expect(sportMapLine(Self.body, .gym, sportName: "Röpi") == "A kondi a héten: comb, hát és váll.")
        #expect(sportMapLine(Self.body, .sport, sportName: "Röpi") == "A röpi a héten: váll, vádli és comb.")
        #expect(sportMapLine(Self.body, .together, sportName: "Röpi") == "Együtt: váll és comb kap mindkettőből.")
        #expect(sportMapLabel(Self.body, .together, sportName: "Röpi") == "Izomtérkép, Együtt: a legjobban terhelt váll, comb, vádli és hát.")
    }

    @Test func theFiguresAndTheShoulder() {
        let gaps = SportGaps(weekStart: "2026-11-23", days: [SportGapDay(date: "2026-11-23", gapHours: 9.8), SportGapDay(date: "2026-11-24", gapHours: 11)])
        #expect(sportTestFigures(Self.body, gaps: gaps).map(\.value) == ["2", "5,8", "10 ó"])
        let s = SportShoulder(weeks: [SportShoulderWeek(weekStart: "2026-11-16", average: 7.2, sessions: 2),
                                      SportShoulderWeek(weekStart: "2026-11-23", average: 6, sessions: 1)])
        let bars = sportShoulderBars(s)
        #expect(bars.map(\.label) == ["nov 16", "ez"] && bars.map(\.lit) == [true, true])
        #expect(sportShoulderSentence(s) == "Múlt héten 7,2 volt, most 6 — visszajött a 7-es vonal alá.")
        #expect(sportShoulderSentence(SportShoulder(weeks: [SportShoulderWeek(weekStart: "2026-11-23")])).hasPrefix("Még nincs vállértéked"))
        #expect(sportShoulderLabel(s).contains("nov 16: 7,2; ezen a héten: 6"))
    }

    @Test func theRestStripsAndTheirSentence() {
        let g = SportGaps(weekStart: "2026-11-23", days: [
            SportGapDay(date: "2026-11-23", blocks: [SportBlock(layer: "GYM", start: "07:00", end: "08:10", done: true),
                                                    SportBlock(layer: "SPORT", sport: "volleyball", start: "18:00", end: "20:00")], gapHours: 9.83),
            SportGapDay(date: "2026-11-24", blocks: []),
            SportGapDay(date: "2026-11-26", blocks: [SportBlock(layer: "GYM", start: "07:00", end: "08:00")]),
        ])
        let rows = sportRestRows(g)
        #expect(rows.map(\.day) == ["Hé", "Csü"] && rows.map(\.gap) == ["10 ó", "—"])
        #expect(rows[0].accessibility == "Hétfő: kondi 07:00–08:10, röpi 18:00–20:00, 10 óra pihenő köztük")
        #expect(sportRestSentence(g) == "Ahol egy napon kondi és sport is van, legalább 10 óra jut köztük — ez elég.")
        #expect(sportRestSentence(SportGaps(weekStart: "2026-11-23")) == "Ezen a héten még nincs se kondi, se sport a tervben.")
    }

    @Test func everyServerHintHasItsWhy() throws {
        let tight = try #require(sportWhy(SportHint(key: "GAP_TIGHT", date: "2026-11-25", severity: "WARN", sport: "volleyball", gapHours: 2.5)))
        #expect(tight.facts.first?.value == "2,5" && tight.sub.hasPrefix("Szerdán a kondi és a röpi"))
        #expect(tight.experts.map(\.label) == ["Mozgás", "Szkeptikus"] && tight.closing == sportWhyClosing)
        #expect(sportWhy(SportHint(key: "SPORT_LOAD_DECLINE", date: "2026-11-25", pairs: 3))?.facts.first?.value == "3")
        #expect(sportWhy(SportHint(key: "UNKNOWN", date: "2026-11-25")) == nil)
        // the Ma/Test hint lines carry the server hint behind them
        let week = try SportFixtures.decode(SportFixtures.week(hints: #"[{"key":"SPORT_LOAD_DECLINE","date":"2026-11-25","severity":"INFO","sport":"volleyball","pairs":2}]"#))
        #expect(sportHints(week).contains { $0.source?.key == "SPORT_LOAD_DECLINE" })
    }
}

@Suite("Sport Napló + Test — heads")
struct SportJournalHeadTests {
    @Test func journalHeadCountsFourWeeksAndSaysEmpty() throws {
        let list = try SportJournalFixtures.list()
        #expect(sportJournalHead(list, today: "2026-11-28").sentence.hasPrefix("2 alkalom"))
        #expect(sportJournalHead([], today: "2026-11-28").sentence.hasPrefix("Még üres"))
        #expect(sportJournalHead(list, today: "2027-03-01").sentence.contains("nem volt alkalom"))
    }

    @Test func testHeadNamesSharedMuscles() {
        #expect(sportTestHead(nil).sentence.contains("Töltöm"))
        #expect(sportTestHead(SportBodyWeek(weekStart: "2026-11-23", muscles: [SportMuscleHeat(muscle: "quad", gym: 0.5, sport: 0.4, together: 0.9)],
                                            sharedMuscles: 1)).sentence.hasPrefix("1 izmod"))
        #expect(sportTestHead(SportBodyWeek(weekStart: "2026-11-23")).sentence.contains("még nincs terhelés"))
    }
}
