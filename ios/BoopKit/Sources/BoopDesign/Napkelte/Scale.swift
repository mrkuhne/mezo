import SwiftUI

// MARK: - The scale (mezo-r36n9.147)

/// **A number he sets by dragging a scale** — the owner's ask of 2026-11-23 („súly és ismétlés legyen görgetős /
/// tekerős"), the weight in **0,5 kg** steps. The number stays big, as on the stepper it replaces; under it a ruler
/// slides under a fixed pointer: drag left for more, right for less, every step a tick and a click. A tap on the
/// number still opens the keyboard, because 62,5 kg on a strange machine is faster typed. The plan's own value sits
/// on the ruler as a small mark in the hue, so he sees how far from it he is.
public struct NKScale: View {
    let label: String
    let value: Double
    let step: Double
    let range: ClosedRange<Double>
    let hue: Hue
    /// The small word after the label („TERV", „ELŐZŐ"); nil for none. It also dims the number: a value that is
    /// not yet his is shown quieter, as the stepper did.
    let tag: String?
    /// The plan's value, marked on the ruler when it is in view.
    let plan: Double?
    let format: (Double) -> String
    let onChange: @MainActor @Sendable (Double) -> Void
    /// Typing instead of dragging. `nil` keeps the number read-only.
    let onSet: (@MainActor @Sendable (String) -> Void)?

    /// The value the drag started from; nil between drags.
    @State private var dragStart: Double?
    @State private var draft = ""
    @FocusState private var editing: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(label: String, value: Double, step: Double, range: ClosedRange<Double>, hue: Hue,
                tag: String? = nil, plan: Double? = nil,
                format: @escaping (Double) -> String,
                onChange: @escaping @MainActor @Sendable (Double) -> Void,
                onSet: (@MainActor @Sendable (String) -> Void)? = nil) {
        self.label = label; self.value = value; self.step = max(0.001, step); self.range = range; self.hue = hue
        self.tag = tag; self.plan = plan; self.format = format; self.onChange = onChange; self.onSet = onSet
    }

    /// Points per step. Half-kilo steps at 9 pt put a 2,5 kg plate 45 pt apart — one short pull of a thumb; whole
    /// steps (reps) get more room.
    private var pxPerStep: CGFloat { step < 1 ? 9 : 14 }
    /// A taller tick every so many steps, with its number: 5 kg on the weight scale, 5 reps on the rep scale.
    private var majorEvery: Int { step < 1 ? 10 : 5 }
    private var numberSize: CGFloat { 40 }

    public var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 5) {
                Text(label.uppercased()).nkFont(10, .medium, design: .monospaced).tracking(1.2)
                if let tag {
                    Text("· \(tag)").nkFont(10, design: .monospaced).tracking(1.2)
                        .foregroundStyle(.white.opacity(0.35))
                }
            }
            .foregroundStyle(.white.opacity(0.5))

            number

            ruler
                .frame(height: 44)
                .contentShape(Rectangle())
                .highPriorityGesture(drag)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .nkGlass()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(label): \(format(value))")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: commit(value + step)
            case .decrement: commit(value - step)
            default: break
            }
        }
        // A click per step, only under his finger — not when the page prefills the number.
        .sensoryFeedback(.selection, trigger: value) { _, _ in dragStart != nil }
    }

    // MARK: the number

    @ViewBuilder private var number: some View {
        if let onSet {
            TextField("", text: $draft)
                .keyboardType(step < 1 ? .decimalPad : .numberPad)
                .multilineTextAlignment(.center)
                .focused($editing)
                .nkFont(numberSize, .medium)
                .foregroundStyle(editing ? hue.glow : (tag == nil ? hue.glow : .white.opacity(0.62)))
                .lineLimit(1).minimumScaleFactor(0.6)
                .frame(height: numberSize * 1.18)
                .accessibilityLabel("\(label), beírható")
                .onAppear { draft = format(value) }
                // While he types, the field is his; the moment he leaves it the typed value is committed and the
                // page's own text takes over again.
                .onChange(of: value) { if !editing { draft = format(value) } }
                .onChange(of: editing) { _, now in if now { draft = format(value) } else { onSet(draft); draft = format(value) } }
                .toolbar {
                    if editing {
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button("Kész") { editing = false }
                        }
                    }
                }
        } else {
            Text(format(value))
                .nkFont(numberSize, .medium)
                .foregroundStyle(tag == nil ? hue.glow : .white.opacity(0.62))
                .contentTransition(.numericText())
                .lineLimit(1).minimumScaleFactor(0.6)
                .frame(height: numberSize * 1.18)
        }
    }

    // MARK: the ruler

    /// Ticks slide under a fixed pointer. Drawn, not laid out: a weight scale is six hundred ticks, and a drawing
    /// costs nothing to move.
    private var ruler: some View {
        Canvas { ctx, size in
            let mid = size.width / 2
            let base = size.height - 6
            let half = Int(mid / pxPerStep) + 1
            let at = Int((value / step).rounded())
            // Ticks that fit, with the pointer's own at `at`.
            for k in (at - half)...(at + half) {
                let v = Double(k) * step
                guard range.contains(v) || abs(v - range.lowerBound) < step / 2 || abs(v - range.upperBound) < step / 2
                else { continue }
                let x = mid + CGFloat((v - value) / step) * pxPerStep
                let major = k % majorEvery == 0
                let medium = !major && k % (majorEvery / 2) == 0
                let h: CGFloat = major ? 16 : (medium ? 11 : 7)
                let far = Double(min(1, abs(x - mid) / mid))
                let fade = 1 - 0.6 * far
                let alpha = (major ? 0.75 : 0.45) * fade
                var line = Path()
                line.move(to: CGPoint(x: x, y: base))
                line.addLine(to: CGPoint(x: x, y: base - h))
                ctx.stroke(line, with: .color(.white.opacity(alpha)), lineWidth: 1)
                if major {
                    let text = Text(Self.tickLabel(v)).font(.system(size: 9, weight: .medium, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.5 * fade))
                    ctx.draw(text, at: CGPoint(x: x, y: base - h - 7), anchor: .center)
                }
            }
            // The plan's mark: a dot under the baseline, in the hue, when it is in view.
            if let plan, plan != value {
                let x = mid + CGFloat((plan - value) / step) * pxPerStep
                if x >= 2, x <= size.width - 2 {
                    let dot = Path(ellipseIn: CGRect(x: x - 3, y: base + 1, width: 6, height: 6))
                    ctx.fill(dot, with: .color(hue.glow))
                }
            }
            // The pointer.
            let pointer = Path(roundedRect: CGRect(x: mid - 1.25, y: base - 22, width: 2.5, height: 24), cornerRadius: 1.25)
            ctx.fill(pointer, with: .color(hue.glow))
        }
        .mask {
            // The ends fade so the ruler reads as a strip that goes on, not a box.
            LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.12),
                                   .init(color: .black, location: 0.88), .init(color: .clear, location: 1)],
                           startPoint: .leading, endPoint: .trailing)
        }
    }

    /// „5", „62,5": the number under a tall tick, in the phone's own decimal comma.
    static func tickLabel(_ v: Double) -> String {
        v.rounded() == v ? "\(Int(v))" : String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
    }

    // MARK: dragging

    private var drag: some Gesture {
        DragGesture(minimumDistance: 3, coordinateSpace: .local)
            .onChanged { g in
                let start = dragStart ?? value
                if dragStart == nil { dragStart = start }
                // The ruler moves with the finger: pulling it left brings the higher values under the pointer.
                commit(start - Double(g.translation.width / pxPerStep) * step)
            }
            .onEnded { _ in dragStart = nil }
    }

    /// Snaps to the step and the range, and tells the page only when the number actually moved.
    private func commit(_ raw: Double) {
        let snapped = (raw / step).rounded() * step
        let clamped = min(range.upperBound, max(range.lowerBound, snapped))
        let clean = (clamped * 1000).rounded() / 1000
        guard clean != value else { return }
        onChange(clean)
    }
}
