import Foundation

// The season's things to say on the living wall (B6 Évad S2, `mezo-r36n9.16`, spec §5.11). Pure: handed the
// overview the Évad store already holds, it returns candidates — the wall engine chooses. No second card surface and
// no second notification policy: nothing here is `.expires`, so nothing here may ring (decision #35). S3 adds the
// weekly menu, S4 the experiments.

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

    if let i = o.insights.first(where: { $0.key == "learned_expenditure" }) {
        out.append(WallCandidate(
            id: EvadWallID.learned + o.season.id, role: .improves, kind: .teendo, area: WallSources.evad, rank: 0.8,
            text: "*\(i.title)*",
            sub: "Megmutatom, mi változna, mielőtt bármi változik.",
            primary: "Átnézem",
            settled: "Évad-javaslat átnézve",
            why: i.body))
    }

    if let left = evadDaysLeft(o.season.endDate, now: now, calendar: calendar), (0...7).contains(left) {
        let end = o.upcoming.first { $0.kind == "end" }?.text
        out.append(WallCandidate(
            id: EvadWallID.end + o.season.id, role: .happened, kind: .tortent, area: WallSources.evad,
            happenedAt: calendar.startOfDay(for: now),
            text: left == 0 ? "*Ma* véget ér az évad" : "*\(left) nap múlva* véget ér az évad",
            sub: evadEyebrow(o.head),
            primary: "Megnézem",
            settled: "Évad vége megnézve",
            // "dec. 27." already ends the sentence
            why: "Az évad utolsó napja: \(evadShortDate(o.season.endDate))" + (end.map { " Utána \($0)." } ?? "")))
    }
    return out
}

/// Where a tap on an Évad card lands: `modositas` for the correction proposal, nil for the Évad page itself.
public func evadWallOpens(_ id: String) -> String? {
    id.hasPrefix(EvadWallID.learned) ? "modositas" : nil
}

/// Calendar days from `now`'s day to `yyyy-MM-dd` (0 = today, negative = past); nil when the date does not read.
func evadDaysLeft(_ iso: String, now: Date, calendar: Calendar) -> Int? {
    let p = iso.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3, let end = calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) else { return nil }
    return calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: end)).day
}
