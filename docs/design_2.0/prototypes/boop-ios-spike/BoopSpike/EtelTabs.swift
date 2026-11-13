import SwiftUI

// B4 Étel spike — the `Receptek`, `Kamra` and `Hét` tabs.

// MARK: - Receptek

struct EtelReceptek: View {
    let onOpen: (String) -> Void
    let onToast: (String) -> Void
    @State private var query = ""

    var body: some View {
        VStack(spacing: 14) {
            ESection(n: 1, label: "ÚJ RECEPT") {
                VStack(spacing: 10) {
                    importRow("link-deep", "Beillesztek egy linket", "a receptoldalról kiolvasom", primary: true)
                    importRow("camera-ink", "Lefotózom a receptet", "könyvből vagy képernyőről")
                    importRow("chat-ink", "Receptműhely", "Boop kitalál egyet a szabályaid szerint")
                }
            }
            ESection(n: 2, label: "A KÖNYVTÁRAD · 8 RECEPT") {
                VStack(spacing: 12) {
                    searchField
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        ForEach(Array(EData.recipes.enumerated()), id: \.offset) { _, r in
                            recipeCard(r)
                        }
                    }
                }
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            AuraGlyph("search-ink", .white.opacity(0.6), size: 16)
            TextField("", text: $query, prompt: Text("Keresés a receptek között").foregroundStyle(.white.opacity(0.45)))
                .font(.system(size: 15)).foregroundStyle(.white)
        }
        .padding(.horizontal, 16).frame(height: 46)
        .background(Capsule().fill(.white.opacity(0.08)))
        .overlay(Capsule().stroke(.white.opacity(0.12)))
    }

    private func importRow(_ glyph: String, _ title: String, _ sub: String, primary: Bool = false) -> some View {
        Button { onOpen("recept-import") } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(primary ? .white.opacity(0.9) : .white.opacity(0.08))
                    AuraGlyph(glyph, primary ? gBase : .white, size: 17)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white)
                    Text(sub).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func recipeCard(_ r: (String, String, Int, Int, Int, [EFlag])) -> some View {
        Button { onToast("Megnyitom: \(r.0)") } label: {
            VStack(alignment: .leading, spacing: 0) {
                photo(r.1).resizable().scaledToFill().saturation(0.8).brightness(-0.06)
                    .frame(height: 96).frame(maxWidth: .infinity).clipped()
                VStack(alignment: .leading, spacing: 6) {
                    Text(r.0).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                        .lineLimit(2, reservesSpace: true).multilineTextAlignment(.leading)
                    Text("\(r.3) kcal · \(r.4) g fehérje · \(r.2) adag")
                        .font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.6))
                    if let f = r.5.first { EFlagBadge(flag: f) }
                }
                .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.07)))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.white.opacity(0.1)))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Kamra

struct EtelKamra: View {
    let onOpen: (String) -> Void
    let onToast: (String) -> Void
    @State private var query = ""

    var body: some View {
        VStack(spacing: 14) {
            ESection(n: 1, label: "FELVESZEK EGYET") {
                HStack(spacing: 8) {
                    addChip("search-ink", "Vonalkód", primary: true) { onOpen("barcode") }
                    addChip("link-deep", "Link") { onOpen("recept-import") }
                    addChip("camera-ink", "Címkefotó") { onToast("Lefotózom a címkét") }
                    addChip("plus-ink", "Kézzel") { onToast("Kézi felvitel") }
                }
            }
            ESection(n: 2, label: "A KAMRÁD · 309 TÉTEL") {
                VStack(spacing: 0) {
                    HStack(spacing: 10) {
                        AuraGlyph("search-ink", .white.opacity(0.6), size: 16)
                        TextField("", text: $query, prompt: Text("Keresés a kamrában és a katalógusban").foregroundStyle(.white.opacity(0.45)))
                            .font(.system(size: 15)).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 16).frame(height: 46)
                    .background(Capsule().fill(.white.opacity(0.08)))
                    .overlay(Capsule().stroke(.white.opacity(0.12)))
                    .padding(.bottom, 6)
                    ForEach(Array(EData.pantry.enumerated()), id: \.offset) { k, item in
                        Button { onToast("Megnyitom: \(item.0)") } label: {
                            HStack(spacing: 12) {
                                EThumb(name: item.1, glyph: "bowl-sage", size: 42)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.0).font(.system(size: 15, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                                    HStack(spacing: 6) {
                                        Text(item.2).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
                                        Text("NOVA \(item.3)").font(AuraFont.mono(10.5))
                                            .foregroundStyle(item.3 >= 3 ? Color(hex: 0xF4C860).opacity(0.9) : .white.opacity(0.45))
                                    }
                                }
                                Spacer()
                                if let f = item.5.first { EFlagBadge(flag: f) }
                                else { Text("nincs adat").font(.system(size: 11)).foregroundStyle(.white.opacity(0.35)) }
                            }
                            .padding(.vertical, 11).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        if k < EData.pantry.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    }
                }
            }
            ESection(n: 3, label: "BEÁLLÍTÁSOK") {
                VStack(spacing: 10) {
                    settingRow("Amit kerülök", "laktóz · feldolgozott 3-tól") { onOpen("erzekenyseg") }
                    settingRow("Étrend-beállítások", "kiegyensúlyozott · magas fehérje · 3 000 ml víz") { onToast("Étrend-beállítások") }
                    settingRow("Napi ritmus", "3 főétkezés + 2 nassolás") { onToast("Napi ritmus") }
                }
            }
        }
    }

    private func addChip(_ glyph: String, _ title: String, primary: Bool = false, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                AuraGlyph(glyph, primary ? gBase : .white, size: 18)
                Text(title).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(primary ? gBase : .white)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity).frame(height: 62)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(primary ? .white.opacity(0.92) : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }

    private func settingRow(_ title: String, _ sub: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                    Text(sub).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.55))
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Hét

struct EtelHet: View {
    let onToast: (String) -> Void

    var body: some View {
        VStack(spacing: 14) {
            ESection(n: 1, label: "KALÓRIA · 7 NAP") {
                VStack(alignment: .leading, spacing: 10) {
                    WeekBars(values: EData.week, avg: 2350, unit: "", lowIsGood: false).frame(height: 140)
                    Text("A vonal a napi célod: 2 350 kcal. A mai nap még tart.")
                        .font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                }
            }
            ESection(n: 2, label: "A NAPOK MÖGÖTTE") {
                VStack(spacing: 0) {
                    ForEach(Array(days.enumerated()), id: \.offset) { k, d in
                        Button { onToast("Megnyitom: \(d.0)") } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(d.0).font(.system(size: 15, weight: k == 0 ? .semibold : .regular)).foregroundStyle(.white)
                                    if !d.2.isEmpty {
                                        Text(d.2).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                                    }
                                }
                                Spacer()
                                Text(d.1).font(AuraFont.mono(12.5)).foregroundStyle(.white.opacity(0.8))
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.35))
                            }
                            .padding(.vertical, 11).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        if k < days.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    }
                }
            }
            ESection(n: 3, label: "A HÉT ÖSSZESEN") {
                VStack(spacing: 10) {
                    total("Átlagos kalória", "2 213 kcal", "a cél 2 350")
                    total("Átlagos fehérje", "142 g", "a cél 165 g")
                    total("Kihagyott étkezés", "2", "mindkettő utazás miatt")
                    total("Kímélő nap", "1", "csütörtök · gyomorrontás")
                }
            }
        }
    }

    private let days: [(String, String, String)] = [
        ("Ma", "1 443 kcal", "még tart · 3 étkezés"),
        ("Vasárnap", "2 200 kcal", "pihenőnap"),
        ("Szombat", "2 620 kcal", "edzésnap · +300 kcal keret"),
        ("Péntek", "2 390 kcal", ""),
        ("Csütörtök", "2 150 kcal", "kímélő nap · nem értékeltem"),
        ("Szerda", "2 410 kcal", ""),
        ("Kedd", "2 280 kcal", "ebéd kihagyva · utazás"),
    ]

    private func total(_ name: String, _ value: String, _ sub: String) -> some View {
        HStack(spacing: 12) {
            Text(name).font(.system(size: 14.5)).foregroundStyle(.white.opacity(0.85))
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(value).font(AuraFont.mono(13.5)).foregroundStyle(.white)
                Text(sub).font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.5))
            }
        }
        .accessibilityElement(children: .combine)
    }
}
