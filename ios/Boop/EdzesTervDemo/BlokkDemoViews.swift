#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY SIMULATOR DEMO, round 2 — see BlokkDemoModel.swift.
// Owner on round 1: untidy, too much scrolling, unclear whether it is a week or the block, "nothing exciting".
// Round 2: a full-screen builder with its own three-way bar (Izmok · Napok · Blokk), the body as the hero, a
// dial per muscle, paged days; the review is a deck of cards, one muscle a card, decided on the card.

struct BlokkDemoRoot: View {
    enum Route { case hub, builder, review, player }
    @State private var model = BlokkDemoModel()
    @State private var route: Route = {
        switch UserDefaults.standard.string(forKey: "previewBlokkOpen") {
        case "epito": .builder
        case "het": .review
        case "edzes": .player
        default: .hub
        }
    }()

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            switch route {
            case .hub: BlokkDemoHub(model: model) { route = $0 }.transition(.opacity)
            case .builder: BlokkBuilderPage(model: model) { route = .hub }.transition(.move(edge: .bottom).combined(with: .opacity))
            case .review: WeekReviewDeck(model: model) { route = .hub }.transition(.move(edge: .bottom).combined(with: .opacity))
            case .player: BlokkDemoPlayer(model: model) { route = .hub }.transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.smooth(duration: 0.35), value: route)
        .preferredColorScheme(.dark)
    }
}

let demoHue = Hue.mozgas
let demoWarn = Color(hex: 0xF2C94C)
let demoGood = Color(hex: 0x9FD8A8)

/// The sky of the area behind a full-screen page, fading into the ground.
struct DemoSky: View {
    var height: CGFloat = 420
    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: demoHue.sky.map { $0.opacity(0.75) } + [NK.ground], startPoint: .top, endPoint: .bottom)
                .frame(height: height)
            NK.ground
        }
        .ignoresSafeArea()
    }
}

// MARK: - The entrance

private struct BlokkDemoHub: View {
    let model: BlokkDemoModel
    let go: (BlokkDemoRoot.Route) -> Void
    private let hue = demoHue

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Edzés", eyebrow: "Blokk · 3. hét kezdődik",
                      title: "V-forma és kar",
                      sentence: "Hathetes blokk, a *hát* és a *bicepsz* a hangsúly. A második hét mögötted van.",
                      onBack: nil) {
            if model.weekAccepted {
                NKHighlight(hue: hue, label: "A 3. hét", text: "Indulhat, a hét számai élnek",
                            sub: "\(model.changes.filter(\.accepted).count) változás lépett életbe.",
                            actions: [NKHighlightAction("Megnézem", weight: .secondary) { go(.review) }])
            } else {
                NKHighlight(hue: hue, label: "Új hét · jóváhagyásra vár", text: "\(model.reviewMuscles.count) izomnál változna valami",
                            sub: "Egy-egy sorozattal több a hátra és a bicepszre, két gyakorlatnál nő a súly. Amíg nem hagyod jóvá, a múlt heti számok maradnak.",
                            actions: [NKHighlightAction("Átnézem") { go(.review) },
                                      NKHighlightAction("Elfogadom átnézés nélkül", weight: .secondary) {
                                          for m in model.reviewMuscles { model.decideAll(m, accept: true) }
                                          model.weekAccepted = true
                                      }])
            }
            NKBare("A terv", hue: hue, trailing: "\(model.total()) sorozat / hét") {
                VStack(alignment: .leading, spacing: 14) {
                    NKHueText(model.outside.isEmpty
                              ? "Minden izom a saját sávjában van."
                              : "*\(model.outside.count) izom* lóg ki a sávjából. Az építőben látod, melyik és mennyivel.",
                              hue: hue)
                    NKActions([NKAction(glyph: "dumbbell-ink", title: "Blokk szerkesztése", primary: true) { go(.builder) },
                               NKAction(glyph: "bolt-ink", title: "Edzés közben") { go(.player) }], hue: hue)
                }
            }
        }
    }
}

// MARK: - The builder: one full screen, three views

private struct BlokkBuilderPage: View {
    enum Mode: String, CaseIterable { case izmok = "Izmok", napok = "Napok", blokk = "Blokk" }
    let model: BlokkDemoModel
    let onBack: () -> Void
    @State private var mode: Mode = {
        switch UserDefaults.standard.string(forKey: "previewBlokkTab") {
        case "napok": .napok
        case "blokk": .blokk
        default: .izmok
        }
    }()
    @State private var muscle: String? = "back"
    @State private var day = 0
    @State private var saved = false

    var body: some View {
        ZStack {
            DemoSky(height: 150)
            VStack(spacing: 0) {
                head
                switch mode {
                case .izmok: MusclesView(model: model, selected: $muscle)
                case .napok: DaysView(model: model, day: $day)
                case .blokk: BlockView(model: model)
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { bar }
        .sensoryFeedback(.selection, trigger: mode)
        .sensoryFeedback(.success, trigger: saved)
    }

    private var head: some View {
        HStack(alignment: .center, spacing: 12) {
            Button(action: onBack) {
                Image(systemName: "chevron.down").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.14)))
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 2) {
                Text(scope).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.7))
                Text("V-forma és kar").nkFont(22, design: .serif).foregroundStyle(.white)
            }
            Spacer(minLength: 8)
            let out = model.outside.count
            HStack(spacing: 6) {
                Circle().fill(out == 0 ? demoGood : demoWarn).frame(width: 7, height: 7)
                Text(out == 0 ? "minden a sávban" : "\(out) izom kilóg").nkFont(12, .medium).foregroundStyle(.white.opacity(0.9))
                    .contentTransition(.numericText())
            }
            .padding(.horizontal, 11).padding(.vertical, 7)
            .background(Capsule().fill(.black.opacity(0.28)))
        }
        .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 10)
    }

    /// The one line that says what he is looking at — his question on round 1.
    private var scope: String {
        switch mode {
        case .izmok: "EGY HÉT · IZMONKÉNT"
        case .napok: "EGY HÉT · NAPONKÉNT"
        case .blokk: "A TELJES BLOKK · 6 HÉT"
        }
    }

    private var bar: some View {
        let out = model.outside
        return HStack(spacing: 10) {
            HStack(spacing: 2) {
                ForEach(Mode.allCases, id: \.self) { item in
                    Button { withAnimation(.snappy(duration: 0.28)) { mode = item } } label: {
                        VStack(spacing: 3) {
                            NKGlyph(glyph(item), mode == item ? NK.ground : .white.opacity(0.75), size: 17)
                            Text(item.rawValue).nkFont(10, .semibold).foregroundStyle(mode == item ? NK.ground : .white.opacity(0.75))
                        }
                        .frame(width: 62, height: 48)
                        .background { if mode == item { Capsule().fill(.white) } }
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(4)
            .background(Capsule().fill(.ultraThinMaterial).overlay(Capsule().stroke(.white.opacity(0.12), lineWidth: 1)))

            Button {
                withAnimation(.snappy) {
                    if out.isEmpty { saved = true } else { model.applyAll() }
                }
            } label: {
                Text(saved && out.isEmpty ? "Elmentve" : (out.isEmpty ? "Mentés" : "Igazítsd a sávba"))
                    .nkFont(15, .semibold).foregroundStyle(out.isEmpty ? NK.ground : .white)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(Capsule().fill(out.isEmpty ? AnyShapeStyle(demoHue.glow) : AnyShapeStyle(.white.opacity(0.14))))
                    .overlay(Capsule().stroke(.white.opacity(out.isEmpty ? 0 : 0.18), lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 4)
        .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground.opacity(0.95)], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }

    private func glyph(_ mode: Mode) -> String {
        switch mode {
        case .izmok: "dumbbell-ink"
        case .napok: "clock-ink"
        case .blokk: "chart-deep"
        }
    }
}

// MARK: Izmok — the body, and one muscle a card

private struct MusclesView: View {
    let model: BlokkDemoModel
    @Binding var selected: String?

    var body: some View {
        let current = selected ?? "back"
        VStack(spacing: 0) {
            NKBodyMap(BlokkDemoModel.muscles.compactMap { m in
                guard let band = model.band(m) else { return nil }
                let fill = min(1, Double(model.weekly(m)) / Double(max(1, band.high)))
                return NKBodyHeat(muscle: m, level: m == current ? 1 : fill * 0.12)
            }, hue: demoHue, views: .both)
            .frame(maxWidth: .infinity).frame(height: 222)
            .padding(.horizontal, 40).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(Color.black.opacity(0.42)).padding(.horizontal, 20))
            .animation(.smooth(duration: 0.4), value: current)

            dots(current)

            ScrollView(.horizontal) {
                LazyHStack(spacing: 14) {
                    ForEach(BlokkDemoModel.muscles, id: \.self) { m in
                        MuscleCard(model: model, muscle: m)
                            .containerRelativeFrame(.horizontal)
                            .scrollTransition(.interactive, axis: .horizontal) { view, phase in
                                view.scaleEffect(phase.isIdentity ? 1 : 0.92).opacity(phase.isIdentity ? 1 : 0.55)
                            }
                            .id(m)
                    }
                }
                .scrollTargetLayout()
            }
            .contentMargins(.horizontal, 26, for: .scrollContent)
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $selected)
            .scrollIndicators(.hidden)
            .sensoryFeedback(.selection, trigger: selected)
        }
    }

    /// The eight muscles as a strip: which one is on the card, and which ones are outside their band.
    private func dots(_ current: String) -> some View {
        HStack(spacing: 6) {
            ForEach(BlokkDemoModel.muscles, id: \.self) { m in
                let out = model.fit(m) != .inside
                Button { withAnimation(.smooth) { selected = m } } label: {
                    Capsule()
                        .fill(m == current ? Color.white : (out ? demoWarn.opacity(0.85) : .white.opacity(0.22)))
                        .frame(width: m == current ? 26 : 9, height: 9)
                        .frame(height: 30)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 2)
        .animation(.snappy, value: current)
    }
}

private struct MuscleCard: View {
    let model: BlokkDemoModel
    let muscle: String
    @State private var why = false

    var body: some View {
        let sets = model.weekly(muscle)
        let fit = model.fit(muscle)
        let tier = model.tiers[muscle] ?? .grow
        VStack(spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(demoMuscleName(muscle)).nkFont(26, design: .serif).foregroundStyle(.white)
                Spacer()
                Text(verdict(fit)).nkFont(13, .medium).foregroundStyle(fit == .inside ? demoGood : demoWarn)
            }
            TierSwitch(tier: tier) { model.tiers[muscle] = $0 }

            if let band = model.band(muscle) {
                ArcGauge(value: sets, band: band, inside: fit == .inside)
                    .frame(height: 132)
                    .overlay(alignment: .bottom) {
                        VStack(spacing: 0) {
                            Text("\(sets)").nkFont(46, .medium).foregroundStyle(.white).contentTransition(.numericText())
                            Text("sorozat hetente").nkFont(11).foregroundStyle(.white.opacity(0.5))
                        }
                    }
                Text("a sáv \(band.low)–\(band.high)\(band.sport ? " · röplabda miatt lejjebb" : "") · \(model.spread(muscle))")
                    .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    .multilineTextAlignment(.center)
            }

            if fit != .inside {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .top, spacing: 10) {
                        DemoIcon(why ? .target : .spark, color: demoWarn, size: 18).padding(.top, 1)
                        Text(why ? whyText(tier) : "Javaslat: \(model.proposalText(muscle))")
                            .nkFont(13).foregroundStyle(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    HStack(spacing: 16) {
                        Button { withAnimation(.snappy) { model.apply(muscle) } } label: {
                            Text("Elfogadom").nkFont(14, .semibold).foregroundStyle(NK.ground)
                                .padding(.horizontal, 18).padding(.vertical, 9).background(Capsule().fill(.white))
                        }
                        .buttonStyle(.plain)
                        Button { withAnimation(.snappy) { why.toggle() } } label: {
                            Text(why ? "a javaslat" : "miért?").nkFont(14, .medium).foregroundStyle(demoHue.glow)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(demoWarn.opacity(0.1)))
            } else {
                Text("Rendben van. A Napok nézetben állíthatod a sorozatokat, a mérő azonnal követi.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.55))
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .frame(maxHeight: .infinity, alignment: .top)
        .nkGlass(30)
        .padding(.vertical, 8)
        .sensoryFeedback(.impact(weight: .light), trigger: sets)
        .sensoryFeedback(.selection, trigger: tier)
    }

    private func verdict(_ fit: DemoFit) -> String {
        switch fit {
        case .inside: "a sávban"
        case .below(let n): "\(n) hiányzik"
        case .above(let n): "\(n) túl sok"
        }
    }

    private func whyText(_ tier: MuscleTier) -> String {
        switch tier {
        case .emphasize: "Hangsúlynál a sáv teteje a határ: innen építjük a legtöbbet. A javaslat egy gyakorlatra legfeljebb öt, egy edzésen egy izomra legfeljebb nyolc sorozatot tesz."
        case .grow: "Építésnél ennyi kell ahhoz, hogy nőjön, de ne fáradj el tőle. A javaslat a legkevesebb sorozatú gyakorlatot tölti fel először."
        case .maintain: "Tartásnál a harmada is megtartja, amid van, ha a súly megmarad. Ennél kevesebbnél már veszíthetsz belőle."
        }
    }
}

/// Hangsúly · Építés · Tartás as one switch, the chosen one lit in its own colour.
private struct TierSwitch: View {
    let tier: MuscleTier
    let set: (MuscleTier) -> Void
    private let all: [MuscleTier] = [.maintain, .grow, .emphasize]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(all, id: \.self) { item in
                Button { withAnimation(.snappy) { set(item) } } label: {
                    Text(item.hungarian).nkFont(13, .semibold)
                        .foregroundStyle(item == tier ? NK.ground : .white.opacity(0.7))
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background { if item == tier { Capsule().fill(color(item)) } }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Capsule().fill(.white.opacity(0.08)))
    }

    private func color(_ tier: MuscleTier) -> Color {
        switch tier {
        case .emphasize: demoHue.glow
        case .grow: demoGood
        case .maintain: .white
        }
    }
}

// MARK: Napok — one day a page

private struct DaysView: View {
    let model: BlokkDemoModel
    @Binding var day: Int

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                ForEach(Array(model.days.enumerated()), id: \.element.id) { index, item in
                    let on = index == day
                    Button { withAnimation(.snappy) { day = index } } label: {
                        VStack(spacing: 5) {
                            Text(String(item.name.prefix(index == 2 ? 3 : (index == 3 ? 2 : 1))).uppercased())
                                .nkFont(11, .semibold, design: .monospaced).foregroundStyle(on ? NK.ground : .white.opacity(0.75))
                            Text("\(model.minutes(index))'").nkFont(15, .medium).foregroundStyle(on ? NK.ground : .white)
                                .contentTransition(.numericText())
                            Capsule().fill(on ? NK.ground.opacity(0.5) : demoHue.glow.opacity(0.8))
                                .frame(width: CGFloat(8 + model.minutes(index) / 2), height: 3)
                        }
                        .frame(maxWidth: .infinity, minHeight: 62)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(on ? Color.white : .white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)

            TabView(selection: $day) {
                ForEach(Array(model.days.enumerated()), id: \.element.id) { index, item in
                    DayCard(model: model, index: index, day: item).tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .sensoryFeedback(.selection, trigger: day)
        }
    }
}

private struct DayCard: View {
    let model: BlokkDemoModel
    let index: Int
    let day: DemoDay

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(day.name.uppercased()).nkFont(11, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(demoHue.glow)
                    Text(day.title).nkFont(28, design: .serif).foregroundStyle(.white)
                    NKFlowRow(spacing: 6, rowSpacing: 6) {
                        DemoPill("kb. \(model.minutes(index)) perc", icon: .timer)
                        if let note = day.note { DemoPill(note, icon: .spark) }
                        if model.techniqueCount(index) > 0 { DemoPill("\(model.techniqueCount(index)) technika", color: demoHue.glow, icon: .drop) }
                    }
                    .padding(.top, 2)
                }
                NKFlowRow(spacing: 8, rowSpacing: 8) {
                    ForEach(BlokkDemoModel.muscles.filter { model.daySets(index, muscle: $0) > 0 }, id: \.self) { m in
                        let sets = model.daySets(index, muscle: m)
                        let over = sets > BlokkDemoModel.sessionCap
                        HStack(spacing: 6) {
                            Text(demoMuscleName(m)).nkFont(12, .medium).foregroundStyle(.white.opacity(0.85))
                            Text("\(sets)").nkFont(13, .semibold).foregroundStyle(over ? demoWarn : demoHue.glow)
                                .contentTransition(.numericText())
                        }
                        .padding(.horizontal, 11).padding(.vertical, 6)
                        .background(Capsule().fill(over ? demoWarn.opacity(0.16) : .white.opacity(0.08)))
                    }
                }
                ForEach(model.overCap(index), id: \.0) { muscle, sets in
                    Text("\(demoMuscleName(muscle)): \(sets) sorozat egy edzésen. Nyolc fölött már nem ad többet, oszd el két napra.")
                        .nkFont(13).foregroundStyle(demoWarn).fixedSize(horizontal: false, vertical: true)
                }
                VStack(spacing: 0) {
                    ForEach(Array(day.exercises.enumerated()), id: \.element.id) { e, exercise in
                        if e > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        HStack(spacing: 10) {
                            Group {
                                if exercise.counts, NKBodyMark.canDraw(exercise.muscle) {
                                    NKBodyMark(muscle: exercise.muscle, hue: demoHue, height: 38)
                                } else {
                                    DemoIcon(exercise.counts ? .target : .spark, color: .white.opacity(0.45), size: 20)
                                }
                            }
                            .frame(width: 28, height: 40)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(exercise.name).nkFont(16, .medium).foregroundStyle(.white.opacity(0.95))
                                    .lineLimit(1).minimumScaleFactor(0.8)
                                Text(exercise.counts ? (model.judged(exercise) ? "\(demoMuscleName(exercise.muscle)) · \(model.range(exercise)) ism." : demoMuscleName(exercise.muscle)) : "ugrás · nem számít a sorozatokba")
                                    .nkFont(12).foregroundStyle(.white.opacity(0.5))
                                if model.judged(exercise) {
                                    HStack(spacing: 6) {
                                        TechniqueChip(exercise: exercise) { model.cycleTechnique(day: index, exercise: e) }
                                        if exercise.lengthened {
                                            Button { withAnimation(.snappy) { model.toggleChallenge(day: index, exercise: e) } } label: {
                                                DemoPill(exercise.challenge ? "KIHÍVÁS" : "kihívás", mono: exercise.challenge,
                                                         color: exercise.challenge ? demoWarn : .white.opacity(0.4), icon: .flag)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                    .padding(.top, 2)
                                }
                            }
                            Spacer(minLength: 8)
                            SetStepper(value: exercise.sets,
                                       down: { model.step(day: index, exercise: e, by: -1) },
                                       up: { model.step(day: index, exercise: e, by: 1) })
                        }
                        .padding(.vertical, 12)
                    }
                }
            }
            .padding(22)
            .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(NK.ground.opacity(0.62)))
            .nkGlass(30)
            .padding(.horizontal, 20).padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
    }
}

// MARK: Blokk — the six weeks

private struct BlockView: View {
    let model: BlokkDemoModel

    var body: some View {
        let totals = model.weekTotals()
        let peak = Double(totals.max() ?? 1)
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Az első hét a te terved. Innen a Hangsúly izmok hetente egy sorozattal nőnek a sávjuk tetejéig, a Tartás marad, a hatodik hét a fele.")
                        .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                }
                VStack(alignment: .leading, spacing: 10) {
                    Text("EDZÉSMÓD · AZ EGÉSZ BLOKKRA").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(demoHue.glow)
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                        ForEach(DemoStyle.allCases, id: \.self) { item in
                            let on = model.style == item
                            Button { withAnimation(.snappy) { model.style = item } } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        DemoIcon(icon(item), color: on ? NK.ground : demoHue.glow, size: 20)
                                        Spacer()
                                        if on { DemoIcon(.check, color: NK.ground, size: 16) }
                                    }
                                    Text(item.name).nkFont(15, .semibold).foregroundStyle(on ? NK.ground : .white)
                                        .lineLimit(1).minimumScaleFactor(0.8)
                                    Text(item.line).nkFont(11).foregroundStyle(on ? NK.ground.opacity(0.75) : .white.opacity(0.55))
                                        .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading)
                                .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(on ? AnyShapeStyle(demoHue.glow) : AnyShapeStyle(.white.opacity(0.07))))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Text("Egy gyakorlatnál a Napok nézetben felülírhatod.").nkFont(11).foregroundStyle(.white.opacity(0.45))
                }
                .sensoryFeedback(.selection, trigger: model.style)

                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(0..<6, id: \.self) { w in
                        VStack(spacing: 6) {
                            Text("\(totals[w])").nkFont(15, .semibold).foregroundStyle(.white).contentTransition(.numericText())
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(w == 5 ? AnyShapeStyle(.white.opacity(0.06)) : AnyShapeStyle(LinearGradient(colors: [demoHue.glow, demoHue.glow.opacity(0.45)], startPoint: .top, endPoint: .bottom)))
                                .overlay { if w == 5 { RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(demoHue.glow.opacity(0.7), style: StrokeStyle(lineWidth: 1.2, dash: [4, 4])) } }
                                .frame(height: CGFloat(120 * Double(totals[w]) / peak))
                            Text("\(w + 1). hét").nkFont(11, .medium).foregroundStyle(.white.opacity(0.8))
                            Text(BlokkDemoModel.phases[w]).nkFont(9, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                            DemoIcon(w >= 2 && w <= 4 ? .drop : .keep, color: w >= 2 && w <= 4 ? demoHue.glow : .white.opacity(0.25), size: 14)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(18)
                .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(NK.ground.opacity(0.62)))
                .nkGlass(26)

                HStack(spacing: 8) {
                    DemoPill("1–2. hét: sima sorozatok", icon: .keep)
                    DemoPill("3–5. hét: technikák", color: demoHue.glow, icon: .drop)
                }
                DemoPill("a kihívás minden héten megvan, a pihenőhéten nincs", color: demoWarn, icon: .flag)

                VStack(spacing: 0) {
                    ForEach(Array(BlokkDemoModel.muscles.enumerated()), id: \.element) { i, m in
                        if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        let path = model.path(m)
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(demoMuscleName(m)).nkFont(15, .medium).foregroundStyle(.white.opacity(0.95))
                                TierPill(tier: model.tiers[m] ?? .grow)
                            }
                            .frame(width: 104, alignment: .leading)
                            HStack(alignment: .bottom, spacing: 4) {
                                ForEach(0..<6, id: \.self) { w in
                                    VStack(spacing: 3) {
                                        Text("\(path[w])").nkFont(11, .medium, design: .monospaced)
                                            .foregroundStyle(w > 0 && w < 5 && path[w] > path[w - 1] ? demoHue.glow : .white.opacity(0.6))
                                        RoundedRectangle(cornerRadius: 3).fill(w == 5 ? .white.opacity(0.22) : demoHue.glow.opacity(0.75))
                                            .frame(height: CGFloat(4 + 26 * Double(path[w]) / Double(max(1, path.max() ?? 1))))
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                            }
                            .frame(height: 50, alignment: .bottom)
                        }
                        .padding(.vertical, 10)
                    }
                }
                .padding(.horizontal, 18).padding(.vertical, 6).nkGlass(26)
            }
            .padding(.horizontal, 20).padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
    }
}

private extension BlockView {
    func icon(_ style: DemoStyle) -> DemoIcon.Kind {
        switch style {
        case .balanced: .target
        case .volume: .reps
        case .heavy: .weight
        case .allout: .flame
        }
    }
}

/// The technique of one exercise as a pill he taps to change — or the reason there is none to pick.
struct TechniqueChip: View {
    let exercise: DemoExercise
    let cycle: () -> Void

    var body: some View {
        if !exercise.stable {
            DemoPill("szabadsúly · nincs technika", color: .white.opacity(0.4), icon: .shield)
        } else {
            Button { withAnimation(.snappy) { cycle() } } label: {
                DemoPill(exercise.technique == .none ? "+ technika" : exercise.technique.name,
                         color: exercise.technique == .none ? .white.opacity(0.55) : demoHue.glow,
                         icon: Self.icon(exercise.technique))
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.selection, trigger: exercise.technique)
        }
    }

    static func icon(_ technique: DemoTechnique) -> DemoIcon.Kind {
        switch technique {
        case .none: .keep
        case .restDrop: .timer
        case .drop: .drop
        case .myo: .myo
        case .partials: .partials
        }
    }
}

// MARK: - The weekly review: a deck, one muscle a card

private struct WeekReviewDeck: View {
    let model: BlokkDemoModel
    let onBack: () -> Void
    @State private var index: Int = UserDefaults.standard.integer(forKey: "previewBlokkCard")

    private var count: Int { model.reviewMuscles.count + 2 }

    var body: some View {
        ZStack {
            DemoSky(height: 340)
            VStack(spacing: 0) {
                top
                TabView(selection: $index) {
                    ForEach(Array(model.reviewMuscles.enumerated()), id: \.element) { i, m in
                        ReviewCard(model: model, muscle: m, position: "\(i + 1) / \(model.reviewMuscles.count)") {
                            withAnimation(.smooth) { index = i + 1 }
                        }
                        .tag(i)
                    }
                    QuietCard(model: model) { withAnimation(.smooth) { index = count - 1 } }.tag(count - 2)
                    SummaryCard(model: model) {
                        model.weekAccepted = true
                        onBack()
                    }
                    .tag(count - 1)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
        }
        .sensoryFeedback(.selection, trigger: index)
    }

    private var top: some View {
        VStack(spacing: 12) {
            HStack(spacing: 5) {
                ForEach(0..<count, id: \.self) { i in
                    Capsule().fill(i <= index ? Color.white : .white.opacity(0.25)).frame(height: 3)
                }
            }
            .animation(.smooth, value: index)
            HStack {
                Button(action: onBack) {
                    Image(systemName: "chevron.down").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.14)))
                }
                .buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 1) {
                    Text("3. HÉT · NOV. 30 – DEC. 6.").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.7))
                    Text("Ez változna a héten").nkFont(20, design: .serif).foregroundStyle(.white)
                }
                Spacer()
                if index < count - 1 {
                    Button {
                        for m in model.reviewMuscles { model.decideAll(m, accept: true, onlyOpen: true) }
                        withAnimation(.smooth) { index = count - 1 }
                    } label: {
                        Text("Mind elfogadom").nkFont(13, .semibold).foregroundStyle(.white)
                            .padding(.horizontal, 13).padding(.vertical, 8).background(Capsule().fill(.black.opacity(0.28)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 20).padding(.top, 8)
    }
}

private struct ReviewCard: View {
    let model: BlokkDemoModel
    let muscle: String
    let position: String
    let next: () -> Void

    var body: some View {
        let tier = model.tiers[muscle] ?? .grow
        let lines = model.lines(muscle)
        let open = lines.filter { $0.decided == nil }.count
        VStack(spacing: 12) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(position) · \(tier.hungarian.uppercased())").nkFont(11, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(demoHue.glow)
                    Text(demoMuscleName(muscle)).nkFont(34, design: .serif).foregroundStyle(.white)
                }
                Spacer()
                NKBodyMap([NKBodyHeat(muscle: muscle, level: 1)], hue: demoHue, views: .auto)
                    .frame(width: 66, height: 100)
            }

            // No weekly total on this card (owner, round 5): next to an exercise's own „2 → 3" the muscle's
            // „11 → 12" read as the same number and misled. The tiles say what moves.
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(lines) { change in
                        ChangeRow(change: change, day: model.days[change.day].name) { model.decide(change.id, accept: $0) }
                    }
                }
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)

            if open == 0 {
                HStack(spacing: 10) {
                    let yes = lines.filter { $0.decided == true }.count
                    Text("\(yes) elfogadva · \(lines.count - yes) marad").nkFont(14, .medium).foregroundStyle(.white.opacity(0.75))
                    Spacer()
                    Button(action: next) {
                        Text("Tovább").nkFont(16, .semibold).foregroundStyle(NK.ground)
                            .padding(.horizontal, 30).frame(minHeight: 54).background(Capsule().fill(demoHue.glow))
                    }
                    .buttonStyle(.plain)
                }
                .transition(.opacity)
            } else {
                HStack(spacing: 10) {
                    Button { withAnimation(.snappy) { model.decideAll(muscle, accept: false, onlyOpen: true) } } label: {
                        Text(open == lines.count ? "Marad mind" : "A többi marad").nkFont(15, .semibold).foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 54).background(Capsule().fill(.white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                    Button { withAnimation(.snappy) { model.decideAll(muscle, accept: true, onlyOpen: true) } } label: {
                        Text(open == lines.count ? (lines.count == 1 ? "Elfogadom" : "Elfogadom mind") : "A többit is").nkFont(16, .semibold).foregroundStyle(NK.ground)
                            .frame(maxWidth: .infinity, minHeight: 54).background(Capsule().fill(.white))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(20)
        .frame(maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 34, style: .continuous).fill(NK.ground.opacity(0.62)))
        .nkGlass(34)
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 20)
        .sensoryFeedback(.success, trigger: open == 0)
    }
}

/// One proposed change as a tile of its own: what moves, the amount as the loudest thing, the reasons as
/// pills, and its own yes / no.
private struct ChangeRow: View {
    let change: DemoChange
    let day: String
    let decide: (Bool?) -> Void

    var body: some View {
        let off = change.decided == false
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                DemoIcon(icon, color: off ? .white.opacity(0.4) : demoHue.glow, size: 22)
                    .frame(width: 38, height: 38)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(demoHue.glow.opacity(off ? 0.05 : 0.14)))
                VStack(alignment: .leading, spacing: 6) {
                    Text(change.exercise).nkFont(16, .semibold).foregroundStyle(.white.opacity(off ? 0.5 : 0.97))
                        .lineLimit(1).minimumScaleFactor(0.75)
                    HStack(spacing: 6) {
                        DemoPill(day.uppercased(), mono: true, icon: .calendar)
                        DemoPill(kind.uppercased(), mono: true, color: demoHue.glow)
                    }
                }
                Spacer(minLength: 4)
                HStack(spacing: 8) {
                    choice(.keep, on: change.decided == false, tint: .white) { decide(change.decided == false ? nil : false) }
                    choice(.check, on: change.decided == true, tint: demoGood) { decide(change.decided == true ? nil : true) }
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(from).nkFont(19, .medium).foregroundStyle(.white.opacity(0.45))
                Image(systemName: "arrow.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
                Text(to).nkFont(26, .semibold).foregroundStyle(off ? .white.opacity(0.4) : demoHue.glow)
                    .strikethrough(off, color: .white.opacity(0.5))
                if off { Text("marad \(from)").nkFont(13, .medium).foregroundStyle(.white.opacity(0.7)) }
            }
            NKFlowRow(spacing: 6, rowSpacing: 6) {
                ForEach(change.tags, id: \.self) { DemoPill($0, icon: DemoIcon.Kind.forReason($0)) }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(change.decided == true ? 0.1 : 0.055)))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
            .stroke(change.decided == true ? demoGood.opacity(0.55) : .white.opacity(0.08), lineWidth: 1))
        .animation(.snappy, value: change.decided)
        .sensoryFeedback(.impact(weight: .light), trigger: change.decided)
    }

    private var icon: DemoIcon.Kind {
        switch change.kind {
        case .sets: .sets
        case .weight: .weight
        case .reps: .reps
        }
    }

    private var kind: String {
        switch change.kind {
        case .sets: "sorozat"
        case .weight: "súly"
        case .reps: "ismétlés"
        }
    }

    private var from: String {
        switch change.kind {
        case .sets(let from, _): "\(from)"
        case .weight(let from, _): demoKg(from)
        case .reps(let from, _): "\(from)"
        }
    }

    private var to: String {
        switch change.kind {
        case .sets(_, let to): "\(to) sorozat"
        case .weight(_, let to): demoKg(to)
        case .reps(_, let to): "\(to) ismétlés"
        }
    }

    private func choice(_ mark: DemoIcon.Kind, on: Bool, tint: Color, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            DemoIcon(mark, color: on ? NK.ground : .white.opacity(0.8), size: 20)
                .frame(width: 40, height: 40)
                .background(Circle().fill(on ? tint : .white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }
}

struct DemoPill: View {
    let text: String
    var mono = false
    var color: Color = .white.opacity(0.78)
    var icon: DemoIcon.Kind? = nil
    init(_ text: String, mono: Bool = false, color: Color = .white.opacity(0.78), icon: DemoIcon.Kind? = nil) {
        self.text = text; self.mono = mono; self.color = color; self.icon = icon
    }

    var body: some View {
        HStack(spacing: 5) {
            if let icon { DemoIcon(icon, color: color, size: mono ? 11 : 13) }
            Text(text)
                .nkFont(mono ? 9 : 12, mono ? .semibold : .medium, design: mono ? .monospaced : .default)
                .tracking(mono ? 1 : 0)
                .foregroundStyle(color)
                .lineLimit(1).fixedSize()
        }
        .padding(.horizontal, mono ? 8 : 10).padding(.vertical, mono ? 4 : 5)
        .background(Capsule().fill(.white.opacity(0.09)))
    }
}

private struct QuietCard: View {
    let model: BlokkDemoModel
    let next: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("NEM VÁLTOZIK").nkFont(11, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(demoHue.glow)
            Text("\(model.quietMuscles.count) izom marad, ahol volt").nkFont(30, design: .serif).foregroundStyle(.white)
            Text("Ezek Tartás szinten vannak, vagy most nincs okunk lépni velük. Ugyanazt csinálod, mint múlt héten.")
                .nkFont(14).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            VStack(spacing: 0) {
                ForEach(Array(model.quietMuscles.enumerated()), id: \.element) { i, m in
                    if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    HStack {
                        Text(demoMuscleName(m)).nkFont(16, .medium).foregroundStyle(.white.opacity(0.95))
                        TierPill(tier: model.tiers[m] ?? .grow)
                        Spacer()
                        Text("\(model.weekly(m)) sorozat").nkFont(15).foregroundStyle(.white.opacity(0.6))
                    }
                    .padding(.vertical, 12)
                }
            }
            Spacer(minLength: 0)
            Button(action: next) {
                Text("Tovább az összegzéshez").nkFont(16, .semibold).foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity, minHeight: 54).background(Capsule().fill(.white))
            }
            .buttonStyle(.plain)
        }
        .padding(22)
        .frame(maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 34, style: .continuous).fill(NK.ground.opacity(0.62)))
        .nkGlass(34)
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 20)
    }
}

private struct SummaryCard: View {
    let model: BlokkDemoModel
    let start: () -> Void
    @State private var drawn = false

    private func count(_ pick: (DemoChange.Kind) -> Bool) -> Int {
        model.changes.filter { $0.decided == true && pick($0.kind) }.count
    }

    var body: some View {
        let yes = model.changes.filter { $0.decided == true }.count
        let no = model.changes.filter { $0.decided == false }.count
        let open = model.changes.count - yes - no
        let added = model.changes.filter { $0.decided == true }.reduce(0) { sum, c in
            if case .sets(let from, let to) = c.kind { return sum + (to - from) }
            return sum
        }
        VStack(spacing: 14) {
            ScrollView {
                VStack(spacing: 16) {
                    HStack(alignment: .center, spacing: 18) {
                        ZStack {
                            Circle().stroke(.white.opacity(0.1), lineWidth: 9)
                            Circle().trim(from: 0, to: drawn ? CGFloat(yes + no) / CGFloat(max(1, model.changes.count)) : 0)
                                .stroke(AngularGradient(colors: [demoHue.glow, demoWarn, demoHue.glow], center: .center), style: StrokeStyle(lineWidth: 9, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                            VStack(spacing: 0) {
                                Text("\(model.total() + added)").nkFont(40, .medium).foregroundStyle(.white).contentTransition(.numericText())
                                Text("sorozat").nkFont(11).foregroundStyle(.white.opacity(0.55))
                            }
                        }
                        .frame(width: 124, height: 124)
                        .onAppear { withAnimation(.smooth(duration: 0.9).delay(0.15)) { drawn = true } }
                        VStack(alignment: .leading, spacing: 6) {
                            Text(open == 0 ? "Kész a heted" : "Még \(open) döntés vár").nkFont(26, design: .serif).foregroundStyle(.white)
                                .fixedSize(horizontal: false, vertical: true)
                            Text("múlt héten \(model.total()) sorozat volt").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                            HStack(spacing: 6) {
                                DemoPill("\(yes) elfogadva", color: demoGood, icon: .check)
                                DemoPill("\(no) marad", icon: .keep)
                            }
                        }
                    }

                    HStack(spacing: 10) {
                        tile(.sets, added > 0 ? "+\(added)" : "0", "sorozat")
                        tile(.weight, "\(count { if case .weight = $0 { true } else { false } })", "súlyemelés")
                        tile(.reps, "\(count { if case .reps = $0 { true } else { false } })", "ismétlés")
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        label("Izmonként")
                        VStack(spacing: 0) {
                            ForEach(Array(model.reviewMuscles.enumerated()), id: \.element) { i, m in
                                if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                                muscleRow(m)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        label("Hol érzed a héten")
                        HStack(spacing: 8) {
                            ForEach(Array(model.days.enumerated()), id: \.element.id) { index, day in
                                let n = model.changes.filter { $0.day == index && $0.decided == true }.count
                                VStack(spacing: 6) {
                                    Text(String(day.name.prefix(index == 2 ? 3 : (index == 3 ? 2 : 1))).uppercased())
                                        .nkFont(10, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                                    ZStack {
                                        Circle().fill(n > 0 ? demoHue.glow.opacity(0.9) : .white.opacity(0.08)).frame(width: 34, height: 34)
                                        if n > 0 {
                                            Text("\(n)").nkFont(15, .semibold).foregroundStyle(NK.ground)
                                        } else {
                                            DemoIcon(.keep, color: .white.opacity(0.35), size: 14)
                                        }
                                    }
                                }
                                .frame(maxWidth: .infinity)
                            }
                        }
                    }
                }
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)

            Button(action: start) {
                HStack(spacing: 8) {
                    DemoIcon(.spark, color: NK.ground, size: 18)
                    Text(open == 0 ? "Indulhat a hét" : "Így is indulhat, a többi marad").nkFont(16, .semibold).foregroundStyle(NK.ground)
                }
                .frame(maxWidth: .infinity, minHeight: 56).background(Capsule().fill(demoHue.glow))
            }
            .buttonStyle(.plain)
        }
        .padding(22)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 34, style: .continuous).fill(NK.ground.opacity(0.62)))
        .nkGlass(34)
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 20)
    }

    private func label(_ text: String) -> some View {
        Text(text.uppercased()).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(demoHue.glow)
    }

    private func tile(_ icon: DemoIcon.Kind, _ value: String, _ name: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            DemoIcon(icon, color: demoHue.glow, size: 22)
            Text(value).nkFont(26, .semibold).foregroundStyle(.white).contentTransition(.numericText())
            Text(name).nkFont(12).foregroundStyle(.white.opacity(0.55))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.07)))
    }

    private func muscleRow(_ muscle: String) -> some View {
        let lines = model.lines(muscle)
        let yes = lines.filter { $0.decided == true }
        let kept = lines.filter { $0.decided == false }.count
        let open = lines.count - yes.count - kept
        return HStack(spacing: 10) {
            if NKBodyMark.canDraw(muscle) { NKBodyMark(muscle: muscle, hue: demoHue, height: 40).frame(width: 26) }
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 7) {
                    Text(demoMuscleName(muscle)).nkFont(15, .medium).foregroundStyle(.white.opacity(0.95))
                    TierPill(tier: model.tiers[muscle] ?? .grow)
                }
                HStack(spacing: 6) {
                    ForEach(yes) { c in
                        DemoPill(short(c), color: demoHue.glow, icon: iconOf(c))
                    }
                    if yes.isEmpty { DemoPill(open > 0 ? "még nem döntöttél" : "marad a múlt heti", icon: .keep) }
                }
            }
            Spacer(minLength: 4)
            if kept > 0 && !yes.isEmpty { DemoPill("\(kept) marad", icon: .keep) }
        }
        .padding(.vertical, 10)
    }

    private func iconOf(_ c: DemoChange) -> DemoIcon.Kind {
        switch c.kind {
        case .sets: .sets
        case .weight: .weight
        case .reps: .reps
        }
    }

    private func short(_ c: DemoChange) -> String {
        switch c.kind {
        case .sets(let from, let to): "\(to > from ? "+" : "−")\(abs(to - from))"
        case .weight(_, let to): demoKg(to)
        case .reps(let from, let to): "\(to > from ? "+" : "−")\(abs(to - from)) ism."
        }
    }
}

// MARK: - Small pieces

struct TierPill: View {
    let tier: MuscleTier

    var body: some View {
        Text(tier.hungarian.uppercased())
            .nkFont(9, .semibold, design: .monospaced).tracking(1)
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(Capsule().fill(color.opacity(0.16)))
    }

    private var color: Color {
        switch tier {
        case .emphasize: demoHue.glow
        case .grow: demoGood
        case .maintain: .white.opacity(0.6)
        }
    }
}

/// A half dial: the whole scale as the track, the tier's band lit on it, his number as the bead.
private struct ArcGauge: View {
    let value: Int
    let band: DemoBand
    let inside: Bool
    var ghost: Int? = nil

    var body: some View {
        let top = Double(max(band.limit, value) + 2)
        GeometryReader { geo in
            let radius = min(geo.size.width / 2 - 14, geo.size.height - 14)
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height - 4)
            ZStack {
                DemoArc(from: 0, to: 1, radius: radius, center: center)
                    .stroke(.white.opacity(0.09), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                DemoArc(from: Double(band.low) / top, to: Double(band.high) / top, radius: radius, center: center)
                    .stroke(LinearGradient(colors: [demoHue.glow.opacity(0.55), demoHue.glow], startPoint: .leading, endPoint: .trailing),
                            style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .shadow(color: demoHue.glow.opacity(0.45), radius: 8)
                Text("\(band.low)").nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                    .position(point(Double(band.low) / top, radius + 20, center))
                Text("\(band.high)").nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                    .position(point(Double(band.high) / top, radius + 20, center))
                if let ghost {
                    Circle().stroke(.white.opacity(0.6), lineWidth: 2).frame(width: 14, height: 14)
                        .position(point(Double(ghost) / top, radius, center))
                }
                Circle().fill(inside ? Color.white : demoWarn)
                    .frame(width: 20, height: 20)
                    .overlay(Circle().stroke(NK.ground.opacity(0.6), lineWidth: 3))
                    .shadow(color: (inside ? Color.white : demoWarn).opacity(0.6), radius: 7)
                    .position(point(Double(value) / top, radius, center))
            }
        }
        .animation(.snappy(duration: 0.45), value: value)
        .animation(.snappy(duration: 0.45), value: band)
    }

    private func point(_ fraction: Double, _ radius: CGFloat, _ center: CGPoint) -> CGPoint {
        let angle = Double.pi + Double.pi * max(0, min(1, fraction))
        return CGPoint(x: center.x + radius * CGFloat(cos(angle)), y: center.y + radius * CGFloat(sin(angle)))
    }
}

private struct DemoArc: Shape {
    var from: Double
    var to: Double
    let radius: CGFloat
    let center: CGPoint

    var animatableData: AnimatablePair<Double, Double> {
        get { AnimatablePair(from, to) }
        set { from = newValue.first; to = newValue.second }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addArc(center: center, radius: radius, startAngle: .degrees(180 + 180 * from), endAngle: .degrees(180 + 180 * to), clockwise: false)
        return path
    }
}

private struct DemoCheck: View {
    let on: Bool
    var body: some View {
        ZStack {
            Circle().fill(on ? demoGood : .white.opacity(0.18)).frame(width: 30, height: 30)
            Text(on ? "✓" : "–").nkFont(16, .bold).foregroundStyle(on ? NK.ground : .white)
        }
    }
}

struct SetStepper: View {
    let value: Int
    let down: () -> Void
    let up: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            round("−", down)
            Text("\(value)").nkFont(21, .medium).foregroundStyle(.white)
                .frame(minWidth: 24).contentTransition(.numericText())
            round("+", up)
        }
        .sensoryFeedback(.impact(weight: .light), trigger: value)
    }

    private func round(_ symbol: String, _ action: @escaping () -> Void) -> some View {
        Button { withAnimation(.snappy) { action() } } label: {
            Text(symbol).nkFont(19, .medium).foregroundStyle(.white.opacity(0.9))
                .frame(width: 38, height: 38)
                .background(Circle().fill(.white.opacity(0.11)))
        }
        .buttonStyle(.plain)
    }
}
/// The feature's own marks, drawn on the kit's 64-unit grid with the same round 5-unit stroke as the outlined
/// `NKGlyph`s — so nothing here is an emoji or a system symbol.
struct DemoIcon: View {
    enum Kind {
        case sets, weight, reps, calendar, check, keep, spark, target, feather, shield, flame, drop, myo, partials, flag, timer

        /// The mark a reason pill wears, read off its own words.
        static func forReason(_ text: String) -> Kind {
            let t = text.lowercased()
            if t.contains("fogyás") { return .shield }
            if t.contains("könnyen") { return .feather }
            if t.contains("tartalék") || t.contains("sáv") || t.contains("tartomány") { return .target }
            if t.contains("tárcsa") || t.contains("súly") { return .weight }
            if t.contains("utolsó") || t.contains("izomláz") { return .flame }
            if t.contains("tartás") { return .keep }
            return .check
        }
    }

    let kind: Kind
    let color: Color
    let size: CGFloat
    init(_ kind: Kind, color: Color, size: CGFloat = 18) { self.kind = kind; self.color = color; self.size = size }

    var body: some View {
        Canvas { ctx, s in
            let k = s.width / 64
            func P(_ f: (inout Path) -> Void) -> Path { var p = Path(); f(&p); return p.applying(CGAffineTransform(scaleX: k, y: k)) }
            let st = StrokeStyle(lineWidth: 5 * k, lineCap: .round, lineJoin: .round)
            let ink = GraphicsContext.Shading.color(color)
            switch kind {
            case .drop:
                // steps going down: the weight comes off
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 8, y: 16)); $0.addLine(to: CGPoint(x: 24, y: 16)); $0.addLine(to: CGPoint(x: 24, y: 32))
                    $0.addLine(to: CGPoint(x: 40, y: 32)); $0.addLine(to: CGPoint(x: 40, y: 48)); $0.addLine(to: CGPoint(x: 56, y: 48))
                }, with: ink, style: st)
            case .myo:
                // one big effort, then small ones
                ctx.fill(P { $0.addEllipse(in: CGRect(x: 6, y: 20, width: 24, height: 24)) }, with: ink)
                for x in [36.0, 46.0, 56.0] {
                    ctx.fill(P { $0.addEllipse(in: CGRect(x: x - 3.5, y: 28.5, width: 7, height: 7)) }, with: ink)
                }
            case .partials:
                // half of the way: a full arc, and the lower half of it drawn heavy
                ctx.stroke(P { $0.addArc(center: CGPoint(x: 32, y: 34), radius: 20, startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false) },
                           with: .color(color.opacity(0.35)), style: st)
                ctx.stroke(P { $0.addArc(center: CGPoint(x: 32, y: 34), radius: 20, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false) }, with: ink, style: st)
                ctx.stroke(P { $0.move(to: CGPoint(x: 8, y: 50)); $0.addLine(to: CGPoint(x: 56, y: 50)) }, with: ink, style: st)
            case .flag:
                ctx.stroke(P { $0.move(to: CGPoint(x: 16, y: 8)); $0.addLine(to: CGPoint(x: 16, y: 56)) }, with: ink, style: st)
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 16, y: 12)); $0.addLine(to: CGPoint(x: 50, y: 20)); $0.addLine(to: CGPoint(x: 16, y: 34))
                }, with: ink, style: st)
            case .timer:
                ctx.stroke(P { $0.addEllipse(in: CGRect(x: 11, y: 15, width: 42, height: 42)) }, with: ink, style: st)
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 32, y: 36)); $0.addLine(to: CGPoint(x: 32, y: 24))
                    $0.move(to: CGPoint(x: 25, y: 7)); $0.addLine(to: CGPoint(x: 39, y: 7))
                }, with: ink, style: st)
            case .sets:
                // three stacked bars: a set, a set, a set
                for (i, y) in [16.0, 32.0, 48.0].enumerated() {
                    ctx.stroke(P { $0.move(to: CGPoint(x: 12, y: y)); $0.addLine(to: CGPoint(x: CGFloat(52 - i * 8), y: y)) }, with: ink, style: st)
                }
            case .weight:
                // a barbell seen from the side
                ctx.stroke(P { $0.move(to: CGPoint(x: 6, y: 32)); $0.addLine(to: CGPoint(x: 58, y: 32)) }, with: ink, style: st)
                ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 13, y: 14, width: 9, height: 36), cornerSize: CGSize(width: 4, height: 4)) }, with: ink, style: st)
                ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 42, y: 14, width: 9, height: 36), cornerSize: CGSize(width: 4, height: 4)) }, with: ink, style: st)
            case .reps:
                // a loop that comes back on itself
                ctx.stroke(P { $0.addArc(center: CGPoint(x: 32, y: 32), radius: 19, startAngle: .degrees(-40), endAngle: .degrees(210), clockwise: false) }, with: ink, style: st)
                ctx.stroke(P { $0.move(to: CGPoint(x: 39, y: 8)); $0.addLine(to: CGPoint(x: 47, y: 19)); $0.addLine(to: CGPoint(x: 34, y: 23)) }, with: ink, style: st)
            case .calendar:
                ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 10, y: 14, width: 44, height: 40), cornerSize: CGSize(width: 9, height: 9)) }, with: ink, style: st)
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 10, y: 27)); $0.addLine(to: CGPoint(x: 54, y: 27))
                    $0.move(to: CGPoint(x: 22, y: 8)); $0.addLine(to: CGPoint(x: 22, y: 18))
                    $0.move(to: CGPoint(x: 42, y: 8)); $0.addLine(to: CGPoint(x: 42, y: 18))
                }, with: ink, style: st)
            case .check:
                ctx.stroke(P { $0.move(to: CGPoint(x: 13, y: 34)); $0.addLine(to: CGPoint(x: 26, y: 47)); $0.addLine(to: CGPoint(x: 51, y: 18)) }, with: ink, style: st)
            case .keep:
                // two level lines: nothing moves
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 14, y: 24)); $0.addLine(to: CGPoint(x: 50, y: 24))
                    $0.move(to: CGPoint(x: 14, y: 40)); $0.addLine(to: CGPoint(x: 50, y: 40))
                }, with: ink, style: st)
            case .spark:
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 32, y: 8)); $0.addLine(to: CGPoint(x: 32, y: 56))
                    $0.move(to: CGPoint(x: 8, y: 32)); $0.addLine(to: CGPoint(x: 56, y: 32))
                    $0.move(to: CGPoint(x: 16, y: 16)); $0.addLine(to: CGPoint(x: 48, y: 48))
                    $0.move(to: CGPoint(x: 48, y: 16)); $0.addLine(to: CGPoint(x: 16, y: 48))
                }, with: ink, style: StrokeStyle(lineWidth: 4 * k, lineCap: .round))
            case .target:
                ctx.stroke(P { $0.addEllipse(in: CGRect(x: 9, y: 9, width: 46, height: 46)) }, with: ink, style: st)
                ctx.fill(P { $0.addEllipse(in: CGRect(x: 25, y: 25, width: 14, height: 14)) }, with: ink)
            case .feather:
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 12, y: 54)); $0.addLine(to: CGPoint(x: 42, y: 22))
                    $0.move(to: CGPoint(x: 22, y: 43))
                    $0.addQuadCurve(to: CGPoint(x: 52, y: 10), control: CGPoint(x: 20, y: 14))
                    $0.addQuadCurve(to: CGPoint(x: 22, y: 43), control: CGPoint(x: 52, y: 42))
                }, with: ink, style: st)
            case .shield:
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 32, y: 8)); $0.addLine(to: CGPoint(x: 52, y: 16))
                    $0.addQuadCurve(to: CGPoint(x: 32, y: 56), control: CGPoint(x: 54, y: 44))
                    $0.addQuadCurve(to: CGPoint(x: 12, y: 16), control: CGPoint(x: 10, y: 44))
                    $0.closeSubpath()
                }, with: ink, style: st)
            case .flame:
                ctx.stroke(P {
                    $0.move(to: CGPoint(x: 32, y: 8))
                    $0.addQuadCurve(to: CGPoint(x: 48, y: 38), control: CGPoint(x: 50, y: 22))
                    $0.addQuadCurve(to: CGPoint(x: 32, y: 56), control: CGPoint(x: 48, y: 56))
                    $0.addQuadCurve(to: CGPoint(x: 16, y: 38), control: CGPoint(x: 16, y: 56))
                    $0.addQuadCurve(to: CGPoint(x: 32, y: 8), control: CGPoint(x: 18, y: 24))
                }, with: ink, style: st)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
#endif
