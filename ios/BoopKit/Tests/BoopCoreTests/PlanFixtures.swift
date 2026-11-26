import Foundation
@testable import BoopCore

// Fixtures for the block builder / weekly review tests (mezo-r36n9.83). Invented content, real shapes.

enum PlanFixtures {
    static let blockId = "b10c0000-0000-4000-8000-000000000001"
    static let dayMon = "d0000000-0000-4000-8000-000000000001"
    static let dayThu = "d0000000-0000-4000-8000-000000000004"
    static let rowA = "e0000000-0000-4000-8000-00000000000a"
    static let rowB = "e0000000-0000-4000-8000-00000000000b"
    static let rowC = "e0000000-0000-4000-8000-00000000000c"
    static let rowD = "e0000000-0000-4000-8000-00000000000d"
    static let rowE = "e0000000-0000-4000-8000-00000000000e"
    static let catRow = "c0000000-0000-4000-8000-000000000001"
    static let catCurl = "c0000000-0000-4000-8000-000000000002"
    static let catPress = "c0000000-0000-4000-8000-000000000003"

    /// Two days: Monday row (stable, not lengthened), preacher curl (stable, lengthened), a plank (core);
    /// Thursday a free press (not stable) and a cable row with a technique already on it.
    static func blocksJSON(style: String? = nil, techniques: Bool = false, mode: String = "auto", status: String = "active") -> String {
        let s = style.map { "\"\($0)\"" } ?? "null"
        return #"""
        [{"id":"\#(blockId)","title":"V-forma és kar","shortTitle":"V-forma","status":"\#(status)","weeks":6,"currentWeek":2,
          "phaseCurve":["MEV","MAV","MAV","MAV","MRV","Deload"],
          "musclePriorities":{"back":"emphasize","chest":"maintain"},"sportGroups":[],
          "trainingStyle":\#(s),"techniquesEnabled":\#(techniques),"weeklyReviewMode":"\#(mode)",
          "split":"x","style":"x","startDate":"2026-11-16","endDate":"2026-12-27","hasReport":false,
          "days":[
            {"id":"\#(dayMon)","day":"Hét","type":"Hát és bicepsz","muscle":"back","muscleAccent":false,"exerciseCount":3,
             "exercises":[
               {"id":"\#(rowA)","name":"Chest Supported Row","muscle":"back-mid","warmupSets":1,"workingSets":4,"repMin":6,"repMax":10,
                "targetRIR":2,"type":"compound","catalogId":"\#(catRow)","countsTowardVolume":true,"restSec":120,"overrides":["restSec"],
                "technique":null,"techniqueSource":null,"challenge":false},
               {"id":"\#(rowB)","name":"Preacher Curl","muscle":"biceps","warmupSets":0,"workingSets":3,"repMin":10,"repMax":15,
                "targetRIR":2,"type":"isolation","catalogId":"\#(catCurl)","countsTowardVolume":true,"challenge":false},
               {"id":"\#(rowC)","name":"Plank","muscle":"core","warmupSets":0,"workingSets":2,"repMin":30,"repMax":60,
                "targetRIR":2,"type":"isolation","countsTowardVolume":true}]},
            {"id":"\#(dayThu)","day":"Csü","type":"Mell és hát","muscle":"chest","exerciseCount":2,
             "exercises":[
               {"id":"\#(rowD)","name":"Barbell Bench Press","muscle":"chest-mid","warmupSets":2,"workingSets":3,"repMin":6,"repMax":10,
                "targetRIR":2,"type":"compound","catalogId":"\#(catPress)","countsTowardVolume":true},
               {"id":"\#(rowE)","name":"Cable Row","muscle":"back","warmupSets":0,"workingSets":3,"repMin":8,"repMax":12,
                "targetRIR":2,"type":"compound","catalogId":"\#(catRow)","countsTowardVolume":true,
                "technique":"rest_drop","techniqueSource":"owner","challenge":false,"someFutureField":{"x":1}}]}]}]
        """#
    }

    static let catalogJSON = #"""
    [{"id":"\#(catRow)","name":"Chest Supported Row","muscle":"back","type":"compound","stability":"stable","lengthenedFriendly":false,"equipment":"machine"},
     {"id":"\#(catCurl)","name":"Preacher Curl","muscle":"biceps","type":"isolation","stability":"stable","lengthenedFriendly":true},
     {"id":"\#(catPress)","name":"Barbell Bench Press","muscle":"chest","type":"compound","stability":"free","lengthenedFriendly":false}]
    """#

    static let evaluationJSON = #"""
    {"deficit":false,"sportDays":[2],"suggestedSportGroups":["quad"],
     "muscles":[
       {"muscle":"back","tier":"emphasize","band":{"low":14,"high":22,"limit":22,"sportAdjusted":false},"weeklySets":7,"fit":"below","diff":7,
        "spread":[{"dayIndex":0,"sets":4},{"dayIndex":1,"sets":3}],
        "proposal":[{"dayIndex":0,"exerciseIndex":0,"delta":1},{"dayIndex":1,"exerciseIndex":1,"delta":2}],"proposalBlocked":false},
       {"muscle":"biceps","tier":"grow","band":{"low":6,"high":10,"limit":14,"sportAdjusted":false},"weeklySets":3,"fit":"below","diff":3,
        "spread":[{"dayIndex":0,"sets":3}],"proposal":[{"dayIndex":0,"exerciseIndex":1,"delta":3}],"proposalBlocked":false},
       {"muscle":"chest","tier":"maintain","band":{"low":3,"high":7,"limit":20,"sportAdjusted":false},"weeklySets":3,"fit":"inside","diff":0,
        "spread":[{"dayIndex":1,"sets":3}],"proposal":[],"proposalBlocked":false}],
     "days":[
       {"dayIndex":0,"day":"Hét","minutesEstimate":30,"overTarget":null,"sessionCapWarnings":[],"exerciseCapWarnings":[],"sportSameDay":false},
       {"dayIndex":1,"day":"Csü","minutesEstimate":22,"sessionCapWarnings":[{"muscle":"back","sets":9,"cap":8}],"sportSameDay":true}],
     "path":[
       {"week":1,"phase":"MEV","total":13,"muscles":{"back":7,"biceps":3,"chest":3}},
       {"week":2,"phase":"MAV","total":14,"muscles":{"back":8,"biceps":3,"chest":3},"techniques":[{"x":1},{"x":2}]},
       {"week":6,"phase":"Deload","total":7,"muscles":{"back":4,"biceps":2,"chest":2},"techniques":0}],
     "techniqueWarnings":[]}
    """#

    /// A pending manual weekly proposal: back (sets + weight), biceps (reps), chest quiet; one line of a kind this
    /// build does not know, with a reason code it does not know.
    static func proposalJSON(status: String = "pending", decidedB: Bool = false) -> String {
        #"""
        [{"id":"p0000000-0000-4000-8000-000000000001","mesocycleId":"\#(blockId)","week":3,"kind":"weekly","status":"\#(status)",
          "mode":"manual","createdAt":"2026-11-23T06:00:00Z","decidedAt":null,
          "lines":[
            {"id":"L1","exerciseId":"\#(rowA)","exerciseName":"Chest Supported Row","dayIndex":0,"dayName":"Hét","muscleGroup":"back",
             "kind":"sets","from":4,"to":5,"reasons":["all_sets_done","felt_easy"]},
            {"id":"L2","exerciseId":"\#(rowE)","exerciseName":"Cable Row","dayIndex":1,"dayName":"Csü","muscleGroup":"back",
             "kind":"weight","from":27.5,"to":30,"reasons":["top_of_rep_range","next_plate"]\#(decidedB ? #","decision":"accepted""# : "")},
            {"id":"L3","exerciseId":"\#(rowB)","exerciseName":"Preacher Curl","dayIndex":0,"dayName":"Hét","muscleGroup":"biceps",
             "kind":"reps","from":12,"to":13,"reasons":["reserve_left"]},
            {"id":"L4","exerciseId":"\#(rowB)","exerciseName":"Preacher Curl","dayIndex":0,"dayName":"Hét","muscleGroup":"biceps",
             "kind":"tempo_change","from":1,"to":2,"reasons":["brand_new_reason","sport_day"]}],
          "muscles":[
            {"muscle":"back","tier":"emphasize","bandLow":14,"bandHigh":22,"sportAdjusted":false,"setsBefore":7,"setsAfter":8,"lineCount":2,"reasons":[]},
            {"muscle":"biceps","tier":"grow","bandLow":6,"bandHigh":10,"sportAdjusted":false,"setsBefore":3,"setsAfter":3,"lineCount":2,"reasons":[]},
            {"muscle":"chest","tier":"maintain","bandLow":3,"bandHigh":7,"sportAdjusted":false,"setsBefore":3,"setsAfter":3,"lineCount":0,"reasons":["tier_maintain"]}]}]
        """#
    }

    // MARK: the new-block intake (mezo-r36n9.113)

    static let templateId = "7e000000-0000-4000-8000-000000000001"
    static let newBlockId = "b10c0000-0000-4000-8000-000000000002"

    /// A generated / candidate template, relayed to POST /meso-templates as is (the phone never re-types it).
    static func templateJSON(title: String = "Felső-alsó") -> String {
        #"{"title":"\#(title)","weeks":6,"phaseCurve":["MEV","MAV","MAV","MAV","MRV","Deload"],"trainingStyle":"balanced","techniquesEnabled":false,"musclePriorities":{"back":"emphasize"},"futureField":{"nested":[1,2.5,true,null,"x"]},"days":[{"day":"Hét","type":"Upper","muscle":"back","muscleAccent":false,"exercises":[{"name":"Chest Supported Row","muscle":"back-mid","warmupSets":1,"workingSets":4,"repMin":6,"repMax":10,"targetRIR":2,"type":"compound","countsTowardVolume":true}]},{"day":"Csü","type":"Lower","muscle":"quad","muscleAccent":false,"exercises":[]}]}"#
    }

    /// The evaluation with a tier budget appended (`capacity` nil = no session target).
    static func evaluationJSON(budget: String?) -> String {
        guard let budget else { return evaluationJSON }
        return evaluationJSON.replacingOccurrences(of: #""techniqueWarnings":[]"#, with: #""techniqueWarnings":[],"budget":\#(budget)"#)
    }

    static func budgetJSON(capacity: Int? = 60, used: Int = 52, emphasizeCount: Int = 1, raiseCost: String = #"{"chest":4,"biceps":12,"quad":6}"#) -> String {
        #"{"capacitySets":\#(capacity.map(String.init) ?? "null"),"usedSets":\#(used),"emphasizeCount":\#(emphasizeCount),"emphasizeMax":2,"raiseCost":\#(raiseCost)}"#
    }

    /// The intake's week-1 keret: room 8; raising chest or quad still offers a candidate, biceps does not, calf is unpriced.
    static func intakeJSON(capacity: Int? = 60, used: Int = 52, raiseAllowed: String = #"{"chest":true,"biceps":false,"quad":true}"#) -> String {
        #"{"usedSets":\#(used),"capacitySets":\#(capacity.map(String.init) ?? "null"),"emphasizeCount":1,"emphasizeMax":2,"raiseAllowed":\#(raiseAllowed)}"#
    }

    /// Two offered candidates (the first recommended) with reasons, one of a code this build does not know.
    static func candidatesJSON(budget: String = budgetJSON(), nothingFits: Bool = false, intake: String = intakeJSON(),
                               fixes: String? = nil) -> String {
        #"""
        {"candidates":[
          {"splitKey":"ul","splitLabel":"Felső-alsó","template":\#(templateJSON()),"evaluation":\#(evaluationJSON(budget: budget)),
           "recommended":\#(!nothingFits),"reasons":[{"code":"fits_time","value":58},{"code":"freq_2x"},{"code":"brand_new_reason","value":3}]},
          {"splitKey":"full","splitLabel":"Egész test","template":\#(templateJSON(title: "Egész test")),"evaluation":\#(evaluationJSON),
           "recommended":false,"reasons":[{"code":"more_warmups","value":4}]}],
         "nothingFits":\#(nothingFits),
         "fixes":\#(fixes ?? (nothingFits ? #"[{"code":"more_minutes","value":75},{"code":"future_fix"}]"# : "[]")),
         "intakeBudget":\#(intake)}
        """#
    }

    static let generateJSON = #"{"draftId":"d7a00000-0000-4000-8000-000000000001","template":\#(templateJSON(title: "Generált")),"rationale":"Felső-alsó, mert így minden izom kétszer kap.","llmUsed":true}"#

    static func startedBlockJSON(status: String = "planned") -> String {
        #"{"id":"\#(newBlockId)","title":"Felső-alsó","status":"\#(status)","weeks":6,"currentWeek":1,"phaseCurve":["MEV","MAV","MAV","MAV","MRV","Deload"],"days":[]}"#
    }

    static var block: WireBlock { try! JSONDecoder().decode([WireBlock].self, from: Data(blocksJSON().utf8))[0] }
    static var catalog: [WireCatalogItem] { try! JSONDecoder().decode([WireCatalogItem].self, from: Data(catalogJSON.utf8)) }
    static var draft: BlockDraft { BlockDraft(block: block, catalog: catalog) }
    static var proposal: WireProposal { try! JSONDecoder().decode([WireProposal].self, from: Data(proposalJSON().utf8))[0] }

    // MARK: the Éves terv (mezo-r36n9.113) — invented plan, the server's shape

    static let yearPlanId = "9ea40000-0000-4000-8000-000000000001"
    static let yearBlock1 = "9eb10000-0000-4000-8000-000000000001"
    static let yearBlock2 = "9eb10000-0000-4000-8000-000000000002"
    static let yearBlockC = "9eb10000-0000-4000-8000-00000000000c"

    /// Block 1 running (adopted), block 2 planned from 2027-01-11, the consolidation last; `warnings` and `next` as given.
    static func yearPlanJSON(id: Bool = true, status: String = "active", warnings: String = "[]",
                             relaxed: String = "[]", block2Status: String = "planned", unlinked: String = "null",
                             nextYearStart: String = "null") -> String {
        let pid = id ? #""id":"\#(yearPlanId)","# : ""
        func bid(_ v: String) -> String { id ? #""id":"\#(v)","# : "" }
        return #"""
        {\#(pid)"status":"\#(status)","startDate":"2026-11-30","endDate":"2027-11-28","blockWeeks":6,"consolidationWeeks":2,
         "emphasis":["back"],"currentWeek":1,"loadingBlocks":2,"bufferWeeks":1,"bufferStart":"2027-11-08","overrunWeeks":0,
         "blocks":[
           {\#(bid(yearBlock1))"ordinal":1,"kind":"upper","focus":["back","biceps"],"weeks":6,"plannedStart":"2026-11-30",
            "lastDay":"2027-01-10","status":"running","mesocycleId":"\#(blockId)","currentWeek":1,"adopted":true,
            "canMoveEarlier":false,"skipConsequence":[]},
           {\#(bid(yearBlock2))"ordinal":2,"kind":"lower","focus":["quad"],"weeks":6,"plannedStart":"2027-01-11",
            "lastDay":"2027-02-21","status":"\#(block2Status)","mesocycleId":null,"currentWeek":null,"adopted":false,
            "canMoveEarlier":false,"skipConsequence":["quad"],"someFutureField":1},
           {\#(bid(yearBlockC))"ordinal":3,"kind":"consolidation","focus":[],"weeks":2,"plannedStart":"2027-11-15",
            "lastDay":"2027-11-28","status":"planned","adopted":false,"canMoveEarlier":false,"skipConsequence":[]}],
         "relaxed":\#(relaxed),"warnings":\#(warnings),
         "focusCount":{"chest":0,"back":1,"shoulder":0,"biceps":1,"triceps":0,"quad":1,"ham":0,"glute":0,"calf":0},
         "next":{"blockId":"\#(yearBlock2)","startsOn":"2027-01-11","reason":"last_week"},
         "unlinkedRunning":\#(unlinked),"nextYearStart":\#(nextYearStart),
         "review":{"blocksDone":0,"blocksSkipped":0,"focused":["back","biceps"],"unfocused":["chest","shoulder","triceps","quad","ham","glute","calf"]}}
        """#
    }

    static let noYearPlanJSON = #"{"messages":[{"code":"TRAIN_YEAR_PLAN_NONE","message":"x"}]}"#

    static var yearPlan: WireYearPlan { try! JSONDecoder().decode(WireYearPlan.self, from: Data(yearPlanJSON().utf8)) }

    static func planClient(_ stub: StubTransport) -> PlanClient {
        PlanClient(raw: RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" }))
    }
}

// MARK: - The mezociklus lifecycle (mezo-r36n9.177) — invented runs and templates, the server's shapes

extension PlanFixtures {
    static let plannedId = "b10c0000-0000-4000-8000-0000000000a2"
    static let closedA = "b10c0000-0000-4000-8000-0000000000c1"
    static let closedB = "b10c0000-0000-4000-8000-0000000000c2"
    static let templateA = "7e000000-0000-4000-8000-00000000000a"
    static let templateB = "7e000000-0000-4000-8000-00000000000b"

    private static func run(_ id: String, _ title: String, _ status: String, start: String, end: String,
                            closedAt: String? = nil, template: String? = templateA, report: Bool = false,
                            currentWeek: Int = 1, days: String = "[]") -> String {
        let c = closedAt.map { "\"\($0)\"" } ?? "null"
        let t = template.map { "\"\($0)\"" } ?? "null"
        return #"{"id":"\#(id)","title":"\#(title)","status":"\#(status)","weeks":6,"currentWeek":\#(currentWeek),"phaseCurve":["MEV","MAV","MAV","MAV","MRV","Deload"],"split":"upper-lower","goal":"hypertrophy","startDate":"\#(start)","endDate":"\#(end)","closedAt":\#(c),"templateId":\#(t),"hasReport":\#(report),"days":\#(days)}"#
    }

    static let mezoDaysJSON = #"[{"id":"d1","day":"Hét","type":"Felső","muscle":"back","exercises":[{"name":"Chest Supported Row","muscle":"back","workingSets":4},{"name":"Bench Press","muscle":"chest","workingSets":2}]},{"id":"d2","day":"Csü","type":"Alsó","muscle":"quad","exercises":[{"name":"Squat","muscle":"quad","workingSets":4},{"name":"Row","muscle":"back","workingSets":4}]}]"#

    /// Out of order on purpose: the older closed run first, then the running one, the planned one, the newer closed one.
    static func mezoBlocksJSON() -> String {
        "[" + [
            run(closedB, "Tavaszi erő", "archived", start: "2026-04-06", end: "2026-05-17", closedAt: "2026-05-17T18:00:00Z",
                template: templateB, report: true),
            run(blockId, "V-forma és kar", "active", start: "2026-11-16", end: "2026-12-27", currentWeek: 2, days: mezoDaysJSON),
            run(plannedId, "Téli alap", "planned", start: "2027-01-04", end: "2027-02-14"),
            run(closedA, "Nyári tömeg", "archived", start: "2026-07-07", end: "2026-08-17", closedAt: "2026-08-17T18:00:00Z",
                report: true),
        ].joined(separator: ",") + "]"
    }

    static func templatesJSON() -> String {
        #"[{"id":"\#(templateA)","title":"Felső-alsó","weeks":6,"phaseCurve":["MEV","MAV","MAV","MAV","MRV","Deload"],"split":"upper-lower","runCount":3,"trainingStyle":"balanced","createdAt":"2026-06-01T10:00:00Z","updatedAt":"2026-06-01T10:00:00Z","days":\#(mezoDaysJSON)},{"id":"\#(templateB)","title":"Tavaszi erő","weeks":4,"phaseCurve":["MEV","MAV","MRV","Deload"],"split":"full-body","runCount":1,"days":[]}]"#
    }

    static func reportJSON(aiStatus: String, volume: Bool) -> String {
        let ai = aiStatus == "ready" ? #""Erős hat hét volt.""# : "null"
        let v = volume ? #"{"mesocycleId":"\#(closedA)","title":"Nyári tömeg","currentWeek":6,"weeks":6,"startDate":"2026-07-07","endDate":"2026-08-17","status":"archived","phaseCurve":["MEV","MAV"],"muscles":[{"muscle":"back","region":"upper","mrv":22,"weeks":[{"week":1,"phase":"MEV","planned":12,"actual":11,"isCurrent":false},{"week":2,"phase":"MAV","planned":14,"actual":null,"isCurrent":false}]}]}"# : "null"
        return #"{"mesocycleId":"\#(closedA)","templateId":null,"title":"Nyári tömeg","startDate":"2026-07-07","endDate":"2026-08-17","closedAt":"2026-08-17T18:00:00Z","weeks":6,"selfEval":"Jól ment.","aiEval":\#(ai),"aiEvalStatus":"\#(aiStatus)","aiEvalEnabled":true,"adherence":{"plannedSessions":24,"completedSessions":20,"plannedWeeks":6,"completedWeeks":5,"completionPct":83},"volume":\#(v),"strength":[{"exerciseName":"Bench Press","muscle":"chest","firstWeek":1,"lastWeek":6,"firstTopKg":80,"firstTopReps":8,"lastTopKg":85,"lastTopReps":8,"deltaKg":5}],"records":{"medalCount":2,"top":[{"exerciseName":"Bench Press","kind":"weight","date":"2026-08-10","value":85}]},"context":null}"#
    }
}
