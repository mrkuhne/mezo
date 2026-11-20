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
///
/// L6 (`mezo-r36n9.104`): `-penzPortfolio full|empty|stale|unpriced|error` (default `full`: holdings in all three sleeves,
/// one ETF in two sleeves, an accruing bond, a euro cash line) and `-penzDigest ready|pending|quiet|unhealthy|failed|error`
/// (`limited`: quiet, and a refresh answers 429) (default `ready`: three items like the spike — a holding falling, a rates decision at 0 Ft, a forint move). Writes
/// are kept for the run; the symbol `NOPE` is refused as unknown, a sell above the value is refused, and a non-forint
/// buy dated on a Sunday answers „no FX rate", so every server refusal can be seen.
enum PenzPreview {
    static let raw = RawJSONClient(transport: PenzPreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                   token: { "preview" })
    static let client = PenzClient(raw: raw)
    static let sender = PenzOutboxSender(raw: raw)
    static var state: String { UserDefaults.standard.string(forKey: "penzState") ?? "review" }
    static var portfolioState: String { UserDefaults.standard.string(forKey: "penzPortfolio") ?? "full" }
    static var digestState: String { UserDefaults.standard.string(forKey: "penzDigest") ?? "ready" }

    /// `-penzState offline`: what the cache would hold from a read five hours ago.
    static func primeCache(_ directory: URL) async {
        guard state == "offline" else { return }
        let earlier = Date().addingTimeInterval(-5 * 3600)
        let cache = ServerCache(directory: directory, clock: { earlier })
        let model = PenzPreviewModel(state: "review")
        try? await cache.put(model.snapshot(), endpoint: "penz/snapshot", date: "current")
        try? await cache.put(model.portfolio(), endpoint: "penz/portfolio", date: "current")
        try? await cache.put(model.digest(), endpoint: "penz/digest", date: model.today)
        try? await cache.put(PenzPreviewL7.shared.overview(), endpoint: "penz/practice", date: "current")
        try? await cache.put(PenzPreviewL7.shared.proposals, endpoint: "penz/proposals", date: "current")
        try? await cache.put(PenzPreviewL7.shared.catalog, endpoint: "penz/catalog", date: "current")
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

    // MARK: L6 — the portfolio and the digest

    /// One holding with its invented valuation (HUF minor).
    struct Line {
        var holding: PenzHolding
        var value: Int64, cost: Int64
        var quantity: Double?
        var changePct: Double?
        var priceMove: Int64, fxMove: Int64
        var valuation: String
    }
    lazy var lines: [Line] = PenzPreviewModel.seedLines(PenzPreview.portfolioState)
    lazy var events: [PenzHoldingEvent] = PenzPreview.portfolioState == "empty" ? [] : PenzPreviewModel.seedEvents(today: today)

    private static func h(_ id: Int, _ name: String, _ type: String, _ symbol: String?, _ platform: String, _ sleeve: String,
                          _ currency: String, rate: Double? = nil) -> PenzHolding {
        PenzHolding(id: String(format: "b0000000-0000-4000-8000-%012d", id), name: name, assetType: type, symbol: symbol,
                    platform: platform, sleeve: sleeve, currency: currency, bondRatePct: rate, position: id)
    }

    static func seedLines(_ state: String) -> [Line] {
        guard state != "empty" else { return [] }
        let unpriced = state == "unpriced"
        func line(_ h: PenzHolding, _ ft: Int64, cost: Int64, qty: Double?, pct: Double?, move: Int64, fx: Int64, valuation: String) -> Line {
            Line(holding: h, value: ft * 100, cost: cost * 100, quantity: qty, changePct: unpriced ? nil : pct,
                 priceMove: unpriced ? 0 : move * 100, fxMove: unpriced ? 0 : fx * 100, valuation: unpriced ? "cost" : valuation)
        }
        return [
            line(h(1, "Állampapír", "bond", nil, "mbh", "short", "HUF", rate: 6.5), 2_400_000, cost: 2_310_000, qty: nil, pct: nil,
                 move: 0, fx: 0, valuation: "accrual"),
            line(h(2, "Kötvény-ETF", "etf", "AGGH.AS", "revolut", "mid", "EUR"), 920_000, cost: 905_000, qty: 400, pct: 0.3,
                 move: 2_700, fx: -5_500, valuation: "quote"),
            line(h(3, "Világ-ETF", "etf", "VWCE.DE", "revolut", "mid", "EUR"), 520_000, cost: 470_000, qty: 10, pct: 1.4,
                 move: 7_200, fx: -3_100, valuation: "quote"),
            line(h(4, "Deviza", "cash", nil, "revolut", "mid", "EUR"), 420_000, cost: 425_000, qty: nil, pct: nil,
                 move: 0, fx: -2_500, valuation: "quote"),
            line(h(5, "Világ-ETF", "etf", "VWCE.DE", "revolut", "long", "EUR"), 1_520_000, cost: 1_310_000, qty: 29, pct: 1.4,
                 move: 21_000, fx: -9_200, valuation: "quote"),
            line(h(6, "OTP részvény", "stock", "OTP.BD", "mbh", "long", "HUF"), 638_000, cost: 590_000, qty: 22, pct: 1.9,
                 move: 11_900, fx: 0, valuation: "quote"),
        ]
    }

    static func seedEvents(today: String) -> [PenzHoldingEvent] {
        func day(_ n: Int) -> String {
            penzDay(penzCalendar.date(byAdding: .day, value: n, to: Date()) ?? Date())
        }
        return [
            PenzHoldingEvent(id: "e0000000-0000-4000-8000-000000000001", holdingId: "b0000000-0000-4000-8000-000000000001",
                             holdingName: "Állampapír", sleeve: "short", kind: "coupon", date: day(18), amountMinor: 3_420_000,
                             currency: "HUF", amountHufMinor: 3_420_000, note: "1 200 000 Ft-os rész"),
            PenzHoldingEvent(id: "e0000000-0000-4000-8000-000000000002", holdingId: "b0000000-0000-4000-8000-000000000005",
                             holdingName: "Világ-ETF", sleeve: "long", kind: "dividend", date: day(29), amountMinor: 2_280,
                             currency: "EUR", amountHufMinor: 890_000),
            PenzHoldingEvent(id: "e0000000-0000-4000-8000-000000000003", holdingId: "b0000000-0000-4000-8000-000000000001",
                             holdingName: "Állampapír", sleeve: "short", kind: "maturity", date: day(74), amountMinor: 120_000_000,
                             currency: "HUF", amountHufMinor: 120_000_000),
        ]
    }

    func portfolio() -> PenzPortfolio {
        let state = PenzPreview.portfolioState
        let total = lines.reduce(Int64(0)) { $0 + $1.value }
        let yesterday = penzDay(penzCalendar.date(byAdding: .day, value: -1, to: Date()) ?? Date())
        let weekAgo = penzDay(penzCalendar.date(byAdding: .day, value: -6, to: Date()) ?? Date())
        let quoted = lines.filter { $0.valuation == "quote" }
        let prev = quoted.reduce(Int64(0)) { $0 + $1.value - $1.priceMove - $1.fxMove }
        let move = lines.reduce(Int64(0)) { $0 + $1.priceMove }, fx = lines.reduce(Int64(0)) { $0 + $1.fxMove }
        let fixed: Int64 = 41_200_000
        let sleeves = ["short", "mid", "long"].map { key -> PenzSleeve in
            let mine = lines.filter { $0.holding.sleeve == key }
            let value = mine.reduce(Int64(0)) { $0 + $1.value }
            let positions = mine.map { l in
                PenzPosition(holdingId: l.holding.id, name: l.holding.name, assetType: l.holding.assetType, symbol: l.holding.symbol,
                             platform: l.holding.platform, currency: l.holding.currency, quantity: l.quantity,
                             valueHufMinor: l.value, costHufMinor: l.cost,
                             sharePct: value > 0 ? (Double(l.value) / Double(value) * 1000).rounded() / 10 : 0,
                             priceMoveHufMinor: l.priceMove, fxMoveHufMinor: l.fxMove, changePct: l.changePct,
                             priced: l.valuation != "cost", valuation: l.valuation,
                             priceAsOf: l.valuation == "quote" ? (state == "stale" ? weekAgo : yesterday) : nil)
            }
            return PenzSleeve(sleeve: key, valueHufMinor: value, costHufMinor: mine.reduce(0) { $0 + $1.cost },
                              sharePct: total > 0 ? (Double(value) / Double(total) * 1000).rounded() / 10 : 0,
                              priceMoveHufMinor: mine.reduce(0) { $0 + $1.priceMove }, fxMoveHufMinor: mine.reduce(0) { $0 + $1.fxMove },
                              coverageMonths: key == "long" && value > 0 ? Int(value / fixed) : nil, holdings: positions)
        }
        let unpriced = lines.filter { $0.valuation == "cost" }.count
        return PenzPortfolio(
            date: today, totalHufMinor: total, costHufMinor: lines.reduce(0) { $0 + $1.cost }, priceMoveHufMinor: move,
            fxMoveHufMinor: fx,
            priceMovePct: prev > 0 && state != "unpriced" ? (Double(move) / Double(prev) * 1000).rounded() / 10 : nil,
            fxMovePct: prev > 0 && state != "unpriced" ? (Double(fx) / Double(prev) * 1000).rounded() / 10 : nil,
            pricesAsOf: quoted.isEmpty ? nil : (state == "stale" ? weekAgo : yesterday), stale: state == "stale",
            unpricedCount: unpriced, fixedCostsMonthlyHufMinor: fixed, sleeves: sleeves,
            events: events.sorted { $0.date < $1.date },
            practice: PenzPracticeRow(monthlyHufMinor: settings.practiceMonthlyHufMinor))
    }

    /// The digest was asked to rebuild (`refreshPenzDigest`): a pending one comes back built on the next read.
    var refreshed = false

    func digest() -> PenzDigest {
        let state = refreshed && PenzPreview.digestState == "pending" ? "ready" : PenzPreview.digestState
        func at(_ hour: Int, _ minute: Int) -> String {
            let d = penzCalendar.date(bySettingHour: hour, minute: minute, second: 0, of: Date()) ?? Date()
            return ISO8601DateFormatter().string(from: d)
        }
        switch state {
        case "pending": return PenzDigest(date: today, status: "pending")
        case "quiet", "limited": return PenzDigest(date: today, status: "quiet", generatedAt: at(6, 40))
        case "unhealthy": return PenzDigest(date: today, status: "quiet", generatedAt: at(6, 40), newsHealthy: false)
        case "failed": return PenzDigest(date: today, status: "failed", generatedAt: at(6, 40))
        default: break
        }
        func src(_ name: String, _ title: String, _ host: String) -> PenzDigestSource {
            PenzDigestSource(name: name, title: title, url: "https://\(host)/")
        }
        return PenzDigest(date: today, status: "ready", generatedAt: at(6, 40), items: [
            PenzDigestItem(
                id: "d1", kind: "holding", holdingId: "b0000000-0000-4000-8000-000000000005", holdingName: "Világ-ETF", sleeve: "long",
                title: "A világ-ETF-ed 1,1%-ot esett a héten", effectHufMinor: -1_840_000, effectNote: "a te részeden", changePct: -1.1,
                confidence: 2,
                verdict: "Egy héten belüli mozgás a 10+ éves pénznél nem jelent semmit — a rekesz mérőszáma sem változott.",
                body: "A hét eleji esés a kamatvárakozások átárazódásából jött, nem egyetlen cégből vagy iparágból. Az alapod a világ nagyjából 1 500 nagyvállalatát tartja, tehát pontosan azt csinálta, amit ilyenkor szokott: együtt mozgott a piaccal.\n\nA te rekeszed mérőszáma — *hány hónapnyi fix kiadásodat fedezi* — ettől nem változott. Ez a fajta ingadozás havonta többször előfordul.\n\nAmiért ez egyáltalán felkerült ide: akkor szólok, ha a mozgás a *te* pénzedben forintban érzékelhető. 18 400 Ft az.",
                uncertainty: "A hír megtörtént és az ár tény; a *miértje* viszont elemzői értelmezés, és a források sem értenek egyet abban, mennyi szól a kamatokról és mennyi a technológiai cégekről. Azt pedig, hogy innen merre megy, senki nem tudja — én sem.",
                noAction: "Ez a pénz 10+ évre szól. Egy heti mozgás nem ok a lépésre, és nem is küldelek sehova.",
                publishedAt: at(9, 30),
                sources: [src("Portfolio", "A tengerentúli tőzsdék hete", "www.portfolio.hu"),
                          src("Reuters", "Global equities slip on rate outlook", "www.reuters.com"),
                          src("Bloomberg", "Tech leads the pullback", "www.bloomberg.com"),
                          src("FT", "Investors trim risk before the data", "www.ft.com"),
                          src("MNB", "Árfolyamok", "www.mnb.hu"),
                          src("Az alapkezelő", "Napi árfolyamközlés", "www.vanguard.com")]),
            PenzDigestItem(
                id: "d2", kind: "rates", holdingId: "b0000000-0000-4000-8000-000000000001", holdingName: "Állampapír", sleeve: "short",
                title: "A jegybank nem változtatott az alapkamaton", effectHufMinor: 0, effectNote: "változatlan hozam", confidence: 2,
                verdict: "A 2,4 milliós részed hozama változatlan. Azért írom ki, mert kamatdöntés volt — nem mert lépni kellene.",
                body: "A papírod kamata az alapkamathoz van kötve, tehát a döntés közvetlenül érint — csak éppen úgy, hogy *nem történik semmi*.\n\nEzt a hírt akkor is kiteszem, ha nulla a hatás. Ha csak a mozgásokat mutatnám, azt hinnéd, a hallgatásom azt jelenti, hogy nem történt semmi — pedig a „megtörtént, és nem érintett” más dolog, mint a „nem néztem meg”.",
                uncertainty: "Itt kevés a bizonytalanság: a döntés hivatalos, a papírod képlete ismert. Amit nem tudok: hogy a következő üléseken mi lesz, és hogy az infláció hogyan alakul.",
                noAction: "A hozamod változatlan, a papír fut tovább. A következő döntési pontod a lejárat.",
                publishedAt: at(14, 10),
                sources: [src("MNB", "A Monetáris Tanács közleménye", "www.mnb.hu"),
                          src("Portfolio", "Maradt a kamatszint", "www.portfolio.hu"),
                          src("Reuters", "Hungary holds rates", "www.reuters.com"),
                          src("Index", "Mi lesz az állampapírokkal", "index.hu")]),
            PenzDigestItem(
                id: "d3", kind: "fx", sleeve: "mid", title: "A forint 0,6%-ot erősödött az euróval szemben",
                effectHufMinor: -720_000, effectNote: "forintban mérve", changePct: -0.6, confidence: 1,
                verdict: "Ez nem a befektetés mozgása, hanem az árfolyamé — ezt a kettőt mindig külön mutatom.",
                body: "A devizában tartott részed ugyanannyi eurót ér, mint tegnap; forintban mérve kevesebbet, mert a forint erősödött. Ha holnap gyengül, ez magától visszajön — befektetési döntésed ettől nem lett se jobb, se rosszabb.\n\nEzért van a Pénzem oldalon két külön szám: *a befektetések mozgása* és *ebből az árfolyam*. Ha egybeolvasztanám őket, olyan teljesítményt mutatnék, amit a befektetés nem csinált.",
                uncertainty: "Közepes biztonságra tettem, mert a magyarázat a bizonytalan rész: hogy pontosan mi erősítette a forintot ma, arról a három forrás három dolgot mond. Maga az árfolyam és a te forintértéked viszont tény.",
                noAction: "Árfolyammozgás, nem befektetési esemény. Ha holnap gyengül a forint, magától visszajön.",
                publishedAt: at(8, 5),
                sources: [src("MNB", "Hivatalos középárfolyam", "www.mnb.hu"),
                          src("Portfolio", "Erősödő forint", "www.portfolio.hu"),
                          src("Reuters", "Forint firms", "www.reuters.com")]),
        ])
    }

    /// A recorded buy or sell, applied to the invented valuation. nil = accepted; else the refusal code.
    func record(_ r: PenzInvestTxnRequest) -> String? {
        guard let i = lines.firstIndex(where: { $0.holding.id == r.holdingId }) else { return "PENZ_HOLDING_NOT_FOUND" }
        let eur = lines[i].holding.currency != "HUF"
        if eur, penzCalendar.component(.weekday, from: penzCalendar.date(from: DateComponents(
            year: Int(r.date.prefix(4)), month: Int(r.date.dropFirst(5).prefix(2)), day: Int(r.date.suffix(2)))) ?? Date()) == 1 {
            return "PENZ_FX_UNAVAILABLE"
        }
        let huf = eur ? r.amountMinor * 395 : r.amountMinor
        if r.side == "sell" {
            if huf > lines[i].value { return "PENZ_SELL_EXCEEDS_POSITION" }
            lines[i].value -= huf; lines[i].cost = max(0, lines[i].cost - huf)
            if let q = r.quantity, let have = lines[i].quantity { lines[i].quantity = max(0, have - q) }
        } else {
            lines[i].value += huf; lines[i].cost += huf
            if let q = r.quantity { lines[i].quantity = (lines[i].quantity ?? 0) + q }
        }
        return nil
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
        func refuse(_ status: Int, _ code: String) -> (HTTPResponse, HTTPBody?) {
            var h = HTTPFields(); h[.contentType] = "application/json"
            return (HTTPResponse(status: .init(code: status), headerFields: h), HTTPBody(#"{"messages":[{"code":"\#(code)"}]}"#))
        }
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
            case "getPenzPortfolio":
                if PenzPreview.portfolioState == "error" { return (HTTPResponse(status: .internalServerError), nil) }
                return try json(m.portfolio())
            case "getPenzDigest":
                if PenzPreview.digestState == "error" { return (HTTPResponse(status: .internalServerError), nil) }
                return try json(m.digest())
            case "refreshPenzDigest":
                if PenzPreview.digestState == "limited" { return refuse(429, "PENZ_DIGEST_REFRESH_LIMITED") }
                m.refreshed = true
                return (HTTPResponse(status: .accepted), nil)
            case "listPenzHoldings":
                return try json(m.lines.map(\.holding))
            case "listPenzHoldingEvents":
                return try json(m.events)
            case "createPenzHolding":
                let r = try JSONDecoder().decode(PenzHoldingRequest.self, from: sent)
                if let same = m.lines.first(where: { $0.holding.clientRef == r.clientRef && r.clientRef != nil }) { return try json(same.holding) }
                if r.symbol?.uppercased() == "NOPE" { return refuse(400, "PENZ_SYMBOL_UNKNOWN") }
                let h = PenzHolding(id: UUID().uuidString.lowercased(), name: r.name, assetType: r.assetType, symbol: r.symbol,
                                    platform: r.platform, platformName: r.platformName, sleeve: r.sleeve, currency: r.currency,
                                    position: m.lines.count, clientRef: r.clientRef)
                m.lines.append(.init(holding: h, value: 0, cost: 0, quantity: nil, changePct: nil, priceMove: 0, fxMove: 0,
                                     valuation: r.symbol == nil ? "cost" : "quote"))
                return try json(h)
            case "createPenzInvestTransaction":
                let r = try JSONDecoder().decode(PenzInvestTxnRequest.self, from: sent)
                if let code = m.record(r) { return refuse(code == "PENZ_FX_UNAVAILABLE" ? 503 : (code == "PENZ_HOLDING_NOT_FOUND" ? 404 : 400), code) }
                return try json(PenzInvestTxn(id: UUID().uuidString.lowercased(), holdingId: r.holdingId, side: r.side, quantity: r.quantity,
                                              amount: PenzMoney(minor: r.amountMinor), date: r.date, clientRef: r.clientRef))
            case "createPenzHoldingEvent":
                let r = try JSONDecoder().decode(PenzHoldingEventRequest.self, from: sent)
                guard let l = m.lines.first(where: { $0.holding.id == r.holdingId }) else { return refuse(404, "PENZ_HOLDING_NOT_FOUND") }
                let e = PenzHoldingEvent(id: UUID().uuidString.lowercased(), holdingId: r.holdingId, holdingName: l.holding.name,
                                         sleeve: l.holding.sleeve, kind: r.kind, date: r.date, amountMinor: r.amountMinor,
                                         currency: l.holding.currency,
                                         amountHufMinor: r.amountMinor.map { l.holding.currency == "HUF" ? $0 : $0 * 395 })
                m.events.append(e)
                return try json(e)
            case "createPenzSavingsGoal":
                struct G: Decodable { let name: String; let kind: String; let targetHufMinor: Int64; let savedHufMinor: Int64?
                                      let dueDate: String?; let note: String? }
                let g = try JSONDecoder().decode(G.self, from: sent)
                let goal = PenzGoal(id: UUID().uuidString.lowercased(), name: g.name, kind: g.kind, target: .huf(g.targetHufMinor),
                                    saved: .huf(g.savedHufMinor ?? 0), dueDate: g.dueDate, note: g.note, position: m.goals.count)
                m.goals.append(goal)
                return try json(goal)
            default:
                // L7: practice, catalog, proposals, strategy (`PenzPreviewL7.swift`)
                if let answer = try PenzPreviewL7.shared.answer(operationID, segments: segments, sent: sent) { return answer }
                return (HTTPResponse(status: .notFound), nil)
            }
        }
    }
}
#endif
