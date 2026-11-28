import Foundation
import Testing
@testable import BoopCore

/// The Sport area (`mezo-r36n9.203`): the week's wire, the client, the words of the Ma tab and the store.
enum SportFixtures {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.invalid")!, token: { "t" })
    }

    /// Wednesday 2026-11-25: gym every weekday morning, volleyball Mon/Tue/Wed/Fri 18:00.
    static func week(moment: String? = "BEFORE", tonight extra: String = "", todayGym: Bool = true, todaySport: Bool = true,
                     hints: String = "[]", weekCount: String = #"{"done":2,"planned":4}"#) -> String {
        let gym = #"{"layer":"GYM","label":"Mell + bicepsz","time":"07:00","durationMin":70,"state":"DONE"}"#
        let todaySportState = moment == "DONE" ? "DONE" : moment == "SKIPPED" ? "SKIPPED" : "PLANNED"
        let sport = #"{"layer":"SPORT","sport":"volleyball","time":"18:00","durationMin":120,"state":"\#(todaySportState)"}"#
        let tonight = moment.map { m in
            #"{"sport":"volleyball","time":"18:00","durationMin":120,"kind":"training","location":"Sportcsarnok","moment":"\#(m)"\#(extra)}"#
        } ?? "null"
        return #"""
        {"weekStart":"2026-11-23","weekEnd":"2026-11-29","today":"2026-11-25",
         "days":[
          {"date":"2026-11-23","gym":[{"layer":"GYM","label":"Hát","time":"07:00","state":"DONE"}],"sport":[{"layer":"SPORT","sport":"volleyball","time":"18:00","durationMin":120,"state":"DONE","load":840}]},
          {"date":"2026-11-24","gym":[{"layer":"GYM","label":"Láb + kar","time":"07:00","state":"DONE"}],"sport":[{"layer":"SPORT","sport":"volleyball","time":"18:00","durationMin":120,"state":"DONE","load":780}]},
          {"date":"2026-11-25","gym":[\#(todayGym ? gym : "")],"sport":[\#(todaySport ? sport : "")]},
          {"date":"2026-11-26","gym":[{"layer":"GYM","label":"Bicepsz fókusz","state":"PLANNED"}],"sport":[]},
          {"date":"2026-11-27","gym":[],"sport":[{"layer":"SPORT","sport":"volleyball","time":"18:00","durationMin":120,"state":"PLANNED"}]},
          {"date":"2026-11-28","gym":[],"sport":[]},
          {"date":"2026-11-29","gym":[],"sport":[]}],
         "totals":{"gymMinutes":200,"sportMinutes":240,"movementMinutes":440,"gymSessions":3,"sportSessions":2},
         "weekCount":\#(weekCount),"tonight":\#(tonight),"hints":\#(hints),"futureField":"ignored"}
        """#
    }

    static func decode(_ json: String) throws -> SportOverview {
        try JSONDecoder().decode(SportOverview.self, from: Data(json.utf8))
    }
}

@Suite("Sport — wire and client")
struct SportWireTests {
    @Test func theWeekDecodesLeniently() throws {
        let o = try SportFixtures.decode(SportFixtures.week())
        #expect(o.days.count == 7 && o.todayDay?.gym.first?.label == "Mell + bicepsz")
        #expect(o.weekCount == SportWeekCount(done: 2, planned: 4))
        #expect(o.tonight?.sportKind == .volleyball && o.tonight?.location == "Sportcsarnok")
        #expect(SportKind(wire: "kitesurf") == .other)
    }

    @Test func theLegacyWeekdayStartsOnMonday() {
        #expect(sportLegacyWeekday("2026-11-23") == 0)   // hétfő
        #expect(sportLegacyWeekday("2026-11-29") == 6)   // vasárnap
    }

    @Test func clientPathsAndBodies() async throws {
        let stub = StubTransport()
        stub.on("getSportOverview", .json(200, SportFixtures.week()))
        stub.on("getSportOverview", .json(200, SportFixtures.week()))
        stub.on("upsertPlannedSkip", .json(200, #"{"id":"s1","date":"2026-11-25","kind":"SPORT","reasonCategory":"TIRED","source":"USER","serious":false,"freePass":true,"excused":false}"#))
        stub.on("undoPlannedSkip", .status(204))
        let client = SportClient(raw: SportFixtures.raw(stub))
        _ = try await client.overview()
        _ = try await client.overview(week: "2026-11-18")
        let r = try await client.skip(date: "2026-11-25", time: "18:00", reason: .TIRED)
        try await client.undoSkip(id: "s1")
        #expect(r.freePass && r.id == "s1")
        #expect(stub.sent.map(\.path) == ["/api/train/sport/overview", "/api/train/sport/overview?week=2026-11-18",
                                          "/api/train/skips", "/api/train/skips/s1"])
        let body = try #require(stub.sent[2].body)
        let json = try #require(JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any])
        #expect(json["kind"] as? String == "SPORT" && json["dayOfWeek"] as? Int == 2 && json["time"] as? String == "18:00")
        #expect(json["reasonCategory"] as? String == "TIRED")
    }

    @Test func undoingAGoneSkipIsDone() async throws {
        let stub = StubTransport()
        stub.on("undoPlannedSkip", .json(404, #"[{"code":"NOT_FOUND"}]"#))
        try await SportClient(raw: SportFixtures.raw(stub)).undoSkip(id: "x")
    }
}

@Suite("Sport — the Ma tab's words")
struct SportLogicTests {
    @Test func beforeTheGame() throws {
        let o = try SportFixtures.decode(SportFixtures.week(tonight: #","startsInMinutes":380"#))
        #expect(sportMoment(o) == .before)
        let head = sportHead(o)
        #expect(head.headline == "Ma este röpi")
        #expect(head.sentence == "Reggel kondi volt, este 18:00-kor röplabda. Elég idő van köztük.")
        let hero = sportHero(o)
        #expect(hero.eyebrow == "MA ESTE · 18:00" && hero.title == "Röplabda" && hero.line == "2 óra · edzés · Sportcsarnok")
        #expect(hero.figures == [SportFigure("6 ó 20 p", "múlva kezdődik"), SportFigure("2/4", "e heti röpi kész", lit: true)])
        #expect(hero.note == "Indítsd el az órádon a Röplabda edzést — utána innen töltöm ki a naplót.")
    }

    @Test func theWatchRecordedIt() throws {
        let extra = #","health":{"activityType":"volleyball","start":"2026-11-25T17:04:00Z","minutes":117,"kcal":812,"avgHr":138}"#
        let o = try SportFixtures.decode(SportFixtures.week(moment: "RECORDED", tonight: extra))
        #expect(sportHead(o) == SportHead(headline: "Az órád rögzítette a röpit", sentence: "Csak a megterhelést, a szetteket és a vállad jelöld."))
        let hero = sportHero(o, zone: TimeZone(identifier: "Europe/Budapest")!)
        #expect(hero.figures == [SportFigure("1 ó 57 p", "18:04–20:01"), SportFigure("812", "kcal az órádról", lit: true), SportFigure("138", "átlagpulzus")])
        #expect(sportStartClock(o.tonight!.health!, zone: TimeZone(identifier: "Europe/Budapest")!) == "18:04")
    }

    @Test func doneIsTheWeeksBiggestDay() throws {
        let extra = #","health":{"activityType":"volleyball","start":"2026-11-25T17:04:00Z","minutes":117,"kcal":812},"session":{"id":"x","sport":"volleyball","durationMin":120,"rpe":7,"load":840,"kcal":812,"setsPlayed":5,"shoulderStrain":6}"#
        let o = try SportFixtures.decode(SportFixtures.week(moment: "DONE", tonight: extra, weekCount: #"{"done":3,"planned":4}"#))
        #expect(sportHead(o) == SportHead(headline: "Kemény röpi volt", sentence: "Hetes megterhelés két órán át: ez a heti terhelésed legnagyobb napja."))
        let hero = sportHero(o)
        #expect(hero.eyebrow == "MA · KÉSZ")
        #expect(hero.figures.map(\.value) == ["840", "812", "5", "6/10"])
        #expect(hero.chips.map(\.text) == ["megterhelés 7", "2 ó", "az órádról"])
        #expect(sportRing(o.weekCount).display == "3/4")
    }

    @Test func skippedWithTheFreePassCanBeUndone() throws {
        let extra = #","skip":{"id":"s1","reason":"TIRED","freePass":true,"serious":false}"#
        let o = try SportFixtures.decode(SportFixtures.week(moment: "SKIPPED", tonight: extra))
        #expect(sportHead(o) == SportHead(headline: "Ma kimarad a röpi", sentence: "Fáradt voltál. A heti egy szabad kihagyásod ez lett."))
        let hero = sportHero(o)
        #expect(hero.chips == [SportChip("Fáradt voltam", on: true), SportChip("a heti szabad kihagyás")])
        #expect(hero.canUndo)
        // An advice / kímélő skip has no id on the wire: no undo.
        let advice = try SportFixtures.decode(SportFixtures.week(moment: "SKIPPED"))
        #expect(!sportHero(advice).canUndo)
    }

    @Test func aGymOnlyDayNamesTheNextGame() throws {
        let o = try SportFixtures.decode(SportFixtures.week(moment: nil, todaySport: false))
        #expect(sportMoment(o) == .none)
        #expect(sportHead(o) == SportHead(headline: "Ma nincs sport", sentence: "Ma kondi van, sport nincs. Legközelebb pénteken 18:00-kor röpi."))
        let hero = sportHero(o)
        #expect(hero.title == "Röplabda" && hero.line == "Péntek 18:00 · 2 óra")
        #expect(sportStrip(o).trailing == "kondi")
    }

    @Test func aSportOnlyDayHasNoGymBlock() throws {
        let o = try SportFixtures.decode(SportFixtures.week(todayGym: false))
        let strip = sportStrip(o)
        #expect(strip.blocks.map(\.gym) == [false] && strip.trailing == "sport")
        #expect(sportHead(o).sentence == "Ma nincs kondi, csak röplabda 18:00-kor.")
    }

    @Test func theStripHasTwoBlocks() throws {
        let strip = sportStrip(try SportFixtures.decode(SportFixtures.week()))
        #expect(strip.blocks.map(\.legend) == ["Kondi · Mell + bicepsz", "Röpi · 2 óra"])
        #expect(strip.blocks.map(\.done) == [true, false] && strip.trailing == "kondi + sport")
        #expect(sportStripLabel(strip.blocks[1]) == "Röpi 18:00, később")
    }

    @Test func theWeekCardsHaveTwoLanes() throws {
        let cards = sportWeekCards(try SportFixtures.decode(SportFixtures.week()))
        #expect(cards.map(\.name) == ["Hé", "Ke", "Sze", "Csü", "Pé", "Szo", "Va"])
        #expect(cards[2].today && cards[2].lines.map(\.text) == ["Mell + bicepsz", "Röpi"])
        #expect(cards[5].lines.isEmpty)
        #expect(sportCardLabel(cards[0]) == "Hétfő: kondi Hát, kész; sport Röpi, kész")
    }

    @Test func hintsInWords() throws {
        let hints = #"[{"key":"GAP_SHORT","date":"2026-11-25","severity":"INFO","sport":"volleyball","gapHours":4.5},{"key":"SPORT_BEFORE_LEG_MORNING","date":"2026-11-26","severity":"WATCH","sport":"volleyball","heavy":true},{"key":"GAP_TIGHT","date":"2026-11-24","severity":"WATCH","sport":"volleyball","gapHours":2}]"#
        let lines = sportHints(try SportFixtures.decode(SportFixtures.week(hints: hints)))
        #expect(lines.map(\.text) == [
            "Ma 4,5 óra van a kondi és a röpi között — elég, ha nem hajtod túl.",
            "Holnap reggel lábnap jön az előző esti kemény röpi után — ha fáj a lábad, a Könnyítés egy koppintás.",
        ])
        // No hint today, the two well apart: the calm line.
        let calm = sportHints(try SportFixtures.decode(SportFixtures.week()))
        #expect(calm == [SportHintLine(text: "Reggel kondi, este röpi: 10 óra van köztük, ez bőven elég.", ok: true)])
    }

    @Test func emptyAndRing() throws {
        let empty = SportOverview(weekStart: "2026-11-23", weekEnd: "2026-11-29", today: "2026-11-25",
                                  days: (23...29).map { SportWeekDay(date: "2026-11-\($0)") })
        #expect(sportIsEmpty(empty))
        #expect(sportRing(nil).display == "–" && sportRing(nil).level == nil)
        #expect(sportRingLabel(SportWeekCount(done: 2, planned: 4)) == "A heti 4 alkalomból 2 megvan")
        #expect(sportClock(45) == "45 p" && sportLength(90) == "1 ó 30 p" && sportEffortWord(9) == "a határon")
        #expect(sportArticle("úszás") == "az úszás")
    }
}

@Suite("Sport — the store")
@MainActor
struct SportStoreTests {
    static func tempDir() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("sport-cache-\(UUID().uuidString)") }

    @Test func theCachedWeekShowsBeforeTheFreshRead() async throws {
        let cache = ServerCache(directory: Self.tempDir())
        try await cache.put(try SportFixtures.decode(SportFixtures.week()), endpoint: "sport/overview", date: "-")
        let stub = StubTransport()
        stub.on("getSportOverview", .slowJson(200, SportFixtures.week(moment: "DONE", weekCount: #"{"done":3,"planned":4}"#), ms: 300))
        let store = SportStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: cache)
        let reading = Task { await store.load() }
        try await Task.sleep(for: .milliseconds(100))
        #expect(store.week?.weekCount?.done == 2)          // the cache, at once
        await reading.value
        #expect(store.week?.weekCount?.done == 3 && store.age == nil && !store.offline)
    }

    @Test func offlineKeepsTheCachedWeek() async throws {
        let cache = ServerCache(directory: Self.tempDir())
        try await cache.put(try SportFixtures.decode(SportFixtures.week()), endpoint: "sport/overview", date: "-")
        let stub = StubTransport()
        stub.on("getSportOverview", .fail(URLError(.notConnectedToInternet)))
        let store = SportStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: cache)
        await store.load()
        #expect(store.week != nil && store.offline && store.problem == nil)
    }

    @Test func aFaultWithNothingToShowIsTheProblem() async {
        let stub = StubTransport()
        stub.on("getSportOverview", .status(500))
        let store = SportStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: Self.tempDir()))
        await store.load()
        #expect(store.week == nil && store.problem == .server)
    }

    @Test func aQueuedLogShowsAsDoneAtOnce() async throws {
        let stub = StubTransport()
        stub.on("getSportOverview", .json(200, SportFixtures.week()))
        stub.on("getSportOverview", .json(200, SportFixtures.week()))   // the server has not seen it yet
        let store = SportStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: Self.tempDir()))
        await store.load()
        store.noteLogged(SportSessionPayload(sport: "volleyball", date: "2026-11-25", time: "18:04", durationMinutes: 117,
                                             setsPlayed: 5, rpe: 7, shoulderStrain: 6, kcalOverride: 812))
        let w = try #require(store.week)
        #expect(sportMoment(w) == .done && w.tonight?.session?.load == 819 && w.weekCount?.done == 3)
        #expect(w.todayDay?.sport.first?.state == "DONE")
        #expect(store.lastRpe == 7)
        await store.load(force: true)
        #expect(sportMoment(store.week!) == .done)            // still shown until the server has it
    }

    @Test func skipThenUndoReadsTheWeekAgain() async throws {
        let stub = StubTransport()
        stub.on("getSportOverview", .json(200, SportFixtures.week()))
        stub.on("upsertPlannedSkip", .json(200, #"{"id":"s1","reasonCategory":"TIRED","freePass":true,"serious":false}"#))
        stub.on("getSportOverview", .json(200, SportFixtures.week(moment: "SKIPPED", tonight: #","skip":{"id":"s1","reason":"TIRED","freePass":true,"serious":false}"#)))
        stub.on("undoPlannedSkip", .status(204))
        stub.on("getSportOverview", .json(200, SportFixtures.week()))
        let store = SportStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: Self.tempDir()))
        await store.load()
        try await store.skip(.TIRED)
        #expect(sportMoment(store.week!) == .skipped)
        try await store.undoSkip()
        #expect(sportMoment(store.week!) == .before)
        #expect(stub.ops == ["getSportOverview", "upsertPlannedSkip", "getSportOverview", "undoPlannedSkip", "getSportOverview"])
    }
}

/// The log goes through the outbox: queued without the net, sent once when it is back, with the watch's kcal.
@Suite("Sport — the log through the outbox")
@MainActor
struct SportOutboxTests {
    final class Sender: OutboxSender, @unchecked Sendable {
        var online = false
        var sent: [OutboxItem] = []
        let train: TrainClient
        init(train: TrainClient) { self.train = train }
        func send(_ item: OutboxItem) async -> OutboxSendResult {
            guard online else { return .offline }
            sent.append(item)
            return await train.send(item)
        }
    }

    @Test func anOfflineLogIsSentOnceOnReconnect() async throws {
        let stub = StubTransport()
        stub.on("logSportSession", .json(201, #"{"id":"0b6f3c1e-1111-4a2b-9c3d-222233334444"}"#))
        let sender = Sender(train: TrainClient(client: makeClient(tokens: MemoryTokenStore("t"), transport: stub)))
        let box = Outbox(directory: FileManager.default.temporaryDirectory.appendingPathComponent("sport-outbox-\(UUID().uuidString)"), sender: sender)
        let p = SportSessionPayload(sport: "volleyball", date: "2026-11-25", time: "18:04", durationMinutes: 117, setsPlayed: 5,
                                    rpe: 7, shoulderStrain: 6, notes: "sok ütés a hálónál", kcalOverride: 812)
        try await box.enqueue(OutboxItem(kind: .sportSession, date: p.date, capturedAt: Date(), payload: TrainPayloadCodec.encode(p)))
        await box.flush(ignoringBackoff: true)
        #expect(await box.pending.count == 1 && stub.ops.isEmpty)       // no net: kept, nothing sent
        sender.online = true
        await box.flush(ignoringBackoff: true)
        await box.flush(ignoringBackoff: true)
        #expect(await box.pending.isEmpty && stub.ops == ["logSportSession"])   // sent once
        let body = try #require(stub.sent.first?.body)
        let json = try #require(JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any])
        #expect(json["kcalOverride"] as? Int == 812 && json["setsPlayed"] as? Int == 5 && json["sport"] as? String == "volleyball")
    }
}
