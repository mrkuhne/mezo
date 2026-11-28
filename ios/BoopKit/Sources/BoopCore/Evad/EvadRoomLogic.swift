import Foundation

// The Évad room's pure builders (`mezo-r36n9.196` step 2): the Most tab's day dots, bars and sentence, the Terv tab's
// season weeks and its bracket on the year strip, and where an Évad wall card lands in the room.

/// One day of the week as a dot on Most.
public enum EvadDayState: Equatable, Sendable { case inPlan, out, kimelo, unjudged, today, future }

/// One dot: the day, its short Hungarian letter and its state.
public struct EvadDayDot: Equatable, Sendable {
    public let date: String
    public let letter: String
    public let state: EvadDayState
}

/// Short day names, Monday first.
public let evadDayLetters = ["H", "K", "Sze", "Cs", "P", "Szo", "V"]
/// Full day names for VoiceOver, Monday first.
public let evadDayNames = ["hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat", "vasárnap"]

/// Seven dots H–V for the week of `monday`: date == today → .today, after it → .future, excused → .kimelo, judged and
/// nothing slipped (food not out of band, a planned session done, sleep not short) → .inPlan, judged otherwise → .out,
/// not judged (nothing logged) → .unjudged. A day missing from `days` reads as unjudged.
public func evadDayDots(monday: String, days: [EvadAdherenceDay], today: String) -> [EvadDayDot] {
    (0..<7).map { i in
        let date = evadAddDays(monday, i)
        let state: EvadDayState
        if date == today { state = .today }
        else if date > today { state = .future }
        else if let d = days.first(where: { $0.date == date }) {
            if d.excused { state = .kimelo }
            else if !d.judged { state = .unjudged }
            else {
                let food = d.foodInBand != false
                let session = d.sessionPlanned ? d.sessionDone == true : true
                let sleep = d.sleepOk != false
                state = food && session && sleep ? .inPlan : .out
            }
        } else { state = .unjudged }
        return EvadDayDot(date: date, letter: evadDayLetters[i], state: state)
    }
}

/// The dots read aloud: "hétfő tervben, kedd kicsúszott, …".
public func evadDayDotsSpoken(_ dots: [EvadDayDot]) -> String {
    let words: [EvadDayState: String] = [.inPlan: "tartottad", .out: "kicsúszott", .kimelo: "kímélő nap",
                                         .unjudged: "nincs adat", .today: "ma", .future: "még jön"]
    return dots.enumerated().map { "\(evadDayNames[$0.offset]) \(words[$0.element.state] ?? "")" }.joined(separator: ", ")
}

/// One bar on Most: `key` etel · edzes · alvas.
public struct EvadMostBar: Equatable, Sendable {
    public let key: String
    public let name: String
    public let done: Int
    public let of: Int
    public let label: String
}

/// Étel „nap a kereten belül", Edzés „alkalom megvolt", Alvás „éjszaka elég" (the spike's words); a part with nothing
/// to judge (`of == 0`) is left out.
public func evadMostBars(_ a: EvadAdherence) -> [EvadMostBar] {
    [EvadMostBar(key: "etel", name: "Étel", done: a.foodInBand, of: a.foodJudged, label: "nap a kereten belül"),
     EvadMostBar(key: "edzes", name: "Edzés", done: a.sessionsDone, of: a.sessionsPlanned, label: "alkalom megvolt"),
     EvadMostBar(key: "alvas", name: "Alvás", done: a.nightsOk, of: a.nightsJudged, label: "éjszaka elég")]
        .filter { $0.of > 0 }
}

/// The early sentence — nothing lived yet this week.
public let evadMostEarlySentence = "Még nincs mit nézni — a hét most kezdődött"

/// Most's headline: nil or nothing judged → the early sentence; every part ≥ 0.8 → „Jól megy a hét."; exactly one
/// part < 0.6 → „Jól megy a hét, csak az … csúszik."; two or more → „Ezen a héten több minden csúszik — nézd meg, mi.";
/// otherwise „Nagyjából tartod a hetet."
public func evadMostSentence(_ a: EvadAdherence?) -> String {
    guard let a, evadWeekScore(a) != nil else { return evadMostEarlySentence }
    let bars = evadMostBars(a)
    let ratio = { (b: EvadMostBar) in Double(b.done) / Double(b.of) }
    if bars.allSatisfy({ ratio($0) >= 0.8 }) { return "Jól megy a hét." }
    let lagging = bars.filter { ratio($0) < 0.6 }
    if lagging.count == 1 {
        let what = ["etel": "az étel", "edzes": "az edzés", "alvas": "az alvás"][lagging[0].key] ?? ""
        return "Jól megy a hét, csak \(what) csúszik."
    }
    if lagging.count >= 2 { return "Ezen a héten több minden csúszik — nézd meg, mi." }
    return "Nagyjából tartod a hetet."
}

/// One week cell on Terv › Az évad hetei.
public struct EvadWeekCell: Equatable, Sendable {
    public let week: Int
    public let lighter: Bool
    public let reason: String?
    public let current: Bool
    public let last: Bool
}

/// Weeks 1…head.weeks; an `upcoming` row of kind `deload` marks its week lighter (reason = its text); current = head.week.
public func evadSeasonWeeks(_ o: EvadOverview) -> [EvadWeekCell] {
    let n = max(0, o.head.weeks)
    guard n > 0 else { return [] }
    return (1...n).map { w in
        let deload = o.upcoming.first { $0.week == w && $0.kind == "deload" }
        return EvadWeekCell(week: w, lighter: deload != nil, reason: deload?.text, current: w == o.head.week, last: w == n)
    }
}

/// The season's span on the year strip as 1-based strip weeks (clamped to the strip); nil without a plan or when the
/// season and the year do not overlap.
public func evadSeasonBracket(plan: WireYearPlan?, seasonStart: String, seasonEnd: String) -> ClosedRange<Int>? {
    guard let plan, let a = evadDayDiff(plan.startDate, seasonStart), let b = evadDayDiff(plan.startDate, seasonEnd),
          b >= a else { return nil }
    let total = 52 + max(0, plan.overrunWeeks)
    let first = Int((Double(a) / 7).rounded(.down)) + 1
    let last = Int((Double(b) / 7).rounded(.down)) + 1
    guard last >= 1, first <= total else { return nil }
    return max(1, first)...min(total, last)
}

/// Days from `from` to `to` (both `yyyy-MM-dd`); nil when either does not read.
func evadDayDiff(_ from: String, _ to: String) -> Int? {
    var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
    func date(_ s: String) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }
        return p.count == 3 ? cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) : nil
    }
    guard let f = date(from), let t = date(to) else { return nil }
    return cal.dateComponents([.day], from: f, to: t).day
}

/// Where an Évad wall card lands.
public enum EvadWallTarget: Equatable, Sendable { case evad(tab: String, sub: String?), etelMenu, review }

/// learned → Terv + Módosítás; menu → Étel › Hét menu; proposal → Kísérlet; result → Kísérlet + its result;
/// season end → Terv; review → the Sunday review; any other id → nil.
public func evadWallTarget(_ id: String) -> EvadWallTarget? {
    if id.hasPrefix(EvadWallID.learned) { return .evad(tab: "Terv", sub: "modositas") }
    if id.hasPrefix(EvadWallID.menu) { return .etelMenu }
    if id.hasPrefix(EvadWallID.proposal) { return .evad(tab: "Kísérlet", sub: nil) }
    if id.hasPrefix(EvadWallID.result) { return .evad(tab: "Kísérlet", sub: "kiserlet:" + id.dropFirst(EvadWallID.result.count)) }
    if id.hasPrefix(EvadWallID.end) { return .evad(tab: "Terv", sub: nil) }
    if id.hasPrefix(EvadWallID.review) { return .review }
    return nil
}
