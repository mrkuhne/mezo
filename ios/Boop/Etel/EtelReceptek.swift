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

// MARK: - The tab

/// The `Receptek` tab of the Étel room on the warm blocks: the ways to a new recipe as tiles, the library in three
/// numbers, then the library itself — one recipe per row, its facts as pills and its own score as a ring.
struct EtelReceptek: View {
    let store: EtelStore
    let onImport: (RecipeImportModel.Mode) -> Void
    let onWorkshop: () -> Void
    /// „Ezt főztem" — nil hides the tile.
    var onCooked: (() -> Void)? = nil
    let onOpen: (Recipe) -> Void
    let onRetry: () -> Void
    @State private var query = ""
    @State private var slot: String?
    private let hue = Hue.fuel

    var body: some View {
        NKBare("ÚJ RECEPT", hue: hue) { entrances }
        if store.recipesLoaded, store.recipesProblem == nil, !store.recipes.isEmpty {
            NKBare("A KÖNYVTÁRAD SZÁMOKBAN", hue: hue) { NKStatRow(recipeStats(store.recipes, profile: store.profile), hue: hue) }
        }
        NKBare("A KÖNYVTÁRAD", hue: hue, state: libraryState) { library }
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
        let cooked = onCooked
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
            if let cooked {
                entrance("bowl-cream", "Ezt főztem", "elmondom, miből és mennyit", lit: true, action: cooked)
            }
            entrance("link-deep", "Linkből", "receptoldalról vagy szövegből", lit: cooked == nil) { onImport(.link) }
            entrance("camera-ink", "Fotóból", "könyvből vagy képernyőről") { onImport(.photo) }
            entrance("chat-ink", "Receptműhely", "Boop kitalál egyet neked", action: onWorkshop)
        }
    }

    private func entrance(_ glyph: String, _ title: String, _ sub: String, lit: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                EtelMedallion(glyph: glyph, size: 36, lit: lit)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(15, .semibold).foregroundStyle(.white).lineLimit(1).fixedSize().layoutPriority(1)
                    Text(sub).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(2).multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .topLeading).frame(height: 116, alignment: .topLeading)
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
            let shown = filterRecipes(store.recipes, query: query).filter { slot == nil || $0.category == slot }
            VStack(alignment: .leading, spacing: 0) {
                EtelSearchField(query: $query, prompt: "Keresés a receptek között").padding(.bottom, 10)
                if slots.count > 1 {
                    EtelFilterChips(chips: [(nil, "Mind · \(store.recipes.count)")] + slots.map { (Optional($0.key), "\($0.label) · \($0.count)") },
                                    selected: $slot)
                        .padding(.bottom, 6)
                }
                if shown.isEmpty {
                    Text("Ilyen receptet nem találok.").nkFont(14).foregroundStyle(.white.opacity(0.6)).padding(.vertical, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                ForEach(Array(shown.enumerated()), id: \.element.id) { k, r in
                    if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 70) }
                    recipeRow(r)
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
