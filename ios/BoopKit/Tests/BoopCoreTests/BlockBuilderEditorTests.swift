import Foundation
import Testing
@testable import BoopCore

// The builder model's day-editor hooks (mezo-r36n9.116): locked day, pending review days, stale indices, the
// suggestions request, AI notes on swapped rows.

@Suite("BlockBuilderModel — the day editor's hooks")
@MainActor
struct BlockBuilderEditorTests {
    private func loaded(_ stub: StubTransport, proposals: String = PlanFixtures.proposalJSON(), evaluation: String? = nil,
                        lockedDay: BlockBuilderModel.LockedDay? = nil) async -> BlockBuilderModel {
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON()))
        stub.on("getExerciseCatalog", .json(200, PlanFixtures.catalogJSON))
        stub.on("listWeekProposals", .json(200, proposals))
        stub.on("evaluateMesoPlan", .json(200, evaluation ?? PlanFixtures.evaluationJSON))
        let m = BlockBuilderModel(client: PlanFixtures.planClient(stub), debounce: .seconds(30), lockedDay: lockedDay)
        await m.load()
        return m
    }

    private static let catalogNew = CatalogExercise(id: UUID(uuidString: "C0000000-0000-4000-8000-0000000000FF")!, slug: "x",
                                                    name: "Cable Curl", muscle: "biceps", type: .isolation, stim: 0.5, fatigue: 0.3)

    @Test(.timeLimit(.minutes(1))) func lockedDayResolvesByIdThenWeekday() async {
        let m = await loaded(StubTransport(), lockedDay: .init(dayId: PlanFixtures.dayThu.uppercased(), weekday: nil))
        #expect(m.lockedDayIndex == 1, "matched by template day id, case-insensitive")
        m.lockedDay = .init(dayId: "unknown", weekday: "Hét")
        #expect(m.lockedDayIndex == 0, "falls back to the weekday label")
        m.lockedDay = nil
        #expect(m.lockedDayIndex == nil)
    }

    @Test(.timeLimit(.minutes(1))) func pendingDaysComeFromTheLoadedProposal() async {
        let m = await loaded(StubTransport(), proposals: PlanFixtures.proposalJSON(decidedB: true))
        // L2 (Thursday) is decided; L1/L3/L4 (Monday) still wait.
        #expect(m.pendingReviewDays == [0])
        let none = await loaded(StubTransport(), proposals: PlanFixtures.proposalJSON(status: "applied"))
        #expect(none.pendingReviewDays.isEmpty, "an applied proposal asks nothing")
    }

    @Test(.timeLimit(.minutes(1))) func confirmOnlyForAStructuralChangeOnAPendingDay() async {
        let m = await loaded(StubTransport(), proposals: PlanFixtures.proposalJSON(decidedB: true))
        m.draft?.step(day: 0, exercise: 0, by: 1)
        #expect(m.hasChanges && !m.needsReviewConfirm, "a set step is not structural")
        m.draft?.move(day: 1, from: [0], to: 2)
        #expect(m.structurallyChanged(1) && !m.needsReviewConfirm, "Thursday has no waiting line")
        m.draft?.move(day: 0, from: [0], to: 2)
        #expect(m.needsReviewConfirm)
    }

    @Test(.timeLimit(.minutes(1))) func recommendationsHideUntilTheLineupIsEvaluated() async throws {
        let stub = StubTransport()
        let recs = PlanFixtures.evaluationJSON.replacingOccurrences(of: #""techniqueWarnings":[]"#,
            with: #""techniqueWarnings":[],"recommendations":[{"dayIndex":0,"exerciseIndex":1,"technique":"partials","reason":"lengthened_safe"}]"#)
        let m = await loaded(stub, evaluation: recs)
        #expect(m.recommendation(day: 0, exercise: 1) != nil && m.indicesFresh)
        m.draft?.step(day: 0, exercise: 0, by: 1)
        #expect(m.recommendation(day: 0, exercise: 1) != nil, "a set step keeps the indices")
        m.draft?.move(day: 0, from: [1], to: 0)
        #expect(m.recommendation(day: 0, exercise: 1) == nil && !m.canApplyProposals, "a move shifts the indices")
        stub.on("evaluateMesoPlan", .json(200, recs))
        await m.evaluateNow()
        #expect(m.indicesFresh && m.recommendation(day: 0, exercise: 1) != nil, "back once the fresh evaluation lands")
    }

    @Test(.timeLimit(.minutes(1))) func suggestSendsWeekdayAndLowerCasedIds() async throws {
        let stub = StubTransport()
        let m = await loaded(stub)
        stub.on("getBlockExerciseSuggestions", .json(200, #"{"suggestions":[],"labels":[]}"#))
        let thursday = try #require(m.draft?.days[1].exercises[0])
        _ = try await m.suggest(mode: "replace", day: 1, outgoing: thursday)
        let body = try #require(stub.sent.last?.body)
        let obj = try #require(JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any])
        #expect(obj["dayIndex"] as? Int == 3, "Csütörtök is weekday 3, not the draft's second day")
        #expect(obj["dayCatalogIds"] as? [String] == [PlanFixtures.catPress, PlanFixtures.catRow].map { $0.lowercased() })
        let out = try #require(obj["outgoing"] as? [String: Any])
        #expect(out["name"] as? String == "Barbell Bench Press" && out["muscle"] as? String == "chest-mid")
    }

    @Test(.timeLimit(.minutes(1))) func aSwappedRowLosesTheWeeklyNote() async throws {
        let notes = PlanFixtures.proposalJSON().replacingOccurrences(
            of: #""kind":"reps","from":12,"to":13,"reasons":["reserve_left"]"#,
            with: #""kind":"reps","from":12,"to":13,"reasons":["ai_suggested"],"note":"Itt jó helyen van.""#)
        let m = await loaded(StubTransport(), proposals: notes)
        #expect(m.aiNote(try #require(m.draft?.days[0].exercises[1])) == "Itt jó helyen van.")
        m.draft?.replace(day: 0, at: 1, with: Self.catalogNew, prescription: nil)
        #expect(m.aiNote(try #require(m.draft?.days[0].exercises[1])) == nil)
    }
}
