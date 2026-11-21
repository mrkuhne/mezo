import Foundation

// Pure builders the Levél screens and the wall share (mezo-r36n9.39). No SwiftUI, no network, no clock of its own.
//
// Two rules run through all of it:
//  - **Every number is the server's count.** The head says "34 levél", "31", "kettő" only because the digest said
//    `arrived`, `handled`, `worthAMinute`. Nothing is computed into a new figure, and there is no price comparison.
//  - **A highlight or a notification only uses what the server sent** — its title, summary and why — and never an
//    item whose injection screen is flagged or unknown.

/// His day is Budapest's, whatever zone the phone is in.
public let levelCalendar: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "Europe/Budapest") ?? .current
    c.locale = Locale(identifier: "hu_HU")
    return c
}()

/// `YYYY-MM-DD` of the Budapest day `date` falls on — the cache key and the digest's `date` parameter.
public func levelDay(_ date: Date, calendar: Calendar = levelCalendar) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

extension LevelItem {
    /// Nothing may be surfaced or notified from an item the screen flagged or could not judge.
    public var isSafeToSurface: Bool { !flagged && screen != .flagged && screen != .unknown }
}

// MARK: - The head

public struct LevelHead: Equatable, Sendable {
    public let verdict: String
    public let sentence: String
}

/// The head of the page: a verdict in a few words and one sentence of the day in counts.
///   0 worth a minute → a quiet good-news line · 1 → "Egy dolgot nézz meg" · N → "Két dolgot nézz meg" …
public func levelHead(_ d: LevelDigest?) -> LevelHead {
    guard let d, d.arrived > 0 || d.worthAMinute > 0 else {
        return LevelHead(verdict: "Csendes nap", sentence: "Még nem jött levél, nincs mit nézned.")
    }
    let arrived = d.arrived > 0 ? "\(d.arrived) levél jött reggel óta. " : ""
    let handled = d.handled > 0 ? "\(d.handled)\(levelAccusativeSuffix(d.handled)) elintéztem helyetted" : ""
    switch d.worthAMinute {
    case 0:
        let tail = d.handled > 0 ? "\(handled), egyik sem kér semmit." : "Egyik sem kér semmit."
        return LevelHead(verdict: "Nincs teendőd", sentence: arrived + tail)
    default:
        let word = levelCountWord(d.worthAMinute)
        let verdict = d.worthAMinute == 1 ? "Egy dolgot nézz meg" : "\(levelCountWord(d.worthAMinute, capitalized: true)) dolgot nézz meg"
        let worth = "\(word) megér egy percet."
        let tail = d.handled > 0 ? "\(handled), \(worth)" : String(worth.prefix(1)).uppercased() + String(worth.dropFirst())
        return LevelHead(verdict: verdict, sentence: arrived + tail)
    }
}

/// "egy", "kettő", "három"… up to nine; digits above.
func levelCountWord(_ n: Int, capitalized: Bool = false) -> String {
    let words = ["nulla", "egy", "kettő", "három", "négy", "öt", "hat", "hét", "nyolc", "kilenc"]
    let w: String
    if capitalized {
        // "Két dolgot" (the attributive form), not "Kettő dolgot".
        w = n == 2 ? "Két" : (words.indices.contains(n) ? words[n] : "\(n)")
        return w.prefix(1).uppercased() + w.dropFirst()
    }
    w = words.indices.contains(n) ? words[n] : "\(n)"
    return w
}

/// The accusative ending after a written number: "31-et", "32-t", "33-at", "30-at".
func levelAccusativeSuffix(_ n: Int) -> String {
    let unit: [Int: String] = [1: "-et", 2: "-t", 3: "-at", 4: "-et", 5: "-öt", 6: "-ot", 7: "-et", 8: "-at", 9: "-et"]
    let tens: [Int: String] = [1: "-et", 2: "-at", 3: "-at", 4: "-et", 5: "-et", 6: "-at", 7: "-et", 8: "-at", 9: "-et"]
    if n % 10 != 0 { return unit[n % 10] ?? "-et" }
    if n % 100 != 0 { return tens[(n % 100) / 10] ?? "-et" }
    return "-at"
}

/// The note under the head when the day's post was sorted by rules alone. Nothing is lost, and it says so.
public func levelRulesOnlyNote(_ d: LevelDigest?) -> String? {
    guard let d, d.rulesOnly else { return nil }
    switch d.rulesOnlyReason {
    case .cap?: return "A mai kereted elfogyott, ezért a maradékot csak szabályok szerint válogattam. Holnap újra átnézem."
    case .failure?: return "Az értékelés most nem sikerült, ezért csak szabályok szerint válogattam."
    default: return "Ezt a kört csak szabályok szerint válogattam."
    }
}

// MARK: - Deadlines

/// A deadline with its "ma" / "holnap" / weekday mark, ready to print.
public struct LevelDeadlineRow: Equatable, Sendable, Identifiable {
    public let item: LevelItem
    /// "lejárt", "ma", "holnap", a weekday ("péntek") within the week, otherwise "11. 27.".
    public let mark: String
    public var id: String { item.id }
}

/// Deadlines by due moment, nearest first (no due moment last), marked in Budapest time.
public func levelDeadlineRows(_ items: [LevelItem], now: Date, calendar: Calendar = levelCalendar) -> [LevelDeadlineRow] {
    items
        .sorted { a, b in
            switch (a.dueAt, b.dueAt) {
            case let (x?, y?): return x < y
            case (_?, nil): return true
            default: return false
            }
        }
        .map { LevelDeadlineRow(item: $0, mark: levelDueMark($0.dueAt, now: now, calendar: calendar)) }
}

func levelDueMark(_ due: Date?, now: Date, calendar: Calendar = levelCalendar) -> String {
    guard let due else { return "" }
    let today = calendar.startOfDay(for: now)
    let dueDay = calendar.startOfDay(for: due)
    let days = calendar.dateComponents([.day], from: today, to: dueDay).day ?? 0
    switch days {
    case ..<0: return "lejárt"
    case 0: return "ma"
    case 1: return "holnap"
    case 2...6:
        let names = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"]
        return names[(calendar.component(.weekday, from: due) - 1 + 7) % 7]
    default:
        let c = calendar.dateComponents([.month, .day], from: due)
        return "\(c.month ?? 0). \(c.day ?? 0)."
    }
}

// MARK: - The highlight

public struct LevelHighlight: Equatable, Sendable {
    public enum Kind: Equatable, Sendable { case deal, deadline }
    public let item: LevelItem
    public let kind: Kind
    /// A short label without a number: what makes this the one to look at.
    public let eyebrow: String
    /// The server's own words — never composed from figures.
    public var title: String { item.title }
    public var sub: String { item.summary }
}

/// The one card that reads big at the top: the best notifiable deal; else the nearest deadline due tomorrow; else the
/// best deal at score 7 or more; else nothing. Flagged and unknown-screen items are never picked.
public func levelHighlight(_ d: LevelDigest?, now: Date, calendar: Calendar = levelCalendar) -> LevelHighlight? {
    guard let d else { return nil }
    func best(_ deals: [LevelItem]) -> LevelItem? {
        deals.max { ($0.score ?? 0) < ($1.score ?? 0) }
    }
    let safeDeals = d.deals.filter { $0.isSafeToSurface && $0.screen == .clean }
    if let deal = best(safeDeals.filter(\.notifiable)) {
        return LevelHighlight(item: deal, kind: .deal, eyebrow: "Hamarosan lejár")
    }
    let tomorrow = d.deadlines
        .filter { $0.isSafeToSurface && $0.dueAt.map { levelDueMark($0, now: now, calendar: calendar) == "holnap" } == true }
        .min { ($0.dueAt ?? .distantFuture) < ($1.dueAt ?? .distantFuture) }
    if let t = tomorrow {
        return LevelHighlight(item: t, kind: .deadline, eyebrow: "Holnap esedékes")
    }
    if let deal = best(safeDeals.filter { ($0.score ?? 0) >= 7 }) {
        return LevelHighlight(item: deal, kind: .deal, eyebrow: "Megér egy pillantást")
    }
    return nil
}

// MARK: - Errors, in his words

/// What a failed Levél call says to him — the server's own code where it sent one.
public func levelErrorText(_ error: PlanFetchError) -> String {
    switch error {
    case .offline: return "Most nincs net. Próbáld újra, ha lesz."
    case .unauthorized: return "Lejárt a belépésed. Lépj be újra."
    case .notFound: return "Ezt a levelet már nem találom."
    case .rejected(let code), .conflict(let code):
        switch code {
        case "MAIL_AUTH_FAILED": return "A postafiók nem fogadta el a jelszót. Nézd meg, hogy az alkalmazásjelszót írtad-e be, nem a szokásosat."
        case "MAIL_UNREACHABLE": return "Most nem érem el a postafiókot. Próbáld újra kicsit később."
        case "MAIL_RUN_COOLDOWN": return "Az előbb néztem át a postát. Kicsit várj, mielőtt újra kérnéd."
        case "MAIL_NOT_CONNECTED": return "Előbb kösd be a postafiókot."
        case "MAIL_ITEM_NOT_FOUND": return "Ezt a levelet már nem találom."
        default: return "A szerver nem fogadta el ezt a kérést."
        }
    case .dayWorkoutRunning, .server: return "A szerver most nem válaszol. Próbáld újra kicsit később."
    }
}
