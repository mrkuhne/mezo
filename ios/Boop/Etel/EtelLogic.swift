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

private let supplementOrder = ["morning", "midday", "afternoon", "evening", "bedtime"]
private let supplementLabels = ["morning": "Reggel", "midday": "Dél", "afternoon": "Délután", "evening": "Este", "bedtime": "Lefekvés előtt"]

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
        return SupplementGroup(key: key, label: supplementLabels[key] ?? (key.prefix(1).uppercased() + key.dropFirst()),
                               count: rows.count, summary: parts.joined(separator: " · "))
    }
}
