import Foundation

// The Átrendezés card on the Ma wall (B7 K3, `mezo-r36n9.17`, Task 20; spike KapMaPreview's NKHighlight). Pure: handed
// the current week the Kapacitás store already holds, it returns at most one candidate — the wall engine chooses. No
// second card surface and no notification policy of its own: only a today-proposal whose session is under three
// hours away is `.expires`, so only it may ring, inside the wall's own two-a-day cap (decision #35).

/// Candidate ids: the week card (keyed by the set of open proposals, so a proposal that arrives after he settled the
/// card — the live loop's today-change — brings it back), and the urgent today card (keyed by its proposal).
public enum KapacitasWallID {
    public static let week = "kapacitas-het-"
    public static let today = "kapacitas-ma-"
    /// „Most nem": the card leaves the wall for the day, nothing opens.
    public static let notNow = "Most nem"

    /// `kapacitas-het-<FNV-1a of the sorted open ids>` — stable across launches (the wall's „acted" set is stored).
    static func week(_ open: [KapacitasProposal]) -> String {
        var h: UInt32 = 2_166_136_261
        for b in open.map(\.id).sorted().joined(separator: ",").utf8 { h = (h ^ UInt32(b)) &* 16_777_619 }
        return week + String(h, radix: 16)
    }
}

/// The Kapacitás source's candidate:
///   • `.improves`, rank 0.85 — at least one open proposal in the wall's week (`kapacitasWallMonday`: next week from Sunday 18:00). It beats the season's correction (0.8)
///     and the food tip (0.7), not a session within two hours (0.9). Text: the top proposal's day verdict and the open
///     proposals counted in words („A csütörtök *túl sok* lenne. Négy dolgot tennék át a héten."); sub: the moves in
///     brief.
///   • `.expires` instead — an open proposal about today while today's session starts in under three hours;
///     `expiresAt` is the session start, after which the change no longer helps.
/// Every word and verdict comes from the server's week; nothing is computed here. `excluding` are proposals the phone
/// has already accepted offline (queued); `todaySessionStart` is today's planned session from the brief.
public func kapacitasWallCandidates(week: KapacitasWeek?, now: Date, todaySessionStart: Date? = nil,
                                    excluding: Set<String> = [], timeZone: TimeZone = .current) -> [WallCandidate] {
    guard let week, week.monday == kapacitasWallMonday(now, timeZone: timeZone) else { return [] }
    let open = week.proposals.filter { $0.status == "open" && !excluding.contains($0.id) }
    guard let top = open.first else { return [] }
    let today = kapacitasYMD(now, timeZone: timeZone)
    let why = top.why.first ?? "Van egy nap a héten, ami több lenne, mint amennyit bírsz."

    if let start = todaySessionStart, start > now, start.timeIntervalSince(now) < 3 * 3600,
       let p = open.first(where: { $0.day == today }) {
        return [WallCandidate(
            id: KapacitasWallID.today + p.id, role: .expires, kind: .teendo, area: WallSources.kapacitas,
            expiresAt: start,
            text: [verdictSentence(week, day: today, today: today), "Az edzés előtt még átrendezném."]
                .compactMap { $0 }.joined(separator: " "),
            sub: p.title,
            primary: "Megnézem", secondary: KapacitasWallID.notNow,
            settled: "Átrendezés megnézve",
            why: p.why.first ?? why)]
    }

    let count = "\(kapacitasCountWord(open.count)) dolgot tennék át a héten."
    let lead = verdictSentence(week, day: top.day, today: today)
        ?? kapacitasHardestDay(week).flatMap { verdictSentence(week, day: week.days[$0].date, today: today) }
    return [WallCandidate(
        id: KapacitasWallID.week(open), role: .improves, kind: .teendo, area: WallSources.kapacitas, rank: 0.85,
        text: [lead, count].compactMap { $0 }.joined(separator: " "),
        sub: kapacitasMovesInBrief(open),
        primary: "Megnézem", secondary: KapacitasWallID.notNow,
        settled: "Átrendezés megnézve",
        why: why)]
}

/// „A csütörtök *túl sok* lenne." — only for a szoros / túl sok day; today is „A mai nap".
private func verdictSentence(_ week: KapacitasWeek, day: String?, today: String) -> String? {
    guard let day, let d = week.days.first(where: { $0.date == day }) else { return nil }
    let word: String
    switch d.verdict {
    case "tulSok", "szoros": word = d.label
    default: return nil
    }
    let subject = day == today ? "A mai nap" : kapacitasWeekdayName(day).map { "A \($0)" }
    return subject.map { "\($0) *\(word)* lenne." }
}

/// „Edzés szombatra, később fekvés szerdán és nagyobb ebéd csütörtökön." — one short phrase per open proposal.
func kapacitasMovesInBrief(_ open: [KapacitasProposal]) -> String {
    let parts = open.map(movePhrase)
    guard let first = parts.first else { return "" }
    let joined = parts.count == 1 ? first : parts.dropLast().joined(separator: ", ") + " és " + parts.last!
    return joined.prefix(1).uppercased() + joined.dropFirst() + "."
}

private let weekdaySublative = ["hétfőre", "keddre", "szerdára", "csütörtökre", "péntekre", "szombatra", "vasárnapra"]

private func movePhrase(_ p: KapacitasProposal) -> String {
    let step = p.steps.first { $0.kind == p.kind }?.payload ?? p.steps.first?.payload
    func on(_ ymd: String?) -> String { kapacitasWeekdayOn(ymd ?? p.day).map { " \($0)" } ?? "" }
    switch p.kind {
    case "MOVE_SESSION_DAY":
        let to = step?.toDate.flatMap(kapacitasWeekdayIndex).map { weekdaySublative[$0] }
        return to.map { "edzés \($0)" } ?? "edzés másik napra"
    case "SHIFT_BEDTIME": return "később fekvés" + on(step?.night)
    case "SHIFT_SESSION_TIME": return "új edzésidő" + on(step?.date)
    case "SHORTEN_SESSION": return "rövidebb edzés" + on(step?.date)
    case "SKIP_SESSION": return "pihenőnap" + on(step?.date)
    case "MOVE_MEAL_ENERGY": return "nagyobb ebéd" + on(step?.date)
    case "CALENDAR_TODO": return "egy esemény korábbra" + on(step?.date)
    default: return kapacitasKind(p).word + on(nil)
    }
}

/// „2026-11-26" of a moment in the given zone, always Gregorian.
private func kapacitasYMD(_ date: Date, timeZone: TimeZone) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}
