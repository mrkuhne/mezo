import BoopAPI
import Foundation

// Day capacity wording and row builders (B7 K2, `mezo-r36n9.17`) — pure functions over the wire.
//
// Every label and figure comes from the server verbatim (no invented number); what is done here is only wording:
// the verdict word, the learning line, and plain row models the Ma page maps onto its own row view.

/// A row of the capacity card, UI-framework-free (BoopCore does not depend on BoopDesign).
public struct KapacitasRow: Equatable, Sendable {
    public var title: String
    public var sub: String
    public var value: String
    public var hot: Bool
    public var glyph: String
    public var eventKey: String?
    /// His own label of the event, as the server stored it (nil = unlabelled, or not an event).
    public var effect: KapacitasEffect?

    public init(title: String, sub: String, value: String, hot: Bool, glyph: String, eventKey: String? = nil,
                effect: KapacitasEffect? = nil) {
        self.title = title
        self.sub = sub
        self.value = value
        self.hot = hot
        self.glyph = glyph
        self.eventKey = eventKey
        self.effect = effect
    }

    /// The row's value sub when he labelled the event: „te: merít / semleges / feltölt"; empty otherwise.
    public var labelSub: String { effect.map { "te: \($0.label.lowercased())" } ?? "" }
}

/// The verdict as the owner reads it: the headline word, the server's reason (plus „naptár nélkül" when the
/// calendar was unknown) and, while the model is still learning him, the learning line.
public func verdictLine(_ c: Components.Schemas.BoopCapacity) -> (word: String, reason: String, learning: String?) {
    let word: String
    switch c.verdict {
    case .laza: word = "Laza nap"
    case .rendben: word = "Rendben lesz"
    case .szoros: word = "Szoros, de belefér"
    case .tulSok: word = "Túl sok lenne"
    }
    let given = c.reason.trimmingCharacters(in: .whitespacesAndNewlines)
    let reason = c.calendarKnown ? c.reason : (given.isEmpty ? "naptár nélkül" : c.reason + " · naptár nélkül")
    let learning = c.tanulo ? "Még tanulom, mennyit bírsz: \(c.labelledDays) napnyi adatom van." : nil
    return (word, reason, learning)
}

private func kindWord(_ kind: String) -> String {
    switch kind {
    case "meeting": "megbeszélés"
    case "call": "hívás"
    case "focus": "fókusz"
    case "social": "emberek közt"
    case "training": "edzés"   // the server's kind for a gym / sport session (DemandCalculator.training)
    case "sport": "fizikai"
    case "travel": "út"
    case "errand": "ügyintézés"
    case "medical": "orvos"
    default: "program"
    }
}

private func levelWord(_ level: Components.Schemas.BoopCapacityDemandItem.levelPayload) -> String {
    switch level {
    case .kicsi: "kicsi"
    case .kozepes: "közepes"
    case .nagy: "nagy"
    case .tolt: "tölt"
    }
}

/// One row per demanding event: `HH:mm · <kind>` under the server's label, the level on the right.
public func demandRows(_ c: Components.Schemas.BoopCapacity, timeZone: TimeZone = .current) -> [KapacitasRow] {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = timeZone
    return c.demand.map { d in
        let comps = cal.dateComponents([.hour, .minute], from: d.start)
        let time = String(format: "%02d:%02d", comps.hour ?? 0, comps.minute ?? 0)
        let glyph: String
        if d.level == .tolt {
            glyph = "heart-cream"
        } else {
            switch d.kind {
            case "sport", "training": glyph = "dumbbell-ink"
            case "social": glyph = "person-sage"
            default: glyph = "clock-ink"
            }
        }
        return KapacitasRow(title: d.label, sub: "\(time) · \(kindWord(d.kind))", value: levelWord(d.level),
                            hot: d.level == .nagy, glyph: glyph, eventKey: d.eventKey,
                            effect: d.effect.flatMap { KapacitasEffect(rawValue: $0.rawValue) })
    }
}

/// One row per body factor: the server's label and value, the effect as a word.
public func factorRows(_ c: Components.Schemas.BoopCapacity) -> [KapacitasRow] {
    c.factors.map { f in
        let value: String
        switch f.effect {
        case .jo: value = "jó"
        case .semleges: value = "rendben"
        case .rossz: value = "gyenge"
        }
        let glyph: String
        switch f.key {
        case "sleep": glyph = "moon-ink"
        case "rhr", "hrv": glyph = "heart-cream"
        case "yesterday": glyph = "dumbbell-ink"
        case "fuel": glyph = "bowl-sage"
        case "checkin": glyph = "spark-cream"
        case "recovery": glyph = "leaf-sage"
        default: glyph = "clock-ink"
        }
        return KapacitasRow(title: f.label, sub: f.value, value: value, hot: f.effect == .rossz, glyph: glyph)
    }
}

/// The *Mennyit bírsz ma* bar's fill: the load ratio clamped to 0…1.2 and scaled so 1.2 fills the bar
/// (the „szoros" tick sits at 0.9 / 1.2, „határ" at 1.0 / 1.2).
public func capacityLevel(_ ratio: Double) -> Double {
    min(1.2, max(0, ratio.isFinite ? ratio : 0)) / 1.2
}

/// The bar's landmarks as fractions of the bar (see `capacityLevel`).
public let capacityTicks: [(at: Double, label: String)] = [(0.9 / 1.2, "szoros"), (1.0 / 1.2, "határ")]

/// The one sentence under the bar — words only, from the verdict (no number of its own).
public func capacitySentence(_ verdict: Components.Schemas.BoopCapacity.verdictPayload) -> String {
    switch verdict {
    case .laza: "A mai terhed jóval kevesebb annál, amennyit bírsz. Van benne mozgástér."
    case .rendben: "A mai terhed belefér abba, amennyit bírsz."
    case .szoros: "A mai terhed majdnem annyi, amennyit bírsz. Ha még valami bejön, estére elfogysz."
    case .tulSok: "A mai terhed több annál, amennyit bírsz. Valamit érdemes lenne könnyíteni rajta."
    }
}

/// A figure of the Évad *Mennyit bírsz az évadban* row, UI-framework-free.
public struct KapacitasSeasonStat: Equatable, Sendable {
    public var value: String
    public var target: String?
    public var label: String
    public var hot: Bool

    public init(value: String, target: String? = nil, label: String, hot: Bool = false) {
        self.value = value; self.target = target; self.label = label; self.hot = hot
    }
}

/// The season stats as the row shows them: the overloaded-days count always; the two move figures only once he has
/// accepted a move (a „0 mozgatás" / „0 / 0 sült el jól" says nothing).
public func kapacitasSeasonStats(_ s: KapacitasSeasonStats) -> [KapacitasSeasonStat] {
    var out = [KapacitasSeasonStat(value: "\(s.overloadedDays4w)", label: "túl sok nap az elmúlt 4 hétben")]
    if s.moves > 0 {
        out.append(KapacitasSeasonStat(value: "\(s.moves)", label: "mozgatás az évadban", hot: true))
        out.append(KapacitasSeasonStat(value: "\(s.movesGood)", target: "\(s.moves)", label: "sült el jól"))
    }
    return out
}

/// The Hungarian definite article before a numeral, capitalised for a sentence start: „Az" when the spoken numeral
/// starts with a vowel — egy (1), öt (5), ötven (50–59), ötszáz (500–599), ezer (1000–1999), egymillió … — „A"
/// otherwise (tíz, tizenegy, száz, kétezer …). Ordinals follow the same sound: „Az 1. hét" (első), „A 10. hét" (tizedik).
public func hungarianArticle(_ n: Int) -> String {
    var v = abs(n)
    while true {
        if v >= 1_000_000 {
            let m = v / 1_000_000
            if m == 1 { return "Az" }   // egymillió
            v = m
        } else if v >= 1000 {
            let t = v / 1000
            if t == 1 { return "Az" }   // ezer
            v = t
        } else if v >= 100 {
            return v / 100 == 5 ? "Az" : "A"   // ötszáz; száz, kétszáz …
        } else if v >= 10 {
            return v / 10 == 5 ? "Az" : "A"    // ötven; tíz, húsz …
        } else {
            return v == 1 || v == 5 ? "Az" : "A"
        }
    }
}

/// The footnote under the Évad *Teher és pihenés* chart: what the load and the recovery are made of, and that the
/// weeks after the current one are the plan, drawn faint, counting only the training.
public func evadLoadFootnote(nowWeek: Int) -> String {
    "A teher az edzés és a naptárad együtt. A pihenés az alvásodból és a pulzusodból jön. "
        + "\(hungarianArticle(nowWeek)) \(nowWeek). hét után a terv, halványan: csak az edzés."
}

// MARK: - The Átrendezés week (B7 K3)

private var utcGregorian: Calendar {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "UTC")!
    return c
}

private func ymdDate(_ ymd: String) -> Date? {
    let p = ymd.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return nil }
    return utcGregorian.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
}

private func ymdString(_ d: Date) -> String {
    let c = utcGregorian.dateComponents([.year, .month, .day], from: d)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

private func addDays(_ ymd: String, _ n: Int) -> String? {
    ymdDate(ymd).flatMap { utcGregorian.date(byAdding: .day, value: n, to: $0) }.map(ymdString)
}

/// The Monday of the week (Monday–Sunday) a calendar day falls in.
public func kapacitasMonday(of ymd: String) -> String {
    guard let d = ymdDate(ymd) else { return ymd }
    let weekday = utcGregorian.component(.weekday, from: d)   // 1 = Sunday
    return addDays(ymd, -((weekday + 5) % 7)) ?? ymd
}

/// The Monday of the week holding `date`, in the phone's zone. Always the Gregorian calendar: the phone's own
/// calendar may be Buddhist or Japanese, whose year would make a wrong `yyyy-MM-dd`.
public func kapacitasMonday(for date: Date, timeZone: TimeZone = .current) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return kapacitasMonday(of: String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0))
}

public func kapacitasNextMonday(after monday: String) -> String { addDays(monday, 7) ?? monday }

private let shortMonths = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]

/// „nov. 24–30." — or „nov. 30. – dec. 6." across a month.
public func kapacitasWeekLabel(monday: String) -> String {
    guard let start = ymdDate(monday), let end = utcGregorian.date(byAdding: .day, value: 6, to: start) else { return "" }
    let a = utcGregorian.dateComponents([.month, .day], from: start), b = utcGregorian.dateComponents([.month, .day], from: end)
    let ma = shortMonths[(a.month ?? 1) - 1], mb = shortMonths[(b.month ?? 1) - 1]
    if a.month == b.month { return "\(ma) \(a.day ?? 0)–\(b.day ?? 0)." }
    return "\(ma) \(a.day ?? 0). – \(mb) \(b.day ?? 0)."
}

private let weekdayNames = ["hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat", "vasárnap"]
private let weekdayShort = ["H", "K", "Sz", "Cs", "P", "Sz", "V"]

/// 0 = Monday … 6 = Sunday.
private func weekdayIndex(_ ymd: String) -> Int? {
    ymdDate(ymd).map { (utcGregorian.component(.weekday, from: $0) + 5) % 7 }
}

/// „nov. 26." of a day.
public func kapacitasDayLabel(_ ymd: String) -> String {
    guard let d = ymdDate(ymd) else { return ymd }
    let c = utcGregorian.dateComponents([.month, .day], from: d)
    return "\(shortMonths[(c.month ?? 1) - 1]) \(c.day ?? 0)."
}

/// One column of the week strip, UI-framework-free: the server's word and ratio, nothing computed.
public struct KapacitasStripDay: Equatable, Sendable {
    public let weekday: String, date: String, ratio: Double, word: String
}

public func kapacitasStripDays(_ w: KapacitasWeek) -> [KapacitasStripDay] {
    w.days.map { d in
        let day = ymdDate(d.date).map { utcGregorian.component(.day, from: $0) } ?? 0
        return KapacitasStripDay(weekday: weekdayIndex(d.date).map { weekdayShort[$0] } ?? "", date: "\(day).",
                                 ratio: d.ratio.isFinite ? max(0, d.ratio) : 0, word: d.label)
    }
}

private func verdictRank(_ v: String) -> Int {
    switch v { case "tulSok": 3; case "szoros": 2; case "rendben": 1; default: 0 }
}

/// The week's hardest day (the strip lights it): the worst verdict, the highest ratio among equals.
public func kapacitasHardestDay(_ w: KapacitasWeek) -> Int? {
    w.days.indices.max { a, b in
        let x = w.days[a], y = w.days[b]
        return (verdictRank(x.verdict), x.ratio) < (verdictRank(y.verdict), y.ratio)
    }
}

private let countWords = ["", "Egy", "Két", "Három", "Négy", "Öt", "Hat", "Hét", "Nyolc", "Kilenc", "Tíz"]

/// The page head: the hardest day as the title, the open proposals in a sentence.
public func kapacitasHead(_ w: KapacitasWeek, open: Int) -> (title: String, sentence: String) {
    let title: String
    if let i = kapacitasHardestDay(w), let wd = weekdayIndex(w.days[i].date) {
        switch w.days[i].verdict {
        case "tulSok": title = "A \(weekdayNames[wd]) túl sok lenne"
        case "szoros": title = "A \(weekdayNames[wd]) szoros lesz"
        default: title = "Belefér a heted"
        }
    } else {
        title = "A heted"
    }
    guard open > 0 else { return (title, "Ezen a héten nincs mit átrendezni.") }
    let n = open < countWords.count ? countWords[open] : "\(open)"
    return (title, "\(n) dolgot tennék át ezen a héten. Amíg jóvá nem hagyod, semmi sem mozdul, és az *Évad terve* sem változik.")
}

private let sessionKinds: Set<String> = ["MOVE_SESSION_DAY", "SHIFT_SESSION_TIME", "SHORTEN_SESSION", "LIGHTEN_SESSION",
                                         "SWAP_SESSION_KIND", "SKIP_SESSION"]

/// The card's mono label and glyph, by what the bundle touches.
public func kapacitasKind(_ p: KapacitasProposal) -> (label: String, word: String, glyph: String) {
    let kinds = Set([p.kind] + p.steps.map(\.kind))
    if kinds.contains("CALENDAR_TODO") { return ("NAPTÁR · TEENDŐ", "naptár", "clock-ink") }
    let sleep = kinds.contains("SHIFT_BEDTIME"), session = !kinds.isDisjoint(with: sessionKinds)
    if sleep && session { return ("ALVÁS + EDZÉS", "alvás és edzés", "moon-ink") }
    if sleep { return ("ALVÁS", "alvás", "moon-ink") }
    if kinds.contains("MOVE_MEAL_ENERGY") { return ("ÉTEL", "étel", "bowl-sage") }
    return ("EDZÉS", "edzés", "dumbbell-ink")
}

/// A glyph and a heading for one of the server's effect lines, by what it talks about — decoration only, the words
/// stay the server's.
public func kapacitasLineTopic(_ line: String) -> (glyph: String, topic: String) {
    let l = line.lowercased()
    func has(_ words: [String]) -> Bool { words.contains { l.contains($0) } }
    if has(["naptár"]) { return ("link-deep", "Naptár") }
    if has(["kcal", "kalória", "ebéd", "vacsora", "uzsonna", "reggeli", "keret", "étel", "evés"]) { return ("bowl-sage", "Étel") }
    if has(["alv", "lefekv", "éjszak", "fekü"]) { return ("moon-ink", "Alvás") }
    if has(["évad", "súlycél", "heti "]) { return ("check-ink", "Évad") }
    if has(["röpi", "röplabda", "sport"]) { return ("ball-sun", "Sport") }
    if has(["edzés", "lábnap", "hátedzés", "pihenőnap", "blokk"]) { return ("dumbbell-ink", "Edzés") }
    if has(["terh", "túl sok", "szoros", "laza", "rendben", "enyhül"]) { return ("bolt-ink", "Terhelés") }
    return ("check-ink", "Hatás")
}

/// A *Korábban áttettük* row: one per accepted bundle of the week whose card is not on the page. K3 shows the state
/// only; the outcome words come with K4.
public struct KapacitasHistoryRow: Equatable, Sendable {
    public let id: String, glyph: String, title: String, sub: String, value: String
    /// done = behind him, gone = taken back or lapsed, live = still to come.
    public let state: String
}

public func kapacitasHistory(_ w: KapacitasWeek, shown: Set<String>) -> [KapacitasHistoryRow] {
    var seen = Set<String>()
    var rows: [KapacitasHistoryRow] = []
    for a in w.adjustments.sorted(by: { $0.date < $1.date }) where !seen.contains(a.bundleId) {
        seen.insert(a.bundleId)
        if let pid = a.proposalId, shown.contains(pid) { continue }
        let p = a.proposalId.flatMap { id in w.proposals.first { $0.id == id } }
        let bundle = w.adjustments.filter { $0.bundleId == a.bundleId }
        // the bundle's state: any waiting / active step keeps it live
        let states = Set(bundle.map(\.state))
        let state: String
        let value: String
        if states.contains("waiting") { state = "live"; value = "vár a naptárra" }
        else if states.contains("active") { state = "live"; value = "érvényben" }
        else if states.contains("done") { state = "done"; value = "megtörtént" }
        else if states.contains("undone") { state = "gone"; value = "visszavontad" }
        else { state = "gone"; value = "lejárt" }
        let kind = p.map(kapacitasKind) ?? kapacitasKind(KapacitasProposal(id: "", kind: a.kind, day: nil, status: "",
                                                                          title: "", move: "", effectLines: [], why: [], effects: []))
        rows.append(KapacitasHistoryRow(id: a.bundleId, glyph: kind.glyph, title: p?.title ?? kind.word.capitalized,
                                        sub: kapacitasDayLabel(a.date), value: value, state: state))
    }
    return rows
}

// MARK: - Ha jóváhagyod, itt látod (K3 fix round 1)

private let weekdayOn = ["hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton", "vasárnap"]

private func on(_ ymd: String?) -> String? { ymd.flatMap(weekdayIndex).map { weekdayOn[$0] } }
private func dayName(_ ymd: String?) -> String? { ymd.flatMap(weekdayIndex).map { weekdayNames[$0] } }
private func cap(_ s: String) -> String { s.prefix(1).uppercased() + s.dropFirst() }

/// „23:15" from the payload's „23:15" / „23:15:00" (the server's clock value, never computed here).
private func clock(_ t: String?) -> String? {
    guard let t, !t.isEmpty else { return nil }
    let parts = t.split(separator: ":")
    guard parts.count >= 2, let h = Int(parts[0]) else { return t }
    return "\(h):\(parts[1])"
}

/// The sublative suffix after a clock time, as it is read aloud: „23:15-re" (tizenöt), „22:30-ra" (harminc),
/// „18:00-ra", „21:40-re" (negyven).
func clockSublative(_ t: String) -> String {
    let m = t.split(separator: ":").last.flatMap { Int($0) } ?? 0
    let front = m % 10 != 0 || [10, 40, 50].contains(m)
    return t + (front ? "-re" : "-ra")
}

/// Where he will see each step once he accepts: fixed words per step kind, naming the days and clock values from the
/// step's payload. Never the kcal target — accepting changes where the expected extra is, never the target.
public func kapacitasWhereYouSee(_ p: KapacitasProposal) -> [(title: String, body: String)] {
    let steps = p.steps.isEmpty ? [KapacitasStep(kind: p.kind)] : p.steps
    var out: [(title: String, body: String)] = []
    for s in steps {
        let x = s.payload
        let day = on(x?.date ?? p.day).map(cap) ?? "Aznap"
        switch s.kind {
        case "MOVE_SESSION_DAY":
            let to = on(x?.toDate).map(cap) ?? "Az új napon"
            let from = on(x?.fromDate ?? p.day)
            out.append(("A napod és az edzés",
                        "\(to) a napod oldalán és a lejátszóban ott lesz az edzés" + (from.map { ", \($0) már nem" } ?? "")
                            + ". Az edzésnapi többlet is \(on(x?.toDate) ?? "azon a napon") jár, amikor megcsinálod."))
        case "SHIFT_SESSION_TIME":
            out.append(("A napod és az edzés", clock(x?.time).map {
                "\(day) a napod oldalán és a lejátszóban \($0)-kor kezdődik az edzés."
            } ?? "\(day) a napod oldalán és a lejátszóban az új időpontban lesz az edzés."))
        case "SHORTEN_SESSION":
            out.append(("Edzés", x?.minutes.map { "\(day) a lejátszó \($0) perces edzést kínál fel." }
                        ?? "\(day) a lejátszó rövidebb edzést kínál fel."))
        case "LIGHTEN_SESSION":
            out.append(("Edzés", "\(day) a lejátszó könnyebb edzést kínál fel."))
        case "SWAP_SESSION_KIND":
            out.append(("Edzés", "\(day) a napod oldalán és a lejátszóban a cserélt edzés lesz."))
        case "SKIP_SESSION":
            out.append(("A napod", "\(day) a napod oldalán kihagyottként látod az edzést."))
        case "SHIFT_BEDTIME":
            let night = dayName(x?.night ?? p.day).map { cap($0) + " este" } ?? "Aznap este"
            out.append(("Esti emlékeztető", clock(x?.bedtime).map {
                "\(night) a lefekvés-emlékeztető \(clockSublative($0)) igazodik."
            } ?? "\(night) a lefekvés-emlékeztető az új időhöz igazodik."))
        case "MOVE_MEAL_ENERGY":
            out.append(("Étel", "\(day) az Étel napi tervében nagyobb lesz az ebéd és kisebb a vacsora."))
        case "CALENDAR_TODO":
            out.append(("Naptár", "Te teszed át a naptáradban, én észreveszem."))
        default:
            continue
        }
    }
    return out
}
