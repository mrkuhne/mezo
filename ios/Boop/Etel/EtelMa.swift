import SwiftUI
import BoopCore
import BoopDesign

// The `Ma` tab of the Étel room in three tiers (mezo-r36n9.184, decision #120): a hero card (the kcal ring and the
// three macro bars; swipe it for the day's curve), the ways to record a meal, one glass card per plan window (a
// logged meal opens its own page), then the small cards — drinks, water, supplements — and the ask row.
// Adherence-neutral: over budget is a negative number in the normal colour, never red, and nothing counts a streak.

struct EtelMa: View {
    let store: EtelStore
    let onToast: (String) -> Void
    let onRetry: () -> Void
    /// Opens the composer at an entrance (nil = the picker).
    let onCapture: (MealStart.Entrance) -> Void
    /// Opens the composer on a prepared start: a window's „+" at that window's time, or a logged meal to correct.
    let onCompose: (MealStart) -> Void
    /// Takes a logged meal off the page with a few seconds of Visszavonás (the room defers the server delete).
    let onDelete: (BoopCore.Meal, String) -> Void
    let onCard: (PendingCardAction, PendingDraft) -> Void
    /// Opens one of the settings, skip or list sheets (page level).
    let onSheet: (EtelSheet) -> Void
    /// Asks Boop about the day's food (the page's last row).
    var onAsk: () -> Void = {}
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    /// The logged meal whose own page is open.
    @State private var detailMeal: BoopCore.Meal?
    @State private var heroPage = 0
    @ScaledMetric(relativeTo: .body) private var heroHeight: CGFloat = 268

    private let hue = Hue.fuel
    private var guidance: Bool { store.day?.fuelMode == "GUIDANCE" }
    private var online: Bool { ritmus?.online ?? true }

    var body: some View {
        PendingMealCards(store: store, onSave: { onCard(.save, $0) }, onEdit: { onCard(.edit, $0) },
                         onRetry: { onCard(.retry, $0) }, onDiscard: { onCard(.discard, $0) },
                         onRetryPhoto: { onCard(.retryPhoto, $0) })
        highlight
        heroCard
        capture
        windowCards
            .fullScreenCover(item: $detailMeal) { m in
                MealDetailPage(store: store, initial: m, label: label(of: m), onSaved: { onRetry() },
                               onDelete: onDelete, onClose: { detailMeal = nil })
            }
        if let day = store.day, !etelDrinks(day).isEmpty {
            card("ITALOK", trailing: "\(huInt(etelDrinkKcal(day))) kcal") { drinks(etelDrinks(day)) }
        }
        card("VÍZ", state: dayState("A vízbevitelt most nem látom.")) { water }
        card("KIEGÉSZÍTŐK", state: supplementState) { supplements }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot az étkezésedről") { onAsk() }
    }

    // MARK: - A glass card: the small-caps head on the card, the block's own loading and failed states inside

    private func card<C: View>(_ label: String, trailing: String? = nil, state: NKBlockState = .ready,
                               @ViewBuilder _ content: () -> C) -> some View {
        NKBare(label, hue: hue, trailing: trailing, state: state, content: content)
            .padding(.horizontal, 16).padding(.vertical, 12)
            .nkGlass(24)
    }

    private func label(of m: BoopCore.Meal) -> String {
        guard let day = store.day else { return etelSlotLabel(m.slot) }
        return etelMealLabel(m, plan: store.plan, day: day)
    }

    // MARK: - The hero: the kcal ring and the macro bars; page 2 the day's curve

    @ViewBuilder private var heroCard: some View {
        if let day = store.day {
            Group {
                if typeSize.isAccessibilitySize {
                    // The largest type sizes: both pages one under the other, nothing clipped to a fixed height.
                    VStack(spacing: 22) { heroRingPage(day); heroCurvePage(day) }
                } else {
                    VStack(spacing: 10) {
                        TabView(selection: $heroPage) {
                            heroRingPage(day).tag(0)
                            heroCurvePage(day).tag(1)
                        }
                        .tabViewStyle(.page(indexDisplayMode: .never))
                        .frame(height: min(heroHeight, 420) - (guidance ? 40 : 0))
                        HStack(spacing: 6) {
                            ForEach(0..<2) { i in
                                Capsule().fill(.white.opacity(heroPage == i ? 0.85 : 0.25)).frame(width: heroPage == i ? 16 : 6, height: 6)
                            }
                        }
                        .accessibilityHidden(true)
                    }
                }
            }
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .nkGlass(28)
        } else {
            card("MA EDDIG", state: dayState("A mai számaidat most nem látom.")) { EmptyView() }
        }
    }

    private func heroRingPage(_ day: FoodDay) -> some View {
        let centre = etelRingCentre(day: day, plan: store.plan)
        let eaten = day.consumed.kcal, target = day.targets.kcal
        let big = typeSize.isAccessibilitySize
        let top = big ? AnyLayout(VStackLayout(alignment: .leading, spacing: 16)) : AnyLayout(HStackLayout(spacing: 20))
        let bars = big ? AnyLayout(VStackLayout(spacing: 12)) : AnyLayout(HStackLayout(spacing: 12))
        return VStack(spacing: 18) {
            top {
                ZStack {
                    Circle().stroke(.white.opacity(0.10), lineWidth: 14)
                    Circle().trim(from: 0, to: etelRingFraction(day: day))
                        .stroke(AngularGradient(colors: [hue.glow.opacity(0.7), hue.glow, Color(red: 0.75, green: 0.95, blue: 0.82)], center: .center),
                                style: StrokeStyle(lineWidth: 14, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 2) {
                        Text(centre.top).nkFont(13).foregroundStyle(.white.opacity(0.65)).lineLimit(1).minimumScaleFactor(0.6)
                        Text(centre.number).font(.nkNumber(44)).foregroundStyle(.white).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.5)
                        Text(centre.bottom).nkFont(12).foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .padding(20)
                }
                .frame(width: 166, height: 166)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(guidance ? "Ma nincs keret. \(centre.number) kilokalória megvan."
                                             : "\(centre.top) \(centre.number) \(centre.bottom). \(huInt(Int(eaten.rounded()))) a \(huInt(Int(target.rounded())))-ból.")
                VStack(alignment: .leading, spacing: 14) {
                    heroStat(huInt(Int(eaten.rounded())), "megetted", sub: guidance ? nil : "a kereted \(huInt(Int(target.rounded())))")
                    heroStat("\(Int(day.consumed.p.rounded())) g", "fehérje", sub: guidance ? nil : "a célod \(Int(day.targets.p.rounded())) g", lit: true)
                }
                if !big { Spacer(minLength: 0) }
            }
            bars {
                heroMacro("Fehérje", day.consumed.p, day.targets.p, store.plan?.remaining?.p, hue.glow)
                heroMacro("Szénhidrát", day.consumed.c, day.targets.c, store.plan?.remaining?.c, Color(red: 0.65, green: 0.91, blue: 0.78))
                heroMacro("Zsír", day.consumed.f, day.targets.f, store.plan?.remaining?.f, Color(red: 0.96, green: 0.78, blue: 0.38))
            }
        }
        .padding(.horizontal, 18)
    }

    private func heroStat(_ value: String, _ label: String, sub: String?, lit: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.custom(Lagy.outfitFamily, size: 24, relativeTo: .title2).weight(.medium))
                .foregroundStyle(lit ? hue.glow : .white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(label).nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.8))
            if let sub { Text(sub).nkFont(11.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true) }
        }
        .accessibilityElement(children: .combine)
    }

    /// One macro: the bar and "még N g" — a negative N when over, in the same colour; eaten only on a kímélő day.
    private func heroMacro(_ name: String, _ eaten: Double, _ target: Double, _ remaining: Double?, _ color: Color) -> some View {
        let left = Int((remaining ?? (target - eaten)).rounded())
        let line = guidance ? "\(Int(eaten.rounded())) g" : "még \(huInt(left)) g"
        return VStack(alignment: .leading, spacing: 6) {
            Text(name).nkFont(12, .medium).foregroundStyle(.white.opacity(0.85)).lineLimit(1).minimumScaleFactor(0.8)
            Capsule().fill(.white.opacity(0.1)).frame(height: 6)
                .overlay(alignment: .leading) {
                    if !guidance {
                        GeometryReader { g in
                            Capsule().fill(color).frame(width: max(4, g.size.width * (target > 0 ? min(1, max(0, eaten / target)) : 0)))
                        }
                    }
                }
            Text(line).nkFont(11.5).foregroundStyle(.white.opacity(0.6)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(guidance ? "\(name): \(Int(eaten.rounded())) gramm"
                                     : "\(name): \(Int(eaten.rounded())) gramm a \(Int(target.rounded()))-ból, még \(huInt(left)) gramm")
    }

    @ViewBuilder private func heroCurvePage(_ day: FoodDay) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            NKMono("A NAP MENETE")
            if let curve = etelDayCurve(day: day, plan: store.plan, now: store.clock) {
                NKCurve(values: curve.values, labels: curve.labels, hue: hue, target: curve.target, nowIndex: curve.nowIndex, planAfterNow: true)
                HStack(spacing: 14) {
                    legend("megetted", dashed: false)
                    legend("a mai terv", dashed: true)
                    legend("a kereted", dashed: true, white: true)
                }
                Text(curve.note).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            } else {
                Text("A nap menete az első étkezés után rajzolódik ki.").nkFont(13).foregroundStyle(.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
    }

    // MARK: - One glass card per plan window

    @ViewBuilder private var windowCards: some View {
        if let plan = store.plan, let day = store.day {
            let items = etelWindowItems(plan: plan, day: day)
            if let line = etelWindowsEmptyLine(items) {
                card("A MAI ÉTKEZÉSEK") { Text(line).nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true) }
            } else {
                VStack(spacing: 22) { ForEach(items) { item in windowCard(item, window: etelWindow(of: item, plan: plan)) } }
            }
        } else {
            card("A MAI ÉTKEZÉSEK", state: planState) { EmptyView() }
        }
    }

    private func windowCard(_ item: EtelWindowItem, window w: PlanWindow?) -> some View {
        let name: String = {
            switch item {
            case .logged(let l, _): l
            case .open(let w), .skipped(let w), .quiet(let w): w.label
            }
        }()
        let now = w?.state == .now
        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 7) {
                        Text(name).font(.nkSerif(20)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                        if now {
                            Text("MOST").nkFont(10, .semibold, design: .monospaced).foregroundStyle(NK.ground)
                                .padding(.horizontal, 7).padding(.vertical, 3).background(Capsule().fill(hue.glow))
                        }
                    }
                    if let w { Text("\(w.from)–\(w.to)").nkFont(12).foregroundStyle(.white.opacity(0.5)) }
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 6)
                if let total = etelWindowTotal(item, window: w) {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(total.value).font(.custom(Lagy.outfitFamily, size: 20, relativeTo: .title3).weight(.medium))
                            .foregroundStyle(now && !isLogged(item) ? hue.glow : .white).monospacedDigit()
                        Text(total.unit).nkFont(11).foregroundStyle(.white.opacity(0.5))
                    }
                    .accessibilityElement(children: .combine)
                }
                Button { onCompose(MealStart(entrance: .pick, at: w.flatMap { etelWindowCaptureTime($0, now: store.clock) })) } label: {
                    Image(systemName: "plus").nkFont(15, .semibold).foregroundStyle(.white)
                        .frame(width: 44, height: 44).background(Circle().fill(.white.opacity(0.12)).padding(4))
                }
                .buttonStyle(.plain).accessibilityLabel("Étkezés rögzítése: \(name)")
            }
            .padding(.bottom, 4)
            switch item {
            case .logged(let l, let meals):
                ForEach(Array(meals.enumerated()), id: \.element.id) { k, m in
                    if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 64) }
                    mealRow(m, l)
                }
            case .open(let w): openBody(w)
            case .skipped(let w): skippedRow(w)
            case .quiet:
                Text("Kész, a részletei nincsenek itt.").nkFont(13).foregroundStyle(.white.opacity(0.5))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(24)
        .overlay {
            if now { RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(hue.glow.opacity(0.45), lineWidth: 1).allowsHitTesting(false) }
        }
    }

    private func isLogged(_ item: EtelWindowItem) -> Bool { if case .logged = item { true } else { false } }

    private func timeText(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "hu_HU")
        return f.string(from: date)
    }

    /// A logged meal inside its window's card: a tap opens its own page; swipe left or long-press to correct or delete.
    private func mealRow(_ m: BoopCore.Meal, _ label: String) -> some View {
        let title = mealTitle(m, slotLabel: label)
        return HStack(spacing: 12) {
                NKThumb(image: store.photos[m.id].map { Image(uiImage: $0) }, glyph: "bowl-cream", size: 52)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).nkFont(15.5, .medium).foregroundStyle(.white).lineLimit(3).multilineTextAlignment(.leading)
                    HStack(spacing: 6) {
                        Text(timeText(m.loggedAt)).nkFont(12).foregroundStyle(.white.opacity(0.55))
                        Text("F \(Int(m.macros.p.rounded())) · Sz \(Int(m.macros.c.rounded())) · Zs \(Int(m.macros.f.rounded()))")
                            .nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.5)).lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(huInt(Int(m.macros.kcal.rounded()))).font(.custom(Lagy.outfitFamily, size: 17, relativeTo: .body).weight(.medium))
                        .foregroundStyle(.white).monospacedDigit()
                    if let points = mealPoints(m) {
                        Text("\(points) pont").nkFont(10.5, .semibold).foregroundStyle(hue.glow)
                            .padding(.horizontal, 7).padding(.vertical, 2.5).background(Capsule().fill(hue.glow.opacity(0.16)))
                    }
                }
                Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.35))
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(timeText(m.loggedAt)), \(huInt(Int(m.macros.kcal.rounded()))) kilokalória\(mealPoints(m).map { ", \($0) pont" } ?? "")")
        .accessibilityHint("Megnyitja az étkezés oldalát")
        .modifier(MealRowActions(online: online, title: title,
                                 onOpen: { detailMeal = m },
                                 onEdit: { onCompose(MealStart(entrance: .edit, editing: m)) },
                                 onDelete: { onDelete(m, title) }))
    }

    /// The open window's body inside its card: Boop's suggestion; on the window open now Megeszem · Kihagyom · photo,
    /// on a later one Kihagyom (its „+" is the Megeszem).
    private func openBody(_ w: PlanWindow) -> some View {
        let now = w.state == .now
        return VStack(alignment: .leading, spacing: 10) {
            if let s = w.suggestion {
                VStack(alignment: .leading, spacing: 3) {
                    Text(s.text).nkFont(now ? 15 : 14, design: .serif).foregroundStyle(.white.opacity(now ? 0.92 : 0.75))
                        .fixedSize(horizontal: false, vertical: true)
                    if now, !s.reason.isEmpty {
                        Text(s.reason).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            HStack(spacing: 8) {
                if now {
                    Button { onCapture(.pick) } label: {
                        Text("Megeszem").nkFont(14, .semibold).foregroundStyle(NK.ground)
                            .padding(.horizontal, 16).frame(minHeight: 40).background(Capsule().fill(.white.opacity(0.95)))
                    }
                    .buttonStyle(.plain)
                }
                if !guidance {
                    Button { onSheet(.skip(w)) } label: {
                        Text("Kihagyom").nkFont(14).foregroundStyle(.white.opacity(0.8))
                            .padding(.horizontal, 16).frame(minHeight: 40)
                            .background(Capsule().fill(.white.opacity(0.1)).overlay(Capsule().stroke(.white.opacity(0.18))))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(w.label) kihagyása")
                }
                Spacer(minLength: 0)
                if now {
                    Button { onCapture(.photo) } label: {
                        NKGlyph("camera-ink", .white, size: 18).frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.1)))
                    }
                    .buttonStyle(.plain).accessibilityLabel("Fotó az étkezésről")
                }
            }
        }
    }

    /// One entry of the curve's legend: a short stroke the way the line is drawn, and what it is.
    private func legend(_ text: String, dashed: Bool, white: Bool = false) -> some View {
        HStack(spacing: 6) {
            Path { p in p.move(to: CGPoint(x: 0, y: 1)); p.addLine(to: CGPoint(x: 16, y: 1)) }
                .stroke(white ? Color.white.opacity(0.55) : hue.glow, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: dashed ? [2, 4] : []))
                .frame(width: 16, height: 2)
            Text(text).nkFont(11.5).foregroundStyle(.white.opacity(0.6))
        }
        .accessibilityHidden(true)
    }

    // MARK: - The three ways to record a meal, one tap each (the barcode lives in the composer and on Kamra)

    private var capture: some View {
        HStack(spacing: 8) {
            captureTile("camera-ink", "Fotó", .photo, primary: true)
            captureTile("pen-sun", "Leírom", .text)
            captureTile("star-sun", "Szokásos", .usual)
        }
    }

    private func captureTile(_ glyph: String, _ title: String, _ entrance: MealStart.Entrance, primary: Bool = false) -> some View {
        Button { onCapture(entrance) } label: {
            VStack(spacing: 7) {
                NKGlyph(glyph, primary ? NK.ground : .white, size: 19)
                Text(title).nkFont(12.5, .semibold).foregroundStyle(primary ? NK.ground : .white.opacity(0.9))
                    .lineLimit(1).minimumScaleFactor(0.7)
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
        .accessibilityLabel("Étkezés rögzítése: \(title)")
    }

    // MARK: - Each block's own state

    private func dayState(_ line: String) -> NKBlockState {
        if store.day != nil { return .ready }
        if let problem = store.dayProblem { return .failed("\(line) \(etelProblemLine(problem))", { onRetry() }) }
        return .loading
    }

    private var planState: NKBlockState {
        if store.plan != nil, store.day != nil { return .ready }
        if let problem = store.planProblem ?? store.dayProblem {
            return .failed("A mai tervedet most nem látom. \(etelProblemLine(problem))", { onRetry() })
        }
        return .loading
    }

    private var supplementState: NKBlockState {
        if !store.groupsLoaded { return .loading }
        if let problem = store.groupsProblem, store.groups.isEmpty {
            return .failed("A kiegészítőidet most nem látom. \(etelProblemLine(problem))", { onRetry() })
        }
        return .ready
    }

    // MARK: - The highlight: only the kímélő day

    @ViewBuilder private var highlight: some View {
        if guidance {
            NKHighlight(hue: hue, label: "KÍMÉLŐ NAP", text: "Ma nincs kalóriakeret",
                        sub: "Azt egyél, ami jólesik, és amit a gyomrod elbír. A napot nem értékelem.",
                        actions: [NKHighlightAction("Kikapcsolom a kímélő módot", weight: .secondary) {
                            Task { onToast(await store.endKimelo().text) }
                        }])
        }
        // The "Következik: …" tip card is gone (owner, 2026-11-21, mezo-r36n9.135): the open-now meal row below already
        // says what comes next and offers its suggestion.
    }

    // MARK: - The day's drinks (`mezo-r36n9.160`): no window, no ring

    private func drinks(_ list: [BoopCore.Meal]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(list.enumerated()), id: \.element.id) { k, m in
                if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 52) }
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(hue.glow.opacity(0.16)).frame(width: 40, height: 40)
                        NKGlyph("cup-cream", hue.glow, size: 18)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text(mealTitle(m, slotLabel: "Ital")).nkFont(15, .medium).foregroundStyle(.white).lineLimit(2)
                        Text("\(timeText(m.loggedAt)) · \(huInt(Int(m.macros.kcal.rounded()))) kcal · \(Int(m.macros.p.rounded())) g fehérje")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                    }
                    Spacer(minLength: 8)
                    Text("ital").nkFont(11, .medium, design: .monospaced).tracking(1).foregroundStyle(.white.opacity(0.55))
                        .padding(.horizontal, 8).padding(.vertical, 4).background(Capsule().fill(.white.opacity(0.08)))
                    Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.35))
                }
                .padding(.vertical, 10)
                .contentShape(Rectangle())
                .accessibilityElement(children: .combine)
                .accessibilityHint("Megnyitja az ital oldalát")
                .modifier(MealRowActions(online: online, title: mealTitle(m, slotLabel: "Ital"),
                                         onOpen: { detailMeal = m },
                                         onEdit: { onCompose(MealStart(entrance: .edit, editing: m)) },
                                         onDelete: { onDelete(m, mealTitle(m, slotLabel: "Ital")) }))
            }
        }
    }

    /// The window's medallion when nothing is logged in it yet: an outline, lit while it is the one open now.
    private func emptyMedallion(_ now: Bool) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 15.6, style: .continuous)
                .fill(now ? hue.glow.opacity(0.14) : .clear)
            RoundedRectangle(cornerRadius: 15.6, style: .continuous)
                .stroke(now ? hue.glow.opacity(0.7) : .white.opacity(0.28), style: StrokeStyle(lineWidth: 1, dash: now ? [] : [3, 2]))
            NKGlyph("bowl-cream", now ? hue.glow : .white.opacity(0.7), size: 20)
        }
        .frame(width: 52, height: 52)
        .accessibilityHidden(true)
    }

    /// A skipped window with the way back: Visszavonom plans it again and the budget returns.
    private func skippedRow(_ w: PlanWindow) -> some View {
        HStack(spacing: 12) {
            emptyMedallion(false).saturation(0).opacity(0.6)
            VStack(alignment: .leading, spacing: 3) {
                Text(w.label).nkFont(15.5, .medium).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                Text("\(w.from)–\(w.to) · kihagyva").nkFont(12).foregroundStyle(.white.opacity(0.45)).lineLimit(1)
            }
            Spacer(minLength: 6)
            Button { Task { onToast(await store.unskip(w)) } } label: {
                Text("Visszavonom").nkFont(13, .semibold).foregroundStyle(.white.opacity(0.9))
                    .padding(.horizontal, 12).frame(minHeight: 34).background(Capsule().fill(.white.opacity(0.12)))
            }
            .buttonStyle(.plain).accessibilityLabel("\(w.label) kihagyásának visszavonása")
        }
        .padding(.vertical, 12)
    }

    // MARK: - Water

    @ViewBuilder private var water: some View {
        if let day = store.day {
            let ml = Int(day.consumed.water.rounded()), target = Int(day.targets.water.rounded())
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(huInt(ml)).font(.nkNumber(34)).foregroundStyle(.white)
                    Text("/ \(huInt(target)) ml").nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.7)
                    Spacer(minLength: 8)
                    ForEach([250, 500], id: \.self) { amount in
                        Button { Task { onToast(await store.addWater(amount)) } } label: {
                            Text("+\(amount)").nkFont(14, .semibold).foregroundStyle(.white)
                                .padding(.horizontal, 14).frame(minHeight: 38)
                                .background(Capsule().fill(.white.opacity(0.1)).overlay(Capsule().stroke(.white.opacity(0.18))))
                        }
                        .buttonStyle(.plain).accessibilityLabel("\(amount) milliliter víz hozzáadása")
                    }
                }
                Capsule().fill(.white.opacity(0.1)).frame(height: 6)
                    .overlay(alignment: .leading) {
                        GeometryReader { g in
                            Capsule().fill(LinearGradient(colors: [hue.sky[0], hue.sky[1]], startPoint: .leading, endPoint: .trailing))
                                .frame(width: g.size.width * (target > 0 ? min(1, max(0, Double(ml) / Double(target))) : 0))
                                .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.8), value: ml)
                        }
                    }
            }
        }
    }

    // MARK: - Supplements

    @ViewBuilder private var supplements: some View {
        if store.groups.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Még nincs kiegészítő a listádon. Vegyél fel, amit szedsz.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                editListLink
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(store.groups.enumerated()), id: \.element.id) { k, g in
                    let done = store.isTaken(g)
                    if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 52) }
                    HStack(spacing: 12) {
                        ZStack {
                            Circle().fill(done ? hue.glow.opacity(0.22) : .white.opacity(0.08))
                            NKGlyph(done ? "check-sage" : "spark-cream", done ? hue.glow : .white.opacity(0.9), size: 16)
                        }
                        .frame(width: 40, height: 40).accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(g.label) · \(g.count)").nkFont(14.5, .medium).foregroundStyle(.white)
                            Text(g.summary).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
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
                }
                editListLink.padding(.top, 10)
            }
        }
    }

    private var editListLink: some View {
        Button { onSheet(.supplements) } label: {
            HStack(spacing: 6) {
                Text("A lista szerkesztése").nkFont(13.5, .medium).foregroundStyle(hue.glow)
                Image(systemName: "chevron.right").nkFont(11, .semibold).foregroundStyle(hue.glow.opacity(0.7))
            }
            .frame(minHeight: 38).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// What the owner can do with a capture that is waiting.
enum PendingCardAction { case save, edit, retry, discard, retryPhoto }

/// A logged row's other routes besides the tap (spec §5.1, HIG: a swipe is never the only route): swipe left to
/// reveal Törlés (a long swipe deletes at once), long-press for Megnyitás · Javítás · Törlés, and the same three as
/// VoiceOver actions. Offline the correcting routes stay visible but disabled — they need the net.
private struct MealRowActions: ViewModifier {
    let online: Bool
    let title: String
    let onOpen: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    @State private var offset: CGFloat = 0
    @State private var revealed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let reveal: CGFloat = 88, commit: CGFloat = 200

    func body(content: Content) -> some View {
        ZStack(alignment: .trailing) {
            if offset < 0 {
                Button(role: .destructive) { close(); onDelete() } label: {
                    VStack(spacing: 3) {
                        Image(systemName: "trash").nkFont(16, .semibold)
                        Text("Törlés").nkFont(11.5, .semibold)
                    }
                    .foregroundStyle(.white)
                    .frame(width: max(0, -offset)).frame(maxHeight: .infinity)
                    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(red: 0.78, green: 0.33, blue: 0.30)))
                }
                .buttonStyle(.plain)
                .accessibilityHidden(true)
            }
            // A tap opens the page — a tap gesture, not a Button: a Button would still fire when the finger lifts after
            // a swipe inside the row. While Törlés shows, a tap closes it instead.
            content
                .offset(x: offset)
                .onTapGesture { if revealed { close() } else { onOpen() } }
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { onOpen() }
        }
        .clipped()
        .simultaneousGesture(
            DragGesture(minimumDistance: 24)
                .onChanged { v in
                    guard online, abs(v.translation.width) > abs(v.translation.height) * 1.6 else { return }
                    offset = min(0, v.translation.width + (revealed ? -reveal : 0))
                }
                .onEnded { v in
                    guard online else { return }
                    let x = v.translation.width + (revealed ? -reveal : 0)
                    if x < -commit { close(); onDelete() }
                    else if x < -reveal / 2 { animate { offset = -reveal; revealed = true } }
                    else { close() }
                }
        )
        .contextMenu {
            Button(action: onOpen) { Label("Megnyitás", systemImage: "doc.text") }
            Button(action: onEdit) { Label("Javítás", systemImage: "pencil") }.disabled(!online)
            Button(role: .destructive, action: onDelete) { Label("Törlés", systemImage: "trash") }.disabled(!online)
        }
        .accessibilityAction(named: "Javítás") { if online { onEdit() } }
        .accessibilityAction(named: "Törlés") { if online { onDelete() } }
    }

    private func close() { animate { offset = 0; revealed = false } }
    private func animate(_ change: () -> Void) {
        withAnimation(reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.86), change)
    }
}
