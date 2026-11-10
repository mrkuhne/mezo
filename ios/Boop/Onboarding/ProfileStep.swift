import SwiftUI
import BoopCore
import BoopDesign

struct ProfileStep: View {
    let model: OnboardingModel
    let name: String
    @State private var sex: String?
    @State private var height = 178.0
    @State private var birth = Calendar.current.date(from: DateComponents(year: 1990, month: 1, day: 1)) ?? Date()
    @State private var busy = false
    @State private var missingSex = false

    var body: some View {
        NKFlowFrame(hue: .forma, crumb: "Első lépések · Rólad", eyebrow: "Szia, \(name)", title: "Pár adat rólad",
                    sub: "Ebből számolom a keretedet.", onBack: nil) {
            if let p = model.problem { problemCard(onboardingText(p)) }
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    NKMono("NEM")
                    HStack(spacing: 8) { choice("Férfi", "M"); choice("Nő", "F") }
                    if missingSex {
                        Text("Válaszd ki az egyiket.").font(.system(size: 13)).foregroundStyle(Color(hex: 0xF7A8C4))
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    NKMono("MAGASSÁG")
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("\(Int(height))").font(.nkNumber(52)).monospacedDigit().contentTransition(.numericText(value: height))
                        Text("centi").font(.system(size: 15)).foregroundStyle(.white.opacity(0.7))
                    }
                    .foregroundStyle(.white)
                    RulerDial(value: $height, step: 1, range: 50...260, major: 10) { "\(Int($0))" }
                }
                VStack(alignment: .leading, spacing: 6) {
                    NKMono("SZÜLETÉSI DÁTUM")
                    DatePicker("Születési dátum", selection: $birth, in: ...Date(), displayedComponents: .date)
                        .datePickerStyle(.wheel).labelsHidden()
                        .environment(\.locale, Locale(identifier: "hu_HU"))
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(20).nkGlass()
            NKPill(busy ? "Pillanat…" : "Tovább") { if !busy { save() } }.padding(.top, 6)
        }
    }

    private func choice(_ title: String, _ value: String) -> some View {
        let on = sex == value
        return Button { sex = value; missingSex = false } label: {
            Text(title).font(.system(size: 15, weight: .semibold)).frame(maxWidth: .infinity).frame(height: 46)
                .foregroundStyle(on ? NK.ground : .white)
                .background(Capsule().fill(on ? .white : .white.opacity(0.1)))
        }
        .buttonStyle(PressStyle())
        .sensoryFeedback(.selection, trigger: on)
    }

    private func save() {
        guard let sex else { missingSex = true; return }
        busy = true
        Task {
            defer { busy = false }
            try? await model.saveProfile(sex: sex, heightCm: height, birthDate: birth)
        }
    }
}

@MainActor func problemCard(_ text: String) -> some View {
    HStack(alignment: .top, spacing: 10) {
        NKGlyph("repeat-peach", Color(hex: 0xF7A8C4), size: 20)
        Text(text).font(.system(size: 14, weight: .medium)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
    }
    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
    .nkGlass(18)
    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color(hex: 0xF06A9A).opacity(0.6), lineWidth: 1))
}
