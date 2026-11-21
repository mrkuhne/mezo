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
    public var draft: BlockDraft? { didSet { if draft != oldValue, phase == .ready, !replacing { scheduleEvaluation() } } }
    public private(set) var original: BlockDraft?
    public private(set) var evaluation: WireEvaluation?
    /// True while the evaluation on screen belongs to an older draft (refresh failed or pending).
    public private(set) var evaluationStale = false
    public private(set) var evaluationError: PlanFetchError?
    public private(set) var saveState: SaveState = .idle
    /// The weekly AI's one-line reasons, by exercise id (from this week's proposal lines that carry a note).
    public private(set) var aiNotes: [String: String] = [:]
    /// The day of today's open workout (started, not finished), as the caller knows it; its card is read-only
    /// (mezo-r36n9.116, spec §6.4). nil when nothing is running.
    public var lockedDay: LockedDay?
    /// The rows of a weekly proposal still waiting for his approval (from the proposals the load already read — the
    /// check never asks for a proposal to be generated): exercise ids and the weekday labels of their lines.
    private var pendingExerciseIds: Set<String> = []
    private var pendingWeekdays: Set<String> = []
    /// The day line-up (row keys per day) the evaluation on screen was computed for: its exercise indices address
    /// only that line-up.
    private var evaluatedLineup: [[String]]?

    private let client: PlanClient
    private let debounce: Duration
    private var evaluationTask: Task<Void, Never>?
    private var catalog: [WireCatalogItem] = []
    /// Set while the model itself swaps the draft (a re-read): that swap asks for one evaluation, not two.
    private var replacing = false

    public init(client: PlanClient, debounce: Duration = .milliseconds(300), lockedDay: LockedDay? = nil) {
        self.client = client
        self.debounce = debounce
        self.lockedDay = lockedDay
    }

    /// Today's open workout's template day: its id, else its weekday label (`Hét`…`Vas`).
    public struct LockedDay: Equatable, Sendable {
        public let dayId: String?
        public let weekday: String?
        public init(dayId: String?, weekday: String?) { self.dayId = dayId; self.weekday = weekday }
    }

    // MARK: loading

    /// Loads the block, the catalog and the first evaluation. A second call while one is on its way waits for it
    /// (the room preloads the builder; opening it mid-preload must not start over).
    public func load() async {
        if let inFlight = loadTask { await inFlight.value; return }
        let task = Task { await performLoad() }
        loadTask = task
        await task.value
        loadTask = nil
    }

    private var loadTask: Task<Void, Never>?

    private func performLoad() async {
        phase = .loading
        do {
            async let block = client.runningBlock()
            async let items = client.catalog()
            guard let b = try await block else { phase = .noBlock; return }
            catalog = (try? await items) ?? []
            // Best effort: the AI's sentences ride on the week's proposal; no proposal or no net is simply no sentence.
            if let proposals = try? await client.weekProposals(blockId: b.id) {
                aiNotes = proposals.flatMap(\.lines).reduce(into: [:]) { out, line in
                    if let note = line.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty { out[line.exerciseId] = note }
                }
                let waiting = proposals.filter { $0.status == "pending" }.flatMap(\.lines).filter { $0.decision == nil }
                pendingExerciseIds = Set(waiting.map { $0.exerciseId.lowercased() })
                pendingWeekdays = Set(waiting.compactMap { $0.dayName.map { String($0.prefix(3)).lowercased() } })
            }
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

    // MARK: the day editor (mezo-r36n9.116)

    /// The block's exercise catalogue, as loaded with the block (the add/swap sheets' full list).
    public var catalogList: [WireCatalogItem] { catalog }

    /// The index of the locked day in the draft (today's open workout), nil when none.
    public var lockedDayIndex: Int? {
        guard let lockedDay, let days = draft?.days else { return nil }
        if let id = lockedDay.dayId?.lowercased(), let i = days.firstIndex(where: { $0.id.lowercased() == id }) { return i }
        if let w = lockedDay.weekday.map({ String($0.prefix(3)).lowercased() }), !w.isEmpty,
           let i = days.firstIndex(where: { $0.weekday.prefix(3).lowercased() == w }) { return i }
        return nil
    }

    /// The days a waiting weekly proposal has lines on (indices of the saved line-up).
    public var pendingReviewDays: Set<Int> {
        guard let original, !(pendingExerciseIds.isEmpty && pendingWeekdays.isEmpty) else { return [] }
        return Set(original.days.indices.filter { i in
            let d = original.days[i]
            return d.exercises.contains { pendingExerciseIds.contains($0.id.lowercased()) }
                || pendingWeekdays.contains(String(d.weekday.prefix(3)).lowercased())
        })
    }

    /// Identities or order of the day changed against what is saved: the save is a structural replace.
    public func structurallyChanged(_ day: Int) -> Bool {
        guard let draft, let original, draft.days.indices.contains(day), original.days.indices.contains(day) else { return false }
        let now = draft.days[day].exercises, was = original.days[day].exercises
        return now.map(\.id) != was.map(\.id) || zip(now, was).contains { $0.identity != $1.identity }
    }

    /// Saving would replace a day a waiting weekly proposal has lines on: ask him first (spec §6.4).
    public var needsReviewConfirm: Bool { pendingReviewDays.contains { structurallyChanged($0) } }

    /// The weekly AI's sentence for a row — none once the row stands for another exercise.
    public func aiNote(_ exercise: DraftExercise) -> String? { exercise.identityChanged ? nil : aiNotes[exercise.id] }

    /// The evaluation's exercise indices still address the draft on screen (no add / remove / move / swap since).
    public var indicesFresh: Bool {
        guard evaluation != nil, let evaluatedLineup, let draft else { return false }
        return evaluatedLineup == Self.lineup(draft)
    }

    private static func lineup(_ d: BlockDraft) -> [[String]] { d.days.map { $0.exercises.map { "\($0.id)|\($0.identity)" } } }

    /// The add / swap sheets' suggestions (`mode` `add` with the picked fine tokens — none = the week's under-band
    /// groups — or a coarse muscle; `replace` with the outgoing row). The day goes as its weekday (0 = Monday) with its
    /// current catalogue ids, lower-cased; the tokens go in body order.
    public func suggest(mode: String, day: Int, outgoing: DraftExercise? = nil, muscle: String? = nil,
                        muscles: Set<String>? = nil) async throws(PlanFetchError) -> WireSuggestions {
        guard let draft, draft.days.indices.contains(day) else { throw .server }
        let d = draft.days[day]
        let request = WireSuggestionsRequest(
            mode: mode, dayIndex: d.weekdayIndex ?? day,
            outgoing: outgoing.map { WireSuggestionOutgoing(catalogId: $0.catalogId?.lowercased(), name: $0.name, muscle: $0.muscleKey, type: $0.type) },
            muscle: muscle, muscles: muscles.map(SubMuscles.ordered),
            dayCatalogIds: d.exercises.compactMap { $0.catalogId?.lowercased() })
        return try await client.suggestions(blockId: draft.blockId, request)
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

    /// The server's recommendation for one exercise of the draft, if it sent one.
    public func recommendation(day: Int, exercise: Int) -> TechniqueRecommendation? {
        // After an add / remove / move the indices point at other rows until the fresh evaluation lands.
        guard indicesFresh, let r = evaluation?.recommendations?.first(where: { $0.dayIndex == day && $0.exerciseIndex == exercise }),
              let t = SetTechnique(rawValue: r.technique) else { return nil }
        return TechniqueRecommendation(technique: t, reason: techniqueReasonText(r.reason), challengeFit: r.challengeFit ?? false)
    }
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
            evaluatedLineup = Self.lineup(draft)
            evaluationStale = false
            evaluationError = nil
        } catch {
            // A late failure of an older draft must not mark a newer, good answer as stale.
            guard self.draft?.evaluateRequest() == request else { return }
            evaluationError = error
            evaluationStale = evaluation != nil
        }
    }

    // MARK: edits the screens call

    /// Proposals may be applied only against a fresh evaluation: until the server has answered for the edited draft the
    /// old proposal would be added a second time.
    public var canApplyProposals: Bool { !evaluationStale && indicesFresh && saveState != .saving }

    /// A muscle's proposal edits that may be applied now: none on the day of today's open workout (its card is
    /// read-only, ruling R11).
    public func applicableEdits(_ muscle: String) -> [WireEdit] {
        let locked = lockedDayIndex
        return (self.muscle(muscle)?.proposal ?? []).filter { $0.dayIndex != locked }
    }

    /// The muscle has a proposal, but every edit of it falls on the locked day: nothing new is possible today.
    public func proposalOnlyOnLockedDay(_ muscle: String) -> Bool {
        !(self.muscle(muscle)?.proposal ?? []).isEmpty && applicableEdits(muscle).isEmpty
    }

    public func applyProposal(_ muscle: String) {
        let edits = applicableEdits(muscle)
        guard canApplyProposals, !edits.isEmpty else { return }
        draft?.apply(edits)
    }

    /// „Igazítsd a sávba": every muscle outside its band takes its proposal. Edits never collide (one muscle's
    /// proposal touches only its own exercises).
    public func applyAllProposals() {
        guard canApplyProposals else { return }
        let edits = outside.flatMap { applicableEdits($0.muscle) }
        guard !edits.isEmpty else { return }
        draft?.apply(edits)
    }

    // MARK: saving

    /// Writes only what changed, in this order: block settings → (re-read) → tiers → days. Stops at the first failure,
    /// says what was saved, and keeps every edit that was not saved on screen so he can try again.
    public func save() async {
        guard let draft, let original else { return }
        guard !draft.changes(since: original).isEmpty else { saveState = .saved; return }
        saveState = .saving
        // The re-read after the save evaluates; a pending debounced evaluation of the pre-save draft is moot.
        evaluationTask?.cancel()
        var saved: [String] = []
        var working = draft
        var base = original
        do {
            let settingsChanged = draft.changes(since: original).settings
            if settingsChanged {
                let c = draft.changes(since: original)
                let request = WireSettingsRequest(trainingStyle: c.style ? draft.style?.rawValue : nil,
                                                  techniquesEnabled: c.techniquesEnabled ? draft.techniquesEnabled : nil,
                                                  weeklyReviewMode: c.reviewMode ? draft.reviewMode.rawValue : nil)
                let fresh = BlockDraft(block: try await client.saveSettings(blockId: draft.blockId, request), catalog: catalog)
                saved.append("az edzésmód és a beállítások")
                // A new style re-stamps the rows: his edits move onto what the server now holds, and what is left to save
                // is measured against that.
                working = draft.carryEdits(onto: fresh, original: original)
                base = fresh
            }
            let rest = working.changes(since: base)
            if rest.tiers || rest.sportGroups {
                try await client.savePriorities(blockId: working.blockId,
                                                WirePrioritiesRequest(musclePriorities: working.prioritiesWire, sportGroups: working.sportGroups))
                saved.append("az izmok szintje")
            }
            for index in rest.days where working.days.indices.contains(index) {
                let day = working.days[index]
                try await client.saveDay(blockId: working.blockId, dayId: day.id, working.dayInput(day, forSave: true).exercises)
                saved.append(day.name.lowercased())
            }
            saveState = .saved
            await reload(keeping: nil)
        } catch {
            saveState = .failed(saved: saved, error: error)
            await reload(keeping: (draft, original))
        }
    }

    /// Re-read the block so the next edit starts from what the server holds (a day save may re-mint ids). With
    /// `keeping`, the edits that did not reach the server are carried onto the fresh read.
    private func reload(keeping: (draft: BlockDraft, original: BlockDraft)?) async {
        guard let block = try? await client.runningBlock() else { return }
        let fresh = BlockDraft(block: block, catalog: catalog)
        replacing = true
        original = fresh
        draft = keeping.map { $0.draft.carryEdits(onto: fresh, original: $0.original) } ?? fresh
        replacing = false
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
            guard let block = try await client.runningBlock() else { review = nil; phase = .nothing; return }
            blockTitle = block.shortTitle ?? block.title
            let proposals = try await client.weekProposals(blockId: block.id)
            // What still waits for him first (a pending tier change after the weekly one was applied must stay reachable),
            // then this week's weekly one, then anything.
            guard let p = proposals.first(where: { $0.status == "pending" }) ?? proposals.first(where: { $0.kind == "weekly" }) ?? proposals.first
            else { review = nil; phase = .nothing; return }
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

/// What the picker shows as „Boop ajánlása" for one exercise.
public struct TechniqueRecommendation: Equatable, Sendable {
    public let technique: SetTechnique
    /// One Hungarian sentence on why.
    public let reason: String
    public let challengeFit: Bool
}

/// The Hungarian sentence for a recommendation reason code; a known-generic sentence for a code this build does not know.
public func techniqueReasonText(_ code: String?) -> String {
    switch code ?? "" {
    case "stable_machine": "Gépen vagy kábelen stabil: a bukásig vitt sorozat után egy rövid pihenővel biztonságosan folytatható."
    case "isolation_pump": "Kis izomra ható, magas ismétlésszámú gyakorlat: a rövid pihenős mini-sorozatok itt adnak a legtöbbet."
    case "lengthened_safe": "A nyújtott helyzet itt biztonságos, és ott nő az izom a legjobban: a félismétlés ide illik."
    case "all_out": "Ezt a gyakorlatot már eleve bukásig viszed, ezért plusz technika nem kell rá."
    case "no_safe_technique": "Stabil, de egyik technika sem biztonságos rajta — maradj a sima sorozatoknál."
    default: "Ehhez a gyakorlathoz ez illik a legjobban a tulajdonságai alapján."
    }
}
