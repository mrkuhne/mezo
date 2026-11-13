import SwiftUI
import BoopCore
import BoopDesign

// The `Ma` tab of the Étel room: what still fits, the day's windows (each logged meal with its own photo), the
// next-meal tip, water and the supplement groups. Adherence-neutral: over budget is a negative number in the normal
// colour, never red, and nothing counts a streak.

struct EtelMa: View {
    let store: EtelStore
    let onDimension: (DimensionSelection) -> Void
    let onToast: (String) -> Void
    let onRetry: () -> Void
    let onTab: (EtelTab) -> Void
    /// Opens the composer at an entrance (nil = the picker).
    let onCapture: (MealStart.Entrance) -> Void
    let onCard: (PendingCardAction, PendingDraft) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        PendingMealCards(store: store, onSave: { onCard(.save, $0) }, onEdit: { onCard(.edit, $0) },
                         onRetry: { onCard(.retry, $0) }, onDiscard: { onCard(.discard, $0) },
                         onRetryPhoto: { onCard(.retryPhoto, $0) })
        NKDrillSection(number: 1, label: "AMI MÉG BELEFÉR") { budget }
        NKDrillSection(number: 2, label: "A MAI TERVED") { windows }
        NKDrillSection(number: 3, label: "MIT EGYÉL LEGKÖZELEBB") { tip }
        NKDrillSection(number: 4, label: "VÍZ") { water }
        NKDrillSection(number: 5, label: "KIEGÉSZÍTŐK") { supplements }
    }

    // MARK: - Quiet states shared by the sections

    private func problemLine(_ text: String, _ problem: FoodFetchError) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(text).nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            Text(etelProblemLine(problem)).nkFont(13).foregroundStyle(.white.opacity(0.5))
            retry
        }
    }

    private var retry: some View {
        Button(action: onRetry) {
            Text("Újra").nkFont(14, .semibold).foregroundStyle(NK.ground)
                .padding(.horizontal, 18).frame(minHeight: 38).background(Capsule().fill(.white.opacity(0.95)))
        }
        .buttonStyle(.plain)
    }

    private func loadingLine(_ text: String) -> some View {
        Text(text).nkFont(14).foregroundStyle(.white.opacity(0.55)).redacted(reason: .placeholder)
    }

    // MARK: - 1 · the budget

    @ViewBuilder private var budget: some View {
        if let day = store.day {
            let remaining = store.plan?.remaining
            VStack(alignment: .leading, spacing: 16) {
                if day.fuelMode == "GUIDANCE" {
                    Text("Kímélő nap: ma nincs kalóriakeret, csak egyél nyugodtan.").nkFont(15).foregroundStyle(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    let left = remaining.map { Int($0.kcal.rounded()) } ?? Int((day.targets.kcal - day.consumed.kcal - Double(day.skippedKcal)).rounded())
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(huInt(left)).font(.nkNumber(52)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.6)
                        Text("kcal").nkFont(14, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                        Spacer(minLength: 8)
                        Text("\(huInt(Int(day.consumed.kcal.rounded()))) / \(huInt(Int(day.targets.kcal.rounded())))")
                            .nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.7)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(huInt(left)) kalória van még hátra, \(huInt(Int(day.consumed.kcal.rounded()))) a \(huInt(Int(day.targets.kcal.rounded())))-ből megvan")
                    VStack(spacing: 10) {
                        macro("Fehérje", day.consumed.p, day.targets.p, remaining?.p)
                        macro("Szénhidrát", day.consumed.c, day.targets.c, remaining?.c)
                        macro("Zsír", day.consumed.f, day.targets.f, remaining?.f)
                    }
                }
            }
        } else if let problem = store.dayProblem {
            problemLine("A mai keretedet most nem látom.", problem)
        } else {
            loadingLine("A mai keret betöltése folyamatban")
        }
    }

    /// One macro: the bar of what is eaten, and "még N g" — a negative N when over, in the same colour.
    private func macro(_ name: String, _ eaten: Double, _ target: Double, _ remaining: Double?) -> some View {
        let left = Int((remaining ?? (target - eaten)).rounded())
        return HStack(spacing: 12) {
            Text(name).nkFont(14).foregroundStyle(.white.opacity(0.8)).lineLimit(1).minimumScaleFactor(0.8)
                .frame(width: 92, alignment: .leading)
            Capsule().fill(.white.opacity(0.08)).frame(height: 6)
                .overlay(alignment: .leading) {
                    GeometryReader { g in
                        Capsule().fill(.white.opacity(0.85)).frame(width: g.size.width * (target > 0 ? min(1, max(0, eaten / target)) : 0))
                    }
                }
            Text("még \(huInt(left)) g").nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.75))
                .lineLimit(1).minimumScaleFactor(0.7).frame(width: 78, alignment: .trailing)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - 2 · the day's windows

    @ViewBuilder private var windows: some View {
        if let plan = store.plan, let day = store.day {
            let items = etelWindowItems(plan: plan, day: day)
            if let line = etelWindowsEmptyLine(items) {
                Text(line).nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: 12) {
                    ForEach(items) { item in
                        switch item {
                        case .logged(let label, let meals):
                            ForEach(meals) { m in
                                MealCard(meal: m, slotLabel: label, photo: store.photos[m.id], coach: store.coach[m.id], onDimension: onDimension)
                            }
                        case .open(let w): OpenWindowCard(window: w, onToast: onToast, onCapture: onCapture)
                        case .skipped(let w): quietRow(w, "Kihagyva")
                        case .quiet(let w): quietRow(w, "Kész, a részletei nincsenek itt")
                        }
                    }
                }
            }
        } else if let problem = store.planProblem ?? store.dayProblem {
            problemLine("A mai tervedet most nem látom.", problem)
        } else {
            loadingLine("A mai terv betöltése folyamatban")
        }
    }

    private func quietRow(_ w: PlanWindow, _ text: String) -> some View {
        HStack {
            Text("\(w.label.uppercased()) · \(w.from)–\(w.to)").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.55))
            Spacer(minLength: 8)
            Text(text).nkFont(13).foregroundStyle(.white.opacity(0.6))
        }
        .padding(.horizontal, 18).padding(.vertical, 14).frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(22)
        .accessibilityElement(children: .combine)
    }

    // MARK: - 3 · the tip

    @ViewBuilder private var tip: some View {
        if let t = store.plan?.tip, !store.tipDismissed {
            HStack(alignment: .top, spacing: 12) {
                StillOrb(palette: Hue.fuel.orb, size: 30, level: 0.6).padding(.top, 2)
                VStack(alignment: .leading, spacing: 10) {
                    Text(t.text).nkFont(16, design: .serif).lineSpacing(3).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    if !t.reason.isEmpty {
                        Text(t.reason).nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                    }
                    HStack(spacing: 8) {
                        if suggestsARecipe {
                            pill("Megnézem a receptet", primary: true) { onTab(.receptek) }
                        }
                        pill("Most nem", primary: false) { store.dismissTip() }
                    }
                }
            }
        } else if store.plan != nil {
            Text(store.tipDismissed ? "Rendben, most nem ajánlok mást." : "Ma nincs mit ajánlanom — rögzítsd, mit ettél, és szólok.")
                .nkFont(14).foregroundStyle(.white.opacity(0.7))
        } else if let problem = store.planProblem {
            problemLine("Az ajánlásomat most nem látom.", problem)
        } else {
            loadingLine("Az ajánlás betöltése folyamatban")
        }
    }

    /// The tip points at a recipe when the next open window's suggestion is one.
    private var suggestsARecipe: Bool {
        store.plan?.windows.first { $0.state == .now || $0.state == .pending }?.suggestion?.kind == .recipe
    }

    private func pill(_ title: String, primary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(14, primary ? .semibold : .regular).lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(primary ? NK.ground : .white.opacity(0.8))
                .padding(.horizontal, 16).frame(minHeight: 38)
                .background(Capsule().fill(primary ? .white.opacity(0.95) : .white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }

    // MARK: - 4 · water

    @ViewBuilder private var water: some View {
        if let day = store.day {
            let ml = Int(day.consumed.water.rounded()), target = Int(day.targets.water.rounded())
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(huInt(ml)).font(.nkNumber(34)).foregroundStyle(.white)
                    Text("ml a \(huInt(target))-ből").nkFont(14).foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.7)
                }
                .accessibilityElement(children: .combine)
                Capsule().fill(.white.opacity(0.08)).frame(height: 10)
                    .overlay(alignment: .leading) {
                        GeometryReader { g in
                            Capsule().fill(LinearGradient(colors: [Hue.fuel.sky[0], Hue.fuel.sky[1]], startPoint: .leading, endPoint: .trailing))
                                .frame(width: g.size.width * (target > 0 ? min(1, max(0, Double(ml) / Double(target))) : 0))
                                .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.8), value: ml)
                        }
                    }
                HStack(spacing: 8) {
                    ForEach([250, 500], id: \.self) { amount in
                        Button { Task { onToast(await store.addWater(amount)) } } label: {
                            Text("+\(amount) ml").nkFont(14, .semibold).foregroundStyle(.white)
                                .padding(.horizontal, 16).frame(minHeight: 38).background(Capsule().fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        } else if let problem = store.dayProblem {
            problemLine("A vízbevitelt most nem látom.", problem)
        } else {
            loadingLine("A vízbevitel betöltése folyamatban")
        }
    }

    // MARK: - 5 · supplements

    @ViewBuilder private var supplements: some View {
        if !store.groupsLoaded {
            loadingLine("A kiegészítők betöltése folyamatban")
        } else if let problem = store.groupsProblem, store.groups.isEmpty {
            problemLine("A kiegészítőidet most nem látom.", problem)
        } else if store.groups.isEmpty {
            Text("Még nincs kiegészítő a listádon. A listát a Kamrában állíthatod össze.")
                .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
        } else {
            VStack(spacing: 0) {
                ForEach(Array(store.groups.enumerated()), id: \.element.id) { k, g in
                    let done = store.isTaken(g)
                    HStack(spacing: 12) {
                        NKThumb(image: nil, glyph: done ? "check-sage" : "spark-cream", size: 42)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(g.label) · \(g.count)").nkFont(15.5, .medium).foregroundStyle(.white)
                            Text(g.summary).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                        }
                        Spacer(minLength: 8)
                        Button { Task { onToast(await store.toggle(g)) } } label: {
                            Text(done ? "Bevéve" : "Bevettem").nkFont(13.5, .semibold)
                                .foregroundStyle(done ? .white.opacity(0.7) : NK.ground)
                                .padding(.horizontal, 14).frame(minHeight: 34)
                                .background(Capsule().fill(done ? .white.opacity(0.12) : .white.opacity(0.95)))
                        }
                        .buttonStyle(.plain).disabled(store.isBusy(g))
                        .accessibilityHint(done ? "Visszavonja a bevételt" : "")
                    }
                    .padding(.vertical, 11)
                    .accessibilityElement(children: .contain)
                    if k < store.groups.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }
            }
        }
    }
}

// MARK: - A window still open: budget, suggestion, two buttons

struct OpenWindowCard: View {
    let window: PlanWindow
    let onToast: (String) -> Void
    let onCapture: (MealStart.Entrance) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text("\(window.label.uppercased()) · \(window.from)–\(window.to)").nkFont(11, design: .monospaced)
                    .foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.7)
                if window.state == .now {
                    Text("MOST").nkFont(10, .semibold, design: .monospaced).foregroundStyle(NK.ground)
                        .padding(.horizontal, 7).padding(.vertical, 3).background(Capsule().fill(.white.opacity(0.9)))
                }
                Spacer(minLength: 4)
                if let b = window.budget {
                    Text("\(huInt(Int(b.kcal.rounded()))) kcal keret").nkFont(11.5, design: .monospaced)
                        .foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            if let s = window.suggestion {
                HStack(spacing: 12) {
                    NKThumb(image: nil, glyph: "bowl-cream", size: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(s.text).nkFont(15.5, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                        if !s.reason.isEmpty { Text(s.reason).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true) }
                    }
                    Spacer(minLength: 0)
                }
            }
            HStack(spacing: 8) {
                // The skip sheet is the next task of this slice; its button is here already.
                Button { onCapture(.pick) } label: {
                    Text("Megeszem").nkFont(14, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 16).frame(minHeight: 38).background(Capsule().fill(.white.opacity(0.95)))
                }
                .buttonStyle(.plain)
                Button { onToast(soonToast("A kihagyás")) } label: {
                    Text("Kihagyom").nkFont(14).foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 16).frame(minHeight: 38).background(Capsule().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
                Spacer(minLength: 0)
                Button { onCapture(.photo) } label: {
                    NKGlyph("camera-ink", .white, size: 18).frame(width: 38, height: 38).background(Circle().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain).accessibilityLabel("Fotó az étkezésről")
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
    }
}

/// What the owner can do with a capture that is waiting.
enum PendingCardAction { case save, edit, retry, discard, retryPhoto }
