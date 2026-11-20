import Foundation

// Pénz L7 (`mezo-r36n9.105`) — the Gyakorlás tab's wording and grouping, pure and unit-tested.
//
// Every figure is the server's (R, P/L, the cap, the weekly review); what is worked out here is presentation — the
// spike's row titles and subs ("OTP · kitörés" / "Terv megvolt · stop vitte ki" / "+1,9 R"), the open position's line,
// the three numbers, the curve scaled around its zero baseline, and the cap refusal in his words.
//
// Copy rules (spec §6): never urge, never promise a return, never say sell; a negative figure is never `hot`.

// MARK: - Numbers and dates as text

/// `+1,9` / `−1,0` / `0,0` — an R multiple, one decimal.
public func penzR(_ r: Double) -> String { penzPct(r, decimals: 1) }

private let shortMonths = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]

/// `nov. 19.` — a day inside a sentence.
public func penzShortDate(_ day: String) -> String {
    guard let p = penzParts(day), (1...12).contains(p.m) else { return day }
    return "\(shortMonths[p.m - 1]) \(p.d)."
}

/// `2026. nov. 20.` — a checked-on date.
public func penzLongDate(_ day: String) -> String {
    guard let p = penzParts(day), (1...12).contains(p.m) else { return day }
    return "\(p.y). \(shortMonths[p.m - 1]) \(p.d)."
}

/// A price he typed, in its own currency: `4 120 Ft`, `4 120,50 Ft`, `182,40 EUR`.
public func penzPrice(_ m: PenzMoney) -> String {
    let negative = m.minor < 0
    let whole = m.minor.magnitude / 100, cents = m.minor.magnitude % 100
    let digits = String(whole)
    var out = ""
    for (i, ch) in digits.enumerated() {
        if i > 0, (digits.count - i) % 3 == 0 { out += penzThin }
        out.append(ch)
    }
    let huf = m.currency == "HUF"
    if !huf || cents != 0 { out += "," + String(format: "%02d", cents) }
    return (negative ? penzMinus : "") + out + "\u{00A0}" + (huf ? "Ft" : m.currency)
}

/// `+1 200` / `−3 400` / `0` — a forint P/L, signed, no unit.
public func penzSignedFt(_ minor: Int64) -> String {
    let w = penzWhole(minor)
    return w > 0 ? "+" + penzFt(minor) : penzFt(minor)
}

/// The tag's label, its first letter lowered for the middle of a title ("Hírre ugrottam" → "hírre ugrottam").
public func penzTagLabel(_ key: String, tags: [PenzPracticeTag]) -> String {
    let label = tags.first { $0.key == key }?.label ?? penzPracticeDefaultTags.first { $0.key == key }?.label ?? key
    return label.prefix(1).lowercased() + label.dropFirst()
}

/// The fixed eight, used only when the overview did not carry them (an old cache).
public let penzPracticeDefaultTags: [PenzPracticeTag] = [
    PenzPracticeTag(key: "kitores", label: "Kitörés"), PenzPracticeTag(key: "visszateszt", label: "Visszateszt"),
    PenzPracticeTag(key: "nyitasi_tartomany", label: "Nyitási tartomány"), PenzPracticeTag(key: "trend", label: "Trend mentén"),
    PenzPracticeTag(key: "fordulo", label: "Fordulóra"), PenzPracticeTag(key: "hirre", label: "Hírre ugrottam"),
    PenzPracticeTag(key: "korai_zaras", label: "Korán zártam"), PenzPracticeTag(key: "terven_kivul", label: "Eltértem a tervtől"),
]

/// "hosszú" / "rövid".
public func penzDirectionName(_ direction: String) -> String { direction == "short" ? "rövid" : "hosszú" }

// MARK: - One trade as a row

public enum PenzTradeKind: Sendable { case planned, open, closed, cancelled }

public struct PenzTradeRowModel: Equatable, Sendable, Identifiable {
    public let id: String
    public let glyph: String
    public let title: String
    public let sub: String
    public let value: String
    public let valueSub: String
    public let badge: Int
    public let kind: PenzTradeKind
}

public func penzTradeKind(_ t: PenzPaperTrade) -> PenzTradeKind {
    switch t.status {
    case "open": .open
    case "closed": .closed
    case "cancelled": .cancelled
    default: .planned
    }
}

/// How a closed trade ended, the spike's second half: "stop vitte ki", "kilépés a szintnél", "kézzel zártad korábban".
func penzTradeEnding(_ t: PenzPaperTrade) -> String {
    let r = t.rMultiple ?? 0
    if t.tags.contains("korai_zaras") { return "kézzel zártad korábban" }
    if t.stopRespected == false { return "túl a stopon zártad" }
    if r <= -0.95 { return "stop vitte ki" }
    if let target = t.target, let exit = t.exit {
        let hit = t.direction == "short" ? exit.minor <= target.minor : exit.minor >= target.minor
        if hit { return "kilépés a szintnél" }
    }
    if r > 0 { return "nyereséggel zártad" }
    if r < 0 { return "veszteséggel zártad" }
    return "nullán zártad"
}

/// One trade, the spike's way: closed "OTP · kitörés" / "Terv megvolt · stop vitte ki" / "+1,9 R"; open "OTP · hosszú" /
/// "Nyitott · utolsó záróár, amit beírtál: 4 120 Ft (nov. 19.)"; planned "OTP · hosszú" / "Terv · belépő … · stop …".
public func penzTradeRow(_ t: PenzPaperTrade, tags: [PenzPracticeTag]) -> PenzTradeRowModel {
    let kind = penzTradeKind(t)
    switch kind {
    case .closed:
        let setup = t.tags.first { $0 != "terven_kivul" && $0 != "korai_zaras" } ?? t.tags.first
        let title = setup.map { "\(t.instrument) · \(penzTagLabel($0, tags: tags))" } ?? t.instrument
        var parts = [t.tags.contains("terven_kivul") ? "Eltértél a tervtől" : "Terv megvolt", penzTradeEnding(t)]
        if t.mistake { parts.append("hiba megjelölve") }
        let value: String, valueSub: String
        if let r = t.rMultiple { value = penzR(r); valueSub = "R" } else if let p = t.pnl {
            value = penzSignedFt(p.hufMinor); valueSub = "Ft"
        } else { value = "–"; valueSub = "" }
        return PenzTradeRowModel(id: t.id, glyph: t.mistake ? "bolt-ink" : "check-ink", title: title,
                                 sub: parts.joined(separator: " · "), value: value, valueSub: valueSub,
                                 badge: t.mistake ? 1 : 0, kind: kind)
    case .open:
        let sub: String
        if let close = t.lastClose, let day = t.lastCloseDate {
            sub = "Nyitott · utolsó záróár, amit beírtál: \(penzPrice(close)) (\(penzShortDate(day)))"
        } else {
            sub = "Nyitott · még nem írtál be záróárat, a belépőn számolom"
        }
        return PenzTradeRowModel(id: t.id, glyph: "clock-ink", title: "\(t.instrument) · \(penzDirectionName(t.direction))",
                                 sub: sub, value: penzSignedFt(t.unrealizedHufMinor ?? 0), valueSub: "Ft papíron", badge: 0,
                                 kind: kind)
    case .planned, .cancelled:
        var parts = [kind == .cancelled ? "Elvetett terv" : "Terv"]
        if let e = t.plannedEntry { parts.append("belépő \(penzPrice(e))") }
        parts.append("stop \(penzPrice(t.stop))")
        return PenzTradeRowModel(id: t.id, glyph: "pen-sun", title: "\(t.instrument) · \(penzDirectionName(t.direction))",
                                 sub: parts.joined(separator: " · "), value: "", valueSub: "", badge: 0, kind: kind)
    }
}

/// *A HÉT KERESKEDÉSEI*: the open positions first (they can be acted on), then the plans waiting, then the week's
/// closed trades newest first.
public func penzWeekTradeRows(_ o: PenzPracticeOverview) -> [PenzTradeRowModel] {
    (o.open + o.planned + o.week.trades).map { penzTradeRow($0, tags: o.tags) }
}

/// The trade by id from anywhere in the overview (the detail sheet re-reads it after every write).
public func penzFindTrade(_ id: String, in o: PenzPracticeOverview?, journal: [PenzPaperTrade] = []) -> PenzPaperTrade? {
    guard let o else { return journal.first { $0.id == id } }
    return (o.open + o.planned + o.week.trades + journal).first { $0.id == id }
}

// MARK: - The tab's head

/// Nothing ever: no closed trade, no open position, no plan — the plan-first explanation and *Új kereskedés*.
public func penzPracticeIsEmpty(_ o: PenzPracticeOverview) -> Bool {
    o.closedCount == 0 && o.open.isEmpty && o.planned.isEmpty && o.week.trades.isEmpty
}

public struct PenzPracticeHighlight: Equatable, Sendable {
    public let label: String, text: String, sub: String
}

public let penzPracticeEmptySub = "Itt papíron gyakorolsz, valódi pénz nélkül. Minden kereskedés egy *tervvel* kezdődik: mit veszel, miért, és *hol lépsz ki*, ha rossz irányba megy. Terv nélkül nincs kereskedés — ez a lényege. A belépőt, a kilépőt és a záróárakat te írod be; élő árfolyamot nem figyelek."

/// The highlight: the week's headline from the review, the quiet "no closed trade this week" line, or the empty start.
public func penzPracticeHighlight(_ o: PenzPracticeOverview) -> PenzPracticeHighlight {
    if penzPracticeIsEmpty(o) {
        return PenzPracticeHighlight(label: "A GYAKORLÁS", text: "Még nem kereskedtél papíron", sub: penzPracticeEmptySub)
    }
    if let h = o.week.headline, !h.isEmpty {
        return PenzPracticeHighlight(label: "A HETI VISSZANÉZÉS", text: h, sub: penzUnlitNegatives(o.week.sub ?? ""))
    }
    let waiting = o.open.count + o.planned.count
    let sub = waiting > 0
        ? "Amíg nincs lezárt kereskedés, nincs mit visszanézni. \(waiting == 1 ? "Egy" : "\(waiting)") nyitott vagy tervezett kereskedésed van lent."
        : "Amíg nincs lezárt kereskedés, nincs mit visszanézni. Ha zársz egyet, itt látod, mi működött."
    return PenzPracticeHighlight(label: "A HETI VISSZANÉZÉS", text: "Még nincs lezárt kereskedés a héten", sub: sub)
}

public struct PenzPracticeStat: Equatable, Sendable {
    public let value: String?, target: String?, unit: String, label: String
    public let hot: Bool
}

/// The three numbers: the month's paper P/L, the average R, the cap used of the cap. None is lit: a practice number is
/// not the one thing that matters today, and a loss must never glow.
public func penzPracticeStats(_ o: PenzPracticeOverview) -> [PenzPracticeStat] {
    [
        PenzPracticeStat(value: penzSignedFt(o.monthPnlHufMinor), target: nil, unit: "Ft", label: "a hónapban, papíron", hot: false),
        PenzPracticeStat(value: o.avgR.map { penzPct($0, decimals: 1, signed: false) }, target: nil, unit: "R",
                         label: "átlagosan egy kereskedés", hot: false),
        // "12 000 / 20 000" does not fit a third of the smallest phone: the cap goes into the label
        PenzPracticeStat(value: penzFt(o.cap.usedHufMinor), target: nil, unit: "Ft",
                         label: "elkelt a \(penzFt(o.cap.capHufMinor))\u{00A0}Ft-os keretből", hot: false),
    ]
}

private let weekdayLetters = ["H", "K", "Sze", "Cs", "P", "Szo", "V"]

/// The week's curve for `NKCurve`: the cumulative closed P/L scaled around a 0.5 baseline (the dashed line is the
/// start), so a losing week draws below the line instead of off the box. nil under two points.
public func penzPracticeCurve(_ w: PenzPracticeWeek) -> (values: [Double], labels: [String], baseline: Double, now: Int)? {
    guard w.curve.count >= 2 else { return nil }
    let peak = max(1, w.curve.map { abs($0.cumulativeHufMinor) }.max() ?? 1)
    let values = w.curve.map { 0.5 + 0.42 * Double($0.cumulativeHufMinor) / Double(peak) }
    let labels = w.curve.map { p -> String in
        guard penzParts(w.weekStart) != nil, penzParts(p.date) != nil else { return "" }
        let i = penzDaysInclusive(from: w.weekStart, to: p.date) - 1
        return weekdayLetters.indices.contains(i) ? weekdayLetters[i] : ""
    }
    return (values, labels, 0.5, values.count - 1)
}

/// The curve's note: the baseline, and — honestly — how little a week says.
public func penzPracticeCurveNote(_ w: PenzPracticeWeek) -> String {
    let n = w.closedCount
    let count = n == 0 ? "Ezen a héten még nincs lezárt kereskedés" : "\(n) lezárt kereskedés a héten"
    return "A szaggatott vonal a kiindulás. \(count) — *ez még túl kevés ahhoz, hogy bármit jelentsen.*"
}

/// The sample-size line: the server's, or (an old cache) the same sentence built from the count. nil from 50 tagged.
public func penzNoiseLine(_ o: PenzPracticeOverview) -> String? {
    if let line = o.noiseLine, !line.isEmpty { return line }
    guard o.taggedCount < 50 else { return nil }
    return "50 jelölt kereskedés alatt ezek a számok még zajnak számítanak — most \(o.taggedCount) van."
}

/// The menu's *A keret* sub: "Havi 20 000 Ft · nem nyúl a többihez".
public func penzCapMenuSub(_ cap: PenzPracticeCap?) -> String {
    guard let cap, cap.capHufMinor > 0 else { return "A havi játékkeret · nem nyúl a többihez" }
    return "Havi \(penzFtUnit(cap.capHufMinor)) · nem nyúl a többihez"
}

/// The 422 cap refusal in his words: "Ez túllépné a havi 20 000 Ft-os keretet — még 8 000 Ft fér bele."
public func penzCapExceededText(_ cap: PenzPracticeCap?) -> String {
    guard let cap, cap.capHufMinor > 0 else {
        return "Ez túllépné a havi gyakorlási keretet. Kisebb mennyiséggel belefér."
    }
    let left = max(0, cap.leftHufMinor)
    let tail = left > 0 ? "még \(penzFtUnit(left)) fér bele." : "ebben a hónapban már nem fér bele több."
    return "Ez túllépné a havi \(penzFt(cap.capHufMinor))\u{00A0}Ft-os keretet — \(tail)"
}

/// The cap sheet's figures.
public func penzCapLevel(_ cap: PenzPracticeCap) -> Double { penzLevel(cap.usedHufMinor, of: cap.capHufMinor) }

// MARK: - The plan sheet

/// What is still missing or wrong in a plan before it can be sent (the server checks again). nil = ready.
public func penzPlanProblem(instrument: String, why: String, quantity: Double?, direction: String, stopMinor: Int64?,
                            entryMinor: Int64?) -> String? {
    if instrument.trimmingCharacters(in: .whitespaces).isEmpty { return "Írd be, mivel kereskedsz." }
    if why.trimmingCharacters(in: .whitespaces).isEmpty { return "Írd le egy mondatban, miért lépnél be." }
    guard let stopMinor else { return "A kilépési szint (stop) kötelező: ez a terv lényege." }
    guard let quantity, quantity > 0 else { return "Add meg a mennyiséget." }
    if let entryMinor {
        if direction == "short", stopMinor <= entryMinor { return "Rövid kereskedésnél a stop a belépő fölött van." }
        if direction != "short", stopMinor >= entryMinor { return "Hosszú kereskedésnél a stop a belépő alatt van." }
    }
    return nil
}

/// The journal line: one line, at most 140 characters.
public let penzJournalLineLimit = 140
public func penzJournalLineTrimmed(_ s: String) -> String {
    String(s.replacingOccurrences(of: "\n", with: " ").prefix(penzJournalLineLimit))
}

/// The full journal grouped by month ("November"), newest first; a trade is filed under its exit, entry or plan date.
public func penzJournalGroups(_ trades: [PenzPaperTrade]) -> [(month: String, title: String, trades: [PenzPaperTrade])] {
    func day(_ t: PenzPaperTrade) -> String { t.exitDate ?? t.entryDate ?? String(t.createdAt.prefix(10)) }
    let sorted = trades.sorted { day($0) > day($1) }
    var out: [(month: String, title: String, trades: [PenzPaperTrade])] = []
    for t in sorted {
        let m = String(day(t).prefix(7))
        if out.last?.month == m { out[out.count - 1].trades.append(t) } else {
            out.append((m, penzMonthWord(m).capitalizedFirst, [t]))
        }
    }
    return out
}

/// A loss is never lit: the `*emphasis*` (drawn in the hue) is dropped around a figure that starts with a minus, so a
/// server sentence like "az *−1,7R* lett" never turns a loss green (spec §5.6).
public func penzUnlitNegatives(_ text: String) -> String {
    text.replacingOccurrences(of: "\\*([\u{2212}\\-][^*]*)\\*", with: "$1", options: .regularExpression)
}
