import SwiftUI

/// Morning check-in: the core five + the adaptive "question of the day", one at a time,
/// answered by filling a liquid tank (1–10).
struct CheckinFlow: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    struct Q { let key, label, question, low, high: String; var why: String? = nil }
    private let qs: [Q] = [
        .init(key: "energy", label: "Energia", question: "Mennyi energia van benned most?", low: "Üres", high: "Tele"),
        .init(key: "mood", label: "Hangulat", question: "Milyen a hangulatod?", low: "Borús", high: "Ragyogó"),
        .init(key: "stress", label: "Stressz", question: "Mennyire vagy feszült?", low: "Nyugodt", high: "Túlfeszült"),
        .init(key: "body", label: "Test", question: "Hogy érzed a tested?", low: "Merev, fáj", high: "Friss"),
        .init(key: "mental", label: "Fejtisztaság", question: "Mennyire tiszta a fejed?", low: "Köd", high: "Éles"),
        .init(key: "hunger", label: "Éhség", question: "Mennyire vagy éhes ébredés után?", low: "Egyáltalán nem", high: "Farkaséhes",
              why: "Most azt figyelem, összefügg-e a reggeli éhséged a tegnapi késő vacsorával."),
    ]
    @State private var i = 0
    @State private var values: [String: Int] = ["energy": 7, "mood": 7, "stress": 3, "body": 6, "mental": 7, "hunger": 4]
    @State private var finished = UserDefaults.standard.bool(forKey: "checkinDone")
    @State private var note = ""

    var body: some View {
        FlowScaffold(eyebrow: "Reggel · 06:42", title: finished ? "Köszönöm" : "Hogy vagy?", mood: mood) {
            if finished { summary } else { question }
        }
    }

    @ViewBuilder private var question: some View {
        let q = qs[i]
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 6) {
                ForEach(qs.indices, id: \.self) { k in
                    Capsule().fill(.white.opacity(k <= i ? 0.85 : 0.15)).frame(height: 5)
                }
            }
            if let why = q.why {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "sparkles").foregroundStyle(mood.colors[2])
                    VStack(alignment: .leading, spacing: 4) {
                        Text("A NAP KÉRDÉSE").font(.caption.weight(.bold)).tracking(1.5).foregroundStyle(mood.colors[2])
                        Text(why).font(.system(.callout, design: .serif)).foregroundStyle(.white.opacity(0.75))
                    }
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(q.label.uppercased()).font(.caption.weight(.semibold)).tracking(1.5).foregroundStyle(.white.opacity(0.5))
                Text(q.question).font(.system(size: 24, weight: .semibold, design: .serif)).foregroundStyle(.white)
            }
            .id(q.key)
            .transition(.push(from: .trailing))

            LiquidTank(value: Binding(get: { values[q.key] ?? 5 }, set: { values[q.key] = $0 }),
                       colors: mood.colors, low: q.low, high: q.high, invert: q.key == "stress")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)

            HStack(spacing: 10) {
                if i > 0 {
                    Button { withAnimation(.spring) { i -= 1 } } label: { Image(systemName: "chevron.left").frame(width: 24) }
                        .buttonStyle(.glass).controlSize(.large)
                }
                Button("Most csak ennyi") { withAnimation(.spring) { finished = true } }
                    .buttonStyle(.glass).controlSize(.large)
                PrimaryButton(title: i == qs.count - 1 ? "Kész" : "Tovább", tint: mood.colors[0]) {
                    withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
                        if i == qs.count - 1 { finished = true } else { i += 1 }
                    }
                }
            }
        }
    }

    @ViewBuilder private var summary: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .bottom, spacing: 10) {
                ForEach(qs, id: \.key) { q in
                    VStack(spacing: 6) {
                        FillCapsule(value: Double(values[q.key] ?? 0) / 10, color: q.key == "stress" ? Boop.peach : mood.colors[2],
                                    label: q.label, amount: "\(values[q.key] ?? 0)", height: 90,
                                    track: .white.opacity(0.08), text: .white)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.vertical, 8)
            BoopSays(segs: [
                .init("Energiád 7, stressz csak 3: ez illik a jó éjszakához. A tested 6-os, "),
                .init("a vádlid még a szombati futástól lehet merev", "body"),
                .init(", ezért a mai Push napon a bemelegítést szánd rá 10 percre. A közepes éhség rendben van: a tegnapi vacsora 19:40-kor volt, nem későn."),
            ], mood: mood)
            TextField("", text: $note, prompt: Text("Gondolatok · opcionális").foregroundStyle(.white.opacity(0.35)), axis: .vertical)
                .lineLimit(2...4)
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 18).fill(.white.opacity(0.06)))
                .foregroundStyle(.white)
            PrimaryButton(title: "Mentés · 06:42", icon: "checkmark", tint: mood.colors[0]) {
                onDone("Energia \(values["energy"] ?? 0) · Stressz \(values["stress"] ?? 0) · Test \(values["body"] ?? 0)")
                dismiss()
            }
        }
        .sensoryFeedback(.success, trigger: finished)
    }
}

/// A vertical tank you fill by dragging: 1–10, waving surface, a haptic tick per step.
struct LiquidTank: View {
    @Binding var value: Int
    var colors: [Color]
    var low: String
    var high: String
    var invert = false            // for stress: more = warmer
    private let w: CGFloat = 150, h: CGFloat = 300

    var body: some View {
        HStack(alignment: .center, spacing: 18) {
            VStack {
                Text(high).font(.caption.weight(.semibold))
                Spacer()
                Text(low).font(.caption.weight(.semibold))
            }
            .foregroundStyle(.white.opacity(0.5))
            .frame(width: 70, height: h)
            ZStack(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 48).fill(.white.opacity(0.06))
                TimelineView(.animation) { tl in
                    let ph = tl.date.timeIntervalSinceReferenceDate * 1.7
                    let tint: [Color] = invert && value >= 7 ? [Boop.peach, Color(red: 0.85, green: 0.4, blue: 0.3)] : [colors[2], colors[0]]
                    ZStack(alignment: .bottom) {
                        Wave(phase: ph + 1.3, level: Double(value) / 10 + 0.015).fill(tint[0].opacity(0.35))
                        Wave(phase: ph, level: Double(value) / 10)
                            .fill(LinearGradient(colors: tint, startPoint: .top, endPoint: .bottom))
                    }
                    .animation(.spring(response: 0.4, dampingFraction: 0.7), value: value)
                }
                Text("\(value)")
                    .font(.system(size: 66, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText(value: Double(value)))
                    .shadow(color: .black.opacity(0.3), radius: 8)
                    .frame(maxHeight: .infinity)
            }
            .frame(width: w, height: h)
            .clipShape(RoundedRectangle(cornerRadius: 48))
            .overlay(RoundedRectangle(cornerRadius: 48).stroke(.white.opacity(0.1)))
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { g in
                let lvl = 1 - g.location.y / h
                withAnimation(.snappy) { value = max(1, min(10, Int((lvl * 10).rounded()))) }
            })
            .sensoryFeedback(.selection, trigger: value)
            .accessibilityElement()
            .accessibilityLabel("\(value) a tízből")
            .accessibilityAdjustableAction { dir in
                value = dir == .increment ? min(10, value + 1) : max(1, value - 1)
            }
            Color.clear.frame(width: 70, height: 1)
        }
    }
}
