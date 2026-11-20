import Foundation

// The Pénz area's wire (L5, `mezo-r36n9.103`) — hand-decoded, like the block builder's (`Train/PlanWire.swift`), and
// for the same reason: the generated client decodes every enum strictly, and the money API is still growing (the
// savings goals land in parallel with this slice). Every enum here is a plain string the screens map; a missing
// field falls back to a value that is visibly "nothing" (0, empty), never to an invented figure.
//
// Money is `PenzMoney {minor, currency, hufMinor}`: minor = 1/100 of the unit for every currency, HUF included
// (15 500 Ft = 1 550 000). The screens print `hufMinor / 100` as whole forints (`penzFt`).
//
// Everything is `Codable` so a read can sit in `ServerCache` and the page renders offline with its age.

private extension KeyedDecodingContainer {
    func lenient<T: Decodable>(_ key: Key, _ fallback: T) -> T { ((try? decodeIfPresent(T.self, forKey: key)) ?? nil) ?? fallback }
    func optional<T: Decodable>(_ key: Key) -> T? { (try? decodeIfPresent(T.self, forKey: key)) ?? nil }
}

/// An amount in minor units, in its own currency, with its HUF twin (stored by the server at write time).
public struct PenzMoney: Codable, Equatable, Sendable {
    public var minor: Int64
    public var currency: String
    public var hufMinor: Int64

    public init(minor: Int64, currency: String = "HUF", hufMinor: Int64? = nil) {
        self.minor = minor; self.currency = currency; self.hufMinor = hufMinor ?? minor
    }
    public static func huf(_ minor: Int64) -> PenzMoney { PenzMoney(minor: minor) }
    public static let zero = PenzMoney(minor: 0)

    private enum CodingKeys: String, CodingKey { case minor, currency, hufMinor }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        minor = c.lenient(.minor, 0)
        currency = c.lenient(.currency, "HUF")
        hufMinor = c.optional(.hufMinor) ?? (currency == "HUF" ? minor : 0)
    }
}

/// One line of the allowance derivation (`recurringIncome`, `oneOffIncome`, `fixedCosts`, `savingsTarget`,
/// `practice`, `invested`, `previousDeficit`, `free`, `spent`, `remaining` — penz.md §3.1).
public struct PenzAllowanceLine: Codable, Equatable, Sendable {
    public var key: String
    public var amount: PenzMoney
    public init(key: String, amount: PenzMoney) { self.key = key; self.amount = amount }
    private enum CodingKeys: String, CodingKey { case key, amount }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        key = c.lenient(.key, ""); amount = c.lenient(.amount, .zero)
    }
}

/// `GET /api/penz/allowance` — the month's free money, the week's budget and what is left, with the derivation.
public struct PenzAllowance: Codable, Equatable, Sendable {
    public struct Month: Codable, Equatable, Sendable {
        /// `YYYY-MM`.
        public var month: String
        public var free: PenzMoney, spent: PenzMoney, remaining: PenzMoney
        public init(month: String, free: PenzMoney, spent: PenzMoney, remaining: PenzMoney) {
            self.month = month; self.free = free; self.spent = spent; self.remaining = remaining
        }
        private enum CodingKeys: String, CodingKey { case month, free, spent, remaining }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            month = c.lenient(.month, ""); free = c.lenient(.free, .zero)
            spent = c.lenient(.spent, .zero); remaining = c.lenient(.remaining, .zero)
        }
    }
    public struct Week: Codable, Equatable, Sendable {
        /// `YYYY-MM-DD`, Monday … Sunday.
        public var start: String, end: String
        public var budget: PenzMoney, spent: PenzMoney, remaining: PenzMoney, perDay: PenzMoney
        public init(start: String, end: String, budget: PenzMoney, spent: PenzMoney, remaining: PenzMoney, perDay: PenzMoney) {
            self.start = start; self.end = end; self.budget = budget; self.spent = spent
            self.remaining = remaining; self.perDay = perDay
        }
        private enum CodingKeys: String, CodingKey { case start, end, budget, spent, remaining, perDay }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            start = c.lenient(.start, ""); end = c.lenient(.end, "")
            budget = c.lenient(.budget, .zero); spent = c.lenient(.spent, .zero)
            remaining = c.lenient(.remaining, .zero); perDay = c.lenient(.perDay, .zero)
        }
    }
    /// The date asked (`YYYY-MM-DD`, the owner's money timezone).
    public var date: String
    public var month: Month
    public var week: Week
    public var lines: [PenzAllowanceLine]

    public init(date: String, month: Month, week: Week, lines: [PenzAllowanceLine]) {
        self.date = date; self.month = month; self.week = week; self.lines = lines
    }
    private enum CodingKeys: String, CodingKey { case date, month, week, lines }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = c.lenient(.date, "")
        month = try c.decode(Month.self, forKey: .month)
        week = try c.decode(Week.self, forKey: .week)
        lines = c.lenient(.lines, [])
    }

    /// One derivation line's HUF amount (0 when the server did not send it).
    public func line(_ key: String) -> Int64 { lines.first { $0.key == key }?.amount.hufMinor ?? 0 }
}

/// One transaction (`PenzTransactionResponse`).
public struct PenzTransaction: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var accountId: String
    /// `expense`, `income`, `transfer_out`, `transfer_in`, `invest_buy`, `invest_sell`.
    public var kind: String
    public var amount: PenzMoney
    public var categoryId: String?
    /// `YYYY-MM-DD`.
    public var date: String
    public var note: String?
    /// `manual`, `sms`, `recurring`.
    public var source: String
    public var needsReview: Bool
    public var recurringRuleId: String?
    public var clientRef: String?

    public init(id: String, accountId: String, kind: String, amount: PenzMoney, categoryId: String? = nil, date: String,
                note: String? = nil, source: String = "manual", needsReview: Bool = false, recurringRuleId: String? = nil,
                clientRef: String? = nil) {
        self.id = id; self.accountId = accountId; self.kind = kind; self.amount = amount; self.categoryId = categoryId
        self.date = date; self.note = note; self.source = source; self.needsReview = needsReview
        self.recurringRuleId = recurringRuleId; self.clientRef = clientRef
    }
    private enum CodingKeys: String, CodingKey {
        case id, accountId, kind, amount, categoryId, date, note, source, needsReview, recurringRuleId, clientRef
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        accountId = c.lenient(.accountId, ""); kind = c.lenient(.kind, "expense")
        amount = c.lenient(.amount, .zero); categoryId = c.optional(.categoryId)
        date = c.lenient(.date, ""); note = c.optional(.note); source = c.lenient(.source, "manual")
        needsReview = c.lenient(.needsReview, false); recurringRuleId = c.optional(.recurringRuleId)
        clientRef = c.optional(.clientRef)
    }
}

/// One category (`PenzCategoryResponse`).
public struct PenzCategory: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    /// `expense` or `income`.
    public var kind: String
    public var icon: String?
    public var monthlyBudgetHufMinor: Int64?
    public var position: Int

    public init(id: String, name: String, kind: String = "expense", icon: String? = nil, monthlyBudgetHufMinor: Int64? = nil,
                position: Int = 0) {
        self.id = id; self.name = name; self.kind = kind; self.icon = icon
        self.monthlyBudgetHufMinor = monthlyBudgetHufMinor; self.position = position
    }
    private enum CodingKeys: String, CodingKey { case id, name, kind, icon, monthlyBudgetHufMinor, position }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = c.lenient(.name, ""); kind = c.lenient(.kind, "expense"); icon = c.optional(.icon)
        monthlyBudgetHufMinor = c.optional(.monthlyBudgetHufMinor); position = c.lenient(.position, 0)
    }
}

/// One account (`PenzAccountResponse`).
public struct PenzAccount: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    /// `checking`, `savings`, `cash`, `investment`.
    public var type: String
    public var currency: String
    public var isDefault: Bool
    public var isSavingsTarget: Bool
    public var archived: Bool

    public init(id: String, name: String, type: String, currency: String = "HUF", isDefault: Bool = false,
                isSavingsTarget: Bool = false, archived: Bool = false) {
        self.id = id; self.name = name; self.type = type; self.currency = currency; self.isDefault = isDefault
        self.isSavingsTarget = isSavingsTarget; self.archived = archived
    }
    private enum CodingKeys: String, CodingKey { case id, name, type, currency, isDefault, isSavingsTarget, archived }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = c.lenient(.name, ""); type = c.lenient(.type, "checking"); currency = c.lenient(.currency, "HUF")
        isDefault = c.lenient(.isDefault, false); isSavingsTarget = c.lenient(.isSavingsTarget, false)
        archived = c.lenient(.archived, false)
    }
}

/// A month close, or an open month with the figures a close would store now (`PenzMonthCloseResponse`).
public struct PenzMonthClose: Codable, Equatable, Sendable {
    /// `YYYY-MM`.
    public var month: String
    public var closed: Bool
    public var finalRemaining: PenzMoney?
    public var deficit: PenzMoney?
    /// `transferred`, `kept`, `none`.
    public var leftoverAction: String?

    public init(month: String, closed: Bool, finalRemaining: PenzMoney? = nil, deficit: PenzMoney? = nil,
                leftoverAction: String? = nil) {
        self.month = month; self.closed = closed; self.finalRemaining = finalRemaining; self.deficit = deficit
        self.leftoverAction = leftoverAction
    }
    private enum CodingKeys: String, CodingKey { case month, closed, finalRemaining, deficit, leftoverAction }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        month = c.lenient(.month, ""); closed = c.lenient(.closed, false)
        finalRemaining = c.optional(.finalRemaining); deficit = c.optional(.deficit)
        leftoverAction = c.optional(.leftoverAction)
    }
}

/// One month's own override of the settings (kept as the server sent it, so a settings save never drops it).
public struct PenzMonthOverride: Codable, Equatable, Sendable {
    public var savingsTargetHufMinor: Int64?
    public var categoryBudgets: [String: Int64]?
    public init(savingsTargetHufMinor: Int64? = nil, categoryBudgets: [String: Int64]? = nil) {
        self.savingsTargetHufMinor = savingsTargetHufMinor; self.categoryBudgets = categoryBudgets
    }
}

/// `GET/PUT /api/penz/settings`.
public struct PenzSettings: Codable, Equatable, Sendable {
    public var savingsTargetHufMinor: Int64
    /// Gyakorlás — the monthly practice cap, deducted like a fixed cost.
    public var practiceMonthlyHufMinor: Int64
    public var weekStart: String?
    public var emergencyFundMonths: Int?
    public var timezone: String?
    public var monthOverrides: [String: PenzMonthOverride]?

    public init(savingsTargetHufMinor: Int64, practiceMonthlyHufMinor: Int64, weekStart: String? = nil,
                emergencyFundMonths: Int? = nil, timezone: String? = nil, monthOverrides: [String: PenzMonthOverride]? = nil) {
        self.savingsTargetHufMinor = savingsTargetHufMinor; self.practiceMonthlyHufMinor = practiceMonthlyHufMinor
        self.weekStart = weekStart; self.emergencyFundMonths = emergencyFundMonths; self.timezone = timezone
        self.monthOverrides = monthOverrides
    }
    private enum CodingKeys: String, CodingKey {
        case savingsTargetHufMinor, practiceMonthlyHufMinor, weekStart, emergencyFundMonths, timezone, monthOverrides
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        savingsTargetHufMinor = c.lenient(.savingsTargetHufMinor, 0)
        practiceMonthlyHufMinor = c.lenient(.practiceMonthlyHufMinor, 0)
        weekStart = c.optional(.weekStart); emergencyFundMonths = c.optional(.emergencyFundMonths)
        timezone = c.optional(.timezone); monthOverrides = c.optional(.monthOverrides)
    }
}

/// A savings goal or a purchase plan (`GET/POST /api/penz/savings-goals`, `PUT/DELETE …/{id}`).
public struct PenzGoal: Codable, Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    /// `goal` or `purchase`.
    public var kind: String
    public var target: PenzMoney
    public var saved: PenzMoney
    /// `YYYY-MM-DD`.
    public var dueDate: String?
    public var note: String?
    public var position: Int
    public var clientRef: String?

    public init(id: String, name: String, kind: String = "goal", target: PenzMoney, saved: PenzMoney = .zero,
                dueDate: String? = nil, note: String? = nil, position: Int = 0, clientRef: String? = nil) {
        self.id = id; self.name = name; self.kind = kind; self.target = target; self.saved = saved
        self.dueDate = dueDate; self.note = note; self.position = position; self.clientRef = clientRef
    }
    private enum CodingKeys: String, CodingKey { case id, name, kind, target, saved, dueDate, note, position, clientRef }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = c.lenient(.name, ""); kind = c.lenient(.kind, "goal")
        target = c.lenient(.target, .zero); saved = c.lenient(.saved, .zero)
        dueDate = c.optional(.dueDate); note = c.optional(.note); position = c.lenient(.position, 0)
        clientRef = c.optional(.clientRef)
    }
}

// MARK: - Requests

public struct PenzSettingsRequest: Encodable, Equatable, Sendable {
    public var savingsTargetHufMinor: Int64
    public var practiceMonthlyHufMinor: Int64
    public var weekStart: String?
    public var emergencyFundMonths: Int?
    public var timezone: String?
    public var monthOverrides: [String: PenzMonthOverride]?

    /// Only the two lines he edits; the server keeps every field left out.
    public init(savingsTargetHufMinor: Int64, practiceMonthlyHufMinor: Int64) {
        self.savingsTargetHufMinor = savingsTargetHufMinor; self.practiceMonthlyHufMinor = practiceMonthlyHufMinor
    }

    /// The two lines he edits, everything else carried over from a **fresh** read of the settings (so a save never
    /// resets the timezone or a month's own override).
    public init(from settings: PenzSettings, savingsTargetHufMinor: Int64, practiceMonthlyHufMinor: Int64) {
        self.savingsTargetHufMinor = savingsTargetHufMinor; self.practiceMonthlyHufMinor = practiceMonthlyHufMinor
        weekStart = settings.weekStart; emergencyFundMonths = settings.emergencyFundMonths
        timezone = settings.timezone; monthOverrides = settings.monthOverrides
    }
}

/// `PenzTransactionRequest` — a create (with `clientRef`) or a full update.
public struct PenzTransactionRequest: Codable, Equatable, Sendable {
    public var clientRef: String?
    public var accountId: String
    public var kind: String
    public var amountMinor: Int64
    public var currency: String
    public var categoryId: String?
    public var date: String
    public var note: String?

    public init(clientRef: String? = nil, accountId: String, kind: String, amountMinor: Int64, currency: String,
                categoryId: String? = nil, date: String, note: String? = nil) {
        self.clientRef = clientRef; self.accountId = accountId; self.kind = kind; self.amountMinor = amountMinor
        self.currency = currency; self.categoryId = categoryId; self.date = date; self.note = note
    }

    /// The same transaction with another category — what the review sheet's "Rendben" sends.
    public init(updating t: PenzTransaction, categoryId: String?) {
        self.init(accountId: t.accountId, kind: t.kind, amountMinor: t.amount.minor, currency: t.amount.currency,
                  categoryId: categoryId, date: t.date, note: t.note)
    }
}

public struct PenzMonthCloseRequest: Encodable, Equatable, Sendable {
    /// `transferred`, `kept` or `none`.
    public var leftoverAction: String
    public init(leftoverAction: String) { self.leftoverAction = leftoverAction }
}

public struct PenzGoalRequest: Encodable, Equatable, Sendable {
    public var clientRef: String?
    public var name: String
    public var kind: String
    public var targetHufMinor: Int64
    public var savedHufMinor: Int64?
    public var dueDate: String?
    public var note: String?
    public var position: Int?

    public init(clientRef: String? = nil, name: String, kind: String, targetHufMinor: Int64, savedHufMinor: Int64? = nil,
                dueDate: String? = nil, note: String? = nil, position: Int? = nil) {
        self.clientRef = clientRef; self.name = name; self.kind = kind; self.targetHufMinor = targetHufMinor
        self.savedHufMinor = savedHufMinor; self.dueDate = dueDate; self.note = note; self.position = position
    }
}

/// `POST /api/penz/accounts` — L5 only ever creates the one forint cash account, on his tap, when he has none.
public struct PenzAccountRequest: Encodable, Equatable, Sendable {
    public var name: String
    public var type: String
    public var currency: String
    public var isDefault: Bool?

    public init(name: String, type: String, currency: String = "HUF", isDefault: Bool? = nil) {
        self.name = name; self.type = type; self.currency = currency; self.isDefault = isDefault
    }

    /// „Készpénz", forint, the default account (the first account becomes the default anyway).
    public static let cash = PenzAccountRequest(name: "Készpénz", type: "cash", currency: "HUF", isDefault: true)
}
