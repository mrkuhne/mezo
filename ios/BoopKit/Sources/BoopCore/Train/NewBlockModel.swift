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

    /// Tier order: maintain < grow < emphasize. Lowering (or staying) is always allowed. `emphasizeCount` is counted
    /// from the tiers on screen (the budget may lag an edit); the cap and the costs come from the server's budget.
    static func check(muscle: String, from current: String, to target: String, emphasizeCount: Int, budget: WireBudget?,
                      minutes: Int, days: Int) -> RaiseCheck {
        let rank = ["maintain": 0, "grow": 1, "emphasize": 2]
        let from = rank[current] ?? 1, to = rank[target] ?? 1
        guard to > from else { return .ok }
        if target == "emphasize", emphasizeCount >= (budget?.emphasizeMax ?? 2) { return .emphasizeFull }
        if let budget, let capacity = budget.capacitySets, let cost = budget.raiseCost[muscle],
           cost > capacity - budget.usedSets {
            return .noRoom(minutes: minutes, days: days)
        }
        return .ok
    }

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

    public var weeks = 6 {
        didSet {
            let clamped = min(max(weeks, Self.weekRange.lowerBound), Self.weekRange.upperBound)
            if clamped != weeks { weeks = clamped; return }
            if weeks != oldValue { scheduleRefresh() }
        }
    }
    public var minutes = 60 { didSet { if minutes != oldValue { scheduleRefresh() } } }
    /// Coarse muscle → `emphasize` / `grow` / `maintain`; a missing key is Építés (grow).
    public var tiers: [String: String] = [:] { didSet { if tiers != oldValue { scheduleRefresh() } } }
    public var startChoice: StartChoice = .nextMonday

    public private(set) var phase: Phase
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
    private var savedTemplate: (key: String, id: String)?

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

    // MARK: „Ezzel kezdem"

    /// Generate the chosen split's full plan → save it as a template → start it. A failed generate falls back to the
    /// candidate's own template (already a complete, sound plan).
    public func choose(_ candidate: WireCandidate) async {
        guard !busy else { return }
        pendingRefresh?.cancel()
        phase = .creating
        let key = "\(candidate.splitKey)|\(weeks)|\(prioritiesWire ?? [:])|\(days)"
        do {
            let templateId: String
            if let saved = savedTemplate, saved.key == key {
                templateId = saved.id
            } else {
                let template: WireTemplate
                do {
                    template = try await client.generate(WireGenerateRequest(daysOfWeek: days, weeks: weeks,
                                                                             priorities: prioritiesWire, split: candidate.splitKey)).template
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
            phase = Self.isSeasonRequired(error) ? .needsSeason : .failed(error)
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
