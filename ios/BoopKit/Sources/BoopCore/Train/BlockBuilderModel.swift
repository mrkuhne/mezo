import Foundation
import Observation

// The screen models of the block builder and the weekly review (mezo-r36n9.83). The builder reads the block and the
// catalog once, keeps an editable draft, and asks the server's evaluator after every edit (debounced) — the screens
// show only the evaluator's numbers. A failed evaluation keeps the last good one on screen, marked as not refreshed.

@MainActor @Observable
public final class BlockBuilderModel {
    public enum Phase: Equatable {
        case loading
        /// He has no running block: the builder has nothing to edit.
        case noBlock
        case failed(PlanFetchError)
        case ready
    }

    public enum SaveState: Equatable {
        case idle, saving, saved
        /// What was saved before the failure, in his words, and why it stopped.
        case failed(saved: [String], error: PlanFetchError)
    }

    public private(set) var phase: Phase = .loading
    public var draft: BlockDraft? { didSet { if draft != oldValue, phase == .ready { scheduleEvaluation() } } }
    public private(set) var original: BlockDraft?
    public private(set) var evaluation: WireEvaluation?
    /// True while the evaluation on screen belongs to an older draft (refresh failed or pending).
    public private(set) var evaluationStale = false
    public private(set) var evaluationError: PlanFetchError?
    public private(set) var saveState: SaveState = .idle

    private let client: PlanClient
    private let debounce: Duration
    private var evaluationTask: Task<Void, Never>?
    private var catalog: [WireCatalogItem] = []

    public init(client: PlanClient, debounce: Duration = .milliseconds(300)) {
        self.client = client
        self.debounce = debounce
    }

    // MARK: loading

    public func load() async {
        phase = .loading
        do {
            async let block = client.runningBlock()
            async let items = client.catalog()
            guard let b = try await block else { phase = .noBlock; return }
            catalog = (try? await items) ?? []
            let d = BlockDraft(block: b, catalog: catalog)
            original = d
            draft = d
            phase = .ready
            await evaluateNow()
        } catch let e as PlanFetchError {
            phase = .failed(e)
        } catch {
            phase = .failed(.server)
        }
    }

    // MARK: evaluation

    public var hasChanges: Bool {
        guard let draft, let original else { return false }
        return !draft.changes(since: original).isEmpty
    }

    /// The muscles outside their band in the latest evaluation, in body order.
    public var outside: [WireMuscleEvaluation] {
        (evaluation?.muscles ?? []).filter { $0.fit != "inside" }.sorted {
            (WeekReview.bodyOrder.firstIndex(of: $0.muscle) ?? .max) < (WeekReview.bodyOrder.firstIndex(of: $1.muscle) ?? .max)
        }
    }

    /// The muscles with a band, in body order.
    public var bandedMuscles: [WireMuscleEvaluation] {
        (evaluation?.muscles ?? []).sorted {
            (WeekReview.bodyOrder.firstIndex(of: $0.muscle) ?? .max) < (WeekReview.bodyOrder.firstIndex(of: $1.muscle) ?? .max)
        }
    }

    public func muscle(_ key: String) -> WireMuscleEvaluation? { evaluation?.muscles.first { $0.muscle == key } }
    public func day(_ index: Int) -> WireDayEvaluation? { evaluation?.days.first { $0.dayIndex == index } }

    /// A muscle's sets on one day, from the evaluator's spread.
    public func sets(_ muscle: String, day: Int) -> Int {
        self.muscle(muscle)?.spread.first { $0.dayIndex == day }?.sets ?? 0
    }

    private func scheduleEvaluation() {
        evaluationStale = true
        evaluationTask?.cancel()
        let wait = debounce
        evaluationTask = Task { [weak self] in
            try? await Task.sleep(for: wait)
            guard !Task.isCancelled else { return }
            await self?.evaluateNow()
        }
    }

    public func evaluateNow() async {
        guard let draft else { return }
        let request = draft.evaluateRequest()
        do {
            let result = try await client.evaluate(request)
            // A newer edit already asked again; this answer belongs to an older draft.
            guard self.draft?.evaluateRequest() == request else { return }
            evaluation = result
            evaluationStale = false
            evaluationError = nil
        } catch {
            evaluationError = error
            evaluationStale = evaluation != nil
        }
    }

    // MARK: edits the screens call

    public func applyProposal(_ muscle: String) {
        guard let edits = self.muscle(muscle)?.proposal, !edits.isEmpty else { return }
        draft?.apply(edits)
    }

    /// „Igazítsd a sávba": every muscle outside its band takes its proposal. Edits never collide (one muscle's
    /// proposal touches only its own exercises).
    public func applyAllProposals() {
        let edits = outside.flatMap(\.proposal)
        guard !edits.isEmpty else { return }
        draft?.apply(edits)
    }

    // MARK: saving

    /// Writes only what changed, in this order: block settings → (re-read) → tiers → days. Stops at the first failure
    /// and says what was saved. A save while offline is refused up front by the screen.
    public func save() async {
        guard let draft, let original else { return }
        let changes = draft.changes(since: original)
        guard !changes.isEmpty else { saveState = .saved; return }
        saveState = .saving
        var saved: [String] = []
        var working = draft
        do {
            if changes.settings {
                let request = WireSettingsRequest(trainingStyle: changes.style ? draft.style?.rawValue : nil,
                                                  techniquesEnabled: changes.techniquesEnabled ? draft.techniquesEnabled : nil,
                                                  weeklyReviewMode: changes.reviewMode ? draft.reviewMode.rawValue : nil)
                let fresh = try await client.saveSettings(blockId: draft.blockId, request)
                saved.append("az edzésmód és a beállítások")
                // A new style re-stamps the rows: carry the set and technique edits onto what the server now holds.
                working = draft.carryEdits(onto: BlockDraft(block: fresh, catalog: catalog))
            }
            if changes.tiers || changes.sportGroups {
                try await client.savePriorities(blockId: working.blockId,
                                                WirePrioritiesRequest(musclePriorities: working.prioritiesWire, sportGroups: working.sportGroups))
                saved.append("az izmok szintje")
            }
            for index in changes.days where working.days.indices.contains(index) {
                let day = working.days[index]
                try await client.saveDay(blockId: working.blockId, dayId: day.id, working.dayInput(day, forSave: true).exercises)
                saved.append(day.name.lowercased())
            }
            saveState = .saved
            await reload()
        } catch {
            saveState = .failed(saved: saved, error: error)
            if !saved.isEmpty { await reload() }
        }
    }

    /// Re-read the block after a save so the next edit starts from what the server holds (a day save re-mints ids).
    private func reload() async {
        guard let block = try? await client.runningBlock() else { return }
        let fresh = BlockDraft(block: block, catalog: catalog)
        original = fresh
        draft = fresh
        await evaluateNow()
    }

    public func resetSaveState() { if case .saving = saveState { return }; saveState = .idle }
}

@MainActor @Observable
public final class WeekReviewModel {
    public enum Phase: Equatable {
        case loading
        /// No running block, or no proposal this week.
        case nothing
        case failed(PlanFetchError)
        case ready
    }

    public private(set) var phase: Phase = .loading
    public var review: WeekReview?
    public private(set) var sending = false
    public private(set) var sendError: PlanFetchError?
    /// The block the proposal belongs to (title for the head).
    public private(set) var blockTitle: String?

    private let client: PlanClient

    public init(client: PlanClient) { self.client = client }

    public func load() async {
        phase = .loading
        do {
            guard let block = try await client.runningBlock() else { phase = .nothing; return }
            blockTitle = block.shortTitle ?? block.title
            let proposals = try await client.weekProposals(blockId: block.id)
            // The weekly one first (the server lists it first); a lone tier change is reviewed the same way.
            guard let p = proposals.first(where: { $0.kind == "weekly" }) ?? proposals.first else { phase = .nothing; return }
            review = WeekReview(p)
            phase = .ready
        } catch {
            phase = .failed(error)
        }
    }

    /// Sends the summary card's decisions (or "accept everything"). Returns true on success.
    @discardableResult
    public func submit(_ request: WireDecisionRequest) async -> Bool {
        guard let review, review.isOpen else { return false }
        sending = true
        defer { sending = false }
        do {
            let updated = try await client.decide(blockId: review.blockId, proposalId: review.proposalId, request)
            self.review = WeekReview(updated)
            sendError = nil
            return true
        } catch {
            sendError = error
            // The week closed under him: re-read so the screen shows what is true now.
            if case .conflict = error { await load() }
            return false
        }
    }

    public func submitFinal() async -> Bool { guard let review else { return false }; return await submit(review.finalRequest()) }
    public func acceptEverything() async -> Bool { await submit(WeekReview.acceptEverything) }
}
