import Foundation
import Testing
@testable import BoopCore

/// Invented, real-looking season payloads ("például") — never the owner's figures.
enum EvadFixtures {
    static let draftJSON = #"""
    {"title":"Őszi fogyás","trajectory":"cut","targetWeightKg":82,"kgPerWeek":0.4,"startDate":"2026-10-05","weeks":12,
     "gymDays":[0,2,4,5],"gymTime":"07:00","sport":[{"dayOfWeek":1,"time":"19:00","durationMin":90,"sport":"volleyball"},
     {"dayOfWeek":3,"time":"19:00","durationMin":90,"sport":"volleyball"}],"sleepAnchor":{"anchor":"WAKE","time":"06:30"},
     "allowedRecipeIds":[],"block":{"source":"adopt","mesocycleId":"m1"},"somethingNew":true}
    """#

    static let seasonJSON = #"""
    {"id":"s1","title":"Őszi fogyás","status":"active","startDate":"2026-10-05","endDate":"2026-12-27","weeks":12,
     "goalId":"g1","sleepNeedMin":486,"mesocycleId":"m1",
     "rules":{"processedFoodMaxNova":2,"deloadMaintain":true,"useLearnedExpenditure":true,"proposeExperiments":true,"menuDay":6,"menuTime":"18:00"},
     "draft":\#(draftJSON)}
    """#

    static func numbers(train: Int = 2440, rest: String = "2270", sleep: Int = 486) -> String {
        #"{"trainDayKcal":\#(train),"restDayKcal":\#(rest),"proteinG":170,"carbsTrainG":275,"sleepNeedMin":\#(sleep),"bedtime":"22:09","targetDate":"2027-01-01","weeksToTarget":6,"paceVerdict":"feasible","kgPerWeek":-0.4,"band":null,"gymPerWeek":4,"sportPerWeek":2}"#
    }

    static let previewJSON = #"""
    {"before":\#(numbers()),"after":\#(numbers(train: 2460, rest: "null", sleep: 492)),
     "todo":[{"key":"bedtime","title":"Korábbi lefekvés","body":"22:03 körül feküdj le."}],"warnings":[],"fingerprint":"fp-1"}
    """#

    static let foodJSON = #"{"trainDayKcal":2440,"restDayKcal":2270,"proteinG":170,"allowedCount":24,"recipeCount":53,"novaMax":2}"#

    static func overviewJSON(status: String = "on_course", trajectory: String = "cut", band: String = "null",
                             links: String? = nil, blockId: String = #""m1""#, food: String = foodJSON) -> String {
        let l = links ?? #"""
        [{"from":"edzes","to":"etel","key":"train_food","value":290},{"from":"edzes","to":"alvas","key":"train_sleep","value":12},
         {"from":"etel","to":"suly","key":"food_weight","value":-0.4},{"from":"alvas","to":"suly","key":"sleep_food","value":null},
         {"from":"etel","to":"edzes","key":"food_train","value":null},{"from":"alvas","to":"edzes","key":"sleep_train","value":null},
         {"from":"suly","to":"etel","key":"a_link_from_the_future","value":1}]
        """#
        return #"""
        {"season":\#(seasonJSON),
         "head":{"title":"Őszi fogyás","week":7,"weeks":12,"status":"\#(status)","trajectory":"\#(trajectory)"},
         "map":{"pillars":[{"key":"edzes","value":"4 edzés + 2 röpi"},{"key":"etel","value":"2440 kcal"},{"key":"alvas","value":"8 ó 6 p"},{"key":"suly","value":null}],
                "links":\#(l)},
         "weight":{"series":[{"date":"2026-10-05","kg":86.9},{"date":"2026-11-16","kg":84.1}],
                   "projection":[{"date":"2026-11-23","kg":83.7},{"date":"2026-12-27","kg":82.0}],
                   "trendKg":84.1,"targetKg":82,"band":\#(band),"kgPerWeek":-0.4,"paceVerdict":"feasible"},
         "pillars":{"block":{"title":"V-forma és kar","mesocycleId":\#(blockId),"blockWeeks":6,"fromWeek":4,"toWeek":9,"gymDays":[0,2,4,5],
                             "sport":[{"dayOfWeek":1,"time":"19:00","durationMin":90,"sport":"volleyball"},{"dayOfWeek":3,"time":"19:00","durationMin":90,"sport":"volleyball"}]},
                    "food":\#(food),
                    "sleep":{"needMin":486,"baseMin":450,"bedtime":"22:09","anchor":"WAKE","anchorTime":"06:30","avgMin":null},
                    "weight":{"targetKg":82,"targetDate":"2027-01-01","deltaKg":-2.8,"kgPerWeek":-0.4,"band":\#(band)}},
         "adherence":null,"insights":[],"upcoming":[{"week":10,"kind":"deload","text":"erre a hétre nem fogyunk"}]}
        """#
    }

    static func overview(status: String = "on_course", trajectory: String = "cut", band: String = "null",
                         links: String? = nil, blockId: String = #""m1""#, food: String = foodJSON) -> EvadOverview {
        try! JSONDecoder().decode(EvadOverview.self, from: Data(overviewJSON(status: status, trajectory: trajectory,
                                                                               band: band, links: links, blockId: blockId,
                                                                               food: food).utf8))
    }
}

@Suite("Évad — the client")
struct EvadClientTests {
    static func raw(_ stub: StubTransport) -> RawJSONClient {
        RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" })
    }

    static var draft: EvadDraft { try! JSONDecoder().decode(EvadDraft.self, from: Data(EvadFixtures.draftJSON.utf8)) }

    @Test func previewPostsDraftAndDecodes() async throws {
        let stub = StubTransport()
        stub.on("previewSeason", .json(200, EvadFixtures.previewJSON))
        let p = try await EvadClient(raw: Self.raw(stub)).preview(id: "s1", Self.draft)
        #expect(p.after.restDayKcal == nil, "a week with no rest day decodes as nil, not 0")
        #expect(p.before.restDayKcal == 2270 && p.after.trainDayKcal == 2460 && p.fingerprint == "fp-1")
        #expect(p.todo.first?.title == "Korábbi lefekvés" && p.warnings.isEmpty)
        #expect(stub.sent[0].path == "/api/seasons/s1/preview" && stub.sent[0].auth == "Bearer tok")
        let body = try #require(stub.sent[0].body)
        #expect(body.contains(#""gymDays":[0,2,4,5]"#) && body.contains(#""trajectory":"cut""#))
        #expect(!body.contains("ratePctPerWeek"), "an absent pace is omitted, not sent as null")
    }

    @Test func conflictMapsToPlanFetchErrorConflict() async throws {
        let stub = StubTransport()
        stub.on("applySeason", .json(409, #"{"messages":[{"code":"SEASON_PREVIEW_STALE","text":"stale"}]}"#))
        await #expect(throws: PlanFetchError.conflict("SEASON_PREVIEW_STALE")) {
            _ = try await EvadClient(raw: Self.raw(stub)).apply(id: "s1", Self.draft, fingerprint: "fp-old")
        }
        #expect(stub.sent[0].path == "/api/seasons/s1")
        #expect(stub.sent[0].body?.contains(#""fingerprint":"fp-old""#) == true)
        #expect(evadErrorText(.conflict("SEASON_PREVIEW_STALE")) == "Közben változott valami, újraszámoltam.")
    }

    @Test func overviewDecodesLenientlyAndNoSeasonIs404() async throws {
        let stub = StubTransport()
        stub.on("getSeasonOverview", .json(200, EvadFixtures.overviewJSON()))
        stub.on("getSeasonOverview", .json(404, #"{"messages":[{"code":"NOT_FOUND"}]}"#))
        let client = EvadClient(raw: Self.raw(stub))
        let o = try await client.overview()
        #expect(o.head.week == 7 && o.adherence == nil && o.insights.isEmpty)
        #expect(o.season.rules.menuDay == 6 && o.pillars.sleep.avgMin == nil)
        #expect(o.map.pillars.last?.value == nil)
        await #expect(throws: PlanFetchError.notFound) { _ = try await client.overview() }
        #expect(stub.sent[0].path == "/api/seasons/active/overview")
    }

    @Test func newSeasonCallsUseTheContractPaths() async throws {
        let stub = StubTransport()
        stub.on("getFirstSeasonDraft", .json(200, EvadFixtures.draftJSON))
        stub.on("previewSeasonDraft", .json(200, EvadFixtures.previewJSON.replacingOccurrences(of: "fp-1", with: "")))
        stub.on("createSeason", .json(201, EvadFixtures.seasonJSON.replacingOccurrences(of: #""status":"active""#, with: #""status":"planned""#)))
        stub.on("activateSeason", .json(200, EvadFixtures.seasonJSON))
        let client = EvadClient(raw: Self.raw(stub))
        let d = try await client.firstDraft()
        #expect(d.sport.count == 2 && d.block?.source == "adopt")
        let p = try await client.previewDraft(d)
        #expect(p.fingerprint.isEmpty)
        let planned = try await client.create(d)
        #expect(planned.status == "planned")
        let active = try await client.activate(id: planned.id)
        #expect(active.status == "active")
        #expect(stub.sent.map(\.path) == ["/api/seasons/draft", "/api/seasons/draft/preview", "/api/seasons", "/api/seasons/s1/activate"])
    }

    @Test func rulesSendNullMenuDay() async throws {
        let stub = StubTransport()
        stub.on("putSeasonRules", .json(200, EvadFixtures.seasonJSON))
        let r = EvadRules(processedFoodMaxNova: 4, deloadMaintain: false, useLearnedExpenditure: true,
                          proposeExperiments: false, menuDay: nil, menuTime: "18:00")
        _ = try await EvadClient(raw: Self.raw(stub)).putRules(id: "s1", r)
        #expect(stub.sent[0].path == "/api/seasons/s1/rules")
        #expect(stub.sent[0].body?.contains(#""menuDay":null"#) == true, "no weekly menu is said, not omitted")
    }

    @Test func seasonRefusalsSayWhatToDo() {
        #expect(evadErrorText(.conflict("SEASON_PROFILE_REQUIRED"))
                == "Az évad számaihoz előbb a testadataid kellenek (magasság, születési dátum, nem).")
        #expect(evadErrorText(.conflict("SEASON_BLOCK_DAYS_LOCKED"))
                == "Amíg fut az edzésblokk, az edzésnapok nem változhatnak.")
    }

    @Test func weekKcalAndAMissingMenuDayDecode() throws {
        let n = try JSONDecoder().decode(EvadNumbers.self, from: Data(EvadFixtures.numbers().replacingOccurrences(
            of: #""gymPerWeek""#, with: #""weekKcal":17080,"gymPerWeek""#).utf8))
        #expect(n.weekKcal == 17_080)
        #expect(try JSONDecoder().decode(EvadNumbers.self, from: Data(EvadFixtures.numbers().utf8)).weekKcal == nil)
        let r = try JSONDecoder().decode(EvadRules.self, from: Data(#"{"processedFoodMaxNova":2,"deloadMaintain":true,"useLearnedExpenditure":true,"proposeExperiments":false,"menuTime":"18:00"}"#.utf8))
        #expect(r.menuDay == nil)
    }
    @Test func adherenceUsesTheContractPathAndDecodesNulls() async throws {
        let stub = StubTransport()
        stub.on("getAdherence", .json(200, #"""
        {"days":[{"date":"2026-11-18","judged":true,"excused":false,"excuse":null,"kcal":2300,"targetKcal":2350,"proteinG":150,
                  "targetProteinG":165,"foodInBand":true,"sessionPlanned":true,"sessionDone":true,"sleepMin":470,"needMin":486,"sleepOk":true},
                 {"date":"2026-11-19","judged":false,"excused":true,"excuse":"kimelo","sessionPlanned":false},
                 {"date":"2026-11-20","judged":false,"excused":false,"sessionPlanned":false,"aFieldFromTheFuture":1}],
         "summary":{"foodInBand":1,"foodJudged":1,"sessionsDone":1,"sessionsPlanned":1,"nightsOk":1,"nightsJudged":1,"excusedDays":1}}
        """#))
        let r = try await EvadClient(raw: Self.raw(stub)).adherence(from: "2026-11-14", to: "2026-11-20")
        #expect(stub.sent[0].op == "getAdherence")
        #expect(stub.sent[0].path == "/api/seasons/adherence?from=2026-11-14&to=2026-11-20")
        #expect(r.days.count == 3 && r.summary.excusedDays == 1)
        #expect(r.days[0].judged && r.days[0].foodInBand == true && r.days[0].sleepOk == true)
        #expect(r.days[1].excused && r.days[1].excuse == "kimelo" && r.days[1].kcal == nil && r.days[1].foodInBand == nil)
        #expect(r.days[2].sessionDone == nil, "an absent nullable field decodes as nil")
    }
}
