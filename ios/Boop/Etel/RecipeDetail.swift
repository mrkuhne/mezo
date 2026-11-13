import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// The recipe's detail page (a sheet at the room's page level): the owner's photo, what is in it and how it is made, the
// numbers per serving with the recipe's own score, the times it went into a meal, and the one tap that logs a serving.

/// The last time a recipe was logged, the way the page says it.
func recipeLogLine(_ log: RecipeLog, now: Date = Date(), calendar: Calendar = .current) -> String {
    let f = DateFormatter(); f.locale = Locale(identifier: "hu_HU"); f.dateFormat = "MMM d."
    let day = calendar.isDate(log.loggedAt, inSameDayAs: now) ? "Ma" : f.string(from: log.loggedAt)
    return "\(day) · \(etelSlotLabel(log.slot)) · \(huInt(Int(log.kcal.rounded()))) kcal"
}

/// The three template dimensions of a recipe (no logged context), plain.
func recipeBreakdownRows(_ b: MealBreakdown) -> [DimensionEntry] {
    b.dimensions.map { DimensionEntry(id: $0.id, name: $0.label, points: $0.points, dimension: $0) }
}

struct RecipeDetailSheet: View {
    let recipeId: UUID
    let store: EtelStore
    let onToast: (String) -> Void
    /// Called after a serving was logged, so the room reloads its day.
    let onLogged: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var logs: [RecipeLog]?
    @State private var logsProblem = false
    @State private var breakdown: RecipeBreakdown?
    @State private var breakdownState: LoadState = .loading
    @State private var logRef = UUID()
    @State private var logging = false
    @State private var showLibrary = false
    @State private var showCamera = false
    @State private var busyPhoto = false
    @State private var askRemove = false

    private enum LoadState { case loading, ready, unavailable }

    private var recipe: Recipe? { store.recipes.first { $0.id == recipeId } }

    var body: some View {
        if let recipe {
            NKSheetFrame(hue: .fuel, eyebrow: "RECEPT", title: recipe.name) {
                header(recipe)
                ingredients(recipe)
                steps(recipe)
                numbers(recipe)
                history
            }
            .mealPhotoLibrary(isPresented: $showLibrary) { data in
                guard let data else { onToast("Ezt a képet nem tudom megnyitni"); return }
                Task { await setPhoto(data, recipe) }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker(onPick: { data in showCamera = false; Task { await setPhoto(data, recipe) } },
                             onCancel: { showCamera = false }).ignoresSafeArea()
            }
            .confirmationDialog("Letöröljem a recept fotóját?", isPresented: $askRemove, titleVisibility: .visible) {
                Button("Törlöm a fotót", role: .destructive) { Task { onToast(await store.removeRecipeImage(recipe.id)) } }
                Button("Mégsem", role: .cancel) {}
            } message: { Text("A recept marad, csak a fotója törlődik.") }
            .task(id: recipeId) { await loadExtras(recipe) }
        } else {
            NKSheetFrame(hue: .fuel, eyebrow: "RECEPT", title: "Nincs meg ez a recept") {
                Text("Úgy tűnik, már nincs a könyvtáradban.").nkFont(14).foregroundStyle(.white.opacity(0.7))
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            }
        }
    }

    // MARK: header

    private func header(_ r: Recipe) -> some View {
        let badges = recipeBadges(r, profile: store.profile)
        return VStack(alignment: .leading, spacing: 0) {
            if let image = store.recipeImages[r.id] { NKCardPhoto(Image(uiImage: image), hue: .fuel, height: 190) }
            VStack(alignment: .leading, spacing: 12) {
                Text(recipeRowFacts(r)).nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                if r.prepMins != nil || r.cookMins != nil {
                    let total = (r.prepMins ?? 0) + (r.cookMins ?? 0)
                    Text("\(total) perc · előkészítés \(r.prepMins ?? 0), főzés \(r.cookMins ?? 0)").nkFont(13).foregroundStyle(.white.opacity(0.6))
                }
                if !badges.isEmpty { FlowRow { ForEach(badges) { RecipeBadgeView(badge: $0) } } }
                if let line = recipeAllergenLine(r, profile: store.profile) {
                    Text(line).nkFont(13).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                }
                NKPill(logging ? "Rögzítem…" : "Megeszem 1 adagot", glyph: "plate-deep") { Task { await log(r) } }.disabled(logging)
                photoControls(r)
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .nkGlass()
    }

    private func photoControls(_ r: Recipe) -> some View {
        HStack(spacing: 10) {
            Menu {
                if PhotoCapture.cameraAvailable { Button("Fotózok", systemImage: "camera") { showCamera = true } }
                Button("Kiválasztok egyet", systemImage: "photo") { showLibrary = true }
            } label: {
                Text(busyPhoto ? "Feltöltöm…" : (r.hasImage ? "Fotó cseréje" : "Fotó hozzáadása"))
                    .nkFont(14, .medium).foregroundStyle(.white).padding(.horizontal, 16).frame(minHeight: 40)
                    .background(Capsule().fill(.white.opacity(0.1)))
            }
            .disabled(busyPhoto)
            if r.hasImage {
                Button("Fotó törlése") { askRemove = true }.nkFont(14).foregroundStyle(.white.opacity(0.65)).buttonStyle(.plain).frame(minHeight: 40)
            }
        }
    }

    // MARK: sections

    private func ingredients(_ r: Recipe) -> some View {
        card("HOZZÁVALÓK") {
            if r.ingredients.isEmpty {
                Text("Ehhez a recepthez nincs hozzávaló mentve.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            }
            ForEach(Array(r.ingredients.enumerated()), id: \.offset) { _, i in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(i.name).nkFont(15).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 6)
                    Text("\(i.amount == i.amount.rounded() ? "\(Int(i.amount))" : String(format: "%.1f", i.amount)) \(i.unit)")
                        .nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.65))
                }
            }
            Text("A hozzávalók \(r.servings) adagra szólnak.").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
        }
    }

    private func steps(_ r: Recipe) -> some View {
        card("ELKÉSZÍTÉS") {
            if r.steps.isEmpty {
                Text("Ehhez a recepthez nincs lépés mentve.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            }
            ForEach(Array(r.steps.enumerated()), id: \.offset) { k, step in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text("\(k + 1)").font(.custom(Lagy.outfitFamily, size: 15).weight(.medium)).foregroundStyle(.white.opacity(0.55)).frame(width: 18)
                    Text(step).nkFont(14.5).lineSpacing(2).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
                }
            }
            if let url = r.sourceUrl {
                HStack(spacing: 8) {
                    NKGlyph("link-deep", .white.opacity(0.55), size: 14)
                    Text(url).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1).truncationMode(.middle)
                }
                .padding(.top, 4)
            }
        }
    }

    private func numbers(_ r: Recipe) -> some View {
        let s = r.perServing
        return card("A SZÁMOK ADAGONKÉNT") {
            Text("\(huInt(Int(s.kcal.rounded()))) kcal · F \(Int(s.p.rounded())) g · Sz \(Int(s.c.rounded())) g · Zs \(Int(s.f.rounded())) g")
                .nkFont(14, design: .monospaced).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
            switch breakdownState {
            case .loading:
                Text("A recept pontszámát számolom…").nkFont(13.5).foregroundStyle(.white.opacity(0.5)).redacted(reason: .placeholder)
            case .unavailable:
                Text("A recept pontszámát most nem tudom megmutatni.").nkFont(13.5).foregroundStyle(.white.opacity(0.6))
            case .ready:
                if let b = breakdown?.breakdown {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("\(Int((b.value * 100).rounded()))").font(.custom(Lagy.outfitFamily, size: 28).weight(.light)).foregroundStyle(.white)
                        Text("/100 a recept pontszáma").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    }
                    ForEach(recipeBreakdownRows(b)) { e in
                        HStack(spacing: 10) {
                            Text(e.name).nkFont(13.5).foregroundStyle(.white.opacity(0.8))
                            Spacer(minLength: 6)
                            Text(e.points.map { "\($0)" } ?? "nincs adat").nkFont(13, design: .monospaced)
                                .foregroundStyle(.white.opacity(e.points == nil ? 0.45 : 0.9))
                        }
                    }
                    if let line = [b.summary, b.tagline].compactMap({ $0 }).first(where: { !$0.isEmpty }) {
                        Text(line).nkFont(13.5).lineSpacing(2).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    Text("Ehhez a recepthez még nincs pontszám — nincs benne kalória, amiből számolni lehetne.")
                        .nkFont(13.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var history: some View {
        card("EDDIG") {
            if logsProblem {
                Text("Most nem látom, mikor etted.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            } else if let logs {
                if logs.isEmpty { Text("Még nem ettél belőle.").nkFont(14).foregroundStyle(.white.opacity(0.6)) }
                ForEach(logs.prefix(6)) { l in
                    HStack(spacing: 10) {
                        Text(recipeLogLine(l)).nkFont(14).foregroundStyle(.white.opacity(0.85))
                        Spacer(minLength: 6)
                        if let score = l.score { Text("\(Int((score * 100).rounded()))").nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.6)) }
                    }
                }
            } else {
                Text("Betöltöm…").nkFont(14).foregroundStyle(.white.opacity(0.5)).redacted(reason: .placeholder)
            }
        }
    }

    private func card<C: View>(_ label: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            NKMono(label)
            content()
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    // MARK: actions

    private func loadExtras(_ r: Recipe) async {
        guard let food = store.currentFood else { breakdownState = .unavailable; logsProblem = true; return }
        async let l: Result<[RecipeLog], Error> = { do { return .success(try await food.recipeLogs(r.id)) } catch { return .failure(error) } }()
        async let b: Result<RecipeBreakdown, Error> = { do { return .success(try await food.recipeBreakdown(r.id)) } catch { return .failure(error) } }()
        switch await l { case .success(let v): logs = v; logsProblem = false; case .failure: logsProblem = true }
        switch await b { case .success(let v): breakdown = v; breakdownState = .ready; case .failure: breakdownState = .unavailable }
    }

    private func log(_ r: Recipe) async {
        guard !logging else { return }
        logging = true; defer { logging = false }
        let toast = await store.logRecipe(r, clientRef: logRef)
        if toast.ok { logRef = UUID(); onLogged() }
        onToast(toast.text)
        if toast.ok, let food = store.currentFood { logs = (try? await food.recipeLogs(r.id)) ?? logs }
    }

    private func setPhoto(_ data: Data, _ r: Recipe) async {
        busyPhoto = true; defer { busyPhoto = false }
        onToast(await store.setRecipeImage(data, recipeId: r.id))
    }
}

/// Badges (or any small views) flowing onto as many lines as they need.
struct FlowRow<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        // two columns of intrinsic size is enough for a row of badges; LazyVGrid adaptive keeps them from being cut
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 6, alignment: .leading)], alignment: .leading, spacing: 6) { content }
    }
}
