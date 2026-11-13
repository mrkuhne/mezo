import Foundation
import Testing
import BoopCore
@testable import Boop

/// The Étel room's `Kamra` tab (B4 Task 13): the shelf and the catalog, the sensitivity states with "nincs adat", the
/// one confirm every add route ends in, and the "Szokásos" entrance of the composer.
@MainActor
struct EtelKamraTests {
    private func row(_ name: String, kcal: Double? = 120, nova: Int? = 1, allergens: [String: AllergenState] = [:], category: String? = "dairy",
                     onShelf: Bool = true) -> PantryRow {
        PantryRow(id: onShelf ? UUID() : nil, catalogId: UUID(), name: name, per: 100, unit: "g", kcal: kcal, proteinG: 8, carbsG: 4, fatG: 2,
                  nova: nova, allergens: allergens, onShelf: onShelf, category: category)
    }
    private let lactose = SensitivityProfile(items: [SensitivityItem(key: "milk", level: .intolerance, note: nil)],
                                             novaRule: NovaRule(enabled: true, maxLevel: 2))
    private let lactoseAndGluten = SensitivityProfile(items: [SensitivityItem(key: "milk", level: .intolerance, note: nil),
                                                              SensitivityItem(key: "gluten", level: .allergy, note: nil)],
                                                      novaRule: NovaRule(enabled: false, maxLevel: 4))

    // MARK: search and filter

    @Test func searchIgnoresCaseAndAccentsAndTheCategoryNarrowsIt() {
        let rows = [row("Túró", category: "dairy"), row("Tojás", category: "eggs"), row("Tejföl 20%", category: "dairy")]
        #expect(filterShelf(rows, query: "turo", category: nil).map(\.name) == ["Túró"])
        #expect(filterShelf(rows, query: "", category: "dairy").map(\.name) == ["Túró", "Tejföl 20%"])
        #expect(filterShelf(rows, query: "t", category: "eggs").map(\.name) == ["Tojás"])
        #expect(filterShelf(rows, query: "xyz", category: nil).isEmpty)
    }

    @Test func categoriesListOnlyWhatTheShelfHoldsWithCounts() {
        let rows = [row("a", category: "dairy"), row("b", category: "dairy"), row("c", category: nil), row("d", category: "meat")]
        let cats = shelfCategories(rows)
        #expect(cats.map(\.key) == ["dairy", "meat", "other"])   // an unclassified food is "Egyéb", not hidden
        #expect(cats.first?.count == 2)
        #expect(shelfCategories([]).isEmpty)
    }

    @Test func aCatalogHitAlreadyOnTheShelfIsNotListedTwice() {
        let shelfRow = row("Zabpehely")
        var hit = row("Zabpehely", onShelf: false); hit.catalogId = shelfRow.catalogId
        let other = row("Zabkása", onShelf: false)
        #expect(catalogOnly([hit, other], shelf: [shelfRow]).map(\.name) == ["Zabkása"])
    }

    // MARK: sensitivity states

    @Test func aFlaggedFoodShowsItsBadgeAndAMissingWatchedKeyReadsNincsAdat() {
        let milk = row("Görög joghurt", allergens: ["milk": .contains])
        guard case .flagged(let b) = pantrySensitivity(milk, profile: lactose) else { Issue.record("not flagged"); return }
        #expect(b.first?.text.contains("Tej") == true)
        // no data at all
        #expect(pantrySensitivity(row("Csirkemell"), profile: lactose) == .noData)
        // a map that exists but simply lacks the watched key is STILL "nincs adat" (the trap this slice hit twice)
        #expect(pantrySensitivity(row("Zab", allergens: ["gluten": .traces]), profile: lactose) == .noData)
        #expect(pantrySensitivity(row("Zab", allergens: ["milk": .unknown]), profile: lactose) == .noData)
    }

    @Test func aFoodThatSaysNothingWatchedStaysQuietOnlyWhenTheOwnerWatchesNothing() {
        #expect(pantrySensitivity(row("Csirkemell"), profile: nil) == .nothing)
        #expect(pantrySensitivity(row("Csirkemell"), profile: SensitivityProfile(items: [], novaRule: NovaRule(enabled: false, maxLevel: 4))) == .nothing)
        // a free-text sensitivity has no structured state: nothing to read against
        let free = SensitivityProfile(items: [SensitivityItem(key: "koriander", level: .avoid, note: nil)], novaRule: NovaRule(enabled: false, maxLevel: 4))
        #expect(pantrySensitivity(row("Csirkemell"), profile: free) == .nothing)
    }

    @Test func aFlagOnOneKeyDoesNotHideTheOthersGap() {
        let r = row("Zabkása", allergens: ["milk": .contains])
        let lines = sensitivityLines(r, profile: lactoseAndGluten)
        #expect(lines.contains { $0.contains("Tej") && $0.contains("tartalmazza") })
        #expect(lines.contains { $0.contains("Glutén") && $0.contains("nincs adat") })
    }

    @Test func theDetailNeverSaysFreeOf() {
        let lines = sensitivityLines(row("Csirkemell"), profile: lactose)
        #expect(lines.count == 1)
        #expect(lines[0].contains("nincs adat"))
        #expect(lines[0].contains("nem azt jelenti, hogy nincs benne"))
        for word in ["mentes", "nincs benne tej", "biztonságos"] { #expect(!lines[0].lowercased().contains(word)) }
        // no rules, no lines
        #expect(sensitivityLines(row("Csirkemell"), profile: nil).isEmpty)
    }

    @Test func theDeclaredAllergensAreListedAsTheProductSaysThem() {
        let r = row("Müzli", allergens: ["gluten": .contains, "nuts": .traces, "milk": .unknown])
        let declared = declaredAllergens(r)
        #expect(declared.contains("Glutén: tartalmazza"))
        #expect(declared.contains("Diófélék: nyomokban"))
        #expect(!declared.contains { $0.contains("Tej") })   // unknown is not a declaration
        #expect(declaredAllergens(row("Csirkemell")).isEmpty)
    }

    // MARK: facts, NOVA, provenance

    @Test func factsPer100gSayNincsAdatForWhatTheServerDoesNotKnow() {
        var r = row("Skyr", kcal: 63)
        r.fiberG = nil; r.sugarG = 3.9
        let facts = factRows(r)
        #expect(facts.first { $0.name == "Energia" }?.value == "63 kcal")
        #expect(facts.first { $0.name == "Rost" }?.value == "nincs adat")
        #expect(facts.first { $0.name == "Cukor" }?.value == "3,9 g")
        #expect(factRows(row("Üres", kcal: nil)).first { $0.name == "Energia" }?.value == "nincs adat")
        // basis is per 100 g unless the food says otherwise
        #expect(factsHeading(r) == "100 G-RA")
        var piece = row("Tojás"); piece.per = 1; piece.unit = "db"
        #expect(factsHeading(piece) == "1 DB-RA")
    }

    @Test func novaIsNamedAndAnUnclassifiedFoodSaysSo() {
        #expect(novaLine(1) == "NOVA 1 · feldolgozatlan")
        #expect(novaLine(4) == "NOVA 4 · ultra-feldolgozott")
        #expect(novaLine(nil) == "NOVA nincs besorolás")
        #expect(novaLine(3, profile: lactose).contains("a határod fölött"))
        #expect(!novaLine(2, profile: lactose).contains("a határod fölött"))
    }

    @Test func provenanceNamesTheRouteAndNeverInventsOne() {
        var r = row("Skyr")
        r.source = "openfoodfacts"; r.barcode = "5997001234567"
        #expect(provenanceLines(r).contains("Forrás: OpenFoodFacts"))
        #expect(provenanceLines(r).contains("Vonalkód: 5997001234567"))
        r.source = "photo"; r.barcode = nil
        #expect(provenanceLines(r).contains("Forrás: címkefotóból olvasva"))
        r.source = "manual"
        #expect(provenanceLines(r).contains("Forrás: kézzel felvéve"))
        r.source = "kifli.hu"
        #expect(provenanceLines(r).contains("Forrás: kifli.hu"))
        r.source = nil; r.sharedFrom = "Anna"
        #expect(provenanceLines(r).contains("Forrás: nincs adat"))
        #expect(provenanceLines(r).contains("Közös katalógus · Anna vette fel"))
        // never a price, a stock level or an expiry
        for line in provenanceLines(r) + factRows(r).map(\.name) { for w in ["Ft", "ár", "készlet", "lejár"] { #expect(!line.contains(w)) } }
    }

    // MARK: the one confirm

    @Test func theConfirmNeedsANameAndAnEnergyFigureAndNeverFakesTheOthers() {
        var f = NewPantryFood(name: "", origin: .manual)
        #expect(!pantryAddReady(f))
        f.name = "Házi lekvár"
        #expect(!pantryAddReady(f))            // no kcal yet
        f.kcal = 250
        #expect(pantryAddReady(f))
        #expect(f.proteinG == nil && f.fatG == nil)   // typed nothing = unknown, not 0
        f.per = 0
        #expect(!pantryAddReady(f))
        f.per = 100; f.kcal = -3
        #expect(!pantryAddReady(f))
    }

    @Test func aReadingThatDoubtsItselfHoldsTheSaveUntilTheOwnerSaysSo() {
        let doubtful = NewPantryFood(name: "Müzli", kcal: 380, origin: .labelPhoto, confidence: 0.4, needsReview: true)
        #expect(pantryAddNeedsLook(doubtful))
        var checked = doubtful; checked.needsReview = false; checked.confidence = 0.9
        #expect(!pantryAddNeedsLook(checked))
        // a barcode hit or typed facts carry no confidence of their own
        #expect(!pantryAddNeedsLook(NewPantryFood(name: "Skyr", kcal: 63, origin: .barcode)))
        // a product with a missing macro is said, not zero-filled
        #expect(pantryAddMissing(NewPantryFood(name: "Skyr", kcal: 63, proteinG: 11, origin: .barcode)) == ["szénhidrát", "zsír"])
        #expect(pantryAddMissing(NewPantryFood(name: "Skyr", kcal: 63, proteinG: 11, carbsG: 4, fatG: 0, origin: .barcode)).isEmpty)
    }

    @Test func aScannedProductBecomesTheSameShapeAsATypedOne() {
        let item = LookupItem(name: "Skyr", brand: "Mizo", barcode: "5997001234567", per: 100, unit: "g", kcal: 63, proteinG: 11, carbsG: 4,
                              fatG: nil, nova: 3, allergens: ["milk": .contains], servingSize: "150 g", servingQuantity: 150)
        let f = NewPantryFood(scanned: item)
        #expect(f.origin == .barcode)
        #expect(f.barcode == "5997001234567")
        #expect(f.fatG == nil)
        #expect(f.allergens == ["milk": .contains])
        #expect(f.per == 100)
        // the shelf holds the product, not the serving the label happened to name
        #expect(f.kcal == 63)
    }

    // MARK: eating from the shelf reuses the serving confirmation

    @Test func aShelfOrCatalogFoodOpensTheServingConfirmationInGrams() throws {
        let r = row("Zabpehely", kcal: 370)
        let facts = try #require(r.servingFacts)
        #expect(facts.per == 100)
        #expect(facts.servingQuantity == nil)
        #expect(ServingConfirmation(facts: facts).mode == .grams)
        #expect(ServingConfirmation(facts: facts).grams == 100)
        // a food with no basis cannot be confirmed in grams: it says so rather than guessing
        var broken = r; broken.per = nil
        #expect(broken.servingFacts == nil)
    }

    // MARK: the composer's fifth entrance

    private func usualsModel(_ list: [UsualMeal], calls: MealCalls = MealCalls(), saveFails: FoodFetchError? = nil) -> MealComposerModel {
        MealComposerModel(
            drafter: MealDrafter(calls: calls),
            saver: { d, _, at in
                if let saveFails { throw saveFails }
                return BoopCore.Meal(id: UUID(), slot: d.slot, loggedAt: at, mealDate: d.date, title: d.title, macros: d.total, score: nil) },
            usuals: { list }, outbox: nil)
    }

    private func usual(_ title: String, slot: String = "lunch", count: Int = 3, items: [DraftItem] = []) -> UsualMeal {
        UsualMeal(key: "\(slot):\(title.lowercased())", title: title, slot: slot, count: count, lastLoggedAt: Date(), mealId: items.isEmpty ? nil : UUID(),
                  kcal: items.isEmpty ? nil : 365, items: items)
    }
    private let chicken = DraftItem(source: .pantry, pantryItemId: UUID(), name: "Csirkemell", amount: 150, unit: "g", per: 100, basisUnit: "g",
                                    kcal: 110, proteinG: 23, carbsG: 0, fatG: 1.5, nova: 1)
    private let rice = DraftItem(source: .pantry, pantryItemId: UUID(), name: "Rizs", amount: 180, unit: "g", per: 100, basisUnit: "g",
                                 kcal: 123, proteinG: 2.7, carbsG: 26, fatG: 1, nova: 1)

    @Test func theUsualsComeRankedFromTheServer() async {
        let list = [usual("Csirke rizzsel"), usual("Zabkása", slot: "breakfast", count: 2)]
        let m = usualsModel(list)
        m.show(.usuals)
        await m.loadLists()
        #expect(m.usuals?.map(\.title) == ["Csirke rizzsel", "Zabkása"])
    }

    @Test func aUsualWithItemsIsLoggedAsItWasEatenWithNoAIEstimate() async {
        let calls = MealCalls()
        let u = usual("Csirke rizzsel", items: [chicken, rice])
        let m = usualsModel([u], calls: calls)
        m.show(.usuals)
        await m.loadLists()
        await m.chooseUsual(u)
        #expect(m.stage == .draft)
        // the draft IS the earlier meal's lines — not a model's guess from its name
        #expect(m.draft?.items == [chicken, rice])
        #expect(m.draft?.title == "Csirke rizzsel")
        #expect(await calls.drafted == 0)
        // and the screen says what it is
        #expect(m.usualNote?.contains("legutóbbi") == true)
        #expect(m.usualNote?.contains("becsült") == false)
        // still nothing saved until the owner's tap
        #expect(await calls.saved.isEmpty)
    }

    @Test func theUsualNoteSoftensItsClaimAboutTheNumbers() async {
        let u = usual("Csirke rizzsel", items: [chicken, rice])
        let m = usualsModel([u])
        await m.chooseUsual(u)
        let note = m.usualNote ?? ""
        #expect(note.contains("legutóbbi"))
        #expect(note.contains("mostani adataiból frissülhetnek"))
        #expect(!note.contains("ahogy akkor"))
    }

    @Test func aStaleUsualNoteNeverSurvivesTheOwnersNextSubmit() async {
        let u = usual("Csirke rizzsel", items: [chicken, rice])
        let m = usualsModel([u])
        await m.chooseUsual(u)
        #expect(m.usualNote != nil)
        m.show(.pick)
        #expect(m.usualNote == nil)
        m.text = "valami más"
        await m.submit()
        #expect(m.usualNote == nil)
        #expect(m.stage == .draft)
    }

    @Test func aRefusedSaveOfLinkedLinesNamesThemAndSaysWhatToDo() async {
        let u = usual("Csirke rizzsel", items: [chicken, rice])
        let m = usualsModel([u], saveFails: .rejected)
        await m.chooseUsual(u)
        guard case .failed(let line) = await m.save() else { Issue.record("expected a failure"); return }
        #expect(line.contains("Csirkemell"))
        #expect(line.contains("Rizs"))
        #expect(line.contains("törölted"))
        #expect(line.contains("Töröl"))
        #expect(line != "Nem sikerült elmenteni — próbáld újra.")
        // a draft with no line tied to the shelf or the recipes has no deleted source to blame
        let plain = MealDraft(date: "2026-11-13", slot: "lunch", title: nil, items: [
            DraftItem(source: .estimate, name: "Valami", amount: 1, unit: "db", per: 1, basisUnit: "db", kcal: 10, proteinG: 0, carbsG: 0, fatG: 0)])
        #expect(!MealComposerModel.rejectedSaveLine(plain).contains("törölted"))
    }

    @Test func aUsualWhoseItemsCannotBeReadFallsBackToTheNameAndSaysItIsReEstimated() async {
        let calls = MealCalls()
        let u = usual("Csirke rizzsel")
        let m = usualsModel([u], calls: calls)
        m.show(.usuals)
        await m.loadLists()
        await m.chooseUsual(u)
        #expect(await calls.drafted == 1)
        #expect(m.text == "Csirke rizzsel")
        #expect(m.stage == .draft)
        // visible, not a code comment: the name was re-estimated, this is not a copy of the earlier meal
        #expect(m.usualNote?.contains("nevéből becsültem újra") == true)
        #expect(m.usualNote?.contains("nem a korábbi") == true)
    }

    @Test func noHistoryIsAnHonestEmptyListNotAnInventedRow() async {
        let m = usualsModel([])
        m.show(.usuals)
        await m.loadLists()
        #expect(m.usuals == [])
        #expect(m.listProblem == nil)
    }

    @Test func usualsRowsSayHowOftenAndInWhichWindow() {
        let u = UsualMeal(key: "lunch:csirke rizzsel", title: "Csirke rizzsel", slot: "lunch", count: 3, lastLoggedAt: Date())
        #expect(usualMealLine(u) == "Ebéd · 3× az elmúlt 4 hétben")
        #expect(usualMealLine(UsualMeal(key: "k", title: "Tojás", slot: "dinner", count: 1, lastLoggedAt: Date())) == "Vacsora · 1× az elmúlt 4 hétben")
    }
}
