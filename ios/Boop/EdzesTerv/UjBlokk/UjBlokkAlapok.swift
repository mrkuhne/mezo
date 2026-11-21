import SwiftUI
import BoopCore
import BoopDesign

// Alapok (spike screens 2 / 2b): how many weeks, how long a session may last, the season's training days, and the
// muscle tiers — each raise checked against the server's heti keret; a raise that does not fit says why, inline.

struct UjBlokkAlapok: View {
    let model: NewBlockModel
    @Binding var blocked: UjBlokkBlocked?
    let onClose: () -> Void
    let onNext: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The muscles he sets a tier for, in body order: the landmark groups the plan is built from (core has no band).
    static let muscles = ["back", "chest", "shoulder", "biceps", "triceps", "quad", "ham", "glute", "calf"]

    var body: some View {
        ZStack {
            PlanSky(height: 260)
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    UjBlokkHead(eyebrow: "ÚJ BLOKK · 1/2", title: "Alapok", sentence: "Három dolog kell, a többit én számolom.",
                                onClose: onClose)

                    VStack(alignment: .leading, spacing: 12) {
                        UjBlokkLabel("Hány hét", trailing: "az utolsó könnyítő")
                        HStack(spacing: 6) {
                            ForEach(Array(NewBlockModel.weekRange), id: \.self) { w in
                                UjBlokkChoice(text: "\(w)", on: model.weeks == w, sub: "hét") { model.weeks = w }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        UjBlokkLabel("Meddig tarthat egy edzés")
                        HStack(spacing: 6) {
                            // A fix may set minutes outside the choices (e.g. 105): it shows as its own, selected pill.
                            ForEach(model.minuteOptions, id: \.self) { m in
                                UjBlokkChoice(text: "\(m)", on: model.minutes == m, sub: "perc") { model.minutes = m; blocked = nil }
                            }
                        }
                        Text("Pihenővel, bemelegítéssel együtt. Ha egy lehetőség hosszabb, megmutatom, de nem vágok le a heti sorozatokból.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        UjBlokkLabel("Edzésnapok")
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("az évadodból:").nkFont(14).foregroundStyle(.white.opacity(0.6))
                            Text(daysLine).nkFont(20, .medium).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
                        }
                        Text("Az Évad oldalon állíthatod át; amíg a blokk fut, ezek a napok maradnak.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                    .nkGlass(22)

                    VStack(alignment: .leading, spacing: 12) {
                        UjBlokkLabel("Izmok", trailing: "mire figyeljünk")
                        budget
                        VStack(spacing: 0) {
                            ForEach(Array(Self.muscles.enumerated()), id: \.element) { i, m in
                                if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                                VStack(alignment: .leading, spacing: 8) {
                                    UjBlokkTierRow(name: planMuscleName(m), tier: MuscleTier(wire: model.tier(m)),
                                                   disabled: { model.check(m, to: $0.rawValue) != .ok }) { set(m, $0) }
                                    if let b = blocked, b.muscle == m {
                                        HStack(alignment: .top, spacing: 8) {
                                            PlanMark(.shield, color: planWarn, size: 14).padding(.top, 2)
                                            Text(b.text).nkFont(13).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
                                        }
                                        .transition(.opacity)
                                    }
                                }
                                .padding(.vertical, 10)
                            }
                        }
                        .animation(reduceMotion ? nil : .snappy, value: blocked)
                        .padding(.horizontal, 16).padding(.vertical, 6)
                        .nkGlass(22)
                        Text("Hangsúly: itt építünk a legtöbbet. Építés: rendesen nő. Tartás: megtartja, amit eddig felépítettél.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
            .modifier(PlanInitialScroll())
        }
        .sensoryFeedback(.selection, trigger: model.tiers)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            UjBlokkBottomBar(title: "Mutasd a lehetőségeket", action: onNext)
        }
    }

    /// „H · K · Cs · P" — the season's days in week order.
    private var daysLine: String {
        model.days.compactMap { planWeekdayIndex($0).map { planWeekdayShort[$0] } }.joined(separator: " · ")
    }

    private func set(_ muscle: String, _ tier: MuscleTier) {
        let result = model.setTier(muscle, tier.rawValue)
        let max = model.intakeBudget?.emphasizeMax ?? 2
        blocked = planRaiseText(result, emphasizeMax: max).map { UjBlokkBlocked(muscle: muscle, text: $0) }
    }

    @ViewBuilder private var budget: some View {
        let evaluation: WireEvaluation? = { if case .candidates(let c) = model.phase { c.lead?.evaluation } else { nil } }()
        if let data = PlanBudget(intake: model.intakeBudget, evaluation: evaluation, tier: { MuscleTier(wire: model.tier($0)) },
                                 minutes: model.minutes, days: model.days.count,
                                 emphasized: model.tiers.values.filter { $0 == "emphasize" }.count) {
            PlanBudgetCard(data: data)
        } else if case .failed(let e) = model.phase {
            UjBlokkNotice(title: "A keretet most nem érem el", text: planErrorText(e)) { Task { await model.retry() } }
        } else {
            HStack(spacing: 10) {
                ProgressView().tint(.white)
                Text("Számolom a heti keretet").nkFont(13).foregroundStyle(.white.opacity(0.6))
            }
            .padding(16).frame(maxWidth: .infinity, minHeight: 86, alignment: .leading)
            .nkGlass(22)
        }
    }
}

/// One muscle and the three-way tier switch: a fixed name column, so every row lines up at any width.
struct UjBlokkTierRow: View {
    let name: String
    let tier: MuscleTier
    var disabled: (MuscleTier) -> Bool = { _ in false }
    let set: (MuscleTier) -> Void

    var body: some View {
        HStack(spacing: 10) {
            Text(name).nkFont(15).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
                .frame(width: 96, alignment: .leading)
            PlanTierSwitch(tier: tier, compact: true, disabled: disabled, set: set).frame(maxWidth: 240)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }
}

/// Tartás · Építés · Hangsúly as one switch, the chosen one lit in its own colour; a raise the budget does not allow
/// is dimmed (a tap still answers, with the reason).
struct PlanTierSwitch: View {
    let tier: MuscleTier
    var compact = false
    var disabled: (MuscleTier) -> Bool = { _ in false }
    let set: (MuscleTier) -> Void
    private let all: [MuscleTier] = [.maintain, .grow, .emphasize]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 4) {
            ForEach(all, id: \.self) { item in
                let off = item != tier && disabled(item)
                Button { withAnimation(reduceMotion ? nil : .snappy) { set(item) } } label: {
                    Text(item.hungarian).nkFont(compact ? 12.5 : 13, .semibold)
                        .foregroundStyle(item == tier ? NK.ground : .white.opacity(off ? 0.22 : 0.7))
                        .lineLimit(1).minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, minHeight: compact ? 34 : 36)
                        .background { if item == tier { Capsule().fill(item == .maintain ? .white : planTierColor(item)) } }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(item == tier ? .isSelected : [])
                .accessibilityHint(off ? "Most nem fér bele a heti keretbe" : "")
            }
        }
        .padding(compact ? 3 : 4)
        .background(Capsule().fill(.white.opacity(0.08)))
    }
}

#if DEBUG
/// Opens a long screen scrolled (`-previewUjBlokkScroll Y`), for the screenshots.
struct PlanInitialScroll: ViewModifier {
    @State private var position = ScrollPosition()
    func body(content: Content) -> some View {
        content
            .scrollPosition($position)
            .task {
                let y = UserDefaults.standard.double(forKey: "previewUjBlokkScroll")
                guard y > 0 else { return }
                try? await Task.sleep(for: .milliseconds(600))
                position.scrollTo(y: y)
            }
    }
}
#else
struct PlanInitialScroll: ViewModifier { func body(content: Content) -> some View { content } }
#endif
