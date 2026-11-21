import Foundation
import BoopCore

// The Éves terv's words and dates (mezo-r36n9.113, screens 5–6b of the approved spike `spike/boop-eves-terv`). Every
// number and date here is read from the server's plan (`WireYearPlan`); this file only turns them into Hungarian.
// Muscle names are the shared `SubMuscles.groupName` („Hát", „Comb", „Far").

// MARK: - Dates

private let evesMonths = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]

/// `yyyy-MM-dd` → its parts; nil when it is not a date.
func evesParts(_ ymd: String) -> (year: Int, month: Int, day: Int)? {
    let p = ymd.prefix(10).split(separator: "-").compactMap { Int($0) }
    guard p.count == 3, (1...12).contains(p[1]), (1...31).contains(p[2]) else { return nil }
    return (p[0], p[1], p[2])
}

/// „szept. 21." — a plan date the way he reads it.
func evesDate(_ ymd: String) -> String {
    guard let p = evesParts(ymd) else { return ymd }
    return "\(evesMonths[p.month - 1]) \(p.day)."
}

/// „szept." — the month alone (the strip's ticks).
func evesMonth(_ ymd: String) -> String {
    guard let p = evesParts(ymd) else { return "" }
    return evesMonths[p.month - 1]
}

/// The unlinked-block banner's sentence: „Az „Erő alapozás” nov. 2-től fut, de egyik éves blokkhoz sincs kötve.”
func evesUnlinkedText(_ u: WireYearUnlinked) -> String {
    let article = evesArticle(u.title).capitalized
    return "\(article) „\(u.title)” \(evesFrom(u.startDate)) fut, de egyik éves blokkhoz sincs kötve."
}

/// „dec. 14-től" — the date with the right „-tól / -től" for the day's number.
func evesFrom(_ ymd: String) -> String {
    guard let p = evesParts(ymd) else { return ymd }
    return "\(evesMonths[p.month - 1]) \(p.day)-\(evesTolTol(p.day))"
}

/// „-tól" or „-től" after a day number, by how the number ends when said aloud (egy-től, három-tól, tíz-től, húsz-tól).
func evesTolTol(_ n: Int) -> String {
    let ones = n % 10
    if n > 0 && n % 100 == 0 { return "tól" } // száz
    if ones == 0 {
        switch (n / 10) % 10 {
        case 2, 3, 6, 8: return "tól" // húsz, harminc, hatvan, nyolcvan
        default: return "től"         // tíz, negyven, ötven, hetven, kilencven
        }
    }
    switch ones {
    case 3, 6, 8: return "tól" // három, hat, nyolc
    default: return "től"      // egy, kettő, négy, öt, hét, kilenc
    }
}

/// „a" or „az" before a number said aloud (az egy, az öt, az ötvenkettő; a nyolc, a tíz).
func evesNumArticle(_ n: Int) -> String {
    let s = String(n)
    return n == 1 || s.hasPrefix("5") ? "az" : "a"
}

/// „52-ből" / „53-ból" — „-ból / -ből" follows the same sound as „-tól / -től".
func evesBolBol(_ n: Int) -> String { evesTolTol(n) == "tól" ? "ból" : "ből" }

/// „szept. 21. – nov. 1." — a block's first and last day.
func evesRange(_ b: WireYearBlock) -> String { "\(evesDate(b.plannedStart)) – \(evesDate(b.lastDay))" }

/// The plan's years: „2026/27", or „2027" when it starts and ends in the same year.
func evesYears(_ plan: WireYearPlan) -> String {
    guard let s = evesParts(plan.startDate), let e = evesParts(plan.endDate) else { return "" }
    return s.year == e.year ? "\(s.year)" : "\(s.year)/\(String(format: "%02d", e.year % 100))"
}

private let evesCalendar: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "UTC")!
    return c
}()

private func evesDay(_ ymd: String) -> Date? {
    guard let p = evesParts(ymd) else { return nil }
    return evesCalendar.date(from: DateComponents(year: p.year, month: p.month, day: p.day))
}

private func evesString(_ d: Date) -> String {
    let c = evesCalendar.dateComponents([.year, .month, .day], from: d)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

/// Days from `from` to `to` (both `yyyy-MM-dd`).
func evesDays(from: String, to: String) -> Int? {
    guard let a = evesDay(from), let b = evesDay(to) else { return nil }
    return evesCalendar.dateComponents([.day], from: a, to: b).day
}

/// The plan week a day falls in (1 = the plan's first week).
func evesWeek(of ymd: String, start: String) -> Int? {
    guard let d = evesDays(from: start, to: ymd) else { return nil }
    return Int((Double(d) / 7).rounded(.down)) + 1
}

/// `ymd` moved by whole days.
func evesAdding(days: Int, to ymd: String) -> String? {
    guard let d = evesDay(ymd), let moved = evesCalendar.date(byAdding: .day, value: days, to: d) else { return nil }
    return evesString(moved)
}

/// The Monday a week of the plan starts on (the strip's ticks).
func evesMonday(week: Int, start: String) -> String { evesAdding(days: (week - 1) * 7, to: start) ?? start }

/// „Jövő évi terv": the next plan starts the Monday after the consolidation's last day, never before the Monday on/after
/// today.
func evesNextYearStart(_ plan: WireYearPlan, today: Date, calendar: Calendar = .current) -> String {
    let after = evesAdding(days: 1, to: plan.endDate) ?? plan.endDate
    let todayString = evesTodayMonday(today, calendar: calendar)
    return after > todayString ? after : todayString
}

/// The Monday on/after today, `yyyy-MM-dd` (the earliest start a new plan may have).
func evesTodayMonday(_ today: Date, calendar: Calendar = .current) -> String {
    let start = calendar.startOfDay(for: today)
    let weekday = calendar.component(.weekday, from: start) // 1 = Sunday, 2 = Monday
    let monday = calendar.date(byAdding: .day, value: (2 - weekday + 7) % 7, to: start) ?? start
    let c = calendar.dateComponents([.year, .month, .day], from: monday)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

// MARK: - Muscles

/// The year's groups in the order he reads them (the spike's chips): upper body first, then the legs.
let evesGroupOrder = ["back", "chest", "shoulder", "biceps", "triceps", "quad", "ham", "glute", "calf"]
let evesUpper = ["back", "chest", "shoulder", "biceps", "triceps"]
let evesLower = ["quad", "ham", "glute", "calf"]

/// „Comb" — a group's name, capitalised (a chip, the start of a sentence).
func evesMuscle(_ key: String) -> String { SubMuscles.groupName(key) == "Egyéb" ? key : SubMuscles.groupName(key) }

/// „comb" — inside a sentence.
func evesMuscleLower(_ key: String) -> String { evesMuscle(key).lowercased() }

/// „Hát + bicepsz" — a block's focus in reading order; a consolidation or an empty focus has its own words.
func evesFocusTitle(_ b: WireYearBlock) -> String {
    if b.isConsolidation { return "Lezárás · könnyű szinten tartás" }
    let ordered = evesGroupOrder.filter(b.focus.contains) + b.focus.filter { !evesGroupOrder.contains($0) }
    guard let first = ordered.first else { return "Fókusz nélkül" }
    return ([evesMuscle(first)] + ordered.dropFirst().map(evesMuscleLower)).joined(separator: " + ")
}

/// „a" or „az" before a word (az before a vowel).
func evesArticle(_ word: String) -> String {
    guard let c = word.lowercased().first else { return "a" }
    return "aáeéiíoóöőuúüű".contains(c) ? "az" : "a"
}

/// „a vádli és a tricepsz" / „a hát, a mell és a váll".
func evesList(_ keys: [String]) -> String {
    let words = keys.map { "\(evesArticle(evesMuscleLower($0))) \(evesMuscleLower($0))" }
    guard words.count > 1 else { return words.first ?? "" }
    return words.dropLast().joined(separator: ", ") + " és " + (words.last ?? "")
}

/// „Vádli, tricepsz" — a plain list without articles (the review card).
func evesPlainList(_ keys: [String]) -> String {
    guard let first = keys.first else { return "" }
    return ([evesMuscle(first)] + keys.dropFirst().map(evesMuscleLower)).joined(separator: ", ")
}

/// „FELSŐ" / „LÁB" / „LEZÁRÁS".
func evesKindText(_ b: WireYearBlock) -> String {
    switch b.kind {
    case "lower": "LÁB"
    case "consolidation": "LEZÁRÁS"
    default: "FELSŐ"
    }
}

// MARK: - Status

enum EvesStatus: Equatable {
    case done, running(week: Int?), next, planned, skipped

    init(_ b: WireYearBlock, plan: WireYearPlan) {
        switch b.status {
        case "done": self = .done
        case "running": self = .running(week: b.currentWeek)
        case "skipped": self = .skipped
        default: self = (b.id != nil && b.id == plan.next?.blockId) ? .next : .planned
        }
    }

    /// The row's pill: „kész" · „fut · 3. hét" · „következik" · „tervezett" · „kihagyva".
    var text: String {
        switch self {
        case .done: "kész"
        case .running(let w): w.map { "fut · \($0). hét" } ?? "fut"
        case .next: "következik"
        case .planned: "tervezett"
        case .skipped: "kihagyva"
        }
    }

    var isRunning: Bool { if case .running = self { true } else { false } }
    /// Running or done: the block is the server's history now, nothing on it can change.
    var isLocked: Bool { self == .done || isRunning }
}

// MARK: - Notes

/// A relaxation or a rule break in his words; nil for a code this phone does not know (and for `no_focus_this_year`,
/// which is a card of its own).
func evesNoteText(_ n: WireYearNote) -> String? {
    let muscle = n.group.map(evesMuscle)
    switch n.code {
    case "emphasis_once": return muscle.map { "\($0): csak egyszer tudtam fókuszba tenni." }
    case "no_focus": return muscle.map { "\($0) idén nem kap fókuszt." }
    case "pair_relaxed": return n.ordinal.map { "\(evesNumArticle($0).capitalized) \($0). blokkban szokatlan párt raktam össze, másképp nem jött ki." }
    case "focus_consecutive": return muscle.map { "\($0) két egymást követő blokkban is fókuszban van." }
    case "pair_unusual": return n.ordinal.map { "\(evesNumArticle($0).capitalized) \($0). blokk fókusza szokatlan pár." }
    case "mixed_focus": return n.ordinal.map { "\(evesNumArticle($0).capitalized) \($0). blokk fókusza felsőtest- és lábizmot is vegyít." }
    default: return nil
    }
}

/// `no_focus_this_year`: the card's title.
func evesNoFocusTitle(_ n: WireYearNote) -> String? { n.group.map { "\(evesMuscle($0)) idén nem kap fókuszt" } }

/// `no_focus_this_year`: the suggestion's button — „Áttehetem a 8. blokkba a bicepsz helyére"; nil without a suggestion.
func evesNoFocusAction(_ n: WireYearNote, plan: WireYearPlan) -> String? {
    guard let id = n.blockId, let target = plan.block(id) else { return nil }
    let into = "Áttehetem \(evesNumArticle(target.ordinal)) \(target.ordinal). blokkba"
    guard let r = n.replaces else { return into }
    return "\(into) \(evesArticle(evesMuscleLower(r))) \(evesMuscleLower(r)) helyére"
}

/// `no_focus_this_year`: the focus the suggested block gets — the group in place of `replaces`, or added as a second.
func evesNoFocusNewFocus(_ n: WireYearNote, plan: WireYearPlan) -> [String]? {
    guard let id = n.blockId, let target = plan.block(id), let g = n.group else { return nil }
    if let r = n.replaces { return target.focus.map { $0 == r ? g : $0 } }
    return Array((target.focus + [g]).prefix(2))
}

// MARK: - The map's lines

struct EvesLine: Equatable, Hashable {
    let tone: EvesTone
    let text: String
}

enum EvesTone: Equatable, Hashable { case good, neutral, warn }

/// What the year promises, from the server's facts: the focus counts, the consecutive rule (only while no block breaks
/// it), the closing weeks and the buffer, and what a delay did to the year.
func evesMapLines(_ plan: WireYearPlan) -> [EvesLine] {
    var out: [EvesLine] = []
    let counts = evesGroupOrder.map { ($0, plan.focusCount[$0] ?? 0) }
    let zero = counts.filter { $0.1 == 0 }.map(\.0)
    let once = counts.filter { $0.1 == 1 }.map(\.0)
    let more = counts.filter { $0.1 >= 2 }
    if !plan.focusCount.isEmpty {
        if zero.isEmpty {
            if once.isEmpty {
                out.append(EvesLine(tone: .good, text: "Idén minden izom legalább kétszer fókuszba kerül."))
            } else if more.isEmpty {
                out.append(EvesLine(tone: .good, text: "Idén minden izom egyszer fókuszba kerül."))
            } else {
                let rest = more.allSatisfy { $0.1 == 2 } ? "kétszer" : "legalább kétszer"
                out.append(EvesLine(tone: .good, text: "Idén minden izom legalább egyszer fókuszba kerül; \(evesList(once)) egyszer, a többi \(rest)."))
            }
        } else {
            let covered = Set(plan.warnings.filter { $0.code == "no_focus_this_year" }.compactMap(\.group))
            let left = zero.filter { !covered.contains($0) }
            if !left.isEmpty {
                let first = evesList(left)
                let sentence = first.prefix(1).uppercased() + first.dropFirst()
                out.append(EvesLine(tone: .neutral, text: "\(sentence) idén nem kap fókuszt, Tartáson marad."))
            }
        }
    }
    if !plan.warnings.contains(where: { $0.code == "focus_consecutive" }) {
        out.append(EvesLine(tone: .good, text: "Egy izom sosem kerül fókuszba két egymást követő blokkban."))
    }
    let consolidation = plan.blocks.last(where: \.isConsolidation)
    let c = consolidation?.weeks ?? plan.consolidationWeeks
    if plan.bufferWeeks > 0 {
        out.append(EvesLine(tone: .neutral, text: "A végén \(c) hét könnyű szinten tartás, előtte \(plan.bufferWeeks) tartalék hét betegségre, nyaralásra."))
    } else {
        out.append(EvesLine(tone: .neutral, text: "A végén \(c) hét könnyű szinten tartás."))
    }
    if let consolidation, consolidation.weeks < plan.consolidationWeeks {
        out.append(EvesLine(tone: .warn, text: "A lezárás \(consolidation.weeks) hétre rövidült."))
    }
    if plan.overrunWeeks > 0 {
        out.append(EvesLine(tone: .warn, text: "A csúszás miatt az év \(plan.overrunWeeks) héttel később ér véget."))
    }
    return out
}

/// The rule breaks an edit left behind (warn lines; `no_focus_this_year` is a card of its own).
func evesWarningLines(_ plan: WireYearPlan) -> [String] {
    var seen = Set<String>()
    return plan.warnings.compactMap(evesNoteText).filter { seen.insert($0).inserted }
}

/// The map head's sentence: what runs now and what comes next.
func evesHeadSentence(_ plan: WireYearPlan) -> String {
    var parts: [String] = []
    if let running = plan.blocks.first(where: { $0.status == "running" }) {
        if running.isConsolidation {
            parts.append("Most a lezárás fut: minden izom könnyű szinten tartáson.")
        } else {
            let t = evesFocusTitle(running)
            parts.append("Most \(evesArticle(t)) \(t) blokk fut.")
        }
    }
    if let next = plan.next, let b = plan.block(next.blockId) {
        let t = evesFocusTitle(b)
        parts.append(b.isConsolidation ? "Következik a lezárás, \(evesFrom(next.startsOn))." : "Következik \(evesArticle(t)) \(t), \(evesFrom(next.startsOn)).")
    }
    if parts.isEmpty, plan.currentWeek == nil, let first = plan.blocks.first {
        parts.append("Az év \(evesFrom(first.plannedStart)) indul.")
    }
    return parts.joined(separator: " ")
}

/// The map head's title: „9. hét az 52-ből"; before the start „Még nem indult".
func evesHeadTitle(_ plan: WireYearPlan) -> String {
    guard let w = plan.currentWeek else { return "Még nem indult" }
    let total = 52 + plan.overrunWeeks
    return "\(w). hét \(evesNumArticle(total)) \(total)-\(evesBolBol(total))"
}

/// The year-review card's numbers line: „7 blokk kész, 1 kihagyva".
func evesReviewLine(_ r: WireYearReview) -> String { "\(r.blocksDone) blokk kész, \(r.blocksSkipped) kihagyva" }

/// The year's last weeks: the consolidation is running (or the year is past its end) — the review card shows.
func evesInClosing(_ plan: WireYearPlan) -> Bool {
    plan.blocks.contains { $0.isConsolidation && ($0.status == "running" || $0.status == "done") }
}

// MARK: - Errors

/// A year-plan failure in his words.
func evesErrorText(_ error: PlanFetchError) -> String {
    switch error {
    case .conflict("TRAIN_YEAR_PLAN_ACTIVE_EXISTS"): "Már van éves terved. Előbb zárd le, vagy a végén készíts jövő évit."
    case .conflict("TRAIN_YEAR_BLOCK_LOCKED"): "Ez a blokk már fut vagy lezárult, ezért nem változhat."
    case .conflict("TRAIN_YEAR_NOTHING_TO_LINK"): "Most nincs futó blokk, amit hozzáköthetnék."
    case .notFound: "Ezt az éves tervet már nem találom."
    default: planErrorText(error)
    }
}

// MARK: - The strip

/// One week of the strip.
struct EvesStripWeek: Equatable {
    enum Kind: Equatable { case upper, lower, consolidation, empty }
    let kind: Kind
    /// Its height as a share of the half strip (0 for an empty week).
    let load: Double
    /// The block's last, light week: drawn hollow.
    let light: Bool
    /// Inside the running block.
    let running: Bool
}

/// The year as `52 + overrunWeeks` weeks [RF 4]: each week placed from the server's dates. A loading block climbs to
/// its last week, which is light; the consolidation is short marks; the buffer and anything unplaced are dots. Skipped
/// blocks take no weeks.
func evesStripWeeks(_ plan: WireYearPlan) -> [EvesStripWeek] {
    let total = max(1, 52 + max(0, plan.overrunWeeks))
    var weeks = [EvesStripWeek](repeating: EvesStripWeek(kind: .empty, load: 0, light: false, running: false), count: total)
    for b in plan.blocks where b.status != "skipped" {
        guard let first = evesWeek(of: b.plannedStart, start: plan.startDate), b.weeks > 0 else { continue }
        let kind: EvesStripWeek.Kind = b.isConsolidation ? .consolidation : (b.kind == "lower" ? .lower : .upper)
        for i in 1...b.weeks {
            let w = first + i - 1
            guard w >= 1, w <= total else { continue }
            let light = !b.isConsolidation && i == b.weeks && b.weeks > 1
            let load: Double
            if b.isConsolidation { load = 0.28 }
            else if light { load = 0.42 }
            else {
                let ramp = max(1, b.weeks - 2)
                load = 0.5 + 0.45 * Double(i - 1) / Double(ramp)
            }
            weeks[w - 1] = EvesStripWeek(kind: kind, load: min(load, 0.95), light: light, running: b.status == "running")
        }
    }
    return weeks
}
