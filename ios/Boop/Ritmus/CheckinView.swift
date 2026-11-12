import SwiftUI
import BoopCore
import BoopDesign

/// The full-screen check-in (spec §5.2, approved spike `RitmusCheckin.swift`): a painted sky in the item's hue, a mono
/// label, the serif question, and a large living orb whose liquid is the answer — swipe up or down on it (26 pt a step,
/// a soft haptic each), *Tovább* keeps it, *Kihagyom* leaves it out, "Most csak ennyi" (from the second item) saves
/// what is answered. After saving it turns into the payoff (`CheckinDone`). Presented as a full-screen cover at page
/// level (boop-ios.md §9).
struct CheckinView: View {
    let env: RitmusEnvironment
    let onClose: () -> Void
    @State private var flow: CheckinFlow
    @State private var motion = OrbMotion()
    @State private var swiping = false

    init(env: RitmusEnvironment, onClose: @escaping () -> Void) {
        self.env = env; self.onClose = onClose
        _flow = State(initialValue: CheckinFlow(env: env))
    }

    var body: some View {
        Group {
            if flow.saved != nil { CheckinDone(env: env, flow: flow, motion: motion, onClose: onClose).transition(.opacity) }
            else { question }
        }
        .animation(.easeInOut(duration: 0.5), value: flow.saved != nil)
        .preferredColorScheme(.dark)
        .onDisappear { motion.stop() }
        .task {
            #if DEBUG
            if UserDefaults.standard.string(forKey: "previewOpen") == "checkinDone" { await flow.previewSave(); return }
            #endif
            await env.refreshPlans(flow.date)
            flow.refreshQuestions()
        }
    }

    // MARK: - The question

    private var q: CheckInQuestion { flow.current }
    private var hue: Hue { Self.hue(for: q) }

    private var question: some View {
        ZStack {
            NKGround(hue: hue)
            PaintedLandscape(hue: hue).ignoresSafeArea()
                .overlay(LinearGradient(colors: [.clear, NK.ground.opacity(0.9)], startPoint: .center, endPoint: .bottom).ignoresSafeArea())
                .animation(.easeInOut(duration: 0.6), value: flow.index)
            VStack(spacing: 0) {
                topBar
                header
                Spacer(minLength: 12)
                answerArea
                Spacer(minLength: 12)
                if let problem = flow.saveProblem {
                    Text(problem).nkFont(13).foregroundStyle(Color(hex: 0xF7A8C4)).multilineTextAlignment(.center)
                        .padding(.horizontal, 24).padding(.bottom, 10)
                }
                buttons
            }
        }
    }

    private var topBar: some View {
        HStack {
            Button(action: onClose) {
                Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Bezárom")
            Spacer()
            HStack(spacing: 6) {
                ForEach(flow.questions.indices, id: \.self) { k in
                    Capsule().fill(.white.opacity(k <= flow.index ? 0.95 : 0.3)).frame(width: k == flow.index ? 22 : 7, height: 7)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: flow.index)
            .accessibilityElement()
            .accessibilityLabel("\(flow.index + 1). kérdés a \(flow.questions.count)-ból")
            Spacer()
            Group {
                if flow.canQuickExit {
                    Button { Task { await flow.quickExit() } } label: {
                        Text("Most csak ennyi").nkFont(13, .semibold).foregroundStyle(.white).lineLimit(1)
                            .padding(.horizontal, 12).frame(height: 34).glassEffect(.clear.interactive(), in: .capsule)
                    }
                    .buttonStyle(.plain)
                    .disabled(flow.saving)
                } else {
                    Text(flow.momentLabel).nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.75)).fixedSize()
                }
            }
            .frame(width: 130, alignment: .trailing)
        }
        .padding(.horizontal, 16).padding(.top, 8)
    }

    private var header: some View {
        VStack(spacing: 10) {
            Text(q.label.uppercased()).nkFont(12, .medium, design: .monospaced).tracking(1.6).foregroundStyle(.white.opacity(0.8))
            Text(q.question).nkFont(34, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center)
                .frame(minHeight: 90)
                .fixedSize(horizontal: false, vertical: true)
            if let why = q.why {
                HStack(alignment: .top, spacing: 8) {
                    StillOrb(palette: Hue.forma.orb, size: 18, level: 0.8)
                    Text(why).nkFont(14).foregroundStyle(.white.opacity(0.78)).multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 6)
            }
            if flow.index == 0, let notice = flow.overwriteNotice {
                Text(notice).nkFont(14).foregroundStyle(.white.opacity(0.75)).multilineTextAlignment(.center)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(Capsule().fill(.white.opacity(0.08)))
            }
        }
        .padding(.horizontal, 28).padding(.top, 30)
        .id(flow.index).transition(.opacity)
    }

    @ViewBuilder private var answerArea: some View {
        switch q.kind {
        case .pain where flow.painStage == .gate:
            HStack(spacing: 12) {
                NKPill("Nem", primary: false) { Task { await flow.answerPain(false) } }
                NKPill("Igen") { Task { await flow.answerPain(true) } }
            }
            .padding(.horizontal, 28)
        case .pain:
            VStack(spacing: 14) {
                chips
                orb(size: 170)
                hint("Mennyire fáj? · húzd fel vagy le")
            }
        case .craving:
            VStack(spacing: 14) {
                orb(size: 190)
                hint(hintText)
                chips
            }
        case .scale:
            VStack(spacing: 4) {
                orb(size: 220)
                hint(hintText)
            }
        }
    }

    private var hintText: String {
        flow.previous.map { "Húzd fel vagy le · legutóbb \($0) volt" } ?? "Húzd fel vagy le"
    }

    private func hint(_ text: String) -> some View {
        Text(text).nkFont(13).foregroundStyle(.white.opacity(0.65)).padding(.top, 4)
    }

    /// The orb is the answer: swipe up or down on it, the liquid follows.
    private func orb(size: CGFloat) -> some View {
        let v = flow.value
        return ZStack {
            Circle().fill(hue.sky[2].opacity(0.35)).frame(width: size * 1.36).blur(radius: 60)
            LivingOrb(palette: hue.orb, size: size, level: max(0.04, Double(v) / 10), glow: false, motion: motion, refills: false)
                .allowsHitTesting(false)
            VStack(spacing: 0) {
                Text("\(v)").font(.nkNumber(size * 0.355)).foregroundStyle(.white)
                    .contentTransition(.numericText(value: Double(v)))
                Text("a 10-ből").nkFont(13).foregroundStyle(.white.opacity(0.75))
            }
            .shadow(color: .black.opacity(0.3), radius: 8)
            .allowsHitTesting(false)
        }
        .frame(width: size * 1.36, height: size * 1.18)
        .contentShape(Circle())
        .gesture(
            DragGesture(minimumDistance: 2)
                .onChanged { g in
                    if !swiping { swiping = true; flow.beginSwipe() }
                    withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) { _ = flow.swipe(dy: g.translation.height) }
                }
                .onEnded { _ in swiping = false; flow.endSwipe() }
        )
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.45), trigger: v)
        .accessibilityElement()
        .accessibilityLabel("\(q.label): \(v) a 10-ből")
        .accessibilityAdjustableAction { direction in
            flow.beginSwipe()
            _ = flow.swipe(dy: direction == .increment ? -CheckinFlow.stepHeight : CheckinFlow.stepHeight)
            flow.endSwipe()
        }
    }

    /// Pain regions / craving kinds: one tap toggles.
    private var chips: some View {
        ChipFlow(spacing: 8) {
            ForEach(q.options, id: \.id) { option in
                let on = flow.isSelected(option.id)
                Button { flow.toggleOption(option.id) } label: {
                    Text(option.label).nkFont(14, .semibold).foregroundStyle(on ? NK.ground : .white)
                        .padding(.horizontal, 14).frame(minHeight: 36)
                        .background(Capsule().fill(on ? .white : .white.opacity(0.12)))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(.horizontal, 24)
        .sensoryFeedback(.selection, trigger: flow.painRegions + flow.cravingKinds)
    }

    @ViewBuilder private var buttons: some View {
        HStack(spacing: 10) {
            if q.kind == .pain && flow.painStage == .gate {
                NKPill("Kihagyom", primary: false) { Task { await flow.skip() } }
            } else {
                NKPill("Kihagyom", primary: false) { Task { await flow.skip() } }.frame(width: 130)
                NKPill(flow.isLast ? "Kész" : "Tovább") { Task { await flow.next() } }
            }
        }
        .disabled(flow.saving)
        .padding(.horizontal, 20).padding(.bottom, 20)
    }

    /// The item's colour world (spike order): energia Mozgás, hangulat Pulzus, feszültség Forma, test Fuel,
    /// fejtisztaság Alvás, the question of the day Pulzus.
    static func hue(for q: CheckInQuestion) -> Hue {
        switch q.key {
        case "energy": .mozgas
        case "mood": .pulzus
        case "stress": .forma
        case "body": .fuel
        case "mental": .alvas
        default: .pulzus
        }
    }
}

/// Lays chips out in rows, wrapping to the width, each row centred.
struct ChipFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = self.rows(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(width: bounds.width, subviews: subviews) {
            var x = bounds.minX + (bounds.width - row.width) / 2
            for i in row.items {
                let size = subviews[i].sizeThatFits(.unspecified)
                subviews[i].place(at: CGPoint(x: x, y: y + (row.height - size.height) / 2), proposal: .unspecified)
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row { var items: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func rows(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for i in subviews.indices {
            let size = subviews[i].sizeThatFits(.unspecified)
            let extra = rows[rows.count - 1].items.isEmpty ? size.width : size.width + spacing
            if rows[rows.count - 1].width + extra > width, !rows[rows.count - 1].items.isEmpty {
                rows.append(Row())
            }
            let r = rows.count - 1
            rows[r].width += rows[r].items.isEmpty ? size.width : size.width + spacing
            rows[r].height = max(rows[r].height, size.height)
            rows[r].items.append(i)
        }
        return rows.filter { !$0.items.isEmpty }
    }
}
