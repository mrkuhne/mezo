#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime
import BoopCore

/// Simulator review only (`-preview shell -previewHome penz`): the Pénz API answered locally with invented,
/// real-looking figures (the Élet spike's: 34 500 Ft left of the week, 980 000 in, 412 000 fixed …) — never the
/// owner's. The Mac's firewall blocks the simulator app's network, so this is how the area is looked at.
///
/// `-penzState review|calm|close|empty|offline|error` (default `review`): two bank messages to look at · nothing to do ·
/// October still open · no account yet · no net (the cache is primed five hours old, so the stale mark shows) ·
/// the server failing. `-previewOffline YES` keeps a typed cash expense in the outbox (the waiting row).
enum PenzPreview {
    static let raw = RawJSONClient(transport: PenzPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                   token: { "preview" })
    static let client = PenzClient(raw: raw)
    static let sender = PenzOutboxSender(raw: raw)
    static var state: String { UserDefaults.standard.string(forKey: "penzState") ?? "review" }

    /// `-penzState offline`: what the cache would hold from a read five hours ago.
    static func primeCache(_ directory: URL) async {
        guard state == "offline" else { return }
        let earlier = Date().addingTimeInterval(-5 * 3600)
        let cache = ServerCache(directory: directory, clock: { earlier })
        let model = PenzPreviewModel(state: "review")
        try? await cache.put(model.snapshot(), endpoint: "penz/snapshot", date: "current")
    }
}

/// The preview's money, kept for the run so a review, a close or a typed expense shows its effect.
final class PenzPreviewModel: @unchecked Sendable {
    let lock = NSLock()
    let state: String
    let today: String
    let month: String
    var settings = PenzSettings(savingsTargetHufMinor: 20_000_000, practiceMonthlyHufMinor: 2_000_000, weekStart: "monday",
                                emergencyFundMonths: 6, timezone: "Europe/Budapest", monthOverrides: [:])
    var transactions: [PenzTransaction] = []
    var goals: [PenzGoal] = []
    var open: [PenzMonthClose] = []
    /// Spend added during the run (typed cash), on top of the base week/month figures.
    var addedWeek: Int64 = 0, addedMonth: Int64 = 0

    static let categories: [PenzCategory] = [
        PenzCategory(id: "c0000000-0000-4000-8000-000000000001", name: "Élelmiszer", monthlyBudgetHufMinor: 12_000_000, position: 0),
        PenzCategory(id: "c0000000-0000-4000-8000-000000000002", name: "Éttermek", monthlyBudgetHufMinor: 5_000_000, position: 1),
        PenzCategory(id: "c0000000-0000-4000-8000-000000000003", name: "Közlekedés", monthlyBudgetHufMinor: 4_000_000, position: 2),
        PenzCategory(id: "c0000000-0000-4000-8000-000000000004", name: "Sport", monthlyBudgetHufMinor: 3_000_000, position: 3),
        PenzCategory(id: "c0000000-0000-4000-8000-000000000005", name: "Szórakozás", monthlyBudgetHufMinor: 2_000_000, position: 4),
        PenzCategory(id: "c0000000-0000-4000-8000-000000000006", name: "Egészség", position: 5),
        PenzCategory(id: "c0000000-0000-4000-8000-000000000007", name: "Lakás és rezsi", position: 6),
        PenzCategory(id: "c0000000-0000-4000-8000-000000000008", name: "Előfizetések", position: 7),
        PenzCategory(id: "c0000000-0000-4000-8000-000000000009", name: "Fizetés", kind: "income", position: 0),
    ]
    static let accounts: [PenzAccount] = [
        PenzAccount(id: "a0000000-0000-4000-8000-000000000001", name: "Folyószámla", type: "checking", isDefault: true),
        PenzAccount(id: "a0000000-0000-4000-8000-000000000002", name: "Megtakarítás", type: "savings", isSavingsTarget: true),
        PenzAccount(id: "a0000000-0000-4000-8000-000000000003", name: "Készpénz", type: "cash"),
    ]
    private static func cat(_ i: Int) -> String { categories[i - 1].id }
    private static let bank = accounts[0].id, cash = accounts[2].id

    init(state: String) {
        self.state = state
        let now = Date()
        today = penzDay(now)
        month = penzMonth(now)
        guard state != "empty" else { return }
        let dayOfMonth = penzDaysIntoMonth(today)
        func day(_ d: Int) -> String { String(format: "%@-%02d", month, max(1, min(d, dayOfMonth))) }
        func ago(_ n: Int) -> String { day(dayOfMonth - n) }
        var n = 0
        func add(_ ft: Int64, _ category: Int?, _ date: String, note: String? = nil, kind: String = "expense",
                 source: String = "manual", account: String = PenzPreviewModel.bank, review: Bool = false, rule: Bool = false) {
            n += 1
            transactions.append(PenzTransaction(
                id: String(format: "70000000-0000-4000-8000-%012d", n), accountId: account, kind: kind, amount: .huf(ft * 100),
                categoryId: category.map(Self.cat), date: date, note: note, source: source, needsReview: review,
                recurringRuleId: rule ? String(format: "90000000-0000-4000-8000-%012d", n) : nil))
        }
        // Today (the spike's two rows) and the two bank messages Boop was not sure of.
        add(8_240, 1, today, note: "Spar", source: "sms")
        add(1_890, 2, today, note: "Kávézó", account: Self.cash)
        let unsure = state == "review"
        add(3_900, 2, today, note: "Wolt", source: "sms", review: unsure)
        add(2_520, 3, ago(1), note: "OMV", source: "sms", review: unsure)
        // The rest of the month: food 96 400, restaurants 48 000, transport 31 200, sport 24 000, the rest 19 400.
        for (i, ft) in [14_320, 9_870, 21_450, 6_990, 12_380, 11_640, 11_510].enumerated() {
            add(Int64(ft), 1, ago(2 + i * 2), note: ["Lidl", "Aldi", "Tesco", "Spar", "Auchan", "Lidl", "Penny"][i], source: "sms")
        }
        for (i, ft) in [12_400, 8_900, 15_210, 5_700].enumerated() {
            add(Int64(ft), 2, ago(3 + i * 3), note: ["Bisztró", "Pizzéria", "Vacsora barátokkal", "Ebéd"][i], source: "sms")
        }
        for (i, ft) in [8_900, 9_480, 10_300].enumerated() { add(Int64(ft), 3, ago(4 + i * 4), note: ["MOL", "Shell", "Taxi"][i], source: "sms") }
        add(16_000, 4, ago(5), note: "Edzőterem havi")
        add(8_000, 4, ago(9), note: "Röplabda terem")
        add(12_000, 5, ago(6), note: "Mozi és vacsora", source: "sms")
        add(7_400, 6, ago(8), note: "Gyógyszertár", account: Self.cash)
        // The fixed costs and the salary, written by their recurring rules (not day-to-day spend).
        add(240_000, 7, day(1), note: "Lakbér", source: "recurring", rule: true)
        add(62_000, 7, day(5), note: "Rezsi", source: "recurring", rule: true)
        add(18_000, 8, day(3), note: "Előfizetések", source: "recurring", rule: true)
        add(92_000, 3, day(2), note: "Bérlet és autó", source: "recurring", rule: true)
        add(980_000, 9, day(1), note: "Fizetés", kind: "income", source: "recurring", rule: true)
        transactions.sort { $0.date > $1.date }
        goals = [
            PenzGoal(id: "60000000-0000-4000-8000-000000000001", name: "Tartalék · 6 hónap", target: .huf(210_000_000),
                     saved: .huf(148_000_000), position: 0),
            PenzGoal(id: "60000000-0000-4000-8000-000000000002", name: "Nyári út", target: .huf(60_000_000),
                     saved: .huf(32_000_000), dueDate: Self.nextJune(now), position: 1),
            PenzGoal(id: "60000000-0000-4000-8000-000000000003", name: "Futócipő", kind: "purchase", target: .huf(3_059_000),
                     saved: .huf(1_200_000), position: 2),
        ]
        if state == "close" {
            open = [PenzMonthClose(month: penzPreviousMonth(month), closed: false, finalRemaining: .huf(1_230_000), deficit: .zero)]
        }
    }

    private static func nextJune(_ now: Date) -> String {
        let y = penzCalendar.component(.year, from: now), m = penzCalendar.component(.month, from: now)
        return String(format: "%04d-06-15", m >= 6 ? y + 1 : y)
    }

    func allowance() -> PenzAllowance {
        guard state != "empty" else {
            let z = PenzMoney.zero
            return PenzAllowance(date: today, month: .init(month: month, free: z, spent: z, remaining: z),
                                 week: .init(start: today, end: today, budget: z, spent: z, remaining: z, perDay: z), lines: [])
        }
        let deficit: Int64 = state == "close" ? 0 : 1_400_000
        let lines: [(String, Int64)] = [
            ("recurringIncome", 98_000_000), ("oneOffIncome", 0), ("fixedCosts", 41_200_000),
            ("savingsTarget", settings.savingsTargetHufMinor), ("practice", settings.practiceMonthlyHufMinor),
            ("invested", 2_000_000), ("previousDeficit", deficit)]
        let free = lines[0].1 + lines[1].1 - lines[2].1 - lines[3].1 - lines[4].1 - lines[5].1 - lines[6].1
        let spent = 21_900_000 + addedMonth
        let start = penzDay(penzCalendar.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date())
        let end = penzDay(penzCalendar.date(byAdding: .day, value: 6, to: penzCalendar.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date()) ?? Date())
        let budget: Int64 = 7_700_000
        let weekSpent = 4_250_000 + addedWeek
        let remaining = budget - weekSpent
        let left = max(1, penzDaysInclusive(from: today, to: end))
        return PenzAllowance(
            date: today,
            month: .init(month: month, free: .huf(free), spent: .huf(spent), remaining: .huf(free - spent)),
            week: .init(start: start, end: end, budget: .huf(budget), spent: .huf(weekSpent), remaining: .huf(remaining),
                        perDay: .huf(max(0, remaining) / Int64(left))),
            lines: (lines + [("free", free), ("spent", spent), ("remaining", free - spent)])
                .map { PenzAllowanceLine(key: $0.0, amount: .huf($0.1)) })
    }

    func snapshot() -> PenzSnapshot {
        PenzSnapshot(allowance: allowance(), transactions: transactions, categories: Self.categories, accounts: Self.accounts,
                     openMonths: open, goals: goals, settings: settings)
    }
}

/// The Pénz operations, answered from `PenzPreviewModel`.
struct PenzPreviewTransport: ClientTransport {
    nonisolated(unsafe) static let model = PenzPreviewModel(state: PenzPreview.state)

    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        try await Task.sleep(for: .milliseconds(350))
        let state = PenzPreview.state
        if state == "offline" || (operationID == "createPenzTransaction" && UserDefaults.standard.bool(forKey: "previewOffline")) {
            throw URLError(.notConnectedToInternet)
        }
        if state == "error", operationID == "getPenzAllowance" { return (HTTPResponse(status: .internalServerError), nil) }
        var sent = Data()
        if let body { sent = try await Data(collecting: body, upTo: 1 << 16) }
        let m = Self.model
        let path = request.path ?? ""
        let segments = path.split(separator: "?")[0].split(separator: "/").map(String.init)
        let enc = JSONEncoder()
        func json<T: Encodable>(_ value: T) throws -> (HTTPResponse, HTTPBody?) {
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .ok, headerFields: h), HTTPBody(try enc.encode(value)))
        }
        return try m.lock.withLock {
            switch operationID {
            case "getPenzAllowance": return try json(m.allowance())
            case "listPenzTransactions": return try json(m.transactions)
            case "listPenzCategories": return try json(m.state == "empty" ? [] : PenzPreviewModel.categories)
            case "listPenzAccounts": return try json(m.state == "empty" ? [] : PenzPreviewModel.accounts)
            case "listOpenPenzMonths": return try json(m.open)
            case "getPenzSettings": return try json(m.settings)
            case "listPenzSavingsGoals": return try json(m.goals)
            case "putPenzSettings":
                struct S: Decodable { let savingsTargetHufMinor: Int64; let practiceMonthlyHufMinor: Int64 }
                let s = try JSONDecoder().decode(S.self, from: sent)
                m.settings.savingsTargetHufMinor = s.savingsTargetHufMinor
                m.settings.practiceMonthlyHufMinor = s.practiceMonthlyHufMinor
                return try json(m.settings)
            case "updatePenzTransaction":
                let r = try JSONDecoder().decode(PenzTransactionRequest.self, from: sent)
                guard let i = m.transactions.firstIndex(where: { $0.id == segments.last }) else { return (HTTPResponse(status: .notFound), nil) }
                m.transactions[i].categoryId = r.categoryId
                return try json(m.transactions[i])
            case "markPenzTransactionReviewed":
                guard let i = m.transactions.firstIndex(where: { $0.id == segments.dropLast().last }) else { return (HTTPResponse(status: .notFound), nil) }
                m.transactions[i].needsReview = false
                return try json(m.transactions[i])
            case "createPenzTransaction":
                let r = try JSONDecoder().decode(PenzTransactionRequest.self, from: sent)
                if let same = m.transactions.first(where: { $0.clientRef == r.clientRef }) { return try json(same) }
                let t = PenzTransaction(id: UUID().uuidString.lowercased(), accountId: r.accountId, kind: r.kind,
                                        amount: .huf(r.amountMinor), categoryId: r.categoryId, date: r.date, note: r.note,
                                        source: "manual", clientRef: r.clientRef)
                m.transactions.insert(t, at: 0)
                m.addedMonth += r.amountMinor; m.addedWeek += r.amountMinor
                return try json(t)
            case "closePenzMonth":
                struct C: Decodable { let leftoverAction: String }
                let c = try JSONDecoder().decode(C.self, from: sent)
                let month = segments.last ?? ""
                m.open.removeAll { $0.month == month }
                return try json(PenzMonthClose(month: month, closed: true, finalRemaining: .huf(1_230_000), deficit: .zero,
                                               leftoverAction: c.leftoverAction))
            case "createPenzSavingsGoal":
                struct G: Decodable { let name: String; let kind: String; let targetHufMinor: Int64; let savedHufMinor: Int64?
                                      let dueDate: String?; let note: String? }
                let g = try JSONDecoder().decode(G.self, from: sent)
                let goal = PenzGoal(id: UUID().uuidString.lowercased(), name: g.name, kind: g.kind, target: .huf(g.targetHufMinor),
                                    saved: .huf(g.savedHufMinor ?? 0), dueDate: g.dueDate, note: g.note, position: m.goals.count)
                m.goals.append(goal)
                return try json(goal)
            default:
                return (HTTPResponse(status: .notFound), nil)
            }
        }
    }
}
#endif
