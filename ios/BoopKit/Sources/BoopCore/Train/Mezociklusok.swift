import Foundation
import Observation

// Every mezociklus he made, on the phone (mezo-r36n9.177, spec 2026-11-26-boop-mezociklus-kezeles-design.md):
// the running one, the planned ones, the closed ones and the reusable templates, as display cards; the lifecycle
// actions (start, activate, rerun, restart, save to template, close); and the closed run's report. The grouping is
// pure (`mezoCards`), the model owns loading (cache first, fresh behind) and one action at a time.

public struct MezoDayPeek: Equatable, Sendable {
    public let name: String
    public let focus: String
    public let exerciseCount: Int
}

public struct MezoCard: Identifiable, Equatable, Sendable {
    public enum Kind: Equatable, Sendable { case running, planned, closed, template }

    /// Unique across kinds (a template and a run never share it).
    public let id: String
    public let kind: Kind
    public let title: String
    /// „okt. 13-tól” (running / planned), „júl. 7. – aug. 17.” (closed), empty for a template.
    public let dateText: String
    public let split: String?
    public let weeks: Int
    public let currentWeek: Int
    /// The weekly load shape, 0…1, from the phase curve.
    public let loads: [Double]
    /// The phase names in his words (Alap / Építés / Csúcs / Pihenőhét).
    public let phases: [String]
    /// Working sets per muscle over the whole week, relative to the most-worked muscle (0…1).
    public let heat: [String: Double]
    public let runCount: Int
    public let hasReport: Bool
    /// Share of planned sessions done (0…1), once the closed run's report is loaded.
    public var adherence: Double?
    public let templateId: String?
    public let blockId: String?
    public let days: [MezoDayPeek]
}

public struct MezoGroups: Equatable, Sendable {
    public var running: MezoCard?
    public var upcoming: [MezoCard]
    public var closed: [MezoCard]
    public var templates: [MezoCard]

    public static let empty = MezoGroups(running: nil, upcoming: [], closed: [], templates: [])
    public var isEmpty: Bool { running == nil && upcoming.isEmpty && closed.isEmpty && templates.isEmpty }
}

// MARK: - the pure grouping

public func mezoCards(blocks: [WireBlock], templates: [WireTemplate]) -> MezoGroups {
    let running = blocks.first { $0.status == "active" }.map { card(block: $0, kind: .running) }
    let upcoming = blocks.filter { $0.status == "planned" }
        .sorted { ($0.startDate ?? "") < ($1.startDate ?? "") }
        .map { card(block: $0, kind: .planned) }
    let closed = blocks.filter { $0.status == "archived" }
        .sorted { ($0.closedAt ?? $0.endDate ?? "") > ($1.closedAt ?? $1.endDate ?? "") }
        .map { card(block: $0, kind: .closed) }
    let cards = templates.compactMap { t -> MezoCard? in
        guard let id = t.id else { return nil }
        let days = (t.json["days"]?.array ?? []).map { d in
            (name: d["day"]?.string ?? "", focus: d["type"]?.string ?? "",
             sets: (d["exercises"]?.array ?? []).map { (muscle: $0["muscle"]?.string ?? "", sets: $0["workingSets"]?.int ?? 0) })
        }
        return MezoCard(id: "t:\(id)", kind: .template, title: t.title ?? "", dateText: "", split: t.split,
                        weeks: t.weeks, currentWeek: 0, loads: mezoLoads(t.phaseCurve), phases: mezoPhases(t.phaseCurve),
                        heat: mezoHeat(days.flatMap(\.sets)), runCount: t.runCount, hasReport: false, adherence: nil,
                        templateId: id, blockId: nil,
                        days: days.map { MezoDayPeek(name: $0.name, focus: $0.focus, exerciseCount: $0.sets.count) })
    }
    return MezoGroups(running: running, upcoming: upcoming, closed: closed, templates: cards)
}

private func card(block b: WireBlock, kind: MezoCard.Kind) -> MezoCard {
    let days = b.days ?? []
    let date: String = switch kind {
    case .closed: mezoRangeText(b.startDate, b.endDate)
    default: b.startDate.map(mezoFromText) ?? ""
    }
    return MezoCard(id: "b:\(b.id)", kind: kind, title: b.title, dateText: date, split: b.split, weeks: b.weeks,
                    currentWeek: b.currentWeek, loads: mezoLoads(b.phaseCurve), phases: mezoPhases(b.phaseCurve),
                    heat: mezoHeat(days.flatMap { $0.exercises.map { (muscle: $0.muscle, sets: $0.workingSets) } }),
                    runCount: 0, hasReport: b.hasReport ?? false, adherence: nil, templateId: b.templateId, blockId: b.id,
                    days: days.map { MezoDayPeek(name: $0.day, focus: $0.type, exerciseCount: $0.exercises.count) })
}

func mezoLoads(_ curve: [String]) -> [Double] {
    curve.map { switch $0 { case "MEV": 0.45; case "MAV": 0.72; case "MRV": 1.0; case "Deload": 0.3; default: 0.5 } }
}

func mezoPhases(_ curve: [String]) -> [String] {
    curve.map { switch $0 { case "MEV": "Alap"; case "MAV": "Építés"; case "MRV": "Csúcs"; case "Deload": "Pihenőhét"; default: "" } }
}

func mezoHeat(_ rows: [(muscle: String, sets: Int)]) -> [String: Double] {
    var sum: [String: Int] = [:]
    for r in rows where !r.muscle.isEmpty { sum[r.muscle, default: 0] += r.sets }
    guard let top = sum.values.max(), top > 0 else { return [:] }
    return sum.mapValues { Double($0) / Double(top) }
}

private let mezoMonths = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]

private func mezoParts(_ iso: String) -> (month: Int, day: Int)? {
    let p = iso.prefix(10).split(separator: "-")
    guard p.count == 3, let m = Int(p[1]), let d = Int(p[2]), (1...12).contains(m) else { return nil }
    return (m, d)
}

/// „okt. 13-tól”, „márc. 5-től” — the -tól/-től follows how the number is said.
public func mezoFromText(_ iso: String) -> String {
    guard let (m, d) = mezoParts(iso) else { return "" }
    let back: Bool = {
        let last = d % 10
        if last == 0 { return d != 10 } // tíz → től; húsz, harminc → tól
        return [3, 6, 8].contains(last)
    }()
    return "\(mezoMonths[m - 1]) \(d)-\(back ? "tól" : "től")"
}

/// „júl. 7. – aug. 17.”
public func mezoRangeText(_ start: String?, _ end: String?) -> String {
    func one(_ iso: String?) -> String? { iso.flatMap(mezoParts).map { "\(mezoMonths[$0.month - 1]) \($0.day)." } }
    switch (one(start), one(end)) {
    case let (s?, e?): return "\(s) – \(e)"
    case let (s?, nil): return s
    default: return ""
    }
}

// MARK: - the model

@Observable @MainActor
public final class MezociklusokModel {
    public enum Phase: Equatable { case loading, ready, failed(PlanFetchError) }

    struct Snapshot: Codable, Sendable { var blocks: [WireBlock]; var templates: [WireTemplate] }
    static let cacheEndpoint = "train/mezociklusok"
    static let cacheKey = "-"
    static let cacheMaxAge: TimeInterval = 30 * 86_400
    static let reportLimit = 8

    public private(set) var phase: Phase = .loading
    public private(set) var groups: MezoGroups = .empty
    /// The cached copy's age while the server cannot be reached; nil when the list is fresh.
    public private(set) var ageText: String?
    public private(set) var busy = false
    /// Why the last action did not happen, in his words.
    public private(set) var lastError: String?
    /// Loaded reports of closed runs, by block id.
    public private(set) var reports: [String: WireReport] = [:]

    public var offline: Bool { ageText != nil }

    @ObservationIgnored private let client: PlanClient
    @ObservationIgnored private let cache: ServerCache?
    @ObservationIgnored private let clock: () -> Date
    @ObservationIgnored private var closedButNotStarted: String?

    public init(client: PlanClient, cache: ServerCache?, clock: @escaping () -> Date = Date.init) {
        self.client = client
        self.cache = cache
        self.clock = clock
    }

    /// The cached list first (so the page is never blank), then the server's; offline keeps the copy with its age.
    public func load() async {
        if phase != .ready, let hit = await cache?.get(Snapshot.self, endpoint: Self.cacheEndpoint, date: Self.cacheKey,
                                                       maxAge: Self.cacheMaxAge) {
            apply(hit.value)
            phase = .ready
            ageText = YearPlanModel.ageText(hit.age)
        }
        do {
            let blocks = try await client.allBlocks()
            let templates = try await client.templates()
            let snap = Snapshot(blocks: blocks, templates: templates)
            apply(snap)
            ageText = nil
            phase = .ready
            try? await cache?.put(snap, endpoint: Self.cacheEndpoint, date: Self.cacheKey)
            await loadReports()
        } catch {
            if phase != .ready { phase = .failed(error) }
        }
    }

    private func apply(_ snap: Snapshot) {
        var g = mezoCards(blocks: snap.blocks, templates: snap.templates)
        for i in g.closed.indices { g.closed[i].adherence = adherence(reports[g.closed[i].blockId ?? ""]) }
        groups = g
    }

    private func adherence(_ r: WireReport?) -> Double? {
        r?.adherence?.completionPct.map { Double($0) / 100 }
    }

    private func loadReports() async {
        let ids = groups.closed.filter(\.hasReport).prefix(Self.reportLimit).compactMap(\.blockId)
            .filter { reports[$0] == nil }
        guard !ids.isEmpty else { return }
        let client = client
        let loaded = await withTaskGroup(of: (String, WireReport?).self) { group in
            for id in ids { group.addTask { (id, try? await client.report(id: id)) } }
            var out: [String: WireReport] = [:]
            for await (id, r) in group { if let r { out[id] = r } }
            return out
        }
        reports.merge(loaded) { _, new in new }
        for i in groups.closed.indices { groups.closed[i].adherence = adherence(reports[groups.closed[i].blockId ?? ""]) }
    }

    // MARK: actions — one at a time; a tap while one runs is ignored

    private var today: String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Budapest") ?? .current
        let c = cal.dateComponents([.year, .month, .day], from: clock())
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    private func act<T>(_ op: () async throws(PlanFetchError) -> T) async -> T? {
        guard !busy else { return nil }
        busy = true
        lastError = nil
        closedButNotStarted = nil
        defer { busy = false }
        do {
            let result = try await op()
            await load()
            return result
        } catch {
            lastError = closedButNotStarted.map { "A(z) „\($0)” lezárult, de az új nem indult el. " } .map { $0 + Self.message(error) }
                ?? Self.message(error)
            await load()
            return nil
        }
    }

    /// Closes the running one first (so it keeps its report), then runs `start`. When the start fails after the
    /// close, the error says the old one is already closed.
    private func replacingRunning(_ start: () async throws(PlanFetchError) -> WireBlock) async throws(PlanFetchError) -> WireBlock {
        guard let running = groups.running, let id = running.blockId else { return try await start() }
        _ = try await client.closeBlock(id: id, selfEval: nil)
        do throws(PlanFetchError) {
            return try await start()
        } catch {
            closedButNotStarted = running.title
            throw error
        }
    }

    public func start(template: MezoCard) async -> WireBlock? {
        guard let id = template.templateId else { return nil }
        let day = today
        return await act { () throws(PlanFetchError) -> WireBlock in
            try await replacingRunning { () throws(PlanFetchError) -> WireBlock in
                try await client.startTemplate(id: id, startDate: day, status: "active")
            }
        }
    }

    public func activate(planned: MezoCard) async -> WireBlock? {
        guard let id = planned.blockId else { return nil }
        return await act { () throws(PlanFetchError) -> WireBlock in
            try await replacingRunning { () throws(PlanFetchError) -> WireBlock in try await client.activate(id: id) }
        }
    }

    public func rerun(closed: MezoCard) async -> WireBlock? {
        guard let id = closed.blockId else { return nil }
        let day = today
        return await act { () throws(PlanFetchError) -> WireBlock in
            try await replacingRunning { () throws(PlanFetchError) -> WireBlock in
                let templateId = try await client.rerun(id: id)
                return try await client.startTemplate(id: templateId, startDate: day, status: "active")
            }
        }
    }

    public func restart(running: MezoCard, updateTemplate: Bool) async -> WireBlock? {
        guard let id = running.blockId else { return nil }
        return await act { () throws(PlanFetchError) -> WireBlock in
            try await client.restart(id: id, updateTemplate: updateTemplate)
        }
    }

    public func saveToTemplate(running: MezoCard) async -> Bool {
        guard let id = running.blockId else { return false }
        return await act { () throws(PlanFetchError) -> String in try await client.saveToTemplate(id: id) } != nil
    }

    public func close(running: MezoCard, selfEval: String?) async -> WireBlock? {
        guard let id = running.blockId else { return nil }
        let note = selfEval?.trimmingCharacters(in: .whitespacesAndNewlines)
        return await act { () throws(PlanFetchError) -> WireBlock in
            try await client.closeBlock(id: id, selfEval: (note?.isEmpty ?? true) ? nil : note)
        }
    }

    /// Where the running one stands, for the restart sheet. `done` (workouts done) only when it can be counted from
    /// logged data — the list does not carry it, so it is nil rather than a guess.
    public nonisolated static func restartStats(running: MezoCard) -> (week: Int, of: Int, done: Int?) {
        (running.currentWeek, running.weeks, nil)
    }

    public nonisolated static func message(_ error: PlanFetchError) -> String {
        switch error {
        case .offline: "Most nem érem el a szervert — próbáld újra, ha van net."
        case .unauthorized: "Lejárt a bejelentkezésed. Lépj be újra."
        case .notFound: "Ezt a mezociklust már nem találom."
        case .rejected: "A szerver ezt így nem fogadta el."
        case .conflict("SEASON_REQUIRED"): "Mezociklust csak futó évadban indíthatsz. Az Évad oldalon indíthatsz egyet."
        case .conflict("TRAIN_MESO_NOT_ACTIVE"): "Ez a mezociklus közben már nem fut, ezért nem változott."
        case .conflict: "Ez közben megváltozott, ezért nem történt semmi."
        case .dayWorkoutRunning: "Most fut egy edzésed — fejezd be előbb."
        case .server: "Valami elakadt a szerveren. Próbáld újra kicsit később."
        }
    }
}

// MARK: - the report

@Observable @MainActor
public final class MezoReportModel {
    public enum AIState: Equatable, Sendable { case pending, ready(String), off, failed }
    public enum Phase: Equatable { case loading, ready, failed(PlanFetchError) }

    public private(set) var phase: Phase = .loading
    public private(set) var report: WireReport?
    public var aiState: AIState { report.map(Self.aiState(of:)) ?? .pending }

    @ObservationIgnored private let client: PlanClient
    @ObservationIgnored private let interval: Duration
    @ObservationIgnored private var poll: Task<Void, Never>?

    public init(client: PlanClient, interval: Duration = .seconds(10)) {
        self.client = client
        self.interval = interval
    }

    public nonisolated static func aiState(of r: WireReport) -> AIState {
        if r.aiEvalEnabled == false { return .off }
        switch r.aiEvalStatus {
        case "ready": return r.aiEval.map { .ready($0) } ?? .off
        case "pending": return .pending
        case "failed": return .failed
        default: return .off
        }
    }

    /// Reads the report; while Boop's evaluation is pending it re-reads every `interval` until it is not.
    public func load(blockId: String) async {
        poll?.cancel()
        do {
            report = try await client.report(id: blockId)
            phase = .ready
        } catch {
            if report == nil { phase = .failed(error) }
            return
        }
        guard aiState == .pending else { return }
        let client = client, interval = interval
        poll = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: interval)
                if Task.isCancelled { return }
                guard let fresh = try? await client.report(id: blockId) else { continue }
                guard let self else { return }
                self.report = fresh
                if Self.aiState(of: fresh) != .pending { return }
            }
        }
    }

    public func stop() {
        poll?.cancel()
        poll = nil
    }
}
