import Foundation
import HTTPTypes

/// The Pénz area's server calls (L5, `mezo-r36n9.103`), over the same hand-written JSON caller the block builder
/// uses (`RawJSONClient`): lenient wire types, typed failures (`PlanFetchError`). Paths and operation ids are the
/// contract's own (`api/feature/penz/penz.yml`; the savings goals are the L5 server half's).
///
/// Every write here is **online**: he is looking at the answer. The one write that must work without the net — a
/// cash expense — goes through the outbox instead (`OutboxKind.penzExpense`, `PenzOutboxSender`).
public struct PenzClient: Sendable {
    let raw: RawJSONClient

    public init(raw: RawJSONClient) { self.raw = raw }

    // MARK: - Reads

    /// The allowance for the month and week containing `date` (`YYYY-MM-DD`); nil = today on the server.
    public func allowance(date: String? = nil) async throws(PlanFetchError) -> PenzAllowance {
        try await raw.get("/api/penz/allowance" + (date.map { "?date=\($0)" } ?? ""), operationID: "getPenzAllowance")
    }

    /// One month's transactions (`YYYY-MM`), newest first.
    public func transactions(month: String) async throws(PlanFetchError) -> [PenzTransaction] {
        try await raw.get("/api/penz/transactions?month=\(month)", operationID: "listPenzTransactions")
    }

    public func categories() async throws(PlanFetchError) -> [PenzCategory] {
        try await raw.get("/api/penz/categories", operationID: "listPenzCategories")
    }

    public func accounts() async throws(PlanFetchError) -> [PenzAccount] {
        try await raw.get("/api/penz/accounts", operationID: "listPenzAccounts")
    }

    /// Past months with transactions and no close, oldest first, with the figures a close would store now.
    public func openMonths() async throws(PlanFetchError) -> [PenzMonthClose] {
        try await raw.get("/api/penz/month-closes/open", operationID: "listOpenPenzMonths")
    }

    public func settings() async throws(PlanFetchError) -> PenzSettings {
        try await raw.get("/api/penz/settings", operationID: "getPenzSettings")
    }

    public func goals() async throws(PlanFetchError) -> [PenzGoal] {
        try await raw.get("/api/penz/savings-goals", operationID: "listPenzSavingsGoals")
    }

    // MARK: - Writes (online)

    public func saveSettings(_ request: PenzSettingsRequest) async throws(PlanFetchError) -> PenzSettings {
        try await raw.send(.put, "/api/penz/settings", operationID: "putPenzSettings", body: request)
    }

    public func updateTransaction(id: String, _ request: PenzTransactionRequest) async throws(PlanFetchError) -> PenzTransaction {
        try await raw.send(.put, "/api/penz/transactions/\(id)", operationID: "updatePenzTransaction", body: request)
    }

    /// Clears `needsReview`.
    public func markReviewed(id: String) async throws(PlanFetchError) -> PenzTransaction {
        try await raw.get(method: .post, "/api/penz/transactions/\(id)/reviewed", operationID: "markPenzTransactionReviewed")
    }

    /// The review sheet's "Rendben": the category he chose, then the reviewed flag — in that order, so a row is never
    /// marked looked-at with the category it was doubted for.
    public func confirm(_ t: PenzTransaction, categoryId: String?) async throws(PlanFetchError) -> PenzTransaction {
        if categoryId != t.categoryId {
            _ = try await updateTransaction(id: t.id, PenzTransactionRequest(updating: t, categoryId: categoryId))
        }
        return try await markReviewed(id: t.id)
    }

    /// Closes a past month: `transferred` (to the savings-target account), `kept`, or `none` (a deficit).
    public func closeMonth(_ month: String, leftoverAction: String) async throws(PlanFetchError) -> PenzMonthClose {
        try await raw.send(.post, "/api/penz/month-closes/\(month)", operationID: "closePenzMonth",
                           body: PenzMonthCloseRequest(leftoverAction: leftoverAction))
    }

    public func createAccount(_ request: PenzAccountRequest) async throws(PlanFetchError) -> PenzAccount {
        try await raw.send(.post, "/api/penz/accounts", operationID: "createPenzAccount", body: request)
    }

    public func createGoal(_ request: PenzGoalRequest) async throws(PlanFetchError) -> PenzGoal {
        try await raw.send(.post, "/api/penz/savings-goals", operationID: "createPenzSavingsGoal", body: request)
    }

    public func updateGoal(id: String, _ request: PenzGoalRequest) async throws(PlanFetchError) -> PenzGoal {
        try await raw.send(.put, "/api/penz/savings-goals/\(id)", operationID: "updatePenzSavingsGoal", body: request)
    }

    public func deleteGoal(id: String) async throws(PlanFetchError) {
        _ = try await raw.sendRaw(.delete, "/api/penz/savings-goals/\(id)", operationID: "deletePenzSavingsGoal")
    }
}

extension RawJSONClient {
    /// A call with no request body whose answer is decoded (a POST like `…/reviewed`).
    func get<T: Decodable>(method: HTTPRequest.Method, _ path: String, operationID: String,
                           as: T.Type = T.self) async throws(PlanFetchError) -> T {
        let data = try await sendRaw(method, path, operationID: operationID)
        do { return try PlanJSON.decoder.decode(T.self, from: data) } catch { throw .server }
    }
}

/// What a failed Pénz write says to him, in his words — the server's own code where it sent one.
public func penzErrorText(_ error: PlanFetchError) -> String {
    switch error {
    case .offline: "Most nincs net. Próbáld újra, ha lesz."
    case .unauthorized: "Lejárt a belépésed. Lépj be újra."
    case .notFound: "Ezt a tételt már nem találom a szerveren."
    case .rejected(let code), .conflict(let code):
        switch code {
        case "PENZ_NO_SAVINGS_TARGET_ACCOUNT": "Nincs megtakarítási számla megjelölve, ezért átvezetni nem tudom. Hagyd itt a maradékot, vagy jelölj meg egy számlát."
        case "PENZ_EARLIER_MONTH_OPEN": "Előbb egy korábbi hónapot kell lezárni — a hónapok sorban zárulnak."
        case "PENZ_MONTH_ALREADY_CLOSED": "Ezt a hónapot már lezártad."
        case "PENZ_MONTH_NOT_OVER": "Ez a hónap még nem ért véget."
        case "PENZ_CURRENCY_MISMATCH": "A pénznem nem egyezik a befektetés pénznemével, így ezt most nem tudom elvégezni."
        case "PENZ_SYMBOL_UNKNOWN": "Ezt a jelet nem ismeri az árfolyamforrás. Nézd meg, jól írtad-e (például OTP.BD vagy VWCE.DE), vagy hagyd üresen, és a vételárán számolom."
        case "PENZ_SELL_EXCEEDS_POSITION": "Ennyit nem adhatsz el belőle: több lenne, mint amennyi a nyilvántartás szerint van belőle."
        case "PENZ_FX_UNAVAILABLE": "Arra a napra most nem érem el a hivatalos árfolyamot, ezért nem tudom forintra váltani. Próbáld újra kicsit később."
        case "PENZ_HOLDING_NOT_FOUND": "Ezt a befektetést már nem találom a szerveren."
        // L7 — practice, catalog, proposals
        case "PENZ_PRACTICE_CAP_EXCEEDED": penzCapExceededText(nil)
        case "PENZ_PAPER_TRADE_NOT_FOUND": "Ezt a kereskedést már nem találom a szerveren."
        case "PENZ_PAPER_TRADE_STATE": "Ez a lépés ennél a kereskedésnél már nem lehetséges — frissítsd az oldalt."
        case "PENZ_PAPER_TRADE_INVALID_STOP": "A stop rossz oldalon van: hosszú kereskedésnél a belépő alatt, rövidnél fölötte kell lennie."
        case "PENZ_PRACTICE_TAG_UNKNOWN": "Ezt a címkét nem ismerem. Válassz a nyolc közül."
        case "PENZ_PRODUCT_NOT_FOUND": "Ezt a terméket már nem találom a termékjegyzékben."
        case "PENZ_PRODUCT_NOT_APPROVED": "Ez a termék már nincs jóváhagyva, ezért nem kerülhet a tervbe. Válassz másikat, vagy hagyd jóvá újra a termékjegyzékben."
        case "PENZ_PROPOSAL_NOT_FOUND": "Ezt a javaslatot már nem találom."
        case "PENZ_PROPOSAL_STATE": "Ezt a javaslatot már elfogadtad, félretetted, vagy egy újabb váltotta fel."
        case "PENZ_PROPOSAL_AMOUNT_INVALID": "Ez az összeg így nem jó: minden rekesz nulla vagy több legyen, és legalább egybe kerüljön valami."
        default: "A szerver ezt most nem fogadta el."
        }
    case .server, .dayWorkoutRunning: "A szerver most nem válaszolt rendesen. Próbáld újra."
    }
}
