import SwiftUI
import BoopCore
import BoopDesign

// The serving confirmation (B4 Task 11, spike `EServingConfirm`). A scanned product NEVER becomes a line on its own:
// OpenFoodFacts serving data is unreliable (often the whole container), and a catalog hit has none at all. So the owner
// always says how much he ate — per 100 g, the label's serving when there is one, or his own grams.

/// How a scanned product's facts turn into the amount eaten. Pure maths, apart from any view.
struct ServingConfirmation: Equatable {
    enum Mode: Equatable { case basis, serving, grams }

    /// Sanity bounds for the grams field; the slider never reaches them, a typed or carried value might.
    static let maxGrams = 5000.0

    let facts: LookupItem
    var mode: Mode
    var grams: Double

    init(facts: LookupItem) {
        self.facts = facts
        if let q = facts.servingQuantity, q > 0 {
            mode = .serving; grams = q
        } else {
            // No usable serving (a catalog hit has none): grams, starting from the food's own basis.
            mode = .grams; grams = facts.per
        }
    }

    var hasServing: Bool { (facts.servingQuantity ?? 0) > 0 }
    var modes: [Mode] { hasServing ? [.basis, .serving, .grams] : [.basis, .grams] }

    /// What is eaten, in the food's own unit.
    var amount: FoodAmount {
        switch mode {
        case .basis: FoodAmount(amount: facts.per, unit: facts.unit)
        case .serving: FoodAmount(amount: facts.servingQuantity ?? facts.per, unit: facts.unit)
        case .grams: FoodAmount(amount: grams, unit: facts.unit)
        }
    }

    var canConfirm: Bool { amount.amount > 0 && amount.amount <= Self.maxGrams }

    private var factor: Double { facts.per > 0 ? amount.amount / facts.per : 0 }
    var kcal: Double { (facts.kcal ?? 0) * factor }
    var proteinG: Double { (facts.proteinG ?? 0) * factor }
    var carbsG: Double { (facts.carbsG ?? 0) * factor }
    var fatG: Double { (facts.fatG ?? 0) * factor }
    /// "73 kcal · F 9 g · Sz 4 g · Zs 2 g" for the chosen amount; a macro the label does not give reads "nincs adat",
    /// never a made-up zero.
    var macroSummary: String {
        func part(_ label: String, _ per: Double?) -> String {
            per.map { "\(label) \(Int(($0 * factor).rounded())) g" } ?? "\(label) nincs adat"
        }
        let kcalPart = facts.kcal.map { "\(Int(($0 * factor).rounded())) kcal" } ?? "kcal nincs adat"
        return [kcalPart, part("F", facts.proteinG), part("Sz", facts.carbsG), part("Zs", facts.fatG)].joined(separator: " · ")
    }

    /// A product with no calorie figure at all cannot be counted; the line says so ("nézd át") instead of faking a zero.
    var hasNutrition: Bool { facts.kcal != nil }

    /// The composer line for the chosen amount: macros stay per `facts.per`, the amount is what was eaten.
    func line() -> DraftItem {
        DraftItem(source: .estimate, name: facts.name, amount: amount.amount, unit: amount.unit,
                  per: facts.per, basisUnit: facts.unit,
                  kcal: facts.kcal ?? 0, proteinG: facts.proteinG ?? 0, carbsG: facts.carbsG ?? 0, fatG: facts.fatG ?? 0,
                  nova: facts.nova, fiberG: facts.fiberG, sugarG: facts.sugarG, saltG: facts.saltG,
                  saturatedFatG: facts.saturatedFatG, confidence: 1,
                  needsReview: facts.kcal == nil || facts.proteinG == nil || facts.carbsG == nil || facts.fatG == nil, allergens: facts.allergens)
    }

    func label(_ mode: Mode) -> String {
        switch mode {
        case .basis: "\(huAmount(facts.per)) \(facts.unit)"
        case .serving: "1 adag"
        case .grams: facts.unit == "g" ? "Grammra" : "Saját"
        }
    }

    /// "1 adag = 170 g (a csomagoláson)" — the label's own words when it gave them.
    var servingNote: String {
        let size = facts.servingSize.flatMap { $0.isEmpty ? nil : $0 } ?? "\(huAmount(facts.servingQuantity ?? 0)) \(facts.unit)"
        return "1 adag = \(size) (a csomagoláson)"
    }
}

private func huAmount(_ v: Double) -> String {
    v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
}

/// What the product says against the owner's sensitivity list, in a plain sentence. nil = nothing to say. Silence is
/// never "free of": a product with no allergen data at all says so.
func scanSensitivityLine(_ item: LookupItem, profile: SensitivityProfile?) -> String? {
    guard let profile, profile.items.contains(where: \.isStructured) else { return nil }
    let hits = SensitivityRules.badges(allergens: item.allergens, profile: profile).filter { $0.severity != .noData }
    if item.allergens.isEmpty {
        return "Ennél a terméknél nincs allergén-adat, ezért nem tudok róla semmit mondani — ez nem azt jelenti, hogy nincs benne."
    }
    // A key the product does not mention is "no information", not "free of".
    let gaps = SensitivityRules.badges(allergens: item.allergens, profile: profile).filter { $0.severity == .noData }
        .map { allergenName($0.key ?? "") }.joined(separator: ", ")
    let gapLine = gaps.isEmpty ? nil : "\(gaps): nincs adat — ez nem azt jelenti, hogy nincs benne."
    var lines: [String] = []
    if !hits.isEmpty {
        let names = hits.map { allergenName($0.key ?? "") }.joined(separator: ", ")
        lines.append(hits.contains(where: { $0.severity == .block })
            ? "\(names): erre allergiád van, és a termék tartalmazza, vagy nyomokban tartalmazhatja. Rögzíteni tudod, csak szólok."
            : "\(names): a listádon szerepel, és a termék érinti. Rögzíteni tudod, csak szólok.")
    }
    if let gapLine { lines.append(gapLine) }
    return lines.isEmpty ? nil : lines.joined(separator: " ")
}

struct ServingConfirm: View {
    let onConfirm: (DraftItem) -> Void
    let onBack: () -> Void
    @State private var state: ServingConfirmation

    init(facts: LookupItem, onConfirm: @escaping (DraftItem) -> Void, onBack: @escaping () -> Void) {
        _state = State(initialValue: ServingConfirmation(facts: facts))
        self.onConfirm = onConfirm; self.onBack = onBack
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                NKThumb(image: nil, glyph: "bowl-cream", size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.facts.name).nkFont(15.5, .medium).foregroundStyle(.white).lineLimit(2)
                    if let brand = state.facts.brand, !brand.isEmpty { Text(brand).nkFont(12.5).foregroundStyle(.white.opacity(0.55)) }
                }
                Spacer(minLength: 0)
            }
            VStack(alignment: .leading, spacing: 16) {
                Picker("Mennyiség", selection: $state.mode) {
                    ForEach(state.modes, id: \.self) { Text(state.label($0)).tag($0) }
                }
                .pickerStyle(.segmented)
                if state.mode == .grams {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("\(huAmount(state.grams)) \(state.facts.unit)").nkFont(32, .light).foregroundStyle(.white)
                            .minimumScaleFactor(0.6).lineLimit(1)
                        Slider(value: $state.grams, in: 5...max(1000, state.grams), step: 5).tint(.white.opacity(0.8))
                            .accessibilityLabel("Mennyiség")
                    }
                } else {
                    Text(state.mode == .basis ? "\(huAmount(state.facts.per)) \(state.facts.unit)" : state.servingNote)
                        .nkFont(state.mode == .basis ? 32 : 18, .light).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if state.hasNutrition {
                    Text(state.macroSummary)
                        .nkFont(13.5, design: .monospaced).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                } else {
                    Text("Ehhez a termékhez nincs tápérték-adat, ezért a kalóriát nem tudom számolni — a vázlatban kézzel javíthatod.")
                        .nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                }
                Text("A nyilvános adatbázis adagadata gyakran a teljes dobozra vonatkozik, ezért mindig megkérdezem.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                Button { onConfirm(state.line()) } label: {
                    Text("Hozzáadom").nkFont(16, .semibold).foregroundStyle(NK.ground).frame(maxWidth: .infinity).frame(height: 50)
                        .background(Capsule().fill(.white.opacity(state.canConfirm ? 0.95 : 0.3)))
                }
                .buttonStyle(.plain).disabled(!state.canConfirm)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            Button(action: onBack) {
                Text("Vissza").nkFont(15).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity).frame(height: 46)
                    .background(Capsule().fill(.white.opacity(0.1)))
            }
            .buttonStyle(.plain)
        }
    }
}
