import SwiftUI
import BoopCore
import BoopDesign

struct WeightStep: View {
    let model: OnboardingModel
    @State private var kg = 80.0
    @State private var busy = false

    var body: some View {
        LagyFlowFrame(photoName: "en-merleg.jpg", crumb: ("Első lépések › ", "Mérlegelés"), eyebrow: "Az első mérés", title: "Mennyi ma?",
                      sub: "Ébredés után, mosdó után a legpontosabb.", showsBack: false) {
            VStack(alignment: .leading, spacing: 20) {
                if let p = model.problem { problemCard(onboardingText(p)) }
                VStack(spacing: 14) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(hu1(kg)).font(.outfit(64, .heavy)).tracking(-1.5).monospacedDigit()
                            .contentTransition(.numericText(value: kg))
                        Text("kiló").font(.manrope(16, .bold)).foregroundStyle(Lagy.ink2)
                    }
                    .foregroundStyle(Lagy.ink).frame(maxWidth: .infinity)
                    RulerDial(value: $kg, step: 0.1, range: 30...250, major: 10) { "\(Int($0.rounded()))" }
                    Chip(text: "húzd oldalra", style: .soft, small: true)
                }
                .padding(.vertical, 20).padding(.horizontal, 12).lagyCard()
                WidePill(title: "Rögzítem", glyph: ("check", "sage"), busy: busy) { save() }
            }
        }
    }

    private func save() {
        busy = true
        Task {
            defer { busy = false }
            try? await model.saveWeight(kg)
        }
    }
}
