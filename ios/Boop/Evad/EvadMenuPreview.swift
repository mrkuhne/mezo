#if DEBUG
import Foundation
import BoopCore

/// Simulator review of the Menü and Lista tabs (Évad S3): the weekly menu and the shopping list answered locally with
/// the approved spike's dishes (invented, "például"). `-evadMenu proposed|approved|seeding|none` picks the state
/// (default proposed); `-evadRepeated YES` marks the week as repeating; `-evadChanged YES` shows a re-fitted list.
final class EvadMenuPreviewModel: @unchecked Sendable {
    nonisolated(unsafe) static let shared = EvadMenuPreviewModel()

    var status = UserDefaults.standard.string(forKey: "evadMenu") ?? "proposed"
    let repeated = UserDefaults.standard.bool(forKey: "evadRepeated")
    let changed = UserDefaults.standard.bool(forKey: "evadChanged")
    var allowed: Set<String> = Set((1...24).map { "r\($0)" })
    var checked: Set<String> = ["i1", "i9"]
    var staplesOn: Set<String> = []
    var staples = ["Olívaolaj", "Kávé", "Tojás", "Só", "Fűszerpaprika", "Citrom"]
    var swaps: [String: (String, Int)] = [:]

    var nextMonday: String { evadAddDays(evadMonday(Date()), 7) }

    private static let days: [(String, String?, [(String, String, String, Int)])] = [
        ("edzesnap", nil, [("breakfast", "Reggeli", "Zabkása laktózmentes joghurttal, áfonyával", 600), ("lunch", "Ebéd", "Csirkés rizstál brokkolival", 760), ("snack", "Uzsonna", "Túró, alma", 300), ("dinner", "Vacsora", "Lazac édesburgonyával, salátával", 780)]),
        ("edzes_sport", "volleyball", [("breakfast", "Reggeli", "Rántotta teljes kiőrlésű pirítóssal", 560), ("lunch", "Ebéd", "Pulykás wok zöldségekkel", 780), ("snack", "Röplabda előtt", "Banán, rizskeksz", 300), ("dinner", "Vacsora", "Marhagulyás, kenyér", 800)]),
        ("pihenonap", nil, [("breakfast", "Reggeli", "Zabkása laktózmentes joghurttal, áfonyával", 560), ("lunch", "Ebéd", "Lencsefőzelék főtt tojással", 700), ("snack", "Uzsonna", "Túró, alma", 300), ("dinner", "Vacsora", "Csirkemell sült zöldséggel", 710)]),
        ("edzes_sport", "volleyball", [("breakfast", "Reggeli", "Rántotta teljes kiőrlésű pirítóssal", 560), ("lunch", "Ebéd", "Csirkés rizstál brokkolival", 760), ("snack", "Röplabda előtt", "Banán, rizskeksz", 300), ("dinner", "Vacsora", "Pulykás wok zöldségekkel", 820)]),
        ("edzesnap", nil, [("breakfast", "Reggeli", "Zabkása laktózmentes joghurttal, áfonyával", 600), ("lunch", "Ebéd", "Marhagulyás, kenyér", 800), ("snack", "Uzsonna", "Túró, alma", 300), ("dinner", "Vacsora", "Lazac édesburgonyával, salátával", 740)]),
        ("edzesnap", nil, [("breakfast", "Reggeli", "Rántotta teljes kiőrlésű pirítóssal", 560), ("lunch", "Ebéd", "Lencsefőzelék főtt tojással", 700), ("snack", "Uzsonna", "Görög joghurt dióval", 360), ("dinner", "Vacsora", "Csirkés rizstál brokkolival", 820)]),
        ("pihenonap", nil, [("breakfast", "Reggeli", "Zabkása laktózmentes joghurttal, áfonyával", 560), ("lunch", "Ebéd", "Marhagulyás, kenyér", 800), ("snack", "Uzsonna", "Túró, alma", 200), ("dinner", "Vacsora", "Csirkemell sült zöldséggel", 710)]),
    ]

    func menuStatus() -> [String: Any] {
        ["weekStart": nextMonday, "weekId": "w1", "status": status, "menuDay": 6, "menuTime": "18:00"]
    }

    func week(weekStart: String) -> [String: Any] {
        let isNext = weekStart == nextMonday
        let st = isNext ? (allowed.isEmpty ? "seeding" : status) : (allowed.isEmpty ? "seeding" : "none")
        var days: [[String: Any]] = []
        if st == "proposed" || st == "approved" {
            for (i, d) in Self.days.enumerated() {
                let meals: [[String: Any]] = d.2.enumerated().map { j, m in
                    let id = "m\(i)-\(j)"
                    let s = swaps[id]
                    return ["id": id, "slot": m.0, "label": m.1, "recipeId": "r\(j + 1)", "name": s?.0 ?? m.2,
                            "servings": 1.25, "kcal": s?.1 ?? m.3, "proteinG": 35, "preSession": m.1.hasSuffix("előtt"),
                            "locked": s != nil, "changed": changed && i >= 3 && j == 3]
                }
                days.append(["date": evadAddDays(weekStart, i), "kind": d.0, "sportName": d.1 as Any,
                             "kcal": meals.reduce(0) { $0 + ($1["kcal"] as? Int ?? 0) }, "meals": meals])
            }
        }
        return ["id": "w1", "weekStart": weekStart, "status": st, "repeated": repeated,
                "allowedCount": allowed.count, "recipeCount": 53, "days": days]
    }

    func list() -> [String: Any] {
        let rows: [(String, String, String?, String, [String])] = [
            ("i1", "Brokkoli", "600 g", "zoldseg", ["Csirkés rizstál ×3"]),
            ("i2", "Édesburgonya", "1 kg", "zoldseg", ["Lazac ×2"]),
            ("i3", "Áfonya", "500 g", "zoldseg", ["Zabkása ×4"]),
            ("i4", "Alma", "1,2 kg", "zoldseg", ["Túró, alma ×4"]),
            ("i5", "Csirkemell", "1,4 kg", "hus", ["Csirkés rizstál ×3", "Csirkemell sült zöldséggel ×2"]),
            ("i6", "Lazacfilé", "500 g", "hus", ["Lazac ×2"]),
            ("i7", "Darált pulyka", "600 g", "hus", ["Pulykás wok ×2"]),
            ("i8", "Laktózmentes joghurt", "1,6 kg", "tej", ["Zabkása ×4"]),
            ("i9", "Zabpehely", "500 g", "kamra", ["Zabkása ×4"]),
            ("i10", "Basmati rizs", "450 g", "kamra", ["Csirkés rizstál ×3"]),
            ("i11", "Vörös lencse", "300 g", "kamra", ["Lencsefőzelék ×2"]),
        ]
        var items: [[String: Any]] = rows.map { r in
            ["id": r.0, "name": r.1, "amountText": r.2 as Any, "shelf": r.3, "forRecipes": r.4,
             "checked": checked.contains(r.0), "changed": changed && r.0 == "i5", "removed": false, "staple": false]
        }
        if changed {
            items.append(["id": "i12", "name": "Marhalábszár", "amountText": NSNull(), "shelf": "hus", "forRecipes": [],
                          "checked": false, "changed": true, "removed": true, "staple": false])
        }
        for s in staples where staplesOn.contains(s) {
            items.append(["id": "s-\(s)", "name": s, "amountText": NSNull(), "shelf": "egyeb", "forRecipes": [],
                          "checked": checked.contains("s-\(s)"), "changed": false, "removed": false, "staple": true])
        }
        return ["id": "l1", "weekStart": nextMonday, "items": items,
                "staples": staples.map { ["name": $0, "onList": staplesOn.contains($0)] },
                "itemCount": items.count, "checkedCount": checked.count, "changedCount": changed ? 2 : 0]
    }

    /// nil = not a menu operation.
    func answer(_ op: String, path: String, sent: [String: Any]) -> (Int, Any)? {
        let query = path.split(separator: "=").last.map(String.init) ?? nextMonday
        switch op {
        case "getMenuWeek": return (200, week(weekStart: query))
        case "generateMenuWeek":
            if status == "approved" { return (409, ["messages": [["code": "MENU_NOT_PROPOSED"]]]) }
            status = "proposed"; swaps = [:]
            return (200, week(weekStart: sent["weekStart"] as? String ?? nextMonday))
        case "approveMenuWeek": status = "approved"; return (200, week(weekStart: nextMonday))
        case "listMenuAlternatives":
            return (200, [["recipeId": "r30", "name": "Pulykás wok zöldségekkel", "kcal": 770, "servings": 1.0, "proteinG": 42, "fits": true],
                          ["recipeId": "r31", "name": "Marhagulyás, kenyér", "kcal": 790, "servings": 1.25, "proteinG": 38, "fits": true],
                          ["recipeId": "r32", "name": "Lencsefőzelék főtt tojással", "kcal": 640, "servings": 1.5, "proteinG": 30, "fits": false]])
        case "swapMenuMeal":
            let id = path.split(separator: "/").last.map(String.init) ?? ""
            swaps[id] = ("Pulykás wok zöldségekkel", 770)
            return (200, week(weekStart: nextMonday))
        case "listSeasonRecipes":
            let names = ["breakfast": ["Zabkása laktózmentes joghurttal", "Rántotta pirítóssal", "Tejbegríz"],
                         "lunch": ["Csirkés rizstál brokkolival", "Pulykás wok", "Lencsefőzelék"],
                         "dinner": ["Lazac édesburgonyával", "Marhagulyás", "Csirkemell sült zöldséggel", "Virsli mustárral"],
                         "snack": ["Túró, alma", "Banán, rizskeksz", "Görög joghurt dióval"]]
            var out: [[String: Any]] = []
            var n = 0
            for cat in ["breakfast", "lunch", "dinner", "snack"] {
                for name in names[cat] ?? [] {
                    n += 1
                    let blocked = name == "Virsli mustárral" ? "feldolgozottabb, mint az évad szabálya engedi"
                        : name == "Tejbegríz" ? "ütközik az érzékenységeiddel" : nil
                    out.append(["id": "r\(n)", "name": name, "category": cat, "kcal": 400 + n * 20,
                                "allowed": blocked == nil && allowed.contains("r\(n)"), "usable": blocked == nil,
                                "reason": blocked as Any])
                }
            }
            return (200, out)
        case "putSeasonRecipes":
            allowed = Set(sent["recipeIds"] as? [String] ?? [])
            return nil // the season answer comes from the main model
        case "getShoppingList":
            return status == "approved" && query == nextMonday ? (200, list()) : (404, ["messages": [["code": "RESOURCE_NOT_FOUND"]]])
        case "listShoppingLists":
            return (200, [["id": "l0", "weekStart": evadAddDays(nextMonday, -7), "itemCount": 14, "checkedCount": 13]])
        case "checkShoppingItem":
            let id = path.split(separator: "/").last.map(String.init) ?? ""
            let on = sent["checked"] as? Bool ?? false
            if on { checked.insert(id) } else { checked.remove(id) }
            return (200, ["id": id, "name": id, "shelf": "egyeb", "forRecipes": [], "checked": on, "changed": false, "staple": false])
        case "toggleShoppingStaple":
            let name = sent["name"] as? String ?? ""
            if sent["on"] as? Bool ?? false { staplesOn.insert(name) } else { staplesOn.remove(name) }
            return (200, list())
        case "listStaples": return (200, ["names": staples, "defaults": true])
        case "putStaples": staples = sent["names"] as? [String] ?? staples; return (200, ["names": staples, "defaults": false])
        default: return nil
        }
    }
}
#endif
