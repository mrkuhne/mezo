import Foundation
import Testing
@testable import BoopCore

@Suite("PlanClient.suggestions — the block day editor's add/swap read")
@MainActor
struct PlanSuggestionsTests {
    static let suggestionsJSON = #"""
    {"suggestions":[
      {"exercise":{"id":"c0000000-0000-4000-8000-000000000001","name":"Chest Supported Row","muscle":"back-mid","type":"compound","stability":"stable","lengthenedFriendly":false,"futureField":1},
       "reasonText":"Ugyanazt a munkát végzi a tervben, ezt már csináltad, így látod, hol tartasz.","signals":["same-role","UNDER_BAND","brand_new_signal"],
       "lastTopSet":{"weightKg":60.5,"reps":8},"prescription":{"workingSets":4,"repMin":6,"repMax":10,"targetRIR":2,"restSec":120}},
      {"exercise":{"id":"c0000000-0000-4000-8000-000000000002","name":"Cable Row","muscle":"back-mid","type":"compound"},
       "reasonText":"Ugyanazt a munkát végzi a tervben.","signals":[],"lastTopSet":null,"prescription":null},
      {"exercise":{"id":"c0000000-0000-4000-8000-000000000003","name":"Lat Pulldown","muscle":"back-wide","type":"compound"},
       "reasonText":"x","signals":["same-role"]}],
     "labels":[{"catalogId":"c0000000-0000-4000-8000-000000000002","label":"NO_EQUIPMENT"}]}
    """#

    private func request() -> WireSuggestionsRequest {
        WireSuggestionsRequest(mode: "replace", dayIndex: 0,
                               outgoing: .init(catalogId: nil, name: "Plank", muscle: "core", type: "isolation"),
                               muscle: nil, dayCatalogIds: [PlanFixtures.catRow])
    }

    @Test(.timeLimit(.minutes(1))) func decodesSuggestionsWithPrescriptionAndLabels() async throws {
        let stub = StubTransport()
        stub.on("getBlockExerciseSuggestions", .json(200, Self.suggestionsJSON))
        let r = try await PlanFixtures.planClient(stub).suggestions(blockId: PlanFixtures.blockId, request())
        #expect(r.suggestions.count == 3)
        let first = r.suggestions[0]
        #expect(first.exercise.name == "Chest Supported Row")
        #expect(first.signals == ["same-role", "UNDER_BAND", "brand_new_signal"], "unknown signals kept as strings")
        #expect(first.lastTopSet == WireTopSet(weightKg: 60.5, reps: 8))
        #expect(first.prescription == Prescription(workingSets: 4, repMin: 6, repMax: 10, targetRIR: 2, restSec: 120))
        #expect(r.labels == ["c0000000-0000-4000-8000-000000000002": "NO_EQUIPMENT"], "label list folds into a map")
        #expect(stub.sent[0].path == "/api/train/mesocycles/\(PlanFixtures.blockId)/exercise-suggestions")
        #expect(stub.sent[0].auth == "Bearer tok")
    }

    @Test(.timeLimit(.minutes(1))) func missingPrescriptionIsNil() async throws {
        let stub = StubTransport()
        stub.on("getBlockExerciseSuggestions", .json(200, Self.suggestionsJSON))
        let r = try await PlanFixtures.planClient(stub).suggestions(blockId: "b", request())
        #expect(r.suggestions[1].prescription == nil, "explicit null")
        #expect(r.suggestions[2].prescription == nil, "key absent")
        #expect(r.suggestions[2].lastTopSet == nil)
    }

    @Test(.timeLimit(.minutes(1))) func requestEncodesModeDayIndexAndCatalogIds() async throws {
        let stub = StubTransport()
        stub.on("getBlockExerciseSuggestions", .json(200, #"{"suggestions":[],"labels":[]}"#))
        _ = try await PlanFixtures.planClient(stub).suggestions(blockId: "b", request())
        let body = try #require(stub.sent[0].body)
        let obj = try #require(JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any])
        #expect(obj["mode"] as? String == "replace")
        #expect(obj["dayIndex"] as? Int == 0)
        #expect(obj["dayCatalogIds"] as? [String] == [PlanFixtures.catRow])
        #expect((obj["outgoing"] as? [String: Any])?["name"] as? String == "Plank")
        #expect(obj["muscle"] == nil, "an absent muscle is omitted, not null")
    }

    @Test(.timeLimit(.minutes(1))) func addModeSendsTheMuscle() async throws {
        let stub = StubTransport()
        stub.on("getBlockExerciseSuggestions", .json(200, #"{"suggestions":[],"labels":[]}"#))
        let add = WireSuggestionsRequest(mode: "add", dayIndex: 3, outgoing: nil, muscle: "back", dayCatalogIds: [])
        _ = try await PlanFixtures.planClient(stub).suggestions(blockId: "b", add)
        let body = try #require(stub.sent[0].body)
        let obj = try #require(JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any])
        #expect(obj["muscle"] as? String == "back")
        #expect(obj["outgoing"] == nil)
    }

    @Test(.timeLimit(.minutes(1))) func mapsFailures() async {
        let stub = StubTransport()
        stub.on("getBlockExerciseSuggestions", .json(409, #"{"messages":[{"code":"TRAIN_RUN_NOT_EDITABLE"}]}"#))
        stub.on("getBlockExerciseSuggestions", .json(400, #"{"messages":[{"code":"TRAIN_SUGGESTIONS_REQUEST_INVALID"}]}"#))
        stub.on("getBlockExerciseSuggestions", .status(404))
        stub.on("getBlockExerciseSuggestions", .status(503))
        let c = PlanFixtures.planClient(stub)
        await #expect(throws: PlanFetchError.conflict("TRAIN_RUN_NOT_EDITABLE")) { _ = try await c.suggestions(blockId: "b", request()) }
        await #expect(throws: PlanFetchError.rejected("TRAIN_SUGGESTIONS_REQUEST_INVALID")) { _ = try await c.suggestions(blockId: "b", request()) }
        await #expect(throws: PlanFetchError.notFound) { _ = try await c.suggestions(blockId: "b", request()) }
        await #expect(throws: PlanFetchError.server) { _ = try await c.suggestions(blockId: "b", request()) }
    }

    @Test(.timeLimit(.minutes(1))) func runningDayWorkoutIsADistinctError() async {
        let stub = StubTransport()
        stub.on("replaceDayExercises", .json(409, #"{"messages":[{"code":"TRAIN_DAY_WORKOUT_RUNNING"}]}"#))
        stub.on("replaceDayExercises", .json(409, #"{"messages":[{"code":"TRAIN_RUN_NOT_EDITABLE"}]}"#))
        let c = PlanFixtures.planClient(stub)
        await #expect(throws: PlanFetchError.dayWorkoutRunning) { try await c.saveDay(blockId: "b", dayId: "d", []) }
        await #expect(throws: PlanFetchError.conflict("TRAIN_RUN_NOT_EDITABLE")) { try await c.saveDay(blockId: "b", dayId: "d", []) }
    }
}
