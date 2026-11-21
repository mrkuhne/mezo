import Foundation
import Observation

// The new-block intake (mezo-r36n9.113): he picks the length, the session minutes and the muscle tiers; the season's
// gym days are the training days. The server answers with 1–3 ranked split candidates (or the closest one with what
// would make it fit); every number on screen — minutes, bands, the tier budget, the raise costs — is the server's.
// „Ezzel kezdem" asks the server for the full plan of the chosen split, saves it unchanged as a template and starts
// it (next Monday as planned, or today as active).

/// Whether a muscle may move to a tier now. Pure comparison of the server's budget numbers — no maths of our own.
public enum RaiseCheck: Equatable, Sendable {
    case ok
    /// Hangsúly is full (or the muscle is already at Hangsúly — there is no tier above it).
    case emphasizeFull
    /// The raise costs more sets than the session target leaves room for; carries the intake's own minutes and
    /// training-day count for the copy.
    case noRoom(minutes: Int, days: Int)

    /// Tier order: maintain < grow < emphasize. Lowering (or staying) is always allowed; a raise is checked one tier
    /// at a time. `emphasizeCount` is counted
    /// from the tiers on screen (the budget may lag an edit); the cap and the costs come from the server's budget.
    static func check(muscle: String, from current: String, to target: String, emphasizeCount: Int, budget: WireBudget?,
                      minutes: Int, days: Int) -> RaiseCheck {
        let from = rank(current), wanted = rank(target)
        guard wanted > from else { return .ok }
        // The screens raise one tier per tap: a two-tier jump (Tartás → Hangsúly) is checked — and taken, by
        // `NewBlockModel.setTier` — as its first step only. `raiseCost` prices exactly one tier, so a jump is never
        // compared against a cost the server did not send.
        let to = from + 1
        if to == 2, emphasizeCount >= (budget?.emphasizeMax ?? 2) { return .emphasizeFull }
        if let budget, let capacity = budget.capacitySets, let cost = budget.raiseCost[muscle],
           cost > capacity - budget.usedSets {
            return .noRoom(minutes: minutes, days: days)
        }
        return .ok
    }

    public static func rank(_ tier: String) -> Int { ["maintain": 0, "grow": 1, "emphasize": 2][tier] ?? 1 }
    static let tierNames = ["maintain", "grow", "emphasize"]

    /// One tier up from `current`; Hangsúly has nothing above it.
    static func raise(muscle: String, from current: String, emphasizeCount: Int, budget: WireBudget?, minutes: Int, days: Int) -> RaiseCheck {
        switch current {
        case "emphasize": .emphasizeFull
        case "maintain": check(muscle: muscle, from: current, to: "grow", emphasizeCount: emphasizeCount, budget: budget, minutes: minutes, days: days)
        default: check(muscle: muscle, from: current, to: "emphasize", emphasizeCount: emphasizeCount, budget: budget, minutes: minutes, days: days)
        }
    }
}

@MainActor @Observable
public final class NewBlockModel {
    public enum StartChoice: Equatable, Sendable { case nextMonday, today }

    public enum Phase: Equatable {
        /// No season gym days (or the server said no season covers the start): the season-needed state.
        case needsSeason
        case editing
        case loadingCandidates
        case candidates(WireCandidates)
        case creating
        case created(blockId: String)
        case failed(PlanFetchError)
    }

    public static let weekRange = 4...8
    public static let minuteChoices = [45, 60, 75, 90]
    /// Season weekday (0 = Monday) → the server's day token.
    public static let dayTokens = [0: "Hét", 1: "Kedd", 2: "Sze", 3: "Csü", 4: "Pén", 5: "Szo", 6: "Vas"]

    /// The block length, clamped to `weekRange`; a change of the final (clamped) value asks again. A computed
    /// property over its storage: under `@Observable` an assignment inside `didSet` re-enters the observer, so the
    /// clamp is done before anything is stored.
    public var weeks: Int {
        get { weeksValue }
        set {
            let clamped = min(max(newValue, Self.weekRange.lowerBound), Self.weekRange.upperBound)
            guard clamped != weeksValue else { return }
            weeksValue = clamped
            scheduleRefresh()
        }
    }
    private var weeksValue = 6
    public var minutes = 60 { didSet { if minutes != oldValue { scheduleRefresh() } } }
    /// Coarse muscle → `emphasize` / `grow` / `maintain`; a missing key is Építés (grow).
    public var tiers: [String: String] = [:] { didSet { if tiers != oldValue { scheduleRefresh() } } }
    public var startChoice: StartChoice = .nextMonday

    public private(set) var phase: Phase
    /// Why the last „Ezzel kezdem" failed (generate / save / start); the candidates stay on screen. nil otherwise.
    public private(set) var createError: PlanFetchError?
    /// The lead candidate's tier budget (recommended, else the closest); refreshed with the candidates.
    public private(set) var budget: WireBudget?
    /// The training days as the server's tokens, in week order.
    public let days: [String]

    private let client: PlanClient
    private let debounce: Duration
    private let now: () -> Date
    private let calendar: Calendar
    /// The debounced refresh on its way (tests await it).
    private(set) var pendingRefresh: Task<Void, Never>?
    /// A template already saved for a choice, so a retry after a failed start does not save a second one.
    private var savedTemplate: (key: SavedKey, id: String)?

    /// Everything a saved template was made for: the generate request (split, days, weeks, tiers) plus the session
    /// minutes. Compared with `==`, so a dictionary's order never matters.
    private struct SavedKey: Equatable {
        let request: WireGenerateRequest
        let minutes: Int
    }

    public init(client: PlanClient, seasonGymDays: [Int]?, debounce: Duration = .milliseconds(300),
                now: @escaping () -> Date = Date.init, calendar: Calendar = .current) {
        self.client = client
        self.debounce = debounce
        self.now = now
        self.calendar = calendar
        days = Array(Set(seasonGymDays ?? [])).sorted().compactMap { Self.dayTokens[$0] }
        phase = days.isEmpty ? .needsSeason : .editing
    }

    // MARK: candidates

    /// The sparse tier map the server takes (Építés is the absence of a key); nil when every muscle is Építés.
    var prioritiesWire: [String: String]? {
        let sparse = tiers.filter { $0.value != "grow" }
        return sparse.isEmpty ? nil : sparse
    }

    private var candidatesRequest: WireCandidatesRequest {
        WireCandidatesRequest(daysOfWeek: days, weeks: weeks, priorities: prioritiesWire, sessionMinutesTarget: minutes)
    }

    private var busy: Bool {
        switch phase {
        case .needsSeason, .creating, .created: true
        default: false
        }
    }

    /// Asks for the candidates now. The candidates on screen stay while a refresh is on its way.
    public func refresh() async {
        guard !busy else { return }
        let request = candidatesRequest
        if case .candidates = phase {} else { phase = .loadingCandidates }
        do {
            let result = try await client.candidates(request)
            // A newer edit already asked again; this answer belongs to older settings.
            guard request == candidatesRequest, !busy else { return }
            phase = .candidates(result)
            budget = result.lead?.evaluation.budget
            // New choices on screen: the old start failure no longer describes them.
            createError = nil
        } catch {
            guard request == candidatesRequest, !busy else { return }
            phase = Self.isSeasonRequired(error) ? .needsSeason : .failed(error)
        }
    }

    private func scheduleRefresh() {
        guard !busy else { return }
        pendingRefresh?.cancel()
        let wait = debounce
        pendingRefresh = Task { [weak self] in
            try? await Task.sleep(for: wait)
            guard !Task.isCancelled else { return }
            await self?.refresh()
        }
    }

    // MARK: the tier budget

    public func tier(_ muscle: String) -> String { tiers[muscle] ?? "grow" }

    /// May the muscle go one tier up now?
    public func canRaise(_ muscle: String) -> RaiseCheck {
        RaiseCheck.raise(muscle: muscle, from: tier(muscle), emphasizeCount: emphasizeCount, budget: budget,
                         minutes: minutes, days: days.count)
    }

    /// May the muscle move to `target` now? Lowering is always allowed.
    public func check(_ muscle: String, to target: String) -> RaiseCheck {
        RaiseCheck.check(muscle: muscle, from: tier(muscle), to: target, emphasizeCount: emphasizeCount, budget: budget,
                         minutes: minutes, days: days.count)
    }

    private var emphasizeCount: Int { tiers.values.filter { $0 == "emphasize" }.count }

    /// Sets a muscle's tier from the switch. Lowering jumps straight to the target; a raise moves one tier toward it
    /// (Tartás → Hangsúly lands on Építés first) and only when the budget allows. Returns the check that decided.
    @discardableResult
    public func setTier(_ muscle: String, _ target: String) -> RaiseCheck {
        let from = RaiseCheck.rank(tier(muscle)), wanted = RaiseCheck.rank(target)
        guard wanted != from else { return .ok }
        if wanted < from { tiers[muscle] = target; return .ok }
        let result = check(muscle, to: target)
        if result == .ok { tiers[muscle] = RaiseCheck.tierNames[from + 1] }
        return result
    }

    // MARK: what would make it fit

    public enum FixOutcome: Equatable, Sendable {
        case applied
        /// More training days: the season decides them — the screen sends him to the Évad tab.
        case needsSeasonDays
        /// A fix this build does not know: no line is shown for it.
        case unknown
    }

    /// The emphasized muscle with the most weekly sets in the lead (closest) candidate — the one „Egy izom Hangsúly
    /// helyett Építés" lowers. Muscles the evaluation does not list count as 0.
    public var heaviestEmphasized: String? {
        let sets = Dictionary((budgetSource?.muscles ?? []).map { ($0.muscle, $0.weeklySets) }, uniquingKeysWith: { a, _ in a })
        return tiers.filter { $0.value == "emphasize" }.keys.sorted().max { (sets[$0] ?? 0) < (sets[$1] ?? 0) }
    }

    private var budgetSource: WireEvaluation? {
        if case .candidates(let c) = phase { return c.lead?.evaluation }
        return nil
    }

    /// Applies one of the server's fixes: `more_minutes` sets its minutes, `fewer_emphasis` lowers the heaviest
    /// Hangsúly muscle to Építés, `more_days` is the season's (`needsSeasonDays`).
    public func applyFix(_ fix: WireFix) -> FixOutcome {
        switch fix.code {
        case "more_minutes":
            guard let v = fix.value, v > 0 else { return .unknown }
            minutes = v
            return .applied
        case "fewer_emphasis":
            guard let m = heaviestEmphasized else { return .unknown }
            tiers[m] = "grow"
            return .applied
        case "more_days": return .needsSeasonDays
        default: return .unknown
        }
    }

    // MARK: „Ezzel kezdem"

    /// Generate the chosen split's full plan → save it as a template → start it. A failed generate falls back to the
    /// candidate's own template (already a complete, sound plan).
    /// A failure here is the start's, not the candidates': the candidates on screen stay (`createError` says why) and
    /// choosing again retries the start (reusing a template already saved). `SEASON_REQUIRED` → `needsSeason`.
    public func choose(_ candidate: WireCandidate) async {
        guard !busy else { return }
        pendingRefresh?.cancel()
        let before = phase
        createError = nil
        phase = .creating
        let request = WireGenerateRequest(daysOfWeek: days, weeks: weeks, priorities: prioritiesWire, split: candidate.splitKey)
        let key = SavedKey(request: request, minutes: minutes)
        do {
            let templateId: String
            if let saved = savedTemplate, saved.key == key {
                templateId = saved.id
            } else {
                let template: WireTemplate
                do {
                    template = try await client.generate(request).template
                } catch {
                    template = candidate.template
                }
                templateId = try await client.createTemplate(template)
                savedTemplate = (key, templateId)
            }
            let status = startChoice == .today ? "active" : "planned"
            let block = try await client.startTemplate(id: templateId,
                                                       startDate: Self.startDate(startChoice, now: now(), calendar: calendar),
                                                       status: status)
            phase = .created(blockId: block.id)
        } catch {
            if Self.isSeasonRequired(error) {
                phase = .needsSeason
            } else if case .candidates = before {
                phase = before
                createError = error
            } else {
                phase = .failed(error)
            }
        }
    }

    /// Back from a failure to the choices (asks again).
    public func retry() async {
        if case .failed = phase { phase = .editing }
        await refresh()
    }

    /// `today`, or the next Monday strictly after today (today a Monday → a week later), as `yyyy-MM-dd` in his calendar.
    public static func startDate(_ choice: StartChoice, now: Date, calendar: Calendar) -> String {
        var date = calendar.startOfDay(for: now)
        if choice == .nextMonday {
            let weekday = calendar.component(.weekday, from: date) // 1 = Sunday, 2 = Monday
            let ahead = (2 - weekday + 7) % 7
            date = calendar.date(byAdding: .day, value: ahead == 0 ? 7 : ahead, to: date) ?? date
        }
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    private static func isSeasonRequired(_ error: PlanFetchError) -> Bool { error == .conflict("SEASON_REQUIRED") }
}
