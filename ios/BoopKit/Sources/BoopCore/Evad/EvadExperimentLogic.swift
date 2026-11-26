import Foundation

// Pure copy for the Hatás tab and the experiment result page (Boop B6 Évad S4, `mezo-r36n9.16`, spec §5.9). Every
// number and every verdict is the server's; this only says them in his words. The rules of honesty: always day counts,
// never a single percentage; a clear change only where the server says it is beyond his day-to-day variation, and a
// worse direction said as plainly as a better one; „Ez a te napjaidból látszik, de nem bizonyíték." on every result.

/// The compared signals in the order the page lists them.
public let evadSignalOrder = ["sleep_min", "deep_min", "hrv_ms", "resting_hr", "energy", "mood", "morning_feel"]

/// The row label: „Alvás", „Mély alvás" …
public func evadSignalLabel(_ key: String) -> String {
    switch key {
    case "sleep_min": "Alvás"
    case "deep_min": "Mély alvás"
    case "hrv_ms": "Pulzus-variabilitás"
    case "resting_hr": "Nyugalmi pulzus"
    case "energy": "Energia"
    case "mood": "Hangulat"
    case "morning_feel": "Reggeli közérzet"
    default: key
    }
}

/// "6,1" — one decimal with the Hungarian comma.
func evadDecimal(_ v: Double) -> String {
    String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
}

/// "6 ó 50 p" / "58 p".
func evadMinutesText(_ minutes: Int) -> String {
    minutes < 60 ? "\(minutes) p" : evadHM(minutes)
}

/// A signal's value in its own unit: sleep → „6 ó 50 p", deep sleep always in minutes („71 p", as the spike), HRV → „41 ms", resting HR → „54", the
/// check-in scores → „6,1".
public func evadSignalValue(_ key: String, _ v: Double) -> String {
    switch key {
    case "sleep_min": evadMinutesText(Int(v.rounded()))
    case "deep_min": "\(Int(v.rounded())) p"
    case "hrv_ms": "\(Int(v.rounded())) ms"
    case "resting_hr": "\(Int(v.rounded()))"
    default: evadDecimal(v)
    }
}

/// A change in the signal's unit with its sign: „+22 p", „–1 ó 5 p", „+2 ms", „–1", „+0,7".
public func evadSignalDelta(_ key: String, before: Double, after: Double) -> String {
    let d = after - before
    let sign = d < 0 ? "–" : "+"
    switch key {
    case "sleep_min", "deep_min":
        let m = abs(Int(after.rounded()) - Int(before.rounded()))
        return sign + (key == "deep_min" ? "\(m) p" : evadMinutesText(m))
    case "hrv_ms": return sign + "\(abs(Int(after.rounded()) - Int(before.rounded()))) ms"
    case "resting_hr": return sign + "\(abs(Int(after.rounded()) - Int(before.rounded())))"
    default: return sign + evadDecimal(abs(d))
    }
}

/// One line of the Előtte és utána table.
public struct EvadSignalRow: Equatable, Sendable {
    public let key: String
    public let label: String, before: String, after: String
    /// 1 the after column is the better (a clear good change), -1 the before (a clear bad one), 0 neither — always 0
    /// unless the result's verdict is „clear".
    public let favours: Int
}

/// The compared rows: only signals with both a before and an after, in the page's order.
public func evadSignalRows(_ r: EvadExperimentResult) -> [EvadSignalRow] {
    evadOrdered(r.signals).compactMap { s in
        guard let b = s.before, let a = s.after else { return nil }
        // only a clear verdict lights a column: a signal flagged clear under an insufficient (or none) verdict is not
        // evidence of anything
        let favours = r.verdict == "clear" && s.clear ? (s.better == false ? -1 : 1) : 0
        return EvadSignalRow(key: s.key, label: evadSignalLabel(s.key), before: evadSignalValue(s.key, b),
                             after: evadSignalValue(s.key, a), favours: favours)
    }
}

func evadOrdered(_ signals: [EvadExperimentSignal]) -> [EvadExperimentSignal] {
    signals.sorted { (evadSignalOrder.firstIndex(of: $0.key) ?? 99) < (evadSignalOrder.firstIndex(of: $1.key) ?? 99) }
}

/// The clear signals with both values (the ones the verdict may speak of), good ones first.
func evadClearSignals(_ r: EvadExperimentResult) -> [EvadExperimentSignal] {
    let clear = evadOrdered(r.signals).filter { $0.clear && $0.before != nil && $0.after != nil }
    return clear.filter { $0.better != false } + clear.filter { $0.better == false }
}

/// What the change is, in one phrase, for a clear signal: (better, worse).
func evadChangePhrase(_ key: String, better: Bool) -> String {
    let pair: (String, String) = switch key {
    case "sleep_min": ("Többet alszol", "Kevesebbet alszol")
    case "deep_min": ("Több a mélyalvásod", "Kevesebb a mélyalvásod")
    case "hrv_ms": ("Nőtt a pulzus-variabilitásod", "Csökkent a pulzus-variabilitásod")
    case "resting_hr": ("Lejjebb ment a nyugalmi pulzusod", "Feljebb ment a nyugalmi pulzusod")
    case "energy": ("Több energiád van", "Kevesebb energiád van")
    case "mood": ("Jobb a hangulatod", "Rosszabb a hangulatod")
    case "morning_feel": ("Jobban érzed magad reggelente", "Rosszabbul érzed magad reggelente")
    default: ("Változott: \(evadSignalLabel(key).lowercased())", "Változott: \(evadSignalLabel(key).lowercased())")
    }
    return better ? pair.0 : pair.1
}

/// The signal as a noun with its article, for lists: „az alvásod hossza", „a mélyalvás" …
func evadSignalNoun(_ key: String) -> String {
    switch key {
    case "sleep_min": "az alvásod hossza"
    case "deep_min": "a mélyalvás"
    case "hrv_ms": "a pulzus-variabilitás"
    case "resting_hr": "a nyugalmi pulzus"
    case "energy": "az energiád"
    case "mood": "a hangulatod"
    case "morning_feel": "a reggeli közérzeted"
    default: evadSignalLabel(key).lowercased()
    }
}

/// The signal as an object („vetem össze"): „az alvásodat" …
func evadSignalObject(_ key: String) -> String {
    switch key {
    case "sleep_min": "az alvásodat"
    case "deep_min": "a mélyalvásodat"
    case "hrv_ms": "a pulzus-variabilitásodat"
    case "resting_hr": "a nyugalmi pulzusodat"
    case "energy": "az energiádat"
    case "mood": "a hangulatodat"
    case "morning_feel": "a reggeli közérzetedet"
    default: evadSignalLabel(key).lowercased()
    }
}

/// What is watched, as a clause („mennyit alszol").
func evadSignalClause(_ key: String) -> String {
    switch key {
    case "sleep_min": "mennyit alszol"
    case "deep_min": "mennyi a mélyalvásod"
    case "hrv_ms": "hogyan alakul a pulzus-variabilitásod"
    case "resting_hr": "hogyan alakul a nyugalmi pulzusod"
    case "energy": "mennyi energiád van"
    case "mood": "milyen a hangulatod"
    case "morning_feel": "hogy érzed magad reggel"
    default: evadSignalLabel(key).lowercased()
    }
}

/// "a, b és c".
func evadJoin(_ parts: [String]) -> String {
    switch parts.count {
    case 0: ""
    case 1: parts[0]
    default: parts.dropLast().joined(separator: ", ") + " és " + parts.last!
    }
}

func evadCapitalized(_ s: String) -> String { s.prefix(1).uppercased() + s.dropFirst() }

/// The window in words: „két hét", „egy hét" … or „10 nap".
public func evadWindowText(_ days: Int) -> String {
    switch days {
    case 7: "egy hét"
    case 14: "két hét"
    case 21: "három hét"
    case 28: "négy hét"
    default: "\(days) nap"
    }
}

/// „az előző két héttel" / „az előző 10 nappal".
func evadWindowWith(_ days: Int) -> String {
    switch days {
    case 7: "az előző héttel"
    case 14: "az előző két héttel"
    case 21: "az előző három héttel"
    case 28: "az előző négy héttel"
    default: "az előző \(days) nappal"
    }
}

/// „A két hét alatt" / „A 10 nap alatt".
func evadWindowDuring(_ days: Int) -> String { "A \(evadWindowText(days)) alatt" }

// MARK: - The verdict

private let evadClearTail = ", és a különbség nagyobb annál, amennyit magától is ingadozni szokott."

/// The result page's sentence (with the kit's *emphasis*): clear → the clear signal's own sentence, none → „nem hozott
/// érezhető változást", insufficient → „túl kevés nap, nem lehet megítélni".
public func evadVerdictSentence(_ e: EvadExperiment) -> String {
    guard let r = e.result else { return "" }
    switch r.verdict {
    case "clear":
        if let s = evadClearSignals(r).first {
            return "*\(evadChangePhrase(s.key, better: s.better != false))*" + evadClearTail
        }
        return "*Nem hozott érezhető változást*: semmi nem mozdult el jobban, mint ahogy magától is ingadozni szokott."
    case "insufficient":
        return "*Túl kevés nap*, nem lehet megítélni: \(r.markedCount) napot pipáltál ki, az eredményhez legalább \(e.needDays) kellett volna."
    default:
        return "*Nem hozott érezhető változást*: semmi nem mozdult el jobban, mint ahogy magától is ingadozni szokott."
    }
}

/// The short verdict of a past row: „többet alszol, és ez nem véletlen", „nem hozott érezhető változást", „túl kevés
/// nap, nem lehet megítélni".
public func evadShortVerdict(_ e: EvadExperiment) -> String {
    guard let r = e.result else { return "nincs még eredmény" }
    switch r.verdict {
    case "clear":
        if let s = evadClearSignals(r).first {
            let p = evadChangePhrase(s.key, better: s.better != false)
            return p.prefix(1).lowercased() + p.dropFirst() + ", és ez nem véletlen"
        }
        return "nem hozott érezhető változást"
    case "insufficient": return "túl kevés nap, nem lehet megítélni"
    default: return "nem hozott érezhető változást"
    }
}

/// A past row's sub: „14 nap · <short verdict>".
public func evadPastSub(_ e: EvadExperiment) -> String { "\(e.lengthDays) nap · \(evadShortVerdict(e))" }

/// A past row's number: the first clear change („+22 p", with the signal under it), else „–".
public func evadPastValue(_ e: EvadExperiment) -> (value: String, sub: String) {
    guard let r = e.result, r.verdict == "clear", let s = evadClearSignals(r).first,
          let b = s.before, let a = s.after else { return ("–", "") }
    return (evadSignalDelta(s.key, before: b, after: a), evadSignalLabel(s.key).lowercased())
}

/// The compare block's trailing day counts: the baseline window's days · the marked days.
public func evadCompareDays(_ e: EvadExperiment) -> String {
    guard let r = e.result else { return "" }
    let before = evadDaysBetween(r.baselineFrom, r.baselineTo).map { $0 + 1 } ?? e.lengthDays
    return "\(before) nap · \(r.markedCount) nap"
}

/// Whole days from `a` to `b` (`yyyy-MM-dd`); nil when either does not read.
func evadDaysBetween(_ a: String, _ b: String) -> Int? {
    var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
    func d(_ s: String) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }
    guard let x = d(a), let y = d(b) else { return nil }
    return cal.dateComponents([.day], from: x, to: y).day
}

/// „Mit jelent ez?": what really changed (omitted when nothing did), what did not change enough, and what to keep in
/// mind — always „nem bizonyíték", plus the overlaps (or that nothing else changed).
public func evadMeaning(_ e: EvadExperiment) -> [(title: String, body: String)] {
    guard let r = e.result else { return [] }
    var out: [(title: String, body: String)] = []
    let withBoth = evadOrdered(r.signals).filter { $0.before != nil && $0.after != nil }
    if r.verdict == "insufficient" {
        out.append(("Miért nem lehet megítélni",
                    "\(e.lengthDays) napból \(r.markedCount) napot pipáltál ki. Az eredményhez legalább \(e.needDays) kellett volna, különben a véletlen is kijöhetne változásnak."))
    } else {
        let clear = evadClearSignals(r)
        if !clear.isEmpty {
            let better = clear.filter { $0.better != false }, worse = clear.filter { $0.better == false }
            var body = evadCapitalized(evadJoin(clear.map { evadSignalNoun($0.key) })) + "."
            if !worse.isEmpty && !better.isEmpty {
                body += " " + evadCapitalized(evadJoin(worse.map { evadSignalNoun($0.key) })) + " rosszabb irányba mozdult."
            } else if !worse.isEmpty {
                body += " Rosszabb irányba."
            }
            body += " Ez nagyobb változás, mint ami magától is előfordul nálad."
            out.append(("Ami tényleg változott", body))
        }
        let calm = withBoth.filter { !$0.clear }
        if !calm.isEmpty {
            out.append(("Ami nem változott érdemben",
                        evadCapitalized(evadJoin(calm.map { evadSignalNoun($0.key) })) + ". Ennyi nap alapján ez lehet véletlen is."))
        }
    }
    out.append(("Mire figyelj", "Ez a te napjaidból látszik, de nem bizonyíték. " + evadOverlapSentence(e)))
    return out
}

/// The overlaps in one or two sentences, or that nothing else changed in the window.
public func evadOverlapSentence(_ e: EvadExperiment) -> String {
    guard !e.overlaps.isEmpty else {
        return "\(evadWindowDuring(e.lengthDays)) más nem változott: nem volt új mezociklus, kímélő időszak vagy évadmódosítás."
    }
    let lines = e.overlaps.map { o -> String in
        let t = o.text.trimmingCharacters(in: .whitespaces)
        return t.hasSuffix(".") ? t : t + "."
    }
    return lines.joined(separator: " ") + " Emiatt az eredmény kevésbé biztos."
}

// MARK: - The running card and the proposal

/// „Ezt figyelem: … Eddig X napot pipáltál ki, az eredményhez legalább N kell."
public func evadRunningLine(_ e: EvadExperiment) -> String {
    let marked = "Eddig \(e.markedDays.count) napot pipáltál ki, az eredményhez legalább \(e.needDays) kell."
    let watched = evadOrderedKeys(e.watched)
    guard !watched.isEmpty else { return marked }
    return "Ezt figyelem: \(evadJoin(watched.map(evadSignalClause))). " + marked
}

func evadOrderedKeys(_ keys: [String]) -> [String] {
    keys.sorted { (evadSignalOrder.firstIndex(of: $0) ?? 99) < (evadSignalOrder.firstIndex(of: $1) ?? 99) }
}

/// „9 / 14 nap".
public func evadDayCount(_ e: EvadExperiment) -> String { "\(e.dayIndex ?? 0) / \(e.lengthDays) nap" }

/// The running bar's level: how far into the window today is.
public func evadRunningLevel(_ e: EvadExperiment) -> Double {
    guard e.lengthDays > 0 else { return 0 }
    return min(1, max(0, Double(e.dayIndex ?? 0) / Double(e.lengthDays)))
}

/// What a proposal compares: „Az alvásodat, a pulzusodat … vetem össze az előző két héttel."
public func evadCompareSentence(_ e: EvadExperiment) -> String {
    let watched = evadOrderedKeys(e.watched)
    guard !watched.isEmpty else { return "A napjaidat vetem össze \(evadWindowWith(e.lengthDays))." }
    return evadCapitalized(evadJoin(watched.map(evadSignalObject))) + " vetem össze \(evadWindowWith(e.lengthDays))."
}

/// The proposal highlight's sentence: the reason, then the question.
public func evadProposalText(_ e: EvadExperiment) -> String {
    let q = "Megnézzük \(evadWindowText(e.lengthDays)) alatt, hat-e rád?"
    guard let reason = e.reason?.trimmingCharacters(in: .whitespaces), !reason.isEmpty else { return e.title + ": " + q.prefix(1).lowercased() + q.dropFirst() }
    return reason + " " + q
}

/// The running card's day chips: the window's days so far — from the start date to today (or to the end date once the
/// window is over), the last `limit` of them. Empty before the start or without dates. The server accepts a tick on any
/// of these (`[start, min(end, today)]`).
public func evadMarkDates(_ e: EvadExperiment, today: String, limit: Int = 7) -> [String] {
    guard let start = e.startDate, let end = e.endDate else { return [] }
    let last = min(end, today)   // ISO dates compare as strings
    guard let span = evadDaysBetween(start, last), span >= 0 else { return [] }
    let from = max(0, span - (limit - 1))
    return (from ... span).map { evadAddDays(start, $0) }
}

/// The chip's weekday: „H", „K", „Sze", „Cs", „P", „Szo", „V".
public func evadWeekdayLetter(_ iso: String) -> String {
    let letters = ["H", "K", "Sze", "Cs", "P", "Szo", "V"]
    let names = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"]
    guard let i = names.firstIndex(of: evadDayName(iso)) else { return "" }
    return letters[i]
}

/// The chip's spoken label: „Ma, péntek, nov. 20., kipipálva" / „Szerda, nov. 18., nincs kipipálva".
public func evadMarkDayLabel(_ iso: String, marked: Bool, today: String) -> String {
    let day = evadDayName(iso)
    let name = iso == today ? "Ma, " + day.lowercased() : day
    return "\(name), \(evadShortDate(iso)), " + (marked ? "kipipálva" : "nincs kipipálva")
}

/// Whether today (`yyyy-MM-dd`) is ticked on the running experiment.
public func evadMarkedToday(_ e: EvadExperiment, today: String) -> Bool { e.markedDays.contains(today) }

/// The kit glyph of an experiment's subject.
public func evadSubjectGlyph(_ kind: String) -> String {
    switch kind {
    case "supplement": "leaf-sage"
    case "recipe": "book-sage"
    case "food": "bowl-sage"
    case "text": "pen-sun"
    default: "check-sage"
    }
}

/// "2026-11-21" in the phone's calendar.
public func evadToday(_ now: Date, calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: now)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}
