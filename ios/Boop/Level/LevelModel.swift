import Foundation
import SwiftUI
import BoopCore
import BoopDesign

// The Levél screens' pure parts (mezo-r36n9.39, plan Task 12): everything the views decide that can be decided
// without SwiftUI — which words the head says, which tiles the digest gives, which rows a sender is shown in, the
// Gmail link, the rules edits. Tested in `LevelRoomTests`.
//
// Two rules run through all of it, as in `LevelLogic` (BoopCore): every number is the server's count, and every
// word about a mail is the server's word — nothing is composed from a title, and there is no price comparison.

let levelHue = Hue.level

enum LevelTab: String, CaseIterable {
    case ma = "Ma", figyelt = "Figyelt", szabalyok = "Szabályok", fiokok = "Fiókok"
}

/// The server's text goes into `NKHueText`, where an asterisk lights a span in the hue. A model-written title must
/// not be able to do that, so asterisks are dropped before the text reaches a view.
func levelPlain(_ text: String) -> String { text.replacingOccurrences(of: "*", with: "") }

// MARK: - What the mailbox is doing

enum LevelMailboxMode: Equatable {
    /// Still reading it, or it could not be read and there is nothing cached.
    case unknown
    /// Nothing is connected (never was, or he detached it).
    case needsConnect
    /// The mailbox refused the app password (revoked) — the same form, a different sentence.
    case authFailed
    /// Connected and reading; `silent` is "two runs without mail — the forwarding may have stopped".
    case connected(silent: Bool)
}

func levelMailboxMode(_ m: LevelMailbox?) -> LevelMailboxMode {
    guard let m else { return .unknown }
    switch m.state {
    case .none, .disconnected: return .needsConnect
    case .authFailed: return .authFailed
    case .connected: return .connected(silent: false)
    case .silent: return .connected(silent: true)
    case .unknown: return .unknown
    }
}

// MARK: - The head of each tab

struct LevelHeadWords: Equatable {
    let verdict: String
    let sentence: String
}

/// What the page says over the tabs. Ma says what the digest says; the other three say what their tab is.
func levelHeadWords(tab: LevelTab, mailbox: LevelMailbox?, digest: LevelDigest?, digestState: LevelLoadState,
                    now: Date = Date()) -> LevelHeadWords {
    switch tab {
    case .figyelt:
        return LevelHeadWords(verdict: "Még nem figyelek semmit", sentence: "A termékek és az árak figyelése később jön.")
    case .szabalyok:
        return LevelHeadWords(verdict: "Te döntöd el, mibe nézek bele", sentence: "Bankot, hivatalt és belépőkódot gép soha nem olvas.")
    case .fiokok:
        return LevelHeadWords(verdict: "A saját Gmailed, csak olvasásra", sentence: levelFiokokSentence(mailbox, now: now))
    case .ma:
        break
    }
    switch levelMailboxMode(mailbox) {
    case .needsConnect:
        return LevelHeadWords(verdict: "Még nincs postafiókod",
                              sentence: "Lépj be a Google-fiókoddal, és reggelente itt találod a rendezett levelekedet.")
    case .authFailed:
        return LevelHeadWords(verdict: "A Google nem enged be",
                              sentence: "A Google visszavonta a hozzáférést. Lépj be újra a Fiókok oldalon.")
    default:
        break
    }
    if let d = digest {
        let h = levelHead(d)
        return LevelHeadWords(verdict: h.verdict, sentence: h.sentence)
    }
    switch digestState {
    case .failed(let e):
        return LevelHeadWords(verdict: "Most nem érem el a postát",
                              sentence: e == .offline ? "Nincs net, és még nincs elmentett adatom." : "A szerver most nem válaszolt.")
    default:
        return LevelHeadWords(verdict: "Átnézem a postát", sentence: "Egy pillanat, a reggeli postát rendezem.")
    }
}

func levelFiokokSentence(_ m: LevelMailbox?, now: Date) -> String {
    switch levelMailboxMode(m) {
    case .needsConnect, .authFailed: return "Egy gombnyomás, és a levelek maguktól jönnek."
    case .connected, .unknown:
        guard let m, m.lastRunAt != nil else { return "Még nem néztem át a postát." }
        return "Utolsó átnézés \(levelLastRunWhen(m.lastRunAt, now: now) ?? "ma")-kor volt."
    }
}

/// "ma 08:00" / "tegnap 15:00" / "11. 19. 08:00" — Budapest time.
func levelLastRunWhen(_ at: Date?, now: Date, calendar: Calendar = levelCalendar) -> String? {
    guard let at else { return nil }
    let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: at), to: calendar.startOfDay(for: now)).day ?? 0
    let c = calendar.dateComponents([.month, .day, .hour, .minute], from: at)
    let time = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    switch days {
    case 0: return "ma \(time)"
    case 1: return "tegnap \(time)"
    default: return "\(c.month ?? 0). \(c.day ?? 0). \(time)"
    }
}

/// "Utolsó átnézés: ma 08:00 · 34 levél" — the count is the server's `lastFetched`.
func levelLastRunLine(_ m: LevelMailbox?, now: Date) -> String {
    guard let m, let when = levelLastRunWhen(m.lastRunAt, now: now) else { return "Még nem néztem át a postát." }
    let count = m.lastFetched.map { " · \($0) levél" } ?? ""
    return "Utolsó átnézés: \(when)\(count)"
}

/// The orb in the head: how much of the post is dealt with. An empty day is full; nothing yet is a still half orb.
func levelOrbLevel(_ d: LevelDigest?) -> Double? {
    guard let d else { return nil }
    guard d.arrived > 0 else { return 1 }
    return min(1, max(0, Double(d.handled) / Double(d.arrived)))
}

// MARK: - Ma

func levelStats(_ d: LevelDigest, calendar: Calendar = levelCalendar) -> [NKStat] {
    let afternoon = d.lastRunAt.map { calendar.component(.hour, from: $0) >= 15 } ?? false
    return [
        NKStat(value: "\(d.arrived)", unit: "levél", label: afternoon ? "érkezett ma" : "érkezett reggel óta"),
        NKStat(value: "\(d.handled)", label: "elintéztem helyetted"),
        NKStat(value: "\(d.worthAMinute)", label: "megér egy percet", hot: true),
    ]
}

/// The heat strip: one cell per slot of the server's `heatSlots` (two-hour slots), the busiest at 1. nil when the day
/// has nothing to draw.
func levelHeat(_ d: LevelDigest) -> (cells: [(String, Double)], note: String)? {
    let slots = d.heatSlots
    guard !slots.isEmpty, let peak = slots.max(), peak > 0 else { return nil }
    let width = max(1, 24 / slots.count)
    let cells = slots.enumerated().map { (i, n) in ("\(i * width)", Double(max(0, n)) / Double(peak)) }
    let at = (slots.firstIndex(of: peak) ?? 0) * width
    return (cells, "A legtöbb levél *\(at) és \(at + width)* között jön.")
}

/// The note over Ma when part of the day was sorted by rules only. Cap and failure are told apart.
func levelRulesNote(_ d: LevelDigest?) -> String? {
    guard let d, d.rulesOnly else { return nil }
    switch d.rulesOnlyReason {
    case .failure?: return "Ma nem tudtam pontozni — a többit szabályok szerint rendeztem."
    case .cap?: return "Ma már nem pontoztam tovább — a többit szabályok szerint rendeztem."
    default: return "A többit szabályok szerint rendeztem."
    }
}

/// How old the shown digest is, for `.nkStale`.
func levelStale(isStale: Bool, age: TimeInterval?) -> NKStale? {
    guard isStale else { return nil }
    guard let age else { return NKStale(age: "Nincs net — az utolsó ismert állapot") }
    let hours = Int(age / 3600)
    let text: String
    switch hours {
    case ..<1: text = "most mentett"
    case 1..<24: text = "\(hours) órája"
    default: text = "\(hours / 24) napja"
    }
    return NKStale(age: "Nincs net — \(text) mentett adat", loud: hours >= 6)
}

/// One row of "Először ezek": a person, or a sensitive sender (sender only — never a subject, never a summary).
struct LevelPersonRow: Equatable, Identifiable {
    let id: String
    let title: String, sub: String, right: String
    let hot: Bool, sensitive: Bool
    let glyph: String
    let item: LevelItem
    static func == (a: Self, b: Self) -> Bool { a.id == b.id && a.title == b.title && a.sub == b.sub && a.right == b.right }
}

func levelSender(_ i: LevelItem) -> String {
    for s in [i.fromName, i.fromAddress] {
        if let s, !s.trimmingCharacters(in: .whitespaces).isEmpty { return levelPlain(s) }
    }
    return "Ismeretlen feladó"
}

func levelClock(_ at: Date?, calendar: Calendar = levelCalendar) -> String {
    guard let at else { return "" }
    let c = calendar.dateComponents([.hour, .minute], from: at)
    return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
}

func levelPeopleRows(_ d: LevelDigest) -> [LevelPersonRow] {
    let people = d.people.sorted { ($0.receivedAt ?? .distantPast) > ($1.receivedAt ?? .distantPast) }.map { i -> LevelPersonRow in
        let note = i.isSafeToSurface && !i.title.isEmpty ? levelPlain(i.title) : "Személyes levél"
        let when = levelClock(i.receivedAt)
        return LevelPersonRow(id: i.id, title: "\(levelSender(i)) írt", sub: when.isEmpty ? note : "\(note) · \(when)",
                              right: "", hot: true, sensitive: false, glyph: "person-sage", item: i)
    }
    let sensitive = d.sensitive.sorted { ($0.receivedAt ?? .distantPast) > ($1.receivedAt ?? .distantPast) }.map { i in
        LevelPersonRow(id: i.id, title: "\(levelSender(i)) írt", sub: "Nem olvastam el · megnyitás a Gmailben",
                       right: levelClock(i.receivedAt), hot: false, sensitive: true, glyph: "scale-ink", item: i)
    }
    return people + sensitive
}

// MARK: - Deadlines, parcels, deals

func levelAmountText(_ item: LevelItem) -> String {
    guard let minor = item.amountMinor else { return "" }
    let major = minor / 100
    let grouped = NumberFormatter.levelGrouped.string(from: NSNumber(value: major)) ?? "\(major)"
    let cur = (item.currency ?? "HUF").uppercased()
    return cur == "HUF" ? "\(grouped) Ft" : "\(grouped) \(cur)"
}

extension NumberFormatter {
    static let levelGrouped: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = "\u{00A0}"
        f.usesGroupingSeparator = true
        f.locale = Locale(identifier: "hu_HU")
        return f
    }()
}

/// A row with a date mark on the right: `soon` = today or tomorrow (the mark is filled in the hue).
struct LevelMarkRow: Equatable, Identifiable {
    let id: String
    let glyph: String, title: String, sub: String, mark: String, markSub: String
    let soon: Bool
    let item: LevelItem
    static func == (a: Self, b: Self) -> Bool { a.id == b.id && a.mark == b.mark && a.title == b.title && a.sub == b.sub }
}

func levelDueMarkRows(_ items: [LevelItem], now: Date) -> [LevelMarkRow] {
    levelDeadlineRows(items.filter(\.isSafeToSurface), now: now).map { r in
        let soon = r.mark == "ma" || r.mark == "holnap" || r.mark == "lejárt"
        return LevelMarkRow(id: r.id, glyph: r.item.amountMinor != nil ? "e-penz" : "clock-ink", title: levelPlain(r.item.title),
                            sub: levelPlain(r.item.summary), mark: r.mark, markSub: levelAmountText(r.item), soon: soon, item: r.item)
    }
}

func levelParcelRows(_ items: [LevelItem]) -> [LevelMarkRow] {
    items.filter(\.isSafeToSurface).map { i in
        let (glyph, mark, soon): (String, String, Bool)
        switch i.parcelState {
        case .today?: (glyph, mark, soon) = ("bolt-ink", "ma érkezik", true)
        case .pickup?: (glyph, mark, soon) = ("check-ink", "átvehető", false)
        case .inTransit?: (glyph, mark, soon) = ("clock-ink", "úton", false)
        case .delivered?: (glyph, mark, soon) = ("check-ink", "megérkezett", false)
        default: (glyph, mark, soon) = ("clock-ink", "", false)
        }
        return LevelMarkRow(id: i.id, glyph: glyph, title: levelPlain(i.title), sub: levelPlain(i.summary), mark: mark, markSub: "",
                            soon: soon, item: i)
    }
}

/// "Ma éjfélig" / "Ma 18:00-ig" / "Holnap 12:00-ig" / "11. 24-ig" — from the server's `validUntil`.
func levelValidLeft(_ until: Date?, now: Date, calendar: Calendar = levelCalendar) -> String {
    guard let until else { return "" }
    if until < now { return "Lejárt" }
    let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: until)).day ?? 0
    let c = calendar.dateComponents([.month, .day, .hour, .minute], from: until)
    let atMidnight = (c.hour ?? 0) == 23 && (c.minute ?? 0) >= 55
    let clock = atMidnight ? "éjfélig" : "\(levelClock(until))-ig"
    switch days {
    case 0: return "Ma \(clock)"
    case 1: return "Holnap \(clock)"
    default: return "\(c.month ?? 0). \(c.day ?? 0).-ig"
    }
}

/// How a deal card reads: the server's words, a score chip when there is a score, an amber warning when the mail was
/// flagged or its screen unknown (no score, no feedback buttons).
struct LevelDealFace: Equatable {
    let from: String, title: String, why: String, left: String
    let score: Int?
    let warning: Bool
}

func levelDealFace(_ i: LevelItem, now: Date) -> LevelDealFace {
    LevelDealFace(from: levelSender(i), title: levelPlain(i.title), why: levelPlain(i.why),
                  left: levelValidLeft(i.validUntil, now: now), score: i.score, warning: !i.isSafeToSurface)
}

/// Ma's third block: only the deals, the way Ma has always shown them — worth a minute first.
func levelDealsOrdered(_ d: LevelDigest) -> [LevelItem] {
    d.deals.sorted {
        if ($0.score ?? -1) != ($1.score ?? -1) { return ($0.score ?? -1) > ($1.score ?? -1) }
        return $0.id < $1.id
    }
}

// MARK: - Gmail

/// "Megnyitás a Gmailben": the app's `googlegmail:///cv=<hex id>` link for a message, then the app itself, else the
/// web. The server's id is Gmail's decimal `X-GM-MSGID`; the app's link takes it in hex.
func levelGmailURLs(messageId: String?) -> [URL] {
    guard let id = messageId?.trimmingCharacters(in: .whitespaces), !id.isEmpty else {
        return [URL(string: "https://mail.google.com/")!]
    }
    let hex: String
    if let n = UInt64(id) { hex = String(n, radix: 16) }
    else if id.allSatisfy(\.isHexDigit) { hex = id.lowercased() }
    else { return [URL(string: "googlegmail://")!, URL(string: "https://mail.google.com/")!] }
    return [URL(string: "googlegmail:///cv=\(hex)")!, URL(string: "googlegmail://")!, URL(string: "https://mail.google.com/")!]
}

// MARK: - Rules

enum LevelRuleList: Equatable { case sensitive, silent, always }

/// The owner's rules after adding one sender to a list; nil when there is nothing to add (empty, or already there).
func levelRulesAdding(_ rules: LevelRules?, _ list: LevelRuleList, pattern: String) -> LevelRulesRequest? {
    let p = pattern.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !p.isEmpty, var req = rules?.ownerRequest else { return nil }
    let current = rules.map { r -> [LevelRule] in
        switch list { case .sensitive: r.sensitive; case .silent: r.silent; case .always: r.always }
    } ?? []
    guard !current.contains(where: { $0.pattern.caseInsensitiveCompare(p) == .orderedSame }) else { return nil }
    switch list {
    case .sensitive: req.sensitive.append(p)
    case .silent: req.silent.append(p)
    case .always: req.always.append(p)
    }
    return req
}

/// The owner's rules after taking a sender off a list. Seed rules are never removable.
func levelRulesRemoving(_ rules: LevelRules?, _ list: LevelRuleList, pattern: String) -> LevelRulesRequest? {
    guard var req = rules?.ownerRequest else { return nil }
    func same(_ s: String) -> Bool { s.caseInsensitiveCompare(pattern) == .orderedSame }
    switch list {
    case .sensitive: req.sensitive.removeAll(where: same)
    case .silent: req.silent.removeAll(where: same)
    case .always: req.always.removeAll(where: same)
    }
    return req
}

/// "háromszor" for the silent-sender proposal; digits past nine.
func levelTimesWord(_ n: Int) -> String {
    let w = ["", "egyszer", "kétszer", "háromszor", "négyszer", "ötször", "hatszor", "hétszer", "nyolcszor", "kilencszer"]
    return w.indices.contains(n) && n > 0 ? w[n] : "\(n)-szer"
}

// MARK: - Fiókok

let levelCooldownLine = "Most néztem át — pár perc múlva újra próbálhatod."
let levelGoogleRefusedLine = "A Google nem engedte a belépést"
let levelGoogleUnconfiguredLine = "A Google-belépés még nincs beállítva a szerveren."
let levelGoogleRevokedLine = "A Google visszavonta a hozzáférést — lépj be újra."
let levelReadOnlyLine = "Boop csak olvas: a Beérkezett leveleket és a Spam mappát látja."
let levelNeverLine = "Soha nem küld a nevedben, nem töröl, és nem jelöl olvasottnak semmit."
let levelICloudLine = "Ha az iCloud-leveleidet is látni szeretnéd, állítsd be az iCloudban, hogy továbbítson a Gmailedbe."
let levelDetachMessage = "A Google-hozzáférést visszavonom, és a Boop többé nem lát leveleket. A már átnézett levelek összefoglalói megmaradnak."

/// What the Fiókok tab shows for the mailbox. `canSignIn` is false while the server has no Google client id.
enum LevelFiokokView: Equatable {
    case unknown
    case signIn(canSignIn: Bool)
    case revoked(canSignIn: Bool)
    case connected(silent: Bool)
}

func levelFiokokView(_ m: LevelMailbox?) -> LevelFiokokView {
    let can = !(m?.googleClientId ?? "").isEmpty
    switch levelMailboxMode(m) {
    case .unknown: return .unknown
    case .needsConnect: return .signIn(canSignIn: can)
    case .authFailed: return .revoked(canSignIn: can)
    case .connected(let silent): return .connected(silent: silent)
    }
}

/// What a failed sign-in says under the button. Nothing from Google (code, token) is ever put in it.
func levelGoogleOutcomeLine(_ o: LevelGoogleOutcome) -> String? {
    switch o {
    case .connected: return nil
    case .refused: return levelGoogleRefusedLine
    case .notConfigured: return levelGoogleUnconfiguredLine
    case .offline: return levelErrorText(.offline)
    case .failed(let e): return levelErrorText(e)
    }
}

// MARK: - "A többi" folds

/// Which categories are unfolded after a tap on one. Collapsed by default; a second tap folds it again.
func levelToggleFold(_ open: Set<String>, _ category: String) -> Set<String> {
    var next = open
    if !next.insert(category).inserted { next.remove(category) }
    return next
}

/// The highlight's score chip: a deal that has a score (one already given stays shown on a rules-only day).
func levelHighlightScore(_ h: LevelHighlight) -> Int? {
    h.kind == .deal ? h.item.score : nil
}
