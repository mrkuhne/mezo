import Foundation
import Testing
@testable import BoopCore

struct CheckInQuestionsTests {
    let core = ["energy", "mood", "stress", "body", "mental"]

    @Test func coreFiveAlwaysFirst() {
        let qs = CheckInQuestions.questions(plan: CheckInPlanLite(slot: "10:00", adaptiveItem: "hunger",
                                                                  adaptiveWhy: "Az éhséged ritkán látszik."))
        #expect(qs.prefix(5).map(\.key) == core)
        #expect(qs.prefix(5).allSatisfy { !$0.isQuestionOfDay && $0.kind == .scale && $0.why == nil })
        #expect(qs[0].label == "Energia")
        #expect(qs[0].question == "Mennyi energia van benned most?")
        #expect(qs.count == 6)
        #expect(qs[5].key == "hunger")
        #expect(qs[5].isQuestionOfDay)
        #expect(qs[5].label == "A nap kérdése")
        #expect(qs[5].question == "Mennyire vagy éhes most?")
        #expect(qs[5].why == "Az éhséged ritkán látszik.")
        #expect(qs[5].low == "Egyáltalán nem" && qs[5].high == "Nagyon")
    }

    @Test func noCachedPlanSkipsQuestionOfDay() {
        #expect(CheckInQuestions.questions(plan: nil).map(\.key) == core)
        #expect(CheckInQuestions.questions(plan: CheckInPlanLite(slot: "06:30", adaptiveItem: nil, adaptiveWhy: nil))
            .map(\.key) == core)
    }

    @Test func questionOfDayKinds() {
        let pain = CheckInQuestions.questions(plan: CheckInPlanLite(slot: "14:00", adaptiveItem: "pain", adaptiveWhy: nil))
        #expect(pain.last?.kind == .pain)
        #expect(pain.last?.options.map(\.id).first == "FEJ")
        #expect(pain.last?.options.count == 12)

        let craving = CheckInQuestions.questions(plan: CheckInPlanLite(slot: "14:00", adaptiveItem: "craving", adaptiveWhy: nil))
        #expect(craving.last?.kind == .craving)
        #expect(craving.last?.options.map(\.label) == ["Édes", "Sós", "Zsíros", "Bármit"])

        let unknown = CheckInQuestions.questions(plan: CheckInPlanLite(slot: "14:00", adaptiveItem: "telepathy", adaptiveWhy: "?"))
        #expect(unknown.map(\.key) == core)

        // A core item named as the question of the day is not asked twice.
        let dup = CheckInQuestions.questions(plan: CheckInPlanLite(slot: "14:00", adaptiveItem: "mood", adaptiveWhy: nil))
        #expect(dup.map(\.key) == core)
    }

    @Test func everyBackendItemIsKnown() {
        let ids = ["energy", "mood", "stress", "body", "mental", "rested", "soreness", "pain", "motivation",
                   "hunger", "craving", "digestion", "connection", "day"]
        for id in ids {
            let qs = CheckInQuestions.questions(plan: CheckInPlanLite(slot: "10:00", adaptiveItem: id, adaptiveWhy: nil))
            #expect(qs.contains { $0.key == id }, "\(id)")
        }
    }

    @Test func startsFromLastAnswerOfDayElseFive() {
        let morning = LedgerCheckIn(id: UUID(), slot: "06:30", capturedAt: at(8, 0),
                                    values: ["energy": 4, "mood": 7])
        let noon = LedgerCheckIn(id: UUID(), slot: "10:00", capturedAt: at(12, 40), values: ["energy": 6])
        let checkIns = [noon, morning] // unsorted on purpose
        #expect(CheckInQuestions.startValue(for: "energy", checkIns: checkIns) == 6)
        #expect(CheckInQuestions.startValue(for: "mood", checkIns: checkIns) == 7)
        #expect(CheckInQuestions.startValue(for: "stress", checkIns: checkIns) == 5)
        #expect(CheckInQuestions.startValue(for: "energy", checkIns: []) == 5)
        let painDay = LedgerCheckIn(id: UUID(), slot: "06:30", capturedAt: at(8, 0), values: [:], pain: true, painIntensity: 3)
        #expect(CheckInQuestions.startValue(for: "pain", checkIns: [painDay]) == 3)
    }
}
