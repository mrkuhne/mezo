import SwiftUI
import BoopCore
import BoopDesign

/// Past this drag (points) the top card flies off and the verdict is sent.
let swipeThreshold: CGFloat = 110

/// Right = Igaz (`true`), left = Nem rólam szól (`false`), a shorter drag = no verdict (the card springs back).
func swipeDecision(_ dx: CGFloat) -> Bool? {
    guard abs(dx) > swipeThreshold else { return nil }
    return dx > 0
}

/// The sentence around the bold phrase, with exactly one space at each seam (none before closing punctuation).
func observationParts(_ o: Brief.Observation) -> (lead: String, tail: String) {
    let lead = o.lead.trimmingCharacters(in: .whitespaces)
    let tail = o.tail.trimmingCharacters(in: .whitespaces)
    let tight = tail.first.map { ".,;:!?".contains($0) } ?? true
    return (lead.isEmpty ? "" : lead + " ", tight ? tail : " " + tail)
}

/// The label that fades in with the drag.
func swipeLabel(_ dx: CGFloat) -> String? {
    guard abs(dx) > 30 else { return nil }
    return dx > 0 ? ObservationText.yes : ObservationText.no
}

enum ObservationText {
    static let yes = "IGAZ"
    static let no = "NEM RÓLAM SZÓL"
    static let hint = "Jobbra: igaz · balra: nem rólam szól"
    static let thanks = "Köszönöm, ezekből tanulok."
    static let failed = "Most nem sikerült elmenteni"
    static let all = "Mind"
    static let yesAction = "Igaz"
    static let noAction = "Nem rólam szól"
}

private let cardFill = Color(red: 0x1A / 255, green: 0x20 / 255, blue: 0x27 / 255)

/// Boop észrevette (spec §5.1a): up to three observations stacked like notifications; drag the top one right = Igaz,
/// left = Nem rólam szól. Past 110 pt it flies off with a soft haptic and `decide` goes to the server.
struct ObservationStack: View {
    let observations: [Brief.Observation]
    let hue: Hue
    let motion: OrbMotion
    let decide: (String, Bool) async -> Bool
    let toast: (String) -> Void
    @State private var drag: CGFloat = 0
    @State private var gone: Set<String> = []
    @State private var decided = 0
    @State private var gate = DecideGate()

    private var cards: [Brief.Observation] { observations.filter { !gone.contains($0.id) } }

    var body: some View {
        let list = cards
        VStack(alignment: .leading, spacing: 10) {
            ZStack {
                if list.isEmpty {
                    Text(ObservationText.thanks).nkFont(18, design: .serif).foregroundStyle(.white.opacity(0.7))
                        .frame(maxWidth: .infinity, minHeight: 120).nkGlass()
                }
                ForEach(Array(list.prefix(3).enumerated().reversed()), id: \.element.id) { idx, o in
                    let top = idx == 0
                    card(o, top: top)
                        .scaleEffect(1 - CGFloat(idx) * 0.05, anchor: .bottom)
                        .offset(y: CGFloat(idx) * 10)
                        .offset(x: top ? drag : 0)
                        .rotationEffect(.degrees(top ? Double(drag / 22) : 0))
                        .gesture(HorizontalPan(enabled: top, onChange: { drag = $0 }, onEnd: { end(o, $0) }))
                        .allowsHitTesting(top)
                        .accessibilityHidden(!top)
                }
            }
            .padding(.bottom, CGFloat(min(2, max(0, list.count - 1))) * 10)
            .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.6), trigger: decided)
            HStack {
                Text(ObservationText.hint).nkFont(12).foregroundStyle(.white.opacity(0.45))
                Spacer()
                Button { toast(soonToast("Az összes megfigyelés")) } label: {
                    HStack(spacing: 3) {
                        Text(ObservationText.all)
                        Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold))
                    }
                    .nkFont(13, .semibold).foregroundStyle(.white.opacity(0.8))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 4)
        }
    }

    private func end(_ o: Brief.Observation, _ dx: CGFloat) {
        if let verdict = swipeDecision(dx) {
            send(o, verdict)
        } else {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) { drag = 0 }
        }
    }

    private func send(_ o: Brief.Observation, _ verdict: Bool) {
        guard gate.begin(o.id) else { return }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { drag = verdict ? 500 : -500 }
        decided += 1
        let last = cards.count == 1
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(250))
            withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { _ = gone.insert(o.id); drag = 0 }
            let saved = await decide(o.id, verdict)
            gate.end(o.id)
            if saved {
                if last { toast(ObservationText.thanks) }
            } else {
                withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { _ = gone.remove(o.id) }
                toast(ObservationText.failed)
            }
        }
    }

    private func card(_ o: Brief.Observation, top: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                LivingOrb(palette: hue.orb, size: 20, level: 0.85, glow: false, motion: motion).allowsHitTesting(false)
                HStack(spacing: 4) {
                    ForEach(0..<5, id: \.self) { k in
                        Circle().fill(.white.opacity(k < o.strength ? 0.85 : 0.2)).frame(width: 6, height: 6)
                    }
                }
                Spacer()
                if top, let label = swipeLabel(drag) {
                    Text(label).nkFont(11, .bold, design: .monospaced)
                        .foregroundStyle(drag > 0 ? NK.ground : .white)
                        .padding(.horizontal, 9).padding(.vertical, 5)
                        .background(Capsule().fill(drag > 0 ? .white : .white.opacity(0.18)))
                        .opacity(min(1, Double(abs(drag) - 30) / 60))
                }
            }
            let parts = observationParts(o)
            Text("\(parts.lead)\(Text(o.bold).bold().foregroundColor(.white))\(parts.tail)")
                .nkFont(18, design: .serif).lineSpacing(4).foregroundStyle(.white.opacity(0.78))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(cardFill))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(.white.opacity(0.12), lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityHint(ObservationText.hint)
        .accessibilityAction(named: ObservationText.yesAction) { send(o, true) }
        .accessibilityAction(named: ObservationText.noAction) { send(o, false) }
    }
}

/// A sideways pan that only begins when the finger moves more sideways than up or down, so a vertical drag that starts
/// on a card still scrolls the page (a SwiftUI DragGesture inside the ScrollView swallows it).
private struct HorizontalPan: UIGestureRecognizerRepresentable {
    let enabled: Bool
    let onChange: (CGFloat) -> Void
    /// The final horizontal travel; 0 when the pan was cancelled.
    let onEnd: (CGFloat) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let g = UIPanGestureRecognizer()
        g.delegate = context.coordinator
        return g
    }

    func updateUIGestureRecognizer(_ g: UIPanGestureRecognizer, context: Context) { g.isEnabled = enabled }

    func handleUIGestureRecognizerAction(_ g: UIPanGestureRecognizer, context: Context) {
        let dx = g.translation(in: g.view).x
        switch g.state {
        case .changed: onChange(dx)
        case .ended: onEnd(dx)
        case .cancelled, .failed: onEnd(0)
        default: break
        }
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
            guard let pan = g as? UIPanGestureRecognizer else { return true }
            let v = pan.velocity(in: pan.view)
            return abs(v.x) > abs(v.y)
        }
    }
}

/// Verdicts in flight: a card flying off (250 ms before it leaves the stack) cannot be judged a second time by another
/// swipe or a VoiceOver action.
struct DecideGate {
    private var inFlight: Set<String> = []
    /// False when this card's verdict is already on its way.
    mutating func begin(_ id: String) -> Bool { inFlight.insert(id).inserted }
    mutating func end(_ id: String) { inFlight.remove(id) }
}
