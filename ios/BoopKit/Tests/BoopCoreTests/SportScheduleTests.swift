import Foundation
import Testing
@testable import BoopCore

/// The Sport area's Hét tab (`mezo-r36n9.204`): the weekly rhythm's full replace, „Ez változik", the week's pictures,
/// the events and the store.
enum SportScheduleFixtures {
    static let slotsJSON = #"""
    [{"id":"a","dayOfWeek":0,"time":"18:00","durationMin":120,"kind":"training","location":"Sportcsarnok","intensityLabel":"kemény","sport":"volleyball"},
     {"id":"b","dayOfWeek":1,"time":"18:00","durationMin":120,"kind":"training","sport":"volleyball"},
     {"id":"c","dayOfWeek":4,"time":"19:30","durationMin":90,"kind":"match","location":"Budaörs","sport":"volleyball","future":"x"}]
    """#
    static func slots() throws -> [SportSlot] { try JSONDecoder().decode([SportSlot].self, from: Data(slotsJSON.utf8)) }
    static func body(_ s: String?) throws -> [SportSlotInput] {
        try JSONDecoder().decode([SportSlotInput].self, from: Data((s ?? "[]").utf8))
    }
}

@Suite("Sport Hét — the weekly rhythm")
struct SportScheduleLogicTests {
    @Test func editingOneSlotKeepsEveryOtherSlotUnchanged() throws {
        let slots = try SportScheduleFixtures.slots()
        var edited = slots[1]
        edited.time = "19:00"; edited.sport = "running"
        let payload = sportScheduleSaving(slots, edited)
        #expect(payload.count == 3)
        #expect(payload[0] == slots[0].input)                     // place and intensity go back as they were
        #expect(payload[0].location == "Sportcsarnok" && payload[0].intensityLabel == "kemény")
        #expect(payload[2] == slots[2].input)
        #expect(payload[1].time == "19:00" && payload[1].sport == "running" && payload[1].dayOfWeek == 1)
    }

    @Test func aNewSlotIsAddedInDayOrder() throws {
        let slots = try SportScheduleFixtures.slots()
        let payload = sportScheduleSaving(slots, SportSlot(dayOfWeek: 2, time: "17:00", durationMin: 60, sport: "running"))
        #expect(payload.map(\.dayOfWeek) == [0, 1, 2, 4])
        #expect(payload.filter { $0.sport == "volleyball" } == slots.map(\.input))
    }

    @Test func removingLeavesTheRestUnchanged() throws {
        let slots = try SportScheduleFixtures.slots()
        #expect(sportScheduleRemoving(slots, id: "b") == [slots[0].input, slots[2].input])
    }

    @Test func anEmptyPlaceIsLeftOut() {
        let s = SportSlot(dayOfWeek: 0, time: "18:00", durationMin: 60, location: "  ")
        #expect(s.input.location == nil)
    }

    @Test func rowsReadLikeTheSpike() throws {
        let s = try SportScheduleFixtures.slots()
        #expect(sportSlotTitle(s[0]) == "Hétfő 18:00 · Röplabda")
        #expect(sportSlotLine(s[0]) == "2 óra · edzés · Sportcsarnok")
        #expect(sportSlotLine(s[2]) == "1 ó 30 p · meccs · Budaörs")
        #expect(sportShiftTime("21:50", by: 15) == "22:00" && sportShiftTime("05:10", by: -15) == "05:00")
    }

    @Test func theEffectNamesTheGapToThatMorningsGym() throws {
        let week = try SportFixtures.decode(SportFixtures.week())      // Wednesday gym 07:00 for 70 minutes
        let wed = SportSlot(dayOfWeek: 2, time: "18:00", durationMin: 120, sport: "volleyball")
        let e = sportSlotEffect(wed, others: [], week: week)
        #expect(e.text == "Mostantól minden szerda 18:00-kor röplabda, 2 óra. Aznap reggel kondi is van: 9 ó 50 p lesz köztük.")
        #expect(e.gapMinutes == 590 && e.clash == nil)
    }

    @Test func aTightGapAndAnOverlapAreSaid() throws {
        let week = try SportFixtures.decode(SportFixtures.week())
        let tight = sportSlotEffect(SportSlot(dayOfWeek: 2, time: "09:00", durationMin: 60), others: [], week: week)
        #expect(tight.gapMinutes == 50 && tight.text.hasSuffix("50 perc lesz köztük. Ez szoros: három óránál kevesebb pihenő."))
        let overlap = sportSlotEffect(SportSlot(dayOfWeek: 2, time: "07:30", durationMin: 60), others: [], week: week)
        #expect(overlap.gapMinutes == 0 && overlap.text.hasSuffix("a kettő egymásra esik."))
    }

    @Test func aGymWithoutATimeOrNoGymIsSaidWithoutHours() throws {
        let week = try SportFixtures.decode(SportFixtures.week())
        let thu = sportSlotEffect(SportSlot(dayOfWeek: 3, time: "18:00", durationMin: 90), others: [], week: week)
        #expect(thu.text.hasSuffix("Aznap kondi is van.") && thu.gapMinutes == nil)
        let sat = sportSlotEffect(SportSlot(dayOfWeek: 5, time: "10:00", durationMin: 90), others: [], week: week)
        #expect(sat.text.hasSuffix("Ezen a napon nincs kondi, így ez a hét szabad napja marad mozgással."))
    }

    @Test func aSameDayClashIsNamedButNotTheSlotItself() throws {
        let slots = try SportScheduleFixtures.slots()
        let other = sportSlotEffect(SportSlot(dayOfWeek: 0, time: "08:00", durationMin: 60), others: slots, week: nil)
        #expect(other.clash == "Hétfőn már van egy alkalmad — mindkettő megmarad.")
        #expect(sportSlotEffect(slots[0], others: slots, week: nil).clash == nil)
    }

    @Test func theHeadCountsTheTwoLayers() throws {
        let h = sportWeekHead(try SportFixtures.decode(SportFixtures.week()))
        #expect(h.headline == "Négy röpi, négy kondi")
        #expect(h.sentence == "A hét két sávban: reggel kondi, este röpi.")
        let skipped = sportWeekHead(try SportFixtures.decode(SportFixtures.week(moment: "SKIPPED")))
        #expect(skipped.headline.hasPrefix("Három röpi"))
    }

    @Test func lanesFillDoneAndOutlinePlanned() throws {
        let lanes = sportLanes(try SportFixtures.decode(SportFixtures.week()))
        #expect(lanes.map(\.name) == ["Hé", "Ke", "Sze", "Csü", "Pé", "Szo", "Va"])
        #expect(lanes[0].sportDone && lanes[0].sportShare == 1)
        #expect(lanes[2].today && !lanes[2].sportDone && lanes[2].gymDone)
        #expect(lanes[3].gymShare == 0.5)                         // a gym with no length: half height
        #expect(lanes[5].gymShare == 0 && lanes[5].sportShare == 0)
        #expect(lanes[2].label == "Ma, Szerda: kondi megvolt, röpi tervben")
    }

    @Test func loadBarsShareOneScale() {
        let load = SportLoad(weeks: [SportLoadWeek(weekStart: "2026-10-26", sportLoad: 2100, gymLoad: 1900),
                                     SportLoadWeek(weekStart: "2026-11-02", sportLoad: 0, gymLoad: 2000, sportUnknown: 2),
                                     SportLoadWeek(weekStart: "2026-11-23", sportLoad: 1640, gymLoad: 1400)])
        let bars = sportLoadBars(load)
        #expect(bars.map(\.label) == ["okt 26", "nov 2", "ez"])
        #expect(bars[0].sportShare + bars[0].gymShare == 1)
        #expect(bars[2].current && abs(bars[2].sportShare - 0.41) < 0.001)
        #expect(sportLoadSummary(load) == "Heti terhelés három hétre. Ezen a héten eddig 3040: sport 1640, kondi 1400. A legnagyobb hét: okt 26, 4000.")
        #expect(sportLoadUnknownNote(load) == "2 alkalomnál nincs megadva a megterhelés, ezek kimaradnak a sávokból.")
    }

    @Test func eventsReadLikeTheSpike() {
        let e = SportEvent(id: "e", date: "2026-12-12", time: "09:00", durationMin: 360, kind: "match", location: "Budaörs")
        #expect(sportEventTile(e.date).month == "DEC" && sportEventTile(e.date).day == "12")
        #expect(sportEventTitle(e) == "Röplabda · meccs")
        #expect(sportEventLine(e) == "szombat 09:00 · 6 óra · Budaörs")
        #expect(sportEventDateLabel("2026-12-12") == "dec 12., szombat")
        #expect(sportAddDays("2026-11-28", 7) == "2026-12-05")
    }
}

@Suite("Sport Hét — client and store")
@MainActor
struct SportScheduleStoreTests {
    static func tempDir() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("sport-het-\(UUID().uuidString)") }

    static func scripted(_ stub: StubTransport) {
        stub.on("getSportSchedule", .json(200, SportScheduleFixtures.slotsJSON))
        stub.on("listSportEvents", .json(200, #"[{"id":"e1","date":"2026-12-12","time":"09:00","durationMin":360,"kind":"match","sport":"volleyball"}]"#))
        stub.on("getSportLoad", .json(200, #"{"weeks":[{"weekStart":"2026-11-23","sportLoad":1640,"gymLoad":1400,"sportSessions":2,"gymSessions":3,"sportUnknown":0,"gymUnknown":0}]}"#))
    }

    @Test func theStoreReadsTheThreeAndSavesTheWholeList() async throws {
        let stub = StubTransport()
        Self.scripted(stub)
        let store = SportScheduleStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: Self.tempDir()))
        store.today = { "2026-11-28" }
        await store.load()
        #expect(store.slots?.count == 3 && store.events?.count == 1 && store.weeksLoad?.weeks.count == 1)
        #expect(stub.sent.first { $0.op == "listSportEvents" }?.path == "/api/train/sport-events?from=2026-11-28")
        #expect(stub.sent.first { $0.op == "getSportLoad" }?.path == "/api/train/sport/load?weeks=6")

        var changed = 0
        store.changed = { changed += 1 }
        var edited = try #require(store.slots?[2])
        edited.durationMin = 120
        let echo = #"[{"id":"a2","dayOfWeek":0,"time":"18:00","durationMin":120,"kind":"training","sport":"volleyball"}]"#
        stub.on("replaceSportSchedule", .json(200, echo))
        try await store.save(edited)
        let sent = try SportScheduleFixtures.body(stub.sent.last?.body)
        let original = try SportScheduleFixtures.slots()
        #expect(sent == [original[0].input, original[1].input, { var c = original[2]; c.durationMin = 120; return c.input }()])
        #expect(store.slots?.first?.id == "a2" && changed == 1)
    }

    @Test func aFailedSaveThrowsAndKeepsTheList() async throws {
        let stub = StubTransport()
        Self.scripted(stub)
        let store = SportScheduleStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: Self.tempDir()))
        await store.load()
        stub.on("replaceSportSchedule", .fail(URLError(.notConnectedToInternet)))
        await #expect(throws: PlanFetchError.offline) { try await store.save(sportNewSlot()) }
        #expect(store.slots == sportScheduleSorted(try SportScheduleFixtures.slots()))
    }

    @Test func aDeletedSlotCanBeBroughtBack() async throws {
        let stub = StubTransport()
        Self.scripted(stub)
        let store = SportScheduleStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: Self.tempDir()))
        await store.load()
        let gone = try #require(store.slots?[1])
        stub.on("replaceSportSchedule", .json(200, "[]"))
        try await store.delete(gone)
        #expect(try SportScheduleFixtures.body(stub.sent.last?.body).count == 2 && store.removed?.id == "b")
        stub.on("replaceSportSchedule", .json(200, "[]"))
        try await store.restore()
        #expect(try SportScheduleFixtures.body(stub.sent.last?.body).contains(gone.input))
    }

    @Test func eventsAreAddedAndDeleted() async throws {
        let stub = StubTransport()
        Self.scripted(stub)
        let store = SportScheduleStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: Self.tempDir()))
        await store.load()
        stub.on("createSportEvent", .json(201, #"{"id":"e0","date":"2026-12-05","time":"10:00","durationMin":120,"kind":"training","sport":"running"}"#))
        try await store.addEvent(SportEventDraft(date: "2026-12-05", time: "10:00", kind: "training", sport: "running", location: " "))
        #expect(store.events?.map(\.id) == ["e0", "e1"])
        #expect(stub.sent.last?.body?.contains("location") == false)
        stub.on("deleteSportEvent", .json(404, #"[{"code":"NOT_FOUND"}]"#))
        try await store.deleteEvent(try #require(store.events?.first))
        #expect(store.events?.map(\.id) == ["e1"])
    }

    @Test func theCacheShowsBeforeTheReadAndStaysOffline() async throws {
        let dir = Self.tempDir()
        let cache = ServerCache(directory: dir)
        try await cache.put(try SportScheduleFixtures.slots(), endpoint: "sport/schedule", date: "-")
        let stub = StubTransport()
        stub.on("getSportSchedule", .fail(URLError(.notConnectedToInternet)))
        stub.on("listSportEvents", .fail(URLError(.notConnectedToInternet)))
        stub.on("getSportLoad", .fail(URLError(.notConnectedToInternet)))
        let store = SportScheduleStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: cache)
        await store.load()
        #expect(store.slots?.count == 3 && store.offline && store.problem == nil)
    }

    @Test func aWriteReReadsTheWeekThroughTheSportStore() async throws {
        let stub = StubTransport()
        Self.scripted(stub)
        stub.on("getSportOverview", .json(200, SportFixtures.week()))
        let sport = SportStore(client: SportClient(raw: SportFixtures.raw(stub)), cache: ServerCache(directory: Self.tempDir()))
        await sport.schedule.load()
        stub.on("replaceSportSchedule", .json(200, SportScheduleFixtures.slotsJSON))
        try await sport.schedule.save(sportNewSlot())
        #expect(stub.ops.contains("getSportOverview") && sport.week != nil)
    }
}
