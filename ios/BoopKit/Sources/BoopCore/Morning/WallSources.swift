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

/// The strongest observation of the day, as something that happened. The brief already carries it; nothing is
/// re-derived here.
///
/// **Training is no longer here.** It had a thin stand-in (`edzes-keszulj`) while nothing spoke for the Edzés
/// area; `edzesWallCandidates` below replaced it in B5. Two sources must never both offer a session card: `acted`
/// is keyed by candidate id, so a duplicate would come back the render after he dismissed it.
public func briefWallCandidates(_ brief: Brief, now: Date, calendar: Calendar = .current) -> [WallCandidate] {
    var out: [WallCandidate] = []

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

// MARK: - Edzés

/// The training area's candidates (B5). All three roles, and each is a different thing to say:
///
///   • `.improves` — a session planned for later today. `rank` is the only thing that orders that slot, so it is
///     chosen deliberately: **0.9 within two hours** (by then it is the most movable thing in his day, ahead of
///     the food tip at 0.7), **0.5 further out** (still worth saying, but the tip beats it).
///   • `.expires` — the session is about to be missed: inside `grace` of its planned time and still not started.
///     This role may also **ring the phone** under the two-a-day cap (decision #35), which is exactly what a
///     session about to be lost deserves. `expiresAt` is the end of that window, so the wall drops the card by
///     itself once the moment has gone — nothing has to clear it.
///   • `.happened` — it is done. One line, no button.
///
/// `why` is filled here because the wall's own card shows it; the room never writes a second explanation.
public func edzesWallCandidates(_ brief: Brief, now: Date, calendar: Calendar = .current,
                                grace: TimeInterval = 90 * 60) -> [WallCandidate] {
    guard let s = brief.day.session else { return [] }
    let detail = [s.title, s.minutes.map { "\($0) perc" }].compactMap { $0 }.joined(separator: " · ")

    if s.done {
        return [WallCandidate(
            id: "edzes-megvolt", role: .happened, kind: .tortent, area: WallSources.edzes,
            happenedAt: brief.generatedAt,
            text: "*\(s.title)* megvolt",
            sub: [s.doneMinutes.map { "\($0) perc" }, s.avgHr.map { "\($0) bpm átlag" }]
                .compactMap { $0 }.joined(separator: " · "),
            settled: "Edzés megvolt",
            why: "A mai edzésed le van zárva — ez a nap legnagyobb terhelése, és már a hátad mögött van.")]
    }

    guard let time = (s.time ?? s.plannedTime).flatMap({ wallClock($0, on: now, calendar: calendar) })
    else {
        // A session with no time at all: worth saying, but nothing about it can expire.
        return [WallCandidate(
            id: "edzes-ma", role: .improves, kind: .keszulj, area: WallSources.edzes, rank: 0.5,
            text: "Ma *edzés* van", sub: detail, primary: "Megnézem", settled: "Edzés megnézve",
            why: "A mai terved szerint ez a nap legnagyobb terhelése; minden más köré rendeződik.")]
    }

    let deadline = time.addingTimeInterval(grace)
    if now >= time, now < deadline {
        let minutes = Int(deadline.timeIntervalSince(now) / 60)
        return [WallCandidate(
            id: "edzes-lekesed", role: .expires, kind: .teendo, area: WallSources.edzes,
            expiresAt: deadline,
            text: "*\(s.title)* ideje elkezdeni",
            sub: minutes <= 30 ? "Még \(minutes) perc, és ma kimarad." : "A tervezett időpontod már elmúlt.",
            primary: "Kezdjük el", secondary: "Ma kihagyom",
            settled: "Edzés elindítva",
            why: "Ez az egyetlen dolog a falon, ami magától elromlik: a mai edzésed időpontja elmúlt, és ha ma kimarad, a heti terhelésed átrendeződik körülötte.")]
    }
    guard time > now else { return [] }   // past the grace window: the day has moved on, not news any more

    let minutes = Int(time.timeIntervalSince(now) / 60)
    return [WallCandidate(
        id: "edzes-keszulj", role: .improves, kind: .keszulj, area: WallSources.edzes,
        rank: minutes <= 120 ? 0.9 : 0.5,
        text: minutes <= 120 ? "*\(minutes) perc múlva* edzés" : "Ma *\(s.time ?? s.plannedTime ?? "")* edzés",
        sub: detail, primary: "Megnézem", settled: "Edzés megnézve",
        why: "A mai terved szerint ez a nap legnagyobb terhelése; minden más köré rendeződik.")]
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
