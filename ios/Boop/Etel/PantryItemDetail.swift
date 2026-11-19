import SwiftUI
import BoopCore
import BoopDesign

// A shelf or catalog food, opened (a sheet at the room's page level): what it is per 100 g, its NOVA level, what it says
// about the owner's allergens (a gap reads "nincs adat", never "free of") and where its facts came from. No prices, stock
// or expiry. Two actions: eat some of it (the serving confirmation) and, for a catalog food, put it on the shelf.

struct PantryItemDetailSheet: View {
    let row: PantryRow
    let store: EtelStore
    let onEat: (LookupItem) -> Void
    let onToast: (String) -> Void
    /// „Pontosítom" on an estimated food: the room opens that reader on this same food.
    var onRefine: (PantryAddRoute) -> Void = { _ in }
    @Environment(\.dismiss) private var dismiss
    @State private var adding = false
    @State private var breakdown: MealBreakdown?
    /// The dimension whose explanation is open (a sheet over this sheet).
    @State private var dimension: DimensionSelection?

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: row.onShelf ? "A KAMRÁDBÓL" : "A KATALÓGUSBÓL", title: row.name) {
            header
            if kamraShowsEstimate(row) && row.onShelf { refine }
            score
            facts
            nova
            sensitivity
            provenance
        }
        .task(id: row.rowKey) { breakdown = await store.shelfBreakdown(row) }
        .sheet(item: Binding(get: { [d = dimension] in d }, set: { dimension = $0 })) { d in
            DimensionSheet(selection: d)
        }
    }

    /// What the food is, in pills, its macros on its own basis, and the two things he can do with it.
    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                EtelMedallion(glyph: etelCategoryGlyph(row.category), size: 52, lit: true)
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    if kamraShowsEstimate(row) { EtelPill(text: "becsült", tone: .warn) }
                    EtelPill(text: NewPantryFood.categoryLabel(row.category) ?? "Egyéb", tone: .hue)
                    if let brand = row.brand, !brand.isEmpty { EtelPill(text: brand) }
                    if let n = row.nova { EtelPill(text: "NOVA \(n)", tone: n >= 3 ? .outline : .plain) }
                    EtelPill(text: row.onShelf ? "a polcodon" : "katalógus", tone: row.onShelf ? .plain : .muted)
                }
                .padding(.top, 2)
            }
            VStack(alignment: .leading, spacing: 8) {
                NKMono(factsHeading(row))
                EtelMacroTiles(kcal: row.kcal, p: row.proteinG, c: row.carbsG, f: row.fatG)
            }
            if let facts = row.servingFacts {
                NKPill("Megeszem belőle", glyph: "plate-deep") { dismiss(); onEat(facts) }
            } else {
                Text("Ehhez nincs mértékegység-adat, ezért a mennyiséget most nem tudom kiszámolni.").nkFont(13.5).foregroundStyle(.white.opacity(0.65))
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !row.onShelf {
                Button { Task { await addToShelf() } } label: {
                    Text(adding ? "Felveszem…" : "Felveszem a kamrámba").nkFont(15, .medium).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(minHeight: 46)
                        .background(Capsule().fill(.white.opacity(0.1)).overlay(Capsule().stroke(.white.opacity(0.18))))
                }
                .buttonStyle(.plain).disabled(adding)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    /// An estimated food: say so, and offer the three readers that replace the estimate on this same food.
    private var refine: some View {
        EtelSheetCard(label: "PONTOSÍTOM") {
            NKFlowRow(spacing: 6, rowSpacing: 6) {
                EtelPill(text: "becsült", tone: .warn)
                EtelPill(text: "Boop becslése", glyph: "spark-cream")
                EtelPill(text: "nincs NOVA, nincs allergén-adat", tone: .muted)
            }
            Text("Ezt a tápértéket Boop becsülte. Olvasd be a csomagolást, és a pontos számok ugyanehhez az ételhez kerülnek — a receptjeid is ezzel számolnak tovább.")
                .nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                reader("search-ink", "Vonalkód", primary: true) { onRefine(.barcode) }
                reader("camera-ink", "Címkefotó") { onRefine(.label) }
                reader("plus-ink", "Kézzel") { onRefine(.manual) }
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Color(red: 0.96, green: 0.78, blue: 0.38).opacity(0.45)))
    }

    private func reader(_ glyph: String, _ title: String, primary: Bool = false, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 7) {
                NKGlyph(glyph, primary ? NK.ground : .white, size: 18)
                Text(title).nkFont(12.5, .semibold).foregroundStyle(primary ? NK.ground : .white.opacity(0.9)).lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity).frame(height: 64)
            .background {
                let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
                if primary { shape.fill(.white.opacity(0.95)) } else { shape.fill(.white.opacity(0.08)).overlay(shape.stroke(.white.opacity(0.14))) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Pontosítom: \(title)")
    }

    /// The food's own score and what it is judged on — only the dimensions a single food can be judged by.
    @ViewBuilder private var score: some View {
        let points = store.shelfPoints(row)
        EtelSheetCard(label: "BOOP ÉRTÉKELÉSE", trailing: "önmagában") {
            HStack(alignment: .center, spacing: 14) {
                EtelScoreRing(points: points, size: 64)
                Text(points == nil ? "Ehhez az ételhez még kevés az adat a pontszámhoz." : "az étel saját pontszáma — a feldolgozottság, a cukor-só-telített zsír, a rost, a zsír minősége és az energiasűrűség alapján")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            if let b = breakdown {
                DimensionGrid(entries: recipeBreakdownRows(b)) { entry in
                    dimension = DimensionSelection(entry: entry, mealTitle: row.name, coachNote: nil)
                }
                Text("Koppints egy szempontra, és megmutatom, miért annyi.").nkFont(12).foregroundStyle(.white.opacity(0.45))
            }
        }
    }

    /// Everything the label says beyond the four macros, on the food's own basis; a gap is a "nincs adat" pill.
    private var facts: some View {
        EtelSheetCard(label: "A CÍMKE TÖBBI SORA", trailing: shelfBasis(row)) {
            VStack(spacing: 0) {
                // the four macros stand in the tiles above; here is what the label says beyond them
                ForEach(Array(factRows(row).dropFirst(4).enumerated()), id: \.element.name) { k, f in
                    if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    HStack {
                        Text(f.name).nkFont(14.5).foregroundStyle(.white.opacity(0.85))
                        Spacer(minLength: 6)
                        if f.value == "nincs adat" {
                            EtelPill(text: "nincs adat", tone: .muted)
                        } else {
                            Text(f.value).font(.custom(Lagy.outfitFamily, size: 15).weight(.medium)).foregroundStyle(.white.opacity(0.95)).monospacedDigit()
                        }
                    }
                    .padding(.vertical, 8)
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    private var nova: some View {
        EtelSheetCard(label: "FELDOLGOZOTTSÁG") {
            EtelNovaScale(nova: row.nova, limit: store.profile.flatMap { $0.novaRule.enabled ? $0.novaRule.maxLevel : nil })
        }
    }

    private var sensitivity: some View {
        EtelSheetCard(label: "AMIRE FIGYELSZ") {
            let watched = etelAllergenFacts(row.allergens, profile: store.profile)
            if store.profile == nil {
                Text("A szabályaidat most nem érem el, ezért az érzékenységet nem tudom vetni a termékhez.").nkFont(14).foregroundStyle(.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            } else if watched.isEmpty {
                Text("Nincs megadott allergén-szabályod, ezért nincs mihez vetnem.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            } else {
                EtelAllergenRows(facts: watched)
                if watched.contains(where: { $0.state == .noData }) {
                    Text("A „nincs adat” nem azt jelenti, hogy nincs benne.").nkFont(12).foregroundStyle(.white.opacity(0.5))
                }
            }
            let declared = declaredAllergens(row)
            if declared.isEmpty && row.allergens.isEmpty {
                Text("Ennél a terméknél nincs allergén-adat.").nkFont(13).foregroundStyle(.white.opacity(0.55))
            } else if !declared.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    NKMono("A TERMÉK SZERINT")
                    NKFlowRow(spacing: 6, rowSpacing: 6) { ForEach(declared, id: \.self) { EtelPill(text: $0) } }
                }
            }
        }
    }

    private var provenance: some View {
        EtelSheetCard(label: "HONNAN VAN") {
            NKFlowRow(spacing: 6, rowSpacing: 6) { ForEach(provenanceLines(row), id: \.self) { EtelPill(text: $0, glyph: "link-deep") } }
        }
    }

    private func addToShelf() async {
        guard let food = store.currentFood else { onToast("Most nem tudom felvenni"); return }
        adding = true; defer { adding = false }
        do {
            let shelf = try await food.addFromCatalog(row)
            store.shelfAdded(shelf)
            dismiss()
            onToast("\(row.name) a kamrádban")
        } catch FoodFetchError.offline {
            onToast("Nincs net — ehhez kell")
        } catch {
            onToast("Most nem sikerült felvenni")
        }
    }
}
