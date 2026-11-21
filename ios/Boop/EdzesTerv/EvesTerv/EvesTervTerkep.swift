import SwiftUI
import BoopCore
import BoopDesign

// 6 · Éves térkép (mezo-r36n9.113, the approved spike's screen 6) and the page that holds the year view: the map, or
// the create screen when he has no plan yet (and for „Jövő évi terv"). Presented by the Edzés room at page level
// (boop-ios.md §9); the block sheet (6b) hangs off this page. Additions inside the spike's components (plan, controller
// call 8): the unlinked-block banner, the year-review card during the consolidation, and a quiet „Éves terv lezárása"
// at the bottom.

struct EvesTervPage: View {
    enum Step: Equatable { case map, create(replace: Bool) }

    let model: YearPlanModel
    let onClose: () -> Void
    /// The block whose sheet is open when the page appears (a simulator review state).
    var sheetBlock: String? = nil
    @State private var step: Step
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(model: YearPlanModel, step: Step = .map, sheetBlock: String? = nil, onClose: @escaping () -> Void) {
        self.model = model
        self.onClose = onClose
        self.sheetBlock = sheetBlock
        _step = State(initialValue: step)
    }

    var body: some View {
        Group {
            switch step {
            case .map:
                EvesTervTerkep(model: model, onClose: onClose,
                               onCreate: { replace in
                                   if replace, case .ready(let plan, _) = model.phase {
                                       model.startMonday = evesNextYearStart(plan, today: Date())
                                   }
                                   step = .create(replace: replace)
                               }, sheetBlock: sheetBlock)
                    .transition(.opacity)
            case .create(let replace):
                EvesTervLetrehozas(model: model, replaceActive: replace,
                                   onClose: { if case .ready = model.phase { step = .map } else { onClose() } },
                                   onCreated: { step = .map })
                    .transition(.opacity)
            }
        }
        .animation(reduceMotion ? nil : .smooth(duration: 0.3), value: step)
        .preferredColorScheme(.dark)
    }
}

struct EvesTervTerkep: View {
    let model: YearPlanModel
    let onClose: () -> Void
    /// Opens the create screen; `true` = „Jövő évi terv" (replaces the plan ending now).
    let onCreate: (_ replace: Bool) -> Void
    @State private var sheetBlock: String?
    @State private var confirmArchive = false
    @State private var position = ScrollPosition()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(model: YearPlanModel, onClose: @escaping () -> Void, onCreate: @escaping (_ replace: Bool) -> Void,
         sheetBlock: String? = nil) {
        self.model = model
        self.onClose = onClose
        self.onCreate = onCreate
        _sheetBlock = State(initialValue: sheetBlock)
    }

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                PlanStateView(title: "Előveszem az éves tervedet", text: "Egy pillanat.", loading: true, onClose: onClose)
            case .none:
                PlanStateView(title: "Még nincs éves terved",
                              text: "Egy évre előre elosztom a blokkokat: melyik mikor jön, és melyik izmot teszi fókuszba. Minden izom sorra kerül.",
                              mark: .calendar, action: ("Éves terv készítése", { onCreate(false) }), onClose: onClose)
            case .failed(let e):
                PlanStateView(title: "Most nem érem el az éves tervedet", text: evesErrorText(e), mark: .shield,
                              action: ("Újra", { Task { await model.load() } }), onClose: onClose)
            case .ready(let plan, let age):
                map(plan, age: age)
            }
        }
        .task { if model.phase == .loading { await model.load() } }
        // At page level, not inside the ready branch: a phase change (a reload, a failed edit) never closes them.
        .sheet(item: Binding(get: { sheetBlock.map(EvesSheetID.init) }, set: { sheetBlock = $0?.id })) { s in
            EvesTervBlokkSheet(model: model, blockId: s.id)
                .presentationDetents([.large])
                .presentationBackground(NK.ground)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog("Lezárod az éves tervet?", isPresented: $confirmArchive, titleVisibility: .visible) {
            Button("Lezárom", role: .destructive) { Task { await model.archive() } }
            Button("Mégsem", role: .cancel) {}
        } message: {
            Text("A blokkjaid és az edzéseid megmaradnak, csak a térkép tűnik el. Később újat készíthetsz.")
        }
        .preferredColorScheme(.dark)
    }

    // MARK: the map

    private func map(_ plan: WireYearPlan, age: String?) -> some View {
        ZStack {
            PlanSky(height: 260)
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    UjBlokkHead(eyebrow: "ÉVES TERV · \(evesYears(plan))", title: evesHeadTitle(plan),
                                sentence: evesHeadSentence(plan), onClose: onClose)
                    if let age {
                        Text(age.uppercased()).nkFont(10, .medium, design: .monospaced).tracking(1.3)
                            .foregroundStyle(.white.opacity(0.55))
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Capsule().fill(.white.opacity(0.08)))
                            .accessibilityLabel("Régebbi adat: \(age)")
                    }
                    if let e = model.actionError {
                        Text(evesErrorText(e)).nkFont(13.5).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
                    }

                    if evesInClosing(plan) { review(plan) }
                    if let unlinked = plan.unlinkedRunning { unlinkedBanner(unlinked, plan: plan) }

                    YearStrip(plan: plan)
                        .padding(16)
                        .nkGlass(24)

                    lines(plan)
                    noFocusCards(plan)
                    blocks(plan)
                    archiveButton
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 40)
                .animation(reduceMotion ? nil : .smooth(duration: 0.3), value: plan)
            }
            .scrollPosition($position)
            .scrollIndicators(.hidden)
            .modifier(EvesInitialScroll(position: $position))
        }
    }

    private func lines(_ plan: WireYearPlan) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(evesMapLines(plan), id: \.self) { EvesLineView(line: $0) }
            ForEach(evesWarningLines(plan), id: \.self) { EvesLineView(line: EvesLine(tone: .warn, text: $0)) }
        }
        .padding(.horizontal, 4)
    }

    /// `no_focus_this_year`: a group no block focuses any more, with the server's suggestion as one tap.
    @ViewBuilder private func noFocusCards(_ plan: WireYearPlan) -> some View {
        let notes = plan.warnings.filter { $0.code == "no_focus_this_year" && $0.group != nil }
        ForEach(notes, id: \.self) { n in
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 10) {
                    PlanMark(.flame, color: planWarn, size: 18).padding(.top, 1)
                    Text(evesNoFocusTitle(n) ?? "").nkFont(15, .semibold).foregroundStyle(planWarn)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let label = evesNoFocusAction(n, plan: plan), let id = n.blockId, let focus = evesNoFocusNewFocus(n, plan: plan) {
                    Button { Task { await model.setFocus(id, focus) } } label: {
                        Text(label).nkFont(14, .semibold).foregroundStyle(planWarn).multilineTextAlignment(.leading)
                            .padding(.horizontal, 18).padding(.vertical, 10).frame(minHeight: 44)
                            .background(Capsule().stroke(planWarn.opacity(0.6), lineWidth: 1))
                            .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(model.saving)
                } else {
                    Text("Egész évben Tartáson marad.").nkFont(13).foregroundStyle(.white.opacity(0.8))
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(planWarn.opacity(0.1)))
        }
    }

    // MARK: the list

    private func blocks(_ plan: WireYearPlan) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            UjBlokkLabel("Blokkok", trailing: "koppints egyre")
            VStack(spacing: 0) {
                ForEach(Array(evesRows(plan).enumerated()), id: \.element.id) { i, row in
                    if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    let tappable = row.block.map { !$0.isConsolidation && $0.id != nil } ?? false
                    Button { if tappable { sheetBlock = row.block?.id } } label: { rowView(row, plan: plan) }
                        .buttonStyle(.plain)
                        .disabled(!tappable)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 4)
            .nkGlass(24)
        }
    }

    private func rowView(_ row: EvesRow, plan: WireYearPlan) -> some View {
        let status = row.block.map { EvesStatus($0, plan: plan) }
        let isRunning = status?.isRunning ?? false
        let done = status == .done
        let skipped = status == .skipped
        let loading = row.block.map { !$0.isConsolidation } ?? false
        return HStack(spacing: 12) {
            ZStack {
                Circle().fill(isRunning ? planHue.glow : .white.opacity(done ? 0.14 : 0.07))
                if done {
                    PlanMark(.check, color: .white.opacity(0.8), size: 13)
                } else if loading, let o = row.block?.ordinal {
                    Text("\(o)").nkFont(13, .semibold, design: .monospaced).foregroundStyle(isRunning ? NK.ground : .white.opacity(skipped ? 0.4 : 0.8))
                } else {
                    PlanMark(row.block?.isConsolidation == true ? .keep : .feather, color: .white.opacity(0.6), size: 13)
                }
            }
            .frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 3) {
                Text(row.title).nkFont(16, design: .serif).foregroundStyle(.white.opacity(done || skipped || !loading ? 0.6 : 1))
                    .strikethrough(skipped, color: .white.opacity(0.4))
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(evesDate(row.start)) – \(evesDate(row.end)) · \(row.kindText)").nkFont(10.5, design: .monospaced)
                    .foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 6)
            if loading, let status {
                Text(status.text).nkFont(11, .medium)
                    .foregroundStyle(isRunning ? NK.ground : (status == .next ? planHue.glow : .white.opacity(done || skipped ? 0.5 : 0.6)))
                    .lineLimit(1).fixedSize()
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(Capsule().fill(isRunning ? planHue.glow : .white.opacity(status == .next ? 0.1 : 0.05)))
            } else {
                Text("\(row.weeks) hét").nkFont(11, .medium).foregroundStyle(.white.opacity(0.5)).fixedSize()
            }
        }
        .padding(.vertical, 11)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    // MARK: additions

    /// A running block that belongs to no block of the year: one tap makes it the next planned block.
    private func unlinkedBanner(_ u: WireYearUnlinked, plan: WireYearPlan) -> some View {
        let target = plan.blocks.first { $0.status == "planned" && !$0.isConsolidation && $0.id != nil }
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                PlanMark(.flag, color: planWarn, size: 18).padding(.top, 1)
                VStack(alignment: .leading, spacing: 4) {
                    Text("A futó blokkod nincs az éves tervben").nkFont(15, .semibold).foregroundStyle(planWarn)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(evesUnlinkedText(u))
                        .nkFont(13).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                }
            }
            if let id = target?.id {
                Button { Task { await model.linkRunning(id) } } label: {
                    Text("Hozzákötöm a következő blokkhoz").nkFont(14, .semibold).foregroundStyle(planWarn)
                        .padding(.horizontal, 18).frame(minHeight: 44)
                        .background(Capsule().stroke(planWarn.opacity(0.6), lineWidth: 1))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(model.saving)
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(planWarn.opacity(0.1)))
    }

    /// The year's last weeks: what it brought, and the next year.
    private func review(_ plan: WireYearPlan) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AZ ÉV VÉGE").nkFont(10, .medium, design: .monospaced).tracking(1.4).foregroundStyle(planHue.glow)
            Text(evesReviewLine(plan.review)).nkFont(24, design: .serif).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            if !plan.review.focused.isEmpty {
                reviewLine("Fókuszt kapott", evesPlainList(plan.review.focused), tone: .good)
            }
            if !plan.review.unfocused.isEmpty {
                reviewLine("Nem kapott fókuszt", evesPlainList(plan.review.unfocused), tone: .neutral)
            }
            Button { onCreate(true) } label: {
                Text("Jövő évi terv").nkFont(16, .semibold).foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Capsule().fill(planHue.glow))
                    .contentShape(Capsule())
            }
            .buttonStyle(PressStyle())
            .disabled(model.saving)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(24)
    }

    private func reviewLine(_ label: String, _ text: String, tone: PlanTone) -> some View {
        HStack(alignment: .top, spacing: 9) {
            PlanMark(tone.mark, color: tone.color, size: 14).padding(.top, 2)
            (Text("\(label): ").bold() + Text(text))
                .nkFont(13.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
        }
    }

    private var archiveButton: some View {
        Button { confirmArchive = true } label: {
            Text("Éves terv lezárása").nkFont(14, .medium).foregroundStyle(.white.opacity(0.55))
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(model.saving)
        .padding(.top, 4)
    }
}

/// The sheet's item: a block id.
struct EvesSheetID: Identifiable, Equatable {
    let id: String
}
