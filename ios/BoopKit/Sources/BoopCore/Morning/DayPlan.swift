import Foundation

/// "3 240" with a non-breaking space between thousands.
public func grouped(_ n: Int) -> String {
    let s = String(abs(n))
    var out = ""
    for (i, ch) in s.enumerated() {
        if i > 0 && (s.count - i) % 3 == 0 { out.append("\u{00A0}") }
        out.append(ch)
    }
    return n < 0 ? "-" + out : out
}

/// "-ra" or "-re" after a clock time, by how it is said aloud: "18:00" = "tizennyolc óra" (-ra), "18:30" = "harminc"
/// (-ra), "18:45" = "negyvenöt" (-re). The minutes' last spoken word decides; whole hours end on "óra".
public func timeSuffix(_ hhmm: String) -> String {
    let parts = hhmm.split(separator: ":")
    guard parts.count == 2, let m = Int(parts[1]) else { return "ra" }
    if m == 0 { return "ra" }
    let unit = m % 10
    if unit != 0 {
        // egy, kettő, négy, öt, hét, kilenc → -re; három, hat, nyolc → -ra
        return [3, 6, 8].contains(unit) ? "ra" : "re"
    }
    // tíz, negyven, ötven → -re; húsz, harminc → -ra
    return [20, 30].contains(m) ? "ra" : "re"
}

/// A session whose time differs from the planned one has been moved (its conflict is settled).
public func sessionMoved(planned: String?, time: String?) -> Bool { planned != nil && time != nil && time != planned }

/// One line of the day's plan on the Ma screen.
public struct PlanRow: Sendable, Equatable, Identifiable {
    public let id: String
    public let time: String
    public let glyph: String
    public let title: String
    public let sub: String
}

/// One goal of the evening close-out. `met == nil` = not decidable yet.
public struct CloseGoal: Sendable, Equatable, Identifiable {
    public let id: String
    public let title: String
    public let result: String
    public let met: Bool?
}

public enum DayPlan {
    /// What is still ahead of the day, in clock order; parts the brief does not carry are simply absent.
    public static func rows(_ brief: Brief) -> [PlanRow] {
        let day = brief.day
        var rows: [PlanRow] = []

        if let c = day.checkins.first(where: { $0.slot == .morning }) {
            rows.append(PlanRow(id: "checkin-morning", time: c.time, glyph: "pen-sun", title: "Reggeli check-in",
                                sub: c.done ? (c.summary ?? "kész") : "fél perc"))
        }

        let unlogged = day.meals.enumerated().filter { !$0.element.logged }
        if !unlogged.isEmpty {
            let left = max(0, day.proteinTarget - day.proteinG)
            let each = (left + unlogged.count - 1) / unlogged.count
            for (i, m) in unlogged {
                rows.append(PlanRow(id: "meal-\(i)", time: m.time, glyph: "bowl-cream",
                                    title: "\(m.title) · legalább \(each) g fehérje",
                                    sub: "a mai keret \(grouped(day.kcalTarget)) kcal"))
            }
        }

        if let s = day.session {
            var sub = s.minutes.map { "\($0) perc" } ?? ""
            if sessionMoved(planned: s.plannedTime, time: s.time), let t = s.time {
                sub += (sub.isEmpty ? "" : " · ") + "áttéve \(t)-\(timeSuffix(t))"
            }
            rows.append(PlanRow(id: "session", time: s.time ?? s.plannedTime ?? "", glyph: "dumbbell-ink",
                                title: s.title, sub: sub))
        }

        if let c = day.checkins.first(where: { $0.slot == .evening }) {
            rows.append(PlanRow(id: "checkin-evening", time: c.time, glyph: "spark-cream", title: "Esti zárás", sub: "egy perc"))
        }

        // stable sort by clock; a row without a time keeps its place at the end of the day
        rows = rows.enumerated().sorted {
            let a = $0.element.time.isEmpty ? "99:99" : $0.element.time
            let b = $1.element.time.isEmpty ? "99:99" : $1.element.time
            return a == b ? $0.offset < $1.offset : a < b
        }.map(\.element)

        if let bed = day.bedtimeTarget {
            rows.append(PlanRow(id: "bedtime", time: bed, glyph: "moon-cream", title: "Lefekvés", sub: "7 és fél óra alvásért"))
        }
        return rows
    }

    /// The close-out's goals: protein, today's session, bedtime. The session is met once done, else undecided (nil: no missed marks); bedtime stays nil (B3).
    public static func goals(_ brief: Brief) -> [CloseGoal] {
        let day = brief.day
        var goals = [CloseGoal(id: "protein", title: "\(day.proteinTarget) g fehérje", result: "\(day.proteinG) g",
                               met: day.proteinG >= day.proteinTarget)]
        if let s = day.session {
            let t = s.time ?? s.plannedTime
            goals.append(CloseGoal(id: "session", title: t.map { "\(s.title) · \($0)" } ?? s.title,
                                   result: sessionResult(s), met: s.done ? true : nil))
        }
        if let bed = day.bedtimeTarget {
            goals.append(CloseGoal(id: "bedtime", title: "Lefekvés \(bed)", result: "", met: nil))
        }
        return goals
    }

    /// "90 perc · pulzus átl. 128" / "90 perc"; empty while the session is not done (or has no minutes).
    private static func sessionResult(_ s: Brief.Session) -> String {
        guard s.done, let minutes = s.doneMinutes else { return "" }
        guard let hr = s.avgHr else { return "\(minutes) perc" }
        return "\(minutes) perc · pulzus átl. \(hr)"
    }
}
