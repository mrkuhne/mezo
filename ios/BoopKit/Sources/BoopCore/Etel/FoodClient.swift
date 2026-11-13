import CryptoKit
import Foundation
import HTTPTypes
import OpenAPIRuntime
import BoopAPI

extension UUID {
    /// How the server writes ids: lowercase.
    var wire: String { uuidString.lowercased() }
}

/// Boop's food client (B4 "Étel"): the day, the plan, drafting and saving a meal, recipes and their import, the pantry,
/// barcode lookup, water, skipping, sensitivities, diet settings, the supplement protocol and meal photos — each a
/// generated operation behind a small value-type API (`FoodModels.swift`).
///
/// Writes take an optional `clientRef` (the server's idempotency key: a retry returns the existing row) and the instant
/// of capture (`capturedAt`, written with the phone's UTC offset — see `FlexibleISO8601Transcoder`). Reads take neither.
/// Every call throws `FoodFetchError`.
public struct FoodClient: Sendable {
    private let client: Client
    private let cal: Calendar

    /// Dates on the wire are Gregorian, in the device zone (a Buddhist/Japanese device calendar would send year 2569).
    public init(client: Client, calendar: Calendar = .current) {
        var greg = Calendar(identifier: .gregorian)
        greg.timeZone = calendar.timeZone
        greg.locale = Locale(identifier: "en_US_POSIX")
        self.client = client; self.cal = greg
    }

    /// `yyyy-MM-dd` of a device-local day.
    public func ymd(_ date: Date) -> String {
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    // MARK: - Day and plan

    public func day(_ date: Date) async throws -> FoodDay {
        try await call {
            switch try await client.getFuelDay(path: .init(date: ymd(date))) {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    public func plan(_ date: Date) async throws -> FuelPlan {
        try await call {
            switch try await client.getFuelPlan(path: .init(date: ymd(date))) {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    // MARK: - The coach

    /// The coach's verdicts on a day's meals, by meal id. Empty when the coach is off or has nothing cached — never an
    /// error; the server generates only for today and returns what is cached for an older day.
    public func coach(_ date: Date) async throws -> [UUID: MealCoach] {
        try await call {
            switch try await client.getMealCoachForDay(query: .init(date: ymd(date))) {
            case .ok(let ok):
                return try ok.body.json.verdicts.reduce(into: [:]) { acc, v in if let c = Self.map(v) { acc[c.mealId] = c } }
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    // MARK: - Drafting and saving a meal

    /// An editable draft from free text and/or a photo (one model call, nothing stored) and/or a scanned barcode (a lookup;
    /// the product becomes one more line, in its label serving). With only a barcode the model is not called. The draft
    /// keeps the photo and the barcode it came from.
    public func draft(date: Date, text: String?, photo: Data?, barcode: String?) async throws -> MealDraft {
        let day = ymd(date)
        let words = text?.trimmingCharacters(in: .whitespacesAndNewlines)
        let asksModel = (words?.isEmpty == false) || photo != nil
        var draft = MealDraft(date: day, slot: Self.slot(at: date, cal: cal), title: nil, items: [], barcode: barcode, photo: photo)
        if asksModel {
            var parts: [Operations.draftMealFromAi.Input.Body.multipartFormPayload] = [
                .date(.init(payload: .init(body: HTTPBody(day))))]
            if let words, !words.isEmpty { parts.append(.text(.init(payload: .init(body: HTTPBody(words))))) }
            if let photo { parts.append(.photo(.init(payload: .init(body: HTTPBody(photo)), filename: "meal.jpg"))) }
            let ai: Components.Schemas.MealAiDraftResponse = try await call {
                switch try await client.draftMealFromAi(body: .multipartForm(MultipartBody(parts))) {
                case .ok(let ok): return try ok.body.json
                case .unauthorized: throw FoodFetchError.unauthorized
                case .badRequest: throw FoodFetchError.rejected
                case .badGateway, .serviceUnavailable: throw FoodFetchError.unavailable
                case .undocumented: throw FoodFetchError.server
                }
            }
            draft.slot = ai.slot; draft.title = ai.title; draft.note = ai.note
            draft.draftId = UUID(uuidString: ai.draftId)
            draft.items = ai.items.map(Self.map)
        }
        if let barcode, !barcode.isEmpty {
            // A failed lookup must not throw away the model call before it (the owner is standing in a shop).
            do {
                let found = try await lookup(barcode: barcode)
                draft.lookupSource = found.source
                if let hit = found.results.first { draft.items.append(Self.draftItem(from: hit)) }
            } catch FoodFetchError.unauthorized {
                throw FoodFetchError.unauthorized
            } catch {
                draft.lookupFailed = true
            }
        }
        return draft
    }

    /// Saves the draft as a meal; a photo on the draft is attached afterwards (a failed upload does not undo the meal —
    /// `hasPhoto` on the result says whether it landed). Without `capturedAt` the meal is stamped now when the draft is for
    /// today, otherwise at noon of the draft's day — the server would otherwise use UTC "now" and could pick the wrong day.
    public func save(_ draft: MealDraft, clientRef: UUID? = nil, capturedAt: Date? = nil) async throws -> Meal {
        let moment = capturedAt ?? defaultMoment(for: draft.date)
        let request = Components.Schemas.MealRequest(
            slot: draft.slot, loggedAt: nil, title: draft.title,
            items: draft.items.map(Self.itemRequest), clientRef: clientRef?.wire, capturedAt: moment)
        var meal: Meal = try await call {
            switch try await client.createMeal(body: .json(request)) {
            case .created(let ok): return Self.map(try ok.body.json)
            case .badRequest: throw FoodFetchError.rejected
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
        if let photo = draft.photo, (try? await putPhoto(photo, mealId: meal.id)) != nil { meal.hasPhoto = true }
        return meal
    }

    private func defaultMoment(for day: String, now: Date = Date()) -> Date {
        if day == ymd(now) { return now }
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let noon = cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) else { return now }
        return min(noon, now)
    }

    // MARK: - Lookup

    /// OpenFoodFacts or our own catalog, by barcode: the results plus where they came from.
    public func lookup(barcode: String) async throws -> LookupResult {
        try await call {
            switch try await client.lookupPantryItem(query: .init(q: barcode)) {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .badRequest: throw FoodFetchError.rejected
            case .unauthorized: throw FoodFetchError.unauthorized
            case .badGateway: throw FoodFetchError.unavailable
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    // MARK: - Recipes and pantry

    public func recipes() async throws -> [Recipe] {
        try await call {
            switch try await client.listRecipes() {
            case .ok(let ok): return try ok.body.json.recipes.map(Self.map)
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    public func recipe(_ id: UUID) async throws -> Recipe {
        try await call {
            switch try await client.getRecipe(path: .init(id: id.wire)) {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .unauthorized: throw FoodFetchError.unauthorized
            case .notFound: throw FoodFetchError.notFound
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    /// Reads a recipe from a page, pasted text or a photo into a review draft; nil when nothing readable was found.
    public func importRecipe(_ source: RecipeImportSource) async throws -> RecipeImportDraft? {
        let response: Components.Schemas.RecipeImportResponse = try await call {
            switch source {
            case .url(let url):
                switch try await client.importRecipeFromUrl(body: .json(.init(url: url))) {
                case .ok(let ok): return try ok.body.json
                case .badRequest: throw FoodFetchError.rejected
                case .unauthorized: throw FoodFetchError.unauthorized
                case .badGateway, .serviceUnavailable: throw FoodFetchError.unavailable
                case .undocumented: throw FoodFetchError.server
                }
            case .text(let text):
                switch try await client.importRecipeFromText(body: .json(.init(text: text))) {
                case .ok(let ok): return try ok.body.json
                case .badRequest: throw FoodFetchError.rejected
                case .unauthorized: throw FoodFetchError.unauthorized
                case .badGateway, .serviceUnavailable: throw FoodFetchError.unavailable
                case .undocumented: throw FoodFetchError.server
                }
            case .photo(let data):
                let part = Operations.importRecipeFromPhoto.Input.Body.multipartFormPayload.photo(
                    .init(payload: .init(body: HTTPBody(data)), filename: "recipe.jpg"))
                switch try await client.importRecipeFromPhoto(body: .multipartForm(MultipartBody([part]))) {
                case .ok(let ok): return try ok.body.json
                case .badRequest: throw FoodFetchError.rejected
                case .unauthorized: throw FoodFetchError.unauthorized
                case .badGateway, .serviceUnavailable: throw FoodFetchError.unavailable
                case .undocumented: throw FoodFetchError.server
                }
            }
        }
        return response.result.map { Self.map($0.value1) }
    }

    /// With no query: the owner's shelf (foods). With one: the shared catalog's foods matching it (a row not on the shelf
    /// has no `id`).
    public func pantry(query: String? = nil) async throws -> [PantryRow] {
        let q = query?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return try await call {
            if q.isEmpty {
                switch try await client.getPantry() {
                case .ok(let ok): return try ok.body.json.ingredients.map(Self.map)
                case .unauthorized: throw FoodFetchError.unauthorized
                case .undocumented: throw FoodFetchError.server
                }
            }
            switch try await client.searchPantryCatalog(query: .init(q: q, kind: "food")) {
            case .ok(let ok): return try ok.body.json.map(Self.map)
            case .badRequest: throw FoodFetchError.rejected
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    /// The owner's supplement stash — the names behind the protocol's rows.
    public func stash() async throws -> [StashRow] {
        try await call {
            switch try await client.getPantry() {
            case .ok(let ok):
                return try ok.body.json.stash.compactMap { r in
                    UUID(uuidString: r.id).map { StashRow(id: $0, name: r.name, dose: r.dose.isEmpty ? nil : r.dose) }
                }
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    // MARK: - Water and skipping

    public func water(ml: Int, date: Date, clientRef: UUID? = nil, capturedAt: Date? = nil) async throws {
        let body = Components.Schemas.WaterLogRequest(date: ymd(date), amountMl: ml, clientRef: clientRef?.wire, capturedAt: capturedAt)
        try await call {
            switch try await client.logWater(body: .json(body)) {
            case .created: return
            case .badRequest: throw FoodFetchError.rejected
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    /// Skips a planned window ("Kihagyom"). The server's key is `<slot>#<n>`, n the 1-based place among the day's windows
    /// of that slot; the window's budget leaves the day. Idempotent per window, so it needs no `clientRef`.
    public func skip(window: PlanWindow, in plan: FuelPlan, reason: SkipReason, reasonText: String? = nil) async throws {
        let sameSlot = plan.windows.filter { $0.slot == window.slot }
        guard let index = sameSlot.firstIndex(where: { $0.from == window.from && $0.to == window.to }) else { throw FoodFetchError.rejected }
        let body = Components.Schemas.PlannedSkipRequest(
            date: plan.date, kind: .MEAL, sessionKey: "\(window.slot)#\(index + 1)",
            reasonCategory: Components.Schemas.PlannedSkipReason(rawValue: reason.rawValue) ?? .NONE,
            reasonText: reason == .other ? reasonText : nil, plannedKcal: window.budget.map { Int($0.kcal.rounded()) })
        try await call {
            switch try await client.upsertPlannedSkip(body: .json(body)) {
            case .ok: return
            case .badRequest: throw FoodFetchError.rejected
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    // MARK: - Settings

    public func sensitivity() async throws -> SensitivityProfile {
        try await call {
            switch try await client.getSensitivityProfile() {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    @discardableResult
    public func setSensitivity(_ profile: SensitivityProfile) async throws -> SensitivityProfile {
        let body = Components.Schemas.SensitivityProfileRequest(
            items: profile.items.map { .init(key: $0.key, level: .init(rawValue: $0.level.rawValue) ?? .avoid, note: $0.note) },
            novaRule: .init(enabled: profile.novaRule.enabled, maxLevel: profile.novaRule.maxLevel))
        return try await call {
            switch try await client.setSensitivityProfile(body: .json(body)) {
            case .ok(let ok): return Self.map(try ok.body.json)
            case .badRequest: throw FoodFetchError.rejected
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    public func dietSettings() async throws -> DietSettings {
        try await call {
            switch try await client.getDietSettings() {
            case .ok(let ok):
                let d = try ok.body.json
                return DietSettings(splitPreset: d.splitPreset.rawValue, proteinTier: d.proteinTier.rawValue, waterMl: d.waterMl,
                                    fiberG: d.fiberG, dayTypeShiftKcal: d.dayTypeShiftKcal, learningEnabled: d.learningEnabled,
                                    proteinPctX10: d.proteinPctX10, carbsPctX10: d.carbsPctX10, fatPctX10: d.fatPctX10)
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    // MARK: - Supplement protocol

    public func `protocol`() async throws -> FoodProtocol {
        try await call {
            switch try await client.getProtocol() {
            case .ok(let ok):
                let active = try ok.body.json.active
                return FoodProtocol(version: active?.version, items: (active?.items ?? []).compactMap { i in
                    guard let id = UUID(uuidString: i.id), let item = UUID(uuidString: i.pantryItemId) else { return nil }
                    return ProtocolItem(id: id, pantryItemId: item, slotKey: i.slotKey, dose: i.dose, pinned: i.pinned)
                })
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    /// One tap ticks the whole daypart group: one intake per protocol item of `daypart`. Each item's `clientRef` is derived
    /// from `clientRef` and the item id, so replaying the tap after a lost answer repeats the same keys and the server
    /// dedupes. Returns how many items were ticked.
    @discardableResult
    public func tickGroup(daypart: String, clientRef: UUID? = nil, capturedAt: Date? = nil) async throws -> Int {
        try await tickGroupIntakes(daypart: daypart, clientRef: clientRef, capturedAt: capturedAt).count
    }

    /// Like `tickGroup`, but returns the ids of the intake entries the server holds — what `deleteIntake` needs to undo
    /// a mis-tap.
    public func tickGroupIntakes(daypart: String, clientRef: UUID? = nil, capturedAt: Date? = nil) async throws -> [UUID] {
        let items = try await `protocol`().items(in: daypart)
        var ids: [UUID] = []
        for item in items {
            let body = Components.Schemas.IntakeRequest(
                pantryItemId: item.pantryItemId.wire, slotKey: item.slotKey, dose: item.dose,
                clientRef: clientRef.map { Self.derivedRef($0, item.id.wire).wire }, capturedAt: capturedAt)
            let id: UUID? = try await call {
                switch try await client.logIntake(body: .json(body)) {
                case .created(let ok): return UUID(uuidString: try ok.body.json.id)
                case .badRequest, .notFound: throw FoodFetchError.rejected
                case .unauthorized: throw FoodFetchError.unauthorized
                case .undocumented: throw FoodFetchError.server
                }
            }
            if let id { ids.append(id) }
        }
        return ids
    }

    /// Soft-deletes one intake entry (undo a mis-tap). A row already gone counts as undone.
    public func deleteIntake(_ id: UUID) async throws {
        do {
            try await call {
                switch try await client.deleteIntake(path: .init(id: id.wire)) {
                case .noContent: return
                case .notFound: throw FoodFetchError.notFound
                case .unauthorized: throw FoodFetchError.unauthorized
                case .undocumented: throw FoodFetchError.server
                }
            }
        } catch FoodFetchError.notFound { return }
    }

    /// A stable per-item key from the group's key: the same inputs always give the same UUID.
    static func derivedRef(_ base: UUID, _ itemId: String) -> UUID {
        let d = Array(SHA256.hash(data: Data("\(base.wire)|\(itemId.lowercased())".utf8)))
        return UUID(uuid: (d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[10], d[11], d[12], d[13], d[14], d[15]))
    }

    // MARK: - Meal photo

    /// The photo bytes of a meal, nil when it has none. Ask only for a meal whose `hasPhoto` is true. The app's transport
    /// is an ephemeral session with no response cache, so every call revalidates against the server's ETag rule
    /// (`private, no-cache`) — a replaced photo is never shown stale.
    public func photo(mealId: UUID) async throws -> Data? {
        do { return try await fetchPhoto(mealId) } catch FoodFetchError.notFound { return nil }
    }

    private func fetchPhoto(_ mealId: UUID) async throws -> Data? {
        try await call {
            switch try await client.getMealPhoto(path: .init(id: mealId.wire)) {
            case .ok(let ok):
                let body: HTTPBody
                switch ok.body {
                case .jpeg(let b): body = b
                case .png(let b): body = b
                }
                return try await Data(collecting: body, upTo: 8 << 20)
            case .notFound: return nil
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    /// Removes one meal's photo (the meal stays).
    public func deletePhoto(mealId: UUID) async throws {
        try await call {
            switch try await client.deleteMealPhoto(path: .init(id: mealId.wire)) {
            case .noContent: return
            case .notFound: throw FoodFetchError.notFound
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    /// Removes EVERY meal photo of the owner. Destructive: the caller asks for confirmation first.
    public func deleteAllPhotos() async throws {
        try await call {
            switch try await client.deleteAllMealPhotos() {
            case .noContent: return
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    private func putPhoto(_ data: Data, mealId: UUID) async throws {
        try await call {
            let part = Operations.putMealPhoto.Input.Body.multipartFormPayload.photo(
                .init(payload: .init(body: HTTPBody(data)), filename: "meal.jpg"))
            switch try await client.putMealPhoto(path: .init(id: mealId.wire), body: .multipartForm(MultipartBody([part]))) {
            case .ok: return
            case .badRequest, .notFound: throw FoodFetchError.rejected
            case .unauthorized: throw FoodFetchError.unauthorized
            case .undocumented: throw FoodFetchError.server
            }
        }
    }

    // MARK: - Plumbing

    private func call<T>(_ work: () async throws -> T) async throws -> T {
        do { return try await work() }
        catch let e as FoodFetchError { throw e }
        catch {
            if let status = (error as? ClientError)?.response?.status.code {
                if status == 401 { throw FoodFetchError.unauthorized }
                if status == 404 { throw FoodFetchError.notFound }
            }
            throw isNetworkFailure(error) ? FoodFetchError.offline : FoodFetchError.server
        }
    }

    /// The meal slot a moment falls in, by the clock (a draft the model did not classify).
    static func slot(at date: Date, cal: Calendar) -> String {
        switch cal.component(.hour, from: date) {
        case 4..<10: return "breakfast"
        case 10..<11: return "snack"
        case 11..<15: return "lunch"
        case 15..<18: return "snack"
        default: return "dinner"
        }
    }
}

// MARK: - Generated type → value type

extension FoodClient {
    static func map(_ m: Components.Schemas.Macros) -> Macros { Macros(kcal: m.kcal, p: m.p, c: m.c, f: m.f) }
    static func map(_ m: Components.Schemas.MacroSet) -> MacroSet { MacroSet(kcal: m.kcal, p: m.p, c: m.c, f: m.f, water: m.water) }
    static func allergens(_ raw: [String: String]?) -> [String: AllergenState] {
        (raw ?? [:]).reduce(into: [:]) { $0[$1.key.lowercased()] = AllergenState(wire: $1.value) }
    }

    static func map(_ r: Components.Schemas.MealResponse) -> Meal {
        Meal(id: UUID(uuidString: r.id) ?? UUID(), slot: r.slot, loggedAt: r.loggedAt, mealDate: r.mealDate, title: r.title,
             macros: map(r.macros), score: r.score.value,
             items: r.items.map { MealItem(name: $0.name, source: $0.source, amount: $0.amount, unit: $0.unit, contribution: map($0.contribution), nova: $0.nova) },
             hasPhoto: r.hasPhoto ?? false, breakdown: r.score.breakdown.map { map($0.value1) })
    }

    static func map(_ b: Components.Schemas.MealBreakdown) -> MealBreakdown {
        MealBreakdown(value: b.value, confidence: b.confidence, tagline: b.tagline, summary: b.summary,
                      dimensions: b.dimensions.map { d in
                          ScoreDimension(id: d.id, label: d.label, weight: d.weight, score: d.score, detail: d.detail,
                                         coverage: d.coverage, note: d.note)
                      },
                      improve: b.improve.map { MealImprove(text: $0.text, impact: $0.impact) })
    }

    static func map(_ v: Components.Schemas.MealCoachVerdict) -> MealCoach? {
        guard let id = UUID(uuidString: v.mealId) else { return nil }
        return MealCoach(mealId: id, tagline: v.tagline, summary: v.summary,
                         improve: v.improve.map { MealImprove(text: $0.text, impact: $0.impact) },
                         dimensionNotes: v.dimensionNotes?.additionalProperties ?? [:],
                         glucoseTips: v.glucoseTips.map { $0.map { GlucoseTip(title: $0.title, body: $0.body) } })
    }

    static func map(_ r: Components.Schemas.FuelDayResponse) -> FoodDay {
        FoodDay(date: r.date, targets: map(r.targets), consumed: map(r.consumed), meals: r.meals.map(map),
                fuelMode: r.fuelMode?.rawValue, recoveryCategory: r.recoveryCategory?.rawValue, recoveryDay: r.recoveryDay,
                skippedKcal: r.skippedKcal ?? 0)
    }

    static func map(_ r: Components.Schemas.FuelPlanResponse) -> FuelPlan {
        FuelPlan(date: r.date, windows: r.windows.map { w in
            PlanWindow(slot: w.slot.rawValue, kind: WindowKind(rawValue: w.kind.rawValue) ?? .meal, label: w.label, from: w.from, to: w.to,
                       budget: w.budget.map { map($0.value1) }, state: WindowState(rawValue: w.state.rawValue) ?? .pending,
                       loggedMealIds: w.loggedMealIds.compactMap(UUID.init(uuidString:)),
                       suggestion: w.suggestion.map { s in
                           let s = s.value1
                           return PlanSuggestion(kind: PlanSuggestion.Kind(rawValue: s.kind.rawValue) ?? .ingredients,
                                                 recipeId: s.recipeId.flatMap(UUID.init(uuidString:)), text: s.text, reason: s.reason)
                       })
        }, remaining: r.remaining.map { map($0.value1) }, tip: r.tip.map { PlanTip(text: $0.value1.text, reason: $0.value1.reason) })
    }

    static func map(_ i: Components.Schemas.MealAiDraftItem) -> DraftItem {
        DraftItem(source: DraftSource(rawValue: i.source) ?? .estimate, pantryItemId: i.pantryItemId.flatMap(UUID.init(uuidString:)),
                  recipeId: i.recipeId.flatMap(UUID.init(uuidString:)), name: i.name, amount: i.amount, unit: i.unit, per: i.per,
                  basisUnit: i.basisUnit, kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG, nova: i.nova,
                  fiberG: i.fiberG, sugarG: i.sugarG, saltG: i.saltG, saturatedFatG: i.saturatedFatG,
                  confidence: i.confidence, needsReview: i.needsReview)
    }

    /// A scanned product as one draft line: macros per `per` of its unit, the amount the label's serving (grams by default).
    /// Its source is `estimate` — it carries its own numbers and is not (yet) a shelf row.
    static func draftItem(from l: LookupItem) -> DraftItem {
        let serving = l.defaultServing
        return DraftItem(source: .estimate, name: l.name,
                         amount: serving.amount, unit: serving.unit, per: l.per, basisUnit: l.unit,
                         kcal: l.kcal ?? 0, proteinG: l.proteinG ?? 0, carbsG: l.carbsG ?? 0, fatG: l.fatG ?? 0, nova: l.nova,
                         fiberG: l.fiberG, sugarG: l.sugarG, saltG: l.saltG, saturatedFatG: l.saturatedFatG,
                         confidence: 1, needsReview: l.kcal == nil, allergens: l.allergens)
    }

    static func itemRequest(_ i: DraftItem) -> Components.Schemas.MealItemRequest {
        Components.Schemas.MealItemRequest(
            source: i.source.rawValue, recipeId: i.recipeId?.wire, pantryItemId: i.pantryItemId?.wire,
            amount: i.amount, unit: i.unit, name: i.name, per: i.per, basisUnit: i.basisUnit, kcal: i.kcal, proteinG: i.proteinG,
            carbsG: i.carbsG, fatG: i.fatG, nova: i.nova, fiberG: i.fiberG, sugarG: i.sugarG, saltG: i.saltG, saturatedFatG: i.saturatedFatG)
    }

    static func map(_ r: Components.Schemas.PantryLookupResponse) -> LookupResult {
        LookupResult(
            source: r.source.flatMap { LookupSource(rawValue: $0.rawValue) } ?? (r.results.isEmpty ? .none : .off),
            results: r.results.map { l in
                LookupItem(name: l.name, brand: l.brand, barcode: l.barcode, per: l.per, unit: l.unit, kcal: l.kcal, proteinG: l.proteinG,
                           carbsG: l.carbsG, fatG: l.fatG, fiberG: l.fiberG, sugarG: l.sugarG, saltG: l.saltG, saturatedFatG: l.saturatedFatG,
                           nova: l.nova, allergens: allergens(l.allergens?.additionalProperties), servingSize: l.servingSize,
                           servingQuantity: l.servingQuantity)
            })
    }

    static func map(_ r: Components.Schemas.RecipeResponse) -> Recipe {
        Recipe(id: UUID(uuidString: r.id) ?? UUID(), name: r.name, slot: r.slot, category: r.category, servings: r.servings,
               prepMins: r.prepMins, cookMins: r.cookMins, tags: r.tags, starred: r.starred,
               macros: Macros(kcal: r.macros.kcal, p: r.macros.p, c: r.macros.c, f: r.macros.f), nova: r.novaDominant,
               ingredients: r.ingredients.compactMap { i in
                   UUID(uuidString: i.pantryItemId).map { RecipeIngredient(pantryItemId: $0, name: i.name, amount: i.amount, unit: i.unit, note: i.note) }
               }, steps: r.steps ?? [], sourceUrl: r.sourceUrl)
    }

    static func map(_ d: Components.Schemas.RecipeImportDraft) -> RecipeImportDraft {
        RecipeImportDraft(name: d.name, category: d.category, servings: d.servings, steps: d.steps, lines: d.lines.map { l in
            ImportedLine(name: l.value1.name, amount: l.value1.amount, unit: l.value1.unit,
                         catalogId: l.value2.match.catalogId.flatMap(UUID.init(uuidString:)),
                         confidence: l.value2.match.confidence, needsReview: l.value2.match.needsReview, sourceText: l.value2.sourceText)
        }, sourceUrl: d.sourceUrl, needsReview: d.needsReview ?? false)
    }

    static func map(_ i: Components.Schemas.IngredientResponse) -> PantryRow {
        PantryRow(id: UUID(uuidString: i.id), catalogId: UUID(uuidString: i.catalogId), name: i.name, brand: i.brand, kind: i.kind.rawValue,
                  per: i.per, unit: i.unit, kcal: i.macros.kcal, proteinG: i.macros.p, carbsG: i.macros.c, fatG: i.macros.f, nova: i.nova,
                  allergens: [:], onShelf: true)
    }

    static func map(_ e: Components.Schemas.PantryCatalogEntry) -> PantryRow {
        PantryRow(id: nil, catalogId: UUID(uuidString: e.id), name: e.name, brand: e.brand, kind: e.kind.rawValue, per: e.per, unit: e.unit,
                  kcal: e.kcal, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG, nova: e.nova,
                  allergens: allergens(e.allergens?.additionalProperties), onShelf: false)
    }

    static func map(_ r: Components.Schemas.SensitivityProfileResponse) -> SensitivityProfile {
        SensitivityProfile(
            items: r.items.map { SensitivityItem(key: $0.key, level: SensitivityLevel(rawValue: $0.level.rawValue.lowercased()) ?? .avoid, note: $0.note) },
            novaRule: NovaRule(enabled: r.novaRule.enabled, maxLevel: r.novaRule.maxLevel))
    }
}
