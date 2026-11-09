import SwiftUI

/// "Boop észrevette": the patterns and observations Boop is tracking, with how sure it is
/// (evidence as filling dots) and a yes/no "keep watching?" question.
struct PatternsView: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    struct P: Identifiable {
        let id = UUID(); let category: String; let icon: String; let tint: Color
        let title: String; let body: String; let chips: [String]
        let hits: Int; let of: Int; let status: String; let isNew: Bool; var ask: Bool = false
    }
    private let items: [P] = [
        .init(category: "Fiziológia", icon: "heart.fill", tint: Boop.peach,
              title: "Rossz éjszaka után magasabb a nyugalmi pulzusod",
              body: "A 6 óránál rövidebb éjszakák után átlag 4 ütéssel magasabb a reggeli nyugalmi pulzusod. Ez az órádból jön, az elmúlt 60 napból.",
              chips: ["60 nap", "11 rövid éjszaka", "Huawei óra"], hits: 9, of: 11, status: "Új · tanulom", isNew: true, ask: true),
        .init(category: "Kiváltó", icon: "fork.knife", tint: Boop.sun,
              title: "Késő vacsora → kevesebb mélyalvás",
              body: "Ha 21 óra után vacsorázol, aznap éjjel átlag 22 perccel kevesebb a mélyalvásod.",
              chips: ["Sleep Cycle", "14 késő vacsora"], hits: 10, of: 14, status: "Új · erősödik", isNew: true),
        .init(category: "Fiziológia", icon: "figure.run", tint: Boop.mint,
              title: "Magas sportterhelés → rákövetkező éjjel mélyebb alvás",
              body: "Nehéz edzésnap után az éjszakád mélyebb, de csak ha 22:30 előtt lefekszel.",
              chips: ["12 terhelt nap óta", "9 éjszaka megerősítve"], hits: 9, of: 12, status: "Megerősítve", isNew: false),
        .init(category: "Kapcsolatok", icon: "person.2.fill", tint: Boop.violet,
              title: "Anna és az alvásod",
              body: "Amikor Anna szerepel a hála-naplódban, másnap átlag 40 perccel többet alszol.",
              chips: ["hála-napló", "alvás"], hits: 4, of: 8, status: "Tanulom", isNew: false, ask: true),
    ]
    @State private var answered: [UUID: Bool] = [:]

    var body: some View {
        FlowScaffold(eyebrow: "Minták · összefüggések", title: "Boop észrevette", mood: mood) {
            VStack(alignment: .leading, spacing: 16) {
                Text("Mostantól az órád és a Sleep Cycle adatai is ide futnak be, ezért gyorsabban tanulok.")
                    .font(.system(.callout, design: .serif)).foregroundStyle(.white.opacity(0.6))
                ForEach(items) { p in card(p) }
                PrimaryButton(title: "Rendben", icon: "checkmark", tint: mood.colors[0]) {
                    onDone("2 új minta átnézve")
                    dismiss()
                }
            }
        }
    }

    private func card(_ p: P) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Label(p.category, systemImage: p.icon).font(.caption.weight(.bold)).foregroundStyle(p.tint)
                    Spacer()
                    Text(p.status).font(.caption2.weight(.bold))
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Capsule().fill(p.isNew ? mood.colors[0] : .white.opacity(0.08)))
                        .foregroundStyle(.white)
                }
                Text(p.title).font(.system(.title3, design: .serif).weight(.semibold)).foregroundStyle(.white)
                Text(p.body).font(.subheadline).foregroundStyle(.white.opacity(0.7))
                HStack(spacing: 4) {
                    ForEach(0..<p.of, id: \.self) { k in
                        Capsule().fill(k < p.hits ? p.tint : .white.opacity(0.12)).frame(height: 6)
                    }
                }
                Text("\(p.hits) / \(p.of) alkalommal igaz volt").font(.caption).foregroundStyle(.white.opacity(0.45))
                HStack(spacing: 6) {
                    ForEach(p.chips, id: \.self) { c in
                        Text(c).font(.caption2.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 4)
                            .background(Capsule().fill(.white.opacity(0.07))).foregroundStyle(.white.opacity(0.7))
                    }
                }
                if p.ask {
                    if let a = answered[p.id] {
                        Label(a ? "Figyelem tovább" : "Elengedem", systemImage: a ? "eye" : "xmark")
                            .font(.subheadline.weight(.semibold)).foregroundStyle(a ? Boop.mint : .white.opacity(0.5))
                    } else {
                        HStack {
                            Text("Figyeljem tovább?").font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                            Spacer()
                            Button("Nem") { withAnimation { answered[p.id] = false } }.buttonStyle(.glass)
                            Button("Igen") { withAnimation { answered[p.id] = true } }.buttonStyle(.glassProminent).tint(mood.colors[0])
                        }
                    }
                }
            }
        }
        .sensoryFeedback(.selection, trigger: answered[p.id])
    }
}
