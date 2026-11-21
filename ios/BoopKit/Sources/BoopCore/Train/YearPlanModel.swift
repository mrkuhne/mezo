import Foundation
import Observation

// The Éves terv (mezo-r36n9.113): the year view's state. The server lays the year out — rotation, dates, buffer,
// consolidation, warnings, the current week — and every edit answers with the whole re-dated plan, so the phone keeps
// no maths of its own. No plan is a state (the empty screen), not a failure. A failed load falls back to the last plan
// with its age [RF 5]; only a freshly loaded plan feeds the Következik card (`freshPlan`).

/// What the new-block intake starts from when it opens from a year block (the Következik card's „Indítás").
public struct YearBlockPrefill: Equatable, Sendable {
    public let yearBlockId: String
    /// Every landmark group: the block's focus `emphasize`, the rest `maintain`; a consolidation is all `maintain`.
    public let tiers: [String: String]
    public let weeks: Int
    public let consolidation: Bool
    /// The block's planned start when it is still ahead (`yyyy-MM-dd`); nil once its day has come.
    public let startDate: String?

    public init(yearBlockId: String, tiers: [String: String], weeks: Int, consolidation: Bool, startDate: String?) {
        self.yearBlockId = yearBlockId; self.tiers = tiers; self.weeks = weeks; self.consolidation = consolidation
        self.startDate = startDate
    }
}

@MainActor @Observable
public final class YearPlanModel {
    public enum Phase: Equatable {
        case loading
        /// He has no active plan: the empty state („Még nincs éves terved").
        case none
        /// The plan; `age` is nil for a fresh read, else how old the shown copy is („3 órás adat").
        case ready(WireYearPlan, age: String?)
        case failed(PlanFetchError)
    }

    /// The 9 landmark groups in the server's config order. upper: chest…triceps, lower: quad…calf.
    public nonisolated static let landmarkGroups = ["chest", "back", "shoulder", "biceps", "triceps", "quad", "ham", "glute", "calf"]
    public nonisolated static let upperGroups: Set<String> = ["chest", "back", "shoulder", "biceps", "triceps"]
    public nonisolated static let lowerGroups: Set<String> = ["quad", "ham", "glute", "calf"]
    public static let blockWeekRange = 4...8
    public static let focusMax = 2
    static let cacheEndpoint = "train/year-plan"
    static let cacheKey = "-"
    public static let cacheMaxAge: TimeInterval = 14 * 86_400

    public private(set) var phase: Phase = .loading
    /// Why the last edit / create / archive failed; the plan on screen stays. nil after a success.
    public private(set) var actionError: PlanFetchError?
    /// An edit on its way (the screens disable their controls).
    public private(set) var saving = false

    // MARK: the draft (Éves terv készítése)

    /// The plan's first day, a Monday; never before the Monday on/after today.
    public var startMonday: String { didSet { if startMonday != oldValue { schedulePreview() } } }
    /// Groups to focus twice this year.
    public var emphasis: Set<String> = [] { didSet { if emphasis != oldValue { schedulePreview() } } }
    /// Loading block length, clamped to 4…8 before it is stored (see `NewBlockModel.weeks`).
    public var blockWeeks: Int {
        get { blockWeeksValue }
        set {
            let clamped = min(max(newValue, Self.blockWeekRange.lowerBound), Self.blockWeekRange.upperBound)
            guard clamped != blockWeeksValue else { return }
            blockWeeksValue = clamped
            schedulePreview()
        }
    }
    private var blockWeeksValue = 6
    /// The server's proposal for the draft (no ids); refreshed debounced on every draft edit.
    public private(set) var preview: WireYearPlan?
    public private(set) var previewError: PlanFetchError?

    @ObservationIgnored private let client: PlanClient
    @ObservationIgnored private let cache: ServerCache?
    @ObservationIgnored private let debounce: Duration
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let calendar: Calendar
    /// When the plan on screen was read from the server (an in-memory copy ages too).
    @ObservationIgnored private var loadedAt: Date?
    /// The debounced preview on its way (tests await it).
    @ObservationIgnored private(set) var pendingPreview: Task<Void, Never>?

    public init(client: PlanClient, cache: ServerCache?, debounce: Duration = .milliseconds(300),
                now: @escaping () -> Date = Date.init, calendar: Calendar = .current) {
        self.client = client
        self.cache = cache
        self.debounce = debounce
        self.now = now
        self.calendar = calendar
        startMonday = Self.day(Self.mondayOnOrAfter(now(), calendar: calendar), calendar: calendar)
    }

    /// The plan on screen only when it was just read from the server — the Következik card shows nothing else [RF 5].
    public var freshPlan: WireYearPlan? {
        if case .ready(let plan, nil) = phase { return plan }
        return nil
    }

    private var plan: WireYearPlan? {
        if case .ready(let plan, _) = phase { return plan }
        return nil
    }

    // MARK: load

    public func load() async {
        if plan == nil { phase = .loading }
        do {
            let fetched = try await client.activeYearPlan()
            await show(fetched)
        } catch {
            if let shown = plan {
                phase = .ready(shown, age: Self.ageText(now().timeIntervalSince(loadedAt ?? now())))
            } else if let hit = await cache?.get(Snapshot.self, endpoint: Self.cacheEndpoint, date: Self.cacheKey,
                                                 maxAge: Self.cacheMaxAge), let cached = hit.value.plan {
                phase = .ready(cached, age: Self.ageText(hit.age))
            } else {
                phase = .failed(error)
            }
        }
    }

    /// A fresh answer from the server: on screen and in the cache (an archived plan or none = the empty state).
    private func show(_ fresh: WireYearPlan?) async {
        let active = fresh.flatMap { $0.status == "archived" ? nil : $0 }
        phase = active.map { .ready($0, age: nil) } ?? .none
        loadedAt = now()
        try? await cache?.put(Snapshot(plan: active), endpoint: Self.cacheEndpoint, date: Self.cacheKey)
    }

    /// The cached read: the active plan, or nil when he had none.
    struct Snapshot: Codable, Sendable { let plan: WireYearPlan? }

    // MARK: the draft

    /// Moves the start by whole weeks, never before the Monday on/after today.
    public func stepStart(by weeks: Int) {
        let earliest = Self.mondayOnOrAfter(now(), calendar: calendar)
        guard let current = Self.parse(startMonday, calendar: calendar),
              let moved = calendar.date(byAdding: .day, value: 7 * weeks, to: current) else { return }
        startMonday = Self.day(max(moved, earliest), calendar: calendar)
    }

    private var draftRequest: WireYearPlanRequest {
        WireYearPlanRequest(startDate: startMonday, emphasis: Self.landmarkGroups.filter(emphasis.contains),
                            blockWeeks: blockWeeks)
    }

    /// Asks for the draft's preview now (the create screen calls it on appear).
    public func refreshPreview() async {
        let request = draftRequest
        do {
            let result = try await client.yearPlanPreview(request)
            guard request == draftRequest else { return }
            preview = result
            previewError = nil
        } catch {
            guard request == draftRequest else { return }
            previewError = error
        }
    }

    private func schedulePreview() {
        pendingPreview?.cancel()
        let wait = debounce
        pendingPreview = Task { [weak self] in
            try? await Task.sleep(for: wait)
            guard !Task.isCancelled else { return }
            await self?.refreshPreview()
        }
    }

    // MARK: actions

    /// Creates the plan from the draft. `replaceActive` only from „Jövő évi terv".
    public func accept(replaceActive: Bool = false) async {
        // The plan is being made: a preview on its way would only redraw the screen being left.
        pendingPreview?.cancel()
        var draft = draftRequest
        if replaceActive { draft.replaceActive = true }
        let request = draft
        await run { [client] () async throws(PlanFetchError) -> WireYearPlan in try await client.createYearPlan(request) }
    }

    /// 1–2 distinct focus groups; anything else is not sent.
    public func setFocus(_ blockId: String, _ focus: [String]) async {
        var seen = Set<String>()
        let distinct = focus.filter { seen.insert($0).inserted }
        guard (1...Self.focusMax).contains(distinct.count) else { return }
        await patch(blockId, WireYearBlockPatch(focus: distinct))
    }

    /// „Egy héttel előbb" (-1) / „Egy héttel később" (+1).
    public func shift(_ blockId: String, by weeks: Int) async {
        guard weeks == 1 || weeks == -1 else { return }
        if weeks == -1, plan?.block(blockId)?.canMoveEarlier == false { return }
        await patch(blockId, WireYearBlockPatch(shiftWeeks: weeks))
    }

    /// „Előrébb a sorban" (-1) / „Hátrébb a sorban" (+1): one place among the loading blocks.
    public func move(_ blockId: String, by step: Int) async {
        guard let plan, let block = plan.block(blockId), !block.isConsolidation else { return }
        let target = block.ordinal + step
        guard (1...max(1, plan.loadingBlocks)).contains(target), target != block.ordinal else { return }
        await patch(blockId, WireYearBlockPatch(ordinal: target))
    }

    /// „Kihagyom" (true) / back to planned (false).
    public func skip(_ blockId: String, _ on: Bool) async {
        await patch(blockId, WireYearBlockPatch(skip: on))
    }

    /// „Hozzákötöm a következő blokkhoz": the running, unlinked block becomes this block.
    public func linkRunning(_ blockId: String) async {
        await patch(blockId, WireYearBlockPatch(linkRunning: true))
    }

    /// „Éves terv lezárása": afterwards there is no active plan.
    public func archive() async {
        guard let id = plan?.id else { return }
        await run { [client] () async throws(PlanFetchError) -> WireYearPlan in try await client.archiveYearPlan(id: id) }
    }

    private func patch(_ blockId: String, _ body: WireYearBlockPatch) async {
        await run { [client] () async throws(PlanFetchError) -> WireYearPlan in try await client.patchYearBlock(id: blockId, body) }
    }

    private func run(_ call: @Sendable () async throws(PlanFetchError) -> WireYearPlan) async {
        guard !saving else { return }
        saving = true
        defer { saving = false }
        do {
            let result = try await call()
            actionError = nil
            await show(result)
        } catch {
            actionError = error
        }
    }

    // MARK: the intake prefill

    public func prefill(for block: WireYearBlock, today: Date) -> YearBlockPrefill {
        Self.prefill(for: block, today: today, calendar: calendar)
    }

    public nonisolated static func prefill(for block: WireYearBlock, today: Date, calendar: Calendar) -> YearBlockPrefill {
        let focus = block.isConsolidation ? [] : Set(block.focus)
        let tiers = Dictionary(uniqueKeysWithValues: landmarkGroups.map { ($0, focus.contains($0) ? "emphasize" : "maintain") })
        let todayString = day(today, calendar: calendar)
        // yyyy-MM-dd compares in date order.
        let start = block.plannedStart > todayString ? block.plannedStart : nil
        return YearBlockPrefill(yearBlockId: block.id ?? "", tiers: tiers, weeks: block.weeks,
                                consolidation: block.isConsolidation, startDate: start)
    }

    // MARK: dates and age

    /// "2 perces adat" / "3 órás adat" / "2 napos adat" — never nil, so a stale copy always says it is one.
    public nonisolated static func ageText(_ age: TimeInterval) -> String {
        let minutes = Int(max(0, age) / 60)
        if minutes < 60 { return "\(max(1, minutes)) perces adat" }
        return penzAgeText(age) ?? "1 órás adat"
    }

    nonisolated static func mondayOnOrAfter(_ date: Date, calendar: Calendar) -> Date {
        let start = calendar.startOfDay(for: date)
        let weekday = calendar.component(.weekday, from: start) // 1 = Sunday, 2 = Monday
        return calendar.date(byAdding: .day, value: (2 - weekday + 7) % 7, to: start) ?? start
    }

    nonisolated static func day(_ date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    nonisolated static func parse(_ string: String, calendar: Calendar) -> Date? {
        let parts = string.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var c = DateComponents(); c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
        return calendar.date(from: c)
    }
}
