import Foundation

// The Napló tab in words and numbers (`mezo-r36n9.205`, spec §5.4). Every figure comes from the logged sessions;
// an unknown value is left out, never filled in.

/// The hero: the last four weeks.
public struct SportJournalHero: Equatable, Sendable {
    public let figures: [SportFigure]
    /// The effort of the last sessions, oldest first (at most 13).
    public let rpeLine: [Double]
    /// One sentence about the shoulder; nil when nothing can be said.
    public let sentence: String?
    /// VoiceOver for the effort line.
    public let lineLabel: String?
}

/// One session card.
public struct SportJournalCard: Equatable, Sendable, Identifiable {
    public let id: String
    public let eyebrow: String
    public let title: String
    public let load: Int?
    public let chips: [String]
    public let kcalLine: String?
    public let note: String?
    public let accessibility: String
}

/// „6,4"; a whole number without a decimal („6").
public func sportDecimal(_ x: Double) -> String {
    let r = (x * 10).rounded() / 10
    if r == r.rounded() { return "\(Int(r))" }
    return String(format: "%.1f", r).replacingOccurrences(of: ".", with: ",")
}

public func sportJournalHero(_ sessions: [SportSessionRecord], today: String) -> SportJournalHero {
    let from28 = sportAddDays(today, -27)
    let from14 = sportAddDays(today, -13)
    let recent = sessions.filter { $0.date >= from28 && $0.date <= today }
    var figures = [SportFigure("\(recent.count)", "alkalom · 4 hét")]
    let rpes = recent.compactMap(\.rpe)
    if !rpes.isEmpty {
        figures.append(SportFigure(sportDecimal(rpes.reduce(0, +) / Double(rpes.count)), "átlag megterhelés", lit: true))
    }
    let shoulders = recent.compactMap(\.shoulderStrain)
    if !shoulders.isEmpty {
        figures.append(SportFigure(sportDecimal(Double(shoulders.reduce(0, +)) / Double(shoulders.count)), "váll átlag"))
    }
    let line = Array(sportJournalSorted(sessions).compactMap(\.rpe).prefix(13).reversed())

    let last14 = sessions.filter { $0.date >= from14 && $0.date <= today }
    let marked = last14.compactMap(\.shoulderStrain)
    let sentence: String?
    if last14.isEmpty {
        sentence = nil
    } else if marked.isEmpty {
        sentence = "Az utolsó két hétben nem jelölted, hogy bírta a vállad — a javításnál pótolhatod."
    } else {
        let high = marked.filter { $0 >= 7 }.count
        sentence = high == 0
            ? "A vállad az utolsó két hétben 7 alatt maradt."
            : "A vállad az utolsó két hétben \(high) alkalommal ért el 7-et vagy többet."
    }
    var label: String?
    if let lo = line.min(), let hi = line.max(), let last = line.last {
        label = "A megterhelés az utolsó \(line.count) alkalomban \(sportDecimal(lo)) és \(sportDecimal(hi)) között, a legutóbbi \(sportDecimal(last))."
    }
    return SportJournalHero(figures: figures, rpeLine: line, sentence: sentence, lineLabel: label)
}

private let longMonth = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember",
                         "október", "november", "december"]

public func sportJournalCard(_ s: SportSessionRecord) -> SportJournalCard {
    let wd = sportLegacyWeekday(s.date)
    let eyebrow = ([sportMonthDay(s.date), wd.map { sportDayNames[$0] }, s.time].compactMap { $0 }).joined(separator: " · ").uppercased()
    var chips: [String] = []
    if let d = s.duration, d > 0 { chips.append(sportLength(d)) }
    if let r = s.rpe { chips.append("megterhelés \(sportDecimal(r))") }
    if let sets = s.setsPlayed { chips.append("\(sets) szett") }
    if let rounds = s.rounds { chips.append("\(rounds) kör") }
    if let sh = s.shoulderStrain { chips.append("váll \(sh)") }
    let kcal: String? = s.kcal.map { s.kcalIsEstimate == false ? "\($0) kcal" : "kb. \($0) kcal — becslés" }
    let note = s.notes?.trimmingCharacters(in: .whitespacesAndNewlines)
    let parts = s.date.split(separator: "-")
    let spokenDate = parts.count == 3 && Int(parts[1]).map({ (1...12).contains($0) }) == true
        ? "\(longMonth[Int(parts[1])! - 1]) \(Int(parts[2]) ?? 0)." : s.date
    var spoken = [s.kind.name, spokenDate]
    if let wd { spoken.append(sportDayNames[wd].lowercased()) }
    if let t = s.time { spoken.append(t) }
    spoken += chips
    if let load = s.load { spoken.append("terhelés \(load)") }
    if let kcal { spoken.append(kcal) }
    return SportJournalCard(id: s.id, eyebrow: eyebrow, title: s.kind.name, load: s.load, chips: chips, kcalLine: kcal,
                            note: note?.isEmpty == false ? note : nil,
                            accessibility: spoken.joined(separator: ", "))
}
