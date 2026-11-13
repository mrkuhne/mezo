import Foundation

// Swift mirrors of the server's food models (Boop B4 "Étel"). Plain value types: the UI never touches the generated
// `Components.Schemas`. Wire enums read leniently, so a value the server adds later degrades instead of failing the decode.

public struct Macros: Equatable, Sendable {
    public var kcal: Double, p: Double, c: Double, f: Double
    public init(kcal: Double, p: Double, c: Double, f: Double) { self.kcal = kcal; self.p = p; self.c = c; self.f = f }
}

public struct MacroSet: Equatable, Sendable {
    public var kcal: Double, p: Double, c: Double, f: Double, water: Double
    public init(kcal: Double, p: Double, c: Double, f: Double, water: Double) {
        self.kcal = kcal; self.p = p; self.c = c; self.f = f; self.water = water
    }
}

/// An amount with its unit ("40 g", "1 db").
public struct FoodAmount: Equatable, Sendable {
    public var amount: Double
    public var unit: String
    public init(amount: Double, unit: String) { self.amount = amount; self.unit = unit }
}

// MARK: - Allergens and sensitivities

/// What a product says about one allergen. An ABSENT key is no information at all: it is never "free of" — the UI says
/// "nincs adat" for it (`SensitivityRules`).
public enum AllergenState: String, Codable, Equatable, Sendable {
    case contains, traces, unknown
    /// Reads the server's lowercase value; anything else (or a different case) is `.unknown`.
    public init(wire: String) { self = AllergenState(rawValue: wire.lowercased()) ?? .unknown }
}

public enum SensitivityLevel: String, Equatable, Sendable, CaseIterable {
    case allergy, intolerance, avoid
}

public struct SensitivityItem: Equatable, Sendable {
    /// A lowercase EU-14 allergen key (gluten, milk, nuts…) or free text. Free text has no structured state.
    public var key: String
    public var level: SensitivityLevel
    public var note: String?
    public init(key: String, level: SensitivityLevel, note: String?) { self.key = key; self.level = level; self.note = note }

    static let eu14: Set<String> = ["gluten", "crustaceans", "eggs", "fish", "peanuts", "soybeans", "milk", "nuts",
                                    "celery", "mustard", "sesame", "sulphites", "lupin", "molluscs"]
    /// True for the 14 structured keys; free text only ever matches by name.
    public var isStructured: Bool { Self.eu14.contains(key.lowercased()) }
}

public struct NovaRule: Equatable, Sendable {
    public var enabled: Bool
    public var maxLevel: Int
    public init(enabled: Bool, maxLevel: Int) { self.enabled = enabled; self.maxLevel = maxLevel }
}

public struct SensitivityProfile: Equatable, Sendable {
    public var items: [SensitivityItem]
    public var novaRule: NovaRule
    public init(items: [SensitivityItem], novaRule: NovaRule) { self.items = items; self.novaRule = novaRule }
}

// MARK: - Day and plan

public struct MealItem: Equatable, Sendable {
    public var name: String
    public var source: String
    public var amount: Double
    public var unit: String
    public var contribution: Macros
    public var nova: Int?
}

public struct Meal: Equatable, Sendable, Identifiable {
    public var id: UUID
    public var slot: String
    /// The instant it was logged (the server keeps the offset it was sent with).
    public var loggedAt: Date
    /// The record's own day, `yyyy-MM-dd`.
    public var mealDate: String
    public var title: String?
    public var macros: Macros
    public var score: Double?
    public var items: [MealItem]
    /// True when a photo hangs on the meal — never probe with a GET per meal.
    public var hasPhoto: Bool
    /// The deterministic score envelope; nil on a meal scored before the engine existed.
    public var breakdown: MealBreakdown?

    public init(id: UUID, slot: String, loggedAt: Date, mealDate: String, title: String?, macros: Macros, score: Double?,
                items: [MealItem] = [], hasPhoto: Bool = false, breakdown: MealBreakdown? = nil) {
        self.id = id; self.slot = slot; self.loggedAt = loggedAt; self.mealDate = mealDate; self.title = title
        self.macros = macros; self.score = score; self.items = items; self.hasPhoto = hasPhoto; self.breakdown = breakdown
    }
}

// MARK: - The meal's score, dimension by dimension

/// One of the weighted dimensions of a meal's score. `score` is 0…1 as the server writes it; a dimension with weight 0
/// could not see the plate at all (it degraded) and reads "nincs adat", never 0.
public struct ScoreDimension: Equatable, Sendable {
    /// macro | micro | nova | context | who | fat_quality | plant_diversity | energy_density | portion
    public var id: String
    public var label: String
    public var weight: Double
    public var score: Double
    /// The deterministic sentence on why this dimension scored what it did.
    public var detail: String
    /// Share of the meal's energy this dimension could see, 0…1; nil on an older envelope.
    public var coverage: Double?
    /// The coach's one or two sentences on this dimension, when it has written them.
    public var note: String?

    public init(id: String, label: String, weight: Double, score: Double, detail: String, coverage: Double? = nil, note: String? = nil) {
        self.id = id; self.label = label; self.weight = weight; self.score = score; self.detail = detail
        self.coverage = coverage; self.note = note
    }

    /// 0…100, or nil for a degraded dimension.
    public var points: Int? { weight > 0 ? Int((score * 100).rounded()) : nil }
}

public struct MealImprove: Equatable, Sendable {
    public var text: String
    public var impact: String
    public init(text: String, impact: String) { self.text = text; self.impact = impact }
}

public struct MealBreakdown: Equatable, Sendable {
    public var value: Double
    public var confidence: Double
    public var tagline: String?
    public var summary: String?
    public var dimensions: [ScoreDimension]
    public var improve: [MealImprove]
    public init(value: Double, confidence: Double, tagline: String? = nil, summary: String? = nil,
                dimensions: [ScoreDimension], improve: [MealImprove] = []) {
        self.value = value; self.confidence = confidence; self.tagline = tagline; self.summary = summary
        self.dimensions = dimensions; self.improve = improve
    }
}

public struct GlucoseTip: Equatable, Sendable {
    public var title: String
    public var body: String
    public init(title: String, body: String) { self.title = title; self.body = body }
}

/// The coach's words on one meal (prose only — every number comes from the deterministic score).
public struct MealCoach: Equatable, Sendable {
    public var mealId: UUID
    public var tagline: String?
    public var summary: String?
    public var improve: [MealImprove]
    /// Dimension id → one or two sentences.
    public var dimensionNotes: [String: String]
    /// nil = not generated, empty = the plate already smooths.
    public var glucoseTips: [GlucoseTip]?
    public init(mealId: UUID, tagline: String? = nil, summary: String? = nil, improve: [MealImprove] = [],
                dimensionNotes: [String: String] = [:], glucoseTips: [GlucoseTip]? = nil) {
        self.mealId = mealId; self.tagline = tagline; self.summary = summary; self.improve = improve
        self.dimensionNotes = dimensionNotes; self.glucoseTips = glucoseTips
    }
}

public struct FoodDay: Equatable, Sendable {
    public var date: String
    public var targets: MacroSet
    public var consumed: MacroSet
    public var meals: [Meal]
    /// Kímélő mode of the date: `GUIDANCE | MAINTENANCE | ESTIMATE`, nil outside a recovery period.
    public var fuelMode: String?
    public var recoveryCategory: String?
    public var recoveryDay: Int?
    public var skippedKcal: Int

    public init(date: String, targets: MacroSet, consumed: MacroSet, meals: [Meal] = [], fuelMode: String? = nil,
                recoveryCategory: String? = nil, recoveryDay: Int? = nil, skippedKcal: Int = 0) {
        self.date = date; self.targets = targets; self.consumed = consumed; self.meals = meals; self.fuelMode = fuelMode
        self.recoveryCategory = recoveryCategory; self.recoveryDay = recoveryDay; self.skippedKcal = skippedKcal
    }
}

public enum WindowState: String, Equatable, Sendable { case done, now, pending, missed, skipped }
public enum WindowKind: String, Equatable, Sendable { case meal, snack }

public struct PlanSuggestion: Equatable, Sendable {
    public enum Kind: String, Equatable, Sendable { case recipe, ingredients }
    public var kind: Kind
    public var recipeId: UUID?
    public var text: String
    public var reason: String
    public init(kind: Kind, recipeId: UUID? = nil, text: String, reason: String) {
        self.kind = kind; self.recipeId = recipeId; self.text = text; self.reason = reason
    }
}

public struct PlanWindow: Equatable, Sendable {
    /// breakfast | lunch | dinner | snack
    public var slot: String
    public var kind: WindowKind
    public var label: String
    public var from: String
    public var to: String
    /// nil on a kímélő (GUIDANCE) day.
    public var budget: Macros?
    public var state: WindowState
    public var loggedMealIds: [UUID]
    /// Only on an open window.
    public var suggestion: PlanSuggestion?

    public init(slot: String, kind: WindowKind = .meal, label: String, from: String, to: String, budget: Macros? = nil,
                state: WindowState, loggedMealIds: [UUID] = [], suggestion: PlanSuggestion? = nil) {
        self.slot = slot; self.kind = kind; self.label = label; self.from = from; self.to = to; self.budget = budget
        self.state = state; self.loggedMealIds = loggedMealIds; self.suggestion = suggestion
    }
}

public struct PlanTip: Equatable, Sendable {
    public var text: String
    public var reason: String
    public init(text: String, reason: String) { self.text = text; self.reason = reason }
}

public struct FuelPlan: Equatable, Sendable {
    public var date: String
    public var windows: [PlanWindow]
    /// Target − consumed − skipped; negative when over, nil on a GUIDANCE day.
    public var remaining: Macros?
    public var tip: PlanTip?
    public init(date: String, windows: [PlanWindow], remaining: Macros?, tip: PlanTip? = nil) {
        self.date = date; self.windows = windows; self.remaining = remaining; self.tip = tip
    }
}

// MARK: - Drafting and saving a meal

public enum DraftSource: String, Codable, Equatable, Sendable { case recipe, pantry, estimate }

public struct DraftItem: Codable, Equatable, Sendable {
    public var source: DraftSource
    public var pantryItemId: UUID?
    public var recipeId: UUID?
    public var name: String
    public var amount: Double
    public var unit: String
    /// The macros below are for `per` `basisUnit` of the food.
    public var per: Double
    public var basisUnit: String
    public var kcal: Double, proteinG: Double, carbsG: Double, fatG: Double
    public var nova: Int?
    public var fiberG: Double?, sugarG: Double?, saltG: Double?, saturatedFatG: Double?
    public var confidence: Double
    public var needsReview: Bool
    /// What the product label said (from a barcode scan); an absent key means no information.
    public var allergens: [String: AllergenState]

    public init(source: DraftSource, pantryItemId: UUID? = nil, recipeId: UUID? = nil, name: String, amount: Double, unit: String,
                per: Double, basisUnit: String, kcal: Double, proteinG: Double, carbsG: Double, fatG: Double, nova: Int? = nil,
                fiberG: Double? = nil, sugarG: Double? = nil, saltG: Double? = nil, saturatedFatG: Double? = nil,
                confidence: Double = 1, needsReview: Bool = false, allergens: [String: AllergenState] = [:]) {
        self.source = source; self.pantryItemId = pantryItemId; self.recipeId = recipeId; self.name = name
        self.amount = amount; self.unit = unit; self.per = per; self.basisUnit = basisUnit
        self.kcal = kcal; self.proteinG = proteinG; self.carbsG = carbsG; self.fatG = fatG; self.nova = nova
        self.fiberG = fiberG; self.sugarG = sugarG; self.saltG = saltG; self.saturatedFatG = saturatedFatG
        self.confidence = confidence; self.needsReview = needsReview; self.allergens = allergens
    }
}

/// An editable meal, before it is saved. It keeps the photo bytes and the scanned barcode it came from.
public struct MealDraft: Codable, Equatable, Sendable {
    /// The day it is for, `yyyy-MM-dd`.
    public var date: String
    public var slot: String
    public var title: String?
    public var note: String?
    public var items: [DraftItem]
    public var barcode: String?
    /// The meal's photo; `FoodClient.save` attaches it after the meal exists.
    public var photo: Data?
    public var draftId: UUID?
    /// Where the barcode's product came from; nil = no lookup was made, `.none` = looked up and nothing found.
    public var lookupSource: LookupSource?
    /// The barcode lookup failed (offline, upstream error): the draft is otherwise intact, the owner can retry the scan.
    public var lookupFailed: Bool

    public init(date: String, slot: String, title: String?, items: [DraftItem], note: String? = nil,
                barcode: String? = nil, photo: Data? = nil, draftId: UUID? = nil,
                lookupSource: LookupSource? = nil, lookupFailed: Bool = false) {
        self.lookupSource = lookupSource; self.lookupFailed = lookupFailed
        self.date = date; self.slot = slot; self.title = title; self.items = items; self.note = note
        self.barcode = barcode; self.photo = photo; self.draftId = draftId
    }
}

// MARK: - Lookup

public enum LookupSource: String, Codable, Equatable, Sendable { case off = "OFF", catalog = "CATALOG", none = "NONE" }

public struct LookupItem: Equatable, Sendable {
    public var name: String
    public var brand: String?
    public var barcode: String?
    public var per: Double
    public var unit: String
    public var kcal: Double?, proteinG: Double?, carbsG: Double?, fatG: Double?
    public var fiberG: Double?, sugarG: Double?, saltG: Double?, saturatedFatG: Double?
    public var nova: Int?
    public var allergens: [String: AllergenState]
    /// The label's serving ("40 g"); nil on a CATALOG hit.
    public var servingSize: String?
    public var servingQuantity: Double?

    public init(name: String, brand: String? = nil, barcode: String? = nil, per: Double, unit: String,
                kcal: Double? = nil, proteinG: Double? = nil, carbsG: Double? = nil, fatG: Double? = nil,
                fiberG: Double? = nil, sugarG: Double? = nil, saltG: Double? = nil, saturatedFatG: Double? = nil,
                nova: Int? = nil, allergens: [String: AllergenState] = [:], servingSize: String? = nil, servingQuantity: Double? = nil) {
        self.name = name; self.brand = brand; self.barcode = barcode; self.per = per; self.unit = unit
        self.kcal = kcal; self.proteinG = proteinG; self.carbsG = carbsG; self.fatG = fatG
        self.fiberG = fiberG; self.sugarG = sugarG; self.saltG = saltG; self.saturatedFatG = saturatedFatG
        self.nova = nova; self.allergens = allergens; self.servingSize = servingSize; self.servingQuantity = servingQuantity
    }

    /// What the serving confirmation starts from: the label's serving when there is one, otherwise `per` of the food's
    /// unit (grams) — a catalog hit has no serving fields at all.
    public var defaultServing: FoodAmount {
        if let q = servingQuantity, q > 0 { return FoodAmount(amount: q, unit: unit) }
        return FoodAmount(amount: per, unit: unit)
    }
}

public struct LookupResult: Equatable, Sendable {
    public var source: LookupSource
    public var results: [LookupItem]
    public init(source: LookupSource, results: [LookupItem]) { self.source = source; self.results = results }
}

// MARK: - Recipes and pantry

public struct RecipeIngredient: Equatable, Sendable {
    public var pantryItemId: UUID
    public var name: String
    public var amount: Double
    public var unit: String
    public var note: String?
    public var kcal: Double
    public init(pantryItemId: UUID, name: String, amount: Double, unit: String, note: String? = nil, kcal: Double = 0) {
        self.pantryItemId = pantryItemId; self.name = name; self.amount = amount; self.unit = unit; self.note = note; self.kcal = kcal
    }
}

public struct Recipe: Equatable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    public var slot: String?
    public var category: String
    public var servings: Int
    public var prepMins: Int?
    public var cookMins: Int?
    public var tags: [String]
    public var starred: Bool
    /// Whole-recipe macros.
    public var macros: Macros
    public var nova: Int
    public var ingredients: [RecipeIngredient]
    public var steps: [String]
    public var sourceUrl: String?
    /// True when the owner's own photo hangs on the recipe — never probe with a GET per recipe.
    public var hasImage: Bool
    /// The rollup of the ingredients' allergen states (lowercase keys). A key that is absent says nothing: "nincs adat".
    public var allergens: [String: AllergenState]
    /// The deterministic fit, 0…1; nil while the recipe has no kcal to score.
    public var fit: Double?

    public init(id: UUID, name: String, slot: String? = nil, category: String, servings: Int, prepMins: Int? = nil, cookMins: Int? = nil,
                tags: [String] = [], starred: Bool = false, macros: Macros, nova: Int = 1, ingredients: [RecipeIngredient] = [],
                steps: [String] = [], sourceUrl: String? = nil, hasImage: Bool = false, allergens: [String: AllergenState] = [:],
                fit: Double? = nil) {
        self.id = id; self.name = name; self.slot = slot; self.category = category; self.servings = servings
        self.prepMins = prepMins; self.cookMins = cookMins; self.tags = tags; self.starred = starred; self.macros = macros
        self.nova = nova; self.ingredients = ingredients; self.steps = steps; self.sourceUrl = sourceUrl
        self.hasImage = hasImage; self.allergens = allergens; self.fit = fit
    }

    /// Per-serving macros (the library row's numbers).
    public var perServing: Macros {
        let n = Double(max(servings, 1))
        return Macros(kcal: macros.kcal / n, p: macros.p / n, c: macros.c / n, f: macros.f / n)
    }
}

/// One time the recipe went into a logged meal.
public struct RecipeLog: Equatable, Sendable, Identifiable {
    public var mealId: UUID
    public var slot: String
    public var loggedAt: Date
    public var kcal: Double
    public var score: Double?
    public var id: UUID { mealId }
    public init(mealId: UUID, slot: String, loggedAt: Date, kcal: Double, score: Double? = nil) {
        self.mealId = mealId; self.slot = slot; self.loggedAt = loggedAt; self.kcal = kcal; self.score = score
    }
}

/// The recipe's template score: the same envelope a logged meal has (three dimensions, no context).
public struct RecipeBreakdown: Equatable, Sendable {
    public var breakdown: MealBreakdown?
    public var fitsFor: [String]
    public init(breakdown: MealBreakdown?, fitsFor: [String] = []) { self.breakdown = breakdown; self.fitsFor = fitsFor }
}

/// One ingredient of a recipe about to be saved. Either `catalogId` (a catalog food the server puts on the shelf at save)
/// or `pantryItemId` (a shelf row) — a line with neither cannot be saved.
public struct NewRecipeLine: Equatable, Sendable {
    public var catalogId: UUID?
    public var pantryItemId: UUID?
    public var amount: Double
    public var unit: String
    public init(catalogId: UUID? = nil, pantryItemId: UUID? = nil, amount: Double, unit: String) {
        self.catalogId = catalogId; self.pantryItemId = pantryItemId; self.amount = amount; self.unit = unit
    }
}

/// A reviewed recipe, ready for the one save every route ends in.
public struct NewRecipe: Equatable, Sendable {
    public var name: String
    public var category: String
    public var servings: Int
    public var steps: [String]
    public var sourceUrl: String?
    public var lines: [NewRecipeLine]
    public init(name: String, category: String, servings: Int, steps: [String] = [], sourceUrl: String? = nil, lines: [NewRecipeLine]) {
        self.name = name; self.category = category; self.servings = servings; self.steps = steps; self.sourceUrl = sourceUrl; self.lines = lines
    }
}

// MARK: - Receptműhely (one stateless chat turn)

public struct WorkshopLine: Equatable, Sendable {
    /// pantry | estimate
    public var source: String
    public var pantryItemId: UUID?
    public var name: String
    public var amount: Double
    public var unit: String
    public init(source: String, pantryItemId: UUID? = nil, name: String, amount: Double, unit: String) {
        self.source = source; self.pantryItemId = pantryItemId; self.name = name; self.amount = amount; self.unit = unit
    }
}

public struct WorkshopDraft: Equatable, Sendable {
    public var name: String
    public var category: String
    public var servings: Int
    public var steps: [String]
    public var lines: [WorkshopLine]
    public init(name: String, category: String, servings: Int, steps: [String], lines: [WorkshopLine]) {
        self.name = name; self.category = category; self.servings = servings; self.steps = steps; self.lines = lines
    }
}

public struct WorkshopChatMessage: Equatable, Sendable {
    public var fromUser: Bool
    public var text: String
    public init(fromUser: Bool, text: String) { self.fromUser = fromUser; self.text = text }
}

public struct WorkshopReply: Equatable, Sendable {
    public var reply: String
    public var draft: WorkshopDraft
    public init(reply: String, draft: WorkshopDraft) { self.reply = reply; self.draft = draft }
}

public enum RecipeImportSource: Sendable, Equatable {
    case url(String)
    case text(String)
    case photo(Data)
}

public struct ImportedLine: Equatable, Sendable {
    public var name: String
    public var amount: Double
    public var unit: String
    /// The catalog food the line matched; nil = matched nothing. It reaches the shelf only when the recipe is saved with it.
    public var catalogId: UUID?
    public var confidence: Double
    public var needsReview: Bool
    public var sourceText: String?
    /// The matched food's allergen states (lowercase keys). nil = the row matched nothing, so there is no data at all;
    /// a key absent from the map says nothing either — neither is ever "free of".
    public var allergens: [String: AllergenState]?
    public init(name: String, amount: Double, unit: String, catalogId: UUID? = nil, confidence: Double, needsReview: Bool, sourceText: String? = nil,
                allergens: [String: AllergenState]? = nil) {
        self.name = name; self.amount = amount; self.unit = unit; self.catalogId = catalogId; self.confidence = confidence
        self.needsReview = needsReview; self.sourceText = sourceText; self.allergens = allergens
    }
}

/// A read-only recipe preview: nothing is written until the owner confirms.
public struct RecipeImportDraft: Equatable, Sendable {
    public var name: String
    public var category: String
    public var servings: Int
    public var steps: [String]
    public var lines: [ImportedLine]
    public var sourceUrl: String?
    public var needsReview: Bool
    /// The weight of the finished dish when the source states it.
    public var cookedWeightG: Double?
    public init(name: String, category: String, servings: Int, steps: [String] = [], lines: [ImportedLine], sourceUrl: String? = nil,
                needsReview: Bool = false, cookedWeightG: Double? = nil) {
        self.name = name; self.category = category; self.servings = servings; self.steps = steps; self.lines = lines
        self.sourceUrl = sourceUrl; self.needsReview = needsReview; self.cookedWeightG = cookedWeightG
    }
}

public struct PantryRow: Equatable, Sendable {
    /// The owner's shelf row id; nil for a catalog food that is not on the shelf yet.
    public var id: UUID?
    public var catalogId: UUID?
    public var name: String
    public var brand: String?
    public var kind: String
    public var per: Double?
    public var unit: String?
    public var kcal: Double?, proteinG: Double?, carbsG: Double?, fatG: Double?
    public var fiberG: Double?, sugarG: Double?, saltG: Double?, saturatedFatG: Double?
    public var nova: Int?
    /// What the product says about each allergen (lowercase keys). A key that is absent says nothing: "nincs adat".
    public var allergens: [String: AllergenState]
    public var onShelf: Bool
    /// Where the facts came from, as the server names it (`openfoodfacts`, `photo`, `manual`, a shop host, `web`).
    public var source: String?
    public var category: String?
    public var barcode: String?
    /// The owner who first added the shared definition, when it is not the signed-in owner.
    public var sharedFrom: String?

    /// One stable key for lists: the shelf row, else the catalog row.
    public var rowKey: String { id?.uuidString ?? catalogId?.uuidString ?? name }

    public init(id: UUID? = nil, catalogId: UUID? = nil, name: String, brand: String? = nil, kind: String = "food", per: Double? = nil,
                unit: String? = nil, kcal: Double? = nil, proteinG: Double? = nil, carbsG: Double? = nil, fatG: Double? = nil,
                fiberG: Double? = nil, sugarG: Double? = nil, saltG: Double? = nil, saturatedFatG: Double? = nil, nova: Int? = nil,
                allergens: [String: AllergenState] = [:], onShelf: Bool = true, source: String? = nil, category: String? = nil,
                barcode: String? = nil, sharedFrom: String? = nil) {
        self.id = id; self.catalogId = catalogId; self.name = name; self.brand = brand; self.kind = kind; self.per = per
        self.unit = unit; self.kcal = kcal; self.proteinG = proteinG; self.carbsG = carbsG; self.fatG = fatG
        self.fiberG = fiberG; self.sugarG = sugarG; self.saltG = saltG; self.saturatedFatG = saturatedFatG; self.nova = nova
        self.allergens = allergens; self.onShelf = onShelf; self.source = source; self.category = category
        self.barcode = barcode; self.sharedFrom = sharedFrom
    }
}

// MARK: - The week and the usuals

/// One day of the week read: the day's targets against what was eaten, no meal bodies.
public struct FuelDayRollup: Equatable, Sendable, Identifiable {
    public var date: String
    public var targets: MacroSet
    public var consumed: MacroSet
    /// Kímélő mode of the date: `GUIDANCE | MAINTENANCE | ESTIMATE`, nil outside a recovery period.
    public var fuelMode: String?
    public var recoveryCategory: String?
    public var recoveryDay: Int?
    public var skippedKcal: Int
    /// The planned training the day's target made room for; nil when the server did not split the target.
    public var plannedMovementKcal: Int?
    public var id: String { date }
    public init(date: String, targets: MacroSet, consumed: MacroSet, fuelMode: String? = nil, recoveryCategory: String? = nil,
                recoveryDay: Int? = nil, skippedKcal: Int = 0, plannedMovementKcal: Int? = nil) {
        self.date = date; self.targets = targets; self.consumed = consumed; self.fuelMode = fuelMode
        self.recoveryCategory = recoveryCategory; self.recoveryDay = recoveryDay; self.skippedKcal = skippedKcal
        self.plannedMovementKcal = plannedMovementKcal
    }
}

public struct FuelWeek: Equatable, Sendable {
    public var start: String
    public var days: [FuelDayRollup]
    /// The mean of the week's scored meals, 0…1; nil when no meal carries a score.
    public var mealScoreAvg: Double?
    public init(start: String, days: [FuelDayRollup], mealScoreAvg: Double? = nil) {
        self.start = start; self.days = days; self.mealScoreAvg = mealScoreAvg
    }
}

/// One of the owner's usual meals (the server's `UsualMealRanker`): a name in a window, how often it recurred in the last
/// 28 days and when it last did. It carries no numbers — logging one goes through Boop's draft, which computes them.
public struct UsualMeal: Equatable, Sendable, Identifiable {
    public var key: String
    public var title: String
    public var slot: String
    public var count: Int
    public var lastLoggedAt: Date
    public var id: String { key }
    public init(key: String, title: String, slot: String, count: Int, lastLoggedAt: Date) {
        self.key = key; self.title = title; self.slot = slot; self.count = count; self.lastLoggedAt = lastLoggedAt
    }
}

// MARK: - Adding a food to the shelf

/// A food on its way to the shelf: whatever a route found (a barcode, a page, a label photo) or the owner typed — the
/// ONE shape every add route ends in, and what the confirm screen edits. Facts are per `per` `unit` (100 g by default).
public struct NewPantryFood: Equatable, Sendable {
    public enum Origin: Equatable, Sendable { case barcode, link(String), labelPhoto, manual }
    public var name: String
    public var brand: String?
    public var barcode: String?
    public var category: String?
    public var per: Double
    public var unit: String
    public var kcal: Double?, proteinG: Double?, carbsG: Double?, fatG: Double?
    public var fiberG: Double?, sugarG: Double?, saltG: Double?, saturatedFatG: Double?
    public var nova: Int?
    public var allergens: [String: AllergenState]
    public var origin: Origin
    /// The reading's own confidence (a scraped page, a label photo); nil for a barcode hit or typed facts.
    public var confidence: Double?
    public var needsReview: Bool

    public init(name: String = "", brand: String? = nil, barcode: String? = nil, category: String? = nil, per: Double = 100, unit: String = "g",
                kcal: Double? = nil, proteinG: Double? = nil, carbsG: Double? = nil, fatG: Double? = nil, fiberG: Double? = nil,
                sugarG: Double? = nil, saltG: Double? = nil, saturatedFatG: Double? = nil, nova: Int? = nil,
                allergens: [String: AllergenState] = [:], origin: Origin, confidence: Double? = nil, needsReview: Bool = false) {
        self.name = name; self.brand = brand; self.barcode = barcode; self.category = category; self.per = per; self.unit = unit
        self.kcal = kcal; self.proteinG = proteinG; self.carbsG = carbsG; self.fatG = fatG; self.fiberG = fiberG
        self.sugarG = sugarG; self.saltG = saltG; self.saturatedFatG = saturatedFatG; self.nova = nova
        self.allergens = allergens; self.origin = origin; self.confidence = confidence; self.needsReview = needsReview
    }

    /// The shelf's category words (the contract's enum), with their Hungarian names for the picker.
    public static let categories: [(key: String, label: String)] = [
        ("vegetables", "Zöldség"), ("fruits", "Gyümölcs"), ("meat", "Hús"), ("fish", "Hal"), ("eggs", "Tojás"), ("dairy", "Tejtermék"),
        ("cheese", "Sajt"), ("legumes", "Hüvelyes"), ("grains", "Gabona"), ("pasta", "Tészta"), ("bakery", "Pékáru"),
        ("nuts_seeds", "Mag"), ("oils_fats", "Olaj"), ("condiments", "Fűszer, szósz"), ("snacks", "Snack"), ("beverages", "Ital"),
        ("other", "Egyéb"),
    ]
    public static func categoryLabel(_ key: String?) -> String? { categories.first { $0.key == key }?.label }
}

/// One supplement on the owner's stash: the name the protocol rows carry no text for.
public struct StashRow: Equatable, Sendable {
    public var id: UUID
    public var name: String
    public var dose: String?
    public init(id: UUID, name: String, dose: String? = nil) { self.id = id; self.name = name; self.dose = dose }
}

// MARK: - Settings and protocol

public struct DietSettings: Equatable, Sendable {
    public var splitPreset: String
    public var proteinTier: String
    public var waterMl: Int
    public var fiberG: Int
    public var dayTypeShiftKcal: Int
    public var learningEnabled: Bool
    public var proteinPctX10: Int?, carbsPctX10: Int?, fatPctX10: Int?
}

public struct ProtocolItem: Equatable, Sendable, Identifiable {
    public var id: UUID
    public var pantryItemId: UUID
    /// The daypart group the item sits in.
    public var slotKey: String
    public var dose: String?
    public var pinned: Bool
    public init(id: UUID, pantryItemId: UUID, slotKey: String, dose: String? = nil, pinned: Bool = false) {
        self.id = id; self.pantryItemId = pantryItemId; self.slotKey = slotKey; self.dose = dose; self.pinned = pinned
    }
}

public struct FoodProtocol: Equatable, Sendable {
    public var version: Int?
    public var items: [ProtocolItem]
    public init(version: Int? = nil, items: [ProtocolItem]) { self.version = version; self.items = items }
    public func items(in daypart: String) -> [ProtocolItem] { items.filter { $0.slotKey == daypart } }
}

// MARK: - Skipping

public enum SkipReason: String, Equatable, Sendable, CaseIterable {
    case illness = "ILLNESS", stomach = "STOMACH", injury = "INJURY", travel = "TRAVEL", tired = "TIRED",
         noTime = "NO_TIME", noMood = "NO_MOOD", notHungry = "NOT_HUNGRY", other = "OTHER", none = "NONE"
}

/// Why a food call did not come back.
public enum FoodFetchError: Error, Equatable, Sendable {
    case offline, unauthorized
    /// The model (draft / recipe reading) or an upstream service is not available.
    case unavailable
    case notFound
    /// The server refused the request as invalid.
    case rejected
    case server
}
