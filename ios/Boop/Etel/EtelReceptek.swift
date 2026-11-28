import SwiftUI
import UIKit
import BoopCore
import BoopDesign

import Foundation
import BoopCore

// B4 Étel — the `Receptek` tab, as plain functions and values (the views only draw their answers).

// MARK: - The library

/// The one line under a recipe's name: per serving, in full (owner, 2026-11-13: a row, never a card that cuts the numbers).
func recipeRowFacts(_ r: Recipe) -> String {
    let s = r.perServing
    return "\(huInt(Int(s.kcal.rounded()))) kcal · \(Int(s.p.rounded())) g fehérje · \(r.servings) adag"
}

private func folded(_ text: String) -> String {
    text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "hu_HU"))
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

/// The library narrowed by a typed name, ignoring case and accents ("turos" finds "Túrós"). Blank = everything.
func filterRecipes(_ recipes: [Recipe], query: String) -> [Recipe] {
    let q = folded(query)
    guard !q.isEmpty else { return recipes }
    return recipes.filter { folded($0.name).contains(q) }
}

/// The sensitivity and processed badges of a recipe, from its allergen rollup. A recipe whose rollup says nothing about
/// an allergen gets no badge on the row — silence is never "free of" — and the detail page says "nincs adat" outright.
func recipeBadges(_ r: Recipe, profile: SensitivityProfile?) -> [DraftBadge] {
    var out: [DraftBadge] = []
    if let profile {
        for b in SensitivityRules.badges(allergens: r.allergens, profile: profile) where b.severity != .noData {
            let tone: DraftBadge.Tone = switch b.severity { case .block: .stop; case .warn: .warn; default: .notice }
            out.append(DraftBadge(text: "\(allergenName(b.key ?? "")) · \(b.text)", tone: tone))
        }
    }
    if r.nova >= 4 { out.append(DraftBadge(text: "Ultra-feldolgozott", tone: .processed)) }
    else if let rule = profile?.novaRule, rule.enabled, r.nova > rule.maxLevel {
        out.append(DraftBadge(text: "NOVA \(r.nova) · a határod fölött", tone: .processed))
    }
    return out
}

/// What the detail page says about the owner's allergen rules and this recipe, one sentence. An allergen the recipe's
/// rollup does not carry is "nincs adat" — never "mentes". nil = the owner has no allergen rules.
func recipeAllergenLine(_ r: Recipe, profile: SensitivityProfile?) -> String? {
    guard let profile else { return nil }
    let items = profile.items.filter(\.isStructured)
    guard !items.isEmpty else { return nil }
    var hits: [String] = [], silent: [String] = []
    for item in items {
        let key = item.key.lowercased()
        switch r.allergens[key] {
        case .contains?: hits.append("\(allergenName(key)): tartalmazza")
        case .traces?: hits.append("\(allergenName(key)): nyomokban")
        case .unknown?, nil: silent.append(allergenName(key))
        }
    }
    var parts: [String] = []
    if !hits.isEmpty { parts.append(hits.joined(separator: " · ")) }
    if !silent.isEmpty { parts.append("\(silent.joined(separator: ", ")): nincs adat") }
    return parts.joined(separator: " · ")
}


// MARK: - What the library is, in numbers

/// The slots the library actually holds, in the day's order, with their counts.
func recipeSlots(_ recipes: [Recipe]) -> [(key: String, label: String, count: Int)] {
    let order = ["breakfast", "lunch", "dinner", "snack"]
    var counts: [String: Int] = [:]
    for r in recipes { counts[r.category, default: 0] += 1 }
    return counts.sorted { a, b in (order.firstIndex(of: a.key) ?? 99, a.key) < (order.firstIndex(of: b.key) ?? 99, b.key) }
        .map { ($0.key, etelSlotLabel($0.key), $0.value) }
}

/// The mean score of the scored recipes, 0…100; nil when none has one.
func recipeMeanPoints(_ recipes: [Recipe]) -> Int? {
    let points = recipes.compactMap { etelPoints($0.fit) }
    guard !points.isEmpty else { return nil }
    return Int((Double(points.reduce(0, +)) / Double(points.count)).rounded())
}

/// The three numbers over the library: how many, how good on average, how many carry a flag for him.
func recipeStats(_ recipes: [Recipe], profile: SensitivityProfile?) -> [NKStat] {
    let flagged = recipes.filter { !recipeBadges($0, profile: profile).isEmpty }.count
    return [NKStat(value: "\(recipes.count)", label: "recept"),
            NKStat(value: recipeMeanPoints(recipes).map { "\($0)" }, unit: "pont", label: "átlagos pontszám", hot: true),
            NKStat(value: "\(flagged)", label: "jelzéssel neked")]
}

/// The best-scored recipes for the „A LEGJOBBAK NEKED" carousel: the scored ones, highest first, at most five. Fewer than
/// three scored recipes is no row worth swiping — the carousel is left out (an empty list).
func recipeTopPicks(_ recipes: [Recipe], limit: Int = 5) -> [Recipe] {
    let scored = recipes.compactMap { r in etelPoints(r.fit).map { (r, $0) } }
    guard scored.count >= 3 else { return [] }
    return scored.enumerated()
        .sorted { a, b in a.element.1 != b.element.1 ? a.element.1 > b.element.1 : a.offset < b.offset }
        .prefix(limit).map(\.element.0)
}

/// One segment of a mix bar (the hero's small graphic): a label, its count, and how strongly it is lit (0…1).
struct EtelMixPart: Equatable, Identifiable {
    let label: String
    let count: Int
    let strength: Double
    var id: String { label }
}

/// The library's slot mix for the hero bar: the slots it holds, in the day's order, lit from strongest down.
func recipeSlotMix(_ recipes: [Recipe]) -> [EtelMixPart] {
    let slots = recipeSlots(recipes)
    return slots.enumerated().map { k, s in
        EtelMixPart(label: s.label, count: s.count, strength: slots.count > 1 ? 1 - 0.7 * Double(k) / Double(slots.count - 1) : 1)
    }
}

/// The total time of a recipe in words; nil when neither part is known.
func recipeTimeText(_ r: Recipe) -> String? {
    guard r.prepMins != nil || r.cookMins != nil else { return nil }
    return "\((r.prepMins ?? 0) + (r.cookMins ?? 0)) perc"
}

/// What a recipe is good for, in his words (the server's `fitsFor` keys).
func recipeFitLabel(_ key: String) -> String {
    switch key {
    case "breakfast": "reggelire jó"
    case "lunch": "ebédre jó"
    case "dinner": "vacsorára jó"
    case "snack": "nasinak jó"
    case "pre_workout": "edzés előtt jó"
    case "post_workout": "edzés után jó"
    default: key.replacingOccurrences(of: "_", with: " ")
    }
}

// MARK: - The ways to a new recipe

/// One tile of „ÚJ RECEPT".
struct RecipeEntrance: Identifiable, Equatable {
    enum Route: Equatable { case cooked, link, photo, workshop }
    let route: Route
    let glyph: String
    let title: String
    let sub: String
    var lit = false
    var id: String { title }
}

/// „Ezt főztem" first and lit (mezo-r36n9.63), then the link (with its text mode), the photo and the workshop.
let recipeEntrances: [RecipeEntrance] = [
    RecipeEntrance(route: .cooked, glyph: "bowl-cream", title: "Ezt főztem", sub: "elmondom, miből és mennyit", lit: true),
    RecipeEntrance(route: .link, glyph: "link-deep", title: "Linkből", sub: "receptoldalról vagy szövegből"),
    RecipeEntrance(route: .photo, glyph: "camera-ink", title: "Fotóból", sub: "könyvből vagy képernyőről"),
    RecipeEntrance(route: .workshop, glyph: "chat-ink", title: "Receptműhely", sub: "Boop kitalál egyet neked"),
]

// MARK: - The tab

/// The `Receptek` tab of the Étel room in tiers (mezo-r36n9.207, decisions #119/#120/#131): a hero card with the library
/// in three numbers over its slot mix, the ways to a new recipe as tiles on a glass card, the best-scored recipes as a
/// free-standing carousel (never boxed into a card), then the library itself on a glass card — one recipe per row, its
/// facts as pills and its own score as a ring.
struct EtelReceptek: View {
    let store: EtelStore
    let onImport: (RecipeImportModel.Mode) -> Void
    let onWorkshop: () -> Void
    /// „Ezt főztem" (mezo-r36n9.63): the first way to a new recipe.
    let onCooked: () -> Void
    let onOpen: (Recipe) -> Void
    let onRetry: () -> Void
    /// „Menübe jöhet" filter (`mezo-r36n9.196`): only the recipes in the season's menu set. Owned by the room so the
    /// menu page's „N recept a menüben" can open the tab with it on.
    @Binding var menuOnly: Bool
    @State private var query = ""
    @State private var slot: String?
    @Environment(EvadStore.self) private var evad: EvadStore?
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .body) private var pickHeight: CGFloat = 204
    private let hue = Hue.fuel

    var body: some View {
        if store.recipesLoaded, store.recipesProblem == nil, !store.recipes.isEmpty { hero }
        card("ÚJ RECEPT") { entrances }
        let picks = store.recipesProblem == nil ? recipeTopPicks(store.recipes) : []
        if !picks.isEmpty {
            NKBare("A LEGJOBBAK NEKED", hue: hue, trailing: typeSize.isAccessibilitySize ? nil : "pontszám szerint") {
                NKCarousel(picks, hue: hue, height: min(pickHeight, 460), widthFraction: typeSize.isAccessibilitySize ? 0.86 : 0.62) { r in
                    pickCard(r)
                }
            }
        }
        card("A KÖNYVTÁRAD", trailing: store.recipes.isEmpty ? nil : "\(store.recipes.count) recept", state: libraryState) { library }
            .task(id: seasonId) {
                // a direct open may come before the ring read the season; then the id changes and this runs again
                if seasonId == nil { await evad?.load() } else { await evad?.menu.loadRecipeOptions() }
            }
    }

    // MARK: „Menübe jöhet" (decision #137)

    private var seasonId: String? { evad?.overview?.season.id }
    private var menuAllowed: Set<String> { evad?.menu.allowedIds ?? [] }


    /// A glass card: the small-caps head on the card, the block's own loading and failed states inside (as on Ma, Hét).
    private func card<C: View>(_ label: String, trailing: String? = nil, state: NKBlockState = .ready,
                               @ViewBuilder _ content: () -> C) -> some View {
        NKBare(label, hue: hue, trailing: trailing, state: state, content: content)
            .padding(.horizontal, 16).padding(.vertical, 12)
            .nkGlass(24)
    }

    // MARK: the hero: the three numbers over the slot mix

    private var hero: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("A RECEPTKÖNYVED").nkFont(11.5, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.6)).tracking(1.2)
            EtelHeroStats(stats: recipeStats(store.recipes, profile: store.profile), hue: hue)
            EtelMixBar(parts: recipeSlotMix(store.recipes), hue: hue, title: "Mire valók")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(28)
    }

    // MARK: the best-scored recipes, one card each

    private func pickCard(_ r: Recipe) -> some View {
        let s = r.perServing
        let image = store.recipeImages[r.id].map { Image(uiImage: $0) }
        return Button { onOpen(r) } label: {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topTrailing) {
                    if let image {
                        NKCardPhoto(image, hue: hue, height: 112)
                    } else {
                        ZStack { Color.white.opacity(0.05); NKGlyph("bowl-sage", .white.opacity(0.8), size: 34) }
                            .frame(height: 112).frame(maxWidth: .infinity)
                    }
                    EtelScoreRing(points: etelPoints(r.fit), size: 40)
                        .padding(5).background(Circle().fill(NK.ground.opacity(0.55))).padding(10)
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text(r.name).nkFont(15.5, .medium).foregroundStyle(.white).multilineTextAlignment(.leading)
                        .lineLimit(typeSize.isAccessibilitySize ? 4 : 2)
                    Text("\(etelSlotLabel(r.category)) · \(huInt(Int(s.kcal.rounded()))) kcal · \(Int(s.p.rounded())) g fehérje")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.62)).lineLimit(typeSize.isAccessibilitySize ? 4 : 2)
                    Spacer(minLength: 0)
                }
                .padding(14)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .nkGlass(22)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(r.name), \(etelSlotLabel(r.category)), \(huInt(Int(s.kcal.rounded()))) kilokalória, \(Int(s.p.rounded())) gramm fehérje adagonként"
                            + (etelPoints(r.fit).map { ", \($0) pont" } ?? ""))
        .accessibilityHint("Megnyitja a receptet")
        .accessibilityAddTraits(.isButton)
    }

    private var libraryState: NKBlockState {
        if !store.recipesLoaded { return .loading }
        if let problem = store.recipesProblem, store.recipes.isEmpty {
            return .failed("Most nem érem el a receptjeidet. \(etelProblemLine(problem))", { onRetry() })
        }
        return .ready
    }

    // MARK: new recipe

    private var entrances: some View {
        // One column at the accessibility text sizes: two would cut the titles.
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: typeSize.isAccessibilitySize ? 1 : 2), spacing: 8) {
            ForEach(recipeEntrances) { e in
                entrance(e.glyph, e.title, e.sub, lit: e.lit) {
                    switch e.route {
                    case .cooked: onCooked()
                    case .link: onImport(.link)
                    case .photo: onImport(.photo)
                    case .workshop: onWorkshop()
                    }
                }
            }
        }
    }

    private func entrance(_ glyph: String, _ title: String, _ sub: String, lit: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                EtelMedallion(glyph: glyph, size: 36, lit: lit)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(15, .semibold).foregroundStyle(.white).lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
                        .fixedSize(horizontal: !typeSize.isAccessibilitySize, vertical: typeSize.isAccessibilitySize).layoutPriority(1)
                    Text(sub).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(typeSize.isAccessibilitySize ? nil : 2).multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .topLeading)
            .frame(minHeight: typeSize.isAccessibilitySize ? nil : 116, maxHeight: typeSize.isAccessibilitySize ? nil : 116, alignment: .topLeading)
            .background {
                let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
                shape.fill(lit ? hue.glow.opacity(0.12) : .white.opacity(0.06))
                    .overlay(shape.stroke(lit ? hue.glow.opacity(0.45) : .white.opacity(0.12)))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    // MARK: library

    @ViewBuilder private var library: some View {
        if store.recipes.isEmpty {
            Text("Még nincs mentett recepted. Hozz be egyet fent: egy linkkel, egy fotóval, vagy kérd Booptól.")
                .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
        } else {
            let slots = recipeSlots(store.recipes)
            let base = menuOnly ? etelMenuFilter(store.recipes, allowed: menuAllowed) : store.recipes
            let shown = filterRecipes(base, query: query).filter { slot == nil || $0.category == slot }
            VStack(alignment: .leading, spacing: 0) {
                EtelSearchField(query: $query, prompt: "Keresés a receptek között").padding(.bottom, 10)
                if seasonId != nil {
                    Button { menuOnly.toggle() } label: {
                        Text("Menübe jöhet · \(menuAllowed.count)").nkFont(13.5, menuOnly ? .semibold : .regular)
                            .foregroundStyle(menuOnly ? NK.ground : .white.opacity(0.85))
                            .padding(.horizontal, 13).padding(.vertical, 8)
                            .background(Capsule().fill(menuOnly ? .white.opacity(0.92) : .white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(menuOnly ? [.isSelected] : [])
                    .padding(.bottom, 8)
                }
                if let problem = evad?.menu.actionProblem, seasonId != nil {
                    Text(problem).nkFont(13).foregroundStyle(.white.opacity(0.7)).padding(.bottom, 6)
                }
                if slots.count > 1 {
                    EtelFilterChips(chips: [(nil, "Mind · \(store.recipes.count)")] + slots.map { (Optional($0.key), "\($0.label) · \($0.count)") },
                                    selected: $slot)
                        .padding(.bottom, 6)
                }
                if shown.isEmpty {
                    Text(menuOnly && query.isEmpty ? "Még egy recept sincs a menüben — kapcsold be a „Menübe jöhet”-et egy receptnél." : "Ilyen receptet nem találok.").nkFont(14).foregroundStyle(.white.opacity(0.6)).padding(.vertical, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                ForEach(Array(shown.enumerated()), id: \.element.id) { k, r in
                    if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 70) }
                    recipeRow(r)
                    EtelMenuToggleRow(recipe: r, leading: 70)
                }
            }
        }
    }

    /// One recipe = one row: the name on its own line (it wraps, never cut), its facts as pills under it, the flags
    /// that matter to him on a line of their own, and the recipe's own score as a ring.
    private func recipeRow(_ r: Recipe) -> some View {
        let badges = recipeBadges(r, profile: store.profile)
        let s = r.perServing
        return Button { onOpen(r) } label: {
            HStack(alignment: .top, spacing: 12) {
                NKThumb(image: store.recipeImages[r.id].map { Image(uiImage: $0) }, glyph: "bowl-sage", size: 58)
                VStack(alignment: .leading, spacing: 7) {
                    Text(r.name).nkFont(15.5, .medium).foregroundStyle(.white).multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    NKFlowRow(spacing: 6, rowSpacing: 6) {
                        EtelPill(text: "\(huInt(Int(s.kcal.rounded()))) kcal")
                        EtelPill(text: "\(Int(s.p.rounded())) g fehérje", tone: .hue)
                        if let time = recipeTimeText(r) { EtelPill(text: time, glyph: "clock-ink") }
                    }
                    if !badges.isEmpty {
                        NKFlowRow(spacing: 6, rowSpacing: 6) { ForEach(badges) { EtelPill(badge: $0) } }
                    }
                }
                Spacer(minLength: 4)
                EtelScoreRing(points: etelPoints(r.fit), size: 40).padding(.top, 2)
            }
            .padding(.vertical, 13).frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Megnyitja a receptet")
    }
}

/// A sensitivity badge as a small capsule: the one thing on a row the owner must see before he eats it.
struct RecipeBadgeView: View {
    let badge: DraftBadge
    var body: some View {
        Text(badge.text).nkFont(10.5, .semibold)
            .foregroundStyle(badge.tone == .stop ? NK.ground : .white.opacity(0.9))
            .padding(.horizontal, 8).padding(.vertical, 3).fixedSize(horizontal: false, vertical: true)
            .background(Capsule().fill(badge.tone == .stop ? .white.opacity(0.92) : .white.opacity(badge.tone == .warn ? 0.22 : 0.1)))
            .overlay(Capsule().stroke(.white.opacity(badge.tone == .processed ? 0.35 : 0), lineWidth: 1))
    }
}

/// The hero's small graphic (Receptek, Kamra): one capsule split by count, its parts lit from strongest down, with a
/// legend under it. VoiceOver reads it as one sentence.
struct EtelMixBar: View {
    let parts: [EtelMixPart]
    let hue: Hue
    let title: String

    /// A lit part glows in the hue; a part with strength 0 („nincs adat") is a quiet white.
    private func tint(_ p: EtelMixPart) -> Color {
        p.strength > 0 ? hue.glow.opacity(0.25 + 0.75 * p.strength) : .white.opacity(0.22)
    }

    var body: some View {
        let total = max(1, parts.reduce(0) { $0 + $1.count })
        VStack(alignment: .leading, spacing: 10) {
            Text(title).nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.7))
            GeometryReader { geo in
                HStack(spacing: 3) {
                    ForEach(parts.filter { $0.count > 0 }) { p in
                        Capsule().fill(tint(p))
                            .frame(width: max(6, (geo.size.width - 3 * CGFloat(parts.count - 1)) * CGFloat(p.count) / CGFloat(total)))
                    }
                }
            }
            .frame(height: 10)
            NKFlowRow(spacing: 14, rowSpacing: 6) {
                ForEach(parts) { p in
                    HStack(spacing: 6) {
                        Circle().fill(tint(p)).frame(width: 7, height: 7)
                        Text("\(p.label) \(p.count)").nkFont(12).foregroundStyle(.white.opacity(0.75)).monospacedDigit()
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title): " + parts.map { "\($0.label) \($0.count)" }.joined(separator: ", "))
    }
}

/// The hero's three numbers: the kit's `NKStatRow`, and one number per line at the accessibility text sizes, where three
/// columns would break the labels mid-word.
struct EtelHeroStats: View {
    let stats: [NKStat]
    let hue: Hue
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(stats) { s in
                    VStack(alignment: .leading, spacing: 2) {
                        Text([s.value ?? "–", s.unit].filter { !$0.isEmpty }.joined(separator: " "))
                            .nkFont(26, s.hot ? .semibold : .regular).foregroundStyle(s.hot ? hue.glow : .white).monospacedDigit()
                        Text(s.label).nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        } else {
            NKStatRow(stats, hue: hue)
        }
    }
}
