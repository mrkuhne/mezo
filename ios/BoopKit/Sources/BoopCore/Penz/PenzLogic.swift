import Foundation

// The Pénz area's arithmetic and wording (L5, `mezo-r36n9.103`) — pure functions over the wire, unit-tested.
//
// The screens compute **nothing the server already computed**: the free money, the week's budget and the per-day
// figure are the allowance engine's (penz.md §3.1–3.2). What is worked out here is presentation — grouping the ten
// derivation lines into the six rows he reads, the category split, the tempo, which one thing Ma says — plus the
// one adjustment the server cannot know about: cash he typed in that has not reached it yet (`penzPendingAdjusted`).
//
// Copy rules (spec §6): never urge, never promise a return, never say sell, „Ma nincs dolgod" is a complete answer,
// always say why.

// MARK: - Money as text

/// Narrow no-break space: the Hungarian thousands separator that never breaks a figure across lines.
public let penzThin = "\u{202F}"
/// The true minus sign (a hyphen reads as a dash).
public let penzMinus = "\u{2212}"

/// Whole forints from minor units, rounded half away from zero (1/100 Ft is invisible).
public func penzWhole(_ minor: Int64) -> Int64 {
    let q = minor / 100, r = minor % 100
    if r >= 50 { return q + 1 }
    if r <= -50 { return q - 1 }
    return q
}

/// `34 500`, `−3 200` — whole forints, thin-space grouped, the true minus. No unit (the screens set "Ft" apart).
public func penzFt(_ minor: Int64) -> String {
    let whole = penzWhole(minor)
    let digits = String(whole.magnitude)
    var out = ""
    for (i, ch) in digits.enumerated() {
        if i > 0, (digits.count - i) % 3 == 0 { out += penzThin }
        out.append(ch)
    }
    return whole < 0 ? penzMinus + out : out
}

/// `34 500 Ft` — the figure inside a sentence.
public func penzFtUnit(_ minor: Int64) -> String { penzFt(minor) + "\u{00A0}Ft" }

/// `+ 980 000` / `− 412 000` — a derivation row's signed figure (the spike's spacing, with a no-break space).
public func penzFtSigned(_ minor: Int64, sign: PenzSign) -> String {
    let body = penzFt(minor < 0 ? -minor : minor)
    switch sign {
    case .plus: return "+\u{00A0}" + body
    case .minus: return minor == 0 ? body : penzMinus + "\u{00A0}" + body
    case .none: return penzFt(minor)
    }
}

/// Forints typed by him ("34 500", "34500", "34.500") → minor units; nil when it is not a positive whole amount.
public func penzParseFt(_ text: String) -> Int64? {
    let digits = text.filter(\.isNumber)
    guard !digits.isEmpty, digits.count <= 11, let ft = Int64(digits), ft > 0 else { return nil }
    return ft * 100
}

public enum PenzSign: Sendable { case plus, minus, none }

// MARK: - Dates

/// The money calendar: Gregorian, Monday-start, in the device zone (the server answers in his money timezone;
/// for one owner in Budapest the two are the same).
public let penzCalendar: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.firstWeekday = 2
    c.locale = Locale(identifier: "en_US_POSIX")
    return c
}()

/// `YYYY-MM-DD` of a date.
public func penzDay(_ date: Date, calendar: Calendar = penzCalendar) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

/// `YYYY-MM` of a date.
public func penzMonth(_ date: Date, calendar: Calendar = penzCalendar) -> String { String(penzDay(date, calendar: calendar).prefix(7)) }

/// `(year, month, day)` of `YYYY-MM-DD` / `YYYY-MM` (day 1 when absent).
func penzParts(_ s: String) -> (y: Int, m: Int, d: Int)? {
    let p = s.split(separator: "-").compactMap { Int($0) }
    guard p.count >= 2 else { return nil }
    return (p[0], p[1], p.count > 2 ? p[2] : 1)
}

/// Days from `from` to `to`, both `YYYY-MM-DD`, counting both ends (Wednesday → Sunday = 5). 0 when unreadable.
public func penzDaysInclusive(from: String, to: String) -> Int {
    guard let a = penzParts(from), let b = penzParts(to) else { return 0 }
    let ja = julian(a.y, a.m, a.d), jb = julian(b.y, b.m, b.d)
    return max(0, jb - ja + 1)
}

private func julian(_ y: Int, _ m: Int, _ d: Int) -> Int {
    let a = (14 - m) / 12, yy = y + 4800 - a, mm = m + 12 * a - 3
    return d + (153 * mm + 2) / 5 + 365 * yy + yy / 4 - yy / 100 + yy / 400 - 32045
}

private func daysInMonth(_ y: Int, _ m: Int) -> Int {
    switch m {
    case 2: return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 ? 29 : 28
    case 4, 6, 9, 11: return 30
    default: return 31
    }
}

/// Days left in the date's month, the date itself included (the 20th of November → 11).
public func penzDaysLeftInMonth(_ day: String) -> Int {
    guard let p = penzParts(day) else { return 0 }
    return daysInMonth(p.y, p.m) - p.d + 1
}

/// Days of the month gone by, the date itself included (the 20th → 20).
public func penzDaysIntoMonth(_ day: String) -> Int { penzParts(day)?.d ?? 0 }

/// The month before `YYYY-MM`.
public func penzPreviousMonth(_ month: String) -> String {
    guard let p = penzParts(month) else { return month }
    return p.m == 1 ? String(format: "%04d-12", p.y - 1) : String(format: "%04d-%02d", p.y, p.m - 1)
}

private let monthNames = ["január", "február", "március", "április", "május", "június", "július", "augusztus",
                          "szeptember", "október", "november", "december"]
/// „-ban/-ben": januárban … decemberben.
private let monthInessive = ["januárban", "februárban", "márciusban", "áprilisban", "májusban", "júniusban",
                             "júliusban", "augusztusban", "szeptemberben", "októberben", "novemberben", "decemberben"]
/// „-ra/-re": januárra … decemberre.
private let monthSublative = ["januárra", "februárra", "márciusra", "áprilisra", "májusra", "júniusra", "júliusra",
                              "augusztusra", "szeptemberre", "októberre", "novemberre", "decemberre"]
/// The accusative „-t": januárt … decembert.
private let monthAccusative = ["januárt", "februárt", "márciust", "áprilist", "májust", "júniust", "júliust",
                               "augusztust", "szeptembert", "októbert", "novembert", "decembert"]
/// „-i" adjective: januári … decemberi.
private let monthAdjective = ["januári", "februári", "márciusi", "áprilisi", "májusi", "júniusi", "júliusi",
                              "augusztusi", "szeptemberi", "októberi", "novemberi", "decemberi"]

public enum PenzMonthForm: Sendable { case name, inessive, sublative, accusative, adjective }

/// The month of `YYYY-MM(-DD)` in one of its forms, lowercase ("október", "októberben", "októberre", "októbert").
public func penzMonthWord(_ month: String, _ form: PenzMonthForm = .name) -> String {
    guard let p = penzParts(month), (1...12).contains(p.m) else { return "" }
    switch form {
    case .name: return monthNames[p.m - 1]
    case .inessive: return monthInessive[p.m - 1]
    case .sublative: return monthSublative[p.m - 1]
    case .accusative: return monthAccusative[p.m - 1]
    case .adjective: return monthAdjective[p.m - 1]
    }
}

/// "November 19." — a day head.
public func penzDayTitle(_ day: String) -> String {
    guard let p = penzParts(day) else { return day }
    return penzMonthWord(day).capitalizedFirst + " \(p.d)."
}

/// "A" or "Az" before a word (the article follows the first sound).
public func penzArticle(_ word: String) -> String {
    guard let c = word.lowercased().first else { return "A" }
    return "aáeéiíoóöőuúüű".contains(c) ? "Az" : "A"
}

extension String {
    /// The first letter upper-cased, the rest as it is ("október" → "Október").
    public var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}

// MARK: - The derivation ("Honnan jön ez a szám")

/// One of the six rows he reads in place of the server's ten lines.
public struct PenzDerivationRow: Equatable, Sendable, Identifiable {
    public enum Key: String, Sendable { case income, fixed, aside, practice, deficit, free }
    public let key: Key
    public let title: String
    public let sub: String
    /// HUF minor units, as a magnitude; the sign is `sign`.
    public let amount: Int64
    public let sign: PenzSign
    public var id: String { key.rawValue }
    public var glyph: String {
        switch key {
        case .income: "plus-ink"
        case .fixed: "clock-ink"
        case .aside: "star-sun"
        case .practice: "bolt-ink"
        case .deficit: "scale-ink"
        case .free: "check-ink"
        }
    }
}

/// The six rows of „Honnan jön ez a szám", in the spike's order: what comes in, the fixed costs, what is put aside
/// (savings target + invested), **Gyakorlás on its own line**, **the previous month's deficit on its own line, always**,
/// and what is free. `previousMonthOpen`: the previous month has no close yet, so the server counts its deficit as 0
/// for now — the row says so instead of claiming there was none.
public func penzDerivation(_ a: PenzAllowance, previousMonthOpen: Bool) -> [PenzDerivationRow] {
    let income = a.line("recurringIncome") + a.line("oneOffIncome")
    let aside = a.line("savingsTarget") + a.line("invested")
    let deficit = a.line("previousDeficit")
    let prev = penzPreviousMonth(a.month.month)
    let deficitSub: String
    if deficit > 0 {
        deficitSub = "\(penzMonthWord(prev, .inessive).capitalizedFirst) \(penzFtUnit(deficit))-tal csúsztál el"
    } else if previousMonthOpen {
        deficitSub = "\(penzArticle(penzMonthWord(prev, .adjective))) \(penzMonthWord(prev, .adjective)) hónap még nincs lezárva, ezért ez most 0"
    } else {
        deficitSub = "\(penzMonthWord(prev, .inessive).capitalizedFirst) nem csúsztál el, nincs mit levonni"
    }
    let free = a.line("free")
    return [
        PenzDerivationRow(key: .income, title: "Ami bejön", sub: "Fizetés és egyéb bevétel", amount: income, sign: .plus),
        PenzDerivationRow(key: .fixed, title: "Fix kiadások", sub: "Lakás, rezsi, előfizetések, bérletek",
                          amount: a.line("fixedCosts"), sign: .minus),
        PenzDerivationRow(key: .aside, title: "Amit félreteszel", sub: "Megtakarítás és befektetés", amount: aside, sign: .minus),
        PenzDerivationRow(key: .practice, title: "Gyakorlás",
                          sub: "A havi játékkeret — külön sor, hogy ne a befektetésből menjen",
                          amount: a.line("practice"), sign: .minus),
        PenzDerivationRow(key: .deficit, title: "Az előző hónap hiánya", sub: deficitSub, amount: deficit, sign: .minus),
        PenzDerivationRow(key: .free, title: "Ami szabadon marad", sub: "Ezt osztom szét a hónap hetei között",
                          amount: free, sign: .none),
    ]
}

// MARK: - Cash not yet on the server

/// One cash expense still in the outbox, as the screens need it.
public struct PenzPendingExpense: Equatable, Sendable, Identifiable {
    /// The outbox item's id = the transaction's `clientRef`.
    public let id: UUID
    public let payload: PenzExpensePayload
    /// Refused by the server (waits for "Újra"), not merely waiting for the net.
    public let refused: Bool
    public init(id: UUID, payload: PenzExpensePayload, refused: Bool = false) {
        self.id = id; self.payload = payload; self.refused = refused
    }
}

/// The pending cash the server does not know about yet: everything queued whose `clientRef` is not already among the
/// transactions he sees (a delivered item, before the next read, must not count twice). Refused items do not count —
/// they are not going to the server by themselves.
public func penzUnsent(_ pending: [PenzPendingExpense], transactions: [PenzTransaction]) -> [PenzPendingExpense] {
    let known = Set(transactions.compactMap { $0.clientRef?.lowercased() })
    return pending.filter { !$0.refused && !known.contains($0.id.uuidString.lowercased()) }
}

/// The allowance as it stands once the cash typed on the phone is counted: each unsent expense dated inside the week
/// lowers the week's remaining and raises its spend; inside the month, the month's too. `perDay` is recomputed the
/// engine's way (`max(0, remaining) / days left counting the date`, floored to a minor unit).
public func penzPendingAdjusted(_ a: PenzAllowance, unsent: [PenzPendingExpense]) -> PenzAllowance {
    guard !unsent.isEmpty else { return a }
    var out = a
    var week: Int64 = 0, month: Int64 = 0
    for p in unsent {
        let d = p.payload.date
        if d >= a.week.start && d <= a.week.end { week += p.payload.amountMinor }
        if d.hasPrefix(a.month.month) { month += p.payload.amountMinor }
    }
    out.week.spent.hufMinor += week; out.week.spent.minor += week
    out.week.remaining.hufMinor -= week; out.week.remaining.minor -= week
    out.month.spent.hufMinor += month; out.month.spent.minor += month
    out.month.remaining.hufMinor -= month; out.month.remaining.minor -= month
    let left = max(1, penzDaysInclusive(from: a.date, to: a.week.end))
    let perDay = max(0, out.week.remaining.hufMinor) / Int64(left)
    out.week.perDay = .huf(perDay)
    return out
}

// MARK: - The week

/// The week's figures for the hero and the orb.
public struct PenzWeekFigures: Equatable, Sendable {
    public let remaining: Int64, budget: Int64, spent: Int64, perDay: Int64
    /// Days left in the week, the date itself included.
    public let daysLeft: Int
    /// Days the week has (normally 7).
    public let daysInWeek: Int
    /// remaining / budget, clamped 0…1 — the orb's level and the hero's bar. A week with no budget is empty, never full.
    public var level: Double { penzLevel(remaining, of: budget) }
    /// Where the "days left" marker sits on the bar.
    public var marker: Double { daysInWeek > 0 ? min(1, max(0, Double(daysLeft) / Double(daysInWeek))) : 0 }
}

public func penzWeek(_ a: PenzAllowance) -> PenzWeekFigures {
    PenzWeekFigures(remaining: a.week.remaining.hufMinor, budget: a.week.budget.hufMinor, spent: a.week.spent.hufMinor,
                    perDay: a.week.perDay.hufMinor,
                    daysLeft: penzDaysInclusive(from: a.date, to: a.week.end),
                    daysInWeek: penzDaysInclusive(from: a.week.start, to: a.week.end))
}

/// `part / whole` clamped to 0…1; 0 when there is no whole.
public func penzLevel(_ part: Int64, of whole: Int64) -> Double {
    guard whole > 0 else { return 0 }
    return min(1, max(0, Double(part) / Double(whole)))
}

/// "4 nap van hátra" / "Ma van az utolsó nap".
public func penzDaysLeftText(_ days: Int) -> String { days <= 1 ? "Ma van az utolsó nap" : "\(days) nap van hátra" }

/// The page head (every tab): the week in one headline and one sentence with the figures behind it.
public func penzHead(_ a: PenzAllowance) -> (headline: String, sentence: String) {
    let w = penzWeek(a)
    let monthLeft = a.month.remaining.hufMinor
    if w.remaining >= 0 {
        return ("Ezen a héten még \(penzFtUnit(w.remaining))-od van",
                "Napi \(penzFtUnit(w.perDay)) jut egy napra, a hónapból \(penzFtUnit(max(0, monthLeft))) maradt.")
    }
    return ("Ezen a héten \(penzFtUnit(-w.remaining))-tal túl vagy a kereten",
            monthLeft >= 0 ? "A hónapból még \(penzFtUnit(monthLeft)) maradt, a hét többi napja ebből jön."
                           : "A hónap is a keret fölött jár, \(penzFtUnit(-monthLeft))-tal.")
}

/// The hero's note: "Napi *8 600 Ft*. A hét eddigi költése 42 500 Ft volt."
public func penzWeekNote(_ w: PenzWeekFigures) -> String {
    "Napi *\(penzFtUnit(w.perDay))*. A hét eddigi költése \(penzFtUnit(w.spent)) volt."
}

// MARK: - Tempo

/// The month's day-to-day spend per day so far (the date itself counted).
public func penzPace(_ a: PenzAllowance) -> Int64 {
    let days = max(1, penzDaysIntoMonth(a.date))
    return max(0, a.month.spent.hufMinor) / Int64(days)
}

/// The tempo's arrow: −1 (the shipped "worse" pink) when today's tempo would spend more than the month's free money,
/// otherwise none — a green arrow on a spending figure would read as "spend more".
public func penzPaceTrend(_ a: PenzAllowance) -> Int {
    guard let p = penzParts(a.date) else { return 0 }
    let monthDays = Int64(daysInMonth(p.y, p.m))
    return penzPace(a) * monthDays > a.month.free.hufMinor ? -1 : 0
}

// MARK: - Where it goes

/// One slice of „Mire megy el".
public struct PenzSlice: Equatable, Sendable, Identifiable {
    public let name: String
    public let amount: Int64
    public var id: String { name }
}

/// The month's day-to-day spend (expense rows **not** linked to a recurring rule — the server's `spent`) by expense
/// category: the top four, then „Minden más" (the rest, and rows with no category). Empty when nothing was spent.
public func penzBreakdown(_ transactions: [PenzTransaction], categories: [PenzCategory]) -> [PenzSlice] {
    var by: [String: Int64] = [:]
    var other: Int64 = 0
    let names = Dictionary(categories.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a })
    for t in transactions where t.kind == "expense" && t.recurringRuleId == nil && t.amount.hufMinor > 0 {
        if let c = t.categoryId, let name = names[c] { by[name, default: 0] += t.amount.hufMinor } else { other += t.amount.hufMinor }
    }
    let sorted = by.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
    var slices = sorted.prefix(4).map { PenzSlice(name: $0.key, amount: $0.value) }
    other += sorted.dropFirst(4).reduce(0) { $0 + $1.value }
    if other > 0 { slices.append(PenzSlice(name: "Minden más", amount: other)) }
    return slices
}

/// The composition's note: "A változó költésed *66%-a* élelmiszer és éttermek." nil when there is nothing to say.
public func penzBreakdownNote(_ slices: [PenzSlice]) -> String? {
    let total = slices.reduce(0) { $0 + $1.amount }
    let named = slices.filter { $0.name != "Minden más" }
    guard total > 0, !named.isEmpty else { return nil }
    let top = Array(named.prefix(2))
    let share = Int((Double(top.reduce(0) { $0 + $1.amount }) / Double(total) * 100).rounded())
    let words = top.map { $0.name.lowercased() }.joined(separator: " és ")
    return "A változó költésed *\(share)%-a* \(words)."
}

// MARK: - Today's items

/// One row of „A mai tételek" or of the month's list.
public struct PenzItem: Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let sub: String
    /// The signed display amount ("8 240", "+ 12 000").
    public let value: String
    public let glyph: String
    /// Still in the outbox (typed on the phone, not on the server yet).
    public let pending: Bool
    public let needsReview: Bool
}

/// The glyph a category wears (category glyphs, never photos — the server has no picture of a purchase).
public func penzCategoryGlyph(_ name: String?) -> String {
    let n = (name ?? "").folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "hu_HU"))
    let table: [(String, String)] = [
        ("elelmiszer", "bowl-cream"), ("bevasarl", "bowl-cream"), ("etterem", "honey-sun"), ("kave", "honey-sun"),
        ("kozlekedes", "repeat-deep"), ("auto", "repeat-deep"), ("uzemanyag", "repeat-deep"), ("sport", "dumbbell-ink"),
        ("egeszseg", "heart-cream"), ("lakas", "clock-ink"), ("rezsi", "clock-ink"), ("elofizet", "repeat-deep"),
        ("ruha", "shoe-cream"), ("szorakoz", "star-sun"), ("ajandek", "star-sun"), ("utazas", "leaf-sage"),
        ("oktatas", "book-sage"), ("haztartas", "plate-deep"), ("fizetes", "plus-ink"), ("bevetel", "plus-ink"),
    ]
    return table.first { n.contains($0.0) }?.1 ?? "e-penz"
}

/// Where a row came from, in his words.
public func penzSourceText(_ t: PenzTransaction, accounts: [PenzAccount]) -> String {
    switch t.source {
    case "sms": return "banki üzenetből"
    case "recurring": return "rendszeres tétel"
    default:
        return accounts.first { $0.id == t.accountId }?.type == "cash" ? "készpénz, kézzel" : "kézzel"
    }
}

/// The rows of a set of transactions (the day-to-day kinds; a transfer leg is not spending), with the pending cash
/// first. A row's title is its note (the merchant, for an SMS), else its category, else the kind.
public func penzItems(_ transactions: [PenzTransaction], pending: [PenzPendingExpense], categories: [PenzCategory],
                      accounts: [PenzAccount]) -> [PenzItem] {
    let cat = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    let waiting = pending.map { p -> PenzItem in
        let c = p.payload.categoryId.flatMap { cat[$0] }
        return PenzItem(id: p.id.uuidString, title: penzTitle(note: p.payload.note, category: c?.name, kind: "expense"),
                        sub: [c?.name, p.refused ? "nem sikerült elküldeni" : "készpénz, kézzel · küldésre vár"]
                            .compactMap { $0 }.joined(separator: " · "),
                        value: penzFt(p.payload.amountMinor), glyph: penzCategoryGlyph(c?.name), pending: true, needsReview: false)
    }
    let rows = transactions.filter { ["expense", "income", "invest_buy", "invest_sell"].contains($0.kind) }.map { t -> PenzItem in
        let c = t.categoryId.flatMap { cat[$0] }
        let income = t.kind == "income" || t.kind == "invest_sell"
        return PenzItem(id: t.id, title: penzTitle(note: t.note, category: c?.name, kind: t.kind),
                        sub: [c?.name, penzSourceText(t, accounts: accounts)].compactMap { $0 }.joined(separator: " · "),
                        value: income ? penzFtSigned(t.amount.hufMinor, sign: .plus) : penzFt(t.amount.hufMinor),
                        glyph: income ? "plus-ink" : penzCategoryGlyph(c?.name), pending: false, needsReview: t.needsReview)
    }
    return waiting + rows
}

private func penzTitle(note: String?, category: String?, kind: String) -> String {
    if let n = note?.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty { return n }
    if let category { return category }
    switch kind {
    case "income": return "Bevétel"
    case "invest_buy": return "Befektetés"
    case "invest_sell": return "Befektetés eladása"
    default: return "Kiadás"
    }
}

/// The rows that wait for him to look at them.
public func penzNeedsReview(_ transactions: [PenzTransaction]) -> [PenzTransaction] { transactions.filter(\.needsReview) }

/// The month's transactions grouped by day, newest day first.
public func penzByDay(_ transactions: [PenzTransaction]) -> [(day: String, rows: [PenzTransaction])] {
    Dictionary(grouping: transactions, by: \.date).sorted { $0.key > $1.key }.map { ($0.key, $0.value) }
}

// MARK: - Ma's verdict

/// The one thing Ma says, chosen by rule (the „Honnan tudom, van-e dolgod?" sheet spells the rule out).
public enum PenzVerdict: Equatable, Sendable {
    /// Bank messages whose category Boop was not sure of.
    case review(count: Int)
    /// A past month is still open (the oldest).
    case close(month: String)
    /// Nothing to do — the usual answer.
    case calm
}

/// Rows to review win; else an open past month; else nothing.
public func penzVerdict(reviewCount: Int, openMonths: [PenzMonthClose]) -> PenzVerdict {
    if reviewCount > 0 { return .review(count: reviewCount) }
    if let oldest = openMonths.filter({ !$0.closed }).map(\.month).min() { return .close(month: oldest) }
    return .calm
}

/// The verdict's words.
public func penzVerdictCopy(_ v: PenzVerdict, allowance: PenzAllowance?) -> (text: String, sub: String) {
    switch v {
    case .review(let n):
        return (n == 1 ? "Egy banki üzenetet nézz át" : "\(n) banki üzenetet nézz át",
                "Nem voltam biztos benne, melyik kategóriába valók. Amíg nem nézed át, a költésed így is beleszámít a keretbe.")
    case .close(let month):
        let word = penzMonthWord(month, .accusative)
        return ("Lezárhatod \(penzArticle(word).lowercased()) \(word)",
                "A hónap véget ért. Te döntöd el, mi legyen a maradékkal — magától semmi nem történik.")
    case .calm:
        guard let a = allowance else {
            return ("Ma nincs dolgod a pénzeddel", "Nincs ellenőrizendő tétel, és nincs lezáratlan hónap.")
        }
        let w = penzWeek(a)
        let month = a.month.remaining.hufMinor
        let weekLine = w.remaining >= 0
            ? "A hétből *\(penzFtUnit(w.remaining))* maradt"
            : "A heti keretet \(penzFtUnit(-w.remaining))-tal túllépted"
        let monthLine = month >= 0 ? "a hónapból \(penzFtUnit(month))" : "a hónap \(penzFtUnit(-month))-tal a keret fölött jár"
        return ("Ma nincs dolgod a pénzeddel",
                "\(weekLine), \(monthLine). Nincs ellenőrizendő tétel, és nincs lezáratlan hónap. Ha mégis vennél valamit, a *Költés* oldal megmondja, belefér-e.")
    }
}

// MARK: - Savings goals

/// A goal's second line: "Júniusra kell · még 7 hónap", "Nincs határidő", "Összejött".
public func penzGoalSub(_ g: PenzGoal, today: String) -> String {
    let reached = g.target.hufMinor > 0 && g.saved.hufMinor >= g.target.hufMinor
    let prefix = reached ? "Összejött" : nil
    guard let due = g.dueDate, let d = penzParts(due), let t = penzParts(today) else {
        return prefix ?? (g.kind == "purchase" ? "Vásárlási terv · nincs határidő" : "Nincs határidő")
    }
    let months = (d.y - t.y) * 12 + (d.m - t.m)
    let when: String
    if months < 0 || (months == 0 && d.d < t.d) {
        when = "A határidő \(penzMonthWord(due, .inessive)) volt"
    } else if months == 0 {
        when = "Ebben a hónapban esedékes"
    } else if months < 12 || d.y == t.y {
        when = "\(penzMonthWord(due, .sublative).capitalizedFirst) kell · még \(months) hónap"
    } else {
        when = "Határidő: \(d.y). \(penzMonthWord(due)) · még \(months) hónap"
    }
    return [prefix, when].compactMap { $0 }.joined(separator: " · ")
}

// MARK: - Where cash goes

/// The account a cash expense is written to: a HUF cash account, else the HUF default, else the first HUF account;
/// nil when there is none (a row's currency must be its account's, penz.md §3.3).
public func penzCashAccount(_ accounts: [PenzAccount]) -> PenzAccount? {
    let live = accounts.filter { !$0.archived && $0.currency == "HUF" }
    return live.first { $0.type == "cash" } ?? live.first { $0.isDefault } ?? live.first
}

/// The expense categories, in his order.
public func penzExpenseCategories(_ categories: [PenzCategory]) -> [PenzCategory] {
    categories.filter { $0.kind == "expense" }.sorted { $0.position != $1.position ? $0.position < $1.position : $0.name < $1.name }
}

/// This month's spend per category (every expense row, the fixed ones too — a budget is about the category).
public func penzSpendByCategory(_ transactions: [PenzTransaction]) -> [String: Int64] {
    var out: [String: Int64] = [:]
    for t in transactions where t.kind == "expense" { if let c = t.categoryId { out[c, default: 0] += t.amount.hufMinor } }
    return out
}

// MARK: - The age of a cached read

/// "3 órás adat" / "2 napos adat"; nil under a quarter of an hour (a fresh read is not news).
public func penzAgeText(_ age: TimeInterval?) -> String? {
    guard let age, age >= 900 else { return nil }
    let hours = Int(age / 3600)
    if hours < 24 { return "\(max(1, hours)) órás adat" }
    return "\(hours / 24) napos adat"
}
