import Foundation

// The weekly long-horizon review on Pénzem (`mezo-r36n9.120`, owner decision #66): under the three sleeves, one row per
// horizon built from the existing row + analysis-page parts. No push, no action button. Pure, so it is unit-tested.

/// One story of the week as the review page lists it: the headline, the holding and the named sources (each openable
/// when it has an http(s) link).
public struct PenzWeeklyStoryLine: Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    /// "Világ-ETF" / "Deviza" / "Kamat" — empty when nothing names it.
    public let holding: String
    public let sources: [PenzNewsSourceLine]
}

/// One horizon's row on Pénzem and its review page.
public struct PenzWeeklyRow: Equatable, Sendable, Identifiable {
    public let id: String
    public let sleeve: String
    public let glyph: String
    /// "10+ év".
    public let title: String
    /// The one-line verdict (the quiet copy for a sleeve no story touched; the fallback copy as it came).
    public let verdict: String
    /// "számít" when the reading found a lasting change, else "nincs teendő".
    public let quietWord: String
    public let matters: Bool
    /// `model`, `fallback`, `quiet`.
    public let narratedBy: String
    /// The reviewed week, "nov. 10–16.".
    public let week: String
    /// "3 hír · 5 forrás a héten" — or that no story touched this sleeve.
    public let counts: String
    /// The long sleeve's coverage sentence, as Pénzem computes it (nil for the others, or when unknown).
    public let coverage: String?
    public let body: String
    public let uncertainty: String
    public let noAction: String
    public let stories: [PenzWeeklyStoryLine]
}

/// What Pénzem's weekly block shows.
public enum PenzWeeklyView: Equatable, Sendable {
    /// Never loaded (or the read failed with nothing cached): no block at all — it never breaks Pénzem.
    case hidden
    /// No review yet: one quiet line, no rows.
    case pending(week: String)
    /// A built review with nothing to list (quiet or failed with no sections): one quiet line.
    case line(week: String, text: String)
    case rows(week: String, rows: [PenzWeeklyRow])
}

public let penzWeeklyPendingText = "Az első heti áttekintés hétfő reggel készül el."
public let penzWeeklyQuietText = "Ezen a héten egyetlen hír sem érintette a hosszú távú képet. Nincs teendőd."
public let penzWeeklyFailedText = "Az e heti áttekintést nem sikerült összeállítanom — a számaid rendben vannak, a következő futás újra próbálja."
public let penzWeeklyNoStoriesText = "Ezen a héten egyetlen hír sem érintette ezt a rekeszt."
public let penzWeeklyNoActionText = "Ezen a héten nincs mit tenned ezzel a rekesszel."

/// "nov. 10–16." within a month, "okt. 27. – nov. 2." across two; "" when unreadable.
public func penzWeekRange(_ start: String, _ end: String) -> String {
    guard let s = penzParts(start), (1...12).contains(s.m) else { return "" }
    guard let e = penzParts(end), (1...12).contains(e.m) else { return penzShortDate(start) }
    if s.y == e.y && s.m == e.m { return "\(penzShortDate(start).dropLast())–\(e.d)." }
    return "\(penzShortDate(start)) – \(penzShortDate(end))"
}

private let sleeveOrder = ["short": 0, "mid": 1, "long": 2]

public func penzWeeklyView(_ review: PenzWeeklyReview?) -> PenzWeeklyView {
    guard let r = review else { return .hidden }
    let week = penzWeekRange(r.weekStart, r.weekEnd)
    if r.status == "pending" { return .pending(week: week) }
    let sections = r.sections.sorted { (sleeveOrder[$0.sleeve] ?? 3) < (sleeveOrder[$1.sleeve] ?? 3) }
    if !sections.isEmpty { return .rows(week: week, rows: sections.map { penzWeeklyRow($0, week: week) }) }
    switch r.status {
    case "quiet": return .line(week: week, text: penzWeeklyQuietText)
    case "failed": return .line(week: week, text: penzWeeklyFailedText)
    default: return .hidden
    }
}

public func penzWeeklyRow(_ s: PenzWeeklySection, week: String) -> PenzWeeklyRow {
    let quiet = s.narratedBy == "quiet"
    let verdict = s.verdict.nilIfEmpty ?? (quiet ? penzWeeklyNoStoriesText : "")
    let counts = s.storyCount == 0 ? penzWeeklyNoStoriesText
        : "\(s.storyCount) hír" + (s.sourceCount > 0 ? " · \(s.sourceCount) forrás" : "") + " a héten"
    let coverage = s.sleeve == "long" ? s.coverageMonths.map(penzCoverageSentence) : nil
    let stories = s.stories.map { st in
        let holding: String
        switch st.kind {
        case "fx": holding = st.holdingName?.nilIfEmpty ?? "Deviza"
        case "rates": holding = st.holdingName?.nilIfEmpty ?? "Kamat"
        default: holding = st.holdingName ?? ""
        }
        return PenzWeeklyStoryLine(
            id: st.id, title: st.title, holding: holding,
            sources: st.sources.enumerated().map { i, src in
                PenzNewsSourceLine(text: src.name.nilIfEmpty ?? "Forrás", url: penzSafeURL(src.url), id: i)
            })
    }
    return PenzWeeklyRow(
        id: s.sleeve, sleeve: s.sleeve, glyph: penzSleeveGlyph(s.sleeve),
        title: s.horizonLabel.nilIfEmpty ?? penzSleeveTitle(s.sleeve), verdict: verdict,
        quietWord: s.matters ? "számít" : "nincs teendő", matters: s.matters, narratedBy: s.narratedBy, week: week,
        counts: counts, coverage: coverage, body: s.body.nilIfEmpty ?? verdict, uncertainty: s.uncertainty,
        noAction: s.noAction.nilIfEmpty ?? penzWeeklyNoActionText, stories: stories)
}
