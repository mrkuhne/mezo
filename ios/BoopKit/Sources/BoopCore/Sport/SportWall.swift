import Foundation

// Boop Sport S6 (`mezo-r36n9.206`): what the Sport area has to say on the Ma wall — the one card surface (spec §5.7).
// Pure: handed the overview the store already holds (cache-first), it returns candidates; the wall engine chooses.
// Every figure is the server's own; a stale overview (another day) says nothing.
//
//   • BEFORE   — tonight's game later today: `.improves`, 0.9 within two hours (it is the most movable thing then),
//                0.5 further out — the same ranking the gym session uses, so neither shouts over the other.
//   • RECORDED — the Watch has the workout and there is no log yet: `.improves` 0.95, „egészítsd ki".
//   • DONE     — `.happened`, one line.
//   • SKIPPED  — `.happened`, with the reason he gave.
// Never a gym word: the gym's own card is `edzesWallCandidates`, and the two never tick each other.

public extension WallSources {
    static let sport = "sport"
}

public enum SportWallID {
    public static let before = "sport-ma", recorded = "sport-felvette", done = "sport-megvolt", skipped = "sport-kimarad"
}

public func sportWallCandidates(_ o: SportOverview?, now: Date, calendar: Calendar = .current) -> [WallCandidate] {
    guard let o, let t = o.tonight, o.today == sportDay(now, calendar: calendar) else { return [] }
    let kind = t.sportKind
    let name = kind.name

    switch t.moment {
    case "RECORDED":
        let h = t.health
        let sub = [h.map { "\($0.minutes) perc" }, h?.kcal.map { "\($0) kcal" }].compactMap { $0 }.joined(separator: " · ")
        return [WallCandidate(
            id: SportWallID.recorded, role: .improves, kind: .teendo, area: WallSources.sport, rank: 0.95,
            text: "Az órád felvette a *\(sportAccusative(kind))* — egészítsd ki",
            sub: sub.isEmpty ? "Két koppintás: mennyire volt nehéz." : sub + " · mennyire volt nehéz?",
            primary: "Kiegészítem", settled: "\(name) kiegészítve",
            why: "Az órád rögzítette, de azt, hogy mennyire volt nehéz, csak te tudod — enélkül a heti terhelésed fél adat.")]
    case "DONE":
        let s = t.session
        let sub = [s?.durationMin.map { "\($0) perc" }, s?.rpe.map { "nehézség \(Int($0.rounded()))" }]
            .compactMap { $0 }.joined(separator: " · ")
        return [WallCandidate(
            id: SportWallID.done, role: .happened, kind: .tortent, area: WallSources.sport,
            happenedAt: now, text: "*\(name)* megvolt", sub: sub,
            primary: "Megnézem", settled: "\(name) megvolt",
            why: "A mai sportod rögzítve — a heti terhelésedbe már beleszámít, az edzőtermi edzésedtől külön.")]
    case "SKIPPED":
        let reason = t.skip.flatMap { SportSkipReason(wire: $0.reason) }?.pastLabel
        return [WallCandidate(
            id: SportWallID.skipped, role: .happened, kind: .tortent, area: WallSources.sport,
            happenedAt: now, text: "*\(name)* ma kimarad", sub: reason ?? "",
            primary: "Megnézem", settled: "\(name) kihagyva",
            why: "Ma kihagytad; a heti rended nem változik, és a hét többi részét nem terheli.")]
    default:
        guard let clock = t.time, let start = wallClock(clock, on: now, calendar: calendar), start > now else { return [] }
        let minutes = Int(start.timeIntervalSince(now) / 60)
        let detail = [t.durationMin.map { "\($0) perc" }, t.location].compactMap { $0 }.joined(separator: " · ")
        return [WallCandidate(
            id: SportWallID.before, role: .improves, kind: .keszulj, area: WallSources.sport,
            rank: minutes <= 120 ? 0.9 : 0.5,
            text: minutes <= 120 ? "*\(minutes) perc múlva* \(kind.inSentence)" : "Ma *\(kind.inSentence)* \(clock)",
            sub: detail.isEmpty ? "Indítsd el az órádon, és utána két koppintás." : detail,
            primary: "Megnézem", settled: "\(name) megnézve",
            why: "Ma este sportod van — a nap terhelése e köré rendeződik, az edzőtermi edzéstől külön.")]
    }
}

/// „2026-11-28" of a moment in the calendar's zone — the overview's own `today` format.
func sportDay(_ date: Date, calendar: Calendar) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

// MARK: - The Edzés room on a sport day

/// „Röpi 18:00" / „Röpi 18:00 · megvolt, futás 07:00" — what the Edzés room says on a day with sport and no gym
/// session, instead of „pihenőnap" (spec §5.7). nil without sport. Only the brief's own `day.sport` is read.
public func edzesSportDayLine(_ sport: [Brief.Sport]) -> String? {
    guard !sport.isEmpty else { return nil }
    let parts = sport.enumerated().map { i, s -> String in
        let kind = SportKind(wire: s.sport)
        let name = i == 0 ? kind.short : kind.inSentence
        return "\(name) \(s.time)" + (s.done ? " · megvolt" : "")
    }
    return parts.joined(separator: ", ")
}
