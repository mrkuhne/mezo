import CryptoKit
import Foundation
import BoopCore

// B4 Étel — what the `Ma` tab says, as plain functions (the views only draw their answers).

// MARK: - Numbers

/// A whole number the Hungarian way: thousands grouped with a no-break space, a real minus sign.
func huInt(_ n: Int) -> String {
    let digits = String(abs(n))
    var out = ""
    for (k, ch) in digits.reversed().enumerated() {
        if k > 0, k % 3 == 0 { out.append("\u{00A0}") }
        out.append(ch)
    }
    return (n < 0 ? "−" : "") + String(out.reversed())
}

// MARK: - The room's four tabs

enum EtelTab: String, CaseIterable {
    case ma = "Ma", receptek = "Receptek", kamra = "Kamra", het = "Hét"
}

// MARK: - The verdict (the head of the room)

struct EtelVerdict: Equatable {
    let headline: String
    let sentence: String
    /// 0…1, how much of the day's energy has been eaten; the orb's fill.
    let level: Double?
}

/// The macro farthest from its goal, as the share of the goal already eaten: nil when every goal is met (or none set).
func farthestMacro(_ day: FoodDay) -> (name: String, eaten: Int, target: Int)? {
    let macros: [(String, Double, Double)] = [("fehérje", day.consumed.p, day.targets.p),
                                              ("szénhidrát", day.consumed.c, day.targets.c),
                                              ("zsír", day.consumed.f, day.targets.f)]
    return macros.filter { $0.2 > 0 && $0.1 < $0.2 }
        .min { $0.1 / $0.2 < $1.1 / $1.2 }
        .map { ($0.0, Int($0.1.rounded()), Int($0.2.rounded())) }
}

/// What the head of the room says: the energy still to eat as a number (negative when over, in the normal colour and
/// without a reproach), then the macro farthest from its goal. `problem` is why nothing came back (nil = still loading).
func etelVerdict(day: FoodDay?, plan: FuelPlan?, problem: FoodFetchError?) -> EtelVerdict {
    guard let day else {
        if let problem {
            return EtelVerdict(headline: "Most nem érem el az étkezéseidet", sentence: etelProblemLine(problem), level: 0)
        }
        return EtelVerdict(headline: "Betöltöm a mai étkezéseid", sentence: "Egy pillanat, és itt a mai terved.", level: 0)
    }
    let level = day.targets.kcal > 0 ? min(1, max(0, day.consumed.kcal / day.targets.kcal)) : 0
    if day.fuelMode == "GUIDANCE" {
        return EtelVerdict(headline: "Ma nincs kalóriakeret", sentence: "Kímélő nap: azt egyél, ami jólesik, és amit a gyomrod elbír.", level: level)
    }
    let remaining = plan?.remaining.map { Int($0.kcal.rounded()) }
        ?? Int((day.targets.kcal - day.consumed.kcal - Double(day.skippedKcal)).rounded())
    let headline = "\(huInt(remaining)) kalória van még hátra"
    let sentence: String
    if day.meals.isEmpty {
        sentence = "Még nem rögzítettél semmit ma — a keret \(huInt(Int(day.targets.kcal.rounded()))) kalória."
    } else if remaining < 0 {
        sentence = "Ma a keret fölött jársz."
    } else if let m = farthestMacro(day) {
        sentence = "A \(m.name) van a legmesszebb: \(m.eaten) g a \(m.target)-ből."
    } else {
        sentence = "A mai célok megvannak."
    }
    return EtelVerdict(headline: headline, sentence: sentence, level: level)
}

/// The quiet line under a failed fetch.
func etelProblemLine(_ problem: FoodFetchError) -> String {
    switch problem {
    case .offline: "Nézd meg a netet, és próbáld újra."
    case .unauthorized: "A belépésed lejárt — lépj be újra."
    default: "Most nem jön válasz. Próbáld újra egy kicsit később."
    }
}

// MARK: - The day's windows

/// One thing in the day's list: a logged meal (or several) under its window's name, a window still open (suggestion,
/// *Megeszem*, *Kihagyom*), a skipped window, or a done window whose meals did not come back with the day.
enum EtelWindowItem: Identifiable {
    case logged(label: String, meals: [BoopCore.Meal])
    case open(PlanWindow)
    case skipped(PlanWindow)
    case quiet(PlanWindow)

    var id: String {
        switch self {
        case .logged(let label, let meals): "logged-\(label)-\(meals.map { $0.id.uuidString }.joined(separator: ","))"
        case .open(let w): "open-\(w.slot)-\(w.from)"
        case .skipped(let w): "skipped-\(w.slot)-\(w.from)"
        case .quiet(let w): "quiet-\(w.slot)-\(w.from)"
        }
    }
}

/// The Hungarian name of a meal's slot, for a meal no window claims.
func etelSlotLabel(_ slot: String) -> String {
    switch slot {
    case "breakfast": "Reggeli"
    case "lunch": "Ebéd"
    case "dinner": "Vacsora"
    case "snack": "Nasi"
    default: slot.prefix(1).uppercased() + slot.dropFirst()
    }
}

/// The plan's windows in order as list items; a meal the day has but no window claims follows at the end, so nothing
/// the owner logged is ever missing from the page.
func etelWindowItems(plan: FuelPlan, day: FoodDay) -> [EtelWindowItem] {
    let byId = Dictionary(day.meals.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    var claimed = Set<UUID>()
    var items: [EtelWindowItem] = plan.windows.map { w in
        let meals = w.loggedMealIds.compactMap { byId[$0] }
        claimed.formUnion(meals.map(\.id))
        switch w.state {
        case .skipped: return .skipped(w)
        case .done: return meals.isEmpty ? .quiet(w) : .logged(label: w.label, meals: meals)
        case .now, .pending, .missed: return meals.isEmpty ? .open(w) : .logged(label: w.label, meals: meals)
        }
    }
    for m in day.meals where !claimed.contains(m.id) { items.append(.logged(label: etelSlotLabel(m.slot), meals: [m])) }
    return items
}

/// The quiet line that stands where an empty list would: nil when there is anything to show.
func etelWindowsEmptyLine(_ items: [EtelWindowItem]) -> String? {
    items.isEmpty ? "Mára még nincs tervem az étkezéseidre. Rögzíts egyet, és innen építem a napot." : nil
}

// MARK: - A meal's eight dimensions (owner decision 12)

/// One tile of a meal card's dimension row.
struct DimensionEntry: Equatable, Identifiable {
    let id: String
    /// The short name on the tile.
    let name: String
    /// 0…100; nil = "nincs adat" (the dimension could not see the plate, or the meal has no score yet).
    let points: Int?
    /// The server's dimension when there is one — the sheet explains a degraded one too.
    let dimension: ScoreDimension?
}

/// The eight dimensions a logged meal is scored on, in the order the card shows them.
let etelDimensionOrder: [(id: String, name: String)] = [
    ("macro", "Makrók"), ("nova", "Feldolgozottság"), ("who", "WHO"), ("micro", "Rost"),
    ("fat_quality", "Zsírminőség"), ("plant_diversity", "Növényi változatosság"),
    ("energy_density", "Energiasűrűség"), ("context", "Napi helyzet"),
]

/// Always eight entries, whatever the meal carries: a missing or degraded dimension reads "nincs adat", never 0.
func dimensionRow(_ meal: BoopCore.Meal) -> [DimensionEntry] {
    etelDimensionOrder.map { spec in
        let d = meal.breakdown?.dimensions.first { $0.id == spec.id }
        return DimensionEntry(id: spec.id, name: spec.name, points: d?.points, dimension: d)
    }
}

/// The 0…100 total on the card, nil for a meal scored before the engine existed.
func mealPoints(_ meal: BoopCore.Meal) -> Int? { meal.score.map { Int(($0 * 100).rounded()) } }

/// What a dimension's sheet says, all of it from the server's own envelope: why the number is what it is, how much of
/// the plate it could see, and the coach's note when there is one (the coach's verdict wins over the envelope's note).
struct DimensionExplanation: Equatable {
    let what: String
    let why: String
    let coverage: String?
    let note: String?
}

func dimensionExplanation(_ d: ScoreDimension, coachNote: String?) -> DimensionExplanation {
    let what: String = switch d.id {
    case "macro": "A fehérje, a szénhidrát és a zsír aránya az étkezésben, a mai célodhoz mérve."
    case "micro": "Az étkezés rosttartalma és mikrotápanyagai, az étkezésre jutó részhez mérve."
    case "who": "Mennyire felel meg az étkezés a WHO ajánlásainak."
    case "fat_quality": "A zsírok minősége: mennyi a telített, és mennyi a telítetlen."
    case "nova": "Mennyire természetes az étel: az 1-es a nyers alapanyag, a 4-es az ultra-feldolgozott."
    case "plant_diversity": "Hányféle növényi alapanyag került a tányérra."
    case "energy_density": "Mennyi energia jut egy gramm ételre."
    case "context": "Hogyan illik az étkezés a nap többi részébe: az időzítése és a hátralévő keret."
    case "portion": "Az adag mérete a hozzá tartozó időablak keretéhez képest."
    default: "Ez a szempont azt méri, mennyire szolgálja az étkezés a célodat."
    }
    let coverage = d.coverage.map { "A tányér energiájának \(Int(($0 * 100).rounded()))%-át láttam ennél a szempontnál." }
    let note = [coachNote, d.note].compactMap { $0 }.first { !$0.isEmpty }
    return DimensionExplanation(what: what, why: d.detail, coverage: coverage, note: note)
}

// MARK: - Supplements

/// A stable key for "this day's morning group": replaying the tap (after a lost answer, or after a relaunch that
/// forgot it was done) repeats the same key, and the server dedupes.
func supplementRef(day: String, daypart: String) -> UUID {
    let d = Array(SHA256.hash(data: Data("etel-supplements|\(day)|\(daypart)".utf8)))
    return UUID(uuid: (d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[10], d[11], d[12], d[13], d[14], d[15]))
}

struct SupplementGroup: Equatable, Identifiable {
    let key: String
    let label: String
    let count: Int
    /// "D3-vitamin 4000 NE · Omega-3 2 g"
    let summary: String
    var id: String { key }
}

/// The server's daypart keys (`wake|breakfast|pre_workout|post_workout|lunch|dinner|evening|bedtime`) in the order of the
/// day, plus the older coarse words, with their Hungarian names and an indicative clock time (a guess, never shown as exact).
let supplementDayparts: [(key: String, label: String, clock: String)] = [
    ("wake", "Ébredéskor", "07:00"), ("morning", "Reggel", "08:00"), ("breakfast", "Reggeli mellé", "08:00"), ("pre_workout", "Edzés előtt", "16:00"),
    ("midday", "Dél", "12:00"), ("lunch", "Ebéd mellé", "13:00"), ("afternoon", "Délután", "15:00"), ("post_workout", "Edzés után", "18:00"),
    ("dinner", "Vacsora mellé", "19:00"), ("evening", "Este", "21:00"), ("bedtime", "Lefekvés előtt", "22:00"),
]
/// The dayparts a new supplement can be placed in (the server accepts exactly these).
let supplementPlacements = ["wake", "breakfast", "pre_workout", "lunch", "post_workout", "dinner", "evening", "bedtime"]
private let supplementOrder = supplementDayparts.map(\.key)
private let supplementLabels = Dictionary(uniqueKeysWithValues: supplementDayparts.map { ($0.key, $0.label) })

func supplementDaypartLabel(_ key: String) -> String {
    supplementLabels[key] ?? (key.prefix(1).uppercased() + key.dropFirst())
}

/// One supplement of the protocol, named, for the list editor.
struct SupplementRow: Equatable, Identifiable {
    let id: UUID
    let pantryItemId: UUID
    let name: String
    let dose: String?
    let slotKey: String
}

/// The protocol's rows with their names and doses (the row's own dose wins over the stash's), in the day's order.
func supplementRows(_ items: [ProtocolItem], names: [UUID: StashRow]) -> [SupplementRow] {
    let rows = items.map { item -> SupplementRow in
        let stash = names[item.pantryItemId]
        let dose = [item.dose, stash?.dose].compactMap { $0 }.first { !$0.isEmpty }
        return SupplementRow(id: item.id, pantryItemId: item.pantryItemId, name: stash?.name ?? "Kiegészítő", dose: dose, slotKey: item.slotKey)
    }
    return rows.enumerated().sorted {
        (supplementOrder.firstIndex(of: $0.element.slotKey) ?? 99, $0.offset) < (supplementOrder.firstIndex(of: $1.element.slotKey) ?? 99, $1.offset)
    }.map(\.element)
}

/// The protocol's rows as the day's groups (morning first, anything unknown last); a group with no item is not shown.
func supplementGroups(_ items: [ProtocolItem], names: [UUID: StashRow]) -> [SupplementGroup] {
    let keys = Array(Set(items.map(\.slotKey))).sorted {
        (supplementOrder.firstIndex(of: $0) ?? 99, $0) < (supplementOrder.firstIndex(of: $1) ?? 99, $1)
    }
    return keys.map { key in
        let rows = items.filter { $0.slotKey == key }
        let parts = rows.map { item -> String in
            let stash = names[item.pantryItemId]
            guard let name = stash?.name else { return "Kiegészítő" }
            let dose = [item.dose, stash?.dose].compactMap { $0 }.first { !$0.isEmpty }
            return dose.map { "\(name) \($0)" } ?? name
        }
        return SupplementGroup(key: key, label: supplementDaypartLabel(key), count: rows.count, summary: parts.joined(separator: " · "))
    }
}

// MARK: - Capturing a meal (B4 Task 10)

/// A small label on a draft line: what the owner should know before the tap.
struct DraftBadge: Equatable, Identifiable {
    enum Tone: Equatable { case stop, warn, notice, processed }
    let text: String
    let tone: Tone
    var id: String { text }
}

/// The sensitivity and processed badges of one draft line. A line with no allergen information (an estimate) gets
/// no allergen badge — silence is never "free of" — and the draft says so once (`draftHasUnknownAllergens`).
func draftBadges(for item: DraftItem, profile: SensitivityProfile?) -> [DraftBadge] {
    var out: [DraftBadge] = []
    if let profile {
        for b in SensitivityRules.badges(allergens: item.allergens, profile: profile) where b.severity != .noData {
            let tone: DraftBadge.Tone = switch b.severity { case .block: .stop; case .warn: .warn; default: .notice }
            out.append(DraftBadge(text: "\(allergenName(b.key ?? "")) · \(b.text)", tone: tone))
        }
    }
    if let nova = item.nova {
        if nova >= 4 {
            out.append(DraftBadge(text: "Ultra-feldolgozott", tone: .processed))
        } else if let rule = profile?.novaRule, rule.enabled, nova > rule.maxLevel {
            out.append(DraftBadge(text: "NOVA \(nova) · a határod fölött", tone: .processed))
        }
    }
    return out
}

/// True when the owner has allergen rules and some line says nothing (or "unknown") about an allergen the owner watches.
func draftHasUnknownAllergens(_ draft: MealDraft, profile: SensitivityProfile?) -> Bool {
    guard let profile else { return false }
    let watched = profile.items.filter(\.isStructured).map { $0.key.lowercased() }
    guard !watched.isEmpty else { return false }
    // silent when a line has no map, or its map lacks (or marks unknown) a key the owner watches
    return draft.items.contains { i in watched.contains { (i.allergens[$0] ?? .unknown) == .unknown } }
}

func allergenName(_ key: String) -> String {
    ["gluten": "Glutén", "crustaceans": "Rákfélék", "eggs": "Tojás", "fish": "Hal", "peanuts": "Földimogyoró", "soybeans": "Szója",
     "milk": "Tej", "nuts": "Diófélék", "celery": "Zeller", "mustard": "Mustár", "sesame": "Szezám", "sulphites": "Szulfitok",
     "lupin": "Csillagfürt", "molluscs": "Puhatestűek"][key] ?? key.capitalized
}

/// What the draft honestly says about its barcode lookup (`lookupFailed` and `lookupSource` have no other reader):
/// "could not look it up" and "looked it up, nobody knows it" are different sentences. nil = nothing to add.
func draftNotice(_ draft: MealDraft) -> String? {
    if draft.lookupFailed {
        return "A vonalkódot most nem tudtam megkeresni — nem azt jelenti, hogy nincs meg, csak nem értem el. A kódot megjegyeztem, próbáld újra, ha stabil a net."
    }
    // `lookupSource` is optional: a bare `.none` would mean nil (never looked up), not `LookupSource.none` (looked up, unknown).
    if draft.barcode != nil, draft.lookupSource == LookupSource.none {
        // Items already here came from the owner's photo or words (the label photo carrying this code): the code is
        // unknown, the draft is an estimate — say that, don't ask for the photo he just took.
        if !draft.items.isEmpty {
            return "Ezt a kódot nem ismerem, ezért a tételeket a képedből és a leírásodból becsültem, nem a termék adataiból. Nézd át őket."
        }
        return "Ezt a kódot nem ismerem: se nálad, se a nyilvános adatbázisban nincs meg. Fotózd le a tápértéktáblát, vagy írd le, mit ettél."
    }
    if draft.items.isEmpty {
        return "Nem találtam ebben ételt. Írd le szavakkal, vagy fotózd le újra."
    }
    return nil
}

/// What the confirmation card says about itself, by state.
func pendingCardLine(_ card: PendingDraft) -> String {
    switch card.state {
    case .waiting: "A telefonon van. Amint lesz net, kiszámolom, és egy koppintással jóváhagyod — addig semmi nem mentődik el."
    case .failed: "Ezt nem tudtam elküldeni. Az adataid megvannak, megpróbálom újra, ha kéred."
    case .ready: "Kiszámoltam. Nézd át, és egy koppintással mentsd — addig semmi nem került a naplódba."
    case .photoWaiting: "Az étkezés rögzítve, de a fotója még nem ért fel. A telefonodon van; megpróbálom újra, ha kéred."
    }
}

/// The meal's own title: the draft's, else its first lines, else its slot.
func draftTitle(_ draft: MealDraft) -> String {
    if let t = draft.title, !t.isEmpty { return t }
    let names = draft.items.map(\.name)
    return names.isEmpty ? etelSlotLabel(draft.slot) : names.prefix(3).joined(separator: ", ")
}

/// The small tag under a draft line; a line flagged for review says so whatever its source.
func draftSourceTag(_ item: DraftItem) -> String {
    switch item.source {
    case .pantry: item.needsReview ? "kamra · nézd át" : "kamra"
    case .recipe: item.needsReview ? "recept · nézd át" : "recept"
    case .estimate: item.needsReview || item.confidence < 0.6 ? "becslés · nézd át" : "becslés"
    }
}
