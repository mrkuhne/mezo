import SwiftUI

/// Daily intention: the standing creed + up to three foci for today, then Boop's feedback
/// on how they fit the calendar, the training plan and the weight goal.
struct IntentionFlow: View {
    var mood: Mood
    var onDone: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var foci = ["Lezárom a Q4 prezentációt", "Az edzésen a formára figyelek, nem a súlyra", "22:45-kor lefekszem"]
    @State private var asked = UserDefaults.standard.bool(forKey: "intentionAsked")
    @FocusState private var focused: Int?

    private let fits: [(String, String, Color)] = [
        ("calendar", "naptár: 10:30 előtt", Boop.sky),
        ("figure.strengthtraining.traditional", "edzés: Push nap", Boop.mint),
        ("moon.fill", "alvás: 7ó 30p", Boop.violet),
    ]

    var body: some View {
        FlowScaffold(eyebrow: "Rutin · reggel", title: "Mi ma a fókuszod?", mood: mood) {
            VStack(alignment: .leading, spacing: 18) {
                Card {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("A HITVALLÁSOD").font(.caption.weight(.bold)).tracking(1.5).foregroundStyle(.white.opacity(0.45))
                        Text("„Minden döntésem a célom felé visz — szándékkal élek, nem sodródom.”")
                            .font(.system(.title3, design: .serif).italic()).foregroundStyle(.white.opacity(0.9))
                    }
                }

                SectionHead(title: "A mai három", color: .white.opacity(0.5))
                ForEach(foci.indices, id: \.self) { k in
                    HStack(alignment: .top, spacing: 14) {
                        Text("\(k + 1)")
                            .font(.system(.title2, design: .serif).weight(.semibold))
                            .foregroundStyle(mood.colors[2])
                            .frame(width: 28)
                        VStack(alignment: .leading, spacing: 8) {
                            TextField("", text: $foci[k], prompt: Text("pl. nyugodt tempó").foregroundStyle(.white.opacity(0.3)), axis: .vertical)
                                .font(.system(.title3, design: .serif))
                                .foregroundStyle(.white)
                                .focused($focused, equals: k)
                            if asked {
                                Label(fits[k].1, systemImage: fits[k].0)
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(Capsule().fill(fits[k].2.opacity(0.18)))
                                    .foregroundStyle(fits[k].2)
                                    .transition(.scale(scale: 0.8).combined(with: .opacity))
                            }
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 20).fill(.white.opacity(focused == k ? 0.09 : 0.05)))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(focused == k ? 0.25 : 0.08)))
                }
                Text("Legfeljebb 200 karakter. Este megkérdezem, szándékkal élted-e a napot.")
                    .font(.footnote).foregroundStyle(.white.opacity(0.4))

                if asked {
                    BoopSays(segs: [
                        .init("Jó hármas, és mindegyik illik a napodhoz. A prezentációt "),
                        .init("tedd 10:30 elé", "day"),
                        .init(": a workshop után a délutáni mélypontba csúszna. A formára figyelés "),
                        .init("pont a mai Push naphoz való", "train"),
                        .init(", nehéz fekvenyomás jön. A korai lefekvés a kulcs: így a súlycélod heti -0,4 kg-os tempója is tartható. "),
                        .init("Tipp: az ebédnél kezdd a fehérjével, hogy délután ne nassolj."),
                    ], mood: mood, title: "BOOP VÉLEMÉNYE")
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    PrimaryButton(title: "Mentés", icon: "checkmark", tint: mood.colors[0]) {
                        onDone(foci.prefix(1).joined() + " · +2")
                        dismiss()
                    }
                } else {
                    PrimaryButton(title: "Mit szólsz hozzá, Boop?", icon: "sparkles", tint: mood.colors[0]) {
                        focused = nil
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) { asked = true }
                    }
                }
            }
        }
    }
}
