import Foundation
import Testing
import BoopCore
@testable import Boop

/// The shared review's three faces (mezo-r36n9.63): megvan · erősítsd meg · nincs a kamrában — confirm, „Másik",
/// „Mind rendben", „+ Kamrába", typed facts. A non-exact match and a doubtful amount never save without his tap.
@MainActor
struct RecipeReviewTests {
    private let chicken = UUID(), oil = UUID(), sunflower = UUID()

    private func draft(_ lines: [ImportedLine]) -> RecipeImportDraft {
        RecipeImportDraft(name: "Csirkés rizs", category: "lunch", servings: 4, steps: [], lines: lines, sourceUrl: nil, needsReview: true, cookedWeightG: nil)
    }
    private func matched(_ name: String = "Csirkemell filé", _ amount: Double = 500, id: UUID? = nil, onShelf: Bool = true) -> ImportedLine {
        ImportedLine(name: name, amount: amount, unit: "g", catalogId: id ?? chicken, confidence: 1, needsReview: false, sourceText: "fél kiló csirkemell",
                     state: .matched, onShelf: onShelf, basisUnit: "g")
    }
    private func confirm(doubt: Bool = false, amount: Double = 30, confidence: Double = 0.5) -> ImportedLine {
        ImportedLine(name: "Olívaolaj", amount: amount, unit: "g", catalogId: oil, confidence: confidence, needsReview: true, sourceText: "két evőkanál olaj",
                     state: .confirm, onShelf: false, basisUnit: "g", amountDoubt: doubt,
                     alternatives: [FoodChoice(id: sunflower, name: "Napraforgóolaj", basisUnit: "ml")])
    }
    private func missing(_ name: String = "Kurkuma", amount: Double = 1, unit: String = "tk") -> ImportedLine {
        ImportedLine(name: name, amount: amount, unit: unit, catalogId: nil, confidence: 0, needsReview: true, sourceText: "egy teáskanál \(name.lowercased())",
                     state: .missing, amountDoubt: true)
    }

    @Test func testConfirmRow_holdsSaveUntilConfirmed() {
        var r = RecipeReview(draft: draft([matched(), confirm()]))
        #expect(r.lines[1].mark == .lowConfidence && r.lines[1].awaitsConfirmation)
        #expect(!r.canSave && r.saveBlocker?.contains("Olívaolaj") == true)
        #expect(reviewRowFace(r.lines[1]).pills.map(\.text).contains("ez az?"))
        #expect(reviewRowFace(r.lines[1]).actions == [.confirm, .other, .remove])
        #expect(reviewRowFace(r.lines[1]).needsLook)
        r.confirm(r.lines[1].id)
        #expect(r.canSave && r.request().lines.map(\.catalogId) == [chicken, oil])
        #expect(!reviewRowFace(r.lines[1]).needsLook)
    }

    @Test func testAmountDoubt_holdsSave() {
        // an exact match whose amount did not convert (spoons against a gram food) is still never saved untouched
        let line = ImportedLine(name: "Olívaolaj", amount: 30, unit: "g", catalogId: oil, confidence: 1, needsReview: false,
                                state: .matched, onShelf: true, basisUnit: "g", amountDoubt: true)
        var r = RecipeReview(draft: draft([line]))
        #expect(r.saveBlocker != nil)
        #expect(reviewRowFace(r.lines[0]).pills.map(\.text) == ["mennyiség?"])
        r.confirm(r.lines[0].id)
        #expect(r.saveBlocker == nil)
        // typing a new amount is a new decision: look again
        r.setAmount(r.lines[0].id, 20)
        #expect(r.saveBlocker != nil)
    }

    @Test func testUnstatedAmount_mustBeTypedAndCannotBeConfirmedAway() {
        var r = RecipeReview(draft: draft([matched(), confirm(doubt: true, amount: 0, confidence: 1)]))
        #expect(r.lines[1].needsAmount && r.confirmableCount == 0)
        #expect(r.saveBlocker?.hasPrefix("Írd be a mennyiséget") == true)
        r.confirmAll()
        #expect(!r.canSave)
        #expect(reviewRowFace(r.lines[1]).pills.map(\.text).contains("írd be a mennyiséget"))
        r.setAmount(r.lines[1].id, 15)
        r.confirm(r.lines[1].id)
        #expect(r.canSave && r.request().lines.last?.amount == 15)
    }

    @Test func testConfirmAll_clearsEveryWaitingRow() {
        var r = RecipeReview(draft: draft([confirm(), confirm(doubt: true), matched(), missing()]))
        #expect(r.toReviewCount == 2 && r.confirmableCount == 2)
        r.confirmAll()
        #expect(r.toReviewCount == 0 && r.canSave)
        // the missing row is untouched: it is left out, and says so
        #expect(r.lines[3].mark == .unmatched && r.leftOut.map(\.line.name) == ["Kurkuma"])
    }

    @Test func testRelink_takesTheChoiceAndItsBasisUnit() {
        var r = RecipeReview(draft: draft([confirm()]))
        let id = r.lines[0].id
        r.relink(id, to: FoodChoice(id: sunflower, name: "Napraforgóolaj", basisUnit: "ml"))
        let l = r.lines[0]
        #expect(l.line.name == "Napraforgóolaj" && l.line.catalogId == sunflower && l.line.unit == "ml" && l.line.basisUnit == "ml")
        // the old row's amount was already a doubtful conversion: the new one needs his look too
        #expect(l.awaitsConfirmation && l.line.amount == 30)
        #expect(reviewRowFace(l).unitFixed && reviewRowFace(l).unit == "ml")

        // a clean conversion: a missing row said in dkg bound to a gram food is sure
        var clean = RecipeReview(draft: draft([missing("Rizs", amount: 30, unit: "dkg")]))
        clean.relink(clean.lines[0].id, to: FoodChoice(id: chicken, name: "Barna rizs", basisUnit: "g"))
        #expect(clean.lines[0].line.amount == 300 && clean.lines[0].line.unit == "g" && clean.lines[0].willSave)
    }

    @Test func testReviewAmount_followsTheServersRule() {
        func said(_ a: Double, _ from: String, _ to: String) -> String {
            let r = reviewAmount(a, from: from, into: to)
            return "\(r.amount)\(r.doubt ? "?" : "")"
        }
        #expect(said(2, "ek", "ml") == "30.0")
        #expect(said(30, "dkg", "g") == "300.0")
        #expect(said(2, "dl", "ml") == "200.0")
        #expect(said(2, "ek", "g") == "30.0?")
        #expect(said(1, "db", "g") == "1.0?")
        #expect(said(0, "g", "g") == "0.0?")
    }

    @Test func testQuickAdded_turnsMissingIntoSavedEstimatedRow() {
        var r = RecipeReview(draft: draft([matched(), missing()]))
        let id = r.lines[1].id
        #expect(reviewRowFace(r.lines[1]).actions == [.quickAdd, .other, .remove])
        let added = PantryRow(id: UUID(), catalogId: UUID(), name: "Kurkuma", per: 100, unit: "g", kcal: 354, proteinG: 7.8, carbsG: 64.9, fatG: 9.9,
                              source: "ai_estimate", estimated: true)
        r.quickAdded(id, row: added)
        let l = r.lines[1]
        #expect(l.estimated && l.line.catalogId == added.catalogId && l.line.unit == "g")
        // 1 tk against a gram food converts only roughly: he looks at the amount
        #expect(l.line.amount == 5 && l.awaitsConfirmation)
        r.confirm(id)
        #expect(r.lines[1].willSave && r.request().lines.last?.catalogId == added.catalogId)
        r.factsTyped(id)
        #expect(r.lines[1].ownFacts && !r.lines[1].estimated)
    }

    @Test func testQuickAddedRow_printsNoNumbers() {
        var r = RecipeReview(draft: draft([missing("Kókusztej", amount: 400, unit: "ml")]))
        r.quickAdded(r.lines[0].id, row: PantryRow(id: UUID(), catalogId: UUID(), name: "Kókusztej", per: 100, unit: "ml", kcal: 185, proteinG: 1.8,
                                                   carbsG: 2.9, fatG: 18.5, estimated: true))
        let face = reviewRowFace(r.lines[0])
        #expect(face.pills.map(\.text) == ["becsült"])
        #expect(face.factsLink == "Tápérték megadása")
        #expect(!face.pills.contains { $0.text.contains("kcal") || $0.text.contains("185") })
        r.factsTyped(r.lines[0].id)
        #expect(reviewRowFace(r.lines[0]).pills.map(\.text) == ["saját adat"])
        #expect(reviewRowFace(r.lines[0]).factsLink == "Tápérték átírása")
    }

    @Test func testReviewRow_showsFixedBasisUnitOnceMatched() {
        let r = RecipeReview(draft: draft([matched(onShelf: false), missing()]))
        let found = reviewRowFace(r.lines[0])
        #expect(found.unitFixed && found.unit == "g" && found.said == "fél kiló csirkemell")
        #expect(found.pills.map(\.text) == ["felveszem a kamrádba"])
        let open = reviewRowFace(r.lines[1])
        #expect(!open.unitFixed && open.unit == "tk" && open.dot == .add)
        #expect(open.pills.map(\.text) == ["nincs a kamrádban"])
    }

    @Test func testMissingRow_isStillLeftOutWithWarning() {
        let r = RecipeReview(draft: draft([matched(), missing("Kurkuma"), missing("Kókusztej")]))
        #expect(r.canSave == false)   // two of three rows left out: he must say he knows
        #expect(r.leftOutWarning?.hasPrefix("2 hozzávaló kimarad") == true)
        #expect(r.request().lines.count == 1)
        #expect(reviewSummaryPills(r).map(\.text) == ["3 hozzávaló", "2 nincs a kamrádban"])
    }

    @Test func testWorkshopDraft_missingLineCanBeQuickAdded() {
        let shelf = UUID()
        var r = RecipeReview(workshop: WorkshopDraft(name: "Tál", category: "breakfast", servings: 1, steps: [],
                                                     lines: [WorkshopLine(source: "pantry", pantryItemId: shelf, name: "Zabpehely", amount: 60, unit: "g"),
                                                             WorkshopLine(source: "estimate", name: "Tehéntúró", amount: 200, unit: "g")]))
        #expect(r.lines[0].line.state == .matched && r.lines[1].line.state == .missing)
        let catalog = UUID()
        r.quickAdded(r.lines[1].id, row: PantryRow(id: UUID(), catalogId: catalog, name: "Tehéntúró", per: 100, unit: "g", kcal: 98, estimated: false))
        #expect(r.lines[1].willSave)
        let lines = r.request().lines
        #expect(lines[0].pantryItemId == shelf && lines[0].catalogId == nil)
        #expect(lines[1].catalogId == catalog && lines[1].amount == 200)
    }

    @Test func testEverySaveOfOneReviewCarriesTheSameClientRef() {
        let r = RecipeReview(draft: draft([matched()]))
        #expect(r.request().clientRef == r.request().clientRef)
        #expect(RecipeReview(draft: draft([matched()])).request().clientRef != r.request().clientRef)
    }

    // MARK: the model's actions

    private final class Calls: @unchecked Sendable {
        var adds = 0, saves = 0, facts: [FoodFacts] = []
        var addAnswer: Result<PantryRow, FoodFetchError> = .failure(.server)
    }

    private func model(_ d: RecipeImportDraft, _ calls: Calls) -> RecipeImportModel {
        RecipeImportModel(mode: .text, reader: { _ in nil },
                          saver: { req in
                              calls.saves += 1
                              try await Task.sleep(for: .milliseconds(80))
                              return Recipe(id: UUID(), name: req.name, slot: "lunch", category: "lunch", servings: req.servings,
                                            macros: Macros(kcal: 1, p: 1, c: 1, f: 1), nova: 1, ingredients: [])
                          },
                          review: RecipeReview(draft: d), eyebrow: "EZT FŐZTEM",
                          adder: { _ in calls.adds += 1; try await Task.sleep(for: .milliseconds(60)); return try calls.addAnswer.get() },
                          factsSaver: { f, row in calls.facts.append(f); var r = row; r.kcal = f.kcal; r.estimated = false; return r })
    }

    @Test func testQuickAdd_secondTapWhileAddingDoesNothing_andAConflictOpensTheAddForm() async {
        let calls = Calls()
        calls.addAnswer = .success(PantryRow(id: UUID(), catalogId: UUID(), name: "Kurkuma", per: 100, unit: "g", kcal: 354, proteinG: 8, carbsG: 65, fatG: 10, estimated: true))
        let m = model(draft([missing()]), calls)
        let id = m.review!.lines[0].id
        async let first: Void = m.quickAdd(id)
        try? await Task.sleep(for: .milliseconds(15))
        await m.quickAdd(id)
        await first
        #expect(calls.adds == 1 && m.review!.lines[0].estimated)
        #expect(m.facts(of: id) == FoodFacts(kcal: 354, proteinG: 8, carbsG: 65, fatG: 10))

        let other = Calls(); other.addAnswer = .failure(.conflict)
        let m2 = model(draft([missing()]), other)
        let id2 = m2.review!.lines[0].id
        await m2.quickAdd(id2)
        #expect(m2.foodForm == .add(line: id2, name: "Kurkuma"))
        #expect(m2.review!.lines[0].mark == .unmatched)

        let failing = Calls(); failing.addAnswer = .failure(.unavailable)
        let m3 = model(draft([missing()]), failing)
        await m3.quickAdd(m3.review!.lines[0].id)
        #expect(m3.addProblems.values.first?.hasPrefix("Boop most nem tudja") == true)
    }

    @Test func testSaveFacts_savesOnlyAChangeAndMakesItHisOwn() async {
        let calls = Calls()
        calls.addAnswer = .success(PantryRow(id: UUID(), catalogId: UUID(), name: "Kurkuma", per: 100, unit: "g", kcal: 354, proteinG: 8, carbsG: 65, fatG: 10, estimated: true))
        let m = model(draft([missing()]), calls)
        let id = m.review!.lines[0].id
        await m.quickAdd(id)
        #expect(await m.saveFacts(id, FoodFacts(kcal: 354, proteinG: 8, carbsG: 65, fatG: 10)))
        #expect(calls.facts.isEmpty && m.review!.lines[0].estimated)
        #expect(!(await m.saveFacts(id, FoodFacts(kcal: -1, proteinG: 8, carbsG: 65, fatG: 10))))
        #expect(await m.saveFacts(id, FoodFacts(kcal: 312, proteinG: 9, carbsG: 60, fatG: 8)))
        #expect(calls.facts.count == 1 && m.review!.lines[0].ownFacts && m.facts(of: id)?.kcal == 312)
    }

    @Test func testDoubleTapOnSaveSavesOnce() async {
        let calls = Calls()
        let m = model(draft([matched()]), calls)
        async let a = m.save()
        async let b = m.save()
        let results = await [a, b]
        #expect(calls.saves == 1 && results.compactMap { $0 }.count == 1)
        #expect(await m.save() == nil && calls.saves == 1)
    }
}
