import Foundation

// The Test tab in words and pictures (`mezo-r36n9.205`, spec §5.5): how the gym and the sport load the body together,
// the shoulder after sport, the rest between the two, and the „miért?" behind each hint. Only server numbers.

/// The map's switch.
public enum SportMapMode: String, CaseIterable, Sendable {
    case together, gym, sport

    /// „Együtt" · „Kondi" · the sport's short name („Röpi"; „Sport" when the week mixes kinds).
    public func label(sportName: String) -> String {
        switch self {
        case .together: "Együtt"
        case .gym: "Kondi"
        case .sport: sportName
        }
    }
}

/// The sport mode's name: the week's one kind („Röpi"), „Röpi" with none yet (his sport), „Sport" for a mix.
public func sportMapSportName(_ o: SportOverview?) -> String {
    let kinds = Set((o?.days ?? []).flatMap(\.sport).map(\.kind))
    if kinds.count == 1, let k = kinds.first { return k.short }
    return kinds.isEmpty ? SportKind.volleyball.short : SportKind.other.short
}

/// The heat of one mode, 0…1 per muscle — never above full (capped), zero-heat muscles left out.
public func sportBodyHeat(_ b: SportBodyWeek, _ mode: SportMapMode) -> [(muscle: String, level: Double)] {
    b.muscles.compactMap { m in
        let raw: Double
        switch mode {
        case .together: raw = m.together
        case .gym: raw = m.gym
        case .sport: raw = m.sport
        }
        let level = min(1, max(0, raw.isFinite ? raw : 0))
        return level > 0 ? (m.muscle, level) : nil
    }
}

/// The Hungarian word of a muscle token (or a legacy coarse key); nil for anything unknown.
public func sportMuscleWord(_ token: String) -> String? {
    let t = token.lowercased()
    if t.hasPrefix("shoulder") || t == "rear-delt" { return "váll" }
    if t.hasPrefix("chest") { return "mell" }
    if t.hasPrefix("back") || t == "lats" { return "hát" }
    if t.hasPrefix("biceps") || t == "arms" { return "bicepsz" }
    if t.hasPrefix("triceps") { return "tricepsz" }
    switch t {
    case "traps": return "csuklya"
    case "quad", "quads", "legs": return "comb"
    case "ham", "hams", "hamstring": return "combhajlító"
    case "glute", "glutes": return "far"
    case "calf", "calves": return "vádli"
    case "core", "abs": return "törzs"
    default: return nil
    }
}

/// „váll, vádli, comb és törzs" — the strongest first, each word once, at most four.
func sportMuscleList(_ tokens: [String]) -> String? {
    var words: [String] = []
    for t in tokens { if let w = sportMuscleWord(t), !words.contains(w) { words.append(w) } }
    let top = Array(words.prefix(4))
    guard let last = top.last else { return nil }
    return top.count == 1 ? last : top.dropLast().joined(separator: ", ") + " és " + last
}

/// The sentence under the map.
public func sportMapLine(_ b: SportBodyWeek, _ mode: SportMapMode, sportName: String) -> String {
    let byGym = b.muscles.filter { $0.gym > 0 }.sorted { $0.gym > $1.gym }.map(\.muscle)
    let bySport = b.muscles.filter { $0.sport > 0 }.sorted { $0.sport > $1.sport }.map(\.muscle)
    let sport = sportName.lowercased()
    switch mode {
    case .gym:
        return sportMuscleList(byGym).map { "A kondi a héten: \($0)." } ?? "Ezen a héten még nem volt kondi."
    case .sport:
        return sportMuscleList(bySport).map { "\(sportArticle(sport).capitalizedFirst) a héten: \($0)." }
            ?? "Ezen a héten még nincs olyan sportalkalom, ami terhelést adna a térképre."
    case .together:
        let shared = b.muscles.filter { $0.gym > 0 && $0.sport > 0 }.sorted { $0.together > $1.together }.map(\.muscle)
        if let list = sportMuscleList(shared) { return "Együtt: \(list) kap mindkettőből." }
        if byGym.isEmpty && bySport.isEmpty { return "Ezen a héten még nincs terhelés a térképen." }
        return "Együtt: a kondi és a sport ezen a héten más-más izmokat terhel."
    }
}

/// Why some sport adds no heat — said, never hidden; nil when every session counts.
public func sportUnknownNote(_ b: SportBodyWeek) -> String? {
    guard b.sportUnknown > 0 else { return nil }
    return "\(b.sportUnknown) sportalkalom nem ad hőt a térképen: hiányzik a megterhelés vagy a hossza, vagy ehhez a sporthoz még nincs izomtérképem."
}

/// „11 ó", „9,5 ó".
public func sportHoursShort(_ h: Double) -> String { "\(sportDecimal((h * 2).rounded() / 2)) ó" }

/// The hero's numbers: shared muscles · shoulder average · the shortest rest between the two.
public func sportTestFigures(_ b: SportBodyWeek?, gaps: SportGaps?) -> [SportFigure] {
    var out: [SportFigure] = []
    if let b { out.append(SportFigure("\(b.sharedMuscles)", "izom kap mindkettőből", lit: true)) }
    if let sh = b?.shoulderAverage { out.append(SportFigure(sportDecimal(sh), "váll átlag")) }
    if let gap = gaps?.days.compactMap(\.gapHours).min() { out.append(SportFigure(sportHoursShort(gap), "legrövidebb pihenő")) }
    return out
}

/// VoiceOver for the map.
public func sportMapLabel(_ b: SportBodyWeek, _ mode: SportMapMode, sportName: String) -> String {
    let heat = sportBodyHeat(b, mode).sorted { $0.level > $1.level }
    guard let list = sportMuscleList(heat.map(\.muscle)) else { return "Izomtérkép, \(mode.label(sportName: sportName)): még nincs terhelés." }
    return "Izomtérkép, \(mode.label(sportName: sportName)): a legjobban terhelt \(list)."
}

// MARK: - A vállad · 6 hét

public struct SportShoulderBar: Equatable, Sendable {
    public let label: String
    public let value: Double?
    public let current: Bool
    /// Bright: the current week, or at / over the line at 7.
    public let lit: Bool
}

public func sportShoulderBars(_ s: SportShoulder) -> [SportShoulderBar] {
    s.weeks.enumerated().map { i, w in
        let current = i == s.weeks.count - 1
        return SportShoulderBar(label: current ? "ez" : sportMonthDay(w.weekStart), value: w.average.map { min(10, max(0, $0)) },
                                current: current, lit: current || (w.average ?? 0) >= 7)
    }
}

public func sportShoulderSentence(_ s: SportShoulder) -> String {
    let values = s.weeks.map(\.average)
    guard values.contains(where: { $0 != nil }) else {
        return "Még nincs vállértéked: röpi után a rögzítésnél jelölheted, hogy bírta a vállad."
    }
    let cur = values.last ?? nil
    let prev = values.dropLast().last ?? nil
    switch (prev, cur) {
    case let (p?, c?):
        let over = c >= 7 ? " — ez a 7-es vonal fölött van." : (p >= 7 ? " — visszajött a 7-es vonal alá." : ".")
        return "Múlt héten \(sportDecimal(p)) volt, most \(sportDecimal(c))\(over)"
    case let (nil, c?):
        return "Ezen a héten \(sportDecimal(c))\(c >= 7 ? " — ez a 7-es vonal fölött van." : ".")"
    case let (p?, nil):
        return "Ezen a héten még nincs vállérték; múlt héten \(sportDecimal(p)) volt."
    default:
        let last = values.compactMap { $0 }.last ?? 0
        return "Ezen a héten még nincs vállérték; a legutóbbi heti átlag \(sportDecimal(last)) volt."
    }
}

public func sportShoulderLabel(_ s: SportShoulder) -> String {
    let parts = sportShoulderBars(s).map { b in
        "\(b.current ? "ezen a héten" : b.label): \(b.value.map(sportDecimal) ?? "nincs adat")"
    }
    return "A váll heti átlaga \(s.weeks.count) hétre, röpi után, egytől tízig: \(parts.joined(separator: "; ")). A figyelmeztető vonal 7-nél."
}

// MARK: - Pihenő a kettő között

public struct SportRestRow: Equatable, Sendable {
    public let day: String
    /// Blocks as hours of the day (6…23 on the strip).
    public let blocks: [(gym: Bool, from: Double, to: Double, done: Bool)]
    public let gap: String
    public let accessibility: String

    public static func == (a: SportRestRow, b: SportRestRow) -> Bool {
        a.day == b.day && a.gap == b.gap && a.accessibility == b.accessibility && a.blocks.count == b.blocks.count
    }
}

private let dayShort = ["Hé", "Ke", "Sze", "Csü", "Pé", "Szo", "Va"]

func sportHourOf(_ hhmm: String) -> Double? {
    let p = hhmm.split(separator: ":")
    guard p.count == 2, let h = Double(p[0]), let m = Double(p[1]) else { return nil }
    return h + m / 60
}

/// Days with anything on them, in week order.
public func sportRestRows(_ g: SportGaps) -> [SportRestRow] {
    g.days.compactMap { d in
        guard !d.blocks.isEmpty, let wd = sportLegacyWeekday(d.date) else { return nil }
        let blocks = d.blocks.compactMap { b -> (gym: Bool, from: Double, to: Double, done: Bool)? in
            guard let f = sportHourOf(b.start), let t = sportHourOf(b.end) else { return nil }
            return (b.isGym, f, max(f, t), b.done)
        }
        let spoken = d.blocks.map { b in
            let what = b.isGym ? "kondi" : SportKind(wire: b.sport).inSentence
            return "\(what) \(b.start)–\(b.end)"
        }.joined(separator: ", ")
        let gapSpoken = d.gapHours.map { ", \(sportDecimal(($0 * 2).rounded() / 2)) óra pihenő köztük" } ?? ""
        return SportRestRow(day: dayShort[wd], blocks: blocks, gap: d.gapHours.map(sportHoursShort) ?? "—",
                            accessibility: "\(sportDayNames[wd]): \(spoken)\(gapSpoken)")
    }
}

public func sportRestSentence(_ g: SportGaps) -> String {
    let gaps = g.days.compactMap(\.gapHours)
    guard let min = gaps.min() else {
        return g.days.contains(where: { !$0.blocks.isEmpty })
            ? "Ezen a héten nincs olyan nap, amikor kondi és sport is van — a kettő nem ér össze."
            : "Ezen a héten még nincs se kondi, se sport a tervben."
    }
    let h = sportDecimal((min * 2).rounded() / 2)
    if min >= 6 { return "Ahol egy napon kondi és sport is van, legalább \(h) óra jut köztük — ez elég." }
    if min >= 3 { return "A legszorosabb napon \(h) óra van köztük — elég, ha a másodikat nem hajtod túl." }
    return "A legszorosabb napon csak \(h) óra van köztük — ez szoros, a második előtt melegíts be alaposan."
}

// MARK: - Amire figyelek → miért?

/// The „miért?" page of one hint: what the server saw, in Boop's voice, with the labelled expert lines.
public struct SportWhy: Equatable, Sendable {
    public let title: String
    public let sub: String
    public let facts: [SportWhyFact]
    public let experts: [SportWhyExpert]
    public let closing: String
}

public struct SportWhyFact: Equatable, Sendable { public let value: String, unit: String, label: String }
public struct SportWhyExpert: Equatable, Sendable { public let label: String, text: String, doubt: Bool }

public let sportWhyClosing = "Ez csak jelzés: a tervedet magamtól nem változtatom meg."

/// nil for a hint with nothing more to say.
public func sportWhy(_ h: SportHint) -> SportWhy? {
    let kind = SportKind(wire: h.sport)
    let day = sportLegacyWeekday(h.date).map { sportDayOn[$0] } ?? sportMonthDay(h.date)
    switch h.key {
    case "GAP_TIGHT", "GAP_SHORT":
        let facts = h.gapHours.map { [SportWhyFact(value: sportDecimal(($0 * 2).rounded() / 2), unit: "óra", label: "pihenő a kettő között")] } ?? []
        return SportWhy(
            title: "Kevés idő a kettő között",
            sub: "\(day) a kondi és \(sportArticle(kind.inSentence)) ugyanarra a napra esik, és kevés pihenő jut köztük. A második alkalom így fáradtabb izmokkal indul.",
            facts: facts,
            experts: [SportWhyExpert(label: "Mozgás", text: "A második előtt hosszabb bemelegítés kell, és ott ne a maximumra menj.", doubt: false),
                      SportWhyExpert(label: "Szkeptikus", text: "Ha frissnek érzed magad, ez nem baj — csak jelzés, nem tiltás.", doubt: true)],
            closing: sportWhyClosing)
    case "SPORT_BEFORE_LEG_MORNING":
        return SportWhy(
            title: "Lábnap egy esti \(kind.inSentence) után",
            sub: "\(day) reggel lábnap jön, előző este \(kind.inSentence)\(h.heavy == true ? ", ami kemény szokott lenni" : ""). A comb és a vádli reggelre még fáradt lehet.",
            facts: [],
            experts: [SportWhyExpert(label: "Mozgás", text: "Ha reggel fáj a lábad, a könnyebb változat ugyanúgy megtartja a haladást.", doubt: false)],
            closing: sportWhyClosing)
    case "SPORT_LOAD_DECLINE":
        let n = h.pairs ?? 2
        return SportWhy(
            title: "Kevesebb ismétlés kemény sport után",
            sub: "Az elmúlt két hétben \(n) alkalommal kevesebb ismétlés ment a kondin egy kemény \(kind.inSentence) utáni napon.",
            facts: [SportWhyFact(value: "\(n)", unit: "alkalom", label: "kevesebb ismétlés két hét alatt")],
            experts: [SportWhyExpert(label: "Mozgás", text: "A sport utáni nap fáradtsága a kondin is látszik — ez természetes.", doubt: false),
                      SportWhyExpert(label: "Szkeptikus", text: "Két hét még kevés adat, lehet véletlen is — ezért csak jelzem.", doubt: true)],
            closing: sportWhyClosing)
    default:
        return nil
    }
}
