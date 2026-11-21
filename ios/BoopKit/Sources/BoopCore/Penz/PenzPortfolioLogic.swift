import Foundation

// Pénz L6 (`mezo-r36n9.104`) — the wording and grouping of Pénzem and the news digest, pure and unit-tested.
//
// Nothing here computes a money figure the server did not: values, moves, shares, coverage months and every digest
// effect are the backend's (§6: the model narrates figures computed elsewhere, and so do the screens). What is
// worked out here is presentation — the three sleeve rows in order, the coverage sentence, the hero's three numbers,
// the composition by product, the forward timeline, the practice row and the news card.
//
// Copy rules (spec §6): never urge, never promise a return, never say sell; a negative figure is never `hot`.

// MARK: - Numbers as text

/// `+2,1` / `−0,4` / `0,0` — a percentage with a decimal comma and the true minus (no unit).
public func penzPct(_ value: Double, decimals: Int = 1, signed: Bool = true) -> String {
    let factor = pow(10.0, Double(decimals))
    let rounded = (value * factor).rounded() / factor
    let body = String(format: "%.\(decimals)f", abs(rounded)).replacingOccurrences(of: ".", with: ",")
    if rounded < 0 { return penzMinus + body }
    if rounded > 0 && signed { return "+" + body }
    return body
}

/// `−18 400 Ft` / `0 Ft` / `+8 900 Ft` — a computed effect, signed, with its unit.
public func penzEffectText(_ minor: Int64) -> String {
    let whole = penzWhole(minor)
    if whole == 0 { return "0\u{00A0}Ft" }
    return (whole > 0 ? "+" : "") + penzFt(minor) + "\u{00A0}Ft"
}

/// An amount he typed in a holding's currency ("1 234,56", "1234.5", "120 000") → minor units; nil unless positive.
public func penzParseAmount(_ text: String) -> Int64? {
    var t = text.filter { !$0.isWhitespace && $0 != "\u{00A0}" && $0 != "\u{202F}" }
    guard !t.isEmpty else { return nil }
    // a single comma or dot followed by one or two digits is the decimal mark; any other dot is a thousands mark
    var fraction = ""
    if let mark = t.lastIndex(where: { $0 == "," || $0 == "." }) {
        let tail = t[t.index(after: mark)...]
        if (1...2).contains(tail.count), tail.allSatisfy(\.isNumber) {
            fraction = String(tail)
            t = String(t[..<mark])
        }
    }
    let digits = t.filter(\.isNumber)
    guard digits.count == t.filter({ $0 != "." && $0 != "," }).count, !digits.isEmpty || !fraction.isEmpty,
          digits.count <= 11 else { return nil }
    let whole = Int64(digits.isEmpty ? "0" : digits) ?? 0
    let cents = Int64((fraction + "00").prefix(2)) ?? 0
    let minor = whole * 100 + cents
    return minor > 0 ? minor : nil
}

/// Units he typed ("12", "3,5", "0.25") → a positive number; nil when empty or not a positive number.
public func penzParseQuantity(_ text: String) -> Double? {
    let t = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
    guard let v = Double(t), v > 0, v.isFinite else { return nil }
    return v
}

// MARK: - Sleeves

public enum PenzSleeveKey: String, CaseIterable, Sendable { case short, mid, long }

/// "1–3 év" / "5–10 év" / "10+ év".
public func penzSleeveTitle(_ sleeve: String) -> String {
    switch sleeve {
    case "short": "1–3 év"
    case "mid": "5–10 év"
    default: "10+ év"
    }
}

/// The sleeve's glyph (the spike's: scales, the chart, the star).
public func penzSleeveGlyph(_ sleeve: String) -> String {
    switch sleeve {
    case "short": "scale-ink"
    case "mid": "chart-deep"
    default: "star-sun"
    }
}

/// Always three, short · mid · long, whatever the server sent (a missing one is an empty sleeve).
public func penzSleeves(_ p: PenzPortfolio) -> [PenzSleeve] {
    PenzSleeveKey.allCases.map { key in p.sleeves.first { $0.sleeve == key.rawValue } ?? PenzSleeve(sleeve: key.rawValue, valueHufMinor: 0) }
}

/// The long sleeve's measure, short form for its row: "4 év 7 hónapnyi fix kiadásod", "7 hónapnyi …", "4 évnyi …".
/// nil months (no fixed cost recorded) → an honest line instead of a number.
public func penzCoverageShort(_ months: Int?) -> String {
    guard let months else { return "nincs rögzített fix kiadás" }
    return penzCoverageAmount(months) + " fix kiadásod"
}

/// "4 év 7 hónapnyi" / "7 hónapnyi" / "4 évnyi" / "egy hónapnál kevesebb".
func penzCoverageAmount(_ months: Int) -> String {
    let m = max(0, months)
    let years = m / 12, rest = m % 12
    if m == 0 { return "egy hónapnál kevesebb" }
    if years == 0 { return "\(rest) hónapnyi" }
    if rest == 0 { return "\(years) évnyi" }
    return "\(years) év \(rest) hónapnyi"
}

/// The whole sentence (spec §10.2.2): "Ahogy most áll, növekedést nem feltételezve, 4 év 7 hónapnyi fix kiadásodat
/// fedezi." — or why there is no such number.
public func penzCoverageSentence(_ months: Int?) -> String {
    guard let months else {
        return "Ehhez a fix kiadásaidat kell ismernem, és ebben a hónapban még nincs rögzített fix kiadásod — ezért most nem tudom évekre váltani."
    }
    if months == 0 {
        return "Ahogy most áll, növekedést nem feltételezve, még egy hónapnyi fix kiadásodat sem fedezi."
    }
    return "Ahogy most áll, növekedést nem feltételezve, *\(penzCoverageAmount(months)) fix kiadásodat* fedezi."
}

/// One row of „A három rekesz".
public struct PenzSleeveRow: Equatable, Sendable, Identifiable {
    public let sleeve: String
    public let glyph: String, title: String, sub: String
    public let value: String, valueSub: String
    public let level: Double
    public var id: String { sleeve }
}

/// The three rows, the spike's subtitles, value + "Ft · NN%"; the long sleeve's subtitle carries its coverage.
public func penzSleeveRows(_ p: PenzPortfolio) -> [PenzSleeveRow] {
    penzSleeves(p).map { s in
        let empty = s.holdings.isEmpty
        let sub: String
        switch s.sleeve {
        case "short": sub = "Biztonság · " + (empty ? "még üres" : "állampapír, pénzpiac")
        case "mid": sub = "Vegyes · " + (empty ? "még üres" : "ETF és kötvény")
        default: sub = "Növekedés · " + (empty ? "még üres" : penzCoverageShort(s.coverageMonths))
        }
        return PenzSleeveRow(sleeve: s.sleeve, glyph: penzSleeveGlyph(s.sleeve), title: penzSleeveTitle(s.sleeve), sub: sub,
                             value: penzFt(s.valueHufMinor), valueSub: "Ft · \(penzPct(s.sharePct, decimals: 0, signed: false))%",
                             level: min(1, max(0, s.sharePct / 100)))
    }
}

/// "MBH" / "Revolut" / his own name for the other platform.
public func penzPlatformText(_ platform: String, name: String?) -> String {
    switch platform {
    case "mbh": "MBH"
    case "revolut": "Revolut"
    default: (name?.isEmpty == false ? name! : "Más platform")
    }
}

/// One holding on the sleeve page.
public struct PenzPositionRow: Equatable, Sendable, Identifiable {
    public let id: String
    public let glyph: String, title: String, sub: String
    public let value: String, valueSub: String
    public let level: Double
    /// Valued at cost (no quote, no rate) — said in the sub as well.
    public let atCost: Bool
}

public func penzAssetGlyph(_ assetType: String) -> String {
    switch assetType {
    case "bond": "scale-ink"
    case "etf", "fund": "chart-deep"
    case "stock": "star-sun"
    case "crypto": "bolt-ink"
    default: "e-penz"
    }
}

/// The sleeve's holdings, largest first: name, platform (+ how it is valued when it is not a quote), value, share.
public func penzPositionRows(_ s: PenzSleeve) -> [PenzPositionRow] {
    s.holdings.sorted { $0.valueHufMinor != $1.valueHufMinor ? $0.valueHufMinor > $1.valueHufMinor : $0.name < $1.name }.map { h in
        let atCost = !h.priced || h.valuation == "cost"
        var parts = [penzPlatformText(h.platform, name: h.platformName)]
        if h.currency != "HUF" { parts.append(h.currency) }
        if atCost { parts.append("vételáron számolva") } else if h.valuation == "accrual" { parts.append("a kamatából számolva") }
        return PenzPositionRow(id: h.holdingId, glyph: penzAssetGlyph(h.assetType), title: h.name,
                               sub: parts.joined(separator: " · "), value: penzFt(h.valueHufMinor),
                               valueSub: "Ft · \(penzPct(h.sharePct, decimals: 0, signed: false))%",
                               level: min(1, max(0, h.sharePct / 100)), atCost: atCost)
    }
}

// MARK: - The hero

/// One of the hero's three numbers (mapped 1:1 onto the kit's stat tile).
public struct PenzHeroStat: Equatable, Sendable {
    /// nil = nothing to show ("–"), never a 0.
    public let value: String?
    public let unit: String, label: String
    public let trend: Int
    /// Never true here: a lit move would turn a loss green, and the total is not a verdict.
    public let hot: Bool
}

/// The total, the instruments' own move since the previous close, and the currency part — apart (spec §10.1.8).
public func penzHeroStats(_ p: PenzPortfolio) -> [PenzHeroStat] {
    let nothingPriced = !p.positions.isEmpty && p.positions.allSatisfy { !$0.priced }
    func move(_ pct: Double?, _ label: String) -> PenzHeroStat {
        guard let pct, !nothingPriced else { return PenzHeroStat(value: nil, unit: "%", label: label, trend: 0, hot: false) }
        let text = penzPct(pct)
        let trend = text.hasPrefix("+") ? 1 : (text.hasPrefix(penzMinus) ? -1 : 0)
        return PenzHeroStat(value: text, unit: "%", label: label, trend: trend, hot: false)
    }
    return [
        PenzHeroStat(value: penzFt(p.totalHufMinor), unit: "Ft", label: "amid most van", trend: 0, hot: false),
        move(p.priceMovePct, "a befektetések mozgása"),
        move(p.fxMovePct, "ebből az árfolyam"),
    ]
}

/// Nothing in the portfolio has a price — the moves are blank and the page says why.
public func penzNothingPriced(_ p: PenzPortfolio) -> Bool { !p.positions.isEmpty && p.positions.allSatisfy { !$0.priced } }

/// The stale mark's words: "6 napos árak" from `pricesAsOf`, or that the price source is not answering.
public func penzPricesStaleText(_ p: PenzPortfolio, today: String) -> String? {
    guard p.stale else { return nil }
    guard let asOf = p.pricesAsOf else { return "Az árforrás most nem válaszol" }
    let days = max(0, penzDaysInclusive(from: asOf, to: today) - 1)
    return days <= 0 ? "Az árforrás most nem válaszol" : "\(days) napos árak · \(penzDayTitle(asOf))"
}

/// „Mikoriak ezek az árak?" — the truth of L6's valuation (build notes call 2/3).
public func penzPricesInfoText(_ p: PenzPortfolio?) -> String {
    let asOf = p?.pricesAsOf.map { " (most: \(penzDayTitle($0).lowercased()))" } ?? ""
    return """
    A tőzsdei árak a *legutóbbi napi záróárak*\(asOf), az árfolyamforrás napi adatából — naponta egyszer frissülnek. Az állampapírt, amihez nincs tőzsdei ár, a kamatából számolom, ha megadtad; ha nem, a vételárán, és ezt odaírom mellé. A devizás tételeket a napi záró árfolyamon váltom forintra.

    A mozgás a *két legutóbbi záróár közötti* változás, külön a befektetésé és külön az árfolyamé. Napon belüli árat nem használok. A te időtávjaidon — egy évtől tizenötig — egy délelőtti mozgás nem mond semmit, viszont nézegetni csábít, és pont ez az, amit ez az oldal nem akar.
    """
}

/// „Miért évek a hosszú rekesz mérőszáma?" — the spike's text with the real coverage (§10.2.2 wording).
public func penzCoverageInfoText(_ p: PenzPortfolio?) -> String {
    let long = p.map { penzSleeves($0)[2] }
    let sentence: String
    if let long, !long.holdings.isEmpty {
        sentence = penzCoverageSentence(long.coverageMonths)
    } else {
        sentence = "Ahogy most áll, növekedést nem feltételezve, *N év M hónap fix kiadásodat* fedezi — amint van benne valami, itt a te számod áll."
    }
    return """
    A 10+ éves rekesznél nem a mai százalékot mutatom, mert az egy tizenöt éves pénznél félrevezető: egy rossz hét „−1,1%”-ként pánikot kelt, pedig semmit nem jelent.

    Helyette ezt: \(sentence) Növekedést azért nem számolok bele, mert azt nem tudom megígérni — és mert így a szám csak akkor nő, ha tényleg teszel bele.
    """
}

// MARK: - Composition

public struct PenzCompositionPart: Equatable, Sendable, Identifiable {
    public let name: String
    public let valueHufMinor: Int64
    public var id: String { name }
}

/// „Mi van benne": by product (the same symbol — or, without one, the same name — summed across sleeves), largest
/// first — five at most, else the top four and then „Minden más".
public func penzComposition(_ p: PenzPortfolio) -> [PenzCompositionPart] {
    var by: [String: (name: String, value: Int64)] = [:]
    for h in p.positions where h.valueHufMinor > 0 {
        let key = penzProductKey(h)
        by[key, default: (h.name, 0)].value += h.valueHufMinor
    }
    let sorted = by.values.sorted { $0.value != $1.value ? $0.value > $1.value : $0.name < $1.name }
    // five fit the legend (the spike's five); a sixth folds the tail into „Minden más"
    let keep = sorted.count <= 5 ? 5 : 4
    var parts = sorted.prefix(keep).map { PenzCompositionPart(name: $0.name, valueHufMinor: $0.value) }
    let rest = sorted.dropFirst(keep).reduce(Int64(0)) { $0 + $1.value }
    if rest > 0 { parts.append(PenzCompositionPart(name: "Minden más", valueHufMinor: rest)) }
    return parts
}

func penzProductKey(_ h: PenzPosition) -> String {
    if let s = h.symbol?.trimmingCharacters(in: .whitespaces), !s.isEmpty { return "s:" + s.uppercased() }
    return "n:" + h.name.lowercased().trimmingCharacters(in: .whitespaces)
}

/// The composition's note when one product sits in two sleeves (the spike's), else nil.
public func penzCompositionNote(_ p: PenzPortfolio) -> String? {
    var sleevesOf: [String: (name: String, sleeves: Set<String>)] = [:]
    for s in p.sleeves { for h in s.holdings { sleevesOf[penzProductKey(h), default: (h.name, [])].sleeves.insert(s.sleeve) } }
    guard let twice = sleevesOf.values.filter({ $0.sleeves.count > 1 }).sorted(by: { $0.name < $1.name }).first else { return nil }
    let name = twice.name
    let why = twice.sleeves == ["mid", "long"] ? "mert 7 évre és 15 évre nem ugyanazt jelenti"
                                                : "mert a két időtávon nem ugyanazt jelenti"
    let where_ = twice.sleeves.count == 2 ? "két rekeszben" : "\(twice.sleeves.count) rekeszben"
    return "Ugyanaz \(penzArticle(name).lowercased()) \(name) *\(where_)* is ott van, külön darabszámmal — \(why)."
}

// MARK: - The forward timeline

public struct PenzEventRow: Equatable, Sendable, Identifiable {
    public let id: String
    public let glyph: String, title: String, sub: String
    public let value: String, valueSub: String
    /// A maturity within 90 days — a decision point coming up (marked, never urged).
    public let badge: Int
}

/// „Ami jön a következő hónapokban", soonest first, worded by kind like the spike.
public func penzEventRows(_ events: [PenzHoldingEvent], today: String) -> [PenzEventRow] {
    events.sorted { $0.date != $1.date ? $0.date < $1.date : $0.id < $1.id }.map { e in
        let huf = e.amountHufMinor ?? ((e.currency ?? "HUF") == "HUF" ? e.amountMinor : nil)
        let day = penzDayTitle(e.date)
        let from = ["short": "az 1–3 rekeszből", "mid": "az 5–10 rekeszből"][e.sleeve] ?? "a 10+ rekeszből"
        let note = e.note?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        let glyph: String, title: String, sub: String, sign: Bool, unit: String
        switch e.kind {
        case "coupon":
            glyph = "clock-ink"; title = "\(e.holdingName) kamatfordulója"; sub = "\(day) · \(note ?? from)"; sign = true; unit = "Ft kamat"
        case "dividend":
            glyph = "repeat-deep"; title = "\(e.holdingName) osztalékfizetés"; sub = "\(day) · \(note ?? from)"; sign = true; unit = "Ft"
        case "maturity":
            glyph = "scale-ink"; title = "\(e.holdingName) lejárata"
            sub = "\(day) · \(note ?? "ekkor el kell dönteni, mi legyen vele")"; sign = false; unit = "Ft"
        case "earnings":
            glyph = "chart-deep"; title = "\(e.holdingName) gyorsjelentése"; sub = "\(day) · \(note ?? from)"; sign = false; unit = "Ft"
        default:
            glyph = "spark-cream"; title = note ?? "\(e.holdingName) eseménye"; sub = "\(day) · \(from)"; sign = false; unit = "Ft"
        }
        let value = huf.map { sign ? "+" + penzFt($0) : penzFt($0) } ?? ""
        let days = penzDaysInclusive(from: today, to: e.date)
        return PenzEventRow(id: e.id, glyph: glyph, title: title, sub: sub, value: value, valueSub: huf == nil ? "" : unit,
                            badge: e.kind == "maturity" && days > 0 && days <= 90 ? 1 : 0)
    }
}

/// The add-event sheet's kinds, in his words.
public let penzEventKinds: [(kind: String, name: String)] = [
    ("maturity", "Lejárat"), ("coupon", "Kamatforduló"), ("dividend", "Osztalék"), ("earnings", "Gyorsjelentés"), ("other", "Egyéb"),
]

// MARK: - Gyakorlás

public struct PenzPracticeLine: Equatable, Sendable {
    public let title: String, sub: String, value: String, valueSub: String
    /// A chip under the row ("még nincs kereskedés" until L7).
    public var chip: String? = nil
}

/// The quiet row under Pénzem: until L7 there are no trades, so it says the monthly cap and that — never a P/L.
public func penzPracticeLine(_ row: PenzPracticeRow) -> PenzPracticeLine {
    if let pnl = row.monthPnlHufMinor {
        let v = penzWhole(pnl) > 0 ? "+" + penzFt(pnl) : penzFt(pnl)
        return PenzPracticeLine(title: "A játékpénz", sub: "Papír-próba · nem számít bele a fentibe", value: v, valueSub: "Ft a hónapban")
    }
    return PenzPracticeLine(title: "A játékpénz", sub: "Papír-próba · nem számít bele a fentibe",
                            value: penzFt(row.monthlyHufMinor), valueSub: "Ft havi keret", chip: "még nincs kereskedés")
}

// MARK: - The record sheet

/// A holding he can record a buy or a sell against.
public struct PenzHoldingChoice: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String, sleeve: String, currency: String
    public let quantity: Double?
    public var label: String { "\(name) · \(penzSleeveTitle(sleeve))" }
}

public func penzHoldingChoices(_ p: PenzPortfolio?) -> [PenzHoldingChoice] {
    guard let p else { return [] }
    return penzSleeves(p).flatMap { s in
        s.holdings.map { PenzHoldingChoice(id: $0.holdingId, name: $0.name, sleeve: s.sleeve, currency: $0.currency, quantity: $0.quantity) }
    }
}

/// The accounts a buy can be paid from / a sell paid into (`mezo-r36n9.119`): his live checking and cash accounts,
/// the default first — the server refuses any other (savings, investment, archived).
public func penzPayableAccounts(_ accounts: [PenzAccount]) -> [PenzAccount] {
    let payable = accounts.filter { !$0.archived && ($0.type == "checking" || $0.type == "cash") }
    return payable.filter(\.isDefault) + payable.filter { !$0.isDefault }
}

/// The amount to ask the bank-SMS candidates for, in the ACCOUNT's currency — only a buy, only when the account and
/// the holding share a currency (otherwise the server converts and an exact match is unlikely, so nothing is asked).
public func penzSmsLookupAmount(side: String, account: PenzAccount?, holdingCurrency: String, amountMinor: Int64?) -> Int64? {
    guard side == "buy", let account, let amountMinor, amountMinor > 0, account.currency == holdingCurrency else { return nil }
    return amountMinor
}

/// "nov. 19. · Spar" — a bank-SMS candidate chip ("Bank" when the message had no merchant).
public func penzSmsCandidateLabel(_ t: PenzTransaction) -> String {
    let note = t.note?.trimmingCharacters(in: .whitespaces) ?? ""
    return "\(penzShortDate(t.date)) · \(note.isEmpty ? "Bank" : note)"
}

public let penzAssetTypes: [(type: String, name: String)] = [
    ("etf", "ETF"), ("stock", "Részvény"), ("bond", "Állampapír / kötvény"), ("fund", "Alap"), ("crypto", "Kripto"), ("cash", "Pénzpiac / készpénz"),
]
public let penzPlatforms: [(platform: String, name: String)] = [("mbh", "MBH"), ("revolut", "Revolut"), ("other", "Más")]
public let penzCurrencies = ["HUF", "EUR", "USD", "GBP", "CHF"]

// MARK: - The news card

public struct PenzNewsSourceLine: Equatable, Sendable, Identifiable {
    /// "Portfolio · A tengerentúli tőzsdék hete".
    public let text: String
    public let url: URL?
    public let id: Int
}

/// One digest item as the card and the analysis page draw it.
public struct PenzNewsCardModel: Equatable, Sendable, Identifiable {
    public let id: String
    public let holding: String, sleeve: String, holdingGlyph: String
    public let title: String
    /// The backend's figure, formatted — never the model's.
    public let effect: String, effectNote: String
    public let negative: Bool
    /// 0 alacsony · 1 közepes · 2 magas.
    public let confidence: Int
    public let confidenceText: String
    public let sourceCount: Int
    /// "Ma 09:30 · 6 forrásból összevonva".
    public let when: String
    public let verdict: String, body: String, uncertainty: String, noAction: String
    public let sources: [PenzNewsSourceLine]
}

public func penzConfidenceText(_ level: Int) -> String { ["Alacsony", "Közepes", "Magas"][min(2, max(0, level))] }

/// Builds the card. `timeZone`/`now` decide "Ma" / "Tegnap" (tests pin them).
public func penzNewsCard(_ item: PenzDigestItem, generatedAt: String? = nil, now: Date = Date(),
                         timeZone: TimeZone = .current) -> PenzNewsCardModel {
    let holding: String, glyph: String
    switch item.kind {
    case "fx": holding = "Deviza"; glyph = "repeat-deep"
    case "rates": holding = item.holdingName?.nilIfEmpty ?? "Kamat"; glyph = "scale-ink"
    default: holding = item.holdingName?.nilIfEmpty ?? "Befektetés"; glyph = item.sleeve.map(penzSleeveGlyph) ?? "star-sun"
    }
    let n = item.sources.count
    let count = n == 0 ? "" : (n == 1 ? "1 forrásból" : "\(n) forrásból összevonva")
    let stamp = penzNewsStamp(item.publishedAt ?? generatedAt, now: now, timeZone: timeZone)
    let when = [stamp, count].compactMap { $0?.nilIfEmpty }.joined(separator: " · ")
    let sources = item.sources.enumerated().map { i, s in
        PenzNewsSourceLine(text: [s.name, s.title].compactMap(\.nilIfEmpty).joined(separator: " · "),
                           url: penzSafeURL(s.url), id: i)
    }
    return PenzNewsCardModel(
        id: item.id, holding: holding, sleeve: item.sleeve.map(penzSleeveTitle) ?? "", holdingGlyph: glyph, title: item.title,
        effect: penzEffectText(item.effectHufMinor), effectNote: item.effectNote, negative: penzWhole(item.effectHufMinor) < 0,
        confidence: min(2, max(0, item.confidence)), confidenceText: penzConfidenceText(item.confidence), sourceCount: n,
        when: when, verdict: item.verdict, body: item.body, uncertainty: item.uncertainty,
        noAction: item.noAction.nilIfEmpty ?? "Ez a hír nem ok a lépésre, és nem is küldelek sehova.", sources: sources)
}

/// Only http(s) links open (a feed is untrusted text).
func penzSafeURL(_ s: String) -> URL? {
    guard let u = URL(string: s.trimmingCharacters(in: .whitespaces)), let scheme = u.scheme?.lowercased(),
          scheme == "https" || scheme == "http", u.host != nil else { return nil }
    return u
}

/// "Ma 09:30" / "Tegnap 18:10" / "November 18. 07:40"; nil when unreadable.
public func penzNewsStamp(_ iso: String?, now: Date, timeZone: TimeZone) -> String? {
    guard let iso, let date = penzParseISO(iso) else { return nil }
    var cal = penzCalendar
    cal.timeZone = timeZone
    let hm = cal.dateComponents([.hour, .minute], from: date)
    let time = String(format: "%02d:%02d", hm.hour ?? 0, hm.minute ?? 0)
    let day = penzDay(date, calendar: cal), today = penzDay(now, calendar: cal)
    if day == today { return "Ma " + time }
    if let y = cal.date(byAdding: .day, value: -1, to: now), penzDay(y, calendar: cal) == day { return "Tegnap " + time }
    return penzDayTitle(day) + " " + time
}

func penzParseISO(_ s: String) -> Date? {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = f.date(from: s) { return d }
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: s)
}

// MARK: - The digest block

/// What the bottom of Ma shows.
public enum PenzDigestView: Equatable, Sendable {
    case loading
    /// No digest and a read problem (offline with no cache, or a server fault).
    case failed(String)
    /// He has no holdings yet — one quiet line pointing at Pénzem.
    case noHoldings
    /// Not built yet this morning.
    case pending
    /// Built, and nothing touched his holdings.
    case quiet
    /// Every news source failed its last fetch.
    case unhealthy
    /// The build failed and no fallback could be made.
    case buildFailed
    case items([PenzNewsCardModel])
}

public func penzDigestView(digest: PenzDigest?, problem: PlanFetchError?, portfolio: PenzPortfolio?,
                           now: Date = Date(), timeZone: TimeZone = .current) -> PenzDigestView {
    if let portfolio, portfolio.isEmpty { return .noHoldings }
    guard let d = digest else {
        if let problem {
            return .failed(problem == .offline ? "Nincs net, és a mai összefoglalóból még nincs elmentett példányom."
                                               : "A mai összefoglalót most nem érem el.")
        }
        return .loading
    }
    switch d.status {
    case "pending": return d.newsHealthy ? .pending : .unhealthy
    case "failed": return .buildFailed
    default:
        if d.items.isEmpty { return d.newsHealthy ? .quiet : .unhealthy }
        return .items(d.items.map { penzNewsCard($0, generatedAt: d.generatedAt, now: now, timeZone: timeZone) })
    }
}

public let penzDigestRefreshingText = "Utánanézek a híreknek — pár perc."
public let penzDigestLimitedText = "Nemrég frissült — pár perc múlva újra."
public let penzDigestPendingText = "A mai összefoglaló még nem készült el — reggel állítom össze, a tőzsdék nyitása előtt. Ha később visszanézel, itt lesz."
public let penzDigestQuietText = "Ma egyetlen hír sem érintette a *te befektetéseidet*. Ez is válasz: nincs mit nézned."
public let penzDigestUnhealthyText = "A hírforrásokat most nem érem el, ezért ma nincs friss összefoglaló"
public let penzDigestBuildFailedText = "Ma nem sikerült összeállítanom az összefoglalót. A számaid rendben vannak, csak a hírek maradtak ki — holnap reggel újra próbálom."
public let penzDigestNoHoldingsText = "Ha rögzítesz egy befektetést a *Pénzem* oldalon, itt látod a róla szóló híreket — csak azokat, amik a te pénzedet érintik."

/// „Hogyan készül ez az összefoglaló?" — the spike's text.
public let penzDigestInfoText = """
Csak azt hozom ide, ami a *te meglévő befektetéseidet* érinti, és csak akkor, ha tartósan számít: szabályozás, technológia, iparági szerkezet, vagy a hosszú távú számok. A napon belüli hullámzást kiszűröm.

Az azonos eseményről szóló cikkeket egy hírbe vonom össze, és odaírom, hány forrásból. Minden forintösszeget *a rendszer számol ki* a te adataidból — a szöveget írom, a számokat nem —, és mindegyik mellé odaírom, mikori.

Minden hírnél kiírom, mennyire vagyok biztos benne, és hol tévedhetek. Soha nincs itt „vedd meg” vagy „add el”.
"""

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
