import Foundation

/// The part of a day's close the Napló list needs (the server's, the web's, or one made on the phone and not sent yet).
public struct DayCloseLite: Equatable, Sendable {
    public let date: String
    /// 1–5; nil for a day closed on the web without a rating.
    public let dayRating: Int?
    public let eveningEnergy: Int?
    public let goalText: String?
    /// `done` / `partial` / `no`.
    public let goalOutcome: String?
    public let journalText: String?
    public let web: Bool
    /// Closed on the phone, still on its way.
    public let pending: Bool

    public init(date: String, dayRating: Int?, eveningEnergy: Int? = nil, goalText: String? = nil, goalOutcome: String? = nil,
                journalText: String? = nil, web: Bool = false, pending: Bool = false) {
        self.date = date; self.dayRating = dayRating; self.eveningEnergy = eveningEnergy; self.goalText = goalText
        self.goalOutcome = goalOutcome; self.journalText = journalText; self.web = web; self.pending = pending
    }
}

/// One day of the Napló list (spec §7.7).
public struct NaploDayRow: Equatable, Identifiable, Sendable {
    public let date: String
    /// "Nehéz" … "Remek"; nil without a rating (a web day, or a day with check-ins only).
    public let ratingWord: String?
    public let goalText: String?
    /// "Sikerült" / "Részben" / "Nem".
    public let goalOutcomeLabel: String?
    /// The owner's energy answers of the day, in capture order (the mini line).
    public let points: [CurvePoint]
    /// The first non-empty line of the journal.
    public let journalLine: String?
    /// Closed in the web app.
    public let web: Bool
    /// Something of the day is still on the phone (the close or a check-in).
    public let pending: Bool
    public var id: String { date }
}

/// What the Napló "Napok" list shows: the last days, newest first; a day with nothing is not a row (never "missed").
public enum NaploDays {
    /// How many days the list reaches back, today included.
    public static let span = 14
    public static let ratingWords = ["Nehéz", "Inkább nehéz", "Rendben", "Jó", "Remek"]
    public static let outcomeLabels: [String: String] = ["done": "Sikerült", "partial": "Részben", "no": "Nem"]

    public static func ratingWord(_ rating: Int?) -> String? {
        rating.flatMap { (1...5).contains($0) ? ratingWords[$0 - 1] : nil }
    }

    /// The rows of the days in `from…to` that have a close or a check-in with an answer.
    public static func rows(closes: [DayCloseLite], checkIns: [String: [LedgerCheckIn]], from: String, to: String) -> [NaploDayRow] {
        let closeByDate = Dictionary(closes.map { ($0.date, $0) }) { _, last in last }
        return days(from: from, to: to).reversed().compactMap { date in
            let close = closeByDate[date]
            let dayCheckIns = checkIns[date] ?? []
            let points = DayLedger(date: date, checkIns: dayCheckIns).curvePoints
            // A day is a row when it has a close or at least one energy answer; check-ins without one add nothing.
            guard close != nil || !points.isEmpty else { return nil }
            let line = close?.journalText?.split(whereSeparator: \.isNewline)
                .map { $0.trimmingCharacters(in: .whitespaces) }.first { !$0.isEmpty }
            return NaploDayRow(
                date: date, ratingWord: ratingWord(close?.dayRating), goalText: close?.goalText.flatMap { $0.isEmpty ? nil : $0 },
                goalOutcomeLabel: close?.goalOutcome.flatMap { outcomeLabels[$0] },
                points: points, journalLine: line, web: close?.web ?? false,
                pending: close?.pending == true || dayCheckIns.contains { $0.pending })
        }
    }

    /// The closes and check-ins of the ledger days, as `rows` reads them: a phone close finds its journal text in the
    /// day's journal; a day with nothing in it gives nothing.
    public static func sources(from ledgers: [DayLedger]) -> (closes: [DayCloseLite], checkIns: [String: [LedgerCheckIn]]) {
        var closes: [DayCloseLite] = []
        var checkIns: [String: [LedgerCheckIn]] = [:]
        for day in ledgers {
            if !day.checkIns.isEmpty { checkIns[day.date] = day.checkIns }
            guard let c = day.close else { continue }
            let text = c.journalText.flatMap { $0.isEmpty ? nil : $0 }
                ?? c.journalId.flatMap { id in day.journal.first { $0.id == id }?.text }
            closes.append(DayCloseLite(date: day.date, dayRating: c.dayRating, eveningEnergy: c.eveningEnergy, goalText: c.goalText,
                                       goalOutcome: c.goalOutcome, journalText: text, web: c.web == true, pending: c.pending))
        }
        return (closes, checkIns)
    }

    // MARK: - Dates (`yyyy-MM-dd`, Gregorian, no zone: pure calendar arithmetic)

    private static var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return c
    }

    private static func date(_ s: String) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12))
    }

    private static func string(_ d: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Every date from `from` to `to`, oldest first (empty for a bad or reversed range).
    public static func days(from: String, to: String) -> [String] {
        guard let start = date(from), let end = date(to), start <= end else { return [] }
        var out: [String] = []
        var d = start
        while d <= end {
            out.append(string(d))
            guard let next = calendar.date(byAdding: .day, value: 1, to: d) else { break }
            d = next
        }
        return out
    }

    /// The `count` days ending on `to`.
    public static func range(endingOn to: String, count: Int = span) -> (from: String, to: String) {
        guard let end = date(to), let start = calendar.date(byAdding: .day, value: -(count - 1), to: end) else { return (to, to) }
        return (string(start), to)
    }
}
