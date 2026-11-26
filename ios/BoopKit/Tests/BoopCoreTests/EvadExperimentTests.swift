import Foundation
import Testing
@testable import BoopCore

/// Invented, real-looking experiment payloads ("például") — never the owner's figures.
enum EvadExperimentFixtures {
    static let signalsClear = #"""
    [{"key":"morning_feel","before":6.1,"after":6.8,"nBefore":14,"nAfter":13,"cliffsDelta":0.4,"clear":true,"better":true},
     {"key":"sleep_min","before":410,"after":432,"nBefore":14,"nAfter":13,"cliffsDelta":0.45,"clear":true,"better":true},
     {"key":"deep_min","before":58,"after":71,"nBefore":14,"nAfter":13,"cliffsDelta":0.38,"clear":true,"better":true},
     {"key":"hrv_ms","before":41,"after":43,"nBefore":14,"nAfter":13,"cliffsDelta":0.1,"clear":false,"better":null},
     {"key":"resting_hr","before":54,"after":53,"nBefore":14,"nAfter":13,"cliffsDelta":-0.1,"clear":false},
     {"key":"mood","before":null,"after":7.1,"nBefore":0,"nAfter":5,"cliffsDelta":null,"clear":false}]
    """#

    static func done(id: String = "d1", title: String = "Reggeli séta", verdict: String = "clear", signals: String = signalsClear,
                     marked: Int = 13, finished: String = "2026-11-19", overlaps: String = "[]", kept: Bool = false) -> String {
        #"""
        {"id":"\#(id)","subjectKind":"habit","subjectRef":null,"title":"\#(title)","reason":null,"startDate":"2026-11-05",
         "endDate":"2026-11-18","lengthDays":14,"status":"done","dayIndex":null,"markedDays":[],"needDays":10,
         "watched":["sleep_min","deep_min","hrv_ms","resting_hr","morning_feel"],"overlaps":\#(overlaps),
         "result":{"verdict":"\#(verdict)","signals":\#(signals),"baselineFrom":"2026-10-22","baselineTo":"2026-11-04","markedCount":\#(marked)},
         "finishedOn":"\#(finished)","kept":\#(kept),"aFieldFromTheFuture":1}
        """#
    }

    static let proposalJSON = #"""
    {"id":"p1","subjectKind":"supplement","subjectRef":"a1","title":"Esti magnézium","reason":"Hétfő óta szedsz esti magnéziumot.",
     "startDate":null,"endDate":null,"lengthDays":14,"status":"proposed","markedDays":[],"needDays":10,
     "watched":["morning_feel","sleep_min","resting_hr"],"overlaps":[],"kept":false}
    """#

    static let runningJSON = #"""
    {"id":"r1","subjectKind":"habit","title":"Este 9 után nincs telefon","startDate":"2026-11-12","endDate":"2026-11-25",
     "lengthDays":14,"status":"running","dayIndex":9,"markedDays":["2026-11-12","2026-11-13","2026-11-14","2026-11-15",
     "2026-11-16","2026-11-17","2026-11-18","2026-11-19"],"needDays":10,"watched":["sleep_min","resting_hr"],
     "overlaps":[{"kind":"mesocycle","date":"2026-11-16","text":"Közben új edzésblokk indult"}],"kept":false}
    """#

    static let listJSON = #"""
    {"proposal":\#(proposalJSON),"running":\#(runningJSON),
     "past":[\#(done()),\#(done(id: "d2", title: "Napi 3 liter víz", verdict: "insufficient", marked: 6, finished: "2026-10-01"))],
     "proposeOn":true}
    """#

    static func experiment(_ json: String) -> EvadExperiment {
        try! JSONDecoder().decode(EvadExperiment.self, from: Data(json.utf8))
    }
}

@Suite("Évad — experiments: copy")
struct EvadExperimentLogicTests {
    typealias F = EvadExperimentFixtures

    @Test func valuesAreFormattedInHisUnits() {
        #expect(evadSignalValue("sleep_min", 410) == "6 ó 50 p")
        #expect(evadSignalValue("deep_min", 58) == "58 p")
        #expect(evadSignalValue("deep_min", 71) == "71 p", "deep sleep stays in minutes")
        #expect(evadSignalValue("hrv_ms", 41.4) == "41 ms")
        #expect(evadSignalValue("resting_hr", 53.6) == "54")
        #expect(evadSignalValue("morning_feel", 6.1) == "6,1")
        #expect(evadSignalDelta("sleep_min", before: 410, after: 432) == "+22 p")
        #expect(evadSignalDelta("resting_hr", before: 54, after: 52) == "–2")
        #expect(evadSignalLabel("hrv_ms") == "Pulzus-variabilitás" && evadSignalLabel("morning_feel") == "Reggeli közérzet")
    }

    @Test func rowsOnlyForSignalsWithBothValuesInOrder() {
        let e = F.experiment(F.done())
        let rows = evadSignalRows(e.result!)
        #expect(rows.map(\.label) == ["Alvás", "Mély alvás", "Pulzus-variabilitás", "Nyugalmi pulzus", "Reggeli közérzet"],
                "the mood has no before, so no row")
        #expect(rows[0].before == "6 ó 50 p" && rows[0].after == "7 ó 12 p" && rows[0].favours == 1)
        #expect(rows[2].favours == 0, "an unclear change is never lit")
    }

    @Test func clearVerdictIsTheSignalsOwnSentence() {
        let e = F.experiment(F.done())
        #expect(evadVerdictSentence(e) == "*Többet alszol*, és a különbség nagyobb annál, amennyit magától is ingadozni szokott.")
        #expect(evadPastSub(e) == "14 nap · többet alszol, és ez nem véletlen")
        #expect(evadPastValue(e).value == "+22 p" && evadPastValue(e).sub == "alvás")
        #expect(evadCompareDays(e) == "14 nap · 13 nap", "always day counts")
        #expect(!evadVerdictSentence(e).contains("%"), "never a single percentage")
    }

    @Test func aWorseClearChangeIsSaidPlainly() {
        let worse = #"[{"key":"resting_hr","before":52,"after":56,"nBefore":14,"nAfter":12,"clear":true,"better":false}]"#
        let e = F.experiment(F.done(signals: worse))
        #expect(evadVerdictSentence(e).hasPrefix("*Feljebb ment a nyugalmi pulzusod*"))
        #expect(evadSignalRows(e.result!).first?.favours == -1, "the before column is the better one")
        #expect(evadMeaning(e).first?.body.contains("Rosszabb irányba") == true)
    }

    @Test func noneAndInsufficientVerdicts() {
        let calm = #"[{"key":"sleep_min","before":425,"after":431,"nBefore":14,"nAfter":12,"clear":false}]"#
        let none = F.experiment(F.done(verdict: "none", signals: calm))
        #expect(evadShortVerdict(none) == "nem hozott érezhető változást")
        #expect(evadVerdictSentence(none).contains("Nem hozott érezhető változást"))
        #expect(evadPastValue(none).value == "–")
        let few = F.experiment(F.done(verdict: "insufficient", signals: calm, marked: 6))
        #expect(evadShortVerdict(few) == "túl kevés nap, nem lehet megítélni")
        #expect(evadVerdictSentence(few).contains("6 napot pipáltál ki") && evadVerdictSentence(few).contains("legalább 10"))
    }

    @Test func meaningHasThreeHonestItems() {
        let m = evadMeaning(F.experiment(F.done()))
        #expect(m.map(\.title) == ["Ami tényleg változott", "Ami nem változott érdemben", "Mire figyelj"])
        #expect(m[0].body.hasPrefix("Az alvásod hossza, a mélyalvás és a reggeli közérzeted."))
        #expect(m[1].body == "A pulzus-variabilitás és a nyugalmi pulzus. Ennyi nap alapján ez lehet véletlen is.")
        #expect(m[2].body == "Ez a te napjaidból látszik, de nem bizonyíték. A két hét alatt más nem változott: nem volt új mezociklus, kímélő időszak vagy évadmódosítás.")
        // with an overlap, the overlap is named instead
        let o = evadMeaning(F.experiment(F.done(overlaps: #"[{"kind":"deload","date":"2026-11-10","text":"Közben könnyebb hét volt"}]"#)))
        #expect(o.last?.body == "Ez a te napjaidból látszik, de nem bizonyíték. Közben könnyebb hét volt. Emiatt az eredmény kevésbé biztos.")
        // nothing clear → the first item is left out
        let calm = #"[{"key":"sleep_min","before":425,"after":431,"nBefore":14,"nAfter":12,"clear":false}]"#
        #expect(evadMeaning(F.experiment(F.done(verdict: "none", signals: calm))).map(\.title)
                == ["Ami nem változott érdemben", "Mire figyelj"])
    }

    @Test func runningLineAndProposalCopy() {
        let r = F.experiment(F.runningJSON)
        #expect(evadRunningLine(r) == "Ezt figyelem: mennyit alszol és hogyan alakul a nyugalmi pulzusod. Eddig 8 napot pipáltál ki, az eredményhez legalább 10 kell.")
        #expect(evadDayCount(r) == "9 / 14 nap")
        #expect(abs(evadRunningLevel(r) - 9.0 / 14) < 0.0001)
        #expect(evadMarkedToday(r, today: "2026-11-19") && !evadMarkedToday(r, today: "2026-11-20"))
        let p = F.experiment(F.proposalJSON)
        #expect(evadCompareSentence(p) == "Az alvásodat, a nyugalmi pulzusodat és a reggeli közérzetedet vetem össze az előző két héttel.")
        #expect(evadProposalText(p).hasPrefix("Hétfő óta szedsz esti magnéziumot. Megnézzük két hét alatt"))
    }

    @Test func insufficientOrUnclearResultsNeverHighlight() {
        // the clear signals of a result whose verdict is not "clear" are not lit
        let few = evadSignalRows(F.experiment(F.done(verdict: "insufficient", marked: 6)).result!)
        #expect(!few.isEmpty && few.allSatisfy { $0.favours == 0 })
        let none = evadSignalRows(F.experiment(F.done(verdict: "none")).result!)
        #expect(none.allSatisfy { $0.favours == 0 })
        #expect(evadSignalRows(F.experiment(F.done()).result!).contains { $0.favours == 1 }, "a clear verdict still lights")
    }

    @Test func markDatesAreTheWindowsDaysSoFar() {
        func running(_ start: String, _ end: String) -> EvadExperiment {
            EvadExperiment(id: "r", title: "x", startDate: start, endDate: end, status: "running")
        }
        #expect(evadMarkDates(running("2026-11-17", "2026-11-30"), today: "2026-11-20")
                == ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"], "started 3 days ago: 4 chips ending today")
        #expect(evadMarkDates(running("2026-11-05", "2026-11-18"), today: "2026-11-20")
                == ["2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"],
                "the window ended: the last 7 days, ending at the end date")
        #expect(evadMarkDates(running("2026-11-12", "2026-11-25"), today: "2026-11-20").first == "2026-11-14")
        #expect(evadMarkDates(running("2026-11-20", "2026-12-03"), today: "2026-11-20") == ["2026-11-20"])
        #expect(evadMarkDates(running("2026-11-22", "2026-12-05"), today: "2026-11-20").isEmpty, "not started yet")
        #expect(evadMarkDates(EvadExperiment(id: "p", title: "x", status: "proposed"), today: "2026-11-20").isEmpty)
        #expect(evadWeekdayLetter("2026-11-20") == "P" && evadWeekdayLetter("2026-11-16") == "H"
                && evadWeekdayLetter("2026-11-18") == "Sze")
        #expect(evadMarkDayLabel("2026-11-20", marked: true, today: "2026-11-20") == "Ma, péntek, nov. 20., kipipálva")
        #expect(evadMarkDayLabel("2026-11-18", marked: false, today: "2026-11-20") == "Szerda, nov. 18., nincs kipipálva")
    }
}

@Suite("Évad — experiments: client and store")
struct EvadExperimentClientTests {
    typealias F = EvadExperimentFixtures

    @Test func callsUseTheContractPathsAndOperations() async throws {
        let stub = StubTransport()
        stub.on("listExperiments", .json(200, F.listJSON))
        stub.on("createExperiment", .json(200, F.runningJSON))
        stub.on("startExperiment", .json(200, F.runningJSON))
        stub.on("markExperimentDay", .json(200, F.runningJSON))
        stub.on("dismissExperiment", .json(200, F.proposalJSON.replacingOccurrences(of: #""proposed""#, with: #""dismissed""#)))
        stub.on("keepExperiment", .json(200, F.done(kept: true)))
        let c = EvadClient(raw: EvadClientTests.raw(stub))
        let list = try await c.experiments()
        #expect(list.proposal?.reason == "Hétfő óta szedsz esti magnéziumot." && list.running?.dayIndex == 9)
        #expect(list.past.count == 2 && list.past[0].result?.signals.count == 6 && list.proposeOn)
        _ = try await c.createExperiment(EvadExperimentCreate(title: "Esti séta", lengthDays: 21))
        _ = try await c.startExperiment(id: "p1")
        _ = try await c.markExperimentDay(id: "r1", date: "2026-11-20", done: true)
        _ = try await c.dismissExperiment(id: "p1")
        let kept = try await c.keepExperiment(id: "d1")
        #expect(kept.kept)
        #expect(stub.ops == ["listExperiments", "createExperiment", "startExperiment", "markExperimentDay",
                             "dismissExperiment", "keepExperiment"])
        #expect(stub.sent.map(\.path) == ["/api/seasons/experiments", "/api/seasons/experiments",
                                          "/api/seasons/experiments/p1/start", "/api/seasons/experiments/r1/days",
                                          "/api/seasons/experiments/p1/dismiss", "/api/seasons/experiments/d1/keep"])
        let create = try #require(stub.sent[1].body)
        #expect(create.contains(#""title":"Esti séta""#) && create.contains(#""lengthDays":21"#) && create.contains(#""subjectKind":"habit""#))
        #expect(!create.contains("subjectRef"), "an absent subject is omitted")
        #expect(stub.sent[3].body?.contains(#""date":"2026-11-20""#) == true && stub.sent[3].body?.contains(#""done":true"#) == true)
    }

    @Test func alreadyRunningSaysOneAtATime() async {
        let stub = StubTransport()
        stub.on("createExperiment", .json(409, #"{"messages":[{"code":"EXPERIMENT_ALREADY_RUNNING"}]}"#))
        await #expect(throws: PlanFetchError.conflict("EXPERIMENT_ALREADY_RUNNING")) {
            _ = try await EvadClient(raw: EvadClientTests.raw(stub)).createExperiment(EvadExperimentCreate(title: "x"))
        }
        #expect(evadErrorText(.conflict("EXPERIMENT_ALREADY_RUNNING")).contains("Egyszerre csak egy"))
    }

    @MainActor @Test func storeTicksTodayAndRereads() async throws {
        let stub = StubTransport()
        stub.on("listExperiments", .json(200, F.listJSON))
        stub.on("markExperimentDay", .json(200, F.runningJSON))
        stub.on("listExperiments", .json(200, F.listJSON))
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        let now = cal.date(from: DateComponents(year: 2026, month: 11, day: 20, hour: 21))!
        let store = EvadExperimentStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil,
                                        clock: { now }, calendar: cal)
        await store.load()
        #expect(store.data?.running?.id == "r1" && store.today == "2026-11-20")
        await store.toggleToday()
        #expect(stub.sent[1].path == "/api/seasons/experiments/r1/days")
        #expect(stub.sent[1].body?.contains(#""date":"2026-11-20""#) == true && stub.sent[1].body?.contains(#""done":true"#) == true,
                "today was not ticked, so the tap ticks it")
        #expect(stub.ops.last == "listExperiments", "the list is re-read after a change")
        #expect(store.actionProblem == nil)
    }

    @MainActor @Test func startReportsWhetherItStarted() async {
        let stub = StubTransport()
        stub.on("listExperiments", .json(200, F.listJSON))
        stub.on("startExperiment", .json(409, #"{"messages":[{"code":"EXPERIMENT_ALREADY_RUNNING"}]}"#))
        stub.on("listExperiments", .json(200, F.listJSON))
        stub.on("startExperiment", .fail(URLError(.notConnectedToInternet)))
        stub.on("listExperiments", .json(200, F.listJSON))
        stub.on("startExperiment", .json(200, F.runningJSON))
        stub.on("listExperiments", .json(200, F.listJSON))
        let store = EvadExperimentStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await store.load()
        #expect(await store.start("p1") == false, "a refusal is not a start")
        #expect(store.actionProblem?.contains("Egyszerre csak egy") == true)
        #expect(await store.start("p1") == false, "no net is not a start")
        #expect(store.actionProblem?.contains("internet") == true)
        #expect(await store.start("p1") == true)
        #expect(store.actionProblem == nil)
    }

    @MainActor @Test func aFailedChangeRereadsTheList() async {
        let stub = StubTransport()
        stub.on("listExperiments", .json(200, F.listJSON))
        stub.on("markExperimentDay", .json(409, #"{"messages":[{"code":"EXPERIMENT_NOT_RUNNING"}]}"#))
        // the server finished it meanwhile: the re-read list has no running experiment
        stub.on("listExperiments", .json(200, #"{"proposal":null,"running":null,"past":[\#(F.done())],"proposeOn":true}"#))
        let store = EvadExperimentStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await store.load()
        await store.toggleDay("2026-11-19")
        #expect(stub.ops == ["listExperiments", "markExperimentDay", "listExperiments"])
        #expect(store.data?.running == nil, "the stale running card is replaced")
        #expect(store.actionProblem != nil, "the refusal is still said")
    }

    @MainActor @Test func aNewDayRereads() async {
        let stub = StubTransport()
        stub.on("listExperiments", .json(200, F.listJSON))
        stub.on("listExperiments", .json(200, F.listJSON))
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Budapest")!
        final class Box { var now: Date; init(_ d: Date) { now = d } }
        let box = Box(cal.date(from: DateComponents(year: 2026, month: 11, day: 20, hour: 22))!)
        let store = EvadExperimentStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil,
                                        clock: { box.now }, calendar: cal)
        await store.load()
        await store.load()
        #expect(stub.ops.count == 1, "the same day reads once")
        box.now = cal.date(from: DateComponents(year: 2026, month: 11, day: 21, hour: 7))!
        await store.load()
        #expect(stub.ops.count == 2, "a new day reads again")
    }

    @MainActor @Test func offlineWithoutCacheIsAProblemNotAnAnswer() async {
        let stub = StubTransport()
        stub.on("listExperiments", .fail(URLError(.notConnectedToInternet)))
        let store = EvadExperimentStore(client: EvadClient(raw: EvadClientTests.raw(stub)), cache: nil)
        await store.load()
        #expect(store.data == nil && store.problem == .offline)
    }
}
