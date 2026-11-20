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
        case "SEASON_BLOCK_DAYS_LOCKED": "Amíg fut az edzésblokk, az edzésnapok nem változhatnak."
        default: "A szerver ezt most nem fogadta el."
        }
    // Train's day-save refusal; no Évad call returns it, but the error type is shared.
    case .dayWorkoutRunning: "Épp fut az edzésed. Ha végeztél, próbáld újra."
    case .server: "A szerver most nem válaszolt rendesen. Próbáld újra."
    }
}
