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
    @Environment(\.dismiss) private var dismiss
    @State private var adding = false

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: row.onShelf ? "A KAMRÁDBÓL" : "A KATALÓGUSBÓL", title: row.name) {
            header
            facts
            nova
            sensitivity
            provenance
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                NKThumb(image: nil, glyph: "bowl-sage", size: 48)
                VStack(alignment: .leading, spacing: 2) {
                    if let brand = row.brand, !brand.isEmpty { Text(brand).nkFont(14).foregroundStyle(.white.opacity(0.8)) }
                    Text(NewPantryFood.categoryLabel(row.category) ?? "Egyéb").nkFont(13).foregroundStyle(.white.opacity(0.55))
                }
                Spacer(minLength: 0)
            }
            if let facts = row.servingFacts {
                NKPill("Megeszem belőle", glyph: "plate-deep") { dismiss(); onEat(facts) }
            } else {
                Text("Ehhez nincs mértékegység-adat, ezért a mennyiséget most nem tudom kiszámolni.").nkFont(13.5).foregroundStyle(.white.opacity(0.65))
            }
            if !row.onShelf {
                Button { Task { await addToShelf() } } label: {
                    Text(adding ? "Felveszem…" : "Felveszem a kamrámba").nkFont(15, .medium).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(minHeight: 46).background(Capsule().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain).disabled(adding)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private var facts: some View {
        card(factsHeading(row)) {
            ForEach(factRows(row), id: \.name) { f in
                HStack {
                    Text(f.name).nkFont(14.5).foregroundStyle(.white.opacity(0.85))
                    Spacer(minLength: 6)
                    Text(f.value).nkFont(13.5, design: .monospaced).foregroundStyle(.white.opacity(f.value == "nincs adat" ? 0.45 : 0.95))
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private var nova: some View {
        card("FELDOLGOZOTTSÁG") {
            Text(novaLine(row.nova, profile: store.profile)).nkFont(15).foregroundStyle(.white.opacity(row.nova == nil ? 0.55 : 0.95))
        }
    }

    private var sensitivity: some View {
        card("ÉRZÉKENYSÉG") {
            let lines = sensitivityLines(row, profile: store.profile)
            if store.profile == nil {
                Text("A szabályaidat most nem érem el, ezért az érzékenységet nem tudom vetni a termékhez.").nkFont(14).foregroundStyle(.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            } else if lines.isEmpty {
                Text("Nincs megadott allergén-szabályod, ezért nincs mihez vetnem.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            }
            ForEach(lines, id: \.self) { Text($0).nkFont(14.5).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true) }
            let declared = declaredAllergens(row)
            if declared.isEmpty && row.allergens.isEmpty {
                Text("Ennél a terméknél nincs allergén-adat.").nkFont(13).foregroundStyle(.white.opacity(0.55))
            } else if !declared.isEmpty {
                Text("A termék szerint: " + declared.joined(separator: " · ")).nkFont(13).foregroundStyle(.white.opacity(0.65))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var provenance: some View {
        card("HONNAN VAN") {
            ForEach(provenanceLines(row), id: \.self) { Text($0).nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true) }
        }
    }

    private func card<C: View>(_ label: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            NKMono(label)
            content()
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
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
