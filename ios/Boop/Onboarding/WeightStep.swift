import SwiftUI
import BoopCore
import BoopDesign

struct WeightStep: View {
    let model: OnboardingModel
    @State private var kg = 80.0
    @State private var busy = false

    var body: some View {
        NKFlowFrame(hue: .fuel, crumb: "Első lépések · Mérlegelés", eyebrow: "Az első mérés", title: "Mennyi ma?",
                    sub: "Ébredés után, mosdó után a legpontosabb.", onBack: nil) {
            if let p = model.problem { problemCard(onboardingText(p)) }
            VStack(spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(hu1(kg)).font(.nkNumber(64)).monospacedDigit().contentTransition(.numericText(value: kg))
                    Text("kiló").font(.system(size: 16)).foregroundStyle(.white.opacity(0.7))
                }
                .foregroundStyle(.white)
                RulerDial(value: $kg, step: 0.1, range: 30...250, major: 10) { "\(Int($0.rounded()))" }
                Text("Húzd oldalra · tizedenként rezeg").font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(.vertical, 22).padding(.horizontal, 8).nkGlass()
            NKPill(busy ? "Pillanat…" : "Rögzítem", glyph: "check-ink") { if !busy { save() } }.padding(.top, 6)
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
