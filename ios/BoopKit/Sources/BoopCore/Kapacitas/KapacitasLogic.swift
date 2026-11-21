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
