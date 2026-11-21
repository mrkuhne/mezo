import SwiftUI
import BoopCore
import BoopDesign

// The `Ma` tab of the Étel room, on the warm area blocks (mezo-r36n9.101): the one thing that matters now, the ways
// to record a meal, the day in three numbers, the day's curve, the macros, the day's meals as rows (a logged one
// opens in place), water and the supplement groups. Nothing sits in a card except the highlight.
// Adherence-neutral: over budget is a negative number in the normal colour, never red, and nothing counts a streak.

struct EtelMa: View {
    let store: EtelStore
    let onDimension: (DimensionSelection) -> Void
    let onToast: (String) -> Void
    let onRetry: () -> Void
    /// Opens the composer at an entrance (nil = the picker).
    let onCapture: (MealStart.Entrance) -> Void
    let onCard: (PendingCardAction, PendingDraft) -> Void
    /// Opens one of the settings, skip or list sheets (page level).
    let onSheet: (EtelSheet) -> Void
    /// Asks Boop about the day's food (the page's last row).
    var onAsk: () -> Void = {}
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The logged meals whose details are open.
    @State private var opened: Set<UUID> = []
    /// The later windows whose suggestion and buttons are open (the one open now always shows them).
    @State private var openedWindows: Set<String> = []

    private let hue = Hue.fuel
    private var guidance: Bool { store.day?.fuelMode == "GUIDANCE" }

    var body: some View {
        PendingMealCards(store: store, onSave: { onCard(.save, $0) }, onEdit: { onCard(.edit, $0) },
                         onRetry: { onCard(.retry, $0) }, onDiscard: { onCard(.discard, $0) },
                         onRetryPhoto: { onCard(.retryPhoto, $0) })
        highlight
        capture
        NKBare("MA EDDIG", hue: hue, state: dayState("A mai számaidat most nem látom.")) {
            if let day = store.day { NKStatRow(etelStats(day: day, plan: store.plan), hue: hue) }
        }
        if let day = store.day, let curve = etelDayCurve(day: day, plan: store.plan, now: store.clock) {
            NKBare("A NAP MENETE", hue: hue) {
                VStack(alignment: .leading, spacing: 10) {
                    NKCurve(values: curve.values, labels: curve.labels, hue: hue, target: curve.target, nowIndex: curve.nowIndex, planAfterNow: true)
                    HStack(spacing: 14) {
                        legend("megetted", dashed: false)
                        legend("a mai terv", dashed: true)
                        legend("a kereted", dashed: true, white: true)
                    }
                    Text(curve.note).nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        if !guidance {
            NKBare("MAKRÓK", hue: hue, trailing: "ami még belefér", state: dayState("A mai keretedet most nem látom.")) { macros }
        }
        NKBare("A MAI ÉTKEZÉSEK", hue: hue, state: planState) { windows }
        NKBare("VÍZ", hue: hue, state: dayState("A vízbevitelt most nem látom.")) { water }
        NKBare("KIEGÉSZÍTŐK", hue: hue, state: supplementState) { supplements }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot az étkezésedről") { onAsk() }
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

    // MARK: - The macros: what is eaten of each, and what still fits

    @ViewBuilder private var macros: some View {
        if let day = store.day {
            let remaining = store.plan?.remaining
            VStack(spacing: 14) {
                macro("Fehérje", day.consumed.p, day.targets.p, remaining?.p, hue.glow)
                macro("Szénhidrát", day.consumed.c, day.targets.c, remaining?.c, Color(red: 0.65, green: 0.91, blue: 0.78))
                macro("Zsír", day.consumed.f, day.targets.f, remaining?.f, Color(red: 0.96, green: 0.78, blue: 0.38))
            }
        }
    }

    /// One macro: its name, what is eaten of the goal, the bar, and "még N g" — a negative N when over, in the same colour.
    private func macro(_ name: String, _ eaten: Double, _ target: Double, _ remaining: Double?, _ color: Color) -> some View {
        let left = Int((remaining ?? (target - eaten)).rounded())
        return VStack(spacing: 7) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(name).nkFont(14.5, .medium).foregroundStyle(.white)
                Text("\(Int(eaten.rounded())) / \(Int(target.rounded())) g").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 8)
                Text("még").nkFont(12).foregroundStyle(.white.opacity(0.5))
                Text("\(huInt(left)) g").font(.custom(Lagy.outfitFamily, size: 17).weight(.medium)).foregroundStyle(.white).monospacedDigit()
            }
            Capsule().fill(.white.opacity(0.1)).frame(height: 5)
                .overlay(alignment: .leading) {
                    GeometryReader { g in
                        Capsule().fill(color).frame(width: max(3, g.size.width * (target > 0 ? min(1, max(0, eaten / target)) : 0)))
                    }
                }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(name): \(Int(eaten.rounded())) gramm a \(Int(target.rounded()))-ból, még \(huInt(left)) gramm")
    }

    // MARK: - The day's meals, as rows

    @ViewBuilder private var windows: some View {
        if let plan = store.plan, let day = store.day {
            let items = etelWindowItems(plan: plan, day: day)
            if let line = etelWindowsEmptyLine(items) {
                Text(line).nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { k, item in
                        if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 64) }
                        switch item {
                        case .logged(let label, let meals):
                            ForEach(meals) { m in mealRow(m, label) }
                        case .open(let w): openRow(w)
                        case .skipped(let w): skippedRow(w)
                        case .quiet(let w): quietRow(w)
                        }
                    }
                }
            }
        }
    }

    private func timeText(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "hu_HU")
        return f.string(from: date)
    }

    /// A logged meal: his photo, the name, when, the energy and the protein, the score — a tap opens its details in place.
    private func mealRow(_ m: BoopCore.Meal, _ label: String) -> some View {
        let title = mealTitle(m, slotLabel: label)
        let open = opened.contains(m.id)
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.86)) {
                    if open { opened.remove(m.id) } else { opened.insert(m.id) }
                }
            } label: {
                HStack(spacing: 12) {
                    NKThumb(image: store.photos[m.id].map { Image(uiImage: $0) }, glyph: "bowl-cream", size: 52)
                        .overlay(alignment: .bottomTrailing) { NKDoneTick(hue: hue).offset(x: 4, y: 3) }
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title).nkFont(15.5, .medium).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.leading)
                        HStack(spacing: 6) {
                            Text("\(label) · \(timeText(m.loggedAt))").nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                            if let points = mealPoints(m) {
                                Text("\(points) pont").nkFont(10.5, .semibold).foregroundStyle(hue.glow)
                                    .padding(.horizontal, 7).padding(.vertical, 2.5)
                                    .background(Capsule().fill(hue.glow.opacity(0.16)))
                            }
                        }
                    }
                    Spacer(minLength: 6)
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(huInt(Int(m.macros.kcal.rounded()))).font(.custom(Lagy.outfitFamily, size: 17).weight(.medium))
                            .foregroundStyle(.white).monospacedDigit()
                        Text("kcal · \(Int(m.macros.p.rounded())) g").nkFont(11).foregroundStyle(.white.opacity(0.5))
                    }
                    Image(systemName: open ? "chevron.up" : "chevron.down").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.35))
                }
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityHint(open ? "Bezárja a részleteket" : "Megnyitja a részleteket")
            if open {
                MealDetail(meal: m, title: title, coach: store.coach[m.id], onDimension: onDimension)
                    .padding(.leading, 64).padding(.bottom, 14)
                    .transition(.opacity)
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

    /// A window still open. The one that is on now shows its suggestion and buttons; a later one is a single quiet
    /// line until he taps it, so the page reads as a day and not as a column of buttons.
    private func openRow(_ w: PlanWindow) -> some View {
        let now = w.state == .now
        let key = "\(w.slot)-\(w.from)"
        let expanded = now || openedWindows.contains(key)
        let head = HStack(spacing: 12) {
            emptyMedallion(now)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text(w.label).nkFont(15.5, .medium).foregroundStyle(.white.opacity(now ? 1 : 0.85)).lineLimit(1)
                    if now {
                        Text("MOST").nkFont(10, .semibold, design: .monospaced).foregroundStyle(NK.ground)
                            .padding(.horizontal, 7).padding(.vertical, 3).background(Capsule().fill(hue.glow))
                    }
                }
                Text(now || w.suggestion == nil || expanded ? "\(w.from)–\(w.to)" : "\(w.from)–\(w.to) · \(w.suggestion?.text ?? "")")
                    .nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
            }
            Spacer(minLength: 6)
            if let b = w.budget {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(huInt(Int(b.kcal.rounded()))).font(.custom(Lagy.outfitFamily, size: 17).weight(.medium))
                        .foregroundStyle(now ? hue.glow : .white.opacity(0.8)).monospacedDigit()
                    Text("kcal keret").nkFont(11).foregroundStyle(.white.opacity(0.5))
                }
            }
            // The open-now row has nothing to fold, but keeps the chevron's width so the numbers line up down the list.
            Image(systemName: expanded ? "chevron.up" : "chevron.down").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.35))
                .opacity(now ? 0 : 1).accessibilityHidden(true)
        }
        .contentShape(Rectangle())
        return VStack(alignment: .leading, spacing: 10) {
            if now {
                head.accessibilityElement(children: .combine)
            } else {
                Button {
                    withAnimation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.86)) {
                        if expanded { openedWindows.remove(key) } else { openedWindows.insert(key) }
                    }
                } label: { head }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityHint(expanded ? "Bezárja" : "Megnyitja: megeszem vagy kihagyom")
            }
            if expanded {
                VStack(alignment: .leading, spacing: 10) {
                    if let s = w.suggestion {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(s.text).nkFont(15, design: .serif).foregroundStyle(.white.opacity(0.92)).fixedSize(horizontal: false, vertical: true)
                            if !s.reason.isEmpty {
                                Text(s.reason).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    HStack(spacing: 8) {
                        Button { onCapture(.pick) } label: {
                            Text("Megeszem").nkFont(14, .semibold).foregroundStyle(now ? NK.ground : .white)
                                .padding(.horizontal, 16).frame(minHeight: 38)
                                .background {
                                    if now { Capsule().fill(.white.opacity(0.95)) }
                                    else { Capsule().fill(.white.opacity(0.1)).overlay(Capsule().stroke(.white.opacity(0.18))) }
                                }
                        }
                        .buttonStyle(.plain)
                        if !guidance {
                            Button { onSheet(.skip(w)) } label: {
                                Text("Kihagyom").nkFont(14).foregroundStyle(.white.opacity(0.8))
                                    .padding(.horizontal, 16).frame(minHeight: 38)
                                    .background(Capsule().fill(.white.opacity(0.1)).overlay(Capsule().stroke(.white.opacity(0.18))))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(w.label) kihagyása")
                        }
                        Spacer(minLength: 0)
                        Button { onCapture(.photo) } label: {
                            NKGlyph("camera-ink", .white, size: 18).frame(width: 38, height: 38).background(Circle().fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain).accessibilityLabel("Fotó az étkezésről")
                    }
                }
                .padding(.leading, 64)
                .transition(.opacity)
            }
        }
        .padding(.vertical, 12)
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

    private func quietRow(_ w: PlanWindow) -> some View {
        HStack(spacing: 12) {
            emptyMedallion(false).overlay(alignment: .bottomTrailing) { NKDoneTick(hue: hue).offset(x: 4, y: 3) }
            VStack(alignment: .leading, spacing: 3) {
                Text(w.label).nkFont(15.5, .medium).foregroundStyle(.white.opacity(0.8)).lineLimit(1)
                Text("\(w.from)–\(w.to) · kész, a részletei nincsenek itt").nkFont(12).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
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
