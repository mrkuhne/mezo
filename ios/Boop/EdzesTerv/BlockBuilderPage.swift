import SwiftUI
import BoopCore
import BoopDesign

// The block builder (mezo-r36n9.83) — the approved spike's full screen with its own three-way bar, Izmok · Napok ·
// Blokk, on his real running block. Every number comes from the server's evaluator (`BlockBuilderModel`); the draft
// only holds his edits. One primary button: „Igazítsd a sávba" while a muscle is outside its band, else „Mentés".
// The Napok tab is the day editor (mezo-r36n9.116): reorder, add, swap, delete with undo, per-row settings.

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
    /// The day editor's menu, sheets, undo line and drag.
    @State private var edit = DayEditUI()
    /// Today's open workout's day, from the caller: that day's card is read-only.
    let lockedDay: BlockBuilderModel.LockedDay?
    #if DEBUG
    @State private var previewApplied = false
    #endif
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(model: BlockBuilderModel, initialMode: Mode = .izmok, lockedDay: BlockBuilderModel.LockedDay? = nil,
         onClose: @escaping () -> Void) {
        _model = State(initialValue: model)
        _mode = State(initialValue: initialMode)
        self.lockedDay = lockedDay
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
        .onChange(of: lockedDay, initial: true) { model.lockedDay = lockedDay }
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
                        case .napok: BuilderDaysView(model: model, ui: edit, day: $day) { picking = $0 }
                        case .blokk: BuilderBlockView(model: model)
                        }
                    }
                    // Edits made while a save is on its way would be overwritten by the re-read after it.
                    .disabled(model.saveState == .saving)
                }
            }
            .sheet(item: $edit.sheet) { sheet in
                Group {
                    switch sheet {
                    case .settings(let id): DayEditSettingsSheet(model: model, rowId: id)
                    case .add(let d, let muscles, let open):
                        DayEditAddSheet(model: model, day: d, muscles: muscles, open: open) { item, rx in
                            guard let c = item.asCatalog else { return }
                            withAnimation(reduceMotion ? nil : .snappy) { model.draft?.add(day: d, catalog: c, prescription: rx) }
                            edit.structuralEdit(day: d)
                        }
                    case .swap(let id):
                        DayEditSwapSheet(model: model, rowId: id) { item, rx in
                            guard let c = item.asCatalog, let at = model.draft?.locate(id) else { return }
                            withAnimation(reduceMotion ? nil : .snappy) { model.draft?.replace(day: at.day, at: at.index, with: c, prescription: rx) }
                            edit.structuralEdit(day: at.day)
                        }
                    }
                }
                .presentationDetents([.large])
                .presentationBackground(NK.ground)
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
                                challenge: { model.draft?.setChallenge(day: pick.day, exercise: pick.exercise, $0) },
                                recommendation: model.recommendation(day: pick.day, exercise: pick.exercise),
                                aiNote: model.aiNote(ex),
                                onClose: { picking = nil })
            }
        }
        .confirmationDialog("Elveted a változtatásokat?", isPresented: $confirmLeave, titleVisibility: .visible) {
            Button("Elvetem", role: .destructive, action: onClose)
            Button("Maradok", role: .cancel) {}
        } message: {
            Text("Amit itt állítottál, még nincs elmentve.")
        }
        .alert("Függő heti javaslat", isPresented: $edit.confirm) {
            Button("Előbb átnézem", role: .cancel) {}
            Button("Mentem") { save() }
        } message: {
            Text("A heti javaslatban ennél a napnál függő döntés van; a módosított gyakorlatoknál a régi szám marad. Mentsem így?")
        }
        #if DEBUG
        .task(id: model.evaluation != nil) { applyPreviewEdit() }
        #endif
    }

    private func save() {
        edit.menuRow = nil
        Task {
            await model.save()
            if model.saveState == .saved { edit.deleted = nil }
        }
    }

    #if DEBUG
    /// Simulator review of the day editor (boop-ios.md, preview flags): `-previewBlokkEdit
    /// default|menu|settings|add|addOpen|addEmpty|swap|undo|empty|locked|confirm`, `-previewBlokkDay N` for the day page.
    private func applyPreviewEdit() {
        guard !previewApplied, model.evaluation != nil, let draft = model.draft,
              let state = UserDefaults.standard.string(forKey: "previewBlokkEdit") else { return }
        previewApplied = true
        let fallback: Int = switch state {
        case "empty": draft.days.firstIndex { $0.exercises.isEmpty } ?? 0
        case "locked": draft.days.firstIndex { $0.weekday.hasPrefix("Pén") } ?? 0
        default: 0
        }
        let d = UserDefaults.standard.object(forKey: "previewBlokkDay") != nil
            ? max(0, min(draft.days.count - 1, UserDefaults.standard.integer(forKey: "previewBlokkDay"))) : fallback
        day = d
        let rows = draft.days[safe: d]?.exercises ?? []
        switch state {
        case "menu": edit.menuRow = rows[safe: 1]?.id
        case "undo":
            if let row = model.draft?.remove(day: d, at: 2) { edit.deleted = (row, d, 2) }
        case "locked": model.lockedDay = .init(dayId: draft.days[safe: d]?.id, weekday: nil)
        case "confirm": if rows.count > 1 { model.draft?.move(day: d, from: [0], to: 2) }
        default: break
        }
        Task {
            // Sheets and the dialog open after the page is on screen.
            try? await Task.sleep(for: .milliseconds(500))
            switch state {
            case "settings": if let id = rows.first?.id { edit.sheet = .settings(id) }
            case "add": edit.sheet = .add(d, muscles: ["back-mid", "chest-upper"])
            case "addOpen": edit.sheet = .add(d, muscles: ["back-wide", "back-mid", "chest-upper", "chest-mid", "chest-lower"], open: true)
            case "addEmpty": edit.sheet = .add(d)
            case "swap": if let id = rows.first?.id { edit.sheet = .swap(id) }
            case "confirm": edit.confirm = true
            default: break
            }
        }
    }
    #endif

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
        if model.outside.contains(where: { !model.applicableEdits($0.muscle).isEmpty }) { return .align }
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
                case .save: if model.needsReviewConfirm { edit.confirm = true } else { save() }
                case .saving, .done: break
                }
            } label: {
                Group {
                    if p == .saving { ProgressView().tint(NK.ground) }
                    else {
                        // The label must fit the smallest iPhone (mezo-r36n9.118): a shorter wording, then shrink.
                        ViewThatFits(in: .horizontal) {
                            Text(label(p)).nkFont(15, .semibold).lineLimit(1).fixedSize()
                            Text(shortLabel(p)).nkFont(15, .semibold).lineLimit(1).minimumScaleFactor(0.75)
                        }
                        .padding(.horizontal, 12)
                    }
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

    private func shortLabel(_ p: Primary) -> String {
        switch p {
        case .done where model.saveState != .saved: "Nincs változás"
        default: label(p)
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

                    // The proposal addresses exercises by index: hidden until the evaluation matches the line-up again.
                    if !inside, model.indicesFresh {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .top, spacing: 10) {
                                PlanMark(why ? .target : .spark, color: planWarn, size: 18).padding(.top, 1)
                                Text(why ? proposalRule : (model.proposalOnlyOnLockedDay(muscle) ? lockedProposalText : proposalText(m, draft)))
                                    .nkFont(13).foregroundStyle(.white.opacity(0.85))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            HStack(spacing: 16) {
                                if !model.applicableEdits(muscle).isEmpty {
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

    /// Every edit of the proposal falls on the day of today's open workout (ruling R11).
    private var lockedProposalText: String {
        "Ma ennél többet nem igazíthatok: a javaslat a most futó edzésed napját érintené. Utána újra megnézem."
    }

    private func proposalText(_ m: WireMuscleEvaluation, _ draft: BlockDraft) -> String {
        let parts = model.applicableEdits(m.muscle).compactMap { e -> String? in
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
    let ui: DayEditUI
    @Binding var day: Int
    let pick: (TechniquePick) -> Void
    /// The screen's width, measured outside the paging view (a wide row must not stretch a page).
    @State private var pageWidth: CGFloat = 0

    /// 0 = Monday, from the device's calendar: the strip marks today.
    private var todayIndex: Int { (Calendar.current.component(.weekday, from: .now) + 5) % 7 }

    var body: some View {
        let days = model.draft?.days ?? []
        let wide = days.count > 5
        VStack(spacing: 10) {
            HStack(spacing: wide ? 6 : 8) {
                ForEach(Array(days.enumerated()), id: \.element.id) { index, item in
                    let on = index == day
                    let minutes = item.exercises.isEmpty ? 0 : (model.day(index)?.minutesEstimate ?? 0)
                    Button { withAnimation(.snappy) { day = index; ui.menuRow = nil } } label: {
                        VStack(spacing: 5) {
                            Text(String(item.weekday.prefix(3)).uppercased())
                                .nkFont(11, .semibold, design: .monospaced).foregroundStyle(on ? NK.ground : .white.opacity(0.75))
                                .lineLimit(1).minimumScaleFactor(0.7)
                            Text(minutes == 0 ? "–" : "\(minutes)'").nkFont(15, .medium)
                                .foregroundStyle(on ? NK.ground : .white.opacity(minutes == 0 ? 0.45 : 1))
                                .lineLimit(1).minimumScaleFactor(0.7)
                                .contentTransition(.numericText())
                            Capsule().fill(on ? NK.ground.opacity(0.5) : planHue.glow.opacity(minutes == 0 ? 0 : 0.8))
                                .frame(width: CGFloat(min(wide ? 34 : 40, 8 + minutes / 2)), height: 3)
                        }
                        .frame(maxWidth: .infinity, minHeight: 62)
                        .background(RoundedRectangle(cornerRadius: wide ? 16 : 18, style: .continuous).fill(on ? Color.white : .white.opacity(0.1)))
                        .overlay(alignment: .top) {
                            if item.weekdayIndex == todayIndex {
                                Circle().fill(on ? NK.ground : planHue.glow).frame(width: 4, height: 4).padding(.top, 4)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(minutes == 0 ? "\(item.name), pihenőnap" : "\(item.name), kb. \(minutes) perc")
                }
            }
            .padding(.horizontal, wide ? 16 : 20)

            TabView(selection: $day) {
                ForEach(Array(days.enumerated()), id: \.element.id) { index, _ in
                    BuilderDayCard(model: model, ui: ui, index: index, pageWidth: pageWidth, pick: pick).tag(index)
                        .frame(width: pageWidth > 0 ? pageWidth : nil)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .sensoryFeedback(.selection, trigger: day)
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { pageWidth = $0 }
        .onChange(of: day) { ui.menuRow = nil }
    }
}

/// One day of the block as an editor (mezo-r36n9.116, spec §6.1): ≡ handle, name and subtitle, set stepper, ⋯ menu;
/// tap a row for its settings; delete with an undo line; the add row; the empty day; today's running day read-only.
private struct BuilderDayCard: View {
    let model: BlockBuilderModel
    let ui: DayEditUI
    let index: Int
    let pageWidth: CGFloat
    let pick: (TechniquePick) -> Void
    @State private var heights: [String: CGFloat] = [:]
    @State private var dragBase: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The card's side margins and inner padding: the editor row (handle, name, stepper, ⋯) needs the width.
    private static let margin: CGFloat = 14, inset: CGFloat = 18
    /// Below this the stepper goes under the name (spec §6.5: the row's fields wrap on the smaller iPhones) — the
    /// name column keeps ~170 pt next to the 194 pt of handle, stepper and ⋯.
    private var narrow: Bool { pageWidth > 0 && pageWidth - 2 * (Self.margin + Self.inset) < 364 }

    var body: some View {
        if let draft = model.draft, draft.days.indices.contains(index) {
            let day = draft.days[index]
            let evaluation = model.day(index)
            let techniques = draft.techniqueCount(index)
            let locked = model.lockedDayIndex == index
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                  VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(day.name.uppercased()).nkFont(11, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(planHue.glow)
                        Text(day.exercises.isEmpty ? "Pihenőnap" : day.title).nkFont(28, design: .serif).foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                        if !day.exercises.isEmpty {
                            NKFlowRow(spacing: 6, rowSpacing: 6) {
                                PlanPill("kb. \(evaluation?.minutesEstimate ?? 0) perc", mark: .timer)
                                if evaluation?.sportSameDay == true { PlanPill("aznap sport is", mark: .spark) }
                                if techniques > 0 && !locked { PlanPill("\(techniques) technika", color: planHue.glow, mark: .drop) }
                            }
                            .padding(.top, 2)
                        }
                    }
                    if locked { lockLine }
                    if !day.exercises.isEmpty { muscleChips(evaluation) }
                    ForEach(Array((evaluation?.sessionCapWarnings ?? []).enumerated()), id: \.offset) { _, w in
                        Text("\(planMuscleName(w.muscle ?? "")): \(w.sets) sorozat egy edzésen. \(w.cap) fölött már nem ad többet, oszd el két napra.")
                            .nkFont(13).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
                    }
                    if !draft.techniquesEnabled, !locked, day.exercises.contains(where: { $0.stable && $0.judged }) {
                        Text("A technikák ki vannak kapcsolva ebben a blokkban. A Blokk fülön bekapcsolhatod.")
                            .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                    }
                    if day.exercises.isEmpty {
                        Text("Pihenőnap — ha gyakorlatot teszel rá, edzésnap lesz.")
                            .nkFont(15).foregroundStyle(.white.opacity(0.72)).fixedSize(horizontal: false, vertical: true)
                    }
                  }
                  .frame(maxWidth: .infinity, alignment: .leading)
                  .modifier(DayEditMenuBackdrop(ui: ui))
                    rows(draft, day, evaluation, locked: locked)
                }
                .padding(.horizontal, Self.inset).padding(.vertical, 22)
                .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(NK.ground.opacity(0.62)))
                .nkGlass(30)
                .padding(.horizontal, Self.margin).padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .scrollDisabled(ui.dragging != nil)
            // A tap beside the card, too, closes an open ⋯ menu.
            .background { if ui.menuRow != nil { Color.clear.contentShape(Rectangle()).onTapGesture { ui.menuRow = nil } } }
        }
    }

    private var separator: some View { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }

    private func rows(_ draft: BlockDraft, _ day: DraftDay, _ evaluation: WireDayEvaluation?, locked: Bool) -> some View {
        let deleted = ui.deleted.flatMap { $0.day == index ? $0 : nil }
        // Cap warnings address the evaluated line-up: hidden until the fresh evaluation after a move lands.
        let capped = model.indicesFresh ? Set((evaluation?.exerciseCapWarnings ?? []).map(\.exerciseIndex)) : []
        return VStack(spacing: 0) {
            ForEach(Array(day.exercises.enumerated()), id: \.element.id) { e, exercise in
                VStack(spacing: 0) {
                    if let deleted, deleted.index == e { undoLine(deleted.row.name); separator }
                    if e > 0 { separator }
                    row(draft, exercise, e, capped: capped.contains(e), locked: locked)
                }
                .modifier(DayEditMenuBackdrop(ui: ui, active: ui.menuRow != exercise.id))
                .zIndex(ui.dragging == exercise.id || ui.menuRow == exercise.id ? 2 : 0)
            }
            if let deleted, deleted.index >= day.exercises.count {
                if !day.exercises.isEmpty { separator }
                undoLine(deleted.row.name)
            }
            if !locked {
                if !day.exercises.isEmpty || deleted != nil { separator }
                addRow.modifier(DayEditMenuBackdrop(ui: ui))
            }
        }
    }

    private var lockLine: some View {
        HStack(alignment: .top, spacing: 10) {
            PlanMark(.timer, color: planHue.glow, size: 18).padding(.top, 1)
            Text("Ezen a napon most fut az edzésed — utána szerkesztheted.")
                .nkFont(14).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
    }

    private func muscleChips(_ evaluation: WireDayEvaluation?) -> some View {
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
    }

    // MARK: one row

    @ViewBuilder private func row(_ draft: BlockDraft, _ exercise: DraftExercise, _ e: Int, capped: Bool, locked: Bool) -> some View {
        let lifted = ui.dragging == exercise.id
        let menuOpen = ui.menuRow == exercise.id
        Group {
            if narrow {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top, spacing: 8) {
                        if !locked { handle(exercise) }
                        texts(draft, exercise, e, capped: capped, locked: locked)
                        if !locked { dots(exercise) }
                    }
                    stepper(exercise, e, locked: locked).padding(.leading, locked ? 0 : 28)
                }
            } else {
                HStack(spacing: 8) {
                    if !locked { handle(exercise) }
                    texts(draft, exercise, e, capped: capped, locked: locked)
                    stepper(exercise, e, locked: locked)
                    if !locked { dots(exercise) }
                }
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, lifted ? 10 : 0)
        .background {
            if lifted {
                RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(white: 0.19))
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.18), lineWidth: 0.5))
                    .shadow(color: .black.opacity(0.5), radius: 18, y: 10)
            }
        }
        .padding(.horizontal, lifted ? -10 : 0)
        .scaleEffect(lifted && !reduceMotion ? 1.03 : 1)
        .offset(y: lifted ? ui.dragOffset : 0)
        .zIndex(lifted || menuOpen ? 2 : 0)
        .transaction { if lifted { $0.animation = nil } }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { heights[exercise.id] = $0 }
        .overlay(alignment: .topTrailing) {
            if menuOpen { menu(exercise).offset(y: 52).transition(.opacity.combined(with: .scale(scale: 0.95, anchor: .topTrailing))) }
        }
    }

    private func texts(_ draft: BlockDraft, _ exercise: DraftExercise, _ e: Int, capped: Bool, locked: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(exercise.name).nkFont(16, .medium).foregroundStyle(.white.opacity(locked ? 0.7 : 0.95))
                .lineLimit(2).minimumScaleFactor(0.85).fixedSize(horizontal: false, vertical: true)
            subtitle(exercise).nkFont(12).foregroundStyle(capped ? planWarn : .white.opacity(0.5))
            if exercise.judged, draft.techniquesEnabled, !locked {
                // One pill, whatever is chosen: the row keeps its height when he picks (owner, 2026-11-19).
                BuilderTechniqueChip(exercise: exercise) { ui.menuRow = nil; pick(TechniquePick(day: index, exercise: e)) }
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .layoutPriority(1)
        .contentShape(Rectangle())
        .onTapGesture { if !locked { ui.menuRow = nil; ui.sheet = .settings(exercise.id) } }
        .accessibilityAddTraits(locked ? [] : .isButton)
        .accessibilityHint(locked ? "" : "Beállítások")
    }

    /// `<izomrész> · <min>–<max> ism. · <r> tartalék` from the row's own numbers (his edits show at once) — one line
    /// when it fits, else the sub-muscle above the numbers, never a break inside „10–12 ism." (mezo-r36n9.127).
    @ViewBuilder private func subtitle(_ exercise: DraftExercise) -> some View {
        if exercise.counts, exercise.type != "plyo" {
            let reserve = exercise.targetRIR == 0 ? "bukásig" : "\(exercise.targetRIR) tartalék"
            let muscle = SubMuscles.name(exercise.muscleKey)
            let numbers = "\(exercise.repMin)–\(exercise.repMax) ism. · \(reserve)"
            ViewThatFits(in: .horizontal) {
                Text("\(muscle) · \(numbers)").lineLimit(1).fixedSize()
                VStack(alignment: .leading, spacing: 1) {
                    Text(muscle).fixedSize(horizontal: false, vertical: true)
                    Text(numbers).fixedSize(horizontal: false, vertical: true)
                }
            }
        } else {
            Text("ugrás · nem számít a sorozatokba").fixedSize(horizontal: false, vertical: true)
        }
    }

    private func stepper(_ exercise: DraftExercise, _ e: Int, locked: Bool) -> some View {
        PlanSetStepper(value: exercise.sets, name: exercise.name,
                       down: { ui.menuRow = nil; model.draft?.step(day: index, exercise: e, by: -1) },
                       up: { ui.menuRow = nil; model.draft?.step(day: index, exercise: e, by: 1) })
            .disabled(locked)
            .opacity(locked ? 0.4 : 1)
    }

    // MARK: ≡ handle — three drawn bars, no symbol

    private func handle(_ exercise: DraftExercise) -> some View {
        VStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { _ in Capsule().fill(.white.opacity(0.45)).frame(width: 16, height: 2) }
        }
        .frame(width: 20, height: 44)
        .contentShape(Rectangle())
        .highPriorityGesture(drag(exercise))
        .accessibilityLabel("Áthelyezés")
        .accessibilityHint("Húzd fel vagy le a sorrendhez")
        .accessibilityActions {
            Button("Feljebb") { moveBy(exercise, -1) }
            Button("Lejjebb") { moveBy(exercise, 1) }
        }
    }

    /// One place up or down (VoiceOver), with `onMove` meaning.
    private func moveBy(_ exercise: DraftExercise, _ delta: Int) {
        guard let rows = model.draft?.days[safe: index]?.exercises, let i = rows.firstIndex(where: { $0.id == exercise.id }) else { return }
        if delta < 0, i > 0 { model.draft?.move(day: index, from: [i], to: i - 1); ui.structuralEdit(day: index) }
        if delta > 0, i + 1 < rows.count { model.draft?.move(day: index, from: [i], to: i + 2); ui.structuralEdit(day: index) }
    }

    private func drag(_ exercise: DraftExercise) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .global)
            .onChanged { g in
                if ui.dragging != exercise.id { ui.dragging = exercise.id; dragBase = 0; ui.menuRow = nil }
                var offset = g.translation.height - dragBase
                guard let rows = model.draft?.days[safe: index]?.exercises,
                      let i = rows.firstIndex(where: { $0.id == exercise.id }) else { return }
                let animation: Animation? = reduceMotion ? nil : .snappy(duration: 0.22)
                if offset > 0, i + 1 < rows.count, let h = heights[rows[i + 1].id], offset > h / 2 {
                    dragBase += h; offset -= h
                    withAnimation(animation) { model.draft?.move(day: index, from: [i], to: i + 2) }
                    ui.structuralEdit(day: index)
                } else if offset < 0, i > 0, let h = heights[rows[i - 1].id], -offset > h / 2 {
                    dragBase -= h; offset += h
                    withAnimation(animation) { model.draft?.move(day: index, from: [i], to: i - 1) }
                    ui.structuralEdit(day: index)
                }
                ui.dragOffset = offset
            }
            .onEnded { _ in
                withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) { ui.dragging = nil; ui.dragOffset = 0 }
                dragBase = 0
            }
    }

    // MARK: ⋯ menu — three drawn dots, no symbol

    private func dots(_ exercise: DraftExercise) -> some View {
        Button {
            withAnimation(reduceMotion ? nil : .snappy(duration: 0.2)) { ui.menuRow = ui.menuRow == exercise.id ? nil : exercise.id }
        } label: {
            HStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { _ in Circle().fill(.white.opacity(0.75)).frame(width: 4, height: 4) }
            }
            .frame(width: 30, height: 44)
            .background { if ui.menuRow == exercise.id { Circle().fill(.white.opacity(0.14)).frame(width: 32, height: 32) } }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("További lehetőségek")
    }

    private func menu(_ exercise: DraftExercise) -> some View {
        VStack(spacing: 0) {
            menuItem("Csere") { ui.menuRow = nil; ui.sheet = .swap(exercise.id) }
            Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
            menuItem("Beállítások") { ui.menuRow = nil; ui.sheet = .settings(exercise.id) }
            Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
            menuItem("Törlés", color: Color(hex: 0xF2A08A)) {
                withAnimation(reduceMotion ? nil : .snappy) { delete(exercise) }
            }
        }
        .frame(width: 200)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(white: 0.16).opacity(0.97)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.14), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.45), radius: 20, y: 10)
    }

    private func delete(_ exercise: DraftExercise) {
        ui.menuRow = nil
        guard let at = model.draft?.locate(exercise.id), let row = model.draft?.remove(day: at.day, at: at.index) else { return }
        ui.deleted = (row, at.day, at.index)
    }

    private func menuItem(_ title: String, color: Color = .white, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title).nkFont(16, .medium).foregroundStyle(color)
                Spacer()
            }
            .padding(.horizontal, 16).frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: undo + add

    private func undoLine(_ name: String) -> some View {
        HStack(spacing: 6) {
            Text("\(name) törölve").nkFont(14).foregroundStyle(.white.opacity(0.6)).lineLimit(1).truncationMode(.middle)
            Text("·").nkFont(14).foregroundStyle(.white.opacity(0.4))
            Button("visszavonom") {
                withAnimation(reduceMotion ? nil : .snappy) {
                    if let d = ui.deleted { model.draft?.insert(day: d.day, d.row, at: d.index) }
                    ui.deleted = nil
                }
            }
            .buttonStyle(.plain).font(.system(size: 14, weight: .semibold))
            .foregroundStyle(.white).underline()
            Spacer(minLength: 0)
        }
        .frame(minHeight: 48)
        .transition(.opacity)
    }

    private var addRow: some View {
        Button { ui.menuRow = nil; ui.sheet = .add(index) } label: {
            HStack(spacing: 12) {
                Text("+").nkFont(19, .medium).foregroundStyle(planHue.glow)
                    .frame(width: 34, height: 34)
                    .background(Circle().strokeBorder(planHue.glow.opacity(0.6), lineWidth: 1))
                Text("Gyakorlat hozzáadása").nkFont(16, .medium).foregroundStyle(.white.opacity(0.9))
                Spacer()
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// The technique of one exercise as a pill he taps to change — or the reason there is none to pick.
private struct BuilderTechniqueChip: View {
    let exercise: DraftExercise
    /// Opens the picker.
    let open: () -> Void

    var body: some View {
        if !exercise.stable {
            // Not `PlanPill`: its fixed width would push the editor row (handle, stepper, ⋯) past the card.
            HStack(spacing: 5) {
                PlanMark(.shield, color: .white.opacity(0.4), size: 13)
                Text("szabadsúly · nincs technika").nkFont(12, .medium).foregroundStyle(.white.opacity(0.4))
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Capsule().fill(.white.opacity(0.09)))
        } else {
            Button(action: open) {
                HStack(spacing: 5) {
                    PlanMark(exercise.challenge ? .flag : Self.mark(exercise.technique), color: color, size: 13)
                    Text(label).nkFont(12, .medium).foregroundStyle(color).lineLimit(1).truncationMode(.tail)
                    if exercise.pickedByBoop {
                        Text("Boop").nkFont(9, .semibold, design: .monospaced).tracking(0.8)
                            .foregroundStyle(NK.ground)
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(Capsule().fill(planHue.glow))
                    }
                }
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Capsule().fill(.white.opacity(0.09)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(label)\(exercise.pickedByBoop ? ", Boop javaslata" : ""). Koppints a választáshoz.")
        }
    }

    private var label: String {
        switch (exercise.technique, exercise.challenge) {
        case (.none, false): return "+ technika vagy kihívás"
        case (.none, true): return "Kihívás a végén"
        case (let t, false): return t.name
        case (let t, true): return "\(t.name) + kihívás"
        }
    }

    private var color: Color {
        if exercise.technique != .none { return planHue.glow }
        return exercise.challenge ? planWarn : .white.opacity(0.55)
    }

    static func mark(_ technique: SetTechnique) -> PlanMark.Kind {
        switch technique {
        case .none: .keep
        case .restDrop: .timer
        case .drop: .drop
        case .myo, .restPause: .myo
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

