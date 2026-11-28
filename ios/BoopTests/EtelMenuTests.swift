import Foundation
import Testing
import BoopCore
@testable import Boop

/// „Menübe jöhet" on a recipe and the menu's count line (`mezo-r36n9.196`, plan Task 16).
struct EtelMenuTests {
    func recipe(_ name: String = "Csirkés rizs") -> Recipe {
        Recipe(id: UUID(), name: name, category: "lunch", servings: 2, macros: Macros(kcal: 900, p: 70, c: 90, f: 20))
    }

    func option(_ r: Recipe, allowed: Bool = false, usable: Bool = true, reason: String? = nil) throws -> EvadRecipeOption {
        var o: [String: Any] = ["id": r.id.uuidString.lowercased(), "name": r.name, "allowed": allowed, "usable": usable]
        if let reason { o["reason"] = reason }
        return try JSONDecoder().decode(EvadRecipeOption.self, from: JSONSerialization.data(withJSONObject: o))
    }

    @Test func toggleHiddenWithoutSeason() throws {
        let r = recipe()
        #expect(etelMenuToggle(r, options: [try option(r, allowed: true)], hasSeason: false) == .hidden)
        #expect(etelMenuToggle(r, options: nil, hasSeason: true) == .hidden, "options not loaded yet")
        #expect(etelMenuToggle(r, options: [try option(recipe("Más"))], hasSeason: true) == .hidden, "the server does not know it")
    }

    @Test func toggleBlockedShowsReason() throws {
        let r = recipe()
        #expect(etelMenuToggle(r, options: [try option(r, usable: false, reason: "laktózt tartalmaz")], hasSeason: true)
                == .blocked("laktózt tartalmaz"))
        #expect(etelMenuToggle(r, options: [try option(r, usable: false)], hasSeason: true) == .blocked("nem fér a szabályaidba"))
        #expect(etelMenuToggle(r, options: [try option(r, usable: false, reason: "")], hasSeason: true) == .blocked("nem fér a szabályaidba"))
    }

    @Test func toggleOnOff() throws {
        let r = recipe()
        #expect(etelMenuToggle(r, options: [try option(r, allowed: true)], hasSeason: true) == .on)
        #expect(etelMenuToggle(r, options: [try option(r, allowed: false)], hasSeason: true) == .off)
        // the store's set (with his unconfirmed taps) wins over the server's option
        #expect(etelMenuToggle(r, options: [try option(r, allowed: false)], hasSeason: true, allowed: [etelMenuKey(r)]) == .on)
        #expect(etelMenuToggle(r, options: [try option(r, allowed: true)], hasSeason: true, allowed: []) == .off)
    }

    @Test func filterMatchesLowercasedUUID() {
        let a = recipe("A"), b = recipe("B")
        #expect(etelMenuKey(a) == a.id.uuidString.lowercased())
        #expect(etelMenuFilter([a, b], allowed: [etelMenuKey(b)]).map(\.name) == ["B"])
        #expect(etelMenuFilter([a, b], allowed: [b.id.uuidString.uppercased()]).isEmpty, "the server sends lowercase ids")
    }

    @Test func countLine() {
        #expect(etelMenuCountLine(0) == "0 recept a menüben")
        #expect(etelMenuCountLine(7) == "7 recept a menüben")
        #expect(etelMenuTag("proposed") == "javaslat" && etelMenuTag("approved") == "jóváhagyva")
    }
}
