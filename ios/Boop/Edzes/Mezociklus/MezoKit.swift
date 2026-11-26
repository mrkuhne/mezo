import SwiftUI
import BoopCore
import BoopDesign

// The Mezociklus tab's shared pieces (mezo-r36n9.177): the weeks as little bars, the „how much got done" ring, the
// tags, and the one place the tab's sheets and pages are presented — so the room and the simulator preview run the
// same wiring. Look: the accepted spike (`spike/boop-mezociklus`, round 2).

// MARK: - Graphics

/// The weeks of a mezociklus as `NKBlockTimeline` reads them: past / current / future from where it stands.
func mezoTimeline(_ m: MezoCard) -> [NKBlockWeek] {
    m.loads.enumerated().map { i, load in
        let w = i + 1
        let state: NKBlockWeek.State = switch m.kind {
        case .closed: .past
        case .running: w < m.currentWeek ? .past : (w == m.currentWeek ? .current : .future)
        case .planned, .template: .future
        }
        let phase = m.phases.indices.contains(i) ? m.phases[i] : ""
        return NKBlockWeek(week: w, load: load, phase: phase, state: state, isDeload: phase == "Pihenőhét")
    }
}

/// The weeks as little bars — the shape of a mezociklus at a glance. A rest week is a dashed outline.
struct MezoMiniCurve: View {
    let loads: [Double]
    var lit = false
    var current: Int?
    var height: CGFloat = 34

    var body: some View {
        HStack(alignment: .bottom, spacing: 3) {
            ForEach(Array(loads.enumerated()), id: \.offset) { i, load in
                let rest = load < 0.35
                RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                    .fill(rest ? AnyShapeStyle(Color.clear)
                               : AnyShapeStyle(i + 1 == current ? Hue.mozgas.glow : .white.opacity(lit ? 0.75 : 0.4)))
                    .overlay(rest ? RoundedRectangle(cornerRadius: 2.5)
                        .stroke(.white.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [2, 2])) : nil)
                    .frame(height: CGFloat(max(load, 0.1)) * height)
            }
        }
        .frame(height: height, alignment: .bottom)
        .accessibilityHidden(true)
    }
}

/// A ring for „how much of it got done". No value: an empty ring with a dash, never a made-up 0 %.
struct MezoRing: View {
    let value: Double?
    let hue: Hue
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().stroke(.white.opacity(0.12), lineWidth: size * 0.11)
            if let value {
                Circle().trim(from: 0, to: max(0, min(1, value)))
                    .stroke(hue.glow, style: StrokeStyle(lineWidth: size * 0.11, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            Text(value.map { "\(Int(($0 * 100).rounded()))%" } ?? "–")
                .font(.system(size: size * 0.26, weight: .semibold)).foregroundStyle(.white)
                .minimumScaleFactor(0.6).lineLimit(1)
        }
        .frame(width: size, height: size)
        .accessibilityElement()
        .accessibilityLabel(value.map { "\(Int(($0 * 100).rounded())) százalék kész" } ?? "Nincs adat a teljesítésről")
    }
}

struct MezoTag: View {
    let text: String
    var lit = false
    let hue: Hue

    var body: some View {
        Text(text).nkFont(11, .medium).foregroundStyle(lit ? NK.ground : .white.opacity(0.75)).lineLimit(1)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(lit ? AnyShapeStyle(hue.glow) : AnyShapeStyle(.white.opacity(0.1))))
    }
}

/// A full-width pill for a page's bottom bar or a sheet: white for the main move, glass for the other, red for the
/// one that cannot be undone.
struct MezoButton: View {
    enum Style { case primary, secondary, destructive }
    let title: String
    var style: Style = .primary
    var busy = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if busy { ProgressView().tint(style == .primary ? NK.ground : .white) }
                else { Text(title).nkFont(16, .semibold).lineLimit(1).minimumScaleFactor(0.7) }
            }
            .foregroundStyle(style == .primary ? NK.ground : .white)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background {
                switch style {
                case .primary: Capsule().fill(.white)
                case .secondary: Capsule().fill(.white.opacity(0.12)).overlay(Capsule().stroke(.white.opacity(0.2)))
                case .destructive: Capsule().fill(Color(hex: 0xC2414B))
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

/// The body-map heat of a card.
func mezoHeat(_ m: MezoCard) -> [NKBodyHeat] {
    m.heat.map { NKBodyHeat(muscle: $0.key, level: $0.value) }.sorted { $0.muscle < $1.muscle }
}

/// The three most-worked muscle groups, sub-muscles folded into their group („hát", „bicepsz"), hottest first.
func mezoTopGroups(_ m: MezoCard, limit: Int = 3) -> [(name: String, level: Double)] {
    var groups: [String: Double] = [:]
    for (key, level) in m.heat { groups[muscleName(key), default: 0] = max(groups[muscleName(key)] ?? 0, level) }
    return groups.sorted { $0.value == $1.value ? $0.key < $1.key : $0.value > $1.value }
        .prefix(limit).map { (name: $0.key.prefix(1).uppercased() + $0.key.dropFirst(), level: $0.value) }
}

/// „6 hét · felső-alsó".
func mezoLine(_ m: MezoCard) -> String {
    [m.weeks > 0 ? "\(m.weeks) hét" : nil, m.split].compactMap { $0 }.joined(separator: " · ")
}

// MARK: - Routes

/// A full page opened from the tab.
enum MezoCover: Identifiable {
    case list
    case detail(MezoCard)
    /// A closed run's zárójelentés (`blockId`).
    case report(String)

    var id: String {
        switch self {
        case .list: "list"
        case .detail(let c): "detail-\(c.id)"
        case .report(let id): "report-\(id)"
        }
    }
}

/// A sheet over the tab, about the running one.
enum MezoSheet: Identifiable {
    case restart(MezoCard), close(MezoCard)
    var id: String {
        switch self {
        case .restart(let c): "restart-\(c.id)"
        case .close(let c): "close-\(c.id)"
        }
    }
}

/// What the tab and the preview hold to drive the flow.
struct MezoFlowState {
    var cover: MezoCover?
    var sheet: MezoSheet?
    /// „Mentés a sablonba" waiting for its confirmation.
    var saveRunning: MezoCard?
}

/// The builder for a mezociklus that is not the running one — a template, a planned run, a closed run's template.
/// A closed run with no template yet gets one first (the server materializes it; nothing starts).
@MainActor func mezoEditor(for card: MezoCard, plan: PlanClient) async -> BlockBuilderModel? {
    switch card.kind {
    case .template:
        return card.templateId.map { BlockBuilderModel(client: plan, source: .template(id: $0)) }
    case .planned:
        return card.blockId.map { BlockBuilderModel(client: plan, source: .run(id: $0)) }
    case .closed:
        if let t = card.templateId { return BlockBuilderModel(client: plan, source: .template(id: t)) }
        guard let id = card.blockId, let t = try? await plan.rerun(id: id) else { return nil }
        return BlockBuilderModel(client: plan, source: .template(id: t))
    case .running:
        return BlockBuilderModel(client: plan)
    }
}

extension View {
    /// The tab's sheets, pages and the save confirmation. `onChanged` runs after anything that changed the server's
    /// mezociklusok (the room re-reads its block and week).
    func mezoFlow(_ state: Binding<MezoFlowState>, model: MezociklusokModel?, plan: PlanClient?, hue: Hue,
                  toast: Binding<String?>, onChanged: @escaping () -> Void) -> some View {
        modifier(MezoFlowModifier(state: state, model: model, plan: plan, hue: hue, toast: toast, onChanged: onChanged))
    }
}

private struct MezoFlowModifier: ViewModifier {
    @Binding var state: MezoFlowState
    let model: MezociklusokModel?
    let plan: PlanClient?
    let hue: Hue
    @Binding var toast: String?
    let onChanged: () -> Void

    func body(content: Content) -> some View {
        content
            .sheet(item: $state.sheet) { sheet in
                Group {
                    if let model {
                        switch sheet {
                        case .restart(let card):
                            MezoRestartSheet(card: card, model: model, hue: hue,
                                             onDone: { state.sheet = nil; toast = "Újraindítva · 1. hét"; onChanged() },
                                             onCancel: { state.sheet = nil })
                        case .close(let card):
                            MezoCloseSheet(card: card, model: model, hue: hue,
                                           onClosed: { closed in
                                               state.sheet = nil
                                               onChanged()
                                               // The sheet must be gone before a cover can come up over the room.
                                               Task { try? await Task.sleep(for: .milliseconds(450)); state.cover = .report(closed.id) }
                                           },
                                           onCancel: { state.sheet = nil })
                        }
                    }
                }
                .presentationDetents([.large])
                .presentationBackground(NK.ground).presentationCornerRadius(34).presentationDragIndicator(.visible)
            }
            .fullScreenCover(item: $state.cover) { cover in
                if let model, let plan {
                    switch cover {
                    case .list:
                        MezociklusokPage(model: model, plan: plan, hue: hue,
                                         onBack: { state.cover = nil },
                                         onStarted: { message in state.cover = nil; toast = message; onChanged() })
                    case .detail(let card):
                        MezoDetailPage(card: card, model: model, plan: plan, hue: hue,
                                       onBack: { state.cover = nil },
                                       onStarted: { message in state.cover = nil; toast = message; onChanged() })
                    case .report(let id):
                        MezoReportPage(blockId: id, plan: plan, hue: hue) { state.cover = nil }
                    }
                }
            }
            .confirmationDialog("Felülírod a sablont?", isPresented: Binding(
                get: { state.saveRunning != nil }, set: { if !$0 { state.saveRunning = nil } }), titleVisibility: .visible,
                                presenting: state.saveRunning) { card in
                Button("Mentés a sablonba") {
                    Task {
                        if await model?.saveToTemplate(running: card) == true { toast = "A sablon frissült" }
                        else { toast = model?.lastError ?? MezociklusokModel.message(.server) }
                    }
                }
                Button("Mégse", role: .cancel) {}
            } message: { card in
                Text("A „\(card.title)” sablon a mostani állapottal íródik felül. A későbbi indítások már így jönnek.")
            }
    }
}

/// „a 6-ból", „az 5-ből", „a 4-ből" — the article and the suffix follow the number's sound.
func mezoOf(_ n: Int) -> String { "\(evesNumArticle(n)) \(n)-\(evesBolBol(n))" }
