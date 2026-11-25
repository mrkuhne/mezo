import Foundation
import Testing
@testable import BoopCore

// The block builder's coverage hints (mezo-r36n9.114): the read's wire shape and lenient decoding, and the model's
// rules — asked with every evaluation, hidden while the line-up changes, silent on failure, Hozzáadom / visszavonom,
// never on the locked day's proposal.

@Suite("Coverage hints — the read and the builder model")
@MainActor
struct PlanCoverageTests {
    static let catPulldown = "C0000000-0000-4000-8000-0000000000AB"

    /// back: a proposal on Thursday (weekday 3) with a prescription and a broken last top set; chest: no proposal; a
    /// third finding without its verdict (unreadable → dropped).
    static let coverageJSON = #"""
    {"findings":[
      {"group":"back","code":"BACK_NO_VERTICAL_PULL","missingPattern":"vertical-pull","muscles":["back-wide"],
       "verdictText":"Hiányzik a felülről húzás — a hátadat most csak evezéssel edzed.","whyText":"Az evezés inkább a hát közepét építi.",
       "proposal":{"exercise":{"id":"\#(catPulldown)","name":"Lat Pulldown","muscle":"back-wide","type":"compound","gear":["cable"]},
                   "reasonText":"Ezen a héten kevés jut erre az izomra.","signals":["UNDER_BAND"],"lastTopSet":{"bad":true},
                   "prescription":{"workingSets":3,"repMin":10,"repMax":15,"targetRIR":2,"restSec":90},"dayIndex":3}},
      {"group":"chest","code":"CHEST_NO_FLY","missingPattern":"fly","muscles":["chest-mid"],
       "verdictText":"Hiányzik a tárogatás — a mellizmodat most csak nyomással edzed.","whyText":"x","proposal":null,"future":1},
      {"group":"ham","code":"HAM_NO_HINGE"}]}
    """#

    private func loaded(_ stub: StubTransport, coverage: StubTransport.Reply = .json(200, coverageJSON),
                        lockedDay: BlockBuilderModel.LockedDay? = nil) async -> BlockBuilderModel {
        stub.on("listMesocycles", .json(200, PlanFixtures.blocksJSON()))
        stub.on("getExerciseCatalog", .json(200, PlanFixtures.catalogJSON))
        stub.on("listWeekProposals", .json(200, PlanFixtures.proposalJSON()))
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        stub.on("getBlockCoverage", coverage)
        let m = BlockBuilderModel(client: PlanFixtures.planClient(stub), debounce: .seconds(30), lockedDay: lockedDay)
        await m.load()
        return m
    }

    @Test(.timeLimit(.minutes(1))) func decodesLenientlyAndDropsWhatItCannotRead() throws {
        let c = try JSONDecoder().decode(WireCoverage.self, from: Data(Self.coverageJSON.utf8))
        #expect(c.findings.map(\.group) == ["back", "chest"], "the finding without a verdict is dropped, the rest stay")
        let p = try #require(c.findings[0].proposal)
        #expect(p.dayIndex == 3 && p.prescription?.repMax == 15 && p.lastTopSet == nil, "a broken last top set reads as absent")
        #expect(c.findings[1].proposal == nil && c.findings[1].muscles == ["chest-mid"])
        let empty = try JSONDecoder().decode(WireCoverage.self, from: Data("{}".utf8))
        #expect(empty.findings.isEmpty)
    }

    @Test(.timeLimit(.minutes(1))) func askedWithTheEvaluationOnTheContractPath() async throws {
        let stub = StubTransport()
        let m = await loaded(stub)
        #expect(stub.ops.suffix(2) == ["evaluateMesoPlan", "getBlockCoverage"], "after the evaluation, with its minutes")
        let sent = try #require(stub.sent.last)
        #expect(sent.path == "/api/train/mesocycles/\(PlanFixtures.blockId)/coverage")
        let body = try #require(sent.body)
        let obj = try #require(JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: Any])
        let days = try #require(obj["days"] as? [[String: Any]])
        #expect(days.map { $0["dayIndex"] as? Int } == [0, 3], "weekdays, not draft positions")
        #expect(days[0]["catalogIds"] as? [String] == [PlanFixtures.catRow, PlanFixtures.catCurl].map { $0.lowercased() },
                "lower-cased; the plank has no catalogue id")
        #expect(days.map { $0["minutesEstimate"] as? Int } == [30, 22])
        #expect(m.coverageFinding("back")?.proposal?.exercise.name == "Lat Pulldown")
        #expect(m.coverageFinding("chest") != nil && m.coverageFinding("biceps") == nil)
    }

    @Test(.timeLimit(.minutes(1))) func hiddenWhileTheLineupChangesBackWithTheFreshAnswer() async throws {
        let stub = StubTransport()
        let m = await loaded(stub)
        m.draft?.step(day: 0, exercise: 0, by: 1)
        m.draft?.move(day: 0, from: [0], to: 2)
        #expect(m.coverageFresh && m.coverageFinding("back") != nil, "a set step or a reorder keeps the hints")
        m.draft?.remove(day: 1, at: 0)
        #expect(!m.coverageFresh && m.coverageFinding("back") == nil, "a removed row hides them until the fresh answer")
        stub.on("evaluateMesoPlan", .json(200, PlanFixtures.evaluationJSON))
        stub.on("getBlockCoverage", .json(200, #"{"findings":[]}"#))
        await m.evaluateNow()
        #expect(m.coverageFresh && m.coverage.isEmpty)
    }

    @Test(.timeLimit(.minutes(1))) func aFailedReadIsSilent() async throws {
        let offline = await loaded(StubTransport(), coverage: .fail(URLError(.notConnectedToInternet)))
        #expect(offline.evaluation != nil && offline.evaluationError == nil && offline.coverageFinding("back") == nil)
        let broken = await loaded(StubTransport(), coverage: .status(500))
        #expect(broken.coverage.isEmpty && broken.evaluationError == nil)
    }

    @Test(.timeLimit(.minutes(1))) func hozzaadomAddsToTheNamedDayAndUndoTakesItBack() async throws {
        let m = await loaded(StubTransport())
        #expect(m.acceptCoverage("back"))
        let row = try #require(m.draft?.days[1].exercises.last)
        #expect(row.name == "Lat Pulldown" && row.sets == 3 && row.repMin == 10 && row.repMax == 15,
                "Thursday (draft day 1) with the style's prescription")
        #expect(row.catalogId == Self.catPulldown.lowercased())
        #expect(m.hasChanges && m.coverageAddedDay("back") == 1 && m.coverageFinding("back") == nil)
        #expect(!m.acceptCoverage("chest"), "no proposal: nothing to add")
        m.undoCoverage("back")
        #expect(m.draft?.days[1].exercises.count == 2 && !m.hasChanges && m.coverageAddedDay("back") == nil)
    }

    @Test(.timeLimit(.minutes(1))) func neverOnTheLockedDaysProposal() async throws {
        let m = await loaded(StubTransport(), lockedDay: .init(dayId: PlanFixtures.dayThu, weekday: nil))
        #expect(m.coverageFinding("back") == nil && !m.acceptCoverage("back"), "its proposal lands on today's open workout")
        #expect(m.coverageFinding("chest") != nil, "a hint without a proposal still shows")
        #expect(m.coverageOtherDay("chest") == 0, "Mást választok opens on an open day, never the locked one")
        let free = await loaded(StubTransport())
        #expect(free.coverageOtherDay("back") == 1, "the proposal's day")
        #expect(free.coverageOtherDay("chest") == 1, "no proposal: the first day that already trains the group")
    }
}
