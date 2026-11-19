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

    static var block: WireBlock { try! JSONDecoder().decode([WireBlock].self, from: Data(blocksJSON().utf8))[0] }
    static var catalog: [WireCatalogItem] { try! JSONDecoder().decode([WireCatalogItem].self, from: Data(catalogJSON.utf8)) }
    static var draft: BlockDraft { BlockDraft(block: block, catalog: catalog) }
    static var proposal: WireProposal { try! JSONDecoder().decode([WireProposal].self, from: Data(proposalJSON().utf8))[0] }

    static func planClient(_ stub: StubTransport) -> PlanClient {
        PlanClient(raw: RawJSONClient(transport: stub, baseURL: URL(string: "https://example.test")!, token: { "tok" }))
    }
}
