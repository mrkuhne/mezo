import SwiftUI
import BoopCore
import BoopDesign

/// The weekly menu's hue: it lives in the Étel room now (`mezo-r36n9.196`, decision #133).
let etelMenuHue: Hue = .fuel

/// **Menü** (screen 05, Évad S3; Étel › Hét since `mezo-r36n9.196`): next week's menu built from the allowed recipes and each day's own budget — the
/// approval highlight, a carousel of seven day cards (a tap on a meal offers swaps), „Kérek másikat" and „Kiválasztott
/// receptek". With no allowed recipe the seeding prompt; with no menu yet „Összeállítom most". Every kcal is the
/// server's.
struct EtelMenuBody: View {
    let o: EvadOverview
    let menu: EvadMenuStore
    let openRecipes: @MainActor @Sendable () -> Void
    let swap: @MainActor @Sendable (EvadMenuMeal) -> Void

    var body: some View {
        Group {
            if let w = menu.week {
                content(w)
            } else if let p = menu.menuProblem {
                NKBare("Heti menü", hue: etelMenuHue, glyph: "clock-ink", state: .failed(evadErrorText(p), {
                    Task { await menu.loadMenu(force: true) }
                })) { EmptyView() }
            } else {
                NKBare("Heti menü", hue: etelMenuHue, glyph: "clock-ink", state: .loading) { EmptyView() }
            }
        }
        .task { await menu.loadMenu() }
    }

    @ViewBuilder private func content(_ w: EvadMenuWeek) -> some View {
        let range = (menu.showsNextWeek ? "Jövő hét" : "E hét") + " · " + evadWeekRange(w.weekStart)
        if let age = menu.menuAgeText { EvadLine(text: "Offline vagy, ez a \(age) menü.") }
        switch w.status {
        case "seeding":
            NKHighlight(hue: etelMenuHue, label: "Heti menü",
                        text: "Válaszd ki, melyik receptjeidből álljon a menü.",
                        sub: "\(w.recipeCount) recepted van. A menü csak a kiválasztottakból áll össze, az edzésnapjaidhoz igazítva.",
                        actions: [NKHighlightAction("Kiválasztom", action: openRecipes)])
        case "none":
            NKHighlight(hue: etelMenuHue, label: range,
                        text: "Erre a hétre még nincs menü.",
                        sub: whenText(),
                        actions: [NKHighlightAction("Összeállítom most", action: { Task { await menu.generate() } })])
        case "proposed":
            NKHighlight(hue: etelMenuHue, label: range,
                        text: "Elkészült a menü a \(w.allowedCount) kiválasztott receptedből. Edzésnapon többet eszel, pihenőnapon kevesebbet.",
                        sub: "Bármelyik ételt lecserélheted: koppints rá. Ha jóváhagyod, ebből készül a bevásárlólista, és ezek kerülnek a napi tervedbe.",
                        actions: [NKHighlightAction("Jóváhagyom", action: { Task { await menu.approve() } })])
        default:
            NKNote("Jóváhagyott menü · \(evadWeekRange(w.weekStart)). Az Étel napi tervében ezek az ételek jönnek, a bevásárlólista a Lista fülön van.", hue: etelMenuHue)
        }
        if let problem = menu.actionProblem { EvadLine(text: problem) }
        if w.hasMeals {
            if w.repeated {
                NKNote("Kevés a kiválasztott recepted ehhez a héthez, ezért néhány étel ismétlődik. Ha többet választasz ki, változatosabb lesz.", hue: etelMenuHue)
            }
            NKBare("A hét napjai", hue: etelMenuHue, glyph: "clock-ink", trailing: "lapozz") {
                NKCarousel(w.days, hue: etelMenuHue, height: 372, widthFraction: 0.84) { d in dayCard(d) }
                    .padding(.horizontal, -18)
                    .contentMargins(.horizontal, 18, for: .scrollContent)
            }
        }
        NKActions(actions(w), hue: etelMenuHue)
        if w.status != "seeding" {
            // „Kiválasztott receptek" is now the „Menübe jöhet" filter on Étel › Receptek
            NKInfoRow(etelMenuCountLine(w.allowedCount), hue: etelMenuHue, action: openRecipes)
        }
    }

    private func actions(_ w: EvadMenuWeek) -> [NKAction] {
        var out: [NKAction] = []
        if w.status == "proposed" {
            out.append(NKAction(glyph: "repeat-deep", title: "Kérek másikat", action: { Task { await menu.generate() } }))
        } else if w.status == "approved" && !menu.showsNextWeek {
            out.append(NKAction(glyph: "repeat-deep", title: "Jövő heti menü", action: { Task { await menu.generate() } }))
        }
        return out
    }

    private func whenText() -> String {
        guard let m = o.menu, let day = m.menuDay else {
            return "A heti menü magától nem készül el, de most összeállíthatom."
        }
        let names = ["hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton", "vasárnap"]
        return "\(names[min(6, max(0, day))].capitalized) \(m.menuTime)-kor magamtól is összeállítom, de most is megcsinálhatom."
    }

    private func dayCard(_ d: EvadMenuDay) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(evadDayName(d.date)).nkFont(24, design: .serif).foregroundStyle(.white)
                Spacer()
                Text(evadKcal(d.kcal)).font(.nkNumber(22)).foregroundStyle(etelMenuHue.glow)
                Text("kcal").nkFont(11).foregroundStyle(.white.opacity(0.6))
            }
            HStack(spacing: 7) {
                NKGlyph(d.kind == "pihenonap" ? "moon-ink" : d.kind == "sport" ? "ball-sun" : "dumbbell-ink",
                        .white.opacity(0.7), size: 14)
                Text(evadDayKindText(d)).nkFont(13).foregroundStyle(.white.opacity(0.65))
            }
            .padding(.top, 4).padding(.bottom, 12)
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    ForEach(d.meals) { meal in mealRow(meal, past: evadIsPast(d.date)) }
                }
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .padding(18)
        .frame(maxHeight: .infinity, alignment: .top)
        .nkGlass(24)
    }

    private func mealRow(_ meal: EvadMenuMeal, past: Bool) -> some View {
        VStack(spacing: 0) {
            Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
            Button { if !past && (meal.recipeId != nil || menu.week?.allowedCount ?? 0 > 0) { swap(meal) } } label: {
                HStack(alignment: .center, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            NKMono(meal.label.uppercased())
                            if meal.changed { NKMono("· VÁLTOZOTT").foregroundStyle(etelMenuHue.glow) }
                        }
                        Text(meal.name).nkFont(meal.recipeId == nil ? 13.5 : 15)
                            .foregroundStyle(.white.opacity(meal.recipeId == nil ? 0.7 : 1)).lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 6)
                    Text("\(meal.kcal)").font(.nkNumber(16)).foregroundStyle(.white.opacity(0.75))
                }
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(past ? "" : "Lecserélem")
            .disabled(past)
        }
    }
}

/// "2 440".
func evadKcal(_ v: Int) -> String {
    let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = " "; f.groupingSize = 3
    return f.string(from: NSNumber(value: v)) ?? "\(v)"
}

/// The swap sheet: the other allowed recipes that fit this meal's window, fitting ones first.
struct EvadSwapSheet: View {
    let meal: EvadMenuMeal
    let menu: EvadMenuStore
    let close: @MainActor @Sendable () -> Void
    @State private var options: [EvadMenuAlternative]?
    @State private var problem: String?

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    NKMono(meal.label.uppercased())
                    Text("Mi legyen helyette?").nkFont(26, design: .serif).foregroundStyle(.white)
                    Text("Most: \(meal.name), \(meal.kcal) kcal. Ezek férnek bele ugyanebbe az ablakba, a keretéhez igazított adaggal.")
                        .nkFont(14).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
                    if let problem { EvadLine(text: problem) }
                    if let options {
                        if options.isEmpty {
                            EvadLine(text: "Nincs másik kiválasztott recepted, ami ide illene. A Kiválasztott receptek között bővítheted a listát.")
                        }
                        ForEach(options) { a in
                            Button { choose(a) } label: {
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(a.name).nkFont(16, .medium).foregroundStyle(.white)
                                        Text([evadServingsText(a.servings), a.fits ? nil : "kicsit eltér a kerettől"]
                                            .compactMap { $0 }.joined(separator: " · "))
                                            .nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                                    }
                                    Spacer()
                                    Text("\(a.kcal)").font(.nkNumber(17)).foregroundStyle(etelMenuHue.glow)
                                    Text("kcal").nkFont(11).foregroundStyle(.white.opacity(0.55))
                                }
                                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                                .nkGlass(18)
                            }
                            .buttonStyle(.plain)
                            .disabled(menu.busy)
                        }
                    } else if problem == nil {
                        ProgressView().tint(.white).frame(maxWidth: .infinity)
                    }
                    NKActions([NKAction(title: "Mégsem", action: close)], hue: etelMenuHue)
                }
                .padding(20)
            }
        }
        .task {
            do throws(PlanFetchError) { options = try await menu.alternatives(for: meal) } catch { problem = evadErrorText(error) }
        }
        .presentationDetents([.medium, .large])
        .preferredColorScheme(.dark)
    }

    private func choose(_ a: EvadMenuAlternative) {
        Task {
            await menu.swap(meal, to: a.recipeId)
            if let p = menu.actionProblem { problem = p } else { close() }
        }
    }
}

// MARK: - Étel › Hét (`mezo-r36n9.196`, decision #133): the menu page and the Hét tab's menu card

/// The weekly menu as its own page — from the Étel Hét card, a wall card, or the Sunday review's page 4. The swap
/// sheet hangs on the page (boop-ios.md §9). `openRecipes` nil (inside the review) leaves the recipe row inert.
struct EtelMenuPage: View {
    var crumb: String = "Étel"
    let close: @MainActor @Sendable () -> Void
    var openRecipes: (@MainActor @Sendable () -> Void)? = nil
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var swapMeal: EvadMenuMeal?

    var body: some View {
        NKAreaSubPage(hue: etelMenuHue, crumb: crumb, eyebrow: "Heti menü", title: "A jövő heti menü",
                      sentence: "Az évad receptjeiből, az évad kereteire. Koppints egy ételre, ha másikat kérsz.", onBack: close) {
            if let store, let o = store.overview {
                EtelMenuBody(o: o, menu: store.menu, openRecipes: openRecipes ?? {}, swap: { swapMeal = $0 })
            } else if store?.empty == true {
                EvadText("Heti menü egy évadhoz tartozik. Ha elindítod az évadot az Évad szobában, itt lesz a menüd.")
            } else {
                NKBare("Heti menü", hue: etelMenuHue, glyph: "clock-ink", state: .loading) { EmptyView() }
                    .task { await store?.load() }
            }
        }
        .sheet(item: $swapMeal) { meal in
            if let menu = store?.menu { EvadSwapSheet(meal: meal, menu: menu, close: { swapMeal = nil }) }
        }
    }
}

/// The Hét tab's menu hero (spike `27`): next week's state, the first dinners, and the way into the menu page.
/// Hidden without a season (no menu exists then).
struct EtelMenuCard: View {
    let menu: EvadMenuStore
    let open: @MainActor @Sendable () -> Void

    var body: some View {
        Group {
            if let w = menu.week {
                Button(action: open) {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            NKMono(((menu.showsNextWeek ? "Jövő heti menü" : "E heti menü") + " · " + evadWeekRange(w.weekStart)).uppercased())
                                .lineLimit(2)
                            Spacer(minLength: 6)
                            if let tag = etelMenuTag(w.status) {
                                Text(tag).nkFont(12, .semibold).foregroundStyle(NK.ground)
                                    .padding(.horizontal, 10).frame(minHeight: 24).background(Capsule().fill(etelMenuHue.glow))
                            }
                        }
                        Text(etelMenuHeadline(w)).nkFont(19, design: .serif).foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                        let rows = etelMenuPreviewRows(w)
                        if !rows.isEmpty {
                            VStack(spacing: 10) {
                                ForEach(rows, id: \.day) { r in
                                    HStack(spacing: 12) {
                                        Text(r.day).nkFont(12, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.7))
                                            .frame(minWidth: 30, alignment: .leading)
                                        Text(r.meal).nkFont(15).foregroundStyle(.white).lineLimit(2)
                                        Spacer(minLength: 4)
                                    }
                                }
                            }
                        }
                        HStack(spacing: 6) {
                            Text("Megnyitom a menüt").nkFont(14, .medium).foregroundStyle(.white.opacity(0.85))
                            Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.5))
                        }
                    }
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
                    .contentShape(RoundedRectangle(cornerRadius: 26))
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityHint("Megnyitja a heti menüt")
            }
        }
        .task { await menu.loadMenu() }
    }
}

/// „Menübe jöhet" under a recipe (Receptek row and the recipe sheet, decision #137): the season's menu-set switch in
/// today's tick look, or why his rules keep the recipe out. Nothing without a season.
struct EtelMenuToggleRow: View {
    let recipe: Recipe
    var leading: CGFloat = 0
    @Environment(EvadStore.self) private var evad: EvadStore?

    private var seasonId: String? { evad?.overview?.season.id }

    var body: some View {
        let t = etelMenuToggle(recipe, options: evad?.menu.recipeOptions, hasSeason: seasonId != nil, allowed: evad?.menu.allowedIds)
        switch t {
        case .hidden: EmptyView()
        case .blocked(let reason):
            Text("Nem jöhet menübe: \(reason)").nkFont(12).foregroundStyle(.white.opacity(0.5))
                .fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, leading).padding(.bottom, 10)
        case .on, .off:
            let on = t == .on
            Button {
                guard let seasonId else { return }
                let key = etelMenuKey(recipe)
                Task { await evad?.menu.setAllowed(key, on: !on, seasonId: seasonId) }
            } label: {
                HStack(spacing: 10) {
                    EvadTick(on: on)
                    Text("Menübe jöhet").nkFont(13.5, .medium).foregroundStyle(.white.opacity(on ? 0.95 : 0.7))
                    Spacer(minLength: 0)
                }
                .padding(.leading, leading).padding(.bottom, 10).frame(minHeight: 44).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(recipe.name): menübe jöhet")
            .accessibilityValue(on ? "be" : "ki")
            .accessibilityAddTraits(.isToggle)
        }
    }
}
