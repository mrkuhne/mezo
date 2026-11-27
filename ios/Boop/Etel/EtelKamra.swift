import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// B4 Étel — the `Kamra` tab: the owner's shelf and the shared catalog, with the four ways to put a food on it. As plain
// functions and values first (the views only draw their answers). Not ported, on purpose: prices, stock levels, expiry.

// MARK: - Search and filter

private func folded(_ text: String) -> String {
    text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "hu_HU"))
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

/// The category a shelf row sits under: its own when the picker knows it, otherwise "Egyéb" — an unclassified food is
/// listed, never hidden.
func shelfCategoryKey(_ row: PantryRow) -> String {
    guard let c = row.category, NewPantryFood.categories.contains(where: { $0.key == c }) else { return "other" }
    return c
}

/// The shelf narrowed by a typed name (ignoring case and accents) and a category. Blank query / nil category = everything.
func filterShelf(_ rows: [PantryRow], query: String, category: String?) -> [PantryRow] {
    let q = folded(query)
    return rows.filter { r in
        (category == nil || shelfCategoryKey(r) == category) && (q.isEmpty || folded(r.name).contains(q) || folded(r.brand ?? "").contains(q))
    }
}

struct ShelfCategory: Equatable, Identifiable {
    let key: String
    let label: String
    let count: Int
    var id: String { key }
}

/// The categories the shelf actually holds, biggest first (ties in the picker's own order), with their counts.
func shelfCategories(_ rows: [PantryRow]) -> [ShelfCategory] {
    var counts: [String: Int] = [:]
    for r in rows { counts[shelfCategoryKey(r), default: 0] += 1 }
    let order = NewPantryFood.categories.map(\.key)
    return counts.map { ShelfCategory(key: $0.key, label: NewPantryFood.categoryLabel($0.key) ?? $0.key, count: $0.value) }
        .sorted { a, b in a.count != b.count ? a.count > b.count : (order.firstIndex(of: a.key) ?? 99) < (order.firstIndex(of: b.key) ?? 99) }
}

/// Catalog hits the owner does not already have on the shelf.
func catalogOnly(_ hits: [PantryRow], shelf: [PantryRow]) -> [PantryRow] {
    let owned = Set(shelf.compactMap(\.catalogId))
    return hits.filter { h in !(h.catalogId.map(owned.contains) ?? false) }
}

// MARK: - Sensitivity states

/// What a row says about the owner's watched allergens. Silence is never "free of": a food whose map lacks a watched
/// key — or has no map at all — reads `.noData`; `.nothing` only when the owner watches nothing structured, or the
/// food's own data says every watched key is clear of a flag.
enum PantrySensitivity: Equatable {
    case flagged([DraftBadge])
    case noData
    case nothing
}

func pantrySensitivity(_ r: PantryRow, profile: SensitivityProfile?) -> PantrySensitivity {
    guard let profile else { return .nothing }
    let watched = profile.items.filter(\.isStructured)
    guard !watched.isEmpty else { return .nothing }
    let flagged = SensitivityRules.badges(allergens: r.allergens, profile: profile).filter { $0.severity != .noData }.map { b -> DraftBadge in
        let tone: DraftBadge.Tone = switch b.severity { case .block: .stop; case .warn: .warn; default: .notice }
        return DraftBadge(text: "\(allergenName(b.key ?? "")) · \(b.text)", tone: tone)
    }
    if !flagged.isEmpty { return .flagged(flagged) }
    let gap = watched.contains { item in
        switch r.allergens[item.key.lowercased()] { case nil, .unknown?: true; default: false }
    }
    return gap ? .noData : .nothing
}

/// The detail page's sentences about the owner's rules and this food, one per watched key. A key the food does not
/// carry is "nincs adat" — and the sentence says that this is not "free of".
func sensitivityLines(_ r: PantryRow, profile: SensitivityProfile?) -> [String] {
    guard let profile else { return [] }
    return profile.items.filter(\.isStructured).map { item in
        let key = item.key.lowercased(), name = allergenName(key)
        switch r.allergens[key] {
        case .contains?, .traces?:
            if let b = SensitivityRules.badge(for: r.allergens[key], level: item.level), b.severity != .noData { return "\(name) · \(b.text)" }
            return "\(name): nyomokban"
        case .unknown?, nil:
            return "\(name): nincs adat — ez nem azt jelenti, hogy nincs benne."
        }
    }
}

/// What the product itself declares, as it says it (an unknown state declares nothing).
func declaredAllergens(_ r: PantryRow) -> [String] {
    r.allergens.sorted { $0.key < $1.key }.compactMap { key, state in
        switch state {
        case .contains: "\(allergenName(key)): tartalmazza"
        case .traces: "\(allergenName(key)): nyomokban"
        case .unknown: nil
        }
    }
}

// MARK: - Facts, NOVA, provenance

func huNumber(_ v: Double) -> String {
    v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
}

struct FactRow: Equatable {
    let name: String
    let value: String
}

/// "100 G-RA" / "1 DB-RA" / "100 ML-RE": the basis the facts are for.
func factsHeading(_ r: PantryRow) -> String {
    let per = r.per ?? 100, unit = (r.unit ?? "g").uppercased()
    return "\(huNumber(per)) \(unit)-\(unit == "ML" ? "RE" : "RA")"
}

/// The per-basis facts of a food; whatever the server does not know reads "nincs adat", never a made-up zero.
func factRows(_ r: PantryRow) -> [FactRow] {
    func g(_ v: Double?) -> String { v.map { "\(huNumber($0)) g" } ?? "nincs adat" }
    return [FactRow(name: "Energia", value: r.kcal.map { "\(huNumber($0)) kcal" } ?? "nincs adat"),
            FactRow(name: "Fehérje", value: g(r.proteinG)), FactRow(name: "Szénhidrát", value: g(r.carbsG)),
            FactRow(name: "Zsír", value: g(r.fatG)), FactRow(name: "Rost", value: g(r.fiberG)),
            FactRow(name: "Cukor", value: g(r.sugarG)), FactRow(name: "Só", value: g(r.saltG)),
            FactRow(name: "Telített zsír", value: g(r.saturatedFatG))]
}

/// The NOVA level in words; over the owner's own limit it says so. nil = the food was never classified.
func novaLine(_ nova: Int?, profile: SensitivityProfile? = nil) -> String {
    guard let nova else { return "NOVA nincs besorolás" }
    let word = [1: "feldolgozatlan", 2: "kevéssé feldolgozott", 3: "feldolgozott", 4: "ultra-feldolgozott"][nova] ?? "ismeretlen"
    var line = "NOVA \(nova) · \(word)"
    if let rule = profile?.novaRule, rule.enabled, nova > rule.maxLevel { line += " · a határod fölött" }
    return line
}

/// Where the food's facts came from, in the owner's words. Never invents a source: no source reads "nincs adat".
func provenanceLines(_ r: PantryRow) -> [String] {
    var out: [String] = []
    let source: String
    switch r.source {
    case "openfoodfacts"?: source = "OpenFoodFacts"
    case "photo"?: source = "címkefotóból olvasva"
    case "manual"?: source = "kézzel felvéve"
    case "web"?: source = "weboldalról olvasva"
    case "ai_estimate"?: source = "Boop becslése"
    case let s?: source = s
    case nil: source = "nincs adat"
    }
    out.append("Forrás: \(source)")
    if let code = r.barcode, !code.isEmpty { out.append("Vonalkód: \(code)") }
    if let who = r.sharedFrom, !who.isEmpty { out.append("Közös katalógus · \(who) vette fel") }
    return out
}

// MARK: - The one confirm every add route ends in

/// A food can be saved when it has a name, a basis and an energy figure; any macro the owner left empty stays unknown.
func pantryAddReady(_ f: NewPantryFood) -> Bool {
    guard !f.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, f.per > 0, f.per.isFinite,
          let kcal = f.kcal, kcal >= 0, kcal.isFinite else { return false }
    return [f.proteinG, f.carbsG, f.fatG, f.fiberG, f.sugarG, f.saltG, f.saturatedFatG].allSatisfy { ($0 ?? 0) >= 0 }
}

/// A reading that doubts itself (a page, a label photo) holds the save until the owner has looked at the numbers.
func pantryAddNeedsLook(_ f: NewPantryFood) -> Bool {
    switch f.origin {
    case .link, .labelPhoto: f.needsReview || (f.confidence ?? 1) <= 0.6
    case .barcode, .manual: false
    }
}

/// The macros a product leaves out, by name — said on the confirm, never zero-filled.
func pantryAddMissing(_ f: NewPantryFood) -> [String] {
    [("fehérje", f.proteinG), ("szénhidrát", f.carbsG), ("zsír", f.fatG)].filter { $0.1 == nil }.map(\.0)
}

extension NewPantryFood {
    /// A scanned product, per its own basis (never the label's serving: the shelf holds the product).
    init(scanned i: LookupItem) {
        self.init(name: i.name, brand: i.brand, barcode: i.barcode, per: i.per, unit: i.unit, kcal: i.kcal, proteinG: i.proteinG,
                  carbsG: i.carbsG, fatG: i.fatG, fiberG: i.fiberG, sugarG: i.sugarG, saltG: i.saltG, saturatedFatG: i.saturatedFatG,
                  nova: i.nova, allergens: i.allergens, origin: .barcode)
    }
}

extension PantryRow {
    /// A shelf or catalog food as the facts the serving confirmation reads (a catalog hit has no serving fields, so it
    /// starts from grams). nil when the food has no basis to compute from.
    var servingFacts: LookupItem? {
        guard let per, per > 0, let unit else { return nil }
        return LookupItem(name: name, brand: brand, barcode: barcode, per: per, unit: unit, kcal: kcal, proteinG: proteinG, carbsG: carbsG,
                          fatG: fatG, fiberG: fiberG, sugarG: sugarG, saltG: saltG, saturatedFatG: saturatedFatG, nova: nova, allergens: allergens)
    }
}

// MARK: - What the shelf is, in numbers

/// The three numbers over the shelf: how many foods, how many of them barely processed, how many carry a flag for him.
func shelfStats(_ rows: [PantryRow], profile: SensitivityProfile?) -> [NKStat] {
    let whole = rows.filter { ($0.nova ?? 9) <= 2 }.count
    let flagged = rows.filter { if case .flagged = pantrySensitivity($0, profile: profile) { true } else { false } }.count
    return [NKStat(value: "\(rows.count)", label: "tétel a polcon"),
            NKStat(value: "\(whole)", label: "alig feldolgozott", hot: true),
            NKStat(value: "\(flagged)", label: "jelzéssel neked")]
}

/// The shelf's processing mix for the hero bar (NOVA groups): barely processed (1–2) lit strongest, then processed (3),
/// ultra-processed (4), and the foods with no NOVA. Empty groups are left out.
func shelfNovaMix(_ rows: [PantryRow]) -> [EtelMixPart] {
    let whole = rows.filter { ($0.nova ?? 9) <= 2 }.count
    let processed = rows.filter { $0.nova == 3 }.count
    let ultra = rows.filter { ($0.nova ?? 0) >= 4 }.count
    let unknown = rows.filter { $0.nova == nil }.count
    return [EtelMixPart(label: "alig feldolgozott", count: whole, strength: 1),
            EtelMixPart(label: "feldolgozott", count: processed, strength: 0.55),
            EtelMixPart(label: "ultra-feldolgozott", count: ultra, strength: 0.15),
            EtelMixPart(label: "nincs adat", count: unknown, strength: 0)].filter { $0.count > 0 }
}

/// A food whose facts are an unreviewed AI estimate wears the „becsült" tag (row and page) until its facts are replaced.
func kamraShowsEstimate(_ r: PantryRow) -> Bool { r.estimated }

/// The row's basis, "100 g" / "1 db".
func shelfBasis(_ r: PantryRow) -> String { "\(huNumber(r.per ?? 100)) \(r.unit ?? "g")" }

// MARK: - The tab

enum PantryAddRoute: String, Identifiable, Equatable {
    case barcode, link, label, manual
    var id: String { rawValue }
}

/// The `Kamra` tab of the Étel room in tiers (mezo-r36n9.207, decisions #119/#120): a hero card with the shelf in three
/// numbers over its processing mix, the ways to add a food on a glass card, the shelf itself (search, categories, the
/// catalog) on a glass card, and the settings on the last card.
struct EtelKamra: View {
    let store: EtelStore
    let onAdd: (PantryAddRoute) -> Void
    let onOpen: (PantryRow) -> Void
    let onRetry: () -> Void
    let onSheet: (EtelSheet) -> Void
    @State private var query = ""
    @State private var category: String?
    @State private var visible = 30
    @State private var hits: [PantryRow] = []
    @State private var searching = false
    @State private var searchProblem = false
    private let hue = Hue.fuel

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if store.shelfLoaded, store.shelfProblem == nil, !store.shelf.isEmpty { hero }
        card("FELVESZEK EGYET") {
            if typeSize.isAccessibilitySize {
                Grid(horizontalSpacing: 8, verticalSpacing: 8) {
                    GridRow { addChip("search-ink", "Vonalkód", primary: true) { onAdd(.barcode) }; addChip("link-deep", "Link") { onAdd(.link) } }
                    GridRow { addChip("camera-ink", "Címkefotó") { onAdd(.label) }; addChip("plus-ink", "Kézzel") { onAdd(.manual) } }
                }
            } else {
                HStack(spacing: 8) {
                    addChip("search-ink", "Vonalkód", primary: true) { onAdd(.barcode) }
                    addChip("link-deep", "Link") { onAdd(.link) }
                    addChip("camera-ink", "Címkefotó") { onAdd(.label) }
                    addChip("plus-ink", "Kézzel") { onAdd(.manual) }
                }
            }
        }
        card("A KAMRÁD", trailing: store.shelf.isEmpty ? nil : "\(store.shelf.count) tétel", state: shelfState) { shelf }
        card("BEÁLLÍTÁSOK") { EtelSettingsList(store: store, onSheet: onSheet) }
    }

    /// A glass card: the small-caps head on the card, the block's own loading and failed states inside (as on Ma, Hét).
    private func card<C: View>(_ label: String, trailing: String? = nil, state: NKBlockState = .ready,
                               @ViewBuilder _ content: () -> C) -> some View {
        NKBare(label, hue: hue, trailing: trailing, state: state, content: content)
            .padding(.horizontal, 16).padding(.vertical, 12)
            .nkGlass(24)
    }

    // MARK: the hero: the three numbers over the processing mix

    private var hero: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("A POLCOD").nkFont(11.5, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.6)).tracking(1.2)
            NKStatRow(shelfStats(store.shelf, profile: store.profile), hue: hue)
            EtelMixBar(parts: shelfNovaMix(store.shelf), hue: hue, title: "Mennyire feldolgozott")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(28)
    }

    private var shelfState: NKBlockState {
        if !store.shelfLoaded { return .loading }
        if let problem = store.shelfProblem, store.shelf.isEmpty {
            return .failed("Most nem érem el a kamrádat. \(etelProblemLine(problem))", { onRetry() })
        }
        return .ready
    }

    private func addChip(_ glyph: String, _ title: String, primary: Bool = false, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 7) {
                NKGlyph(glyph, primary ? NK.ground : .white, size: 19)
                Text(title).nkFont(12.5, .semibold).foregroundStyle(primary ? NK.ground : .white.opacity(0.9)).lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity).frame(height: 66)
            .background {
                let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
                if primary { shape.fill(.white.opacity(0.95)) }
                else { shape.fill(.white.opacity(0.08)).overlay(shape.stroke(.white.opacity(0.14))) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Felveszek egyet: \(title)")
    }

    // MARK: shelf

    @ViewBuilder private var shelf: some View {
        let shown = filterShelf(store.shelf, query: query, category: category)
        let more = catalogOnly(hits, shelf: store.shelf)
        VStack(alignment: .leading, spacing: 0) {
            EtelSearchField(query: $query, prompt: "Keresés a kamrában és a katalógusban").padding(.bottom, 10)
            if store.shelf.isEmpty {
                Text("A kamrád még üres. Vegyél fel egyet fent — vonalkóddal, linkkel, címkefotóval vagy kézzel.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            } else {
                EtelFilterChips(chips: [(nil, "Mind · \(store.shelf.count)")] + shelfCategories(store.shelf).map { (Optional($0.key), "\($0.label) · \($0.count)") },
                                selected: $category)
                    .padding(.bottom, 6)
                if shown.isEmpty {
                    Text("Ilyet nem találok a kamrádban.").nkFont(14).foregroundStyle(.white.opacity(0.6)).padding(.vertical, 12)
                }
                ForEach(Array(shown.prefix(visible).enumerated()), id: \.element.rowKey) { k, r in
                    if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 56) }
                    row(r)
                }
                if shown.count > visible {
                    Button { visible += 40 } label: {
                        Text("Még \(min(40, shown.count - visible)) tétel · összesen \(shown.count)").nkFont(14, .medium).foregroundStyle(.white.opacity(0.85))
                            .frame(maxWidth: .infinity).frame(minHeight: 44).background(Capsule().fill(.white.opacity(0.08)))
                    }
                    .buttonStyle(.plain).padding(.top, 10)
                }
            }
            if folded(query).count >= 2 { catalog(more) }
        }
        .task(id: query) { await searchCatalog() }
        .onChange(of: query) { visible = 30 }
        .onChange(of: category) { visible = 30 }
    }

    // MARK: catalog

    @ViewBuilder private func catalog(_ more: [PantryRow]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            NKMono("A KATALÓGUSBÓL").padding(.top, 18).padding(.bottom, 6)
            if searching && more.isEmpty {
                Text("Keresem a katalógusban.").nkFont(14).foregroundStyle(.white.opacity(0.5)).redacted(reason: .placeholder)
            } else if searchProblem && more.isEmpty {
                Text("A katalógust most nem érem el — csak a kamrád találatait látod.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            } else if more.isEmpty {
                Text("A katalógusban sincs ilyen. Vegyél fel egyet fent.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            }
            ForEach(Array(more.enumerated()), id: \.element.rowKey) { k, r in
                if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 56) }
                row(r)
            }
        }
    }

    private func searchCatalog() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard q.count >= 2, let food = store.currentFood else { hits = []; searching = false; return }
        searching = true; searchProblem = false
        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }
        do { hits = try await food.pantry(query: q).filter { $0.kind == "food" }; searchProblem = false }
        catch { if !Task.isCancelled { hits = []; searchProblem = true } }
        if !Task.isCancelled { searching = false }
    }

    // MARK: row

    /// One food = one row: its category's mark, the name, what it is, its facts as pills, the flag that matters to
    /// him, and its own score as a ring.
    private func row(_ r: PantryRow) -> some View {
        let state = pantrySensitivity(r, profile: store.profile)
        let kind = [NewPantryFood.categoryLabel(r.category), r.brand].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        return Button { onOpen(r) } label: {
            HStack(alignment: .top, spacing: 12) {
                EtelMedallion(glyph: etelCategoryGlyph(r.category), size: 44)
                VStack(alignment: .leading, spacing: 6) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.name).nkFont(15.5, .medium).foregroundStyle(.white).multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        if !kind.isEmpty { Text(kind).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1) }
                    }
                    NKFlowRow(spacing: 6, rowSpacing: 6) {
                        if kamraShowsEstimate(r) { EtelPill(text: "becsült", tone: .warn) }
                        if let kcal = r.kcal {
                            EtelPill(text: "\(huInt(Int(kcal.rounded()))) kcal / \(shelfBasis(r))")
                        } else {
                            EtelPill(text: "nincs tápérték-adat", tone: .muted)
                        }
                        if let p = r.proteinG { EtelPill(text: "\(huNumber(p)) g fehérje", tone: .hue) }
                        if let n = r.nova { EtelPill(text: "NOVA \(n)", tone: n >= 3 ? .outline : .plain) }
                        if !r.onShelf { EtelPill(text: "katalógus", tone: .muted) }
                        switch state {
                        case .flagged(let badges): ForEach(badges) { EtelPill(badge: $0) }
                        case .noData: EtelPill(text: "allergén: nincs adat", tone: .muted)
                        case .nothing: EmptyView()
                        }
                    }
                }
                Spacer(minLength: 4)
                EtelScoreRing(points: store.shelfPoints(r), size: 40).padding(.top, 2)
            }
            .padding(.vertical, 13).frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Megnyitja a tételt")
    }
}

// MARK: - The composer's "Szokásos"

/// A usual meal's row: its window and how often it recurred. It has no numbers on purpose — Boop computes them.
func usualMealLine(_ u: UsualMeal) -> String { "\(etelSlotLabel(u.slot)) · \(u.count)× az elmúlt 4 hétben" }
