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


// MARK: - The tab

/// The `Receptek` tab of the Étel room: three ways to a new recipe, then the library — one recipe per row (owner,
/// 2026-11-13), a thumbnail, the full name with its sensitivity badge beside it, and the numbers in full underneath.
struct EtelReceptek: View {
    let store: EtelStore
    let onImport: (RecipeImportModel.Mode) -> Void
    let onWorkshop: () -> Void
    let onOpen: (Recipe) -> Void
    let onRetry: () -> Void
    @State private var query = ""

    var body: some View {
        NKDrillSection(number: 1, label: "ÚJ RECEPT") {
            VStack(spacing: 10) {
                importRow("link-deep", "Beillesztek egy linket", "a receptoldalról vagy a szövegből kiolvasom", primary: true) { onImport(.link) }
                importRow("camera-ink", "Lefotózom a receptet", "könyvből vagy képernyőről") { onImport(.photo) }
                importRow("chat-ink", "Receptműhely", "Boop kitalál egyet a szabályaid szerint", action: onWorkshop)
            }
        }
        NKDrillSection(number: 2, label: "A KÖNYVTÁRAD" + (store.recipesLoaded && store.recipesProblem == nil ? " · \(store.recipes.count) RECEPT" : "")) { library }
    }

    // MARK: new recipe

    private func importRow(_ glyph: String, _ title: String, _ sub: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    Circle().fill(primary ? .white.opacity(0.9) : .white.opacity(0.08))
                    NKGlyph(glyph, primary ? NK.ground : .white, size: 17)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(15.5, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    Text(sub).nkFont(13).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").nkFont(13, .semibold).foregroundStyle(.white.opacity(0.4))
            }
            .frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    // MARK: library

    @ViewBuilder private var library: some View {
        if !store.recipesLoaded {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(0..<3, id: \.self) { _ in
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 13).fill(.white.opacity(0.08)).frame(width: 44, height: 44)
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Recept neve itt").nkFont(15, .medium)
                            Text("480 kcal · 46 g fehérje · 2 adag").nkFont(11.5, design: .monospaced)
                        }
                    }
                }
            }
            .foregroundStyle(.white.opacity(0.4)).redacted(reason: .placeholder).accessibilityLabel("Betöltöm a receptjeidet")
        } else if let problem = store.recipesProblem, store.recipes.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Most nem érem el a receptjeidet.").nkFont(14).foregroundStyle(.white.opacity(0.7))
                Text(etelProblemLine(problem)).nkFont(13).foregroundStyle(.white.opacity(0.5))
                Button(action: onRetry) {
                    Text("Újra").nkFont(14, .semibold).foregroundStyle(NK.ground).padding(.horizontal, 18).frame(minHeight: 38)
                        .background(Capsule().fill(.white.opacity(0.95)))
                }
                .buttonStyle(.plain)
            }
        } else if store.recipes.isEmpty {
            Text("Még nincs mentett recepted. Hozz be egyet fent: egy linkkel, egy fotóval, vagy kérd Boop-tól.")
                .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
        } else {
            let shown = filterRecipes(store.recipes, query: query)
            VStack(spacing: 0) {
                searchField.padding(.bottom, 6)
                if shown.isEmpty {
                    Text("Ilyen nevű receptet nem találok.").nkFont(14).foregroundStyle(.white.opacity(0.6)).padding(.vertical, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                ForEach(Array(shown.enumerated()), id: \.element.id) { k, r in
                    recipeRow(r)
                    if k < shown.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            NKGlyph("search-ink", .white.opacity(0.6), size: 16)
            TextField("", text: $query, prompt: Text("Keresés a receptek között").foregroundStyle(.white.opacity(0.45)))
                .nkFont(15).foregroundStyle(.white).submitLabel(.search).accessibilityLabel("Keresés a receptek között")
        }
        .padding(.horizontal, 16).frame(minHeight: 46)
        .background(Capsule().fill(.white.opacity(0.08)))
        .overlay(Capsule().stroke(.white.opacity(0.12)))
    }

    /// One recipe = one row: nothing on it is cut — the name wraps to a second line, the numbers wrap rather than shorten.
    private func recipeRow(_ r: Recipe) -> some View {
        let badges = recipeBadges(r, profile: store.profile)
        return Button { onOpen(r) } label: {
            HStack(spacing: 12) {
                NKThumb(image: store.recipeImages[r.id].map { Image(uiImage: $0) }, glyph: "bowl-sage", size: 44)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(r.name).nkFont(15, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                        if let first = badges.first { RecipeBadgeView(badge: first) }
                        Spacer(minLength: 0)
                    }
                    // every other flag (a recipe can carry an allergen and a processed-food flag at once)
                    if badges.count > 1 { FlowRow { ForEach(Array(badges.dropFirst())) { RecipeBadgeView(badge: $0) } } }
                    Text(recipeRowFacts(r)).nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").nkFont(13, .semibold).foregroundStyle(.white.opacity(0.4))
            }
            .padding(.vertical, 11).frame(minHeight: 44).contentShape(Rectangle())
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
