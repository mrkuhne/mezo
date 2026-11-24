import Foundation

/// One week of weigh-ins for the Napló tab, newest first.
public struct SulyWeek: Equatable, Sendable {
    public let label: String
    public let averageKg: Double?
    public let logs: [SulyLog]
    public init(label: String, averageKg: Double?, logs: [SulyLog]) { self.label = label; self.averageKg = averageKg; self.logs = logs }
}

/// The curve the Ma tab draws: the season's series + planned projection with its target, else the trend alone.
public struct SulyCurve: Equatable, Sendable {
    public let values: [Double]
    public let labels: [String]
    public let target: Double?
    public let now: Int
}

private let sulyMonths = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]
private let sulyWeekdays = ["Vasárnap", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat"]

/// `yyyy-MM-dd` at noon in the calendar's zone (noon, so a zone change never moves the day).
func sulyDate(_ ymd: String, calendar: Calendar) -> Date? {
    let p = ymd.split(separator: "-")
    guard p.count == 3, let y = Int(p[0]), let m = Int(p[1]), let d = Int(p[2]) else { return nil }
    return calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12))
}

/// The weigh-ins by week — this week first, then the weeks before it, at most `weeks` back; empty weeks are left out.
public func sulyWeeks(_ logs: [SulyLog], today: String, calendar: Calendar, weeks: Int = 12) -> [SulyWeek] {
    guard let todayDate = sulyDate(today, calendar: calendar),
          let thisWeek = calendar.dateInterval(of: .weekOfYear, for: todayDate)?.start else { return [] }
    var byIndex: [Int: [(Date, SulyLog)]] = [:]
    for log in logs {
        guard let d = sulyDate(log.date, calendar: calendar), let start = calendar.dateInterval(of: .weekOfYear, for: d)?.start else { continue }
        let index = Int((thisWeek.timeIntervalSince(start) / (7 * 86_400)).rounded())
        guard (0..<weeks).contains(index) else { continue }
        byIndex[index, default: []].append((d, log))
    }
    return byIndex.keys.sorted().map { index in
        let rows = byIndex[index]!.sorted { $0.0 > $1.0 }.map(\.1)
        let avg = rows.isEmpty ? nil : (rows.map(\.kg).reduce(0, +) / Double(rows.count) * 100).rounded() / 100
        let start = calendar.date(byAdding: .day, value: -7 * index, to: thisWeek)!
        let end = calendar.date(byAdding: .day, value: 6, to: start)!
        let label: String
        switch index {
        case 0: label = "EZ A HÉT"
        case 1: label = "MÚLT HÉT"
        default:
            let sm = calendar.component(.month, from: start), em = calendar.component(.month, from: end)
            let sd = calendar.component(.day, from: start), ed = calendar.component(.day, from: end)
            label = sm == em ? "\(sulyMonths[sm - 1]) \(sd)–\(ed)." : "\(sulyMonths[sm - 1]) \(sd)–\(sulyMonths[em - 1]) \(ed)."
            return SulyWeek(label: label.uppercased(), averageKg: avg, logs: rows)
        }
        return SulyWeek(label: label, averageKg: avg, logs: rows)
    }
}

/// The day's name for a weigh-in row ("Kedd"); the raw date when it cannot be read.
public func sulyLogTitle(_ log: SulyLog, calendar: Calendar) -> String {
    guard let d = sulyDate(log.date, calendar: calendar) else { return log.date }
    return sulyWeekdays[calendar.component(.weekday, from: d) - 1]
}

/// This week's weigh-ins, newest first.
public func sulyThisWeek(_ logs: [SulyLog], today: String, calendar: Calendar) -> [SulyLog] {
    sulyWeeks(logs, today: today, calendar: calendar, weeks: 1).first?.logs ?? []
}

/// Today's weigh-in, if he stepped on the scale.
public func sulyToday(_ logs: [SulyLog], today: String) -> SulyLog? {
    logs.last { $0.date == today }
}

/// The Ma tab's curve: the season's own series and projection with the target line; without a season the smoothed
/// trend's last eight weeks; nil when there are fewer than two points to draw.
public func sulyCurve(_ season: EvadOverview?, trend: SulyTrend?) -> SulyCurve? {
    if let season {
        let w = season.weight
        let values = (w.series + w.projection).map(\.kg)
        if values.count >= 2 {
            let now = max(0, w.series.count - 1)
            var labels = Array(repeating: "", count: values.count)
            labels[0] = "1."
            if now > 0 { labels[now] = "\(season.head.week)." }
            labels[values.count - 1] = "\(season.head.weeks)."
            return SulyCurve(values: values, labels: labels, target: w.targetKg, now: now)
        }
    }
    guard let trend, trend.ewmaSeries.count >= 2 else { return nil }
    let points = Array(trend.ewmaSeries.suffix(56))
    var labels = Array(repeating: "", count: points.count)
    labels[0] = sulyShortDate(points[0].date)
    labels[points.count - 1] = "ma"
    return SulyCurve(values: points.map(\.trendKg), labels: labels, target: nil, now: points.count - 1)
}

/// "nov. 10." from `2026-11-10`.
public func sulyShortDate(_ ymd: String) -> String {
    let p = ymd.split(separator: "-")
    guard p.count == 3, let m = Int(p[1]), let d = Int(p[2]), (1...12).contains(m) else { return ymd }
    return "\(sulyMonths[m - 1]) \(d)."
}

/// Body-mass index to one decimal; nil without both numbers.
public func sulyBmi(kg: Double?, heightCm: Double?) -> Double? {
    guard let kg, let heightCm, heightCm > 0, kg > 0 else { return nil }
    let m = heightCm / 100
    return (kg / (m * m) * 10).rounded() / 10
}

/// The newest body sample no older than `maxAge` (30 days): a stale scale reading is not "now".
public func sulyLatest(_ samples: [SulyBodySample], now: Date, maxAge: TimeInterval = 30 * 86_400) -> Double? {
    guard let last = samples.max(by: { $0.date < $1.date }), now.timeIntervalSince(last.date) <= maxAge else { return nil }
    return last.value
}
