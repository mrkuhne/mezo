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
    /// The session-minutes target sent with every evaluation (mezo-r36n9.113); nil = not sent (no capacity, the
    /// budget bar hidden). A new target re-evaluates.
    public var minutesTarget: Int? { didSet { if minutesTarget != oldValue, phase == .ready { scheduleEvaluation() } } }
    /// Set by the caller that opens the builder on a block the new-block intake created a moment ago: the builder
    /// then offers to throw it away („Mégsem, eldobom").
    public var justCreated = false
    public private(set) var discardError: PlanFetchError?
    /// The rows of a weekly proposal still waiting for his approval (from the proposals the load already read — the
    /// check never asks for a proposal to be generated): exercise ids and the weekday labels of their lines.
    private var pendingExerciseIds: Set<String> = []
    private var pendingWeekdays: Set<String> = []
    /// The day line-up (row keys per day) the evaluation on screen was computed for: its exercise indices address
    /// only that line-up.
    private var evaluatedLineup: [[String]]?

    /// The coverage hints of the draft on screen (mezo-r36n9.114): 0..3 findings in the server's priority order. Read
    /// through `coverageFinding(_:)`, which hides a group's finding while rows of that group changed since the answer.
    public private(set) var coverage: [WireCoverageFinding] = []
    /// The rows the findings on screen were computed for — `weekday:catalogId` → count (order-free, a reorder changes no
    /// hint) and each id's coarse group; nil before the first answer.
    private var coverageBasis: CoverageBasis?
    /// The hints he took with „Hozzáadom", by group: the added row's key and its draft day (the undo line).
    private var coverageAdded: [String: (rowId: String, day: Int)] = [:]
    /// Ask for coverage hints after every evaluation (off only in tests that script no coverage read).
    private let coverageHints: Bool

    private let client: PlanClient
    private let debounce: Duration
    private var evaluationTask: Task<Void, Never>?
    private var catalog: [WireCatalogItem] = []
    /// Set while the model itself swaps the draft (a re-read): that swap asks for one evaluation, not two.
    private var replacing = false

    /// What the builder edits (mezo-r36n9.177): the running block, one named run (a planned one), or a template —
    /// a template is saved with one `updateMesoTemplate` and never touches a run.
    public enum Source: Equatable, Sendable { case running, run(id: String), template(id: String) }
    public let source: Source
    public var isTemplate: Bool { if case .template = source { true } else { false } }
    /// The template as the server last sent it — the save base (fields the builder does not edit ride along).
    private var templateBase: WireTemplate?
    /// The running block's id, for the add / swap suggestions while a template is edited (nil: none runs).
    private var suggestBlockId: String?

    public init(client: PlanClient, source: Source = .running, debounce: Duration = .milliseconds(300),
                lockedDay: LockedDay? = nil, coverageHints: Bool = true) {
        self.client = client
        self.source = source
        self.debounce = debounce
        self.lockedDay = source == .running ? lockedDay : nil
        if case .template = source { self.coverageHints = false } else { self.coverageHints = coverageHints }
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
            async let block = fetchBlock()
            async let items = client.catalog()
            guard let b = try await block else { phase = .noBlock; return }
            catalog = (try? await items) ?? []
            if isTemplate { suggestBlockId = try? await client.runningBlock()?.id }
            // Best effort: the AI's sentences ride on the week's proposal; no proposal or no net is simply no sentence.
            if !isTemplate, let proposals = try? await client.weekProposals(blockId: b.id) {
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

    /// The block the source names; a template becomes a block-shaped draft base (status `template`, week 0, row ids
    /// `t<day>-<row>` that never leave the phone).
    private func fetchBlock() async throws(PlanFetchError) -> WireBlock? {
        switch source {
        case .running:
            return try await client.runningBlock()
        case .run(let id):
            guard let b = try await client.allBlocks().first(where: { $0.id == id }) else { throw .notFound }
            return b
        case .template(let id):
            guard let t = try await client.templates().first(where: { $0.id == id }) else { throw .notFound }
            templateBase = t
            return try Self.block(of: t)
        }
    }

    static func block(of t: WireTemplate) throws(PlanFetchError) -> WireBlock {
        guard case .object(var o) = t.json else { throw .server }
        let days = (o["days"]?.array ?? []).enumerated().map { di, day -> WireJSON in
            guard case .object(var d) = day else { return day }
            d["id"] = .string("t\(di)")
            d["exercises"] = .array((d["exercises"]?.array ?? []).enumerated().map { ei, ex -> WireJSON in
                guard case .object(var e) = ex else { return ex }
                e["id"] = .string("t\(di)-\(ei)")
                return .object(e)
            })
            return .object(d)
        }
        o["days"] = .array(days)
        o["id"] = .string(t.id ?? "template")
        o["status"] = .string("template")
        o["currentWeek"] = .int(0)
        if o["weeks"] == nil { o["weeks"] = .int(t.weeks) }
        do {
            return try JSONDecoder().decode(WireBlock.self, from: JSONEncoder().encode(WireJSON.object(o)))
        } catch {
            throw .server
        }
    }

    /// The template save body: the base with the edited days, tiers, sport groups, style and techniques switch;
    /// server-owned keys dropped. Each row starts from its stored JSON (so carried fields survive the full replace)
    /// unless it is a new identity.
    static func templateBody(base: WireTemplate, draft: BlockDraft) -> WireTemplate {
        guard case .object(var o) = base.json else { return base }
        for key in ["id", "runCount", "createdAt", "updatedAt"] { o.removeValue(forKey: key) }
        let stored = o["days"]?.array ?? []
        func json<T: Encodable>(_ v: T) -> WireJSON {
            (try? JSONDecoder().decode(WireJSON.self, from: JSONEncoder().encode(v))) ?? .null
        }
        o["days"] = .array(draft.days.map { day -> WireJSON in
            guard case .object(var d) = json(draft.dayInput(day, forSave: false)) else { return .null }
            let dayIndex = Int(day.id.dropFirst()).flatMap { stored.indices.contains($0) ? $0 : nil }
            if let i = dayIndex, case .object(let sd) = stored[i] {
                d = sd.merging(d) { _, new in new }
                d.removeValue(forKey: "id")
            }
            d["exercises"] = .array(day.exercises.map { e -> WireJSON in
                guard case .object(let input) = json(draft.exerciseInput(e, forSave: false)) else { return .null }
                var row: [String: WireJSON] = [:]
                let parts = e.id.dropFirst().split(separator: "-").compactMap { Int($0) }
                if e.id.hasPrefix("t"), !e.identityChanged, parts.count == 2, stored.indices.contains(parts[0]),
                   let rows = stored[parts[0]]["exercises"]?.array, rows.indices.contains(parts[1]),
                   case .object(let sr) = rows[parts[1]] {
                    row = sr
                }
                row.merge(input) { _, new in new }
                row.removeValue(forKey: "id")
                return .object(row)
            })
            return .object(d)
        })
        o["musclePriorities"] = json(draft.prioritiesWire)
        o["sportGroups"] = json(draft.sportGroups)
        o["trainingStyle"] = draft.style.map { .string($0.rawValue) } ?? .null
        o["techniquesEnabled"] = .bool(draft.techniquesEnabled)
        return WireTemplate(json: .object(o))
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
        let blockId: String
        if isTemplate {
            guard let running = suggestBlockId else {
                return try! JSONDecoder().decode(WireSuggestions.self, from: Data(#"{"suggestions":[]}"#.utf8))
            }
            blockId = running
        } else {
            blockId = draft.blockId
        }
        let d = draft.days[day]
        let request = WireSuggestionsRequest(
            mode: mode, dayIndex: d.weekdayIndex ?? day,
            outgoing: outgoing.map { WireSuggestionOutgoing(catalogId: $0.catalogId?.lowercased(), name: $0.name, muscle: $0.muscleKey, type: $0.type) },
            muscle: muscle, muscles: muscles.map(SubMuscles.ordered),
            dayCatalogIds: d.exercises.compactMap { $0.catalogId?.lowercased() })
        return try await client.suggestions(blockId: blockId, request)
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

    /// What the evaluator is asked for the draft on screen: the draft plus the session-minutes target.
    private func evaluateRequest() -> WireEvaluateRequest? {
        guard var request = draft?.evaluateRequest() else { return nil }
        request.sessionMinutesTarget = minutesTarget
        return request
    }

    public func evaluateNow() async {
        guard let draft, let request = evaluateRequest() else { return }
        do {
            let result = try await client.evaluate(request)
            // A newer edit already asked again; this answer belongs to an older draft.
            guard evaluateRequest() == request else { return }
            evaluation = result
            evaluatedLineup = Self.lineup(draft)
            evaluationStale = false
            evaluationError = nil
            // The same draft, with the minutes the evaluator just priced: the coverage hints ride on every evaluation.
            if coverageHints { await refreshCoverage(result) }
        } catch {
            // A late failure of an older draft must not mark a newer, good answer as stale.
            guard evaluateRequest() == request else { return }
            evaluationError = error
            evaluationStale = evaluation != nil
        }
    }

    // MARK: coverage hints (mezo-r36n9.114)

    /// The training days as the coverage read takes them: weekday, lower-cased catalogue ids, the evaluator's minutes.
    private func coverageDays(_ draft: BlockDraft, _ evaluation: WireEvaluation?) -> [WireCoverageDay] {
        draft.days.indices.compactMap { i in
            let d = draft.days[i]
            guard !d.exercises.isEmpty, let weekday = d.weekdayIndex else { return nil }
            return WireCoverageDay(dayIndex: weekday, catalogIds: d.exercises.compactMap { $0.catalogId?.lowercased() },
                                   minutesEstimate: evaluation?.days.first { $0.dayIndex == i }?.minutesEstimate)
        }
    }

    struct CoverageBasis: Equatable {
        var counts: [String: Int] = [:]
        var groups: [String: String] = [:]
    }

    /// The draft's catalogue rows on its training days, as the coverage read sees them.
    private static func coverageBasis(_ draft: BlockDraft) -> CoverageBasis {
        var b = CoverageBasis()
        for d in draft.days where !d.exercises.isEmpty {
            guard let weekday = d.weekdayIndex else { continue }
            for e in d.exercises {
                guard let id = e.catalogId?.lowercased() else { continue }
                b.counts["\(weekday):\(id)", default: 0] += 1
                b.groups[id] = e.muscle
            }
        }
        return b
    }

    /// The groups whose rows changed since the answer on screen. A pull also moves the biceps rule, a press the triceps
    /// one, so those go with it.
    private var coverageTouched: Set<String> {
        guard let basis = coverageBasis, let draft else { return [] }
        let now = Self.coverageBasis(draft)
        guard now.counts != basis.counts else { return [] }
        var touched = Set<String>()
        for key in Set(now.counts.keys).union(basis.counts.keys) where now.counts[key] != basis.counts[key] {
            let id = String(key.split(separator: ":", maxSplits: 1).last ?? "")
            guard let group = now.groups[id] ?? basis.groups[id] else { continue }
            touched.insert(group)
            if group == "back" { touched.insert("biceps") }
            if group == "chest" || group == "shoulder" { touched.insert("triceps") }
        }
        return touched
    }

    /// The findings describe the whole draft on screen (no add / remove / swap / move between days since).
    public var coverageFresh: Bool {
        guard let coverageBasis, let draft else { return false }
        return coverageBasis.counts == Self.coverageBasis(draft).counts
    }

    /// Asks for the draft's coverage hints. A failure (offline, a server error) is silent: no findings, never an error
    /// on the card. An answer for rows that changed meanwhile is dropped. Undo entries whose row is gone are let go.
    private func refreshCoverage(_ evaluation: WireEvaluation) async {
        guard let draft else { return }
        let days = coverageDays(draft, evaluation)
        let basis = Self.coverageBasis(draft)
        let findings = (try? await client.coverage(blockId: draft.blockId, days: days))?.findings ?? []
        guard let now = self.draft, Self.coverageBasis(now).counts == basis.counts else { return }
        coverage = findings
        coverageBasis = basis
        coverageAdded = coverageAdded.filter { group, _ in coverageAddedDay(group) != nil }
    }

    /// The draft day (index) a weekday (0 = Monday) falls on; nil when the draft has no such day.
    public func draftDay(weekday: Int) -> Int? { draft?.days.firstIndex { $0.weekdayIndex == weekday } }

    /// The hint on a group's card: only while that group's rows are as the answer saw them (an edit elsewhere keeps it),
    /// not while the row he took with Hozzáadom is on the draft, and never one whose proposal lands on the day of today's
    /// open workout (that card is read-only). Tartás and untrained groups the server keeps silent.
    public func coverageFinding(_ group: String) -> WireCoverageFinding? {
        guard coverageBasis != nil, coverageAddedDay(group) == nil, !coverageTouched.contains(group),
              let f = coverage.first(where: { $0.group == group }) else { return nil }
        if let p = f.proposal {
            guard let day = draftDay(weekday: p.dayIndex), day != lockedDayIndex else { return nil }
        }
        return f
    }

    /// „Hozzáadom": the proposed exercise goes to the end of its named day with the style's prescription (the add's own
    /// fallback without one). Returns false when there is nothing to add.
    @discardableResult
    public func acceptCoverage(_ group: String) -> Bool {
        guard let f = coverageFinding(group), let p = f.proposal, let day = draftDay(weekday: p.dayIndex),
              let uuid = UUID(uuidString: p.exercise.id) else { return false }
        let catalog = CatalogExercise(id: uuid, slug: "", name: p.exercise.name, muscle: p.exercise.muscle ?? "",
                                      type: ExerciseType(wire: p.exercise.type), stim: 0, fatigue: 0, gear: p.exercise.gear)
        draft?.add(day: day, catalog: catalog, prescription: p.prescription)
        guard let row = draft?.days[day].exercises.last else { return false }
        coverageAdded[group] = (row.id, day)
        return true
    }

    /// The draft day a taken hint's row sits on — while that row is still in the draft (the „Hozzáadva …" line).
    public func coverageAddedDay(_ group: String) -> Int? {
        guard let added = coverageAdded[group], let draft, draft.days.indices.contains(added.day),
              draft.days[added.day].exercises.contains(where: { $0.id == added.rowId }) else { return nil }
        return added.day
    }

    /// „visszavonom": takes the added row off its day again.
    public func undoCoverage(_ group: String) {
        guard let added = coverageAdded.removeValue(forKey: group), let draft, draft.days.indices.contains(added.day),
              let index = draft.days[added.day].exercises.firstIndex(where: { $0.id == added.rowId }) else { return }
        self.draft?.remove(day: added.day, at: index)
    }

    /// „Mást választok": the add sheet's day — the proposal's, else the first open day that already trains the group,
    /// else the first open training day.
    public func coverageOtherDay(_ group: String) -> Int? {
        guard let draft else { return nil }
        let open = draft.days.indices.filter { $0 != lockedDayIndex }
        if let p = coverageFinding(group)?.proposal, let d = draftDay(weekday: p.dayIndex), open.contains(d) { return d }
        let trains = Set(muscle(group)?.spread.filter { $0.sets > 0 }.map(\.dayIndex) ?? [])
        return open.first { trains.contains($0) } ?? open.first { !draft.days[$0].exercises.isEmpty } ?? open.first
    }

    // MARK: the tier budget (mezo-r36n9.113)

    /// May the muscle go one tier up now? Compared against the latest evaluation's budget; without a minutes target
    /// there is no capacity, so only the Hangsúly cap can block.
    public func canRaise(_ muscle: String) -> RaiseCheck {
        guard let draft else { return .ok }
        return RaiseCheck.raise(muscle: muscle, from: draft.tier(muscle).rawValue,
                                emphasizeCount: draft.tiers.values.filter { $0 == .emphasize }.count,
                                budget: evaluation?.budget, minutes: minutesTarget ?? 0,
                                // The training days — the same count the heti keret line says.
                                days: draft.days.filter { !$0.exercises.isEmpty }.count)
    }

    /// The tier switch: lowering jumps straight to the target, a raise moves one tier toward it and only when
    /// `canRaise` allows (the same one-tier-per-tap rule as the new-block intake). Returns the check that decided.
    @discardableResult
    public func setTier(_ muscle: String, _ target: MuscleTier) -> RaiseCheck {
        guard let current = draft?.tier(muscle) else { return .ok }
        let from = RaiseCheck.rank(current.rawValue), wanted = RaiseCheck.rank(target.rawValue)
        guard wanted != from else { return .ok }
        if wanted < from { draft?.setTier(muscle, target); return .ok }
        let result = canRaise(muscle)
        if result == .ok { draft?.setTier(muscle, MuscleTier(wire: RaiseCheck.tierNames[from + 1])) }
        return result
    }

    /// „Mégsem, eldobom": throws away the block the intake just created (the server deletes it and its template — no
    /// report, no AI review) and leaves the builder empty. A failure keeps the block on screen with `discardError`
    /// set. Returns true when the block is gone.
    @discardableResult
    public func discard() async -> Bool {
        guard !isTemplate, let blockId = draft?.blockId ?? original?.blockId else { return false }
        do {
            try await client.discardBlock(id: blockId)
        } catch {
            discardError = error
            return false
        }
        evaluationTask?.cancel()
        phase = .noBlock
        replacing = true
        draft = nil
        replacing = false
        original = nil
        evaluation = nil
        evaluationStale = false
        coverage = []
        coverageBasis = nil
        coverageAdded = [:]
        justCreated = false
        discardError = nil
        return true
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
        if case .template(let id) = source, let base = templateBase {
            do {
                _ = try await client.updateTemplate(id: id, Self.templateBody(base: base, draft: draft))
                saveState = .saved
                await reload(keeping: nil)
            } catch {
                saveState = .failed(saved: [], error: error)
                await reload(keeping: (draft, original))
            }
            return
        }
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
            // Saved: the added rows are his now (and the re-read re-mints their keys) — no undo line any more.
            coverageAdded = [:]
            await reload(keeping: nil)
        } catch {
            saveState = .failed(saved: saved, error: error)
            await reload(keeping: (draft, original))
        }
    }

    /// Re-read the block so the next edit starts from what the server holds (a day save may re-mint ids). With
    /// `keeping`, the edits that did not reach the server are carried onto the fresh read.
    private func reload(keeping: (draft: BlockDraft, original: BlockDraft)?) async {
        guard let block = try? await fetchBlock() else { return }
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
