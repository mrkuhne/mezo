import Foundation

// What each area has to say on the living wall (L0/b). One pure function per area, each handed only its own
// state, so a source can be tested on its own and a new area can be added without touching the engine or the
// view — that is what `WallRegistry` is for.
//
// The roles are owner decision #34 and they are not interchangeable:
//   .expires  — what breaks if he doesn't do it now (a closing window, a group of supplements he still owes)
//   .improves — what moves today the most (the next meal's tip, today's session, Boop's proposals)
//   .happened — one thing that already happened and he should know (the last meal he logged)

public enum WallSources {
    public static let etel = "etel", edzes = "edzes", alvas = "alvas", energia = "energia", forma = "forma"
}

// MARK: - Étel

/// The food area's candidates: the window about to close, the tip for what is still to come, and the reaction to
/// the last meal he logged. `windowEnd` turns a plan window's "14:00" into a real moment on his day.
public func etelWallCandidates(plan: FuelPlan?, now: Date, calendar: Calendar = .current,
                               lastMeal: (name: String, protein: Int, at: Date, photo: String?)? = nil,
                               supplementsDue: (label: String, count: Int)? = nil) -> [WallCandidate] {
    var out: [WallCandidate] = []

    // 1. expires — the open window and when it shuts
    if let plan, let w = plan.windows.first(where: { $0.state == .now }),
       let end = wallClock(w.to, on: now, calendar: calendar), end > now {
        let minutes = Int(end.timeIntervalSince(now) / 60)
        out.append(WallCandidate(
            id: "etel-window-\(w.slot)", role: .expires, kind: .teendo, area: WallSources.etel,
            expiresAt: end,
            text: "\(hungarianArticle(w.label)) *\(w.label)* ablaka \(w.to)-kor zárul",
            sub: minutes <= 60 ? "Még \(minutes) perced van rögzíteni." : "Ha most eszel, pont belefér.",
            primary: "Rögzítem", secondary: "Kihagyom",
            settled: "\(w.label) rögzítve",
            why: "Ez az egyetlen dolog a falon, ami magától elromlik: \(w.to) után az ablak bezárul, és a nap többi része átrendeződik körülötte."))
    }

    // 2. expires — supplements he still owes for this part of the day
    if let s = supplementsDue, s.count > 0 {
        out.append(WallCandidate(
            id: "etel-supplements", role: .expires, kind: .teendo, area: WallSources.etel,
            expiresAt: wallEndOfDay(now, calendar: calendar),
            text: "*\(s.label)* · \(s.count) kiegészítő",
            sub: "Egy koppintás az egész csoport.",
            primary: "Bepipálom",
            settled: "\(s.label) bepipálva",
            why: "A napszakhoz kötött csoport még nincs kipipálva, és este már nem ér semmit."))
    }

    // 3. improves — what to eat next, from the server's own tip
    if let tip = plan?.tip {
        out.append(WallCandidate(
            id: "etel-tip", role: .improves, kind: .teendo, area: WallSources.etel, rank: 0.7,
            text: tip.text, sub: tip.reason,
            primary: "Megnézem",
            settled: "Étel-tipp megnézve",
            why: "A mai kereted alapján ez mozdítja a legtöbbet a napodon. \(tip.reason)"))
    }

    // 4. happened — the meal he just logged, and what it did
    if let m = lastMeal {
        out.append(WallCandidate(
            id: "etel-meal-\(Int(m.at.timeIntervalSince1970))", role: .happened, kind: .reakcio,
            area: WallSources.etel, happenedAt: m.at,
            text: "\(m.name): *\(m.protein) g fehérje*",
            sub: "Rögzítve \(wallTime(m.at, calendar: calendar))-kor.",
            big: "\(m.protein)", bigUnit: "g", photo: m.photo,
            settled: "\(m.name) · \(m.protein) g fehérje",
            why: "Nemrég rögzítetted, és a nap fehérjéjét ez mozdította utoljára."))
    }
    return out
}

// MARK: - The brief's own areas (Alvás · Energia · Forma) and the day

/// Today's session as something to prepare for, and the strongest observation as something that happened. The
/// brief already carries both; nothing is re-derived here.
public func briefWallCandidates(_ brief: Brief, now: Date, calendar: Calendar = .current) -> [WallCandidate] {
    var out: [WallCandidate] = []

    if let s = brief.day.session, !s.done,
       let time = (s.time ?? s.plannedTime).flatMap({ wallClock($0, on: now, calendar: calendar) }), time > now {
        let minutes = Int(time.timeIntervalSince(now) / 60)
        out.append(WallCandidate(
            id: "edzes-keszulj", role: .improves, kind: .keszulj, area: WallSources.edzes,
            rank: minutes <= 180 ? 0.85 : 0.4,
            text: minutes <= 120 ? "*\(minutes) perc múlva* edzés" : "Ma este edzés",
            sub: [s.title, s.minutes.map { "\($0) perc" }].compactMap { $0 }.joined(separator: " · "),
            primary: "Megnézem",
            settled: "Edzés megnézve",
            why: "A mai terved szerint ez a nap legnagyobb terhelése; minden más köré rendeződik."))
    }

    if let o = brief.day.observations.max(by: { $0.strength < $1.strength }) {
        let p = observationParts(o)
        out.append(WallCandidate(
            id: "megfigyeles-\(o.id)", role: .happened, kind: .tortent, area: WallSources.forma,
            happenedAt: brief.generatedAt,
            text: "\(p.lead)*\(o.bold)*\(p.tail)",
            sub: "", settled: "Megfigyelés elolvasva",
            why: "Ez a mai legerősebb összefüggés, amit a számaidban láttam."))
    }
    return out
}

// MARK: - Small helpers

/// The sentence around an observation's bold phrase, with exactly one space at each seam (none before closing
/// punctuation). Shared by the observation card and the wall, so the two never space it differently.
public func observationParts(_ o: Brief.Observation) -> (lead: String, tail: String) {
    let lead = o.lead.trimmingCharacters(in: .whitespaces)
    let tail = o.tail.trimmingCharacters(in: .whitespaces)
    let tight = tail.first.map { ".,;:!?".contains($0) } ?? true
    return (lead.isEmpty ? "" : lead + " ", tight ? tail : " " + tail)
}

/// "A" or "Az" before a Hungarian word — "Az ebéd ablaka", "A vacsora ablaka". Boop's own copy never reads as a
/// machine, and a wrong article is the first thing that gives one away.
public func hungarianArticle(_ word: String) -> String {
    guard let first = word.lowercased().first else { return "A" }
    return "aáeéiíoóöőuúüű".contains(first) ? "Az" : "A"
}

/// "14:00" on the day of `on`. nil when the string is not a clock time.
public func wallClock(_ hhmm: String, on: Date, calendar: Calendar = .current) -> Date? {
    let parts = hhmm.split(separator: ":")
    guard parts.count == 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
    return calendar.date(bySettingHour: h, minute: m, second: 0, of: on)
}

/// "13:40" from a moment.
public func wallTime(_ date: Date, calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.hour, .minute], from: date)
    return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
}

/// The end of the day the moment belongs to — what a thing with no clock of its own expires at.
public func wallEndOfDay(_ now: Date, calendar: Calendar = .current) -> Date {
    calendar.date(bySettingHour: 23, minute: 59, second: 0, of: now) ?? now.addingTimeInterval(3600)
}
