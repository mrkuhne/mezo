#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY SIMULATOR DEMO — see BlokkDemoModel.swift.

struct BlokkDemoRoot: View {
    enum Route { case hub, builder, review }
    @State private var model = BlokkDemoModel()
    @State private var route: Route = {
        switch UserDefaults.standard.string(forKey: "previewBlokkOpen") {
        case "epito": .builder
        case "het": .review
        default: .hub
        }
    }()

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            switch route {
            case .hub: BlokkDemoHub(model: model) { route = $0 }
            case .builder: BlokkBuilderPage(model: model) { route = .hub }
            case .review: WeekReviewPage(model: model) { route = .hub }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: route)
        .preferredColorScheme(.dark)
    }
}

// MARK: - The entrance: the weekly card and the builder

private struct BlokkDemoHub: View {
    let model: BlokkDemoModel
    let go: (BlokkDemoRoot.Route) -> Void
    private let hue = Hue.mozgas

    var body: some View {
        let open = model.changes.count
        NKAreaSubPage(hue: hue, crumb: "Edzés", eyebrow: "Blokk · 3. hét kezdődik",
                      title: "V-forma és kar",
                      sentence: "Hathetes blokk, a *hát* és a *bicepsz* a hangsúly. A második hét mögötted van.",
                      onBack: nil) {
            if model.weekAccepted {
                NKHighlight(hue: hue, label: "A 3. hét", text: "Elfogadva, a hét számai élnek",
                            sub: "\(model.changes.filter(\.accepted).count) változás lépett életbe. Bármikor újra megnézheted.",
                            actions: [NKHighlightAction("Megnézem", weight: .secondary) { go(.review) }])
            } else {
                NKHighlight(hue: hue, label: "Új hét · jóváhagyásra vár", text: "\(open) dolog változna ezen a héten",
                            sub: "Két sorozattal több a hátra és a bicepszre, két gyakorlatnál nő a súly. Amíg nem hagyod jóvá, a múlt heti számok maradnak.",
                            actions: [NKHighlightAction("Átnézem") { go(.review) },
                                      NKHighlightAction("Elfogadom átnézés nélkül", weight: .secondary) { model.weekAccepted = true }])
            }

            NKBare("A blokk hat hete", hue: hue) {
                NKBlockTimeline([
                    NKBlockWeek(week: 1, load: 0.45, phase: "Alap", state: .past),
                    NKBlockWeek(week: 2, load: 0.58, phase: "Építés", state: .past),
                    NKBlockWeek(week: 3, load: 0.7, phase: "Építés", state: .current),
                    NKBlockWeek(week: 4, load: 0.82, phase: "Építés", state: .future),
                    NKBlockWeek(week: 5, load: 0.94, phase: "Csúcs", state: .future),
                    NKBlockWeek(week: 6, load: 0.4, phase: "Pihenőhét", state: .future, isDeload: true),
                ], hue: hue, caption: "6 hetes blokk · 3. hét")
            }

            NKBare("A terv", hue: hue, trailing: "\(model.total()) sorozat / hét") {
                VStack(alignment: .leading, spacing: 14) {
                    NKHueText(model.outside.isEmpty
                              ? "Minden izom a saját sávjában van."
                              : "*\(model.outside.count) izom* lóg ki a sávjából. Az építőben látod, melyik és mennyivel.",
                              hue: hue)
                    NKActions([NKAction(glyph: "dumbbell-ink", title: "Blokk szerkesztése", primary: true) { go(.builder) }], hue: hue)
                }
            }
        }
    }
}

// MARK: - The builder

private struct BlokkBuilderPage: View {
    let model: BlokkDemoModel
    let onBack: () -> Void
    private let hue = Hue.mozgas
    @State private var why: String?
    @State private var saved = false

    var body: some View {
        let out = model.outside
        NKAreaSubPage(hue: hue, crumb: "Edzés · Blokk", eyebrow: "Blokk szerkesztése · 6 hét",
                      title: out.isEmpty ? "Minden izom a sávjában van" : "\(out.count) izom lóg ki a sávjából",
                      sentence: out.isEmpty
                        ? "Heti *\(model.total()) sorozat*. Amit itt látsz, pontosan az kerül az edzéseidbe."
                        : "Állítsd a sorozatokat, válts szintet, vagy fogadd el a javaslatot. *A te számod* kerül az edzésbe.",
                      onBack: onBack) {
            body_
            levels
            ForEach(Array(model.days.enumerated()), id: \.element.id) { index, day in
                dayBlock(index, day)
            }
            NKBare("Mentés", hue: hue) {
                VStack(alignment: .leading, spacing: 12) {
                    if saved {
                        NKHueText("*Elmentve.* Az első hét ezekkel a számokkal indul.", hue: hue)
                    }
                    NKActions(out.isEmpty
                              ? [NKAction(glyph: "check-ink", title: "Blokk mentése", primary: true) { saved = true }]
                              : [NKAction(glyph: "bolt-ink", title: "Igazítsd a sávba", primary: true) { model.applyAll() },
                                 NKAction(title: "Mentés így is") { saved = true }], hue: hue)
                    NKNote("A sáv az a heti sorozatszám, amit a kutatások az adott szinthez ajánlanak. A javaslat soha nem tesz egy gyakorlatra ötnél, egy edzésen egy izomra nyolcnál több sorozatot.", hue: hue)
                }
            }
        }
        .sheet(item: Binding(get: { why.map(WhyItem.init) }, set: { why = $0?.muscle })) { item in
            WhySheet(model: model, muscle: item.muscle, hue: hue)
                .presentationDetents([.medium])
        }
    }

    /// The body, each muscle filled to where it stands against the top of its band.
    private var body_: some View {
        NKBare("A hét egy képen", hue: hue, trailing: "\(model.total()) sorozat") {
            HStack(alignment: .center, spacing: 16) {
                NKBodyMap(BlokkDemoModel.muscles.compactMap { m in
                    guard let band = model.band(m) else { return nil }
                    return NKBodyHeat(muscle: m, level: Double(model.weekly(m)) / Double(max(1, band.high)))
                }, hue: hue, views: .both)
                .frame(maxHeight: 180)
                VStack(alignment: .leading, spacing: 10) {
                    legend(.emphasize, "a sáv teteje a határ")
                    legend(.grow, "a közepéig építünk")
                    legend(.maintain, "kevés is megtartja")
                    Toggle(isOn: Binding(get: { model.volleyball }, set: { model.volleyball = $0 })) {
                        Text("Röplabda: a láb sávja lejjebb").nkFont(12).foregroundStyle(.white.opacity(0.7))
                    }
                    .tint(hue.glow)
                    .padding(.top, 4)
                }
            }
        }
    }

    private func legend(_ tier: MuscleTier, _ line: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            TierPill(tier: tier, hue: hue)
            Text(line).nkFont(11).foregroundStyle(.white.opacity(0.5))
        }
    }

    private var levels: some View {
        NKBare("Szintek és heti sorozatok", hue: hue, trailing: "koppints a szintre") {
            VStack(spacing: 0) {
                ForEach(Array(BlokkDemoModel.muscles.enumerated()), id: \.element) { i, muscle in
                    if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    MuscleRow(model: model, muscle: muscle, hue: hue) { why = muscle }
                }
            }
        }
    }

    private func dayBlock(_ index: Int, _ day: DemoDay) -> some View {
        NKBare("\(day.name) · \(day.title)", hue: hue, trailing: "kb. \(model.minutes(index)) perc") {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(day.exercises.enumerated()), id: \.element.id) { e, exercise in
                    if e > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(exercise.name).nkFont(15, .medium).foregroundStyle(.white.opacity(0.95))
                            Text(exercise.counts ? demoMuscleName(exercise.muscle) : "ugrás · nem számít a sorozatokba")
                                .nkFont(12).foregroundStyle(.white.opacity(0.5))
                        }
                        Spacer(minLength: 8)
                        SetStepper(value: exercise.sets, hue: hue,
                                   down: { model.step(day: index, exercise: e, by: -1) },
                                   up: { model.step(day: index, exercise: e, by: 1) })
                    }
                    .padding(.vertical, 10)
                }
                ForEach(model.overCap(index), id: \.0) { muscle, sets in
                    Text("\(demoMuscleName(muscle)): \(sets) sorozat egy edzésen. Nyolc fölött már nem ad többet, oszd el két napra.")
                        .nkFont(12).foregroundStyle(Color(hex: 0xF2C94C))
                        .padding(.top, 8)
                }
                if let note = day.note {
                    Text(note).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.4)).padding(.top, 8)
                }
            }
        }
    }
}

private struct WhyItem: Identifiable {
    let muscle: String
    var id: String { muscle }
}

/// One muscle in the builder: its tier, its band, his own number on it, and the proposal when he is outside.
private struct MuscleRow: View {
    let model: BlokkDemoModel
    let muscle: String
    let hue: Hue
    let onWhy: () -> Void

    var body: some View {
        let sets = model.weekly(muscle)
        let fit = model.fit(muscle)
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .center, spacing: 10) {
                if NKBodyMark.canDraw(muscle) {
                    NKBodyMark(muscle: muscle, hue: hue, height: 40).frame(width: 26)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(demoMuscleName(muscle)).nkFont(15, .medium).foregroundStyle(.white.opacity(0.95))
                    Text(verdict(fit)).nkFont(12).foregroundStyle(fit == .inside ? .white.opacity(0.55) : Color(hex: 0xF2C94C))
                }
                Spacer(minLength: 6)
                Button { model.cycle(muscle) } label: { TierPill(tier: model.tiers[muscle] ?? .grow, hue: hue) }
                    .buttonStyle(.plain)
                VStack(alignment: .trailing, spacing: 0) {
                    Text("\(sets)").nkFont(22, .medium).foregroundStyle(.white)
                        .contentTransition(.numericText())
                    Text("sorozat").nkFont(10).foregroundStyle(.white.opacity(0.45))
                }
                .frame(minWidth: 46, alignment: .trailing)
            }
            if let band = model.band(muscle) {
                BandBar(value: sets, band: band, hue: hue, inside: fit == .inside)
            }
            if fit != .inside {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Javaslat: \(model.proposalText(muscle))")
                        .nkFont(13).foregroundStyle(.white.opacity(0.8))
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 14) {
                        Button { withAnimation(.snappy) { model.apply(muscle) } } label: {
                            Text("Elfogadom").nkFont(13, .semibold).foregroundStyle(NK.ground)
                                .padding(.horizontal, 14).padding(.vertical, 7)
                                .background(Capsule().fill(.white))
                        }
                        .buttonStyle(.plain)
                        Button(action: onWhy) {
                            Text("miért?").nkFont(13, .medium).foregroundStyle(hue.glow)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .nkGlass(16)
            }
        }
        .padding(.vertical, 12)
        .animation(.snappy, value: sets)
    }

    private func verdict(_ fit: DemoFit) -> String {
        switch fit {
        case .inside: "a sávban"
        case .below(let n): "\(n) sorozattal a sáv alatt"
        case .above(let n): "\(n) sorozattal a sáv fölött"
        }
    }
}

private struct WhySheet: View {
    let model: BlokkDemoModel
    let muscle: String
    let hue: Hue

    var body: some View {
        let band = model.band(muscle)
        let tier = model.tiers[muscle] ?? .grow
        VStack(alignment: .leading, spacing: 14) {
            Text("MIÉRT EZ A JAVASLAT").nkFont(11, .semibold, design: .monospaced).tracking(1.4)
                .foregroundStyle(.white.opacity(0.5))
            Text("\(demoMuscleName(muscle)) · \(tier.hungarian)").nkFont(26, design: .serif).foregroundStyle(.white)
            if let band {
                line("A sáv", "\(band.low)–\(band.high) sorozat hetente. \(tierLine(tier))")
                line("Most", "\(model.weekly(muscle)) sorozatod van a héten, két edzésre elosztva.")
                if band.sport {
                    line("Röplabda", "A lábad heti három edzésen és a szombati versenyen is dolgozik, ezért a sávot lejjebb vettem.")
                }
                line("A javaslat", model.proposalText(muscle))
                line("Ha nem ezt akarod", "Válts szintet a sorban, vagy állítsd kézzel a sorozatokat a napoknál. A te számod kerül az edzésbe.")
            }
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(NK.ground.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }

    private func line(_ label: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased()).nkFont(10, .semibold, design: .monospaced).tracking(1.2).foregroundStyle(hue.glow)
            Text(text).nkFont(15).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func tierLine(_ tier: MuscleTier) -> String {
        switch tier {
        case .emphasize: "Hangsúlynál a sáv teteje a határ: innen építjük a legtöbbet."
        case .grow: "Építésnél ennyi kell ahhoz, hogy nőjön, de ne fáradj el tőle."
        case .maintain: "Tartásnál a harmada is megtartja, amid van, ha a súly megmarad."
        }
    }
}

// MARK: - The weekly review

private struct WeekReviewPage: View {
    let model: BlokkDemoModel
    let onBack: () -> Void
    private let hue = Hue.mozgas
    @State private var open: String?

    var body: some View {
        let kept = model.changes.filter(\.accepted).count
        let added = model.changes.filter(\.accepted).reduce(0) { sum, c in
            if case .sets(let from, let to) = c.kind { return sum + (to - from) }
            return sum
        }
        NKAreaSubPage(hue: hue, crumb: "Edzés · Blokk", eyebrow: "3. hét · nov. 30 – dec. 6.",
                      title: "\(model.changes.count) dolog változna ezen a héten",
                      sentence: "A múlt heti edzéseid alapján. *Amit kikapcsolsz, az marad a múlt heti.*",
                      onBack: onBack) {
            NKBare("A hét egy pillantásra", hue: hue) {
                NKStatRow([NKStat(value: "\(model.total() + added)", target: nil, unit: "sorozat", label: "ezen a héten", trend: added > 0 ? 1 : 0, hot: true),
                           NKStat(value: "\(model.total())", unit: "sorozat", label: "múlt héten"),
                           NKStat(value: "\(kept)", target: "\(model.changes.count)", label: "változás él")], hue: hue)
            }

            NKBare("Izmonként", hue: hue) {
                VStack(spacing: 0) {
                    ForEach(Array(BlokkDemoModel.muscles.enumerated()), id: \.element) { i, muscle in
                        if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        reviewMuscle(muscle)
                    }
                }
            }

            ForEach(Array(model.days.enumerated()), id: \.element.id) { index, day in
                reviewDay(index, day)
            }

            NKNote("Fogyásban vagy, ezért a Hangsúly izmok is csak egy sorozattal lépnek hetente. A Tartás izmok sorozatszáma nem változik, ott csak a súly vagy az ismétlés mozdul.", hue: hue)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 8) {
                NKPill(model.weekAccepted ? "Elfogadva" : (kept == model.changes.count ? "Elfogadom mind" : "Elfogadom (\(kept) változás)")) {
                    model.weekAccepted = true
                    onBack()
                }
                Button { onBack() } label: {
                    Text("Később döntök, marad a múlt heti").nkFont(13, .medium).foregroundStyle(.white.opacity(0.6))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 6)
            .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground, NK.ground], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
        }
    }

    private func delta(_ muscle: String) -> Int {
        model.changes.filter { $0.accepted && $0.muscle == muscle }.reduce(0) { sum, c in
            if case .sets(let from, let to) = c.kind { return sum + (to - from) }
            return sum
        }
    }

    private func reviewMuscle(_ muscle: String) -> some View {
        let before = model.weekly(muscle), after = before + delta(muscle)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                if NKBodyMark.canDraw(muscle) { NKBodyMark(muscle: muscle, hue: hue, height: 36).frame(width: 24) }
                Text(demoMuscleName(muscle)).nkFont(15, .medium).foregroundStyle(.white.opacity(0.95))
                TierPill(tier: model.tiers[muscle] ?? .grow, hue: hue)
                Spacer(minLength: 6)
                if after != before {
                    Text("\(before) → \(after)").nkFont(17, .semibold).foregroundStyle(hue.glow)
                } else {
                    Text("\(before) · marad").nkFont(14).foregroundStyle(.white.opacity(0.5))
                }
            }
            if let band = model.band(muscle) {
                BandBar(value: after, band: band, hue: hue, inside: after >= band.low && after <= band.high, ghost: after != before ? before : nil)
            }
        }
        .padding(.vertical, 10)
    }

    private func reviewDay(_ index: Int, _ day: DemoDay) -> some View {
        let dayChanges = model.changes.filter { $0.day == index }
        return NKBare("\(day.name) · \(day.title)", hue: hue,
                      trailing: dayChanges.isEmpty ? "nem változik" : "\(dayChanges.count) változás") {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(day.exercises.enumerated()), id: \.element.id) { e, exercise in
                    if e > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    let change = dayChanges.first { $0.exercise == exercise.name }
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 10) {
                            if change != nil {
                                Capsule().fill(change?.accepted == true ? hue.glow : .white.opacity(0.25)).frame(width: 3, height: 30)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(exercise.name).nkFont(15, .medium)
                                    .foregroundStyle(.white.opacity(change == nil ? 0.6 : 0.95))
                                Text(line(exercise, change)).nkFont(12)
                                    .foregroundStyle(change?.accepted == true ? hue.glow : .white.opacity(0.45))
                            }
                            Spacer(minLength: 8)
                            if let change {
                                Toggle("", isOn: Binding(get: { change.accepted }, set: { on in
                                    if let i = model.changes.firstIndex(where: { $0.id == change.id }) { model.changes[i].accepted = on }
                                }))
                                .labelsHidden().tint(hue.glow)
                            }
                        }
                        if let change {
                            Button { withAnimation(.snappy) { open = open == change.id ? nil : change.id } } label: {
                                Text(open == change.id ? change.why : "miért?")
                                    .nkFont(13, open == change.id ? .regular : .medium)
                                    .foregroundStyle(open == change.id ? .white.opacity(0.75) : hue.glow)
                                    .multilineTextAlignment(.leading)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .padding(.leading, 13)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 10)
                }
            }
        }
    }

    private func line(_ exercise: DemoExercise, _ change: DemoChange?) -> String {
        guard let change else { return exercise.counts ? "\(exercise.sets) sorozat · ugyanaz, mint múlt héten" : "ugrás · ugyanaz" }
        let off = change.accepted ? "" : " · kikapcsolva"
        switch change.kind {
        case .sets(let from, let to): return "\(from) → \(to) sorozat\(off)"
        case .weight(let from, let to): return "\(exercise.sets) sorozat · \(demoKg(from)) → \(demoKg(to))\(off)"
        case .reps(let from, let to): return "\(exercise.sets) sorozat · \(from) → \(to) ismétlés\(off)"
        }
    }
}

// MARK: - Small pieces

private struct TierPill: View {
    let tier: MuscleTier
    let hue: Hue

    var body: some View {
        Text(tier.hungarian.uppercased())
            .nkFont(9, .semibold, design: .monospaced).tracking(1)
            .foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(Capsule().fill(color.opacity(0.16)))
    }

    private var color: Color {
        switch tier {
        case .emphasize: hue.glow
        case .grow: Color(hex: 0x9FD8A8)
        case .maintain: .white.opacity(0.6)
        }
    }
}

/// The band as a lit stretch of the scale, and his own number as a marker on it.
private struct BandBar: View {
    let value: Int
    let band: DemoBand
    let hue: Hue
    let inside: Bool
    var ghost: Int? = nil

    var body: some View {
        let top = Double(max(band.limit, value) + 2)
        VStack(alignment: .leading, spacing: 5) {
            GeometryReader { geo in
                let w = geo.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08)).frame(height: 6)
                    Capsule().fill(hue.glow.opacity(0.32))
                        .frame(width: max(6, w * CGFloat(Double(band.high - band.low) / top)), height: 6)
                        .offset(x: w * CGFloat(Double(band.low) / top))
                    if let ghost {
                        Circle().stroke(.white.opacity(0.45), lineWidth: 1.5).frame(width: 10, height: 10)
                            .offset(x: w * CGFloat(Double(ghost) / top) - 5)
                    }
                    Circle().fill(inside ? Color.white : Color(hex: 0xF2C94C))
                        .frame(width: 12, height: 12)
                        .shadow(color: .black.opacity(0.4), radius: 2)
                        .offset(x: w * CGFloat(Double(value) / top) - 6)
                }
                .frame(height: 12)
            }
            .frame(height: 12)
            Text("sáv \(band.low)–\(band.high)\(band.sport ? " · röplabda miatt lejjebb" : "")")
                .nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.42))
        }
    }
}

private struct SetStepper: View {
    let value: Int
    let hue: Hue
    let down: () -> Void
    let up: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            round("−", down)
            Text("\(value)").nkFont(19, .medium).foregroundStyle(.white)
                .frame(minWidth: 22).contentTransition(.numericText())
            round("+", up)
        }
    }

    private func round(_ symbol: String, _ action: @escaping () -> Void) -> some View {
        Button { withAnimation(.snappy) { action() } } label: {
            Text(symbol).nkFont(18, .medium).foregroundStyle(.white.opacity(0.85))
                .frame(width: 34, height: 34)
                .background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }
}
#endif
