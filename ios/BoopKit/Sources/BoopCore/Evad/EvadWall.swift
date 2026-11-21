import Foundation

// The season's things to say on the living wall (B6 Évad S2, `mezo-r36n9.16`, spec §5.11). Pure: handed the
// overview the Évad store already holds, it returns candidates — the wall engine chooses. No second card surface and
// no second notification policy: only the weekly menu waiting for approval (S3) is `.expires`, so only it may ring,
// within the wall's own cap (decision #35). S4 adds the experiments.

/// Candidate ids, so the wall's tap can tell where each one opens (`evadWallOpens`).
enum EvadWallID {
    static let learned = "evad-learned-"
    static let end = "evad-end-"
}

/// The Évad source's candidates:
///   • `.improves` — the learned-expenditure correction as a proposal („Átnézem" opens Évad → Módosítás), only when
///     the overview carries that insight (its own gate is the server's). Rank 0.8: it is rare (at most weekly) and
///     moves every day of the week, so it beats the food tip (0.7) but not a session within two hours (0.9).
///   • `.happened` — the season ends within seven days (today included).
/// Every card's „miért?" is the overview's own words. No season (nil overview), no candidates.
public func evadCandidates(_ o: EvadOverview?, now: Date, calendar: Calendar = .current) -> [WallCandidate] {
    guard let o else { return [] }
    var out: [WallCandidate] = []
    if let menu = evadMenuCandidate(o, now: now, calendar: calendar) { out.append(menu) }

    if let i = o.insights.first(where: { $0.key == "learned_expenditure" }) {
        out.append(WallCandidate(
            // one card per season per ISO week: a dismissal holds for the week (the wall forgets "acted" daily)
            id: EvadWallID.learned + o.season.id + "-" + evadISOWeek(now, calendar: calendar), role: .improves, kind: .teendo, area: WallSources.evad, rank: 0.8,
            text: "*\(i.title)*",
            sub: "Megmutatom, mi változna, mielőtt bármi változik.",
            primary: "Átnézem",
            settled: "Évad-javaslat átnézve",
            why: i.body))
    }

    if let left = evadDaysLeft(o.season.endDate, now: now, calendar: calendar), (0...7).contains(left) {
        out.append(WallCandidate(
            id: EvadWallID.end + o.season.id, role: .happened, kind: .tortent, area: WallSources.evad,
            happenedAt: calendar.startOfDay(for: now),
            text: left == 0 ? "*Ma* véget ér az évad" : "*\(left) nap múlva* véget ér az évad",
            sub: evadEyebrow(o.head),
            primary: "Megnézem",
            settled: "Évad vége megnézve",
            // "dec. 27." already ends the sentence; the season-end line itself would only repeat the card
            why: "Az évad utolsó napja: \(evadShortDate(o.season.endDate))"))
    }
    return out
}

/// Where a tap on an Évad card lands: `modositas` for the correction proposal, `menu` (the Menü tab) for the weekly
/// menu, nil for the Évad page itself.
public func evadWallOpens(_ id: String) -> String? {
    if id.hasPrefix(EvadWallID.learned) { return "modositas" }
    if id.hasPrefix(EvadWallID.menu) { return "menu" }
    return nil
}

/// "2026-W47": the ISO week `now` falls in, in the phone's time zone.
func evadISOWeek(_ now: Date, calendar: Calendar) -> String {
    var iso = Calendar(identifier: .iso8601); iso.timeZone = calendar.timeZone
    let c = iso.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now)
    return String(format: "%04d-W%02d", c.yearForWeekOfYear ?? 0, c.weekOfYear ?? 0)
}

/// Calendar days from `now`'s day to `yyyy-MM-dd` (0 = today, negative = past); nil when the date does not read.
func evadDaysLeft(_ iso: String, now: Date, calendar: Calendar) -> Int? {
    let p = iso.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3, let end = calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return nil }
    return calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: end)).day
}
