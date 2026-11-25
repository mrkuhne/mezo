import SwiftUI
import BoopCore
import BoopDesign

// 5 · Éves terv létrehozása (mezo-r36n9.113, the approved spike's screen 5): the first Monday, the groups to focus
// twice, the block length — and the server's proposal for them (the strip, the blocks with their dates, what it could
// not fully fit). „Elfogadom" saves it. Every date and block comes from `YearPlanModel.preview`.

struct EvesTervLetrehozas: View {
    let model: YearPlanModel
    /// „Jövő évi terv": the new plan replaces the one ending now.
    var replaceActive = false
    let onClose: () -> Void
    /// The plan is saved; the map shows it.
    let onCreated: () -> Void
    @State private var position = ScrollPosition()

    var body: some View {
        ZStack {
            PlanSky(height: 260)
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    UjBlokkHead(eyebrow: replaceActive ? "ÉVES TERV · JÖVŐ ÉV" : "ÉVES TERV · ÚJ", title: "Egy év, előre",
                                sentence: "Megmondom, melyik blokk mikor jön és mire figyel. A gyakorlatokat mindig a blokk indulásakor rakom össze, a friss állapotodból.",
                                onClose: onClose)
                    start
                    emphasis
                    length
                    proposal
                }
                .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 30)
                .disabled(model.saving)
            }
            .scrollPosition($position)
            .scrollIndicators(.hidden)
            .modifier(EvesInitialScroll(position: $position))
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
                if let e = model.actionError {
                    Text(evesErrorText(e)).nkFont(13).foregroundStyle(planWarn)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 22).padding(.top, 10)
                        .background(NK.ground.opacity(0.95))
                }
                UjBlokkBottomBar(title: model.saving ? "Mentem…" : "Elfogadom", enabled: model.preview != nil && model.previewError == nil && !model.saving) {
                    Task {
                        await model.accept(replaceActive: replaceActive)
                        if model.actionError == nil, case .ready = model.phase { onCreated() }
                    }
                }
            }
        }
        .task { await model.refreshPreview() }
        .preferredColorScheme(.dark)
    }

    // MARK: Kezdés

    private var start: some View {
        VStack(alignment: .leading, spacing: 12) {
            UjBlokkLabel("Kezdés", trailing: "mindig hétfő")
            HStack(spacing: 0) {
                stepButton("chevron.left", "Egy héttel korábban", enabled: model.startMonday > evesTodayMonday(Date())) {
                    model.stepStart(by: -1)
                }
                Spacer(minLength: 4)
                VStack(spacing: 1) {
                    Text(evesDate(model.startMonday)).nkFont(20, .medium).foregroundStyle(.white)
                    Text("\(evesParts(model.startMonday).map { "\($0.year)" } ?? "") · hétfő")
                        .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                }
                .accessibilityElement(children: .combine)
                Spacer(minLength: 4)
                stepButton("chevron.right", "Egy héttel később", enabled: true) { model.stepStart(by: 1) }
            }
            .padding(6)
            .background(Capsule().fill(.white.opacity(0.07)))
        }
    }

    private func stepButton(_ symbol: String, _ label: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(enabled ? 1 : 0.3))
                .frame(width: 44, height: 44).background(Circle().fill(.white.opacity(enabled ? 0.1 : 0.04)))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(label)
    }

    // MARK: Hangsúly

    private var emphasis: some View {
        VStack(alignment: .leading, spacing: 12) {
            UjBlokkLabel("Mit szeretnél idén jobban fejleszteni?")
            NKFlowRow(spacing: 8, rowSpacing: 8) {
                ForEach(evesGroupOrder, id: \.self) { g in
                    EvesChip(text: evesMuscle(g), on: model.emphasis.contains(g)) {
                        if model.emphasis.contains(g) { model.emphasis.remove(g) } else { model.emphasis.insert(g) }
                    }
                }
            }
            Text("Amit kiválasztasz, azt kétszer teszem fókuszba; minden más izom legalább egyszer.")
                .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Blokkhossz

    private var length: some View {
        VStack(alignment: .leading, spacing: 12) {
            UjBlokkLabel("Blokkhossz", trailing: "\(model.blockWeeks - 1) + 1 könnyítő hét")
            HStack(spacing: 6) {
                ForEach(Array(YearPlanModel.blockWeekRange), id: \.self) { w in
                    UjBlokkChoice(text: "\(w)", on: model.blockWeeks == w, sub: "hét") { model.blockWeeks = w }
                }
            }
        }
    }

    // MARK: Így nézne ki

    @ViewBuilder private var proposal: some View {
        VStack(alignment: .leading, spacing: 14) {
            UjBlokkLabel("Így nézne ki", trailing: model.preview.map { "\(52 + $0.overrunWeeks) hét" } ?? "52 hét")
            if let plan = model.preview {
                VStack(alignment: .leading, spacing: 16) {
                    YearStrip(plan: plan, showsCurrent: false)
                    Text("felül a felsőtest-blokkok, alul a láb-blokkok · üres: könnyítő hét")
                        .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45)).fixedSize(horizontal: false, vertical: true)
                    VStack(spacing: 0) {
                        ForEach(evesRows(plan)) { row in
                            HStack(spacing: 10) {
                                Text(row.ordinalText).nkFont(11, .semibold, design: .monospaced)
                                    .foregroundStyle(planHue.glow).frame(width: 16, alignment: .leading)
                                Text(row.title).nkFont(14).foregroundStyle(.white.opacity(0.9)).lineLimit(1).minimumScaleFactor(0.85)
                                Spacer(minLength: 6)
                                Text(evesDate(row.start)).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5)).fixedSize()
                            }
                            .padding(.vertical, 7)
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
                .padding(16)
                .nkGlass(24)
                .opacity(model.previewError == nil ? 1 : 0.5)

                let notes = plan.relaxed.compactMap(evesNoteText) + evesWarningLines(plan)
                if !notes.isEmpty {
                    HStack(alignment: .top, spacing: 10) {
                        PlanMark(.keep, color: planWarn, size: 16).padding(.top, 2)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Amit nem tudtam teljesen").nkFont(14, .semibold).foregroundStyle(.white)
                            ForEach(notes, id: \.self) { n in
                                Text(n).nkFont(13).foregroundStyle(.white.opacity(0.78)).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(planWarn.opacity(0.1)))
                }
            } else if let e = model.previewError {
                UjBlokkNotice(title: "Most nem tudom kirakni az évet", text: evesErrorText(e)) {
                    Task { await model.refreshPreview() }
                }
            } else {
                UjBlokkNotice(title: "Kirakom az évet", text: "A blokkokat és a dátumaikat a szerver számolja ki.", loading: true)
            }
            if model.preview != nil, let e = model.previewError {
                Text(evesErrorText(e)).nkFont(12.5).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: - Shared pieces of the year view

/// A row of the year's list: a block, or the buffer weeks between the last block and the consolidation.
struct EvesRow: Identifiable {
    enum Kind { case block(WireYearBlock), buffer }
    let kind: Kind
    let start: String
    let end: String
    let weeks: Int
    let id: String

    var block: WireYearBlock? { if case .block(let b) = kind { b } else { nil } }
    var title: String { block.map(evesFocusTitle) ?? "Tartalék hetek" }
    var ordinalText: String { block.flatMap { $0.isConsolidation ? nil : "\($0.ordinal)" } ?? "·" }
    var kindText: String { block.map(evesKindText) ?? "TARTALÉK" }
}

/// The year's rows in order: the loading blocks, the buffer (when there is one), the consolidation.
func evesRows(_ plan: WireYearPlan) -> [EvesRow] {
    let loading = plan.blocks.filter { !$0.isConsolidation }.map {
        EvesRow(kind: .block($0), start: $0.plannedStart, end: $0.lastDay, weeks: $0.weeks, id: $0.id ?? "o\($0.ordinal)")
    }
    let closing = plan.blocks.filter(\.isConsolidation).map {
        EvesRow(kind: .block($0), start: $0.plannedStart, end: $0.lastDay, weeks: $0.weeks, id: $0.id ?? "o\($0.ordinal)")
    }
    var buffer: [EvesRow] = []
    if plan.bufferWeeks > 0, let s = plan.bufferStart {
        let end = evesAdding(days: plan.bufferWeeks * 7 - 1, to: s) ?? s
        buffer = [EvesRow(kind: .buffer, start: s, end: end, weeks: plan.bufferWeeks, id: "buffer")]
    }
    return loading + buffer + closing
}

/// A muscle chip (year emphasis, block focus): lit when on.
struct EvesChip: View {
    let text: String
    let on: Bool
    var enabled = true
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if on { PlanMark(.check, color: NK.ground, size: 11) }
                Text(text).nkFont(14, .medium).foregroundStyle(on ? NK.ground : .white.opacity(0.85)).lineLimit(1).fixedSize()
            }
            .padding(.horizontal, 14).frame(minHeight: 38)
            .background(Capsule().fill(on ? planHue.glow : .white.opacity(0.09)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// One line of the map: a drawn mark in the tone's colour and the sentence.
struct EvesLineView: View {
    let line: EvesLine
    var body: some View {
        UjBlokkWhyLine(tone: line.tone.planTone, text: line.text)
    }
}

extension EvesTone {
    var planTone: PlanTone {
        switch self {
        case .good: .good
        case .neutral: .neutral
        case .warn: .warn
        }
    }
}

/// Opens a long screen scrolled (`-previewEvesTervScroll Y`), for the simulator captures.
struct EvesInitialScroll: ViewModifier {
    @Binding var position: ScrollPosition
    func body(content: Content) -> some View {
        #if DEBUG
        content.task {
            let y = UserDefaults.standard.double(forKey: "previewEvesTervScroll")
            guard y > 0 else { return }
            try? await Task.sleep(for: .milliseconds(450))
            position.scrollTo(y: y)
        }
        #else
        content
        #endif
    }
}
