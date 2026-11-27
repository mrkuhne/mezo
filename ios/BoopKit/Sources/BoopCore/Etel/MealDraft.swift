import Foundation
import ImageIO
import UniformTypeIdentifiers

/// What the phone keeps of a meal captured without the net (B4): the words, the barcode and the id of the photo stored
/// beside the queue. This is the outbox payload — the image bytes are never inside it.
public struct MealCapture: Codable, Equatable, Sendable {
    public var text: String?
    public var barcode: String?
    /// The stored photo's id (`FoodOutbox.storePhoto`); the file is `meal-<id>.jpg` next to the queue.
    public var photoRef: UUID?
    /// A meal or a drink (`mezo-r36n9.160`): a drink keeps its own slot whatever the clock says. A queue written
    /// before drinks existed decodes as a meal.
    public var kind: MealKind
    public init(text: String?, barcode: String? = nil, photoRef: UUID? = nil, kind: MealKind = .meal) {
        self.text = text; self.barcode = barcode; self.photoRef = photoRef; self.kind = kind
    }

    private enum CodingKeys: String, CodingKey { case text, barcode, photoRef, kind }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        text = try c.decodeIfPresent(String.self, forKey: .text)
        barcode = try c.decodeIfPresent(String.self, forKey: .barcode)
        photoRef = try c.decodeIfPresent(UUID.self, forKey: .photoRef)
        kind = try c.decodeIfPresent(MealKind.self, forKey: .kind) ?? .meal
    }
}

/// What a capture is (`mezo-r36n9.160`, spec §3.7): a meal takes the window the clock points at; a drink is the sixth,
/// unscored bucket — it counts in the day, fills no window, and its slot is always `drink`.
public enum MealKind: String, Codable, Equatable, Sendable {
    case meal, drink

    /// The slot a kind pins regardless of the clock; nil = the clock decides (`FoodClient.slot(at:cal:)`).
    public var fixedSlot: String? { self == .drink ? "drink" : nil }
}

/// Where a captured meal stands (decision 9: nothing is saved without the owner's tap).
public struct PendingDraft: Identifiable, Equatable, Sendable {
    public enum State: Equatable, Sendable {
        /// On the phone, to be computed when the network is there (a flaky net keeps retrying quietly).
        case waiting
        /// Will not be sent without the owner's *Újra* (a refusal, out of tries, older than 7 days); its values stay.
        case failed(String)
        /// Computed: a confirmation card — one tap saves it. The photo stays beside the queue (`photoData`).
        case ready(MealDraft)
        /// The meal is saved, but its photo did not go up: the phone still holds the only copy.
        case photoWaiting(mealId: UUID)
    }
    public let id: UUID
    /// The instant of capture, with the phone's own day (never UTC's).
    public let capturedAt: Date
    /// The local day, `yyyy-MM-dd`.
    public let date: String
    public var text: String?
    public var barcode: String?
    /// The photo stored beside the queue, if the capture has one.
    public var photoRef: UUID?
    public var state: State
    /// A meal or a drink (`mezo-r36n9.160`): the card reopens the composer in the same mode it was captured in.
    public var kind: MealKind
    public var hasPhoto: Bool { photoRef != nil }

    public init(id: UUID, capturedAt: Date, date: String, text: String?, barcode: String?, photoRef: UUID?, state: State,
                kind: MealKind = .meal) {
        self.id = id; self.capturedAt = capturedAt; self.date = date; self.text = text; self.barcode = barcode
        self.photoRef = photoRef; self.state = state; self.kind = kind
    }

    /// The server refuses a capture dated more than 7 days back (same rule as `Outbox`).
    public func isTooOld(now: Date, calendar: Calendar) -> Bool {
        var greg = Calendar(identifier: .gregorian); greg.timeZone = calendar.timeZone
        let p = date.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let day = greg.date(from: DateComponents(year: p[0], month: p[1], day: p[2])),
              let age = greg.dateComponents([.day], from: greg.startOfDay(for: day), to: greg.startOfDay(for: now)).day else { return false }
        return age > Outbox.maxAgeDays
    }
}

public enum FoodOutboxError: Error, Equatable, Sendable { case unreadablePhoto }

/// Meal photos as the server takes them: JPEG (its image store reads JPEG and PNG, no WebP), long edge at most 1600 px.
public enum MealPhoto {
    public static let longEdge = 1600

    /// The picture as JPEG with its orientation baked in and the long edge shrunk to `longEdge` (never enlarged);
    /// nil when the bytes are not an image.
    public static func jpeg(from data: Data, longEdge: Int = MealPhoto.longEdge, quality: Double = 0.8) -> Data? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let w = props[kCGImagePropertyPixelWidth] as? Int, let h = props[kCGImagePropertyPixelHeight] as? Int,
              w > 0, h > 0 else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: min(longEdge, max(w, h)),
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        return CGImageDestinationFinalize(dest) ? out as Data : nil
    }
}

// MARK: - What a draft adds up to

public extension DraftItem {
    /// The line's own macros: the food's numbers are for `per` of its basis unit, the owner ate `amount`.
    var contribution: Macros {
        let k = per > 0 ? amount / per : 0
        return Macros(kcal: kcal * k, p: proteinG * k, c: carbsG * k, f: fatG * k)
    }

    /// A shelf row as a draft line, one serving of it (what the row's numbers are for).
    init?(pantry row: PantryRow) {
        guard let id = row.id, let per = row.per, per > 0, let unit = row.unit else { return nil }
        self.init(source: .pantry, pantryItemId: id, name: row.name, amount: per, unit: unit, per: per, basisUnit: unit,
                  kcal: row.kcal ?? 0, proteinG: row.proteinG ?? 0, carbsG: row.carbsG ?? 0, fatG: row.fatG ?? 0, nova: row.nova,
                  confidence: 1, needsReview: row.kcal == nil || row.proteinG == nil || row.carbsG == nil || row.fatG == nil, allergens: row.allergens)
    }

    /// One serving ("adag") of a saved recipe: the server snapshots the same per-serving numbers (whole rollup ÷ servings).
    init(recipe: Recipe) {
        let n = Double(max(recipe.servings, 1))
        self.init(source: .recipe, recipeId: recipe.id, name: recipe.name, amount: 1, unit: "adag", per: 1, basisUnit: "adag",
                  kcal: recipe.macros.kcal / n, proteinG: recipe.macros.p / n, carbsG: recipe.macros.c / n, fatG: recipe.macros.f / n,
                  nova: recipe.nova, confidence: 1, needsReview: false)
    }
}

public extension DraftItem {
    /// One serving of a recipe as its ingredients (`mezo-r36n9.181`): one shelf line per ingredient, its grams being the
    /// recipe's amount ÷ servings, each carrying the recipe's id and name as the "part of recipe" marker. The numbers
    /// come from the shelf row (the server snapshots the same row when it saves).
    ///
    /// Nil — the caller falls back to the single "1 adag" line — when an ingredient cannot be one honest gram line: its
    /// shelf row is gone, it has no numbers, or it is measured in something other than mass/volume of the row's basis.
    static func ingredientLines(of recipe: Recipe, shelf: [PantryRow]) -> [DraftItem]? {
        guard !recipe.ingredients.isEmpty else { return nil }
        let servings = Double(max(recipe.servings, 1))
        var lines: [DraftItem] = []
        for ing in recipe.ingredients {
            guard let row = shelf.first(where: { $0.id == ing.pantryItemId }), let base = DraftItem(pantry: row),
                  let grams = massAmount(ing.amount, unit: ing.unit, basis: base.basisUnit) else { return nil }
            let perServing = grams / servings
            guard perServing > 0 else { continue }
            var line = base
            line.amount = perServing >= 10 ? perServing.rounded() : (perServing * 10).rounded() / 10
            line.recipeId = recipe.id
            line.recipeName = recipe.name
            lines.append(line)
        }
        return lines.isEmpty ? nil : lines
    }

    /// The recipe line's amount in the shelf row's basis unit (g or ml; kg and l scaled), nil when they do not match.
    private static func massAmount(_ amount: Double, unit: String, basis: String) -> Double? {
        let u = unit.trimmingCharacters(in: .whitespaces).lowercased(), b = basis.trimmingCharacters(in: .whitespaces).lowercased()
        let (value, norm): (Double, String) = switch u {
        case "kg": (amount * 1000, "g")
        case "l": (amount * 1000, "ml")
        default: (amount, u)
        }
        guard norm == "g" || norm == "ml" else { return nil }
        return norm == b ? value : nil
    }
}

public extension MealDraft {
    var total: Macros {
        items.reduce(Macros(kcal: 0, p: 0, c: 0, f: 0)) { acc, i in
            let c = i.contribution
            return Macros(kcal: acc.kcal + c.kcal, p: acc.p + c.p, c: acc.c + c.c, f: acc.f + c.f)
        }
    }
}

// MARK: - Correction seed (mezo-r36n9.184)

public extension MealDraft {
    /// A logged meal as an editable draft: every line at its logged amount, its macros as the per-basis (so changing
    /// the amount scales them), its source ids and recipe overrides kept. The stored photo stays on the server.
    init(editing m: Meal) {
        self.init(date: m.mealDate, slot: m.slot, title: m.title, items: m.items.map { i in
            var d = DraftItem(source: DraftSource(rawValue: i.source) ?? .estimate, pantryItemId: i.pantryItemId, recipeId: i.recipeId,
                              name: i.name, amount: i.amount, unit: i.unit, per: i.amount > 0 ? i.amount : 1, basisUnit: i.unit,
                              kcal: i.contribution.kcal, proteinG: i.contribution.p, carbsG: i.contribution.c, fatG: i.contribution.f,
                              nova: i.nova, fiberG: i.fiberG, sugarG: i.sugarG, saltG: i.saltG, saturatedFatG: i.saturatedFatG,
                              recipeName: i.recipeName)
            d.ingredientOverrides = i.ingredientOverrides.isEmpty ? nil : i.ingredientOverrides
            return d
        })
    }
}
