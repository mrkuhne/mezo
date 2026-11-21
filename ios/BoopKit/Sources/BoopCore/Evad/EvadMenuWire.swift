import Foundation

// The wire shapes of the weekly menu and the shopping list (Boop B6 Évad S3, `mezo-r36n9.16`, contract
// `api/feature/season/season.yml`). Hand-written and lenient like the rest of Évad: enums are plain Strings, unknown
// fields are ignored, a missing optional is nil or empty.

/// Next week's menu state, carried by the overview (the wall's approval card). `status`: none · seeding · proposed ·
/// approved.
public struct EvadMenuStatus: Codable, Equatable, Sendable {
    public let weekStart: String
    public let weekId: String?
    public let status: String
    /// 0 = hétfő … 6 = vasárnap.
    public let menuDay: Int?
    public let menuTime: String
    public init(weekStart: String, weekId: String?, status: String, menuDay: Int?, menuTime: String) {
        self.weekStart = weekStart; self.weekId = weekId; self.status = status; self.menuDay = menuDay; self.menuTime = menuTime
    }
}

/// One planned meal. `recipeId` nil = an ingredient tip (`name` is the tip's sentence).
public struct EvadMenuMeal: Codable, Equatable, Hashable, Identifiable, Sendable {
    public let id: String
    /// breakfast · lunch · dinner · snack.
    public let slot: String
    public let label: String
    public let recipeId: String?
    public let name: String
    public let servings: Double?
    public let kcal: Int
    public let proteinG: Int?
    public let preSession: Bool
    public let locked: Bool
    public let changed: Bool

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        slot = try c.decodeIfPresent(String.self, forKey: .slot) ?? "snack"
        label = try c.decodeIfPresent(String.self, forKey: .label) ?? ""
        recipeId = try c.decodeIfPresent(String.self, forKey: .recipeId)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        servings = try c.decodeIfPresent(Double.self, forKey: .servings)
        kcal = try c.decodeIfPresent(Int.self, forKey: .kcal) ?? 0
        proteinG = try c.decodeIfPresent(Int.self, forKey: .proteinG)
        preSession = try c.decodeIfPresent(Bool.self, forKey: .preSession) ?? false
        locked = try c.decodeIfPresent(Bool.self, forKey: .locked) ?? false
        changed = try c.decodeIfPresent(Bool.self, forKey: .changed) ?? false
    }
}

/// One day of a menu week. `kind`: edzesnap · sport · edzes_sport · pihenonap.
public struct EvadMenuDay: Codable, Equatable, Identifiable, Sendable {
    public let date: String
    public let kind: String
    public let sportName: String?
    public let kcal: Int
    public let meals: [EvadMenuMeal]
    public var id: String { date }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = try c.decode(String.self, forKey: .date)
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? "pihenonap"
        sportName = try c.decodeIfPresent(String.self, forKey: .sportName)
        kcal = try c.decodeIfPresent(Int.self, forKey: .kcal) ?? 0
        meals = try c.decodeIfPresent([EvadMenuMeal].self, forKey: .meals) ?? []
    }
}

/// A menu week. `status`: none (no menu yet) · seeding (the season allows no recipe yet) · proposed · approved.
public struct EvadMenuWeek: Codable, Equatable, Sendable {
    public let id: String?
    public let weekStart: String
    public let status: String
    /// The allowed recipes were too few for the week without repeats.
    public let repeated: Bool
    public let allowedCount: Int
    public let recipeCount: Int
    public let days: [EvadMenuDay]

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        weekStart = try c.decode(String.self, forKey: .weekStart)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "none"
        repeated = try c.decodeIfPresent(Bool.self, forKey: .repeated) ?? false
        allowedCount = try c.decodeIfPresent(Int.self, forKey: .allowedCount) ?? 0
        recipeCount = try c.decodeIfPresent(Int.self, forKey: .recipeCount) ?? 0
        days = try c.decodeIfPresent([EvadMenuDay].self, forKey: .days) ?? []
    }

    public var hasMeals: Bool { status == "proposed" || status == "approved" }
}

/// Another allowed recipe for a meal's window.
public struct EvadMenuAlternative: Codable, Equatable, Identifiable, Sendable {
    public let recipeId: String
    public let name: String
    public let kcal: Int
    public let servings: Double
    public let proteinG: Int?
    public let fits: Bool
    public var id: String { recipeId }
}

/// One of his recipes in „Kiválasztott receptek".
public struct EvadRecipeOption: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let category: String?
    public let kcal: Int?
    public let allowed: Bool
    /// His sensitivities and the season's NOVA rule let it into a menu.
    public let usable: Bool
    public let reason: String?
}

/// One shopping-list line. `shelf`: zoldseg · hus · tej · kamra · egyeb.
public struct EvadShoppingItem: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let amountText: String?
    public let shelf: String
    public let forRecipes: [String]
    public var checked: Bool
    public let changed: Bool
    /// A re-fit made it unnecessary — shown under „változott" as no longer needed.
    public let removed: Bool
    public let staple: Bool

    public init(id: String, name: String, amountText: String?, shelf: String, forRecipes: [String] = [],
                checked: Bool = false, changed: Bool = false, removed: Bool = false, staple: Bool = false) {
        self.id = id; self.name = name; self.amountText = amountText; self.shelf = shelf; self.forRecipes = forRecipes
        self.checked = checked; self.changed = changed; self.removed = removed; self.staple = staple
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        amountText = try c.decodeIfPresent(String.self, forKey: .amountText)
        shelf = try c.decodeIfPresent(String.self, forKey: .shelf) ?? "egyeb"
        forRecipes = try c.decodeIfPresent([String].self, forKey: .forRecipes) ?? []
        checked = try c.decodeIfPresent(Bool.self, forKey: .checked) ?? false
        changed = try c.decodeIfPresent(Bool.self, forKey: .changed) ?? false
        removed = try c.decodeIfPresent(Bool.self, forKey: .removed) ?? false
        staple = try c.decodeIfPresent(Bool.self, forKey: .staple) ?? false
    }
}

public struct EvadStapleChip: Codable, Equatable, Identifiable, Sendable {
    public let name: String
    public let onList: Bool
    public var id: String { name }
}

/// The shopping list of an approved menu week.
public struct EvadShoppingList: Codable, Equatable, Sendable {
    public let id: String
    public let weekStart: String
    public var items: [EvadShoppingItem]
    public let staples: [EvadStapleChip]
    public let itemCount: Int
    public let checkedCount: Int
    public let changedCount: Int

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        weekStart = try c.decode(String.self, forKey: .weekStart)
        items = try c.decodeIfPresent([EvadShoppingItem].self, forKey: .items) ?? []
        staples = try c.decodeIfPresent([EvadStapleChip].self, forKey: .staples) ?? []
        itemCount = try c.decodeIfPresent(Int.self, forKey: .itemCount) ?? 0
        checkedCount = try c.decodeIfPresent(Int.self, forKey: .checkedCount) ?? 0
        changedCount = try c.decodeIfPresent(Int.self, forKey: .changedCount) ?? 0
    }
}

public struct EvadShoppingListSummary: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let weekStart: String
    public let itemCount: Int
    public let checkedCount: Int
}

public struct EvadStaples: Codable, Equatable, Sendable {
    public let names: [String]
    public let defaults: Bool?
    public init(names: [String]) { self.names = names; self.defaults = nil }
}

struct EvadWeekStartBody: Encodable { let weekStart: String }
struct EvadRecipeChoiceBody: Encodable { let recipeId: String }
struct EvadRecipeIdsBody: Encodable { let recipeIds: [String] }
struct EvadCheckBody: Encodable { let checked: Bool }
struct EvadStapleToggleBody: Encodable { let name: String; let on: Bool }
