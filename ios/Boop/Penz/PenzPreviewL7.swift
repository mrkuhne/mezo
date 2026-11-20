#if DEBUG
import Foundation
import HTTPTypes
import OpenAPIRuntime
import BoopCore

/// Simulator review only (L7, `mezo-r36n9.105`): Gyakorlás, the catalog, the proposals and the strategy answered
/// locally with invented, real-looking figures (the spike's: OTP kitörés +1,9R, 12 000 of a 20 000 Ft cap …) — never
/// the owner's. Writes are kept for the run, so a plan, an entry, a close, an accept or an approve shows its effect.
///
/// `-penzPractice full|quiet|empty|error` (default `full`): a week with four closed trades, one open and one plan · open
/// and planned trades but nothing closed this week · never traded · the server failing. `-penzProposals open|accepted|none`
/// (default `open`): one lump-sum proposal waiting (its middle sleeve has a single approved product, so the honest
/// "csak 1 jóváhagyott termék" line shows) · plus an accepted monthly plan with one step ticked · nothing. An entry whose
/// cost does not fit the cap answers 422 `PENZ_PRACTICE_CAP_EXCEEDED`.
final class PenzPreviewL7: @unchecked Sendable {
    static let shared = PenzPreviewL7()
    private let lock = NSLock()

    var practiceState: String { UserDefaults.standard.string(forKey: "penzPractice") ?? "full" }
    var proposalsState: String { UserDefaults.standard.string(forKey: "penzProposals") ?? "open" }

    let capMinor: Int64 = 2_000_000
    var trades: [PenzPaperTrade] = []
    var proposals: [PenzProposal] = []
    var catalog: [PenzProduct] = []

    private let today = penzDay(Date())
    private lazy var weekStart: String = penzDay(penzCalendar.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date())
    private func weekDay(_ n: Int) -> String {
        let start = penzCalendar.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date()
        let d = penzCalendar.date(byAdding: .day, value: n, to: start) ?? Date()
        return min(penzDay(d), today)
    }
    private func daysAgo(_ n: Int) -> String { penzDay(penzCalendar.date(byAdding: .day, value: -n, to: Date()) ?? Date()) }

    init() {
        catalog = Self.seedCatalog()
        trades = seedTrades()
        proposals = seedProposals()
    }

    // MARK: - Seeds

    private func closed(_ id: String, _ instrument: String, entry: Int64, stop: Int64, exit: Int64, qty: Double, tags: [String],
                        day: String, mistake: Bool = false, why: String, line: String, target: Int64? = nil,
                        stopRespected: Bool = true) -> PenzPaperTrade {
        var t = PenzPaperTrade(id: id, status: "closed", instrument: instrument, why: why, quantity: qty,
                               plannedEntry: .huf(entry), stop: .huf(stop), target: target.map(PenzMoney.huf),
                               entry: .huf(entry), entryDate: day, exit: .huf(exit), exitDate: day,
                               tags: tags, mistake: mistake, line: line, stopRespected: stopRespected,
                               createdAt: day + "T08:00:00Z")
        Self.settle(&t)
        return t
    }

    /// R, P/L and risk from the typed levels — the server's rule (build notes §1.4), HUF only in the preview.
    static func settle(_ t: inout PenzPaperTrade) {
        guard let entry = t.entry?.minor else { return }
        let risk = Double(abs(entry - t.stop.minor)) * t.quantity
        t.riskMinor = Int64(risk); t.riskHufMinor = Int64(risk)
        t.costHufMinor = Int64(Double(entry) * t.quantity)
        if let exit = t.exit?.minor {
            let pnl = Double(t.direction == "short" ? entry - exit : exit - entry) * t.quantity
            t.pnl = .huf(Int64(pnl))
            t.rMultiple = risk > 0 ? (pnl / risk * 100).rounded() / 100 : nil
        } else if let close = t.lastClose?.minor {
            t.unrealizedHufMinor = Int64(Double(t.direction == "short" ? entry - close : close - entry) * t.quantity)
        } else {
            t.unrealizedHufMinor = 0
        }
    }

    private func seedTrades() -> [PenzPaperTrade] {
        let state = practiceState
        guard state != "empty" else { return [] }
        var out: [PenzPaperTrade] = []
        if state == "full" {
            out += [
                closed("p1", "OTP", entry: 2_000_000, stop: 1_990_000, exit: 2_019_000, qty: 2, tags: ["kitores"], day: weekDay(0),
                       why: "Kitörés a heti csúcs fölé, nagy forgalommal.", line: "Terv szerint, a célnál zártam.", target: 2_019_000),
                closed("p2", "Nasdaq-ETF", entry: 1_500_000, stop: 1_480_000, exit: 1_480_000, qty: 1, tags: ["visszateszt"], day: weekDay(1),
                       why: "Visszateszt a letört szintre.", line: "A stop kivitt, ahogy terveztem."),
                closed("p3", "Mol", entry: 300_000, stop: 290_000, exit: 305_000, qty: 2, tags: ["nyitasi_tartomany", "korai_zaras"],
                       day: weekDay(2), why: "A nyitási tartomány teteje fölött.", line: "Korán zártam, idegesített."),
                closed("p4", "Richter", entry: 1_020_000, stop: 1_000_000, exit: 986_000, qty: 1.5, tags: ["hirre", "terven_kivul"],
                       day: weekDay(3), mistake: true, why: "Hír jött, beugrottam.", line: "Nem írtam le előre, hol lépek ki.",
                       stopRespected: false),
                // last week: what makes the month's paper P/L positive
                closed("p0", "OTP", entry: 1_950_000, stop: 1_930_000, exit: 1_990_000, qty: 1, tags: ["trend"], day: daysAgo(9),
                       why: "Trend mentén, a mozgóátlag fölött.", line: "Hagytam futni."),
                closed("p00", "Mol", entry: 295_000, stop: 285_000, exit: 300_000, qty: 2, tags: ["fordulo"], day: daysAgo(11),
                       why: "Fordulóra a támasznál.", line: "Rendben ment."),
            ]
        }
        var open = PenzPaperTrade(id: "o1", status: "open", instrument: "Magyar Telekom", why: "Trend mentén, emelkedő mélypontok.",
                                  quantity: 10, plannedEntry: .huf(120_000), stop: .huf(114_000), target: .huf(132_000),
                                  entry: .huf(120_000), entryDate: daysAgo(1), lastClose: .huf(121_500), lastCloseDate: daysAgo(1),
                                  tags: [], createdAt: daysAgo(1) + "T08:00:00Z")
        Self.settle(&open)
        var plan = PenzPaperTrade(id: "pl1", status: "planned", instrument: "4iG", why: "Ha a 900-as szint fölé zár, kitörés.",
                                  quantity: 5, plannedEntry: .huf(90_500), stop: .huf(87_000), target: .huf(97_000),
                                  createdAt: today + "T07:30:00Z")
        Self.settle(&plan)
        out += [open, plan]
        return out
    }

    private static func product(_ id: String, _ name: String, _ kind: String, _ currency: String, _ sleeves: [String],
                                _ what: String, ter: Double?, entry: Double? = nil, feeNote: String? = nil,
                                dist: String, source: String, reviewed: String, status: String = "approved") -> PenzProduct {
        PenzProduct(id: id, name: name, kind: kind, currency: currency, sleeves: sleeves, whatItIs: what, terPct: ter,
                    entryFeePct: entry, feeNote: feeNote, distribution: dist, sourceName: source,
                    sourceUrl: "https://example.org/\(id)", reviewedAt: reviewed, status: status,
                    approvedAt: status == "approved" ? "2026-11-15T10:00:00Z" : nil)
    }

    static func seedCatalog() -> [PenzProduct] {
        [
            product("c1", "Inflációkövető állampapír", "state_bond", "HUF", ["short"],
                    "Az állam kölcsönt vesz fel tőled; a kamata az inflációhoz igazodik.", ter: nil, feeNote: "nincs éves díja, ha lejáratig tartod",
                    dist: "interest", source: "Államkincstár", reviewed: "2026-11-18"),
            product("c2", "Rövid kötvényalap", "money_market", "HUF", ["short"],
                    "Rövid lejáratú állampapírokat tart; kicsit mozog, bármikor eladható.", ter: 0.45, dist: "accumulating",
                    source: "Az alapkezelő tájékoztatója", reviewed: "2026-11-18"),
            product("c3", "Globális kötvény-ETF", "bond_etf", "EUR", ["mid"],
                    "Sok ország állam- és vállalati kötvénye egyben, euróra fedezve.", ter: 0.10, dist: "accumulating",
                    source: "justETF", reviewed: "2026-11-20"),
            product("c4", "Világ-részvény ETF", "equity_etf", "EUR", ["mid", "long"],
                    "A világ nagyjából 1 500 nagyvállalata egy alapban.", ter: 0.20, dist: "accumulating", source: "justETF",
                    reviewed: "2026-11-20"),
            product("c5", "Fejlett piaci ETF", "equity_etf", "EUR", ["long"],
                    "Csak a fejlett országok nagyvállalatai; a feltörekvő piacok nincsenek benne.", ter: 0.12, dist: "accumulating",
                    source: "justETF", reviewed: "2026-11-20"),
            product("c6", "Világ-részvény ETF · osztalékfizető", "equity_etf", "USD", ["long"],
                    "Ugyanaz a világpiac, de az osztalékot negyedévente kifizeti.", ter: 0.22, dist: "distributing",
                    source: "justETF", reviewed: "2026-11-19"),
            product("c7", "Euró pénzpiaci ETF", "money_market", "EUR", ["short"],
                    "Napi kamatozású euró betétek és nagyon rövid papírok.", ter: 0.10, dist: "accumulating",
                    source: "justETF", reviewed: "2026-11-20", status: "suggested"),
            product("c8", "Kiegyensúlyozott vegyes alap", "mixed_fund", "HUF", ["mid"],
                    "Fele részvény, fele kötvény, forintban.", ter: 1.35, entry: 1.0, dist: "accumulating",
                    source: "KID dokumentum", reviewed: "2026-11-17", status: "suggested"),
            product("c9", "Tematikus technológiai ETF", "equity_etf", "USD", ["long"],
                    "Néhány tucat technológiai cég.", ter: 0.45, dist: "accumulating", source: "justETF",
                    reviewed: "2026-11-12", status: "declined"),
        ]
    }

    private func option(_ id: String, amount: Int64, differs: [String]) -> PenzProductOption {
        let p = catalog.first { $0.id == id }!
        return PenzProductOption(productId: p.id, name: p.name, whatItIs: p.whatItIs, kind: p.kind, currency: p.currency,
                                 distribution: p.distribution, terPct: p.terPct, entryFeePct: p.entryFeePct, feeNote: p.feeNote,
                                 yearlyCostHufMinor: penzYearlyCost(amountHufMinor: amount, terPct: p.terPct),
                                 reviewedAt: p.reviewedAt, differs: differs, sourceName: p.sourceName)
    }

    private func build(id: String, kind: String, amount: Int64, created: String) -> PenzProposal {
        let short = (amount * 20 / 100) / 100_000 * 100_000
        let mid = ((amount - short) * 40 / 100) / 100_000 * 100_000
        let long = amount - short - mid
        func share(_ x: Int64) -> Double { (Double(x) / Double(amount) * 1000).rounded() / 10 }
        let monthly = kind == "monthly"
        let title = monthly ? "Havi \(penzFtUnit(amount)) három rekeszbe" : "\(penzFtUnit(amount)) három rekeszbe"
        return PenzProposal(
            id: id, kind: kind, amountHufMinor: amount, createdAt: created,
            title: title,
            sub: "A tartalékod öt és fél hónapra elég, ezért egy kisebb rész még oda megy, a többi hosszabb távra.",
            summary: "A tartalékod *5,5 hónapnyi* fix kiadásra elég, a célod 6 hónap — ezért a biztonsági rekesz kap még \(penzFtUnit(short))-ot. A maradékot a szabály szerint *40% közép- és 60% hosszú távra* osztottam.",
            uncertainty: "A fix kiadásaidat a múlt hónapból vettem; ha decemberben több lesz, a tartalék kevesebb hónapra elég. A termékek díjai a megadott napon voltak ilyenek — azóta változhattak. Hogy melyik rekesz mennyit hoz, azt nem tudom, és nem is ígérem.",
            narratedBy: "model",
            facts: [PenzProposalFact(value: "5,5", unit: "hó", label: "ennyi fix kiadásra elég a tartalékod"),
                    PenzProposalFact(value: "6", unit: "hó", label: "a tartalék célja"),
                    PenzProposalFact(value: penzOutfit(penzFt(amount)), unit: "Ft", label: monthly ? "havi összeg" : "amit elhelyeznél")],
            rules: ["A biztonsági rekesz (1–3 év) előbb a 6 havi tartalékig töltődik.",
                    "Ami ezen felül marad, annak 40%-a középtávra (5–10 év), 60%-a hosszú távra (10+ év) megy.",
                    "Az összegeket 1 000 Ft-ra kerekítem lefelé; a kerekítés maradéka a hosszú rekeszbe kerül.",
                    "Rekeszenként a legolcsóbb jóváhagyott termékekkel kezdem, legfeljebb hármat mutatok."],
            sleeves: [
                PenzProposalSleeve(sleeve: "short", label: "1–3 év", amountHufMinor: short, sharePct: share(short),
                                   why: "Ezzel a tartalékod eléri a 6 hónapot. Ami bármikor kellhet, az ne mozogjon sokat.",
                                   options: [option("c1", amount: short, differs: ["nincs éves díja, ha lejáratig tartod", "lejárat előtt csak díjjal váltható vissza"]),
                                             option("c2", amount: short, differs: ["bármikor eladható", "évi kb. \(penzFtUnit(penzYearlyCost(amountHufMinor: short, terPct: 0.45) ?? 0))-tal drágább"])]),
                PenzProposalSleeve(sleeve: "mid", label: "5–10 év", amountHufMinor: mid, sharePct: share(mid),
                                   why: "Öt-tíz évre félretett pénz: kötvény és részvény vegyesen, hogy kevésbé hullámozzon.",
                                   optionsNote: "ehhez a rekeszhez még csak 1 jóváhagyott termék van — a termékjegyzékben tudsz jóváhagyni",
                                   options: [option("c3", amount: mid, differs: ["euróra fedezve, az árfolyam kevésbé mozgatja"])]),
                PenzProposalSleeve(sleeve: "long", label: "10+ év", amountHufMinor: long, sharePct: share(long),
                                   why: "Tíz évnél hosszabb távra: itt a hullámzás nem baj, a költség viszont minden évben számít.",
                                   options: [option("c5", amount: long, differs: ["a legolcsóbb", "a feltörekvő piacok nincsenek benne"]),
                                             option("c4", amount: long, differs: ["évi kb. \(penzFtUnit((penzYearlyCost(amountHufMinor: long, terPct: 0.20) ?? 0) - (penzYearlyCost(amountHufMinor: long, terPct: 0.12) ?? 0)))-tal drágább", "a teljes világpiac"]),
                                             option("c6", amount: long, differs: ["dollárban van", "osztalékot fizet — azt neked kell újra befektetni"])]),
            ])
    }

    private func seedProposals() -> [PenzProposal] {
        switch proposalsState {
        case "none": return []
        case "accepted":
            return [acceptedSeed(), build(id: "pr-lump", kind: "lump_sum", amount: 50_000_000, created: today + "T09:00:00Z")]
        default:
            return [build(id: "pr-lump", kind: "lump_sum", amount: 50_000_000, created: today + "T09:00:00Z")]
        }
    }

    private func acceptedSeed() -> PenzProposal {
        var p = build(id: "pr-month", kind: "monthly", amount: 12_000_000, created: daysAgo(6) + "T09:00:00Z")
        p.status = "accepted"; p.acceptedAt = daysAgo(6) + "T09:10:00Z"
        p.plan = [PenzPlanStep(index: 0, sleeve: "short", productId: "c1", productName: "Inflációkövető állampapír",
                               amountHufMinor: p.sleeves[0].amountHufMinor, done: true, doneAt: daysAgo(4) + "T18:00:00Z"),
                  PenzPlanStep(index: 1, sleeve: "mid", productId: "c3", productName: "Globális kötvény-ETF",
                               amountHufMinor: p.sleeves[1].amountHufMinor),
                  PenzPlanStep(index: 2, sleeve: "long", productId: "c5", productName: "Fejlett piaci ETF",
                               amountHufMinor: p.sleeves[2].amountHufMinor)]
        return p
    }

    // MARK: - The overview

    func overview() -> PenzPracticeOverview {
        let month = String(today.prefix(7))
        let closedAll = trades.filter { $0.status == "closed" }
        let week = closedAll.filter { ($0.exitDate ?? "") >= weekStart }.sorted { ($0.exitDate ?? "") > ($1.exitDate ?? "") }
        let monthPnl = closedAll.filter { ($0.exitDate ?? "").hasPrefix(month) }.reduce(Int64(0)) { $0 + ($1.pnl?.hufMinor ?? 0) }
        let openTrades = trades.filter { $0.status == "open" }
        let used = openTrades.reduce(Int64(0)) { $0 + ($1.costHufMinor ?? 0) } + max(0, -monthPnl)
        let rs = closedAll.compactMap(\.rMultiple)
        let avg = rs.isEmpty ? nil : (rs.reduce(0, +) / Double(rs.count) * 10).rounded() / 10
        let tagged = closedAll.filter { !$0.tags.isEmpty }.count
        let weekRs = week.compactMap(\.rMultiple)
        var curve: [PenzCurvePoint] = []
        var cum: Int64 = 0
        var d = weekStart
        while d <= today {
            cum += week.filter { $0.exitDate == d }.reduce(0) { $0 + ($1.pnl?.hufMinor ?? 0) }
            curve.append(PenzCurvePoint(date: d, cumulativeHufMinor: cum))
            d = penzDay(penzCalendar.date(byAdding: .day, value: 1, to: penzCalendar.date(from: DateComponents(
                year: Int(d.prefix(4)), month: Int(d.dropFirst(5).prefix(2)), day: Int(d.suffix(2)))) ?? Date()) ?? Date())
        }
        let mistakes = week.filter(\.mistake)
        let bySetup = Dictionary(grouping: week.compactMap { t in t.tags.first.map { ($0, t) } }, by: \.0).map { tag, pairs in
            let ts = pairs.map(\.1)
            let r = ts.compactMap(\.rMultiple)
            return PenzSetupStat(tag: tag, label: penzTagLabel(tag, tags: penzPracticeDefaultTags).capitalizedFirst, count: ts.count,
                                 wins: ts.filter { ($0.rMultiple ?? 0) > 0 }.count,
                                 avgR: r.isEmpty ? nil : r.reduce(0, +) / Double(r.count))
        }.sorted { $0.count > $1.count }
        let headline: String? = week.isEmpty ? nil : (mistakes.isEmpty ? "Terv szerint ment a hét" : "A terv nélküli belépések vitték el a hetet")
        let sub: String? = week.isEmpty ? nil : (mistakes.isEmpty
            ? "Minden kereskedésnél előre leírtad, hol lépsz ki, és tartottad is magad hozzá."
            : "Négy kereskedésből háromnál előre leírtad, hol lépsz ki — azok átlagban *+0,5R*-t hoztak. A negyediknél nem, és az −1,7R lett. Ez a hét leggyakoribb hibája, és 510 Ft-ba került.")
        let observations: [PenzObservation] = week.count < 2 ? [] : [
            PenzObservation(title: "A terv a döntő", body: "Amikor előre leírtad a kilépési szintet, az átlagod +0,5R. Amikor nem, −1,7R. Négy kereskedésnél ez még nem bizonyíték, csak feltűnő."),
            PenzObservation(title: "A hírre belépés a gyenge pont", body: "Az egyetlen kereskedés, amit friss hír után nyitottál, veszteséges lett."),
            PenzObservation(title: "A nyereséges kereskedést korán zártad", body: "A Mol-t a tervezett szint előtt zártad be."),
        ]
        let w = PenzPracticeWeek(
            weekStart: weekStart, weekEnd: weekDay(6), headline: headline, sub: sub, closedCount: week.count,
            winRatePct: week.isEmpty ? nil : week.filter { ($0.rMultiple ?? 0) > 0 }.count * 100 / week.count,
            avgR: weekRs.isEmpty ? nil : weekRs.reduce(0, +) / Double(weekRs.count), bySetup: bySetup,
            distribution: PenzRDistribution(bigWins: weekRs.filter { $0 >= 2 }.count,
                                            smallLosses: weekRs.filter { $0 < 0 && $0 >= -1.2 }.count,
                                            worseThanLimit: weekRs.filter { $0 < -1.5 }.count,
                                            healthy: !weekRs.contains { $0 < -1.5 }),
            commonMistake: mistakes.first.map { m in
                PenzCommonMistake(tag: m.tags.first ?? "", label: penzTagLabel(m.tags.first ?? "", tags: penzPracticeDefaultTags).capitalizedFirst,
                                  count: mistakes.count, costHufMinor: max(0, -mistakes.reduce(0) { $0 + ($1.pnl?.hufMinor ?? 0) }))
            },
            observations: observations, curve: curve, trades: week)
        return PenzPracticeOverview(
            month: month, cap: PenzPracticeCap(capHufMinor: capMinor, usedHufMinor: used, leftHufMinor: max(0, capMinor - used)),
            monthPnlHufMinor: monthPnl, avgR: avg, closedCount: closedAll.count, taggedCount: tagged,
            noiseLine: tagged < 50 ? "50 jelölt kereskedés alatt ezek a számok még zajnak számítanak — most \(tagged) van." : nil,
            tags: penzPracticeDefaultTags, week: w,
            open: openTrades, planned: trades.filter { $0.status == "planned" }.sorted { $0.createdAt > $1.createdAt })
    }

    // MARK: - The transport's answers

    private func json<T: Encodable>(_ value: T, status: Int = 200) throws -> (HTTPResponse, HTTPBody?) {
        var h = HTTPFields(); h[.contentType] = "application/json"
        return (HTTPResponse(status: .init(code: status), headerFields: h), HTTPBody(try JSONEncoder().encode(value)))
    }

    private func refuse(_ status: Int, _ code: String) -> (HTTPResponse, HTTPBody?) {
        var h = HTTPFields(); h[.contentType] = "application/json"
        return (HTTPResponse(status: .init(code: status), headerFields: h), HTTPBody(#"{"messages":[{"code":"\#(code)"}]}"#))
    }

    /// nil = not an L7 operation.
    func answer(_ op: String, segments: [String], sent: Data) throws -> (HTTPResponse, HTTPBody?)? {
        try lock.withLock {
            let dec = JSONDecoder()
            func tradeIndex() -> Int? {
                guard let i = segments.firstIndex(of: "trades"), segments.indices.contains(i + 1) else { return nil }
                return trades.firstIndex { $0.id == segments[i + 1] }
            }
            func proposalIndex() -> Int? {
                guard let i = segments.firstIndex(of: "proposals"), segments.indices.contains(i + 1) else { return nil }
                return proposals.firstIndex { $0.id == segments[i + 1] }
            }
            switch op {
            case "getPenzPractice":
                if practiceState == "error" { return (HTTPResponse(status: .internalServerError), nil) }
                return try json(overview())
            case "listPenzPaperTrades":
                return try json(trades.sorted { ($0.exitDate ?? $0.entryDate ?? $0.createdAt) > ($1.exitDate ?? $1.entryDate ?? $1.createdAt) })
            case "createPenzPaperTrade":
                let r = try dec.decode(PenzTradeRequest.self, from: sent)
                if let same = trades.first(where: { $0.clientRef == r.clientRef && r.clientRef != nil }) { return try json(same, status: 201) }
                var t = PenzPaperTrade(id: UUID().uuidString.lowercased(), status: "planned", instrument: r.instrument,
                                       direction: r.direction, why: r.why, currency: r.currency, quantity: r.quantity,
                                       plannedEntry: r.plannedEntryMinor.map { PenzMoney(minor: $0, currency: r.currency) },
                                       stop: PenzMoney(minor: r.stopMinor, currency: r.currency),
                                       target: r.targetMinor.map { PenzMoney(minor: $0, currency: r.currency) },
                                       createdAt: ISO8601DateFormatter().string(from: Date()), clientRef: r.clientRef)
                if let e = r.entryMinor {
                    if let refused = enter(&t, e, r.entryDate ?? today) { return refused }
                }
                Self.settle(&t)
                trades.append(t)
                return try json(t, status: 201)
            case "openPenzPaperTrade":
                guard let i = tradeIndex() else { return refuse(404, "PENZ_PAPER_TRADE_NOT_FOUND") }
                guard trades[i].status == "planned" else { return refuse(409, "PENZ_PAPER_TRADE_STATE") }
                let r = try dec.decode(PenzTradeOpenRequest.self, from: sent)
                var t = trades[i]
                if let refused = enter(&t, r.entryMinor, r.entryDate) { return refused }
                Self.settle(&t); trades[i] = t
                return try json(t)
            case "closePenzPaperTrade":
                guard let i = tradeIndex() else { return refuse(404, "PENZ_PAPER_TRADE_NOT_FOUND") }
                guard trades[i].status == "open" else { return refuse(409, "PENZ_PAPER_TRADE_STATE") }
                let r = try dec.decode(PenzTradeCloseRequest.self, from: sent)
                guard !r.tags.isEmpty else { return refuse(400, "PENZ_PRACTICE_TAG_UNKNOWN") }
                trades[i].status = "closed"; trades[i].exit = PenzMoney(minor: r.exitMinor, currency: trades[i].currency)
                trades[i].exitDate = r.exitDate; trades[i].tags = r.tags; trades[i].mistake = r.mistake
                trades[i].line = r.line.isEmpty ? nil : r.line; trades[i].unrealizedHufMinor = nil
                let longSide = trades[i].direction != "short"
                trades[i].stopRespected = longSide ? r.exitMinor >= trades[i].stop.minor : r.exitMinor <= trades[i].stop.minor
                Self.settle(&trades[i])
                return try json(trades[i])
            case "recordPenzPaperTradeLastClose":
                guard let i = tradeIndex() else { return refuse(404, "PENZ_PAPER_TRADE_NOT_FOUND") }
                let r = try dec.decode(PenzLastCloseRequest.self, from: sent)
                trades[i].lastClose = PenzMoney(minor: r.closeMinor, currency: trades[i].currency); trades[i].lastCloseDate = r.date
                Self.settle(&trades[i])
                return try json(trades[i])
            case "cancelPenzPaperTrade":
                guard let i = tradeIndex() else { return refuse(404, "PENZ_PAPER_TRADE_NOT_FOUND") }
                guard trades[i].status == "planned" else { return refuse(409, "PENZ_PAPER_TRADE_STATE") }
                trades[i].status = "cancelled"
                return try json(trades[i])
            case "listPenzProducts":
                return try json(catalog)
            case "approvePenzProduct", "declinePenzProduct":
                guard let i = catalog.firstIndex(where: { $0.id == segments.dropLast().last }) else { return refuse(404, "PENZ_PRODUCT_NOT_FOUND") }
                catalog[i].status = op == "approvePenzProduct" ? "approved" : "declined"
                catalog[i].approvedAt = op == "approvePenzProduct" ? ISO8601DateFormatter().string(from: Date()) : nil
                return try json(catalog[i])
            case "listPenzProposals":
                return try json(proposals.sorted { $0.createdAt > $1.createdAt })
            case "getPenzProposal":
                guard let i = proposalIndex() else { return refuse(404, "PENZ_PROPOSAL_NOT_FOUND") }
                return try json(proposals[i])
            case "createPenzProposal":
                let r = try dec.decode(PenzProposalRequest.self, from: sent)
                let amount = r.kind == "monthly" ? 12_000_000 : (r.amountHufMinor ?? 0)
                guard amount >= 100_000 else { return refuse(400, "PENZ_PROPOSAL_AMOUNT_INVALID") }
                // a newer proposal of the same kind supersedes the un-accepted older one
                for i in proposals.indices where proposals[i].kind == r.kind && proposals[i].status == "proposed" {
                    proposals[i].status = "superseded"
                }
                let p = build(id: UUID().uuidString.lowercased(), kind: r.kind, amount: amount,
                              created: ISO8601DateFormatter().string(from: Date()))
                proposals.append(p)
                return try json(p, status: 201)
            case "acceptPenzProposal":
                guard let i = proposalIndex() else { return refuse(404, "PENZ_PROPOSAL_NOT_FOUND") }
                guard proposals[i].status == "proposed" else { return refuse(409, "PENZ_PROPOSAL_STATE") }
                let r = try dec.decode(PenzAcceptRequest.self, from: sent)
                proposals[i].status = "accepted"
                proposals[i].acceptedAt = ISO8601DateFormatter().string(from: Date())
                proposals[i].amountHufMinor = r.sleeves.reduce(0) { $0 + $1.amountHufMinor }
                proposals[i].plan = r.sleeves.filter { $0.amountHufMinor > 0 }.enumerated().map { n, s in
                    PenzPlanStep(index: n, sleeve: s.sleeve, productId: s.productId,
                                 productName: catalog.first { $0.id == s.productId }?.name, amountHufMinor: s.amountHufMinor)
                }
                return try json(proposals[i])
            case "dismissPenzProposal":
                guard let i = proposalIndex() else { return refuse(404, "PENZ_PROPOSAL_NOT_FOUND") }
                proposals[i].status = "dismissed"
                return try json(proposals[i])
            case "setPenzProposalStep":
                guard let i = proposalIndex(), let n = Int(segments.last ?? ""), proposals[i].plan.indices.contains(n) else {
                    return refuse(404, "PENZ_PROPOSAL_NOT_FOUND")
                }
                let r = try dec.decode(PenzStepRequest.self, from: sent)
                proposals[i].plan[n].done = r.done
                proposals[i].plan[n].doneAt = r.done ? ISO8601DateFormatter().string(from: Date()) : nil
                return try json(proposals[i])
            case "getPenzStrategy":
                let current = proposals.filter { $0.kind == "monthly" && $0.status == "proposed" }.max { $0.createdAt < $1.createdAt }
                return try json(PenzStrategy(
                    availableHufMinor: 12_000_000,
                    inputs: [.init(key: "avgIncome", label: "Átlagos havi bevétel · 3 hónap", hufMinor: 98_000_000),
                             .init(key: "avgExpenses", label: "Átlagos havi kiadás · 3 hónap", hufMinor: 64_000_000),
                             .init(key: "savingsTarget", label: "Havi megtakarítási cél", hufMinor: 20_000_000),
                             .init(key: "freeBeforeInvest", label: "Ami a hónapból szabadon marad", hufMinor: 12_000_000)],
                    note: "Az elmúlt három hónap átlagából és a mostani hónap keretéből számolom; a *kisebbik* számít, hogy a heti kereted ne fogyjon el.",
                    current: current))
            default:
                return nil
            }
        }
    }

    /// Opens a trade at `entry`: the cap check of the server (build notes §1.6). nil = entered.
    private func enter(_ t: inout PenzPaperTrade, _ entry: Int64, _ date: String) -> (HTTPResponse, HTTPBody?)? {
        let cost = Int64(Double(entry) * t.quantity) * (t.currency == "HUF" ? 1 : 395)
        let o = overview()
        if cost > o.cap.leftHufMinor { return refuse(422, "PENZ_PRACTICE_CAP_EXCEEDED") }
        if t.direction == "short" ? t.stop.minor <= entry : t.stop.minor >= entry { return refuse(400, "PENZ_PAPER_TRADE_INVALID_STOP") }
        t.status = "open"; t.entry = PenzMoney(minor: entry, currency: t.currency); t.entryDate = date
        return nil
    }
}
#endif
