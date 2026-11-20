import Foundation

// Pénz L7 (`mezo-r36n9.105`): the Gyakorlás overview, the proposals, the catalog and the strategy on `PenzStore`.
//
// Each reads on its own, when its screen asks — never inside the snapshot read, so a fault here never takes the week's
// remaining with it. Reads follow the store's rule (offline is an answer: the cache with its age; a fault is said as
// itself). Every write is online, re-reads what it changed, and answers with his sentence or nil.

extension PenzStore {
    // MARK: - Reading

    /// Gyakorlás. Without `force` it reads once (and again while the last attempt found no net or a fault).
    public func loadPractice(force: Bool = false) async {
        guard let client else {
            if practice == nil { practiceProblem = .unauthorized }
            return
        }
        let retryable = practiceProblem == nil || practiceProblem == .offline || practiceProblem == .server
        guard force || (practice == nil && retryable) else { return }
        let r = await Self.attempt { try await client.practice() }
        (practice, practiceProblem, practiceOffline) = await settle(r, current: practice, endpoint: Self.practiceEndpoint,
                                                                   key: Self.key)
    }

    /// The full journal (its page).
    public func loadJournal() async {
        guard let client else { journalProblem = .unauthorized; return }
        switch await Self.attempt({ try await client.practiceTrades() }) {
        case .success(let trades): journal = trades; journalProblem = nil
        case .failure(let e): journalProblem = e
        }
    }

    /// Every proposal (Pénz Ma's cards and the plans he is ticking).
    public func loadProposals(force: Bool = false) async {
        guard let client else {
            if proposals == nil { proposalsProblem = .unauthorized }
            return
        }
        let retryable = proposalsProblem == nil || proposalsProblem == .offline || proposalsProblem == .server
        guard force || (proposals == nil && retryable) else { return }
        let r = await Self.attempt { try await client.proposals() }
        (proposals, proposalsProblem, proposalsOffline) = await settle(r, current: proposals, endpoint: Self.proposalsEndpoint,
                                                                      key: Self.key)
    }

    /// The Termékjegyzék.
    public func loadCatalog() async {
        guard let client else {
            if catalog == nil { catalogProblem = .unauthorized }
            return
        }
        let r = await Self.attempt { try await client.catalog() }
        (catalog, catalogProblem, catalogOffline) = await settle(r, current: catalog, endpoint: Self.catalogEndpoint, key: Self.key)
    }

    /// *Havi stratégia*: the figure and its inputs (online — it is asked for while he looks).
    public func loadStrategy() async {
        guard let client else { strategyProblem = .unauthorized; return }
        switch await Self.attempt({ try await client.strategy() }) {
        case .success(let s): strategy = s; strategyProblem = nil
        case .failure(let e): strategyProblem = e
        }
    }

    // MARK: - What the screens read

    /// "3 órás adat" for Gyakorlás when it is drawn from an older read.
    public var practiceAgeText: String? { penzAgeText(practice.map { clock().timeIntervalSince($0.fetchedAt) }) }
    public var proposalsAgeText: String? { penzAgeText(proposals.map { clock().timeIntervalSince($0.fetchedAt) }) }
    /// The proposals waiting for his answer.
    public var openProposals: [PenzProposal] { penzOpenProposals(proposals?.value ?? []) }
    /// The accepted plans he has not finished ticking.
    public var activePlans: [PenzProposal] { penzActivePlans(proposals?.value ?? []) }
    public func proposal(id: String) -> PenzProposal? { proposals?.value.first { $0.id == id } }

    // MARK: - Practice writes

    /// A new plan (and, with an entry, opened at once). The cap refusal comes back as the sentence with what still fits.
    public func createTrade(_ request: PenzTradeRequest) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.createTrade(request) } catch { return await practiceError(error) }
        await loadPractice(force: true)
        return nil
    }

    public func openTrade(id: String, entryMinor: Int64, date: String) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.openTrade(id: id, PenzTradeOpenRequest(entryMinor: entryMinor, entryDate: date)) } catch {
            return await practiceError(error)
        }
        await loadPractice(force: true)
        return nil
    }

    public func closeTrade(id: String, _ request: PenzTradeCloseRequest) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.closeTrade(id: id, request) } catch { return await practiceError(error) }
        await loadPractice(force: true)
        if journal != nil { await loadJournal() }
        return nil
    }

    public func recordLastClose(id: String, closeMinor: Int64, date: String) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.recordLastClose(id: id, PenzLastCloseRequest(closeMinor: closeMinor, date: date)) } catch {
            return await practiceError(error)
        }
        await loadPractice(force: true)
        return nil
    }

    /// *Elvetem*: a plan he will not trade.
    public func cancelTrade(id: String) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.cancelTrade(id: id) } catch { return await practiceError(error) }
        await loadPractice(force: true)
        if journal != nil { await loadJournal() }
        return nil
    }

    /// The cap refusal says what still fits — read from a fresh overview, so the figure is the server's now.
    private func practiceError(_ error: PlanFetchError) async -> String {
        if error == .rejected("PENZ_PRACTICE_CAP_EXCEEDED") || error == .conflict("PENZ_PRACTICE_CAP_EXCEEDED") {
            await loadPractice(force: true)
            return penzCapExceededText(practice?.value.cap)
        }
        return penzErrorText(error)
    }

    // MARK: - Proposal writes

    /// Asks for a proposal (a lump sum, or the monthly strategy). The new proposal, or his sentence.
    public func createProposal(_ request: PenzProposalRequest) async -> Result<PenzProposal, PenzStoreRefusal> {
        guard let client else { return .failure(PenzStoreRefusal(penzErrorText(.unauthorized))) }
        do {
            let p = try await client.createProposal(request)
            await loadProposals(force: true)
            // the list read failed: the page still opens on the answer itself
            if proposal(id: p.id) == nil {
                proposals = Cached(value: [p] + (proposals?.value ?? []), fetchedAt: clock(), age: 0)
            }
            return .success(p)
        } catch {
            return .failure(PenzStoreRefusal(penzProposalCreateErrorText(error, kind: request.kind)))
        }
    }

    /// *Elfogadom* with his numbers; the plan checklist comes back on the proposal.
    public func acceptProposal(id: String, drafts: [PenzSleeveDraft]) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.acceptProposal(id: id, penzAcceptRequest(drafts)) } catch { return penzErrorText(error) }
        await loadProposals(force: true)
        return nil
    }

    /// *Most nem*.
    public func dismissProposal(id: String) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.dismissProposal(id: id) } catch { return penzErrorText(error) }
        await loadProposals(force: true)
        return nil
    }

    /// He ticks (or unticks) a step of his plan. Nothing is recorded in Pénzem: the real buy goes through
    /// *Befektetést rögzítek*.
    public func setStep(proposalId: String, index: Int, done: Bool) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.setProposalStep(id: proposalId, index: index, done: done) } catch { return penzErrorText(error) }
        await loadProposals(force: true)
        return nil
    }

    // MARK: - Catalog writes

    public func approveProduct(id: String) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.approveProduct(id: id) } catch { return penzErrorText(error) }
        await loadCatalog()
        return nil
    }

    public func declineProduct(id: String) async -> String? {
        guard let client else { return penzErrorText(.unauthorized) }
        do { _ = try await client.declineProduct(id: id) } catch { return penzErrorText(error) }
        await loadCatalog()
        return nil
    }
}

/// A refused write, as the sentence he reads.
public struct PenzStoreRefusal: Error, Equatable, Sendable {
    public let text: String
    public init(_ text: String) { self.text = text }
}

/// A refused *ask for a proposal*: the server's 400 `PENZ_PROPOSAL_AMOUNT_INVALID` here means the amount itself (under
/// 1 000 Ft, or a monthly figure of 0), not a sleeve he set — so it is said for what he just asked.
public func penzProposalCreateErrorText(_ error: PlanFetchError, kind: String) -> String {
    guard error == .rejected("PENZ_PROPOSAL_AMOUNT_INVALID") else { return penzErrorText(error) }
    return kind == "monthly"
        ? "Ebben a hónapban most nem marad szabad összeg, amit befektetésre feloszthatnék — ezért havi javaslatot sem tudok adni."
        : "Ezt az összeget nem tudom felosztani: legalább 1\u{202F}000\u{00A0}Ft kell hozzá."
}
