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
    /// The dimension whose explanation is open (a sheet over this sheet).
    @State private var openDim: ScoreDimension?
    @State private var vote: Bool?
    /// He tapped a vote in this sheet: the stored one read later must not overwrite it.
    @State private var voteTouched = false
    @State private var voteWrite: Task<Void, Never>?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum LoadState { case loading, ready, unavailable }

    private var recipe: Recipe? { store.recipes.first { $0.id == recipeId } }

    var body: some View {
        if let recipe {
            NKSheetFrame(hue: .fuel, eyebrow: "RECEPT", title: recipe.name) {
                header(recipe)
                score(recipe)
                sensitivity(recipe)
                ingredients(recipe)
                steps(recipe)
                history
            }
            .blur(radius: openDim == nil ? 0 : 14)
            .accessibilityHidden(openDim != nil)
            .overlay { dimensionDetail }
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

    /// The photo, the recipe in pills, its macros per serving, and the one tap that logs a serving.
    private func header(_ r: Recipe) -> some View {
        let s = r.perServing
        return VStack(alignment: .leading, spacing: 0) {
            if let image = store.recipeImages[r.id] { NKCardPhoto(Image(uiImage: image), hue: .fuel, height: 190) }
            VStack(alignment: .leading, spacing: 14) {
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    EtelPill(text: etelSlotLabel(r.category), glyph: "bowl-cream", tone: .hue)
                    if let time = recipeTimeText(r) {
                        if let prep = r.prepMins, let cook = r.cookMins, prep > 0, cook > 0 {
                            EtelPill(text: "\(time) · \(prep) előkészítés, \(cook) főzés", glyph: "clock-ink")
                        } else {
                            EtelPill(text: time, glyph: "clock-ink")
                        }
                    }
                    EtelPill(text: "\(r.servings) adag")
                    EtelPill(text: "NOVA \(r.nova)", tone: r.nova >= 3 ? .outline : .plain)
                }
                VStack(alignment: .leading, spacing: 8) {
                    NKMono("EGY ADAG")
                    EtelMacroTiles(kcal: s.kcal, p: s.p, c: s.c, f: s.f)
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
        HStack(spacing: 14) {
            Menu {
                if PhotoCapture.cameraAvailable { Button("Fotózok", systemImage: "camera") { showCamera = true } }
                Button("Kiválasztok egyet", systemImage: "photo") { showLibrary = true }
            } label: {
                HStack(spacing: 6) {
                    NKGlyph("camera-ink", .white.opacity(0.7), size: 14)
                    Text(busyPhoto ? "Feltöltöm…" : (r.hasImage ? "Fotó cseréje" : "Fotó hozzáadása")).nkFont(13.5, .medium).foregroundStyle(.white.opacity(0.75))
                }
                .frame(minHeight: 40).contentShape(Rectangle())
            }
            .disabled(busyPhoto)
            if r.hasImage {
                Button("Fotó törlése") { askRemove = true }.nkFont(13.5).foregroundStyle(.white.opacity(0.5)).buttonStyle(.plain).frame(minHeight: 40)
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: the score

    /// The recipe's evaluation (mezo-r36n9.199): while it loads the fit ring + „számolom", on failure a retry, then the
    /// approved card — hero, today, the eight dimensions, the rank, the tips, the vote.
    @ViewBuilder
    private func score(_ r: Recipe) -> some View {
        switch breakdownState {
        case .loading:
            EtelSheetCard(label: "BOOP ÉRTÉKELÉSE", trailing: "egy adagra") {
                HStack(spacing: 14) {
                    EtelScoreRing(points: etelPoints(r.fit), size: 64)
                    Text("Átnézem a hozzávalókat, számolom…").nkFont(13.5).foregroundStyle(.white.opacity(0.5))
                }
            }
        case .unavailable:
            EtelSheetCard(label: "BOOP ÉRTÉKELÉSE", trailing: "egy adagra") {
                HStack(spacing: 14) {
                    EtelScoreRing(points: etelPoints(r.fit), size: 64)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("A pontszám részleteit most nem érem el.").nkFont(13.5).foregroundStyle(.white.opacity(0.6))
                            .fixedSize(horizontal: false, vertical: true)
                        Button { breakdownState = .loading; Task { await loadExtras(r) } } label: {
                            Text("Újra").nkFont(13, .semibold).foregroundStyle(.white).padding(.horizontal, 14).frame(height: 34)
                                .background(Capsule().stroke(.white.opacity(0.4)))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        case .ready:
            if let breakdown {
                RecipeScoreCard(recipe: r, breakdown: breakdown, day: store.day,
                                todayYmd: store.currentFood?.ymd(Date()) ?? "", recipes: store.recipes, logs: logs, vote: vote,
                                onVote: { setVote($0, r) },
                                onOpen: { d in withAnimation(reduceMotion ? nil : .snappy) { openDim = d } })
            }
        }
    }

    /// The tapped dimension in full, rising over the blurred sheet; a tap on the dim background closes it.
    @ViewBuilder
    private var dimensionDetail: some View {
        if let d = openDim, let b = breakdown?.breakdown {
            let ex = dimensionExtremes(b.dimensions)
            ZStack(alignment: .bottom) {
                Color.black.opacity(0.45).ignoresSafeArea()
                    .onTapGesture { closeDetail() }
                    .accessibilityLabel("Bezárás").accessibilityAddTraits(.isButton)
                RecipeDimensionDetail(dimension: d, isWeak: d.id == ex.weakest, isStrong: d.id == ex.strongest,
                                      tips: b.improve.filter { $0.dimension == d.id }, close: closeDetail)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
            .transition(.opacity)
        }
    }

    private func closeDetail() { withAnimation(reduceMotion ? nil : .snappy) { openDim = nil } }

    /// Optimistic vote; on failure it snaps back and says so. Writes are serialized (a fast toggle never lands out of
    /// order on the server), and once he has tapped, a late read of the stored vote no longer overwrites his choice.
    private func setVote(_ value: Bool?, _ r: Recipe) {
        let before = vote
        vote = value
        voteTouched = true
        let previous = voteWrite
        voteWrite = Task {
            await previous?.value
            guard let food = store.currentFood else { vote = before; onToast("Nem sikerült elmenteni"); return }
            do { try await food.setBreakdownVote(recipeId: r.id, up: value) } catch {
                if vote == value { vote = before }
                onToast("Nem sikerült elmenteni")
            }
        }
    }

    // MARK: sensitivity

    @ViewBuilder private func sensitivity(_ r: Recipe) -> some View {
        let facts = etelAllergenFacts(r.allergens, profile: store.profile)
        let processed = recipeBadges(r, profile: store.profile).filter { $0.tone == .processed }
        if !facts.isEmpty || !processed.isEmpty {
            EtelSheetCard(label: "AMIRE FIGYELSZ") {
                if !facts.isEmpty { EtelAllergenRows(facts: facts) }
                if !processed.isEmpty { NKFlowRow(spacing: 6, rowSpacing: 6) { ForEach(processed) { EtelPill(badge: $0) } } }
                if facts.contains(where: { $0.state == .noData }) {
                    Text("A „nincs adat” nem azt jelenti, hogy nincs benne: a hozzávalókról nincs elég információ.")
                        .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    // MARK: sections

    private func amountText(_ i: RecipeIngredient) -> String {
        "\(i.amount == i.amount.rounded() ? "\(Int(i.amount))" : String(format: "%.1f", i.amount).replacingOccurrences(of: ".", with: ",")) \(i.unit)"
    }

    private func ingredients(_ r: Recipe) -> some View {
        EtelSheetCard(label: "HOZZÁVALÓK", trailing: "\(r.servings) adagra") {
            if r.ingredients.isEmpty {
                Text("Ehhez a recepthez nincs hozzávaló mentve.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(r.ingredients.enumerated()), id: \.offset) { k, i in
                        if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Circle().fill(Hue.fuel.glow.opacity(0.7)).frame(width: 5, height: 5).offset(y: -3)
                            Text(i.name).nkFont(15).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 6)
                            Text(amountText(i)).font(.custom(Lagy.outfitFamily, size: 15).weight(.medium)).foregroundStyle(.white.opacity(0.85))
                                .monospacedDigit()
                        }
                        .padding(.vertical, 9)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }

    private func steps(_ r: Recipe) -> some View {
        EtelSheetCard(label: "ELKÉSZÍTÉS", trailing: r.steps.isEmpty ? nil : "\(r.steps.count) lépés") {
            if r.steps.isEmpty {
                Text("Ehhez a recepthez nincs lépés mentve.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            }
            ForEach(Array(r.steps.enumerated()), id: \.offset) { k, step in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(k + 1)").font(.custom(Lagy.outfitFamily, size: 13).weight(.semibold)).foregroundStyle(Hue.fuel.glow)
                        .frame(width: 26, height: 26).background(Circle().fill(Hue.fuel.glow.opacity(0.15)))
                    Text(step).nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 3)
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

    private var history: some View {
        EtelSheetCard(label: "EDDIG", trailing: logs.map { $0.isEmpty ? nil : "\($0.count) alkalom" } ?? nil) {
            if logsProblem {
                Text("Most nem látom, mikor etted.").nkFont(14).foregroundStyle(.white.opacity(0.6))
            } else if let logs {
                if logs.isEmpty { Text("Még nem ettél belőle.").nkFont(14).foregroundStyle(.white.opacity(0.6)) }
                VStack(spacing: 0) {
                    ForEach(Array(logs.prefix(6).enumerated()), id: \.element.id) { k, l in
                        if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        HStack(spacing: 10) {
                            Text(recipeLogLine(l)).nkFont(14).foregroundStyle(.white.opacity(0.85))
                            Spacer(minLength: 6)
                            if let score = l.score { EtelScoreRing(points: Int((score * 100).rounded()), size: 30) }
                        }
                        .padding(.vertical, 8)
                    }
                }
            } else {
                Text("Betöltöm…").nkFont(14).foregroundStyle(.white.opacity(0.5)).redacted(reason: .placeholder)
            }
        }
    }

    // MARK: actions

    private func loadExtras(_ r: Recipe) async {
        guard let food = store.currentFood else { breakdownState = .unavailable; logsProblem = true; return }
        async let l: Result<[RecipeLog], Error> = { do { return .success(try await food.recipeLogs(r.id)) } catch { return .failure(error) } }()
        async let b: Result<RecipeBreakdown, Error> = { do { return .success(try await food.recipeBreakdown(r.id)) } catch { return .failure(error) } }()
        let (gotLogs, gotBreakdown) = await (l, b)
        // A load the sheet restarted (the library refreshed under it) must not leave its cancellation as "unavailable".
        if Task.isCancelled { return }
        switch gotLogs { case .success(let v): logs = v; logsProblem = false; case .failure: logsProblem = true }
        switch gotBreakdown { case .success(let v): breakdown = v; breakdownState = .ready; case .failure: breakdownState = .unavailable }
        if breakdown?.breakdown?.summary?.isEmpty == false, !voteTouched {
            let stored = try? await food.breakdownVote(recipeId: r.id)
            if !voteTouched && !Task.isCancelled { vote = stored }
        }
        #if DEBUG
        // Simulator review: `-receptDim who` opens that dimension's page once the evaluation is in.
        if let id = UserDefaults.standard.string(forKey: "receptDim"),
           let d = breakdown?.breakdown?.dimensions.first(where: { $0.id == id }) { openDim = d }
        #endif
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
