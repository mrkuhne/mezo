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
        LagyFlowFrame(photoName: "nap-lista.jpg", crumb: ("Első lépések › ", "Rólad"), eyebrow: "Szia, \(name)", title: "Pár adat rólad",
                      sub: "Ebből számolom a keretedet.", showsBack: false) {
            VStack(alignment: .leading, spacing: 0) {
                if let p = model.problem { problemCard(onboardingText(p)) }
                LagySection(title: "Nem", top: 4) {
                    HStack(spacing: 8) {
                        choice("Férfi", "M"); choice("Nő", "F")
                    }
                    if missingSex { Text("Válaszd ki az egyiket.").font(.manrope(13, .semibold)).foregroundStyle(Lagy.peachInk).padding(.leading, 6) }
                }
                LagySection(title: "Magasság") {
                    VStack(spacing: 10) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("\(Int(height))").font(.outfit(48, .heavy)).tracking(-1).monospacedDigit()
                                .contentTransition(.numericText(value: height))
                            Text("centi").font(.manrope(15, .bold)).foregroundStyle(Lagy.ink2)
                        }
                        .foregroundStyle(Lagy.ink).frame(maxWidth: .infinity)
                        RulerDial(value: $height, step: 1, range: 50...260, major: 10) { "\(Int($0))" }
                    }
                    .padding(.vertical, 18).padding(.horizontal, 12).lagyCard()
                }
                LagySection(title: "Születési dátum") {
                    DatePicker("Születési dátum", selection: $birth, in: ...Date(), displayedComponents: .date)
                        .datePickerStyle(.wheel).labelsHidden()
                        .environment(\.locale, Locale(identifier: "hu_HU"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6).lagyCard()
                }
                WidePill(title: "Tovább", busy: busy) { save() }.padding(.top, 24)
            }
        }
    }

    private func choice(_ title: String, _ value: String) -> some View {
        let on = sex == value
        return Button { sex = value; missingSex = false } label: {
            Text(title).font(.manrope(15, .bold)).frame(maxWidth: .infinity).frame(height: 50)
                .foregroundStyle(on ? .white : Lagy.ink)
                .background(Capsule().fill(on ? Lagy.ink : .white).shadow(color: Lagy.ink.opacity(on ? 0 : 0.08), radius: 10, y: 6))
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
        Glyph("repeat", "peach", size: 22)
        Text(text).font(.manrope(14, .semibold)).foregroundStyle(Lagy.peachInk).fixedSize(horizontal: false, vertical: true)
    }
    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
    .lagyCard(18, fill: Lagy.peach2)
    .padding(.bottom, 8)
}
