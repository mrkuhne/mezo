import Foundation

/// The Évad page's server calls (Boop B6, `mezo-r36n9.16`), over the same lenient JSON caller as Pénz and the block
/// builder (`RawJSONClient`): typed failures (`PlanFetchError`) — a 404 on the overview is "no season yet", a 409 on an
/// accept is `SEASON_PREVIEW_STALE`. Paths and operation ids are the contract's own (`api/feature/season/season.yml`).
///
/// Nothing here changes his data except `create`, `activate`, `apply` and `putRules`, and each of those only runs on
/// his tap ("Indulhat az évad", "Elfogadom", a Szabályok switch).
public struct EvadClient: Sendable {
    let raw: RawJSONClient

    public init(raw: RawJSONClient) { self.raw = raw }

    /// The Évad tab's read model. `.notFound` = he has no active season (the page shows the empty state).
    public func overview() async throws(PlanFetchError) -> EvadOverview {
        try await raw.get("/api/seasons/active/overview", operationID: "getSeasonOverview")
    }

    /// The server's judgement of each day `from…to` (inclusive, `yyyy-MM-dd`, at most 62 days) — with or without a
    /// season. The Étel room's Hét tab reads its judged / kímélő flags from here (B6 S2, Task 12).
    public func adherence(from: String, to: String) async throws(PlanFetchError) -> EvadAdherenceResponse {
        try await raw.get("/api/seasons/adherence?from=\(from)&to=\(to)", operationID: "getAdherence")
    }

    /// A first season assembled from his live goal, running block, weekly slots and sleep goal. Saves nothing.
    public func firstDraft() async throws(PlanFetchError) -> EvadDraft {
        try await raw.get("/api/seasons/draft", operationID: "getFirstSeasonDraft")
    }

    /// The new-season summary before any season exists. Saves nothing; `fingerprint` is empty.
    public func previewDraft(_ d: EvadDraft) async throws(PlanFetchError) -> EvadPreview {
        try await raw.send(.post, "/api/seasons/draft/preview", operationID: "previewSeasonDraft", body: d)
    }

    /// Creates a planned season — activates nothing.
    public func create(_ d: EvadDraft) async throws(PlanFetchError) -> EvadSeason {
        try await raw.send(.post, "/api/seasons", operationID: "createSeason", body: d)
    }

    public func activate(id: String) async throws(PlanFetchError) -> EvadSeason {
        try await raw.get(method: .post, "/api/seasons/\(id)/activate", operationID: "activateSeason")
    }

    /// What a change to this season would do. Saves nothing.
    public func preview(id: String, _ d: EvadDraft) async throws(PlanFetchError) -> EvadPreview {
        try await raw.send(.post, "/api/seasons/\(id)/preview", operationID: "previewSeason", body: d)
    }

    /// Accepts a previewed change. `.conflict("SEASON_PREVIEW_STALE")` = something changed since the preview.
    public func apply(id: String, _ d: EvadDraft, fingerprint: String) async throws(PlanFetchError) -> EvadSeason {
        try await raw.send(.put, "/api/seasons/\(id)", operationID: "applySeason",
                           body: EvadApply(draft: d, fingerprint: fingerprint))
    }

    public func putRules(id: String, _ r: EvadRules) async throws(PlanFetchError) -> EvadSeason {
        try await raw.send(.put, "/api/seasons/\(id)/rules", operationID: "putSeasonRules", body: r)
    }

    // MARK: - S3: the weekly menu, the recipe choice, the shopping list

    /// The menu of the week starting `weekStart` (a Monday, `yyyy-MM-dd`). `.notFound` = no active season.
    public func menu(weekStart: String) async throws(PlanFetchError) -> EvadMenuWeek {
        try await raw.get("/api/seasons/menu?weekStart=\(weekStart)", operationID: "getMenuWeek")
    }

    /// Plans (or re-plans — „Kérek másikat") a proposed week. `.conflict("MENU_NOT_PROPOSED")` once it is approved.
    public func generateMenu(weekStart: String) async throws(PlanFetchError) -> EvadMenuWeek {
        try await raw.send(.post, "/api/seasons/menu/generate", operationID: "generateMenuWeek",
                           body: EvadWeekStartBody(weekStart: weekStart))
    }

    public func approveMenu(id: String) async throws(PlanFetchError) -> EvadMenuWeek {
        try await raw.get(method: .post, "/api/seasons/menu/\(id)/approve", operationID: "approveMenuWeek")
    }

    public func alternatives(mealId: String) async throws(PlanFetchError) -> [EvadMenuAlternative] {
        try await raw.get("/api/seasons/menu/meals/\(mealId)/alternatives", operationID: "listMenuAlternatives")
    }

    public func swap(mealId: String, recipeId: String) async throws(PlanFetchError) -> EvadMenuWeek {
        try await raw.send(.put, "/api/seasons/menu/meals/\(mealId)", operationID: "swapMenuMeal",
                           body: EvadRecipeChoiceBody(recipeId: recipeId))
    }

    public func recipes() async throws(PlanFetchError) -> [EvadRecipeOption] {
        try await raw.get("/api/seasons/recipes", operationID: "listSeasonRecipes")
    }

    public func putRecipes(id: String, recipeIds: [String]) async throws(PlanFetchError) -> EvadSeason {
        try await raw.send(.put, "/api/seasons/\(id)/recipes", operationID: "putSeasonRecipes",
                           body: EvadRecipeIdsBody(recipeIds: recipeIds))
    }

    /// `.notFound` = that week has no list (its menu is not approved).
    public func shoppingList(weekStart: String) async throws(PlanFetchError) -> EvadShoppingList {
        try await raw.get("/api/seasons/shopping?weekStart=\(weekStart)", operationID: "getShoppingList")
    }

    public func shoppingLists() async throws(PlanFetchError) -> [EvadShoppingListSummary] {
        try await raw.get("/api/seasons/shopping/lists", operationID: "listShoppingLists")
    }

    public func check(itemId: String, checked: Bool) async throws(PlanFetchError) -> EvadShoppingItem {
        try await raw.send(.put, "/api/seasons/shopping/items/\(itemId)", operationID: "checkShoppingItem",
                           body: EvadCheckBody(checked: checked))
    }

    public func toggleStaple(listId: String, name: String, on: Bool) async throws(PlanFetchError) -> EvadShoppingList {
        try await raw.send(.post, "/api/seasons/shopping/\(listId)/staples", operationID: "toggleShoppingStaple",
                           body: EvadStapleToggleBody(name: name, on: on))
    }

    public func staples() async throws(PlanFetchError) -> EvadStaples {
        try await raw.get("/api/seasons/staples", operationID: "listStaples")
    }

    public func putStaples(_ names: [String]) async throws(PlanFetchError) -> EvadStaples {
        try await raw.send(.put, "/api/seasons/staples", operationID: "putStaples", body: EvadStaples(names: names))
    }

    // MARK: - S4: experiments (the Hatás tab)

    /// The open proposal, the running experiment and the finished ones. The server finishes a running experiment whose
    /// window is over and runs its proposal detector first. `.notFound` = no active season.
    public func experiments() async throws(PlanFetchError) -> EvadExperiments {
        try await raw.get("/api/seasons/experiments", operationID: "listExperiments")
    }

    /// „Új kísérlet" / „Újra kipróbálom" — runs from today. `.conflict("EXPERIMENT_ALREADY_RUNNING")` while one runs.
    public func createExperiment(_ c: EvadExperimentCreate) async throws(PlanFetchError) -> EvadExperiment {
        try await raw.send(.post, "/api/seasons/experiments", operationID: "createExperiment", body: c)
    }

    /// „Indulhat" on Boop's proposal — runs from today.
    public func startExperiment(id: String) async throws(PlanFetchError) -> EvadExperiment {
        try await raw.get(method: .post, "/api/seasons/experiments/\(id)/start", operationID: "startExperiment")
    }

    /// Marks (or unmarks) one day of the running experiment (`yyyy-MM-dd`, inside the window, never in the future).
    public func markExperimentDay(id: String, date: String, done: Bool) async throws(PlanFetchError) -> EvadExperiment {
        try await raw.send(.put, "/api/seasons/experiments/\(id)/days", operationID: "markExperimentDay",
                           body: EvadExperimentMarkBody(date: date, done: done))
    }

    /// „Most nem" on a proposal, „Leállítom" on a running one. Idempotent.
    public func dismissExperiment(id: String) async throws(PlanFetchError) -> EvadExperiment {
        try await raw.get(method: .post, "/api/seasons/experiments/\(id)/dismiss", operationID: "dismissExperiment")
    }

    /// „Megtartom szokásnak" — a finished experiment becomes a season rule line. Idempotent.
    public func keepExperiment(id: String) async throws(PlanFetchError) -> EvadExperiment {
        try await raw.get(method: .post, "/api/seasons/experiments/\(id)/keep", operationID: "keepExperiment")
    }
}

/// What a failed Évad call says to him, in his words.
public func evadErrorText(_ error: PlanFetchError) -> String {
    switch error {
    case .offline: "Ehhez internet kell. Próbáld újra, ha lesz net."
    case .unauthorized: "Lejárt a belépésed. Lépj be újra."
    case .notFound: "Ezt az évadot már nem találom a szerveren."
    case .rejected: "A szerver ezt így nem fogadta el."
    case .conflict(let code):
        switch code {
        case "SEASON_PREVIEW_STALE": "Közben változott valami, újraszámoltam."
        case "SEASON_NOT_EDITABLE": "Ez az évad már lezárult, ezért nem változtatható."
        case "SEASON_ACTIVE_EXISTS": "Már fut egy évadod."
        case "SEASON_PROFILE_REQUIRED": "Az évad számaihoz előbb a testadataid kellenek (magasság, születési dátum, nem)."
        case "SEASON_BLOCK_NEEDS_GYM_DAY": "Amíg fut az edzésblokk, legalább egy edzésnap kell."
        case "MENU_NOT_PROPOSED": "Ezt a menüt már jóváhagytad, ezért nem állítom össze újra."
        case "EXPERIMENT_ALREADY_RUNNING": "Már fut egy kísérlet. Egyszerre csak egy futhat, hogy tiszta legyen az eredmény."
        case "EXPERIMENT_NOT_PROPOSED": "Ez a javaslat már nem aktuális."
        case "EXPERIMENT_NOT_RUNNING": "Ez a kísérlet már nem fut."
        case "EXPERIMENT_NOT_DONE": "Csak egy befejezett kísérletet lehet megtartani."
        default: "A szerver ezt most nem fogadta el."
        }
    // Train's running-workout refusal: an Évad accept that would drop a block day whose workout is running.
    case .dayWorkoutRunning: "Épp fut az edzésed. Ha végeztél, próbáld újra."
    case .server: "A szerver most nem válaszolt rendesen. Próbáld újra."
    }
}
