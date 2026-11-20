import Foundation
import Testing
@testable import BoopCore

/// Invented, real-looking figures (the spike's), never the owner's.
enum PenzFixtures {
    static func allowance(date: String = "2026-11-19", weekRemaining: Int64 = 3_450_000, weekBudget: Int64 = 7_700_000,
                          weekSpent: Int64 = 4_250_000, perDay: Int64 = 862_500, deficit: Int64 = 1_400_000,
                          monthRemaining: Int64 = 9_500_000) -> PenzAllowance {
        PenzAllowance(
            date: date,
            month: .init(month: String(date.prefix(7)), free: .huf(31_400_000), spent: .huf(21_900_000),
                         remaining: .huf(monthRemaining)),
            week: .init(start: "2026-11-16", end: "2026-11-22", budget: .huf(weekBudget), spent: .huf(weekSpent),
                        remaining: .huf(weekRemaining), perDay: .huf(perDay)),
            lines: [("recurringIncome", 95_000_000), ("oneOffIncome", 3_000_000), ("fixedCosts", 41_200_000),
                    ("savingsTarget", 20_000_000), ("practice", 2_000_000), ("invested", 2_000_000),
                    ("previousDeficit", deficit), ("free", 31_400_000), ("spent", 21_900_000), ("remaining", monthRemaining)]
                .map { PenzAllowanceLine(key: $0.0, amount: .huf($0.1)) })
    }

    static let food = PenzCategory(id: "c-food", name: "Élelmiszer", position: 0)
    static let eat = PenzCategory(id: "c-eat", name: "Éttermek", position: 1)
    static let move = PenzCategory(id: "c-move", name: "Közlekedés", position: 2)
    static let sport = PenzCategory(id: "c-sport", name: "Sport", position: 3)
    static let fun = PenzCategory(id: "c-fun", name: "Szórakozás", position: 4)
    static let home = PenzCategory(id: "c-home", name: "Lakás", position: 5)
    static let salary = PenzCategory(id: "c-pay", name: "Fizetés", kind: "income", position: 0)
    static let categories = [food, eat, move, sport, fun, home, salary]
    static let cash = PenzAccount(id: "a-cash", name: "Készpénz", type: "cash")
    static let bank = PenzAccount(id: "a-bank", name: "Folyószámla", type: "checking", isDefault: true)

    static func tx(_ id: String, _ ft: Int64, _ cat: String?, date: String = "2026-11-19", kind: String = "expense",
                   source: String = "manual", account: String = "a-bank", review: Bool = false, rule: String? = nil,
                   note: String? = nil, ref: String? = nil) -> PenzTransaction {
        PenzTransaction(id: id, accountId: account, kind: kind, amount: .huf(ft * 100), categoryId: cat, date: date, note: note,
                        source: source, needsReview: review, recurringRuleId: rule, clientRef: ref)
    }
}

@Suite("Pénz — the pure builders")
struct PenzLogicTests {
    typealias F = PenzFixtures

    // MARK: money as text

    @Test func formatsWholeForintsWithANarrowNoBreakSpaceAndTheTrueMinus() {
        #expect(penzFt(3_450_000) == "34\u{202F}500")
        #expect(penzFt(98_000_000) == "980\u{202F}000")
        #expect(penzFt(123_456_789_00) == "123\u{202F}456\u{202F}789")
        #expect(penzFt(99_900) == "999")
        #expect(penzFt(0) == "0")
        #expect(penzFt(-320_000) == "\u{2212}3\u{202F}200")
        #expect(penzFt(-320_000).contains("-") == false, "a hyphen is never the minus")
    }

    @Test func roundsHalfAwayFromZero() {
        #expect(penzWhole(150) == 2)
        #expect(penzWhole(149) == 1)
        #expect(penzWhole(-150) == -2)
        #expect(penzFt(862_550) == "8\u{202F}626")
    }

    @Test func signedRowsAndUnits() {
        #expect(penzFtSigned(98_000_000, sign: .plus) == "+\u{00A0}980\u{202F}000")
        #expect(penzFtSigned(41_200_000, sign: .minus) == "\u{2212}\u{00A0}412\u{202F}000")
        #expect(penzFtSigned(0, sign: .minus) == "0", "a zero line is not minus zero")
        #expect(penzFtUnit(3_450_000) == "34\u{202F}500\u{00A0}Ft")
    }

    @Test func parsesTypedForints() {
        #expect(penzParseFt("34 500") == 3_450_000)
        #expect(penzParseFt("1890") == 189_000)
        #expect(penzParseFt("") == nil)
        #expect(penzParseFt("0") == nil)
    }

    // MARK: dates and words

    @Test func countsDaysAndMonths() {
        #expect(penzDaysInclusive(from: "2026-11-19", to: "2026-11-22") == 4)
        #expect(penzDaysInclusive(from: "2026-11-16", to: "2026-11-22") == 7)
        #expect(penzDaysInclusive(from: "2026-12-30", to: "2027-01-02") == 4)
        #expect(penzDaysLeftInMonth("2026-11-20") == 11)
        #expect(penzDaysLeftInMonth("2028-02-01") == 29)
        #expect(penzPreviousMonth("2026-01") == "2025-12")
        #expect(penzMonthWord("2026-10", .inessive) == "októberben")
        #expect(penzMonthWord("2027-06-15", .sublative) == "júniusra")
        #expect(penzMonthWord("2026-10", .accusative) == "októbert")
        #expect(penzDayTitle("2026-11-19") == "November 19.")
        #expect(penzArticle("októberi") == "Az" && penzArticle("novemberi") == "A")
    }

    // MARK: the derivation

    @Test func derivationGroupsTheTenLinesIntoSixRowsInTheSpikesOrder() {
        let rows = penzDerivation(F.allowance(), previousMonthOpen: false)
        #expect(rows.map(\.title) == ["Ami bejön", "Fix kiadások", "Amit félreteszel", "Gyakorlás", "Az előző hónap hiánya",
                                      "Ami szabadon marad"])
        #expect(rows[0].amount == 98_000_000, "recurring + one-off income")
        #expect(rows[2].amount == 22_000_000, "savings target + invested")
        #expect(rows[3].amount == 2_000_000)
        #expect(rows[4].amount == 1_400_000 && rows[4].sub == "Októberben 14\u{202F}000\u{00A0}Ft-tal csúsztál el")
        #expect(rows[5].amount == 31_400_000 && rows[5].sign == .none)
    }

    @Test func theDeficitRowIsAlwaysThereAndSaysWhyItIsZero() {
        let none = penzDerivation(F.allowance(deficit: 0), previousMonthOpen: false)
        #expect(none.count == 6)
        #expect(none[4].amount == 0 && none[4].sub.contains("nem csúsztál el"))
        let open = penzDerivation(F.allowance(deficit: 0), previousMonthOpen: true)
        #expect(open[4].sub == "Az októberi hónap még nincs lezárva, ezért ez most 0")
    }

    // MARK: the week and the orb

    @Test func weekFiguresAndTheOrbLevel() {
        let w = penzWeek(F.allowance())
        #expect(w.daysLeft == 4 && w.daysInWeek == 7)
        #expect(abs(w.level - 3_450_000.0 / 7_700_000.0) < 0.0001)
        #expect(abs(w.marker - 4.0 / 7.0) < 0.0001)
        #expect(penzWeek(F.allowance(weekRemaining: -320_000)).level == 0, "an overspent week is empty, never negative")
        #expect(penzWeek(F.allowance(weekRemaining: 100, weekBudget: 0)).level == 0, "no budget is empty, never full")
        #expect(penzLevel(10, of: 5) == 1)
        #expect(penzWeekNote(w) == "Napi *8\u{202F}625\u{00A0}Ft*. A hét eddigi költése 42\u{202F}500\u{00A0}Ft volt.")
        #expect(penzDaysLeftText(4) == "4 nap van hátra" && penzDaysLeftText(1) == "Ma van az utolsó nap")
    }

    @Test func headSaysTheWeekInOneLine() {
        #expect(penzHead(F.allowance()).headline == "Ezen a héten még 34\u{202F}500\u{00A0}Ft-od van")
        let over = penzHead(F.allowance(weekRemaining: -320_000))
        #expect(over.headline == "Ezen a héten 3\u{202F}200\u{00A0}Ft-tal túl vagy a kereten")
        #expect(!over.headline.contains("\u{2212}"), "the overspend is said in words, not as a negative figure")
    }

    @Test func paceIsTheMonthsSpendPerDaySoFar() {
        let a = F.allowance()   // 219 000 Ft spent by the 19th
        #expect(penzPace(a) == 21_900_000 / 19)
        #expect(penzPaceTrend(a) == -1, "11 526 Ft/day × 30 is over the 314 000 free")
        var calm = a; calm.month.spent = .huf(5_000_000)
        #expect(penzPaceTrend(calm) == 0, "a good tempo carries no arrow")
    }

    // MARK: cash not yet on the server

    @Test func pendingCashLowersTheWeekAndTheMonthAndRecomputesPerDay() {
        let p = PenzPendingExpense(id: UUID(), payload: PenzExpensePayload(accountId: "a-cash", amountMinor: 189_000,
                                                                          date: "2026-11-19"))
        let old = PenzPendingExpense(id: UUID(), payload: PenzExpensePayload(accountId: "a-cash", amountMinor: 50_000,
                                                                            date: "2026-11-10"))
        let a = penzPendingAdjusted(F.allowance(), unsent: [p, old])
        #expect(a.week.remaining.hufMinor == 3_450_000 - 189_000, "only the cash dated inside the week")
        #expect(a.week.spent.hufMinor == 4_250_000 + 189_000)
        #expect(a.month.remaining.hufMinor == 9_500_000 - 189_000 - 50_000)
        #expect(a.week.perDay.hufMinor == (3_450_000 - 189_000) / 4)
        #expect(penzPendingAdjusted(F.allowance(), unsent: []) == F.allowance())
    }

    @Test func aDeliveredOrRefusedItemDoesNotCountTwice() {
        let id = UUID()
        let p = PenzPendingExpense(id: id, payload: PenzExpensePayload(accountId: "a-cash", amountMinor: 100, date: "2026-11-19"))
        let refused = PenzPendingExpense(id: UUID(), payload: p.payload, refused: true)
        let landed = F.tx("t1", 1, nil, ref: id.uuidString.lowercased())
        #expect(penzUnsent([p, refused], transactions: []) == [p])
        #expect(penzUnsent([p], transactions: [landed]).isEmpty)
    }

    // MARK: where it goes

    @Test func breakdownIsDayToDaySpendTopFourPlusTheRest() {
        let txs = [F.tx("1", 96_400, "c-food"), F.tx("2", 48_000, "c-eat"), F.tx("3", 31_200, "c-move"),
                   F.tx("4", 24_000, "c-sport"), F.tx("5", 12_000, "c-fun"), F.tx("6", 7_400, nil),
                   F.tx("7", 180_000, "c-home", rule: "r-rent"), F.tx("8", 980_000, "c-pay", kind: "income"),
                   F.tx("9", 50_000, nil, kind: "transfer_out")]
        let s = penzBreakdown(txs, categories: F.categories)
        #expect(s.map(\.name) == ["Élelmiszer", "Éttermek", "Közlekedés", "Sport", "Minden más"])
        #expect(s.last?.amount == 1_940_000, "the fifth category and the uncategorised row")
        #expect(!s.contains { $0.name == "Lakás" }, "a rule-linked fixed cost is not day-to-day spend")
        #expect(penzBreakdownNote(s) == "A változó költésed *66%-a* élelmiszer és éttermek.")
        #expect(penzBreakdown([], categories: F.categories).isEmpty && penzBreakdownNote([]) == nil)
    }

    // MARK: today's items

    @Test func todaysItemsShowSourceAndPendingCashFirst() {
        let pending = PenzPendingExpense(id: UUID(), payload: PenzExpensePayload(
            accountId: "a-cash", amountMinor: 189_000, categoryId: "c-eat", date: "2026-11-19", note: "Kávézó"))
        let items = penzItems([F.tx("s", 8_240, "c-food", source: "sms", note: "Spar"),
                               F.tx("c", 1_200, "c-eat", account: "a-cash"),
                               F.tx("x", 50_000, nil, kind: "transfer_out")],
                              pending: [pending], categories: F.categories, accounts: [F.cash, F.bank])
        #expect(items.map(\.title) == ["Kávézó", "Spar", "Éttermek"])
        #expect(items[0].pending && items[0].sub == "Éttermek · készpénz, kézzel · küldésre vár")
        #expect(items[1].sub == "Élelmiszer · banki üzenetből" && items[1].value == "8\u{202F}240")
        #expect(items[1].glyph == "bowl-cream")
        #expect(items[2].sub == "Éttermek · készpénz, kézzel")
    }

    @Test func reviewRowsAndDays() {
        let txs = [F.tx("a", 1, nil, review: true), F.tx("b", 2, nil), F.tx("c", 3, nil, date: "2026-11-18", review: true)]
        #expect(penzNeedsReview(txs).map(\.id) == ["a", "c"])
        #expect(penzByDay(txs).map(\.day) == ["2026-11-19", "2026-11-18"])
    }

    // MARK: Ma's verdict

    @Test func verdictRuleReviewThenOpenMonthThenCalm() {
        let open = [PenzMonthClose(month: "2026-10", closed: false), PenzMonthClose(month: "2026-09", closed: false)]
        #expect(penzVerdict(reviewCount: 2, openMonths: open) == .review(count: 2))
        #expect(penzVerdict(reviewCount: 0, openMonths: open) == .close(month: "2026-09"), "the oldest open month first")
        #expect(penzVerdict(reviewCount: 0, openMonths: []) == .calm)
    }

    @Test func verdictCopyNeverUrgesAndBuildsTheCalmLineFromRealNumbers() {
        let calm = penzVerdictCopy(.calm, allowance: F.allowance())
        #expect(calm.text == "Ma nincs dolgod a pénzeddel")
        #expect(calm.sub.contains("*34\u{202F}500\u{00A0}Ft*") && calm.sub.contains("95\u{202F}000\u{00A0}Ft"))
        #expect(penzVerdictCopy(.close(month: "2026-10"), allowance: nil).text == "Lezárhatod az októbert")
        #expect(penzVerdictCopy(.review(count: 2), allowance: nil).text == "2 banki üzenetet nézz át")
        for v in [PenzVerdict.calm, .close(month: "2026-10"), .review(count: 1)] {
            let c = penzVerdictCopy(v, allowance: F.allowance())
            for banned in ["most kell", "sürgős", "add el", "eladni", "hozam"] {
                #expect(!(c.text + c.sub).lowercased().contains(banned), "\(banned) in \(v)")
            }
        }
    }

    // MARK: goals

    @Test func goalSubSaysTheDueMonthAndHowFarItIs() {
        let trip = PenzGoal(id: "g", name: "Nyári út", target: .huf(60_000_000), saved: .huf(32_000_000), dueDate: "2027-06-15")
        #expect(penzGoalSub(trip, today: "2026-11-19") == "Júniusra kell · még 7 hónap")
        var now = trip; now.dueDate = "2026-11-30"
        #expect(penzGoalSub(now, today: "2026-11-19") == "Ebben a hónapban esedékes")
        var far = trip; far.dueDate = "2028-06-01"
        #expect(penzGoalSub(far, today: "2026-11-19") == "Határidő: 2028. június · még 19 hónap")
        let reserve = PenzGoal(id: "r", name: "Tartalék", target: .huf(10), saved: .huf(10))
        #expect(penzGoalSub(reserve, today: "2026-11-19") == "Összejött")
        let shoe = PenzGoal(id: "s", name: "Futócipő", kind: "purchase", target: .huf(10))
        #expect(penzGoalSub(shoe, today: "2026-11-19") == "Vásárlási terv · nincs határidő")
    }

    // MARK: where cash goes

    @Test func cashGoesToTheCashAccountElseTheDefault() {
        #expect(penzCashAccount([F.bank, F.cash])?.id == "a-cash")
        #expect(penzCashAccount([F.bank])?.id == "a-bank")
        #expect(penzCashAccount([PenzAccount(id: "e", name: "EUR", type: "cash", currency: "EUR")]) == nil,
                "a row's currency is its account's; cash in forint never goes to a euro account")
        #expect(penzExpenseCategories(F.categories).map(\.id).first == "c-food")
        #expect(!penzExpenseCategories(F.categories).contains { $0.kind == "income" })
    }

    @Test func ageTextIsQuietWhenFresh() {
        #expect(penzAgeText(60) == nil)
        #expect(penzAgeText(3 * 3600) == "3 órás adat")
        #expect(penzAgeText(50 * 3600) == "2 napos adat")
    }
}
