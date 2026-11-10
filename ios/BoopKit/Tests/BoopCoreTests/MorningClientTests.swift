import Foundation
import Testing
@testable import BoopCore

func briefJSON(session: String = #"{"title":"Vállak és hát","time":"17:30","plannedTime":"17:30","minutes":55,"exercises":[{"name":"Húzódzkodás","sets":4}]}"#,
               date: String = "2026-11-10") -> String {
    let slots = Array(repeating: "false", count: 72).joined(separator: ",")
    let hourly = Array(repeating: "0.6", count: 19).joined(separator: ",")
    return #"""
    {"date":"\#(date)","generatedAt":"2026-11-10T05:30:00Z","state":"okay","nightsKnown":9,
     "metrics":[
       {"key":"forma","score":72,"display":"72","caption":"jó","headline":"Formában vagy","sentence":"Jól pihentél."},
       {"key":"alvas","score":null,"display":"–","headline":"Nincs adat","sentence":"Az éjszaka nem látszik."},
       {"key":"mozgas","score":55,"display":"55","headline":"Mozgás","sentence":"Közepes.","trendUp":true},
       {"key":"fuel","score":80,"display":"80","headline":"Fuel","sentence":"Rendben."},
       {"key":"pulzus","score":64,"display":"58","headline":"Pulzus","sentence":"Nyugodt."}],
     "brief":[{"text":"Jó reggelt!","link":"sleep"},{"text":"Ma edzés van."}],
     "energy":{"hourly":[\#(hourly)],"dipHour":15},
     "tonightTip":"Feküdj le 22:30-kor.","nextMealTip":null,
     "day":{"deepSleepWeek":[60,null,70,65,80,75,72],"restingHrWeek":[58,59,null,57,58,56,57],
       "steps":3200,"stepsGoal":10000,"activeKcal":180,
       "session":\#(session),
       "meals":[{"time":"08:00","title":"Zabkása","kcal":420,"proteinG":24,"logged":true}],
       "kcalSoFar":420,"kcalTarget":2400,"proteinG":24,"proteinTarget":150,"carbsG":55,"fatG":12,
       "checkins":[{"slot":"morning","time":"08:00","done":false}],
       "intention":{"creed":null,"foci":["Nyugalom"]},
       "observations":[{"id":"6f1d7a52-2b7e-4c0e-8a52-7d9d4c1a0001","lead":"Ha későn eszel,","bold":"rosszabbul alszol","tail":"másnap.","strength":3}],
       "calendar":{"count":2,"busySlots":[\#(slots)]}}}
    """#
}

@MainActor
struct MorningClientTests {
    let stub = StubTransport()
    let tokens = MemoryTokenStore()
    let session: Session
    var signedOut = Box()
    final class Box { var count = 0 }

    init() { session = Session(tokens: tokens, transport: stub) }

    func store() -> MorningStore {
        let box = signedOut
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        return MorningStore(client: session.client, calendar: cal, onUnauthorized: { box.count += 1; self.session.signOut() })
    }
    func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        return cal.date(from: DateComponents(year: y, month: m, day: d, hour: 7))!
    }

    @Test func loadSendsLocalDate() async throws {
        try tokens.write("t0"); stub.on("getBoopBrief", .json(200, briefJSON()))
        let s = store()
        await s.load(date: day(2026, 11, 10))
        #expect(stub.sent.first?.path.contains("date=2026-11-10") == true)
        #expect(stub.sent.first?.auth == "Bearer t0")
        #expect(s.brief?.date == "2026-11-10")
        #expect(s.problem == nil)
    }

    @Test func loadMapsMetrics() async throws {
        stub.on("getBoopBrief", .json(200, briefJSON()))
        let s = store()
        await s.load(date: day(2026, 11, 10))
        let b = try #require(s.brief)
        #expect(b.metrics.count == 5)
        #expect(b.metric(.forma).score == 72)
        #expect(b.metric(.alvas).score == nil)
        #expect(b.metric(.mozgas).trendUp == true)
        #expect(b.day.calendar.busySlots.count == 72)
        #expect(b.day.deepSleepWeek[1] == nil)
        #expect(b.day.session?.minutes == 55)
        #expect(b.energy.dipHour == 15)
        #expect(b.brief.first?.link == .sleep)
        #expect(b.day.observations.first?.strength == 3)
    }

    @Test func regenerateLimitShowsProblem() async {
        stub.on("getBoopBrief", .json(200, briefJSON()))
        stub.on("regenerateBoopBrief", .json(409, #"[{"code":"BOOP_REGENERATE_LIMIT_REACHED","type":"REQUEST"}]"#))
        let s = store()
        await s.load(date: day(2026, 11, 10))
        await s.regenerate()
        #expect(s.problem == .limit)
        #expect(s.brief != nil)
    }

    @Test func moveSessionUpdatesBrief() async {
        stub.on("getBoopBrief", .json(200, briefJSON()))
        stub.on("setSessionTime", .json(200, #"{"date":"2026-11-10","time":"19:00","plannedTime":"17:30"}"#))
        stub.on("clearSessionTime", .status(204))
        let s = store()
        await s.load(date: day(2026, 11, 10))
        await s.moveSession(to: "19:00")
        #expect(s.brief?.day.session?.time == "19:00")
        #expect(stub.sent.last?.body?.contains("19:00") == true)
        await s.undoMove()
        #expect(s.brief?.day.session?.time == "17:30")
        #expect(stub.ops.last == "clearSessionTime")
        #expect(stub.sent.last?.path.contains("date=2026-11-10") == true)
    }

    @Test func moveSessionWithNothingPlanned() async {
        stub.on("getBoopBrief", .json(200, briefJSON(session: "null")))
        stub.on("setSessionTime", .json(404, #"[{"code":"BOOP_NO_PLANNED_SESSION","type":"REQUEST"}]"#))
        let s = store()
        await s.load(date: day(2026, 11, 10))
        await s.moveSession(to: "19:00")
        #expect(s.problem == .noSession)
    }

    @Test func decideMapsAndRemovesObservation() async {
        stub.on("getBoopBrief", .json(200, briefJSON()))
        stub.on("decidePattern", .json(200, #"{"id":"6f1d7a52-2b7e-4c0e-8a52-7d9d4c1a0001","kind":"statistical","pairKey":"k","category":"trigger","categoryLabel":"Kiváltó","title":"t","evidence":[],"status":"rejected","lastDetectedAt":"2026-11-10T05:00:00Z","evidenceHits":1,"evidenceMisses":0}"#))
        let s = store()
        await s.load(date: day(2026, 11, 10))
        await s.decide(observation: "6f1d7a52-2b7e-4c0e-8a52-7d9d4c1a0001", true: false)
        #expect(stub.sent.last?.body?.contains("reject") == true)
        #expect(s.brief?.day.observations.isEmpty == true)
    }

    @Test func unauthorizedSignsOut() async throws {
        try tokens.write("old")
        stub.on("getBoopBrief", .json(401, #"[{"code":"AUTH_UNAUTHORIZED","type":"REQUEST"}]"#))
        let s = store()
        await s.load(date: day(2026, 11, 10))
        #expect(signedOut.count == 1)
        #expect(session.state == .signedOut)
        #expect(tokens.read() == nil)
    }

    @Test func futureDateFallsBackToYesterday() async {
        stub.on("getBoopBrief", .json(400, #"[{"code":"VALIDATION_FUTURE_DATE","type":"FIELD","fieldName":"date"}]"#))
        stub.on("getBoopBrief", .json(200, briefJSON(date: "2026-11-09")))
        let s = store()
        await s.load(date: day(2026, 11, 10))
        #expect(stub.sent.count == 2)
        #expect(stub.sent[0].path.contains("date=2026-11-10"))
        #expect(stub.sent[1].path.contains("date=2026-11-09"))
        #expect(s.brief?.date == "2026-11-09")
    }

    @Test func offlineShowsProblem() async {
        stub.on("getBoopBrief", .fail(URLError(.notConnectedToInternet)))
        let s = store()
        await s.load(date: day(2026, 11, 10))
        #expect(s.problem == .offline)
    }
}
