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

    public init(title: String, sub: String, value: String, hot: Bool, glyph: String, eventKey: String? = nil) {
        self.title = title
        self.sub = sub
        self.value = value
        self.hot = hot
        self.glyph = glyph
        self.eventKey = eventKey
    }
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
    let reason = c.calendarKnown ? c.reason : c.reason + " · naptár nélkül"
    let learning = c.tanulo ? "Még tanulom, mennyit bírsz: \(c.labelledDays) napnyi adatom van." : nil
    return (word, reason, learning)
}

private func kindWord(_ kind: String) -> String {
    switch kind {
    case "meeting": "megbeszélés"
    case "call": "hívás"
    case "focus": "fókusz"
    case "social": "emberek közt"
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
            case "sport": glyph = "dumbbell-ink"
            case "social": glyph = "person-sage"
            default: glyph = "clock-ink"
            }
        }
        return KapacitasRow(title: d.label, sub: "\(time) · \(kindWord(d.kind))", value: levelWord(d.level),
                            hot: d.level == .nagy, glyph: glyph, eventKey: d.eventKey)
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
