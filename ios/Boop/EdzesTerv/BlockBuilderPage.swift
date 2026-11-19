import SwiftUI
import BoopCore
import BoopDesign

// The block builder (mezo-r36n9.83) — the approved spike's full screen with its own three-way bar, Izmok · Napok ·
// Blokk, on his real running block. Every number comes from the server's evaluator (`BlockBuilderModel`); the draft
// only holds his edits. One primary button: „Igazítsd a sávba" while a muscle is outside its band, else „Mentés".

struct BlockBuilderPage: View {
    enum Mode: String, CaseIterable { case izmok = "Izmok", napok = "Napok", blokk = "Blokk" }

    @State var model: BlockBuilderModel
    let onClose: () -> Void
    @State private var mode: Mode
    @State private var muscle: String?
    @State private var day = 0
    @State private var confirmLeave = false
    /// The technique picker, presented at page level (boop-ios.md §9).
    @State private var picking: TechniquePick?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(model: BlockBuilderModel, initialMode: Mode = .izmok, onClose: @escaping () -> Void) {
        _model = State(initialValue: model)
        _mode = State(initialValue: initialMode)
        self.onClose = onClose
        #if DEBUG
        // Simulator review: `-previewBlokkPicker YES` opens the picker on the first day's second exercise.
        // A number picks the exercise (`-previewBlokkPicker 0`).
        if let v = UserDefaults.standard.string(forKey: "previewBlokkPicker") {
            _picking = State(initialValue: TechniquePick(day: 0, exercise: Int(v) ?? 1))
        }
        #endif
    }

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                PlanStateView(title: "Betöltöm a blokkot", text: "Egy pillanat, lekérem a terved és az értékelését.", loading: true, onClose: onClose)
            case .noBlock:
                PlanStateView(title: "Nincs futó blokkod", text: "Az építő a futó blokkodat állítja. Amint elindul egy, itt tudod igazítani.",
                              mark: .calendar, onClose: onClose)
            case .failed(let e):
                PlanStateView(title: "Most nem tudom betölteni", text: planErrorText(e), mark: .shield,
                              action: ("Újra", { Task { await model.load() } }), onClose: onClose)
            case .ready:
                ready
            }
        }
        .task { if model.phase == .loading, model.draft == nil { await model.load() } }
        .preferredColorScheme(.dark)
    }

    private var ready: some View {
        ZStack {
            PlanSky(height: 150)
            VStack(spacing: 0) {
                head
                if model.evaluation == nil {
                    evaluationMissing
                } else {
                    Group {
                        switch mode {
                        case .izmok: BuilderMusclesView(model: model, selected: $muscle)
                        case .napok: BuilderDaysView(model: model, day: $day) { picking = $0 }
                        case .blokk: BuilderBlockView(model: model)
                        }
                    }
                    // Edits made while a save is on its way would be overwritten by the re-read after it.
                    .disabled(model.saveState == .saving)
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { bar }
        .overlay(alignment: .top) { saveBanner }
        .sensoryFeedback(.selection, trigger: mode)
        .sensoryFeedback(.success, trigger: model.saveState == .saved)
        .sheet(item: $picking) { pick in
            if let ex = model.draft?.days[safe: pick.day]?.exercises[safe: pick.exercise] {
                TechniquePicker(exercise: ex,
                                choose: { model.draft?.setTechnique(day: pick.day, exercise: pick.exercise, $0) },
                                onClose: { picking = nil })
            }
        }
        .confirmationDialog("Elveted a változtatásokat?", isPresented: $confirmLeave, titleVisibility: .visible) {
            Button("Elvetem", role: .destructive, action: onClose)
            Button("Maradok", role: .cancel) {}
        } message: {
            Text("Amit itt állítottál, még nincs elmentve.")
        }
    }

    private var evaluationMissing: some View {
        VStack(spacing: 14) {
            Spacer()
            if model.evaluationError == nil {
                ProgressView().tint(.white)
            } else {
                Text(planErrorText(model.evaluationError ?? .server)).nkFont(15).foregroundStyle(.white.opacity(0.75))
                    .multilineTextAlignment(.center).padding(.horizontal, 32)
                Button("Újra") { Task { await model.evaluateNow() } }.nkFont(15, .semibold).foregroundStyle(planHue.glow)
            }
            Spacer()
        }
    }

    private var head: some View {
        HStack(alignment: .center, spacing: 12) {
            PlanCloseButton { if model.hasChanges { confirmLeave = true } else { onClose() } }
            VStack(alignment: .leading, spacing: 2) {
                Text(scope).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.7))
                Text(model.draft?.title ?? "").nkFont(22, design: .serif).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 8)
            let out = model.outside.count
            HStack(spacing: 6) {
                Circle().fill(out == 0 ? planGood : planWarn).frame(width: 7, height: 7)
                Text(model.evaluationStale ? "frissül…" : (out == 0 ? "minden a sávban" : "\(out) izom kilóg"))
                    .nkFont(12, .medium).foregroundStyle(.white.opacity(0.9))
                    .contentTransition(.numericText())
            }
            .padding(.horizontal, 11).padding(.vertical, 7)
            .background(Capsule().fill(.black.opacity(0.28)))
            .opacity(model.evaluation == nil ? 0 : 1)
        }
        .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 10)
    }

    /// The one line that says what he is looking at.
    private var scope: String {
        switch mode {
        case .izmok: "EGY HÉT · IZMONKÉNT"
        case .napok: "EGY HÉT · NAPONKÉNT"
        case .blokk: "A TELJES BLOKK · \(model.draft?.weeks ?? 0) HÉT"
        }
    }

    private enum Primary { case align, save, saving, done }

    /// Save wins whenever there is something to save — he must never have to accept set changes to keep a style or
    /// a switch he chose. With nothing to save, the button offers to bring the outside muscles into their bands.
    private var primary: Primary {
        if model.saveState == .saving { return .saving }
        if model.hasChanges { return .save }
        if model.outside.contains(where: { !$0.proposal.isEmpty }) { return .align }
        return .done
    }

    private var bar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 2) {
                ForEach(Mode.allCases, id: \.self) { item in
                    Button { withAnimation(reduceMotion ? nil : .snappy(duration: 0.28)) { mode = item } } label: {
                        VStack(spacing: 3) {
                            NKGlyph(glyph(item), mode == item ? NK.ground : .white.opacity(0.75), size: 17)
                            Text(item.rawValue).nkFont(10, .semibold).foregroundStyle(mode == item ? NK.ground : .white.opacity(0.75))
                        }
                        .frame(width: 62, height: 48)
                        .background { if mode == item { Capsule().fill(.white) } }
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(mode == item ? .isSelected : [])
                }
            }
            .padding(4)
            .background(Capsule().fill(.ultraThinMaterial).overlay(Capsule().stroke(.white.opacity(0.12), lineWidth: 1)))

            let p = primary
            Button {
                switch p {
                case .align: withAnimation(reduceMotion ? nil : .snappy) { model.applyAllProposals() }
                case .save: Task { await model.save() }
                case .saving, .done: break
                }
            } label: {
                Group {
                    if p == .saving { ProgressView().tint(NK.ground) }
                    else { Text(label(p)).nkFont(15, .semibold).lineLimit(1).minimumScaleFactor(0.8) }
                }
                .foregroundStyle(p == .align ? .white : NK.ground)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(Capsule().fill(p == .align ? AnyShapeStyle(.white.opacity(0.14)) : AnyShapeStyle(planHue.glow.opacity(p == .done ? 0.45 : 1))))
                .overlay(Capsule().stroke(.white.opacity(p == .align ? 0.18 : 0), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(p == .done || p == .saving || (p == .align && !model.canApplyProposals))
        }
        .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 4)
        .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground.opacity(0.95)], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }

    private func label(_ p: Primary) -> String {
        switch p {
        case .align: "Igazítsd a sávba"
        case .save: "Mentés"
        case .saving: ""
        case .done: model.saveState == .saved ? "Elmentve" : "Nincs mit menteni"
        }
    }

    @ViewBuilder private var saveBanner: some View {
        if case .failed(let saved, let error) = model.saveState {
            VStack(alignment: .leading, spacing: 6) {
                Text(saved.isEmpty ? "Nem sikerült menteni" : "Csak egy része mentődött el").nkFont(15, .semibold).foregroundStyle(.white)
                if !saved.isEmpty {
                    Text("Elmentve: \(saved.joined(separator: ", ")).").nkFont(13).foregroundStyle(.white.opacity(0.8))
                }
                Text(planErrorText(error)).nkFont(13).foregroundStyle(.white.opacity(0.8))
                Button("Rendben") { model.resetSaveState() }.nkFont(14, .semibold).foregroundStyle(planHue.glow)
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(NK.ground.opacity(0.92)))
            .nkGlass(20)
            .padding(.horizontal, 16).padding(.top, 60)
            .transition(.opacity)
        }
    }

    private func glyph(_ mode: Mode) -> String {
        switch mode {
        case .izmok: "dumbbell-ink"
        case .napok: "clock-ink"
        case .blokk: "chart-deep"
        }
    }
}

// MARK: - Izmok: the body, and one muscle a card

private struct BuilderMusclesView: View {
    let model: BlockBuilderModel
    @Binding var selected: String?

    var body: some View {
        let muscles = model.bandedMuscles
        let current = selected ?? model.outside.first?.muscle ?? muscles.first?.muscle ?? ""
        VStack(spacing: 0) {
            NKBodyMap(muscles.map { m in
                let fill = min(1, Double(m.weeklySets) / Double(max(1, m.band.high)))
                return NKBodyHeat(muscle: m.muscle, level: m.muscle == current ? 1 : fill * 0.12)
            }, hue: planHue, views: .both)
            .frame(maxWidth: .infinity).frame(height: 200)
            .padding(.horizontal, 40).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(Color.black.opacity(0.42)).padding(.horizontal, 20))
            .animation(.smooth(duration: 0.4), value: current)
            .accessibilityHidden(true)

            dots(muscles, current)

            ScrollView(.horizontal) {
                LazyHStack(spacing: 14) {
                    ForEach(muscles, id: \.muscle) { m in
                        BuilderMuscleCard(model: model, muscle: m.muscle)
                            .containerRelativeFrame(.horizontal)
                            .scrollTransition(.interactive, axis: .horizontal) { view, phase in
                                view.scaleEffect(phase.isIdentity ? 1 : 0.92).opacity(phase.isIdentity ? 1 : 0.55)
                            }
                            .id(m.muscle)
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
        .onAppear { if selected == nil { selected = current } }
    }

    /// The muscles as a strip: which one is on the card, and which ones are outside their band.
    private func dots(_ muscles: [WireMuscleEvaluation], _ current: String) -> some View {
        HStack(spacing: 6) {
            ForEach(muscles, id: \.muscle) { m in
                let out = m.fit != "inside"
                Button { withAnimation(.smooth) { selected = m.muscle } } label: {
                    Capsule()
                        .fill(m.muscle == current ? Color.white : (out ? planWarn.opacity(0.85) : .white.opacity(0.22)))
                        .frame(width: m.muscle == current ? 26 : 9, height: 9)
                        .frame(height: 30)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(planMuscleName(m.muscle))
            }
        }
        .padding(.vertical, 2)
        .animation(.snappy, value: current)
    }
}

private struct BuilderMuscleCard: View {
    let model: BlockBuilderModel
    let muscle: String
    @State private var why = false

    var body: some View {
        if let m = model.muscle(muscle), let draft = model.draft {
            let tier = draft.tier(muscle)
            let inside = m.fit == "inside"
            ScrollView {
                VStack(spacing: 12) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(planMuscleName(muscle)).nkFont(26, design: .serif).foregroundStyle(.white)
                        Spacer()
                        Text(verdict(m)).nkFont(13, .medium).foregroundStyle(inside ? planGood : planWarn)
                    }
                    BuilderTierSwitch(tier: tier) { model.draft?.setTier(muscle, $0) }

                    PlanArcGauge(value: m.weeklySets, band: m.band, inside: inside)
                        .frame(height: 124)
                        .overlay(alignment: .bottom) {
                            VStack(spacing: 0) {
                                Text("\(m.weeklySets)").nkFont(44, .medium).foregroundStyle(.white).contentTransition(.numericText())
                                Text("sorozat hetente").nkFont(11).foregroundStyle(.white.opacity(0.5))
                            }
                            .accessibilityHidden(true)
                        }
                    bandPills(m, tier: tier)

                    if !inside {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .top, spacing: 10) {
                                PlanMark(why ? .target : .spark, color: planWarn, size: 18).padding(.top, 1)
                                Text(why ? proposalRule : proposalText(m, draft))
                                    .nkFont(13).foregroundStyle(.white.opacity(0.85))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            HStack(spacing: 16) {
                                if !m.proposal.isEmpty {
                                    Button { withAnimation(.snappy) { model.applyProposal(muscle) } } label: {
                                        Text("Elfogadom").nkFont(14, .semibold).foregroundStyle(NK.ground)
                                            .padding(.horizontal, 18).padding(.vertical, 9).background(Capsule().fill(.white))
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(!model.canApplyProposals)
                                    .opacity(model.canApplyProposals ? 1 : 0.5)
                                }
                                Button { withAnimation(.snappy) { why.toggle() } } label: {
                                    Text(why ? "a javaslat" : "miért?").nkFont(14, .medium).foregroundStyle(planHue.glow)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(planWarn.opacity(0.1)))
                    }
                    bandReason(m, tier: tier, inside: inside)
                }
                .padding(20)
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)
            .frame(maxHeight: .infinity, alignment: .top)
            .nkGlass(30)
            .padding(.vertical, 8)
            .sensoryFeedback(.impact(weight: .light), trigger: m.weeklySets)
            .sensoryFeedback(.selection, trigger: tier)
        }
    }

    private func verdict(_ m: WireMuscleEvaluation) -> String {
        switch m.fit {
        case "below": "\(abs(m.diff)) hiányzik"
        case "above": "\(abs(m.diff)) túl sok"
        default: "a sávban"
        }
    }

    /// The band and where the week's sets sit, as pills: „Sáv 2–5" in the tier's colour, then one pill a day („Kedd 2").
    private func bandPills(_ m: WireMuscleEvaluation, tier: MuscleTier) -> some View {
        let days = model.draft?.days ?? []
        let spread = m.spread.filter { $0.sets > 0 && days.indices.contains($0.dayIndex) }
        return NKFlowRow(spacing: 6, rowSpacing: 6) {
            PlanPill("Sáv \(m.band.low)–\(m.band.high)", color: planTierColor(tier == .maintain ? .grow : tier), mark: .target)
            ForEach(spread, id: \.dayIndex) { s in
                PlanPill("\(days[s.dayIndex].name) \(s.sets)", mark: .calendar)
            }
            if m.band.sportAdjusted { PlanPill("a sport miatt lejjebb", color: planWarn, mark: .spark) }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    /// Why this muscle has this band — always on the card, in his numbers.
    private func bandReason(_ m: WireMuscleEvaluation, tier: MuscleTier, inside: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("MIÉRT EZ A SÁV").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
            Text(reasonText(m, tier: tier, inside: inside))
                .nkFont(13).foregroundStyle(.white.opacity(0.75))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.05)))
    }

    private func reasonText(_ m: WireMuscleEvaluation, tier: MuscleTier, inside: Bool) -> String {
        let low = m.band.low, high = m.band.high
        let base: String
        switch tier {
        case .maintain:
            base = "Tartás szinten vagy: heti \(low)–\(high) sorozat megtartja, amit eddig felépítettél, ha a súly marad. Ennél több most nem kell, kevesebbnél már veszíthetsz belőle."
        case .grow:
            base = "Építés szinten vagy: heti \(low) sorozattól nő az izom, \(high) fölött már inkább csak fáraszt."
        case .emphasize:
            base = "Hangsúly szinten vagy: heti \(low)–\(high) sorozat — innen építjük a legtöbbet, a teteje az, amit egy héten még jól visel."
        }
        let sport = m.band.sportAdjusted ? " A sport is terheli, ezért a sáv lejjebb van." : ""
        let ok = inside ? " Most rendben van; a Napok nézetben állíthatod a sorozatokat, a mérő azonnal követi." : ""
        return base + sport + ok
    }

    /// The rule behind the proposal („miért?" in the proposal box).
    private var proposalRule: String {
        "A javaslat a legkevesebb sorozatú gyakorlatot tölti fel először, és sosem tesz egy gyakorlatra ötnél, egy edzésen egy izomra nyolcnál több sorozatot."
    }

    private func proposalText(_ m: WireMuscleEvaluation, _ draft: BlockDraft) -> String {
        let parts = m.proposal.compactMap { e -> String? in
            guard draft.days.indices.contains(e.dayIndex), draft.days[e.dayIndex].exercises.indices.contains(e.exerciseIndex) else { return nil }
            let ex = draft.days[e.dayIndex].exercises[e.exerciseIndex]
            return "\(e.delta > 0 ? "+" : "−")\(abs(e.delta)) \(ex.name) (\(draft.days[e.dayIndex].name.lowercased()))"
        }
        guard !parts.isEmpty else { return "Ehhez új gyakorlat kell: a meglévők már tele vannak." }
        return "Javaslat: " + parts.joined(separator: " · ")
    }

}

/// Tartás · Építés · Hangsúly as one switch, the chosen one lit in its own colour.
private struct BuilderTierSwitch: View {
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
                        .background { if item == tier { Capsule().fill(item == .maintain ? .white : planTierColor(item)) } }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(item == tier ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Capsule().fill(.white.opacity(0.08)))
    }
}

// MARK: - Napok: one day a page

private struct BuilderDaysView: View {
    let model: BlockBuilderModel
    @Binding var day: Int
    let pick: (TechniquePick) -> Void

    var body: some View {
        let days = model.draft?.days ?? []
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                ForEach(Array(days.enumerated()), id: \.element.id) { index, item in
                    let on = index == day
                    let minutes = model.day(index)?.minutesEstimate ?? 0
                    Button { withAnimation(.snappy) { day = index } } label: {
                        VStack(spacing: 5) {
                            Text(String(item.weekday.prefix(3)).uppercased())
                                .nkFont(11, .semibold, design: .monospaced).foregroundStyle(on ? NK.ground : .white.opacity(0.75))
                            Text("\(minutes)'").nkFont(15, .medium).foregroundStyle(on ? NK.ground : .white)
                                .contentTransition(.numericText())
                            Capsule().fill(on ? NK.ground.opacity(0.5) : planHue.glow.opacity(0.8))
                                .frame(width: CGFloat(min(40, 8 + minutes / 2)), height: 3)
                        }
                        .frame(maxWidth: .infinity, minHeight: 62)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(on ? Color.white : .white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(item.name), kb. \(minutes) perc")
                }
            }
            .padding(.horizontal, 20)

            TabView(selection: $day) {
                ForEach(Array(days.enumerated()), id: \.element.id) { index, _ in
                    BuilderDayCard(model: model, index: index, pick: pick).tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .sensoryFeedback(.selection, trigger: day)
        }
    }
}

private struct BuilderDayCard: View {
    let model: BlockBuilderModel
    let index: Int
    let pick: (TechniquePick) -> Void

    var body: some View {
        if let draft = model.draft, draft.days.indices.contains(index) {
            let day = draft.days[index]
            let evaluation = model.day(index)
            let techniques = draft.techniqueCount(index)
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(day.name.uppercased()).nkFont(11, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(planHue.glow)
                        Text(day.title).nkFont(28, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                        NKFlowRow(spacing: 6, rowSpacing: 6) {
                            PlanPill("kb. \(evaluation?.minutesEstimate ?? 0) perc", mark: .timer)
                            if evaluation?.sportSameDay == true { PlanPill("aznap sport is", mark: .spark) }
                            if techniques > 0 { PlanPill("\(techniques) technika", color: planHue.glow, mark: .drop) }
                        }
                        .padding(.top, 2)
                    }
                    NKFlowRow(spacing: 8, rowSpacing: 8) {
                        ForEach(model.bandedMuscles.filter { model.sets($0.muscle, day: index) > 0 }, id: \.muscle) { m in
                            let sets = model.sets(m.muscle, day: index)
                            let over = evaluation?.sessionCapWarnings.contains { $0.muscle == m.muscle } == true
                            HStack(spacing: 6) {
                                Text(planMuscleName(m.muscle)).nkFont(12, .medium).foregroundStyle(.white.opacity(0.85))
                                Text("\(sets)").nkFont(13, .semibold).foregroundStyle(over ? planWarn : planHue.glow)
                                    .contentTransition(.numericText())
                            }
                            .padding(.horizontal, 11).padding(.vertical, 6)
                            .background(Capsule().fill(over ? planWarn.opacity(0.16) : .white.opacity(0.08)))
                        }
                    }
                    ForEach(Array((evaluation?.sessionCapWarnings ?? []).enumerated()), id: \.offset) { _, w in
                        Text("\(planMuscleName(w.muscle ?? "")): \(w.sets) sorozat egy edzésen. \(w.cap) fölött már nem ad többet, oszd el két napra.")
                            .nkFont(13).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
                    }
                    if !draft.techniquesEnabled, day.exercises.contains(where: { $0.stable && $0.judged }) {
                        Text("A technikák ki vannak kapcsolva ebben a blokkban. A Blokk fülön bekapcsolhatod.")
                            .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                    }
                    VStack(spacing: 0) {
                        ForEach(Array(day.exercises.enumerated()), id: \.element.id) { e, exercise in
                            if e > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                            row(draft, exercise, e, capped: evaluation?.exerciseCapWarnings?.contains { $0.exerciseIndex == e } == true)
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

    private func row(_ draft: BlockDraft, _ exercise: DraftExercise, _ e: Int, capped: Bool) -> some View {
        HStack(spacing: 10) {
            Group {
                if exercise.counts, NKBodyMark.canDraw(exercise.muscle) {
                    NKBodyMark(muscle: exercise.muscle, hue: planHue, height: 38)
                } else {
                    PlanMark(exercise.counts ? .target : .spark, color: .white.opacity(0.45), size: 20)
                }
            }
            .frame(width: 28, height: 40)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.name).nkFont(16, .medium).foregroundStyle(.white.opacity(0.95))
                    .lineLimit(2).minimumScaleFactor(0.85).fixedSize(horizontal: false, vertical: true)
                Text(subtitle(draft, exercise)).nkFont(12).foregroundStyle(capped ? planWarn : .white.opacity(0.5))
                if exercise.judged, draft.techniquesEnabled {
                    NKFlowRow(spacing: 6, rowSpacing: 6) {
                        BuilderTechniqueChip(exercise: exercise) { pick(TechniquePick(day: index, exercise: e)) }
                        if exercise.canTakeChallenge {
                            Button { withAnimation(.snappy) { model.draft?.toggleChallenge(day: index, exercise: e) } } label: {
                                PlanPill(exercise.challenge ? "KIHÍVÁS" : "kihívás", mono: exercise.challenge,
                                         color: exercise.challenge ? planWarn : .white.opacity(0.4), mark: .flag)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(exercise.challenge ? "A nap kihívása, koppints a levételhez" : "Legyen ez a nap kihívása")
                        }
                    }
                    .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)
            PlanSetStepper(value: exercise.sets, name: exercise.name,
                           down: { model.draft?.step(day: index, exercise: e, by: -1) },
                           up: { model.draft?.step(day: index, exercise: e, by: 1) })
        }
        .padding(.vertical, 12)
    }

    private func subtitle(_ draft: BlockDraft, _ exercise: DraftExercise) -> String {
        guard exercise.counts, exercise.wire.type != "plyo" else { return "ugrás · nem számít a sorozatokba" }
        guard exercise.judged else { return planMuscleName(exercise.muscle) }
        let range = (exercise.ownStyle ?? draft.style)?.range(isolation: exercise.isolation)
            ?? "\(exercise.wire.repMin ?? 8)–\(exercise.wire.repMax ?? 12)"
        return "\(planMuscleName(exercise.muscle)) · \(range) ism."
    }
}

/// The technique of one exercise as a pill he taps to change — or the reason there is none to pick.
private struct BuilderTechniqueChip: View {
    let exercise: DraftExercise
    /// Opens the picker.
    let open: () -> Void

    var body: some View {
        if !exercise.stable {
            PlanPill("szabadsúly · nincs technika", color: .white.opacity(0.4), mark: .shield)
        } else {
            Button(action: open) {
                PlanPill(exercise.challenge ? "kihívás a végén" : (exercise.technique == .none ? "+ technika" : exercise.technique.name),
                         color: exercise.technique == .none ? .white.opacity(0.55) : planHue.glow,
                         mark: Self.mark(exercise.technique))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Technika: \(exercise.technique.name). Koppints a választáshoz.")
        }
    }

    static func mark(_ technique: SetTechnique) -> PlanMark.Kind {
        switch technique {
        case .none: .keep
        case .restDrop: .timer
        case .drop: .drop
        case .myo: .myo
        case .partials: .partials
        }
    }
}

// MARK: - Blokk: the whole block

private struct BuilderBlockView: View {
    let model: BlockBuilderModel
    /// Leaving „Két sorozat bukásig" keeps every exercise at its two sets — he is asked before.
    @State private var leavingAllout: BlockStyle?

    var body: some View {
        let path = model.evaluation?.path ?? []
        let peak = Double(path.map(\.total).max() ?? 1)
        let draft = model.draft
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Az első hét a te terved. Innen a Hangsúly izmok hetente nőnek a sávjuk tetejéig, a Tartás marad, az utolsó hét könnyített.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)

                styleChoice(draft)
                switches(draft)

                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(path, id: \.week) { w in
                        let rest = w.phase == "Deload"
                        VStack(spacing: 6) {
                            Text("\(w.total)").nkFont(15, .semibold).foregroundStyle(.white).contentTransition(.numericText())
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(rest ? AnyShapeStyle(.white.opacity(0.06)) : AnyShapeStyle(LinearGradient(colors: [planHue.glow, planHue.glow.opacity(0.45)], startPoint: .top, endPoint: .bottom)))
                                .overlay { if rest { RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(planHue.glow.opacity(0.7), style: StrokeStyle(lineWidth: 1.2, dash: [4, 4])) } }
                                .frame(height: max(8, CGFloat(110 * Double(w.total) / peak)))
                            Text("\(w.week). hét").nkFont(11, .medium).foregroundStyle(.white.opacity(0.8)).lineLimit(1).minimumScaleFactor(0.7)
                            Text(phaseName(w.phase)).nkFont(9, design: .monospaced).foregroundStyle(.white.opacity(0.45)).lineLimit(1).minimumScaleFactor(0.7)
                            let on = techniqueWeek(w, draft)
                            PlanMark(on ? .drop : .keep, color: on ? planHue.glow : .white.opacity(0.25), size: 14)
                        }
                        .frame(maxWidth: .infinity)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(w.week). hét, \(phaseName(w.phase)), \(w.total) sorozat\(techniqueWeek(w, draft) ? ", technikákkal" : "")")
                    }
                }
                .padding(18)
                .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(NK.ground.opacity(0.62)))
                .nkGlass(26)

                NKFlowRow(spacing: 8, rowSpacing: 8) {
                    if draft?.techniquesEnabled == true {
                        PlanPill("minden terhelő héten technika", color: planHue.glow, mark: .drop)
                        PlanPill("a könnyített héten nincs", mark: .keep)
                    } else {
                        PlanPill("technikák kikapcsolva", mark: .keep)
                    }
                }

                VStack(spacing: 0) {
                    ForEach(Array(model.bandedMuscles.enumerated()), id: \.element.muscle) { i, m in
                        if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        let values = path.map { $0.muscles[m.muscle] ?? 0 }
                        let top = Double(max(1, values.max() ?? 1))
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(planMuscleName(m.muscle)).nkFont(15, .medium).foregroundStyle(.white.opacity(0.95))
                                PlanTierPill(tier: draft?.tier(m.muscle) ?? .grow)
                            }
                            .frame(width: 104, alignment: .leading)
                            HStack(alignment: .bottom, spacing: 4) {
                                ForEach(Array(values.enumerated()), id: \.offset) { w, v in
                                    let rest = path[w].phase == "Deload"
                                    VStack(spacing: 3) {
                                        Text("\(v)").nkFont(11, .medium, design: .monospaced)
                                            .foregroundStyle(w > 0 && !rest && v > values[w - 1] ? planHue.glow : .white.opacity(0.6))
                                        RoundedRectangle(cornerRadius: 3).fill(rest ? .white.opacity(0.22) : planHue.glow.opacity(0.75))
                                            .frame(height: CGFloat(4 + 26 * Double(v) / top))
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                            }
                            .frame(height: 50, alignment: .bottom)
                        }
                        .padding(.vertical, 10)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(planMuscleName(m.muscle)): \(values.map(String.init).joined(separator: ", ")) sorozat hetente")
                    }
                }
                .padding(.horizontal, 18).padding(.vertical, 6).nkGlass(26)
            }
            .padding(.horizontal, 20).padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
    }

    private func styleChoice(_ draft: BlockDraft?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("EDZÉSMÓD · AZ EGÉSZ BLOKKRA").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                ForEach(BlockStyle.allCases, id: \.self) { item in
                    let on = draft?.style == item
                    Button {
                        if draft?.style == .allout, item != .allout { leavingAllout = item }
                        else { withAnimation(.snappy) { model.draft?.style = item } }
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                PlanMark(mark(item), color: on ? NK.ground : planHue.glow, size: 20)
                                Spacer()
                                if on { PlanMark(.check, color: NK.ground, size: 16) }
                            }
                            Text(item.name).nkFont(15, .semibold).foregroundStyle(on ? NK.ground : .white)
                                .lineLimit(1).minimumScaleFactor(0.75)
                            Text(item.line).nkFont(11).foregroundStyle(on ? NK.ground.opacity(0.75) : .white.opacity(0.55))
                                .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading)
                        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(on ? AnyShapeStyle(planHue.glow) : AnyShapeStyle(.white.opacity(0.07))))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            Text(draft?.style == nil
                 ? "Most nincs edzésmód: a gyakorlatok a saját beállításukkal mennek. Ha választasz, az egész blokkra érvényes lesz."
                 : "Egy gyakorlatnál az eltérő beállítás megmarad.")
                .nkFont(11).foregroundStyle(.white.opacity(0.45)).fixedSize(horizontal: false, vertical: true)
        }
        .sensoryFeedback(.selection, trigger: draft?.style)
        .confirmationDialog("A sorozatok kettőn maradnak", isPresented: Binding(get: { leavingAllout != nil }, set: { if !$0 { leavingAllout = nil } }),
                            titleVisibility: .visible) {
            Button("Váltok") { if let s = leavingAllout { withAnimation(.snappy) { model.draft?.style = s } }; leavingAllout = nil }
            Button("Mégsem", role: .cancel) { leavingAllout = nil }
        } message: {
            Text("A „Két sorozat bukásig” módban minden gyakorlat két sorozatos. Váltás után is kettőn maradnak — a Napok fülön vagy az „Igazítsd a sávba” gombbal emelheted vissza őket.")
        }
    }

    /// The block's two switches: techniques, and who approves the week.
    private func switches(_ draft: BlockDraft?) -> some View {
        VStack(spacing: 0) {
            toggleRow(title: "Technikák", text: "Pihenős drop, drop set, myo set és félismétlés a stabil gyakorlatok utolsó sorozatán.",
                      isOn: Binding(get: { model.draft?.techniquesEnabled ?? false }, set: { model.draft?.techniquesEnabled = $0 }))
            Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
            toggleRow(title: "A heti javaslatot én hagyom jóvá",
                      text: "Bekapcsolva hétfőn átnézed, mi változna. Kikapcsolva magától életbe lép.",
                      isOn: Binding(get: { model.draft?.reviewMode == .manual }, set: { model.draft?.reviewMode = $0 ? .manual : .auto }))
        }
        .padding(.horizontal, 18).padding(.vertical, 4).nkGlass(26)
    }

    private func toggleRow(title: String, text: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).nkFont(15, .medium).foregroundStyle(.white)
                Text(text).nkFont(12).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(planHue.glow)
        .padding(.vertical, 12)
    }

    private func phaseName(_ phase: String) -> String {
        switch phase {
        case "MEV": "Alap"
        case "MAV": "Építés"
        case "MRV": "Csúcs"
        case "Deload": "Pihenő"
        default: phase
        }
    }

    /// Does this week carry techniques? The planner's own count when it sends one, else the owner's rule: every
    /// loading week while the switch is on, never the deload.
    private func techniqueWeek(_ w: WirePathWeek, _ draft: BlockDraft?) -> Bool {
        if let n = w.techniques { return n > 0 }
        return draft?.techniquesEnabled == true && w.phase != "Deload"
    }

    private func mark(_ style: BlockStyle) -> PlanMark.Kind {
        switch style {
        case .balanced: .target
        case .volume: .reps
        case .heavy: .weight
        case .allout: .flame
        }
    }
}

fileprivate extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
